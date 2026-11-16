#!/usr/bin/env node
/* bitGen Studio — 2.806.0 against the RUNNING app (+ a real browser): ✨ Generate from a Blender layer, the live Blender layer,
 * and the models box's ⬆ Send to <pod> / ⬇ found online.
 * Tim (verbatim): "when in image editor and a blender layer is being worked on an the generate button is pressed, then generate
 * the image from the blender scene and the prompt and reference images if any. If any lora/model is missing popup a message box
 * asking if bitgen should download it, download it to local if generation is in local mode or send to the pod if in runpod
 * mode. if a blender scene is on a layer, if user clicks away from that layer and returns show the blender scene edited
 * blender layers are raster layers but the blender scene layer is live"
 * The Blender scene tools are a stand-in (window.TlBlend replaced: no Blender here); the AI calls are captured. No Playwright = SKIP. */
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
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const br = await chromium.launch(), p = await br.newPage({ viewport: { width: 1900, height: 1100 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.blendLayer && window.H3ModelsFound, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.waitForTimeout(400);
    // the stand-ins: the scene tools (a red view) + the AI (captured, a green result)
    await ev(() => {
      const E = window.imageEditorInstance.E, S = E.S;
      let host = null;
      window.__tb = { attach: 0, detach: 0, opened: [] };
      window.TlBlend = {
        state: { st: { stem: "Room806", source: "/scenes/Room806.blend" }, meta: { width: 1280, height: 720 }, frame: 1, view: "scene", E: [] },
        attach(h) { host = h; window.__tb.attach++; return Promise.resolve(this.state.st); },
        detach() { host = null; window.__tb.detach++; }, host: () => host,
        open(src) { window.__tb.opened.push(src); return Promise.resolve(this.state.st); },
        snapshot(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = "#e01010"; g.fillRect(0, 0, w, h); return c; },
        view: () => null,
      };
      window.__rq = [];
      E.api.aiedit = async (req) => { window.__rq.push({ mode: req.mode, prompt: req.prompt, style: req.style_id, strength: req.strength, ovr: req.ovr || "", w: req.width, h: req.height }); return { jobs: [{ id: "g" + window.__rq.length, seed: 1 }] }; };
      E.api.awaitResult = async () => { const r = window.__rq[window.__rq.length - 1], c = document.createElement("canvas"); c.width = r.w; c.height = r.h; const g = c.getContext("2d"); g.fillStyle = "#10e010"; g.fillRect(0, 0, r.w, r.h); return c.toDataURL("image/png"); };
      window.__comp = [];
      E.runCompose = async (o) => { window.__comp.push({ n: (o.pics || []).length, refs: o.sceneRefs, prompt: o.prompt }); };
      S.engines = { edit: [{ id: "ed806", name: "Edit 806" }], inpaint: [{ id: "pic806", name: "Pic 806", refine: true }] };
      try { localStorage.setItem("h3.ie.bl.live", "true"); } catch (e) { /* fine */ }
      E.openDoc(640, 360, "base806.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 640, 360); });
    });
    await p.waitForTimeout(300);
    // 1 🟧: the scene tools open, a Blender layer is made from the view, ✕ keeps it
    await ev(() => window.imageEditorInstance.E.blendLayer.start());
    await p.waitForTimeout(1200);
    const made = await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); return { bl: !!(L && L.bscene), name: L && L.name, open: E.blendLayer.isOpen(), n: E.S.layers.length }; });
    check("🟧 opens the scene tools and makes a Blender layer from the view", made.bl && made.open && /Room806/.test(made.name), made);
    // 2 LIVE: another layer picked = the tools close (the view kept, no new layer); the Blender layer picked again = open again
    await ev(() => { const E = window.imageEditorInstance.E; const i = E.S.layers.findIndex((L) => !L.bscene); E.setActive(i); });
    await p.waitForTimeout(1200);
    const away = await ev(() => { const E = window.imageEditorInstance.E; return { open: E.blendLayer.isOpen(), n: E.S.layers.length, bl: E.S.layers.filter((L) => L.bscene).length, wrap: document.getElementById("ieBlendWrap").style.display }; });
    check("another layer picked: the scene tools close, the Blender layer keeps the view (still one Blender layer)", !away.open && away.wrap === "none" && away.bl === 1 && away.n === made.n, away);
    const att0 = await ev(() => window.__tb.attach);
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((L) => L.bscene)); });
    await p.waitForTimeout(1200);
    const back = await ev(() => ({ open: window.imageEditorInstance.E.blendLayer.isOpen(), attach: window.__tb.attach, wrap: document.getElementById("ieBlendWrap").style.display }));
    check("the Blender layer picked again: its scene is shown again (the tools open - the layer is live)", back.open && back.attach === att0 + 1 && back.wrap === "block", back);
    // ☑ Live off: picking it does not open it
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((L) => !L.bscene)); });
    await p.waitForTimeout(900);
    await ev(() => { window.imageEditorInstance.E.store.set("bl.live", false); const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((L) => L.bscene)); });
    await p.waitForTimeout(1200);
    check("☑ Live off: picking the Blender layer leaves the tools closed", !(await ev(() => window.imageEditorInstance.E.blendLayer.isOpen())));
    await ev(() => window.imageEditorInstance.E.store.set("bl.live", true));
    // 3 ✨ GENERATE from the scene
    const gen = async (style, refs) => {
      await ev(([s, n]) => { window.H3Refs = { images: () => Array.from({ length: n }, (_, i) => ({ url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", name: "ref" + (i + 1) })) };
        window.__rq.length = 0; window.__comp.length = 0; window.imageEditorInstance.E.S.busy = false; }, [style, refs]);
      await ev((s) => { const E = window.imageEditorInstance.E; return E.blendLayer.generateFromScene(E.layer(), "a photo of a red cube in a sunny room", s); }, style);
      await p.waitForTimeout(800);
      return ev(() => ({ rq: window.__rq.slice(), comp: window.__comp.slice(), layers: window.imageEditorInstance.E.S.layers.map((L) => ({ n: L.name, bl: !!L.bscene })), act: !!(window.imageEditorInstance.E.layer() || {}).bscene }));
    };
    const a = await gen("pic806", 0);
    check("✨ Generate with a picture style: the scene redrawn (Refine) with it at the 🟧 Scene strength (60 %) and the prompt", a.rq.length === 1 && a.rq[0].mode === "refine" && a.rq[0].style === "pic806" && a.rq[0].strength === 60 && /red cube/.test(a.rq[0].prompt), a.rq);
    check("…the result is a new RASTER layer; the Blender layer stays picked (live)", a.layers.filter((L) => L.bl).length === 1 && a.layers.length >= 3 && a.act, a.layers);
    const b = await gen("ed806", 0);
    check("✨ Generate with an edit model: the scene + the prompt go to it", b.rq.length === 1 && b.rq[0].mode === "edit" && b.rq[0].style === "ed806", b.rq);
    const c = await gen("pic806", 2);
    check("✨ Generate with References docker pictures: the scene + both pictures to the edit model (no picture named needed)", c.comp.length === 1 && c.comp[0].n === 3 && JSON.stringify(c.comp[0].refs) === "[1,2]" && c.rq.length === 0, c);
    // the prompt docker's own button: H3TakeGenerate routes to it, the label says 🟧
    await ev(() => { window.__rq.length = 0; window.H3Refs = { images: () => [] }; const E = window.imageEditorInstance.E; E.S.busy = false; if (E.imgOp) E.imgOp.set("generate"); const g = document.getElementById("genModeSel"); if (g) g.value = "image"; });
    const lab = await ev(() => (window.H3GoLabel ? window.H3GoLabel() : ""));
    const took = await ev(() => window.H3TakeGenerate("image", "a photo of a cosy room"));
    await p.waitForTimeout(800);
    const via = await ev(() => window.__rq.slice());
    check("the prompt docker's ✨ Generate with the Blender layer picked goes to the scene (label ✨ Generate · 🟧 Blender)", took === true && via.length === 1 && /cosy room/.test(via[0].prompt) && /🟧/.test(lab), { took, via, lab });
    await ev(() => window.imageEditorInstance.E.blendLayer.leave());
    // 4 the models box: ⬆ Send to <pod>
    let sent = null, polls = 0, checks = 0;
    await p.route("**/api/models/pod-send*", async (r) => {
      if (r.request().method() === "POST") { sent = JSON.parse(r.request().postData() || "{}"); return r.fulfill({ json: { ok: true } }); }
      polls++; return r.fulfill({ json: polls < 2 ? { running: true, current: "SDXL/detail.safetensors", pct: 40, note: "sending SDXL/detail.safetensors - 40 %", done: [], failed: [] } : { running: false, done: [{ name: "SDXL/detail.safetensors", sent: true }], failed: [] } });
    });
    await p.route("**/api/models/check", async (r) => { checks++; return r.fulfill({ json: { checked: true, place: "pod", pod_id: "pod806", pod_name: "Pod 806", missing: [] } }); });
    const boxP = ev(() => window.H3ModelsFound.box({ checked: true, place: "pod", pod_id: "pod806", pod_name: "Pod 806", missing: [{ name: "SDXL/detail.safetensors", cat: "loras", folder: "models/loras", from: "style", here: true }] }, { kind: "aiedit", style_id: "x" }));
    await p.waitForSelector("#mfDlg[open]");
    const words = await ev(() => ({ h: document.querySelector("#mfDlg h2").textContent, go: document.getElementById("mfDownload").textContent }));
    check("a render on a pod with a LoRA it lacks: the box says Models not on Pod 806 and offers ⬆ Send to Pod 806", words.h === "Models not on Pod 806" && words.go === "⬆ Send to Pod 806", words);
    await p.click("#mfDownload");
    const okPod = await boxP;
    check("⬆ Send: the LoRA sent to that pod, checked again, the render goes on", okPod === true && sent && sent.pod_id === "pod806" && sent.items[0].name === "SDXL/detail.safetensors" && sent.items[0].cat === "loras" && checks >= 1, { okPod, sent, checks });
    await p.unroute("**/api/models/check");
    // 5 here: a LoRA found online -> ⬇ Download
    let fetched = null, fpolls = 0;
    await p.route("**/api/models/fetch", async (r) => {
      if (r.request().method() === "POST") { fetched = JSON.parse(r.request().postData() || "{}"); return r.fulfill({ json: { ok: true } }); }
      fpolls++; return r.fulfill({ json: fpolls < 2 ? { busy: true, files: { "detail.safetensors": { state: "run", got: 50, total: 100 } } } : { busy: false, files: { "detail.safetensors": { state: "ok", got: 100, total: 100 } } } });
    });
    await p.route("**/api/models/check", async (r) => r.fulfill({ json: { checked: true, missing: [] } }));
    const boxL = ev(() => window.H3ModelsFound.box({ checked: true, missing: [{ name: "detail.safetensors", cat: "loras", folder: "models/loras", from: "style", source: null, online: { from: "Civitai", size: 144000000, model: "Detail Tweaker" } }] }, { kind: "aiedit", style_id: "x" }));
    await p.waitForSelector("#mfDlg[open]");
    const lw = await ev(() => ({ go: document.getElementById("mfDownload").textContent, dis: document.getElementById("mfDownload").disabled, src: document.querySelector("#mfDlg .mfsrc").textContent }));
    check("here: a LoRA not in bitGen's list but found online - ⬇ Download offered (its size, where it was found)", !lw.dis && /⬇ Download/.test(lw.go) && /found on Civitai: Detail Tweaker/.test(lw.src), lw);
    await p.click("#mfDownload");
    const okL = await boxL;
    check("⬇ Download: fetched into this computer's models folders, checked again, the render goes on", okL === true && fetched && fetched.items[0].name === "detail.safetensors" && fetched.items[0].cat === "loras", { okL, fetched });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the browser part stopped - " + (e.stack || e.message)); }
  await br.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
