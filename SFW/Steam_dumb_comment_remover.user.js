// ==UserScript==
// @name         Steam Dumb Comment Remover
// @namespace    steam-comment-remover
// @version      1.0
// @author       masterofobzene
// @description  Removes comments that have the strings that the user inputs and optionally replaces them with a generic commment.
// @match        https://store.steampowered.com/app/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @icon         https://store.steampowered.com/favicon.ico
// @downloadURL  https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/Steam_dumb_comment_remover.user.js
// @updateURL    https://github.com/masterofobzene/UserScriptRepo/raw/main/SFW/Steam_dumb_comment_remover.user.js
// ==/UserScript==

(() => {
"use strict";

const PHRASE_KEY = "steam_filter_phrases";
const MESSAGE_KEY = "steam_filter_message";

const log = (...a)=>console.log("[SteamFilter]",...a);

function getPhrases(){
    const p = GM_getValue(PHRASE_KEY,[]);
    return Array.isArray(p) ? p : [];
}

function savePhrases(p){
    GM_setValue(PHRASE_KEY,p);
}

function getMessage(){
    return GM_getValue(MESSAGE_KEY,"Filtered comment");
}

function saveMessage(m){
    GM_setValue(MESSAGE_KEY,m);
}

function parseInput(input){

    const matches=[...input.matchAll(/"([^"]+)"/g)];
    return matches.map(m=>m[1].toLowerCase());

}

function matchesPhrase(text,phrases){

    const lower=text.toLowerCase();

    return phrases.some(p=>lower.includes(p));

}

function processComment(comment){

    const textNode = comment.querySelector("._1zbKizfCRpoX2D_zOLQes0");
    if(!textNode) return;

    if(comment.dataset.filteredDone) return;

    const phrases=getPhrases();
    if(!phrases.length) return;

    const text=textNode.textContent || "";

    if(matchesPhrase(text,phrases)){

        const replacement=getMessage();

        textNode.textContent=replacement;

        textNode.style.fontStyle="italic";
        textNode.style.opacity="0.8";

        log("Replaced comment:",text.slice(0,80));

    }

    comment.dataset.filteredDone="1";

}

function filterComments(){

    const comments=document.querySelectorAll("._7-m3PA_FStk99zsZUPYX-");

    comments.forEach(processComment);

}

function editPhrases(){

    const current=getPhrases();

    const input=prompt(
`Enter phrases in quotes separated by commas.

Example:
"i wanted to like this game", "too grindy"
`,
current.map(p=>`"${p}"`).join(", ")
);

    if(input===null) return;

    const phrases=parseInput(input);

    savePhrases(phrases);

    resetFiltering();

}

function editMessage(){

    const current=getMessage();

    const input=prompt(
"Replacement text for filtered comments:",
current
);

    if(input===null) return;

    saveMessage(input);

    resetFiltering();

}

function resetFiltering(){

    document.querySelectorAll("._7-m3PA_FStk99zsZUPYX-").forEach(c=>{
        delete c.dataset.filteredDone;

        const textNode=c.querySelector("._1zbKizfCRpoX2D_zOLQes0");
        if(textNode) textNode.style.opacity="";
    });

    filterComments();

}

function addUI(){

    if(document.getElementById("steamFilterPanel")) return;

    const panel=document.createElement("div");

    panel.id="steamFilterPanel";

    panel.style.position="fixed";
    panel.style.bottom="20px";
    panel.style.right="20px";
    panel.style.zIndex="999999";
    panel.style.background="#1b2838";
    panel.style.padding="8px";
    panel.style.border="1px solid #66c0f4";
    panel.style.borderRadius="6px";

    const btn1=document.createElement("button");
    btn1.textContent="Edit Phrases";
    btn1.style.marginRight="6px";
    btn1.onclick=editPhrases;

    const btn2=document.createElement("button");
    btn2.textContent="Edit Replacement";
    btn2.onclick=editMessage;

    panel.appendChild(btn1);
    panel.appendChild(btn2);

    document.body.appendChild(panel);

}

function observe(){

    const observer=new MutationObserver(()=>{
        filterComments();
    });

    observer.observe(document.body,{
        childList:true,
        subtree:true
    });

}

function init(){

    log("Steam filter started");

    addUI();

    filterComments();

    observe();

}

init();

})();
