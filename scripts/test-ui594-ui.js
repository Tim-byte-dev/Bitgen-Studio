#!/usr/bin/env node
/* bitGen Studio — 2.594.0 in a REAL browser, against the running app (H3_URL): RIGHT-CLICK 🧊 CONVERT TO 3D and the
 * Settings ▸ Audio ENGINE PICKS.
 *   Gallery / Assets pictures: right-click = the menu (engines, where it goes); Convert -> POST /api/mesh3d {name, where,
 *   engine}, the job followed (GET /api/jobs/<id>), then the .glb into the image editor (E.layer3d.openScene) or
 *   SolidCraft (H3SolidCraft.openFile with the model's bytes); a References picture and the image editor's picture /
 *   picked layer are SENT as PNG (POST /api/to3d/picture); Layer ▸ Convert Layer to 3D… exists. The 3D jobs and
 *   SolidCraft are stood in for (page routes / stubs) - ComfyUI is not needed.
 *   Settings ▸ Audio: Speech engine = Ming-3.0 TTS shows its panel (OmniVoice's hides) and saves tts.engine; the STT pick
 *   = Bark 3.0 shows its line and saves asr.engine; Install… opens Settings ▸ Add-ons on that card. Settings put back.
 * Tim: "can you add https://nomorecoding.github.io/Ming-3.0-tts/ as an option for tts, ... right click on an image in
 * gallery, assets, reference or image-editor and convert to 3d using context menu , the 3d model can go into image-editor
 * or solidcraft docker and add option to use https://underdog.ai/bark as stt engine". No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.594.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const post = async (p, b) => (await fetch(URL_ + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })).json();

(async () => {
  const cfg0 = await (await fetch(URL_ + "api/config")).json();
  const tts0 = JSON.parse(JSON.stringify(cfg0.tts || {})), asr0 = JSON.parse(JSON.stringify(cfg0.asr || {}));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const sent = [], cfgPosts = [];
  p.on("request", (r) => { if (r.method() === "POST" && /\/api\/config$/.test(r.url())) { try { cfgPosts.push(JSON.parse(r.postData() || "{}")); } catch { /* fine */ } } });
  let jobN = 0;
  await p.route(/\/api\/mesh3d$/, async (r) => { sent.push({ url: "mesh3d", body: JSON.parse(r.request().postData() || "{}") }); await r.fulfill({ json: { id: "j" + (++jobN), status: "queued", model: "stub_model.glb" } }); });
  await p.route(/\/api\/to3d\/picture/, async (r) => { const buf = r.request().postDataBuffer(); sent.push({ url: r.request().url(), png: !!buf && buf.slice(0, 8).toString("hex") === "89504e470d0a1a0a", bytes: buf ? buf.length : 0 }); await r.fulfill({ json: { id: "j" + (++jobN), status: "queued", model: "stub_model.glb", picture: "x.png" } }); });
  await p.route(/\/api\/jobs\/j\d+$/, (r) => r.fulfill({ json: { id: "j", status: "done" } }));
  await p.route(/\/api\/tlcanvas\/model\/stub_model\.glb$/, (r) => r.fulfill({ body: Buffer.from("glTF....stub"), contentType: "model/gltf-binary" }));
  const menuOpen = () => ev(() => { const m = document.getElementById("to3dMenu"); return m ? { title: m.querySelector(".t3n").textContent, eng: [...m.querySelectorAll('input[name="t3eng"]')].map((i) => i.value), dest: [...m.querySelectorAll('input[name="t3dest"]')].map((i) => i.value), part: !!m.querySelector('input[name="t3part"]') } : null; });
  const rclick = async (sel) => { const el = await p.$(sel); const bb = await el.boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2, { button: "right" }); await p.waitForTimeout(150); };
  const choose = (eng, dest, part) => ev(([e, d, pt]) => { const m = document.getElementById("to3dMenu"); m.querySelector(`input[name="t3eng"][value="${e}"]`).checked = true; m.querySelector(`input[name="t3dest"][value="${d}"]`).checked = true; if (pt) m.querySelector(`input[name="t3part"][value="${pt}"]`).checked = true; m.querySelector('[data-t3="go"]').click(); }, [eng, dest, part]);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3To3D && window.H3Speech && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.layer3d, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    // stand-ins: the image editor's 3D layer opening, SolidCraft
    await ev(() => {
      window.__opened = []; window.__sc = [];
      window.imageEditorInstance.E.layer3d.openScene = (m) => { window.__opened.push(m); return Promise.resolve({ id: 1 }); };
      window.H3SolidCraft = Object.assign(window.H3SolidCraft || {}, { ready: () => Promise.resolve({}), openFile: (n, blob) => blob.arrayBuffer().then((ab) => { window.__sc.push({ n, bytes: ab.byteLength }); }) });
      if (!document.getElementById("solidcraftdock")) { const d = document.createElement("div"); d.id = "solidcraftdock"; d.style.display = "none"; document.body.appendChild(d); }
    });
    // ---- a Gallery picture and an Assets picture (the same markup the Gallery / Assets draw)
    await ev(() => {
      const host = document.createElement("div"); host.id = "t594host"; host.style.cssText = "position:fixed;left:20px;top:200px;z-index:5000;display:flex;gap:10px";
      host.innerHTML = '<div class="thumb" data-lb-kind="image" data-lb-name="hero_shot.png" style="width:120px;height:90px;background:#888"></div>'
        + '<div class="aitem" data-lb-kind="image" data-lb-name="my_asset.png" style="width:120px;height:90px;background:#999"></div>';
      document.body.appendChild(host);
    });
    await rclick('#t594host .thumb');
    const m1 = await menuOpen();
    check("right-click a Gallery picture: the 🧊 Convert to 3D menu - its name, Hunyuan3D 2.1 / TRELLIS.2, image editor / SolidCraft / just save", m1 && m1.title === "hero_shot.png" && m1.eng.join() === "auto,trellis" && m1.dest.join() === "editor,solidcraft,save" && !m1.part, m1);
    await choose("trellis", "editor");
    await p.waitForFunction(() => window.__opened.length === 1, null, { timeout: 15000 });
    check("Convert: POST /api/mesh3d {name, where output, engine trellis}, followed to done, then the .glb opens as a 3D layer in the image editor",
      sent[0] && sent[0].url === "mesh3d" && sent[0].body.name === "hero_shot.png" && sent[0].body.where === "output" && sent[0].body.engine === "trellis" && (await ev(() => window.__opened[0])) === "stub_model.glb", sent);
    await rclick('#t594host .aitem');
    const m2 = await menuOpen();
    check("right-click an Assets picture: the menu remembers the last picks (TRELLIS.2, image editor)", m2 && m2.title === "my_asset.png" && (await ev(() => document.querySelector('#to3dMenu input[name="t3eng"][value="trellis"]').checked && document.querySelector('#to3dMenu input[name="t3dest"][value="editor"]').checked)), m2);
    await choose("auto", "solidcraft");
    await p.waitForFunction(() => window.__sc.length === 1, null, { timeout: 15000 });
    check("…to SolidCraft: where images, then H3SolidCraft.openFile(stub_model.glb, its bytes from /api/tlcanvas/model/)", sent[1] && sent[1].body.where === "images" && sent[1].body.engine === "auto" && JSON.stringify(await ev(() => window.__sc[0])) === '{"n":"stub_model.glb","bytes":12}', { sent, sc: await ev(() => window.__sc) });
    // ---- a References picture (sent)
    const refOk = await ev(() => new Promise((ok) => {
      const c = document.createElement("canvas"); c.width = 64; c.height = 64; c.getContext("2d").fillRect(0, 0, 32, 32);
      c.toBlob((bl) => {
        const f = new File([bl], "face_ref.png", { type: "image/png" });
        try { if (typeof mode !== "undefined" && mode === "t2va") mode = "ref2va"; refs.length = 0; refs.push({ file: f, url: URL.createObjectURL(f), role: "person" }); renderTray(); } catch (e) { return ok("no tray: " + e.message); }
        const d = document.getElementById("refsdock"); if (d && d.classList.contains("dockgone")) toggleDockGone("refsdock");
        ok(!!document.querySelector("#tray .slot:not(.add)"));
      }, "image/png");
    }));
    if (refOk !== true) check("a References picture is in the tray", false, refOk);
    else {
      await ev(() => { const s = document.querySelector("#tray .slot:not(.add)"); s.scrollIntoView(); });
      const box = await (await p.$("#tray .slot:not(.add) img")).boundingBox();
      if (!box || box.width < 2) { await ev(() => { const s = document.querySelector("#tray .slot:not(.add) img"); s.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 300, clientY: 300 })); }); await p.waitForTimeout(150); }
      else { await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" }); await p.waitForTimeout(150); }
      const m3 = await menuOpen();
      check("right-click a References picture: the menu (Reference 1 - face_ref.png)", m3 && /Reference 1 - face_ref\.png/.test(m3.title), m3);
      await choose("auto", "save");
      await p.waitForFunction(() => document.getElementById("to3dMenu") === null, null, { timeout: 5000 });
      await p.waitForTimeout(800);
      const s3 = sent[2] || {};
      check("…the picture is SENT as a PNG to /api/to3d/picture?name=face_ref.png&engine=auto (it is not in the project); just save = nothing opens", /\/api\/to3d\/picture\?name=face_ref\.png&engine=auto/.test(s3.url || "") && s3.png && (await ev(() => window.__opened.length === 1 && window.__sc.length === 1)), s3);
    }
    // ---- the image editor: the whole picture / the picked layer, and Layer ▸ Convert Layer to 3D…
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 320; c.height = 240; const g = c.getContext("2d"); g.fillStyle = "#3a6"; g.fillRect(0, 0, 320, 240); window.imageEditorInstance.load(c.toDataURL("image/png"), "ui594"); setTimeout(ok, 800); }));
    await p.waitForFunction(() => window.imageEditorInstance.E.S.w === 320, null, { timeout: 20000 });
    await ev(() => { const s = document.getElementById("ieStage"); s.scrollIntoView(); });
    // (the stage may be laid out tiny in this window - the right-click is sent to it directly)
    await ev(() => { const s = document.getElementById("ieStage"), r = s.getBoundingClientRect(); s.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.x + 30, clientY: r.y + 10 })); });
    await p.waitForTimeout(250);
    const km = await ev(() => [...document.querySelectorAll(".kxmenu [data-cmd]")].map((d) => d.dataset.cmd));
    check("right-click the image editor's canvas: its own menu has 🧊 Convert Picture to 3D… and 🧊 Convert Layer to 3D…", km.includes("pic.to3d") && km.includes("layer.to3d"), km);
    await ev(() => document.querySelector('.kxmenu [data-cmd="layer.to3d"]').click());
    await p.waitForTimeout(200);
    const m4 = await menuOpen();
    check("…Convert Layer to 3D… opens the menu with From - the picked layer ticked", m4 && m4.part && /^Layer: /.test(m4.title) && (await ev(() => document.querySelector('#to3dMenu input[name="t3part"][value="layer"]').checked)), m4);
    await choose("auto", "editor", "layer");
    await p.waitForFunction(() => window.__opened.length === 2, null, { timeout: 15000 });
    const s4 = sent[3] || {};
    check("…the picked layer is sent as a PNG (/api/to3d/picture?name=layer_…), then it opens as a 3D layer", /\/api\/to3d\/picture\?name=layer_/.test(s4.url || "") && s4.png && s4.bytes > 100, s4);
    const cmd = await ev(() => { const E = window.imageEditorInstance.E; return { has: (E.ui.layerCtxItems || []).includes("layer.to3d"), flag: !!E.ui._to3d }; });
    check("the Layers panel's right-click menu + Layer menu have 🧊 Convert Layer to 3D…", cmd.has && cmd.flag, cmd);
    await ev(() => document.getElementById("t594host").remove());

    // ---- Settings ▸ Audio
    await ev(() => { if (typeof openSettings === "function") openSettings(); else document.getElementById("settings").showModal(); });
    await ev(() => document.querySelector('#settings .stabs [data-stab="audio"]').click());
    await p.waitForTimeout(600);
    await ev(() => { const s = document.getElementById("s_ttsengine"); s.value = "ming"; s.dispatchEvent(new Event("change", { bubbles: true })); });
    await p.waitForTimeout(900);
    const a1 = await ev(() => ({ dis: document.getElementById("s_ttsengine").disabled, ming: getComputedStyle(document.getElementById("s_ming")).display !== "none", omni: getComputedStyle(document.getElementById("s_omni")).display !== "none", st: document.getElementById("s_mingstatus").textContent }));
    const t1 = cfgPosts.filter((c) => c.tts).pop() || {};
    check("Speech engine = Ming-3.0 TTS: the pick is live, Ming's panel shows (OmniVoice's hides), its state says what to do, saved at once (tts.engine ming + its language)", !a1.dis && a1.ming && !a1.omni && /Install Ming-3\.0 TTS|installed/.test(a1.st) && t1.tts.engine === "ming" && t1.tts.ming && t1.tts.ming.language === "English", { a1, posted: t1 });
    await ev(() => { const s = document.getElementById("s_asrengine"); s.value = "bark"; s.dispatchEvent(new Event("change", { bubbles: true })); });
    await p.waitForTimeout(900);
    const a2 = await ev(() => ({ row: getComputedStyle(document.getElementById("s_barkrow")).display !== "none", st: document.getElementById("s_barkstatus").textContent }));
    const t2 = cfgPosts.filter((c) => c.asr).pop() || {};
    check("Speech-to-text engine = Bark 3.0: its line (installed? + what stays on faster-whisper) and Install…, saved at once (asr.engine bark)", a2.row && /stay on faster-whisper/.test(a2.st) && t2.asr.engine === "bark", { a2, posted: t2 });
    await ev(() => { window.__acted = []; const A = window.H3Addons; A.act = (id, act) => { window.__acted.push(id + ":" + act); return Promise.resolve(null); }; document.getElementById("s_barkinstall").click(); });
    await p.waitForFunction(() => window.__acted.length === 1, null, { timeout: 15000 });
    const a3 = await ev(() => ({ acted: window.__acted, tab: document.getElementById("stab-addons") && document.getElementById("stab-addons").classList.contains("active"), card: !!document.querySelector('#aoList .ao[data-addon="bark"]'), ming: !!document.querySelector('#aoList .ao[data-addon="ming"]') }));
    check("Install Bark 3.0…: Settings ▸ Add-ons opens with the Bark 3.0 card (and Ming-3.0 TTS's), its Install started", a3.acted[0] === "bark:install" && a3.tab && a3.card && a3.ming, a3);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { await b.close(); } catch { /* fine */ }
    try { await post("api/config", { tts: Object.assign({ engine: "omnivoice" }, tts0), asr: Object.assign({ engine: "whisper" }, asr0) }); } catch { /* fine */ }   // (a section merges - the engine is put back by name)
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
