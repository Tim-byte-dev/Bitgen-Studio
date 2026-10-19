/* bitGen Studio — static/glcomp.js (2.420.0): THE GPU COMPOSITOR for the timeline canvas (window.H3GLComp).
 *
 * Tim: "yes, please add your 2 suggestions" (this one: "a real WebGL compositor for the live canvas").
 *
 * While the canvas PLAYS, the picture is put together on the graphics card in ONE WebGL2 pass per layer: every clip's
 * picture is a texture (a <video> frame goes straight to the GPU - no 2D copy), drawn as a quad at its place / size /
 * rotation with its opacity, and a clip whose look is only a 🎨 GRADE + LUT is graded IN THE SAME DRAW (the 33³ table
 * static/clipfx.js bakes - the one the compile uses - as a 3D texture). Clips with effects / a mask / a key keep their
 * own look pass (static/vfxgl.js) and are drawn here from its result. The finished frame is ONE image the canvas shows.
 * Paused frames, snapshots and anything this pass does not do (a layer transition's wipe, an adjustment layer) use the
 * 2D reference path (ext/timelinedock/canvas.js paintComp) - so what you inspect still-by-still is exactly as before.
 *
 *   ok()                       WebGL2 here?
 *   begin(W, H)                a new frame W x H (cleared to black)
 *   draw(src, box, alpha, fx)  box = {cx, cy, w, h, rot (deg)} in picture pixels; fx = the clip's fx when the GRADE is to
 *                              be done here (else null); src = a <video>, <img> or <canvas>
 *   end()                      -> the canvas holding the frame
 *   pure (Node): corners(box), toClip(x, y, W, H), lutUV(n)
 */
(function (root) {
  "use strict";
  function corners(b) {
    var r = (+b.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), hw = b.w / 2, hh = b.h / 2;
    return [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]].map(function (p) { return [b.cx + p[0] * c - p[1] * s, b.cy + p[0] * s + p[1] * c]; });
  }
  function toClip(x, y, W, H) { return [x / W * 2 - 1, 1 - y / H * 2]; }
  /** where a value lands in an n-sized LUT (the same half-texel mapping as static/gradegl.js) */
  function lutUV(n) { return { scale: (n - 1) / n, offset: 0.5 / n }; }
  var pure = { corners: corners, toClip: toClip, lutUV: lutUV };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var F = function () { return window.H3ClipFx; };
  var cv = null, gl = null, prog = null, failed = false, buf = null, loc = {}, texs = [], used = 0, W = 0, H = 0;
  var tables = new Map();
  var VS = "#version 300 es\nin vec2 p; in vec2 t; out vec2 uv; void main(){ uv = t; gl_Position = vec4(p, 0., 1.); }";
  var FS = "#version 300 es\nprecision highp float; precision highp sampler3D;\n"
    + "uniform sampler2D img; uniform sampler3D lut; uniform float alpha; uniform float useLut; uniform float n; in vec2 uv; out vec4 o;\n"
    + "void main(){ vec4 c = texture(img, uv);\n"
    + "  if (useLut > 0.5 && c.a > 0.0) { vec3 s = clamp(c.rgb / c.a, 0., 1.) * ((n - 1.) / n) + 0.5 / n; c.rgb = texture(lut, s).rgb * c.a; }\n"
    + "  o = c * alpha; }";                                       // premultiplied: the blend is ONE, ONE_MINUS_SRC_ALPHA
  function init() {
    if (gl || failed) return !!gl;
    try {
      cv = document.createElement("canvas"); cv.width = 16; cv.height = 16;
      gl = cv.getContext("webgl2", { premultipliedAlpha: true, alpha: false, preserveDrawingBuffer: true, antialias: true });
    } catch (e) { gl = null; }
    if (!gl) { failed = true; return false; }
    try {
      var sh = function (type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      buf = gl.createBuffer();
      loc = { p: gl.getAttribLocation(prog, "p"), t: gl.getAttribLocation(prog, "t"), alpha: gl.getUniformLocation(prog, "alpha"),
              useLut: gl.getUniformLocation(prog, "useLut"), n: gl.getUniformLocation(prog, "n") };
      gl.uniform1i(gl.getUniformLocation(prog, "img"), 0);
      gl.uniform1i(gl.getUniformLocation(prog, "lut"), 1);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    } catch (e) { failed = true; gl = null; if (window.console) console.warn("[glcomp] " + e.message); return false; }
    return true;
  }
  function tex(i) {
    if (!texs[i]) {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (k) { gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE); });
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      texs[i] = t;
    }
    return texs[i];
  }
  function table(fx) {
    var X = F(), key = X.lookKey(fx), t = tables.get(key);
    if (t) return t;
    var user = null;
    if (fx.lut) {
      user = window.H3GradeGL && H3GradeGL.lut ? H3GradeGL.lut(fx.lut, function () { if (window.TlCanvas) TlCanvas.mark(); }) : null;
      if (!user) return null;                                       // drawn by the look pass until the user LUT is here
    }
    var N = X.LUT_SIZE, data = X.buildLut(fx, user, N), tx = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, tx);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, N, N, N, 0, gl.RGB, gl.FLOAT, data);
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R].forEach(function (k) { gl.texParameteri(gl.TEXTURE_3D, k, gl.CLAMP_TO_EDGE); });
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.activeTexture(gl.TEXTURE0);
    t = { tex: tx, n: N };
    if (tables.size > 24) { tables.forEach(function (v) { gl.deleteTexture(v.tex); }); tables.clear(); }
    tables.set(key, t);
    return t;
  }
  /** can the grade of this fx be done in the compositor's draw (no user LUT still loading)? */
  function gradeReady(fx) { if (!init()) return false; var X = F(); var f = X && X.normalize(fx); return !!(f && X.graded(f) && table(f)); }
  function begin(w, h) {
    if (!init()) return false;
    W = Math.max(2, Math.round(w)); H = Math.max(2, Math.round(h));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    used = 0;
    return true;
  }
  function draw(src, b, alpha, fx) {
    if (!gl || !b || !(b.w > 0) || !(b.h > 0)) return false;
    var a = Math.max(0, Math.min(1, alpha == null ? 1 : +alpha));
    if (a <= 0) return true;
    var lt = null;
    if (fx) { var X = F(), f = X && X.normalize(fx); if (f && X.graded(f)) lt = table(f); if (!lt) return false; }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex(used++ % 16));
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch (e) { return false; }
    var cs = corners(b), v = [];
    var uv = [[0, 0], [1, 0], [0, 1], [1, 1]];
    for (var i = 0; i < 4; i++) { var q = toClip(cs[i][0], cs[i][1], W, H); v.push(q[0], q[1], uv[i][0], uv[i][1]); }
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(loc.t); gl.vertexAttribPointer(loc.t, 2, gl.FLOAT, false, 16, 8);
    gl.uniform1f(loc.alpha, a);
    if (lt) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, lt.tex); gl.activeTexture(gl.TEXTURE0); gl.uniform1f(loc.useLut, 1); gl.uniform1f(loc.n, lt.n); }
    else gl.uniform1f(loc.useLut, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }
  function end() { return cv; }
  root.H3GLComp = { pure: pure, ok: init, begin: begin, draw: draw, end: end, gradeReady: gradeReady, canvas: function () { return cv; } };
})(typeof window !== "undefined" ? window : globalThis);
