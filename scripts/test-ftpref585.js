#!/usr/bin/env node
/* bitGen Studio — scripts/test-ftpref585.js (2.585.0): 🔁 Compare LLMs -> TRAINING an LLM, and which LoRAs' keywords the
 * LLM is given.
 *   Tim: "can we use this to train a gguff llm?" -> "go with your suggestions" (the full prompt with each round, ⤒ the
 *   picks into the 🎓 trainer's LLM job, a preference method DPO / ORPO) + "don't use keywords from all the loras when
 *   creating a prompt, only use the keywords from the loras selected in temporary loras when overide is selected in basic
 *   settings or the selected styles loras".
 * lib/llmArena.js trainingSet / promptOf / tokensOf / setPrompt; lib/fineTune.js validPref, readPrefs / writePrefs,
 * normalizeFt objective + beta, buildFtConfig; lib/loraWords.js pathsFor; the wiring. The trainer itself (TRL's DPO /
 * ORPO on a tiny model): scripts/test-ftpref585.py. No server, no GPU. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

const A = require("../lib/llmArena");
const FT = require("../lib/fineTune");
const LW = require("../lib/loraWords");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-ftpref585-"));
A.setDir(path.join(tmp, "rounds"));
const core = { BASE: tmp, getProject: () => "Film" };

(async () => {
  try {
    // ---------------------------------------------------------------- the full prompt with each round
    const r = A.start(core, { text: "create video prompt: a fox", gen_mode: "video", llms: ["a.gguf", "b.gguf", "c.gguf"] });
    const sent = [{ role: "system", content: "SYSTEM: bitGen's guide" }, { role: "user", content: "hi" }, { role: "assistant", content: "hello" }, { role: "user", content: "create video prompt: a fox" }];
    await A.setPrompt(core, r.id, sent);
    await A.setPrompt(core, r.id, [{ role: "user", content: "a second call does not replace it" }]);
    check("setPrompt: the full prompt the LLMs got is kept once per round (bitGen's instructions + the conversation + the request)", JSON.stringify(A.read(core, r.id).prompt) === JSON.stringify(sent));
    await A.addCandidate(core, { id: r.id, n: 0 }, { llm: "a.gguf", reply: "A fox, golden light", secs: 1 });
    await A.addCandidate(core, { id: r.id, n: 1 }, { llm: "b.gguf", reply: "fox", secs: 1 });
    await A.addCandidate(core, { id: r.id, n: 2 }, { llm: "c.gguf", error: "exited", secs: 1 });
    await A.pick(core, r.id, 0);
    // an older round (no prompt), a "none" round, an undecided round, another job
    const r2 = A.start(core, { text: "create song about rain", llms: ["a.gguf", "b.gguf"] });
    await A.addCandidate(core, { id: r2.id, n: 0 }, { llm: "a.gguf", reply: "TITLE: Rain", secs: 1 }); await A.addCandidate(core, { id: r2.id, n: 1 }, { llm: "b.gguf", reply: "TITLE: Drops", secs: 1 });
    await A.pick(core, r2.id, 1);
    const r3 = A.start(core, { text: "create video prompt: a cat", llms: ["a.gguf", "b.gguf"] });
    await A.addCandidate(core, { id: r3.id, n: 0 }, { llm: "a.gguf", reply: "x", secs: 1 }); await A.pick(core, r3.id, -1);
    A.start(core, { text: "create video prompt: undecided", llms: ["a.gguf", "b.gguf"] });

    const all = A.allRounds(core);
    const set = A.trainingSet(all, {});
    const win = set.chats.find((c) => /a fox/.test(c.messages[c.messages.length - 2].content));
    check("trainingSet: a decided round -> an example = the full prompt + the picked reply (none / undecided rounds give nothing)",
      set.rounds === 2 && set.chats.length === 2 && win && win.messages[0].role === "system" && win.messages[win.messages.length - 1].content === "A fox, golden light" && win.messages.length === 5, set.chats);
    check("trainingSet: a pair per reply NOT picked (a failed reply is no pair) - picked = chosen, the other = rejected",
      set.prefs.length === 2 && set.prefs.some((p) => p.chosen === "A fox, golden light" && p.rejected === "fox" && p.prompt[p.prompt.length - 1].content === "create video prompt: a fox") && set.prefs.some((p) => p.chosen === "TITLE: Drops" && p.rejected === "TITLE: Rain"), set.prefs);
    check("trainingSet: an older round has only its request; counted", set.with_prompt === 1 && set.without_prompt === 1 && set.prefs.find((p) => p.chosen === "TITLE: Drops").prompt.length === 1);
    check("trainingSet: by job (video prompt only), and without bitGen's instructions (no system message)",
      A.trainingSet(all, { kind: "video prompt" }).chats.length === 1 && A.trainingSet(all, { kind: "song" }).prefs.length === 1 && A.trainingSet(all, { include_system: false }).chats.every((c) => c.messages.every((m) => m.role !== "system")));
    check("trainingSet: the longest example's size (for the job's Max length); tokensOf ≈ chars / 3.5", set.longest_chars > 30 && A.tokensOf(35) === 10);
    check("promptOf: same roles in a row become one turn; it always ends with the user's turn",
      JSON.stringify(A.promptOf({ prompt: [{ role: "system", content: "s" }, { role: "system", content: "t" }, { role: "user", content: "u" }, { role: "assistant", content: "trailing" }] }, true)) === JSON.stringify([{ role: "system", content: "s\n\nt" }, { role: "user", content: "u" }]));
    check("every example and pair is what the trainer takes (validMessages / validPref)", set.chats.every((c) => FT.validMessages(c.messages)) && set.prefs.every((p) => FT.validPref(p)));

    // ---------------------------------------------------------------- the trainer's side
    const jd = path.join(tmp, "job");
    check("writePrefs / readPrefs: dataset/prefs.jsonl, bad pairs (same answers, not ending with the user) dropped",
      FT.writePrefs(jd, set.prefs.concat([{ prompt: [{ role: "user", content: "x" }], chosen: "s", rejected: "s" }, { prompt: [{ role: "assistant", content: "x" }], chosen: "a", rejected: "b" }])) === 2
      && FT.readPrefs(jd).length === 2 && fs.existsSync(path.join(jd, "dataset", "prefs.jsonl")));
    const sft = FT.normalizeFt({}, "llm"), dpo = FT.normalizeFt({ objective: "dpo" }, "llm"), orpo = FT.normalizeFt({ objective: "orpo", beta: 5, method: "full" }, "llm");
    check("normalizeFt: Learn from = sft (default) / dpo / orpo; a preference run gets a much smaller learning rate; beta 0.01-1 (0.1); a vision job is always sft",
      sft.objective === "sft" && dpo.objective === "dpo" && dpo.lr === 0.000005 && sft.lr > dpo.lr && dpo.beta === 0.1 && orpo.beta === 1 && orpo.lr <= 0.000005 && FT.normalizeFt({ objective: "dpo" }, "vision").objective === "sft", [sft.lr, dpo.lr, orpo]);
    const cfg = FT.buildFtConfig(Object.assign({ name: "t" }, dpo), { data: "d/chat.jsonl", prefs: "d/prefs.jsonl", output: "o" });
    check("buildFtConfig: objective, beta and the pairs' file go to scripts/ft_unsloth.py", cfg.objective === "dpo" && cfg.beta === 0.1 && cfg.prefs === "d/prefs.jsonl");

    // ---------------------------------------------------------------- which LoRAs' keywords
    const styles = { img1: { loras: [{ path: "styleimg.safetensors", weight: 1 }] }, vid1: { loras: [{ path: "stylevid.safetensors" }, "plain.safetensors"] } };
    const by = (id) => styles[id] || null;
    check("pathsFor: Override style ON = Basic Settings' temporary LoRAs only (what the page sent)", LW.pathsFor({ lora_override: true, loras: ["temp.safetensors"], gen_mode: "image", image_style_id: "img1" }, "", by).join() === "temp.safetensors");
    check("pathsFor: OFF = the selected style's LoRAs - the image style for Image, the video style for Video and Chat; the temporary ones ignored",
      LW.pathsFor({ lora_override: false, loras: ["temp.safetensors"], gen_mode: "image", image_style_id: "img1", video_style_id: "vid1" }, "", by).join() === "styleimg.safetensors"
      && LW.pathsFor({ lora_override: false, gen_mode: "video", image_style_id: "img1", video_style_id: "vid1" }, "", by).join() === "stylevid.safetensors,plain.safetensors"
      && LW.pathsFor({ lora_override: false, gen_mode: "chat", video_style_id: "vid1" }, "", by).length === 2);
    check("pathsFor: no style picked / a style without LoRAs = none; an older page (no lora_override) = what it sent",
      LW.pathsFor({ lora_override: false, gen_mode: "video" }, "", by).length === 0 && LW.pathsFor({ lora_override: false, gen_mode: "image", image_style_id: "nope" }, "", by).length === 0 && LW.pathsFor({ loras: ["x.safetensors"] }, "", by).join() === "x.safetensors");

    // ---------------------------------------------------------------- the wiring
    const IDX = fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8"), H = fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8"), LS = fs.readFileSync(path.join(ROOT, "static", "lorasel.js"), "utf8");
    check("/api/chat keeps the full prompt with a round; /api/enhance + the chat use pathsFor", /llmArena\.setPrompt\(core, arena\.id, llmChat\.alternate\(messages\)\)/.test(IDX) && /loraWords\.forPaths\(loraWords\.pathsFor\(req\.body \|\| \{\}, core\.STYLES_DIR\)\)/.test(IDX) && /loraWords\.forPaths\(loraWords\.pathsFor\(b\.context \|\| \{\}, core\.STYLES_DIR\)\)/.test(IDX));
    check("the page sends {lora_override, loras} (temporary LoRAs only with Override style) + the style ids; never the Model manager's picks",
      /H3LoraSel\.ctx\(chatCtx\.gen_mode\)/.test(H) && /\.\.\.\(window\.H3LoraSel && H3LoraSel\.ctx \? H3LoraSel\.ctx\(\) : \{ loras: \[\] \}\),\s*gen_mode:/.test(H) && /if \(ovr\) \{ try \{ if \(typeof root\.tempLoras === "function"\) rows = root\.tempLoras\(k\)/.test(LS) && !/H3LoraSel\.paths\(\)/.test(H));
    const R = fs.readFileSync(path.join(ROOT, "routes", "llmArena.js"), "utf8"), LT = fs.readFileSync(path.join(ROOT, "routes", "loraTrain.js"), "utf8"), UI = fs.readFileSync(path.join(ROOT, "static", "loratrain.js"), "utf8"), EXT = fs.readFileSync(path.join(ROOT, "ext", "promptdock", "llmarena.js"), "utf8");
    check("routes: /api/llmarena/trainset + /to-trainer; /api/loratrain/prefs/:name (GET / DELETE)", /\/api\/llmarena\/trainset/.test(R) && /\/api\/llmarena\/to-trainer/.test(R) && /app\.get\("\/api\/loratrain\/prefs\/:name"/.test(LT) && /app\.delete\("\/api\/loratrain\/prefs\/:name"/.test(LT));
    check("the trainer: Job ▸ Learn from (SFT / DPO / ORPO) + Beta; Dataset ▸ 🔁 Preference pairs (⤒ From 🔁 Compare LLMs, ⤓ prefs.jsonl, 🗑); ▶ Start counts the pairs for DPO / ORPO; 🏆 ▸ 🎓 Train an LLM on your picks",
      /id="ltObj"/.test(UI) && /id="ltBeta"/.test(UI) && /id="ltPrefFrom"/.test(UI) && /id="ltPrefDl"/.test(UI) && /pref \? \(j\.prefs \|\| 0\)/.test(UI) && /id="pdArenaTrain"/.test(EXT) && /\/api\/llmarena\/to-trainer/.test(EXT));
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
