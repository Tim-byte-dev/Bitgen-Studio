#!/usr/bin/env node
/* bitGen Studio — 2.571.0 units: several clips selected in the Gallery / Assets / References (Shift = a range, Ctrl = add /
 * take away), dragged onto the timeline oldest first each on its own layer (static/multisel.js); ⛓ Sequential - the
 * timeline's clips one after the other down the layers, kept so after a delete / a new layer (static/tlseq.js).
 * Tim: "allow user to select multiple clips from gallery,assets or references with shift click for range and ctrl click to
 * add or remove items, drag the clips to the timeline top clip will be oldest, bottom clip will be newest, add a button to
 * the timeline to auto arrange, arrange the 1 after the other so they play sequentially without a gap, if user deletes a
 * clip drag all the clips below it ... if user inserts a layer and adds a clip to that layer, rearrange the clips" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const M = require(path.join(ROOT, "static", "multisel.js"));
const Q = require(path.join(ROOT, "static", "tlseq.js"));

/* 1 selecting */
const K = ["a", "b", "c", "d", "e", "f"];
let s = M.pick([], null, K, "b", {});
check("pick: a click = that one (and the anchor)", JSON.stringify(s) === '{"sel":["b"],"anchor":"b"}');
s = M.pick(s.sel, s.anchor, K, "e", { shift: true });
check("...Shift + click = the range from the anchor (either way round); the anchor stays", s.sel.join() === "b,c,d,e" && s.anchor === "b" && M.pick(["e"], "e", K, "c", { shift: true }).sel.join() === "c,d,e");
s = M.pick(s.sel, s.anchor, K, "c", { ctrl: true });
check("...Ctrl + click takes one away / adds one (and moves the anchor)", s.sel.join() === "b,d,e" && s.anchor === "c" && M.pick(s.sel, s.anchor, K, "a", { ctrl: true }).sel.join() === "b,d,e,a");
check("...Ctrl + Shift adds the range to what is selected", M.pick(["a"], "d", K, "f", { shift: true, ctrl: true }).sel.join() === "a,d,e,f");
check("...a Shift click with no anchor yet = from the first selected (or just that one)", M.pick([], null, K, "c", { shift: true }).sel.join() === "c" && M.pick(["b"], null, K, "d", { shift: true }).sel.join() === "b,c,d");

/* 2 oldest first, the clips */
const it = [{ name: "new", mtime: 300 }, { name: "nodate" }, { name: "old", mtime: 100 }, { name: "mid", mtime: 200 }, { name: "nodate2", mtime: 0 }];
check("orderByDate: oldest first (the top layer), the undated after them in the order picked", M.orderByDate(it).map((x) => x.name).join() === "old,mid,new,nodate,nodate2");
const cv = M.clipFor({ kind: "video", name: "a.mp4", duration: 4.2, src: "output" }, 1.01), ci = M.clipFor({ kind: "images", name: "p.png" }, 2), cs = M.clipFor({ kind: "sound", name: "s.wav", duration: 0 }, 0);
check("clipFor: a video clip (its length, where it comes from), a picture 3 s, a sound; the start on the frame grid",
  cv.kind === "video" && cv.clip.out === 4.2 && cv.clip.src === "output" && cv.clip.start === 1 && cv.len === 4.2 && ci.clip.len === 3 && ci.len === 3 && cs.clip.out === 5 && cs.kind === "sound");

/* 3 sequential */
const tl = {
  video: [{ name: "v1a.mp4", start: 3, in: 0, out: 2 }, { name: "v1b.mp4", start: 9, in: 0, out: 1 }],
  images: [{ name: "I1", clips: [{ name: "pic.png", start: 0, len: 3 }] }, { name: "Txt", clips: [{ text: { s: "hi" }, start: 0, len: 5 }] }],
  vlayers: [{ name: "V2", clips: [{ name: "x.mp4", start: 50, in: 1, out: 5 }, { name: "y.mp4", start: 20, in: 0, out: 2 }] }, { name: "P", path: {}, clips: [{ name: "z.mp4", start: 0, in: 0, out: 1 }] },
            { name: "Shape", clips: [{ shape: {}, name: "", start: 0, len: 2 }] }, { name: "K", karaoke: true, clips: [{ name: "k.png", start: 0, len: 9 }] }],
};
const rows = Q.rowsOf(tl);
check("rowsOf: the rows in screen order that take part - V1, the picture layers, the video layers; not text / shapes / karaoke / a path layer",
  rows.map((r) => r.lk).join() === "v1,i:0,vl:0" && Q.eligible({ name: "a.mp4" }) && !Q.eligible({ text: {} }) && !Q.eligible({ name: "s", shape: {} }));
const len = (c) => (c.len != null ? c.len : c.out - c.in);
const r1 = Q.arrange(rows, len, 0, 24);
check("arrange: one after the other with no gap - V1's clips, then the picture, then the video layer's clips in time order (y before x)",
  tl.video.map((c) => c.start).join() === "0,2" && tl.images[0].clips[0].start === 3 && tl.vlayers[0].clips.map((c) => c.start).join() === "8,6" && r1.end === 12 && r1.moved === 5
  && tl.images[1].clips[0].start === 0 && tl.vlayers[1].clips[0].start === 0, { video: tl.video, v2: tl.vlayers[0].clips, r1 });
tl.images[0].clips.splice(0, 1);
Q.arrange(Q.rowsOf(tl), len, 0, 24);
check("...a clip deleted: everything below it closes up", tl.vlayers[0].clips.map((c) => c.start).join() === "5,3", tl.vlayers[0].clips);
tl.vlayers.splice(1, 0, { name: "V3", clips: [{ name: "new.mp4", start: 99, in: 0, out: 2.5 }] });
const tmp = tl.vlayers[0]; tl.vlayers[0] = tl.vlayers[1]; tl.vlayers[1] = tmp;      // the new layer moved above V2
Q.arrange(Q.rowsOf(tl), len, 0, 24);
check("...a layer put in with a clip: it takes its place in the order, the ones below make room", tl.vlayers[0].clips[0].start === 3 && tl.vlayers[1].clips.map((c) => c.start).join() === "7.5,5.5", tl.vlayers);
const tiny = [{ clips: [{ name: "a", start: 0, len: 1 / 3 }, { name: "b", start: 5, len: 1 }] }];
Q.arrange(tiny, len, 0, 24);
check("...starts on the frame grid (24 fps)", tiny[0].clips[1].start === Math.round(24 / 3) / 24);

/* 4 the wiring */
const IX = rd("static", "index.html"), MS = rd("static", "multisel.js"), SQ = rd("static", "tlseq.js"), CV = rd("ext", "timelinedock", "canvas.js"), RI = rd("routes", "index.js");
check("index.html: both loaded; the gallery tiles carry their date / length / folder, the asset tiles their length / date; the timeline's drop hands a multi-drag to H3Multi.dropAt",
  /<script src="\/static\/multisel\.js"><\/script>/.test(IX) && /<script src="\/static\/tlseq\.js"><\/script>/.test(IX) && (IX.match(/el\.dataset\.mtime = f\.mtime \|\| ""; el\.dataset\.dur = f\.duration \|\| ""; el\.dataset\.where = f\.where \|\| "";/g) || []).length === 3
  && /el\.dataset\.dur = a\.duration \|\| ""; el\.dataset\.mtime = a\.mtime \|\| "";/.test(IX) && /if \(window\.H3Multi && H3Multi\.has\(\)\) \{ await H3Multi\.dropAt\(sec\); return; \}/.test(IX));
check("the preview canvas takes a multi-drag too (at the playhead); /api/passets lists each file's date; nothing in server.js",
  /ty\.indexOf\("text\/h3multi"\) >= 0/.test(CV) && /if \(window\.H3Multi && H3Multi\.has\(\)\) \{ H3Multi\.dropAt\(t0\); return; \}/.test(CV) && /mtime: \(\(\) => \{ try \{ return Math\.round\(fs\.statSync/.test(RI) && !/multisel|tlseq/.test(rd("server.js")));
check("multisel: capture listeners on the gallery / assets dock / ref tray (Shift / Ctrl clicks taken before the single-select), a drag of a selected one = all; Assets uses its own selection",
  (MS.match(/addEventListener\("click", \(e\) => \{/g) || []).length === 2 && (MS.match(/addEventListener\("dragstart"/g) || []).length === 3 && /root\.AssetGroups, sel = AG && AG\.state && AG\.state\.sel/.test(MS) && /e\.stopImmediatePropagation\(\); paint\(\);/.test(MS));
check("tlseq: ⛓ Sequential next to ripple, on = arrange now + on every tlSave (kept as tl.seqAuto)", /b\.textContent = "⛓ Sequential"/.test(SQ) && /if \(on\(\)\) apply\(\);/.test(SQ) && /tl\.seqAuto = want == null \? !tl\.seqAuto : !!want;/.test(SQ));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
