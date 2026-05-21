// ==UserScript==
// @name         Pornolab Post Preview
// @namespace    PornolabPreview
// @version      1.0
// @description  Shows first real post image when hovering topic links
// @author       masterofobzene
// @match        *://pornolab.net/forum/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      *
// @run-at       document-idle
// @icon         https://pornolab.net/favicon.ico
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/Pornolab_Post_Preview.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/Pornolab_Post_Preview.user.js
// ==/UserScript==

(() => {
    'use strict';

    console.log('[HoverPreview] Initialized');

    const CACHE = new Map();
    const REQUESTS = new Map();

    const POPUP_WIDTH = 480;
    const POPUP_HEIGHT = 360;
    const HOVER_DELAY = 250;

    let hoverTimer = null;
    let currentAnchor = null;

    GM_addStyle(`
        #vm-hover-preview {
            position: fixed;
            z-index: 999999;
            display: none;
            width: ${POPUP_WIDTH}px;
            background: rgba(20,20,20,0.97);
            border: 1px solid #555;
            border-radius: 8px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.7);
            overflow: hidden;
            padding: 8px;
            pointer-events: none;
        }

        #vm-hover-preview img {
            width: 100%;
            height: auto;
            max-height: ${POPUP_HEIGHT}px;
            object-fit: contain;
            display: block;
            border-radius: 4px;
        }

        #vm-hover-preview .vm-msg {
            color: #ddd;
            font-family: sans-serif;
            font-size: 14px;
            text-align: center;
            padding: 30px 10px;
        }
    `);

    const popup = document.createElement('div');

    popup.id = 'vm-hover-preview';

    document.body.appendChild(popup);

    function isTopicLink(anchor) {
        if (!anchor?.href) {
            return false;
        }

        try {
            const url = new URL(anchor.href);

            return (
                url.pathname.includes('/forum/viewtopic.php') &&
                url.searchParams.has('t')
            );
        } catch {
            return false;
        }
    }

    function showMessage(message, event) {
        popup.innerHTML = `<div class="vm-msg">${message}</div>`;
        popup.style.display = 'block';

        if (event) {
            positionPopup(event);
        }
    }

    function hidePopup() {
        popup.style.display = 'none';
        popup.innerHTML = '';
    }

    function positionPopup(event) {
        const margin = 20;

        let left = event.clientX + margin;
        let top = event.clientY + margin;

        if (left + POPUP_WIDTH > window.innerWidth) {
            left = event.clientX - POPUP_WIDTH - margin;
        }

        if (top + POPUP_HEIGHT > window.innerHeight) {
            top = window.innerHeight - POPUP_HEIGHT - margin;
        }

        popup.style.left = `${Math.max(10, left)}px`;
        popup.style.top = `${Math.max(10, top)}px`;
    }

    function normalizeUrl(url, base) {
        try {
            return new URL(url, base).href;
        } catch {
            return null;
        }
    }

    function extractFirstImage(html, pageUrl) {
        try {
            const parser = new DOMParser();

            const doc = parser.parseFromString(html, 'text/html');

            /*
                REAL PORNOLAB STRUCTURE:

                <var class="postImg"
                     title="https://i127.fastpic.org/thumb/...jpeg">
                </var>

                Source verified from post-source.txt
            */

            const vars = [
                ...doc.querySelectorAll('var.postImg')
            ];

            console.log(
                '[HoverPreview] postImg count:',
                vars.length
            );

            for (const node of vars) {
                const title = node.getAttribute('title');

                if (!title) {
                    continue;
                }

                const imageUrl = normalizeUrl(title, pageUrl);

                if (!imageUrl) {
                    continue;
                }

                const lower = imageUrl.toLowerCase();

                // Ignore ads/logos/etc
                if (
                    lower.includes('logo') ||
                    lower.includes('banner') ||
                    lower.includes('avatar') ||
                    lower.includes('ads') ||
                    lower.includes('smile') ||
                    lower.includes('static.pornolab')
                ) {
                    continue;
                }

                console.log(
                    '[HoverPreview] Selected post image:',
                    imageUrl
                );

                return imageUrl;
            }

            console.warn('[HoverPreview] No postImg found');

            return null;
        } catch (err) {
            console.error(
                '[HoverPreview] Failed extracting image:',
                err
            );

            return null;
        }
    }

    async function fetchTopicImage(url) {
        if (CACHE.has(url)) {
            return CACHE.get(url);
        }

        if (REQUESTS.has(url)) {
            return REQUESTS.get(url);
        }

        const promise = new Promise((resolve, reject) => {
            console.log('[HoverPreview] Fetching topic:', url);

            GM_xmlhttpRequest({
                method: 'GET',
                url,
                anonymous: false,
                timeout: 15000,

                headers: {
                    Referer: location.href
                },

                onload: response => {
                    try {
                        if (response.status !== 200) {
                            reject(
                                new Error(
                                    `HTTP ${response.status}`
                                )
                            );

                            return;
                        }

                        const imageUrl = extractFirstImage(
                            response.responseText,
                            url
                        );

                        CACHE.set(url, imageUrl);

                        resolve(imageUrl);
                    } catch (err) {
                        reject(err);
                    } finally {
                        REQUESTS.delete(url);
                    }
                },

                onerror: err => {
                    REQUESTS.delete(url);

                    reject(err);
                },

                ontimeout: () => {
                    REQUESTS.delete(url);

                    reject(new Error('Timeout'));
                }
            });
        });

        REQUESTS.set(url, promise);

        return promise;
    }

    async function fetchImageBlob(url) {
        return new Promise((resolve, reject) => {
            console.log('[HoverPreview] Fetching image:', url);

            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType: 'blob',
                anonymous: false,
                timeout: 15000,

                headers: {
                    Referer: location.href
                },

                onload: response => {
                    try {
                        if (response.status !== 200) {
                            reject(
                                new Error(
                                    `Image HTTP ${response.status}`
                                )
                            );

                            return;
                        }

                        const blobUrl = URL.createObjectURL(
                            response.response
                        );

                        resolve(blobUrl);
                    } catch (err) {
                        reject(err);
                    }
                },

                onerror: reject,

                ontimeout: () => {
                    reject(new Error('Image timeout'));
                }
            });
        });
    }

    async function handleHover(anchor, event) {
        try {
            const topicUrl = anchor.href;

            showMessage('Loading preview...', event);

            const imageUrl = await fetchTopicImage(topicUrl);

            if (currentAnchor !== anchor) {
                return;
            }

            if (!imageUrl) {
                showMessage('No image found', event);

                return;
            }

            const blobUrl = await fetchImageBlob(imageUrl);

            if (currentAnchor !== anchor) {
                URL.revokeObjectURL(blobUrl);

                return;
            }

            popup.innerHTML = '';

            const img = document.createElement('img');

            img.onload = () => {
                console.log('[HoverPreview] Image displayed');
            };

            img.onerror = err => {
                console.error(
                    '[HoverPreview] Failed displaying image:',
                    err
                );

                showMessage('Failed displaying image', event);
            };

            img.src = blobUrl;

            popup.appendChild(img);

            popup.style.display = 'block';

            positionPopup(event);
        } catch (err) {
            console.error('[HoverPreview] Hover failed:', err);

            showMessage('Failed loading image', event);
        }
    }

    document.addEventListener('mouseover', event => {
        const anchor = event.target.closest('a');

        if (!isTopicLink(anchor)) {
            return;
        }

        currentAnchor = anchor;

        clearTimeout(hoverTimer);

        hoverTimer = setTimeout(() => {
            handleHover(anchor, event);
        }, HOVER_DELAY);
    });

    document.addEventListener('mousemove', event => {
        if (popup.style.display === 'block') {
            positionPopup(event);
        }
    });

    document.addEventListener('mouseout', event => {
        const anchor = event.target.closest('a');

        if (!anchor || anchor !== currentAnchor) {
            return;
        }

        clearTimeout(hoverTimer);

        currentAnchor = null;

        hidePopup();
    });

    window.addEventListener(
        'scroll',
        () => {
            hidePopup();
        },
        { passive: true }
    );

    console.log('[HoverPreview] Ready');
})();
