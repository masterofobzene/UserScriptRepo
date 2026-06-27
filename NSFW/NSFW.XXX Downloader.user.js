// ==UserScript==
// @name         NSFW.XXX Downloader
// @namespace    NSFW.XXX-Downloader
// @version      3.1
// @icon         https://nsfw.xxx/favicon.ico
// @description  Download full-resolution images/videos from NSFW.XXX
// @author       masterofobzene
// @homepage     https://github.com/masterofobzene/UserScriptRepo
// @match        https://nsfw.xxx/*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_addStyle
// @connect      nsfw.xxx
// @connect      cdn2.nsfw.xxx
// @connect      cdn3.nsfw.xxx
// @connect      cdn4.nsfw.xxx
// @connect      *
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/NSFW.XXX%20Downloader.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/NSFW.XXX%20Downloader.user.js
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
        .nsfw-download-btn {
            position: absolute !important;
            bottom: 10px !important;
            right: 10px !important;
            z-index: 99999 !important;
            background: #19FF19 !important;
            color: black !important;
            border: none !important;
            border-radius: 4px !important;
            padding: 5px 10px !important;
            font-size: 12px !important;
            cursor: pointer !important;
            opacity: 0.9 !important;
            transition: opacity 0.2s !important;
        }
        .nsfw-download-btn:hover { opacity: 1 !important; }
        .post { position: relative !important; }
    `);

    function addDownloadButtons() {
        document.querySelectorAll('.post:not([data-nsfw-dl])').forEach(card => {
            card.setAttribute('data-nsfw-dl', '1');
            const btn = document.createElement('button');
            btn.className = 'nsfw-download-btn';
            btn.textContent = 'DL↓';
            btn.addEventListener('click', async e => {
                e.preventDefault();
                e.stopPropagation();
                await onDownloadClick(card, btn);
            });
            card.appendChild(btn);
        });
    }

    async function onDownloadClick(card, btn) {
        btn.disabled = true;
        btn.textContent = 'Finding source...';
        try {
            const postLink = card.querySelector('a.post--link');
            if (!postLink || !postLink.href) throw new Error('No post link found');
            const url = await fetchFullResFromPost(postLink.href);
            if (!url) throw new Error('No media source found on post page');
            await downloadFile(url, btn);
        } catch (err) {
            notifyError(err, btn);
        }
    }

    async function fetchFullResFromPost(postUrl) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: postUrl,
                onload(response) {
                    try {
                        const doc = new DOMParser().parseFromString(response.responseText, 'text/html');

                        // 1. Look for an <img> with /uploads in the src (not thumbnails)
                        for (const img of doc.querySelectorAll('img')) {
                            const src = img.getAttribute('src') || img.dataset.src || '';
                            if (src.includes('/uploads') && !src.includes('/thumbnails/')) {
                                return resolve(src);
                            }
                        }

                        // 2. Check Vuetify background image on .v-image__image
                        const bgDiv = doc.querySelector('.v-image__image');
                        if (bgDiv) {
                            const style = bgDiv.getAttribute('style') || '';
                            const match = style.match(/url\("([^"]+)"\)/);
                            if (match && match[1] && match[1].includes('/uploads') && !match[1].includes('/thumbnails/')) {
                                return resolve(match[1]);
                            }
                        }

                        // 3. Video source
                        const videoSrc = doc.querySelector('video source')?.src;
                        if (videoSrc) return resolve(videoSrc);

                        reject(new Error('Full-resolution media not found on post page.'));
                    } catch (e) {
                        reject(new Error('Error parsing post page HTML.'));
                    }
                },
                onerror() { reject(new Error('Failed to fetch post page.')); }
            });
        });
    }

    async function downloadFile(url, btn) {
        let filename = url.split('/').pop().split('?')[0].replace(/[^a-zA-Z0-9\.\-_]/g, '_');
        btn.textContent = 'Downloading...';
        GM_download({
            url, name: filename,
            onload() {
                btn.textContent = '✓ Done';
                setTimeout(() => {
                    btn.textContent = 'DL↓';
                    btn.disabled = false;
                }, 2000);
            },
            onerror(err) { notifyError(new Error(`Download failed: ${err.error}`), btn); },
            ontimeout() { notifyError(new Error('Download timed out'), btn); }
        });
    }

    function notifyError(err, btn) {
        console.error(err);
        GM_notification({ title: 'Download Error', text: err.message, timeout: 5000 });
        btn.textContent = 'DL↓';
        btn.disabled = false;
    }

    new MutationObserver(muts => {
        for (const m of muts) if (m.addedNodes.length) addDownloadButtons();
    }).observe(document.body, { childList: true, subtree: true });

    addDownloadButtons();
})();
