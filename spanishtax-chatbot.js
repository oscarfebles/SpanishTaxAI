/**
 * SpanishTax AI — Chatbot Widget
 * ═══════════════════════════════════════════════════════════════════════════
 * Single-file widget. Drop into any page on spanishtaxai.com.
 *
 * Usage in HTML (just before </body>):
 *   <script src="/spanishtax-chatbot.js" defer></script>
 *
 * The widget self-bootstraps when DOMContentLoaded fires, injects its CSS,
 * mounts to <body>, and persists conversation state in localStorage.
 *
 * Dependencies: none. Works in all modern browsers (Chrome/Firefox/Safari/Edge).
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  // ─── Config (edit these if needed) ────────────────────────────────────
  const CONFIG = {
    // Worker endpoint. Change to your actual deployed URL.
    API_URL: 'https://spanishtax-chatbot.oscargonzalezfebles.workers.dev/chat',

    // localStorage keys
    STORAGE_KEY_SESSION: 'spanishtax_chat_session_id',
    STORAGE_KEY_HISTORY: 'spanishtax_chat_history',
    STORAGE_KEY_OPEN: 'spanishtax_chat_open',

    // UI strings
    BUTTON_LABEL: 'Ask SpanishTax AI',
    HEADER_TITLE: 'SpanishTax AI',
    HEADER_SUBTITLE: 'Built on the knowledge base of Oscar Gonzalez Febles, Spanish auditor in Madrid.',
    PLACEHOLDER: 'Ask about your DNV, autónomo, Beckham Law…',
    DISCLAIMER:
      "I'm an AI assistant trained on Oscar's knowledge base. I provide information, not binding legal or tax advice. For your specific case, email Oscar at support@spanishtaxai.com.",
    GREETING:
      "Hi 👋 I can help with Spain's Digital Nomad Visa, autónomo registration, Beckham Law, quarterly tax filings, and related paperwork. What's your situation?",
    ERROR_GENERIC: 'Something went wrong on our end. Please try again, or email Oscar at support@spanishtaxai.com.',
    ERROR_RATE_LIMIT: "You're sending messages too fast. Wait a moment and try again.",
    ERROR_HARD_LIMIT:
      "We've reached the end of this chat session. For deeper help, email Oscar at support@spanishtaxai.com.",

    // History length sent to server (last N message pairs)
    MAX_HISTORY_TURNS: 10,
  };

  // ─── State ────────────────────────────────────────────────────────────
  let isOpen = false;
  let isStreaming = false;
  let sessionId = null;
  let history = []; // [{role:'user'|'assistant', content:'...'}]

  // ─── Bootstrap ────────────────────────────────────────────────────────
  function init() {
    // Avoid double-mount if script is included twice
    if (window.__spanishtaxChatLoaded) return;
    window.__spanishtaxChatLoaded = true;

    sessionId = getOrCreateSessionId();
    history = loadHistory();

    injectStyles();
    mountWidget();
    bindEvents();
    restoreOpenState();
  }

  // ─── Session and history persistence ──────────────────────────────────
  function getOrCreateSessionId() {
    let id;
    try {
      id = localStorage.getItem(CONFIG.STORAGE_KEY_SESSION);
    } catch (_) {}
    if (!id) {
      id = 'sess_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
      try {
        localStorage.setItem(CONFIG.STORAGE_KEY_SESSION, id);
      } catch (_) {}
    }
    return id;
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY_HISTORY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY_HISTORY, JSON.stringify(history));
    } catch (_) {}
  }

  function restoreOpenState() {
    try {
      if (localStorage.getItem(CONFIG.STORAGE_KEY_OPEN) === '1') {
        openPanel();
      }
    } catch (_) {}
  }

  function saveOpenState(open) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY_OPEN, open ? '1' : '0');
    } catch (_) {}
  }

  // ─── Styles ───────────────────────────────────────────────────────────
  function injectStyles() {
    const css = `
      :root {
        --stx-bg: #FAF8F4;
        --stx-bg-alt: #F4F0E8;
        --stx-ink: #0F2547;
        --stx-ink-soft: #1E3358;
        --stx-muted: #5D5D5D;
        --stx-accent: #C8553D;
        --stx-accent-dark: #A8412F;
        --stx-accent-soft: #F4DDD6;
        --stx-line: #E8E4DC;
        --stx-sage: #7A9B76;
        --stx-sage-soft: #E4EBE2;
        --stx-shadow: 0 8px 32px rgba(15, 37, 71, 0.12);
        --stx-shadow-lg: 0 20px 48px rgba(15, 37, 71, 0.18);
        --stx-serif: 'Fraunces', Georgia, serif;
        --stx-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        --stx-ease: cubic-bezier(0.22, 1, 0.36, 1);
      }

      /* ─── Floating button ─────────────────────────────────────────── */
      .stx-btn {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999998;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 14px 20px 14px 16px;
        background: var(--stx-accent);
        color: #FFF8F4;
        font-family: var(--stx-sans);
        font-size: 15px;
        font-weight: 500;
        letter-spacing: -0.005em;
        border-radius: 100px;
        border: none;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(200, 85, 61, 0.32),
                    inset 0 1px 0 rgba(255, 255, 255, 0.18);
        transition: all 240ms var(--stx-ease);
      }
      .stx-btn:hover {
        background: var(--stx-accent-dark);
        transform: translateY(-2px);
        box-shadow: 0 12px 28px rgba(200, 85, 61, 0.38),
                    inset 0 1px 0 rgba(255, 255, 255, 0.18);
      }
      .stx-btn svg {
        width: 20px;
        height: 20px;
        stroke-width: 2;
      }
      .stx-btn.is-open {
        opacity: 0;
        pointer-events: none;
        transform: scale(0.8) translateY(20px);
      }

      /* ─── Chat panel ──────────────────────────────────────────────── */
      .stx-panel {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999999;
        width: min(420px, calc(100vw - 32px));
        height: min(640px, calc(100vh - 48px));
        background: var(--stx-bg);
        border-radius: 20px;
        box-shadow: var(--stx-shadow-lg);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        transform: scale(0.95) translateY(20px);
        pointer-events: none;
        transition: opacity 240ms var(--stx-ease),
                    transform 240ms var(--stx-ease);
        font-family: var(--stx-sans);
      }
      .stx-panel.is-open {
        opacity: 1;
        transform: scale(1) translateY(0);
        pointer-events: auto;
      }

      /* Paper grain texture coherent with landing */
      .stx-panel::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.06   0 0 0 0 0.15   0 0 0 0 0.28   0 0 0 0.045 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
        opacity: 0.4;
        mix-blend-mode: multiply;
      }
      .stx-panel > * {
        position: relative;
        z-index: 1;
      }

      /* ─── Header ──────────────────────────────────────────────────── */
      .stx-header {
        padding: 18px 56px 16px 20px;
        background: var(--stx-ink);
        color: var(--stx-bg);
        position: relative;
      }
      .stx-header-title {
        font-family: var(--stx-serif);
        font-size: 17px;
        font-weight: 600;
        letter-spacing: -0.005em;
        margin-bottom: 2px;
      }
      .stx-header-subtitle {
        font-size: 12px;
        color: rgba(250, 248, 244, 0.65);
        line-height: 1.4;
      }
      .stx-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 28px;
        height: 28px;
        border: none;
        background: rgba(250, 248, 244, 0.08);
        color: var(--stx-bg);
        border-radius: 8px;
        cursor: pointer;
        display: grid;
        place-items: center;
        transition: background 180ms var(--stx-ease);
      }
      .stx-close:hover {
        background: rgba(250, 248, 244, 0.18);
      }
      .stx-close svg {
        width: 16px;
        height: 16px;
        stroke-width: 2;
      }

      /* ─── Messages area ───────────────────────────────────────────── */
      .stx-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px 18px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        scroll-behavior: smooth;
      }
      .stx-messages::-webkit-scrollbar {
        width: 6px;
      }
      .stx-messages::-webkit-scrollbar-thumb {
        background: var(--stx-line);
        border-radius: 3px;
      }

      .stx-msg {
        display: flex;
        gap: 10px;
        animation: stxFadeUp 360ms var(--stx-ease) both;
      }
      @keyframes stxFadeUp {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .stx-msg.is-user {
        flex-direction: row-reverse;
      }
      .stx-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        font-size: 10px;
        font-weight: 600;
        margin-top: 2px;
      }
      .stx-msg.is-user .stx-avatar {
        background: var(--stx-bg-alt);
        color: var(--stx-ink);
      }
      .stx-msg.is-assistant .stx-avatar {
        background: var(--stx-ink);
        color: var(--stx-bg);
      }
      .stx-bubble {
        max-width: 78%;
        padding: 10px 14px;
        border-radius: 14px;
        font-size: 14px;
        line-height: 1.55;
        color: var(--stx-ink);
        word-wrap: break-word;
      }
      .stx-msg.is-user .stx-bubble {
        background: var(--stx-bg-alt);
        border-bottom-right-radius: 4px;
      }
      .stx-msg.is-assistant .stx-bubble {
        background: #FBF6EE;
        border: 1px solid var(--stx-line);
        border-bottom-left-radius: 4px;
      }
      .stx-bubble a {
        color: var(--stx-accent);
        text-decoration: underline;
        text-decoration-color: var(--stx-accent-soft);
        text-underline-offset: 2px;
      }
      .stx-bubble strong {
        font-weight: 600;
      }
      .stx-bubble em {
        font-style: italic;
        color: var(--stx-muted);
      }
      .stx-bubble p {
        margin: 0 0 8px;
      }
      .stx-bubble p:last-child {
        margin-bottom: 0;
      }
      .stx-bubble ul, .stx-bubble ol {
        margin: 6px 0;
        padding-left: 20px;
      }
      .stx-bubble li {
        margin-bottom: 2px;
      }

      /* Typing indicator */
      .stx-typing {
        display: inline-flex;
        gap: 4px;
        padding: 2px 0;
      }
      .stx-typing span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--stx-muted);
        animation: stxTyping 1.4s infinite;
      }
      .stx-typing span:nth-child(2) { animation-delay: 200ms; }
      .stx-typing span:nth-child(3) { animation-delay: 400ms; }
      @keyframes stxTyping {
        0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
        30% { opacity: 1; transform: translateY(-3px); }
      }

      /* ─── Disclaimer banner (first time) ──────────────────────────── */
      .stx-disclaimer {
        margin: 0 18px 4px;
        padding: 10px 12px;
        background: var(--stx-bg-alt);
        border: 1px solid var(--stx-line);
        border-radius: 10px;
        font-size: 12px;
        line-height: 1.5;
        color: var(--stx-muted);
      }

      /* ─── Input area ──────────────────────────────────────────────── */
      .stx-input-wrap {
        padding: 14px 16px 16px;
        border-top: 1px solid var(--stx-line);
        background: var(--stx-bg);
      }
      .stx-input-row {
        display: flex;
        gap: 8px;
        align-items: flex-end;
        background: white;
        border: 1px solid var(--stx-line);
        border-radius: 14px;
        padding: 8px 8px 8px 14px;
        transition: border-color 200ms var(--stx-ease);
      }
      .stx-input-row:focus-within {
        border-color: var(--stx-accent);
      }
      .stx-textarea {
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        font-family: var(--stx-sans);
        font-size: 14px;
        line-height: 1.5;
        color: var(--stx-ink);
        resize: none;
        min-height: 22px;
        max-height: 140px;
        padding: 4px 0;
      }
      .stx-textarea::placeholder {
        color: #A8A39B;
      }
      .stx-send {
        width: 34px;
        height: 34px;
        border: none;
        background: var(--stx-accent);
        color: white;
        border-radius: 10px;
        cursor: pointer;
        display: grid;
        place-items: center;
        flex-shrink: 0;
        transition: all 180ms var(--stx-ease);
      }
      .stx-send:hover:not(:disabled) {
        background: var(--stx-accent-dark);
      }
      .stx-send:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .stx-send svg {
        width: 16px;
        height: 16px;
        stroke-width: 2.2;
      }

      .stx-footer {
        margin-top: 8px;
        font-size: 11px;
        color: var(--stx-muted);
        text-align: center;
        letter-spacing: 0.01em;
      }
      .stx-footer a {
        color: var(--stx-muted);
        text-decoration: underline;
      }

      /* ─── Error message ───────────────────────────────────────────── */
      .stx-error {
        background: #FBF1F0;
        border: 1px solid #F0DAD5;
        color: var(--stx-accent);
      }

      /* ─── Paywall (tier cards after gate hit) ──────────────────────── */
      .stx-paywall {
        max-width: 100%;
        background: #FBF6EE;
        border: 1px solid var(--stx-line);
      }
      .stx-paywall-heading {
        font-family: var(--stx-serif);
        font-size: 15px;
        font-weight: 600;
        color: var(--stx-ink);
        margin-bottom: 4px;
        letter-spacing: -0.005em;
      }
      .stx-paywall-sub {
        font-size: 13px;
        color: var(--stx-muted);
        margin-bottom: 12px;
      }
      .stx-tiers {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 10px;
      }
      .stx-tier {
        display: block;
        position: relative;
        padding: 10px 12px;
        background: white;
        border: 1px solid var(--stx-line);
        border-radius: 10px;
        text-decoration: none;
        color: var(--stx-ink);
        transition: all 180ms var(--stx-ease);
      }
      .stx-tier:hover {
        border-color: var(--stx-accent);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(200, 85, 61, 0.10);
      }
      .stx-tier.is-recommended {
        border-color: var(--stx-accent);
        background: #FFFBF7;
      }
      .stx-tier-badge {
        position: absolute;
        top: -7px;
        right: 10px;
        background: var(--stx-accent);
        color: white;
        font-size: 9px;
        font-weight: 600;
        letter-spacing: 0.04em;
        padding: 2px 6px;
        border-radius: 100px;
        text-transform: uppercase;
      }
      .stx-tier-name {
        font-family: var(--stx-serif);
        font-size: 13px;
        font-weight: 600;
        color: var(--stx-ink);
        margin-bottom: 2px;
      }
      .stx-tier-price {
        font-size: 13px;
        margin-bottom: 3px;
      }
      .stx-tier-amount {
        font-weight: 600;
        color: var(--stx-accent);
      }
      .stx-tier-billing {
        color: var(--stx-muted);
        font-size: 11px;
        margin-left: 2px;
      }
      .stx-tier-tagline {
        font-size: 11px;
        color: var(--stx-muted);
        line-height: 1.45;
      }
      .stx-paywall-footer {
        font-size: 11px;
        color: var(--stx-muted);
        text-align: center;
        padding-top: 8px;
        border-top: 1px solid var(--stx-line);
      }

      /* ─── Mobile adjustments ──────────────────────────────────────── */
      @media (max-width: 480px) {
        .stx-btn {
          bottom: 16px;
          right: 16px;
          padding: 12px 18px 12px 14px;
          font-size: 14px;
        }
        .stx-panel {
          bottom: 0;
          right: 0;
          left: 0;
          width: 100%;
          height: 100%;
          max-height: 100vh;
          border-radius: 0;
        }
      }
    `;

    const style = document.createElement('style');
    style.id = 'spanishtax-chat-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── DOM construction ─────────────────────────────────────────────────
  function mountWidget() {
    // Floating button
    const btn = document.createElement('button');
    btn.id = 'stx-launcher';
    btn.className = 'stx-btn';
    btn.setAttribute('aria-label', 'Open chat');
    btn.innerHTML = `
      ${chatIconSvg()}
      <span>${CONFIG.BUTTON_LABEL}</span>
    `;
    document.body.appendChild(btn);

    // Chat panel
    const panel = document.createElement('div');
    panel.id = 'stx-panel';
    panel.className = 'stx-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'stx-header-title');
    panel.innerHTML = `
      <header class="stx-header">
        <div class="stx-header-title" id="stx-header-title">${CONFIG.HEADER_TITLE}</div>
        <div class="stx-header-subtitle">${CONFIG.HEADER_SUBTITLE}</div>
        <button class="stx-close" id="stx-close" aria-label="Close chat">
          ${closeIconSvg()}
        </button>
      </header>

      <div class="stx-messages" id="stx-messages" aria-live="polite"></div>

      <div class="stx-disclaimer" id="stx-disclaimer">${CONFIG.DISCLAIMER}</div>

      <div class="stx-input-wrap">
        <div class="stx-input-row">
          <textarea
            class="stx-textarea"
            id="stx-textarea"
            rows="1"
            placeholder="${CONFIG.PLACEHOLDER}"
            aria-label="Type your question"
          ></textarea>
          <button class="stx-send" id="stx-send" aria-label="Send message" disabled>
            ${sendIconSvg()}
          </button>
        </div>
        <div class="stx-footer">
          AI assistant · Not legal advice · <a href="/contact.html">Contact</a>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Render existing history (if any) or greeting
    if (history.length === 0) {
      renderMessage('assistant', CONFIG.GREETING);
    } else {
      for (const msg of history) {
        renderMessage(msg.role, msg.content);
      }
    }
  }

  // ─── Event bindings ───────────────────────────────────────────────────
  function bindEvents() {
    const btn = document.getElementById('stx-launcher');
    const closeBtn = document.getElementById('stx-close');
    const textarea = document.getElementById('stx-textarea');
    const sendBtn = document.getElementById('stx-send');

    btn.addEventListener('click', openPanel);
    closeBtn.addEventListener('click', closePanel);

    // Enable send button when there's text
    textarea.addEventListener('input', () => {
      sendBtn.disabled = textarea.value.trim().length === 0 || isStreaming;
      autoResize(textarea);
    });

    // Enter to send, Shift+Enter for newline
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) sendMessage();
      }
    });

    sendBtn.addEventListener('click', sendMessage);

    // Close panel on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) closePanel();
    });
  }

  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
  }

  // ─── Open/close ───────────────────────────────────────────────────────
  function openPanel() {
    const btn = document.getElementById('stx-launcher');
    const panel = document.getElementById('stx-panel');
    if (!btn || !panel) return;

    btn.classList.add('is-open');
    panel.classList.add('is-open');
    isOpen = true;
    saveOpenState(true);

    // Focus textarea after transition
    setTimeout(() => {
      const textarea = document.getElementById('stx-textarea');
      if (textarea) textarea.focus();
      scrollToBottom();
    }, 260);
  }

  function closePanel() {
    const btn = document.getElementById('stx-launcher');
    const panel = document.getElementById('stx-panel');
    if (!btn || !panel) return;

    panel.classList.remove('is-open');
    btn.classList.remove('is-open');
    isOpen = false;
    saveOpenState(false);
  }

  // ─── Send message + stream response ───────────────────────────────────
  async function sendMessage() {
    if (isStreaming) return;

    const textarea = document.getElementById('stx-textarea');
    const sendBtn = document.getElementById('stx-send');
    const message = textarea.value.trim();
    if (!message) return;

    // Clear textarea, lock UI
    textarea.value = '';
    textarea.style.height = 'auto';
    sendBtn.disabled = true;
    isStreaming = true;

    // Build payload BEFORE pushing the user message to history.
    // The Worker expects: messages = [...history, {role:'user', content:message}].
    // So we send `history` as-is (without the current message), and Worker appends it.
    const recentHistory = history.slice(-CONFIG.MAX_HISTORY_TURNS * 2);

    // Render user message and persist it locally
    renderMessage('user', message);
    history.push({ role: 'user', content: message });
    saveHistory();

    // Show typing indicator
    const typingEl = renderTyping();

    let assistantBubble = null;
    let assistantText = '';

    try {
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message,
          history: recentHistory,
        }),
      });

      // Remove typing indicator
      typingEl.remove();

      if (!res.ok) {
        // Special case: HTTP 402 = paywall payload (not an error, render tier cards)
        if (res.status === 402) {
          try {
            const paywallData = await res.json();
            if (paywallData?.type === 'paywall') {
              renderPaywall(paywallData);
              return;
            }
          } catch (_) {
            // fall through to generic error
          }
        }

        // Try to parse JSON error
        let code = 'unknown';
        try {
          const errBody = await res.json();
          code = errBody?.error?.code || 'unknown';
        } catch (_) {}

        if (res.status === 429) {
          renderError(CONFIG.ERROR_RATE_LIMIT);
        } else if (res.status === 403 && code === 'session_exhausted') {
          renderError(CONFIG.ERROR_HARD_LIMIT);
        } else {
          renderError(CONFIG.ERROR_GENERIC);
        }
        return;
      }

      // Stream the response
      assistantBubble = renderMessage('assistant', '');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events (separated by \n\n)
        const events = buffer.split('\n\n');
        buffer = events.pop(); // keep incomplete event in buffer

        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data) continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                const delta = parsed.delta.text || '';
                assistantText += delta;
                updateBubble(assistantBubble, assistantText);
                scrollToBottom();
              }
            } catch (_) {
              // Non-JSON SSE line, ignore
            }
          }
        }
      }

      // Persist final assistant message
      if (assistantText.trim().length > 0) {
        history.push({ role: 'assistant', content: assistantText });
        saveHistory();
      } else {
        // No content received — show fallback error
        if (assistantBubble) assistantBubble.parentElement.remove();
        renderError(CONFIG.ERROR_GENERIC);
      }
    } catch (err) {
      console.error('Chat request failed:', err);
      typingEl.remove();
      if (assistantBubble && assistantText.length === 0) {
        assistantBubble.parentElement.remove();
      }
      renderError(CONFIG.ERROR_GENERIC);
    } finally {
      isStreaming = false;
      sendBtn.disabled = textarea.value.trim().length === 0;
      textarea.focus();
    }
  }

  // ─── Rendering helpers ────────────────────────────────────────────────
  function renderMessage(role, content) {
    const messagesEl = document.getElementById('stx-messages');
    const msg = document.createElement('div');
    msg.className = `stx-msg is-${role}`;
    msg.innerHTML = `
      <div class="stx-avatar">${role === 'user' ? 'You' : 'ST'}</div>
      <div class="stx-bubble">${formatContent(content)}</div>
    `;
    messagesEl.appendChild(msg);
    scrollToBottom();
    return msg.querySelector('.stx-bubble');
  }

  function renderTyping() {
    const messagesEl = document.getElementById('stx-messages');
    const msg = document.createElement('div');
    msg.className = 'stx-msg is-assistant';
    msg.innerHTML = `
      <div class="stx-avatar">ST</div>
      <div class="stx-bubble">
        <div class="stx-typing"><span></span><span></span><span></span></div>
      </div>
    `;
    messagesEl.appendChild(msg);
    scrollToBottom();
    return msg;
  }

  function renderError(text) {
    const messagesEl = document.getElementById('stx-messages');
    const msg = document.createElement('div');
    msg.className = 'stx-msg is-assistant';
    msg.innerHTML = `
      <div class="stx-avatar">!</div>
      <div class="stx-bubble stx-error">${formatContent(text)}</div>
    `;
    messagesEl.appendChild(msg);
    scrollToBottom();
  }

  /**
   * Renders the paywall payload as tier cards.
   * Called when Worker returns HTTP 402 with {type: 'paywall', tiers: [...]}
   */
  function renderPaywall(paywallData) {
    const messagesEl = document.getElementById('stx-messages');
    const wrapper = document.createElement('div');
    wrapper.className = 'stx-msg is-assistant';

    const tiersHtml = paywallData.tiers.map((tier) => `
      <a class="stx-tier ${tier.recommended ? 'is-recommended' : ''}" href="${tier.url}" target="_blank" rel="noopener">
        ${tier.recommended ? '<div class="stx-tier-badge">Most chosen</div>' : ''}
        <div class="stx-tier-name">${escapeHtml(tier.name)}</div>
        <div class="stx-tier-price">
          <span class="stx-tier-amount">${escapeHtml(tier.price)}</span>
          <span class="stx-tier-billing">${escapeHtml(tier.billing)}</span>
        </div>
        <div class="stx-tier-tagline">${escapeHtml(tier.tagline)}</div>
      </a>
    `).join('');

    wrapper.innerHTML = `
      <div class="stx-avatar">ST</div>
      <div class="stx-bubble stx-paywall">
        <div class="stx-paywall-heading">${escapeHtml(paywallData.message)}</div>
        <div class="stx-paywall-sub">Choose a plan to continue chatting:</div>
        <div class="stx-tiers">
          ${tiersHtml}
        </div>
        <div class="stx-paywall-footer">${escapeHtml(paywallData.footer)}</div>
      </div>
    `;

    messagesEl.appendChild(wrapper);
    scrollToBottom();
  }

  function escapeHtml(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function updateBubble(bubbleEl, text) {
    bubbleEl.innerHTML = formatContent(text);
  }

  /**
   * Light Markdown-to-HTML formatter.
   * Handles: **bold**, *italic*, line breaks, paragraphs, links, bullet/numbered lists.
   * Does NOT handle: code blocks, tables, images (not needed for this chatbot).
   */
  function formatContent(text) {
    if (!text) return '';

    // Escape HTML first
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Links: [text](url) and bare URLs
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/(?<!["'>])(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

    // Bold and italic (process bold first to avoid conflict with italic)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Split into paragraphs by blank lines
    const paragraphs = html.split(/\n\s*\n/);
    const processed = paragraphs.map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return '';

      // Detect bullet list
      if (/^[-*]\s/.test(trimmed)) {
        const items = trimmed.split('\n').filter((l) => /^[-*]\s/.test(l.trim()));
        const lis = items.map((i) => '<li>' + i.replace(/^[-*]\s+/, '').trim() + '</li>').join('');
        return '<ul>' + lis + '</ul>';
      }

      // Detect numbered list
      if (/^\d+\.\s/.test(trimmed)) {
        const items = trimmed.split('\n').filter((l) => /^\d+\.\s/.test(l.trim()));
        const lis = items.map((i) => '<li>' + i.replace(/^\d+\.\s+/, '').trim() + '</li>').join('');
        return '<ol>' + lis + '</ol>';
      }

      // Plain paragraph (single line breaks → <br>)
      return '<p>' + trimmed.replace(/\n/g, '<br>') + '</p>';
    });

    return processed.join('');
  }

  function scrollToBottom() {
    const messagesEl = document.getElementById('stx-messages');
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  // ─── Icon SVGs ────────────────────────────────────────────────────────
  function chatIconSvg() {
    return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
    </svg>`;
  }
  function closeIconSvg() {
    return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
    </svg>`;
  }
  function sendIconSvg() {
    return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M5 12l14-7-7 14-2-5-5-2z"/>
    </svg>`;
  }

  // ─── Public API (for debugging / future extensions) ───────────────────
  window.SpanishTaxChat = {
    open: openPanel,
    close: closePanel,
    reset: () => {
      try {
        localStorage.removeItem(CONFIG.STORAGE_KEY_SESSION);
        localStorage.removeItem(CONFIG.STORAGE_KEY_HISTORY);
        localStorage.removeItem(CONFIG.STORAGE_KEY_OPEN);
      } catch (_) {}
      location.reload();
    },
  };

  // ─── Boot ─────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
