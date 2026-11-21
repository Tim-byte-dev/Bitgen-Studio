#!/usr/bin/env node
/* bitGen Studio — 2.906.0 in a REAL browser (Tim: "h3 omni is still not changing aspect ratio"): pick FastH3 Omni, Override
 * style on, Basic Settings 540p and Aspect 9:16 (then 16:9), a picture in the References tray, press Generate - the REAL
 * server and worker (stub ComfyUI) render it: the job's log says the size asked and the size MiniMax H3's node got - 544x960,
 * then 960x544. Against the running app (H3_URL) with the stub ComfyUI the gate configures. */
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
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  try { const r = await fetch(URL_); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.route("**/api/comfy/ensure", (r) => r.fulfill({ json: { ok: true, reachable: true } }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && typeof videoStyles !== "undefined" && videoStyles.some((s) => s.name === "FastH3 Omni"), null, { timeout: 60000 });
    await p.waitForFunction(() => performance.now() > 6500, null, { timeout: 20000 });
    const id = await p.evaluate(() => videoStyles.find((s) => s.name === "FastH3 Omni").id);
    const run = async (ar) => {
      await p.evaluate(([v, ar]) => {
        const g = document.getElementById("genModeSel"); if (g) { g.value = "video"; g.dispatchEvent(new Event("change")); }
        const s = document.getElementById("videoStyleSel"); s.value = v; s.dispatchEvent(new Event("change"));
      }, [id, ar]);
      await p.waitForTimeout(400);
      const before = new Set(await p.evaluate(async () => (((d) => (Array.isArray(d) ? d : d.jobs || []))(await (await fetch("/api/jobs?all=1")).json())).map((j) => j.id)));
      await p.evaluate(async (ar) => {
        const o = document.getElementById("ovrStyle"); if (!o.checked) { o.checked = true; o.dispatchEvent(new Event("change", { bubbles: true })); }
        document.querySelector('.modes button[data-mode="ref2va"]').click();
        const rs = document.getElementById("resSel"); rs.value = "540"; rs.dispatchEvent(new Event("change", { bubbles: true }));
        const a = document.getElementById("arSel"); a.value = ar; a.dispatchEvent(new Event("change", { bubbles: true }));
        const bl = await (await fetch("/static/icon.png")).blob();
        refs.length = 0; refs.push({ file: new File([bl], "who.png", { type: "image/png" }) });
      }, ar);
      const wh = await p.evaluate(() => [document.getElementById("width").value, document.getElementById("height").value].join("x"));
      await p.fill("#prompt", "a red cat walks <Picture 1>");
      await p.click("#go");
      let job = null;
      for (let i = 0; i < 40 && !job; i++) {
        await p.waitForTimeout(1000);
        const all = await p.evaluate(async () => ((d) => (Array.isArray(d) ? d : d.jobs || []))(await (await fetch("/api/jobs?all=1")).json()));
        const nw = all.filter((j) => !before.has(j.id));
        if (nw.length) { const d = await p.evaluate(async (jid) => (await fetch("/api/jobs/" + jid)).json(), nw[nw.length - 1].id); if (!["queued", "running"].includes(d.status)) job = d; }
      }
      return { wh, job };
    };
    let r = await run("9:16");
    const L1 = ((r.job || {}).log || []).find((l) => /render size asked/.test(l)) || "";
    check("9:16 in Basic Settings -> the page asks 544x960", r.wh === "544x960", r.wh);
    check("...and FastH3 Omni's MiniMax H3 node gets 544x960 (the job's log says so)", r.job && r.job.status === "done" && /render size asked 544x960: 544x960 \(336 MiniMaxH3ReferenceToVideo\)/.test(L1), [r.job && r.job.status, L1, ((r.job || {}).log || []).slice(-6)]);
    check("...and the 'render complete' line gives the take's own size", ((r.job || {}).log || []).some((l) => /render complete: .*\(\d+x\d+\)/.test(l)));
    r = await run("16:9");
    const L2 = ((r.job || {}).log || []).find((l) => /render size asked/.test(l)) || "";
    check("16:9 -> 960x544 on the node", r.wh === "960x544" && /render size asked 960x544: 960x544 \(336 MiniMaxH3ReferenceToVideo\)/.test(L2), [r.wh, L2]);
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
