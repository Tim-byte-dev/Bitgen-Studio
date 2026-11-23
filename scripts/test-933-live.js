#!/usr/bin/env node
/* bitGen Studio — 2.933.0 LIVE: 🧍 a garment really sewn and draped by Blender's cloth on the display mannequin.
 * Needs Blender (found by lib/blender.js) and the real GarmentCode (GARMENT_PY + GARMENT_SRC, as test-932-live) - else SKIP.
 * A T-shirt on the female mannequin and an A-line skirt drape WELL (seams closed, nothing inside the body, not slid off);
 * a hoodie on the male one finishes and says its quality. The files are real: PNG views, a glTF .glb, an OBJ with faces.
 * Cleans up. */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const ROOT = path.join(__dirname, "..");
const exe = require(path.join(ROOT, "lib", "blender.js")).find();
if (!exe || !process.env.GARMENT_PY || !fs.existsSync(process.env.GARMENT_PY) || !process.env.GARMENT_SRC) {
  console.log("SKIP: needs Blender (" + (exe || "not found") + ") and GARMENT_PY + GARMENT_SRC (the real GarmentCode) for the live drape");
  process.exit(0);
}
const G = require(path.join(ROOT, "lib", "garment.js"));
const D = require(path.join(ROOT, "lib", "garmentDrape.js"));
const core = require(path.join(ROOT, "lib", "core.js"));
const wait = (id) => new Promise((ok) => { const t = setInterval(() => { const j = D.get(id); if (j.state === "done" || j.state === "error") { clearInterval(t); ok(j); } }, 1000); });
(async () => {
  const made = [];
  const drape = async (preset, sex, o) => {
    const g = await G.make({ name: `L933 ${preset}`, values: G.presetValues(preset), body: { sex } });
    made.push(g.slug);
    const j = await wait(D.start(g.slug, Object.assign({ size: [240, 360], samples: 4 }, o || {})).id);
    return { g, j, d: G.get(g.slug).drape || {} };
  };
  const tee = await drape("tshirt", "female", { fabric: "jersey", color: "#2b6cd6" });
  check("T-shirt on the female mannequin: draped well - seams closed (max <= 3 cm), not slid off, nothing inside", tee.j.state === "done" && tee.d.good === true && tee.d.seam_gap_max_cm <= 3 && tee.d.drop_cm < 15 && tee.d.inside_pct <= 3, [tee.j.note, tee.d]);
  const dir = path.join(G.dirOf(tee.g.slug), "drape");
  const png = (f) => { try { const b = fs.readFileSync(f); return b.length > 2000 && b.slice(1, 4).toString() === "PNG"; } catch { return false; } };
  check("…real files: three PNG views, a glTF .glb (garment + mannequin), an OBJ with faces + its .mtl",
    ["front", "side", "back"].every((v) => png(path.join(dir, v + ".png"))) && fs.readFileSync(path.join(dir, "dressed.glb")).slice(0, 4).toString() === "glTF"
    && /\nf /.test(fs.readFileSync(path.join(dir, "garment.obj"), "utf8")) && fs.existsSync(path.join(dir, "garment.mtl")));
  check("…models3d/garment-<slug>.glb and Images garment-<slug>-front.png for the editor / References",
    fs.existsSync(path.join(core.pDir("models3d"), tee.d.model)) && png(path.join(core.pDir("images"), tee.d.images.front)));
  const ob = fs.readFileSync(path.join(dir, "garment.obj"), "utf8").split("\n").filter((l) => l.startsWith("v ")).map((l) => l.split(" ").slice(1).map(Number));
  const ys = ob.map((p) => p[1]);
  check("…the shirt sits on the upper body (y up like the mannequin OBJ: between the hips and the shoulders, 0.85..1.55 m)", Math.min(...ys) > 0.85 && Math.max(...ys) < 1.55, [Math.min(...ys), Math.max(...ys)]);
  const sk = await drape("aline", "female");
  check("A-line skirt: draped well (seams closed, on the hips)", sk.j.state === "done" && sk.d.good === true, [sk.j.note, sk.d]);
  const hd = await drape("hoodie", "male", { fabric: "cotton" });
  check("a hoodie on the male mannequin: finishes and says its quality (good or ⚠ with why)", hd.j.state === "done" && /seams closed|still .* open|slid|inside/.test(hd.d.quality || ""), [hd.j.note, hd.d]);
  for (const s of made) {
    const m = (() => { try { return G.get(s).drape; } catch { return null; } })();
    try { G.remove(s); } catch { /* gone */ }
    if (m) { try { fs.rmSync(path.join(core.pDir("models3d"), m.model)); } catch { /* gone */ } for (const f of Object.values(m.images || {})) try { fs.rmSync(path.join(core.pDir("images"), f)); } catch { /* gone */ } }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack || e)); process.exit(1); });
