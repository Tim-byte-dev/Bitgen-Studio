#!/usr/bin/env node
/* bitGen Studio — 2.731.0 units: the sheet music engraver (static/abcscore.js), no studio needed.
 * Tim (verbatim): "in our music docker, sheet music tab can we have real sheet music with the notes drawn on the staff
 * with it's clefs etc. and save as pdf?"  + "just use the standards don't import anything"
 *   - the YuE2 dialect read right: voices + names, sections, Z4 bar rests, chord symbols, L:1/16, Q:1/4=88;
 *   - pitches: keys (major / minor / modes / explicit), accidentals through the bar for the letter in every octave,
 *     reset at the bar line, a tied note keeps its pitch; [chords], (3 tuplets, > < broken rhythm, ties, slurs;
 *   - durations split into written notes (dotted, tied); beams by beat; what accidentals are SHOWN;
 *   - render: pages, systems, title from T: or the file, an empty score, deterministic, nothing NaN;
 *   - the PDF: a valid PDF 1.4 (the xref offsets land on their objects, startxref right), only the standard 14 fonts
 *     (nothing embedded), WinAnsi strings; qpdf --check / pdftoppm when they are installed (the page has ink).
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const A = require("../static/abcscore.js");

let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };

const YUE = `X:1
T:
M:4/4
L:1/16
Q:1/4=88
V: Vocal clef=treble name="Vocal Melody" snm="Vocal"
V: Ins clef=treble name="Ins Melody" snm="Inst."
K:C
% verse
V: Vocal
"Cmaj7"E2G2A2G2E2D2C4|"G7"D2E2G2E2D2C2D4|"Am7"E2G2A2c2B2A2G4|"Fmaj7"F2E2D2E2G2E2C4|
V: Ins
Z4|
% chorus
V: Vocal
"Cmaj7"G2A2c2B2A2G2E4|"Fmaj7"F2A2G2E2D2E2G4|"G7"A2c2B2A2G2E2D4|"Cmaj7"E2G2A2G2E2D2C4|
V: Ins
Z4|
`;
const W = A.WHOLE;

// ── the YuE2 dialect ──
const S = A.parse(YUE);
check("YuE2: two voices, Vocal Melody / Vocal and Ins Melody / Inst., treble clefs",
  S.voices.length === 2 && S.voices[0].name === "Vocal Melody" && S.voices[0].snm === "Vocal" && S.voices[1].name === "Ins Melody"
  && S.voices[1].snm === "Inst." && S.voices.every((v) => v.clef.name === "treble"), S.voices.map((v) => [v.id, v.name, v.snm, v.clef]));
check("YuE2: 8 bars in each voice, L:1/16, 4/4, C, Q:1/4=88, no title",
  S.measureCount === 8 && S.voices.every((v) => v.measures.length === 8) && S.unit === W / 16 && S.meter.n === 4 && S.meter.d === 4
  && S.key.count === 0 && S.tempo.bpm === 88 && S.tempo.beat === W / 4 && S.title.length === 0, { mc: S.measureCount, unit: S.unit, tempo: S.tempo });
check("YuE2: the % verse / % chorus comments mark bars 1 and 5", S.sections[0] === "verse" && S.sections[4] === "chorus", S.sections);
const m0 = S.voices[0].measures[0].events;
check("YuE2: bar 1 = 6 eighths + a quarter (E2 = an eighth at L:1/16), \"Cmaj7\" on its first note",
  m0.length === 7 && m0.slice(0, 6).every((e) => e.dur === W / 8) && m0[6].dur === W / 4 && m0[0].chord === "Cmaj7" && !m0[1].chord, m0.map((e) => e.dur));
check("YuE2: Z4 = four whole-bar rests in the Ins voice (twice)",
  S.voices[1].measures.every((m) => m.events.length === 1 && m.events[0].type === "rest" && m.events[0].bar && m.events[0].dur === W), S.voices[1].measures.map((m) => m.events.length));

// ── keys, meters ──
const K = (s) => A.parseKey(s);
check("keys: G = 1 sharp (F), Gm = 2 flats, F#m = 3 sharps, Dmix = 1 sharp, Bb = 2 flats, Ddor = 0, C#= 7, Cb = -7",
  K("G").count === 1 && K("G").acc.F === 1 && K("Gm").count === -2 && K("F#m").count === 3 && K("Dmix").count === 1 && K("Bb").count === -2
  && K("Ddor").count === 0 && K("C#").count === 7 && K("Cb").count === -7 && K("Am").name === "Am", [K("Gm"), K("F#m")].map((k) => k.count));
check("keys: K:C clef=bass and K:G bass carry the clef; K:D ^g adds a sharp; K:none = C",
  K("C clef=bass").clef.name === "bass" && K("G bass").clef.name === "bass" && K("D ^g").acc.G === 1 && K("none").count === 0);
check("meters: C = 4/4, C| = 2/2, 6/8, (2+3)/8 = 5/8, none = free",
  A.parseMeter("C").n === 4 && A.parseMeter("C|").d === 2 && A.parseMeter("6/8").n === 6 && A.parseMeter("(2+3)/8").n === 5 && A.parseMeter("none") === null);

// ── pitches and accidentals ──
const notes = (abc) => A.parse(abc).voices[0].measures.map((m) => m.events.filter((e) => e.type === "note"));
let n = notes("X:1\nL:1/8\nK:C\n^c C c c'|c C|");
check("accidentals: ^c carries to C, c and c' in the same bar (every octave), the bar line resets it",
  n[0].map((e) => e.pitches[0].a).join() === "1,1,1,1" && n[1].map((e) => e.pitches[0].a).join() === "0,0", n.map((m) => m.map((e) => e.pitches[0].a)));
n = notes("X:1\nL:1/8\nK:G\nF =F F f|F|");
check("accidentals: K:G makes F sharp, =F naturals it for the bar, the next bar is the key's again",
  n[0].map((e) => e.pitches[0].a).join() === "1,0,0,0" && n[1][0].pitches[0].a === 1, n.map((m) => m.map((e) => e.pitches[0].a)));
n = notes("X:1\nL:1/8\nK:C\n^F2-|F2 F2|");
check("ties: a tied F with no sign in the next bar keeps the sharp it was tied from (the note after it does not)",
  n[1][0].pitches[0].a === 1 && n[1][0].pitches[0].tieIn && n[0][0].pitches[0].tieOut && n[1][1].pitches[0].a === 0, n.map((m) => m.map((e) => e.pitches[0])));
n = notes("X:1\nL:1/8\nK:C\nC, C c c' c''|");
check("octaves: C, = C3, C = C4, c = C5, c' = C6, c'' = C7", n[0].map((e) => e.pitches[0].o).join() === "3,4,5,6,7");

// ── rhythm ──
n = notes("X:1\nM:4/4\nL:1/8\nK:C\n[CEG]2 (3ABc A>B c<d|");
const m = n[0];
check("[CEG]2 = one quarter chord of three notes", m[0].pitches.length === 3 && m[0].dur === W / 4 && m[0].pitches.map((p) => p.L).join("") === "CEG");
check("(3ABc = three eighths in the time of two (a quarter between them), marked as one tuplet",
  m.slice(1, 4).every((e) => e.tuplet && e.tuplet.p === 3 && e.dur === W / 12 && e.written === W / 8) && m[1].tuplet.id === m[3].tuplet.id, m.slice(1, 4).map((e) => e.dur));
check("A>B = dotted eighth + sixteenth, c<d = sixteenth + dotted eighth",
  m[4].dur === W * 3 / 16 && m[5].dur === W / 16 && m[6].dur === W / 16 && m[7].dur === W * 3 / 16, m.slice(4).map((e) => e.dur));
check("durations: A/2 A/ A// A3/2 at L:1/8",
  notes("X:1\nL:1/8\nK:C\nA/2 A/ A// A3/2|")[0].map((e) => e.dur).join() === [W / 16, W / 16, W / 32, W * 3 / 16].join());
const slur = A.parse("X:1\nL:1/8\nK:C\n(ABc) d|").voices[0].measures[0].events;
check("slurs: ( starts on A, ) ends on c", slur[0].slurStart === 1 && slur[2].slurEnd === 1 && !slur[3].slurStart);
const reps = A.parse("X:1\nL:1/4\nK:C\n|: A B C D :|[1 E4 |] [2 F4 ||").voices[0].measures;
check("repeats + endings: |: starts bar 1, :| ends it, [1 / [2 mark the next bars",
  reps[0].startRepeat && reps[0].rightBar === ":|" && reps[1].ending === "1" && reps[2].ending === "2" && reps[1].rightBar === "|]" && reps[2].rightBar === "||",
  reps.map((x) => [x.startRepeat, x.rightBar, x.ending]));
const km = A.parse("X:1\nL:1/4\nK:C\nC D E F|[K:Eb] E F G A|\nM:3/4\nA B c|").voices[0].measures;
check("inline [K:Eb] changes the key from that bar (E is flat); M:3/4 from the next line", km[1].key.count === -3 && km[1].events[0].pitches[0].a === -1 && km[2].meter.n === 3);

// ── written notes ──
const sp = (d) => A.split(d).map((x) => x.base + (x.dots ? "." + x.dots : "")).join("+");
check("split: a quarter, a dotted half, five eighths = half + eighth, a whole + a quarter, 7 sixteenths = a double-dotted quarter",
  sp(480) === "480" && sp(1440) === "960.1" && sp(1200) === "960+240" && sp(2400) === "1920+480" && sp(840) === "480.2", [sp(1200), sp(840)]);

// ── render ──
const R = A.render(YUE, { title: "Neon Nights" });
check("render: one A4 page (595 x 842 pt), 8 bars, 2 staves, 2 or 3 systems, no warnings",
  R.pages.length === 1 && Math.round(R.pages[0].w) === 595 && Math.round(R.pages[0].h) === 842 && R.measures === 8 && R.voices === 2
  && R.systems >= 2 && R.systems <= 3 && !R.warnings.length, { pages: R.pages.length, systems: R.systems });
const texts = R.pages[0].ops.filter((o) => o.t === "t").map((o) => o.s);
check("render: the title (T: empty -> the file's), the voice names, the chord symbols, Verse / Chorus marks, ♩ = 88",
  texts.includes("Neon Nights") && texts.includes("Vocal Melody") && texts.includes("Ins Melody") && texts.includes("Vocal") && texts.includes("Cmaj7")
  && texts.includes("Verse") && texts.includes("Chorus") && texts.includes("= 88") && texts.includes("4"), texts);
const nums = JSON.stringify(R.pages);
check("render: every coordinate a number (no NaN / Infinity / null)", !/NaN|Infinity|null/.test(nums));
check("render: the same score draws the same pages", JSON.stringify(A.render(YUE, { title: "Neon Nights" }).pages) === nums);
const paths = R.pages[0].ops.filter((o) => o.t === "p");
check("render: the staves, clefs, notes, beams and rests are drawn (hundreds of paths)", paths.length > 150, paths.length);
const withT = A.render("X:1\nT:My Song\nC:Tim\nL:1/4\nK:D\nd e f g|]\n", { title: "file name" });
const tt = withT.pages[0].ops.filter((o) => o.t === "t").map((o) => o.s);
check("render: T: wins over the file's name; C: (the composer) is drawn", withT.title === "My Song" && tt.includes("My Song") && tt.includes("Tim") && !tt.includes("file name"));
const E = A.render("X:1\nT:Nothing\nK:C\n", {});
check("render: a score with no notes = one page saying so (empty)", E.empty && E.pages.length === 1 && E.pages[0].ops.some((o) => o.t === "t" && /No notes/.test(o.s)));
let long = "X:1\nT:Long\nM:4/4\nL:1/8\nK:F\n";
for (let i = 0; i < 120; i++) long += "F G A B c d e f|" + (i % 4 === 3 ? "\n" : "");
const LR = A.render(long);
const pnum = LR.pages.map((p) => p.ops.filter((o) => o.t === "t" && / \/ /.test(o.s)).map((o) => o.s)[0]);
check("render: a long score breaks onto pages, numbered n / N", LR.pages.length >= 2 && pnum.every((s, k) => s === (k + 1) + " / " + LR.pages.length), pnum);
check("render: every system fits the page width (nothing past the right margin)",
  LR.pages.concat(R.pages).every((p) => p.ops.every((o) => o.t !== "p" || o.d.every((c) => c[0] === "Z" || c[1] <= p.w - 30))));
check("render: nothing below the bottom margin", LR.pages.every((p) => p.ops.every((o) => (o.t === "t" ? o.y : Math.max.apply(null, o.d.filter((c) => c[0] !== "Z").map((c) => c[c.length - 1]))) <= p.h - 20)));

// ── robustness: nonsense never throws, never draws NaN (a seeded shuffle of ABC's characters) ──
let seed = 731;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const CH = "ABCDEFGabcdefgzZx^_=,'0123456789/|:[](){}<>-\"&!+ \nKMLV%.~";
let broken = 0, firstBad = "";
for (let t = 0; t < 600; t++) {
  let src = "X:1\nM:" + ["4/4", "3/4", "6/8", "C|", "none", "2/2"][t % 6] + "\nL:1/" + [4, 8, 16, 32][t % 4] + "\nK:" + ["C", "Gm", "F#", "Bbmix", "D clef=bass"][t % 5] + "\n";
  const len = 10 + Math.floor(rnd() * 300);
  for (let i = 0; i < len; i++) src += CH[Math.floor(rnd() * CH.length)];
  try {
    const r = A.render(src);
    if (/NaN|Infinity|null/.test(JSON.stringify(r.pages))) throw new Error("NaN");
    A.toPDF(r.pages); r.pages.forEach((pg) => A.toSVG(pg));
  } catch (e) { broken++; if (!firstBad) firstBad = e.message + " " + JSON.stringify(src); }
}
check("600 scrambled scores: none throws, none draws NaN", broken === 0, firstBad);
let big = "X:1\nM:4/4\nL:1/16\nV: Vocal name=\"Vocal Melody\"\nV: Ins name=\"Ins Melody\"\nK:Gm\n";
for (let g = 0; g < 40; g++) big += "V: Vocal\n\"Gm\"G2B2d2B2A2G2F4|^F2A2c2A2G2=F2D4|G4-G2A2B2c2d2e2|f8 z8|\nV: Ins\n[GBd]8 z8|Z3|\n";
const t0 = Date.now(), BR = A.render(big), ms = Date.now() - t0;
check("a 160-bar, two-staff song engraves in well under 2 s (" + ms + " ms, " + BR.pages.length + " pages)", ms < 2000 && BR.measures === 160 && BR.pages.length > 3, { ms, pages: BR.pages.length });

// ── SVG ──
const svg = A.toSVG(R.pages[0]);
check("SVG: one page, a white sheet, paths and text, the names escaped",
  /^<svg [^>]*viewBox="0 0 595.28 841.89"/.test(svg) && svg.endsWith("</svg>") && svg.includes('fill="#ffffff"') && (svg.match(/<path /g) || []).length === paths.length
  && svg.includes(">Vocal Melody</text>"));
check("SVG: & < > in a title are escaped", A.toSVG(A.render("X:1\nT:Rock & <Roll>\nK:C\nC|]").pages[0]).includes("Rock &amp; &lt;Roll&gt;"));

// ── PDF ──
const pdf = A.toPDF(R.pages, { title: "Neon Nights" });
const str = Buffer.from(pdf).toString("latin1");
check("PDF: a PDF 1.4 file, %%EOF at the end", str.startsWith("%PDF-1.4\n") && /%%EOF\n$/.test(str));
const xm = /startxref\n(\d+)\n%%EOF/.exec(str), xref = xm ? +xm[1] : -1;
const entries = xref > 0 ? str.slice(xref).split("\n").slice(2).filter((l) => / 00000 n $/.test(l)).map((l) => +l.slice(0, 10)) : [];
check("PDF: startxref points at the xref table and every offset lands on its object",
  str.slice(xref, xref + 4) === "xref" && entries.length > 5 && entries.every((o, k) => str.slice(o).startsWith((k + 1) + " 0 obj")), { xref, n: entries.length });
const fonts = (str.match(/\/BaseFont \/[A-Za-z-]+/g) || []).map((x) => x.slice(11));
const STD14 = ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Times-Roman", "Times-Bold", "Times-Italic"];
check("PDF: only the PDF standard's own fonts, nothing embedded (no FontFile, no image)",
  fonts.length && fonts.every((f) => STD14.includes(f)) && !/FontFile|\/Image/.test(str), fonts);
check("PDF: the title in the document info, Producer bitGen Studio, one /Page", /\/Title \(Neon Nights\)/.test(str) && /\/Producer \(bitGen Studio\)/.test(str)
  && (str.match(/\/Type \/Page\b/g) || []).length === 1);
const lens = [...str.matchAll(/<< \/Length (\d+) >>\nstream\n/g)];
check("PDF: every stream's /Length is its byte length", lens.length === 1 && lens.every((mm) => str.slice(mm.index + mm[0].length, mm.index + mm[0].length + +mm[1] + 10).endsWith("\nendstream")));
const odd = Buffer.from(A.toPDF(A.render("X:1\nT:Café (live) \\ é ♯ 歌\nK:C\nC|]").pages)).toString("latin1");
check("PDF: strings in WinAnsi - ( ) \\ escaped, é = \\351, ♯ = #, a character it has no glyph for = ?",
  odd.includes("(Caf\\351 \\(live\\) \\\\ \\351 # ?)"), (odd.match(/\(Caf[^\n]*?\) Tj/) || [""])[0]);
check("PDF: several pages = several /Page objects", (Buffer.from(A.toPDF(LR.pages)).toString("latin1").match(/\/Type \/Page\b/g) || []).length === LR.pages.length);

// the system's PDF tools, when they are here
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "abc731-"));
const f = path.join(tmp, "score.pdf");
fs.writeFileSync(f, Buffer.from(pdf));
const has = (bin) => { try { execFileSync("which", [bin], { stdio: "ignore" }); return true; } catch { return false; } };
if (has("qpdf")) {
  let ok = true, out = "";
  try { out = execFileSync("qpdf", ["--check", f], { encoding: "utf8" }); } catch (e) { ok = false; out = String(e.stdout || e.message); }
  check("qpdf --check: no syntax or stream errors", ok && /No syntax or stream encoding errors/.test(out), out.slice(0, 300));
} else console.log("SKIP: qpdf is not installed");
if (has("pdftoppm") && has("pdfinfo")) {
  const info = execFileSync("pdfinfo", [f], { encoding: "utf8" });
  check("pdfinfo: 1 page, A4, the title", /Pages:\s+1/.test(info) && /595\.2\d? x 841\.8\d? pts/.test(info) && /Title:\s+Neon Nights/.test(info), info);
  execFileSync("pdftoppm", ["-r", "40", "-gray", "-png", f, path.join(tmp, "p")]);
  const png = fs.readdirSync(tmp).find((x) => x.endsWith(".png"));
  check("pdftoppm draws the page", !!png && fs.statSync(path.join(tmp, png)).size > 3000);
  let txt = "";
  if (has("pdftotext")) { execFileSync("pdftotext", [f, path.join(tmp, "t.txt")]); txt = fs.readFileSync(path.join(tmp, "t.txt"), "utf8"); }
  if (txt) check("pdftotext reads the words back (title, names, chord symbols, marks)", /Neon Nights/.test(txt) && /Vocal Melody/.test(txt) && /Cmaj7/.test(txt) && /Chorus/.test(txt), txt.slice(0, 300));
} else console.log("SKIP: poppler (pdfinfo / pdftoppm) is not installed");
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
