/* bitGen Studio — static/gradegl.js (2.406.0): a timeline clip's 🎨 COLOUR GRADE + LUT in the canvas preview.
 *
 * The look is baked into ONE 33³ table by H3ClipFx.buildLut (static/clipfx.js) - the very table the compile writes as a
 * .cube for ffmpeg's lut3d (lib/clipFx.bakedLut) - and sampled here as a WebGL2 3D texture (trilinear), so what the
 * canvas shows is what the movie gets. A user LUT (.cube from the library, GET /api/luts/<name>) is fetched once and
 * cached; until it arrives the clip is drawn ungraded and `onReady` (the canvas's mark) repaints it.
 *
 *   H3GradeGL.apply(source, fx, onReady) -> a canvas holding the graded picture, or null (no grade / no WebGL2)
 *   H3GradeGL.lut(name)                  -> the parsed user LUT, or null while it loads
 *   H3GradeGL.forget(name)               drop a cached LUT (after ＋ LUT replaced it)
 */
(function () {
  "use strict";
  var F = function () { return window.H3ClipFx; };
  var gl = null, cv = null, prog = null, tex2d = null, failed = false;
  var tables = new Map();     // lookKey -> {tex}
  var luts = new Map();       // name -> parsed | "loading" | "error"
  var MAXW = 1920;

  function init() {
    if (gl || failed) return !!gl;
    try {
      cv = document.createElement("canvas");
      gl = cv.getContext("webgl2", { premultipliedAlpha: false, preserveDrawingBuffer: true, alpha: true });
    } catch (e) { gl = null; }
    if (!gl) { failed = true; return false; }
    var vs = "#version 300 es\nin vec2 p; out vec2 uv; void main(){ uv = vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position = vec4(p,0.,1.); }";
    var fs = "#version 300 es\nprecision highp float; precision highp sampler3D;\n" +
      "uniform sampler2D img; uniform sampler3D lut; uniform float n; in vec2 uv; out vec4 o;\n" +
      "void main(){ vec4 c = texture(img, uv); vec3 q = clamp(c.rgb, 0., 1.) * ((n - 1.) / n) + 0.5 / n;\n" +
      "  o = vec4(texture(lut, q).rgb, c.a); }";
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      tex2d = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex2d);
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (k) { gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE); });
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(prog, "img"), 0);
      gl.uniform1i(gl.getUniformLocation(prog, "lut"), 1);
    } catch (e) { failed = true; gl = null; if (window.console) console.warn("[gradegl] " + e.message); return false; }
    return true;
  }

  function lut(name, onReady) {
    if (!name) return null;
    var v = luts.get(name);
    if (v && typeof v === "object") return v;
    if (v) return null;
    luts.set(name, "loading");
    fetch("/api/luts/" + encodeURIComponent(name)).then(function (r) { return r.ok ? r.text() : Promise.reject(new Error("HTTP " + r.status)); })
      .then(function (t) { luts.set(name, F().parseCube(t)); if (onReady) onReady(); })
      .catch(function () { luts.set(name, "error"); });
    return null;
  }

  function table(fx, onReady) {
    var key = F().lookKey(fx);
    var t = tables.get(key);
    if (t) return t;
    var user = null;
    if (fx.lut) {
      user = lut(fx.lut, onReady);
      if (!user && luts.get(fx.lut) === "loading") return null;    // drawn ungraded until it is here
    }
    var N = F().LUT_SIZE, data = F().buildLut(fx, user, N);
    var tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, tex);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, N, N, N, 0, gl.RGB, gl.FLOAT, data);
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R].forEach(function (k) { gl.texParameteri(gl.TEXTURE_3D, k, gl.CLAMP_TO_EDGE); });
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.activeTexture(gl.TEXTURE0);
    t = { tex: tex, n: N };
    if (tables.size > 24) { tables.forEach(function (v) { gl.deleteTexture(v.tex); }); tables.clear(); }
    tables.set(key, t);
    return t;
  }

  function apply(src, fxIn, onReady) {
    var X = F();
    if (!X) return null;
    var fx = X.normalize(fxIn);
    if (!fx || !X.graded(fx) || !init()) return null;
    var w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height;
    if (!w || !h) return null;
    var t = table(fx, onReady);
    if (!t) return null;
    if (w > MAXW) { h = Math.round(h * MAXW / w); w = MAXW; }
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, t.tex);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex2d);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch (e) { return null; }
    gl.uniform1f(gl.getUniformLocation(prog, "n"), t.n);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return cv;
  }

  window.H3GradeGL = { apply: apply, lut: lut, forget: function (name) { luts.delete(name); tables.clear(); },
                       ok: function () { return init(); } };
})();
