#!/usr/bin/env node
/* bitGen Studio — 2.794.0 browser test: LOCAL MULTI-GPU PART 2 - ☁ Runs on ▸ LLM / Speech to text ▸ "Local - <card>" (lib/cardUse.js,
 * lib/remoteHosts.js, static/remotehosts.js) and Settings ▸ General ☐ "Offload to CPU / RAM when a model does not fit"
 * (static/cardoffload.js, routes/cardUse.js) on a running studio (H3_URL) started with two stand-in cards:
 *   H3_E2E=1 H3_TEST_GPUS='[{"name":"RTX 5090","mem_total":32607},{"name":"RTX 3090","mem_total":24576}]'
 * No server / no Playwright / fewer than two cards on the server = SKIP. Put back afterwards (LLM + Speech to text = Local, Offload on). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.794.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.794.0 browser test did not run"); process.exit(0); }
  const gc = await api("/api/gpucards");
  if (!gc.cards || gc.cards.length < 2) { console.log("SKIP: the studio sees fewer than two graphics cards (start it with H3_TEST_GPUS - see the top of this file)"); process.exit(0); }
  const b = await chromium.launch();
  try {
    const cu0 = await api("/api/carduse");
    check("GET /api/carduse: Offload on by default", cu0.offload === true, cu0);
    const before = await api("/api/remotehosts");
    const row = (k) => (before.kinds.find((x) => x.k === k) || {}).options || [];
    check("Runs on ▸ LLM / Vision LLM / Text to speech / Speech to text / Song separation list Local - <card> after Local",
      ["llm", "vlm", "tts", "stt", "stems"].every((k) => row(k).map((o) => o.id).slice(0, 3).join() === "local,local:0,local:1") && /Local - RTX 3090 \(GPU 1, 24 GB\)/.test(row("llm")[2].label), row("llm").slice(0, 3));

    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL0);
    await p.waitForFunction(() => document.querySelector('select[data-rhkind="llm"]'), null, { timeout: 30000 }).catch(() => null);
    await sleep(1500);
    // pick Local - RTX 3090 for the LLM in the docker's own dropdown
    await p.evaluate(() => { const s = document.querySelector('select[data-rhkind="llm"]'); s.value = "local:1"; s.dispatchEvent(new Event("change")); });
    let v = null;
    for (let i = 0; i < 20; i++) { v = await api("/api/remotehosts"); if (v.hosts.llm === "local:1") break; await sleep(300); }
    const g1 = await api("/api/gpucards");
    check("the LLM row's dropdown picks GPU 1: LLM = local:1, kept (rgpu.local_cards.llm), still all local", v.hosts.llm === "local:1" && g1.picks.llm === 1 && v.where === "local", { hosts: v.hosts, picks: g1.picks, where: v.where });
    await sleep(1200);
    const n1 = await p.evaluate(() => (document.getElementById("rhNote_llm") || {}).textContent || "");
    check("the line under the LLM row: llama.cpp on GPU 1, the layers that fit, the rest in RAM", /llama\.cpp on GPU 1 - as many layers as its free memory holds, the rest in RAM/.test(n1), n1);
    const v2 = await api("/api/remotehosts", { kind: "stt", host: "local:0" });
    await p.evaluate(() => document.dispatchEvent(new Event("h3:rgpu")));
    check("Speech to text on GPU 0: stt = local:0, its line says the card is all its program sees", v2.hosts.stt === "local:0" && /runs on GPU 0 \(the card is all its program sees\)/.test((v2.kinds.find((x) => x.k === "stt") || {}).note || ""), v2.kinds.find((x) => x.k === "stt"));

    // Settings ▸ General ☐ Offload
    await p.click("#openSettings");
    await p.waitForSelector("#s_offload", { state: "visible", timeout: 10000 });
    await sleep(500);
    const st = await p.evaluate(() => ({ on: document.getElementById("s_offload").checked, msg: (document.getElementById("s_offload_msg") || {}).textContent || "" }));
    check("Settings ▸ General: ☐ Offload to CPU / RAM when a model does not fit - ticked, said", st.on === true && /keeps the rest in RAM/.test(st.msg), st);
    await p.click("#s_offload");
    let cu1 = null;
    for (let i = 0; i < 20; i++) { cu1 = await api("/api/carduse"); if (cu1.offload === false) break; await sleep(250); }
    await sleep(300);
    const msg2 = await p.evaluate(() => (document.getElementById("s_offload_msg") || {}).textContent || "");
    check("unticked: saved (config.gpu_offload false), the line says everything on the card + refused when it does not fit", cu1.offload === false && /Offload is off - everything on the card/.test(msg2), { cu1, msg2 });
    const v3 = await api("/api/remotehosts");
    check("the LLM row's line follows it (Offload is off: a model that does not fit is refused)", /Offload is off: a model that does not fit is refused/.test((v3.kinds.find((x) => x.k === "llm") || {}).note || ""), v3.kinds.find((x) => x.k === "llm"));
    await p.reload(); await sleep(2500);
    await p.click("#openSettings"); await p.waitForSelector("#s_offload", { state: "visible", timeout: 10000 }); await sleep(800);
    check("…and kept after a reload (the box unticked)", (await p.evaluate(() => document.getElementById("s_offload").checked)) === false);
    await p.click("#s_offload"); await sleep(800);
    check("ticked again = on", (await api("/api/carduse")).offload === true);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the test crashed: " + e.message, false); }
  finally {
    await api("/api/remotehosts", { kind: "llm", host: "local" }).catch(() => {});
    await api("/api/remotehosts", { kind: "stt", host: "local" }).catch(() => {});
    await api("/api/carduse/offload", { on: true }).catch(() => {});
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
