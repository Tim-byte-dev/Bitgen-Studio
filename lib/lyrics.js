// bitGen Studio — karaoke lyrics layer.
//
// Turns a transcript (the timed segments lib/asr already produces, or a saved
// .lrc/.srt) into an ASS subtitle file and burns it onto a finished video.
//
// ASS rather than SRT because SRT has no styling and no karaoke: ASS carries
// the font, outline, position AND the \k tags that sweep the highlight across a
// line as it is sung. Word-level \k timing is used when the Whisper server
// returned per-word timestamps; otherwise the whole line is highlighted for its
// duration, which still reads as karaoke and never mistimes.
const fs = require("fs");
const path = require("path");
const core = require("./core");

const PRESETS = {
  karaoke:  { primary: "&H0000D5F5&", secondary: "&H00FFFFFF&", outline: "&H00000000&",
              size: 48, bold: 1, align: 2, marginV: 60 },
  subtitle: { primary: "&H00FFFFFF&", secondary: "&H00FFFFFF&", outline: "&H00000000&",
              size: 36, bold: 0, align: 2, marginV: 40 },
  bold:     { primary: "&H0000FFFF&", secondary: "&H00FFFFFF&", outline: "&H00000000&",
              size: 64, bold: 1, align: 5, marginV: 0 },
};

const pad = (n, w = 2) => String(Math.floor(n)).padStart(w, "0");
// ASS wants H:MM:SS.cc (centiseconds, single-digit hour)
function assTime(t) {
  const x = Math.max(0, t);
  return `${Math.floor(x / 3600)}:${pad((x / 60) % 60)}:${pad(x % 60)}.${pad(Math.round((x % 1) * 100))}`;
}
const esc = (s) => String(s).replace(/[{}\\]/g, "").replace(/\r?\n/g, " ").trim();

// A line becomes karaoke by prefixing each word with {\kN} where N is that
// word's duration in centiseconds. With no word timings, one \k for the line.
function karaokeText(seg) {
  const words = (seg.words || []).filter((w) => w && w.text && isFinite(w.start) && isFinite(w.end));
  if (words.length < 2) {
    const cs = Math.max(1, Math.round((seg.end - seg.start) * 100));
    return `{\\k${cs}}${esc(seg.text)}`;
  }
  let out = "";
  let cursor = seg.start;
  for (const w of words) {
    const lead = Math.round((Math.max(cursor, w.start) - cursor) * 100);
    if (lead > 0) out += `{\\k${lead}}​`;          // gap before the word
    const cs = Math.max(1, Math.round((w.end - Math.max(cursor, w.start)) * 100));
    out += `{\\k${cs}}${esc(w.text)} `;
    cursor = w.end;
  }
  return out.trim();
}

function buildAss(segments, opts) {
  const o = opts || {};
  const st = PRESETS[o.preset] || PRESETS.karaoke;
  const font = o.font || "Arial";
  const size = Math.max(12, Math.min(160, parseInt(o.size, 10) || st.size));
  const lead = Math.max(0, parseFloat(o.lead_in) || 0);       // show a line early
  const head = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    `PlayResX: ${o.width || 1280}`,
    `PlayResY: ${o.height || 720}`,
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
      + "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
      + "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // PrimaryColour is the SUNG colour, SecondaryColour the not-yet-sung one —
    // ASS sweeps from Secondary to Primary as each \k elapses.
    `Style: H3,${font},${size},${st.primary},${st.secondary},${st.outline},&H64000000&,`
      + `${st.bold},0,0,0,100,100,0,0,1,3,1,${st.align},40,40,${st.marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const body = segments
    .filter((s) => s && s.text && isFinite(s.start) && isFinite(s.end) && s.end > s.start)
    .map((s) => {
      const start = Math.max(0, s.start - lead);
      return `Dialogue: 0,${assTime(start)},${assTime(s.end)},H3,,0,0,0,,${karaokeText(s)}`;
    });
  return head.concat(body).join("\n") + "\n";
}

// Read segments back from a saved .srt/.lrc so a burn can be repeated without
// re-transcribing the song.
function segmentsFromFile(file) {
  const body = fs.readFileSync(file, "utf8");
  if (/\.lrc$/i.test(file)) {
    const rows = [];
    for (const line of body.split(/\r?\n/)) {
      const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
      if (!m || !m[3].trim()) continue;
      rows.push({ start: parseInt(m[1], 10) * 60 + parseFloat(m[2]), text: m[3].trim() });
    }
    // LRC only marks line STARTS — each line runs until the next one begins
    return rows.map((r, i) => ({ start: r.start, text: r.text,
      end: i + 1 < rows.length ? rows[i + 1].start : r.start + 4 }));
  }
  const out = [];
  const blocks = body.split(/\r?\n\r?\n/);
  for (const b of blocks) {
    const m = b.match(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/);
    if (!m) continue;
    const text = b.split(/\r?\n/).slice(b.split(/\r?\n/)[0].match(/^\d+$/) ? 2 : 1).join(" ").trim();
    if (!text) continue;
    out.push({
      start: +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000,
      end: +m[5] * 3600 + +m[6] * 60 + +m[7] + +m[8] / 1000,
      text,
    });
  }
  return out;
}

const ASS_DIR = () => {
  const d = path.join(core.projDir(core.getProject()), "transcripts");
  fs.mkdirSync(d, { recursive: true });
  return d;
};

function writeAss(stem, segments, opts) {
  const p = path.join(ASS_DIR(), path.basename(stem).replace(/\.[^.]+$/, "") + ".ass");
  fs.writeFileSync(p, buildAss(segments, opts), "utf8");
  return p;
}

module.exports = { PRESETS, buildAss, writeAss, segmentsFromFile, assTime, karaokeText, ASS_DIR };
