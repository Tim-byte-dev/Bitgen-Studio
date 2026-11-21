#!/usr/bin/env node
/* bitGen Studio — 2.907.0 in a REAL browser (Tim: "every video i tried only renders 16:9"):
 *   1. Basic Settings ▸ Format "Landscape 16:9" (sets Aspect 16:9), then Aspect 9:16 by hand -> Format becomes "social,
 *      the render's own shape" and the size is 544x960;
 *   2. Override style ON: a style that carries 720p 16:9 leaves Basic Settings' 9:16 alone; OFF: it still sets 16:9;
 *   3. the gallery's thumbnails show the whole take (object-fit contain);
 *   4. the REAL server + worker (stub ComfyUI renders at the graph's size): a 544x960 render sent WITH the old
 *      "Landscape 16:9" Format comes out 544x960 (its own shape, said), not cut to a 16:9 band.
 * Against the running app (H3_URL) with the stub ComfyUI the gate configures. */
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
    const set = (id, v) => p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }, [id, v]);
    const val = (id) => p.evaluate((id) => document.getElementById(id).value, id);
    // 1. a social Format, then Aspect by hand
    await set("resSel", "540");
    await set("format", "social_16x9");
    check("Format 'Landscape 16:9' sets Aspect 16:9 (2.600)", (await val("arSel")) === "16:9", await val("arSel"));
    await set("arSel", "9:16");
    check("Aspect 9:16 by hand -> Format 'social, the render's own shape'", (await val("format")) === "social", await val("format"));
    check("...and the size is 544x960", `${await val("width")}x${await val("height")}` === "544x960", `${await val("width")}x${await val("height")}`);
    await set("format", "social_4x5");
    check("the feed's 4:5 still sets 3:4 and stays", (await val("arSel")) === "3:4" && (await val("format")) === "social_4x5", [await val("arSel"), await val("format")]);
    await set("format", "mp4");
    await set("arSel", "9:16");
    // 2. Override style and a style carrying 720p 16:9
    const st = { name: "T907", res: "720", aspect: "16:9", phases: [{ steps: 33, cfg: 4 }] };
    const pick = (on) => p.evaluate(([st, on]) => {
      const o = document.getElementById("ovrStyle"); if (o.checked !== on) { o.checked = on; o.dispatchEvent(new Event("change", { bubbles: true })); }
      inheritVideoStyle(st);
      return { ar: document.getElementById("arSel").value, res: document.getElementById("resSel").value, wh: document.getElementById("width").value + "x" + document.getElementById("height").value };
    }, [st, on]);
    let r = await pick(true);
    check("Override style ON: a 720p 16:9 style leaves Basic Settings at 540p 9:16 (544x960)", r.ar === "9:16" && r.res === "540" && r.wh === "544x960", r);
    r = await pick(false);
    check("Override style OFF: the style still sets 720p 16:9 (2.111.3)", r.ar === "16:9" && r.res === "720" && r.wh === "1280x720", r);
    await set("resSel", "540"); await set("arSel", "9:16");
    // 3. the gallery's thumbnails
    const fit = await p.evaluate(() => { const d = document.createElement("div"); d.className = "thumb"; const v = document.createElement("video"); d.appendChild(v); document.body.appendChild(d); const f = getComputedStyle(v).objectFit; d.remove(); return f; });
    check("gallery thumbnails: object-fit contain (a 9:16 take shows 9:16)", fit === "contain", fit);
    // 4. the server: a 544x960 render sent with the old Format "Landscape 16:9"
    const id = await p.evaluate(() => videoStyles.find((s) => s.name === "FastH3 Omni").id);
    const jid = await p.evaluate(async (vid) => {
      const fd = new FormData();
      fd.append("mode", "ref2va"); fd.append("prompt", "a red cat walks <Picture 1>"); fd.append("video_style_id", vid);
      for (const [k, v] of [["width", "544"], ["height", "960"], ["steps", "0"], ["cfg", "1"], ["seed", "7"], ["format", "social_16x9"], ["frames", "24"]]) fd.append(k, v);
      fd.append("references", new File([await (await fetch("/static/icon.png")).blob()], "who.png", { type: "image/png" }));
      const j = await (await fetch("/api/generate", { method: "POST", body: fd })).json();
      return j.id || j.job_id || JSON.stringify(j);
    }, id);
    let job = null;
    for (let i = 0; i < 60 && !job; i++) {
      await p.waitForTimeout(1000);
      const d = await p.evaluate(async (j) => (await fetch("/api/jobs/" + j)).json(), jid);
      if (d && d.status && !["queued", "running"].includes(d.status)) job = d;
    }
    const log = (job && job.log) || [];
    check("the render finished", job && job.status === "done", [jid, job && job.status, log.slice(-8)]);
    check("[social] says the 544x960 render keeps its own shape", log.some((l) => /\[social\] the render was asked at 544x960 \(portrait\) but Format says 16:9/.test(l)), log.filter((l) => /social/.test(l)));
    check("...and social.py converts it in its own shape (the stub renders 192x108 whatever the size; scripts/social.py target keeps a portrait source portrait - test-907.js)", log.some((l) => /\[social\] making .* \(its own shape\)/.test(l)), log.filter((l) => /social/.test(l)));
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
