#!/usr/bin/env node
/* bitGen Studio — 2.652.0 in a REAL browser: THE SKETCHER'S ✨ PHOTO SENDS ITS MATERIALS - the render (the backdrop in it), its
 * depth (no backdrop), and a labelled MATERIAL BOARD of the model's pictures as picture 3; a model that takes two pictures gets
 * it again without the board. The AI server is stubbed (what is SENT is checked). Tim (verbatim): "use reference images for
 * the texture, background etc. and use our ai editor to create the scene?" Against H3_URL. No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.652.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_real652_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.H3SketcherReal && window.PPMatPick && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.A && H3PushPull.state.T, null, { timeout: 40000 });
    // two pictures in the project (a red one for the walls, a green one as the backdrop) - made here, uploaded as images
    const srcs = await ev(async () => {
      const up = async (col, name) => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); g.fillStyle = col; g.fillRect(0, 0, 64, 64); const bl = await new Promise((ok) => c.toBlob(ok, "image/png")); const fd = new FormData(); fd.append("file", bl, name); const j = await (await fetch("/api/passets?scope=project", { method: "POST", body: fd })).json(); return "/passets/images/" + j.name; };
      return [await up("#d02020", "redwall.png"), await up("#20b040", "greenbg.png")];
    });
    await ev((srcs) => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty(); const K = PPArch.addRoom(A, [[0, 0], [5, 0], [5, 4], [0, 4]], { name: "Kitchen" });
      A.tex = [{ id: "p1", name: "Red", src: srcs[0], size: 1, rot: 0, avg: "#d02020" }]; K.wext = { 0: "tex:p1" }; K.floor = "tex:p1";
      A.bg = { kind: "backdrop", src: srcs[1], name: "Green", rot: 0 }; H3PushPull.commit("rooms", b0); S.V.view("iso"); S.V.extents(); }, srcs);
    await p.waitForTimeout(1200);
    // the AI server stubbed: what is sent is kept
    await ev(() => {
      window.__sent = []; window.__refuse3 = false; const real = window.fetch.bind(window);
      window.fetch = async (u, o) => {
        const s = String(u);
        if (s.startsWith("/api/aiedit/engines")) return new Response(JSON.stringify({ edit: [{ id: "stub_edit", name: "Stub edit" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
        if (s === "/api/aiedit") { const fd = o.body, rec = { prompt: fd.get("prompt"), ref0: !!fd.get("ref0"), ref1: fd.get("ref1") || null, raw: fd.get("ref_raw") }; window.__sent.push(rec);
          if (window.__refuse3 && rec.ref1) return new Response(JSON.stringify({ error: "\"Stub\" takes 2 picture(s) - for 3 layers pick Qwen Image Edit 2511" }), { status: 400, headers: { "Content-Type": "application/json" } });
          return new Response(JSON.stringify({ jobs: [{ id: "stubjob" }] }), { status: 200, headers: { "Content-Type": "application/json" } }); }
        if (s.startsWith("/api/jobs/stubjob")) return new Response(JSON.stringify({ status: "error" }), { status: 200, headers: { "Content-Type": "application/json" } });
        return real(u, o);
      };
      H3SketcherReal.state && (H3SketcherReal.state().engines = null);
    });
    check("✨ Photo is in the Sketcher's toolbar", await ev(() => !!document.getElementById("ppReal")));
    await ev(() => { document.getElementById("prompt").value = "a summer afternoon"; }); await p.click("#ppReal");
    await p.waitForFunction(() => window.__sent.length >= 1, null, { timeout: 30000 }); await p.waitForTimeout(1600);
    const s1 = await ev(async () => { const r = window.__sent[0], bm = r.ref1 ? await createImageBitmap(r.ref1) : null, sh = H3SketcherReal.shots();
      const px = (c, x, y) => Array.from(c.getContext("2d").getImageData(x, y, 1, 1).data.slice(0, 3));
      return { prompt: r.prompt, ref0: r.ref0, raw: r.raw, board: bm ? [bm.width, bm.height] : null, photoCorner: px(sh.photo, 3, 3), depthCorner: px(sh.depth, 3, 3), boardTiles: sh.board ? px(sh.board, 20, 20) : null }; });
    check("sent: the render, its depth (ref0) and the material board (ref1) - the prompt names {img3} as the board, the user's words last",
      s1.ref0 && s1.board && s1.raw === "1" && /\{img3\} is a material board/.test(s1.prompt) && /tile marked Background/.test(s1.prompt) && /\na summer afternoon$/.test(s1.prompt), s1);
    check("…the board: the red picture's tile + the backdrop's (2 tiles, one row), each captioned", s1.board[0] === 2 * 320 + 3 * 8 && s1.board[1] === 320 + 44 + 2 * 8 && s1.boardTiles[0] > 180 && s1.boardTiles[1] < 80,
      { board: s1.board, tile: s1.boardTiles });
    check("…the render shows the backdrop (green behind the model); its depth map does not (black there)", s1.photoCorner[1] > 120 && s1.photoCorner[0] < 90 && s1.depthCorner.every((v) => v < 20), { photo: s1.photoCorner, depth: s1.depthCorner });
    // a model that takes two pictures: again without the board
    await ev(() => { window.__sent = []; window.__refuse3 = true; }); await p.waitForTimeout(500);
    await ev(async () => { try { await H3SketcherReal.run(""); } catch (e) { /* the stub's job ends in an error */ } }); await p.waitForTimeout(800);
    const s2 = await ev(() => window.__sent.map((r) => ({ board: !!r.ref1, img3: /\{img3\}/.test(r.prompt) })));
    check("an edit model that takes two pictures: sent again WITHOUT the board (and no {img3} in the words)", s2.length === 2 && s2[0].board && !s2[1].board && !s2[1].img3, s2);
    // nothing in pictures: no board
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(); S.M.arch.rooms[0].wext = {}; S.M.arch.rooms[0].floor = "#c8a882"; S.M.arch.bg = null; H3PushPull.commit("plain", b0); window.__sent = []; window.__refuse3 = false; });
    await ev(async () => { try { await H3SketcherReal.run(""); } catch (e) { /* the stub's job ends in an error */ } }); await p.waitForTimeout(800);
    check("no picture materials and no backdrop: no board (the depth map only)", await ev(() => window.__sent.length === 1 && !window.__sent[0].ref1 && !/\{img3\}/.test(window.__sent[0].prompt)));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    try { await ev(() => H3PushPullFrame.toggleMaxed(false)); } catch { /* fine */ }
    try { await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
