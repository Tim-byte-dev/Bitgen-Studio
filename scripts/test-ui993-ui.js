#!/usr/bin/env node
/* bitGen Studio — 2.993.0 in a REAL browser: ✨ Photo never leaves the grey. Tim: "please fix the prompt background issue, it
 * still produces a gray background but it does use the reference picture". The AI server is stubbed (what is sent is kept;
 * pass 1 answers with the picture it got, pass 2 with a blue picture) - the pictures are checked pixel by pixel. */
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
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
(async () => {
  if (!chromium) { console.log("FAIL: playwright is not installed here"); console.log("\nRESULT: 0 passed, 1 failed"); process.exit(1); }
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && document.getElementById("tX_pushpulldock") && window.H3SketcherReal, null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.V, null, { timeout: 40000 });
    await p.waitForTimeout(1200); await ev(() => H3PushPull.newModel()); await p.waitForFunction(() => !H3PushPull.state.M.f.length, null, { timeout: 10000 });
    await ev(() => { const G = PPGeo, S = H3PushPull.state, before = H3PushPull.snapshot(); const F = G.addFace(S.M, [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]]); G.pushPull(S.M, F.id, 1.5); H3PushPull.commit("t", before); S.V.view("iso"); S.V.extents(); });
    await p.waitForTimeout(800);
    // the AI server stubbed
    await ev(() => {
      const J = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: { "Content-Type": "application/json" } });
      window.__sent = []; window.__saved = []; window.__refuse2 = false; window.__n = 0; const real = window.fetch.bind(window);
      const blue = async (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = "#1030e0"; g.fillRect(0, 0, w, h); return new Promise((ok) => c.toBlob(ok, "image/png")); };
      window.fetch = async (u, o) => {
        const s = String(u);
        if (s.startsWith("/api/aiedit/engines")) return J({ edit: [{ id: "stub_edit", name: "Stub edit" }] });
        if (s === "/api/aiedit") {
          const fd = o.body, rec = {}; for (const [k, v] of fd.entries()) rec[k] = v; window.__sent.push(rec);
          if (rec.fill_edit === "1" && window.__refuse2) return J({ error: "no edit model can fill here" }, 400);
          const id = "ui993_" + (++window.__n); window["__job_" + id] = rec; return J({ jobs: [{ id }] });
        }
        const m = s.match(/^\/api\/jobs\/(ui993_\d+)/); if (m) return J({ status: "done", outputs: [m[1] + ".png"] });
        const mo = s.match(/^\/outputs\/(ui993_\d+)\.png/);
        if (mo) { const rec = window["__job_" + mo[1]]; if (rec.fill_edit === "1") { const bm = await createImageBitmap(rec.crop); return new Response(await blue(bm.width, bm.height), { headers: { "Content-Type": "image/png" } }); }
          const bm1 = await createImageBitmap(rec.crop), c1 = document.createElement("canvas"); c1.width = bm1.width; c1.height = bm1.height; const q1 = c1.getContext("2d"); q1.drawImage(bm1, 0, 0); q1.globalCompositeOperation = "difference"; q1.fillStyle = "#303030"; q1.fillRect(0, 0, c1.width, c1.height);
          return new Response(await new Promise((ok) => c1.toBlob(ok, "image/png")), { headers: { "Content-Type": "image/png" } }); }   // pass 1 answers with its picture 1, 48 off each channel (2.995.0: changed - a "photo", so no second try)
        if (s === "/api/passets" && o && o.method === "POST") { window.__saved.push(o.body.get("file")); return J({ name: "ui993_photo.png" }); }
        return real(u, o);
      };
      H3SketcherReal.state && (H3SketcherReal.state().engines = null);
      // the prompt docker's references (index.html's top-level refs)
      refs.length = 0;
    });
    const px = async (expr, pts) => ev(async (a) => { const bm = await createImageBitmap(new Function("return " + a.expr)()), c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; const g = c.getContext("2d"); g.drawImage(bm, 0, 0);
      return { w: bm.width, h: bm.height, pts: a.pts.map((q) => Array.from(g.getImageData(Math.round(q[0] * (bm.width - 1)), Math.round(q[1] * (bm.height - 1)), 1, 1).data)) }; }, { expr, pts });
    const runIt = (text) => ev(async (t) => { window.__sent = []; window.__saved = []; document.getElementById("prompt").value = t; try { await H3SketcherReal.run(t); } catch (e) { return String(e.message || e); } return null; }, text);
    const near = (a, b2, d) => a.slice(0, 3).every((v, i) => Math.abs(v - b2[i]) <= (d || 12));
    const center = await ev(() => { const V = H3PushPull.state.V, c = V.shot(400, 300, { clean: true, transparent: true }), g = c.getContext("2d"), d = g.getImageData(0, 0, 400, 300).data; let sx = 0, sy = 0, n = 0; for (let y = 0; y < 300; y++) for (let x = 0; x < 400; x++) if (d[(y * 400 + x) * 4 + 3] > 250) { sx += x; sy += y; n++; } return [sx / n / 399, sy / n / 299]; });

    // ---- A: words, no references -> two passes; the grey is painted green and filled
    let err = await runIt("a woman standing in a park");
    let sent = await ev(() => window.__sent.map((r) => ({ prompt: r.prompt, fill: r.fill_edit, kind: r.fill_kind, mode: r.mode, mask: !!r.mask, ref0: !!r.ref0, raw: r.ref_raw, whole: r.whole || null, edit: r.edit_style_id, style: r.style_id })));
    check("words: two passes (the photo, then the place round the model)", !err && sent.length === 2, { err, sent });
    check("…pass 1 as before: the model on the flat grey + the EMPTY line", /flat plain grey/.test(sent[0].prompt) && !sent[0].fill);
    check("…pass 2 = a fill through the same edit model under a mask (fill_edit, generate, not whole), the prompt's place in it",
      sent[1].fill === "1" && sent[1].kind === "generate" && sent[1].mode === "generate" && sent[1].mask && !sent[1].whole && sent[1].edit && sent[1].edit === sent[0].style && sent[1].raw === "1"
      && /The place and the scene: a woman standing in a park/.test(sent[1].prompt) && /Never leave green, grey, white/.test(sent[1].prompt) && !sent[1].ref0, sent[1]);
    const g2 = await px("window.__sent[1].crop", [[0.02, 0.02], [0.98, 0.5], center]), mk = await px("window.__sent[1].mask", [[0.02, 0.02], center]), g1 = await px("window.__sent[0].crop", [[0.02, 0.02], center]);
    const p1 = (q) => q.slice(0, 3).map((v) => Math.abs(v - 48));   // pass 1's answer at that pixel
    check("…pass 2's picture: the grey round the model painted GREEN, the model itself kept", near(g2.pts[0], [0, 255, 0], 2) && near(g2.pts[1], [0, 255, 0], 2) && near(g2.pts[2], p1(g1.pts[1])) && near(g1.pts[0], [128, 128, 128], 4), { g2, g1 });
    check("…its mask: the background transparent (filled), the model opaque (kept)", mk.pts[0][3] === 0 && mk.pts[1][3] === 255, mk);
    const sv = await px("window.__saved[0]", [[0.02, 0.02], [0.98, 0.98], center]);
    check("the photo kept: the filled place round the model (no grey, no green left), the model's own pixels from pass 1", near(sv.pts[0], [16, 48, 224]) && near(sv.pts[1], [16, 48, 224]) && near(sv.pts[2], p1(g1.pts[1])), sv);
    const last = await ev(() => H3SketcherReal.last());
    check("…said what was done (fillJob)", last && last.fill === true && /^ui993_/.test(last.fillJob || "") && !last.placed, last);

    // ---- B: an "environment" reference -> the model drawn INTO it, one pass, no grey at all
    await ev(() => { const c = document.createElement("canvas"); c.width = 64; c.height = 48; const g = c.getContext("2d"); g.fillStyle = "#c83c14"; g.fillRect(0, 0, 64, 48); refs.push({ url: c.toDataURL("image/png"), role: "environment" }); });
    err = await runIt("a woman standing in a park");
    sent = await ev(() => window.__sent.map((r) => ({ prompt: r.prompt, fill: r.fill_edit })));
    const g3 = sent.length ? await px("window.__sent[0].crop", [[0.02, 0.02], [0.98, 0.98], center]) : null;
    check("an environment reference: one pass, picture 1 = the model over that picture (its colour in the corners, no grey)", !err && sent.length === 1 && g3 && near(g3.pts[0], [200, 60, 20]) && near(g3.pts[1], [200, 60, 20]) && !near(g3.pts[2], [200, 60, 20], 30), { err, sent: sent.length, g3 });
    check("…the prompt says the place is already there (PLACED), not the grey EMPTY line", sent[0] && /already shows the 3D model standing in its place/.test(sent[0].prompt) && !/flat plain grey/.test(sent[0].prompt), sent[0] && sent[0].prompt);

    // ---- C: a reference of another Type (the default "person") and no words -> two passes, the reference goes along as the look
    await ev(() => { refs[0].role = "person"; });
    err = await runIt("");
    sent = await ev(() => window.__sent.map((r) => ({ prompt: r.prompt, fill: r.fill_edit, ref0: !!r.ref0 })));
    check("a reference that is not an environment, no words: two passes, the reference is pass 2's look ({img2})", !err && sent.length === 2 && sent[1].fill === "1" && sent[1].ref0 && /\{img2\} is the reference picture/.test(sent[1].prompt), { err, sent });

    // ---- D: pass 2 refused -> the first photo is kept, said
    await ev(() => { window.__refuse2 = true; });
    err = await runIt("a beach at sunset");
    const msg = await ev(() => H3SketcherReal.last());
    check("pass 2 refused: the first photo is still saved (no error), the fill not done", !err && (await ev(() => window.__saved.length)) === 1 && msg.fillJob === null, { err, msg });
    await ev(() => { window.__refuse2 = false; refs.length = 0; });

    // ---- E: 2.995.0 no words, no references -> the SAME rule: the grey + pass 2 (the pale sky colour came back as a grey background)
    err = await runIt("");
    sent = await ev(() => window.__sent.map((r) => ({ fill: r.fill_edit, prompt: r.prompt })));
    const g5 = sent.length ? await px("window.__sent[0].crop", [[0.02, 0.02]]) : null;
    check("2.995.0 no words and no references: two passes too - picture 1 on the grey (EMPTY_ANY: a real place that suits the model), then the fill", !err && sent.length === 2 && sent[1].fill === "1" && g5 && near(g5.pts[0], [128, 128, 128], 4) && /a real place that suits the model/.test(sent[0].prompt) && !/add nothing else/.test(sent[0].prompt) && /Add nothing to the model itself/.test(sent[0].prompt), { err, sent: sent.length, g5 });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing", false, String(e && e.stack || e)); }
  finally { try { await ev(() => { refs.length = 0; }); } catch (e) { /* gone */ } await b.close(); }
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
