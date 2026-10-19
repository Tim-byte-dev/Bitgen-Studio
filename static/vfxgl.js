/* bitGen Studio — static/vfxgl.js (2.409.0): ✨ EFFECTS in the canvas preview - the same numbers the compile renders
 * (scripts/vfx_filters.py), drawn here: crop (the edges cleared), the green-screen KEY + spill (a WebGL pass doing
 * ffmpeg chromakey's maths: the colour's U / V distance), sharpen (the same pass, a 3x3 unsharp), blur (canvas
 * filter), glow (a blurred copy screened over), vignette (darker edges), grain (noise). The key and the crop are exact;
 * blur / sharpen / glow / vignette / grain are close (the compile is the reference). Stabilise is compile-only.
 *
 *   H3Vfx.apply(source, vfx, clip, tau) -> a canvas with the effects, or null when there are none
 *   (clip = false: an adjustment layer - no crop / key / stabilise; tau = seconds into the clip, for a moving wave)
 * 2.415.0: DISTORT - lens (barrel / pincushion), mirror (h / v / quad), warp (wave / twirl): one more WebGL pass that
 * samples each pixel where static/clipfx.js distortAt says (the compile's geq + lenscorrection, scripts/vfx_filters.py).
 */
(function () {
  "use strict";
  var gl = null, cv = null, prog = null, tex = null, failed = false, A1 = null, A2 = null, B = null, noise = null, dprog = null, D = null, E = null;
  function canvas(w, h, c) { c = c || document.createElement("canvas"); if (c.width !== w) c.width = w; if (c.height !== h) c.height = h; return c; }

  function init() {
    if (gl || failed) return !!gl;
    try { cv = document.createElement("canvas"); gl = cv.getContext("webgl", { premultipliedAlpha: false, preserveDrawingBuffer: true }); } catch (e) { gl = null; }
    if (!gl) { failed = true; return false; }
    var vs = "attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position = vec4(p,0.,1.); }";
    var fs = "precision highp float; uniform sampler2D img; uniform vec2 px; uniform vec3 kcol; uniform float kon, ksim, kblend, kspill, sharp; varying vec2 uv;\n"
      + "vec2 uvOf(vec3 c){ return vec2(-0.168736*c.r - 0.331264*c.g + 0.5*c.b, 0.5*c.r - 0.418688*c.g - 0.081312*c.b); }\n"
      + "void main(){ vec4 c = texture2D(img, uv);\n"
      + "  if (sharp > 0.0) { vec3 s = vec3(0.0); for (int i=-1;i<=1;i++) for (int j=-1;j<=1;j++) s += texture2D(img, uv + vec2(float(i),float(j))*px).rgb;\n"
      + "    c.rgb = clamp(c.rgb + (c.rgb - s/9.0) * sharp * 1.5, 0.0, 1.0); }\n"
      + "  if (kon > 0.5) { vec2 d = uvOf(c.rgb) - uvOf(kcol); float diff = sqrt(dot(d,d)/2.0);\n"
      + "    float a = kblend > 0.0001 ? clamp((diff - ksim) / kblend, 0.0, 1.0) : (diff > ksim ? 1.0 : 0.0);\n"
      + "    c.a *= a;\n"
      + "    if (kspill > 0.0) { bool blue = kcol.b > kcol.g; float lim = blue ? max(c.r, c.g) : max(c.r, c.b);\n"
      + "      if (blue) c.b = mix(c.b, min(c.b, lim), kspill); else c.g = mix(c.g, min(c.g, lim), kspill); } }\n"
      + "  gl_FragColor = c; }";
    function sh(t, src) { var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    try {
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (k) { gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE); });
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } catch (e) { failed = true; gl = null; return false; }
    return true;
  }
  function hex(c) { var s = String(c || "#00ff00").replace("#", ""); var n = parseInt(s, 16) || 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
  function glPass(src, w, h, key, sharp) {
    if (!init()) return src;
    canvas(w, h, cv); gl.viewport(0, 0, w, h); gl.useProgram(prog);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch (e) { return src; }
    var U = function (n) { return gl.getUniformLocation(prog, n); };
    gl.uniform2f(U("px"), 1 / w, 1 / h);
    var k = key || null, kc = hex(k && k.color);
    gl.uniform3f(U("kcol"), kc[0], kc[1], kc[2]);
    gl.uniform1f(U("kon"), k ? 1 : 0); gl.uniform1f(U("ksim"), k ? +k.similarity : 0); gl.uniform1f(U("kblend"), k ? +k.blend : 0);
    gl.uniform1f(U("kspill"), k ? +k.spill : 0); gl.uniform1f(U("sharp"), +sharp || 0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return cv;
  }
  /* 2.415.0: the distort pass (its own program on the same context) */
  var DFS = "precision highp float; uniform sampler2D img; uniform vec2 res; uniform float lk, mir, wt, wa, wsz, wsp, tau; varying vec2 uv;\n"
    + "void main(){ vec2 p = uv * res; float w = res.x, h = res.y;\n"
    + "  if (wt > 0.5 && wt < 1.5) { float A = wa * 0.05 * w, L = max(1.0, wsz * h); p.x = p.x + A * sin(6.2831853 * p.y / L + 6.2831853 * wsp * tau); }\n"
    + "  else if (wt > 1.5) { vec2 d = p - res * 0.5; float R = max(1.0, wsz * min(w, h) * 0.5), r = length(d) / R; float a = r < 1.0 ? wa * 3.0 * (1.0 - r) * (1.0 - r) : 0.0;\n"
    + "    p = res * 0.5 + vec2(d.x * cos(a) - d.y * sin(a), d.x * sin(a) + d.y * cos(a)); }\n"
    + "  bool outside = false;\n"
    + "  if (abs(lk) > 0.00001) { float k1 = lk * 0.5, k2 = k1 * 0.5, r0 = length(res) * 0.5; vec2 e = p - res * 0.5; float q = dot(e, e) / (r0 * r0);\n"
    + "    p = res * 0.5 + e * (1.0 + k1 * q + k2 * q * q); outside = p.x < 0.0 || p.y < 0.0 || p.x > w || p.y > h; }\n"
    + "  if ((mir > 0.5 && mir < 1.5) || mir > 2.5) { if (p.x > w * 0.5) p.x = w - p.x; }\n"
    + "  if (mir > 1.5) { if (p.y > h * 0.5) p.y = h - p.y; }\n"
    + "  gl_FragColor = outside ? vec4(0.0, 0.0, 0.0, 1.0) : texture2D(img, clamp(p / res, 0.0, 1.0)); }";
  function glDistort(src, w, h, v, tau) {
    if (!init()) return src;
    if (glDistort.warned) return src;              // the shader did not build here: the picture undistorted
    if (!dprog) {
      try {
        var vs = "attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position = vec4(p,0.,1.); }";
        var mk = function (t, s0) { var x = gl.createShader(t); gl.shaderSource(x, s0); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
        dprog = gl.createProgram(); gl.attachShader(dprog, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(dprog, mk(gl.FRAGMENT_SHADER, DFS)); gl.linkProgram(dprog);
        if (!gl.getProgramParameter(dprog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(dprog));
      } catch (e) { dprog = null; if (!glDistort.warned) { glDistort.warned = 1; try { console.warn("[vfx] the distort shader did not build: " + e.message); } catch (x) { /* fine */ } } return src; }
    }
    if (src === cv) { E = canvas(w, h, E); var eg = E.getContext("2d"); eg.clearRect(0, 0, w, h); eg.drawImage(cv, 0, 0); src = E; }   // never upload the GL canvas to itself
    canvas(w, h, cv); gl.viewport(0, 0, w, h); gl.useProgram(dprog);
    var loc = gl.getAttribLocation(dprog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch (e) { gl.useProgram(prog); return src; }
    var U = function (n) { return gl.getUniformLocation(dprog, n); }, wp = v.warp || {};
    gl.uniform2f(U("res"), w, h); gl.uniform1f(U("lk"), (+v.lens || 0) / 100);
    gl.uniform1f(U("mir"), { h: 1, v: 2, quad: 3 }[v.mirror] || 0);
    gl.uniform1f(U("wt"), wp.type === "wave" ? 1 : wp.type === "twirl" ? 2 : 0); gl.uniform1f(U("wa"), (+wp.amount || 0) / 100);
    gl.uniform1f(U("wsz"), (+wp.size || (wp.type === "wave" ? 20 : 60)) / 100); gl.uniform1f(U("wsp"), +wp.speed || 0); gl.uniform1f(U("tau"), +tau || 0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.useProgram(prog);
    D = canvas(w, h, D); var dg = D.getContext("2d"); dg.clearRect(0, 0, w, h); dg.drawImage(cv, 0, 0);
    return D;
  }
  function grain(w, h) {
    noise = canvas(256, 256, noise);
    var g = noise.getContext("2d"), d = g.createImageData(256, 256);
    for (var i = 0; i < d.data.length; i += 4) { var v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    return noise;
  }

  function apply(src, vIn, clip, tau) {
    var v = vIn || null; if (!v) return null;
    var w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height;
    if (!w || !h) return null;
    var MAXW = 1280; if (w > MAXW) { h = Math.round(h * MAXW / w); w = MAXW; }
    var keyed = clip !== false && v.key, sharp = +v.sharpen || 0, c = clip !== false && v.crop;
    // two output canvases taken in turn - a chained call (key + crop, the grade, then the rest) never draws into the
    // canvas it is reading
    var A;
    if (src === A1) A = A2 = canvas(w, h, A2); else A = A1 = canvas(w, h, A1);
    var a = A.getContext("2d");
    a.setTransform(1, 0, 0, 1, 0, 0); a.globalAlpha = 1; a.globalCompositeOperation = "source-over"; a.filter = "none";
    a.clearRect(0, 0, w, h);
    var first = keyed || sharp > 0 ? glPass(src, w, h, keyed ? v.key : null, sharp) : src;
    if (v.lens || v.mirror || v.warp) first = glDistort(first, w, h, v, tau);     // 2.415.0: after the grade, like the compile
    var bl = +v.blur || 0;
    a.filter = bl > 0 ? "blur(" + (bl * h / 1080 / 2).toFixed(2) + "px)" : "none";
    a.drawImage(first, 0, 0, w, h);
    a.filter = "none";
    if (c) {                                   // the edges cleared - the picture stays where it is
      var L = w * (+c.l || 0) / 100, T = h * (+c.t || 0) / 100, R = w * (+c.r || 0) / 100, Bt = h * (+c.b || 0) / 100;
      a.clearRect(0, 0, L, h); a.clearRect(w - R, 0, R, h); a.clearRect(0, 0, w, T); a.clearRect(0, h - Bt, w, Bt);
    }
    var gw = +v.glow || 0;
    if (gw > 0) {
      B = canvas(w, h, B); var b = B.getContext("2d"); b.clearRect(0, 0, w, h);
      b.filter = "blur(" + (12 * h / 1080).toFixed(2) + "px)"; b.drawImage(A, 0, 0); b.filter = "none";
      a.globalCompositeOperation = "screen"; a.globalAlpha = gw; a.drawImage(B, 0, 0);
      a.globalAlpha = 1; a.globalCompositeOperation = "source-over";
    }
    var vg = +v.vignette || 0;
    if (vg > 0) {
      var r = Math.hypot(w, h) / 2, grd = a.createRadialGradient(w / 2, h / 2, r * (0.75 - vg * 0.55), w / 2, h / 2, r);
      grd.addColorStop(0, "rgba(0,0,0,0)"); grd.addColorStop(1, "rgba(0,0,0," + Math.min(0.95, 0.25 + vg * 0.75).toFixed(3) + ")");
      a.globalCompositeOperation = "source-atop"; a.fillStyle = grd; a.fillRect(0, 0, w, h); a.globalCompositeOperation = "source-over";
    }
    var gr = +v.grain || 0;
    if (gr > 0) {
      a.globalCompositeOperation = "source-atop"; a.globalAlpha = Math.min(0.5, gr * 0.35);
      a.fillStyle = a.createPattern(grain(w, h), "repeat"); a.fillRect(0, 0, w, h);
      a.globalAlpha = 1; a.globalCompositeOperation = "source-over";
    }
    return A;
  }
  /** the parts that come BEFORE the grade in the compile (crop, key) and the ones after it */
  function split(v) {
    if (!v) return [null, null];
    var pre = {}, post = {};
    Object.keys(v).forEach(function (k) { if (k === "crop" || k === "key") pre[k] = v[k]; else if (k !== "stabilise") post[k] = v[k]; });
    return [Object.keys(pre).length ? pre : null, Object.keys(post).length ? post : null];
  }
  window.H3Vfx = { apply: apply, split: split };
})();
