/* pcmesh.js — THE IMAGE EDITOR'S DEFORMATION MATHS (2.422.0), window.PCMesh.
 *
 * Tim (verbatim): "can we close the gap with 1,2,3,4 and 5 first" - gap 3 of the Photoshop list: skew / distort /
 * perspective / warp, puppet warp, content-aware scale, liquify. The tools are in pcwarp.js, smart objects in
 * pcsmart.js; this file is the maths, pure (Node: scripts/test-pswarp.js) except drawMesh (a 2D canvas):
 *
 *   homography(src4, dst4) / applyH / invertH          4 points onto 4 points (perspective, distort, skew)
 *   isAffineQuad(q)                                     a parallelogram (drawn with one canvas transform)
 *   patchPoint(P16, u, v) / patchFromQuad(q) / patchPreset(q, style, bend)   the WARP grid: a bicubic Bézier patch
 *   quadMesh(q, n) / patchMesh(P, n) / meshOf(t, w, h, n) -> {n, src: [[u, v]], dst: [[x, y]]}   (u, v in 0..1)
 *   2.450.0: latPoint / latSplit / latUnsplit / latGrid / latNear / latWeights / latMesh - a warp of c x r patches (split
 *            lines, Photoshop's warp grid); liq "smooth" / "pushleft"; faceField / faceGuess / FACE_KEYS (Face-Aware Liquify)
 *   affineTri(s0, s1, s2, d0, d1, d2)                   the canvas matrix mapping one triangle onto another
 *   mlsRigid(p, q, v) / puppetMesh(box, pins, n)        PUPPET WARP: moving-least-squares rigid deformation
 *                                                       (Schaefer et al. 2006): pins p -> q, a point v -> f(v)
 *   energy / seam / carve(rgba, w, h, W2, H2, protect)  CONTENT-AWARE SCALE: seam carving (Avidan & Shamir 2007),
 *                                                       shrinking and growing, a protect mask
 *   field(w, h) / liq(f, op, x, y, r, s, mx, my, frozen) / applyField(rgba, w, h, f)   LIQUIFY: a displacement
 *                                                       field (each pixel samples from p + D(p)); push, twirl (±),
 *                                                       pucker, bloat, reconstruct; frozen areas kept
 */
(function (root) {
  "use strict";

  /* ================================ homographies ================================ */
  function solve(A, b) {                              // Gaussian elimination with partial pivoting (n <= 8)
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  /** H (row-major 3x3) with H * [x, y, 1] ~ the matching dst point */
  function homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [X, Y] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
      A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
    }
    const h = solve(A, b);
    return h ? h.concat([1]) : null;
  }
  const applyH = (H, x, y) => { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; };
  function invertH(H) {
    const [a, b, c, d, e, f, g, h, i] = H;
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-15) return null;
    const m = [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((v) => v / det);
    return m.map((v) => v / m[8]);
  }
  const UNIT = [[0, 0], [1, 0], [1, 1], [0, 1]];
  /** the quad TL, TR, BR, BL is a parallelogram (an affine image of the rectangle) */
  function isAffineQuad(q, tol) {
    const t = tol == null ? 1e-6 : tol;
    return Math.abs(q[0][0] + q[2][0] - q[1][0] - q[3][0]) <= t && Math.abs(q[0][1] + q[2][1] - q[1][1] - q[3][1]) <= t;
  }
  /** the canvas transform taking the w x h source rectangle onto a parallelogram quad */
  const affineOfQuad = (q, w, h) => [(q[1][0] - q[0][0]) / w, (q[1][1] - q[0][1]) / w, (q[3][0] - q[0][0]) / h, (q[3][1] - q[0][1]) / h, q[0][0], q[0][1]];
  const rectQuad = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  function quadBox(q) {
    const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }

  /* ================================ the warp patch ================================ */
  const bern = (t) => { const u = 1 - t; return [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]; };
  /** P16 = 4 rows x 4 columns of control points (row-major, row 0 = the top) */
  function patchPoint(P, u, v) {
    const bu = bern(u), bv = bern(v); let x = 0, y = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const w = bu[i] * bv[j], p = P[j * 4 + i]; x += w * p[0]; y += w * p[1]; }
    return [x, y];
  }
  /** a patch that IS the quad (control points at thirds - through its homography) */
  function patchFromQuad(q) {
    const H = homography(UNIT, q), P = [];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) P.push(applyH(H, i / 3, j / 3));
    return P;
  }
  // Photoshop's warp styles (our own curves): the [top, bottom] move of a column u (-1..1) as fractions of the height
  const WARP_STYLES = [["custom", "Custom"], ["arc", "Arc"], ["arcLower", "Arc Lower"], ["arcUpper", "Arc Upper"], ["arch", "Arch"], ["bulge", "Bulge"],
    ["flag", "Flag"], ["wave", "Wave"], ["fish", "Fish"], ["rise", "Rise"], ["inflate", "Inflate"], ["squeeze", "Squeeze"]];
  function column(style, bend, u) {
    const b = Math.max(-100, Math.min(100, +bend || 0)) / 100, c = 1 - u * u, s = Math.sin(u * Math.PI);
    switch (style) {
      case "arc": return [-b * c * 0.5, -b * c * 0.5];
      case "arcLower": return [0, b * c * 0.5];
      case "arcUpper": return [-b * c * 0.5, 0];
      case "arch": return [-b * c * 0.55, -b * c * 0.3];
      case "bulge": return [-b * c * 0.4, b * c * 0.4];
      case "inflate": { const k = Math.cos(u * Math.PI / 2); return [-b * k * 0.3, b * k * 0.3]; }
      case "flag": return [b * s * 0.3, b * s * 0.3];
      case "wave": return [b * s * 0.3, b * Math.sin(u * Math.PI - 0.9) * 0.3];
      case "fish": return [-b * c * 0.4, b * c * 0.4 * (u < 0 ? 1 : 1 - u)];
      case "rise": return [-b * u * 0.5, -b * u * 0.5];
      case "squeeze": return [b * c * 0.3, -b * c * 0.3];
      default: return [0, 0];
    }
  }
  /** a preset's patch on the quad's box (the quad's own sides when custom) */
  function patchPreset(q, style, bend) {
    if (!style || style === "custom") return patchFromQuad(q);
    const P = patchFromQuad(q), b = quadBox(q);
    for (let i = 0; i < 4; i++) {
      const [t, d] = column(style, bend, -1 + 2 * i / 3);
      for (let j = 0; j < 4; j++) { const f = j / 3; P[j * 4 + i] = [P[j * 4 + i][0], P[j * 4 + i][1] + (t * (1 - f) + d * f) * b.h]; }
    }
    return P;
  }

  /* ================================ 2.450.0: the warp's GRID and SPLIT LINES ================================
   * Photoshop's warp grid (Default / 3 x 3 / 4 x 4 / 5 x 5 / custom) and split lines (cross / vertical / horizontal):
   * the warp becomes a LATTICE of c x r bicubic patches sharing their edges - (3c + 1) x (3r + 1) control points,
   * row-major, with G = {c, r, us, vs}: where each patch starts / ends in the picture's own 0..1 (us c + 1 knots, vs
   * r + 1). A split is exact (de Casteljau): the picture does not move; removing one joins the two patches (their
   * outer handles stretched back). G null = the classic single 4 x 4 patch. */
  const gridOf = (G) => G && G.c ? G : { c: 1, r: 1, us: [0, 1], vs: [0, 1] };
  const latW = (G) => 3 * gridOf(G).c + 1, latH = (G) => 3 * gridOf(G).r + 1;
  /** which patch a parameter is in and where inside it */
  function knotAt(ks, u) { let i = 0; while (i < ks.length - 2 && u > ks[i + 1]) i++; const a = ks[i], b = ks[i + 1]; return [i, b > a ? Math.max(0, Math.min(1, (u - a) / (b - a))) : 0]; }
  /** the 16 control points of patch (i, j) */
  function patchAt(P, G, i, j) { const W = latW(G), o = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) o.push(P[(3 * j + y) * W + 3 * i + x]); return o; }
  function latPoint(P, G, u, v) {
    if (!G || !G.c || (G.c === 1 && G.r === 1 && P.length === 16)) return patchPoint(P, u, v);
    const g = gridOf(G), [i, s] = knotAt(g.us, u), [j, t] = knotAt(g.vs, v);
    return patchPoint(patchAt(P, g, i, j), s, t);
  }
  /** the four outer corners (TL, TR, BR, BL) */
  function latCorners(P, G) { const W = latW(G), H = latH(G); return [P[0], P[W - 1], P[W * H - 1], P[W * (H - 1)]].map((p) => [p[0], p[1]]); }
  /** a cubic's 4 points split at t -> 7 points (de Casteljau) */
  function splitCubic(a, b, c, d, t) {
    const L = (p, q) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const ab = L(a, b), bc = L(b, c), cd = L(c, d), abc = L(ab, bc), bcd = L(bc, cd), m = L(abc, bcd);
    return [a, ab, abc, m, bcd, cd, d];
  }
  /** a split line at u (vertical) or v (horizontal) - in the picture's 0..1; on an existing line = nothing */
  function latSplit(P, G0, axis, at) {
    const g = JSON.parse(JSON.stringify(gridOf(G0))), ks = axis === "v" ? g.us : g.vs;
    if (!(at > 1e-4 && at < 1 - 1e-4) || ks.some((k) => Math.abs(k - at) < 1e-4)) return { P, G: G0 && G0.c ? G0 : null };
    const [i, t] = knotAt(ks, at), W = latW(g), H = latH(g), out = [];
    if (axis === "v") {                                                     // a vertical line: every row's cubic in u split
      for (let y = 0; y < H; y++) {
        const row = P.slice(y * W, y * W + W), seg = splitCubic(row[3 * i], row[3 * i + 1], row[3 * i + 2], row[3 * i + 3], t);
        out.push(...row.slice(0, 3 * i), ...seg, ...row.slice(3 * i + 4));
      }
      g.us.splice(i + 1, 0, at); g.c++;
    } else {
      const rows = []; for (let y = 0; y < H; y++) rows.push(P.slice(y * W, y * W + W));
      const nr = rows.slice(0, 3 * i).map((r) => r.slice());
      const mid = [[], [], [], [], [], [], []];
      for (let x = 0; x < W; x++) { const seg = splitCubic(rows[3 * i][x], rows[3 * i + 1][x], rows[3 * i + 2][x], rows[3 * i + 3][x], t); seg.forEach((p, k) => mid[k].push(p)); }
      for (const r of nr.concat(mid, rows.slice(3 * i + 4))) out.push(...r);
      g.vs.splice(i + 1, 0, at); g.r++;
    }
    return { P: out.map((p) => [p[0], p[1]]), G: g };
  }
  /** take split line k away (1 .. c-1 vertical, 1 .. r-1 horizontal): the two patches joined, their handles stretched */
  function latUnsplit(P, G0, axis, k) {
    const g = JSON.parse(JSON.stringify(gridOf(G0))), ks = axis === "v" ? g.us : g.vs;
    if (!(k >= 1 && k <= ks.length - 2)) return { P, G: G0 && G0.c ? G0 : null };
    const t = (ks[k] - ks[k - 1]) / (ks[k + 1] - ks[k - 1]), W = latW(g), H = latH(g);
    const join = (a, l1, r2, d) => [a, [a[0] + (l1[0] - a[0]) / t, a[1] + (l1[1] - a[1]) / t], [d[0] + (r2[0] - d[0]) / (1 - t), d[1] + (r2[1] - d[1]) / (1 - t)], d];
    let out = [];
    if (axis === "v") {
      for (let y = 0; y < H; y++) {
        const row = P.slice(y * W, y * W + W), b = 3 * (k - 1), j4 = join(row[b], row[b + 1], row[b + 5], row[b + 6]);
        out.push(...row.slice(0, b), ...j4, ...row.slice(b + 7));
      }
      g.us.splice(k, 1); g.c--;
    } else {
      const rows = []; for (let y = 0; y < H; y++) rows.push(P.slice(y * W, y * W + W));
      const b = 3 * (k - 1), mid = [[], [], [], []];
      for (let x = 0; x < W; x++) join(rows[b][x], rows[b + 1][x], rows[b + 5][x], rows[b + 6][x]).forEach((p, q) => mid[q].push(p));
      for (const r of rows.slice(0, b).concat(mid, rows.slice(b + 7))) out.push(...r);
      g.vs.splice(k, 1); g.r--;
    }
    out = out.map((p) => [p[0], p[1]]);
    return { P: out, G: g.c === 1 && g.r === 1 ? null : g };
  }
  /** the warp as an even c x r grid (Photoshop's Grid menu): split at the new lines, the old ones that are not on it taken away */
  function latGrid(P, G0, c, r) {
    c = Math.max(1, Math.min(10, Math.round(c))); r = Math.max(1, Math.min(10, Math.round(r)));
    let cur = { P, G: G0 && G0.c ? G0 : null };
    for (let i = 1; i < c; i++) cur = latSplit(cur.P, cur.G, "v", i / c);
    for (let j = 1; j < r; j++) cur = latSplit(cur.P, cur.G, "h", j / r);
    const keep = (ks, n) => ks.map((k, i) => [k, i]).filter(([kk, i]) => i > 0 && i < ks.length - 1 && !Array.from({ length: n - 1 }, (_, q) => (q + 1) / n).some((x) => Math.abs(x - kk) < 1e-4));
    for (let pass = 0; pass < 20; pass++) { const g = gridOf(cur.G), bad = keep(g.us, c); if (!bad.length) break; cur = latUnsplit(cur.P, cur.G, "v", bad[0][1]); }
    for (let pass = 0; pass < 20; pass++) { const g = gridOf(cur.G), bad = keep(g.vs, r); if (!bad.length) break; cur = latUnsplit(cur.P, cur.G, "h", bad[0][1]); }
    return cur;
  }
  /** a lattice point is an ANCHOR (where grid lines cross - its handles go with it) */
  function latNear(G, k) {
    const W = latW(G), H = latH(G), x = k % W, y = Math.floor(k / W);
    if (x % 3 || y % 3) return [];
    return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < W && b < H).map(([a, b]) => b * W + a);
  }
  /** the weights a drag at (u, v) gives the lattice's points (the patch under it - its 16 points) */
  function latWeights(G, u, v) {
    const g = gridOf(G), W = latW(g), [i, s] = knotAt(g.us, u), [j, t] = knotAt(g.vs, v), bu = bern(s), bv = bern(t), w = new Float64Array(W * latH(g));
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) w[(3 * j + y) * W + 3 * i + x] = bu[x] * bv[y];
    return w;
  }
  /** the mesh a gridded warp is drawn with (finer for more patches) */
  const latMesh = (P, G, n) => gridMesh(n || Math.min(64, 24 * Math.max(gridOf(G).c, gridOf(G).r)), (u, v) => latPoint(P, G, u, v));

  /* ================================ meshes ================================ */
  /** a (n+1) x (n+1) grid: src (u, v) in 0..1 -> dst in the picture */
  function gridMesh(n, f) {
    const src = [], dst = [];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const u = i / n, v = j / n; src.push([u, v]); dst.push(f(u, v)); }
    return { n, src, dst };
  }
  const quadMesh = (q, n) => { const H = homography(UNIT, q); return gridMesh(n || 24, (u, v) => applyH(H, u, v)); };
  const patchMesh = (P, n) => gridMesh(n || 24, (u, v) => patchPoint(P, u, v));
  /** the mesh of a transform t = {quad, warp} */
  const meshOf = (t, n) => (t.warp ? (t.wgrid && t.wgrid.c ? latMesh(t.warp, t.wgrid, n) : patchMesh(t.warp, n)) : quadMesh(t.quad, n));   // 2.450.0: + a split / gridded warp
  /** the canvas matrix [a, b, c, d, e, f] taking triangle s onto triangle d */
  function affineTri(s0, s1, s2, d0, d1, d2) {
    const sx1 = s1[0] - s0[0], sy1 = s1[1] - s0[1], sx2 = s2[0] - s0[0], sy2 = s2[1] - s0[1];
    const det = sx1 * sy2 - sx2 * sy1; if (Math.abs(det) < 1e-12) return null;
    const dx1 = d1[0] - d0[0], dy1 = d1[1] - d0[1], dx2 = d2[0] - d0[0], dy2 = d2[1] - d0[1];
    const a = (dx1 * sy2 - dx2 * sy1) / det, c = (dx2 * sx1 - dx1 * sx2) / det;
    const b = (dy1 * sy2 - dy2 * sy1) / det, d = (dy2 * sx1 - dy1 * sx2) / det;
    return [a, b, c, d, d0[0] - a * s0[0] - c * s0[1], d0[1] - b * s0[0] - d * s0[1]];
  }
  /** draw `src` (sw x sh) through a mesh on a 2D context: one clipped affine draw per triangle (each grown by half a
   *  pixel so neighbours overlap and no seam shows). box = the part of src the mesh's 0..1 covers (default all) */
  function drawMesh(g, src, mesh, box) {
    const sw = box ? box.w : src.width, sh = box ? box.h : src.height, ox = box ? box.x : 0, oy = box ? box.y : 0, N = mesh.n;
    const S = (k) => [ox + mesh.src[k][0] * sw, oy + mesh.src[k][1] * sh], Dd = (k) => mesh.dst[k];
    const tri = (a, b, c) => {
      const d0 = Dd(a), d1 = Dd(b), d2 = Dd(c), m = affineTri(S(a), S(b), S(c), d0, d1, d2); if (!m) return;
      const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
      const grow = (p) => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * 0.6, p[1] + dy / l * 0.6]; };
      const e0 = grow(d0), e1 = grow(d1), e2 = grow(d2);
      g.save(); g.beginPath(); g.moveTo(e0[0], e0[1]); g.lineTo(e1[0], e1[1]); g.lineTo(e2[0], e2[1]); g.closePath(); g.clip();
      g.transform(m[0], m[1], m[2], m[3], m[4], m[5]); g.drawImage(src, 0, 0); g.restore();
    };
    if (mesh.z) { for (const t of meshTris(mesh)) tri(t[0], t[1], t[2]); return; }   // 2.465.0: pin depth = the drawing order
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * (N + 1) + i;
      tri(k, k + 1, k + N + 2); tri(k, k + N + 2, k + N + 1);
    }
  }

  /* ================================ puppet warp ================================ */
  /** MLS rigid: pins p[i] moved to q[i]; where does v go? (no pins: stays; one pin: follows it) */
  function mlsRigid(p, q, v) {
    const n = p.length; if (!n) return [v[0], v[1]];
    let sw = 0, px = 0, py = 0, qx = 0, qy = 0;
    const w = new Array(n);
    for (let i = 0; i < n; i++) {
      const d2 = (p[i][0] - v[0]) ** 2 + (p[i][1] - v[1]) ** 2;
      if (d2 < 1e-10) return [q[i][0], q[i][1]];
      w[i] = 1 / d2; sw += w[i]; px += w[i] * p[i][0]; py += w[i] * p[i][1]; qx += w[i] * q[i][0]; qy += w[i] * q[i][1];
    }
    px /= sw; py /= sw; qx /= sw; qy /= sw;
    if (n === 1) return [v[0] + qx - px, v[1] + qy - py];
    const vx = v[0] - px, vy = v[1] - py;
    let fx = 0, fy = 0;
    for (let i = 0; i < n; i++) {
      const ax = p[i][0] - px, ay = p[i][1] - py, bx = q[i][0] - qx, by = q[i][1] - qy;
      // A_i = w_i [p^; -p^⊥] [v; -v⊥]^T (⊥(x, y) = (-y, x)); f_r += q^ A_i
      const a11 = w[i] * (ax * vx + ay * vy), a12 = w[i] * (ax * vy - ay * vx);
      const a21 = w[i] * (ay * vx - ax * vy), a22 = w[i] * (ay * vy + ax * vx);
      fx += bx * a11 + by * a21; fy += bx * a12 + by * a22;
    }
    const L = Math.hypot(fx, fy), V = Math.hypot(vx, vy);
    if (L < 1e-12) return [qx, qy];
    return [V * fx / L + qx, V * fy / L + qy];
  }
  /** the puppet mesh over a box: pins [{x, y, X, Y, a?, z?}] (from -> to).
   *  2.465.0: a pin with a FIXED ROTATION (a, radians; null / undefined = Auto) holds the content round it turned by a:
   *  two satellite controls either side of it (rest +-r, moved to +-r turned by a) - MLS then keeps that turn there.
   *  PIN DEPTH (z, an integer; 0 = as made): the mesh's triangles are drawn lowest first, each at the depth of the pins
   *  nearest its rest place (inverse distance^4), so where the warp folds over itself the deeper pins' parts go under. */
  function pinControls(box, pins) {
    const r = Math.max(8, Math.max(box.w, box.h) * 0.05, Math.min(box.w, box.h) * 0.1), p = [], q = [];
    for (const a of pins) {
      p.push([a.x, a.y]); q.push([a.X, a.Y]);
      if (a.a == null || !Number.isFinite(+a.a)) continue;
      const c = Math.cos(+a.a), s = Math.sin(+a.a);
      for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) { p.push([a.x + dx, a.y + dy]); q.push([a.X + c * dx - s * dy, a.Y + s * dx + c * dy]); }
    }
    return { p, q };
  }
  function pinDepth(pins, x, y) {
    let sw = 0, sz = 0;
    for (const a of pins) { const d2 = (a.x - x) ** 2 + (a.y - y) ** 2; if (d2 < 1e-9) return +a.z || 0; const w = 1 / (d2 * d2); sw += w; sz += w * (+a.z || 0); }
    return sw ? sz / sw : 0;
  }
  function puppetMesh(box, pins, n) {
    const { p, q } = pinControls(box, pins);
    const m = gridMesh(n || 20, (u, v) => mlsRigid(p, q, [box.x + u * box.w, box.y + v * box.h]));
    if (pins.some((a) => +a.z)) m.z = m.src.map((s) => pinDepth(pins, box.x + s[0] * box.w, box.y + s[1] * box.h));
    return m;
  }
  /** the mesh's triangles in drawing order: [[a, b, c], ...] (by depth when the mesh has one, else row by row) */
  function meshTris(mesh) {
    const N = mesh.n, out = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * (N + 1) + i; out.push([k, k + 1, k + N + 2], [k, k + N + 2, k + N + 1]); }
    if (!mesh.z) return out;
    const z = mesh.z, d = out.map((t, i) => [(z[t[0]] + z[t[1]] + z[t[2]]) / 3, i]);
    d.sort((A, B) => A[0] - B[0] || A[1] - B[1]);
    return d.map(([, i]) => out[i]);
  }

  /* ================================ content-aware scale ================================ */
  const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  /** gradient energy of rgba w x h (+ a protect mask: 255 = keep -> a huge energy) */
  function energy(rgba, w, h, protect) {
    const g = new Float32Array(w * h), E = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) g[i] = lum(rgba, i * 4) * (rgba[i * 4 + 3] / 255) + (255 - rgba[i * 4 + 3]) * 0.1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const l = g[y * w + Math.max(0, x - 1)], r = g[y * w + Math.min(w - 1, x + 1)], u = g[Math.max(0, y - 1) * w + x], d = g[Math.min(h - 1, y + 1) * w + x];
      E[y * w + x] = Math.abs(r - l) + Math.abs(d - u) + (protect && protect[y * w + x] > 127 ? 1e6 : 0);
    }
    return E;
  }
  /** the lowest-energy vertical seam: x for each row */
  function seam(E, w, h) {
    const M = new Float32Array(w * h), B = new Int8Array(w * h);
    for (let x = 0; x < w; x++) M[x] = E[x];
    for (let y = 1; y < h; y++) {
      const r = y * w, pr = r - w;
      for (let x = 0; x < w; x++) {
        let m = M[pr + x], b = 0;
        if (x > 0 && M[pr + x - 1] < m) { m = M[pr + x - 1]; b = -1; }
        if (x < w - 1 && M[pr + x + 1] < m) { m = M[pr + x + 1]; b = 1; }
        M[r + x] = E[r + x] + m; B[r + x] = b;
      }
    }
    let x = 0, best = Infinity; const r = (h - 1) * w;
    for (let i = 0; i < w; i++) if (M[r + i] < best) { best = M[r + i]; x = i; }
    const out = new Int32Array(h);
    for (let y = h - 1; y >= 0; y--) { out[y] = x; x += B[y * w + x]; }
    return out;
  }
  function transpose(a, w, h, ch) {
    const o = new (a.constructor)(a.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < ch; c++) o[(x * h + y) * ch + c] = a[(y * w + x) * ch + c];
    return o;
  }
  /** narrower: remove k seams; wider: duplicate the k cheapest seams (each next to itself, averaged) */
  function carveW(rgba, w, h, W2, protect) {
    let d = Uint8ClampedArray.from(rgba), pm = protect ? Uint8Array.from(protect) : null, cw = w;
    if (W2 < w) {
      while (cw > W2) {
        const s = seam(energy(d, cw, h, pm), cw, h), nd = new Uint8ClampedArray((cw - 1) * h * 4), np = pm ? new Uint8Array((cw - 1) * h) : null;
        for (let y = 0; y < h; y++) {
          const sx = s[y]; let o = y * (cw - 1);
          for (let x = 0; x < cw; x++) { if (x === sx) continue; const si = (y * cw + x) * 4, di = o * 4; nd[di] = d[si]; nd[di + 1] = d[si + 1]; nd[di + 2] = d[si + 2]; nd[di + 3] = d[si + 3]; if (np) np[o] = pm[y * cw + x]; o++; }
        }
        d = nd; pm = np; cw--;
      }
      return d;
    }
    if (W2 === w) return d;
    // grow: find the k seams on a shrinking copy (their x in the ORIGINAL kept), then insert them all at once
    const k = W2 - w, idx = []; let tmp = Uint8ClampedArray.from(d), tp = pm ? Uint8Array.from(pm) : null, tw = w;
    const orig = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => x));
    for (let n = 0; n < Math.min(k, w - 1); n++) {
      const s = seam(energy(tmp, tw, h, tp), tw, h), nd = new Uint8ClampedArray((tw - 1) * h * 4), np = tp ? new Uint8Array((tw - 1) * h) : null, row = [];
      for (let y = 0; y < h; y++) {
        row.push(orig[y][s[y]]); orig[y].splice(s[y], 1);
        let o = y * (tw - 1);
        for (let x = 0; x < tw; x++) { if (x === s[y]) continue; const si = (y * tw + x) * 4, di = o * 4; for (let c = 0; c < 4; c++) nd[di + c] = tmp[si + c]; if (np) np[o] = tp[y * tw + x]; o++; }
      }
      idx.push(row); tmp = nd; tp = np; tw--;
    }
    const reps = Math.ceil(k / Math.max(1, idx.length)), out = new Uint8ClampedArray(W2 * h * 4);
    for (let y = 0; y < h; y++) {
      const dup = new Uint16Array(w); let left = k;
      for (let r = 0; r < reps && left > 0; r++) for (const row of idx) { if (left <= 0) break; dup[row[y]]++; left--; }
      let o = 0;
      for (let x = 0; x < w; x++) {
        const si = (y * w + x) * 4, ni = (y * w + Math.min(w - 1, x + 1)) * 4;
        for (let c = 0; c < 4; c++) out[(y * W2 + o) * 4 + c] = d[si + c]; o++;
        for (let t = 0; t < dup[x] && o < W2; t++) { for (let c = 0; c < 4; c++) out[(y * W2 + o) * 4 + c] = (d[si + c] + d[ni + c]) >> 1; o++; }
      }
    }
    return out;
  }
  /** content-aware scale rgba w x h -> W2 x H2 (protect: w x h, 255 = keep) */
  function carve(rgba, w, h, W2, H2, protect) {
    let d = carveW(rgba, w, h, W2, protect);
    if (H2 !== h) {
      let p = null;
      if (protect) { const pw = carveWMask(protect, w, h, W2); p = transpose(pw, W2, h, 1); }
      const t = transpose(d, W2, h, 4), c = carveW(t, h, W2, H2, p);
      d = transpose(c, H2, W2, 4);
    }
    return d;
  }
  /** the protect mask resized to the new width (nearest) - the height pass uses it */
  function carveWMask(m, w, h, W2) {
    const o = new Uint8Array(W2 * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < W2; x++) o[y * W2 + x] = m[y * w + Math.min(w - 1, Math.floor(x * w / W2))];
    return o;
  }

  /* ================================ liquify ================================ */
  const field = (w, h) => ({ w, h, dx: new Float32Array(w * h), dy: new Float32Array(w * h) });
  function sampleF(f, x, y) {
    if (x < 0) x = 0; if (y < 0) y = 0; if (x > f.w - 1) x = f.w - 1; if (y > f.h - 1) y = f.h - 1;
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(f.w - 1, x0 + 1), y1 = Math.min(f.h - 1, y0 + 1), ax = x - x0, ay = y - y0;
    const i00 = y0 * f.w + x0, i10 = y0 * f.w + x1, i01 = y1 * f.w + x0, i11 = y1 * f.w + x1;
    return [(f.dx[i00] * (1 - ax) + f.dx[i10] * ax) * (1 - ay) + (f.dx[i01] * (1 - ax) + f.dx[i11] * ax) * ay,
            (f.dy[i00] * (1 - ax) + f.dy[i10] * ax) * (1 - ay) + (f.dy[i01] * (1 - ax) + f.dy[i11] * ax) * ay];
  }
  /** one brush dab on the field. op: push (mx, my = the drag), twirl (s > 0 clockwise), pucker, bloat, reconstruct;
   *  frozen (w x h, 0..255) keeps what is painted there */
  function liq(f, op, cx, cy, r, s, mx, my, frozen) {
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(f.w - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(f.h - 1, Math.ceil(cy + r));
    if (x1 < x0 || y1 < y0) return f;
    // new values for the brush's square only (read from the field as it was), then written back
    const rw = x1 - x0 + 1, rh = y1 - y0 + 1, ndx = new Float32Array(rw * rh), ndy = new Float32Array(rw * rh), hit = new Uint8Array(rw * rh);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2; if (d2 >= r * r) continue;
      let w = (1 - d2 / (r * r)); w *= w;
      const i = y * f.w + x, j = (y - y0) * rw + (x - x0);
      if (frozen) w *= 1 - frozen[i] / 255;
      if (w <= 0) continue;
      let sx = x, sy = y;
      if (op === "push") { sx = x - mx * w * s; sy = y - my * w * s; }
      else if (op === "twirl") { const a = -s * w * 0.35, c = Math.cos(a), sn = Math.sin(a); sx = cx + (x - cx) * c - (y - cy) * sn; sy = cy + (x - cx) * sn + (y - cy) * c; }
      else if (op === "pucker") { const k = 1 + s * w * 0.12; sx = cx + (x - cx) * k; sy = cy + (y - cy) * k; }
      else if (op === "bloat") { const k = 1 - s * w * 0.12; sx = cx + (x - cx) * k; sy = cy + (y - cy) * k; }
      else if (op === "reconstruct") { const k = 1 - Math.min(1, s * w * 0.5); ndx[j] = f.dx[i] * k; ndy[j] = f.dy[i] * k; hit[j] = 1; continue; }
      else if (op === "smooth") {                                           // 2.450.0: SMOOTH - the distortion evened out (its neighbours' mean)
        const q = Math.max(1, Math.round(r / 6)); let ax = 0, ay = 0, n = 0;
        for (let yy = Math.max(0, y - q); yy <= Math.min(f.h - 1, y + q); yy += Math.max(1, q >> 1)) for (let xx = Math.max(0, x - q); xx <= Math.min(f.w - 1, x + q); xx += Math.max(1, q >> 1)) { const k2 = yy * f.w + xx; ax += f.dx[k2]; ay += f.dy[k2]; n++; }
        const k = Math.min(1, s * w * 0.6); ndx[j] = f.dx[i] + (ax / n - f.dx[i]) * k; ndy[j] = f.dy[i] + (ay / n - f.dy[i]) * k; hit[j] = 1; continue;
      }
      else if (op === "pushleft") { sx = x - my * w * s; sy = y + mx * w * s; }   // 2.450.0: PUSH LEFT - pixels go to the left of the drag (s < 0: the right)
      else continue;
      const [ox, oy] = sampleF(f, sx, sy);
      ndx[j] = sx - x + ox; ndy[j] = sy - y + oy; hit[j] = 1;
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const j = (y - y0) * rw + (x - x0); if (hit[j]) { const i = y * f.w + x; f.dx[i] = ndx[j]; f.dy[i] = ndy[j]; } }
    return f;
  }
  /** rgba w x h through a field (any size: scaled to the picture) - bilinear */
  function applyField(rgba, w, h, f) {
    const out = new Uint8ClampedArray(w * h * 4), kx = f.w / w, ky = f.h / h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const [ddx, ddy] = sampleF(f, (x + 0.5) * kx - 0.5, (y + 0.5) * ky - 0.5);
      let sx = x + ddx / kx, sy = y + ddy / ky;
      if (sx < 0) sx = 0; if (sy < 0) sy = 0; if (sx > w - 1) sx = w - 1; if (sy > h - 1) sy = h - 1;
      const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), ax = sx - x0, ay = sy - y0, o = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) {
        const v = (rgba[(y0 * w + x0) * 4 + c] * (1 - ax) + rgba[(y0 * w + x1) * 4 + c] * ax) * (1 - ay) + (rgba[(y1 * w + x0) * 4 + c] * (1 - ax) + rgba[(y1 * w + x1) * 4 + c] * ax) * ay;
        out[o + c] = v;
      }
    }
    return out;
  }

  /* ================================ 2.450.0: FACE-AWARE LIQUIFY ================================
   * Photoshop's face sliders on a face you place (no face finder here): face = {cx, cy, rx, ry (the oval), eyes:
   * [[x, y], [x, y]], nose: [x, y], mouth: [x, y], mw (the mouth's half width)}; v = the sliders, -100 .. 100. The
   * result is a displacement field (out pixel = the source at x + dx, y + dy) added to the brushes'. */
  const FACE_KEYS = [["eyeSize", "Eye Size"], ["eyeHeight", "Eye Height"], ["eyeWidth", "Eye Width"], ["eyeDist", "Eye Distance"],
    ["noseHeight", "Nose Height"], ["noseWidth", "Nose Width"], ["smile", "Smile"], ["mouthWidth", "Mouth Width"], ["mouthHeight", "Mouth Height"],
    ["forehead", "Forehead"], ["chin", "Chin Height"], ["jaw", "Jawline"], ["faceWidth", "Face Width"]];
  /** a face's parts where they usually are inside its oval */
  function faceGuess(cx, cy, rx, ry) {
    return { cx, cy, rx, ry, eyes: [[cx - rx * 0.38, cy - ry * 0.12], [cx + rx * 0.38, cy - ry * 0.12]], nose: [cx, cy + ry * 0.18], mouth: [cx, cy + ry * 0.45], mw: rx * 0.36 };
  }
  function faceField(w, h, face, v) {
    const dx = new Float32Array(w * h), dy = new Float32Array(w * h);
    if (!face || !v) return { w, h, dx, dy };
    const val = (k) => Math.max(-100, Math.min(100, +v[k] || 0)) / 100;
    // a local change round (px, py) of radius R: k = scale (x, y) about it, t = a move; w = (1 - d²/R²)² inside
    const local = (px, py, R, kx, ky, tx, ty) => {
      if (!(R > 0.5) || (!kx && !ky && !tx && !ty)) return;
      const x0 = Math.max(0, Math.floor(px - R)), x1 = Math.min(w - 1, Math.ceil(px + R)), y0 = Math.max(0, Math.floor(py - R)), y1 = Math.min(h - 1, Math.ceil(py + R));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const d2 = ((x - px) ** 2 + (y - py) ** 2) / (R * R); if (d2 >= 1) continue;
        const f = (1 - d2) ** 2, i = y * w + x;
        // backward mapping: to make it bigger the pixel takes from nearer the centre
        dx[i] += -(x - px) * (kx * f) / (1 + kx * f) - tx * f;
        dy[i] += -(y - py) * (ky * f) / (1 + ky * f) - ty * f;
      }
    };
    const { cx, cy, rx, ry } = face, eyes = face.eyes || [], er = rx * 0.32;
    for (let e = 0; e < eyes.length; e++) {
      const [ex, ey] = eyes[e], side = ex < cx ? -1 : 1;
      local(ex, ey, er, 0.35 * val("eyeSize") + 0.3 * val("eyeWidth"), 0.35 * val("eyeSize"), side * rx * 0.08 * val("eyeDist"), -ry * 0.06 * val("eyeHeight"));
    }
    if (face.nose) local(face.nose[0], face.nose[1], rx * 0.3, 0.3 * val("noseWidth"), 0, 0, -ry * 0.06 * val("noseHeight"));
    if (face.mouth) {
      const [mx, my] = face.mouth, mw = face.mw || rx * 0.36;
      local(mx, my, mw * 1.25, 0.3 * val("mouthWidth"), 0.35 * val("mouthHeight"), 0, 0);
      for (const sd of [-1, 1]) local(mx + sd * mw, my, mw * 0.6, 0, 0, 0, -ry * 0.07 * val("smile"));
    }
    // the face's shape: the oval's top (forehead) / bottom (chin) moved, its sides in / out (width; jawline = the lower half)
    const big = (fx, fy, wt) => {
      for (let y = Math.max(0, Math.floor(cy - ry * 1.3)); y <= Math.min(h - 1, Math.ceil(cy + ry * 1.3)); y++) for (let x = Math.max(0, Math.floor(cx - rx * 1.4)); x <= Math.min(w - 1, Math.ceil(cx + rx * 1.4)); x++) {
        const ux = (x - cx) / (rx * 1.4), uy = (y - cy) / (ry * 1.3), d2 = ux * ux + uy * uy; if (d2 >= 1) continue;
        const f = (1 - d2) ** 2 * wt(ux, uy), i = y * w + x; if (!f) continue;
        dx[i] -= fx(ux, uy) * f; dy[i] -= fy(ux, uy) * f;
      }
    };
    const fh = val("forehead"), ch = val("chin"), fw = val("faceWidth"), jw = val("jaw");
    if (fh) big(() => 0, () => -ry * 0.12 * fh, (ux, uy) => Math.max(0, -uy));
    if (ch) big(() => 0, () => ry * 0.12 * ch, (ux, uy) => Math.max(0, uy));
    if (fw) big((ux) => Math.sign(ux) * rx * 0.1 * fw, () => 0, (ux) => Math.min(1, Math.abs(ux) * 1.6));
    if (jw) big((ux) => Math.sign(ux) * rx * 0.1 * jw, () => 0, (ux, uy) => Math.min(1, Math.abs(ux) * 1.6) * Math.max(0, uy));
    return { w, h, dx, dy };
  }
  /** a field as / from a small JSON-safe form (base64 of half floats would be smaller; plain arrays rounded to 0.1 px) */
  const fieldOut = (f) => ({ w: f.w, h: f.h, dx: Array.from(f.dx, (v) => Math.round(v * 10) / 10), dy: Array.from(f.dy, (v) => Math.round(v * 10) / 10) });
  const fieldIn = (o) => ({ w: o.w, h: o.h, dx: Float32Array.from(o.dx), dy: Float32Array.from(o.dy) });

  const api = { solve, homography, applyH, invertH, UNIT, isAffineQuad, affineOfQuad, rectQuad, quadBox, bern, patchPoint, patchFromQuad, WARP_STYLES, column,
    patchPreset, gridMesh, quadMesh, patchMesh, meshOf, affineTri, drawMesh, mlsRigid, puppetMesh, energy, seam, transpose, carveW, carve, field, sampleF, liq,
    applyField, fieldOut, fieldIn,
    gridOf, latW, latH, knotAt, patchAt, latPoint, latCorners, splitCubic, latSplit, latUnsplit, latGrid, latNear, latWeights, latMesh, faceField, FACE_KEYS, faceGuess,   // 2.450.0
    pinControls, pinDepth, meshTris };   // 2.465.0: puppet pin rotation + depth
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.PCMesh = api;
})(typeof window !== "undefined" ? window : globalThis);
