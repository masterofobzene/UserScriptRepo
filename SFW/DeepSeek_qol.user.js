// ==UserScript==
// @name         DeepSeek QoL
// @namespace    DeepSeek_qol
// @version      1.0
// @author       masterofobzene
// @description  Selection fix + no-wrap code + auto-collapse thinking + "be concise" + "never use chinese"
// @match        https://chat.deepseek.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @license      GNU GPLv3
// @icon         https://deepseek.com/favicon.ico
// @homepage     https://github.com/masterofobzene/UserScriptRepo
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/DeepSeek_qol.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/DeepSeek_qol.user.js
// ==/UserScript==

(() => {
  'use strict';

  /* ============ 1. SELECTION FIX (v4) ============ */
  const CSS = `
    pre, pre *, code, code * {
      -webkit-user-select: text !important;
      user-select: text !important;
      -webkit-user-drag: none !important;
    }
    pre, code { cursor: text !important; }
    pre span, pre a, pre b, pre i, pre em, pre strong,
    code span, code a, code b, code i, code em, code strong {
      display: inline !important;
      position: static !important;
      float: none !important;
      transform: none !important;
      vertical-align: baseline !important;
    }
    pre, pre > code, code,
    .md-code-block, .md-code-block pre, .md-code-block code,
    [class*="code"] pre, [class*="code"] code {
      display: block !important;
      white-space: pre !important;
      word-break: normal !important;
      overflow-wrap: normal !important;
      overflow-x: auto !important;
      tab-size: 4 !important;
    }
    pre svg, pre button, pre img, pre [role="button"],
    pre [aria-hidden="true"], pre [contenteditable="true"],
    pre [class*="copy" i], pre [class*="header" i], pre [class*="lang" i],
    pre [class*="toolbar" i], pre [class*="gutter" i],
    pre [class*="line-number" i], pre [class*="linenumber" i] {
      pointer-events: none !important;
      -webkit-user-select: none !important;
      user-select: none !important;
    }
  `;

  const injectCSS = (rootNode) => {
    if (!rootNode || rootNode.__dsInjected) return;
    const s = document.createElement('style');
    s.textContent = CSS;
    (rootNode.head || rootNode).appendChild(s);
    rootNode.__dsInjected = true;
  };
  injectCSS(document);

  const walkRoots = (node, cb) => {
    if (!node) return;
    if (node.nodeType === 1) {
      if (node.shadowRoot) { cb(node.shadowRoot); walkRoots(node.shadowRoot, cb); }
      for (const c of node.children) walkRoots(c, cb);
    }
  };
  walkRoots(document.body || document.documentElement, injectCSS);

  const deepElementFromPoint = (x, y) => {
    let el = document.elementFromPoint(x, y);
    while (el && el.shadowRoot) {
      const inner = el.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === el) break;
      el = inner;
    }
    return el;
  };

  const caretAt = (x, y) => {
    let node = null, offset = 0;
    if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(x, y);
      if (p) { node = p.offsetNode; offset = p.offset; }
    } else if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      if (r) { node = r.startContainer; offset = r.startOffset; }
    }
    return node ? { node, offset } : null;
  };

  let drag = null;

  const setRange = (a, b) => {
    if (!a || !b) return;
    try {
      const r = document.createRange();
      r.setStart(a.node, a.offset);
      r.setEnd(b.node, b.offset);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    } catch (_) {}
  };

  const edgePos = (pre, x, y, side) => {
    const r = pre.getBoundingClientRect();
    if (side === 'start') return caretAt(r.left + 1, r.top + 1);
    if (side === 'end')   return caretAt(r.right - 1, r.bottom - 1);
    const dTop = Math.abs(y - r.top), dBot = Math.abs(y - r.bottom);
    return dTop < dBot ? caretAt(x, r.top + 1) : caretAt(x, r.bottom - 1);
  };

  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.shiftKey) return;
    const pre = deepElementFromPoint(e.clientX, e.clientY)?.closest?.('pre, code');
    if (!pre) return;
    const a = caretAt(e.clientX, e.clientY);
    if (!a) return;
    drag = { pre, anchorNode: a.node, anchorOffset: a.offset };
    e.preventDefault();
    e.stopPropagation();
    setRange(a, a);
  }, true);

  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const { pre, anchorNode, anchorOffset } = drag;
    const cur = caretAt(e.clientX, e.clientY);
    let focus;
    if (cur && pre.contains(cur.node)) {
      focus = cur;
    } else {
      const rect = pre.getBoundingClientRect();
      focus = edgePos(pre, e.clientX, e.clientY,
        cur && cur.node && pre.compareDocumentPosition(cur.node) & Node.DOCUMENT_POSITION_PRECEDING
          ? 'end' : 'start');
      if (!focus) return;
    }
    const anchor = { node: anchorNode, offset: anchorOffset };
    const before = anchor.node.compareDocumentPosition(focus.node);
    const anchorFirst =
      before & Node.DOCUMENT_POSITION_FOLLOWING ||
      (before === 0 && anchor.offset <= focus.offset);
    setRange(anchorFirst ? anchor : focus, anchorFirst ? focus : anchor);
    e.preventDefault();
  }, true);

  const endDrag = () => { drag = null; };
  window.addEventListener('mouseup', endDrag, true);
  window.addEventListener('blur', endDrag, true);

  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes)
      if (n.nodeType === 1) walkRoots(n, injectCSS);
  }).observe(document.documentElement, { childList: true, subtree: true });

  /* ============ 2. AUTO-COLLAPSE THINKING ============ */
  const THINK_CONTENT_SELECTOR = 'div.ds-think-content';
  const processed = new WeakSet();

  const containsText = (el, text) =>
    el.textContent && el.textContent.toLowerCase().includes(text.toLowerCase());

  const findToggleButton = (thinkContent) => {
    let parent = thinkContent.parentElement;
    while (parent && !parent.classList?.contains('ds-message')) {
      const b = parent.querySelector('button[aria-expanded]');
      if (b) return b;
      parent = parent.parentElement;
    }
    parent = thinkContent.parentElement;
    while (parent && !parent.classList?.contains('ds-message')) {
      const s = parent.querySelector('summary');
      if (s && containsText(s, 'thinking')) return s;
      parent = parent.parentElement;
    }
    const btns = thinkContent.closest('.ds-message')?.querySelectorAll('button') || [];
    for (const btn of btns)
      if (containsText(btn, 'thinking') || containsText(btn, 'thought')) return btn;
    const prev = thinkContent.previousElementSibling;
    if (prev && prev.tagName === 'BUTTON') return prev;
    return null;
  };

  const collapseThinking = (container) => {
    const list = container.matches?.(THINK_CONTENT_SELECTOR)
      ? [container]
      : container.querySelectorAll(THINK_CONTENT_SELECTOR);
    for (const tc of list) {
      if (processed.has(tc)) continue;
      processed.add(tc);
      if (tc.offsetParent === null || getComputedStyle(tc).display === 'none') continue;
      const t = findToggleButton(tc);
      if (t) {
        if (t.getAttribute('aria-expanded') === 'true' || t.open === true ||
            (t.tagName === 'SUMMARY' && t.parentElement?.open)) t.click();
      } else {
        tc.style.display = 'none';
      }
    }
  };

  const initThinking = () => {
    document.querySelectorAll('.ds-message').forEach(collapseThinking);
    const cont = document.querySelector('.ds-virtual-list') || document.body;
    new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches?.('.ds-message')) collapseThinking(n);
        n.querySelectorAll?.('.ds-message').forEach(collapseThinking);
      }
    }).observe(cont, { childList: true, subtree: true });
    setInterval(() => document.querySelectorAll('.ds-message').forEach(collapseThinking), 3000);
  };

  /* ============ 3. PROMPT SUFFIXES (concise + no-chinese) ============ */
  const SUFFIXES = [
    { key: 'beConciseEnabled',        suffix: ' be concise',       label: 'Be Concise',         top: '10px' },
    { key: 'answerInEnglishEnabled',  suffix: ' never use chinese', label: 'Never use chinese', top: '60px' },
  ];
  for (const s of SUFFIXES) s.enabled = GM_getValue(s.key, true);

  const getInput = () =>
    document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');

  const setInputText = (input, text) => {
    if (input instanceof HTMLTextAreaElement) {
      const d = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      if (d?.set) d.set.call(input, text); else input.value = text;
    } else {
      input.textContent = text;
    }
    input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const appendSuffixes = () => {
    const input = getInput();
    if (!input) return;
    let text = input instanceof HTMLTextAreaElement ? input.value : (input.textContent || '');
    if (!text.trim()) return;
    let changed = false;
    for (const s of SUFFIXES) {
      if (!s.enabled) continue;
      if (text.endsWith(s.suffix)) continue;
      text += s.suffix;
      changed = true;
    }
    if (changed) setInputText(input, text);
  };

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
    appendSuffixes();
  }, true);

  /* ============ 4. TOGGLES UI ============ */
  const createToggles = () => {
    if (!document.body) { setTimeout(createToggles, 500); return; }
    for (const s of SUFFIXES) {
      if (document.getElementById('ds-toolkit-' + s.key)) continue;
      const c = document.createElement('div');
      c.id = 'ds-toolkit-' + s.key;
      Object.assign(c.style, {
        position: 'fixed', top: s.top, right: '10px', zIndex: '2147483647',
        background: 'rgba(255,255,255,0.95)', border: '1px solid #ccc',
        borderRadius: '8px', padding: '8px 12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#000',
      });
      c.innerHTML = `
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" ${s.enabled ? 'checked' : ''}>
          <span>${s.label}</span>
        </label>`;
      document.body.appendChild(c);
      c.querySelector('input').addEventListener('change', (e) => {
        s.enabled = e.target.checked;
        GM_setValue(s.key, s.enabled);
      });
    }
  };

  const boot = () => {
    initThinking();
    createToggles();
    new MutationObserver(() => {
      for (const s of SUFFIXES)
        if (!document.getElementById('ds-toolkit-' + s.key)) { createToggles(); break; }
    }).observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
