#!/usr/bin/env node
/* bitGen Studio — THE SCENE CARD: FILMSTRIP BELOW, ALL-SCENE RADIOS, SCENE
 * PICTURES, RENDER-ALL CONTINUITY (2.295.0).
 * Run: node scripts/test-scenecards.js
 *
 * Tim (verbatim): "after the scene renders put the filmstrip below the
 * rendered scene. it is putting it on the scene box. expand the frames
 * automatically, allow user to select frame for first frame of next video.
 * if user selects render all use the last frame of the previous scene.
 * allow user to change all scenes radio buttons before first render so user
 * can start job and job will run to completion. allow user to add reference
 * images to each scene individually".
 *   1. lib/sceneRefs (LIVE files in a scratch project) + the board keeps
 *      the list through the sanitizer and a rewrite;
 *   2. the render wiring (previous-scene source, stale picks, scene
 *      pictures after the sheets, Trans destination);
 *   3. the video docker in jsdom: the card is a column with the strip
 *      UNDER the row, strips open by themselves and extract once, the
 *      picked frame is outlined, a click picks it, 🎞 hides, All: radios,
 *      scene pictures (thumbs, ✕, ＋🖼).
 * The LIVE renders ride the e2e. */
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
const SC = require("../lib/scenes");
const NA = require("../lib/nativeAudio");

// ---- 1. lib/sceneRefs, LIVE ----------------------------------------------------
{
  const probe = `
const fs = require("fs"), path = require("path"), os = require("os");
const core = require("./lib/core"), SR = require("./lib/sceneRefs");
const P = "e2e_scref295";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sr295-"));
const up = (n) => { const p = path.join(tmp, n + ".up"); fs.writeFileSync(p, "PNG" + n); return { path: p, originalname: n }; };
const row = { n: 2, id: "clip_02" };
const out = {};
try {
  out.a = SR.add(P, row, [up("guitar case.png"), up("guitar case.png"), up("notes.txt")]);
  out.refs = JSON.parse(JSON.stringify(row.refs));
  out.onDisk = fs.readdirSync(SR.dir(P, "clip_02")).sort();
  out.fr = SR.forRender(P, row);
  out.escape = SR.filePath(P, "clip_02", "../../etc/passwd");
  out.rm = SR.remove(P, row, out.refs[0].file);
  out.after = row.refs.map((x) => x.file);
  out.onDisk2 = fs.readdirSync(SR.dir(P, "clip_02")).sort();
  const many = []; for (let i = 0; i < 12; i++) many.push(up("p" + i + ".jpg"));
  out.cap = SR.add(P, { n: 3, id: "clip_03" }, many);
  fs.unlinkSync(path.join(SR.dir(P, "clip_02"), out.after[0]));
  out.gone = SR.forRender(P, row);
} finally {
  fs.rmSync(core.projDir(P), { recursive: true, force: true });
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log("@@SR " + JSON.stringify(out));`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    d = JSON.parse(o.split("\n").find((l) => l.startsWith("@@SR ")).slice(5));
  } catch (e) { d = { error: String(e.message).slice(0, 400) }; }
  check("LIVE: pictures land in scene_refs/<scene id>/ with safe unique names, a non-picture is skipped by reason, the row lists them with a label",
    d && d.a && JSON.stringify(d.a.added) === '["guitar_case.png","guitar_case_2.png"]'
    && d.a.skipped.length === 1 && d.a.skipped[0].why === "not a picture"
    && JSON.stringify(d.onDisk) === '["guitar_case.png","guitar_case_2.png"]'
    && d.refs[0].label === "guitar case", d);
  check("LIVE: forRender gives absolute paths; a name that escapes the folder is refused",
    d && d.fr.refs.length === 2 && path.isAbsolute(d.fr.refs[0].file) && d.escape === null, d && d.fr);
  check("LIVE: remove takes the file and the list entry",
    d && d.rm.removed === true && JSON.stringify(d.after) === '["guitar_case_2.png"]'
    && JSON.stringify(d.onDisk2) === '["guitar_case_2.png"]', d);
  check("LIVE: a scene holds at most 9 pictures (the node's picture limit), the rest said",
    d && d.cap.added.length === 9 && d.cap.skipped.length === 3, d && d.cap);
  check("LIVE: a picture gone from disk is reported, not silently dropped",
    d && d.gone.refs.length === 0 && /missing from scene_refs/.test(d.gone.missing[0]), d && d.gone);

  const s = SC.safe({ list: [{ n: 1, id: "c1", prompt: ["a"],
    refs: [{ file: "../x.png", label: "x" }, { junk: 1 }] }] });
  check("scenes.safe keeps the list (basename only, junk out); fromPlan carries it through a prompt rewrite",
    JSON.stringify(s.list[0].refs) === '[{"file":"x.png","label":"x"}]'
    && JSON.stringify(SC.fromPlan({ shots: [{ id: "c1", prompt: ["b"] }] }, s).list[0].refs)
       === '[{"file":"x.png","label":"x"}]');
}

// ---- 2. the render wiring -----------------------------------------------------------
{
  const RC = read("routes", "characters.js");
  check("render-all continuity: a First/Trans scene with no picked frame and no writer source follows the scene BEFORE it",
    RC.includes('if (!srcId && ["first", "continue", "transition", "last"].includes(String(r.anchor || ""))) {')
    && RC.includes(".sort((a, b) => b.n - a.n)[0];"));
  check("render-all: a frame picked on a take that is re-rendered in the SAME run is dropped (the new take's last frame is used)",
    RC.includes("if (ns.has(r0.n) && Number.isFinite(r0.cont_src) && ns.has(r0.cont_src)) {"));
  check("the scene's own pictures join the native render right after the cast sheets",
    RC.includes("const sr = sceneRefs.forRender(project, r);")
    && RC.includes('const at = imgMeta.filter((x) => x.kind === "sheet").length;')
    && RC.indexOf("const sr = sceneRefs.forRender(project, r);") < RC.indexOf("const p = nativeAudio.plan({"));
  check("routes: all-scene anchors, scene picture upload / delete / serve",
    RC.includes('app.post("/api/scenes/anchors"') && RC.includes('app.post("/api/scenes/:n/refs", upload.array("images", sceneRefs.MAX_PER_SCENE)')
    && RC.includes('app.post("/api/scenes/:n/refs/delete"') && RC.includes('app.get("/api/scenes/:n/refs/:file"'));
  const meta = [
    { file: "/s.png", kind: "sheet", tag: "vera" },
    { file: "/loc.png", kind: "location", tag: "pier" },
    { file: "/mine.png", kind: "scene", label: "the lighthouse" }];
  check("Trans destination: a picture on THIS scene outranks an unnamed location; a location the prompt names still wins",
    NA.locationStill(meta, "@vera walks").file === "/mine.png"
    && NA.locationStill(meta, "@vera walks onto @pier").file === "/loc.png");
  check("the reference map names a scene picture for what it is",
    require("../lib/refMap").describe({ kind: "scene", label: "the lighthouse" })
      === "scene reference picture (the lighthouse)");
}

// ---- 3. the video docker in jsdom ------------------------------------------------------
{
  const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM("<body>" + fs.readFileSync("ext/videodock/dock.html", "utf8") + "</body>",
  { url: "http://x/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
const posts = []; let frameFetches = 0;
const board = { chapters: [], pending: [], plan: { shots: [] }, style: "MMH3_NativeAudio_MV", list: [
  { n: 1, id: "c1", prompt: ["a"], status: "rendered", output: "scene1.mp4", length: 120 },
  { n: 2, id: "c2", prompt: ["b"], status: "idle", cont_src: 1, cont_time: 1.0, anchor: "first",
    refs: [{ file: "lighthouse.png", label: "the lighthouse" }] },
  { n: 3, id: "c3", prompt: ["c"], status: "running", job: "j", output: "old3.mp4" } ] };
w.fetch = (u, o) => {
  u = String(u);
  if (o && o.method === "POST") posts.push({ u: u.split("?")[0], body: o.body });
  if (u.startsWith("/api/frames")) {
    frameFetches++;
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ key: "k1",
      frames: [0, 0.5, 1, 1.5, 2].map((t, i) => ({ file: "f" + i + ".jpg", t })) }) });
  }
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
    const card1 = q('[data-sc="1"]');
    const wrap = q('[data-scfilmwrap="1"]');
    const layout = { column: card1 && card1.style.flexDirection === "column",
      wrapIsChildOfCard: !!wrap && wrap.parentElement === card1,
      rowHasNoStrip: card1 && !card1.firstElementChild.querySelector("[data-scstrip]"),
      strip3: !!q('[data-scstrip="3"]') };
    const imgs = [...w.document.querySelectorAll('[data-scstrip="1"] img')];
    const outlined = imgs.map((i) => i.style.border.includes("rgb(79, 163, 255)") || i.style.border.includes("#4fa3ff"));
    const hint = q('[data-scfilmwrap="1"] .hint span').textContent;
    const fetches1 = frameFetches;
    w.document.dispatchEvent(new w.CustomEvent("vd:scenes-changed"));
    setTimeout(() => {
      const fetches2 = frameFetches;
      const imgs2 = [...w.document.querySelectorAll('[data-scstrip="1"] img')];
      imgs2[4].click();
      q('[data-scfilm="1"]').click();
      // 2.300.1: the ◀ strip ▶ ROW is what hides (the strip scrolls inside it)
      const hiddenNow = q('[data-scstriprow="1"]').style.display;
      q('[data-scallanchor="first"]').click();
      q('[data-screfdel="2"]').click();
      const thumb = q('[data-screfs="2"] img');
      const refsUi = { thumb: thumb && thumb.getAttribute("src"), add: !!q('[data-screfadd="2"]'),
        file: q('[data-screffile="2"]') && q('[data-screffile="2"]').multiple };
      setTimeout(() => {
        console.log("@@CARD " + JSON.stringify({ layout, count: imgs.length, outlined, hint,
          fetches1, fetches2, hiddenNow, refsUi, posts }));
        process.exit(0);
      }, 150);
    }, 200);
  }, 300);
}, 200);`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    const line = o.split("\n").find((l) => l.startsWith("@@CARD "));
    d = line ? JSON.parse(line.slice(7)) : { raw: o.slice(-600) };
  } catch (e) { d = { error: String(e.message).slice(0, 600) }; }
  const P = (u) => (d && d.posts || []).filter((p) => p.u === u).map((p) => JSON.parse(p.body));
  check("jsdom: the card is a COLUMN and the filmstrip sits UNDER the scene's row (not inside it); a running scene has none",
    d && d.layout && d.layout.column && d.layout.wrapIsChildOfCard && d.layout.rowHasNoStrip
    && d.layout.strip3 === false, d && d.layout);
  check("jsdom: the frames open BY THEMSELVES once the scene has rendered",
    d && d.count === 5, d && d.count);
  check("jsdom: the picked frame (scene 2 starts at 1.0 s) is outlined, and the strip says so",
    d && JSON.stringify(d.outlined) === "[false,false,true,false,false]" && /picked: 1s/.test(d.hint), d);
  check("jsdom: frames are extracted ONCE per take - the poll's repaint reuses them",
    d && d.fetches1 === 1 && d.fetches2 === 1, d && [d.fetches1, d.fetches2]);
  check("jsdom: clicking a frame makes it the FIRST frame of the next scene (POST pick-frame on scene 1 at that time)",
    JSON.stringify(P("/api/scenes/1/pick-frame")) === '[{"time":2}]', d && d.posts);
  check("jsdom: 🎞 hides the strip (its ◀ ▶ row)",
    d && d.hiddenNow === "none", d && d.hiddenNow);
  check("jsdom: All: First sets every scene's radio in one post",
    JSON.stringify(P("/api/scenes/anchors")) === '[{"anchor":"first"}]', d && d.posts);
  check("jsdom: scene 2 shows ITS picture (served per scene), a ✕ that removes it, and ＋🖼 with a multi-file picker",
    d && d.refsUi && d.refsUi.thumb === "/api/scenes/2/refs/lighthouse.png" && d.refsUi.add && d.refsUi.file === true
    && JSON.stringify(P("/api/scenes/2/refs/delete")) === '[{"file":"lighthouse.png"}]', d && d.refsUi);
  const DH = read("ext", "videodock", "dock.html");
  check("the board header carries All: Ref / First / Trans",
    ["reference", "first", "continue", "transition"].every((a) => DH.includes('data-scallanchor="' + a + '"')));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
