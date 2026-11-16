/* pclaser.js — THE LASER PANEL: TOOLPATHS AND G-CODE FROM THE PICTURE'S LAYERS (2.803.0), window.PCLaser.
 *
 * Tim (verbatim): "can we add a lightburn feature to image editor, it can do a linedrawing using controlnet or import a
 * vector or create a vector and generate a toolpath?" - asked: GRBL + Marlin G-code; file + send over USB (the USB part
 * is 2.804.0); Line, Fill, Image and Offset fill / centreline; line art as centreline or outline, picked per job.
 *
 *   WINDOW ▸ LASER   the panel: the MACHINE (GRBL or Marlin, bed W x H mm, origin bottom-left / top-left, the power
 *                    scale - GRBL $30 / Marlin 255 -, travel speed, constant or dynamic power, air assist), the JOB's
 *                    size on the bed (mm per picture px - the page's dpi -, offset X / Y), and each visible layer's
 *                    OPERATION:
 *     Line          follow the layer's vectors (cut / score): a shape, a pen path, an SVG brought in, type (its
 *                   outlines); a picture layer is traced - Centreline (one stroke down each line: thinned, then
 *                   followed) or Outline (the edges) - from its dark / opaque pixels
 *     Fill          hatch the inside: lines at an interval and an angle, back and forth
 *     Offset fill   concentric passes at the interval, from the outline inwards
 *     Image         engrave the picture row by row: dithered (Floyd–Steinberg), threshold or greyscale power
 *                   power %, speed mm/min, passes, interval (mm), angle, overscan; holes cut before the outside
 *   LINE ART      ✎ Line art from the picture: the ControlNet line-art preprocessor (the Control panel's) on the
 *                 visible picture -> a new "Line art" layer set to Line · centreline
 *   PREVIEW       the bed with the toolpath (each layer its colour, travel moves dashed), the time and lengths
 *   SAVE          ⤓ Save G-code: projects/<p>/laser (lib/laserStore.js, routes/laser.js) + a download
 *
 * Pure (Node: scripts/test-laser803.js): flattenSegs, rdp, thin, skeletonPaths, distance, isolines, hatch, order,
 * rasterRows, toMm, gcode, estimate, MACHINE, OPS.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const MACHINE = { flavor: "grbl", bedW: 400, bedH: 400, origin: "bl", sMax: 1000, travel: 6000, dynamic: true, air: false };
  const OPS = [["off", "Off"], ["line", "Line"], ["fill", "Fill"], ["offset", "Offset fill"], ["image", "Image"]];
  const OP_DEFAULT = { op: "off", power: 60, speed: 1500, passes: 1, interval: 0.1, angle: 0, trace: "centre", dither: "floyd", threshold: 50, overscan: 2, minPower: 0 };
  const hyp = Math.hypot;
  /** recorder paths (["M"|"L"|"C"|"Z", …]) as polylines [{pts: [[x, y] …], closed}] - curves cut at about tol px */
  function flattenSegs(segs, tol) {
    const t = tol || 0.5, out = [];
    let cur = null, last = null, start = null;
    const end = (closed) => {
      if (cur && cur.pts.length > 1) { const a = cur.pts[0], b = cur.pts[cur.pts.length - 1]; cur.closed = !!closed || (cur.pts.length > 2 && hyp(a[0] - b[0], a[1] - b[1]) < 1e-6); out.push(cur); }   // an ellipse ends where it began
      cur = null;
    };
    for (const s of segs || []) {
      if (s[0] === "M") { end(false); start = [s[1], s[2]]; cur = { pts: [start.slice()], closed: false }; last = start.slice(); }
      else if (s[0] === "L") { if (!cur) { cur = { pts: [last ? last.slice() : [s[1], s[2]]], closed: false }; } cur.pts.push([s[1], s[2]]); last = [s[1], s[2]]; }
      else if (s[0] === "C") {
        if (!cur) cur = { pts: [last ? last.slice() : [s[1], s[2]]], closed: false };
        const [x0, y0] = last || [s[1], s[2]], len = hyp(s[1] - x0, s[2] - y0) + hyp(s[3] - s[1], s[4] - s[2]) + hyp(s[5] - s[3], s[6] - s[4]);
        const n = Math.max(2, Math.min(120, Math.ceil(Math.sqrt(len / t) * 1.4)));
        for (let i = 1; i <= n; i++) {
          const u = i / n, a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, d = u ** 3;
          cur.pts.push([a * x0 + b * s[1] + c * s[3] + d * s[5], a * y0 + b * s[2] + c * s[4] + d * s[6]]);
        }
        last = [s[5], s[6]];
      } else if (s[0] === "Z") { if (cur && start) { const p = cur.pts[cur.pts.length - 1]; if (hyp(p[0] - start[0], p[1] - start[1]) > 1e-9) cur.pts.push(start.slice()); } end(true); last = start ? start.slice() : last; }
    }
    end(false);
    return out;
  }
  /** Ramer–Douglas–Peucker: fewer points, none further than eps from the line */
  function rdp(pts, eps) {
    if (!pts || pts.length < 3) return (pts || []).slice();
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop(); let best = -1, bd = eps;
      const [ax, ay] = pts[a], [bx, by] = pts[b], L = hyp(bx - ax, by - ay) || 1e-9;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L; if (d > bd) { bd = d; best = i; } }
      if (best >= 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  /** Zhang–Suen thinning of a 0/1 mask -> a one-pixel skeleton (a new Uint8Array) */
  function thin(mask, w, h) {
    const m = Uint8Array.from(mask), del = [];
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : m[y * w + x]);
    for (let it = 0, changed = true; changed && it < 200; it++) {
      changed = false;
      for (let step = 0; step < 2; step++) {
        del.length = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (!m[y * w + x]) continue;
          const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1), p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (B < 2 || B > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2]; let A = 0; for (let i = 0; i < 8; i++) if (!seq[i] && seq[i + 1]) A++;
          if (A !== 1) continue;
          if (step === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue;
          del.push(y * w + x);
        }
        if (del.length) { changed = true; for (const i of del) m[i] = 0; }
      }
    }
    return m;
  }
  const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  /** a skeleton's pixels as polylines (from the ends and the forks, then the loops) */
  function skeletonPaths(sk, w, h, minLen) {
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && sk[y * w + x];
    const nb = (x, y) => N8.map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => on(a, b));
    const deg = (x, y) => nb(x, y).length, used = new Set(), key = (x, y) => y * w + x, ekey = (a, b) => (a < b ? a + ":" + b : b + ":" + a);
    const out = [], seenEdge = new Set();
    const walk = (sx, sy, nx, ny) => {
      const pts = [[sx, sy], [nx, ny]]; let px = sx, py = sy, cx = nx, cy = ny;
      seenEdge.add(ekey(key(sx, sy), key(nx, ny)));
      while (deg(cx, cy) === 2 && !used.has(key(cx, cy))) {
        used.add(key(cx, cy));
        const nxt = nb(cx, cy).find(([a, b]) => !(a === px && b === py) && !seenEdge.has(ekey(key(cx, cy), key(a, b))));
        if (!nxt) break;
        seenEdge.add(ekey(key(cx, cy), key(nxt[0], nxt[1])));
        px = cx; py = cy; cx = nxt[0]; cy = nxt[1]; pts.push([cx, cy]);
        if (cx === sx && cy === sy) break;
      }
      return pts;
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!on(x, y) || deg(x, y) === 2) continue;
      for (const [nx, ny] of nb(x, y)) { if (seenEdge.has(ekey(key(x, y), key(nx, ny))) || (deg(nx, ny) === 2 && used.has(key(nx, ny)))) continue; out.push({ pts: walk(x, y, nx, ny), closed: false }); }
      if (deg(x, y) === 0) out.push({ pts: [[x, y], [x + 0.01, y]], closed: false });
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {     // loops: only two-neighbour pixels left
      if (!on(x, y) || used.has(key(x, y)) || deg(x, y) !== 2) continue;
      used.add(key(x, y)); const [n1] = nb(x, y); const pts = walk(x, y, n1[0], n1[1]); out.push({ pts, closed: pts.length > 2 && pts[pts.length - 1][0] === x && pts[pts.length - 1][1] === y });
    }
    const L = minLen == null ? 3 : minLen;
    return out.filter((p) => p.pts.length >= 2 && p.pts.reduce((a, q, i) => (i ? a + hyp(q[0] - p.pts[i - 1][0], q[1] - p.pts[i - 1][1]) : 0), 0) >= L - 1e-9);
  }
  /** distance (px) from each inside pixel of a mask to the outside (chamfer 3-4); outside = 0 */
  function distance(mask, w, h) {
    const BIG = 1e9, d = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) d[i] = mask[i] ? BIG : 0;
    const g = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!d[i]) continue; d[i] = Math.min(d[i], g(x - 1, y) + 3, g(x, y - 1) + 3, g(x - 1, y - 1) + 4, g(x + 1, y - 1) + 4); }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!d[i]) continue; d[i] = Math.min(d[i], g(x + 1, y) + 3, g(x, y + 1) + 3, g(x + 1, y + 1) + 4, g(x - 1, y + 1) + 4); }
    for (let i = 0; i < w * h; i++) d[i] /= 3;
    return d;
  }
  /** the lines where a field crosses `level` (marching squares on pixel centres; outside the picture = 0) -> closed /
   *  open polylines */
  function isolines(f, w, h, level) {
    const v = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : f[y * w + x]);
    const segs = [];
    const lerp = (x0, y0, a, x1, y1, b) => { const t = (level - a) / ((b - a) || 1e-9); return [x0 + (x1 - x0) * t + 0.5, y0 + (y1 - y0) * t + 0.5]; };
    for (let y = -1; y < h; y++) for (let x = -1; x < w; x++) {
      const a = v(x, y), b = v(x + 1, y), c = v(x + 1, y + 1), d = v(x, y + 1);
      const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const T = () => lerp(x, y, a, x + 1, y, b), R = () => lerp(x + 1, y, b, x + 1, y + 1, c), B = () => lerp(x, y + 1, d, x + 1, y + 1, c), L = () => lerp(x, y, a, x, y + 1, d);
      const add = (p, q) => segs.push([p(), q()]);
      switch (idx) {
        case 1: case 14: add(L, B); break; case 2: case 13: add(B, R); break; case 3: case 12: add(L, R); break;
        case 4: case 11: add(T, R); break; case 6: case 9: add(T, B); break; case 7: case 8: add(L, T); break;
        case 5: add(L, T); add(B, R); break; case 10: add(T, R); add(L, B); break;
        default: break;
      }
    }
    // chain the little segments
    const k = (p) => Math.round(p[0] * 1000) + "," + Math.round(p[1] * 1000), ends = new Map(), used = new Uint8Array(segs.length);
    segs.forEach((s, i) => { for (const e of [0, 1]) { const kk = k(s[e]); if (!ends.has(kk)) ends.set(kk, []); ends.get(kk).push(i); } });
    const out = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue; used[i] = 1;
      const pts = [segs[i][0], segs[i][1]];
      for (const dir of [1, 0]) {
        for (let guard = 0; guard < segs.length; guard++) {
          const tip = dir ? pts[pts.length - 1] : pts[0], nx = (ends.get(k(tip)) || []).find((j) => !used[j]);
          if (nx == null) break;
          used[nx] = 1; const s = segs[nx], other = k(s[0]) === k(tip) ? s[1] : s[0];
          if (dir) pts.push(other); else pts.unshift(other);
        }
      }
      const closed = pts.length > 3 && k(pts[0]) === k(pts[pts.length - 1]);
      out.push({ pts, closed });
    }
    return out;
  }
  /** hatch lines inside closed polygons (even-odd) every `interval`, at `angle` degrees, back and forth -> [[p0, p1] …] */
  function hatch(polys, interval, angle, bidir) {
    const a = ((angle || 0) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    const rot = ([x, y]) => [x * ca + y * sa, -x * sa + y * ca], back = ([x, y]) => [x * ca - y * sa, x * sa + y * ca];
    const P = polys.filter((p) => p.length > 2).map((p) => p.map(rot));
    if (!P.length || !(interval > 0)) return [];
    let y0 = Infinity, y1 = -Infinity; for (const p of P) for (const q of p) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    const out = []; let row = 0;
    for (let y = y0 + interval / 2; y < y1; y += interval, row++) {
      const xs = [];
      for (const p of P) for (let i = 0; i < p.length; i++) { const A = p[i], B = p[(i + 1) % p.length]; if ((A[1] <= y && B[1] > y) || (B[1] <= y && A[1] > y)) xs.push(A[0] + (y - A[1]) / (B[1] - A[1]) * (B[0] - A[0])); }
      xs.sort((m, n) => m - n);
      const segs = []; for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 1e-6) segs.push([[xs[i], y], [xs[i + 1], y]]);
      if (bidir !== false && row % 2 === 1) { segs.reverse(); segs.forEach((s) => s.reverse()); }
      for (const s of segs) out.push([back(s[0]), back(s[1])]);
    }
    return out;
  }
  function inside(pt, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  /** the order to cut: holes / inner shapes before the shapes round them, then nearest next; a closed path starts at its
   *  point nearest the head, an open one may run backwards. from = where the head is. */
  function order(paths, from) {
    const P = paths.filter((p) => p.pts && p.pts.length > 1).map((p) => Object.assign({}, p, { pts: p.pts.slice() }));
    const closed = P.filter((p) => p.closed);
    P.forEach((p) => { p.depth = closed.reduce((n, q) => n + (q !== p && inside(p.pts[0], q.pts) ? 1 : 0), 0); });
    const out = []; let head = from ? from.slice() : [0, 0];
    const depths = [...new Set(P.map((p) => p.depth))].sort((a, b) => b - a);
    for (const dpt of depths) {
      const left = P.filter((p) => p.depth === dpt);
      while (left.length) {
        let bi = 0, bd = Infinity, how = 0;
        left.forEach((p, i) => {
          if (p.closed) p.pts.forEach((q, j) => { const d = hyp(q[0] - head[0], q[1] - head[1]); if (d < bd) { bd = d; bi = i; how = j; } });
          else { const d0 = hyp(p.pts[0][0] - head[0], p.pts[0][1] - head[1]), d1 = hyp(p.pts[p.pts.length - 1][0] - head[0], p.pts[p.pts.length - 1][1] - head[1]); if (d0 < bd) { bd = d0; bi = i; how = 0; } if (d1 < bd) { bd = d1; bi = i; how = -1; } }
        });
        const p = left.splice(bi, 1)[0];
        if (p.closed && how > 0) { const ring = p.pts.slice(0, -1); p.pts = ring.slice(how).concat(ring.slice(0, how)); p.pts.push(p.pts[0].slice()); }
        else if (!p.closed && how === -1) p.pts.reverse();
        delete p.depth; out.push(p); head = p.pts[p.pts.length - 1];
      }
    }
    return out;
  }
  /** a picture's darkness (0..1, w x h) as engraving rows every rowStep px: [{y, runs: [{x0, x1, p}]}] (p 0..1; empty runs left
   *  out); mode floyd | threshold | grey; threshold 0..100 % */
  function rasterRows(dark, w, h, o) {
    const step = Math.max(0.05, o.rowStep || 1), mode = o.mode || "floyd", th = (o.threshold == null ? 50 : o.threshold) / 100;
    const nRows = Math.max(1, Math.floor(h / step)), rows = [];
    const grid = new Float32Array(nRows * w);
    for (let r = 0; r < nRows; r++) { const sy = Math.min(h - 1, Math.floor((r + 0.5) * step)); for (let x = 0; x < w; x++) grid[r * w + x] = dark[sy * w + x]; }
    if (mode === "floyd") {
      for (let r = 0; r < nRows; r++) for (let x = 0; x < w; x++) {
        const i = r * w + x, old = grid[i], nv = old >= 0.5 ? 1 : 0, e = old - nv; grid[i] = nv;
        if (x + 1 < w) grid[i + 1] += e * 7 / 16;
        if (r + 1 < nRows) { if (x > 0) grid[i + w - 1] += e * 3 / 16; grid[i + w] += e * 5 / 16; if (x + 1 < w) grid[i + w + 1] += e / 16; }
      }
    } else if (mode === "threshold") { for (let i = 0; i < grid.length; i++) grid[i] = grid[i] >= th ? 1 : 0; }
    else { for (let i = 0; i < grid.length; i++) grid[i] = Math.round(Math.max(0, Math.min(1, grid[i])) * 50) / 50; }
    for (let r = 0; r < nRows; r++) {
      const runs = []; let x = 0;
      while (x < w) { const p = grid[r * w + x]; let e = x + 1; while (e < w && grid[r * w + e] === p) e++; if (p > 0) runs.push({ x0: x, x1: e, p }); x = e; }
      if (runs.length) rows.push({ y: (r + 0.5) * step, runs });
    }
    return rows;
  }
  /** picture px -> machine mm: {mmpp, offX, offY, H (picture height px), origin} */
  const toMm = (x, y, t) => [t.offX + x * t.mmpp, t.origin === "tl" ? t.offY + y * t.mmpp : t.offY + (t.H - y) * t.mmpp];
  const f3 = (v) => { const r = Math.round(v * 1000) / 1000; return (Object.is(r, -0) ? 0 : r).toString(); };
  /** G-code for a job in mm: ops [{name, kind: "vector", paths: [{pts, closed}] | kind: "raster", rows: [{y, runs: [{x0, x1,
   *  p}], …}], power (0..1), minPower, speed, passes, overscan}]; machine as MACHINE */
  function gcode(job, mach) {
    const m = Object.assign({}, MACHINE, mach || {}), grbl = m.flavor !== "marlin", sMax = +m.sMax || (grbl ? 1000 : 255);
    const S = (p) => Math.round(Math.max(0, Math.min(1, p)) * sMax);
    const L = [`; bitGen Studio laser job - ${grbl ? "GRBL (laser mode on: $32=1)" : "Marlin (LASER_FEATURE)"}`, `; ${job.ops.length} operation(s), bed ${m.bedW} x ${m.bedH} mm, origin ${m.origin === "tl" ? "top-left" : "bottom-left"}`, "G21", "G90"];
    if (m.air) L.push("M8");
    const on = grbl ? (m.dynamic ? "M4" : "M3") : "M3";
    if (grbl) L.push(on + " S0");
    let laserOn = false;
    const off = () => { if (!grbl && laserOn) { L.push("M5"); laserOn = false; } };
    const power = (p) => { if (!grbl) { if (p > 0) { L.push(`M3 S${S(p)}`); laserOn = true; } else off(); } };
    for (const op of job.ops) {
      L.push(`; --- ${op.name}: ${op.kind} · ${Math.round(op.power * 100)} % · ${op.speed} mm/min · ${op.passes || 1} pass(es)`);
      for (let pass = 0; pass < Math.max(1, op.passes || 1); pass++) {
        if (op.kind === "vector") {
          for (const p of op.paths) {
            off(); L.push(`G0 X${f3(p.pts[0][0])} Y${f3(p.pts[0][1])}`);
            power(op.power);
            p.pts.slice(1).forEach((q, i) => L.push(`G1 X${f3(q[0])} Y${f3(q[1])}` + (i === 0 ? (grbl ? ` S${S(op.power)}` : "") + ` F${op.speed}` : "")));
          }
        } else if (op.kind === "raster") {
          const ov = op.overscan || 0;
          op.rows.forEach((row) => {
            const dir = row.dir || 1, rs = dir > 0 ? row.runs : row.runs.slice().reverse();
            const a = dir > 0 ? rs[0].x0 : rs[0].x1, z = dir > 0 ? rs[rs.length - 1].x1 : rs[rs.length - 1].x0;
            off(); L.push(`G0 X${f3(a - dir * ov)} Y${f3(row.y)}`);
            L.push(`G1 X${f3(a)}` + (grbl ? " S0" : "") + ` F${op.speed}`);
            let x = a;
            for (const r of rs) {
              const s0 = dir > 0 ? r.x0 : r.x1, s1 = dir > 0 ? r.x1 : r.x0;
              if (Math.abs(s0 - x) > 1e-6) { power(0); L.push(`G1 X${f3(s0)}` + (grbl ? " S0" : "")); }
              const pw = (op.minPower || 0) + (op.power - (op.minPower || 0)) * r.p;
              power(pw); L.push(`G1 X${f3(s1)}` + (grbl ? ` S${S(pw)}` : ""));
              x = s1;
            }
            power(0); L.push(`G1 X${f3(z + dir * ov)}` + (grbl ? " S0" : ""));
          });
        }
      }
    }
    off();
    L.push("M5");
    if (m.air) L.push("M9");
    L.push("G0 X0 Y0", "M2", "");
    return L.join("\n");
  }
  /** how long a job takes and how far it goes (mm, s) */
  function estimate(job, mach) {
    const m = Object.assign({}, MACHINE, mach || {}); let cut = 0, travel = 0, t = 0, head = [0, 0];
    const go = (p, feed, burn) => { const d = hyp(p[0] - head[0], p[1] - head[1]); if (burn) cut += d; else travel += d; t += d / ((burn ? feed : m.travel) / 60); head = p; };
    for (const op of job.ops) for (let pass = 0; pass < Math.max(1, op.passes || 1); pass++) {
      if (op.kind === "vector") for (const p of op.paths) { go(p.pts[0], m.travel, false); for (const q of p.pts.slice(1)) go(q, op.speed, true); }
      else for (const row of op.rows) { const dir = row.dir || 1, rs = row.runs, a = dir > 0 ? rs[0].x0 : rs[rs.length - 1].x1, z = dir > 0 ? rs[rs.length - 1].x1 : rs[0].x0, ov = op.overscan || 0; go([a - dir * ov, row.y], m.travel, false); const before = cut; go([z + dir * ov, row.y], op.speed, true); cut = before + rs.reduce((s, r) => s + Math.abs(r.x1 - r.x0), 0); }
    }
    return { cut: Math.round(cut), travel: Math.round(travel), seconds: Math.round(t) };
  }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, D, doc, say, ctx, newCanvas, kx, store } = E;
    if (!E.ui || !E.ui.addCmd) return;
    const $ = (id) => doc.getElementById(id) || E.$(id);
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
    const mach = () => Object.assign({}, MACHINE, store.get("laser.machine", {}) || {});
    const setMach = (m) => store.set("laser.machine", Object.assign(mach(), m));
    const opOf = (L) => Object.assign({}, OP_DEFAULT, L.laser || {});
    const dpi = () => { const pg = E.pages && E.pages.current ? E.pages.current() : null; return (pg && pg.dpi) || 150; };
    const job0 = () => Object.assign({ mmpp: 25.4 / dpi(), offX: 0, offY: 0 }, (S.laserJob && S.laserJob.w === S.w) ? S.laserJob : {});
    const leaves = () => S.layers.filter((L) => L.type !== "group" && L.type !== "adjust" && !L.control && L.visible !== false && D.shown(S.layers, L));
    /** a layer alone, rendered (its masks, styles …) */
    function alone(L, scale) {
      const keep = S.layers.map((x) => [x, x.visible]);
      S.layers.forEach((x) => { if (x !== L && x.type !== "group") x.visible = false; });
      let pic = null;
      try { pic = D.render({ w: S.w, h: S.h, layers: S.layers }, E.docEnv({ srcFor: (x) => x.canvas, maskSrc: null, skipControl: true })); } finally { keep.forEach(([x, v]) => { x.visible = v; }); }
      if (!pic || !(scale > 1)) return pic;
      const c = newCanvas(Math.round(S.w * scale), Math.round(S.h * scale)), g = ctx(c); g.imageSmoothingQuality = "high"; g.drawImage(pic, 0, 0, c.width, c.height); return c;
    }
    /** darkness 0..1 x alpha of a canvas */
    function darkOf(c) { const d = ctx(c).getImageData(0, 0, c.width, c.height).data, out = new Float32Array(c.width * c.height); for (let i = 0; i < out.length; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3] / 255; out[i] = (1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255) * a; } return out; }
    /** a layer's vectors (picture px): a shape / path through the export's recorder, type through its outlines */
    async function vectorsOf(L) {
      const X = root.PCDtpOut;
      if (L.type === "shape" && E.dtpOut) {
        const items = E.dtpOut.vectorOf(L, S.w, S.h);
        if (items) { const seen = new Set(), out = []; for (const it of items) { const k = JSON.stringify(it.segs); if (seen.has(k)) continue; seen.add(k); out.push(...flattenSegs(it.segs, 0.25)); } return out; }
      }
      if (L.type === "text" && L.text && root.PCType && root.PCType.outlinesOf && root.PCPath && X) {
        const r = await root.PCType.outlinesOf(L.text, ctx(newCanvas(4, 4)));
        if (r && r.path) { const R = X.recorder(S.w, S.h); root.PCPath.traceAll(R.ctx, r.path); R.ctx.fill(); if (R.items[0]) return flattenSegs(R.items[0].segs, 0.25); }
      }
      return null;
    }
    /** a picture layer as a mask at a finer scale (for tracing / offsets): {m, w, h, k} */
    function maskOf(L, o, mmpp) {
      const k = Math.max(1, Math.min(4, Math.ceil(mmpp / 0.1)));
      const scale = S.w * S.h * k * k > 12e6 ? Math.max(1, Math.floor(Math.sqrt(12e6 / (S.w * S.h)))) : k;
      const c = alone(L, scale), dk = darkOf(c), th = (o.threshold == null ? 50 : o.threshold) / 100, m = new Uint8Array(dk.length);
      for (let i = 0; i < dk.length; i++) m[i] = dk[i] >= th ? 1 : 0;
      return { m, w: c.width, h: c.height, k: scale, dark: dk };
    }
    const scalePaths = (ps, k) => (k === 1 ? ps : ps.map((p) => ({ pts: p.pts.map(([x, y]) => [x / k, y / k]), closed: p.closed })));
    /** the job: every layer with an operation -> ops in picture px, then in mm */
    async function build() {
      const J = job0(), m = mach(), ops = [], notes = [];
      const T = { mmpp: J.mmpp, offX: J.offX, offY: J.offY, H: S.h, origin: m.origin };
      const headPx = m.origin === "tl" ? [0, 0] : [0, S.h];
      for (const L of leaves()) {
        const o = opOf(L); if (o.op === "off") continue;
        const ipx = Math.max(0.01, o.interval) / J.mmpp;    // the interval in picture px
        let op = null;
        if (o.op === "image") {
          const c = alone(L, 1), dk = darkOf(c);
          const rows = rasterRows(dk, S.w, S.h, { rowStep: ipx, mode: o.dither, threshold: o.threshold });
          rows.forEach((r, i) => { r.dir = i % 2 ? -1 : 1; });
          op = { kind: "raster", rows: rows.map((r) => ({ y: toMm(0, r.y, T)[1], dir: r.dir, runs: r.runs.map((u) => ({ x0: toMm(u.x0, 0, T)[0], x1: toMm(u.x1, 0, T)[0], p: u.p })) })) };
        } else {
          let polys = await vectorsOf(L), paths = [];
          if (o.op === "line") {
            if (polys) paths = polys;
            else {
              const M = maskOf(L, o, J.mmpp);
              if (o.trace === "outline") paths = scalePaths(isolines(Float32Array.from(M.m), M.w, M.h, 0.5), M.k).map((p) => ({ pts: rdp(p.pts, 0.35), closed: p.closed }));
              else paths = scalePaths(skeletonPaths(thin(M.m, M.w, M.h), M.w, M.h, 2 * M.k).map((p) => ({ pts: rdp(p.pts.map(([x, y]) => [x + 0.5, y + 0.5]), 0.6), closed: p.closed })), M.k);
            }
          } else if (o.op === "fill") {
            let rings = polys ? polys.filter((p) => p.closed).map((p) => p.pts) : null;
            if (!rings || !rings.length) { const M = maskOf(L, o, J.mmpp); rings = scalePaths(isolines(Float32Array.from(M.m), M.w, M.h, 0.5), M.k).filter((p) => p.closed).map((p) => rdp(p.pts, 0.3)); }
            paths = hatch(rings, ipx, o.angle, true).map((sg) => ({ pts: sg, closed: false }));
          } else if (o.op === "offset") {
            const M = maskOf(L, o, J.mmpp), dist = distance(M.m, M.w, M.h), step = ipx * M.k;
            let mx = 0; for (let i = 0; i < dist.length; i++) if (dist[i] > mx) mx = dist[i];
            for (let lv = step / 2; lv < mx && paths.length < 20000; lv += step) paths.push(...isolines(dist, M.w, M.h, lv).map((p) => ({ pts: rdp(p.pts, 0.4), closed: p.closed })));
            paths = scalePaths(paths, M.k);
          }
          if (o.op !== "fill") paths = order(paths, headPx);
          if (!paths.length) { notes.push(`${L.name}: nothing to ${o.op}`); continue; }
          op = { kind: "vector", paths: paths.map((p) => ({ pts: p.pts.map(([x, y]) => toMm(x, y, T)), closed: p.closed })) };
        }
        if (!op || (op.kind === "raster" && !op.rows.length)) { notes.push(`${L.name}: nothing to engrave`); continue; }
        ops.push(Object.assign(op, { op: o.op, at: ops.length, name: L.name, layer: L.id, power: Math.max(0, Math.min(100, +o.power || 0)) / 100, minPower: Math.max(0, Math.min(100, +o.minPower || 0)) / 100, speed: Math.max(1, Math.round(+o.speed || 1000)), passes: Math.max(1, Math.round(+o.passes || 1)), overscan: Math.max(0, +o.overscan || 0) }));
      }
      // engrave first, cut last (a part cut free can move): Image, Fill, Offset fill, then Line - each kind bottom layer first
      const RANK = { image: 0, fill: 1, offset: 2, line: 3 };
      ops.sort((a, b) => RANK[a.op] - RANK[b.op] || a.at - b.at);
      const job = { ops };
      const box = (() => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const see = (p) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }; for (const op of ops) { if (op.kind === "vector") op.paths.forEach((p) => p.pts.forEach(see)); else op.rows.forEach((r) => r.runs.forEach((u) => { see([u.x0, r.y]); see([u.x1, r.y]); })); } return x1 >= x0 ? { x0, y0, x1, y1 } : null; })();
      return { job, est: estimate(job, m), notes, box, machine: m, T };
    }
    const COLORS = ["#e53935", "#1e88e5", "#43a047", "#fb8c00", "#8e24aa", "#00acc1", "#6d4c41", "#3949ab"];
    function drawPreview(res) {
      const cv = $("lzPrev"); if (!cv) return;
      // the view: the job (with a margin) when there is one, else the whole bed; machine mm -> preview px (y up for bottom-left)
      const m = res.machine, W = cv.width, H = cv.height, g = ctx(cv), bx = res.box;
      const v = bx ? (() => { const mx = Math.max(2, (bx.x1 - bx.x0) * 0.08), my = Math.max(2, (bx.y1 - bx.y0) * 0.08); return { x0: bx.x0 - mx, y0: bx.y0 - my, x1: bx.x1 + mx, y1: bx.y1 + my }; })() : { x0: 0, y0: 0, x1: m.bedW, y1: m.bedH };
      const k = Math.min(W / (v.x1 - v.x0), H / (v.y1 - v.y0));
      const P = ([x, y]) => [(x - v.x0) * k, m.origin === "tl" ? (y - v.y0) * k : H - (y - v.y0) * k];
      g.fillStyle = "#1b1b1b"; g.fillRect(0, 0, W, H);
      const b0 = P([0, 0]), b1 = P([m.bedW, m.bedH]); g.fillStyle = "#f4f1ea"; g.fillRect(Math.min(b0[0], b1[0]), Math.min(b0[1], b1[1]), Math.abs(b1[0] - b0[0]), Math.abs(b1[1] - b0[1]));
      g.lineWidth = 1; let head = [0, 0];
      res.job.ops.forEach((op, oi) => {
        g.strokeStyle = COLORS[oi % COLORS.length];
        if (op.kind === "vector") {
          for (const p of op.paths) {
            g.save(); g.setLineDash([2, 3]); g.strokeStyle = "rgba(120,120,120,.5)"; g.beginPath(); g.moveTo(...P(head)); g.lineTo(...P(p.pts[0])); g.stroke(); g.restore();
            g.beginPath(); g.moveTo(...P(p.pts[0])); for (const q of p.pts.slice(1)) g.lineTo(...P(q)); g.stroke(); head = p.pts[p.pts.length - 1];
          }
        } else for (const r of op.rows) for (const u of r.runs) { g.globalAlpha = 0.25 + 0.75 * u.p; g.beginPath(); g.moveTo(...P([u.x0, r.y])); g.lineTo(...P([u.x1, r.y])); g.stroke(); g.globalAlpha = 1; }
      });
    }
    let last = null;
    async function preview() {
      if (!S.w) return say("open a picture first");
      say("working out the toolpath…");
      try { last = await build(); } catch (e) { say("Laser: " + e.message); return null; }
      drawPreview(last);
      const e = last.est, b = last.box, mm = (v) => Math.round(v * 10) / 10;
      const t = `${Math.floor(e.seconds / 60)} min ${e.seconds % 60} s`;
      if ($("lzStats")) $("lzStats").textContent = last.job.ops.length ? `${last.job.ops.length} operation(s) · about ${t} · burn ${e.cut} mm · travel ${e.travel} mm` + (b ? ` · on the bed ${mm(b.x0)}-${mm(b.x1)} × ${mm(b.y0)}-${mm(b.y1)} mm` : "") : "No layer has an operation - pick one per layer above";
      const outside = b && (b.x0 < -0.01 || b.y0 < -0.01 || b.x1 > last.machine.bedW + 0.01 || b.y1 > last.machine.bedH + 0.01);
      say(last.job.ops.length ? `toolpath: ${last.job.ops.length} operation(s), about ${t}` + (outside ? " · ⚠ part of it is off the bed" : "") + (last.notes.length ? " · " + last.notes.join("; ") : "") : "no layer has a laser operation yet");
      return last;
    }
    async function save(download) {
      const r = await preview(); if (!r || !r.job.ops.length) return null;
      const code = gcode(r.job, r.machine), stem = String(S.bgiName || S.name || "laser").replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[^A-Za-z0-9 ._()-]+/g, "_").trim() || "laser";
      try {
        const res = await root.fetch("/api/laser/save?name=" + encodeURIComponent(stem + ".gcode"), { method: "POST", headers: { "Content-Type": "text/plain" }, body: code });
        const j = await res.json(); if (!res.ok) throw new Error(j.error || "the save was refused");
        if (download !== false) { const a = doc.createElement("a"); a.href = root.URL.createObjectURL(new root.Blob([code], { type: "text/plain" })); a.download = j.name; doc.body.appendChild(a); a.click(); setTimeout(() => { root.URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
        say(`saved ${j.name} (${code.split("\n").length} lines, ${r.machine.flavor === "marlin" ? "Marlin" : "GRBL"}) in the project's laser folder` + (download !== false ? " and downloaded" : ""));
        E.laserLast = { code, name: j.name };
        return Object.assign({ code }, j);
      } catch (e) { say("Save G-code failed: " + e.message); return null; }
    }
    /** ✎ Line art from the picture: the ControlNet line-art preprocessor -> a new layer, Line · centreline */
    async function lineArt() {
      if (!S.w) return say("open a picture first");
      const api = E.api; if (!api || !api.preprocess) return say("not connected (reload the page)");
      say("✎ line art from the picture (ControlNet line art)…");
      try {
        const blob = await new Promise((ok) => E.flatten().toBlob(ok, "image/png"));
        const url = await api.preprocess(blob, "lineart", say); if (!url) return null;
        const im = new root.Image(); im.src = url; await im.decode();
        const t = newCanvas(S.w, S.h), tg = ctx(t); tg.drawImage(im, 0, 0, S.w, S.h);
        const d = tg.getImageData(0, 0, S.w, S.h);
        for (let i = 0; i < d.data.length; i += 4) { const v = Math.max(d.data[i], d.data[i + 1], d.data[i + 2]); d.data[i] = d.data[i + 1] = d.data[i + 2] = 0; d.data[i + 3] = v; }
        const L = E.makeLayer("Line art", S.w, S.h); ctx(L.canvas).putImageData(d, 0, 0);
        L.laser = Object.assign({}, OP_DEFAULT, { op: "line", trace: "centre", power: 40, speed: 2000 });
        E.addLayer(L, "line art", false);
        paint(); say("Line art layer made - set to Line · centreline (⟳ Preview to see the toolpath)");
        return L;
      } catch (e) { say("Line art failed: " + e.message); return null; }
    }
    /* ---------------- the panel ---------------- */
    let panel = null;
    function css() {
      if (doc.getElementById("pclaserCss")) return;
      const s = doc.createElement("style"); s.id = "pclaserCss";
      s.textContent = ".kx .lzpanel{position:absolute;right:300px;top:70px;bottom:28px;width:420px;z-index:31;display:flex;flex-direction:column;background:var(--pc-panel);border:1px solid var(--pc-line);border-radius:4px;box-shadow:0 4px 18px rgba(0,0,0,.4);font-size:11px;color:var(--pc-text)}"
        + ".kx .lzpanel .lzh{display:flex;align-items:center;gap:6px;padding:4px 6px;border-bottom:1px solid var(--pc-line)}.kx .lzpanel .lzh b{flex:1}.kx .lzpanel .lzb{overflow:auto;flex:1;padding:6px;display:flex;flex-direction:column;gap:6px}"
        + ".kx .lzpanel fieldset{border:1px solid var(--pc-line);border-radius:4px;padding:4px 6px;margin:0}.kx .lzpanel legend{color:var(--pc-dim);padding:0 4px}.kx .lzpanel input[type=number]{width:58px}"
        + ".kx .lzpanel .lzr{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:2px 0}.kx .lzpanel .lzl{border-top:1px dashed var(--pc-line);padding:3px 0}.kx .lzpanel .lzl b{display:inline-block;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle}"
        + ".kx .lzpanel canvas#lzPrev{width:100%;background:#111;border-radius:3px}";
      doc.head.appendChild(s);
    }
    const shown = () => !!(panel && panel.style.display !== "none");
    function showPanel() { css(); if (!panel) { panel = doc.createElement("div"); panel.className = "lzpanel"; panel.id = "pcLaserPanel"; kx.appendChild(panel); } panel.style.display = ""; paint(); }
    function hidePanel() { if (panel) panel.style.display = "none"; }
    function setOp(L, patch) { L.laser = Object.assign({}, opOf(L), patch); }
    function paint() {
      if (!shown()) return;
      const m = mach(), J = job0();
      const rows = S.w ? leaves().slice().reverse().map((L) => {
        const o = opOf(L), id = L.id, pic = !(L.type === "shape" || L.type === "text");
        const more = o.op === "off" ? "" : `<div class="lzr">power <input type="number" data-lz="${id}" data-k="power" value="${o.power}" min="0" max="100">% speed <input type="number" data-lz="${id}" data-k="speed" value="${o.speed}" min="1" max="100000"> passes <input type="number" data-lz="${id}" data-k="passes" value="${o.passes}" min="1" max="50" style="width:40px"></div>`
          + `<div class="lzr">${o.op !== "line" ? `interval <input type="number" data-lz="${id}" data-k="interval" value="${o.interval}" min="0.01" max="10" step="0.01"> mm` : ""}${o.op === "fill" ? ` angle <input type="number" data-lz="${id}" data-k="angle" value="${o.angle}" min="-180" max="180">°` : ""}${o.op === "line" && pic ? `trace <select data-lz="${id}" data-k="trace"><option value="centre"${o.trace === "centre" ? " selected" : ""}>Centreline</option><option value="outline"${o.trace === "outline" ? " selected" : ""}>Outline</option></select>` : ""}${o.op === "image" ? ` <select data-lz="${id}" data-k="dither"><option value="floyd"${o.dither === "floyd" ? " selected" : ""}>Dithered</option><option value="threshold"${o.dither === "threshold" ? " selected" : ""}>Threshold</option><option value="grey"${o.dither === "grey" ? " selected" : ""}>Greyscale</option></select> min power <input type="number" data-lz="${id}" data-k="minPower" value="${o.minPower}" min="0" max="100">% overscan <input type="number" data-lz="${id}" data-k="overscan" value="${o.overscan}" min="0" max="50"> mm` : ""}${(pic && o.op !== "image") || o.dither === "threshold" ? ` threshold <input type="number" data-lz="${id}" data-k="threshold" value="${o.threshold}" min="1" max="99">%` : ""}</div>`;
        return `<div class="lzl"><div class="lzr"><b title="${esc(L.name)}">${esc(L.name)}</b><select data-lz="${id}" data-k="op">${OPS.map(([v, l]) => `<option value="${v}"${v === o.op ? " selected" : ""}>${l}</option>`).join("")}</select></div>${more}</div>`;
      }).join("") : '<div style="color:var(--pc-dim)">No picture open.</div>';
      panel.innerHTML = `<div class="lzh"><b>🔥 Laser</b><button class="ghost" id="lzHide" title="Hide (Window ▸ Laser shows it again)">✕</button></div>
        <div class="lzb">
          <fieldset><legend>Machine</legend>
            <div class="lzr"><select id="lzFlavor"><option value="grbl"${m.flavor === "grbl" ? " selected" : ""}>GRBL</option><option value="marlin"${m.flavor === "marlin" ? " selected" : ""}>Marlin</option></select> bed <input type="number" id="lzBedW" value="${m.bedW}" min="10" max="5000"> × <input type="number" id="lzBedH" value="${m.bedH}" min="10" max="5000"> mm</div>
            <div class="lzr">origin <select id="lzOrigin"><option value="bl"${m.origin === "bl" ? " selected" : ""}>bottom-left</option><option value="tl"${m.origin === "tl" ? " selected" : ""}>top-left</option></select> max S <input type="number" id="lzSMax" value="${m.sMax}" min="1" max="100000" title="GRBL $30 (1000), Marlin 255"> travel <input type="number" id="lzTravel" value="${m.travel}" min="100" max="100000"> mm/min</div>
            <div class="lzr"><label title="GRBL M4: the power follows the speed (cleaner corners)"><input type="checkbox" id="lzDyn"${m.dynamic ? " checked" : ""}> Dynamic power</label><label title="M8 at the start, M9 at the end"><input type="checkbox" id="lzAir"${m.air ? " checked" : ""}> Air assist</label></div>
          </fieldset>
          <fieldset><legend>Job</legend>
            <div class="lzr">size <input type="number" id="lzMmpp" value="${Math.round(J.mmpp * 10000) / 10000}" min="0.001" max="10" step="0.001" style="width:70px"> mm per px = ${S.w ? Math.round(S.w * J.mmpp * 10) / 10 + " × " + Math.round(S.h * J.mmpp * 10) / 10 + " mm" : "-"}</div>
            <div class="lzr">offset X <input type="number" id="lzOffX" value="${J.offX}"> Y <input type="number" id="lzOffY" value="${J.offY}"> mm</div>
          </fieldset>
          <fieldset><legend>Layers (top first)</legend>${rows}</fieldset>
          <div class="lzr"><button class="ghost" id="lzArt" title="The ControlNet line-art preprocessor on the visible picture - a new layer, traced as a centreline">✎ Line art from the picture</button></div>
          <canvas id="lzPrev" width="400" height="300"></canvas>
          <div id="lzStats" style="color:var(--pc-dim)"></div>
          <div class="lzr"><button class="ghost" id="lzGo">⟳ Preview</button><button id="lzSave">⤓ Save G-code</button></div>
        </div>`;
      $("lzHide").onclick = hidePanel;
      const num = (id) => +$(id).value;
      const mset = () => { setMach({ flavor: $("lzFlavor").value, bedW: num("lzBedW"), bedH: num("lzBedH"), origin: $("lzOrigin").value, sMax: num("lzSMax"), travel: num("lzTravel"), dynamic: $("lzDyn").checked, air: $("lzAir").checked }); };
      ["lzBedW", "lzBedH", "lzOrigin", "lzSMax", "lzTravel", "lzDyn", "lzAir"].forEach((id) => { $(id).onchange = mset; });
      $("lzFlavor").onchange = () => { const f = $("lzFlavor").value; setMach({ flavor: f, sMax: f === "marlin" ? 255 : 1000 }); paint(); };
      const jset = () => { S.laserJob = { w: S.w, mmpp: Math.max(0.001, num("lzMmpp")), offX: num("lzOffX") || 0, offY: num("lzOffY") || 0 }; paint(); };
      ["lzMmpp", "lzOffX", "lzOffY"].forEach((id) => { $(id).onchange = jset; });
      panel.querySelectorAll("[data-lz]").forEach((el) => {
        el.onchange = () => { const L = S.layers.find((x) => x.id === +el.dataset.lz); if (!L) return; const k = el.dataset.k; setOp(L, { [k]: el.tagName === "SELECT" ? el.value : +el.value }); if (k === "op" || k === "dither") paint(); };
      });
      $("lzArt").onclick = () => lineArt();
      $("lzGo").onclick = () => preview();
      $("lzSave").onclick = () => save();
      if (last) drawPreview(last);
    }
    // a document to the front / layers changed: the list follows
    const prevLP = E.renderLayersPanel;
    let sig = "";
    E.renderLayersPanel = function () { const r = prevLP.apply(this, arguments); if (shown()) { const k = S.layers.map((L) => L.id + (L.visible === false ? "h" : "")).join(","); if (k !== sig) { sig = k; paint(); } } return r; };
    const C = E.ui.addCmd;
    C("win.laser", "Laser", "", () => (shown() ? hidePanel() : showPanel()), { checked: () => shown() });
    const W = E.ui.MENUS.find(([x]) => x === "Window"); if (W) { const it = W[1], at = it.indexOf("win.pages"); it.splice(at >= 0 ? at + 1 : it.length, 0, "win.laser"); }
    E.laser = { build, preview, save, lineArt, showPanel, hidePanel, shown, setOp, opOf, machine: mach, setMachine: setMach, last: () => last };
  }

  const pure = { MACHINE, OPS, OP_DEFAULT, flattenSegs, rdp, thin, skeletonPaths, distance, isolines, hatch, order, rasterRows, toMm, gcode, estimate, inside };
  const api = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PCLaser = api;
})(typeof window !== "undefined" ? window : globalThis);
