"use strict";
/**
 * screenCap.js — SCREEN CAPTURE + SCREEN RECORD (2.367.0).
 *
 * Tim: "can we add a screen capture and screen record button in the left docker menubar, icon only. so i can
 * make a promotional video and tutorials".
 *
 * Every capture lands in projects/<p>/output, so the gallery lists it (Image / Video tab) and Save / Save as,
 * the timeline and the references take it like any render:
 *   savePng(buf)            screenshot_<stamp>.png (a PNG checked by its signature)
 *   start()                 a recording session -> {id}; its chunks are appended to a temp .webm as they arrive,
 *                           so an hour-long tutorial never sits in the page's memory
 *   append(id, buf)         one MediaRecorder chunk, in order
 *   finish(id)              the .webm -> screenrec_<stamp>.mp4 (H.264 yuv420p, even size, constant 30 fps, AAC
 *                           192k, +faststart - plays in every editor and on every phone). ffmpeg runs ASYNC, the
 *                           server keeps answering while a long recording converts. If ffmpeg fails, the .webm
 *                           itself is kept in the gallery and the reason is said.
 *   cancel(id)              drops the session and its temp file
 * Sessions idle for 30 minutes are dropped (a page closed mid-recording).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const core = require("./core");

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IDLE_MS = 30 * 60 * 1000;
const FPS = 30;
const sessions = new Map();         // id -> {file, bytes, chunks, project, started, touched}

function outDir(project) {
  const d = path.join(core.projDir(project || core.getProject()), "output");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function tmpDir() {
  const d = path.join(os.tmpdir(), "bitgen-screencap");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** 20261003-201502 (local time) - sortable, no characters a file system refuses. */
function stamp(d) {
  const t = d || new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}-${p(t.getHours())}${p(t.getMinutes())}${p(t.getSeconds())}`;
}

/** A name not taken in `dir`: base.ext, base_2.ext, base_3.ext ... */
function freeName(dir, base, ext) {
  let n = `${base}${ext}`, k = 2;
  while (fs.existsSync(path.join(dir, n))) n = `${base}_${k++}${ext}`;
  return n;
}

function savePng(buf, project) {
  if (!Buffer.isBuffer(buf) || buf.length < PNG_SIG.length || !buf.subarray(0, 8).equals(PNG_SIG)) {
    return { error: "that is not a PNG picture", status: 400 };
  }
  const dir = outDir(project);
  const name = freeName(dir, `screenshot_${stamp()}`, ".png");
  fs.writeFileSync(path.join(dir, name), buf);
  return { name, bytes: buf.length, note: `screenshot saved to the gallery as ${name}` };
}

function sweep() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.touched > IDLE_MS) { try { fs.unlinkSync(s.file); } catch {} sessions.delete(id); }
  }
}

function start(project) {
  sweep();
  const id = crypto.randomBytes(8).toString("hex");
  const file = path.join(tmpDir(), `rec_${id}.webm`);
  fs.writeFileSync(file, Buffer.alloc(0));
  const now = Date.now();
  sessions.set(id, { file, bytes: 0, chunks: 0, project: project || core.getProject(), started: now, touched: now });
  return { id };
}

function get(id) {
  const s = sessions.get(String(id || ""));
  return s || null;
}

function append(id, buf) {
  const s = get(id);
  if (!s) return { error: "no such recording (it was finished, cancelled or timed out)", status: 404 };
  if (!Buffer.isBuffer(buf) || !buf.length) return { chunks: s.chunks, bytes: s.bytes };
  fs.appendFileSync(s.file, buf);
  s.bytes += buf.length; s.chunks += 1; s.touched = Date.now();
  return { chunks: s.chunks, bytes: s.bytes };
}

/** The ffmpeg arguments for the .webm -> .mp4 conversion (pure - tested). */
function mp4Args(src, out) {
  return ["-y", "-hide_banner", "-loglevel", "error", "-fflags", "+genpts", "-i", src,
          "-map", "0:v:0", "-map", "0:a:0?",
          "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p", "-r", String(FPS),
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
          "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
          "-movflags", "+faststart", out];
}

function run(bin, args) {
  return new Promise((resolve) => {
    let err = "";
    let p;
    try { p = spawn(bin, args, { windowsHide: true }); }
    catch (e) { return resolve({ code: -1, err: e.message }); }
    p.stderr.on("data", (d) => { err += d; if (err.length > 8000) err = err.slice(-8000); });
    p.on("error", (e) => resolve({ code: -1, err: e.message }));
    p.on("close", (code) => resolve({ code, err: err.trim() }));
  });
}

async function finish(id, opts) {
  const s = get(id);
  if (!s) return { error: "no such recording (it was finished, cancelled or timed out)", status: 404 };
  sessions.delete(String(id));
  if (!s.bytes) { try { fs.unlinkSync(s.file); } catch {} return { error: "the recording is empty - nothing was captured", status: 400 }; }
  const seconds = Math.round((Date.now() - s.started) / 100) / 10;
  const dir = outDir(s.project);
  const base = `screenrec_${stamp(new Date(s.started))}`;
  const name = freeName(dir, base, ".mp4");
  const out = path.join(dir, name);
  const r = await run((opts && opts.ffmpeg) || "ffmpeg", mp4Args(s.file, out));
  if (r.code === 0 && fs.existsSync(out) && fs.statSync(out).size > 0) {
    try { fs.unlinkSync(s.file); } catch {}
    return { name, bytes: fs.statSync(out).size, seconds,
             note: `screen recording saved to the gallery as ${name} (${seconds} s, H.264 mp4)` };
  }
  try { fs.unlinkSync(out); } catch {}
  const keep = freeName(dir, base, ".webm");
  try { fs.copyFileSync(s.file, path.join(dir, keep)); fs.unlinkSync(s.file); }
  catch (e) { return { error: `the recording could not be saved: ${e.message}`, status: 500 }; }
  const why = (r.err || `ffmpeg exited ${r.code}`).split("\n").slice(-2).join(" ");
  return { name: keep, bytes: fs.statSync(path.join(dir, keep)).size, seconds, converted: false,
           note: `screen recording kept as ${keep} - the mp4 conversion failed (${why})` };
}

function cancel(id) {
  const s = get(id);
  if (!s) return { cancelled: false };
  sessions.delete(String(id));
  try { fs.unlinkSync(s.file); } catch {}
  return { cancelled: true };
}

module.exports = { PNG_SIG, FPS, IDLE_MS, stamp, freeName, savePng, start, append, finish, cancel, mp4Args,
                   outDir, _sessions: sessions, _sweep: sweep };
