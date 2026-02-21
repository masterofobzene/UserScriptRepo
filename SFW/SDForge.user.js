// ==UserScript==
// @name SDForge quick access buttons
// @namespace SDForge_quick_access_buttons
// @match http://127.0.0.1:7860/*
// @grant none
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/SDForge.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/SDForge.user.js
// @version 2.3
// @description Puts some of the most used buttons/toggles above the image preview for easier access.
// @run-at document-end
// ==/UserScript==

(function() {
    'use strict';

    const app = document.querySelector('gradio-app');
    if (!app) return;

    app.addEventListener('domchange', init);
    const interval = setInterval(init, 800);

    function init() {
        const gallery = document.getElementById('txt2img_gallery');
        if (!gallery) return;

        const seedInput = document.querySelector('#txt2img_seed input');
        const randomBtn = document.getElementById('txt2img_random_seed');
        const reuseBtn = document.getElementById('txt2img_reuse_seed');
        const saveBtn = document.getElementById('save_txt2img');

        let hiresInput = document.querySelector('#txt2img_enable_hr input[type="checkbox"]');
        if (!hiresInput) {
            hiresInput = document.querySelector('input[type="checkbox"][id*="enable_hr"]') ||
                         document.querySelector('label:has(input[type="checkbox"]) input[type="checkbox"]:not([id*="prompt"])');
        }

        const generateBtn  = document.getElementById('txt2img_generate');
        const interruptBtn = document.getElementById('txt2img_interrupt');
        const interrupting = document.getElementById('txt2img_interrupting');

        if (!seedInput || !randomBtn || !reuseBtn || !saveBtn || !hiresInput || !generateBtn || !interruptBtn || !interrupting) {
            console.log('[Custom UI Buttons] Missing elements:', {
                seed: !!seedInput, random: !!randomBtn, reuse: !!reuseBtn,
                save: !!saveBtn, hires: !!hiresInput
            });
            return;
        }

        if (document.getElementById('custom_controls_row')) return;

        // === SEED BOX ON ITS OWN ROW ABOVE THE BUTTONS ===
        const seedBox = document.createElement('div');
        seedBox.style.cssText = 'padding:6px 12px; background:#e0e0e0; border-radius:4px; font-family:monospace; font-weight:bold; min-width:140px; text-align:center; margin:8px 0;';
        seedBox.textContent = 'Seed: waiting...';

        let lastSeed = '-1';
        const updateSeed = () => {
            const val = seedInput.value.trim();
            lastSeed = val || '-1';
            seedBox.textContent = `Seed: ${lastSeed}`;
        };

        seedInput.addEventListener('input', updateSeed);
        randomBtn.addEventListener('click', () => setTimeout(() => {
            seedBox.textContent = 'Seed: -1';
            lastSeed = '-1';
        }, 50));

        // === BUTTON ROW (unchanged order) ===
        const row = document.createElement('div');
        row.id = 'custom_controls_row';
        row.style.cssText = 'display:flex; align-items:center; gap:12px; margin:8px 0; padding:6px; background:#f0f0f0; border-radius:6px;';

        // Smart Generate/Interrupt button
        const smartBtn = document.createElement('button');
        smartBtn.className = generateBtn.className;
        smartBtn.style.minWidth = '140px';
        smartBtn.style.fontWeight = 'bold';

        function updateSmartBtn() {
            let text = 'Generate';
            if (interrupting.style.display !== 'none' && interrupting.style.display !== '') {
                text = 'Interrupting...';
            } else if (interruptBtn.style.display !== 'none' && interruptBtn.style.display !== '') {
                text = 'Interrupt';
            }
            smartBtn.textContent = text;
            smartBtn.style.background = '';
        }

        smartBtn.onclick = () => {
            if (smartBtn.textContent === 'Generate') {
                generateBtn.click();
            } else {
                interruptBtn.click();
            }
        };

        const observer = new MutationObserver(updateSmartBtn);
        observer.observe(interruptBtn, { attributes: true, attributeFilter: ['style'] });
        observer.observe(interrupting, { attributes: true, attributeFilter: ['style'] });
        observer.observe(generateBtn, { attributes: true });

        row.appendChild(smartBtn);

        const addBtn = (orig, text = orig.innerHTML) => {
            const b = document.createElement('button');
            b.innerHTML = text;
            b.className = orig.className;
            b.style.minWidth = '80px';
            b.onclick = () => orig.click();
            row.appendChild(b);
        };

        addBtn(randomBtn);
        addBtn(reuseBtn);
        addBtn(saveBtn);

        const toggleBtn = document.createElement('button');
        toggleBtn.className = randomBtn.className;
        toggleBtn.style.cssText = `
            min-width: 90px !important;
            padding: 4px 8px !important;
            font-size: 13px !important;
            white-space: wrap !important;
            line-height: 1.3 !important;
        `;
        const updateToggle = () => {
            toggleBtn.textContent = hiresInput.checked ? 'Hires ON' : 'Hires OFF';
        };
        updateToggle();
        toggleBtn.onclick = () => {
            hiresInput.click();
            setTimeout(updateToggle, 50);
        };
        hiresInput.addEventListener('change', updateToggle);
        row.appendChild(toggleBtn);

        // Insert seed row first, then button row
        const parent = gallery.parentNode;
        parent.insertBefore(seedBox, gallery);
        parent.insertBefore(row, gallery);

        const galleryObserver = new MutationObserver(() => setTimeout(updateSeed, 400));
        galleryObserver.observe(gallery, { childList: true, subtree: true });

        reuseBtn.addEventListener('click', () => setTimeout(updateSeed, 400));

        updateSeed();
        updateSmartBtn();
        clearInterval(interval);
        console.log('[Custom UI Buttons] Row added');
    }
})();
