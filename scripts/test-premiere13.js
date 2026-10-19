#!/usr/bin/env node
/* bitGen Studio — 2.418.0 units: ⚡ REAL-TIME PLAYBACK (the last Premiere row)
 *   1. static/tlrender.js: the timeline cut at every clip edge, each stretch costed (decodes, grades, effects, masks,
 *      keys, retimes, 3D, adjustment layers, stacking) -> ok / yellow / red with the reasons; fingerprints that change
 *      ONLY where an edit lands; status (rendered = green); at()
 *   2. lib/tlRender.js: ids, the compile's file name, adopt into cache/preview (the newest 4 kept), fileFor
 *   3. the wiring: POST /api/export {preview} (own file, no deliverables), the routes, the page's exportBody, the canvas
 *      (the preview drawn over a rendered stretch while playing, ⏱ late frames, the playback resolution), nest's
 *      fingerprint ignores the render state
 * Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

/* ---- 1. the render bar's maths */
const R = require(path.join(ROOT, "static", "tlrender.js"));
const heavy = { grade: { exposure: 1 }, vfx: { blur: 4, glow: 0.4 }, mask: { shape: "ellipse", x: 0.5, y: 0.5, w: 0.4, h: 0.4 } };
const tl = {
  video: [{ name: "a.mp4", start: 0, in: 0, out: 4, dur: 4 }, { name: "b.mp4", start: 4, in: 0, out: 2, dur: 2, fx: heavy }],
  vlayers: [{ name: "V2", clips: [{ name: "c.mp4", start: 3, in: 0, out: 3, dur: 3, fx: { reverse: true } }] }],
  images: [{ name: "T1", clips: [{ text: { content: "hi" }, tid: "t1", name: "text_t1.png", start: 1, len: 2 }] }, { name: "H", visible: false, clips: [{ name: "x.png", start: 0, len: 9 }] }],
};
const L = R.stretches(tl);
check("cuts: every clip edge on every VISIBLE picture layer (a hidden one adds none)", JSON.stringify(R.cuts(tl, (c, k) => (k === "img" ? c.len : c.out - c.in))) === JSON.stringify([0, 1, 3, 4, 6]), R.cuts(tl, (c, k) => (k === "img" ? c.len : c.out - c.in)));
check("stretches: 0-1 V1 alone ok, 1-3 + a text ok, 3-4 + a REVERSED layer yellow (it seeks every frame), 4-6 graded + blurred + glowing + masked + the reversed layer RED",
  L.length === 4 && L[0].level === "ok" && L[1].level === "ok" && L[2].level === "yellow" && L[3].level === "red"
  && ["grade", "blur", "glow", "mask", "reversed"].every((w) => L[3].why.includes(w)) && L[1].why.includes("text"), L.map((s) => [s.a, s.b, s.cost, s.level, s.why]));
const t2 = JSON.parse(JSON.stringify(tl)); t2.images[0].clips[0].text.content = "yo";
const L2 = R.stretches(t2);
check("fingerprints: changing the text changes ONLY the stretch it is on (1-3)", L.map((s, i) => s.fp === L2[i].fp).join() === "true,false,true,true", [L.map((s) => s.fp), L2.map((s) => s.fp)]);
const t3 = JSON.parse(JSON.stringify(tl)); t3.vlayers[0].opacity = 0.5;
const L3 = R.stretches(t3);
check("...a LAYER's opacity counts for the stretches it covers (3-4, 4-6), not the others", L.map((s, i) => s.fp === L3[i].fp).join() === "true,true,false,false");
const t4 = JSON.parse(JSON.stringify(tl)); t4.captions = { visible: true, cues: [{ a: 0, b: 1, text: "x" }] };
check("...captions are part of every stretch's picture", R.stretches(t4).every((s, i) => s.fp !== L[i].fp));
const st = R.status(L, { fps: [L[3].fp, "deadbeef"] });
check("status: rendered = the stretch's fingerprint is in the render (green); at(t)", st[3].rendered && !st[0].rendered && R.at(st, 4.5) === st[3] && R.at(st, 0) === st[0] && R.at(st, 99) === null);
check("costOf: a 3D layer and an adjustment layer are heavy; a picture is light; a key and a tracked mask count", R.costOf({ m3d: {} }, "vl").cost === 3 && R.costOf({ adjust: true }, "img").cost === 2
  && R.costOf({ name: "p.png" }, "img").cost === 0.2 && R.costOf({ name: "v.mp4", fx: { vfx: { key: { color: "#00ff00" } }, mask: { shape: "rect", track: [{ at: 0, x: 0.5, y: 0.5 }] } } }, "vl").cost === 4);
check("hash: FNV-1a, 8 hex digits, stable", R.hash("") === "811c9dc5" && R.hash("a") === "e40c292c" && /^[0-9a-f]{8}$/.test(R.hash(JSON.stringify(tl))));

/* ---- 2. lib/tlRender.js */
const TR = require(path.join(ROOT, "lib", "tlRender.js"));
const P = fs.mkdtempSync(path.join(os.tmpdir(), "p13_"));
check("ids: 8 - 32 hex digits; the compile's file preview_<id>.mp4; anything else refused", TR.okId("0123abcd") && !TR.okId("../x") && !TR.okId("ABCDEF12") && TR.outName("0123abcd") === "preview_0123abcd.mp4"
  && (() => { try { TR.outName("x"); return false; } catch (e) { return e.status === 400; } })());
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=gray:s=64x36:r=25:d=1.2", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(P, "src.mp4")]);
fs.copyFileSync(path.join(P, "src.mp4"), path.join(P, "preview_00000001.mp4"));
const ad = TR.adopt(P, "00000001");
check("adopt: moved into cache/preview/<id>.mp4, its length, the URL; fileFor finds it (and nothing outside)", ad.file === "00000001.mp4" && ad.url === "/api/tlrender/file/00000001.mp4" && Math.abs(ad.dur - 1.2) < 0.1
  && !fs.existsSync(path.join(P, "preview_00000001.mp4")) && TR.fileFor(P, "00000001.mp4") === path.join(P, "cache", "preview", "00000001.mp4") && TR.fileFor(P, "../package.json") === null, ad);
for (let i = 2; i <= 6; i++) { fs.copyFileSync(path.join(P, "src.mp4"), path.join(P, "preview_0000000" + i + ".mp4")); TR.adopt(P, "0000000" + i); execFileSync("sleep", ["0.02"]); }
const kept = fs.readdirSync(path.join(P, "cache", "preview")).sort();
check("...the newest " + TR.KEEP + " renders kept", kept.length === TR.KEEP && kept[kept.length - 1] === "00000006.mp4" && !kept.includes("00000001.mp4"), kept);
check("...adopting a render that is not there = 404", (() => { try { TR.adopt(P, "0000abcd"); return false; } catch (e) { return e.status === 404; } })());
fs.rmSync(P, { recursive: true, force: true });

/* ---- 3. the wiring */
const IX = read("routes", "index.js"), CV = read("ext", "timelinedock", "canvas.js"), TJ = read("ext", "timelinedock", "tlrender.js"), TD = read("ext", "timelinedock", "timelinedock.js");
check("POST /api/export {preview}: its own file (preview_<id>.mp4), no deliverables, no .srt; routes/tlrender mounted (adopt + file)",
  /previewOut = tlRenderLib\.outName\(t\.preview\)/.test(IX) && /\.\.\.\(previewOut \? \{ out_name: previewOut \} : \{\}\)/.test(IX) && /require\("\.\/tlrender"\)\.mount\(app, core\)/.test(IX)
  && /\/api\/tlrender\/adopt/.test(read("routes", "tlrender.js")) && /\/api\/tlrender\/file\/:file/.test(read("routes", "tlrender.js")));
check("the page's export payload: preview passed, no deliverables / In-Out for it", /preview: o\.preview \|\| undefined/.test(TD) && /deliver: o\.nest \|\| o\.preview \? undefined/.test(TD) && /deliverRange: !o\.nest && !o\.preview/.test(TD));
check("the canvas: a rendered stretch while PLAYING draws the preview file instead of the layers; ⏱ late frames noted; ▶ resets the meter; the preview kept in step",
  /var rv = S\.playing && window\.TlRender \? TlRender\.frame\(t\) : null;/.test(CV) && /TlRender\.note\(S\.t, \(now \|\| performance\.now\(\)\) - S\.lastF\)/.test(CV)
  && /TlRender\.resetMeter\(\)/.test(CV) && /TlRender\.sync\(t, play && S\.playing, S\.rate\)/.test(CV));
check("...the playback resolution: a clip with a look is shrunk (½ / ¼) while playing, its look then worked small; a 3D canvas never",
  /S\.playing && \(S\.res \|\| 1\) < 1 && hasLook && b\.src\.tagName !== "CANVAS" \? shrink\(b\.src, c, S\.res\)/.test(CV) && /cv\._shrunk = true/.test(CV) && /src\.tagName === "CANVAS" && !src\._shrunk/.test(CV));
check("⚡ the page: the bar under the ruler (red / yellow / green), Render = TlExportBody(tl, {preview: id}) -> adopt -> tl.previewRender, a dropped stretch turns red, Full / ½ / ¼",
  /className = "tlrbar " \+ cls/.test(TJ) && /TlExportBody\(tl, \{ preview: id \}\)/.test(TJ) && /\/api\/tlrender\/adopt/.test(TJ) && /tl\.previewRender = \{ id: id, url: r\.url, fps: fpsList/.test(TJ)
  && /slow\[s\.fp\] = 1/.test(TJ) && /\["0\.25", "¼"\]/.test(TJ) && JSON.parse(read("ext", "timelinedock", "ext.json")).scripts.includes("tlrender.js")
  && /<script src="\/static\/tlrender\.js"><\/script>/.test(read("static", "index.html")));
const NE = require(path.join(ROOT, "lib", "nest.js"));
check("nest's fingerprint ignores the render state (previewRender, previewUse, playRes) - a render does not make its nests stale",
  NE.fingerprint({ video: [{ name: "a" }] }) === NE.fingerprint({ video: [{ name: "a" }], previewRender: { id: "x" }, previewUse: false, playRes: 0.5 }));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
