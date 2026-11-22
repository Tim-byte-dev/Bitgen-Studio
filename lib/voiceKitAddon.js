// bitGen Studio — lib/voiceKitAddon.js (2.919.0): Settings ▸ Add-ons ▸ Voice conversation (SAVA + Voice Isolator).
//
// Tim (verbatim): "https://inworld.ai/open-source#voice-isolator, would this be something we can use to have a conversation
// with bitgen" -> "go ahead".
// Inworld's two open models (Apache-2.0 code AND weights) in their own venv, <app>/voice-kit/.venv:
//   inworld-sava              SAVA - speech + END-OF-TURN detection in one streaming model (25.5M, 51 MB, the CPU is enough)
//   inworld-voice-isolation   Voice Isolator - 48 kHz speech denoising, the realtime model streams with 20 ms look-ahead
// + PyTorch (the CUDA wheels for this card, else the CPU ones) and soxr; the weights come from Hugging Face (inworld/sava,
// inworld/voice-isolator) during the install, so the first conversation does not wait for them. scripts/voice_stream.py runs
// in it, kept up by lib/voiceStream.js.
//   paths(base)                  {dir, venv, python}
//   status(base)                 {installed, note, isolator}
//   install(ctx)                 -> {ok, error}   (ctx: {log, python, gpu, env, run, base} - the tests pass a fake run)
//   remove()                     -> (log) => {ok, error}
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const X = require("./setupExec");

const PKGS = [{ name: "inworld-sava", git: "git+https://github.com/inworld-ai/sava" },
              { name: "inworld-voice-isolation", git: "git+https://github.com/inworld-ai/voice-isolator" }];
const S = () => require("./speechAddons");

function paths(base) {
  const b = base || process.env.BITGEN_ADDON_BASE || core.BASE;
  const dir = path.join(b, "voice-kit"), venv = path.join(dir, ".venv");
  return { dir, venv, python: S().venvPy(venv), marker: path.join(dir, "installed.json") };
}

function status(base) {
  const p = paths(base);
  let mark = null;
  try { mark = JSON.parse(fs.readFileSync(p.marker, "utf8")); } catch { mark = null; }
  const py = fs.existsSync(p.python);
  const ok = py && !!mark && mark.sava === true;
  return { installed: ok, isolator: ok && mark.isolator === true, device: (mark && mark.device) || "",
    note: ok ? `ready (${mark.isolator ? "turn detection + noise isolation" : "turn detection; the voice isolator did not load"}, ${mark.device || "cpu"}) - the 📱 app's 🎙 Talk and the 🎙 voice chat stream to it`
      : py ? "partly there - Install again" : "not installed" };
}

async function install(ctx) {
  const c = ctx || {};
  const log = c.log || (() => {}), run = c.run || X.run, p = paths(c.base);
  const A = S();
  const pv = await A.pythonOk(c, "Voice conversation"); if (pv.error) return { ok: false, error: pv.error };
  log(`[ok] Python ${pv.ver} (${c.python}) - Inworld's SAVA + Voice Isolator (Apache-2.0 code and weights)`, false);
  fs.mkdirSync(p.dir, { recursive: true });
  try { fs.unlinkSync(p.marker); } catch { /* not there */ }
  const v = await A.makeVenv(c, p.venv); if (v.error) return { ok: false, error: v.error };
  const t = await A.installTorch(c, v.python, ["torch", "torchaudio"]); if (t.error) return { ok: false, error: t.error };
  for (const pk of PKGS) {
    log(`[..] ${pk.name}`, false);
    if (await run(v.python, ["-m", "pip", "install", pk.name, "soxr", "--progress-bar", "off"], { log, env: A.envOf(c), timeout: 30 * 60000 }) === 0) continue;
    log(`[warn] ${pk.name} is not on PyPI here - from its GitHub repository`, true);
    if (await run(v.python, ["-m", "pip", "install", pk.git, "soxr", "--progress-bar", "off"], { log, env: A.envOf(c), timeout: 30 * 60000 }) !== 0)
      return { ok: false, error: `pip could not install ${pk.name} - see the log above (git is needed for the GitHub copy)` };
  }
  // the weights now (Hugging Face, checked against the packages' own checksums) - and whether each model loads
  let res = null;
  const code = "import json\nr={'sava':False,'isolator':False,'device':'cpu'}\ntry:\n import torch\n r['device']='cuda' if torch.cuda.is_available() else 'cpu'\nexcept Exception: pass\n"
    + "from inworld import sava\nsava.load('inworld/sava'); r['sava']=True\n"
    + "try:\n from inworld import voice_isolation\n voice_isolation.VoiceIsolator('inworld/voice-isolator', mode='streaming', lookahead_frames=2); r['isolator']=True\nexcept Exception as e:\n r['isolator_error']=str(e)[:300]\n"
    + "print('VKIT '+json.dumps(r))";
  log("[..] the SAVA and Voice Isolator weights from Hugging Face (inworld/sava 51 MB, inworld/voice-isolator realtime)", false);
  const rc = await run(v.python, ["-c", code], { log: (l) => { const m = /VKIT (\{.*\})/.exec(String(l)); if (m) { try { res = JSON.parse(m[1]); } catch { /* not it */ } } else log(l, false); }, env: A.envOf(c), timeout: 60 * 60000 });
  if (rc !== 0 || !res || !res.sava) return { ok: false, error: "SAVA did not load after the install - see the log above (a firewall blocking huggingface.co?)" };
  if (!res.isolator) log("[warn] the Voice Isolator did not load (" + (res.isolator_error || "?") + ") - the conversation works with turn detection alone", true);
  fs.writeFileSync(p.marker, JSON.stringify({ sava: true, isolator: !!res.isolator, device: res.device, at: new Date().toISOString() }, null, 2));
  log(`[ok] ready on the ${res.device === "cuda" ? "graphics card" : "CPU"}: 🎙 Talk in the 📱 app and the 🎙 voice chat now stream to it - SAVA hears when you have FINISHED a sentence (a pause to think no longer cuts you off)${res.isolator ? ", the Voice Isolator takes the room's noise out first" : ""}`, false);
  try { require("./voiceStream").stop(); } catch { /* not running */ }
  return { ok: true };
}

function remove() {
  return async (log) => {
    try { require("./voiceStream").stop(); } catch { /* not running */ }
    const d = paths().dir;
    log(`[..] removing ${d}`, false);
    const ok = require("./setupPacks").safeRm(d, log);
    return ok ? { ok: true } : { ok: false, error: `could not remove ${d} - close anything using it and try again` };
  };
}

module.exports = { PKGS, paths, status, install, remove };
