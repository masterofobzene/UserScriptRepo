// ==UserScript==
// @name         ImageFap User Gallery Hider
// @namespace    ImageFap_User_Gallery_Hider
// @version      1.7
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
       STORAGE
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
       PANEL
    ======================= */
    function createGenderPanel() {
        if (document.getElementById('genderFilterPanel')) return;

        const cfg = getHideConfig();
        const pos = GM_getValue(panelPosKey, { top: 120, right: 10 });

        const panel = document.createElement('div');
        panel.id = 'genderFilterPanel';
        panel.style.cssText = `
            position: fixed;
            top: ${pos.top}px;
            right: ${pos.right}px;
            background: #111;
            color: #fff;
            width: 170px;
            font-size: 13px;
            z-index: 99999;
            border: 1px solid #444;
            border-radius: 6px;
            box-shadow: 0 0 6px black;
        `;

        panel.innerHTML = `
            <div id="panelHeader" style="
                font-weight:bold;
                padding:6px 8px;
                cursor:move;
                background:#1b1b1b;
                border-bottom:1px solid #333;">
                Hide users
            </div>
            <div style="padding:8px 10px;">
                <label><input type="checkbox" id="hideWomen"> Women</label><br>
                <label><input type="checkbox" id="hideCouples"> Couples</label><br>
                <label><input type="checkbox" id="hideTrans"> Transsexuals</label>
            </div>
        `;

        document.body.appendChild(panel);

        const w = panel.querySelector('#hideWomen');
        const c = panel.querySelector('#hideCouples');
        const t = panel.querySelector('#hideTrans');

        w.checked = cfg.women;
        c.checked = cfg.couples;
        t.checked = cfg.transsexuals;

        const update = () => {
            setHideConfig({
                women: w.checked,
                couples: c.checked,
                transsexuals: t.checked
            });
            applyAll();
        };

        w.onchange = c.onchange = t.onchange = update;

        /* Drag */
        const header = panel.querySelector('#panelHeader');
        let sx, sy, st, sr, drag = false;

        header.onpointerdown = e => {
            drag = true;
            header.setPointerCapture(e.pointerId);
            sx = e.clientX;
            sy = e.clientY;
            const r = panel.getBoundingClientRect();
            st = r.top;
            sr = window.innerWidth - r.right;
        };

        header.onpointermove = e => {
            if (!drag) return;
            panel.style.top = st + (e.clientY - sy) + 'px';
            panel.style.right = sr - (e.clientX - sx) + 'px';
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

    /* =======================
       HELPERS
    ======================= */

    function shouldHideByGender(detailRow) {
        const cfg = getHideConfig();
        const s = detailRow.querySelector('.sex.iconSex');
        if (!s) return false;

        return (cfg.women && s.classList.contains('sexW')) ||
               (cfg.couples && s.classList.contains('sexC')) ||
               (cfg.transsexuals && s.classList.contains('sexS'));
    }

    function getPicCount(titleRow) {
        const center = titleRow.querySelector('td > center');
        if (!center) return null;
        const n = parseInt(center.textContent.trim(), 10);
        return isNaN(n) ? null : n;
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
            while (detailRow && detailRow.tagName !== 'TR') {
                detailRow = detailRow.parentElement;
            }
            if (!detailRow) return;

            const titleRow = detailRow.previousElementSibling;
            if (!titleRow || titleRow.tagName !== 'TR') return;

            hideRow(titleRow, detailRow);
        });
    }

    /* =======================
       CORE
    ======================= */
    function processGallery(titleRow) {
        const detailRow = titleRow.nextElementSibling;
        if (!detailRow || detailRow.getAttribute('valign') !== 'top') return;

        const avatar = detailRow.querySelector('div.avatar');
        const userLink = avatar?.querySelector('a.gal_title');
        if (!avatar || !userLink) return;

        const username = userLink.textContent.trim().toLowerCase();

        /* 1. HARD BLOCK */
        if (hiddenUsers.has(username)) {
            hideRow(titleRow, detailRow);
            return;
        }

        /* 2. <4 PICTURES */
        const picCount = getPicCount(titleRow);
        if (picCount !== null && picCount < 4) {
            hideRow(titleRow, detailRow);
            return;
        }

        /* 3. GENDER FILTER */
        if (shouldHideByGender(detailRow)) {
            hideRow(titleRow, detailRow);
            return;
        }

        /* 4. ADD BLOCK BUTTON */
        if (avatar.querySelector('.ifap-hide-btn')) return;

        const btn = document.createElement('span');
        btn.className = 'ifap-hide-btn';
        btn.textContent = '✖';
        btn.title = `Block ${userLink.textContent.trim()} site-wide`;
        btn.style.cssText = `
            position:absolute;
            top:4px; right:4px;
            width:24px; height:24px;
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

            hiddenUsers.add(username);
            GM_setValue(hiddenUsersKey, [...hiddenUsers]);

            /* IMMEDIATE GLOBAL SWEEP */
            hideAllGalleriesForUser(username);
        };
    }

    function applyAll() {
        createGenderPanel();
        document.querySelectorAll('a[href*="gallery.php?gid="]').forEach(a => {
            let tr = a;
            while (tr && tr.tagName !== 'TR') tr = tr.parentElement;
            if (tr) processGallery(tr);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyAll);
    } else {
        applyAll();
    }

    new MutationObserver(applyAll).observe(document.body, {
        childList: true,
        subtree: true
    });

})();
