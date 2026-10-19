// bitGen Studio — lib/environments.js: 360° environment references.
// The one thing that MUST hold: the yaw/pitch conventions of the extraction
// (ffmpeg v360) and of the 360 viewer (VR360.math) agree — what Tim frames
// in the viewer is what the render references. Pinned below with a synthetic
// pano and real ffmpeg runs. Run from repo root: node scripts/test-environments.js
const fs = require("fs");
const PAGE = require("../lib/extensions").pageHtml(require("path").join(__dirname, ".."));

const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const core = require(path.join(__dirname, "..", "lib", "core"));
const E = require(path.join(__dirname, "..", "lib", "environments"));
const C = require(path.join(__dirname, "..", "lib", "characters"));
require(path.join(__dirname, "..", "ext", "previewdock", "vr360.js"));
const VR = globalThis.VR360;

const PROJ = "envs-unit-tmp";
core.ensureProject(PROJ);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bgenv-"));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log("PASS: " + name); pass++; }
  else { console.log("FAIL: " + name + (extra !== undefined ? " -> " + JSON.stringify(extra) : "")); fail++; }
}

// a synthetic equirect pano: left half red, right half blue, and a green
// stripe centred on u=0.5 (the yaw-0 direction in BOTH conventions)
const pano = path.join(tmp, "pano.png");
execSync("ffmpeg -y -loglevel error"
  + " -f lavfi -i color=c=red:s=460x512 -f lavfi -i color=c=green:s=104x512"
  + " -f lavfi -i color=c=blue:s=460x512"
  + ' -filter_complex "[0][1][2]hstack=3" -frames:v 1 ' + pano);

/** The RGB of one pixel, via ffmpeg (no image deps in node). */
function px(file, x, y) {
  const raw = path.join(tmp, "px.rgb");
  execSync(`ffmpeg -y -loglevel error -i "${file}" -vf "crop=1:1:${x}:${y}"`
         + ` -f rawvideo -pix_fmt rgb24 "${raw}"`);
  const b = fs.readFileSync(raw);
  return [b[0], b[1], b[2]];
}
const dom = (rgb) => ["r", "g", "b"][rgb.indexOf(Math.max(...rgb))];

// ---- storage -------------------------------------------------------------
check("an environment needs a name", !!E.save({}, PROJ).error);
let sv = E.save({ name: "  Old Warehouse ", fov: 900, yaw: "15", scenes: "1:3" }, PROJ);
check("save slugs the name, defaults+clamps the camera, keeps the scene range",
      sv.ok && sv.env.name === "Old Warehouse" && sv.env.tag === "old_warehouse"
      && sv.env.fov === 140 && sv.env.yaw === 15 && sv.env.pitch === 0
      && sv.env.scenes === "1:3", sv.env);
check("list finds it; an absent project lists empty, never throws",
      E.list(PROJ).length === 1 && E.list("no-such-proj-xyz").length === 0);
check("extractView with no pano is a named error, not a crash",
      /no 360 pano/.test(E.extractView("Old Warehouse", PROJ).error || ""));
check("a non-image pano is refused",
      !!E.setPano("Old Warehouse", pano.replace(".png", ".txt"), "pano.txt", PROJ).error);
check("setPano stores the pano", E.setPano("Old Warehouse", pano, "pano.png", PROJ).ok
      && E.get("Old Warehouse", PROJ).pano === "pano.png");

// ---- the projection convention, pinned against the 360 viewer ------------
E.save({ name: "Old Warehouse", yaw: 0, pitch: 0, fov: 60 }, PROJ);
let v0 = E.extractView("Old Warehouse", PROJ, { width: 320, height: 240 });
check("extractView projects a view", v0.ok && fs.existsSync(v0.view), v0);
check("yaw 0 / pitch 0 looks at the CENTRE of the equirect frame (viewer's rule)",
      dom(px(v0.view, 160, 120)) === "g", px(v0.view, 160, 120));
check("…and the second extract is served from cache",
      E.extractView("Old Warehouse", PROJ, { width: 320, height: 240 }).cached === true);
E.save({ name: "Old Warehouse", yaw: 90, fov: 60 }, PROJ);
let v90 = E.extractView("Old Warehouse", PROJ, { width: 320, height: 240 });
check("changing the camera invalidates the cache", v90.ok && !v90.cached);
const u90 = VR.math.uv(VR.math.dir(Math.PI / 2, 0))[0];
check("VR360.math says +90° yaw is u=0.75 of the frame", Math.abs(u90 - 0.75) < 1e-6, u90);
check("ffmpeg agrees: the +90° view sees the right half (one convention, two consumers)",
      dom(px(v90.view, 160, 120)) === "b", px(v90.view, 160, 120));
E.save({ name: "Old Warehouse", yaw: -90, fov: 60 }, PROJ);
check("-90° yaw sees the left half",
      dom(px(E.extractView("Old Warehouse", PROJ, { width: 320, height: 240 }).view,
             160, 120)) === "r");

// ---- the chain: environments ride it, after the cast ---------------------
const base = {
  "10": { class_type: "MiniMaxH3ScheduledReferenceToVideo",
          inputs: { prompt: "x", reference_schedule: ["99", 0] } },
  "99": { class_type: "MiniMaxH3ScheduledPictureReference",
          inputs: { tag: "demo", scenes: "all", image: ["98", 0] } },
  "98": { class_type: "LoadImage", inputs: { image: "demo.png" } },
};
const cast = [{ name: "Jinx", tag: "jinx", images: ["sheet.png"], voices: [] }];
const es = [{ name: "Old Warehouse", tag: "old_warehouse", scenes: "1:3", view: "view.png" },
            { name: "NoPano", tag: "nopano", scenes: "all", view: "" }];
const r = C.buildChain(base, cast, (c, f) => f, es);
const env0 = r.graph.env_pic_0;
check("the environment becomes a scheduled picture reference with its tag and range",
      env0 && env0.class_type === "MiniMaxH3ScheduledPictureReference"
      && env0.inputs.tag === "old_warehouse" && env0.inputs.scenes === "1:3", env0);
check("it references the extracted VIEW, never the raw pano",
      r.graph.env_img_0 && r.graph.env_img_0.inputs.image === "view.png");
check("the environment chains AFTER the cast (character Picture numbering never shifts)",
      env0.inputs.previous && String(env0.inputs.previous[0]) === "char_pic_0"
      && r.tail === "env_pic_0", env0.inputs.previous);
check("…and the consumer's schedule points at the new tail",
      String(r.graph["10"].inputs.reference_schedule[0]) === "env_pic_0");
check("loader insertion order keeps env after cast (worker slot alignment)",
      Object.keys(r.graph).indexOf("char_img_0") < Object.keys(r.graph).indexOf("env_img_0"));
check("an environment with no view is a named note, not a node",
      !r.graph.env_pic_1 && r.notes.some((n) => /NoPano: no extracted view/.test(n)),
      r.notes);
check("no environments at all changes nothing (old callers unaffected)",
      C.buildChain(base, cast, (c, f) => f).tail === "char_pic_0");

// ---- the screenplay validator knows locations ----------------------------
const sp = require(path.join(__dirname, "..", "lib", "screenplay"));
const vplan = { prompt_prefix: ["subject_definitions:"],
  shots: [{ id: "clip_01", prompt: ["[Shot 1] @jinx in @old_warehouse."], length: 39 }] };
check("an environment tag in a shot validates (it is a real reference on the chain)",
      sp.validate(vplan, cast, es).ok === true);
check("the same tag without the environment is still unknown",
      sp.validate(vplan, cast).ok === false);
const vtalk = { prompt_prefix: ["subject_definitions:"],
  shots: [{ id: "clip_01", prompt: ["@old_warehouse (S1), softly:", "<d>[English] hi</d>"], length: 39 }] };
check("a location cannot speak — a speaker line addressed to one is an error",
      sp.validate(vtalk, cast, es).ok === false
      && sp.validate(vtalk, cast, es).errors.some((e) => /cannot speak/.test(e)));
check("the guide names the environments so the model keeps their wording",
      /@old_warehouse: a real referenced location \(scenes 1:3\)/.test(sp.guide(cast, es)));

// ---- 2.213.0: EXR / Radiance-HDR panos tone-map ONCE at upload -----------
// (Tim: "can we use exr 360degree files for location background") — the
// stored pano must come out a REAL 8-bit PNG (the browser viewer cannot
// decode EXR and the chain is 8-bit), mid-tones must survive the Hable
// operator and highlights must COMPRESS, never clip flat or wrap. The HDR
// files are handcrafted here byte-by-byte (the same trick the e2e uses for
// PNGs) so the leg needs no encoder and can never silently skip.
{
  const w = 16, h = 8;                       // left = 0.18 linear, right = 8.0
  const val = (x) => (x < w / 2 ? 0.18 : 8.0);
  // minimal scanline OpenEXR: FLOAT channels B,G,R, no compression
  const exrAttr = (name, typ, data) => Buffer.concat([
    Buffer.from(name + "\0" + typ + "\0"),
    (() => { const b = Buffer.alloc(4); b.writeInt32LE(data.length); return b; })(),
    data]);
  const exrChan = (name) => { const b = Buffer.alloc(name.length + 1 + 16);
    b.write(name); b.writeInt32LE(2, name.length + 1);
    b.writeInt32LE(1, name.length + 9); b.writeInt32LE(1, name.length + 13);
    return b; };
  const dw = Buffer.alloc(16);
  dw.writeInt32LE(w - 1, 8); dw.writeInt32LE(h - 1, 12);
  const f32 = (v) => { const b = Buffer.alloc(4); b.writeFloatLE(v); return b; };
  let head = Buffer.concat([Buffer.from([0x76, 0x2f, 0x31, 0x01, 2, 0, 0, 0]),
    exrAttr("channels", "chlist",
            Buffer.concat([exrChan("B"), exrChan("G"), exrChan("R"), Buffer.from([0])])),
    exrAttr("compression", "compression", Buffer.from([0])),
    exrAttr("dataWindow", "box2i", dw),
    exrAttr("displayWindow", "box2i", dw),
    exrAttr("lineOrder", "lineOrder", Buffer.from([0])),
    exrAttr("pixelAspectRatio", "float", f32(1)),
    exrAttr("screenWindowCenter", "v2f", Buffer.concat([f32(0), f32(0)])),
    exrAttr("screenWindowWidth", "float", f32(1)),
    Buffer.from([0])]);
  const scan = 8 + w * 4 * 3, off0 = head.length + 8 * h;
  const offs = Buffer.alloc(8 * h);
  for (let y = 0; y < h; y++) offs.writeBigUInt64LE(BigInt(off0 + y * scan), y * 8);
  const rows = [];
  for (let y = 0; y < h; y++) {
    const rh = Buffer.alloc(8); rh.writeInt32LE(y); rh.writeInt32LE(w * 4 * 3, 4);
    rows.push(rh);
    for (let c = 0; c < 3; c++)                       // B, G, R — same grey
      for (let x = 0; x < w; x++) rows.push(f32(val(x)));
  }
  const exrFile = path.join(tmp, "probe.exr");
  fs.writeFileSync(exrFile, Buffer.concat([head, offs, ...rows]));
  // minimal flat (non-RLE) Radiance RGBE with the same two-tone content
  const rgbe = (v) => { let e = Math.ceil(Math.log2(v));
    while (v / Math.pow(2, e) >= 1) e++;               // frexp: v = f*2^e, f in [0.5,1)
    const s = 256 / Math.pow(2, e);
    const m = Math.min(255, Math.floor(v * s));
    return Buffer.from([m, m, m, e + 128]); };
  const hdrRows = [Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`)];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) hdrRows.push(rgbe(val(x)));
  const hdrFile = path.join(tmp, "probe.hdr");
  fs.writeFileSync(hdrFile, Buffer.concat(hdrRows));
  // rgb24 pixel readback through ffmpeg — no PNG decoder needed in node
  const px = (png, x, y) => {
    const raw = require("child_process").execSync(
      `ffmpeg -loglevel error -i "${png}" -f rawvideo -pix_fmt rgb24 -`,
      { maxBuffer: 1 << 24 });
    return raw[(y * w + x) * 3];
  };
  for (const [ext, file] of [["exr", exrFile], ["hdr", hdrFile]]) {
    const r = E.setPano("Old Warehouse", file, `pano.${ext}`, PROJ);
    check(`a .${ext} pano is accepted and CONVERTED (never stored raw)`,
          r.ok === true && r.converted === true && r.env.pano === "pano.png", r);
    const stored = path.join(E.envDir("Old Warehouse", PROJ), "pano.png");
    const magic = fs.readFileSync(stored).subarray(0, 8);
    check(`…the stored .${ext} pano is a REAL PNG (magic bytes)`,
          magic.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
          magic.toString("hex"));
    const grey = px(stored, 2, 4), hot = px(stored, 13, 4);
    check(`…mid-grey survives the tonemap as a mid-tone (.${ext})`,
          grey > 40 && grey < 200, { grey });
    check(`…the 8.0 highlight COMPRESSES — brighter than grey, below a clipped 255 (.${ext})`,
          hot > grey + 60 && hot < 255, { grey, hot });
  }
  // a corrupt HDR file refuses in words AND the previous pano survives
  const junk = path.join(tmp, "junk.exr");
  fs.writeFileSync(junk, Buffer.from("not an exr at all"));
  const bad = E.setPano("Old Warehouse", junk, "junk.exr", PROJ);
  check("a corrupt .exr refuses with the ffmpeg reason",
        !!bad.error && /tone-map/.test(bad.error), bad);
  check("…and the location KEEPS its working pano (convert-first, swap-after)",
        E.get("Old Warehouse", PROJ).pano === "pano.png"
        && fs.existsSync(path.join(E.envDir("Old Warehouse", PROJ), "pano.png")));
  check("…with no staging leftovers reported as the pano",
        !fs.existsSync(path.join(E.envDir("Old Warehouse", PROJ), ".pano-convert.png")));
  // the picker enumerates types — the HDR extensions listed, the old
  // wildcard (and its comment-stripper hazard) gone
  const HTML = PAGE;
  const inp = (HTML.match(/<input id="envPanoFile"[^>]+>/) || [""])[0];
  check("the pano picker lists .exr and .hdr with enumerated image types",
        /\.exr/.test(inp) && /\.hdr/.test(inp)
        && /image\/png/.test(inp) && !/image\/\*/.test(inp), inp);
}

fs.rmSync(core.projDir(PROJ), { recursive: true, force: true });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
