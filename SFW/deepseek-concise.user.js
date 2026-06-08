// ==UserScript==
// @name         DeepSeek Be Concise
// @namespace    DeepSeek_Be_Concise
// @version      1.0
// @description  Appends "be concise" to the prompt before sending and provides an enable/disable toggle.
// @author       masterofobzene
// @match        *://*.deepseek.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @license      GNU GPLv3
// @icon         https://deepseek.com/favicon.ico
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/deepseek-concise.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/deepseek-concise.user.js
// ==/UserScript==

(() => {
    'use strict';

    console.log('[Be Concise] Script loaded');

    let enabled = GM_getValue('beConciseEnabled', true);
    const SUFFIX = ' be concise';

    function appendSuffixToInput() {
        try {
            if (!enabled) {
                return;
            }

            const input =
                document.querySelector('textarea') ||
                document.querySelector('[contenteditable="true"]');

            if (!input) {
                console.warn('[Be Concise] Input not found');
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

            console.log('[Be Concise] Prompt modified');
        } catch (error) {
            console.error('[Be Concise]', error);
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
                console.error('[Be Concise]', error);
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

            if (document.getElementById('be-concise-toggle')) {
                return;
            }

            const container = document.createElement('div');
            container.id = 'be-concise-toggle';

            Object.assign(container.style, {
                position: 'fixed',
                top: '10px',
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
                    <input type="checkbox" id="be-concise-checkbox" ${enabled ? 'checked' : ''}>
                    <span>Be Concise</span>
                </label>
            `;

            document.body.appendChild(container);

            const checkbox = container.querySelector('#be-concise-checkbox');

            checkbox.addEventListener('change', event => {
                enabled = event.target.checked;
                GM_setValue('beConciseEnabled', enabled);

                console.log('[Be Concise] Enabled:', enabled);
            });

            console.log('[Be Concise] Toggle added');
        } catch (error) {
            console.error('[Be Concise]', error);
        }
    }

    createToggle();

    const observer = new MutationObserver(() => {
        if (!document.getElementById('be-concise-toggle')) {
            createToggle();
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
})();
