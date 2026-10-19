/* bitGen Studio — static/timecode.js (2.407.0): TIMECODE - HH:MM:SS:FF at a frame rate, from a start timecode (the
 * timeline's tl.tc = {start: "01:00:00:00", fps: 25}). The page's readout, the 📤 Export's -timecode, the FCP XML /
 * EDL / OTIO exchange (lib/interchange.js) all count frames here. 2.412.0: frames at the REAL rate (29.97 = 30000/1001)
 * and DROP-FRAME (HH:MM:SS;FF) for 29.97 / 59.94 - Tim: "do the smaller jobs and complete the 10 partly done jobs".
 * Tim: "can we do the pipelines, editing tools, colour and export now, keep track of what is left to do". */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.H3Timecode = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var RATES = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
  /** the whole-number frame count a second carries (24 for 23.976) and whether it is an NTSC rate */
  function base(fps) { var f = Number(fps) || 25; return { tb: Math.round(f), ntsc: Math.abs(f - Math.round(f)) > 0.001 }; }
  /** 2.412.0: the REAL frames per second (29.97 = 30000 / 1001) - what a second of the timeline holds */
  function rate(fps) { var b = base(fps); return b.ntsc ? b.tb * 1000 / 1001 : b.tb; }
  /** 2.412.0: drop-frame exists for 29.97 and 59.94 only (2 / 4 frame numbers skipped each minute but every tenth) */
  function canDrop(fps) { var b = base(fps); return b.ntsc && (b.tb === 30 || b.tb === 60); }
  function dropN(fps) { return base(fps).tb === 60 ? 4 : 2; }
  /** a timecode object / string -> is it drop-frame (a ";" before the frames, or {drop: true}) on a rate that has it */
  function isDrop(tc, fps) {
    if (tc && typeof tc === "object") return !!(canDrop(tc.fps || fps) && (tc.drop || /;/.test(String(tc.start || ""))));
    return !!(canDrop(fps) && /;\d{2}$/.test(String(tc || "").trim()));
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  /** frames -> "HH:MM:SS:FF" (non-drop) or "HH:MM:SS;FF" (drop-frame, 29.97 / 59.94) */
  function fmt(frames, fps, drop) {
    var tb = base(fps).tb, f = Math.max(0, Math.round(frames)), sep = ":";
    if (drop && canDrop(fps)) {
      // the frame NUMBER that this frame shows: skip dropN numbers at each minute that is not a tenth one
      var dn = dropN(fps), per10 = tb * 600 - dn * 9, perMin = tb * 60 - dn;
      var d = Math.floor(f / per10), m = f % per10;
      f += dn * 9 * d + (m > dn ? dn * Math.floor((m - dn) / perMin) : 0);
      sep = ";";
    }
    var ff = f % tb, s = Math.floor(f / tb), h = Math.floor(s / 3600) % 24, mi = Math.floor(s / 60) % 60;
    return pad(h) + ":" + pad(mi) + ":" + pad(s % 60) + sep + pad(ff);
  }
  /** "HH:MM:SS:FF" (or ;FF = drop-frame on 29.97 / 59.94) -> frames, NaN when it is not one (a dropped number too) */
  function parse(tc, fps, drop) {
    var m = /^(\d{1,2}):(\d{2}):(\d{2})([:;.])(\d{2})$/.exec(String(tc || "").trim());
    if (!m) return NaN;
    var tb = base(fps).tb;
    if (+m[5] >= tb || +m[2] > 59 || +m[3] > 59) return NaN;
    var n = ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * tb + +m[5];
    if ((m[4] === ";" || drop) && canDrop(fps)) {
      var dn = dropN(fps), mins = +m[1] * 60 + +m[2];
      if (+m[3] === 0 && +m[5] < dn && +m[2] % 10 !== 0) return NaN;          // e.g. 00:01:00;00 does not exist
      n -= dn * (mins - Math.floor(mins / 10));
    }
    return n;
  }
  /** timeline seconds -> frames (rounded to the nearest frame) at the real rate */
  function frames(sec, fps) { return Math.round(Math.max(0, Number(sec) || 0) * rate(fps)); }
  /** frames -> timeline seconds */
  function secs(f, fps) { return (Number(f) || 0) / rate(fps); }
  /** timeline seconds -> the timecode, counted from `start` ({start, fps, drop}) */
  function at(sec, tc) {
    var fps = (tc && tc.fps) || 25, dr = isDrop(tc, fps), st = tc && tc.start ? parse(tc.start, fps, dr) : 0;
    // the frame that CONTAINS the second (a readout), not the nearest one
    return fmt((isNaN(st) ? 0 : st) + Math.floor(Math.max(0, Number(sec) || 0) * rate(fps) + 1e-6), fps, dr);
  }
  /** the start written the way its kind is: "01:00:00;00" drop-frame, "01:00:00:00" non-drop */
  function norm(start, fps, drop) { var f = parse(start, fps, drop); return isNaN(f) ? null : fmt(f, fps, drop && canDrop(fps)); }
  return { RATES: RATES, base: base, rate: rate, canDrop: canDrop, isDrop: isDrop, fmt: fmt, parse: parse, frames: frames, secs: secs, at: at, norm: norm };
});
