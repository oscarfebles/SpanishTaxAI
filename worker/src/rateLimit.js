/**
 * Rate limiting using Cloudflare KV.
 *
 * Strategy: simple counter per IP, expires after 60 seconds.
 * Each request increments the counter; if it exceeds RATE_LIMIT_PER_MIN,
 * the request is rejected with HTTP 429.
 *
 * This is "leaky bucket" style — not the most sophisticated, but more than
 * enough for protecting an info chatbot against scripted abuse.
 */

export async function checkRateLimit(env, ip) {
  const limit = parseInt(env.RATE_LIMIT_PER_MIN || '10', 10);
  const key = `ratelimit:${ip}`;

  // Read current count
  const current = await env.RATE_LIMIT.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= limit) {
    return {
      allowed: false,
      count,
      limit,
      retryAfter: 60,
    };
  }

  // Increment with 60s TTL (KV TTLs reset to the original expiration on overwrite,
  // so the "window" effectively starts from the first request in the minute)
  await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 60 });

  return {
    allowed: true,
    count: count + 1,
    limit,
  };
}
