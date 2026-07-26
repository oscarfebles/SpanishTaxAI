/**
 * Lead Capture Endpoint — /lead-capture
 * Receives email from free-guide.html form, saves to lead_subscribers table.
 */

export async function handleLeadCapture(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  var body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  var email = (body.email || '').toLowerCase().trim();
  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid email' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    var res = await fetch(env.SUPABASE_URL + '/rest/v1/lead_subscribers', {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        email: email,
        situation: body.situation || null,
        source: body.source || 'free_guide',
        user_agent: body.user_agent || null,
      }),
    });

    if (!res.ok) {
      var errText = await res.text();
      console.error('Lead capture Supabase error (' + res.status + '):', errText);
    } else {
      console.log('Lead captured:', email);
    }
  } catch (err) {
    console.error('Lead capture failed:', err);
  }

  // Send guide email via Resend
  if (env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + env.RESEND_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'SpanishTax AI <support@spanishtaxai.com>',
          to: email,
          reply_to: 'support@spanishtaxai.com',
          subject: 'Your free Spain DNV Checklist 2026',
          html: '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:#FAF8F4;font-family:Georgia,serif;"><div style="max-width:560px;margin:0 auto;padding:40px 24px;"><div style="text-align:center;margin-bottom:28px;font-size:20px;font-weight:600;color:#0F2547;">SpanishTax AI</div><div style="background:white;border-radius:12px;padding:32px;border:1px solid #E8E4DC;"><h1 style="font-size:22px;color:#0F2547;margin:0 0 12px;">Your DNV Checklist is ready</h1><p style="font-size:15px;color:#5D5D5D;line-height:1.6;margin:0 0 24px;">Here\'s the free guide you requested — everything you need to prepare your Spanish Digital Nomad Visa application in 2026.</p><div style="text-align:center;margin:24px 0;"><a href="https://spanishtaxai.com/lead-magnet/spain-dnv-checklist-2026.html" style="display:inline-block;background:#C8553D;color:white;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">Open the guide →</a></div><p style="font-size:14px;color:#5D5D5D;line-height:1.6;margin:24px 0 0;">Over the next few days, we\'ll send you a short series of practical tips based on your situation — income proof strategies, common mistakes, and deadline reminders.</p></div><div style="text-align:center;margin-top:24px;font-size:12px;color:#999;"><p>SpanishTax AI · Madrid</p><p><a href="https://spanishtaxai.com/privacy.html" style="color:#999;">Privacy</a> · <a href="https://spanishtaxai.com/terms.html" style="color:#999;">Terms</a></p></div></div></body></html>',
        }),
      });
      console.log('Guide email sent to:', email);
    } catch (emailErr) {
      console.error('Guide email failed:', emailErr);
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

