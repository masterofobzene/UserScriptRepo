// ==UserScript==
// @name         DeepSeek Answer in English
// @namespace    DeepSeek_Answer_In_English
// @version      1.1
// @description  Appends "answer in english" to the prompt before sending and provides an enable/disable toggle.
// @author       masterofobzene
// @match        *://*.deepseek.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @license      GNU GPLv3
// @icon         https://deepseek.com/favicon.ico
// @homepage     https://github.com/masterofobzene/UserScriptRepo
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/deepseek-answer-in-english.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/deepseek-answer-in-english.user.js
// ==/UserScript==

(() => {
    'use strict';

    console.log('[Answer in English] Script loaded');

    let enabled = GM_getValue('answerInEnglishEnabled', true);
    const SUFFIX = ' answer in english';

    function appendSuffixToInput() {
        try {
            if (!enabled) {
                return;
            }

            const input =
                document.querySelector('textarea') ||
                document.querySelector('[contenteditable="true"]');

            if (!input) {
                console.warn('[Answer in English] Input not found');
                return;
            }

            const currentText =
                input instanceof HTMLTextAreaElement
                    ? input.value
                    : input.textContent || '';

            if (!currentText.trim()) {
                return;
            }

            if (currentText.endsWith(SUFFIX)) {
                return;
            }

            const newText = currentText + SUFFIX;

            if (input instanceof HTMLTextAreaElement) {
                const descriptor = Object.getOwnPropertyDescriptor(
                    HTMLTextAreaElement.prototype,
                    'value'
                );

                if (descriptor?.set) {
                    descriptor.set.call(input, newText);
                } else {
                    input.value = newText;
                }
            } else {
                input.textContent = newText;
            }

            input.dispatchEvent(
                new InputEvent('input', {
                    bubbles: true,
                    cancelable: true
                })
            );

            input.dispatchEvent(
                new Event('change', {
                    bubbles: true
                })
            );

            console.log('[Answer in English] Prompt modified');
        } catch (error) {
            console.error('[Answer in English]', error);
        }
    }

    document.addEventListener(
        'keydown',
        event => {
            try {
                if (!enabled) {
                    return;
                }

                if (event.key !== 'Enter') {
                    return;
                }

                if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
                    return;
                }

                appendSuffixToInput();
            } catch (error) {
                console.error('[Answer in English]', error);
            }
        },
        true
    );

    function createToggle() {
        try {
            if (!document.body) {
                setTimeout(createToggle, 500);
                return;
            }

            if (document.getElementById('answer-in-english-toggle')) {
                return;
            }

            const container = document.createElement('div');
            container.id = 'answer-in-english-toggle';

            Object.assign(container.style, {
                position: 'fixed',
                top: '60px',
                right: '10px',
                zIndex: '2147483647',
                background: 'rgba(255,255,255,0.95)',
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '8px 12px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                fontFamily: 'system-ui, sans-serif',
                fontSize: '13px',
                color: '#000'
            });

            container.innerHTML = `
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                    <input type="checkbox" id="answer-in-english-checkbox" ${enabled ? 'checked' : ''}>
                    <span>Answer in English</span>
                </label>
            `;

            document.body.appendChild(container);

            const checkbox = container.querySelector('#answer-in-english-checkbox');

            checkbox.addEventListener('change', event => {
                enabled = event.target.checked;
                GM_setValue('answerInEnglishEnabled', enabled);

                console.log('[Answer in English] Enabled:', enabled);
            });

            console.log('[Answer in English] Toggle added');
        } catch (error) {
            console.error('[Answer in English]', error);
        }
    }

    createToggle();

    const observer = new MutationObserver(() => {
        if (!document.getElementById('answer-in-english-toggle')) {
            createToggle();
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
})();
