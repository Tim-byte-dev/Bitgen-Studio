#!/usr/bin/env node
/* bitGen Studio — 2.367.0: SCREEN CAPTURE + SCREEN RECORD (the left dock's 📷 / ⏺).
 * Run: node scripts/test-screencap.js
 * Tim: "can we add a screen capture and screen record button in the left docker menubar, icon only. so i can
 * make a promotional video and tutorials".
 *   1. lib/screenCap: the stamp + free names, a PNG saved to output/ (anything else refused), a recording
 *      appended chunk by chunk and made into an H.264/AAC mp4 with even sides, a failed conversion keeps the
 *      .webm and says why, cancel / empty / unknown sessions, the idle sweep;
 *   2. routes/screenCap.js LIVE on an express app that has express.json() first (as routes/index.js does);
 *   3. electron/capture.js with fakes: the app window / the window's screen picked, the computer's sound only
 *      on Windows and only when asked, capture:setup, capture:shot (window = capturePage, screen = the display's
 *      real size);
 *   4. jsdom: static/screencap.js - two icon-only buttons in the left dock's menu bar before ⚙, the right-click
 *      options remembered, 📷 through the app shell, ⏺ start -> chunks -> stop -> finish, the gallery refreshed;
 *   5. the wiring (routes/index.js, static/index.html, electron/main.js + preload.js; never server.js). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawnSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 900) : "")); }
}
const ROOT = path.join(__dirname, "..");
process.chdir(ROOT);
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const core = require(path.join(ROOT, "lib", "core"));
const SC = require(path.join(ROOT, "lib", "screenCap"));
const OUT = SC.outDir();
const made = [];
const before = new Set(fs.readdirSync(OUT));
const T = fs.mkdtempSync(path.join(os.tmpdir(), "screencap367_"));
const PNG = Buffer.concat([SC.PNG_SIG, Buffer.from("IHDR-fake-body")]);
const probe = (f, sel, entry) => spawnSync("ffprobe", ["-v", "error", "-select_streams", sel, "-show_entries", entry,
  "-of", "csv=p=0", f], { encoding: "utf8" }).stdout.trim();

(async () => {
try {
  // ---- 1. the module
  check("stamp: YYYYMMDD-HHMMSS (sortable, no reserved characters)",
    SC.stamp(new Date(2026, 9, 3, 7, 5, 9)) === "20261003-070509");
  fs.writeFileSync(path.join(T, "a.png"), "x"); fs.writeFileSync(path.join(T, "a_2.png"), "x");
  check("freeName: a taken name gets _2, _3", SC.freeName(T, "a", ".png") === "a_3.png" && SC.freeName(T, "b", ".png") === "b.png");
  let r = SC.savePng(Buffer.from("not a png"));
  check("savePng: anything that is not a PNG is refused in words (400)", r.status === 400 && /not a PNG/.test(r.error), r);
  r = SC.savePng(PNG); made.push(r.name);
  check("savePng: screenshot_<stamp>.png in the project's output (the gallery), the note says so",
    /^screenshot_\d{8}-\d{6}(_\d+)?\.png$/.test(r.name) && fs.readFileSync(path.join(OUT, r.name)).equals(PNG)
    && /saved to the gallery as screenshot_/.test(r.note), r);
  const r2 = SC.savePng(PNG); made.push(r2.name);
  check("...a second screenshot in the same second never overwrites the first", r2.name !== r.name, [r.name, r2.name]);

  // a real webm (odd size, with sound) split into MediaRecorder-sized chunks
  const W = path.join(T, "src.webm");
  const g = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=321x181:rate=24", "-f", "lavfi",
    "-i", "sine=frequency=440:sample_rate=48000", "-t", "1.5", "-c:v", "libvpx", "-b:v", "400k", "-c:a", "libopus", W]);
  check("(fixture) a 1.5 s 321x181 webm with opus sound", g.status === 0 && fs.existsSync(W), String(g.stderr));
  const data = fs.readFileSync(W);
  let s = SC.start();
  check("start: a session id; its temp file exists and is empty",
    /^[0-9a-f]{16}$/.test(s.id) && SC._sessions.get(s.id) && fs.statSync(SC._sessions.get(s.id).file).size === 0, s);
  const step = Math.ceil(data.length / 4);
  let a;
  for (let i = 0; i < data.length; i += step) a = SC.append(s.id, data.subarray(i, i + step));
  check("append: four chunks in order, the bytes counted", a.chunks === 4 && a.bytes === data.length, a);
  check("...the temp file is the chunks joined (nothing held in memory)", fs.readFileSync(SC._sessions.get(s.id).file).equals(data));
  const tmpFile = SC._sessions.get(s.id).file;
  r = await SC.finish(s.id); made.push(r.name);
  const mp4 = path.join(OUT, r.name || "x");
  check("finish: screenrec_<stamp>.mp4 in the gallery, the note says H.264 mp4, the temp .webm gone",
    /^screenrec_\d{8}-\d{6}(_\d+)?\.mp4$/.test(r.name) && fs.existsSync(mp4) && /H\.264 mp4/.test(r.note)
    && !fs.existsSync(tmpFile) && !SC._sessions.has(s.id), r);
  check("...H.264 yuv420p video with EVEN sides (321x181 -> 320x180) and AAC sound",
    probe(mp4, "v:0", "stream=codec_name,pix_fmt,width,height") === "h264,320,180,yuv420p"
    && probe(mp4, "a:0", "stream=codec_name") === "aac",
    [probe(mp4, "v:0", "stream=codec_name,pix_fmt,width,height"), probe(mp4, "a:0", "stream=codec_name")]);
  check("...a constant 30 fps (a screen recording is variable-rate; editors want constant)",
    probe(mp4, "v:0", "stream=r_frame_rate") === "30/1", probe(mp4, "v:0", "stream=r_frame_rate"));
  const args = SC.mp4Args("in.webm", "out.mp4");
  check("mp4Args: libx264 crf 18, AAC 192k, +faststart, the sound optional (0:a:0?) - a silent recording works",
    args.includes("libx264") && args[args.indexOf("-crf") + 1] === "18" && args.includes("+faststart")
    && args.includes("0:a:0?") && args[args.length - 1] === "out.mp4");
  s = SC.start(); SC.append(s.id, data);
  r = await SC.finish(s.id, { ffmpeg: path.join(T, "no-such-ffmpeg") }); made.push(r.name);
  check("a failed conversion: the .webm itself is kept in the gallery, converted:false, the reason said",
    /^screenrec_.*\.webm$/.test(r.name) && r.converted === false && fs.readFileSync(path.join(OUT, r.name)).equals(data)
    && /mp4 conversion failed/.test(r.note), r);
  s = SC.start();
  r = await SC.finish(s.id);
  check("an empty recording: refused in words, nothing written", r.status === 400 && /empty/.test(r.error), r);
  s = SC.start(); SC.append(s.id, Buffer.from("abc")); const cf = SC._sessions.get(s.id).file;
  check("cancel: the session and its temp file are gone", SC.cancel(s.id).cancelled === true && !fs.existsSync(cf) && !SC._sessions.has(s.id));
  check("an unknown session: 404 for append and finish, cancel says false",
    SC.append("nope", Buffer.from("x")).status === 404 && (await SC.finish("nope")).status === 404 && SC.cancel("nope").cancelled === false);
  s = SC.start(); SC._sessions.get(s.id).touched -= SC.IDLE_MS + 1000; const sf = SC._sessions.get(s.id).file; SC._sweep();
  check("the idle sweep drops a session left 30 min (a page closed mid-recording)", !SC._sessions.has(s.id) && !fs.existsSync(sf));

  // ---- 2. the routes LIVE
  const express = require("express");
  const app = express(); app.use(express.json());
  require(path.join(ROOT, "routes", "screenCap")).mount(app);
  const srv = app.listen(0, "127.0.0.1");
  await new Promise((ok) => srv.once("listening", ok));
  const port = srv.address().port;
  const req = (p, body, type) => new Promise((ok) => {
    const d = body == null ? Buffer.alloc(0) : body;
    const rq = http.request({ host: "127.0.0.1", port, path: p, method: "POST",
      headers: { "Content-Type": type || "application/octet-stream", "Content-Length": d.length } }, (rs) => {
      let b = ""; rs.on("data", (c) => (b += c)); rs.on("end", () => { let j = null; try { j = JSON.parse(b); } catch {} ok({ status: rs.statusCode, j }); });
    });
    rq.write(d); rq.end();
  });
  let q = await req("/api/screencap/shot", PNG, "image/png");
  made.push(q.j && q.j.name);
  check("POST /api/screencap/shot (raw image/png): saved, {ok, name, note}", q.status === 200 && q.j.ok && /^screenshot_/.test(q.j.name), q);
  q = await req("/api/screencap/shot", Buffer.from("<html>"), "text/html");
  check("...a body that is not a PNG: 400 in words", q.status === 400 && /not a PNG/.test(q.j.error), q);
  q = await req("/api/screencap/rec/start", Buffer.from("{}"), "application/json");
  const id = q.j && q.j.id;
  check("POST /api/screencap/rec/start (json, through express.json): {id}", q.status === 200 && /^[0-9a-f]{16}$/.test(id), q);
  for (let i = 0; i < data.length; i += step) q = await req(`/api/screencap/rec/${id}/chunk`, data.subarray(i, i + step));
  check("POST .../chunk x4 (raw octet-stream, read as a stream): counted", q.status === 200 && q.j.chunks === 4 && q.j.bytes === data.length, q);
  q = await req(`/api/screencap/rec/${id}/finish`, Buffer.from("{}"), "application/json");
  made.push(q.j && q.j.name);
  check("POST .../finish: the mp4 in the gallery, {name, seconds, note}",
    q.status === 200 && /^screenrec_.*\.mp4$/.test(q.j.name) && fs.existsSync(path.join(OUT, q.j.name)) && typeof q.j.seconds === "number", q);
  q = await req(`/api/screencap/rec/${id}/chunk`, Buffer.from("late"));
  check("...a chunk after finish: 404 in words", q.status === 404 && /no such recording/.test(q.j.error), q);
  q = await req("/api/screencap/rec/start", Buffer.from("{}"), "application/json");
  const id2 = q.j.id;
  q = await req(`/api/screencap/rec/${id2}/cancel`, Buffer.from("{}"), "application/json");
  check("POST .../cancel: {cancelled: true}", q.status === 200 && q.j.cancelled === true, q);
  srv.close();

  // ---- 3. electron/capture.js with fakes
  const CAP = require(path.join(ROOT, "electron", "capture"));
  const handlers = {}; let dmh = null;
  const fakeWin = { getMediaSourceId: () => "window:42:0", getBounds: () => ({ x: 0, y: 0, width: 10, height: 10 }),
    webContents: { capturePage: async () => ({ toPNG: () => Buffer.from("WINPNG") }) } };
  const sources = [{ id: "screen:1:0", display_id: "1", name: "Screen 1", thumbnail: { toPNG: () => Buffer.from("SCR1") } },
                   { id: "screen:2:0", display_id: "2", name: "Screen 2", thumbnail: { toPNG: () => Buffer.from("SCR2") } },
                   { id: "window:7:0", name: "Notepad" }, { id: "window:42:0", name: "bitGen Studio" }];
  let thumbAsk = null;
  const fake = (platform) => ({
    ipcMain: { handle: (ch, fn) => { handlers[ch] = fn; } },
    session: { defaultSession: { setDisplayMediaRequestHandler: (fn) => { dmh = fn; } } },
    desktopCapturer: { getSources: async (o) => { thumbAsk = o; return sources.filter((x) => o.types.some((t) => x.id.startsWith(t + ":"))); } },
    screen: { getDisplayMatching: () => ({ id: 2, scaleFactor: 1.5, size: { width: 1920, height: 1080 } }) },
    getWin: () => fakeWin, platform });
  CAP.register(fake("win32"));
  const ask = (req) => new Promise((ok) => dmh(req, ok));
  let pick = await ask({ audioRequested: true });
  check("display media: the APP WINDOW by its media source id (not another window), Windows loopback sound",
    pick.video && pick.video.id === "window:42:0" && pick.audio === "loopback", pick);
  let st = await handlers["capture:setup"](null, { target: "screen", systemAudio: false });
  check("capture:setup: target + sound remembered, systemAudioSupported on Windows",
    st.target === "screen" && st.systemAudio === false && st.systemAudioSupported === true, st);
  pick = await ask({ audioRequested: true });
  check("...whole screen = the screen the window is on (display 2); sound off = no audio", pick.video.id === "screen:2:0" && !("audio" in pick), pick);
  await handlers["capture:setup"](null, { target: "window", systemAudio: true });
  pick = await ask({ audioRequested: false });
  check("...a request without audio never gets loopback", pick.video.id === "window:42:0" && !("audio" in pick), pick);
  let shotB = await handlers["capture:shot"](null, { target: "window" });
  check("capture:shot window: webContents.capturePage().toPNG()", String(shotB) === "WINPNG");
  shotB = await handlers["capture:shot"](null, { target: "screen" });
  check("capture:shot screen: the window's display at its real pixel size (1920x1080 x 1.5)",
    String(shotB) === "SCR2" && thumbAsk.thumbnailSize.width === 2880 && thumbAsk.thumbnailSize.height === 1620, thumbAsk);
  CAP.register(fake("darwin"));
  pick = await ask({ audioRequested: true });
  check("macOS / Linux: no loopback (the page records the mic instead)", pick.video.id === "window:42:0" && !("audio" in pick), pick);
  check("pickSource: no media id match -> a window named bitGen, then a screen",
    CAP.pickSource(sources, "window", { getMediaSourceId: () => "window:999:0" }, null).id === "window:42:0");

  // ---- 4. jsdom
  let JSDOM;
  try { ({ JSDOM } = require("jsdom")); } catch { console.log("(jsdom missing - the page checks are skipped)"); }
  if (JSDOM) {
    const html = `<!doctype html><head></head><body><aside class="dock" id="ldock"><div class="dockhead"><span class="projbtns">
      <button class="ghost" id="projNew">✚ New</button><button class="ghost" id="projSave">💾</button>
      <button class="ghost" id="openSettings">⚙</button><button class="ghost" id="resetModels">⏏</button></span></div></aside></body>`;
    const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://127.0.0.1:8311/", pretendToBeVisual: true });
    const w = dom.window;
    const posts = [];
    w.fetch = async (url, o) => {
      posts.push({ url, type: o && o.headers && o.headers["Content-Type"], size: o && o.body && (o.body.size || o.body.length || 0) });
      let j = { ok: true };
      if (/shot$/.test(url)) j = { ok: true, name: "screenshot_x.png", note: "screenshot saved to the gallery as screenshot_x.png" };
      if (/rec\/start$/.test(url)) j = { ok: true, id: "abcd" };
      if (/finish$/.test(url)) j = { ok: true, name: "screenrec_x.mp4", note: "screen recording saved to the gallery as screenrec_x.mp4" };
      return { ok: true, status: 200, json: async () => j };
    };
    let galleryN = 0; w.refreshGallery = () => { galleryN++; };
    const said = []; w.SaveAs = { say: (t, bad) => said.push([t, !!bad]) };
    w.h3shell = { capture: { shot: async (p) => { w._shotTarget = p.target; return new Uint8Array([137, 80, 78, 71]); },
                             setup: async (p) => { w._setup = p; return p; } } };
    w.eval(read("static", "screencap.js"));
    const bar = w.document.querySelector(".projbtns");
    const ids = [...bar.children].map((b) => b.id);
    const sB = w.document.getElementById("capShot"), rB = w.document.getElementById("capRec");
    check("two buttons in the left dock's menu bar, right before ⚙ (after 💾)",
      ids.join(",") === "projNew,projSave,capShot,capRec,openSettings,resetModels", ids);
    check("...icon only (📷, ⏺), ghost style like their neighbours, the tooltips say what and the key",
      sB.textContent === "📷" && rB.textContent === "⏺" && sB.className === "ghost" && rB.className === "ghost"
      && /Alt\+Shift\+S/.test(sB.title) && /Alt\+Shift\+R/.test(rB.title) && /Right-click/.test(rB.title));
    sB.dispatchEvent(new w.MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    const m = w.document.getElementById("capMenu");
    check("right-click: the options - App window / Whole screen, Computer sound, Microphone, Countdown",
      m && m.querySelectorAll("input[name=capTarget]").length === 2 && m.querySelector("#capSys") && m.querySelector("#capMic")
      && m.querySelectorAll("input[name=capCd]").length === 3 && m.querySelector('input[value="window"]').checked);
    const scr = m.querySelector('input[name=capTarget][value="screen"]'); scr.checked = true;
    scr.dispatchEvent(new w.Event("change", { bubbles: true }));
    const mic = m.querySelector("#capMic"); mic.checked = true; mic.dispatchEvent(new w.Event("change", { bubbles: true }));
    const saved = JSON.parse(w.localStorage.getItem("bitgen.screencap"));
    check("...a change is remembered on this computer", saved.target === "screen" && saved.mic === true, saved);
    w.ScreenCap.prefs.target = "window"; w.ScreenCap.prefs.mic = false; w.ScreenCap.savePrefs();
    const sr = await w.ScreenCap.shot();
    check("📷 in the app: the shell captures (the chosen target), the PNG is posted raw, the gallery refreshes, said",
      w._shotTarget === "window" && posts.some((p) => p.url === "/api/screencap/shot" && p.type === "image/png")
      && galleryN === 1 && said.some((x) => /saved to the gallery as screenshot_x\.png/.test(x[0])) && sr && sr.name === "screenshot_x.png",
      { posts, said });
    check("...the menu closed on capture, the button usable again", !w.document.getElementById("capMenu") && !sB.disabled);

    // ⏺ with a fake screen stream + MediaRecorder
    const track = (kind) => { const t = new w.EventTarget(); t.kind = kind; t.stopped = false; t.stop = () => { t.stopped = true; }; return t; };
    const vT = track("video");
    w.MediaStream = class { constructor(t) { this._t = t || []; } getTracks() { return this._t; }
      getVideoTracks() { return this._t.filter((x) => x.kind === "video"); } getAudioTracks() { return this._t.filter((x) => x.kind === "audio"); } };
    let recOpts = null, recRef = null;
    w.MediaRecorder = class { constructor(s, o) { recOpts = o; recRef = this; this.state = "inactive"; this.stream = s; }
      static isTypeSupported(t) { return t === "video/webm;codecs=vp8,opus"; }
      start(ms) { this.state = "recording"; this.slice = ms; }
      stop() { this.state = "inactive"; this.ondataavailable({ data: new w.Blob(["LAST"]) }); setTimeout(() => this.onstop(), 0); } };
    w.navigator.mediaDevices = { getDisplayMedia: async (o) => { w._dmOpt = o; return new w.MediaStream([vT]); },
                                 getUserMedia: async () => { throw new Error("no mic"); } };
    posts.length = 0; galleryN = 0;
    await w.ScreenCap.toggle();
    check("⏺ start: the shell told the target + sound, the screen asked at 30 fps with sound, a session started",
      w._setup && w._setup.target === "window" && w._setup.systemAudio === true && w._dmOpt.audio === true
      && w._dmOpt.video.frameRate.ideal === 30 && posts[0].url === "/api/screencap/rec/start", { setup: w._setup, posts });
    check("...MediaRecorder with the best supported webm, 16 Mbps, a chunk every second",
      recOpts.mimeType === "video/webm;codecs=vp8,opus" && recOpts.videoBitsPerSecond === 16000000 && recRef.slice === 1000, recOpts);
    check("...the button is a pulsing red ■ with the time in its tooltip", rB.classList.contains("rec") && rB.textContent === "■"
      && /Stop recording \(0:00\)/.test(rB.title) && w.ScreenCap.recording());
    recRef.ondataavailable({ data: new w.Blob(["CHUNK1"]) });
    recRef.ondataavailable({ data: new w.Blob(["CHUNK2"]) });
    const r0 = w.ScreenCap._last();
    await w.ScreenCap.toggle();                 // stop
    await new Promise((ok) => setTimeout(ok, 20));
    await r0.finished;
    const urls = posts.map((p) => p.url);
    check("⏺ stop: every chunk posted in order (the last one too), THEN finish; the screen track stopped",
      JSON.stringify(urls) === JSON.stringify(["/api/screencap/rec/start", "/api/screencap/rec/abcd/chunk",
        "/api/screencap/rec/abcd/chunk", "/api/screencap/rec/abcd/chunk", "/api/screencap/rec/abcd/finish"]) && vT.stopped, urls);
    check("...the gallery refreshed, the mp4 named, the button back to ⏺", galleryN === 1
      && said.some((x) => /screenrec_x\.mp4/.test(x[0])) && rB.textContent === "⏺" && !rB.classList.contains("rec") && !rB.disabled);
    // the browser's own "Stop sharing" ends the recording too
    posts.length = 0;
    const vT2 = track("video");
    w.navigator.mediaDevices.getDisplayMedia = async () => new w.MediaStream([vT2]);
    await w.ScreenCap.toggle();
    const r1 = w.ScreenCap._last();
    vT2.dispatchEvent(new w.Event("ended"));
    await new Promise((ok) => setTimeout(ok, 20)); await r1.finished;
    check("the browser's “Stop sharing” stops and saves the recording", posts.some((p) => /finish$/.test(p.url)) && !w.ScreenCap.recording());
    // a cancelled picker
    w.navigator.mediaDevices.getDisplayMedia = async () => { const e = new Error("denied"); e.name = "NotAllowedError"; throw e; };
    said.length = 0; posts.length = 0;
    const rc = await w.ScreenCap.toggle();
    check("a cancelled picker: said quietly, no session started, the button usable",
      rc === null && said.some((x) => x[0] === "recording cancelled" && !x[1]) && !posts.length && !rB.disabled, said);
    // the shortcut
    let fired = 0; const real = w.ScreenCap.shot;
    w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "S", altKey: true, shiftKey: true, bubbles: true }));
    await new Promise((ok) => setTimeout(ok, 20));
    fired = posts.filter((p) => /shot$/.test(p.url)).length;
    check("Alt+Shift+S takes a screenshot (no click in the video)", fired === 1, posts);
    void real;
  }

  // ---- 4b. 2.368.1 (Tim: "please check close tags - the left docker is not working correctly"): the
  // countdown's CSS rule #scCount hit the VIDEO DOCKER's scene-count input (id scCount) and pinned it over the
  // left dock as a full-height overlay. No id this script creates or styles may exist anywhere else in the page.
  {
    const SRC = read("static", "screencap.js");
    const mine = new Set([...SRC.matchAll(/#([A-Za-z][\w-]*)/g)].map((m) => m[1])
      .concat([...SRC.matchAll(/\.id = "([^"]+)"/g)].map((m) => m[1]))
      .concat([...SRC.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1])));
    const pages = [read("static", "index.html")].concat(fs.readdirSync(path.join(ROOT, "ext"))
      .filter((d) => fs.existsSync(path.join(ROOT, "ext", d, "dock.html"))).map((d) => read("ext", d, "dock.html")));
    const theirs = new Set(pages.flatMap((h) => [...h.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])));
    const clash = [...mine].filter((id) => theirs.has(id) && !["ldock", "menubar", "openSettings"].includes(id));   // 2.382.1: + the menu bar it adds its buttons to
    check("2.368.1: no id the screen capture creates or styles collides with the page's or a dock's own ids (the #scCount overlay)",
      clash.length === 0 && mine.has("capCount") && !mine.has("scCount"), clash);
  }

  // ---- 5. the wiring
  const IDX = read("routes", "index.js"), H = read("static", "index.html");
  const MAIN = read("electron", "main.js"), PRE = read("electron", "preload.js");
  check("routes/index.js mounts ./screenCap (never server.js)",
    /require\("\.\/screenCap"\)\.mount\(app\)/.test(IDX) && !/screenCap|screencap/.test(read("misc/server.js")));
  check("static/index.html loads /static/screencap.js", H.includes('<script src="/static/screencap.js"></script>'));
  check("electron/main.js registers ./capture with session, desktopCapturer, screen and the window",
    /require\("\.\/capture"\)\.register\(\{ ipcMain, session, desktopCapturer, screen, getWin: \(\) => win \}\)/.test(MAIN)
    && /session, desktopCapturer, screen \} = require\("electron"\)/.test(MAIN));
  check("electron/preload.js exposes capture.setup / capture.shot only (contextIsolation kept)",
    /capture: \{\s*setup: \(p\) => ipcRenderer\.invoke\("capture:setup", p\),\s*shot: \(p\) => ipcRenderer\.invoke\("capture:shot", p\),/.test(PRE));
} catch (e) { fail++; console.log("FAIL: threw " + (e && e.stack || e)); }
finally {
  for (const n of made) if (n && !before.has(n)) { try { fs.unlinkSync(path.join(OUT, n)); } catch {} }
  try { fs.rmSync(T, { recursive: true, force: true }); } catch {}
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
})();
