#!/usr/bin/env node
/* bitGen Studio — 2.890.0 in a REAL browser: the prompt docker with the "PAN 2" video style - the ⓘ PAN 2 hint shows beside
 * the video style select only for it, Generate goes to POST /api/pan2 (not /api/generate) with the words as written, the
 * seconds / size / seed, the picture typed First frame as `first`, the reference dock's first sound and the ⊖ negative; a 409
 * needs pan2 opens the Download / Cancel box. Then the real server: GET /api/pan2 (Settings ▸ Add-ons' status, ComfyUI's
 * support), POST /api/pan2/caption (no LLM in the test app = bitGen's own one-event caption, checked), POST /api/pan2 with a
 * style that is not PAN 2 refused, /api/generate turning a PAN 2 style away. Against the running app (H3_URL). */
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
  let answer = { id: "fake890", status: "queued", notes: ["PAN 2 from text · 10s (241 frames at 24 fps)"] }, code = 200, intercept = true;
  await p.route("**/api/pan2", async (route) => {
    if (route.request().method() !== "POST" || !intercept) return route.continue();
    sent.push(route.request().postDataBuffer().toString("latin1"));
    route.fulfill({ status: code, json: answer });
  });
  await p.route("**/api/generate", (route) => { generic.push(1); route.fulfill({ json: { id: "nope" } }); });
  await p.route("**/api/jobs/fake890", (route) => route.fulfill({ json: { id: "fake890", status: "done", outputs: [] } }));
  await p.route("**/api/comfy/ensure", (route) => route.fulfill({ json: { ok: true, reachable: true } }));
  await p.route("**/api/comfy/status", (route) => route.fulfill({ json: { reachable: true } }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Pan2Gen && document.getElementById("videoStyleSel")
      && typeof videoStyles !== "undefined" && videoStyles.some((s) => s.arch === "pan2"), null, { timeout: 60000 });
    const id = await ev(() => videoStyles.find((s) => s.arch === "pan2").id);
    const other = await ev(() => videoStyles.find((s) => s.arch === "minimax-h3").id);
    const vis = async (v) => ev((v) => { const s = document.getElementById("videoStyleSel"); s.value = v; s.dispatchEvent(new Event("change")); const t = document.getElementById("pan2Tip");
      return { has: !!t, hidden: t ? t.hidden : null, next: !!t && t.parentNode === s.parentNode, style: !!H3Pan2Gen.style(), tip: t ? t.title : "" }; }, v);
    const a = await vis(id), c = await vis(other);
    check("the ⓘ PAN 2 hint sits with the video style select for the PAN 2 style only, and says the LLM writes the caption",
      a.has && a.hidden === false && a.next && a.style && /caption/.test(a.tip) && c.hidden === true && !c.style, { a, c });
    await vis(id);
    await ev(() => {
      const mk = (n) => new File([new Uint8Array([137, 80, 78, 71])], n, { type: "image/png" });
      refs.length = 0; refs.push({ file: mk("plain.png"), role: "person" }); refs.push({ file: mk("start.png"), role: "first frame" });
      refAuds.length = 0; refAuds.push("song.wav");
      document.getElementById("seconds").value = "12"; document.getElementById("width").value = "1248"; document.getElementById("height").value = "704"; document.getElementById("seed").value = "9";
      if (window.H3Neg) H3Neg.set("cartoon look");
      if (document.getElementById("genModeSel")) document.getElementById("genModeSel").value = "video";
    });
    await ev(() => generateFrom("video", "A brown terrier runs along the beach, then shakes off the water."));
    await p.waitForTimeout(600);
    const body = sent[0] || "";
    const field = (k) => { const m = body.match(new RegExp(`name="${k}"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--`)); return m ? m[1] : null; };
    check("Generate went to /api/pan2, not /api/generate", sent.length === 1 && generic.length === 0, { sent: sent.length, generic: generic.length });
    check("...the words as written (the server's LLM writes the caption)", field("prompt") === "A brown terrier runs along the beach, then shakes off the water.", field("prompt"));
    check("...seconds / size / seed / the style / the first sound / the ⊖ negative", field("seconds") === "12" && field("width") === "1248" && field("height") === "704"
      && field("seed") === "9" && field("video_style_id") === id && field("ref_audio") === "song.wav" && field("negative") === "cartoon look",
      ["seconds", "width", "height", "seed", "ref_audio", "negative"].map(field));
    check("...the picture typed First frame is `first` (image to video), the other not sent", /name="first"; filename="start\.png"/.test(body) && !/plain\.png/.test(body), body.slice(0, 400));
    await ev(() => { refs.length = 0; refAuds.length = 0; if (window.H3Neg) H3Neg.set(""); });
    code = 409; answer = { error: "PAN 2's files are not downloaded yet - Settings ▸ Add-ons ▸ PAN 2", needs: "pan2" };
    const done = ev(() => H3Pan2Gen.submit("x"));
    await p.waitForSelector("dialog.nidlg[open]", { timeout: 8000 }).catch(() => null);
    const box = await ev(() => { const d = document.querySelector("dialog.nidlg[open]"); return d ? d.textContent : ""; });
    check("a 409 needs pan2 opens the Download / Cancel box for PAN 2", /PAN 2/.test(box) && /Cancel/.test(box), box.slice(0, 300));
    await ev(() => { const d = document.querySelector("dialog.nidlg[open]"); const bt = d && [...d.querySelectorAll("button")].find((x) => /Cancel/.test(x.textContent)); if (bt) bt.click(); });
    check("...Cancel = no job", (await done) === null);
    // the real server
    intercept = false;
    const st = await ev(async () => (await fetch("/api/pan2")).json());
    check("GET /api/pan2: the add-on's status (int8 / bf16 sets), ComfyUI's support, 20 s at most, PAN 2's defaults",
      Array.isArray(st.items) && st.items.map((i) => i.id).join() === "int8,bf16" && st.comfy && typeof st.comfy.nodes === "boolean"
      && st.max_seconds === 20 && st.defaults && st.defaults.steps === 50 && st.defaults.cfg === 2.5, st);
    const cap = await ev(async () => (await fetch("/api/pan2/caption", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "a dog runs on the beach", seconds: 7 }) })).json());
    const capObj = (() => { try { return JSON.parse(cap.caption); } catch (e) { return null; } })();
    check("POST /api/pan2/caption: a seven-key caption covering 0 to 7 s (the LLM's, or bitGen's own when no LLM answers - said)",
      capObj && Object.keys(capObj).join() === "video_style,lighting,perspective_view,subjects_lifecycle,init_frame_visual_description,events,quality"
      && /to 7$/.test(capObj.events[capObj.events.length - 1].time_range_sec) && ["llm", "wrapped"].includes(cap.how) && Array.isArray(cap.notes), cap);
    const bad = await ev(async (o) => { const fd = new FormData(); fd.append("prompt", "x"); fd.append("video_style_id", o); const r = await fetch("/api/pan2", { method: "POST", body: fd }); return { s: r.status, j: await r.json() }; }, other);
    check("POST /api/pan2 with a style that is not PAN 2 is refused in words", bad.s === 400 && /PAN 2/.test(bad.j.error), bad);
    await p.unroute("**/api/generate");
    const gen = await ev(async (o) => { const fd = new FormData(); fd.append("prompt", "x"); fd.append("mode", "t2va"); fd.append("video_style_id", o); const r = await fetch("/api/generate", { method: "POST", body: fd }); return { s: r.status, j: await r.json() }; }, id);
    check("/api/generate turns a PAN 2 style away (an old tab), pointing at PAN 2's own path", gen.s === 400 && /PAN 2 style/.test(gen.j.error) && /\/api\/pan2/.test(gen.j.error), gen);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
