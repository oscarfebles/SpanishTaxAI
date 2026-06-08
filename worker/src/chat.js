/**
 * /chat endpoint handler.
 *
 * Orchestrates the full chatbot turn:
 *   1. Validate input
 *   2. Check rate limit + session turn count limits
 *   3. Detect language
 *   4. Detect escalation triggers
 *   5. Embed query → retrieve chunks
 *   6. Build system prompt
 *   7. Call Claude with streaming
 *   8. Return the stream to the client; log the turn in background
 */

import { checkRateLimit } from './rateLimit.js';
import { detectLanguage } from './language.js';
import { detectEscalation } from './escalation.js';
import { embedQuery, retrieveChunks } from './retrieval.js';
import { buildSystemPrompt } from './prompt.js';
import { callClaudeStreaming } from './anthropic.js';
import { logTurn, countSessionTurns, hasEmailCaptured } from './logging.js';

/**
 * Email extraction regex.
 * Used to detect if the user gave their email in this turn.
 */
const EMAIL_RE = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/;

export async function handleChat(request, env, ctx) {
  const startTime = Date.now();

  // ─── 1. Parse and validate body ──────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_json', 'Request body must be valid JSON.');
  }

  const { session_id, message, history } = body;
  if (!session_id || typeof session_id !== 'string') {
    return jsonError(400, 'missing_session_id', 'session_id is required.');
  }
  if (!message || typeof message !== 'string') {
    return jsonError(400, 'missing_message', 'message is required.');
  }
  if (message.length > 2000) {
    return jsonError(400, 'message_too_long', 'message must be 2000 characters or fewer.');
  }
  const safeHistory = Array.isArray(history) ? history.slice(-20) : []; // last 10 turns max

  // ─── 2. Rate limit check (per IP) ────────────────────────────────────
  const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
  const rateCheck = await checkRateLimit(env, clientIp);
  if (!rateCheck.allowed) {
    return jsonError(
      429,
      'rate_limited',
      `Too many requests. Try again in ~${rateCheck.retryAfter}s.`,
      { 'retry-after': String(rateCheck.retryAfter) },
    );
  }

  // ─── 3. Session turn count check ─────────────────────────────────────
  const turnCount = await countSessionTurns(env, session_id);
  const softLimit = parseInt(env.SOFT_TURN_LIMIT || '25', 10);
  const hardLimit = parseInt(env.HARD_TURN_LIMIT || '40', 10);
  const turnNumber = turnCount + 1;

  if (turnCount >= hardLimit) {
    return jsonError(
      403,
      'session_exhausted',
      "You've reached the maximum length for this conversation. Please book a free 15-min call at https://calendly.com/spanishtaxai or start a new session.",
    );
  }

  // ─── 4. Language + escalation detection ──────────────────────────────
  const detectedLang = detectLanguage(message);
  const escalation = detectEscalation(message);

  // ─── 5. Email status check (cached per session) ──────────────────────
  const emailAlreadyCaptured = await hasEmailCaptured(env, session_id);

  // ─── 6. Embed query + retrieve chunks ────────────────────────────────
  let queryEmbedding, chunks;
  try {
    queryEmbedding = await embedQuery(env, message);
    chunks = await retrieveChunks(env, queryEmbedding, {
      matchThreshold: 0.4,
      matchCount: 5,
    });
  } catch (err) {
    console.error('Retrieval pipeline failed:', err);
    return jsonError(503, 'retrieval_failed', 'Knowledge base temporarily unavailable. Please retry in a moment.');
  }

  // ─── 7. Build system prompt ──────────────────────────────────────────
  const systemPrompt = buildSystemPrompt({
    chunks,
    escalation,
    detectedLang,
    turnNumber,
    env,
    emailAlreadyCaptured,
  });

  // Optionally append a soft-limit warning to the system prompt
  let finalSystemPrompt = systemPrompt;
  if (turnCount >= softLimit) {
    finalSystemPrompt += `

## SOFT LIMIT REACHED

This conversation is reaching its natural length (${turnCount} turns). After your answer, gently invite:
> "By the way, this is a good moment to consider a free 15-min call to wrap up your specific case — https://calendly.com/spanishtaxai"`.trim();
  }

  // ─── 8. Build messages array from history + current message ──────────
  // History format expected from widget: [{role, content}, ...] (last N turns)
  const messages = [...safeHistory, { role: 'user', content: message }];

  // ─── 9. Call Claude with streaming ───────────────────────────────────
  let streamResult;
  try {
    streamResult = await callClaudeStreaming(env, finalSystemPrompt, messages, turnNumber === 1 ? 2048 : 1024);
  } catch (err) {
    console.error('Anthropic API failed:', err);
    return jsonError(503, 'llm_failed', 'AI service temporarily unavailable. Please retry in a moment.');
  }

  // ─── 10. Log the turn asynchronously (don't await — fire-and-forget) ─
  const emailCaptured = EMAIL_RE.exec(message)?.[0] || null;
  const ipCountry = request.headers.get('cf-ipcountry') || null;
  const userAgent = request.headers.get('user-agent') || null;

  ctx.waitUntil((async () => {
    let bodyData = { fullText: null, inputTokens: 0, outputTokens: 0 };
    try {
      bodyData = await streamResult.captureBody();
    } catch (err) {
      console.error('captureBody failed:', err);
    }

    const elapsed = Date.now() - startTime;

    await logTurn(env, {
      session_id,
      turn_number: turnNumber,
      user_message: message,
      assistant_response: bodyData.fullText,
      chunks_retrieved: chunks.map((c) => c.chunk_id),
      escalation_triggered: escalation !== null,
      escalation_reason: escalation?.id || null,
      email_captured: emailCaptured,
      user_language_detected: detectedLang,
      response_time_ms: elapsed,
      input_tokens: bodyData.inputTokens,
      output_tokens: bodyData.outputTokens,
      ip_country: ipCountry,
      user_agent: userAgent,
    });
  })());

  // ─── 11. Return the stream to the client ─────────────────────────────
  return streamResult.response;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function jsonError(status, code, message, extraHeaders = {}) {
  return new Response(
    JSON.stringify({ error: { code, message } }),
    {
      status,
      headers: { 'content-type': 'application/json', ...extraHeaders },
    },
  );
}
