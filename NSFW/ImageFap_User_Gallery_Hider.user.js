// ==UserScript==
// @name         ImageFap User Gallery Hider
// @namespace    ImageFap_User_Gallery_Hider
// @version      1.5
// @description  Hide ImageFap galleries by user, auto-hide <4 pics, and hide by gender (women / couples / transsexuals).
// @author       masterofobzene
// @match        https://www.imagefap.com/gallery.php*
// @icon         https://www.imagefap.com/favicon.ico
// @grant        GM_getValue
// @grant        GM_setValue
// @inject-into  content
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/ImageFap_User_Gallery_Hider.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/ImageFap_User_Gallery_Hider.user.js
// ==/UserScript==

(function () {
    'use strict';

    /* =======================
       STORAGE KEYS
    ======================= */
    const hiddenUsersKey = 'imagefap_hidden_users';
    const hideConfigKey = 'imagefap_hide_gender';
    const panelPosKey = 'imagefap_gender_panel_pos';

    let hiddenUsers = new Set(GM_getValue(hiddenUsersKey, []));

    const DEFAULT_HIDE_CONFIG = {
        women: false,
        couples: false,
        transsexuals: false
    };

    function getHideConfig() {
        return GM_getValue(hideConfigKey, DEFAULT_HIDE_CONFIG);
    }

    function setHideConfig(cfg) {
        GM_setValue(hideConfigKey, cfg);
    }

    /* =======================
       UI PANEL (MOVABLE)
    ======================= */
    function createGenderPanel() {
        if (document.getElementById('genderFilterPanel')) return;

        const cfg = getHideConfig();
        const savedPos = GM_getValue(panelPosKey, { top: 120, right: 10 });

        const panel = document.createElement('div');
        panel.id = 'genderFilterPanel';
        panel.style.cssText = `
            position: fixed;
            top: ${savedPos.top}px;
            right: ${savedPos.right}px;
            background: #111;
            color: #fff;
            width: 170px;
            font-size: 13px;
            z-index: 99999;
            border: 1px solid #444;
            border-radius: 6px;
            box-shadow: 0 0 6px black;
            user-select: none;
        `;

        /* Header = drag handle */
        const header = document.createElement('div');
        header.textContent = 'Hide users';
        header.style.cssText = `
            font-weight: bold;
            padding: 6px 8px;
            cursor: move;
            background: #1b1b1b;
            border-bottom: 1px solid #333;
            border-radius: 6px 6px 0 0;
        `;

        const body = document.createElement('div');
        body.style.cssText = 'padding: 8px 10px; user-select: text;';

        body.innerHTML = `
            <label><input type="checkbox" id="hideWomen"> Women</label><br>
            <label><input type="checkbox" id="hideCouples"> Couples</label><br>
            <label><input type="checkbox" id="hideTrans"> Transsexuals</label>
        `;

        panel.appendChild(header);
        panel.appendChild(body);
        document.body.appendChild(panel);

        /* Restore state */
        const w = panel.querySelector('#hideWomen');
        const c = panel.querySelector('#hideCouples');
        const t = panel.querySelector('#hideTrans');

        w.checked = cfg.women;
        c.checked = cfg.couples;
        t.checked = cfg.transsexuals;

        function update() {
            setHideConfig({
                women: w.checked,
                couples: c.checked,
                transsexuals: t.checked
            });
            applyAll();
        }

        w.addEventListener('change', update);
        c.addEventListener('change', update);
        t.addEventListener('change', update);

        /* =======================
           DRAG LOGIC
        ======================= */
        let isDragging = false;
        let startX, startY, startTop, startRight;

        header.addEventListener('pointerdown', (e) => {
            isDragging = true;
            header.setPointerCapture(e.pointerId);

            startX = e.clientX;
            startY = e.clientY;

            const rect = panel.getBoundingClientRect();
            startTop = rect.top;
            startRight = window.innerWidth - rect.right;

            e.preventDefault();
        });

        header.addEventListener('pointermove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            panel.style.top = `${startTop + dy}px`;
            panel.style.right = `${startRight - dx}px`;
        });

        header.addEventListener('pointerup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            header.releasePointerCapture(e.pointerId);

            GM_setValue(panelPosKey, {
                top: parseInt(panel.style.top, 10),
                right: parseInt(panel.style.right, 10)
            });
        });
    }

    /* =======================
       HELPERS
    ======================= */
    function hideRows(titleRow, detailRow) {
        titleRow.style.display = 'none';
        if (detailRow) detailRow.style.display = 'none';
    }

    function showRows(titleRow, detailRow) {
        titleRow.style.display = '';
        if (detailRow) detailRow.style.display = '';
    }

    function shouldHideByGender(detailRow) {
        const cfg = getHideConfig();
        const sexIcon = detailRow.querySelector('.sex.iconSex');
        if (!sexIcon) return false;

        if (cfg.women && sexIcon.classList.contains('sexW')) return true;
        if (cfg.couples && sexIcon.classList.contains('sexC')) return true;
        if (cfg.transsexuals && sexIcon.classList.contains('sexS')) return true;

        return false;
    }

    /* =======================
       MAIN PROCESSOR
    ======================= */
    function processGallery(titleRow) {
        if (titleRow.getAttribute('data-processed')) return;
        titleRow.setAttribute('data-processed', 'true');

        const detailRow = titleRow.nextElementSibling;
        if (!detailRow || detailRow.getAttribute('valign') !== 'top') return;

        /* Auto-hide <4 pictures */
        const picCountTd = titleRow.querySelector('td > center');
        if (picCountTd) {
            const picCount = parseInt(picCountTd.textContent.trim(), 10);
            if (!isNaN(picCount) && picCount < 4) {
                hideRows(titleRow, detailRow);
                return;
            }
        }

        /* Gender-based auto hide */
        if (shouldHideByGender(detailRow)) {
            hideRows(titleRow, detailRow);
            return;
        }

        const avatarDiv = detailRow.querySelector('div.avatar');
        if (!avatarDiv) return;

        const usernameLink = avatarDiv.querySelector('a.gal_title');
        if (!usernameLink) return;

        const username = usernameLink.textContent.trim().toLowerCase();

        const btn = document.createElement('span');
        btn.textContent = '✖';
        btn.title = `Hide all from ${usernameLink.textContent.trim()}`;
        btn.style.cssText = `
            position: absolute;
            top: 4px;
            right: 4px;
            width: 24px;
            height: 24px;
            background: rgba(255,0,0,0.8);
            color: white;
            font-weight: bold;
            text-align: center;
            line-height: 24px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            z-index: 999;
            box-shadow: 0 0 4px black;
        `;

        avatarDiv.style.position = 'relative';
        avatarDiv.appendChild(btn);

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();

            if (hiddenUsers.has(username)) {
                hiddenUsers.delete(username);
                btn.style.background = 'rgba(255,0,0,0.8)';
                showRows(titleRow, detailRow);
            } else {
                hiddenUsers.add(username);
                btn.style.background = 'rgba(0,150,0,0.9)';
                hideRows(titleRow, detailRow);
            }

            GM_setValue(hiddenUsersKey, Array.from(hiddenUsers));
        });

        if (hiddenUsers.has(username)) {
            hideRows(titleRow, detailRow);
            btn.style.background = 'rgba(0,150,0,0.9)';
        }
    }

    /* =======================
       APPLY ALL
    ======================= */
    function applyAll() {
        createGenderPanel();

        document.querySelectorAll('a[href*="gallery.php?gid="]').forEach(link => {
            let current = link;
            while (current && current.tagName !== 'TR') {
                current = current.parentElement;
            }
            if (current && !current.getAttribute('data-processed')) {
                processGallery(current);
            }
        });
    }

    /* =======================
       INIT + OBSERVER
    ======================= */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyAll);
    } else {
        applyAll();
    }

    let timeout;
    const observer = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(applyAll, 300);
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
