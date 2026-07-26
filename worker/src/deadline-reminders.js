/**
 * Deadline Email Reminders — v1.0
 * Runs in the same daily cron as nurture.
 * Checks customers with paid tiers for upcoming deadlines (14d, 7d, 1d).
 * Sends reminder emails via Resend.
 */

// Same fixed deadlines as client-side but simplified for server
var QUARTERLY_DEADLINES = [
  { id: 'mod130-q1', title: 'Modelo 130 — Q1', month: 4, day: 20 },
  { id: 'mod303-q1', title: 'Modelo 303 — Q1', month: 4, day: 20 },
  { id: 'mod130-q2', title: 'Modelo 130 — Q2', month: 7, day: 20 },
  { id: 'mod303-q2', title: 'Modelo 303 — Q2', month: 7, day: 20 },
  { id: 'mod130-q3', title: 'Modelo 130 — Q3', month: 10, day: 20 },
  { id: 'mod303-q3', title: 'Modelo 303 — Q3', month: 10, day: 20 },
  { id: 'mod130-q4', title: 'Modelo 130 — Q4', month: 1, day: 30 },
  { id: 'mod303-q4', title: 'Modelo 303 — Q4', month: 1, day: 30 },
  { id: 'mod100', title: 'Modelo 100 — Annual IRPF', month: 6, day: 30 },
  { id: 'mod720', title: 'Modelo 720 — Foreign assets', month: 3, day: 31 },
];

var REMINDER_DAYS = [14, 7, 1];

function getUpcomingDeadlines() {
  var now = new Date();
  var results = [];

  for (var i = 0; i < QUARTERLY_DEADLINES.length; i++) {
    var dl = QUARTERLY_DEADLINES[i];
    var year = now.getFullYear();
    var deadlineDate = new Date(year, dl.month - 1, dl.day);

    if (deadlineDate < now) {
      deadlineDate = new Date(year + 1, dl.month - 1, dl.day);
    }

    var diffDays = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));

    for (var j = 0; j < REMINDER_DAYS.length; j++) {
      if (diffDays === REMINDER_DAYS[j]) {
        results.push({
          id: dl.id,
          title: dl.title,
          days: diffDays,
          date: deadlineDate,
        });
      }
    }
  }

  return results;
}

function buildReminderEmail(deadline) {
  var urgency = deadline.days === 1 ? 'TOMORROW' : (deadline.days + ' days');
  var urgencyColor = deadline.days === 1 ? '#C8553D' : (deadline.days <= 7 ? '#E2A23B' : '#7A9B76');

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>' +
    '<body style="margin:0;padding:0;background:#FAF8F4;font-family:Georgia,serif;">' +
    '<div style="max-width:560px;margin:0 auto;padding:40px 24px;">' +
    '<div style="text-align:center;margin-bottom:24px;font-size:18px;font-weight:600;color:#0F2547;">SpanishTax AI</div>' +
    '<div style="background:white;border-radius:12px;padding:32px;border:1px solid #E8E4DC;">' +
    '<div style="display:inline-block;padding:4px 12px;border-radius:100px;font-size:12px;font-weight:600;color:' + urgencyColor + ';background:' + (deadline.days === 1 ? '#FBF1F0' : '#FBF1D8') + ';margin-bottom:16px;">' + urgency + '</div>' +
    '<h1 style="font-size:22px;color:#0F2547;margin:0 0 12px;">' + deadline.title + '</h1>' +
    '<p style="font-size:15px;color:#5D5D5D;line-height:1.6;margin:0 0 24px;">' +
    (deadline.days === 1
      ? 'This filing is due tomorrow. If you haven\'t submitted yet, do it today to avoid late penalties.'
      : 'This filing is due in ' + deadline.days + ' days. Make sure you have everything ready.') +
    '</p>' +
    '<div style="text-align:center;margin:24px 0;">' +
    '<a href="https://spanishtaxai.com/app.html" style="display:inline-block;background:#C8553D;color:white;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">Open your dashboard →</a>' +
    '</div>' +
    '<p style="font-size:13px;color:#5D5D5D;line-height:1.5;">Need help with this filing? Use the AI chat in your dashboard or email us at <a href="mailto:support@spanishtaxai.com" style="color:#C8553D;">support@spanishtaxai.com</a>.</p>' +
    '</div>' +
    '<div style="text-align:center;margin-top:20px;font-size:11px;color:#999;">' +
    '<p><a href="https://spanishtaxai.com" style="color:#999;">spanishtaxai.com</a></p>' +
    '</div></div></body></html>';
}

export async function handleDeadlineReminders(env) {
  console.log('Deadline reminders started');

  if (!env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping deadline reminders');
    return;
  }

  var upcoming = getUpcomingDeadlines();
  if (upcoming.length === 0) {
    console.log('No deadlines due for reminders today');
    return;
  }

  console.log('Found ' + upcoming.length + ' deadlines needing reminders');

  // Get all active paid customers
  try {
    var res = await fetch(
      env.SUPABASE_URL + '/rest/v1/customers?status=eq.active&select=email,tier,autonomo_status',
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
        },
      }
    );

    if (!res.ok) {
      console.error('Failed to fetch customers:', await res.text());
      return;
    }

    var customers = await res.json();
    var paidTiers = ['dnv_pack', 'dnv_audit', 'pro', 'premium'];
    var paidCustomers = customers.filter(function (c) {
      return paidTiers.includes(c.tier);
    });

    console.log('Sending to ' + paidCustomers.length + ' paid customers');
    var sent = 0;

    for (var i = 0; i < upcoming.length; i++) {
      var deadline = upcoming[i];

      // Only send quarterly filing reminders to autónomos
      var isQuarterlyFiling = deadline.id.startsWith('mod130') || deadline.id.startsWith('mod303');

      for (var j = 0; j < paidCustomers.length; j++) {
        var customer = paidCustomers[j];

        // Skip quarterly filings for non-autónomos
        if (isQuarterlyFiling && customer.autonomo_status !== 'yes_recent' && customer.autonomo_status !== 'yes_over_6months') {
          continue;
        }

        try {
          var sendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + env.RESEND_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'SpanishTax AI <support@spanishtaxai.com>',
              to: customer.email,
              reply_to: 'support@spanishtaxai.com',
              subject: (deadline.days === 1 ? 'TOMORROW: ' : '') + deadline.title + ' — ' + deadline.days + ' day' + (deadline.days === 1 ? '' : 's') + ' left',
              html: buildReminderEmail(deadline),
            }),
          });

          if (sendRes.ok) {
            sent++;
          } else {
            console.error('Resend failed for ' + customer.email + ':', await sendRes.text());
          }
        } catch (err) {
          console.error('Send error for ' + customer.email + ':', err);
        }
      }
    }

    console.log('Deadline reminders done. Emails sent: ' + sent);
  } catch (err) {
    console.error('Deadline reminders error:', err);
  }
}

