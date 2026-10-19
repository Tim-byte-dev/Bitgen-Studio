// bitGen Studio — lib/fcpxml.js (2.414.0): FINAL CUT PRO X - the timeline out as FCPXML 1.10 and back in.
//
// Tim: "lets do the medium jobs now" (FCPXML was the Premiere-gap row "Final Cut Pro X").
//
//   toFcpx(tl, o)     FCPXML 1.10: one format, an asset per file (stills as <video>), a library > event > project >
//                     sequence. V1 is the PRIMARY STORYLINE (gaps where nothing plays); every other video layer is a
//                     connected lane above it (1, 2, ...), every sound layer a lane below (-1, -2, ...); each connected
//                     clip hangs on the storyline item under its start (FCP X's model), in that item's own time.
//                     Speed / reverse as a timeMap; position / scale / rotation as adjust-transform (FCP X units: the
//                     frame's height = 100, y up, rotation counter-clockwise) with ◆ keyframes; opacity adjust-blend,
//                     volume adjust-volume (dB) with keyframes; markers; the 💬 captions as <caption>s (iTT); the start
//                     timecode (tcStart, DF / NDF). The grade: a <note> naming the .cube the route bakes beside the
//                     file (Final Cut: Effects → Custom LUT) + bitGen's own record of the clip's effects.
//   fromFcpx(text, o) the basics back: the primary storyline -> V1, connected lanes -> layers / sound layers, trims,
//                     speed (timeMap), opacity, volume, position / scale / rotation (+ keys), markers, captions,
//                     bitGen's record; compound clips and titles are listed in the notes as left out.
// o = like lib/interchange.js: {fps, tc, w, h, name, abs(x), find(name, kind), lut(c, fx)}
"use strict";
const path = require("path");
const TC = require("../static/timecode.js");
const FX = require("../static/clipfx.js");
const MK = require("../static/tlmarks.js");
const KF = require("../static/keyframes.js");
const ix = require("./interchange");
const X7 = require("./fcp7Extras");

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r4 = (v) => +(+v).toFixed(4);
function fileUrl(p) { return "file://" + String(p).replace(/\\/g, "/").replace(/^([A-Za-z]:)/, "/$1").split("/").map((x, i) => (i === 1 && /^[A-Za-z]:$/.test(x) ? x : encodeURIComponent(x))).join("/"); }

/** rational FCPXML time for a frame count at fps ("0s", "100/25s", "1001/30000s") */
function rt(frames, fps) {
  const b = TC.base(fps), f = Math.round(frames);
  if (!f) return "0s";
  if (b.ntsc) return `${f * 1001}/${b.tb * 1000}s`;
  return f % b.tb === 0 ? `${f / b.tb}s` : `${f}/${b.tb}s`;
}
/** "a/bs" | "Ns" -> seconds */
function secsOf(v) {
  const m = /^\s*(-?\d+(?:\.\d+)?)(?:\/(\d+))?s\s*$/.exec(String(v || ""));
  if (!m) return 0;
  return m[2] ? +m[1] / +m[2] : +m[1];
}

/* ---------------- writing */
function toFcpx(tl, o) {
  o = o || {};
  const fps = o.fps || 25, F = (s) => TC.frames(s, fps), T = (f) => rt(f, fps), W = o.w || 1920, H = o.h || 1080;
  const it = ix.items(tl), name = o.name || "bitGen timeline", b = TC.base(fps);
  const drop = TC.isDrop(o.tc, fps), tcf = o.tc && o.tc.start ? TC.parse(o.tc.start, fps, drop) || 0 : 0;
  const res = [`<format id="r1" frameDuration="${b.ntsc ? `1001/${b.tb * 1000}s` : `1/${b.tb}s`}" width="${W}" height="${H}" colorSpace="1-1-1 (Rec. 709)"/>`];
  const assets = new Map(); let rid = 1;
  const asset = (x) => {
    const key = x.kind + ":" + x.name;
    if (assets.has(key)) return assets.get(key);
    const id = "r" + (++rid + 1); assets.set(key, id);
    const p = o.abs ? o.abs(x) : x.name, still = x.kind === "image", aud = x.kind === "audio";
    const d = still ? "0s" : T(F(x.dur != null ? x.dur : x.out));
    res.push(`<asset id="${id}" name="${esc(x.name.replace(/\.[^.]+$/, ""))}" start="0s" duration="${d}"`
      + (aud ? ` hasAudio="1" audioSources="1" audioChannels="2" audioRate="48000"` : ` hasVideo="1" format="r1"` + (still ? "" : ` hasAudio="1" audioSources="1" audioChannels="2" audioRate="48000"`))
      + `><media-rep kind="original-media" src="${esc(fileUrl(p))}"/></asset>`);
    return id;
  };
  let tsN = 0;
  const end = (() => { let e = 0; it.video.concat(it.audio).forEach((t) => t.items.forEach((x) => { e = Math.max(e, F(x.start) + Math.max(1, F(x.len))); }));
    const cq = tl.captions && tl.captions.visible !== false && Array.isArray(tl.captions.cues) ? tl.captions.cues : [];
    cq.forEach((q) => { e = Math.max(e, F(q.end)); }); return e; })();
  /** the adjust-* children of a clip (ls = the clip's local frame where it starts on the timeline) */
  const adjust = (x, ls, audio, muted) => {
    const c = x.clip || {}, kf = Array.isArray(c.kf) ? c.kf : [];
    const key = (props, fn) => X7.keyTimes(kf, props, fps).map((t) => `<keyframe time="${T(ls + F(t))}" value="${fn(t)}"/>`).join("");
    let s = "";
    if (!audio && x.kind !== "audio") {
      const tf = c.tf || {}, bb = { x: +tf.x || 0, y: +tf.y || 0, scale: tf.scale == null ? 1 : +tf.scale, rot: +tf.rot || 0 };
      const v = (p, t) => +KF.value(kf, t, p, bb[p]);
      const moved = Math.abs(bb.x) > 0.01 || Math.abs(bb.y) > 0.01 || Math.abs(bb.scale - 1) > 1e-4 || Math.abs(bb.rot) > 1e-4 || ["x", "y", "scale", "rot"].some((p) => KF.has(kf, p));
      if (moved) {
        const pos = (t) => `${r4(v("x", t) / H * 100)} ${r4(-v("y", t) / H * 100)}`, sc = (t) => `${r4(v("scale", t))} ${r4(v("scale", t))}`, ro = (t) => `${r4(-v("rot", t))}`;
        s += `<adjust-transform position="${pos(0)}" scale="${sc(0)}" rotation="${ro(0)}">`
          + (KF.has(kf, "x") || KF.has(kf, "y") ? `<param name="position"><keyframeAnimation>${key(["x", "y"], pos)}</keyframeAnimation></param>` : "")
          + (KF.has(kf, "scale") ? `<param name="scale"><keyframeAnimation>${key(["scale"], sc)}</keyframeAnimation></param>` : "")
          + (KF.has(kf, "rot") ? `<param name="rotation"><keyframeAnimation>${key(["rot"], ro)}</keyframeAnimation></param>` : "")
          + "</adjust-transform>";
      }
      const op = (t) => r4(Math.max(0, Math.min(1, +KF.value(kf, t, "op", x.opacity))));
      if (KF.has(kf, "op") || x.opacity < 0.999)
        s += `<adjust-blend amount="${op(0)}">` + (KF.has(kf, "op") ? `<param name="amount"><keyframeAnimation>${key(["op"], op)}</keyframeAnimation></param>` : "") + "</adjust-blend>";
    }
    if (x.kind !== "image") {
      const lv = c.volume != null ? +c.volume : 1, k = lv > 1e-6 ? x.volume / lv : 1;
      const db = (t) => { const g = +KF.value(kf, t, "vol", lv) * k; return (g <= 1e-5 ? -96 : r4(20 * Math.log10(g))) + "dB"; };
      if (muted) s += `<adjust-volume amount="-96dB"/>`;
      else if (KF.has(kf, "vol") || Math.abs(x.volume - 1) > 1e-3)
        s += `<adjust-volume amount="${db(0)}">` + (KF.has(kf, "vol") ? `<param name="amount"><keyframeAnimation>${key(["vol"], db)}</keyframeAnimation></param>` : "") + "</adjust-volume>";
    }
    return s;
  };
  const retimed = (x) => Math.abs(x.speed - 1) > 1e-4 || x.reverse;
  const timeMap = (x) => {
    const a = F(x.in), z = F(x.out), L = Math.max(1, F(x.len));
    return `<timeMap><timept time="0s" value="${T(x.reverse ? z : a)}" interp="linear"/><timept time="${T(L)}" value="${T(x.reverse ? a : z)}" interp="linear"/></timeMap>`;
  };
  const note = (x) => {
    const rec = x.clip ? X7.fxRecord(x.clip) : null;
    if (!rec) return "";
    const fx = FX.normalize(x.clip.fx);
    const lut = FX.graded(fx) && o.lut ? o.lut(x.clip, fx) : null;
    return `<note>${esc((FX.graded(fx) ? "bitGen grade: " + X7.gradeWords(fx) + (lut ? " - baked as " + lut + " (Effects → Custom LUT)" : "") + " · " : "")
      + "bitgen:" + Buffer.from(JSON.stringify(rec), "utf8").toString("base64"))}</note>`;
  };
  /** one clip element; lane = null on the storyline. off = its offset in the parent's time */
  const clipEl = (x, lane, off, inner, marks) => {
    const L = Math.max(1, F(x.len)), ls = retimed(x) ? 0 : F(x.in);
    const la = lane != null ? ` lane="${lane}"` : "";
    if (x.kind === "image")
      return `<video ref="${asset(x)}"${la} offset="${T(off)}" name="${esc(x.name)}" start="0s" duration="${T(L)}">${note(x)}${adjust(x, 0, false)}${inner || ""}${marks || ""}</video>`;
    const muted = x.kind !== "audio" && x.clip && x.clip.soundOut;
    const mk = (x.clip && !retimed(x) ? MK.clipMarks(x.clip) : []).filter((m) => m.t >= x.in - 1e-6 && m.t <= x.out + 1e-6)
      .map((m) => `<marker start="${T(F(m.t))}" duration="${T(m.d ? Math.max(1, F(m.d)) : 1)}" value="${esc(m.name || "marker")}"${m.note ? ` note="${esc(m.note)}"` : ""}/>`).join("");
    return `<asset-clip ref="${asset(x)}"${la} offset="${T(off)}" name="${esc(x.name)}" start="${T(ls)}" duration="${T(L)}"${x.kind === "audio" ? ' audioRole="music"' : ""}>`
      + note(x) + (retimed(x) ? timeMap(x) : "") + adjust(x, ls, false, muted) + (inner || "") + mk + (marks || "") + "</asset-clip>";
  };
  // the storyline: V1 in order, gaps between, a gap to the end so every connected clip has something under it
  const v1 = it.video.find((t) => t.v1);
  const spine = [];
  let cur = 0;
  const spill = [];
  (v1 ? v1.items : []).slice().sort((a, c) => a.start - c.start).forEach((x) => {
    const st = F(x.start), L = Math.max(1, F(x.len));
    if (st < cur) { spill.push(x); return; }                    // an overlap: rides as a connected clip instead
    if (st > cur) spine.push({ gap: true, off: cur, len: st - cur, ls: 0, kids: [], marks: [] });
    spine.push({ x, off: st, len: L, ls: retimed(x) ? 0 : F(x.in), kids: [], marks: [] });
    cur = st + L;
  });
  if (end > cur || !spine.length) spine.push({ gap: true, off: cur, len: Math.max(1, end - cur), ls: 0, kids: [], marks: [] });
  const under = (f) => spine.find((e) => f >= e.off && f < e.off + e.len) || spine[spine.length - 1];
  const hang = (f, xml) => { const e = under(f); e.kids.push({ f, xml: xml(e.ls + (f - e.off)) }); };
  // connected lanes: the other video layers above (1, 2, ...), sound layers below (-1, -2, ...)
  let lane = 0;
  if (spill.length) { lane++; const ln = lane; spill.forEach((x) => hang(F(x.start), (lo) => clipEl(x, ln, lo))); }
  it.video.filter((t) => !t.v1).forEach((t) => { lane++; const ln = lane; t.items.forEach((x) => hang(F(x.start), (lo) => clipEl(x, ln, lo))); });
  let alane = 0;
  it.audio.filter((t) => !t.linked).forEach((t) => { alane--; const ln = alane; t.items.forEach((x) => hang(F(x.start), (lo) => clipEl(x, ln, lo))); });
  // captions (iTT) on the lane above everything
  const cq = tl.captions && tl.captions.visible !== false && Array.isArray(tl.captions.cues) ? tl.captions.cues : [];
  const capLane = lane + 1;
  cq.filter((q) => q && q.text && q.end > q.start).forEach((q) => {
    const st = F(q.start), d = Math.max(1, F(q.end) - st), id = "ts" + (++tsN);
    hang(st, (lo) => `<caption lane="${capLane}" offset="${T(lo)}" name="${esc(String(q.text).slice(0, 40))}" start="0s" duration="${T(d)}" role="iTT?captionFormat=ITT.en">`
      + `<text placement="bottom"><text-style ref="${id}">${esc(q.text)}</text-style></text>`
      + `<text-style-def id="${id}"><text-style font=".AppleSystemUIFont" fontSize="13" fontFace="Regular" fontColor="1 1 1 1" backgroundColor="0 0 0 1"/></text-style-def></caption>`);
  });
  // the sequence's markers on the storyline item under them
  MK.list(tl).forEach((m) => { const f = F(m.t), e = under(f);
    e.marks.push(`<marker start="${T(e.ls + (f - e.off))}" duration="${T(m.d ? Math.max(1, F(m.d)) : 1)}" value="${esc(m.name || "marker")}"${m.note ? ` note="${esc(m.note)}"` : ""}/>`); });
  const spineXml = spine.map((e) => {
    const inner = e.kids.sort((a, c) => a.f - c.f).map((k) => k.xml).join(""), marks = e.marks.join("");
    // the storyline's offsets run in the sequence's own time: they begin at its start timecode (tcStart)
    if (e.gap) return `<gap name="Gap" offset="${T(tcf + e.off)}" start="0s" duration="${T(e.len)}">${inner}${marks}</gap>`;
    return clipEl(e.x, null, tcf + e.off, inner, marks);
  }).join("");
  const seq = `<sequence format="r1" duration="${T(Math.max(end, 1))}" tcStart="${T(tcf)}" tcFormat="${drop ? "DF" : "NDF"}" audioLayout="stereo" audioRate="48k">`
    + `<spine>${spineXml}</spine></sequence>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.10"><resources>${res.join("")}</resources>`
    + `<library><event name="bitGen"><project name="${esc(name)}">${seq}</project></event></library></fcpxml>\n`;
}

/* ---------------- reading */
const kid = (el, tag) => (el && el.kids.find((k) => k.tag === tag)) || null;
const kids = (el, tag) => (el ? el.kids.filter((k) => k.tag === tag) : []);
function find(el, tag) { if (!el) return null; for (const k of el.kids) { if (k.tag === tag) return k; const f = find(k, tag); if (f) return f; } return null; }
const LDEF = () => ({ opacity: 1, volume: 1, visible: true, solo: false, muted: false,
  transitionIn: { type: "none", dur: 0.5 }, transitionOut: { type: "none", dur: 0.5 } });

function fromFcpx(text, o) {
  o = o || {};
  const root = ix.parseXml(text);
  const fx0 = find(root, "fcpxml");
  if (!fx0) throw Object.assign(new Error("no <fcpxml> in that file - is it a Final Cut Pro X export (File → Export XML)?"), { status: 400 });
  const resN = find(fx0, "resources"), seq = find(fx0, "sequence");
  if (!seq) throw Object.assign(new Error("no <sequence> in that FCPXML - export a PROJECT (not only an event or a library)"), { status: 400 });
  const formats = {}, assets = {}, notes = [];
  kids(resN, "format").forEach((f) => { formats[f.attrs.id] = f.attrs; });
  kids(resN, "asset").forEach((a) => { const mr = kid(a, "media-rep"); const src = mr ? mr.attrs.src : a.attrs.src;
    assets[a.attrs.id] = { name: path.basename(ix.urlPath(src || "")) || a.attrs.name, audio: a.attrs.hasAudio === "1" && a.attrs.hasVideo !== "1", dur: secsOf(a.attrs.duration) }; });
  const fmt = formats[seq.attrs.format] || {};
  const fd = secsOf(fmt.frameDuration || "1/25s") || 0.04;
  const fps = Math.abs(1 / fd - Math.round(1 / fd)) > 0.01 ? +((1 / fd)).toFixed(3) : Math.round(1 / fd);
  const W = +fmt.width || o.w || 1920, H = +fmt.height || o.h || 1080;
  const tcS = secsOf(seq.attrs.tcStart), drop = /^DF$/i.test(seq.attrs.tcFormat || "");
  const tl = { video: [], v1: Object.assign({ name: "V1" }, LDEF()), vlayers: [], audio: [], images: [], markers: { ff: null, lf: null, refs: [] }, sel: null, selLayer: null };
  const missing = new Set(), lanes = {}, seqMarks = [], cues = [];
  const S = (s) => +(+s).toFixed(4);
  const left = new Set();
  /** the clip's adjustments -> c (local time: ls = the clip's local start) */
  const readAdj = (el, c, ls) => {
    const kmap = {};
    const put = (t, k, v) => { const at = Math.max(0, S(t - ls)), id = at.toFixed(4); kmap[id] = kmap[id] || { at }; kmap[id][k] = v; };
    const anim = (a, pname) => { const p = kids(a, "param").find((x) => x.attrs.name === pname); return p ? kids(kid(p, "keyframeAnimation"), "keyframe") : []; };
    const tr = kid(el, "adjust-transform");
    if (tr) {
      const pos = String(tr.attrs.position || "0 0").split(/\s+/).map(Number), sc = String(tr.attrs.scale || "1 1").split(/\s+/).map(Number), rot = +tr.attrs.rotation || 0;
      const tf = { x: Math.round(pos[0] / 100 * H * 100) / 100, y: Math.round(-pos[1] / 100 * H * 100) / 100, scale: S(sc[0] || 1), rot: S(-rot) };
      if (Math.abs(tf.x) > 0.01 || Math.abs(tf.y) > 0.01 || Math.abs(tf.scale - 1) > 1e-4 || Math.abs(tf.rot) > 1e-4) c.tf = tf;
      anim(tr, "position").forEach((k) => { const p = String(k.attrs.value).split(/\s+/).map(Number); put(secsOf(k.attrs.time), "x", Math.round(p[0] / 100 * H * 100) / 100); put(secsOf(k.attrs.time), "y", Math.round(-p[1] / 100 * H * 100) / 100); });
      anim(tr, "scale").forEach((k) => put(secsOf(k.attrs.time), "scale", S(+String(k.attrs.value).split(/\s+/)[0] || 1)));
      anim(tr, "rotation").forEach((k) => put(secsOf(k.attrs.time), "rot", S(-(+k.attrs.value || 0))));
    }
    const bl = kid(el, "adjust-blend");
    if (bl) { if (bl.attrs.amount != null && !anim(bl, "amount").length) c.opacity = S(Math.max(0, Math.min(1, +bl.attrs.amount))); anim(bl, "amount").forEach((k) => put(secsOf(k.attrs.time), "op", S(Math.max(0, Math.min(1, +k.attrs.value))))); }
    const vo = kid(el, "adjust-volume");
    const g = (v) => { const d = parseFloat(String(v)); return d <= -95 ? 0 : S(Math.min(4, Math.pow(10, d / 20))); };
    if (vo) { if (vo.attrs.amount != null && !anim(vo, "amount").length) c.volume = g(vo.attrs.amount); anim(vo, "amount").forEach((k) => put(secsOf(k.attrs.time), "vol", Math.min(1.5, g(k.attrs.value)))); }
    const kf = Object.keys(kmap).map((k) => kmap[k]).sort((a, b) => a.at - b.at);
    if (kf.length) c.kf = kf;
    const nt = kid(el, "note"), m = nt ? /bitgen:([A-Za-z0-9+/=]+)/.exec(nt.text) : null;
    if (m) { try { const rec = JSON.parse(Buffer.from(m[1], "base64").toString("utf8")); const cur = c.fx || {};
      const merged = Object.assign({}, rec, cur.speed ? { speed: cur.speed } : {}, cur.reverse ? { reverse: true } : {});
      if (merged.ramp) delete merged.speed;
      c.fx = FX.normalize(merged) || undefined; } catch { /* the clip as read */ } }
  };
  /** a clip element -> {c, kind} or null; at = its timeline start (seconds) */
  const clipOf = (el, at, onSpine) => {
    let ref = el.attrs.ref, inner = el;
    if (el.tag === "clip") { const v = kids(el, "video")[0] || kids(el, "asset-clip")[0] || kids(el, "audio")[0]; if (!v) return null; ref = v.attrs.ref; inner = el; }
    const a = assets[ref];
    if (!a) { if (el.tag === "ref-clip") left.add("compound clips"); return null; }
    const still = el.tag === "video" && a.dur === 0;
    const kindWanted = a.audio ? "audio" : still ? "image" : "video";
    const hit = o.find ? o.find(a.name, kindWanted === "image" ? "video" : kindWanted) : { src: "video", kind: kindWanted };
    if (!hit) { missing.add(a.name); return null; }
    const len = secsOf(el.attrs.duration), st = secsOf(el.attrs.start);
    const c = { name: a.name, start: S(at), in: S(st), out: S(st + len), dur: a.dur > 0 ? S(Math.max(a.dur, st + len)) : S(st + len), opacity: 1, src: hit.src };
    const tm = kid(inner, "timeMap");
    if (tm) {
      const pts = kids(tm, "timept").map((p) => ({ t: secsOf(p.attrs.time), v: secsOf(p.attrs.value) }));
      if (pts.length >= 2) {
        const p0 = pts[0], p1 = pts[pts.length - 1], span = p1.v - p0.v, dt = p1.t - p0.t;
        const sp = dt > 1e-6 ? Math.abs(span) / dt : 1, rev = span < 0;
        // the local window [st, st+len] through the map
        const map = (t) => p0.v + (t - p0.t) * (span / (dt || 1));
        const a0 = map(st), a1 = map(st + len);
        c.in = S(Math.min(a0, a1)); c.out = S(Math.max(a0, a1));
        if (a.dur > 0) c.dur = S(Math.max(a.dur, c.out));
        if (Math.abs(sp - 1) > 1e-3 || rev) c.fx = FX.normalize({ speed: S(sp), reverse: rev }) || undefined;
      }
    }
    readAdj(inner, c, st);                                    // keyframe times are the clip's local time -> into the clip
    const mk = kids(inner, "marker").map((m) => MK.one({ t: S(secsOf(m.attrs.start)), d: secsOf(m.attrs.duration) > fd * 1.5 ? S(secsOf(m.attrs.duration)) : 0, name: m.attrs.value || "", note: m.attrs.note || "" })).filter(Boolean);
    if (mk.length && !tm && !onSpine) c.marks = mk;            // a storyline item's markers are the sequence's (read below)
    return { c, kind: kindWanted };
  };
  const place = (lane, kind, c) => {
    const k = (kind === "audio" ? "a" : kind === "image" ? "i" : "v") + ":" + lane;
    (lanes[k] = lanes[k] || { lane, kind, clips: [] }).clips.push(c);
  };
  const spine = find(seq, "spine");
  let base = null;
  for (const el of spine ? spine.kids : []) {
    const off = secsOf(el.attrs.offset);
    if (base === null) base = tcS > 0 && off >= tcS - 1e-6 ? tcS : 0;
    const at = off - base, ls = secsOf(el.attrs.start);
    if (["asset-clip", "clip", "video", "audio", "ref-clip", "sync-clip"].includes(el.tag)) {
      const r = el.tag === "sync-clip" ? (left.add("sync clips"), null) : clipOf(el, at, true);
      if (r) { if (r.kind === "video" && el.attrs.lane == null) tl.video.push(r.c); else place(0, r.kind, r.c); }
    } else if (el.tag === "title") left.add("titles");
    // what hangs on it
    for (const k of el.kids) {
      const lane = k.attrs.lane != null ? +k.attrs.lane : null;
      const kat = at + (secsOf(k.attrs.offset) - ls);
      if (k.tag === "marker") { seqMarks.push(MK.one({ t: S(at + secsOf(k.attrs.start) - ls), d: secsOf(k.attrs.duration) > fd * 1.5 ? S(secsOf(k.attrs.duration)) : 0, name: k.attrs.value || "", note: k.attrs.note || "" })); continue; }
      if (lane == null) continue;
      if (k.tag === "caption") {
        const tx = find(k, "text"), words = tx ? tx.kids.map((t) => t.text).join("").trim() || tx.text.trim() : "";
        if (words) cues.push({ start: S(kat), end: S(kat + secsOf(k.attrs.duration)), text: words });
        continue;
      }
      if (k.tag === "title") { left.add("titles"); continue; }
      if (!["asset-clip", "clip", "video", "audio", "ref-clip"].includes(k.tag)) continue;
      const r = clipOf(k, kat);
      if (r) place(lane, r.kind, r.c);
    }
  }
  Object.keys(lanes).map((k) => lanes[k]).sort((a, b) => a.lane - b.lane).forEach((L) => {
    L.clips.sort((a, b) => a.start - b.start);
    if (L.kind === "audio") tl.audio.unshift(Object.assign({ name: "A" + (tl.audio.length + 1), clips: L.clips.map(({ opacity, src, ...c }) => c) }, LDEF()));
    else if (L.kind === "image") tl.images.push(Object.assign({ name: "I" + (tl.images.length + 1), clips: L.clips.map((c) => Object.assign({ name: c.name, start: c.start, len: S(c.out - c.in || 3), opacity: c.opacity }, c.tf ? { tf: c.tf } : {}, c.kf ? { kf: c.kf } : {})) }, LDEF()));
    else tl.vlayers.push(Object.assign({ name: "V" + (tl.vlayers.length + 2), clips: L.clips }, LDEF()));
  });
  tl.audio.forEach((L, i) => { L.name = "A" + (i + 1); });
  if (!tl.video.length && tl.vlayers.length) { tl.video = tl.vlayers.shift().clips; notes.push("no clips on the primary storyline - the first connected lane became V1"); }
  if (cues.length) tl.captions = { cues: cues.sort((a, b) => a.start - b.start), burn: true, visible: true };
  if (seqMarks.filter(Boolean).length) tl.seqMarkers = seqMarks.filter(Boolean).sort((a, b) => a.t - b.t);
  if (tcS > 0) { const f = Math.round(tcS * TC.rate(fps)), dr = drop && TC.canDrop(fps); tl.tc = Object.assign({ start: TC.fmt(f, fps, dr), fps }, dr ? { drop: true } : {}); }
  if (left.size) notes.push("left out (bitGen has no such thing): " + [...left].join(", "));
  const pj = find(fx0, "project");
  return { tl, name: (pj && pj.attrs.name) || "imported", fps, missing: [...missing], notes };
}

module.exports = { toFcpx, fromFcpx, rt, secsOf };
