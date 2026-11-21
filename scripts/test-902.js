// bitGen Studio 2.902.0 - PAN 2's JSON caption never reaches another model (Tim: "new videos are getting old video prompts
// mixed with the new prompt" ... "it happened after a render with pan 2. maybe it is loading the json prompt as well?").
// lib/pan2.js stripCaption / captionWords, the routes that use it, static/pan2gen.js follow(). Run: node scripts/test-902.js
"use strict";
const fs = require("fs"), path = require("path");
let ok = 0, fail = 0;
const check = (n, c, x) => { if (c) { ok++; console.log("ok   ", n); } else { fail++; console.log("FAIL ", n, x === undefined ? "" : JSON.stringify(x)); } };
const P = require("../lib/pan2");
const capObj = { video_style: "Realistic film.", lighting: "Soft.", perspective_view: "Eye level.", subjects_lifecycle: [], init_frame_visual_description: "A terrier on the sand.",
  events: [{ event_index: 0, time_range_sec: "0 to 5", event_description: "The terrier runs to the water.", camera_motion: [{ time_range_sec: "0 to 5", camera_motion: "static" }], contained_actions: [] },
           { event_index: 1, time_range_sec: "5 to 10", event_description: "It shakes off the water.", camera_motion: [{ time_range_sec: "5 to 10", camera_motion: "static" }], contained_actions: [] }],
  quality: { video_quality: "high" } };
const cap = JSON.stringify(capObj, null, 2);

let r = P.stripCaption("A woman sings in the rain.\n\n" + cap);
check("words + the old caption: the caption taken out, the new words kept", r.removed === 1 && r.text === "A woman sings in the rain." && !r.converted, r);
r = P.stripCaption(cap + "\nA woman sings in the rain.");
check("the caption first, the words after: the words kept", r.text === "A woman sings in the rain." && r.removed === 1, r);
r = P.stripCaption(cap);
check("only a caption: its own words (look, first frame, each event)", r.converted && r.text === "Realistic film. A terrier on the sand. The terrier runs to the water. It shakes off the water.", r);
r = P.stripCaption(JSON.stringify({ refined_prompt: JSON.stringify(capObj) }) + " then a woman sings");
check("PAN 2's {refined_prompt: ...} wrapper caught too", r.removed === 1 && r.text === "then a woman sings", r);
r = P.stripCaption("```json\n" + cap + "\n```\nA woman sings.");
check("a fenced caption: the fence goes with it", r.removed === 1 && r.text === "A woman sings.", r);
for (const t of ["A woman says \"{hello}\" to <Picture 1>.", 'Settings {"a": 1, "events": []}', "Braces { not closed", "", "plain words"]) {
  const x = P.stripCaption(t);
  check("left alone (no PAN 2 caption): " + JSON.stringify(t).slice(0, 40), x.removed === 0 && x.text === t, x);
}
r = P.stripCaption('A "quoted } brace" then ' + cap);
check("braces inside a string do not end the scan early", r.removed === 1 && r.text === 'A "quoted } brace" then', r);
check("captionWords of a caption", P.captionWords(capObj) === "Realistic film. A terrier on the sand. The terrier runs to the water. It shakes off the water.");

const R = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const ix = R("routes/index.js");
check("/api/generate takes a caption out (H3, Wan, the API styles) and says so in the job's log + notes",
  /let pan2Note = "";[\s\S]{0,400}stripCaption\(prompt\)/.test(ix) && /job\.log\.push\("\[bitgen-studio\] " \+ pan2Note\)/.test(ix) && /const notes = \[pan2Note,/.test(ix));
check("…before the camera path / speech formatting see the prompt", ix.indexOf("stripCaption(prompt)") < ix.indexOf("camPlan.parse(f.camera)") && ix.indexOf("stripCaption(prompt)") < ix.indexOf("vs.formatSpeech(prompt"));
check("/api/genimage and /api/ltx take it out too", /app\.post\("\/api\/genimage"[\s\S]{0,400}stripCaption/.test(ix) && /stripCaption\(String\(b\.prompt/.test(R("routes/ltx.js")));
check("/api/pan2 itself keeps the caption (PAN 2's own prompt)", !/stripCaption/.test(R("routes/pan2.js")));

// the page: pan2gen in a stand-in page
const store = {}, els = {}, listeners = {};
const mk = (id, value) => (els[id] = { id, value, parentNode: { insertBefore() {} }, addEventListener(t, f) { (listeners[id + t] = listeners[id + t] || []).push(f); }, dispatchEvent() {} });
mk("prompt", ""); mk("videoStyleSel", "pan"); mk("genModeSel", "video");
global.window = { document: { getElementById: (id) => els[id] || null, readyState: "loading", addEventListener() {}, createElement: () => mk("x" + Math.random(), "") },
  localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } }, logLine() {} };
global.videoStyles = [{ id: "pan", arch: "pan2" }, { id: "h3", arch: "minimax-h3" }];
global.Event = function (t) { this.type = t; };
new Function("window", "videoStyles", R("static/pan2gen.js"))(global.window, global.videoStyles);
const G = global.window.H3Pan2Gen;
G.follow();                                                       // starts on PAN 2
store["h3.pan2.words"] = JSON.stringify({ caption: cap, words: "a brown terrier runs on the beach" });
els.prompt.value = cap;
els.videoStyleSel.value = "h3"; G.follow();
check("page: leaving PAN 2 puts your words back in place of the JSON", els.prompt.value === "a brown terrier runs on the beach", els.prompt.value.slice(0, 60));
els.videoStyleSel.value = "pan"; G.follow();
check("page: back to PAN 2 with the same words - the same JSON back (no new LLM call)", els.prompt.value === cap);
els.genModeSel.value = "image"; G.follow();
check("page: the Image mode counts as leaving PAN 2", els.prompt.value === "a brown terrier runs on the beach");
els.genModeSel.value = "video"; G.follow(); els.videoStyleSel.value = "h3"; G.follow();
els.prompt.value = JSON.stringify(Object.assign({}, capObj, { events: [capObj.events[0]] }));   // an edited / pasted caption
els.videoStyleSel.value = "pan"; G.follow(); els.videoStyleSel.value = "h3"; G.follow();
check("page: a caption with no words kept becomes its own words", els.prompt.value === "Realistic film. A terrier on the sand. The terrier runs to the water.", els.prompt.value);
els.prompt.value = "a new idea"; els.videoStyleSel.value = "pan"; G.follow();
check("page: back on PAN 2 with OTHER words - left as typed", els.prompt.value === "a new idea");

console.log(`\nRESULT: ${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
