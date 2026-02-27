// ==UserScript==
// @name         ImageFap User Gallery Hider
// @namespace    ImageFap_User_Gallery_Hider
// @version      1.9
// @description  Hide ImageFap galleries by user, <4 pics, gender, and country (Germany/France)
// @author       masterofobzene
// @match        https://www.imagefap.com/gallery.php*
// @icon         https://www.imagefap.com/favicon.ico
// @grant        GM_getValue
// @grant        GM_setValue
// @inject-into  content
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/ImageFap_User_Gallery_Hider.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/ImageFap_User_Gallery_Hider.user.js
// ==/UserScript==

(function() {
    'use strict';

    const hiddenUsersKey = 'imagefap_hidden_users';
    const hideConfigKey  = 'imagefap_hide_filters';
    const panelPosKey    = 'imagefap_gender_panel_pos';

    let hiddenUsers = new Set(GM_getValue(hiddenUsersKey, []));

    const DEFAULT_HIDE_CONFIG = {
        women:       false,
        couples:     false,
        transsexuals: false,
        germany:     false,
        france:      false
    };

    function getHideConfig() {
        return GM_getValue(hideConfigKey, DEFAULT_HIDE_CONFIG);
    }

    function setHideConfig(cfg) {
        GM_setValue(hideConfigKey, cfg);
    }

    function createGenderPanel() {
        if (document.getElementById('genderFilterPanel')) return;

        const cfg = getHideConfig();
        const pos = GM_getValue(panelPosKey, { top: 120, right: 10 });

        const panel = document.createElement('div');
        panel.id = 'genderFilterPanel';
        panel.style.cssText = `
            position:fixed;top:${pos.top}px;right:${pos.right}px;
            background:#111;color:#fff;width:170px;font-size:13px;
            z-index:99999;border:1px solid #444;border-radius:6px;
            box-shadow:0 0 6px black;
        `;

        panel.innerHTML = `
            <div id="panelHeader" style="font-weight:bold;padding:6px 8px;cursor:move;
                background:#1b1b1b;border-bottom:1px solid #333;">
                Hide users
            </div>
            <div style="padding:8px 10px;">
                <label><input type="checkbox" id="hideWomen"> "Women"</label><br>
                <label><input type="checkbox" id="hideCouples"> Couples</label><br>
                <label><input type="checkbox" id="hideTrans"> Transsexuals</label><br>
                <label><input type="checkbox" id="hideGermany"> Germany</label><br>
                <label><input type="checkbox" id="hideFrance"> France</label>
            </div>
        `;

        document.body.appendChild(panel);

        const w = panel.querySelector('#hideWomen');
        const c = panel.querySelector('#hideCouples');
        const t = panel.querySelector('#hideTrans');
        const g = panel.querySelector('#hideGermany');
        const f = panel.querySelector('#hideFrance');

        w.checked = cfg.women;
        c.checked = cfg.couples;
        t.checked = cfg.transsexuals;
        g.checked = cfg.germany;
        f.checked = cfg.france;

        const update = () => {
            setHideConfig({
                women: w.checked,
                couples: c.checked,
                transsexuals: t.checked,
                germany: g.checked,
                france: f.checked
            });
            applyAll();
        };

        w.onchange = c.onchange = t.onchange = g.onchange = f.onchange = update;

        const header = panel.querySelector('#panelHeader');
        let sx, sy, st, sr, drag = false;

        header.onpointerdown = e => {
            drag = true;
            header.setPointerCapture(e.pointerId);
            sx = e.clientX; sy = e.clientY;
            const r = panel.getBoundingClientRect();
            st = r.top; sr = window.innerWidth - r.right;
        };

        header.onpointermove = e => {
            if (!drag) return;
            panel.style.top = (st + e.clientY - sy) + 'px';
            panel.style.right = (sr - (e.clientX - sx)) + 'px';
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

    function shouldHideByFilter(detailRow) {
        const cfg = getHideConfig();

        const sexIcon = detailRow.querySelector('.sex.iconSex');
        const hideGender =
            (cfg.women       && sexIcon?.classList.contains('sexW')) ||
            (cfg.couples     && sexIcon?.classList.contains('sexC')) ||
            (cfg.transsexuals && sexIcon?.classList.contains('sexS'));

        const flagDiv = detailRow.querySelector('div.country.iconCountry');
        let hideCountry = false;
        if (flagDiv) {
            const style = flagDiv.getAttribute('style') || '';
            hideCountry =
                (cfg.germany && style.includes('/DE.gif')) ||
                (cfg.france  && style.includes('/FR.gif'));
        }

        return hideGender || hideCountry;
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
            if (!link || link.textContent.trim().toLowerCase() !== username) return;

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

        const username = userLink.textContent.trim().toLowerCase();

        if (hiddenUsers.has(username)) {
            hideRow(titleRow, detailRow);
            return;
        }

        const picCount = getPicCount(titleRow);
        if (picCount !== null && picCount < 4) {
            hideRow(titleRow, detailRow);
            return;
        }

        if (shouldHideByFilter(detailRow)) {
            hideRow(titleRow, detailRow);
            return;
        }

        if (avatar.querySelector('.ifap-hide-btn')) return;

        const btn = document.createElement('span');
        btn.className = 'ifap-hide-btn';
        btn.textContent = '✖';
        btn.title = `Block ${userLink.textContent.trim()} site-wide`;
        btn.style.cssText = `
            position:absolute;top:4px;right:4px;
            width:24px;height:24px;background:rgba(255,0,0,.8);
            color:white;font-weight:bold;text-align:center;line-height:24px;
            border-radius:50%;cursor:pointer;z-index:9999;
        `;

        avatar.style.position = 'relative';
        avatar.appendChild(btn);

        btn.onclick = e => {
            e.preventDefault(); e.stopPropagation();
            hiddenUsers.add(username);
            GM_setValue(hiddenUsersKey, [...hiddenUsers]);
            hideAllGalleriesForUser(username);
        };
    }

    function applyAll() {
        createGenderPanel();

        // Reset visibility of both title and detail rows
        document.querySelectorAll('tr').forEach(tr => {
            if (tr.querySelector('a[href*="gallery.php?gid="]') ||
                tr.getAttribute('valign') === 'top' ||
                tr.hasAttribute('bgcolor') ||
                tr.style.borderTop?.includes('dotted')) {
                tr.style.display = '';
            }
        });

        // Re-apply hiding
        document.querySelectorAll('a[href*="gallery.php?gid="]').forEach(a => {
            let titleRow = a;
            while (titleRow && titleRow.tagName !== 'TR') titleRow = titleRow.parentElement;
            if (titleRow) processGallery(titleRow);
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
