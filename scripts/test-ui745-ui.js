#!/usr/bin/env node
/* bitGen Studio — 2.745.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): BASIC SETTINGS ▸ GPU.
 * Tim (verbatim): "add a accordian menu item to basic settings - GPU - add checkboxes remote,local, both - if both, add
 * checkboxes - llm,vllm,image,video"
 *   - Basic Settings has a GPU accordion item: Remote · Local · Both; no remote GPU set up = only Local (and a button to
 *     Settings ▸ Remote GPU, which opens it);
 *   - Remote GPU's Use it -> GPU says Remote; Both -> LLM · Vision LLM · Image · Video + songs, ComfyUI's address back to
 *     this computer's; LLM / Vision LLM can only be ticked with a vLLM endpoint (Settings ▸ Remote GPU ▸ LLM on RunPod);
 *   - Both + Image: an image job renders on the endpoint (a stand-in RunPod on 8399 - the studio started with
 *     H3_RUNPOD_SLS_API=http://127.0.0.1:8399/v2), the image styles are filtered for it, the video styles are not;
 *   - Local: this computer, nothing filtered.
 * Put back afterwards. No server / no Playwright = SKIP. */
"use strict";
const path = require("path"), http = require("http"), fs = require("fs"), os = require("os");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.745.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.745.0 browser test did not run"); process.exit(0); }
  // a stand-in RunPod on 8399: a picture for every SaveImage
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "ui745-"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=green:s=64x64:d=1", "-frames:v", "1", path.join(TMP, "p.png")]);
  const runs = {}; let n = 0;
  const rp = http.createServer((q, s) => { let b = ""; q.on("data", (d) => { b += d; }); q.on("end", () => {
    const j = (o) => { s.writeHead(200, { "Content-Type": "application/json" }); s.end(JSON.stringify(o)); }; let m;
    if (q.url.endsWith("/run")) { const id = "j" + n++; runs[id] = JSON.parse(b).input; return j({ id, status: "IN_QUEUE" }); }
    if ((m = /status\/(\w+)/.exec(q.url))) { const w = runs[m[1]].workflow, images = [];
      for (const nd of Object.values(w)) if (nd && nd.class_type === "SaveImage") images.push({ filename: "pic_00001_.png", type: "base64", data: fs.readFileSync(path.join(TMP, "p.png")).toString("base64") });
      return j({ id: m[1], status: "COMPLETED", output: { images } }); }
    j({ workers: { idle: 1 }, jobs: {} });
  }); });
  const rpUp = await new Promise((r) => { rp.once("error", () => r(false)); rp.listen(8399, "127.0.0.1", () => r(true)); });
  const v0 = await api("/api/remotegpu"), g0 = await api("/api/gpusplit"), c0 = await api("/api/config");
  const madeRemote = [];
  await api("/api/remotegpu/use", { mode: "local" });
  await api("/api/remotegpu/save", { runpod: { key: "" }, serverless: { endpoint: "", comfy: "0.34.0", show_all: false } });
  await api("/api/gpusplit/vllm", { endpoint: "", model: "", vlm_endpoint: "", vlm_model: "" });
  // a remote GPU "never set up": forget the last one
  await fetch(URL0 + "api/remotegen/enabled", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: true }) }).catch(() => {});   // 2.754.0: the tab shows its parts only with Use remote generation ticked
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    const ready = async () => { await p.waitForFunction(() => window.H3GpuSplit && H3GpuSplit.state().v && document.getElementById("gpuWhere"), null, { timeout: 30000 }); await sleep(500); await ev(() => toggleSec("gpu", false)); };   // 2.747.0: closed by default
    const gpu = () => ev(() => ({ radios: [...document.querySelectorAll('input[name="gpuWhere"]')].map((i) => i.value + (i.checked ? "*" : "") + (i.disabled ? "-" : "")),
      boxes: document.getElementById("gpuBoxes").style.display, ticks: ["llm", "vlm", "image", "video"].map((k) => { const i = document.getElementById("gpu_" + k); return k + (i.checked ? "*" : "") + (i.disabled ? "-" : ""); }),
      line: document.getElementById("gpuLine").textContent, msg: document.getElementById("gpuMsg").textContent, setup: document.getElementById("gpuSetup").style.display !== "none",
      head: (document.querySelector('h2.sec.drop[data-sec="gpu"]') || {}).textContent, inBasic: !!document.querySelector("#sec-basic #sec-gpu") }));
    await p.goto(URL0); await ready();
    let G = await gpu();
    const rm0 = (await api("/api/gpusplit")).remote;
    check("Basic Settings ▸ GPU: an accordion item in Basic Settings with Local · Remote · Both (2.747.0: Local first)", /GPU( · \w+)?$/.test(G.head) && G.inBasic && G.radios.map((r) => r.replace(/[*-]/g, "")).join() === "local,remote,both", G);
    // 2.764.1: Local hides every remote detail (no ⚙ button here); Remote / Both can be picked - not set up = they wait
    if (!rm0) check("…no remote GPU set up: Local · Remote · Both all pickable (Remote / Both wait for a set-up), Local says \"Every job runs on this computer.\" with no remote options", G.radios.join() === "local*,remote,both" && G.line === "Every job runs on this computer." && !G.setup, G);
    else console.log("NOTE: this studio remembers a remote GPU (" + rm0.label + ") - the 'none set up' leg is skipped");
    if (G.setup) { await p.click("#gpuSetup"); await sleep(500); }
    check("…the button opens Settings ▸ Remote GPU", !G.setup || await ev(() => document.getElementById("settings").open && document.getElementById("stab-rgpu").classList.contains("active")));
    // set up RunPod Serverless in the tab and Use it
    await ev(() => { if (!document.getElementById("settings").open) document.getElementById("openSettings").onclick(); document.querySelector('#settings .stabs [data-stab="rgpu"]').click(); });
    await sleep(300);
    await p.check('#stab-rgpu input[name="rgmode"][value="serverless"]');
    await p.fill("#rgSlsKey", "rpa_UI745"); await p.fill("#rgEndpoint", "epui745"); await p.locator("#rgEndpoint").blur(); await sleep(400);
    const keys = await ev(() => [document.getElementById("rgKey").value, document.getElementById("rgVkey").value]);
    check("Remote GPU: the RunPod key typed once fills its other two boxes (pods, vLLM)", keys.join() === "rpa_UI745,rpa_UI745", keys);
    await p.click("#rgUse"); await sleep(1200);
    await ev(() => document.getElementById("settings").close());
    G = await gpu();
    check("…Use it -> Basic Settings ▸ GPU says Remote (all three can be chosen now), the line: everything on RunPod, the LLMs here (no vLLM endpoint)", G.radios.join() === "local,remote*,both"
      && /Image: RunPod Serverless epui745 · Video \+ songs: RunPod Serverless epui745 · LLM: this computer · Vision LLM: this computer/.test(G.line), G);
    // Both
    await p.check('input[name="gpuWhere"][value="both"]'); await sleep(1000);
    G = await gpu();
    let c = await api("/api/config");
    check("Both: LLM · Vision LLM · Image · Video + songs shown; LLM / Vision LLM can't be ticked (no vLLM endpoint); ComfyUI's address is this computer's again", G.boxes === "flex"
      && G.ticks.join() === "llm-,vlm-,image,video" && !/\/rpsl$/.test(c.engine.comfy.url) && c.rgpu.remote_mode === "serverless", { G, url: c.engine.comfy.url });
    await p.check("#gpu_image"); await sleep(1000);
    G = await gpu();
    check("…Image ticked: the line says Image on the endpoint, Video + songs here", /R_ styles: RunPod Serverless epui745 · other styles: this computer · no style - Image: RunPod Serverless epui745 · Video \+ songs: this computer/.test(G.line), G.line);
    const lists = await ev(() => ({ img: [...document.getElementById("styleSel").options].filter((o) => o.hidden).length, vid: [...document.getElementById("videoStyleSel").options].filter((o) => o.hidden).length,
      note: [...document.getElementById("styleSel").options].some((o) => o.dataset.rpsl === "note") }));
    // 2.746.0: Both lists every style (no remote styles here yet = nothing hidden)
    check("…Both lists every style (2.746.0 - the style decides where it renders)", lists.img === 0 && !lists.note && lists.vid === 0, lists);
    // an image job goes to the endpoint
    if (rpUp) {
      // 2.746.0: in Both the STYLE decides - Pony made a remote style (R_Pony, no endpoint of its own = the remote GPU's)
      // (2.749.0: Pony - R_SDXL is a ready-made starter, and a name is never used twice)
      const sty = (await api("/api/styles?kind=image")).styles.find((s) => s.name === "Pony");
      await api("/api/styles", { id: sty.id, kind: "image", runs_on: "remote" }); madeRemote.push(sty.id);
      const j = await api("/api/genimage", { prompt: "a green square", style_id: sty.id });
      let st = null; for (let i = 0; i < 60; i++) { await sleep(1000); st = await api("/api/jobs/" + j.id + "?log_from=0"); if (st.status === "done" || st.status === "failed") break; }
      const L = (st.log || []).join("\n");
      check("…a remote style's image job renders on the endpoint: its log says so, ComfyUI's address in it is the endpoint's, the picture comes back", st.status === "done" && /\[gpu\] this image job \(R_Pony - a remote style\) renders on RunPod Serverless epui745/.test(L)
        && /\/rpsl/.test(L) && Object.keys(runs).length >= 1, { status: st.status, log: L.split("\n").slice(-8) });
    } else console.log("SKIP: the image job leg - 8399 is busy");
    // vLLM: an endpoint makes LLM / Vision LLM tickable
    await api("/api/gpusplit/vllm", { endpoint: "llmep745" }); await ev(() => document.dispatchEvent(new Event("h3:rgpu"))); await sleep(800);
    G = await gpu();
    check("…with a vLLM endpoint (Settings ▸ Remote GPU ▸ LLM on RunPod) LLM and Vision LLM can be ticked", G.ticks.join() === "llm,vlm,image*,video", G.ticks);
    await p.check("#gpu_llm"); await sleep(800);
    G = await gpu();
    check("…LLM ticked: the line says LLM on RunPod vLLM", / LLM: RunPod vLLM · Vision LLM: this computer/.test(G.line), G.line);
    // Local
    await p.check('input[name="gpuWhere"][value="local"]'); await sleep(1000);
    G = await gpu(); c = await api("/api/config");
    const hid = await ev(() => [...document.getElementById("styleSel").options].filter((o) => o.hidden).length);
    // every hidden one a remote style - by id from the server (the page's label of one renamed through the API is still its old one)
    const remIds = ((await api("/api/styles?kind=image")).styles || []).filter((x) => x.runs_on === "remote").map((x) => x.id);
    const hidR = await ev((ids) => [...document.getElementById("styleSel").options].filter((o) => o.hidden && ids.includes(o.value)).length, remIds);
    const hidN = await ev(() => [...document.getElementById("styleSel").options].filter((o) => o.hidden).map((o) => o.textContent + (o.dataset.ieHide ? " (edit-only)" : "")));
    check("Local: everything on this computer, the boxes hidden, only the remote styles (R_Pony + the ready-made R_ ones) hidden", G.boxes === "none" && /Image: this computer · Video \+ songs: this computer · LLM: this computer/.test(G.line) && !/\/rpsl$/.test(c.engine.comfy.url) && hid === hidR && hid >= (madeRemote.length ? 1 : 0), { G, hid, hidR, hidN });
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close(); rp.close();
    await fetch(URL0 + "api/remotegen/enabled", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: null }) }).catch(() => {});   // 2.754.0: back to never chosen
    await api("/api/remotegpu/use", { mode: "local" }).catch(() => {});
    for (const id of madeRemote) await api("/api/styles", { id, kind: "image", runs_on: "local" }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: { key: (v0.runpod || {}).key || "" }, serverless: Object.assign({ endpoint: "", cost_hr: 0, comfy: "0.34.0", show_all: false }, v0.serverless || {}) }).catch(() => {});
    await api("/api/gpusplit/vllm", Object.assign({ endpoint: "", model: "", vlm_endpoint: "", vlm_model: "" }, g0.vllm || {})).catch(() => {});
    await api("/api/gpusplit", { where: "local", llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    if (v0.mode && v0.mode !== "local") await api("/api/remotegpu/use", { mode: v0.mode }).catch(() => {});
    if ((c0.engine || {}).comfy) await api("/api/config", { engine: { comfy: { url: c0.engine.comfy.url, autostart: c0.engine.comfy.autostart } } }).catch(() => {});
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
