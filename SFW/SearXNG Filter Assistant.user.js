// ==UserScript==
// @name         SearXNG Filter Assistant
// @namespace    SearXNGFilterAssistant
// @version      1.2
// @description  Add predefined filters to SearXNG searches. Still beta.
// @author       masterofobzene
// @homepage     https://github.com/masterofobzene/UserScriptRepo
// @match        *://*/*
// @grant        GM_addStyle
// @license      GNU GPLv3
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/SearXNG%20Filter%20Assistant.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/SearXNG%20Filter%20Assistant.user.js
// ==/UserScript==

(function() {
    'use strict';

    const FILTERS = {
        'No Lists': '-"2..100 best" -"best free" -online -"2..100 top" -"best 2..100" -"top 2..100" -"2..100 free"',
        'No Online Apps': '-online -cloud',
        'No Ads': '!ad',
        'Only PDFs': 'filetype:pdf',
        'Github Software Search': 'site:github.com',
        'No Linux': '-ubuntu -linux -unix',
        'No Apple': '-apple -ios -mac',
        'No Mobile': '-android -ios -raspberry',
        'No Help Pages': '-inurl:help -inurl:community -inurl:docs -inurl:forum -inurl:ask -inurl:support -inurl:forums -inurl:knowledgebase'
    };

    function isSearxngPage() {
        return document.querySelector('meta[name="generator"][content*="SearXNG"]') ||
            /\/?(search|about|preferences)\/?$/.test(window.location.pathname);
    }

    function createFilterPanel() {
        const panel = document.createElement('div');
        panel.id = 'searxng-filter-panel';
        panel.innerHTML = `
            <style>
                #searxng-filter-panel {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: #f8f9fa;
                    padding: 15px;
                    border: 1px solid #dee2e6;
                    border-radius: 5px;
                    z-index: 9999;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    max-width: 300px;
                }
                .filter-checkbox {
                    margin: 5px 0;
                    display: block;
                    white-space: nowrap;
                }
                .filter-label {
                    font-family: sans-serif;
                    font-size: 14px;
                    color: #333;
                    margin-left: 5px;
                }
                #searxng-filter-panel h3 {
                    margin: 0 0 10px 0;
                    font-family: sans-serif;
                    font-size: 16px;
                    color: #111;
                }
            </style>
            <h3>🔍 Search Filters</h3>
            ${Object.entries(FILTERS).map(([name, value]) => `
                <label class="filter-checkbox">
                    <input type="checkbox" data-filter='${value}'>
                    <span class="filter-label">${name}</span>
                </label>
            `).join('')}
        `;
        document.body.appendChild(panel);
        return panel;
    }

    function updateSearchQuery(searchInput) {
        const activeFilters = Array.from(
            document.querySelectorAll('#searxng-filter-panel input:checked')
        ).map(checkbox => checkbox.dataset.filter);

        // Clean existing filters
        let cleanQuery = searchInput.value;
        Object.values(FILTERS).forEach(filter => {
            const exactFilter = filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\s*${exactFilter}(?=\\s|$)`, 'g');
            cleanQuery = cleanQuery.replace(regex, '');
        });

        // Add active filters
        const newQuery = [cleanQuery.trim(), ...activeFilters]
            .filter(term => term.length > 0)
            .join(' ');

        searchInput.value = newQuery.replace(/\s+/g, ' ').trim();
    }

    function init() {
        if (!isSearxngPage()) return;

        const searchInput = document.querySelector('input[name="q"]');
        if (!searchInput) return;

        const panel = createFilterPanel();
        const searchForm = searchInput.closest('form');

        // Load saved filters
        panel.querySelectorAll('input').forEach(checkbox => {
            checkbox.checked = localStorage.getItem(checkbox.dataset.filter) === 'true';
        });

        // Update on change
        panel.addEventListener('change', e => {
            if (e.target.matches('input[type="checkbox"]')) {
                localStorage.setItem(e.target.dataset.filter, e.target.checked);
                updateSearchQuery(searchInput);
            }
        });

        searchForm.addEventListener('submit', () => updateSearchQuery(searchInput));
        updateSearchQuery(searchInput);
    }

    window.addEventListener('load', init, false);
})();
