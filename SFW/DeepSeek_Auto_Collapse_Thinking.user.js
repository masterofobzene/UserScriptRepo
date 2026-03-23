// ==UserScript==
// @name         DeepSeek Auto-Collapse Thinking
// @namespace    DeepSeek_Auto_Collapse_Thinking
// @version      1.0
// @description  Automatically collapses the "thinking" section in DeepSeek chat messages.
// @author       masterofobzene
// @match        https://chat.deepseek.com/*
// @grant        none
// @run-at       document-idle
// @icon         https://chat.deepseek.com/favicon.ico
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/DeepSeek_Auto_Collapse_Thinking.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/DeepSeek_Auto_Collapse_Thinking.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Selector for the thinking content element (based on your provided path)
    const THINK_CONTENT_SELECTOR = 'div.ds-think-content';
    // Selector for the toggle button that expands/collapses the thinking content
    // (common patterns from DeepSeek – adjust if needed)
    const THINK_TOGGLE_SELECTORS = [
        'button[aria-label*="thinking" i]',
        'button[aria-label*="thought" i]',
        'button[class*="think-toggle"]',
        'summary:contains("Thinking")',   // jQuery-like, but we'll use textContent check
        'button:has(div.ds-think-content)' // not standard CSS, we'll implement manually
    ];

    // Keep track of processed thinking elements to avoid repeated toggling
    const processedElements = new WeakSet();

    // Helper: check if an element contains text (case-insensitive)
    function containsText(el, text) {
        return el.textContent && el.textContent.toLowerCase().includes(text.toLowerCase());
    }

    // Find the toggle button that controls the given thinking content
    function findToggleButton(thinkContent) {
        // 1. Look for a button with aria-expanded inside the same message wrapper
        let parent = thinkContent.parentElement;
        while (parent && !parent.classList?.contains('ds-message')) {
            const button = parent.querySelector('button[aria-expanded]');
            if (button) return button;
            parent = parent.parentElement;
        }

        // 2. Look for a summary element in the same ancestor that contains "Thinking"
        parent = thinkContent.parentElement;
        while (parent && !parent.classList?.contains('ds-message')) {
            const summary = parent.querySelector('summary');
            if (summary && containsText(summary, 'thinking')) return summary;
            parent = parent.parentElement;
        }

        // 3. Look for any button with text "Thinking" or "Thought"
        const allButtons = thinkContent.closest('.ds-message')?.querySelectorAll('button') || [];
        for (const btn of allButtons) {
            if (containsText(btn, 'thinking') || containsText(btn, 'thought')) return btn;
        }

        // 4. Fallback: try to find the immediate previous sibling that might be a toggle
        const prev = thinkContent.previousElementSibling;
        if (prev && prev.tagName === 'BUTTON') return prev;

        return null;
    }

    // Collapse the thinking section for a given message or directly on a thinking content element
    function collapseThinking(container) {
        // If container is a message, look for thinking content inside it
        let thinkContents;
        if (container.matches && container.matches(THINK_CONTENT_SELECTOR)) {
            thinkContents = [container];
        } else {
            thinkContents = container.querySelectorAll(THINK_CONTENT_SELECTOR);
        }

        for (const thinkContent of thinkContents) {
            if (processedElements.has(thinkContent)) continue;
            processedElements.add(thinkContent);

            // Check if the thinking content is currently visible (not hidden by style or collapsed)
            const isVisible = thinkContent.offsetParent !== null && getComputedStyle(thinkContent).display !== 'none';

            if (!isVisible) continue; // already collapsed

            const toggle = findToggleButton(thinkContent);
            if (toggle) {
                // Simulate click on the toggle button if it's expanded
                if (toggle.getAttribute('aria-expanded') === 'true' || toggle.open === true) {
                    toggle.click();
                    console.log('Collapsed thinking via toggle click');
                } else if (toggle.tagName === 'SUMMARY' && toggle.parentElement?.open) {
                    toggle.click();
                    console.log('Collapsed thinking via summary click');
                } else {
                    // If toggle exists but not expanded, nothing to do
                }
            } else {
                // No toggle found – hide directly (this might break expandability, but works as a fallback)
                thinkContent.style.display = 'none';
                console.log('Hidden thinking content directly (no toggle found)');
            }
        }
    }

    // Process all existing messages
    function processAllMessages() {
        const messages = document.querySelectorAll('.ds-message');
        messages.forEach(msg => collapseThinking(msg));
    }

    // Set up MutationObserver to watch for new messages
    function observeNewMessages() {
        const messagesContainer = document.querySelector('.ds-virtual-list') || document.body;
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches && node.matches('.ds-message')) {
                                collapseThinking(node);
                            }
                            const nestedMessages = node.querySelectorAll('.ds-message');
                            nestedMessages.forEach(msg => collapseThinking(msg));
                        }
                    }
                }
            }
        });
        observer.observe(messagesContainer, { childList: true, subtree: true });
    }

    // Initialization
    function init() {
        processAllMessages();
        observeNewMessages();
        // Optional: re-check periodically for any missed messages
        setInterval(() => {
            const messages = document.querySelectorAll('.ds-message');
            messages.forEach(msg => collapseThinking(msg));
        }, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
