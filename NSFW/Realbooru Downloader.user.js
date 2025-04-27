// ==UserScript==
// @name         Realbooru Downloader
// @namespace    Realbooru-Downloader
// @version      1.7
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
        font-size: 10px;
        z-index: 9999;
    `;

    function getFilenameFromUrl(url) {
        try {
            const pathname = new URL(url).pathname;
            return decodeURIComponent(pathname.substring(pathname.lastIndexOf('/') + 1)) || 'file';
        } catch (e) {
            console.error('❌ Error parsing filename from URL:', url, e);
            return 'file';
        }
    }

    function extractFullMediaUrl(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');

        const image = doc.querySelector('#image');
        if (image?.src) return image.src;

        const video = doc.querySelector('video source');
        if (video?.src) return video.src;

        const meta = doc.querySelector('meta[property="og:video"]');
        if (meta?.content) return meta.content;

        const ogImage = doc.querySelector('meta[property="og:image"]');
        if (ogImage?.content) return ogImage.content;

        return null;
    }

    function createDownloadButton(postUrl) {
        const btn = document.createElement('button');
        btn.textContent = '⬇';
        btn.setAttribute('style', BUTTON_STYLE);
        btn.className = 'realbooru-download-button';

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log(`🔄 Fetching: ${postUrl}`);

            try {
                const response = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: postUrl,
                        onload: resolve,
                        onerror: reject
                    });
                });

                const fullUrl = extractFullMediaUrl(response.responseText);
                if (!fullUrl) {
                    console.error('❌ Media URL not found');
                    return;
                }

                const filename = getFilenameFromUrl(fullUrl);
                GM_download({
                    url: fullUrl,
                    name: filename,
                    saveAs: false,
                    onerror: (err) => console.error('❌ Download error:', err),
                    onload: () => console.log('✅ Downloaded:', filename),
                });
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
                // Find the main post container
                const container = element.closest('div.thumb, article.thumbnail-preview, div.thumbnail-container') || element;

                // Skip if container already has a button
                if (container.querySelector('.realbooru-download-button')) return;

                // Find the post link
                const link = element.href ? element :
                    element.querySelector('a[href*="page=post&s=view"]');

                if (!link || !link.href) return;

                // Prepare container and add button
                container.style.position = 'relative';
                const btn = createDownloadButton(link.href);
                container.appendChild(btn);
                count++;
            });
        });

        if (count > 0) console.log(`✅ Added ${count} download button(s).`);
    }

    // Initial run
    setTimeout(addButtons, 1000);

    // MutationObserver for dynamic content
    new MutationObserver(addButtons).observe(document.body, {
        childList: true,
        subtree: true
    });
})();
