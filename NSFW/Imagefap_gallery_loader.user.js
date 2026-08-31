// ==UserScript==
// @name         ImageFap Gallery Board
// @namespace    ifap-gallery-board
// @version      1.1
// @description  Loads all galleries from the current page with a polite 5-second delay, respects ImageFap User Gallery Hider filters, then displays every thumbnail in natural size with infinite scroll while preserving links to the full image pages.
// @author       You
// @match        https://www.imagefap.com/gallery.php*
// @match        https://www.imagefap.com/pictures/*
// @grant        GM_xmlhttpRequest
// @connect      www.imagefap.com
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const DELAY_MS = 5000;           // polite delay between HTTP requests
    const BATCH_SIZE = 60;           // images per infinite-scroll chunk
    let galleries = [];
    let boardImages = [];
    let isRunning = false;
    let renderedCount = 0;
    let infiniteObserver = null;

    /* ------------------------------------------------------------------
       1. Inject the trigger button
       ------------------------------------------------------------------ */
    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'ifap-board-trigger';
    triggerBtn.textContent = '📂 Open All Galleries';
    triggerBtn.style.cssText = `
        position:fixed;top:90px;right:20px;z-index:2147483647;
        padding:12px 18px;background:#3366cc;color:#fff;border:none;
        border-radius:6px;font-size:14px;font-weight:bold;cursor:pointer;
        box-shadow:0 4px 14px rgba(0,0,0,.4);font-family:sans-serif;
    `;
    triggerBtn.addEventListener('click', startBoard);
    document.body.appendChild(triggerBtn);

    /* ------------------------------------------------------------------
       2. Discover galleries on the current search / category page
          (skip rows hidden by ImageFap User Gallery Hider)
       ------------------------------------------------------------------ */
    function discoverGalleries() {
        const links = document.querySelectorAll('a[href^="/gallery.php?gid="]');
        const map = new Map();
        links.forEach(a => {
            // Walk up to the containing <tr> (title row)
            let tr = a;
            while (tr && tr.tagName !== 'TR') tr = tr.parentElement;
            if (!tr) return;

            // Respect ImageFap User Gallery Hider:
            // If the title row or its detail row is hidden, skip this gallery.
            if (tr.style.display === 'none') return;
            const detailRow = tr.nextElementSibling;
            if (detailRow && detailRow.tagName === 'TR' && detailRow.style.display === 'none') return;

            const href = a.getAttribute('href').split('&')[0]; // strip extra params
            if (!map.has(href)) {
                map.set(href, {
                    url: href,
                    title: (a.textContent || 'Untitled').trim()
                });
            }
        });
        return Array.from(map.values());
    }

    /* ------------------------------------------------------------------
       3. Build the board overlay
       ------------------------------------------------------------------ */
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

        // Header
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

        // Grid container (flex-wrap for natural thumbnail sizes)
        const grid = document.createElement('div');
        grid.id = 'ifap-board-grid';
        grid.style.cssText = `
            flex:1 1 auto;overflow-y:auto;padding:15px;
            display:flex;flex-wrap:wrap;gap:10px;
            align-content:flex-start;align-items:flex-start;
            justify-content:center;
        `;

        // Infinite-scroll sentinel
        const sentinel = document.createElement('div');
        sentinel.id = 'ifap-board-sentinel';
        sentinel.style.cssText = `
            width:100%;height:50px;display:flex;align-items:center;
            justify-content:center;color:#666;font-size:12px;
        `;
        sentinel.textContent = 'Scroll to load more…';

        // End-of-results marker
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

        // Append sentinel and end marker inside grid so they flow with content
        grid.appendChild(sentinel);
        grid.appendChild(endMarker);

        document.getElementById('ifap-board-close').onclick = destroyOverlay;
        document.getElementById('ifap-board-stop').onclick = stopLoading;

        const escHandler = (e) => { if (e.key === 'Escape') destroyOverlay(); };
        document.addEventListener('keydown', escHandler);
        ov._escHandler = escHandler;
    }

    function destroyOverlay() {
        isRunning = false;
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
        triggerBtn.textContent = '📂 Open All Galleries';
        triggerBtn.disabled = false;
        boardImages = [];
        renderedCount = 0;
    }

    function stopLoading() {
        isRunning = false;
        const status = document.getElementById('ifap-board-status');
        if (status) status.textContent += ' (stopped by user)';
    }

    /* ------------------------------------------------------------------
       4. Fetch logic with 5-second politeness delay
       ------------------------------------------------------------------ */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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

    function extractImagesFromGalleryDoc(doc, galleryMeta) {
        const out = [];
        // ImageFap gallery pages contain <a href="/photo/12345/"> wrapping <img>
        const anchors = doc.querySelectorAll('a[href^="/photo/"]');
        anchors.forEach(a => {
            const img = a.querySelector('img');
            if (!img) return;
            const photoHref = a.getAttribute('href');
            let thumb = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original');
            if (!thumb) return;

            // Normalise thumbnail URL
            if (thumb.startsWith('//')) thumb = 'https:' + thumb;
            else if (thumb.startsWith('/')) thumb = 'https://www.imagefap.com' + thumb;

            const fullPhoto = photoHref.startsWith('http') ? photoHref : 'https://www.imagefap.com' + photoHref;

            out.push({
                photoUrl: fullPhoto,
                thumbUrl: thumb,
                galleryTitle: galleryMeta.title,
                alt: (img.alt || '').replace(/Free porn pics of /i, '')
            });
        });
        return out;
    }

    function findNextGalleryPageUrl(doc, currentUrl, gid) {
        const curMatch = currentUrl.match(/[?&]page=(\d+)/);
        const curPage = curMatch ? parseInt(curMatch[1]) : 1;
        const want = curPage + 1;

        // Strategy A: look for <link rel="next"> inside the gallery page
        const relNext = doc.querySelector('link[rel="next"]');
        if (relNext) {
            const h = relNext.getAttribute('href');
            if (h && h.includes('gid=' + gid)) return h;
        }

        // Strategy B: scan anchor tags pointing to same gid with page=want
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
        let pageUrl = 'https://www.imagefap.com' + gallery.url;
        let safety = 0;

        while (pageUrl && isRunning && safety < 200) {
            safety++;
            try {
                const doc = await fetchDocument(pageUrl);
                const imgs = extractImagesFromGalleryDoc(doc, gallery);
                if (imgs.length) {
                    boardImages.push(...imgs);
                    // Keep the viewport fed as new images arrive
                    if (renderedCount < boardImages.length) {
                        renderBatch(BATCH_SIZE);
                    }
                }

                const gidMatch = gallery.url.match(/gid=(\d+)/);
                const gid = gidMatch ? gidMatch[1] : '';
                const next = findNextGalleryPageUrl(doc, pageUrl, gid);
                pageUrl = next ? (next.startsWith('http') ? next : 'https://www.imagefap.com' + next) : null;

                if (pageUrl) {
                    statusEl.textContent = `Loading "${gallery.title}" (page ${safety + 1})…`;
                    await sleep(DELAY_MS);
                }
            } catch (e) {
                console.warn('Gallery page failed:', pageUrl, e);
                break;
            }
        }
    }

    async function startBoard() {
        if (isRunning) return;
        galleries = discoverGalleries();
        if (!galleries.length) {
            alert('No galleries found on this page (or all were hidden by filters).');
            return;
        }

        isRunning = true;
        triggerBtn.disabled = true;
        triggerBtn.textContent = '⏳ Loading…';
        createOverlay();

        const statusEl = document.getElementById('ifap-board-status');
        const counterEl = document.getElementById('ifap-board-counter');

        for (let i = 0; i < galleries.length && isRunning; i++) {
            const g = galleries[i];
            statusEl.textContent = `Gallery ${i + 1}/${galleries.length}: "${g.title}"`;
            await crawlGallery(g, statusEl);

            if (i < galleries.length - 1 && isRunning) {
                statusEl.textContent = `Waiting 5 s before next gallery… (${i + 1}/${galleries.length} done)`;
                await sleep(DELAY_MS);
            }
        }

        if (isRunning) {
            statusEl.textContent = `All done — ${boardImages.length} images from ${galleries.length} galleries.`;
            triggerBtn.textContent = '✅ Finished';
            // Ensure everything remaining is rendered
            while (renderedCount < boardImages.length) {
                renderBatch(BATCH_SIZE);
            }
        }
    }

    /* ------------------------------------------------------------------
       5. Render batches + infinite scroll
       ------------------------------------------------------------------ */
    function renderBatch(count) {
        const grid = document.getElementById('ifap-board-grid');
        const counter = document.getElementById('ifap-board-counter');
        const sentinel = document.getElementById('ifap-board-sentinel');
        const endMarker = document.getElementById('ifap-board-end');
        if (!grid) return;

        const start = renderedCount;
        const end = Math.min(start + count, boardImages.length);
        if (start >= end) return;

        const slice = boardImages.slice(start, end);

        slice.forEach(item => {
            const card = document.createElement('div');
            card.className = 'ifap-board-card';
            card.style.cssText = `
                background:#1e1e1e;border-radius:4px;overflow:hidden;
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
            // Natural size – capped so a rogue image doesn’t fill the screen
            img.style.cssText = 'display:block;width:auto;height:auto;max-width:160px;max-height:260px;';

            const cap = document.createElement('div');
            cap.textContent = item.galleryTitle;
            cap.title = item.galleryTitle;
            cap.style.cssText = 'padding:5px 7px;font-size:10px;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;';

            a.appendChild(img);
            card.appendChild(a);
            card.appendChild(cap);

            // Insert before sentinel so new cards flow upward
            grid.insertBefore(card, sentinel);
        });

        renderedCount = end;
        if (counter) counter.textContent = `${renderedCount} / ${boardImages.length} images shown`;

        if (renderedCount >= boardImages.length) {
            if (sentinel) sentinel.style.display = 'none';
            if (endMarker) endMarker.style.display = 'block';
        } else {
            if (sentinel) sentinel.style.display = 'flex';
        }
    }

    function setupInfiniteScroll() {
        const sentinel = document.getElementById('ifap-board-sentinel');
        if (!sentinel || infiniteObserver) return;

        infiniteObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && renderedCount < boardImages.length) {
                    // Slight delay to let the browser breathe
                    setTimeout(() => renderBatch(BATCH_SIZE), 150);
                }
            });
        }, {
            root: document.getElementById('ifap-board-grid'),
            rootMargin: '0px 0px 600px 0px', // preload well before bottom
            threshold: 0
        });

        infiniteObserver.observe(sentinel);
    }

    // Hook setupInfiniteScroll into overlay creation
    const _origCreateOverlay = createOverlay;
    // We already call setupInfiniteScroll after the first renderBatch in crawl/start,
    // but let's also ensure it's ready right after overlay creation.
    const origCreate = createOverlay;
    createOverlay = function() {
        origCreate();
        // Observer will be attached once first batch is rendered
    };
})();
