// ==UserScript==
// @name          SDForge QoL
// @namespace     SDForge_QOL
// @match         http://127.0.0.1:7860/*
// @grant         none
// @downloadURL   https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/SDForge.user.js
// @updateURL     https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/SDForge.user.js
// @version       2.5
// @description   Has many small patches for QoL while using Forge Neo.
// @run-at        document-start
// @author        masterofobzene
// @homepage      https://github.com/masterofobzene/UserScriptRepo
// @license       GNU GPLv3
// ==/UserScript==

(function() {
    'use strict';

    /* ---------- Persistent settings ---------- */
    const SETTINGS_KEY = 'sdforge_qa_settings';
    const defaults = { showSeed: true, showRandom: true, showReuse: true, showSave: true, showHires: true, ctrlScrollZoom: true };
    let settings = Object.assign({}, defaults);
    try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) {}
    const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {} };

    /* ---------- Ctrl+Scroll zoom guard for Forge canvas ---------- */
    const CANVAS_SELECTOR = '.forge-container';
    const keys = { w: false, a: false, s: false };
    const setKey = (e, v) => {
        const k = e.key ? e.key.toLowerCase() : '';
        if (k in keys) keys[k] = v;
    };
    document.addEventListener('keydown', (e) => setKey(e, true), true);
    document.addEventListener('keyup',   (e) => setKey(e, false), true);
    window.addEventListener('blur', () => { keys.w = keys.a = keys.s = false; });

    document.addEventListener('wheel', (e) => {
        if (!settings.ctrlScrollZoom) return;
        if (e.ctrlKey) return;
        if (keys.w || keys.a || keys.s) return;
        const t = e.target;
        if (!(t instanceof Element)) return;
        if (!t.closest(CANVAS_SELECTOR)) return;
        e.stopPropagation();
    }, true);
    /* -------------------------------------------------------------- */

    function boot() {
        const app = document.querySelector('gradio-app');
        if (!app) return false;
        app.addEventListener('domchange', initAll);
        setInterval(initAll, 800);
        return true;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

    /* ---------- Options menu (popup attached to body) ---------- */
    const MENU_ID = 'sdforge_options_menu';
    const POPUP_STYLE = `
        position:fixed;
        z-index:2147483647;
        background:#2b2b2b;
        color:#eee;
        border:1px solid #555;
        border-radius:6px;
        padding:8px 10px;
        min-width:220px;
        box-shadow:0 4px 16px rgba(0,0,0,.6);
        font-size:13px;
        text-align:left;
        display:none;
    `;

    function getMenu() {
        let menu = document.getElementById(MENU_ID);
        if (menu) return menu;

        menu = document.createElement('div');
        menu.id = MENU_ID;
        menu.style.cssText = POPUP_STYLE;

        const items = [
            ['showSeed',       'Show seed box'],
            ['showRandom',     'Show Random'],
            ['showReuse',      'Show Reuse'],
            ['showSave',       'Show Save'],
            ['showHires',      'Show Hires toggle'],
            ['ctrlScrollZoom', 'Ctrl+Scroll to zoom canvas'],
        ];

        items.forEach(([key, label]) => {
            const row = document.createElement('label');
            row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:4px 0; cursor:pointer; color:#eee;';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!settings[key];
            cb.addEventListener('change', () => {
                settings[key] = cb.checked;
                saveSettings();
                applyVisibility();
            });
            row.appendChild(cb);
            row.appendChild(document.createTextNode(label));
            menu.appendChild(row);
        });

        document.body.appendChild(menu);

        document.addEventListener('click', (e) => {
            if (e.target.closest(`#${MENU_ID}`)) return;
            if (e.target.classList && e.target.classList.contains('sdforge_options_btn')) return;
            menu.style.display = 'none';
        }, true);

        return menu;
    }

    function toggleMenu(anchorBtn) {
        const menu = getMenu();
        if (menu.style.display === 'block') { menu.style.display = 'none'; return; }
        menu.style.display = 'block';
        const r = anchorBtn.getBoundingClientRect();
        menu.style.top = (r.bottom + 6) + 'px';
        const mw = menu.offsetWidth;
        let left = r.right - mw;
        if (left < 8) left = 8;
        menu.style.left = left + 'px';
    }

    function buildOptionsButton(anchor, refBtn) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = (refBtn ? refBtn.className : '') + ' sdforge_options_btn';
        btn.textContent = 'Options \u2699';
        btn.title = 'Options';
        // Auto width: no fixed width, no flex-grow, shrink allowed only down to content.
        btn.style.cssText = `
            width: auto !important;
            min-width: 0 !important;
            max-width: none !important;
            flex: 0 0 auto !important;
            padding: 4px 10px !important;
            font-size: 13px !important;
            line-height: 1.3 !important;
            white-space: nowrap !important;
            cursor: pointer;
        `;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            toggleMenu(btn);
        });
        anchor.appendChild(btn);
        return btn;
    }

    function applyVisibility() {
        const seed = document.getElementById('custom_seed_box_txt2img');
        const seedI = document.getElementById('custom_seed_box_img2img');
        [seed, seedI].forEach(el => { if (el) el.style.display = settings.showSeed ? '' : 'none'; });

        ['txt2img', 'img2img'].forEach(tab => {
            const row = document.getElementById(`custom_controls_row_${tab}`);
            if (!row) return;
            if (row._randomBtn) row._randomBtn.style.display = settings.showRandom ? '' : 'none';
            if (row._reuseBtn)  row._reuseBtn.style.display  = settings.showReuse  ? '' : 'none';
            if (row._saveBtn)   row._saveBtn.style.display   = settings.showSave   ? '' : 'none';
            if (row._hiresBtn)  row._hiresBtn.style.display  = settings.showHires  ? '' : 'none';
        });
    }

    function initAll() {
        initTab('txt2img');
        initTab('img2img');
    }

    function initTab(tab) {
        const gallery = document.getElementById(`${tab}_gallery`);
        if (!gallery) return;

        const seedInput = document.querySelector(`#${tab}_seed input`);
        const randomBtn = document.getElementById(`${tab}_random_seed`);
        const reuseBtn = document.getElementById(`${tab}_reuse_seed`);
        const saveBtn = document.getElementById(`save_${tab}`);

        let hiresInput = document.querySelector(`#${tab}_enable_hr input[type="checkbox"]`);
        if (!hiresInput && tab === 'txt2img') {
            hiresInput = document.querySelector('input[type="checkbox"][id*="enable_hr"]') ||
                         document.querySelector('label:has(input[type="checkbox"]) input[type="checkbox"]:not([id*="prompt"])');
        }

        const generateBtn  = document.getElementById(`${tab}_generate`);
        const interruptBtn = document.getElementById(`${tab}_interrupt`);
        const interrupting = document.getElementById(`${tab}_interrupting`);

        const rowId = `custom_controls_row_${tab}`;
        const seedId = `custom_seed_box_${tab}`;

        if (!seedInput || !randomBtn || !reuseBtn || !saveBtn || !generateBtn || !interruptBtn || !interrupting) {
            console.log(`[Custom UI Buttons] Missing elements (${tab}):`, {
                seed: !!seedInput, random: !!randomBtn, reuse: !!reuseBtn,
                save: !!saveBtn, hires: !!hiresInput
            });
            return;
        }

        if (document.getElementById(rowId)) { applyVisibility(); return; }

        const seedBox = document.createElement('div');
        seedBox.id = seedId;
        seedBox.style.cssText = 'padding:6px 12px; background:#e0e0e0; border-radius:4px; font-family:monospace; font-weight:bold; min-width:140px; text-align:center; margin:8px 0;';
        seedBox.textContent = 'Seed: waiting...';

        let lastSeed = '-1';
        const updateSeed = () => {
            const val = seedInput.value.trim();
            lastSeed = val || '-1';
            seedBox.textContent = `Seed: ${lastSeed}`;
        };

        seedInput.addEventListener('input', updateSeed);
        randomBtn.addEventListener('click', () => setTimeout(() => {
            seedBox.textContent = 'Seed: -1';
            lastSeed = '-1';
        }, 50));

        const row = document.createElement('div');
        row.id = rowId;
        row.style.cssText = 'display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin:8px 0; padding:6px; background:#f0f0f0; border-radius:6px;';

        const smartBtn = document.createElement('button');
        smartBtn.className = generateBtn.className;
        smartBtn.style.minWidth = '140px';
        smartBtn.style.fontWeight = 'bold';
        smartBtn.style.flexShrink = '0';

        function updateSmartBtn() {
            let text = 'Generate';
            if (interrupting.style.display !== 'none' && interrupting.style.display !== '') {
                text = 'Interrupting...';
            } else if (interruptBtn.style.display !== 'none' && interruptBtn.style.display !== '') {
                text = 'Interrupt';
            }
            smartBtn.textContent = text;
            smartBtn.style.background = '';
        }

        smartBtn.onclick = () => {
            if (smartBtn.textContent === 'Generate') {
                generateBtn.click();
            } else {
                interruptBtn.click();
            }
        };

        const observer = new MutationObserver(updateSmartBtn);
        observer.observe(interruptBtn, { attributes: true, attributeFilter: ['style'] });
        observer.observe(interrupting, { attributes: true, attributeFilter: ['style'] });
        observer.observe(generateBtn, { attributes: true });

        row.appendChild(smartBtn);

        const addBtn = (orig, text = orig.innerHTML) => {
            const b = document.createElement('button');
            b.innerHTML = text;
            b.className = orig.className;
            b.style.minWidth = '80px';
            b.style.flexShrink = '0';
            b.onclick = () => orig.click();
            row.appendChild(b);
            return b;
        };

        row._randomBtn = addBtn(randomBtn);
        row._reuseBtn  = addBtn(reuseBtn);
        row._saveBtn   = addBtn(saveBtn);

        if (hiresInput) {
            const toggleBtn = document.createElement('button');
            toggleBtn.className = randomBtn.className;
            toggleBtn.style.cssText = `
                min-width: 90px !important;
                padding: 4px 8px !important;
                font-size: 13px !important;
                white-space: wrap !important;
                line-height: 1.3 !important;
                flex-shrink: 0 !important;
            `;
            const updateToggle = () => {
                toggleBtn.textContent = hiresInput.checked ? 'Hires ON' : 'Hires OFF';
            };
            updateToggle();
            toggleBtn.onclick = () => {
                hiresInput.click();
                setTimeout(updateToggle, 50);
            };
            hiresInput.addEventListener('change', updateToggle);
            row.appendChild(toggleBtn);
            row._hiresBtn = toggleBtn;
        }

        buildOptionsButton(row, randomBtn);

        const parent = gallery.parentNode;
        parent.insertBefore(seedBox, gallery);
        parent.insertBefore(row, gallery);

        const galleryObserver = new MutationObserver(() => setTimeout(updateSeed, 400));
        galleryObserver.observe(gallery, { childList: true, subtree: true });

        reuseBtn.addEventListener('click', () => setTimeout(updateSeed, 400));

        updateSeed();
        updateSmartBtn();
        applyVisibility();
        console.log(`[Custom UI Buttons] Row added (${tab})`);
    }
})();
