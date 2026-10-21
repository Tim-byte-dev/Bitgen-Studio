// bitGen Studio — lib/asrLive.js (2.564.0): LIVE speech-to-text for the 🎙 voice chat - one Whisper process kept up.
//
// Tim: "great, lets do the voice next" (asked before: "can it be like live chat"). A spoken turn must come back in about
// a second: lib/asr.js transcribeFile loads the model for every clip. This keeps scripts/asr_live.py running (the whisper
// venv, the model loaded once), sends it one JSON line per utterance and reads one back; it stops itself after 10 idle
// minutes (the model's memory back) and starts again on the next turn. If it cannot start, the one-shot path is used.
//   transcribe(wavPath, {language}) -> {text, language, device, live: true|false}
//   status() -> {running, ready, device, model}
//   stop()
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const core = require("./core");

const IDLE_MS = 10 * 60 * 1000;
const TURN_MS = 60 * 1000;
let proc = null, ready = null, info = {}, buf = "", seq = 0, idleT = null, over = null;
/** tests: {python, script} instead of the whisper venv + scripts/asr_live.py (null = the real ones) */
function configure(o) { over = o || null; }
const pending = new Map();

function cfg() { return require("./asr").cfg(); }
function stop() {
  if (proc) { try { proc.kill(); } catch { /* gone */ } }
  proc = null; ready = null; info = {};
  for (const [, p] of pending) { clearTimeout(p.timer); p.reject(new Error("the live transcriber stopped")); }
  pending.clear();
}
function idle() { clearTimeout(idleT); idleT = setTimeout(stop, IDLE_MS); if (idleT.unref) idleT.unref(); }

/** the process up and its model loaded (a promise; null-safe to call again) */
function ensure() {
  if (ready) return ready;
  const c = cfg();
  const v = over ? { ready: true, python: over.python } : require("./venv").venvReady("whisper", c.venv);
  if (!v.ready) return Promise.reject(new Error("faster-whisper is not installed - Settings ▸ Audio ▸ Install faster-whisper"));
  const cfgFile = path.join(os.tmpdir(), `h3asrlive_${process.pid}.json`);
  fs.writeFileSync(cfgFile, JSON.stringify({ model: c.model, model_dir: c.model_dir, device: c.device, compute_type: c.compute_type, language: c.language }));
  ready = new Promise((resolve, reject) => {
    let p;
    try { p = spawn(v.python, [over ? over.script : path.join(core.resolvePath("scripts"), "asr_live.py"), cfgFile], { stdio: ["pipe", "pipe", "pipe"] }); }
    catch (e) { ready = null; return reject(e); }
    proc = p; buf = "";
    let started = false, errTail = "";
    const t0 = setTimeout(() => { if (!started) { stop(); reject(new Error("the Whisper model took over 3 minutes to load")); } }, 180000);
    p.stderr.on("data", (d) => { errTail = (errTail + d).slice(-600); });
    p.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        let j; try { j = JSON.parse(line); } catch { continue; }
        if (!started) {
          started = true; clearTimeout(t0);
          if (j.fatal) { stop(); return reject(new Error(j.fatal)); }
          info = { device: j.device, model: j.model }; idle();
          return resolve(info);
        }
        const w = pending.get(j.id); if (!w) continue;
        pending.delete(j.id); clearTimeout(w.timer);
        if (j.error) w.reject(new Error(j.error)); else w.resolve({ text: String(j.text || "").trim(), language: j.language || "", device: j.device || info.device, live: true });
      }
    });
    p.on("error", (e) => { clearTimeout(t0); if (!started) reject(e); stop(); });
    p.on("close", () => { clearTimeout(t0); if (!started) reject(new Error("the live transcriber closed: " + errTail.trim().split("\n").pop())); if (proc === p) stop(); });
  });
  ready.catch(() => { ready = null; });
  return ready;
}

async function transcribe(wav, o) {
  const opts = o || {};
  try {
    await ensure();
    idle();
    const id = "u" + (++seq);
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error("the transcription took over a minute")); }, TURN_MS);
      pending.set(id, { resolve, reject, timer });
      proc.stdin.write(JSON.stringify({ id, audio: wav, language: opts.language || "" }) + "\n");
    });
  } catch (e) {
    if (/not installed/.test(e.message)) throw e;
    const r = await require("./asr").transcribeFile(wav);          // the one-shot path
    return { text: r.text, language: r.language, device: "", live: false, note: "live transcriber unavailable (" + e.message + ")" };
  }
}

function status() { return { running: !!proc, ready: !!(proc && info.device), device: info.device || "", model: info.model || cfg().model }; }

module.exports = { transcribe, status, stop, ensure, configure };
