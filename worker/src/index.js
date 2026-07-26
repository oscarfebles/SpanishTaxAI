/**
 * SpanishTax AI Worker — entry point.
 *
 * Routes:
 *   POST /chat            → main chatbot endpoint (streaming response)
 *   POST /stripe-webhook  → Stripe webhook handler (checkout + subscription events)
 *   GET  /health          → simple liveness check
 *   *                     → 404
 *
 * CORS is applied to all responses based on the ALLOWED_ORIGINS env var.
 * Stripe webhooks don't need CORS (server-to-server) but it doesn't hurt.
 */

import { handleChat } from './chat.js';
import { handleStripeWebhook } from './stripe-webhook.js';
import { handleIntakeForm } from './intake-form.js';
import { handleLeadCapture } from './lead-capture.js';
import { handleNurtureCron } from './nurture.js';
import { handleDeadlineReminders } from './deadline-reminders.js';
import { handleModelo130 } from './modelo130.js';
import { handleModelo303 } from './modelo303.js';
import { handleModelo036 } from './modelo036.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';

    // ─── CORS preflight ────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return handleCors(origin, env);
    }

    // ─── Routing ───────────────────────────────────────────────────────
  
    let response;
    try {
      // Modelo 130 routes (/api/modelo130/*)
      const m130 = await handleModelo130(request, env);
      if (m130) {
        response = m130;
      }

      // Modelo 303 routes (/api/modelo303/*)
      if (!response) {
        const m303 = await handleModelo303(request, env);
        if (m303) {
          response = m303;
        }
      }
      
      // Modelo 036 routes (/api/modelo036/*)  ← NUEVO
      if (!response) {
        const m036 = await handleModelo036(request, env);
        if (m036) {
          response = m036;
        }
      }


      // All other routes
      if (!response) {
        if (url.pathname === '/chat' && request.method === 'POST') {
          response = await handleChat(request, env, ctx);
        } else if (url.pathname === '/stripe-webhook' && request.method === 'POST') {
          response = await handleStripeWebhook(request, env);
        } else if (url.pathname === '/intake-form' && request.method === 'POST') {
          response = await handleIntakeForm(request, env);
        } else if (url.pathname === '/lead-capture' && request.method === 'POST') {
          response = await handleLeadCapture(request, env);
        } else if (url.pathname === '/health' && request.method === 'GET') {
          response = new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
            headers: { 'content-type': 'application/json' },
          });
        } else {
          response = new Response(JSON.stringify({ error: { code: 'not_found', message: 'Route not found.' } }), {
            status: 404,
            headers: { 'content-type': 'application/json' },
          });
        }
      }
    } catch (err) {
      console.error('Unhandled error:', err);
      response = new Response(
        JSON.stringify({ error: { code: 'internal_error', message: 'An unexpected error occurred.' } }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      );
    }

    // ─── Apply CORS headers to actual response ──────────────────────────
    return applyCors(response, origin, env);
  },

  // ─── Cron Trigger: nurture sequence ────────────────────────────────────
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleNurtureCron(env));
  },
};

// ─── CORS helpers ─────────────────────────────────────────────────────────

function getAllowedOrigins(env) {
  const raw = env.ALLOWED_ORIGINS || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function isOriginAllowed(origin, env) {
  const allowed = getAllowedOrigins(env);
  return allowed.includes(origin);
}

function handleCors(origin, env) {
  if (!isOriginAllowed(origin, env)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'POST, GET, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-max-age': '86400',
    },
  });
}

function applyCors(response, origin, env) {
  // Don't add CORS headers if origin not allowed (still return the response,
  // but browser won't be able to read it — same-origin requests are fine)
  if (!origin || !isOriginAllowed(origin, env)) {
    return response;
  }

  // Streaming responses have a locked body — clone headers instead of reading body
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin);
  headers.set('vary', 'origin');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

