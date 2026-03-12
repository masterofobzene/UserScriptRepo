// ==UserScript==
// @name         ::Steam Search: Hide Games Under Minimum Price::
// @namespace    masterofobzene-Hide Games Under Minimum Price
// @version      1.6
// @description  Hides games by minimum price set by the user, also can hide no-reviews or mixed/negative reviewed games on Steam search.
// @author       masterofobzene
// @homepage     https://github.com/masterofobzene/UserScriptRepo
// @icon         https://store.steampowered.com/favicon.ico
// @match        https://store.steampowered.com/search*
// @license      GNU GPLv3
// @grant        none
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/--Steam%20Search-%20Hide%20Games%20Under%20Minimum%20Price--.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/--Steam%20Search-%20Hide%20Games%20Under%20Minimum%20Price--.user.js
// ==/UserScript==

(function () {

'use strict';

/* ---------------- SETTINGS ---------------- */

let minPrice = parseFloat(localStorage.getItem('minPrice')) || 5.00;
let enablePriceFilter = localStorage.getItem('enablePriceFilter') === 'true' || true;
let hideMixedNegative = localStorage.getItem('hideMixedNegative') === 'true' || false;
let hideNoRating = localStorage.getItem('hideNoRating') === 'true' || false;


/* ---------------- THROTTLE DETECTION ---------------- */

let lastResultCount = 0;
let lastResultChange = Date.now();
let throttled = false;
let throttleMessage = null;

let countdownTimer = null;
let countdownElement = null;
let countdownSeconds = 40;

function startCountdown() {

    if (!countdownElement) return;

    countdownSeconds = 40;

    countdownElement.textContent =
    `Retry in ${countdownSeconds}s`;

    if (countdownTimer)
        clearInterval(countdownTimer);

    countdownTimer = setInterval(() => {

        countdownSeconds--;

        if (countdownSeconds > 0) {

            countdownElement.textContent =
            `Retry in ${countdownSeconds}s`;

        } else {

            countdownElement.textContent =
            "All good to go!";

            clearInterval(countdownTimer);
        }

    }, 1000);
}


function showThrottleMessage() {

    const loading = document.querySelector('#search_results_loading');
    if (!loading) return;

    if (!throttleMessage) {

        throttleMessage = document.createElement('div');

        throttleMessage.innerHTML = `
        Throttled by Steam, wait at least 40 seconds before scrolling<br>
        <span style="font-size:12px;color:#c6d4df;">
        We just removed hundreds of games by now believe it or not.<br>
        After that time just go up and down with the scroll wheel to continue.
        </span>
        `;

        throttleMessage.style.color = "#ff8080";
        throttleMessage.style.marginTop = "6px";
        throttleMessage.style.fontSize = "13px";
        throttleMessage.style.textAlign = "center";

        countdownElement = document.createElement("div");
        countdownElement.style.marginTop = "6px";
        countdownElement.style.fontWeight = "bold";
        countdownElement.style.color = "#ffffff";

        throttleMessage.appendChild(countdownElement);
    }

    if (!loading.contains(throttleMessage))
        loading.appendChild(throttleMessage);

    startCountdown();
}

function hideThrottleMessage() {

    if (throttleMessage)
        throttleMessage.remove();

    if (countdownTimer)
        clearInterval(countdownTimer);
}


function monitorResults() {

    const rows = document.querySelectorAll('.search_result_row').length;
    const loading = document.querySelector('#search_results_loading');

    if (rows > lastResultCount) {

        lastResultCount = rows;
        lastResultChange = Date.now();

        if (throttled) {

            throttled = false;
            hideThrottleMessage();
        }
    }

    if (loading && loading.style.display !== "none") {

        if (!throttled && Date.now() - lastResultChange > 3000) {

            throttled = true;
            showThrottleMessage();
        }
    }
}


/* ---------------- FILTER ---------------- */

function filterRow(row) {

    let shouldHide = false;

    const priceElement = row.querySelector('.discount_final_price');
    if (!priceElement) return;

    const priceText = priceElement.textContent.trim();

    if (/free/i.test(priceText)) {

        shouldHide = enablePriceFilter;

    } else {

        const priceMatch = priceText.match(/\$(\d+\.\d{2})/);

        if (priceMatch && enablePriceFilter) {

            const price = parseFloat(priceMatch[1]);

            if (price < minPrice)
                shouldHide = true;
        }
    }

    const reviewElement = row.querySelector('.search_review_summary');

    const hasRating = !!reviewElement;
    const ratingClass = reviewElement?.classList?.[1];

    if (hideNoRating && !hasRating)
        shouldHide = true;

    if (hideMixedNegative && (ratingClass === 'mixed' || ratingClass === 'negative'))
        shouldHide = true;

    row.style.display = shouldHide ? 'none' : '';
}


function hideLowPriceGames() {

    const rows = document.querySelectorAll('.search_result_row');

    rows.forEach(filterRow);
}


/* ---------------- OBSERVER ---------------- */

function setupObserver() {

    const resultsContainer = document.getElementById('search_resultsRows');

    if (!resultsContainer) return;

    const observer = new MutationObserver(mutations => {

        mutations.forEach(mutation => {

            mutation.addedNodes.forEach(node => {

                if (node.classList && node.classList.contains('search_result_row')) {

                    node.style.display = 'none';

                    filterRow(node);
                }
            });
        });
    });

    observer.observe(resultsContainer, {
        childList: true
    });
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

    container.style.padding = '10px';
    container.style.marginTop = '10px';
    container.style.backgroundColor = '#2a475e';
    container.style.border = '1px solid #66c0f4';
    container.style.color = '#c6d4df';
    container.style.fontSize = '13px';

    container.innerHTML = `
        <div style="margin-bottom:6px;"><strong>🧹 Custom Filter</strong></div>

        <label style="display:block;margin-bottom:6px;">
            <input type="checkbox" id="enablePriceFilter" ${enablePriceFilter ? 'checked' : ''}>
            Enable Price Filter
        </label>

        <label style="display:block;margin-bottom:4px;">
            Min Price: $<span id="priceValue">${minPrice.toFixed(2)}</span><br>
            <input type="range" id="priceSlider" min="0" max="60" step="0.5"
            value="${minPrice}" style="width:100%;">
        </label>

        <hr style="margin:10px 0;border-color:#66c0f4;">

        <label style="display:block;margin-bottom:4px;">
            <input type="checkbox" id="hideMixedNegative" ${hideMixedNegative ? 'checked' : ''}>
            Hide Mixed/Negative
        </label>

        <label style="display:block;">
            <input type="checkbox" id="hideNoRating" ${hideNoRating ? 'checked' : ''}>
            Hide No Rating
        </label>
    `;

    insertAfter.parentNode.insertBefore(container, insertAfter.nextSibling);

    document.getElementById('enablePriceFilter').addEventListener('change', e => {
        enablePriceFilter = e.target.checked;
        localStorage.setItem('enablePriceFilter', enablePriceFilter);
        hideLowPriceGames();
    });

    document.getElementById('priceSlider').addEventListener('input', e => {
        minPrice = parseFloat(e.target.value);
        localStorage.setItem('minPrice', minPrice);
        document.getElementById('priceValue').textContent = minPrice.toFixed(2);
        hideLowPriceGames();
    });

    document.getElementById('hideMixedNegative').addEventListener('change', e => {
        hideMixedNegative = e.target.checked;
        localStorage.setItem('hideMixedNegative', hideMixedNegative);
        hideLowPriceGames();
    });

    document.getElementById('hideNoRating').addEventListener('change', e => {
        hideNoRating = e.target.checked;
        localStorage.setItem('hideNoRating', hideNoRating);
        hideLowPriceGames();
    });
}


/* ---------------- INIT ---------------- */

function waitForSidebarAndInit() {

    const checkInterval = setInterval(() => {

        const anchor = document.querySelector('#narrow_category1');

        if (anchor) {

            clearInterval(checkInterval);

            createToggleUI();
            hideLowPriceGames();
            setupObserver();

            lastResultCount =
            document.querySelectorAll('.search_result_row').length;

            setInterval(monitorResults, 1000);
        }

    }, 300);
}

waitForSidebarAndInit();

})();
