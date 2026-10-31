// ==UserScript==
// @name         DeepSeek QoL
// @namespace    DeepSeek_qol
// @version      1.3
// @author       masterofobzene
// @description  Selection fix + no-wrap code + auto-collapse thinking + prompt suffixes + copy button at bottom-right of code blocks + "Show full code" quick-send button
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

  /* ============ 1. SELECTION FIX ============ */
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
    pre,
    pre code,
    .md-code-block,
    .md-code-block pre,
    .md-code-block code {
      display: block !important;
      white-space: pre !important;
      word-break: normal !important;
      overflow-wrap: normal !important;
      overflow-x: auto !important;
      tab-size: 4 !important;
    }
    code:not(pre code):not(.md-code-block code) {
      display: inline !important;
      white-space: pre-wrap !important;
      word-break: normal !important;
      overflow-wrap: anywhere !important;
      vertical-align: baseline !important;
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
    const pre = deepElementFromPoint(e.clientX, e.clientY)?.closest?.('pre');
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
  const processedThink = new WeakSet();

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
      if (processedThink.has(tc)) continue;
      processedThink.add(tc);
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

  /* ============ 3. PROMPT SUFFIXES ============ */
  const SUFFIXES = [
    { key: 'beConciseEnabled',       suffix: ' be concise',        label: 'Be Concise' },
    { key: 'answerInEnglishEnabled', suffix: ' never use chinese', label: 'Never use chinese' },
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

  let suppressSuffixes = false;

  const appendSuffixes = () => {
    if (suppressSuffixes) { suppressSuffixes = false; return; }
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

  /* ============ 4. GEAR MENU ============ */
  const GEAR_ID = 'ds-qol-gear';
  const MENU_ID = 'ds-qol-menu';

  const buildGearMenu = () => {
    if (document.getElementById(GEAR_ID)) return;
    if (!document.body) return;

    const gear = document.createElement('button');
    gear.id = GEAR_ID;
    gear.type = 'button';
    gear.textContent = '⚙';
    gear.title = 'DeepSeek QoL options';
    Object.assign(gear.style, {
      position: 'fixed', top: '10px', right: '10px', zIndex: '2147483647',
      width: '32px', height: '32px', padding: '0', margin: '0',
      borderRadius: '50%', border: '1px solid #ccc',
      background: 'rgba(255,255,255,0.95)', color: '#000',
      cursor: 'pointer', fontSize: '18px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif', lineHeight: '1',
    });

    const menu = document.createElement('div');
    menu.id = MENU_ID;
    Object.assign(menu.style, {
      position: 'fixed', top: '48px', right: '10px', zIndex: '2147483647',
      background: 'rgba(255,255,255,0.98)', border: '1px solid #ccc',
      borderRadius: '8px', padding: '6px', display: 'none',
      boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
      fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#000',
      minWidth: '180px',
    });

    const items = [];
    const render = () => {
      for (const { check, s } of items) check.textContent = s.enabled ? '✓' : ' ';
    };

    for (const s of SUFFIXES) {
      const item = document.createElement('div');
      Object.assign(item.style, {
        padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '8px', userSelect: 'none',
      });
      const check = document.createElement('span');
      check.textContent = s.enabled ? '✓' : ' ';
      Object.assign(check.style, {
        display: 'inline-block', width: '14px', textAlign: 'center',
        fontWeight: 'bold',
      });
      const label = document.createElement('span');
      label.textContent = s.label;
      item.appendChild(check);
      item.appendChild(label);
      item.addEventListener('mouseenter', () => { item.style.background = '#eef'; });
      item.addEventListener('mouseleave', () => { item.style.background = ''; });
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        s.enabled = !s.enabled;
        GM_setValue(s.key, s.enabled);
        render();
      });
      menu.appendChild(item);
      items.push({ el: item, check, s });
    }

    let open = false;
    const setOpen = (v) => {
      open = v;
      menu.style.display = v ? 'block' : 'none';
      gear.style.background = v ? '#eef' : 'rgba(255,255,255,0.95)';
      if (v) render();
    };

    gear.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!open); });
    document.addEventListener('mousedown', (e) => {
      if (!open) return;
      if (gear.contains(e.target) || menu.contains(e.target)) return;
      setOpen(false);
    }, true);

    document.body.appendChild(gear);
    document.body.appendChild(menu);
    render();
  };

  const createToggles = () => buildGearMenu();

  /* ============ 4b. "SHOW FULL CODE" QUICK-SEND BUTTON ============ */
  const PHRASE = 'Show the full code with the fixes';
  const SHOW_CODE_BTN_ID = 'ds-qol-show-code';

  const hintOfEl = (el) => [
    el.getAttribute?.('aria-label') || '',
    el.getAttribute?.('title') || '',
    el.getAttribute?.('data-testid') || '',
    typeof el.className === 'string' ? el.className : '',
    el.textContent || '',
  ].join(' ').toLowerCase();

  // DeepSeek renders DeepThink/Search as <div tabindex="0" aria-pressed>
  // inside a shared wrapper — NOT as <button>. Match those shapes too.
  const TOGGLE_SEL =
    'button, [role="button"], [tabindex="0"], [aria-pressed], [class*="toggle-button" i]';

  const findDeepThinkSearchButtons = () => {
    const candidates = [...document.querySelectorAll(TOGGLE_SEL)];
    let deepthink = null, search = null;

    for (const b of candidates) {
      if (b.closest('pre') || b.id === SHOW_CODE_BTN_ID) continue;
      if (b.offsetParent === null) continue;
      if (b.querySelector('textarea, [contenteditable="true"]')) continue;

      // Exact trimmed-text match prevents the wrapper that holds both
      // labels (textContent "DeepThinkSearch") from being selected.
      const raw = (b.textContent || '').replace(/\s+/g, ' ').trim();
      if (!raw || raw.length > 25) continue;
      const lower = raw.toLowerCase();

      if (!deepthink && (lower === 'deepthink' || lower === 'deep think' || lower === '深度思考')) {
        deepthink = b;
      } else if (!search && (lower === 'search' || lower === '联网搜索' || lower === '搜索' || lower === '网搜')) {
        search = b;
      }
      if (deepthink && search) break;
    }
    return { deepthink, search };
  };

  const commonAncestor = (a, b) => {
    const set = new Set();
    let cur = a;
    while (cur && cur !== document.body) { set.add(cur); cur = cur.parentElement; }
    cur = b;
    while (cur && cur !== document.body) {
      if (set.has(cur)) return cur;
      cur = cur.parentElement;
    }
    return null;
  };

  const findSendButton = (input) => {
    let scope = input.parentElement;
    for (let i = 0; i < 6 && scope; i++) {
      for (const b of scope.querySelectorAll('button, [role="button"], [aria-label], [title]')) {
        if (b.closest('pre') || b.id === SHOW_CODE_BTN_ID) continue;
        const hint = hintOfEl(b);
        if (/(?:^|\s|")(send|发送|submit)/.test(hint)) return b;
      }
      scope = scope.parentElement;
    }
    return null;
  };

  const sendPhrase = () => {
    const input = getInput();
    if (!input) return;
    suppressSuffixes = true;
    setInputText(input, PHRASE);

    setTimeout(() => {
      try {
        const enter = new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
          bubbles: true, cancelable: true,
        });
        input.dispatchEvent(enter);
      } catch (_) {}

      setTimeout(() => {
        suppressSuffixes = false;
        const still = input instanceof HTMLTextAreaElement
          ? input.value : (input.textContent || '');
        if (still.trim()) {
          const sb = findSendButton(input);
          if (sb) sb.click();
        }
      }, 200);
    }, 50);
  };

  const createShowCodeButton = () => {
    const btn = document.createElement('button');
    btn.id = SHOW_CODE_BTN_ID;
    btn.type = 'button';
    btn.textContent = 'Show full code';
    btn.title = 'Insert and send: ' + PHRASE;
    Object.assign(btn.style, {
      padding: '6px 12px',
      margin: '0 0 0 6px',
      borderRadius: '999px',
      border: '1px solid currentColor',
      background: 'transparent',
      color: 'inherit',
      font: 'inherit',
      fontSize: '13px',
      cursor: 'pointer',
      height: '32px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      whiteSpace: 'nowrap',
      lineHeight: '1',
      opacity: '0.85',
      flex: '0 0 auto',
      alignSelf: 'center',
      transition: 'opacity 0.15s, background 0.15s',
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.opacity = '1';
      btn.style.background = 'rgba(128,128,128,0.12)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.opacity = '0.85';
      btn.style.background = 'transparent';
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      sendPhrase();
    });
    return btn;
  };

  const ensureShowCodeButton = () => {
    if (!document.body) return;
    const existing = document.getElementById(SHOW_CODE_BTN_ID);
    if (existing && existing.isConnected) return;

    const { deepthink, search } = findDeepThinkSearchButtons();
    if (!deepthink && !search) return;

    let parent = null;
    if (deepthink && search) {
      const dp = deepthink.parentElement;
      const sp = search.parentElement;
      if (dp && dp === sp) parent = dp;
      else parent = commonAncestor(deepthink, search);
    } else {
      parent = (deepthink || search).parentElement;
    }
    if (!parent) return;

    parent.appendChild(createShowCodeButton());
  };

  let pendingShowCode = null;
  const scheduleShowCode = () => {
    if (pendingShowCode) return;
    pendingShowCode = setTimeout(() => {
      pendingShowCode = null;
      ensureShowCodeButton();
    }, 100);
  };

  /* ============ 5. COPY BUTTON → BOTTOM-RIGHT OF CODE BLOCK ============ */
  const DEBUG_COPY = false;
  const clog = (...a) => DEBUG_COPY && console.log('[DS-QoL copy]', ...a);

  const hintOf = hintOfEl;

  const findCopyButtonFor = (pre) => {
    const ancestors = [];
    let anc = pre.parentElement;
    for (let i = 0; i < 5 && anc && anc !== document.body; i++) {
      ancestors.push(anc);
      anc = anc.parentElement;
    }

    const mdcb = pre.closest('.md-code-block');
    const searchOrder = mdcb
      ? [mdcb, ...ancestors.filter(a => a !== mdcb)]
      : ancestors;

    for (const c of searchOrder) {
      const btns = [...c.querySelectorAll('button, [role="button"], [class*="copy" i], [class*="Copy" i]')]
        .filter(b => !pre.contains(b) && b !== pre);
      if (!btns.length) continue;

      const hinted = btns.filter(b => hintOf(b).includes('copy'));
      if (hinted.length) return { container: c, button: hinted[hinted.length - 1] };

      const before = btns.filter(b =>
        pre.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING
      );
      if (before.length) return { container: c, button: before[before.length - 1] };
    }

    return null;
  };

  const repositionOne = (pre) => {
    if (!pre.isConnected) return;

    let ref = pre.__dsCopyRef;
    if (!ref || !ref.button.isConnected) {
      ref = findCopyButtonFor(pre);
      if (!ref) { clog('no copy button found for pre', pre); return; }
      pre.__dsCopyRef = ref;
      clog('found button', ref.button, 'in container', ref.container);
    }
    const { container, button } = ref;

    if (getComputedStyle(container).position === 'static') {
      container.style.setProperty('position', 'relative', 'important');
    }

    if (button.parentElement !== container) {
      try {
        container.appendChild(button);
        clog('reparented button to container');
      } catch (_) {
        pre.__dsCopyRef = null;
        return;
      }
    }

    const set = (k, v) => button.style.setProperty(k, v, 'important');
    set('position', 'absolute');
    set('right', '12px');
    set('bottom', '12px');
    set('top', 'auto');
    set('left', 'auto');
    set('margin', '0');
    set('transform', 'none');
    set('z-index', '9999');
    set('pointer-events', 'auto');

    if (!button.__dsHoverBound) {
      button.__dsHoverBound = true;
      set('opacity', '0.75');
      button.addEventListener('mouseenter', () => set('opacity', '1'));
      button.addEventListener('mouseleave', () => set('opacity', '0.75'));
    }

    pre.style.setProperty('padding-bottom', '40px', 'important');
  };

  const repositionCopyButtons = () => {
    document.querySelectorAll('pre').forEach(pre => {
      if (pre.parentElement?.closest('pre')) return;
      repositionOne(pre);
    });
  };

  /* ============ 6. BOOT ============ */
  let pendingReposition = null;
  const scheduleReposition = () => {
    if (pendingReposition) return;
    pendingReposition = setTimeout(() => {
      pendingReposition = null;
      repositionCopyButtons();
    }, 100);
  };

  const boot = () => {
    initThinking();
    createToggles();
    ensureShowCodeButton();
    repositionCopyButtons();

    new MutationObserver(() => {
      scheduleReposition();
      scheduleShowCode();
      createToggles();
    }).observe(document.documentElement, { childList: true, subtree: true });

    setInterval(() => {
      repositionCopyButtons();
      createToggles();
      ensureShowCodeButton();
    }, 3000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
