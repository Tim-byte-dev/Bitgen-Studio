#!/usr/bin/env node
// bitGen Studio 2.960.0 - 🎹 takes and comping: ● Rec onto an armed layer, ⟳ loop recording (a take a pass), punch, comping by
// dragging across takes, flatten; the recorder's clock (each buffer placed by the context's own time). Tim: "lets do the next one".
// Browser test: scripts/test-ui960-ui.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const T = require("../ext/synthdock/synthtlcore.js"), RC = require("../ext/synthdock/synthrec.js");
const J = (x) => JSON.stringify(x);
const take = (src, ti, start, len, grp) => ({ src, name: src, start, off: 0, len, gain: 1, fi: 0, fo: 0, grp: grp || "g1", ti });

check("the range: kept 0 - 3600 s, a > b swapped, on / punch only with a real range; a new timeline has none",
  J(T.cleanLoop({ on: 1, a: 4, b: 2, punch: 0 })) === J({ on: true, a: 2, b: 4, punch: false }) && T.cleanLoop({ on: true, a: 1, b: 1 }).on === false && J(T.newTL().loop) === J({ on: false, a: 0, b: 0, punch: false }));
let s = T.comp([], 1, 2, 1, 0);
check("comp(): take 1 from 1 to 2 s over take 0 -> [0: take 0, 1: take 1, 2: take 0]; compAt reads it (before the first = the first)",
  J(s) === J([{ t: 0, ti: 0 }, { t: 1, ti: 1 }, { t: 2, ti: 0 }]) && T.compAt(s, 0.5, 9) === 0 && T.compAt(s, 1, 9) === 1 && T.compAt(s, 5, 9) === 0 && T.compAt([], 3, 7) === 7, s);
s = T.comp(s, 1.5, 3, 2, 0);
check("comp() again overlapping: the later drag wins, the rest stays, equal neighbours merge", J(s) === J([{ t: 0, ti: 0 }, { t: 1, ti: 1 }, { t: 1.5, ti: 2 }, { t: 3, ti: 0 }]) && J(T.comp(s, 0, 5, 0, 0)) === J([{ t: 0, ti: 0 }]), s);
check("ranges(): where a take plays inside its own extent", J(T.ranges(s, 1, 0, 5, 0)) === J([[1, 1.5]]) && J(T.ranges(s, 0, 0, 5, 0)) === J([[0, 1], [3, 5]]) && J(T.ranges([], 4, 2, 3, 4)) === J([[2, 3]]));
const l = T.newLayer(0);
l.clips = [take("my:a", 0, 0, 4), take("my:b", 1, 0, 4), { src: "kit:kick", name: "k", start: 5, off: 0, len: 1, gain: 1, fi: 0, fo: 0 }];
l.comps = { g1: T.comp([], 1, 2, 0, 1) };
const pl = T.playable(l);
check("playable(): plain clips as they are + each take as the pieces the comp picks (offset into the take, 8 ms fades)",
  J(pl.map((p) => [p.ci, p.c.src, p.c.start, p.c.off, p.c.len])) === J([[2, "kit:kick", 5, 0, 1], [0, "my:a", 1, 1, 1], [1, "my:b", 0, 0, 1], [1, "my:b", 2, 2, 2]]) && pl[1].c.fi === 0.008, pl.map((p) => p.c));
const sch = T.schedule({ layers: [l] }, 1.5);
check("schedule(): plays the comp (the takes that are not picked are silent), from part-way too",
  J(sch.map((x) => [x.src, x.when, x.off, x.dur])) === J([["my:a", 0, 1.5, 0.5], ["my:b", 0.5, 2, 2], ["kit:kick", 3.5, 0, 1]]) && sch.every((x) => x.c && Number.isInteger(x.pi)), sch);
check("groups / newest / span", J(T.groups(l)) === J({ g1: [0, 1] }) && T.newest(l, "g1") === 1 && J(T.span(l, "g1")) === J([0, 4]) && T.span(l, "g9") === null);
// recording
const pr = T.passRanges(48000 * 4, 48000, 10, [9.9, 10.9, 11.9, 12.9, 13.95], 1);
check("passRanges(): each pass's samples by the clock; a pass begun before the recording keeps its lead; a pass under 0.25 s dropped",
  J(pr) === J([{ i0: 0, i1: 43200, lead: 0.1 }, { i0: 43200, i1: 91200, lead: 0 }, { i0: 91200, i1: 139200, lead: 0 }, { i0: 139200, i1: 187200, lead: 0 }]), pr);
check("punchCut(): only the range is kept", J(T.punchCut(0.5, 2, 1, 1.5)) === J({ start: 1, skip: 0.5, len: 0.5 }) && T.punchCut(0.5, 0.3, 1, 1.5) === null && J(T.punchCut(1.2, 5, 1, 2)) === J({ start: 1.2, skip: 0, len: 0.8 }));
const a = T.newLayer(0); let r = T.addTakes(a, [{ src: "my:x", name: "x", start: 2, len: 1 }]);
check("addTakes(): one take over nothing = a plain clip", r.grp === null && a.clips.length === 1 && !a.clips[0].grp, a.clips);
r = T.addTakes(a, [{ src: "my:y", name: "y", start: 1.5, len: 2 }, { src: "my:z", name: "z", start: 1.5, len: 2 }]);
check("addTakes() over a clip: the clip becomes take 1, the new ones 2, 3 - the newest plays where it was recorded",
  r.grp === "g1" && J(a.clips.map((c) => [c.src, c.grp, c.ti])) === J([["my:x", "g1", 0], ["my:y", "g1", 1], ["my:z", "g1", 2]]) && J(a.comps.g1) === J([{ t: 0, ti: 0 }, { t: 1.5, ti: 2 }, { t: 3.5, ti: 0 }]), { clips: a.clips, comps: a.comps });
r = T.addTakes(a, [{ src: "my:w", name: "w", start: 3, len: 1 }]);
check("…a later recording that overlaps joins the group (take 4)", r.grp === "g1" && a.clips[3].ti === 3 && T.compAt(a.comps.g1, 3.5, 0) === 3);
check("addTakes(): 32 takes a group at most", (() => { const b = T.newLayer(0); const x = T.addTakes(b, Array.from({ length: 40 }, (_, k) => ({ src: "my:t" + k, name: "t", start: 0, len: 1 }))); return x.full && b.clips.length === 32; })());
T.dropTake(a, 3);
check("dropTake(): where it played the newest take left plays", a.clips.length === 3 && T.compAt(a.comps.g1, 3.5, 0) === 2, a.comps);
const d = T.moveGroup(a, "g1", 1);
check("moveGroup(): the takes and the comp move together (never before 0)", d === 1 && a.clips[0].start === 3 && a.comps.g1[0].t === 1 && T.moveGroup(a, "g1", -99) === -2.5);
const fl = T.newLayer(0); fl.clips = [take("my:a", 0, 0, 4), take("my:b", 1, 0, 4)]; fl.comps = { g1: T.comp([], 1, 2, 0, 1) };
const n = T.flatten(fl, "g1");
check("flatten(): the comp as plain clips - exactly what played", n === 3 && fl.clips.every((c) => !c.grp) && !fl.comps.g1 && J(fl.clips.map((c) => [c.src, c.start, c.off, c.len])) === J([["my:a", 1, 1, 1], ["my:b", 0, 0, 1], ["my:b", 2, 2, 2]]));
const two = T.newLayer(0); two.clips = [take("my:a", 0, 0, 1), take("my:b", 1, 0, 1)]; two.comps = { g1: [{ t: 0, ti: 1 }] }; T.dropTake(two, 1);
check("dropTake() leaving one take: a plain clip again", two.clips.length === 1 && !two.clips[0].grp && !two.comps.g1);
const cl = T.cleanTL({ loop: { on: true, a: 0, b: 2 }, layers: [{ clips: [take("my:a", 0, 0, 1), take("my:b", 1, 0, 1), { src: "my:c", grp: "bad id", ti: 1 }, { kind: "notes", grp: "g1", ti: 0, notes: [] }], comps: { g1: [{ t: 0.5, ti: 0 }, { t: -1, ti: 1 }, null], g7: [{ t: 0, ti: 0 }] } }] });
check("cleanTL(): takes need a good group id + take number (never on a note clip), comps only for groups that exist, the loop kept",
  J(cl.layers[0].clips.map((c) => c.grp || "-")) === J(["g1", "g1", "-", "-"]) && J(cl.layers[0].comps) === J({ g1: [{ t: 0, ti: 1 }, { t: 0.5, ti: 0 }] }) && cl.loop.on && cl.loop.b === 2, cl.layers[0]);
// the recorder's clock
const ch = [new Float32Array(12), new Float32Array(12)]; for (let i = 0; i < 12; i++) { ch[0][i] = i; ch[1][i] = -i; }
const pc = RC.place([[0, 1.0, 4], [4, 1.0, 4], [8, 1.005, 4]], 1000, ch);
check("the recorder places every buffer by its clock: a stale copy lands on itself, a dropped stretch stays silent",
  pc.t0 === 1 && J(Array.from(pc.chans[0])) === J([4, 5, 6, 7, 0, 8, 9, 10, 11]) && J(Array.from(pc.chans[1]).slice(5)) === J([-8, -9, -10, -11]) && pc.moved === 2, { t0: pc.t0, c: Array.from(pc.chans[0]), moved: pc.moved });
const RJ = src("ext/synthdock/synthrec.js");
check("…its clock: a ConstantSource ramping 1 a second into a 3rd channel (create(ctx, node, {clock: true}))", /createConstantSource\(\)/.test(RJ) && /linearRampToValueAtTime\(now \+ 4000, now \+ 4000\)/.test(RJ) && /createChannelMerger\(3\)/.test(RJ) && /place\(marks, sr, chans\)/.test(RJ));
const TJ = src("ext/synthdock/synthtl.js"), DH = src("ext/synthdock/dock.html"), DJ = src("ext/synthdock/synthdock.js");
check("the bar: ● Rec, its input (keys / looper + pads / both / mic), ⟳ Loop, Punch; ● arm in the heads",
  ["syTRec", "syTIn", "syTLoop", "syTPunch"].every((id) => DH.includes('id="' + id + '"')) && /<option value="mic">/.test(DH) && /dataset\.arm = i/.test(TJ) && /\.sytlh1 \.sym\.arm\.on/.test(DH));
check("recording: the clock'd recorder on the input, the output latency taken off, a take a pass (loop) / the range (punch) -> My samples -> addTakes",
  /H3SynthRec\.create\(ctx, inp\.node, \{ clock: true \}\)/.test(TJ) && /ctx\.outputLatency \|\| 0\) \+ \(ctx\.baseLatency \|\| 0\)/.test(TJ) && /T\.passRanges\(n, sr, got\.t0/.test(TJ) && /T\.punchCut\(R\.from/.test(TJ) && /T\.addTakes\(l, list\)/.test(TJ)
  && /keysOut: function \(\) \{ return engine\(\)\.out; \}, loopOut: function \(\) \{ return LP\.bus\(\); \}/.test(DJ) && /getUserMedia\(\{ audio: \{ echoCancellation: false/.test(TJ));
check("the loop plays round without a gap: the next pass is mixed ahead to start as this one ends; ■ ends a recording",
  /function nextPass\(ctx, AB\)/.test(TJ) && /S\.at \+ \(AB\.b - S\.from\)/.test(TJ) && /function swapPass\(\)/.test(TJ) && /function toggle\(\) \{ if \(S\.rec\) return endRec\(\)/.test(TJ));
check("comping: drag across a take, click = all of it, right-click / Delete = remove, the top strip moves the group, ▤ Flatten; ✂ / ⧉ refuse takes",
  /kind: "comp"/.test(TJ) && /function compApply\(d\)/.test(TJ) && /T\.dropTake\(L\(ht\.l\), ht\.c\)/.test(TJ) && /T\.moveGroup\(nl, d\.grp/.test(TJ) && /id="syTFlat"|"syTFlat"/.test(TJ) && /Flatten the comp first to split it/.test(TJ));
check("server.js untouched", !/synth/i.test(src("misc/server.js")));
console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
