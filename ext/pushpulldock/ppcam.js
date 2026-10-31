/* bitGen Studio — ext/pushpulldock/ppcam.js (2.629.0): THE SKETCHER'S 📷 CAMERAS (window.PPCam) - the House builder's cameras,
 * shots + depth + normal maps and 📍 360° locations, in the Sketcher.
 * Tim: "add the furniture pack and asset pack from homebuilder to sketcher and delete homeluilder ext and docker ..." -
 * asked: its cameras / 360° locations / Furnish / people / floors move too.
 *   camera {id, name, x, y, z (the eye, metres), yaw (degrees, clockwise seen from above - 0 = +x / red), pitch (up +), fov}
 *   pure: make(p, q, floorZ, eye, fov, name) / dir(c) / frustum(c, len) / clean(list) / fileName(model, cam, kind) / envName
 *   browser: threeCam(T, c) - a PerspectiveCamera at its pose; shots(V, c, model, w, h) -> the shot + depth + normal maps in
 *   the project's Image assets (POST /api/passets); location(V, c, model) -> a 360° panorama -> a Location (POST
 *   /api/environments + /api/environments/<name>/pano - the House builder's way). Node: scripts/test-cam629.js. */
(function (root) {
  "use strict";
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const rad = (d) => d * Math.PI / 180;
  function make(p, q, floorZ, eye, fov, name) {
    const yaw = q ? -Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI : 0;
    return { name: name || "Camera", x: r3(p[0]), y: r3(p[1]), z: r3((floorZ || 0) + (eye == null ? 1.6 : eye)), yaw: r3(((yaw % 360) + 360) % 360), pitch: 0, fov: fov || 60 };
  }
  function dir(c) { const y = rad(c.yaw || 0), t = rad(c.pitch || 0); return [Math.cos(y) * Math.cos(t), -Math.sin(y) * Math.cos(t), Math.sin(t)]; }
  /* 2.633.0 (Tim: "add interactive rotate, roll, yaw, pitch for camera and furniture ... include fov, lense, 35mm, 50mm, 200mm,
     fisheye, wide angle etc."): lenses on a full-frame (36 × 24 mm) camera - the up-down field of view = 2·atan(12 / mm) */
  const LENSES = [["fisheye", "Fisheye (8 mm)", 8], ["ultrawide", "Ultra wide (14 mm)", 14], ["wide", "Wide angle (24 mm)", 24], ["35", "35 mm", 35], ["50", "50 mm (normal)", 50],
    ["85", "85 mm (portrait)", 85], ["135", "135 mm", 135], ["200", "200 mm (telephoto)", 200]];
  const fovOf = (mm) => Math.min(140, Math.max(3, Math.round(2 * Math.atan(12 / Math.max(1, mm)) * 180 / Math.PI * 10) / 10));
  const mmOf = (fov) => Math.round(12 / Math.tan(rad(Math.min(140, Math.max(3, fov))) / 2) * 10) / 10;
  /** the preset a focal length is (within 0.5 mm), else "custom" */
  const lensOf = (mm) => { const L = LENSES.find((l) => Math.abs(l[2] - mm) < 0.5); return L ? L[0] : "custom"; };
  /** a camera's right / up for its yaw, pitch and roll (roll: right-handed about its looking way) */
  function frame(c) {
    const d = dir(c), z = [0, 0, 1], cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    let rt = cr(d, z); const l = Math.hypot(rt[0], rt[1], rt[2]) || 1; rt = rt.map((x) => x / l);
    let up = cr(rt, d);
    const r = rad(c.roll || 0), cs = Math.cos(r), sn = Math.sin(r);
    const rot = (v) => { const k = cr(d, v), dt = d[0] * v[0] + d[1] * v[1] + d[2] * v[2]; return [0, 1, 2].map((i) => v[i] * cs + k[i] * sn + d[i] * dt * (1 - cs)); };
    return { d, rt: rot(rt), up: rot(up) };
  }
  /** its glyph: the 4 edges from the eye to a picture plane `len` ahead + that plane's rectangle (16:9) */
  function frustum(c, len) {
    const L = len || 0.6, { d, rt, up } = frame(c);
    const hh = Math.tan(rad((c.fov || 60) / 2)) * L, hw = hh * 16 / 9, e = [c.x, c.y, c.z];
    const P = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [0, 1, 2].map((k) => e[k] + d[k] * L + rt[k] * a * hw + up[k] * b * hh));
    const out = P.map((q) => [e, q]); P.forEach((q, i) => out.push([q, P[(i + 1) % 4]]));
    return out;
  }
  function clean(list) {
    const n = (v, d, lo, hi) => { const x = +v; return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
    return (Array.isArray(list) ? list : []).map((o) => (o && typeof o === "object" ? { id: o.id, name: String(o.name || "Camera").slice(0, 40), x: n(o.x, 0, -1e4, 1e4), y: n(o.y, 0, -1e4, 1e4), z: n(o.z, 1.6, -100, 1000),
      yaw: n(o.yaw, 0, -720, 720), pitch: n(o.pitch, 0, -89, 89), roll: n(o.roll, 0, -180, 180), fov: n(o.fov, 60, 3, 140) } : null)).filter(Boolean);
  }
  const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "x";
  const fileName = (model, cam, kind) => "sketcher_" + slug(model) + "_" + slug(cam && cam.name) + "_" + kind + ".png";
  const envName = (model, cam) => (slug(model) + "-" + slug(cam && cam.name)).replace(/_/g, "-");

  /* ---- the browser */
  function threeCam(T, c) {
    const cam = new T.PerspectiveCamera(c.fov || 60, 16 / 9, 0.05, 500), d = dir(c);
    const f = frame(c);
    cam.up.set(f.up[0], f.up[1], f.up[2]); cam.position.set(c.x, c.y, c.z); cam.lookAt(c.x + d[0], c.y + d[1], c.z + d[2]); cam.updateMatrixWorld();   // 2.633.0: + its roll
    return cam;
  }
  const blobOf = (canvas) => new Promise((ok) => canvas.toBlob(ok, "image/png"));
  async function upload(blob, name) {
    const fd = new FormData(); fd.append("file", new File([blob], name, { type: "image/png" }), name);
    const j = await (await root.fetch("/api/passets", { method: "POST", body: fd })).json();
    if (!j || !j.name) throw new Error((j && j.error) || "not filed in the Image assets");
    return j.name;
  }
  async function shots(V, c, model, w, h) {
    const cam = threeCam(V.T, c), W = w || 1920, H = h || 1080, out = {};
    for (const kind of ["shot", "depth", "normal"]) {
      const cv = V.shot(W, H, { clean: true, camera: cam, photo: kind === "shot", depth: kind === "depth", normal: kind === "normal" });
      out[kind] = await upload(await blobOf(cv), fileName(model, c, kind));
    }
    if (typeof root.refreshAssets === "function") try { root.refreshAssets(); } catch (e) { /* fine */ }
    return out;
  }
  async function location(V, c, model, W) {
    const cv = V.pano([c.x, c.y, c.z], c.yaw, W || 4096), blob = await blobOf(cv), name = envName(model, c);
    const r = await (await root.fetch("/api/environments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, yaw: 0, pitch: c.pitch || 0, fov: Math.max(30, Math.min(140, c.fov || 60)) }) })).json();
    if (r.error) throw new Error(r.error);
    const env = (r.env && r.env.name) || name, fd = new FormData(); fd.append("file", blob, name + "-360.png");
    const j = await (await root.fetch("/api/environments/" + encodeURIComponent(env) + "/pano", { method: "POST", body: fd })).json();
    if (j.error) throw new Error(j.error);
    return { name: env, tag: (j.env && j.env.tag) || env, canvas: cv };
  }
  /** 2.633.0: the rotate rings of a picked camera / piece of furniture: {c (the middle), r, rings: [{key yaw | pitch | roll, axis,
      pts (a circle round axis)}]} - a camera's pitch ring turns about its right, roll about its looking way */
  function rings(kind, o) {
    let c, r, ax;
    if (kind === "cam") { const f = frame(o); c = [o.x, o.y, o.z]; r = 0.5; ax = { yaw: [0, 0, 1], pitch: f.rt, roll: f.d }; }
    else { const a = -rad(o.rot || 0); c = [o.x, o.y, (o.z || 0) + (o.h || 1) / 2]; r = Math.max(o.w || 1, o.d || 1, o.h || 1) / 2 + 0.15; ax = { yaw: [0, 0, 1], pitch: [Math.cos(a), Math.sin(a), 0], roll: [-Math.sin(a), Math.cos(a), 0] }; }
    const circle = (n) => {
      const t0 = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      let u = cr(n, t0); const l = Math.hypot(u[0], u[1], u[2]) || 1; u = u.map((x) => x / l); const v = cr(n, u);
      const pts = []; for (let k = 0; k < 48; k++) { const t = k / 48 * Math.PI * 2; pts.push([0, 1, 2].map((i) => c[i] + (u[i] * Math.cos(t) + v[i] * Math.sin(t)) * r)); }
      return pts;
    };
    return { c, r, rings: ["yaw", "pitch", "roll"].map((key) => ({ key, axis: ax[key], pts: circle(ax[key]) })) };
  }
  /** a turn of `deg` right-handed about a ring's axis -> the new yaw / pitch / roll (yaw is clockwise seen from above) */
  function turnBy(o, key, deg, kind) {
    const w = (x) => Math.round((((x % 360) + 540) % 360 - 180) * 10) / 10;
    if (key === "yaw") { if (kind === "cam") o.yaw = ((Math.round((o.yaw - deg) * 10) / 10 % 360) + 360) % 360; else o.rot = ((Math.round((o.rot - deg) * 10) / 10 % 360) + 360) % 360; }
    else if (key === "pitch") o.pitch = kind === "cam" ? Math.max(-89, Math.min(89, Math.round(((o.pitch || 0) + deg) * 10) / 10)) : w((o.pitch || 0) + deg);
    else o.roll = w((o.roll || 0) + deg);
    return o;
  }
  const api = { LENSES, fovOf, mmOf, lensOf, frame, rings, turnBy, make, dir, frustum, clean, fileName, envName, threeCam, shots, location };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PPCam = api;
})(typeof window !== "undefined" ? window : globalThis);
