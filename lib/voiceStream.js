// bitGen Studio — lib/voiceStream.js (2.919.0): the LIVE voice stream - SAVA's end-of-turn + the Voice Isolator, kept up.
//
// Tim (verbatim): "https://inworld.ai/open-source#voice-isolator, would this be something we can use to have a conversation
// with bitgen" -> "go ahead".
// The 📱 app's 🎙 Talk and the studio's 🎙 voice chat used to guess the end of what you said from the microphone's LEVEL
// (1.2 s / 0.85 s of quiet) and send the recording afterwards. Now, with Settings ▸ Add-ons ▸ Voice conversation installed,
// they STREAM the microphone here while you talk (routes/voiceStream.js - small PCM pieces, ~200 ms each) and this keeps
// scripts/voice_stream.py running in the voice-kit venv (lib/voiceKitAddon.js): the Voice Isolator cleans each piece, SAVA
// decides when the sentence is FINISHED; the cleaned turn is heard by the kept-up Whisper (lib/asrLive.js) and, for the app,
// answered by lib/appVoice.js - the result comes back in the next piece's answer.
//   status()                     {installed, isolator, running, ready, device, rate}
//   open({kind, history, phrases, mode, language, test_heard}) -> {sid, rate}    kind "app" | "chat"
//   push(sid, pcm (Buffer int16 LE), ) -> {events}  events: speech · heard {text} · result {...appVoice} · dropped · error
//   close(sid) -> {events}  (the last of it flushed; a turn still being heard comes in a later poll)
//   poll(sid)  -> {events}  (after close / while the PC is still hearing)
//   stop()                       the process down (its memory back) - it also stops itself after 10 idle minutes
//   configure({python, script, env, base})    tests: a stand-in Python / the stand-in `inworld` package
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const core = require("./core");

const IDLE_MS = 10 * 60 * 1000;
const SESSION_MS = 2 * 60 * 1000;
const REQ_MS = 20 * 1000;
let proc = null, ready = null, info = {}, buf = "", seq = 0, idleT = null, over = null;
const pending = new Map();
const sessions = new Map();

function configure(o) { over = o || null; stop(); }
const A = () => require("./voiceKitAddon");

function stop() {
  if (proc) { try { proc.kill(); } catch { /* gone */ } }
  proc = null; ready = null; info = {};
  for (const [, p] of pending) { clearTimeout(p.timer); p.reject(new Error("the voice stream stopped")); }
  pending.clear();
}
function idle() { clearTimeout(idleT); idleT = setTimeout(stop, IDLE_MS); if (idleT.unref) idleT.unref(); }

function installed() { return over ? true : A().status().installed; }

function ensure() {
  if (ready) return ready;
  if (!installed()) return Promise.reject(Object.assign(new Error("the voice conversation add-on is not installed - Settings ▸ Add-ons ▸ Voice conversation"), { notInstalled: true }));
  const st = over ? { isolator: true } : A().status();
  const python = over ? over.python : A().paths().python;
  const script = over && over.script ? over.script : path.join(core.resolvePath("scripts"), "voice_stream.py");
  const tmp = path.join(os.tmpdir(), "bitgen-voice-stream");
  const conf = { isolate: st.isolator !== false, device: "auto", tmp };
  const cfgFile = path.join(os.tmpdir(), `h3voicestream_${process.pid}.json`);
  fs.mkdirSync(tmp, { recursive: true });
  fs.writeFileSync(cfgFile, JSON.stringify(conf));
  ready = new Promise((resolve, reject) => {
    let p;
    try { p = spawn(python, [script, cfgFile], { stdio: ["pipe", "pipe", "pipe"], env: Object.assign({}, process.env, { PYTHONUTF8: "1" }, (over && over.env) || {}) }); }
    catch (e) { ready = null; return reject(e); }
    proc = p; buf = "";
    let started = false, errTail = "";
    const t0 = setTimeout(() => { if (!started) { stop(); reject(new Error("the voice models took over 3 minutes to load")); } }, 180000);
    p.stderr.on("data", (d) => { errTail = (errTail + d).slice(-800); });
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
          info = { device: j.device, isolator: !!j.isolator, rate: j.rate || 16000 }; idle();
          return resolve(info);
        }
        const w = pending.get(j.id); if (!w) continue;
        pending.delete(j.id); clearTimeout(w.timer);
        if (j.error) w.reject(new Error(j.error)); else w.resolve(j);
      }
    });
    p.on("error", (e) => { clearTimeout(t0); if (!started) reject(e); stop(); });
    p.on("close", () => { clearTimeout(t0); if (!started) reject(new Error("the voice stream closed: " + errTail.trim().split("\n").pop())); if (proc === p) stop(); });
  });
  ready.catch(() => { ready = null; });
  return ready;
}

function ask(req) {
  return new Promise((resolve, reject) => {
    if (!proc) return reject(new Error("the voice stream is not running"));
    const id = "v" + (++seq);
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("the voice stream did not answer")); }, REQ_MS);
    pending.set(id, { resolve, reject, timer });
    proc.stdin.write(JSON.stringify(Object.assign({ id }, req)) + "\n");
  });
}

function expire() {
  const now = Date.now();
  for (const [sid, s] of sessions) {
    if (now - s.at > SESSION_MS) { sessions.delete(sid); if (proc && s.open) ask({ op: "close", sid }).catch(() => {}); }
  }
}

/** a closed turn: heard (Whisper), then for the app what it means (lib/appVoice.js) -> into the session's queue */
async function hear(s, ev) {
  s.hearing++;
  try {
    let text = "";
    if (process.env.H3_E2E === "1" && s.test_heard) text = s.test_heard;             // the suite has no speech to text
    else {
      const r = await require("./asrLive").transcribe(ev.wav, { language: s.language || "" });
      text = String((r && r.text) || "").trim();
    }
    s.q.push({ type: "heard", text, seconds: ev.seconds, reason: ev.reason });
    if (s.kind === "app") {
      if (!text) s.q.push({ type: "result", heard: "" });
      else s.q.push(Object.assign({ type: "result" }, await require("./appVoice").handle(core, { text, history: s.history, custom: s.phrases, mode: s.mode })));
    }
  } catch (e) {
    s.q.push({ type: "error", error: /not installed/i.test(String(e.message)) ? "speech to text is not set up on your PC: bitGen Studio ▸ Settings ▸ Audio ▸ Install faster-whisper" : String(e.message || e) });
  } finally {
    s.hearing--;
    if (!(process.env.BITGEN_KEEP_TURNS === "1")) fs.unlink(ev.wav, () => {});
  }
}

function take(s, evs) {
  for (const ev of evs || []) {
    if (ev.type === "turn") {
      s.turns++;
      s.q.push({ type: "turn", seconds: ev.seconds, reason: ev.reason });
      if (!s.done) { s.done = true; hear(s, ev); }                  // one turn per session: the rest of the audio is ignored
    } else s.q.push(ev);
  }
  const out = s.q.splice(0);
  return { events: out, hearing: s.hearing > 0, done: s.done && s.hearing === 0 };
}

async function open(o) {
  const x = o || {};
  expire();
  const r = await ensure();
  idle();
  const sid = crypto.randomBytes(8).toString("hex");
  const rate = r.isolator ? 48000 : 16000;
  await ask({ op: "open", sid, rate });
  let history = x.history; if (typeof history === "string") { try { history = JSON.parse(history); } catch { history = []; } }
  let phrases = x.phrases; if (typeof phrases === "string") { try { phrases = JSON.parse(phrases); } catch { /* lines */ } }
  sessions.set(sid, { sid, kind: x.kind === "app" ? "app" : "chat", history: Array.isArray(history) ? history.slice(-10) : [],
    phrases: phrases || [], mode: x.mode === "dictate" ? "dictate" : "talk", language: String(x.language || ""),
    test_heard: process.env.H3_E2E === "1" ? String(x.test_heard || "") : "",
    q: [], at: Date.now(), open: true, done: false, hearing: 0, turns: 0, rate });
  return { sid, rate, isolator: !!r.isolator, device: r.device };
}

function sess(sid) {
  const s = sessions.get(String(sid || ""));
  if (!s) throw Object.assign(new Error("that voice session is over - start talking again"), { status: 404 });
  s.at = Date.now();
  return s;
}

async function push(sid, pcm) {
  const s = sess(sid);
  idle();
  if (!s.open || s.done) return take(s, []);                       // heard already: the rest is not needed
  const b = Buffer.isBuffer(pcm) ? pcm : Buffer.from(pcm || []);
  if (!b.length) return take(s, []);
  if (b.length > 48000 * 2 * 5) throw Object.assign(new Error("a voice piece is at most 5 seconds"), { status: 413 });
  const j = await ask({ op: "push", sid: s.sid, pcm: b.toString("base64") });
  return take(s, j.events);
}

async function close(sid) {
  const s = sess(sid);
  let evs = [];
  if (s.open) { s.open = false; try { evs = (await ask({ op: "close", sid: s.sid })).events; } catch { evs = []; } }
  const r = take(s, evs);
  if (r.done || (!s.hearing && !s.done)) setTimeout(() => sessions.delete(s.sid), 30000);
  return r;
}

function poll(sid) { return take(sess(sid), []); }

function status() {
  const st = over ? { installed: true, isolator: true, note: "test" } : A().status();
  return { installed: st.installed, isolator: !!st.isolator, note: st.note, running: !!proc, ready: !!(proc && info.device),
    device: info.device || st.device || "", rate: (proc && info.rate) || (st.isolator ? 48000 : 16000), sessions: sessions.size };
}

module.exports = { configure, status, open, push, close, poll, stop, ensure, _sessions: sessions };
