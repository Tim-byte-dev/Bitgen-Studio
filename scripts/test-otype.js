// scripts/test-otype.js — 2.466.0: OPENTYPE TYPE (ext/imageeditdock/pcotype.js + pctype.js): features, optical kerning,
// Type: Convert to Shape / Create Work Path (the font file's outlines); ROUND CORNERS on any path (pcpath.js
// roundCorners - a joined / merged shape's corners too); lib/fontFiles.js's generic families. Pure + the wiring.
// Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor".
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const O = require("../ext/imageeditdock/pcotype.js");
globalThis.PCOType = O;                                  // pctype finds the engine the way the page does
const T = require("../ext/imageeditdock/pctype.js");
const Q = require("../ext/imageeditdock/pcpath.js");
let fail = 0;
const check = (name, ok, extra) => { console.log((ok ? "ok   " : "FAIL ") + name + (ok || extra === undefined ? "" : " " + JSON.stringify(extra).slice(0, 600))); if (!ok) fail++; };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

/* ---- features */
check("engineOn: plain text no; a feature changed from its default (dlig on / liga off) or optical kerning yes; liga on (its default) no", !O.engineOn({}) && O.engineOn({ ot: { dlig: true } }) && O.engineOn({ ot: { liga: false } }) && O.engineOn({ kern: "optical" }) && !O.engineOn({ ot: { liga: true } }));
check("featuresOf: the asked ones + a stylistic set; kern off for optical / 0", JSON.stringify(O.featuresOf({ ot: { liga: false, frac: true, ss03: true }, kern: "optical" })) === JSON.stringify({ liga: false, frac: true, ss03: true, kern: false }));
check("pctype takes a text with OpenType settings (it lays it out + draws the glyphs)", T.wants({ str: "x", ot: { dlig: true } }) && T.wants({ str: "x", kern: "optical" }) && !T.wants({ str: "x" }) && T.CHAR_KEYS.includes("ot"));

/* ---- outlines: commands -> pcpath subs */
const subs = O.toSubs([{ command: "moveTo", args: [0, 0] }, { command: "quadraticCurveTo", args: [50, 100, 100, 0] }, { command: "lineTo", args: [0, 0] }, { command: "closePath", args: [] }], (x, y) => [x, -y]);
check("toSubs: a quadratic becomes a cubic (handles at 2/3 toward its control), y flipped, the closing anchor merged", subs.length === 1 && subs[0].pts.length === 2 && near(subs[0].pts[0].ox, 100 / 3) && near(subs[0].pts[0].oy, -200 / 3) && near(subs[0].pts[1].ix, 200 / 3) && near(subs[0].pts[1].iy, -200 / 3) && subs[0].closed);
const sq = (x0, x1) => [[[x0, 0], [x1, 0], [x1, 100], [x0, 100]]];
check("inkSpan / opticalGap: two boxes 0-40 and 0-40 placed 60 apart leave 20 white at every height", JSON.stringify(O.inkSpan(sq(0, 40), 50)) === "[0,40]" && O.inkSpan(sq(0, 40), 150) === null && near(O.opticalGap(sq(0, 40), sq(0, 40), 60, 1000, 0, 100), 20));

/* ---- with a real font file (when this computer has one) */
const CAND = ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/texmf/fonts/opentype/public/lm/lmroman10-regular.otf", "C:\\Windows\\Fonts\\arial.ttf", "/Library/Fonts/Arial.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf"];
const LM = "/usr/share/texmf/fonts/opentype/public/lm/lmroman10-regular.otf";
const file = CAND.find((f) => { try { return fs.existsSync(f); } catch (e) { return false; } });
const fk = require("../static/vendor/fontkit.umd.min.js");
if (!file) console.log("skip the font-file checks: no known font file on this computer");
else {
  const font = fk.create(fs.readFileSync(file));
  const a = O.shapeRun(font, "AVAV", { size: 100, feats: {} }), b = O.shapeRun(font, "AVAV", { size: 100, feats: { kern: false } }), c = O.shapeRun(font, "AVAV", { size: 100, feats: { kern: false }, tracking: 10 });
  check("shapeRun (" + path.basename(file) + "): metrics kerning pulls AV together; tracking adds px per glyph", a.width < b.width && near(c.width, b.width + 40, 1e-6), { a: a.width, b: b.width, c: c.width });
  const nn = O.shapeRun(font, "nn", { size: 100, feats: { kern: false }, optical: true }), nn0 = O.shapeRun(font, "nn", { size: 100, feats: { kern: false } });
  const to = O.shapeRun(font, "To", { size: 100, feats: { kern: false }, optical: true }), to0 = O.shapeRun(font, "To", { size: 100, feats: { kern: false } });
  check("optical kerning: \"nn\" (the font's own rhythm) barely moves; \"To\" (white under the T's bar) closes up", Math.abs(nn.width - nn0.width) < 2.5 && to.width < to0.width - 3, { nn: nn.width - nn0.width, to: to.width - to0.width });
  const o = O.outline(font, "o", { size: 100, x: 0, baseline: 100 }), area = (sb) => { let s = 0; const p = sb.pts; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += p[i].x * q.y - q.x * p[i].y; } return s / 2; };
  check("outline \"o\": two contours wound opposite ways (a nonzero fill leaves its hole), sitting on the baseline", o.subs.length === 2 && Math.sign(area(o.subs[0])) === -Math.sign(area(o.subs[1])) && o.subs.every((sb) => sb.pts.every((p) => p.y <= 101.5 && p.y > 30)), o.subs.map(area));
  if (fs.existsSync(LM)) {
    const lm = fk.create(fs.readFileSync(LM));
    const on = O.shapeRun(lm, "office", { size: 50, feats: {} }), off = O.shapeRun(lm, "office", { size: 50, feats: { liga: false } });
    const on1 = O.shapeRun(lm, "2019", { size: 50, feats: { onum: true } }), off1 = O.shapeRun(lm, "2019", { size: 50, feats: {} });
    check("features (Latin Modern): liga makes \"ffi\" one glyph (4 glyphs; off = 6); onum swaps the figures for oldstyle ones", on.glyphs.length === 4 && off.glyphs.length === 6 && on1.glyphs.some((g, i) => g.g.id !== off1.glyphs[i].g.id), { on: on.glyphs.length, off: off.glyphs.length });
  } else console.log("skip the Latin Modern feature check (no lmroman10-regular.otf here)");
  // Convert to Shape: pctype.outlinesOf with the page's loader (fontkit + /api/fonts/file mocked)
  globalThis.fontkit = fk; O._fonts.clear();
  const buf = fs.readFileSync(file);
  globalThis.fetch = async (u) => ({ ok: /family=/.test(u), arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length), headers: { get: () => encodeURIComponent(path.basename(file)) } });
  (async () => {
    const t = { str: "Hi\nok", font: "Arial", size: 50, x: 100, y: 40, leading: 1.2, align: "left", color: "#336699", underline: true };
    const r = await T.outlinesOf(t, null);
    const pts = r.path ? r.path.subs.flatMap((sb) => sb.pts) : [], xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    check("outlinesOf (Convert to Shape / Create Work Path): two lines of glyph outlines + an underline under each - all where the text is drawn", r.path && r.path.subs.length >= 7 && Math.min(...xs) >= 99 && Math.min(...ys) > 40 && Math.max(...ys) < 40 + 50 * 1.2 * 2 + 10 && r.font === path.basename(file), { n: r.path && r.path.subs.length, x: [Math.min(...xs), Math.max(...xs)], y: [Math.min(...ys), Math.max(...ys)], err: r.err });
    const turned = await T.outlinesOf(Object.assign({}, t, { vertical: true }), null);
    check("...vertical / path / warped / 3D text is refused (rasterize it)", !!turned.err);
    rest();
  })();
}
if (!file) rest();

function rest() {
  /* ---- round corners */
  const A = (x, y) => ({ x, y, ix: x, iy: y, ox: x, oy: y });
  const rectP = { subs: [{ closed: true, op: "add", pts: [A(0, 0), A(100, 0), A(100, 50), A(0, 50)] }] };
  const areaOf = (p) => { let s = 0; for (const sb of p.subs) { const f = Q.flatten ? null : null; void f; const pts = []; const n = sb.pts.length; for (let i = 0; i < n; i++) { const a = sb.pts[i], b = sb.pts[(i + 1) % n]; for (let k = 0; k < 32; k++) { const u = k / 32, v = 1 - u; pts.push([v * v * v * a.x + 3 * v * v * u * a.ox + 3 * v * u * u * b.ix + u * u * u * b.x, v * v * v * a.y + 3 * v * v * u * a.oy + 3 * v * u * u * b.iy + u * u * u * b.y]); } } for (let i = 0; i < pts.length; i++) { const q = pts[(i + 1) % pts.length]; s += pts[i][0] * q[1] - q[0] * pts[i][1]; } } return Math.abs(s / 2); };
  let r = Q.roundCorners(rectP, null, 10);
  check("roundCorners: a 100 x 50 rectangle, r 10 - 4 corners, 8 anchors, area 5000 - (4 - π)·100 (a circular arc)", r.count === 4 && r.path.subs[0].pts.length === 8 && near(areaOf(r.path), 5000 - (4 - Math.PI) * 100, 0.5), { n: r.count, area: areaOf(r.path) });
  r = Q.roundCorners(rectP, [[0, 2]], 10);
  check("...only the picked corner (bottom right): 5 anchors, the others still sharp", r.count === 1 && r.path.subs[0].pts.length === 5 && near(r.path.subs[0].pts[2].x, 100) && near(r.path.subs[0].pts[2].y, 40, 1e-6) && near(r.path.subs[0].pts[3].x, 90, 1e-6));
  r = Q.roundCorners(rectP, null, 500);
  check("...a radius too big: cut to fit (half the shorter side - the ends become a stadium)", r.count === 4 && near(areaOf(r.path), 5000 - (4 - Math.PI) * 625, 1));
  // an L shape - a rectangle joined with another (a merged compound outline) - its 6 corners, the inner one too
  const L = { subs: [{ closed: true, op: "add", pts: [A(0, 0), A(60, 0), A(60, 40), A(30, 40), A(30, 80), A(0, 80)].map((p) => p) }] };
  r = Q.roundCorners(L, null, 5);
  check("...a JOINED shape's outline (an L, merged from two rectangles): all 6 corners, the inner one too", r.count === 6 && r.path.subs[0].pts.length === 12);
  const open = { subs: [{ closed: false, op: "add", pts: [A(0, 0), A(50, 0), A(50, 50)] }] };
  r = Q.roundCorners(open, null, 10);
  check("...an open path: its ends stay, the middle corner rounds", r.count === 1 && r.path.subs[0].pts.length === 4 && near(r.path.subs[0].pts[0].x, 0) && near(r.path.subs[0].pts[3].y, 50));
  const smooth = Q.roundCorners({ subs: [{ closed: true, op: "add", pts: [{ x: 0, y: 0, ix: -20, iy: 10, ox: 20, oy: -10 }, { x: 50, y: 50, ix: 70, iy: 40, ox: 30, oy: 60 }] }] }, null, 10);
  check("...smooth anchors are no corners (nothing to round)", smooth.count === 0);

  /* ---- text in a shape (area type in any closed outline) */
  const tri = [[100, 0], [200, 200], [0, 200]];                    // a triangle, point up (relative to x, y)
  const tt = { str: "one two three four five six seven eight nine ten eleven twelve thirteen", size: 12, leading: 1.25, x: 50, y: 30, area: { poly: tri }, box: { w: 200, h: 200 } };
  const la = T.layout(tt);
  const inside = la.lines.filter((l) => !l.over).every((l) => { const s = T.bandSpan(tri.map(([x, y]) => [x + 50, y + 30]), l.y, l.y + 15); return s && l.x >= s[0] - 1e-6 && l.x + l.w <= s[1] + 1e-6; });
  const ws = la.lines.filter((l) => !l.over).map((l) => Math.round(l.w));
  check("text in a shape: the lines flow inside a triangle (each inside its band), longer as it widens, nothing hidden", la.area && inside && la.lines.length >= 4 && !la.overflow && ws[ws.length - 1] > ws[0], { ws, n: la.lines.length });
  const big = T.layout(Object.assign({}, tt, { str: tt.str.repeat(20) }));
  check("...too much text: what does not fit is hidden (overflow)", big.overflow && big.lines.some((l) => l.over));
  const centred = T.layout(Object.assign({}, tt, { align: "center" }));
  check("...centred lines sit round the triangle's middle (x 150)", centred.lines.filter((l) => !l.over).every((l) => Math.abs(l.x + l.w / 2 - 150) < 1.5));
  check("spansAt: a ring (two loops) has two spans across its middle", T.spansAt([[0, 0], [100, 0], [100, 100], [0, 100], [0, 0], [30, 30], [30, 70], [70, 70], [70, 30], [30, 30]], 50).length === 2);
  T.scale(tt, 2, 3);
  check("Image Size scales the shape with the text", JSON.stringify(tt.area.poly[1]) === "[400,600]");

  /* ---- the wiring */
  const ext = JSON.parse(fs.readFileSync(path.join(ROOT, "ext/imageeditdock/ext.json"), "utf8")).scripts;
  const TY = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/pctype.js"), "utf8"), PE = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/pcpen.js"), "utf8"), FF = fs.readFileSync(path.join(ROOT, "lib/fontFiles.js"), "utf8");
  check("wiring: pcotype.js right after pctype.js; the Character panel's Optical kerning + OpenType buttons + stylistic set; Type: Convert to Shape / Create Work Path", ext.indexOf("pcotype.js") === ext.indexOf("pctype.js") + 1 && /value="optical"/.test(TY) && /data-ot="\$\{k\}"/.test(TY) && /id="pcySS"/.test(TY) && /C\("type\.toshape", "Type: Convert to Shape"/.test(TY) && /C\("type\.workpath", "Type: Create Work Path"/.test(TY) && /C\("type\.inshape", "Type: Text in the Picked Shape"/.test(TY) && /E\.tools\.type\.down = function/.test(TY));
  check("wiring: Direct Selection's ⌜ Radius + Round Corners (#pnDSRad #pnDSRound) -> Q.roundCorners; lib/fontFiles.js finds a file for a generic family", /id="pnDSRad"/.test(PE) && /id="pnDSRound"/.test(PE) && /Q\.roundCorners\(/.test(PE) && /const GENERIC = \{/.test(FF) && /"sans-serif": \[/.test(FF));
  console.log(fail ? `\n${fail} FAILED` : "\nall OpenType + round corner checks passed");
  process.exit(fail ? 1 : 0);
}
