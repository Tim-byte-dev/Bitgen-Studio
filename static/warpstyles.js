/* bitGen Studio — static/warpstyles.js (2.608.0): THE WARP PRESETS, shared by the image editor and the timeline.
 * window.H3Warps / require().
 *
 * Tim (verbatim): "can we fill shapes with text, please add 5 more preset warps and an interactive warp grid for text and
 * shapes".
 * Sixteen warp styles - the eleven there were (Arc, Arc Lower, Arc Upper, Arch, Bulge, Flag, Wave, Fish, Rise, Inflate,
 * Squeeze) + five new: SHELL LOWER (the bottom bows down, the top pinches in), SHELL UPPER (the top bows up, the bottom
 * pinches in), FISHEYE (the middle swells out both ways), TWIST (turned round the middle, most at the centre), WEDGE
 * (one end tall, the other narrow - a taper).
 *   point(style, bend, u, v, asp) -> [dx, dy]   where the point (u -1 left .. 1 right, v 0 top .. 1 bottom) of a block
 *                                             moves, in fractions of its width / height; bend -100 .. 100; asp = w / h
 *                                             (twist turns round true circles). The column styles move only up / down:
 *                                             column(style, bend, u) -> [top, bottom] (unchanged since 2.397.0)
 *   isColumn(style)                           drawn column by column (exact); the others through a triangle mesh
 *   extent(style, bend, asp) -> {left, right, up, down}   how far the warped block reaches past its box (fractions)
 *   STYLES [[id, label]], NEW (the 2.608.0 five)
 * The page: draw(g, src, sx, sy, sw, sh, ox, oy, style, bend, n) - the block (src's sx, sy, sw, sh) warped with its box
 *   at ox, oy; mesh(g, src, sx, sy, sw, sh, n, map) - any (u 0..1, v 0..1) -> [x, y] picture mapping, drawn by triangles.
 */
(function (root) {
  "use strict";
  var STYLES = [["arc", "Arc"], ["arcLower", "Arc Lower"], ["arcUpper", "Arc Upper"], ["arch", "Arch"], ["bulge", "Bulge"],
    ["shellLower", "Shell Lower"], ["shellUpper", "Shell Upper"], ["flag", "Flag"], ["wave", "Wave"], ["fish", "Fish"], ["rise", "Rise"],
    ["fisheye", "Fisheye"], ["inflate", "Inflate"], ["squeeze", "Squeeze"], ["twist", "Twist"], ["wedge", "Wedge"]];
  var NEW = ["shellLower", "shellUpper", "fisheye", "twist", "wedge"];
  var TWO_D = { shellLower: 1, shellUpper: 1, fisheye: 1, twist: 1 };
  var clampB = function (bend) { return Math.max(-100, Math.min(100, +bend || 0)) / 100; };
  /** [top, bottom] moves of the column at u, fractions of the height (negative = up) */
  function column(style, bend, u) {
    var b = clampB(bend), c = 1 - u * u, s = Math.sin(u * Math.PI);
    switch (style) {
      case "arc": return [-b * c * 0.5, -b * c * 0.5];
      case "arcLower": return [0, b * c * 0.5];
      case "arcUpper": return [-b * c * 0.5, 0];
      case "arch": return [-b * c * 0.55, -b * c * 0.3];
      case "bulge": return [-b * c * 0.4, b * c * 0.4];
      case "inflate": { var k = Math.cos(u * Math.PI / 2); return [-b * k * 0.3, b * k * 0.3]; }
      case "flag": return [b * s * 0.3, b * s * 0.3];
      case "wave": return [b * s * 0.3, b * Math.sin(u * Math.PI - 0.9) * 0.3];
      case "fish": return [-b * c * 0.4, b * c * 0.4 * (u < 0 ? 1 : 1 - u)];
      case "rise": return [-b * u * 0.5, -b * u * 0.5];
      case "squeeze": return [b * c * 0.3, -b * c * 0.3];
      // 2.608.0
      case "shellLower": return [0, b * c * 0.6];
      case "shellUpper": return [-b * c * 0.6, 0];
      case "wedge": { var t = b * 0.42 * (u + 1) / 2; return [t, -t]; }
      default: return [0, 0];
    }
  }
  var isColumn = function (style) { return !TWO_D[style]; };
  function point(style, bend, u, v, asp) {
    var b = clampB(bend), A = asp > 0 ? asp : 1;
    if (style === "fisheye") {                        // the middle swells out - up / down most, and sideways from the centre
      var y = 2 * v - 1, cu = Math.max(0, 1 - u * u), k = b * 0.6;
      return [0.5 * u * cu * k * 0.6 * Math.max(0, 1 - 0.5 * y * y), 0.5 * y * cu * k];
    }
    if (style === "twist") {
      var px = u * 0.5 * A, py = v - 0.5, R = Math.hypot(0.5 * A, 0.5), rn = Math.min(1, Math.hypot(px, py) / R);
      var a = b * 1.3 * (1 - rn), ca = Math.cos(a), sa = Math.sin(a);
      return [(px * ca - py * sa - px) / A, px * sa + py * ca - py];
    }
    var tb = column(style, bend, u), dy = tb[0] * (1 - v) + tb[1] * v;
    if (style === "shellLower") return [-u * 0.5 * 0.3 * b * (1 - v), dy];      // the top pinched in
    if (style === "shellUpper") return [-u * 0.5 * 0.3 * b * v, dy];            // the bottom pinched in
    return [0, dy];
  }
  function extent(style, bend, asp) {
    var o = { left: 0, right: 0, up: 0, down: 0 };
    for (var j = 0; j <= 12; j++) for (var i = 0; i <= 24; i++) {
      var u = -1 + i / 12, v = j / 12, d = point(style, bend, u, v, asp), x = (u + 1) / 2 + d[0], y = v + d[1];
      o.left = Math.max(o.left, -x); o.right = Math.max(o.right, x - 1); o.up = Math.max(o.up, -y); o.down = Math.max(o.down, y - 1);
    }
    return o;
  }
  var api = { STYLES: STYLES, NEW: NEW, column: column, point: point, isColumn: isColumn, extent: extent };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (!root || !root.document) return;

  /* ---------------- the page: drawing ---------------- */
  function affineTri(s0, s1, s2, d0, d1, d2) {
    var sx1 = s1[0] - s0[0], sy1 = s1[1] - s0[1], sx2 = s2[0] - s0[0], sy2 = s2[1] - s0[1], det = sx1 * sy2 - sx2 * sy1;
    if (Math.abs(det) < 1e-12) return null;
    var dx1 = d1[0] - d0[0], dy1 = d1[1] - d0[1], dx2 = d2[0] - d0[0], dy2 = d2[1] - d0[1];
    var a = (dx1 * sy2 - dx2 * sy1) / det, c = (dx2 * sx1 - dx1 * sx2) / det, bb = (dy1 * sy2 - dy2 * sy1) / det, d = (dy2 * sx1 - dy1 * sx2) / det;
    return [a, bb, c, d, d0[0] - a * s0[0] - c * s0[1], d0[1] - bb * s0[0] - d * s0[1]];
  }
  /** src's (sx, sy, sw, sh) drawn through map(u, v) -> [x, y] on an n x n triangle mesh */
  function mesh(g, src, sx, sy, sw, sh, n, map) {
    var N = Math.max(2, n || 24), D = [], i, j;
    for (j = 0; j <= N; j++) for (i = 0; i <= N; i++) D.push(map(i / N, j / N));
    var S = function (i2, j2) { return [sx + i2 / N * sw, sy + j2 / N * sh]; };
    var tri = function (s0, s1, s2, d0, d1, d2) {
      var m = affineTri(s0, s1, s2, d0, d1, d2); if (!m) return;
      var cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
      var gr = function (p) { var dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * 0.6, p[1] + dy / l * 0.6]; };
      var e0 = gr(d0), e1 = gr(d1), e2 = gr(d2);
      g.save(); g.beginPath(); g.moveTo(e0[0], e0[1]); g.lineTo(e1[0], e1[1]); g.lineTo(e2[0], e2[1]); g.closePath(); g.clip();
      g.transform(m[0], m[1], m[2], m[3], m[4], m[5]); g.drawImage(src, 0, 0); g.restore();
    };
    for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
      var a = D[j * (N + 1) + i], b = D[j * (N + 1) + i + 1], c = D[(j + 1) * (N + 1) + i], d = D[(j + 1) * (N + 1) + i + 1];
      tri(S(i, j), S(i + 1, j), S(i + 1, j + 1), a, b, d); tri(S(i, j), S(i + 1, j + 1), S(i, j + 1), a, d, c);
    }
  }
  /** the block src(sx, sy, sw, sh) warped by a style, its unwarped box at (ox, oy) */
  function draw(g, src, sx, sy, sw, sh, ox, oy, style, bend, n) {
    var asp = sw / Math.max(1, sh);
    if (isColumn(style)) {
      for (var x = 0; x < sw; x++) {
        var u = Math.max(-1, Math.min(1, (x + 0.5) / Math.max(1, sw) * 2 - 1)), tb = column(style, bend, u);
        var top = oy + tb[0] * sh, bot = oy + sh + tb[1] * sh;
        if (bot - top > 0.5) g.drawImage(src, sx + x, sy, 1, sh, ox + x, top, 1.02, bot - top);
      }
      return;
    }
    mesh(g, src, sx, sy, sw, sh, n || 32, function (u, v) { var d = point(style, bend, u * 2 - 1, v, asp); return [ox + (u + d[0]) * sw, oy + (v + d[1]) * sh]; });
  }
  api.draw = draw; api.mesh = mesh; api.affineTri = affineTri;
  root.H3Warps = api;
})(typeof window !== "undefined" ? window : globalThis);
