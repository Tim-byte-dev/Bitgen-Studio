#!/usr/bin/env node
/* bitGen Studio — 2.360.0: THE SFX DOCK.
 * Run: node scripts/test-sfx.js
 * Tim: "can you add a sfx docker, let user add video files, including .mov or audio files, extract audio from
 * video files allow user to select section from the waveform and trim - give option to keep selected or delete
 * selected".
 *   1. lib/sfx LIVE with ffmpeg: a .mov's audio extracted, an mp3 converted, a silent video / a text file refused
 *      in words; Keep selected / Delete selected (sample lengths), the edge cases, as a new file, ↶ Undo, → Sound
 *      assets, delete; the ffmpeg arguments (5 ms fades, one join);
 *   2. routes/sfx.js LIVE on an express app (add multipart, list, peaks, file, trim, undo, to-sound, delete);
 *   3. jsdom: the dock (list, drag = select into Start / End, the two cut buttons, as a new file, Undo, 📂 Add);
 *   4. the wiring (the page's dock marker, its height var, the layout registries, routes/index.js).
 * 2.361.0 (Tim: "allow user to choose duration and drag selection box of specified duration. add saved file to
 * the sound tab in gallery docker"): the Duration box (drop, slide, resize, typed edges), sliding any selection,
 * every cut copied to the gallery (output/sfx_<name>, the Audio tab) and the tab shown. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { execFileSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 900) : "")); }
}
const ROOT = path.join(__dirname, "..");
process.chdir(ROOT);
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const core = require(path.join(ROOT, "lib", "core"));
const SFX = require(path.join(ROOT, "lib", "sfx"));
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 0.02);

const T = fs.mkdtempSync(path.join(os.tmpdir(), "sfx360_"));
const P = "e2e_sfx360";
const ff = (...a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...a], { stdio: "ignore" });
const made = [];        // files this test put into the CURRENT project (routes + to-sound)

(async () => {
try {
  ff("-f", "lavfi", "-i", "testsrc=size=160x90:rate=24", "-f", "lavfi", "-i", "sine=frequency=500:duration=4",
     "-t", "4", "-c:v", "libx264", "-c:a", "aac", "-shortest", path.join(T, "door slam.mov"));
  ff("-f", "lavfi", "-i", "testsrc=size=160x90:rate=24", "-t", "1", path.join(T, "silent.mp4"));
  ff("-f", "lavfi", "-i", "sine=frequency=300:duration=3", path.join(T, "whoosh.mp3"));
  fs.writeFileSync(path.join(T, "notes.txt"), "x");

  // ---- 1. the library
  let a = SFX.add(path.join(T, "door slam.mov"), "door slam.mov", P);
  check("a .mov: its audio track is extracted to a 48 kHz stereo WAV in projects/<p>/sfx",
    a.name === "door slam.wav" && a.from === "video" && near(a.seconds, 4, 0.05)
    && fs.existsSync(path.join(SFX.dir(P), "door slam.wav")), a);
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=sample_rate,channels,codec_name",
    "-of", "json", path.join(SFX.dir(P), "door slam.wav")], { encoding: "utf8" })).streams[0];
  check("...pcm_s16le, 48000 Hz, 2 channels", probe.codec_name === "pcm_s16le" && probe.sample_rate === "48000" && probe.channels === 2, probe);
  let m = SFX.add(path.join(T, "whoosh.mp3"), "whoosh.mp3", P);
  check("an mp3 is converted (from: audio)", m.name === "whoosh.wav" && m.from === "audio" && near(m.seconds, 3, 0.06), m);
  check("a video with no audio track is refused in words", /silent\.mp4 has no audio track/.test(SFX.add(path.join(T, "silent.mp4"), "silent.mp4", P).error || ""));
  check("a file that is not audio or video is refused in words", /notes\.txt: not an audio or video file/.test(SFX.add(path.join(T, "notes.txt"), "notes.txt", P).error || ""));
  const again = SFX.add(path.join(T, "door slam.mov"), "door slam.mov", P);
  check("adding the same name again never overwrites (door slam (2).wav)", again.name === "door slam (2).wav", again);

  let r = SFX.trim("door slam.wav", 1, 2.5, "delete", false, P);
  check("Delete selected 1-2.5 s of 4 s: 2.5 s left, in place, undo kept",
    r.name === "door slam.wav" && near(r.seconds, 2.5) && r.undo === true && /deleted 1-2\.5 s/.test(r.note), r);
  const gal = SFX.galleryFile("door slam.wav", P);
  check("2.361.0: the cut is copied into the gallery (output/sfx_door slam.wav - the Audio tab), said in the note",
    fs.existsSync(gal) && path.basename(gal) === "sfx_door slam.wav" && near(SFX.seconds(gal), 2.5) && r.gallery === "sfx_door slam.wav" && /in the gallery's Audio tab as sfx_door slam\.wav/.test(r.note), r);
  r = SFX.undo("door slam.wav", P);
  check("↶ Undo brings the 4 s version back - and the gallery's copy with it",
    near(r.seconds, 4) && /back as it was/.test(r.note) && r.gallery === "sfx_door slam.wav" && near(SFX.seconds(gal), 4), r);
  r = SFX.trim("door slam.wav", 0.5, 1.75, "keep", false, P);
  check("Keep selected 0.5-1.75 s: 1.25 s left", near(r.seconds, 1.25) && /kept 0\.5-1\.75 s/.test(r.note), r);
  SFX.undo("door slam.wav", P);
  r = SFX.trim("door slam.wav", 2, 1, "keep", true, P);
  check("...as a new file (door slam_keep.wav), the original untouched; a backwards selection is fine",
    r.name === "door slam_keep.wav" && near(r.seconds, 1) && r.undo === false && near(SFX.seconds(SFX.fileOf("door slam.wav", P)), 4), r);
  r = SFX.trim("door slam.wav", 0, 1, "delete", true, P);
  check("Delete selected from the very start: one side kept (door slam_cut.wav, 3 s)", r.name === "door slam_cut.wav" && near(r.seconds, 3), r);
  r = SFX.trim("door slam.wav", 3, 99, "delete", true, P);
  check("Delete selected to the end (the end clamped): 3 s kept", near(r.seconds, 3), r);
  check("refused in words: deleting everything, keeping everything, a too-short selection, a missing name, a bad mode",
    /deletes the whole sound/.test(SFX.trim("door slam.wav", 0, 4.2, "delete", false, P).error)
    && /the whole sound - nothing to trim/.test(SFX.trim("door slam.wav", 0, 4.2, "keep", false, P).error)
    && /too short/.test(SFX.trim("door slam.wav", 1, 1.005, "keep", false, P).error)
    && SFX.trim("nope.wav", 0, 1, "keep", false, P).status === 404 && SFX.trim("door slam.wav", 0, 1, "x", false, P).status === 400);
  check("Undo with nothing to undo says so", SFX.undo("whoosh.wav", P).status === 404);
  check("a sound never cut has no gallery copy (adding is not saving)", !fs.existsSync(SFX.galleryFile("whoosh.wav", P)));
  const args = SFX.trimArgs("in.wav", "out.wav", 1, 2, "delete", 4).join(" ");
  check("the cut's ffmpeg arguments: two atrims with 5 ms fades at the join, concatenated, 48 kHz PCM",
    /atrim=start=0\.000000:end=1\.000000,asetpts=PTS-STARTPTS,afade=t=out:st=0\.995000:d=0\.005000\[p0\]/.test(args)
    && /atrim=start=2\.000000:end=4\.000000,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0\.005000\[p1\]/.test(args)
    && args.includes("[p0][p1]concat=n=2:v=0:a=1[out]") && args.includes("-c:a pcm_s16le"), args);
  const L = SFX.list(P).map((x) => x.name + (x.undo ? "*" : ""));
  check("list: the WAVs only (no undo copies, no temp files)", L.includes("door slam.wav") && L.includes("whoosh.wav")
    && !L.some((n) => n.startsWith(".")), L);
  check("safeName never leaves the folder", SFX.safeName("../../x.wav") === "x.wav" && SFX.safeName(".undo") === "" && SFX.fileOf("../sfx", P) === null);
  r = SFX.remove("door slam (2).wav", P);
  check("delete removes the file", !SFX.fileOf("door slam (2).wav", P) && /deleted/.test(r.note));

  // ---- 2. the routes LIVE (the current project)
  const express = require("express");
  const app = express(); app.use(express.json());
  require(path.join(ROOT, "routes", "sfx")).mount(app);
  const srv = app.listen(0, "127.0.0.1"); await new Promise((ok) => srv.once("listening", ok));
  const port = srv.address().port;
  const req = (method, p, body, headers) => new Promise((ok) => {
    const data = body == null ? null : (Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body)));
    const rq = http.request({ host: "127.0.0.1", port, path: p, method,
      headers: { ...(data && !headers ? { "Content-Type": "application/json" } : {}), ...(headers || {}), ...(data ? { "Content-Length": data.length } : {}) } },
      (rs) => { const ch = []; rs.on("data", (c) => ch.push(c)); rs.on("end", () => { const b = Buffer.concat(ch); let j = null; try { j = JSON.parse(b.toString()); } catch {} ok({ status: rs.statusCode, j, len: b.length }); }); });
    if (data) rq.write(data); rq.end();
  });
  const B = "----sfx360";
  const part = (fname, buf) => Buffer.concat([Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="files"; filename="${fname}"\r\nContent-Type: application/octet-stream\r\n\r\n`), buf, Buffer.from("\r\n")]);
  const body = Buffer.concat([part("e2e_sfx360 clap.mov", fs.readFileSync(path.join(T, "door slam.mov"))),
                              part("e2e_sfx360 mute.mp4", fs.readFileSync(path.join(T, "silent.mp4"))), Buffer.from(`--${B}--\r\n`)]);
  let h = await req("POST", "/api/sfx/add", body, { "Content-Type": `multipart/form-data; boundary=${B}` });
  made.push("e2e_sfx360 clap.wav");
  check("POST /api/sfx/add: the .mov's audio is added, the silent video is refused - both said",
    h.status === 200 && h.j.added.length === 1 && h.j.added[0].name === "e2e_sfx360 clap.wav"
    && /audio extracted from e2e_sfx360 clap\.mov/.test(h.j.note) && /e2e_sfx360 mute\.mp4 has no audio track/.test(h.j.note), h);
  h = await req("GET", "/api/sfx");
  check("GET /api/sfx lists it", h.status === 200 && h.j.files.some((f) => f.name === "e2e_sfx360 clap.wav"), h);
  h = await req("GET", "/api/sfx/peaks/" + encodeURIComponent("e2e_sfx360 clap.wav"));
  check("GET /api/sfx/peaks: the app's waveform (0..255) and its length", h.status === 200 && h.j.peaks.length > 100 && near(h.j.seconds, 4, 0.06), h.j && h.j.seconds);
  h = await req("GET", "/api/sfx/file/" + encodeURIComponent("e2e_sfx360 clap.wav"));
  check("GET /api/sfx/file: the WAV for the player", h.status === 200 && h.len > 100000);
  h = await req("POST", "/api/sfx/trim", { name: "e2e_sfx360 clap.wav", start: 1, end: 3, mode: "delete", as_new: false });
  made.push("GAL:sfx_e2e_sfx360 clap.wav");
  check("POST /api/sfx/trim delete: 2 s left, the gallery copy named", h.status === 200 && near(h.j.seconds, 2) && h.j.undo
    && h.j.gallery === "sfx_e2e_sfx360 clap.wav" && fs.existsSync(path.join(core.pDir("output"), "sfx_e2e_sfx360 clap.wav")), h);
  h = await req("POST", "/api/sfx/undo", { name: "e2e_sfx360 clap.wav" });
  check("POST /api/sfx/undo", h.status === 200 && near(h.j.seconds, 4), h);
  h = await req("POST", "/api/sfx/trim", { name: "e2e_sfx360 clap.wav", start: 0, end: 9, mode: "keep" });
  check("a refused cut answers 400 in words", h.status === 400 && /whole sound/.test(h.j.error), h);
  h = await req("POST", "/api/sfx/to-sound", { name: "e2e_sfx360 clap.wav" });
  if (h.j && h.j.name) made.push("SOUND:" + h.j.name);
  check("POST /api/sfx/to-sound: a copy in the project's Sound assets", h.status === 200 && fs.existsSync(path.join(core.pDir("sound"), h.j.name)), h);
  h = await req("POST", "/api/sfx/delete", { name: "e2e_sfx360 clap.wav" });
  check("POST /api/sfx/delete", h.status === 200 && !SFX.fileOf("e2e_sfx360 clap.wav"), h);
  srv.close();

  // ---- 3. jsdom: the dock
  let JSDOM;
  try { ({ JSDOM } = require("jsdom")); } catch { console.log("(jsdom missing - the dock checks are skipped)"); }
  if (JSDOM) {
    const dom = new JSDOM("<body><div class=\"gtabs\"><button data-gtab=\"video\" class=\"active\">Video</button>"
      + "<button data-gtab=\"audio\">Audio</button></div>" + read("ext", "sfxdock", "dock.html") + "</body>",
      { url: "http://127.0.0.1:8311/", runScripts: "outside-only", pretendToBeVisual: true });
    const w = dom.window;
    w.HTMLCanvasElement.prototype.getContext = () => null;
    const posts = [];
    let files = [{ name: "boom.wav", size: 1, mtime: 2, undo: false }, { name: "tick.wav", size: 1, mtime: 1, undo: true }];
    const json = (o, st) => Promise.resolve({ ok: !st, status: st || 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(o))) });
    w.fetch = (u, o) => {
      u = String(u);
      if (o && o.method === "POST") posts.push({ u, body: typeof o.body === "string" ? JSON.parse(o.body) : "form" });
      if (u === "/api/sfx") return json({ files });
      if (u.startsWith("/api/sfx/peaks/")) return json({ peaks: Array.from({ length: 1200 }, (_, i) => i % 255), seconds: 10 });
      if (u === "/api/sfx/trim") return json({ ok: true, name: "boom.wav", seconds: 6, gallery: "sfx_boom.wav", note: "deleted 2-6 s of boom.wav -> boom.wav (6 s)" });
      if (u === "/api/sfx/add") { files = [{ name: "clip.wav", size: 1, mtime: 3 }].concat(files);
        return json({ ok: true, added: [{ name: "clip.wav" }], note: "clip.wav (audio extracted from clip.mov)" }); }
      return json({ ok: true, note: "done" });
    };
    let audioTab = 0;
    w.document.querySelector('[data-gtab="audio"]').onclick = function () { audioTab++; this.classList.add("active"); };
    w.eval(read("ext", "sfxdock", "sfxdock.js"));
    const $ = (id) => w.document.getElementById(id);
    const wait = (ms) => new Promise((ok) => setTimeout(ok, ms || 40));
    await wait(80);
    const out = {};
    out.opts = [...$("sfxSel").options].map((o) => o.value);
    out.undo0 = $("sfxUndo").disabled;
    out.cuts0 = $("sfxKeep").disabled && $("sfxCut").disabled;
    const cv = $("sfxWave");
    cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 64, right: 500, bottom: 64 });
    const pe = (type, x) => cv.dispatchEvent(new w.MouseEvent(type, { clientX: x, clientY: 30, bubbles: true }));
    pe("pointerdown", 100); pe("pointermove", 200); pe("pointermove", 300); pe("pointerup", 300);
    out.sel = [$("sfxStart").value, $("sfxEnd").value, $("sfxLen").textContent];
    out.cuts1 = !$("sfxKeep").disabled && !$("sfxCut").disabled;
    $("sfxEnd").value = "6"; $("sfxEnd").dispatchEvent(new w.Event("change"));
    out.typed = w.sfxDock.state().sel;
    $("sfxCut").click(); await wait(80);
    out.cut = posts.filter((p) => p.u === "/api/sfx/trim").pop();
    out.msg = $("sfxMsg").textContent;
    $("sfxAsNew").checked = true;
    pe("pointerdown", 50); pe("pointermove", 150); pe("pointerup", 150);
    $("sfxKeep").click(); await wait(80);
    out.keep = posts.filter((p) => p.u === "/api/sfx/trim").pop();
    out.audioTab = audioTab;
    // 2.361.0: the Duration box (10 s over 500 px = 50 px a second)
    $("sfxDur").value = "2"; $("sfxDur").dispatchEvent(new w.Event("change"));
    out.resized = Object.assign({}, w.sfxDock.state().sel);           // the cut reloaded: no selection -> at the view's left: 0-2
    pe("pointerdown", 400); out.dropped = Object.assign({}, w.sfxDock.state().sel);   // 8 s: a 2 s box 7-9
    pe("pointermove", 450); pe("pointerup", 450);
    out.slidEnd = Object.assign({}, w.sfxDock.state().sel);            // 9 s -> clamped at the end: 8-10
    pe("pointerdown", 425); pe("pointermove", 225); pe("pointerup", 225);
    out.slid = Object.assign({}, w.sfxDock.state().sel);              // grabbed inside, 4 s left: 4-6
    $("sfxStart").value = "0.5"; $("sfxStart").dispatchEvent(new w.Event("change"));
    out.typedStart = Object.assign({}, w.sfxDock.state().sel);        // 0.5-2.5
    $("sfxEnd").value = "9"; $("sfxEnd").dispatchEvent(new w.Event("change"));
    out.typedEnd = Object.assign({}, w.sfxDock.state().sel);          // 7-9
    $("sfxDur").value = "3"; $("sfxDur").dispatchEvent(new w.Event("change"));
    out.resize3 = Object.assign({}, w.sfxDock.state().sel);           // a new Duration keeps the start: 7-10
    $("sfxDur").value = ""; $("sfxDur").dispatchEvent(new w.Event("change"));
    pe("pointerdown", 50); pe("pointermove", 100); pe("pointerup", 100);
    out.free = Object.assign({}, w.sfxDock.state().sel);              // free again: 1-2
    pe("pointerdown", 75); pe("pointermove", 175); pe("pointerup", 175);
    out.freeSlide = Object.assign({}, w.sfxDock.state().sel);         // a free selection slides too: 3-4
    $("sfxSel").value = "tick.wav"; $("sfxSel").dispatchEvent(new w.Event("change")); await wait(60);
    out.undo1 = !$("sfxUndo").disabled;
    $("sfxUndo").click(); await wait(60);
    out.undoPost = posts.filter((p) => p.u === "/api/sfx/undo").pop();
    $("sfxToSound").click(); await wait(60);
    out.toSound = posts.filter((p) => p.u === "/api/sfx/to-sound").pop();
    const inp = $("sfxFile");
    Object.defineProperty(inp, "files", { value: [new w.File(["x"], "clip.mov", { type: "video/quicktime" })], configurable: true });
    inp.dispatchEvent(new w.Event("change")); await wait(120);
    out.added = posts.some((p) => p.u === "/api/sfx/add" && p.body === "form");
    out.afterAdd = [$("sfxSel").value, $("sfxMsg").textContent];
    check("jsdom: the dock lists the sound effects; Undo only where a cut can be undone; the cut buttons wait for a selection",
      JSON.stringify(out.opts) === '["boom.wav","tick.wav"]' && out.undo0 === true && out.cuts0 === true, out);
    check("jsdom: dragging across the waveform selects (10 s over 500 px: 2-6 s) into Start / End",
      out.sel[0] === "2" && out.sel[1] === "6" && /selected 4 s of 10 s/.test(out.sel[2]) && out.cuts1, out.sel);
    check("jsdom: 🗑 Delete selected posts {name, start, end, mode: delete, as_new: false} and says what it did",
      out.cut && out.cut.body.name === "boom.wav" && out.cut.body.start === 2 && out.cut.body.end === 6 && out.cut.body.mode === "delete"
      && out.cut.body.as_new === false && /deleted 2-6 s/.test(out.msg), out);
    check("jsdom: ✂ Keep selected with 'as a new file' posts mode keep, as_new true",
      out.keep && out.keep.body.mode === "keep" && out.keep.body.as_new === true && out.keep.body.start === 1 && out.keep.body.end === 3, out.keep);
    const J2 = (o) => JSON.stringify(o && { a: Math.round(o.a * 100) / 100, b: Math.round(o.b * 100) / 100 });
    check("2.361.0 jsdom: a saved cut shows the gallery's Audio tab (where its sfx_ copy is)", out.audioTab === 1, out.audioTab);
    check("2.361.0 jsdom: a Duration makes a box of that length (no selection: at the left of the view); a press drops it centred on the pointer",
      J2(out.resized) === J2({ a: 0, b: 2 }) && J2(out.dropped) === J2({ a: 7, b: 9 }), { r: out.resized, d: out.dropped });
    check("2.361.0 jsdom: dragging slides the box, its length kept, stopped at the end; grabbing it inside slides it too",
      J2(out.slidEnd) === J2({ a: 8, b: 10 }) && J2(out.slid) === J2({ a: 4, b: 6 }), { e: out.slidEnd, s: out.slid });
    check("2.361.0 jsdom: with a Duration, typing Start or End moves the whole box",
      J2(out.typedStart) === J2({ a: 0.5, b: 2.5 }) && J2(out.typedEnd) === J2({ a: 7, b: 9 }), { s: out.typedStart, e: out.typedEnd });
    check("2.361.0 jsdom: a new Duration resizes the box from its start", J2(out.resize3) === J2({ a: 7, b: 10 }), out.resize3);
    check("2.361.0 jsdom: a blank Duration is a free drag-select again, and a free selection slides when grabbed",
      J2(out.free) === J2({ a: 1, b: 2 }) && J2(out.freeSlide) === J2({ a: 3, b: 4 }), { f: out.free, s: out.freeSlide });
    check("jsdom: ↶ Undo and → 🔊 post for the picked file", out.undo1 && out.undoPost && out.undoPost.body.name === "tick.wav"
      && out.toSound && out.toSound.body.name === "tick.wav", out);
    check("jsdom: 📂 Add uploads the picked file (multipart) and opens what it added", out.added && out.afterAdd[0] === "clip.wav"
      && /audio extracted from clip\.mov/.test(out.afterAdd[1]), out.afterAdd);
  }

  // ---- 4. the wiring
  const IX = read("static", "index.html"), RI = read("routes", "index.js"), DH = read("ext", "sfxdock", "dock.html");
  const man = JSON.parse(read("ext", "sfxdock", "ext.json"));
  check("ext/sfxdock is an extension (SFX, after Stems) with its own marker, height var and resize handle",
    man.id === "sfxdock" && man.order === 66 && man.scripts.includes("sfxdock.js")
    && IX.indexOf("<!-- ext:dock sfxdock -->") > IX.indexOf("<!-- ext:dock stemsdock -->")
    && IX.includes("#sfxdock { height: var(--sfh); }") && IX.includes('stemsdock: "sth", sfxdock: "sfh",')
    && DH.includes('data-hresize="sfh"') && DH.includes('data-collapse="sfxdock"'));
  check("2.361.0: the Duration field sits before Start (blank = free)", DH.indexOf('id="sfxDur"') > 0 && DH.indexOf('id="sfxDur"') < DH.indexOf('id="sfxStart"')
    && DH.includes('placeholder="free"'));
  check("the 📂 picker takes .mov and the other video / audio types - explicit, no wildcards",
    /accept="[^"]*\.mov[^"]*\.wav[^"]*"/.test(DH) && !DH.includes("/*"));
  check("the layout remembers it (lib/dockers + lib/uiLayout); routes/sfx mounted from routes/index.js (never server.js)",
    read("lib", "dockers.js").includes('"stemsdock", "sfxdock",') && read("lib", "uiLayout.js").includes("sfxdock: 220")
    && RI.includes('require("./sfx").mount(app);') && !read("misc/server.js").includes("sfx"));
} catch (e) {
  fail++; console.log("FAIL: the test crashed :: " + (e && e.stack || e));
} finally {
  try { fs.rmSync(core.projDir(P), { recursive: true, force: true }); } catch {}
  for (const n of made) {
    try {
      if (n.startsWith("SOUND:")) fs.unlinkSync(path.join(core.pDir("sound"), n.slice(6)));
      else if (n.startsWith("GAL:")) fs.unlinkSync(path.join(core.pDir("output"), n.slice(4)));
      else fs.unlinkSync(path.join(SFX.dir(), n));
    } catch {}
    try { if (!/^(SOUND|GAL):/.test(n)) fs.unlinkSync(path.join(SFX.dir(), ".undo", n)); } catch {}
  }
  fs.rmSync(T, { recursive: true, force: true });
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
})();
