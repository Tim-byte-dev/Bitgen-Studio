#!/usr/bin/env node
/* bitGen Studio — 2.408.0 unit tests: edit by transcript + scene cuts (static/textedit.js, lib/sceneCuts.js) and the
 * karaoke words (lib/karaoke.js: the whole-lyrics cache key, corrected words kept per song, wordsText).
 * Tim: "please add an edit lyrics box to the kareoke dialog - some of the words are wrong. and continue with the
 * premier catchup - do whats most useful next". Needs ffmpeg (the scene cuts). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const X = require(path.join(ROOT, "static", "textedit.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-3);
const words = [{ start: 0.5, end: 0.9, word: "Hello" }, { start: 1.0, end: 1.3, word: "um" }, { start: 1.4, end: 1.9, word: "world," }, { start: 4.0, end: 4.4, word: "again." }];
const c = { name: "v.mp4", start: 2, in: 0, out: 5, dur: 5, kf: [{ t: 1 }], split: { lead: 1 } };

/* ---- text edit */
check("merge: sorted, overlapping + touching joined", JSON.stringify(X.merge([[3, 4], [1, 2], [1.5, 2.5], [2.5, 2.6]])) === "[[1,2.6],[3,4]]");
const wr = X.wordRanges(words, [1]);
check("cutting 'um': from where it starts (just after the word before) to where the next kept word starts", wr.length === 1 && near(wr[0][0], 0.98) && near(wr[0][1], 1.38), wr);
const rm = X.remove(c, wr);
check("remove: two pieces of the same file end to end from the clip's start, 0.4 s out, keyframes / split dropped",
  rm.pieces.length === 2 && near(rm.removed, 0.4) && rm.pieces[0].start === 2 && near(rm.pieces[0].out, 0.98) && near(rm.pieces[1].start, 2.98) && near(rm.pieces[1].in, 1.38)
  && !rm.pieces[0].kf && !rm.pieces[1].split && rm.pieces.every((p) => p.name === "v.mp4"), rm);
check("remove: slivers under 0.08 s are not kept", X.remove({ start: 0, in: 0, out: 2 }, [[0.05, 1.96]]).pieces.length === 0);
check("wordRanges: a run of words is one range; the last word to its end", JSON.stringify(X.wordRanges(words, [2, 3]).map((r) => r.map((v) => +v.toFixed(2)))) === "[[1.38,4.38]]");
check("pauseRanges: a 2.1 s silence leaves 0.15 s either side; short ones stay", JSON.stringify(X.pauseRanges(words, 0.8, 0.15, 0, 5)) === "[[2.05,3.85]]");
check("fillers: um / uh / erm / hmm found, words kept", JSON.stringify(X.fillers([{ word: "Um," }, { word: "umbrella" }, { word: "uhh" }, { word: "Hmm" }, { word: "erm" }])) === "[0,2,3,4]");
check("keepRanges: everything but the chosen words (with a little air)", (() => { const k = X.keepRanges(words, [0], 0, 5); return k.length === 2 && near(k[0][1], 0.45) && near(k[1][0], 0.98); })());
check("within: only the words inside the piece's in..out", X.within(words, { in: 1.2, out: 4.1 }).map((w) => w.i).join() === "1,2,3");
const sp = X.splitAt(c, [2, 4, 4.95, -1]);
check("splitAt: in place, at the cuts inside the trim (one 0.05 s from the end ignored), keyframes only on the first",
  JSON.stringify(sp.map((p) => [p.start, p.in, p.out])) === "[[2,0,2],[4,2,4],[6,4,5]]" && sp[0].kf && !sp[1].kf, sp);
const d = { name: "w", start: 7, in: 0, out: 2 }, e = { name: "x", start: 0, in: 0, out: 1 };
const rp = X.replace([e, c, d], c, X.remove(c, [[1, 2]]).pieces, 1, true);
check("replace + ripple: the pieces in its place, the clip after it 1 s earlier, the one before untouched",
  JSON.stringify(rp.map((x) => [x.name, x.start])) === '[["x",0],["v.mp4",2],["v.mp4",3],["w",6]]', rp);
// 2.413.0: a retimed clip is cut too (it used to be refused) - test-premiere8.js covers reverse and ramps
const rt2 = X.remove({ start: 0, in: 0, out: 4, fx: { speed: 2 } }, [[1, 2]]);
check("a 2x clip: the word's second of source taken out = half a second of timeline (2.413.0 - it used to be refused)",
  rt2.removed === 0.5 && rt2.pieces.length === 2 && rt2.pieces[1].in === 2 && rt2.pieces[1].start === 0.5, rt2);

/* ---- scene cuts + karaoke (ffmpeg, a temporary project) */
const P = "zz_p3u_" + process.pid, pdir = path.join(ROOT, "projects", P);
(async () => {
  try {
    fs.mkdirSync(path.join(pdir, "sound"), { recursive: true });
    const sc = path.join(os.tmpdir(), "p3sc_" + process.pid + ".mp4");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=red:s=320x180:d=2:r=25", "-f", "lavfi", "-i", "color=blue:s=320x180:d=2:r=25",
      "-f", "lavfi", "-i", "testsrc=s=320x180:d=2:r=25", "-filter_complex", "[0][1][2]concat=n=3:v=1", sc]);
    const S = require(path.join(ROOT, "lib", "sceneCuts.js"));
    const cd = path.join(os.tmpdir(), "p3scc_" + process.pid);
    const r1 = await S.detect(sc, {}, cd), r2 = await S.detect(sc, {}, cd);
    check("scene cuts: the two shot changes of a red | blue | test-pattern clip (2 s, 4 s), cached the second time", JSON.stringify(r1.cuts) === "[2,4]" && !r1.cached && r2.cached, [r1, r2]);
    check("scene cuts: min spacing drops the second", JSON.stringify((await S.detect(sc, { min: 3 }, cd)).cuts) === "[2]");
    let me = ""; try { await S.detect("/no/such.mp4", {}); } catch (x) { me = x.message + x.status; }
    check("scene cuts: a missing file -> 404", /no such clip404/.test(me), me);

    const K = require(path.join(ROOT, "lib", "karaoke.js"));
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=6", path.join(pdir, "sound", "song.wav")]);
    const lyr = "first line of the song goes here and here\nthe wrong word is right here at the end";
    K.saveLyrics(pdir, "song.wav", lyr);
    const heard = [["first", 0.5], ["line", 0.9], ["of", 1.2], ["the", 1.4], ["song", 1.6], ["goes", 2], ["here", 2.3], ["and", 2.6], ["here", 2.8],
                   ["the", 3.4], ["wrong", 3.7], ["word", 4], ["is", 4.3], ["right", 4.5], ["here", 4.8], ["at", 5], ["the", 5.2], ["end", 5.4]];
    const asr = { transcribe: async () => ({ segments: [{ start: 0, end: 6, text: "", words: heard.map(([w, t]) => ({ word: w, start: t, end: t + 0.2 })) }] }) };
    const t1 = await K.timing(P, "song.wav", { asr });
    check("karaoke timing: the lyrics timed by the (fake) speech-to-text", t1.words.length === 18 && t1.words[10].text === "wrong" && near(t1.words[10].start, 3.7) && /timed by speech-to-text/.test(t1.how), t1.how);
    // the bug: a word changed past the first 64 characters, same length ("wrong" -> "WRONG" would be case; use "awful")
    K.saveLyrics(pdir, "song.wav", lyr.replace("wrong", "awful"));
    const t2 = await K.timing(P, "song.wav", { asr });
    check("karaoke timing: a corrected word far into the lyrics (same length) is NOT served from the old cache", t2.words[10].text === "awful", t2.words[10]);
    const fixedWords = t2.words.map((w) => Object.assign({}, w)); fixedWords[10].text = "lovely"; fixedWords[10].start = 3.65;
    const saved = K.saveWords(P, "song.wav", fixedWords.concat([{ text: "  ", start: 1, end: 2 }]));
    check("saveWords: cleaned (empty words out), sorted", saved.length === 18 && saved[10].text === "lovely");
    const t3 = await K.timing(P, "song.wav", { asr });
    check("karaoke timing: the corrected words (text + time) win", t3.fixed && t3.how === "your corrected words" && t3.words[10].text === "lovely" && near(t3.words[10].start, 3.65), t3.how);
    K.saveLyrics(pdir, "song.wav", lyr.replace("wrong", "great"));
    const t4 = await K.timing(P, "song.wav", { asr });
    check("karaoke timing: new lyrics -> the corrections no longer apply (re-timed from the lyrics)", !t4.fixed && t4.words[10].text === "great", t4.how);
    K.saveWords(P, "song.wav", t4.words.map((w, i) => (i === 0 ? Object.assign({}, w, { text: "1st" }) : w)));
    K.saveWords(P, "song.wav", []);
    const t5 = await K.timing(P, "song.wav", { asr });
    check("saveWords([]) undoes the corrections", !t5.fixed && t5.words[0].text === "first");
    check("wordsText: a line per lyric line", K.wordsText(t5.words).split("\n").length === 2 && K.wordsText(t5.words).startsWith("first line of"));
    let ne = ""; try { K.saveWords(P, "nope.wav", [{ text: "x", start: 0, end: 1 }]); } catch (x) { ne = x.message + x.status; }
    check("saveWords: a song not in the project -> 404", /not in this project.*404/.test(ne), ne);
  } catch (x) { fail++; console.log("FAIL: crashed " + (x.stack || x)); }
  finally {
    try { fs.rmSync(pdir, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
