/**
 * SpanishTax AI — Auth Modal
 * Injects a sign in / sign up modal into any page.
 * Also replaces the email gate in the mini-chat widget.
 *
 * Usage: <script src="/auth-modal.js" defer></script>
 * Then call: window.STXAuth.openSignIn() or window.STXAuth.openSignUp()
 */
(function () {
  'use strict';

  const SUPABASE_URL  = 'https://jxoepqwbalhdwwbycksa.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4b2VwcXdiYWxoZHd3Ynlja3NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NjQ1NDAsImV4cCI6MjA5NjQ0MDU0MH0.MRO1t5kZIfIw8HORTjEYvU_TUeri7ovXKSHKHRxnJJQ';

  // ─── Load Supabase if not already loaded ─────────────────────────────────
  function loadSupabase(cb) {
    if (window.supabase) return cb();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  // ─── Styles ──────────────────────────────────────────────────────────────
  const css = `
    #stx-auth-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(15,37,71,0.55);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      opacity: 0; pointer-events: none;
      transition: opacity 220ms;
    }
    #stx-auth-overlay.open { opacity: 1; pointer-events: auto; }
    #stx-auth-modal {
      background: white;
      border-radius: 14px;
      padding: 36px 32px;
      width: 100%; max-width: 420px;
      box-shadow: 0 16px 48px rgba(15,37,71,0.2);
      position: relative;
      transform: translateY(12px);
      transition: transform 220ms;
      font-family: 'Inter', -apple-system, sans-serif;
    }
    #stx-auth-overlay.open #stx-auth-modal { transform: translateY(0); }
    #stx-auth-close {
      position: absolute; top: 14px; right: 16px;
      background: none; border: none;
      font-size: 20px; color: #999; cursor: pointer; line-height: 1;
    }
    #stx-auth-close:hover { color: #C8553D; }
    .stx-auth-brand {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 19px; font-weight: 600; color: #0F2547;
      text-align: center; margin-bottom: 22px; display: block;
    }
    .stx-auth-brand::before {
      content: ''; display: inline-block;
      width: 7px; height: 7px;
      background: #C8553D; border-radius: 50%;
      margin-right: 8px; vertical-align: middle;
    }
    .stx-auth-tabs {
      display: flex; background: #F4F0E8;
      border-radius: 10px; padding: 4px; margin-bottom: 20px; gap: 4px;
    }
    .stx-auth-tab {
      flex: 1; padding: 8px;
      border: none; background: none; border-radius: 8px;
      font-family: inherit; font-size: 13px; font-weight: 500;
      color: #5D5D5D; cursor: pointer; transition: all 180ms;
    }
    .stx-auth-tab.active {
      background: white; color: #0F2547;
      box-shadow: 0 1px 4px rgba(15,37,71,0.1);
    }
    .stx-auth-view { display: none; }
    .stx-auth-view.active { display: block; }
    .stx-auth-group { margin-bottom: 14px; }
    .stx-auth-label {
      display: block; font-size: 12px; font-weight: 500;
      color: #0F2547; margin-bottom: 5px;
    }
    .stx-auth-input {
      width: 100%; padding: 10px 13px;
      border: 1px solid #E8E4DC; border-radius: 8px;
      font-family: inherit; font-size: 14px; color: #0F2547;
      background: #FAF8F4; transition: border-color 180ms, box-shadow 180ms;
    }
    .stx-auth-input:focus {
      outline: none; border-color: #C8553D;
      box-shadow: 0 0 0 3px rgba(200,85,61,0.12);
    }
    .stx-auth-hint { font-size: 11px; color: #5D5D5D; margin-top: 3px; }
    .stx-auth-reqs {
      background: #F4F0E8; border-radius: 8px;
      padding: 9px 11px; margin-top: 5px;
    }
    .stx-auth-reqs p { font-size: 11px; color: #5D5D5D; font-weight: 500; margin-bottom: 3px; }
    .stx-auth-req {
      font-size: 11px; color: #999;
      display: flex; align-items: center; gap: 5px; margin-bottom: 2px;
      transition: color 150ms;
    }
    .stx-auth-req.met { color: #2E7D32; }
    .stx-auth-req-dot {
      width: 5px; height: 5px; border-radius: 50%;
      background: #E8E4DC; flex-shrink: 0; transition: background 150ms;
    }
    .stx-auth-req.met .stx-auth-req-dot { background: #2E7D32; }
    .stx-auth-btn {
      width: 100%; padding: 12px;
      background: #C8553D; color: white;
      border: none; border-radius: 8px;
      font-family: inherit; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: background 180ms; margin-top: 4px;
    }
    .stx-auth-btn:hover { background: #A8412F; }
    .stx-auth-btn:disabled { background: #ccc; cursor: not-allowed; }
    .stx-auth-forgot {
      display: block; text-align: right;
      font-size: 12px; color: #999; text-decoration: none;
      margin-top: -8px; margin-bottom: 14px; cursor: pointer;
    }
    .stx-auth-forgot:hover { color: #C8553D; }
    .stx-auth-error {
      display: none; background: #FBF1F0;
      border: 1px solid #F0DAD5; color: #C8553D;
      font-size: 12px; padding: 9px 13px; border-radius: 8px;
      margin-bottom: 12px; line-height: 1.45;
    }
    .stx-auth-success {
      display: none; background: #E8F5E9;
      border: 1px solid #A5D6A7; color: #1B5E20;
      font-size: 12px; padding: 9px 13px; border-radius: 8px;
      margin-bottom: 12px; line-height: 1.45;
    }
    .stx-auth-back {
      display: block; text-align: center; margin-top: 16px;
      font-size: 12px; color: #999; cursor: pointer; background: none;
      border: 1px solid #E8E4DC; width: 100%; padding: 10px;
      border-radius: 8px; font-family: inherit; transition: all 150ms;
    }
    .stx-auth-back:hover { border-color: #0F2547; color: #0F2547; }
  `;

  // ─── HTML ─────────────────────────────────────────────────────────────────
  const html = `
  <div id="stx-auth-overlay">
    <div id="stx-auth-modal">
      <button id="stx-auth-close" onclick="window.STXAuth.close()">×</button>
      <span class="stx-auth-brand">SpanishTax AI</span>

      <div class="stx-auth-tabs">
        <button class="stx-auth-tab active" id="stx-tab-signin" onclick="window.STXAuth._showTab('signin')">Sign in</button>
        <button class="stx-auth-tab" id="stx-tab-signup" onclick="window.STXAuth._showTab('signup')">Create account</button>
      </div>

      <!-- Sign In -->
      <div class="stx-auth-view active" id="stx-view-signin">
        <div class="stx-auth-error" id="stx-signin-err"></div>
        <div class="stx-auth-group">
          <label class="stx-auth-label">Email</label>
          <input class="stx-auth-input" type="email" id="stx-signin-email" placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="stx-auth-group">
          <label class="stx-auth-label">Password</label>
          <input class="stx-auth-input" type="password" id="stx-signin-pw" placeholder="Your password" autocomplete="current-password">
        </div>
        <span class="stx-auth-forgot" onclick="window.STXAuth._showTab('forgot')">Forgot password?</span>
        <button class="stx-auth-btn" id="stx-signin-btn" onclick="window.STXAuth._signIn()">Sign in →</button>
      </div>

      <!-- Sign Up -->
      <div class="stx-auth-view" id="stx-view-signup">
        <div class="stx-auth-error" id="stx-signup-err"></div>
        <div class="stx-auth-success" id="stx-signup-ok"></div>
        <div class="stx-auth-group">
          <label class="stx-auth-label">Display name</label>
          <input class="stx-auth-input" type="text" id="stx-signup-name" placeholder="How should we address you?" maxlength="40">
          <div class="stx-auth-hint">Shown in your dashboard.</div>
        </div>
        <div class="stx-auth-group">
          <label class="stx-auth-label">Email</label>
          <input class="stx-auth-input" type="email" id="stx-signup-email" placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="stx-auth-group">
          <label class="stx-auth-label">Password</label>
          <input class="stx-auth-input" type="password" id="stx-signup-pw" placeholder="Create a strong password" autocomplete="new-password" oninput="window.STXAuth._checkPw(this.value)">
          <div class="stx-auth-reqs">
            <p>Password must include:</p>
            <div class="stx-auth-req" id="stx-req-len"><span class="stx-auth-req-dot"></span>7 to 20 characters</div>
            <div class="stx-auth-req" id="stx-req-upp"><span class="stx-auth-req-dot"></span>One uppercase letter (A–Z)</div>
            <div class="stx-auth-req" id="stx-req-num"><span class="stx-auth-req-dot"></span>One number (0–9)</div>
            <div class="stx-auth-req" id="stx-req-sym"><span class="stx-auth-req-dot"></span>One special character (!@#$%^&*)</div>
          </div>
        </div>
        <div class="stx-auth-group">
          <label class="stx-auth-label">Confirm password</label>
          <input class="stx-auth-input" type="password" id="stx-signup-confirm" placeholder="Repeat your password" autocomplete="new-password">
        </div>
        <button class="stx-auth-btn" id="stx-signup-btn" onclick="window.STXAuth._signUp()">Create account →</button>
      </div>

      <!-- Forgot -->
      <div class="stx-auth-view" id="stx-view-forgot">
        <div class="stx-auth-error" id="stx-forgot-err"></div>
        <div class="stx-auth-success" id="stx-forgot-ok"></div>
        <p style="font-size:13px;color:#5D5D5D;margin-bottom:16px;line-height:1.5;">Enter your email and we'll send a reset link.</p>
        <div class="stx-auth-group">
          <label class="stx-auth-label">Email</label>
          <input class="stx-auth-input" type="email" id="stx-forgot-email" placeholder="you@example.com">
        </div>
        <button class="stx-auth-btn" id="stx-forgot-btn" onclick="window.STXAuth._forgot()">Send reset link →</button>
        <button class="stx-auth-back" onclick="window.STXAuth._showTab('signin')">Back to sign in</button>
      </div>

    </div>
  </div>`;

  // ─── Public API ───────────────────────────────────────────────────────────
  window.STXAuth = {
    _sb: null,

    _init() {
      loadSupabase(() => {
        this._sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
      });
    },

    _inject() {
      if (document.getElementById('stx-auth-overlay')) return;
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
      document.body.insertAdjacentHTML('beforeend', html);
      // Close on overlay click
      document.getElementById('stx-auth-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'stx-auth-overlay') this.close();
      });
      // Keyboard
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.close();
        if (e.key !== 'Enter') return;
        const active = document.querySelector('.stx-auth-view.active');
        if (!active) return;
        if (active.id === 'stx-view-signin') this._signIn();
        else if (active.id === 'stx-view-signup') this._signUp();
        else if (active.id === 'stx-view-forgot') this._forgot();
      });
    },

    openSignIn() {
      this._inject();
      this._showTab('signin');
      document.getElementById('stx-auth-overlay').classList.add('open');
    },

    openSignUp() {
      this._inject();
      this._showTab('signup');
      document.getElementById('stx-auth-overlay').classList.add('open');
    },

    close() {
      const el = document.getElementById('stx-auth-overlay');
      if (el) el.classList.remove('open');
    },

    _showTab(tab) {
      ['signin','signup','forgot'].forEach(t => {
        document.getElementById('stx-view-' + t).classList.toggle('active', t === tab);
      });
      document.getElementById('stx-tab-signin').classList.toggle('active', tab === 'signin');
      document.getElementById('stx-tab-signup').classList.toggle('active', tab === 'signup');
      document.querySelectorAll('.stx-auth-error, .stx-auth-success').forEach(el => {
        el.style.display = 'none'; el.textContent = '';
      });
    },

    _showErr(id, msg) {
      const el = document.getElementById(id);
      el.textContent = msg; el.style.display = 'block';
    },

    _showOk(id, msg) {
      const el = document.getElementById(id);
      el.textContent = msg; el.style.display = 'block';
    },

    _validatePw(v) {
      return v.length >= 7 && v.length <= 20 &&
        /[A-Z]/.test(v) && /[0-9]/.test(v) &&
        /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>\/?]/.test(v);
    },

    _checkPw(v) {
      const reqs = {
        'stx-req-len': v.length >= 7 && v.length <= 20,
        'stx-req-upp': /[A-Z]/.test(v),
        'stx-req-num': /[0-9]/.test(v),
        'stx-req-sym': /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>\/?]/.test(v),
      };
      Object.entries(reqs).forEach(([id, met]) => {
        document.getElementById(id).classList.toggle('met', met);
      });
    },

    async _signIn() {
      const email = document.getElementById('stx-signin-email').value.trim();
      const pw    = document.getElementById('stx-signin-pw').value;
      const btn   = document.getElementById('stx-signin-btn');
      if (!email) return this._showErr('stx-signin-err', 'Please enter your email.');
      if (!pw)    return this._showErr('stx-signin-err', 'Please enter your password.');
      btn.disabled = true; btn.textContent = 'Signing in...';
      const { error } = await this._sb.auth.signInWithPassword({ email, password: pw });
      if (error) {
        btn.disabled = false; btn.textContent = 'Sign in →';
        return this._showErr('stx-signin-err', error.message.includes('Invalid') ? 'Incorrect email or password.' : error.message);
      }
      window.location.href = '/app.html';
    },

    async _signUp() {
      const name    = document.getElementById('stx-signup-name').value.trim();
      const email   = document.getElementById('stx-signup-email').value.trim();
      const pw      = document.getElementById('stx-signup-pw').value;
      const confirm = document.getElementById('stx-signup-confirm').value;
      const btn     = document.getElementById('stx-signup-btn');
      if (!name)  return this._showErr('stx-signup-err', 'Please enter a display name.');
      if (!email) return this._showErr('stx-signup-err', 'Please enter your email.');
      if (!this._validatePw(pw)) return this._showErr('stx-signup-err', 'Password does not meet the requirements.');
      if (pw !== confirm) return this._showErr('stx-signup-err', 'Passwords do not match.');
      btn.disabled = true; btn.textContent = 'Creating account...';
      const { error } = await this._sb.auth.signUp({ email, password: pw, options: { data: { display_name: name } } });
      if (error) {
        btn.disabled = false; btn.textContent = 'Create account →';
        return this._showErr('stx-signup-err', error.message.includes('already') ? 'Email already registered. Sign in instead.' : error.message);
      }
      const { error: e2 } = await this._sb.auth.signInWithPassword({ email, password: pw });
      if (e2) { btn.disabled = false; btn.textContent = 'Create account →'; return this._showOk('stx-signup-ok', 'Account created! Please sign in.'); }
      window.location.href = '/app.html';
    },

    async _forgot() {
      const email = document.getElementById('stx-forgot-email').value.trim();
      const btn   = document.getElementById('stx-forgot-btn');
      if (!email) return this._showErr('stx-forgot-err', 'Please enter your email.');
      btn.disabled = true; btn.textContent = 'Sending...';
      const { error } = await this._sb.auth.resetPasswordForEmail(email, { redirectTo: 'https://spanishtaxai.com/login.html' });
      btn.disabled = false; btn.textContent = 'Send reset link →';
      if (error) return this._showErr('stx-forgot-err', error.message);
      this._showOk('stx-forgot-ok', 'Reset link sent. Check your email.');
    },
  };

  // Init on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.STXAuth._init());
  } else {
    window.STXAuth._init();
  }
})();

