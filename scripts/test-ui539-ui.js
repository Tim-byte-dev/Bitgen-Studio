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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY && window.H3Refs && window.RefInfo && window.H3House && window.SecFloat && SecFloat.started, null, { timeout: 60000 });
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

    /* ---- 🏠 the house builder */
    await p.click("#hbBtn"); await p.waitForTimeout(800);
    await ev(() => SecFloat.float("house", 300, 70, 1100, 820)); await p.waitForTimeout(300);
    slug = await ev(async () => {
      const m = H3HouseGeo.example(); m.name = "E2E house 539"; m.refs = [];
      H3House.load(m); const S = H3House.state(); S.zoom = 50; S.ox = 60; S.oy = 60; H3House.setView("plan"); H3House.setTool("select");
      await H3House.save(true); return S.slug;
    });
    check("the house is saved (its reference pictures are kept with it)", !!slug, slug);
    const wallId = await ev(() => H3House.state().m.walls[0].id);
    await ev(async (wid) => { await H3House.fromDock({ kind: "wall", id: wid }, H3Refs.images()[0]); }, wallId);
    await p.waitForTimeout(500);
    const w1 = await ev((wid) => { const S = H3House.state(), w = S.m.walls.find((x) => x.id === wid); return { tex: w.tex, sc: w.texScale, refs: JSON.parse(JSON.stringify(S.m.refs)), side: document.getElementById("hbProps").textContent, img: (document.querySelector("#hbProps .hbref img") || {}).src || "" }; }, wallId);
    check("a wall picture from the References docker on a wall: kept with the house (kind wall, its description), the wall wears it", w1.tex && w1.refs.length === 1 && w1.refs[0].kind === "wall" && w1.refs[0].desc === "red brick, white mortar" && w1.sc === 1, w1);
    check("…the panel shows 🖼 Wall picture with its picture, description and Tile (m)", /Wall picture/.test(w1.side) && /Tile \(m\)/.test(w1.side) && /\/api\/house\/.+\/ref\//.test(w1.img), w1.side.slice(0, 200));
    const got = await fetch(w1.img);
    check("…GET /api/house/<house>/ref/<file> serves it", got.status === 200 && /image\/png/.test(got.headers.get("content-type") || ""), got.status);
    const tm = await ev(() => H3HouseGeo.build(H3House.state().m).meshes.filter((x) => x.tex).map((x) => [x.mat, x.tex]));
    check("…the build gives that wall its own textured mesh (the 3D view / the shots map the picture)", tm.length === 1 && tm[0][0] === "plaster", tm);
    // drop the sofa picture on a piece of furniture on the plan
    const it = await ev(() => { const S = H3House.state(), i = S.m.items.find((x) => x.floor === 0 && x.w * x.d > 0.6) || S.m.items[0], r = document.getElementById("hbPlan").getBoundingClientRect(); return { id: i.id, x: r.left + i.x * S.zoom + S.ox, y: r.top + i.y * S.zoom + S.oy, label: i.type }; });
    await ev((at) => { const c = document.getElementById("hbPlan"), dt = new DataTransfer(); dt.setData("application/x-h3ref", "1"); dt.setData("text/plain", "ref");
      c.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y, dataTransfer: dt }));
      c.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y, dataTransfer: dt })); }, it);
    await p.waitForTimeout(700);
    const i1 = await ev((iid) => { const S = H3House.state(), o = S.m.items.find((x) => x.id === iid); return { ref: o.ref, refs: S.m.refs.map((q) => [q.kind, q.desc]), sel: S.sel, side: document.getElementById("hbProps").textContent }; }, it.id);
    check("a furniture picture DROPPED on a piece on the plan: it looks like it (🖼 Looks like), kept as furniture", !!i1.ref && i1.refs.some((q) => q[0] === "furniture" && q[1] === "a green velvet chesterfield") && i1.sel && i1.sel.id === it.id && /Looks like/.test(i1.side), i1);
    // ✨ Make it real: a camera looking at it, a style that takes 4 pictures
    const pr = await ev((iid) => {
      const S = H3House.state(), o = S.m.items.find((x) => x.id === iid);
      S.m.cameras.push({ id: "c539", floor: o.floor, name: "E2E 539", x: o.x - 2.5, y: o.y, z: 1.6, yaw: 0, pitch: 0, fov: 70 });
      S.styles = [{ id: "stub539", name: "Stub edit", slots: 4 }]; const s = document.getElementById("hbStyle"); s.innerHTML = '<option value="stub539">Stub edit</option>'; s.value = "stub539";
      return H3House.realPrompt(S.m.cameras[S.m.cameras.length - 1]);
    }, it.id);
    check("✨ Make it real's prompt: \"look exactly like the one in picture N (a green velvet chesterfield)\"", /look exactly like the one in picture \d \(a green velvet chesterfield\)/.test(pr), pr);
    const shot = await ev(async () => { const S = H3House.state(); const c = S.m.cameras.find((x) => x.id === "c539"); const o = await H3House.renderShot(c, 320, 180, ["shot"]); return o && o.shot ? o.shot.size : 0; }).catch((e) => "error " + e.message);
    check("…a 📷 shot renders with the textured wall (it waits for the picture)", typeof shot === "number" && shot > 1000, shot);
    await ev(() => SecFloat.show("house", false));

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
