/* bitGen Studio — static/mannequin3d.js (2.873.0): THE 3D MANNEQUIN for the character sheet (window.H3Mannequin).
 *
 * Tim (verbatim): "can you create the mannequin character sheet using a 3d mannequin, for male and female, try to be as
 * close to anatomically correct as possible for our character sheet creator" + "do number 1 but make dress it optional,
 * dressing often leads to unwanted artifacts and the clothes described won't fit properly".
 *
 * bitGen Studio's OWN figure (no third-party model or artwork): an artist's mannequin built from the classical canon -
 * the male 8 heads tall, the female 7.5, landmarks at the canon's head marks (chin, nipple / bust line, navel, crotch at
 * the half, knee, ankle), the male's shoulders about two heads wide over narrower hips, the female's shoulders and hips
 * about the same width with a narrow waist, the arms reaching mid-thigh, the elbow at the waist and the wrist at the
 * crotch. Smooth segments with ball joints, no sexual detail, a neutral A-pose. Everything is measured in HEAD units
 * (scaled to metres by the figure's height) so the proportions can be checked without three.js (scripts/test-873.js).
 *
 *   PROPS[sex]                    the canon: heads, height_m, landmarks, joints, trunk rings, limb radii (head units)
 *   joints(sex)                   {name: [x, y, z]} in head units (origin between the feet, y up, the figure faces +z)
 *   measure(sex)                  {heads, shoulders, hips, waist, armTip, crotch, elbow, wrist} - head units
 *   build(THREE, sex)             -> THREE.Group in metres (the figure's own height)
 *   render(THREE, o)              -> a data: URL (o: sex, view front|side|back|threequarter|head|headside, w, h, bg)
 *   sheet(THREE, o)               -> a data: URL of every view on one picture (o: sex, w, h)
 */
(function (root) {
  "use strict";
  var PROPS = {
    male: {
      heads: 8, height_m: 1.82, label: "Male",
      marks: { crown: 8, chin: 7, nipples: 6, navel: 5, crotch: 4, knee: 2.05, ankle: 0.3 },
      head: { c: [0, 7.5, 0.02], r: [0.34, 0.5, 0.43], jaw: [0, 7.14, 0.19], jr: [0.17, 0.14, 0.15], nose: [0, 7.44, 0.43], nr: [0.055, 0.1, 0.07] },
      pelvis: { c: [0, 3.95, -0.04], r: [0.64, 0.3, 0.47] },
      neck: { y0: 6.65, y1: 7.15, w: 0.27, d: 0.25, z: -0.02 },
      // trunk rings: [y, half-width, half-depth, centre z]
      trunk: [[3.82, 0.4, 0.3, 0], [3.95, 0.7, 0.5, -0.04], [4.2, 0.74, 0.55, -0.06], [4.5, 0.7, 0.52, -0.03],
              [4.85, 0.66, 0.46, 0], [5.1, 0.62, 0.45, 0.02], [5.45, 0.68, 0.48, 0.04], [5.8, 0.71, 0.54, 0.06],
              [6.1, 0.74, 0.56, 0.06], [6.4, 0.72, 0.51, 0.02], [6.6, 0.58, 0.42, -0.02], [6.76, 0.3, 0.28, -0.02]],
      shoulder: [0.8, 6.42, 0], delt: 0.26, hip: [0.42, 4.05, 0], knee: [0.4, 2.05, 0.02], ankle: [0.38, 0.3, -0.02],
      arm: { upper: 1.5, fore: 1.25, hand: 0.75, spread: 24, bend: 7 },
      r: { upper: [[0, 0.25], [0.35, 0.24], [0.7, 0.2], [1, 0.17]], fore: [[0, 0.17], [0.2, 0.19], [0.6, 0.15], [1, 0.12]],
           thigh: [[0, 0.3], [0.2, 0.42], [0.62, 0.33], [1, 0.24]], shin: [[0, 0.22], [0.25, 0.25], [0.6, 0.18], [1, 0.13]] },
      balls: { elbow: 0.165, wrist: 0.12, knee: 0.225, ankle: 0.14 },
      hand: [0.24, 0.085], foot: { len: 1.0, w: 0.2, h: 0.17 },
    },
    female: {
      heads: 7.5, height_m: 1.71, label: "Female",
      marks: { crown: 7.5, chin: 6.5, nipples: 5.62, navel: 4.6, crotch: 3.75, knee: 1.92, ankle: 0.28 },
      head: { c: [0, 7.0, 0.02], r: [0.33, 0.5, 0.42], jaw: [0, 6.64, 0.18], jr: [0.15, 0.13, 0.14], nose: [0, 6.94, 0.42], nr: [0.05, 0.09, 0.065] },
      pelvis: { c: [0, 3.72, -0.06], r: [0.72, 0.3, 0.5] },
      neck: { y0: 6.2, y1: 6.66, w: 0.22, d: 0.21, z: -0.02 },
      trunk: [[3.57, 0.4, 0.3, 0], [3.7, 0.84, 0.52, -0.05], [3.95, 0.87, 0.58, -0.08], [4.25, 0.74, 0.52, -0.05],
              [4.5, 0.62, 0.44, -0.01], [4.75, 0.56, 0.4, 0.01], [5.05, 0.59, 0.42, 0.03], [5.4, 0.64, 0.5, 0.07],
              [5.65, 0.65, 0.55, 0.09], [5.9, 0.62, 0.46, 0.04], [6.1, 0.52, 0.38, -0.01], [6.27, 0.25, 0.23, -0.01]],
      shoulder: [0.68, 5.98, 0], delt: 0.22, hip: [0.45, 3.78, 0], knee: [0.34, 1.92, 0.02], ankle: [0.31, 0.28, -0.02],
      arm: { upper: 1.4, fore: 1.15, hand: 0.7, spread: 22, bend: 9 },
      r: { upper: [[0, 0.21], [0.35, 0.19], [0.7, 0.16], [1, 0.13]], fore: [[0, 0.135], [0.2, 0.155], [0.6, 0.12], [1, 0.095]],
           thigh: [[0, 0.32], [0.2, 0.45], [0.62, 0.33], [1, 0.22]], shin: [[0, 0.2], [0.25, 0.225], [0.6, 0.16], [1, 0.11]] },
      balls: { elbow: 0.13, wrist: 0.095, knee: 0.2, ankle: 0.12 },
      hand: [0.21, 0.075], foot: { len: 0.9, w: 0.17, h: 0.16 },
    },
  };
  var SEXES = ["male", "female"];
  var rad = function (d) { return d * Math.PI / 180; };

  /** the joints in head units (the right side is the left mirrored) */
  function joints(sex) {
    var P = PROPS[sex]; if (!P) throw new Error("no mannequin " + sex);
    var a = P.arm, j = {};
    ["L", "R"].forEach(function (s) {
      var k = s === "L" ? 1 : -1, sh = [P.shoulder[0] * k, P.shoulder[1], P.shoulder[2]];
      var a1 = rad(a.spread), a2 = rad(a.spread - a.bend);
      var el = [sh[0] + k * a.upper * Math.sin(a1), sh[1] - a.upper * Math.cos(a1), sh[2] + 0.02];
      var wr = [el[0] + k * a.fore * Math.sin(a2), el[1] - a.fore * Math.cos(a2), el[2] + 0.1];
      var tip = [wr[0] + k * a.hand * Math.sin(a2), wr[1] - a.hand * Math.cos(a2), wr[2] + 0.04];
      j["shoulder" + s] = sh; j["elbow" + s] = el; j["wrist" + s] = wr; j["fingertip" + s] = tip;
      j["hip" + s] = [P.hip[0] * k, P.hip[1], P.hip[2]];
      j["knee" + s] = [P.knee[0] * k, P.knee[1], P.knee[2]];
      j["ankle" + s] = [P.ankle[0] * k, P.ankle[1], P.ankle[2]];
    });
    j.crown = [0, P.marks.crown, 0]; j.chin = [0, P.marks.chin, 0.1]; j.neck = [0, P.neck.y0, P.neck.z];
    return j;
  }
  /** the proportions in head units, for the tests and the notes */
  function measure(sex) {
    var P = PROPS[sex], j = joints(sex);
    var widest = function (y0, y1) { return P.trunk.filter(function (r) { return r[0] >= y0 && r[0] <= y1; }).reduce(function (m, r) { return Math.max(m, r[1]); }, 0); };
    var narrow = function (y0, y1) { return P.trunk.filter(function (r) { return r[0] >= y0 && r[0] <= y1; }).reduce(function (m, r) { return Math.min(m, r[1]); }, 9); };
    return { heads: P.marks.crown, headHeight: P.head.r[1] * 2,
      shoulders: 2 * (P.shoulder[0] + P.delt), hips: 2 * widest(P.hip[1] - 0.3, P.hip[1] + 0.5),
      waist: 2 * narrow(P.marks.navel - 0.3, P.marks.nipples - 0.4),
      crotch: P.marks.crotch, elbow: j.elbowL[1], wrist: j.wristL[1], armTip: j.fingertipL[1], knee: j.kneeL[1] };
  }

  /* ---- geometry ---- */
  /** a closed tube through elliptical rings [{c:[x,y,z], u:[...], v:[...], a, b}] (u, v unit axes), capped */
  function tube(T, rings, n) {
    n = n || 36;
    var pos = [], idx = [], R = rings.length;
    rings.forEach(function (g) {
      for (var i = 0; i < n; i++) {
        var t = i / n * Math.PI * 2, ca = Math.cos(t) * g.a, sb = Math.sin(t) * g.b;
        pos.push(g.c[0] + g.u[0] * ca + g.v[0] * sb, g.c[1] + g.u[1] * ca + g.v[1] * sb, g.c[2] + g.u[2] * ca + g.v[2] * sb);
      }
    });
    for (var r = 0; r < R - 1; r++) for (var i = 0; i < n; i++) {
      var a = r * n + i, b = r * n + (i + 1) % n, c = (r + 1) * n + i, d = (r + 1) * n + (i + 1) % n;
      idx.push(a, c, b, b, c, d);
    }
    [0, R - 1].forEach(function (r, e) {
      var g = rings[r]; pos.push(g.c[0], g.c[1], g.c[2]); var m = pos.length / 3 - 1;
      for (var i = 0; i < n; i++) { var a = r * n + i, b = r * n + (i + 1) % n; if (e === 0) idx.push(m, a, b); else idx.push(m, b, a); }
    });
    var geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }
  var sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; };
  var len = function (a) { return Math.hypot(a[0], a[1], a[2]); };
  var nrm = function (a) { var l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  var cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
  /** a limb from a to b with a radius profile [[t, r]] (r eased between the stations), slightly oval (depth x dz) */
  function limb(T, a, b, prof, dz, rounded) {
    var ax = nrm(sub(b, a)), up = Math.abs(ax[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    var u = nrm(cross(up, ax)), v = cross(ax, u), L = len(sub(b, a)), rings = [];
    var rAt = function (t) {
      for (var i = 0; i < prof.length - 1; i++) if (t <= prof[i + 1][0]) {
        var k = (t - prof[i][0]) / (prof[i + 1][0] - prof[i][0]); k = k * k * (3 - 2 * k);
        return prof[i][1] + (prof[i + 1][1] - prof[i][1]) * k;
      }
      return prof[prof.length - 1][1];
    };
    var N = 14;
    for (var i = 0; i <= N; i++) {
      var t = i / N, r = rAt(t), cap = rounded ? Math.sqrt(Math.max(0.05, 1 - Math.pow(Math.max(0, Math.abs(t - 0.5) * 2 - 0.82) / 0.18, 2))) : 1;
      rings.push({ c: [a[0] + ax[0] * L * t, a[1] + ax[1] * L * t, a[2] + ax[2] * L * t], u: u, v: v, a: r * cap, b: r * cap * (dz || 1) });
    }
    return tube(T, rings);
  }
  /** rings [y, w, d, z] made smooth: Catmull-Rom between them, `k` steps each, the ends closed round */
  function smoothRings(rs, k) {
    var out = [], n = rs.length, at = function (i) { return rs[Math.max(0, Math.min(n - 1, i))]; };
    for (var i = 0; i < n - 1; i++) for (var s = 0; s < k; s++) {
      var t = s / k, p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2), r = [];
      for (var c = 0; c < 4; c++) r.push(0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t * t + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t * t * t));
      out.push(r);
    }
    out.push(rs[n - 1].slice());
    return out;
  }
  function blob(T, c, r, seg) {
    var g = new T.SphereGeometry(1, seg || 40, Math.round((seg || 40) * 0.7));
    g.scale(r[0], r[1], r[2]); g.translate(c[0], c[1], c[2]);
    return g;
  }

  function build(T, sex) {
    var P = PROPS[sex]; if (!P) throw new Error("no mannequin " + sex);
    var j = joints(sex), unit = P.height_m / P.heads;
    var skin = new T.MeshStandardMaterial({ color: 0xd9d2c6, roughness: 0.62, metalness: 0 });
    var joint = new T.MeshStandardMaterial({ color: 0xbfb6a8, roughness: 0.5, metalness: 0 });
    var G = new T.Group(); G.name = "mannequin_" + sex;
    var add = function (geo, m, name) { var me = new T.Mesh(geo, m || skin); me.name = name || ""; me.castShadow = true; me.receiveShadow = true; G.add(me); return me; };
    // trunk
    add(tube(T, smoothRings(P.trunk, 6).map(function (r) { return { c: [0, r[0], r[3]], u: [1, 0, 0], v: [0, 0, 1], a: r[1], b: r[2] }; }), 48), skin, "trunk");
    // the pelvis: a rounded seat over the tops of the thighs (no flat cut where the legs go in)
    add(blob(T, P.pelvis.c, P.pelvis.r, 48), skin, "pelvis");
    // neck + head + jaw
    var nk = P.neck;
    add(tube(T, [0, 0.5, 1].map(function (t) { return { c: [0, nk.y0 + (nk.y1 - nk.y0) * t, nk.z + 0.03 * t], u: [1, 0, 0], v: [0, 0, 1], a: nk.w * (1 - 0.06 * t), b: nk.d }; })), skin, "neck");
    add(blob(T, P.head.c, P.head.r, 48), skin, "head");
    add(blob(T, P.head.jaw, P.head.jr, 32), skin, "chin");
    add(blob(T, P.head.nose, P.head.nr, 20), skin, "nose");          // which way the figure faces, in profile
    // limbs
    ["L", "R"].forEach(function (s) {
      var k = s === "L" ? 1 : -1;
      add(blob(T, j["shoulder" + s], [P.delt, P.delt * 0.95, P.delt * 0.9], 32), skin, "deltoid" + s);
      add(limb(T, j["shoulder" + s], j["elbow" + s], P.r.upper, 0.92, true), skin, "upperarm" + s);
      add(blob(T, j["elbow" + s], [P.balls.elbow, P.balls.elbow, P.balls.elbow], 24), joint, "elbow" + s);
      add(limb(T, j["elbow" + s], j["wrist" + s], P.r.fore, 0.8, true), skin, "forearm" + s);
      add(blob(T, j["wrist" + s], [P.balls.wrist, P.balls.wrist, P.balls.wrist], 20), joint, "wrist" + s);
      // the hand: a palm + a mitten of fingers + the thumb, in the arm's line, palm facing the thigh
      var w = j["wrist" + s], t = j["fingertip" + s], hd = nrm(sub(t, w)), hl = len(sub(t, w));
      var palmC = [w[0] + hd[0] * hl * 0.3, w[1] + hd[1] * hl * 0.3, w[2] + hd[2] * hl * 0.3];
      var palm = blob(T, [0, 0, 0], [P.hand[1], hl * 0.34, P.hand[0]], 24);
      var fing = blob(T, [0, -hl * 0.38, 0], [P.hand[1] * 0.85, hl * 0.33, P.hand[0] * 0.9], 24);
      var thumb = blob(T, [k * -0.02, -hl * 0.08, P.hand[0] * 0.95], [P.hand[1] * 0.8, hl * 0.2, P.hand[1] * 0.9], 16);
      [palm, fing, thumb].forEach(function (g, i) {
        var m = add(g, skin, ["palm", "fingers", "thumb"][i] + s);
        m.position.set(palmC[0], palmC[1], palmC[2]);
        m.rotation.z = Math.atan2(hd[0], -hd[1]);
      });
      // the thigh starts inside the pelvis (above and in from the hip joint), so its top never shows as a cut
      var hp = j["hip" + s], top = [hp[0] * 0.8, hp[1] + 0.3, hp[2]];
      add(limb(T, top, j["knee" + s], P.r.thigh, 0.95, true), skin, "thigh" + s);
      add(blob(T, j["knee" + s], [P.balls.knee, P.balls.knee, P.balls.knee * 0.95], 28), joint, "knee" + s);
      add(limb(T, j["knee" + s], j["ankle" + s], P.r.shin, 0.92, true), skin, "shin" + s);
      add(blob(T, j["ankle" + s], [P.balls.ankle, P.balls.ankle, P.balls.ankle], 20), joint, "ankle" + s);
      // the foot: heel under the ankle, the toes forward, turned out a little
      var a = j["ankle" + s], f = P.foot;
      var foot = blob(T, [0, 0, 0], [f.w, f.h, f.len / 2], 32);
      var fm = add(foot, skin, "foot" + s);
      fm.position.set(a[0] + k * 0.03, f.h, a[2] + f.len * 0.3); fm.rotation.y = k * rad(7);
    });
    G.scale.setScalar(unit);
    G.userData = { sex: sex, heads: P.heads, height_m: P.height_m, unit: unit };
    return G;
  }

  /* ---- pictures ---- */
  var VIEWS = { front: [0, 0, 1], back: [0, 0, -1], side: [1, 0, 0], threequarter: [Math.sin(rad(40)), 0, Math.cos(rad(40))],
                head: [0, 0, 1], headside: [1, 0, 0] };
  function stage(T, sex, w, h, bg) {
    var cv = (root.document && root.document.createElement("canvas")) || null;
    cv.width = w; cv.height = h;
    var R = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true, alpha: false });
    R.setPixelRatio(1); R.setSize(w, h, false);
    if ("outputColorSpace" in R && T.SRGBColorSpace) R.outputColorSpace = T.SRGBColorSpace;
    R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
    var S = new T.Scene(); S.background = new T.Color(bg || 0xececec);
    var fig = build(T, sex); S.add(fig);
    S.add(new T.HemisphereLight(0xffffff, 0x9a9184, 1.15));
    var key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(1.6, 3.2, 2.6); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); var sc = key.shadow.camera; sc.left = -1.5; sc.right = 1.5; sc.top = 2.4; sc.bottom = -0.2; sc.near = 0.5; sc.far = 8;
    key.shadow.bias = -0.0004; S.add(key);
    var rim = new T.DirectionalLight(0xffffff, 0.55); rim.position.set(-2, 2.2, -2.4); S.add(rim);
    var fill = new T.DirectionalLight(0xffffff, 0.35); fill.position.set(-2.2, 1.2, 2); S.add(fill);
    var ground = new T.Mesh(new T.CircleGeometry(1.6, 64), new T.ShadowMaterial({ opacity: 0.16 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; S.add(ground);
    return { R: R, S: S, fig: fig, cv: cv };
  }
  function shoot(T, st, view, w, h) {
    var d = VIEWS[view] || VIEWS.front, H = st.fig.userData.height_m, u = st.fig.userData.unit;
    var headView = /^head/.test(view);
    var cy = headView ? (st.fig.userData.heads - 0.85) * u : H * 0.5;
    var halfH = headView ? 0.95 * u : H * 0.54, halfW = halfH * w / h;
    var cam = new T.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.05, 20);
    cam.position.set(d[0] * 6, cy, d[2] * 6); cam.lookAt(0, cy, 0);   // level: an orthographic reference view
    st.R.render(st.S, cam);
    return st.cv.toDataURL("image/png");
  }
  function render(T, o) {
    o = o || {};
    var w = o.w || 832, h = o.h || 1216, st = stage(T, o.sex || "male", w, h, o.bg);
    try { return shoot(T, st, o.view || "front", w, h); } finally { st.R.dispose(); }
  }
  /** every view on one picture: front, side, back, three-quarter (full body) + the head from the front and the side */
  function sheet(T, o) {
    o = o || {};
    var W = o.w || 2400, Hh = o.h || 1350, sex = o.sex || "male", P = PROPS[sex];
    var out = root.document.createElement("canvas"); out.width = W; out.height = Hh;
    var c = out.getContext("2d"); c.fillStyle = "#ececec"; c.fillRect(0, 0, W, Hh);
    var cw = Math.round(W * 0.2), ch = Hh - 90, st = stage(T, sex, cw, ch);
    var items = [["front", "Front"], ["side", "Side"], ["back", "Back"], ["threequarter", "Three-quarter"]];
    var imgs = items.map(function (it) { shoot(T, st, it[0], cw, ch); var cc = root.document.createElement("canvas"); cc.width = cw; cc.height = ch; cc.getContext("2d").drawImage(st.cv, 0, 0); return cc; });
    st.R.dispose();
    var hw = W - cw * 4, hh = Math.round((Hh - 90) / 2), st2 = stage(T, sex, hw, hh);
    var heads = [["head", "Head - front"], ["headside", "Head - side"]].map(function (it) { shoot(T, st2, it[0], hw, hh); var cc = root.document.createElement("canvas"); cc.width = hw; cc.height = hh; cc.getContext("2d").drawImage(st2.cv, 0, 0); return cc; });
    st2.R.dispose();
    c.fillStyle = "#2b2b2b"; c.font = "600 30px sans-serif"; c.textBaseline = "middle";
    c.fillText(P.label + " mannequin · " + P.heads + " heads · " + Math.round(P.height_m * 100) + " cm", 24, 40);
    c.font = "22px sans-serif";
    imgs.forEach(function (im, i) { c.drawImage(im, i * cw, 80); c.fillText(items[i][1], i * cw + 16, Hh - 24); });
    heads.forEach(function (im, i) { c.drawImage(im, cw * 4, 80 + i * hh); c.fillText([ "Head - front", "Head - side"][i], cw * 4 + 16, 80 + i * hh + 22); });
    // the head marks down the left edge of the front view
    c.strokeStyle = "rgba(0,0,0,.18)"; c.lineWidth = 1; c.font = "16px sans-serif"; c.fillStyle = "#555";
    // shoot(): the full-body frame is the height x 1.08 tall, centred on half the height -> the ground is 1.04 / 1.08 down
    var top = 80, pxPerHead = ch / (1.08 * P.heads), base = top + ch * 1.04 / 1.08;
    for (var k = 0; k <= P.heads; k++) {
      var y = base - k * pxPerHead; c.beginPath(); c.moveTo(4, y); c.lineTo(cw - 4, y); c.stroke();
      c.fillText(String(k), 8, y - 9);
    }
    return out.toDataURL("image/png");
  }

  root.H3Mannequin = { PROPS: PROPS, SEXES: SEXES, VIEWS: Object.keys(VIEWS), joints: joints, measure: measure, build: build, render: render, sheet: sheet };
  if (typeof module !== "undefined" && module.exports) module.exports = root.H3Mannequin;
})(typeof window !== "undefined" ? window : globalThis);
