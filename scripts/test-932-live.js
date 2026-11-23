#!/usr/bin/env node
/* bitGen Studio — 2.932.0 LIVE: 👗 the Garment designer with the REAL GarmentCode (its garment programs run by
 * scripts/garment_pattern.py in a Python with numpy < 2). Needs GARMENT_PY (that Python) and GARMENT_SRC (a GarmentCode
 * checkout) - without them it says SKIP (GitHub's CI has neither). Every bitGen preset on both display mannequins and on a
 * made-to-measure body; the outlines are real (closed, cm, every seam on two real edges); the PDF on every
 * paper; words -> settings -> a pattern. Cleans up its garments. */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const ROOT = path.join(__dirname, "..");
if (!process.env.GARMENT_PY || !process.env.GARMENT_SRC || !fs.existsSync(process.env.GARMENT_PY)) {
  console.log("SKIP: set GARMENT_PY (a Python with GarmentCode's packages, numpy < 2) and GARMENT_SRC (a GarmentCode checkout) for the live run");
  process.exit(0);
}
const G = require(path.join(ROOT, "lib", "garment.js"));
const AI = require(path.join(ROOT, "lib", "garmentAi.js"));
(async () => {
  const made = [];
  const bad = [], seams = [];
  for (const sex of ["female", "male"]) for (const p of G.presets()) {
    try {
      const g = await G.make({ name: `L932 ${p.id} ${sex}`, values: G.presetValues(p.id), body: { sex } });
      made.push(g.slug);
      const o = JSON.parse(fs.readFileSync(G.fileOf(g.slug, "outline.json"), "utf8"));
      const okOutline = o.units === "cm" && o.panels.length === g.panels && o.panels.every((q) => q.outline.length >= 4 && q.edges.length >= 3);
      // every seam joins two real edges of two real pieces (GarmentCode joins edges of different lengths on purpose -
      // ease and gathering - so their lengths are not compared)
      for (const s of o.stitches) {
        const ok = s.length === 2 && s.every((x) => { const q = o.panels.find((pp) => pp.name === x.panel); return q && q.edges[x.edge] && q.edges[x.edge].length > 0; });
        if (!ok) seams.push([p.id, sex, s]);
      }
      if (o.stitches.length !== g.stitches) seams.push([p.id, sex, "count", o.stitches.length, g.stitches]);
      if (!okOutline || g.self_intersecting) bad.push([p.id, sex, g.panels, g.self_intersecting]);
    } catch (e) { bad.push([p.id, sex, e.message]); }
  }
  check("every preset (12) made on both mannequins by GarmentCode: real outlines (cm, closed), nothing self-intersecting", !bad.length && made.length === 24, bad);
  check("…every seam joins two real edges of two real pieces (the letters on the PDF pair them)", !seams.length, seams);
  const fem = await G.make({ name: "L932 tee female", values: G.presetValues("tshirt"), body: { sex: "female" } });
  const big = await G.make({ name: "L932 tee made to measure", values: G.presetValues("tshirt"), body: { sex: "female", height: 180, bust: 104, waist: 84, hips: 108 } });
  made.push(fem.slug, big.slug);
  check("made to measure: a bigger body = a bigger pattern (the pieces round the body wider and longer)", big.size_cm[0] > fem.size_cm[0] && big.size_cm[1] > fem.size_cm[1], [fem.size_cm, big.size_cm]);
  const pages = {};
  for (const paper of ["a4", "letter", "a3", "a0"]) pages[paper] = (await G.pdf(big.slug, { paper, sa: paper === "a0" ? 0 : 1.5 })).pages;
  check("the PDF on every paper: A4 / Letter need the most pages, A3 fewer, A0 the fewest", pages.a4 > pages.a3 && pages.letter > pages.a3 && pages.a3 > pages.a0 && pages.a0 <= 3, pages);
  const d = await AI.describe("a knee-length fitted dress with short sleeves and a v-neck", {}, { noLlm: true });
  const dg = await G.make({ name: "L932 words", values: d.values, body: { sex: "female" } });
  made.push(dg.slug);
  const sp = JSON.parse(fs.readFileSync(path.join(G.dirOf(dg.slug), "design.json"), "utf8"));
  check("words -> settings -> a pattern: a fitted top + a pencil skirt at the knee, short sleeves, a V-neck",
    sp.meta.upper.v === "FittedShirt" && sp.meta.bottom.v === "PencilSkirt" && sp["pencil-skirt"].length.v === 0.45 && sp.sleeve.sleeveless.v === false && sp.collar.f_collar.v === "VNeckHalf" && dg.panels > 4, [d.values, dg.panels]);
  let refused = null;
  try { await G.make({ name: "L932 odd", values: { "meta.bottom": "SkirtLevels", "levels-skirt.num_levels": 5, "levels-skirt.base_length_frac": 0.2, "levels-skirt.length": 0.2 }, body: { sex: "male" } }); }
  catch (e) { refused = e; }
  check("an odd combination: made, or refused with GarmentCode's own words (422) - never a crash", refused === null || (refused.status === 422 && refused.message.length > 30), refused && refused.message);
  for (const s of made) try { G.remove(s); } catch { /* gone */ }
  for (const x of G.list()) if (/^l932-/.test(x.slug)) G.remove(x.slug);
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack || e)); process.exit(1); });
