#!/usr/bin/env node
/* bitGen Studio — 2.469.0 in a REAL browser: LINKED SMART OBJECTS (pclinked.js + /api/linked) - Place Linked, the file
 * changed -> Update Modified Content, Edit Contents writes back, Convert to Linked, Embed, Relink, a missing file; PSD
 * smart objects saved as placed layers + embedded contents and opened again as smart objects (pcpsd.js).
 * Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor".
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the linked smart object browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.linked, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await p.click("#kxFull"); await p.waitForTimeout(900);
    await ev(() => { const E = window.imageEditorInstance.E; E.setBg("#ffffff"); E.setFg("#ff0000"); });
    await p.click('#pcMenus .mi[data-menu="File"]'); await p.waitForTimeout(120); await p.click('.kxmenu [data-cmd="file.new"]'); await p.waitForTimeout(200);
    await p.fill(".kxdlg.pcd #pdW", "600"); await p.fill(".kxdlg.pcd #pdH", "400"); await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(400);
    const T = async (x, y) => { const v = await ev(() => { const s = window.imageEditorInstance.state; return { z: s.zoom, x: s.panX, y: s.panY }; }); const r = await p.locator("#ieStage").boundingBox(); return [r.x + v.x + x * v.z, r.y + v.y + y * v.z]; };
    const drag = async (x0, y0, x1, y1, mods, steps) => { await p.waitForTimeout(120); const [a, c] = await T(x0, y0), [d, e] = await T(x1, y1); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.move(a, c); await p.mouse.down(); await p.mouse.move(d, e, { steps: steps || 8 }); await p.mouse.up(); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(100); };
    const click = async (x, y, mods) => { await p.waitForTimeout(120); const [a, c] = await T(x, y); for (const m of mods || []) await p.keyboard.down(m); await p.mouse.click(a, c); for (const m of mods || []) await p.keyboard.up(m); await p.waitForTimeout(80); };
    const key = async (k) => { await p.locator("#ieStage").focus(); await p.keyboard.press(k); await p.waitForTimeout(120); };
    const st = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return { n: s.layers.length, tool: s.tool, undo: s.undo.length, type: L && L.type, name: L && L.name,
      smart: L && L.smart ? JSON.parse(JSON.stringify(L.smart)) : null, fmask: !!(L && L.fmask), names: s.layers.map((x) => x.type + ":" + x.name) }; });
    const lpx = (x, y) => ev(([x, y]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(x, y, 1, 1).data); }, [x, y]);
    const count = (x0, y0, x1, y1, f) => ev(([a, b2, c, d, fs]) => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; const D = L.canvas.getContext("2d").getImageData(a, b2, c - a, d - b2).data; const fn = new Function("r", "g", "b", "a", "return " + fs); let n = 0; for (let i = 0; i < D.length; i += 4) if (fn(D[i], D[i + 1], D[i + 2], D[i + 3])) n++; return n; }, [x0, y0, x1, y1, f]);
    const layerData = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return Array.from(L.canvas.getContext("2d").getImageData(0, 0, s.w, s.h).data); });
    const TAG = "zzlk" + process.pid;
    const pngFile = (color, w, h, name) => `(async () => { const c = document.createElement("canvas"); c.width = ${w}; c.height = ${h}; const g = c.getContext("2d"); g.fillStyle = "${color}"; g.fillRect(0, 0, ${w}, ${h}); const b = await new Promise((ok) => c.toBlob(ok, "image/png")); return new File([b], "${name}", { type: "image/png" }); })()`;
    const smartInfo = () => ev(() => { const s = window.imageEditorInstance.state, L = s.layers[s.active]; return L ? { type: L.type, name: L.name, link: L.smart && L.smart.link ? L.smart.link.name : null, quad: L.smart && L.smart.t.quad, n: s.layers.length, undo: s.undo.length, label: s.undo.length ? s.undo[s.undo.length - 1].label : "" } : null; });
    await ev(() => { const E = window.imageEditorInstance.E; E.openDoc(600, 400, "lk.png", (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 600, 400); }); });
    await p.waitForTimeout(300);

    /* 1 File ▸ Place Linked… a red 200 x 100 picture */
    await ev(async (js) => { const f = await (0, eval)(js); window.imageEditorInstance.E.linked.placeLinked(f); }, pngFile("#ff0000", 200, 100, TAG + ".png"));
    let si = null; for (let i = 0; i < 100 && !(si && si.link); i++) { await p.waitForTimeout(150); si = await smartInfo(); }
    const red = await lpx(300, 200), badge = await ev(() => { const b = document.querySelector(".kxlayer .lkb"); return b ? b.textContent : ""; });
    check("Place Linked: a smart object linked to <name>.png in the project's linked folder, centred (red in the middle), 🔗 in the Layers panel", si && si.type === "smart" && si.link === TAG + ".png" && red[0] === 255 && red[2] === 0 && badge === "🔗" && JSON.stringify(si.quad) === "[[200,150],[400,150],[400,250],[200,250]]", { si, red, badge });

    /* 2 the file changes (another program saves it): the layer follows - its place kept */
    await ev(async ([js, name]) => { const f = await (0, eval)(js); await fetch("/api/linked/save?name=" + encodeURIComponent(name), { method: "POST", body: f }); }, [pngFile("#0000ff", 200, 100, TAG + ".png"), TAG + ".png"]);
    await p.waitForTimeout(1100);
    const up = await ev(async () => await window.imageEditorInstance.E.linked.update(true));
    const blue = await lpx(300, 200); si = await smartInfo();
    check("Update Modified Content (also on focus / every 20 s): the new file's contents (blue), the same place, one undo step", up.changed.length === 1 && blue[2] === 255 && blue[0] === 0 && JSON.stringify(si.quad) === "[[200,150],[400,150],[400,250],[200,250]]" && si.label === "update modified content", { up, blue, si });

    /* 3 Edit Contents on the linked one: Done writes the new contents back to its file */
    await ev(() => { const E = window.imageEditorInstance.E; E.smart.editContents(); });
    await p.waitForTimeout(400);
    await ev(() => { const E = window.imageEditorInstance.E; E.pxOp("green", (c, g) => { g.fillStyle = "#00c000"; g.fillRect(0, 0, c.width, c.height); }); E.smart.finish(true); });
    let back = null; for (let i = 0; i < 30; i++) { await p.waitForTimeout(200); back = await ev(async (name) => { const b = await (await fetch("/api/linked/file/" + encodeURIComponent(name) + "?x=" + Date.now())).blob(), bm = await createImageBitmap(b), c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; const g = c.getContext("2d"); g.drawImage(bm, 0, 0); return Array.from(g.getImageData(10, 10, 1, 1).data); }, TAG + ".png"); if (back[1] > 150) break; }
    check("Edit Contents + Done on a linked smart object: the file itself gets the new contents (green)", back && back[1] > 150 && back[0] < 30, back);

    /* 4 Convert to Linked (an embedded one), Embed Linked, Relink to File */
    await ev(() => { const E = window.imageEditorInstance.E; E.newLayer(); E.pxOp("box", (c, g) => { g.fillStyle = "#ffcc00"; g.fillRect(20, 20, 80, 60); }); E.smart.convert(); });
    await p.waitForTimeout(200);
    const j = await ev(async (n) => await window.imageEditorInstance.E.linked.toLinked(n), TAG + "-b.png");
    si = await smartInfo();
    check("Convert to Linked…: the embedded contents saved as a file, the layer linked to it", j && j.name === TAG + "-b.png" && si.link === TAG + "-b.png", { j, si });
    await ev(() => window.imageEditorInstance.E.linked.embed()); si = await smartInfo();
    const e1 = si.link;
    await ev(async (n) => await window.imageEditorInstance.E.linked.relink(n), TAG + ".png"); await p.waitForTimeout(300); si = await smartInfo();
    const relinked = await lpx(60, 50);
    check("Embed Linked drops the link; Relink to File points it at another picture of the folder (green now)", e1 === null && si.link === TAG + ".png" && relinked[1] > 150, { e1, si, relinked });

    /* 5 a missing file: ⚠ */
    await ev(() => { const E = window.imageEditorInstance.E, L = E.layer(); E.structOp("test", () => { L.smart.link = { name: "zz-not-there.png", mtime: 1 }; }); });
    const miss = await ev(async () => await window.imageEditorInstance.E.linked.update(true));
    await ev(() => window.imageEditorInstance.E.renderLayersPanel());
    const warn = await ev(() => [...document.querySelectorAll(".kxlayer .lkb")].map((b) => b.textContent).join(","));
    check("a linked file that is gone: reported missing, ⚠🔗 in the Layers panel", miss.missing.includes("zz-not-there.png") && /⚠🔗/.test(warn), { miss, warn });
    await ev(() => window.imageEditorInstance.E.undo());

    /* 6 PSD: smart objects saved as placed layers (contents embedded) and opened again as smart objects */
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, L = S.layers.find((x) => x.type === "smart" && x.smart.link); S.active = S.layers.indexOf(L); E.structOp("scale", () => { L.smart.t.quad = [[100, 100], [300, 100], [300, 200], [100, 200]]; window.PCSmart.render(L); }); });
    const rt = await ev(async () => {
      const E = window.imageEditorInstance.E, r = await E.psdToBuffer();
      await E.psdOpenBuffer(r.buf, "rt.psd");
      const S = E.S, sm = S.layers.filter((x) => x.type === "smart");
      const L = sm.find((x) => x.smart.t.quad[0][0] === 100), px = L ? Array.from(L.canvas.getContext("2d").getImageData(200, 150, 1, 1).data) : null;
      return { notes: r.notes, smart: sm.length, quad: L && L.smart.t.quad, src: L && [L.smart.w, L.smart.h], px };
    });
    check("PSD: smart objects go out as placed layers with their contents embedded, and open again as smart objects (the transform + contents kept)", rt.notes.smartKept >= 1 && !rt.notes.smartPixels && rt.smart >= 2 && JSON.stringify(rt.quad) === "[[100,100],[300,100],[300,200],[100,200]]" && rt.src && rt.src[0] === 200 && rt.px && rt.px[1] > 150, rt);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test crashed - " + e.stack); }
  finally {
    await b.close();
    try { for (const d of fs.readdirSync(path.join(ROOT, "projects"))) { const ld = path.join(ROOT, "projects", d, "linked"); if (!fs.existsSync(ld)) continue; for (const f of fs.readdirSync(ld)) if (/^zzlk/.test(f)) fs.rmSync(path.join(ld, f), { force: true }); try { fs.rmdirSync(ld); } catch { /* not empty */ } } } catch { /* fine */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
