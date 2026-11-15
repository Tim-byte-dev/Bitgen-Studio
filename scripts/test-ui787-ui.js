#!/usr/bin/env node
/* bitGen Studio — 2.787.0 browser test: EACH POD'S INVENTORY, "<pod>/<file>" IN BASIC SETTINGS' LISTS, THE PICK DECIDES THE POD,
 * BASIC SETTINGS ▸ ☐ REMOTE + A POD (lib/podInv.js, lib/podPick.js, routes/podInv.js, static/remoteuse.js, static/podinv.js) on a
 * running studio (H3_URL, default :8311) started with H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2 (this test's stand-in RunPod).
 * Tim (verbatim): "the pod info will keep a list of styles and models + vae + textencoders in each pod" + "do the same for models
 * in pods, but use pod name/model name , also use the pods loras as pod name/lora name" + "in basic settings add a checkbox under
 * use model, "remote", so if user clicks a local model with this setting enabled bitgen will look for the model on civitai/hf and
 * upload to a selected pod (pod dropdown will be next remote checkbox, same with the loras"
 * The pod's inventory is written as bitGen keeps it (runpod/pods/<id>.json) - a stopped stand-in pod; renders are queued and
 * cancelled (no pod renders here). Put back afterwards. No server / no Playwright / 8399 busy = SKIP. */
"use strict";
const path = require("path"), http = require("http"), fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.787.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());
const DIR = path.join(__dirname, "..", "runpod", "pods"), POD = "pod787test", NAME = "Krea pod";

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.787.0 browser test did not run"); process.exit(0); }
  const PODS = [{ id: POD, name: NAME, desiredStatus: "EXITED", status: "EXITED", costPerHr: 0.44, gpu: { id: "NVIDIA A40", count: 1 }, ports: ["8188/http"] }];
  const rp = http.createServer((q, s) => {
    const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
    if (q.headers.authorization !== "Bearer rpa_UI787") return send(401, {});
    if (q.method === "GET" && /^\/v2\/pods(\?|$)/.test(q.url)) return send(200, { pods: PODS });
    if (q.method === "POST" && /^\/v2\/pods\/\w+\/action$/.test(q.url)) return send(200, PODS[0]);   // started through bitGen = one of bitGen's pods (My pods)
    const one = /^\/v2\/pods\/(\w+)$/.exec(q.url); if (one) { const p = PODS.find((x) => x.id === one[1]); return p ? send(200, p) : send(404, {}); }
    if (/^\/v2\/billing/.test(q.url)) return send(200, { records: [] });
    send(404, {});
  });
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.787.0 browser test did not run"); process.exit(0); }
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, POD + ".json"), JSON.stringify({ v: 1, id: POD, name: NAME, gone: false, at: Date.now(), listed_at: Date.now() - 3600000, files: [
    { cat: "checkpoints", rel: "Models/mine_v1.safetensors", size: 12e9, kind: "model", state: "on" },
    { cat: "loras", rel: "film_grain.safetensors", size: 2e8, kind: "lora", state: "on" },
    { cat: "vae", rel: "ae.safetensors", size: 3e8, kind: "vae", state: "on" },
    { cat: "text_encoders", rel: "qwen_3_4b.safetensors", size: 8e9, kind: "te", state: "sent" }] }));
  const u0 = await api("/api/basic-use"), e0 = await api("/api/remotegen");
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI787", pod_id: "", port: 8188 } });
  await api("/api/basic-use", { image_model: true, image_loras: true, image_model_pod: "", image_loras_pod: "", video_model_pod: "", video_loras_pod: "" });
  await api("/api/pods/" + POD + "/start", {});
  const sts = ((await api("/api/styles?kind=image")).styles || []).filter((x) => x.engine === "comfy" && (!x.runs_on || x.runs_on === "local") && !x.chain && x.kind !== "video" && x.kind !== "music");
  const st = sts[0];
  const jobs = [];
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    // the lists: /api/comfymodels has the pod's files ADDED
    const cm = await api("/api/comfymodels");
    const names = (c) => (((cm.categories || {})[c] || {}).files || []).map((f) => f.name);
    check("the model lists get the pod's checkpoints + LoRAs as <pod name>/<file> (pod_models), not its VAE / text encoders", cm.pod_models === true && names("checkpoints").includes(NAME + "/Models/mine_v1.safetensors") && names("loras").includes(NAME + "/film_grain.safetensors")
      && !(names("vae") || []).some((n) => n.startsWith(NAME + "/")), { ck: names("checkpoints").slice(-3), lo: names("loras").slice(-3) });
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3RemoteUse && window.H3PodInv && window.H3Pods && document.getElementById("imgCkptCombo") && document.querySelector("#imgCkptCombo .cmfile"), null, { timeout: 30000 });
    await p.waitForFunction((n) => [...document.querySelectorAll("#imgCkptCombo .cmfile option")].some((o) => o.value === n + "/Models/mine_v1.safetensors"), NAME, { timeout: 20000 }).catch(() => {});
    check("Basic Settings ▸ the picture Model list offers Krea pod/Models/mine_v1.safetensors (this computer's kept)", await ev((n) => { const o = [...document.querySelectorAll("#imgCkptCombo .cmfile option")].map((x) => x.value); return o.includes(n + "/Models/mine_v1.safetensors") && o.includes(""); }, NAME));
    const fold = await ev(() => [...document.querySelectorAll("#imgCkptCombo .cmfolder option")].map((o) => o.textContent));
    check("…the folder filter has the pod as a folder", fold.some((t) => /Krea pod/.test(t)), fold);
    // ☐ Remote + a pod under each Use … box
    await p.waitForFunction(() => document.querySelectorAll(".ruRow:not([hidden]) [data-rukey]").length === 4, null, { timeout: 15000 }).catch(() => {});
    const rows = await ev(() => [...document.querySelectorAll(".ruRow [data-rukey]")].map((c) => ({ k: c.dataset.rukey, under: c.closest(".ruRow").previousElementSibling && (c.closest(".ruRow").previousElementSibling.querySelector("input") || {}).id, opts: [...c.closest(".ruRow").querySelectorAll("option")].map((o) => o.textContent) })));
    const under = Object.fromEntries(rows.map((r) => [r.k, r.under]));
    check("☐ Remote + the pod list under Use model / Use temporary LoRAs (picture + video), the pod listed", rows.length === 4 && under.image_model_pod === "useImgModel" && under.image_loras_pod === "useImgLoras" && under.video_model_pod === "useVidModel" && under.video_loras_pod === "useVidLoras" && rows.every((r) => r.opts.includes(NAME)), rows);
    await ev(() => { const c = document.querySelector('[data-rukey="image_model_pod"]'); c.checked = true; c.dispatchEvent(new Event("change")); });
    await sleep(900);
    check("…ticked: kept (basic_use.image_model_pod = the pod)", (await api("/api/basic-use")).image_model_pod === POD);
    // the route check the page asks before starting this computer's ComfyUI
    const rt = await api("/api/stylepods/route?mode=image&style_id=" + encodeURIComponent(st.id) + "&model=" + encodeURIComponent(NAME + "/Models/mine_v1.safetensors"));
    check("the page's check: a <pod>/<file> pick goes to a pod (this computer's ComfyUI is not started)", rt.pod === true && rt.pod_id === POD, rt);
    const ck = await api("/api/models/check", { kind: "image", style_id: st.id, model: NAME + "/Models/mine_v1.safetensors" });
    check("models-found: not checked on this computer", /RunPod pod/.test(JSON.stringify(ck)), ck);
    // a render with the pod's checkpoint: the pod is picked, the name plain
    await api("/api/basic-use", { image_model_pod: "" });
    const j = await api("/api/genimage", { prompt: "a red fox", style_id: st.id, model: NAME + "/Models/mine_v1.safetensors", extra_loras: [{ name: NAME + "/film_grain.safetensors", strength: 0.8 }] });
    jobs.push(j.id);
    let jj = null;
    for (let i = 0; i < 40 && j.id; i++) { jj = await api("/api/jobs/" + j.id); if (jj && /\[pod\] (renders on the pod|the picked)/.test(JSON.stringify(jj.log || []))) break; await sleep(400); }
    const log = JSON.stringify((jj && jj.log) || []);
    check("a picture with Krea pod/…: the Queue says it renders on that pod - picked file + LoRA", /\[pod\] renders on the pod Krea pod - picked Krea pod\/Models\/mine_v1\.safetensors, Krea pod\/film_grain\.safetensors/.test(log), (jj && jj.log || []).slice(-5));
    const prm = (jj && jj.params) || {};
    const pst = prm.style || {};
    check("…the job's style has the plain names ComfyUI lists on the pod", !prm.style || (pst.model === "Models/mine_v1.safetensors" && (pst.loras || []).some((l) => (l.name || l.path) === "film_grain.safetensors")), { model: pst.model, loras: pst.loras });
    if (j.id) await api("/api/jobs/" + j.id + "/cancel", {});
    // ☐ Remote: a model of this computer goes to the pod
    await api("/api/basic-use", { image_model_pod: POD });
    const j2 = await api("/api/genimage", { prompt: "a red fox", style_id: st.id, model: "some_local_model.safetensors" });
    jobs.push(j2.id);
    let j2j = null;
    for (let i = 0; i < 40 && j2.id; i++) { j2j = await api("/api/jobs/" + j2.id); if (j2j && /\[pod\] renders on the pod/.test(JSON.stringify(j2j.log || []))) break; await sleep(400); }
    check("☐ Remote ticked + a model of this computer: the render goes to that pod (the model put on it first)", /\[pod\] renders on the pod Krea pod - Basic Settings ▸ Use model ▸ Remote \(Krea pod\)/.test(JSON.stringify((j2j && j2j.log) || [])), (j2j && j2j.log || []).slice(-4));
    if (j2.id) await api("/api/jobs/" + j2.id + "/cancel", {});
    // PODS ▸ My pods ▸ 🗂 Inventory (a stopped pod)
    await ev(() => H3Pods.show(true)); await sleep(800);
    await p.click('[data-pdsrc="mine"]').catch(() => {});
    await p.waitForSelector('#pdPods .pdRow[data-pod="' + POD + '"]', { timeout: 15000 }).catch(() => {});
    await p.click('#pdPods .pdRow[data-pod="' + POD + '"] .pdHead').catch(() => {}); await sleep(800);
    await p.click('#pdPods .pdRow[data-pod="' + POD + '"] [data-pdinv]').catch(() => {});
    await p.waitForFunction(() => /🗂/.test((document.getElementById("pdStyPanel") || {}).textContent || ""), null, { timeout: 10000 }).catch(() => {});
    const pan = await ev(() => ({ t: (document.getElementById("pdStyPanel") || {}).textContent || "", groups: [...document.querySelectorAll("#pdStyPanel [data-pikind]")].map((g) => g.dataset.pikind), refresh: !!document.querySelector("#pdStyPanel [data-pirefresh]") }));
    check("PODS ▸ 🗂 Inventory on a stopped pod: Models / VAE / Text encoders / LoRAs, sizes, ⇪ for a file bitGen sent, the <pod>/<file> line, no ⟳ (it is stopped)",
      pan.groups.join() === "model,vae,te,lora" && /12\.0 GB/.test(pan.t) && /⇪/.test(pan.t) && /Krea pod\/<file>/.test(pan.t) && !pan.refresh, pan);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    for (const j of jobs) if (j) await api("/api/jobs/" + j + "/cancel", {}).catch(() => {});
    rp.close();
    try { fs.unlinkSync(path.join(DIR, POD + ".json")); } catch { /* gone */ }
    await api("/api/basic-use", { image_model: u0.image_model !== false, image_loras: u0.image_loras !== false, image_model_pod: u0.image_model_pod || "", image_loras_pod: u0.image_loras_pod || "", video_model_pod: u0.video_model_pod || "", video_loras_pod: u0.video_loras_pod || "" }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: { key: "", pod_id: "", port: 8188 } }).catch(() => {});
    await api("/api/remotegen/enabled", { on: e0.enabled === undefined ? null : !!e0.enabled }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
