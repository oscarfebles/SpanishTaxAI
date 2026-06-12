/**
 * SpanishTax AI — GDPR Cookie Banner
 * ════════════════════════════════════════════════════════════════════
 * Drop-in script for cookie consent. Self-bootstraps on DOMContentLoaded.
 *
 * Usage in HTML (just before </body>):
 *   <script src="/cookie-banner.js" defer></script>
 *
 * Design principles:
 *   - Privacy-by-default: analytics cookies disabled until user opts in
 *   - Granular: user can accept all, reject non-essential, or customize
 *   - Persistent: choice stored 12 months in localStorage (per AEPD)
 *   - Non-blocking: banner appears at bottom, never overlays content
 *   - Re-openable: triggers if `window.openCookieSettings()` is called
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'stx_cookie_consent';
  const CONSENT_EXPIRY_DAYS = 365; // 12 months per AEPD

  // ─── State ───────────────────────────────────────────────────────────
  let currentConsent = loadConsent();

  // ─── Helpers ─────────────────────────────────────────────────────────
  function loadConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Check expiry
      if (parsed.expires && new Date(parsed.expires) < new Date()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function saveConsent(consent) {
    const expires = new Date();
    expires.setDate(expires.getDate() + CONSENT_EXPIRY_DAYS);
    const payload = {
      ...consent,
      timestamp: new Date().toISOString(),
      expires: expires.toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {}
    currentConsent = payload;
    applyConsent(payload);
  }

  function applyConsent(consent) {
    // Hook for future analytics activation (Cloudflare Web Analytics is currently cookieless)
    if (consent.analytics) {
      // Future: enable analytics scripts here
      window.dispatchEvent(new CustomEvent('stx-consent-analytics-granted'));
    }
    // Hook for future marketing
    if (consent.marketing) {
      window.dispatchEvent(new CustomEvent('stx-consent-marketing-granted'));
    }
  }

  // ─── Styles ──────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('stx-cookie-banner-styles')) return;
    const css = `
      .stx-cookie-banner {
        position: fixed;
        bottom: 16px;
        left: 16px;
        right: 16px;
        max-width: 720px;
        margin: 0 auto;
        background: #FAF8F4;
        border: 1px solid #E8E4DC;
        border-radius: 14px;
        box-shadow: 0 12px 36px rgba(15, 37, 71, 0.15);
        padding: 18px 20px;
        z-index: 1000000;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        color: #1E3358;
        line-height: 1.5;
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 280ms cubic-bezier(0.22, 1, 0.36, 1),
                    transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .stx-cookie-banner.is-visible {
        opacity: 1;
        transform: translateY(0);
      }
      .stx-cookie-banner-content {
        margin-bottom: 14px;
      }
      .stx-cookie-banner-content strong {
        font-family: 'Fraunces', Georgia, serif;
        font-weight: 600;
        font-size: 15px;
        color: #0F2547;
        display: block;
        margin-bottom: 4px;
      }
      .stx-cookie-banner-content a {
        color: #C8553D;
        text-decoration: underline;
        text-decoration-color: rgba(200, 85, 61, 0.3);
        text-underline-offset: 2px;
      }
      .stx-cookie-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
        align-items: center;
      }
      .stx-cookie-btn {
        font-family: inherit;
        font-size: 13px;
        font-weight: 500;
        padding: 8px 14px;
        border-radius: 8px;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 180ms;
      }
      .stx-cookie-btn-primary {
        background: #C8553D;
        color: #FFF8F4;
      }
      .stx-cookie-btn-primary:hover {
        background: #A8412F;
      }
      .stx-cookie-btn-secondary {
        background: transparent;
        color: #1E3358;
        border-color: #E8E4DC;
      }
      .stx-cookie-btn-secondary:hover {
        background: #F4F0E8;
      }
      .stx-cookie-btn-link {
        background: transparent;
        color: #5D5D5D;
        border: none;
        text-decoration: underline;
        text-decoration-color: rgba(93, 93, 93, 0.4);
        padding: 8px 6px;
      }
      .stx-cookie-btn-link:hover {
        color: #C8553D;
      }

      /* Granular modal */
      .stx-cookie-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 37, 71, 0.5);
        z-index: 1000001;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 200ms;
      }
      .stx-cookie-modal-overlay.is-visible {
        opacity: 1;
        pointer-events: auto;
      }
      .stx-cookie-modal {
        background: #FAF8F4;
        border-radius: 16px;
        padding: 28px;
        max-width: 520px;
        width: 100%;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 24px 60px rgba(15, 37, 71, 0.25);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        color: #1E3358;
      }
      .stx-cookie-modal h3 {
        font-family: 'Fraunces', Georgia, serif;
        font-size: 22px;
        font-weight: 600;
        color: #0F2547;
        margin-bottom: 8px;
      }
      .stx-cookie-modal p {
        font-size: 14px;
        line-height: 1.55;
        margin-bottom: 20px;
        color: #5D5D5D;
      }
      .stx-cookie-category {
        background: white;
        border: 1px solid #E8E4DC;
        border-radius: 10px;
        padding: 14px 16px;
        margin-bottom: 12px;
      }
      .stx-cookie-category-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      }
      .stx-cookie-category-name {
        font-weight: 600;
        font-size: 14px;
        color: #0F2547;
      }
      .stx-cookie-category-desc {
        font-size: 12px;
        color: #5D5D5D;
        line-height: 1.5;
      }
      .stx-cookie-toggle {
        position: relative;
        width: 38px;
        height: 22px;
        background: #E8E4DC;
        border-radius: 22px;
        cursor: pointer;
        transition: background 180ms;
        flex-shrink: 0;
      }
      .stx-cookie-toggle.is-on {
        background: #C8553D;
      }
      .stx-cookie-toggle.is-disabled {
        background: #7A9B76;
        cursor: not-allowed;
        opacity: 0.85;
      }
      .stx-cookie-toggle::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 18px;
        height: 18px;
        background: white;
        border-radius: 50%;
        transition: transform 180ms;
      }
      .stx-cookie-toggle.is-on::after,
      .stx-cookie-toggle.is-disabled::after {
        transform: translateX(16px);
      }
      .stx-cookie-modal-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 18px;
      }

      @media (max-width: 600px) {
        .stx-cookie-banner {
          left: 8px;
          right: 8px;
          bottom: 8px;
          padding: 16px;
        }
        .stx-cookie-actions {
          justify-content: stretch;
        }
        .stx-cookie-btn {
          flex: 1;
          text-align: center;
        }
      }
    `;
    const style = document.createElement('style');
    style.id = 'stx-cookie-banner-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Banner UI ───────────────────────────────────────────────────────
  function showBanner() {
    if (document.getElementById('stx-cookie-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'stx-cookie-banner';
    banner.className = 'stx-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML = `
      <div class="stx-cookie-banner-content">
        <strong>We respect your privacy</strong>
        We use strictly necessary cookies to run the chatbot and keep your session. Optionally,
        anonymous analytics help us improve. Read our
        <a href="/cookies.html">Cookie Policy</a> and <a href="/privacy.html">Privacy Policy</a>.
      </div>
      <div class="stx-cookie-actions">
        <button class="stx-cookie-btn stx-cookie-btn-link" id="stx-cookie-customize">Customize</button>
        <button class="stx-cookie-btn stx-cookie-btn-secondary" id="stx-cookie-reject">Necessary only</button>
        <button class="stx-cookie-btn stx-cookie-btn-primary" id="stx-cookie-accept">Accept all</button>
      </div>
    `;
    document.body.appendChild(banner);

    // Trigger visible transition
    requestAnimationFrame(() => banner.classList.add('is-visible'));

    document.getElementById('stx-cookie-accept').addEventListener('click', () => {
      saveConsent({ necessary: true, analytics: true, marketing: false });
      hideBanner();
    });

    document.getElementById('stx-cookie-reject').addEventListener('click', () => {
      saveConsent({ necessary: true, analytics: false, marketing: false });
      hideBanner();
    });

    document.getElementById('stx-cookie-customize').addEventListener('click', () => {
      showCustomizeModal();
    });
  }

  function hideBanner() {
    const banner = document.getElementById('stx-cookie-banner');
    if (!banner) return;
    banner.classList.remove('is-visible');
    setTimeout(() => banner.remove(), 280);
  }

  // ─── Customize modal ─────────────────────────────────────────────────
  function showCustomizeModal() {
    hideBanner();
    if (document.getElementById('stx-cookie-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'stx-cookie-modal-overlay';
    overlay.className = 'stx-cookie-modal-overlay';
    overlay.innerHTML = `
      <div class="stx-cookie-modal" role="dialog" aria-label="Cookie preferences">
        <h3>Cookie preferences</h3>
        <p>Choose which cookies you allow. Your choice is saved for 12 months.</p>

        <div class="stx-cookie-category">
          <div class="stx-cookie-category-header">
            <span class="stx-cookie-category-name">Strictly necessary</span>
            <div class="stx-cookie-toggle is-disabled" aria-label="Always on" title="Required for site to function"></div>
          </div>
          <p class="stx-cookie-category-desc">Required for the chatbot, session persistence, and security. Cannot be disabled.</p>
        </div>

        <div class="stx-cookie-category">
          <div class="stx-cookie-category-header">
            <span class="stx-cookie-category-name">Analytics</span>
            <div class="stx-cookie-toggle ${currentConsent?.analytics ? 'is-on' : ''}" id="stx-toggle-analytics" role="switch" aria-checked="${currentConsent?.analytics ? 'true' : 'false'}" tabindex="0"></div>
          </div>
          <p class="stx-cookie-category-desc">Anonymous usage statistics via Cloudflare Web Analytics. No individual identifiers.</p>
        </div>

        <div class="stx-cookie-category">
          <div class="stx-cookie-category-header">
            <span class="stx-cookie-category-name">Marketing</span>
            <div class="stx-cookie-toggle ${currentConsent?.marketing ? 'is-on' : ''}" id="stx-toggle-marketing" role="switch" aria-checked="${currentConsent?.marketing ? 'true' : 'false'}" tabindex="0"></div>
          </div>
          <p class="stx-cookie-category-desc">Currently not used. Reserved for future opt-in to retargeting/ads.</p>
        </div>

        <div class="stx-cookie-modal-actions">
          <button class="stx-cookie-btn stx-cookie-btn-secondary" id="stx-cookie-cancel">Cancel</button>
          <button class="stx-cookie-btn stx-cookie-btn-primary" id="stx-cookie-save">Save preferences</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('is-visible'));

    const toggleAnalytics = document.getElementById('stx-toggle-analytics');
    const toggleMarketing = document.getElementById('stx-toggle-marketing');

    [toggleAnalytics, toggleMarketing].forEach((toggle) => {
      const handler = () => {
        toggle.classList.toggle('is-on');
        toggle.setAttribute('aria-checked', toggle.classList.contains('is-on') ? 'true' : 'false');
      };
      toggle.addEventListener('click', handler);
      toggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handler();
        }
      });
    });

    document.getElementById('stx-cookie-cancel').addEventListener('click', () => {
      hideModal();
      showBanner();
    });

    document.getElementById('stx-cookie-save').addEventListener('click', () => {
      saveConsent({
        necessary: true,
        analytics: toggleAnalytics.classList.contains('is-on'),
        marketing: toggleMarketing.classList.contains('is-on'),
      });
      hideModal();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        hideModal();
        showBanner();
      }
    });
  }

  function hideModal() {
    const overlay = document.getElementById('stx-cookie-modal-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    setTimeout(() => overlay.remove(), 200);
  }

  // ─── Public API ──────────────────────────────────────────────────────
  window.openCookieSettings = function () {
    showCustomizeModal();
  };

  window.getCookieConsent = function () {
    return currentConsent ? { ...currentConsent } : null;
  };

  // ─── Init ────────────────────────────────────────────────────────────
  function init() {
    if (window.__stxCookieBannerLoaded) return;
    window.__stxCookieBannerLoaded = true;

    injectStyles();

    if (!currentConsent) {
      // First-time visitor — show banner
      showBanner();
    } else {
      // Returning visitor — apply existing consent silently
      applyConsent(currentConsent);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
