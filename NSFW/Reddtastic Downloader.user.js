// ==UserScript==
// @name         Reddtastic Downloader
// @namespace    https://reddtastic.com/
// @version      1.4.9
// @description  Muestra un boton "download" para imagenes y videos.
// @match        https://reddtastic.com/*
// @icon         https://reddtastic.com/favicon.ico
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/Reddtastic%20Downloader.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/NSFW/Reddtastic%20Downloader.user.js
// ==/UserScript==

(function () {
  'use strict';

  const mediaRe = /\.(jpe?g|png|gif|mp4|webm|mov)(?:[\?#]|$)/i;

  const style = document.createElement('style');
  style.textContent = `
    .vm-dl-btn {
      position: absolute;
      top: 5px; right: 5px;
      z-index: 9999;
      padding: 4px 8px;
      background: #FF00FF;
      color: white;
      font-size: 12px;
      font-weight: bold;
      border: none;
      border-radius: 3px;
      cursor: pointer;
    }
    .vm-dl-wrap { position: relative !important; display: inline-block; }
  `;
  document.head.appendChild(style);

  // ---- removed: GM_registerMenuCommand & getDownloadMethod ----

  function randStr(len = 8) {
    return Math.random().toString(36).substr(2, len);
  }

  function fetchFilenameHEAD(url, cb) {
    GM_xmlhttpRequest({
      method: 'HEAD',
      url,
      onload(res) {
        const hdr = res.responseHeaders
          .split('\r\n')
          .find(l => /^content-disposition:/i.test(l));
        if (hdr) {
          const m = hdr.match(/filename\*?=(?:[^']*'')?"?([^;"']+)"/i);
          if (m && m[1]) return cb(decodeURIComponent(m[1]));
        }
        cb(null);
      },
      onerror() { cb(null); }
    });
  }

  // ---- removed: triggerIDMDownload ----

  function doDownload(url, defaultName) {
    // Always use native GM_download – fallback to IDM removed
    GM_download({
      url: url,
      name: defaultName,
      saveAs: false,
      onerror: () => {
        console.warn('GM_download failed for:', url);
      }
    });
  }

  function makeBtn(parent, onClick) {
    if (parent.dataset.vmBtn) return;
    parent.dataset.vmBtn = '1';
    parent.classList.add('vm-dl-wrap');
    const btn = document.createElement('button');
    btn.className = 'vm-dl-btn';
    btn.textContent = 'DL⬇';               // changed from "Download (IDM)"
    btn.title = 'Download';               // changed from "Download with IDM"
    btn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      onClick();
    });
    parent.appendChild(btn);
  }

  function addButtons(root = document) {
    root.querySelectorAll('img').forEach(img => {
      if (img.dataset.vmBtn) return;
      const url = img.src;
      if (!mediaRe.test(url)) return;

      const container = img.parentNode;
      makeBtn(container, () => {
        let sourceUrl = url.includes('preview.redd.it')
          ? url.replace('preview.redd.it', 'i.redd.it')
          : url;

        fetchFilenameHEAD(sourceUrl, cdName => {
          const filename = cdName || sourceUrl.split('/').pop().split('?')[0] || `image_${randStr()}.jpg`;
          doDownload(sourceUrl, decodeURIComponent(filename));
        });
      });
    });

    root.querySelectorAll('video').forEach(video => {
      if (video.dataset.vmBtn) return;
      const src = video.currentSrc || video.src || (video.querySelector('source') || {}).src;
      if (!mediaRe.test(src)) return;
      const ext = (src.match(mediaRe) || [])[1] || 'mp4';
      const container = video.parentNode;
      makeBtn(container, () => {
        fetchFilenameHEAD(src, cdName => {
          const name = cdName || `video_${randStr()}.${ext}`;
          doDownload(src, name);
        });
      });
    });

    root.querySelectorAll('a[href*="reddit.com"]').forEach(a => {
      if (a.dataset.vmBtn) return;
      const url = a.href;
      const extMatch = url.match(mediaRe);
      if (!extMatch) return;
      const isVideo = /\.(mp4|webm|mov)(?:[\?#]|$)/i.test(extMatch[0]);
      makeBtn(a, () => {
        if (!isVideo) return;
        fetchFilenameHEAD(url, cdName => {
          const name = cdName || `video_${randStr()}.${extMatch[1]}`;
          doDownload(url, name);
        });
      });
    });
  }

  new MutationObserver(() => addButtons()).observe(
    document.body,
    { childList: true, subtree: true }
  );

  addButtons();
})();
