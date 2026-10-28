#!/usr/bin/env node
/* bitGen Studio — 2.411.0 units: TEXT EFFECT PRESETS from PSD text effects (static/textfx.js), their storage
 * (lib/textFx.js + routes/textfx.js), the image editor's style engine grown for them (pcstyles.js gloss contours,
 * gradient stops, glitter; pcdoc.js several drop shadows, gradient strokes, stroke emboss, env.dilate; pcpsd.js reading
 * them from a PSD), the two built-in presets made from Tim's PSDs, and the wiring (the timeline's and the image editor's
 * Presets ▾, live).
 * Tim: "are you able to add these styles to a presets dropdown in the text tool properties in timeline docker and image
 * editor?" -> "is it possible to create a tool for bitgen to add the text effects to presets?" -> "it would be nice if it
 * was live". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
const TFX = require(path.join(ROOT, "static", "textfx.js"));
const PS = require(path.join(ROOT, "ext", "imageeditdock", "pcstyles.js"));
const PP = require(path.join(ROOT, "ext", "imageeditdock", "pcpsd.js"));
const A = require(path.join(ROOT, "static", "vendor", "ag-psd.js"));

/* ---- 1. the style engine's new parts */
check("pcstyles: a gloss contour - points 0..255 -> 0..1, straight between them; linear = none",
  PS.glossOf([[0, 0], [255, 255]]) === null && near(PS.contourAt(PS.glossOf([[0, 0], [128, 255], [255, 0]]), 0.25), 0.498, 0.01)
  && near(PS.contourAt(PS.glossOf([[0, 0], [128, 255], [255, 0]]), 1), 0));
check("pcstyles: gradient stops (sorted, 2+), else c1 -> c2; the colour at t between stops",
  JSON.stringify(PS.stopsOf({ stops: [{ c: "#ff0000", at: 0.5 }, { c: "#000000", at: 0 }] })) === '[{"c":"#000000","at":0},{"c":"#ff0000","at":0.5}]'
  && JSON.stringify(PS.colorAt(PS.stopsOf({ c1: "#000000", c2: "#ffffff" }), 0.5)) === "[127.5,127.5,127.5]" && PS.colorAt(PS.stopsOf({ stops: [{ c: "#000000", at: 0 }, { c: "#ff0000", at: 0.5 }] }), 0.9)[0] === 255);
{
  const t = PS.patternTile("glitter", 64, "#ffffff", "#000000"); let bright = 0, dark = 0;
  for (let i = 0; i < t.length; i += 4) { if (t[i] > 190) bright++; else if (t[i] < 60) dark++; }
  check("pcstyles: the GLITTER pattern - sparse bright sparkles on the ground colour", bright > 64 * 64 * 0.08 && bright < 64 * 64 * 0.25 && dark > 64 * 64 * 0.6 && PS.PATTERNS.some((p) => p[0] === "glitter"), { bright, dark });
}
check("pcstyles: Bevel & Emboss has Stroke Emboss", PS.BEVEL_STYLES.includes("stroke emboss"));
{
  const a = new Float32Array(40 * 40); for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) a[y * 40 + x] = 1;
  const plain = PS.bevelShade(a, 40, 40, { size: 4 }), ring = PS.bevelShade(a, 40, 40, { size: 4, gloss: [[0, 0], [64, 255], [128, 0], [192, 255], [255, 0]] });
  let diff = 0; for (let i = 0; i < plain.length; i++) diff += Math.abs(plain[i] - ring[i]);
  check("pcstyles: a gloss contour changes the bevel's light (Photoshop's Ring - Double bands)", diff > 5, diff);
}
const DOC = read("ext", "imageeditdock", "pcdoc.js");
check("pcdoc: styles.shadows = more drop shadows; a gradient stroke; Stroke Emboss lights the ring; env.dilate (the stroke from the letters' outlines)",
  /const shs = \(Array\.isArray\(st\.shadows\)/.test(DOC) && /sk\.fill === "gradient" && PS && PS\.gradientFill/.test(DOC) && /bv\.style === "stroke emboss"/.test(DOC)
  && /env\.dilate \? env\.dilate\(content, outR, col\)/.test(DOC) && /k === "shadows" \? Array\.isArray\(s\)/.test(DOC));

/* ---- 2. PSD effects -> styles (ag-psd's shapes) */
{
  const px = (v) => ({ units: "Pixels", value: v });
  const fx = {
    dropShadow: [{ enabled: true, color: { r: 0, g: 77, b: 125 }, opacity: 0.2, angle: 90, distance: px(292), size: px(250) }, { enabled: false, color: { r: 0, g: 0, b: 0 }, opacity: 1, distance: px(1), size: px(1) },
                 { enabled: true, color: { r: 0, g: 77, b: 125 }, opacity: 0.56, angle: 90, distance: px(29), size: px(29) }],
    stroke: [{ enabled: true, size: px(21), position: "outside", fillType: "gradient", color: { r: 186, g: 0, b: 0 }, opacity: 1,
               gradient: { colorStops: [{ color: { r: 79, g: 172, b: 254 }, location: 0 }, { color: { r: 0, g: 242, b: 254 }, location: 1 }], angle: 90, style: "linear" } }],
    bevel: { enabled: true, style: "stroke emboss", strength: 3.96, size: px(35), soften: px(5), angle: -45, altitude: 30, highlightBlendMode: "color dodge", shadowBlendMode: "linear burn",
             highlightColor: { r: 255, g: 255, b: 255 }, highlightOpacity: 0.49, shadowColor: { r: 122, g: 60, b: 0 }, shadowOpacity: 0.31, useShape: false,
             contour: { name: "Ring - Double", curve: [{ x: 0, y: 0 }, { x: 128, y: 0 }, { x: 255, y: 255 }] } },
    innerGlow: { enabled: true, color: { r: 237, g: 237, b: 237 }, opacity: 0.28, size: px(0) },
    gradientOverlay: [{ enabled: true, opacity: 1, angle: 90, type: "linear", scale: 1.5, blendMode: "normal",
      gradient: { colorStops: [{ color: { r: 255, g: 138, b: 0 }, location: 0 }, { color: { r: 255, g: 229, b: 6 }, location: 0.56 }] } }],
  };
  const st = PP.effectsToStyles(fx, {}).styles;
  check("pcpsd: EVERY enabled drop shadow (the first = shadow, the rest = shadows; a disabled one left out)", st.shadow.distance === 292 && st.shadows.length === 1 && st.shadows[0].distance === 29 && st.shadows[0].color === "#004d7d", st);
  check("pcpsd: a gradient stroke keeps its stops + angle", st.stroke.fill === "gradient" && st.stroke.stops.length === 2 && st.stroke.stops[1].c === "#00f2fe" && st.stroke.size === 21);
  check("pcpsd: Stroke Emboss, depth 396 % (ag-psd's 3.96), colour dodge / linear burn -> colour-dodge / multiply, the gloss contour (no profile contour)",
    st.bevel.style === "stroke emboss" && st.bevel.depth === 396 && st.bevel.hiBlend === "color-dodge" && st.bevel.shBlend === "multiply" && JSON.stringify(st.bevel.gloss) === "[[0,0],[128,0],[255,255]]", st.bevel);
  check("pcpsd: a size of 0 stays 0 (an inner glow of 0 px)", st.innerGlow.size === 0);
  check("pcpsd: a gradient overlay's stops (one at 56 %), its scale 150 %", st.gradientOverlay.stops.length === 2 && near(st.gradientOverlay.stops[1].at, 0.56) && st.gradientOverlay.scale === 150);
  const st2 = PP.effectsToStyles({ bevel: Object.assign({}, fx.bevel, { style: "inner bevel", useShape: true }) }, {}).styles;
  check("pcpsd: with a profile contour (useShape) the contour is NOT taken as the gloss (ag-psd keeps one contour)", !st2.bevel.gloss);
}

/* ---- 3. fromPsd: a synthetic text effect PSD (ag-psd's reading shape) */
{
  const q = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
  const so = (name, t, b, extra) => Object.assign({ name, left: b[0], top: b[1], right: b[2], bottom: b[3], placedLayer: { id: "T1", transform: t } }, extra || {});
  const psd = { width: 2000, height: 1200, linkedFiles: [{ id: "T1", data: "inner" }], children: [
    { name: "bg", children: [{ name: "Color Fill 1" }] },
    { name: "shadow", effects: { dropShadow: [{ enabled: true, color: { r: 0, g: 0, b: 0 }, opacity: 0.5, angle: 90, distance: { value: 30 }, size: { value: 20 } }] },
      children: [so("copy 9", q(0, 0, 2000, 1200), [500, 400, 1500, 600])] },
    { name: "side", children: [so("copy 2", q(-40, 20, 2040, 1220), [480, 420, 1520, 620]), so("copy 1", q(-20, 10, 2020, 1210), [490, 410, 1510, 610], { blendMode: "multiply" })] },
    so("face", q(0, 0, 2000, 1200), [500, 400, 1500, 600], { effects: { solidFill: [{ enabled: true, color: { r: 255, g: 200, b: 0 }, opacity: 1 }] } }),
    so("hidden copy", q(0, 0, 2000, 1200), [500, 400, 1500, 600], { hidden: true }),
    so("Your text here", q(0, 0, 2000, 1200), [500, 400, 1500, 600], { opacity: 0 }),
    { name: "ornament", left: 0, top: 0, right: 100, bottom: 100 },
    { name: "title", children: [{ name: "100% EDITABLE", text: { text: "x" } }] },
  ] };
  const deps = { effectsToStyles: PP.effectsToStyles, blendIn: PP.blendIn, rgbToHex: PP.rgbToHex,
                 readPsd: () => ({ children: [{ name: "w", text: { style: { fillColor: { r: 255, g: 0, b: 0 }, font: { name: "Blantic-Regular" } } } }] }) };
  const p = TFX.fromPsd(psd, deps, "Test Gold");
  const names = []; (function w(ns, d) { for (const n of ns) { names.push(" ".repeat(d) + n.type + ":" + n.name); if (n.kids) w(n.kids, d + 1); } })(p.nodes, 0);
  check("fromPsd: the text's copies kept in their groups (bottom to top), the background / ornament / captions / hidden / 0 % ones left out and counted",
    names.join("|") === "group:shadow| text:copy 9|group:side| text:copy 2| text:copy 1|text:face" && p.notes.decor === 5 && p.notes.hidden === 2, { names, notes: p.notes });
  const c2 = p.nodes[1].kids[0].t, c1 = p.nodes[1].kids[1];
  check("fromPsd: each copy's place against the word in units of its ink height (copy 2: 40 px wider each side of a 2000 px box, 20 px lower)",
    near(c2.ex, 1000 * (2080 / 2000 - 1) / 2 / 200, 1e-4) && near(c2.ey, (1200 / 1200 - 1) / 2) && near(c2.dy, 20 / 200, 1e-4) && near(c2.dx, 0, 1e-4) && c1.blend === "multiply", { c2, c1 });
  check("fromPsd: the ink box = the base copy's bounds; the smart object's own text colour + font (Blantic, -Regular dropped); group effects kept",
    p.ref.inkW === 1000 && p.ref.inkH === 200 && p.fill === "#ff0000" && p.font.family === "Blantic" && p.nodes[0].styles.shadow.distance === 30 && p.nodes[2].styles.colorOverlay.color === "#ffc800", p);
  let e1 = ""; try { TFX.fromPsd({ children: [{ name: "pix" }] }, deps, "x"); } catch (e) { e1 = e.message; }
  check("fromPsd: a PSD without a smart object is refused in words", /no smart object/.test(e1), e1);
  // a real PSD written by ag-psd (a GUID smart object, its linked document with a text layer) read back + converted
  const G = "20953ddb-9391-11ec-b4f1-c15674f50bc4";
  const inner = A.writePsdBuffer({ width: 200, height: 100, children: [{ name: "word", text: { text: "Hi", style: { font: { name: "Foo-Regular" }, fontSize: 40, fillColor: { r: 0, g: 128, b: 255 } } } }] }, { invalidateTextLayers: false });
  const tq = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
  const sl = (name, t, extra) => Object.assign({ name, placedLayer: { id: G, placed: G, type: "raster", transform: t, width: 200, height: 100 } }, extra || {});
  const buf = A.writePsdBuffer({ width: 400, height: 300, linkedFiles: [{ id: G, name: "word.psb", data: inner }], children: [
    { name: "bg" }, { name: "side", children: [sl("copy 2", tq(96, 104, 304, 204)), sl("copy 1", tq(98, 102, 302, 202))] },
    sl("Your text here", tq(100, 100, 300, 200), { effects: { dropShadow: [{ enabled: true, color: { r: 0, g: 0, b: 0 }, opacity: 0.5, angle: 90, distance: { units: "Pixels", value: 10 }, size: { units: "Pixels", value: 6 } },
      { enabled: true, color: { r: 0, g: 0, b: 0 }, opacity: 0.3, angle: 90, distance: { units: "Pixels", value: 20 }, size: { units: "Pixels", value: 12 } }] } })] });
  fs.writeFileSync(path.join(os.tmpdir(), "textfx_fixture.psd"), buf);
  const o = { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true };
  const rp = TFX.fromPsd(A.readPsd(buf, o), Object.assign({}, deps, { readPsd: (d) => A.readPsd(d, o) }), "Fixture");
  check("fromPsd on a REAL PSD file (ag-psd written + read): the copies, the 2 drop shadows, the inner text's colour + font",
    rp.nodes.length === 2 && rp.nodes[0].kids.length === 2 && rp.nodes[1].styles.shadows.length === 1 && rp.fill === "#0080ff" && rp.font.family === "Foo", rp);
}

/* ---- 4. normalize / scale / extent */
{
  const p = TFX.normalize({ id: "x<y>", name: "A\nB", ref: { inkW: 100, inkH: 50 }, fill: "red", nodes: [{ type: "text", t: { dx: 99 }, styles: { bevel: { on: true, size: 5, evil: { x: 1 } }, junk: { on: true } } }, { type: "group", kids: [] }] });
  check("normalize: ids cleaned, one-line names, a bad colour = none, moves capped, unknown styles / nested junk dropped, an empty group dropped",
    p.id === "xy" && p.name === "A B" && p.fill === null && p.nodes.length === 1 && p.nodes[0].t.dx === 5 && !p.nodes[0].styles.junk && !("evil" in p.nodes[0].styles.bevel));
  check("normalize: no size / no text nodes = unusable", TFX.normalize({ ref: { inkW: 0, inkH: 10 }, nodes: [{ type: "text" }] }) === null && TFX.normalize({ ref: { inkW: 10, inkH: 10 }, nodes: [] }) === null);
  const s = TFX.scaleStyles({ shadow: { on: true, distance: 10, size: 4, opacity: 0.5 }, shadows: [{ on: true, distance: 20, size: 2 }], stroke: { on: true, size: 3 }, bevel: { on: true, size: 6, soften: 2, depth: 100 } }, 0.5);
  check("scaleStyles: every px value x k (shadows too), the rest kept", s.shadow.distance === 5 && s.shadow.opacity === 0.5 && s.shadows[0].distance === 10 && s.stroke.size === 1.5 && s.bevel.size === 3 && s.bevel.depth === 100);
  check("extent: the farthest an effect reaches (a shadow's distance + its blur)", TFX.extent({ shadow: { on: true, distance: 10, size: 8 }, stroke: { on: true, size: 3 } }) === 20);
  check("the classic looks (Gold, Chrome, Neon ... - pcstyles.js) are presets too", TFX.classics(PS, {}).length === 10 && TFX.classics(PS, {})[0].id === "style:gold");
}

/* ---- 5. the built-in presets (made from Tim's PSDs by scripts/textfx_build.js) */
{
  const files = fs.readdirSync(path.join(ROOT, "textfx")).filter((n) => /\.json$/.test(n)).sort();
  const P = files.map((n) => TFX.normalize(JSON.parse(read("textfx", n))));
  const count = (ns) => ns.reduce((a, n) => a + 1 + (n.kids ? count(n.kids) : 0), 0);
  check("textfx/: Arena Gold 3D + Trend Candy 3D, both valid", files.join() === "arena-gold-3d.json,trend-candy-3d.json" && P.every(Boolean), files);
  const ar = P[0], tr = P[1];
  check("Arena Gold 3D: 8 drop shadows on its shadow group, 17 stroke + bevel copies under the face, a screened glitter copy over it, white text",
    ar.id === "psd:arena-gold-3d" && ar.nodes[0].styles.shadows.length === 7 && count(ar.nodes) === 26 && ar.fill === "#fefefe"
    && JSON.stringify(ar).includes('"pattern":"glitter"'), { n: count(ar.nodes) });
  check("Trend Candy 3D: 5 drop shadows, the gradient-stroked Stroke Emboss extrusion (31 copies), the face's gradient (2 stops) + satin + inner glow",
    tr.id === "psd:trend-candy-3d" && count(tr.nodes) === 54 && JSON.stringify(tr).includes('"style":"stroke emboss"') && JSON.stringify(tr).includes('"fill":"gradient"')
    && JSON.stringify(tr).includes('"satin"'), { n: count(tr.nodes) });
}

/* ---- 6. storage: lib/textFx.js */
{
  const L = require(path.join(ROOT, "lib", "textFx.js"));
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "tfx_"));
  L._dirs(T);
  const all0 = L.list();
  check("list: the built-in presets first (builtin: true)", all0.length >= 2 && all0[0].builtin && all0.every((p) => p.builtin));
  const base = { name: "My Gold", ref: { inkW: 100, inkH: 40 }, nodes: [{ type: "text", styles: { stroke: { on: true, size: 2 } } }] };
  const a = L.save(base), b = L.save(base);
  check("save: yours under textfx/user/, a taken name gets -2", a.id === "user:my-gold" && b.id === "user:my-gold-2" && fs.existsSync(path.join(T, "my-gold.json")) && L.list().filter((p) => !p.builtin).length === 2);
  L.rename(a.id, "Gold Two");
  check("rename: yours", L.list().find((p) => p.id === a.id).name === "Gold Two");
  L.remove(b.id);
  let e1 = "", e2 = "";
  try { L.remove("psd:arena-gold-3d"); } catch (e) { e1 = e.message; }
  try { L.save({ name: "x" }); } catch (e) { e2 = e.message; }
  check("remove: yours; a built-in one is refused; junk is refused in words", !L.list().some((p) => p.id === b.id) && /built-in/.test(e1) && /not a text effect preset/.test(e2), [e1, e2]);
  fs.rmSync(T, { recursive: true, force: true });
}

/* ---- 7. the wiring */
const IDX = read("static", "index.html"), CV = read("ext", "timelinedock", "canvas.js"), EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
check("index.html loads static/textfx.js; the timeline loads textfx.js (before tlfloat.js, still last)", IDX.includes('<script src="/static/textfx.js"></script>')
  && EXT.includes("textfx.js") && EXT[EXT.indexOf("tlgrid.js") - 1] === "tlfloat.js" && EXT.slice(EXT.indexOf("tlgrid.js") + 1).every((s) => ["tlselhl.js", "tlcadbar.js", "tlbody.js", "tlunreal.js", "tluelive.js", "tlgraph.js", "tlparent.js", "tlblend.js", "tlshape.js", "tltextanim.js", "tlexpr.js", "tlmask.js", "tltrack.js", "tltime.js", "tlvbake.js", "tlparticles.js", "tlaudio.js", "tlgen.js", "tldist.js", "tlrays.js", "tlwarp.js", "tlmotion.js", "tl3d.js", "tldata.js", "tllottie.js", "tlsizebar.js", "tlscene.js", "tlcutout.js", "tlcamtrack.js", "tlvfill.js", "tlanykey.js", "tltextfill.js", "tlmorph.js", "tlframe.js", "tljoin.js"].includes(s))   /* 2.470.0: tlselhl + tlcadbar after it */);   // 2.445.0: tlgrid.js after it
check("canvas.js: a preset text is drawn LIVE through H3TextFx (quick, then sharp), never cached plain; ⚙ Compile uploads the FULL picture",
  /H3TextFx\.live\("tl:" \+ t\.fx, fxSpec\(t\), t\.fx, function \(\) \{ mark\(\); \}\)/.test(CV) && /if \(!t\.fx\) texts\.set\(key, c\);/.test(CV) && /H3TextFx\.full\(fxSpec\(c\.text\), c\.text\.fx\)/.test(CV));
check("the timeline's Properties: a Preset row (ext/timelinedock/textfx.js, H3TextFx.picker)", /H3TextFx\.picker\(\{/.test(read("ext", "timelinedock", "textfx.js")) && /TlCanvas\.onProps\(hook\)/.test(read("ext", "timelinedock", "textfx.js")));
check("the image editor: rasterize draws a preset text through H3TextFx.drawText (+ an h3textfx event re-renders); Presets in the Type tool's bar and the text Properties",
  /root\.H3TextFx\.drawText\(g, L\.text, "pc:" \+ L\.id/.test(DOC) && /win\.addEventListener\("h3textfx"/.test(read("ext", "imageeditdock", "imageedit.js"))
  && /id="ptFxBox"/.test(read("ext", "imageeditdock", "pctools.js")) && /id="ppTFxRow"/.test(read("ext", "imageeditdock", "pcui.js")) && /fx: S\.typeFx/.test(read("ext", "imageeditdock", "pctools.js")));
check("routes: /api/textfx/presets mounted from routes/index.js (server.js untouched)", /require\("\.\/textfx"\)\.mount\(app\)/.test(read("routes", "index.js")) && !/textfx/i.test(read("misc/server.js")));
check("the live path: a learned cost per preset (60 - 150 px quick pictures), keystrokes faster than that keep the last picture, the sharp one 0.35 s after",
  /const BUDGET = 70;/.test(read("static", "textfx.js")) && /c\.cap \* Math\.sqrt\(BUDGET/.test(read("static", "textfx.js")) && /}, 350\)\);/.test(read("static", "textfx.js")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
