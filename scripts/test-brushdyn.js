#!/usr/bin/env node
/* bitGen Studio — 2.484.0: BRUSH SETTINGS, BRUSH PRESETS, .ABR BRUSHES (ext/imageeditdock/brushdyn.js, brushes.js,
 * lib/brushStore.js, routes/brushes.js) - the image editor's gap, round E. Tim (verbatim): "close the photoshop gap."
 * The dynamics maths (shape, scattering, transfer), colour dynamics, textures, reading .abr files (versions 2 + 6,
 * raw + RLE), sampled tips in the engine, the brushes/ store, the wiring. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const ROOT = path.join(__dirname, ".."), X = path.join(ROOT, "ext", "imageeditdock");
const B = require(path.join(X, "brushes.js")), D = require(path.join(X, "brushdyn.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const seq = (vals) => { let k = 0; return () => vals[k++ % vals.length]; };
check("defaults: nothing on, a preset without settings or with the defaults is drawn the old way", !D.active({}) && !D.active({ dyn: D.DYN_DEFAULT() }) && D.active({ dyn: Object.assign(D.DYN_DEFAULT(), { tip: { angle: 30, roundness: 100 } }) }) && D.active({ dyn: Object.assign(D.DYN_DEFAULT(), { scatter: { on: true, amount: 100, count: 2 } }) }));
const fade = Object.assign(D.DYN_DEFAULT(), { shape: Object.assign(D.DYN_DEFAULT().shape, { on: true, sizeControl: "fade", fadeSteps: 10, minDiameter: 0 }) });
const s1 = D.dynAt(fade, () => 0.5, 1, 0, 1).size, s9 = D.dynAt(fade, () => 0.5, 9, 0, 1).size;
const pr = Object.assign(D.DYN_DEFAULT(), { shape: Object.assign(D.DYN_DEFAULT().shape, { on: true, sizeControl: "pressure", minDiameter: 20 }) });
check("Shape Dynamics: Fade shrinks along the stroke; pen pressure scales the size down to the minimum diameter", s1 > 0.85 && s9 < 0.15 && Math.abs(D.dynAt(pr, () => 0, 1, 0, 0).size - 0.2) < 1e-9 && D.dynAt(pr, () => 0, 1, 0, 1).size === 1, [s1, s9]);
const jit = Object.assign(D.DYN_DEFAULT(), { shape: Object.assign(D.DYN_DEFAULT().shape, { on: true, sizeJitter: 100, minDiameter: 30, angleJitter: 100, angleControl: "direction", roundJitter: 100, minRound: 40 }) });
const j1 = D.dynAt(jit, () => 1, 1, Math.PI / 2, 1), j0 = D.dynAt(jit, () => 0, 1, Math.PI / 2, 1);
check("size jitter never below the minimum diameter; angle follows the stroke's direction (+ jitter); roundness jitter stops at its minimum", Math.abs(j1.size - 0.3) < 1e-9 && Math.abs(j0.angle - (Math.PI / 2 - Math.PI)) < 1e-9 && Math.abs(j1.round - 0.4) < 1e-9, [j1, j0.angle]);
const sc = Object.assign(D.DYN_DEFAULT(), { scatter: { on: true, amount: 200, both: false, count: 4, countJitter: 0 } });
const so = D.dynAt(sc, seq([1, 0, 0.5, 0.75]), 1, 0, 1);
check("Scattering: 4 tips, spread across the stroke (a horizontal stroke: up / down only) by up to 200 % of the size", so.count === 4 && so.offsets.every(([x, y]) => Math.abs(x) < 1e-9 && Math.abs(y) <= 2 + 1e-9) && so.offsets.some(([, y]) => Math.abs(y) > 1), so.offsets);
const tr = Object.assign(D.DYN_DEFAULT(), { transfer: { on: true, opacityJitter: 50, flowJitter: 0, control: "pressure" } });
check("Transfer: opacity from the pen pressure, minus its jitter", Math.abs(D.dynAt(tr, () => 1, 1, 0, 0.5).alpha - 0.25) < 1e-9);
check("Color Dynamics: nothing set = the foreground; F/B jitter 100 % (all the way) = the background; hue jitter turns red", D.jitterColor("#ff0000", "#0000ff", D.DYN_DEFAULT().color, () => 0.5) === "#ff0000" && D.jitterColor("#ff0000", "#0000ff", { fgbg: 100 }, () => 1) === "#0000ff"
  && D.jitterColor("#ff0000", "#000000", { hue: 100 }, seq([0, 1])) !== "#ff0000");
const tv = ["noise", "canvas", "paper"].map((k) => [0, 7, 13, 99].map((x) => D.textureValue(k, x, x * 1.7 + 0.5, 100)));
check("textures (noise, canvas, paper): values 0..1 that vary", tv.every((r) => r.every((v) => v >= 0 && v <= 1) && new Set(r.map((v) => v.toFixed(3))).size > 1), tv);
// .abr files
function abrV2() {
  const w = 3, h = 2, px = [0, 128, 255, 255, 128, 0], name = "Leaf";
  const body = []; const p32 = (v) => body.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255), p16 = (v) => body.push((v >>> 8) & 255, v & 255);
  p32(0); p16(25); p32(name.length); for (const c of name) p16(c.charCodeAt(0)); body.push(1); p16(0); p16(0); p16(h); p16(w); p32(0); p32(0); p32(h); p32(w); p16(8); body.push(0); body.push(...px);
  const out = [0, 2, 0, 1, 0, 2]; const len = body.length; out.push((len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255); return Uint8Array.from(out.concat(body));
}
function abrV6() {
  const w = 4, h = 2, rows = [[0, 0, 0, 0], [9, 9, 9, 7]];
  const enc = (r) => (r.every((v) => v === r[0]) ? [(256 - (r.length - 1)) & 255, r[0]] : [r.length - 1, ...r]);
  const e = rows.map(enc), brush = new Array(47).fill(0); const p32 = (a, v) => a.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255), p16 = (a, v) => a.push((v >>> 8) & 255, v & 255);
  p32(brush, 0); p32(brush, 0); p32(brush, h); p32(brush, w); p16(brush, 8); brush.push(1); for (const r of e) p16(brush, r.length); for (const r of e) brush.push(...r);
  const samp = []; p32(samp, brush.length); samp.push(...brush); while (samp.length % 4) samp.push(0);
  const out = [0, 6, 0, 1]; for (const c of "8BIMsamp") out.push(c.charCodeAt(0)); p32(out, samp.length); out.push(...samp); return Uint8Array.from(out);
}
const a2 = D.parseAbr(abrV2()), a6 = D.parseAbr(abrV6());
check(".abr version 2: one sampled brush - its name, size, spacing and its pixels", a2.length === 1 && a2[0].name === "Leaf" && a2[0].w === 3 && a2[0].h === 2 && a2[0].spacing === 25 && Array.from(a2[0].data).join() === "0,128,255,255,128,0", a2);
check(".abr version 6: the samp section, RLE rows", a6.length === 1 && a6[0].w === 4 && a6[0].h === 2 && Array.from(a6[0].data).join() === "0,0,0,0,9,9,9,7", a6.map((x) => [x.w, x.h, Array.from(x.data)]));
let threw = ""; try { D.parseAbr(Uint8Array.from([0, 3, 0, 0])); } catch (e) { threw = e.message; }
check("not a brush file: a reason", /not a brush file/.test(threw), threw);
// the engine
const tip = B.tipAlpha({ tip: "sampled", sample: { w: 2, h: 2, data: D.toB64(Uint8Array.from([255, 0, 0, 255])) } }, 4, 1);
check("a sampled tip (base64 picture) scales to the brush size", Array.from(tip.alpha).join() === "255,255,0,0,255,255,0,0,0,0,255,255,0,0,255,255");
const bsrc = fs.readFileSync(path.join(X, "brushes.js"), "utf8");
check("the engine: the tip cache knows a preset's settings changed (v); a dab with settings goes to brushdyn; smoothing steadies the pointer", /\$\{preset\.v \|\| 0\}/.test(bsrc) && /root\.IEBrushDyn\.active\(this\.p\)\) return root\.IEBrushDyn\.dab/.test(bsrc) && /const sm = this\.p\.smoothing \|\| 0;/.test(bsrc));
// the store
const S = require(path.join(ROOT, "lib", "brushStore.js")), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "brushes-")); S.setBase(tmp);
const sv = S.save("My: brush!", { id: "x", name: "x", engine: "paint", tip: "round", size: 9 });
let bad = ""; try { S.save("Bad", { tip: "sampled" }); } catch (e) { bad = e.message; }
const ls = S.list();
check("brushes/<name>.json: a safe name, the id user:<name>; a sampled brush needs its picture; listed; removed", sv.name === "My_ brush_" && ls.length === 1 && ls[0].preset.id === "user:My_ brush_" && /needs its picture/.test(bad) && S.remove("My_ brush_").removed && !S.list().length, [sv, ls, bad]);
fs.rmSync(tmp, { recursive: true, force: true });
const idx = fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8"), rt = fs.readFileSync(path.join(ROOT, "routes", "brushes.js"), "utf8"), ie = fs.readFileSync(path.join(X, "imageedit.js"), "utf8"), ext = JSON.parse(fs.readFileSync(path.join(X, "ext.json"), "utf8")).scripts;
check("the wiring: routes/brushes.js mounted from routes/index.js (text/plain save - bigger than the 100 kB JSON parser); brushdyn.js before imageedit.js; installed", /require\("\.\/brushes"\)\.mount\(app\)/.test(idx) && /express\.text\(/.test(rt) && ext.indexOf("brushdyn.js") > 0 && ext.indexOf("brushdyn.js") < ext.indexOf("imageedit.js") && /win\.IEBrushDyn\.install\(E\)/.test(ie));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
