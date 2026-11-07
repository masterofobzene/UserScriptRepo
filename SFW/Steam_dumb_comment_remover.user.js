// ==UserScript==
// @name         Steam Dumb Comment Remover
// @namespace    steam-comment-remover
// @version      1.3
// @author       masterofobzene
// @description  Removes comments that have the strings that the user inputs and optionally replaces them with a generic commment.
// @match        https://store.steampowered.com/app/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @icon         https://store.steampowered.com/favicon.ico
// @homepage     https://github.com/masterofobzene/UserScriptRepo
// @license      GNU GPLv3
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/Steam_dumb_comment_remover.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/Steam_dumb_comment_remover.user.js
// ==/UserScript==

(() => {
"use strict";

const PHRASE_KEY = "steam_filter_phrases";
const MESSAGE_KEY = "steam_filter_message";

const FUNNY_TEXT_REPLACEMENT = "developer's trolls are attacking this comment";
const FUNNY_REGEX = /^\s*(\d+)\s+(?:people|persons?)\s+found\s+this\s+review\s+funny\s*$/i;

function getPhrases(){ const p = GM_getValue(PHRASE_KEY, []); return Array.isArray(p) ? p : []; }
function savePhrases(p){ GM_setValue(PHRASE_KEY, p); }
function getMessage(){ return GM_getValue(MESSAGE_KEY, "Filtered comment"); }
function saveMessage(m){ GM_setValue(MESSAGE_KEY, m); }

function parseInput(input){ return [...input.matchAll(/"([^"]+)"/g)].map(m => m[1].toLowerCase()); }
function matchesPhrase(text, phrases){ const lower = text.toLowerCase(); return phrases.some(p => lower.includes(p)); }

function getDirectText(el){
    let s = "";
    for(const n of el.childNodes){ if(n.nodeType === 3) s += n.nodeValue; }
    return s;
}

function replaceFunny(node){
    if(!node || !node.textContent) return;
    const trimmed = node.textContent.trim();
    if(!trimmed) return;
    if(trimmed.endsWith(FUNNY_TEXT_REPLACEMENT)) return;
    if(trimmed.length > 120) return;
    const m = trimmed.match(FUNNY_REGEX);
    if(m) node.textContent = m[1] + " " + FUNNY_TEXT_REPLACEMENT;
}

function processFunnyCounters(){
    try {
        const xp = "//*[contains(text(), 'found this review funny')]";
        const res = document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for(let i = 0; i < res.snapshotLength; i++){
            try { replaceFunny(res.snapshotItem(i)); } catch(e){}
        }
    } catch(e){}
}

function applyToDiv(el, repl){
    if(el.dataset.sfApplied === "1") return;
    el.dataset.sfOrig = el.innerHTML;
    el.dataset.sfApplied = "1";
    el.textContent = repl;
    el.style.fontStyle = "italic";
    el.style.opacity = "0.8";
}

function filterComments(){
    const phrases = getPhrases();
    if(phrases.length){
        const repl = getMessage();
        const matchesArr = [];
        document.querySelectorAll("div").forEach(el => {
            if(el.dataset.sfApplied === "1") return;
            if(el.id === "steamFilterPanel" || el.closest("#steamFilterPanel")) return;
            if(el.closest("header, nav")) return;
            const t = getDirectText(el);
            if(!t || t.length > 20000) return;
            if(matchesPhrase(t, phrases)) matchesArr.push(el);
        });
        matchesArr.forEach(el => {
            if(matchesArr.some(other => other !== el && el.contains(other))) return;
            applyToDiv(el, repl);
        });
    }
    try { processFunnyCounters(); } catch(e){}
}

function editPhrases(){
    const current = getPhrases();
    const input = prompt(
`Enter phrases in quotes separated by commas.

Example:
"i wanted to like this game", "too grindy"
`,
        current.map(p => `"${p}"`).join(", ")
    );
    if(input === null) return;
    savePhrases(parseInput(input));
    resetFiltering();
}

function editMessage(){
    const current = getMessage();
    const input = prompt("Replacement text for filtered comments:", current);
    if(input === null) return;
    saveMessage(input);
    resetFiltering();
}

function resetFiltering(){
    document.querySelectorAll("div[data-sf-applied]").forEach(el => {
        if(el.dataset.sfOrig !== undefined) el.innerHTML = el.dataset.sfOrig;
        delete el.dataset.sfApplied;
        delete el.dataset.sfOrig;
        el.style.fontStyle = "";
        el.style.opacity = "";
    });
    filterComments();
}

function addUI(){
    if(document.getElementById("steamFilterPanel")) return;
    const panel = document.createElement("div");
    panel.id = "steamFilterPanel";
    panel.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:999999;background:#1b2838;padding:8px;border:1px solid #66c0f4;border-radius:6px;";
    const btn1 = document.createElement("button");
    btn1.textContent = "Edit Phrases";
    btn1.style.marginRight = "6px";
    btn1.onclick = editPhrases;
    const btn2 = document.createElement("button");
    btn2.textContent = "Edit Replacement";
    btn2.onclick = editMessage;
    panel.appendChild(btn1);
    panel.appendChild(btn2);
    document.body.appendChild(panel);
}

function observe(){
    let timer = null;
    const schedule = () => {
        if(timer) clearTimeout(timer);
        timer = setTimeout(() => { timer = null; filterComments(); }, 120);
    };
    new MutationObserver(schedule).observe(document, { childList: true, subtree: true, characterData: true });
    document.addEventListener("click", schedule, true);
    window.addEventListener("scroll", schedule, true);
    setInterval(filterComments, 800);
}

function init(){ addUI(); filterComments(); observe(); }

init();

})();
