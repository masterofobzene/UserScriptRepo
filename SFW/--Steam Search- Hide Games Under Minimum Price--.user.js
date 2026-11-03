// ==UserScript==
// @name         ::Steam Search: Hide Games Under Minimum Price::
// @namespace    masterofobzene-Hide Games Under Minimum Price
// @version      2.0
// @description  Hides games by minimum price set by the user, also can hide no-reviews or mixed/negative reviewed games on Steam search.
// @author       masterofobzene
// @homepage     https://github.com/masterofobzene/UserScriptRepo
// @icon         https://store.steampowered.com/favicon.ico
// @match        https://store.steampowered.com/search*
// @license      GNU GPLv3
// @run-at       document-start
// @grant        none
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/--Steam%20Search-%20Hide%20Games%20Under%20Minimum%20Price--.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/--Steam%20Search-%20Hide%20Games%20Under%20Minimum%20Price--.user.js
// ==/UserScript==


(function () {

'use strict';

/* ---------------- SETTINGS ---------------- */

let minPrice          = parseFloat(localStorage.getItem('minPrice')) || 5.00;
let enablePriceFilter = localStorage.getItem('enablePriceFilter') !== 'false';   // default ON
let hideMixedNegative = localStorage.getItem('hideMixedNegative') === 'true';
let hideNoRating      = localStorage.getItem('hideNoRating') === 'true';
let hideSimulator     = localStorage.getItem('hideSimulator') === 'true';
let requestGapSec     = parseFloat(localStorage.getItem('requestGapSec')) || 2.0; // min seconds between result requests

const BASE_COOLDOWN_SEC = 40;   // first cooldown after Steam rejects a request
const MAX_COOLDOWN_SEC  = 300;
const DEBUG             = false; // true => logs every XHR/fetch URL so you can verify the match below

/* ---------------- REQUEST PACING (the actual anti-throttle fix) ---------------- */
/*
 * Steam's infinite scroll asks for the next page as soon as the sentinel is near the viewport.
 * When most rows are hidden by our filter the page doesn't grow, the sentinel stays in view,
 * and Steam chains request after request. We can't change Steam's scroll code, but every page
 * of results goes through XHR/fetch, so we space those out here.
 */

// Matches the paged results endpoint (/search/results/?...start=50&count=50...)
function isResultsRequest(url) {
    if (!url) return false;
    url = String(url);
    return /\/search\/results/i.test(url);
}

let nextSlot      = 0;   // earliest time the next request may leave
let cooldownUntil = 0;   // no requests at all before this time
let cooldownLevel = 0;   // grows on repeated rejections

function gapMs() {
    // small jitter so requests don't look machine-regular
    return requestGapSec * 1000 * (1 + Math.random() * 0.3);
}

function reserveSlot() {
    const now   = Date.now();
    const start = Math.max(now, nextSlot, cooldownUntil);
    nextSlot    = start + gapMs();
    return start - now;
}

function onResultsFailure() {
    cooldownLevel++;
    const secs = Math.min(BASE_COOLDOWN_SEC * cooldownLevel, MAX_COOLDOWN_SEC);
    cooldownUntil = Date.now() + secs * 1000;
    nextSlot      = Math.max(nextSlot, cooldownUntil);
    showCooldownBanner();
    // when the cooldown ends, poke Steam's scroll handler so loading resumes by itself
    setTimeout(nudgeScroll, secs * 1000 + 250);
}

function onResultsSuccess() {
    cooldownLevel = 0;
}

function nudgeScroll() {
    window.dispatchEvent(new Event('scroll'));
    window.scrollBy(0, -1);
    window.scrollBy(0, 1);
}

/* ---- XMLHttpRequest (Steam's search page uses jQuery/Prototype => XHR) ---- */
const xhrOpen  = XMLHttpRequest.prototype.open;
const xhrSend  = XMLHttpRequest.prototype.send;
const xhrAbort = XMLHttpRequest.prototype.abort;

XMLHttpRequest.prototype.open = function (method, url) {
    this.__sfUrl = url;
    if (DEBUG) console.log('[SteamFilter] XHR', method, url);
    return xhrOpen.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function (body) {
    if (!isResultsRequest(this.__sfUrl)) return xhrSend.call(this, body);

    const xhr = this;

    xhr.addEventListener('loadend', () => {
        if (xhr.status >= 200 && xhr.status < 300) onResultsSuccess();
        else if (!xhr.__sfAborted) onResultsFailure();     // 429 / 403 / 5xx / network error
    });

    const fire = () => {
        if (xhr.__sfAborted) return;
        // a cooldown may have started while this request was waiting in line
        const now = Date.now();
        if (now < cooldownUntil) {
            xhr.__sfTimer = setTimeout(fire, reserveSlot());
            return;
        }
        xhrSend.call(xhr, body);
    };

    const delay = reserveSlot();
    if (delay <= 0) fire();
    else xhr.__sfTimer = setTimeout(fire, delay);
};

XMLHttpRequest.prototype.abort = function () {
    this.__sfAborted = true;
    clearTimeout(this.__sfTimer);
    return xhrAbort.apply(this, arguments);
};

/* ---- fetch (in case Steam moves to it) ---- */
if (window.fetch) {
    const origFetch = window.fetch;
    window.fetch = function (input, init) {
        const url = typeof input === 'string' ? input : (input && input.url);
        if (DEBUG) console.log('[SteamFilter] fetch', url);
        if (!isResultsRequest(url)) return origFetch.apply(this, arguments);

        const args = arguments, self = this;
        return new Promise((resolve, reject) => {
            const go = () => {
                if (Date.now() < cooldownUntil) return setTimeout(go, reserveSlot());
                origFetch.apply(self, args).then(res => {
                    if (res.ok) onResultsSuccess(); else onResultsFailure();
                    resolve(res);
                }, err => { onResultsFailure(); reject(err); });
            };
            const d = reserveSlot();
            d <= 0 ? go() : setTimeout(go, d);
        });
    };
}

/* ---------------- COOLDOWN BANNER ---------------- */

let bannerEl = null;
let bannerTimer = null;

function showCooldownBanner() {
    if (!document.body) return;

    if (!bannerEl) {
        bannerEl = document.createElement('div');
        bannerEl.style.cssText =
            'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;' +
            'background:#1b2838;border:1px solid #66c0f4;color:#ff8080;padding:8px 14px;' +
            'font-size:13px;text-align:center;box-shadow:0 2px 10px #000a;';
    }
    if (!bannerEl.isConnected) document.body.appendChild(bannerEl);

    clearInterval(bannerTimer);
    const tick = () => {
        const left = Math.ceil((cooldownUntil - Date.now()) / 1000);
        if (left > 0) {
            bannerEl.innerHTML =
                'Steam rate-limited the search. Pausing requests…<br>' +
                `<span style="color:#fff;font-weight:bold;">Resuming in ${left}s</span>`;
        } else {
            clearInterval(bannerTimer);
            bannerEl.remove();
        }
    };
    tick();
    bannerTimer = setInterval(tick, 500);
}

/* ---------------- FILTER ---------------- */

let filterCounts = { price: 0, mixedNegative: 0, noRating: 0, simulator: 0 };

function updateFilterCountsUI() {
    const set = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = `[${n}]`; };
    set('priceCount',         filterCounts.price);
    set('mixedNegativeCount', filterCounts.mixedNegative);
    set('noRatingCount',      filterCounts.noRating);
    set('simulatorCount',     filterCounts.simulator);
}

function filterRow(row) {

    let hidePrice = false, hideMixedNeg = false, hideNoRate = false, hideSim = false;

    const priceElement = row.querySelector('.discount_original_price') || row.querySelector('.discount_final_price');

    if (!priceElement) {
        // no price shown (unreleased, "coming soon", etc.) => always hide
        hidePrice = true;
    } else {
        const priceText = priceElement.textContent.trim();

        if (/free/i.test(priceText)) {
            if (enablePriceFilter) hidePrice = true;
        } else {
            const priceMatch = priceText.match(/\$(\d+\.\d{2})/);
            if (priceMatch && enablePriceFilter && parseFloat(priceMatch[1]) < minPrice)
                hidePrice = true;
        }
    }

    const reviewElement = row.querySelector('.search_review_summary');
    const hasRating     = !!reviewElement;
    const ratingClass   = reviewElement?.classList?.[1];

    if (hideNoRating && !hasRating) hideNoRate = true;
    if (hideMixedNegative && (ratingClass === 'mixed' || ratingClass === 'negative')) hideMixedNeg = true;

    if (hideSimulator) {
        const titleElement = row.querySelector('.title');
        if (/simulator/i.test(titleElement ? titleElement.textContent : '')) hideSim = true;
    }

    if (row.dataset.filterCounted !== 'true') {
        if (hidePrice)    filterCounts.price++;
        if (hideMixedNeg) filterCounts.mixedNegative++;
        if (hideNoRate)   filterCounts.noRating++;
        if (hideSim)      filterCounts.simulator++;
        row.dataset.filterCounted = 'true';
    }

    row.style.display = (hidePrice || hideMixedNeg || hideNoRate || hideSim) ? 'none' : '';
}

function hideLowPriceGames() {
    filterCounts = { price: 0, mixedNegative: 0, noRating: 0, simulator: 0 };
    const rows = document.querySelectorAll('.search_result_row');
    rows.forEach(row => delete row.dataset.filterCounted);
    rows.forEach(filterRow);
    updateFilterCountsUI();
}

/* ---------------- OBSERVER ---------------- */

function setupObserver() {
    const resultsContainer = document.getElementById('search_resultsRows');
    if (!resultsContainer) return;

    const observer = new MutationObserver(mutations => {
        let addedAny = false;
        mutations.forEach(m => m.addedNodes.forEach(node => {
            if (node.classList && node.classList.contains('search_result_row')) {
                filterRow(node);          // (no pre-hide: rows without a price element used to stay hidden forever)
                addedAny = true;
            }
        }));
        if (addedAny) updateFilterCountsUI();
    });

    observer.observe(resultsContainer, { childList: true });
}

/* ---------------- UI ---------------- */

function createToggleUI() {

    const insertAfter = document.querySelector('#narrow_category1');
    if (!insertAfter) {
        console.warn('Could not find #narrow_category1 to insert filters.');
        return;
    }

    const container = document.createElement('div');
    container.className = 'additional_filters_ctn';
    container.style.cssText =
        'padding:10px;margin-top:10px;background-color:#2a475e;border:1px solid #66c0f4;color:#c6d4df;font-size:13px;';

    const counterStyle = 'color:#66c0f4;font-weight:bold;';

    container.innerHTML = `
        <div style="margin-bottom:6px;"><strong>🧹 Custom Filter</strong></div>

        <label style="display:block;margin-bottom:6px;">
            <input type="checkbox" id="enablePriceFilter" ${enablePriceFilter ? 'checked' : ''}>
            Enable Price Filter <span id="priceCount" style="${counterStyle}">[0]</span>
        </label>

        <label style="display:block;margin-bottom:4px;">
            Min Price: $<span id="priceValue">${minPrice.toFixed(2)}</span><br>
            <input type="range" id="priceSlider" min="0" max="60" step="0.5" value="${minPrice}" style="width:100%;">
        </label>

        <hr style="margin:10px 0;border-color:#66c0f4;">

        <label style="display:block;margin-bottom:4px;">
            <input type="checkbox" id="hideMixedNegative" ${hideMixedNegative ? 'checked' : ''}>
            Hide Mixed/Negative <span id="mixedNegativeCount" style="${counterStyle}">[0]</span>
        </label>

        <label style="display:block;margin-bottom:4px;">
            <input type="checkbox" id="hideNoRating" ${hideNoRating ? 'checked' : ''}>
            Hide No Rating <span id="noRatingCount" style="${counterStyle}">[0]</span>
        </label>

        <label style="display:block;">
            <input type="checkbox" id="hideSimulator" ${hideSimulator ? 'checked' : ''}>
            Hide "Simulator" titles <span id="simulatorCount" style="${counterStyle}">[0]</span>
        </label>

        <hr style="margin:10px 0;border-color:#66c0f4;">

        <label style="display:block;">
            Delay between page loads: <span id="gapValue">${requestGapSec.toFixed(1)}</span>s<br>
            <input type="range" id="gapSlider" min="1" max="10" step="0.5" value="${requestGapSec}" style="width:100%;">
        </label>
    `;

    insertAfter.parentNode.insertBefore(container, insertAfter.nextSibling);

    const bindCheck = (id, setter, key) =>
        document.getElementById(id).addEventListener('change', e => {
            setter(e.target.checked);
            localStorage.setItem(key, e.target.checked);
            hideLowPriceGames();
        });

    bindCheck('enablePriceFilter', v => enablePriceFilter = v, 'enablePriceFilter');
    bindCheck('hideMixedNegative', v => hideMixedNegative = v, 'hideMixedNegative');
    bindCheck('hideNoRating',      v => hideNoRating = v,      'hideNoRating');
    bindCheck('hideSimulator',     v => hideSimulator = v,     'hideSimulator');

    document.getElementById('priceSlider').addEventListener('input', e => {
        minPrice = parseFloat(e.target.value);
        localStorage.setItem('minPrice', minPrice);
        document.getElementById('priceValue').textContent = minPrice.toFixed(2);
        hideLowPriceGames();
    });

    document.getElementById('gapSlider').addEventListener('input', e => {
        requestGapSec = parseFloat(e.target.value);
        localStorage.setItem('requestGapSec', requestGapSec);
        document.getElementById('gapValue').textContent = requestGapSec.toFixed(1);
    });
}

/* ---------------- LOADING NOTE ---------------- */

function addLoadingNote() {
    const loading = document.getElementById('search_results_loading');
    if (!loading || document.getElementById('sfLoadingNote')) return;

    const note = document.createElement('div');
    note.id = 'sfLoadingNote';
    note.textContent = 'Slow? we are filtering thousands of crappy games in real time, that\u2019s why. \uD83D\uDE04\uD83E\uDDF9';
    note.style.cssText = 'margin-top:6px;font-size:12px;color:#c6d4df;text-align:center;';
    loading.appendChild(note);
}

/* ---------------- INIT ---------------- */

function waitForSidebarAndInit() {
    const checkInterval = setInterval(() => {
        if (document.querySelector('#narrow_category1') && document.getElementById('search_resultsRows')) {
            clearInterval(checkInterval);
            createToggleUI();
            addLoadingNote();
            hideLowPriceGames();
            setupObserver();
        }
    }, 300);
}

waitForSidebarAndInit();

})();

