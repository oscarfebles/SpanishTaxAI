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

  // ─── 2a. Auth check — only PAID users skip gating ───────────────
  let isAuthenticated = false;
  let isPaidUser = false;
  let userEmail = null;
  var authHeader = request.headers.get('authorization') || '';

  if (authHeader.startsWith('Bearer ')) {
    try {
      var token = authHeader.slice(7);
      var authRes = await fetch(env.SUPABASE_URL + '/auth/v1/user', {
        headers: {
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': 'Bearer ' + token,
        },
      });
      if (authRes.ok) {
        isAuthenticated = true;
        var userData = await authRes.json();
        userEmail = (userData.email || '').toLowerCase().trim();

        // Admin bypass
        var adminEmails = (env.ADMIN_EMAILS || '').split(',').map(function(e) { return e.trim().toLowerCase(); });
        if (adminEmails.includes(userEmail)) {
          isPaidUser = true;
        } else {
          // Check customers table for paid tier
          var custRes = await fetch(
            env.SUPABASE_URL + '/rest/v1/customers?email=eq.' + encodeURIComponent(userEmail) + '&select=tier,status',
            {
              headers: {
                'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
              },
            }
          );
          if (custRes.ok) {
            var customers = await custRes.json();
            if (customers.length > 0 && customers[0].status === 'active') {
              var paidTiers = ['dnv_pack', 'dnv_audit', 'pro', 'premium', 'admin'];
              isPaidUser = paidTiers.includes(customers[0].tier);
            }
          }
        }
      }
    } catch (err) {
      console.error('Auth verification failed:', err);
    }
  }

  // ─── 2b. Rate limit check (per IP) ─────────────────────────────────
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

  // ─── 3. Session turn count check (gating logic v1.1) ─────────────────
  // Authenticated users skip this entire block.
  // Anonymous gating: 3 turns → email gate → 3 more → paywall
  let turnNumber = 0;
  let emailAlreadyCaptured = false;
  let emailInCurrentMessage = null;

  if (!isPaidUser) {
    const turnCount = await countSessionTurns(env, session_id);
    turnNumber = turnCount + 1;
    emailAlreadyCaptured = await hasEmailCaptured(env, session_id);

    emailInCurrentMessage = EMAIL_RE.exec(message)?.[0] || null;
    if (emailInCurrentMessage && !emailAlreadyCaptured) {
      try {
        await logTurn(env, {
          session_id,
          turn_number: turnNumber,
          user_message: '[EMAIL_CAPTURE_EVENT]',
          assistant_response: null,
          chunks_retrieved: [],
          escalation_triggered: false,
          escalation_reason: 'email_provided',
          email_captured: emailInCurrentMessage,
          user_language_detected: null,
          response_time_ms: 0,
          input_tokens: 0,
          output_tokens: 0,
          ip_country: request.headers.get('cf-ipcountry') || null,
          user_agent: request.headers.get('user-agent') || null,
        });
        emailAlreadyCaptured = true;
      } catch (err) {
        console.error('Failed to persist email capture:', err);
      }
    }

    const anonymousLimit = parseInt(env.ANONYMOUS_TURN_LIMIT || '3', 10);
    const withEmailLimit = parseInt(env.WITH_EMAIL_TURN_LIMIT || '8', 10);

    const paywallTriggered =
      (!emailAlreadyCaptured && turnNumber > anonymousLimit) ||
      (emailAlreadyCaptured && turnNumber > withEmailLimit);

    if (paywallTriggered) {
      const paywallPayload = {
        type: 'paywall',
        message: "You've reached the limit of your free messages.",
        reason: emailAlreadyCaptured ? 'limit_with_email' : 'limit_anonymous',
        tiers: [
          {
            id: 'dnv_pack',
            name: 'DNV Application Pack',
            price: '€199',
            billing: 'one-time',
            tagline: 'Self-serve roadmap, templates, document checklist',
            url: 'https://buy.stripe.com/28EcN51KZdtialN88Wbwk05',
            recommended: false,
          },
          {
            id: 'dnv_audit',
            name: 'DNV Pro Audit',
            price: '€499',
            billing: 'one-time',
            tagline: 'Complete async review of your application package',
            url: 'https://buy.stripe.com/7sYfZhfBP4WMeC3ah4bwk04',
            recommended: true,
          },
          {
            id: 'pro',
            name: 'Spanish Resident Pro',
            price: '€14.50',
            billing: '/month (founding rate)',
            tagline: 'Ongoing autónomo tax compliance + chatbot priority',
            url: 'https://buy.stripe.com/14A8wP0GV3SIctVbl8bwk03',
            recommended: false,
          },
          {
            id: 'premium',
            name: 'Premium Concierge',
            price: '€49.50',
            billing: '/month (founding rate)',
            tagline: 'Async quarterly review + WhatsApp/Telegram priority',
            url: 'https://buy.stripe.com/cNi14n61fexmeC3ah4bwk01',
            recommended: false,
          },
        ],
        footer: 'Already have a plan? Sign in at spanishtaxai.com/login',
      };

      ctx.waitUntil(logTurn(env, {
        session_id,
        turn_number: turnNumber,
        user_message: message,
        assistant_response: '[PAYWALL_TRIGGERED]',
        chunks_retrieved: [],
        escalation_triggered: false,
        escalation_reason: paywallPayload.reason,
        email_captured: null,
        user_language_detected: detectLanguage(message),
        response_time_ms: Date.now() - startTime,
        input_tokens: 0,
        output_tokens: 0,
        ip_country: request.headers.get('cf-ipcountry') || null,
        user_agent: request.headers.get('user-agent') || null,
      }));

      return new Response(JSON.stringify(paywallPayload), {
        status: 402,
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  // ─── 4. Language + escalation detection ──────────────────────────────
  const detectedLang = detectLanguage(message);
  const escalation = detectEscalation(message);

  // ─── 5. (emailAlreadyCaptured already computed in step 3) ─────────────

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
    emailJustProvided: emailInCurrentMessage !== null,
  });

  // ─── 8. Build messages array from history + current message ──────────
  // History format expected from widget: [{role, content}, ...] (last N turns)
  const messages = [...safeHistory, { role: 'user', content: message }];

  // ─── 9. Call Claude with streaming ───────────────────────────────────
  let streamResult;
  try {
    streamResult = await callClaudeStreaming(env, systemPrompt, messages, turnNumber === 1 ? 2048 : 1024);
  } catch (err) {
    console.error('Anthropic API failed:', err);
    return jsonError(503, 'llm_failed', 'AI service temporarily unavailable. Please retry in a moment.');
  }

  // ─── 10. Log the turn asynchronously (don't await — fire-and-forget) ─
  // Note: emailInCurrentMessage was already computed in step 3 and persisted
  // synchronously if it was a new email. Logging it again here is harmless.
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
      email_captured: emailInCurrentMessage,
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

