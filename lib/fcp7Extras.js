// bitGen Studio — lib/fcp7Extras.js (2.414.0): what the Final Cut Pro 7 XML (lib/interchange.js) carries beyond the cut.
//
// Tim: "lets do the medium jobs now" (Premiere's XML round trip: keyframes, moves, the grade, captions).
//
// WRITTEN (and read back by bitGen's importer):
//   moves      Basic Motion (effectid "basic"): scale (% - 100 = the clip fitted to the frame, bitGen's 1), rotation
//              (degrees clockwise) and center (horiz / vert: the offset from the frame's centre as a fraction of the
//              frame's width / height - the frame's left edge is -0.5), each with its <keyframe>s when keyed (◆ kf)
//   opacity    Opacity with keyframes (%)          volume   Audio Levels with keyframes (linear gain)
//              keyframe <when> = the clip's <in> + frames into the clip (the clip's own media frames, as Premiere writes)
//   the grade  other editors cannot apply bitGen's grade, so each graded clip's whole look (the LUT under it + the grade)
//              is BAKED into a .cube (FX.buildLut - the very table the compile uses) written beside the XML
//              (exports/<name>_luts/<clip>.cube) and named in the clip's comment - Premiere: Lumetri → Basic → Input
//              LUT; Resolve: the node's LUT. The clip's bitGen effects ride in a comment as a record bitGen reads back
//              exactly (grade, LUT, effects, clean-up, a speed ramp).
//   captions   the 💬 caption cues as a TEXT generator track on top (FCP 7 "Text" generators - Premiere and Resolve
//              read them as titles); a track of only text generators is read back as the captions.
// Not exact: eases (FCP 7's keyframes are linear here; a hold becomes two keys a frame apart), 3D layers.
"use strict";
const FX = require("../static/clipfx.js");
const KF = require("../static/keyframes.js");

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r4 = (v) => +(+v).toFixed(4);
const kfOf = (c) => (c && Array.isArray(c.kf) ? c.kf : []);

/* ---------------- writing */
/** keyframe times (seconds into the clip) for a set of properties, holds expanded to a key one frame before the next */
function keyTimes(kf, props, fps) {
  const ks = kf.filter((k) => k && Number.isFinite(+k.at) && props.some((p) => k[p] != null)).sort((a, b) => a.at - b.at);
  const out = [];
  ks.forEach((k, i) => {
    out.push(+k.at);
    if (k.ease === "hold" && ks[i + 1]) out.push(Math.max(+k.at, +ks[i + 1].at - 1 / fps));
  });
  return out.filter((t, i, a) => i === 0 || Math.abs(t - a[i - 1]) > 1e-6);
}
function param(id, name, min, max, value, keys) {
  return `<parameter authoringApp="PremierePro"><parameterid>${id}</parameterid><name>${name}</name>`
    + (min != null ? `<valuemin>${min}</valuemin><valuemax>${max}</valuemax>` : "") + `<value>${value}</value>`
    + (keys || []).map((k) => `<keyframe><when>${k.when}</when><value>${k.value}</value></keyframe>`).join("") + "</parameter>";
}
const effect = (name, id, cat, type, media, params) =>
  `<filter><effect><name>${name}</name><effectid>${id}</effectid><effectcategory>${cat}</effectcategory><effecttype>${type}</effecttype><mediatype>${media}</mediatype>${params}</effect></filter>`;

/** Basic Motion for a picture clip (static tf and/or ◆ keys); "" when it sits as placed */
function motionXml(c, o) {
  const fps = o.fps, W = o.w, H = o.h, inF = o.inF, F = o.F;
  const tf = (c && c.tf) || {}, kf = kfOf(c);
  const b = { x: +tf.x || 0, y: +tf.y || 0, scale: tf.scale == null ? 1 : +tf.scale, rot: +tf.rot || 0 };
  const val = (p, at) => +KF.value(kf, at, p, b[p]);
  const moved = Math.abs(b.x) > 0.01 || Math.abs(b.y) > 0.01 || Math.abs(b.scale - 1) > 1e-4 || Math.abs(b.rot) > 1e-4 || ["x", "y", "scale", "rot"].some((p) => KF.has(kf, p));
  if (!moved) return "";
  const keys = (props, fmt) => KF.has(kf, props[0]) || (props[1] && KF.has(kf, props[1]))
    ? keyTimes(kf, props, fps).map((t) => ({ when: inF + F(t), value: fmt(t) })) : null;
  const t0 = 0;
  const sc = (t) => r4(val("scale", t) * 100), ro = (t) => r4(val("rot", t));
  const r6 = (v) => +(+v).toFixed(6);
  const ce = (t) => `<horiz>${r6(val("x", t) / W)}</horiz><vert>${r6(val("y", t) / H)}</vert>`;
  return effect("Basic Motion", "basic", "motion", "motion", "video",
    param("scale", "Scale", 0, 1000, sc(t0), keys(["scale"], sc))
    + param("rotation", "Rotation", -8640, 8640, ro(t0), keys(["rot"], ro))
    + param("center", "Center", null, null, ce(t0), keys(["x", "y"], ce))
    + param("centerOffset", "Offset", null, null, "<horiz>0</horiz><vert>0</vert>", null));
}
/** Opacity (static or ◆ keyed), "" at a plain 100 % */
function opacityXml(c, opacity, o) {
  const kf = kfOf(c), F = o.F;
  if (!KF.has(kf, "op") && opacity >= 0.999) return "";
  const v = (t) => r4(Math.max(0, Math.min(1, +KF.value(kf, t, "op", opacity))) * 100);
  const keys = KF.has(kf, "op") ? keyTimes(kf, ["op"], o.fps).map((t) => ({ when: o.inF + F(t), value: v(t) })) : null;
  return effect("Opacity", "opacity", "motion", "motion", "video", param("opacity", "opacity", 0, 100, v(0), keys));
}
/** Audio Levels (static or ◆ keyed volume); "" at unity */
function levelsXml(c, volume, o) {
  const kf = kfOf(c), F = o.F, lv = (c && c.volume != null ? +c.volume : 1);
  const scale = lv > 1e-6 ? volume / lv : 1;          // the layer's level times the clip's (keys hold the clip's)
  if (!KF.has(kf, "vol") && Math.abs(volume - 1) <= 1e-3) return "";
  const v = (t) => r4(Math.max(0, Math.min(3.98109, +KF.value(kf, t, "vol", lv) * scale)));
  const keys = KF.has(kf, "vol") ? keyTimes(kf, ["vol"], o.fps).map((t) => ({ when: o.inF + F(t), value: v(t) })) : null;
  return effect("Audio Levels", "audiolevels", "audiolevels", "audiolevels", "audio", param("level", "Level", 0, 3.98109, v(0), keys));
}
/** what of the clip's effects other editors cannot read: kept as a record (base64 JSON) for bitGen */
function fxRecord(c) {
  const fx = FX.normalize(c && c.fx);
  if (!fx) return null;
  const keep = Object.assign({}, fx);
  if (!keep.ramp) { delete keep.speed; delete keep.reverse; }       // a plain speed / reverse is the Time Remap's
  return Object.keys(keep).length ? keep : null;
}
function gradeWords(fx) {
  const g = (fx && fx.grade) || {}, w = [];
  Object.keys(g).forEach((k) => { if (typeof g[k] === "number") w.push(k + " " + (g[k] > 0 ? "+" : "") + g[k]); else w.push(k); });
  if (fx && fx.lut) w.push("LUT " + fx.lut + (fx.lut_mix != null && fx.lut_mix < 1 ? " " + Math.round(fx.lut_mix * 100) + " %" : ""));
  return w.join(", ");
}
/** the clip's comments: the grade in words + its baked .cube; the bitGen record. o.lut(c, fx) -> the .cube's file name */
function commentsXml(c, o) {
  const rec = fxRecord(c);
  if (!rec) return "";
  const fx = FX.normalize(c.fx);
  let words = "";
  if (FX.graded(fx)) {
    const f = o.lut ? o.lut(c, fx) : null;
    words = "bitGen grade: " + gradeWords(fx) + (f ? " - baked as " + f + " (apply it as the clip's input LUT)" : "");
  }
  const b64 = Buffer.from(JSON.stringify(rec), "utf8").toString("base64");
  return `<comments><mastercomment1>${esc(words)}</mastercomment1><mastercomment4>bitgen:${b64}</mastercomment4></comments>`;
}
/** the caption cues as one track of Text generators */
function captionsTrack(cues, o) {
  const F = o.F;
  let n = 0;
  const items = (cues || []).filter((q) => q && q.text && q.end > q.start).map((q) => {
    const st = F(q.start), en = Math.max(st + 1, F(q.end)), d = en - st;
    return `<generatoritem id="caption-${++n}"><name>${esc(String(q.text).slice(0, 40))}</name><duration>${d}</duration>${o.R}<start>${st}</start><end>${en}</end><in>0</in><out>${d}</out><enabled>TRUE</enabled><anamorphic>FALSE</anamorphic><alphatype>black</alphatype>`
      + `<effect><name>Text</name><effectid>Text</effectid><effectcategory>Text</effectcategory><effecttype>generator</effecttype><mediatype>video</mediatype>`
      + `<parameter><parameterid>str</parameterid><name>Text</name><value>${esc(q.text)}</value></parameter>`
      + `<parameter><parameterid>origin</parameterid><name>Origin</name><value><horiz>0</horiz><vert>0.4</vert></value></parameter>`
      + `<parameter><parameterid>fontsize</parameterid><name>Size</name><valuemin>0</valuemin><valuemax>1000</valuemax><value>${Math.round(o.h * 0.055)}</value></parameter>`
      + `</effect><labels><label2>bitGen caption</label2></labels></generatoritem>`;
  });
  return items.length ? `<track>${items.join("")}<enabled>TRUE</enabled><locked>FALSE</locked></track>` : "";
}

/* ---------------- reading (el = the tiny parser's nodes from lib/interchange.js) */
const kid = (el, tag) => (el && el.kids.find((k) => k.tag === tag)) || null;
const kids = (el, tag) => (el ? el.kids.filter((k) => k.tag === tag) : []);
const txt = (el, tag) => { const k = kid(el, tag); return k ? k.text.trim() : ""; };
function paramOf(eff, id) { return kids(eff, "parameter").find((x) => txt(x, "parameterid") === id) || null; }
function pt(v) { return v ? { h: +txt(v, "horiz") || 0, v: +txt(v, "vert") || 0 } : null; }
/** a parameter's keys: [{when, value (number or {h, v})}] */
function keysOf(p, point) {
  return kids(p, "keyframe").map((k) => ({ when: +txt(k, "when"), value: point ? pt(kid(k, "value")) : +txt(k, "value") }))
    .filter((k) => Number.isFinite(k.when) && (point ? !!k.value : Number.isFinite(k.value)));
}
/** read one clipitem's extras into the page's clip c (o: {fps, w, h, inF (the clip's <in>), audio}) */
function readClip(ci, c, o) {
  const S = (f) => +o.S(f - o.inF).toFixed(4);
  const keyAt = {};
  const put = (at, k, v) => { const t = Math.max(0, at); const id = t.toFixed(4); keyAt[id] = keyAt[id] || { at: t }; keyAt[id][k] = v; };
  for (const eff of kids(ci, "filter").map((x) => kid(x, "effect")).filter(Boolean)) {
    const id = txt(eff, "effectid");
    if (id === "basic" && !o.audio) {
      const sc = paramOf(eff, "scale"), ro = paramOf(eff, "rotation"), ce = paramOf(eff, "center");
      const tf = { x: 0, y: 0, scale: 1, rot: 0 };
      if (sc) { const v = +txt(sc, "value"); if (Number.isFinite(v)) tf.scale = r4(Math.max(1, v) / 100); keysOf(sc).forEach((k) => put(S(k.when), "scale", r4(Math.max(0.01, k.value / 100)))); }
      if (ro) { const v = +txt(ro, "value"); if (Number.isFinite(v)) tf.rot = r4(v); keysOf(ro).forEach((k) => put(S(k.when), "rot", r4(k.value))); }
      if (ce) { const p = pt(kid(ce, "value")); if (p) { tf.x = Math.round(p.h * o.w * 100) / 100; tf.y = Math.round(p.v * o.h * 100) / 100; }
        keysOf(ce, true).forEach((k) => { put(S(k.when), "x", Math.round(k.value.h * o.w * 100) / 100); put(S(k.when), "y", Math.round(k.value.v * o.h * 100) / 100); }); }
      if (Math.abs(tf.x) > 0.01 || Math.abs(tf.y) > 0.01 || Math.abs(tf.scale - 1) > 1e-4 || Math.abs(tf.rot) > 1e-4) c.tf = tf;
    } else if (id === "opacity" && !o.audio) {
      const p = paramOf(eff, "opacity"); if (p) keysOf(p).forEach((k) => put(S(k.when), "op", r4(Math.max(0, Math.min(1, k.value / 100)))));
    } else if (id === "audiolevels" && o.audio) {
      const p = paramOf(eff, "level"); if (p) keysOf(p).forEach((k) => put(S(k.when), "vol", r4(Math.max(0, Math.min(1.5, k.value)))));
    }
  }
  const kf = Object.keys(keyAt).map((k) => keyAt[k]).sort((a, b) => a.at - b.at);
  if (kf.length) c.kf = kf;
  if (kf.some((k) => k.op != null)) c.opacity = 1;           // keyed: the keys are the opacity (the static value was the first key)
  if (kf.some((k) => k.vol != null)) c.volume = 1;
  // the bitGen record
  const cm = kid(ci, "comments");
  const m = cm ? /bitgen:([A-Za-z0-9+/=]+)/.exec(cm.kids.map((k) => k.text).join(" ")) : null;
  if (m) {
    try {
      const rec = JSON.parse(Buffer.from(m[1], "base64").toString("utf8"));
      const cur = c.fx || {};
      const keepSpeed = rec.ramp && cur.speed ? Math.abs(FX.timelineLen(1, FX.normalize({ ramp: rec.ramp })) - 1 / cur.speed) < 0.05 : false;
      const merged = Object.assign({}, rec, cur.reverse != null ? { reverse: cur.reverse } : {});
      if (rec.ramp && !keepSpeed) delete merged.ramp;
      if (merged.ramp) delete merged.speed; else if (cur.speed) merged.speed = cur.speed;
      c.fx = FX.normalize(merged) || undefined;
      return true;
    } catch { /* a damaged record: the clip as read */ }
  }
  return false;
}
/** a track of Text generators -> caption cues (null when the track is something else) */
function readCaptions(track, S) {
  const gens = kids(track, "generatoritem"), clips = kids(track, "clipitem");
  if (!gens.length || clips.length) return null;
  const cues = [];
  for (const g of gens) {
    const eff = kid(g, "effect");
    if (!eff || !/text/i.test(txt(eff, "effectid") + " " + txt(eff, "name"))) return null;
    const p = paramOf(eff, "str");
    const st = +txt(g, "start"), en = +txt(g, "end");
    if (p && txt(p, "value") && en > st && st >= 0) cues.push({ start: r4(S(st)), end: r4(S(en)), text: txt(p, "value") });
  }
  return cues.length ? cues : null;
}

module.exports = { motionXml, opacityXml, levelsXml, commentsXml, captionsTrack, fxRecord, gradeWords, readClip, readCaptions, keyTimes };
