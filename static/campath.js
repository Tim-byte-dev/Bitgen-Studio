/* bitGen Studio — THE CAMERA PATH (2.399.0), window.CamPath (and require("../static/campath.js") on the server).
 *
 * Tim (verbatim): "can we add camera movement to follow a 3d path, pan,roll and dolly, height and angle to the tools in
 * timeline docker. will we be able to tell mmh3 , wan and ltx to follow these paths and camera movement" - asked, he
 * chose "Also an exact-path guide": the moves in words + each model's own camera control, AND a guide video rendered
 * from the first frame (its depth) along the exact path.
 *
 * THE WORLD   the picture stands at z = 0, 2 units tall (y -1..1) and 2 x aspect wide. The camera starts at (0, 0, D)
 *             looking down -z, where D frames the picture exactly at the lens (35 mm on a 24 mm-tall sensor).
 * THE CAMERA  cam = {v, use, exact, dur, ease, aim, lens, path: [[x, y, z]...], keys: [{f, pan, tilt, roll, height,
 *             dolly, lens}], preset}
 *               path    where the camera travels - a smooth curve through the points, at an even speed along it (eased)
 *               aim     "fixed" (straight ahead, -z) | "centre" (always at the picture's centre - an orbit looks in) |
 *                       "path" (along the direction of travel)
 *               keys    at f (0..1 of the move): pan (yaw, + right), tilt (+ up), roll (+ clockwise), height (+ up,
 *                       units), dolly (+ forward along the view, units), lens (mm) - smoothly in between
 * Pure: poseAt(cam, f), preset(name, lens), describe(cam, seconds) (the moves the path makes: push in, truck, pedestal,
 * pan, tilt, roll, orbit, zoom - segmented where they change), plan(cam, {engine, seconds}) - what each model is told:
 *   MiniMax H3  its own camera sentence ("The camera pushes in with large amplitude at slow speed.") - ONE move a shot
 *   Wan         the Fun Camera model's move (WanCameraEmbedding: Zoom In / Pan Left / ClockWise (CW) ...) + words
 *   LTX         the matching LTX-2 camera-control LoRA (dolly in / out / left / right, jib up / down, static) + words
 * The exact-path guide itself is rendered by ext/timelinedock/camera.js (three.js) from these poses.
 */
(function (root) {
  "use strict";
  const SENSOR_H = 24;                                 // mm, full-frame height: lens -> vertical field of view
  const DEF_LENS = 35;
  const STEPS = 48;
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const R2D = 180 / Math.PI, D2R = Math.PI / 180;
  const round = (v, k) => { const m = Math.pow(10, k == null ? 3 : k); return Math.round(v * m) / m; };

  /** vertical field of view (radians) for a focal length (mm) */
  function fovOf(lens) { return 2 * Math.atan(SENSOR_H / 2 / clamp(num(lens, DEF_LENS), 8, 400)); }
  /** the distance at which the 2-unit-tall picture fills the frame */
  function distFor(lens) { return 1 / Math.tan(fovOf(lens) / 2); }

  const EASES = ["linear", "inout", "in", "out"];
  const AIMS = ["fixed", "centre", "path"];
  const KEY_FIELDS = ["pan", "tilt", "roll", "height", "dolly", "lens"];
  function ease(f, how) {
    f = clamp(f, 0, 1);
    return how === "inout" ? f * f * (3 - 2 * f) : how === "in" ? f * f : how === "out" ? 1 - (1 - f) * (1 - f) : f;
  }

  function defaults(lens) {
    const L = num(lens, DEF_LENS);
    return { v: 1, use: false, exact: false, dur: 5, ease: "inout", aim: "fixed", lens: L, path: [[0, 0, round(distFor(L))]], keys: [], preset: "static" };
  }
  /** a camera from anywhere (the page, a saved timeline, a request) made safe */
  function norm(c) {
    const x = c && typeof c === "object" ? c : {};
    const d = defaults(x.lens);
    const pts = (Array.isArray(x.path) ? x.path : []).filter((p) => Array.isArray(p) && p.length >= 3)
      .slice(0, 32).map((p) => [clamp(num(p[0], 0), -50, 50), clamp(num(p[1], 0), -50, 50), clamp(num(p[2], d.path[0][2]), -50, 50)]);
    const keys = (Array.isArray(x.keys) ? x.keys : []).filter((k) => k && typeof k === "object").slice(0, 64).map((k) => ({
      f: clamp(num(k.f, 0), 0, 1), pan: clamp(num(k.pan, 0), -180, 180), tilt: clamp(num(k.tilt, 0), -89, 89),
      roll: clamp(num(k.roll, 0), -180, 180), height: clamp(num(k.height, 0), -20, 20), dolly: clamp(num(k.dolly, 0), -20, 20),
      lens: clamp(num(k.lens, d.lens), 8, 400) })).sort((a, b) => a.f - b.f);
    return {
      v: 1, use: !!x.use, exact: !!x.exact, dur: clamp(num(x.dur, 5), 0.5, 60),
      ease: EASES.includes(x.ease) ? x.ease : "inout", aim: AIMS.includes(x.aim) ? x.aim : "fixed",
      lens: clamp(num(x.lens, DEF_LENS), 8, 400), path: pts.length ? pts : d.path, keys,
      preset: typeof x.preset === "string" ? x.preset.slice(0, 40) : "custom",
      ...(x.start != null ? { start: clamp(num(x.start, 0), 0, 36000) } : {}),
    };
  }

  /* ---------------------------------------------------------------- the path (3D Catmull-Rom, arc length) */
  function sample(pts, per) {
    per = per || 16;
    const P = (pts || []).map((p) => [num(p[0], 0), num(p[1], 0), num(p[2], 0)]);
    if (P.length < 2) return { pts: P, len: [0], total: 0 };
    const out = [P[0]];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      for (let k = 1; k <= per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1, 2].map((j) => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
          + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    const len = [0];
    for (let m = 1; m < out.length; m++) len.push(len[m - 1] + Math.hypot(out[m][0] - out[m - 1][0], out[m][1] - out[m - 1][1], out[m][2] - out[m - 1][2]));
    return { pts: out, len, total: len[len.length - 1] };
  }
  /** the point at g (0..1 of the path's LENGTH) and the direction of travel there */
  function pointAt(S, g) {
    if (!S.pts.length) return { p: [0, 0, distFor(DEF_LENS)], t: [0, 0, 0] };
    if (S.pts.length === 1 || S.total <= 1e-9) return { p: S.pts[0].slice(), t: [0, 0, 0] };
    const d = clamp(g, 0, 1) * S.total;
    let lo = 0, hi = S.len.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S.len[mid] < d) lo = mid; else hi = mid; }
    const seg = Math.max(1e-9, S.len[hi] - S.len[lo]), t = clamp((d - S.len[lo]) / seg, 0, 1);
    const a = S.pts[lo], b = S.pts[hi];
    const dir = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], n = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    return { p: [a[0] + dir[0] * t, a[1] + dir[1] * t, a[2] + dir[2] * t], t: [dir[0] / n, dir[1] / n, dir[2] / n] };
  }
  const cache = new WeakMap();
  function sampled(cam) {
    let s = cache.get(cam);
    const sig = JSON.stringify(cam.path);
    if (!s || s.sig !== sig) { s = { sig, S: sample(cam.path) }; cache.set(cam, s); }
    return s.S;
  }

  /** the keyed values at f: smoothly between the keys either side (before the first = the first; none = zeros) */
  function keysAt(cam, f) {
    const K = cam.keys || [], out = { pan: 0, tilt: 0, roll: 0, height: 0, dolly: 0, lens: num(cam.lens, DEF_LENS) };
    if (!K.length) return out;
    if (f <= K[0].f) { KEY_FIELDS.forEach((k) => { out[k] = num(K[0][k], out[k]); }); return out; }
    const last = K[K.length - 1];
    if (f >= last.f) { KEY_FIELDS.forEach((k) => { out[k] = num(last[k], out[k]); }); return out; }
    let i = 0;
    while (i < K.length - 1 && K[i + 1].f < f) i++;
    const a = K[i], b = K[i + 1], span = Math.max(1e-9, b.f - a.f), t = (f - a.f) / span, s = t * t * (3 - 2 * t);
    KEY_FIELDS.forEach((k) => { const va = num(a[k], out[k]), vb = num(b[k], out[k]); out[k] = va + (vb - va) * s; });
    return out;
  }
  /** the camera at f (0..1 of its move): position, yaw / pitch / roll (degrees), lens, fov (radians), its axes */
  function poseAt(camIn, f) {
    const cam = camIn && camIn.path ? camIn : norm(camIn);
    const g = ease(clamp(num(f, 0), 0, 1), cam.ease);
    const at = pointAt(sampled(cam), g);
    const k = keysAt(cam, clamp(num(f, 0), 0, 1));
    let yaw0 = 0, pitch0 = 0;
    if (cam.aim === "centre") {
      const d = [-at.p[0], -at.p[1], -at.p[2]];
      if (Math.hypot(d[0], d[1], d[2]) > 1e-6) { yaw0 = Math.atan2(d[0], -d[2]) * R2D; pitch0 = Math.atan2(d[1], Math.hypot(d[0], d[2])) * R2D; }
    } else if (cam.aim === "path" && Math.hypot(at.t[0], at.t[1], at.t[2]) > 1e-6) {
      yaw0 = Math.atan2(at.t[0], -at.t[2]) * R2D; pitch0 = Math.atan2(at.t[1], Math.hypot(at.t[0], at.t[2])) * R2D;
    }
    const yaw = yaw0 + k.pan, pitch = clamp(pitch0 + k.tilt, -89, 89), roll = k.roll;
    const y = yaw * D2R, p = pitch * D2R;
    const fwd = [Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)];
    const right = [Math.cos(y), 0, Math.sin(y)];
    const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
    const pos = [at.p[0] + fwd[0] * k.dolly, at.p[1] + k.height + fwd[1] * k.dolly, at.p[2] + fwd[2] * k.dolly];
    // the frame's own axes with the roll (+ = the camera turns clockwise: its right side goes down)
    const r = roll * D2R, cr = Math.cos(r), sr = Math.sin(r);
    const rr = [right[0] * cr - up[0] * sr, right[1] * cr - up[1] * sr, right[2] * cr - up[2] * sr];
    const ru = [up[0] * cr + right[0] * sr, up[1] * cr + right[1] * sr, up[2] * cr + right[2] * sr];
    return { pos, yaw, pitch, roll, lens: k.lens, fov: fovOf(k.lens), fwd, right, up, rright: rr, rup: ru };
  }
  /** where the frame's four corners land on the picture (z = 0), in picture pixels (W x H, the picture 2 units tall)
   *  - null when a corner looks away from it. aspect = the render's width / height */
  function frameOnPicture(pose, W, H, aspect) {
    const A = W / H, tv = Math.tan(pose.fov / 2), th = tv * (aspect || A);
    const out = [];
    for (const [u, v] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
      const d = [0, 1, 2].map((j) => pose.fwd[j] + pose.rright[j] * u * th + pose.rup[j] * v * tv);
      if (d[2] >= -1e-6) return null;
      const t = -pose.pos[2] / d[2];
      if (t <= 0) return null;
      const x = pose.pos[0] + t * d[0], y = pose.pos[1] + t * d[1];
      out.push({ x: (x + A) / (2 * A) * W, y: (1 - y) / 2 * H });
    }
    return out;
  }

  /* ---------------------------------------------------------------- presets */
  const PRESETS = {
    static: "Static", push_in: "Push in (dolly in)", pull_out: "Pull out (dolly out)", truck_left: "Truck left", truck_right: "Truck right",
    pedestal_up: "Pedestal up (rise)", pedestal_down: "Pedestal down (lower)", pan_left: "Pan left", pan_right: "Pan right",
    tilt_up: "Tilt up", tilt_down: "Tilt down", roll_cw: "Roll clockwise", roll_ccw: "Roll counterclockwise",
    orbit_left: "Orbit left", orbit_right: "Orbit right", crane_up: "Crane up (rise, look down)", crane_down: "Crane down",
    zoom_in: "Zoom in (lens)", zoom_out: "Zoom out (lens)", fly_in: "Fly in (through the scene)",
  };
  function preset(name, lens) {
    const L = num(lens, DEF_LENS), D = round(distFor(L));
    const c = defaults(L);
    const keys2 = (k, a, b) => [{ f: 0, pan: 0, tilt: 0, roll: 0, height: 0, dolly: 0, lens: L, [k]: a }, { f: 1, pan: 0, tilt: 0, roll: 0, height: 0, dolly: 0, lens: L, [k]: b }];
    const arc = (deg) => [0, 0.25, 0.5, 0.75, 1].map((t) => { const a = deg * t * D2R; return [round(D * Math.sin(a)), 0, round(D * Math.cos(a))]; });
    const P = {
      static: { path: [[0, 0, D]] },
      push_in: { path: [[0, 0, D], [0, 0, round(D * 0.55)]] },
      pull_out: { path: [[0, 0, round(D * 0.7)], [0, 0, round(D * 1.15)]] },
      truck_left: { path: [[0.35, 0, D], [-0.35, 0, D]] }, truck_right: { path: [[-0.35, 0, D], [0.35, 0, D]] },
      pedestal_up: { path: [[0, -0.3, D], [0, 0.3, D]] }, pedestal_down: { path: [[0, 0.3, D], [0, -0.3, D]] },
      pan_left: { path: [[0, 0, D]], keys: keys2("pan", 0, -20) }, pan_right: { path: [[0, 0, D]], keys: keys2("pan", 0, 20) },
      tilt_up: { path: [[0, 0, D]], keys: keys2("tilt", 0, 12) }, tilt_down: { path: [[0, 0, D]], keys: keys2("tilt", 0, -12) },
      roll_cw: { path: [[0, 0, D]], keys: keys2("roll", 0, 15) }, roll_ccw: { path: [[0, 0, D]], keys: keys2("roll", 0, -15) },
      orbit_left: { path: arc(-35), aim: "centre" }, orbit_right: { path: arc(35), aim: "centre" },
      crane_up: { path: [[0, -0.15, D], [0, 0.6, round(D * 0.92)]], keys: keys2("tilt", 0, -12) },
      crane_down: { path: [[0, 0.6, round(D * 0.92)], [0, -0.15, D]], keys: keys2("tilt", -12, 0) },
      zoom_in: { path: [[0, 0, D]], keys: keys2("lens", L, round(L * 1.8, 1)) },
      zoom_out: { path: [[0, 0, D]], keys: keys2("lens", round(L * 1.4, 1), L) },
      fly_in: { path: [[0, 0.2, round(D * 1.05)], [0.15, 0.08, round(D * 0.65)], [0, 0, round(D * 0.3)]] },
    }[name];
    if (!P) return null;
    return norm(Object.assign(c, { preset: name, aim: "fixed", keys: [] }, P));
  }

  /* ---------------------------------------------------------------- what the path DOES (the moves) */
  const KINDS = ["dolly", "truck", "pedestal", "pan", "tilt", "roll", "orbit", "zoom"];
  const DIRS = { dolly: ["in", "out"], truck: ["right", "left"], pedestal: ["up", "down"], pan: ["right", "left"],
                 tilt: ["up", "down"], roll: ["cw", "ccw"], orbit: ["right", "left"], zoom: ["in", "out"] };
  /** one step's moves as scores (about 1 per degree; 10 % of the distance to the picture = 5) */
  function stepScores(a, b) {
    const dist = Math.max(0.3, Math.hypot(a.pos[0], a.pos[1], a.pos[2]));
    const d = [b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]];
    const y = a.yaw * D2R, fH = [Math.sin(y), 0, -Math.cos(y)], rH = [Math.cos(y), 0, Math.sin(y)];
    const k = 50 / dist;
    const s = {
      dolly: (d[0] * fH[0] + d[2] * fH[2]) * k, truck: (d[0] * rH[0] + d[2] * rH[2]) * k, pedestal: d[1] * k,
      pan: b.yaw - a.yaw, tilt: b.pitch - a.pitch, roll: b.roll - a.roll, zoom: 50 * Math.log(Math.max(1e-6, b.lens) / Math.max(1e-6, a.lens)), orbit: 0,
    };
    // moving sideways while turning back toward where it was looking = an orbit (an arc around the subject)
    if (Math.abs(s.truck) > 0.15 && Math.abs(s.pan) > 0.15 && s.truck * s.pan < 0 && Math.abs(s.truck) > Math.abs(s.dolly)) {
      s.orbit = Math.sign(s.truck) * Math.max(Math.abs(s.truck), Math.abs(s.pan)); s.truck = 0; s.pan = 0;
    }
    return s;
  }
  function sizeOf(amount) { return amount < 6 ? "small" : amount > 25 ? "large" : "medium"; }
  function speedOf(amount, secs) { const r = amount / Math.max(0.1, secs); return r < 3 ? "slow" : r > 12 ? "fast" : "normal"; }
  /** cam -> {segments: [{kind, dir, f0, f1, amount, size, speed}], start: {angle, height, dutch, lens}, primary} */
  function describe(camIn, seconds) {
    const cam = norm(camIn);
    const secs = Math.max(0.5, num(seconds, cam.dur));
    const poses = [];
    for (let i = 0; i <= STEPS; i++) poses.push(poseAt(cam, i / STEPS));
    const steps = [];
    for (let i = 0; i < STEPS; i++) {
      const s = stepScores(poses[i], poses[i + 1]);
      let best = "static", bv = 0;
      for (const kd of KINDS) if (Math.abs(s[kd]) > Math.abs(bv)) { best = kd; bv = s[kd]; }
      if (Math.abs(bv) < 0.08) { best = "static"; bv = 0; }
      steps.push({ kind: best, dir: best === "static" ? "" : DIRS[best][bv >= 0 ? 0 : 1], v: Math.abs(bv) });
    }
    let segs = [];
    steps.forEach((st, i) => {
      const last = segs[segs.length - 1];
      if (last && last.kind === st.kind && last.dir === st.dir) { last.n++; last.amount += st.v; last.f1 = (i + 1) / STEPS; }
      else segs.push({ kind: st.kind, dir: st.dir, n: 1, amount: st.v, f0: i / STEPS, f1: (i + 1) / STEPS });
    });
    // short, small moves are folded into their neighbour; then neighbours of the same move join
    const maxA = Math.max(0, ...segs.map((s) => s.amount));
    for (let guard = 0; guard < 64 && segs.length > 1; guard++) {
      const i = segs.findIndex((s) => s.n < 5 && s.amount < 0.35 * maxA);
      if (i < 0) break;
      const host = i > 0 ? segs[i - 1] : segs[i + 1];
      host.n += segs[i].n; host.f0 = Math.min(host.f0, segs[i].f0); host.f1 = Math.max(host.f1, segs[i].f1);
      segs.splice(i, 1);
      for (let j = segs.length - 1; j > 0; j--) if (segs[j].kind === segs[j - 1].kind && segs[j].dir === segs[j - 1].dir) {
        segs[j - 1].n += segs[j].n; segs[j - 1].amount += segs[j].amount; segs[j - 1].f1 = segs[j].f1; segs.splice(j, 1);
      }
    }
    if (segs.length > 1) segs = segs.filter((s) => s.kind !== "static" || s.n >= 8);
    if (!segs.length) segs = [{ kind: "static", dir: "", n: STEPS, amount: 0, f0: 0, f1: 1 }];
    segs = segs.slice(0, 4).map((s) => ({ kind: s.kind, dir: s.dir, f0: round(s.f0, 3), f1: round(s.f1, 3), amount: round(s.amount, 2),
      size: s.kind === "static" ? "" : sizeOf(s.amount), speed: s.kind === "static" ? "" : speedOf(s.amount, secs * Math.max(0.05, s.f1 - s.f0)) }));
    const primary = segs.slice().sort((a, b) => b.amount - a.amount)[0];
    const p0 = poses[0];
    const angle = p0.pitch < -25 ? "high" : p0.pitch < -8 ? "slightly high" : p0.pitch > 25 ? "low" : p0.pitch > 8 ? "slightly low" : "eye level";
    const start = { angle, pitch: round(p0.pitch, 1), height: round(p0.pos[1], 2), dutch: Math.abs(p0.roll) >= 5 ? round(p0.roll, 1) : 0, lens: round(p0.lens, 1) };
    return { segments: segs, primary, start, seconds: secs };
  }

  /* ---------------------------------------------------------------- words, per model */
  const H3_VERB = { dolly: { in: "pushes in", out: "pulls out" }, truck: { left: "trucks left", right: "trucks right" },
    pedestal: { up: "pedestals up", down: "pedestals down" }, pan: { left: "pans left", right: "pans right" },
    tilt: { up: "tilts up", down: "tilts down" }, roll: { cw: "rolls clockwise", ccw: "rolls counterclockwise" },
    orbit: { left: "arcs around the subject", right: "arcs around the subject" }, zoom: { in: "zooms in", out: "zooms out" } };
  /** MiniMax H3's own camera sentence for one move (its published phrases; amplitude and speed modifiers) */
  function h3Sentence(seg) {
    if (!seg || seg.kind === "static") return "The camera holds a static shot.";
    const verb = (H3_VERB[seg.kind] || {})[seg.dir] || "moves";
    const amp = seg.size === "small" ? " with small amplitude" : seg.size === "large" ? " with large amplitude" : "";
    const spd = seg.speed === "slow" ? " at slow speed" : seg.speed === "fast" ? " at fast speed" : "";
    return `The camera ${verb}${amp}${spd}.`;
  }
  function framing(start) {
    const bits = [];
    if (start.angle === "high") bits.push("a high-angle view looking down");
    else if (start.angle === "slightly high") bits.push("a slightly high angle");
    else if (start.angle === "low") bits.push("a low-angle view looking up");
    else if (start.angle === "slightly low") bits.push("a slightly low angle");
    if (start.dutch) bits.push("a Dutch angle (the horizon tilted)");
    if (start.lens <= 24) bits.push("a wide-angle lens"); else if (start.lens >= 70) bits.push("a telephoto lens");
    return bits;
  }
  const PROSE = { dolly: { in: "push in toward the subject", out: "pull back away from the subject" },
    truck: { left: "truck to the left", right: "truck to the right" }, pedestal: { up: "rise (pedestal up)", down: "lower (pedestal down)" },
    pan: { left: "pan to the left", right: "pan to the right" }, tilt: { up: "tilt up", down: "tilt down" },
    roll: { cw: "roll clockwise", ccw: "roll counterclockwise" }, orbit: { left: "orbit to the left around the subject", right: "orbit to the right around the subject" },
    zoom: { in: "zoom in", out: "zoom out" } };
  function proseMove(s) {
    if (s.kind === "static") return "a static hold";
    const adj = [s.speed === "slow" ? "slow" : s.speed === "fast" ? "fast" : "", s.size === "small" ? "slight" : s.size === "large" ? "sweeping" : ""].filter(Boolean).join(" ");
    const w = (adj ? adj + " " : "") + ((PROSE[s.kind] || {})[s.dir] || "move");
    return (/^[aeiou]/i.test(w) ? "an " : "a ") + w;
  }
  /** the camera in prose (Wan, LTX, the LLM): framing, then the moves in order */
  function prose(desc) {
    const fr = framing(desc.start);
    const mv = desc.segments.map(proseMove);
    return "Camera: " + (fr.length ? fr.join(", ") + "; " : "") + (mv.length === 1 && desc.segments[0].kind === "static"
      ? "the camera holds still, one continuous take." : mv.join(", then ") + ", one continuous take with no cuts.");
  }
  /** the Wan Fun Camera move (ComfyUI's WanCameraEmbedding camera_pose) for the main move, + its speed */
  const WAN_POSE = { dolly: { in: "Zoom In", out: "Zoom Out" }, zoom: { in: "Zoom In", out: "Zoom Out" },
    truck: { left: "Pan Left", right: "Pan Right" }, pan: { left: "Pan Left", right: "Pan Right" }, orbit: { left: "Pan Left", right: "Pan Right" },
    pedestal: { up: "Pan Up", down: "Pan Down" }, tilt: { up: "Pan Up", down: "Pan Down" },
    roll: { cw: "ClockWise (CW)", ccw: "Anti Clockwise (ACW)" } };
  const WAN_POSES = ["Static", "Pan Up", "Pan Down", "Pan Left", "Pan Right", "Zoom In", "Zoom Out", "Anti Clockwise (ACW)", "ClockWise (CW)"];
  function wanPose(seg) {
    if (!seg || seg.kind === "static") return { pose: "Static", speed: 1, approx: false };
    const pose = (WAN_POSE[seg.kind] || {})[seg.dir] || "Static";
    return { pose, speed: seg.size === "small" ? 0.6 : seg.size === "large" ? 1.6 : 1, approx: ["pan", "tilt", "orbit", "zoom"].includes(seg.kind) };
  }
  /** the LTX-2 camera-control LoRA for the main move (Lightricks/LTX-2-19b-LoRA-Camera-Control-<Key>) */
  const LTX_KEY = { dolly: { in: "dolly-in", out: "dolly-out" }, truck: { left: "dolly-left", right: "dolly-right" },
    pedestal: { up: "jib-up", down: "jib-down" } };
  function ltxLora(seg) {
    if (!seg) return null;
    const key = seg.kind === "static" ? "static" : (LTX_KEY[seg.kind] || {})[seg.dir];
    if (!key) return null;
    return { key, re: "camera[-_ ]?control[-_ ]?" + key.replace("-", "[-_ ]?"),
             repo: "Lightricks/LTX-2-19b-LoRA-Camera-Control-" + key.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("-"),
             file: "ltx-2-19b-lora-camera-control-" + key + ".safetensors" };
  }
  /** what each model is told. o = {seconds} -> {desc, h3, prose, wan, ltx, notes} */
  function plan(camIn, o) {
    const cam = norm(camIn);
    const desc = describe(cam, (o || {}).seconds);
    const notes = [];
    const fr = framing(desc.start);
    const h3 = (fr.length ? fr.map((b) => b[0].toUpperCase() + b.slice(1)).join(", ") + ". " : "") + h3Sentence(desc.primary);
    if (desc.segments.length > 1) notes.push(`MiniMax H3 takes ONE camera move a shot - told the main one (${proseMove(desc.primary)}); `
      + (cam.exact ? "the guide video carries the rest of the path" : "the rest of the path is not in its words"));
    const wan = wanPose(desc.primary);
    if (wan.approx) notes.push(`Wan's Fun Camera has no ${desc.primary.kind} - the nearest of its moves is used (${wan.pose})`);
    const ltx = ltxLora(desc.primary);
    if (!ltx) notes.push(`LTX has no camera LoRA for a ${desc.primary.kind} - its words carry it`);
    return { desc, h3, prose: prose(desc), wan, ltx, notes };
  }
  /** what a guide depends on (re-render when this changes) */
  function sig(camIn, extra) {
    const c = norm(camIn);
    return JSON.stringify([c.path, c.keys, c.aim, c.ease, c.lens, c.dur, extra || ""]);
  }

  const api = { SENSOR_H, DEF_LENS, STEPS, EASES, AIMS, KEY_FIELDS, PRESETS, KINDS, WAN_POSES, fovOf, distFor, ease, defaults, norm,
                sample, pointAt, keysAt, poseAt, frameOnPicture, preset, stepScores, describe, h3Sentence, framing, prose, proseMove, wanPose, ltxLora, plan, sig };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) root.CamPath = api;
})(typeof window !== "undefined" ? window : globalThis);
