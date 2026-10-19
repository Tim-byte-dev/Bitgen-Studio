/* bitGen Studio — 2.489.0: THE GRAPH EDITOR'S MATHS - Bézier eases, Easy Ease, curved motion paths, the anchor point
 * (static/keyframes.js + its worker.py mirror, lib/clipTransform.js, ext/timelinedock/tlgraph.js + canvas.js).
 * After Effects gap item 1. The JS and the compile must draw the same curves. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, ".."), K = require(path.join(ROOT, "static", "keyframes.js")), CT = require(path.join(ROOT, "lib", "clipTransform.js"));
let pass = 0, fail = 0;
function check(name, ok, got) { if (ok) { pass++; console.log("PASS: " + name); } else { fail++; console.log("FAIL: " + name); if (got !== undefined) console.log("      got " + JSON.stringify(got).slice(0, 400)); } }
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const near = (a, b, t) => Math.abs(a - b) <= (t || 1e-9);

// --- the eases as Béziers
{
  let ok = true; for (let f = 0; f <= 1.0001; f += 0.05) ok = ok && near(K.bezier(K.bzOf({ ease: "in" }), f), K.ease("in", f), 1e-6) && near(K.bezier(K.bzOf({ ease: "out" }), f), K.ease("out", f), 1e-6) && near(K.bezier(K.bzOf({ ease: "inout" }), f), K.ease("inout", f), 1e-6) && near(K.bezier(K.bzOf({}), f), f, 1e-6);
  check("the old eases are exact Béziers (in / out / in-out / linear) - the graph editor can show and bend them", ok && K.bzOf({ ease: "hold" }) === null);
  const E = K.EASY; let mono = true, prev = -1; for (let f = 0; f <= 1.0001; f += 0.01) { const v = K.bezier(E, f); if (v < prev - 1e-9) mono = false; prev = v; }
  check("Easy Ease: starts and ends at rest, passes the middle at half way, never goes back", near(K.bezier(E, 0), 0) && near(K.bezier(E, 1), 1) && near(K.bezier(E, 0.5), 0.5, 1e-6) && mono && K.speed([{ at: 0, x: 0, ease: "bezier", bz: E }, { at: 1, x: 100 }], 0.01, "x", 0) < 10);
  const over = K.bezier([0.3, 1.6, 0.7, 1], 0.6);
  check("a handle above the line overshoots (y > 1 allowed)", over > 1, over);
  const kf = [{ at: 0, x: 0, y: 0, ease: "bezier", bz: [0.9, 0, 1, 1] }, { at: 2, x: 200, y: 0 }];
  check("value(): a bezier key tweens through its curve (a slow start: 10 % of the time → under 1 % of the way)", K.value(kf, 0.2, "x", 0) < 2 && near(K.value(kf, 2, "x", 0), 200), K.value(kf, 0.2, "x", 0));
}
// --- curved motion paths
{
  const kf = [{ at: 0, x: 0, y: 0, to: [0, -100] }, { at: 1, x: 100, y: 0, ti: [0, -100] }];
  check("motion path: handles bend the path (y = -75 half way, x still 50) - straight without them", near(K.value(kf, 0.5, "y", 0), -75) && near(K.value(kf, 0.5, "x", 0), 50) && near(K.value([{ at: 0, x: 0, y: 0 }, { at: 1, x: 100, y: 0 }], 0.5, "y", 0), 0));
  const n = K.normalize([{ at: 0, x: 0, y: 0, ax: 12, ay: -4, ease: "bezier", bz: [2, 9, -1, -9], to: [10, 5] }, { at: 1, x: 5, y: 5, ti: [1, 1] }, { at: 2, op: 0.5, ease: "bezier", bz: "bad" }, { at: 3, op: 1, to: [3, 3] }]);
  check("normalize: keeps the anchor, the Bézier (clamped) and the handles of position keys; a broken Bézier is dropped", n[0].ax === 12 && n[0].ay === -4 && n[0].ease === "bezier" && n[0].bz.join() === "1,3,0,-2" && n[0].to.join() === "10,5" && n[1].ti.join() === "1,1" && !n[2].ease && !n[2].bz && !n[3].to, n);
}
// --- the compile's mirror
{
  let s = 11; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const cases = [];
  for (let i = 0; i < 160; i++) {
    const keys = [], n = 2 + Math.floor(rnd() * 3); let at = 0;
    for (let j = 0; j < n; j++) { at += 0.2 + rnd() * 1.5; const k = { at: Math.round(at * 100) / 100, x: Math.round((rnd() - 0.5) * 800), y: Math.round((rnd() - 0.5) * 400), ax: Math.round((rnd() - 0.5) * 50) };
      const e = rnd(); if (e < 0.5) { k.ease = "bezier"; k.bz = [rnd(), rnd() * 2 - 0.5, rnd(), rnd() * 2 - 0.5].map((v) => Math.round(v * 1000) / 1000); } else if (e < 0.6) k.ease = "hold";
      if (rnd() < 0.5) k.to = [Math.round((rnd() - 0.5) * 300), Math.round((rnd() - 0.5) * 300)]; if (rnd() < 0.5) k.ti = [Math.round((rnd() - 0.5) * 300), Math.round((rnd() - 0.5) * 300)];
      keys.push(k); }
    cases.push({ kf: keys, at: Math.round(rnd() * 600) / 100 - 0.3 });
  }
  const js = cases.map((c) => [K.value(c.kf, c.at, "x", -1), K.value(c.kf, c.at, "y", -1), K.value(c.kf, c.at, "ax", 0)]);
  const tmp = path.join(os.tmpdir(), "h3aeg_" + process.pid + ".json"); fs.writeFileSync(tmp, JSON.stringify(cases));
  const py = execFileSync("python3", ["-c", [
    "import sys, json; sys.argv=['x']; sys.path.insert(0, '.'); import worker",
    "cases = json.load(open(" + JSON.stringify(tmp) + "))",
    "def if_(c, a, b): return a if c else b",
    "def lt(a, b): return 1 if a < b else 0",
    "def clip(v, lo, hi): return max(lo, min(hi, v))",
    "out = []",
    "for c in cases:",
    "    r = [worker._kf_value(c['kf'], c['at'], p, -1 if p != 'ax' else 0) for p in ('x', 'y', 'ax')]",
    "    e = worker._kf_expr(c['kf'], 'y', -1, 'T').replace('if(', 'if_(')",
    "    r.append(eval(e, {'if_': if_, 'lt': lt, 'clip': clip, 'T': c['at']}))",
    "    out.append(r)",
    "print(json.dumps(out))"].join("\n")], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 }).trim().split("\n").pop();
  fs.unlinkSync(tmp);
  const PY = JSON.parse(py);
  const bad = PY.map((r, i) => (near(r[0], js[i][0], 1e-6) && near(r[1], js[i][1], 1e-6) && near(r[2], js[i][2], 1e-6)) ? null : { i, js: js[i], py: r }).filter(Boolean);
  check("worker._kf_value = static/keyframes.js on 160 cases with Bézier eases, holds, motion-path handles and the anchor", bad.length === 0, bad.slice(0, 2));
  const far = PY.map((r, i) => Math.abs(r[3] - js[i][1])).reduce((a, b) => Math.max(a, b), 0);
  check(`...and the ffmpeg expression follows the curve (32 straight pieces per Bézier ease: within 1.5 px, worst ${far.toFixed(3)})`, far < 1.5, far);
  const out = execFileSync("python3", ["-c", ["import sys, json; sys.argv=['x']; sys.path.insert(0, '.'); import worker",
    "print(json.dumps([worker._tf_chain({'x': 100, 'y': 50, 'scale': 2, 'rot': 90, 'ax': 10, 'ay': 0}), worker._tf_chain({'x': 100, 'y': 50}), worker._kf_perspective([{'at': 0, 'x': 0, 'y': 0}, {'at': 1, 'x': 10, 'y': 0}], {'ax': 7, 'ay': -3}, 640, 360), worker._kf_moves([{'at': 0, 'ax': 3}, {'at': 1, 'ax': 5}])]))"].join("\n")], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").pop();
  const [tc, plain, persp, mv] = JSON.parse(out);
  check("compile, still layer: the anchor moves the box's centre by -R·scale·anchor (90°, x2, anchor 10 → centre 20 px up)", /\+\(100\.00\)/.test(tc[1]) && /\+\(30\.00\)/.test(tc[2]) && plain[1] === "+(100.00)" && plain[2] === "+(50.00)", [tc[1], tc[2]]);
  check("compile, moving layer: the corners pivot on the anchor; a keyed anchor counts as movement", /\(\(-1\*W\/2-\(7\.000000\)\)\*/.test(persp) && /\(\(-1\*H\/2-\(-3\.000000\)\)\*/.test(persp) && mv === true, persp.slice(0, 260));
}
{
  const out = execFileSync("python3", ["-c", ["import sys, json, os, tempfile; sys.argv=['x']; sys.path.insert(0, '.'); import worker",
    "d = tempfile.mkdtemp(); os.chdir(d)", "a = worker._fc_args('null'); b = worker._fc_args('x' * 70000)", "print(json.dumps([a, b, open(b[-1]).read() == 'x' * 70000]))"].join("\n")], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").pop();
  const [a, b, same] = JSON.parse(out);
  check("a long filter graph (big Bézier expressions) goes to ffmpeg from a file, a short one as an argument", a[0] === "-filter_complex" && a[1] === "null" && /^(-\/filter_complex|-filter_complex_script)$/.test(b[0]) && same, [a, b[0]]);
}
// --- the anchor in the canvas and the clean-up
{
  const n = CT.normalize({ x: 5, ax: 12.345, ay: 0 }), id = CT.normalize({ ax: 0.001 });
  check("clipTransform: keeps the anchor (rounded) only when set; an anchor alone is not 'no transform'", n.ax === 12.35 && n.ay === 0 && id === undefined && CT.normalize({ ax: 20 }).ax === 20 && !CT.isIdentity({ ax: 20 }));
  const cv = read("ext/timelinedock/canvas.js"), ext = JSON.parse(read("ext/timelinedock/ext.json")).scripts, g = read("ext/timelinedock/tlgraph.js");
  check("canvas.js: the anchor in tfOf / tfAt and box() (the centre = position - R·scale·anchor); the Bézier ease in the key row", /ax: num\(t\.ax, 0\)/.test(cv) && /KF\.value\(c\.kf, tau, "ax"/.test(cv) && /cx: S\.W \/ 2 \+ tf\.x - ox/.test(cv) && /\["bezier", "Bézier/.test(cv));
  check("the wiring: tlgraph.js loads last in the timeline; the graph, Easy Ease (F9), the motion path hooks", ext.includes("tlgraph.js") && /C\.onDraw\(/.test(g) && /C\.onGrab\(/.test(g) && /C\.onProps\(/.test(g) && /"F9"/.test(g));
  check("no product names in what users read", !/After Effects|Adobe|Premiere|Photoshop/.test(g.replace(/^\s*\*.*$/gm, "").replace(/\/\/.*$/gm, "")));
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
