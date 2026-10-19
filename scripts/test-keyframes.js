#!/usr/bin/env node
/* bitGen Studio — 2.379.0: ◆ keyframes + tweens - the shared maths, its compile mirror, the exporter and the wiring.
 * Run: node scripts/test-keyframes.js
 * Tim: "say we add a text to the preview canvas add a keyframe to the timeline on that text layer then add another
 * keyframe at a different time and scale or move or change color can we create a tween between the keyframes?"
 *   1. static/keyframes.js: held ends, linear / ease in / out / inout / hold, colours channel by channel, a property
 *      tweens only between the keyframes that set it, set / find / remove / step, normalize (the exporter's clean-up);
 *   2. worker.py's mirror (_kf_value) = static/keyframes.js on 400 random cases; the ffmpeg expression (_kf_expr) draws
 *      the same curve; the sendcmd file (_kf_cmd) carries the per-frame opacity and tint; the perspective chain;
 *   3. POST /api/export keeps kf (clean) on video-layer, picture and sound clips, the layer opacity and a keyed text
 *      colour's white twin (lib/tlKeys); POST /api/tlcanvas/text?variant=w writes text_<id>_w.png;
 *   4. the wiring: the page loads static/keyframes.js before its own script and kfValue uses it; lib/timelineEdit uses
 *      it; ⚙ Compile sends tf + kf; the canvas auto-keys; the compile uses scale (not scale2ref) for pictures. */
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const { execFileSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 600) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const K = require(path.join(ROOT, "static", "keyframes.js"));
const near = (a, b, t) => Math.abs(a - b) <= (t || 1e-9);

function req(port, method, u, body, type) {
  return new Promise((ok, no) => {
    const data = body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
    const r = http.request({ host: "127.0.0.1", port, path: u, method,
      headers: data ? { "Content-Type": type || "application/json", "Content-Length": data.length } : {} }, (res) => {
      let b = ""; res.on("data", (c) => { b += c; });
      res.on("end", () => { let j = null; try { j = JSON.parse(b); } catch { j = { raw: b.slice(0, 80) }; } ok({ status: res.statusCode, j }); });
    });
    r.on("error", no); if (data) r.write(data); r.end();
  });
}

(async () => {
  // 1
  const kf = [{ at: 1, x: 0, scale: 1, color: "#000000" }, { at: 3, x: 100, scale: 2, color: "#ff8000" }, { at: 5, x: 50 }];
  check("held before the first keyframe and after the last", K.value(kf, 0, "x", 9) === 0 && K.value(kf, 9, "x", 9) === 50);
  check("linear between two keyframes", near(K.value(kf, 2, "x", 0), 50) && near(K.value(kf, 4, "x", 0), 75));
  check("a property tweens only between the keyframes that SET it (scale stops at 3 s)", near(K.value(kf, 4, "scale", 9), 2) && K.value(kf, 2, "rot", 7) === 7);
  check("colours tween channel by channel", K.value(kf, 2, "color", "#fff") === "#804000" && K.value(kf, 0, "color", "#fff") === "#000000");
  const ek = (e) => [{ at: 0, x: 0, ease: e }, { at: 1, x: 100 }];
  check("eases: in (slow start) < linear < out (slow end); inout symmetric; hold jumps at the next keyframe",
    near(K.value(ek("in"), 0.25, "x", 0), 6.25) && near(K.value(ek("linear"), 0.25, "x", 0), 25) && near(K.value(ek("out"), 0.25, "x", 0), 43.75)
    && near(K.value(ek("inout"), 0.5, "x", 0), 50) && near(K.value(ek("inout"), 0.25, "x", 0), 15.625)
    && K.value(ek("hold"), 0.99, "x", 0) === 0 && K.value(ek("hold"), 1, "x", 0) === 100);
  let s = K.set(undefined, 0.51, { x: 5 }, 24);
  s = K.set(s, 2, { x: 9, y: 1 }, 24);
  s = K.set(s, 0.5, { scale: 2 }, 24);
  check("set: frame-snapped, half a frame = the same keyframe, sorted", s.length === 2 && near(s[0].at, 0.5) && s[0].x === 5 && s[0].scale === 2 && s[1].at === 2, s);
  check("find / step / remove", K.find(s, 2.01, 24) === s[1] && K.step(s, 0.5, 1) === 2 && K.step(s, 2, -1) === 0.5 && K.step(s, 2, 1) === null
    && K.remove(s, 2, 24).length === 1);
  const n = K.normalize([{ at: "1.23456", x: "10", scale: 99, op: -1, color: "#F80", ease: "inout", junk: 1 }, { at: 2 }, { at: -1, x: 1 }, "x"]);
  check("normalize: numbers cleaned and clamped, #rgb -> #rrggbb, known eases, empty / bad keyframes dropped",
    JSON.stringify(n) === JSON.stringify([{ at: 1.235, op: 0, x: 10, scale: 20, color: "#ff8800", ease: "inout" }]) && K.normalize([]) === undefined, n);

  // 2: the worker's mirror
  const cases = [];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 400; i++) {
    const keys = [];
    const nk = 1 + Math.floor(rnd() * 4);
    for (let j = 0; j < nk; j++) {
      const k = { at: Math.round(rnd() * 600) / 100 };
      if (rnd() < 0.8) k.x = Math.round(rnd() * 800 - 400);
      if (rnd() < 0.5) k.color = "#" + Math.floor(rnd() * 0xffffff).toString(16).padStart(6, "0");
      const e = K.EASES[Math.floor(rnd() * K.EASES.length)]; if (e !== "linear") k.ease = e;
      keys.push(k);
    }
    cases.push({ kf: keys, at: Math.round(rnd() * 700) / 100 - 0.5 });
  }
  const js = cases.map((c) => [K.value(c.kf, c.at, "x", -1), K.value(c.kf, c.at, "color", "#123456")]);
  const tmp = path.join(require("os").tmpdir(), "h3kf_" + process.pid + ".json");
  fs.writeFileSync(tmp, JSON.stringify(cases));
  const py = execFileSync("python3", ["-c", [
    "import sys, json, re; sys.argv=['x']; sys.path.insert(0, '.'); import worker",
    "cases = json.load(open(sys.argv[-1] if False else " + JSON.stringify(tmp) + "))",
    "out = []",
    "def if_(c, a, b): return a if c else b",
    "def lt(a, b): return 1 if a < b else 0",
    "def clip(v, lo, hi): return max(lo, min(hi, v))",
    "for c in cases:",
    "    v = worker._kf_value(c['kf'], c['at'], 'x', -1); col = worker._kf_value(c['kf'], c['at'], 'color', '#123456')",
    "    e = worker._kf_expr(c['kf'], 'x', -1, 'T').replace('if(', 'if_(')",
    "    out.append([v, col, eval(e, {'if_': if_, 'lt': lt, 'clip': clip, 'T': c['at']})])",
    "print(json.dumps(out))"].join("\n")], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").pop();
  fs.unlinkSync(tmp);
  const PY = JSON.parse(py);
  const bad = PY.map((r, i) => (near(r[0], js[i][0], 1e-6) && r[1] === js[i][1] && near(r[2], js[i][0], 1e-4)) ? null : { i, js: js[i], py: r, kf: cases[i] }).filter(Boolean);
  check("worker._kf_value = static/keyframes.js value() on 400 random cases (numbers and colours, every ease)", bad.length === 0, bad.slice(0, 2));
  check("...and worker._kf_expr (the ffmpeg expression) draws the same curve", bad.length === 0);

  const cmdOut = execFileSync("python3", ["-c", [
    "import sys, json, tempfile, os; sys.argv=['x']; sys.path.insert(0, '.'); import worker",
    "d = tempfile.mkdtemp(); p = os.path.join(d, 'kf3.cmd')",
    "kf = [{'at': 0, 'op': 1, 'color': '#ffffff'}, {'at': 1, 'op': 0, 'color': '#ff0000'}]",
    "f = worker._kf_cmd(kf, 'kf3', 4.0, 1.0, 0.5, '#ffffff', p)",
    "geo = worker._kf_perspective([{'at': 0, 'x': -100}, {'at': 2, 'x': 100, 'rot': 45}], {'scale': 0.5}, 640, 360)",
    "print(json.dumps([f, open(p).read(), geo]))"].join("\n")], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").pop();
  const [filt, cmd, geo] = JSON.parse(cmdOut);
  const lines = cmd.trim().split("\n");
  check("_kf_cmd: sendcmd + colorchannelmixer@tag starting at the first frame's values (opacity x the layer's, the tint)",
    filt === "sendcmd=f=kf3.cmd,colorchannelmixer@kf3=aa=0.5:rr=1.0:gg=1.0:bb=1.0", filt);
  const mid = lines.find((l) => l.startsWith("0.5000 "));
  check("...one line per changed frame; half way: opacity 0.25 (0.5 x the layer's 0.5), red stays 1, green / blue 0.5",
    !!mid && /aa 0\.25,/.test(mid) && /rr 1\.0,/.test(mid) && /gg 0\.502/.test(mid) && /bb 0\.502/.test(mid)
    && !lines.some((l) => parseFloat(l) > 1.6), [mid, lines.length]);
  check("_kf_perspective: a transparent canvas at least the frame's size, the corners moved per frame (the clip's own frames)",
    /^pad=w='trunc\(\(max\(iw,640\)\+9\)\/2\)\*2':h='trunc\(\(max\(ih,360\)\+9\)\/2\)\*2'.*color=black@0,perspective=x0='/.test(geo)
    && /sense=destination:eval=frame$/.test(geo) && /\(\(in-1\)\/24\)/.test(geo) && /max\(0\.01,0\.500000\)/.test(geo), geo.slice(0, 200));

  // 3: the exporter
  const core = require(path.join(ROOT, "lib", "core"));
  const express = require("express");
  const app = express();
  require(path.join(ROOT, "routes", "index.js")).mount(app);
  const srv = app.listen(0, "127.0.0.1"); await new Promise((ok) => srv.once("listening", ok));
  const port = srv.address().port;
  const realMake = core.makeJob;
  let captured = null;
  const tid = "zk" + process.pid;
  const imgDir = core.pDir("images");
  fs.mkdirSync(imgDir, { recursive: true });
  fs.writeFileSync(path.join(imgDir, `text_${tid}_w.png`), "x");
  core.makeJob = (params) => { captured = params; return { id: "cap", params, log: [], status: "queued" }; };
  try {
    await req(port, "POST", "/api/export", {
      video: [{ name: "a.mp4", src: "video", start: 0, in: 0, out: 2, dur: 2 }],
      video_layers: [{ name: "V2", opacity: 0.5, clips: [{ name: "b.mp4", src: "video", start: 0, in: 0, out: 2, kf: [{ at: 0, x: 1, junk: 2 }, { at: 1, x: 5, ease: "out" }] }] }],
      images: [{ clips: [{ name: `text_${tid}.png`, start: 0, len: 3, opacity: 0.4, lopacity: 0.8, text: { tid },
                           kf: [{ at: 0, color: "#fff" }, { at: 2, color: "#00ff00", op: 0.5 }] },
                         { name: "p.png", start: 0, len: 3, kf: [] }] }],
      audio: [{ clips: [{ name: "s.wav", start: 0, in: 0, kf: [{ at: 0, vol: 1 }, { at: 2, vol: 0.2 }] }] }] });
  } finally { core.makeJob = realMake; try { fs.unlinkSync(path.join(imgDir, `text_${tid}_w.png`)); } catch { /* gone */ } }
  const T = captured && captured.timeline;
  check("POST /api/export keeps a video-layer clip's keyframes (clean: unknown keys dropped, the ease kept)", T
    && JSON.stringify(T.video_layers[0].clips[0].kf) === JSON.stringify([{ at: 0, x: 1 }, { at: 1, x: 5, ease: "out" }]), T && T.video_layers[0].clips[0]);
  const ic = T && T.images[0].clips[0];
  check("...a text clip's keyframes, its layer's opacity and the WHITE TWIN for the keyed colour (lib/tlKeys)", ic
    && ic.kf.length === 2 && ic.kf[0].color === "#ffffff" && ic.lopacity === 0.8 && ic.tint === path.join(imgDir, `text_${tid}_w.png`) && !ic.tint_missing, ic);
  check("...no keyframes = no kf key (the plain compile path)", T && T.images[0].clips[1].kf === undefined, T && T.images[0].clips[1]);
  check("...a sound clip's volume keyframes", T && T.audio[0].clips[0].kf.length === 2 && T.audio[0].clips[0].kf[1].vol === 0.2, T && T.audio[0]);
  const png = execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "color=c=white:s=20x10", "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"]);
  const r = await req(port, "POST", `/api/tlcanvas/text?variant=w&id=${tid}`, png, "image/png");
  check("POST /api/tlcanvas/text?variant=w writes the white twin text_<id>_w.png", r.status === 200 && r.j.name === `text_${tid}_w.png`
    && fs.existsSync(path.join(imgDir, `text_${tid}_w.png`)), r);
  try { fs.unlinkSync(path.join(imgDir, `text_${tid}_w.png`)); } catch { /* gone */ }
  srv.close();

  // 4: the wiring
  const H = read("static", "index.html"), C = read("ext", "timelinedock", "canvas.js"), D = read("ext", "timelinedock", "timelinedock.js"), W = read("worker.py");
  check("the page loads static/keyframes.js before its own script; kfValue uses it",
    H.indexOf('<script src="/static/keyframes.js">') > 0 && H.indexOf('<script src="/static/keyframes.js">') < H.indexOf("function kfValue(")
    && /function kfValue\(c, at, prop, fb\) \{\s*return window\.H3Keyframes \? H3Keyframes\.value\(c && c\.kf, at, prop, fb\) : fb;/.test(H));
  check("lib/timelineEdit.kfValue and lib/keyframes share the same file", /require\("\.\/keyframes"\)\.value\(clip && clip\.kf/.test(read("lib", "timelineEdit.js"))
    && require(path.join(ROOT, "lib", "keyframes")) === K);
  check("the timeline's ◆ editor: x / y / scale / rotation, colour (text), the ease to the next ◆",
    /data-kfn="x"/.test(H) && /data-kfn="scale" data-mul="100"/.test(H) && /data-kfc="color"/.test(H) && /select data-kfe/.test(H) && /function kfAdd\(c, at, kind, lk\)/.test(H));
  check("⚙ Compile sends the canvas's tf and the keyframes (video layers, pictures / text, sounds)",
    (/opacity: c\.opacity \?\? 1, start: c\.start \|\| 0, tf: c\.tf, kf: c\.kf(?: \}|,\s+dur: c\.dur, fx: c\.fx)/.test(D) || (/opacity: c\.opacity \?\? 1, start: c\.start \|\| 0, \.\.\.tlTfKf\(c\),/.test(D) && /: \{ tf: c\.tf, kf: c\.kf \}; \}/.test(D))) && (/tf: c\.tf, kf: c\.kf, text: c\.text \? \{ tid: c\.tid \} : undefined/.test(D) || /\.\.\.tlTfKf\(c, "img"\), text: c\.text \? \{ tid: c\.tid \} : undefined/.test(D))
    && /in: c\.in, kf: c\.kf,\s+\/\/ 2\.379\.0: ◆ volume keyframes\s+volume: \(L\.volume \?\? 1\) \* \(c\.volume \?\? 1\)/.test(D));   // 2.415.0: the sound's level = layer x clip
  check("the canvas draws the tween (tfAt / textAt) and AUTO-KEYS a keyed property (writeTf / writeKeyed)",
    /var tf = (?:window\.TlParent && c\.parent \? TlParent\.world\(c, t\) : )?tfAt\(c, t\), src = null;/.test(C) && /src = renderText\(textAt\(c, t\)\)/.test(C) && /writeTf\(d\.c, \{ x: Math\.round\(nx\)/.test(C)
    && /if \(!writeKeyed\(c, "op", v\)\) c\.opacity = v;/.test(C) && /id="tlpKAdd"/.test(C));
  check("the compile scales pictures with their OWN aspect (scale, not scale2ref) and runs the keyframe chains",
    /parts\.append\(f"\{isrc\}scale=w='min\(iw,\{fw\}\)':h=-1\[img\{i\}\]"\)/.test(W) && /isrc = f"\[ishp\{i\}\]" if \(iin or iout\) else f"\[\{i\}:v\]"/.test(W) && !/scale2ref=w='min\(iw,main_w\)':h=-1/.test(W)
    && /_kf_perspective\(kf, c\.get\("tf"\), fw, fh\)/.test(W) && /volume=eval=frame:volume=/.test(W));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + e.stack); process.exit(1); });
