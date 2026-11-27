// bitGen Studio — lib/platoKeysAddon.js (3.4.0): Settings ▸ Add-ons ▸ 🔑 PlatoKeys - a lighter text encoder for a style.
//
// Tim (verbatim): "we can add it, and add a text encoder dropdown in basic settings to overide the models own. when we
// overide the text encoder for our local llm it will automatically use the plato workflows. top option will be styles own.
// if it works for some videos/images and makes it faster it will be good to have" + "please note, the updated viggle node
// i uploaded".
// The add-on puts into ComfyUI what Basic Settings ▸ Text encoder (lib/platoKeys.js, scripts/plato_keys_apply.py) needs:
//   nodes    github.com/Nynxz/ComfyUI-PlatoKeys -> custom_nodes/ComfyUI-PlatoKeys (Apache-2.0; git pull when it is there)
//   remake   bitGen's copy of ComfyUI-Viggle-Remake (Tim's updated node - works with a PlatoKeys encoder) -> custom_nodes,
//            an older copy refreshed (lib/setupPacks.js syncBundled)
//   te2b     Qwen3.5-2B (bf16, Comfy-Org/Qwen3.5) -> models/text_encoders - the light encoder the keys map from
//   keys     from huggingface.co/nynxz/PlatoKeys -> models/plato_keys/<family>/ (lib/modelCatalog.json group "platokeys")
// No public key maps onto MiniMax H3 - a key of your own (Tim's minimax_h3_32b_pk_ridge_qwen3.5_2b.safetensors) in
// models/plato_keys is found by name and used through its PlatosKeyPatchCLIP node when ComfyUI has it.
// Not checked here (no GPU on the build machine): the speed and the prompt following on a real card.
//   ITEMS   status(place?) {installed, note, items, keys}   install(log, picks, deps) -> {ok, error}   remove(log, place?)
"use strict";
const fs = require("fs");
const path = require("path");

const REPO = "https://github.com/Nynxz/ComfyUI-PlatoKeys";
const FOLDER = "ComfyUI-PlatoKeys";
const ITEMS = [
  { id: "nodes", label: "PlatoKeys nodes (ComfyUI-PlatoKeys)", for: "Load Plato Key + Patch CLIP - every key needs them", pack: true, dflt: true, need: true },
  { id: "remake", label: "Viggle Remake nodes (bitGen's updated copy)", for: "Viggle Remake graphs with a PlatoKeys encoder (an older copy in custom_nodes is refreshed)", bundled: "viggle_remake", dflt: true },
  { id: "te2b", label: "Qwen3.5-2B text encoder (bf16)", for: "the light encoder - pick it in Basic Settings ▸ Text encoder", files: ["pk_te_2b"], dflt: true },
  { id: "moss", label: "Key: Qwen3.5-2B → MOSS-Image", for: "the MOSS-Image styles with the 2B (16.8 MB)", files: ["pk_moss_comfy", "pk_moss"], dflt: true },
  { id: "krea2", label: "Key: Qwen3.5-2B → Krea 2", for: "the Krea 2 styles with the 2B (121 MB)", files: ["pk_krea2_2b"], dflt: true },
  { id: "krea2_9b", label: "Key: Qwen3.5-9B → Krea 2", for: "Krea 2 with the MOSS-Image 9B encoder - stronger, not lighter (240 MB)", files: ["pk_krea2_9b"], dflt: false },
  { id: "zimage", label: "Key: Qwen3-VL-4B → Z-Image", for: "Z-Image with the Krea 2 encoder - one encoder for both (12.5 MB)", files: ["pk_zimage"], dflt: false },
];
const DEFAULTS = ITEMS.filter((i) => i.dflt).map((i) => i.id);
const H3_NOTE = "MiniMax H3: no public key - put your own (e.g. minimax_h3_32b_pk_ridge_qwen3.5_2b.safetensors) in ComfyUI/models/plato_keys; bitGen uses it through the PlatosKeyPatchCLIP node your H3 PlatoKeys workflows use";

const Models = () => require("./setupModels");
const entry = (id) => Models().byId(id);
const place = () => require("./aiFillAddon").place();
const paths = (pl) => ({ comfyModels: pl.models, app: require("./core").BASE });
const packDir = (pl) => (pl && pl.customNodes ? path.join(pl.customNodes, FOLDER) : "");
const keysDir = (pl) => (pl && pl.models ? path.join(pl.models, "plato_keys") : "");
const fmt = (b) => require("./aiFillAddon").fmt(b);
const sizeOf = (it) => (it.files || []).reduce((s, id) => s + ((entry(id) || {}).size || 0), 0);

/** the picks + what is always needed, known ids only, in the list's order (pure) */
function wanted(picks) {
  const p = Array.isArray(picks) && picks.length ? picks : DEFAULTS;
  return ITEMS.filter((i) => i.need || p.includes(i.id)).map((i) => i.id);
}
/** every key file under models/plato_keys (relative, "/" separated) */
function keysIn(dir) {
  const out = [];
  const walk = (d, rel) => { let es = []; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) { const r = rel ? rel + "/" + e.name : e.name; if (e.isDirectory()) walk(path.join(d, e.name), r); else if (/\.safetensors$/i.test(e.name)) out.push(r); } };
  if (dir) walk(dir, "");
  return out.sort();
}
function remakePack() { return require("./setupPacks").LIST.find((p) => p.id === "viggle_remake"); }

function status(pl0) {
  const pl = pl0 || place();
  const P = require("./setupPacks");
  const nodes = !!(packDir(pl) && fs.existsSync(path.join(packDir(pl), "plato_keys")));
  const rp = remakePack(), rdir = pl.customNodes ? path.join(pl.customNodes, rp.folder) : "";
  const remakeThere = !!(rdir && fs.existsSync(rdir)), remakeOld = remakeThere && P.bundledStale(rp, rdir);
  const items = ITEMS.map((i) => {
    let present = false;
    if (i.pack) present = nodes;
    else if (i.bundled) present = remakeThere && !remakeOld;
    else present = !!pl.models && i.files.every((id) => { const m = entry(id); return m && Models().present(m, paths(pl)); });
    return { id: i.id, label: i.label, for: i.for, size: i.files ? fmt(sizeOf(i)) : "small", present, dflt: !!i.dflt, need: !!i.need };
  });
  const keys = keysIn(keysDir(pl));
  const usable = keys.filter((k) => require("./platoKeys").parseKey(k));
  return { installed: nodes && usable.length > 0, nodes, remake: remakeThere ? (remakeOld ? "older copy" : "bitGen's copy") : "not there", keys,
    note: !pl.ok ? `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI first`
      : !nodes ? "not installed"
      : !usable.length ? "the nodes are there but no key yet - Install with a key ticked"
      : `ready: ${usable.length} key(s) - pick a text encoder in Basic Settings ▸ Text encoder (restart ComfyUI after installing). ${H3_NOTE}`,
    items };
}

async function install(log, picks, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const want = wanted(picks);
  const X = d.exec || require("./setupExec");
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1", GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" });
  // 1. the node pack
  const dir = packDir(pl);
  const git = d.git !== undefined ? d.git : X.which("git", require("./setupRun").runtimeDirs());
  if (fs.existsSync(dir) && fs.existsSync(path.join(dir, ".git")) && git) {
    log(`[..] ${FOLDER} is in custom_nodes - git pull (the newest)`, false);
    const c = await X.run(git, ["-C", dir, "pull", "--ff-only"], { log, env, timeout: 10 * 60000 });
    if (c !== 0) log("[warn] git pull did not finish - the copy there is kept", true);
  } else if (!fs.existsSync(dir)) {
    log(`[..] the node pack: ${REPO} -> ${dir}`, false);
    const r = await (d.fetchRepo || require("./setupPacks").fetchRepo)(REPO, dir, { git, log, env });
    if (!r || !r.ok) return { ok: false, error: "could not fetch ComfyUI-PlatoKeys: " + ((r && r.error) || "git / the zip failed") };
  } else log(`[ok] ${FOLDER} already in custom_nodes`, false);
  if (!fs.existsSync(path.join(dir, "plato_keys"))) return { ok: false, error: `the ComfyUI-PlatoKeys copy has no plato_keys folder (${dir}) - remove it and install again` };
  const req = path.join(dir, "requirements.txt");
  if (pl.python && fs.existsSync(req)) {
    log("[..] pip install -r requirements.txt (ComfyUI's Python)", false);
    const code = await X.run(pl.python, ["-m", "pip", "install", "-r", req, "--progress-bar", "off"], { log, env, cwd: dir, timeout: 30 * 60000 });
    if (code !== 0) log("[warn] its requirements did not all install - see the log; the nodes may still load", true);
  }
  // 2. Viggle Remake - bitGen's updated copy
  if (want.includes("remake")) {
    const r = require("./setupPacks").syncBundled(remakePack(), pl.customNodes, { log, base: d.base });
    if (!r.ok) log("[warn] Viggle Remake nodes: " + r.error, true);
  }
  // 3. the encoder + the keys
  const core = require("./core");
  const token = ((core.getConfig() || {}).hf || {}).token || "";
  const dl = d.download || ((m) => { let last = -1; return Models().download(m, { token, paths: paths(pl), python: require("./setupRun").appPython(), log, env, engine: "auto",
    onProgress: (p) => { const pc = p && p.total ? Math.floor((p.got / p.total) * 10) * 10 : -1; if (pc > last) { last = pc; log(`… ${path.basename(m.file)} ${pc} %`, false); } } }); });
  for (const id of want) {
    const it = ITEMS.find((i) => i.id === id);
    for (const fid of it.files || []) {
      const m = entry(fid);
      if (!m) { log(`[warn] ${fid} is not in the model list`, true); continue; }
      log(`[..] ${it.label}: ${m.repo}/${m.file} (${fmt(m.size || 0)})`, false);
      const r = await dl(m);
      if (!r || !r.ok) return { ok: false, error: `${path.basename(m.file)}: ${(r && r.error) || "the download failed"}` };
      log(`[ok] ${path.basename(m.file)}${r.skipped ? " (already there)" : ""}`, false);
    }
  }
  log("[ok] PlatoKeys ready - restart ComfyUI, then Basic Settings ▸ Text encoder lists the encoders a key maps onto your styles (Style's own = as before)", false);
  log("[ok] " + H3_NOTE, false);
  return { ok: true };
}

async function remove(log, pl0) {
  const pl = pl0 || place();
  const P = require("./setupPacks");
  let n = 0;
  const dir = packDir(pl);
  if (dir && fs.existsSync(dir)) { if (P.safeRm(dir, log)) { n++; log(`[ok] removed ${dir}`, false); } else log(`[warn] could not remove ${dir} - delete it by hand`, true); }
  if (pl.models) for (const it of ITEMS) for (const fid of it.files || []) {
    const m = entry(fid); if (!m) continue;
    const p = Models().destPath(m, paths(pl));
    try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); n++; log(`[ok] deleted ${p}`, false); } }
    catch (e) { log(`[warn] could not delete ${p}: ${e.message}`, true); }
  }
  log(`[ok] ${n} PlatoKeys item(s) removed - your own keys in models/plato_keys and the Viggle Remake nodes stay; restart ComfyUI`, false);
  return { ok: true };
}

module.exports = { REPO, FOLDER, ITEMS, DEFAULTS, H3_NOTE, wanted, keysIn, status, install, remove };
