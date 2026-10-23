#!/usr/bin/env node
/* bitGen Studio — scripts/test-llmarena584.js (2.584.0): 🔁 COMPARE LLMs - the record and the scores (lib/llmArena.js)
 * and the prompt docker's line-up (ext/promptdock/llmarena.js). A round is started for a request, each LLM's reply (or
 * failure) joins it, the user's pick is kept; the scores say which LLM is best for each job (wins, win %, time; a
 * failed reply does not count as taking part; a round not picked yet does not count); kinds from the toolbar's words;
 * the CSV; the chat route's `arena` field. Tim: "cycle through llms - let each llm send a response in chat and user
 * chooses the one he likes - record the llm , the request and the response - this can keep track of the best llm for
 * the job". No LLM, no server. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

const A = require("../lib/llmArena");
const UI = require("../ext/promptdock/llmarena.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-arena584-"));
A.setDir(tmp);
const core = { BASE: tmp, getProject: () => "Film" };

(async () => {
  try {
    // ---------------------------------------------------------------- pure
    check("kindOf: the prompt toolbar's words -> the job (screenplay, music video, song, image prompt, video prompt, chat)",
      A.kindOf("create screenplay of a heist") === "screenplay" && A.kindOf("create music video for this track") === "music video" && A.kindOf("create song about rain") === "song"
      && A.kindOf("create image prompt from image") === "image prompt" && A.kindOf("create video prompt: a fox at dawn") === "video prompt" && A.kindOf("what lens for a close-up?") === "chat"
      && A.kindOf("give me a prompt for a cat", "image") === "image prompt" && A.kindOf("give me a prompt for a cat", "video") === "video prompt" && A.kindOf("write lyrics for a ballad") === "song");
    check("parseArena: {id, n} from JSON or a multipart string; junk refused",
      JSON.stringify(A.parseArena('{"id":"abc123def456","n":2}')) === '{"id":"abc123def456","n":2}' && A.parseArena({ id: "abc123def456", n: 0 }).n === 0
      && A.parseArena(null) === null && A.parseArena("x") === null && A.parseArena({ id: "../../etc", n: 1 }) === null && A.parseArena({ id: "abc123def456", n: -1 }) === null && A.parseArena({ id: "abc123def456", n: 1.5 }) === null);
    check("csvRow: quotes, commas, new lines", A.csvRow(["a", 'say "hi"', "x,y", "l1\nl2", null]) === 'a,"say ""hi""","x,y","l1\nl2",');
    check("prompt docker line-up: the selected (loaded) LLM first, then the others as listed; only the ticked; never a vision projector; no doubles",
      UI.order(["a.gguf", "b.gguf", "mmproj-x.gguf", "c.gguf", "b.gguf"], "c.gguf", null).join() === "c.gguf,a.gguf,b.gguf"
      && UI.order(["a.gguf", "b.gguf", "c.gguf"], "a.gguf", ["c.gguf", "a.gguf"]).join() === "a.gguf,c.gguf" && UI.order(["a.gguf", "b.gguf"], "z.gguf", null).join() === "a.gguf,b.gguf" && !UI.usable("") && !UI.usable("x.bin"));

    // ---------------------------------------------------------------- a round
    check("start: needs the prompt and two LLMs", /prompt/.test(A.start(core, { text: " ", llms: ["a.gguf", "b.gguf"] }).error) && /two LLMs/.test(A.start(core, { text: "hi", llms: ["a.gguf", "a.gguf"] }).error));
    const r1 = A.start(core, { text: "create video prompt: a fox at dawn", gen_mode: "video", llms: ["qwen.gguf", "gemma.gguf", "../../evil.gguf", "notes.txt"] });
    check("start: the round is recorded with the request, the job, the project and the LLMs (file names only)", r1.id && r1.kind === "video prompt" && r1.project === "Film" && r1.llms.join() === "qwen.gguf,gemma.gguf,evil.gguf" && fs.existsSync(path.join(tmp, r1.id + ".json")), r1);
    // two replies landing at the same moment must both be kept
    await Promise.all([A.addCandidate(core, { id: r1.id, n: 1 }, { llm: "gemma.gguf", reply: "Gemma's fox", secs: 4.21 }),
      A.addCandidate(core, { id: r1.id, n: 0 }, { llm: "qwen.gguf", reply: "Qwen's fox", secs: 2 }),
      A.addCandidate(core, { id: r1.id, n: 2 }, { llm: "evil.gguf", error: "llama-server exited while loading", secs: 1 })]);
    let rr = A.read(core, r1.id);
    check("every LLM's reply (and a failure) is recorded with its time - replies that land together are all kept, in order", rr.candidates.map((c) => c.llm + ":" + (c.error ? "ERR" : c.reply) + ":" + c.secs).join("|") === "qwen.gguf:Qwen's fox:2|gemma.gguf:Gemma's fox:4.2|evil.gguf:ERR:1", rr.candidates);
    check("a failed reply cannot be picked", /no such reply/.test((await A.pick(core, r1.id, 2)).error || ""));
    check("a round not picked yet does not count in the scores", A.stats(core).kinds.length === 0 && A.stats(core).rounds === 1 && A.stats(core).decided === 0);
    const p1 = await A.pick(core, r1.id, 1);
    check("pick: Gemma's reply is the answer; the round keeps the choice", p1.chosen.reply === "Gemma's fox" && A.read(core, r1.id).chosen === 1 && A.read(core, r1.id).picked_at);

    const r2 = A.start(core, { text: "create video prompt: rain on neon", gen_mode: "video", llms: ["qwen.gguf", "gemma.gguf"] });
    await A.addCandidate(core, { id: r2.id, n: 0 }, { llm: "qwen.gguf", reply: "q", secs: 3 }); await A.addCandidate(core, { id: r2.id, n: 1 }, { llm: "gemma.gguf", reply: "g", secs: 5 });
    await A.pick(core, r2.id, 0);
    const r3 = A.start(core, { text: "create video prompt: a desert storm", gen_mode: "video", llms: ["qwen.gguf", "gemma.gguf"] });
    await A.addCandidate(core, { id: r3.id, n: 0 }, { llm: "qwen.gguf", reply: "q2", secs: 1 }); await A.addCandidate(core, { id: r3.id, n: 1 }, { llm: "gemma.gguf", reply: "g2", secs: 6 });
    await A.pick(core, r3.id, 1);
    const r4 = A.start(core, { text: "create song about trains", llms: ["qwen.gguf", "gemma.gguf"] });
    await A.addCandidate(core, { id: r4.id, n: 0 }, { llm: "qwen.gguf", reply: "TITLE: Rails", secs: 2, song: { title: "Rails" } }); await A.addCandidate(core, { id: r4.id, n: 1 }, { llm: "gemma.gguf", reply: "meh", secs: 2 });
    await A.pick(core, r4.id, -1);
    const r5 = A.start(core, { text: "create song about boats", llms: ["qwen.gguf", "gemma.gguf"] });
    await A.addCandidate(core, { id: r5.id, n: 0 }, { llm: "qwen.gguf", reply: "TITLE: Sails", secs: 2, song: { title: "Sails" } });
    const p5 = await A.pick(core, r5.id, 0);
    check("a song reply keeps its parsed song for the Music dock", p5.chosen.song && p5.chosen.song.title === "Sails");

    const st = A.stats(core), vid = st.kinds.find((k) => k.kind === "video prompt"), song = st.kinds.find((k) => k.kind === "song"), all = st.kinds.find((k) => k.kind === "all");
    check("scores per job: video prompt - Gemma 2 picks of 3 (67%), Qwen 1 of 3 (33%); the failed evil.gguf took part in nothing; best = Gemma",
      vid.rounds === 3 && vid.best === "gemma.gguf" && vid.llms[0].name === "gemma" && vid.llms[0].wins === 2 && vid.llms[0].entered === 3 && vid.llms[0].rate === 67
      && vid.llms[1].wins === 1 && vid.llms[1].rate === 33 && vid.llms.find((x) => x.llm === "evil.gguf").entered === 0 && vid.llms.find((x) => x.llm === "evil.gguf").errors === 1, vid);
    check("average time per LLM (only its answers)", vid.llms.find((x) => x.llm === "qwen.gguf").avg_secs === 2 && vid.llms.find((x) => x.llm === "gemma.gguf").avg_secs === 5.1, vid.llms);
    check("song: one round 'none of them' + one Qwen win -> Qwen best; none counted", song.rounds === 2 && song.none === 1 && song.best === "qwen.gguf" && song.llms[0].wins === 1 && song.llms[0].entered === 2, song);
    check("every job together ('all', last): Gemma 2, Qwen 2 - the tie goes to the better win rate", all && st.kinds[st.kinds.length - 1].kind === "all" && all.rounds === 5 && all.llms[0].wins === 2 && all.llms[1].wins === 2 && all.llms[0].rate >= all.llms[1].rate, all);
    const none = A.score([{ kind: "chat", chosen: -1, candidates: [{ n: 0, llm: "a.gguf", reply: "x", secs: 1 }] }])[0];
    check("no win yet = no best", none.best === "" && none.llms[0].wins === 0);
    const list = A.rounds(core, { kind: "song" });
    check("rounds: newest first, by job", list.total === 2 && list.rounds.every((r) => r.kind === "song"));
    const csv = A.csv(core);
    check("CSV: a header + one line per reply (time, job, project, request, llm, chosen, seconds, reply, error)", csv.split("\r\n")[0] === "time,job,project,request,llm,chosen,seconds,reply,error" && /video prompt,Film,create video prompt: a fox at dawn,gemma,yes,4\.2,Gemma's fox,/.test(csv) && /evil,no,1,,llama-server exited/.test(csv), csv.slice(0, 600));
    check("delete one round / clear all", A.remove(core, r5.id).ok && A.rounds(core).total === 4 && A.clear(core).removed === 4 && A.rounds(core).total === 0 && A.remove(core, "nope").error);

    // ---------------------------------------------------------------- an old llama-server answering for every model
    const http = require("http");
    let served = "/models/alpha.gguf";
    const srv = http.createServer((q, rs) => { rs.setHeader("Content-Type", "application/json"); rs.end(q.url.startsWith("/v1/models") ? JSON.stringify({ data: [{ id: served }] }) : "{}"); });
    await new Promise((ok) => srv.listen(0, ok));
    const cfgCore = { getConfig: () => ({ llm: { port: srv.address().port } }) };
    const wrong = await A.checkServed(cfgCore, "beta.gguf");
    check("checkServed: the LLM port serving alpha when beta was asked = refused (an old llama-server still running); the right one passes; Windows paths too",
      /answered as alpha\.gguf, not beta\.gguf/.test(wrong) && (await A.checkServed(cfgCore, "alpha.gguf")) === "" && (served = "C:\\llm\\Beta.gguf", (await A.checkServed(cfgCore, "beta.gguf")) === ""), wrong);
    check("checkServed: an external endpoint / a server that cannot say = no check", (await A.checkServed({ getConfig: () => ({ llm: { external_url: "x", port: 1 } }) }, "a.gguf")) === "" && (await A.checkServed({ getConfig: () => ({ llm: { port: 9 } }) }, "a.gguf")) === "");
    srv.close();

    // ---------------------------------------------------------------- the wiring
    const IDX = fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8"), H = fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8");
    check("/api/chat: with `arena` the question is written once (the first LLM), the reply joins the round, not the chat; a failure is recorded too",
      /if \(!arena \|\| arena\.n === 0\) chatStore\.append\(dir, session, "user", text\)/.test(IDX) && /if \(arena\) \{\s*const wrong = await llmArena\.checkServed\(core, b\.llm_file\)[\s\S]{0,400}const cand = await llmArena\.addCandidate/.test(IDX) && /if \(arena\) await llmArena\.addCandidate\(core, arena, \{ llm: b\.llm_file, error/.test(IDX) && /require\("\.\/llmArena"\)\.mount\(app\)/.test(IDX));
    check("core: chatSend and 🔁 share chatPost (the same context) + chatApplyReply; the chat can be held during a round",
      /async function chatPost\(t, chatLlm, arena\)/.test(H) && /window\.chatPost = chatPost/.test(H) && /window\.chatApplyReply = chatApplyReply/.test(H) && /window\.chatSetBusy/.test(H) && /await chatPost\(t, \$\("llmSel"\)/.test(H));
    const EXT = JSON.parse(fs.readFileSync(path.join(ROOT, "ext", "promptdock", "ext.json"), "utf8"));
    check("the prompt docker extension loads llmarena.js", EXT.scripts.includes("llmarena.js"));
    check("the record is this PC's (llm_arena/ never in the repo or a zip)", /^llm_arena\/$/m.test(fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8")) && /\.\/llm_arena\/\*/.test(fs.readFileSync(path.join(ROOT, "scripts", "make_zips.sh"), "utf8")));
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
