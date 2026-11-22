// bitGen Studio — lib/longcatAddon.js (2.918.0): Settings ▸ Add-ons ▸ LongCat Avatar 1.6.
//
// Tim (verbatim): "https://meigen-ai.github.io/LongCat-Video-Avatar-1.6-Page/, can you add this"
// What the LongCat Avatar 1.6 video style needs (lib/longcat.js): PedroMarinhoDev's ComfyUI-LongCat-Avatar node pack ("LongCat
// Avatar Native", GPL-3.0 code - cloned into ComfyUI's custom_nodes by lib/setupPacks.js, lib/nodePacks.json id "longcat";
// ComfyUI's own support is still a pull request) and the files (lib/modelCatalog.json group "longcat", MIT weights):
//   the DiT          int8 ConvRot 16 GB (ticked - a 24-32 GB card) / W4A8 9.4 GB (12-16 GB) / bf16 31.7 GB (from RAM)
//   the two LoRAs    DMD (steps 1-4) + OPSD (steps 5-8), 1.7 GB each
//   Whisper          large-v3 encoder fp16, 1.3 GB (hears the speech)
//   text encoder     Wan 2.1's umT5-XXL (fp8 scaled) - skipped when ComfyUI has any umT5 already
//   VAE              Wan 2.1's VAE - skipped when ComfyUI has it already
// ComfyUI is restarted once afterwards to load the pack.
//   ITEMS                        [{id, label, for, files: [catalog ids] | pack: true, need, dflt, any}]
//   status(place?)               {installed, pack, note, items: [{id, label, for, size, present, need, dflt}]}
//   install(log, picks, deps)    -> {ok, error}   (picks = the DiT sizes: int8 / w4a8 / bf16; deps: place / packInstall /
//                                                  download / comfy - the tests pass fakes)
//   remove(log, place?)          -> {ok, error}   (the DiTs, the LoRAs and Whisper; the umT5 / VAE and the pack stay)
"use strict";
const fs = require("fs");
const path = require("path");

const PACK_ID = "longcat";
const ITEMS = [
  { id: "pack", label: "LongCat Avatar node pack (ComfyUI-LongCat-Avatar)", for: "runs LongCat-Video-Avatar 1.6 in ComfyUI", pack: true, need: true, dflt: true },
  { id: "int8", label: "LongCat Avatar 1.6 DiT int8 (16 GB)", for: "the model for a 24-32 GB card - what the style picks first", files: ["longcat_int8"], dit: true, dflt: true },
  { id: "w4a8", label: "LongCat Avatar 1.6 DiT W4A8 (9.4 GB)", for: "the smallest model, for 12-16 GB cards", files: ["longcat_w4a8"], dit: true, dflt: false },
  { id: "bf16", label: "LongCat Avatar 1.6 DiT bf16 (31.7 GB)", for: "full precision - streams from about 30 GB of RAM", files: ["longcat_bf16"], dit: true, dflt: false },
  { id: "loras", label: "DMD + OPSD LoRAs (3.3 GB)", for: "the release's 8 distilled steps", files: ["longcat_dmd", "longcat_opsd"], need: true, dflt: true },
  { id: "whisper", label: "Whisper large-v3 encoder (1.3 GB)", for: "hears the speech the lips follow", files: ["longcat_whisper"], need: true, dflt: true },
  { id: "te", label: "umT5-XXL text encoder (Wan 2.1's, 6.7 GB)", for: "reads the prompt - skipped when ComfyUI has a umT5 already", files: ["longcat_te"], need: true, dflt: true, any: /umt5/i, folder: "text_encoders" },
  { id: "vae", label: "Wan 2.1 VAE (254 MB)", for: "draws the frames - skipped when ComfyUI has it already", files: ["longcat_vae"], need: true, dflt: true, any: /wan[-_ ]?2[._]?1[-_]?vae/i, folder: "vae" },
];
const DIT = ITEMS.filter((i) => i.dit).map((i) => i.id);

const Models = () => require("./setupModels");
const Packs = () => require("./setupPacks");
const entry = (id) => Models().byId(id);
const place = () => require("./aiFillAddon").place();
const fmt = (b) => require("./aiFillAddon").fmt(b);
const paths = (pl) => ({ comfyModels: pl.models, app: require("./core").BASE });
const sizeOf = (it) => (it.files || []).reduce((s, id) => s + ((entry(id) || {}).size || 0), 0);
const packRow = (pl) => (pl.customNodes ? Packs().status(pl.customNodes).find((x) => x.id === PACK_ID) : null);

/** a file of that kind anywhere in ComfyUI's models/<folder> (one level of subfolders) */
function anyIn(dir, rx) {
  if (!dir) return false;
  let names = [];
  try {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (d.isFile()) names.push(d.name);
      else if (d.isDirectory()) { try { names = names.concat(fs.readdirSync(path.join(dir, d.name))); } catch { /* unreadable */ } }
    }
  } catch { return false; }
  return names.some((n) => rx.test(n) && /\.(safetensors|gguf|pth?|bin)$/i.test(n));
}
function present(it, p) {
  if (it.pack) { const r = packRow(p); return !!(r && r.present); }
  if (!p.models) return false;
  if (it.files.every((id) => { const m = entry(id); return !!m && Models().present(m, paths(p)); })) return true;
  return !!it.any && anyIn(path.join(p.models, it.folder), it.any);
}

function status(pl0) {
  const p = pl0 || place();
  const items = ITEMS.map((it) => ({ id: it.id, label: it.label, for: it.for, need: !!it.need, dflt: !!it.dflt,
    size: it.pack ? "under 1 MB" : fmt(sizeOf(it)), present: present(it, p) }));
  const pack = items[0].present;
  const ready = items.filter((i) => i.need).every((i) => i.present) && items.some((i) => DIT.includes(i.id) && i.present);
  return { installed: ready, pack, items,
    note: !p.ok ? `ComfyUI not found (${p.error}) - set its folder in Settings ▸ ComfyUI first`
      : ready ? "ready - pick the LongCat Avatar 1.6 video style in the prompt docker, a sound in the References docker (restart ComfyUI once after installing)"
      : items.some((i) => i.present && !i.pack) ? "partly installed - Install again for the rest" : "not installed" };
}

function wanted(picks) {
  const p = (Array.isArray(picks) ? picks : []).filter((x) => DIT.includes(x));
  return p.length ? p : ["int8"];
}

async function install(log, picks, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const core = require("./core");
  const X = require("./setupExec");
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1", PIP_DISABLE_PIP_VERSION_CHECK: "1" });
  log("[ok] LongCat-Video-Avatar 1.6 by Meituan LongCat (MIT weights - huggingface.co/meituan-longcat/LongCat-Video-Avatar-1.6), run by "
    + "PedroMarinhoDev's ComfyUI-LongCat-Avatar (GPL-3.0 code) with his single-file ComfyUI copies of the release", false);
  // 1 the node pack
  let newPack = false;
  const pack = packRow(pl);
  if (!pack) return { ok: false, error: "the LongCat Avatar pack is not in the node pack list" };
  if (pack.present) log(`[ok] ${pack.folder} is in ComfyUI already`, false);
  else {
    log(`[..] node pack ${pack.folder} (${pack.url})`, false);
    const packInstall = d.packInstall || ((pk) => Packs().install(pk, pl.customNodes, { git: X.which("git", require("./setupRun").runtimeDirs()), python: pl.python, log, env }));
    const r = await packInstall(pack);
    if (!r || !r.ok) return { ok: false, error: `${pack.folder} did not install: ${(r && r.error) || "see the log"}` };
    newPack = true;
  }
  // 2 the files: the DiT(s) picked + everything it needs
  const token = ((core.getConfig() || {}).hf || {}).token || "";
  const dl = d.download || ((m) => { let last = -1; return Models().download(m, { token, paths: paths(pl), python: require("./setupRun").appPython(), log, env, engine: "auto",
    onProgress: (p) => { const pc = p && p.total ? Math.floor((p.got / p.total) * 10) * 10 : -1; if (pc > last) { last = pc; log(`… ${m.as || path.basename(m.file)} ${pc} %`, false); } } }); });
  const want = wanted(picks);
  for (const it of ITEMS) {
    if (it.pack || (it.dit && !want.includes(it.id))) continue;
    if (present(it, pl)) { log(`[ok] ${it.label.replace(/ \(.*\)$/, "")} (already there)`, false); continue; }
    for (const fid of it.files) {
      const m = entry(fid);
      if (!m) { log(`[warn] ${fid} is not in the model list`, true); continue; }
      log(`[..] ${it.label.replace(/ \(.*\)$/, "")}: ${m.repo}/${m.file} (about ${fmt(m.size || 0)})`, false);
      const r = await dl(m);
      if (!r || !r.ok) return { ok: false, error: `${m.as || path.basename(m.file)}: ${(r && r.error) || "the download failed"}` };
      log(`[ok] ${m.as || path.basename(m.file)}${r.skipped ? " (already there)" : ""}`, false);
    }
  }
  const cs = await (d.comfy || ((o) => require("./longcat").comfySupport(o)))();
  if (newPack || (cs.online && !cs.nodes)) log("[ok] restart ComfyUI once (the ComfyUI docker's ⟳ Restart, or close and start the app) so it loads the LongCat Avatar nodes", false);
  log("[ok] pick the LongCat Avatar 1.6 video style, put the speech in the References docker (and the person's picture) and press Generate", false);
  return { ok: true };
}

async function remove(log, pl0) {
  const pl = pl0 || place();
  if (!pl.models) return { ok: false, error: "ComfyUI's models folder is not known" };
  let n = 0;
  for (const it of ITEMS) {
    if (it.pack || it.any) continue;                         // the umT5 / VAE are Wan's too
    for (const fid of it.files) {
      const m = entry(fid); if (!m) continue;
      const p = Models().destPath(m, paths(pl));
      try { if (p && fs.existsSync(p)) { fs.unlinkSync(p); n++; log(`[ok] deleted ${p}`, false); } }
      catch (e) { log(`[warn] could not delete ${p}: ${e.message}`, true); }
    }
  }
  log(`[ok] ${n} LongCat Avatar file(s) removed - the umT5 text encoder and the Wan 2.1 VAE stay (Wan uses them), the node pack stays in ComfyUI's custom_nodes`, false);
  return { ok: true };
}

module.exports = { PACK_ID, ITEMS, DIT, wanted, status, install, remove, anyIn };
