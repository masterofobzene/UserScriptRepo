// ==UserScript==
// @name         ImageFap Gallery Board (with User/Gallery Hider)
// @namespace    ifap-gallery-board
// @version      2.0
// @description  Loads galleries from the current search/category page (and automatically continues to page 2, 3, ... of the search results) with a polite 5-second delay between requests, displays every thumbnail with scroll-gated infinite loading, and integrates a persistent block-list so hidden users/galleries are filtered out everywhere — including on search-result pages fetched in the background, not just the live page.
// @author       You (Board) / masterofobzene (original Hider logic, integrated)
// @match        https://www.imagefap.com/gallery.php*
// @match        https://www.imagefap.com/pictures/*
// @match        https://www.imagefap.com/pics/*
// @icon         https://www.imagefap.com/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      www.imagefap.com
// @run-at       document-end
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/ImageFap_User_Gallery_Hider.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/ImageFap_User_Gallery_Hider.user.js
// @icon         https://www.imagefap.com/favicon.ico
// ==/UserScript==

(function() {
    'use strict';

    /* ====================================================================
       SHARED BLOCK-LIST STATE
       Used by both the live-page Hider UI and the Gallery Board's
       background page fetching, so a block applies everywhere.
       ==================================================================== */
    const hiddenUsersKey  = 'imagefap_hidden_users';
    const hideConfigKey   = 'imagefap_hide_filters';
    const panelPosKey     = 'imagefap_gender_panel_pos';
    const menuCollapsedKey = 'imagefap_menu_collapsed';

    let hiddenUsers = new Set(GM_getValue(hiddenUsersKey, []));

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

    function blockUser(username) {
        if (!username) return;
        username = username.toLowerCase();
        if (hiddenUsers.has(username)) return;
        hiddenUsers.add(username);
        GM_setValue(hiddenUsersKey, [...hiddenUsers]);
        console.log(`[ImageFap Hider] User blocked: ${username}`);
        hideAllGalleriesForUser(username);   // update the live page, if present
        removeUserFromBoard(username);       // update the open Gallery Board, if present
    }

    /* ====================================================================
       SHARED FILTER LOGIC (gender / country / pic-count / blocked user)
       Works against either the live document or a document fetched via
       GM_xmlhttpRequest, since it only reads DOM structure/attributes,
       never relies on inline styles set by the live-page MutationObserver.
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

    // The single source of truth for "should this gallery be filtered out?"
    // Used by the live-page hider AND by the Board's discoverGalleriesFromDoc.
    function isGalleryHidden(titleRow, detailRow) {
        if (!titleRow) return true;
        if (titleRow.style && titleRow.style.display === 'none') return true; // already hidden live
        if (!detailRow || detailRow.tagName !== 'TR') return false; // can't evaluate further, don't hide by default
        if (detailRow.style && detailRow.style.display === 'none') return true;

        const username = getGalleryUsername(detailRow);
        if (username && hiddenUsers.has(username)) return true;
        if (username && shouldHideByFilter(detailRow)) return true;

        const picCount = getPicCount(titleRow);
        if (picCount !== null && picCount < 4) return true;

        return false;
    }

    /* ====================================================================
       LIVE-PAGE HIDER UI (gender/country panel, per-gallery block button,
       collapsible menu) — unchanged behaviour, just sharing state above.
       ==================================================================== */
    function createGenderPanel() {
        if (document.getElementById('genderFilterPanel')) return;
        const cfg = getHideConfig();
        const pos = GM_getValue(panelPosKey, { top: 120, right: 10 });

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
                GM_setValue(menuCollapsedKey, !GM_getValue(menuCollapsedKey, false));
                applyMenuState();
            };
        });
        applyMenuState();
    }

    function hideRow(titleRow, detailRow) {
        titleRow.style.display = 'none';
        if (detailRow) detailRow.style.display = 'none';
    }

    function hideAllGalleriesForUser(username) {
        document.querySelectorAll('div.avatar').forEach(avatar => {
            const link = avatar.querySelector('a.gal_title');
            if (!link) return;
            if (link.textContent.trim().toLowerCase() !== username) return;
            let detailRow = avatar;
            while (detailRow && detailRow.tagName !== 'TR') detailRow = detailRow.parentElement;
            if (!detailRow) return;
            const titleRow = detailRow.previousElementSibling;
            if (titleRow?.tagName === 'TR') hideRow(titleRow, detailRow);
        });
    }

    function processGallery(titleRow) {
        const detailRow = titleRow.nextElementSibling;
        if (!detailRow || detailRow.getAttribute('valign') !== 'top') return;
        const avatar = detailRow.querySelector('div.avatar');
        const userLink = avatar?.querySelector('a.gal_title');
        if (!avatar || !userLink) return;

        if (isGalleryHidden(titleRow, detailRow)) {
            hideRow(titleRow, detailRow);
            return;
        }

        if (avatar.querySelector('.ifap-hide-btn')) return;
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
                while (titleRow && titleRow.tagName !== 'TR') titleRow = titleRow.parentElement;
                if (titleRow) processGallery(titleRow);
            });
        } catch (err) {
            console.error('[ImageFap Hider] applyAll failed', err);
        }
    }

    let applyTimeout = null;
    const debouncedApplyAll = () => {
        if (applyTimeout) clearTimeout(applyTimeout);
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
    const DELAY_MS   = 5000;   // polite delay between HTTP requests
    const BATCH_SIZE  = 60;    // images rendered per scroll-triggered chunk

    let boardImages       = [];    // all images discovered so far
    let renderedCount     = 0;     // how many of boardImages are in the DOM
    let galleryQueue      = [];    // galleries discovered but not yet crawled
    let currentSearchPage = 1;     // which search-results page we're on
    let searchPageBaseUrl = '';    // current search URL with any "page" param stripped
    let noMoreSearchPages = false;
    let isRunning          = false;
    let infiniteObserver   = null;
    let lastRequestAt      = 0;    // timestamp of last network request (for the delay)

    let sentinelIntersecting = false; // is the sentinel currently in view?
    let driveLoopRunning     = false; // single-flight guard for the loop

    /* ---- Trigger button (small, left side) ---- */
    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'ifap-board-trigger';
    triggerBtn.textContent = '⚡ Booru Mode';
    triggerBtn.title = 'Open All Galleries';
    triggerBtn.style.cssText = `
        position:fixed;top:90px;left:12px;z-index:2147483647;
        width:32px;height:32px;padding:0;background:#3366cc;color:#fff;
        border:none;border-radius:6px;font-size:15px;font-weight:bold;
        cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4);
        font-family:sans-serif;line-height:32px;text-align:center;
    `;
    triggerBtn.addEventListener('click', startBoard);
    document.body.appendChild(triggerBtn);

    /* ---- Discover galleries in a document (live page or fetched page),
       skipping anything the block-list / filters would hide. Because
       isGalleryHidden() reads structure (username, pic count, gender,
       country) rather than inline styles, this now works correctly on
       pages fetched in the background too — not just the live DOM. ---- */
    function discoverGalleriesFromDoc(doc) {
        const links = doc.querySelectorAll('a[href^="/gallery.php?gid="]');
        const map = new Map();
        links.forEach(a => {
            let titleRow = a;
            while (titleRow && titleRow.tagName !== 'TR') titleRow = titleRow.parentElement;
            if (!titleRow) return;
            const detailRow = titleRow.nextElementSibling;
            if (isGalleryHidden(titleRow, detailRow)) return;

            const href = a.getAttribute('href').split('&')[0];
            if (!map.has(href)) {
                map.set(href, {
                    url: href,
                    title: (a.textContent || 'Untitled').trim(),
                    username: getGalleryUsername(detailRow)
                });
            }
        });
        return Array.from(map.values());
    }

    function stripPageParam(url) {
        const u = new URL(url, location.origin);
        u.searchParams.delete('page');
        return u;
    }

    function buildSearchPageUrl(pageNum) {
        const u = new URL(searchPageBaseUrl);
        if (pageNum > 1) u.searchParams.set('page', String(pageNum));
        return u.toString();
    }

    function findNextSearchPageUrlFromDoc(doc, currentUrl, wantPage) {
        const relNext = doc.querySelector('link[rel="next"]');
        if (relNext && relNext.getAttribute('href')) {
            return new URL(relNext.getAttribute('href'), currentUrl).toString();
        }
        const anchors = doc.querySelectorAll('a[href*="gallery.php"]');
        for (const a of anchors) {
            const href = a.getAttribute('href');
            if (!href) continue;
            try {
                const u = new URL(href, currentUrl);
                const p = u.searchParams.get('page');
                if (p && parseInt(p, 10) === wantPage) return u.toString();
            } catch (e) { /* ignore malformed href */ }
        }
        return buildSearchPageUrl(wantPage);
    }

    function createOverlay() {
        const existing = document.getElementById('ifap-board-overlay');
        if (existing) existing.remove();

        const ov = document.createElement('div');
        ov.id = 'ifap-board-overlay';
        ov.style.cssText = `
            position:fixed;top:0;left:0;right:0;bottom:0;
            background:#121212;z-index:2147483646;
            display:flex;flex-direction:column;
            font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            position:sticky;top:0;z-index:10;
            background:#1e1e1e;border-bottom:2px solid #3366cc;
            padding:12px 20px;display:flex;align-items:center;gap:15px;
            color:#fff;flex-wrap:wrap;
        `;
        header.innerHTML = `
            <div style="flex:1 1 auto;">
                <div style="font-size:18px;font-weight:bold;">🖼️ Gallery Board</div>
                <div id="ifap-board-status" style="font-size:12px;color:#aaa;margin-top:3px;">
                    Preparing…
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
                <span id="ifap-board-counter" style="font-size:12px;color:#aaa;">0 images</span>
                <button id="ifap-board-stop" style="padding:6px 14px;background:#c0392b;border:none;border-radius:4px;color:#fff;cursor:pointer;font-weight:bold;">Stop</button>
                <button id="ifap-board-close" style="padding:6px 14px;background:#444;border:none;border-radius:4px;color:#fff;cursor:pointer;font-weight:bold;">Close</button>
            </div>
        `;

        const grid = document.createElement('div');
        grid.id = 'ifap-board-grid';
        grid.style.cssText = `
            flex:1 1 auto;overflow-y:auto;padding:15px;
            display:flex;flex-wrap:wrap;gap:10px;
            align-content:flex-start;align-items:flex-start;
            justify-content:center;
        `;

        const sentinel = document.createElement('div');
        sentinel.id = 'ifap-board-sentinel';
        sentinel.style.cssText = `
            width:100%;height:50px;display:flex;align-items:center;
            justify-content:center;color:#666;font-size:12px;
        `;
        sentinel.textContent = 'Scroll to load more…';

        const endMarker = document.createElement('div');
        endMarker.id = 'ifap-board-end';
        endMarker.style.cssText = `
            display:none;width:100%;text-align:center;padding:20px;
            color:#555;font-size:13px;
        `;
        endMarker.textContent = '— End —';

        ov.appendChild(header);
        ov.appendChild(grid);
        document.body.appendChild(ov);

        grid.appendChild(sentinel);
        grid.appendChild(endMarker);

        document.getElementById('ifap-board-close').onclick = destroyOverlay;
        document.getElementById('ifap-board-stop').onclick = stopLoading;

        const escHandler = (e) => { if (e.key === 'Escape') destroyOverlay(); };
        document.addEventListener('keydown', escHandler);
        ov._escHandler = escHandler;

        setupInfiniteScroll();
    }

    function destroyOverlay() {
        isRunning = false;
        sentinelIntersecting = false;
        if (infiniteObserver) { infiniteObserver.disconnect(); infiniteObserver = null; }
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
    }

    function stopLoading() {
        isRunning = false;
        const status = document.getElementById('ifap-board-status');
        if (status) status.textContent += ' (stopped by user)';
    }

    // Remove a user's cards from the open board, and drop their galleries
    // from the pending queue, the moment they're blocked (from the live
    // page's ✖ button, or from the board's own per-card block button).
    function removeUserFromBoard(username) {
        const grid = document.getElementById('ifap-board-grid');
        if (grid) {
            grid.querySelectorAll(`[data-ifap-username="${CSS.escape(username)}"]`).forEach(el => el.remove());
        }
        galleryQueue = galleryQueue.filter(g => g.username !== username);
        const counterEl = document.getElementById('ifap-board-counter');
        if (counterEl) counterEl.textContent = `${boardImages.length} images found`;
    }

    function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    async function waitForPoliteGap() {
        const elapsed = Date.now() - lastRequestAt;
        if (elapsed < DELAY_MS) await sleep(DELAY_MS - elapsed);
    }

    function fetchDocument(url) {
        return new Promise((resolve, reject) => {
            if (!isRunning) return reject(new Error('Aborted'));
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: (res) => {
                    if (!isRunning) return reject(new Error('Aborted'));
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(res.responseText, 'text/html');
                    resolve(doc);
                },
                onerror: reject
            });
        });
    }

    async function politeFetch(url) {
        await waitForPoliteGap();
        lastRequestAt = Date.now();
        return fetchDocument(url);
    }

    function extractImagesFromGalleryDoc(doc, galleryMeta) {
        const out = [];
        const anchors = doc.querySelectorAll('a[href^="/photo/"]');
        anchors.forEach(a => {
            const img = a.querySelector('img');
            if (!img) return;
            const photoHref = a.getAttribute('href');
            let thumb = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original');
            if (!thumb) return;
            if (thumb.startsWith('//')) thumb = 'https:' + thumb;
            else if (thumb.startsWith('/')) thumb = 'https://www.imagefap.com' + thumb;
            const fullPhoto = photoHref.startsWith('http') ? photoHref : 'https://www.imagefap.com' + photoHref;
            out.push({
                photoUrl: fullPhoto,
                thumbUrl: thumb,
                galleryTitle: galleryMeta.title,
                username: galleryMeta.username,
                alt: (img.alt || '').replace(/Free porn pics of /i, '')
            });
        });
        return out;
    }

    function findNextGalleryPageUrl(doc, currentUrl, gid) {
        const curMatch = currentUrl.match(/[?&]page=(\d+)/);
        const curPage = curMatch ? parseInt(curMatch[1]) : 1;
        const want = curPage + 1;
        const relNext = doc.querySelector('link[rel="next"]');
        if (relNext) {
            const h = relNext.getAttribute('href');
            if (h && h.includes('gid=' + gid)) return h;
        }
        const links = doc.querySelectorAll('a[href*="gid=' + gid + '"]');
        for (const a of links) {
            const h = a.getAttribute('href');
            if (!h || !h.includes('gallery.php')) continue;
            const m = h.match(/[?&]page=(\d+)/);
            if (m && parseInt(m[1]) === want) return h;
        }
        return null;
    }

    async function crawlGallery(gallery, statusEl) {
        // Skip work entirely if this gallery's uploader got blocked while queued.
        if (gallery.username && hiddenUsers.has(gallery.username)) return;

        let pageUrl = 'https://www.imagefap.com' + gallery.url;
        let safety = 0;
        while (pageUrl && isRunning && safety < 200) {
            safety++;
            // Re-check on every page in case the user got blocked mid-crawl.
            if (gallery.username && hiddenUsers.has(gallery.username)) return;
            try {
                statusEl.textContent = `Loading "${gallery.title}" (page ${safety})…`;
                const doc = await politeFetch(pageUrl);
                const imgs = extractImagesFromGalleryDoc(doc, gallery);
                if (imgs.length) {
                    boardImages.push(...imgs);
                    if (renderedCount < boardImages.length) renderBatch(BATCH_SIZE);
                }
                const gidMatch = gallery.url.match(/gid=(\d+)/);
                const gid = gidMatch ? gidMatch[1] : '';
                const next = findNextGalleryPageUrl(doc, pageUrl, gid);
                pageUrl = next ? (next.startsWith('http') ? next : 'https://www.imagefap.com' + next) : null;
            } catch (e) {
                console.warn('[ifap-board] Gallery page failed:', pageUrl, e);
                break;
            }
        }
    }

    async function loadNextSearchPage(statusEl) {
        if (noMoreSearchPages || !isRunning) return;
        const wantPage = currentSearchPage + 1;
        const guessUrl = buildSearchPageUrl(wantPage);
        statusEl.textContent = `Loading search results page ${wantPage}…`;
        try {
            const doc = await politeFetch(guessUrl);
            const resolvedUrl = findNextSearchPageUrlFromDoc(doc, guessUrl, wantPage);
            let finalDoc = doc;
            if (resolvedUrl !== guessUrl) {
                try {
                    finalDoc = await politeFetch(resolvedUrl);
                } catch (e) { finalDoc = doc; }
            }
            const newGalleries = discoverGalleriesFromDoc(finalDoc); // block-list already applied here
            if (!newGalleries.length) {
                noMoreSearchPages = true;
                statusEl.textContent = `No more results after page ${currentSearchPage}.`;
                return;
            }
            currentSearchPage = wantPage;
            galleryQueue.push(...newGalleries);
        } catch (e) {
            console.warn('[ifap-board] Failed to load next search page:', e);
            noMoreSearchPages = true;
        }
    }

    async function doNextStep() {
        if (!isRunning) return;
        const statusEl = document.getElementById('ifap-board-status');
        const counterEl = document.getElementById('ifap-board-counter');
        if (!statusEl) return;

        if (renderedCount < boardImages.length) {
            renderBatch(BATCH_SIZE);
            return;
        }

        if (galleryQueue.length > 0) {
            const gallery = galleryQueue.shift();
            statusEl.textContent = `Gallery: "${gallery.title}" (search page ${currentSearchPage})`;
            await crawlGallery(gallery, statusEl);
        } else if (!noMoreSearchPages) {
            await loadNextSearchPage(statusEl);
        }

        if (counterEl) counterEl.textContent = `${boardImages.length} images found`;

        if (isRunning && galleryQueue.length === 0 && noMoreSearchPages && renderedCount >= boardImages.length) {
            statusEl.textContent = `All done — ${boardImages.length} images across ${currentSearchPage} search page(s).`;
            const sentinel = document.getElementById('ifap-board-sentinel');
            const endMarker = document.getElementById('ifap-board-end');
            if (sentinel) sentinel.style.display = 'none';
            if (endMarker) endMarker.style.display = 'block';
        }
    }

    async function driveLoop() {
        if (driveLoopRunning) return;
        driveLoopRunning = true;
        try {
            while (isRunning && sentinelIntersecting) {
                const hasBufferedImages   = renderedCount < boardImages.length;
                const hasQueuedGalleries  = galleryQueue.length > 0;
                const hasMoreSearchPages  = !noMoreSearchPages;
                if (!hasBufferedImages && !hasQueuedGalleries && !hasMoreSearchPages) break;
                await doNextStep();
            }
        } finally {
            driveLoopRunning = false;
        }
    }

    async function startBoard() {
        if (isRunning) return;

        searchPageBaseUrl = stripPageParam(location.href).toString();
        const pMatch = location.href.match(/[?&]page=(\d+)/);
        currentSearchPage = pMatch ? parseInt(pMatch[1], 10) : 1;
        noMoreSearchPages = false;

        const initialGalleries = discoverGalleriesFromDoc(document); // block-list applied
        if (!initialGalleries.length) {
            alert('No galleries found on this page (or everything here is blocked/filtered).');
            return;
        }
        galleryQueue = initialGalleries;
        boardImages = [];
        renderedCount = 0;

        isRunning = true;
        triggerBtn.style.display = 'none';

        createOverlay();
        driveLoop();
    }

    function renderBatch(count) {
        const grid = document.getElementById('ifap-board-grid');
        const counter = document.getElementById('ifap-board-counter');
        const sentinel = document.getElementById('ifap-board-sentinel');
        if (!grid || !sentinel) return;

        const start = renderedCount;
        const end = Math.min(start + count, boardImages.length);
        if (start >= end) return;

        const slice = boardImages.slice(start, end);
        slice.forEach(item => {
            const card = document.createElement('div');
            card.className = 'ifap-board-card';
            if (item.username) card.dataset.ifapUsername = item.username;
            card.style.cssText = `
                position:relative;background:#1e1e1e;border-radius:4px;overflow:hidden;
                border:1px solid #333;flex:0 0 auto;
                transition:transform .15s,box-shadow .15s;
            `;
            card.onmouseenter = () => { card.style.transform='scale(1.03)'; card.style.boxShadow='0 4px 12px rgba(51,102,204,.35)'; };
            card.onmouseleave = () => { card.style.transform='scale(1)'; card.style.boxShadow='none'; };

            const a = document.createElement('a');
            a.href = item.photoUrl;
            a.target = '_blank';
            a.style.textDecoration = 'none';

            const img = document.createElement('img');
            img.src = item.thumbUrl;
            img.alt = item.alt;
            img.loading = 'lazy';
            img.style.cssText = 'display:block;width:auto;height:auto;max-width:160px;max-height:260px;';

            const cap = document.createElement('div');
            cap.textContent = item.galleryTitle;
            cap.title = item.galleryTitle;
            cap.style.cssText = 'padding:5px 7px;font-size:10px;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;';

            a.appendChild(img);
            card.appendChild(a);
            card.appendChild(cap);

            if (item.username) {
                const blockBtn = document.createElement('span');
                blockBtn.textContent = '✖';
                blockBtn.title = `Block ${item.username} site-wide`;
                blockBtn.style.cssText = `
                    position:absolute;top:4px;right:4px;width:20px;height:20px;
                    background:rgba(255,0,0,.85);color:#fff;font-weight:bold;
                    text-align:center;line-height:20px;border-radius:50%;
                    cursor:pointer;font-size:11px;z-index:5;
                `;
                blockBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    blockUser(item.username);
                };
                card.appendChild(blockBtn);
            }

            grid.insertBefore(card, sentinel);
        });

        renderedCount = end;
        if (counter) counter.textContent = `${renderedCount} / ${boardImages.length} images shown`;
    }

    function setupInfiniteScroll() {
        const sentinel = document.getElementById('ifap-board-sentinel');
        const grid = document.getElementById('ifap-board-grid');
        if (!sentinel || !grid || infiniteObserver) return;

        infiniteObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                sentinelIntersecting = entry.isIntersecting;
                if (entry.isIntersecting) driveLoop();
            });
        }, {
            root: grid,
            rootMargin: '0px 0px 600px 0px',
            threshold: 0
        });
        infiniteObserver.observe(sentinel);
    }

})();
