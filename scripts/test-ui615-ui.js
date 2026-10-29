#!/usr/bin/env node
/* bitGen Studio — 2.615.0 in a REAL browser: BASIC SETTINGS FOLLOW THE STYLE (misc/basic_settings.tmp).
 * Tim: "when user changes a style anywhere in bitgen, save the all basic settings+style name in basic settings docker to
 * misc\basic_settings.tmp. if the file does not exist , create it . this operation must be done before changing the
 * style. load the basic settings on start with the last style used before previous session closed and when style
 * changes. if basic settings change for a style change the settings in the file when user changes style".
 *   the file made at the start; video style A: steps 17 / cfg 3.5 -> B (prompt docker): A's kept (before the change - not
 *   B's), B: steps 33 -> back to A from Basic Settings' style card: 17 / 3.5 back; image styles keep the image set only;
 *   steps changed on B, the app closed (another style in the config): B and its settings back.
 * Against the running app (H3_URL, default the e2e server on :8311 - run from its folder: the file is checked on disk).
 * No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.615.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const FILE = path.join(__dirname, "..", "misc", "basic_settings.tmp");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const local = /127\.0\.0\.1|localhost/.test(URL_) && fs.existsSync(path.dirname(FILE));
  const keepFile = local && fs.existsSync(FILE) ? fs.readFileSync(FILE) : null;
  if (local) { try { fs.rmSync(FILE); } catch { /* none */ } }
  const vs = (await api("/api/styles?kind=video")).styles || [], is = (await api("/api/styles?kind=image")).styles || [];
  if (vs.length < 2 || is.length < 2) { console.log("SKIP: needs two video and two image styles"); process.exit(0); }
  const A = vs[0], Bs = vs[1], X = is[0], Y = is[1];
  const cfg0 = await api("/api/config");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2000, height: 1300 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  const boot = async () => {
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3StyleBasic && H3StyleBasic.ready(), null, { timeout: 90000 });
    await p.waitForTimeout(400);
  };
  const setF = (id, v) => ev(([id, v]) => { const el = document.getElementById(id); el.value = String(v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, [id, v]);
  const val = (id) => ev((id) => document.getElementById(id).value, id);
  const pickV = (id) => ev((id) => { const s = document.getElementById("videoStyleSel"); s.value = id; s.dispatchEvent(new Event("change", { bubbles: true })); }, id);
  const pickI = (id) => ev((id) => { const s = document.getElementById("styleSel"); s.value = id; s.dispatchEvent(new Event("change", { bubbles: true })); }, id);
  const F = () => api("/api/basic-settings/styles");
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await boot();
    const f0 = await F();
    check("the start: misc/basic_settings.tmp is made (it was not there) with the styles in use now and every Basic Settings field",
      (!local || fs.existsSync(FILE)) && Object.keys(f0.styles || {}).length >= 1 && Object.values(f0.styles).some((e) => e.basic && "steps" in e.basic && "imgSteps" in e.basic && "resSel" in e.basic), { local, keys: Object.keys(f0.styles || {}) });

    /* video style A -> B: A's settings kept BEFORE the change */
    await pickV(A.id); await p.waitForTimeout(300);
    await setF("steps", 17); await setF("cfg", 3.5);
    let order = await ev(() => { window.__sbOrder = []; const o = H3BasicCfg.collect; return 0; });
    await pickV(Bs.id); await p.waitForTimeout(500);
    let f1 = await F();
    const eA = f1.styles["video:" + A.id];
    check("video style A (steps 17, cfg 3.5) -> B in the prompt docker: A's settings + its NAME written to the file first (A's, not B's), B is the last style",
      eA && eA.style === A.name && eA.basic.steps === "17" && eA.basic.cfg === "3.5" && f1.last.video === Bs.id, { eA: eA && { style: eA.style, steps: eA.basic.steps, cfg: eA.basic.cfg }, last: f1.last });
    await setF("steps", 33); await setF("cfg", 6);
    // back to A from Basic Settings' own style card
    await ev((id) => { const s = document.getElementById("bscSel"); s.value = id; s.dispatchEvent(new Event("change")); }, A.id);
    await p.waitForTimeout(500);
    const backA = { steps: await val("steps"), cfg: await val("cfg"), sel: await val("videoStyleSel") };
    f1 = await F();
    check("back to A from Basic Settings' style card: A's 17 / 3.5 put back; B's 33 / 6 kept in the file",
      backA.sel === A.id && backA.steps === "17" && backA.cfg === "3.5" && f1.styles["video:" + Bs.id].basic.steps === "33" && f1.styles["video:" + Bs.id].basic.cfg === "6", { backA, b: f1.styles["video:" + Bs.id] && f1.styles["video:" + Bs.id].basic.steps });
    await pickV(Bs.id); await p.waitForTimeout(400);
    check("…and to B again: 33 / 6", (await val("steps")) === "33" && (await val("cfg")) === "6");

    /* image styles: the image set only */
    await pickI(X.id); await p.waitForTimeout(300); await setF("imgSteps", 12);
    await pickI(Y.id); await p.waitForTimeout(300); await setF("imgSteps", 40);
    await pickI(X.id); await p.waitForTimeout(400);
    const im = { img: await val("imgSteps"), steps: await val("steps"), fx: (await F()).styles["image:" + X.id] };
    check("image styles keep the image set: X 12 / Y 40 - back to X = 12; the video settings untouched (33)", im.img === "12" && im.steps === "33" && im.fx && im.fx.style === X.name, { img: im.img, steps: im.steps });

    /* closed and opened again: the last styles + their settings */
    await setF("steps", 44);
    await api("/api/config", { ui: { vstyle: A.id } });                         // the config says A - the file says B
    await p.reload({ waitUntil: "domcontentloaded" });
    await boot(); await p.waitForTimeout(800);
    const re = { sel: await val("videoStyleSel"), steps: await val("steps"), cfg: await val("cfg"), isel: await val("styleSel"), img: await val("imgSteps") };
    check("the app opened again: the last session's styles (B, X) picked again with their settings - steps 44 changed just before closing, cfg 6, image 12",
      re.sel === Bs.id && re.steps === "44" && re.cfg === "6" && re.isel === X.id && re.img === "12", re);
    void order;
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/config", { ui: { vstyle: (cfg0.ui || {}).vstyle || "", style: (cfg0.ui || {}).style || "" } }); } catch { /* fine */ }
    if (local) { try { if (keepFile) fs.writeFileSync(FILE, keepFile); else fs.rmSync(FILE, { force: true }); } catch { /* fine */ } }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
