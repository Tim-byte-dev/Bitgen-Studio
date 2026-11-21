#!/usr/bin/env node
/* bitGen Studio — 2.902.0 in a REAL browser (Tim: "new videos are getting old video prompts mixed with the new prompt" - "it
 * happened after a render with pan 2. maybe it is loading the json prompt as well?"): Generate with PAN 2 (the words become
 * PAN 2's JSON caption in the prompt box), switch to a MiniMax H3 style - your words are back, not the JSON; back to PAN 2
 * - the JSON again; Generate on H3 sends only the new words; and the real server takes a caption out of an H3 prompt (the
 * job's log says so). Against the running app (H3_URL). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
(async () => {
  try { const r = await fetch(URL_); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const gen = [], pan = [];
  await p.addInitScript(() => { window.__realFetch = window.fetch.bind(window); });
  await p.route("**/api/pan2", (r) => { if (r.request().method() !== "POST") return r.continue(); pan.push(1); r.fulfill({ json: { id: "fakeP902", status: "queued" } }); });
  await p.route("**/api/generate", (r) => { if (r.request().headers()["x-real"]) return r.continue(); gen.push(r.request().postDataBuffer().toString("latin1")); r.fulfill({ json: { id: "fakeH902" } }); });
  await p.route("**/api/jobs/fake*", (r) => r.fulfill({ json: { id: "x", status: "done", outputs: [] } }));
  await p.route("**/api/comfy/ensure", (r) => r.fulfill({ json: { ok: true, reachable: true } }));
  await p.route("**/api/comfy/status", (r) => r.fulfill({ json: { reachable: true } }));
  await p.route("**/api/models/check*", (r) => r.fulfill({ json: { ok: true, missing: [] } }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Pan2Gen && typeof videoStyles !== "undefined" && videoStyles.some((s) => s.arch === "pan2"), null, { timeout: 60000 });
    // static/stylebasic.js re-picks the last style used about 4 s after the page loads - wait for it, or it flips the test's pick
    await p.waitForFunction(() => performance.now() > 6500, null, { timeout: 20000 });
    const ids = await p.evaluate(() => ({ pan: videoStyles.find((s) => s.arch === "pan2").id, h3: videoStyles.find((s) => s.arch === "minimax-h3").id }));
    const pick = (v) => p.evaluate((v) => { const s = document.getElementById("videoStyleSel"); s.value = v; s.dispatchEvent(new Event("change")); }, v);
    await p.evaluate(() => { localStorage.removeItem("h3.pan2.words"); if (document.getElementById("genModeSel")) document.getElementById("genModeSel").value = "video"; });
    await pick(ids.pan);
    await p.fill("#prompt", "OLD a brown terrier runs along the beach");
    await p.click("#go"); await p.waitForTimeout(2500);
    const afterPan = await p.inputValue("#prompt");
    check("a PAN 2 Generate: its JSON caption in the prompt box", pan.length === 1 && window_isJson(afterPan), afterPan.slice(0, 120));
    await pick(ids.h3); await p.waitForTimeout(400);
    check("switched to a MiniMax H3 style: your words are back, not PAN 2's JSON", (await p.inputValue("#prompt")) === "OLD a brown terrier runs along the beach", (await p.inputValue("#prompt")).slice(0, 120));
    await pick(ids.pan); await p.waitForTimeout(400);
    check("back to PAN 2 with the same words: the same JSON again (no new LLM call)", (await p.inputValue("#prompt")) === afterPan && pan.length === 1);
    await pick(ids.h3); await p.waitForTimeout(400);
    await p.fill("#prompt", "NEW a woman sings in the rain");
    await p.click("#go"); await p.waitForTimeout(3000);
    const m = (gen[0] || "").match(/name="prompt"\r\n\r\n([\s\S]*?)\r\n--/);
    check("Generate on H3 sends only the new words", m && m[1] === "NEW a woman sings in the rain", m && m[1]);
    // the real server: a caption left in an H3 prompt (a box set by a script, a pasted caption) is taken out
    const srv = await p.evaluate(async (cap) => {
      const fd = new FormData(); fd.append("mode", "t2va"); fd.append("prompt", "NEW a woman sings in the rain\n\n" + cap);
      const r = await window.__realFetch("/api/generate", { method: "POST", body: fd, headers: { "X-Real": "1" } }); const j = await r.json();
      const job = await (await window.__realFetch("/api/jobs/" + j.id)).json();
      return { notes: j.notes || "", log: (job.log || []).filter((l) => /PAN 2/.test(l)), prompt: ((job.params || {}).prompt || job.prompt || "") };
    }, afterPan).catch((e) => ({ err: String(e) }));
    check("the server takes PAN 2's caption out of an H3 prompt and the job's log says so", srv.log.length === 1 && /taken out of the prompt/.test(srv.log[0]) && srv.prompt === "NEW a woman sings in the rain", srv);
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
function window_isJson(t) { try { const o = JSON.parse(t); return Array.isArray(o.events); } catch { return false; } }
