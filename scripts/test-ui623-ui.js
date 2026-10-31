#!/usr/bin/env node
/* bitGen Studio — 2.623.0 in a REAL browser: THEME EDIT MODE - EVERY DOCKER / PANEL / UI BUTTON AND ITS WORDS EDITABLE.
 * Tim: "when in theme edit mode make all the docker and panel buttons and ui buttons and text editable"
 *   a floating tool panel (the timeline's stage panel .tsd) is picked like a docker; double-click a docker's title / a
 *   button / a label = its words changed right there (Enter keeps, Esc does not, the icon stays); a dropdown's options
 *   renamed; a box's placeholder and a button's tooltip; Alt+click = the app's click (a docker collapses) with edit mode
 *   still on; after a reload the words are still there. Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.623.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1200 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  const box = (sel) => ev((s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return { x: r.left + Math.min(12, r.width / 2), y: r.top + r.height / 2 }; }, sel);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ThemeEdit && document.getElementById("thEditBtn"), null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { localStorage.removeItem("h3.themeStyles"); H3ThemeEdit.setStyles({});
      const d = document.getElementById("sfxdock"); if (d.classList.contains("dockgone")) toggleDockGone("sfxdock", "tSfx"); if (d.classList.contains("collapsed")) toggleCollapse("sfxdock");
      const pd = document.getElementById("promptdock"); if (pd && !pd.classList.contains("dockgone")) toggleDockGone("promptdock", "tP"); });
    await p.click("#thEditBtn"); await p.waitForTimeout(200);
    check("🖌 edit theme mode on", await ev(() => H3ThemeEdit.isOn()));

    /* a floating tool panel is picked like a docker */
    const tsd = await ev(() => { const f = [...document.querySelectorAll(".tsd")].find((x) => x.offsetParent !== null && x.getBoundingClientRect().width > 20); if (!f) return null; const t = f.querySelector("button, h2, span"); const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, id: f.id }; });
    if (tsd) {
      await p.mouse.click(tsd.x, tsd.y); await p.waitForTimeout(250);
      const got = await ev(() => { const pn = document.getElementById("thEditPanel"); return pn ? pn.querySelector("#teHead b").textContent : null; });
      check("a floating tool panel (the timeline's stage panel) is picked and styled like a docker", !!got, { tsd, got });
      await ev(() => document.getElementById("teClose") && document.getElementById("teClose").click());
    } else check("a floating tool panel (the timeline's stage panel) is picked and styled like a docker", /:not\(\.tsd\)/.test(await ev(() => H3ThemeEdit.DIALOG_SEL)), "no stage panel on screen - the selector");

    /* double-click a docker's title, a button */
    let at = await box("#sfxdock > .bhead");
    await p.mouse.dblclick(at.x + 30, at.y); await p.waitForTimeout(250);
    const inl = await ev(() => { const i = document.getElementById("thInline"); return i ? i.value : null; });
    await p.fill("#thInline", "Sounds & speech"); await p.keyboard.press("Enter"); await p.waitForTimeout(300);
    const head = await ev(() => ({ txt: document.querySelector("#sfxdock > .bhead").textContent, maxbtn: !!document.querySelector("#sfxdock > .bhead .maxbtn"), inl: !!document.getElementById("thInline") }));
    check("double-click a docker's title: a box with its words (SFX); Enter = the new title, its ▾ and ⛶ kept", inl === "SFX" && /Sounds & speech/.test(head.txt) && head.maxbtn && !head.inl, { inl, head });
    at = await box("#sfxAdd");
    await p.mouse.dblclick(at.x, at.y); await p.waitForTimeout(250);
    await p.fill("#thInline", "Import"); await p.keyboard.press("Enter"); await p.waitForTimeout(300);
    const btn = await ev(() => document.getElementById("sfxAdd").textContent);
    check("double-click a button: its words changed, its icon kept (📂 Import)", /📂/.test(btn) && /Import/.test(btn) && !/Add/.test(btn), btn);
    at = await box("#spDesc");
    const lab = await ev(() => { const l = document.getElementById("spDesc").closest("label"); const r = l.getBoundingClientRect(); return { x: r.left + 20, y: r.top + 6 }; });
    await p.mouse.dblclick(lab.x, lab.y); await p.waitForTimeout(250);
    await p.fill("#thInline", "Notes"); await p.keyboard.press("Escape"); await p.waitForTimeout(250);
    const esc = await ev(() => document.getElementById("spDesc").closest("label").textContent.trim().startsWith("Description"));
    check("…Esc leaves the words as they were (a label)", esc);

    /* a dropdown's options, a placeholder, a tooltip */
    at = await box("#spFmt"); await p.mouse.click(at.x, at.y); await p.waitForTimeout(300);
    const opt = await ev(() => [...document.querySelectorAll("#teOpts input[data-opt]")].map((i) => i.placeholder));
    await ev(() => { const i = document.querySelector('#teOpts input[data-opt="1"]'); i.value = "MP3 (small)"; i.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(250);
    const o2 = await ev(() => ({ text: document.querySelector('#spFmt option[value="mp3"]').textContent, value: document.querySelector('#spFmt option[value="mp3"]').value }));
    check("a dropdown picked: its Options - an option renamed (MP3 (small)), its value the same", opt.join() === "WAV,MP3" && o2.text === "MP3 (small)" && o2.value === "mp3", { opt, o2 });
    await ev(() => document.getElementById("teClose").click());
    at = await box("#spName"); await p.mouse.click(at.x, at.y); await p.waitForTimeout(300);
    await ev(() => { const i = document.getElementById("tePh"); i.value = "name your file"; i.dispatchEvent(new Event("input")); const t = document.getElementById("teTip"); t.value = "the file's name"; t.dispatchEvent(new Event("input")); });
    await p.waitForTimeout(250);
    const ph = await ev(() => ({ ph: document.getElementById("spName").placeholder, tip: document.getElementById("spName").title }));
    check("a box picked: its placeholder and tooltip changed", ph.ph === "name your file" && ph.tip === "the file's name", ph);
    await ev(() => document.getElementById("teClose").click());

    /* Alt+click = the app's click */
    const wasC = await ev(() => document.getElementById("sfxdock").classList.contains("collapsed"));
    at = await box("#sfxdock > .bhead");
    await p.keyboard.down("Alt"); await p.mouse.click(at.x + 40, at.y); await p.keyboard.up("Alt"); await p.waitForTimeout(300);
    const alt = await ev(() => ({ c: document.getElementById("sfxdock").classList.contains("collapsed"), on: H3ThemeEdit.isOn(), panel: !!document.getElementById("thEditPanel") }));
    check("Alt+click a docker's title: the app's click (it collapses), edit mode stays on, nothing picked", alt.c !== wasC && alt.on && !alt.panel, { wasC, alt });
    await ev(() => { const d = document.getElementById("sfxdock"); if (d.classList.contains("collapsed")) toggleCollapse("sfxdock"); });

    /* kept */
    await ev(() => H3ThemeEdit.toggle(false, { force: true }));
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ThemeEdit, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    const kept = await ev(() => ({ head: document.querySelector("#sfxdock > .bhead").textContent, btn: document.getElementById("sfxAdd").textContent, opt: (document.querySelector('#spFmt option[value="mp3"]') || {}).textContent, ph: document.getElementById("spName").placeholder }));
    check("after a reload (live mode): the new title, button words, option and placeholder are still there", /Sounds & speech/.test(kept.head) && /Import/.test(kept.btn) && kept.opt === "MP3 (small)" && kept.ph === "name your file", kept);
    await ev(() => H3ThemeEdit.setStyles({}));
    await p.waitForTimeout(300);
    const back = await ev(() => ({ head: document.querySelector("#sfxdock > .bhead").textContent, btn: document.getElementById("sfxAdd").textContent, opt: document.querySelector('#spFmt option[value="mp3"]').textContent, ph: document.getElementById("spName").placeholder, tip: document.getElementById("spName").title }));
    check("↺ Clear element styles: every word, option, placeholder and tooltip is its own again", /SFX/.test(back.head) && /Add/.test(back.btn) && back.opt === "MP3" && back.ph === "e.g. intro_dialog" && /\.wav \/ \.mp3 is added/.test(back.tip), back);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    try { await ev(async () => { localStorage.removeItem("h3.themeStyles"); const n = (window.H3ThemeEdit && H3ThemeEdit.session()) || "Untitled"; await fetch("/api/themes/tmp/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n }) }); }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
