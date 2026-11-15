#!/usr/bin/env node
/* bitGen Studio — 2.793.0 units: NO_Pod PART 2 - where a terminated pod's file can run now (lib/noPodWhere.js: the pods that have
 * it, the others with what they would be sent, room / card warnings), the file put on a pod you have (lib/noPod.js useOn: started
 * when stopped, only what the pod lacks, the pick renamed to "<pod name>/<file>" in Basic Settings' saved fields + each style's
 * Basic Settings, the NO_Pod dropped when nothing of it is left), a pod made again renames "NO_Pod (x)/…" too, the routes and
 * the box (static/nopod.js). A temporary folder; RunPod and the pods stubbed - no studio, no network.
 * Tim (verbatim): "also ask the user if the model + vae + textencoder should be added to an existing pod. show user running pods
 * and stopped pods. check if the files exist, only upload necessary files that don't exist on the pod" + "if user chooses new pod
 * or uses an existing one then change the name of the model to pod name/model name ... check the full list of pods and models in
 * the pods to see if the model exists in any other pod - advise the user of which pod has it and ask if it should start that pod,
 * create a new pod or add the model to a different pod" */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "nopodwhere793-"));
process.env.H3_POD_INV_DIR = path.join(TMP, "pods");
const ROOT = path.join(__dirname, "..");
const W = require("../lib/noPodWhere"), PI = require("../lib/podInv"), NP = require("../lib/noPod"), NS = require("../static/nopod.js");
const LC = require("../lib/layoutCfg"), BT = require("../lib/basicTmp");
LC.setBase(TMP); BT.setFile(path.join(TMP, "basic_settings.tmp"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ---- pure
  const model = { cat: "checkpoints", rel: "SDXL/juggernautXL_v9.safetensors", size: 6.9e9, kind: "model", state: "on" };
  const vae = { cat: "vae", rel: "sdxl_vae.safetensors", size: 3.3e8, kind: "vae", state: "on" };
  const te = { cat: "text_encoders", rel: "clip_l.safetensors", size: 2.4e8, kind: "te", state: "on" };
  const lora = { cat: "loras", rel: "grain.safetensors", size: 1.5e8, kind: "lora", state: "on" };
  const old = { id: "podOLD1", name: "SDXL pod", gone: true, keep: true, files: [model, vae, te, lora] };
  check("companions: a model takes its VAE + text encoders along, a LoRA nothing", W.companions(old, model).map((f) => f.rel).join() === "sdxl_vae.safetensors,clip_l.safetensors" && W.companions(old, lora).length === 0);
  const other = { id: "podB", name: "B", files: [{ cat: "checkpoints", rel: "juggernautXL_v9.safetensors", size: 6.9e9, kind: "model" }] };
  check("findIn: the same file name in another folder counts", (W.findIn(other, model) || {}).rel === "juggernautXL_v9.safetensors");
  check("findIn: a different size is another file; a LoRA of the same name is not the model", !W.findIn({ files: [{ cat: "checkpoints", rel: "SDXL/juggernautXL_v9.safetensors", size: 2e9 }] }, model)
    && !W.findIn({ files: [{ cat: "loras", rel: "SDXL/juggernautXL_v9.safetensors", size: 6.9e9 }] }, model));
  check("vramOf: the cards RunPod rents", W.vramOf("RTX 4090") === 24 && W.vramOf("NVIDIA A40") === 48 && W.vramOf("RTX A4000") === 16 && W.vramOf("H100 SXM") === 80 && W.vramOf("RTX 5090") === 32 && W.vramOf("Mystery") === 0);
  const invs = [
    old,
    { id: "podHasS", name: "SDXL-2", files: [model, vae] },                              // has it, stopped
    { id: "podHasR", name: "SDXL-3", files: [Object.assign({}, model, { rel: "juggernautXL_v9.safetensors" }), vae, te] },   // has it, running
    { id: "podRun", name: "Krea pod", files: [vae], disk: { free: 4e9 } },               // running, VAE there, not enough room
    { id: "podStop", name: "Small", files: [], disk: { free: 9e11 } },                     // stopped, small card
    { id: "podGone", name: "Dead", gone: true, files: [model] },                         // terminated earlier - not offered
    { id: "podTerm", name: "Term", files: [model] }];                                    // RunPod says terminated - not offered
  const status = { podHasS: { status: "EXITED", gpu: "RTX 4090" }, podHasR: { status: "RUNNING", gpu: "RTX 4090" }, podRun: { status: "RUNNING", gpu: "A40" }, podStop: { status: "EXITED", gpu: "RTX A4000" }, podTerm: { status: "TERMINATED" } };
  const w = W.where(model, W.companions(old, model), invs, status, old.id);
  check("where: the pods that have the file, running first", w.has.map((r) => r.id).join() === "podHasR,podHasS" && w.has[0].status === "running" && w.has[1].status === "stopped", w.has);
  check("where: the others running first, then stopped; the NO_Pod itself, gone and terminated pods left out", w.others.map((r) => r.id).join() === "podRun,podStop", w.others.map((r) => r.id));
  const kr = w.others[0], sm = w.others[1];
  check("where: what is there and what is sent (only the missing ones count)", kr.there.join() === "sdxl_vae.safetensors" && kr.missing.join() === "juggernautxl_v9.safetensors,clip_l.safetensors" && kr.send_gb === 7.1, kr);
  check("where: not enough room on it (its free room known)", kr.warn.some((x) => /not enough room/.test(x)) && kr.free_gb === 4, kr.warn);
  check("where: a model bigger than the card = may not fit its 16 GB card (not said for a 48 GB card)", !kr.warn.some((x) => /may not fit/.test(x)) && W.where(Object.assign({}, model, { size: 17e9 }), [], [invs[4]], status, "x").others[0].warn.some((x) => /may not fit its 16 GB card/.test(x)));
  check("rowWords: 'VAE there, sends 7.1 GB, not enough room…' / 'everything is there'", /sdxl_vae\.safetensors there, sends 7\.1 GB, not enough room/.test(W.rowWords(kr)) && W.rowWords(w.has[0]) === "everything is there", [W.rowWords(kr), W.rowWords(w.has[0])]);
  check("where: a pod RunPod is starting = starting (after running, before stopped)", W.stateOf("STARTING") === "starting" && W.where(model, [], [invs[3], invs[4]], { podRun: { status: "EXITED" }, podStop: { status: "STARTING" } }, "x").others.map((r) => r.status).join() === "starting,stopped");
  check("where: no RunPod answer = status not checked (still offered)", W.where(model, [], [invs[4]], {}, "x").others[0].status === "unknown");
  const mt = W.mergeTodo([vae], [model, vae, te]);
  check("mergeTodo: missing files added as todo, the ones it has kept as they are", mt.length === 3 && mt[0].state === "on" && mt[1].state === "todo" && mt[2].rel === "clip_l.safetensors" && mt[2].kind === "te", mt);
  const o1 = { a: "NO_Pod (SDXL pod)/SDXL/juggernautXL_v9.safetensors", b: ["no_pod (sdxl pod)/sdxl/juggernautxl_v9.safetensors", "other"], c: { d: "NO_Pod (SDXL pod)/x" } };
  const n1 = W.renameIn(o1, W.refMap("NO_Pod (SDXL pod)/SDXL/juggernautXL_v9.safetensors", "Krea pod/SDXL/juggernautXL_v9.safetensors"));
  check("refMap + renameIn: the exact name (any case) renamed everywhere, others left", n1 === 2 && o1.a === "Krea pod/SDXL/juggernautXL_v9.safetensors" && o1.b[0] === o1.a && o1.b[1] === "other" && o1.c.d === "NO_Pod (SDXL pod)/x", o1);
  const o2 = { a: "NO_Pod (R)/a.safetensors", b: "NO_Pod (Rx)/b" };
  check("refMap prefix: every 'NO_Pod (R)/…' -> 'R/…' (a longer name is another pod)", W.renameIn(o2, W.refMap("NO_Pod (R)/", "R/", true)) === 1 && o2.a === "R/a.safetensors" && o2.b === "NO_Pod (Rx)/b", o2);

  // ---- the box (pure)
  const j = { file: model.rel, companions: ["sdxl_vae.safetensors", "clip_l.safetensors"], pod: { label: "NO_Pod (SDXL pod)", name: "SDXL pod", recipe: { template_id: "t" }, recipe_line: "RunPod Pytorch · RTX 4090" },
    has: w.has.map((r) => Object.assign(r, { words: W.rowWords(r) })), others: w.others.map((r) => Object.assign(r, { words: W.rowWords(r) })) };
  const h = NS.whereHtml(j);
  check("box: which pods have it - Use that pod (running) / Start that pod (stopped)", /These pods have it/.test(h) && /data-npuse="podHasR">Use that pod/.test(h) && /data-npuse="podHasS">Start that pod/.test(h), h);
  check("box: the other pods as a choice (running first, 'stopped - starts it'), what each would be sent, warnings", /Or put it on another pod/.test(h) && h.indexOf('value="podRun"') < h.indexOf('value="podStop"') && /value="podRun" checked/.test(h)
    && /stopped - starts it/.test(h) && /sends 7\.1 GB/.test(h) && /only what the pod does not have is sent/.test(h));
  check("box: it renders with its VAE + text encoder - they go with it; Not now / Make the pod again (its recipe) / Use this pod", /It renders with sdxl_vae\.safetensors \+ clip_l\.safetensors/.test(h) && /data-npmake="0">Not now/.test(h) && /data-npmake="1">Make the pod again/.test(h) && /RunPod Pytorch · RTX 4090/.test(h) && /data-npusesel="1">Use this pod/.test(h));
  const h2 = NS.whereHtml(Object.assign({}, j, { has: [], pod: Object.assign({}, j.pod, { recipe: null }) }));
  check("box: no pod has it = 'Put it on one of your pods'; no recipe = no Make the pod again", /Put it on one of your pods/.test(h2) && !/data-npmake="1"/.test(h2) && !/have it/.test(h2));

  // ---- live: useOn (the pods stubbed; the inventories + basic.cfg + basic_settings.tmp in the temporary folder)
  const RV = require("../lib/podRevive"), PA = require("../lib/podActivity");
  const moved = []; RV.moveStyles = (a, b, n) => moved.push([a, b, n]);
  const notes = []; PA.note = (pod, t) => notes.push(t);
  PI.save({ id: "podOLD1", name: "SDXL pod", gone: true, keep: true, files: [model, vae, te, lora] });
  PI.save({ id: "podRun", name: "Krea pod", files: [Object.assign({}, vae, { rel: "SDXL/sdxl_vae.safetensors" })] });
  PI.save({ id: "podStop", name: "Small", files: [] });
  const REF = "NO_Pod (SDXL pod)/SDXL/juggernautXL_v9.safetensors";
  LC.write("basic", { imgCkpt: REF, vidModel: "", other: "keep me" });
  BT.save({ kind: "image", id: "s1", name: "SDXL", basic: { imgCkpt: REF, steps: "20" } });
  const waited = [], put = [];
  const stub = { wait: async (id, port) => { waited.push([id, port]); }, put: async (id, port) => { put.push([id, port]); return { missed: [] }; } };
  let err = ""; try { await NP.useOn(REF, "podNone", stub); } catch (e) { err = e.status + " " + e.message; }
  check("useOn: an unknown pod refused (404), nothing renamed", /^404 /.test(err) && LC.read("basic").imgCkpt === REF, err);
  err = ""; try { await NP.useOn(REF, "podStop", Object.assign({}, stub, { stopped: true, start: async () => { throw Object.assign(new Error("x"), { said: "There are no longer any instances available with the requested specifications" }); } })); } catch (e) { err = e.status + " " + e.message; }
  check("useOn: RunPod cannot start the stopped pod = its words (409), nothing renamed / moved", /^409 RunPod did not start Small: There are no longer/.test(err) && /a stopped pod may get no GPU back/.test(err) && LC.read("basic").imgCkpt === REF && !PI.load("podStop").files.length, err);
  const r1 = await NP.useOn(REF, "podRun", Object.assign({ port: 8188 }, stub));
  await sleep(50);
  const run = PI.load("podRun");
  check("useOn: the pick's new name = '<pod name>/<file>'", r1.name === "Krea pod/SDXL/juggernautXL_v9.safetensors" && r1.pod_id === "podRun" && !r1.started, r1);
  check("useOn: only what the pod lacks goes on it (the model + text encoder as todo; its VAE in another folder used)", r1.sending.join() === "juggernautXL_v9.safetensors,clip_l.safetensors" && r1.there === 1
    && run.files.filter((f) => f.state === "todo").map((f) => f.kind).join() === "model,te" && run.files.length === 3, run.files);
  check("useOn: renamed in basic.cfg (Basic Settings) + each style's saved Basic Settings; others untouched", LC.read("basic").imgCkpt === r1.name && LC.read("basic").other === "keep me" && BT.read().styles["image:s1"].basic.imgCkpt === r1.name && r1.renamed >= 2, { basic: LC.read("basic"), tmp: BT.read().styles });
  check("useOn: the NO_Pod keeps its other files (its LoRA, the VAE / text encoder its models use), no longer the model", (() => { const o = PI.load("podOLD1"); return o && o.files.map((f) => f.kind).sort().join() === "lora,te,vae" && !r1.dropped; })());
  check("useOn: the styles linked to the gone pod follow; the files are sent after the pod answers, in the background", moved.some((m) => m[0] === "podOLD1" && m[1] === "podRun") && waited.length === 1 && waited[0][0] === "podRun" && put.length === 1 && put[0][1] === 8188, { moved, waited, put });
  check("after useOn the new name finds the pod; the old NO_Pod name of that file no longer resolves", (PI.resolve(r1.name, PI.live(), null) || {}).pod_id === "podRun" && !PI.resolve(REF, PI.live(), null));
  // the LoRA onto the stopped pod: started first, then the NO_Pod has nothing left to list -> dropped
  const started = [];
  const r2 = await NP.useOn("NO_Pod (SDXL pod)/grain.safetensors", "podStop", Object.assign({}, stub, { stopped: true, start: async (id) => { started.push(id); } }));
  await sleep(50);
  check("useOn: a stopped pod is started first (then the pod's activity says why)", started.join() === "podStop" && r2.started === true && notes.some((t) => /started for grain\.safetensors \(from NO_Pod \(SDXL pod\)\)/.test(t)), { r2, notes });
  check("useOn: a LoRA takes no VAE / text encoder; the NO_Pod with none of its models / LoRAs left is dropped", r2.sending.join() === "grain.safetensors" && r2.dropped === true && !PI.load("podOLD1") && r2.name === "Small/grain.safetensors", r2);

  // ---- a pod made again: "NO_Pod (<name>)/…" -> "<name>/…" in Basic Settings' saved fields
  const P = require("../lib/pods");
  P.create = async (o) => ({ pod: { id: "podREMADE", name: o.name }, port: 8188 });
  PI.save({ id: "podR1", name: "Remade", gone: true, keep: true, remake_ok: true, recipe: { template_id: "runpod-torch-v280", gpu: "NVIDIA A40", count: 1, cloud: "SECURE", disk: 50, volume: 100, port: 8188 }, files: [model, lora] });
  LC.write("basic", { imgCkpt: "NO_Pod (Remade)/SDXL/juggernautXL_v9.safetensors", lora1: "NO_Pod (Remade)/grain.safetensors" });
  await NP.remake("podR1", null);
  check("remake: every 'NO_Pod (Remade)/…' in basic.cfg renamed 'Remade/…'", LC.read("basic").imgCkpt === "Remade/SDXL/juggernautXL_v9.safetensors" && LC.read("basic").lora1 === "Remade/grain.safetensors", LC.read("basic"));
  check("podInv: the pod's free room from its listing is kept (fromList) and saved", (() => { PI.fromList("podDisk", { files: [], disk: { free: 5e9, total: 1e11 } }, "Disk"); const d = (PI.load("podDisk") || {}).disk || {}; return d.free === 5e9 && d.total === 1e11; })());

  // ---- the wiring
  const R = src("routes/podInv.js");
  check("routes: GET nopod/where (RunPod asked, running pods list their files, noPodWhere.where), POST nopod/use (stopped = started), GET nopod/now",
    /app\.get\("\/api\/podinv\/nopod\/where"/.test(R) && /W\.where\(f, comps, PI\.all\(\), now\.status, old\.id\)/.test(R) && /PI\.refresh\(i\.id/.test(R)
    && /app\.post\("\/api\/podinv\/nopod\/use"/.test(R) && /stopped: \/EXITED\|STOPPED\/\.test\(st\)/.test(R) && /app\.get\("\/api\/podinv\/nopod\/now"/.test(R)
    && R.indexOf("/api/podinv/nopod/where") < R.indexOf('app.get("/api/podinv/:id"'));
  const S = src("static/nopod.js");
  check("page: a NO_Pod pick asks /nopod/where - other pods = the where box, none = the 2.789.0 box; Use = /nopod/use, the field renamed; stale names renamed",
    /\/api\/podinv\/nopod\/where\?name=/.test(S) && /many \? whereHtml\(j\) : pickHtml\(j\)/.test(S) && /\/api\/podinv\/nopod\/use/.test(S) && /setField\(el, x\.j\.name\)/.test(S) && /\/api\/podinv\/nopod\/now\?name=/.test(S) && /renameStale/.test(S));
  check("noPod: putBack sends each kind to its own folders (catsFor); remake renames the NO_Pod picks", /SD\.ensure\(id, port, catsFor\(f\)/.test(src("lib/noPod.js")) && /refMap\("NO_Pod \(" \+ PI\(\)\.baseLabel\(inv\) \+ "\)\/"/.test(src("lib/noPod.js"))
    && JSON.stringify(NP.catsFor({ kind: "te" })) === '["text_encoders","clip"]' && JSON.stringify(NP.catsFor({ kind: "vae" })) === '["vae"]');

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* fine */ }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed - " + (e && e.stack)); process.exit(1); });
