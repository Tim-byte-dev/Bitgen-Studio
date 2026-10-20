#!/usr/bin/env node
/* bitGen Studio — 2.556.0 in a REAL browser: ⏳ Pending - runs queue without waiting, each result a card in a floating docker
 * kept inside the image editor (✔ Apply = a layer above the layer that was selected, in ONE "✨ changes" group per layer;
 * 🗑 Delete); the References docker's pictures with Generate / Edit / Fill / Refine / Compose; the editor's 2.552-2.555
 * settings actually reach the server (mount.js used to drop them).
 * Tim: "allow user to add multiple generations, edits, refine, fills, etc to queue, place those images in another floating
 * docker that is confined to the image-editor, call it pending ... check to see if the reference images can still be used
 * in generate, edit, fill, refine, compose modes". Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.556.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.runAI, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 800; c.height = 600; const g = c.getContext("2d"); g.fillStyle = "#3060c0"; g.fillRect(0, 0, 800, 600); g.fillStyle = "#e03020"; g.fillRect(350, 250, 100, 100); window.imageEditorInstance.load(c.toDataURL("image/png"), "f556"); setTimeout(ok, 700); }));
    await p.waitForFunction(() => { const E = window.imageEditorInstance.E; return E.S.engines && (E.S.engines.edit || []).length; }, null, { timeout: 20000 });
    const ids = await ev(() => { const e = window.imageEditorInstance.E.S.engines; const k = (e.inpaint || []).find((x) => /^Krea 2 Turbo$/.test(x.name)), q = (e.edit || []).find((x) => /^Qwen Image Edit 2511/.test(x.name)); return { krea: k && k.id, qwen: q && q.id, latent: k && k.latent }; });
    check("the engines list says Krea 2 is a 'latent' fill (no inpaint training)", ids.krea && ids.latent === true && !!ids.qwen, ids);

    /* 1 the queue: two runs at once, both waiting in ⏳ Pending */
    const q = await ev(async () => {
      const E = window.imageEditorInstance.E, S = E.S;
      const panelIn = E.kx.contains(document.getElementById("pcPend")), hiddenAtFirst = document.getElementById("pcPend").classList.contains("off");
      window.__done = {}; let n = 0;
      window.__realApi = { aiedit: E.api.aiedit, compose: E.api.compose, awaitResult: E.api.awaitResult };
      E.api.aiedit = async (req) => { const id = "stub" + (++n); const im = await createImageBitmap(req.crop); const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.fillStyle = n === 1 ? "#ff00ff" : "#00ffff"; g.fillRect(0, 0, c.width, c.height); window.__done[id] = c.toDataURL("image/png"); return { jobs: [{ id, seed: n }], soft: false, mode: req.mode }; };
      E.api.awaitResult = (id) => new Promise((ok) => { window.__rel = window.__rel || {}; window.__rel[id] = () => ok(window.__done[id]); });
      S.active = 0; E.renderLayersPanel(); E.setAiMode("generate");
      const target = E.layer();
      const m = new Uint8Array(S.w * S.h); for (let y = 260; y < 340; y++) for (let x = 360; x < 440; x++) m[y * S.w + x] = 255; E.setSel(m, true);
      document.getElementById("kxSee").checked = false; document.getElementById("kxSee").onchange();
      const a = E.runAI({ prompt: "a pink ball", into: false, whole: false, direct: true, label: "✨ generate" });
      await new Promise((r) => setTimeout(r, 400));
      const st = document.getElementById("ieStatus").textContent;
      const b = E.runAI({ prompt: "a cyan ball", into: false, whole: false, direct: true, label: "✨ generate" });
      await new Promise((r) => setTimeout(r, 400));
      const cards1 = document.querySelectorAll("#pcPend .ppc").length, wait1 = document.querySelectorAll('#pcPend .ppc [data-a="apply"]:disabled').length;
      for (let t = 0; t < 40 && !(window.__rel && window.__rel.stub1 && window.__rel.stub2); t++) await new Promise((r) => setTimeout(r, 100));
      if (!(window.__rel && window.__rel.stub2)) return { dbg: document.getElementById("ieStatus").textContent, cards1, rel: Object.keys(window.__rel || {}), pend: !!E.pending, auto: E.pending && E.pending.auto };
      window.__rel.stub1(); window.__rel.stub2(); await a; await b; await new Promise((r) => setTimeout(r, 200));
      const ready = document.querySelectorAll('#pcPend .ppc [data-a="apply"]:not(:disabled)').length;
      return { panelIn, hiddenAtFirst, st, cards1, wait1, ready, shown: !document.getElementById("pcPend").classList.contains("off"), target: target.name, n: S.layers.length,
               btn: document.getElementById("kxPendBtn").textContent };
    });
    check("⏳ Pending is a docker INSIDE the image editor, hidden until something is queued; the ✨ AI panel has its ⏳ button", q.panelIn && q.hiddenAtFirst && /⏳ Pending/.test(q.btn), q);
    check("two runs queued without waiting (no 'still working') - two cards rendering, then both ready to apply; no layer added by itself",
      !/still working/.test(q.st) && q.cards1 === 2 && q.wait1 === 2 && q.ready === 2 && q.shown, q);
    /* 2 apply into the changes group, delete */
    const ap = await ev(() => {
      const E = window.imageEditorInstance.E, S = E.S, T = S.layers[0], n0 = S.layers.length;
      document.querySelector('#pcPend .ppc [data-a="apply"]').click();
      const G = S.layers.find((x) => x.type === "group" && x.changesOf === T.id), kids1 = G ? S.layers.filter((x) => x.parent === G.id).length : 0;
      const gi = S.layers.indexOf(G), ti = S.layers.indexOf(T);
      document.querySelector('#pcPend .ppc [data-a="apply"]').click();
      const kids2 = G ? S.layers.filter((x) => x.parent === G.id) : [];
      const top = kids2[kids2.length - 1], px = top ? Array.from(top.canvas.getContext("2d").getImageData(400, 300, 1, 1).data) : null, out = top ? top.canvas.getContext("2d").getImageData(100, 100, 1, 1).data[3] : -1;
      const groups = S.layers.filter((x) => x.type === "group" && x.changesOf === T.id).length;
      E.undo(); const afterUndo = G ? S.layers.filter((x) => x.parent === G.id).length : -1;
      return { name: G && G.name, kids1, kids2: kids2.length, groups, above: gi > ti, px, out, afterUndo, cards: document.querySelectorAll("#pcPend .ppc").length, n0, n: S.layers.length };
    });
    check("✔ Apply: a new layer above the selected layer inside ONE group \"✨ changes: <layer>\" - the second result goes into the same group (on top); only the selection's pixels; one undo each",
      /^✨ changes: /.test(ap.name || "") && ap.kids1 === 1 && ap.kids2 === 2 && ap.groups === 1 && ap.above && ap.px && ap.px[2] > 200 && ap.px[1] > 200 && ap.out === 0 && ap.afterUndo === 1 && ap.cards === 0, ap);
    const del = await ev(async () => {
      const E = window.imageEditorInstance.E, S = E.S, n0 = S.layers.length;
      E.api.awaitResult = async (id) => window.__done[id];
      await E.runAI({ prompt: "a third ball", into: false, whole: false, direct: true, label: "✨ generate" });
      const c0 = document.querySelectorAll("#pcPend .ppc").length;
      document.querySelector("#pcPend .ppc canvas").click(); const prev = !!E.S.preview;
      document.querySelector('#pcPend .ppc [data-a="del"]').click();
      return { c0, prev, c1: document.querySelectorAll("#pcPend .ppc").length, same: S.layers.length === n0, prevAfter: !!E.S.preview };
    });
    check("🗑 Delete drops a result (no layer); a click on its picture previews it over the canvas first", del.c0 === 1 && del.prev && del.c1 === 0 && del.same && !del.prevAfter, del);
    /* 3 kept inside the editor */
    const hd = await p.locator("#ppHead").boundingBox(), kb = await p.locator(".kx").first().boundingBox();
    await p.mouse.move(hd.x + 30, hd.y + 8); await p.mouse.down(); await p.mouse.move(hd.x + 3000, hd.y + 3000, { steps: 6 }); await p.mouse.up();
    const pb = await p.locator("#pcPend").boundingBox();
    check("dragged far away by its title it stays inside the image editor", pb.x + pb.width <= kb.x + kb.width + 1 && pb.y <= kb.y + kb.height && pb.x >= kb.x - 1, { pb, kb });
    /* 4 the References docker's pictures in every mode, through the app's own request (mount.js) */
    const rf = await ev(async () => {
      const E = window.imageEditorInstance.E, S = E.S;
      const mk = async (col) => { const c = document.createElement("canvas"); c.width = 64; c.height = 64; const g = c.getContext("2d"); g.fillStyle = col; g.fillRect(0, 0, 64, 64); return await new Promise((r) => c.toBlob(r, "image/png")); };
      const before = window.H3Refs ? window.H3Refs.images().length : 0;
      // the References docker's list as the editor reads it (fixed here - a project's references may load over the docker meanwhile)
      const rr = [{ name: "red.png", desc: "a red square" }, { name: "green.png", desc: "a green square" }];
      for (const r of rr) { r.file = new File([await mk(r.name === "red.png" ? "#f00" : "#0f0")], r.name, { type: "image/png" }); r.url = URL.createObjectURL(r.file); }
      E.api.refList = () => rr;
      const k = rr.length;
      // the real api.aiedit / api.compose (mount.js) with fetch answering for the server
      const real = window.imageEditorInstance.E.api;
      const seen = [];
      const f0 = window.fetch;
      window.fetch = async (u, o) => {
        if (String(u) === "/api/aiedit" || String(u) === "/api/aiedit/compose") { const fd = o.body, d = {}; for (const [key, v] of fd.entries()) d[key] = typeof v === "string" ? v : "<blob>"; seen.push({ u: String(u), d }); return new Response(JSON.stringify({ jobs: [], mode: d.mode || "compose", workflow: "x.json" }), { status: 200, headers: { "Content-Type": "application/json" } }); }
        return f0(u, o);
      };
      E.api.aiedit = window.__realApi.aiedit; E.api.compose = window.__realApi.compose; E.api.awaitResult = window.__realApi.awaitResult;
      try {
        const eng = S.engines || {}, krea = (eng.inpaint || []).find((x) => /^Krea 2 Turbo$/.test(x.name)), qwen = (eng.edit || []).find((x) => /^Qwen Image Edit 2511/.test(x.name));
        document.getElementById("ieEditStyle").value = qwen.id;
        const m = new Uint8Array(S.w * S.h); for (let y = 260; y < 340; y++) for (let x = 360; x < 440; x++) m[y * S.w + x] = 255;
        const go = async (mode, prompt, extra) => { E.setAiMode(mode); E.setSel(m, true); await E.runAI(Object.assign({ prompt: prompt.replace(/N1/g, String(k - 1)).replace(/N2/g, String(k)), style: krea.id, into: false, whole: false, direct: true }, extra || {})); };
        document.getElementById("kxSee").checked = false; document.getElementById("kxSee").onchange();
        await go("generate", "a cat in the colours of picture N1");
        await go("edit", "put the hat from picture N2 on it");
        await go("refine", "redo it like picture N1 and picture N2");
        document.getElementById("kxSee").checked = true; document.getElementById("kxSee").onchange();
        await go("generate", "a lamp");
        // compose: the picked layers + "ref N"
        E.setAiMode("compose");
        await E.runCompose({ prompt: `put the thing from ref ${k} next to it`, layers: [S.layers[0]], direct: true });
      } finally { window.fetch = f0; }
      return { before, k, seen };
    });
    const by = (i) => (rf.seen[i] || {}).d || {};
    const g = by(0), e = by(1), r = by(2), f = by(3), c = by(4);
    check("References docker: Generate naming \"picture N\" goes through the edit model with that picture (ref0, its docker number) - the request carries fill_edit / edit_style_id / fill_kind / Krita's mask sizes (mount.js sends them now)",
      rf.k >= 2 && g.fill_edit === "1" && g.ref0 === "<blob>" && JSON.parse(g.ref_nums || "[]").join() === String(rf.k - 1) && !!g.edit_style_id && g.fill_kind && g.mask_grow && g.mask_feather, g);
    check("...Edit with \"picture N\": the picture goes along (ref0 + ref_nums)", e.mode === "edit" && e.ref0 === "<blob>" && JSON.parse(e.ref_nums || "[]").join() === String(rf.k), e);
    check("...Refine naming two pictures: both go (ref0 + ref1) through the edit model (fill_kind refine)", r.mode === "refine" && r.ref0 === "<blob>" && r.ref1 === "<blob>" && r.fill_kind === "refine" && r.fill_edit === "1", r);
    check("...Fill with 👁 and no picture named: no references, the edit model's fill as before", f.fill_edit === "1" && !f.ref0, f);
    check("...Compose with \"ref N\": that picture is added after the layers as \"Ref N\" and the prompt names it so", /compose/.test((rf.seen[4] || {}).u || "") && JSON.parse(c.names || "[]").includes(`Ref ${rf.k}`) && c.pic1 === "<blob>" && new RegExp(`Ref ${rf.k}`).test(c.prompt || ""), c);
    /* 5 the server: two references with a fill through the edit model */
    const srv = await ev(async () => {
      const eng = window.imageEditorInstance.E.S.engines, krea = eng.inpaint.find((x) => /^Krea 2 Turbo$/.test(x.name)), qwen = eng.edit.find((x) => /^Qwen Image Edit 2511/.test(x.name));
      const c = document.createElement("canvas"); c.width = 64; c.height = 64; const bl = await new Promise((r) => c.toBlob(r, "image/png"));
      const fd = new FormData(); fd.append("crop", bl, "c.png"); fd.append("mask", bl, "m.png"); fd.append("rgba", bl, "r.png"); fd.append("ref0", bl, "a.png"); fd.append("ref1", bl, "b.png");
      for (const [k, v] of Object.entries({ mode: "generate", prompt: "a hat like picture 3 on a chair like picture 5", style_id: krea.id, fill_edit: "1", edit_style_id: qwen.id, fill_kind: "add", ref_nums: "[3,5]", ref_descs: JSON.stringify(["a red hat", "a wooden chair"]), width: "64", height: "64", count: "1" })) fd.append(k, v);
      const r = await fetch("/api/aiedit", { method: "POST", body: fd }); const o = await r.json();
      const j = o.jobs && o.jobs[0] ? await (await fetch("/api/jobs/" + o.jobs[0].id)).json() : null;
      return { status: r.status, note: o.note, workflow: o.workflow, job: JSON.stringify(j || {}).slice(0, 4000), err: o.error };
    });
    let li = -1; try { const G = JSON.parse(fs.readFileSync(srv.workflow, "utf8")); li = Object.values(G).filter((n) => /LoadImage/.test(n.class_type)).length; } catch (e) { li = String(e.message); }
    check("/api/aiedit: a fill through the edit model with two references - 4 pictures in the graph (the crop, the mask, the two references), the docker's picture 3 / 5 become the model's Picture 2 / 3 in the prompt",
      srv.status === 200 && /2 reference pictures/.test(srv.note || "") && li === 4 && /Picture 2 is a reference picture \(a red hat\)/.test(srv.job) && /a hat like Picture 2 on a chair like Picture 3/.test(srv.job), { srv, li });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
