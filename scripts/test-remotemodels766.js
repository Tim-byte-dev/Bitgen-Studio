#!/usr/bin/env node
/* bitGen Studio — 2.766.0 units: runpod/pods/remote_models.json (lib/remoteModels.js), every transfer's progress bar
 * (lib/podTransfers.js, static/podxfer.js), the ticked pods, Model manager / Override in remote mode, a model of this computer
 * -> Civitai / your private Hugging Face repo / straight to the pod (lib/hfUpload.js pure part, lib/podSend.js).
 * Tim (verbatim): "add a remote_models.json in our pods folder. this is where we will keep a list of the models we use for the
 * style like folder=krea raw,model= model name, location = url to download etc. local models won't be available if in remote
 * mode. these will be the models listed in remote mode in model manager and the overide settings dropdowns instead of the
 * local models. if user has a model/lora on their hdd without a link. user can search for it in model manager and it will
 * upload to the selected pod. add a checkbox to the left of the pod name to select the pod(mulitple pods can be selected)"
 * + "go with your suggestions and add a progress bar for each transfer to the pod" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const T = fs.mkdtempSync(path.join(os.tmpdir(), "remotemodels766-"));
process.env.H3_REMOTE_MODELS = path.join(T, "pods", "remote_models.json");
process.env.H3_POD_PRESETS_DIR = path.join(T, "presets");
process.env.H3_POD_REVIVE_POLL = "5";
let CFG = { rgpu: { enabled: true, engine: { provider: "runpod", runpod: "pods" }, split: { where: "remote" }, style_pods: {} }, hf: { token: "" }, civitai: { site: "civitai.red" } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT, STYLES_DIR: path.join(T, "styles") };
require.cache[coreP] = fake;
const RM = require("../lib/remoteModels"), PT = require("../lib/podTransfers"), HU = require("../lib/hfUpload"), SD = require("../lib/podSend"), PM = require("../lib/podModels");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  /* ---- the entry */
  const e1 = RM.clean({ label: "Krea raw", group: "Krea", folder: "diffusion_models", name: "krea2_raw_fp8_scaled.safetensors", url: "https://civitai.red/api/download/models/9?type=Model&token=SECRET" });
  check("clean: a link is kept WITHOUT its ?token= (never a key in the file); its source from the link; an id given", e1 && e1.url === "https://civitai.red/api/download/models/9?type=Model" && e1.source === "civitai" && /^m\w+/.test(e1.id), e1);
  check("…not a ComfyUI models folder / a path in the name -> refused or cut to the file", RM.clean({ folder: "../etc", name: "x" }) === null && RM.clean({ folder: "loras", name: "../../x.safetensors" }).name === "x.safetensors" && RM.clean({ folder: "checkpoints/SDXL/a/b", name: "x" }) === null);
  check("sourceOf: Hugging Face / your private repo (bitgen-models) / Civitai / a link", RM.sourceOf("https://huggingface.co/Comfy-Org/Krea-2/resolve/main/x") === "huggingface" && RM.sourceOf("https://huggingface.co/tim/bitgen-models/resolve/main/loras/a.safetensors") === "your-hf"
    && RM.sourceOf("https://civitai.com/api/download/models/1") === "civitai" && RM.sourceOf("https://example.com/a.safetensors") === "link");
  let L = RM.merge([], { label: "Krea raw", group: "Krea", folder: "diffusion_models", name: "krea2_raw_fp8_scaled.safetensors", url: "", styles: ["krea_a"] }).list;
  L = RM.merge(L, { label: "other label", folder: "diffusion_models", name: "KREA2_raw_fp8_scaled.safetensors", url: "https://huggingface.co/Comfy-Org/Krea-2/resolve/main/x/krea2_raw_fp8_scaled.safetensors", styles: ["krea_b"], pods: { pod1: "done" } }).list;
  check("merge: the same model (same category + file name) once - its label / group kept, the link it lacked added, styles and pods joined", L.length === 1 && L[0].label === "Krea raw" && L[0].group === "Krea" && /Krea-2/.test(L[0].url) && L[0].source === "huggingface" && L[0].styles.join() === "krea_a,krea_b" && L[0].pods.pod1 === "done", L);
  L = RM.merge(L, { folder: "loras", name: "a.safetensors", sha256: "a".repeat(64), url: "https://x.io/a" }).list;
  L = RM.merge(L, { folder: "loras", name: "renamed.safetensors", sha256: "A".repeat(64), url: "https://x.io/b" }).list;
  check("…the same SHA-256 under another name = the same model; a link already there is kept (relink replaces it)", L.length === 2 && L[1].url === "https://x.io/a" && RM.merge(L, { folder: "loras", name: "z", sha256: "a".repeat(64), url: "https://x.io/c", relink: true }).entry.url === "https://x.io/c");
  const sub = RM.clean({ folder: "checkpoints/SDXL", name: "jugg.safetensors", group: "SDXL", url: "https://x.io/j" });
  check("comfyName: the name ComfyUI lists - its folder past the category + the file", RM.comfyName(sub) === "SDXL/jugg.safetensors" && RM.comfyName(e1) === "krea2_raw_fp8_scaled.safetensors");
  const cm = RM.asComfyModels([e1, sub, RM.clean({ folder: "loras", name: "style.safetensors", group: "Krea LoRAs", url: "https://x.io/l" })]);
  check("asComfyModels: the shape Basic Settings' combos + LoRA rows read (categories.<cat>.files [{name, folder}]), marked remote, a note why this computer's are not listed",
    cm.remote && cm.source === "remote" && cm.categories.checkpoints.files[0].name === "SDXL/jugg.safetensors" && cm.categories.diffusion_models.files[0].name === "krea2_raw_fp8_scaled.safetensors"
    && cm.categories.loras.files[0].group === "Krea LoRAs" && cm.categories.loras.files[0].folder === "Krea" && cm.model_categories.includes("checkpoints") && /this computer's models are not listed/.test(cm.warnings[0]), cm.categories.loras);
  check("byName: the entry behind a name a style / Override uses (its ComfyUI name, else its file name; only in the categories asked)", RM.byName([e1, sub], ["checkpoints"], "SDXL\\jugg.safetensors") === sub && RM.byName([e1, sub], ["checkpoints", "diffusion_models"], "x/krea2_raw_fp8_scaled.safetensors") === e1 && RM.byName([e1], ["loras"], "krea2_raw_fp8_scaled.safetensors") === null);
  const card = RM.cardOf(sub, require("../lib/modelCards").cardFrom);
  check("cardOf: a Model manager card (key rm:<id>, its group as the folder tab, the ComfyUI name for Override, where the pod gets it)", card.key === "rm:" + sub.id && card.rm && card.kind === "model" && card.name === "SDXL/jugg.safetensors" && card.folder === "SDXL" && card.group === "SDXL" && /Downloaded by the pod from its link/.test(card.description), card);

  /* ---- the file */
  check("remote mode = remote generation on with RunPod pods; local / serverless = not", RM.podsMode() === true);
  CFG.rgpu.engine.runpod = "serverless"; const ser = RM.podsMode(); CFG.rgpu.enabled = false; const off = RM.podsMode(); CFG.rgpu.enabled = true; CFG.rgpu.engine.runpod = "pods";
  check("…serverless or remote off -> this computer's models as before", ser === false && off === false);
  const a = RM.add({ label: "Krea raw", group: "Krea", folder: "diffusion_models", name: "krea2_raw_fp8_scaled.safetensors", url: "https://huggingface.co/Comfy-Org/Krea-2/resolve/main/split_files/diffusion_models/krea2_raw_fp8_scaled.safetensors", size: 12 });
  const disk = JSON.parse(fs.readFileSync(process.env.H3_REMOTE_MODELS, "utf8"));
  check("add: written to runpod/pods/remote_models.json ({v, models}) - folders made", disk.v === 1 && disk.models[0].name === "krea2_raw_fp8_scaled.safetensors" && disk.models[0].group === "Krea" && RM.FILE() === process.env.H3_REMOTE_MODELS);
  check("…patch (label / group / link / folder), a folder that is not ComfyUI's refused", RM.patch(a.id, { label: "Krea 2 raw", group: "Krea 2" }).label === "Krea 2 raw" && (() => { try { RM.patch(a.id, { folder: "nope" }); return false; } catch (e) { return e.status === 400; } })());
  RM.mark(a, "podA", "done");
  check("…mark: which pods have it", RM.get(a.id).pods.podA === "done");
  check("Default path: <bitGen>/runpod/pods/remote_models.json (runpod/ is not in the repo or the zips)", (() => { const k = process.env.H3_REMOTE_MODELS; delete process.env.H3_REMOTE_MODELS; const f = RM.FILE(); process.env.H3_REMOTE_MODELS = k; return f === path.join(ROOT, "runpod", "pods", "remote_models.json"); })()
    && /^runpod\/$/m.test(fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8")));

  /* ---- the ticked pods */
  check("setSelected / selected: [{id, name}] kept in rgpu.pod_selected, cleaned, no twice", JSON.stringify(RM.setSelected([{ id: "podA", name: "A" }, { id: "pod-B!", name: "B" }, { id: "podA", name: "A again" }])) === JSON.stringify([{ id: "podA", name: "A" }, { id: "podB", name: "B" }]) && CFG.rgpu.pod_selected.length === 2);

  /* ---- ⇪ send: each ticked pod downloads it (podSend.pullWait - stubbed here) */
  const pulls = [], realPull = SD.pullWait;
  SD.pullWait = async (id, port, o) => { pulls.push({ id, port, o }); return id === "podB" ? "HTTP Error 404" : ""; };
  const sres = RM.send(a.id);
  await sleep(30);
  check("send: every ticked pod downloads the entry's link into its folder (the port of each pod), with where it is from for the bars", sres.sending.join() === "podA,podB" && pulls.length === 2 && pulls[0].o.url === a.url && pulls[0].o.folder === "diffusion_models" && pulls[0].o.from === "Hugging Face" && pulls[0].o.pod_name === "A" && pulls[0].port === 8188, pulls);
  check("…marked per pod: done / failed", RM.get(a.id).pods.podA === "done" && RM.get(a.id).pods.podB === "failed", RM.get(a.id).pods);
  RM.setSelected([]);
  let er = null; try { RM.send(a.id); } catch (e) { er = e; }
  check("…no pods ticked -> says where to tick them", er && er.status === 400 && /tick the pods to send it to \(☐ beside each pod's name in PODS ▸ My pods\)/.test(er.message));
  const noLink = RM.add({ folder: "loras", name: "mine.safetensors", source: "link" }); er = null; try { RM.send(noLink.id, [{ id: "podA" }]); } catch (e) { er = e; }
  check("…no link yet -> says how it gets one", er && er.status === 409 && /has no link yet/.test(er.message));

  /* ---- ＋ Link */
  const ln = RM.addLink({ url: "https://huggingface.co/x/y/resolve/main/loras/cool_style.safetensors", folder: "loras", label: "Cool style", group: "SDXL LoRAs" });
  check("addLink: a pasted link + its ComfyUI folder (the file name from the link)", ln.name === "cool_style.safetensors" && ln.folder === "loras" && ln.group === "SDXL LoRAs");
  check("…not https / no folder -> refused", (() => { try { RM.addLink({ url: "ftp://x", folder: "loras" }); return false; } catch (e) { return e.status === 400; } })() && (() => { try { RM.addLink({ url: "https://x.io/a", folder: "" }); return false; } catch (e) { return e.status === 400; } })());

  /* ---- ↻ my styles' models */
  CFG.rgpu.style_pods = { krea_style: "podA" };
  const realPlan = PM.planFor;
  PM.planFor = (ids) => ({ files: ids[0] === "krea_style" ? [{ name: "qwen3vl_4b_fp8_scaled.safetensors", folder: "text_encoders", url: "https://huggingface.co/Comfy-Org/Krea-2/resolve/main/split_files/text_encoders/qwen3vl_4b_fp8_scaled.safetensors", size: 5 }] : [], unknown: [] });
  const added = RM.fill();
  check("fill: the files of the styles your pods use (linked to a pod) from bitGen's download list, with the style", added === 1 && RM.load().some((e) => e.name === "qwen3vl_4b_fp8_scaled.safetensors" && e.styles.includes("krea_style") && e.source === "catalog"));
  PM.planFor = realPlan;

  /* ---- a model of this computer: Civitai -> your Hugging Face repo -> straight to the pod */
  const PO = require("../lib/podOnline"), realFind = PO.find, HUr = HU.upload, realSendOne = SD.sendOne;
  const ck = path.join(T, "my_merge.safetensors"); fs.writeFileSync(ck, Buffer.alloc(1000, 7));
  const local = { path: ck, category: "checkpoints", rel: "Merges/my_merge.safetensors" };
  PO.find = async (abs, say, deps) => { if (deps && deps.sha256) await deps.sha256(abs, () => {}); return { url: "https://civitai.red/api/download/models/55?type=Model", site: "civitai.red", sha256: "b".repeat(64), size: 1000, model: "My merge - v1" }; };
  pulls.length = 0;
  let e = await RM.keepLocal(local, [{ id: "podA", name: "A" }], {});
  await sleep(20);
  check("keepLocal: found on Civitai -> in the list with Civitai's link in its folder (checkpoints/Merges), then each ticked pod downloads it", e && e.source === "civitai" && e.folder === "checkpoints/Merges" && e.name === "my_merge.safetensors" && pulls.length === 1 && /civitai\.red/.test(pulls[0].o.url), { e, pulls });
  PO.find = async () => null;
  CFG.hf.token = "hf_WRITE";
  let upOpts = null; HU.upload = async (abs, o) => { upOpts = o; o.onProgress(500); o.onProgress(1000); return { url: "https://huggingface.co/tim/bitgen-models/resolve/main/checkpoints/Merges/my_merge2.safetensors", sha256: "c".repeat(64), size: 1000 }; };
  pulls.length = 0;
  e = await RM.keepLocal(Object.assign({}, local, { rel: "Merges/my_merge2.safetensors" }), [{ id: "podA", name: "A" }], { label: "My merge 2" });
  await sleep(20);
  const hfBar = PT.list().find((x) => x.how === "hf");
  check("…not on Civitai, a token that can write -> put in YOUR private Hugging Face repo (its own bar), in the list as your-hf, then the pod downloads it", e && e.source === "your-hf" && e.label === "My merge 2" && upOpts.token === "hf_WRITE" && upOpts.folder === "checkpoints/Merges" && hfBar && hfBar.state === "done" && pulls.length === 1 && /bitgen-models/.test(pulls[0].o.url), { e, hfBar, pulls });
  HU.upload = async () => { throw Object.assign(new Error("your Hugging Face token can only read"), { code: "read_token" }); };
  const direct = []; SD.sendOne = async (id, port, l, c, say, o) => { direct.push({ id, o }); return ""; };
  e = await RM.keepLocal(Object.assign({}, local, { rel: "Merges/my_merge3.safetensors" }), [{ id: "podA", name: "A" }, { id: "podC", name: "C" }], {});
  const bad = PT.list().find((x) => x.how === "hf" && /^failed/.test(x.state));
  check("…no repo of yours (a read token) -> its bar says why, and this computer sends it straight to each ticked pod (no Civitai / repo again); the list keeps it without a link",
    direct.map((d) => d.id).join() === "podA,podC" && direct[0].o.noCivitai && direct[0].o.noHf && direct[0].o.pod_name === "A" && bad && /can only read - sending it from this computer instead/.test(bad.state) && e && !e.url && RM.get(e.id).pods.podC === "done", { direct, bad, e });
  check("…its file is read once to find it (a 🔎 bar)", PT.list().some((x) => x.how === "hash" && x.name === "my_merge.safetensors"));
  PO.find = realFind; HU.upload = HUr; SD.sendOne = realSendOne; SD.pullWait = realPull;

  /* ---- podSend.pullWait: the pod downloads, a bar, one at a time per pod */
  const realFrom = PM.fromLink, realState = PM.state, order = [];
  let polls = {};
  PM.fromLink = async (id, b) => { order.push("start " + b.name); polls[b.name] = 0; return { started: 1 }; };
  PM.state = async () => { const n = Object.keys(polls).pop(); polls[n]++; return polls[n] < 3 ? { running: true, files: [{ name: n, state: "downloading", done: 400 * polls[n], size: 1200 }] } : { running: false, files: [{ name: n, state: "done", done: 1200, size: 1200 }] }; };
  const said = [];
  const [w1, w2] = await Promise.all([SD.pullWait("podZ", 8188, { url: "https://x.io/a", folder: "loras", name: "a.safetensors", size: 1200, from: "Hugging Face", pod_name: "Zed" }, (t) => said.push(t)),
    SD.pullWait("podZ", 8188, { url: "https://x.io/b", folder: "loras", name: "b.safetensors", size: 1200, from: "Civitai" }, null)]);
  const bars = PT.list().filter((x) => x.pod === "podZ");
  check("pullWait: one pod downloads one file at a time (the second waits for the first)", w1 === "" && w2 === "" && order.join() === "start a.safetensors,start b.safetensors", order);
  check("…a bar for each: pod, name, from, done", bars.length === 2 && bars.every((x) => x.state === "done" && x.pct === 100 && x.how === "download") && bars.some((x) => x.pod_name === "Zed" && x.from === "Hugging Face"), bars);
  check("…the render's note says the pod's progress", said.some((t) => /^the pod is downloading a\.safetensors from Hugging Face - /.test(t)), said);
  PM.state = async () => ({ running: false, files: [{ name: "c.safetensors", state: "failed: gated or private - open huggingface.co/x/y", done: 0 }] });
  const w3 = await SD.pullWait("podZ", 8188, { url: "https://x.io/c", folder: "loras", name: "c.safetensors", size: 9, from: "Hugging Face" }, null);
  check("…failed -> the reason back, the bar red with it", /^gated or private/.test(w3) && /^failed: gated or private/.test(PT.list().find((x) => x.name === "c.safetensors").state));

  /* ---- ensure: a remote-list model the pod lacks is downloaded from its link (remote mode has no local copy) */
  const PS = require("../lib/podStyles"), realContents = PS.contents;
  PS.contents = async () => ({ models: { checkpoints: [], loras: [] } });
  PM.state = async () => ({ running: false, files: [{ name: "jugg.safetensors", state: "done", done: 1, size: 1 }] });
  RM.add({ folder: "checkpoints/SDXL", name: "jugg.safetensors", url: "https://x.io/j", group: "SDXL" });
  order.length = 0;
  const en = await SD.ensure("podQ", 8188, SD.CKPT_CATS, "SDXL/jugg.safetensors", null);
  check("ensure: Override's checkpoint from remote_models.json - the pod downloads it from its link; its ComfyUI name back", en.sent && en.name === "SDXL/jugg.safetensors" && order.join() === "start jugg.safetensors" && RM.byName(RM.load(), ["checkpoints"], "jugg.safetensors").pods.podQ === "done", { en, order });
  PS.contents = realContents; PM.fromLink = realFrom; PM.state = realState;

  /* ---- the render's LoRAs too (podRevive.modelGate) */
  const RV = require("../lib/podRevive");
  const it = RV.itemsOf({ model_override: true, model: "SDXL/jugg.safetensors", loras: [{ path: "style.safetensors", weight: 1 }, { name: "b.safetensors" }, { path: "style.safetensors" }] });
  check("modelGate items: Override's checkpoint + every LoRA of the render (once each)", it.length === 3 && it[0].ckpt && it[1].cats[0] === "loras" && it[2].name === "b.safetensors" && RV.itemsOf({ loras: [] }).length === 0, it);

  /* ---- transfers (pure + live) */
  check("rateOf: bytes/s over the last 20 s; leftOf: seconds left", PT.rateOf([[0, 0], [10000, 5e6], [20000, 10e6]], 20000) === 5e5 && PT.rateOf([[0, 0]], 1) === 0 && PT.leftOf(1e6, 3e6, 5e5) === 4 && PT.leftOf(1, 2, 0) === 0);
  const xid = PT.begin({ pod: "p1", name: "big.safetensors", how: "upload", from: "this computer", size: 100 }); PT.step(xid, 40);
  const xv = PT.list().find((x) => x.id === xid);
  check("begin / step: running, 40%; end: done = 100%", xv.state === "running" && xv.pct === 40 && (PT.end(xid, "done"), PT.list().find((x) => x.id === xid).pct === 100));
  PT.clear();
  check("clear: the finished ones go", !PT.list().some((x) => x.state !== "running"));

  /* ---- hfUpload (pure) */
  check("hfUpload.repoPath: <folder>/<file> in your repo, cleaned", HU.repoPath("checkpoints/SDXL", "my file.safetensors") === "checkpoints/SDXL/my file.safetensors" && HU.repoPath("../x", "a?b") === "x/a_b" && HU.REPO === "bitgen-models");
  check("…partsOf: the multipart addresses in order", HU.partsOf({ chunk_size: "5", "00002": "u2", "00001": "u1", "00010": "u10" }).map((p) => p.url).join() === "u1,u2,u10");
  const nd = HU.ndjson("loras/a.safetensors", "f".repeat(64), 12).trim().split("\n").map((l) => JSON.parse(l));
  check("…ndjson: the commit - a header + the LFS file (path, sha256 oid, size)", nd[0].key === "header" && nd[1].key === "lfsFile" && nd[1].value.path === "loras/a.safetensors" && nd[1].value.oid === "f".repeat(64) && nd[1].value.size === 12);

  /* ---- the page (pure parts + wiring) */
  const PX = require("../static/podxfer.js"), RMS = require("../static/remotemodels.js");
  check("podxfer rowText: % of size, MB/s, time left; done; failed says why", PX.rowText({ state: "running", size: 6e9, done: 1.2e9, pct: 20, rate: 45e6, left: 107 }) === "1.2 GB of 6.0 GB (20%) · 45.0 MB/s · about 2 min left"
    && PX.rowText({ state: "done", size: 2e9 }) === "2.0 GB · done" && PX.rowText({ state: "failed: refused" }) === "failed: refused");
  check("…whatText: what goes where", PX.whatText({ how: "download", name: "a", pod_name: "Pod 1", from: "Civitai" }) === "a → Pod 1 (from Civitai)" && PX.whatText({ how: "hf", name: "a" }) === "a → your Hugging Face repo" && PX.whatText({ how: "upload", name: "a", pod: "p" }) === "a → p (from this computer)" && /^reading a to find it on Civitai/.test(PX.whatText({ how: "hash", name: "a" })));
  check("…rowHtml: a progressbar with its value", /role="progressbar"[^>]*aria-valuenow="20"/.test(PX.rowHtml({ id: "x", how: "download", name: "a", state: "running", pct: 20 })));
  check("remotemodels sendTo / localMatches", RMS.sendTo([{ id: "a", name: "Pod A" }]) === "Send to: Pod A" && /No pods ticked/.test(RMS.sendTo([])) && RMS.localMatches([{ kind: "lora", title: "zed", name: "z" }, { kind: "model", title: "zeta", name: "zz" }], "ze").map((c) => c.title).join() === "zeta,zed");
  const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  const IX = src("routes/index.js"), MM = src("static/modelmgr.js"), PD = src("static/podsdock.js"), HT = src("static/index.html"), RR = src("routes/remoteModels.js");
  check("routes: mounted FIRST after the JSON parser; remote mode answers /api/comfymodels + /api/modelmgr/cards (?local=1 = this computer's)", /app\.use\(express\.json\(\)\);\n  require\("\.\/remoteModels"\)\.mount\(app\);/.test(IX)
    && /const remote = \(req\) => req\.query\.local !== "1" && RM\.podsMode\(\);/.test(RR) && /app\.get\("\/api\/comfymodels", \(req, res, next\) => \{ if \(!remote\(req\)\) return next\(\);/.test(RR) && /app\.get\("\/api\/modelmgr\/cards", \(req, res, next\) => \{\n    if \(!remote\(req\)\) return next\(\);/.test(RR));
  check("Model manager: remote cards (⇪ / ✕, the pods that have it), the remote bar, local-only buttons hidden, Civitai ⤓ -> the list + the ticked pods", /c\.rm \? rmActs\(c\)/.test(MM) && /data-rmsend/.test(MM) && /id="mmRemote"/.test(MM) && /window\.H3RemoteModels\.bar\(\$\("mmRemote"\)/.test(MM)
    && /\["mmFetch", "mmSync", "mmFoldBtn", "mmEdit"\]\.forEach/.test(MM) && /jpost\("\/api\/remotemodels\/civitai"/.test(MM) && /if \(\/\^rm:\/\.test\(String\(key \|\| ""\)\)\) return;/.test(MM));
  check("PODS docker: a ☐ LEFT of each pod's name (before its name button), kept on the server; the transfers' bars", /<div class="pdTop">'\n        \+ '<input type="checkbox" class="pdSel" data-pdsel/.test(PD) && /post\("\/api\/pods\/selected", \{ pods: L \}\)/.test(PD) && /H3PodXfer\.mount\(\$\("pdXfer"\)\)/.test(PD) && /id="pdXfer"/.test(PD));
  check("index.html loads podxfer.js + remotemodels.js", /<script src="\/static\/podxfer\.js"><\/script>/.test(HT) && /<script src="\/static\/remotemodels\.js"><\/script>/.test(HT));
  check("podSend: sendOne = Civitai, then your Hugging Face repo, then this computer (a bar each); ensure tries remote_models.json first", /const hf = o\.noHf \? null : await viaHf\(/.test(src("lib/podSend.js")) && /RM\.byName\(RM\.load\(\), cats, name\)/.test(src("lib/podSend.js")) && /how: "upload", from: "this computer"/.test(src("lib/podSend.js")));
  check("podPrep: a bar per downloaded file, the files listed with their styles", /bars\[f\.name\] = PT\.begin\(/.test(src("lib/podPrep.js")) && /RM\.add\(\{ label: f\.name/.test(src("lib/podPrep.js")));

  fs.rmSync(T, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack)); console.log("RESULT: FAIL"); process.exit(1); });
