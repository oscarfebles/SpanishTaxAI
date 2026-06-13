/**
 * SpanishTax AI — Template Helper Script
 * Provides print, save, and copy functionality for fillable templates.
 */

(function () {
  'use strict';

  // ─── Print to PDF ─────────────────────────────────────────────────
  window.printDoc = function () {
    window.print();
  };

  // ─── Save fillable fields to localStorage (per template) ──────────
  function getTemplateId() {
    return document.body.dataset.templateId || window.location.pathname;
  }

  function saveState() {
    const fields = document.querySelectorAll('.fill[contenteditable="true"]');
    const state = {};
    fields.forEach((f, i) => {
      state['field_' + (f.dataset.field || i)] = f.innerText;
    });
    try {
      localStorage.setItem('stx_template_' + getTemplateId(), JSON.stringify(state));
    } catch (_) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem('stx_template_' + getTemplateId());
      if (!raw) return;
      const state = JSON.parse(raw);
      const fields = document.querySelectorAll('.fill[contenteditable="true"]');
      fields.forEach((f, i) => {
        const key = 'field_' + (f.dataset.field || i);
        if (state[key]) f.innerText = state[key];
      });
    } catch (_) {}
  }

  // ─── Copy plain text version of doc to clipboard ──────────────────
  window.copyDocText = function () {
    const doc = document.querySelector('.doc');
    if (!doc) return;
    const clone = doc.cloneNode(true);
    // Strip instruction blocks
    clone.querySelectorAll('.instruction, .warning').forEach((el) => el.remove());
    const text = clone.innerText.replace(/\n{3,}/g, '\n\n').trim();
    navigator.clipboard.writeText(text).then(
      () => {
        const btn = document.getElementById('copy-btn');
        if (btn) {
          const original = btn.innerText;
          btn.innerText = '✓ Copied';
          setTimeout(() => (btn.innerText = original), 2000);
        }
      },
      () => alert('Copy failed — please select and copy manually.')
    );
  };

  // ─── Init ─────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    loadState();
    const fields = document.querySelectorAll('.fill[contenteditable="true"]');
    fields.forEach((f) => {
      f.addEventListener('blur', saveState);
      f.addEventListener('input', saveState);
    });
  });
})();
