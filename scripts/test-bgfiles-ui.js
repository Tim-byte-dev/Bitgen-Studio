#!/usr/bin/env node
/* bitGen Studio — 2.436.0 in a REAL browser: the image editor's .bgi (pcbgi.js) round trip with every kind of layer,
 * the timeline's 🎞 .bgv dialog (bgv.js) and the menu bar's 📦 .bgp dialog (static/bgp.js).
 * Tim: "save image edit project as .bgi, save video project as .bgv, save the overall project as .bgp in xml format".
 * Against the running app (H3_URL, default the e2e server on :8311; the files land in this install's projects/).
 * No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the .bgi / .bgv / .bgp browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};
const api = async (p, o) => { const r = await fetch(URL_ + p.replace(/^\//, ""), o); return r.json(); };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const tag = "zz" + process.pid;
  let proj = "default", tlBefore = null;
  const madeProjects = [], madeFiles = [];
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.bgi, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    proj = (await api("/api/projects")).current;
    tlBefore = (await api("/api/timelines")).active;
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(800);

    /* 1 a document with every kind of layer */
    await ev(() => {
      const E = window.imageEditorInstance.E, S = E.S, D = window.PCDoc;
      E.docs.setTabs(true);
      E.openDoc(300, 200, "bgi.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 300, 200); });
      // a pixel layer with a mask (half hidden), a label, a style and a lock
      const A = E.makeLayer("Red box", 300, 200); const ga = A.canvas.getContext("2d"); ga.fillStyle = "#ff0000"; ga.fillRect(20, 20, 120, 80);
      A.mask = E.newMask("#ffffff", 300, 200); const gm = A.mask.canvas.getContext("2d"); gm.fillStyle = "#000000"; gm.fillRect(80, 0, 220, 200); A.mask.density = 0.8;
      A.label = "red"; A.opacity = 0.9; A.blend = "multiply"; A.locks = { pos: true }; A.styles = { stroke: Object.assign({}, D.STYLE_DEFAULTS.stroke || {}, { on: true }) };
      // a group with a text layer and a shape layer inside
      const G = E.makeLayer("Group 1", 300, 200, "group");
      const T = E.makeLayer("Hello", 300, 200, "text"); T.text = Object.assign({}, D.TEXT_DEFAULT, { str: "Hi <bgi> & ü", color: "#0000ff", size: 30, x: 150, y: 120 }); T.parent = G.id; D.rasterize(T);
      const H = E.makeLayer("Shape", 300, 200, "shape"); H.shape = Object.assign({}, D.SHAPE_DEFAULT, { kind: "ellipse", x: 200, y: 20, w: 80, h: 60, fill: "#00aa00" }); H.parent = G.id; H.clip = false; D.rasterize(H);
      S.layers.push(A, G, T, H);
      // a smart object (from a pixel layer) with a smart filter + its filter mask
      const P = E.makeLayer("Smart src", 300, 200); const gp = P.canvas.getContext("2d"); gp.fillStyle = "#ffcc00"; gp.fillRect(10, 140, 100, 50);
      S.layers.push(P); S.active = S.layers.length - 1;
      E.smart.convert();
      const SM = E.layer(); SM.smart.filters.push({ id: "invert", params: {}, on: true, opacity: 1, blend: "normal" });
      SM.fmask = { canvas: (() => { const c = document.createElement("canvas"); c.width = 300; c.height = 200; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 300, 200); g.fillStyle = "#000"; g.fillRect(0, 0, 60, 200); return c; })(), on: true, ver: 0 };
      E.smart.render(SM);
      // channels, a selection, a saved path, a layer comp
      const ch = new Uint8Array(300 * 200); for (let i = 0; i < 300 * 50; i++) ch[i] = 200;
      S.channels = [{ id: "c1", name: "Alpha 1", w: 300, h: 200, data: ch }];
      const sel = new Uint8Array(300 * 200); for (let y = 10; y < 40; y++) for (let x = 10; x < 60; x++) sel[y * 300 + x] = 255; E.setSel(sel, true);
      S.paths = [{ id: "pa1", name: "Path 1", path: { subs: [{ closed: true, pts: [{ x: 1, y: 2 }, { x: 50, y: 2 }, { x: 50, y: 60 }] }] } }];
      S.active = 1;
      E.refresh(); E.renderLayersPanel();
      E.comps.make("All on", { vis: true, pos: true, look: true });
    });
    await p.waitForTimeout(300);
    const snap = () => ev(() => {
      const E = window.imageEditorInstance.E, S = E.S, B = window.PCBgi;
      const sum = (c) => { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i++) s += d[i]; return s; };
      const byId = new Map(S.layers.map((L) => [L.id, L]));
      const layers = S.layers.map((L) => {
        const s = B.settingsOf(L); delete s.parent;
        return { set: JSON.stringify(s), parent: L.parent != null ? byId.get(L.parent).name : null, px: sum(L.canvas), mask: L.mask ? [L.mask.on, L.mask.density, sum(L.mask.canvas)] : null, fmask: L.fmask ? sum(L.fmask.canvas) : null };
      });
      const sm = S.layers.find((L) => L.type === "smart"), s0 = sm && E.smart.STORE.get(sm.smart.src);
      const comp = (S.comps || [])[0];
      return { w: S.w, h: S.h, n: S.layers.length, active: S.active, layers, flat: sum(E.flatten()), ch: S.channels.map((c) => [c.name, c.data.reduce((a, v) => a + v, 0)]), sel: S.selCount != null ? S.sel.reduce((a, v) => a + v, 0) : null,
        paths: JSON.stringify(S.paths), comps: comp ? [comp.name, Object.keys(comp.layers).length, Object.keys(comp.layers).every((k) => byId.has(+k))] : null,
        smart: s0 ? [s0.w, s0.h, s0.doc ? s0.doc.layers.length : 0, sum(s0.canvas)] : null };
    });
    const A0 = await snap();
    check("the document to keep: 6 layers - a pixel layer with a mask / label / style / lock, a group holding a text and a shape layer, a smart object with a smart filter and its mask - + a channel, a selection, a path, a layer comp",
      A0.n === 6 && A0.layers.filter((l) => l.parent === "Group 1").length === 2 && A0.smart && A0.smart[2] >= 1 && A0.comps && A0.comps[1] === 6 && A0.sel > 0, A0);

    /* 2 Save Project (.bgi) */
    await ev((n) => window.imageEditorInstance.E.bgi.save(n, false), tag + "_bgi");
    const files = (await api("/api/bgfile/bgi/list")).files;
    const mine = files.find((f) => f.name === tag + "_bgi.bgi");
    if (mine) madeFiles.push(path.join(ROOT, "projects", proj, "bgi", mine.name));
    const st = await ev(() => { const E = window.imageEditorInstance.E; return { name: E.S.bgiName, dirty: E.docs.list().find((d) => d.live).dirty }; });
    check("Save Project: <name>.bgi in the project's bgi folder; the document remembers it and is not dirty any more", !!mine && mine.size > 2000 && st.name === tag + "_bgi.bgi" && st.dirty === false, { mine, st });
    const inside = await ev(async (n) => {
      const r = await fetch("/api/bgfile/bgi/file/" + encodeURIComponent(n)), u8 = new Uint8Array(await r.arrayBuffer());
      const m = await window.BgZip.unzipAsync(u8), names = [...m.keys()];
      const xml = window.BgZip.text(m.get("doc.xml"));
      return { names, head: xml.slice(0, 220), zipStart: Array.from(u8.slice(0, 4)), hasText: xml.includes("Hi &lt;bgi&gt; &amp; ü") };
    }, tag + "_bgi.bgi");
    check("...a zip: doc.xml (<bitgen-image version=\"1\" w h …>, the text readable) + preview.png + each layer / mask / filter mask as a PNG + the smart object's contents + the channel / selection",
      inside.zipStart.join() === "80,75,3,4" && inside.names[0] === "doc.xml" && inside.names.includes("preview.png") && inside.names.filter((n) => /^layers\/\d+\.png$/.test(n)).length === 6
      && inside.names.some((n) => /^masks\//.test(n)) && inside.names.some((n) => /^fmasks\//.test(n)) && inside.names.some((n) => /^smart\/[^/]+\/source\.png$/.test(n)) && inside.names.includes("channels/1.u8") && inside.names.includes("sel.u8")
      && /<bitgen-image version="1" app="[^"]*" w="300" h="200" name="bgi.png" layers="6"/.test(inside.head) && inside.hasText, inside);

    /* 3 open it again (a new document) - everything as it was */
    const docsBefore = await ev(() => window.imageEditorInstance.E.docs.list().length);
    const res = await ev((n) => window.imageEditorInstance.E.bgi.openFromProject(n), tag + "_bgi.bgi");
    await p.waitForTimeout(400);
    const B0 = await snap();
    const docsAfter = await ev(() => window.imageEditorInstance.E.docs.list().length);
    check("Open Project from Project: a new document (tab), 6 layers, the same size, the same active layer", res && res.layers === 6 && docsAfter === docsBefore + 1 && B0.w === 300 && B0.h === 200 && B0.active === A0.active, { res, docsBefore, docsAfter });
    const setDiff = A0.layers.map((l, i) => (l.set === B0.layers[i].set ? "" : i + ":" + l.set + " ≠ " + B0.layers[i].set)).filter(Boolean);
    check("...every layer's settings exactly (name, type, opacity, blend, label, locks, styles, text, shape, smart filters…)", setDiff.length === 0, setDiff);
    check("...the groups (new ids, the same parents)", JSON.stringify(A0.layers.map((l) => l.parent)) === JSON.stringify(B0.layers.map((l) => l.parent)), B0.layers.map((l) => l.parent));
    const pxDiff = A0.layers.map((l, i) => Math.abs(l.px - B0.layers[i].px) / Math.max(1, l.px));
    check("...the pixels (each layer within 0.1 %), the mask (on, density, pixels), the smart filter mask", pxDiff.every((d) => d < 0.001)
      && JSON.stringify(A0.layers.map((l) => l.mask)) === JSON.stringify(B0.layers.map((l) => l.mask)) && JSON.stringify(A0.layers.map((l) => l.fmask)) === JSON.stringify(B0.layers.map((l) => l.fmask)), { pxDiff, m: B0.layers.map((l) => l.mask) });
    check("...the picture as a whole (within 0.1 %)", Math.abs(A0.flat - B0.flat) / A0.flat < 0.001, [A0.flat, B0.flat]);
    check("...the smart object's contents (its own layers) and source", JSON.stringify(A0.smart) === JSON.stringify(B0.smart), [A0.smart, B0.smart]);
    check("...the channel, the selection, the path, the layer comp (its layers keyed by the NEW ids)", JSON.stringify(A0.ch) === JSON.stringify(B0.ch) && A0.sel === B0.sel && A0.paths === B0.paths && B0.comps[0] === "All on" && B0.comps[1] === 6 && B0.comps[2] === true, { ch: [A0.ch, B0.ch], sel: [A0.sel, B0.sel], paths: [A0.paths, B0.paths], comps: B0.comps });
    const st2 = await ev(() => { const E = window.imageEditorInstance.E; return { name: E.S.bgiName, dirty: E.docs.list().find((d) => d.live).dirty, undo: E.S.undo.length }; });
    check("...a fresh history, not dirty, it knows its .bgi (Save Project saves it there again)", st2.undo === 0 && st2.dirty === false && st2.name === tag + "_bgi.bgi", st2);
    // the menu: File ▸ Open Project (.bgi)… / from Project… / Save Project (.bgi) / Save Project As…; Open… takes a .bgi
    const menu = await ev(() => { const E = window.imageEditorInstance.E, F = E.ui.MENUS.find(([n]) => n === "File")[1]; return { ids: F.filter((x) => typeof x === "string"), accept: document.getElementById("ieFile").accept, key: E.ui.CMD.get("file.savebgi").key }; });
    check("File ▸ Open Project (.bgi)… / Open Project from Project… / Save Project (.bgi) (Alt+Ctrl+S) / Save Project As (.bgi)…; Open… (Ctrl+O) takes a .bgi",
      ["file.openbgi", "file.openbgiproj", "file.savebgi", "file.savebgias"].every((x) => menu.ids.includes(x)) && menu.ids.indexOf("file.openbgi") === menu.ids.indexOf("file.open") + 1 && /\.bgi/.test(menu.accept) && /Alt/.test(menu.key) && /S$/.test(menu.key), menu);
    // a change, then Save Project again (no dialog: the name it has)
    await ev(() => { const E = window.imageEditorInstance.E; E.setLayer(E.S.layers[1], "rename", (x) => { x.name = "Red box 2"; }); });
    const dirtyNow = await ev(() => window.imageEditorInstance.E.docs.list().find((d) => d.live).dirty);
    await ev(() => window.imageEditorInstance.E.ui.run("file.savebgi")); await p.waitForTimeout(1200);
    const again = await ev(async (n) => { const E = window.imageEditorInstance.E; const r = await fetch("/api/bgfile/bgi/file/" + encodeURIComponent(n)); const m = await window.BgZip.unzipAsync(new Uint8Array(await r.arrayBuffer()));
      return { has: window.BgZip.text(m.get("doc.xml")).includes("Red box 2"), dirty: E.docs.list().find((d) => d.live).dirty, dlg: !!document.querySelector(".kxdlg #bgiN") }; }, tag + "_bgi.bgi");
    check("...a change makes it dirty; Save Project (Alt+Ctrl+S) writes the same .bgi again with no dialog, clean again", dirtyNow === true && again.has && again.dirty === false && !again.dlg, { dirtyNow, again });
    await ev(() => window.imageEditorInstance.E.ui.run("file.savebgias")); await p.waitForTimeout(250);
    const dlg = await ev(() => ({ n: (document.getElementById("bgiN") || {}).value, dl: !!document.getElementById("bgiDl") }));
    check("Save Project As… asks: the name (.bgi) + also download it", dlg.n === tag + "_bgi" && dlg.dl, dlg);
    await ev(() => { const c = document.querySelector(".kxdlg.pcd .cancel") || [...document.querySelectorAll(".kxdlg.pcd button")].find((x) => /Cancel/.test(x.textContent)); if (c) c.click(); });
    // a broken file is refused, nothing opens
    const broken = await ev(async () => { const E = window.imageEditorInstance.E, n = E.docs.list().length; const r = await E.bgi.openFile(new File([new Uint8Array([80, 75, 3, 4, 1, 2, 3])], "bad.bgi")); return { r, same: E.docs.list().length === n }; });
    check("...a damaged .bgi: refused (said), no document opened", broken.r === null && broken.same, broken);
    await p.click("#kxFull").catch(() => {}); await p.waitForTimeout(300);

    /* 4 the timeline's 🎞 .bgv */
    await ev(() => { const d = document.getElementById("timelinedock"); if (d.classList.contains("dockgone") && typeof toggleDockGone === "function") toggleDockGone("timelinedock", "tTL"); if (/collapsed/.test(d.className)) toggleCollapse("timelinedock"); });
    await p.waitForTimeout(400);
    const bar = await ev(() => [...document.querySelectorAll("#tlbar > button")].map((x) => x.id));
    check("🎞 on the timeline's toolbar (left of 🎤; ⚙ still the last)", bar.includes("tlBgvBtn") && bar.indexOf("tlBgvBtn") < bar.indexOf("tlKaraokeGen") && bar[bar.length - 1] === "tlSettings", bar.slice(-6));
    const vid = (await api("/api/assets?kind=video").catch(() => ({}))) || {};
    await ev((tg) => { tl.vlayers.push(mkLayer("BGV " + tg, [{ name: "zz_not_here_" + tg + ".mp4", dur: 2, in: 0, out: 2, opacity: 1, start: 1, src: "video" }])); tlSave(); renderTimeline(); }, tag);
    const want = await ev(() => JSON.stringify(tl.vlayers[tl.vlayers.length - 1]));
    await p.click("#tlBgvBtn"); await p.waitForSelector("#tlBgvDlg[open]", { timeout: 5000 });
    await p.fill("#bgvName", tag + "_cut"); await p.click("#bgvSave");
    await p.waitForFunction(() => /✓|⚠/.test(document.getElementById("bgvSaveMsg").textContent), null, { timeout: 15000 });
    const sm = await ev(() => document.getElementById("bgvSaveMsg").textContent);
    madeFiles.push(path.join(ROOT, "projects", proj, "bgv", tag + "_cut.bgv"));
    const onDisk = fs.existsSync(path.join(ROOT, "projects", proj, "bgv", tag + "_cut.bgv")) ? fs.readFileSync(path.join(ROOT, "projects", proj, "bgv", tag + "_cut.bgv"), "utf8") : "";
    check("💾 Save: <name>.bgv (XML: <bitgen-video> the timeline + the media list) in the project's bgv folder; a file the project lacks is named",
      new RegExp("✓ " + tag + "_cut\\.bgv").test(sm) && sm.includes("zz_not_here_" + tag) && /^<\?xml[^]*<bitgen-video version="1"/.test(onDisk) && onDisk.includes(`<s k="name">BGV ${tag}</s>`) && /<media>/.test(onDisk), sm);
    await p.waitForTimeout(300);
    await p.selectOption("#bgvList", tag + "_cut.bgv"); await p.click("#bgvLook");
    await p.waitForSelector("#bgvOpenIt", { timeout: 10000 });
    const look = await ev(() => document.getElementById("bgvInfo").textContent);
    check("📂 Look: what is in it - clips, layers, the media this project lacks; the name it opens as", /clip\(s\)/.test(look) && look.includes("zz_not_here_" + tag), look);
    await p.fill("#bgvAs", tag + "_tl"); await p.click("#bgvOpenIt");
    await p.waitForFunction((n) => typeof tlName !== "undefined" && tlName === n, tag + "_tl", { timeout: 10000 });
    const got = await ev(() => ({ name: tlName, last: JSON.stringify(tl.vlayers[tl.vlayers.length - 1]), open: document.getElementById("tlBgvDlg").open }));
    check("...Open it: a named timeline of this project, switched to, exactly as saved; the dialog closes", got.name === tag + "_tl" && got.last === want && !got.open, got);

    /* 5 the menu bar's 📦 .bgp */
    const btns = await ev(() => [...document.querySelectorAll("#menubar .projbtns > button")].map((x) => x.id + "=" + x.textContent.trim()));
    check("📦 in the menu bar, right after 💾", btns.join(" ").includes("projSave=💾 projBgp=📦"), btns);
    await p.click("#projBgp"); await p.waitForSelector("#bgpDlg[open]", { timeout: 5000 });
    await p.waitForFunction(() => /≈/.test(document.getElementById("bgpEmbSz").textContent), null, { timeout: 10000 });
    const d5 = await ev(() => ({ emb: document.getElementById("bgpEmbSz").textContent, man: document.getElementById("bgpManSz").textContent, est: document.getElementById("bgpEst").textContent, embOn: document.getElementById("bgpModeEmb").checked }));
    check("the dialog: Self-contained (default) / Manifest only with what each will weigh, the caches box, the project's files", d5.embOn && /≈ [\d.]+ (KB|MB|GB)/.test(d5.emb) && /≈/.test(d5.man) && /file\(s\) in "/.test(d5.est), d5);
    await ev(() => document.getElementById("bgpClose").click());
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bgpui_"));
    const outM = path.join(tmp, "m.bgp"), outE = path.join(tmp, "e.bgp");
    const sv = await ev(([a, c]) => Promise.all([window.H3Bgp.save("manifest", a, false), window.H3Bgp.save("embedded", c, false)]), [outM, outE]);
    check("H3Bgp.save: the project (state saved first) as a manifest .bgp (small) and a self-contained one (the media inside)", sv[0].mode === "manifest" && sv[0].external > 0 && sv[1].embedded > 0 && sv[1].size > sv[0].size && fs.existsSync(outM) && fs.existsSync(outE)
      && /<bitgen-project version="1"[^>]* name="[^"]*" dir="[^"]*" mode="manifest"/.test(fs.readFileSync(outM, "utf8").slice(0, 600)), sv.map((x) => [x.mode, x.size, x.files]));
    const imp = await ev(([f, n]) => window.H3Bgp.importPath(f, n), [outE, tag + "_imp"]);
    madeProjects.push(imp.name);
    const prjOk = fs.existsSync(path.join(ROOT, "projects", imp.name, imp.name + ".prj"));
    check("...opened as a NEW project (never over one): every file written, the .prj named after its folder", imp.name === tag + "_imp" && imp.written === sv[1].files && imp.missing.length === 0 && prjOk, imp);
    const twice = await ev(([f, n]) => window.H3Bgp.importPath(f, n).then(() => "no", (e) => e.message), [outE, tag + "_imp"]);
    check("...the same name again = refused (an existing project is never written over)", /already exists/.test(twice), twice);
    const up = await (await fetch(URL_ + "api/bgp/upload?as=" + encodeURIComponent(tag + "_up"), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: fs.readFileSync(outM) })).json();
    madeProjects.push(up.name);
    check("...an uploaded .bgp (a page not on this computer) imports the same way (a manifest: the media copied from where they are)", up.name === tag + "_up" && up.written === sv[0].files && up.missing.length === 0, up);
    fs.rmSync(tmp, { recursive: true, force: true });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.stack); }
  finally {
    for (const n of madeProjects) if (n && n.startsWith("zz")) fs.rmSync(path.join(ROOT, "projects", n), { recursive: true, force: true });
    for (const f of madeFiles) fs.rmSync(f, { force: true });
    try {
      await fetch(URL_ + "api/timelines/" + encodeURIComponent(tag + "_tl"), { method: "DELETE" });
      if (tlBefore) await p.evaluate((n) => (typeof tlSwitch === "function" ? tlSwitch(n) : null), tlBefore).catch(() => {});
      await p.evaluate((tg) => { if (typeof tl !== "undefined") { tl.vlayers = tl.vlayers.filter((L) => L.name !== "BGV " + tg); tlSave(); } }, tag).catch(() => {});
    } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
