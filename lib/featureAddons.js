// bitGen Studio — lib/featureAddons.js (2.593.0): FACE FIX and CONTROLNET are add-ons now.
//
// Tim: "make facefix and controlnet into addons and put the links to dl in addons tab. only show if they are enabled in
// the general tab. if they are enabled check for all the models and download them into the correct folder if they do
// not exist".
//   Settings ▸ General ▸ Add-ons in the studio: ☐ Face fix, ☐ ControlNet (config.features, default off). Off = Basic
//   Settings hides its section (and ControlNet its Settings tab), Settings ▸ Add-ons hides its card, a render never
//   uses it. On = all of them show, and its node packs + models are checked and whatever is missing is downloaded into
//   the folder it belongs in (one add-on job at a time; again at every start while it is on).
//   facefix     ComfyUI-Impact-Pack + ComfyUI-Impact-Subpack (custom_nodes); face_yolov8m.pt -> models/ultralytics/bbox
//   controlnet  comfyui_controlnet_aux (custom_nodes); the four preprocessors' models -> custom_nodes/
//               comfyui_controlnet_aux/ckpts/<repo>/ (where the pack looks - a pack that keeps them elsewhere just
//               downloads its own on the first render); the SDXL ControlNets (xinsir union ProMax + OpenPose /
//               Scribble / Depth) -> models/controlnet. The card lists every download link (GitHub / Hugging Face).
//   ADDONS {id: {feature, label, packs, items}}   enabled(id, cfg?)   setEnabled(id, on) -> features
//   status(id, place?)  {installed, packs, items: [{id, label, for, size, present, need, dflt}], missing, note}
//   links(id)           [{label, url, kind: pack | model, dest}]
//   install(id, log, picks?, deps?) -> {ok, error}      remove(id, log, place?) -> {ok, error} (the model files only)
//   ensure(ids, deps?)  queue the downloads of what is missing (lib/addons' one job at a time)  autoCheck(deps?)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");

const ADDONS = {
  facefix: { feature: "facefix", label: "Face fix (FaceDetailer)", packs: ["impact", "impactsub"],
    for: "Basic Settings ▸ Face fix: every face of the final picture re-drawn at a proper size and pasted back - no more distorted faces",
    needs: "ComfyUI (Settings ▸ ComfyUI); git for the node packs. Restart ComfyUI once after a node pack is added",
    items: [{ id: "detector", label: "Face detector (YOLOv8m)", for: "finds the faces (models/ultralytics/bbox)", files: ["face_yolo"], need: true }] },
  controlnet: { feature: "controlnet", label: "ControlNet (a second model follows the first picture)", packs: ["cnaux"],
    for: "Basic Settings ▸ ControlNet (and the Settings ▸ ControlNet chain styles): the first picture becomes a pose / scribble / lineart / depth map and a second model renders the final picture from it",
    needs: "ComfyUI (Settings ▸ ComfyUI); git for the node pack. The ControlNets here are for an SDXL / Pony / Illustrious second model. Restart ComfyUI once after the node pack is added",
    items: [
      { id: "preprocessors", label: "The preprocessors' models (DWPose, PiDiNet, Lineart, Depth Anything V2)", for: "make the control map from the first picture (custom_nodes/comfyui_controlnet_aux/ckpts)",
        files: ["cn_ann_dwpose_det", "cn_ann_dwpose_pose", "cn_ann_pidinet", "cn_ann_lineart", "cn_ann_lineart2", "cn_ann_depth"], need: true },
      { id: "union", label: "SDXL ControlNet Union ProMax (xinsir) - every type", for: "pose, scribble, lineart and depth in one file (models/controlnet)", files: ["cn_sdxl_union"], need: true },
      { id: "openpose", label: "SDXL OpenPose ControlNet (xinsir)", for: "Pose (models/controlnet)", files: ["cn_sdxl_openpose"], dflt: true },
      { id: "scribble", label: "SDXL Scribble ControlNet (xinsir)", for: "Scribble (models/controlnet)", files: ["cn_sdxl_scribble"], dflt: true },
      { id: "depth", label: "SDXL Depth ControlNet (xinsir)", for: "Depth (models/controlnet)", files: ["cn_sdxl_depth"], dflt: true },
    ] },
};
const IDS = Object.keys(ADDONS);

const Models = () => require("./setupModels");
const Packs = () => require("./setupPacks");
const entry = (id) => Models().byId(id);
const place = () => require("./aiFillAddon").place();
const fmt = (b) => require("./aiFillAddon").fmt(b);
const paths = (pl) => ({ comfyModels: pl.models, comfyNodes: pl.customNodes, app: core.BASE });

/** is the add-on switched on in Settings ▸ General (config.features.<id>) */
function enabled(id, cfg) {
  const f = ((cfg || core.getConfig() || {}).features) || {};
  return f[id] === true;
}
function features(cfg) { const o = {}; for (const id of IDS) o[id] = enabled(id, cfg); return o; }
/** switch one on / off (saved in custom.settings) -> the features */
function setEnabled(id, on) {
  if (!ADDONS[id]) { const e = new Error("no such add-on " + id); e.status = 400; throw e; }
  const cfg = core.getConfig();
  cfg.features = Object.assign({}, cfg.features || {}, { [id]: on === true });
  core.setConfig(cfg);
  return features(cfg);
}

const wantItems = (a, picks) => {
  const p = Array.isArray(picks) && picks.length ? picks : a.items.filter((i) => i.need || i.dflt).map((i) => i.id);
  return a.items.filter((i) => i.need || p.includes(i.id));
};

function status(id, pl0) {
  const a = ADDONS[id];
  const p = pl0 || place();
  const pk = p.customNodes ? Packs().status(p.customNodes).filter((x) => a.packs.includes(x.id)) : [];
  const items = a.items.map((it) => ({ id: it.id, label: it.label, for: it.for, need: !!it.need, dflt: !!it.dflt || !!it.need,
    size: fmt(it.files.reduce((s, f) => s + ((entry(f) || {}).size || 0), 0)),
    present: !!p.ok && it.files.every((f) => { const m = entry(f); return !!m && Models().present(m, paths(p)); }) }));
  const packsOk = p.ok && pk.length === a.packs.length && pk.every((x) => x.present);
  const missing = [...pk.filter((x) => !x.present).map((x) => x.folder), ...items.filter((i) => (i.need || i.dflt) && !i.present).map((i) => i.label)];
  const installed = packsOk && items.filter((i) => i.need).every((i) => i.present);
  return { installed, packs: pk.map((x) => ({ folder: x.folder, present: x.present })), items, missing: p.ok ? missing : [],
    note: !p.ok ? `ComfyUI not found (${p.error}) - set its folder in Settings ▸ ComfyUI first`
      : missing.length ? "missing: " + missing.join(", ") : "everything is there" };
}

/** the download links the card shows - the node packs (GitHub) and every model file (Hugging Face) */
function links(id) {
  const a = ADDONS[id];
  const packs = Packs().LIST.filter((x) => a.packs.includes(x.id)).map((x) => ({ kind: "pack", label: x.folder, url: x.url, dest: "ComfyUI/custom_nodes/" + x.folder }));
  const files = [];
  for (const it of a.items) for (const f of it.files) {
    const m = entry(f); if (!m) continue;
    const dest = m.dest.replace(/^comfy\//, "ComfyUI/models/").replace(/^comfynodes\//, "ComfyUI/custom_nodes/") + "/" + (m.as || path.basename(m.file));
    files.push({ kind: "model", label: m.label, url: `https://huggingface.co/${m.repo}/blob/main/${m.file}`, dest });
  }
  return packs.concat(files);
}

async function install(id, log, picks, deps) {
  const a = ADDONS[id];
  if (!a) return { ok: false, error: "no such add-on " + id };
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const X = require("./setupExec");
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1", PIP_DISABLE_PIP_VERSION_CHECK: "1", GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" });
  // 1 the node packs
  const st = Packs().status(pl.customNodes);
  const packInstall = d.packInstall || ((pack) => Packs().install(pack, pl.customNodes, { git: X.which("git", require("./setupRun").runtimeDirs()), python: pl.python, log, env }));
  let newPack = false;
  for (const pid of a.packs) {
    const p = st.find((x) => x.id === pid);
    if (!p) continue;
    if (p.present) { log(`[ok] ${p.folder} is in ComfyUI already`, false); continue; }
    log(`[..] node pack ${p.folder} (${p.url})`, false);
    const r = await packInstall(p);
    if (!r || !r.ok) return { ok: false, error: `${p.folder} did not install: ${(r && r.error) || "see the log"}` };
    newPack = true;
  }
  // 2 the model files - only what is not there yet
  const token = ((core.getConfig() || {}).hf || {}).token || "";
  const dl = d.download || ((m) => { let last = -1; return Models().download(m, { token, paths: paths(pl), python: require("./setupRun").appPython(), log, env, engine: "auto",
    onProgress: (pr) => { const pc = pr && pr.total ? Math.floor((pr.got / pr.total) * 10) * 10 : -1; if (pc > last) { last = pc; log(`… ${m.as || path.basename(m.file)} ${pc} %`, false); } } }); });
  let got = 0, had = 0;
  for (const it of wantItems(a, picks)) {
    for (const f of it.files) {
      const m = entry(f);
      if (!m) { log(`[warn] ${f} is not in the model list`, true); continue; }
      const dest = Models().destPath(m, paths(pl));
      if (Models().present(m, paths(pl))) { had++; log(`[ok] ${m.as || path.basename(m.file)} is there (${dest})`, false); continue; }
      log(`[..] ${it.label}: ${m.repo}/${m.file} (${fmt(m.size || 0)}) -> ${dest}`, false);
      const r = await dl(m, dest);
      if (!r || !r.ok) return { ok: false, error: `${m.as || path.basename(m.file)}: ${(r && r.error) || "the download failed"}` };
      got++;
      log(`[ok] ${m.as || path.basename(m.file)}`, false);
    }
  }
  log(`[ok] ${a.label}: ${got} file(s) downloaded, ${had} already there` + (newPack ? " - restart ComfyUI once so it loads the new node pack" : ""), false);
  return { ok: true, downloaded: got, had };
}

async function remove(id, log, pl0) {
  const a = ADDONS[id];
  if (!a) return { ok: false, error: "no such add-on " + id };
  const pl = pl0 || place();
  if (!pl.ok) return { ok: false, error: "ComfyUI's folders are not known" };
  let n = 0;
  for (const it of a.items) for (const f of it.files) {
    const m = entry(f); if (!m) continue;
    const p = Models().destPath(m, paths(pl));
    try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); n++; log(`[ok] deleted ${p}`, false); } } catch (e) { log(`[warn] could not delete ${p}: ${e.message}`, true); }
  }
  log(`[ok] ${n} model file(s) removed - the node packs stay in ComfyUI (other things may use them)`, false);
  return { ok: true };
}

/* ---- the automatic check: what is on gets what it is missing, one job at a time */
let pending = [];
let timer = null;
function pump(deps) {
  const d = deps || {};
  const A = d.addons || require("./addons");
  clearTimeout(timer); timer = null;
  while (pending.length) {
    if (A.busy()) { timer = setTimeout(() => pump(deps), d.wait || 5000); if (timer.unref) timer.unref(); return; }
    const id = pending.shift();
    if (!enabled(id)) continue;
    const s = status(id, d.place);
    if (!s.missing.length) continue;
    const r = A.start(id, "install", {});
    if (r && r.error) console.error(`[bitgen-studio] ${id}: ${r.error}`);
    else console.log(`[bitgen-studio] ${ADDONS[id].label} is on - downloading what is missing: ${s.missing.join(", ")}`);
  }
}
/** queue the downloads of what the add-ons miss (they must be on) -> the queued ids */
function ensure(ids, deps) {
  for (const id of ids || []) if (ADDONS[id] && enabled(id) && !pending.includes(id)) pending.push(id);
  const q = pending.slice();
  pump(deps);
  return q;
}
/** at start: every add-on that is on, checked (a moment after the server is up) */
function autoCheck(deps) {
  const on = IDS.filter((id) => enabled(id));
  if (!on.length) return [];
  const p = (deps && deps.place) || place();
  if (!p.ok) return [];
  return ensure(on, deps);
}

module.exports = { ADDONS, IDS, enabled, features, setEnabled, status, links, install, remove, ensure, autoCheck, _pending: () => pending.slice(), _reset: () => { pending = []; clearTimeout(timer); timer = null; } };
