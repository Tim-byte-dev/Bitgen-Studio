#!/usr/bin/env node
/* bitGen Studio — 2.393.0 in a REAL browser: Basic Settings (S) and LLM tokens (L) float; the image editor looks like
 * bitGen (its theme, its bars, full screen inside bitGen's title / menu / status bars).
 * Tim (verbatim): "in left docker / put basic settings dropdown in a floating docker - press s when not typing etc /
 * put llm dropdown in a floating docker - press l when not typing / when image editor use the bitgen titlebar and
 * statusbar so it still looks like part of bitgen".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the floating settings browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const post = (body) => fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
const HIDDEN = { floats: { basic: { shown: false, x: -1, y: -1, w: 0, h: 0 }, llmtok: { shown: false, x: -1, y: -1, w: 0, h: 0 } } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    await post(HIDDEN);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY && window.SecFloat && window.SecFloat.started && window.imageEditorInstance, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    const ev = (f, a) => p.evaluate(f, a);
    const vis = () => ev(() => ({ basic: !document.getElementById("sf-basic").classList.contains("sf-hidden"), llm: !document.getElementById("sf-llmtok").classList.contains("sf-hidden") }));

    // the left docker
    const ld = await ev(() => ({ row: [...document.querySelectorAll("#ldock #sfLaunch button")].map((x) => x.textContent.trim()),
      basicIn: !!document.querySelector("#ldock #sec-basic"), llmIn: !!document.querySelector("#ldock #sec-llmtok"),
      inWin: document.getElementById("sf-basic").contains(document.getElementById("sec-basic")) && document.getElementById("sf-llmtok").contains(document.getElementById("tokMax")),
      heads: [...document.querySelectorAll('#ldock h2.sec.drop[data-sec="basic"], #ldock h2.sec.drop[data-sec="llmtok"]')].every((h) => getComputedStyle(h).display === "none") }));
    check("the left docker: Basic Settings and LLM tokens are gone from it (their controls in the floating windows), two buttons in their place",
      ld.row.join("|") === "LLM tokens L|Basic Settings S" && !ld.basicIn && !ld.llmIn && ld.inWin && ld.heads, ld);
    check("...both hidden at first", JSON.stringify(await vis()) === '{"basic":false,"llm":false}');

    // S / L
    await p.mouse.move(900, 860);
    await p.keyboard.press("s"); await p.waitForTimeout(300);
    const g1 = await ev(() => { const r = document.getElementById("sf-basic").getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), z: getComputedStyle(document.getElementById("sf-basic")).position, res: document.getElementById("resolution") ? document.getElementById("resolution").getBoundingClientRect().width > 0 : true }; });
    check("S: Basic Settings floats (fixed, beside the left docker, its controls live)", (await vis()).basic && g1.z === "fixed" && g1.x > 280 && g1.y >= 80 && g1.res, g1);
    await p.keyboard.press("l"); await p.waitForTimeout(300);
    check("L: LLM tokens floats too", (await vis()).llm);
    await p.keyboard.press("l"); await p.waitForTimeout(300);
    check("L again hides it (S's window stays)", JSON.stringify(await vis()) === '{"basic":true,"llm":false}');
    // not while typing
    await ev(() => { const t = document.createElement("input"); t.type = "text"; t.id = "sfTypeBox"; t.style.cssText = "position:fixed;left:900px;top:860px;z-index:99"; document.body.appendChild(t); t.focus(); });
    await p.keyboard.type("sl"); await p.waitForTimeout(200);
    const typed = await ev(() => document.getElementById("sfTypeBox").value);
    check("typing s and l in a text box types them - no window toggles", typed === "sl" && JSON.stringify(await vis()) === '{"basic":true,"llm":false}', typed);
    await ev(() => document.getElementById("sfTypeBox").remove());
    // not over the image editor
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(400);
    const st = await p.locator("#ieStage").boundingBox();
    await p.mouse.move(st.x + 30, st.y + 30); await ev(() => document.getElementById("ieStage").focus());
    await p.keyboard.press("l"); await p.waitForTimeout(250);
    const tool = await ev(() => window.imageEditorInstance.state.tool);
    check("over the image editor L is still its Lasso - the LLM window does not open", !(await vis()).llm && /lasso/.test(tool), tool);
    await ev(() => document.activeElement && document.activeElement.blur());
    await p.mouse.move(900, 900);
    // ✕, the launcher button, the drag (magnetic) and the record
    await p.click("#sf-basic .sfx"); await p.waitForTimeout(250);
    check("✕ hides it", !(await vis()).basic);
    await p.click('#sfLaunch button[data-sf="basic"]'); await p.waitForTimeout(250);
    check("the left docker's button shows it again (and is lit)", (await vis()).basic && await ev(() => document.querySelector('#sfLaunch button[data-sf="basic"]').classList.contains("on")));
    const ldr = await ev(() => Math.round(document.getElementById("ldock").getBoundingClientRect().right));
    const hb = await p.locator("#sf-basic .sft").boundingBox();
    await p.mouse.move(hb.x + 5, hb.y + 5); await p.mouse.down();
    await p.mouse.move(hb.x + 140, hb.y + 120, { steps: 6 });
    const cur = await ev(() => document.getElementById("sf-basic").getBoundingClientRect().left);
    await p.mouse.move(hb.x + 5 + (ldr - 7 - cur) + 140, hb.y + 120, { steps: 6 });
    await p.mouse.up(); await p.waitForTimeout(600);
    const g2 = await ev(() => Math.round(document.getElementById("sf-basic").getBoundingClientRect().left));
    const rec = await (await fetch(URL_ + "api/docker-status")).json();
    check("dragged by its titlebar, 7 px over the left docker's edge it sticks to its edge; docker_status.json keeps where and shown",
      Math.abs(g2 - ldr) <= 1 && rec.floats.basic.shown === true && Math.abs(rec.floats.basic.x - g2) <= 1 && rec.floats.llmtok.shown === false, { g2, ldr, f: rec.floats });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY && window.SecFloat && window.SecFloat.started && window.imageEditorInstance, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    const g3 = await ev(() => Math.round(document.getElementById("sf-basic").getBoundingClientRect().left));
    check("reloaded: it comes back where it was, shown", (await vis()).basic && Math.abs(g3 - g2) <= 1, { g2, g3 });

    // the image editor
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(400);
    const th = await ev(() => { const kx = document.querySelector(".kx"), m = kx.querySelector(".pcmenu"), s = kx.querySelector(".kxstatus"), mb = document.getElementById("menubar"), sb = document.getElementById("statusbar");
      return { theme: kx.dataset.theme, mbg: getComputedStyle(m).backgroundColor, appbg: getComputedStyle(mb).backgroundColor, mh: Math.round(m.getBoundingClientRect().height), apph: Math.round(mb.getBoundingClientRect().height),
               sh: Math.round(s.getBoundingClientRect().height), sbh: Math.round(sb.getBoundingClientRect().height), sbg: getComputedStyle(s).backgroundColor, acc: getComputedStyle(kx).getPropertyValue("--pc-accent").trim() }; });
    check("the editor wears bitGen: its theme, its menu bar the app's menu bar (colour, height), its status line the app's status bar, the tiger accent",
      th.theme === "bitgen" && th.mbg === th.appbg && Math.abs(th.mh - th.apph) <= 1 && Math.abs(th.sh - th.sbh) <= 1 && th.sbg === th.appbg && th.acc === "#f59e2c", th);
    await ev(() => document.getElementById("kxFull").click()); await p.waitForTimeout(900);
    const fu = await ev(() => { const r = document.getElementById("imageeditdock").getBoundingClientRect(), mb = document.getElementById("menubar").getBoundingClientRect(), sb = document.getElementById("statusbar").getBoundingClientRect();
      return { on: document.body.classList.contains("ie-full"), top: Math.round(r.top), mbb: Math.round(mb.bottom), bottom: Math.round(r.bottom), sbt: Math.round(sb.top), w: Math.round(r.width), vw: innerWidth,
               mbVis: getComputedStyle(document.getElementById("menubar")).display !== "none", own: getComputedStyle(document.querySelector(".kx .kxstatus")).display, sbIe: getComputedStyle(document.getElementById("sbIe")).display,
               sbTxt: document.getElementById("sbIe").textContent, stTxt: document.getElementById("ieStatus").textContent, brand: getComputedStyle(document.querySelector(".kx .pcbrand")).display }; });
    check("⛶ full screen: the editor fills the room between bitGen's menu bar and status bar (both still there), the whole width",
      fu.on && fu.mbVis && Math.abs(fu.top - fu.mbb) <= 1 && Math.abs(fu.bottom - fu.sbt) <= 1 && fu.w === fu.vw, fu);
    check("...its status line is in bitGen's status bar (its own hidden), the bitGen mark on its menu bar", fu.own === "none" && fu.sbIe === "block" && fu.sbTxt === fu.stTxt && fu.brand === "flex", fu);
    await ev(() => document.getElementById("ieStage").focus()); await p.keyboard.press("Escape"); await p.waitForTimeout(400);
    const out = await ev(() => ({ on: document.body.classList.contains("ie-full"), pos: getComputedStyle(document.getElementById("imageeditdock")).position, sbIe: getComputedStyle(document.getElementById("sbIe")).display }));
    check("Esc leaves: back in its docker, bitGen's status bar as it was", !out.on && out.pos !== "fixed" && out.sbIe === "none", out);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    try { await post(HIDDEN); } catch { /* fine */ }
    try { await p.evaluate(() => { document.body.classList.remove("ie-full"); if (document.fullscreenElement) document.exitFullscreen(); }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
