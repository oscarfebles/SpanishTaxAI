// =====================================================================
// SpanishTax AI — Modelo 303 (IVA quarterly) Worker module
// Importable handler. Mount from your main Worker:
//
//   import { handleModelo303 } from './modelo303.js';
//   ...
//   const m303 = await handleModelo303(request, env);
//   if (m303) return m303;
//
// Routes handled (returns null otherwise):
//   POST /api/modelo303/calculate   { inputs }            -> { boxes, declaration_type }
//   POST /api/modelo303/pdf         { inputs }            -> application/pdf (saves snapshot)
//   GET  /api/modelo303/history                            -> [{ submissions }]
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
export function computeModelo303(body) {
  // IVA devengado — Régimen general
  const box01 = round2(Math.max(0, N(body.box_01_base_21)));
  const box02 = round2(box01 * 0.21);
  const box03 = round2(Math.max(0, N(body.box_03_base_10)));
  const box04 = round2(box03 * 0.10);
  const box05 = round2(Math.max(0, N(body.box_05_base_4)));
  const box06 = round2(box05 * 0.04);

  // Adquisiciones intracomunitarias
  const box10 = round2(Math.max(0, N(body.box_10_intra_base)));
  const box11 = round2(box10 * 0.21); // default 21% on intra-EU acquisitions

  // Inversión sujeto pasivo (reverse charge)
  const box12 = round2(Math.max(0, N(body.box_12_reverse_base)));
  const box13 = round2(box12 * 0.21); // default 21%

  // Total devengado
  const box27 = round2(box02 + box04 + box06 + box11 + box13);

  // IVA deducible — Operaciones interiores
  const box28 = round2(Math.max(0, N(body.box_28_domestic_base)));
  const box29 = round2(Math.max(0, N(body.box_29_domestic_quota)));

  // Adquisiciones intracomunitarias deducibles
  const box32 = round2(Math.max(0, N(body.box_32_intra_ded_base)));
  const box33 = round2(Math.max(0, N(body.box_33_intra_ded_quota)));

  // Importaciones
  const box34 = round2(Math.max(0, N(body.box_34_import_base)));
  const box35 = round2(Math.max(0, N(body.box_35_import_quota)));

  // Total deducible
  const box45 = round2(box29 + box33 + box35);

  // Resultado
  const box46 = round2(box27 - box45);
  const box64 = round2(N(body.box_64_prior_comp)); // can be negative (compensation)
  const box65 = round2(N(body.box_65_special_regime));
  const box69 = round2(box46 + box64 + box65);
  const box71 = box69;

  // Casillas informativas
  const box59 = round2(Math.max(0, N(body.box_59_intra_exempt)));
  const box60 = round2(Math.max(0, N(body.box_60_exports)));
  const box61 = round2(Math.max(0, N(body.box_61_not_subject)));

  // Q4 refund
  const q4RefundRequested = !!body.q4_refund_requested;

  // Declaration type
  let declarationType;
  if (box71 > 0) declarationType = 'to_pay';
  else if (box71 < 0 && q4RefundRequested) declarationType = 'refund_requested';
  else if (box71 < 0) declarationType = 'to_offset';
  else declarationType = 'neutral';

  return {
    box_01_base_21: box01, box_02_quota_21: box02,
    box_03_base_10: box03, box_04_quota_10: box04,
    box_05_base_4: box05, box_06_quota_4: box06,
    box_10_intra_base: box10, box_11_intra_quota: box11,
    box_12_reverse_base: box12, box_13_reverse_quota: box13,
    box_27_total_accrued: box27,
    box_28_domestic_base: box28, box_29_domestic_quota: box29,
    box_32_intra_ded_base: box32, box_33_intra_ded_quota: box33,
    box_34_import_base: box34, box_35_import_quota: box35,
    box_45_total_deductible: box45,
    box_46_general_result: box46,
    box_64_prior_comp: box64, box_65_special_regime: box65,
    box_69_settlement: box69, box_71_final: box71,
    box_59_intra_exempt: box59, box_60_exports: box60, box_61_not_subject: box61,
    q4_refund_requested: q4RefundRequested,
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
    `${env.SUPABASE_URL}/rest/v1/modelo_303_submissions?on_conflict=user_id,fiscal_year,quarter`,
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
    `${env.SUPABASE_URL}/rest/v1/modelo_303_submissions?user_id=eq.${user.id}&order=fiscal_year.desc,quarter.desc`,
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
  pdf.setTitle(`Modelo 303 — ${declarant.fiscalYear}/${declarant.quarter}T — ${declarant.fullName}`);
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
    text(label, margin + 10, y - 10, { size: 9, color: opts.color || ink, bold: !!opts.bold });
    const v = typeof value === 'number' ? fmtEur(value) : String(value);
    const w = (opts.bold ? helvB : helv).widthOfTextAtSize(v, 9);
    text(v, width - margin - 10 - w, y - 10, { size: 9, bold: !!opts.bold, color: opts.color || ink });
    y -= 14;
  };
  const numberedRow = (n, label, value, opts = {}) => {
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
    y -= 16;
  };

  // Header
  text('SpanishTax AI', margin, y - 12, { bold: true, size: 12, color: accent });
  const idStr = `Working copy · ${new Date().toISOString().slice(0, 10)}`;
  const idW = helv.widthOfTextAtSize(idStr, 9);
  text(idStr, width - margin - idW, y - 12, { size: 9, color: muted });
  y -= 22;

  text('Modelo 303', margin, y - 18, { bold: true, size: 20 });
  y -= 22;
  text('IVA — Quarterly VAT return (Self-employed)', margin, y - 12, { size: 10, color: muted });
  y -= 22;
  hr(y); y -= 14;

  // Declarant
  band(y, 18, 'Declarant');
  y -= 24;
  row('NIF', declarant.nif);
  row('Full name / Business name', declarant.fullName);
  row('Fiscal year', String(declarant.fiscalYear));
  row('Period', `${declarant.quarter}T (Quarter ${declarant.quarter})`);
  y -= 4;
  hr(y); y -= 14;

  // IVA devengado
  band(y, 18, 'IVA charged (Devengado) — VAT you charged on your invoices');
  y -= 24;
  numberedRow(1, 'Base at 21%', boxes.box_01_base_21);
  numberedRow(2, 'VAT at 21% (auto)', boxes.box_02_quota_21);
  numberedRow(3, 'Base at 10%', boxes.box_03_base_10);
  numberedRow(4, 'VAT at 10% (auto)', boxes.box_04_quota_10);
  numberedRow(5, 'Base at 4%', boxes.box_05_base_4);
  numberedRow(6, 'VAT at 4% (auto)', boxes.box_06_quota_4);
  numberedRow(10, 'Intra-EU acquisitions — Base', boxes.box_10_intra_base);
  numberedRow(11, 'Intra-EU acquisitions — VAT (auto)', boxes.box_11_intra_quota);
  numberedRow(12, 'Reverse charge — Base', boxes.box_12_reverse_base);
  numberedRow(13, 'Reverse charge — VAT (auto)', boxes.box_13_reverse_quota);
  numberedRow(27, 'TOTAL VAT CHARGED', boxes.box_27_total_accrued, { bold: true });
  y -= 4;
  hr(y); y -= 14;

  // IVA deducible
  band(y, 18, 'IVA paid (Deducible) — VAT you paid on business expenses');
  y -= 24;
  numberedRow(28, 'Domestic operations — Base', boxes.box_28_domestic_base);
  numberedRow(29, 'Domestic operations — Deductible VAT', boxes.box_29_domestic_quota);
  numberedRow(32, 'Intra-EU acquisitions — Base', boxes.box_32_intra_ded_base);
  numberedRow(33, 'Intra-EU acquisitions — Deductible VAT', boxes.box_33_intra_ded_quota);
  numberedRow(34, 'Imports — Base', boxes.box_34_import_base);
  numberedRow(35, 'Imports — Deductible VAT', boxes.box_35_import_quota);
  numberedRow(45, 'TOTAL DEDUCTIBLE VAT', boxes.box_45_total_deductible, { bold: true });
  y -= 4;
  hr(y); y -= 14;

  // Operaciones exentas
  band(y, 18, 'Exempt / Non-subject operations (informational)');
  y -= 24;
  numberedRow(59, 'Intra-EU exempt services', boxes.box_59_intra_exempt);
  numberedRow(60, 'Exports and equivalent (non-EU clients)', boxes.box_60_exports, { bold: true });
  numberedRow(61, 'Non-subject operations', boxes.box_61_not_subject);
  y -= 4;
  hr(y); y -= 14;

  // Resultado
  band(y, 18, 'Settlement result');
  y -= 24;
  numberedRow(46, 'General result (Box 27 - Box 45)', boxes.box_46_general_result, { bold: true });
  numberedRow(64, 'Prior quarter offsets (same year)', boxes.box_64_prior_comp);
  numberedRow(65, 'Special regime result', boxes.box_65_special_regime);
  numberedRow(69, 'Settlement result', boxes.box_69_settlement, { bold: true });
  numberedRow(71, 'FINAL (to pay / to offset)', boxes.box_71_final, { bold: true, color: accent });
  if (boxes.q4_refund_requested) {
    y -= 4;
    row('Q4 REFUND REQUESTED', 'Yes', { bold: true, color: accent });
  }
  y -= 8;
  hr(y); y -= 14;

  // Outcome summary
  band(y, 18, 'Declaration outcome');
  y -= 24;
  const outcomeLabels = {
    to_pay: 'TO PAY — Amount due to AEAT',
    to_offset: 'NEGATIVE — To offset in following quarters',
    refund_requested: 'REFUND REQUESTED — AEAT will process refund',
    neutral: 'NEUTRAL — Zero result',
  };
  const outcomeLabel = outcomeLabels[boxes.declaration_type] || 'Unknown';
  row(outcomeLabel, boxes.box_71_final, { bold: true, color: accent });

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
  const boxes = computeModelo303(body);
  return json({ declarant: clean, boxes });
}

async function handlePdf(request, env, user) {
  let body;
  try { body = await request.json(); } catch { return jsonError(400, 'Invalid JSON'); }
  const { errors, clean } = validateInputs(body);
  if (errors.length) return jsonError(400, errors.join('; '));
  const boxes = computeModelo303(body);

  try { await upsertSubmission(env, user, clean, boxes); }
  catch (e) { return jsonError(500, `Persistence error: ${e.message}`); }

  const pdfBytes = await buildPdf(clean, boxes);
  const filename = `modelo-303-${clean.fiscalYear}-Q${clean.quarter}-${clean.nif}.pdf`;
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
export async function handleModelo303(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/modelo303')) return null;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const user = await getUser(request, env);
  if (!user) return jsonError(401, 'Unauthorized');

  if (url.pathname === '/api/modelo303/calculate' && request.method === 'POST') {
    return handleCalculate(request, env, user);
  }
  if (url.pathname === '/api/modelo303/pdf' && request.method === 'POST') {
    return handlePdf(request, env, user);
  }
  if (url.pathname === '/api/modelo303/history' && request.method === 'GET') {
    return handleHistory(request, env, user);
  }
  return jsonError(404, 'Not found');
}