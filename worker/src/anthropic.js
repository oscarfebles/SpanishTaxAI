/**
 * Anthropic API integration with streaming.
 *
 * Returns a ReadableStream that the Worker pipes back to the client.
 * The stream contains Server-Sent Events (SSE) from Anthropic's API,
 * which the widget parses on the client side.
 *
 * The widget handles three event types:
 *   - content_block_delta → text fragments to display
 *   - message_stop → conversation turn complete
 *   - error → handle gracefully (show toast / fallback)
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Calls Claude with streaming. Returns the raw Response so the Worker
 * can stream it back to the client without buffering.
 *
 * Args:
 *   env             — Worker env (contains ANTHROPIC_API_KEY and ANTHROPIC_MODEL)
 *   systemPrompt    — string, full system prompt built by prompt.js
 *   messages        — array of {role: 'user'|'assistant', content: string}
 *   maxTokens       — default 1024 (sufficient for chat answers; bumps to 2048 for first turn)
 *
 * Returns:
 *   { response: Response, captureBody: () => Promise<string> }
 *     - response: stream back to client
 *     - captureBody: helper to read the full text for logging (after stream finishes)
 *
 * NOTE: We use a TransformStream "tee" so the stream can be consumed twice:
 *   once to forward to the client, once to capture for logging.
 */
export async function callClaudeStreaming(env, systemPrompt, messages, maxTokens = 1024) {
  const apiRes = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  });

  if (!apiRes.ok) {
    const errBody = await apiRes.text();
    throw new Error(`Anthropic API error ${apiRes.status}: ${errBody}`);
  }

  // Tee the body so we can both stream-forward and capture for logging
  const [streamA, streamB] = apiRes.body.tee();

  // Build a Response with one branch for the client
  const clientResponse = new Response(streamA, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'x-accel-buffering': 'no',
    },
  });

  // The other branch is for log capture — return a closure that drains it
  const captureBody = async () => {
    const reader = streamB.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      // SSE events arrive as "data: {...json...}\n\n"
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data) continue;
        try {
          const event = JSON.parse(data);
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            fullText += event.delta.text || '';
          }
          if (event.type === 'message_start') {
            inputTokens = event.message?.usage?.input_tokens || 0;
          }
          if (event.type === 'message_delta' && event.usage) {
            outputTokens = event.usage.output_tokens || outputTokens;
          }
        } catch (_) {
          // Ignore non-JSON SSE lines (e.g. "event: ...")
        }
      }
    }

    return { fullText, inputTokens, outputTokens };
  };

  return { response: clientResponse, captureBody };
}
