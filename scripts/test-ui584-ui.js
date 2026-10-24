#!/usr/bin/env node
/* bitGen Studio — 2.584.0 in a REAL browser: the prompt docker's 🔁 Compare LLMs, against the running app (H3_URL) with
 * stand-in llama-servers (scripts/stub-llama-server.py as the LLM engine, three "models" + a vision projector): the
 * menubar's 🔁 (3 LLMs - the projector is not one) / ▾ / 🏆; a round asks alpha, beta and gamma-fail in turn - each reply
 * in the chat under its LLM's name, the failure said; ✓ Use this one on beta = the chat's answer (stored once, the
 * question once), the others dimmed; 🏆 = beta best for "video prompt", the round with every reply; Use; ▾ untick;
 * ✗ None of them; ⏹ Stop. Tim: "add a button in the promptdocker top menubar to cycle through llms - let each llm send a
 * response in chat and user chooses the one he likes - record the llm , the request and the response - this can keep
 * track of the best llm for the job". The LLM settings are put back after. No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.584.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const post = async (p, b) => (await fetch(URL_ + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })).json();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-ui584-"));
const ENG = path.join(tmp, "engine"), MOD = path.join(tmp, "models");
fs.mkdirSync(ENG); fs.mkdirSync(MOD);
const exe = path.join(ENG, process.platform === "win32" ? "llama-server.exe" : "llama-server");
fs.copyFileSync(path.join(__dirname, "stub-llama-server.py"), exe); fs.chmodSync(exe, 0o755);
for (const m of ["alpha.gguf", "beta.gguf", "gamma-fail.gguf", "mmproj-alpha.gguf"]) fs.writeFileSync(path.join(MOD, m), "");

/** the stand-in llama-servers on the test port (one left from an earlier run would answer for every model) */
function killStubs() {
  if (process.platform !== "linux") return;
  for (const d of fs.readdirSync("/proc").filter((x) => /^\d+$/.test(x))) {
    let cmd = ""; try { cmd = fs.readFileSync(`/proc/${d}/cmdline`, "utf8").split("\0").join(" "); } catch { continue; }
    if (/llama-server -m .*bg-ui584-/.test(cmd) || (/llama-server/.test(cmd) && / --port 8497 /.test(cmd))) try { process.kill(+d); } catch { /* gone */ }
  }
}
killStubs();

(async () => {
  const before = (await (await fetch(URL_ + "api/config")).json()).llm || {};
  const keep = { dir: before.dir, engine_dir: before.engine_dir, external_url: before.external_url || "", port: before.port, device: before.device, last_file: before.last_file || "" };
  await post("api/config", { llm: { dir: MOD, engine_dir: ENG, external_url: "", port: 8497, device: "cpu", last_file: "alpha.gguf" } });
  await post("api/llmarena/clear");
  await post("api/chat/new");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.addInitScript(() => { try { localStorage.removeItem("h3.arenaLlms"); localStorage.setItem("h3.llm", "alpha.gguf"); } catch (e) { /* none */ } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Arena && document.getElementById("pdArena") && document.querySelectorAll("#llmSel option").length >= 4, null, { timeout: 60000 });
    await ev(() => { const s = document.getElementById("llmSel"); s.value = "alpha.gguf"; });
    await p.waitForFunction(() => /\(3\)/.test(document.getElementById("pdArena").textContent) && !document.getElementById("pdArena").disabled, null, { timeout: 10000 });
    const bar = await ev(() => { const bar = document.getElementById("pmBar"), b = document.getElementById("pdArena"); return { inBar: bar.contains(b), text: b.textContent, who: !!document.getElementById("pdArenaWho"), cup: !!document.getElementById("pdArenaScores"), lineup: H3Arena.lineup() }; });
    check("the prompt docker's menubar: 🔁 Compare LLMs (3) + ▾ + 🏆; the line-up = alpha (selected) first, beta, gamma-fail - the vision projector is not an LLM",
      bar.inBar && bar.text === "🔁 Compare LLMs (3)" && bar.who && bar.cup && bar.lineup.join() === "alpha.gguf,beta.gguf,gamma-fail.gguf", bar);

    // ------------------------------------------------ round 1
    await p.fill("#prompt", "create video prompt: a fox at dawn");
    await p.click("#pdArena");
    await p.waitForFunction(() => { const a = document.querySelector("#chatlog .arena"); return a && /pick the one you like/.test(a.querySelector(".arst").textContent); }, null, { timeout: 90000 });
    const r1 = await ev(() => { const a = document.querySelector("#chatlog .arena"); return { head: a.querySelector(".arh").textContent, cards: [...a.querySelectorAll(".arc")].map((c) => ({ llm: c.dataset.llm, text: c.textContent, use: !!c.querySelector("[data-use]") })), prompt: document.getElementById("prompt").value, busy: window.chatBusyNow() }; });
    check("each LLM answered in turn, in the chat under its name (its reply = its own words); gamma-fail's failure said, no ✓ on it",
      r1.cards.length === 3 && /\[alpha\] my answer to: create video prompt: a fox at dawn/.test(r1.cards[0].text) && /\[beta\] my answer/.test(r1.cards[1].text) && /⚠ .*exited while loading/.test(r1.cards[2].text)
      && r1.cards[0].use && r1.cards[1].use && !r1.cards[2].use && /🤖 alpha/.test(r1.cards[0].text), r1);
    check("the round says its job (video prompt) and 2 replies; the prompt box emptied, the chat free again", /video prompt/.test(r1.head) && /2 replies/.test(r1.head) && r1.prompt === "" && r1.busy === false, r1);
    const domClick = (sel) => ev((q) => { const all = document.querySelectorAll(q); all[all.length - 1].click(); }, sel);   // the chat docker may be small - its log scrolls
    await domClick('#chatlog .arena .arc[data-n="1"] [data-use]');
    await p.waitForFunction(() => /beta's reply is the answer/.test(document.querySelector("#chatlog .arena .arst").textContent), null, { timeout: 8000 });
    const won = await ev(() => [...document.querySelectorAll("#chatlog .arena .arc")].map((c) => c.className));
    check("✓ Use this one on beta: beta's card marked, the others dimmed (show / hide)", won[1].includes("win") && won[0].includes("lose") && won[2].includes("lose"), won);
    const chat = await (await fetch(URL_ + "api/chat")).json();
    const tail = chat.messages.slice(-2);
    check("the chat stores the question once and beta's reply as THE answer (alpha's is not in it)",
      chat.messages.filter((m) => m.text === "create video prompt: a fox at dawn").length === 1 && tail[0].role === "user" && tail[1].role === "assistant" && /^\[beta\]/.test(tail[1].text) && !chat.messages.some((m) => /^\[alpha\]/.test(m.text)), tail);

    // ------------------------------------------------ 🏆
    await p.click("#pdArenaScores");
    await p.waitForSelector("#pdArenaDlg[open] #pdArenaScore table", { timeout: 8000 });
    await p.selectOption("#pdArenaKind", "video prompt");
    await p.waitForFunction(() => /🏆 beta/.test(document.getElementById("pdArenaScore").textContent), null, { timeout: 8000 });
    const sc = await ev(() => ({ rows: [...document.querySelectorAll("#pdArenaScore tr")].map((r) => r.textContent), rounds: document.getElementById("pdArenaRounds").textContent }));
    check("🏆 video prompt: beta best (picked 1 of 1 = 100%), alpha 0 of 1, gamma-fail last (took part in nothing, 1 failed); the round with the request and every reply",
      /🏆beta11100%/.test(sc.rows[1].replace(/\s/g, "")) && /^alpha010%/.test(sc.rows[2].replace(/\s/g, "")) && /^gamma-fail000%0s1/.test(sc.rows[3].replace(/\s/g, ""))
      && /create video prompt: a fox at dawn/.test(sc.rounds) && /✓ beta/.test(sc.rounds) && /exited while loading/.test(sc.rounds), sc);
    await p.click('#pdArenaScore [data-use="beta.gguf"]');
    await p.waitForTimeout(300);
    check("Use: beta becomes the chat LLM (the LLM dropdown)", await ev(() => document.getElementById("llmSel").value) === "beta.gguf");
    const csv = await (await fetch(URL_ + "api/llmarena/export.csv")).text();
    check("⤓ Export CSV: a line per reply", /time,job,project,request,llm,chosen,seconds,reply,error/.test(csv) && /beta,yes/.test(csv) && /alpha,no/.test(csv) && /gamma-fail,no/.test(csv));
    await ev(() => document.getElementById("pdArenaDlg").close());

    // ------------------------------------------------ ▾ untick gamma, ✗ None of them
    await p.click("#pdArenaWho");
    await p.waitForSelector("#pdArenaPop");
    await p.click('#pdArenaPop input[value="gamma-fail.gguf"]');
    await p.click("#prompt"); await p.waitForTimeout(200);
    check("▾ untick gamma-fail: 🔁 Compare LLMs (2), beta (now selected) first", await ev(() => document.getElementById("pdArena").textContent) === "🔁 Compare LLMs (2)" && (await ev(() => H3Arena.lineup().join())) === "beta.gguf,alpha.gguf");
    await p.fill("#prompt", "what lens for a close-up?");
    await p.click("#pdArena");
    await p.waitForFunction(() => { const a = document.querySelectorAll("#chatlog .arena"); const x = a[a.length - 1]; return x && /pick the one you like/.test(x.querySelector(".arst").textContent); }, null, { timeout: 60000 });
    await domClick("#chatlog .arena [data-none]");
    await p.waitForFunction(() => { const a = document.querySelectorAll("#chatlog .arena"); return /none of them - recorded/.test(a[a.length - 1].querySelector(".arst").textContent); }, null, { timeout: 8000 });
    let st = await (await fetch(URL_ + "api/llmarena/stats")).json();
    const ch = st.kinds.find((k) => k.kind === "chat");
    check("✗ None of them: recorded for the job 'chat' - 1 round, none good, no best", ch && ch.rounds === 1 && ch.none === 1 && ch.best === "" && ch.llms.length === 2, ch);

    // ------------------------------------------------ ⏹ Stop
    await ev(() => { const s = document.getElementById("llmSel"); s.value = "alpha.gguf"; s.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(2500);                                                   // alpha loads
    await ev(() => { try { localStorage.setItem("h3.arenaLlms", JSON.stringify(["alpha.gguf", "beta.gguf"])); } catch (e) { /* none */ } });
    await p.fill("#prompt", "create song about trains");
    await p.click("#pdArena");
    await p.waitForFunction(() => document.querySelectorAll("#chatlog .arena").length === 3, null, { timeout: 10000 });
    await domClick("#chatlog .arena [data-stop]");
    await p.waitForFunction(() => { const a = document.querySelectorAll("#chatlog .arena"); return /stopped/.test(a[a.length - 1].querySelector(".arst").textContent); }, null, { timeout: 60000 });
    const n3 = await ev(() => { const a = document.querySelectorAll("#chatlog .arena"); return a[a.length - 1].querySelectorAll(".arc").length; });
    check("⏹ Stop: the LLMs not asked yet are skipped (only alpha answered)", n3 === 1, n3);
    st = await (await fetch(URL_ + "api/llmarena/stats")).json();
    check("a round not picked is recorded but not scored", st.rounds === 3 && st.decided === 2, st);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    await b.close();
    try { await post("api/llmarena/clear"); await post("api/chat/new"); await post("api/config", { llm: keep }); } catch { /* fine */ }
    killStubs();
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
