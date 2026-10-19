#!/usr/bin/env node
/* bitGen Studio — 2.358.0: BRIDGE SCENES BETWEEN THE SONG'S SEGMENTS.
 * Run: node scripts/test-scenebridge.js
 * Tim: "what if we add a transition checkbox to the song menubar before the save button, with a duration
 * input. if user adds a 0.5 second transition when resegment the song with a 0.5 sec (or x duration) after
 * each segment. this way i could render segment 1 and 3 as ref for example and segment 2 as fl2va, first frame
 * will be last frame of segment 1 and last frame will be first frame of segment 3. If user clicks transition
 * then we can do standard transitions like wipe, fade, dissolve etc from the last frame of seg 1 to first frame
 * of seg 3".
 *   1. lib/sceneBridge: the gap, the types, the windows (carved from each segment's end), the covering H3
 *      length, weave, contentN, setType;
 *   2. LIVE staging (lib/segBoard.stage {gap, gap_type}): bridges between the segments, the writer's plan
 *      woven back around them, a re-save with another type / no gap, Render selected queues bridges last;
 *   3. LIVE ffmpeg: bridge_worker.py draws a wipe from the last frame to the first frame with the song window;
 *      sceneBridge.fit retimes an AI bridge's 22 frames to its 0.5 s gap; the neighbours' rule;
 *   4. the wiring (queueScene, syncJobs, the routes, core's worker map) + jsdom: the strip's ☐ Transition and
 *      the bridge card's picker. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 900) : "")); }
}
const ROOT = path.join(__dirname, "..");
const J = (x) => JSON.stringify(x);
const B = require(path.join(ROOT, "lib", "sceneBridge"));

// ---- 1. the module
check("gap: 0 / junk = none; clamped to 0.1..4, rounded to 0.05 s",
  B.normGap(0) === 0 && B.normGap("x") === 0 && B.normGap(0.5) === 0.5 && B.normGap(0.03) === 0.1
  && B.normGap(9) === 4 && B.normGap(0.52) === 0.5);
const ty = B.types();
check("types: AI (fl2va) first, then the timeline's drawing transitions (fade, dissolve, wipes ...), never the cut",
  ty[0].id === "ai" && ["fade", "dissolve", "wipeleft", "slideup", "circleopen"].every((id) => ty.some((t) => t.id === id))
  && !ty.some((t) => t.id === "none") && B.normType("wipeleft") === "wipeleft" && B.normType("nope") === "ai", ty.map((t) => t.id));
let g = B.gapWindows([10, 10, 10], 0.5);
check("windows: a bridge after every segment but the last, carved from the segment's END (each segment still starts on its cut)",
  J(g.windows.map((w) => [w.start, w.dur, w.bridge ? "B" + w.after : "S" + w.k]))
  === J([[0, 9.5, "S1"], [9.5, 0.5, "B1"], [10, 9.5, "S2"], [19.5, 0.5, "B2"], [20, 10, "S3"]]) && !g.skipped.length, g);
g = B.gapWindows([10, 0.8, 10], 0.5);
check("a segment too short to give up the gap keeps its cut (said in skipped)",
  J(g.windows.map((w) => w.bridge ? "B" : "S")) === J(["S", "B", "S", "S"]) && J(g.skipped) === "[2]", g);
check("H3 length that COVERS the gap (17n+5 up): 0.5 s -> 22, 0.2 s -> 5, 1 s -> 39, capped",
  B.framesFor(0.5) === 22 && B.framesFor(0.2) === 5 && B.framesFor(1) === 39 && B.framesFor(30, 107) === 107);
const shots = [{ id: "clip_01" }, { id: "clip_02" }, { id: "clip_03" }];
const brs = [{ id: "bridge_01", prompt: ["b1"], bridge: { type: "fade", after: 1 } },
             { id: "bridge_02", prompt: ["b2"], bridge: { type: "ai", after: 2 } },
             { id: "bridge_09", prompt: ["b9"], bridge: { type: "ai", after: 3 } }];
check("weave: a plan without bridges gets them back after the scene each follows; one with no scene after it is left out",
  J(B.weave(shots, brs).map((s) => s.id)) === J(["clip_01", "bridge_01", "clip_02", "bridge_02", "clip_03"]));
const st = { list: [{ n: 1, id: "a" }, { n: 2, id: "b1", bridge: { type: "ai", after: 1 } }, { n: 3, id: "c" },
                    { n: 4, id: "b2", bridge: { type: "fade", after: 2 } }, { n: 5, id: "d" }] };
check("contentN: the writer's scene k is the board's k-th content scene; neighbours skip bridges",
  B.contentN(st, 1) === 1 && B.contentN(st, 2) === 3 && B.contentN(st, 3) === 5 && B.contentN(st, 4) === null
  && B.neighbours(st, st.list[1]).prev.n === 1 && B.neighbours(st, st.list[1]).next.n === 3);
check("the neighbours' rule: an unrendered side is refused in words (render scene 1 and 3 first)",
  /render scene 1 and 3 first/.test(B.sources(st, st.list[1]).error || ""), B.sources(st, st.list[1]));

// ---- 2. LIVE staging
{
  const probe = `
const fs = require("fs"), path = require("path"), cp = require("child_process");
const core = require("./lib/core"); const sc = require("./lib/scenes"); const stm = require("./lib/stems");
const sb = require("./lib/segBoard"); const B = require("./lib/sceneBridge");
const P = core.getProject(); const prj = core.prjPath(P);
const snap = fs.existsSync(prj) ? fs.readFileSync(prj) : null;
const snd = core.pDir("sound"); fs.mkdirSync(snd, { recursive: true });
const A = path.join(snd, "e2e_br358.wav");
const out = {};
const rows = () => sc.load().list.map((r) => [r.n, r.id, r.bridge ? r.bridge.type : "", r.audio_start, r.audio_dur]);
try {
  cp.execFileSync("ffmpeg", ["-y","-f","lavfi","-i","sine=frequency=440:duration=30", A], { stdio: "ignore" });
  sc.save(sc.blank());
  stm.saveSegments("e2e_br358.wav", [10, 10, 10], [false, false, false]);
  const a = sb.stage("e2e_br358.wav", undefined, { gap: 0.5, gap_type: "ai" });
  let bd = sc.load();
  out.a = { rows: rows(), gap: bd.seg_gap, note: a.note, bridges: a.bridges, anchors: bd.list.map((r) => r.anchor || ""),
            lens: bd.list.filter((r) => r.bridge).map((r) => r.length),
            seg: fs.readFileSync(path.join(snd, "e2e_br358.seg"), "utf8") };
  // the writer: a plan of the three segments only
  const plan = { prompt_prefix: [], shots: bd.plan.shots.filter((s) => !s.bridge).map((s) => ({ ...s })) };
  plan.shots[1].prompt = ["[Shot 2] @x sings on a rooftop"];
  sc.save(sc.fromPlan(plan, bd)); bd = sc.load();
  out.w = { rows: rows(), two: bd.list[2].prompt.join(" "), plan: bd.plan.shots.map((s) => s.id + (s.bridge ? "*" : "")) };
  // Render selected 1..5: the bridges queue after the scenes
  out.q = sc.queueRenders(bd, [2, 1, 4, 3, 5]).queued;
  // the card's picker
  const t = B.setType(bd, 2, "wipeleft"); sc.save(t.state); bd = sc.load();
  out.t = { type: bd.list[1].bridge.type, anchor: bd.list[1].anchor || "", prompt: bd.list[1].prompt.join(" "),
            plan: (bd.plan.shots.find((s) => s.id === bd.list[1].id) || {}).bridge };
  // same type re-save keeps a card's own type; a new strip type sets them all
  sb.stage("e2e_br358.wav", undefined, { gap: 0.5, gap_type: "ai" });
  out.keep = rows();
  sb.stage("e2e_br358.wav", undefined, { gap: 1, gap_type: "fade" });
  out.f = { rows: rows(), gap: sc.load().seg_gap, written: sc.load().list[2].prompt.join(" ") };
  // the stems dock's send (no opts) keeps the board's gap for the same song
  sb.stage("e2e_br358.wav");
  out.noopts = rows().filter((r) => r[2]).length;
  sb.stage("e2e_br358.wav", undefined, { gap: 0 });
  out.none = { rows: rows(), gap: sc.load().seg_gap || null, written: sc.load().list[1].prompt.join(" ") };
} finally {
  for (const f of [A, path.join(snd, "e2e_br358.seg")]) try { fs.unlinkSync(f); } catch {}
  if (snap) fs.writeFileSync(prj, snap); else try { fs.unlinkSync(prj); } catch {}
}
console.log("@@BR " + JSON.stringify(out));
`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 120000 });
    const line = o.split("\n").find((l) => l.startsWith("@@BR "));
    d = line ? JSON.parse(line.slice(5)) : null;
  } catch (e) { d = { error: String(e.message || e).slice(0, 600) }; }
  check("LIVE stage {gap 0.5, ai}: scene, bridge, scene, bridge, scene - each with its window; the board keeps the gap; the .seg keeps the user's cuts",
    d && d.a && J(d.a.rows) === J([[1, "clip_01", "", 0, 9.5], [2, "bridge_01", "ai", 9.5, 0.5], [3, "clip_02", "", 10, 9.5],
      [4, "bridge_02", "ai", 19.5, 0.5], [5, "clip_03", "", 20, 10]])
    && J(d.a.gap) === J({ dur: 0.5, type: "ai" }) && d.a.bridges === 2
    && d.a.seg.includes("segment 2: 10s to 20s (10 seconds)"), d && d.a);
  check("AI bridges are First (fl2va) at the covering length (22 frames); the note says what they do",
    d && d.a && J(d.a.anchors) === J(["", "first", "", "first", ""]) && J(d.a.lens) === "[22,22]"
    && /plus 2 bridge scene\(s\) of 0\.5s \(AI \(fl2va\)/.test(d.a.note) && /the scene before's last frame to the scene after's first frame/.test(d.a.note), d && d.a);
  check("the writer's plan (segments only) is woven back around the bridges - its scene 2 lands on board scene 3, windows kept",
    d && d.w && J(d.w.rows) === J(d.a.rows) && /rooftop/.test(d.w.two)
    && J(d.w.plan) === J(["clip_01", "bridge_01*", "clip_02", "bridge_02*", "clip_03"]), d && d.w);
  check("Render selected: the bridges queue AFTER the scenes on both sides of them",
    d && J(d.q) === J(["clip_01", "clip_02", "clip_03", "bridge_01", "bridge_02"]), d && d.q);
  check("the card's picker: a bridge becomes a wipe (no anchor), its generated prompt follows, the plan carries it",
    d && d.t && d.t.type === "wipeleft" && d.t.anchor === "" && /wipe left/.test(d.t.prompt)
    && d.t.plan && d.t.plan.type === "wipeleft", d && d.t);
  check("re-save with the SAME strip type keeps a card's own type; a NEW strip type (fade, 1 s) sets every bridge, the written scene stays",
    d && d.keep && d.keep[1][2] === "wipeleft" && d.keep[3][2] === "ai"
    && d.f && J(d.f.rows) === J([[1, "clip_01", "", 0, 9], [2, "bridge_01", "fade", 9, 1], [3, "clip_02", "", 10, 9],
      [4, "bridge_02", "fade", 19, 1], [5, "clip_03", "", 20, 10]]) && J(d.f.gap) === J({ dur: 1, type: "fade" })
    && /rooftop/.test(d.f.written), d && { keep: d.keep, f: d.f });
  check("the stems dock's send keeps the board's gap; gap 0 takes the bridges out (the written scene stays scene 2)",
    d && d.noopts === 2 && d.none && J(d.none.rows) === J([[1, "clip_01", "", 0, 10], [2, "clip_02", "", 10, 10], [3, "clip_03", "", 20, 10]])
    && d.none.gap === null && /rooftop/.test(d.none.written), d && d.none);
}

// ---- 3. LIVE ffmpeg
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "br358_"));
const ff = (...a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...a], { stdio: "ignore" });
const pix = (f, x, y) => execFileSync("ffmpeg", ["-loglevel", "error", "-i", f, "-f", "rawvideo", "-pix_fmt", "rgb24",
  "-vf", `crop=2:2:${x}:${y}`, "-"]).toString("latin1").match(/[\s\S]{12}/g).map((b) => [0, 1, 2].map((i) => b.charCodeAt(i)));
const probeV = (f) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,nb_frames,duration,width,height",
  "-of", "json", f], { encoding: "utf8" })).streams;
try {
  const A = path.join(tmp, "a.mp4"), Bv = path.join(tmp, "b.mp4"), S = path.join(tmp, "s.wav");
  ff("-f", "lavfi", "-i", "color=c=blue:size=320x180:rate=24", "-t", "1", "-pix_fmt", "yuv420p", A);
  ff("-f", "lavfi", "-i", "color=c=red:size=320x180:rate=24", "-t", "1", "-pix_fmt", "yuv420p", Bv);
  ff("-f", "lavfi", "-i", "sine=frequency=440:duration=8", S);
  const job = path.join(tmp, "job.json");
  fs.writeFileSync(job, J({ params: { mode: "bridge", scene: { n: 2 }, bridge: { xfade: "wipeleft", label: "Wipe left",
    seconds: 0.5, prev_take: A, next_take: Bv, song: S, start: 2, fps: 24 } }, output_dir: path.join(tmp, "out") }));
  const log = execFileSync("python3", [path.join(ROOT, "bridge_worker.py"), job], { cwd: tmp, encoding: "utf8" });
  const name = (/@@OUT (\S+)/.exec(log) || [])[1];
  const out = name ? path.join(tmp, "out", name) : "";
  const s = out ? probeV(out) : [];
  const v = s.find((x) => x.codec_type === "video") || {}, a = s.find((x) => x.codec_type === "audio") || {};
  const px = out ? pix(out, 160, 90) : [];
  check("bridge_worker.py: a 0.5 s wipe (12 frames at 24 fps) at the scene before's size, with the song window, named bridge_<n>_*.mp4",
    /^bridge_2_\d{8}-\d{6}\.mp4$/.test(name || "") && +v.nb_frames === 12 && v.width === 320 && v.height === 180
    && Math.abs(+a.duration - 0.5) < 0.06, { name, s, log: log.slice(-300) });
  check("...it STARTS on the scene before's last frame (blue) and ENDS on the scene after's first frame (red)",
    px.length === 12 && px[0][2] > 200 && px[0][0] < 40 && px[11][0] > 200 && px[11][2] < 40, px.map((p) => p.join(",")));
  // fit: an AI bridge rendered 22 frames -> its 0.5 s gap
  const L = path.join(tmp, "long.mp4");
  ff("-f", "lavfi", "-i", "color=c=green:size=160x96:rate=24", "-f", "lavfi", "-i", "color=c=red:size=160x96:rate=24",
     "-filter_complex", "[0:v]trim=end_frame=21[g];[1:v]trim=end_frame=1[r];[g][r]concat=n=2:v=1[v]", "-map", "[v]",
     "-c:v", "libx264", "-pix_fmt", "yuv420p", L);
  const before = probeV(L)[0];
  const f = B.fit(L, { seconds: 0.5, song: S, start: 1 });
  const after = probeV(L);
  const fv = after.find((x) => x.codec_type === "video") || {}, fa = after.find((x) => x.codec_type === "audio") || {};
  const lastPx = pix(L, 80, 48).pop() || [];
  check("fit: the 22-frame AI render becomes exactly its 0.5 s gap (12 frames) with the song window, still ending on the closing frame",
    +before.nb_frames === 22 && f.ok && +fv.nb_frames === 12 && Math.abs(+fa.duration - 0.5) < 0.06 && lastPx[0] > 200 && lastPx[1] < 60
    && /22|0\.92/.test(f.note) && /-> 0\.5s/.test(f.note), { before, after, f, lastPx });
  check("fit on a missing file says so and changes nothing", B.fit(path.join(tmp, "none.mp4"), { seconds: 0.5 }).ok === false);
  // the neighbours: takes on disk -> the worker's params (from the lossless master when there is one)
  const stR = { list: [{ n: 1, id: "a", status: "rendered", output: A }, { n: 2, id: "x", status: "idle", audio_dur: 0.5,
    bridge: { type: "dissolve", after: 1 }, prompt: ["p"] }, { n: 3, id: "b", status: "kept", output: Bv }] };
  const sp = B.standardParams(stR, stR.list[1], { dur: 0.5, start: 9.5, song: S });
  check("standardParams: mode bridge, ffmpeg's dissolve, both takes, the song window, the scene - and the note names both scenes",
    sp.params && sp.params.mode === "bridge" && sp.params.bridge.xfade === "dissolve" && sp.params.bridge.prev_take === A
    && sp.params.bridge.next_take === Bv && sp.params.bridge.start === 9.5 && sp.params.bridge.seconds === 0.5
    && sp.params.scene.n === 2 && /from scene 1's last frame to scene 3's first frame/.test(sp.note), sp);
  const al = B.aiLast(stR, stR.list[1]);
  check("aiLast: the AI bridge's closing picture is the scene after's FIRST frame (a PNG)",
    al.frame && fs.existsSync(al.frame.file) && /scene 3's first frame/.test(al.frame.label) && al.prev.n === 1, al);
  if (al.frame) try { fs.unlinkSync(al.frame.file); } catch {}
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

// ---- 4. the wiring
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const RC = read("routes", "characters.js"), RI = read("routes", "index.js"), CORE = read("lib", "core.js"), SBd = read("lib", "segBoard.js");
check("queueScene: a standard bridge goes to bridge_worker.py; an AI bridge is First on the native-audio board ending on the next scene's first frame",
  RC.includes("if (r.bridge.type !== sceneBridge.AI) return sceneBridge.queue(project, st, r);")
  && RC.includes('if (st.style !== "MMH3_NativeAudio_MV")')
  && RC.includes('flLast: sceneRefs.slotFor(project, r, "last") || (bridgeAi ? bridgeAi.frame : null),')
  // 2.519.0: 2.503.0 caps by CEIL (the learned ceiling G.ceiling, raised for a Long-video style) instead of G.ceiling itself
  && RC.includes("const CEIL = h3Long.modelCeiling(grid, G.ceiling, longScene);") && RC.includes("frames = sceneBridge.framesFor(audioWin.dur, CEIL);")
  && RC.includes("raw_master: !upscale && !bridgeFit,") && RC.includes("...(bridgeFit ? { bridge_fit: bridgeFit } : {}),"));
check("syncJobs fits an AI bridge before it is filed; the writer counts content scenes; the lyrics block skips bridges",
  RC.indexOf("const f = sceneBridge.fit(src, job.params.bridge_fit);") > 0
  && RC.indexOf("const f = sceneBridge.fit(src, job.params.bridge_fit);") < RC.indexOf("const rr = scenes.recordRender(st, r.n, src, project);")
  && RC.includes(".filter((sh) => !(sh && sh.bridge)).slice(shots.length)")
  && RC.includes("const wins = (stL.list || []).filter((r) => !r.bridge)"));
check("a standard-transition bridge needs no ComfyUI: ▶ / ↻ / Render selected skip the ComfyUI checks when every pick is one",
  RC.includes("return rows.length > 0 && rows.every((r) => r.bridge && r.bridge.type !== sceneBridge.AI);")
  && RC.includes("if (!ffmpegOnly(b.project, [req.params.n])) {") && RC.includes("const ffOnly = ffmpegOnly(b.project, [req.params.n]);")
  && RC.includes("if (!ffmpegOnly(b.project, b.scenes || [])) {"));
check("from-segments passes the strip's gap to the ONE staging path; routes/sceneBridge mounted from routes/index.js (never server.js); core runs bridge_worker.py",
  RC.includes("b.gap !== undefined ? { gap: b.gap, gap_type: b.gap_type } : undefined);")
  && RI.includes('require("./sceneBridge").mount(app);') && !read("server.js").includes("sceneBridge")
  && CORE.includes('bridge: "bridge_worker.py"') && SBd.includes("function stage(song, project, opts)"));

// ---- jsdom: the strip and the card
{
  const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM("<body>" + fs.readFileSync("ext/videodock/dock.html", "utf8") + "</body>",
  { url: "http://x/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
w.HTMLCanvasElement.prototype.getContext = () => null;
const posts = [];
const TYPES = { types: [{ id: "ai", label: "AI (fl2va)", group: "AI" }, { id: "fade", label: "Cross dissolve", group: "Dissolves" },
  { id: "wipeleft", label: "Wipe left", group: "Wipes" }], ai: "ai" };
const board = { chapters: [], pending: [], plan: { shots: [] }, style: "MMH3_NativeAudio_MV", audio: "My Song.wav",
  seg_song: "My Song.wav", seg_gap: { dur: 0.7, type: "wipeleft" },
  list: [{ n: 1, id: "c1", prompt: ["a"], status: "idle" },
         { n: 2, id: "b1", prompt: ["bridge"], status: "idle", bridge: { type: "fade", after: 1 } },
         { n: 3, id: "c2", prompt: ["c"], status: "idle" }] };
const json = (x) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(x))) });
w.fetch = (u, o) => {
  u = String(u); const bare = u.split("?")[0];
  if (o && o.method === "POST") posts.push({ u: bare, body: o.body ? JSON.parse(o.body) : null });
  if (bare === "/api/bridge/types") return json(TYPES);
  if (bare === "/api/scenes") return json(board);
  if (bare.startsWith("/api/waveform")) return json({ peaks: [1, 2, 3] });
  if (bare === "/api/stems/segments") return json({ ok: true, song: "My Song.wav", total: 30, durations: [15, 15], manual: [false, false] });
  if (bare === "/api/scenes/from-segments") return json({ ok: true, seg: "My_Song.seg", note: "staged" });
  if (bare === "/api/pmedia") return json({ sound: [], images: [] });
  if (/^\\/api\\/scenes\\/\\d+\\/bridge$/.test(bare)) return json({ ok: true, note: "scene 2 bridges with Wipe left" });
  return json({ ok: true, characters: [], environments: [], refs: {}, movies: [] });
};
global.window = w; global.document = w.document; global.fetch = w.fetch;
global.FormData = w.FormData; global.CustomEvent = w.CustomEvent;
w.eval(fs.readFileSync("static/segmap.js", "utf8"));
w.eval(fs.readFileSync("ext/videodock/audioseg.js", "utf8"));
w.eval(fs.readFileSync("static/pmedia.js", "utf8"));
const src = fs.readFileSync("ext/videodock/characters.js", "utf8");
const ids = new Set(); src.replace(/el\\("([\\w-]+)"\\)/g, (m, id) => ids.add(id));
for (const id of ids) if (!w.document.getElementById(id)) {
  const e = w.document.createElement(/Sel$|Select$/.test(id) ? "select" : "input");
  e.id = id; e.style.display = "none"; w.document.body.appendChild(e);
}
w.eval(src);
const $ = (id) => w.document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const out = {};
  const bar = $("vdSegSave").parentElement;
  const kids = [...bar.children].map((x) => x.id || (x.querySelector("input") || {}).id || x.tagName);
  out.order = kids.indexOf("vdSegGap") >= 0 && kids.indexOf("vdSegGap") < kids.indexOf("vdSegGapDur")
    && kids.indexOf("vdSegGapDur") < kids.indexOf("vdSegGapType") && kids.indexOf("vdSegGapType") < kids.indexOf("vdSegSave");
  out.off0 = !$("vdSegGap").checked && $("vdSegGapDur").disabled && $("vdSegGapType").disabled;
  await w.vdSongStrip.load("My Song.wav");
  await wait(150);
  out.restored = { on: $("vdSegGap").checked, dur: $("vdSegGapDur").value, type: $("vdSegGapType").value,
                   enabled: !$("vdSegGapDur").disabled, opts: [...$("vdSegGapType").options].map((o) => o.value) };
  $("vdSegGapDur").value = "0.5"; $("vdSegGapType").value = "fade";
  $("vdSegSave").click(); await wait(150);
  out.save = (posts.filter((p) => p.u === "/api/scenes/from-segments").pop() || {}).body;
  $("vdSegGap").checked = false; $("vdSegGap").dispatchEvent(new w.Event("change"));
  out.offAgain = $("vdSegGapDur").disabled;
  $("vdSegSave").click(); await wait(150);
  out.saveOff = (posts.filter((p) => p.u === "/api/scenes/from-segments").pop() || {}).body;
  // the board: the bridge card shows the picker instead of the radios
  w.document.dispatchEvent(new w.CustomEvent("vd:scenes-changed"));
  await wait(300);
  const sel = w.document.querySelector('[data-scbridge="2"]');
  out.card = { sel: !!sel, val: sel && sel.value, radios2: w.document.querySelectorAll('[data-scanchor="2"]').length,
               radios1: w.document.querySelectorAll('[data-scanchor="1"]').length,
               badge: /bridge/.test((w.document.getElementById("scList") || {}).textContent || ""),
               groups: sel ? [...sel.querySelectorAll("optgroup")].map((g) => g.label) : [] };
  if (sel) { sel.value = "wipeleft"; sel.dispatchEvent(new w.Event("change", { bubbles: true })); }
  await wait(150);
  out.pick = posts.filter((p) => p.u === "/api/scenes/2/bridge").pop();
  console.log("@@UI " + JSON.stringify(out));
  process.exit(0);
})().catch((e) => { console.log("@@UI " + JSON.stringify({ error: String(e && e.stack || e) })); process.exit(0); });
`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    const line = o.split("\n").find((l) => l.startsWith("@@UI "));
    d = line ? JSON.parse(line.slice(5)) : null;
  } catch (e) { d = { error: String(e.message || e).slice(0, 600) }; }
  check("jsdom: ☐ Transition, its seconds and its type sit before 💾; off by default (seconds + type disabled)",
    d && d.order && d.off0, d);
  check("jsdom: opening the board's song shows its stored gap (0.7 s, Wipe left) with the server's type list",
    d && d.restored && d.restored.on && d.restored.dur === "0.7" && d.restored.type === "wipeleft" && d.restored.enabled
    && J(d.restored.opts) === J(["ai", "fade", "wipeleft"]), d && d.restored);
  check("jsdom: 💾 sends the gap and its type with the segments; unticked sends gap 0",
    d && d.save && d.save.gap === 0.5 && d.save.gap_type === "fade" && J(d.save.durations) === "[15,15]"
    && d.offAgain && d.saveOff && d.saveOff.gap === 0, d && { save: d.save, saveOff: d.saveOff });
  check("jsdom: a bridge card shows the type picker (grouped) instead of the Ref/First/Cont/Trans radios; a pick posts it",
    d && d.card && d.card.sel && d.card.val === "fade" && d.card.radios2 === 0 && d.card.radios1 === 4 && d.card.badge
    && d.card.groups.includes("Wipes") && d.pick && d.pick.body && d.pick.body.type === "wipeleft", d && { card: d.card, pick: d.pick, e: d.error });
}

console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
