#!/usr/bin/env node
/* bitGen Studio — THE SEGMENT MAP (2.289.0). Run: node scripts/test-segmap.js
 *
 * Tim (verbatim): "when we are making a music video, put a load audio
 * button in the video docker menubar. load a waveform of the song, auto
 * segment the song the same as the stem docker does it (do not actually
 * cut the files) just save the segment start time and duration to the
 * .seg file, create the blank scenes on save, populate the start and
 * duration inputs for each scene."
 *
 * Four layers, each EXECUTED rather than grepped where it can be:
 *   1. the core model (static/segmap.js) - the stems dock's rules, run;
 *   2. lib/segBoard.stage LIVE against a real song + a real board (the
 *      default project's .prj and scene mirror snapshotted and restored);
 *   3. the video docker's strip in jsdom - 🎵 upload, waveform + map, a
 *      red-line drag, a label lock, 💾 posting the map, the confirm;
 *   4. the wiring pins (routes, manifest, shell order, writer count). */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const SM = require("../static/segmap.js");
const near = (a, b) => Math.abs(a - b) < 1e-6;

// ---- 1. the model ---------------------------------------------------------
{
  const S = SM.from({ song: "x.wav", total: 40, durations: [15, 15, 10], manual: [] });
  check("from(): a server map becomes {total, durations, boundaries (cumulative, excluding 0 and total), manual padded}",
    S.total === 40 && JSON.stringify(S.boundaries) === "[15,30]"
    && JSON.stringify(S.manual) === "[false,false,false]", S);
  check("from(): no duration, no map (null) - never an invented one",
    SM.from({ total: 0, durations: [] }) === null && SM.from(null) === null);
  check("windows(): start + duration per segment, the numbers the cards get",
    JSON.stringify(SM.windows(S)) === JSON.stringify([
      { n: 1, start: 0, dur: 15 }, { n: 2, start: 15, dur: 15 }, { n: 3, start: 30, dur: 10 }]),
    SM.windows(S));
  check("segAt()/lineAt(): which segment a second falls in; which line is under the pointer",
    SM.segAt(S, 0) === 0 && SM.segAt(S, 15.01) === 1 && SM.segAt(S, 39.9) === 2
    && SM.lineAt(S, 29.8, 0.5) === 1 && SM.lineAt(S, 22, 0.5) === -1);

  const L = SM.from({ total: 40, durations: [15, 15, 10] });
  SM.moveLine(L, 0, 20);
  check("moveLine(): a red line moves and the durations follow",
    JSON.stringify(L.durations) === "[20,10,10]", L.durations);
  SM.moveLine(L, 0, 39);
  check("moveLine(): clamped 1 s short of its neighbour (the 1 s floor)",
    near(L.boundaries[0], 29) && near(L.durations[1], 1), L);
  SM.moveLine(L, 0, 0);
  check("moveLine(): and 1 s from the song's start", near(L.boundaries[0], 1), L.boundaries);

  const K = SM.from({ total: 40, durations: [15, 15, 10], manual: [false, true, false] });
  const r = SM.moveLine(K, 0, 20);
  check("moveLine(): a cut bordering a LOCKED segment refuses, in words, and moves nothing",
    r.ok === false && /borders a locked segment/.test(r.note) && near(K.boundaries[0], 15), r);

  const M = SM.from({ total: 40, durations: [15, 15, 10] });
  const m1 = SM.setManual(M, 0, 18);
  check("setManual(): the typed value LOCKS the segment and the next open segment absorbs it",
    m1.ok && M.manual[0] === true && near(M.durations[0], 18)
    && near(M.durations[1], 15) && near(M.durations[2], 7), M);
  const M2 = SM.from({ total: 40, durations: [15, 15, 10] });
  const m2 = SM.setManual(M2, 0, 60);
  check("setManual(): more than the open segments can give is CLAMPED and said (1 s floors)",
    m2.ok && /clamped to 38s/.test(m2.note) && near(M2.durations[0], 38)
    && near(M2.durations[1], 1) && near(M2.durations[2], 1), [m2, M2.durations]);
  const M5 = SM.from({ total: 40, durations: [15, 15, 10], manual: [false, false, true] });
  SM.setManual(M5, 0, 20);
  check("setManual(): a LOCKED later segment is never robbed - the open one between pays (the 2.286 copy robbed the last segment whatever its lock)",
    near(M5.durations[0], 20) && near(M5.durations[1], 10) && near(M5.durations[2], 10), M5.durations);
  const M6 = SM.from({ total: 40, durations: [15, 15, 10], manual: [false, true, true] });
  const m6 = SM.setManual(M6, 0, 20);
  check("setManual(): every later segment locked refuses in words and changes nothing",
    m6.ok === false && /every segment after it is locked/.test(m6.note) && near(M6.durations[0], 15), m6);
  const M3 = SM.from({ total: 40, durations: [15, 15, 10] });
  SM.setManual(M3, 2, 12);
  check("setManual(): the LAST segment leans on the nearest open one before it",
    near(M3.durations[2], 12) && near(M3.durations[1], 13) && near(M3.durations[0], 15)
    && M3.manual[2] === true, M3.durations);
  const M4 = SM.from({ total: 40, durations: [15, 15, 10], manual: [true, true, false] });
  const m4 = SM.setManual(M4, 2, 12);
  check("setManual(): with every earlier segment locked the last one refuses in words",
    m4.ok === false && /every earlier segment is locked/.test(m4.note), m4);

  const B = SM.from({ total: 40, durations: [10, 10, 10, 10], manual: [false, true, false, false] });
  const b1 = SM.moveBody(B, 1, 3);
  check("moveBody(): a locked segment's body moves WHOLE - both cuts together, duration kept",
    b1.ok && near(B.boundaries[0], 13) && near(B.boundaries[1], 23)
    && near(B.durations[1], 10), B.boundaries);
  SM.moveBody(B, 1, 50);
  check("moveBody(): an open neighbour compresses to 1 s and no further",
    near(B.durations[2], 1) && near(B.durations[1], 10), B.durations);
  const B2 = SM.from({ total: 40, durations: [10, 10, 10, 10], manual: [true, false, true, false] });
  const b2 = SM.moveBody(B2, 0, 3);
  check("moveBody(): the first/last segments refuse (they sit against the song's edges)",
    b2.ok === false && /first and last segments/.test(b2.note), b2);
  const B3 = SM.from({ total: 40, durations: [10, 10, 10, 10], manual: [false, true, true, false] });
  SM.moveBody(B3, 1, 5);
  check("moveBody(): a LOCKED neighbour is a wall",
    near(B3.durations[2], 10) && near(B3.boundaries[1], 20), B3.boundaries);

  const V = SM.View();
  V.zoom(0.5);
  check("View(): zoom x2 about the centre, pan inside the song, reset to the whole song",
    near(V.t0, 0.25) && near(V.t1, 0.75)
    && (V.pan(1), near(V.t1, 1) && near(V.t0, 0.5))
    && (V.reset(), V.t0 === 0 && V.t1 === 1 && !V.zoomed()), V);
}

// ---- 2. lib/segBoard.stage LIVE ----------------------------------------------
{
  const probe = `
const fs = require("fs"), path = require("path"), cp = require("child_process");
const core = require("./lib/core");
const sc = require("./lib/scenes"); const st = require("./lib/stems");
const sb = require("./lib/segBoard");
const P = core.getProject();
const prj = core.prjPath(P), scDir = path.join(core.projDir(P), "scenes");
const snap = fs.existsSync(prj) ? fs.readFileSync(prj) : null;
const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "seg289-"));
if (fs.existsSync(scDir)) cp.execFileSync("cp", ["-r", scDir, path.join(tmp, "scenes")]);
const snd = core.pDir("sound"); fs.mkdirSync(snd, { recursive: true });
const A = path.join(snd, "e2e_seg289a.wav"), B = path.join(snd, "e2e_seg289b.wav");
const out = {};
try {
  cp.execFileSync("ffmpeg", ["-y","-f","lavfi","-i","sine=frequency=440:duration=20", A], { stdio: "ignore" });
  cp.execFileSync("ffmpeg", ["-y","-f","lavfi","-i","sine=frequency=220:duration=12", B], { stdio: "ignore" });
  sc.save(sc.blank());
  // (a) a NEW song: blank scenes with windows
  st.saveSegments("e2e_seg289a.wav", [8, 12], [false, true]);
  const a = sb.stage("e2e_seg289a.wav");
  let bd = sc.load();
  out.a = { fresh: a.fresh, n: bd.list.length, audio: bd.audio, seg: bd.seg_song,
    win: bd.list.map((r) => [r.audio_start, r.audio_dur]),
    blank: bd.list.every((r) => /blank - awaiting the writer/.test(r.prompt.join(" "))),
    segText: fs.readFileSync(path.join(snd, "e2e_seg289a.seg"), "utf8") };
  // the writer fills scene 1 (a plan rewrite by id, as /api/screenplay/apply does)
  const plan = JSON.parse(JSON.stringify(bd.plan));
  plan.shots[0].prompt = ["[Shot 1] @someone sings on a rooftop at dusk."];
  sc.save(sc.fromPlan(plan, bd));
  // (b) the SAME song re-saved with a moved line: the written scene is KEPT
  st.saveSegments("e2e_seg289a.wav", [10, 10], [false, false]);
  const b = sb.stage("e2e_seg289a.wav");
  bd = sc.load();
  out.b = { fresh: b.fresh, n: bd.list.length,
    kept: bd.list[0].prompt.join(" ").includes("rooftop at dusk"),
    win: bd.list.map((r) => [r.audio_start, r.audio_dur]) };
  // (c) three segments: one blank scene is ADDED, the written one stays
  st.saveSegments("e2e_seg289a.wav", [6, 7, 7], [false, false, false]);
  sb.stage("e2e_seg289a.wav");
  bd = sc.load();
  out.c = { n: bd.list.length, kept: bd.list[0].prompt.join(" ").includes("rooftop"),
    third: /blank - awaiting the writer/.test(bd.list[2].prompt.join(" ")),
    win: bd.list.map((r) => [r.audio_start, r.audio_dur]) };
  // (d) one segment: trailing BLANKS drop; the written scene is scene 1
  st.saveSegments("e2e_seg289a.wav", [20], [false]);
  sb.stage("e2e_seg289a.wav");
  bd = sc.load();
  out.d = { n: bd.list.length, win: [bd.list[0].audio_start, bd.list[0].audio_dur] };
  // (e) a DIFFERENT song: a fresh blank board, the written scene said as replaced
  const e = sb.stage("e2e_seg289b.wav");
  bd = sc.load();
  out.e = { fresh: e.fresh, replaced: e.replaced, n: bd.list.length, audio: bd.audio,
    grid: bd.list.map((r) => [r.audio_start, r.audio_dur]),
    blank: bd.list.every((r) => /blank - awaiting the writer/.test(r.prompt.join(" "))) };
  // (f) a song with no duration refuses in words
  try { sb.stage("e2e_seg289_nothing.wav"); out.f = "no refusal"; }
  catch (err) { out.f = err.status + " " + err.message; }
} finally {
  for (const f of [A, B, path.join(snd, "e2e_seg289a.seg"), path.join(snd, "e2e_seg289b.seg")])
    try { fs.unlinkSync(f); } catch {}
  if (snap) fs.writeFileSync(prj, snap); else try { fs.unlinkSync(prj); } catch {}
  fs.rmSync(scDir, { recursive: true, force: true });
  if (fs.existsSync(path.join(tmp, "scenes"))) cp.execFileSync("cp", ["-r", path.join(tmp, "scenes"), scDir]);
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log("@@SB " + JSON.stringify(out));
`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe],
      { cwd: ROOT, encoding: "utf8", timeout: 120000 });
    const line = o.split("\n").find((l) => l.startsWith("@@SB "));
    d = line ? JSON.parse(line.slice(5)) : null;
  } catch (e) { d = { error: String(e.message || e).slice(0, 400) }; }
  const J = (x) => JSON.stringify(x);
  check("2.289.0 LIVE: a NEW song stages one BLANK scene per segment, each carrying its start/duration window; the song is the board's audio and its staged map's song",
    d && d.a && d.a.fresh === true && d.a.n === 2 && d.a.blank
    && J(d.a.win) === "[[0,8],[8,12]]" && d.a.audio === "e2e_seg289a.wav"
    && d.a.seg === "e2e_seg289a.wav", d);
  check("2.289.0 LIVE: the .seg says each segment's START and DURATION (\"segment 2: 8s to 20s (12 seconds) [manual]\") - nothing is cut",
    d && d.a && d.a.segText.includes("segment 1: 0s to 8s (8 seconds)")
    && d.a.segText.includes("segment 2: 8s to 20s (12 seconds) [manual]"), d && d.a);
  check("2.289.0 LIVE: re-saving the SAME song keeps the written scene and rewrites only the windows (fromPlan's carry-by-id cannot leave a stale window)",
    d && d.b && d.b.fresh === false && d.b.kept && d.b.n === 2
    && J(d.b.win) === "[[0,10],[10,10]]", d && d.b);
  check("2.289.0 LIVE: more segments ADD blank scenes after the written ones",
    d && d.c && d.c.n === 3 && d.c.kept && d.c.third
    && J(d.c.win) === "[[0,6],[6,7],[13,7]]", d && d.c);
  check("2.289.0 LIVE: fewer segments DROP the trailing blank placeholders",
    d && d.d && d.d.n === 1 && J(d.d.win) === "[0,20]", d && d.d);
  check("2.289.0 LIVE: a DIFFERENT song stages a fresh blank board on the default 15 s grid (12 s song = one 12 s window) and says what it replaced",
    d && d.e && d.e.fresh === true && d.e.replaced === 1 && d.e.n === 1 && d.e.blank
    && J(d.e.grid) === "[[0,12]]" && d.e.audio === "e2e_seg289b.wav", d && d.e);
  check("2.289.0 LIVE: a song with no readable duration is refused in words (400), never an invented map",
    d && typeof d.f === "string" && /^400 the song has no segment map/.test(d.f), d && d.f);
}

// ---- 3. the video docker's strip, in jsdom -------------------------------------
{
  const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const html = fs.readFileSync("ext/videodock/dock.html", "utf8");
const dom = new JSDOM("<body>" + html + "</body>", { url: "http://x/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
w.HTMLCanvasElement.prototype.getContext = () => null;
w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
w.HTMLMediaElement.prototype.pause = function () {};
const posts = [], hits = [];
let scenesAnswer = { list: [], seg_song: null };
let confirmAnswer = true, confirms = 0;
w.appConfirm = (t) => { confirms++; w.__lastConfirm = t; return Promise.resolve(confirmAnswer); };
const json = (x) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(x) });
w.fetch = (u, o) => {
  u = String(u); hits.push(u);
  if (o && o.method === "POST") posts.push({ u, body: o.body });
  if (u === "/api/stems/upload") return json({ ok: true, name: "My Song.wav", kind: "sound" });
  if (u.startsWith("/api/waveform")) return json({ peaks: Array.from({ length: 200 }, (_, i) => i % 255) });
  if (u.startsWith("/api/stems/segments")) return json({ ok: true, song: "My Song.wav", total: 40,
    durations: [15, 15, 10], manual: [false, false, false], boundaries: [15, 30], file: null });
  if (u === "/api/scenes") return json(scenesAnswer);
  if (u === "/api/scenes/audio") return json({ ok: true, audio: "My Song.wav" });
  if (u === "/api/scenes/from-segments") return json({ ok: true, seg: "My_Song.seg", note: "2 blank scene(s) on the board" });
  return json({});
};
w.eval(fs.readFileSync("static/segmap.js", "utf8"));
w.eval(fs.readFileSync("ext/videodock/audioseg.js", "utf8"));
const $ = (id) => w.document.getElementById(id);
const changed = [];
w.document.addEventListener("vd:scenes-changed", () => changed.push(1));
const out = {};
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 30));
(async () => {
  out.btnInBar = !!$("vdLoadAudio") && $("vdLoadAudio").closest("#mvBar") !== null;
  out.hidden0 = $("vdWave").style.display === "none";
  $("vdLoadAudio").click();                       // opens the picker (no throw)
  const inp = $("vdAudioFile");
  const f = new w.File(["RIFF"], "My Song.wav", { type: "audio/wav" });
  Object.defineProperty(inp, "files", { value: [f], configurable: true });
  inp.dispatchEvent(new w.Event("change"));
  await tick(80);
  out.uploaded = posts.some((p) => p.u === "/api/stems/upload");
  out.shown = $("vdWave").style.display !== "none";
  out.name = $("vdWaveName").textContent;
  const ed = w.vdSongStrip.editor();
  out.segs = ed && ed.segs() && ed.segs().durations;
  out.peaks = !!(ed && ed.peaks && ed.peaks.length === 200);
  out.msg0 = $("vdWaveMsg").textContent;
  const boardPost = posts.find((p) => p.u === "/api/scenes/audio");
  out.boardSong = boardPost && JSON.parse(boardPost.body).file;
  out.option = $("vdAudio").value;
  out.changed0 = changed.length;
  // a red-line drag: the canvas is 400 px wide, the 40 s song fills it
  const cv = $("vdWaveCv");
  cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 56, right: 400, bottom: 56 });
  const pe = (type, x, y) => cv.dispatchEvent(new w.MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
  pe("pointerdown", 150, 40); pe("pointermove", 175, 40); pe("pointermove", 200, 40); pe("pointerup", 200, 40);
  out.afterDrag = ed.segs().durations.slice();
  out.dirtyMsg = $("vdWaveMsg").textContent;
  // a click in the label strip over segment 2 opens the box; Enter locks it
  pe("pointerdown", 250, 5); pe("pointerup", 250, 5);
  const box = w.document.querySelector("input.segmap-input");
  out.box = !!box;
  if (box) { box.value = "8"; box.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter" })); }
  out.afterLock = ed.segs().durations.slice();
  out.locked = ed.segs().manual.slice();
  // 💾 on a board that is ALREADY this song's: no question, the map is posted
  scenesAnswer = { list: [{ n: 1, prompt: ["[Shot 1] a written scene"] }], seg_song: "My Song.wav" };
  const c0 = changed.length;
  $("vdSegSave").click();
  await tick(80);
  const save = posts.filter((p) => p.u === "/api/scenes/from-segments").pop();
  out.saveBody = save && JSON.parse(save.body);
  out.confirms0 = confirms;
  out.savedMsg = $("vdWaveMsg").textContent;
  out.changedOnSave = changed.length > c0;
  // 💾 over WRITTEN scenes from another song asks; Cancel posts nothing
  scenesAnswer = { list: [{ n: 1, prompt: ["[Shot 1] a written scene"] },
                          { n: 2, prompt: ["[Shot 2] (blank - awaiting the writer: x)"] }],
                   seg_song: "Other.wav" };
  confirmAnswer = false;
  const nSaves = posts.filter((p) => p.u === "/api/scenes/from-segments").length;
  $("vdSegSave").click();
  await tick(80);
  out.asked = confirms === 1 && /1 written scene/.test(w.__lastConfirm || "");
  out.cancelPosted = posts.filter((p) => p.u === "/api/scenes/from-segments").length !== nSaves;
  out.cancelMsg = $("vdWaveMsg").textContent;
  // the strip follows the board's song; "" hides it
  w.document.dispatchEvent(new w.CustomEvent("vd:board-song", { detail: "My Song.wav" }));
  const segHits = hits.filter((u) => u.startsWith("/api/stems/segments")).length;
  await tick(30);
  out.sameNoReload = hits.filter((u) => u.startsWith("/api/stems/segments")).length === segHits;
  w.document.dispatchEvent(new w.CustomEvent("vd:board-song", { detail: "" }));
  out.hiddenOnClear = $("vdWave").style.display === "none";
  w.document.dispatchEvent(new w.CustomEvent("vd:board-song", { detail: "Next.mp3" }));
  await tick(60);
  out.follows = w.vdSongStrip.song() === "Next.mp3" && $("vdWave").style.display !== "none";
  $("vdWaveClose").click();
  out.closed = $("vdWave").style.display === "none";
  console.log("@@VS " + JSON.stringify(out));
})();`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe],
      { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    const line = o.split("\n").find((l) => l.startsWith("@@VS "));
    d = line ? JSON.parse(line.slice(5)) : { raw: o.slice(-400) };
  } catch (e) { d = { error: String(e.message || e).slice(0, 600) }; }
  const J = (x) => JSON.stringify(x);
  check("2.289.0 LIVE jsdom: 🎵 sits in the video docker MENUBAR and the song strip starts hidden",
    d && d.btnInBar === true && d.hidden0 === true, d);
  check("2.289.0 LIVE jsdom: a picked song uploads (/api/stems/upload), the strip opens with its waveform and the AUTO segment map (15 s grid: 15/15/10), said in words",
    d && d.uploaded && d.shown && d.name === "My Song.wav" && J(d.segs) === "[15,15,10]"
    && d.peaks && /3 segment\(s\) auto-cut on the 15-second grid/.test(d.msg0), d);
  check("2.289.0 LIVE jsdom: ...and the loaded song becomes the board's song (POST /api/scenes/audio), shown in the Audio picker, the board told to repaint",
    d && d.boardSong === "My Song.wav" && d.option === "My Song.wav" && d.changed0 >= 1, d);
  check("2.289.0 LIVE jsdom: dragging a red line moves the cut (15 s -> 20 s) and says the map is unsaved",
    d && J(d.afterDrag) === "[20,10,10]" && /unsaved/.test(d.dirtyMsg), d);
  check("2.289.0 LIVE jsdom: clicking a duration label opens the number box; Enter LOCKS the segment and the next open one absorbs the change",
    d && d.box && J(d.afterLock) === "[20,8,12]" && J(d.locked) === "[false,true,false]", d);
  check("2.289.0 LIVE jsdom: 💾 posts the map (song, durations, manual) to /api/scenes/from-segments, reports the saved .seg and tells the board to repaint",
    d && d.saveBody && d.saveBody.song === "My Song.wav"
    && J(d.saveBody.durations) === "[20,8,12]" && J(d.saveBody.manual) === "[false,true,false]"
    && d.confirms0 === 0 && /saved My_Song\.seg/.test(d.savedMsg) && d.changedOnSave, d);
  check("2.289.0 LIVE jsdom: 💾 over WRITTEN scenes from another song ASKS first (appConfirm); Cancel posts nothing and says so",
    d && d.asked && d.cancelPosted === false && /nothing saved/.test(d.cancelMsg), d);
  check("2.289.0 LIVE jsdom: the strip follows the board's song - the same song is a no-op (unsaved edits survive a repaint), none hides it, another loads it; ✕ hides",
    d && d.sameNoReload && d.hiddenOnClear && d.follows && d.closed, d);
}

// ---- 4. the wiring -------------------------------------------------------------
{
  const RC = read("routes", "characters.js");
  const RI = read("routes", "index.js");
  const VD = read("ext", "videodock", "characters.js");
  const DH = read("ext", "videodock", "dock.html");
  const EJ = JSON.parse(read("ext", "videodock", "ext.json"));
  const IX = read("static", "index.html");
  check("2.289.0: POST /api/scenes/from-segments saves the .seg (stems.saveSegments) then stages through lib/segBoard; send-to-video stages through the SAME function",
    RC.includes('app.post("/api/scenes/from-segments"')
    && RC.includes("seg = stems.saveSegments(song, b.durations, b.manual).file;")
    && RC.includes('const r = require("../lib/segBoard").stage(song, b.project,')   // 2.358.0: + the strip's gap
    && RI.includes('require("../lib/segBoard").stage(b.song, b.project)'));
  check("2.289.0: the videodock manifest loads audioseg.js after characters.js; the shell loads core segmap.js BEFORE the ext scripts",
    EJ.scripts.indexOf("audioseg.js") === EJ.scripts.indexOf("characters.js") + 1 && EJ.scripts.indexOf("characters.js") >= 0   // 2.312.0: + rendersettings.js after; 2.337.0: qedit.js before
    && IX.indexOf('<script src="/static/segmap.js"></script>') > 0
    && IX.indexOf('<script src="/static/segmap.js"></script>') < IX.indexOf("<!-- ext:scripts -->"));
  check("2.289.0: the file picker's accept list never carries a slash-star (the comment-stripper lesson)",
    /id="vdAudioFile"[^>]*accept="[^"]*"/.test(DH) && !/accept="[^"]*\/\*/.test(DH));
  check("2.289.0: the board paint says the board's song (vd:board-song) and a stage repaints the board (vd:scenes-changed)",
    VD.includes('document.dispatchEvent(new CustomEvent("vd:board-song",')
    && VD.includes('document.addEventListener("vd:scenes-changed", function () { scRefresh(); });'));
  check("2.289.0: the board sanitizer and fromPlan CARRY seg_song (the sanitizer-whitelist lesson)",
    read("lib", "scenes.js").includes("if (s.seg_song) b.seg_song = String(s.seg_song);")
    && read("lib", "scenes.js").includes("seg_song: safe(prev).seg_song,"));
  check("2.289.0: the writer counts from the BOARD's song map (the staged song, then the board song, then the last split)",
    RC.includes("const segSong = b.song || stSeg.seg_song || stSeg.audio"));
}

// ---- 5. 2.310.0: whole seconds in the video dock ----------------------------
// Tim: "when user drags the duration marker over the waveform, round up to
// the nearest second, no decimal places, in video docker"
{
  const S = SM.from({ song: "x.wav", total: 41.37, durations: [15, 15, 11.37], manual: [] });
  SM.moveLine(S, 0, 17.62, 1);
  check("2.310.0: a dragged cut (step 1) lands on the nearest whole second (17.62 -> 18), the durations follow",
    S.boundaries[0] === 18 && S.durations[0] === 18 && S.durations[1] === 12, S);
  SM.moveLine(S, 0, 17.4, 1);
  check("...17.4 -> 17 (nearest, both ways)", S.boundaries[0] === 17 && S.durations[0] === 17, S.boundaries);
  SM.moveLine(S, 1, 99, 1);
  check("...clamped against the song's end with the 1 s floor, still whole (41.37 - 1 = 40.37 -> 40)",
    S.boundaries[1] === 40 && Number.isInteger(S.durations[1]), S.boundaries);
  const U = SM.from({ song: "x.wav", total: 40, durations: [10.5, 9.5, 20], manual: [] });
  SM.moveLine(U, 1, 11.2, 1);
  check("...a neighbour off the grid (10.5) keeps its 1 s floor: the cut stops at 12, never 11",
    U.boundaries[1] === 12 && U.durations[1] >= 1, U.boundaries);
  const T = SM.from({ song: "x.wav", total: 40, durations: [15, 15, 10], manual: [] });
  SM.moveLine(T, 0, 17.62);
  check("...without a step (the stems dock) a cut still lands anywhere (17.62)", near(T.boundaries[0], 17.62), T.boundaries);
  const B = SM.from({ song: "x.wav", total: 40, durations: [10, 10, 10, 10], manual: [false, true, false, false] });
  const mb = SM.moveBody(B, 1, 2.4, 1);
  check("...a locked segment's body drags on whole seconds too (10 -> 12, its 10 s kept)",
    mb.ok && B.boundaries[0] === 12 && B.boundaries[1] === 22 && B.durations[1] === 10, B.boundaries);
  // the labels: no decimals with whole
  const texts = [];
  const ctx = { save() {}, restore() {}, fillRect() {}, fillText(t) { texts.push(t); }, set fillStyle(v) {}, set font(v) {},
                set textAlign(v) {}, set textBaseline(v) {} };
  const V = SM.View();
  SM.drawOverlay(ctx, SM.from({ total: 41.37, durations: [15, 15, 11.37], manual: [] }), V, 400, 40, 1, "#f00", true);
  const t2 = []; const ctx2 = { ...ctx, fillText(t) { t2.push(t); } };
  SM.drawOverlay(ctx2, SM.from({ total: 41.37, durations: [15, 15, 11.37], manual: [] }), V, 400, 40, 1, "#f00");
  check("...the duration labels drop the decimals (11.37 -> 11s); the stems dock keeps its tenth (11.4s)",
    JSON.stringify(texts) === '["15s","15s","11s"]' && t2[2] === "11.4s", [texts, t2]);
  const AS = read("ext", "videodock", "audioseg.js"), SJ = read("static", "segmap.js");
  check("...the video dock's editor asks for whole seconds (snap: 1); the drag, the body drag, the labels and the typed box all honour it",
    /window\.SegMap\.attach\(el\("vdWaveCv"\), \{[\s\S]{0,400}snap: 1,/.test(AS)
    && SJ.includes("var m = moveLine(ed.S, drag.line, secAt(f), snap);")
    && SJ.includes("var b = moveBody(ed.S, drag.body, t - drag.t0, snap);")
    && SJ.includes('cssVar("--bad", "#e33"), snap >= 1);')
    && SJ.includes('box.type = "number"; box.min = "1"; box.step = whole ? "1" : "0.1";')
    && SJ.includes("if (whole) v = Math.round(v);"));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
