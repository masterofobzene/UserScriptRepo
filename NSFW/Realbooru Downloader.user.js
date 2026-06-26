// ==UserScript==
// @name         Realbooru Downloader
// @namespace    Realbooru-Downloader
// @version      1.8
// @icon         https://realbooru.com/favicon.ico
// @author       masterofobzene
// @homepage     https://github.com/masterofobzene/UserScriptRepo
// @description  Download full-resolution images and videos from Realbooru posts with a small button
// @match        https://realbooru.com/index.php?page=post&s=list*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      realbooru.com
// @run-at       document-end
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/Realbooru%20Downloader.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/Realbooru%20Downloader.user.js
// ==/UserScript==

(function () {
    'use strict';

    const BUTTON_STYLE = `
        position: absolute;
        bottom: 4px;
        right: 4px;
        background-color: #ff6600;
        color: white;
        border: none;
        padding: 2px 6px;
        border-radius: 3px;
        cursor: pointer;
        font-weight: bold;
        font-size: 17px;
        z-index: 9999;
    `;

    function getFilenameFromUrl(url) {
        try {
            const pathname = new URL(url).pathname;
            return decodeURIComponent(pathname.substring(pathname.lastIndexOf('/') + 1)) || 'file';
        } catch (e) {
            console.error('❌ Error parsing filename:', url, e);
            return 'file';
        }
    }

    function extractFullMediaUrl(html, baseUrl) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const base = baseUrl || doc.baseURI;

        const img = doc.querySelector('#image');
        if (img?.src) return new URL(img.getAttribute('src'), base).href;

        const videoSrc = doc.querySelector('video source');
        if (videoSrc?.src) return new URL(videoSrc.getAttribute('src'), base).href;

        const metaImg = doc.querySelector('meta[property="og:image"]');
        if (metaImg?.content) return new URL(metaImg.content, base).href;
        const metaVid = doc.querySelector('meta[property="og:video"]');
        if (metaVid?.content) return new URL(metaVid.content, base).href;

        const origLink = doc.querySelector('a[href*="/images/"]');
        if (origLink) return new URL(origLink.getAttribute('href'), base).href;

        return null;
    }

    function downloadFile(url, filename, referer) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            responseType: 'blob',
            headers: { 'Referer': referer },
            onload: function (resp) {
                if (resp.status === 200) {
                    const blob = resp.response;
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                } else {
                    console.error('❌ Download failed, status:', resp.status);
                }
            },
            onerror: function (err) {
                console.error('❌ Download error:', err);
            }
        });
    }

    function createDownloadButton(postUrl) {
        const btn = document.createElement('button');
        btn.textContent = '⬇';
        btn.setAttribute('style', BUTTON_STYLE);
        btn.className = 'realbooru-download-button';

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            try {
                const response = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: postUrl,
                        onload: resolve,
                        onerror: reject
                    });
                });

                const fullUrl = extractFullMediaUrl(response.responseText, postUrl);
                if (!fullUrl) {
                    console.error('❌ Could not extract media URL.');
                    return;
                }

                downloadFile(fullUrl, getFilenameFromUrl(fullUrl), postUrl);
            } catch (err) {
                console.error('❌ Failed to fetch post page:', err);
            }
        });

        return btn;
    }

    function addButtons() {
        const selectors = [
            'div.thumb',
            'article.thumbnail-preview',
            'div.thumbnail-container',
            'div.thumb > a[href*="page=post&s=view"]',
            'a[href*="page=post&s=view"]'
        ];

        let count = 0;

        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                const container = element.closest('div.thumb, article.thumbnail-preview, div.thumbnail-container') || element;
                if (container.querySelector('.realbooru-download-button')) return;
                const link = element.href ? element : element.querySelector('a[href*="page=post&s=view"]');
                if (!link || !link.href) return;
                container.style.position = 'relative';
                const btn = createDownloadButton(link.href);
                container.appendChild(btn);
                count++;
            });
        });

        if (count > 0) console.log(`✅ Added ${count} download button(s).`);
    }

    setTimeout(addButtons, 1000);

    new MutationObserver(addButtons).observe(document.body, {
        childList: true,
        subtree: true
    });
})();
