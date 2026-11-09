/* bitGen Studio — ENGRAVED SHEET MUSIC from ABC (2.731.0): static/abcscore.js
 *
 * Tim (verbatim): "in our music docker, sheet music tab can we have real sheet music with the notes drawn on the staff
 * with it's clefs etc. and save as pdf?"  + the standing rule: "just use the standards don't import anything - don't do
 * anything to jepordize the free license".
 *
 * So this file is the whole engraver, written here, no library: the ABC text YuE2 / SheetSage2 write (and ordinary ABC
 * 2.1 tunes) -> pages of drawing operations -> SVG for the Sheet music tab and a PDF written byte by byte with the PDF
 * standard's own 14 fonts (Helvetica, Times - every PDF reader has them, nothing is embedded). Clefs, accidentals,
 * rests and flags are drawn as paths below (no music font). UMD: the page gets window.AbcScore, Node tests require() it.
 *
 *   parse(text)              -> score {title, composer, tempo, key, meter, voices:[{id,name,snm,clef,measures}], sections}
 *   render(textOrScore, opt) -> {pages:[{w,h,ops}], title, voices, measures, systems, warnings, empty}
 *   toSVG(page)              -> "<svg …>" (one page, white paper)
 *   toPDF(pages, meta)       -> Uint8Array (a complete PDF 1.4 file)
 *
 * The YuE2 dialect it reads: X/T/M/L/Q, `V: Vocal clef=treble name="Vocal Melody" snm="Vocal"`, K:, `% verse` section
 * comments, groups of a `V: Vocal` line + a `V: Ins` line, notes ^ _ = ^^ __ C..B c..b ' , durations, - ties, z rests,
 * Z / Z4 whole-bar rests, "Cmaj7" chord symbols. Also: [CEG] chords, (3 tuplets, > < broken rhythm, ( ) slurs, |: :|
 * repeats, [1 [2 endings, || |] bars, inline [K:] [M:] [L:] [V:], clef=bass / alto / tenor / treble-8.
 * Accidentals carry through the bar for the same letter in every octave (ABC 2.1's default, and YuE2's); a tied note
 * with no accidental keeps the pitch it was tied from.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AbcScore = factory();
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ───────────────────────────── the ABC reader ─────────────────────────────
  const WHOLE = 1920;                                   // ticks in a whole note (divides by 3, 5 and 2^7)
  const LETTERS = "CDEFGAB";
  const SHARP_ORDER = "FCGDAEB", FLAT_ORDER = "BEADGCF";
  const FIFTHS = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 };
  const MODES = { maj: 0, ion: 0, min: -3, aeo: -3, mix: -1, dor: -2, phr: -4, lyd: 1, loc: -5 };
  const ACC = { "^": 1, "^^": 2, "_": -1, "__": -2, "=": 0 };
  const CLEF_BOTTOM = { treble: 30, bass: 18, alto: 24, tenor: 22 };   // diatonic step on the bottom line (C4 = 28)

  function frac(s) {
    const m = /^\s*(\d+)\s*\/\s*(\d+)/.exec(String(s || ""));
    if (!m || !+m[1] || !+m[2]) return 0;
    return Math.round(WHOLE * +m[1] / +m[2]);
  }
  function parseMeter(s) {
    const t = String(s || "").trim();
    if (!t || /^none$/i.test(t)) return null;
    if (t === "C") return { n: 4, d: 4, top: "4" };
    if (t === "C|") return { n: 2, d: 2, top: "2" };
    const m = /^\(?([\d+]+)\)?\s*\/\s*(\d+)/.exec(t);
    if (!m) return null;
    const n = m[1].split("+").reduce((a, b) => a + (parseInt(b, 10) || 0), 0), d = parseInt(m[2], 10);
    return n > 0 && d > 0 ? { n, d, top: String(n) } : null;
  }
  const barTicks = (mt) => (mt ? Math.round(WHOLE * mt.n / mt.d) : 0);
  function normClef(c) {
    const s = String(c || "").toLowerCase();
    const oct = /[-_]8$|8vb/.test(s) ? -1 : /\+8$/.test(s) ? 1 : 0;
    const name = /^(bass|f)/.test(s) ? "bass" : /^(alto|c3?$)/.test(s) ? "alto" : /^(tenor|c4)/.test(s) ? "tenor" : "treble";
    return { name, oct };
  }
  function clefIn(s) {
    const m = /(?:^|\s)clef\s*=\s*"?([A-Za-z0-9+\-_]+)/.exec(s) || /(?:^|\s)(treble|bass|alto|tenor)([+-]8)?(?=\s|$)/i.exec(s);
    return m ? normClef(m[1] + (m[2] || "")) : null;
  }
  function accMap(count) {
    const a = {};
    for (let i = 0; i < Math.min(7, Math.abs(count)); i++) a[(count > 0 ? SHARP_ORDER : FLAT_ORDER)[i]] = count > 0 ? 1 : -1;
    return a;
  }
  function parseKey(s) {
    const str = String(s || "").trim();
    const out = { text: str, name: "C", count: 0, acc: {}, clef: clefIn(str) };
    const m = /^([A-Ga-g])([#b]?)\s*([A-Za-z]*)/.exec(str);
    if (m && !/^(none)\b/i.test(str)) {
      const f = FIFTHS[m[1].toUpperCase()] + (m[2] === "#" ? 7 : m[2] === "b" ? -7 : 0);
      const md = m[3].toLowerCase();
      const off = md === "m" ? -3 : (MODES[md.slice(0, 3)] !== undefined ? MODES[md.slice(0, 3)] : 0);
      out.count = Math.max(-7, Math.min(7, f + off));
      out.name = m[1].toUpperCase() + m[2] + (off === -3 ? "m" : "");
    }
    out.acc = accMap(out.count);
    const rest = m ? str.slice(m[0].length) : str;          // K:D ^g _b (explicit accidentals)
    const ex = /(?:^|\s)(\^\^|\^|__|_|=)([A-Ga-g])(?=\s|$)/g;
    let e;
    while ((e = ex.exec(rest))) { const L = e[2].toUpperCase(); if (ACC[e[1]]) out.acc[L] = ACC[e[1]]; else delete out.acc[L]; }
    return out;
  }
  function parseTempo(s) {
    const t = String(s || ""), out = {};
    const q = /"([^"]*)"/.exec(t);
    if (q && q[1].trim()) out.text = q[1].trim();
    const m = /((?:\d+\/\d+\s*)+)=\s*(\d+)/.exec(t);
    if (m) { out.beat = m[1].trim().split(/\s+/).reduce((a, b) => a + frac(b), 0); out.bpm = +m[2]; } else {
      const b = /(?:^|\s|=)(\d+)\s*$/.exec(t.replace(/"[^"]*"/g, ""));
      if (b) out.bpm = +b[1];
    }
    return out.bpm || out.text ? out : null;
  }
  function durMult(t) {
    const m = /^(\d*)(\/*)(\d*)$/.exec(t || "");
    if (!m) return 1;
    const num = m[1] && +m[1] > 0 ? +m[1] : 1;
    let den = 1;
    if (m[2]) den = m[3] && +m[3] > 0 ? +m[3] * Math.pow(2, m[2].length - 1) : Math.pow(2, m[2].length);
    return Math.min(16, num / den);                      // nonsense lengths (A0, A/0, A999) stay drawable
  }

  function parse(text) {
    const lines = String(text == null ? "" : text).replace(/\r\n?/g, "\n").split("\n");
    const S = { title: [], composer: "", tempo: null, key: parseKey("C"), meter: { n: 4, d: 4, top: "4" }, unit: 0,
      voices: [], sections: {}, warnings: [] };
    const vmap = {}, order = [];
    let inBody = false, done = false, curId = null, meter = S.meter, unit = 0, unitSet = false, key = S.key;
    let pendingSection = null, tupletSeq = 0, tunes = 0;
    const defUnit = () => (meter && meter.n / meter.d < 0.75 ? WHOLE / 16 : WHOLE / 8);

    function voice(id) {
      if (!vmap[id]) {
        vmap[id] = { id, name: "", snm: "", clef: null, measures: [], cur: null, barAcc: {}, tieFrom: null, tuplet: null,
          beamBreak: true, pendingChord: null, pendingAnnot: null, broken: null, slurPending: 0, last: null,
          pendingStartRepeat: false, pendingEnding: null, overlay: false };
        order.push(id);
      }
      return vmap[id];
    }
    function cur() { if (curId == null) curId = order.length ? order[0] : "1"; return voice(curId); }
    function voiceField(rest) {
      const m = /^\s*(\S+)(.*)$/.exec(rest);
      if (!m) return null;
      const v = voice(m[1]), a = m[2];
      const nm = /(?:^|\s)(?:name|nm)\s*=\s*"([^"]*)"/.exec(a) || /(?:^|\s)(?:name|nm)\s*=\s*(\S+)/.exec(a);
      if (nm) v.name = nm[1].trim();
      const sn = /(?:^|\s)(?:subname|sname|snm)\s*=\s*"([^"]*)"/.exec(a) || /(?:^|\s)(?:subname|sname|snm)\s*=\s*(\S+)/.exec(a);
      if (sn) v.snm = sn[1].trim();
      const c = clefIn(a);
      if (c) v.clef = c;
      return v;
    }
    function field(k, val, inline) {
      const v0 = String(val || "").trim();
      switch (k) {
        case "X": if (inBody || tunes) { if (inBody) done = true; } tunes++; break;
        case "T": if (!inBody) { if (v0) S.title.push(v0); } else if (v0) pendingSection = v0; break;
        case "C": if (!inBody && v0) S.composer = S.composer ? S.composer + ", " + v0 : v0; break;
        case "M": meter = parseMeter(v0); if (!inBody) S.meter = meter; if (!unitSet) unit = defUnit(); break;
        case "L": { const u = frac(v0); if (u) { unit = u; unitSet = true; } break; }
        case "Q": { const tp = parseTempo(v0); if (tp && (!inBody || !S.tempo)) S.tempo = tp; break; }
        case "K": {
          key = parseKey(v0);
          if (!inBody) { S.key = key; inBody = true; if (key.clef) order.forEach((id) => { if (!vmap[id].clef) vmap[id].clef = key.clef; }); if (key.clef) S.defaultClef = key.clef; }
          else if (key.clef && !cur().measures.length && !cur().cur) cur().clef = key.clef;   // a clef change part-way is not drawn
          break;
        }
        case "V": { const v = voiceField(v0); if (v && (inBody || inline)) curId = v.id; break; }
        case "P": if (inBody && v0) pendingSection = v0; break;
        default: break;
      }
    }
    function openMeasure(v) {
      const idx = v.measures.length;
      const m = { events: [], key, meter, rightBar: "|", startRepeat: v.pendingStartRepeat, ending: v.pendingEnding, ticks: 0 };
      v.pendingStartRepeat = false; v.pendingEnding = null;
      if (pendingSection != null) { if (!S.sections[idx]) S.sections[idx] = pendingSection; pendingSection = null; }
      v.cur = m;                                        // (the bar's accidentals were reset when the last bar closed)
      return m;
    }
    function closeMeasure(v, bar) { v.cur.rightBar = bar; v.measures.push(v.cur); v.cur = null; v.overlay = false; v.barAcc = {}; }
    function onBar(v, tok) {
      const endRep = tok.charAt(0) === ":", startRep = tok.length > 1 && tok.charAt(tok.length - 1) === ":";
      const type = endRep ? ":|" : tok === "||" || tok === "[|" ? "||" : /\]$/.test(tok) ? "|]" : "|";
      if (v.cur && v.cur.events.length) closeMeasure(v, type);
      else if (!v.cur && v.measures.length && type !== "|") v.measures[v.measures.length - 1].rightBar = type;
      else if (v.cur && !v.cur.events.length && type !== "|" && v.measures.length) v.measures[v.measures.length - 1].rightBar = type;
      if (startRep) v.pendingStartRepeat = true;
      v.beamBreak = true;
    }
    function addEvent(v, ev) {
      if (v.overlay) return;
      if (!v.cur) openMeasure(v);
      if (v.pendingChord) { ev.chord = v.pendingChord; v.pendingChord = null; }
      if (v.pendingAnnot) { ev.annot = v.pendingAnnot; v.pendingAnnot = null; }
      ev.beamBreak = v.beamBreak; v.beamBreak = false;
      if (v.broken) { ev.dur = Math.max(1, Math.round(ev.dur * v.broken)); v.broken = null; }
      if (v.tuplet && v.tuplet.left > 0) {
        ev.tuplet = { id: v.tuplet.id, p: v.tuplet.p, q: v.tuplet.q };
        ev.written = ev.dur; ev.dur = Math.max(1, Math.round(ev.dur * v.tuplet.q / v.tuplet.p));
        if (--v.tuplet.left <= 0) v.tuplet = null;
      }
      if (v.slurPending) { ev.slurStart = v.slurPending; v.slurPending = 0; }
      v.cur.events.push(ev); v.cur.ticks += ev.dur; v.last = ev;
    }
    function pitch(v, acc, letter, marks) {
      const L = letter.toUpperCase();
      let o = letter === L ? 4 : 5;
      for (const ch of marks || "") o += ch === "'" ? 1 : -1;
      let a, explicit = false;
      if (acc && ACC[acc] !== undefined) { a = ACC[acc]; v.barAcc[L] = a; explicit = true; } else {
        const tf = v.tieFrom && v.tieFrom.pitches.find((p) => p.L === L && p.o === o && p.tieOut);
        a = tf ? tf.a : (L in v.barAcc ? v.barAcc[L] : (key.acc[L] || 0));
      }
      const p = { L, o, a, d: o * 7 + LETTERS.indexOf(L), explicit };
      if (v.tieFrom && v.tieFrom.pitches.some((q) => q.L === L && q.o === o && q.tieOut)) p.tieIn = true;
      return p;
    }
    function quoted(v, txt) {
      if (/^[\^_<>@]/.test(txt)) { const t = txt.slice(1).trim(); if (t) v.pendingAnnot = t; } else if (txt.trim()) v.pendingChord = txt.trim();
    }
    function music(s) {
      let v = cur();
      let i = 0;
      const n = s.length;
      while (i < n) {
        const c = s[i], rest = s.slice(i);
        if (c === "%") break;
        if (c === " " || c === "\t") { v.beamBreak = true; i++; continue; }
        if (c === "`" || c === "\\" || c === "y") { i++; continue; }
        if (c === '"') { let j = s.indexOf('"', i + 1); if (j < 0) j = n; quoted(v, s.slice(i + 1, j)); i = j + 1; continue; }
        if (c === "!" || (c === "+" && /^\+[a-zA-Z]/.test(rest))) { const j = s.indexOf(c, i + 1); i = j < 0 ? i + 1 : j + 1; continue; }
        if (c === "{") { const j = s.indexOf("}", i + 1); i = j < 0 ? n : j + 1; continue; }     // grace notes: not drawn
        if (c === "[") {
          const fm = /^\[([A-Za-z]):([^\]]*)\]/.exec(rest);
          if (fm) { field(fm[1], fm[2], true); v = cur(); i += fm[0].length; continue; }
          const en = /^\[(\d[\d,\-]*)/.exec(rest);
          if (en) { v.pendingEnding = en[1]; i += en[0].length; continue; }
          if (s[i + 1] === "|") { onBar(v, "[|"); i += 2; continue; }
          const cm = /^\[((?:[\^_=]*[A-Ga-g][,']*[\d/]*-?\s*)+)\](\d*(?:\/+\d*)?)(-?)/.exec(rest);
          if (cm) {
            const nre = /([\^_=]{0,2})([A-Ga-g])([,']*)(\d*(?:\/+\d*)?)(-?)/g;
            let e, inner = null;
            const ps = [];
            while ((e = nre.exec(cm[1]))) {
              const p = pitch(v, ACC[e[1]] !== undefined ? e[1] : "", e[2], e[3]);
              if (e[5] || cm[3]) p.tieOut = true;
              if (inner == null) inner = durMult(e[4]);
              if (!ps.some((q) => q.d === p.d)) ps.push(p);
            }
            v.tieFrom = null;
            const u = unit || (unit = defUnit());
            if (ps.length) {
              addEvent(v, { type: "note", pitches: ps.sort((a, b) => a.d - b.d), dur: Math.max(1, Math.round(u * (inner || 1) * durMult(cm[2]))) });
              if (ps.some((p) => p.tieOut)) v.tieFrom = v.last;
            }
            i += cm[0].length; continue;
          }
          i++; continue;
        }
        if (c === "|" || (c === ":" && /^:+[|:]/.test(rest))) {
          const bm = /^(?::*\|[|\]]?:*|::+)/.exec(rest);
          const tok = bm ? bm[0] : c;
          onBar(v, tok); i += tok.length;
          const em = /^\[?(\d[\d,\-]*)/.exec(s.slice(i));
          if (em) { v.pendingEnding = em[1]; i += em[0].length; }
          continue;
        }
        if (c === "(") {
          const tm = /^\((\d)(?::(\d*))?(?::(\d*))?/.exec(rest);
          if (tm) {
            const p = +tm[1];
            const compound = meter && meter.d === 8 && meter.n % 3 === 0 && meter.n > 3;
            const q = tm[2] ? +tm[2] : ({ 2: 3, 3: 2, 4: 3, 6: 2, 8: 3 })[p] || (compound ? 3 : 2);
            const r = tm[3] ? +tm[3] : p;
            if (p > 1) v.tuplet = { id: ++tupletSeq, p, q, left: r };
            i += tm[0].length; continue;
          }
          v.slurPending++; i++; continue;
        }
        if (c === ")") { if (v.last) v.last.slurEnd = (v.last.slurEnd || 0) + 1; i++; continue; }
        if (c === "-") { if (v.last && v.last.type === "note") { v.last.pitches.forEach((p) => { p.tieOut = true; }); v.tieFrom = v.last; } i++; continue; }
        if (c === ">" || c === "<") {
          let k = 1;
          while (s[i + k] === c) k++;
          const small = 1 / Math.pow(2, k), big = 2 - small;
          const prevF = c === ">" ? big : small, nextF = c === ">" ? small : big;
          if (v.last && v.cur && v.cur.events.indexOf(v.last) >= 0) {
            const old = v.last.dur;
            v.last.dur = Math.max(1, Math.round(old * prevF));
            if (v.last.written) v.last.written = Math.round(v.last.written * prevF);
            v.cur.ticks += v.last.dur - old;
          }
          v.broken = nextF; i += k; continue;
        }
        if (c === "&") { v.overlay = true; i++; continue; }
        const nm = /^(\^\^|\^|__|_|=)?([A-Ga-g])([,']*)(\d*(?:\/+\d*)?)/.exec(rest);
        if (nm) {
          const p = pitch(v, nm[1] || "", nm[2], nm[3]);
          v.tieFrom = null;
          const u = unit || (unit = defUnit());
          addEvent(v, { type: "note", pitches: [p], dur: Math.max(1, Math.round(u * durMult(nm[4]))) });
          i += nm[0].length; continue;
        }
        const rm = /^([zx])(\d*(?:\/+\d*)?)/.exec(rest);
        if (rm) {
          const u = unit || (unit = defUnit());
          v.tieFrom = null;
          addEvent(v, { type: "rest", invisible: rm[1] === "x", dur: Math.max(1, Math.round(u * durMult(rm[2]))) });
          i += rm[0].length; continue;
        }
        const zm = /^([ZX])(\d*)/.exec(rest);
        if (zm) {
          const count = Math.max(1, Math.min(64, parseInt(zm[2] || "1", 10) || 1));
          v.tieFrom = null;
          for (let k = 0; k < count; k++) {
            if (k > 0 && v.cur && v.cur.events.length) closeMeasure(v, "|");
            addEvent(v, { type: "rest", bar: true, invisible: zm[1] === "X", dur: barTicks(meter) || WHOLE });
          }
          i += zm[0].length; continue;
        }
        i++;                                              // decorations (. ~ H T u v …) and anything unknown
      }
    }

    for (const raw of lines) {
      if (done) break;
      const line = raw.replace(/\s+$/, "");
      if (!line.trim()) continue;
      if (/^%%/.test(line)) continue;
      if (/^%/.test(line)) {
        const t = line.replace(/^%+/, "").trim();
        if (inBody && t && t.length <= 28 && /^[\p{L}\d][\p{L}\d \-'&.]*$/u.test(t)) pendingSection = t;
        continue;
      }
      const f = /^([A-Za-z]):(.*)$/.exec(line);
      if (f && !(inBody && /^[A-Ga-gz]$/.test(f[1]) && /[|]/.test(f[2]) && !/^[VKMLQTPWw]$/.test(f[1]))) { field(f[1], f[2], false); continue; }
      if (!inBody) { inBody = true; }                    // music before any K: (lenient)
      music(line);
    }
    if (tunes > 1 || done) S.warnings.push("only the first tune of this file is drawn");
    // finish: the open measures, the voices that have music
    for (const id of order) { const v = vmap[id]; if (v.cur && v.cur.events.length) closeMeasure(v, v.cur.rightBar || "|"); }
    let vs = order.map((id) => vmap[id]).filter((v) => v.measures.length);
    const count = vs.reduce((a, v) => Math.max(a, v.measures.length), 0);
    vs.forEach((v) => {                                  // a voice that stops early rests to the end
      while (v.measures.length < count) {
        const ref = vs.find((w) => w.measures[v.measures.length]).measures[v.measures.length];
        v.measures.push({ events: [{ type: "rest", bar: true, dur: barTicks(ref.meter) || WHOLE }], key: ref.key, meter: ref.meter,
          rightBar: ref.rightBar, startRepeat: false, ending: null, ticks: barTicks(ref.meter) || WHOLE, padded: true });
      }
    });
    S.voices = vs.map((v) => ({ id: v.id, name: v.name, snm: v.snm, clef: v.clef || S.defaultClef || normClef("treble"), measures: v.measures }));
    S.measureCount = count;
    S.unit = unit;
    return S;
  }

  // ───────────────────────────── rhythm -> written notes ─────────────────────────────
  // [ticks, base value, dots] longest first; a duration that is none of these is split into tied notes
  const VALUES = [[1920, 1920, 0], [1680, 960, 2], [1440, 960, 1], [960, 960, 0], [840, 480, 2], [720, 480, 1], [480, 480, 0],
    [420, 240, 2], [360, 240, 1], [240, 240, 0], [180, 120, 1], [120, 120, 0], [90, 60, 1], [60, 60, 0], [45, 30, 1], [30, 30, 0], [15, 15, 0]];
  function split(dur) {
    const out = [];
    let left = dur, guard = 0;
    while (left >= 15 && guard++ < 64) {
      const v = VALUES.find((x) => x[0] <= left);
      out.push({ val: v[0], base: v[1], dots: v[2] });
      left -= v[0];
    }
    if (!out.length) out.push({ val: dur, base: 15, dots: 0 });
    return out;
  }
  function single(w) {
    const v = VALUES.find((x) => x[0] <= w * 1.02) || VALUES[VALUES.length - 1];
    return { val: v[0], base: v[1], dots: v[2] };
  }
  const beamsOf = (base) => (base >= 480 ? 0 : base >= 240 ? 1 : base >= 120 ? 2 : base >= 60 ? 3 : base >= 30 ? 4 : 5);
  function beatTicks(mt) {
    if (!mt) return 480;
    if (mt.d === 8 && mt.n % 3 === 0) return 720;
    if (mt.d === 2) return 960;
    return Math.round(WHOLE / mt.d);
  }

  // ───────────────────────────── drawing helpers ─────────────────────────────
  // A path is [["M",x,y],["L",x,y],["C",x1,y1,x2,y2,x,y],["Z"]]; ops: {t:"p", d, fill, stroke, w, eo, cap} | {t:"t", x, y, s, f, z, a, g}
  function tf(cmds, ox, oy, s, sx, sy) {
    const X = (x) => ox + x * s * (sx || 1), Y = (y) => oy + y * s * (sy || 1);
    return cmds.map((c) => (c[0] === "Z" ? ["Z"] : c[0] === "C" ? ["C", X(c[1]), Y(c[2]), X(c[3]), Y(c[4]), X(c[5]), Y(c[6])] : [c[0], X(c[1]), Y(c[2])]));
  }
  function ellipse(cx, cy, rx, ry, ang) {
    const k = 0.5523, co = Math.cos(ang), si = Math.sin(ang);
    const ux = co * rx, uy = si * rx, vx = -si * ry, vy = co * ry;
    const P = (a, b) => [cx + a * ux + b * vx, cy + a * uy + b * vy];
    const q = [[1, 0], [1, k], [k, 1], [0, 1], [-k, 1], [-1, k], [-1, 0], [-1, -k], [-k, -1], [0, -1], [k, -1], [1, -k], [1, 0]];
    const d = [["M"].concat(P(1, 0))];
    for (let i = 1; i < q.length; i += 3) d.push(["C"].concat(P(q[i][0], q[i][1]), P(q[i + 1][0], q[i + 1][1]), P(q[i + 2][0], q[i + 2][1])));
    d.push(["Z"]);
    return d;
  }
  const circle = (cx, cy, r) => ellipse(cx, cy, r, r, 0);
  const rect = (x, y, w, h) => [["M", x, y], ["L", x + w, y], ["L", x + w, y + h], ["L", x, y + h], ["Z"]];
  const poly = (pts) => pts.map((p, i) => [i ? "L" : "M", p[0], p[1]]).concat([["Z"]]);
  const P = (pairs) => pairs;                            // readability: glyph command lists in staff spaces

  // glyphs, in staff spaces (x right, y down)
  const G_CLEF = {                                        // anchor: the G line (y 0); x 0 = the clef's left edge
    main: P([["M", 1.75, 0.15], ["C", 1.85, -0.35, 1.3, -0.6, 0.9, -0.35], ["C", 0.35, 0.0, 0.35, 0.85, 1.0, 1.1],
      ["C", 1.6, 1.35, 2.45, 1.0, 2.5, 0.2], ["C", 2.55, -0.6, 1.9, -1.1, 1.3, -1.55], ["C", 0.75, -1.95, 0.55, -2.6, 0.75, -3.3],
      ["C", 0.95, -4.0, 1.45, -4.7, 1.75, -4.85], ["C", 1.95, -4.9, 2.0, -4.4, 1.85, -4.05], ["C", 1.65, -3.6, 1.35, -3.3, 1.3, -2.7],
      ["L", 1.15, 2.1], ["C", 1.1, 2.75, 0.55, 2.95, 0.25, 2.65]]),
    thick: P([["M", 0.9, -0.35], ["C", 0.35, 0.0, 0.35, 0.85, 1.0, 1.1], ["M", 2.5, 0.2], ["C", 2.55, -0.6, 1.9, -1.1, 1.3, -1.55]]),
    ball: [0.52, 2.35, 0.38], width: 2.6,
  };
  const F_CLEF = {                                        // anchor: the F line
    main: P([["M", 0.2, -0.15], ["C", 0.35, -0.95, 1.25, -1.15, 1.8, -0.65], ["C", 2.35, -0.1, 2.05, 1.0, 1.35, 1.6], ["C", 0.95, 1.95, 0.45, 2.25, 0.05, 2.45]]),
    thick: P([["M", 1.8, -0.65], ["C", 2.35, -0.1, 2.05, 1.0, 1.35, 1.6]]),
    ball: [0.45, 0.05, 0.42], dots: [[2.6, -0.5], [2.6, 0.5]], width: 2.85,
  };
  const C_CLEF_LOBE = P([["M", 0.85, 0], ["C", 1.2, -0.3, 1.3, -0.9, 1.55, -0.95], ["C", 2.3, -1.05, 2.4, -2.0, 1.7, -2.0], ["C", 1.4, -2.0, 1.15, -1.8, 1.25, -1.55]]);
  const SHARP = { lines: [[0.28, -1.25, 0.28, 1.35], [0.68, -1.4, 0.68, 1.2]], bars: [[-0.25, -0.55], [0.55, 0.25]], width: 0.95 };
  const FLAT = { stem: [0.12, -1.85, 0.12, 0.55], bowl: P([["M", 0.12, 0.55], ["C", 0.5, 0.3, 0.95, 0.0, 0.88, -0.35], ["C", 0.8, -0.75, 0.4, -0.6, 0.12, -0.3], ["L", 0.12, -0.1], ["C", 0.35, -0.35, 0.62, -0.42, 0.65, -0.25], ["C", 0.68, -0.05, 0.4, 0.2, 0.12, 0.4], ["Z"]]), width: 0.9 };
  const NATURAL = { lines: [[0.12, -1.3, 0.12, 0.55], [0.68, -0.55, 0.68, 1.3]], bars: [[-0.2, -0.4], [0.5, 0.3]], width: 0.8 };
  const Q_REST = P([["M", 0.3, -1.55], ["L", 1.05, -0.68], ["C", 0.72, -0.38, 0.58, -0.12, 0.65, 0.18], ["L", 1.05, 0.68], ["C", 0.62, 0.52, 0.32, 0.72, 0.62, 1.48],
    ["C", -0.02, 0.98, 0.06, 0.28, 0.72, 0.42], ["L", 0.08, -0.2], ["C", 0.5, -0.5, 0.55, -0.8, 0.3, -1.15], ["Z"]]);
  const FLAG = P([["M", 0, 0], ["C", 0.1, 0.95, 1.3, 1.3, 1.0, 2.9], ["C", 1.0, 3.0, 0.9, 3.0, 0.9, 2.85], ["C", 1.05, 1.75, 0.45, 1.45, 0, 1.2], ["Z"]]);
  const ACC_W = { 1: 1.15, 2: 1.0, "-1": 1.05, "-2": 1.65, 0: 1.0 };

  // Helvetica's character widths (the standard AFM metrics, 1/1000 em) for 32..126 - for centring text
  const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
    278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667,
    944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500,
    278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  const FONT_SCALE = { H: 1, HB: 1.07, HO: 1, TB: 0.97, TR: 0.9, TI: 0.88 };
  function textWidth(s, f, z) {
    let w = 0;
    for (const ch of String(s)) { const c = ch.charCodeAt(0); w += c >= 32 && c <= 126 ? HELV[c - 32] : 556; }
    return w / 1000 * z * (FONT_SCALE[f] || 1);
  }

  // ───────────────────────────── the engraver ─────────────────────────────
  const DEF = { pageW: 595.28, pageH: 841.89, ml: 46, mr: 40, mt: 44, mb: 46, sp: 5.0 };
  const HEAD_W = 1.18, STEM_W = 0.12, BEAM_T = 0.48, BEAM_STEP = 0.75;

  function render(input, options) {
    const o = Object.assign({}, DEF, options || {});
    const S = typeof input === "string" || input == null ? parse(input || "") : input;
    const sp = o.sp;
    const title = (S.title && S.title[0]) || String(o.title || "").trim();
    const result = { pages: [], title, voices: S.voices.length, measures: S.measureCount || 0, systems: 0, warnings: (S.warnings || []).slice(), empty: false };
    const pw = o.pageW, ph = o.pageH;
    if (!S.voices.length || !S.measureCount) {
      result.empty = true;
      const ops = [];
      if (title) ops.push({ t: "t", x: pw / 2, y: o.mt + 20, s: title, f: "TB", z: 18, a: "m" });
      ops.push({ t: "t", x: pw / 2, y: o.mt + 60, s: "No notes in this score.", f: "HO", z: 11, a: "m", g: 0.4 });
      result.pages.push({ w: pw, h: ph, ops });
      return result;
    }
    const V = S.voices, M = S.measureCount;
    const pos = (v, pt) => pt.d - CLEF_BOTTOM[v.clef.name] - 7 * (v.clef.oct || 0);   // staff position, 0 = bottom line
    const Y = (p) => (4 - p / 2) * sp;                  // y of a staff position (top line = 0)

    // measure info (from the first voice; the strongest bar line of any voice)
    const rank = { "|": 0, "||": 1, ":|": 3, "|]": 2 };
    const info = [];
    for (let i = 0; i < M; i++) {
      const m0 = V[0].measures[i];
      let bar = m0.rightBar || "|";
      V.forEach((v) => { const b = v.measures[i].rightBar || "|"; if (rank[b] > rank[bar]) bar = b; });
      if (i === M - 1 && bar !== ":|") bar = "|]";
      info.push({ i, meter: m0.meter, key: m0.key, bar, startRepeat: V.some((v) => v.measures[i].startRepeat), ending: V.map((v) => v.measures[i].ending).find(Boolean) || null,
        section: S.sections[i] || null });
    }

    // pieces: each event as written notes (tied when split), with accidentals, stems and beams
    const flat = V.map(() => []);
    const pcs = V.map((v, vi) => info.map((inf, i) => {
      const meas = v.measures[i], bar = barTicks(inf.meter), out = [];
      const evs = meas.events;
      if (evs.length === 1 && evs[0].type === "rest" && (evs[0].bar || (bar && evs[0].dur >= bar))) {
        out.push({ barRest: true, onset: 0, dur: evs[0].dur, ev: evs[0], vi, i, invisible: evs[0].invisible });
        return out;
      }
      let t = 0;
      evs.forEach((e) => {
        const parts = e.tuplet ? [single(e.written || e.dur)] : e.bar ? [{ val: e.dur, base: 1920, dots: 0 }] : split(e.dur);
        let on = t;
        parts.forEach((pt, k) => {
          const d = e.tuplet ? Math.round(pt.val * e.tuplet.q / e.tuplet.p) : pt.val;
          const pc = { onset: on, dur: d, base: pt.base, dots: pt.dots, ev: e, first: k === 0, last: k === parts.length - 1, vi, i,
            rest: e.type === "rest", invisible: !!e.invisible };
          out.push(pc); flat[vi].push(pc);
          on += d;
        });
        t += e.dur;
      });
      return out;
    }));

    // accidentals shown, stem directions, beam groups (per voice, per measure)
    V.forEach((v, vi) => {
      info.forEach((inf, i) => {
        const list = pcs[vi][i], state = {};
        const keyAlter = (L) => (inf.key.acc[L] || 0);
        list.forEach((pc) => {
          if (pc.rest || pc.barRest) return;
          pc.heads = pc.ev.pitches.map((pt) => ({ pt, p: pos(v, pt) }));
          pc.accs = pc.heads.map((h) => {
            const pt = h.pt;
            if (!pc.first) return null;
            if (pt.tieIn) return null;                   // the tied-over note: no sign (and the bar's state keeps the key)
            const curA = pt.d in state ? state[pt.d] : keyAlter(pt.L);
            if (pt.a === curA) return null;
            state[pt.d] = pt.a;
            return pt.a;
          });
          const ps = pc.heads.map((h) => h.p);
          pc.hi = Math.max.apply(null, ps); pc.lo = Math.min.apply(null, ps);
          pc.up = (pc.hi - 4) < (4 - pc.lo);
          // accidental columns (top to bottom; a column is free when the last sign in it is 6 steps away)
          const order = pc.heads.map((h, k) => k).filter((k) => pc.accs[k] != null).sort((a, b) => pc.heads[b].p - pc.heads[a].p);
          const cols = [];
          pc.accCol = pc.heads.map(() => 0);
          order.forEach((k) => {
            let c = 0;
            while (cols[c] != null && cols[c] - pc.heads[k].p < 6) c++;
            cols[c] = pc.heads[k].p; pc.accCol[k] = c;
          });
          pc.accW = order.length ? order.reduce((w, k) => Math.max(w, (pc.accCol[k] + 1) * 1.0 + ACC_W[pc.accs[k]] - 1.0), 0) + 0.2 : 0;
        });
        // beams: notes of an eighth or shorter, within one beat (a tuplet beams as one), broken by a space in the ABC
        const bt = beatTicks(inf.meter), groups = [];
        let g = null;
        list.forEach((pc) => {
          const ok = !pc.rest && !pc.barRest && beamsOf(pc.base) >= 1;
          const beat = pc.ev.tuplet ? "t" + pc.ev.tuplet.id : Math.floor(pc.onset / bt);
          if (ok && g && g.beat === beat && !(pc.first && pc.ev.beamBreak && !pc.ev.tuplet)) { g.list.push(pc); return; }
          if (g && g.list.length > 1) groups.push(g.list);
          g = ok ? { beat, list: [pc] } : null;
        });
        if (g && g.list.length > 1) groups.push(g.list);
        groups.forEach((gr) => {
          const hi = Math.max.apply(null, gr.map((pc) => pc.hi)), lo = Math.min.apply(null, gr.map((pc) => pc.lo));
          const up = (hi - 4) < (4 - lo);
          gr.forEach((pc) => { pc.beam = gr; pc.up = up; });
        });
        inf.groups = inf.groups || [];
        inf.groups[vi] = groups;
      });
    });
    // tie links across the voice
    flat.forEach((list) => list.forEach((pc, k) => {
      if (pc.rest || !pc.heads) return;
      pc.heads.forEach((h, hk) => {
        const internal = !pc.last;
        if (!(internal || h.pt.tieOut)) return;
        const nx = list.slice(k + 1).find((q) => !q.rest);
        if (!nx || !nx.heads) return;
        const tk = nx.heads.findIndex((q) => q.pt.d === h.pt.d);
        if (tk < 0) return;
        if (!internal && nx !== list[k + 1]) return;     // a rest between: no tie
        (pc.tieTo = pc.tieTo || [])[hk] = { pc: nx, hk: tk };
        (nx.tieFrom = nx.tieFrom || [])[tk] = { pc, hk };
      });
    }));

    // horizontal spacing: the onsets of every voice in a measure share columns
    const spring = (d) => Math.max(1.75, 0.9 + 1.9 * Math.sqrt(Math.max(d, 15) / 480));
    info.forEach((inf, i) => {
      const at = {};
      let end = 0;
      V.forEach((v, vi) => pcs[vi][i].forEach((pc) => {
        end = Math.max(end, pc.onset + pc.dur);
        if (pc.barRest) return;
        const c = at[pc.onset] || (at[pc.onset] = { t: pc.onset, acc: 0, after: 0 });
        c.acc = Math.max(c.acc, pc.accW || 0);
        let after = 0;
        if (pc.dots) after += 0.35 + 0.5 * pc.dots;
        if (!pc.rest && !pc.beam && beamsOf(pc.base) >= 1 && pc.up) after = Math.max(after, 0.7);
        if (!pc.rest && !pc.beam && beamsOf(pc.base) >= 1 && !pc.up) after = Math.max(after, 0.45);
        if (pc.heads && pc.up && pc.heads.some((h, k) => k && h.p - pc.heads[k - 1].p === 1)) after = Math.max(after, 1.0);
        c.after = Math.max(c.after, after);
      }));
      const cols = Object.keys(at).map((k) => at[k]).sort((a, b) => a.t - b.t);
      cols.forEach((c, k) => { c.spring = spring((k + 1 < cols.length ? cols[k + 1].t : end) - c.t); });
      inf.cols = cols; inf.end = end;
      inf.fixed = 1.0 + cols.reduce((a, c) => a + c.acc + c.after, 0);
      inf.stretch = cols.reduce((a, c) => a + c.spring, 0);
      if (!cols.length) { inf.fixed = 1.0; inf.stretch = Math.max(5.0, spring(end || WHOLE)); }
      if (inf.startRepeat) inf.fixed += 1.4;
    });

    // 2.733.0 (Tim: "add media buttons ... and highlight the notes as the song is played"): THE TIMING - each bar's start in
    // ticks (its own length: the longest voice, else the meter's bar), each written note an id + its time (the SVG
    // marks its head data-n), and the notes to sound (a tie holds the note on, it is not struck again)
    const barT = [];
    let tAt = 0;
    info.forEach((inf) => { barT.push(tAt); tAt += inf.end > 0 ? inf.end : (barTicks(inf.meter) || WHOLE); });
    const timing = { total: tAt, bars: [], notes: [], sound: [] };
    const SEMI = [0, 2, 4, 5, 7, 9, 11];
    V.forEach((v, vi) => {
      const ringing = {};                                  // midi -> the sound note a tie extends
      info.forEach((inf, i) => pcs[vi][i].forEach((pc) => {
        if (pc.rest || pc.barRest || !pc.heads) return;
        const t0 = barT[i] + pc.onset, t1 = t0 + pc.dur;
        timing.notes.push({ id: -1, v: vi, bar: i, t0, t1, pc });
        pc.heads.forEach((h) => {
          const midi = 12 * (h.pt.o + 1) + SEMI[LETTERS.indexOf(h.pt.L)] + h.pt.a;
          const held = (!pc.first || h.pt.tieIn) && ringing[midi] && ringing[midi].t1 === t0;
          if (held) ringing[midi].t1 = t1;
          else { const s2 = { v: vi, midi, t0, t1 }; timing.sound.push(s2); ringing[midi] = s2; }
        });
      }));
    });
    timing.sound.sort((a, b) => a.t0 - b.t0 || a.midi - b.midi);
    // the notes in time order across the voices; a note's id = its place (the SVG head's data-n)
    timing.notes.sort((a, b) => a.t0 - b.t0 || a.v - b.v);
    timing.notes.forEach((n, k) => { n.id = k; n.pc.nid = k; delete n.pc; });
    const qBeat = S.tempo && S.tempo.beat ? S.tempo.beat : WHOLE / 4;
    timing.qpm = S.tempo && S.tempo.bpm ? S.tempo.bpm * qBeat / (WHOLE / 4) : 120;
    timing.tempoGiven = !!(S.tempo && S.tempo.bpm);
    timing.tpq = WHOLE / 4;                               // ticks a quarter note
    timing.seconds = timing.total / timing.tpq * 60 / timing.qpm;
    timing.barStarts = barT;
    result.timing = timing;

    // what a measure needs in front of it when it does not start a system (a key / meter change)
    const keyW = (k) => Math.abs(k.count) * 1.0;
    const sameMeter = (a, b) => (!a && !b) || (a && b && a.n === b.n && a.d === b.d);
    function changeW(i) {
      if (i === 0) return 0;
      let w = 0;
      const a = info[i - 1], b = info[i];
      if (a.key.count !== b.key.count) w += cancelCount(a.key, b.key) * 1.0 + keyW(b.key) + 0.8;
      if (!sameMeter(a.meter, b.meter) && b.meter) w += 2.4;
      return w;
    }
    function cancelCount(a, b) {
      if (!a.count) return 0;
      if (b.count && Math.sign(a.count) === Math.sign(b.count)) return Math.max(0, Math.abs(a.count) - Math.abs(b.count));
      return Math.abs(a.count);
    }
    const contentW = (pw - o.ml - o.mr) / sp;            // in staff spaces
    const names = V.length > 1 || V.some((v) => v.name);
    const nameW = (first) => (names ? Math.max.apply(null, V.map((v) => textWidth(first ? (v.name || v.snm || "") : (v.snm || v.name || ""), "H", first ? 9 : 8))) / sp : 0);
    const bracketW = V.length > 1 ? 1.4 : 0;
    function headerW(i, first) {
      const inf = info[i];
      let w = 0.6 + (V.some((v) => v.clef.name === "bass") ? F_CLEF.width : G_CLEF.width) + 0.7;
      w += keyW(inf.key) + (inf.key.count ? 0.6 : 0);
      const showMeter = inf.meter && (first || (i > 0 && !sameMeter(info[i - 1].meter, inf.meter)) || i === 0);
      if (showMeter) w += Math.max(1.6, textWidth(inf.meter.top, "TB", 2.96)) + 0.9;
      return w;
    }

    // line breaking: the least ragged set of systems (each as full as it can be; a break at a phrase - a section or
    // every 4 bars, YuE2's lines - is preferred), then every system but a short last one is justified
    const best = new Array(M + 1).fill(Infinity), prev = new Array(M + 1).fill(-1);
    best[0] = 0;
    const availAt = (a) => contentW - ((nameW(a === 0) ? nameW(a === 0) + 0.8 : 0) + bracketW) - headerW(a, a === 0);
    for (let a = 0; a < M; a++) {
      if (best[a] === Infinity) continue;
      const avail = availAt(a);
      let used = 0;
      for (let b = a + 1; b <= M; b++) {
        const j = b - 1;
        used += info[j].fixed + info[j].stretch + (j === a ? 0 : changeW(j));
        if (used > avail && b > a + 1) break;
        const last = b === M, ratio = used / avail;
        let cost = 0.2 + (last ? (ratio < 0.4 ? (0.4 - ratio) * 2 : 0) : Math.pow(1 - ratio, 2) * 10);
        if (used > avail) cost += 100;
        if (!last && !(info[b].section || b % 4 === 0)) cost += 0.15;
        if (best[a] + cost < best[b]) { best[b] = best[a] + cost; prev[b] = a; }
      }
    }
    const cuts = [];
    for (let b = M; b > 0; b = prev[b]) cuts.unshift(prev[b]);
    const systems = [];
    cuts.forEach((a, k) => {
      const b = k + 1 < cuts.length ? cuts[k + 1] : M;
      const first = a === 0, ind = (nameW(first) ? nameW(first) + 0.8 : 0) + bracketW, hw = headerW(a, first);
      const avail = contentW - ind - hw;
      let fixed = 0, stretch = 0;
      for (let j = a; j < b; j++) { fixed += info[j].fixed + (j === a ? 0 : changeW(j)); stretch += info[j].stretch; }
      const last = b >= M;
      let f = stretch > 0 ? (avail - fixed) / stretch : 1;
      if (last && f > 1 && (fixed + stretch) / avail < 0.68) f = 1;
      systems.push({ start: a, end: b, first, ind, hw, f: Math.max(0.35, f), last });
    });
    result.systems = systems.length;

    // ── draw one staff of one system, y relative to its top line ──
    function engraveStaff(sy, vi) {
      const v = V[vi], ops = [], box = { top: 0, bottom: 4 * sp };
      const fill = (d) => ops.push({ t: "p", d, fill: true });
      const stroke = (d, w, cap) => ops.push({ t: "p", d, stroke: true, w: w * sp, cap: cap || 0 });
      const grow = (y) => { if (y < box.top) box.top = y; if (y > box.bottom) box.bottom = y; };
      const x0 = o.ml + sy.ind * sp, xEnd = sy.xEnd;
      for (let l = 0; l < 5; l++) stroke([["M", x0, l * sp], ["L", xEnd, l * sp]], 0.11);
      // clef, key, meter
      const cx = x0 + 0.6 * sp;
      drawClef(ops, v.clef, cx, sp, Y);
      const inf0 = info[sy.start];
      let kx = x0 + sy.clefW * sp;
      kx = drawKey(ops, v.clef, inf0.key, kx, sp, Y, null);
      if (sy.showMeter) drawMeter(ops, inf0.meter, sy.meterX, sp);
      // measures
      const chordQ = [], annotQ = [], tieQ = [], tupQ = {}, slurOpen = [];
      for (let i = sy.start; i < sy.end; i++) {
        const inf = info[i], mx = sy.mx[i], mw = sy.mw[i];
        let px = mx;
        if (i > sy.start) {                              // a key / meter change inside the system
          const a = info[i - 1];
          if (a.key.count !== inf.key.count) px = drawKey(ops, v.clef, inf.key, px + 0.5 * sp, sp, Y, a.key);
          if (!sameMeter(a.meter, inf.meter) && inf.meter) { drawMeter(ops, inf.meter, px + 1.2 * sp, sp); px += 2.4 * sp; }
        }
        if (inf.startRepeat) { drawBar(ops, i === sy.start ? px : mx, "|:", sp); px += 1.4 * sp; }
        drawBar(ops, mx + mw, inf.bar, sp);
        const colX = {};
        let x = px + 1.0 * sp;
        inf.cols.forEach((c) => { x += c.acc * sp; colX[c.t] = x; x += (c.spring * sy.f + c.after) * sp; });
        pcs[vi][i].forEach((pc) => {
          if (pc.barRest) {
            if (pc.invisible) return;
            const left = px + 0.4 * sp, right = mx + mw;
            const rx = (left + right) / 2 - 0.6 * sp;
            fill(rect(rx, Y(6), 1.2 * sp, 0.5 * sp));
            pc.x = rx;
            return;
          }
          const xx = colX[pc.onset];
          pc.x = xx;
          if (pc.rest) { if (!pc.invisible) drawRest(ops, pc, xx, sp, Y); }
          else drawNote(ops, pc, xx, sp, Y, grow);
          if (pc.first && pc.ev.chord) chordQ.push({ x: xx, s: pc.ev.chord });
          if (pc.first && pc.ev.annot) annotQ.push({ x: xx, s: pc.ev.annot });
          if (pc.ev.tuplet && !pc.rest) (tupQ[pc.ev.tuplet.id] = tupQ[pc.ev.tuplet.id] || { p: pc.ev.tuplet.p, list: [] }).list.push(pc);
          if (pc.ev.tuplet && pc.rest) (tupQ[pc.ev.tuplet.id] = tupQ[pc.ev.tuplet.id] || { p: pc.ev.tuplet.p, list: [] }).list.push(pc);
          if (pc.first && pc.ev.slurStart && !pc.rest) for (let k = 0; k < pc.ev.slurStart; k++) slurOpen.push(pc);
          if (pc.last && pc.ev.slurEnd && !pc.rest) for (let k = 0; k < pc.ev.slurEnd; k++) { const a = slurOpen.pop(); if (a) tieQ.push({ slur: true, a, b: pc }); }
          if (pc.tieTo) tieQ.push({ a: pc });
          if (pc.tieFrom && pc.tieFrom.some((t) => t && sysOf(t.pc) !== sy)) tieQ.push({ inbound: true, b: pc });
        });
        // stems + flags (single) and beams (groups)
        (inf.groups[vi] || []).forEach((gr) => drawBeam(ops, gr, sp, Y, grow));
        pcs[vi][i].forEach((pc) => { if (!pc.rest && !pc.barRest && !pc.beam && pc.base < 1920) drawStem(ops, pc, sp, Y, grow); });
        if (pc0Ending(inf) && vi === 0) sy.endings.push({ i, x: mx, w: mw, label: inf.ending });
      }
      slurOpen.forEach((a) => tieQ.push({ slur: true, a, b: null }));
      // tuplets
      Object.keys(tupQ).forEach((id) => drawTuplet(ops, tupQ[id], sp, Y, grow));
      // ties and slurs
      tieQ.forEach((t) => drawTie(ops, t, sy, sp, Y, grow, x0 + sy.hw * sp));
      // text above: chord symbols, annotations (after the notes, so they clear them)
      let line = Math.min(-1.7 * sp, box.top - 0.9 * sp);
      if (chordQ.length) {
        chordQ.forEach((c) => ops.push({ t: "t", x: c.x, y: line, s: c.s, f: "HB", z: 9 }));
        grow(line - 9); line -= 11;
      }
      if (annotQ.length) { annotQ.forEach((c) => ops.push({ t: "t", x: c.x, y: line, s: c.s, f: "HO", z: 8.5 })); grow(line - 9); line -= 10.5; }
      return { ops, box, textLine: line };
    }
    const sysOfPiece = new Map();
    function sysOf(pc) { return sysOfPiece.get(pc.i); }
    const pc0Ending = (inf) => !!inf.ending;

    // geometry of each system
    systems.forEach((sy) => {
      const x0 = o.ml + sy.ind * sp;
      sy.clefW = 0.6 + (V.some((v) => v.clef.name === "bass") ? F_CLEF.width : G_CLEF.width) + 0.7;
      const inf0 = info[sy.start];
      const kEnd = sy.clefW + keyW(inf0.key) + (inf0.key.count ? 0.6 : 0);
      sy.showMeter = !!inf0.meter && (sy.first || sy.start === 0 || (sy.start > 0 && !sameMeter(info[sy.start - 1].meter, inf0.meter)));
      const mW = sy.showMeter ? Math.max(1.6, textWidth(inf0.meter.top, "TB", 2.96)) : 0;
      sy.meterX = x0 + (kEnd + mW / 2) * sp;
      sy.mx = {}; sy.mw = {}; sy.endings = [];
      let x = x0 + sy.hw * sp;
      for (let i = sy.start; i < sy.end; i++) {
        const w = (info[i].fixed + (i > sy.start ? changeW(i) : 0) + info[i].stretch * sy.f) * sp;
        sy.mx[i] = x; sy.mw[i] = w; x += w;
        sysOfPiece.set(i, sy);
      }
      sy.xEnd = x;
    });

    // engrave, stack the staves, place the systems on pages
    const titleOps = [];
    let ty = o.mt;
    if (title) { ty += 18; titleOps.push({ t: "t", x: pw / 2, y: ty, s: title, f: "TB", z: 18, a: "m" }); ty += 6; }
    (S.title || []).slice(1, 2).forEach((sub) => { ty += 14; titleOps.push({ t: "t", x: pw / 2, y: ty, s: sub, f: "TR", z: 12, a: "m" }); });
    if (S.composer) { ty += 14; titleOps.push({ t: "t", x: pw - o.mr, y: ty, s: S.composer, f: "TR", z: 10, a: "e" }); }
    const tempo = S.tempo;
    if (title || S.composer || (S.title || []).length > 1) ty += 10;

    const pages = [];
    let page = { w: pw, h: ph, ops: titleOps.slice() };
    pages.push(page);
    let y = ty;
    const bottom = ph - o.mb - 14;
    systems.forEach((sy, si) => {
      const staves = V.map((v, vi) => engraveStaff(sy, vi));
      // staff tops, relative to the first staff's top line
      const off = [0];
      for (let k = 1; k < staves.length; k++) off.push(off[k - 1] + Math.max(10 * sp, staves[k - 1].box.bottom - staves[k].box.top + 1.6 * sp));
      const above = [];
      // the section label (a boxed rehearsal mark), endings and the tempo over the first staff
      const topLine = staves[0].textLine, markBase = topLine - 1;
      const marks = [];
      for (let i = sy.start; i < sy.end; i++) if (info[i].section) marks.push({ x: sy.mx[i] + 0.3 * sp, s: niceLabel(info[i].section) });
      const showTempo = si === 0 && tempo;
      const x0s = o.ml + sy.ind * sp;
      const tempoW = showTempo ? (tempo.text ? textWidth(tempo.text, "HB", 10) + 6 : 0) + (tempo.bpm ? 40 : 0) : 0;
      const tempoBase = showTempo && marks.some((mk) => mk.x < x0s + tempoW + 6) ? markBase - 17 : markBase;
      const endBase = marks.length ? markBase - 17 : markBase;
      let need = staves[0].box.top;
      if (marks.length) need = Math.min(need, markBase - 12);
      if (showTempo) need = Math.min(need, tempoBase - 12);
      if (sy.endings.length) need = Math.min(need, endBase - 8);
      const sysTop = need;                                 // relative to the first top line
      const sysBottom = off[off.length - 1] + staves[staves.length - 1].box.bottom;
      const h = sysBottom - sysTop;
      const gap = si === 0 ? 4 : 2.2 * sp;
      if (page.nsys && y + gap + h > bottom) { page = { w: pw, h: ph, ops: [] }; pages.push(page); y = o.mt; }
      page.nsys = (page.nsys || 0) + 1;
      (page.ranges = page.ranges || []).push([page.ops.length, 0]);
      const top = y + gap - sysTop;                       // the first staff's top line on the page
      staves.forEach((st, k) => st.ops.forEach((op) => page.ops.push(shift(op, top + off[k]))));
      // labels above: rehearsal marks, endings
      marks.forEach((mk) => {
        const w = textWidth(mk.s, "HB", 10) + 6;
        page.ops.push({ t: "p", d: rect(mk.x - 1, top + markBase - 11, w, 14.5), stroke: true, w: 0.8 });
        page.ops.push({ t: "t", x: mk.x + 2, y: top + markBase, s: mk.s, f: "HB", z: 10 });
      });
      sy.endings.forEach((en) => {
        const ey = top + endBase;
        page.ops.push({ t: "p", d: [["M", en.x + 0.3 * sp, ey + 6], ["L", en.x + 0.3 * sp, ey - 6], ["L", en.x + en.w - 0.6 * sp, ey - 6]], stroke: true, w: 0.8 });
        page.ops.push({ t: "t", x: en.x + 0.8 * sp, y: ey + 3, s: String(en.label).replace(/,/g, ", ") + ".", f: "H", z: 8 });
      });
      if (showTempo) {
        const tx = o.ml + sy.ind * sp, tyy = top + tempoBase;
        let xx = tx;
        if (tempo.text) { page.ops.push({ t: "t", x: xx, y: tyy, s: tempo.text, f: "HB", z: 10 }); xx += textWidth(tempo.text, "HB", 10) + 6; }
        if (tempo.bpm) {
          const bt = tempo.beat || 480;
          const sv = single(bt);
          const s2 = 0.62;                                // a small note: the beat's value
          const hy = tyy - 2.5, hx = xx;
          page.ops.push({ t: "p", d: noteheadPath(hx, hy, sp * s2, sv.base), fill: true, eo: sv.base >= 960 });
          if (sv.base < 1920) page.ops.push({ t: "p", d: rect(hx + HEAD_W * sp * s2 - STEM_W * sp, hy - 3.3 * sp * s2, STEM_W * sp, 3.3 * sp * s2), fill: true });
          if (beamsOf(sv.base)) page.ops.push({ t: "p", d: tf(FLAG, hx + HEAD_W * sp * s2 - STEM_W * sp / 2, hy - 3.3 * sp * s2, sp * s2), fill: true });
          let dx = HEAD_W * sp * s2 + (beamsOf(sv.base) ? 0.9 * sp * s2 : 0) + 3;
          if (sv.dots) { page.ops.push({ t: "p", d: circle(hx + dx, hy, 0.2 * sp * s2 * 1.4), fill: true }); dx += 3; }
          page.ops.push({ t: "t", x: hx + dx + 1, y: tyy, s: "= " + tempo.bpm, f: "HB", z: 10 });
        }
      }
      // the system: the line joining the staves, the bracket, the names, the measure number
      const x0 = o.ml + sy.ind * sp;
      const yTop = top, yBot = top + off[off.length - 1] + 4 * sp;
      if (V.length > 1) {
        page.ops.push({ t: "p", d: [["M", x0, yTop], ["L", x0, yBot]], stroke: true, w: 0.16 * sp });
        const bx = x0 - 0.9 * sp;
        page.ops.push({ t: "p", d: rect(bx - 0.5 * sp, yTop - 0.5 * sp, 0.5 * sp, yBot - yTop + sp), fill: true });
        page.ops.push({ t: "p", d: [["M", bx - 0.5 * sp, yTop - 0.5 * sp], ["C", bx + 0.2 * sp, yTop - 0.5 * sp, bx + 0.9 * sp, yTop - 0.8 * sp, bx + 1.3 * sp, yTop - 1.5 * sp], ["C", bx + 0.9 * sp, yTop - 0.6 * sp, bx + 0.2 * sp, yTop - 0.2 * sp, bx - 0.5 * sp, yTop - 0.2 * sp], ["Z"]], fill: true });
        page.ops.push({ t: "p", d: [["M", bx - 0.5 * sp, yBot + 0.5 * sp], ["C", bx + 0.2 * sp, yBot + 0.5 * sp, bx + 0.9 * sp, yBot + 0.8 * sp, bx + 1.3 * sp, yBot + 1.5 * sp], ["C", bx + 0.9 * sp, yBot + 0.6 * sp, bx + 0.2 * sp, yBot + 0.2 * sp, bx - 0.5 * sp, yBot + 0.2 * sp], ["Z"]], fill: true });
      }
      if (names) V.forEach((v, k) => {
        const nm = sy.first ? (v.name || v.snm || "") : (v.snm || v.name || "");
        if (nm) page.ops.push({ t: "t", x: x0 - bracketW * sp - 0.6 * sp, y: top + off[k] + 2 * sp + 3, s: nm, f: "H", z: sy.first ? 9 : 8, a: "e" });
      });
      if (sy.start > 0) page.ops.push({ t: "t", x: x0 + 0.1 * sp, y: top - 1.4 * sp, s: String(sy.start + 1), f: "HO", z: 7, g: 0.25 });
      y = top + sysBottom;
      page.ranges[page.ranges.length - 1][1] = page.ops.length;
      for (let i = sy.start; i < sy.end; i++) {            // 2.733.0: where each bar is (the player's highlight)
        (page.bars = page.bars || []).push({ i, sys: page.ranges.length - 1, x0: sy.mx[i], x1: sy.mx[i] + sy.mw[i], y0: top - 1.2 * sp, y1: yBot + 1.2 * sp });
      }
      page.lastY = y;
    });
    // a full page spreads its systems down to the bottom margin (never the last page)
    pages.forEach((pg, k) => {
      const n = (pg.ranges || []).length;
      if (k === pages.length - 1 || n < 2) return;
      const extra = bottom - pg.lastY;
      if (!(extra > 0) || extra > (bottom - o.mt) * 0.45) return;
      const per = Math.min(40, extra / (n - 1));
      pg.ranges.forEach((r, j) => { if (j) for (let q = r[0]; q < r[1]; q++) pg.ops[q] = shift(pg.ops[q], per * j); });
      (pg.bars || []).forEach((b) => { if (b.sys) { b.y0 += per * b.sys; b.y1 += per * b.sys; } });
    });
    if (pages.length > 1) pages.forEach((pg, k) => pg.ops.push({ t: "t", x: pw / 2, y: ph - o.mb + 16, s: (k + 1) + " / " + pages.length, f: "H", z: 8, a: "m", g: 0.45 }));
    pages.forEach((pg) => { delete pg.nsys; delete pg.ranges; delete pg.lastY; });
    pages.forEach((pg, k) => (pg.bars || []).forEach((b) => {
      result.timing.bars[b.i] = { i: b.i, page: k, x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, t0: barT[b.i], t1: b.i + 1 < barT.length ? barT[b.i + 1] : result.timing.total };
    }));
    pages.forEach((pg) => { delete pg.bars; });
    result.pages = pages;
    return result;
  }

  function niceLabel(s) { const t = String(s).trim(); return t.charAt(0).toUpperCase() + t.slice(1); }
  function shift(op, dy) {
    if (op.t === "t") return Object.assign({}, op, { y: op.y + dy });
    return Object.assign({}, op, { d: op.d.map((c) => (c[0] === "Z" ? c : c[0] === "C" ? ["C", c[1], c[2] + dy, c[3], c[4] + dy, c[5], c[6] + dy] : [c[0], c[1], c[2] + dy])) });
  }

  // ── glyph drawing (y relative to the staff's top line) ──
  function drawClef(ops, clef, x, sp, Y) {
    if (clef.name === "bass") {
      const oy = Y(6);
      ops.push({ t: "p", d: tf(F_CLEF.main, x, oy, sp), stroke: true, w: 0.22 * sp, cap: 1 });
      ops.push({ t: "p", d: tf(F_CLEF.thick, x, oy, sp), stroke: true, w: 0.42 * sp, cap: 1 });
      ops.push({ t: "p", d: circle(x + F_CLEF.ball[0] * sp, oy + F_CLEF.ball[1] * sp, F_CLEF.ball[2] * sp), fill: true });
      F_CLEF.dots.forEach((d) => ops.push({ t: "p", d: circle(x + d[0] * sp, oy + d[1] * sp, 0.19 * sp), fill: true }));
    } else if (clef.name === "alto" || clef.name === "tenor") {
      const oy = Y(clef.name === "alto" ? 4 : 6);
      ops.push({ t: "p", d: rect(x, oy - 2 * sp, 0.45 * sp, 4 * sp), fill: true });
      ops.push({ t: "p", d: rect(x + 0.65 * sp, oy - 2 * sp, 0.15 * sp, 4 * sp), fill: true });
      ops.push({ t: "p", d: tf(C_CLEF_LOBE, x, oy, sp), stroke: true, w: 0.26 * sp, cap: 1 });
      ops.push({ t: "p", d: tf(C_CLEF_LOBE, x, oy, sp, 1, -1), stroke: true, w: 0.26 * sp, cap: 1 });
      ops.push({ t: "p", d: circle(x + 1.45 * sp, oy - 1.5 * sp, 0.28 * sp), fill: true });
      ops.push({ t: "p", d: circle(x + 1.45 * sp, oy + 1.5 * sp, 0.28 * sp), fill: true });
    } else {
      const oy = Y(2);
      ops.push({ t: "p", d: tf(G_CLEF.main, x, oy, sp), stroke: true, w: 0.17 * sp, cap: 1 });
      ops.push({ t: "p", d: tf(G_CLEF.thick, x, oy, sp), stroke: true, w: 0.34 * sp, cap: 1 });
      ops.push({ t: "p", d: circle(x + G_CLEF.ball[0] * sp, oy + G_CLEF.ball[1] * sp, G_CLEF.ball[2] * sp), fill: true });
      if (clef.oct) ops.push({ t: "t", x: x + 1.2 * sp, y: oy + (clef.oct < 0 ? 4.4 : -5.2) * sp, s: "8", f: "TI", z: 2.0 * sp, a: "m" });
    }
  }
  /** a bar line ending at x ("|", "||", "|]", ":|") or starting at x ("|:") */
  function drawBar(ops, x, type, sp) {
    const thin = (xx) => ops.push({ t: "p", d: rect(xx - 0.08 * sp, 0, 0.16 * sp, 4 * sp), fill: true });
    const thick = (xx) => ops.push({ t: "p", d: rect(xx, 0, 0.5 * sp, 4 * sp), fill: true });
    const dots = (xx) => { ops.push({ t: "p", d: circle(xx, 1.5 * sp, 0.22 * sp), fill: true }); ops.push({ t: "p", d: circle(xx, 2.5 * sp, 0.22 * sp), fill: true }); };
    if (type === "|:") { thick(x); thin(x + 0.85 * sp); dots(x + 1.3 * sp); return; }
    if (type === "||") { thin(x - 0.08 * sp); thin(x - 0.7 * sp); return; }
    if (type === "|]" || type === ":|") { thick(x - 0.5 * sp); thin(x - 0.85 * sp); if (type === ":|") dots(x - 1.3 * sp); return; }
    thin(x - 0.08 * sp);
  }
  const SHARP_POS = [8, 5, 9, 6, 3, 7, 4], FLAT_POS = [4, 7, 3, 6, 2, 5, 1];
  function keyPos(clef, sharp, k) {
    if (clef.name === "tenor" && sharp) return [2, 6, 3, 7, 4, 8, 5][k];
    const sh = clef.name === "bass" ? -2 : clef.name === "alto" ? -1 : clef.name === "tenor" ? 1 : 0;
    return (sharp ? SHARP_POS : FLAT_POS)[k] + sh;
  }
  /** the key signature at x (cancelling `from` first when it is given) -> the x after it */
  function drawKey(ops, clef, key, x, sp, Y, from) {
    let xx = x;
    if (from && from.count) {
      const cancel = key.count && Math.sign(from.count) === Math.sign(key.count) ? Math.max(0, Math.abs(from.count) - Math.abs(key.count)) : Math.abs(from.count);
      const startK = Math.abs(from.count) - cancel;
      for (let k = startK; k < Math.abs(from.count); k++) { drawAcc(ops, 0, xx, Y(keyPos(clef, from.count > 0, k)), sp); xx += 1.0 * sp; }
      if (cancel) xx += 0.4 * sp;
    }
    for (let k = 0; k < Math.abs(key.count); k++) { drawAcc(ops, key.count > 0 ? 1 : -1, xx, Y(keyPos(clef, key.count > 0, k)), sp); xx += 1.0 * sp; }
    return xx + (key.count ? 0.6 * sp : 0);
  }
  function drawMeter(ops, mt, cx, sp) {
    const z = 2.96 * sp;
    ops.push({ t: "t", x: cx, y: 2 * sp, s: mt.top, f: "TB", z, a: "m" });
    ops.push({ t: "t", x: cx, y: 4 * sp, s: String(mt.d), f: "TB", z, a: "m" });
  }
  function drawAcc(ops, a, x, y, sp) {
    const L = (l, w) => ops.push({ t: "p", d: [["M", x + l[0] * sp, y + l[1] * sp], ["L", x + l[2] * sp, y + l[3] * sp]], stroke: true, w: (w || 0.12) * sp });
    const bar = (b, x1, x2) => ops.push({ t: "p", d: poly([[x + x1 * sp, y + (b[0] + 0.13) * sp], [x + x2 * sp, y + (b[1] + 0.13) * sp], [x + x2 * sp, y + (b[1] - 0.13) * sp], [x + x1 * sp, y + (b[0] - 0.13) * sp]]), fill: true });
    if (a === 1) { SHARP.lines.forEach((l) => L(l)); SHARP.bars.forEach((b) => bar(b, 0, 0.95)); } else if (a === -1) {
      L(FLAT.stem, 0.13); ops.push({ t: "p", d: tf(FLAT.bowl, x, y, sp), fill: true });
    } else if (a === 0) { NATURAL.lines.forEach((l) => L(l)); NATURAL.bars.forEach((b) => bar(b, 0.12, 0.68)); } else if (a === 2) {
      L([0.05, -0.38, 0.75, 0.38], 0.16); L([0.05, 0.38, 0.75, -0.38], 0.16);
      [[0.05, -0.38], [0.75, -0.38], [0.05, 0.38], [0.75, 0.38]].forEach((c) => ops.push({ t: "p", d: rect(x + (c[0] - 0.12) * sp, y + (c[1] - 0.12) * sp, 0.24 * sp, 0.24 * sp), fill: true }));
    } else if (a === -2) { drawAcc(ops, -1, x, y, sp); drawAcc(ops, -1, x + 0.65 * sp, y, sp); }
  }
  function noteheadPath(x, y, sp, base) {
    if (base >= 1920) return ellipse(x + 0.78 * sp, y, 0.78 * sp, 0.47 * sp, 0).concat(ellipse(x + 0.78 * sp, y, 0.42 * sp, 0.27 * sp, 0.95));
    if (base >= 960) return ellipse(x + 0.59 * sp, y, 0.6 * sp, 0.41 * sp, -0.35).concat(ellipse(x + 0.59 * sp, y, 0.47 * sp, 0.2 * sp, -0.6));
    return ellipse(x + 0.59 * sp, y, 0.6 * sp, 0.41 * sp, -0.35);
  }
  function headX(pc, k, sp) {
    const h = pc.heads[k];
    if (!h.shift) return pc.x;
    return pc.up ? pc.x + (HEAD_W - STEM_W) * sp : pc.x - (HEAD_W - STEM_W) * sp;
  }
  function drawNote(ops, pc, x, sp, Y, grow) {
    // seconds in a chord: every other head of a step goes to the far side of the stem
    const idx = pc.heads.map((h, k) => k).sort((a, b) => pc.heads[a].p - pc.heads[b].p);
    pc.heads.forEach((h) => { h.shift = false; });
    if (pc.up) { for (let n = 1; n < idx.length; n++) { const a = pc.heads[idx[n - 1]], b = pc.heads[idx[n]]; if (b.p - a.p === 1 && !a.shift) b.shift = true; } } else {
      for (let n = idx.length - 2; n >= 0; n--) { const a = pc.heads[idx[n + 1]], b = pc.heads[idx[n]]; if (a.p - b.p === 1 && !a.shift) b.shift = true; }
    }
    const whole = pc.base >= 1920;
    const hw = (whole ? 1.56 : HEAD_W) * sp;
    pc.heads.forEach((h, k) => {
      const hx = headX(pc, k, sp), y = Y(h.p);
      h.y = y; h.x = hx;
      ops.push({ t: "p", d: noteheadPath(hx, y, sp, pc.base), fill: true, eo: pc.base >= 960, n: pc.nid });
      grow(y - 0.5 * sp); grow(y + 0.5 * sp);
      // ledger lines
      const lx1 = hx - 0.35 * sp, lx2 = hx + hw + 0.35 * sp;
      for (let p = 10; p <= h.p; p += 2) ops.push({ t: "p", d: [["M", lx1, Y(p)], ["L", lx2, Y(p)]], stroke: true, w: 0.16 * sp });
      for (let p = -2; p >= h.p; p -= 2) ops.push({ t: "p", d: [["M", lx1, Y(p)], ["L", lx2, Y(p)]], stroke: true, w: 0.16 * sp });
      // accidental
      const a = pc.accs[k];
      if (a != null) {
        const leftMost = Math.min.apply(null, pc.heads.map((q, j) => headX(pc, j, sp)));
        const ax = leftMost - 0.2 * sp - pc.accCol[k] * 1.0 * sp - ACC_W[a] * sp + 0.1 * sp;
        drawAcc(ops, a, ax, y, sp);
        grow(y - 1.9 * sp); grow(y + 1.4 * sp);
      }
      // dots (a head on a line puts its dot in the space above)
      for (let d = 0; d < pc.dots; d++) {
        const rightMost = Math.max.apply(null, pc.heads.map((q, j) => headX(pc, j, sp))) + hw;
        const dy = h.p % 2 === 0 ? y - 0.5 * sp : y;
        ops.push({ t: "p", d: circle(rightMost + (0.45 + 0.55 * d) * sp, dy, 0.19 * sp), fill: true });
      }
    });
  }
  function stemX(pc, sp) { return pc.up ? pc.x + (HEAD_W - STEM_W) * sp : pc.x; }
  function drawStem(ops, pc, sp, Y, grow) {
    const nb = beamsOf(pc.base);
    const top = Y(pc.hi), low = Y(pc.lo);
    let len = 3.5 + (nb > 2 ? (nb - 2) * 0.6 : 0);
    let tip = pc.up ? top - len * sp : low + len * sp;
    if (pc.up && tip > Y(4)) tip = Y(4);
    if (!pc.up && tip < Y(4)) tip = Y(4);
    const sx = stemX(pc, sp);
    const from = pc.up ? low - 0.15 * sp : top + 0.15 * sp;
    ops.push({ t: "p", d: rect(sx, Math.min(from, tip), STEM_W * sp, Math.abs(from - tip)), fill: true });
    pc.tip = tip; grow(tip);
    for (let k = 0; k < nb; k++) {
      const fy = pc.up ? tip + k * 0.8 * sp : tip - k * 0.8 * sp;
      ops.push({ t: "p", d: tf(FLAG, sx + STEM_W * sp, fy, sp, 1, pc.up ? 1 : -1), fill: true });
    }
  }
  function drawBeam(ops, gr, sp, Y, grow) {
    const up = gr[0].up;
    const xs = gr.map((pc) => stemX(pc, sp) + (up ? STEM_W * sp : 0));
    const near = gr.map((pc) => (up ? Y(pc.hi) : Y(pc.lo)));          // the head nearest the beam
    const far = gr.map((pc) => (up ? Y(pc.lo) : Y(pc.hi)));
    const levels = Math.max.apply(null, gr.map((pc) => beamsOf(pc.base)));
    const x1 = xs[0], x2 = xs[xs.length - 1];
    let dy = (near[near.length - 1] - near[0]) * 0.5;
    dy = Math.max(-1.0 * sp, Math.min(1.0 * sp, dy));
    const inner = near.slice(1, -1);
    if (inner.length && (up ? inner.some((y) => y < Math.min(near[0], near[near.length - 1])) : inner.some((y) => y > Math.max(near[0], near[near.length - 1])))) dy = 0;
    const slope = x2 > x1 ? dy / (x2 - x1) : 0;
    const minLen = (3.1 + (levels - 1) * 0.6) * sp;
    let b = up ? Infinity : -Infinity;
    gr.forEach((pc, k) => {
      const need = up ? near[k] - minLen : near[k] + minLen;
      const at = need - slope * (xs[k] - x1);
      b = up ? Math.min(b, at) : Math.max(b, at);
      const mid = Y(4) - slope * (xs[k] - x1);       // stems reach the middle line
      b = up ? Math.min(b, mid) : Math.max(b, mid);
    });
    const beamY = (x) => b + slope * (x - x1);
    gr.forEach((pc, k) => {
      const sx = stemX(pc, sp), tip = beamY(xs[k]);
      const from = up ? far[k] - 0.15 * sp : far[k] + 0.15 * sp;
      ops.push({ t: "p", d: rect(sx, Math.min(from, tip), STEM_W * sp, Math.abs(from - tip)), fill: true });
      pc.tip = tip; grow(tip);
    });
    const T = BEAM_T * sp, dir = up ? 1 : -1;
    const seg = (xa, xb, lvl) => {
      const o1 = dir * lvl * BEAM_STEP * sp;
      const ya = beamY(xa) + o1, yb = beamY(xb) + o1;
      ops.push({ t: "p", d: poly([[xa, ya], [xb, yb], [xb, yb + dir * T], [xa, ya + dir * T]]), fill: true });
    };
    seg(x1, x2, 0);
    for (let L = 2; L <= levels; L++) {
      let k = 0;
      while (k < gr.length) {
        if (beamsOf(gr[k].base) < L) { k++; continue; }
        let j = k;
        while (j + 1 < gr.length && beamsOf(gr[j + 1].base) >= L) j++;
        if (j > k) seg(xs[k], xs[j], L - 1); else {
          const stub = Math.min(1.1 * sp, (k > 0 ? xs[k] - xs[k - 1] : xs[k + 1] - xs[k]) * 0.5);
          if (k === 0) seg(xs[k], xs[k] + stub, L - 1); else seg(xs[k] - stub, xs[k], L - 1);
        }
        k = j + 1;
      }
    }
  }
  function drawRest(ops, pc, x, sp, Y) {
    const b = pc.base, mid = Y(4);
    if (b >= 1920) ops.push({ t: "p", d: rect(x, Y(6), 1.2 * sp, 0.5 * sp), fill: true });
    else if (b >= 960) ops.push({ t: "p", d: rect(x, mid - 0.5 * sp, 1.2 * sp, 0.5 * sp), fill: true });
    else if (b >= 480) ops.push({ t: "p", d: tf(Q_REST, x, mid, sp), fill: true });
    else {
      const n = beamsOf(b);
      const top = -0.85 - (n - 1) * 0.5;
      const sxAt = (yy) => 1.05 - 0.29 * (yy - top);
      const bottomY = 1.1 + (n - 1) * 0.5;
      ops.push({ t: "p", d: [["M", x + sxAt(top) * sp, mid + top * sp], ["L", x + sxAt(bottomY) * sp, mid + bottomY * sp]], stroke: true, w: 0.14 * sp, cap: 1 });
      for (let k = 0; k < n; k++) {
        const fy = top + 0.3 + k * 1.0, sx = sxAt(fy - 0.2);
        const bx = sx - 0.78;
        ops.push({ t: "p", d: circle(x + bx * sp, mid + fy * sp, 0.27 * sp), fill: true });
        ops.push({ t: "p", d: [["M", x + (bx + 0.05) * sp, mid + (fy + 0.22) * sp], ["C", x + (bx + 0.35) * sp, mid + (fy + 0.42) * sp, x + (sx - 0.2) * sp, mid + (fy + 0.2) * sp, x + sx * sp, mid + (fy - 0.2) * sp]], stroke: true, w: 0.14 * sp, cap: 1 });
      }
    }
    for (let d = 0; d < pc.dots; d++) ops.push({ t: "p", d: circle(x + (1.5 + 0.55 * d) * sp, Y(5), 0.19 * sp), fill: true });
  }
  function drawTuplet(ops, tq, sp, Y, grow) {
    const list = tq.list.filter((pc) => pc.x != null);
    if (!list.length) return;
    const notes = list.filter((pc) => !pc.rest);
    const up = notes.length ? notes.filter((pc) => pc.up).length * 2 >= notes.length : true;
    const xa = list[0].x, xb = list[list.length - 1].x + HEAD_W * sp;
    const beamed = notes.length === list.length && notes.length > 1 && notes.every((pc) => pc.beam && pc.beam === notes[0].beam) && notes[0].beam.length === notes.length;
    let y;
    if (up) { y = Math.min.apply(null, list.map((pc) => Math.min(pc.tip != null ? pc.tip : Y(pc.hi || 4), Y(pc.hi != null ? pc.hi : 4)))) - 1.3 * sp; y = Math.min(y, -1.2 * sp); } else {
      y = Math.max.apply(null, list.map((pc) => Math.max(pc.tip != null ? pc.tip : Y(pc.lo || 4), Y(pc.lo != null ? pc.lo : 4)))) + 1.3 * sp; y = Math.max(y, 5.2 * sp);
    }
    const cx = (xa + xb) / 2, z = 1.9 * sp;
    const ty = up ? y + 0.5 * sp : y + 0.7 * sp;
    ops.push({ t: "t", x: cx, y: ty, s: String(tq.p), f: "TI", z, a: "m" });
    grow(up ? y - 0.8 * sp : y + 1.2 * sp);
    if (!beamed) {
      const g = 0.9 * sp, hook = up ? 0.6 * sp : -0.6 * sp;
      ops.push({ t: "p", d: [["M", xa, y + hook], ["L", xa, y], ["L", cx - g, y]], stroke: true, w: 0.1 * sp });
      ops.push({ t: "p", d: [["M", cx + g, y], ["L", xb, y], ["L", xb, y + hook]], stroke: true, w: 0.1 * sp });
    }
  }
  function arc(x1, y1, x2, y2, dir, h, th) {
    const L = x2 - x1;
    return [["M", x1, y1], ["C", x1 + 0.25 * L, y1 + dir * h, x2 - 0.25 * L, y2 + dir * h, x2, y2],
      ["C", x2 - 0.25 * L, y2 + dir * (h - th), x1 + 0.25 * L, y1 + dir * (h - th), x1, y1], ["Z"]];
  }
  function drawTie(ops, t, sy, sp, Y, grow, sysStartX) {
    if (t.slur) {
      const a = t.a, b = t.b;
      if (!a.heads || a.x == null) return;
      const above = !(a.up && (!b || b.up));
      const ya = above ? Math.min(Y(a.hi) - 0.9 * sp, a.up && a.tip != null ? a.tip - 0.4 * sp : Infinity) : Math.max(Y(a.lo) + 0.9 * sp, !a.up && a.tip != null ? a.tip + 0.4 * sp : -Infinity);
      const xa = a.x + 0.6 * sp;
      let xb, yb;
      if (b && b.heads && b.x != null && b.x > a.x) {
        xb = b.x + 0.6 * sp;
        yb = above ? Math.min(Y(b.hi) - 0.9 * sp, b.up && b.tip != null ? b.tip - 0.4 * sp : Infinity) : Math.max(Y(b.lo) + 0.9 * sp, !b.up && b.tip != null ? b.tip + 0.4 * sp : -Infinity);
      } else { xb = sy.xEnd - 0.5 * sp; yb = ya; }
      const dir = above ? -1 : 1;
      const h = Math.min(2.2 * sp, 0.8 * sp + 0.08 * (xb - xa));
      ops.push({ t: "p", d: arc(xa, ya, xb, yb, dir, h, 0.2 * sp), fill: true });
      grow(Math.min(ya, yb) + dir * h); grow(Math.max(ya, yb) + dir * h);
      return;
    }
    if (t.inbound) {                                     // the second half of a tie that starts on the system before
      const b = t.b;
      (b.tieFrom || []).forEach((src, k) => {
        if (!src || !b.heads || b.x == null) return;
        const h = b.heads[k];
        const below = b.heads.length > 1 ? k < b.heads.length / 2 : b.up;
        const dir = below ? 1 : -1, y = Y(h.p) + dir * 0.55 * sp;
        const xa = sysStartX - 0.2 * sp, xb = b.x - 0.15 * sp;
        if (xb - xa < 0.8 * sp) return;
        ops.push({ t: "p", d: arc(xa, y, xb, y, dir, Math.min(1.0 * sp, 0.25 * sp + 0.1 * (xb - xa)), 0.16 * sp), fill: true });
      });
      return;
    }
    const a = t.a;
    (a.tieTo || []).forEach((dst, k) => {
      if (!dst || !a.heads || a.x == null) return;
      const h = a.heads[k];
      const below = a.heads.length > 1 ? k < a.heads.length / 2 : a.up;
      const dir = below ? 1 : -1, y = Y(h.p) + dir * 0.55 * sp;
      const xa = (h.x != null ? h.x : a.x) + (a.base >= 1920 ? 1.56 : HEAD_W) * sp + 0.12 * sp;
      const same = dst.pc.x != null && dst.pc.i >= a.i && sysOfSame(a, dst.pc, sy);
      const xb = same ? dst.pc.x - 0.12 * sp : sy.xEnd + 0.3 * sp;
      if (xb - xa < 0.5 * sp) return;
      const ht = Math.min(1.0 * sp, 0.25 * sp + 0.1 * (xb - xa));
      ops.push({ t: "p", d: arc(xa, y, xb, y, dir, ht, 0.16 * sp), fill: true });
      grow(y + dir * ht);
    });
  }
  function sysOfSame(a, b, sy) { return b.i >= sy.start && b.i < sy.end; }

  // ───────────────────────────── output: SVG ─────────────────────────────
  const r2 = (n) => Math.round(n * 100) / 100;
  const pathD = (d) => d.map((c) => c[0] + (c.length > 1 ? c.slice(1).map(r2).join(" ") : "")).join("");
  const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const SVG_FONT = { H: ["Helvetica, Arial, sans-serif", "normal", "normal"], HB: ["Helvetica, Arial, sans-serif", "bold", "normal"],
    HO: ["Helvetica, Arial, sans-serif", "normal", "italic"], TB: ["'Times New Roman', Times, serif", "bold", "normal"],
    TR: ["'Times New Roman', Times, serif", "normal", "normal"], TI: ["'Times New Roman', Times, serif", "normal", "italic"] };
  // 2.732.0 (Tim: "allow user to choose background color/material tiling for the sheet music"): the LOOK of a page -
  //   {paper: {color "#rrggbb", tile?: {href (svg) | jpeg Uint8Array (pdf), w, h (pt a repeat)}, avg?: "#rrggbb"}, ink: "#rrggbb"}
  // the paper is a colour, or a picture repeated across the page (a material); the ink is every note, line and word.
  function hexRgb(h) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "").trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgbHex = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  /** grey text (op.g: 0 = ink .. 1 = paper) as a colour between the ink and the paper */
  function soft(ink, paper, g) { return ink.map((v, k) => v + (paper[k] - v) * g); }
  function lookOf(o) {
    const L = (o && (o.look || o)) || {};
    const P = L.paper || {};
    const ink = hexRgb(L.ink) || [0, 0, 0];
    const color = hexRgb(P.color) || [255, 255, 255];
    const avg = hexRgb(P.avg) || color;
    const tile = P.tile && +P.tile.w > 0 && +P.tile.h > 0 ? P.tile : null;
    return { ink, color, avg, tile };
  }
  function toSVG(page, opt) {
    const o = opt || {}, L = lookOf(o.look);
    const inkHex = rgbHex(L.ink), uid = "abcp" + (o.id || "0");
    const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(page.w)} ${r2(page.h)}"${o.width ? ` width="${o.width}"` : ""} class="abcPage">`,
      `<rect width="${r2(page.w)}" height="${r2(page.h)}" fill="${rgbHex(L.color)}"/>`];
    if (L.tile && L.tile.href) {
      out.push(`<defs><pattern id="${uid}" patternUnits="userSpaceOnUse" width="${r2(L.tile.w)}" height="${r2(L.tile.h)}">`
        + `<image href="${xmlEsc(L.tile.href)}" width="${r2(L.tile.w)}" height="${r2(L.tile.h)}" preserveAspectRatio="none"/></pattern></defs>`
        + `<rect width="${r2(page.w)}" height="${r2(page.h)}" fill="url(#${uid})"/>`);
    }
    page.ops.forEach((op) => {
      if (op.t === "t") {
        const f = SVG_FONT[op.f] || SVG_FONT.H, c = op.g ? rgbHex(soft(L.ink, L.avg, op.g)) : inkHex;
        out.push(`<text x="${r2(op.x)}" y="${r2(op.y)}" font-family="${f[0]}" font-weight="${f[1]}" font-style="${f[2]}" font-size="${r2(op.z)}"`
          + `${op.a === "m" ? ' text-anchor="middle"' : op.a === "e" ? ' text-anchor="end"' : ""} fill="${c}">${xmlEsc(op.s)}</text>`);
        return;
      }
      const fillA = op.fill ? `fill="${inkHex}"${op.eo ? ' fill-rule="evenodd"' : ""}` : 'fill="none"';
      const strokeA = op.stroke ? ` stroke="${inkHex}" stroke-width="${r2(op.w || 1)}"${op.cap ? ' stroke-linecap="round" stroke-linejoin="round"' : ""}` : "";
      out.push(`<path d="${pathD(op.d)}" ${fillA}${strokeA}${op.n != null ? ` data-n="${op.n}"` : ""}/>`);
    });
    out.push("</svg>");
    return out.join("");
  }

  // ───────────────────────────── output: PDF (written by hand, PDF 1.4) ─────────────────────────────
  const PDF_FONTS = { H: "Helvetica", HB: "Helvetica-Bold", HO: "Helvetica-Oblique", TB: "Times-Bold", TR: "Times-Roman", TI: "Times-Italic" };
  const WIN = { 0x20ac: 128, 0x201a: 130, 0x0192: 131, 0x201e: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135, 0x02c6: 136, 0x2030: 137, 0x0160: 138,
    0x2039: 139, 0x0152: 140, 0x017d: 142, 0x2018: 145, 0x2019: 146, 0x201c: 147, 0x201d: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x02dc: 152,
    0x2122: 153, 0x0161: 154, 0x203a: 155, 0x0153: 156, 0x017e: 158, 0x0178: 159 };
  /** a PDF string literal in WinAnsi (the standard fonts' encoding); ♯ ♭ become # b, other characters ? */
  function pdfStr(s) {
    let out = "(";
    for (const ch of String(s).replace(/♯/g, "#").replace(/♭/g, "b").replace(/♮/g, "")) {
      const c = ch.codePointAt(0);
      let b = c >= 32 && c < 127 ? c : (c >= 160 && c <= 255 ? c : WIN[c] || 63);
      if (b === 40 || b === 41 || b === 92) out += "\\" + String.fromCharCode(b);
      else if (b < 127) out += String.fromCharCode(b);
      else out += "\\" + b.toString(8).padStart(3, "0");
    }
    return out + ")";
  }
  const n3 = (v) => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? "0" : String(r); };
  const rgbPdf = (c) => c.map((v) => n3(v / 255)).join(" ");
  function pageStream(pg, L, hasTile) {
    const H = pg.h, ink = rgbPdf(L.ink), out = [];
    if (hasTile) out.push(`q /Pattern cs /P1 scn 0 0 ${n3(pg.w)} ${n3(pg.h)} re f Q`);
    else if (L.color.join() !== "255,255,255") out.push(`q ${rgbPdf(L.color)} rg 0 0 ${n3(pg.w)} ${n3(pg.h)} re f Q`);
    out.push(`${ink} rg ${ink} RG 1 j`);
    const Yp = (y) => n3(H - y);
    pg.ops.forEach((op) => {
      if (op.t === "t") {
        let x = op.x;
        if (op.a === "m" || op.a === "e") { const w = textWidth(op.s, op.f, op.z); x -= op.a === "m" ? w / 2 : w; }
        const c = op.g ? rgbPdf(soft(L.ink, L.avg, op.g)) + " rg " : "";
        out.push(`${c}BT /${op.f} ${n3(op.z)} Tf ${n3(x)} ${Yp(op.y)} Td ${pdfStr(op.s)} Tj ET${c ? " " + ink + " rg" : ""}`);
        return;
      }
      const parts = [];
      op.d.forEach((c) => {
        if (c[0] === "M") parts.push(`${n3(c[1])} ${Yp(c[2])} m`);
        else if (c[0] === "L") parts.push(`${n3(c[1])} ${Yp(c[2])} l`);
        else if (c[0] === "C") parts.push(`${n3(c[1])} ${Yp(c[2])} ${n3(c[3])} ${Yp(c[4])} ${n3(c[5])} ${Yp(c[6])} c`);
        else parts.push("h");
      });
      if (op.stroke) parts.unshift(`${n3(op.w || 1)} w ${op.cap ? 1 : 0} J`);
      parts.push(op.fill && op.stroke ? (op.eo ? "B*" : "B") : op.fill ? (op.eo ? "f*" : "f") : "S");
      out.push(parts.join(" "));
    });
    return out.join("\n");
  }
  /** a baseline / progressive JPEG's size and colour channels (its SOF marker) - null when it is not one */
  function jpegInfo(b) {
    if (!b || b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const mk = b[i + 1];
      if (mk === 0xd8 || mk === 0x01 || (mk >= 0xd0 && mk <= 0xd7) || mk === 0xff) { i += mk === 0xff ? 1 : 2; continue; }
      const len = (b[i + 2] << 8) | b[i + 3];
      if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) {
        const h = (b[i + 5] << 8) | b[i + 6], w = (b[i + 7] << 8) | b[i + 8], n = b[i + 9];
        return w > 0 && h > 0 && (n === 1 || n === 3 || n === 4) ? { w, h, n } : null;
      }
      i += 2 + len;
    }
    return null;
  }
  const bin = (bytes) => { let s = ""; for (let k = 0; k < bytes.length; k += 8192) s += String.fromCharCode.apply(null, bytes.subarray(k, k + 8192)); return s; };
  /** pages -> a PDF. look (2.732.0): {paper: {color, avg, tile: {jpeg, w, h}}, ink} - the paper colour under every page, a
   *  material as a tiling pattern (the JPEG kept once, DCTDecode - read by every PDF reader, nothing decoded here) */
  function toPDF(pages, meta, look) {
    const m = meta || {}, L = lookOf(look);
    const objs = [null, null];
    const add = (s) => { objs.push(s); return objs.length; };
    let patRef = "";
    const jp = L.tile && L.tile.jpeg ? (L.tile.jpeg instanceof Uint8Array ? L.tile.jpeg : new Uint8Array(L.tile.jpeg)) : null;
    const ji = jp ? jpegInfo(jp) : null;
    if (ji) {
      const cs = ji.n === 1 ? "/DeviceGray" : ji.n === 4 ? "/DeviceCMYK /Decode [1 0 1 0 1 0 1 0]" : "/DeviceRGB";
      const im = add(`<< /Type /XObject /Subtype /Image /Width ${ji.w} /Height ${ji.h} /ColorSpace ${cs} /BitsPerComponent 8 /Filter /DCTDecode /Length ${jp.length} >>\nstream\n${bin(jp)}\nendstream`);
      const tw = +L.tile.w, th = +L.tile.h;
      const cell = `q ${n3(tw)} 0 0 ${n3(th)} 0 0 cm /Im1 Do Q`;
      const H0 = (pages && pages[0] && pages[0].h) || 841.89;
      patRef = `/Pattern << /P1 ${add(`<< /Type /Pattern /PatternType 1 /PaintType 1 /TilingType 1 /BBox [0 0 ${n3(tw)} ${n3(th)}] /XStep ${n3(tw)} /YStep ${n3(th)} /Matrix [1 0 0 1 0 ${n3(H0)}] /Resources << /XObject << /Im1 ${im} 0 R >> >> /Length ${cell.length} >>\nstream\n${cell}\nendstream`)} 0 R >> `;
    }
    const fontRefs = Object.keys(PDF_FONTS).map((k) => `/${k} ${add(`<< /Type /Font /Subtype /Type1 /BaseFont /${PDF_FONTS[k]} /Encoding /WinAnsiEncoding >>`)} 0 R`).join(" ");
    const kids = [];
    (pages || []).forEach((pg) => {
      const s = pageStream(pg, L, !!patRef);
      const cid = add(`<< /Length ${s.length} >>\nstream\n${s}\nendstream`);
      kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n3(pg.w)} ${n3(pg.h)}] /Resources << /Font << ${fontRefs} >> ${patRef}>> /Contents ${cid} 0 R >>`));
    });
    objs[0] = "<< /Type /Catalog /Pages 2 0 R >>";
    objs[1] = `<< /Type /Pages /Kids [${kids.map((k) => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;
    const infoParts = ["/Producer (bitGen Studio)", "/Creator (bitGen Studio sheet music)"];
    if (m.title) infoParts.push("/Title " + pdfStr(m.title));
    if (m.subject) infoParts.push("/Subject " + pdfStr(m.subject));
    if (m.date) infoParts.push(`/CreationDate (D:${m.date})`);
    const infoId = add(`<< ${infoParts.join(" ")} >>`);
    let out = "%PDF-1.4\n%âãÏÓ\n";
    const offs = [];
    objs.forEach((s, k) => { offs.push(out.length); out += `${k + 1} 0 obj\n${s}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o2) => String(o2).padStart(10, "0") + " 00000 n \n").join("");
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(out.length);
    for (let k = 0; k < out.length; k++) bytes[k] = out.charCodeAt(k) & 255;
    return bytes;
  }

  return { parse, render, toSVG, toPDF, parseKey, parseMeter, split, textWidth, jpegInfo, hexRgb, WHOLE, version: "2.733.0" };
}));
