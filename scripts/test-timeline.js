#!/usr/bin/env node
// Unit tests for lib/timelineEdit.js — the keep/cut selection maths shared by
// the UI (POST /api/timeline/edit) and any future exporter-side trimming.
// Run: node scripts/test-timeline.js
const path = require("path");
const T = require(path.join(__dirname, "..", "lib", "timelineEdit"));

let pass = 0, fail = 0;
const near = (a, b, e = 1e-4) => Math.abs(a - b) < e;
function ok(name) { pass++; console.log("PASS: " + name); }
function bad(name, got) { fail++; console.log("FAIL: " + name + "\n      got " + JSON.stringify(got)); }
function check(name, cond, got) { cond ? ok(name) : bad(name, got); }

const vclip = (name, start, inn, out, dur) => ({ name, start, in: inn, out, dur: dur ?? out, opacity: 1, src: "output" });
const iclip = (name, start, len) => ({ name, start, len, opacity: 1 });

// ---------------------------------------------------------------- snapping
check("snap: 0.51s -> frame 12 (0.5s)", near(T.snap(0.51, 24), 0.5), T.snap(0.51, 24));
check("snap: 1/3s -> frame 8 (0.3333s)", near(T.snap(1 / 3, 24), 8 / 24), T.snap(1 / 3, 24));

// ------------------------------------------------------------------- keep
{
  // one 10 s clip, keep 2→3 s
  const r = T.keepRange([vclip("a.webm", 0, 0, 10)], "video", 2, 3, { fps: 24 });
  check("keep: single clip trimmed to the selection",
    r.length === 1 && near(r[0].start, 2) && near(r[0].in, 2) && near(r[0].out, 3), r);
}
{
  const r = T.keepRange([vclip("a.webm", 0, 0, 10)], "video", 2, 3, { ripple: true, fps: 24 });
  check("keep+ripple: kept range slides to 0",
    r.length === 1 && near(r[0].start, 0) && near(r[0].in, 2) && near(r[0].out, 3), r);
}
{
  // three clips: only the middle one overlaps 6→7 s
  const r = T.keepRange([vclip("a", 0, 0, 5), vclip("b", 5, 0, 5), vclip("c", 10, 0, 5)],
                        "video", 6, 7, { fps: 24 });
  check("keep: non-overlapping clips are dropped",
    r.length === 1 && r[0].name === "b" && near(r[0].in, 1) && near(r[0].out, 2), r);
}
{
  const r = T.keepRange([iclip("p.png", 4, 6)], "image", 5, 5.5, { fps: 24 });
  check("keep: image len trimmed to the selection",
    r.length === 1 && near(r[0].start, 5) && near(r[0].len, 0.5), r);
}
{
  // exactly one second = exactly 24 frames of source
  const r = T.keepRange([vclip("a", 0, 0, 10)], "video", 3, 4, { fps: 24 });
  check("keep: 1 s selection is 24 frames of source",
    Math.round((r[0].out - r[0].in) * 24) === 24, r);
}

// -------------------------------------------------------------------- cut
{
  // cut a hole out of the middle -> two clips
  const r = T.cutRange([vclip("a", 0, 0, 10)], "video", 3, 5, { fps: 24 });
  check("cut: middle removal splits the clip in two",
    r.length === 2 && near(r[0].in, 0) && near(r[0].out, 3)
      && near(r[1].start, 5) && near(r[1].in, 5) && near(r[1].out, 10), r);
}
{
  const r = T.cutRange([vclip("a", 0, 0, 10)], "video", 3, 5, { ripple: true, fps: 24 });
  check("cut+ripple: the tail slides left to close the gap",
    r.length === 2 && near(r[1].start, 3) && near(r[1].in, 5), r);
}
{
  const r = T.cutRange([vclip("a", 0, 0, 5), vclip("b", 5, 0, 5), vclip("c", 10, 0, 5)],
                       "video", 5, 10, { fps: 24 });
  check("cut: a fully-enclosed clip disappears",
    r.length === 2 && r.map(c => c.name).join() === "a,c", r);
}
{
  const r = T.cutRange([vclip("a", 0, 0, 10)], "video", 0, 4, { fps: 24 });
  check("cut: leading removal trims the head only",
    r.length === 1 && near(r[0].start, 4) && near(r[0].in, 4) && near(r[0].out, 10), r);
}
{
  const r = T.cutRange([vclip("a", 0, 0, 10)], "video", 6, 20, { fps: 24 });
  check("cut: trailing removal trims the tail only",
    r.length === 1 && near(r[0].start, 0) && near(r[0].out, 6), r);
}
{
  const r = T.cutRange([iclip("p.png", 0, 10)], "image", 4, 6, { fps: 24 });
  check("cut: image splits into two placements",
    r.length === 2 && near(r[0].len, 4) && near(r[1].start, 6) && near(r[1].len, 4), r);
}
{
  const r = T.cutRange([vclip("a", 0, 0, 4)], "video", 10, 12, { fps: 24 });
  check("cut: a selection past every clip changes nothing",
    r.length === 1 && near(r[0].out, 4), r);
}

// ---------------------------------------------------------- edge/degenerate
{
  // sub-frame slivers are rounding noise, not clips
  const r = T.cutRange([vclip("a", 0, 0, 10)], "video", 0.001, 5, { fps: 24 });
  check("cut: sub-frame head sliver is dropped, not kept",
    r.length === 1 && near(r[0].start, 5), r);
}
{
  const r = T.keepRange([vclip("a", 2, 1, 6, 6)], "video", 0, 100, { fps: 24 });
  check("keep: a selection wider than the clip leaves it untouched",
    r.length === 1 && near(r[0].start, 2) && near(r[0].in, 1) && near(r[0].out, 6), r);
}
{
  // out must never run past the source duration
  const r = T.keepRange([vclip("a", 0, 0, 5, 5)], "video", 0, 20, { fps: 24 });
  check("keep: out is clamped to the source duration", near(r[0].out, 5), r);
}
{
  const r = T.compact([vclip("a", 0, 0, 2), vclip("b", 7, 0, 3)], "video");
  check("compact: V1 chain closes its gaps",
    near(r[0].start, 0) && near(r[1].start, 2), r);
}
{
  const r = T.apply("keep", [vclip("a", 0, 0, 10)], "video", 2, 4, { ripple: true, compact: true, fps: 24 });
  check("apply: keep+compact works end to end", r.length === 1 && near(r[0].start, 0), r);
}
try { T.apply("nope", [], "video", 0, 1, {}); bad("apply: unknown op throws", "no throw"); }
catch { ok("apply: unknown op throws"); }

// ---------------------------------------------------- lib/timelineSpan.js
// The compile's LENGTH. This is the same case table scripts/test-span.py runs
// against the Python twin, scripts/timeline_span.py — the two files must agree
// or the route will hint a length the worker then disagrees with. If you add a
// case in one file, add it in the other.
const S = require(path.join(__dirname, "..", "lib", "timelineSpan"));
const SPAN_CASES = [
  ["span: empty timeline", {}, 0],
  ["span: base track only, trimmed", { video: [{ start: 0, in: 1, out: 4 }] }, 3],
  ["span: base track only, untrimmed with dur", { video: [{ start: 2, in: 0, dur: 3 }] }, 5],
  // NOT 5s: an unmeasurable clip contributes NOTHING. Guessing a length here
  // made /api/export hint 5s for every untrimmed clip, and the worker padded
  // real 2-second videos with 3 seconds of black.
  ["span: no out and no dur contributes nothing", { video: [{ start: 0 }] }, 0],
  ["span: an unmeasurable clip does not suppress a measurable one",
    { video: [{ start: 0, out: 2 }, { start: 9 }] }, 2],
  // THE REGRESSION: an overlay that outlasts the base track. The compile used
  // to stop at 2.0s and throw the rest of the timeline away.
  ["span: overlay layer outlasts the base track",
    { video: [{ start: 0, in: 0, out: 2 }],
      video_layers: [{ clips: [{ start: 3, in: 0, out: 4 }] }] }, 7],
  ["span: the LAST of several layers wins, whatever the layer order",
    { video: [{ start: 0, out: 2 }],
      video_layers: [{ clips: [{ start: 9, out: 1 }] }, { clips: [{ start: 1, out: 2 }] }] }, 10],
  ["span: a sound layer alone can define the length",
    { video: [{ start: 0, out: 2 }], audio: [[{ start: 4, in: 0, out: 6 }]] }, 10],
  ["span: an image layer alone can define the length",
    { video: [{ start: 0, out: 2 }], images: [{ clips: [{ start: 5, len: 4 }] }] }, 9],
  ["span: an image with no len is 3s",
    { video: [{ start: 0, out: 1 }], images: [[{ start: 2 }]] }, 5],
  ["span: legacy bare-array audio track",
    { video: [{ start: 0, out: 1 }], audio: [[{ start: 1, out: 2 }]] }, 3],
  ["span: 2.60.0 {clips} audio track",
    { video: [{ start: 0, out: 1 }],
      audio: [{ transition_in: null, clips: [{ start: 1, out: 2 }] }] }, 3],
  ["span: a base track longer than every layer still wins",
    { video: [{ start: 0, out: 30 }],
      video_layers: [{ clips: [{ start: 0, out: 2 }] }],
      audio: [[{ start: 0, out: 5 }]] }, 30],
  ["span: a zero-length clip is clamped to a tenth of a second",
    { video: [{ start: 4, in: 2, out: 2 }] }, 4.1],
  ["span: junk values do not throw", { video: [{ start: "x", out: "y" }] }, 0],
];
for (const [name, tl, want] of SPAN_CASES)
  check(name, near(S.sceneEnd(tl), want), S.sceneEnd(tl));
check("span: null timeline is 0, not a throw", S.sceneEnd(null) === 0, S.sceneEnd(null));

// ------------------------------------------------- Task B (2.95.0): trimAt
{
  const clips = [vclip("a.mp3", 0, 0, 10), vclip("b.mp3", 12, 1, 5)];
  let r = T.trimAt(clips, "audio", "head", 3, { fps: 24 });
  check("trim head (AUDIO): the clip under 3s starts there, media in advances",
    r.length === 2 && near(r[0].start, 3) && near(r[0].in, 3) && near(r[0].out, 10)
    && near(r[1].start, 12) && near(r[1].in, 1), r);
  r = T.trimAt(clips, "audio", "tail", 3, { fps: 24 });
  check("trim tail (AUDIO): the clip under 3s ends there, the other untouched",
    r.length === 2 && near(r[0].start, 0) && near(r[0].out, 3) && near(r[1].start, 12), r);
  r = T.trimAt(clips, "video", "head", 12.5, { fps: 24 });
  check("trim head (VIDEO) on the SECOND clip only",
    near(r[1].start, 12.5) && near(r[1].in, 1.5) && near(r[0].out, 10), r);
  r = T.trimAt([vclip("a.mp4", 0, 0, 10)], "video", "tail", 0.01, { fps: 24 });
  check("a sub-frame remainder removes the clip instead of leaving a sliver",
    r.length === 0, r);
  let threw = null;
  try { T.trimAt(clips, "audio", "head", 11, { fps: 24 }); } catch (e) { threw = e.message; }
  check("trimming in a gap refuses with a clear message",
    /no clip under 11/.test(threw || ""), threw);
  r = T.trimAt([iclip("i.png", 2, 4)], "image", "tail", 3, { fps: 24 });
  check("trim tail (IMAGE): len shrinks to the playhead", near(r[0].len, 1), r);
}
// -------------------------------------------- Task B (2.95.0): applyClip
{
  const three = [vclip("a.mp3", 0, 0, 4), vclip("b.mp3", 5, 0, 10), vclip("c.mp3", 16, 0, 3)];
  let r = T.applyClip("keep", three, "audio", 6, 9, 7.5, { fps: 24 });
  check("clip-scoped KEEP trims only the middle clip; neighbours untouched, no slide",
    r.length === 3 && near(r[1].start, 6) && near(r[1].in, 1) && near(r[1].out, 4)
    && near(r[0].start, 0) && near(r[2].start, 16), r);
  r = T.applyClip("cut", three, "audio", 6, 9, 7.5, { ripple: true, fps: 24 });
  check("clip-scoped CUT + ripple: the tail half joins the head half (jump cut), others still",
    r.length === 4 && near(r[1].start, 5) && near(r[1].out, 1)
    && near(r[2].start, 6) && near(r[2].in, 4) && near(r[3].start, 16), r);
  r = T.applyClip("cut", three, "audio", 6, 9, 7.5, { ripple: false, fps: 24 });
  check("clip-scoped CUT without ripple leaves the hole",
    r.length === 4 && near(r[2].start, 9), r);
  r = T.applyClip("cut", three, "audio", 4.5, 15.5, 7.5, { fps: 24 });
  check("a cut covering the whole clip deletes just that clip",
    r.length === 2 && r[0].name === "a.mp3" && r[1].name === "c.mp3", r);
  let threw = null;
  try { T.applyClip("keep", three, "audio", 0, 1, 4.5, { fps: 24 }); } catch (e) { threw = e.message; }
  check("clip scope with the anchor in a gap refuses with a clear message",
    /no clip under 4\.5/.test(threw || ""), threw);
}

// -------------------------------------------- keyframes (2.96.0): kfValue
{
  const c = { name: "a.mp4", start: 2, in: 0, out: 10,
              kf: [{ at: 1, op: 1, vol: 1 }, { at: 3, op: 0.5, vol: 0.2 }] };
  check("kfValue: linear midpoint between two diamonds",
    near(T.kfValue(c, 2, "op", 1), 0.75) && near(T.kfValue(c, 2, "vol", 1), 0.6),
    [T.kfValue(c, 2, "op", 1), T.kfValue(c, 2, "vol", 1)]);
  check("kfValue: HELD before the first and after the last (AE semantics)",
    near(T.kfValue(c, 0, "op", 1), 1) && near(T.kfValue(c, 9, "op", 1), 0.5), null);
  check("kfValue: a property with no keyframes falls back to the static value",
    near(T.kfValue({ kf: [{ at: 1, vol: 0.3 }] }, 1, "op", 0.7), 0.7), null);
  check("kfValue: no keyframes at all -> fallback",
    near(T.kfValue({ name: "x" }, 5, "vol", 0.9), 0.9), null);
  check("kfValue: unsorted keyframes still interpolate correctly",
    near(T.kfValue({ kf: [{ at: 4, op: 0 }, { at: 0, op: 1 }] }, 1, "op", 1), 0.75),
    T.kfValue({ kf: [{ at: 4, op: 0 }, { at: 0, op: 1 }] }, 1, "op", 1));
}
// ---------------------------------------------- kfSet / kfRemove
{
  let kf = T.kfSet({ }, 1.501, { op: 0.5 }, 24);
  check("kfSet: snapped to the frame grid", kf.length === 1 && near(kf[0].at, 1.5), kf);
  kf = T.kfSet({ kf }, 1.51, { vol: 0.4 }, 24);
  check("kfSet: within half a frame MERGES into the existing diamond",
    kf.length === 1 && near(kf[0].op, 0.5) && near(kf[0].vol, 0.4), kf);
  kf = T.kfSet({ kf }, 0.5, { op: 1 }, 24);
  check("kfSet: a new time inserts sorted", kf.length === 2 && near(kf[0].at, 0.5), kf);
  kf = T.kfRemove({ kf }, 1.5, 24);
  check("kfRemove: takes exactly that diamond out", kf.length === 1 && near(kf[0].at, 0.5), kf);
}

console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
