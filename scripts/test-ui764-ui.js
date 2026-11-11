#!/usr/bin/env node
/* bitGen Studio — 2.764.0 browser test: 🖥 PODS ▸ 📦 PRESETS + THE "NO POD" BOX (static/podpresets.js, static/podpick.js,
 * lib/podPresets.js) on a running studio (H3_URL, default :8311) started with H3_RUNPOD_REST_API=http://127.0.0.1:8399/v2.
 * Tim (verbatim): "if a user clicks a style that is not assigned to a pod bring up a dialog with my pods and a + style button
 * ... add a create pod button ... in pods docker add a presets tab ... display the presets as accordian items ... allow user to
 * edit details , remove styles, add styles to preset. in the menu item titlebar show a play button a stop button and a delete
 * button(delete button terminates the pod) icon only ... show cost/hr, hrs used and total cost" + "delete should only terminate
 * the pod x should delete the preset. dialog should only appear when u press generate"
 * A stand-in RunPod on 8399; the box's question is answered in the page (route). Put back afterwards. No server / no
 * Playwright / 8399 busy = SKIP. */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.764.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
const ROOT = path.join(__dirname, "..");
const PDIR = path.join(ROOT, "runpod", "pods", "presets");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b, m) => fetch(URL0 + p.replace(/^\//, ""), b || m ? { method: m || "POST", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined } : undefined).then((r) => r.json());
const pf = (n) => path.join(PDIR, n + ".pod");

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.764.0 browser test did not run"); process.exit(0); }
  const PODS = [{ id: "pod764a", name: "Busy pod", desiredStatus: "RUNNING", status: "RUNNING", costPerHr: 0.44, gpu: { id: "NVIDIA A40", count: 1 }, ports: ["8188/http"], templateId: "tplCu13u", startedAt: new Date(Date.now() - 90 * 60000).toISOString() },
    { id: "pod764b", name: "Spare pod", desiredStatus: "EXITED", status: "EXITED", costPerHr: 0.69, gpu: { id: "NVIDIA GeForce RTX 4090", count: 1 }, ports: ["8188/http"], templateId: "tplCu13u", containerDiskInGb: 40, volumeInGb: 80 }];
  const acts = [];
  const rp = http.createServer((q, s) => {
    let b = ""; q.on("data", (d) => { b += d; }); q.on("end", () => {
      const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
      if (/^\/proxy\//.test(q.url)) return send(502, {});
      if (q.headers.authorization !== "Bearer rpa_UI764") return send(401, {});
      if (q.method === "GET" && /^\/v2\/pods(\?|$)/.test(q.url)) return send(200, { pods: PODS });
      const one = /^\/v2\/pods\/(\w+)$/.exec(q.url); if (one && q.method === "GET") { const p = PODS.find((x) => x.id === one[1]); return p ? send(200, p) : send(404, {}); }
      const ac = /^\/v2\/pods\/(\w+)\/action$/.exec(q.url);
      if (ac && q.method === "POST") { const a = JSON.parse(b || "{}").action; acts.push(ac[1] + ":" + a); const i = PODS.findIndex((x) => x.id === ac[1]); if (i < 0) return send(404, {}); if (a === "terminate") { PODS.splice(i, 1); s.writeHead(204); return s.end(); } PODS[i].status = PODS[i].desiredStatus = a === "stop" ? "EXITED" : "RUNNING"; return send(200, PODS[i]); }
      if (/^\/v2\/catalog\/templates/.test(q.url)) return send(200, { templates: q.url.includes("official") ? [{ id: "tplCu13u", name: "ComfyUI CUDA 13", image: "runpod/comfyui:cuda13", ports: ["8188/http", "8888/http"] }] : [], pagination: { hasNextPage: false } });
      if (/^\/v2\/catalog\/gpus/.test(q.url)) return send(200, { gpus: [{ id: "NVIDIA A40", name: "A40", memory: 48, price: { secure: 0.44, community: 0.35 }, availability: "NONE", secure: true, community: true },
        { id: "NVIDIA RTX A6000", name: "RTX A6000", memory: 48, price: { secure: 0.49, community: 0.33 }, availability: "HIGH", secure: true, community: true },
        { id: "NVIDIA GeForce RTX 4090", name: "RTX 4090", memory: 24, price: { secure: 0.69, community: 0.34 }, availability: "HIGH", secure: true, community: true }] });
      if (/^\/v2\/billing\/pods/.test(q.url)) return send(200, { records: [], metadata: {} });
      send(404, {});
    });
  });
  try { await new Promise((ok, bad) => { rp.once("error", bad); rp.listen(8399, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8399 is busy - the 2.764.0 browser test did not run"); process.exit(0); }
  const g0 = await api("/api/gpusplit"), links0 = (await api("/api/stylepods")).links || {};
  await api("/api/remotegpu/save", { runpod: { key: "rpa_UI764", pod_id: "", port: 8188 }, serverless: { endpoint: "" } });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/gpusplit", { where: "remote", engine: { provider: "runpod", runpod: "pods" } });
  await api("/api/pods/costs?refresh=1").catch(() => {});
  const sts = ((await api("/api/styles?kind=image")).styles || []).filter((x) => x.engine === "comfy" && (!x.runs_on || x.runs_on === "local") && !x.chain);
  const st1 = sts[0], st2 = sts[1] || sts[0];
  fs.mkdirSync(PDIR, { recursive: true });
  const P1 = "UI764 Busy", P2 = "UI764 Gone";
  const base = { template_id: "tplCu13u", template_name: "ComfyUI CUDA 13", cloud: "SECURE", disk: 50, volume: 100, cuda: "13.0", port: 8188, kinds: ["image"], made_at: new Date().toISOString() };
  fs.writeFileSync(pf(P1), JSON.stringify(Object.assign({}, base, { name: P1, gpu: "NVIDIA A40", gpu_name: "A40", count: 1, styles: [st1.id], pod_id: "pod764a", runs: [{ pod: "podOLD1", from: Date.now() - 10 * 3600000, to: Date.now() - 8 * 3600000, rate: 0.5 }] })));
  fs.writeFileSync(pf(P2), JSON.stringify(Object.assign({}, base, { name: P2, gpu: "NVIDIA A40", gpu_name: "A40", count: 1, styles: [st2.id], pod_id: "podGONE1", runs: [] })));
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3Pods && window.H3PodPresets && window.H3PodPick && window.SecFloat && SecFloat.windows.pods, null, { timeout: 30000 });
    await ev(() => { H3Pods.show(true); SecFloat.windows.pods.panel.float(120, 40, 900, 900); });
    await sleep(600);
    await p.click('[data-pdsrc="presets"]');
    await p.waitForFunction((n) => document.querySelector('[data-pp="' + n + '"] .ppChip'), P2, { timeout: 20000 });
    await p.waitForFunction((n) => /running/.test((document.querySelector('[data-pp="' + n + '"] .ppChip') || {}).textContent || ""), P1, { timeout: 15000 }).catch(() => {});
    const h1 = await ev((n) => { const it = document.querySelector('[data-pp="' + n[0] + '"]'), it2 = document.querySelector('[data-pp="' + n[1] + '"]');
      const ic = (x) => [...x.querySelectorAll(".ppIcons button")].map((b) => b.textContent + (b.disabled ? "-" : "+") + "|" + b.getAttribute("aria-label"));
      return { chip: it.querySelector(".ppChip").textContent, rate: (it.querySelector(".ppRate") || {}).textContent || "", ic: ic(it), chip2: it2.querySelector(".ppChip").textContent, ic2: ic(it2), tab: document.querySelector('[data-pdsrc="presets"]').textContent, tpl: getComputedStyle(document.getElementById("pdTpl")).display }; }, [P1, P2]);
    check("📦 Presets tab: accordion items from runpod/pods/presets (the template list hidden)", /Presets/.test(h1.tab) && h1.tpl === "none" && !!h1.chip2, h1);
    check("…title bar: running, $0.44/h, icon-only ▶ (off while it runs) ⏹ 🗑 ✕ - each named for screen readers", h1.chip === "running" && /0\.44/.test(h1.rate) && h1.ic.map((x) => x.split("|")[0]).join() === "▶-,⏹+,🗑+,✕+" && h1.ic.every((x) => /\|(Start|Stop|Terminate the pod of|Delete the preset) /.test(x)), h1);
    check("…a preset whose pod was terminated: terminated, ▶ on, ⏹ / 🗑 off", h1.chip2 === "terminated" && h1.ic2.map((x) => x.split("|")[0]).join() === "▶+,⏹-,🗑-,✕+", h1);
    // open it: every detail, cost/hr, hours, total
    await p.click('[data-pp="' + P1 + '"] .ppTog'); await sleep(1500);
    const d1 = await ev((n) => { const it = document.querySelector('[data-pp="' + n + '"]'), v = (s) => (it.querySelector(s) || {}).value;
      return { name: v('[data-ppf="name"]'), gpu: v('[data-ppf="gpu"]'), count: v('[data-ppf="count"]'), vol: v('[data-ppf="volume"]'), cloud: v('[data-ppf="cloud"]'), tpl: v('[data-ppf="template_id"]'), cuda: it.querySelector('[data-ppf="cuda"]').checked,
        kind: it.querySelector('[data-ppkind="image"]').checked, sty: [...it.querySelectorAll(".ppSty [data-ppsrm]")].map((b) => b.dataset.ppsrm), run: it.querySelector(".ppRun").textContent, hrs: it.querySelector("[data-pphours]").textContent, tot: it.querySelector("[data-pptotal]").textContent }; }, P1);
    check("opened: every detail editable - name, template, cloud, GPU, GPUs, disks, CUDA 13, kinds, its styles", d1.name === P1 && d1.gpu === "NVIDIA A40" && d1.count === "1" && d1.vol === "100" && d1.cloud === "SECURE" && d1.tpl === "tplCu13u" && d1.cuda && d1.kind && d1.sty.join() === st1.id, d1);
    check("…under the details: the pod, cost / hour, hours used (2 h before + 1.5 h now = 3 h 30 min), total cost (1.00 + 0.66)", /Busy pod/.test(d1.run) && /0\.44/.test(d1.run) && /^3 h 3\d min$/.test(d1.hrs) && /\$1\.6\d/.test(d1.tot), d1);
    // add a style, save -> the file + the pod's links
    if (st2.id !== st1.id) {
      await p.selectOption('[data-pp="' + P1 + '"] [data-ppsadd]', st2.id); await sleep(300);
      await p.click('[data-pp="' + P1 + '"] [data-ppsave]'); await sleep(1500);
      const f1 = JSON.parse(fs.readFileSync(pf(P1), "utf8")), l1 = (await api("/api/stylepods")).links || {};
      check("＋ Add a style + 💾 Save: in the .pod file, and on the running pod (linked)", f1.styles.join() === [st1.id, st2.id].join() && l1[st2.id] === "pod764a", { f: f1.styles, l: l1[st2.id] });
      await p.click('[data-pp="' + P1 + '"] [data-ppsrm="' + st2.id + '"]'); await sleep(200);
      await p.click('[data-pp="' + P1 + '"] [data-ppsave]'); await sleep(1500);
      const f2 = JSON.parse(fs.readFileSync(pf(P1), "utf8")), l2 = (await api("/api/stylepods")).links || {};
      check("…✕ on a style + Save: off the preset and off the pod", f2.styles.join() === st1.id && !l2[st2.id], { f: f2.styles, l: l2[st2.id] });
    } else check("(one style only here - add / remove not tried)", true);
    // edit a detail -> saved
    await p.fill('[data-pp="' + P1 + '"] [data-ppf="volume"]', "180"); await p.click('[data-pp="' + P1 + '"] [data-ppsave]'); await sleep(1200);
    check("a detail edited + Save: in the file (/workspace 180 GB)", JSON.parse(fs.readFileSync(pf(P1), "utf8")).volume === 180);
    // ▶ on the terminated preset: its GPU is not free -> pick one with as much memory
    await p.click('[data-pp="' + P2 + '"] [data-ppplay]');
    await p.waitForFunction((n) => document.querySelector('[data-pp="' + n + '"] [data-ppneed]'), P2, { timeout: 15000 }).catch(() => {});
    const nd = await ev((n) => { const s = document.querySelector('[data-pp="' + n + '"] [data-ppneed]'); return s ? [...s.options].map((o) => o.value) : null; }, P2);
    check("▶ on a terminated preset whose GPU (A40) is not free: the GPUs with as much memory or more to pick (RTX A6000), nothing made yet", nd && nd.join() === "NVIDIA RTX A6000" && !PODS.some((x) => /bitGen/.test(x.name)), nd);
    await p.click('[data-pp="' + P2 + '"] [data-ppneedno]'); await sleep(200);
    // 🗑 = terminate (asks), the preset stays
    await p.click('[data-pp="' + P1 + '"] [data-ppkill]'); await sleep(200);
    const q1 = await ev((n) => (document.querySelector('[data-pp="' + n + '"] .ppAsk') || {}).textContent || "", P1);
    await p.click('[data-pp="' + P1 + '"] [data-ppyes]');
    await p.waitForFunction((n) => /terminated/.test((document.querySelector('[data-pp="' + n + '"] .ppChip') || {}).textContent || ""), P1, { timeout: 15000 }).catch(() => {});
    const k1 = await ev((n) => document.querySelector('[data-pp="' + n + '"] .ppChip').textContent, P1);
    check("🗑 asks first, then TERMINATES the pod - the preset stays (terminated, ▶ makes it again)", /Terminate/.test(q1) && /preset stays/.test(q1) && acts.includes("pod764a:terminate") && fs.existsSync(pf(P1)) && k1 === "terminated", { q1, acts, k1 });
    // ✕ = delete the preset (asks)
    await p.click('[data-pp="' + P2 + '"] [data-ppdel]'); await sleep(200);
    const q2 = await ev((n) => (document.querySelector('[data-pp="' + n + '"] .ppAsk') || {}).textContent || "", P2);
    await p.click('[data-pp="' + P2 + '"] [data-ppyes]'); await sleep(1500);
    check("✕ asks first, then DELETES the preset file (nothing terminated)", /Delete the preset/.test(q2) && !fs.existsSync(pf(P2)) && !(await ev((n) => !!document.querySelector('[data-pp="' + n + '"]'), P2)) && acts.filter((a) => /terminate/.test(a)).length === 1, { q2, acts });
    // 💾 Save as preset on a pod in My pods
    await p.click('[data-pdsrc="mine"]');
    await p.waitForFunction(() => document.querySelector('#pdPods .pdRow[data-pod="pod764b"] .pdHead'), null, { timeout: 15000 });
    await p.click('#pdPods .pdRow[data-pod="pod764b"] .pdHead'); await sleep(800);
    await p.click('#pdPods .pdRow[data-pod="pod764b"] [data-pdpre]'); await sleep(1500);
    const made = fs.readdirSync(PDIR).filter((f) => /Spare pod/.test(f));
    const mj = made.length ? JSON.parse(fs.readFileSync(path.join(PDIR, made[0]), "utf8")) : {};
    check("My pods ▸ 💾 Save as preset: a .pod file from the pod (template, GPU, disks) - the message says so", made.length === 1 && mj.template_id === "tplCu13u" && mj.gpu === "NVIDIA GeForce RTX 4090" && mj.pod_id === "pod764b" && /kept as the preset/.test(await ev(() => document.getElementById("pdMsg").textContent)), mj);
    for (const f of made) fs.unlinkSync(path.join(PDIR, f));

    /* ---- the "no pod" box (its question answered in the page) */
    const posted = [];
    let needOnce = true;
    const offer = { ask: { id: "q764", style_id: st1.id, style_name: st1.name, kind: "image", state: "open" }, need_gb: 24, size_gb: 12.5, volume_gb: 60, pick: "NVIDIA RTX A6000", count: 1, cloud: "SECURE",
      gpus: [{ id: "NVIDIA RTX A6000", name: "RTX A6000", memory: 48, price: 0.49, offered: true, availability: "HIGH" }], template: { id: "tplCu13u", name: "ComfyUI CUDA 13", image: "", ports: ["8188/http"] }, template_error: "",
      pods: [{ id: "pod764c", name: "Big pod", status: "RUNNING", gpu: "RTX A6000", gpus: 1, cost_hr: 0.49, memory: 48, styles: ["Other style"], preset: "" }, { id: "pod764d", name: "Small pod", status: "EXITED", gpu: "RTX 3060", gpus: 1, cost_hr: 0.2, memory: 12, styles: [], preset: "Cheap" }],
      presets: [{ name: P1, gpu: "A40", count: 1, cloud: "SECURE", styles: [st1.name] }] };
    await p.route("**/api/stylepods/ask/q764*", async (route) => {
      const r = route.request();
      if (r.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(offer) });
      const b0 = JSON.parse(r.postData() || "{}"); posted.push(b0);
      if (b0.action === "preset" && !b0.gpu && needOnce) { needOnce = false; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(Object.assign({}, offer.ask, { need_gpu: true, gpu: "NVIDIA A40", options: [{ id: "NVIDIA RTX A6000", name: "RTX A6000", memory: 48, price: 0.49 }] })) }); }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(Object.assign({}, offer.ask, { state: "done" })) });
    });
    await ev(() => H3PodPick.show("q764")); await sleep(500);
    const bx = await ev(() => { const d = document.getElementById("ppkDlg"); return { open: d && d.open, t: d.querySelector("#ppkTitle").textContent, pods: [...d.querySelectorAll("[data-ppkpod]")].map((r) => r.textContent), pre: [...d.querySelectorAll("[data-ppkpre]")].map((r) => r.textContent), btn: [...d.querySelectorAll("button")].map((b) => b.textContent) }; });
    check("the box (Generate with a style that has no pod): your pods - GPU, state, $/h, what each holds, whether the style fits - each with ＋ <style>", bx.open && /has no pod/.test(bx.t) && bx.pods.length === 2 && /RTX A6000 · running/.test(bx.pods[0]) && /48 GB - fits/.test(bx.pods[0]) && /Holds: Other style/.test(bx.pods[0]) && /12 GB - .* wants ~24 GB/.test(bx.pods[1]) && /preset Cheap/.test(bx.pods[1]) && bx.btn.filter((t) => t === "＋ " + st1.name).length === 2, bx);
    check("…your presets with ＋ <style> & ▶, Create pod…, Cancel render", bx.pre.length === 1 && bx.btn.includes("＋ " + st1.name + " & ▶") && bx.btn.includes("Create pod…") && bx.btn.includes("Cancel render"), bx.btn);
    await p.click('#ppkDlg [data-ppkuse="pod764c"]'); await sleep(500);
    check("＋ <style> on a pod: answered {use, pod} - the box closes, the render goes there", posted[0] && posted[0].action === "use" && posted[0].pod_id === "pod764c" && !(await ev(() => document.getElementById("ppkDlg").open)), posted);
    await ev(() => H3PodPick.show("q764")); await sleep(500);
    await p.click('#ppkDlg [data-ppkpreset]'); await sleep(600);
    const gsel = await ev(() => { const s = document.querySelector("#ppkDlg [data-ppkgpu]"); return s ? s.value : null; });
    await p.click("#ppkDlg [data-ppkgpugo]"); await sleep(500);
    check("＋ <style> & ▶ on a preset: {preset, name}; its GPU not free -> pick one in the box, then {preset, name, gpu}", posted[1] && posted[1].action === "preset" && posted[1].name === P1 && gsel === "NVIDIA RTX A6000" && posted[2] && posted[2].gpu === "NVIDIA RTX A6000" && !(await ev(() => document.getElementById("ppkDlg").open)), posted);
    await ev(() => H3PodPick.show("q764")); await sleep(500);
    await p.click("#ppkDlg [data-ppkcreate]"); await sleep(1200);
    const cr = await ev(() => ({ dlg: document.getElementById("ppkDlg").open, ask: !document.getElementById("pdAsk").hidden, txt: document.getElementById("pdAsk").textContent, form: !!document.querySelector("#pdCreate #pdGo") }));
    check("Create pod…: the box closes, the PODS docker's create form opens filled in for the style (its banner names the render)", !cr.dlg && cr.ask && cr.txt.includes(st1.name) && cr.form, cr);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    rp.close();
    for (const n of [P1, P2]) fs.rmSync(pf(n), { force: true });
    try { if (!fs.readdirSync(PDIR).length) fs.rmSync(path.join(ROOT, "runpod"), { recursive: true, force: true }); } catch { /* fine */ }
    try { const now = (await api("/api/stylepods")).links || {}; for (const s of Object.keys(now)) if (!(s in links0) || now[s] !== links0[s]) await api("/api/stylepods/link", { style_id: s, pod_id: links0[s] || "" }); } catch { /* fine */ }
    await api("/api/gpusplit", { where: "local", engine: { provider: (g0.engine || {}).provider || "runpod", runpod: (g0.engine || {}).runpod || "serverless" }, llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: { key: "", pod_id: "", port: 8188 } }).catch(() => {});
    await api("/api/remotegen/enabled", { on: null }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
