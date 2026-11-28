// ==UserScript==
// @name         ImageFap Gallery Board
// @namespace    ifap-gallery-board
// @version      1.8
// @description  Loads galleries from the current search/category page and presents them as a booru page.
// @author       masterofobzene
// @match        https://www.imagefap.com/gallery.php*
// @icon         https://www.imagefap.com/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      www.imagefap.com
// @run-at       document-end
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/ImageFap_Gallery_Board.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/ImageFap_Gallery_Board.user.js
// ==/UserScript==

(function() {
'use strict';

/* ====================================================================
   SHARED BLOCK-LIST STATE
   ==================================================================== */

const hiddenUsersKey  = 'imagefap_hidden_users';
const hideConfigKey   = 'imagefap_hide_filters';
const panelPosKey     = 'imagefap_gender_panel_pos';
const menuCollapsedKey = 'imagefap_menu_collapsed';
const SESSION_KEY     = 'ifap_board_session';

let hiddenUsers = new Set(GM_getValue(hiddenUsersKey, []));
let hiddenGalleries = new Set();   // session-only, never persisted

const DEFAULT_HIDE_CONFIG = {
    women: false,
    couples: false,
    transsexuals: false,
    germany: false,
    belgium: false,
    spain: false,
    france: false
};

function getHideConfig() {
    return GM_getValue(hideConfigKey, DEFAULT_HIDE_CONFIG);
}

function setHideConfig(cfg) {
    GM_setValue(hideConfigKey, cfg);
}

/* ====================================================================
   CANONICAL GALLERY URLS
   ==================================================================== */

function canonicalGalleryUrl(href) {
    if (!href) return null;

    const m = String(href).match(/[?&]gid=(\d+)/);

    if (!m) return null;

    return 'https://www.imagefap.com/gallery.php?gid=' + m[1];
}

function blockUser(username) {
    if (!username) return;

    username = username.toLowerCase();

    if (hiddenUsers.has(username)) return;

    hiddenUsers.add(username);

    GM_setValue(hiddenUsersKey, [...hiddenUsers]);

    console.log(`[ImageFap Hider] User blocked: ${username}`);

    hideAllGalleriesForUser(username);
    removeUserFromBoard(username);
}

/* ====================================================================
   SHARED FILTER LOGIC
   ==================================================================== */

function shouldHideByFilter(detailRow) {
    const cfg = getHideConfig();

    const sexIcon = detailRow.querySelector('.sex.iconSex');

    const hideGender =
        (cfg.women && sexIcon?.classList.contains('sexW')) ||
        (cfg.couples && sexIcon?.classList.contains('sexC')) ||
        (cfg.transsexuals && sexIcon?.classList.contains('sexS'));

    const flagDiv = detailRow.querySelector('div.country.iconCountry');

    let hideCountry = false;

    if (flagDiv) {
        const style = flagDiv.getAttribute('style') || '';

        hideCountry =
            (cfg.germany && style.includes('/DE.gif')) ||
            (cfg.belgium && style.includes('/BE.gif')) ||
            (cfg.spain && style.includes('/ES.gif')) ||
            (cfg.france && style.includes('/FR.gif'));
    }

    return hideGender || hideCountry;
}

function getPicCount(titleRow) {
    const center = titleRow.querySelector('td > center');

    if (!center) return null;

    const n = parseInt(center.textContent.trim(), 10);

    return Number.isNaN(n) ? null : n;
}

function getGalleryUsername(detailRow) {
    if (!detailRow) return null;

    const avatar = detailRow.querySelector('div.avatar');
    const userLink = avatar?.querySelector('a.gal_title');

    if (!avatar || !userLink) return null;

    return userLink.textContent.trim().toLowerCase();
}

function isGalleryHidden(titleRow, detailRow) {
    if (!titleRow) return true;

    if (titleRow.style && titleRow.style.display === 'none') {
        return true;
    }

    if (!detailRow || detailRow.tagName !== 'TR') {
        return false;
    }

    if (detailRow.style && detailRow.style.display === 'none') {
        return true;
    }

    const username = getGalleryUsername(detailRow);

    if (username && hiddenUsers.has(username)) {
        return true;
    }

    if (username && shouldHideByFilter(detailRow)) {
        return true;
    }

    const picCount = getPicCount(titleRow);

    if (picCount !== null && picCount < 4) {
        return true;
    }

    return false;
}

/* ====================================================================
   LIVE-PAGE HIDER UI
   ==================================================================== */

function createGenderPanel() {
    if (document.getElementById('genderFilterPanel')) return;

    const cfg = getHideConfig();

    const pos = GM_getValue(panelPosKey, {
        top: 120,
        right: 10
    });

    const panel = document.createElement('div');

    panel.id = 'genderFilterPanel';

    panel.style.cssText = `
        position:fixed;
        top:${pos.top}px;
        right:${pos.right}px;
        background:#111;
        color:#fff;
        width:170px;
        font-size:13px;
        z-index:99999;
        border:1px solid #444;
        border-radius:6px;
        box-shadow:0 0 6px black;
    `;

    panel.innerHTML = `
        <div id="panelHeader" style="font-weight:bold;padding:6px 8px;cursor:move;background:#1b1b1b;border-bottom:1px solid #333;">
            Hide users
        </div>

        <div style="padding:8px 10px;">
            <label><input type="checkbox" id="hideWomen"> Women</label><br>
            <label><input type="checkbox" id="hideCouples"> Couples</label><br>
            <label><input type="checkbox" id="hideTrans"> Transsexuals</label><br>
            <label><input type="checkbox" id="hideGermany"> Germany</label><br>
            <label><input type="checkbox" id="hideBelgium"> Belgium</label><br>
            <label><input type="checkbox" id="hideSpain"> Spain</label><br>
            <label><input type="checkbox" id="hideFrance"> France</label>
        </div>
    `;

    document.body.appendChild(panel);

    const w = panel.querySelector('#hideWomen');
    const c = panel.querySelector('#hideCouples');
    const t = panel.querySelector('#hideTrans');
    const g = panel.querySelector('#hideGermany');
    const b = panel.querySelector('#hideBelgium');
    const s = panel.querySelector('#hideSpain');
    const f = panel.querySelector('#hideFrance');

    w.checked = cfg.women;
    c.checked = cfg.couples;
    t.checked = cfg.transsexuals;
    g.checked = cfg.germany;
    b.checked = cfg.belgium;
    s.checked = cfg.spain;
    f.checked = cfg.france;

    const update = () => {
        setHideConfig({
            women: w.checked,
            couples: c.checked,
            transsexuals: t.checked,
            germany: g.checked,
            belgium: b.checked,
            spain: s.checked,
            france: f.checked
        });

        console.log('[ImageFap Hider] Filters updated');

        applyAll();
    };

    w.onchange = update;
    c.onchange = update;
    t.onchange = update;
    g.onchange = update;
    b.onchange = update;
    s.onchange = update;
    f.onchange = update;

    const header = panel.querySelector('#panelHeader');

    let sx, sy, st, sr, drag = false;

    header.onpointerdown = e => {
        drag = true;

        header.setPointerCapture(e.pointerId);

        sx = e.clientX;
        sy = e.clientY;

        const rect = panel.getBoundingClientRect();

        st = rect.top;
        sr = window.innerWidth - rect.right;
    };

    header.onpointermove = e => {
        if (!drag) return;

        panel.style.top = `${st + (e.clientY - sy)}px`;
        panel.style.right = `${sr - (e.clientX - sx)}px`;
    };

    header.onpointerup = e => {
        drag = false;

        header.releasePointerCapture(e.pointerId);

        GM_setValue(panelPosKey, {
            top: parseInt(panel.style.top, 10),
            right: parseInt(panel.style.right, 10)
        });
    };
}

function applyMenuState() {
    const collapsed = GM_getValue(menuCollapsedKey, false);

    document.querySelectorAll('#menuContentWrapper').forEach(w => {
        w.style.display = collapsed ? 'none' : '';
    });

    document.querySelectorAll('#menuToggleHeader').forEach(h => {
        const icon = collapsed ? '▶' : '▼';
        const text = collapsed ? 'Menu collapsed' : 'Navigation';

        h.innerHTML = `${text} <span style="font-size:17px;">${icon}</span>`;
    });
}

function setupMenuCollapser() {
    document.querySelectorAll('#main > center > table > tbody > tr > td:nth-of-type(1)').forEach(leftTd => {
        if (leftTd.querySelector('#menuToggleHeader')) return;

        const header = document.createElement('div');

        header.id = 'menuToggleHeader';

        header.style.cssText = `
            background:#1f1f1f;
            color:#ddd;
            padding:10px 12px;
            font-weight:bold;
            cursor:pointer;
            border-bottom:2px solid #333;
            display:flex;
            align-items:center;
            justify-content:space-between;
            user-select:none;
        `;

        leftTd.insertBefore(header, leftTd.firstChild);

        const wrapper = document.createElement('div');

        wrapper.id = 'menuContentWrapper';

        Array.from(leftTd.children)
            .filter(el => el !== header)
            .forEach(el => wrapper.appendChild(el));

        leftTd.appendChild(wrapper);

        header.onclick = () => {
            GM_setValue(
                menuCollapsedKey,
                !GM_getValue(menuCollapsedKey, false)
            );

            applyMenuState();
        };
    });

    applyMenuState();
}

function hideRow(titleRow, detailRow) {
    titleRow.style.display = 'none';

    if (detailRow) {
        detailRow.style.display = 'none';
    }
}

function hideAllGalleriesForUser(username) {
    document.querySelectorAll('div.avatar').forEach(avatar => {
        const link = avatar.querySelector('a.gal_title');

        if (!link) return;

        if (link.textContent.trim().toLowerCase() !== username) {
            return;
        }

        let detailRow = avatar;

        while (detailRow && detailRow.tagName !== 'TR') {
            detailRow = detailRow.parentElement;
        }

        if (!detailRow) return;

        const titleRow = detailRow.previousElementSibling;

        if (titleRow?.tagName === 'TR') {
            hideRow(titleRow, detailRow);
        }
    });
}

function processGallery(titleRow) {
    const detailRow = titleRow.nextElementSibling;

    if (!detailRow || detailRow.getAttribute('valign') !== 'top') {
        return;
    }

    const avatar = detailRow.querySelector('div.avatar');
    const userLink = avatar?.querySelector('a.gal_title');

    if (!avatar || !userLink) return;

    if (isGalleryHidden(titleRow, detailRow)) {
        hideRow(titleRow, detailRow);
        return;
    }

    const galLink = titleRow.querySelector('a[href*="gallery.php?gid="]');

    const galUrl = galLink
        ? canonicalGalleryUrl(galLink.getAttribute('href'))
        : null;

    if (galUrl && hiddenGalleries.has(galUrl)) {
        hideRow(titleRow, detailRow);
        return;
    }

    if (avatar.querySelector('.ifap-hide-btn, .ifap-hide-gal-btn')) {
        return;
    }

    const btn = document.createElement('span');

    btn.className = 'ifap-hide-btn';
    btn.textContent = '✖';
    btn.title = `Block ${userLink.textContent.trim()} site-wide`;

    btn.style.cssText = `
        position:absolute;
        top:4px;
        right:4px;
        width:24px;
        height:24px;
        background:rgba(255,0,0,.8);
        color:white;
        font-weight:bold;
        text-align:center;
        line-height:24px;
        border-radius:50%;
        cursor:pointer;
        z-index:9999;
    `;

    avatar.style.position = 'relative';

    avatar.appendChild(btn);

    btn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();

        blockUser(userLink.textContent.trim());
    };

    const galBtn = document.createElement('span');

    galBtn.className = 'ifap-hide-gal-btn';
    galBtn.textContent = '−';
    galBtn.title = 'Hide this gallery only (this session)';

    galBtn.style.cssText = `
        position:absolute;
        top:32px;
        right:4px;
        width:24px;
        height:24px;
        background:rgba(255,204,0,.9);
        color:#000;
        font-weight:bold;
        text-align:center;
        line-height:24px;
        border-radius:50%;
        cursor:pointer;
        z-index:9999;
    `;

    avatar.appendChild(galBtn);

    galBtn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();

        if (galUrl) {
            removeGalleryFromBoard(galUrl);
        }

        hideRow(titleRow, detailRow);
    };
}

function applyAll() {
    try {
        createGenderPanel();
        setupMenuCollapser();

        document.querySelectorAll('tr').forEach(tr => {
            if (
                tr.querySelector('a[href*="gallery.php?gid="]') ||
                tr.getAttribute('valign') === 'top' ||
                tr.hasAttribute('bgcolor') ||
                tr.style.borderTop?.includes('dotted')
            ) {
                tr.style.display = '';
            }
        });

        document.querySelectorAll('a[href*="gallery.php?gid="]').forEach(a => {
            let titleRow = a;

            while (titleRow && titleRow.tagName !== 'TR') {
                titleRow = titleRow.parentElement;
            }

            if (titleRow) {
                processGallery(titleRow);
            }
        });

    } catch (err) {
        console.error('[ImageFap Hider] applyAll failed', err);
    }
}

let applyTimeout = null;

const debouncedApplyAll = () => {
    if (applyTimeout) {
        clearTimeout(applyTimeout);
    }

    applyTimeout = setTimeout(applyAll, 150);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', debouncedApplyAll);
} else {
    debouncedApplyAll();
}

new MutationObserver(debouncedApplyAll).observe(document.body, {
    childList: true,
    subtree: true
});

/* ====================================================================
   GALLERY BOARD
   ==================================================================== */

const DELAY_MS  = 5000;
const BATCH_SIZE = 60;
const MAX_PAGE_ATTEMPTS = 5;
const RETRY_WAIT_MS = 10000;

const STATES = {
    IDLE: {
        label: 'Idle',
        color: '#666666',
        pulse: false
    },

    LOADING: {
        label: 'Loading',
        color: '#2ecc71',
        pulse: true
    },

    THROTTLE: {
        label: 'Throttling',
        color: '#f1c40f',
        pulse: true
    },

    ERROR: {
        label: 'Site error',
        color: '#e74c3c',
        pulse: true
    },

    PAUSED: {
        label: 'Stopped',
        color: '#95a5a6',
        pulse: false
    },

    DONE: {
        label: 'Done',
        color: '#3498db',
        pulse: false
    }
};

let boardImages = [];
let renderedCount = 0;
let galleryQueue = [];

let currentSearchPage = 1;
let lastSearchPageUrl = '';
let noMoreSearchPages = false;

let isRunning = false;
let infiniteObserver = null;

let lastRequestAt = 0;
let consecutiveEmptyPages = 0;
let driveLoopRunning = false;

let seenGalleryUrls = new Set();
let lastFinalUrl = '';

let generation = 0;
let skippedGalleries = 0;

if (!document.getElementById('ifap-board-style')) {
    const st = document.createElement('style');

    st.id = 'ifap-board-style';

    st.textContent =
        '@keyframes ifapPulse{0%,100%{opacity:1}50%{opacity:.35}}' +
        '.ifap-pulse{animation:ifapPulse 1.1s ease-in-out infinite}';

    document.head.appendChild(st);
}

const triggerBtn = document.createElement('button');

triggerBtn.id = 'ifap-board-trigger';
triggerBtn.textContent = '⚡ Booru Mode';
triggerBtn.title = 'Open All Galleries';

triggerBtn.style.cssText = `
    position:fixed;
    top:90px;
    left:12px;
    z-index:2147483647;
    padding:6px 10px;
    background:#3366cc;
    color:#fff;
    border:none;
    border-radius:6px;
    font-size:15px;
    font-weight:bold;
    cursor:pointer;
    box-shadow:0 2px 8px rgba(0,0,0,.4);
    font-family:sans-serif;
    text-align:center;
    white-space:nowrap;
`;

triggerBtn.addEventListener('click', startBoard);

document.body.appendChild(triggerBtn);

function setBoardState(state, detail) {
    const badge = document.getElementById('ifap-board-state');

    if (badge) {
        badge.textContent = state.label;
        badge.style.background = state.color;
        badge.classList.toggle('ifap-pulse', !!state.pulse);
    }

    if (detail) {
        const statusEl = document.getElementById('ifap-board-status');

        if (statusEl) {
            statusEl.textContent = detail;
        }
    }
}

function updateCounter() {
    const counterEl = document.getElementById('ifap-board-counter');

    if (!counterEl) return;

    const grid = document.getElementById('ifap-board-grid');

    const shown = grid
        ? grid.querySelectorAll('.ifap-board-card').length
        : renderedCount;

    counterEl.textContent =
        `${shown} / ${boardImages.length} images · ${skippedGalleries} skipped`;
}

function discoverGalleriesFromDoc(doc) {
    const links = doc.querySelectorAll('a[href*="gallery.php?gid="]');

    const map = new Map();

    links.forEach(a => {
        const key = canonicalGalleryUrl(a.getAttribute('href'));

        if (!key) return;

        let titleRow = a;

        while (titleRow && titleRow.tagName !== 'TR') {
            titleRow = titleRow.parentElement;
        }

        const detailRow = titleRow
            ? titleRow.nextElementSibling
            : null;

        if (titleRow && isGalleryHidden(titleRow, detailRow)) {
            return;
        }

        if (hiddenGalleries.has(key)) return;

        if (!map.has(key)) {
            map.set(key, {
                url: key,
                title: (a.textContent || 'Untitled').trim(),
                username: getGalleryUsername(detailRow)
            });
        }
    });

    return Array.from(map.values());
}

function getNextSearchPageInfo(baseUrl, currentPageNum) {
    try {
        const u = new URL(baseUrl);

        const next = currentPageNum + 1;

        u.searchParams.set('page', String(next));

        return {
            url: u.toString(),
            pageNum: next
        };

    } catch (e) {
        return null;
    }
}

function createOverlay() {
    const existing = document.getElementById('ifap-board-overlay');

    if (existing) {
        existing.remove();
    }

    const ov = document.createElement('div');

    ov.id = 'ifap-board-overlay';

    ov.style.cssText = `
        position:fixed;
        top:0;
        left:0;
        right:0;
        bottom:0;
        background:#121212;
        z-index:2147483646;
        display:flex;
        flex-direction:column;
        font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;
    `;

    const header = document.createElement('div');

    header.style.cssText = `
        position:sticky;
        top:0;
        z-index:10;
        background:#1e1e1e;
        border-bottom:2px solid #3366cc;
        padding:12px 20px;
        display:flex;
        align-items:center;
        gap:15px;
        color:#fff;
        flex-wrap:wrap;
    `;

    header.innerHTML = `
        <div style="flex:1 1 auto;">
            <div style="font-size:18px;font-weight:bold;">🖼️ Gallery Board</div>

            <div id="ifap-board-status" style="font-size:12px;color:#aaa;margin-top:3px;">
                Preparing…
            </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;">
            <span id="ifap-board-state" style="padding:3px 10px;border-radius:10px;font-size:11px;font-weight:bold;background:#666;color:#fff;user-select:none;">
                Idle
            </span>

            <span id="ifap-board-counter" style="font-size:12px;color:#aaa;">
                0 images
            </span>

            <button id="ifap-board-save" style="padding:6px 10px;background:#27ae60;border:none;border-radius:4px;color:#fff;cursor:pointer;font-weight:bold;font-size:12px;">
                Save
            </button>

            <button id="ifap-board-load" style="padding:6px 10px;background:#8e44ad;border:none;border-radius:4px;color:#fff;cursor:pointer;font-weight:bold;font-size:12px;">
                Load
            </button>

            <button id="ifap-board-stop" style="padding:6px 14px;background:#c0392b;border:none;border-radius:4px;color:#fff;cursor:pointer;font-weight:bold;">
                Stop
            </button>

            <button id="ifap-board-resume" style="display:none;padding:6px 14px;background:#2980b9;border:none;border-radius:4px;color:#fff;cursor:pointer;font-weight:bold;">
                Resume
            </button>

            <button id="ifap-board-close" style="padding:6px 14px;background:#444;border:none;border-radius:4px;color:#fff;cursor:pointer;font-weight:bold;">
                Close
            </button>
        </div>
    `;

    const grid = document.createElement('div');

    grid.id = 'ifap-board-grid';

    grid.style.cssText = `
        flex:1 1 auto;
        overflow-y:auto;
        padding:15px;
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        align-content:flex-start;
        align-items:flex-start;
        justify-content:center;
    `;

    const sentinel = document.createElement('div');

    sentinel.id = 'ifap-board-sentinel';

    sentinel.style.cssText = `
        width:100%;
        height:50px;
        display:flex;
        align-items:center;
        justify-content:center;
        color:#666;
        font-size:12px;
    `;

    sentinel.textContent = 'Scroll to load more…';

    const endMarker = document.createElement('div');

    endMarker.id = 'ifap-board-end';

    endMarker.style.cssText = `
        display:none;
        width:100%;
        text-align:center;
        padding:20px;
        color:#555;
        font-size:13px;
    `;

    endMarker.textContent = '— End —';

    ov.appendChild(header);
    ov.appendChild(grid);

    document.body.appendChild(ov);

    grid.appendChild(sentinel);
    grid.appendChild(endMarker);

    document.getElementById('ifap-board-close').onclick = destroyOverlay;
    document.getElementById('ifap-board-stop').onclick = stopLoading;
    document.getElementById('ifap-board-resume').onclick = resumeLoading;
    document.getElementById('ifap-board-save').onclick = saveSession;
    document.getElementById('ifap-board-load').onclick = loadSession;

    const escHandler = (e) => {
        if (e.key === 'Escape') {
            destroyOverlay();
        }
    };

    document.addEventListener('keydown', escHandler);

    ov._escHandler = escHandler;

    setupInfiniteScroll();
}

function destroyOverlay() {
    isRunning = false;
    generation++;

    if (infiniteObserver) {
        infiniteObserver.disconnect();
        infiniteObserver = null;
    }

    const ov = document.getElementById('ifap-board-overlay');

    if (ov) {
        document.removeEventListener('keydown', ov._escHandler);
        ov.remove();
    }

    triggerBtn.style.display = 'block';
    triggerBtn.disabled = false;

    boardImages = [];
    galleryQueue = [];
    renderedCount = 0;

    currentSearchPage = 1;
    noMoreSearchPages = false;
    consecutiveEmptyPages = 0;

    skippedGalleries = 0;

    seenGalleryUrls.clear();
}

function stopLoading() {
    isRunning = false;

    setBoardState(STATES.PAUSED, 'Stopped. Click Resume to continue.');

    const stopBtn = document.getElementById('ifap-board-stop');
    const resumeBtn = document.getElementById('ifap-board-resume');

    if (stopBtn) {
        stopBtn.style.display = 'none';
    }

    if (resumeBtn) {
        resumeBtn.style.display = '';
    }
}

function resumeLoading() {
    if (isRunning) return;

    isRunning = true;

    setBoardState(STATES.LOADING, 'Resuming…');

    const stopBtn = document.getElementById('ifap-board-stop');
    const resumeBtn = document.getElementById('ifap-board-resume');

    if (stopBtn) {
        stopBtn.style.display = '';
    }

    if (resumeBtn) {
        resumeBtn.style.display = 'none';
    }

    driveLoop();
}

function saveSession() {
    GM_setValue(SESSION_KEY, {
        currentSearchPage,
        lastSearchPageUrl,
        galleryQueue: galleryQueue.slice(),
        noMoreSearchPages,
        consecutiveEmptyPages,
        lastRequestAt,
        skippedGalleries,
        seenGalleryUrls: [...seenGalleryUrls]
    });

    setBoardState(
        STATES.IDLE,
        `Session saved at search page ${currentSearchPage}.`
    );
}

function loadSession() {
    const data = GM_getValue(SESSION_KEY, null);

    if (!data) {
        alert('No saved session.');
        return;
    }

    generation++;

    isRunning = true;

    boardImages = [];
    renderedCount = 0;

    galleryQueue = data.galleryQueue || [];

    currentSearchPage = data.currentSearchPage || 1;
    lastSearchPageUrl = data.lastSearchPageUrl || location.href;

    noMoreSearchPages = !!data.noMoreSearchPages;

    consecutiveEmptyPages = data.consecutiveEmptyPages || 0;
    lastRequestAt = data.lastRequestAt || 0;

    skippedGalleries = data.skippedGalleries || 0;

    seenGalleryUrls = new Set(data.seenGalleryUrls || []);

    galleryQueue.forEach(g => {
        seenGalleryUrls.add(g.url);
    });

    triggerBtn.style.display = 'none';

    createOverlay();

    setBoardState(
        STATES.LOADING,
        `Resuming from search page ${currentSearchPage}…`
    );

    driveLoop();
}

function removeUserFromBoard(username) {
    const grid = document.getElementById('ifap-board-grid');

    if (grid) {
        grid.querySelectorAll(
            `[data-ifap-username="${CSS.escape(username)}"]`
        ).forEach(el => el.remove());
    }

    galleryQueue = galleryQueue.filter(g => g.username !== username);

    updateCounter();
}

function removeGalleryFromBoard(galleryUrl) {
    if (!galleryUrl) return;

    hiddenGalleries.add(galleryUrl);

    galleryQueue = galleryQueue.filter(g => g.url !== galleryUrl);

    const grid = document.getElementById('ifap-board-grid');

    if (grid) {
        grid.querySelectorAll('.ifap-board-card').forEach(c => {
            if (c.dataset.ifapGallery === galleryUrl) {
                c.remove();
            }
        });
    }

    updateCounter();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForPoliteGap(gallery) {
    let remaining = DELAY_MS - (Date.now() - lastRequestAt);

    while (remaining > 0) {
        if (!isRunning) return false;

        if (gallery && isGalleryCancelled(gallery)) {
            return false;
        }

        setBoardState(
            STATES.THROTTLE,
            `Throttling — next request in ${Math.ceil(remaining / 1000)}s`
        );

        const chunk = Math.min(200, remaining);

        await sleep(chunk);

        remaining -= chunk;
    }

    return true;
}

function is504Response(res) {
    if (
        res.status === 504 ||
        res.status === 502 ||
        res.status === 503
    ) {
        return true;
    }

    const text = (res.responseText || '').toLowerCase();

    return (
        text.includes('504 gateway') ||
        text.includes('gateway time-out') ||
        text.includes('502 bad gateway')
    );
}

function fetchDocument(url) {
    return new Promise((resolve, reject) => {
        if (!isRunning) {
            return reject(new Error('Aborted'));
        }

        GM_xmlhttpRequest({
            method: 'GET',
            url: url,

            headers: {
                'Referer': 'https://www.imagefap.com/'
            },

            onload: (res) => {
                if (!isRunning) {
                    return reject(new Error('Aborted'));
                }

                if (is504Response(res)) {
                    return reject(new Error('504'));
                }

                const finalUrl = res.finalUrl || url;

                lastFinalUrl = finalUrl;

                const parser = new DOMParser();

                const doc = parser.parseFromString(
                    res.responseText,
                    'text/html'
                );

                resolve({
                    doc,
                    finalUrl
                });
            },

            onerror: () => reject(new Error('network'))
        });
    });
}

function isGalleryCancelled(gallery) {
    if (!gallery) return false;

    if (hiddenGalleries.has(gallery.url)) {
        return true;
    }

    if (gallery.username && hiddenUsers.has(gallery.username)) {
        return true;
    }

    return false;
}

async function fetchGalleryPage(gallery, pageUrl) {
    let attempt = 0;

    while (isRunning) {
        if (isGalleryCancelled(gallery)) {
            throw new Error('__cancelled__');
        }

        if (!(await waitForPoliteGap(gallery))) {
            throw new Error('__cancelled__');
        }

        lastRequestAt = Date.now();

        setBoardState(
            STATES.LOADING,
            `Fetching "${gallery.title}"…`
        );

        try {
            return await fetchDocument(pageUrl);

        } catch (e) {
            if (e.message === 'Aborted') {
                throw e;
            }

            attempt++;

            if (attempt >= MAX_PAGE_ATTEMPTS) {
                throw e;
            }

            const why = e.message === '504'
                ? '504 Gateway Timeout'
                : 'network error';

            for (
                let s = RETRY_WAIT_MS / 1000;
                s > 0 && isRunning;
                s--
            ) {
                if (isGalleryCancelled(gallery)) {
                    throw new Error('__cancelled__');
                }

                setBoardState(
                    STATES.ERROR,
                    `Site error (${why}) in "${gallery.title}" — retry ${attempt}/${MAX_PAGE_ATTEMPTS} in ${s}s`
                );

                await sleep(1000);
            }
        }
    }

    throw new Error('Aborted');
}

async function fetchSearchPage(url, pageNum) {
    let attempt = 0;

    while (isRunning) {
        if (!(await waitForPoliteGap(null))) {
            break;
        }

        lastRequestAt = Date.now();

        try {
            setBoardState(
                STATES.LOADING,
                `Loading search results page ${pageNum}…`
            );

            return await fetchDocument(url);

        } catch (e) {
            if (e.message === 'Aborted') {
                throw e;
            }

            attempt++;

            const why = e.message === '504'
                ? '504 Gateway Timeout'
                : 'network error';

            for (
                let s = RETRY_WAIT_MS / 1000;
                s > 0 && isRunning;
                s--
            ) {
                setBoardState(
                    STATES.ERROR,
                    `Site error (${why}) on search page ${pageNum} — retry #${attempt} in ${s}s (waiting for ImageFap to recover)`
                );

                await sleep(1000);
            }
        }
    }

    throw new Error('Aborted');
}

/* ====================================================================
   IMAGE DIMENSION EXTRACTION
   ==================================================================== */

/*
   Finds the displayed image dimensions in the original gallery page.

   Example HTML:
   <font>
       <b>400</b>&nbsp;x&nbsp;<b>291</b>
   </font>

   Searches the thumbnail's parent containers, but stops before
   reaching a container containing multiple photo links.
*/

function getImageDimensions(photoAnchor) {
    let node = photoAnchor;

    for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {

        // Avoid accidentally reading dimensions belonging to another image.
        if (node !== photoAnchor) {
            const photoLinks = node.querySelectorAll('a[href^="/photo/"]');

            if (photoLinks.length > 1) {
                break;
            }
        }

        const text = (node.textContent || '').replace(/\s+/g, ' ');

        const match = text.match(/\b(\d{2,5})\s*[x×]\s*(\d{2,5})\b/i);

        if (match) {
            return {
                width: parseInt(match[1], 10),
                height: parseInt(match[2], 10)
            };
        }
    }

    return null;
}

/* ====================================================================
   IMAGE EXTRACTION
   ==================================================================== */

function extractImagesFromGalleryDoc(doc, galleryMeta) {
    const out = [];

    const anchors = doc.querySelectorAll('a[href^="/photo/"]');

    anchors.forEach(a => {
        const img = a.querySelector('img');

        if (!img) return;

        const photoHref = a.getAttribute('href');

        let thumb =
            img.getAttribute('src') ||
            img.getAttribute('data-src') ||
            img.getAttribute('data-original');

        if (!thumb) return;

        if (thumb.startsWith('//')) {
            thumb = 'https:' + thumb;
        } else if (thumb.startsWith('/')) {
            thumb = 'https://www.imagefap.com' + thumb;
        }

        const fullPhoto = photoHref.startsWith('http')
            ? photoHref
            : 'https://www.imagefap.com' + photoHref;

        // NEW: Extract the original image dimensions.
        const dimensions = getImageDimensions(a);

        out.push({
            photoUrl: fullPhoto,
            thumbUrl: thumb,
            galleryTitle: galleryMeta.title,
            galleryUrl: galleryMeta.url,
            username: galleryMeta.username,
            alt: (img.alt || '').replace(/Free porn pics of /i, ''),

            // NEW: Store image dimensions for the size label.
            width: dimensions?.width ?? null,
            height: dimensions?.height ?? null
        });
    });

    return out;
}

function findNextGalleryPageUrl(doc, currentUrl, basePath) {
    const curMatch = currentUrl.match(/[?&]page=(\d+)/);

    const curPage = curMatch
        ? parseInt(curMatch[1], 10)
        : 0;

    const abs = (h) => {
        if (h.startsWith('http')) {
            return h;
        }

        if (h.startsWith('/')) {
            return 'https://www.imagefap.com' + h;
        }

        return basePath + (h.startsWith('?') ? h : '/' + h);
    };

    const relNext = doc.querySelector('link[rel="next"]');

    if (relNext) {
        const h = relNext.getAttribute('href');

        if (h && /[?&]page=\d+/.test(h)) {
            return abs(h);
        }
    }

    let best = null;
    let bestPage = Infinity;

    doc.querySelectorAll('a[href*="page="]').forEach(a => {
        const h = a.getAttribute('href');

        const m = h && h.match(/[?&]page=(\d+)/);

        if (!m) return;

        const p = parseInt(m[1], 10);

        if (p > curPage && p < bestPage) {
            bestPage = p;
            best = h;
        }
    });

    return best ? abs(best) : null;
}

async function crawlGallery(gallery) {
    if (isGalleryCancelled(gallery)) {
        return 'done';
    }

    let pageUrl = gallery.url;

    const seenPhotos = new Set();

    let emptyStreak = 0;
    let safety = 0;

    while (pageUrl && isRunning && safety < 200) {
        safety++;

        if (isGalleryCancelled(gallery)) {
            return 'done';
        }

        try {
            const { doc, finalUrl } = await fetchGalleryPage(
                gallery,
                pageUrl
            );

            if (isGalleryCancelled(gallery)) {
                return 'done';
            }

            const basePath = finalUrl.split('?')[0];

            const imgs = extractImagesFromGalleryDoc(doc, gallery)
                .filter(im => !seenPhotos.has(im.photoUrl));

            if (imgs.length) {
                emptyStreak = 0;

                imgs.forEach(im => {
                    seenPhotos.add(im.photoUrl);
                });

                boardImages.push(...imgs);

                if (renderedCount < boardImages.length) {
                    renderBatch(BATCH_SIZE);
                }

            } else {
                emptyStreak++;

                if (emptyStreak >= 2) {
                    break;
                }
            }

            const next = findNextGalleryPageUrl(
                doc,
                pageUrl,
                basePath
            );

            pageUrl = (next && next !== pageUrl)
                ? next
                : null;

        } catch (e) {
            if (!isRunning) {
                return 'aborted';
            }

            if (
                e.message === '__cancelled__' ||
                isGalleryCancelled(gallery)
            ) {
                return 'done';
            }

            console.warn(
                '[ifap-board] Gallery failed after retries:',
                gallery.url,
                e
            );

            skippedGalleries++;

            updateCounter();

            return 'done';
        }
    }

    return 'done';
}

function showEnd(text) {
    const sentinel = document.getElementById('ifap-board-sentinel');
    const endMarker = document.getElementById('ifap-board-end');

    if (sentinel) {
        sentinel.style.display = 'none';
    }

    if (endMarker) {
        endMarker.style.display = 'block';
        endMarker.textContent = text || '— End —';
    }
}

async function loadNextSearchPage() {
    if (noMoreSearchPages || !isRunning) {
        return;
    }

    const info = getNextSearchPageInfo(
        lastSearchPageUrl,
        currentSearchPage
    );

    if (!info) {
        noMoreSearchPages = true;

        setBoardState(
            STATES.DONE,
            `No more results after search page ${currentSearchPage}.`
        );

        return;
    }

    let doc;

    try {
        doc = (
            await fetchSearchPage(info.url, info.pageNum)
        ).doc;

    } catch (e) {
        return;
    }

    lastSearchPageUrl = info.url;
    currentSearchPage = info.pageNum;

    const rawLinks = doc.querySelectorAll(
        'a[href*="gallery.php?gid="]'
    ).length;

    const newGalleries = discoverGalleriesFromDoc(doc)
        .filter(g => !seenGalleryUrls.has(g.url));

    if (rawLinks === 0) {
        consecutiveEmptyPages++;

        if (consecutiveEmptyPages >= 2) {
            noMoreSearchPages = true;

            setBoardState(
                STATES.DONE,
                `No more results after search page ${currentSearchPage}.`
            );

            showEnd();

            return;
        }

    } else {
        consecutiveEmptyPages = 0;

        if (newGalleries.length) {
            newGalleries.forEach(g => {
                seenGalleryUrls.add(g.url);
            });

            galleryQueue.push(...newGalleries);
        }
    }
}

async function doNextStep() {
    if (!isRunning) return;

    if (renderedCount < boardImages.length) {
        renderBatch(BATCH_SIZE);

    } else if (galleryQueue.length > 0) {
        const gallery = galleryQueue[0];

        const result = await crawlGallery(gallery);

        if (result !== 'aborted') {
            galleryQueue.shift();
        }

    } else if (!noMoreSearchPages) {
        await loadNextSearchPage();
    }

    updateCounter();

    if (
        isRunning &&
        galleryQueue.length === 0 &&
        noMoreSearchPages &&
        renderedCount >= boardImages.length
    ) {
        setBoardState(
            STATES.DONE,
            `All done — ${boardImages.length} images across ${currentSearchPage} search page(s).`
        );

        showEnd();
    }
}

async function driveLoop() {
    if (driveLoopRunning) return;

    driveLoopRunning = true;

    const gen = generation;

    try {
        while (isRunning && gen === generation) {
            const hasBufferedImages =
                renderedCount < boardImages.length;

            const hasQueuedGalleries =
                galleryQueue.length > 0;

            const hasMoreSearchPages =
                !noMoreSearchPages;

            if (
                !hasBufferedImages &&
                !hasQueuedGalleries &&
                !hasMoreSearchPages
            ) {
                break;
            }

            await doNextStep();
        }

    } finally {
        driveLoopRunning = false;
    }
}

async function startBoard() {
    if (isRunning) return;

    generation++;

    lastSearchPageUrl = location.href;

    const pMatch = location.href.match(/[?&]page=(\d+)/);

    currentSearchPage = pMatch
        ? parseInt(pMatch[1], 10)
        : 1;

    noMoreSearchPages = false;
    consecutiveEmptyPages = 0;
    skippedGalleries = 0;

    const initialGalleries = discoverGalleriesFromDoc(document);

    if (!initialGalleries.length) {
        alert('No galleries found on this page (or everything here is blocked/filtered).');
        return;
    }

    seenGalleryUrls.clear();

    initialGalleries.forEach(g => {
        seenGalleryUrls.add(g.url);
    });

    galleryQueue = initialGalleries;

    boardImages = [];
    renderedCount = 0;

    isRunning = true;

    triggerBtn.style.display = 'none';

    createOverlay();

    setBoardState(
        STATES.LOADING,
        `Starting — ${galleryQueue.length} galleries queued…`
    );

    driveLoop();
}

/* ====================================================================
   THUMBNAIL RENDERING
   ==================================================================== */

function renderBatch(count) {
    const grid = document.getElementById('ifap-board-grid');

    const sentinel = document.getElementById('ifap-board-sentinel');

    if (!grid || !sentinel) return;

    const start = renderedCount;

    const end = Math.min(
        start + count,
        boardImages.length
    );

    if (start >= end) return;

    const slice = boardImages.slice(start, end);

    slice.forEach(item => {
        if (hiddenGalleries.has(item.galleryUrl)) {
            return;
        }

        const card = document.createElement('div');

        card.className = 'ifap-board-card';

        card.dataset.ifapGallery = item.galleryUrl;

        if (item.username) {
            card.dataset.ifapUsername = item.username;
        }

        card.style.cssText = `
            position:relative;
            background:#1e1e1e;
            border-radius:4px;
            overflow:hidden;
            border:1px solid #333;
            flex:0 0 auto;
            transition:transform .15s,box-shadow .15s;
        `;

        card.onmouseenter = () => {
            card.style.transform = 'scale(1.03)';
            card.style.boxShadow = '0 4px 12px rgba(51,102,204,.35)';
        };

        card.onmouseleave = () => {
            card.style.transform = 'scale(1)';
            card.style.boxShadow = 'none';
        };

        /* ------------------------------------------------------------
           THUMBNAIL
           ------------------------------------------------------------ */

        const a = document.createElement('a');

        a.href = item.photoUrl;
        a.target = '_blank';

        a.style.cssText = `
            display:inline-block;
            position:relative;
            line-height:0;
            text-decoration:none;
        `;

        const img = document.createElement('img');

        img.src = item.thumbUrl;
        img.alt = item.alt;
        img.loading = 'lazy';

        img.style.cssText = `
            display:block;
            width:auto;
            height:auto;
            max-width:160px;
            max-height:260px;
        `;

        a.appendChild(img);

        /* ------------------------------------------------------------
           NEW: IMAGE DIMENSION LABEL
           ------------------------------------------------------------ */

        if (item.width && item.height) {
            const largestDimension = Math.max(
                item.width,
                item.height
            );

            let backgroundColor;
            let textColor;

            if (largestDimension < 300) {
                // RED: Smaller than 300 px
                backgroundColor = '#e74c3c';
                textColor = '#ffffff';

            } else if (largestDimension <= 1000) {
                // YELLOW: 300–1000 px
                backgroundColor = '#f1c40f';
                textColor = '#111111';

            } else {
                // GREEN: Larger than 1000 px
                backgroundColor = '#2ecc71';
                textColor = '#111111';
            }

            const sizeLabel = document.createElement('span');

            sizeLabel.textContent =
                `${item.width}×${item.height}`;

            sizeLabel.style.cssText = `
                position:absolute;
                bottom:4px;
                left:4px;
                z-index:2;
                padding:2px 5px;
                background:${backgroundColor};
                color:${textColor};
                font-family:Arial,sans-serif;
                font-size:9px;
                font-weight:bold;
                line-height:12px;
                border-radius:8px;
                white-space:nowrap;
                box-shadow:0 1px 3px rgba(0,0,0,.5);
                pointer-events:none;
            `;

            a.appendChild(sizeLabel);
        }

        /* ------------------------------------------------------------
           GALLERY CAPTION AND COPY BUTTON
           ------------------------------------------------------------ */

        const bottom = document.createElement('div');

        bottom.style.cssText = `
            display:flex;
            align-items:center;
            padding:5px 7px;
            gap:4px;
            max-width:160px;
        `;

        const cap = document.createElement('div');

        cap.textContent = item.galleryTitle;
        cap.title = item.galleryTitle;

        cap.style.cssText = `
            flex:1;
            font-size:10px;
            color:#999;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
        `;

        const copyBtn = document.createElement('span');

        copyBtn.textContent = '📋';
        copyBtn.title = 'Copy gallery link';

        copyBtn.style.cssText = `
            flex:0 0 auto;
            cursor:pointer;
            font-size:12px;
            opacity:.7;
            line-height:1;
            user-select:none;
        `;

        copyBtn.onmouseenter = () => {
            copyBtn.style.opacity = '1';
        };

        copyBtn.onmouseleave = () => {
            copyBtn.style.opacity = '.7';
        };

        copyBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            navigator.clipboard.writeText(item.galleryUrl)
                .then(() => {
                    copyBtn.textContent = '✓';

                    setTimeout(() => {
                        copyBtn.textContent = '📋';
                    }, 1000);
                })
                .catch(() => {
                    const ta = document.createElement('textarea');

                    ta.value = item.galleryUrl;

                    document.body.appendChild(ta);

                    ta.select();

                    document.execCommand('copy');

                    ta.remove();

                    copyBtn.textContent = '✓';

                    setTimeout(() => {
                        copyBtn.textContent = '📋';
                    }, 1000);
                });
        };

        bottom.appendChild(cap);
        bottom.appendChild(copyBtn);

        card.appendChild(a);
        card.appendChild(bottom);

        /* ------------------------------------------------------------
           BLOCK USER BUTTON
           ------------------------------------------------------------ */

        if (item.username) {
            const blockBtn = document.createElement('span');

            blockBtn.textContent = '✖';

            blockBtn.title = `Block ${item.username} site-wide`;

            blockBtn.style.cssText = `
                position:absolute;
                top:4px;
                right:4px;
                width:20px;
                height:20px;
                background:rgba(255,0,0,.85);
                color:#fff;
                font-weight:bold;
                text-align:center;
                line-height:20px;
                border-radius:50%;
                cursor:pointer;
                font-size:11px;
                z-index:5;
            `;

            blockBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                blockUser(item.username);
            };

            card.appendChild(blockBtn);
        }

        /* ------------------------------------------------------------
           HIDE GALLERY BUTTON
           ------------------------------------------------------------ */

        const hideGalBtn = document.createElement('span');

        hideGalBtn.textContent = '–';

        hideGalBtn.title = 'Hide this gallery (this session only)';

        hideGalBtn.style.cssText = `
            position:absolute;
            top:${item.username ? '28px' : '4px'};
            right:4px;
            width:20px;
            height:20px;
            background:rgba(255,255,0,.95);
            color:#000;
            font-weight:bold;
            text-align:center;
            line-height:20px;
            border-radius:50%;
            cursor:pointer;
            font-size:14px;
            z-index:5;
        `;

        hideGalBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            removeGalleryFromBoard(item.galleryUrl);
        };

        card.appendChild(hideGalBtn);

        grid.insertBefore(card, sentinel);
    });

    renderedCount = end;

    updateCounter();
}

/* ====================================================================
   INFINITE SCROLL
   ==================================================================== */

function setupInfiniteScroll() {
    const sentinel = document.getElementById('ifap-board-sentinel');

    const grid = document.getElementById('ifap-board-grid');

    if (!sentinel || !grid || infiniteObserver) {
        return;
    }

    infiniteObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                driveLoop();
            }
        });

    }, {
        root: grid,
        rootMargin: '0px 0px 600px 0px',
        threshold: 0
    });

    infiniteObserver.observe(sentinel);
}

})();
