#!/usr/bin/env node
/* bitGen Studio — scripts/test-features593.js (2.593.0): FACE FIX and CONTROLNET are add-ons.
 * Tim: "make facefix and controlnet into addons and put the links to dl in addons tab. only show if they are enabled in
 * the general tab. if they are enabled check for all the models and download them into the correct folder if they do
 * not exist". lib/featureAddons.js (switches, status, links, install of what is missing, the automatic check),
 * lib/addons.js (shown only while on), routes (the render ignores them while off), the page (General switches,
 * static/features.js hides the sections). No server, nothing written outside a temp folder. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-feat593-"));
const core = require("../lib/core");
let CFG = { features: {} };
const saved = [];
core.getConfig = () => CFG;
core.setConfig = (c) => { CFG = c; saved.push(JSON.parse(JSON.stringify(c.features || {}))); };
const FA = require("../lib/featureAddons");
const A = require("../lib/addons");
const M = require("../lib/setupModels");

(async () => {
  try {
    // ---- the switches
    check("off by default; enabled() reads config.features", FA.enabled("facefix") === false && FA.enabled("controlnet") === false
      && FA.enabled("facefix", { features: { facefix: true } }) === true && JSON.stringify(FA.features()) === '{"facefix":false,"controlnet":false}');
    const f1 = FA.setEnabled("facefix", true);
    check("setEnabled saves config.features (custom.settings) and answers every switch", f1.facefix === true && f1.controlnet === false && saved.length === 1 && saved[0].facefix === true);
    check("setEnabled: an unknown add-on = 400", (() => { try { FA.setEnabled("nope", true); return false; } catch (e) { return e.status === 400; } })());

    // ---- shown only while on
    CFG = { features: { facefix: false, controlnet: false } };
    const ids0 = A.list().map((a) => a.id);
    CFG = { features: { facefix: true, controlnet: true } };
    const L = A.list(), fl = L.find((a) => a.id === "facefix"), cl = L.find((a) => a.id === "controlnet");
    check("Settings ▸ Add-ons: Face fix / ControlNet only while on (the others always)", !ids0.includes("facefix") && !ids0.includes("controlnet") && ids0.includes("solar") && fl && cl);
    check("their cards carry the download links: the node packs (GitHub) + every model (Hugging Face) and the folder it goes in",
      fl.links.some((l) => l.kind === "pack" && /ltdrdata\/ComfyUI-Impact-Pack$/.test(l.url)) && fl.links.some((l) => l.kind === "pack" && /ComfyUI-Impact-Subpack$/.test(l.url))
      && fl.links.some((l) => l.url === "https://huggingface.co/Bingsu/adetailer/blob/main/face_yolov8m.pt" && l.dest === "ComfyUI/models/ultralytics/bbox/face_yolov8m.pt")
      && cl.links.some((l) => /Fannovel16\/comfyui_controlnet_aux$/.test(l.url))
      && cl.links.some((l) => l.dest === "ComfyUI/custom_nodes/comfyui_controlnet_aux/ckpts/yzd-v/DWPose/yolox_l.onnx")
      && cl.links.some((l) => l.dest === "ComfyUI/models/controlnet/xinsir-union-promax-sdxl.safetensors" && /xinsir\/controlnet-union-sdxl-1\.0\/blob\/main\/diffusion_pytorch_model_promax\.safetensors$/.test(l.url))
      && cl.links.length === 1 + 6 + 4, cl.links.map((l) => l.dest));
    CFG = { features: {} };
    check("installing one that is off = refused in words", /switch it on in Settings ▸ General/.test(A.start("controlnet", "install", {}).error || ""));

    // ---- the catalog + where things go
    const ids = ["face_yolo", "cn_ann_dwpose_det", "cn_ann_dwpose_pose", "cn_ann_pidinet", "cn_ann_lineart", "cn_ann_lineart2", "cn_ann_depth", "cn_sdxl_union", "cn_sdxl_openpose", "cn_sdxl_scribble", "cn_sdxl_depth"];
    check("the model catalog has every file (group controlnet) and its group", ids.every((i) => M.byId(i)) && M.CATALOG.groups.some((g) => g.id === "controlnet"), ids.filter((i) => !M.byId(i)));
    const P = { comfyModels: path.join(tmp, "C", "models"), comfyNodes: path.join(tmp, "C", "custom_nodes"), app: tmp };
    check("destPath: comfy/ = ComfyUI's models, comfynodes/ = custom_nodes (or beside models when not given); the ControlNets renamed by type",
      M.destPath(M.byId("face_yolo"), P) === path.join(P.comfyModels, "ultralytics", "bbox", "face_yolov8m.pt")
      && M.destPath(M.byId("cn_ann_depth"), P) === path.join(P.comfyNodes, "comfyui_controlnet_aux", "ckpts", "depth-anything", "Depth-Anything-V2-Large", "depth_anything_v2_vitl.pth")
      && M.destPath(M.byId("cn_ann_pidinet"), { comfyModels: P.comfyModels, app: tmp }) === path.join(tmp, "C", "custom_nodes", "comfyui_controlnet_aux", "ckpts", "lllyasviel", "Annotators", "table5_pidinet.pth")
      && M.destPath(M.byId("cn_sdxl_openpose"), P) === path.join(P.comfyModels, "controlnet", "xinsir-openpose-sdxl.safetensors"));

    // ---- status + install of what is missing (a temp ComfyUI, fake pack installs + downloads)
    const pl = { ok: true, models: P.comfyModels, customNodes: P.comfyNodes, python: "" };
    fs.mkdirSync(P.comfyNodes, { recursive: true }); fs.mkdirSync(P.comfyModels, { recursive: true });
    CFG = { features: { facefix: true, controlnet: true } };
    const s0 = FA.status("facefix", pl);
    check("status: nothing there = not installed; missing = the two node packs + the detector", !s0.installed && s0.missing.join() === "ComfyUI-Impact-Pack,ComfyUI-Impact-Subpack,Face detector (YOLOv8m)", s0);
    const packs = [], dls = [], logs = [];
    const fake = { place: pl, packInstall: async (p) => { packs.push(p.folder); fs.mkdirSync(path.join(P.comfyNodes, p.folder), { recursive: true }); return { ok: true }; },
      download: async (m, dest) => { dls.push(path.relative(tmp, dest)); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, "x"); return { ok: true }; } };
    const r1 = await FA.install("facefix", (l) => logs.push(l), undefined, fake);
    check("install: the node packs, then the detector into models/ultralytics/bbox; restart ComfyUI said", r1.ok && packs.join() === "ComfyUI-Impact-Pack,ComfyUI-Impact-Subpack"
      && dls.join() === path.join("C", "models", "ultralytics", "bbox", "face_yolov8m.pt") && /restart ComfyUI once/.test(logs.join("\n")) && FA.status("facefix", pl).installed, { r1, packs, dls });
    packs.length = 0; dls.length = 0;
    const r2 = await FA.install("facefix", () => {}, undefined, fake);
    check("install again: nothing downloaded twice (already there)", r2.ok && r2.downloaded === 0 && r2.had === 1 && !packs.length && !dls.length, r2);
    // controlnet: a model already there is kept, the rest lands where it belongs
    const have = M.destPath(M.byId("cn_sdxl_depth"), P); fs.mkdirSync(path.dirname(have), { recursive: true }); fs.writeFileSync(have, "mine");
    const r3 = await FA.install("controlnet", () => {}, undefined, fake);
    const want = ["cn_ann_dwpose_det", "cn_ann_dwpose_pose", "cn_ann_pidinet", "cn_ann_lineart", "cn_ann_lineart2", "cn_ann_depth", "cn_sdxl_union", "cn_sdxl_openpose", "cn_sdxl_scribble"].map((i) => path.relative(tmp, M.destPath(M.byId(i), P)));
    check("ControlNet: comfyui_controlnet_aux, the six preprocessor models into its ckpts/<repo>/, the SDXL ControlNets into models/controlnet - the one already there kept",
      r3.ok && packs.join() === "comfyui_controlnet_aux" && JSON.stringify(dls) === JSON.stringify(want) && fs.readFileSync(have, "utf8") === "mine" && r3.had === 1 && FA.status("controlnet", pl).installed && !FA.status("controlnet", pl).missing.length, { dls, want });
    dls.length = 0;
    fs.unlinkSync(M.destPath(M.byId("cn_sdxl_union"), P));
    const r4 = await FA.install("controlnet", () => {}, ["union"], fake);
    check("the ticked list from the card: what is ticked + what is needed", r4.ok && dls.length === 1 && /xinsir-union-promax-sdxl/.test(dls[0]), dls);
    fs.unlinkSync(M.destPath(M.byId("cn_ann_depth"), P));
    const bad2 = await FA.install("controlnet", () => {}, undefined, Object.assign({}, fake, { download: async () => ({ ok: false, error: "no connection" }) }));
    check("...a missing file that will not download = refused, naming it", !bad2.ok && /depth_anything_v2_vitl\.pth: no connection/.test(bad2.error), bad2);
    const rm = await FA.remove("facefix", () => {}, pl);
    check("remove: the model files go, the node packs stay", rm.ok && !fs.existsSync(path.join(P.comfyModels, "ultralytics", "bbox", "face_yolov8m.pt")) && fs.existsSync(path.join(P.comfyNodes, "ComfyUI-Impact-Pack")));
    check("no ComfyUI = refused in words", !(await FA.install("facefix", () => {}, undefined, { place: { ok: false, error: "no folder" } })).ok);

    // ---- the automatic check: one at a time, only what is on and missing
    FA._reset();
    const started = []; let busy = false;
    const fakeA = { busy: () => busy, start: (id) => { started.push(id); busy = true; return { ok: true }; } };
    CFG = { features: { facefix: true, controlnet: false } };
    const q0 = FA.autoCheck({ place: pl, addons: fakeA, wait: 20 });
    check("at start: only the add-ons that are on are checked (ControlNet off = left alone); Face fix misses its detector -> downloading", q0.join() === "facefix" && started.join() === "facefix", { q0, started });
    CFG = { features: { facefix: true, controlnet: true } };
    FA.ensure(["controlnet", "facefix"], { place: pl, addons: fakeA, wait: 20 });
    check("...while a job runs the next waits (one at a time)", started.length === 1 && FA._pending().length >= 1, FA._pending());
    busy = false;
    await new Promise((r) => setTimeout(r, 120));
    check("...then ControlNet starts (it misses Depth Anything); Face fix, already queued, starts after it", started.join() === "facefix,controlnet", started);
    busy = false;
    await new Promise((r) => setTimeout(r, 120));
    FA._reset();
    const s9 = FA.status("controlnet", pl);
    started.length = 0; busy = false;
    fs.writeFileSync(M.destPath(M.byId("cn_ann_depth"), P), "x");
    FA.ensure(["controlnet"], { place: pl, addons: fakeA, wait: 20 });
    check("an add-on with nothing missing is not started", !started.includes("controlnet") && s9.missing.length === 1, { started, s9: s9.missing });

    // ---- the routes + the page
    const IDX = rd("routes", "index.js");
    check("the render ignores ControlNet / Face fix while they are off (routes/index.js); routes/features.js mounted from routes/index.js, never server.js",
      /if \(featOn\("controlnet"\) && \(b\.controlnet === true/.test(IDX) && /if \(featOn\("facefix"\) && b\.face_fix/.test(IDX) && /require\("\.\/features"\)\.mount\(app\)/.test(IDX)
      && !/features/.test(rd("misc", "server.js")) && /app\.post\("\/api\/features"/.test(rd("routes", "features.js")) && /FA\.ensure\(\[id\]\)/.test(rd("routes", "features.js")) && /FA\.autoCheck\(\)/.test(rd("routes", "features.js")));
    const PAGE = rd("static", "index.html");
    check("Settings ▸ General: the two switches; Generate Image sends them only while on; static/features.js loaded",
      /id="s_feat_facefix"/.test(PAGE) && /id="s_feat_controlnet"/.test(PAGE) && /H3Features\.on\("controlnet"\)\)\) body\.controlnet/.test(PAGE) && /H3Features\.on\("facefix"\)\)\) body\.face_fix/.test(PAGE)
      && /<script src="\/static\/features\.js"><\/script>/.test(PAGE));
    const FS = require("../static/features.js");
    check("static/features.js hides Basic Settings' Face fix, ControlNet and the ControlNet Settings tab while off",
      FS.HIDE.facefix.join() === 'h2.sec[data-sec="facefix"],#sec-facefix' && FS.HIDE.controlnet.includes('#settings .stabs [data-stab="cnet"]') && FS.HIDE.controlnet.includes("#sec-cnet")
      && PAGE.includes('data-sec="facefix"') && PAGE.includes('id="sec-cnet"') && PAGE.includes('data-stab="cnet"'));
    check("its message: off / on + downloading what is missing / on + all there",
      /off - hidden/.test(FS.message("facefix", false, {})) && /downloading what is missing \(Face detector\)/.test(FS.message("facefix", true, { queued: ["facefix"], status: { facefix: { missing: ["Face detector"] } } }))
      && /everything it needs is there/.test(FS.message("controlnet", true, { queued: [], status: { controlnet: { missing: [] } } })));
    check("the Add-ons tab lists the links (static/addons.js)", /data-aolinks/.test(rd("static", "addons.js")) && /target="_blank" rel="noopener"/.test(rd("static", "addons.js")));
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { FA._reset(); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
