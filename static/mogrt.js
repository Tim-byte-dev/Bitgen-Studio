/* bitGen Studio — static/mogrt.js (2.417.0): MOTION GRAPHICS TEMPLATES - the maths shared by the page
 * (ext/timelinedock/mogrt.js 🧩), the server (lib/mogrt.js) and the unit tests (window.H3Mogrt / require).
 *
 * Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior" (Premiere's
 * Essential Graphics .mogrt: a designed title saved once, dropped in again with its words changed).
 *
 * A template = { version: 1, name, w, h, len, layers: [{ name, text, opacity, clips: [clip] }], fields: [field] }
 *   the picture / text layers as they were designed: starts relative to the template's start (the first clip at 0),
 *   positions (tf.x / tf.y, keyframe x / y) in pixels from the centre of a w x h picture, every ◆ keyframe, text
 *   preset (fx), opacity. A picture clip keeps its file name (the server keeps the file with the template).
 *   field = { key: "L<layer>C<clip>", label, layer, clip, value } - every TEXT clip is an editable field.
 *   A picture clip may carry nat = {w, h} (its file's size - lib/mogrt.js adds it) so it keeps its designed width on a
 *   smaller picture (the canvas never draws a picture wider than the frame).
 *
 *   capture(layers, opts)          -> a template from page layers ({name, text, opacity, clips}); opts = {name, w, h,
 *                                     labels: {key: label}} - errors (thrown) when there is nothing to keep
 *   fields(tpl)                    -> the editable texts
 *   instantiate(tpl, o)            -> page layers ready to push onto tl.images; o = {at (seconds), w, h,
 *                                     values: {key: text}, newId()}: starts moved to `at`, the design scaled to the
 *                                     picture (min(w/tw, h/th) - positions, text size + outline, picture scale), text
 *                                     clips given new ids (their picture is drawn and saved by the canvas)
 *   clean(tpl)                     -> the template with only the keys it may hold (the server stores this)
 * 2.511.0: 📋 EXPOSED FIELDS (Tim: "... plus exposed template fields") - a clip's expose = {prop: label} (prop: color
 *   (a text's colour), op, x, y, scale, rot) becomes a field {key: "L<l>C<c>:<prop>", type: "color" | "num", prop,
 *   label, value}; its value, given when the template is dropped in, sets that property (a keyed one: its keys move
 *   by the change). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.H3Mogrt = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var CLIP_KEYS = ["start", "len", "opacity", "tf", "kf", "fx", "text", "name", "blend", "nat", "expose"];
  var EXPOSE = ["color", "op", "x", "y", "scale", "rot"];
  var TEXT_KEYS = ["content", "font", "size", "color", "bold", "italic", "stroke", "strokeW", "shadow", "align", "fx"];
  var MAX_LAYERS = 24, MAX_CLIPS = 64;

  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function copy(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function base(n) { return String(n == null ? "" : n).split(/[\\/]/).pop(); }
  function err(m) { var e = new Error(m); e.status = 400; return e; }

  function cleanText(t) {
    var o = {};
    TEXT_KEYS.forEach(function (k) { if (t && t[k] !== undefined) o[k] = copy(t[k]); });
    o.content = String(o.content == null ? "" : o.content).slice(0, 2000);
    return o;
  }
  function cleanClip(c) {
    var o = {};
    CLIP_KEYS.forEach(function (k) { if (c && c[k] !== undefined) o[k] = copy(c[k]); });
    o.start = Math.max(0, num(o.start, 0));
    o.len = Math.max(0.1, Math.min(3600, num(o.len, 5)));
    if (o.opacity != null) o.opacity = Math.max(0, Math.min(1, num(o.opacity, 1)));
    if (o.nat) o.nat = num(o.nat.w, 0) > 0 && num(o.nat.h, 0) > 0 ? { w: Math.round(+o.nat.w), h: Math.round(+o.nat.h) } : undefined;
    if (!o.nat) delete o.nat;
    if (o.text) { o.text = cleanText(o.text); delete o.name; delete o.nat; }
    else if (o.name) o.name = base(o.name);
    if (o.kf && !Array.isArray(o.kf)) delete o.kf;
    if (o.expose) { var ex = {}; EXPOSE.forEach(function (p) { if (o.expose[p] != null && (p !== "color" || o.text)) ex[p] = String(o.expose[p]).slice(0, 60); }); if (Object.keys(ex).length) o.expose = ex; else delete o.expose; }
    return o;
  }
  function exposedValue(c, p) {
    var tf = c.tf || {};
    if (p === "color") return (c.text && c.text.color) || "#ffffff";
    if (p === "op") return c.opacity == null ? 1 : num(c.opacity, 1);
    if (p === "scale") return tf.scale == null ? 1 : num(tf.scale, 1);
    return num(tf[p], 0);
  }
  /** an exposed field's value given: set it (a keyed property: its keys move by the change) */
  function applyExposed(c, p, v) {
    if (p === "color") { if (c.text && /^#[0-9a-f]{6}$/i.test(String(v))) c.text.color = String(v).toLowerCase(); return; }
    v = Number(v); if (!isFinite(v)) return;
    var keyed = Array.isArray(c.kf) && c.kf.some(function (k) { return k && k[p] != null; });
    if (keyed) { var first = c.kf.filter(function (k) { return k && k[p] != null; }).sort(function (a, b) { return a.at - b.at; })[0][p], d = v - num(first, 0); c.kf = c.kf.map(function (k) { if (!k || k[p] == null) return k; var q = copy(k); q[p] = +(num(q[p], 0) + d).toFixed(4); return q; }); }
    if (p === "op") c.opacity = Math.max(0, Math.min(1, v));
    else { c.tf = Object.assign({ x: 0, y: 0, scale: 1, rot: 0 }, c.tf || {}); c.tf[p] = v; }
  }
  function fieldsOf(layers) {
    var out = [];
    (layers || []).forEach(function (L, li) {
      (L.clips || []).forEach(function (c, ci) {
        if (c.text) out.push({ key: "L" + li + "C" + ci, label: String(c.label || String(c.text.content || "").split("\n")[0] || "Text " + (out.length + 1)).slice(0, 60),
                               layer: li, clip: ci, value: String(c.text.content || "") });
        if (c.expose) EXPOSE.forEach(function (p) {            // 2.511.0: 📋 exposed properties
          if (c.expose[p] == null || (p === "color" && !c.text)) return;
          out.push({ key: "L" + li + "C" + ci + ":" + p, label: String(c.expose[p]).slice(0, 60), layer: li, clip: ci, prop: p, type: p === "color" ? "color" : "num", value: exposedValue(c, p) });
        });
      });
    });
    return out;
  }
  function clean(tpl) {
    var t = tpl || {};
    var layers = (Array.isArray(t.layers) ? t.layers : []).slice(0, MAX_LAYERS).map(function (L) {
      return { name: String(L.name || "").slice(0, 40), text: !!L.text, opacity: Math.max(0, Math.min(1, num(L.opacity, 1))),
               clips: (Array.isArray(L.clips) ? L.clips : []).slice(0, MAX_CLIPS).map(function (c) {
                 var o = cleanClip(c);
                 if (c.label && o.text) o.label = String(c.label).slice(0, 60);
                 return o;
               }).filter(function (c) { return c.text || c.name; }) };
    }).filter(function (L) { return L.clips.length; });
    var len = 0;
    layers.forEach(function (L) { L.clips.forEach(function (c) { len = Math.max(len, c.start + c.len); }); });
    var out = { version: 1, name: String(t.name || "Template").slice(0, 60), w: Math.max(16, Math.round(num(t.w, 1920))), h: Math.max(16, Math.round(num(t.h, 1080))),
                len: +len.toFixed(3), layers: layers };
    if (t.description) out.description = String(t.description).slice(0, 200);
    out.fields = fieldsOf(layers).map(function (f) { delete f.value; return f; });
    // a label given for a field (by key) wins
    var given = {};
    (Array.isArray(t.fields) ? t.fields : []).forEach(function (f) { if (f && f.key && f.label) given[f.key] = String(f.label).slice(0, 60); });
    out.fields.forEach(function (f) { if (given[f.key]) f.label = given[f.key]; });
    return out;
  }
  function fields(tpl) {
    var f = fieldsOf((tpl && tpl.layers) || []), lab = {};
    ((tpl && tpl.fields) || []).forEach(function (x) { if (x && x.key) lab[x.key] = x.label; });
    f.forEach(function (x) { if (lab[x.key]) x.label = lab[x.key]; });
    return f;
  }
  function capture(layers, opts) {
    var o = opts || {}, t0 = Infinity;
    var Ls = (layers || []).filter(function (L) { return L && (L.clips || []).some(function (c) { return !c.adjust && (c.text || c.name); }); });
    Ls.forEach(function (L) { L.clips.forEach(function (c) { if (!c.adjust) t0 = Math.min(t0, num(c.start, 0)); }); });
    if (!Ls.length || !isFinite(t0)) throw err("pick the picture / text layers to keep (the template has nothing in it)");
    var labels = o.labels || {};
    var raw = Ls.map(function (L, li) {
      return { name: L.name, text: !!L.text, opacity: L.opacity == null ? 1 : +L.opacity,
               clips: L.clips.filter(function (c) { return !c.adjust && (c.text || c.name); }).map(function (c, ci) {
                 var x = cleanClip(c); x.start = +(num(c.start, 0) - t0).toFixed(4);
                 if (x.text && labels["L" + li + "C" + ci]) x.label = labels["L" + li + "C" + ci];
                 return x;
               }) };
    });
    return clean({ name: o.name, w: o.w, h: o.h, layers: raw, description: o.description });
  }
  /** keyframes on a new picture size: positions x k; a picture's keyframed scale x ks (none for a text - its size is) */
  function scaleKf(kf, k, ks) {
    if (!Array.isArray(kf)) return kf;
    return kf.map(function (p) {
      var q = copy(p);
      if (q.x != null) q.x = Math.round(num(q.x, 0) * k);
      if (q.y != null) q.y = Math.round(num(q.y, 0) * k);
      if (ks != null && q.scale != null) q.scale = +(num(q.scale, 1) * ks).toFixed(4);
      return q;
    });
  }
  function instantiate(tpl, o) {
    o = o || {};
    var T = clean(tpl), at = Math.max(0, num(o.at, 0));
    var k = Math.min(num(o.w, T.w) / T.w, num(o.h, T.h) / T.h);
    if (!isFinite(k) || k <= 0) k = 1;
    var values = o.values || {}, n = 0;
    var newId = typeof o.newId === "function" ? o.newId : function () { n++; return "t" + Date.now().toString(36) + n; };
    return T.layers.map(function (L, li) {
      return { name: L.name, text: L.text, opacity: L.opacity, clips: L.clips.map(function (c0, ci) {
        var c = copy(c0), key = "L" + li + "C" + ci;
        delete c.label;
        if (c.expose) Object.keys(c.expose).forEach(function (p) { if (values[key + ":" + p] != null) applyExposed(c, p, values[key + ":" + p]); });   // 2.511.0
        c.start = +(at + c.start).toFixed(4);
        var tf = c.tf || { x: 0, y: 0, scale: 1, rot: 0 };
        c.tf = { x: Math.round(num(tf.x, 0) * k), y: Math.round(num(tf.y, 0) * k), scale: num(tf.scale, 1), rot: num(tf.rot, 0) };
        if (c.text) {
          if (values[key] != null) c.text.content = String(values[key]);
          c.text.size = Math.max(4, Math.round(num(c.text.size, 48) * k));
          if (c.text.strokeW != null) c.text.strokeW = Math.max(0, Math.round(num(c.text.strokeW, 0) * k));
          c.tid = newId();
          c.name = "text_" + c.tid + ".png";
          c.kf = scaleKf(c.kf, k, null);
        } else {
          // the canvas draws a picture at its own size but never wider than the picture (canvas.js box) - with its
          // size known (nat, lib/mogrt.js) the scale keeps the DESIGNED width: min(nat, tw) on the template's picture
          var kp = k;
          if (c.nat && c.nat.w > 0) kp = k * Math.min(c.nat.w, T.w) / Math.min(c.nat.w, num(o.w, T.w));
          c.tf.scale = +(c.tf.scale * kp).toFixed(4);
          c.kf = scaleKf(c.kf, k, kp);
          delete c.nat;
        }
        if (!c.kf) delete c.kf;
        return c;
      }) };
    });
  }
  /** the picture files a template needs (its non-text clips) */
  function assets(tpl) {
    var s = {};
    ((tpl && tpl.layers) || []).forEach(function (L) { (L.clips || []).forEach(function (c) { if (!c.text && c.name) s[base(c.name)] = 1; }); });
    return Object.keys(s);
  }
  return { capture: capture, instantiate: instantiate, fields: fields, clean: clean, assets: assets, MAX_LAYERS: MAX_LAYERS, EXPOSE: EXPOSE, applyExposed: applyExposed };
});
