// bitGen Studio — lib/rpslStyles.js (2.744.0): WHICH STYLES A RUNPOD SERVERLESS ENDPOINT CAN RENDER.
// Tim (verbatim): "if user is using runpod only show the styles that will work with runpod"
//
// An endpoint cannot be asked which nodes it has (RunPod's worker has no /object_info), so the studio knows what its
// image carries: RunPod's ComfyUI worker 5.10.0 = ComfyUI 0.34.0 and NO node packs (lib/comfyCoreNodes.json, read from
// ComfyUI's source by scripts/make-comfy-core-nodes.py). Settings ▸ Remote GPU ▸ RunPod Serverless says which:
//   rgpu.serverless.comfy     "0.34.0" (the worker's own image, the default) | "latest" (an image built with a newer one)
//   rgpu.serverless.show_all  true = "my image has node packs": every style shows (the studio cannot know which packs)
// A style WORKS when every node class of the workflow(s) it renders with is in that ComfyUI:
//   image / music  its workflow (an engine other than ComfyUI = no: the endpoint is a ComfyUI)
//   video          its own workflow, else per mode workflows[mode] || Settings ▸ ComfyUI's template for the mode
//                  (engine.comfy.workflows[mode] || comfy_workflows/<mode>.json) - it works when ANY mode does (modes);
//                  a style that sets its own workflows for some modes counts only those (it is made for them)
// A workflow saved in ComfyUI's UI format does not: turning it into the API format needs /object_info. Nor do the video
// families whose worker builds or fills its graph from /object_info (ARCH_NEEDS_INFO): LTX 2.3 / 2.5 (ltx_worker.py
// converts Comfy-Org's UI templates with it) and Wan 2.1 / 2.2 (wan_worker.py picks its model files from ComfyUI's
// lists - shown again with "show every style", for an image whose files the style names).
// The workers add only core nodes (LoRA loaders) - their extras (speed-ups, the face fix) ask /object_info first and
// are left out on an endpoint.
// Pure: classesOf, missingFrom, checkStyle (scripts/test-rpslstyles744.js). all() reads the styles + the config.
"use strict";
const fs = require("fs");
const path = require("path");

let CORE = null;
function core() { return require("./core"); }
function coreNodes() { if (!CORE) CORE = require("./comfyCoreNodes.json"); return CORE; }
/** the ComfyUI versions the studio knows -> [{id, label, date, count}] */
function versions() {
  const v = coreNodes().versions;
  return Object.entries(v).map(([id, x]) => ({ id, date: x.date, count: x.nodes.length,
    label: id === "latest" ? `a newer ComfyUI (as of ${x.date})` : `ComfyUI ${id} - RunPod's worker image 5.10.0` }));
}
const SETS = {};
function available(ver) {
  const v = coreNodes().versions[ver] ? ver : "0.34.0";
  if (!SETS[v]) SETS[v] = new Set(coreNodes().versions[v].nodes);
  return SETS[v];
}
/** a workflow -> {classes, ui} (pure). ui = ComfyUI's UI format (nodes[] + links[]), not the API one */
function classesOf(g) {
  if (!g || typeof g !== "object") return { classes: [], ui: false };
  if (Array.isArray(g.nodes)) return { classes: [...new Set(g.nodes.map((n) => n && n.type).filter(Boolean))].sort(), ui: true };
  const cs = new Set();
  for (const [k, n] of Object.entries(g)) if (!k.startsWith("_") && n && typeof n === "object" && n.class_type) cs.add(String(n.class_type));
  return { classes: [...cs].sort(), ui: false };
}
const missingFrom = (classes, have) => classes.filter((c) => !have.has(c));
const ARCH_NEEDS_INFO = {
  "ltx-2.3": "the LTX worker turns its templates into a ComfyUI graph with /object_info, which an endpoint cannot answer",
  "ltx-2.5": "the LTX worker turns its templates into a ComfyUI graph with /object_info, which an endpoint cannot answer",
  wan21: "the Wan worker picks its model files from ComfyUI's model lists (/object_info), which an endpoint cannot give",
  wan22: "the Wan worker picks its model files from ComfyUI's model lists (/object_info), which an endpoint cannot give",
};
const CACHE = new Map();      // file -> {mtime, info}
function readWf(rel) {
  if (!rel) return null;
  const p = path.isAbsolute(rel) ? rel : path.join(core().BASE, rel);
  let st; try { st = fs.statSync(p); } catch { return { missingFile: true }; }
  const c = CACHE.get(p);
  if (c && c.mtime === st.mtimeMs) return c.info;
  let info;
  try { info = classesOf(JSON.parse(fs.readFileSync(p, "utf8"))); } catch { info = { bad: true }; }
  CACHE.set(p, { mtime: st.mtimeMs, info });
  return info;
}
/** one workflow file -> {ok, why, missing} (read = readWf, injectable for the tests) */
function checkWf(rel, have, read) {
  const info = (read || readWf)(rel);
  const name = path.basename(String(rel || ""));
  if (!info) return { ok: false, why: "no workflow", missing: [] };
  if (info.missingFile) return { ok: false, why: `${name} is not in this install`, missing: [] };
  if (info.bad) return { ok: false, why: `${name} cannot be read`, missing: [] };
  if (info.ui) return { ok: false, why: `${name} is saved in ComfyUI's UI format - an endpoint cannot turn it into the API format`, missing: [] };
  const miss = missingFrom(info.classes, have);
  return miss.length ? { ok: false, why: `${name} needs ${miss.length === 1 ? "a node" : "nodes"} the endpoint's ComfyUI does not have: ${miss.slice(0, 6).join(", ")}${miss.length > 6 ? " …" : ""}`, missing: miss }
    : { ok: true, why: "", missing: [] };
}
/** a style -> {ok, why, missing, modes?} (pure with `read` and `cfg` given) */
function checkStyle(st, have, cfg, read) {
  const s = st || {};
  if (s.engine && s.engine !== "comfy") return { ok: false, why: "it runs on this computer's own engine, not ComfyUI", missing: [] };
  if (s.chain) return { ok: false, why: "a ControlNet chain - its stages need node packs", missing: [] };
  if (s.kind !== "video") return checkWf(s.workflow, have, read);
  if (ARCH_NEEDS_INFO[s.arch]) return { ok: false, why: ARCH_NEEDS_INFO[s.arch], missing: [] };
  if (s.workflow) return checkWf(s.workflow, have, read);
  const tmpl = (((cfg || {}).engine || {}).comfy || {}).workflows || {};
  const modes = {}, whys = [], missing = new Set();
  const wfs = s.workflows || { t2va: "", ref2va: "", fl2va: "" };
  // a style that sets its own workflow for some modes is made for those (a swap style's ref2va): only they count;
  // a style that sets none renders with the templates of every mode
  const own = Object.keys(wfs).filter((m) => wfs[m]);
  for (const m of own.length ? own : Object.keys(wfs)) {
    const rel = wfs[m] || tmpl[m] || `comfy_workflows/${m}.json`;
    const r = checkWf(rel, have, read);
    modes[m] = r.ok;
    if (!r.ok) { whys.push(`${m}: ${r.why}`); r.missing.forEach((x) => missing.add(x)); }
  }
  const ok = Object.values(modes).some(Boolean);
  return { ok, why: ok ? (whys.length ? "not every mode - " + whys.join("; ") : "") : whys.join("; "), missing: [...missing], modes };
}
/** the endpoint's settings */
function settings() {
  const r = (core().getConfig() || {}).rgpu || {};
  const s = r.serverless || {};
  // 2.745.0: Basic Settings ▸ GPU "both" - only the kinds it sends to the endpoint are filtered (songs go with video)
  let kinds = { image: r.mode === "serverless", video: r.mode === "serverless", music: r.mode === "serverless" };
  const sp = r.split || {};
  if (sp.where === "both" && (r.remote_mode === "serverless")) kinds = { image: !!sp.image, video: !!sp.video, music: !!sp.video };
  return { on: kinds.image || kinds.video || kinds.music, kinds, comfy: coreNodes().versions[s.comfy] ? s.comfy : "0.34.0", show_all: !!s.show_all };
}
/** every style -> what the endpoint makes of it: {on, filter, comfy, show_all, styles: {id: {ok, why, kind, name, modes?}}, template} */
function all() {
  const st = settings(), have = available(st.comfy), cfg = core().getConfig() || {};
  const S = require("./styles"), out = {};
  for (const kind of ["image", "video", "music"]) {
    let list = []; try { list = S.read(core().STYLES_DIR, kind); } catch { list = []; }
    for (const s of list) out[s.id] = Object.assign({ kind, name: s.name }, checkStyle(Object.assign({ kind }, s), have, cfg));
  }
  // the video docker's "— template —" (no style): Settings ▸ ComfyUI's mode workflows
  const template = checkStyle({ kind: "video", workflows: { t2va: "", ref2va: "", fl2va: "" } }, have, cfg);
  const kinds = {}; for (const k of Object.keys(st.kinds)) kinds[k] = st.kinds[k] && !st.show_all;
  return { on: st.on, filter: st.on && !st.show_all, kinds, comfy: st.comfy, show_all: st.show_all, versions: versions(), styles: out, template };
}

module.exports = { ARCH_NEEDS_INFO, versions, available, classesOf, missingFrom, checkWf, checkStyle, settings, all };
