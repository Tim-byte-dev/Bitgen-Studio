#!/usr/bin/env node
/* bitGen Studio — 2.404.0: the LLM's scene plan (lib/scenePlan.js) and image -> 3D (lib/mesh3d.js), unit level.
 * Tim (verbatim): "is it possible for our llm to use blender to create 3d models?" -> "can we add option 1 + the image
 * to workflow?" - option 1 = a JSON plan Blender builds; the image half = Hunyuan3D 2.1 (default) / TRELLIS.2.
 *   1. the chat: the marker, every kind, sizes in metres, the "model" rule only when 3D models are on, the example
 *   2. parse: a think block, a lead-in, a fence, a trailing comma, // comments, Python's True / None
 *   3. clean: kinds + aliases + plurals, an unknown kind -> its nearest from the words, sizes by kind, the cap on
 *      detailed models, moves sorted and clamped to the length, a camera made when there is none, names unique
 *   4. the kinds here = the kinds scripts/blend_build.py draws (its KINDS + ALIASES)
 *   5. mesh3d.pick: Hunyuan 2.1 > 2.0, TRELLIS.2 / Pixal3D, the missing files named, auto = Hunyuan first
 *   6. mesh3d.prepare: Hunyuan with background removal in front (or not), TRELLIS.2 with its switches resolved,
 *      Save3DAdvanced -> SaveGLB, the previews pruned, the seeds; and the conversion = ComfyUI's own frontend
 *      (scripts/fixtures/frontend/mesh3d_graphToPrompt.json) for both
 *   7. jobParams: the picture checked, the name made safe, mode mesh3d
 * Run from repo root: node scripts/test-sceneplan.js */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SP = require(path.join(ROOT, "lib", "scenePlan"));
const M = require(path.join(ROOT, "lib", "mesh3d"));
const G2A = require(path.join(ROOT, "lib", "graphToApi"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };

// 1
const msgs = SP.messages("a street with a dog", { seconds: 6, maxModels: 3 });
check("the chat: system + user, the BITGEN_SCENE_PLAN marker, every kind named, metres / Z up, the model rule (at most 3), an example",
  msgs.length === 2 && msgs[0].role === "system" && /BITGEN_SCENE_PLAN/.test(msgs[0].content) && SP.KINDS.every((k) => msgs[0].content.includes(k))
  && /metres/.test(msgs[0].content) && /Z is up/.test(msgs[0].content) && /At most 3 "model"/.test(msgs[0].content)
  && /"kind":"model"/.test(msgs[0].content) && /Length: 6 seconds/.test(msgs[1].content), msgs[0].content.slice(0, 300));
const off = SP.messages("x", { models: false });
check("3D models off: the chat says not to use kind model, the example has no model", /Do not use kind "model"/.test(off[0].content) && !/"kind":"model"/.test(off[0].content));

// 2
const plan0 = { title: "T", objects: [{ name: "A", kind: "car" }] };
const p1 = SP.parse("<think>{not this}</think>Sure! Here:\n```json\n" + JSON.stringify(plan0, null, 1).slice(0, -1) + ",\n}\n```\nbye");
check("parse: a think block (with braces), a lead-in, a fence and a trailing comma seen through", p1 && p1.title === "T" && p1.objects[0].kind === "car", p1);
const p2 = SP.parse('{"title": "x", // a comment\n "ground": None, "objects": [], "flag": True}');
check("parse: // comments and Python's None / True", p2 && p2.ground === null && p2.flag === true, p2);
check("parse: prose only -> null", SP.parse("I'd love to describe it! A street, a dog.") === null);

// 3
const { plan, notes } = SP.clean({
  title: "Street\nscene", seconds: 50, objects: [
    { name: "Car", kind: "Car" }, { name: "Car", kind: "vehicles" }, { name: "Lamp", kind: "streetlight", at: [1, 2] },
    { name: "Thing", kind: "flying saucer" }, { name: "Spot", kind: "model", describe: "a spotted dog, side view" },
    { name: "Statue", kind: "model", describe: "a bronze horse statue" }, { name: "Ghost", kind: "model" },
    { name: "Bus", kind: "bus", moves: [{ t: 9, at: [0, 10, 0] }, { t: 2, at: [0, 0, 0] }, { t: 40, at: [0, 40, 0] }] },
    { name: "Bad", kind: "box", size: [1e9, -3, "x"], color: "not a colour" }, "nope"],
}, { maxModels: 2, width: 1280, height: 704 });
const by = (n) => plan.objects.find((o) => o.name === n);
check("clean: the length capped at 30 s, 1280x704, one line title", plan.seconds === 30 && plan.width === 1280 && plan.height === 704 && plan.title === "Street scene", plan);
check("clean: kinds normalised (Car, vehicles -> car, streetlight -> lamp_post), names unique (Car, Car 2)",
  by("Car").kind === "car" && by("Car 2").kind === "car" && by("Lamp").kind === "lamp_post", plan.objects.map((o) => [o.name, o.kind]));
check("clean: an unknown kind -> the nearest from its words (a box), with a note",
  by("Thing").kind === "box" && notes.some((n) => /flying saucer/.test(n)), { thing: by("Thing"), notes });
check("clean: sizes by kind when none given (car 1.8 x 4.4 x 1.5), at padded to [x, y, 0]",
  JSON.stringify(by("Car").size) === "[1.8,4.4,1.5]" && JSON.stringify(by("Lamp").at) === "[1,2,0]", [by("Car"), by("Lamp")]);
check("clean: 'model' objects keep their words + a stand-in kind (dog, statue); over the cap of 2 -> drawn as its kind, said",
  by("Spot").kind === "model" && by("Spot").like === "dog" && /spotted dog/.test(by("Spot").describe)
  && by("Statue").kind === "model" && by("Statue").like === "statue" && by("Ghost").kind === "box" && notes.some((n) => /Ghost.*more than 2/.test(n)),
  [by("Spot"), by("Statue"), by("Ghost")]);
const bus = by("Bus");
check("clean: moves sorted by time, clamped to the length, a key at t 0 first, the object's at = the first move",
  bus.moves.map((m) => m.t).join(",") === "0,2,9,30" && JSON.stringify(bus.at) === JSON.stringify(bus.moves[0].at), bus.moves);
check("clean: silly numbers clamped (size 500 / 0.02, the default kept for text), a bad colour dropped, a non-object skipped",
  JSON.stringify(by("Bad").size) === "[500,0.02,1]" && !by("Bad").color && plan.objects.length === 9, by("Bad"));
check("clean: no camera -> one in front of the scene looking at its middle, said",
  plan.camera.keys.length === 1 && plan.camera.keys[0].at[1] < plan.camera.keys[0].look[1] && notes.some((n) => /no camera/.test(n)), plan.camera);
const { plan: q } = SP.clean({ objects: [{ kind: "dog", name: "d" }], camera: { lens: 500, keys: [{ t: 2, at: [0, -5, 2], look: [0, 0, 1] }, { t: 1, at: [0, -9, 2] }] } }, { models: false });
check("clean: camera keys sorted, a key at 0 added, the lens capped; ground + sun + sky defaults",
  q.camera.keys.map((k) => k.t).join(",") === "0,1,2" && q.camera.lens === 200 && q.ground.size === 60 && q.sun.elevation === 45 && q.sky === "#a9c4dc", q);
const { plan: q2 } = SP.clean({ objects: [{ kind: "model", describe: "a dragon", name: "Dragon" }] }, { models: false });
check("clean: 3D models off -> a 'model' object is drawn from Blender's shapes", q2.objects[0].kind !== "model", q2.objects[0]);

// 4
const py = fs.readFileSync(path.join(ROOT, "scripts", "blend_build.py"), "utf8");
const kindsBlock = py.slice(py.indexOf("KINDS = {"), py.indexOf("ALIASES = {"));
const pyKinds = [...kindsBlock.matchAll(/^    "([a-z_]+)":/gm)].map((m) => m[1]);
const aliasBlock = py.slice(py.indexOf("ALIASES = {"), py.indexOf("def kind_parts"));
const pyAliases = Object.fromEntries([...aliasBlock.matchAll(/"([a-z_]+)": "([a-z_]+)"/g)].map((m) => [m[1], m[2]]));
check("the plan's kinds = the kinds scripts/blend_build.py draws (" + pyKinds.length + ")",
  JSON.stringify([...pyKinds].sort()) === JSON.stringify([...SP.KINDS].sort()), { onlyPy: pyKinds.filter((k) => !SP.KINDS.includes(k)), onlyJs: SP.KINDS.filter((k) => !pyKinds.includes(k)) });
check("... and the same aliases", JSON.stringify(Object.entries(pyAliases).sort()) === JSON.stringify(Object.entries(SP.ALIASES).sort()), { py: pyAliases });

// 5
const L = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v]));
const hy = M.pick(L({ "ImageOnlyCheckpointLoader.ckpt_name": ["hunyuan3d-dit-v2_fp16.safetensors", "hunyuan_3d_v2.1.safetensors"], "LoadBackgroundRemovalModel.bg_removal_name": ["birefnet.safetensors"] }), "auto");
check("pick: Hunyuan3D 2.1 before 2.0, the 2.1 template, birefnet for the cut-out", hy.engine === "hunyuan" && hy.files.ckpt === "hunyuan_3d_v2.1.safetensors"
  && hy.template === "mesh3d_hunyuan21.json" && hy.files.bg === "birefnet.safetensors", hy);
const h20 = M.pick({ "ImageOnlyCheckpointLoader.ckpt_name": ["sub/hunyuan3d-dit-v2_fp16.safetensors"] }, "hunyuan");
check("pick: only 2.0 -> its template, no cut-out (said)", h20.template === "mesh3d_hunyuan20.json" && h20.files.ckpt === "sub/hunyuan3d-dit-v2_fp16.safetensors"
  && h20.notes.some((n) => /no background-removal/.test(n)), h20);
const TRL = { "UNETLoader.unet_name": ["trellis_2_int8_convrot.safetensors"], "VAELoader.vae_name": ["trellis_2_shape_vae_bf16.safetensors", "trellis_2_texture_vae_bf16.safetensors"],
  "CLIPVisionLoader.clip_name": ["dino_v3_L_naf_fp32.safetensors"], "LoadBackgroundRemovalModel.bg_removal_name": ["birefnet.safetensors"] };
const tr = M.pick(TRL, "trellis");
check("pick: TRELLIS.2 with its two VAEs, DINOv3, birefnet", tr.engine === "trellis" && tr.files.use === "trellis" && tr.files.shape && tr.files.texture && tr.files.dino, tr);
check("pick: auto with only TRELLIS.2 -> TRELLIS.2", M.pick(TRL, "auto").engine === "trellis");
const px = M.pick({ ...TRL, "UNETLoader.unet_name": ["pixal3d_int8_convrot.safetensors"], "LoadMoGeModel.model_name": ["moge_2_vitl_normal_fp16.safetensors"] }, "trellis");
check("pick: only Pixal3D (+ MoGe) -> the same template on its Pixal3D side", px.files.use === "pixal" && /Pixal3D/.test(px.label), px);
const none = M.pick({}, "auto");
check("pick: nothing -> both engines' files named, where to get them", /hunyuan_3d_v2\.1\.safetensors \(models\/checkpoints\)/.test(none.error || "")
  && /trellis_2_int8_convrot/.test(none.error) && /Model catalog -> 3D models/.test(none.error), none);
const half = M.pick({ "UNETLoader.unet_name": ["trellis_2_int8_convrot.safetensors"] }, "trellis");
check("pick: TRELLIS.2 asked, files missing -> exactly the missing ones", /shape_vae/.test(half.error) && /dino_v3/.test(half.error) && /birefnet/.test(half.error)
  && !/trellis_2_int8/.test(half.error), half);

// 6
const FE = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "fixtures", "frontend", "mesh3d_graphToPrompt.json"), "utf8"));
const INFO = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "fixtures", "mesh3d_object_info.json"), "utf8"));
const LTXI = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "fixtures", "ltx25_object_info.json"), "utf8"));
const info = { ...LTXI, ...INFO };
const norm = (g) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { c: v.class_type, i: Object.fromEntries(Object.entries(v.inputs)
  .filter(([n, x]) => !(v.class_type === "SaveGLB" && n === "image"))              // the frontend's 3D-preview widget (UI only)
  .map(([n, x]) => [n, Array.isArray(x) ? [String(x[0]), x[1]] : x]).sort()) }]));
for (const eng of ["hunyuan", "trellis"]) {
  const o = FE[eng].opts;
  const pk = M.pick(o.lists, o.engine);
  const prep = M.prepare(M.template(pk.template, ROOT), { pick: pk, image: o.image, seed: o.seed, prefix: o.prefix });
  const out = G2A.convert(prep.ui, info);
  const a = norm(out.graph), b = norm(FE[eng].graphToPrompt);
  const diff = Object.keys({ ...a, ...b }).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  check(`${eng}: our conversion = ComfyUI's own frontend (graphToPrompt) on the prepared template - every node, input, link (${Object.keys(b).length} nodes)`,
    diff.length === 0, diff.slice(0, 3).map((k) => ({ k, ours: a[k], fe: b[k] })));
  const cls = Object.values(out.graph).map((v) => v.class_type);
  if (eng === "hunyuan") {
    check("hunyuan: the picture cut out and centred on white in front of the CLIP-vision encode; seed / prefix / checkpoint set",
      cls.includes("RemoveBackground") && Object.values(out.graph).some((v) => v.class_type === "ImageCropToMask" && v.inputs.background === "#ffffff")
      && Object.values(out.graph).some((v) => v.class_type === "CLIPVisionEncode" && out.graph[v.inputs.image[0]].class_type === "ImageCropToMask")
      && Object.values(out.graph).some((v) => v.class_type === "KSampler" && v.inputs.seed === o.seed)
      && Object.values(out.graph).some((v) => v.class_type === "SaveGLB" && v.inputs.filename_prefix === o.prefix), cls);
  } else {
    check("trellis: no switch / Pixal3D / MoGe / 3D viewport left; SaveGLB fed by the textured mesh; four samplers seeded seed..seed+3",
      !cls.some((c) => /ComfySwitchNode|Pixal3D|MoGe|Preview3D|Save3DAdvanced|PrimitiveBoolean/.test(c))
      && Object.values(out.graph).some((v) => v.class_type === "SaveGLB" && out.graph[v.inputs.mesh[0]].class_type === "MeshToFile3D")
      && Object.values(out.graph).filter((v) => v.class_type === "KSampler").map((v) => v.inputs.seed).sort((x, y) => x - y).join() === [0, 1, 2, 3].map((i) => o.seed + i).join(), cls);
  }
}
const hNo = M.prepare(M.template("mesh3d_hunyuan21.json", ROOT), { pick: M.pick({ "ImageOnlyCheckpointLoader.ckpt_name": ["hunyuan_3d_v2.1.safetensors"] }, "auto"), image: "a.png", seed: 1 });
check("hunyuan without a background-removal model: the picture straight in (no cut-out nodes)", !hNo.ui.nodes.some((n) => /RemoveBackground|ImageCropToMask/.test(n.type)));
const pxp = M.prepare(M.template("mesh3d_trellis2.json", ROOT), { pick: px, image: "a.png", seed: 1 });
check("Pixal3D side: its UNet + MoGe kept, TRELLIS.2's UNet pruned", pxp.ui.nodes.some((n) => n.type === "LoadMoGeModel") && pxp.ui.nodes.filter((n) => n.type === "UNETLoader").length === 1
  && pxp.ui.nodes.find((n) => n.type === "UNETLoader").widgets_values[0] === "pixal3d_int8_convrot.safetensors");

// 7
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "m3t_"));
fs.writeFileSync(path.join(tmp, "my dog!.png"), Buffer.from("89504e470d0a1a0a", "hex"));
const core = require(path.join(ROOT, "lib", "core"));
const jp = M.jobParams({ picture: path.join(tmp, "my dog!.png"), engine: "trellis", seed: 5, models_dir: tmp });
check("jobParams: mode mesh3d, the picture, a safe name, the engine, the seed", jp.params && jp.params.mode === "mesh3d" && jp.params.name === "my_dog_"
  && jp.params.engine === "trellis" && jp.params.seed === 5 && jp.params.no_assets, jp);
check("jobParams: not a picture / not there -> words", /takes a picture/.test(M.jobParams({ picture: path.join(ROOT, "package.json") }).error || "")
  && /not there/.test(M.jobParams({ picture: path.join(tmp, "nope.png") }).error || ""));
check("the worker is mesh3d_worker.py (one map in lib/core.js)", /mesh3d: "mesh3d_worker\.py"/.test(fs.readFileSync(path.join(ROOT, "lib", "core.js"), "utf8")));
void core;
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nRESULT: ${fail} failed (${pass} passed)`);
process.exit(fail ? 1 : 0);
