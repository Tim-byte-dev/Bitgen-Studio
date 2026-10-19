#!/usr/bin/env node
/* bitGen Studio — INSERT A SCENE, CHOSEN FIRST / LAST FRAMES, RIPPLED TIMING
 * (2.297.0). Run: node scripts/test-sceneinsert.js
 *
 * Tim (verbatim): "add option for user to insert scene, if transition scene
 * is selected allow the user to select first and/or last frame from
 * previous clips or gallery or assets, show the reference or f/l images as
 * thumbnails below the scene, allow user to remove these images . adjust
 * the timing for all the scenes if the start time or duration changes for
 * any scene".
 *   1. lib/sceneTiming (ripple, materialize, framesFor);
 *   2. the board: fl slots through the sanitizer, cont_src follows its
 *      scene through an insert/delete renumbering;
 *   3. lib/sceneRefs slots LIVE (set / replace / clear, gallery + asset
 *      resolve, frame extraction);
 *   4. nativeAudio.plan honours the chosen frames;
 *   5. wiring pins + the dock in jsdom (slots under the scene per anchor,
 *      ✕, the picker's four tabs, insert buttons).
 * The LIVE routes + render ride the e2e. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const T = require("../lib/sceneTiming");
const SC = require("../lib/scenes");
const NA = require("../lib/nativeAudio");
const J = (x) => JSON.stringify(x);

// ---- 1. timing ------------------------------------------------------------------
{
  const mk = () => SC.safe({ list: [1, 2, 3, 4].map((n) => ({ n, id: "c" + n, prompt: ["x"],
    audio_start: (n - 1) * 5, audio_dur: 5 })) });
  let st = mk();
  st.list[1].audio_dur = 8;
  let r = T.ripple(st, 2, { dur: true });
  check("a longer DURATION pushes every later scene along (each keeps its own length)",
    J(st.list.map((x) => [x.audio_start, x.audio_dur])) === "[[0,5],[5,8],[13,5],[18,5]]"
    && J(r.changed) === "[3,4]", st.list.map((x) => [x.audio_start, x.audio_dur]));
  st = mk();
  st.list[2].audio_start = 12;
  r = T.ripple(st, 3, { start: true });
  check("a later START stretches the scene before it to meet it and moves the rest",
    J(st.list.map((x) => [x.audio_start, x.audio_dur])) === "[[0,5],[5,7],[12,5],[17,5]]"
    && J(r.changed) === "[2,4]", st.list.map((x) => [x.audio_start, x.audio_dur]));
  st = mk();
  st.list[2].audio_start = 2;
  T.ripple(st, 3, { start: true });
  check("...a start before the previous scene's own start is clamped just after it (no negative durations)",
    st.list[1].audio_dur > 0 && st.list[2].audio_start > st.list[1].audio_start,
    st.list.map((x) => [x.audio_start, x.audio_dur]));
  const bare = SC.safe({ list: [{ n: 1, id: "a", prompt: ["x"], length: 120 },
    { n: 2, id: "b", prompt: ["y"], length: 240 }, { n: 3, id: "c", prompt: ["z"] }] });
  T.materialize(bare);
  check("materialize: a board with no windows lines its scenes up end to end from their lengths (24 fps, 5 s when unknown)",
    J(bare.list.map((x) => [x.audio_start, x.audio_dur])) === "[[0,5],[5,10],[15,5]]",
    bare.list.map((x) => [x.audio_start, x.audio_dur]));
  check("framesFor: the clip follows its duration on the H3 grid, capped at the 362-frame single run",
    T.framesFor(8) === 192 && T.framesFor(5) === 124 && T.framesFor(40) === 362);
}

// ---- 2. the board -------------------------------------------------------------------
{
  const a = SC.safe({ list: [
    { n: 1, id: "c1", prompt: ["a"] },
    { n: 2, id: "c2", prompt: ["b"], cont_src: 1, cont_time: 2, anchor: "transition",
      fl_first: { file: "../fl_first.png", label: "scene 1 at 2s" }, fl_last: { junk: 1 } }] });
  check("scenes.safe keeps a real slot (basename) and drops junk",
    J(a.list[1].fl_first) === '{"file":"fl_first.png","label":"scene 1 at 2s"}' && a.list[1].fl_last === undefined);
  const ins = SC.fromPlan({ shots: [{ id: "c0", prompt: ["new"] }, { id: "c1", prompt: ["a"] },
    { id: "c2", prompt: ["b"] }] }, a);
  check("an insert BEFORE scene 1 renumbers - scene 3 (was 2) still continues from its source, now scene 2; its slots ride along",
    ins.list[2].id === "c2" && ins.list[2].cont_src === 2 && ins.list[2].fl_first.file === "fl_first.png");
  const del = SC.fromPlan({ shots: [{ id: "c2", prompt: ["b"] }] }, a);
  check("...and deleting its source scene drops the stale pick instead of pointing at the wrong scene",
    del.list[0].cont_src === undefined);
}

// ---- 3. sceneRefs slots, LIVE ----------------------------------------------------------
{
  const probe = `
const fs = require("fs"), path = require("path"), cp = require("child_process");
const core = require("./lib/core"), SR = require("./lib/sceneRefs");
const P = "e2e_fl297";
const out = {};
try {
  const proj = core.projDir(P);
  fs.mkdirSync(path.join(proj, "images"), { recursive: true });
  fs.mkdirSync(path.join(proj, "output"), { recursive: true });
  fs.writeFileSync(path.join(proj, "images", "pier.png"), "PNG");
  fs.writeFileSync(path.join(proj, "output", "sunset.jpg"), "JPG");
  const take = path.join(proj, "take.mp4");
  cp.execFileSync("ffmpeg", ["-y","-f","lavfi","-i","testsrc=duration=3:size=96x64:rate=24","-pix_fmt","yuv420p", take], { stdio: "ignore" });
  const row = { n: 2, id: "clip_02" };
  out.asset = SR.resolveImage(P, "asset", "pier.png");
  out.gallery = SR.resolveImage(P, "gallery", "sunset.jpg");
  out.nope = SR.resolveImage(P, "asset", "../../../etc/passwd");
  out.a = SR.setSlot(P, row, "last", out.asset, "asset: pier.png");
  const fr = SR.extractFrame(take, 1.0);
  out.frameOk = !!fr;
  out.f = SR.setSlot(P, row, "first", fr, "scene 1 at 1s");
  out.g = SR.setSlot(P, row, "first", out.gallery, "gallery: sunset.jpg");
  out.row = JSON.parse(JSON.stringify(row));
  out.files = fs.readdirSync(SR.dir(P, "clip_02")).sort();
  out.slot = SR.slotFor(P, row, "first");
  out.bad = SR.setSlot(P, row, "middle", out.asset, "x");
  out.cl = SR.clearSlot(P, row, "last");
  out.files2 = fs.readdirSync(SR.dir(P, "clip_02")).sort();
  out.after = SR.slotFor(P, row, "last");
} finally { fs.rmSync(core.projDir(P), { recursive: true, force: true }); }
console.log("@@FL " + JSON.stringify(out));`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    d = JSON.parse(o.split("\n").find((l) => l.startsWith("@@FL ")).slice(5));
  } catch (e) { d = { error: String(e.message).slice(0, 400) }; }
  check("LIVE: an image ASSET and a GALLERY picture resolve by name; a path escape does not",
    d && /images[\\/]pier\.png$/.test(d.asset || "") && /output[\\/]sunset\.jpg$/.test(d.gallery || "") && d.nope === null, d);
  check("LIVE: a frame of a take (at a time) fills the FIRST slot; a gallery picture REPLACES it (one file per slot, its own extension)",
    d && d.frameOk && d.f.ok && d.g.ok && d.row.fl_first.file === "fl_first.jpg"
    && d.row.fl_first.label === "gallery: sunset.jpg" && d.row.fl_last.file === "fl_last.png"
    && J(d.files) === '["fl_first.jpg","fl_last.png"]', d && [d.row, d.files]);
  check("LIVE: slotFor gives the absolute picture; an unknown slot is refused; clearing removes the file and the row entry",
    d && path.isAbsolute(d.slot.file) && d.bad.ok === false && d.cl === true
    && J(d.files2) === '["fl_first.jpg"]' && d.after === null, d);
}

// ---- 4. the plan honours the chosen frames -----------------------------------------------
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fl297-"));
  const f = (n) => { const p = path.join(tmp, n); fs.writeFileSync(p, "x"); return p; };
  const song = f("song.wav"), frame = f("cont.png"), loc = f("loc.png");
  const flFirst = { file: f("fl_first.png"), name: "fl_first.png", label: "gallery: sunset.jpg" };
  const flLast = { file: f("fl_last.png"), name: "fl_last.png", label: "asset: pier.png" };
  const base = { prompt: "@vera walks", song, audMeta: [], tmpDir: tmp, n: 2, take: null,
    imgMeta: [{ file: loc, name: "loc.png", tag: "pier", kind: "location", label: "Pier" }],
    frame: { file: frame, name: "c", label: "the end of clip_01" } };
  const tr = NA.plan({ ...base, anchor: "transition", flFirst, flLast });
  check("Trans: the chosen FIRST frame outranks the continuation frame and the chosen LAST frame outranks the location still",
    tr.mode === "fl2va" && J(tr.files) === J([flFirst.file, flLast.file])
    && tr.notes.some((x) => /from the chosen first frame \(gallery: sunset\.jpg\)/.test(x)), tr);
  const tr2 = NA.plan({ ...base, anchor: "transition", flLast, frame: null });
  check("Trans with only a chosen LAST frame and no frame to start from renders Ref, in words",
    tr2.mode === "ref2va" && tr2.missing.some((x) => /needs a frame/.test(x)), tr2.mode);
  const fi = NA.plan({ ...base, anchor: "first", flFirst, frame: null });
  check("First: a chosen first frame lets the scene start with NO rendered scene before it",
    fi.mode === "fl2va" && J(fi.files) === J([flFirst.file]), fi);
  const co = NA.plan({ ...base, anchor: "continue", flFirst });
  check("Cont: the chosen first frame is the opening picture",
    co.mode === "ref2va" && co.files[0] === flFirst.file, co.files);
  const rf = NA.plan({ ...base, anchor: "reference", flFirst, flLast });
  // 2.299.0 (Tim: "add a last frame option to each scene fl2va will use
  // last frame too if it is set"): Ref still ignores a FIRST frame (it
  // re-establishes) but carries a chosen LAST frame as its closing picture
  check("Ref ignores a first frame but carries the chosen LAST frame as its closing picture (2.299.0)",
    rf.mode === "ref2va" && !rf.files.includes(flFirst.file) && rf.files[0] === flLast.file
    && /The clip ends on <Picture 1>/.test(rf.prompt), [rf.files, rf.prompt.slice(0, 300)]);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
}

// ---- 5. wiring + the dock ---------------------------------------------------------------------
{
  const RC = read("routes", "characters.js");
  check("routes: insert, the four slot routes, the rippling audio route, frames from the song window",
    RC.includes('app.post("/api/scenes/insert"') && RC.includes('app.post("/api/scenes/:n/fl"')
    && RC.includes('app.post("/api/scenes/:n/fl/upload", upload.single("image")')
    && RC.includes('app.post("/api/scenes/:n/fl/delete"') && RC.includes('app.get("/api/scenes/:n/fl/:slot"')
    && RC.includes("rp = sceneTiming.ripple(st, r.n, { start: startCh, dur: durCh });")
    // 2.519.0: 2.503.0 caps by CEIL (the learned ceiling G.ceiling, raised for a Long-video style) instead of G.ceiling itself
    && RC.includes("const CEIL = h3Long.modelCeiling(grid, G.ceiling, longScene);") && RC.includes("frames = sceneTiming.framesFor(audioWin.dur, CEIL);")
    && RC.includes('flFirst: sceneRefs.slotFor(project, r, "first"),'));
  check("insert: windows made explicit BEFORE the numbers move, then the new scene pushes the rest",
    RC.indexOf("sceneTiming.materialize(st);") < RC.indexOf("let out = scenes.fromPlan(norm, st);", RC.indexOf('app.post("/api/scenes/insert"'))
    && RC.includes("const rp = sceneTiming.ripple(out, n, { dur: true });"));
  const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM("<body>" + fs.readFileSync("ext/videodock/dock.html", "utf8") + "</body>",
  { url: "http://x/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
const posts = [], gets = [];
const board = { chapters: [], pending: [], plan: { shots: [] }, style: "MMH3_NativeAudio_MV", list: [
  { n: 1, id: "c1", prompt: ["a"], status: "rendered", output: "scene1.mp4", length: 96 },
  { n: 2, id: "c2", prompt: ["b"], status: "idle", anchor: "transition",
    fl_first: { file: "fl_first.png", label: "scene 1 at 1s" } },
  { n: 3, id: "c3", prompt: ["c"], status: "idle", anchor: "first" },
  { n: 4, id: "c4", prompt: ["d"], status: "idle" } ] };
w.fetch = (u, o) => {
  u = String(u);
  if (o && o.method === "POST") posts.push({ u: u.split("?")[0], body: o.body });
  else gets.push(u.split("?")[0]);
  if (u.startsWith("/api/frames")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ key: "k",
    frames: [0, 1, 2].map((t, i) => ({ file: "f" + i + ".jpg", t })) }) });
  if (u.startsWith("/api/outputs")) return Promise.resolve({ ok: true, json: () => Promise.resolve([{ name: "sunset.jpg" }]) });
  if (u.startsWith("/api/passets")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ images: [{ name: "pier.png" }, { name: "notes.txt" }] }) });
  // 2.298.0: the picker's Project tab lists the SCANNED project (window.bgMedia)
  if (u.startsWith("/api/pmedia")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ images: [
    { name: "pier.png", rel: "images/pier.png", group: "Assets", asset: true },
    { name: "sunset.jpg", rel: "output/sunset.jpg", group: "Gallery", asset: false },
    { name: "notes.txt", rel: "images/notes.txt", group: "Assets", asset: true } ] }) });
  if (u.split("?")[0] === "/api/scenes/2/fl") return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, note: "set" }) });
  const body = u.split("?")[0] === "/api/scenes" ? board : { ok: true, characters: [], environments: [], refs: {} };
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
};
global.window = w; global.document = w.document; global.fetch = w.fetch;
global.FormData = w.FormData; global.CustomEvent = w.CustomEvent;
w.eval(fs.readFileSync("static/pmedia.js", "utf8"));
const src = fs.readFileSync("ext/videodock/characters.js", "utf8");
const ids = new Set(); src.replace(/el\\("([\\w-]+)"\\)/g, (m, id) => ids.add(id));
for (const id of ids) if (!w.document.getElementById(id)) {
  const e = w.document.createElement(/Sel$|Select$/.test(id) ? "select" : "input");
  e.id = id; e.style.display = "none"; w.document.body.appendChild(e);
}
w.eval(src);
const q = (s) => w.document.querySelector(s);
const qa = (s) => [...w.document.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await wait(200);
  w.document.dispatchEvent(new w.CustomEvent("vd:scenes-changed"));
  await wait(300);
  const out = {};
  out.slots = [1, 2, 3, 4].map((n) => qa('[data-scbelow="' + n + '"] [data-scfl]').map((e) => e.dataset.slot));
  const below2 = q('[data-scbelow="2"]');
  out.belowUnderRow = !!below2 && below2.parentElement === q('[data-sc="2"]')
    && below2.previousElementSibling === q('[data-sc="2"]').firstElementChild;
  out.thumb = q('[data-scfl="2"][data-slot="first"] img') && q('[data-scfl="2"][data-slot="first"] img').getAttribute("src");
  out.pictures = !!q('[data-scbelow="2"] [data-screfs="2"]');
  q('[data-scfldel="2"][data-slot="first"]').click();
  q('[data-scins="2"]').click();
  q('[data-scins="0"]').click();
  q('[data-scflpick="2"][data-slot="last"]').click();
  await wait(50);
  const pick = q("#scFlPick");
  out.pickTitle = pick && pick.getAttribute("aria-label");
  out.tabs = qa("#scFlPick [data-fltab]").map((b) => b.dataset.fltab);
  out.clipScenes = qa("#scFlPick [data-flscene]").map((b) => +b.dataset.flscene);
  q('#scFlPick [data-flscene="1"]').click();
  await wait(100);
  out.frames = qa("#scFlPick [data-flbody] img").length;
  qa("#scFlPick [data-flbody] img")[1].click();
  await wait(100);
  out.closed = !q("#scFlPick");
  q('[data-scflpick="2"][data-slot="last"]').click();
  await wait(30);
  q('#scFlPick [data-fltab="project"]').click();
  await wait(100);
  out.assets = qa("#scFlPick [data-flbody] img").map((i) => i.getAttribute("src"));
  qa("#scFlPick [data-flbody] img")[0].click();
  await wait(100);
  q('[data-scflpick="2"][data-slot="first"]').click();
  await wait(30);
  q('#scFlPick [data-fltab="project"]').click();
  await wait(100);
  out.gallery = qa("#scFlPick [data-flbody] img").map((i) => i.getAttribute("src"));
  qa("#scFlPick [data-flbody] img")[1].click();
  await wait(100);
  q('[data-scflpick="3"][data-slot="first"]').click();
  await wait(30);
  q('#scFlPick [data-flscene="1"]').click();
  await wait(100);
  q("#scFlPick [data-fllast]").click();
  await wait(100);
  out.posts = posts;
  console.log("@@IN " + JSON.stringify(out));
  process.exit(0);
})();`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    const line = o.split("\n").find((l) => l.startsWith("@@IN "));
    d = line ? JSON.parse(line.slice(5)) : { raw: o.slice(-600) };
  } catch (e) { d = { error: String(e.message).slice(0, 600) }; }
  const P = (u) => (d && d.posts || []).filter((p) => p.u === u).map((p) => JSON.parse(p.body));
  // 2.299.0: EVERY scene has a Last frame; Ref has no First
  check("jsdom: the frame slots sit UNDER the scene - First + Last on First/Cont/Trans, Last only on Ref (2.299.0)",
    d && J(d.slots) === '[["last"],["first","last"],["first","last"],["last"]]' && d.belowUnderRow, d && [d.slots, d.belowUnderRow]);
  check("jsdom: a filled slot shows its thumbnail (served per scene/slot) and the scene's pictures row sits in the same block",
    d && /^\/api\/scenes\/2\/fl\/first\?v=/.test(d.thumb || "") && d.pictures, d && d.thumb);
  check("jsdom: ✕ clears the slot",
    J(P("/api/scenes/2/fl/delete")) === '[{"slot":"first"}]', d && d.posts);
  check("jsdom: ⊕ inserts after the scene; scene 1 also offers ⊕↑ (before it)",
    J(P("/api/scenes/insert")) === '[{"after":2},{"after":0}]', d && d.posts);
  check("jsdom: 'choose…' opens the picker for that slot with Clips / Gallery / Assets / File; Clips lists the rendered scenes",
    d && d.pickTitle === "Choose scene 2's last frame" && J(d.tabs) === '["clips","project","file"]'
    && J(d.clipScenes) === "[1]", d && [d.pickTitle, d.tabs, d.clipScenes]);
  const fl2 = P("/api/scenes/2/fl"), fl3 = P("/api/scenes/3/fl");
  check("jsdom: a clip's frame is chosen at its time and the picker closes",
    d && d.frames === 3 && J(fl2[0]) === '{"kind":"frame","scene":1,"time":1,"slot":"last"}' && d.closed, d && [d.frames, fl2]);
  check("jsdom (2.298.0): the Project tab lists every scanned picture (an asset by name, anything else by project path), never a non-picture, and posts its project path",
    d && J(d.assets) === '["/passets/images/pier.png","/pmedia?rel=output%2Fsunset.jpg"]'
    && J(d.gallery) === J(d.assets)
    && J(fl2[1]) === '{"kind":"project","rel":"images/pier.png","slot":"last"}'
    && J(fl2[2]) === '{"kind":"project","rel":"output/sunset.jpg","slot":"first"}', d && [d.assets, fl2]);
  check("jsdom: 'use scene n's LAST frame' posts the frame with no time",
    J(fl3) === '[{"kind":"frame","scene":1,"slot":"first"}]', fl3);
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
