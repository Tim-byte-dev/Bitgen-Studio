// bitGen Studio — lib/interchange.js (2.407.0): the timeline OUT to other editors and IN from them.
//
// Tim: "can we do the pipelines, editing tools, colour and export now, keep track of what is left to do".
//
//   toFcpXml(tl, o)  Final Cut Pro 7 XML (xmeml 5) - what Premiere Pro, DaVinci Resolve, Avid (via its importer) and
//                    Final Cut (via XtoCC) open: every video layer a video track (V1 first, pictures / text as stills),
//                    V1's sound + every sound layer an audio track, speed / reverse as Time Remap, opacity, volume,
//                    the start timecode
//   toEdl(tl, o)     CMX3600 EDL - V1 (picture + its sound): the format holds one picture track; speed as M2 lines
//   toOtio(tl, o)    OpenTimelineIO JSON (Timeline.1) - every layer, gaps, LinearTimeWarp for the speed
//   fromFcpXml(text, o) / fromEdl(text, o)  -> {tl (the page's shape), name, fps, missing: [file names not in the
//                    project], notes}; media matched by FILE NAME in the project's video / output / sound / images
//
// o = {fps, tc: {start, fps}, w, h, name, abs(c, kind) -> the file's absolute path, find(name) -> {src, kind} | null}
// Not carried (said in docs/PREMIERE-GAP.md): 3D layers (their baked webm would be needed); ramps go to other editors as
// their average speed (bitGen reads its own ramp back from the clip's record).
// 2.414.0: the XML also carries Basic Motion (position / scale / rotation) + opacity + level KEYFRAMES, the GRADE (baked
// into a .cube per graded clip, named in its comment, + a record bitGen reads back) and the CAPTIONS (a track of Text
// generators) - lib/fcp7Extras.js. toFcpXmlX (lib/fcpxml.js) writes Final Cut Pro X's FCPXML 1.10.
// 2.410.0: the timeline's MARKERS (tl.seqMarkers - static/tlmarks.js) ride along: FCP XML <marker> on the sequence,
// EDL "* LOC: <tc> <COLOUR> <name>" lines, OTIO Marker.2 on the stack; the XML / EDL readers bring them back.
"use strict";
const path = require("path");
const TC = require("../static/timecode.js");
const FX = require("../static/clipfx.js");
const MK = require("../static/tlmarks.js");
const X7 = require("./fcp7Extras");                       // 2.414.0: moves, keyframes, the grade, captions

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const IMG = /\.(png|jpe?g|webp|bmp|gif|tiff?|jxl)$/i;
const AUD = /\.(wav|mp3|m4a|aac|flac|ogg|opus)$/i;
function rateXml(fps) { const b = TC.base(fps); return `<rate><timebase>${b.tb}</timebase><ntsc>${b.ntsc ? "TRUE" : "FALSE"}</ntsc></rate>`; }
function fileUrl(p) {
  let s = String(p).replace(/\\/g, "/");
  if (!s.startsWith("/")) s = "/" + s;                     // C:/x -> /C:/x
  return "file://localhost" + s.split("/").map((x, i) => (i === 1 && /^[A-Za-z]:$/.test(x) ? x : encodeURIComponent(x))).join("/");
}
function urlPath(u) {
  let s = String(u || "").replace(/^file:\/\/(localhost)?/i, "");
  try { s = decodeURIComponent(s); } catch { /* as is */ }
  if (/^\/[A-Za-z]:\//.test(s)) s = s.slice(1);
  return s;
}

/* ---------------- the timeline as plain items (shared by the three writers) */
function srcLen(c) { const i0 = +c.in || 0, o0 = c.out != null ? +c.out : (c.dur != null ? +c.dur : null); return o0 == null ? null : Math.max(0, o0 - i0); }
function items(tl) {
  const out = { video: [], audio: [] };
  const live = (L) => L && L.visible !== false;
  const media = (c, kind) => {
    const fx = FX.normalize(c.fx) || null, L = srcLen(c);
    if (L == null) return null;
    const len = fx && FX.retimed(fx) ? FX.timelineLen(L, fx) : L;
    const speed = len > 1e-6 ? L / len : 1;
    return { name: path.basename(String(c.name)), src: c.src, kind, start: +c.start || 0, len, in: +c.in || 0, out: (+c.in || 0) + L,
             dur: c.dur != null ? +c.dur : null, speed, reverse: !!(fx && fx.reverse), ramp: !!(fx && fx.ramp),
             opacity: c.opacity == null ? 1 : +c.opacity, volume: c.volume == null ? 1 : +c.volume, clip: c };
  };
  const v1L = tl.v1 || {};
  if (live(v1L)) out.video.push({ name: v1L.name || "V1", items: (tl.video || []).map((c) => media(c, "video")).filter(Boolean), v1: true });
  (tl.vlayers || []).forEach((L, i) => {
    if (!live(L)) return;
    out.video.push({ name: L.name || "V" + (i + 2), items: (L.clips || []).filter((c) => !c.m3d).map((c) => media(c, "video")).filter(Boolean), opacity: L.opacity });
  });
  (tl.images || []).forEach((L, i) => {
    if (!live(L)) return;
    out.video.push({ name: L.name || "I" + (i + 1), items: (L.clips || []).filter((c) => !c.adjust).map((c) => ({ name: path.basename(String(c.name)), kind: "image", start: +c.start || 0,   // 2.409.0: an adjustment layer has no picture
      len: Math.max(0.1, +c.len || 3), in: 0, out: Math.max(0.1, +c.len || 3), dur: null, speed: 1, reverse: false, opacity: c.opacity == null ? 1 : +c.opacity, volume: 1, clip: c })) });
  });
  if (live(v1L) && !v1L.muted && !tl.vmute)
    out.audio.push({ name: (v1L.name || "V1") + " sound", items: out.video[0] ? out.video[0].items.map((x) => Object.assign({}, x, { volume: v1L.volume == null ? 1 : +v1L.volume })) : [], linked: true });
  (tl.audio || []).forEach((L, i) => {
    if (!live(L) || L.muted) return;
    out.audio.push({ name: L.name || "A" + (i + 1), items: (L.clips || []).map((c) => media(Object.assign({}, c, { volume: (c.volume == null ? 1 : +c.volume) * (L.volume == null ? 1 : +L.volume) }), "audio")).filter(Boolean) });
  });
  out.video = out.video.filter((t) => t.items.length);
  out.audio = out.audio.filter((t) => t.items.length);
  return out;
}
function seqEnd(it) { let e = 0; it.video.concat(it.audio).forEach((t) => t.items.forEach((x) => { e = Math.max(e, x.start + x.len); })); return e; }

/* ---------------- FCP 7 XML */
function toFcpXml(tl, o) {
  const fps = (o && o.fps) || 25, it = items(tl), F = (s) => TC.frames(s, fps), R = rateXml(fps);
  const W = (o && o.w) || 1920, H = (o && o.h) || 1080, name = (o && o.name) || "bitGen timeline";
  const drop = TC.isDrop(o && o.tc, fps);                     // 2.412.0: drop-frame (29.97 / 59.94)
  const tcf = o && o.tc && o.tc.start ? TC.parse(o.tc.start, fps, drop) || 0 : 0, tc = TC.fmt(tcf, fps, drop);
  const files = new Map(); let fid = 0, cid = 0;
  const fileXml = (x) => {
    const key = x.kind + ":" + x.name;
    if (files.has(key)) return `<file id="${files.get(key)}"/>`;
    const id = "file-" + (++fid); files.set(key, id);
    const p = o && o.abs ? o.abs(x) : x.name;
    const still = x.kind === "image";
    const md = still ? `<media><video><samplecharacteristics><width>${W}</width><height>${H}</height></samplecharacteristics></video></media>`
      : x.kind === "audio" && AUD.test(x.name) ? "<media><audio><channelcount>2</channelcount></audio></media>"
        : `<media><video><samplecharacteristics>${R}<width>${W}</width><height>${H}</height></samplecharacteristics></video><audio><channelcount>2</channelcount></audio></media>`;
    return `<file id="${id}"><name>${esc(x.name)}</name><pathurl>${esc(fileUrl(p))}</pathurl>${R}<duration>${F(x.dur != null ? x.dur : x.out)}</duration>`
      + `<timecode>${R}<string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode>${md}</file>`;
  };
  const filters = (x, audio, inF) => {
    let f = ""; inF0 = inF || 0;
    if (!audio && (Math.abs(x.speed - 1) > 1e-4 || x.reverse))
      f += `<filter><effect><name>Time Remap</name><effectid>timeremap</effectid><effectcategory>motion</effectcategory><effecttype>motion</effecttype><mediatype>video</mediatype>`
        + `<parameter authoringApp="PremierePro"><parameterid>variablespeed</parameterid><name>variablespeed</name><valuemin>0</valuemin><valuemax>1</valuemax><value>0</value></parameter>`
        + `<parameter authoringApp="PremierePro"><parameterid>speed</parameterid><name>speed</name><valuemin>-100000</valuemin><valuemax>100000</valuemax><value>${+(x.speed * 100).toFixed(2)}</value></parameter>`
        + `<parameter authoringApp="PremierePro"><parameterid>reverse</parameterid><name>reverse</name><value>${x.reverse ? "TRUE" : "FALSE"}</value></parameter>`
        + `<parameter authoringApp="PremierePro"><parameterid>frameblending</parameterid><name>frameblending</name><value>FALSE</value></parameter></effect></filter>`;
    // 2.414.0: Basic Motion (position / scale / rotation, ◆ keyed), opacity and level keyframes - lib/fcp7Extras.js
    const xo = { fps, w: W, h: H, inF: inF0, F, S: (f) => TC.secs(f, fps) };
    if (!audio) f += X7.motionXml(x.clip, xo) + X7.opacityXml(x.clip, x.opacity, xo);
    else f += X7.levelsXml(x.clip, x.volume, xo);
    return f;
  };
  let inF0 = 0;
  // 2.412.0: a marker's <out> = its range's end (-1 = a point); clip markers ride inside their <clipitem> (source frames)
  const mkXml = (m, inF) => `<marker><name>${esc(m.name)}</name><comment>${esc(m.note)}</comment><in>${inF}</in><out>${m.d ? inF + Math.max(1, F(m.d)) : -1}</out>`
    + `<color>${esc(m.color)}</color></marker>`;
  const clipMk = (x, sp) => (x.clip ? MK.clipMarks(x.clip) : []).map((m) => mkXml(sp && sp !== 1 ? Object.assign({}, m, { d: m.d ? m.d / sp : 0 }) : m, sp && sp !== 1 ? Math.round(F(m.t) / sp) : F(m.t))).join("");
  const clipXml = (x, audio, ti) => {
    const st = F(x.start), en = st + Math.max(1, F(x.len));
    // 2.413.0: a time-remapped clip's <in> / <out> / <duration> are in the SPEED-ADJUSTED frames (FCP 7 / Premiere:
    // out - in = end - start; the source in = in x speed) - what Premiere writes and other readers expect
    const sp = !audio && (Math.abs(x.speed - 1) > 1e-4 || x.reverse) ? x.speed : 1;
    const inF = sp !== 1 ? Math.round(F(x.in) / sp) : F(x.in), outF = sp !== 1 ? inF + (en - st) : Math.max(inF + 1, F(x.out));
    const cdur = sp !== 1 ? Math.round(F(x.dur != null ? x.dur : x.out) / sp) : F(x.dur != null ? x.dur : x.out);
    return `<clipitem id="clipitem-${++cid}"><name>${esc(x.name)}</name><enabled>TRUE</enabled><duration>${cdur}</duration>${R}`
      + `<start>${st}</start><end>${en}</end><in>${inF}</in><out>${outF}</out>${fileXml(x)}`
      + (audio ? `<sourcetrack><mediatype>audio</mediatype><trackindex>${ti || 1}</trackindex></sourcetrack>` : "")
      + filters(x, audio, inF) + (audio ? "" : clipMk(x, sp) + (x.clip && x.kind !== "image" ? X7.commentsXml(x.clip, { lut: o && o.lut }) : "")) + "</clipitem>";
  };
  const dur = F(seqEnd(it));
  const cap = tl.captions && tl.captions.visible !== false && Array.isArray(tl.captions.cues) ? tl.captions.cues : null;   // 2.414.0
  const vt = it.video.map((t) => `<track>${t.items.map((x) => clipXml(x, false)).join("")}<enabled>TRUE</enabled><locked>FALSE</locked></track>`).join("")
    + (cap ? X7.captionsTrack(cap, { F, R, h: H }) : "");
  const at = it.audio.map((t) => `<track>${t.items.map((x) => clipXml(x, true, 1)).join("")}<enabled>TRUE</enabled><locked>FALSE</locked><outputchannelindex>1</outputchannelindex></track>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="5"><sequence id="sequence-1"><name>${esc(name)}</name><duration>${dur}</duration>${R}`
    + `<timecode>${R}<string>${esc(tc)}</string><frame>${tcf}</frame><displayformat>${drop ? "DF" : "NDF"}</displayformat></timecode>`
    + MK.list(tl).map((m) => mkXml(m, F(m.t))).join("")
    + `<media><video><format><samplecharacteristics>${R}<width>${W}</width><height>${H}</height><pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance></samplecharacteristics></format>${vt}</video>`
    + `<audio><numOutputChannels>2</numOutputChannels>${at}</audio></media></sequence></xmeml>\n`;
}

/* ---------------- CMX3600 EDL */
function toEdl(tl, o) {
  const fps = (o && o.fps) || 25, it = items(tl), F = (s) => TC.frames(s, fps);
  const drop = TC.isDrop(o && o.tc, fps);                     // 2.412.0: FCM: DROP FRAME, every timecode HH:MM:SS;FF
  const start = o && o.tc && o.tc.start ? TC.parse(o.tc.start, fps, drop) || 0 : 0;
  const v1 = it.video.find((t) => t.v1);
  const T = (f) => TC.fmt(f, fps, drop);
  const lines = [`TITLE: ${String((o && o.name) || "bitGen timeline").replace(/[\r\n]/g, " ").slice(0, 70)}`, drop ? "FCM: DROP FRAME" : "FCM: NON-DROP FRAME", ""];
  let n = 0;
  const marks = MK.list(tl).slice();
  const loc = (m) => `* LOC: ${T(start + F(m.t))} ${m.color.toUpperCase().padEnd(7)} ${String(m.name || "marker").replace(/[\r\n]/g, " ").slice(0, 60)}`;
  const reel = (s) => String(s).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "AX";
  (v1 ? v1.items : []).slice().sort((a, b) => a.start - b.start).forEach((x) => {
    n++;
    const srcIn = F(x.in), srcOut = F(x.in) + Math.max(1, F(x.out - x.in)), recIn = start + F(x.start), recOut = recIn + Math.max(1, F(x.len));
    const num = String(n).padStart(3, "0");
    const audioKind = it.audio.some((t) => t.linked) ? "AA/V" : "V";
    lines.push(`${num}  ${reel(x.name).padEnd(8)} ${audioKind.padEnd(5)} C        ${T(srcIn)} ${T(srcOut)} ${T(recIn)} ${T(recOut)}`);
    if (Math.abs(x.speed - 1) > 1e-4 || x.reverse)
      lines.push(`M2   ${reel(x.name).padEnd(8)} ${((x.reverse ? -1 : 1) * TC.base(fps).tb * x.speed).toFixed(1).padStart(6, "0")}                ${T(srcIn)}`);
    lines.push(`* FROM CLIP NAME: ${x.name}`);
    lines.push(`* SOURCE FILE: ${x.name}`);
    while (marks.length && marks[0].t < x.start + x.len - 1e-6) lines.push(loc(marks.shift()));   // 2.410.0: its markers
    lines.push("");
  });
  if (marks.length) { marks.forEach((m) => lines.push(loc(m))); lines.push(""); }
  return lines.join("\n");
}

/* ---------------- OpenTimelineIO */
function toOtio(tl, o) {
  const fps = (o && o.fps) || 25, it = items(tl), F = (s) => TC.frames(s, fps);
  const RT = (v) => ({ OTIO_SCHEMA: "RationalTime.1", rate: TC.rate(fps), value: v });     // 2.412.0: 29.97 = 30000/1001
  const otMk = (m) => ({ OTIO_SCHEMA: "Marker.2", name: m.name, color: m.color.toUpperCase(), comment: m.note,
    marked_range: { OTIO_SCHEMA: "TimeRange.1", start_time: RT(F(m.t)), duration: RT(m.d ? Math.max(1, F(m.d)) : 0) }, metadata: {} });
  const track = (t, kind) => {
    const ch = []; let cur = 0;
    t.items.slice().sort((a, b) => a.start - b.start).forEach((x) => {
      const st = F(x.start), ln = Math.max(1, F(x.len));
      if (st > cur) ch.push({ OTIO_SCHEMA: "Gap.1", name: "", source_range: { OTIO_SCHEMA: "TimeRange.1", start_time: RT(0), duration: RT(st - cur) } });
      if (st < cur) return;                                   // an overlap cannot sit on one OTIO track
      const srcFrames = Math.max(1, F(x.out - x.in));
      ch.push({ OTIO_SCHEMA: "Clip.1", name: x.name,
        source_range: { OTIO_SCHEMA: "TimeRange.1", start_time: RT(F(x.in)), duration: RT(kind === "Video" && x.kind !== "image" ? ln : srcFrames) },
        media_reference: { OTIO_SCHEMA: "ExternalReference.1", target_url: fileUrl(o && o.abs ? o.abs(x) : x.name), available_range: null },
        effects: Math.abs(x.speed - 1) > 1e-4 || x.reverse ? [{ OTIO_SCHEMA: "LinearTimeWarp.1", name: "speed", effect_name: "LinearTimeWarp", time_scalar: (x.reverse ? -1 : 1) * +x.speed.toFixed(4) }] : [],
        markers: (x.clip ? MK.clipMarks(x.clip) : []).map(otMk),                // 2.412.0: clip markers (source time)
        metadata: { bitgen: { opacity: x.opacity, volume: x.volume } } });
      cur = st + ln;
    });
    return { OTIO_SCHEMA: "Track.1", name: t.name, kind, children: ch };
  };
  const start = o && o.tc && o.tc.start ? TC.parse(o.tc.start, fps, TC.isDrop(o.tc, fps)) || 0 : 0;
  return JSON.stringify({ OTIO_SCHEMA: "Timeline.1", name: (o && o.name) || "bitGen timeline", global_start_time: RT(start),
    tracks: { OTIO_SCHEMA: "Stack.1", name: "tracks", children: it.video.map((t) => track(t, "Video")).concat(it.audio.map((t) => track(t, "Audio"))),
      markers: MK.list(tl).map(otMk) },
    metadata: { bitgen: { width: (o && o.w) || 1920, height: (o && o.h) || 1080 } } }, null, 2) + "\n";
}

/* ---------------- a small XML reader (elements, attributes, text) - enough for xmeml */
function parseXml(text) {
  const root = { tag: "#root", attrs: {}, kids: [], text: "" }, stack = [root];
  const s = String(text).replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<!DOCTYPE[^>]*>/gi, "");
  const re = /<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[\w.:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)|<!\[CDATA\[([\s\S]*?)\]\]>/g;
  const un = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  let m;
  while ((m = re.exec(s))) {
    if (m[5] != null || m[6] != null) { stack[stack.length - 1].text += m[6] != null ? m[6] : un(m[5]); continue; }
    if (m[1]) { if (stack.length > 1) stack.pop(); continue; }
    const attrs = {};
    (m[3] || "").replace(/([\w.:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g, (_a, k, _b, v1, v2) => { attrs[k] = un(v1 != null ? v1 : v2); return ""; });
    const el = { tag: m[2], attrs, kids: [], text: "" };
    stack[stack.length - 1].kids.push(el);
    if (!m[4]) stack.push(el);
  }
  return root;
}
const kid = (el, tag) => (el && el.kids.find((k) => k.tag === tag)) || null;
const kids = (el, tag) => (el ? el.kids.filter((k) => k.tag === tag) : []);
const txt = (el, tag) => { const k = kid(el, tag); return k ? k.text.trim() : ""; };
function find(el, tag) { if (!el) return null; for (const k of el.kids) { if (k.tag === tag) return k; const f = find(k, tag); if (f) return f; } return null; }

const LDEF = () => ({ opacity: 1, volume: 1, visible: true, solo: false, muted: false,
  transitionIn: { type: "none", dur: 0.5 }, transitionOut: { type: "none", dur: 0.5 } });
function emptyTl() {
  return { video: [], v1: Object.assign({ name: "V1" }, LDEF()), vlayers: [], audio: [], images: [], markers: { ff: null, lf: null, refs: [] }, sel: null, selLayer: null };
}

function fromFcpXml(text, o) {
  const root = parseXml(text);
  const seq = find(root, "sequence");
  if (!seq) throw Object.assign(new Error("no <sequence> in that XML - is it a Final Cut Pro 7 XML export?"), { status: 400 });
  const rate = kid(seq, "rate"), tb = +txt(rate, "timebase") || 25, ntsc = /true/i.test(txt(rate, "ntsc"));
  const fps = ntsc ? +(tb * 1000 / 1001).toFixed(3) : tb;
  const tcEl = kid(seq, "timecode");
  const tcStr = tcEl ? txt(tcEl, "string") : "";
  const S = (f) => +TC.secs(Number(f), fps).toFixed(4);       // 2.412.0: an NTSC frame is 1001 / 30000 s
  const tcDrop = /^DF$/i.test(tcEl ? txt(tcEl, "displayformat") : "") || /;/.test(tcStr);
  const mkIn = (el) => kids(el, "marker").map((m) => { const a = +txt(m, "in") || 0, b = +txt(m, "out");
    return MK.one({ t: S(a), d: Number.isFinite(b) && b > a ? S(b - a) : 0, name: txt(m, "name"), note: txt(m, "comment"), color: (txt(m, "color") || "green").toLowerCase() }); }).filter(Boolean);
  const fileDefs = {};
  (function walk(el) { for (const k of el.kids) { if (k.tag === "file" && k.attrs.id && k.kids.length) fileDefs[k.attrs.id] = k; walk(k); } })(seq);
  const fileOf = (ci) => { const f = kid(ci, "file"); if (!f) return null; return f.kids.length ? f : fileDefs[f.attrs.id] || null; };
  const tl = emptyTl(), missing = new Set(), notes = [];
  const media = kid(seq, "media");
  const sch = find(kid(kid(media, "video"), "format"), "samplecharacteristics");   // 2.414.0: Basic Motion is in frame fractions
  const seqW = +txt(sch, "width") || (o && o.w) || 1920, seqH = +txt(sch, "height") || (o && o.h) || 1080;
  const clipFrom = (ci, kindWanted) => {
    if (/false/i.test(txt(ci, "enabled"))) return null;
    const f = fileOf(ci);
    const nm = f ? (txt(f, "name") || path.basename(urlPath(txt(f, "pathurl")))) : txt(ci, "name");
    if (!nm) return null;
    const hit = o && o.find ? o.find(nm, kindWanted) : { src: "video", kind: kindWanted };
    if (!hit) { missing.add(nm); return null; }
    const st = +txt(ci, "start"), en = +txt(ci, "end"), inF = +txt(ci, "in"), outF = +txt(ci, "out");
    if (!(en > st) || st < 0) return null;                    // -1 = inside a transition: skipped
    const fdur = f ? +txt(f, "duration") : NaN;
    const c = { name: nm, start: S(st), in: S(inF), out: S(outF), dur: Number.isFinite(fdur) && fdur > 0 ? S(fdur) : S(outF), opacity: 1, _kind: hit.kind, src: hit.src };
    for (const eff of kids(kid(ci, "filter") ? ci : null, "filter").map((x) => kid(x, "effect")).filter(Boolean)) {
      const id = txt(eff, "effectid"), par = (pid) => { const p = kids(eff, "parameter").find((x) => txt(x, "parameterid") === pid); return p ? txt(p, "value") : ""; };
      if (id === "timeremap") {
        const sp = Math.abs(+par("speed") || 100) / 100, rev = /true/i.test(par("reverse")) || +par("speed") < 0;
        if (Math.abs(sp - 1) > 1e-3 || rev) {
          c.fx = FX.normalize({ speed: sp, reverse: rev }) || undefined;
          // 2.413.0: FCP 7 / Premiere write a remapped clip's in / out in SPEED-ADJUSTED frames (out - in = end - start);
          // bitGen before 2.413 wrote source frames - whichever fits this clip is read
          if (Math.abs((outF - inF) - (en - st)) <= 1.01 && Math.abs(sp - 1) > 1e-3) {
            c.in = S(inF * sp); c.out = S(inF * sp + (en - st) * sp); c._adj = sp;
            if (Number.isFinite(fdur) && fdur > 0) c.dur = Math.max(S(fdur), c.out);
          }
        }
      } else if (id === "opacity") c.opacity = Math.max(0, Math.min(1, (+par("opacity") || 100) / 100));
      else if (id === "audiolevels") c.volume = Math.max(0, Math.min(4, +par("level") || 1));
    }
    X7.readClip(ci, c, { w: seqW, h: seqH, inF, S: (f) => TC.secs(f, fps), audio: kindWanted === "audio" });   // 2.414.0
    // the source range a retimed clip covers on the timeline (the XML's in/out are already in source frames)
    const cm = mkIn(ci);                                     // 2.412.0: clip markers (source frames)
    if (cm.length) c.marks = c._adj ? cm.map((m) => Object.assign(m, { t: +(m.t * c._adj).toFixed(4) }, m.d ? { d: +(m.d * c._adj).toFixed(4) } : {})) : cm;
    delete c._adj;
    return c;
  };
  const vids = media ? kids(kid(media, "video"), "track") : [];
  const vfiles = new Set();
  const nameOf = (ci) => { const f = fileOf(ci); return f ? (txt(f, "name") || path.basename(urlPath(txt(f, "pathurl")))) : txt(ci, "name"); };
  vids.forEach((tr) => kids(tr, "clipitem").forEach((ci) => vfiles.add(nameOf(ci))));   // found or not: their sound rides with them
  let capTrack = null;
  vids.forEach((tr) => { const q = X7.readCaptions(tr, S); if (q && !capTrack) { capTrack = tr; tl.captions = { cues: q, burn: true, visible: true }; } });   // 2.414.0
  vids.filter((tr) => tr !== capTrack).forEach((tr, ti) => {
    const cs = kids(tr, "clipitem").map((ci) => clipFrom(ci, "video")).filter(Boolean);
    const stills = cs.filter((c) => c._kind === "image"), movs = cs.filter((c) => c._kind !== "image");
    if (ti === 0 && movs.length) tl.video = movs.map(({ _kind, ...c }) => c);
    else if (movs.length) tl.vlayers.push(Object.assign({ name: "V" + (tl.vlayers.length + 2), clips: movs.map(({ _kind, ...c }) => c) }, LDEF()));
    if (stills.length) tl.images.push(Object.assign({ name: "I" + (tl.images.length + 1), clips: stills.map((c) => Object.assign({ name: c.name, start: c.start, len: +(c.out - c.in || 3).toFixed(4), opacity: c.opacity },
      c.tf ? { tf: c.tf } : {}, c.kf ? { kf: c.kf } : {},
      c.marks ? { marks: c.marks.map((m) => Object.assign({}, m, { t: +Math.max(0, m.t - c.in).toFixed(4) })) } : {})) }, LDEF()));
  });
  const auds = media ? kids(kid(media, "audio"), "track") : [];
  auds.forEach((tr) => {
    const raw = kids(tr, "clipitem");
    // a track carrying only the video clips' own sound is the picture's sound (it rides with the clips here)
    const names = raw.map(nameOf);
    if (names.length && names.every((n) => vfiles.has(n))) return;
    const cs = raw.map((ci) => clipFrom(ci, "audio")).filter(Boolean).map(({ _kind, src, opacity, ...c }) => c);
    if (cs.length) tl.audio.push(Object.assign({ name: "A" + (tl.audio.length + 1), clips: cs }, LDEF()));
  });
  if (!tl.video.length && tl.vlayers.length) { tl.video = tl.vlayers.shift().clips; notes.push("no clips on the XML's first video track - its next one became V1"); }
  if (tcStr && Number.isFinite(TC.parse(tcStr, fps, tcDrop))) {
    const dr = tcDrop && TC.canDrop(fps), st = TC.fmt(TC.parse(tcStr, fps, tcDrop), fps, dr);
    tl.tc = dr ? { start: st, fps, drop: true } : { start: st, fps };
  }
  const mk = mkIn(seq);
  if (mk.length) tl.seqMarkers = mk.sort((a, b) => a.t - b.t);              // 2.410.0
  return { tl, name: txt(seq, "name") || "imported", fps, missing: [...missing], notes };
}

function fromEdl(text, o) {
  const lines = String(text).split(/\r?\n/);
  const title = (lines.find((l) => /^TITLE:/i.test(l)) || "TITLE: imported").replace(/^TITLE:\s*/i, "").trim();
  const fps = (o && o.fps) || 25;
  const drop = TC.canDrop(fps) && (lines.some((l) => /^FCM:\s*DROP FRAME/i.test(l.trim())) || lines.some((l) => /\d\d;\d\d\s/.test(l)));   // 2.412.0
  const P = (t) => TC.parse(t, fps, drop);
  const ev = [], locs = [];
  let cur = null;
  for (const ln of lines) {
    const lc = /^\*\s*LOC:\s*(\d\d:\d\d:\d\d[:;]\d\d)\s+(\S+)?\s*(.*)$/i.exec(ln.trim());   // 2.410.0: markers
    if (lc) { locs.push({ f: P(lc[1]), color: String(lc[2] || "green").toLowerCase(), name: (lc[3] || "").trim() }); continue; }
    const m = /^(\d{3,6})\s+(\S+)\s+(\S+)\s+(C|D|W\d+|K\S*)\s*(\d+)?\s+(\d\d:\d\d:\d\d[:;]\d\d)\s+(\d\d:\d\d:\d\d[:;]\d\d)\s+(\d\d:\d\d:\d\d[:;]\d\d)\s+(\d\d:\d\d:\d\d[:;]\d\d)/.exec(ln.trim());
    if (m) { cur = { reel: m[2], track: m[3], si: P(m[6]), so: P(m[7]), ri: P(m[8]), ro: P(m[9]), name: "", speed: 1, rev: false }; ev.push(cur); continue; }
    const c = /^\*\s*(FROM CLIP NAME|SOURCE FILE):\s*(.+)$/i.exec(ln.trim());
    if (c && cur) { if (!cur.name || /SOURCE FILE/i.test(c[1])) cur.name = c[2].trim(); continue; }
    const m2 = /^M2\s+\S+\s+(-?[\d.]+)/.exec(ln.trim());
    if (m2 && cur) { const v = +m2[1]; cur.speed = Math.abs(v) / TC.base(fps).tb; cur.rev = v < 0; }
  }
  if (!ev.length) throw Object.assign(new Error("no events in that EDL (CMX3600: 001  REEL  V  C  src-in src-out rec-in rec-out)"), { status: 400 });
  const vid = ev.filter((e) => /V/i.test(e.track));
  const use = vid.length ? vid : ev;
  const firstRec = Math.min(...use.map((e) => e.ri));
  const hour = drop ? TC.parse("01:00:00;00", fps, true) : TC.base(fps).tb * 3600;
  const off = o && o.tc && o.tc.start ? TC.parse(o.tc.start, fps, TC.isDrop(o.tc, fps)) || 0 : (firstRec >= hour ? Math.floor(firstRec / hour) * hour : 0);
  const tl = emptyTl(), missing = new Set();
  const S = (f) => +TC.secs(f, fps).toFixed(4);
  use.forEach((e) => {
    const nm = e.name || e.reel;
    const hit = o && o.find ? o.find(nm, vid.length ? "video" : "audio") : { src: "video" };
    if (!hit) { missing.add(nm); return; }
    const c = { name: nm, start: S(e.ri - off), in: S(e.si), out: S(e.so), dur: S(e.so), opacity: 1, src: hit.src };
    if (Math.abs(e.speed - 1) > 1e-3 || e.rev) {
      // the EDL's src-out is where it would end at 100 %; the record length is the truth
      c.out = +(c.in + S(e.ro - e.ri) * e.speed).toFixed(4); c.dur = c.out;
      c.fx = FX.normalize({ speed: e.speed, reverse: e.rev }) || undefined;
    }
    if (vid.length) tl.video.push(c);
    else { if (!tl.audio.length) tl.audio.push(Object.assign({ name: "A1", clips: [] }, LDEF())); delete c.opacity; delete c.src; tl.audio[0].clips.push(c); }
  });
  if (off) tl.tc = drop ? { start: TC.fmt(off, fps, true), fps, drop: true } : { start: TC.fmt(off, fps), fps };
  const mk = locs.filter((l) => Number.isFinite(l.f) && l.f >= off).map((l) => MK.one({ t: S(l.f - off), name: l.name, color: l.color })).filter(Boolean);
  if (mk.length) tl.seqMarkers = mk;
  return { tl, name: title, fps, missing: [...missing], notes: ev.length > use.length ? ["sound-only events were left out (bitGen's V1 carries its own sound)"] : [] };
}

module.exports = { items, toFcpXml, toEdl, toOtio, fromFcpXml, fromEdl, parseXml, fileUrl, urlPath };
