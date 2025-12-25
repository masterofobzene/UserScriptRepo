// ==UserScript==
// @name         ImageFap User Gallery Hider
// @namespace    ImageFap_User_Gallery_Hider
// @version      1.4
// @description  Hide ImageFap user galleries (click ✖) and auto-hide galleries with <4 pictures.
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
    let hiddenUsers = new Set(GM_getValue(hiddenUsersKey, []));

    function hideRows(titleRow, detailRow) {
        titleRow.style.display = 'none';
        if (detailRow) detailRow.style.display = 'none';
    }

    function showRows(titleRow, detailRow) {
        titleRow.style.display = '';
        if (detailRow) detailRow.style.display = '';
    }

    function processGallery(titleRow) {
        if (titleRow.getAttribute('data-processed')) return;
        titleRow.setAttribute('data-processed', 'true');

        const detailRow = titleRow.nextElementSibling;
        if (!detailRow || detailRow.getAttribute('valign') !== 'top') return;

        // Auto-hide <4 pics
        const picCountTd = titleRow.querySelector('td > center');
        if (picCountTd) {
            const picCount = parseInt(picCountTd.textContent.trim(), 10);
            if (!isNaN(picCount) && picCount < 4) {
                hideRows(titleRow, detailRow);
                return;
            }
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
            position: absolute; top: 4px; right: 4px;
            width: 24px; height: 24px; background: rgba(255,0,0,0.8);
            color: white; font-weight: bold; text-align: center;
            line-height: 24px; border-radius: 50%; cursor: pointer;
            font-size: 16px; z-index: 999; box-shadow: 0 0 4px black;
        `;

        avatarDiv.style.position = 'relative';
        avatarDiv.appendChild(btn);

        btn.addEventListener('click', (e) => {
            e.stopPropagation(); e.preventDefault();
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

    function applyAll() {
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

    // Initial run
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyAll);
    } else {
        applyAll();
    }

    // Observer with debounce
    let timeout;
    const observer = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(applyAll, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
