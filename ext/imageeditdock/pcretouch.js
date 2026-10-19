/* pcretouch.js — THE IMAGE EDITOR'S RETOUCHING MATHS (2.423.0), window.PCRetouch.
 *
 * Tim (verbatim): "can we close the gap with 1,2,3,4 and 5 first" - gap 5 of the Photoshop list: patch, content-aware
 * move, red eye, a non-AI content-aware fill, mixer brush, background / magic eraser, true healing. The tools are in
 * pcheal.js; this file is pure (Node: scripts/test-psrefine.js):
 *
 *   poisson(dst, src, mask, w, h, opts)      SEAMLESS (gradient-domain) blending - Pérez, Gangnet, Blake 2003: inside
 *                                            the mask the result has src's texture (its gradients) and meets dst at the
 *                                            mask's edge (dst's colours there) - the Healing Brush / Patch / Move
 *   inpaint(rgba, w, h, hole, opts)          CONTENT-AWARE FILL without AI: multi-scale PatchMatch (Barnes et al. 2009)
 *                                            + voting (Wexler, Shechtman, Irani 2007), the source near the hole
 *   redEye(rgba, w, h, x, y, opts)           the red pupil round a click found (redness, connected) and darkened
 *   bgEraseDab(rgba, w, h, x, y, r, sample, tol, protect)   BACKGROUND ERASER: what is near the sampled colour goes
 *   mixColor(brush, canvas, wet, mix)        the MIXER BRUSH's colour: the brush's paint picks up the canvas's
 *   2.465.0 (Tim: "continue with the photoshop gap closure..."):
 *   patchCA(rgba, w, h, hole, near, opts)    the PATCH tool's CONTENT-AWARE mode: the hole filled by PatchMatch from
 *                                            near the place it was dragged to - opts.structure 1-7 (7 = only from there,
 *                                            bigger patches: its pattern kept; 1 = from anywhere round it) and
 *                                            opts.color 0-10 (0 = its colours as they are; 10 = fully blended in)
 *   patchNormal(rgba, w, h, mask, src, opts) the Normal mode's Diffusion 1-7 (how far the light / colour of the edge
 *                                            spreads in) and Transparent (the texture over what was there)
 *   grownMask(mask, w, h, r)                 mask grown by r px (a chamfer distance - any r at one cost)
 */
(function (root) {
  "use strict";
  function bboxOf(mask, w, h, pad) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const p = pad || 0;
    return { x: Math.max(0, x0 - p), y: Math.max(0, y0 - p), w: Math.min(w, x1 + 1 + p) - Math.max(0, x0 - p), h: Math.min(h, y1 + 1 + p) - Math.max(0, y0 - p) };
  }
  /** poisson blend in place of a COPY of dst: inside mask (>127) solve lap(f) = lap(src), f = dst outside. src and dst
   *  are the same size (src already shifted to where it goes). iters: SOR sweeps (multi-resolution start) */
  function poisson(dst, src, mask, w, h, opts) {
    const o = Object.assign({ iters: 400, omega: 1.9 }, opts || {});
    const out = Uint8ClampedArray.from(dst), b = bboxOf(mask, w, h, 1); if (!b) return out;
    const bw = b.w, bh = b.h, n = bw * bh, M = new Uint8Array(n);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const X = b.x + x, Y = b.y + y;
      M[y * bw + x] = mask[Y * w + X] > 127 && X > 0 && Y > 0 && X < w - 1 && Y < h - 1 ? 1 : 0;
    }
    for (let c = 0; c < 3; c++) {
      const f = new Float32Array(n), g = new Float32Array(n), lap = new Float32Array(n);
      let ds = 0, ss = 0, cnt = 0;
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const i = y * bw + x, P = ((b.y + y) * w + b.x + x) * 4;
        g[i] = src[P + c]; f[i] = dst[P + c];
        // the mean difference on the boundary: a good start (the solve then only fixes the low frequencies)
        if (!M[i] && ((x > 0 && M[i - 1]) || (x < bw - 1 && M[i + 1]) || (y > 0 && M[i - bw]) || (y < bh - 1 && M[i + bw]))) { ds += dst[P + c]; ss += src[P + c]; cnt++; }
      }
      const off = cnt ? (ds - ss) / cnt : 0;
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const i = y * bw + x; if (!M[i]) continue;
        lap[i] = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - bw] - g[i + bw];
        f[i] = g[i] + off;
      }
      for (let it = 0; it < o.iters; it++) {
        let maxd = 0;
        for (let y = 1; y < bh - 1; y++) for (let x = 1; x < bw - 1; x++) {
          const i = y * bw + x; if (!M[i]) continue;
          const v = (f[i - 1] + f[i + 1] + f[i - bw] + f[i + bw] + lap[i]) / 4, d = v - f[i];
          f[i] += o.omega * d; if (Math.abs(d) > maxd) maxd = Math.abs(d);
        }
        if (maxd < 0.05) break;
      }
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = y * bw + x; if (M[i]) out[((b.y + y) * w + b.x + x) * 4 + c] = f[i]; }
    }
    return out;
  }

  /* ---------------- content-aware fill: PatchMatch + voting, coarse to fine ---------------- */
  function down2(img, w, h) {           // rgba halved (box), and a hole halved (any hole pixel = hole)
    const W = Math.max(1, w >> 1), H = Math.max(1, h >> 1), o = new Float32Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 4; c++) {
      let s = 0, n = 0; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const X = Math.min(w - 1, 2 * x + dx), Y = Math.min(h - 1, 2 * y + dy); s += img[(Y * w + X) * 4 + c]; n++; }
      o[(y * W + x) * 4 + c] = s / n;
    }
    return { img: o, w: W, h: H };
  }
  function downMask(m, w, h) { const W = Math.max(1, w >> 1), H = Math.max(1, h >> 1), o = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let any = 0; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const X = Math.min(w - 1, 2 * x + dx), Y = Math.min(h - 1, 2 * y + dy); if (m[Y * w + X]) any = 1; } o[y * W + x] = any; } return o; }
  /** fill the hole (mask > 127) of rgba from the rest of it. opts: patch (odd, 7), iters (PatchMatch per EM, 4), em (5),
   *  seed (a number: the same result each time), margin (how far round the hole to take texture from, x its size) */
  function inpaint(rgba, w, h, hole, opts) {
    const o = Object.assign({ patch: 7, iters: 4, em: 5, seed: 7, margin: 2.5 }, opts || {});
    const hb = bboxOf(hole, w, h, 0); if (!hb) return Uint8ClampedArray.from(rgba);
    // work on a window round the hole (texture comes from near it)
    const m = Math.round(Math.max(hb.w, hb.h) * o.margin) + o.patch;
    let wx = Math.max(0, hb.x - m), wy = Math.max(0, hb.y - m), ww = Math.min(w, hb.x + hb.w + m) - wx, wh = Math.min(h, hb.y + hb.h + m) - wy;
    // 2.448.0: opts.sample (w x h, > 127 = where patches may come from - the Content-Aware Fill workspace's sampling
    // area): the window holds the hole AND that area
    const SA = o.sample && o.sample.length === w * h ? o.sample : null;
    if (SA) {
      const sb = bboxOf(SA, w, h, o.patch);
      if (sb) { const x0 = Math.max(0, Math.min(hb.x - o.patch, sb.x)), y0 = Math.max(0, Math.min(hb.y - o.patch, sb.y)), x1 = Math.min(w, Math.max(hb.x + hb.w + o.patch, sb.x + sb.w)), y1 = Math.min(h, Math.max(hb.y + hb.h + o.patch, sb.y + sb.h)); wx = x0; wy = y0; ww = x1 - x0; wh = y1 - y0; }
    }
    let img = new Float32Array(ww * wh * 4), H0 = new Uint8Array(ww * wh), S0 = SA ? new Uint8Array(ww * wh) : null;
    for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) { const s = ((wy + y) * w + wx + x) * 4, d = (y * ww + x) * 4; for (let c = 0; c < 4; c++) img[d + c] = rgba[s + c]; H0[y * ww + x] = hole[(wy + y) * w + wx + x] > 127 ? 1 : 0; if (S0) S0[y * ww + x] = SA[(wy + y) * w + wx + x] > 127 ? 1 : 0; }
    let seed = o.seed >>> 0; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    // the pyramid
    const levels = [{ img, w: ww, h: wh, hole: H0, samp: S0 }];
    while (levels.length < 8) { const L = levels[levels.length - 1], hb2 = bboxOf(L.hole, L.w, L.h, 0); if (!hb2 || Math.max(hb2.w, hb2.h) <= 8 || Math.min(L.w, L.h) <= 2 * o.patch) break; const d = down2(L.img, L.w, L.h); levels.push({ img: d.img, w: d.w, h: d.h, hole: downMask(L.hole, L.w, L.h), samp: L.samp ? downMask(L.samp, L.w, L.h) : null }); }
    const pr = o.patch >> 1;
    let nnf = null, prevW = 0, prevH = 0, est = null;
    for (let li = levels.length - 1; li >= 0; li--) {
      const L = levels[li], W = L.w, Hh = L.h, img0 = L.img, hl = L.hole, sp = L.samp;
      // valid source centres: the whole patch known and inside
      const valid = new Uint8Array(W * Hh);
      const holeD = new Uint8Array(W * Hh);              // the hole grown by the patch radius: those patches touch it
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        let ok = x >= pr && y >= pr && x < W - pr && y < Hh - pr, touch = 0;
        for (let dy = -pr; dy <= pr && (ok || !touch); dy++) for (let dx = -pr; dx <= pr; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= Hh) continue; if (hl[Y * W + X]) { ok = false; touch = 1; } }
        valid[y * W + x] = ok && (!sp || sp[y * W + x]) ? 1 : 0; holeD[y * W + x] = touch;
      }
      const vlist = []; for (let i = 0; i < valid.length; i++) if (valid[i]) vlist.push(i);
      if (!vlist.length) break;
      // the current estimate
      const cur = Float32Array.from(img0);
      if (!est) {                                          // the coarsest: the hole filled by diffusion from its edge
        const known = Uint8Array.from(hl, (v) => (v ? 0 : 1));
        for (let pass = 0; pass < W + Hh; pass++) {
          let left = 0;
          for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
            const i = y * W + x; if (known[i]) continue; let s = [0, 0, 0, 0], n = 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= Hh) continue; const j = Y * W + X; if (known[j] === 1) { for (let c = 0; c < 4; c++) s[c] += cur[j * 4 + c]; n++; } }
            if (n) { for (let c = 0; c < 4; c++) cur[i * 4 + c] = s[c] / n; known[i] = 2; } else left++;
          }
          for (let i = 0; i < known.length; i++) if (known[i] === 2) known[i] = 1;
          if (!left) break;
        }
      } else {                                             // the finer level starts from the coarser result
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!hl[i]) continue; const X = Math.min(prevW - 1, x >> 1), Y = Math.min(prevH - 1, y >> 1); for (let c = 0; c < 4; c++) cur[i * 4 + c] = est[(Y * prevW + X) * 4 + c]; }
      }
      // the NNF over the patches that touch the hole
      const tgt = []; for (let i = 0; i < holeD.length; i++) if (holeD[i]) tgt.push(i);
      const NN = new Int32Array(W * Hh).fill(-1), ND = new Float32Array(W * Hh).fill(Infinity);
      const dist = (p, q, cut) => {
        const px = p % W, py = (p - px) / W, qx = q % W, qy = (q - qx) / W; let d = 0;
        for (let dy = -pr; dy <= pr; dy++) {
          const Y = py + dy; if (Y < 0 || Y >= Hh) continue;
          for (let dx = -pr; dx <= pr; dx++) {
            const X = px + dx; if (X < 0 || X >= W) continue;
            const a = (Y * W + X) * 4, b = ((qy + dy) * W + qx + dx) * 4;
            const e0 = cur[a] - img0[b], e1 = cur[a + 1] - img0[b + 1], e2 = cur[a + 2] - img0[b + 2];
            d += e0 * e0 + e1 * e1 + e2 * e2; if (d > cut) return d;
          }
        }
        return d;
      };
      for (const p of tgt) {
        let q = -1;
        if (nnf) { const px = p % W, py = (p - px) / W, c = nnf.get(((py >> 1) * prevW) + (px >> 1)); if (c != null) { const cx = Math.min(W - 1 - pr, Math.max(pr, (c % prevW) * 2 + (px & 1))), cy = Math.min(Hh - 1 - pr, Math.max(pr, Math.floor(c / prevW) * 2 + (py & 1))), k = cy * W + cx; if (valid[k]) q = k; } }
        if (q < 0) q = vlist[Math.floor(rnd() * vlist.length)];
        NN[p] = q; ND[p] = dist(p, q, Infinity);
      }
      for (let em = 0; em < o.em; em++) {
        for (let it = 0; it < o.iters; it++) {
          const fwd = it % 2 === 0, list = fwd ? tgt : tgt.slice().reverse(), s = fwd ? 1 : -1;
          for (const p of list) {
            const px = p % W, py = (p - px) / W;
            for (const [dx, dy] of [[-s, 0], [0, -s]]) {           // propagation
              const X = px + dx, Y = py + dy; if (X < 0 || Y < 0 || X >= W || Y >= Hh) continue;
              const nb = NN[Y * W + X]; if (nb < 0) continue;
              const c = nb - dx - dy * W, cx = c % W; if (c < 0 || c >= W * Hh || Math.abs(cx - ((nb % W) - dx)) > 0 || !valid[c]) continue;
              const d = dist(p, c, ND[p]); if (d < ND[p]) { ND[p] = d; NN[p] = c; }
            }
            let rad = Math.max(W, Hh);                              // random search round the best so far
            while (rad >= 1) {
              const bq = NN[p], bx = bq % W, by = (bq - bx) / W;
              const X = Math.round(bx + (rnd() * 2 - 1) * rad), Y = Math.round(by + (rnd() * 2 - 1) * rad);
              if (X >= 0 && Y >= 0 && X < W && Y < Hh) { const c = Y * W + X; if (valid[c]) { const d = dist(p, c, ND[p]); if (d < ND[p]) { ND[p] = d; NN[p] = c; } } }
              rad >>= 1;
            }
          }
        }
        // voting: each hole pixel = the mean of what every patch over it says it should be (weighted by match)
        const acc = new Float32Array(W * Hh * 4), wsum = new Float32Array(W * Hh);
        const sig = (() => { const ds = tgt.map((p) => ND[p]).sort((a, b) => a - b); return Math.max(1, ds[Math.floor(ds.length * 0.75)] || 1); })();
        for (const p of tgt) {
          const px = p % W, py = (p - px) / W, q = NN[p], qx = q % W, qy = (q - qx) / W, wt = Math.exp(-ND[p] / (2 * sig));
          for (let dy = -pr; dy <= pr; dy++) for (let dx = -pr; dx <= pr; dx++) {
            const X = px + dx, Y = py + dy; if (X < 0 || Y < 0 || X >= W || Y >= Hh) continue; const i = Y * W + X; if (!hl[i]) continue;
            const b = ((qy + dy) * W + qx + dx) * 4; for (let c = 0; c < 4; c++) acc[i * 4 + c] += img0[b + c] * wt; wsum[i] += wt;
          }
        }
        for (let i = 0; i < W * Hh; i++) if (hl[i] && wsum[i] > 0) for (let c = 0; c < 4; c++) cur[i * 4 + c] = acc[i * 4 + c] / wsum[i];
        for (const p of tgt) ND[p] = dist(p, NN[p], Infinity);
      }
      est = cur; prevW = W; prevH = Hh;
      nnf = new Map(); for (const p of tgt) nnf.set(p, NN[p]);
    }
    const out = Uint8ClampedArray.from(rgba);
    if (est) for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) { const i = y * ww + x; if (!H0[i]) continue; const d = ((wy + y) * w + wx + x) * 4; for (let c = 0; c < 4; c++) out[d + c] = est[i * 4 + c]; }
    return out;
  }

  /* ---------------- red eye ---------------- */
  const redness = (d, i) => { const r = d[i], g = d[i + 1], b = d[i + 2]; return r > 60 ? (r - Math.max(g, b)) / r : 0; };
  /** the red pupil round (x, y) (within r): connected pixels redder than `thr` -> darkened; {rgba, n} */
  function redEye(rgba, w, h, x, y, opts) {
    const o = Object.assign({ r: 40, thr: 0.35, darken: 0.5, pupil: 1 }, opts || {});
    const out = Uint8ClampedArray.from(rgba), cx = Math.round(x), cy = Math.round(y);
    // start from the reddest pixel near the click
    let seed = -1, best = o.thr;
    for (let yy = Math.max(0, cy - 6); yy <= Math.min(h - 1, cy + 6); yy++) for (let xx = Math.max(0, cx - 6); xx <= Math.min(w - 1, cx + 6); xx++) { const v = redness(rgba, (yy * w + xx) * 4); if (v > best) { best = v; seed = yy * w + xx; } }
    if (seed < 0) return { rgba: out, n: 0 };
    const seen = new Uint8Array(w * h), st = [seed]; seen[seed] = 1; const px = [];
    while (st.length) {
      const k = st.pop(), X0 = k % w, Y0 = (k - X0) / w; px.push(k);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const X = X0 + dx, Y = Y0 + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (seen[j]) continue;
        if ((X - cx) ** 2 + (Y - cy) ** 2 > o.r * o.r) continue;
        if (redness(rgba, j * 4) < o.thr * 0.7) continue;
        seen[j] = 1; st.push(j);
      }
    }
    for (const k of px) {
      const i = k * 4, r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], red = Math.min(1, redness(rgba, i) / Math.max(0.01, best));
      const target = (g + b) / 2 * (1 - o.darken);              // the red becomes a dark grey-green-blue mean, darkened
      out[i] = r + (target - r) * red; out[i + 1] = g + (g * (1 - o.darken) - g) * red * 0.6; out[i + 2] = b + (b * (1 - o.darken) - b) * red * 0.6;
    }
    return { rgba: out, n: px.length };
  }

  /* ---------------- the background eraser / the mixer brush ---------------- */
  /** BACKGROUND ERASER dab: inside the disc, alpha down where the colour is within tol of `sample` (soft near tol);
   *  protect = a colour never erased (the foreground). In place; returns how many pixels changed */
  function bgEraseDab(rgba, w, h, x, y, r, sample, tol, protect) {
    let n = 0; const T = Math.max(1, tol), R = Math.max(1, r);
    for (let yy = Math.max(0, Math.floor(y - R)); yy <= Math.min(h - 1, Math.ceil(y + R)); yy++) for (let xx = Math.max(0, Math.floor(x - R)); xx <= Math.min(w - 1, Math.ceil(x + R)); xx++) {
      const d2 = (xx - x) ** 2 + (yy - y) ** 2; if (d2 > R * R) continue;
      const i = (yy * w + xx) * 4; if (!rgba[i + 3]) continue;
      const d = Math.hypot(rgba[i] - sample[0], rgba[i + 1] - sample[1], rgba[i + 2] - sample[2]);
      if (protect && Math.hypot(rgba[i] - protect[0], rgba[i + 1] - protect[1], rgba[i + 2] - protect[2]) < T * 0.6) continue;
      if (d >= T) continue;
      const k = d < T * 0.6 ? 0 : (d - T * 0.6) / (T * 0.4), soft = d2 > R * R * 0.8 ? (R * R - d2) / (R * R * 0.2) : 1;
      const na = rgba[i + 3] * (1 - (1 - k) * Math.max(0, Math.min(1, soft)));
      if (na !== rgba[i + 3]) { rgba[i + 3] = na; n++; }
    }
    return n;
  }
  /** the MIXER BRUSH: the brush's paint after touching `canvas` - wet (0..1) = how much it picks up, mix = the ratio */
  function mixColor(brush, canvas, wet, mix) {
    const k = Math.max(0, Math.min(1, (wet == null ? 0.5 : wet) * (mix == null ? 0.5 : mix)));
    return [brush[0] + (canvas[0] - brush[0]) * k, brush[1] + (canvas[1] - brush[1]) * k, brush[2] + (canvas[2] - brush[2]) * k];
  }

  /* ---------------- 2.465.0: the Patch tool's Normal (Diffusion, Transparent) + Content-Aware (Structure, Color) ---------------- */
  /** the distance (chamfer 3-4, / 3 = px) of every pixel to the mask */
  function distTo(mask, w, h) {
    const INF = 1e9, d = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) d[i] = mask[i] > 127 ? 0 : INF;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 3);
      if (y > 0) { v = Math.min(v, d[i - w] + 3); if (x > 0) v = Math.min(v, d[i - w - 1] + 4); if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4); }
      d[i] = v;
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x; let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + 3);
      if (y < h - 1) { v = Math.min(v, d[i + w] + 3); if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4); if (x > 0) v = Math.min(v, d[i + w - 1] + 4); }
      d[i] = v;
    }
    for (let i = 0; i < w * h; i++) d[i] /= 3;
    return d;
  }
  function grownMask(mask, w, h, r) {
    if (!(r > 0)) return Uint8Array.from(mask, (v) => (v > 127 ? 255 : 0));
    const d = distTo(mask, w, h), o = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) o[i] = d[i] <= r ? 255 : 0;
    return o;
  }
  const clampN = (v, a, b, d) => { const x = Number.isFinite(+v) ? +v : d; return Math.max(a, Math.min(b, x)); };
  /** Content-Aware patch: hole (> 127) filled from `near` (> 127: where it was dragged to) */
  function patchCA(rgba, w, h, hole, near, opts) {
    const o = opts || {}, st = Math.round(clampN(o.structure, 1, 7, 4)), col = clampN(o.color, 0, 10, 0);
    const hb = bboxOf(hole, w, h, 0); if (!hb) return Uint8ClampedArray.from(rgba);
    const size = Math.max(hb.w, hb.h);
    // where patches may come from: the dragged-to place, grown less as Structure rises (7 = just there)
    const reach = Math.round((7 - st) / 6 * size * 1.5) + 2;
    const sample = grownMask(near, w, h, reach);
    for (let i = 0; i < w * h; i++) if (hole[i] > 127) sample[i] = 0;
    if (sample.every((v, i) => !v || hole[i] > 127)) sample.fill(255);       // dragged off the picture: from anywhere
    const base = inpaint(rgba, w, h, hole, { sample, seed: o.seed || 11, patch: st >= 6 ? 11 : st >= 4 ? 9 : 7 });
    if (!col) return base;
    return membrane(base, rgba, hole, w, h, col / 10);
  }
  /** a smooth colour correction inside mask: what the edge differs by (the picture outside - the fill just inside)
   *  spread across the inside (a membrane: Laplace, Dirichlet at the edge), added k (0..1) of it */
  function membrane(base, rgba, mask, w, h, k, iters) {
    const out = Uint8ClampedArray.from(base), b = bboxOf(mask, w, h, 1); if (!b || !(k > 0)) return out;
    const bw = b.w, bh = b.h, n = bw * bh, M = new Uint8Array(n);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) M[y * bw + x] = mask[(b.y + y) * w + b.x + x] > 127 ? 1 : 0;
    const NB = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let c = 0; c < 3; c++) {
      const C = new Float32Array(n), fixed = new Uint8Array(n);
      let sum = 0, cnt = 0;
      // the outside pixels touching the inside: their difference to the fill next to them
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const i = y * bw + x; if (M[i]) continue;
        let s = 0, q = 0;
        for (const [dx, dy] of NB) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= bw || Y >= bh || !M[Y * bw + X]) continue; s += base[((b.y + Y) * w + b.x + X) * 4 + c]; q++; }
        if (!q) continue;
        C[i] = rgba[((b.y + y) * w + b.x + x) * 4 + c] - s / q; fixed[i] = 1; sum += C[i]; cnt++;
      }
      const m0 = cnt ? sum / cnt : 0;
      for (let i = 0; i < n; i++) if (M[i]) C[i] = m0;
      const it = iters || Math.min(1500, 60 + 4 * Math.max(bw, bh));
      for (let t = 0; t < it; t++) {
        let maxd = 0;
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const i = y * bw + x; if (!M[i]) continue;
          let s = 0, q = 0;
          for (const [dx, dy] of NB) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= bw || Y >= bh) continue; const j = Y * bw + X; if (M[j] || fixed[j]) { s += C[j]; q++; } }
          if (!q) continue;
          const d = s / q - C[i]; C[i] += 1.85 * d; if (Math.abs(d) > maxd) maxd = Math.abs(d);
        }
        if (maxd < 0.05) break;
      }
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = y * bw + x; if (M[i]) { const P = ((b.y + y) * w + b.x + x) * 4 + c; out[P] = base[P] + k * C[i]; } }
    }
    return out;
  }
  /** Normal patch: src (already where it goes) into mask - Diffusion 1-7 (Poisson sweeps), Transparent (half over the old) */
  function patchNormal(rgba, w, h, mask, src, opts) {
    const o = opts || {}, dif = Math.round(clampN(o.diffusion, 1, 7, 5));
    const iters = [0, 6, 20, 60, 200, 600, 900, 1400][dif];          // 5 (the default) = the 600 sweeps it always had
    const out = poisson(rgba, src, mask, w, h, { iters });
    if (o.transparent) for (let i = 0; i < w * h; i++) if (mask[i] > 127) for (let c = 0; c < 3; c++) out[i * 4 + c] = (out[i * 4 + c] + rgba[i * 4 + c]) / 2;
    return out;
  }
  const api = { bboxOf, poisson, inpaint, redness, redEye, bgEraseDab, mixColor, down2, downMask, distTo, grownMask, patchCA, patchNormal, membrane };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.PCRetouch = api;
})(typeof window !== "undefined" ? window : globalThis);
