#!/usr/bin/env node
/* bitGen Studio — 2.370.0: the prompt chat's 💾 Save names the chat "<subject summary> - <date>", 🧹 clears it.
 * Run: node scripts/test-chattitle.js
 * Tim: "in prompt chat docker save the chat as <subject summary> - <date>, add a clear chat icon only button next
 * to the dropdown".
 *   1. lib/chatTitle: the first-words summary (first clause, openers dropped, no trailing small words, the app's
 *      bracketed notes and H3 markup skipped), an LLM reply cleaned, safe file names, "<title> - <YYYY-MM-DD>";
 *   2. the LLM names it only when one is ALREADY up (never a cold start), falls back on silence / error / timeout;
 *   3. lib/chatStore: saveAs freezes the conversation under its name (a taken name gets " (2)") and continues in a
 *      fresh copy; an empty chat is not saved; clear empties the current conversation only; byRecent = newest first;
 *   4. the wiring: the routes, the 🧹 button right after the picker (icon only), the page's handlers. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 600) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const CT = require(path.join(ROOT, "lib", "chatTitle"));
const CS = require(path.join(ROOT, "lib", "chatStore"));

(async () => {
  // 1
  const H = (t) => CT.heuristic([{ role: "user", text: t }]);
  check("heuristic: the first clause when it says enough", H("a woman walking in rain, close on her face") === "A woman walking in rain");
  check("heuristic: polite openers dropped, no trailing small word, 7 words at most",
    H("Can you help me write a song about the ocean at night") === "Write a song about the ocean"
    && H("please make a long cinematic music video of my band playing on a rooftop at dawn").split(" ").length <= 7,
    [H("Can you help me write a song about the ocean at night"), H("please make a long cinematic music video of my band playing on a rooftop at dawn")]);
  check("heuristic: the app's bracketed notes and H3 markup are skipped; the assistant is not the subject",
    CT.heuristic([{ role: "assistant", text: "Hello! What shall we make?" }, { role: "user", text: "[picture described: a dog]" },
                  { role: "user", text: "<Subject 1> says <d>[English] hi</d> on a beach at sunset" }]) === "Says hi on a beach at sunset",
    CT.heuristic([{ role: "assistant", text: "Hello!" }, { role: "user", text: "[picture described: a dog]" },
                  { role: "user", text: "<Subject 1> says <d>[English] hi</d> on a beach at sunset" }]));
  check("heuristic: nothing said = \"Chat\"", CT.heuristic([]) === "Chat");
  check("cleanTitle: an LLM reply -> the title (label, quotes, trailing dot, think block gone); a ramble = \"\"",
    CT.cleanTitle('Title: "Ocean Night Song".') === "Ocean Night Song" && CT.cleanTitle("<think>hmm</think>\nRainy City Romance") === "Rainy City Romance"
    && CT.cleanTitle("Here is a long answer that goes on and on about many different things without stopping") === "");
  check("fileStem: reserved characters out, no trailing dots, device names refused",
    CT.fileStem('A woman: walking/rain?') === "A woman walking rain" && CT.fileStem("Night...") === "Night" && CT.fileStem("CON") === "Chat");
  check("savedName: \"<subject summary> - <YYYY-MM-DD>\"", CT.savedName("Ocean Night Song", new Date(2026, 9, 5)) === "Ocean Night Song - 2026-10-05");

  // 2
  const llmChat = require(path.join(ROOT, "lib", "llmChat"));
  const real = llmChat.complete;
  let calls = 0;
  const coreUp = { getConfig: () => ({ llm: {} }), llamaState: () => ({ file: "m.gguf", proc: {} }) };
  const coreDown = { getConfig: () => ({ llm: {} }), llamaState: () => ({ file: "", proc: null }) };
  llmChat.complete = async () => { calls++; return { ok: true, text: "Rainy City Romance" }; };
  const msgs = [{ role: "user", text: "a woman walking in rain, close on her face" }];
  let t = await CT.titleFor(coreDown, msgs);
  check("no LLM running: never started for a title - the first words", calls === 0 && t.title === "A woman walking in rain" && t.how === "first words", t);
  t = await CT.titleFor(coreUp, msgs);
  check("an LLM running: it names the subject", calls === 1 && t.title === "Rainy City Romance" && t.how === "llm", t);
  t = await CT.titleFor({ getConfig: () => ({ llm: { external_url: "http://x" } }) }, msgs);
  check("...an external endpoint counts as running", t.how === "llm");
  llmChat.complete = async () => ({ ok: false, error: "502" });
  t = await CT.titleFor(coreUp, msgs);
  check("...an LLM error falls back to the first words", t.how === "first words" && t.title === "A woman walking in rain");
  llmChat.complete = () => new Promise(() => {});
  t = await CT.titleFor(coreUp, msgs, { timeoutMs: 50 });
  check("...a model that never answers: the timeout falls back", t.how === "first words");
  llmChat.complete = real;

  // 3
  const D = fs.mkdtempSync(path.join(os.tmpdir(), "chat370_"));
  const now = new Date(2026, 9, 5, 10, 0, 0);
  const s1 = CS.currentSession(D, now);
  check("saveAs: an empty conversation is not saved", CS.saveAs(D, "X - 2026-10-05", now) === null);
  CS.append(D, s1, "user", "a woman walking in rain");
  CS.append(D, s1, "assistant", "lovely");
  let r = CS.saveAs(D, "A woman walking in rain - 2026-10-05", now);
  check("saveAs: the conversation frozen as '<name>.chat', the chat continues in a fresh dated copy",
    r && r.saved === "A woman walking in rain - 2026-10-05.chat" && fs.existsSync(path.join(D, r.saved)) && !fs.existsSync(path.join(D, s1))
    && /^\d{4}-\d{2}-\d{2}_\d{6}(-\d+)?\.chat$/.test(r.session) && CS.read(D, r.saved).length === 2
    && CS.read(D, r.session).length === 2 && CS.currentSession(D, now) === r.session, r);
  const r2 = CS.saveAs(D, "A woman walking in rain - 2026-10-05", now);
  check("...the same name again: ' (2)', never an overwrite", r2 && r2.saved === "A woman walking in rain - 2026-10-05 (2).chat", r2);
  CS.append(D, CS.currentSession(D, now), "user", "more");
  await new Promise((ok) => setTimeout(ok, 60));        // the copies' mtimes are set a few ms ahead
  const c = CS.clear(D, now);
  check("clear: the current conversation emptied (the saves untouched)", c.cleared === 3 && CS.read(D, c.session).length === 0
    && CS.read(D, r.saved).length === 2 && CS.currentSession(D, now) === c.session, c);
  const bt = CS.byRecent(D);
  check("byRecent: newest first by time - the just-cleared current file, then the saves", bt[0] === c.session && bt.length === 3
    && bt.includes(r.saved) && bt.includes(r2.saved), bt);
  const ld = CS.openCopy(D, r.saved, now);
  check("📂 Load still opens a titled save as a fresh copy", ld && ld.from === r.saved && CS.read(D, ld.session).length === 2, ld);
  fs.rmSync(D, { recursive: true, force: true });

  // 4
  const IDX = read("routes", "index.js"), DOCK = read("ext", "chatdock", "dock.html"), H5 = read("static", "index.html");
  check("POST /api/chat/save names it (chatTitle.titleFor + savedName) and saves with chatStore.saveAs; refuses an empty chat",
    /app\.post\("\/api\/chat\/save", async/.test(IDX) && /chatTitle\.titleFor\(core, msgs\)/.test(IDX)
    && /chatStore\.saveAs\(dir, chatTitle\.savedName\(t\.title\)\)/.test(IDX) && /nothing to save yet/.test(IDX));
  check("POST /api/chat/clear + GET /api/chat's saved list (newest first)",
    /app\.post\("\/api\/chat\/clear"/.test(IDX) && /saved: chatStore\.byRecent\(dir\)/.test(IDX));
  check("the 🧹 button sits right after the picker, icon only, titled",
    /id="chatSaves"[^>]*><\/select>\s*<!--[\s\S]*?-->\s*<button class="ghost gbtn" id="chatClear" title="Clear the chat[^"]*" aria-label="Clear the chat">🧹<\/button>/.test(DOCK));
  check("the page: 🧹 asks before clearing a non-empty chat, posts /api/chat/clear, repaints; the picker uses the saved list",
    /\$\("chatClear"\)\.onclick = async/.test(H5) && /appConfirm\("Clear this conversation\?/.test(H5) && /fetch\("\/api\/chat\/clear"/.test(H5)
    && /Array\.isArray\(j\.saved\) \? j\.saved/.test(H5) && /saved as "\$\{j\.name \|\| j\.saved\}"/.test(H5));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
