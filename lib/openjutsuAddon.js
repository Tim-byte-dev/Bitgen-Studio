// bitGen Studio — lib/openjutsuAddon.js (2.949.0): Settings ▸ Add-ons ▸ OpenJutsu swap.
//
// Tim: "is this worth adding? https://github.com/D3voz/openjutsu" -> "lets do it".
// What the ⇄ Swap dialog's OpenJutsu engine needs (lib/openjutsu.js - OpenJutsu's own workflows ship with bitGen):
//   node packs   Context Loop 0.7.3+ (an older copy is updated: git pull), comfyui-h3-oneclick-swap, Fantastic PromptBuilder,
//                KJNodes, VideoHelperSuite, Image Detail Contrast + Orion4D_FXMax (🎨 Fix colours) - lib/nodePacks.json
//                (cloned into ComfyUI's custom_nodes by lib/setupPacks.js; GPL-3.0 / MIT code, none of it shipped here)
//   the files    MiniMax H3 ref2va, its text encoder, video + audio VAE (skipped when ComfyUI has ANY of that kind - the
//                worker points OpenJutsu's names at what is there), the DMAD 4-step LoRA, SAM 3.1, the Qwen3-VL 8B
//                describer
//   opt-in       ⚡ Spectrum (its pack) and 🙂 Fix faces: ComfyUI-H3-FaceRefine + Impact Pack, the YOLOv8 face / person
//                detectors (AGPL-3.0) and SAM ViT-B; FaceRefine fetches InsightFace buffalo_l on first use - NON-COMMERCIAL
//                research only. Fix faces is unticked by default and the dialog asks the user to accept that first.
// Weights are never shipped - each is downloaded from its own page (lib/modelCatalog.json group "openjutsu").
//   ITEMS                        [{id, label, for, files | packs, need, dflt, any, folder}]
//   status(place?)               {installed, packs, contexloop, note, items: [{id, label, for, size, present, need, dflt}]}
//   install(log, picks, deps)    -> {ok, error}   (deps: place / packInstall / pull / download - the tests pass fakes)
//   remove(log, place?)          -> {ok, error}   (the OpenJutsu-only files: DMAD, SAM 3.1, the Fix faces files; packs stay)
//   packVersion(dir) / older(a, b)   the Context Loop version check
"use strict";
const fs = require("fs");
const path = require("path");
const OJ = require("./openjutsu");

const NEED_PACKS = ["contexloop", "oneclick", "fantasticpb", "kjnodes", "vhs", "detailcontrast", "orionfx"];
const FACE_PACKS = [
  { id: "impact", from: "list" },
  { id: "h3facerefine", folder: "ComfyUI-H3-FaceRefine", url: "https://github.com/Carasibana/ComfyUI-H3-FaceRefine",
    for: "OpenJutsu 🙂 Fix faces: tracks, masks and pastes back the face (MIT code; InsightFace buffalo_l non-commercial, YOLO AGPL-3.0)",
    provides: ["H3FaceTrackCrop", "H3FaceMaskSAM", "H3FaceStitch"] },
];
const ITEMS = [
  { id: "packs", label: "OpenJutsu node packs (Context Loop 0.7.3+, Oneclick Swap, PromptBuilder, KJNodes, VHS, Detail Contrast, Orion4D FX)",
    for: "run OpenJutsu's workflows in ComfyUI (an older Context Loop is updated)", packs: NEED_PACKS, need: true, dflt: true },
  { id: "h3", label: "MiniMax H3 ref2va (int8)", for: "the swap model - skipped when ComfyUI has a MiniMax H3 ref2va model already",
    files: ["h3_ref2va"], need: true, dflt: true, any: /minimax_h3_ref2va(?!.*viggle)/i, folder: "diffusion_models" },
  { id: "te", label: "MiniMax H3 text encoder (Qwen3-VL 32B INT4)", for: "reads H3's prompts - skipped when ComfyUI has any MiniMax H3 text encoder (the NVFP4 one on an RTX 50)",
    files: ["oj_te_int4"], need: true, dflt: true, any: /qwen3vl_32b_minimax_h3/i, folder: "text_encoders" },
  { id: "vae", label: "MiniMax H3 video + audio VAE", for: "draws the frames and the sound - skipped when ComfyUI has them",
    files: ["oj_vvae", "h3_avae"], need: true, dflt: true, anyEach: { oj_vvae: /minimax_h3_video_vae/i, h3_avae: /minimax_h3_audio_vae/i }, folder: "vae" },
  { id: "dmad", label: "DMAD 4-step LoRA (367 MB)", for: "OpenJutsu's speed-up: 6 steps instead of 20+", files: ["oj_dmad"], need: true, dflt: true,
    any: /DMAD.*4step/i, folder: "loras" },
  { id: "sam", label: "SAM 3.1 (1.7 GB)", for: "finds and follows the people / things to swap", files: ["oj_sam31"], need: true, dflt: true,
    any: /sam3\.1/i, folder: "checkpoints" },
  { id: "describer", label: "Qwen3-VL 8B describer (int8)", for: "describes the pictures and writes each clip's shot list - skipped when ComfyUI has a Qwen3-VL 8B",
    files: ["qwen21_te"], need: true, dflt: true, any: /qwen3vl_8b/i, folder: "text_encoders" },
  { id: "spectrum", label: "⚡ Spectrum (optional speed-up without DMAD - approximate)", for: "the Spectrum MiniMax H3 pack (GPL-3.0)",
    packs: ["spectrum"], dflt: false },
  { id: "face", label: "🙂 Fix faces (opt-in - read the licences)", for: OJ.LICENCE.face + " Installs ComfyUI-H3-FaceRefine + Impact Pack, the YOLOv8 face + person detectors and SAM ViT-B.",
    packs: ["impact", "h3facerefine"], files: ["face_yolo", "oj_person_seg", "oj_sam_vitb"], dflt: false, face: true },
];

const Models = () => require("./setupModels");
const Packs = () => require("./setupPacks");
const entry = (id) => Models().byId(id);
const place = () => require("./aiFillAddon").place();
const fmt = (b) => require("./aiFillAddon").fmt(b);
const paths = (pl) => ({ comfyModels: pl.models, app: require("./core").BASE });
const sizeOf = (it) => (it.files || []).reduce((s, id) => s + ((entry(id) || {}).size || 0), 0);
const anyIn = (dir, rx) => require("./longcatAddon").anyIn(dir, rx);

/** A pack definition by id: lib/nodePacks.json, or the opt-in Fix faces one kept here. */
function packDef(id) {
  const own = FACE_PACKS.find((p) => p.id === id && p.folder);
  return own || Packs().LIST.find((p) => p.id === id) || null;
}
/** present / where of each pack the items name (setupPacks.status rules: the folder or the git remote). */
function packRows(customNodes) {
  if (!customNodes) return [];
  const listed = Packs().status(customNodes);
  const ids = [...new Set(ITEMS.flatMap((i) => i.packs || []))];
  return ids.map((id) => {
    const row = listed.find((p) => p.id === id);
    if (row) return row;
    const def = packDef(id);
    if (!def) return { id, present: false, where: "" };
    let where = "";
    try { if (fs.existsSync(path.join(customNodes, def.folder))) where = def.folder; } catch { /* unreadable */ }
    return { ...def, present: !!where, where };
  });
}

/** The version in a pack's pyproject.toml ("" when it does not say). */
function packVersion(dir) {
  try { const m = /^\s*version\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(path.join(dir, "pyproject.toml"), "utf8")); return m ? m[1] : ""; }
  catch { return ""; }
}
/** a < b for dotted versions (0.7.2 < 0.7.3; "" is not older - unknown). */
function older(a, b) {
  if (!a) return false;
  const p = (v) => String(v).split(".").map((x) => parseInt(x, 10) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0); }
  return false;
}
function contexState(pl, rows) {
  const r = rows.find((x) => x.id === "contexloop");
  if (!r || !r.present) return { present: false, version: "", old: false };
  const version = packVersion(path.join(pl.customNodes, r.where));
  return { present: true, version, old: older(version, "0.7.3"), where: r.where };
}

function present(it, pl, rows) {
  if (it.packs && !it.files) return it.packs.every((id) => { const r = rows.find((x) => x.id === id); return !!(r && r.present); })
    && (it.id !== "packs" || !contexState(pl, rows).old);
  if (it.packs && !it.packs.every((id) => { const r = rows.find((x) => x.id === id); return !!(r && r.present); })) return false;
  if (!pl.models) return false;
  return (it.files || []).every((id) => fileThere(it, id, pl));
}
function fileThere(it, id, pl) {
  const m = entry(id);
  if (m && Models().present(m, paths(pl))) return true;
  const rx = (it.anyEach && it.anyEach[id]) || it.any;
  return !!rx && anyIn(path.join(pl.models, it.folder || ""), rx);
}

function status(pl0) {
  const pl = pl0 || place();
  const rows = packRows(pl.customNodes);
  const cx = pl.ok ? contexState(pl, rows) : { present: false, version: "", old: false };
  const items = ITEMS.map((it) => ({ id: it.id, label: it.label, for: it.for, need: !!it.need, dflt: !!it.dflt,
    size: it.files ? fmt(sizeOf(it)) + (it.packs ? " + node packs" : "") : "node packs (git)", present: pl.ok ? present(it, pl, rows) : false }));
  const ready = pl.ok && items.filter((i) => i.need).every((i) => i.present);
  return { installed: ready, items, contexloop: cx,
    packs: rows.map((r) => ({ id: r.id, folder: r.folder || r.id, present: !!r.present })),
    note: !pl.ok ? `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI first`
      : cx.old ? `Context Loop ${cx.version} is older than the 0.7.3 OpenJutsu needs - Install updates it`
      : ready ? "ready - ⇄ Swap dialog ▸ Engine ▸ OpenJutsu (restart ComfyUI once after installing)"
      : items.some((i) => i.present && i.id !== "packs") ? "partly installed - Install again for the rest" : "not installed" };
}

function wanted(picks) {
  const p = Array.isArray(picks) ? picks.map(String) : [];
  return ITEMS.filter((i) => i.need || p.includes(i.id)).map((i) => i.id);
}

async function install(log, picks, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const core = require("./core");
  const X = require("./setupExec");
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1", PIP_DISABLE_PIP_VERSION_CHECK: "1" });
  const want = wanted(picks);
  log(`[ok] OpenJutsu by D3voz (MIT - ${OJ.PIN.repo}, workflows at ${OJ.PIN.commit.slice(0, 7)}, shipped with bitGen) on MiniMax H3 + SAM 3.1`, false);
  if (want.includes("face")) log("[warn] " + OJ.LICENCE.face, true);
  const git = () => X.which("git", require("./setupRun").runtimeDirs());
  const packInstall = d.packInstall || ((pk) => Packs().install(pk, pl.customNodes, { git: git(), python: pl.python, log, env }));
  let newPacks = false;
  // 1 the node packs of the items picked
  const rows = packRows(pl.customNodes);
  for (const id of [...new Set(ITEMS.filter((i) => want.includes(i.id)).flatMap((i) => i.packs || []))]) {
    const r = rows.find((x) => x.id === id) || {};
    const def = packDef(id);
    if (!def) { log(`[warn] ${id} is not in the node pack list`, true); continue; }
    if (r.present) { log(`[ok] ${def.folder} is in ComfyUI already`, false); continue; }
    log(`[..] node pack ${def.folder} (${def.url})`, false);
    const res = await packInstall(def);
    if (!res || !res.ok) return { ok: false, error: `${def.folder} did not install: ${(res && res.error) || "see the log"}` };
    newPacks = true;
  }
  // 1b an older Context Loop: OpenJutsu needs 0.7.3+ (its ChainPlanModern / masked-target nodes)
  const cx = contexState(pl, packRows(pl.customNodes));
  if (cx.old) {
    log(`[..] Context Loop ${cx.version} -> updating (git pull) - OpenJutsu needs 0.7.3 or newer`, false);
    const dir = path.join(pl.customNodes, cx.where);
    const pull = d.pull || (async () => {
      const g = git();
      if (!g || !fs.existsSync(path.join(dir, ".git"))) return { ok: false, error: "it is not a git copy - delete the folder and Install again" };
      const code = await X.run(g, ["-C", dir, "pull", "--ff-only"], { log, env: Packs().GIT_ENV(env) });
      return code === 0 ? { ok: true } : { ok: false, error: `git pull exited ${code}` };
    });
    const pr = await pull(dir);
    if (!pr || !pr.ok) return { ok: false, error: `Context Loop could not be updated: ${(pr && pr.error) || "see the log"}` };
    const v = packVersion(dir);
    if (older(v, "0.7.3")) return { ok: false, error: `Context Loop is still ${v} after updating - OpenJutsu needs 0.7.3+` };
    log(`[ok] Context Loop ${v || "updated"}`, false);
    newPacks = true;
  }
  // 2 the files (a kind ComfyUI already has is skipped - the worker uses it)
  const token = ((core.getConfig() || {}).hf || {}).token || "";
  const dl = d.download || ((m) => { let last = -1; return Models().download(m, { token, paths: paths(pl), python: require("./setupRun").appPython(), log, env, engine: "auto",
    onProgress: (p) => { const pc = p && p.total ? Math.floor((p.got / p.total) * 10) * 10 : -1; if (pc > last) { last = pc; log(`… ${m.as || path.basename(m.file)} ${pc} %`, false); } } }); });
  for (const it of ITEMS) {
    if (!it.files || !want.includes(it.id)) continue;
    for (const fid of it.files) {
      if (fileThere(it, fid, pl)) { log(`[ok] ${(entry(fid) || {}).label || fid} (already there)`, false); continue; }
      const m = entry(fid);
      if (!m) { log(`[warn] ${fid} is not in the model list`, true); continue; }
      log(`[..] ${m.label}: ${m.repo}/${m.file} (about ${fmt(m.size || 0)})`, false);
      const r = await dl(m);
      if (!r || !r.ok) return { ok: false, error: `${m.as || path.basename(m.file)}: ${(r && r.error) || "the download failed"}` };
      log(`[ok] ${m.as || path.basename(m.file)}${r.skipped ? " (already there)" : ""}`, false);
    }
  }
  if (newPacks) log("[ok] restart ComfyUI once (the ComfyUI docker's ⟳ Restart, or close and start the app) so it loads the new nodes", false);
  log("[ok] open the video docker's ⇄ Swap, pick Engine ▸ OpenJutsu, a picture and a segment, then ⇄ Swap", false);
  return { ok: true };
}

async function remove(log, pl0) {
  const pl = pl0 || place();
  if (!pl.models) return { ok: false, error: "ComfyUI's models folder is not known" };
  let n = 0;
  for (const fid of ["oj_dmad", "oj_sam31", "oj_person_seg", "oj_sam_vitb"]) {   // OpenJutsu's own - H3's files stay (the rest of bitGen uses them)
    const m = entry(fid); if (!m) continue;
    const p = Models().destPath(m, paths(pl));
    try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); n++; log(`[ok] deleted ${p}`, false); } }
    catch (e) { log(`[warn] could not delete ${p}: ${e.message}`, true); }
  }
  log(`[ok] ${n} OpenJutsu file(s) removed - MiniMax H3's model, text encoder and VAEs stay (bitGen's other video uses them), the node packs stay in ComfyUI's custom_nodes`, false);
  return { ok: true };
}

module.exports = { NEED_PACKS, FACE_PACKS, ITEMS, packDef, packRows, packVersion, older, contexState, status, wanted, install, remove };
