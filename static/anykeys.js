/* bitGen Studio — static/anykeys.js (2.516.0): KEYFRAMES ON ANY PROPERTY. window.H3AnyKeys (UMD - lib/clipFx.js reads it).
 *
 * Tim (verbatim): "finish the last row" - AFTER-EFFECTS-GAP.md's last part-done row: "Keyframes on any property ...
 * every effect setting, mask points, text settings left".
 *
 * A clip's setting is keyed as "@<path>" in its own ◆ keys (c.kf - static/keyframes.js does the tween, the eases and
 * the graph editor's Bézier handles as for any key): "@fx.grade.exposure", "@masks.0.feather", "@text.size" ...
 *   RULES      the settings that can be keyed (a path pattern, a label, its unit, its limits, what makes the compile
 *              see it: lut = the colour LUT re-made at the keys and cross-faded; vfx = the effect animated by ffmpeg
 *              itself; mask = the masks' video made by the page; bake = the layer made by the page)
 *   apply(c, tau, KF)          the keyed values written onto the clip for that moment -> undo() puts them back (the
 *                              canvas draws a clip in between: canvas.js paintComp / drawClip)
 *   keyed(c) / has(c)          its "@" paths / any
 *   needsBake(c, kind)         keys only the page can draw (a picture layer's any; a video layer's time effects ...)
 *   forCompile(c, KF, fps)     {vfx: [{at, lens, warp_amount, ...}] (the effects' keys, sampled where the eases bend),
 *                              grade: [{at, fx}] (the clip's look at the colour keys - a LUT each), warp_type} | null
 * Pure (Node: scripts/test-anykeys516.js).
 */
(function (root) {
  "use strict";
  var GRADE_KEYS = ["exposure", "contrast", "saturation", "temperature", "tint", "hue"];
  /** k: the path's pattern; lab(m) its words; u its unit; ui = the input shows value * ui; c = how the compile gets it */
  var RULES = [
    { k: /^fx\.grade\.(exposure|contrast|saturation|temperature|tint|hue)$/, lab: function (m) { return "Colour " + m[1]; }, u: "", c: "lut", kinds: "v1 vl img" },
    { k: /^fx\.grade\.wheels\.(lift|gamma|gain)\.l$/, lab: function (m) { return "Colour " + m[1] + " brightness"; }, u: "", c: "lut", kinds: "v1 vl img" },
    { k: /^fx\.grade\.hsl\.(\d)\.(hue|width|shift|sat|lum)$/, lab: function (m) { return "HSL range " + (+m[1] + 1) + " " + m[2]; }, u: "", c: "lut", kinds: "v1 vl img" },
    { k: /^fx\.lut_mix$/, lab: function () { return "LUT mix"; }, u: "%", ui: 100, c: "lut", kinds: "v1 vl img" },
    { k: /^fx\.vfx\.lens$/, lab: function () { return "Lens"; }, u: "", c: "vfx", f: "lens", kinds: "v1 vl img" },
    { k: /^fx\.vfx\.warp\.(amount|size|speed)$/, lab: function (m) { return "Warp " + m[1]; }, u: "", c: "vfx", f: "warp_", kinds: "v1 vl img" },
    { k: /^fx\.vfx\.key\.(similarity|blend|spill)$/, lab: function (m) { return "Keyer " + ({ similarity: "match", blend: "edge", spill: "spill" }[m[1]]); }, u: "", c: "vfx", f: "key_", kinds: "v1 vl img" },
    { k: /^masks\.(\d{1,2})\.(feather|expand|op)$/, lab: function (m) { return "Mask " + (+m[1] + 1) + " " + ({ feather: "feather", expand: "expansion", op: "opacity" }[m[2]]); }, u: "px", c: "mask", kinds: "vl img" },
    { k: /^text\.(size|strokeW)$/, lab: function (m) { return m[1] === "size" ? "Text size" : "Text outline"; }, u: "px", c: "bake", kinds: "img" },
    { k: /^tm\.(shutter|samples|post)$/, lab: function (m) { return "Time " + ({ shutter: "shutter", samples: "samples", post: "posterize fps" }[m[1]]); }, u: "", c: "bake", kinds: "vl img" },
    { k: /^tm\.echo\.(n|dt|i0|decay)$/, lab: function (m) { return "Echo " + ({ n: "copies", dt: "apart", i0: "first", decay: "fade" }[m[1]]); }, u: "", ui: function (m) { return m[1] === "i0" || m[1] === "decay" ? 100 : 1; }, c: "bake", kinds: "vl img" },
  ];
  var KEYS = /^@[A-Za-z0-9_.]{1,80}$/;
  function rule(path) {
    for (var i = 0; i < RULES.length; i++) { var m = RULES[i].k.exec(path); if (m) return { r: RULES[i], m: m }; }
    return null;
  }
  function label(path) { var R = rule(path); return R ? R.r.lab(R.m) : path; }
  function uiK(path) { var R = rule(path); if (!R || R.r.ui == null) return 1; return typeof R.r.ui === "function" ? R.r.ui(R.m) : R.r.ui; }
  function allowed(path, kind) { var R = rule(path); return !!(R && (" " + R.r.kinds + " ").indexOf(" " + kind + " ") >= 0); }
  var seg = function (path) { return String(path).split("."); };
  function get(o, path) { var s = seg(path), x = o; for (var i = 0; i < s.length; i++) { if (x == null || typeof x !== "object") return undefined; x = x[s[i]]; } return x; }
  /** set a number at path (objects made on the way; an array index stays an array) */
  function set(o, path, v) {
    var s = seg(path), x = o;
    for (var i = 0; i < s.length - 1; i++) {
      var k = s[i];
      if (x[k] == null || typeof x[k] !== "object") x[k] = /^\d+$/.test(s[i + 1]) ? [] : {};
      x = x[k];
    }
    x[s[s.length - 1]] = v;
  }
  function del(o, path) { var s = seg(path), x = o; for (var i = 0; i < s.length - 1; i++) { if (x == null || typeof x !== "object") return; x = x[s[i]]; } if (x && typeof x === "object") delete x[s[s.length - 1]]; }
  /** the "@" paths keyed on this clip (that a rule knows) */
  function keyed(c) {
    var out = [];
    (c && Array.isArray(c.kf) ? c.kf : []).forEach(function (k) { for (var p in k) if (p.charAt(0) === "@" && KEYS.test(p) && out.indexOf(p.slice(1)) < 0 && rule(p.slice(1))) out.push(p.slice(1)); });
    return out;
  }
  function has(c) { return keyed(c).length > 0; }
  /** the keyed values at tau written onto c -> undo() (call it after drawing; nested calls undo in order). What it had
   *  to make on the way (fx.grade for a clip with no grade yet) is taken away again by undo */
  function apply(c, tau, KF) {
    var ps = keyed(c); if (!ps.length || !KF) return function () {};
    var saved = [], made = [];
    ps.forEach(function (p) {
      var s = seg(p);
      if (/^(masks|fx\.grade\.hsl)\./.test(p) && get(c, s.slice(0, -1).join(".")) == null) return;   // a key on a deleted mask / range
      var cur = get(c, p), v = KF.value(c.kf, tau, "@" + p, cur == null ? 0 : +cur);
      if (!Number.isFinite(+v)) return;
      var x = c;
      for (var i = 0; i < s.length - 1; i++) {
        if (x[s[i]] == null || typeof x[s[i]] !== "object") { x[s[i]] = /^\d+$/.test(s[i + 1]) ? [] : {}; made.push(s.slice(0, i + 1).join(".")); }
        x = x[s[i]];
      }
      saved.push([p, cur, cur !== undefined]);
      x[s[s.length - 1]] = +v;
    });
    return function () {
      for (var i = saved.length - 1; i >= 0; i--) { var q = saved[i]; if (q[2]) set(c, q[0], q[1]); else del(c, q[0]); }
      for (var j = made.length - 1; j >= 0; j--) del(c, made[j]);
    };
  }
  /** keys only the page can draw for this kind of layer */
  function needsBake(c, kind) {
    return keyed(c).some(function (p) { var R = rule(p); if (!R) return false; if (kind === "img") return true; return R.r.c === "bake"; });
  }
  var r4 = function (v) { return Math.round(v * 10000) / 10000; };
  /** the times a path's value has to be known at for a straight-line compile: its keys + inside the eased stretches */
  function times(c, paths, KF, every) {
    var t = [];
    paths.forEach(function (p) {
      var ks = (c.kf || []).filter(function (k) { return k["@" + p] != null; }).sort(function (a, b) { return a.at - b.at; });
      ks.forEach(function (k, i) {
        t.push(+k.at);
        var nx = ks[i + 1]; if (!nx || k.ease === "hold") { if (nx && k.ease === "hold") t.push(+nx.at - 1e-3); return; }
        var curved = k.ease && k.ease !== "linear";
        var n = curved ? 6 : 0;
        if (every) n = Math.max(n, Math.ceil((+nx.at - k.at) / every) - 1);     // a look between two keys is not a straight mix
        for (var j = 1; j <= n; j++) t.push(+k.at + (+nx.at - k.at) * j / (n + 1));
      });
    });
    t = t.filter(function (x) { return Number.isFinite(x) && x >= 0; }).sort(function (a, b) { return a - b; });
    var u = []; t.forEach(function (x) { if (!u.length || x - u[u.length - 1] > 1e-3) u.push(r4(x)); });
    return u;
  }
  /** what ⚙ Compile needs to animate the colour / the effects itself (V1, video layers, adjustment layers) */
  function forCompile(c, KF) {
    var ps = keyed(c); if (!ps.length || !KF) return null;
    var lut = ps.filter(function (p) { return rule(p).r.c === "lut"; }), vfx = ps.filter(function (p) { return rule(p).r.c === "vfx"; });
    var out = {};
    if (vfx.length) {
      out.vfx = times(c, vfx, KF).slice(0, 400).map(function (at) {
        var o = { at: at };
        vfx.forEach(function (p) {
          var R = rule(p), v = KF.value(c.kf, at, "@" + p, +(get(c, p) || 0));
          o[R.r.f === "lens" ? "lens" : R.r.f + R.m[1]] = r4(+v);
        });
        return o;
      });
      var w = get(c, "fx.vfx.warp"); if (w && w.type) out.warp_type = w.type;
    }
    if (lut.length) {
      var gt = times(c, lut, KF, 0.25);
      if (gt.length > 24) { var gk = []; for (var gi = 0; gi < 24; gi++) gk.push(gt[Math.round(gi * (gt.length - 1) / 23)]); gt = gk; }   // 24 looks at most
      out.grade = gt.map(function (at) {
        var fx = JSON.parse(JSON.stringify(c.fx || {}));
        var tmp = { fx: fx, kf: c.kf };
        lut.forEach(function (p) { var v = KF.value(c.kf, at, "@" + p, +(get(c, p) || 0)); if (Number.isFinite(+v)) set(tmp, p, +v); });
        return { at: at, fx: fx };
      });
    }
    return Object.keys(out).length ? out : null;
  }
  var api = { RULES: RULES, GRADE_KEYS: GRADE_KEYS, rule: rule, label: label, uiK: uiK, allowed: allowed, get: get, set: set, del: del, keyed: keyed, has: has, apply: apply, needsBake: needsBake, times: times, forCompile: forCompile };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.H3AnyKeys = api;
})(typeof window !== "undefined" ? window : globalThis);
