#!/usr/bin/env node
/* bitGen Studio — 2.388.0 APPEND / PREPEND in a REAL browser: the reference dock's video Use dropdown.
 * Tim: "add option to dropdown in reference docker video dropdown -"Append" ... "prepend" ... this will work from the
 * generate button in the prompt docker".
 * Run against the running app (H3_URL, default the e2e server on :8311). /api/generate is STUBBED (its request read).
 * No Playwright here = SKIP (exit 0).
 *   1. every reference video has a Use dropdown: Reference / Append / Prepend; a click on it does not open the frame picker;
 *   2. one op video at a time (the other back to Reference), the op video outlined;
 *   3. Generate: ref_video_op + mode fl2va + only the Last frame picture (append) / First frame picture (prepend);
 *      Reference = an ordinary Generate (no ref_video_op);
 *   4. kept with the project (projectState); ✕ clears it. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the Append / Prepend browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const field = (body, k) => { const m = new RegExp(`name="${k}"\\r\\n\\r\\n([^\\r]*)`).exec(body || ""); return m ? m[1] : null; };
const files = (body) => [...(body || "").matchAll(/name="references"; filename="([^"]+)"/g)].map((m) => m[1]);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1900, height: 1150 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const bodies = [];
  // the reference dock may sit under another docker at this size - the controls are driven as the page's own events
  const pick = (sel, v) => p.evaluate(([q, val]) => { const e = document.querySelector(q); e.value = val; e.dispatchEvent(new Event("change", { bubbles: true })); }, [sel, v]);
  try {
    await p.route("**/api/generate", (r) => { bodies.push(r.request().postData() || ""); r.fulfill({ json: { id: "fo1", status: "queued" } }); });
    await p.route("**/api/comfy/status", (r) => r.fulfill({ json: { ok: true, running: true, reachable: true, engine: "sdcli" } }));
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    // 2.399.0: + H3_PROJECT_READY - the boot's project load refills the reference dock (and its ops); waiting a fixed
    // time alone raced it on a busy machine
    await p.waitForFunction(() => typeof renderRefLists === "function" && window.RefRoles && typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY, null, { timeout: 60000 });
    await p.waitForTimeout(2500);         // the boot's own project load (it refills the reference dock) settles first
    await p.evaluate(() => {
      const d = document.getElementById("refsdock");
      if (d.classList.contains("dockgone")) toggleDockGone("refsdock", null);
      if (d.classList.contains("collapsed")) toggleCollapse("refsdock");
      refs.length = 0; refVids.length = 0; refVids.push("fo_a.mp4", "fo_b.mp4"); refVidOps = {}; renderRefLists();
    });
    await p.evaluate(() => document.querySelector('#reftabs [data-rtab="vid"]').click());
    await p.waitForTimeout(200);

    // 1
    const opts = await p.$$eval("#refvids .rvop", (ss) => ss.map((s) => [...s.options].map((o) => o.value + ":" + o.textContent)));
    check("each reference video has a Use dropdown: Reference / Append / Prepend", opts.length === 2
      && opts.every((o) => o.join() === ":Reference,append:Append,prepend:Prepend"), opts);
    await p.evaluate(() => document.querySelector('#refvids [data-refvid="fo_b.mp4"] .rvop').dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await p.waitForTimeout(250);
    const picker = await p.evaluate(() => !!document.querySelector(".rsel-back, #refSelect, .refsel:not(.off)") && [...document.querySelectorAll(".rsel-back, #refSelect, .refsel")].some((e) => e.offsetParent));
    check("...a click on it does not open the frame picker", !picker, picker);
    await p.keyboard.press("Escape");

    // 2
    await pick('#refvids [data-refvid="fo_b.mp4"] .rvop', "append");
    await p.waitForTimeout(150);
    const s1 = await p.evaluate(() => ({ ops: refVidOps, on: [...document.querySelectorAll("#refvids .aitem.rvop-on")].map((e) => e.dataset.refvid),
      vals: [...document.querySelectorAll("#refvids .rvop")].map((s) => s.value) }));
    check("Append on one video: kept, the item outlined", JSON.stringify(s1.ops) === '{"fo_b.mp4":"append"}' && s1.on.join() === "fo_b.mp4" && s1.vals.join() === ",append", s1);
    await pick('#refvids [data-refvid="fo_a.mp4"] .rvop', "prepend");
    await p.waitForTimeout(150);
    const s2 = await p.evaluate(() => ({ ops: refVidOps, vals: [...document.querySelectorAll("#refvids .rvop")].map((s) => s.value) }));
    check("one op video at a time: Prepend on the other sets the first back to Reference", JSON.stringify(s2.ops) === '{"fo_a.mp4":"prepend"}' && s2.vals.join() === "prepend,", s2);

    // 3
    await p.evaluate(() => {
      const mk = (n, role) => ({ file: new File([new Uint8Array([137, 80, 78, 71])], n, { type: "image/png" }), url: "", subject: 1, role, roleOther: "" });
      refs.push(mk("subj.png", "person"), mk("first.png", "first frame"), mk("last.png", "last frame"));
    });
    await p.evaluate(() => { window.__fol = []; const o = window.logLine; window.logLine = (t) => { window.__fol.push(String(t)); return o(t); }; });
    await p.evaluate(() => submitJob("the clip goes on"));
    await p.waitForTimeout(300);
    const bp = bodies[bodies.length - 1];
    check("Generate, Prepend: ref_video_op prepend, mode fl2va, only the First frame picture sent",
      field(bp, "ref_video_op") === '{"name":"fo_a.mp4","op":"prepend"}' && field(bp, "mode") === "fl2va" && files(bp).join() === "first.png",
      { op: field(bp, "ref_video_op"), mode: field(bp, "mode"), files: files(bp) });
    await p.evaluate(() => { if (!refVids.includes("fo_b.mp4")) { refVids.length = 0; refVids.push("fo_a.mp4", "fo_b.mp4"); renderRefLists(); } });
    await pick('#refvids [data-refvid="fo_b.mp4"] .rvop', "append");
    await p.evaluate(() => submitJob("the clip goes on"));
    await p.waitForTimeout(300);
    const ba = bodies[bodies.length - 1];
    check("Generate, Append: ref_video_op append, only the Last frame picture sent",
      field(ba, "ref_video_op") === '{"name":"fo_b.mp4","op":"append"}' && files(ba).join() === "last.png", { op: field(ba, "ref_video_op"), files: files(ba) });
    const log = await p.evaluate(() => (window.__fol || []).join("\n"));
    check("...the log says what the op does", /Append: fo_b\.mp4's last frame starts the new part/.test(log) && /Prepend: fo_a\.mp4's first frame ends the new part/.test(log));

    // 4
    const st = await p.evaluate(() => projectState().refVidOps);
    check("kept with the project (projectState().refVidOps)", JSON.stringify(st) === '{"fo_b.mp4":"append"}', st);
    const kept = await p.evaluate(async () => {
      const save = { v: refVids.slice(), o: refVidOps, r: refs.slice() };
      await loadProjectReferences({ images: [], videos: ["fo_a.mp4", "fo_b.mp4"], audio: [] });
      const k = JSON.stringify(refVidOps);
      await loadProjectReferences({ images: [], videos: ["fo_a.mp4"], audio: [] });
      const gone = JSON.stringify(refVidOps);
      refVids.length = 0; refVids.push(...save.v); refVidOps = save.o; refs.length = 0; refs.push(...save.r); renderRefLists();
      return { k, gone };
    });
    check("...and survives the project's reference reload (an op on a video no longer there is dropped)",
      kept.k === '{"fo_b.mp4":"append"}' && kept.gone === "{}", kept);
    await p.evaluate(() => document.querySelector('#refvids [data-refvid="fo_b.mp4"] .gdel').click());
    await p.waitForTimeout(150);
    await p.evaluate(() => submitJob("plain"));
    await p.waitForTimeout(300);
    const bn = bodies[bodies.length - 1];
    const s4 = await p.evaluate(() => ({ ops: refVidOps, vids: refVids.slice() }));
    check("✕ on the op video clears its op; the next Generate is an ordinary one (no ref_video_op)",
      JSON.stringify(s4.ops) === "{}" && s4.vids.join() === "fo_a.mp4" && field(bn, "ref_video_op") === null, { s4, op: field(bn, "ref_video_op") });
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 800));
  } finally {
    try { await p.evaluate(() => { refs.length = 0; refVids.length = 0; refVidOps = {}; renderRefLists(); }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
