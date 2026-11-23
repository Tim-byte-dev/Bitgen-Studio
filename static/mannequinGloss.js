/* bitGen Studio — static/mannequinGloss.js (2.928.0): THE GLOSSY DISPLAY MANNEQUINS drawn with three.js (window.H3MannequinGloss).
 * Tim: "use these mannequins as included character sheet mannequins (create new ones that look similar) ad our garment
 * design" - his pictures: white gloss fibreglass display mannequins, faceless egg heads, on black, every view and close-ups.
 * The bodies: static/mannequins/mesh/<sex>.json (scripts/make_mannequin_mesh.py - MakeHuman's CC0 base mesh); this draws
 * them in white gloss under a soft studio (softboxes reflected in the clear coat) and lays out the reference sheet:
 *   render(T, mesh, {view, w, h, bg})  view: front | side | back | side2 | three | head | headthree | headback | torso |
 *                                      torsoside | hips | palm | handback | handside | sole | foottop | footside -> PNG data URL
 *   sheet(T, mesh, {w, h, title})      the whole sheet (full views, the head, the torso, hands and feet) -> PNG data URL
 * Rendered once by scripts/make_mannequins.js into static/mannequins/ (Playwright's Chromium, WebGL in software). */
(function (root) {
  "use strict";
  function b64(s, Type) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Type(u.buffer); }
  function geometry(T, m, keep) {
    var pos = b64(m.pos, Float32Array), idx = b64(m.idx, Uint32Array);
    if (keep) {                                                     // a close-up: only the triangles near that part
      var out = [];
      for (var i = 0; i < idx.length; i += 3) { var a = idx[i] * 3; if (keep(pos[a], pos[a + 1], pos[a + 2])) out.push(idx[i], idx[i + 1], idx[i + 2]); }
      idx = new Uint32Array(out);
    }
    var g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setIndex(new T.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    return g;
  }
  /** a studio to reflect: big soft boxes left / right / above and a rim behind, on black */
  function studio(T, renderer) {
    var s = new T.Scene(); s.background = new T.Color(0x000000);
    var box = function (w, h, x, y, z, lum) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(lum, lum, lum), side: T.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 1, 0); s.add(m);
    };
    box(3, 5, -4, 2.2, 2.5, 2.2); box(3, 5, 4.2, 2.0, 1.5, 1.6); box(6, 2, 0, 6, 0.5, 1.4);
    box(2, 5, -3, 2, -4, 1.1); box(2, 5, 3, 2, -4, 1.1); box(8, 2, 0, -2, 4, 0.18);
    var pm = new T.PMREMGenerator(renderer), env = pm.fromScene(s, 0.02).texture; pm.dispose();
    return env;
  }
  var cache = {};
  function stage(T, m, w, h, bg) {
    var key = m.sex + ":" + w + "x" + h;
    if (cache[key]) return cache[key];
    var cv = root.document.createElement("canvas"); cv.width = w; cv.height = h;
    var r = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true, alpha: false });
    r.setPixelRatio(1); r.setSize(w, h, false);
    if (T.SRGBColorSpace) r.outputColorSpace = T.SRGBColorSpace;
    if (T.ACESFilmicToneMapping) { r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; }
    var sc = new T.Scene(); sc.background = new T.Color(bg == null ? 0x050505 : bg);
    sc.environment = studio(T, r);
    var mat = new T.MeshPhysicalMaterial({ color: 0xf2f2f0, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.0 });
    var key1 = new T.DirectionalLight(0xffffff, 1.3); key1.position.set(-2, 3, 3); sc.add(key1);
    var fill = new T.DirectionalLight(0xffffff, 0.45); fill.position.set(3, 1.5, 2); sc.add(fill);
    var rim = new T.DirectionalLight(0xffffff, 0.8); rim.position.set(0, 3, -4); sc.add(rim);
    sc.add(new T.AmbientLight(0xffffff, 0.12));
    var under = new T.DirectionalLight(0xffffff, 0.7); under.position.set(0.5, -3, 1); sc.add(under);   // the soles and under the chin
    var st = { r: r, cv: cv, sc: sc, mat: mat, m: m, meshes: {} };
    cache[key] = st;
    return st;
  }
  var J = function (m, k) { return m.joints[k] || [0, 0, 0]; };
  /** every view: the part to keep (null = all), where the camera is and what it looks at, and the field of view */
  function shot(m, view) {
    var H = m.height_m, mid = [0, H * 0.5, 0], hd = J(m, "head"), hd2 = J(m, "head-2"), nk = J(m, "neck");
    var jw = J(m, "jaw"), top = H, hc = [0, (jw[1] - 0.012 + top) / 2, (hd[2] + jw[2]) / 2 - 0.01];
    var near = function (c, rr, outX) { return function (x, y, z) { return (x - c[0]) * (x - c[0]) + (y - c[1]) * (y - c[1]) + (z - c[2]) * (z - c[2]) < rr * rr && (outX == null || x > outX); }; };
    var an = J(m, "l-ankle"), hand = m.joints["l-hand"] || J(m, "l-wrist"), foot = [an[0], an[1] - 0.03, an[2] + 0.07];
    var D = H * 1.55, V = {
      front: [null, [0, H * 0.52, D], mid, 34], back: [null, [0, H * 0.52, -D], mid, 34],
      side: [null, [D, H * 0.52, 0], mid, 34], side2: [null, [-D, H * 0.52, 0], mid, 34],
      three: [null, [D * 0.62, H * 0.55, D * 0.78], mid, 34],
      head: [null, [0, hc[1], hc[2] + 0.85], hc, 22], headthree: [null, [0.55, hc[1] + 0.02, hc[2] + 0.62], hc, 22],
      headback: [null, [0, hc[1] - 0.03, -0.8], [0, hc[1] - 0.06, 0], 28],
      torso: [null, [0, nk[1] - 0.2, 1.3], [0, nk[1] - 0.2, 0], 26], torsoside: [null, [1.0, nk[1] - 0.22, 0.75], [0, nk[1] - 0.22, 0.02], 26],
      hips: [null, [0, H * 0.5, -1.05], [0, H * 0.5, 0], 26],
      palm: [near(hand, 0.13, hand[0] - 0.035), [hand[0] - 0.5, hand[1], hand[2] + 0.05], hand, 24], handback: [near(hand, 0.13, hand[0] - 0.035), [hand[0] + 0.5, hand[1], hand[2] + 0.05], hand, 24],
      handside: [near(hand, 0.13, hand[0] - 0.035), [hand[0] + 0.05, hand[1], hand[2] + 0.5], hand, 24],
      sole: [near(foot, 0.16), [foot[0], foot[1] - 0.55, foot[2] - 0.12], foot, 34], foottop: [null, [foot[0] + 0.05, foot[1] + 0.35, foot[2] + 0.42], foot, 34],
      footside: [null, [foot[0] + 0.55, foot[1] + 0.05, foot[2]], foot, 34],
    };
    return V[view] || V.front;
  }
  function draw(T, st, view, w, h) {
    var s = shot(st.m, view), k = s[0] ? view : "all";
    Object.keys(st.meshes).forEach(function (n) { st.meshes[n].visible = false; });
    if (!st.meshes[k]) { st.meshes[k] = new T.Mesh(geometry(T, st.m, s[0]), st.mat); st.sc.add(st.meshes[k]); }
    st.meshes[k].visible = true;
    var cam = new T.PerspectiveCamera(s[3], w / h, 0.02, 50);
    cam.position.set(s[1][0], s[1][1], s[1][2]); cam.up.set(0, view === "sole" ? 0 : 1, view === "sole" ? 1 : 0); cam.lookAt(s[2][0], s[2][1], s[2][2]);
    st.r.render(st.sc, cam);
  }
  function render(T, m, o) {
    o = o || {}; var w = o.w || 832, h = o.h || 1216, st = stage(T, m, w, h, o.bg);
    draw(T, st, o.view || "front", w, h);
    return st.cv.toDataURL("image/png");
  }
  /** the reference sheet: four full views and the head across the top; torso, hips and the head again; hands and feet */
  function sheet(T, m, o) {
    o = o || {}; var W = o.w || 2600, Hh = o.h || 2400, c = root.document.createElement("canvas"); c.width = W; c.height = Hh;
    var g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, W, Hh);
    var gap = 8, put = function (view, x, y, w, h, label) {
      w = Math.round(w); h = Math.round(h);
      var st = stage(T, m, w, h); draw(T, st, view, w, h);
      g.drawImage(st.cv, Math.round(x), Math.round(y)); g.strokeStyle = "#3a3a3a"; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
      if (label) { g.fillStyle = "rgba(255,255,255,.55)"; g.font = "600 22px sans-serif"; g.fillText(label, x + 14, y + h - 16); }
    };
    var top = 70, fullW = (W * 0.74 - gap * 5) / 4, fullH = Hh * 0.52;
    g.fillStyle = "#e8e8e8"; g.font = "600 34px sans-serif"; g.fillText(o.title || "", 18, 48);
    ["front", "side", "back", "side2"].forEach(function (v, i) { put(v, gap + i * (fullW + gap), top, fullW, fullH, ["Front", "Side", "Back", "Side"][i]); });
    var rx = gap + 4 * (fullW + gap), rw = W - rx - gap, hw = (rw - gap) / 2;
    put("head", rx, top, hw, fullH * 0.38, "Head"); put("headthree", rx + hw + gap, top, hw, fullH * 0.38, "Head ¾");
    put("headback", rx, top + fullH * 0.38 + gap, rw, fullH * 0.62 - gap, "Head - back");
    var y2 = top + fullH + gap, h2 = Hh * 0.22, w2 = (W - gap * 5) / 4;
    put("torso", gap, y2, w2, h2, "Torso"); put("torsoside", gap + (w2 + gap), y2, w2, h2, "Torso - side"); put("hips", gap + 2 * (w2 + gap), y2, w2, h2, "Hips - back"); put("three", gap + 3 * (w2 + gap), y2, w2, h2, "¾");
    var y3 = y2 + h2 + gap, h3 = Hh - y3 - gap, w3 = (W - gap * 7) / 6;
    [["palm", "Palm"], ["handback", "Back of hand"], ["handside", "Hand - side"], ["sole", "Sole"], ["foottop", "Foot - top"], ["footside", "Foot - side"]].forEach(function (v, i) { put(v[0], gap + i * (w3 + gap), y3, w3, h3, v[1]); });
    return c.toDataURL("image/png");
  }
  var API = { render: render, sheet: sheet, shot: shot };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.H3MannequinGloss = API;
})(typeof window !== "undefined" ? window : globalThis);
