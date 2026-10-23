#!/usr/bin/env node
/* bitGen Studio — 2.585.0 in a REAL browser: 🔁 Compare LLMs -> TRAINING an LLM. Against the running app (H3_URL) with
 * stand-in llama-servers (scripts/stub-llama-server.py): a round keeps the FULL prompt the LLMs got (bitGen's
 * instructions + the request); 🏆 ▸ 🎓 Train an LLM on your picks says what the picks give (1 example + 1 pair), ⤒ Send
 * to the trainer makes a new LLM job with them; the 🎓 trainer: Dataset ▸ 🔁 Preference pairs (1), Job ▸ Learn from ▸
 * Preferences (DPO) shows Beta and a smaller learning rate, Run ▸ ▶ Start counts the pairs. Tim: "can we use this to
 * train a gguff llm?" -> "go with your suggestions". The LLM settings are put back, the job deleted. No Playwright = SKIP. */
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.585.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const post = async (p, b) => (await fetch(URL_ + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })).json();
const JOB = "bg585_assistant";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-ui585-"));
const ENG = path.join(tmp, "engine"), MOD = path.join(tmp, "models");
fs.mkdirSync(ENG); fs.mkdirSync(MOD);
const exe = path.join(ENG, process.platform === "win32" ? "llama-server.exe" : "llama-server");
fs.copyFileSync(path.join(__dirname, "stub-llama-server.py"), exe); fs.chmodSync(exe, 0o755);
for (const m of ["alpha.gguf", "beta.gguf"]) fs.writeFileSync(path.join(MOD, m), "");
function killStubs() {
  if (process.platform !== "linux") return;
  for (const d of fs.readdirSync("/proc").filter((x) => /^\d+$/.test(x))) {
    let cmd = ""; try { cmd = fs.readFileSync(`/proc/${d}/cmdline`, "utf8").split("\0").join(" "); } catch { continue; }
    if (/llama-server -m .*bg-ui58[45]-/.test(cmd) || (/llama-server/.test(cmd) && / --port 8497 /.test(cmd))) try { process.kill(+d); } catch { /* gone */ }
  }
}
killStubs();

(async () => {
  const before = (await (await fetch(URL_ + "api/config")).json()).llm || {};
  const keep = { dir: before.dir, engine_dir: before.engine_dir, external_url: before.external_url || "", port: before.port, device: before.device, last_file: before.last_file || "" };
  await post("api/config", { llm: { dir: MOD, engine_dir: ENG, external_url: "", port: 8497, device: "cpu", last_file: "alpha.gguf" } });
  await post("api/llmarena/clear");
  await post("api/chat/new");
  await fetch(URL_ + "api/loratrain/job/" + JOB, { method: "DELETE" }).catch(() => null);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const domClick = (sel) => ev((q) => { const all = document.querySelectorAll(q); all[all.length - 1].click(); }, sel);
  try {
    await p.addInitScript(() => { try { localStorage.removeItem("h3.arenaLlms"); localStorage.removeItem("h3.arenaTrainJob"); localStorage.setItem("h3.llm", "alpha.gguf"); } catch (e) { /* none */ } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Arena && window.H3LoraTrain && document.querySelectorAll("#llmSel option").length >= 2, null, { timeout: 60000 });
    await ev(() => { document.getElementById("llmSel").value = "alpha.gguf"; });
    await p.waitForFunction(() => /\(2\)/.test(document.getElementById("pdArena").textContent) && !document.getElementById("pdArena").disabled, null, { timeout: 10000 });

    // ------------------------------------------------ a round keeps the full prompt
    await p.fill("#prompt", "create video prompt: a heron in the reeds");
    await p.click("#pdArena");
    await p.waitForFunction(() => { const a = document.querySelector("#chatlog .arena"); return a && /pick the one you like/.test(a.querySelector(".arst").textContent); }, null, { timeout: 90000 });
    await domClick('#chatlog .arena .arc[data-n="1"] [data-use]');
    await p.waitForFunction(() => /beta's reply is the answer/.test(document.querySelector("#chatlog .arena .arst").textContent), null, { timeout: 8000 });
    const rr = (await (await fetch(URL_ + "api/llmarena/rounds")).json()).rounds[0];
    check("the round keeps the FULL prompt the LLMs got: bitGen's instructions (system) + the request last", rr && Array.isArray(rr.prompt) && rr.prompt[0].role === "system" && rr.prompt[0].content.length > 500
      && rr.prompt[rr.prompt.length - 1].role === "user" && /a heron in the reeds/.test(rr.prompt[rr.prompt.length - 1].content), rr && rr.prompt && rr.prompt.map((m) => m.role + ":" + m.content.length));

    // ------------------------------------------------ 🏆 ▸ 🎓
    await p.click("#pdArenaScores");
    await p.waitForSelector("#pdArenaDlg[open] #pdTrGo", { timeout: 10000 });
    const tr = await ev(() => ({ txt: document.getElementById("pdArenaTrain").textContent, job: document.getElementById("pdTrJob").value, newShown: getComputedStyle(document.getElementById("pdTrNew")).display !== "none", sys: document.getElementById("pdTrSys").checked }));
    check("🏆 ▸ 🎓 Train an LLM on your picks: 1 decided round -> 1 example + 1 preference pair; with bitGen's instructions; a new job (none yet)",
      /1 decided round\(s\) → 1 examples .* \+ 1 preference pairs/.test(tr.txt) && /the longest ≈\d+ tokens/.test(tr.txt) && tr.sys && (tr.job === "" ? tr.newShown : true), tr);
    const roundsTxt = await ev(() => document.getElementById("pdArenaRounds").textContent);
    check("the round's details show the full prompt (messages, ≈tokens)", /the full prompt the LLMs got: \d+ messages, ≈\d+ tokens/.test(roundsTxt), roundsTxt.slice(0, 300));
    await ev((n) => { const s = document.getElementById("pdTrJob"); s.value = ""; s.dispatchEvent(new Event("change")); document.getElementById("pdTrNew").value = n; }, JOB);
    await p.click("#pdTrGo");
    await p.waitForFunction(() => /✓/.test(document.getElementById("pdTrMsg").textContent), null, { timeout: 10000 });
    const msg = await ev(() => document.getElementById("pdTrMsg").textContent);
    check("⤒ Send to the trainer: a new LLM job with +1 example and +1 pair (the longest vs its Max length said)", new RegExp("made the LLM job " + JOB + ": \\+1 examples \\(1 in all\\), \\+1 pairs \\(1 in all\\)").test(msg), msg);
    const lt = await (await fetch(URL_ + "api/loratrain")).json();
    const j = (lt.jobs || []).find((x) => x.name === JOB);
    const prefs = await (await fetch(URL_ + "api/loratrain/prefs/" + JOB)).json();
    check("the trainer's job: kind llm, Learn from = DPO (it came with pairs), 1 chat + 1 pair - chosen = beta's reply, rejected = alpha's, the prompt = bitGen's instructions + the request",
      j && j.kind === "llm" && j.settings.objective === "dpo" && j.examples === 1 && j.prefs === 1 && /^\[beta\]/.test(prefs[0].chosen) && /^\[alpha\]/.test(prefs[0].rejected) && prefs[0].prompt[0].role === "system", [j && j.settings.objective, j && j.examples, j && j.prefs, prefs[0] && prefs[0].chosen]);
    await p.click("#pdTrGo");
    await p.waitForFunction(() => /\+0 examples/.test(document.getElementById("pdTrMsg").textContent), null, { timeout: 10000 });
    check("sent again: nothing doubled (+0 / +0)", /\+0 examples \(1 in all\), \+0 pairs \(1 in all\)/.test(await ev(() => document.getElementById("pdTrMsg").textContent)));
    await ev(() => document.getElementById("pdArenaDlg").close());

    // ------------------------------------------------ the 🎓 trainer
    await ev(async (n) => { H3LoraTrain.show(true); await H3LoraTrain.load(); await H3LoraTrain.select(n); }, JOB);
    await p.waitForFunction(() => document.getElementById("ltObj"), null, { timeout: 10000 });
    const form = await ev(() => ({ obj: document.getElementById("ltObj").value, beta: document.getElementById("ltBeta") && document.getElementById("ltBeta").value, lr: document.getElementById("ltLr").value, opts: [...document.querySelectorAll("#ltObj option")].map((o) => o.value) }));
    check("Job ▸ Learn from: Examples (SFT) / Preferences (DPO) / ORPO - DPO picked, Beta 0.1, the learning rate 5e-6", form.opts.join() === "sft,dpo,orpo" && form.obj === "dpo" && +form.beta === 0.1 && +form.lr === 0.000005, form);
    await ev(() => { const s = document.getElementById("ltObj"); s.value = "sft"; s.dispatchEvent(new Event("change")); });
    await p.waitForFunction(() => !document.getElementById("ltBeta") && document.getElementById("ltObj").value === "sft", null, { timeout: 8000 });
    const lr2 = await ev(() => +document.getElementById("ltLr").value);
    check("...Examples (SFT): no Beta, the base model's own (larger) learning rate again", lr2 > 0.000005, lr2);
    await ev(() => { const s = document.getElementById("ltObj"); s.value = "orpo"; s.dispatchEvent(new Event("change")); });
    await p.waitForFunction(() => document.getElementById("ltBeta") && document.getElementById("ltObj").value === "orpo", null, { timeout: 8000 });
    await ev(() => { const t = document.querySelector('.ltd [data-ltab="dataset"]'); if (t) t.click(); });
    await p.waitForFunction(() => /1 pairs - this job learns from them \(ORPO\)/.test((document.getElementById("ltPrefInfo") || {}).textContent || ""), null, { timeout: 8000 });
    check("Dataset ▸ 🔁 Preference pairs: 1 - this job learns from them (ORPO); ⤒ From 🔁 Compare LLMs / ⤓ prefs.jsonl / 🗑 there", !!(await p.$("#ltPrefFrom")) && !!(await p.$("#ltPrefDl")) && !!(await p.$("#ltPrefClr")));
    await ev(() => { const t = document.querySelector('.ltd [data-ltab="run"]'); if (t) t.click(); });
    await p.waitForFunction(() => /preference pairs \(ORPO\)/.test((document.getElementById("ltP_run") || {}).textContent || ""), null, { timeout: 8000 });
    check("Run: ▶ Start counts the pairs for ORPO (1 preference pairs)", /1 preference pairs \(ORPO\)/.test(await ev(() => document.getElementById("ltP_run").textContent)));
    const yaml = await (await fetch(URL_ + "api/loratrain/yaml/" + JOB)).json();
    const cfg = JSON.parse(yaml.yaml);
    check("the run's config for scripts/ft_unsloth.py: objective orpo, beta, the pairs' file", cfg.objective === "orpo" && cfg.beta === 0.1 && /dataset[\\/]prefs\.jsonl$/.test(cfg.prefs), cfg);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    await b.close();
    try { await fetch(URL_ + "api/loratrain/job/" + JOB, { method: "DELETE" }); await post("api/llmarena/clear"); await post("api/chat/new"); await post("api/config", { llm: keep }); } catch { /* fine */ }
    killStubs();
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
