#!/usr/bin/env node
/* bitGen Studio — scripts/test-lorawords581.js (2.581.0): the selected LoRAs' keywords in what the LLM writes
 * (lib/loraWords.js, static/lorasel.js merge, the /api/enhance + prompt chat wiring). Tim: "make the llm add the selected
 * loras keywords to the prompt". No server, no LLM. */
"use strict";
const fs = require("fs");
const path = require("path");
const LW = require("../lib/loraWords");
const { merge } = require("../static/lorasel.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

const CARDS = [
  { name: "sdxl/detail_tweaker_xl.safetensors", title: "Detail Tweaker XL", keywords: ["highly detailed", "sharp focus", "intricate", "zq1", "zq2", "zq3", "zq4"] },
  { name: "anime_lineart.safetensors", title: "Anime Lineart", keywords: ["lineart", "monochrome", "LINEART", ""] },
  { name: "wan/e2e_motion.safetensors", title: "E2E Motion", keywords: [] },
  { name: "long.safetensors", title: "Long", keywords: ["x".repeat(120), "ok word"] },
];
const got = LW.forPaths(["sdxl\\detail_tweaker_xl.safetensors", "Anime_Lineart.safetensors", "other/anime_lineart.safetensors", "wan/e2e_motion.safetensors", "nothere.safetensors", "long"], CARDS);
check("forPaths: a LoRA by its path (either slash, any case) or file name / stem in any folder; one without keywords or unknown is left out; duplicates once",
  got.map((l) => l.title).join() === "Detail Tweaker XL,Anime Lineart,Long", got);
check("...at most 5 keywords each, no blanks, no case-duplicates, none over 80 characters",
  got[0].words.length === LW.MAX_WORDS && got[1].words.join() === "lineart,monochrome" && got[2].words.join() === "ok word", got.map((l) => l.words));
check("forPaths: nothing selected -> nothing", LW.forPaths([], CARDS).length === 0 && LW.forPaths(undefined, CARDS).length === 0);

const note = LW.systemNote(got.slice(0, 2));
check("systemNote: each LoRA with its keywords + the rule (exactly as written, every prompt)", /LoRAs IN USE/.test(note) && /- Anime Lineart: lineart, monochrome/.test(note) && /exactly as written/.test(note) && LW.systemNote([]) === "");

let e = LW.ensure("A woman walks through a neon city at night, lineart.", got.slice(0, 2));
check("ensure: the keywords the LLM left out are put in at the end; the ones it wrote are not repeated (any case)",
  e.text === "A woman walks through a neon city at night, lineart. highly detailed, sharp focus, intricate, zq1, zq2, monochrome" && e.added.length === 6, e);
e = LW.ensure("Highly Detailed portrait, sharp focus, intricate, zq1 zq2, monochrome lineart", got.slice(0, 2));
check("ensure: all there -> unchanged", e.added.length === 0 && e.text === "Highly Detailed portrait, sharp focus, intricate, zq1 zq2, monochrome lineart", e);
check("ensure: a keyword inside another word does not count (\"art\" is not in \"lineart\"), a phrase across a line break does", LW.ensure("lineart\nsharp\n focus", [{ title: "t", words: ["art", "sharp focus"] }]).added.join() === "art");
check("ensure: no LoRAs -> unchanged", LW.ensure("x ", []).text === "x");
check("ensure: a prompt ending without a stop gets ', ' before the keywords", LW.ensure("a cat", [{ title: "t", words: ["kw1"] }]).text === "a cat, kw1");

check("lorasel merge: Basic Settings' rows + the Model manager's picks, once each (either slash, any case), in order",
  JSON.stringify(merge(["a/x.safetensors", "B.safetensors"], ["a\\X.safetensors", "c.safetensors", ""])) === JSON.stringify(["a/x.safetensors", "B.safetensors", "c.safetensors"]));

/* the wiring */
const ix = fs.readFileSync(path.join(__dirname, "..", "routes", "index.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "static", "index.html"), "utf8");
check("/api/enhance: the LoRAs' rule in the system prompt, the missing keywords added to the answer, said in the note",
  /const eLoras = loraWords\.forPaths\(loraWords\.pathsFor\(req\.body \|\| \{\}, core\.STYLES_DIR\)\)/.test(ix) && /\+ loraWords\.systemNote\(eLoras\)/.test(ix) && /loraWords\.ensure\(ms\.text, eLoras\)/.test(ix) && /LoRA keywords added: /.test(ix));
check("the prompt chat: the LoRAs' rule in its system prompt (context.loras)", /loraWords\.systemNote\(loraWords\.forPaths\(loraWords\.pathsFor\(b\.context \|\| \{\}, core\.STYLES_DIR\)\)\)/.test(ix));
check("the page sends them: ✨ Enhance's body + the chat's context ({lora_override, loras} - 2.585.0), lorasel.js loaded",
  /\.\.\.\(window\.H3LoraSel && H3LoraSel\.ctx \? H3LoraSel\.ctx\(\) : \{ loras: \[\] \}\),/.test(html) && /Object\.assign\(chatCtx, window\.H3LoraSel && H3LoraSel\.ctx \? H3LoraSel\.ctx\(chatCtx\.gen_mode\)/.test(html)   /* 2.585.0: ctx, not every LoRA */ && /src="\/static\/lorasel\.js"/.test(html));

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
