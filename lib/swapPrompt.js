"use strict";
/**
 * swapPrompt.js — ✎ WRITE PROMPT for the character swap (2.335.0).
 *
 * Tim: "can you teach the llm how to write a prompt for the character swap,
 * the vllm can describe the picture the llm can make the prompt, add a button
 * under the prompt input in the character swap dialog Write Prompt".
 *
 * THE FLOW (routes/swapdlg.js POST /api/swapdlg/writeprompt runs it):
 *   1. the VISION model (lib/captioner) looks at two pictures with questions
 *      of their own: the NEW CHARACTER (CHARACTER_Q - identity details only,
 *      no background) and one FRAME of the video at the box (PERFORMER_Q -
 *      who the main performer is, in words that single them out: "the man in
 *      the purple shirt on the left");
 *   2. the LLM gets the SWAP GUIDE (lib/promptGuides.json id
 *      "minimax_h3_swap", kind "swap" - a user override in
 *      styles/prompt-guides.json replaces it by id) + both descriptions + the
 *      user's own wishes (the Direction box) and writes ONE swap prompt;
 *   3. finish() cleans the reply (think blocks, fences, labels, quotes),
 *      fixes the tags (<Image n> -> <Picture n>) and, if the reply is not a
 *      swap prompt at all (no <Video 1> / <Picture 1>), composes one from the
 *      descriptions instead - the button never leaves a useless box.
 * The prompt goes into the Direction box. A text that names BOTH <Video 1>
 * and <Picture 1> is a WHOLE swap prompt: lib/swap.promptFor sends it as it
 * is (the built-in template stays out); anything else is still extra
 * direction under the template.
 *
 * No vision model / it fails: the LLM still writes the prompt from the
 * video frame's description (when that worked) and the user's wishes, and
 * the answer says the picture was not described and why.
 *
 * Pure except write(), whose describe / complete / guide come in as deps
 * (the route passes lib/captioner.describe + lib/llmChat.complete), so the
 * whole flow is unit-tested without a model (scripts/test-swapprompt.js).
 */
const promptGuides = require("./promptGuides");

const GUIDE_ID = "minimax_h3_swap";
const MAX_LEN = 1500;                 // lib/swap.MAX_TEXT / the dialog's box

const CHARACTER_Q =
  "This picture shows the NEW CHARACTER for a video character swap. Describe ONLY the character, "
  + "so another model can recreate them exactly: what they are (person, animal, creature, robot ...), "
  + "apparent age and gender presentation, body build, face (shape, eyes, nose, facial hair, makeup), "
  + "skin / fur / surface colour, hair (colour, length, style), every garment from top to bottom with "
  + "its colour, material and fit, footwear, accessories and anything they hold, and the ART STYLE of "
  + "the picture (photo, 3D render, anime, cartoon, painting ...). Ignore the background. One dense "
  + "paragraph, no preamble, no names.";

const PERFORMER_Q =
  "This is one frame of a video. Count the people (or characters) you can see. Then describe the MAIN "
  + "one - the most central or largest - in ONE short phrase that tells them apart from everyone else: "
  + "gender presentation, apparent age, a clothing colour and item, and where they are in the frame "
  + "(for example: the man in the purple shirt on the left). Then one sentence on the setting and the "
  + "light. Answer in exactly this form:\nCOUNT: <number>\nMAIN: <phrase>\nSCENE: <sentence>";

/** The COUNT / MAIN / SCENE answer -> {count, main, scene}. Tolerant: a
 *  model that ignores the form still gives a usable `main`. */
function parsePerformer(text) {
  const t = String(text || "").replace(/\r/g, "").trim();
  const grab = (k) => {
    const m = t.match(new RegExp("^\\s*[*_#-]*\\s*" + k + "\\s*[*_]*\\s*[:：]\\s*(.+)$", "im"));
    return m ? m[1].replace(/[*_]+/g, "").trim() : "";
  };
  const n = parseInt(grab("COUNT"), 10);
  let main = grab("MAIN"), scene = grab("SCENE");
  if (!main && t) main = t.split(/(?<=[.!?])\s+/)[0].slice(0, 160);
  main = main.replace(/^(the\s+)?main\s+(one|person|performer)\s+is\s+/i, "").replace(/[.;]+$/, "").trim();
  if (main && !/^(the|a|an)\s/i.test(main)) main = "the " + main;
  main = main.replace(/^(The|A|An)\s/, (w) => w.toLowerCase());
  return { count: Number.isFinite(n) && n >= 0 ? n : null, main: main.slice(0, 160), scene: scene.slice(0, 300) };
}

/** <Image n> -> <Picture n> (H3's tag; lib/swap.fixTags does the same). */
function fixTags(s) {
  return String(s == null ? "" : s).replace(/<\s*image\s+(\d+)\s*>/gi, (_m, n) => `<Picture ${n}>`);
}

/** A WHOLE swap prompt: it names the performance AND the character. */
function isFullPrompt(s) {
  const t = fixTags(s);
  return /<Video 1>/.test(t) && /<Picture 1>/.test(t);
}

/** The swap guide as a system block (the override file wins by id). */
function guide(stylesDir) {
  const g = promptGuides.load(stylesDir).find((x) => x && x.id === GUIDE_ID);
  return g ? promptGuides.render(g) : "";
}

/** The LLM's messages. o = {guide, character, performer:{count,main,scene},
 *  wishes, described (bool)}. */
function messages(o) {
  const x = o || {};
  const p = x.performer || {};
  const sys = [
    "You write CHARACTER-SWAP prompts for MiniMax H3 (reference-to-video) with the H3 Character Swap LoRA.",
    x.guide || "",
    "Answer with the prompt ONLY: no heading, no quotes, no explanation, no code fence.",
  ].filter(Boolean).join("\n\n");
  const lines = ["Write the character-swap prompt."];
  lines.push("", "THE NEW CHARACTER (<Picture 1>):",
    x.character ? x.character
      : "(the picture could not be described - refer to it only as \"the character in <Picture 1>\" and do not invent their looks)");
  lines.push("", "THE SOURCE VIDEO (<Video 1>):");
  if (p.main) {
    lines.push(`main performer: ${p.main}`);
    if (p.count != null) lines.push(`people visible: ${p.count}`);
    if (p.scene) lines.push(`scene: ${p.scene}`);
  } else lines.push("(no frame description - call the performer \"the main person\")");
  const w = String(x.wishes || "").trim();
  if (w) {
    lines.push("", isFullPrompt(w)
      ? "THE USER'S PREVIOUS PROMPT (rewrite it with the descriptions above; keep every wish it carries):"
      : "THE USER'S OWN WISHES (fold them in):", w.slice(0, MAX_LEN));
  }
  return [{ role: "system", content: sys }, { role: "user", content: lines.join("\n") }];
}

/** The performer phrase for the opening line. */
function who(p) { return (p && p.main) || "the main person"; }

/** A swap prompt built from the descriptions alone (the LLM's reply was not
 *  a swap prompt, or no LLM answered). Same shape the guide teaches. */
function compose(o) {
  const x = o || {};
  const c = String(x.character || "").trim().replace(/\s+/g, " ").replace(/[.\s]+$/, "");
  let s = `Replace only ${who(x.performer)} in <Video 1> with the character in <Picture 1>. `
    + "Keep the replacement character's identity, outfit, and art style from <Picture 1>"
    + (c ? `: ${c.charAt(0).toLowerCase() + c.slice(1)}.` : ".")
    + " Retain the full-body motion, timing, head turns, facial expressions and lip movement from <Video 1> exactly."
    + " Preserve the source video's camera, background, lighting, objects, and all other people.";
  const w = String(x.wishes || "").trim();
  if (w && !isFullPrompt(w)) s += ` ${w.replace(/[.\s]+$/, "")}.`;
  return trimTo(s, MAX_LEN);
}

/** Cut at a sentence end at or before n characters. */
function trimTo(s, n) {
  const t = String(s || "");
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const i = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"));
  return (i > n * 0.5 ? cut.slice(0, i + 1) : cut).trim();
}

/** The model's reply -> a clean prompt, or "" when it is not one. */
function clean(reply) {
  let t = String(reply == null ? "" : reply).replace(/\r/g, "");
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*<\/think>/i, "");
  const fence = t.match(/```[a-z]*\s*\n?([\s\S]*?)```/i);
  if (fence && isFullPrompt(fence[1])) t = fence[1];
  t = t.replace(/```[a-z]*/gi, "").trim();
  // "Here is the prompt:" / "Prompt:" lead-ins, and a sign-off after it
  t = t.replace(/^(here(?:'s| is)[^\n:]*:|(?:swap\s+)?prompt\s*:)\s*/i, "").trim();
  const lastTag = Math.max(t.lastIndexOf("<Video 1>"), t.lastIndexOf("<Picture 1>"));
  const tail = lastTag >= 0 ? t.slice(lastTag).search(/\n\s*\n/) : -1;
  if (tail > 0) {
    const after = t.slice(lastTag + tail).trim();
    if (/^(hope|let me know|feel free|i hope|this prompt|note:)/i.test(after)) t = t.slice(0, lastTag + tail).trim();
  }
  t = t.replace(/^["“'`]+|["”'`]+$/g, "").trim();
  t = fixTags(t).replace(/<\s*video\s+1\s*>/gi, "<Video 1>").replace(/<\s*picture\s+1\s*>/gi, "<Picture 1>");
  t = t.replace(/\n{3,}/g, "\n\n");
  return isFullPrompt(t) ? trimTo(t, MAX_LEN) : "";
}

/** The reply -> {prompt, fallback}. */
function finish(reply, o) {
  const p = clean(reply);
  return p ? { prompt: p, fallback: false } : { prompt: compose(o), fallback: true };
}

/**
 * The whole flow. deps = { describe(files) -> [texts], complete(opts) ->
 * {ok, text, error}, guide (text) }. input = { picture: {path}, frame:
 * {buffer, mimetype} | null, wishes, llm_file }. Never throws for a model
 * failure - it answers with what it could do and says why.
 * -> {prompt, fallback, character, performer, described, framed, notes[]}
 */
async function write(deps, input) {
  const d = deps || {}, x = input || {};
  const notes = [];
  let character = "", performer = { count: null, main: "", scene: "" };
  let described = false, framed = false;
  const files = [Object.assign({ prompt: CHARACTER_Q, max_tokens: 450, originalname: "the new character" }, x.picture || {})];
  if (x.frame) files.push(Object.assign({ prompt: PERFORMER_Q, max_tokens: 160, originalname: "a frame of the video" }, x.frame));
  try {
    const out = await d.describe(files);
    character = String((out || [])[0] || "").trim();
    if (/^\(the vision model returned nothing/i.test(character)) character = "";
    described = !!character;
    if (x.frame) {
      performer = parsePerformer((out || [])[1]);
      framed = !!performer.main;
    }
    if (!described) notes.push("the vision model said nothing about the picture");
  } catch (e) {
    notes.push("the picture was not described - " + String((e && e.message) || e));
  }
  const msgs = messages({ guide: d.guide || "", character, performer, wishes: x.wishes, described });
  let r;
  try {
    r = await d.complete({ messages: msgs, temperature: 0.5, max_tokens: 700, llm_file: x.llm_file });
  } catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
  let fin;
  if (r && r.ok) {
    fin = finish(r.text, { character, performer, wishes: x.wishes });
    if (fin.fallback) notes.push("the LLM's answer was not a swap prompt (no <Video 1> / <Picture 1>) - composed one from the descriptions");
  } else {
    fin = { prompt: compose({ character, performer, wishes: x.wishes }), fallback: true };
    notes.push("the LLM did not answer - " + String((r && r.error) || "no reply") + " - composed the prompt from the descriptions");
  }
  if (!described && !(r && r.ok)) {
    const err = new Error("could not write the prompt: " + notes.join("; "));
    err.status = 502;
    throw err;
  }
  return { prompt: fin.prompt, fallback: fin.fallback, character, performer, described, framed, notes, messages: msgs };
}

module.exports = { GUIDE_ID, MAX_LEN, CHARACTER_Q, PERFORMER_Q, parsePerformer, fixTags, isFullPrompt, guide,
                   messages, compose, clean, finish, write, trimTo };
