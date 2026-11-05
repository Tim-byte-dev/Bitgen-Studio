#!/usr/bin/env node
/* bitGen Studio — 2.680.0 in a REAL browser: THE PROMPT DOCKER'S ⇄ - beside the image style dropdown: two styles picked
 * one after the other, ⇄ puts the first back and again the second; with Override style on, the Basic Settings value and
 * the temporary LoRA come back too; kept in model_settings.tmp across a reload.
 * Tim (verbatim): "add a toggle button next to each model type dropdown in prompt docker so user can toggle between current
 * settings for the model type and previous settings - if the settings have overide checked use overide settings including
 * any temporary loras, save the settings in a file model_settings.tmp ."
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.680.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const saved = await api("/api/model-settings");
  await api("/api/model-settings", { settings: {} });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  const boot = async () => { await p.waitForFunction(() => window.H3ModelSwap && H3ModelSwap.ready() && document.getElementById("swap_image") && document.getElementById("styleSel").options.length > 2, null, { timeout: 40000 }); };
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" }); await boot();
    const opts = await ev(() => [...document.getElementById("styleSel").options].map((o) => o.value).filter(Boolean).slice(0, 3));
    const pick = (v) => ev((v) => { const s = document.getElementById("styleSel"); s.value = v; s.dispatchEvent(new Event("change", { bubbles: true })); }, v);
    const place = await ev(() => { const s = document.getElementById("styleSel"), b = document.getElementById("swap_image"), v = document.getElementById("swap_video"); return { next: s.nextElementSibling === b, video: !!v && document.getElementById("videoStyleSel").nextElementSibling === v, text: b.textContent }; });
    check("⇄ beside the image style dropdown and the video style dropdown", place.next && place.video && place.text === "⇄", place);
    await ev(() => { const o = document.getElementById("ovrStyle"); if (o.checked) { o.checked = false; o.dispatchEvent(new Event("change", { bubbles: true })); } });
    await pick(opts[0]); await p.waitForTimeout(150); await pick(opts[1]); await p.waitForTimeout(150);
    const t1 = await ev(() => ({ dis: document.getElementById("swap_image").getAttribute("aria-disabled") === "true", title: document.getElementById("swap_image").title }));
    check("two styles picked one after the other: ⇄ ready, its tooltip names the first", !t1.dis && /^⇄ Back to /.test(t1.title), t1);
    await ev(() => document.getElementById("swap_image").click()); await p.waitForTimeout(250);
    check("⇄: the first style back", (await ev(() => document.getElementById("styleSel").value)) === opts[0]);
    await ev(() => document.getElementById("swap_image").click()); await p.waitForTimeout(250);
    check("⇄ again: the second again (it toggles)", (await ev(() => document.getElementById("styleSel").value)) === opts[1]);
    // Override style on: a Basic Settings value + a temporary LoRA ride with the setting
    const fid = await ev(() => { const o = document.getElementById("ovrStyle"); o.checked = true; o.dispatchEvent(new Event("change", { bubbles: true }));
      const c = [...document.querySelectorAll("#iset input[id]")].find((x) => (x.type === "number" || x.type === "text") && !x.closest(".lorarow"));
      c.value = "37"; c.dispatchEvent(new Event("input", { bubbles: true })); c.dispatchEvent(new Event("change", { bubbles: true }));
      addTempLora("image", { path: "loras/e2e680_temp.safetensors", weight: 0.4 }); saveTempLoras("image"); document.getElementById("iset").dispatchEvent(new Event("change", { bubbles: true })); return c.id; });
    await p.waitForTimeout(200);
    await pick(opts[2]); await p.waitForTimeout(150);
    await ev((fid) => { const c = document.getElementById(fid); c.value = "12"; c.dispatchEvent(new Event("change", { bubbles: true })); paintTempLoras({ image: [], video: tempLoras("video"), cnet: tempLoras("cnet") }); saveTempLoras("image"); }, fid);
    await ev(() => document.getElementById("swap_image").click()); await p.waitForTimeout(400);
    const back = await ev((fid) => ({ style: document.getElementById("styleSel").value, v: document.getElementById(fid).value, loras: tempLoras("image").map((l) => l.path + "@" + l.weight), ovr: document.getElementById("ovrStyle").checked }), fid);
    check("Override style on: ⇄ brings back the style, its Basic Settings value (37) and the temporary LoRA", back.style === opts[1] && back.v === "37" && back.loras.join() === "loras/e2e680_temp.safetensors@0.4" && back.ovr, back);
    await p.waitForTimeout(800);
    const file = await api("/api/model-settings");
    check("model_settings.tmp holds it: the current (with its values + LoRA) and the previous", file.image.cur && file.image.cur.style === opts[1] && file.image.cur.ovr && file.image.cur.loras.length === 1 && file.image.prev && file.image.prev.style === opts[2], file.image);
    await p.reload({ waitUntil: "domcontentloaded" }); await boot(); await p.waitForTimeout(3500);
    const after = await ev(() => ({ dis: document.getElementById("swap_image").getAttribute("aria-disabled") === "true", prev: H3ModelSwap.state().data.image.prev && H3ModelSwap.state().data.image.prev.style }));
    check("after a reload: the previous setting still there (⇄ ready)", !after.dis && after.prev === opts[2], after);
    check("no page errors", errs.length === 0, errs);
    await ev(() => { paintTempLoras({ image: [], video: tempLoras("video"), cnet: tempLoras("cnet") }); saveTempLoras("image"); const o = document.getElementById("ovrStyle"); o.checked = false; o.dispatchEvent(new Event("change", { bubbles: true })); });
    await p.waitForTimeout(600);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/model-settings", { settings: saved }); } catch { /* fine */ }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
