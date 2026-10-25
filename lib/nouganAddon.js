// bitGen Studio — lib/nouganAddon.js (2.592.0): Settings ▸ Add-ons ▸ Nougan Nodes (🎭 regional character LoRAs + ⏱
// Prompt Relay).
//
// Tim: "lets just add the regional character lora and prompt relay" (of github.com/Winnougan/Nougan_Nodes, MIT).
// The add-on clones the node pack into ComfyUI's custom_nodes/Nougan_Nodes (its README: clone into custom_nodes, restart
// ComfyUI) and installs its requirements.txt into ComfyUI's Python when it has one. bitGen uses two of its nodes:
//   NouganRegionalCharacterLoRA  the image editor's 🔲 Zones ▸ ▦ Regional: a box can carry a 🎭 character LoRA - two
//                                different LoRAs at most, each only inside its boxes (scripts/comfy_regions.py)
//   PromptRelayEncode            ⏱ timed lines in an LTX prompt ([0-2s] ...) - each stretch of the clip its own words
//                                (scripts/prompt_relay.py, misc/ltx_worker.py); Kijai's ComfyUI-PromptRelay has the same
//                                node, so either pack does
// The rest of the pack (its loaders, LM Studio bridge, Civitai lookups ...) comes along - bitGen does not use it.
// Not checked here (the source could not be run on the build machine): the nodes on a real GPU.
//   status(place?)   {installed, pack, relay, note}      install(log, deps) -> {ok, error}      remove(log, place?)
"use strict";
const fs = require("fs");
const path = require("path");

const REPO = "https://github.com/Winnougan/Nougan_Nodes";
const FOLDER = "Nougan_Nodes";
const KIJAI = "ComfyUI-PromptRelay";              // Kijai's pack: the same PromptRelayEncode
const place = () => require("./aiFillAddon").place();
const packDir = (pl) => (pl && pl.customNodes ? path.join(pl.customNodes, FOLDER) : "");

/** the pack folder: is it there, does it hold the two nodes bitGen uses */
function packState(dir) {
  if (!dir || !fs.existsSync(dir)) return { present: false, regional: false, relay: false };
  return { present: true, regional: fs.existsSync(path.join(dir, "nougan_regional_lora.py")),
    relay: fs.existsSync(path.join(dir, "prompt_relay")) || fs.existsSync(path.join(dir, "prompt_relay.py")) };
}

function status(pl0) {
  const p = pl0 || place();
  const ps = packState(packDir(p));
  const kijai = !!(p.customNodes && fs.existsSync(path.join(p.customNodes, KIJAI)));
  const relay = ps.relay || kijai;
  return { installed: ps.present && ps.regional, pack: ps.present, regional: ps.regional, relay, kijai,
    note: !p.ok ? `ComfyUI not found (${p.error}) - set its folder in Settings ▸ ComfyUI first`
      : ps.present && ps.regional ? `ready: 🎭 regional character LoRAs${relay ? " + ⏱ Prompt Relay" : " (no Prompt Relay in this copy of the pack - Install again)"} (restart ComfyUI after installing)`
      : ps.present ? "the pack folder is there but has no nougan_regional_lora.py - Install again"
      : kijai ? `not installed - ⏱ Prompt Relay works already (Kijai's ${KIJAI}); Install adds the 🎭 regional character LoRAs` : "not installed" };
}

async function install(log, deps) {
  const d = deps || {};
  const pl = d.place || place();
  if (!pl.ok) return { ok: false, error: `ComfyUI not found (${pl.error}) - set its folder in Settings ▸ ComfyUI, then install again` };
  const X = d.exec || require("./setupExec");
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1", GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" });
  const dir = packDir(pl);
  let ps = packState(dir);
  const git = d.git !== undefined ? d.git : X.which("git", require("./setupRun").runtimeDirs());
  if (ps.present && fs.existsSync(path.join(dir, ".git")) && git) {
    log(`[..] ${FOLDER} is in custom_nodes - git pull (the newest)`, false);
    const c = await X.run(git, ["-C", dir, "pull", "--ff-only"], { log, env, timeout: 10 * 60000 });
    if (c !== 0) log("[warn] git pull did not finish - the copy there is kept", true);
  } else if (!ps.present) {
    log(`[..] the node pack: ${REPO} -> ${dir}`, false);
    const r = await (d.fetchRepo || require("./setupPacks").fetchRepo)(REPO, dir, { git, log, env });
    if (!r || !r.ok) return { ok: false, error: "could not fetch Nougan_Nodes: " + ((r && r.error) || "git / the zip failed") };
  } else log(`[ok] ${FOLDER} already in custom_nodes`, false);
  ps = packState(dir);
  if (!ps.regional) return { ok: false, error: `the Nougan_Nodes copy has no nougan_regional_lora.py (${dir}) - remove it and install again` };
  const req = path.join(dir, "requirements.txt");
  if (pl.python && fs.existsSync(req)) {
    log("[..] pip install -r requirements.txt (ComfyUI's Python)", false);
    const code = await X.run(pl.python, ["-m", "pip", "install", "-r", req, "--progress-bar", "off"], { log, env, cwd: dir, timeout: 30 * 60000 });
    if (code !== 0) log("[warn] its requirements did not all install - see the log; the nodes may still load", true);
  }
  log(`[ok] Nougan_Nodes installed - restart ComfyUI. 🎭 Image editor ▸ ✨ AI ▸ 🔲 Zones ▸ ▦ Regional: a box's 🎭 picks its character LoRA${ps.relay ? "; ⏱ an LTX prompt's timed lines ([0-2s] …) use Prompt Relay" : ""}.`, false);
  return { ok: true };
}

async function remove(log, pl0) {
  const pl = pl0 || place();
  const dir = packDir(pl);
  if (dir && fs.existsSync(dir)) {
    const ok = require("./setupPacks").safeRm(dir, log);
    log(ok ? `[ok] removed ${dir} - restart ComfyUI` : `[warn] could not remove ${dir} - delete it by hand`, !ok);
    return ok ? { ok: true } : { ok: false, error: `could not remove ${dir}` };
  }
  log("[ok] Nougan_Nodes was not installed", false);
  return { ok: true };
}

module.exports = { REPO, FOLDER, KIJAI, packDir, packState, status, install, remove };
