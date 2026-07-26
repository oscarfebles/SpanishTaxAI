// =====================================================================
// SpanishTax AI — Modelo 130 (IRPF quarterly) Worker module
// Importable handler. Mount from your main Worker:
//
//   import { handleModelo130 } from './modelo130.js';
//   ...
//   const m130 = await handleModelo130(request, env);
//   if (m130) return m130;
//
// Routes handled (returns null otherwise):
//   POST /api/modelo130/calculate   { inputs }            -> { boxes, declaration_type }
//   POST /api/modelo130/pdf         { inputs }            -> application/pdf (saves snapshot)
//   GET  /api/modelo130/history                            -> [{ submissions }]
//
// Env required: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Dependency: "pdf-lib": "^1.17.1"  (npm install pdf-lib)
// =====================================================================

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}
function jsonError(status, message) { return json({ error: message }, status); }

// ---------- Auth ----------
async function getUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user && user.id ? { id: user.id, email: user.email, token } : null;
}

// ---------- Validation ----------
const N = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(n * 100) / 100;

function validateInputs(body) {
  const errors = [];
  const nif = String(body.nif || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{8,10}$/.test(nif)) errors.push('NIF must be 8–10 alphanumeric characters');
  const fullName = String(body.full_name || '').trim();
  if (!fullName) errors.push('Full name is required');
  const fiscalYear = parseInt(body.fiscal_year, 10);
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) errors.push('Invalid fiscal year');
  const quarter = parseInt(body.quarter, 10);
  if (![1, 2, 3, 4].includes(quarter)) errors.push('Quarter must be 1, 2, 3 or 4');
  return { errors, clean: { nif, fullName, fiscalYear, quarter } };
}

// ---------- Calculation ----------
// All amounts in EUR. Logic follows AEAT Modelo 130 instructions.
export function computeModelo130(body) {
  const box01 = round2(Math.max(0, N(body.box_01_income)));
  const box02 = round2(Math.max(0, N(body.box_02_expenses)));
  const box03 = round2(box01 - box02);
  const box04 = round2(Math.max(0, box03) * 0.20);
  const box05 = round2(Math.max(0, N(body.box_05_prior_payments)));
  const box06 = round2(Math.max(0, N(body.box_06_withholdings)));
  const box07 = round2(Math.max(0, box04 - box05 - box06));

  const box08 = round2(Math.max(0, N(body.box_08_agri_income)));
  const box09 = round2(box08 * 0.02);
  const box10 = round2(Math.max(0, N(body.box_10_agri_withholdings)));
  const box11 = round2(Math.max(0, box09 - box10));

  const box12 = round2(box07 + box11);
  const box13 = round2(Math.max(0, N(body.box_13_minoration)));
  const box14 = round2(box12 - box13);
  const box15 = round2(Math.max(0, N(body.box_15_prior_negatives)));
  const box16 = round2(Math.max(0, N(body.box_16_housing_deduction)));
  const box17 = round2(box14 - box15 - box16);

  let box18 = 0, box19 = 0, declarationType = 'negative';
  if (box17 > 0) { box19 = box17; declarationType = 'to_pay'; }
  else if (box17 < 0) { box18 = round2(Math.abs(box17)); declarationType = 'to_carry_forward'; }
  else { declarationType = 'negative'; }

  return {
    box_01_income: box01, box_02_expenses: box02, box_03_net_income: box03,
    box_04_twenty_percent: box04, box_05_prior_payments: box05,
    box_06_withholdings: box06, box_07_result_section1: box07,
    box_08_agri_income: box08, box_09_two_percent: box09,
    box_10_agri_withholdings: box10, box_11_result_section2: box11,
    box_12_sum: box12, box_13_minoration: box13, box_14_subtotal: box14,
    box_15_prior_negatives: box15, box_16_housing_deduction: box16,
    box_17_result: box17, box_18_to_carry_forward: box18, box_19_to_pay: box19,
    declaration_type: declarationType,
  };
}

// ---------- Persistence ----------
async function upsertSubmission(env, user, declarant, boxes) {
  const row = {
    user_id: user.id,
    nif: declarant.nif,
    full_name: declarant.fullName,
    fiscal_year: declarant.fiscalYear,
    quarter: declarant.quarter,
    ...boxes,
  };
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/modelo_130_submissions?on_conflict=user_id,fiscal_year,quarter`,
    {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(row),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function listSubmissions(env, user) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/modelo_130_submissions?user_id=eq.${user.id}&order=fiscal_year.desc,quarter.desc`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );
  if (!res.ok) throw new Error(`Supabase list failed: ${res.status}`);
  return await res.json();
}

// ---------- PDF generation ----------
function fmtEur(n) {
  const v = Math.abs(n).toFixed(2).replace('.', ',');
  const [int, dec] = v.split(',');
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}${withSep},${dec} €`;
}

async function buildPdf(declarant, boxes) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Modelo 130 — ${declarant.fiscalYear}/${declarant.quarter}T — ${declarant.fullName}`);
  pdf.setAuthor('SpanishTax AI');
  pdf.setCreator('SpanishTax AI (spanishtaxai.com)');
  pdf.setProducer('SpanishTax AI');

  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvB = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.07, 0.09, 0.15);
  const muted = rgb(0.40, 0.44, 0.52);
  const accent = rgb(0.10, 0.36, 0.85);
  const rule = rgb(0.82, 0.85, 0.90);
  const bandBg = rgb(0.96, 0.97, 0.99);

  const margin = 40;
  let y = height - margin;

  const text = (s, x, yy, opts = {}) => {
    page.drawText(String(s), {
      x, y: yy,
      size: opts.size || 9,
      font: opts.bold ? helvB : helv,
      color: opts.color || ink,
    });
  };
  const hr = (yy, color = rule) => {
    page.drawLine({ start: { x: margin, y: yy }, end: { x: width - margin, y: yy }, thickness: 0.5, color });
  };
  const band = (yy, h, label) => {
    page.drawRectangle({ x: margin, y: yy - h, width: width - 2 * margin, height: h, color: bandBg });
    text(label, margin + 8, yy - h + (h - 9) / 2 + 1, { bold: true, size: 9, color: accent });
  };
  const row = (label, value, opts = {}) => {
    const lh = 14;
    text(label, margin + 10, y - 10, { size: 9, color: opts.color || ink, bold: !!opts.bold });
    const v = typeof value === 'number' ? fmtEur(value) : String(value);
    const w = (opts.bold ? helvB : helv).widthOfTextAtSize(v, 9);
    text(v, width - margin - 10 - w, y - 10, { size: 9, bold: !!opts.bold, color: opts.color || ink });
    y -= lh;
  };
  const numberedRow = (n, label, value, opts = {}) => {
    const lh = 16;
    // box number
    page.drawRectangle({
      x: margin + 6, y: y - 12,
      width: 22, height: 12,
      borderWidth: 0.5, borderColor: muted,
      color: rgb(1, 1, 1),
    });
    const nStr = String(n).padStart(2, '0');
    const nw = helvB.widthOfTextAtSize(nStr, 8);
    text(nStr, margin + 6 + (22 - nw) / 2, y - 10, { bold: true, size: 8, color: muted });
    text(label, margin + 34, y - 10, { size: 9, color: opts.color || ink, bold: !!opts.bold });
    const v = typeof value === 'number' ? fmtEur(value) : String(value);
    const vw = (opts.bold ? helvB : helv).widthOfTextAtSize(v, 9);
    text(v, width - margin - 10 - vw, y - 10, { size: 9, bold: !!opts.bold, color: opts.color || ink });
    y -= lh;
  };

  // Header
  text('SpanishTax AI', margin, y - 12, { bold: true, size: 12, color: accent });
  const idStr = `Working copy · ${new Date().toISOString().slice(0, 10)}`;
  const idW = helv.widthOfTextAtSize(idStr, 9);
  text(idStr, width - margin - idW, y - 12, { size: 9, color: muted });
  y -= 22;

  text('Modelo 130', margin, y - 18, { bold: true, size: 20 });
  y -= 22;
  text('IRPF — Quarterly instalment payment (Self-employed)', margin, y - 12, { size: 10, color: muted });
  y -= 22;
  hr(y); y -= 14;

  // Declarant block
  band(y, 18, 'Declarant');
  y -= 24;
  row('NIF', declarant.nif);
  row('Full name / Business name', declarant.fullName);
  row('Fiscal year', String(declarant.fiscalYear));
  row('Period', `${declarant.quarter}T (Quarter ${declarant.quarter})`);
  y -= 4;
  hr(y); y -= 14;

  // Section I
  band(y, 18, 'Section I — Direct estimation (non-agricultural activities)');
  y -= 24;
  numberedRow(1, 'Computable income for the period', boxes.box_01_income);
  numberedRow(2, 'Deductible expenses for the period', boxes.box_02_expenses);
  numberedRow(3, 'Net income (Box 01 - Box 02)', boxes.box_03_net_income, { bold: true });
  numberedRow(4, '20% of Box 03 (if positive)', boxes.box_04_twenty_percent);
  numberedRow(5, 'Sum of prior instalments in this fiscal year', boxes.box_05_prior_payments);
  numberedRow(6, 'Withholdings and payments on account', boxes.box_06_withholdings);
  numberedRow(7, 'Result Section I (Box 04 - 05 - 06, min 0)', boxes.box_07_result_section1, { bold: true });
  y -= 4;
  hr(y); y -= 14;

  // Section II
  band(y, 18, 'Section II — Agricultural, livestock, fishing and forestry');
  y -= 24;
  numberedRow(8, 'Quarter income volume (excl. capital grants)', boxes.box_08_agri_income);
  numberedRow(9, '2% of Box 08', boxes.box_09_two_percent);
  numberedRow(10, 'Withholdings and payments on account', boxes.box_10_agri_withholdings);
  numberedRow(11, 'Result Section II (Box 09 - Box 10, min 0)', boxes.box_11_result_section2, { bold: true });
  y -= 4;
  hr(y); y -= 14;

  // Section III
  band(y, 18, 'Section III — Total quarter result');
  y -= 24;
  numberedRow(12, 'Sum (Box 07 + Box 11)', boxes.box_12_sum, { bold: true });
  numberedRow(13, 'Minoration (Art. 110.3.c, low-income reduction)', boxes.box_13_minoration);
  numberedRow(14, 'Subtotal (Box 12 - Box 13)', boxes.box_14_subtotal);
  numberedRow(15, 'Negative results from prior quarters (same year)', boxes.box_15_prior_negatives);
  numberedRow(16, 'Primary residence deduction (pre-2013 mortgage)', boxes.box_16_housing_deduction);
  numberedRow(17, 'Quarter result (Box 14 - 15 - 16)', boxes.box_17_result, { bold: true });
  numberedRow(18, 'To carry forward (if Box 17 is negative)', boxes.box_18_to_carry_forward);
  numberedRow(19, 'To pay (if Box 17 is positive)', boxes.box_19_to_pay, { bold: true, color: accent });
  y -= 8;
  hr(y); y -= 14;

  // Outcome summary
  band(y, 18, 'Declaration outcome');
  y -= 24;
  const outcomeLabel = {
    to_pay: 'TO PAY — Amount due to AEAT (Box 19)',
    to_carry_forward: 'NEGATIVE — To deduct in following quarters (Box 18)',
    negative: 'NEGATIVE — Zero result',
  }[boxes.declaration_type];
  const outcomeValue = boxes.declaration_type === 'to_pay'
    ? boxes.box_19_to_pay
    : (boxes.declaration_type === 'to_carry_forward' ? boxes.box_18_to_carry_forward : 0);
  row(outcomeLabel, outcomeValue, { bold: true, color: accent });

  // Footer
  const footY = margin + 24;
  hr(footY + 30);
  text('This is a working copy generated by SpanishTax AI for your records and review.',
    margin, footY + 14, { size: 8, color: muted });
  text('Official filing must be submitted electronically through the AEAT portal (sede.agenciatributaria.gob.es).',
    margin, footY + 2, { size: 8, color: muted });
  const url = 'spanishtaxai.com';
  const urlW = helv.widthOfTextAtSize(url, 8);
  text(url, width - margin - urlW, footY + 2, { size: 8, color: muted });

  return await pdf.save();
}

// ---------- Route handlers ----------
async function handleCalculate(request, env, user) {
  let body;
  try { body = await request.json(); } catch { return jsonError(400, 'Invalid JSON'); }
  const { errors, clean } = validateInputs(body);
  if (errors.length) return jsonError(400, errors.join('; '));
  const boxes = computeModelo130(body);
  return json({ declarant: clean, boxes });
}

async function handlePdf(request, env, user) {
  let body;
  try { body = await request.json(); } catch { return jsonError(400, 'Invalid JSON'); }
  const { errors, clean } = validateInputs(body);
  if (errors.length) return jsonError(400, errors.join('; '));
  const boxes = computeModelo130(body);

  try { await upsertSubmission(env, user, clean, boxes); }
  catch (e) { return jsonError(500, `Persistence error: ${e.message}`); }

  const pdfBytes = await buildPdf(clean, boxes);
  const filename = `modelo-130-${clean.fiscalYear}-Q${clean.quarter}-${clean.nif}.pdf`;
  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
    },
  });
}

async function handleHistory(request, env, user) {
  try {
    const rows = await listSubmissions(env, user);
    return json({ submissions: rows });
  } catch (e) {
    return jsonError(500, e.message);
  }
}

// ---------- Public entry point ----------
export async function handleModelo130(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/modelo130')) return null;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const user = await getUser(request, env);
  if (!user) return jsonError(401, 'Unauthorized');

  if (url.pathname === '/api/modelo130/calculate' && request.method === 'POST') {
    return handleCalculate(request, env, user);
  }
  if (url.pathname === '/api/modelo130/pdf' && request.method === 'POST') {
    return handlePdf(request, env, user);
  }
  if (url.pathname === '/api/modelo130/history' && request.method === 'GET') {
    return handleHistory(request, env, user);
  }
  return jsonError(404, 'Not found');
}


