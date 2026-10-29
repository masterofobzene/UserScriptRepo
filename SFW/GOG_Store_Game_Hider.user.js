// ==UserScript==
// @name         GOG Store Game Hider + Paced Load
// @namespace    GOG_Store_Game_Hider
// @version      1.2
// @description  Hide games on GOG store + load all filtered games + hover preview + pirate links
// @match        https://www.gog.com/*/games*
// @match        https://www.gog.com/games*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      catalog.gog.com
// @run-at       document-end
// @license      GNU GPLv3
// @author       masterofobzene
// @icon         https://www.gog.com/favicon.ico
// @homepage     https://github.com/masterofobzene/UserScriptRepo
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/GOG_Store_Game_Hider.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/GOG_Store_Game_Hider.user.js
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'gogHiddenGames';
    const TILE_SELECTOR = '.product-tile, product-tile-extended';
    const GRID_SELECTOR = '.paginated-products-grid';
    const PAGE_LIMIT = 48;
    const DELAY_MS = 1000;

    const PIRATE_LINKS = [
        { url: 'https://forum.torrminatorr.com/search.php?keywords=', suffix: '', label: 'Torrminatorr', title: 'Search on Torrminatorr' },
        { url: 'https://cs.rin.ru/forum/search.php?keywords=', suffix: '', label: 'cs.rin.ru', title: 'Search on cs.rin.ru (steam version)' },
        { url: 'https://www.youtube.com/results?search_query=', suffix: ' gameplay no commentary', label: 'Gameplay', title: 'Gameplay Video' }
    ];

    // Fixed popup geometry so we can position before images load.
    const PV_PAD = 10;
    const PV_TITLE_H = 22;
    const PV_TITLE_MB = 8;
    const PV_GAP = 8;
    const PV_IMG_W = 200;
    const PV_IMG_H = 112;
    const PV_PER_ROW = 3;
    const PV_WIDTH = PV_PER_ROW * PV_IMG_W + (PV_PER_ROW - 1) * PV_GAP + PV_PAD * 2;
    const PV_HEIGHT = PV_TITLE_H + PV_TITLE_MB + PV_IMG_H + PV_PAD * 2;

    let hiddenGames = new Set();
    let expanded = false;

    let previewEl = null;
    let previewTimer = null;

    // ---------- custom hover preview ----------
    function ensurePreviewEl() {
        if (previewEl) return previewEl;
        previewEl = document.createElement('div');
        previewEl.id = 'gog-custom-preview';
        previewEl.style.cssText = `
            position: fixed;
            z-index: 999999;
            box-sizing: content-box;
            width: ${PV_WIDTH - PV_PAD * 2}px;
            height: ${PV_HEIGHT - PV_PAD * 2}px;
            background: #14161a;
            border: 1px solid #2a2d33;
            border-radius: 6px;
            padding: ${PV_PAD}px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.75);
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s;
            overflow: hidden;
        `;
        document.body.appendChild(previewEl);
        return previewEl;
    }

    function showPreview(tile, product) {
        const shots = (product.screenshots || []).slice(0, PV_PER_ROW);
        if (!shots.length) return;
        const el = ensurePreviewEl();
        const urls = shots.map(s => s.replace('{formatter}', 'product_card_v2_mobile_slider_639'));

        el.innerHTML = `
            <div style="color:#fff;font-size:14px;font-weight:600;height:${PV_TITLE_H}px;line-height:${PV_TITLE_H}px;margin-bottom:${PV_TITLE_MB}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:${PV_WIDTH - PV_PAD * 2}px;">${product.title.replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]))}</div>
            <div style="display:flex;gap:${PV_GAP}px;">${urls.map(u => `<img src="${u}" width="${PV_IMG_W}" height="${PV_IMG_H}" style="width:${PV_IMG_W}px;height:${PV_IMG_H}px;object-fit:cover;border-radius:4px;display:block;flex:none;">`).join('')}</div>
        `;

        const r = tile.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let top = r.top - PV_HEIGHT - 10;
        let left = r.left + (r.width - PV_WIDTH) / 2;

        if (top < 10) {
            top = Math.max(10, r.top + (r.height - PV_HEIGHT) / 2);
            if (r.right + 10 + PV_WIDTH <= vw - 10) {
                left = r.right + 10;
            } else if (r.left - 10 - PV_WIDTH >= 10) {
                left = r.left - PV_WIDTH - 10;
            } else {
                top = Math.max(10, r.top - PV_HEIGHT - 10);
            }
        }

        if (left < 10) left = 10;
        if (left + PV_WIDTH > vw - 10) left = vw - PV_WIDTH - 10;
        if (top + PV_HEIGHT > vh - 10) top = vh - PV_HEIGHT - 10;

        el.style.top = top + 'px';
        el.style.left = left + 'px';
        el.style.opacity = '1';
    }

    function hidePreview() {
        if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
        if (previewEl) previewEl.style.opacity = '0';
    }

    window.addEventListener('scroll', hidePreview, { passive: true });

    // ---------- storage ----------
    function load() {
        let raw = GM_getValue(STORAGE_KEY, null);
        if (raw === null) raw = localStorage.getItem(STORAGE_KEY);
        try { hiddenGames = new Set(JSON.parse(raw || '[]')); } catch (e) {}
    }
    function save() {
        const data = JSON.stringify([...hiddenGames]);
        GM_setValue(STORAGE_KEY, data);
        try { localStorage.setItem(STORAGE_KEY, data); } catch (e) {}
    }

    function getGameIdentifier(card) {
        const ownHref = card.getAttribute && card.getAttribute('href');
        if (ownHref) { const m = ownHref.match(/\/game\/([^/?]+)/); if (m) return m[1]; }
        const link = card.querySelector('a[href*="/game/"]');
        if (link) { const m = link.getAttribute('href').match(/\/game\/([^/?]+)/); if (m) return m[1]; }
        const img = card.querySelector('img[alt]');
        return img ? img.alt.replace(/ - cover art image$/, '').trim() : null;
    }

    function hideAllCardsWithId(id) {
        document.querySelectorAll(TILE_SELECTOR).forEach(card => {
            if (getGameIdentifier(card) === id) {
                card.style.display = 'none';
                card.dataset.gogHidden = '1';
            }
        });
    }

    function addHideButton(card) {
        if (card.querySelector('.gog-hide-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'gog-hide-btn';
        btn.textContent = '✕';
        btn.title = 'Hide this game';
        Object.assign(btn.style, {
            position: 'absolute', top: '5px', right: '5px', zIndex: '99',
            background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none',
            borderRadius: '50%', width: '26px', height: '26px', fontSize: '16px',
            lineHeight: '26px', textAlign: 'center', cursor: 'pointer',
            opacity: '0.7', transition: 'opacity 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(2px)', pointerEvents: 'all'
        });
        btn.onmouseenter = () => btn.style.opacity = '1';
        btn.onmouseleave = () => btn.style.opacity = '0.7';
        btn.addEventListener('click', e => {
            e.stopPropagation();
            e.preventDefault();
            const id = getGameIdentifier(card);
            if (id) {
                hiddenGames.add(id);
                save();
                hideAllCardsWithId(id);
            }
        });
        const cs = getComputedStyle(card);
        if (cs.position === 'static') card.style.position = 'relative';
        card.appendChild(btn);
    }

    function addPirateButtons(tile, product) {
        const info = tile.querySelector('.product-tile__info');
        if (!info) return;

        const row = document.createElement('div');
        row.className = 'gog-pirate-row';
        row.style.cssText = 'display:flex;gap:4px;margin-top:6px;width:100%;';

        PIRATE_LINKS.forEach(link => {
            const url = link.url + encodeURIComponent(product.title) + link.suffix;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = link.label;
            btn.title = link.title;
            btn.style.cssText = 'flex:1 1 0;min-width:0;padding:3px 4px;font-size:9px;font-weight:600;background:#2a2d33;color:#ccc;border:1px solid #3a3d43;border-radius:3px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:14px;';
            btn.addEventListener('mouseenter', () => { btn.style.background = '#3a3d43'; btn.style.color = '#fff'; });
            btn.addEventListener('mouseleave', () => { btn.style.background = '#2a2d33'; btn.style.color = '#ccc'; });
            btn.addEventListener('click', e => {
                e.stopPropagation();
                e.preventDefault();
                window.open(url, '_blank', 'noopener');
            });
            row.appendChild(btn);
        });

        info.appendChild(row);
    }

    function processCard(card) {
        if (!card) return;
        const id = getGameIdentifier(card);
        if (card.dataset.gogHider && card.dataset.gogId === (id || '')) return;
        if (id && hiddenGames.has(id)) {
            card.style.display = 'none';
            card.dataset.gogHidden = '1';
        } else if (card.dataset.gogHidden) {
            card.style.display = '';
            delete card.dataset.gogHidden;
        }
        addHideButton(card);
        card.dataset.gogHider = '1';
        card.dataset.gogId = id || '';
    }

    function scan() {
        document.querySelectorAll(TILE_SELECTOR).forEach(processCard);
    }

    function gmFetchJson(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET', url,
                headers: { 'Accept': 'application/json' },
                onload: res => {
                    if (res.status >= 200 && res.status < 300) {
                        try { resolve(JSON.parse(res.responseText)); }
                        catch (e) { reject(new Error('Bad JSON')); }
                    } else reject(new Error(`API ${res.status}`));
                },
                onerror: () => reject(new Error('network error')),
                ontimeout: () => reject(new Error('timeout'))
            });
        });
    }

    function inPrefix(s) {
        const parts = (s || '').split(',').map(x => x.trim()).filter(Boolean);
        return parts.length ? 'in:' + parts.join(',') : null;
    }

    function buildApiUrl(pageNum) {
        const src = new URL(location.href).searchParams;
        const menu = (window.gogMicroservices && window.gogMicroservices.menu) || {};
        const p = new URLSearchParams();
        p.set('limit', String(PAGE_LIMIT));
        p.set('countryCode', menu.country || 'US');
        p.set('locale', menu.currentLanguageCode || 'en-US');
        p.set('currencyCode', menu.currentCurrencyCode || 'USD');
        p.set('order', src.get('order') || 'desc:storeReleaseDate');
        p.set('page', String(pageNum));
        p.set('productType', src.get('hideDLCs') === 'true' ? 'in:game,pack' : 'in:game,pack,dlc,extras');

        const systems = inPrefix(src.get('systems'));
        if (systems) p.set('systems', systems);
        const exclGenres = inPrefix(src.get('excludeGenres'));
        if (exclGenres) p.set('excludeGenres', exclGenres);
        const exclTags = inPrefix(src.get('excludeTags'));
        if (exclTags) p.set('excludeTags', exclTags);
        const exclStatuses = inPrefix(src.get('excludeReleaseStatuses'));
        if (exclStatuses) p.set('excludeReleaseStatuses', exclStatuses);

        const priceRange = src.get('priceRange');
        if (priceRange) {
            const parts = priceRange.split(',');
            if (parts.length === 2) p.set('price', `between:${parts[0]},${parts[1]}`);
        }
        return `https://catalog.gog.com/v1/catalog?${p.toString()}`;
    }

    function filterLocally(products) {
        const src = new URL(location.href).searchParams;
        const exclTags = new Set((src.get('excludeTags') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
        const exclGenres = new Set((src.get('excludeGenres') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
        return products.filter(p => {
            if (exclTags.size) {
                const tags = (p.tags || []).map(t => (t.slug || '').toLowerCase());
                if (tags.some(t => exclTags.has(t))) return false;
            }
            if (exclGenres.size) {
                const genres = (p.genres || []).map(g => (g.slug || '').toLowerCase());
                if (genres.some(g => exclGenres.has(g))) return false;
            }
            return true;
        });
    }

    function buildTile(product) {
        const tile = document.createElement('a');
        tile.className = 'product-tile product-tile--grid';
        tile.href = `https://www.gog.com/en/game/${product.slug}`;

        if (hiddenGames.has(product.slug)) {
            tile.style.display = 'none';
            tile.dataset.gogHidden = '1';
        }

        const imgWrap = document.createElement('div');
        imgWrap.className = 'product-tile__image-wrapper';
        const img = document.createElement('img');
        img.alt = `${product.title} - cover art image`;
        img.loading = 'lazy';
        const cover = product.coverHorizontal || product.coverVertical || '';
        if (cover) img.src = cover;
        img.style.cssText = 'width:100%;height:auto;border-radius:3px 3px 0 0;';
        imgWrap.appendChild(img);

        const info = document.createElement('div');
        info.className = 'product-tile__info';
        info.style.cssText = 'padding:12px 16px 16px;display:flex;flex-direction:column;height:129px;font-size:12px;';

        const title = document.createElement('div');
        title.className = 'product-tile__title';
        title.textContent = product.title;
        title.title = product.title;
        title.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        info.appendChild(title);

        const footer = document.createElement('div');
        footer.className = 'product-tile__footer';
        footer.style.cssText = 'display:flex;align-items:flex-end;width:100%;margin-top:auto;';
        const price = document.createElement('div');
        price.className = 'product-tile__price-info';
        if (product.price && product.price.final) {
            price.textContent = product.price.final;
            price.style.cssText = 'font-weight:700;font-size:14px;';
        }
        footer.appendChild(price);
        info.appendChild(footer);

        tile.appendChild(imgWrap);
        tile.appendChild(info);
        addHideButton(tile);
        addPirateButtons(tile, product);
        tile.dataset.gogHider = '1';
        tile.dataset.gogId = product.slug;

        tile.addEventListener('mouseenter', () => {
            if (previewTimer) clearTimeout(previewTimer);
            previewTimer = setTimeout(() => showPreview(tile, product), 400);
        });
        tile.addEventListener('mouseleave', hidePreview);

        return tile;
    }

    function getStatusEl() {
        let el = document.getElementById('gog-scroll-status');
        if (el) return el;
        const grid = document.querySelector(GRID_SELECTOR);
        if (!grid) return null;
        el = document.createElement('div');
        el.id = 'gog-scroll-status';
        el.style.cssText = 'grid-column:1/-1;width:100%;padding:24px 0;text-align:center;color:#aaa;font-size:14px;';
        grid.parentNode.insertBefore(el, grid.nextSibling);
        return el;
    }

    function setStatus(text) {
        const el = getStatusEl();
        if (el) el.textContent = text;
    }

    async function loadAllPages(btn) {
        const grid = document.querySelector(GRID_SELECTOR);
        if (!grid) return;

        const first = await gmFetchJson(buildApiUrl(1));
        const totalPages = first.pages || 1;
        let rendered = 0;

        function renderBatch(products) {
            filterLocally(products).forEach(p => {
                if (hiddenGames.has(p.slug)) return;
                grid.appendChild(buildTile(p));
                rendered++;
            });
        }

        renderBatch(first.products || []);
        setStatus(`Page 1/${totalPages} · ${rendered} games shown`);
        btn.textContent = `Loading 1/${totalPages}…`;

        for (let page = 2; page <= totalPages; page++) {
            await new Promise(r => setTimeout(r, DELAY_MS));
            try {
                const data = await gmFetchJson(buildApiUrl(page));
                renderBatch(data.products || []);
            } catch (e) {
                console.error(`[GOG Hider] page ${page} failed:`, e);
            }
            setStatus(`Page ${page}/${totalPages} · ${rendered} games shown`);
            btn.textContent = `Loading ${page}/${totalPages}…`;
        }

        btn.textContent = `Showing ${rendered} games`;
        btn.style.background = '#3a7d44';
        setStatus(`All ${rendered} games loaded (${totalPages} pages).`);
    }

    function addExpandButton() {
        const header = document.querySelector('.catalog__header');
        if (!header || document.getElementById('gog-expand-all-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'gog-expand-all-btn';
        btn.textContent = 'Load all filtered games';
        Object.assign(btn.style, {
            marginLeft: '12px', padding: '6px 14px',
            background: '#6e1d72', color: '#fff', border: 'none',
            borderRadius: '4px', cursor: 'pointer',
            fontSize: '14px', fontWeight: '600'
        });

        btn.addEventListener('click', async () => {
            if (expanded) return;
            expanded = true;
            btn.disabled = true;
            btn.textContent = 'Starting…';

            document.querySelectorAll('.pagination, pagination-template, small-pagination, .catalog__navigation').forEach(el => {
                el.style.display = 'none';
            });
            const grid = document.querySelector(GRID_SELECTOR);
            if (grid) grid.querySelectorAll(TILE_SELECTOR).forEach(t => t.remove());

            try {
                await loadAllPages(btn);
            } catch (e) {
                console.error('[GOG Hider] load failed:', e);
                btn.textContent = 'Failed — reload page';
                btn.style.background = '#a33';
            }
        });

        header.appendChild(btn);
    }

    new MutationObserver(muts => {
        let relevant = false;
        for (const m of muts) {
            for (const n of m.addedNodes) {
                if (n.nodeType !== 1) continue;
                relevant = true;
                if (n.matches && n.matches(TILE_SELECTOR)) processCard(n);
                if (n.querySelectorAll) n.querySelectorAll(TILE_SELECTOR).forEach(processCard);
            }
        }
        if (relevant) addExpandButton();
    }).observe(document.body, { childList: true, subtree: true });

    load();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { scan(); addExpandButton(); });
    } else {
        scan();
        addExpandButton();
    }
    setTimeout(() => { scan(); addExpandButton(); }, 1000);
})();
