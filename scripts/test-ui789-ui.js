#!/usr/bin/env node
/* bitGen Studio — 2.789.0 browser test: A TERMINATED POD'S FILES KEPT AS "NO_Pod (<old name>)/<file>" OR REMOVED, PICKING ONE
 * ASKS, A RENDER MAKES THE POD AGAIN FROM ITS RECIPE (lib/noPod.js, lib/podInv.js, routes/podInv.js, static/nopod.js) on a running
 * studio (H3_URL, default :8311) started with H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2 (this test's stand-in RunPod).
 * Tim (verbatim): "if pod is terminated ask user if they want to remove models from the list, if no, change the podname to
 * NO_Pod, but keep all the model details in a file so if user clicks a nopod/model name, the pod will be recreated and the models
 * uploaded to the new pod"
 * The pod's inventory is written as bitGen keeps it; the stand-in RunPod terminates it and records the pod made again (it never
 * loads - the render is cancelled). Put back afterwards. No server / no Playwright / 8399 busy = SKIP. */
"use strict";
const path = require("path"), http = require("http"), fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.789.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());
const DIR = path.join(__dirname, "..", "runpod", "pods"), POD = "pod789test", NAME = "Test pod", NEWID = "pod789again", POD2 = "pod789drop";
const FILE = "Models/krea2_mine.safetensors", PICK = "NO_Pod (" + NAME + ")/" + FILE;

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.789.0 browser test did not run"); process.exit(0); }
  const rec = (id, name) => ({ id, name, desiredStatus: "RUNNING", status: "RUNNING", costPerHr: 0.44, templateId: "runpod-torch-v280", gpu: { id: "NVIDIA A40", count: 1 }, cloudType: "SECURE", containerDiskInGb: 50, volumeInGb: 120, ports: ["8188/http"] });
  let PODS = [rec(POD, NAME), rec(POD2, "Drop pod")];
  const created = [];
  const rp = http.createServer((q, s) => {
    const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
    if (q.headers.authorization !== "Bearer rpa_UI789") return send(401, {});
    let body = ""; q.on("data", (d) => { body += d; });
    q.on("end", () => {
      if (q.method === "GET" && /^\/v2\/pods(\?|$)/.test(q.url)) return send(200, { pods: PODS });
      const act = /^\/v2\/pods\/(\w+)\/action$/.exec(q.url);
      if (q.method === "POST" && act) { const a = (JSON.parse(body || "{}") || {}).action; const p = PODS.find((x) => x.id === act[1]); if (a === "terminate") PODS = PODS.filter((x) => x.id !== act[1]); return send(200, p || {}); }
      if (q.method === "POST" && /^\/v2\/pods\/?$/.test(q.url)) { const b = JSON.parse(body || "{}"); created.push(b); const p = Object.assign(rec(NEWID, b.name || "again"), { desiredStatus: "RUNNING", status: "STARTING" }); PODS.push(p); return send(200, p); }
      const one = /^\/v2\/pods\/(\w+)$/.exec(q.url); if (one) { const p = PODS.find((x) => x.id === one[1]); return p ? send(200, p) : send(404, {}); }
      if (/^\/v2\/billing/.test(q.url)) return send(200, { records: [] });
      send(404, {});
    });
  });
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.789.0 browser test did not run"); process.exit(0); }
  fs.mkdirSync(DIR, { recursive: true });
  const inv = (id, name) => ({ v: 1, id, name, gone: false, at: Date.now(), listed_at: Date.now(), files: [
    { cat: "checkpoints", rel: FILE, size: 12e9, kind: "model", state: "on" }, { cat: "loras", rel: "krea_grain.safetensors", size: 2e8, kind: "lora", state: "on" }, { cat: "vae", rel: "ae.safetensors", size: 3e8, kind: "vae", state: "on" }] });
  fs.writeFileSync(path.join(DIR, POD + ".json"), JSON.stringify(inv(POD, NAME)));
  fs.writeFileSync(path.join(DIR, POD2 + ".json"), JSON.stringify(inv(POD2, "Drop pod")));
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI789", pod_id: "", port: 8188 } });
  const sts = ((await api("/api/styles?kind=image")).styles || []).filter((x) => x.engine === "comfy" && (!x.runs_on || x.runs_on === "local") && !x.chain);
  const st = sts.find((s) => s.arch === "krea2") || sts[0];
  const jobs = [];
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3NoPod && typeof loadComfyModels === "function", null, { timeout: 60000 });

    // terminate both through bitGen (the PODS docker's ✕ calls this)
    const t1 = await api("/api/pods/" + POD + "/terminate", {}), t2 = await api("/api/pods/" + POD2 + "/terminate", {});
    const asks = (await api("/api/podinv/asks")).asks || [];
    check("terminated through bitGen: both pods wait for your answer, with how they were made", t1.ok && t2.ok && asks.length === 2 && asks.some((a) => a.id === POD && /NVIDIA A40/.test(a.recipe_line) && a.count === 3), { t1, asks });

    // the question on screen
    await ev(() => H3NoPod.check());
    await p.waitForFunction(() => { const d = document.getElementById("npDlg"); return d && d.open && /was terminated/.test(d.textContent); }, null, { timeout: 10000 }).catch(() => {});
    const q1 = await ev(() => { const d = document.getElementById("npDlg"); return d && d.open ? d.textContent : ""; });
    const first = /Test pod was terminated/.test(q1) ? POD : POD2;
    check("the question: the pod, what it had (1 Model, 1 VAE, 1 LoRA), NO_Pod (<name>)/<file>, Keep / Remove", /was terminated/.test(q1) && /1 Model/.test(q1) && /1 LoRA/.test(q1) && /NO_Pod \(/.test(q1) && /Keep as NO_Pod/.test(q1) && /Remove from the lists/.test(q1), q1);
    // answer: keep Test pod, remove Drop pod (in whichever order they come)
    for (let i = 0; i < 2; i++) {
      await p.waitForFunction(() => { const d = document.getElementById("npDlg"); return d && d.open; }, null, { timeout: 10000 }).catch(() => {});
      const which = await ev(() => document.getElementById("npDlg").textContent);
      await ev((keep) => document.querySelector('#npDlg [data-npkeep="' + keep + '"]').click(), /Test pod was terminated/.test(which) ? "1" : "0");
      await sleep(800);
      if (i === 0) await ev(() => H3NoPod.check());
    }
    await sleep(800);
    const left = (await api("/api/podinv/asks")).asks || [], pods = (await api("/api/podinv")).pods || [];
    check("answered: Test pod kept as NO_Pod, Drop pod's inventory removed, nothing more asked", left.length === 0 && pods.some((x) => x.id === POD && x.keep && x.label === "NO_Pod (" + NAME + ")") && !pods.some((x) => x.id === POD2), { left, pods });

    // the lists
    const cm = await api("/api/comfymodels");
    const names = (c) => (((cm.categories || {})[c] || {}).files || []).map((f) => f.name);
    check("Basic Settings' lists: NO_Pod (Test pod)/<file> for its checkpoint + LoRA, nothing of Drop pod", names("checkpoints").includes(PICK) && names("loras").includes("NO_Pod (" + NAME + ")/krea_grain.safetensors") && !names("checkpoints").some((n) => /Drop pod/.test(n)), names("checkpoints"));

    // picking it asks first - Not now empties the field
    await ev(() => loadComfyModels(true));
    await sleep(800);
    const pickIt = () => ev((v) => { const s = document.querySelector("#imgCkptCombo .cmfile"); if (![...s.options].some((o) => o.value === v)) { const o = document.createElement("option"); o.value = v; s.appendChild(o); } s.value = v; s.dispatchEvent(new Event("change", { bubbles: true })); }, PICK);
    await pickIt();
    await p.waitForFunction(() => { const d = document.getElementById("npDlg"); return d && d.open && /Make .* again\?/.test(d.textContent); }, null, { timeout: 10000 }).catch(() => {});
    const q2 = await ev(() => { const d = document.getElementById("npDlg"); return d && d.open ? d.textContent : ""; });
    check("picking a NO_Pod file: the box shows the old pod's recipe and says RunPod charges", /Make Test pod again\?/.test(q2) && /NVIDIA A40/.test(q2) && /Secure cloud/.test(q2) && /volume 120 GB/.test(q2) && /charges/.test(q2), q2);
    await ev(() => document.querySelector('#npDlg [data-npmake="0"]').click());
    await sleep(500);
    check("Not now: the field emptied (the style's own checkpoint), nothing allowed", await ev(() => document.getElementById("imgCkpt").value) === "" && !((await api("/api/podinv/nopod?name=" + encodeURIComponent(PICK))).pod || {}).remake_ok);
    // a render with it now is refused with what to do
    const j0 = await api("/api/genimage", { prompt: "a red fox", style_id: st.id, model: PICK });
    jobs.push(j0.id);
    let jj0 = null; for (let i = 0; i < 30 && j0.id; i++) { jj0 = await api("/api/jobs/" + j0.id); if (jj0 && /Make the pod again/.test(JSON.stringify(jj0))) break; await sleep(400); }
    check("a render with the NO_Pod file before Make the pod again: refused, no pod made", /Make the pod again/.test(JSON.stringify(jj0 || {})) && created.length === 0, ((jj0 || {}).log || []).slice(-3));
    if (j0.id) await api("/api/jobs/" + j0.id + "/cancel", {}).catch(() => {});

    // Make the pod again
    await pickIt();
    await p.waitForFunction(() => { const d = document.getElementById("npDlg"); return d && d.open && /again\?/.test(d.textContent); }, null, { timeout: 10000 }).catch(() => {});
    await ev(() => document.querySelector('#npDlg [data-npmake="1"]').click());
    await sleep(600);
    check("Make the pod again: kept, the field keeps the NO_Pod file", ((await api("/api/podinv/nopod?name=" + encodeURIComponent(PICK))).pod || {}).remake_ok === true && await ev(() => document.getElementById("imgCkpt").value) === PICK);
    const j = await api("/api/genimage", { prompt: "a red fox", style_id: st.id, model: PICK });
    jobs.push(j.id);
    for (let i = 0; i < 60 && !created.length; i++) await sleep(400);
    const c0 = created[0] || {};
    check("the render makes the pod again the way it was made (template, GPU, count, cloud, disk, volume, its name)", created.length === 1 && c0.templateId === "runpod-torch-v280" && JSON.stringify(c0).includes("NVIDIA A40") && c0.cloud === "SECURE" && c0.disk === 50 && ((c0.mounts || {}).persistent || {}).size === 120 && /Test pod/.test(c0.name || ""), c0);
    await sleep(800);
    const pods2 = (await api("/api/podinv")).pods || [];
    const now = await api("/api/podinv/" + NEWID).catch(() => ({}));
    check("its inventory went over to the new pod (files ⏳ to put back), Test pod is no longer a NO_Pod", pods2.some((x) => x.id === NEWID && !x.gone) && !pods2.some((x) => x.id === POD) && now.inv && now.inv.remade_from === POD
      && (now.inv.groups || []).some((g) => g.files.some((f) => f.state === "todo")), { pods2, inv: now.inv });
    const cm2 = await api("/api/comfymodels");
    const n2 = (((cm2.categories || {}).checkpoints || {}).files || []).map((f) => f.name);
    check("the lists say Test pod/<file> again; the stored NO_Pod pick still finds the new pod", n2.includes(NAME + "/" + FILE) && !n2.includes(PICK)
      && (await api("/api/stylepods/route?mode=image&style_id=" + encodeURIComponent(st.id) + "&model=" + encodeURIComponent(PICK))).pod_id === NEWID, n2.filter((x) => /Test pod/.test(x)));
    check("no page errors", errs.length === 0, errs);
    // put Basic Settings back (its fields are kept in basic.cfg): the checkpoint emptied
    await ev(() => { const s = document.querySelector("#imgCkptCombo .cmfile"); if (s) { s.value = ""; s.dispatchEvent(new Event("change", { bubbles: true })); } const i = document.getElementById("imgCkpt"); if (i) { i.value = ""; i.dispatchEvent(new Event("change", { bubbles: true })); } });
    await sleep(1500);
  } catch (e) { check("the test crashed: " + e.message, false); }
  finally {
    for (const j of jobs) if (j) await api("/api/jobs/" + j + "/cancel", {}).catch(() => {});
    await b.close();
    await api("/api/remotegpu/save", { runpod: { key: "", pod_id: "", port: 8188 } }).catch(() => {});
    for (const id of [POD, POD2, NEWID]) { try { fs.unlinkSync(path.join(DIR, id + ".json")); } catch { /* gone */ } }
    try { fs.rmdirSync(DIR); fs.rmdirSync(path.dirname(DIR)); } catch { /* kept: others there */ }
    rp.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
