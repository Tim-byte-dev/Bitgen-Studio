#!/usr/bin/env node
/* bitGen Studio — 2.764.0 units: POD PRESETS (lib/podPresets.js, routes/podPresets.js, static/podpresets.js, static/podpick.js,
 * lib/stylePods.js's preset answer + offer, lib/pods.js's preset on create).
 * Tim (verbatim): "I think we can use multiple styles on the same pod. so if a user clicks a style that is not assigned to a pod
 * bring up a dialog with my pods and a + style button ... add a create pod button ... in pods docker add a presets tab, save all
 * the pods details ... in a <preset name>.pod file in a folder called runpod\pods\presets ... play button a stop button and a
 * delete button(delete button terminates the pod) ... if user presses the play button and pod has been terminated the create a
 * new pod with all those details and populate it with the styles files" + "delete should only terminate the pod x should delete
 * the preset. dialog should only appear when u press generate"
 * The live part runs lib/podPresets.js against stand-ins for RunPod, the pod and bitGen's own modules (no network). */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

/* ---- stand-ins for what lib/podPresets.js asks */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "pp764-"));
process.env.H3_POD_PRESETS_DIR = path.join(TMP, "runpod", "pods", "presets");
const LOG = [], CFG = { rgpu: { runpod: { key: "k" }, style_pods: {}, pod_cfg: {} } };
let PODS = [], GPUS = [], RECIPE = null, NODES_TODO = {};
const fakes = {
  "./core": { BASE: TMP, STYLES_DIR: path.join(TMP, "styles"), getConfig: () => CFG, setConfig: () => {} },
  "./styles": { byId: (d, id) => ({ s1: { id: "s1", name: "Krea Raw" }, s2: { id: "s2", name: "Flux Portrait" }, s3: { id: "s3", name: "Wan Video" } })[id] || null },
  "./pods": {
    mine: async () => ({ pods: PODS.slice() }),
    gpus: async (cloud) => ({ cloud, gpus: GPUS }),
    create: async (o) => { LOG.push(["create", o]); const p = { id: "podNew" + (LOG.filter((x) => x[0] === "create").length), name: o.name, status: "PROVISIONING", gpu: o.gpu, gpus: o.count, cost_hr: 0.44 }; PODS.push(p); return { pod: p, port: o.port }; },
    act: async (id, a) => { LOG.push(["act", id, a]); const p = PODS.find((x) => x.id === id); if (p) p.status = a === "start" ? "RUNNING" : a === "stop" ? "EXITED" : "TERMINATED"; if (a === "terminate") PODS = PODS.filter((x) => x.id !== id); return { ok: true }; },
  },
  "./stylePods": {
    setStylesOf: (pod, ids) => { LOG.push(["setStyles", pod, ids.slice()]); for (const s of Object.keys(CFG.rgpu.style_pods)) if (CFG.rgpu.style_pods[s] === pod) delete CFG.rgpu.style_pods[s]; for (const s of ids) CFG.rgpu.style_pods[s] = pod; return ids; },
    setKinds: (pod, k) => { LOG.push(["kinds", pod, k]); return k; },
    nodesTodo: (pod, set) => { if (set) { NODES_TODO[pod] = true; return true; } return !!NODES_TODO[pod]; },
    nodesDone: (pod) => { NODES_TODO[pod] = false; },
    stylesOf: (pod) => Object.keys(CFG.rgpu.style_pods).filter((s) => CFG.rgpu.style_pods[s] === pod),
    portOf: () => 8188,
  },
  "./podRevive": { recipe: async () => RECIPE, waitReady: async (id, port, say) => { say("loading pod - waiting for its ComfyUI (0 min)"); const p = PODS.find((x) => x.id === id); if (p) p.status = "RUNNING"; return { ok: true }; }, mark: () => {} },
  "./podNodes": { mirror: async (id, port, o) => { o.say("uploading MyPack - packing 3/3 files"); LOG.push(["mirror", id]); return { done: ["MyPack"], there: [], failed: [] }; } },
  "./podPrep": { prepare: async (id, port, sts, o) => { if (o && o.say) o.say("downloading 1 file"); LOG.push(["prepare", id, sts.map((s) => s.id)]); return { done: sts.map((s) => s.name), problems: [], notThere: sts[0] && sts[0].id === "s3" ? ["wan_vae.safetensors"] : [] }; } },
  "./podCosts": { costs: async () => ({ pods: { podOld: { today: 0, month: 3.5 } } }) },
};
const load0 = Module._load;
Module._load = function (req, parent, isMain) {
  if (parent && /lib[\\/]podPresets\.js$/.test(parent.filename) && fakes[req]) return fakes[req];
  return load0.apply(this, arguments);
};
const PP = require("../lib/podPresets");
const tick = () => new Promise((r) => setTimeout(r, 30));

(async () => {
  /* ---- pure */
  check("fileName: the preset's name + .pod, without what Windows refuses", PP.fileName("Krea pod") === "Krea pod.pod" && PP.fileName('a<b>:c/d\\e|f?g*"h') === "abcdefgh.pod" && PP.fileName("  ") === "" && PP.fileName("..x..") === "x.pod");
  const c1 = PP.cleanPreset({ name: "X", template_id: "tpl-1!", gpu: "NVIDIA A40", count: 99, cloud: "community", disk: 5, volume: 120, cuda: "13.0", kinds: ["image", "llm", "image"], styles: ["s1", "s1", "bad id!"], pod_id: "p-1", runs: [{ pod: "p1", from: 1, to: 2, rate: 0.5 }, { from: 3 }], key: "SECRET", jupyter: "pw" });
  check("cleanPreset: only known fields (no key / password), bounds, kinds, styles once", c1.template_id === "tpl1" && c1.count === 1 && c1.cloud === "COMMUNITY" && c1.disk === 50 && c1.volume === 120 && JSON.stringify(c1.kinds) === '["image"]' && JSON.stringify(c1.styles) === '["s1","badid"]' && c1.pod_id === "p1" && c1.runs.length === 1 && !("key" in c1) && !("jupyter" in c1), c1);
  const H = 3600000;
  check("usage: hours used + cost from each run's rate (an open run up to now)", JSON.stringify(PP.usage([{ from: 0, to: 2 * H, rate: 0.5 }, { from: 10 * H, to: null, rate: 1 }], 11.5 * H)) === JSON.stringify({ hours: 3.5, usd: 2.5 }));
  let s = PP.syncRuns([], { id: "p1", status: "RUNNING", cost_hr: 0.44, started_at: new Date(1000 * H - H).toISOString() }, 1000 * H);
  check("syncRuns: a running pod opens a run (from RunPod's start, its $/h)", s.changed && s.runs.length === 1 && s.runs[0].from === 999 * H && s.runs[0].rate === 0.44 && s.runs[0].to === null, s);
  const s2 = PP.syncRuns(s.runs, { id: "p1", status: "RUNNING", cost_hr: 0.44 }, 1001 * H);
  const s3 = PP.syncRuns(s.runs, { id: "p1", status: "EXITED" }, 1002 * H), s4 = PP.syncRuns(s.runs, null, 1003 * H);
  check("…still running = no change; stopped or gone = the run closes", !s2.changed && s3.changed && s3.runs[0].to === 1002 * H && s4.runs[0].to === 1003 * H);
  const s5 = PP.syncRuns(s.runs, { id: "p2", status: "RUNNING", cost_hr: 0.7 }, 1004 * H);
  check("…a new pod for the preset: the old run closes, a new one opens", s5.runs.length === 2 && s5.runs[0].to === 1004 * H && s5.runs[1].pod === "p2" && s5.runs[1].rate === 0.7, s5.runs);
  const G = [{ id: "A40", name: "A40", memory: 48, price: 0.44, offered: false }, { id: "L40S", name: "L40S", memory: 48, price: 0.86, offered: true }, { id: "4090", name: "RTX 4090", memory: 24, price: 0.69, offered: true }, { id: "A6000", name: "RTX A6000", memory: 48, price: 0.49, offered: true }, { id: "H100", name: "H100", memory: 80, price: 2.99, offered: true }];
  check("gpuOptions: free ones with as much memory or more, cheapest first", PP.gpuOptions(G, "A40").map((g) => g.id).join() === "A6000,L40S,H100");
  const st = PP.stepsFor(true, ["Krea Raw", "Wan Video"]);
  check("stepsFor: Creating -> Pod loading -> ComfyUI -> each style's nodes + files (2.764.2: only the node packs its workflows use) -> Ready", st.map((x) => x.id).join() === "create,load,comfy,style0,style1,ready" && /its nodes and files/.test(st[3].label) && st.every((x) => x.state === "todo") && PP.stepsFor(false, []).length === 3);

  /* ---- live: presets on disk, ▶ on a terminated preset, ⏹, 🗑, ✕ */
  const D = process.env.H3_POD_PRESETS_DIR;
  RECIPE = { template_id: "tplCu13", template_name: "ComfyUI CUDA 13", gpu: "NVIDIA A40", count: 2, cloud: "SECURE", disk: 50, volume: 150, port: 8188, name: "bitGen Krea Raw", cuda: "13.0" };
  PODS = [{ id: "podOld", name: "bitGen Krea Raw", status: "RUNNING", gpu: "A40", gpus: 2, cost_hr: 0.88, started_at: new Date(Date.now() - 2 * H).toISOString() }];
  CFG.rgpu.style_pods = { s1: "podOld" }; CFG.rgpu.pod_cfg = { podOld: { kinds: ["image"] } };
  const made = await PP.fromPod("podOld", "Krea pod");
  check("fromPod: the recipe + the styles on it + its kinds -> runpod/pods/presets/Krea pod.pod", fs.existsSync(path.join(D, "Krea pod.pod")) && made.gpu === "NVIDIA A40" && made.count === 2 && made.volume === 150 && made.cuda === "13.0" && JSON.stringify(made.styles) === '["s1"]' && JSON.stringify(made.kinds) === '["image"]' && made.pod_id === "podOld", made);
  const again = await PP.fromPod("podOld", "Krea pod");
  check("…the same name again gets a number (Krea pod 2)", again.name === "Krea pod 2"); PP.remove("Krea pod 2");
  let L = await PP.list();
  let k = L.presets.find((p) => p.name === "Krea pod");
  check("list: running, its pod, $/h, a run from the pod's start (~2 h), RunPod's bill this month, the style's name", k && k.state === "running" && k.pod.cost_hr === 0.88 && k.hours >= 1.9 && k.hours <= 2.1 && k.total_usd > 1.6 && k.bill_month === 3.5 && k.style_names[0].name === "Krea Raw", k);
  PP.onLink("podOld", "s2");
  check("a style linked to the preset's pod anywhere joins the preset (onLink)", JSON.stringify(PP.get("Krea pod").styles) === '["s1","s2"]');
  LOG.length = 0;
  await PP.styles("Krea pod", ["s3"], ["s2"]);
  await tick();
  check("styles: add / remove - the running pod takes them, the added one made ready on it now", JSON.stringify(PP.get("Krea pod").styles) === '["s1","s3"]' && LOG.some((x) => x[0] === "setStyles" && x[1] === "podOld" && x[2].join() === "s1,s3") && LOG.some((x) => x[0] === "prepare" && x[2].join() === "s3"), LOG);
  check("…and the pod's own onSet does not fight it (QUIET)", JSON.stringify(PP.get("Krea pod").styles) === '["s1","s3"]');
  const pr = await PP.play("Krea pod");
  check("▶ on a running pod: nothing to do", pr.state === "running" && pr.pod_id === "podOld", pr);
  await PP.stop("Krea pod");
  k = (await PP.list()).presets.find((p) => p.name === "Krea pod");
  check("⏹: RunPod stop, the run closed, state stopped", LOG.some((x) => x[0] === "act" && x[2] === "stop") && k.state === "stopped" && k.runs[k.runs.length - 1].to != null, k);
  const r0 = await PP.terminate("Krea pod");
  k = (await PP.list()).presets.find((p) => p.name === "Krea pod");
  check("🗑: the pod terminated, the preset STAYS (terminated - ▶ makes it again)", r0.terminated && fs.existsSync(path.join(D, "Krea pod.pod")) && k.state === "terminated" && !k.pod, k);
  // ▶ after terminate: its GPU not free -> the choice
  GPUS = G.map((g) => Object.assign({}, g, { id: g.id === "A40" ? "NVIDIA A40" : g.id, max: 8 }));
  const need = await PP.play("Krea pod");
  check("▶ on a terminated preset whose GPU is not free: need_gpu + the GPUs with ≥ 48 GB, cheapest first", need.need_gpu && need.options.map((g) => g.id).join() === "A6000,L40S,H100" && !LOG.some((x) => x[0] === "create"), need);
  LOG.length = 0; NODES_TODO = {};
  const p2 = await PP.play("Krea pod", { gpu: "A6000" });
  check("▶ with a GPU picked: a new pod with EVERY detail (template, GPU, × 2, cloud, both disks, CUDA 13) - no second preset", p2.state === "creating" && LOG[0][0] === "create" && LOG[0][1].templateId === "tplCu13" && LOG[0][1].gpu === "A6000" && LOG[0][1].count === 2 && LOG[0][1].volume === 150 && LOG[0][1].disk === 50 && LOG[0][1].cuda === "13.0" && LOG[0][1].preset === "Krea pod", LOG[0]);
  check("…the preset now points at the new pod, the GPU picked is kept, the styles + kinds linked to it", PP.get("Krea pod").pod_id === p2.pod_id && PP.get("Krea pod").gpu === "A6000" && LOG.some((x) => x[0] === "setStyles" && x[1] === p2.pod_id && x[2].join() === "s1,s3") && LOG.some((x) => x[0] === "kinds" && x[1] === p2.pod_id));
  for (let i = 0; i < 40 && (PP.list && !LOG.some((x) => x[0] === "prepare" && x[2][0] === "s3")); i++) await tick();
  await tick();
  k = (await PP.list()).presets.find((p) => p.name === "Krea pod");
  const sts = k.job && k.job.steps.map((x) => x.id + ":" + x.state).join();
  check("…populated in the background: pod loading -> ComfyUI -> each style's nodes + files (workflows, models, encoders, VAE, LoRAs) in turn - never every custom node pack (2.764.2)", !LOG.some((x) => x[0] === "mirror") && LOG.filter((x) => x[0] === "prepare" && x[1] === p2.pod_id).map((x) => x[2][0]).join() === "s1,s3", LOG);
  check("…the loading sequence: each step's state; a file still missing = that step failed (named)", sts === "create:done,load:done,comfy:done,style0:done,style1:failed,ready:done" && /wan_vae/.test(k.job.steps.find((x) => x.id === "style1").note) && k.job.phase === "failed", k.job);
  check("…running now: a new run at the pod's $/h; hours + total cost keep the old pod's too", k.state === "failed" && k.runs.length >= 2 && k.runs[k.runs.length - 1].pod === p2.pod_id && k.total_usd > 1.6, k);
  // rename + edit
  const ed = await PP.save({ was: "Krea pod", preset: Object.assign({}, PP.get("Krea pod"), { name: "Krea + Wan", count: 1, volume: 200 }) });
  check("save: renamed (the old file goes), edited, runs + pod kept", ed.name === "Krea + Wan" && !fs.existsSync(path.join(D, "Krea pod.pod")) && fs.existsSync(path.join(D, "Krea + Wan.pod")) && ed.count === 1 && ed.volume === 200 && ed.pod_id === p2.pod_id && ed.runs.length >= 2, ed);
  let err = ""; try { await PP.save({ preset: { name: "Krea + Wan", template_id: "t" } }); } catch (e) { err = e.message; }
  check("save: a second preset with the same name is refused", /already/.test(err), err);
  const fileText = fs.readFileSync(path.join(D, "Krea + Wan.pod"), "utf8");
  check("the .pod file is plain JSON with the details, never the API key", JSON.parse(fileText).name === "Krea + Wan" && !/"k"|SECRET|jupyter/i.test(fileText.replace(/"kinds"/g, "")));
  PP.remove("Krea + Wan");
  check("✕: the preset file is deleted; the pod is left as it is", !fs.existsSync(path.join(D, "Krea + Wan.pod")) && PODS.some((x) => x.id === p2.pod_id));

  /* ---- the wiring */
  const RT = rd("routes", "podPresets.js"), IX = rd("routes", "index.js");
  check("routes/podPresets.js mounted from routes/index.js (not server.js): list, save, from-pod, ✕ DELETE, styles, ▶ play, ⏹ stop, 🗑 terminate",
    /require\("\.\/podPresets"\)\.mount\(app\)/.test(IX) && !/podPresets/.test(rd("misc", "server.js")) && ["app.get(\"/api/podpresets\"", "app.post(\"/api/podpresets\"", "from-pod/:id", "app.delete(\"/api/podpresets/:name\"", "/:name/styles", "/:name/play", "/:name/stop", "/:name/terminate"].every((x) => RT.includes(x)));
  const SPs = rd("lib", "stylePods.js");
  check("stylePods: answer {action: preset} adds the style + ▶ (need_gpu passed back); offer lists each pod's styles / memory / preset + the presets with no pod; link / setStylesOf tell the presets",
    /if \(o\.action === "preset"\)/.test(SPs) && /await PP\.styles\(String\(o\.name \|\| ""\), \[a\.style_id\], \[\]\)/.test(SPs) && /if \(r\.need_gpu\) return/.test(SPs) && /presets: presetsFor\(/.test(SPs) && /require\("\.\/podPresets"\)\.onLink\(/.test(SPs) && /require\("\.\/podPresets"\)\.onSet\(/.test(SPs));
  check("pods.create: a pod made for a style is kept as a preset (not when a preset makes it)", /if \(o\.for_style && !o\.preset\) \{ try \{ preset = \(await require\("\.\/podPresets"\)\.fromPod\(/.test(rd("lib", "pods.js")));
  check(".gitignore + make_zips.sh keep runpod/ (this PC's presets) out", /^runpod\/$/m.test(rd(".gitignore")) && /! -path "\.\/runpod\/\*"/.test(rd("scripts", "make_zips.sh")));
  const UI = require("../static/podpresets.js");
  check("podpresets (pure): hoursText, stateWord, stepIcon, dirty", UI.hoursText(0) === "0 min" && UI.hoursText(0.5) === "30 min" && UI.hoursText(2.25) === "2 h 15 min" && UI.stepIcon("done") === "✓" && UI.stepIcon("failed") === "✕" && /▶ makes it again/.test(UI.stateWord("terminated"))
    && UI.dirty({ name: "a", styles: ["s1"] }, { name: "a", styles: ["s1", "s2"] }) && !UI.dirty({ name: "a", count: 1 }, { name: "a", count: 1, hours: 9 }));
  const PS = rd("static", "podpresets.js");
  check("the accordion title bar: ▶ ⏹ 🗑 ✕ icon-only buttons with names for screen readers; 🗑 terminates, ✕ deletes the preset - each asks first",
    /data-ppplay title="Start/.test(PS) && /data-ppstop/.test(PS) && /data-ppkill title="Terminate the pod - everything on it is deleted; the preset stays"/.test(PS) && /data-ppdel title="Delete the preset \(the pod is left as it is\)"/.test(PS) && /aria-label="Terminate the pod of /.test(PS) && /ask === "kill" \? "Terminate <b>"/.test(PS));
  check("…under the details: the loading sequence, the pod, cost / hour, hours used, total cost", /aria-label="Loading sequence"/.test(PS) && /Cost \/ hour/.test(PS) && /Hours used/.test(PS) && /Total cost/.test(PS));
  const PK = require("../static/podpick.js");
  check("podpick (pure): fits / rowText", PK.fits(48, 24) === "yes" && PK.fits(16, 24) === "no" && PK.fits(0, 24) === "" && PK.rowText({ gpu: "A40", gpus: 2, status: "RUNNING" }) === "A40 × 2 · running");
  const PKs = rd("static", "podpick.js"), SA = rd("static", "stylepodask.js"), PD = rd("static", "podsdock.js"), IH = rd("static", "index.html");
  check("the box: your pods with ＋ <style> (action use), presets with ＋ <style> & ▶ (action preset, a GPU picked when needed), Create pod… (the docker's form), Cancel render; opened from the queued render's question (Generate) only",
    /action: "use", pod_id: b\.dataset\.ppkuse/.test(PKs) && /action: "preset", name: name, gpu: gpu \|\| undefined/.test(PKs) && /H3Pods\.forRender\(o\)/.test(PKs) && /data-ppkcancel/.test(PKs) && /var pick = root\.H3PodPick \? H3PodPick\.show\(id\)/.test(SA));
  check("PODS docker: a 📦 Presets tab (#pdPresetBox) and 💾 Save as preset on a pod; index.html loads podpresets.js + podpick.js",
    /\["presets", "📦 Presets"\]/.test(PD) && /id="pdPresetBox"/.test(PD) && /data-pdpre /.test(PD) && /\/api\/podpresets\/from-pod\//.test(PD) && IH.indexOf("/static/podpresets.js") > IH.indexOf("/static/podsdock.js") && IH.indexOf("/static/podpick.js") > 0);

  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
