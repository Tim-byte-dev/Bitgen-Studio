// bitGen Studio — lib/comfyDetect.js (2.622.0): WHERE IS COMFYUI INSTALLED, when Settings ▸ ComfyUI ▸ Folder is empty.
//
// Tim (verbatim): "if comfyui is installed add the diffusion models and checkpoint folder models to our model list in basic
// settings and the model manager"
//
// The lists (Basic Settings' checkpoint / video Model lists from /api/comfymodels, the 🧩 Model manager's cards from
// lib/modelCards.js) come from ComfyUI's models folders - but only once its folder is set, or while it is running. A
// ComfyUI that is installed and simply not pointed at gave empty lists. This finds it:
//   1. Settings ▸ ComfyUI ▸ Folder (when it holds a ComfyUI) - nothing else is looked at
//   2. $COMFYUI_PATH / $COMFYUI_DIR / $COMFY_DIR
//   3. ComfyUI Desktop: its config.json (basePath = the models' home) + extra_models_config.yaml, in
//      %APPDATA%\ComfyUI · ~/Library/Application Support/ComfyUI · ~/.config/ComfyUI
//   4. the usual places: beside bitGen Studio, the home folder (ComfyUI, ComfyUI_windows_portable, Documents, Desktop,
//      Downloads), Pinokio, Stability Matrix's packages, and on Windows the top of each drive (C:\ … H:\ and their AI /
//      Apps / Programs / Tools folders) - anything named *comfy* that holds main.py (or a portable build)
// detect({refresh}) -> {root, main, models, yaml, kind: "folder" | "portable" | "desktop", source, configured} | null
// (60 s cache). candidates(env) is pure-ish (paths only) for the tests; check(dir) says what a folder is.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

/** what a folder is: a ComfyUI (main.py), a portable build (ComfyUI/main.py + python_embeded), a Desktop base path
    (models/ + user/ or a .venv, no main.py), or nothing -> {root, main, models, kind} | null */
function check(dir) {
  if (!dir || !isDir(dir)) return null;
  const d = path.resolve(dir);
  if (isFile(path.join(d, "main.py")) && isDir(path.join(d, "comfy"))) return { root: d, main: d, models: path.join(d, "models"), kind: "folder" };
  if (isFile(path.join(d, "ComfyUI", "main.py"))) return { root: d, main: path.join(d, "ComfyUI"), models: path.join(d, "ComfyUI", "models"), kind: isDir(path.join(d, "python_embeded")) ? "portable" : "folder" };
  if (isFile(path.join(d, "main.py")) && isDir(path.join(d, "models"))) return { root: d, main: d, models: path.join(d, "models"), kind: "folder" };
  return null;
}
/** ComfyUI Desktop's per-user folder (its config.json + extra_models_config.yaml) */
function desktopDirs(env, home) {
  const out = [];
  if (env.APPDATA) out.push(path.join(env.APPDATA, "ComfyUI"));
  if (home) { out.push(path.join(home, "Library", "Application Support", "ComfyUI")); out.push(path.join(home, ".config", "ComfyUI")); }
  return out;
}
function desktop(env, home) {
  for (const d of desktopDirs(env, home)) {
    let cfg = null; try { cfg = JSON.parse(fs.readFileSync(path.join(d, "config.json"), "utf8")); } catch { cfg = null; }
    const base = cfg && (cfg.basePath || cfg.base_path);
    if (!base || !isDir(path.join(base, "models"))) continue;
    const yaml = ["extra_models_config.yaml", "extra_model_paths.yaml"].map((n) => path.join(d, n)).find(isFile) || "";
    return { root: path.resolve(base), main: "", models: path.join(path.resolve(base), "models"), kind: "desktop", yaml, source: "ComfyUI Desktop (" + path.join(d, "config.json") + ")" };
  }
  return null;
}
/** the folders to look in, most likely first (paths only) */
function candidates(env, opts) {
  const e = env || process.env, o = opts || {}, home = o.home != null ? o.home : os.homedir(), app = o.app || "";
  const out = [];
  const add = (p, src) => { if (p && !out.some((x) => x.dir === path.resolve(p))) out.push({ dir: path.resolve(p), source: src }); };
  (o.extra || []).forEach((d) => add(d, "the test's folder"));
  ["COMFYUI_PATH", "COMFYUI_DIR", "COMFY_DIR"].forEach((k) => { if (e[k]) add(e[k], "$" + k); });
  if (app) { add(path.join(app, "ComfyUI"), "beside bitGen Studio"); add(path.join(path.dirname(app), "ComfyUI"), "beside bitGen Studio"); add(path.join(path.dirname(app), "ComfyUI_windows_portable"), "beside bitGen Studio"); }
  if (home) {
    for (const sub of ["", "Documents", "Desktop", "Downloads", "AI", "ai", "apps"]) {
      for (const n of ["ComfyUI", "comfyui", "ComfyUI_windows_portable", "ComfyUI_windows_portable_nvidia"]) add(path.join(home, sub, n), "your home folder");
    }
    add(path.join(home, "pinokio", "api", "comfy.git", "app"), "Pinokio");
    add(path.join(home, "pinokio", "api", "comfyui.git", "app"), "Pinokio");
    for (const sm of [path.join(e.APPDATA || path.join(home, "AppData", "Roaming"), "StabilityMatrix", "Packages"), path.join(home, "StabilityMatrix", "Data", "Packages"), path.join(home, ".config", "StabilityMatrix", "Packages")]) {
      let L = []; try { L = fs.readdirSync(sm); } catch { L = []; }
      L.filter((n) => /comfy/i.test(n)).forEach((n) => add(path.join(sm, n), "Stability Matrix"));
    }
  }
  const drives = o.drives || (process.platform === "win32" ? "CDEFGH".split("").map((c) => c + ":\\") : []);
  for (const dr of drives) {
    for (const sub of ["", "AI", "Apps", "Programs", "Tools", "StableDiffusion"]) {
      const base = path.join(dr, sub);
      let L = []; try { L = fs.readdirSync(base); } catch { L = []; }
      L.filter((n) => /comfy/i.test(n)).forEach((n) => add(path.join(base, n), "drive " + dr.replace(/\\$/, "")));
    }
  }
  return out;
}
let cache = null;
const E2E = { extra: [] };      // the gate's browser test only (POST /api/comfy/detect/e2e, H3_E2E=1)
/** the ComfyUI on this computer (the configured folder first) */
function detect(opts) {
  const o = opts || {};
  let conf = "";
  try { const core = require("./core"), c = (core.getConfig().engine || {}).comfy || {}; conf = c.dir ? core.resolvePath(c.dir) : ""; } catch { conf = ""; }
  if (process.env.BITGEN_NO_COMFY_DETECT === "1" && !o.env) return null;      // tests / a machine where it must not look
  if (conf) { const hit = check(conf); return hit ? Object.assign({ yaml: "", source: "Settings ▸ ComfyUI ▸ Folder", configured: true }, hit) : null; }
  if (!o.refresh && cache && Date.now() - cache.at < 60000) return cache.hit;
  const env = o.env || process.env, home = o.home != null ? o.home : os.homedir();
  let app = ""; try { app = require("./core").BASE; } catch { app = ""; }
  let hit = null;
  for (const c of candidates(env, { home, app, drives: o.drives, extra: E2E.extra })) { const h = check(c.dir); if (h) { hit = Object.assign({ yaml: "", source: c.source, configured: false }, h); break; } }
  if (!hit) { const d = desktop(env, home); if (d) hit = Object.assign({ configured: false }, d); }
  cache = { at: Date.now(), hit };
  return hit;
}
/** the folder the model lists scan: Settings' folder, else the one found -> {dirAbs, extraPaths, detected} */
function scanTarget(c, found) {
  const cc = c || {};
  let core = null; try { core = require("./core"); } catch { core = null; }
  if (cc.dir) return { dirAbs: core ? core.resolvePath(cc.dir) : path.resolve(cc.dir), extraPaths: cc.extra_paths || "", detected: null };
  const d = arguments.length > 1 ? found : detect();
  if (!d) return { dirAbs: "", extraPaths: cc.extra_paths || "", detected: null };
  return { dirAbs: d.kind === "desktop" ? d.root : d.main, extraPaths: cc.extra_paths || d.yaml || "", detected: d };
}
function reset() { cache = null; }

module.exports = { check, candidates, desktop, desktopDirs, detect, scanTarget, reset, E2E };
