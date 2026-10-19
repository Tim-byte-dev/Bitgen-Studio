#!/usr/bin/env node
/* bitGen Studio — 2.456.0 units: THE STORYBOARD (lib/storyboard.js, routes/storyboard.js, ext/videodock/storyboard.js):
 * the picture prompt, the reference pictures chosen (character sheets / locations the prompt names, the scene's and
 * the project's references), the client's pure parts, the wiring. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const SB = require(path.join(ROOT, "lib", "storyboard.js")), C = require(path.join(ROOT, "ext", "videodock", "storyboard.js"));
const row = { n: 1, id: "clip_01", prompt: ["Mara walks into the Neon Market at night,", "  rain on the stalls  "], refs: [{ file: "pose.png" }] };
check("promptFor: the scene's prompt lines as one picture prompt", SB.promptFor(row) === "Mara walks into the Neon Market at night, rain on the stalls" && SB.promptFor({ prompt: [] }) === "");
const media = [
  { rel: "characters/c1/front.png", group: "Characters · Mara", name: "front.png" }, { rel: "characters/c1/mara_sheet.png", group: "Characters · Mara", name: "mara_sheet.png" },
  { rel: "characters/c1/extra.png", group: "Characters · Mara", name: "extra.png" }, { rel: "characters/c2/sheet.png", group: "Characters · Jon", name: "sheet.png" },
  { rel: "environments/neon-market/view_1.png", group: "Locations · Neon Market", name: "view_1.png" }, { rel: "environments/roof/view.png", group: "Locations · Rooftop", name: "view.png" },
  { rel: "reference/style.png", group: "References", name: "style.png" }, { rel: "images/other.png", group: "Assets", name: "other.png" }];
const all = SB.pickRefs(row, media, {});
check("pickRefs: the sheets of the characters the prompt NAMES (a sheet first, 2 at most), the pictures of the locations it names, the scene's own pictures, the project's References - not the others",
  JSON.stringify(all) === JSON.stringify(["characters/c1/mara_sheet.png", "characters/c1/front.png", "environments/neon-market/view_1.png", "scene_refs/clip_01/pose.png", "reference/style.png"]), all);
check("pickRefs: each kind can be left out (☐ Character sheets / ☐ Locations / ☐ Reference images); at most MAX_REFS",
  JSON.stringify(SB.pickRefs(row, media, { sheets: false, locations: false })) === JSON.stringify(["scene_refs/clip_01/pose.png", "reference/style.png"])
  && SB.pickRefs(row, media, { refs: false }).every((r) => !/reference|scene_refs/.test(r)) && SB.MAX_REFS === 8
  && SB.pickRefs({ n: 2, prompt: ["Jonathan sleeps"] }, media, {}).every((r) => !/c2\//.test(r)));
const it = { n: 3, rel: "storyboard/clip_03.png", at: 5 };
check("the client: → First / → Last post the scene's own slot with the storyboard picture (kind project); the thumbnail box: the picture + 🖼 ↻ / → First / → Last / ✕, or an empty frame + 🖼 make",
  JSON.stringify(C.slotBody(it, "last")) === '{"slot":"last","kind":"project","rel":"storyboard/clip_03.png"}' && C.slotBody(it, "x").slot === "first"
  && /api\/storyboard\/3\/thumb/.test(C.thumbHtml(3, it, false)) && /data-sbfirst="3"/.test(C.thumbHtml(3, it, false)) && /data-sbdel="3"/.test(C.thumbHtml(3, it, false))
  && /no picture/.test(C.thumbHtml(3, null, false)) && /🖼 make/.test(C.thumbHtml(3, null, false)) && /making/.test(C.thumbHtml(3, null, true)));
const IX = read("routes", "index.js"), RT = read("routes", "storyboard.js"), EXT = JSON.parse(read("ext", "videodock", "ext.json")), CL = read("ext", "videodock", "storyboard.js"), SRV = fs.existsSync(path.join(ROOT, "server.js")) ? read("server.js") : "";
check("wiring: routes/storyboard.js mounted from routes/index.js (not server.js) - GET /api/storyboard, POST plan / fromjob / clear, GET thumb; the video docker extension is \"StoryBoard\" and loads storyboard.js; the client renames the header + status button, floats it through H3Panels (sb.dock), makes the picture with /api/genimage",
  /require\("\.\/storyboard"\)\.mount\(app\)/.test(IX) && !/storyboard/.test(SRV) && ["/api/storyboard/:n/plan", "/api/storyboard/:n/fromjob", "/api/storyboard/:n/clear", "/api/storyboard/:n/thumb"].every((u) => RT.includes(u))
  && EXT.name === "StoryBoard" && EXT.scripts[EXT.scripts.length - 1] === "storyboard.js" && /b\.textContent = "StoryBoard"/.test(CL) && /P\.adopt\(\{ id: "sb\.dock"/.test(CL) && /post\("\/api\/genimage", body\)/.test(CL));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
