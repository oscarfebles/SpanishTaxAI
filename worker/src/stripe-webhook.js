/**
 * Stripe Webhook Handler — v1.0
 * ════════════════════════════════════════════════════════════════════
 * Handles:
 *   - checkout.session.completed → create/update customer in Supabase
 *   - customer.subscription.deleted → mark customer as cancelled
 *
 * Stripe signature is verified using Web Crypto API (no npm dependency).
 *
 * Price ID → Tier mapping (live mode):
 *   price_1TfmX4GAV7Mbkv7Ld1gk3W6R → €199  DNV Application Pack
 *   price_1TfmXXGAV7Mbkv7LWwxxKN7P → €499  DNV Pro Audit
 *   price_1Tfma4GAV7Mbkv7LzjTcrzZQ → €14.50 Spanish Resident Pro (founding)
 *   price_1TfmZ6GAV7Mbkv7LAV0Rhb4K → €29.00 Spanish Resident Pro (standard)
 *   price_1TfmbYGAV7Mbkv7LQuJfmvgH → €49.50 Premium Concierge (founding)
 *   price_1TfmadGAV7Mbkv7LyEzvKvYf → €99.00 Premium Concierge (standard)
 */

// ─── Price → Tier mapping ────────────────────────────────────────────────────

const PRICE_TO_TIER = {
  // One-time products
  'price_1TfmX4GAV7Mbkv7Ld1gk3W6R': { tier: 'dnv_pack',  type: 'one_time', access_days: 60,  label: 'DNV Application Pack' },
  'price_1TfmXXGAV7Mbkv7LWwxxKN7P': { tier: 'dnv_audit', type: 'one_time', access_days: 90,  label: 'DNV Pro Audit' },

  // Recurring — Spanish Resident Pro
  'price_1Tfma4GAV7Mbkv7LzjTcrzZQ': { tier: 'pro', type: 'recurring', access_days: null, label: 'Spanish Resident Pro (founding)' },
  'price_1TfmZ6GAV7Mbkv7LAV0Rhb4K': { tier: 'pro', type: 'recurring', access_days: null, label: 'Spanish Resident Pro' },

  // Recurring — Premium Concierge
  'price_1TfmbYGAV7Mbkv7LQuJfmvgH': { tier: 'premium', type: 'recurring', access_days: null, label: 'Premium Concierge (founding)' },
  'price_1TfmadGAV7Mbkv7LyEzvKvYf': { tier: 'premium', type: 'recurring', access_days: null, label: 'Premium Concierge' },
};

// ─── Stripe signature verification (Web Crypto API) ──────────────────────────

async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader) return false;

  // Parse the Stripe-Signature header: t=timestamp,v1=signature
  const parts = {};
  for (const item of sigHeader.split(',')) {
    const [key, value] = item.split('=');
    parts[key.trim()] = value.trim();
  }

  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature) return false;

  // Reject if timestamp is older than 5 minutes (replay protection)
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (age > 300) return false;

  // Compute expected signature: HMAC-SHA256(secret, "timestamp.payload")
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signedPayload = `${timestamp}.${payload}`;
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));

  // Convert to hex string
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison (basic)
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

async function upsertCustomer(env, customerData) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/customers`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(customerData),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase upsert failed (${res.status}): ${errText}`);
  }

  return res;
}

async function updateCustomerByStripeId(env, stripeCustomerId, updates) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/customers?stripe_customer_id=eq.${encodeURIComponent(stripeCustomerId)}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(updates),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase update failed (${res.status}): ${errText}`);
  }

  return res;
}

// ─── Event handlers ──────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session, env) {
  const email = session.customer_details?.email || session.customer_email;
  if (!email) {
    console.error('checkout.session.completed: no email found in session', session.id);
    return;
  }

  // Extract price_id from line_items (Stripe Payment Links include this)
  // For Payment Links, the price is in session.line_items or we use metadata
  let priceId = null;
  let amountPaid = session.amount_total; // in cents

  // Try to get price_id from the session metadata or line items
  // Payment Links put it in line_items which requires expansion,
  // but the webhook payload includes it if we expand correctly.
  // Fallback: use amount to identify the product
  if (session.metadata?.price_id) {
    priceId = session.metadata.price_id;
  }

  // If no price_id in metadata, try to identify from amount
  if (!priceId) {
    const amountMap = {
      19900: 'price_1TfmX4GAV7Mbkv7Ld1gk3W6R',  // €199
      49900: 'price_1TfmXXGAV7Mbkv7LWwxxKN7P',  // €499
      1450:  'price_1Tfma4GAV7Mbkv7LzjTcrzZQ',   // €14.50
      2900:  'price_1TfmZ6GAV7Mbkv7LAV0Rhb4K',   // €29.00
      4950:  'price_1TfmbYGAV7Mbkv7LQuJfmvgH',   // €49.50
      9900:  'price_1TfmadGAV7Mbkv7LyEzvKvYf',   // €99.00
    };
    priceId = amountMap[amountPaid] || null;
  }

  const tierInfo = priceId ? PRICE_TO_TIER[priceId] : null;

  if (!tierInfo) {
    console.error(`checkout.session.completed: unknown price_id ${priceId}, amount ${amountPaid}`, session.id);
    // Still create the customer with 'unknown' tier — better than losing the data
  }

  const tier = tierInfo?.tier || 'unknown';
  const accessDays = tierInfo?.access_days || null;

  // Calculate access expiry for one-time products
  let accessExpiresAt = null;
  if (accessDays) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + accessDays);
    accessExpiresAt = expiry.toISOString();
  }

  const customerData = {
    email: email.toLowerCase().trim(),
    stripe_customer_id: session.customer || null,
    stripe_subscription_id: session.subscription || null,
    tier,
    status: 'active',
    price_id: priceId,
    amount_paid: amountPaid,
    currency: session.currency || 'eur',
    access_expires_at: accessExpiresAt,
  };

  console.log(`Creating/updating customer: ${email}, tier: ${tier}, price: ${priceId}`);
  await upsertCustomer(env, customerData);
  console.log(`Customer upserted successfully: ${email}`);

  // Send welcome email via Resend
  try {
    await sendWelcomeEmail(env, email, tierInfo);
    console.log(`Welcome email sent to ${email}`);
  } catch (emailErr) {
    console.error(`Welcome email failed for ${email}:`, emailErr);
    // Don't fail the webhook — customer is created, email is best-effort
  }
}

async function handleSubscriptionDeleted(subscription, env) {
  const stripeCustomerId = subscription.customer;
  if (!stripeCustomerId) {
    console.error('subscription.deleted: no customer ID', subscription.id);
    return;
  }

  console.log(`Subscription cancelled: ${stripeCustomerId}, sub: ${subscription.id}`);

  await updateCustomerByStripeId(env, stripeCustomerId, {
    status: 'cancelled',
    stripe_subscription_id: null,
    // Access continues until end of billing period (Stripe handles this)
    // We mark cancelled but don't revoke immediately
  });

  console.log(`Customer marked as cancelled: ${stripeCustomerId}`);
}

// ─── Welcome email via Resend ────────────────────────────────────────────────

async function sendWelcomeEmail(env, email, tierInfo) {
  if (!env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping welcome email');
    return;
  }

  const tierName = tierInfo?.label || 'SpanishTax AI';
  const tier = tierInfo?.tier || 'unknown';

  // Tier-specific next steps
  const nextSteps = {
    dnv_pack: `
      <li><strong>Access your templates</strong> at <a href="https://spanishtaxai.com/templates/">spanishtaxai.com/templates</a> — CPA letters, subsanación responses, apostille guides, and more.</li>
      <li><strong>Use the chatbot</strong> at <a href="https://spanishtaxai.com">spanishtaxai.com</a> with extended access (50 messages over 60 days).</li>
      <li><strong>Download the free guide</strong> if you haven't: <a href="https://spanishtaxai.com/free-guide.html">Spain DNV Checklist 2026</a>.</li>
    `,
    dnv_audit: `
      <li><strong>Reply to this email</strong> with your complete application package (CPA letter, bank statements, contracts, covering letter, criminal record certificate, health insurance policy).</li>
      <li>Oscar will review your package and send you a detailed audit within <strong>48 hours</strong>.</li>
      <li>You'll also get access to all templates at <a href="https://spanishtaxai.com/templates/">spanishtaxai.com/templates</a> and extended chatbot access (100 messages over 90 days).</li>
    `,
    pro: `
      <li><strong>Use the chatbot</strong> at <a href="https://spanishtaxai.com">spanishtaxai.com</a> with priority access (200 messages/month).</li>
      <li><strong>Access all templates</strong> at <a href="https://spanishtaxai.com/templates/">spanishtaxai.com/templates</a>.</li>
      <li>Oscar will send you <strong>deadline reminders</strong> for Modelo 130, 303, 720, and other filings as they approach.</li>
      <li><strong>Email Oscar anytime</strong> at support@spanishtaxai.com — response within 48h.</li>
    `,
    premium: `
      <li><strong>Priority email support</strong> — Oscar responds within 24h at support@spanishtaxai.com.</li>
      <li><strong>WhatsApp/Telegram access</strong> — reply to this email with your preferred number and Oscar will add you.</li>
      <li><strong>Quarterly filing review</strong> — Oscar reviews your Modelo 130/303 before submission each quarter.</li>
      <li><strong>All templates + unlimited chatbot</strong> at <a href="https://spanishtaxai.com">spanishtaxai.com</a>.</li>
      <li>Beckham Law evaluation included — reply with your income breakdown and Oscar will model both scenarios.</li>
    `,
  };

  const steps = nextSteps[tier] || nextSteps['dnv_pack'];

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#FAF8F4;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:580px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:20px;font-weight:600;color:#0F2547;">SpanishTax AI</span>
    </div>
    <div style="background:white;border-radius:12px;padding:36px 32px;border:1px solid #E8E4DC;">
      <h1 style="font-size:24px;color:#0F2547;margin:0 0 8px;font-weight:600;">Welcome aboard</h1>
      <p style="color:#5D5D5D;font-size:15px;margin:0 0 24px;line-height:1.5;">
        Your purchase of <strong style="color:#0F2547;">${tierName}</strong> is confirmed. Here's what happens next.
      </p>
      <h2 style="font-size:17px;color:#0F2547;margin:24px 0 12px;font-weight:600;">Next steps:</h2>
      <ol style="color:#1E3358;font-size:14px;line-height:1.7;padding-left:20px;margin:0 0 24px;">
        ${steps}
      </ol>
      <div style="background:#FBF6EE;border-left:3px solid #C8553D;padding:14px 18px;border-radius:0 8px 8px 0;margin:24px 0;">
        <p style="margin:0;font-size:14px;color:#1E3358;line-height:1.5;">
          <strong>Questions?</strong> Reply to this email or write to
          <a href="mailto:support@spanishtaxai.com" style="color:#C8553D;">support@spanishtaxai.com</a>.
          Oscar responds personally within 24-48h. No phone calls, no bots — just a real auditor reading your email.
        </p>
      </div>
    </div>
    <div style="text-align:center;margin-top:24px;font-size:12px;color:#999;">
      <p>SpanishTax AI · Built in Madrid by Oscar Gonzalez Febles</p>
      <p><a href="https://spanishtaxai.com/terms.html" style="color:#999;">Terms</a> ·
         <a href="https://spanishtaxai.com/privacy.html" style="color:#999;">Privacy</a> ·
         <a href="https://spanishtaxai.com/refund.html" style="color:#999;">Refunds</a></p>
    </div>
  </div>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Oscar from SpanishTax AI <support@spanishtaxai.com>',
      to: email,
      reply_to: 'support@spanishtaxai.com',
      subject: `Welcome to SpanishTax AI — ${tierName}`,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API error (${res.status}): ${errText}`);
  }
}

// ─── Main webhook handler (exported) ─────────────────────────────────────────

export async function handleStripeWebhook(request, env) {
  // Only accept POST
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Read raw body for signature verification
  const rawBody = await request.text();
  const sigHeader = request.headers.get('stripe-signature');

  // Verify signature
  const isValid = await verifyStripeSignature(rawBody, sigHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    console.error('Stripe webhook: invalid signature');
    return new Response('Invalid signature', { status: 401 });
  }

  // Parse event
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error('Stripe webhook: invalid JSON', err);
    return new Response('Invalid payload', { status: 400 });
  }

  console.log(`Stripe webhook received: ${event.type}, id: ${event.id}`);

  // Route by event type
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object, env);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, env);
        break;

      default:
        console.log(`Stripe webhook: unhandled event type ${event.type}`);
    }
  } catch (err) {
    console.error(`Stripe webhook handler error (${event.type}):`, err);
    // Return 200 anyway — Stripe retries on 5xx, and we don't want infinite retries
    // for bugs in our handler. Log the error and investigate.
    return new Response(JSON.stringify({ received: true, error: err.message }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Always return 200 to Stripe
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
