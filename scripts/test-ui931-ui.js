#!/usr/bin/env node
/* bitGen Studio — 2.931.0 in a REAL browser: an on / off switch on each temporary LoRA in Basic Settings.
 * Tim: "add a toggle switch to the added loras in basic settings so we can toggle loras on and off without removing them".
 * Two picture LoRAs (one switched off) painted into Basic Settings: the switches show it, the off row is dimmed; Generate's
 * list has only the one on; a click switches it, it is saved (on:false in the project's file), and after a reload the
 * switches come back as left. Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/$/, "");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const getj = async (p) => (await fetch(URL_ + p)).json();
const post = (p, b) => fetch(URL_ + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
(async () => {
  try { const r = await fetch(URL_ + "/"); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  const was = await getj("/api/temploras");
  await post("/api/temploras/image", { loras: [{ path: "loras\\on931.safetensors", weight: 0.8 }, { path: "loras\\off931.safetensors", weight: 0.5, on: false }] });
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_ + "/", { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => document.querySelectorAll("#tliRows .lorarow").length === 2, null, { timeout: 60000 }).catch(() => {});
    await p.waitForLoadState("networkidle").catch(() => {}); await p.waitForTimeout(1500);   // the page reads the list twice at start
    const rows = () => ev(() => [...document.querySelectorAll("#tliRows .lorarow")].map((r) => ({ path: (r.querySelector("input[type=text]") || {}).value, on: r.querySelector(".lon") && r.querySelector(".lon").checked, dim: r.classList.contains("loff"), sw: !!r.querySelector(".lline .lswitch") })));
    let r = await rows();
    check("Basic Settings: every LoRA row has a switch; on931 on, off931 off and dimmed (still listed)", r.length === 2 && r.every((x) => x.sw) && r[0].on && !r[0].dim && !r[1].on && r[1].dim, r);
    check("…Generate's list (tempLoras) has only the one switched on; all = both", await ev(() => JSON.stringify(tempLoras("image").map((l) => l.path)) === JSON.stringify(["loras\\on931.safetensors"]) && tempLoras("image", undefined, true).length === 2));
    await ev(() => { const s = document.querySelectorAll("#tliRows .lorarow .lon"); s[0].click(); s[1].click(); });
    await p.waitForTimeout(900);
    r = await rows();
    check("a click switches each (on931 off, off931 on)", !r[0].on && r[0].dim && r[1].on && !r[1].dim, r);
    const saved = await getj("/api/temploras");
    check("…saved in the project: on931 on:false, off931 on - both still there", saved.image.length === 2 && saved.image.find((l) => /on931/.test(l.path)).on === false && saved.image.find((l) => /off931/.test(l.path)).on === undefined, saved.image);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => document.querySelectorAll("#tliRows .lorarow").length === 2, null, { timeout: 60000 }).catch(() => {});
    await p.waitForLoadState("networkidle").catch(() => {}); await p.waitForTimeout(1500);
    r = await rows();
    check("after a reload the switches are as left", r.length === 2 && !r.find((x) => /on931/.test(x.path)).on && r.find((x) => /off931/.test(x.path)).on, r);
    await ev(() => document.querySelector("#tliRows .lorarow .lx").click());
    await p.waitForTimeout(800);
    check("✕ still removes a LoRA", (await getj("/api/temploras")).image.length === 1);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally { await b.close(); await post("/api/temploras/image", { loras: was.image || [] }); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
