#!/usr/bin/env node
/* bitGen Studio — 2.793.0 browser test: NO_Pod PART 2 - a terminated pod's file picked in Basic Settings says WHICH of your pods
 * has it ("Start that pod" / "Use that pod") and offers the others (running first, stopped ones "starts it", what each would be
 * sent); the pick then reads "<pod name>/<file>" and only what that pod lacks goes on it (lib/noPodWhere.js, lib/noPod.js useOn,
 * routes/podInv.js, static/nopod.js) - on a running studio (H3_URL, default :8311) started with
 * H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2 + H3_RUNPOD_PROXY (this test's stand-in RunPod).
 * Tim (verbatim): "also ask the user if the model + vae + textencoder should be added to an existing pod. show user running pods
 * and stopped pods. check if the files exist, only upload necessary files that don't exist on the pod" + "if user chooses new pod
 * or uses an existing one then change the name of the model to pod name/model name ... advise the user of which pod has it and ask
 * if it should start that pod, create a new pod or add the model to a different pod"
 * The inventories are written as bitGen keeps them (runpod/pods/<id>.json); the stand-in RunPod lists the pods and records
 * ▶ start. Put back afterwards. No server / no Playwright / 8399 busy = SKIP. */
"use strict";
const path = require("path"), http = require("http"), fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.793.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());
const DIR = path.join(__dirname, "..", "runpod", "pods");
const OLD = "pod793old", HAS = "pod793has", RUN = "pod793run", STOP = "pod793stop", OLDNAME = "SDXL pod";
const A = "SDXL/juggernautXL_v9.safetensors", B = "SDXL/ponyRealism_v22.safetensors";
const PICK_A = "NO_Pod (" + OLDNAME + ")/" + A, PICK_B = "NO_Pod (" + OLDNAME + ")/" + B;

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.793.0 browser test did not run"); process.exit(0); }
  const rec = (id, name, st, gpu) => ({ id, name, desiredStatus: st, status: st, costPerHr: 0.44, templateId: "runpod-torch-v280", gpu: { id: gpu, count: 1 }, cloudType: "SECURE", containerDiskInGb: 50, volumeInGb: 120, ports: ["8188/http"] });
  const PODS = [rec(HAS, "SDXL-2", "EXITED", "NVIDIA GeForce RTX 4090"), rec(RUN, "Krea pod", "RUNNING", "NVIDIA A40"), rec(STOP, "Small", "EXITED", "NVIDIA RTX A4000")];
  const actions = [];
  const rp = http.createServer((q, s) => {
    const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
    if (!/^\/v2\//.test(q.url)) return send(404, {});          // the pods' own proxy addresses: not answering (bitGen keeps what it saw)
    if (q.headers.authorization !== "Bearer rpa_UI793") return send(401, {});
    let body = ""; q.on("data", (d) => { body += d; });
    q.on("end", () => {
      if (q.method === "GET" && /^\/v2\/pods(\?|$)/.test(q.url)) return send(200, { pods: PODS });
      const act = /^\/v2\/pods\/(\w+)\/(action|start|stop)$/.exec(q.url);
      if (q.method === "POST" && act) { const a = act[2] === "action" ? (JSON.parse(body || "{}") || {}).action : act[2]; actions.push([act[1], a]); const p = PODS.find((x) => x.id === act[1]); if (p && a === "start") { p.desiredStatus = "RUNNING"; p.status = "STARTING"; } return send(200, p || {}); }
      const one = /^\/v2\/pods\/(\w+)$/.exec(q.url); if (one) { const p = PODS.find((x) => x.id === one[1]); return p ? send(200, p) : send(404, {}); }
      if (/^\/v2\/billing/.test(q.url)) return send(200, { records: [] });
      send(404, {});
    });
  });
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.793.0 browser test did not run"); process.exit(0); }
  fs.mkdirSync(DIR, { recursive: true });
  const f = (cat, rel, size, kind) => ({ cat, rel, size, kind, state: "on" });
  const fA = f("checkpoints", A, 6.9e9, "model"), fB = f("checkpoints", B, 6.5e9, "model"), vae = f("vae", "sdxl_vae.safetensors", 3.3e8, "vae"), te = f("text_encoders", "clip_l.safetensors", 2.4e8, "te"), lora = f("loras", "grain.safetensors", 1.5e8, "lora");
  const write = (o) => fs.writeFileSync(path.join(DIR, o.id + ".json"), JSON.stringify(Object.assign({ v: 1, at: Date.now(), listed_at: Date.now() }, o)));
  write({ id: OLD, name: OLDNAME, gone: true, keep: true, gone_at: Date.now(), recipe: { template_id: "runpod-torch-v280", template_name: "RunPod Pytorch 2.8.0", gpu: "NVIDIA RTX 4090", count: 1, cloud: "SECURE", disk: 50, volume: 120, port: 8188 }, files: [fA, fB, vae, te, lora] });
  write({ id: HAS, name: "SDXL-2", files: [Object.assign({}, fA, { rel: "juggernautXL_v9.safetensors" }), vae, te] });
  write({ id: RUN, name: "Krea pod", files: [Object.assign({}, vae, { rel: "SDXL/sdxl_vae.safetensors" })], disk: { free: 4e11, total: 5e11 } });
  write({ id: STOP, name: "Small", files: [] });
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI793", pod_id: "", port: 8188 } });
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (fn, a) => p.evaluate(fn, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3NoPod && typeof loadComfyModels === "function", null, { timeout: 60000 });
    // static/stylebasic.js puts the last style's Basic Settings back ~4 s after load (it would overwrite the picks below)
    await p.waitForFunction(() => performance.now() > 6500, null, { timeout: 30000 });
    const cm = await api("/api/comfymodels"), names = (((cm.categories || {}).checkpoints || {}).files || []).map((x) => x.name);
    check("the NO_Pod's two checkpoints are in Basic Settings' lists", names.includes(PICK_A) && names.includes(PICK_B), names.filter((n) => /NO_Pod|SDXL-2|Krea pod/.test(n)));
    const pick = (v) => ev((x) => { const s = document.querySelector("#imgCkptCombo .cmfile"); if (![...s.options].some((o) => o.value === x)) { const o = document.createElement("option"); o.value = x; s.appendChild(o); } s.value = x; s.dispatchEvent(new Event("change", { bubbles: true })); }, v);
    const boxText = () => ev(() => { const d = document.getElementById("npDlg"); return d && d.open ? d.textContent : ""; });
    const waitBox = (rx) => p.waitForFunction((r) => { const d = document.getElementById("npDlg"); return d && d.open && new RegExp(r).test(d.textContent); }, rx, { timeout: 30000 }).catch(() => {});

    // ---- A: a stopped pod has it
    await ev(() => loadComfyModels(true)); await sleep(800);
    await pick(PICK_A);
    await waitBox("This pod has it");
    const qa = await boxText();
    check("picking a NO_Pod file: the box names the pod that has it (stopped - starts it, everything is there) with Start that pod", /juggernautXL_v9\.safetensors was on NO_Pod \(SDXL pod\)/.test(qa) && /This pod has it/.test(qa) && /SDXL-2/.test(qa) && /stopped - starts it/.test(qa) && /everything is there/.test(qa)
      && await ev(() => !!document.querySelector('#npDlg [data-npuse="pod793has"]') && /Start that pod/.test(document.querySelector('#npDlg [data-npuse="pod793has"]').textContent)), qa);
    check("…and the other pods (running first), what each would be sent, Make the pod again with its recipe", /Or put it on another pod/.test(qa) && qa.indexOf("Krea pod") < qa.indexOf("Small") && /sdxl_vae\.safetensors there, sends 7\.1 GB/.test(qa)
      && /It renders with sdxl_vae\.safetensors \+ clip_l\.safetensors/.test(qa) && /RunPod Pytorch 2\.8\.0/.test(qa) && /Make the pod again/.test(qa), qa);
    await ev(() => document.querySelector('#npDlg [data-npuse="pod793has"]').click());
    for (let i = 0; i < 40 && await ev(() => { const d = document.getElementById("npDlg"); return !!(d && d.open); }); i++) await sleep(250);
    await sleep(600);
    const vA = await ev(() => document.getElementById("imgCkpt").value);
    check("Start that pod: RunPod asked to start it; the pick now reads '<pod name>/<file>' (the pod's own folder)", actions.some((x) => x[0] === HAS && x[1] === "start") && vA === "SDXL-2/juggernautXL_v9.safetensors", { actions, vA });
    const has = await api("/api/podinv/" + HAS);
    check("nothing sent to a pod that has the file, its VAE and text encoder", has.inv && (has.inv.groups || []).every((g) => g.files.every((x) => x.state !== "todo")), has.inv && has.inv.groups);

    // ---- B: nobody has it -> onto the running pod; only what it lacks
    await pick(PICK_B);
    await waitBox("Put it on one of your pods");
    const qb = await boxText();
    check("a file no pod has: 'Put it on one of your pods' - running first, stopped ones say they start", /Put it on one of your pods/.test(qb) && !/have it/.test(qb) && qb.indexOf("Krea pod") < qb.indexOf("SDXL-2") && /running/.test(qb) && /stopped - starts it/.test(qb), qb);
    check("the running pod is picked first", await ev(() => (document.querySelector('#npDlg input[name="npPod"]:checked') || {}).value) === RUN);
    await ev(() => document.querySelector('#npDlg [data-npusesel="1"]').click());
    for (let i = 0; i < 40 && await ev(() => { const d = document.getElementById("npDlg"); return !!(d && d.open); }); i++) await sleep(250);
    await sleep(600);
    const vB = await ev(() => document.getElementById("imgCkpt").value);
    check("Use this pod: the pick reads 'Krea pod/<file>'", vB === "Krea pod/" + B, vB);
    const run = await api("/api/podinv/" + RUN), todo = [];
    for (const g of (run.inv || {}).groups || []) for (const x of g.files) if (x.state === "todo") todo.push(g.kind + ":" + x.rel);
    check("only what the running pod lacks is put on it: the model + text encoder (its VAE in another folder used)", todo.sort().join() === ["model:" + B, "te:clip_l.safetensors"].sort().join(), todo);
    check("RunPod was not asked to start the running pod", !actions.some((x) => x[0] === RUN));
    const cm2 = await api("/api/comfymodels"), n2 = (((cm2.categories || {}).checkpoints || {}).files || []).map((x) => x.name);
    check("the lists: 'SDXL-2/…' + 'Krea pod/…' for the two files, no NO_Pod name left for them", n2.includes("SDXL-2/juggernautXL_v9.safetensors") && n2.includes("Krea pod/" + B) && !n2.includes(PICK_A) && !n2.includes(PICK_B), n2.filter((n) => /NO_Pod|SDXL-2|Krea pod/.test(n)));
    const old = await api("/api/podinv/" + OLD);
    check("the NO_Pod keeps what it still has (its LoRA, VAE, text encoder), not the two models", old.inv && old.inv.label === "NO_Pod (" + OLDNAME + ")" && !(old.inv.groups || []).some((g) => g.kind === "model"), old.inv && old.inv.groups);
    await sleep(1500);
    const basic = await api("/api/layout/basic");
    check("Basic Settings' saved checkpoint is the new name (basic.cfg)", JSON.stringify(basic).includes("Krea pod/" + B) && !JSON.stringify(basic).includes("NO_Pod (" + OLDNAME + ")"), basic && basic.all ? basic.all.imgCkpt : basic);
    check("no page errors", errs.length === 0, errs);
    // put Basic Settings back: the checkpoint emptied
    await ev(() => { const s = document.querySelector("#imgCkptCombo .cmfile"); if (s) { s.value = ""; s.dispatchEvent(new Event("change", { bubbles: true })); } const i = document.getElementById("imgCkpt"); if (i) { i.value = ""; i.dispatchEvent(new Event("change", { bubbles: true })); } });
    await sleep(6000);          // basic.cfg + the style's saved Basic Settings (static/stylebasic.js, every 5 s) take the empty field
  } catch (e) { check("the test crashed: " + e.message, false); }
  finally {
    await b.close();
    await api("/api/remotegpu/save", { runpod: { key: "", pod_id: "", port: 8188 } }).catch(() => {});
    for (const id of [OLD, HAS, RUN, STOP]) { try { fs.unlinkSync(path.join(DIR, id + ".json")); } catch { /* gone */ } }
    try { fs.rmdirSync(DIR); fs.rmdirSync(path.dirname(DIR)); } catch { /* kept: others there */ }
    rp.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
