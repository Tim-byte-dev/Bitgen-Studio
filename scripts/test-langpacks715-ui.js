#!/usr/bin/env node
/* bitGen Studio — 2.715.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): SETTINGS ▸
 * LANGUAGES. The tab is there with English + the built-in packs and how much each has translated; ⤓ Master pack downloads
 * a zip; a pack made from it (Esperanto, two words) installs from ⤒ Install a pack, shows in the language dropdown next to
 * ⊞ and translates the app when picked; installing it again asks before replacing; a pack with a built-in's id says it is
 * used instead; a broken file says why; ✕ Remove takes it away and the app goes back to English. No server / no
 * Playwright = SKIP.
 * Tim (verbatim): "lets do number 2, this way we don't have to create all the packs at once - if we could have a master
 * pack so users can translate the strings and upload to tigerart for the community it would be ideal" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.715.0 browser test did not run"); process.exit(0); }
const U = require("../lib/unzip"), Z = require("../lib/zipWrite");
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
/** a pack made from the master: its pack.json and ui.json changed */
function packFrom(master, meta, words) {
  const ents = U.entries(master).map((e) => ({ name: e.name, data: U.read(master, e) }));
  const pj = ents.find((e) => e.name === "pack.json"), ui = ents.find((e) => e.name === "ui.json");
  pj.data = JSON.stringify(Object.assign(JSON.parse(pj.data), meta));
  const u = JSON.parse(ui.data); Object.assign(u.strings, words); ui.data = JSON.stringify(u);
  return Z.zip(ents.map((e) => ({ name: e.name, data: e.data, deflate: true })));
}
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.715.0 browser test did not run"); process.exit(0); }
  // a leftover from a run that stopped half way
  for (const id of ["eo", "ja"]) await fetch(URL0 + "api/langpacks/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
  const b = await chromium.launch();
  try {
    const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 }, locale: "en-US", acceptDownloads: true })).newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL0); await p.waitForFunction(() => window.H3LangPacks && document.querySelector('#settings .stabs [data-stab="langs"]') && document.getElementById("uiLangSel"), null, { timeout: 30000 });
    await p.evaluate(() => { const d = document.getElementById("settings"); if (typeof window.openSettings === "function") window.openSettings(); else d.showModal(); document.querySelector('#settings .stabs [data-stab="langs"]').click(); });
    await p.waitForFunction(() => document.querySelectorAll("#s_lplist .lprow").length >= 4 && document.querySelectorAll("#s_lplist .lpcov b").length >= 10, null, { timeout: 30000 });
    const tab = await p.evaluate(() => ({
      after: document.querySelector('#settings .stabs [data-stab="langs"]').previousElementSibling.getAttribute("data-stab"),
      rows: [...document.querySelectorAll("#s_lplist .lprow")].map((r) => [r.getAttribute("data-lp"), r.querySelector(".lpname").textContent, (r.querySelector(".lptag") || {}).textContent, r.querySelector(".lpcov") ? r.querySelector(".lpcov").textContent : ""]),
      visible: document.getElementById("stab-langs").classList.contains("active") && document.getElementById("stab-langs").offsetHeight > 100,
    }));
    check("Settings ▸ Languages: the tab after Themes, shown when clicked", tab.after === "themes" && tab.visible, tab);
    check("…English and the built-in packs (简体中文, 繁體中文, 日本語), each marked built in", JSON.stringify(tab.rows.map((r) => r[0])) === JSON.stringify(["en", "zh-CN", "zh-TW", "ja"]) && tab.rows.slice(1).every((r) => r[2] === "built in"), tab.rows);
    const ja = tab.rows.find((r) => r[0] === "ja")[3];
    check("…how much each has translated: App 99 %, Guide 97 %, Help 3 of 3, Shortcuts 19 of 19, Features 100 %", /App 9\d %/.test(ja) && /Guide 9\d %/.test(ja) && /Help 3 of 3/.test(ja) && /Shortcuts 19 of 19/.test(ja) && /Features 100 %/.test(ja), ja);
    // ⤓ Master pack
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#s_lpmaster")]);
    const mp = await dl.path(), fs = require("fs"), master = fs.readFileSync(mp);
    const names = U.entries(master).map((e) => e.name);
    check("⤓ Master pack downloads bitGen-language-pack-master.zip: pack.json, TRANSLATING.txt, ui.json, USAGE.md, shortcuts.json, FEATURES.md, help/*.html",
      dl.suggestedFilename() === "bitGen-language-pack-master.zip" && ["pack.json", "TRANSLATING.txt", "ui.json", "USAGE.md", "shortcuts.json", "FEATURES.md", "help/timeline.html"].every((n) => names.includes(n)), names);
    // ⤒ Install a pack
    const eo = packFrom(master, { id: "eo", name: "Esperanto", native: "Esperanto", browser: ["eo"], authors: ["Test"], version: "1" }, { Themes: "Temoj", General: "Ĝenerala", "Bad {0}": "x" });
    await p.setInputFiles("#s_lpfile", { name: "eo.zip", mimeType: "application/zip", buffer: eo });
    await p.waitForFunction(() => document.querySelector('#s_lplist [data-lp="eo"]'), null, { timeout: 20000 });
    const ins = await p.evaluate(() => ({ msg: document.getElementById("s_lpmsg").textContent, warn: document.getElementById("s_lpwarn").textContent,
      row: document.querySelector('#s_lplist [data-lp="eo"]').textContent, opts: [...document.querySelectorAll("#uiLangSel option")].map((o) => o.value) }));
    check("⤒ Install a pack: the Esperanto pack installed - its row (installed, v1, by Test), the message, the notes", /Installed Esperanto \(eo\)/.test(ins.msg) && /installed/.test(ins.row) && /v1/.test(ins.row) && /Test/.test(ins.row), ins);
    check("…the language dropdown next to ⊞ has it at once", ins.opts.includes("eo"), ins.opts);
    await p.waitForFunction(() => /App <1 %/.test((document.querySelector('#s_lplist [data-lp="eo"] .lpcov') || {}).textContent || ""), null, { timeout: 10000 }).catch(() => {});
    check("…its coverage: two words of the app (<1 %), the guide not yet", await p.evaluate(() => { const t = document.querySelector('#s_lplist [data-lp="eo"] .lpcov').textContent; return /App <1 %/.test(t) && /Guide 0 %/.test(t) ? true : t; }) === true);
    // picked: the app's words in Esperanto
    await p.click('#s_lplist [data-lp="eo"] [data-lpuse]');
    await p.waitForFunction(() => document.querySelector('#settings .stabs [data-stab="themes"]').textContent === "Temoj", null, { timeout: 10000 }).catch(() => {});
    const used = await p.evaluate(() => ({ th: document.querySelector('#settings .stabs [data-stab="themes"]').textContent, ge: document.querySelector('#settings .stabs [data-stab="general"]').textContent,
      paths: document.querySelector('#settings .stabs [data-stab="paths"]').textContent, sel: document.getElementById("uiLangSel").value, lang: document.documentElement.getAttribute("data-uilang") }));
    check("Use: the app's words from the pack (Themes -> Temoj, General -> Ĝenerala), the rest English (Paths), the dropdown on eo", used.th === "Temoj" && used.ge === "Ĝenerala" && used.paths === "Paths" && used.sel === "eo" && used.lang === "eo", used);
    // again: asks first
    await p.setInputFiles("#s_lpfile", { name: "eo.zip", mimeType: "application/zip", buffer: eo });
    await p.waitForSelector("#s_lpyes", { timeout: 10000 }).catch(() => {});
    const ask = await p.evaluate(() => (document.getElementById("s_lpask") || {}).textContent || "");
    check("the same language again: asks before replacing (Replace / Cancel)", /installed already \(v1\)/.test(ask) && /Replace/.test(ask) && /Cancel/.test(ask), ask);
    await p.click("#s_lpyes");
    await p.waitForFunction(() => /Installed Esperanto/.test(document.getElementById("s_lpmsg").textContent) && !document.getElementById("s_lpyes"), null, { timeout: 10000 }).catch(() => {});
    check("…Replace installs it", await p.evaluate(() => /Installed Esperanto/.test(document.getElementById("s_lpmsg").textContent)));
    // a built-in's id
    const jp = packFrom(master, { id: "ja", name: "Japanese", native: "日本語", authors: ["Community"], version: "3" }, { Themes: "テーマ!" });
    await p.setInputFiles("#s_lpfile", { name: "ja.zip", mimeType: "application/zip", buffer: jp });
    await p.waitForSelector("#s_lpyes", { timeout: 10000 }).catch(() => {});
    const askJa = await p.evaluate(() => (document.getElementById("s_lpask") || {}).textContent || "");
    check("a pack for a built-in language: says it is built in and asks to use the pack instead", /is built in/.test(askJa) && /instead/.test(askJa), askJa);
    await p.click("#s_lpno");
    check("…Cancel: not installed", await p.evaluate(() => /Not installed/.test(document.getElementById("s_lpmsg").textContent) && document.querySelectorAll('#s_lplist [data-lp="ja"] .lptag')[0].textContent === "built in"));
    // a broken file
    await p.setInputFiles("#s_lpfile", { name: "x.zip", mimeType: "application/zip", buffer: Buffer.from("not a zip at all") });
    await p.waitForFunction(() => /not a \.zip/.test(document.getElementById("s_lpmsg").textContent), null, { timeout: 10000 }).catch(() => {});
    check("a file that is not a zip: says so", await p.evaluate(() => /not a \.zip/.test(document.getElementById("s_lpmsg").textContent) ? true : document.getElementById("s_lpmsg").textContent) === true);
    const xx = packFrom(master, {}, {});
    await p.setInputFiles("#s_lpfile", { name: "master.zip", mimeType: "application/zip", buffer: xx });
    await p.waitForFunction(() => /"xx"/.test(document.getElementById("s_lpmsg").textContent), null, { timeout: 10000 }).catch(() => {});
    check("the master pack as it is (id xx): says to put the language's code in pack.json", await p.evaluate(() => /put your language's code/.test(document.getElementById("s_lpmsg").textContent) ? true : document.getElementById("s_lpmsg").textContent) === true);
    // ✕ Remove
    await p.click('#s_lplist [data-lp="eo"] [data-lpremove]');
    await p.waitForFunction(() => !document.querySelector('#s_lplist [data-lp="eo"]'), null, { timeout: 10000 }).catch(() => {});
    await p.waitForTimeout(400);
    const gone = await p.evaluate(() => ({ row: !!document.querySelector('#s_lplist [data-lp="eo"]'), opts: [...document.querySelectorAll("#uiLangSel option")].map((o) => o.value), sel: document.getElementById("uiLangSel").value,
      th: document.querySelector('#settings .stabs [data-stab="themes"]').textContent, msg: document.getElementById("s_lpmsg").textContent }));
    check("✕ Remove: the row and the dropdown entry go, the app is back in English (Themes)", !gone.row && !gone.opts.includes("eo") && gone.sel === "en" && gone.th === "Themes" && /Removed/.test(gone.msg), gone);
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); process.exit(1); });
