Modelo 130 — Integration guide
Drop-in module for SpanishTax AI. Three files, four steps.
Files in this package
File
Where it goes
schema.sql
Run in Supabase SQL editor
modelo130.js
Cloudflare Worker (importable module)
modelo130.html
Cloudflare Pages — public/modelo130.html (same folder as app.html)


Step 1 — Database
Open the Supabase SQL editor for your project and paste the entire contents of schema.sql. It is idempotent — safe to re-run. It creates public.modelo_130_submissions, an updated-at trigger, indexes, and RLS policies that scope every row to its owner.
Step 2 — Worker
2a. Install dependency
In the Worker project:
npm install pdf-lib@^1.17.1

2b. Drop in the module
Copy modelo130.js into your Worker source (e.g. src/modelo130.js).
2c. Wire it from your main router
In your main Worker entry (src/index.js or equivalent), import and try handleModelo130 before your other routes. It returns null for any URL it doesn't own, so it's safe to call first:
import { handleModelo130 } from './modelo130.js';

export default {
  async fetch(request, env, ctx) {
    const m130 = await handleModelo130(request, env);
    if (m130) return m130;

    // ...your existing routes...
  },
};

2d. Required environment variables
Set these in wrangler.toml or via wrangler secret put:
Variable
Purpose
SUPABASE_URL
e.g. https://xxxx.supabase.co
SUPABASE_ANON_KEY
Public anon key (used to validate the user's JWT)
SUPABASE_SERVICE_ROLE_KEY
Service role key (bypasses RLS for snapshot upserts)

Routes exposed:
POST /api/modelo130/calculate — body: declarant + box inputs → JSON with all computed boxes
POST /api/modelo130/pdf — body: same → PDF download (also persists a snapshot)
GET /api/modelo130/history — list of past submissions for the signed-in user
All three require Authorization: Bearer <supabase_jwt>.
Step 3 — Frontend page
Copy modelo130.html into the same Pages folder as app.html (so it's reachable at /modelo130.html).
Inside the file, near the top of the <script> block, you'll find:
var SUPABASE_URL = window.__SUPABASE_URL__ || 'YOUR_SUPABASE_URL';
var SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__ || 'YOUR_SUPABASE_ANON_KEY';
var API_BASE = window.__API_BASE__ || '';

Two options:
Option A (recommended) — define globals once on the Pages site (e.g. in a tiny /config.js loaded by every page, or via Pages Functions) so all pages share them:
<script>
  window.__SUPABASE_URL__ = 'https://xxxx.supabase.co';
  window.__SUPABASE_ANON_KEY__ = 'eyJ...';
  window.__API_BASE__ = '';   // empty = same origin
</script>

Option B — replace the three placeholder strings directly in modelo130.html.
Step 4 — Activate the dashboard card
In app.html, find the "Auto-fill Modelo 130" card and replace the "Coming soon" badge/control with a link to the new page.
Minimal swap (works regardless of your exact markup — just replace the inert "Coming soon" element with this):
<a class="card-cta" href="/modelo130.html">Open auto-fill →</a>

If your "Coming soon" element looks like a pill/badge, e.g.:
<span class="badge coming-soon">Coming soon</span>

Replace it with:
<a class="badge ready" href="/modelo130.html">Open →</a>

…and add this CSS once (anywhere in app.html's <style>):
.badge.ready{
  background:#1A5AD9;color:#fff;text-decoration:none;padding:4px 10px;
  border-radius:999px;font-size:12px;font-weight:600;display:inline-block;
}
.badge.ready:hover{background:#0f3a8a}

If the whole card is clickable, just wrap it (or its inner contents) in <a href="/modelo130.html">…</a> and remove the "Coming soon" element.

Smoke test
Visit /modelo130.html while signed in.
Fill NIF, name, then Box 01 = 10000, Box 02 = 2500, Box 06 = 150.
Sidebar should show Net income 7.500,00 €, Section I result 1.350,00 €, status To pay 1.350,00 €.
Click Generate & download PDF. A file named modelo-130-<year>-Q<n>-<NIF>.pdf should download. A row should appear in modelo_130_submissions.
Notes
Output is a working copy for review and records. Official filing is electronic via sede.agenciatributaria.gob.es.
The PDF is generated on every request — there is no file storage. Snapshots of the input + computed boxes live in Supabase for auditability and to prefill the form on subsequent visits.
The unique constraint on (user_id, fiscal_year, quarter) means a second submission for the same period overwrites the prior snapshot. If you'd rather keep history, drop that constraint and change Prefer: resolution=merge-duplicates to an insert.

