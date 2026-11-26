// bitGen Studio — lib/dazFace.js (2.977.0): 📷 A FACE FROM A PHOTO onto a Daz figure (light, FaceGen-like - NOT Daz Studio's
// own Face Transfer, which is far more complete). Tim: "build steps 1-4" (step 4 of the Daz library plan).
//   landmarks (0..1000 in the photo, from the Vision model - routes/dazLibrary.js asks it): {left_eye, right_eye, mouth, chin}
//   1 the figure's eyes = its eye bones (l_eye / lEye ...), its chin = the lowest front head vertex under the eyes
//   2 the proportion: the face below the eyes scaled (smoothly, front of the head only) so eyes -> chin matches the photo's
//     eyes -> chin for the same eye distance
//   3 the picture: every face / head texture texel whose 3D point faces forward is looked up in the photo (the eyes and chin
//     line them up) and blended in (feathered by how much it faces the camera and how far from the face's middle), colour-
//     matched to the skin around it -> a new PNG for that material (writeGlb uses it)
//   pure parts (tests): eyeBones, similarity, faceWarp, blendWeight, parseLandmarks
"use strict";
const { spawnSync } = require("child_process");
const fs = require("fs");

function parseLandmarks(text) {
  let t = String(text || "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(json)?/g, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}"); if (a < 0 || b <= a) return null;
  let j; try { j = JSON.parse(t.slice(a, b + 1)); } catch { return null; }
  const pt = (v) => (Array.isArray(v) && v.length >= 2 && v.every((x) => isFinite(+x)) ? [+v[0], +v[1]].map((x) => (x <= 1.0001 ? x * 1000 : x)) : null);
  const o = { left_eye: pt(j.left_eye), right_eye: pt(j.right_eye), mouth: pt(j.mouth), chin: pt(j.chin) };
  return o.left_eye && o.right_eye && o.chin ? o : null;
}
function eyeBones(bones) {
  const f = (rx) => bones.find((b) => rx.test(b.id) || rx.test(b.name));
  const l = f(/^(l_?eye|lEye|left_?eye)$/i), r = f(/^(r_?eye|rEye|right_?eye)$/i);
  return l && r ? { l: l.center.map((x) => x * 0.01), r: r.center.map((x) => x * 0.01) } : null;
}
/** a 2D similarity mapping two points onto two points: p -> s R p + t */
function similarity(a1, a2, b1, b2) {
  const ax = a2[0] - a1[0], ay = a2[1] - a1[1], bx = b2[0] - b1[0], by = b2[1] - b1[1];
  const la = Math.hypot(ax, ay) || 1e-9, s = Math.hypot(bx, by) / la, ang = Math.atan2(by, bx) - Math.atan2(ay, ax), c = Math.cos(ang) * s, sn = Math.sin(ang) * s;
  const tx = b1[0] - (c * a1[0] - sn * a1[1]), ty = b1[1] - (sn * a1[0] + c * a1[1]);
  return (p) => [c * p[0] - sn * p[1] + tx, sn * p[0] + c * p[1] + ty];
}
/** scale the face below the eyes: y' = eyeY - (eyeY - y) * k, weighted by front-ness and distance from the face's middle */
function faceWarp(pos, eye, chinY, k, radius, frontZ) {
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    if (y > eye[1] || z < frontZ) continue;
    const r = Math.hypot(x - eye[0], (y - (eye[1] + chinY) / 2) * 0.8) / radius; if (r >= 1) continue;
    const w = (1 - r * r) * (1 - r * r);
    pos[i + 1] = y + ((eye[1] - (eye[1] - y) * k) - y) * w;
  }
}
function blendWeight(nz, r) { if (nz <= 0.15 || r >= 1) return 0; const a = Math.min(1, (nz - 0.15) / 0.5), b = r < 0.75 ? 1 : (1 - r) / 0.25; return a * a * b; }

function readRgba(file, maxW) {
  const pr = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", file], { encoding: "utf8" });
  const m = /(\d+)x(\d+)/.exec(pr.stdout || ""); if (!m) throw new Error("could not read " + file);
  let w = +m[1], h = +m[2]; if (maxW && w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `scale=${w}:${h}`, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0 || r.stdout.length !== w * h * 4) throw new Error("could not read the pixels of " + file);
  return { w, h, d: r.stdout };
}
function pngOf(img) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", img.w + "x" + img.h, "-i", "-", "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], { input: img.d, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error("could not write the face texture");
  return r.stdout;
}

/** ctx = {pieces, M, bones, photo, landmarks, maxTex} -> {textures: {key: {data, mime}}, summary} (M[0].shaped is warped) */
async function apply(ctx) {
  const L = ctx.landmarks; if (!L) throw new Error("no face found in the photo (the Vision model gave no eyes / chin)");
  const E = eyeBones(ctx.bones); if (!E) throw new Error("this figure has no eye bones - the face step needs them");
  const body = ctx.M[0], P = body.shaped, eye = [(E.l[0] + E.r[0]) / 2, (E.l[1] + E.r[1]) / 2, (E.l[2] + E.r[2]) / 2], ed = Math.hypot(E.l[0] - E.r[0], E.l[1] - E.r[1]);
  // the chin: the lowest vertex in front of the head, near the middle, within 3 eye distances below the eyes
  let chinY = eye[1] - 1.9 * ed;
  for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i] - eye[0]) < ed * 0.25 && P[i + 2] > eye[2] - ed * 0.2 && P[i + 1] < eye[1] && P[i + 1] > eye[1] - 3 * ed && P[i + 1] < chinY + 0.5 * ed) chinY = Math.min(chinY, P[i + 1]);
  // the photo (y down) -> the model's front plane (y up): the eyes line up (the figure's LEFT eye is at +x, the photo's left eye is the person's left = image right)
  const ph = (p) => [p[0], -p[1]];
  const toModel = similarity(ph(L.left_eye), ph(L.right_eye), [E.l[0], E.l[1]], [E.r[0], E.r[1]]);
  const chinM = toModel(ph(L.chin));
  const k = Math.max(0.8, Math.min(1.25, (eye[1] - chinM[1]) / Math.max(1e-6, eye[1] - chinY)));
  faceWarp(P, eye, chinY, k, 2.2 * ed, eye[2] - ed * 0.6);
  const newChin = eye[1] - (eye[1] - chinY) * k;
  // the texture: the head / face material(s) of the body
  const toPhoto = similarity([E.l[0], E.l[1]], [E.r[0], E.r[1]], ph(L.left_eye), ph(L.right_eye));
  const photo = readRgba(ctx.photo, 1600), pw = photo.w / 1000, phh = photo.h / 1000;
  const p0 = ctx.pieces[0], textures = {}, done = [];
  const nrm = require("./clothSim").vertexNormals(P, [].concat(...[...body.byMat.values()]).map((c) => body.src[c]));
  const radius = 1.15 * (eye[1] - newChin + ed);
  for (const [gi, tris] of body.byMat) {
    const gname = body.mats[gi] || ""; if (!/face|head/i.test(gname)) continue;
    const texFile = require("./dazLib").textureOf(p0.mats, gname, p0.file); if (!texFile) continue;
    const tex = readRgba(texFile, Math.min(4096, +ctx.maxTex || 2048));
    let sumT = [0, 0, 0], sumP = [0, 0, 0], nS = 0; const hits = [];
    for (let t = 0; t < tris.length; t += 3) {
      const c = [tris[t], tris[t + 1], tris[t + 2]], v = c.map((q) => body.src[q]);
      if (!v.some((q) => P[q * 3 + 2] > eye[2] - ed && P[q * 3 + 1] < eye[1] + 1.5 * ed && P[q * 3 + 1] > newChin - 0.3 * ed)) continue;
      const uv = c.map((q) => body.UV[body.uvi[q]] || [0, 0]).map((u) => [u[0] * tex.w, (1 - u[1]) * tex.h]);
      const x0 = Math.max(0, Math.floor(Math.min(uv[0][0], uv[1][0], uv[2][0]))), x1 = Math.min(tex.w - 1, Math.ceil(Math.max(uv[0][0], uv[1][0], uv[2][0])));
      const y0 = Math.max(0, Math.floor(Math.min(uv[0][1], uv[1][1], uv[2][1]))), y1 = Math.min(tex.h - 1, Math.ceil(Math.max(uv[0][1], uv[1][1], uv[2][1])));
      const den = (uv[1][1] - uv[2][1]) * (uv[0][0] - uv[2][0]) + (uv[2][0] - uv[1][0]) * (uv[0][1] - uv[2][1]); if (!den) continue;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const a = ((uv[1][1] - uv[2][1]) * (x + 0.5 - uv[2][0]) + (uv[2][0] - uv[1][0]) * (y + 0.5 - uv[2][1])) / den, b = ((uv[2][1] - uv[0][1]) * (x + 0.5 - uv[2][0]) + (uv[0][0] - uv[2][0]) * (y + 0.5 - uv[2][1])) / den, g = 1 - a - b;
        if (a < -0.01 || b < -0.01 || g < -0.01) continue;
        const X = a * P[v[0] * 3] + b * P[v[1] * 3] + g * P[v[2] * 3], Y = a * P[v[0] * 3 + 1] + b * P[v[1] * 3 + 1] + g * P[v[2] * 3 + 1];
        const nz = a * nrm[v[0] * 3 + 2] + b * nrm[v[1] * 3 + 2] + g * nrm[v[2] * 3 + 2];
        const w = blendWeight(nz, Math.hypot(X - eye[0], Y - (eye[1] + newChin) / 2) / radius); if (!w) continue;
        const q = toPhoto([X, Y]), px = Math.round(q[0] * pw), py = Math.round(-q[1] * phh);
        if (px < 0 || py < 0 || px >= photo.w || py >= photo.h) continue;
        const ti = (y * tex.w + x) * 4, pi = (py * photo.w + px) * 4;
        hits.push(ti, pi, w);
        for (let k2 = 0; k2 < 3; k2++) { sumT[k2] += tex.d[ti + k2]; sumP[k2] += photo.d[pi + k2]; } nS++;
      }
    }
    if (!nS) continue;
    const gain = sumT.map((s2, i) => Math.max(0.6, Math.min(1.6, s2 / Math.max(1, sumP[i]))));   // the photo's colour moved to the skin's
    for (let h = 0; h < hits.length; h += 3) { const ti = hits[h], pi = hits[h + 1], w = hits[h + 2]; for (let k2 = 0; k2 < 3; k2++) tex.d[ti + k2] = Math.round(tex.d[ti + k2] * (1 - w) + Math.min(255, photo.d[pi + k2] * gain[k2]) * w); }
    textures[p0.file + "|" + gname] = { data: pngOf(tex), mime: "image/png" };
    done.push(gname + " (" + nS + " texels)");
  }
  return { textures, summary: { chin_scale: +k.toFixed(3), materials: done } };
}

module.exports = { parseLandmarks, eyeBones, similarity, faceWarp, blendWeight, apply, readRgba };
