# SpanishTax AI Chatbot — Cloudflare Worker

The Worker is the backend brain of the chatbot. It receives messages from the
widget, retrieves relevant KB chunks from Supabase, calls Claude Sonnet 4.6
with streaming, and logs everything for QA.

## Architecture

```
Widget (browser)
   │
   │ POST /chat  { session_id, message, history }
   ▼
Cloudflare Worker
   ├─ Rate limit check (KV)            — rateLimit.js
   ├─ Turn count check (Supabase)      — logging.js
   ├─ Language detection                — language.js
   ├─ Escalation trigger detection      — escalation.js
   ├─ Voyage embed + Supabase retrieval — retrieval.js
   ├─ System prompt build               — prompt.js
   ├─ Claude streaming call             — anthropic.js
   ├─ Stream response → widget
   └─ Log turn (fire-and-forget)        — logging.js
```

All in 8 small modules + 1 entry point. Total ~700 lines.

## One-time setup

### 1. Install dependencies

```bash
cd worker
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

### 3. Create the KV namespace for rate limiting

```bash
npx wrangler kv:namespace create "RATE_LIMIT"
```

Wrangler will print something like:
```
{ binding = "RATE_LIMIT", id = "abc123def456..." }
```

Copy the `id` and paste it into `wrangler.toml` where it says
`PASTE_KV_NAMESPACE_ID_HERE`.

### 4. Set production secrets

```bash
npx wrangler secret put SUPABASE_URL
# (paste the URL when prompted)

npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put VOYAGE_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY
```

### 5. (For local dev only) Create .dev.vars

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your real keys (same values as the secrets above).
```

## Local development

```bash
npm run dev
```

Wrangler starts the Worker at `http://localhost:8787`.

Quick test (using curl or any HTTP client):

```bash
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "session_id": "test-session-1",
    "message": "What is the income threshold for the DNV in 2026?",
    "history": []
  }'
```

You should see Server-Sent Events streaming back with Claude's response.

## Deploy to production

```bash
npm run deploy
```

After deploy, configure the custom route in the Cloudflare dashboard:

1. Go to **Workers & Pages** → **spanishtax-chatbot** → **Triggers**
2. Add a custom domain: `api.spanishtaxai.com`
3. (Alternative) Add a route: `spanishtaxai.com/api/chat*`

Either works. Custom domain is cleaner because the widget calls
`https://api.spanishtaxai.com/chat` regardless of where Pages is hosted.

## Tail logs

```bash
npm run tail
```

Shows real-time console output from the Worker. Useful for debugging the
first deployment.

## Verifying it works end-to-end

After deploy, test from a real allowed origin:

```bash
curl -X POST https://api.spanishtaxai.com/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://spanishtaxai.com" \
  -d '{
    "session_id": "verify-001",
    "message": "How much is the Tarifa Plana?",
    "history": []
  }'
```

Then check Supabase: a new row should appear in `conversation_logs`.

## Common issues

**`KV namespace ID missing`** — You skipped step 3. Run
`wrangler kv:namespace create "RATE_LIMIT"` and paste the id in `wrangler.toml`.

**`Anthropic API error 401`** — Wrong API key. Verify with
`npx wrangler secret list` that ANTHROPIC_API_KEY is set. To replace:
`npx wrangler secret put ANTHROPIC_API_KEY`.

**`CORS error in browser`** — Your origin is not in `ALLOWED_ORIGINS` in
`wrangler.toml`. Add it (comma-separated) and redeploy.

**`Stream cuts off mid-response`** — Most likely the `max_tokens` is too low
or Claude rate-limited you. Check tail logs.

**Logs not appearing in Supabase** — Check the Worker logs (`npm run tail`).
The logging call is fire-and-forget, so failures are silent to the user but
visible in console.

## Cost estimate (June 2026)

For ~1,000 messages/month:

| Component | Cost |
|---|---|
| Cloudflare Workers (Free tier: 100k req/day) | €0 |
| Cloudflare KV (Free tier: 100k reads/day) | €0 |
| Voyage AI voyage-3-large (queries) | ~€0.05 |
| Anthropic Claude Sonnet 4.6 (~500 in / 200 out tokens avg) | ~€15-25 |
| Supabase (free tier) | €0 |
| **Total** | **~€15-25/month** |

Scales roughly linearly. 10,000 messages/month ≈ €150-250.

## File layout

```
worker/
├── package.json
├── wrangler.toml             ← Worker config + KV binding + vars
├── .dev.vars.example         ← template for local dev credentials
├── .dev.vars                 ← real local credentials (gitignored)
├── .gitignore
├── README.md
└── src/
    ├── index.js              ← routing + CORS
    ├── chat.js               ← /chat endpoint orchestrator
    ├── retrieval.js          ← Voyage embed + Supabase RPC
    ├── language.js           ← language detection
    ├── escalation.js         ← escalation triggers (11 rules)
    ├── prompt.js             ← system prompt builder
    ├── anthropic.js          ← Claude streaming call
    ├── logging.js            ← conversation_logs writer
    └── rateLimit.js          ← KV-based rate limiter
```
