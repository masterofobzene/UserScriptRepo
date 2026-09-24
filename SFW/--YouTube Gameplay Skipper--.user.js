// ==UserScript==
// @name         ::YouTube Gameplay Skipper::
// @namespace    masterofobzene-gameplay skipper
// @version      3.3
// @description  Force skip 2 minutes for videos or playlists containing custom words.
// @author       masterofobzene
// @homepage     https://github.com/masterofobzene/UserScriptRepo
// @match        https://www.youtube.com/*
// @icon         https://www.youtube.com/favicon.ico
// @grant        GM_addStyle
// @license      GNU GPLv3
// @run-at       document-start
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/--YouTube%20Gameplay%20Skipper--.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/--YouTube%20Gameplay%20Skipper--.user.js
// ==/UserScript==

(function() {
    'use strict';

    const DEBUG = true;
    const SKIP_TIME = 120;
    const TARGET_WORDS = ['gameplay', 'longplay', 'no commentary', "let's play"];
    let currentVideoId = null;
    let skipPerformed = false;

    function log(...args) {
        if(DEBUG) console.log('[YT Skip]', ...args);
    }

    function getVideoTitle() {
        const selectors = [
            '#title h1 yt-formatted-string',
            'h1.title.style-scope',
            '#container > h1',
            '[aria-label="Video title"]'
        ];
        for(const selector of selectors) {
            const el = document.querySelector(selector);
            if(el && el.textContent) {
                log('Found video title using selector:', selector);
                return el.textContent.toLowerCase();
            }
        }
        return null;
    }

    function getPlaylistTitle() {
        const selectors = [
            'a.ytAttributedStringLink[href*="/playlist?list="]',
            '#playlist-title',
            'yt-formatted-string#playlist-title',
            '.playlist-title',
            '#header-description yt-formatted-string'
        ];
        for(const selector of selectors) {
            const el = document.querySelector(selector);
            if(el && el.textContent) {
                log('Found playlist title using selector:', selector);
                return el.textContent.toLowerCase();
            }
        }
        return null;
    }

    function checkVideo() {
        const urlParams = new URLSearchParams(window.location.search);
        const newVideoId = urlParams.get('v');
        if(newVideoId && newVideoId !== currentVideoId) {
            log('New video detected:', newVideoId);
            currentVideoId = newVideoId;
            skipPerformed = false;
        }
    }

    function shouldSkip(title) {
        return TARGET_WORDS.some(word => title.includes(word));
    }

    function performSkip() {
        const video = document.querySelector('video');
        if(!video) {
            log('Video element not found');
            return false;
        }
        if(video.duration < SKIP_TIME) {
            log('Video too short:', video.duration);
            return false;
        }
        if(video.currentTime < SKIP_TIME) {
            log(`Skipping from ${video.currentTime} to ${SKIP_TIME}`);
            video.currentTime = SKIP_TIME;
            return true;
        }
        return false;
    }

    function mainChecker(attempt = 0) {
        if(skipPerformed) return;
        checkVideo();

        const videoTitle = getVideoTitle();
        const playlistTitle = getPlaylistTitle();

        if(!videoTitle && !playlistTitle) {
            if(attempt < 5) {
                log(`Titles not found (attempt ${attempt}), retrying...`);
                setTimeout(() => mainChecker(attempt + 1), 500 * (attempt + 1));
            }
            return;
        }

        const videoMatch = videoTitle && shouldSkip(videoTitle);
        const playlistMatch = playlistTitle && shouldSkip(playlistTitle);

        if(videoMatch || playlistMatch) {
            log(`Match found. Video: ${videoTitle}, Playlist: ${playlistTitle}`);

            const videoCheck = setInterval(() => {
                if(performSkip()) {
                    log('Skip successful!');
                    clearInterval(videoCheck);
                    skipPerformed = true;
                } else if(attempt < 10) {
                    log(`Skip attempt ${attempt}`);
                    attempt++;
                } else {
                    clearInterval(videoCheck);
                    log('Max attempts reached');
                }
            }, 1000);
        }
    }

    const observer = new MutationObserver(() => {
        if(document.querySelector('#movie_player, #player-container')) {
            mainChecker();
        }
    });

    observer.observe(document, {
        subtree: true,
        childList: true,
        attributes: false,
        characterData: false
    });

    document.addEventListener('yt-navigate-start', mainChecker);
    document.addEventListener('yt-page-data-updated', mainChecker);
    window.addEventListener('spfdone', mainChecker);

    setTimeout(mainChecker, 1000);
    setTimeout(mainChecker, 3000);
    setTimeout(mainChecker, 5000);

    GM_addStyle(`
        .ytp-autoskip-message {
            background: rgba(0,0,0,0.8) !important;
            color: #fff !important;
            padding: 8px !important;
            border-radius: 4px !important;
            font-size: 14px !important;
        }
    `);
})();
