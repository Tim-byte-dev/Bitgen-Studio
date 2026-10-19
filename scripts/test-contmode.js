#!/usr/bin/env node
/* bitGen Studio — CONT: OPEN ON THE FRAME, KEEP THE CHARACTER (2.296.0).
 * Run: node scripts/test-contmode.js
 *
 * Tim (verbatim): "is it possible for me to add the last frame of the scene
 * before as a reference image to the current scene? i would like the scene
 * to start from the last frame but keep the character and continuity of the
 * scene, right now the last frame is a closup of the guitar, the next scene
 * starts with the guitar closeup but the character changes".
 *   1. nativeAudio.plan "continue": ref2va, the frame as <Picture 1> "the
 *      opening frame", the cast sheets behind it, the take's end as
 *      <Video 1>, the opening line; no frame = Ref, said;
 *   2. sceneRefs.addFrame LIVE: a take's last / timed frame becomes a
 *      picture on the next scene with a label that says what it is;
 *   3. wiring pins + the dock in jsdom (Cont radio, All: Cont, ＋🖼 to
 *      scene n+1 posting the picked time). The LIVE render rides the e2e. */
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
const NA = require("../lib/nativeAudio");
const SC = require("../lib/scenes");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cont296-"));
const touch = (n) => { const p = path.join(tmp, n); fs.writeFileSync(p, "x"); return p; };

// ---- 1. the plan ------------------------------------------------------------------
{
  const sheet = touch("vera.png"), song = touch("song.wav");
  const frame = { file: touch("scene2_continuation.png"), name: "continuation frame (c1)",
                  kind: "frame", label: "the end of clip_01 - keep its framing, identity and lighting" };
  let take = path.join(tmp, "take.mp4");
  try {
    execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc=duration=5:size=160x96:rate=24",
      "-pix_fmt", "yuv420p", take], { stdio: "ignore", timeout: 60000 });
  } catch { take = ""; }
  const base = { prompt: "@vera strums the guitar", song, window: { start: 0, dur: 8 },
    imgMeta: [{ file: sheet, name: "vera.png", tag: "vera", kind: "sheet", label: "Vera" }],
    audMeta: [], tmpDir: tmp, n: 2 };
  const p = NA.plan({ ...base, anchor: "continue", frame, take: take ? { path: take, n: 1, id: "clip_01" } : null });
  check("Cont renders ref2va (the character sheets ride - fl2va has no slots for them)",
    p.mode === "ref2va", p.mode);
  check("...the frame is <Picture 1>, 'the opening frame', with the sheet right behind it",
    p.files[0] === frame.file && p.files[1] === sheet
    && p.prompt.includes("<Picture 1> is the opening frame (the end of clip_01 - the clip OPENS exactly on this picture")
    && p.prompt.includes("<Picture 2> is @vera - character sheet"), p.prompt.slice(0, 500));
  check("...the prompt opens on it and the @tag becomes its sheet's number",
    p.prompt.includes("The clip opens exactly on <Picture 1> and continues from it.\n<Picture 2> strums the guitar"),
    p.prompt.slice(-200));
  check("...and the end of the previous take rides as <Video 1> (motion carries on)",
    !take || (p.videos.length === 1 && p.prompt.includes("<Video 1> is reference video")), p.videos);
  check("...said in the notes",
    p.notes.some((x) => /ref2va \(Cont\): opens on the end of clip_01 as <Picture 1>/.test(x)), p.notes);
  const nf = NA.plan({ ...base, anchor: "continue", frame: null, take: null });
  check("Cont with no frame renders Ref and SAYS why",
    nf.mode === "ref2va" && nf.files[0] === sheet
    && nf.missing.some((x) => /Cont needs a frame to open on/.test(x)), nf);
  check("scenes.safe keeps the 'continue' anchor",
    SC.safe({ list: [{ n: 1, id: "c", prompt: ["a"], anchor: "continue" }] }).list[0].anchor === "continue"
    && SC.ANCHORS.includes("continue"));
}

// ---- 2. addFrame, LIVE --------------------------------------------------------------
{
  const probe = `
const fs = require("fs"), path = require("path"), cp = require("child_process");
const core = require("./lib/core"), SR = require("./lib/sceneRefs");
const P = "e2e_cont296";
const take = path.join(require("os").tmpdir(), "cont296_take.mp4");
const out = {};
try {
  cp.execFileSync("ffmpeg", ["-y","-f","lavfi","-i","testsrc=duration=4:size=160x96:rate=24","-pix_fmt","yuv420p", take], { stdio: "ignore" });
  const row = { n: 3, id: "clip_03" };
  out.last = SR.addFrame(P, row, take, null, 2);
  out.timed = SR.addFrame(P, row, take, 1.5, 2);
  out.refs = row.refs;
  out.files = fs.readdirSync(SR.dir(P, "clip_03")).sort();
  out.none = SR.addFrame(P, row, "/nope.mp4", null, 2);
} finally {
  fs.rmSync(core.projDir(P), { recursive: true, force: true });
  try { fs.unlinkSync(take); } catch {}
}
console.log("@@AF " + JSON.stringify(out));`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    d = JSON.parse(o.split("\n").find((l) => l.startsWith("@@AF ")).slice(5));
  } catch (e) { d = { error: String(e.message).slice(0, 400) }; }
  check("LIVE: the take's LAST frame and a timed frame become pictures on the next scene, labelled for what they are",
    d && d.last && d.last.added[0] === "scene2_frame_last.png" && d.timed.added[0] === "scene2_frame_1_5s.png"
    && JSON.stringify(d.refs.map((x) => x.label)) === '["last frame of scene 2","scene 2 at 1.5s"]'
    && JSON.stringify(d.files) === '["scene2_frame_1_5s.png","scene2_frame_last.png"]', d);
  check("LIVE: a take not on disk is refused in words",
    d && d.none && d.none.added.length === 0 && /take is not on disk/.test(d.none.skipped[0].why), d && d.none);
}

// ---- 3. wiring + the dock ----------------------------------------------------------------
{
  const RC = read("routes", "characters.js");
  check("routes: POST /api/scenes/:n/frame-ref gives scene n's frame to the NEXT scene; Cont follows the previous scene; the chain never sends Cont through fl2va",
    RC.includes('app.post("/api/scenes/:n/frame-ref"')
    && RC.includes("const out = sceneRefs.addFrame(b.project, next, take, Number.isFinite(t) ? t : null, src.n);")
    && RC.includes('["first", "continue", "transition", "last"]')
    && RC.includes('if (anch !== "reference" && anch !== "continue"'));
  const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM("<body>" + fs.readFileSync("ext/videodock/dock.html", "utf8") + "</body>",
  { url: "http://x/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
const posts = [];
const board = { chapters: [], pending: [], plan: { shots: [] }, style: "MMH3_NativeAudio_MV", list: [
  { n: 1, id: "c1", prompt: ["a"], status: "rendered", output: "scene1.mp4", length: 96 },
  { n: 2, id: "c2", prompt: ["b"], status: "idle", anchor: "continue", cont_src: 1, cont_time: 2.5 },
  { n: 3, id: "c3", prompt: ["c"], status: "rendered", output: "scene3.mp4", length: 96 },
  { n: 4, id: "c4", prompt: ["d"], status: "idle" } ] };
w.fetch = (u, o) => {
  u = String(u);
  if (o && o.method === "POST") posts.push({ u: u.split("?")[0], body: o.body });
  if (u.startsWith("/api/frames")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ key: "k",
    frames: [0, 1, 2, 2.5, 3].map((t, i) => ({ file: "f" + i + ".jpg", t })) }) });
  const body = u.split("?")[0] === "/api/scenes" ? board : { ok: true, characters: [], environments: [], refs: {} };
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
};
global.window = w; global.document = w.document; global.fetch = w.fetch;
global.FormData = w.FormData; global.CustomEvent = w.CustomEvent;
const src = fs.readFileSync("ext/videodock/characters.js", "utf8");
const ids = new Set(); src.replace(/el\\("([\\w-]+)"\\)/g, (m, id) => ids.add(id));
for (const id of ids) if (!w.document.getElementById(id)) {
  const e = w.document.createElement(/Sel$|Select$/.test(id) ? "select" : "input");
  e.id = id; e.style.display = "none"; w.document.body.appendChild(e);
}
w.eval(src);
const q = (s) => w.document.querySelector(s);
setTimeout(() => {
  w.document.dispatchEvent(new w.CustomEvent("vd:scenes-changed"));
  setTimeout(() => {
    const radios = [...w.document.querySelectorAll('[data-scanchor="2"]')].map((r) => [r.value, r.checked, r.parentElement.textContent]);
    const b1 = q('[data-scframeref="1"]'), b3 = q('[data-scframeref="3"]');
    const labels = [b1 && b1.textContent, b3 && b3.textContent];
    b1.click(); b3.click();
    q('[data-scallanchor="continue"]').click();
    setTimeout(() => {
      console.log("@@DK " + JSON.stringify({ radios, labels, posts }));
      process.exit(0);
    }, 150);
  }, 300);
}, 200);`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    const line = o.split("\n").find((l) => l.startsWith("@@DK "));
    d = line ? JSON.parse(line.slice(5)) : { raw: o.slice(-600) };
  } catch (e) { d = { error: String(e.message).slice(0, 600) }; }
  const P = (u) => (d && d.posts || []).filter((p) => p.u === u).map((p) => JSON.parse(p.body));
  check("jsdom: the card's radios are Ref / First / Cont / Trans and a Cont scene shows Cont checked",
    d && JSON.stringify((d.radios || []).map((r) => r[2])) === '["Ref","First","Cont","Trans"]'
    && (d.radios || []).find((r) => r[0] === "continue")[1] === true, d && d.radios);
  check("jsdom: the strip carries '＋🖼 to scene n+1'",
    d && JSON.stringify(d.labels) === '["＋🖼 to scene 2","＋🖼 to scene 4"]', d && d.labels);
  check("jsdom: it posts the PICKED time (scene 2 starts at 2.5 s) - and nothing (= the last frame) when none is picked",
    JSON.stringify(P("/api/scenes/1/frame-ref")) === '[{"time":2.5}]'
    && JSON.stringify(P("/api/scenes/3/frame-ref")) === "[{}]", d && d.posts);
  check("jsdom: All: Cont sets every scene",
    JSON.stringify(P("/api/scenes/anchors")) === '[{"anchor":"continue"}]', d && d.posts);
}

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
