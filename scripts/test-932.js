#!/usr/bin/env node
/* bitGen Studio — 2.932.0 units: 👗 the Garment designer (no Python - the pattern script is stood in for).
 * static/garmentspec.js (flat / value / build / changed / groups / preset / bodyFor / labels), lib/garment/presets.json against
 * the design tree, the mannequins' measurements, lib/garmentAi.js (words -> settings, the LLM stood in for), lib/garmentPdf.js
 * (offset, layout, a real PDF read back), lib/garment.js (make / list / get / pdf / remove / file names) and
 * lib/garmentAddon.js (status, install steps with a stand-in run). The real GarmentCode run: scripts/test-932-live.js. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const ROOT = path.join(__dirname, "..");
const SP = require(path.join(ROOT, "static", "garmentspec.js"));
const tree = JSON.parse(fs.readFileSync(path.join(ROOT, "lib", "garment", "schema.json"), "utf8")).design;
const presets = JSON.parse(fs.readFileSync(path.join(ROOT, "lib", "garment", "presets.json"), "utf8")).presets;

(async () => {
  /* ---- the shared rules */
  const fl = SP.flat(tree);
  check("the design tree: every GarmentCode setting as a leaf (over 100), meta.upper first", fl.length > 100 && fl[0].path === "meta.upper" && fl.some((f) => f.path === "sleeve.cuff.cuff_len"), fl.length);
  const L = (p) => SP.leafAt(tree, p);
  check("value(): numbers clamped to the range (sleeve length 5 -> 1.15, -1 -> 0.1), int rounded, text numbers read",
    SP.value(L("sleeve.length"), 5) === 1.15 && SP.value(L("sleeve.length"), -1) === 0.1 && SP.value(L("sleeve.sleeve_angle"), 22.6) === 23 && SP.value(L("sleeve.length"), "0.5") === 0.5);
  check("…a select keeps only its own choices (else the default), select_null takes null, bools",
    SP.value(L("meta.bottom"), "Pants") === "Pants" && SP.value(L("meta.bottom"), "Kilt") === null && SP.value(L("meta.upper"), null) === null
    && SP.value(L("collar.f_collar"), "Nope") === "CircleNeckHalf" && SP.value(L("sleeve.sleeveless"), "false") === false && SP.value(L("flare-skirt.skirt-many-panels.panel_curve"), "0.25") === 0.25);
  const built = SP.build(tree, { "meta.upper": "Shirt", "sleeve.length": 9, "nope.x": 1 });
  check("build(): a full tree with the values set (checked), the tree itself untouched", built.meta.upper.v === "Shirt" && built.sleeve.length.v === 1.15 && tree.meta.upper.v === null && !built.nope);
  check("changed(): only what differs from the default", JSON.stringify(SP.changed(tree, { "meta.upper": "Shirt", "sleeve.length": 0.3, "shirt.width": 1.05 })) === JSON.stringify({ "meta.upper": "Shirt" }));
  check("groups(): a top = top / collar / sleeves / left; trousers = pants; a waistband; a tiered skirt brings its base + level groups",
    SP.groups({ "meta.upper": "Shirt" }).join() === "meta,shirt,collar,sleeve,left" && SP.groups({ "meta.bottom": "Pants", "meta.wb": "StraightWB" }).join() === "meta,waistband,pants"
    && SP.groups({ "meta.bottom": "SkirtLevels", "levels-skirt.base": "PencilSkirt", "levels-skirt.level": "SkirtCircle" }).join() === "meta,levels-skirt,pencil-skirt,flare-skirt",
    [SP.groups({ "meta.bottom": "SkirtLevels", "levels-skirt.base": "PencilSkirt", "levels-skirt.level": "SkirtCircle" })]);
  check("labels: words for settings and choices; a logo-named choice is hidden; every group has a name",
    SP.label("sleeve.cuff.cuff_len") === "Cuff length" && SP.label("left.sleeve.length") === "Length (left)" && SP.optionLabel("Hood2Panels") === "Hood"
    && SP.optionLabel(null) === "None" && SP.hidden("Some_logo") && !SP.hidden("Sun") && fl.every((f) => SP.GROUPS[f.group]));

  /* ---- bitGen's presets */
  const bad = [];
  for (const p of presets) for (const [k, v] of Object.entries(p.set)) { const leaf = L(k); if (!leaf || SP.value(leaf, v) !== v) bad.push(p.id + ":" + k); }
  check("presets: 12 kinds, each a top, a waistband or a bottom, every path in the tree and every value inside its range",
    presets.length === 12 && !bad.length && presets.every((p) => p.set["meta.upper"] || p.set["meta.bottom"] || p.set["meta.wb"]) && new Set(presets.map((p) => p.id)).size === 12, bad);
  check("preset(): {path: v} of one (a copy); unknown = {}", SP.preset(presets, "trousers")["meta.bottom"] === "Pants" && JSON.stringify(SP.preset(presets, "nope")) === "{}");

  /* ---- the mannequins' measurements */
  const M = {};
  for (const s of ["female", "male"]) M[s] = JSON.parse(fs.readFileSync(path.join(ROOT, "static", "mannequins", "mesh", s + ".measure.json"), "utf8"));
  const keys = Object.keys(M.female.body).sort();
  const meshH = (s) => JSON.parse(fs.readFileSync(path.join(ROOT, "static", "mannequins", "mesh", s + ".json"), "utf8")).height_m * 100;
  check("mannequins: the 26 GarmentCode measurements each, the same keys, height = the mesh's, measured on our mesh",
    keys.length === 26 && JSON.stringify(Object.keys(M.male.body).sort()) === JSON.stringify(keys) && ["female", "male"].every((s) => Math.abs(M[s].body.height - meshH(s)) < 1)
    && ["height", "bust", "underbust", "waist", "hips", "leg_circ", "wrist"].every((k) => k in M.female.measured && k in M.male.measured), keys);
  check("…plausible figures (cm): female slimmer than male, waist < bust and hips, thigh and wrist in human ranges",
    ["female", "male"].every((s) => { const b = M[s].body; return b.waist < b.bust && b.waist < b.hips && b.leg_circ > 40 && b.leg_circ < 75 && b.wrist > 11 && b.wrist < 21 && b.bust > 75 && b.bust < 125; })
    && M.female.body.height < M.male.body.height && M.female.body.waist < M.male.body.waist, [M.female.measured, M.male.measured]);
  const fb = M.female.body, mine = SP.bodyFor(fb, { height: fb.height * 1.1, bust: 100 });
  check("bodyFor(): your height scales the lengths (arm, neck width), your bust the underbust + back width; limits kept",
    Math.abs(mine.arm_length - fb.arm_length * 1.1) < 0.01 && Math.abs(mine.neck_w - fb.neck_w * 1.1) < 0.01 && mine.bust === 100
    && Math.abs(mine.underbust - fb.underbust * 100 / fb.bust) < 0.01 && mine.waist === fb.waist && SP.bodyFor(fb, { height: 400 }).height === 220 && fb.bust !== 100);

  /* ---- words -> settings */
  const AI = require(path.join(ROOT, "lib", "garmentAi.js"));
  const w = (t) => AI.byWords(t);
  let r = w("a knee-length A-line skirt with a waistband");
  check("byWords: a knee-length A-line skirt -> the A-line preset at knee length", r.preset === "aline" && r.set["flare-skirt.length"] === 0.45 && r.set["meta.wb"] === "StraightWB", r);
  r = w("cropped oversized t-shirt with long sleeves");
  check("…a cropped oversized T-shirt with long sleeves -> the long-sleeve top, length 0.7, width 1.25, sleeves 1.0", r.preset === "longsleeve" && r.set["shirt.length"] === 0.7 && r.set["shirt.width"] === 1.25 && r.set["sleeve.length"] === 1 && r.set["sleeve.sleeveless"] === false, r);
  check("…a maxi sundress, wide-leg trousers, a V-neck dress, a hoodie, a jumpsuit",
    w("maxi sundress").set["flare-skirt.length"] === 0.95 && w("wide-leg trousers").set["pants.width"] === 1.4 && w("v-neck fitted dress").set["collar.f_collar"] === "VNeckHalf"
    && w("grey hoodie").preset === "hoodie" && w("denim jumpsuit").preset === "jumpsuit" && w("a blue thing").preset === null);
  check("parse(): the JSON in an answer (thinking + code fences round it), else null",
    AI.parse('<think>hm</think>```json\n{"preset":"tank","set":{}}\n```').preset === "tank" && AI.parse("no json") === null);
  const P = AI.prompt(tree, SP.valuesOf(tree), "a hoodie", presets);
  check("prompt(): presets + settings with ranges and words; the left side and curve handles left out unless asked; no logo choices",
    /hoodie = Hoodie/.test(P) && /sleeve\.length \(Length\): 0\.1\.\.1\.15 = 0\.3/.test(P) && !/left\.sleeve/.test(P) && !/f_bezier/.test(P) && !/_logo/.test(P)
    && /left\.sleeve/.test(AI.prompt(tree, {}, "asymmetric one-shoulder top", presets)));
  AI.setComplete(async () => ({ ok: true, text: '{"preset": "hoodie", "set": {"sleeve.length": 5, "nope.x": 1, "collar.f_collar": "VNeckHalf"}, "name": "Cosy hoodie", "say": "A hoodie with a V-neck."}' }));
  r = await AI.describe("a cosy hoodie with a v-neck", {});
  check("describe(): the LLM's preset + changes, each checked (5 -> 1.15), an unknown path dropped, its name + sentence",
    r.by === "llm" && r.preset === "hoodie" && r.values["meta.upper"] === "Shirt" && r.values["collar.component.style"] === "Hood2Panels" && r.values["sleeve.length"] === 1.15
    && r.values["collar.f_collar"] === "VNeckHalf" && r.dropped.join() === "nope.x" && r.name === "Cosy hoodie", r);
  AI.setComplete(async () => ({ ok: true, text: '{"preset": null, "set": {"sleeve.length": 0.75}}' }));
  r = await AI.describe("three-quarter sleeves please", { "meta.upper": "Shirt", "sleeve.sleeveless": false });
  check("…no preset = a change on the garment as it is (the top kept)", r.by === "llm" && r.values["meta.upper"] === "Shirt" && r.values["sleeve.length"] === 0.75 && r.values["sleeve.sleeveless"] === false, r);
  AI.setComplete(async () => ({ ok: false, error: "llama-server is not running" }));
  r = await AI.describe("short shorts", {});
  check("…no LLM -> bitGen reads the words (by 'words', the reason kept)", r.by === "words" && r.preset === "shorts" && /not running/.test(r.note), r);
  let threw = null; try { await AI.describe("a blue thing", {}, { noLlm: true }); } catch (e) { threw = e; }
  check("…words that name no garment -> 422 asking which", threw && threw.status === 422 && /which garment/.test(threw.message));
  AI.setComplete(null);

  /* ---- the PDF */
  const PDF = require(path.join(ROOT, "lib", "garmentPdf.js"));
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const big = PDF.offset(sq, 1);
  check("offset(): a 10 cm square grows to 12 x 12 with 1 cm (outward either way round)", Math.abs(PDF.area(big) - 144) < 0.01 && Math.abs(Math.abs(PDF.area(PDF.offset(sq.slice().reverse(), 1))) - 144) < 0.01, big);
  check("letters(): A, Z, AA, AB", PDF.letters(0) === "A" && PDF.letters(25) === "Z" && PDF.letters(26) === "AA" && PDF.letters(27) === "AB");
  const rect = (w0, h0) => { const pts = []; for (let i = 0; i < 4; i++) pts.push([[0, 0], [w0, 0], [w0, h0], [0, h0]][i]); return pts; };
  const panel = (name, w0, h0, rz) => ({ name, outline: rect(w0, h0), rotation: [0, 0, rz || 0],
    edges: [{ at: [0, 1] }, { at: [1, 2] }, { at: [2, 3] }, { at: [3, 4] }] });
  const outline = { name: "fixture", panels: [panel("left_ftorso", 25, 60), panel("left_btorso", 25, 60), panel("left_sleeve_f", 30, 20, 45)],
    stitches: [[{ panel: "left_ftorso", edge: 1 }, { panel: "left_btorso", edge: 3 }], [{ panel: "left_ftorso", edge: 2 }, { panel: "left_sleeve_f", edge: 0 }]] };
  const lay = PDF.layout(outline, { paper: "a4", sa: 1.5 });
  const ps = PDF.pieces(outline, 1.5);
  check("layout(): every piece placed, none wider than the canvas, no two overlapping; seams lettered A / B on both sides; a sleeve's grain along its length",
    lay.at.length === 3 && lay.at.every((a) => a.x + a.p.box.w <= lay.W) && lay.at.every((a, i) => lay.at.every((b, j) => i === j || a.x + a.p.box.w <= b.x || b.x + b.p.box.w <= a.x || a.y + a.p.box.h <= b.y || b.y + b.p.box.h <= a.y))
    && ps[0].notches.map((n) => n.letter).join() === "A,B" && ps[1].notches[0].letter === "A" && ps[2].grain[0] === 1 && ps[0].grain[1] === 1 && Math.abs(ps[0].box.w - 28) < 0.01, lay.at.map((a) => [a.x, a.y, a.p.box.w, a.p.box.h]));
  const out = await PDF.pdf(outline, { paper: "a4", sa: 1.5, title: "Fixtüre ✓", body: { sex: "female", height: 170, bust: 88, waist: 63, hips: 91 } });
  const Lib = require(path.join(ROOT, "static", "vendor", "pdf-lib.min.js"));
  const doc = await Lib.PDFDocument.load(out.bytes);
  const sz = doc.getPage(0).getSize();
  check("pdf(): a real PDF - the cover + cols x rows pages, A4 in points (595 x 842), a title that is not Latin-1 written safely (ü -> u, ✓ dropped)",
    Buffer.from(out.bytes).slice(0, 5).toString() === "%PDF-" && doc.getPageCount() === out.pages && out.pages === 1 + lay.cols * lay.rows && Math.round(sz.width) === 595 && Math.round(sz.height) === 842
    && doc.getTitle() === "Fixture - sewing pattern", [out.pages, sz, doc.getTitle()]);
  const a0 = await PDF.pdf(outline, { paper: "a0", sa: 0 });
  check("…A0 (copy shop): the whole pattern on one sheet + the cover", a0.pages === 2 && a0.sheets.join() === "1,1", a0.sheets);
  check("…the 10 cm test square is 283.46 pt (72 / 2.54 per cm)", Math.abs(PDF.CM * 10 - 283.4646) < 0.001);

  /* ---- the store (the pattern script stood in for) */
  const G = require(path.join(ROOT, "lib", "garment.js"));
  const seen = [];
  const deps = { runtime: { python: process.execPath, src: "/gc", script: "/garment_pattern.py" }, run: async (cmd, args, o) => {
    const req = JSON.parse(fs.readFileSync(args[1], "utf8")); seen.push(req);
    if (req.design.meta.bottom.v === "SkirtLevels") { o.log('GARMENT {"ok": false, "error": "Levels need a base"}'); return 1; }
    fs.writeFileSync(path.join(req.out, "outline.json"), JSON.stringify(outline));
    fs.writeFileSync(path.join(req.out, "pattern.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
    o.log("some warning from numpy");
    o.log('GARMENT {"ok": true, "panels": 3, "stitches": 2, "self_intersecting": false, "size_cm": [80, 60], "files": {"svg": "pattern.svg", "outline": "outline.json"}}');
    return 0;
  } };
  const g = await G.make({ name: "T932 Fixture dress", values: { "meta.upper": "FittedShirt", "meta.bottom": "PencilSkirt", "sleeve.length": 9 }, body: { sex: "male", height: 190 } }, deps);
  const sent = seen[0];
  check("make(): the script gets the full design (checked values), the body moved onto your height, a name; kept as t932-fixture-dress",
    g.slug === "t932-fixture-dress" && sent.op === "make" && sent.src === "/gc" && sent.design.meta.upper.v === "FittedShirt" && sent.design.sleeve.length.v === 1.15
    && sent.body.height === 190 && Math.abs(sent.body.arm_length - M.male.body.arm_length * 190 / M.male.body.height) < 0.01 && g.panels === 3 && g.urls.svg === "/api/garment/file/t932-fixture-dress/pattern.svg", { g, body: sent.body.height });
  check("…list() / get() have it, its values only the changes (sleeve.length 1.15 kept as changed)", G.list().some((x) => x.slug === g.slug) && G.get(g.slug).values["sleeve.length"] === 1.15 && G.get(g.slug).body.sex === "male");
  const pd = await G.pdf(g.slug, { paper: "letter", sa: 1 });
  check("pdf(slug): pattern-letter-sa10mm.pdf beside it, served by fileOf, listed with the garment",
    pd.name === "pattern-letter-sa10mm.pdf" && fs.existsSync(G.fileOf(g.slug, pd.name)) && G.get(g.slug).pdfs.some((x) => x.name === pd.name) && pd.pages === 1 + pd.sheets[0] * pd.sheets[1], pd);
  let e1 = null, e2 = null, e3 = null;
  try { G.fileOf(g.slug, "../../custom.settings"); } catch (e) { e1 = e; }
  try { G.dirOf("../x"); } catch (e) { e2 = e; }
  try { await G.make({ name: "T932 levels", values: { "meta.bottom": "SkirtLevels" } }, deps); } catch (e) { e3 = e; }
  check("file names / slugs outside the garment refused; GarmentCode's own refusal said (422), nothing kept",
    e1 && e1.status === 404 && e2 && e2.status === 400 && e3 && e3.status === 422 && /Levels need a base/.test(e3.message) && !G.list().some((x) => x.slug === "t932-levels"));
  let e4 = null; try { await G.make({ name: "T932 nothing", values: {} }, deps); } catch (e) { e4 = e; }
  check("…nothing picked -> 400 'pick a top, a waistband or a bottom'", e4 && e4.status === 400 && /pick a top/.test(e4.message));
  G.remove(g.slug);
  check("remove(): gone", !G.list().some((x) => x.slug === g.slug));

  /* ---- the add-on */
  const A = require(path.join(ROOT, "lib", "garmentAddon.js"));
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "t932-"));
  const prevBase = process.env.BITGEN_ADDON_BASE; process.env.BITGEN_ADDON_BASE = base;
  check("status(): not installed in an empty place", A.status(base).installed === false && /not installed/.test(A.status(base).note));
  const calls = [];
  const fakeRun = (ver) => async (cmd, args, o) => {
    calls.push([path.basename(String(cmd)), ...(args || []).map(String)]);
    if (args[0] === "-c" && /PYV/.test(args[1])) { o.log("PYV " + ver); return 0; }
    if (args[0] === "-m" && args[1] === "venv") { fs.mkdirSync(path.dirname(require("../lib/speechAddons").venvPy(args[2])), { recursive: true }); fs.writeFileSync(require("../lib/speechAddons").venvPy(args[2]), "py"); return 0; }
    if (args[0] === "venv") { fs.mkdirSync(path.dirname(require("../lib/speechAddons").venvPy(args[4])), { recursive: true }); fs.writeFileSync(require("../lib/speechAddons").venvPy(args[4]), "py"); return 0; }
    if (/garment_pattern\.py$/.test(String(args[0]))) {
      const req = JSON.parse(fs.readFileSync(args[1], "utf8"));
      o.log("GARMENT " + JSON.stringify(req.op === "schema" ? { ok: true, schema: tree } : { ok: true, panels: 8, stitches: 16 }));
      return 0;
    }
    return 0;
  };
  const fetchRepo = async (url, dest) => { fs.mkdirSync(path.join(dest, "assets", "garment_programs"), { recursive: true }); fs.writeFileSync(path.join(dest, "assets", "garment_programs", "meta_garment.py"), "#"); return { ok: true }; };
  const lines = [];
  let res = await A.install({ base, python: "/py313", run: fakeRun("3.13"), fetchRepo, git: null, uv: null, log: (l) => lines.push(l) });
  check("install(): the app's Python 3.13 and no uv -> said (numpy < 2 needs 3.10 - 3.12)", !res.ok && /3\.10 - 3\.12/.test(res.error), res);
  calls.length = 0;
  res = await A.install({ base, python: "/py313", run: fakeRun("3.13"), fetchRepo, git: null, uv: "/rt/uv", log: (l) => lines.push(l) });
  const pip = calls.find((c) => c.includes("install") && c.includes("numpy<2"));
  check("…3.13 + the runtime's uv: a 3.12 venv (uv venv --seed -p 3.12), the packages in ONE pip call with numpy<2, schema + a test T-shirt, installed",
    res.ok && calls.some((c) => c[0] === "uv" && c.join(" ").includes("venv --seed -p 3.12")) && pip && ["scipy", "svgwrite", "svgpathtools", "pyyaml", "psutil", "matplotlib"].every((k) => pip.includes(k))
    && !pip.some((k) => /cairo/i.test(k)) && A.status(base).installed === true && fs.existsSync(path.join(base, "garmentcode", "schema.json")), { res, calls });
  check("…the test T-shirt said in the log", lines.some((l) => /test T-shirt on the female mannequin: 8 pieces, 16 seams/.test(l)));
  if (prevBase === undefined) delete process.env.BITGEN_ADDON_BASE; else process.env.BITGEN_ADDON_BASE = prevBase;
  fs.rmSync(base, { recursive: true, force: true });
  const LIST = require(path.join(ROOT, "lib", "addons.js")).LIST;
  const ad = LIST.find((x) => x.id === "garment");
  check("Settings ▸ Add-ons lists it (status / install / remove / links), the install box knows it",
    ad && typeof ad.install === "function" && ad.links()[0].url === A.REPO && /"garment": \{|garment: \{/.test(fs.readFileSync(path.join(ROOT, "static", "needinstall.js"), "utf8")));
  const nt = fs.readFileSync(path.join(ROOT, "lib", "garmentAddon.js"), "utf8");
  check("the drape simulator (non-commercial NVIDIA Warp fork) and SMPL bodies are not used - said in the add-on", /NOT used/.test(nt) && /non-commercial/.test(nt) && !/NvidiaWarp-GarmentCode\.git/.test(nt));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack || e)); process.exit(1); });
