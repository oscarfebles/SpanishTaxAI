/**
 * Nurture Sequence Cron — v1.0
 * Runs daily via Cloudflare Cron Trigger.
 * Checks lead_subscribers for leads due their next email, sends via Resend.
 *
 * Schedule:
 *   Email 1 (day 0): sent at capture time by lead-capture.js — NOT here
 *   Email 2 (day 3): nurture_stage 0 → 1
 *   Email 3 (day 6): nurture_stage 1 → 2
 *   Email 4 (day 10): nurture_stage 2 → 3
 *   Email 5 (day 14): nurture_stage 3 → 4 (done)
 */

var NURTURE_SCHEDULE = [
  { stage: 0, days_after_signup: 3 },
  { stage: 1, days_after_signup: 6 },
  { stage: 2, days_after_signup: 10 },
  { stage: 3, days_after_signup: 14 },
];

var EMAILS = {
  1: {
    subject: 'The 3 mistakes that cost DNV applicants €2,000+',
    html: function() { return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:#FAF8F4;font-family:Georgia,serif;"><div style="max-width:560px;margin:0 auto;padding:40px 24px;"><div style="text-align:center;margin-bottom:24px;font-size:18px;font-weight:600;color:#0F2547;">SpanishTax AI</div><div style="background:white;border-radius:12px;padding:32px;border:1px solid #E8E4DC;"><h1 style="font-size:20px;color:#0F2547;margin:0 0 16px;">The 3 mistakes that cost DNV applicants €2,000+</h1><p style="font-size:14px;color:#5D5D5D;line-height:1.7;margin:0 0 16px;">We review dozens of DNV applications every quarter. These three mistakes come up again and again — and they\'re all avoidable.</p><p style="font-size:14px;color:#1E3358;line-height:1.7;margin:0 0 12px;"><strong>Mistake #1: Missing the Tarifa Plana window</strong><br>If you register as autónomo more than 60 days before your activity starts (RD 84/1996), you lose the €88.64/month subsidized rate for your first year. Most people register too early out of enthusiasm. Cost: ~€2,400/year in extra social security.</p><p style="font-size:14px;color:#1E3358;line-height:1.7;margin:0 0 12px;"><strong>Mistake #2: Using travel insurance instead of proper health coverage</strong><br>UGE-CE requires 100% coverage, no copays, no waiting periods, minimum 1 year. Travel insurance fails on all three. Rejection rate for travel insurance applications: nearly 100%.</p><p style="font-size:14px;color:#1E3358;line-height:1.7;margin:0 0 16px;"><strong>Mistake #3: Missing the Beckham Law 6-month deadline</strong><br>Modelo 149 must be filed within 6 months of your Seguridad Social registration. Miss it and you\'re locked into ordinary IRPF for your entire stay — potentially paying 45% instead of 24% on income above €60k.</p><div style="background:#FBF6EE;border-left:3px solid #C8553D;padding:14px 18px;border-radius:0 8px 8px 0;margin:20px 0;"><p style="margin:0;font-size:14px;color:#1E3358;">Our <a href="https://spanishtaxai.com/templates/" style="color:#C8553D;font-weight:600;">template library</a> has pre-built documents that prevent all three mistakes — including the Tarifa Plana timing guide and Beckham election checklist.</p></div></div><div style="text-align:center;margin-top:20px;font-size:11px;color:#999;"><p><a href="https://spanishtaxai.com" style="color:#999;">spanishtaxai.com</a> · <a href="https://spanishtaxai.com/privacy.html" style="color:#999;">Unsubscribe</a></p></div></div></body></html>'; },
  },
  2: {
    subject: 'Income proof: what UGE-CE actually accepts (and rejects)',
    html: function() { return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:#FAF8F4;font-family:Georgia,serif;"><div style="max-width:560px;margin:0 auto;padding:40px 24px;"><div style="text-align:center;margin-bottom:24px;font-size:18px;font-weight:600;color:#0F2547;">SpanishTax AI</div><div style="background:white;border-radius:12px;padding:32px;border:1px solid #E8E4DC;"><h1 style="font-size:20px;color:#0F2547;margin:0 0 16px;">Income proof: what actually works</h1><p style="font-size:14px;color:#5D5D5D;line-height:1.7;margin:0 0 16px;">The #1 reason for subsanaciones (correction requests) is insufficient income proof. Here\'s what UGE-CE needs to see:</p><p style="font-size:14px;color:#1E3358;line-height:1.7;margin:0 0 12px;"><strong>The threshold:</strong> €2,849/month for 2026 (200% of Spain\'s minimum wage). This is tested monthly — an annual average won\'t cut it.</p><p style="font-size:14px;color:#1E3358;line-height:1.7;margin:0 0 12px;"><strong>What works:</strong> CPA/accountant letter on firm letterhead (apostilled + sworn translated), 6 months of bank statements showing recurring deposits, active contracts, and recent invoices.</p><p style="font-size:14px;color:#1E3358;line-height:1.7;margin:0 0 12px;"><strong>What doesn\'t work:</strong> Self-printed PDFs from online banks without stamps or signatures, screenshots, statements with only a logo, or a single annual tax return without monthly breakdown.</p><p style="font-size:14px;color:#1E3358;line-height:1.7;margin:0 0 16px;"><strong>Online bank workaround:</strong> If you use Wise, Revolut, or Mercury, request an official account confirmation letter from their support team. If that fails, a Spanish notary can certify your statements via an acta de presencia (~€60-100).</p><div style="text-align:center;margin:20px 0;"><a href="https://spanishtaxai.com/templates/" style="display:inline-block;background:#C8553D;color:white;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Get CPA letter templates →</a></div></div><div style="text-align:center;margin-top:20px;font-size:11px;color:#999;"><p><a href="https://spanishtaxai.com" style="color:#999;">spanishtaxai.com</a> · <a href="https://spanishtaxai.com/privacy.html" style="color:#999;">Unsubscribe</a></p></div></div></body></html>'; },
  },
  3: {
    subject: 'Beckham Law: when it helps and when it hurts',
    html: function() { return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:#FAF8F4;font-family:Georgia,serif;"><div style="max-width:560px;margin:0 auto;padding:40px 24px;"><div style="text-align:center;margin-bottom:24px;font-size:18px;font-weight:600;color:#0F2547;">SpanishTax AI</div><div style="background:white;border-radius:12px;padding:32px;border:1px solid #E8E4DC;"><h1 style="font-size:20px;color:#0F2547;margin:0 0 16px;">Beckham Law: the decision that locks in for 6 years</h1><p style="font-size:14px;color:#5D5D5D;line-height:1.7;margin:0 0 16px;">The Beckham Law (Art. 93 LIRPF) lets new Spanish residents pay a flat 24% on employment income up to €600k, instead of progressive rates up to 47%. Sounds great — but it\'s not always the right choice.</p><p style="font-size:14px;color:#1E3358;line-height:1.7;margin:0 0 12px;"><strong>When it helps:</strong> You earn €60k+ from a foreign employer or as a remote worker. At €100k, Beckham saves you roughly €8,000-12,000/year vs ordinary IRPF. Foreign dividends and capital gains are also exempt from Spanish tax.</p><p style="font-size:14px;color:#1E3358;line-height:1.7;margin:0 0 12px;"><strong>When it hurts:</strong> You\'re self-employed with lower income. Beckham charges 24% from euro one — no personal allowance, no deductions. Under ordinary IRPF, your first ~€12,500 is effectively tax-free. Below ~€45k income, ordinary IRPF may be cheaper.</p><p style="font-size:14px;color:#1E3358;line-height:1.7;margin:0 0 16px;"><strong>The catch:</strong> Once elected, it\'s irreversible for 6 years. No going back. And the Modelo 149 election must be filed within 6 months of your Seguridad Social registration. Miss the deadline = locked into ordinary IRPF permanently.</p><div style="background:#FBF6EE;border-left:3px solid #C8553D;padding:14px 18px;border-radius:0 8px 8px 0;margin:20px 0;"><p style="margin:0;font-size:14px;color:#1E3358;">Not sure which is better for your situation? Our <a href="https://spanishtaxai.com/" style="color:#C8553D;font-weight:600;">AI assistant</a> can walk you through the comparison — or email us at <a href="mailto:support@spanishtaxai.com" style="color:#C8553D;">support@spanishtaxai.com</a> for a personalized analysis.</p></div></div><div style="text-align:center;margin-top:20px;font-size:11px;color:#999;"><p><a href="https://spanishtaxai.com" style="color:#999;">spanishtaxai.com</a> · <a href="https://spanishtaxai.com/privacy.html" style="color:#999;">Unsubscribe</a></p></div></div></body></html>'; },
  },
  4: {
    subject: 'Your personalized DNV roadmap starts here',
    html: function() { return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:#FAF8F4;font-family:Georgia,serif;"><div style="max-width:560px;margin:0 auto;padding:40px 24px;"><div style="text-align:center;margin-bottom:24px;font-size:18px;font-weight:600;color:#0F2547;">SpanishTax AI</div><div style="background:white;border-radius:12px;padding:32px;border:1px solid #E8E4DC;"><h1 style="font-size:20px;color:#0F2547;margin:0 0 16px;">Ready to move forward?</h1><p style="font-size:14px;color:#5D5D5D;line-height:1.7;margin:0 0 16px;">Over the past two weeks, we\'ve covered the most critical aspects of the Spanish DNV: documentation, income proof, Beckham Law, and the mistakes that cost applicants thousands.</p><p style="font-size:14px;color:#5D5D5D;line-height:1.7;margin:0 0 16px;">If you\'re serious about applying, here are the two fastest ways to get everything right:</p><div style="background:white;border:1px solid #E8E4DC;border-radius:10px;padding:20px;margin:16px 0;"><p style="font-size:16px;color:#0F2547;font-weight:600;margin:0 0 6px;">DNV Application Pack — €199</p><p style="font-size:13px;color:#5D5D5D;line-height:1.6;margin:0 0 12px;">19 templates (CPA letters, subsanación responses, employer letters), full document checklist, and extended AI chatbot access. Everything you need to self-serve your application.</p><a href="https://buy.stripe.com/28EcN51KZdtialN88Wbwk05" style="display:inline-block;background:#C8553D;color:white;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Get the Pack →</a></div><div style="background:white;border:2px solid #C8553D;border-radius:10px;padding:20px;margin:16px 0;"><p style="font-size:16px;color:#0F2547;font-weight:600;margin:0 0 6px;">DNV Pro Audit — €499</p><p style="font-size:13px;color:#5D5D5D;line-height:1.6;margin:0 0 12px;">A Spanish auditor reviews your complete application package and delivers a detailed audit by email within 48 hours. Every document checked, every gap flagged, every risk identified — before you submit to UGE-CE.</p><a href="https://buy.stripe.com/7sYfZhfBP4WMeC3ah4bwk04" style="display:inline-block;background:#C8553D;color:white;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Get the Audit →</a></div><p style="font-size:14px;color:#5D5D5D;line-height:1.7;margin:16px 0 0;">Either way, the free <a href="https://spanishtaxai.com/" style="color:#C8553D;">AI chatbot</a> is always available for quick questions. This is the last email in the series — we won\'t email again unless you sign up for a plan.</p></div><div style="text-align:center;margin-top:20px;font-size:11px;color:#999;"><p><a href="https://spanishtaxai.com" style="color:#999;">spanishtaxai.com</a> · <a href="https://spanishtaxai.com/privacy.html" style="color:#999;">Unsubscribe</a></p></div></div></body></html>'; },
  },
};

export async function handleNurtureCron(env) {
  console.log('Nurture cron started');

  if (!env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping nurture');
    return;
  }

  var now = new Date();
  var sent = 0;

  for (var i = 0; i < NURTURE_SCHEDULE.length; i++) {
    var step = NURTURE_SCHEDULE[i];
    var cutoffDate = new Date(now.getTime() - (step.days_after_signup * 24 * 60 * 60 * 1000));

    // Find leads at this stage whose signup is old enough for the next email
    try {
      var res = await fetch(
        env.SUPABASE_URL + '/rest/v1/lead_subscribers?nurture_stage=eq.' + step.stage +
        '&unsubscribed=eq.false&created_at=lte.' + cutoffDate.toISOString() +
        '&select=id,email&limit=50',
        {
          headers: {
            'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
          },
        }
      );

      if (!res.ok) {
        console.error('Nurture query failed for stage ' + step.stage + ':', await res.text());
        continue;
      }

      var leads = await res.json();
      if (leads.length === 0) continue;

      var emailNum = step.stage + 1;
      var emailTemplate = EMAILS[emailNum];
      if (!emailTemplate) continue;

      for (var j = 0; j < leads.length; j++) {
        var lead = leads[j];
        try {
          // Send email
          var sendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + env.RESEND_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'SpanishTax AI <support@spanishtaxai.com>',
              to: lead.email,
              reply_to: 'support@spanishtaxai.com',
              subject: emailTemplate.subject,
              html: emailTemplate.html(),
            }),
          });

          if (sendRes.ok) {
            // Update nurture_stage
            await fetch(
              env.SUPABASE_URL + '/rest/v1/lead_subscribers?id=eq.' + lead.id,
              {
                method: 'PATCH',
                headers: {
                  'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
                  'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal',
                },
                body: JSON.stringify({ nurture_stage: step.stage + 1 }),
              }
            );
            sent++;
            console.log('Nurture email ' + emailNum + ' sent to ' + lead.email);
          } else {
            console.error('Resend failed for ' + lead.email + ':', await sendRes.text());
          }
        } catch (err) {
          console.error('Nurture send error for ' + lead.email + ':', err);
        }
      }
    } catch (err) {
      console.error('Nurture stage ' + step.stage + ' error:', err);
    }
  }

  console.log('Nurture cron done. Emails sent: ' + sent);
}

