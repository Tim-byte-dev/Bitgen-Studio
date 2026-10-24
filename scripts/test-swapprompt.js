#!/usr/bin/env node
/* bitGen Studio — 2.335.0: ✎ WRITE PROMPT for the character swap.
 * Run: node scripts/test-swapprompt.js
 * Tim: "can you teach the llm how to write a prompt for the character swap,
 * the vllm can describe the picture the llm can make the prompt, add a button
 * under the prompt input in the character swap dialog Write Prompt".
 *   1. the guide (lib/promptGuides.json minimax_h3_swap) - taught, never
 *      picked for a normal render, overridable by id;
 *   2. lib/swapPrompt: parsePerformer, clean, compose, messages;
 *   3. write() end to end with fake models (vision ok / vision down / LLM
 *      down / LLM rambles / both down);
 *   4. lib/swap.promptFor sends a WHOLE swap prompt as it is;
 *   5. wiring: the route in routes/swapdlg.js (never server.js), captioner's
 *      per-picture question, the dialog's button. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 400) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const SP = require(path.join(ROOT, "lib", "swapPrompt"));
const PG = require(path.join(ROOT, "lib", "promptGuides"));
const SW = require(path.join(ROOT, "lib", "swap"));

// ---- 1. the guide
const all = PG.load(null);
const g = all.find((x) => x.id === "minimax_h3_swap");
check("the swap guide ships: kind 'swap', no match words, 8 rules + an example",
  g && g.kind === "swap" && Array.isArray(g.match) && g.match.length === 0 && g.rules.length >= 8 && g.example);
check("it teaches the tags, the LoRA's opening line, the identity sentence, the performance, the closing line",
  g && /<Video 1>/.test(g.rules[0]) && /<Picture 1>/.test(g.rules[0]) && /Never write <Image 1>/.test(g.rules[0])
  && g.rules.some((r) => r.includes("'Replace only <who> in <Video 1> with the character in <Picture 1>.'"))
  && g.rules.some((r) => r.includes("identity, outfit, and art style from <Picture 1>"))
  && g.rules.some((r) => /lip movement/.test(r))
  && g.rules.some((r) => r.includes("Preserve the source video's camera, background, lighting, objects, and all other people.")));
check("its example IS a swap prompt of that shape", g && SP.isFullPrompt(g.example) && g.example.startsWith("Replace only ")
  && SP.clean(g.example) === g.example);
check("a normal H3 render still gets the plain H3 guide (the swap guide is never picked by name)",
  (PG.pick(all, { kind: "video", arch: "minimax-h3", model: "minimax_h3_ref2va_pruned_int8_convrot.safetensors" }) || {}).id === "minimax_h3"
  && (PG.pick(all, { kind: "video", arch: "", model: "h3_character_swap_pro4500_1000" }) || {}).id === "minimax_h3");
check("guide(): the rendered block (rules + example)", /^PROMPTING GUIDE — MiniMax H3 character swap/.test(SP.guide(null))
  && SP.guide(null).includes("Example of a good prompt for it:"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "swp-"));
fs.writeFileSync(path.join(tmp, "prompt-guides.json"), JSON.stringify({ guides: [
  { id: "minimax_h3_swap", kind: "swap", label: "MY SWAP RULES", match: [], rules: ["always say banana"], example: "x" }] }));
check("styles/prompt-guides.json replaces it by id (Tim can re-teach it without touching lib/)",
  /MY SWAP RULES/.test(SP.guide(tmp)) && /always say banana/.test(SP.guide(tmp)));

// ---- 2. the pieces
let p = SP.parsePerformer("COUNT: 2\nMAIN: the man in the purple shirt on the left\nSCENE: a sunny street, hard noon light.");
check("parsePerformer: the COUNT / MAIN / SCENE form", p.count === 2 && p.main === "the man in the purple shirt on the left"
  && p.scene === "a sunny street, hard noon light.", p);
p = SP.parsePerformer("**COUNT:** 1\n**MAIN:** woman in a red dress, centre.\n**SCENE:** a bar.");
check("parsePerformer: markdown bold, no article -> 'the ...', no trailing dot", p.count === 1 && p.main === "the woman in a red dress, centre", p);
p = SP.parsePerformer("A tall man in a grey suit stands in an office. He is talking.");
check("parsePerformer: a model that ignores the form still gives a usable MAIN (its first sentence, article lower-cased)",
  p.count === null && p.main === "a tall man in a grey suit stands in an office", p);
check("parsePerformer: nothing -> empty", SP.parsePerformer("").main === "" && SP.parsePerformer(null).count === null);

const rude = "<think>They want {a swap}. Tags: <Video 1>.</think>\nHere is the prompt:\n```\nReplace only the man in <Video 1> "
  + "with the character in <Image 1>. Keep the replacement character's identity, outfit, and art style from <Picture 1>: a red fox.\n"
  + "Preserve the source video's camera.\n```\n\nHope this helps!";
const cl = SP.clean(rude);
check("clean: think block, lead-in, fence, sign-off gone; <Image 1> -> <Picture 1>",
  cl.startsWith("Replace only the man in <Video 1> with the character in <Picture 1>.") && cl.endsWith("Preserve the source video's camera.")
  && !/think|```|Hope|Here is/.test(cl), cl);
check("clean: a quoted answer and a 'Prompt:' label", SP.clean('Prompt: "Replace only the woman in <video 1> with the character in <picture 1>."')
  === "Replace only the woman in <Video 1> with the character in <Picture 1>.");
check("clean: an answer that is not a swap prompt -> ''", SP.clean("Sure! What would you like to swap?") === ""
  && SP.clean("Replace the man with a fox.") === "");
check("clean: capped at the Direction box's 1500 characters, on a sentence end",
  SP.clean("Replace only the man in <Video 1> with the character in <Picture 1>. " + "A long detail sentence here. ".repeat(80)).length <= 1500);

const cp = SP.compose({ character: "A young woman with a silver bob, black leather jacket.", performer: { main: "the man in the purple shirt" }, wishes: "keep his red cap" });
check("compose: the guide's shape from the descriptions (+ the wishes)",
  cp.startsWith("Replace only the man in the purple shirt in <Video 1> with the character in <Picture 1>. Keep the replacement character's identity, outfit, and art style from <Picture 1>: a young woman with a silver bob, black leather jacket.")
  && cp.includes("lip movement from <Video 1>") && cp.includes("and all other people.") && cp.endsWith("keep his red cap."), cp);
check("compose: nothing known -> 'the main person', no dangling colon", SP.compose({}).startsWith("Replace only the main person in <Video 1>")
  && SP.compose({}).includes("art style from <Picture 1>. Retain"));

let m = SP.messages({ guide: "GUIDE-BLOCK", character: "a fox in a raincoat", performer: { count: 3, main: "the man in the purple shirt", scene: "a street" }, wishes: "photoreal please" });
check("messages: system = the swap role + the guide + 'the prompt ONLY'; user = the character, the performer, the count, the wishes",
  m.length === 2 && m[0].role === "system" && m[0].content.includes("GUIDE-BLOCK") && /prompt ONLY/.test(m[0].content)
  && m[1].content.startsWith("Write the character-swap prompt.") && m[1].content.includes("a fox in a raincoat")
  && m[1].content.includes("main performer: the man in the purple shirt") && m[1].content.includes("people visible: 3")
  && m[1].content.includes("THE USER'S OWN WISHES") && m[1].content.includes("photoreal please"), m);
m = SP.messages({ character: "", performer: {}, wishes: "Replace only the man in <Video 1> with the character in <Picture 1>. Keep his red cap." });
check("messages: no description = told not to invent looks; a previous whole prompt is REWRITTEN, keeping its wishes",
  /could not be described - refer to it only as "the character in <Picture 1>"/.test(m[1].content)
  && /call the performer "the main person"/.test(m[1].content) && m[1].content.includes("THE USER'S PREVIOUS PROMPT"));

// ---- 3. write() end to end with fake models
function deps(o) {
  const seen = { describe: null, complete: null };
  return { seen, d: {
    guide: "GUIDE",
    describe: async (files) => { seen.describe = files; if (o.visionErr) throw new Error(o.visionErr); return o.descs || []; },
    complete: async (opts) => { seen.complete = opts; return o.llm || { ok: false, error: "no LLM" }; },
  } };
}
(async () => {
  let x = deps({ descs: ["A red fox in a yellow raincoat, 3D render.", "COUNT: 1\nMAIN: the man in the purple shirt\nSCENE: a street"],
                 llm: { ok: true, text: rude } });
  let r = await SP.write(x.d, { picture: { path: "/p/char.png" }, frame: { buffer: Buffer.from("jpg"), mimetype: "image/jpeg" }, wishes: "keep his cap", llm_file: "g.gguf" });
  check("write: the vision model is asked TWO questions - the character (CHARACTER_Q) then the frame (PERFORMER_Q)",
    x.seen.describe.length === 2 && x.seen.describe[0].prompt === SP.CHARACTER_Q && x.seen.describe[0].path === "/p/char.png"
    && x.seen.describe[1].prompt === SP.PERFORMER_Q && x.seen.describe[1].mimetype === "image/jpeg");
  check("write: the LLM gets both descriptions + the wishes + the guide, the chosen LLM file",
    x.seen.complete.llm_file === "g.gguf" && x.seen.complete.messages[0].content.includes("GUIDE")
    && x.seen.complete.messages[1].content.includes("A red fox in a yellow raincoat")
    && x.seen.complete.messages[1].content.includes("main performer: the man in the purple shirt")
    && x.seen.complete.messages[1].content.includes("keep his cap"));
  check("write: the LLM's cleaned prompt comes back, described + framed, no notes",
    r.prompt === cl && !r.fallback && r.described && r.framed && r.performer.main === "the man in the purple shirt" && r.notes.length === 0, r);

  x = deps({ visionErr: "no vision model selected — pick one", llm: { ok: true, text: rude } });
  r = await SP.write(x.d, { picture: { path: "/p/c.png" }, frame: null, wishes: "" });
  check("write: no vision model -> the LLM still writes it (told not to invent looks), the note says why",
    r.prompt === cl && !r.described && !r.framed && /not described - no vision model selected/.test(r.notes[0])
    && /could not be described/.test(x.seen.complete.messages[1].content), r.notes);

  x = deps({ descs: ["A red fox in a yellow raincoat."], llm: { ok: false, error: "LLM returned 500" } });
  r = await SP.write(x.d, { picture: { path: "/p/c.png" }, wishes: "photoreal" });
  check("write: the LLM down -> composed from the picture's description, said",
    r.fallback && r.prompt.includes("a red fox in a yellow raincoat.") && r.prompt.endsWith("photoreal.")
    && /LLM did not answer - LLM returned 500/.test(r.notes.join(" ")), r);

  x = deps({ descs: ["A robot."], llm: { ok: true, text: "Sure! What a fun idea." } });
  r = await SP.write(x.d, { picture: { path: "/p/c.png" } });
  check("write: the LLM rambles (no tags) -> composed, said", r.fallback && SP.isFullPrompt(r.prompt)
    && /was not a swap prompt/.test(r.notes.join(" ")));

  x = deps({ visionErr: "vision down", llm: { ok: false, error: "LLM down" } });
  let err = null;
  try { await SP.write(x.d, { picture: { path: "/p/c.png" } }); } catch (e) { err = e; }
  check("write: both models down -> an error in words (502), never an empty box",
    err && err.status === 502 && /vision down/.test(err.message) && /LLM down/.test(err.message));

  // ---- 4. lib/swap.promptFor
  const whole = "Replace only the man in <Video 1> with the character in <Image 1>. Keep his cap.";
  check("promptFor: a WHOLE swap prompt is sent as it is (tags fixed) - the template stays out",
    SW.promptFor(whole) === "Replace only the man in <Video 1> with the character in <Picture 1>. Keep his cap."
    && SW.isFullPrompt(whole) && !SW.isFullPrompt("she smiles"));
  check("promptFor: plain direction still rides under the template",
    SW.promptFor("she smiles").startsWith(SW.TEMPLATE) && SW.promptFor("she smiles").endsWith("Additional direction: she smiles"));

  // ---- 5. wiring
  const R = read("routes", "swapdlg.js");
  check("route: POST /api/swapdlg/writeprompt in routes/swapdlg.js (never server.js), one at a time, the answer saved as st.text",
    R.includes('app.post("/api/swapdlg/writeprompt"') && R.includes("swapPrompt.write(") && R.includes("fresh.text = out.prompt")
    && R.includes("if (writing) return res.status(409)") && !read("misc/server.js").includes("writeprompt"));
  check("route: the real models - captioner.describe + llmChat.complete + the swap guide from styles/",
    R.includes("describe: (files) => captioner.describe(core, files)") && R.includes("complete: (o) => llmChat.complete(core, o)")
    && R.includes("guide: swapPrompt.guide(core.STYLES_DIR)"));
  check("route: the frame at t is cut by ffmpeg (the VR virtual camera's view when VR is on)",
    R.includes("function frameAt(st, t)") && R.includes('SS.vrFlatVf(v.mode, "L", v, sz.width, sz.height)'));
  const C = read("lib", "captioner.js");
  check("captioner: a picture may carry its own question and budget", C.includes("text: f.prompt ? String(f.prompt) : DESCRIBE_PROMPT"));
  const D = read("static", "swapdlg.js");
  check("dialog: ✎ Write prompt under the Direction box, posting t + the text + the LLM",
    /class="swText"[^\n]*\n\s*\+ '<button type="button" class="ghost gbtn swWrite"/.test(D)
    && D.includes('jpost("/api/swapdlg/writeprompt", { t: t, text: box.value, llm_file:'));
  check("index.html hands the dialog the prompt docker's LLM", read("static", "index.html").includes('llmFile: () => ($("llmSel") ? $("llmSel").value : "")'));
})().then(() => {
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}).catch((e) => { console.log("FAIL: crashed " + e.stack); process.exit(1); });
