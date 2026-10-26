#!/usr/bin/env node
/* bitGen Studio — 2.596.0 in a REAL browser, against the running app (H3_URL): Settings ▸ LLM ▸ ⟳ UPDATE LLAMA.CPP and
 * buttons that show what they are doing.
 *   The engine line ("llama.cpp b10456 · the newest is b10601 - ⟳ Update available"), Install hidden while installed;
 *   ⟳ Update (confirmed): the button "⏳ Updating llama.cpp…", the job's lines in the log, then ✓ and the new version -
 *   the Settings window stays open; ▶ Start server: "⏳ Starting the server…" then "Loading <model>…" until ready, then
 *   "✓ Model loaded"; ■ Stop "Stopping the server…"; Save "⏳ Saving…". The engine / server calls are stood in for
 *   (page routes) - nothing is downloaded or loaded.
 * Tim: "add update llama in llm tab in settings. when updating, loading saving, onlclick show the action is being done".
 * No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.596.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.on("dialog", (d) => d.accept());
  let version = "b10456", jobPolls = 0, updated = false, llmsCalls = 0, started = false, saved = false;
  await p.route(/\/api\/llm\/engine(\?.*)?$/, (r) => r.fulfill({ json: { dir: "C:\\bitgen\\llama-cpp", installed: true, version, running: false, latest: { tag: "b10601" }, update: version !== "b10601", job: null } }));
  await p.route(/\/api\/llm\/engine\/update$/, (r) => { updated = true; jobPolls = 0; return r.fulfill({ json: { ok: true, job: { state: "running" } } }); });
  await p.route(/\/api\/llm\/engine\/job/, async (r) => {
    jobPolls++;
    const lines = jobPolls === 1 ? ["[..] stopping the LLM server", "Using b10601 - llama-b10601-bin-win-cuda-13.3-x64.zip (CUDA 13.3)", "Downloading llama-b10601-bin-win-cuda-13.3-x64.zip (61 MB)..."] : jobPolls === 3 ? ["[ok] llama.cpp b10601 is in C:\\bitgen\\llama-cpp"] : [];
    if (jobPolls >= 3) version = "b10601";
    return r.fulfill({ json: { job: { action: "update", state: jobPolls >= 3 ? "done" : "running", lines, n: jobPolls * 3, error: "", before: "b10456", after: jobPolls >= 3 ? "b10601" : "" } } });
  });
  await p.route(/\/api\/llm\/start$/, async (r) => { started = true; llmsCalls = 0; await new Promise((x) => setTimeout(x, 1200)); return r.fulfill({ json: { started: true, file: "Qwen3.8-27B-UD-Q4_K_XL.gguf", ready: false } }); });
  await p.route(/\/api\/llm\/stop$/, async (r) => { await new Promise((x) => setTimeout(x, 900)); return r.fulfill({ json: { stopped: true } }); });
  await p.route(/\/api\/llms$/, (r) => { if (!started) return r.continue(); llmsCalls++; return r.fulfill({ json: { files: ["Qwen3.8-27B-UD-Q4_K_XL.gguf"], engine_found: true, external: false, running: { file: "Qwen3.8-27B-UD-Q4_K_XL.gguf", ready: llmsCalls > 3 } } }); });
  await p.route(/\/api\/config$/, async (r) => { if (r.request().method() !== "POST") return r.continue(); saved = true; await new Promise((x) => setTimeout(x, 1200)); return r.continue(); });
  const ev = (f, a) => p.evaluate(f, a);
  const btn = (id) => ev((i) => { const e = document.getElementById(i); return { html: e.innerHTML, dis: e.disabled, busy: e.getAttribute("aria-busy"), shown: getComputedStyle(e).display !== "none" }; }, id);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3LlmTab && window.H3Busy && document.getElementById("s_llmupdate"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { if (typeof openSettings === "function") openSettings(); else document.getElementById("settings").showModal(); });
    await ev(() => document.querySelector('#settings .stabs [data-stab="llm"]').click());
    await p.waitForFunction(() => /Update available/.test(document.getElementById("s_llmengver").textContent), null, { timeout: 10000 });
    const e0 = await ev(() => document.getElementById("s_llmengver").textContent);
    const i0 = await btn("s_llminstall"), u0 = await btn("s_llmupdate");
    check("the LLM tab: the engine line says b10456 and that b10601 is newer; ⟳ Update shown, ⬇ Install hidden (installed)", /llama\.cpp b10456 · the newest is b10601 - ⟳ Update available/.test(e0) && u0.shown && !i0.shown, { e0, i0, u0 });

    await ev(() => document.getElementById("s_llmupdate").click());
    await p.waitForTimeout(300);
    const u1 = await btn("s_llmupdate");
    const log1 = await ev(() => document.getElementById("s_llmenglog").textContent);
    check("⟳ Update (confirmed): the button turns busy (spinner, disabled, aria-busy) - Updating llama.cpp…; the job's lines in the log",
      updated && /h3spin/.test(u1.html) && /Updating llama\.cpp/.test(u1.html) && u1.dis && u1.busy === "true" && /stopping the LLM server/.test(log1), { u1, log1 });
    await p.waitForFunction(() => /✓/.test(document.getElementById("s_llmupdate").innerHTML), null, { timeout: 15000 });
    const e1 = await ev(() => ({ line: document.getElementById("s_llmengver").textContent, log: document.getElementById("s_llmenglog").textContent, open: document.getElementById("settings").open }));
    check("…done: ✓ Updated, the line says b10456 -> b10601, the log has the last line, the Settings window stayed open",
      /✓ llama\.cpp updated b10456 -> b10601/.test(e1.line) && /llama\.cpp b10601 is in/.test(e1.log) && e1.open, e1);
    await p.waitForTimeout(1600);
    check("…and the button comes back as it was", /⟳ Update llama\.cpp/.test((await btn("s_llmupdate")).html) && !(await btn("s_llmupdate")).dis);

    await ev(() => document.getElementById("s_llmstart").click());
    await p.waitForTimeout(400);
    const s1 = await btn("s_llmstart");
    const st1 = await ev(() => document.getElementById("s_llmstatus2").textContent);
    check("▶ Start server: ⏳ Starting the server… (the status line says it starts)", /Starting the server/.test(s1.html) && s1.dis && /⏳ Starting the server|starting llama-server/.test(st1), { s1, st1 });
    await p.waitForFunction(() => /Loading Qwen3\.8-27B/.test(document.getElementById("s_llmstart").innerHTML), null, { timeout: 8000 });
    check("…then ⏳ Loading <the model>… while llama-server loads it", true);
    await p.waitForFunction(() => /✓ Model loaded/.test(document.getElementById("s_llmstart").innerHTML), null, { timeout: 15000 });
    const st2 = await ev(() => document.getElementById("s_llmstatus2").textContent);
    check("…then ✓ Model loaded once it is ready (the status line: loaded / serving … ready)", /✓ Model loaded|ready/.test(st2), st2);

    await ev(() => document.getElementById("s_llmstop").click());
    await p.waitForTimeout(250);
    check("■ Stop: ⏳ Stopping the server…", /Stopping the server/.test((await btn("s_llmstop")).html));
    await p.waitForFunction(() => /✓ Stopped/.test(document.getElementById("s_llmstop").innerHTML), null, { timeout: 8000 });

    await ev(() => document.getElementById("s_save").click());
    await p.waitForTimeout(300);
    check("Save: ⏳ Saving… while the settings are saved", saved && /Saving/.test((await btn("s_save")).html), await btn("s_save"));
    await p.waitForFunction(() => !document.getElementById("settings").open, null, { timeout: 10000 });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { try { await b.close(); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
