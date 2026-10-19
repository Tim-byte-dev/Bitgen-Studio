/* bitGen Studio — 2.491.0: BLEND MODES + TRACK MATTES (ext/timelinedock/tlblend.js, canvas.js drawLayer / applyMatte,
 * timelinedock.js tlLayerKeys, lib/tlKeys.layerKeys, worker.py _composite_ops) - After Effects gap item 6.
 * The compile's graph is run for real (ffmpeg, made-up layers) and its colours checked against the blend formulas. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, ".."), K = require(path.join(ROOT, "lib", "tlKeys.js"));
let pass = 0, fail = 0;
function check(name, ok, got) { if (ok) { pass++; console.log("PASS: " + name); } else { fail++; console.log("FAIL: " + name); if (got !== undefined) console.log("      got " + JSON.stringify(got).slice(0, 500)); } }
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

{
  const a = K.layerKeys({ lk: "i:2", blend: "screen", matte: { mode: "luma", by: "i:3" }, matteonly: true }), b = K.layerKeys({ lk: "x; rm", blend: "evil", matte: { mode: "alpha", by: "nope" }, matteonly: "yes" });
  check("layerKeys: a clean layer key, blend, matte and matte-only; anything else dropped", a.lk === "i:2" && a.blend === "screen" && a.matte.mode === "luma" && a.matte.by === "i:3" && a.matteonly === true && Object.keys(b).length === 0, [a, b]);
  check("the blend modes and mattes offered", K.BLENDS.length === 16 && K.BLENDS.includes("color-dodge") && K.BLENDS.includes("luminosity") && K.MATTES.join() === "alpha,alphainv,luma,lumainv");
}
// --- the compile's graph, run
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-blend-"));
  const py = [
    "import sys, json, subprocess; sys.argv=['x']; sys.path.insert(0, '.'); import worker",
    "parts = ['color=c=0x208030:s=320x180:r=24:d=1[base]', 'color=c=0x808080:s=80x60:r=24:d=1,format=rgba,trim=end_frame=1[ov1]',",
    "         'color=c=blue:s=100x100:r=24:d=1,format=rgba[ov3]', 'color=c=black@0:s=60x60:r=24:d=1,format=rgba,geq=r=255:g=0:b=0:a=255*lt(hypot(X-30\\,Y-30)\\,28)[ov2]',",
    "         'color=c=0x808080:s=80x60:r=24:d=1,format=rgba[ov4]']",
    "ops = [{'src': 'ov1', 'x': '(main_w-overlay_w)/2+(-100)', 'y': '(main_h-overlay_h)/2', 'en': 'between(t,0,5)', 'c': {'blend': 'screen', 'lk': 'i:0'}, 'i': 1, 'eof': False},",
    "       {'src': 'ov3', 'x': '(main_w-overlay_w)/2+(100)', 'y': '(main_h-overlay_h)/2', 'en': 'between(t,0,5)', 'c': {'matte': {'mode': 'alpha', 'by': 'i:2'}, 'lk': 'i:1'}, 'i': 3, 'eof': True},",
    "       {'src': 'ov2', 'x': '(main_w-overlay_w)/2+(100)', 'y': '(main_h-overlay_h)/2', 'en': 'between(t,0,5)', 'c': {'matteonly': True, 'lk': 'i:2'}, 'i': 2, 'eof': True},",
    "       {'src': 'ov4', 'x': '(main_w-overlay_w)/2', 'y': '(main_h-overlay_h)/2+(60)', 'en': 'between(t,0,5)', 'c': {'blend': 'multiply', 'lk': 'i:3'}, 'i': 4, 'eof': True}]",
    "said = []",
    "out = worker._composite_ops(parts, ops, 'base', 320, 180, 1, said.append)",
    "g = ';'.join(parts)",
    "r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-filter_complex', g, '-map', '[' + out + ']', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', sys.argv[-1] if False else " + JSON.stringify(path.join(tmp, "o.rgb")) + "], capture_output=True, text=True)",
    "print(json.dumps({'out': out, 'err': r.stderr[-400:], 'said': said, 'g': g}))"].join("\n");
  const r = JSON.parse(execFileSync("python3", ["-c", py], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").pop());
  const raw = fs.existsSync(path.join(tmp, "o.rgb")) ? fs.readFileSync(path.join(tmp, "o.rgb")) : Buffer.alloc(0);
  const px = (x, y) => { const i = (y * 320 + x) * 3; return [raw[i], raw[i + 1], raw[i + 2]]; };
  check("the graph runs in ffmpeg (blend, a matte layer's own picture, alphamerge)", raw.length === 320 * 180 * 3 && !r.err, r.err);
  const near = (a, b, t) => a.every((v, k) => Math.abs(v - b[k]) <= t);
  const scr = (a, b) => Math.round(255 - (255 - a) * (255 - b) / 255), base = [32, 128, 48];
  const sc = px(60, 90), wantS = base.map((v) => scr(v, 128));
  check(`Screen: grey over green = 255-(255-a)(255-b)/255 (${wantS}) - got ${sc}`, near(sc, wantS, 6), sc);
  const mu = px(160, 150), wantM = base.map((v) => Math.round(v * 128 / 255));
  check(`Multiply: grey over green = ab/255 (${wantM}) - got ${mu}`, near(mu, wantM, 6), mu);
  check("track matte (alpha): the blue square shows inside the matte's disc only; the matte itself is not drawn", near(px(260, 90), [0, 0, 255], 12) && near(px(260 - 40, 90 - 40), base, 12) && near(px(260 + 45, 90), base, 12), [px(260, 90), px(220, 50), px(305, 90)]);
  check("the compile says what it did", r.said.some((l) => /blend mode screen/.test(l)) && r.said.some((l) => /alpha track matte/.test(l)), r.said);
  fs.rmSync(tmp, { recursive: true, force: true });
}
// --- the wiring
{
  const cv = read("ext/timelinedock/canvas.js"), tlx = read("ext/timelinedock/timelinedock.js"), idx = read("routes/index.js"), w = read("worker.py"), ext = JSON.parse(read("ext/timelinedock/ext.json")).scripts, src = read("ext/timelinedock/tlblend.js");
  check("canvas.js: layers drawn by drawLayer; a blended / matted layer on its own picture; the matte layer not drawn; the GPU path stands aside", /function drawLayer\(tg, Ly, t\)/.test(cv) && /function applyMatte\(lg, mLy, mode, t\)/.test(cv) && /if \(usedAsMatte\[k\]\) return;/.test(cv) && /!blendOn && tl\.glComp/.test(cv));
  check("the export: tlLayerKeys on video and picture layers (a hidden matte layer still sent); the route's layerKeys on both", /function tlLayerKeys\(X, L\)/.test(tlx) && (tlx.match(/\.\.\.tlLayerKeys\(X, L\)/g) || []).length === 2 && /live\(L\) \|\| tlIsMatte\(X, L\)/.test(tlx) && (idx.match(/\.\.\.tlKeys\.layerKeys\(c\)/g) || []).length === 2);
  check("worker.py: every layer clip composited through _composite_ops in order (adjustment layers too)", /vprev = _composite_ops\(parts, ops, vprev, fw, fh, span, say\)/.test(w) && /ops\.append\(\{"fn": _adj_op\}\)/.test(w) && !/parts\.append\(f"\[\{vprev\}\]\[im\{i\}\]overlay/.test(w));
  check("tlblend.js loads after tlparent.js; no product names", ext.indexOf("tlblend.js") > ext.indexOf("tlparent.js") && !/After Effects|Adobe/.test(src.replace(/^\s*\*.*$/gm, "")));
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
