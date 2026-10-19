/* bitGen Studio — ext/timelinedock/tlexpr.js (2.497.0): EXPRESSIONS on the timeline's layer properties. window.TlExpr.
 *
 * Tim (verbatim): "Merge Paths, freehand shape paths, text on a path, roving keyframes, and the rest of the After Effects
 * gap list (expressions, Bézier masks, tracking and so on)" - AFTER-EFFECTS-GAP.md: "Expressions (wiggle, loopOut,
 * time, links between properties) - a small safe expression language".
 *
 *   ƒx Expressions   (a canvas layer's Properties) a little formula on a property that works its value out each frame:
 *                    position x / y, scale (1 = its size), rotation (°), opacity (0..1), the anchor - and a shape's or
 *                    a text animator's numbers. A preset or your own; a mistake is said at once (the value then stays
 *                    what the keys say).
 *   The language     numbers, + - * / % ** ( ), comparisons, && || !, a ? b : c, "strings", several lines / ;-separated
 *                    with  var name = …  (the last line is the value). Never JavaScript: nothing else can run.
 *     values         value (what the keys / the setting say now), time (s on the timeline), t (s into the clip),
 *                    frame, fps, inPoint, outPoint, width, height (the picture), index (the layer's number), PI, E
 *     functions      wiggle(freq, amount[, octaves, ampMult]) · loopOut / loopIn("cycle" | "pingpong" | "offset" |
 *                    "continue") · valueAtTime(t) · linear / ease / easeIn / easeOut(t, tMin, tMax, v1, v2) (or (t, v1,
 *                    v2) with t 0..1) · clamp(v, lo, hi) · random() / random(max) / random(min, max) (new each frame,
 *                    the same every time) · noise(x) · layer("name", "x" | "y" | "scale" | "rot" | "op"[, time]) -
 *                    another layer's value (links) · sin cos tan asin acos atan atan2 abs min max round floor ceil
 *                    sqrt pow exp log sign · degreesToRadians / radiansToDegrees · posterize(v, step)
 *   The compile      a layer moved by an expression reaches ⚙ Compile as keys sampled every frame (TlParent.worldKeys -
 *                    thinned to where the motion bends); shapes and text animators are baked by the page anyway.
 * Pure (Node: scripts/test-expr.js): parse, compile, evaluate, noise1, hash, PRESETS, PROPS.
 */
(function (root) {
  "use strict";
  /* ---------------- the language ---------------- */
  var KW = { "var": 1, "let": 1, "const": 1 }, isKW = function (v) { return Object.prototype.hasOwnProperty.call(KW, v); };
  function tokens(src) {
    var s = String(src == null ? "" : src), out = [], i = 0, m;
    var re = /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(\*\*|<=|>=|==|!=|&&|\|\||[-+*/%(),?:<>!=;\n\[\]])/y;
    while (i < s.length) {
      re.lastIndex = i; m = re.exec(s);
      if (!m) throw new Error("I can't read \"" + s.slice(i, i + 8) + "\"");
      i = re.lastIndex;
      if (m[1] != null) out.push({ k: "num", v: parseFloat(m[1]) });
      else if (m[2] != null) out.push({ k: "id", v: m[2].replace(/^(Math|thisComp|thisLayer|thisProperty)\./, "") });
      else if (m[3] != null) out.push({ k: "str", v: m[3].slice(1, -1).replace(/\\(.)/g, "$1") });
      else if (m[4] != null) out.push({ k: m[4] === "\n" ? ";" : m[4] });
      else if (/\n/.test(m[0])) out.push({ k: ";" });
    }
    return out;
  }
  function parse(src) {
    var T = tokens(src), p = 0;
    var peek = function () { return T[p] || { k: "end" }; }, next = function () { return T[p++] || { k: "end" }; };
    var want = function (k) { var x = next(); if (x.k !== k) throw new Error("expected " + (k === "end" ? "the end" : "\"" + k + "\"") + (x.k === "end" ? " - it ends too soon" : " near \"" + (x.v != null ? x.v : x.k) + "\"")); return x; };
    function program() {
      var body = [];
      while (peek().k !== "end") {
        if (peek().k === ";") { next(); continue; }
        body.push(stmt());
        if (peek().k !== "end") want(";");
      }
      if (!body.length) throw new Error("empty");
      return { t: "prog", body: body };
    }
    function stmt() {
      if (peek().k === "id" && isKW(peek().v)) { next(); var n = want("id").v; want("="); return { t: "set", n: n, e: expr() }; }
      if (peek().k === "id" && T[p + 1] && T[p + 1].k === "=") { var n2 = next().v; next(); return { t: "set", n: n2, e: expr() }; }
      return expr();
    }
    function expr() { var c = or(); if (peek().k === "?") { next(); var a = expr(); want(":"); var b = expr(); return { t: "tern", c: c, a: a, b: b }; } return c; }
    function bin(sub, ops) { return function () { var a = sub(); while (ops.indexOf(peek().k) >= 0) { var op = next().k; a = { t: "bin", op: op, a: a, b: sub() }; } return a; }; }
    var unary = function () { var k = peek().k; if (k === "-" || k === "+" || k === "!") { next(); return { t: "un", op: k, a: unary() }; } return pow(); };
    function pow() { var a = call(); if (peek().k === "**") { next(); return { t: "bin", op: "**", a: a, b: unary() }; } return a; }
    function call() {
      var a = primary();
      while (peek().k === "(" || peek().k === "[") {
        if (peek().k === "[") { next(); var ix = expr(); want("]"); a = { t: "idx", a: a, i: ix }; continue; }
        if (a.t !== "id") throw new Error("only a function can be called");
        next(); var args = [];
        if (peek().k !== ")") { args.push(expr()); while (peek().k === ",") { next(); args.push(expr()); } }
        want(")"); a = { t: "call", f: a.n, args: args };
      }
      return a;
    }
    var mul = bin(unary, ["*", "/", "%"]), add = bin(mul, ["+", "-"]), cmp = bin(add, ["<", "<=", ">", ">="]), eq = bin(cmp, ["==", "!="]), and = bin(eq, ["&&"]), or = bin(and, ["||"]);
    function primary() {
      var x = next();
      if (x.k === "num") return { t: "num", v: x.v };
      if (x.k === "str") return { t: "str", v: x.v };
      if (x.k === "id") return { t: "id", n: x.v };
      if (x.k === "(") { var e = expr(); want(")"); return e; }
      if (x.k === "[") { var items = []; if (peek().k !== "]") { items.push(expr()); while (peek().k === ",") { next(); items.push(expr()); } } want("]"); return { t: "arr", items: items }; }
      throw new Error(x.k === "end" ? "it ends too soon" : "unexpected \"" + (x.v != null ? x.v : x.k) + "\"");
    }
    var ast = program();
    return ast;
  }

  /* ---------------- the built-ins ---------------- */
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function noise1(x) { var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (hash(i) * 2 - 1) * (1 - u) + (hash(i + 1) * 2 - 1) * u; }
  function seedOf(str) { var h = 0, s = String(str || ""); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000003; return h / 997; }
  var D2R = Math.PI / 180;
  var MATH = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2, abs: Math.abs, min: Math.min, max: Math.max,
    round: function (v, d) { var k = Math.pow(10, d || 0); return Math.round(v * k) / k; }, floor: Math.floor, ceil: Math.ceil, sqrt: Math.sqrt, pow: Math.pow, exp: Math.exp, log: Math.log, sign: Math.sign,
    degreesToRadians: function (d) { return d * D2R; }, radiansToDegrees: function (r) { return r / D2R; },
    clamp: function (v, a, b) { return Math.max(Math.min(a, b), Math.min(Math.max(a, b), v)); },
    noise: function (x) { return noise1(+x || 0); },
    posterize: function (v, step) { return step ? Math.round(v / step) * step : v; },
  };
  function mapT(f) {
    return function (t, a, b, c, d) {
      if (arguments.length <= 3) { var u0 = Math.max(0, Math.min(1, +t)); return a + (b - a) * f(u0); }
      var u = b === a ? (t >= b ? 1 : 0) : Math.max(0, Math.min(1, (t - a) / (b - a)));
      return c + (d - c) * f(u);
    };
  }
  MATH.linear = mapT(function (u) { return u; });
  MATH.ease = mapT(function (u) { return u * u * (3 - 2 * u); });
  MATH.easeIn = mapT(function (u) { return u * u; });
  MATH.easeOut = mapT(function (u) { return 1 - (1 - u) * (1 - u); });
  var CONSTS = { PI: Math.PI, E: Math.E };

  /** evaluate an AST with a context {vars: {...}, fns: {...}} -> a number (or a string / array inside) */
  function run(ast, ctx) {
    var steps = 0, vars = Object.assign(Object.create(null), CONSTS, ctx.vars || {}), fns = ctx.fns || {};
    function ev(n) {
      if (++steps > 20000) throw new Error("too long a sum");
      switch (n.t) {
        case "num": return n.v;
        case "str": return n.v;
        case "arr": return n.items.map(ev);
        case "id": { if (Object.prototype.hasOwnProperty.call(vars, n.n)) return vars[n.n]; var g = Object.prototype.hasOwnProperty.call(fns, n.n) ? fns[n.n] : Object.prototype.hasOwnProperty.call(MATH, n.n) ? MATH[n.n] : null; if (g) return g(); throw new Error("I don't know \"" + n.n + "\""); }
        case "idx": { var a = ev(n.a), i = ev(n.i); return Array.isArray(a) ? a[Math.round(i)] : NaN; }
        case "un": { var v = ev(n.a); return n.op === "-" ? -v : n.op === "!" ? (v ? 0 : 1) : +v; }
        case "tern": return ev(n.c) ? ev(n.a) : ev(n.b);
        case "set": vars[n.n] = ev(n.e); return vars[n.n];
        case "prog": { var r = 0; n.body.forEach(function (s) { r = ev(s); }); return r; }
        case "call": {
          var f = Object.prototype.hasOwnProperty.call(fns, n.f) ? fns[n.f] : Object.prototype.hasOwnProperty.call(MATH, n.f) ? MATH[n.f] : null;
          if (!f) throw new Error("I don't know the function \"" + n.f + "\"");
          return f.apply(null, n.args.map(ev));
        }
        case "bin": {
          if (n.op === "&&") { var l = ev(n.a); return l ? ev(n.b) : l; }
          if (n.op === "||") { var l2 = ev(n.a); return l2 ? l2 : ev(n.b); }
          var x = ev(n.a), y = ev(n.b);
          if (Array.isArray(x) || Array.isArray(y)) {                   // [a, b] + [c, d] like AE's arrays
            var X = [].concat(x), Y = [].concat(y), len = Math.max(X.length, Y.length), o = [];
            for (var k = 0; k < len; k++) o.push(binop(n.op, X[k] == null ? X[0] : X[k], Y[k] == null ? Y[0] : Y[k]));
            return o;
          }
          return binop(n.op, x, y);
        }
      }
      throw new Error("?");
    }
    return ev(ast);
  }
  function binop(op, x, y) {
    switch (op) {
      case "+": return typeof x === "string" || typeof y === "string" ? String(x) + String(y) : x + y;
      case "-": return x - y; case "*": return x * y; case "/": return x / y; case "%": return x % y; case "**": return Math.pow(x, y);
      case "<": return x < y ? 1 : 0; case "<=": return x <= y ? 1 : 0; case ">": return x > y ? 1 : 0; case ">=": return x >= y ? 1 : 0;
      case "==": return x === y ? 1 : 0; case "!=": return x !== y ? 1 : 0;
    }
    return NaN;
  }
  var CACHE = new Map();
  /** src -> {ok, ast, err} (cached) */
  function compile(src) {
    var k = String(src);
    if (CACHE.has(k)) return CACHE.get(k);
    var r; try { r = { ok: true, ast: parse(k) }; } catch (e) { r = { ok: false, err: e.message }; }
    if (CACHE.size > 500) CACHE.clear();
    CACHE.set(k, r); return r;
  }
  /** the standard context: o = {time, t, value, fps, inPoint, outPoint, width, height, index, seed, valueAt(time),
   *  keys: [[at (s into the clip), v]...], start, layer(name, prop, time)} */
  function context(o) {
    var fps = o.fps || 24, time = +o.time || 0, seed = seedOf(o.seed);
    var vAt = function (tt) { return o.valueAt ? o.valueAt(+tt) : o.value; };
    var ks = (o.keys || []).slice().sort(function (a, b) { return a[0] - b[0]; }), start = +o.start || 0;
    function loop(out, type, nk) {
      if (ks.length < 2) return o.value;
      var tau = time - start, a = ks[0], b = ks[ks.length - 1], n = Math.max(0, Math.round(+nk || 0));
      if (n >= 2) { if (out) a = ks[Math.max(0, ks.length - n)]; else b = ks[Math.min(ks.length - 1, n - 1)]; }
      var span = b[0] - a[0]; if (!(span > 1e-9)) return o.value;
      if (out ? tau <= b[0] : tau >= a[0]) return o.value;
      var ty = String(type || "cycle"), d = out ? tau - b[0] : a[0] - tau;
      if (ty === "continue") {
        var p0 = out ? vAt(start + b[0] - 1 / fps) : vAt(start + a[0] + 1 / fps), slope = out ? (b[1] - p0) * fps : (p0 - a[1]) * fps;
        return out ? b[1] + slope * d : a[1] - slope * d;
      }
      var cyc = Math.floor(d / span), f = d - cyc * span, at;
      if (ty === "pingpong") at = (cyc % 2 === 0) ? (out ? b[0] - f : a[0] + f) : (out ? a[0] + f : b[0] - f);
      else at = out ? a[0] + f : b[0] - f;
      var v = vAt(start + at);
      if (ty === "offset") v += (out ? 1 : -1) * (cyc + 1) * (b[1] - a[1]);
      return v;
    }
    var vars = { value: o.value, time: time, t: time - start, frame: Math.round(time * fps), fps: fps, inPoint: start, outPoint: o.outPoint != null ? o.outPoint : start + 5,
      width: o.width || 1280, height: o.height || 720, index: o.index || 1 };
    var fns = {
      wiggle: function (freq, amp, oct, mult, tt) {
        var f = +freq || 0, A = +amp || 0, n = Math.max(1, Math.min(8, Math.round(+oct || 1))), m = mult == null ? 0.5 : +mult, x = (tt == null ? time : +tt) * f, s = 0, k = 1, w = 1;
        for (var i = 0; i < n; i++) { s += noise1(x * k + seed * (i + 1) * 13.7) * w; k *= 2; w *= m; }
        return o.value + A * s;
      },
      loopOut: function (type, n) { return loop(true, type, n); },
      loopIn: function (type, n) { return loop(false, type, n); },
      valueAtTime: function (tt) { return vAt(tt); },
      random: function (a, b) { var r = hash(seed * 7.13 + Math.round(time * fps) * 0.618 + 1); return a == null ? r : b == null ? r * a : a + (b - a) * r; },
      seedRandom: function (n) { seed = seedOf(o.seed) + (+n || 0) * 3.7; return 0; },
      layer: function (name, prop, tt) { return o.layer ? o.layer(String(name), String(prop || "x"), tt == null ? time : +tt) : NaN; },
      audio: function (what, tt) { return o.audio ? o.audio(String(what || "amp"), tt == null ? time : +tt) : 0; },
      data: function (set, col, row) { return o.data ? o.data(String(set), String(col), row == null ? null : +row) : NaN; },   // 2.511.0: 📋 a data set's value (a number)   // 2.508.0: ♪ the mix's loudness / bass / mid / treble 0..1
    };
    return { vars: vars, fns: fns };
  }
  /** evaluate src with the context options -> {ok, v, err} (v = a finite number, else ok = false) */
  function evaluate(src, o) {
    var c = compile(src); if (!c.ok) return { ok: false, err: c.err };
    try {
      var v = run(c.ast, context(o));
      if (Array.isArray(v)) v = v[0];
      if (typeof v === "string") v = parseFloat(v);
      if (typeof v !== "number" || !isFinite(v)) return { ok: false, err: "the answer is not a number" };
      return { ok: true, v: v };
    } catch (e) { return { ok: false, err: e.message }; }
  }
  var PRESETS = [
    ["wiggle(2, 20)", "Wiggle: 2 a second, 20 px (or °)"], ["time * 90", "Turn 90° a second"], ["loopOut()", "Loop the keys (cycle)"],
    ["loopOut(\"pingpong\")", "Loop the keys there and back"], ["loopOut(\"continue\")", "Carry on past the last key"],
    ["value + sin(time * 4) * 30", "Swing 30 either side"], ["linear(t, 0, 2, 0, 1)", "Fade in over 2 s (opacity)"],
    ["random(-10, 10) + value", "Jitter each frame"], ["layer(\"Null 1\", \"x\")", "Follow another layer's x"],
    ["posterize(value, 20)", "Snap to steps of 20"],
    ["value * (1 + audio() * 0.5)", "Pulse with the sound's loudness (♪ 2.508)"], ["value + audio(\"bass\") * 40", "Kick 40 with the bass"], ["data(\"data\", \"value\", floor(t) + 1)", "A data column, one row a second (📋 2.511)"],
  ];
  var PROPS = [["x", "Position x"], ["y", "Position y"], ["scale", "Scale (1 = its size)"], ["rot", "Rotation °"], ["op", "Opacity (0 - 1)"], ["ax", "Anchor x"], ["ay", "Anchor y"]];
  var pure = { tokens: tokens, parse: parse, compile: compile, run: run, evaluate: evaluate, context: context, noise1: noise1, hash: hash, seedOf: seedOf, PRESETS: PRESETS, PROPS: PROPS, MATH: MATH };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page ---------------- */
  root.TlExpr = Object.assign({ ready: false }, pure);
  function ready() { try { return !!(window.TlCanvas && TlCanvas.onProps && TlCanvas.tfAt && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.TlExpr.ready) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24, X = root.TlExpr;
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    var all = function () { return window.TlParent ? TlParent.all() : []; };
    var depth = 0, errs = {};
    var TFP = ["x", "y", "scale", "rot", "ax", "ay"];
    /** another layer's value at comp time tt (its own expression too) - by its layer name */
    function layerVal(name, prop, tt) {
      var hit = all().filter(function (x) { return (x.L.name || "") === name; })[0]; if (!hit) throw new Error("no layer called \"" + name + "\"");
      if (prop === "op") return opWith(hit.c, tt);
      var tf = C.tfAt(hit.c, tt); if (!(prop in tf)) throw new Error("\"" + prop + "\" is not x, y, scale, rot or op"); return tf[prop];
    }
    function opWith(c, tt) { var o = c.opacity == null ? 1 : +c.opacity; o = KF.value(c.kf, tt - (c.start || 0), "op", o); return num(c, "op", tt - (c.start || 0), o); }
    /** prop's value with its expression (tau = s into the clip; base = what the keys / setting say) */
    var dataVal = function (s, col, row) { return window.TlData && TlData.num ? TlData.num(s, col, row) : NaN; };   // 2.511.0: ƒx data()
    var audioVal = function (what, tt) { return window.TlAudio && TlAudio.level ? TlAudio.level("mix", what, tt) : 0; };   // 2.508.0: ƒx audio()
    function num(c, prop, tau, base, fb) {
      var src = c && c.expr && c.expr[prop]; if (!src || depth > 6) return base;
      depth++;
      try {
        var start = c.start || 0, keys = (c.kf || []).filter(function (k) { return k[prop] != null && typeof k[prop] === "number"; }).map(function (k) { return [k.at, k[prop]]; });
        var stat = fb != null ? fb : base;
        var r = X.evaluate(src, { time: start + tau, value: base, fps: FPS, start: start, outPoint: start + (C.clipLen ? C.clipLen(c, kindOf(c)) : 5), width: C.state.W, height: C.state.H, seed: (c.uid || "") + ":" + prop,
          keys: keys, valueAt: function (tt) { return keys.length ? KF.value(c.kf, tt - start, prop, stat) : stat; }, layer: layerVal, index: indexOf(c), audio: audioVal, data: dataVal });
        var k = (c.uid || "?") + ":" + prop;
        if (r.ok) { if (errs[k]) delete errs[k]; return r.v; }
        errs[k] = r.err; return base;
      } finally { depth--; }
    }
    function kindOf(c) { var x = all().filter(function (q) { return q.c === c; })[0]; return x ? x.kind : "img"; }
    function indexOf(c) { var A = all(), i = A.findIndex(function (q) { return q.c === c; }); return i + 1; }
    /** the transform with its expressions (canvas.js tfAt calls this) */
    function tf(c, tau, o) { if (!c.expr) return o; TFP.forEach(function (p) { if (c.expr[p]) o[p] = num(c, p, tau, o[p]); }); if (o.scale != null) o.scale = Math.max(0.01, o.scale); return o; }
    /** a layer an expression moves (the compile samples it) */
    function moves(c) { return !!(c && c.expr && (TFP.some(function (p) { return !!c.expr[p]; }) || !!c.expr.op)); }
    /* ---- ƒx in the Properties */
    function propsOf(c) {
      var P = PROPS.slice();
      if (c.shape && window.TlShape) TlShape.NUMS.forEach(function (k) { P.push(["sh_" + k, "Shape " + k]); });
      if (c.text && c.text.anim) c.text.anim.forEach(function (_, n) { ["x", "y", "scale", "rot", "op", "offset", "start", "end"].forEach(function (k) { P.push(["ta" + n + "_" + k, "Text animator " + (n + 1) + " " + k]); }); });
      if (c.text && c.text.onpath) P.push(["tp_off", "Text path start %"], ["tp_r", "Text path radius"]);
      return P;
    }
    C.onProps(function (Pn, c, sel) {
      if (!c || !Pn || !sel || !sel.Ly || sel.Ly.kind === "v1" || sel.Ly.kind === "aud") return;
      var E = c.expr || {}, P = propsOf(c), lab = {}; P.forEach(function (q) { lab[q[0]] = q[1]; });
      var d = document.createElement("div"); d.className = "tlp-expr";
      var h = '<div class="tlp-t">ƒx Expressions</div>';
      Object.keys(E).forEach(function (p) {
        var er = errs[(c.uid || "?") + ":" + p], cp = X.compile(E[p]);
        h += '<div class="tlp-row" style="flex-wrap:wrap"><span style="min-width:86px" title="' + esc(p) + '">' + esc(lab[p] || p) + '</span><input type="text" data-ex="' + esc(p) + '" value="' + esc(E[p]) + '" spellcheck="false" style="flex:1;min-width:120px;font-family:var(--mono,monospace)">'
          + '<button class="ghost" data-exx="' + esc(p) + '" title="Take the expression off">✕</button>'
          + '<span class="tlp-exe" data-exe="' + esc(p) + '" style="width:100%;color:' + (!cp.ok || er ? "#e5534b" : "var(--dim,#999)") + '">' + esc(!cp.ok ? cp.err : er || "✓") + "</span></div>";
      });
      h += '<div class="tlp-row" style="flex-wrap:wrap"><select id="tlpExP">' + P.filter(function (q) { return !E[q[0]]; }).map(function (q) { return '<option value="' + q[0] + '">' + esc(q[1]) + "</option>"; }).join("") + "</select>"
        + '<select id="tlpExPre">' + PRESETS.map(function (q) { return '<option value="' + esc(q[0]) + '">' + esc(q[1]) + "</option>"; }).join("") + '</select><button class="ghost" id="tlpExAdd" title="An expression on that property (edit it above)">＋ ƒx</button></div>';
      d.innerHTML = h; Pn.appendChild(d);
      var save = function (repaint) { delete c.bakeSig; if (typeof tlSave === "function") tlSave(); C.mark(); if (repaint) C.paintProps(); };
      d.querySelector("#tlpExAdd").addEventListener("click", function () {
        var p = d.querySelector("#tlpExP").value, src = d.querySelector("#tlpExPre").value; if (!p) return;
        c.expr = Object.assign({}, c.expr || {}); c.expr[p] = src; save(true); say("ƒx " + (lab[p] || p) + " = " + src);
      });
      d.querySelectorAll("[data-ex]").forEach(function (el) {
        el.addEventListener("keydown", function (e) { e.stopPropagation(); });
        el.addEventListener("input", function () {
          var p = el.dataset.ex, cp = X.compile(el.value), out = d.querySelector('[data-exe="' + p + '"]');
          if (cp.ok) { c.expr[p] = el.value; save(false); }
          var er = cp.ok ? null : cp.err;
          if (cp.ok) { var tau = C.tauOf(c, sel.Ly.kind); var r = X.evaluate(el.value, { time: (c.start || 0) + tau, value: 0, fps: FPS, start: c.start || 0, seed: c.uid, layer: layerVal, audio: audioVal, data: dataVal }); if (!r.ok) er = r.err; }
          if (out) { out.textContent = er || "✓"; out.style.color = er ? "#e5534b" : "var(--dim,#999)"; }
        });
      });
      d.querySelectorAll("[data-exx]").forEach(function (el) { el.addEventListener("click", function () { delete c.expr[el.dataset.exx]; if (!Object.keys(c.expr).length) delete c.expr; save(true); }); });
    });
    Object.assign(root.TlExpr, { ready: true, num: num, tf: tf, moves: moves, errors: function () { return Object.assign({}, errs); }, layerVal: layerVal, propsOf: propsOf });
  }
})(typeof window !== "undefined" ? window : globalThis);
