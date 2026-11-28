#!/usr/bin/env node
/* bitGen Studio — 3.13.0: the image editor's ✂ Split layer into layers (the Layers panel's icon-only button, Layer ▸ ✂ Split Layer
 * Into Layers…) and ✨ Create With the AI ▸ 🧩 Layered image - both Ming-Image (pcming.js, lib/mingLayers.js autoPlan,
 * lib/mingAddon.js auto, lib/mingPlan.js + POST /api/ming/plan, pccreate.js). Pure + the wiring; in a real browser:
 * scripts/test-ui31300-ui.js.
 * Tim: "in image editor please add a button at the bottom of layers docker icon only to split layer into layers, add a template in
 * ai generated dialog for layered image - use ming image for the layered image" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const ML = require(path.join(ROOT, "lib/mingLayers.js"));
const MP = require(path.join(ROOT, "lib/mingPlan.js"));
const A = require(path.join(ROOT, "lib/mingAddon.js"));
const PM = require(path.join(ROOT, "ext/imageeditdock/pcming.js"));

(async () => {
  /* ---------------- "Let Ming decide": just the number of layers */
  check("autoPlan: inclusionAI's own default prompt, 2..12", ML.autoPlan(4) === "Decompose this image into 4 layers." && ML.autoPlan(40) === "Decompose this image into 12 layers." && ML.autoPlan(0) === "Decompose this image into 3 layers.");
  check("autoRows: Layer 1 .. the Background last", PM.autoRows(3).map((r) => r.name).join() === "Layer 1,Layer 2,Background" && PM.autoRows(99).length === 12 && PM.autoRows(1).length === 2);
  check("check: the selected layer needed; auto = 2..12, no list needed", PM.check({ mode: "layer", hasPicture: true, hasLayer: true, auto: true, count: 3 }) === ""
    && /pick the layer/.test(PM.check({ mode: "layer", hasPicture: true, hasLayer: false, auto: true, count: 3 })) && /2 to 12/.test(PM.check({ mode: "layer", hasPicture: true, hasLayer: true, auto: true, count: 1 }))
    && /two layers/.test(PM.check({ mode: "layer", hasPicture: true, hasLayer: true, rows: [{ name: "a" }] })) && PM.check({ mode: "make", rows: PM.DEFAULT_ROWS }) === "");
  const pl = { ok: false, models: "" }, pic = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "m313-")), "in.png"); fs.writeFileSync(pic, "png");
  const j = A.jobParams({ rows: PM.autoRows(4), input: pic, auto: 4, w: 640, h: 480, place: pl });
  check("the job: a split with auto -> the plan is just the number; the layers keep their names", j.params && j.params.layer_plan === "Decompose this image into 4 layers." && j.params.rows.map((r) => r.name).join() === "Layer 1,Layer 2,Layer 3,Background" && j.params.input_w === 640, j);
  check("…without auto: the plan lists each layer (3.9.0)", /Layer 1: Title/.test(A.jobParams({ rows: [{ name: "Title", desc: "x" }, { name: "Back", desc: "y" }], input: pic, place: pl }).params.layer_plan));
  check("…auto on a design (no picture given): the list's plan - auto is only for splitting", /Number of layers/.test(A.jobParams({ rows: PM.DEFAULT_ROWS, auto: 3, place: pl }).params.layer_plan));

  /* ---------------- the LLM plans a layered image */
  const c = MP.clean({ aspect: "16:9", style: "flat vector sale poster", lighting: "bright", layers: [{ name: "Background", desc: "sunny beach", where: "all" }, { name: "Title", description: 'the words "SUMMER SALE" in #ffffff', where: "Top" }, { name: "Shoe", desc: "a red shoe", where: "center" }] });
  check("mingPlan.clean: the rows front first with the background moved LAST, places mapped (Top -> top, center -> centre), the aspect's size",
    c.rows.map((r) => r.name + ":" + r.where).join() === "Title:top,Shoe:centre,Background:all" && c.aspect === "16:9" && c.w / c.h > 1.7 && c.w % 16 === 0 && c.style === "flat vector sale poster", c);
  check("…an unknown aspect = square; an unknown place = the whole canvas", (() => { const x = MP.clean({ aspect: "7:3", layers: [{ name: "A", desc: "a", where: "upstairs" }, { name: "B", desc: "b" }] }); return x.aspect === "1:1" && x.w === x.h && x.rows[0].where === "all"; })());
  let sent = null;
  MP.setComplete(async (o) => { sent = o; return { ok: true, text: "Here you go:\n```json\n" + JSON.stringify({ aspect: "4:5", style: "s", lighting: "l", layers: [{ name: "Logo", desc: "a lion", where: "top" }, { name: "Background", desc: "navy", where: "all" }] }) + "\n```" }; });
  const r = await MP.plan({ ask: "a gym poster with a lion logo" });
  check("plan: the system prompt asks for front-first layers with quoted words + places; the answer parsed (fenced JSON)",
    /FRONT-most layer first and the background LAST/.test(sent.messages[0].content) && /top-left/.test(sent.messages[0].content) && /a gym poster/.test(sent.messages[1].content)
    && r.plan.rows.length === 2 && r.plan.aspect === "4:5" && r.plan.h > r.plan.w, r);
  MP.setComplete(async () => ({ ok: true, text: '{"layers": []}' }));
  check("…an empty plan / no ask / no answer -> said", /empty/.test(await MP.plan({ ask: "x" }).catch((e) => e.message)) && /say what/.test(await MP.plan({}).catch((e) => e.message))
    && /did not answer/.test(await (MP.setComplete(async () => ({ ok: false, error: "down" })), MP.plan({ ask: "x" })).catch((e) => e.message)));
  MP.setComplete(null);

  /* ---------------- the wiring */
  const ui = read("ext/imageeditdock/pcming.js"), cr = read("ext/imageeditdock/pccreate.js"), rt = read("routes/ming.js");
  check("the ✂ icon-only button at the bottom of the Layers panel (before 🗑), Layer ▸ ✂ Split Layer Into Layers…",
    /bt\.id = "kxLSplit"/.test(ui) && /bt\.textContent = "✂"/.test(ui) && /bar\.insertBefore\(bt, del/.test(ui) && /"layer\.mingsplit", "✂ Split Layer Into Layers…"/.test(ui) && /dialog\(\{ mode: "layer" \}\)/.test(ui));
  check("the selected layer alone is rendered (text, shapes, a group) on white, the layers cut to its shape, it is kept hidden",
    /E\.D\.renderLayer\(doc0, E\.docEnv/.test(ui) && /fillStyle = "#ffffff"/.test(ui) && /globalCompositeOperation = "destination-in"/.test(ui) && /src\.visible = false/.test(ui));
  check("✨ Create With the AI ▸ 🧩 Layered image: the LLM plans (POST /api/ming/plan), the Ming box opens with the rows",
    /\["layered", "🧩", "Layered image"\]/.test(cr) && /api\("\/api\/ming\/plan", \{ ask \}\)/.test(cr) && /E\.ming\.dialog\(\{ mode: "make", rows: plan\.rows/.test(cr));
  check("POST /api/ming/plan in routes/ming.js (server.js untouched); auto passed on", /app\.post\("\/api\/ming\/plan"/.test(rt) && /require\("\.\.\/lib\/mingPlan"\)\.plan/.test(rt) && /auto: b\.auto/.test(rt) && !/ming/i.test(read("misc/server.js")));
  console.log("\n" + pass + " passed, " + fail + " failed");
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: threw " + (e && e.stack || e)); console.log("RESULT: 1 failed"); process.exit(1); });
