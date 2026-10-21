#!/usr/bin/env node
/* bitGen Studio — 2.565.0 units: the StoryBoard grid (ext/videodock/sbgrid.js) and 🎞 Write storyboard / ☑ Start on it
 * (ext/videodock/storyboard.js).
 * Tim: "can u make the llm generate a storyboard instead of just scenes - i give it reference images and it creates
 * pictures for the storyboard that i can use as the starting reference image - we can change this image if needed. the
 * scene text will go into a card like our model manager - the thumbnails will be in a grid format with arrows pointing to
 * the next scene. keep all the other features in our storyboard scenes". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const G = require(path.join(ROOT, "ext", "videodock", "sbgrid.js"));

check("state: ⏳ rendering n% / ✕ failed / ✔ kept / ● rendered / nothing",
  G.state({ status: "running", progress: { pct: 41.6 } }).word === "rendering 42%" && G.state({ status: "idle", error: "boom" }).mark === "✕" && G.state({ status: "kept" }).mark === "✔"
  && G.state({ status: "rendered", error: "old" }).mark === "●" && G.state({ status: "idle" }).mark === "");
check("text: the scene's lines without their [Shot n] heads", G.text({ prompt: ["[Shot 1] Mara runs.", "  ", "[Cam] Wide."] }) === "Mara runs. Wide.");
const r = { n: 3, chapter: "act-1", prompt: ["[Shot 3] Mara <b>climbs</b>"], status: "rendered", output: "s3.mp4", updated: "t1" };
const c1 = G.cardHtml(r, { n: 3, at: 99 }, { sel: true }), c2 = G.cardHtml({ n: 4, prompt: [], fl_first: { file: "fl_first.png" }, updated: "u" }, null, {}), c3 = G.cardHtml({ n: 5, prompt: ["x"], status: "running" }, null, { busy: true });
check("cardHtml: a Model-manager-like card - its storyboard picture on top (else its First frame, else its number), Scene n + chapter + its state, its text (escaped), 🖼 / ↻ 🖼, ▶ / ↻ ▶, → First with a picture",
  /class="sbgcard sel" data-sbg="3"/.test(c1) && /background-image:url\('\/api\/storyboard\/3\/thumb\?v=99'\)/.test(c1) && /Scene 3 <span class="ch">· act-1<\/span>/.test(c1) && /title="rendered">●/.test(c1)
  && /Mara &lt;b&gt;climbs&lt;\/b&gt;/.test(c1) && /data-sbgmake="3"[^>]*>↻ 🖼/.test(c1) && /data-sbgplay="3"[^>]*>↻ ▶/.test(c1) && /data-sbgfirst="3"/.test(c1)
  && /\/api\/scenes\/4\/fl\/first\?v=u/.test(c2) && !/data-sbgfirst/.test(c2) && /no text/.test(c2) && /<span>⏳<\/span>/.test(c3) && /data-sbgplay="5" disabled/.test(c3), { c1, c2 });
const rows = [{ n: 1, prompt: ["a"] }, { n: 2, prompt: ["b"] }, { n: 3, prompt: ["c"] }];
const g = G.gridHtml(rows, new Map([[2, { n: 2, at: 1 }]]), { sel: "2", busy: (n) => n === 3 });
check("gridHtml: the cards in order with an ➜ between each two (not after the last); the picked one marked; busy shown; no scenes = how to start",
  (g.match(/class="sbgcard/g) || []).length === 3 && (g.match(/class="sbgarr"/g) || []).length === 2 && /title="then scene 2">➜/.test(g) && /title="then scene 3">➜/.test(g) && !/then scene 4/.test(g)
  && /class="sbgcard sel" data-sbg="2"/.test(g) && /data-sbgmake="3" disabled/.test(g) && /🎞 Write storyboard/.test(G.gridHtml([], new Map(), {})));

const SG = rd("ext", "videodock", "sbgrid.js"), SB = rd("ext", "videodock", "storyboard.js"), CH = rd("ext", "videodock", "characters.js"), EXT = JSON.parse(rd("ext", "videodock", "ext.json"));
check("the grid: ▦ / ☰ on the StoryBoard bar (kept per browser, the grid the default); a click picks the scene (the picker shows its full card under it); the list hidden while none is picked; ✕ closes",
  /data-sbview="grid"/.test(SG) && /LS\("view", "grid"\) === "list" \? "list" : "grid"/.test(SG) && /s\.dispatchEvent\(new root\.Event\("change"\)\)/.test(SG) && /#videodock\.sb-grid #scList\.sbg-none\{display:none\}/.test(SG)
  && /dh\.querySelector\("button"\)\.onclick = \(\) => pick\(null\)/.test(SG) && EXT.scripts[EXT.scripts.length - 1] === "sbgrid.js" && EXT.scripts.indexOf("storyboard.js") === EXT.scripts.length - 2);
check("the card's buttons: 🖼 = H3Story.make, → First = useAs(first, anchor), ▶ = the scene card's own ▶ (all its rules)",
  /H\.make\(\+b\.dataset\.sbgmake\)/.test(SG) && /H\.useAs\(\+b\.dataset\.sbgfirst, "first", \{ anchor: true \}\)/.test(SG) && /#scList \[data-scplay="\$\{b\.dataset\.sbgplay\}"\]/.test(SG));
check("storyboard.js: ☑ Start on it (on by default) - a made picture becomes the FIRST frame, a Ref scene turns First; 🎞 Write storyboard = the screenplay writer, then every scene's picture",
  /autoFirst: true/.test(SB) && /if \(opts\.autoFirst\) await useAs\(n, "first", \{ anchor: true, quiet: true \}\)/.test(SB) && /if \(!row \|\| !row\.anchor \|\| row\.anchor === "reference"\) await post\(`\/api\/scenes\/\$\{n\}\/anchor`, \{ anchor: "first" \}\)/.test(SB)
  && /root\.bgScenes\.maybeScreenplay\(/.test(SB) && /await allMissing\(\);\s*return msg;/.test(SB) && /id="sbWrite"/.test(SB) && /if \(H3Story\.onPaint\)/.test(SB));
check("characters.js hands the board to the grid (bgScenes.state)", /state: function \(\) \{ return scState; \}/.test(CH));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
