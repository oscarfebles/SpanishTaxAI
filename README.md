# SpanishTax AI — Landing Page

Production-ready single-page landing for **spanishtaxai.com**, an AI-powered bureaucracy companion for English-speaking expats in Spain.

A single `index.html` file with inline CSS/JS. Zero build step. Drag-and-drop deployable.

---

## ⚡ Quick start (local preview)

```bash
# Option 1: just open it
open index.html

# Option 2: serve locally (recommended for testing forms)
python3 -m http.server 8000
# → http://localhost:8000
```

---

## 🚀 Deploy to Cloudflare Pages

You have **two paths**: direct upload (fastest, 2 min) or Git-connected (recommended long-term).

### Path A — Direct upload (no Git needed)

1. Sign in at **https://dash.cloudflare.com** → left sidebar **Workers & Pages** → **Create** → **Pages** tab → **Upload assets**.
2. Project name: `spanishtaxai` → **Create project**.
3. Drag the `index.html` file (and `README.md` if you want) into the upload area → **Deploy site**.
4. Cloudflare gives you `spanishtaxai.pages.dev`. Open it to verify.

### Path B — Connect to a Git repo (recommended)

1. Push this folder to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial landing page"
   git remote add origin https://github.com/<your-user>/spanishtaxai.git
   git push -u origin main
   ```
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick the repo.
3. Build settings:
   - **Framework preset**: `None`
   - **Build command**: *(leave empty)*
   - **Build output directory**: `/`
4. **Save and deploy**. Every push to `main` will redeploy automatically.

### Attach your custom domain

1. In the Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter `spanishtaxai.com` (and add `www.spanishtaxai.com` as a second domain if you want both).
3. If your domain is already on Cloudflare DNS, it'll auto-configure. Otherwise, follow the CNAME instructions shown.
4. SSL is automatic. Give it 1–5 minutes.

---

## 📧 Email setup (you said `hello@spanishtaxai.com` forwards to your personal inbox — great)

You have two things to wire up:

### 1. The waitlist form (currently a placeholder)

The form posts to `https://formspree.io/f/PLACEHOLDER`. To make it real:

1. Sign up free at **https://formspree.io** with your `hello@spanishtaxai.com` (or personal) email.
2. Create a new form → it gives you an endpoint like `https://formspree.io/f/abc123xyz`.
3. Open `index.html`, search for `PLACEHOLDER`, replace with your form ID:
   ```html
   <form ... action="https://formspree.io/f/abc123xyz" method="POST" ...>
   ```
4. Submit a test from the live site. The first submission triggers Formspree's confirmation email.

> **Note**: the form currently shows the success message even on submission errors (so the page works before you wire Formspree). Once wired, real submissions will flow to your inbox.

**Alternatives if you outgrow Formspree's free tier (50 submissions/month):**
- **Cloudflare Pages Functions** + Resend or Postmark (free up to 3,000/mo, you keep full control)
- **Buttondown** or **ConvertKit** if you want a real newsletter from day one
- **MailerLite** free tier (1,000 subscribers, 12,000 emails/month)

### 2. Email forwarding for `hello@spanishtaxai.com`

You already have this set up — perfect. If you ever need to redo it on Cloudflare:
- DNS section of your domain → **Email** → **Email Routing** → enable → add `hello@spanishtaxai.com` → forward to your personal inbox.

---

## ✏️ The 5 things you should personalize before deploying

1. **`[LINKEDIN URL]`** in the founder section (around line ~1480 in `index.html`, search for `[LINKEDIN URL]`). Replace with your actual LinkedIn URL.
2. **`[Last Name]`** — search for `Oscar [Last Name]` and `Oscar [last name]` (appears twice: founder section and FAQ "Who's behind this") — replace with your real surname.
3. **Founder photo** — the founder block currently shows a `[FOUNDER PHOTO]` placeholder. To swap it for a real photo:
   - Add a file like `oscar.jpg` (square, ~600×600px) next to `index.html`.
   - Find the `<div class="founder-photo" ...></div>` line and replace it with:
     ```html
     <img class="founder-photo" src="oscar.jpg" alt="Oscar, founder of SpanishTax AI" />
     ```
   - Then in CSS, remove the `::before` pseudo-element on `.founder-photo` (or it'll overlay the photo). Easier: just delete the whole `.founder-photo::before { ... }` block.
4. **Formspree endpoint** — replace `PLACEHOLDER` in the form `action` attribute (covered above in section 1 of Email setup).
5. **Open Graph image** — the `<meta property="og:image">` points to `https://spanishtaxai.com/og.png`. Generate a 1200×630px share image and place it at the root of your deploy. Until you do, link previews on Twitter/LinkedIn will show a broken image.

### Nice-to-haves (optional)

- **Analytics**: add Cloudflare Web Analytics (free, privacy-first) — Pages project → **Web Analytics** tab → one click.
- **Real legal pages**: `/privacy`, `/terms`, `/gdpr` footer links currently 404. Generate basic versions at **https://www.iubenda.com** or **https://www.termsfeed.com**.
- **Brevia / FormSpark**: alternative form backends if you want to self-host the data.

---

## 🛠️ Tech notes

- **No build step.** Pure HTML + CSS + vanilla JS.
- **External dependencies** (loaded at runtime):
  - Google Fonts: Fraunces + Inter + Inter Tight + JetBrains Mono
  - Lucide Icons via unpkg CDN
  - Formspree (form submission only)
- **Responsive breakpoints**: 640px, 768px, 1024px.
- **Accessibility**: semantic HTML5, ARIA labels on interactive elements, keyboard-navigable, respects `prefers-reduced-motion`.
- **Performance**: ~78 KB HTML total. Fonts are the heaviest payload (~200 KB). Lighthouse should score 95+ on all metrics out of the box.

---

## 📁 File structure

```
spanishtaxai/
├── index.html      ← the whole site
└── README.md       ← this file
```

That's it. Ship it.

---

Built in Madrid with ☕
