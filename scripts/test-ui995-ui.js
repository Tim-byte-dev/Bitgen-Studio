#!/usr/bin/env node
/* bitGen Studio — 2.995.0 in a REAL browser: ✨ Photo / ✏ Edit (Sketcher) give the same result every time, and queue.
 * Tim: "please check the condional statements for edit sketcher button and photo button in sketcher, i am getting mixed
 * results, sometimes correct, sometimes with a gray mannequin, sometimes with gray bg. allow multiple edits, add it to the queue"
 * The AI server is stubbed; what each job answers is set per test (the pictures are checked pixel by pixel). */
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

    // ---- the model's coverage from a SILHOUETTE (the renderer has no alpha channel - a real GPU gave an opaque black "transparent")
    const sil = await ev(() => {
      const V = H3PushPull.state.V; V.shadows(true); const before = V.ground.visible, rd = (c) => { const g = c.getContext("2d"); return g.getImageData(0, 0, c.width, c.height).data; };
      const m = rd(V.shot(320, 240, { clean: true, mask: true })), t = rd(V.shot(320, 240, { clean: true, transparent: true }));
      const at = (d, x, y) => Array.from(d.slice((y * 320 + x) * 4, (y * 320 + x) * 4 + 4));
      let same = 0, n = 0; for (let i = 0; i < m.length; i += 4 * 7) { n++; if (Math.abs(t[i + 3] - m[i]) <= 1) same++; }
      return { mc: at(m, 2, 2), mm: at(m, 160, 120), tc: at(t, 2, 2), tm: at(t, 160, 120), same: same / n, groundAfter: V.ground.visible === before && before };
    });
    check("V.shot mask: the model white on black (no sky, ground or lines)", sil.mc.slice(0, 3).every((v) => v === 0) && sil.mm.slice(0, 3).every((v) => v > 240), sil);
    check("…a transparent shot takes its alpha from that silhouette (not the drawing buffer's) - clear round the model, solid on it; the view put back", sil.same > 0.99 && sil.tc[3] === 0 && sil.tm[3] === 255 && sil.groundAfter === true, sil);

    // the AI server stubbed: window.__answer(rec, nth) -> "same" | "changed" | "grey" | "blue"; window.__hold = jobs stay running
    await ev(() => {
      const J = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: { "Content-Type": "application/json" } });
      window.__sent = []; window.__saved = []; window.__n = 0; window.__hold = false; const real = window.fetch.bind(window);
      const draw = async (rec, how) => { const bm = await createImageBitmap(rec.crop), c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; const g = c.getContext("2d");
        if (how === "grey") { g.fillStyle = "#808080"; g.fillRect(0, 0, c.width, c.height); }
        else if (how === "blue") { g.fillStyle = "#1030e0"; g.fillRect(0, 0, c.width, c.height); }
        else { g.drawImage(bm, 0, 0); if (how === "changed") { g.globalCompositeOperation = "difference"; g.fillStyle = "#303030"; g.fillRect(0, 0, c.width, c.height); } }
        return new Promise((ok) => c.toBlob(ok, "image/png")); };
      window.fetch = async (u, o) => {
        const s = String(u);
        if (s.startsWith("/api/aiedit/engines")) return J({ edit: [{ id: "stub_edit", name: "Stub edit" }] });
        if (s === "/api/aiedit") { const rec = {}; for (const [k, v] of o.body.entries()) rec[k] = v; window.__sent.push(rec); const id = "ui995_" + (++window.__n); rec.nth = window.__sent.length; window["__job_" + id] = rec; return J({ jobs: [{ id }] }); }
        const m = s.match(/^\/api\/jobs\/(ui995_\d+)/); if (m) return J(window.__hold ? { status: "running" } : { status: "done", outputs: [m[1] + ".png"] });
        const mo = s.match(/^\/outputs\/(ui995_\d+)\.png/);
        if (mo) { const rec = window["__job_" + mo[1]]; return new Response(await draw(rec, window.__answer(rec)), { headers: { "Content-Type": "image/png" } }); }
        if (s === "/api/passets" && o && o.method === "POST") { window.__saved.push(o.body.get("file")); return J({ name: "ui995_photo_" + window.__saved.length + ".png" }); }
        return real(u, o);
      };
      refs.length = 0;
    });
    const px = async (expr, pts) => ev(async (a) => { const bm = await createImageBitmap(new Function("return " + a.expr)()), c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; const g = c.getContext("2d"); g.drawImage(bm, 0, 0);
      return { pts: a.pts.map((q) => Array.from(g.getImageData(Math.round(q[0] * (bm.width - 1)), Math.round(q[1] * (bm.height - 1)), 1, 1).data)) }; }, { expr, pts });
    const near = (a, b2, d) => a.slice(0, 3).every((v, i) => Math.abs(v - b2[i]) <= (d || 12));
    const answer = (src) => ev((s) => { window.__answer = new Function("rec", s); }, src);
    const runIt = (text) => ev(async (t) => { window.__sent = []; window.__saved = []; document.getElementById("prompt").value = t; try { await H3SketcherReal.run(t); } catch (e) { return String(e.message || e); } return null; }, text);
    const sentNow = () => ev(() => window.__sent.map((r) => ({ prompt: r.prompt, fill: r.fill_edit || null })));

    // ---- A: the first photo came back STILL the 3D render (the grey mannequin) -> tried once more with short, direct words
    await answer('return rec.fill_edit === "1" ? "blue" : rec.nth === 1 ? "same" : "changed";');
    let err = await runIt("a woman standing in a park"), sent = await sentNow(), last = await ev(() => H3SketcherReal.last());
    check("a grey mannequin back from pass 1: sent again (retryPrompt: 'Make {img1} a real photograph … nothing like a grey 3D model'), then the fill", !err && sent.length === 3 && !sent[1].fill && /^Make \{img1\} a real photograph/.test(sent[1].prompt) && /grey 3D model, a mannequin/.test(sent[1].prompt) && /\nThe prompt: a woman standing in a park$/.test(sent[1].prompt) && sent[2].fill === "1", { err, sent });
    check("…the changed photo is the one kept (retried, its change measured)", last && last.retried === true && last.change > 9 && last.mode === "fill", last);

    // ---- B: pass 2 left the grey -> filled once more, strict, without the reference
    await answer('if (rec.fill_edit === "1") return /Every green pixel/.test(rec.prompt) ? "blue" : "grey"; return "changed";');
    err = await runIt("a beach"); sent = await sentNow(); last = await ev(() => H3SketcherReal.last());
    const sv = await px("window.__saved[0]", [[0.02, 0.02], [0.98, 0.98]]);
    check("a fill that came back grey: filled once more (strict words) - the saved photo has the place, not the grey", !err && sent.length === 3 && sent[1].fill === "1" && sent[2].fill === "1" && /^Every green pixel must become/.test(sent[2].prompt) && near(sv.pts[0], [16, 48, 224]) && near(sv.pts[1], [16, 48, 224]) && last.fillAgain === true && last.left < 0.3, { err, sent: sent.map((x) => x.fill), sv, last });

    // ---- C: ONE rule for every way in (plan): no words, words, a non-environment reference -> all "fill"; the model's own backdrop -> "own"
    await answer('return rec.fill_edit === "1" ? "blue" : "changed";');
    const modes = [];
    for (const t of ["", "create a real photo of the model in view", "a street at night"]) { await runIt(t); modes.push((await ev(() => H3SketcherReal.last())).mode); }
    check("no words / the default words / words: the same way every time (the grey, then the fill) - never the pale sky colour", modes.every((m) => m === "fill"), modes);
    const pl = await ev(() => { const R = H3SketcherReal; return [R.plan("", true, []).mode, R.plan("x", false, [{ role: "environment", src: "a" }]).mode, R.plan("x", false, [{ role: "person", src: "a" }]).mode]; });
    check("…plan: the model's own backdrop = own, an environment reference = placed, any other reference = fill", pl.join() === "own,placed,fill", pl);

    // ---- D: the ✨ Photo button and the prompt docker's path are the same run (same prompt sent)
    await ev(async () => { window.__sent = []; document.getElementById("prompt").value = "a red barn on a farm"; await H3SketcherReal.run("a red barn on a farm"); });
    const direct = await ev(() => window.__sent[0].prompt);
    await ev(() => { window.__sent = []; document.getElementById("ppReal").click(); });
    await p.waitForFunction(() => window.__saved.length >= 1 && H3SketcherReal.runs() === 0 && window.__sent.length >= 2, null, { timeout: 20000 });
    const viaBtn = await ev(() => window.__sent[0].prompt);
    check("✨ Photo sends exactly what the prompt docker's ✏ Edit (Sketcher) path sends", viaBtn === direct, { viaBtn: viaBtn.slice(0, 120), direct: direct.slice(0, 120) });

    // ---- E: several at once - each click queues its own (no "still making the last one")
    await ev(() => { window.__sent = []; window.__saved = []; window.__hold = true; window.__runs = [H3SketcherReal.run("a lake"), H3SketcherReal.run("a desert")]; });
    await p.waitForFunction(() => window.__sent.length >= 2, null, { timeout: 20000 });
    const mid = await ev(() => ({ runs: H3SketcherReal.runs(), btn: document.getElementById("ppReal").textContent, sent: window.__sent.map((r) => r.prompt.split("\n").pop()), label: (window.H3GoLabel && (() => { const gm = document.getElementById("genModeSel"), was = gm.value; return was; })()) }));
    check("two photos asked for at once: both queued as jobs straight away (no waiting for the first), the button counts them", mid.runs === 2 && mid.btn === "✨ Photo · 2" && mid.sent.some((x) => /a lake/.test(x)) && mid.sent.some((x) => /a desert/.test(x)), mid);
    await ev(() => { window.__hold = false; });
    await ev(() => Promise.all(window.__runs));
    const end = await ev(() => ({ runs: H3SketcherReal.runs(), btn: document.getElementById("ppReal").textContent, saved: window.__saved.length }));
    check("…both finished and saved, the count back to none", end.runs === 0 && end.btn === "✨ Photo" && end.saved === 2, end);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing", false, String(e && e.stack || e)); }
  finally { try { await ev(() => { refs.length = 0; }); } catch (e) { /* gone */ } await b.close(); }
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
