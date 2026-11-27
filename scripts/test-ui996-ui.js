#!/usr/bin/env node
/* bitGen Studio — 2.996.0 in a REAL browser: ✨ Photo / ✏ Edit (Sketcher) - one job per step, each checked.
 * Tim: "photo or edit in sketcher from prompt produced 0/10 directed images ... sometime just the actual reference picture,
 * sometime the right pose but gray background, sometimes a mannequin on the right background. please check to see if the
 * logic statements don't conflict"
 * The AI server is stubbed and answers the way real edit models go wrong (the reference back, the render back, a refused
 * fill); every picture is checked pixel by pixel. (Replaces test-ui993-ui's photo part and test-ui995-ui.) */
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
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
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
      const V = H3PushPull.state.V; V.shadows(true); const before = V.ground.visible, rd = (c) => c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      const m = rd(V.shot(320, 240, { clean: true, mask: true })), t = rd(V.shot(320, 240, { clean: true, transparent: true }));
      const at = (d, x, y) => Array.from(d.slice((y * 320 + x) * 4, (y * 320 + x) * 4 + 4));
      let same = 0, n = 0; for (let i = 0; i < m.length; i += 4 * 7) { n++; if (Math.abs(t[i + 3] - m[i]) <= 1) same++; }
      return { mc: at(m, 2, 2), mm: at(m, 160, 120), tc: at(t, 2, 2), tm: at(t, 160, 120), same: same / n, ground: V.ground.visible === before && before };
    });
    check("the silhouette shot (white on black) and a transparent shot's alpha taken from it; the view put back", sil.mc.slice(0, 3).every((v) => v === 0) && sil.mm.slice(0, 3).every((v) => v > 240) && sil.same > 0.99 && sil.tc[3] === 0 && sil.tm[3] === 255 && sil.ground, sil);

    // the AI server stubbed: window.__answer(rec) -> "same" | "changed" | "blue" | "grey" | "ref" (picture 3 back) | "refuse"
    await ev(() => {
      const J = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: { "Content-Type": "application/json" } });
      window.__sent = []; window.__saved = []; window.__n = 0; window.__hold = false; const real = window.fetch.bind(window);
      const draw = async (rec, how) => { const bm = await createImageBitmap(rec.crop), c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; const g = c.getContext("2d");
        if (how === "grey") { g.fillStyle = "#808080"; g.fillRect(0, 0, c.width, c.height); }
        else if (how === "blue") { g.fillStyle = "#1030e0"; g.fillRect(0, 0, c.width, c.height); for (let x = 0; x < c.width; x += 9) { g.fillStyle = x % 18 ? "#1838d8" : "#0828e8"; g.fillRect(x, 0, 4, c.height); } }
        else if (how === "ref") { const r = await createImageBitmap(rec.ref1); g.drawImage(r, 0, 0, c.width, c.height); }
        else { g.drawImage(bm, 0, 0); if (how === "changed") { g.globalCompositeOperation = "difference"; g.fillStyle = "#303030"; g.fillRect(0, 0, c.width, c.height); } }
        return new Promise((ok) => c.toBlob(ok, "image/png")); };
      window.fetch = async (u, o) => {
        const s = String(u);
        if (s.startsWith("/api/aiedit/engines")) return J({ edit: [{ id: "stub_edit", name: "Stub edit" }] });
        if (s === "/api/aiedit") { const rec = {}; for (const [k, v] of o.body.entries()) rec[k] = v; window.__sent.push(rec); rec.nth = window.__sent.length;
          if (window.__answer(rec) === "refuse") return J({ error: "no edit model can fill here" }, 400);
          const id = "ui996_" + (++window.__n); window["__job_" + id] = rec; return J({ jobs: [{ id }] }); }
        const m = s.match(/^\/api\/jobs\/(ui996_\d+)/); if (m) return J(window.__hold ? { status: "running" } : { status: "done", outputs: [m[1] + ".png"] });
        const mo = s.match(/^\/outputs\/(ui996_\d+)\.png/);
        if (mo) { const rec = window["__job_" + mo[1]]; return new Response(await draw(rec, window.__answer(rec)), { headers: { "Content-Type": "image/png" } }); }
        if (s === "/api/sketcher/photo") { window.__gal = { drop: JSON.parse(o.body.get("drop")), name: o.body.get("name"), size: o.body.get("file").size }; return J({ name: "ui996_done.png", dropped: window.__gal.drop.length }); }
        if (s === "/api/passets" && o && o.method === "POST") { window.__saved.push(o.body.get("file")); return J({ name: "ui996_photo_" + window.__saved.length + ".png" }); }
        return real(u, o);
      };
      refs.length = 0;
      // reference pictures: a striped place (a copied reference has other outlines), a red "environment"
      window.__mkRef = (role, col) => { const c = document.createElement("canvas"); c.width = 96; c.height = 64; const g = c.getContext("2d"); g.fillStyle = col || "#c83c14"; g.fillRect(0, 0, 96, 64);
        if (!col) for (let y = 0; y < 64; y += 8) { g.fillStyle = y % 16 ? "#f0e040" : "#2040a0"; g.fillRect(0, y, 96, 4); }
        return { url: c.toDataURL("image/png"), role }; };
    });
    const px = async (expr, pts) => ev(async (a) => { const bm = await createImageBitmap(new Function("return " + a.expr)()), c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; const g = c.getContext("2d"); g.drawImage(bm, 0, 0);
      return { w: bm.width, pts: a.pts.map((q) => Array.from(g.getImageData(Math.round(q[0] * (bm.width - 1)), Math.round(q[1] * (bm.height - 1)), 1, 1).data)) }; }, { expr, pts });
    const near = (a, b2, d) => a.slice(0, 3).every((v, i) => Math.abs(v - b2[i]) <= (d || 14));
    const answer = (src) => ev((s) => { window.__answer = new Function("rec", s); }, src);
    const setRefs = (list) => ev((l) => { refs.length = 0; l.forEach((x) => refs.push(window.__mkRef(x[0], x[1]))); }, list);
    const runIt = (text) => ev(async (t) => { window.__sent = []; window.__saved = []; document.getElementById("prompt").value = t; try { await H3SketcherReal.run(t); } catch (e) { return String(e.message || e); } return null; }, text);
    const sentNow = () => ev(() => window.__sent.map((r) => ({ prompt: r.prompt, fill: r.fill_edit || null, board: !!r.ref1, ref0: r.ref0 ? r.ref0.name : null })));
    const lastNow = () => ev(() => Object.assign({}, H3SketcherReal.last(), { msg: document.getElementById("ppMsg").textContent }));
    const CORNERS = [[0.02, 0.02], [0.98, 0.02], [0.02, 0.98], [0.5, 0.5]];

    // ---- A: words, no references: step 1 = the model alone (grey KEPT), step 2 = the green filled; the model from step 1
    await setRefs([]);
    await answer('return rec.fill_edit === "1" ? "blue" : "changed";');
    let err = await runIt("a woman standing in a park"), sent = await sentNow(), last = await lastNow();
    const g1 = await px("window.__sent[0].crop", CORNERS), g2 = await px("window.__sent[1].crop", CORNERS), sv = await px("window.__saved[0]", CORNERS);
    check("words, no references: 2 jobs - step 1 (KEEP the grey, the words for the model itself), step 2 the fill (A real place … / the prompt's place)",
      !err && sent.length === 2 && !sent[0].fill && /Keep the flat plain grey background exactly as it is/.test(sent[0].prompt) && /What the photo is for \(use it for the model itself - keep the grey\): a woman standing in a park$/.test(sent[0].prompt)
      && sent[1].fill === "1" && /\nThe place and the scene: a woman standing in a park$/.test(sent[1].prompt) && !sent[1].ref0, { err, sent });
    check("…picture 1 on the flat grey; step 2's picture: the grey GREEN, the model = step 1's answer; the saved photo: the place round it, step 1's model kept",
      near(g1.pts[0], [128, 128, 128], 4) && near(g2.pts[0], [0, 255, 0], 2) && near(g2.pts[3], g1.pts[3].map((v) => Math.abs(v - 48))) && near(sv.pts[0], [16, 48, 224], 40) && near(sv.pts[2], [16, 48, 224], 40) && near(sv.pts[3], g1.pts[3].map((v) => Math.abs(v - 48))), { g1, g2, sv });
    const gal = await ev(() => window.__gal);
    check("2.998.0 the gallery: the finished photo sent to /api/sketcher/photo, its 2 steps' outputs dropped (only the finished one shows)", gal && gal.drop.length === 2 && gal.drop.every((n) => /^ui996_\d+\.png$/.test(n)) && gal.size > 1000 && last.gallery === "ui996_done.png" && last.steps.join() === gal.drop.join(), { gal, last: { gallery: last.gallery, steps: last.steps } });
    check("…the record: mode fill, step 1 passed its check (kept the outlines, changed), step 2 filled, no warning", last.mode === "fill" && last.ok === true && last.corr > 0.25 && last.change > 9 && last.step2 === "filled" && !last.notes.length && !/⚠/.test(last.msg), last);

    // ---- B: a park photo left as Type "person" -> step 1 only (the model's look), never the fill; the message says so
    await setRefs([["person"]]);
    err = await runIt("a park"); sent = await sentNow(); last = await lastNow();
    check("a reference typed person: on step 1's board only (SUBJ1 '(person): the model looks like it'), NOT in step 2; never 'the whole picture's look'",
      !err && sent.length === 2 && sent[0].board && /is a reference for the model itself \(person\): the model looks like it/.test(sent[0].prompt) && !/whole picture|its place, ground/.test(sent[0].prompt) && sent[1].fill === "1" && !sent[1].ref0, sent);
    check("…the message says what it was used for (a place? set its Type to environment)", /Reference 1 \(person\) → the model's look - a place\? set its Type to environment/.test(last.uses.join("|")), last.uses);

    // ---- C: step 1 hands back the REFERENCE (Tim's "just the actual reference picture") -> once more WITHOUT the references
    await answer('if (rec.fill_edit === "1") return "blue"; return rec.ref1 ? "ref" : "changed";');
    err = await runIt("a park"); sent = await sentNow(); last = await lastNow();
    check("step 1 came back as the reference (other outlines): sent again ALONE (no board, retryPrompt), that one kept, then the fill",
      !err && sent.length === 3 && sent[0].board && !sent[1].board && !sent[1].fill && /^Make \{img1\} a real photograph/.test(sent[1].prompt) && sent[2].fill === "1" && last.retried && last.ok && last.corr > 0.25, { sent, last });
    const sc = await px("window.__saved[0]", CORNERS), c1 = await px("window.__sent[0].crop", CORNERS);
    check("2.998.0 …with a second try: all 3 steps' outputs dropped (the first try, the retry, the fill)", (await ev(() => window.__gal.drop.length)) === 3);
    check("…the saved photo is NOT the reference: the model from the second try in the middle, the fill round it", near(sc.pts[3], c1.pts[3].map((v) => Math.abs(v - 48))) && near(sc.pts[0], [16, 48, 224], 40), { sc, c1 });

    // ---- D: step 1 hands back the render (Tim's "mannequin") -> once more; still the render -> said with ⚠
    await setRefs([]);
    await answer('return rec.fill_edit === "1" ? "blue" : rec.nth === 1 ? "same" : "changed";');
    err = await runIt(""); last = await lastNow(); sent = await sentNow();
    check("step 1 came back still the render (a grey mannequin): once more, the changed one kept, no warning", !err && sent.length === 3 && last.retried && last.ok && last.change > 9 && !/⚠/.test(last.msg), { sent, last });
    await answer('return rec.fill_edit === "1" ? "blue" : "same";');
    err = await runIt(""); last = await lastNow();
    check("…still the render after the second try: kept, but SAID (⚠ it still looks like the 3D model)", !err && last.retried && !last.ok && last.why === "render" && /⚠/.test(last.msg) && /still looks like the 3D model/.test(last.msg), last);

    // ---- E: an environment reference: step 1 without it; the model CUT OUT onto that picture, only the edge band filled
    await setRefs([["environment", "#c83c14"]]);
    await answer('return rec.fill_edit === "1" ? "blue" : "changed";');
    err = await runIt("a woman in a square"); sent = await sentNow(); last = await lastNow();
    const se = await px("window.__saved[0]", CORNERS), e1 = await px("window.__sent[0].crop", CORNERS), ring = await ev(() => window.__sent[1] && H3SketcherReal.shots().fill ? (() => { const m = H3SketcherReal.shots().fill.mask, d = m.getContext("2d").getImageData(0, 0, m.width, m.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] === 0) n++; return n / (d.length / 4); })() : -1);
    check("an environment reference: NOT sent to step 1 (no board), step 1 keeps the grey; step 2 = the edge band only (ringPrompt, a thin selection)",
      !err && sent.length === 2 && !sent[0].board && /Keep the flat plain grey/.test(sent[0].prompt) && sent[1].fill === "1" && /^The green band in/.test(sent[1].prompt) && ring > 0 && ring < 0.35 && last.mode === "place" && last.step2 === "placed+blended", { sent, ring, last });
    check("…the saved photo: the environment picture itself in the corners (exactly), step 1's model in the middle", near(se.pts[0], [200, 60, 20], 6) && near(se.pts[1], [200, 60, 20], 6) && near(se.pts[3], e1.pts[3].map((v) => Math.abs(v - 48))), { se, e1 });

    // ---- F: step 2 refused -> the grey kept and SAID (no more a 1.5 s message overwritten by "done")
    await setRefs([]);
    await answer('return rec.fill_edit === "1" ? "refuse" : "changed";');
    err = await runIt("a beach"); last = await lastNow();
    const sf = await px("window.__saved[0]", CORNERS);
    check("step 2 refused: the photo kept on the grey, and the LAST message says so (⚠ the place could not be made … the background is still grey)", !err && last.step2 === "failed" && /⚠/.test(last.msg) && /the place could not be made \(no edit model can fill here\)/.test(last.msg) && /the background is still grey/.test(last.msg) && near(sf.pts[0], [80, 80, 80], 8), { last, sf });

    // ---- G: a fill that comes back a flat studio white -> once more, strict
    await answer('if (rec.fill_edit === "1") return /Every green pixel/.test(rec.prompt) ? "blue" : "grey"; return "changed";');
    err = await runIt("a beach"); sent = await sentNow(); last = await lastNow();
    check("a fill that came back plain: filled once more (strict), the place kept", !err && sent.length === 3 && /^Every green pixel must become/.test(sent[2].prompt) && last.fillAgain && last.left < 0.3, { sent: sent.map((x) => x.fill), last });

    // ---- H: a style reference: step 2 only (its look), step 1 without it
    await setRefs([["style", "#20a040"]]);
    await answer('return rec.fill_edit === "1" ? "blue" : "changed";');
    err = await runIt("an old town"); sent = await sentNow(); last = await lastNow();
    check("a style reference: step 1 without it, step 2 with it ({img2} the reference's look)", !err && sent.length === 2 && !sent[0].board && sent[1].ref0 === "sketcher_reference.png" && /\{img2\} is the reference picture/.test(sent[1].prompt) && /Reference 1 \(style\) → the look of the place/.test(last.uses.join("|")), { sent, uses: last.uses });

    // ---- I: the model's own backdrop: one step, the backdrop kept (OWN_BG), no fill
    await setRefs([]);
    await ev(() => { const S = H3PushPull.state; S.M.arch = S.M.arch || {}; S.M.arch.bg = { src: window.__mkRef("x", "#3070b0").url, name: "bg", kind: "backdrop" }; });
    err = await runIt("a woman"); sent = await sentNow(); last = await lastNow();
    await ev(() => { delete H3PushPull.state.M.arch.bg; });
    check("the model's own backdrop: one step (OWN_BG, the backdrop on the board), no fill", !err && sent.length === 1 && /Keep the background of \{img1\} the same place, made real/.test(sent[0].prompt) && last.mode === "own" && last.step2 === "none", { sent, last });

    // ---- 2.999.0 the angle fix: a (stand-in) DAZ character whose face the camera sees straight on, then from the side
    const fakeChar = (sideways) => ev((sw) => {
      window.__realDaz = window.__realDaz || window.H3DazScene;
      const C = H3PushPull.state.V.cam().position, T = C.constructor, H = [C.x + 3, C.y, C.z], f = sw ? [0, 1, 0] : [-1, 0, 0], sd = sw ? [1, 0, 0] : [0, 1, 0];
      const b = (p) => ({ getWorldPosition: (v) => v.set(p[0], p[1], p[2]) });
      const at = (k, s2) => [H[0] + f[0] * 0.09 + sd[0] * s2, H[1] + f[1] * 0.09 + sd[1] * s2, H[2] + 0.06];
      const bones = new Map([["head", b(H)], ["l_eye", b(at(0, 0.032))], ["r_eye", b(at(0, -0.032))], ["neck2", b([H[0], H[1], H[2] - 0.1])]]);
      window.H3DazScene = Object.assign({}, window.__realDaz, { list: () => ["c1"], rig: () => ({ outer: { visible: true }, bones }) });
    }, sideways);
    await setRefs([["person"], ["clothing", "#5050f0"]]);
    await answer('return rec.fill_edit === "1" ? "blue" : "changed";');
    await fakeChar(false); err = await runIt("a woman"); sent = await sentNow(); last = await lastNow();
    check("2.999.0 the face seen straight on: both references to step 1 (the board), none left out", !err && last.faceAngle < 5 && last.faceOut === 0 && /board of references for the model itself/.test(sent[0].prompt), { a: last.faceAngle, out: last.faceOut });
    await fakeChar(true); err = await runIt("a woman"); sent = await sentNow(); last = await lastNow();
    check("…from the side (~90°): the person reference left OUT of step 1 (the clothing alone goes), and the message says why", !err && last.faceAngle > 80 && last.faceOut === 1 && /reference for the model itself \(clothing\)/.test(sent[0].prompt)
      && /Reference 1 \(person\) → left out: the camera sees the face at \d+°/.test(last.uses.join("|")), { a: last.faceAngle, out: last.faceOut, uses: last.uses, p: sent[0].prompt.slice(-300) });
    await ev(() => { window.H3DazScene = window.__realDaz; });

    // ---- J: ✨ Photo = the prompt docker's path; K: two at once, queued
    await answer('return rec.fill_edit === "1" ? "blue" : "changed";');
    await ev(async () => { window.__sent = []; document.getElementById("prompt").value = "a red barn on a farm"; await H3SketcherReal.run("a red barn on a farm"); });
    const direct = await ev(() => window.__sent[0].prompt);
    await ev(() => { window.__sent = []; window.__saved = []; document.getElementById("ppReal").click(); });
    await p.waitForFunction(() => window.__saved.length >= 1 && H3SketcherReal.runs() === 0, null, { timeout: 20000 });
    check("✨ Photo sends exactly what the prompt docker's ✏ Edit (Sketcher) path sends", (await ev(() => window.__sent[0].prompt)) === direct);
    await ev(() => { window.__sent = []; window.__saved = []; window.__hold = true; window.__runs = [H3SketcherReal.run("a lake"), H3SketcherReal.run("a desert")]; });
    await p.waitForFunction(() => window.__sent.length >= 2, null, { timeout: 20000 });
    const mid = await ev(() => ({ runs: H3SketcherReal.runs(), btn: document.getElementById("ppReal").textContent, sent: window.__sent.map((r) => r.prompt.split("\n").pop()) }));
    check("two at once: both queued straight away, the button counts them", mid.runs === 2 && mid.btn === "✨ Photo · 2" && mid.sent.some((x) => /a lake/.test(x)) && mid.sent.some((x) => /a desert/.test(x)), mid);
    await ev(() => { window.__hold = false; }); await ev(() => Promise.all(window.__runs));
    const end = await ev(() => ({ runs: H3SketcherReal.runs(), btn: document.getElementById("ppReal").textContent, saved: window.__saved.length }));
    check("…both saved, the count back to none", end.runs === 0 && end.btn === "✨ Photo" && end.saved === 2, end);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing", false, String(e && e.stack || e)); }
  finally { try { await ev(() => { refs.length = 0; }); } catch (e) { /* gone */ } await b.close(); }
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
