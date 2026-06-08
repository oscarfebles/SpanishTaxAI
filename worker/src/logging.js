/**
 * Conversation logging.
 *
 * Inserts one row per turn into the conversation_logs table.
 * Fire-and-forget: errors are caught and logged via console.error
 * but never block the response to the user.
 */

export async function logTurn(env, log) {
  try {
    const url = `${env.SUPABASE_URL}/rest/v1/conversation_logs`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(log),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Logging failed (${res.status}):`, errBody);
    }
  } catch (err) {
    console.error('Logging exception:', err);
  }
}

/**
 * Counts how many turns a session_id already has.
 * Used to enforce SOFT_TURN_LIMIT and HARD_TURN_LIMIT.
 *
 * NOTE: This adds one round-trip to Supabase per chat request. For higher
 * traffic, consider passing turn_number from the client (it tracks history
 * in localStorage). Trust-but-verify pattern: client sends turn_number,
 * server clamps to actual count if mismatched.
 */
export async function countSessionTurns(env, sessionId) {
  try {
    const url = `${env.SUPABASE_URL}/rest/v1/conversation_logs?session_id=eq.${encodeURIComponent(sessionId)}&select=id`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'count=exact',
      },
    });

    // The count is in the Content-Range header: "0-19/20"
    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      const match = contentRange.match(/\/(\d+)$/);
      if (match) return parseInt(match[1], 10);
    }
    return 0;
  } catch (err) {
    console.error('countSessionTurns error:', err);
    return 0; // Fail-open: don't block users due to a count failure
  }
}

/**
 * Returns whether this session has already captured an email,
 * to avoid asking again.
 */
export async function hasEmailCaptured(env, sessionId) {
  try {
    const url = `${env.SUPABASE_URL}/rest/v1/conversation_logs?session_id=eq.${encodeURIComponent(sessionId)}&email_captured=not.is.null&select=email_captured&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.error('hasEmailCaptured error:', err);
    return false;
  }
}
