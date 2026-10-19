/* bitGen Studio — ext/timelinedock/tlparticles.js (2.506.0): ✨ PARTICLE GENERATOR LAYERS. window.TlParticles.
 *
 * Tim (verbatim): "lets do steps 1,2,3 , 4,5,6 and 7" - step 1: "particles, light rays, mesh / Bézier warp, puppet-pin
 * animation" (AFTER-EFFECTS-GAP.md, Generators / distortions).
 *
 * A particle layer is a 🌫 generator (tlgen.js) of kind "particles" - the 🌫 tool's Shift+click makes one where you
 * click. Its settings (🌫 Generator in the Properties, every number keyable gn_<name>):
 *   emitter     where (x, y from the frame's centre), its shape (point / line / box, width / height)
 *   birth       rate (a second), life (s), pre-roll (the air already full at the start)
 *   motion      speed (px/s) ± random %, direction (°, 0 = right, -90 = up) ± spread (°), gravity (px/s²), wind (px/s²)
 *   look        shape (soft dot / circle / square / star / spark streak), size start -> end ± random %, colour start ->
 *               end, opacity start -> end (%), seed
 * The particles are WORKED OUT, not simulated step by step: particle k is born at k / rate with its own random numbers
 * (from the seed and k), and its place at any age is the closed form p0 + v a + ½ g a². Any frame can be drawn on its
 * own, in any order, and the same seed always gives the same picture - so the bake (the compile) matches the canvas.
 * Pure (Node: scripts/test-particles.js): DEFAULTS, clean, rnd(seed, k, j), at(o, tau) -> [{x, y, size, a, mix, rot,
 * vx, vy}].
 */
(function (root) {
  "use strict";
  var DEFAULTS = { kind: "particles", ex: 0, ey: 120, emit: "point", ew: 300, eh: 60, rate: 40, life: 2, preroll: false,
    speed: 220, speedRand: 35, dir: -90, spread: 30, gravity: 160, wind: 0, shape: "dot", size0: 14, size1: 4, sizeRand: 30,
    c0: "#ffd27a", c1: "#ff4f1f", op0: 100, op1: 0, seed: 1 };
  var NUMS = ["ex", "ey", "ew", "eh", "rate", "life", "speed", "speedRand", "dir", "spread", "gravity", "wind", "size0", "size1", "sizeRand", "op0", "op1"];
  var SHAPES = ["dot", "circle", "square", "star", "spark"], EMITS = ["point", "line", "box"];
  var MAX = 6000;
  var nm = function (v, d, lo, hi) { var x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  var hex = function (v, d) { return /^#[0-9a-f]{6}$/i.test(String(v)) ? String(v).toLowerCase() : d; };
  function clean(g) {
    if (!g || typeof g !== "object" || g.kind !== "particles") return null;
    var D = DEFAULTS, o = { kind: "particles" };
    o.ex = nm(g.ex, D.ex, -1e5, 1e5); o.ey = nm(g.ey, D.ey, -1e5, 1e5);
    o.emit = EMITS.indexOf(g.emit) >= 0 ? g.emit : "point"; o.ew = nm(g.ew, D.ew, 0, 1e5); o.eh = nm(g.eh, D.eh, 0, 1e5);
    o.rate = nm(g.rate, D.rate, 0, 2000); o.life = nm(g.life, D.life, 0.05, 60); o.preroll = !!g.preroll;
    o.speed = nm(g.speed, D.speed, 0, 1e5); o.speedRand = nm(g.speedRand, D.speedRand, 0, 100);
    o.dir = nm(g.dir, D.dir, -36000, 36000); o.spread = nm(g.spread, D.spread, 0, 360);
    o.gravity = nm(g.gravity, D.gravity, -1e5, 1e5); o.wind = nm(g.wind, 0, -1e5, 1e5);
    o.shape = SHAPES.indexOf(g.shape) >= 0 ? g.shape : "dot";
    o.size0 = nm(g.size0, D.size0, 0, 2000); o.size1 = nm(g.size1, D.size1, 0, 2000); o.sizeRand = nm(g.sizeRand, D.sizeRand, 0, 100);
    o.c0 = hex(g.c0, D.c0); o.c1 = hex(g.c1, D.c1); o.op0 = nm(g.op0, D.op0, 0, 100); o.op1 = nm(g.op1, D.op1, 0, 100);
    o.seed = Math.round(nm(g.seed, 1, 0, 1e9));
    return o;
  }
  /** a random number in [0, 1) for particle k's j-th choice - the same every time for the same seed */
  function rnd(seed, k, j) {
    var h = (seed * 374761393 + k * 668265263 + j * 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; h = (h ^ (h >>> 16)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = (h ^ (h >>> 13)) >>> 0;
    return h / 4294967296;
  }
  /** the particles alive at tau (frame px from the centre), oldest first */
  function at(o, tau) {
    var out = [];
    if (!o || !(o.rate > 0)) return out;
    var t = (tau || 0) + (o.preroll ? o.life : 0), period = 1 / o.rate;
    var kHi = Math.floor(t / period), kLo = Math.max(0, Math.ceil((t - o.life) / period));
    if (kHi - kLo + 1 > MAX) kLo = kHi - MAX + 1;
    for (var k = kLo; k <= kHi; k++) {
      var age = t - k * period;
      if (age < 0 || age > o.life) continue;
      var r1 = rnd(o.seed, k, 1), r2 = rnd(o.seed, k, 2), r3 = rnd(o.seed, k, 3), r4 = rnd(o.seed, k, 4), r5 = rnd(o.seed, k, 5);
      var x0 = o.ex, y0 = o.ey;
      if (o.emit === "line") x0 += (r4 - 0.5) * o.ew;
      else if (o.emit === "box") { x0 += (r4 - 0.5) * o.ew; y0 += (r5 - 0.5) * o.eh; }
      var ang = (o.dir + (r1 - 0.5) * o.spread) * Math.PI / 180, sp = o.speed * (1 + (r2 - 0.5) * 2 * o.speedRand / 100);
      var vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
      var x = x0 + vx * age + 0.5 * o.wind * age * age, y = y0 + vy * age + 0.5 * o.gravity * age * age;
      var f = age / o.life, sz = (o.size0 + (o.size1 - o.size0) * f) * (1 + (r3 - 0.5) * 2 * o.sizeRand / 100);
      out.push({ x: x, y: y, size: Math.max(0, sz), a: Math.max(0, Math.min(1, (o.op0 + (o.op1 - o.op0) * f) / 100)), mix: f,
        rot: r5 * 360 + age * (r1 - 0.5) * 360, vx: vx + o.wind * age, vy: vy + o.gravity * age });
    }
    return out;
  }
  var pure = { DEFAULTS: DEFAULTS, NUMS: NUMS, SHAPES: SHAPES, EMITS: EMITS, MAX: MAX, clean: clean, rnd: rnd, at: at };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page: drawing (tlgen.js asks for it) ---------------- */
  function mix(a, b, f) { return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)]; }
  function rgbOf(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  /** draw o's particles at tau into g (a W x H canvas, the frame) */
  function draw(g, o, tau, W, H) {
    var ps = at(o, tau), A = rgbOf(o.c0), B = rgbOf(o.c1);
    g.save(); g.translate(W / 2, H / 2);
    ps.forEach(function (p) {
      if (p.a <= 0 || p.size <= 0) return;
      var c = mix(A, B, p.mix), col = "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")", r = p.size / 2;
      g.globalAlpha = p.a;
      if (o.shape === "dot") {
        var gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        gr.addColorStop(0, col); gr.addColorStop(1, "rgba(" + c[0] + "," + c[1] + "," + c[2] + ",0)");
        g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
      } else if (o.shape === "circle") { g.fillStyle = col; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill(); }
      else if (o.shape === "square") { g.save(); g.translate(p.x, p.y); g.rotate(p.rot * Math.PI / 180); g.fillStyle = col; g.fillRect(-r, -r, 2 * r, 2 * r); g.restore(); }
      else if (o.shape === "star") {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot * Math.PI / 180); g.fillStyle = col; g.beginPath();
        for (var i = 0; i < 10; i++) { var rr = i % 2 ? r * 0.45 : r, a = i * Math.PI / 5 - Math.PI / 2; if (i) g.lineTo(rr * Math.cos(a), rr * Math.sin(a)); else g.moveTo(rr * Math.cos(a), rr * Math.sin(a)); }
        g.closePath(); g.fill(); g.restore();
      } else {                                                    // spark: a streak along its motion
        var v = Math.hypot(p.vx, p.vy) || 1, L = Math.max(r * 2, Math.min(v * 0.06, 200));
        g.strokeStyle = col; g.lineWidth = Math.max(1, r * 0.5); g.lineCap = "round"; g.beginPath();
        g.moveTo(p.x - p.vx / v * L, p.y - p.vy / v * L); g.lineTo(p.x, p.y); g.stroke();
      }
    });
    g.restore(); g.globalAlpha = 1;
    return ps.length;
  }
  root.TlParticles = Object.assign({ draw: draw }, pure);
})(typeof window !== "undefined" ? window : globalThis);
