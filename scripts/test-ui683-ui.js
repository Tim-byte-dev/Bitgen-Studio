#!/usr/bin/env node
/* bitGen Studio — 2.683.0 in a REAL browser: THE PROMPT DOCKER'S ⇄ WORKS WITH THE APP'S OWN STYLE CHANGE. Picking a style
 * refills Basic Settings (stylebasic.js / populateImageBasics) BEFORE the dropdown's change reaches modelswap.js - the old
 * style must still become the previous (2.680.0 lost it: ⇄ stayed greyed out). "— template —" counts as a setting; with
 * nothing to go back to ⇄ says so beside it.
 * Tim (verbatim): "the model toggle button in prompt docker is not working"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.683.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})).json();

(async () => {
  const saved = await api("/api/model-settings");
  await api("/api/model-settings", { settings: { image: { cur: null, prev: null }, video: { cur: null, prev: null } } });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  const st = (k) => ev((k) => { const d = H3ModelSwap.state().data[k], b = document.getElementById("swap_" + k);
    return { cur: d.cur && d.cur.style, prev: d.prev && d.prev.style, off: b.getAttribute("aria-disabled") === "true", disabled: b.disabled, msg: (document.getElementById("swap_msg_" + k) || {}).textContent || "" }; }, k);
  const pick = (id, v) => ev(([id, v]) => { const s = document.getElementById(id); s.value = v; s.dispatchEvent(new Event("change", { bubbles: true })); }, [id, v]);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3ModelSwap && H3ModelSwap.ready() && document.getElementById("styleSel").options.length > 2, null, { timeout: 40000 });
    const opts = await ev(() => [...document.getElementById("styleSel").options].map((o) => o.value).filter(Boolean).slice(0, 2));
    const vopts = await ev(() => [...document.getElementById("videoStyleSel").options].map((o) => o.value).filter(Boolean).slice(0, 1));
    await ev(() => document.getElementById("swap_image").click()); await p.waitForTimeout(200);
    const s0 = await st("image");
    check("nothing to go back to yet: ⇄ dimmed but never dead - a press says so beside it", s0.off && !s0.disabled && /nothing to go back to yet/.test(s0.msg), s0);
    // Override style on + a Basic Settings value, then the app's own style change (it refills Basic Settings first)
    await pick("styleSel", opts[0]); await p.waitForTimeout(400);
    const fid = await ev(() => { const o = document.getElementById("ovrStyle"); o.checked = true; o.dispatchEvent(new Event("change", { bubbles: true }));
      const c = [...document.querySelectorAll("#iset input[id]")].find((x) => (x.type === "number" || x.type === "text") && !x.closest(".lorarow") && x.offsetParent !== null) || [...document.querySelectorAll("#iset input[id]")].find((x) => x.type === "number");
      c.value = "41"; c.dispatchEvent(new Event("input", { bubbles: true })); c.dispatchEvent(new Event("change", { bubbles: true })); return c.id; });
    await p.waitForTimeout(300);
    const refilled = await ev(([v, fid]) => { let fired = 0; const box = document.getElementById("iset"), t = () => { fired++; }; box.addEventListener("input", t); box.addEventListener("change", t);
      const s = document.getElementById("styleSel"); s.value = v; s.dispatchEvent(new Event("change", { bubbles: true })); box.removeEventListener("input", t); box.removeEventListener("change", t); return fired; }, [opts[1], fid]);
    await p.waitForTimeout(800);
    const s1 = await st("image");
    check("a style picked (the app refilled Basic Settings - " + refilled + " events - before the dropdown's change): the old style is the previous, ⇄ ready", s1.cur === opts[1] && s1.prev === opts[0] && !s1.off, { s1, refilled });
    await ev(() => document.getElementById("swap_image").click()); await p.waitForTimeout(800);
    const back = await ev((fid) => ({ style: document.getElementById("styleSel").value, v: document.getElementById(fid).value, ovr: document.getElementById("ovrStyle").checked }), fid);
    check("⇄: the first style back with its Basic Settings value (41), Override on", back.style === opts[0] && back.v === "41" && back.ovr, back);
    await ev(() => document.getElementById("swap_image").click()); await p.waitForTimeout(600);
    check("⇄ again: the second style again (it toggles)", (await ev(() => document.getElementById("styleSel").value)) === opts[1]);
    // video: from "— template —" to a style, ⇄ = back to the template
    await ev(() => { const o = document.getElementById("ovrStyle"); o.checked = false; o.dispatchEvent(new Event("change", { bubbles: true })); });
    await pick("videoStyleSel", ""); await p.waitForTimeout(300);
    await pick("videoStyleSel", vopts[0]); await p.waitForTimeout(600);
    const v1 = await st("video");
    check("video: — template — then a style: — template — is the previous, ⇄ ready", v1.cur === vopts[0] && v1.prev === "" && !v1.off, v1);
    await ev(() => document.getElementById("swap_video").click()); await p.waitForTimeout(500);
    check("…⇄: back to — template —", (await ev(() => document.getElementById("videoStyleSel").value)) === "");
    await p.waitForTimeout(800);
    const file = await api("/api/model-settings");
    check("model_settings.tmp keeps both (— template — as an empty style)", file.image.prev && file.video.cur && file.video.cur.style === "" && file.video.prev && file.video.prev.style === vopts[0], { image: file.image.prev && file.image.prev.style, video: file.video });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/model-settings", { settings: saved }); } catch { /* fine */ }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
