#!/usr/bin/env node
/* bitGen Studio — 2.304.0: EXPERT MODE + the LLM tokens section's type.
 * Run: node scripts/test-expertmode.js
 *
 * Tim (verbatim): "add a checkbox to the settings-general tab for expert
 * mode. in expert mode hide all the help except for tootips. in the left
 * docker llm section, make the font side the same as the basic settings to
 * keep the ui consistent".
 *   1. the setting: ui.expert ships false (core DEFAULT_CONFIG and
 *      default.settings), the checkbox sits in Settings -> General;
 *   2. the help: every help paragraph (p/div .hint or .modehint without an
 *      id - ids are live status lines) carries .help, and html.expert hides
 *      .help; titles (tooltips) are untouched;
 *   3. LIVE (jsdom): ticking the box adds html.expert, hides a help
 *      paragraph, posts {ui:{expert:true}}, caches it for the next boot;
 *   4. the LLM tokens section uses Basic Settings' .72rem label size. */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const IX = read("static", "index.html");
const MARKUP = IX.slice(0, IX.indexOf("<script src=\"/static/dockscroll.js\">"));

// ---- 1. the setting ----------------------------------------------------------------
{
  const core = read("lib", "core.js");
  check("core DEFAULT_CONFIG: ui.expert ships false",
    core.includes('ui: { confirm_delete: false, expert: false, builtin_dialogs: true, docks: require("./uiLayout").defaults() },'));
  const ds = JSON.parse(read("misc/default.settings"));
  check("default.settings: ui.expert is false", ds.ui && ds.ui.expert === false, ds.ui && ds.ui.expert);
  const gen = MARKUP.slice(MARKUP.indexOf('id="stab-general"'), MARKUP.indexOf('class="stab" id="stab-', MARKUP.indexOf('id="stab-general"') + 10));
  check("the Expert mode checkbox is in Settings -> General, with a tooltip",
    /<label class="chk"[^>]*title="Hide all the help paragraphs[^"]*"><input type="checkbox" id="s_expert">\s*Expert mode/.test(gen));
}

// ---- 2. the help ---------------------------------------------------------------------
{
  const untagged = [];
  const scan = (label, src) => {
    for (const m of src.matchAll(/<(p|div)\b[^>]*class="(hint|modehint|dim)([^"]*)"[^>]*>/g)) {
      if (/\bid=/.test(m[0]) || /\bhelp\b/.test(m[3])) continue;
      if (m[2] === "dim") continue;           // dim is also a colour class; the help ones are tagged
      untagged.push(label + ":" + (src.slice(0, m.index).split("\n").length) + " " + m[0].slice(0, 60));
    }
  };
  scan("index.html", MARKUP);
  check("every help paragraph in the page carries .help (ids = live status lines, left alone)",
    untagged.length === 0, untagged);
  const nHelp = (MARKUP.match(/class="(hint|modehint|dim) help"/g) || []).length;
  check("…that is the whole inventory (55 in the page: 51 plain + the mode hint + the character drop note + the ControlNet type hint (2.305.0) + the Face fix pack note (2.322.0) + the Swap row note (2.324.0), static help with ids; 2.341.0: + the Model catalog line; 2.405.0: - the GPU allocation tab's note, the tab is gone; 2.432.0: the UI size note moved to Themes + General's pointer to it; 2.518.0: + General's Civitai and Energy cost notes; 2.520.0: + the peak / off-peak note; 2.593.0: + General's Add-ons in the studio note)", nHelp === 61, nHelp);
  const MU = read("ext", "musicdock", "dock.html"), VD = read("ext", "videodock", "dock.html");
  check("the mode hint and the character drop note are help too, ids and all",
    MARKUP.includes('<div class="modehint help" id="modehint">') && MARKUP.includes('<div class="hint help" id="chDropNote"'));
  check("the dockers' help paragraphs are tagged too (music 3, video 3 - the ⇄ swap dialog's note, 2.324.0)",
    (MU.match(/class="hint help"/g) || []).length === 3 && (VD.match(/class="hint help"/g) || []).length === 3);
  check("the Scenes dropdown's title (2.391.1: it was the Scene board label) and the empty-board line stay (a label and a status, not help)",
    /<h2 class="sec drop" data-sec="vdscenes"[^>]*><span class="caret">▾<\/span>Scenes /.test(VD)
    && VD.includes('<div id="scList"><div class="modehint">No scenes yet.'));
  check("CSS: html.expert hides .help - and nothing touches title (tooltips stay)",
    IX.includes("html.expert .help { display: none !important; }") && !/html\.expert[^{]*\[title\]/.test(IX));
}

// ---- 3. LIVE ---------------------------------------------------------------------------
{
  let d = null;
  try {
    const { JSDOM } = require("jsdom");
    const css = (IX.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || "";
    const html = `<html><head><style>${css}</style></head><body>
      <label class="chk"><input type="checkbox" id="s_expert"> Expert mode</label>
      <p class="hint help" id="h1">help</p><p class="hint" id="h2">status</p>
      <button id="b1" title="a tooltip">b</button></body></html>`;
    const dom = new JSDOM(html, { url: "http://x/", runScripts: "outside-only", pretendToBeVisual: true });
    const w = dom.window;
    const posts = [];
    w.fetch = (u, o) => { posts.push([String(u), o && JSON.parse(o.body)]); return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); };
    // the page's own code: $, store, applyExpert + the boot line, and the onchange
    const pick = (a, b) => { const i = IX.indexOf(a); return IX.slice(i, IX.indexOf(b, i)); };
    const code = "const $ = id => document.getElementById(id);\nlet cfg = { ui: {} };\n"
      + pick("const store = {", "\n/* ================= realtime graphs")
      + "\n" + pick('$("s_expert") && ($("s_expert").onchange', "\n/* ONE delete path");
    w.eval(code);
    const disp = (id) => w.getComputedStyle(w.document.getElementById(id)).display;
    const before = [w.document.documentElement.classList.contains("expert"), disp("h1")];
    const box = w.document.getElementById("s_expert");
    box.checked = true; box.dispatchEvent(new w.Event("change"));
    const after = [w.document.documentElement.classList.contains("expert"), disp("h1"), disp("h2"),
      w.document.getElementById("b1").title, w.localStorage.getItem("h3.expert")];
    box.checked = false; box.dispatchEvent(new w.Event("change"));
    const off = [w.document.documentElement.classList.contains("expert"), disp("h1"), w.localStorage.getItem("h3.expert")];
    // next boot with the cached flag: the class is there before any config arrives
    w.localStorage.setItem("h3.expert", "1");
    const dom2 = new JSDOM(html, { url: "http://x/", runScripts: "outside-only" });
    dom2.window.fetch = w.fetch;
    dom2.window.localStorage.setItem("h3.expert", "1");
    dom2.window.eval(code);
    d = { before, after, off, posts, boot: dom2.window.document.documentElement.classList.contains("expert") };
  } catch (e) { d = { error: String(e.stack || e).slice(0, 600) }; }
  check("LIVE: help shows by default", d && d.before && d.before[0] === false && d.before[1] !== "none", d);
  check("LIVE: ticking Expert mode hides the help paragraph, leaves a status line and the tooltip, caches the flag",
    d && d.after && d.after[0] === true && d.after[1] === "none" && d.after[2] !== "none"
    && d.after[3] === "a tooltip" && d.after[4] === "1", d && d.after);
  check("LIVE: it saves at once - POST /api/config {ui:{expert:true}} then {expert:false}",
    d && JSON.stringify(d.posts) === '[["/api/config",{"ui":{"expert":true}}],["/api/config",{"ui":{"expert":false}}]]', d && d.posts);
  check("LIVE: unticking brings the help back", d && d.off && d.off[0] === false && d.off[1] !== "none" && d.off[2] === "0", d && d.off);
  check("LIVE: the next boot paints expert from the cache (no flash)", d && d.boot === true, d);
  check("the settings file is the authority once it loads (loadConfig applies ui.expert; fillSettings ticks the box)",
    IX.includes('cfg = await (await fetch("/api/config")).json();\n  applyExpert((cfg.ui || {}).expert);')
    && IX.includes('if ($("s_expert")) $("s_expert").checked = !!((cfg.ui || {}).expert);'));
}

// ---- 4. the LLM tokens section -------------------------------------------------------
{
  const lf = /label\.f \{[^}]*font-size: ([\d.]+rem)/.exec(IX);
  const fr = /#sec-llmtok \.frow \{[^}]*font-size: ([\d.]+rem)/.exec(IX);
  const lb = /#sec-llmtok label \{[^}]*font-size: ([\d.]+rem)/.exec(IX);
  const vv = /#sec-llmtok #tokMaxV, #sec-llmtok #tokUsed \{[^}]*font-size: ([\d.]+rem)/.exec(IX);
  check("LLM tokens: its rows, label and values use Basic Settings' label size (" + (lf && lf[1]) + ")",
    lf && fr && lb && vv && fr[1] === lf[1] && lb[1] === lf[1] && vv[1] === lf[1], [lf && lf[1], fr && fr[1], lb && lb[1], vv && vv[1]]);
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
