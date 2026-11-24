// bitGen Studio — scripts/openjutsu-parity.mjs (2.949.0): lib/openjutsu.js against OpenJutsu's OWN code, graph for graph.
// A developer check, not in CI (it needs an OpenJutsu checkout): clone https://github.com/D3voz/openjutsu at the commit in
// lib/openjutsu.js PIN, then
//     OPENJUTSU_DIR=/path/to/openjutsu node --experimental-strip-types --no-warnings scripts/openjutsu-parity.mjs
// Every combination of mode x hat fix x no lip-sync x motion x size x DMAD / Spectrum x object mode is filled both ways and
// compared (2.949.0: 485 / 485 identical). Run it after updating the shipped workflows or the port.
import { createRequire } from "node:module";
const OJDIR = process.env.OPENJUTSU_DIR;
if (!OJDIR) { console.log("set OPENJUTSU_DIR to an OpenJutsu checkout"); process.exit(2); }
const imp = (f) => import(OJDIR + "/lib/" + f);
const { pruneSimple, pruneMask, setSection, NODES, MASK_NODES } = await imp("simple.ts");
const { pruneAdvanced, nodeByTitle, VIDEO } = await imp("advanced.ts");
const { pruneObject } = await imp("object.ts");
const { pruneFace } = await imp("face.ts");
const { pruneColor, DEFAULT_TONE } = await imp("color.ts");
const { applyModel, DEFAULT_MODEL } = await imp("model.ts");
const require = createRequire(import.meta.url);
const OJ = require("../lib/openjutsu.js");
const raw = (k) => OJ.loadGraph(k);
const canon = (g) => JSON.stringify(Object.keys(g).sort().map((k) => [k, g[k]]));
let bad = 0, n = 0;
function eq(name, a, b) { n++; if (canon(a) !== canon(b)) { bad++; console.log("DIFF", name); for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) console.log("  ", k, JSON.stringify(a[k]).slice(0,300), "\n   vs", JSON.stringify(b[k]).slice(0,300)); } }
const model = (dmad, spectrum, steps) => ({ ...DEFAULT_MODEL, loras: dmad ? DEFAULT_MODEL.loras : [], steps, acceleration: spectrum ? "spectrum" : "none" });
for (const hat of [false, true]) for (const nolip of [false, true]) for (const motion of [512, 768]) for (const res of ["736p", "custom"]) for (const dm of [[true,false,6],[false,true,20],[false,false,24]]) {
  const S = { hat, nolip, motion, resolution: res, width: 1024, height: 576, margin: "loose", clip: 5, dmad: dm[0], spectrum: dm[1], steps: dm[2], role: "the drummer", target: "person",
              roles: ["the singer", "", "the drummer", ""], mode: "simple", object: { mode: "change", target: "hair, top", change_to: "pink hair", biggest: true, outline: false } };
  const resolution = res === "custom" ? { width: 1024, height: 576 } : res;
  const sec = { start: 1.5, length: 4 };
  // simple
  let a = pruneSimple(raw("simple"), { role: "the drummer", resolution, motion, hatFix: hat, noLipSync: nolip, margin: "loose", target: "person", seed: 7, clipSeconds: 5 });
  applyModel(a, model(dm[0], dm[1], dm[2])); setSection(a, NODES.video, sec);
  let b = OJ.build("simple", { settings: S, seed: 7, video: "/v", start: 1.5, length: 4, picture: "/p" }).graph;
  eq(`simple ${hat} ${nolip} ${motion} ${res} ${dm}`, a, b);
  for (const [kind, pics] of [["advanced", 3], ["advanced_maxq", 2]]) {
    a = pruneAdvanced(raw(kind), pics, { roles: S.roles, resolution, motion, hatFix: hat, noLipSync: nolip, margin: "loose", seed: 7, clipSeconds: 5 });
    applyModel(a, model(dm[0], dm[1], dm[2])); setSection(a, nodeByTitle(a, VIDEO), sec);
    b = OJ.build(kind, { settings: S, seed: 7, video: "/v", start: 1.5, length: 4, picture: "/p", pictures: pics === 3 ? ["/a", "/b"] : ["/a"] }).graph;
    eq(`${kind} ${hat} ${nolip} ${motion} ${res} ${dm}`, a, b);
  }
  for (const om of ["change", "remove", "background"]) for (const pic of [true, false]) {
    const os = { mode: om, target: "hair, top", changeTo: "pink hair", biggestOnly: true, keepOutline: false, resolution, motion, margin: "loose", seed: 7, clipSeconds: 5 };
    a = pruneObject(raw("object"), pic, os); applyModel(a, model(dm[0], dm[1], dm[2])); setSection(a, nodeByTitle(a, "Source video"), sec);
    b = OJ.build("object", { settings: { ...S, object: { ...S.object, mode: om } }, seed: 7, video: "/v", start: 1.5, length: 4, picture: pic ? "/p" : "" }).graph;
    eq(`object ${om} pic=${pic} ${hat} ${nolip} ${motion} ${res} ${dm}`, a, b);
  }
  a = pruneMask(raw("mask"), hat, "loose", "person"); setSection(a, MASK_NODES.video, sec);
  b = OJ.build("mask", { settings: S, seed: 7, video: "/v", start: 1.5, length: 4 }).graph;
  eq(`mask ${hat}`, a, b);
}
for (const style of ["photo", "mouth"]) {
  let a = pruneFace(raw("face"), { style, seed: 9, chunkSeconds: 7 }); applyModel(a, { ...DEFAULT_MODEL, steps: 6 }); setSection(a, nodeByTitle(a, "Video to fix"), { start: 0, length: 0 });
  let b = OJ.build("face", { settings: { face: { ok: true, style, chunk: 7 } }, seed: 9, video: "/v", picture: "/p" }).graph;
  eq("face " + style, a, b);
}
for (const [d, t] of [[true, true], [false, true], [true, false]]) {
  let a = pruneColor(raw("color"), { detail: d ? -0.3 : null, tone: t ? DEFAULT_TONE : null }); setSection(a, nodeByTitle(a, "Video to fix"), { start: 0, length: 0 });
  let b = OJ.build("color", { settings: { color: { detail: -0.3, detail_on: d, tone_on: t } }, seed: 1, video: "/v" }).graph;
  eq(`color ${d} ${t}`, a, b);
}
console.log(`${n - bad}/${n} graphs identical to OpenJutsu's own code`);
