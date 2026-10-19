#!/usr/bin/env node
/* bitGen Studio — 2.299.0: THE GLOBAL PROMPT, THE LOAD MENU, LAST FRAMES.
 * Run: node scripts/test-globalprompt.js
 *
 * Tim (verbatim): "remove the chapter drowndown from each scene, allow user
 * to load song from the load button in the video docker menubar. song can
 * be loaded from anywhere but is copied to the active project, add
 * location tag to global prompt if location is set. llm should read global
 * prompt before generating scenes for videos or music videos, also add a
 * last frame option to each scene fl2va will use last frame too if it is
 * set"
 *   1. lib/locationPrefix: the location block (set = has its picture),
 *      placed after the voice slots, rebuilt in place, removed, an empty
 *      prompt left empty; screenplay.buildPrefix carries it line by line;
 *   2. mvWriter.globalNote: the music-video writer reads the global prompt
 *      without its voice slots / dialogue / (S1) markup;
 *   3. nativeAudio.plan: First ends on a chosen LAST frame (fl2va), Ref and
 *      Cont carry it as their closing picture (ref2va);
 *   4. the video docker in jsdom: 📂 Load is a menu (movie / song from
 *      disk), no chapter dropdown on the cards, Last on every scene;
 *   5. wiring pins. */
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

// ---- 1. the location block ------------------------------------------------------
{
  const LP = require(path.join(ROOT, "lib", "locationPrefix"));
  const SP = require(path.join(ROOT, "lib", "screenplay"));
  const pier = { name: "moonlit pier", tag: "moonlit_pier", scenes: "all", pano: "pano.png", view: "view.png" };
  const roof = { name: "rooftop", tag: "rooftop", scenes: "3-4", pano: "", view: "view.png" };
  const bare = { name: "cellar", tag: "cellar", scenes: "all", pano: "", view: "" };
  const L = LP.lines([pier, bare, roof]);
  check("a location is SET when it has its picture - the one without a pano or view is left out",
    L.length === 3 && L[0] === "location_definitions:"
    && /^@moonlit_pier is the location "moonlit pier" defined by the provided 360° view picture/.test(L[1])
    && /^@rooftop .*\(scenes 3-4\)\.$/.test(L[2]) && !L.join(" ").includes("cellar"), L);
  check("no location set -> no block", J(LP.lines([bare])) === "[]" && J(LP.lines([])) === "[]");
  const pre = ["subject_definitions:", "", "@vera is the character ...", "", "voice_assignments: @vera speaks in (S1).",
               "", "My own note: always night.", "", "Maintain strict continuity."];
  const a1 = LP.apply(pre, [pier]);
  check("the block goes in AFTER the voice slots; the user's own lines are untouched",
    J(a1) === J(["subject_definitions:", "", "@vera is the character ...", "", "voice_assignments: @vera speaks in (S1).",
      "", "location_definitions:", LP.line(pier), "", "My own note: always night.", "", "Maintain strict continuity."]), a1);
  const a2 = LP.apply(a1, [pier, roof]);
  check("a second location REBUILDS the block in place (never a second block)",
    a2.filter((l) => l === "location_definitions:").length === 1 && a2.indexOf(LP.line(roof)) === a2.indexOf(LP.line(pier)) + 1
    && a2[a2.length - 1] === "Maintain strict continuity.", a2);
  const a3 = LP.apply(a2, []);
  check("the last location removed -> the block goes, the rest is exactly as before", J(a3) === J(pre), a3);
  const noVoice = ["subject_definitions:", "", "@vera is ...", "", "@max is ...", "", "Notes."];
  check("no voice slots: the block follows the subject definitions",
    J(LP.apply(noVoice, [pier])) === J(["subject_definitions:", "", "@vera is ...", "", "@max is ...", "",
      "location_definitions:", LP.line(pier), "", "Notes."]));
  check("a free-text prompt (no definitions) gets the block on top",
    J(LP.apply(["always night"], [pier])) === J(["location_definitions:", LP.line(pier), "", "always night"]));
  const bp = SP.buildPrefix([{ name: "Vera", tag: "vera", type: "person" }], { locations: LP.lines([pier]) });
  check("screenplay.buildPrefix carries the locations - ONE line per element, after the cast",
    bp.includes("location_definitions:") && bp.includes(LP.line(pier))
    && bp.indexOf("location_definitions:") > bp.findIndex((l) => /^@vera/.test(l))
    && bp.every((l) => !String(l).includes("\n")), bp);
  // sync on a board: empty stays empty, a saved one gains the block, the gate is the same
  let saved = null;
  const board = { plan: { shots: [], prompt_prefix: [] } };
  const deps = {
    scenes: { load: () => board, save: (st) => { saved = st; return st; },
              chainOverrides: () => ({}), fromPlan: (p, st) => ({ ...st, plan: p }) },
    screenplay: { normalize: (p) => p, validate: () => ({ ok: true }) },
    chars: { cast: () => [] }, envs: { list: () => [pier] }, chapterRefs: { tags: () => [] },
  };
  const s0 = LP.sync("p", deps);
  check("sync: an EMPTY global prompt stays empty (it is built whole, with the cast, when needed)",
    s0.changed === false && saved === null, s0);
  board.plan.prompt_prefix = ["My note."];
  const s1 = LP.sync("p", deps);
  check("sync: a saved global prompt gains the location, said in the answer",
    s1.changed && saved && J(saved.plan.prompt_prefix) === J(["location_definitions:", LP.line(pier), "", "My note."])
    && /1 location/.test(s1.note), [s1, saved && saved.plan.prompt_prefix]);
  board.plan = saved.plan; saved = null;
  check("sync: nothing changed -> nothing written", LP.sync("p", deps).changed === false && saved === null);
  board.plan = { shots: [{ id: "c1" }], prompt_prefix: ["My note."] };
  deps.screenplay.validate = () => ({ ok: false, errors: ["unknown @x"] });
  const s2 = LP.sync("p", deps);
  check("sync: a plan the new block would break keeps its prompt, said in words",
    s2.changed === false && /would break the plan: unknown @x/.test(s2.error) && saved === null, s2);
}

// ---- 2. the music-video writer reads the global prompt -----------------------------------
{
  const MV = require(path.join(ROOT, "lib", "mvWriter"));
  const pre = ["subject_definitions:", "", "@vera is the character defined by the provided character reference sheet.",
    "", "voice_assignments: @vera speaks in (S1) using the provided voice reference.",
    "Only the character explicitly assigned a line speaks it.", "", "location_definitions:",
    '@pier is the location "pier" defined by the provided 360° view picture.', "",
    "My note: @vera (S1) wears the red coat, <d>[English] hi</d> always at night.", "",
    "Dialogue must be clearly synchronized with the speaking character's mouth.",
    "Generated dialogue must remain consistent with the established speaker identities."];
  const g = MV.globalNote(pre);
  check("globalNote: headed READ IT BEFORE YOU WRITE, keeps looks, locations and notes",
    /THE GLOBAL PROMPT - READ IT BEFORE YOU WRITE/.test(g) && g.includes("@vera is the character")
    && g.includes("@pier is the location") && g.includes("wears the red coat"), g);
  check("globalNote: the voice-slot paragraph, the dialogue lines and (S1)/<d> markup are OUT",
    !/voice_assignments|speaks in|Only the character explicitly|\(S1\)|<d>|Dialogue must|speaker identities/.test(g), g);
  check("globalNote: an empty prompt adds nothing", MV.globalNote([]) === "" && MV.globalNote(["", " "]) === "");
}

// ---- 3. the last frame on every scene ---------------------------------------------------------
{
  const NA = require(path.join(ROOT, "lib", "nativeAudio"));
  const base = { song: "/tmp/song.wav", prompt: "@vera sings on the pier", imgMeta: [], audMeta: [],
                 frame: { file: "/tmp/prev_last.png", name: "prev_last.png", label: "scene 1's last frame" }, n: 2 };
  const flLast = { file: "/tmp/fl_last.png", name: "fl_last.png", label: "asset: pier.png" };
  const fi = NA.plan({ ...base, anchor: "first", flLast });
  check("First + a chosen LAST frame: fl2va from the frame TO the last frame",
    fi.mode === "fl2va" && J(fi.files) === J(["/tmp/prev_last.png", "/tmp/fl_last.png"])
    && fi.notes.some((x) => /fl2va \(First\): from scene 1's last frame to the chosen last frame \(asset: pier\.png\)/.test(x)), fi);
  const f0 = NA.plan({ ...base, anchor: "first" });
  check("First without one: starts on the frame only (unchanged)", J(f0.files) === J(["/tmp/prev_last.png"]), f0.files);
  const co = NA.plan({ ...base, anchor: "continue", flLast });
  check("Cont + a last frame: ref2va opens on <Picture 1> and ENDS on <Picture 2>",
    co.mode === "ref2va" && co.files[0] === "/tmp/prev_last.png" && co.files[1] === "/tmp/fl_last.png"
    && /opens exactly on <Picture 1>[\s\S]*The clip ends on <Picture 2>\./.test(co.prompt)
    && /the closing frame/.test(co.prompt), [co.files, co.prompt.slice(0, 500)]);
}

// ---- 4. the video docker in jsdom -------------------------------------------------------------
{
  const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM("<body>" + fs.readFileSync("ext/videodock/dock.html", "utf8") + "</body>",
  { url: "http://x/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
const posts = [];
const board = { chapters: ["Act One"], pending: [], plan: { shots: [] }, style: "MMH3_NativeAudio_MV", audio: "",
  list: [{ n: 1, id: "c1", chapter: "Act One", prompt: ["a"], status: "idle", anchor: "reference" },
         { n: 2, id: "c2", prompt: ["b"], status: "idle", anchor: "continue" }] };
w.fetch = (u, o) => {
  u = String(u); const bare = u.split("?")[0];
  if (o && o.method === "POST") posts.push(bare);
  const ok = (b) => Promise.resolve({ ok: true, json: () => Promise.resolve(b) });
  if (bare === "/api/scenes") return ok(board);
  if (bare === "/api/pmedia") return ok({ sound: [], images: [] });
  return ok({ ok: true, characters: [], environments: [], refs: {}, movies: [] });
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
w.eval(fs.readFileSync("ext/videodock/audioseg.js", "utf8"));
const q = (s) => w.document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const out = {};
  w.document.dispatchEvent(new w.CustomEvent("vd:scenes-changed"));
  await wait(300);
  out.chapSelects = w.document.querySelectorAll("[data-scchap]").length;
  out.title1 = q('[data-sc="1"]').textContent.includes("Scene 1 · Act One");
  out.slots = [1, 2].map((n) => [...w.document.querySelectorAll('[data-scfl="' + n + '"]')].map((x) => x.dataset.slot));
  const menu = q("#mvLoadMenu");
  out.closed0 = menu.style.display;
  out.inMenu = !!q("#mvLoadMenu #vdLoadAudio") && !!q("#mvLoadMenu #mvLoadMovie") && !!q("#mvBar #mvLoad");
  q("#mvLoad").click(); await wait(20);
  out.open = menu.style.display; out.exp = q("#mvLoad").getAttribute("aria-expanded");
  out.movieName = q("#mvLoadMovieName").textContent;
  w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape" })); await wait(20);
  out.escClosed = menu.style.display;
  q("#mvLoad").click(); await wait(20);
  let picked = 0; q("#vdAudioFile").click = () => { picked++; };
  q("#vdLoadAudio").click(); await wait(20);
  out.picked = picked; out.afterSong = menu.style.display;
  q("#mvLoad").click(); await wait(20);
  posts.length = 0;
  q("#mvLoadMovie").click(); await wait(50);
  out.moviePosts = posts.filter((u) => u === "/api/movies/load").length;
  out.afterMovie = menu.style.display;
  q("#mvLoad").click(); await wait(20);
  w.document.body.click(); await wait(20);
  out.outsideClosed = menu.style.display;
  console.log("@@GP " + JSON.stringify(out));
  process.exit(0);
})();`;
  let d = null;
  try {
    const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
    const line = o.split("\n").find((l) => l.startsWith("@@GP "));
    d = line ? JSON.parse(line.slice(5)) : { raw: o.slice(-600) };
  } catch (e) { d = { error: String(e.message).slice(0, 600) }; }
  check("jsdom: no scene card carries a chapter dropdown; the chapter still shows in the title",
    d && d.chapSelects === 0 && d.title1 === true, d);
  check("jsdom: every scene has a LAST frame slot - Ref: Last only, Cont: First + Last",
    d && J(d.slots) === '[["last"],["first","last"]]', d && d.slots);
  check("jsdom: 📂 Load in the menubar holds the menu - 🎬 Movie and 🎵 A song from disk (the old 🎵 button moved in)",
    d && d.inMenu === true && d.closed0 === "none", d);
  check("jsdom: 📂 Load opens the menu (aria-expanded) and names what Movie would load; Escape closes it",
    d && d.open === "flex" && d.exp === "true" && /pick one in the list first/.test(d.movieName) && d.escClosed === "none", d);
  check("jsdom: 🎵 A song opens the file picker (a song from anywhere) and closes the menu",
    d && d.picked === 1 && d.afterSong === "none", d);
  check("jsdom: 🎬 Movie with no movie picked posts nothing; a click outside closes the menu",
    d && d.moviePosts === 0 && d.afterMovie === "none" && d.outsideClosed === "none", d);
}

// ---- 5. wiring --------------------------------------------------------------------------------
{
  const RC = read("routes", "characters.js"), RI = read("routes", "index.js"), SG = read("ext", "videodock", "audioseg.js");
  check("every location route rebuilds the global prompt's location block (save, pano, pano-from, delete)",
    (RC.match(/\.\.\.locSync\(/g) || []).length === 4
    && RC.includes("locationPrefix.sync(project, { scenes, screenplay, chars, envs, chapterRefs })"));
  check("every buildPrefix call hands the set locations in",
    (RC.match(/buildPrefix\(/g) || []).length === (RC.match(/locations: locationPrefix\.lines\(envs\.list\(/g) || []).length
    && RI.includes('locations: require("../lib/locationPrefix").lines(envsLib.list(b.project))'));
  check("the writer reads the global prompt FIRST (right after the rules) on every board, said in X-Global-Prompt",
    RC.includes('res.set("X-Global-Prompt", globalFirst ? "1" : "0");')
    && /: screenplay\.guide\(cast, envs\.list\(b\.project\)\)\)\s*\+ globalFirst/.test(RC)
    && RC.includes("? mvWriter.globalNote(savedPrefix || writerPrefix, wMode)")
    && RC.includes(': nativeAdd ? mvWriter.globalNote(plan.prompt_prefix, addMode) : "")'));
  check("a song is COPIED into the active project - loading the same song again reuses the copy",
    RI.includes("fs.readFileSync(have).equals(req.file.buffer)") && RI.includes("existed: true")
    && SG.includes("copied into this project's sound assets"));
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
