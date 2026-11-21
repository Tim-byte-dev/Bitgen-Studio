#!/usr/bin/env node
/* bitGen Studio — 2.904.0 in a REAL browser (Tim: "the overide settings are not working. when overide is checked overide style
 * settings even when loras and checkpoint are unchecked. all the other overide settings remain, size, aspect ratio,seed,cfg,
 * sampler,scheduler will still overide style , only the unchecked values won't change the styles values"): Override style on,
 * Basic Settings set (size, aspect, steps, CFG, seed, sampler, scheduler, a model, a temporary LoRA). Ticked: everything goes.
 * Use model + Use temporary LoRAs unticked: a MiniMax H3 video, a picture and a PAN 2 video still send the size / aspect /
 * steps / CFG / seed and the sampler / scheduler header - only the model and the LoRAs stay the style's. Override off: none.
 * Against the running app (H3_URL). */
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
(async () => {
  try { const r = await fetch(URL_); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  const keepUse = await (await fetch(URL_ + "api/basic-use")).json();
  await fetch(URL_ + "api/basic-use", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_model: true, image_loras: true, video_model: true, video_loras: true }) });
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const got = [];
  const hdr = (r) => r.request().headers()["x-bitgen-sampler"] || "";
  await p.route("**/api/generate", (r) => { got.push({ u: "h3", h: hdr(r), f: fields(r.request().postDataBuffer().toString("latin1")) }); r.fulfill({ json: { id: "fakeH904" } }); });
  await p.route("**/api/genimage", (r) => { if (r.request().method() !== "POST") return r.continue(); got.push({ u: "img", h: hdr(r), b: JSON.parse(r.request().postData() || "{}") }); r.fulfill({ json: { id: "fakeI904" } }); });
  const CAP = JSON.stringify({ video_style: "x", events: [{ t: 0, what: "a cat walks" }] });
  await p.route("**/api/pan2/caption", (r) => { got.push({ u: "cap", h: hdr(r) }); r.fulfill({ json: { caption: CAP, pretty: CAP, how: "llm", notes: [] } }); });
  await p.route("**/api/pan2", (r) => { if (r.request().method() !== "POST") return r.continue(); got.push({ u: "pan2", h: hdr(r), f: fields(r.request().postDataBuffer().toString("latin1")) }); r.fulfill({ json: { id: "fakeP904", notes: [] } }); });
  await p.route("**/api/jobs/fake*", (r) => r.fulfill({ json: { id: "x", status: "done", outputs: [] } }));
  await p.route("**/api/comfy/ensure", (r) => r.fulfill({ json: { ok: true, reachable: true } }));
  await p.route("**/api/comfy/status", (r) => r.fulfill({ json: { reachable: true } }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3OvrUse && window.H3Samplers && document.getElementById("useVidModel") && document.getElementById("imgSampler")
      && typeof videoStyles !== "undefined" && videoStyles.some((s) => s.arch === "pan2") && typeof styleList !== "undefined" && styleList.some((s) => s.name === "Illustrious"), null, { timeout: 60000 });
    // static/stylebasic.js re-picks the last style used about 4 s after the page loads - wait for it, or it flips the test's pick
    await p.waitForFunction(() => performance.now() > 6500, null, { timeout: 20000 });
    const ids = await p.evaluate(() => ({ h3: videoStyles.find((s) => s.arch === "minimax-h3" && !/viggle|swap|omni/i.test(s.name)).id, pan: videoStyles.find((s) => s.arch === "pan2").id,
      img: styleList.find((s) => s.name === "Illustrious").id }));
    const pickV = (v) => p.evaluate((v) => { const s = document.getElementById("videoStyleSel"); s.value = v; s.dispatchEvent(new Event("change")); }, v);
    const setv = (id, v) => p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }, [id, v]);
    const ovr = (on) => p.evaluate((on) => { const o = document.getElementById("ovrStyle"); if (o.checked !== on) { o.checked = on; o.dispatchEvent(new Event("change", { bubbles: true })); } }, on);
    const boxes = (on) => p.evaluate((on) => ["useImgModel", "useImgLoras", "useVidModel", "useVidLoras"].forEach((id) => { const c = document.getElementById(id); if (c.checked !== on) c.click(); }), on);
    const mode = (m) => p.evaluate((m) => { const g = document.getElementById("genModeSel"); if (g) { g.value = m; g.dispatchEvent(new Event("change")); } }, m);
    // a temporary LoRA in each list, a model in each box (the page's own globals)
    await p.evaluate(() => { window.tempLoras = (k) => [{ path: "temp_" + k + ".safetensors", weight: 0.7 }]; });
    await ovr(true);
    const fill = async () => {
      await setv("steps", "9"); await setv("cfg", "3.5"); await setv("seed", "777"); await setv("resSel", "custom"); await setv("width", "640"); await setv("height", "384");
      await setv("vidSampler", "euler"); await setv("vidScheduler", "karras"); await setv("vidModel", "vid_override.safetensors");
      await setv("imgSteps", "7"); await setv("imgCfg", "2.5"); await setv("imgSeed", "123"); await setv("imgRes", "768"); await setv("imgAr", "16:9");
      await setv("imgSampler", "dpmpp_2m"); await setv("imgScheduler", "sgm_uniform");
      await p.evaluate(() => { const c = document.getElementById("imgCkpt"); if (c) { c.value = "sd_xl_base_1.0.safetensors"; c.dispatchEvent(new Event("input", { bubbles: true })); } });
      await ovr(OVR);   // after the style change: Basic Settings' memory (stylebasic / modelswap) puts back the style's own switch
    };
    let OVR = true;
    const h3 = async () => { await mode("video"); await pickV(ids.h3); await p.waitForTimeout(300); await fill(); await p.fill("#prompt", "a red cat walks"); await p.click("#go"); await p.waitForTimeout(2500); return got.filter((g) => g.u === "h3").pop(); };
    const pic = async () => { await mode("image"); await p.evaluate((v) => { const s = document.getElementById("styleSel"); s.value = v; s.dispatchEvent(new Event("change")); }, ids.img); await p.waitForTimeout(300); await fill(); await p.fill("#prompt", "a red cat walks"); await p.click("#goImg"); await p.waitForTimeout(2500); return got.filter((g) => g.u === "img").pop(); };
    const pan = async () => { await mode("video"); await pickV(ids.pan); await p.waitForTimeout(300); await fill(); await p.fill("#prompt", "a red cat walks"); await p.click("#go"); await p.waitForTimeout(3000); return got.filter((g) => g.u === "pan2").pop(); };
    const B = (r) => { try { return JSON.parse((r && r.f && r.f.basic) || "null"); } catch { return null; } };

    // 1. Override on, both boxes ticked: everything
    await boxes(true);
    let r = await h3(), bo = B(r);
    check("ticked: H3 sends steps 9 / CFG 3.5 / seed 777 + the model + the temporary LoRA", bo && bo.override === true && bo.steps === 9 && bo.cfg === 3.5 && bo.seed === 777 && bo.model === "vid_override.safetensors" && bo.loras.length === 1, r && r.f);
    r = await pic();
    check("ticked: the picture sends size / steps / CFG / seed + the checkpoint + the temporary LoRA", r && r.b.width === 768 && r.b.height === 432 && r.b.steps === 7 && r.b.cfg === 2.5 && r.b.seed === 123
      && r.b.model === "sd_xl_base_1.0.safetensors" && (r.b.extra_loras || []).length === 1, r && r.b);

    // 2. Use model + Use temporary LoRAs unticked: everything else still goes
    await boxes(false);
    r = await h3(); bo = B(r);
    check("unticked: H3 still sends steps 9 / CFG 3.5 / seed 777 (Override on)", bo && bo.override === true && bo.steps === 9 && bo.cfg === 3.5 && bo.seed === 777, bo);
    check("...the size 640x384", r && r.f.width === "640" && r.f.height === "384", r && r.f);
    check("...the sampler / scheduler", r && r.h === JSON.stringify({ sampler: "euler", scheduler: "karras" }), r && r.h);
    check("...but no model and no LoRAs - the style's own", bo && bo.model === "" && bo.loras.length === 0 && !("extra_loras" in r.f), r && r.f);
    r = await pic();
    check("unticked: the picture still sends size 768x432 (16:9) / steps 7 / CFG 2.5 / seed 123", r && r.b.width === 768 && r.b.height === 432 && r.b.steps === 7 && r.b.cfg === 2.5 && r.b.seed === 123, r && r.b);
    check("...the sampler / scheduler", r && r.h === JSON.stringify({ sampler: "dpmpp_2m", scheduler: "sgm_uniform" }), r && r.h);
    check("...but not the checkpoint or the LoRAs", r && !("model" in r.b) && !("extra_loras" in r.b), r && r.b);
    r = await pan(); bo = B(r);
    check("unticked: PAN 2 sends Basic Settings' Override (steps 9 / CFG 3.5 / seed 777, no model, no LoRAs)", bo && bo.override === true && bo.steps === 9 && bo.cfg === 3.5 && bo.seed === 777 && bo.model === "" && bo.loras.length === 0, r && r.f);
    check("...its size and the sampler / scheduler header (the caption call has none)", r && r.f.width === "640" && r.f.height === "384" && r.h === JSON.stringify({ sampler: "euler", scheduler: "karras" })
      && got.filter((g) => g.u === "cap").every((g) => !g.h), [r && r.f, r && r.h]);

    // 3. Override off: the style's own
    OVR = false;
    r = await h3(); bo = B(r);
    check("Override off: H3's basic says off, no sampler header", bo && bo.override === false && !r.h, [bo, r && r.h]);
    r = await pic();
    check("Override off: the picture sends no Basic Settings values and no header", r && !("steps" in r.b) && !("width" in r.b) && !("model" in r.b) && !r.h, r && r.b);
    check("no page errors", errs.length === 0, errs);
  } finally {
    await b.close();
    await fetch(URL_ + "api/basic-use", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(keepUse) }).catch(() => {});
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
