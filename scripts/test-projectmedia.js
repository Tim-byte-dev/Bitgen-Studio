#!/usr/bin/env node
/* bitGen Studio — THE PROJECT'S MEDIA IN EVERY DROPDOWN (2.298.0).
 * Run: node scripts/test-projectmedia.js
 *
 * Tim (verbatim): "scan the projects subfolders for images and music and
 * videos before adding it to a dropdown. scan for assets, characters,
 * locations etc."
 *   1. lib/projectMedia LIVE on a scratch project: the scan (groups with
 *      real character / location names, working folders skipped, a render
 *      listed once), resolve (no escapes), adopt (link, exists, clash);
 *   2. static/pmedia.js in jsdom: grouped <optgroup>s, asset NAME vs
 *      rel: values, adopt-on-resolve;
 *   3. the video docker in jsdom: the board-song dropdown lists the scanned
 *      songs and adopts an outside pick BEFORE setting the board song; ＋📁
 *      adds a scanned picture to one scene;
 *   4. wiring pins (routes, index.html, stems dock, music-video dialog). */
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
const J = (x) => JSON.stringify(x);

// ---- 1. the library, LIVE ------------------------------------------------------
{
  const probe = `
const fs = require("fs"), path = require("path");
const core = require("./lib/core"), PM = require("./lib/projectMedia");
const P = "e2e_pm298";
const root = core.projDir(P);
const put = (rel, body) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body || rel); return p; };
const out = {};
try {
  put("images/pier.png"); put("sound/song.mp3"); put("output/render.mp4", "R");
  fs.mkdirSync(path.join(root, "video"), { recursive: true });
  fs.linkSync(path.join(root, "output/render.mp4"), path.join(root, "video/render.mp4"));
  put("output/still.png");
  put("characters/cmx1/Vera.profile", "{}"); put("characters/cmx1/dataset/sheet.png");
  put("characters/cmx1/voice.wav", "VOICE");
  put("environments/pier/env.json", JSON.stringify({ name: "Moonlit Pier" }));
  put("environments/pier/view.png");
  put("reference/images/ref.png"); put("scene_refs/clip_01/lamp.png");
  put("songs/demo.flac"); put("stems/demo_vocals.wav");
  put("temp/junk.png"); put("chat/pasted.png"); put(".cache/x.png");
  put("characters/cmx1/notes.txt");
  const s = PM.scan(P);
  out.images = s.images.map((x) => [x.group, x.name, x.asset]);
  out.sound = s.sound.map((x) => [x.group, x.name, x.asset]);
  out.video = s.video.map((x) => [x.group, x.name, x.asset]);
  out.rels = s.images.map((x) => x.rel);
  out.esc = [PM.resolve(P, "../x.png"), PM.resolve(P, "/etc/passwd"), PM.resolve(P, "characters/cmx1/notes.txt"),
             PM.resolve(P, "characters/cmx1/../../../x.png")];
  out.ok = !!PM.resolve(P, "characters/cmx1/dataset/sheet.png");
  out.a1 = PM.adopt(P, "characters/cmx1/voice.wav");
  out.a2 = PM.adopt(P, "characters/cmx1/voice.wav");
  put("stems/voice.wav", "OTHER");
  out.a3 = PM.adopt(P, "stems/voice.wav");
  out.a4 = PM.adopt(P, "sound/song.mp3");
  out.a5 = PM.adopt(P, "nope/x.wav");
  out.soundDir = fs.readdirSync(path.join(root, "sound")).sort();
  out.linked = fs.statSync(path.join(root, "sound/voice.wav")).ino === fs.statSync(path.join(root, "characters/cmx1/voice.wav")).ino;
  out.group = PM.groupFor(P, "environments/pier/view.png");
} finally { fs.rmSync(root, { recursive: true, force: true }); }
console.log("@@PM " + JSON.stringify(out));`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    d = JSON.parse(o.split("\n").find((l) => l.startsWith("@@PM ")).slice(5));
  } catch (e) { d = { error: String(e.message).slice(0, 400) }; }
  check("LIVE: pictures are found in EVERY project folder, grouped by where they live - Assets, Gallery, the character by NAME, the location by NAME, References, Scene pictures - in that order",
    d && J(d.images) === J([["Assets", "pier.png", true], ["Gallery", "still.png", false],
      ["Characters · Vera", "sheet.png", false], ["Locations · Moonlit Pier", "view.png", false],
      ["References", "ref.png", false], ["Scene pictures", "lamp.png", false]]), d && d.images);
  check("LIVE: songs too - the sound assets, a character's voice, the Songs folder and any other folder (Stems)",
    d && J(d.sound) === J([["Assets", "song.mp3", true], ["Characters · Vera", "voice.wav", false],
      ["Songs", "demo.flac", false], ["Stems", "demo_vocals.wav", false]]), d && d.sound);
  check("LIVE: a render that is also a video asset is listed ONCE (as the asset)",
    d && J(d.video) === J([["Assets", "render.mp4", true]]), d && d.video);
  check("LIVE: working folders (temp, chat) and hidden folders are skipped, and non-media never listed",
    d && !d.rels.some((r) => /^(temp|chat|\.cache)\//.test(r)), d && d.rels);
  check("LIVE: resolve refuses paths that leave the project and files that are not media",
    d && d.esc.every((x) => x === null) && d.ok === true, d && d.esc);
  check("LIVE: adopt makes a character's voice a sound asset by hard link; again = 'exists'; a different file of the same name is uniquified, never overwritten",
    d && d.a1.ok && d.a1.name === "voice.wav" && d.a1.how === "link" && d.linked
    && d.a2.ok && d.a2.how === "exists" && d.a3.ok && d.a3.name !== "voice.wav"
    && d.soundDir.length === 3, d && [d.a1, d.a2, d.a3, d.soundDir]);
  check("LIVE: an asset answers its own name; a missing file is refused in words",
    d && d.a4.how === "asset" && d.a4.name === "song.mp3" && d.a5.ok === false && /not a picture, song or video/.test(d.a5.error), d && [d.a4, d.a5]);
  check("LIVE: groupFor names a location by its real name",
    d && d.group === "Locations · Moonlit Pier", d && d.group);
}

// ---- 2 + 3. the page helper and the video docker in jsdom -----------------------------
{
  const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM("<body>" + fs.readFileSync("ext/videodock/dock.html", "utf8") + "</body>",
  { url: "http://x/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
const posts = [];
const board = { chapters: [], pending: [], plan: { shots: [] }, style: "MMH3_NativeAudio_MV", audio: "song.mp3",
  list: [{ n: 1, id: "c1", prompt: ["a"], status: "idle" }] };
const SOUND = [ { name: "song.mp3", rel: "sound/song.mp3", group: "Assets", asset: true },
  { name: "voice.wav", rel: "characters/cmx1/voice.wav", group: "Characters · Vera", asset: false },
  { name: "demo.flac", rel: "songs/demo.flac", group: "Songs", asset: false } ];
const IMAGES = [ { name: "pier.png", rel: "images/pier.png", group: "Assets", asset: true },
  { name: "sheet.png", rel: "characters/cmx1/dataset/sheet.png", group: "Characters · Vera", asset: false } ];
w.fetch = (u, o) => {
  u = String(u);
  const bare = u.split("?")[0];
  if (o && o.method === "POST") posts.push({ u: bare, body: o.body });
  const ok = (b) => Promise.resolve({ ok: true, json: () => Promise.resolve(b) });
  if (bare === "/api/pmedia") return ok(u.includes("kind=sound") ? { sound: SOUND } : { images: IMAGES });
  if (bare === "/api/pmedia/adopt") return ok({ ok: true, name: "demo.flac", kind: "sound", how: "link" });
  if (bare === "/api/scenes") return ok(board);
  return ok({ ok: true, characters: [], environments: [], refs: {} });
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
  const out = {};
  // the helper on its own
  const sel = w.document.createElement("select");
  w.bgMedia.fill(sel, SOUND, { placeholder: "—", keep: "song.mp3" });
  out.groups = [...sel.querySelectorAll("optgroup")].map((g) => [g.label, [...g.children].map((o) => o.value)]);
  out.kept = sel.value;
  out.first = sel.options[0].value;
  out.resolvedAsset = await w.bgMedia.resolve("song.mp3");
  out.resolvedRel = await w.bgMedia.resolve("rel:songs/demo.flac");
  out.thumbs = IMAGES.map((x) => w.bgMedia.thumbSrc(x));
  await wait(200);
  w.document.dispatchEvent(new w.CustomEvent("vd:scenes-changed"));
  await wait(300);
  const va = q("#vdAudio");
  out.vd = [...va.querySelectorAll("optgroup")].map((g) => g.label);
  out.vdVal = va.value;
  posts.length = 0;
  va.value = "rel:songs/demo.flac";
  va.dispatchEvent(new w.Event("change"));
  await wait(200);
  out.vdPosts = posts.map((p) => [p.u, JSON.parse(p.body)]);
  posts.length = 0;
  q('[data-scflpick="1"][data-slot="ref"]').click();
  await wait(150);
  out.refTitle = q("#scFlPick").getAttribute("aria-label");
  out.refTabs = qa("#scFlPick [data-fltab]").map((b) => b.dataset.fltab);
  out.refGroups = qa("#scFlPick [data-flgroup]").map((h) => h.textContent);
  qa("#scFlPick [data-flbody] img")[1].click();
  await wait(100);
  out.refPosts = posts.map((p) => [p.u, JSON.parse(p.body)]);
  console.log("@@VD " + JSON.stringify(out));
  process.exit(0);
})();`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    const line = o.split("\n").find((l) => l.startsWith("@@VD "));
    d = line ? JSON.parse(line.slice(5)) : { raw: o.slice(-600) };
  } catch (e) { d = { error: String(e.message).slice(0, 600) }; }
  check("bgMedia.fill: one <optgroup> per folder group; an asset's value is its NAME, anything else rel:<project path>; the placeholder first; the pick kept",
    d && J(d.groups) === J([["Assets", ["song.mp3"]], ["Characters · Vera", ["rel:characters/cmx1/voice.wav"]],
      ["Songs", ["rel:songs/demo.flac"]]]) && d.kept === "song.mp3" && d.first === "", d && d.groups);
  check("bgMedia.resolve: an asset name passes straight through; a rel: pick is ADOPTED first (POST /api/pmedia/adopt) and answers the asset name",
    d && d.resolvedAsset === "song.mp3" && d.resolvedRel === "demo.flac", d && [d.resolvedAsset, d.resolvedRel]);
  check("bgMedia.thumbSrc: an asset by its asset URL, anything else through /pmedia",
    d && J(d.thumbs) === '["/passets/images/pier.png","/pmedia?rel=characters%2Fcmx1%2Fdataset%2Fsheet.png"]', d && d.thumbs);
  check("jsdom: the board-song dropdown lists EVERY song in the project, grouped by folder, with the board's song selected",
    d && J(d.vd) === '["Assets","Characters · Vera","Songs"]' && d.vdVal === "song.mp3", d && [d.vd, d.vdVal]);
  check("jsdom: a song from another folder is adopted into the sound assets BEFORE it becomes the board's song (the asset name is posted)",
    d && J(d.vdPosts) === J([["/api/pmedia/adopt", { rel: "songs/demo.flac" }], ["/api/scenes/audio", { file: "demo.flac" }]]),
    d && d.vdPosts);
  check("jsdom: ＋📁 opens the picker for scene pictures (Project + File), grouped by folder",
    d && d.refTitle === "Add reference pictures to scene 1" && J(d.refTabs) === '["project","file"]'
    && J(d.refGroups) === '["Assets","Characters · Vera"]', d && [d.refTitle, d.refTabs, d.refGroups]);
  check("jsdom: picking a character's picture adds it to THAT scene (POST refs/project with its project path)",
    d && J(d.refPosts) === J([["/api/scenes/1/refs/project", { kind: "project", rel: "characters/cmx1/dataset/sheet.png", slot: "ref" }]]),
    d && d.refPosts);
}

// ---- 4. wiring ---------------------------------------------------------------------------
{
  const RI = read("routes", "index.js"), RC = read("routes", "characters.js");
  const IX = read("static", "index.html"), SD = read("ext", "stemsdock", "stemsdock.js");
  check("routes: GET /api/pmedia (the scan), GET /pmedia (serve by project path), POST /api/pmedia/adopt",
    RI.includes('app.get("/api/pmedia"') && RI.includes('app.get("/pmedia"') && RI.includes('app.post("/api/pmedia/adopt"'));
  check("routes: a scanned picture can be a scene's first/last frame (kind project) or one of its pictures (refs/project)",
    RC.includes('} else if (b.kind === "project") {') && RC.includes('app.post("/api/scenes/:n/refs/project"'));
  check("the page loads the helper; the music-video dialog's song list is the scan, a pick outside the assets is adopted",
    IX.includes('<script src="/static/pmedia.js"></script>')
    && IX.includes('window.bgMedia.fill($("mv_song"), list, { placeholder: "— no song (silent cut) —" });')
    && IX.includes('const name = await window.bgMedia.resolve(v);'));
  check("the stems dock's song list is the scan (rescanned as the pointer arrives) and an outside pick is adopted before the waveform loads",
    SD.includes('return window.bgMedia.load("sound").then(function (list) {')
    && SD.includes('el("stSong").addEventListener("change", onSongChange);')
    && SD.includes('window.bgMedia.resolve(v).then(function (name) {'));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
