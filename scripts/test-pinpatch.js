// scripts/test-pinpatch.js — 2.465.0: PUPPET PIN DEPTH + ROTATION (ext/imageeditdock/pcmesh.js) and the PATCH tool's
// Normal (Diffusion, Transparent) / Content-Aware (Structure, Color) modes (pcretouch.js) - the pure part + the wiring.
// Tim: "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor" - the gap
// rows that came with it.
"use strict";
const fs = require("fs"), path = require("path");
const X = require("../ext/imageeditdock/pcmesh.js");
const R = require("../ext/imageeditdock/pcretouch.js");
const ROOT = path.join(__dirname, "..");
let fail = 0;
const check = (name, ok, extra) => { console.log((ok ? "ok   " : "FAIL ") + name + (ok || extra === undefined ? "" : " " + JSON.stringify(extra).slice(0, 600))); if (!ok) fail++; };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

/* ---- pin rotation */
const box = { x: 0, y: 0, w: 400, h: 100 };
const bar = [{ x: 20, y: 50, X: 20, Y: 50 }, { x: 200, y: 50, X: 200, Y: 50 }, { x: 380, y: 50, X: 380, Y: 50 }];
let c = X.pinControls(box, bar);
check("pinControls: Auto pins are just the pins", c.p.length === 3 && c.q.length === 3);
const turned = bar.map((p, i) => (i === 1 ? Object.assign({}, p, { a: Math.PI / 2 }) : p));
c = X.pinControls(box, turned);
check("...a pin with a FIXED rotation adds 4 controls round it, turned by its angle", c.p.length === 7 && near(c.q[2][0], 200) && near(c.q[2][1], 70));   // r = 5% of the larger side (20)
const at = (pins, v) => { const k = X.pinControls(box, pins); return X.mlsRigid(k.p, k.q, v); };
const a0 = at(bar, [205, 50]), a1 = at(turned, [205, 50]);
check("the bar's middle with Auto pins (none moved): stays; turned 90° (Fixed): a point 5 right of the pin goes 5 below it", near(a0[0], 205, 1e-6) && near(a0[1], 50, 1e-6) && Math.abs(a1[0] - 200) < 2 && Math.abs(a1[1] - 55) < 2, { a0, a1 });
const sb = { x: 0, y: 0, w: 100, h: 100 }, m0 = X.puppetMesh(sb, [{ x: 10, y: 50, X: 10, Y: 50 }, { x: 50, y: 50, X: 50, Y: 50, a: Math.PI / 2 }, { x: 90, y: 50, X: 90, Y: 50 }], 10);
check("puppetMesh: the rotation is in the mesh (the vertex 10 right of the pin turns down toward 10 below it); no depth = no z", !m0.z && m0.dst.some((d, k) => near(m0.src[k][0] * 100, 60) && near(m0.src[k][1] * 100, 50) && d[1] > 56 && d[0] < 57), m0.dst.filter((d, k) => near(m0.src[k][1] * 100, 50)).map((d) => d.map(Math.round)));

/* ---- pin depth */
const fold = [{ x: 50, y: 50, X: 300, Y: 50, z: 1 }, { x: 350, y: 50, X: 100, Y: 50, z: -1 }, { x: 200, y: 20, X: 200, Y: 20 }];
const m1 = X.puppetMesh(box, fold, 8);
check("PIN DEPTH: the mesh gets a depth per vertex (inverse distance^4 to the pins' rest places): near the +1 pin ~1, near the -1 pin ~-1", m1.z && m1.z.length === 81 && m1.z[X.gridMesh(8, () => 0).src.findIndex((s) => near(s[0], 1 / 8) && near(s[1], 4 / 8))] > 0.9 && m1.z[X.gridMesh(8, () => 0).src.findIndex((s) => near(s[0], 7 / 8) && near(s[1], 4 / 8))] < -0.9, m1.z && m1.z.slice(36, 45).map((v) => Math.round(v * 100) / 100));
const tris = X.meshTris(m1), zt = (t) => (m1.z[t[0]] + m1.z[t[1]] + m1.z[t[2]]) / 3;
check("meshTris: all 128 triangles, drawn from the deepest up (the +1 pin's part last = on top where it folds)", tris.length === 128 && tris.every((t, i) => i === 0 || zt(tris[i - 1]) <= zt(t) + 1e-12) && zt(tris[127]) > 0.5 && zt(tris[0]) < -0.5);
// drawMesh follows that order (a recording context)
const calls = [];
const g = { save() {}, restore() {}, beginPath() {}, moveTo(x, y) { calls.push([x, y]); }, lineTo() {}, closePath() {}, clip() {}, transform() {}, drawImage() {} };
X.drawMesh(g, { width: 400, height: 100 }, m1, box);
const first = calls[0], last = calls[calls.length - 1];
check("drawMesh with depth: the -1 pin's side drawn first, the +1 pin's side (now on the right, folded over) last", calls.length === 128 && first[0] < 200 && last[0] > 200, { first, last });
const flat = X.puppetMesh(box, bar, 8), calls2 = [];
X.drawMesh(Object.assign({}, g, { moveTo(x, y) { calls2.push([x, y]); } }), { width: 400, height: 100 }, flat, box);
check("...without depth: row by row as before", calls2.length === 128 && near(calls2[0][1], 0, 1) && calls2[127][1] > 80);

/* ---- grownMask / distTo */
const W = 120, H = 80, dot = new Uint8Array(W * H); dot[40 * W + 60] = 255;
const gm = R.grownMask(dot, W, H, 10), n = gm.reduce((t, v) => t + (v ? 1 : 0), 0);
check("grownMask: a dot grown by 10 px covers about π·10² (chamfer distance) and nothing 12 px away", n > 280 && n < 380 && !gm[40 * W + 73] && gm[40 * W + 69], n);

/* ---- patch Normal: Diffusion + Transparent */
const w = 200, h = 120, dst = new Uint8ClampedArray(w * h * 4), src = new Uint8ClampedArray(w * h * 4), mask = new Uint8Array(w * h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, v = x < 100 ? 50 : 150; dst[i] = dst[i + 1] = dst[i + 2] = v; dst[i + 3] = 255; src[i] = src[i + 1] = src[i + 2] = 200; src[i + 3] = 255; if (x > 5 && x < 194 && y > 5 && y < 114) mask[y * w + x] = 255; }
const d1 = R.patchNormal(dst, w, h, mask, src, { diffusion: 1 }), d7 = R.patchNormal(dst, w, h, mask, src, { diffusion: 7 });
const px = (a, x, y) => a[(y * w + x) * 4];
check("Normal patch, Diffusion: 1 = the edge's light barely spreads in (the left inside ~ the mean 100), 7 = it spreads all the way (the left inside toward the dark edge's 50)", px(d1, 50, 60) > 90 && px(d7, 50, 60) < px(d1, 50, 60) - 15 && px(d7, 50, 60) < 80, { d1: px(d1, 50, 60), d7: px(d7, 50, 60) });
const tr = R.patchNormal(dst, w, h, mask, src, { diffusion: 7, transparent: true });
check("...Transparent: half the patch over what was there", near(px(tr, 150, 60), (px(d7, 150, 60) + 150) / 2, 1.01) && px(tr, 2, 2) === 50);

/* ---- patch Content-Aware: Structure + Color */
const W2 = 160, H2 = 100, img = new Uint8ClampedArray(W2 * H2 * 4), hole = new Uint8Array(W2 * H2), nearM = new Uint8Array(W2 * H2);
for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
  const i = (y * W2 + x) * 4;
  // left: VERTICAL stripes; right (x >= 100): HORIZONTAL stripes; a red blemish on the left
  const v = x < 100 ? ((x >> 2) % 2 ? 210 : 90) : ((y >> 2) % 2 ? 210 : 90);
  img[i] = img[i + 1] = img[i + 2] = v; img[i + 3] = 255;
  if (x >= 40 && x < 60 && y >= 40 && y < 60) { hole[y * W2 + x] = 255; img[i] = 255; img[i + 1] = img[i + 2] = 0; }
  if (x >= 120 && x < 140 && y >= 40 && y < 60) nearM[y * W2 + x] = 255;
}
const stripes = (o) => { let gx = 0, gy = 0; for (let y = 42; y < 58; y++) for (let x = 42; x < 58; x++) { const i = (y * W2 + x) * 4; gx += Math.abs(o[i] - o[i + 4]); gy += Math.abs(o[i] - o[i + W2 * 4]); } return { gx, gy }; };
const s7 = R.patchCA(img, W2, H2, hole, nearM, { structure: 7, color: 0 }), s1 = R.patchCA(img, W2, H2, hole, nearM, { structure: 1, color: 0 });
const k7 = stripes(s7), k1 = stripes(s1);
const red = (o) => { let r = 0; for (let y = 40; y < 60; y++) for (let x = 40; x < 60; x++) { const i = (y * W2 + x) * 4; if (o[i] > 200 && o[i + 1] < 60) r++; } return r; };
check("Content-Aware patch: the blemish gone either way; Structure 7 = rebuilt from where it was dragged (horizontal stripes: the up-down change wins), Structure 1 = from round it too (more of the vertical stripes)", red(s7) === 0 && red(s1) === 0 && k7.gy > k7.gx * 1.5 && k1.gx / Math.max(1, k1.gy) > k7.gx / Math.max(1, k7.gy), { k7, k1 });
// Color: a dark source on a light picture
const img2 = new Uint8ClampedArray(W2 * H2 * 4);
for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { const i = (y * W2 + x) * 4, v = x >= 100 ? 40 + ((x + y) % 5) * 4 : 200 + ((x + y) % 5) * 4; img2[i] = img2[i + 1] = img2[i + 2] = v; img2[i + 3] = 255; }
const mean = (o) => { let t = 0, q = 0; for (let y = 44; y < 56; y++) for (let x = 44; x < 56; x++) { t += o[(y * W2 + x) * 4]; q++; } return t / q; };
const c0 = R.patchCA(img2, W2, H2, hole, nearM, { structure: 7, color: 0 }), c10 = R.patchCA(img2, W2, H2, hole, nearM, { structure: 7, color: 10 });
check("Color 0 = the dark texture as it is; Color 10 = blended to the light picture round it", mean(c0) < 80 && mean(c10) > 150, { c0: mean(c0), c10: mean(c10) });

/* ---- the wiring */
const WP = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/pcwarp.js"), "utf8"), HE = fs.readFileSync(path.join(ROOT, "ext/imageeditdock/pcheal.js"), "utf8");
check("wiring: Puppet Warp's options - Pin Depth ⬆ / ⬇ (#ppFwd #ppBack), Rotate Auto / Fixed + the angle (#ppRot #ppAng), Alt-drag near the picked pin turns it", /id="ppFwd"/.test(WP) && /id="ppBack"/.test(WP) && /id="ppRot"/.test(WP) && /id="ppAng"/.test(WP) && /pdrag = \{ rot: PP\.sel/.test(WP) && /function setPin\(ch\)/.test(WP));
check("wiring: Patch Normal / Content-Aware (#ptPType), Structure + Color (#ptPSt #ptPCol), Diffusion + Transparent (#ptPDif #ptPTr); Content-Aware Move's Structure + Color (#ptMSt #ptMCol); R.patchCA / R.patchNormal used", ["ptPType", "ptPSt", "ptPCol", "ptPDif", "ptPTr", "ptMSt", "ptMCol"].every((id) => HE.includes(`"${id}"`) || HE.includes(`id="${id}"`)) && /R\.patchCA\(/.test(HE) && /R\.patchNormal\(/.test(HE));

console.log(fail ? `\n${fail} FAILED` : "\nall pin + patch checks passed");
process.exit(fail ? 1 : 0);
