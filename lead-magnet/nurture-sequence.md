# Lead Magnet Nurture Sequence — SpanishTax AI

5-email sequence triggered after a user downloads the Spain DNV Checklist 2026 PDF.

**Timing:** Day 0 (immediate), Day 3, Day 7, Day 14, Day 21.

**Tone:** First-person Oscar (Spanish auditor), genuinely helpful, no aggressive selling. Each email provides real value first, soft-CTA at the end.

**Implementation notes for Resend:**
- Each email is a separate template
- Schedule via Resend's audience contacts + sequence feature, or trigger from a Cloudflare Worker cron
- Personalization variables: `{{first_name}}` (if collected — currently optional), `{{situation}}` (from form), defaults to "there"
- Sender: `oscar@spanishtaxai.com` or `support@spanishtaxai.com`
- Reply-to: same
- All include unsubscribe footer (Resend handles this automatically)

---

## Email 1 — Day 0 — Welcome + PDF delivery

**Subject:** Your Spain DNV Checklist is ready (+ a quick note)

**Preview text:** Direct link inside. Plus one thing most guides skip.

---

Hi {{first_name | default: "there"}},

Thanks for downloading the Spain DNV Checklist. Here's your guide:

**[Download the PDF guide →](https://spanishtaxai.com/lead-magnet/spain-dnv-checklist-2026.html)**

(You can also print to PDF from the browser. The format is designed to look clean as a PDF or to read directly online.)

A quick note before you dive in:

Most DNV guides skip the one thing that actually saves applicants money — **the order in which you do post-arrival paperwork**.

Specifically: if you arrive in Spain and rush to register as autónomo with Seguridad Social *before* registering with Hacienda (Modelo 036), you can lose Tarifa Plana entirely. That's €88.64/month vs. €299.56/month for the first year. €2,500+ over 12 months.

The order matters more than the timing. Modelo 036 first, then RETA. Section 11 of the guide covers this in detail (page 11).

If you have any specific questions while reading, the chatbot at [spanishtaxai.com](https://spanishtaxai.com) can answer most things with citations to current Spanish law and practice. Or just reply to this email — I read every reply personally (usually within 24-48h).

Cheers,
Oscar

Oscar Gonzalez Febles
Spanish auditor, Madrid
[spanishtaxai.com](https://spanishtaxai.com)

P.S. If your situation is one I should know about for the follow-up emails — replied with `pre_application`, `documents_phase`, etc. — I'll tailor the next emails accordingly. If you didn't reply, no worries, the standard sequence covers the main cases.

---

## Email 2 — Day 3 — Tarifa Plana mistake

**Subject:** The €2,500 mistake nobody warns Spain newcomers about

**Preview text:** It's not what you think. And it has nothing to do with rent.

---

Hi {{first_name | default: "there"}},

Three days in. Hope the guide has been useful.

Today I want to dive deeper on the most expensive mistake I see DNV holders make in their first year in Spain. It's not visa-related. It's not even tax-related, exactly. It's procedural.

**Tarifa Plana.**

If you become autónomo in Spain, the Seguridad Social (Spain's social security agency) charges you a monthly *cuota* — usually around €299.56/month for a 30-something professional. That's almost €3,600/year just to be self-employed, before any actual taxes.

But there's a discount called **Tarifa Plana**: €88.64/month for your first 12 months as autónomo. **Almost three times cheaper.** Savings: about €2,500 over the first year.

Here's where it gets tricky. Tarifa Plana isn't automatic. To get it, you have to:

1. **File Modelo 036 with Hacienda BEFORE registering with Seguridad Social.** Reversing the order disqualifies you. This is the part most articles don't mention.
2. **Register with Seguridad Social via Importass** within the legal window (the day you start activity, NOT after). Late filing = denial.
3. **Explicitly request Tarifa Plana** during the Importass registration — it's not applied automatically just because you're eligible.

I've seen people lose Tarifa Plana for missing any one of these three. Once denied, you can't appeal — you pay the full €299.56 for the first year, period.

**Practical takeaway:** if you're applying for DNV, plan your post-arrival logistics now. Section 11 of the guide (page 11) has the 30-day checklist. Don't wing it.

For the autónomo question specifically — Spanish Resident Pro (€29/month, currently €14.50/month for founding members) includes a deadline tracker that prevents this exact problem, plus auto-fill for the quarterly Modelo 130/303 filings. But honestly, even doing it manually with the right info works fine.

Reply if you want to discuss your specific timing.

Cheers,
Oscar

---

## Email 3 — Day 7 — 1099 vs S-Corp vs LLC

**Subject:** Best US tax structure for the Spain DNV?

**Preview text:** A surprisingly opinionated answer, and why most CPAs get this wrong.

---

Hi {{first_name | default: "there"}},

It's been a week. By now you've either started gathering documents, or you've put the guide aside for "later" (no judgment, both are normal).

Today's question is one I get constantly from US applicants: **"Should I restructure my business before moving to Spain?"**

The three setups I see most:

**1. Plain 1099 sole proprietor.** You file Schedule C with your 1040. No separate legal entity. Simple US tax structure.

**2. Single-member LLC.** Disregarded entity for US federal tax purposes. Schedule C, same as #1, but with state-level liability protection.

**3. S-Corporation.** You're owner-employee. Receive W-2 salary + K-1 distributions. Optimized for self-employment tax savings in the US.

For US tax optimization, #3 (S-Corp) is often the best of the three. Lower self-employment tax (Social Security + Medicare savings). It's why many CPAs push clients toward S-Corp setups.

**But Spain changes the calculation completely.**

When you become Spanish tax resident, your S-Corp or LLC becomes a "foreign company controlled by a Spanish resident." This triggers **Art. 91 LIRPF** — Spain's controlled foreign company (CFC) rules. In some cases, Spain can attribute the entity's income to you personally and tax it at Spanish IRPF rates *regardless of whether you distributed it*.

Combine this with the Beckham Law election (24% flat rate up to €600k), and the math gets complicated fast:
- A plain 1099 sole prop: Beckham math is clean. 24% on professional income.
- An LLC: pass-through to Schedule C means the LLC profits flow to you personally. Beckham may apply to them — but the CFC rules may also trigger.
- An S-Corp: W-2 salary is clean (Beckham applies). K-1 distributions are the complicated piece — they may trigger Art. 91.

**The honest take from my Spanish auditor perspective:** the answer depends on the numbers. There's no universal "best" structure. For income < €100k/year, the differences usually don't justify the legal restructuring cost. For income > €200k/year, the modeling can swing the decision by €10-30k/year in tax.

If you're at the deciding moment, **don't decide based on what your US CPA tells you alone.** They optimize for US tax, which is a different game than Spain.

DNV Pro Audit (€499) includes a full review of your business structure + Beckham Law modeling specifically for your numbers. It's exactly the kind of case where the modeling pays for itself.

Or, if you're at lower income (€30-80k W-2 from a single employer), don't overthink it — leave the structure as-is and focus on the documentation.

Cheers,
Oscar

---

## Email 4 — Day 14 — Beckham Law

**Subject:** Beckham Law — when it works, when it backfires

**Preview text:** A simple decision tree most articles get wrong.

---

Hi {{first_name | default: "there"}},

Two weeks in. By now, the DNV application is starting to feel real. You're either in documentation hell, or you're about to be.

Today's topic: **Beckham Law** — the special tax regime that's either the best thing about moving to Spain or a very expensive mistake.

**The basics:**

Beckham Law (formally Art. 93 LIRPF, named after the football player) lets eligible non-residents elect a flat 24% tax rate on employment and professional income up to €600,000 per year, instead of Spain's standard progressive IRPF rates that go up to 47%.

Sounds great, right? Save 10-23 percentage points on every euro. Why wouldn't everyone elect it?

Because **for many people, Beckham is worse than the standard regime.**

Here's a simplified decision frame:

**Beckham is usually GREAT if:**
- You earn €60k-€600k/year from a foreign employer (W-2 / nómina structure)
- You have minimal Spanish-source income
- You don't qualify for major Spanish deductions (no Spanish mortgage, no Spanish family deductions)
- You'll be in Spain for ≤ 6 years (after that, Beckham automatically expires)

**Beckham is usually WORSE if:**
- You're self-employed (autónomo) with mostly Spanish-source professional income — because Beckham taxes you 24% from euro 1, while standard IRPF gives you ~€12,500 of exemption first
- Your income is under €40k/year — standard IRPF + personal allowance beats Beckham
- You have a family and qualify for Spanish family deductions
- You earn over €600k — Beckham's 47% upper bracket kicks in at this level, which is identical to standard IRPF top rate but without standard regime's deductions

**The decision tree on page 10 of the guide handles 80% of cases.** For the other 20% — especially if you're between €100k-€600k or have mixed income types — modeling the actual numbers matters.

**Critical timing rule:** Beckham election deadline is **6 months from your alta autónomo** (or from when you become Spanish tax resident, if employee). You file Modelo 149 to elect. **Miss the window and you can't elect retroactively.** The election lasts 6 years (current year + 5).

Most DNV holders I work with elect Beckham when:
- They're high-income employees (€80k-€500k W-2) with most income from abroad
- They have no Spanish family deductions to lose
- They're certain about staying < 6 years (or fine with the regime ending)

DNV Pro Audit includes a personalized Beckham model based on your actual numbers. If you want to know whether your specific case favors it, that's the single biggest value of the audit.

Cheers,
Oscar

---

## Email 5 — Day 21 — Soft sell + how Oscar can help

**Subject:** A quick last note (and how I can actually help)

**Preview text:** Three ways to work together, all async. No phone calls — by design.

---

Hi {{first_name | default: "there"}},

This is the last email in this sequence. After this, I'll send you the occasional newsletter when there are real Spanish DNV / tax updates worth knowing about — typically once a month or less. Same easy unsubscribe.

But before that, a quick personal note on how I built this service and how I can actually help you.

**A confession:** I'm not a great salesperson. I'm a Spanish auditor by training (ex-ShineWing in Madrid), and I prefer working through hard tax problems to writing marketing copy. So the rest of this email is me being honest about what's worth paying for and what isn't.

**What I do NOT do:**
- ❌ Phone calls or video calls
- ❌ Consultations with external "partner lawyers"
- ❌ Sketchy guarantees ("DNV approval guaranteed!")
- ❌ Discounts that require urgency tactics ("only 2 spots left this week!")

Everything is async, by design. I respond by email within 24-48h. It works better for both of us — for you because there's a written record, and for me because I can focus on substance instead of scheduling calls.

**What I offer:**

**1. Free chatbot at [spanishtaxai.com](https://spanishtaxai.com)** — for specific factual questions ("What's the income threshold for 2026?", "How do I prove 1099 income to UGE-CE?"). Built on a curated knowledge base I maintain myself. Cites the relevant articles of Spanish law. Best for general research.

**2. DNV Application Pack (€199)** — the full templates, checklists, and document review tools. CPA letter templates for 1099/S-Corp/LLC. Subsanación response templates in Spanish. The complete pre-arrival roadmap. For self-serve applicants who want all the materials in one place.

**3. DNV Pro Audit (€499)** — I personally review your full application package by email within 48h. I check the CPA letter for the missing items UGE-CE will flag, audit your bank statements for the recurrence pattern, verify the apostille and translation chain. For applicants with complex situations (S-Corps, LLCs, family applications) or who want a second pair of eyes before submitting.

**4. Spanish Resident Pro (€29/month, €14.50/month founding rate)** — ongoing autónomo compliance: deadline tracker, auto-fill Modelo 130/303, invoice generator, quarterly filing review. For people post-arrival who don't want to use a traditional gestoría.

**5. Premium Concierge (€99/month, €49.50/month founding rate)** — same as #4 plus my async quarterly review of your filings before submission, Modelo 720/721 monitoring, and priority email response. For high-stakes cases (Beckham + S-Corp / LLC, family applications, high-income).

Honest take: most applicants only need #2 (DNV Application Pack). The €199 saves real money in avoided mistakes. #3 (Pro Audit) is for the complex cases where one missing piece can cost the application. #4-5 are for after-arrival compliance.

If you want to look at the pricing in detail: [spanishtaxai.com/#pricing](https://spanishtaxai.com/#pricing).

If you have a specific question I can answer in writing: just reply to this email. I read everything personally.

Good luck with the DNV. It's a real path to a good life in Spain if you do the paperwork right.

Cheers,
Oscar

Oscar Gonzalez Febles
Spanish auditor, Madrid
[spanishtaxai.com](https://spanishtaxai.com)

P.S. If you decided the DNV isn't right for you after reading the guide, that's also a legitimate outcome. Better to know now than to spend €1,500 on apostilles and translations only to realize your income isn't recurring enough for UGE-CE. Feel free to reply with your situation — I'll tell you honestly if it's worth pursuing.

---

## Implementation: Cloudflare Worker endpoint stub

Below is the basic structure for the `/lead-capture` endpoint that the form on `/free-guide.html` calls.

```javascript
// In your Worker (chat.js or new lead-capture.js file)

export async function handleLeadCapture(request, env) {
  // 1. Validate origin (CORS)
  const origin = request.headers.get('origin');
  if (!isOriginAllowed(origin, env)) {
    return new Response('Forbidden', { status: 403 });
  }

  // 2. Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { email, situation, source } = body;
  if (!email || !email.includes('@')) {
    return new Response('Invalid email', { status: 400 });
  }

  // 3. Persist to Supabase (table: lead_subscribers)
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/lead_subscribers`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',  // upsert
      },
      body: JSON.stringify({
        email,
        situation: situation || null,
        source: source || 'unknown',
        subscribed_at: new Date().toISOString(),
        ip_country: request.headers.get('cf-ipcountry') || null,
      }),
    });
  } catch (err) {
    console.error('Supabase insert failed:', err);
    // Continue anyway — we'll try to send the welcome email
  }

  // 4. Trigger welcome email via Resend (Email 1 — Day 0)
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Oscar from SpanishTax AI <oscar@spanishtaxai.com>',
        to: email,
        subject: 'Your Spain DNV Checklist is ready (+ a quick note)',
        html: WELCOME_EMAIL_HTML,  // load from a template constant
      }),
    });
  } catch (err) {
    console.error('Resend send failed:', err);
  }

  // 5. (Phase 2) Schedule emails 2-5 via Resend Audiences / Sequences feature
  // For now: manual or basic cron-based scheduling

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
```

**Supabase table schema (run in SQL Editor):**

```sql
create table if not exists lead_subscribers (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  situation text,
  source text default 'unknown',
  subscribed_at timestamptz default now(),
  unsubscribed_at timestamptz,
  ip_country text,
  emails_sent text[] default array[]::text[],  -- track which sequence emails have been sent
  last_email_sent_at timestamptz,
  tags text[] default array[]::text[]
);

create index if not exists idx_lead_subscribers_email on lead_subscribers(email);
create index if not exists idx_lead_subscribers_subscribed_at on lead_subscribers(subscribed_at);
```

This is a minimal version. For Phase 2, you'll add:
- Unsubscribe link handling
- Email open / click tracking
- Sequence scheduler (cron job that runs daily and sends the next email in sequence based on `emails_sent` and `subscribed_at`)
- Tag-based segmentation (e.g., users who replied to Email 5 get tagged "high_intent")

---

## Sequence scheduling — simple cron approach

For Phase 1 (no fancy email automation platform), you can run a Supabase Edge Function on a daily cron schedule:

```javascript
// supabase/functions/send-nurture-emails/index.ts
// Schedule: daily at 10:00 UTC

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const SEQUENCE = [
  { day_offset: 0, email_id: 'welcome', subject: '...', html: '...' },
  { day_offset: 3, email_id: 'tarifa_plana', subject: '...', html: '...' },
  { day_offset: 7, email_id: 'us_structures', subject: '...', html: '...' },
  { day_offset: 14, email_id: 'beckham', subject: '...', html: '...' },
  { day_offset: 21, email_id: 'how_oscar_helps', subject: '...', html: '...' },
];

Deno.serve(async () => {
  // For each subscriber, check which emails they should have received by now
  const { data: subs } = await supabase
    .from('lead_subscribers')
    .select('*')
    .is('unsubscribed_at', null);

  for (const sub of subs) {
    const daysSince = Math.floor(
      (Date.now() - new Date(sub.subscribed_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    for (const email of SEQUENCE) {
      if (daysSince >= email.day_offset && !sub.emails_sent.includes(email.email_id)) {
        await sendEmail(sub.email, email);
        await supabase
          .from('lead_subscribers')
          .update({
            emails_sent: [...sub.emails_sent, email.email_id],
            last_email_sent_at: new Date().toISOString(),
          })
          .eq('id', sub.id);
      }
    }
  }

  return new Response('OK');
});
```

This is enough for the first 50-200 subscribers. Beyond that, consider a dedicated tool (ConvertKit, Brevo, Mailchimp).

---

## Variables to fill in before deploying

Before this nurture sequence is live:

1. ✅ Resend API key configured in Cloudflare Worker secrets as `RESEND_API_KEY`
2. ✅ Resend domain verified (spanishtaxai.com)
3. ✅ Supabase `lead_subscribers` table created (SQL above)
4. ⚠️ Each email converted from Markdown to HTML email template format
5. ⚠️ Unsubscribe link wired up (Resend can handle automatically)
6. ⚠️ Lead capture endpoint deployed in Worker (code stub above)
7. ⚠️ Cron job scheduled (Supabase Edge Function daily)

Items 4-7 are Phase B work — what I've prepared here is the content + architecture. The actual deployment glue is part of the next round when you're at your work PC.
