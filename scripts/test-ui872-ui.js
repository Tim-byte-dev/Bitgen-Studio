#!/usr/bin/env node
/* bitGen Studio — 2.872.0 in a REAL browser: the prompt docker with the "H3 Long Video (40 s)" video style - the 2K tick
 * shows beside the video style select only for it (and is remembered), Generate goes to POST /api/h3long (not
 * /api/generate) with the prompt as written, a "Characters:" paragraph taken out as the memory, the seconds / size /
 * seed, the picture typed First frame first and the others as references; another style hides the tick. A 409 needs
 * h3long opens the Download / Cancel box. The render is answered by the test. Against the running app (H3_URL). */
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
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const sent = [], generic = [];
  let answer = { id: "fake872", status: "queued", notes: ["H3 Long Video: 2 shots of 20 s (fixed)"] }, code = 200;
  await p.route("**/api/h3long", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    sent.push(route.request().postDataBuffer().toString("latin1"));
    route.fulfill({ status: code, json: answer });
  });
  await p.route("**/api/generate", (route) => { generic.push(1); route.fulfill({ json: { id: "nope" } }); });
  await p.route("**/api/jobs/fake872", (route) => route.fulfill({ json: { id: "fake872", status: "done", outputs: [] } }));
  await p.route("**/api/comfy/ensure", (route) => route.fulfill({ json: { ok: true, reachable: true } }));
  await p.route("**/api/comfy/status", (route) => route.fulfill({ json: { reachable: true } }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3LongGen && document.getElementById("videoStyleSel")
      && typeof videoStyles !== "undefined" && videoStyles.some((s) => s.arch === "h3-long"), null, { timeout: 60000 });
    const id = await ev(() => videoStyles.find((s) => s.arch === "h3-long").id);
    const other = await ev(() => videoStyles.find((s) => s.arch === "minimax-h3").id);
    const vis = async (v) => ev((v) => { const s = document.getElementById("videoStyleSel"); s.value = v; s.dispatchEvent(new Event("change")); const bx = document.getElementById("h3l2kBox");
      return { has: !!bx, hidden: bx ? bx.hidden : null, next: !!bx && bx.parentNode === s.parentNode, style: !!H3LongGen.style() }; }, v);
    const a = await vis(id), c = await vis(other);
    check("the 2K tick sits with the video style select for H3 Long Video only", a.has && a.hidden === false && a.next && a.style && c.hidden === true && !c.style, { a, c });
    await vis(id);
    await ev(() => { const cb = document.getElementById("h3l2k"); if (!cb.checked) cb.click(); });
    check("...the tick is remembered", await ev(() => localStorage.getItem("h3long.2k") === "1"));
    // pictures: one plain, one typed First frame
    await ev(() => {
      const mk = (n) => new File([new Uint8Array([137, 80, 78, 71])], n, { type: "image/png" });
      refs.length = 0; refs.push({ file: mk("plain.png"), role: "person" }); refs.push({ file: mk("start.png"), role: "first frame" });
      document.getElementById("seconds").value = "40"; document.getElementById("width").value = "1280"; document.getElementById("height").value = "720"; document.getElementById("seed").value = "9";
      if (document.getElementById("genModeSel")) document.getElementById("genModeSel").value = "video";
    });
    await ev(() => generateFrom("video", "Characters: Ann: <Picture 1>, red hair\n\nA market at noon.\n\nAnn smiles.\n\nAnn waves."));
    await p.waitForTimeout(600);
    const body = sent[0] || "";
    const field = (k) => { const m = body.match(new RegExp(`name="${k}"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--`)); return m ? m[1] : null; };
    check("Generate went to /api/h3long, not /api/generate", sent.length === 1 && generic.length === 0, { sent: sent.length, generic: generic.length });
    check("...the prompt as written without the Characters paragraph, which is the memory", String(field("prompt")).replace(/\r\n/g, "\n") === "A market at noon.\n\nAnn smiles.\n\nAnn waves." /* the browser sends CRLF */ && field("memory") === "Ann: <Picture 1>, red hair", { p: field("prompt"), m: field("memory") });
    check("...seconds / size / seed / 2K / the style", field("seconds") === "40" && field("width") === "1280" && field("height") === "720" && field("seed") === "9" && field("upscale2k") === "1" && field("video_style_id") === id,
      ["seconds", "width", "height", "seed", "upscale2k"].map(field));
    check("...the First frame picture is `first`, the other a reference", /name="first"; filename="start\.png"/.test(body) && /name="refs"; filename="plain\.png"/.test(body), body.slice(0, 400));
    // missing parts -> the Download / Cancel box
    code = 409; answer = { error: "H3 Long Video needs: the H3-LongVideos node pack", needs: "h3long" };
    const done = ev(() => H3LongGen.submit("x"));
    await p.waitForSelector("dialog.nidlg[open]", { timeout: 8000 }).catch(() => null);
    const box = await ev(() => { const d = document.querySelector("dialog.nidlg[open]"); return d ? d.textContent : ""; });
    check("a 409 needs h3long opens the Download / Cancel box for H3 Long Video", /H3 Long Video/.test(box) && /Cancel/.test(box), box.slice(0, 300));
    await ev(() => { const d = document.querySelector("dialog.nidlg[open]"); const bt = d && [...d.querySelectorAll("button")].find((x) => /Cancel/.test(x.textContent)); if (bt) bt.click(); });
    check("...Cancel = no job", (await done) === null);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
