#!/usr/bin/env node
/* bitGen Studio — 2.484.0 in a REAL browser: BRUSH SETTINGS, PRESETS, .ABR BRUSHES (ext/imageeditdock/brushdyn.js) -
 * the image editor's gap, round E. Tim (verbatim): "close the photoshop gap."
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the brush settings browser test did not run"); process.exit(0); }
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
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.smart && window.imageEditorInstance.E.brushDyn, null, { timeout: 60000 });
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
    // a white picture
    await ev(() => { const E = window.imageEditorInstance.E, S = E.S, L = S.layers[S.active], g = L.canvas.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, 600, 400); L.ver = (L.ver || 0) + 1; E.renderLayers(); E.refresh(); E.setFg("#000000"); });
    const clear = () => ev(() => { const E = window.imageEditorInstance.E, S = E.S, L = S.layers[S.active], g = L.canvas.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, 600, 400); L.ver++; E.renderLayers(); E.refresh(); });
    const painted = (x0, y0, x1, y1) => ev(([a, b2, c, d]) => { const S = window.imageEditorInstance.state, L = S.layers[0]; const D = L.canvas.getContext("2d").getImageData(a, b2, c - a, d - b2).data; let n = 0, cols = new Set(); for (let i = 0; i < D.length; i += 4) if (D[i] + D[i + 1] + D[i + 2] < 700) { n++; cols.add((D[i] >> 5) + "," + (D[i + 1] >> 5) + "," + (D[i + 2] >> 5)); } return { n, cols: cols.size }; }, [x0, y0, x1, y1]);
    const setK = (k, v) => ev(([k, v]) => { const el = document.querySelector(`#pcBrush [data-k="${k}"]`); if (!el) return false; if (el.type === "checkbox") { el.checked = !!v; } else el.value = v; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); return true; }, [k, v]);
    await ev(() => { const E = window.imageEditorInstance.E; E.setTool("paint"); E.choosePreset("basic"); E.setSize(20); E.ui.showTab("pcBrush"); });
    await p.waitForTimeout(500);
    const tab = await ev(() => ({ on: document.getElementById("pcBrush").classList.contains("on"), n: document.querySelectorAll("#pcBrush [data-pid]").length, secs: Array.from(document.querySelectorAll("#pcBrush .bs label.h")).map((l) => l.textContent.trim()) }));
    check("the 🖌 Brush tab: the presets (20+) and the sections - Brush Tip Shape, Shape Dynamics, Scattering, Texture, Dual Brush, Color Dynamics, Transfer", tab.on && tab.n >= 20 && ["Brush Tip Shape", "Shape Dynamics", "Scattering", "Texture", "Dual Brush", "Color Dynamics", "Transfer"].every((x) => tab.secs.includes(x)), tab);
    // roundness: a flat dab
    await setK("dyn.tip.roundness", 25); await p.waitForTimeout(200);
    await click(300, 200); await p.waitForTimeout(300);
    const flatW = await painted(280, 195, 320, 205), flatH = await painted(295, 180, 305, 220);
    check("Brush Tip: roundness 25 % paints a flat dab (wider than tall)", flatW.n > flatH.n * 1.5, { flatW, flatH });
    await setK("dyn.tip.roundness", 100); await clear();
    // scattering: tips off the line
    await setK("dyn.scatter.on", true); await p.waitForTimeout(300); await setK("dyn.scatter.amount", 400); await setK("dyn.scatter.count", 4);
    await drag(100, 200, 500, 200, [], 20); await p.waitForTimeout(300);
    const far = await painted(100, 120, 500, 175);
    check("Scattering 400 %: tips land well away from the line", far.n > 30, far);
    await setK("dyn.scatter.on", false); await clear();
    // colour dynamics: many colours
    await setK("dyn.color.on", true); await p.waitForTimeout(300); await setK("dyn.color.hue", 100); await setK("dyn.color.purity", 100); await ev(() => window.imageEditorInstance.E.setFg("#ff0000"));
    await drag(100, 200, 500, 220, [], 20); await p.waitForTimeout(300);
    const many = await painted(90, 180, 510, 240);
    check("Color Dynamics (hue jitter): one stroke, many colours", many.cols >= 4, many);
    await setK("dyn.color.on", false); await clear();
    // the settings are kept per preset; reset
    const kept = await ev(() => JSON.parse(localStorage.getItem("kx.brush.set.basic") || "null"));
    await p.click("#bdReset"); await p.waitForTimeout(200);
    const reset = await ev(() => { const p = window.IEBrushes.byId("basic"); return { r: p.dyn ? p.dyn.tip.roundness : 100, scat: p.dyn ? p.dyn.scatter.on : false }; });
    check("each built-in preset keeps its settings (in this editor's settings); ↺ Reset puts it back", kept && kept.dyn && kept.dyn.color && reset.r === 100 && !reset.scat, { kept: !!kept, reset });
    // a new preset, kept in brushes/
    await ev(() => { window.prompt = () => "Test brush e2e"; });
    await setK("dyn.tip.angle", 30);
    await p.click("#bdNew"); await p.waitForTimeout(800);
    const list = await ev(async () => (await (await fetch("/api/brushes")).json()).brushes.map((b) => b.preset.id));
    check("💾 New Brush Preset… keeps it as brushes/<name>.json and picks it", list.includes("user:Test brush e2e") && await ev(() => window.imageEditorInstance.state.preset === "user:Test brush e2e"), list);
    // .abr import
    const abr = (() => { const w = 20, h = 20, px = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.push(x === y || x === w - 1 - y ? 255 : 0);
      const body = []; const p32 = (v) => body.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255), p16 = (v) => body.push((v >>> 8) & 255, v & 255); const name = "Cross";
      p32(0); p16(25); p32(name.length); for (const c of name) p16(c.charCodeAt(0)); body.push(1); p16(0); p16(0); p16(h); p16(w); p32(0); p32(0); p32(h); p32(w); p16(8); body.push(0); body.push(...px);
      const out = [0, 2, 0, 1, 0, 2]; out.push((body.length >>> 24) & 255, (body.length >>> 16) & 255, (body.length >>> 8) & 255, body.length & 255); return Buffer.from(out.concat(body)); })();
    // the app answers a file input with its own file dialog - here the file is handed straight to the input
    await ev((bytes) => { const o = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type === "file" && /\.abr/.test(this.accept)) { HTMLInputElement.prototype.click = o; const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array(bytes)], "e2ecross.abr")); this.files = dt.files; this.dispatchEvent(new Event("change")); return; } return o.apply(this, arguments); }; }, Array.from(abr));
    await p.click("#bdAbr"); await p.waitForTimeout(1500);
    const got = await ev(() => { const q = window.IEBrushes.byId("user:e2ecross"); return q && q.id === "user:e2ecross" ? { tip: q.tip, w: q.sample.w } : null; });
    await ev(() => { const E = window.imageEditorInstance.E; E.choosePreset("user:e2ecross"); E.setSize(60); E.setFg("#000000"); });
    await clear(); await click(300, 200); await p.waitForTimeout(300);
    const cross = await ev(() => { const L = window.imageEditorInstance.state.layers[0], g = L.canvas.getContext("2d"); const c = g.getImageData(300, 200, 1, 1).data[0], off = g.getImageData(300 + 12, 200, 1, 1).data[0], diag = g.getImageData(300 + 12, 200 + 12, 1, 1).data[0]; return { c, off, diag }; });
    check("⤒ Import .abr…: its sampled brush becomes a preset that paints its shape (an X: the centre and the diagonal dark, beside it white)", got && got.tip === "sampled" && got.w === 20 && cross.c < 128 && cross.diag < 160 && cross.off > 200, { got, cross });
    await ev(async () => { for (const n of ["Test brush e2e", "e2ecross"]) await fetch("/api/brushes/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n }) }); localStorage.removeItem("kx.brush.set.basic"); });
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + e.stack); }
  try { await global.__b.close(); } catch (e) { /* closed */ }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
