#!/usr/bin/env node
/* bitGen Studio — 2.905.0 in a REAL browser (Tim: "make sure it works with all video models - it is not overiding with
 * fast h3 omni"): Override style on, Use model + Use temporary LoRAs unticked, Basic Settings set (steps 9, CFG 3.5,
 * seed 777, sampler dpmpp_2m / karras). FastH3 Omni (/api/generate), H3 Long Video (/api/h3long) and Swap mode (/api/swap)
 * each send Basic Settings' Override and the sampler / scheduler header - no model, no LoRAs; with the boxes ticked the
 * model + LoRAs go too; Override off = no header and Override off in `basic`. Then the REAL server: FastH3 Omni's job keeps
 * CFG 3.5 (the worker no longer forces 1 - its log says so). Against the running app (H3_URL) with the stub ComfyUI. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const fields = (b) => { const m = {}; String(b || "").replace(/name="([^"]+)"(?:; filename="[^"]*")?\r\n(?:Content-Type: [^\r\n]*\r\n)?\r\n([\s\S]*?)\r\n--/g, (_, k, v) => { m[k] = v; }); return m; };
const HDR = JSON.stringify({ sampler: "dpmpp_2m", scheduler: "karras" });
(async () => {
  try { const r = await fetch(URL_); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  const keepUse = await (await fetch(URL_ + "api/basic-use")).json();
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const got = [];
  const hdr = (r) => r.request().headers()["x-bitgen-sampler"] || "";
  for (const [u, tag] of [["**/api/generate", "gen"], ["**/api/h3long", "long"], ["**/api/swap", "swap"]])
    await p.route(u, (r) => { if (r.request().method() !== "POST") return r.continue(); got.push({ u: tag, h: hdr(r), f: fields(r.request().postDataBuffer().toString("latin1")) }); r.fulfill({ json: { id: "fake905" + tag } }); });
  await p.route("**/api/jobs/fake*", (r) => r.fulfill({ json: { id: "x", status: "done", outputs: [] } }));
  await p.route("**/api/comfy/ensure", (r) => r.fulfill({ json: { ok: true, reachable: true } }));
  await p.route("**/api/comfy/status", (r) => r.fulfill({ json: { reachable: true } }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3OvrUse && window.H3Samplers && window.H3LongGen && document.getElementById("useVidModel")
      && typeof videoStyles !== "undefined" && videoStyles.some((s) => s.name === "FastH3 Omni") && videoStyles.some((s) => s.arch === "h3-long"), null, { timeout: 60000 });
    await p.waitForFunction(() => performance.now() > 6500, null, { timeout: 20000 });
    const ids = await p.evaluate(() => ({ fast: videoStyles.find((s) => s.name === "FastH3 Omni").id, long: videoStyles.find((s) => s.arch === "h3-long").id,
      swap: (videoStyles.find((s) => s.name === "mmh3_chr_swap") || {}).id || "" }));
    const setv = (id, v) => p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }, [id, v]);
    const ovr = (on) => p.evaluate((on) => { const o = document.getElementById("ovrStyle"); if (o.checked !== on) { o.checked = on; o.dispatchEvent(new Event("change", { bubbles: true })); } }, on);
    const boxes = (on) => p.evaluate((on) => ["useVidModel", "useVidLoras"].forEach((id) => { const c = document.getElementById(id); if (c.checked !== on) c.click(); }), on);
    await p.evaluate(() => { window.tempLoras = (k) => [{ path: "temp_" + k + ".safetensors", weight: 0.7 }];
      const g = document.getElementById("genModeSel"); if (g) { g.value = "video"; g.dispatchEvent(new Event("change")); } });
    let OVR = true;
    const pick = async (id) => {
      await p.evaluate((v) => { const s = document.getElementById("videoStyleSel"); s.value = v; s.dispatchEvent(new Event("change")); }, id);
      await p.waitForTimeout(300);
      await setv("steps", "9"); await setv("cfg", "3.5"); await setv("seed", "777"); await setv("vidSampler", "dpmpp_2m"); await setv("vidScheduler", "karras");
      await setv("vidModel", "vid_override.safetensors");
      await ovr(OVR);   // after the style change: Basic Settings' memory puts back the style's own switch
    };
    const last = (tag) => got.filter((g) => g.u === tag).pop();
    const B = (r) => { try { return JSON.parse((r && r.f && r.f.basic) || "null"); } catch { return null; } };
    const mode = (m) => p.evaluate((m) => document.querySelector('.modes button[data-mode="' + m + '"]').click(), m);
    // Basic Settings keeps its mode per style (static/stylebasic.js) - a run that ended on Swap would start there
    const fast = async () => { await pick(ids.fast); await mode("ref2va"); await p.fill("#prompt", "a red cat walks"); await p.click("#go"); await p.waitForTimeout(2500); return last("gen"); };
    const long = async () => { await pick(ids.long); await p.evaluate(() => H3LongGen.submit("A red cat.\n\nIt walks.")); await p.waitForTimeout(1500); return last("long"); };
    const swap = async () => {
      if (ids.swap) await pick(ids.swap); else await pick(ids.fast);
      await mode("swap");
      await p.evaluate(() => { refs.length = 0; refs.push({ file: new File([new Uint8Array([137, 80, 78, 71])], "who.png", { type: "image/png" }) }); refVids.length = 0; refVids.push("clip905.webm"); });
      await p.evaluate(() => submitSwap("")); await p.waitForTimeout(1500);
      return last("swap");
    };

    // 1. Override on, boxes unticked
    await boxes(false);
    let r = await fast(), bo = B(r);
    check("FastH3 Omni: steps 9 / CFG 3.5 / seed 777 + the sampler header, no model or LoRAs", bo && bo.override && bo.steps === 9 && bo.cfg === 3.5 && bo.seed === 777
      && bo.model === "" && !bo.loras.length && r.h === HDR && r.f.video_style_id === ids.fast, r && r.f);
    r = await long(); bo = B(r);
    check("H3 Long Video: Basic Settings' Override + the sampler header (its own route)", bo && bo.override && bo.steps === 9 && bo.cfg === 3.5 && bo.seed === 777
      && bo.model === "" && !bo.loras.length && r.h === HDR, r);
    r = await swap(); bo = B(r);
    check("Swap mode: Basic Settings' Override + the sampler header (its own route)", bo && bo.override && bo.steps === 9 && bo.cfg === 3.5 && bo.seed === 777
      && bo.model === "" && r.h === HDR, r);
    // 2. ticked: the model + LoRAs too
    await boxes(true);
    r = await long(); bo = B(r);
    check("H3 Long Video, boxes ticked: the model and the temporary LoRA go too", bo && bo.model === "vid_override.safetensors" && bo.loras.length === 1, bo);
    r = await swap(); bo = B(r);
    check("Swap mode, boxes ticked: the model and the temporary LoRA go too", bo && bo.model === "vid_override.safetensors" && bo.loras.length === 1, bo);
    // 3. Override off
    OVR = false;
    r = await long(); bo = B(r);
    check("Override off: H3 Long Video's basic says off, no header", bo && bo.override === false && !r.h, [bo, r && r.h]);
    r = await swap(); bo = B(r);
    check("Override off: Swap's basic says off, no header", bo && bo.override === false && !r.h, [bo, r && r.h]);
    check("no page errors", errs.length === 0, errs);
    // leave the page as a user would find it: Ref mode, no test pictures in the tray
    await pick(ids.fast); await mode("ref2va"); await p.evaluate(() => { refVids.length = 0; }); await p.waitForTimeout(600);
  } finally { await b.close(); }

  // 4. the real server: FastH3 Omni keeps Override's CFG (needs the stub ComfyUI the gate configures)
  await fetch(URL_ + "api/basic-use", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ video_model: false, video_loras: false }) }).catch(() => {});
  try {
    const st = await (await fetch(URL_ + "api/styles?kind=video")).json();
    const fastId = ((st.styles || st).find((s) => s.name === "FastH3 Omni") || {}).id;
    const fd = new FormData();
    fd.append("mode", "ref2va"); fd.append("prompt", "a red cat walks <Picture 1>"); fd.append("video_style_id", fastId);
    fd.append("basic", JSON.stringify({ override: true, steps: 9, cfg: 3.5, seed: 777, model: "", loras: [] }));
    fd.append("width", "640"); fd.append("height", "384"); fd.append("frames", "49");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");
    fd.append("references", new Blob([png], { type: "image/png" }), "ref905.png");
    const j = await (await fetch(URL_ + "api/generate", { method: "POST", body: fd, headers: { "X-Bitgen-Sampler": HDR } })).json();
    let job = null;
    for (let i = 0; i < 60; i++) { job = await (await fetch(URL_ + "api/jobs/" + j.id)).json(); if (!["queued", "running"].includes(job.status)) break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const log = (job.log || []).join("\n");
    const meta = ((log.match(/\[meta\] (\{.*\})/) || [])[1]) || "{}";
    let m = {}; try { m = JSON.parse(meta); } catch { m = {}; }
    check("the server: FastH3 Omni renders with Override's CFG 3.5 (true CFG), steps 9, seed 777, dpmpp_2m - the worker says so",
      job.status === "done" && /FastH3: cfg 3\.5 \(Basic Settings - Override style\)/.test(log) && !/cfg 3\.5 -> 1/.test(log)
      && m.cfg === 3.5 && m.steps === 9 && m.seed === 777 && m.sampler === "dpmpp_2m", { status: job.status, log: log.slice(-1500) });
  } finally {
    await fetch(URL_ + "api/basic-use", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(keepUse) }).catch(() => {});
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
