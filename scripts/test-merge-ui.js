#!/usr/bin/env node
/* bitGen Studio — 2.486.0 in a REAL browser: AUTO-ALIGN LAYERS, AUTO-BLEND LAYERS, PHOTOMERGE, MERGE TO HDR
 * (ext/imageeditdock/pcmerge.js) - the image editor's gap, round F (part 2).
 * Tim (verbatim): "close the photoshop gap."
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the align / blend / photomerge / HDR browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};

(async () => {
  const b = await chromium.launch(); global.__b = b;
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.smart && window.imageEditorInstance.E.merge && window.imageEditorInstance.E.warp, null, { timeout: 60000 });
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
    // a made-up busy scene (the same as scripts/test-merge.js), drawn in the page
    await ev((code) => { window.__scene = new Function(code + "; return scene;")(); window.__sceneC = () => { const sc = window.__scene(900, 500, 11), c = document.createElement("canvas"); c.width = 900; c.height = 500; const id = c.getContext("2d").createImageData(900, 500); id.data.set(sc.data); c.getContext("2d").putImageData(id, 0, 0); return c; }; }, "function scene(W, H, seed) {\n  let s = seed || 7; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };\n  const d = new Uint8ClampedArray(W * H * 4);\n  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; d[i] = 60 + 100 * x / W; d[i + 1] = 80 + 80 * y / H; d[i + 2] = 120; d[i + 3] = 255; }\n  for (let k = 0; k < 260; k++) {\n    const cx = rnd() * W, cy = rnd() * H, r = 6 + rnd() * 28, col = [rnd() * 255, rnd() * 255, rnd() * 255], disc = rnd() < 0.35;\n    for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(H, cy + r); y++) for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(W, cx + r); x++) {\n      if (disc && (x - cx) ** 2 + (y - cy) ** 2 > r * r) continue; const i = (y * W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2];\n    }\n  }\n  // a little grain, like a photo\n  for (let i = 0; i < d.length; i++) { if ((i & 3) === 3) continue; d[i] += (rnd() - 0.5) * 24; }\n  return { width: W, height: H, data: d };\n}\n");
    /** a layer: the scene from (x0, y0), moved by dx / dy; sharp: "all", "left" or "right" (the rest blurred) */
    const put = (name, x0, y0, dx, dy, sharp) => ev(([name, x0, y0, dx, dy, sharp]) => {
      const E = window.imageEditorInstance.E, S = E.S, c = window.__sceneC(), L = E.makeLayer(name, S.w, S.h), g = L.canvas.getContext("2d");
      if (sharp === "all") g.drawImage(c, -x0 + dx, -y0 + dy);
      else { g.filter = "blur(3px)"; g.drawImage(c, -x0, -y0); g.filter = "none"; const sx = sharp === "left" ? 0 : 300; g.drawImage(c, x0 + sx, y0, 300, 400, sx, 0, 300, 400); }
      S.layers.push(L); S.active = S.layers.length - 1; E.refresh(); E.renderLayersPanel(); return S.layers.length; }, [name, x0, y0, dx, dy, sharp]);
    await ev(() => { const S = window.imageEditorInstance.E.S; S.layers[0].visible = false; });
    await put("base", 100, 50, 0, 0, "all"); await put("moved", 100, 50, 25, 12, "all");
    const menu = await ev(() => { const C = window.imageEditorInstance.E.ui.CMD; return ["edit.autoalign", "edit.autoblend", "auto.photomerge", "auto.hdr"].map((k) => !!C.get(k)); });
    check("Edit ▸ Auto-Align Layers / Auto-Blend Layers, File ▸ Automate ▸ Photomerge / Merge to HDR", menu.every(Boolean), menu);
    const diff = () => ev(() => { const S = window.imageEditorInstance.E.S, a = S.layers[1].canvas.getContext("2d").getImageData(100, 80, 400, 250).data, b = S.layers[2].canvas.getContext("2d").getImageData(100, 80, 400, 250).data; let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]); return s / (a.length / 4); });
    const before = await diff();
    await ev(() => window.imageEditorInstance.E.ui.run("edit.autoalign")); await p.waitForTimeout(300);
    await p.selectOption(".kxdlg .mgModel", "reposition"); await p.selectOption(".kxdlg .mgRef", "bottom");
    await p.click(".kxdlg .ok"); await p.waitForTimeout(2500);
    const after = await diff(), al = await ev(() => window.imageEditorInstance.E.lastAlign);
    check("Auto-Align Layers (reposition): the moved layer is put back on the base (the 25 / 12 px found)", before > 30 && after < 6 && al && Math.abs(al.mats[1][2] + 25) < 1 && Math.abs(al.mats[1][5] + 12) < 1, { before, after, m: al && al.mats });
    await ev(() => window.imageEditorInstance.E.ui.run("edit.undo")); await p.waitForTimeout(400);
    check("Auto-Align is one undo step", (await diff()) > 30);
    // Auto-Blend, Stack Images: the left half sharp in one layer, the right half in the other
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S; S.layers.splice(1); S.active = 0; E.refresh(); E.renderLayersPanel(); });
    await put("left sharp", 100, 50, 0, 0, "left"); await put("right sharp", 100, 50, 0, 0, "right");
    await ev(() => window.imageEditorInstance.E.ui.run("edit.autoblend")); await p.waitForTimeout(300);
    await p.selectOption(".kxdlg .mgMode", "stack"); await p.click(".kxdlg .ok"); await p.waitForTimeout(2500);
    const bl = await ev(() => { const S = window.imageEditorInstance.E.S, m = (k, x, y) => (S.layers[k].mask ? S.layers[k].mask.canvas.getContext("2d").getImageData(x, y, 1, 1).data[0] : -1); return { l1: [m(1, 120, 200), m(1, 480, 200)], l2: [m(2, 120, 200), m(2, 480, 200)] }; });
    check("Auto-Blend Layers (stack): a mask on each layer - the left from the layer sharp there, the right from the other", bl.l1[0] === 255 && bl.l2[0] === 0 && bl.l2[1] === 255, bl);
    // pictures handed to the next file chooser: [x, y, w, h, exposure, shift]
    const giveFiles = (specs) => ev((specs) => {
      const c = window.__sceneC();
      return Promise.all(specs.map(([x, y, w, h, k, dx]) => new Promise((ok) => { const o = document.createElement("canvas"); o.width = w; o.height = h; const g = o.getContext("2d"); g.drawImage(c, -x + (dx || 0), -y); if (k !== 1) { const d = g.getImageData(0, 0, w, h); for (let i = 0; i < d.data.length; i += 4) for (let q = 0; q < 3; q++) d.data[i + q] = Math.min(255, d.data[i + q] * k); g.putImageData(d, 0, 0); } o.toBlob((b) => ok(new File([b], `part${x}-${k}.png`, { type: "image/png" })), "image/png"); }))).then((files) => {
        const o = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type === "file" && this.multiple) { HTMLInputElement.prototype.click = o; const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f)); this.files = dt.files; setTimeout(() => this.dispatchEvent(new Event("change")), 0); return; } return o.apply(this, arguments); };
        return files.length;
      });
    }, specs);
    // Photomerge: three overlapping parts of the scene
    await giveFiles([[0, 20, 400, 460, 1], [250, 0, 400, 480, 1], [500, 30, 400, 450, 1]]);
    await ev(() => window.imageEditorInstance.E.ui.run("auto.photomerge")); await p.waitForTimeout(300);
    await p.click(".kxdlg .ok");
    await p.waitForFunction(() => /Panorama/.test(window.imageEditorInstance.E.S.name), null, { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(500);
    const pm = await ev(() => { const S = window.imageEditorInstance.E.S; return { name: S.name, w: S.w, h: S.h, layers: S.layers.map((l) => l.name + (l.mask ? "+mask" : "")), last: window.imageEditorInstance.E.lastMerge }; });
    check("Photomerge: a new 900 x 480 'Panorama' with one masked layer per picture, all placed", pm.name === "Panorama" && Math.abs(pm.w - 900) <= 3 && Math.abs(pm.h - 480) <= 3 && pm.layers.length === 3 && pm.layers.every((n) => /^part\d+-1\+mask$/.test(n)) && pm.last && pm.last.unplaced === 0, pm);
    const pmPx = await ev(() => { const f = window.imageEditorInstance.E.flatten().getContext("2d"), sc = window.__scene(900, 500, 11); let bad = 0, n = 0; for (let y = 40; y < 440; y += 20) for (let x = 30; x < 870; x += 20) { const a = f.getImageData(x, y, 1, 1).data, j = (y * 900 + x) * 4; n++; if (Math.abs(a[0] - sc.data[j]) + Math.abs(a[1] - sc.data[j + 1]) + Math.abs(a[2] - sc.data[j + 2]) > 45 || a[3] < 250) bad++; } return { bad, n }; });
    check("Photomerge: the stitched picture is the scene (≥ 95 % of sample points)", pmPx.bad / pmPx.n < 0.05, pmPx);
    // Merge to HDR: dark / normal / bright, the bright one 3 px off
    await giveFiles([[100, 50, 500, 360, 0.4], [100, 50, 500, 360, 1], [100, 50, 500, 360, 2.2, 3]]);
    await ev(() => window.imageEditorInstance.E.ui.run("auto.hdr")); await p.waitForTimeout(300);
    await p.click(".kxdlg .ok");
    await p.waitForFunction(() => /Merged HDR/.test(window.imageEditorInstance.E.S.name), null, { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(500);
    const hdr = await ev(() => { const S = window.imageEditorInstance.E.S, d = window.imageEditorInstance.E.flatten().getContext("2d").getImageData(0, 0, S.w, S.h).data; let clip = 0, dark = 0; for (let i = 0; i < d.length; i += 4) { if (Math.max(d[i], d[i + 1], d[i + 2]) >= 254) clip++; if (Math.max(d[i], d[i + 1], d[i + 2]) < 20) dark++; } return { name: S.name, w: S.w, h: S.h, clip: clip / (d.length / 4), dark: dark / (d.length / 4) }; });
    check("Merge to HDR: one 500 x 360 'Merged HDR' picture - hardly anything blown out or black", hdr.name === "Merged HDR" && hdr.w === 500 && hdr.h === 360 && hdr.clip < 0.05 && hdr.dark < 0.05, hdr);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: " + e.stack); }
  try { await global.__b.close(); } catch (e) { /* closed */ }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
