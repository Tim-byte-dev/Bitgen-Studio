#!/usr/bin/env node
// static/audioviz.js in jsdom with a fake Web Audio + canvas (2.106.0).
// node scripts/test-audioviz.js
const fs = require("fs"), path = require("path");
const { JSDOM } = require("jsdom");
let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));

const SRC = fs.readFileSync(path.join(__dirname, "..", "ext", "previewdock", "audioviz.js"), "utf8");
const dom = new JSDOM(`<div id="viewerwrap"><video id="player"></video></div>`, { pretendToBeVisual: true, runScripts: "outside-only" });
const w = dom.window;
// fake Web Audio: records connections
const CONN = [];
class FakeNode { connect(x) { CONN.push([this.kind, x.kind]); } }
class FakeAnalyser extends FakeNode { constructor() { super(); this.kind = "analyser"; this.fftSize = 2048; this.frequencyBinCount = 1024; }
  getByteFrequencyData(a) { for (let i = 0; i < a.length; i++) a[i] = (i * 7) % 256; }
  getByteTimeDomainData(a) { for (let i = 0; i < a.length; i++) a[i] = 128 + Math.round(60 * Math.sin(i / 10)); } }
class FakeSource extends FakeNode { constructor(el) { super(); this.kind = "source"; this.el = el; } }
let sources = 0;
w.AudioContext = class { constructor() { this.state = "running"; this.destination = { kind: "destination" }; }
  createAnalyser() { return new FakeAnalyser(); }
  createMediaElementSource(el) { sources++; if (el.__owned) throw new Error("already connected"); el.__owned = true; return new FakeSource(el); }
  resume() { return Promise.resolve(); } };
// fake 2d context: counts draw calls
let draws = 0;
const ctx2d = new Proxy({}, { get: (_t, k) => (k === "measureText" ? () => ({ width: 10 }) : () => { draws++; }) , set: () => true });
w.HTMLCanvasElement.prototype.getContext = () => ctx2d;
let rafQ = [];
w.requestAnimationFrame = (fn) => { rafQ.push(fn); return rafQ.length; };
w.cancelAnimationFrame = () => {};
w.performance = { now: () => 1000 };
// jsdom's play() is "not implemented": give media elements a play that fires the event
w.HTMLMediaElement.prototype.play = function () { this.paused = false; this.dispatchEvent(new w.Event("play")); return Promise.resolve(); };
w.eval(SRC);
const AV = w.AudioViz;

check("the module installs window.AudioViz with the style list (6 styles)", AV && AV.styles().length === 6, AV && AV.styles());
const a = w.document.createElement("audio"); a.src = "http://x/passets/sound/song%20one.wav"; a.dataset.vizName = "song one.wav";
w.document.body.appendChild(a);
a.play();
const cv = w.document.getElementById("vizcanvas");
check("play() on an <audio> creates the canvas INSIDE #viewerwrap and shows it", cv && cv.parentElement.id === "viewerwrap" && cv.style.display === "block", cv && cv.outerHTML.slice(0, 80));
check("...the element is wired source -> analyser -> destination", CONN.some((c) => c[0] === "source" && c[1] === "analyser") && CONN.some((c) => c[0] === "analyser" && c[1] === "destination"), CONN);
check("...a style was picked", AV.styles().includes(AV.current()), AV.current());
// run a couple of frames
const before = draws; rafQ.splice(0).forEach((fn) => fn()); rafQ.splice(0).forEach((fn) => fn());
check("frames draw onto the canvas", draws > before + 10, draws - before);
const first = AV.current();
// pause hides, play again picks a (different) random style and does NOT create a second source
a.dispatchEvent(new w.Event("pause"));
check("pause fades the canvas out", cv.style.opacity === "0", cv.style.opacity);
const seen = new Set(), seq = [first];
for (let i = 0; i < 12; i++) { a.play(); seen.add(AV.current()); seq.push(AV.current()); }
check("each play picks a style at random (several seen over 12 plays)", seen.size >= 2, [...seen]);
check("...and never the same style twice in a row (nudged when the roll repeats)",
  seq.every((s, i) => i === 0 || s !== seq[i - 1]), seq);
check("a MediaElementSource is created ONCE per element (a second would throw in a real browser)", sources === 1, sources);
check("...and the canvas is showing again", cv.style.display === "block", cv.style.display);
// a timeline track marked data-noviz is left alone
const t = w.document.createElement("audio"); t.dataset.noviz = "1"; t.src = "http://x/passets/sound/track.wav";
const before2 = sources; t.play();
check("an <audio> with data-noviz (timeline track under the video) is NOT attached", sources === before2, sources);
// new Audio() (never in the DOM) still gets caught via the play() wrapper
const n = new w.Audio("http://x/passets/sound/speech.wav"); n.play();
check("new Audio() elements that are not in the DOM are caught by the play() wrapper", sources === before2 + 1, sources);
// 2.106.1: the NATIVE controls — playback starts without a script play() call
const g = w.document.createElement("audio"); g.controls = true; g.src = "http://x/outputs/gallery%20song.mp3"; g.dataset.vizName = "gallery song.mp3";
w.document.body.appendChild(g);
const s3 = sources;
g.dispatchEvent(new w.Event("play"));            // what the browser fires when ▶ is clicked
check("a play EVENT alone (native <audio controls> ▶, no script play()) attaches and starts the visualization",
  sources === s3 + 1 && AV._state.current === g && cv.style.display === "block", [sources - s3, AV._state.current === g]);
check("2.253.0: in a ZERO-HEIGHT DOM (jsdom = the broken-chain field case) sizeGuard's floor engages — the wrap gets a real min-height instead of collapsing",
  /^\d+px$/.test(w.document.getElementById("viewerwrap").style.minHeight)
    && parseInt(w.document.getElementById("viewerwrap").style.minHeight, 10) >= 200,
  w.document.getElementById("viewerwrap").style.minHeight);
check("2.253.0: with the flex chain WORKING (the wrap reports the pane's height) sizeGuard keeps its hands off — no inline min-height is imposed",
  (() => {
    const wrap2 = w.document.getElementById("viewerwrap");
    const pane2 = wrap2.parentElement;
    const saved = wrap2.style.minHeight;
    wrap2.style.minHeight = ""; delete wrap2.dataset.vizMinh;
    Object.defineProperty(wrap2, "clientHeight", { value: 400, configurable: true });
    Object.defineProperty(pane2, "clientHeight", { value: 430, configurable: true });
    g.dispatchEvent(new w.Event("play"));
    const untouched = wrap2.style.minHeight === "";
    wrap2.style.minHeight = saved;               // put the DOM back for later legs
    return untouched;
  })(), null);
g.dispatchEvent(new w.Event("play"));
check("...a second native play does not create a second source", sources === s3 + 1, sources - s3);
check("a <video>.play() is never touched", (() => { const v = w.document.createElement("video"); const s0 = sources; v.play(); return sources === s0; })(), null);
console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
