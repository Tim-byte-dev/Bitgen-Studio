#!/usr/bin/env node
/* bitGen Studio — 2.410.0 units: 🎤 Karaoke + 🧰 Tools as dockers beside the preview canvas (stagedock.js), Space
 * pauses the preview unless typing (static/spaceplay.js), and the next Premiere stage: markers (static/tlmarks.js,
 * ext/timelinedock/markers.js), the timeline's keyboard (tlkeys.js: V B N Y U, I / O, Ctrl+K split, ↑ ↓ edit points,
 * Home / End, M markers, Ctrl+Shift+E frame), 📤 In / Out only + 🖼 Export frame (lib/deliver.js, scripts/deliver.py),
 * markers through FCP XML / EDL / OTIO (lib/interchange.js), 📝 scene cuts as markers.
 * Tim: "make the kareoke and tools dialog into floating dockers, it will dock next to the preview canvas, either left or
 * right. this will make it easier to edit the words and timing while previewing. make spacebar pause the preview
 * playback unless typing... continue with the next stages of the premier gap closure". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);

/* ---- 1. Space: typing or not, what it does */
const SP = require(path.join(ROOT, "static", "spaceplay.js"));
const el = (tagName, type, ce) => ({ tagName, type, isContentEditable: !!ce });
check("typing: a text / number box, a text area, a list box, an editable text are typing",
  SP.typing(el("INPUT", "text")) && SP.typing(el("INPUT", "number")) && SP.typing(el("INPUT", "search")) && SP.typing(el("TEXTAREA"))
  && SP.typing(el("SELECT")) && SP.typing(el("DIV", undefined, true)) && SP.typing(el("INPUT")));
check("...a button, a checkbox, a slider, a colour, nothing focused are not",
  !SP.typing(el("BUTTON")) && !SP.typing(el("INPUT", "checkbox")) && !SP.typing(el("INPUT", "range")) && !SP.typing(el("INPUT", "color")) && !SP.typing(null) && !SP.typing(el("DIV")));
const D = (o) => SP.decide(Object.assign({ key: " ", mods: false, typing: false, modal: false, own: false, playing: "", overStage: false, pvPaused: false, where: "", last: "" }, o));
check("decide: playing anywhere -> pause that (the canvas / the live preview / the preview video), even over the canvas",
  D({ playing: "canvas" }) === "pause:canvas" && D({ playing: "pv", where: "canvas" }) === "pause:pv" && D({ playing: "player" }) === "pause:player" && D({ playing: "canvas", overStage: true }) === "pause:canvas");
check("decide: typing, a modal dialog, the image editor, a modifier, another key -> left alone",
  D({ playing: "canvas", typing: true }) === "" && D({ playing: "canvas", modal: true }) === "" && D({ playing: "canvas", own: true }) === ""
  && D({ playing: "canvas", mods: true }) === "" && D({ key: "a", playing: "canvas" }) === "");
check("decide: paused -> the paused live preview again, else what the pointer is over, else what Space paused last; over the canvas its own Space",
  D({ pvPaused: true }) === "play:pv" && D({ where: "canvas" }) === "play:canvas" && D({ where: "player" }) === "play:player" && D({ last: "canvas" }) === "play:canvas"
  && D({}) === "" && D({ overStage: true, where: "canvas" }) === "");

/* ---- 2. markers, edit points, split */
const MK = require(path.join(ROOT, "static", "tlmarks.js"));
let L = MK.list({ seqMarkers: [{ t: 5, name: "b", color: "BLUE" }, { t: 1, name: "a" }, { t: -3 }, null, { t: "x" }, { t: 2, color: "mauve", name: "x\ny" }] });
check("list: cleaned (bad ones out), in time order, colours known (else green), one-line names",
  L.length === 3 && L.map((m) => m.t).join() === "1,2,5" && L[2].color === "blue" && L[1].color === "green" && L[1].name === "x y", L);
let r = MK.add(L, 3, { fps: 25, name: "chorus", color: "red" });
check("add: a new one in order", r.added && r.list.length === 4 && r.list[2].name === "chorus" && r.list[2].color === "red", r.list);
const r2 = MK.add(r.list, 3.01, { fps: 25, name: "renamed" });
check("add: within half a frame of one = that one (renamed), not a second", !r2.added && r2.list.length === 4 && r2.m.name === "renamed");
L = MK.move(r2.list, r2.list[0], 9);
check("move: re-sorted", L.map((m) => m.t).join() === "2,3,5,9");
check("next / prev", MK.next(L, 3) === 5 && MK.prev(L, 3) === 2 && MK.next(L, 9) === null && MK.prev(L, 2) === null && MK.next(L, 2.9995) === 5);
check("remove", MK.remove(L, L[1]).length === 3);
const TL = { video: [{ start: 0, in: 0, out: 4 }, { start: 4, in: 1, out: 3 }], vlayers: [{ clips: [{ start: 1.5, in: 0, out: 2 }] }],
             images: [{ clips: [{ start: 7, len: 1 }] }], audio: [{ clips: [{ start: 0.5, in: 0, out: 9 }] }] };
const pts = MK.editPoints(TL);
check("editPoints: every start and end on every layer + 0", pts.join() === "0,0.5,1.5,3.5,4,6,7,8,9.5", pts);
check("nextEdit / prevEdit", MK.nextEdit(pts, 0) === 0.5 && MK.nextEdit(pts, 4) === 6 && MK.prevEdit(pts, 4) === 3.5 && MK.prevEdit(pts, 0) === null && MK.nextEdit(pts, 9.5) === null);
const sp = MK.splitClip({ name: "a.mp4", start: 2, in: 1, out: 6, dur: 10, kf: [1] }, 4, "v1");
check("splitClip: the left keeps its start / in, out at the cut; the right starts at the cut with in moved, no keyframes",
  sp[0].start === 2 && sp[0].in === 1 && sp[0].out === 3 && sp[1].start === 4 && sp[1].in === 3 && sp[1].out === 6 && !sp[1].kf && sp[0].kf, sp);
const si = MK.splitClip({ name: "p.png", start: 1, len: 4 }, 2.5, "img");
check("splitClip: a picture = two lengths", si[0].len === 1.5 && si[1].start === 2.5 && si[1].len === 2.5, si);
let e1 = "", e2 = "";
let sp2x = null; try { sp2x = MK.splitClip({ start: 0, in: 0, out: 4, fx: { speed: 2 } }, 1, "v1"); } catch (e) { e1 = e.message; }
try { MK.splitClip({ start: 0, in: 0, out: 4 }, 4.5, "v1"); } catch (e) { e2 = e.message; }
check("splitClip: a retimed clip splits too (2.413.0: 2x, cut at 1 s = source 2 s); outside the clip refused in words",
  sp2x && sp2x[0].out === 2 && sp2x[1].in === 2 && sp2x[1].start === 1 && !e1 && /not inside/.test(e2), [sp2x, e1, e2]);

/* ---- 3. the timeline keys (tlkeys.js action table) */
{
  const ctx = { window: null, document: { readyState: "complete", getElementById: () => null, addEventListener() {} }, setTimeout() {}, console };
  ctx.window = { addEventListener() {} };
  vm.createContext(ctx);
  vm.runInContext(read("ext", "timelinedock", "tlkeys.js"), ctx);
  const K = ctx.window.TlKeys, A = (k, m, lay, tl) => K.action(k, Object.assign({ ctrl: false, shift: false, alt: false, meta: false }, m || {}), lay !== false, tl !== false);
  check("keys over the layers: V B N Y U = the edit tools, I / O = In / Out",
    A("v") === "mode:select" && A("b") === "mode:ripple" && A("n") === "mode:roll" && A("y") === "mode:slip" && A("u") === "mode:slide" && A("I") === "in" && A("o") === "out");
  check("...Ctrl+K split, ↑ / ↓ edit points, Home / End, M / Shift+M / Alt+M markers",
    A("k", { ctrl: true }) === "split" && A("ArrowUp") === "prevEdit" && A("ArrowDown") === "nextEdit" && A("Home") === "home" && A("End") === "end"
    && A("m") === "marker" && A("M", { shift: true }) === "nextMarker" && A("m", { alt: true }) === "prevMarker");
  check("...Ctrl+Shift+E = export the frame (anywhere in the timeline, the canvas too)", A("E", { ctrl: true, shift: true }, false, true) === "still" && A("e", { ctrl: true, shift: true }, false, false) === "");
  check("...not over the layers (the canvas's own V / B / M ...) -> nothing; Shift+V, Ctrl+V, Shift+K -> nothing",
    A("v", {}, false) === "" && A("b", {}, false) === "" && A("m", {}, false) === "" && A("v", { shift: true }) === "" && A("v", { ctrl: true }) === "" && A("k", { shift: true }) === "");   // 2.411.0: K alone = the shuttle's stop (test-premiere6.js)
  check("the shortcut map lists every key", K.KEYS.length >= 14 && K.KEYS.some((k) => k[0] === "Ctrl+K") && K.KEYS.some((k) => k[0] === "Space"));
}

/* ---- 4. 📤 In / Out only + 🖼 Export frame (lib/deliver.js, scripts/deliver.py) */
const DL = require(path.join(ROOT, "lib", "deliver.js"));
check("range: 'io' + a selection -> {a, b}; the whole movie / no selection / a sliver -> null",
  JSON.stringify(DL.range("io", { a: 1.23456, b: 3 })) === '{"a":1.2346,"b":3}' && DL.range("all", { a: 1, b: 3 }) === null && DL.range("io", null) === null && DL.range("io", { a: 2, b: 2.01 }) === null);
const T = fs.mkdtempSync(path.join(os.tmpdir(), "prem5_"));
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(80)]);
const st = DL.saveStill(T, "proj", png, 3725.52, 25);
check("saveStill: <stem>_frame_<HHhMMmSSsFF>.png beside the movies", st.name === "proj_frame_01h02m05s13.png" && fs.existsSync(path.join(T, st.name)), st);
let bad = ""; try { DL.saveStill(T, "proj", Buffer.from("not a png at all, really not one, no no no no no no no no no no no no"), 1, 25); } catch (e) { bad = e.message; }
check("...not a PNG -> refused in words", /not a PNG/.test(bad), bad);
fs.writeFileSync(path.join(T, "proj.mp4"), "x"); fs.writeFileSync(path.join(T, "proj_h264_io.mp4"), "x");
check("files: the frames and the In / Out deliverables are listed", DL.files(T, "proj").map((f) => f.name).sort().join() === "proj.mp4,proj_frame_01h02m05s13.png,proj_h264_io.mp4");
const py = execFileSync("python3", ["-c", `
import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))}); import deliver as D
from pathlib import Path
print(json.dumps([D.range_of({"deliver_range": {"a": 1, "b": 3}}), D.range_of({"deliver_range": {"a": 1, "b": 9}}, 5), D.range_of({}), D.tc_plus("01:00:00:00", 25, 2.0),
  D.tc_plus("00:59:59:24", 25, 0.04), D.srt_cut("1\\n00:00:01,000 --> 00:00:02,500\\nhi\\n\\n2\\n00:00:04,000 --> 00:00:06,000\\nthere\\n\\n3\\n00:00:09,000 --> 00:00:10,000\\nlate\\n", 2, 5),
  str(D.out_path(Path("/x/p.mp4"), {"preset": "h264", "name": "h264_480p"}, (1, 2))), str(D.out_path(Path("/x/p.mp4"), {"preset": "wav", "name": "wav"}))]))
`], { encoding: "utf8" });
const pj = JSON.parse(py);
check("deliver.py: range_of (clamped to the movie), the timecode moved to where the part starts, names _io",
  JSON.stringify(pj[0]) === "[1,3]" && JSON.stringify(pj[1]) === "[1,5]" && pj[2] === null && pj[3] === "01:00:02:00" && pj[4] === "01:00:00:00"
  && pj[6] === "/x/p_h264_480p_io.mp4" && pj[7] === "/x/p_wav.wav", pj);
check("deliver.py: the .srt cut to the part and shifted (a cue across the edge clipped, one outside dropped, renumbered)",
  pj[5] === "1\n00:00:00,000 --> 00:00:00,500\nhi\n\n2\n00:00:02,000 --> 00:00:03,000\nthere\n", pj[5]);

/* ---- 5. markers through the exchange */
const IX = require(path.join(ROOT, "lib", "interchange.js"));
const tlx = { video: [{ name: "a.mp4", start: 0, in: 0, out: 4, dur: 10 }, { name: "b.mp4", start: 4, in: 1, out: 5, dur: 10 }], v1: {}, vlayers: [], audio: [], images: [],
              seqMarkers: [{ t: 1, name: "Intro", color: "red", note: "the top" }, { t: 6.5, name: "Out", color: "blue" }] };
const o = { fps: 25, tc: { start: "01:00:00:00", fps: 25 }, find: (n, k) => ({ src: "video", kind: k }) };
const xml = IX.toFcpXml(tlx, o), edl = IX.toEdl(tlx, o), otio = JSON.parse(IX.toOtio(tlx, o));
check("FCP XML: <marker> on the sequence (name, comment, frame, colour)",
  /<marker><name>Intro<\/name><comment>the top<\/comment><in>25<\/in><out>-1<\/out><color>red<\/color><\/marker>/.test(xml) && /<in>163<\/in>/.test(xml));
check("EDL: * LOC: lines under the event they fall in (record timecode, colour, name)",
  /\* SOURCE FILE: a\.mp4\n\* LOC: 01:00:01:00 RED     Intro/.test(edl) && /\* LOC: 01:00:06:13 BLUE    Out/.test(edl), edl);
check("OTIO: Marker.2 on the stack", otio.tracks.markers.length === 2 && otio.tracks.markers[0].OTIO_SCHEMA === "Marker.2" && otio.tracks.markers[0].color === "RED"
  && otio.tracks.markers[1].marked_range.start_time.value === 163);
const bx = IX.fromFcpXml(xml, o).tl.seqMarkers, be = IX.fromEdl(edl, { fps: 25, find: () => ({ src: "video" }) }).tl.seqMarkers;
check("XML / EDL in: the markers come back (time to the frame, name, colour; the XML's comment)",
  bx.length === 2 && bx[0].name === "Intro" && bx[0].note === "the top" && bx[0].color === "red" && near(bx[1].t, 6.52, 1e-6)
  && be.length === 2 && be[1].name === "Out" && be[1].color === "blue" && near(be[0].t, 1, 1e-6), [bx, be]);
check("...and the older ⊢ First / Last ⊣ / Ref markers stay where they were (tl.markers)", JSON.stringify(IX.fromEdl(edl, { fps: 25, find: () => ({ src: "video" }) }).tl.markers) === '{"ff":null,"lf":null,"refs":[]}');

/* ---- 6. TlStageDock in jsdom: float, dock left / right of the canvas, hide, store */
{
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM('<!doctype html><body><div id="timelinedock"><div id="tlStage"><div id="tlCanvasCol"></div><div id="tlLayersPanel"></div></div></div></body>', { pretendToBeVisual: true, runScripts: "outside-only" });
  const w = dom.window, mem = {};
  w.Element.prototype.getClientRects = function () { return [{}]; };     // jsdom lays nothing out: "shown"
  w.store = { get: (k, d) => (k in mem ? mem[k] : d), set: (k, v) => { mem[k] = String(v); } };
  w.eval(read("ext", "timelinedock", "stagedock.js"));
  const SD = w.TlStageDock, P = SD.make({ id: "kgDlg", key: "kg", title: "🎤 Karaoke", w: 400, h: 500, side: "R" });
  const kids = () => [...w.document.getElementById("tlStage").children].map((x) => x.id + (x.classList.contains("none") ? "-" : ""));
  check("make: a floating window with ◧ ◨ ✕ in its titlebar, hidden until shown", P.el.parentElement === w.document.body && P.el.classList.contains("off")
    && P.el.querySelectorAll(".tsd-side").length === 2 && !!w.document.getElementById("kgDlgClose") && !!w.document.getElementById("kgDlgTitle"));
  P.dock("L");
  check("dock('L'): a column LEFT of the canvas holds it; remembered", P.el.parentElement.id === "tlDockL" && kids().join() === "tlDockL-,tlCanvasCol,tlLayersPanel" && mem["kg.side"] === "L", kids());
  P.show(true);
  check("shown: the column shows", kids().join() === "tlDockL,tlCanvasCol,tlLayersPanel" && P.el.classList.contains("docked"), kids());
  P.dock("R");
  check("dock('R'): moved RIGHT of the canvas (before the layers panel); the left column hides", kids().join() === "tlDockL-,tlCanvasCol,tlDockR,tlLayersPanel" && mem["kg.side"] === "R", kids());
  P.el.querySelector('.tsd-side[data-side="R"]').click();
  check("◨ again: floats (back on the page, no longer docked)", P.el.parentElement === w.document.body && !P.el.classList.contains("docked") && mem["kg.side"] === "" && kids().join() === "tlDockL-,tlCanvasCol,tlDockR-,tlLayersPanel", kids());
  w.document.getElementById("kgDlgClose").click();
  check("✕ hides it", !P.shown() && P.el.classList.contains("off"));
  const Q = SD.make({ id: "tlFloat", key: "tlf", title: "Tools", w: 300, h: 300 });
  Q.dock("L"); Q.show(true); P.dock("L"); P.show(true);
  check("two on one side share the column, one above the other", w.document.getElementById("tlDockL").querySelectorAll(":scope > .tsd").length === 2);
}

/* ---- 7. the wiring */
const EXT = JSON.parse(read("ext", "timelinedock", "ext.json")).scripts;
check("ext.json: stagedock.js right after canvas.js (before karaokegen.js), markers.js + tlkeys.js, tlfloat.js still last",
  EXT.indexOf("stagedock.js") === EXT.indexOf("canvas.js") + 1 && EXT.indexOf("stagedock.js") < EXT.indexOf("karaokegen.js")
  && EXT.includes("markers.js") && EXT.includes("tlkeys.js") && EXT[EXT.indexOf("tlgrid.js") - 1] === "tlfloat.js" && EXT.slice(EXT.indexOf("tlgrid.js") + 1).every((s) => ["tlselhl.js", "tlcadbar.js", "tlbody.js", "tlunreal.js", "tlgraph.js", "tlparent.js", "tlblend.js", "tlshape.js", "tltextanim.js", "tlexpr.js", "tlmask.js", "tltrack.js", "tltime.js", "tlvbake.js", "tlparticles.js", "tlaudio.js", "tlgen.js", "tldist.js", "tlrays.js", "tlwarp.js", "tlmotion.js", "tl3d.js", "tldata.js", "tllottie.js", "tlsizebar.js", "tlscene.js", "tlcutout.js", "tlcamtrack.js", "tlvfill.js", "tlanykey.js"].includes(s))   /* 2.470.0: tlselhl + tlcadbar after it */, EXT);   // 2.445.0: tlgrid.js after it
const IDX = read("static", "index.html");
check("index.html loads static/tlmarks.js and static/spaceplay.js", IDX.includes('<script src="/static/tlmarks.js"></script>') && IDX.includes('<script src="/static/spaceplay.js"></script>'));
const KG = read("ext", "timelinedock", "karaokegen.js");
check("🎤 karaoke: a TlStageDock docker (first time on the right), no modal dialog; follows the preview, ⤓ from the preview, 👁 draft on onDraw",
  /TlStageDock\.make\(\{ id: "kgDlg"/.test(KG) && /side: "R"/.test(KG) && !/showModal/.test(KG) && /TlCanvas\.onDraw\(paintDraft\)/.test(KG)
  && /data-set="start"/.test(KG) && /function follow\(/.test(KG) && /TlCanvas\.srcAt/.test(KG));
const TF = read("ext", "timelinedock", "tlfloat.js");
check("🧰 Tools & Properties: a TlStageDock docker with the same ids (tlFloat, tlFloatTitle, tlFloatClose) and key 1",
  /TlStageDock\.make\(\{ id: "tlFloat", key: "tlf"/.test(TF) && /titleId: "tlFloatTitle", closeId: "tlFloatClose"/.test(TF) && /keyHint: "1"/.test(TF));
const CV = read("ext", "timelinedock", "canvas.js");
check("canvas.js: a docker beside the canvas keeps its keys (S.overDock); typing = H3Space.typing", /S\.overDock = !!\(e\.target/.test(CV) && /H3Space\.typing\(document\.activeElement\)/.test(CV)
  && /keysAt: function \(\) \{ return S\.over && !S\.overDock; \}/.test(CV));
check("routes/deliver.js: POST /api/deliver/still (a raw PNG body); routes/index.js: deliver_range; timelinedock.js sends deliverRange + sel",
  /app\.post\("\/api\/deliver\/still", express\.raw/.test(read("routes", "deliver.js")) && /deliver_range: deliverLib\.range\(t\.deliverRange, t\.sel\)/.test(read("routes", "index.js"))
  && /deliverRange: (tl|!o\.nest && X|!o\.nest && !o\.preview && X)\.deliverRange === "io"/.test(read("ext", "timelinedock", "timelinedock.js")));
check("📤 Export: Range (whole / In-Out) + 🖼 Export frame; TlDeliver.still", /name="tdlRange" value="io"/.test(read("ext", "timelinedock", "deliver.js")) && /still: still/.test(read("ext", "timelinedock", "deliver.js")));
check("📝 scene cuts: 'as markers' drops ⚑ markers instead of cutting", /id="tteSceneMk"/.test(read("ext", "timelinedock", "textedit.js")) && /TlMarks\.add\(tlTime\(p, c\)/.test(read("ext", "timelinedock", "textedit.js")));
const SC = JSON.parse(read("docs", "shortcuts.json"));
const g = SC.groups.find((x) => /Timeline layers/.test(x.title));
check("docs/shortcuts.json: a 'Timeline layers' group with the new keys; Space anywhere", g && ["V", "B", "N", "Y", "U", "I", "O", "Ctrl+K", "M", "Ctrl+Shift+E"].every((k) => g.rows.some((r) => r[0] === k))
  && SC.groups[0].rows.some((r) => r[0] === "Space"), g && g.rows.map((r) => r[0]));
check("server.js untouched", !/tlmarks|spaceplay|stagedock|deliver\/still/.test(read("server.js")));

fs.rmSync(T, { recursive: true, force: true });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
