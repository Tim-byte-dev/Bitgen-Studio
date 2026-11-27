#!/usr/bin/env node
/* bitGen Studio — 3.0.0: 🙂 a REAL 3D head from a face close-up (lib/dazHeadFit.js + POST /api/dazlib/head/wrap).
 * Tim: "can we do a head from a picture and the body to a g9 template?" -> chose "Real 3D head shape". A made-up figure: a
 * body (chest), a neck, a head (sphere) and an eyeball inside it; the scan = a WIDER head, in other units, somewhere else. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const HF = require(path.join(ROOT, "lib/dazHeadFit.js")), BF = require(path.join(ROOT, "lib/dazBodyFit.js"));
// ---- a figure: pos (metres, Y up, +Z front), tris, the strongest bone per vertex
const P = [], T = [], names = [];
function sphere(c, r, sx, bone, rings, segs) {   // a UV sphere, sx = its x / z stretch
  const o = P.length / 3, R = rings || 16, S = segs || 24;
  for (let i = 0; i <= R; i++) for (let j = 0; j < S; j++) { const th = Math.PI * i / R, ph = 2 * Math.PI * j / S; P.push(c[0] + r * sx * Math.sin(th) * Math.cos(ph), c[1] + r * Math.cos(th), c[2] + r * sx * Math.sin(th) * Math.sin(ph)); names.push(typeof bone === "function" ? bone(c[1] + r * Math.cos(th)) : bone); }
  for (let i = 0; i < R; i++) for (let j = 0; j < S; j++) { const a = o + i * S + j, b = o + i * S + (j + 1) % S, cc = a + S, d = b + S; T.push(a, cc, b, b, cc, d); }
  return o;
}
function tube(y0, y1, r, bone, rings, segs) {
  const o = P.length / 3, R = rings || 8, S = segs || 24;
  for (let i = 0; i <= R; i++) for (let j = 0; j < S; j++) { const y = y0 + (y1 - y0) * i / R, ph = 2 * Math.PI * j / S; P.push(r * Math.cos(ph), y, r * Math.sin(ph)); names.push(bone(y)); }
  for (let i = 0; i < R; i++) for (let j = 0; j < S; j++) { const a = o + i * S + j, b = o + i * S + (j + 1) % S, cc = a + S, d = b + S; T.push(a, cc, b, b, cc, d); }
}
tube(1.0, 1.55, 0.06, (y) => (y < 1.42 ? "chest" : "neck1"), 11);                 // the body + the neck (a tube)
const head0 = P.length / 3; sphere([0, 1.66, 0], 0.1, 1, (y) => (y < 1.575 ? "neck2" : "head"));   // the head (its bottom on the neck)
const eye0 = P.length / 3; sphere([0.03, 1.68, 0.075], 0.012, 1, "l_eye", 6, 8);   // an eyeball inside the front of the head
const n = P.length / 3, pos = Float64Array.from(P), tris = Uint32Array.from(T);

// ---- the mask
const mask = HF.headMask(names, tris);
const avg = (from, to, f) => { let s = 0, k = 0; for (let i = from; i < to; i++) if (!f || f(i)) { s += mask[i]; k++; } return k ? s / k : 0; };
check("headMask: the head 1, the eyeball inside it 0, the chest 0, the neck in between (blended toward the head)",
  avg(head0, eye0, (i) => names[i] === "head") === 1 && avg(eye0, n) === 0 && avg(0, head0, (i) => names[i] === "chest" && pos[i * 3 + 1] < 1.3) === 0 && avg(head0, eye0, (i) => names[i] === "neck2") > 0 && avg(head0, eye0, (i) => names[i] === "neck2") < 1, { neck: avg(head0, eye0, (i) => names[i] === "neck2") });
check("…bone names the Daz way (lEye, rEye, Head, upperJaw, tongue01) read the same; bare() drops the side", HF.headMask(["Head", "lEye", "tongue01", "upperJaw", "lBrowInner", "pelvis"], new Uint32Array(0), 0).join() === "1,0,0,1,1,0" && HF.bare("lBrowInner") === "browinner");
const box = HF.headBox(pos, mask);
check("headBox: the head's own vertices only (top 1.76 m, about 0.2 m wide)", box && Math.abs(box.mx[1] - 1.76) < 0.005 && Math.abs(box.mx[0] - box.mn[0] - 0.2) < 0.01, box);

// ---- the scan: the head 20 % wider (x / z), in CENTIMETRES, standing somewhere else (a head-only scan) + a bust version
const scan = (bust) => { const keep = { P: P.length, T: T.length, N: names.length }; const p0 = P.length / 3;
  sphere([50, 300, -20], 10, 1.2, "x", 20, 32); if (bust) { const o = P.length / 3; for (let i = 0; i <= 4; i++) for (let j = 0; j < 32; j++) { const ph = 2 * Math.PI * j / 32; P.push(50 + 22 * Math.cos(ph), 280 - i * 4, -20 + 12 * Math.sin(ph)); } for (let i = 0; i < 4; i++) for (let j = 0; j < 32; j++) { const a = o + i * 32 + j, b = o + i * 32 + (j + 1) % 32; T.push(a, a + 32, b, b, a + 32, b + 32); } }
  const sp = Float64Array.from(P.slice(p0 * 3)), st = Uint32Array.from(T.slice(keep.T).map((x) => x - p0)); P.length = keep.P; T.length = keep.T; names.length = keep.N; return { pos: sp, tris: st }; };
const S1 = scan(false), al = HF.alignHead(S1.pos, box, false), sp = BF.applyAlign(S1.pos, al);
const sb = { mn: [Infinity, Infinity, Infinity], mx: [-Infinity, -Infinity, -Infinity] }; for (let i = 0; i < sp.length; i++) { const a = i % 3; sb.mn[a] = Math.min(sb.mn[a], sp[i]); sb.mx[a] = Math.max(sb.mx[a], sp[i]); }
const hh = box.mx[1] - box.mn[1];
check("alignHead: the scan's top on the head's top, as tall as the head (cm -> m), centred, its front on the face's front", Math.abs(al.s - hh / 20) < 0.0002 && Math.abs(sb.mx[1] - box.mx[1]) < 1e-6 && Math.abs((sb.mn[0] + sb.mx[0]) / 2) < 0.002 && Math.abs(sb.mx[2] - box.mx[2]) < 1e-6, { s: al.s, top: sb.mx[1], z: [sb.mx[2], box.mx[2]] });
const S2 = scan(true), al2 = HF.alignHead(S2.pos, box, false);
check("…a BUST scan (head + wide shoulders below): its head band found from the top - the same scale as the head-only scan (±12 %)", Math.abs(al2.s / al.s - 1) < 0.12, { bust: al2.s, head: al.s, band: al2.band });

// ---- the wrap: only the head follows
const r = HF.wrapHead({ pos, tris, mask, scan: { pos: sp, tris: S1.tris } });
const width = (Q, from, to) => { let mn = Infinity, mx = -Infinity; for (let i = from; i < to; i++) if (names[i] === "head" && Math.abs(Q[i * 3 + 1] - 1.66) < 0.02) { mn = Math.min(mn, Q[i * 3]); mx = Math.max(mx, Q[i * 3]); } return mx - mn; };
let chestMoved = 0, eyeMoved = 0; for (let i = 0; i < n; i++) { const d = Math.hypot(r.pos[i * 3] - pos[i * 3], r.pos[i * 3 + 1] - pos[i * 3 + 1], r.pos[i * 3 + 2] - pos[i * 3 + 2]); if (names[i] === "chest" && pos[i * 3 + 1] < 1.3) chestMoved = Math.max(chestMoved, d); if (i >= eye0) eyeMoved = Math.max(eyeMoved, d); }
const w0 = width(pos, head0, eye0), w1 = width(r.pos, head0, eye0);
const target = 24 * al.s;   // the scan's width (24 cm) at the figure's scale
check("wrapHead: the head widened to the scan's width (within 8 mm), the chest and the eyeball not moved", w1 > w0 + 0.012 && Math.abs(w1 - target) < 0.008 && chestMoved < 1e-9 && eyeMoved < 1e-9, { w0, w1, target, chestMoved, eyeMoved });

// ---- the wiring
const RB = src("routes/dazBody.js"), DT = src("ext/pushpulldock/ppdaztools.js"), DF = src("lib/dazFace.js"), DL = src("routes/dazLibrary.js");
check("POST /api/dazlib/head/wrap: the figure + its dials + its other custom morphs (📷 B's) as the base, maskOf / headBox / alignHead / wrapHead, a custom morph (head: true)",
  /app\.post\("\/api\/dazlib\/head\/wrap"/.test(RB) && /BF\.readMorph\(nm\)/.test(RB) && /HF\.maskOf\(fig, n, body\.tris\)/.test(RB) && /HF\.alignHead\(scan\.pos, box, !!b\.turn\)/.test(RB) && /head: true, made: Date\.now\(\)/.test(RB));
check("🙂 Head ▸ a 3D head from the close-up: the scan job (/api/dazlib/body/scan), waitScan, /head/wrap, the morph added; the face then only painted (head false -> no proportion warp)",
  /value="scan3d"/.test(DT) && /head === "scan3d" && c\.face/.test(DT) && /await waitScan\(hj\.job/.test(DT) && /jpost\("\/api\/dazlib\/head\/wrap"/.test(DT) && /c\.face\.head = false;/.test(DT)
  && /head: c\.face\.head !== false/.test(DT) && /head: b\.face\.head !== false/.test(DL) && /const k = ctx\.head === false \? 1 :/.test(DF));
check("👤 Make this person with Shift (scan + wrap) makes the 3D head too when there is a face close-up", /\$\("dzHead"\)\.value = pr\.face \? \(route === "B" \? "scan3d" : "close"\) : "photo";/.test(DT));
const D = require(path.join(ROOT, "ext/pushpulldock/ppdaztools.js")), cs = D.cleanScene({ chars: [{ id: "a", fig: { rel: "x.duf" }, fromRefs: [{ url: "data:xx", name: "me.png" }], face: { picture: "f.png", head: false } }] }).chars[0];
check("cleanScene keeps fromRefs (2.999.0's 👤 over a reload - no data: urls) and face.head false", cs.fromRefs.length === 1 && cs.fromRefs[0].url === "" && cs.fromRefs[0].name === "me.png" && cs.face.head === false);
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
