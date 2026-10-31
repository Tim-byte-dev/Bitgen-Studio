#!/usr/bin/env node
/* bitGen Studio — 2.539.0 in a REAL browser: REFERENCE DESCRIPTIONS + THE HOUSE TYPES, REFERENCES IN THE HOUSE BUILDER
 * AND THE IMAGE EDITOR.
 *   References docker: a description box under a picture, a video and a sound; the Type dropdown's wall / floor /
 *   furniture / light; the mapping line carries the description; the project keeps them (save -> read back).
 *   🏠 a wall picture from the dock onto a wall (kept with the house, its texture in the build, a shot renders), a
 *   furniture picture DROPPED on a piece on the plan, ✨ Make it real's prompt names it ("look exactly like the one in
 *   picture N (…)"), the panel's 🖼 row.
 *   🖼 the image editor: a reference dropped on an open picture = a new layer named by its description; ✨ AI Edit's
 *   reference dropdown -> /api/aiedit gets ref0 + ref_desc (answered in the page - nothing renders).
 * Against the running app (H3_URL, default :8311). The house is deleted, the dock emptied and saved again. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.539 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body, method) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined && !method ? {} : { method: method || "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })).json();

(async () => {
  try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* fine */ }
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });   // 2.556.0: results straight in, as when this test was written (no ⏳ Pending)
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let slug = "";
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY && window.H3Refs && window.RefInfo && window.SecFloat && SecFloat.started, null, { timeout: 60000 });
    await p.waitForTimeout(2500);                 // the boot's project (its references) is in

    /* ---- the References docker */
    // three pictures (a wall, a sofa, a lamp), drawn in the page; Reference mode (ref2va) for the mapping lines
    await ev(async () => {
      const mk = (col, name) => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 64; c.height = 48; const g = c.getContext("2d"); g.fillStyle = col; g.fillRect(0, 0, 64, 48); c.toBlob((bl) => ok(new File([bl], name, { type: "image/png" })), "image/png"); });
      rgClear();
      const files = [await mk("#a4573f", "e2e539_brick.png"), await mk("#2e6b3a", "e2e539_sofa.png"), await mk("#d9b45a", "e2e539_lamp.png")];
      files.forEach((f) => refs.push({ file: f, url: URL.createObjectURL(f), subject: nextFreeSubject(), role: "person", roleOther: "" }));
      const btn = document.querySelector('.modes button[data-mode="ref2va"]'); if (btn) btn.click();
      normalizeSubjects(); renderTray();
      refVids.push("e2e539_dance.mp4"); refAuds.push("e2e539_voice.wav"); renderRefLists();
    });
    await p.waitForTimeout(300);
    const tray = await ev(() => ({ boxes: document.querySelectorAll("#tray .slot .refdesc").length, opts: [...document.querySelector("#tray .slot select.role").options].map((o) => o.value),
      vid: document.querySelectorAll("#refvids .aitem .refdesc").length, aud: document.querySelectorAll("#refauds .aitem .refdesc").length }));
    check("a description box under every picture, the video and the sound", tray.boxes === 3 && tray.vid === 1 && tray.aud === 1, tray);
    check("the Type dropdown has wall · floor · furniture · light", ["wall", "floor", "furniture", "light"].every((t) => tray.opts.includes(t)), tray.opts);
    const boxes = p.locator("#tray .slot .refdesc");
    await boxes.nth(0).fill("red brick, white mortar");
    await boxes.nth(1).fill("a green velvet chesterfield");
    await boxes.nth(2).fill("a brass floor lamp");
    await p.click('#reftabs [data-rtab="vid"]'); await p.waitForTimeout(300);
    await p.locator("#refvids .aitem .refdesc").fill("a slow waltz");
    await p.click('#reftabs [data-rtab="snd"]'); await p.waitForTimeout(300);
    await p.locator("#refauds .aitem .refdesc").fill("her voice, calm and low");
    await p.click('#reftabs [data-rtab="img"]'); await p.waitForTimeout(300);
    await ev(() => { const sel = document.querySelectorAll("#tray .slot select.role"); const set = (i, v) => { sel[i].value = v; sel[i].onchange(); }; set(0, "wall"); set(1, "furniture"); set(2, "light"); });
    await p.waitForTimeout(200);
    const mp = await ev(() => mappingLines());
    check("the mapping lines carry the type + the description", /furniture is in <Picture 2> \(a green velvet chesterfield\)/.test(mp) && /wall is in <Picture 1> \(red brick, white mortar\)/.test(mp), mp);
    const ps = await ev(() => projectState().references);
    check("the project state keeps them (images[].desc, notes.videos / notes.audio)", ps.images[1].desc === "a green velvet chesterfield" && ps.notes.videos["e2e539_dance.mp4"] === "a slow waltz" && ps.notes.audio["e2e539_voice.wav"] === "her voice, calm and low", ps);
    const H = await ev(() => ({ imgs: H3Refs.images().map((r) => [r.role, r.desc]), v: H3Refs.videos(), s: H3Refs.sounds() }));
    check("window.H3Refs gives the other dockers the pictures (type + description), videos and sounds", H.imgs[1][0] === "furniture" && H.imgs[1][1] === "a green velvet chesterfield" && H.v[0].desc === "a slow waltz" && H.s[0].desc === "her voice, calm and low", H);
    const saved = await ev(async () => { const j = await projSave(document.getElementById("projname").textContent); return j && j.references; });
    check("Save: the server keeps a picture's description (the videos' notes go with files that are in the project)", saved && saved.images.length === 3 && saved.images[1].desc === "a green velvet chesterfield" && saved.images[0].role === "wall", saved);
    await ev(async (m) => { await loadProjectReferences(m); }, saved);
    await p.waitForTimeout(400);
    const back = await ev(() => [...document.querySelectorAll("#tray .slot .refdesc")].map((x) => x.value));
    check("…opened again: the descriptions are back under the pictures", back[1] === "a green velvet chesterfield" && back[2] === "a brass floor lamp", back);
    await ev(() => { refVids.push("e2e539_dance.mp4"); refAuds.push("e2e539_voice.wav"); refNotes = RefInfo.notesIn({ notes: { videos: { "e2e539_dance.mp4": "a slow waltz" }, audio: { "e2e539_voice.wav": "her voice, calm and low" } } }); renderRefLists(); });

    /* 2.630.0: the House builder (its references on walls / pieces) is gone */
    /* ---- 🖼 the image editor */
    const ieOpen = async () => ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ieOpen(); await p.waitForTimeout(500);
    await p.waitForFunction(() => window.imageEditorInstance && typeof window.imageEditorInstance.load === "function", null, { timeout: 20000 });
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 320; c.height = 200; const g = c.getContext("2d"); g.fillStyle = "#335"; g.fillRect(0, 0, 320, 200); window.imageEditorInstance.load(c.toDataURL("image/png"), "e2e539 base"); setTimeout(ok, 600); }));
    await p.waitForFunction(() => window.imageEditorInstance.state.w === 320, null, { timeout: 10000 });
    const n0 = await ev(() => window.imageEditorInstance.state.layers.length);
    await ev(() => { dragPayload = { type: "refimg", refIndex: 2 }; const st = document.getElementById("ieStage"), dt = new DataTransfer(); dt.setData("text/plain", "ref");
      st.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt })); st.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt })); dragPayload = null; });
    await p.waitForSelector("#ieDropAsk [data-as=layer]", { timeout: 5000 }); await p.click("#ieDropAsk [data-as=layer]");   // 2.549.0: it asks - as a layer
    await p.waitForTimeout(800);
    const L = await ev(() => ({ n: window.imageEditorInstance.state.layers.length, w: window.imageEditorInstance.state.w, names: window.imageEditorInstance.state.layers.map((l) => l.name) }));
    check("a reference dropped on an open picture comes in as a NEW LAYER named by its description (the picture stays open)", L.n === n0 + 1 && L.w === 320 && L.names.includes("a brass floor lamp"), L);
    // ✨ AI -> Edit: the reference dropdown, and what /api/aiedit gets
    let sent = null;
    await p.route("**/api/aiedit", async (r) => { const body = r.request().postDataBuffer() || Buffer.alloc(0); sent = body.toString("latin1"); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jobs: [], workflow: "stub.json", note: "", mode: "edit" }) }); });
    await ev(() => { const E = window.imageEditorInstance.E; E.ui.showTab("kxAi"); E.setAiMode("edit"); const es = document.getElementById("ieEditStyle"); es.innerHTML = '<option value="stub539">Stub edit</option>'; es.value = "stub539"; document.getElementById("iePrompt").value = "put the lamp from Picture 2 by the window"; });
    await p.waitForTimeout(200);
    const dd = await ev(() => { const r = document.getElementById("kxRowRef"), s = document.getElementById("kxRef"); s.dispatchEvent(new Event("focus")); return { shown: r && getComputedStyle(r).display !== "none", opts: [...s.options].map((o) => o.textContent) }; });
    check("✨ AI Edit has a 'reference' dropdown: the References docker's pictures by their descriptions", dd.shown && dd.opts.some((t) => /a brass floor lamp/.test(t)) && dd.opts.some((t) => /chesterfield/.test(t)), dd);
    await ev(() => { const s = document.getElementById("kxRef"); s.value = "2"; window.imageEditorInstance.E.selectAll(); return window.imageEditorInstance.E.runAI(); });
    await p.waitForTimeout(800);
    check("…an Edit with it: /api/aiedit gets ref0 (the picture) + ref_desc (its description)", !!sent && /name="ref0"/.test(sent) && /name="ref_desc"\r\n\r\na brass floor lamp/.test(sent) && /name="mode"\r\n\r\nedit/.test(sent), sent && sent.slice(0, 300));
    await ev(() => { document.getElementById("kxRef").value = ""; window.imageEditorInstance.E.setAiMode("generate"); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("crashed: " + (e.stack || e), false); }
  finally {
    try { await ev(async () => { rgClear(); await projSave(document.getElementById("projname").textContent); }); } catch { /* fine */ }
    try { await b.close(); } catch { /* fine */ }
    if (slug) await api(`/api/house/${encodeURIComponent(slug)}?assets=1`, undefined, "DELETE").catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
