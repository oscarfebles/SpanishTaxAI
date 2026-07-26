// =====================================================================
// SpanishTax AI — Modelo 036 (Autónomo registration) Worker module
// Importable handler. Mount from your main Worker:
//
//   import { handleModelo036 } from './modelo036.js';
//   ...
//   const m036 = await handleModelo036(request, env);
//   if (m036) return m036;
//
// Routes handled (returns null otherwise):
//   POST /api/modelo036/calculate   { inputs }            -> { boxes, declaration_type }
//   POST /api/modelo036/pdf         { inputs }            -> application/pdf (saves snapshot)
//   GET  /api/modelo036/history                            -> [{ submissions }]
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
function validateInputs(body) {
  const errors = [];
  
  // Personal / Business info
  const nif = String(body.nif || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{8,10}$/.test(nif)) errors.push('NIF must be 8–10 alphanumeric characters');
  
  const fullName = String(body.full_name || '').trim();
  if (!fullName) errors.push('Full name is required');
  
  const businessName = String(body.business_name || '').trim();
  if (!businessName) errors.push('Business name is required');
  
  // Activity
  const iaeCode = String(body.iae_code || '').trim();
  if (!iaeCode) errors.push('IAE epígrafe is required (e.g., 999)');
  
  const activityDescription = String(body.activity_description || '').trim();
  if (!activityDescription) errors.push('Activity description is required');
  
  const startDate = String(body.start_date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) errors.push('Start date must be YYYY-MM-DD');
  
  // Address
  const address = String(body.address || '').trim();
  if (!address) errors.push('Business address is required');
  
  const city = String(body.city || '').trim();
  if (!city) errors.push('City is required');
  
  const province = String(body.province || '').trim();
  if (!province) errors.push('Province is required');
  
  const postalCode = String(body.postal_code || '').trim();
  if (!/^\d{5}$/.test(postalCode)) errors.push('Postal code must be 5 digits');
  
  // Tax regime
  const taxRegime = String(body.tax_regime || '').trim();
  if (!['general', 'simplified', 'beckham'].includes(taxRegime)) {
    errors.push('Tax regime must be: general, simplified, or beckham');
  }
  
  // Self-assessment frequency
  const assessmentFreq = String(body.assessment_freq || '').trim();
  if (!['quarterly', 'monthly'].includes(assessmentFreq)) {
    errors.push('Assessment frequency must be: quarterly or monthly');
  }
  
  return { 
    errors, 
    clean: { 
      nif, fullName, businessName, iaeCode, activityDescription, startDate,
      address, city, province, postalCode, taxRegime, assessmentFreq,
      phone: String(body.phone || '').trim(),
      email: String(body.email || '').trim()
    } 
  };
}

// ---------- Calculation (generates structured data for PDF) ----------
export function computeModelo036(body) {
  const startDate = new Date(body.start_date);
  const now = new Date();
  const isTarifaPlana = (now - startDate) < 365 * 24 * 60 * 60 * 1000; // first 12 months
  
  let monthlySocialSecurity = 0;
  let monthlyTaxAdvance = 0;
  
  // Social Security calculation (approximate 2026 rates)
  const baseContribution = body.assessment_freq === 'monthly' ? 1268 : 1268; // 2026 base
  const contributionRate = 0.294; // 29.4% autónomo 2026
  
  if (isTarifaPlana) {
    monthlySocialSecurity = 88.64; // Tarifa plana 2026
  } else {
    monthlySocialSecurity = baseContribution * contributionRate;
  }
  
  // Income tax advance (20% of estimated monthly income if provided)
  const estimatedMonthlyIncome = parseFloat(body.estimated_income) || 0;
  monthlyTaxAdvance = estimatedMonthlyIncome * 0.20;
  
  const taxRegime = body.tax_regime;
  let taxRegimeLabel = '';
  let taxRate = 0;
  let taxNotes = '';
  
  switch(taxRegime) {
    case 'general':
      taxRegimeLabel = 'Régimen General (IRPF)';
      taxRate = 0.20;
      taxNotes = 'Standard 20% retention for autónomos. Quarterly 130 declarations required.';
      break;
    case 'simplified':
      taxRegimeLabel = 'Régimen Simplificado (Módulos)';
      taxRate = 0.15;
      taxNotes = 'Simplified regime. Only available if annual revenue < €250,000.';
      break;
    case 'beckham':
      taxRegimeLabel = 'Beckham Law (24% flat rate)';
      taxRate = 0.24;
      taxNotes = 'Special regime for new residents. 24% flat rate on income under €600,000. Requires application with Modelo 149.';
      break;
  }
  
  const model036Boxes = {
    // Section 1: Applicant info
    applicant_type: 'autonomo',
    nif: body.nif,
    full_name: body.full_name,
    business_name: body.business_name,
    business_type: 'individual',
    
    // Section 2: Activity
    activity_start_date: body.start_date,
    iae_code: body.iae_code,
    activity_description: body.activity_description,
    main_activity: true,
    
    // Section 3: Location
    address: body.address,
    city: body.city,
    province: body.province,
    postal_code: body.postal_code,
    
    // Section 4: Tax regime
    tax_regime: body.tax_regime,
    tax_regime_label: taxRegimeLabel,
    tax_rate: taxRate,
    tax_notes: taxNotes,
    
    // Section 5: Assessment
    assessment_frequency: body.assessment_freq,
    monthly_social_security: monthlySocialSecurity,
    monthly_tax_advance: monthlyTaxAdvance,
    
    // Section 6: Contact
    phone: body.phone || '',
    email: body.email || '',
    
    // Derived
    tarifa_plana_eligible: isTarifaPlana,
    estimated_monthly_income: estimatedMonthlyIncome,
  };
  
  return model036Boxes;
}

// ---------- Persistence ----------
async function upsertSubmission(env, user, declarant, boxes) {
  const row = {
    user_id: user.id,
    nif: declarant.nif,
    full_name: declarant.fullName,
    business_name: declarant.businessName,
    iae_code: declarant.iaeCode,
    activity_description: declarant.activityDescription,
    start_date: declarant.startDate,
    address: declarant.address,
    city: declarant.city,
    province: declarant.province,
    postal_code: declarant.postalCode,
    tax_regime: declarant.taxRegime,
    assessment_freq: declarant.assessmentFreq,
    phone: declarant.phone || null,
    email: declarant.email || null,
    monthly_social_security: boxes.monthly_social_security,
    monthly_tax_advance: boxes.monthly_tax_advance,
    tax_regime_label: boxes.tax_regime_label,
    tax_rate: boxes.tax_rate,
    tarifa_plana_eligible: boxes.tarifa_plana_eligible,
    estimated_income: boxes.estimated_monthly_income,
  };
  
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/modelo_036_submissions?on_conflict=user_id,nif`,
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
    `${env.SUPABASE_URL}/rest/v1/modelo_036_submissions?user_id=eq.${user.id}&order=created_at.desc`,
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
async function buildPdf(declarant, boxes) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Modelo 036 — ${declarant.fullName}`);
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
    const v = String(value);
    const w = (opts.bold ? helvB : helv).widthOfTextAtSize(v, 9);
    text(v, width - margin - 10 - w, y - 10, { size: 9, bold: !!opts.bold, color: opts.color || ink });
    y -= 14;
  };
  
  // Header
  text('SpanishTax AI', margin, y - 12, { bold: true, size: 12, color: accent });
  const idStr = `Working copy · ${new Date().toISOString().slice(0, 10)}`;
  const idW = helv.widthOfTextAtSize(idStr, 9);
  text(idStr, width - margin - idW, y - 12, { size: 9, color: muted });
  y -= 22;
  
  text('Modelo 036', margin, y - 18, { bold: true, size: 20 });
  y -= 22;
  text('Alta de autónomo / Self-employed registration', margin, y - 12, { size: 10, color: muted });
  y -= 22;
  hr(y); y -= 14;
  
  // Section 1: Applicant
  band(y, 18, '1. Applicant information');
  y -= 24;
  row('Type', 'Self-employed (autónomo)');
  row('NIF', declarant.nif);
  row('Full name', declarant.fullName);
  row('Business name', declarant.businessName);
  y -= 4;
  hr(y); y -= 14;
  
  // Section 2: Activity
  band(y, 18, '2. Economic activity');
  y -= 24;
  row('IAE epígrafe', declarant.iaeCode);
  row('Description', declarant.activityDescription);
  row('Start date', declarant.startDate);
  y -= 4;
  hr(y); y -= 14;
  
  // Section 3: Location
  band(y, 18, '3. Business address');
  y -= 24;
  row('Address', declarant.address);
  row('City', declarant.city);
  row('Province', declarant.province);
  row('Postal code', declarant.postalCode);
  y -= 4;
  hr(y); y -= 14;
  
  // Section 4: Tax regime
  band(y, 18, '4. Tax regime');
  y -= 24;
  row('Regime', boxes.tax_regime_label);
  row('Applicable rate', `${(boxes.tax_rate * 100).toFixed(0)}%`);
  row('Notes', boxes.tax_notes);
  y -= 4;
  hr(y); y -= 14;
  
  // Section 5: Financial
  band(y, 18, '5. Financial summary');
  y -= 24;
  row('Assessment frequency', declarant.assessmentFreq.charAt(0).toUpperCase() + declarant.assessmentFreq.slice(1));
  row('Monthly SS (estimate)', `€${boxes.monthly_social_security.toFixed(2)}`);
  row('Monthly tax advance (est.)', `€${boxes.monthly_tax_advance.toFixed(2)}`);
  row('Tarifa plana eligible', boxes.tarifa_plana_eligible ? 'Yes (first 12 months)' : 'No');
  row('Estimated monthly income', boxes.estimated_monthly_income ? `€${boxes.estimated_monthly_income.toFixed(2)}` : 'N/A');
  
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
  const boxes = computeModelo036(body);
  return json({ declarant: clean, boxes });
}

async function handlePdf(request, env, user) {
  let body;
  try { body = await request.json(); } catch { return jsonError(400, 'Invalid JSON'); }
  const { errors, clean } = validateInputs(body);
  if (errors.length) return jsonError(400, errors.join('; '));
  const boxes = computeModelo036(body);
  
  try { await upsertSubmission(env, user, clean, boxes); }
  catch (e) { return jsonError(500, `Persistence error: ${e.message}`); }
  
  const pdfBytes = await buildPdf(clean, boxes);
  const filename = `modelo-036-${clean.nif}-${clean.startDate}.pdf`;
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
export async function handleModelo036(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/modelo036')) return null;
  
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  
  const user = await getUser(request, env);
  if (!user) return jsonError(401, 'Unauthorized');
  
  if (url.pathname === '/api/modelo036/calculate' && request.method === 'POST') {
    return handleCalculate(request, env, user);
  }
  if (url.pathname === '/api/modelo036/pdf' && request.method === 'POST') {
    return handlePdf(request, env, user);
  }
  if (url.pathname === '/api/modelo036/history' && request.method === 'GET') {
    return handleHistory(request, env, user);
  }
  return jsonError(404, 'Not found');
}