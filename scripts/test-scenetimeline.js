#!/usr/bin/env node
/* bitGen Studio — RENDERED SCENES ONTO THE TIMELINE DOCK (2.291.0).
 * Run: node scripts/test-scenetimeline.js
 *
 * Tim (verbatim): "remove the ovpm timeline, we will use our timeline
 * docker, after each scene is generated add it to a new video layer in our
 * timeline docker at the start position set in the video docker scene".
 *   1. lib/sceneTimeline - the window rule, the start fallbacks, the flag
 *      a fresh take carries and its acknowledgement (LIVE against a real
 *      song + .seg for the map fallback);
 *   2. the board sanitizer and fromPlan carry the flag with its take;
 *   3. the video docker in jsdom hands a FLAGGED take (and only that) to
 *      the core tlPlaceScene, then acknowledges exactly that take;
 *   4. the wiring pins.
 * The core tlPlaceScene itself is executed in the full page by
 * scripts/test-imagedom.js; the LIVE server path rides the e2e. */
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
const STL = require("../lib/sceneTimeline");
const SC = require("../lib/scenes");

// ---- 1. the library ---------------------------------------------------------
{
  const board = (list, audio) => SC.safe({ list, audio });
  const B = board([
    { n: 1, id: "c1", prompt: ["a"], length: 240, audio_start: 12.5, audio_dur: 7 },
    { n: 2, id: "c2", prompt: ["b"], length: 120 },
    { n: 3, id: "c3", prompt: ["c"], length: 175 }]);
  const w1 = STL.windowFor(B, 1);
  check("the scene's OWN start/duration inputs are its window",
    w1.start === 12.5 && w1.dur === 7 && w1.from === "scene", w1);
  const s3 = STL.startFor(B, 3);
  // 2.309.0: END TO END - scene 1 keeps its typed start (12.5), then each
  // earlier scene counts its length: scene 1's window (7 s), scene 2's
  // frames (120 / 24 = 5 s)
  check("2.309.0: a scene starts where the one before it ENDS - the first scene's typed start, then each scene's own length (window, else frames at 24 fps)",
    s3.start === 24.5 && s3.from === "sequence"
    && STL.startFor(B, 1).start === 12.5 && STL.startFor(B, 1).from === "scene", [s3, STL.startFor(B, 1)]);
  check("...and the first scene of such a board starts at 0",
    STL.startFor(board([{ n: 1, id: "c1", prompt: ["a"], length: 120 }]), 1).start === 0);

  // the board song's .seg map fallback, LIVE
  const probe = `
const fs = require("fs"), path = require("path"), cp = require("child_process");
const core = require("./lib/core"), st = require("./lib/stems"), sc = require("./lib/scenes");
const tl = require("./lib/sceneTimeline");
const snd = core.pDir("sound"); fs.mkdirSync(snd, { recursive: true });
const A = path.join(snd, "e2e_tl291.wav");
let out = {};
try {
  cp.execFileSync("ffmpeg", ["-y","-f","lavfi","-i","sine=frequency=500:duration=30", A], { stdio: "ignore" });
  st.saveSegments("e2e_tl291.wav", [10, 12, 8], [false, false, false]);
  const B = sc.safe({ audio: "e2e_tl291.wav", list: [
    { n: 1, id: "c1", prompt: ["a"] }, { n: 2, id: "c2", prompt: ["b"] },
    { n: 3, id: "c3", prompt: ["c"], audio_start: 25 } ] });
  // 2.377.0: with a board song a take sits AT its song time (ui.tl_scene_song_sync, default on); off = 2.309.0
  core.getConfig().ui = { ...(core.getConfig().ui || {}), tl_scene_song_sync: false };
  out = { w2: tl.windowFor(B, 2), s2: tl.startFor(B, 2), s3: tl.startFor(B, 3), w3: tl.windowFor(B, 3) };
  core.getConfig().ui.tl_scene_song_sync = true;
  out.sync = { s2: tl.startFor(B, 2), s3: tl.startFor(B, 3), s1: tl.startFor(B, 1) };
} finally {
  for (const f of [A, path.join(snd, "e2e_tl291.seg")]) try { fs.unlinkSync(f); } catch {}
}
console.log("@@TL " + JSON.stringify(out));`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    d = JSON.parse(o.split("\n").find((l) => l.startsWith("@@TL ")).slice(5));
  } catch (e) { d = { error: String(e.message).slice(0, 300) }; }
  check("LIVE: with a board song the RENDER window is still the .seg slot (scene 2 = 10 s, 12 s long) and scene 2 lands at the end of scene 1 (10 s)",
    d && d.w2 && d.w2.start === 10 && d.w2.dur === 12 && d.w2.from === "seg"
    && d.s2.start === 10 && d.s2.from === "sequence", d);
  check("LIVE: 2.309.0 (song sync OFF) - on the TIMELINE a later scene follows the one before it (scene 3 at 10 + 12 = 22 s), whatever its song window (25 s) says",
    d && d.s3 && d.s3.start === 22 && d.s3.from === "sequence" && d.w3.start === 25 && d.w3.dur === 8, d);
  check("LIVE: 2.377.0 (song sync ON, the default) - every take sits AT its song time: scene 1 at 0, scene 2 at 10, scene 3 at its typed 25 s",
    d && d.sync && d.sync.s1.start === 0 && d.sync.s2.start === 10 && d.sync.s2.from === "song"
    && d.sync.s3.start === 25 && d.sync.s3.from === "song", d && d.sync);

  const R = SC.safe({ list: [{ n: 1, id: "c1", prompt: ["a"], length: 192,
    audio_start: 4, status: "rendered", output: "scene1_x.mp4" }] });
  STL.markRendered(R, 1, "no-such-project-e2e");
  const r = R.list[0];
  check("markRendered flags the fresh take with its start and a length (probed, else length/24)",
    r.tl_pending === true && r.tl_start === 4 && r.tl_from === "scene" && r.tl_dur === 8, r);
  const stale = STL.placed(R, 1, "an_older_take.mp4");
  check("placed() for a DIFFERENT take leaves the flag - a newer render stays pending",
    stale.changed === false && /newer take/.test(stale.error) && R.list[0].tl_pending === true, stale);
  const ok = STL.placed(R, 1, "scene1_x.mp4");
  check("placed() for THIS take clears the flag; a repeat changes nothing",
    ok.changed === true && R.list[0].tl_pending === undefined
    && STL.placed(R, 1, "scene1_x.mp4").changed === false);
  check("placed() for a scene that does not exist says so",
    STL.placed(R, 9, "x").error === "no such scene");
}

// ---- 1b. 2.309.0: END TO END by each take's REAL length (LIVE) ----------------
{
  const probe = `
const fs = require("fs"), path = require("path"), cp = require("child_process");
const core = require("./lib/core"), sc = require("./lib/scenes"), tl = require("./lib/sceneTimeline");
const P = "e2e_tl309";
const vid = path.join(core.projDir(P), "video"); fs.mkdirSync(vid, { recursive: true });
const mk = (n, d) => cp.execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i",
  "color=c=black:s=64x64:r=24:d=" + d, "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(vid, n)], { stdio: "ignore" });
let out = {};
try {
  mk("scene1.mp4", 3); mk("scene_2_2.mp4", 7.5);
  // planned lengths say 5 s each - the REAL takes are 3 s and 7.5 s
  const B = sc.safe({ list: [
    { n: 1, id: "c1", prompt: ["a"], length: 120, output: "scene1.mp4", status: "rendered" },
    { n: 2, id: "c2", prompt: ["b"], length: 120, output: "scene_2_2.mp4", status: "rendered" },
    { n: 3, id: "c3", prompt: ["c"], length: 120, output: "", status: "idle" },
    { n: 4, id: "c4", prompt: ["d"], length: 240 } ] });
  out = { s2: tl.startFor(B, 2, P), s3: tl.startFor(B, 3, P), s4: tl.startFor(B, 4, P) };
  const st = sc.safe({ list: B.list.map((r) => r.n === 3 ? { ...r, output: "scene3.mp4", status: "rendered" } : r) });
  mk("scene3.mp4", 2);
  tl.markRendered(st, 3, P);
  out.mark3 = { start: st.list[2].tl_start, dur: st.list[2].tl_dur };
} finally { fs.rmSync(core.projDir(P), { recursive: true, force: true }); }
console.log("@@T9 " + JSON.stringify(out));`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    d = JSON.parse(o.split("\n").find((l) => l.startsWith("@@T9 ")).slice(5));
  } catch (e) { d = { error: String(e.message).slice(0, 300) }; }
  const near = (a, b) => Math.abs(a - b) < 0.06;
  check("2.309.0 LIVE: each scene starts where the one before it ENDS, by the REAL take lengths (3 s, 7.5 s - not the planned 5 s each)",
    d && d.s2 && near(d.s2.start, 3) && near(d.s3.start, 10.5), d);
  check("...an unrendered scene in between counts its planned length (scene 4 = 10.5 + 5 = 15.5)",
    d && d.s4 && near(d.s4.start, 15.5), d);
  check("...and a fresh take is flagged at that start with its own probed length (scene 3 at 10.5, 2 s)",
    d && d.mark3 && near(d.mark3.start, 10.5) && near(d.mark3.dur, 2), d && d.mark3);
}

// ---- 2. the flag survives the sanitizer and a plan rewrite --------------------
{
  const s = SC.safe({ list: [{ n: 1, id: "c1", prompt: ["a"], output: "o.mp4", status: "rendered",
    tl_pending: true, tl_start: 3.5, tl_dur: 6, tl_from: "seg" }] });
  const r = s.list[0];
  check("scenes.safe() keeps tl_pending/tl_start/tl_dur/tl_from (the sanitizer-whitelist lesson)",
    r.tl_pending === true && r.tl_start === 3.5 && r.tl_dur === 6 && r.tl_from === "seg", r);
  const junk = SC.safe({ list: [{ n: 1, id: "c1", prompt: ["a"], tl_pending: "yes", tl_from: "nope", tl_start: "x" }] }).list[0];
  check("...and drops junk values", junk.tl_pending === undefined && junk.tl_from === undefined
    && junk.tl_start === undefined, junk);
  const m = SC.fromPlan({ shots: [{ id: "c1", prompt: ["a rewritten"] }] }, s).list[0];
  check("fromPlan carries the flag with the take it describes (a writer rewrite never re-places or forgets it)",
    m.tl_pending === true && m.tl_start === 3.5 && m.output === "o.mp4", m);
}

// ---- 3. the video docker hands flagged takes to the timeline -----------------
{
  const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM("<body>" + fs.readFileSync("ext/videodock/dock.html", "utf8") + "</body>",
  { url: "http://x/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
const placed = [], posts = [];
w.tlPlaceScene = (o) => { placed.push(o); return { name: o.label }; };
w.appConfirm = () => Promise.resolve(true);
const board = { chapters: [], pending: [], plan: { shots: [] }, list: [
  { n: 1, id: "c1", prompt: ["a"], status: "rendered", output: "scene1.mp4",
    tl_pending: true, tl_start: 12, tl_dur: 8, length: 192 },
  { n: 2, id: "c2", prompt: ["b"], status: "rendered", output: "scene2.mp4" },
  { n: 3, id: "c3", prompt: ["c"], status: "running", job: "j", output: "old3.mp4", tl_pending: true, tl_start: 30 },
  { n: 4, id: "c4", prompt: ["d"], status: "kept", output: "scene4.mp4", tl_pending: true, length: 120 } ] };
w.fetch = (u, o) => {
  u = String(u).split("?")[0];
  if (o && o.method === "POST") posts.push({ u, body: o.body });
  const body = u === "/api/scenes" ? board : { ok: true, characters: [], environments: [], refs: {} };
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
};
global.window = w; global.document = w.document; global.fetch = w.fetch;
global.FormData = w.FormData; global.CustomEvent = w.CustomEvent;
w.eval(fs.readFileSync("ext/videodock/characters.js", "utf8"));
const refresh = () => w.document.dispatchEvent(new w.CustomEvent("vd:scenes-changed"));
setTimeout(() => {
  refresh();
  setTimeout(() => {
    const first = placed.slice();
    refresh();
    setTimeout(() => {
      console.log("@@VD " + JSON.stringify({ first, all: placed,
        acks: posts.filter((p) => /\\/placed$/.test(p.u)) }));
      process.exit(0);        // the dock's own polls would keep node alive
    }, 150);
  }, 150);
}, 200);`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    const line = o.split("\n").find((l) => l.startsWith("@@VD "));
    d = line ? JSON.parse(line.slice(5)) : { raw: o.slice(-300) };
  } catch (e) { d = { error: String(e.message).slice(0, 400) }; }
  const J = (x) => JSON.stringify(x);
  const s1 = d && (d.first || []).find((p) => p.n === 1);
  check("jsdom: a FLAGGED rendered take goes to tlPlaceScene at its tl_start with its tl_dur, labelled for its scene",
    s1 && s1.name === "scene1.mp4" && s1.start === 12 && s1.dur === 8 && s1.label === "Scene 1", d);
  check("jsdom: a kept flagged take with no probed length falls back to length/24 and start 0",
    d && (d.first || []).some((p) => p.n === 4 && p.dur === 5 && p.start === 0), d && d.first);
  check("2.309.0 jsdom: each take names the PREVIOUS scene's take (placed right after it ends) - scene 1 has none, scene 4 follows scene 3's take",
    s1 && s1.after === "" && d && (d.first || []).some((p) => p.n === 4 && p.after === "old3.mp4"), d && d.first);
  check("2.309.0: the dock places in SCENE ORDER and only after the scene RIGHT before it (a gap keeps the server's end-to-end start)",
    read("ext", "videodock", "characters.js").includes("var ordered = (scState.list || []).slice().sort(function (a, b) { return a.n - b.n; });")
    && read("ext", "videodock", "characters.js").includes("var prev = i > 0 && ordered[i - 1].output ? ordered[i - 1] : null;"));
  check("jsdom: unflagged takes and a still-RUNNING scene are left alone",
    d && Array.isArray(d.all) && !d.all.some((p) => p.n === 2 || p.n === 3), d && d.all);
  check("jsdom: each placed take is acknowledged with ITS output (POST /api/scenes/n/placed)",
    d && J((d.acks || []).map((a) => [a.u, JSON.parse(a.body).output]).sort())
      === J([["/api/scenes/1/placed", "scene1.mp4"], ["/api/scenes/4/placed", "scene4.mp4"]]), d && d.acks);
  check("jsdom: a second board refresh before the flag clears places NOTHING twice",
    d && (d.all || []).length === 2, d && d.all);
}

// ---- 4. the wiring ----------------------------------------------------------------
{
  const RC = read("routes", "characters.js");
  const IX = read("static", "index.html");
  check("syncJobs flags every fresh take for the timeline; POST /api/scenes/:n/placed acknowledges it",
    RC.includes("if (src) st = sceneTimeline.markRendered(st, r.n, project);")
    && RC.includes('app.post("/api/scenes/:n/placed"')
    && RC.includes("const r = sceneTimeline.placed(st, req.params.n, b.output);"));
  check("the render queue reads the SAME window rule the placement does (one rule, lib/sceneTimeline.windowFor)",
    RC.includes("const w0 = sceneTimeline.windowFor(st, n);")
    && !RC.includes("let a0 = Number.isFinite(r.audio_start)"));
  check("the core tlPlaceScene always pushes a NEW video layer (never V1) and is on window for the video docker",
    IX.includes("function tlPlaceScene(o) {") && IX.includes("tl.vlayers.push(L);")
    && IX.includes("window.tlPlaceScene = tlPlaceScene;"));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
