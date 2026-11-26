/* bitGen Studio — static/dazformula.js (2.979.0): 💪 DAZ FORMULAS - the figure's own muscle reactions (window.H3DazFormula;
 * require() in lib/dazLib.js). Tim: "is there a way we can do live physics like deform [a character's] lips when she puts
 * makeup on or her body when she touches it, physical muscle reactions to animate?" - step 1 of claude/DAZ-SOFT-PHYSICS-PLAN.md.
 * NOT A REPLACEMENT FOR DAZ STUDIO - light tasks; Daz Studio is a very powerful character creator.
 *
 * Daz figures carry their own muscle reactions: JCMs (joint-controlled morphs) - shapes whose value is a DSON "formula" of a
 * bone's rotation (the biceps rounds as the elbow bends). A formula = {output: "<node>:<file>#<id>?value", stage "sum" |
 * "mult", operations: [{op "push", url | val}, {op "add" | "sub" | "mult" | "div"}, {op "spline_linear" | "spline_constant" |
 * "spline_tcb"} (the stack: input, the knots [x, y (, t, c, b)], how many)]}. The same formulas carry ERCs (a character dial
 * driving other shapes) - evaluated at the rest pose when a character is built.
 *   parseUrl(u) -> {node, file, id, prop}          key(u) -> "b:<bone>:<prop>" (a bone's channel) | "m:<id>" (a value)
 *   compact(formula) -> {out, stage, ops}           a formula with its urls turned into keys (null: not a ?value output)
 *   run(ops, get) -> number                         spline(kind, knots, x)
 *   evaluate(model, {bones, set}) -> {id: value}    model = {mods {id: {value, min, max, clamped}}, formulas [compact]}
 *   driven(model) -> Set                            the ids that follow a bone (directly or through another value)
 *   euler(order, x, y, z) / boneQuat(bone, rot) / swing(q, axis) / twistAxis(bone) / mirrorName / mirrorRot
 *     rotations in degrees, quaternions [x, y, z, w]; a bone = {order "XYZ" (the first letter = the twist axis), orient [x, y, z]} */
(function (root, make) {
  const m = make();
  if (typeof module === "object" && module.exports) module.exports = m; else root.H3DazFormula = m;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const BONE_PROPS = /^(rotation|translation|scale|bend)\b/;
  function parseUrl(u) {
    let s = String(u || ""), node = "", prop = "";
    const q = s.indexOf("?"); if (q >= 0) { prop = s.slice(q + 1); s = s.slice(0, q); }
    const c = s.indexOf(":"); if (c >= 0 && !/^[A-Za-z]:[\\/]/.test(s)) { node = s.slice(0, c); s = s.slice(c + 1); }
    const h = s.indexOf("#"), file = h >= 0 ? s.slice(0, h) : s, id = h >= 0 ? s.slice(h + 1) : "";
    const dec = (t) => { try { return decodeURIComponent(t); } catch (e) { return t; } };
    return { node: dec(node), file: dec(file), id: dec(id || node), prop };
  }
  function key(u) {
    const p = parseUrl(u);
    if (BONE_PROPS.test(p.prop)) return "b:" + p.id + ":" + p.prop.replace(/\/value$/, "");
    if (p.prop === "value" || !p.prop) return "m:" + p.id;
    return "x:" + p.id + ":" + p.prop;
  }
  /** a DSON formula with its urls as keys; null when its output is not a value (bone centres, end points - not applied) */
  function compact(f) {
    if (!f || !f.output || !Array.isArray(f.operations)) return null;
    const o = parseUrl(f.output); if (o.prop && o.prop !== "value") return null;
    const ops = [];
    for (const op of f.operations) {
      if (!op || !op.op) return null;
      if (op.op === "push") { if (op.url != null) ops.push({ op: "push", k: key(op.url) }); else ops.push({ op: "push", val: op.val }); }
      else ops.push({ op: op.op });
    }
    return { out: o.id, stage: f.stage === "mult" ? "mult" : "sum", ops };
  }
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
  function spline(kind, knots, x) {
    const K = (knots || []).filter((k) => Array.isArray(k) && k.length >= 2).map((k) => k.map(num)).sort((a, b) => a[0] - b[0]);
    if (!K.length) return 0;
    if (x <= K[0][0]) return K[0][1];
    if (x >= K[K.length - 1][0]) return K[K.length - 1][1];
    let i = 0; while (i + 1 < K.length && x > K[i + 1][0]) i++;
    const a = K[i], b = K[i + 1], s = (x - a[0]) / ((b[0] - a[0]) || 1);
    if (kind === "spline_constant") return a[1];
    if (kind === "spline_linear") return a[1] + (b[1] - a[1]) * s;
    // Kochanek-Bartels (TCB) - t c b = 0 is Catmull-Rom; the end knots repeat at the ends
    const p0 = (K[i - 1] || a)[1], p1 = a[1], p2 = b[1], p3 = (K[i + 2] || b)[1];
    const T1 = a[2] || 0, C1 = a[3] || 0, B1 = a[4] || 0, T2 = b[2] || 0, C2 = b[3] || 0, B2 = b[4] || 0;
    const m1 = (1 - T1) * (1 + B1) * (1 + C1) / 2 * (p1 - p0) + (1 - T1) * (1 - B1) * (1 - C1) / 2 * (p2 - p1);
    const m2 = (1 - T2) * (1 + B2) * (1 - C2) / 2 * (p2 - p1) + (1 - T2) * (1 - B2) * (1 + C2) / 2 * (p3 - p2);
    const s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * p1 + (s3 - 2 * s2 + s) * m1 + (-2 * s3 + 3 * s2) * p2 + (s3 - s2) * m2;
  }
  function run(ops, get) {
    const st = [];
    for (const o of ops || []) {
      if (o.op === "push") { st.push(o.k != null ? num(get(o.k)) : o.val); continue; }
      if (/^(add|sub|mult|div)$/.test(o.op)) {
        const b = num(st.pop()), a = num(st.pop());
        st.push(o.op === "add" ? a + b : o.op === "sub" ? a - b : o.op === "mult" ? a * b : (b ? a / b : 0));
        continue;
      }
      if (/^spline_(linear|constant|tcb)$/.test(o.op)) {
        const n = Math.max(0, Math.min(64, Math.round(num(st.pop())))), knots = [];
        for (let i = 0; i < n; i++) knots.unshift(st.pop());
        st.push(spline(o.op, knots, num(st.pop())));
        continue;
      }
      return 0;   // an operation we do not know: this formula adds nothing
    }
    return num(st.length ? st[st.length - 1] : 0);
  }
  function boneGet(bones, k) {
    const p = k.split(":"), b = (bones || {})[p[1]], prop = p.slice(2).join(":");
    if (/^scale/.test(prop)) { const v = b && b[prop.replace(/^scale\/?/, "") || "general"]; return v == null ? 1 : v; }
    if (!b) return 0;
    if (prop === "bend") return num(b.bend);
    const ax = (prop.match(/^rotation\/([xyz])/) || [])[1];
    return ax ? num(b[ax]) : 0;   // translation: not posed here (0)
  }
  function byOut(model) {
    if (model._by) return model._by;
    const by = new Map(); for (const f of model.formulas || []) { if (!f) continue; const L = by.get(f.out) || []; L.push(f); by.set(f.out, L); }
    Object.defineProperty(model, "_by", { value: by, enumerable: false, configurable: true });
    return by;
  }
  /** every value the formulas give: (its own value + the "sum" formulas) x the "mult" ones, clamped when the channel is */
  function evaluate(model, inp) {
    const mods = model.mods || {}, by = byOut(model), set = (inp && inp.set) || {}, bones = (inp && inp.bones) || {}, out = {}, busy = new Set();
    const val = (id) => {
      if (id in out) return out[id];
      if (busy.has(id)) { const m = mods[id]; return id in set ? +set[id] : m ? num(m.value) : 0; }   // a loop: its own value
      busy.add(id);
      const m = mods[id] || {}; let v = id in set ? num(+set[id]) : num(m.value), mul = 1;
      for (const f of by.get(id) || []) { const r = run(f.ops, get); if (f.stage === "mult") mul *= r; else v += r; }
      v *= mul;
      if (m.clamped) v = Math.max(m.min != null ? m.min : -Infinity, Math.min(m.max != null ? m.max : Infinity, v));
      busy.delete(id); out[id] = v; return v;
    };
    const get = (k) => (k[0] === "b" ? boneGet(bones, k) : k[0] === "m" ? val(k.slice(2)) : 0);
    for (const id of new Set(Object.keys(mods).concat([...by.keys()]))) val(id);
    return out;
  }
  /** the ids whose value follows a bone (directly, or through another value that does) */
  function driven(model) {
    const by = byOut(model), memo = new Map();
    const d = (id, seen) => {
      if (memo.has(id)) return memo.get(id);
      if (seen.has(id)) return false; seen.add(id);
      let r = false;
      for (const f of by.get(id) || []) for (const o of f.ops) if (o.k && (o.k[0] === "b" || (o.k[0] === "m" && d(o.k.slice(2), seen)))) { r = true; break; }
      memo.set(id, r); return r;
    };
    const s = new Set(); for (const id of by.keys()) if (d(id, new Set())) s.add(id);
    return s;
  }
  /* ---------------- rotations (degrees; quaternions [x, y, z, w]) */
  const R = Math.PI / 180;
  function qAxis(ax, deg) { const h = deg * R / 2, s = Math.sin(h), q = [0, 0, 0, Math.cos(h)]; q["xyz".indexOf(ax)] = s; return q; }
  function qmul(a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; }
  const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
  function qrot(q, v) { const p = qmul(qmul(q, [v[0], v[1], v[2], 0]), qconj(q)); return [p[0], p[1], p[2]]; }
  /** a rotation order "YZX": the rotation = about Y, then Z, then X (each in the frame the one before left) */
  function euler(order, x, y, z) {
    const o = /^[XYZ]{3}$/i.test(order || "") ? order.toLowerCase() : "xyz", a = { x: num(x), y: num(y), z: num(z) };
    return qmul(qmul(qAxis(o[0], a[o[0]]), qAxis(o[1], a[o[1]])), qAxis(o[2], a[o[2]]));
  }
  /** a posed bone's local rotation: its rotation in its own (oriented) frame, the rest rotation being none */
  function boneQuat(b, rot) {
    const r = rot || {}, e = euler(b && b.order, r.x, r.y, r.z), O = b && b.orient && (b.orient[0] || b.orient[1] || b.orient[2]) ? euler("XYZ", b.orient[0], b.orient[1], b.orient[2]) : null;
    return O ? qmul(qmul(O, e), qconj(O)) : e;
  }
  function twistAxis(b) {
    const o = /^[XYZ]{3}$/i.test((b && b.order) || "") ? b.order.toLowerCase() : "xyz", v = [0, 0, 0]; v["xyz".indexOf(o[0])] = 1;
    return b && b.orient && (b.orient[0] || b.orient[1] || b.orient[2]) ? qrot(euler("XYZ", b.orient[0], b.orient[1], b.orient[2]), v) : v;
  }
  /** how far a rotation bends the bone off its own axis (the twist round the axis left out), degrees 0..180 */
  function swing(q, axis) {
    const d = q[0] * axis[0] + q[1] * axis[1] + q[2] * axis[2];
    let tw = [axis[0] * d, axis[1] * d, axis[2] * d, q[3]]; const n = Math.hypot(tw[0], tw[1], tw[2], tw[3]);
    tw = n < 1e-12 ? [0, 0, 0, 1] : tw.map((x) => x / n);
    const s = qmul(q, qconj(tw));
    return 2 * Math.acos(Math.min(1, Math.abs(s[3]))) / R;
  }
  /** lForearmBend <-> rForearmBend, l_forearm <-> r_forearm, LeftHand <-> RightHand; "" when the bone has no other side */
  function mirrorName(n) {
    const s = String(n || "");
    if (/^l(?=[A-Z_])/.test(s)) return "r" + s.slice(1);
    if (/^r(?=[A-Z_])/.test(s)) return "l" + s.slice(1);
    if (/^Left/.test(s)) return "Right" + s.slice(4);
    if (/^Right/.test(s)) return "Left" + s.slice(5);
    if (/^left/.test(s)) return "right" + s.slice(4);
    if (/^right/.test(s)) return "left" + s.slice(5);
    if (/_l$/i.test(s)) return s.slice(0, -1) + (s.slice(-1) === "l" ? "r" : "R");
    if (/_r$/i.test(s)) return s.slice(0, -1) + (s.slice(-1) === "r" ? "l" : "L");
    return "";
  }
  /** the other side's rotation: the figure is mirrored across X, so x stays and y / z turn the other way */
  const mirrorRot = (r) => ({ x: num(r && r.x), y: -num(r && r.y), z: -num(r && r.z) });
  return { parseUrl, key, compact, spline, run, evaluate, driven, euler, boneQuat, twistAxis, swing, qmul, qconj, qrot, mirrorName, mirrorRot };
});
