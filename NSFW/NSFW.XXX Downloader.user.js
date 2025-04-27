// ==UserScript==
// @name         NSFW.XXX Downloader
// @namespace    NSFW.XXX-Downloader
// @version      3.0
// @icon         https://nsfw.xxx/favicon.ico
// @description  Download full-resolution images/videos from NSFW.XXX posts
// @author       masterofobzene
// @homepage     https://github.com/masterofobzene/UserScriptRepo
// @match        https://nsfw.xxx/*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_addStyle
// @connect      nsfw.xxx
// @connect      cdn2.nsfw.xxx
// @connect      *
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/
// ==/UserScript==

(function() {
    'use strict';

    // --- Button styles ---
    GM_addStyle(`
        .nsfw-download-btn {
            position: absolute !important;
            bottom: 10px !important;
            right: 10px !important;
            z-index: 99999 !important;
            background: #4CAF50 !important;
            color: white !important;
            border: none !important;
            border-radius: 4px !important;
            padding: 5px 10px !important;
            font-size: 12px !important;
            cursor: pointer !important;
            opacity: 0.9 !important;
            transition: opacity 0.2s !important;
        }
        .nsfw-download-btn:hover {
            opacity: 1 !important;
        }
        .media-container {
            position: relative !important;
        }
    `);

    // --- Inject buttons into each media container ---
    function addDownloadButtons() {
        document.querySelectorAll('.sh-section__image, .sh-section__media, .post-media, .image-container').forEach(container => {
            if (container.querySelector('.nsfw-download-btn')) return;
            const btn = document.createElement('button');
            btn.className = 'nsfw-download-btn';
            btn.textContent = '↓ Download';
            btn.addEventListener('click', async e => {
                e.preventDefault(); e.stopPropagation();
                await onDownloadClick(container, btn);
            });
            container.classList.add('media-container');
            container.appendChild(btn);
        });
    }

    // --- Handle button click ---
    async function onDownloadClick(container, btn) {
        btn.disabled = true;
        btn.textContent = 'Finding source...';
        try {
            let url = await extractMediaUrl(container);
            if (!url) throw new Error('No media source found');
            await downloadFile(url, btn);
        } catch (err) {
            notifyError(err, btn);
        }
    }

    // --- Extract the best media URL from the container ---
    async function extractMediaUrl(container) {
        // 1. Direct full-res image already in page?
        let img = container.querySelector('img');
        if (img && img.src && !img.src.includes('/thumbnails/')) {
            return img.src;
        }

        // 2. If it's still a thumbnail, follow the post link
        if (img && (img.src.includes('/thumbnails/') || img.dataset.src?.includes('/thumbnails/'))) {
            const link = img.closest('a.slider_init_href');
            if (!link || !link.href) {
                throw new Error('Cannot find post link for thumbnail');
            }
            return await fetchFullResFromPost(link.href);
        }

        // 3. Fallback: video preview container
        const vid = container.querySelector('video source');
        if (vid && vid.src) return vid.src;

        // 4. Iframe or other embed
        const iframe = container.querySelector('iframe');
        if (iframe && iframe.src) return iframe.src;

        return null;
    }

    // --- Fetch the post page and scrape the real full-res media URL ---
    async function fetchFullResFromPost(postUrl) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: postUrl,
                onload(response) {
                    try {
                        const doc = new DOMParser().parseFromString(response.responseText, 'text/html');

                        // Look *only* inside the .sh-section__image container for big images
                        const images = doc.querySelectorAll('.sh-section__image img');
                        for (let img of images) {
                            const src = img.getAttribute('src') || img.dataset.src;
                            // Must be a real upload (not still thumbnail)
                            if (src && !src.includes('/thumbnails/') && src.includes('/uploads')) {
                                return resolve(src);
                            }
                        }

                        // If no suitable image, try video
                        const videoSrc = doc.querySelector('video source')?.src;
                        if (videoSrc) return resolve(videoSrc);

                        reject(new Error('Full-resolution media not found on post page.'));
                    } catch (e) {
                        reject(new Error('Error parsing post page HTML.'));
                    }
                },
                onerror() {
                    reject(new Error('Failed to fetch post page.'));
                }
            });
        });
    }

    // --- Download via GM_download and update button state ---
    async function downloadFile(url, btn) {
        let filename = url.split('/').pop().split('?')[0].replace(/[^a-zA-Z0-9\.\-_]/g, '_');
        btn.textContent = 'Downloading...';
        GM_download({
            url, name: filename,
            onload() {
                btn.textContent = '✓ Done';
                setTimeout(() => {
                    btn.textContent = '↓ Download';
                    btn.disabled = false;
                }, 2000);
            },
            onerror(err) {
                notifyError(new Error(`Download failed: ${err.error}`), btn);
            },
            ontimeout() {
                notifyError(new Error('Download timed out'), btn);
            }
        });
    }

    // --- Error handler ---
    function notifyError(err, btn) {
        console.error(err);
        GM_notification({ title: 'Download Error', text: err.message, timeout: 5000 });
        btn.textContent = '↓ Download';
        btn.disabled = false;
    }

    // --- Watch for dynamically loaded content ---
    new MutationObserver(muts => muts.forEach(m => m.addedNodes.length && addDownloadButtons()))
        .observe(document.body, { childList: true, subtree: true });

    // --- Initial run ---
    addDownloadButtons();

})();
