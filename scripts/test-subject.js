/* bitGen Studio — 2.488.0: SELECT SUBJECT WITHOUT A DOWNLOAD + WITH THE AI MATTE (ext/imageeditdock/pcsubject.js,
 * lib/subjectMatte.js, routes/subject.js, scripts/subject_matte.py) - the image editor's gap, round H. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os"), { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, ".."), S = require(path.join(ROOT, "ext", "imageeditdock", "pcsubject.js"));
let pass = 0, fail = 0;
function check(name, ok, got) { if (ok) { pass++; console.log("PASS: " + name); } else { fail++; console.log("FAIL: " + name); if (got !== undefined) console.log("      got " + JSON.stringify(got).slice(0, 400)); } }
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
let seed = 5; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function pic(W, H, f) { const d = new Uint8ClampedArray(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, c = f(x, y); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; } return d; }
function iou(m, W, H, truth) { let a = 0, u = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = m[y * W + x] > 127, t = truth(x, y); if (s && t) a++; if (s || t) u++; } return a / u; }

{
  const W = 400, H = 300, t = (x, y) => (x - 210) ** 2 / 90 ** 2 + (y - 160) ** 2 / 110 ** 2 < 1;
  const d = pic(W, H, (x, y) => { const n = (rnd() - 0.5) * 20; return t(x, y) ? [200 + n, 90 + n, 40 + n] : [60 + x / 8 + n, 110 + y / 10 + n, 150 + n]; });
  const v = iou(S.subjectMask(d, W, H, {}), W, H, t);
  check(`built in: an orange subject on a grainy blue-green gradient (IoU ${v.toFixed(3)} ≥ 0.95)`, v >= 0.95, v);
}
{
  const W = 360, H = 400, head = (x, y) => (x - 120) ** 2 + (y - 120) ** 2 < 55 ** 2, body = (x, y) => x > 60 && x < 180 && y > 170 && y < 400, t = (x, y) => head(x, y) || body(x, y);
  const d = pic(W, H, (x, y) => { const n = (rnd() - 0.5) * 16; return head(x, y) ? [225 + n, 180 + n, 150 + n] : body(x, y) ? [40 + n, 60 + n, 120 + n] : [235 + n, 235 + n, 230 + n]; });
  const v = iou(S.subjectMask(d, W, H, {}), W, H, t);
  check(`built in: a two-coloured figure (head + body), off-centre, standing on the bottom edge, on a pale backdrop (IoU ${v.toFixed(3)} ≥ 0.9)`, v >= 0.9, v);
}
{
  const W = 300, H = 300, t = (x, y) => x > 90 && x < 210 && y > 80 && y < 230;
  const d = pic(W, H, (x, y) => { const n = (rnd() - 0.5) * 10; if (t(x, y)) return [30 + n, 160 + n, 60 + n]; return ((x >> 3) & 1) ? [200 + n, 200 + n, 200 + n] : [150 + n, 150 + n, 160 + n]; });
  const v = iou(S.subjectMask(d, W, H, {}), W, H, t);
  check(`built in: a green subject on a striped background (IoU ${v.toFixed(3)} ≥ 0.9)`, v >= 0.9, v);
}
{
  const W = 200, H = 150, d = pic(W, H, () => [128, 128, 128]); const m = S.subjectMask(d, W, H, {}); let n = 0; for (const v of m) if (v > 127) n++;
  check("built in: a plain picture has no subject to speak of (≤ 5 %)", n / (W * H) <= 0.05, n / (W * H));
}
{
  const v = []; for (let i = 0; i < 500; i++) v.push(0.2 + (rnd() - 0.5) * 0.05); for (let i = 0; i < 500; i++) v.push(0.8 + (rnd() - 0.5) * 0.05);
  const t = S.otsu(Float32Array.from(v)); check("Otsu: between two groups", t > 0.3 && t < 0.7, t);
  const m = Uint8Array.from([1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]), C = S.components(m, 4, 3, 1);
  check("components: two parts - one on the edge, one inside", C.sizes.length === 2 && C.sizes[0] === 2 && C.touches[0] === true && C.touches[1] === false, C);
  const W = 40, H = 10, I = new Float32Array(W * H), p = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { I[y * W + x] = x < 20 ? 0.1 : 0.9; p[y * W + x] = Math.max(0, Math.min(1, (x - 14) / 12)); }
  const q = S.guidedFilter(I, p, W, H, 4, 1e-3);
  check("guided filter: a soft mask snaps towards the picture's edge (lower before it, higher after it)", q[5 * W + 17] < p[5 * W + 17] - 0.03 && q[5 * W + 22] > p[5 * W + 22] + 0.03, [q[5 * W + 17], p[5 * W + 17], q[5 * W + 22], p[5 * W + 22]]);
}
// --- the AI matte on the server (its stand-in without the model)
(async () => {
  const M = require(path.join(ROOT, "lib", "subjectMatte.js"));
  let e1 = null; try { await M.run(Buffer.from("nope"), {}); } catch (e) { e1 = e; }
  check("AI matte: anything but a PNG is refused (400)", e1 && e1.status === 400);
  const st = M.status();
  check("AI matte: the status names the models (BiRefNet first)", Array.isArray(st.models) && st.models[0] === "birefnet-general" && typeof st.ai === "boolean");
  if (!st.ai) { let e2 = null; const png = spawnSync("python3", ["-I", "-c", "from PIL import Image;import io,sys;b=io.BytesIO();Image.new('RGB',(8,8)).save(b,'PNG');sys.stdout.buffer.write(b.getvalue())"]).stdout; try { await M.run(png, {}); } catch (e) { e2 = e; } check("AI matte: not installed - a clear 409 that says how to install it", e2 && e2.status === 409 && /Install/.test(e2.message)); }
  const mk = spawnSync("python3", ["-I", "-c", "from PIL import Image, ImageDraw;import io,sys;im=Image.new('RGB',(120,90),(240,240,240));ImageDraw.Draw(im).ellipse((30,20,90,70),fill=(200,40,40));b=io.BytesIO();im.save(b,'PNG');sys.stdout.buffer.write(b.getvalue())"]);
  if (mk.status === 0) {
    const out = await M.run(mk.stdout, { fake: true });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-sm-")), f = path.join(tmp, "m.png"); fs.writeFileSync(f, out);
    const r = spawnSync("python3", ["-I", "-c", "import sys,json;from PIL import Image;im=Image.open(sys.argv[1]);print(json.dumps([im.mode, im.size, im.getpixel((60,45)), im.getpixel((5,5))]))", f], { encoding: "utf8" });
    const [mode, size, mid, corner] = JSON.parse(r.stdout || "[null,[0,0],0,0]");
    check("AI matte (the stand-in): a grey mask the picture's size - the subject white, the backdrop black", mode === "L" && size[0] === 120 && mid === 255 && corner === 0, [mode, size, mid, corner]);
    fs.rmSync(tmp, { recursive: true, force: true });
  } else console.log("SKIP: Pillow is not here");
  // --- the wiring
  const ext = JSON.parse(read("ext/imageeditdock/ext.json")).scripts, ie = read("ext/imageeditdock/imageedit.js"), idx = read("routes/index.js"), rt = read("routes/subject.js"), src = read("ext/imageeditdock/pcsubject.js") + read("lib/subjectMatte.js") + rt;
  check("the wiring: pcsubject.js before imageedit.js and installed; routes/subject.js mounted from routes/index.js (not server.js); the stand-in only with H3_E2E", ext.indexOf("pcsubject.js") > 0 && ext.indexOf("pcsubject.js") < ext.indexOf("imageedit.js") && /win\.PCSubject\.install\(E\)/.test(ie) && /require\("\.\/subject"\)\.mount\(app\)/.test(idx) && !/subject/.test(read("misc/server.js")) && /process\.env\.H3_E2E === "1"/.test(rt) && /modelsDir \}/.test(read("lib/matte.js")));
  check("no product names in what users read", !/Photoshop|Adobe|Corel|Illustrator|Lightroom/.test(src));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
