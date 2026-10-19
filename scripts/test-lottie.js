#!/usr/bin/env node
/* bitGen Studio — 2.512.0 unit tests: ⤓ LOTTIE (JSON) EXPORT (lib/lottie.js, routes/lottie.js, ext/timelinedock/tllottie.js).
 * Tim: "lets do steps 1,2,3 , 4,5,6 and 7" (step 7: Lottie (JSON) export). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const LT = require(path.join(ROOT, "lib", "lottie.js"));
const TL = require(path.join(ROOT, "ext", "timelinedock", "tllottie.js"));
const KF = require(path.join(ROOT, "static", "keyframes.js"));

/* a real 40 x 20 PNG */
function png(w, h) {
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (ty, d) => { const L = Buffer.alloc(4); L.writeUInt32BE(d.length); const T = Buffer.from(ty); const C = Buffer.alloc(4); C.writeUInt32BE(crc(Buffer.concat([T, d]))); return Buffer.concat([L, T, d, C]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const P40 = png(40, 20);
check("sizeOf: a PNG's size from its bytes", JSON.stringify(LT.sizeOf(P40)) === "[40,20]");
check("handles: each ease = exactly the timeline's curve (linear, in, out, in-out, a custom bezier) as Lottie's o / i; hold = h",
  JSON.stringify(LT.handles({ ease: "in" })) === JSON.stringify({ o: { x: [0.3333], y: [0] }, i: { x: [0.6667], y: [0.3333] } }) && LT.handles({ ease: "hold" }).h === 1
  && LT.handles({ ease: "bezier", bz: [0.1, 0.9, 0.2, 1] }).o.y[0] === 0.9 && LT.handles({}).o.y[0] === 0.3333);
// the named eases really are those beziers (the timeline's own maths)
const eq = ["in", "out", "inout"].every((e) => { const b = LT.BZ[e]; for (let f = 0.05; f < 1; f += 0.05) { if (Math.abs(KF.ease(e, f) - KF.ease("bezier", f, b)) > 1e-4) return false; } return true; });
check("…the timeline's in / out / in-out ARE those cubic beziers (sampled)", eq);
const desc = { name: "T", W: 640, H: 360, fps: 24, dur: 3, layers: [
  { kind: "native", name: "Logo", file: "logo.png", baseW: 80, baseH: 40, start: 0.5, len: 2, lop: 0.5, op: 1, tf: { x: 10, y: -20, scale: 1, rot: 0, ax: 0, ay: 0 },
    kf: [{ at: 0, x: 10, scale: 1, ease: "out" }, { at: 1, x: 110, scale: 2, ease: "hold" }, { at: 1.5, x: 50, scale: 1 }], blend: "screen" },
  { kind: "frames", name: "FX", start: 0, fps: 24, frames: ["data:image/png;base64,AAA", null, null, "data:image/png;base64,BBB", "data:image/png;base64,AAA"], blend: "normal" },
  { kind: "native", name: "Gone", file: "missing.png", baseW: 10, baseH: 10, start: 0, len: 1 },
  { kind: "video", name: "Clip", why: "a video layer" }] };
const r = LT.build(desc, (f) => (f === "logo.png" ? P40 : null)), J = r.json, Lg = J.layers[0];
check("build: a v5 composition (size, fps, length in frames), the picture embedded once as a data: URL at its own size",
  J.w === 640 && J.h === 360 && J.fr === 24 && J.op === 72 && J.assets[0].w === 40 && J.assets[0].h === 20 && /^data:image\/png;base64,/.test(J.assets[0].p) && J.assets[0].e === 1, [J.w, J.op, J.assets[0].w]);
check("a native layer: an image layer from 0.5 s for 2 s (frames 12 .. 60), screen blend, its anchor the picture's centre",
  Lg.ty === 2 && Lg.ip === 12 && Lg.op === 60 && Lg.bm === 2 && JSON.stringify(Lg.ks.a.k) === "[20,10,0]", Lg);
const px = Lg.ks.p.x.k, sk = Lg.ks.s.k;
check("its keys: split position (x from the frame's centre -> the frame's px) at the clip's frames, scale x (display / picture = 2) x 100, the eases' handles, hold at the hold key",
  Lg.ks.p.s === true && px.length === 3 && px[0].t === 12 && px[0].s[0] === 330 && px[1].t === 36 && px[1].s[0] === 430 && px[0].o.y[0] === 0.6667 && px[1].h === 1 && !px[2].o
  && Lg.ks.p.y.a === 0 && Lg.ks.p.y.k === 160 && sk[0].s[0] === 200 && sk[1].s[0] === 400, { px, y: Lg.ks.p.y, sk });
check("opacity: the clip's x the layer's (50 %), a turn of 0", Lg.ks.o.a === 0 && Lg.ks.o.k === 50 && Lg.ks.r.k === 0);
const fr = J.layers.slice(1).filter((l) => /^FX/.test(l.nm));
check("a frames layer: each new picture its own image layer for as long as it lasts (repeats shared: 2 images for 3 runs), full frame",
  fr.length === 3 && fr[0].ip === 0 && fr[0].op === 3 && fr[1].ip === 3 && fr[1].op === 4 && fr[2].ip === 4 && fr[2].op === 5 && fr[0].refId === fr[2].refId && J.assets.length === 3 && JSON.stringify(fr[0].ks.a.k) === "[320,180,0]", fr.map((l) => [l.ip, l.op, l.refId]));
check("left out and named: a missing picture, a video layer", r.skipped.length === 2 && /missing\.png/.test(r.skipped[0]) && /video/.test(r.skipped[1]), r.skipped);
const anc = LT.build({ W: 100, H: 100, fps: 24, dur: 1, layers: [{ kind: "native", name: "A", file: "a", baseW: 80, baseH: 40, start: 0, len: 1, tf: { ax: 20, ay: 10 }, kf: [{ at: 0, ax: 0 }, { at: 1, ax: 40 }] }] }, () => P40).json.layers[0].ks.a;
check("the anchor point: picture px (ax / k0) from the picture's centre; keyed = x / y on one timeline", anc.a === 1 && anc.k[0].s[0] === 20 && anc.k[1].s[0] === 40 && anc.k[0].s[1] === 15, anc);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lt512-")), sv = LT.save(tmp, "proj", J);
check("save: <project>_lottie.json beside the movies, valid JSON", sv.name === "proj_lottie.json" && JSON.parse(fs.readFileSync(path.join(tmp, sv.name), "utf8")).layers.length === J.layers.length);
const DL = require(path.join(ROOT, "lib", "deliver.js"));
fs.writeFileSync(path.join(tmp, "proj.json"), "{}");
check("📤 Export lists the Lottie (and not the project's other json)", DL.files(tmp, "proj").some((f) => f.name === "proj_lottie.json") && !DL.files(tmp, "proj").some((f) => f.name === "proj.json"));
fs.rmSync(tmp, { recursive: true, force: true });
/* the page's choice */
check("native(): a plain moving picture / text = a real layer; masks, effects, a look, parents, expressions, a keyed text colour, a transition, a curved path = frames",
  TL.native({ kf: [{ at: 0, x: 1 }] }, {}) === null && TL.native({ text: {}, kf: [{ at: 0, op: 1 }] }, {}) === null && TL.native({ masks: [{}] }) === "masks" && TL.native({ parent: "u1" }) === "parented"
  && TL.native({ expr: { x: "time" } }) === "expressions" && TL.native({ fx: { vfx: 1 } }) === "a look / effects" && TL.native({ text: {}, kf: [{ at: 0, color: "#fff" }] }) === "a keyed text colour"
  && TL.native({}, { transitionIn: { type: "fade" } }) === "an entry / exit transition" && TL.native({}, { transitionIn: { type: "none", dur: 0.5 } }) === null && TL.native({ kf: [{ at: 0, x: 0, to: [5, 5] }] }) === "a curved motion path" && TL.native({ warp: {} }) === "effects" && TL.native({ d3: { on: true } }) === "effects");
const RI = read("routes", "index.js"), RL = read("routes", "lottie.js"), DJ = read("ext", "timelinedock", "deliver.js");
check("the route: POST /api/lottie/export (mounted from routes/index.js, not server.js), the pictures read from images/; 📤 Export has ⤓ Lottie (JSON)",
  /require\("\.\/lottie"\)\.mount\(app\);/.test(RI) && /app\.post\("\/api\/lottie\/export"/.test(RL) && /core\.pDir\("images"\)/.test(RL) && !/lottie/.test(read("server.js")) && /id="tdlLottie"/.test(DJ) && /TlLottie\.export\(/.test(DJ));
const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
check("wiring: tllottie.js in the timeline extension", EXT.indexOf("tllottie.js") > EXT.indexOf("tldata.js") && EXT.indexOf("tldata.js") > 0);
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
