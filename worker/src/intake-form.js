/**
 * Intake Form Webhook Handler — v1.0
 * ════════════════════════════════════════════════════════════════════
 * Receives Tally webhook when a customer submits the intake form.
 * Maps Tally field labels to Supabase customers columns and updates
 * the customer's row.
 *
 * Tally webhook payload structure:
 * {
 *   eventId: "...",
 *   createdAt: "...",
 *   data: {
 *     responseId: "...",
 *     submittedAt: "...",
 *     fields: [
 *       { key: "question_xxx", label: "Full name", value: "John Smith" },
 *       ...
 *     ]
 *   }
 * }
 */

// Maps Tally question labels to Supabase column names
const FIELD_MAP = {
  'Full name':                            'full_name',
  'Nationality':                          'nationality',
  'Where are you currently based?':       'current_country',
  "What's your work setup?":              'income_type',
  "What's your approximate annual income?":'annual_income_range',
  'Where does your income come from?':    'income_source',
  "What's your DNV status?":             'dnv_status',
  'Are you applying with family?':        'family_situation',
  'When do you plan to arrive in Spain?': 'spain_arrival_text',
  'Have you already registered as autónomo in Spain?': 'autonomo_status',
  "What's your biggest concern right now?": 'main_concern',
  'Anything else Oscar should know about your situation?': 'internal_notes',
};

// Maps income type answers to DB enum values
const INCOME_TYPE_MAP = {
  'W-2 employee (US employer, remote)': 'w2',
  '1099 freelancer / sole proprietor':  '1099',
  'US LLC owner':                        'llc',
  'US S-Corp owner':                     's_corp',
  'UK Ltd director':                     'uk_limited',
  'PAYE employee (UK employer)':         'w2',
  'Other':                               'other',
};

// Maps DNV status answers to DB enum values
const DNV_STATUS_MAP = {
  'Research phase (haven\'t started)':    'pre_application',
  'Gathering documents':                  'pre_application',
  'Application submitted, waiting':       'submitted',
  'Application approved':                 'approved',
  'Already in Spain (post-arrival setup)':'approved',
  'Not applying for DNV':                 'not_applicable',
};

function parseFields(fields) {
  const result = {};

  for (const field of fields) {
    const label = field.label;
    const col = FIELD_MAP[label];
    if (!col) continue;

    let value = field.value;
    if (value === null || value === undefined || value === '') continue;

    // Handle arrays (multiple choice returns array)
    if (Array.isArray(value)) {
      value = value[0] || '';
    }

    // Map specific fields to enum values
    if (col === 'income_type') {
      value = INCOME_TYPE_MAP[value] || 'other';
    }
    if (col === 'dnv_status') {
      value = DNV_STATUS_MAP[value] || 'pre_application';
    }

    result[col] = value;
  }

  return result;
}

async function getEmailFromTallyPayload(payload, env) {
  // Tally doesn't send email in the webhook by default.
  // We identify the customer by looking for an email field,
  // OR by matching the responseId to a recent chatbot session.
  //
  // Strategy: look for email in the fields first.
  const emailField = payload.data?.fields?.find(
    (f) => f.type === 'INPUT_EMAIL' || f.label?.toLowerCase().includes('email')
  );
  if (emailField?.value) return emailField.value.toLowerCase().trim();

  // Fallback: can't identify customer without email
  return null;
}

export async function handleIntakeForm(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  console.log('Intake form received:', JSON.stringify(payload).slice(0, 200));

  const fields = payload.data?.fields;
  if (!fields || !Array.isArray(fields)) {
    return new Response('No fields in payload', { status: 400 });
  }

  // Parse fields into DB columns
  const updates = parseFields(fields);
  updates.onboarding_completed = true;

  if (Object.keys(updates).length <= 1) {
    console.log('Intake form: no mappable fields found');
    return new Response(JSON.stringify({ ok: true, note: 'no fields mapped' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Try to get email to identify the customer
  const email = await getEmailFromTallyPayload(payload, env);

  if (!email) {
    // Store the intake data without email linkage for now
    // Oscar can manually match later via internal_notes
    console.log('Intake form: no email found, storing as orphan response');
    console.log('Parsed updates:', JSON.stringify(updates));
    // In Phase 2: store in a separate intake_responses table
    return new Response(JSON.stringify({ ok: true, note: 'no email to match' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Update customer row in Supabase
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/customers?email=eq.${encodeURIComponent(email)}`,
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
      console.error(`Supabase update failed (${res.status}):`, errText);
      throw new Error(`Supabase error: ${errText}`);
    }

    console.log(`Intake form: updated customer ${email} with`, JSON.stringify(updates));
  } catch (err) {
    console.error('Intake form handler error:', err);
    // Return 200 to Tally — we don't want Tally to retry endlessly
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
