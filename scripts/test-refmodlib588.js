#!/usr/bin/env node
/* bitGen Studio — scripts/test-refmodlib588.js (2.588.0): 🧬 THE REFMOD LIBRARY (lib/refmodLib.js, routes/refmodLib.js,
 * static/refmodmgr.js) and SOLARRENDERER (lib/solarAddon.js, routes/solar.js). Tim: "in the lora docker add an option for
 * refmod - create remod\refmod name folder in root so all projects can use it . store datasets and safetensors here.
 * allow user to upload media and sort it into the appropriate folder.use vision model for autocaption if user clicks
 * autocaption button. allow user to choose refmod as character reference or location or vehicle or object or prop or
 * flora or animal" + "add https://enderfga.cn/SolarRenderer/". No server, no ComfyUI (fakes). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const R = require("../lib/refmodLib");
const UI = require("../static/refmodmgr.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-refmod588-"));
R.setBase(tmp);
const png = Buffer.from("89504e470d0a1a0a", "hex");

(async () => {
  try {
    check("the seven types: character reference, location, vehicle, object, prop, flora, animal", R.TYPES.map((t) => t.id).join() === "character,location,vehicle,object,prop,flora,animal" && R.TYPES.every((t) => t.icon && t.label && t.words));
    check("safeName / tag / mod name: a folder name, an @tag, bitgen_<type>_<tag>", R.safeName("Red Car 67!") === "Red Car 67" && R.safeName("../../x") === "x" && R.safeName("con") === "" && R.tagOf("Red Car 67") === "red_car_67" && R.modNameOf("Red Car 67", "vehicle") === "bitgen_vehicle_red_car_67");
    check("kindOf sorts by what the file is (extension, else the browser's type)", R.kindOf("a.PNG") === "images" && R.kindOf("b.mp4") === "videos" && R.kindOf("c.gif") === "videos" && R.kindOf("d.flac") === "audio" && R.kindOf("e.bin", "audio/x-wav") === "audio" && R.kindOf("f.doc") === null);

    const c = R.create("Red Car", "vehicle", "a red 1967 fastback");
    check("create: <app>/refmod/<name>/ with images / videos / audio + meta.json (type, description, mod name)", fs.existsSync(path.join(tmp, "refmod", "Red Car", "images")) && fs.existsSync(path.join(tmp, "refmod", "Red Car", "audio")) && c.type === "vehicle" && c.mod === "bitgen_vehicle_red_car" && c.tag === "@red_car" && c.folder.replace(/\\/g, "/") === "refmod/Red Car");
    check("create: a second with the same name is refused; no name is refused", (() => { try { R.create("Red Car"); return false; } catch (e) { return e.status === 409; } })() && (() => { try { R.create("  "); return false; } catch (e) { return e.status === 400; } })());
    const up = R.addFiles("Red Car", [{ originalname: "front.png", buffer: png }, { originalname: "front.txt", buffer: Buffer.from("the front of the car") }, { originalname: "side.jpg", buffer: png },
      { originalname: "drive.mp4", buffer: Buffer.from("v") }, { originalname: "engine.wav", buffer: Buffer.from("a") }, { originalname: "notes.pdf", buffer: Buffer.from("x") }, { originalname: "front.png", buffer: png }]);
    check("upload: sorted into images / videos / audio, a .txt beside a picture is its caption, not-media refused, a name taken gets _2",
      up.added.map((a) => a.kind + ":" + a.file).join() === "images:front.png,images:side.jpg,videos:drive.mp4,audio:engine.wav,images:front_2.png" && up.refused.join() === "notes.pdf" && up.captioned === 1
      && up.info.media.images.find((x) => x.file === "front.png").caption === "the front of the car" && up.info.counts.images === 3 && up.info.uncaptioned === 4, up);
    // a big upload arrives as multer's temp file
    const tf = path.join(tmp, "bgrm-x"); fs.writeFileSync(tf, png);
    const up2 = R.addFiles("Red Car", [{ originalname: "rear.webp", path: tf }]);
    check("upload: a temp file (multer's disk storage) is moved in", up2.added[0].file === "rear.webp" && !fs.existsSync(tf) && fs.existsSync(path.join(tmp, "refmod", "Red Car", "images", "rear.webp")));
    R.setCaption("Red Car", "audio", "engine.wav", "the V8 idling");
    R.removeFile("Red Car", "images", "front_2.png");
    const i1 = R.info("Red Car");
    check("captions are <file>.txt; a file removed takes its caption; a path in a file name is refused", i1.media.audio[0].caption === "the V8 idling" && fs.existsSync(path.join(tmp, "refmod", "Red Car", "audio", "engine.txt")) && i1.counts.images === 3
      && (() => { try { R.fileIn("Red Car", "images", "../meta.json"); return R.fileIn("Red Car", "images", "../meta.json").endsWith(path.join("images", "meta.json")); } catch (e) { return true; } })()
      && (() => { try { R.fileIn("Red Car", "secret", "x.png"); return false; } catch (e) { return e.status === 400; } })());
    check("update: the type and the description - the mod's name follows the type (bitgen_<type>_<tag>)", R.update("Red Car", { type: "prop", description: "x" }).type === "prop" && R.update("Red Car", { type: "nope" }).type === "character" && R.update("Red Car", { type: "vehicle", description: "a red 1967 fastback" }).type === "vehicle"
      && R.info("Red Car").mod === "bitgen_vehicle_red_car" && R.update("Red Car", { type: "prop" }).mod === "bitgen_prop_red_car" && R.update("Red Car", { type: "vehicle" }).mod === "bitgen_vehicle_red_car");

    // ✨ autocaption: the vision model for pictures + a frame of each video; sounds skipped
    const asked = [];
    const cap = { describe: async (_c, a) => { asked.push(a[0]); return ["a red car, " + path.basename(a[0].path)]; } };
    const st = await R.autoCaption("Red Car", false, { captioner: cap, core: { probeDuration: () => 4 }, frameOf: (v, out) => { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, png); return out; }, wait: true });
    const i2 = R.info("Red Car");
    check("autocaption: only the empty ones - pictures as they are, a video from its frame, the sounds left (the vision model cannot hear); the prompt says the type",
      st.done === 3 && st.total === 3 && st.skipped === 0 && asked.length === 3 && asked.some((a) => /drive\.mp4\.png$/.test(a.path)) && /Vehicle/.test(asked[0].prompt)
      && i2.media.images.find((x) => x.file === "front.png").caption === "the front of the car" && /a red car/.test(i2.media.videos[0].caption) && i2.media.audio[0].caption === "the V8 idling" && R.captionState().busy === false, { st, asked: asked.map((a) => a.path) });

    // 🧬 extraction
    const frames = [];
    const ex = R.extractJob("Red Car", { probe: () => 10, frameOf: (v, out, at) => { frames.push(at); fs.writeFileSync(out, png); return out; } });
    const g = ex.params.graph;
    check("extract: the pictures first, then frames spread over each video (16 slots), the pack's Extract node (refs_image.ref_image_N, concept_type identity, save) named bitgen_<type>_<tag>; the type in the description; sounds noted",
      ex.params.mode === "graph" && ex.mod === "bitgen_vehicle_red_car" && g.extract.class_type === "MiniMaxH3RefModExtract" && g.extract.inputs.name === "bitgen_vehicle_red_car" && g.extract.inputs.concept_type === "identity" && g.extract.inputs.save === true
      && ex.pictures === 16 && frames.length === 13 && frames[0] > 0 && frames[12] < 10 && /^Vehicle: Red Car\. a red 1967 fastback/.test(g.extract.inputs.description) && ex.notes.some((n) => /sound/.test(n)) && ex.params.refmod_lib === "Red Car", { pictures: ex.pictures, frames, notes: ex.notes, d: g.extract.inputs.description });
    check("extract: nothing to extract = refused", (() => { R.create("Empty One", "flora"); try { R.extractJob("Empty One"); return false; } catch (e) { return e.status === 400 && /no pictures/.test(e.message); } })());

    // after the job: adopt, then a prompt uses it
    const comfy = path.join(tmp, "ComfyUI");
    check("adopt: refused while the mod is not in ComfyUI's models/refmods", (() => { try { R.adopt("Red Car", comfy); return false; } catch (e) { return e.status === 404; } })());
    fs.mkdirSync(path.join(comfy, "models", "refmods"), { recursive: true });
    fs.writeFileSync(path.join(comfy, "models", "refmods", "bitgen_vehicle_red_car.safetensors"), Buffer.alloc(2048, 1));
    const ad = R.adopt("Red Car", comfy);
    check("adopt: the .safetensors is copied into the RefMod's own folder (the library keeps it)", ad.ok && ad.size === 2048 && fs.existsSync(path.join(tmp, "refmod", "Red Car", "bitgen_vehicle_red_car.safetensors")) && R.info("Red Car").has_mod);
    fs.rmSync(path.join(comfy, "models", "refmods"), { recursive: true });
    const fp = R.forPrompt("@red_car drifts past @empty_one at dusk, @nobody waves", comfy);
    check("forPrompt: @tag = the mod (copied back into a ComfyUI that lacks it), the @ taken out of the prompt; one without a mod is noted; an unknown @word stays",
      fp.mods.join() === "bitgen_vehicle_red_car" && fp.prompt === "red car drifts past empty one at dusk, @nobody waves" && fp.notes.some((n) => /Empty One has no mod/.test(n))
      && fs.existsSync(path.join(comfy, "models", "refmods", "bitgen_vehicle_red_car.safetensors")) && R.forPrompt("no tags here").mods.length === 0);
    const li = R.list();
    check("list: every RefMod by name with its type, counts and mod state", li.map((x) => x.name).join() === "Empty One,Red Car" && li[1].has_mod && li[1].counts.videos === 1 && li[0].type === "flora");
    check("remove: the whole folder", R.remove("Empty One").removed === "Empty One" && !fs.existsSync(path.join(tmp, "refmod", "Empty One")) && (() => { try { R.remove("Empty One"); return false; } catch (e) { return e.status === 404; } })());

    // the page's pure parts
    check("page: sortHint / countsText / tagFor", UI.sortHint("a.jpg") === "images" && UI.sortHint("b.gif") === "videos" && UI.sortHint("x", "audio/ogg") === "audio" && UI.sortHint("c.txt") === "caption" && UI.sortHint("d.zip") === null
      && UI.countsText({ images: 2, videos: 1, audio: 0 }) === "2 picture(s) · 1 video(s) · 0 sound(s)" && UI.tagFor("Red Car") === "@red_car");

    // ---- SolarRenderer
    const SA = require("../lib/solarAddon");
    const cat = JSON.parse(rd("lib", "modelCatalog.json"));
    const by = (id) => cat.models.find((m) => m.id === id);
    check("solar: the four LoRAs from Enderfga/SolarRenderer into ComfyUI's loras (the README's names), group solar listed",
      ["solar_control", "solar_4step", "solar_causal_control", "solar_causal_4step"].every((id) => by(id) && by(id).repo === "Enderfga/SolarRenderer" && by(id).dest === "comfy/loras" && by(id).group === "solar")
      && by("solar_control").file === "solarrenderer_control_lora.safetensors" && by("solar_4step").file === "solarrenderer_4step_lora.safetensors" && by("solar_causal_4step").file === "solarrenderer_causal_4step_lora.safetensors" && cat.groups.some((g) => g.id === "solar"));
    const cn = path.join(tmp, "custom_nodes"), pl = { ok: true, customNodes: cn, models: path.join(tmp, "models"), python: "" };
    fs.mkdirSync(cn, { recursive: true });
    check("solar status: nothing yet = not installed", !SA.status(pl).installed && SA.status(pl).note === "not installed");
    // install with a fake clone (no ComfyUI nodes on main) -> pull request #3 is fetched with git
    const runs = [];
    const fake = { which: () => "git", run: async (cmd, args) => { runs.push(args.join(" ")); if (args.includes("checkout")) { const d = path.join(cn, "SolarRenderer"); fs.mkdirSync(path.join(d, "comfyui"), { recursive: true }); fs.writeFileSync(path.join(d, "comfyui", "nodes.py"), ""); fs.writeFileSync(path.join(d, "__init__.py"), ""); fs.mkdirSync(path.join(d, "workflows"), { recursive: true }); fs.writeFileSync(path.join(d, "workflows", "solarrenderer_full.json"), '{"1":{"class_type":"SaveVideo","inputs":{}}}'); fs.writeFileSync(path.join(d, "workflows", "solarrenderer_long.json"), "{}"); } return 0; } };
    const dls = [], lines = [];
    const res = await SA.install((l) => lines.push(l), ["causal"], { place: pl, exec: fake, git: "git",
      fetchRepo: async (url, dest) => { fs.mkdirSync(path.join(dest, ".git"), { recursive: true }); fs.writeFileSync(path.join(dest, "README.md"), "x"); return { ok: true, how: "git" }; },
      download: async (m) => { dls.push(m.file); const p = path.join(pl.models, "loras", path.basename(m.file)); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, "w"); return { ok: true }; } });
    check("solar install: the repo into custom_nodes/SolarRenderer, no ComfyUI nodes on main -> pull request #3 fetched + checked out; the needed LoRAs + the ticked causal pair; the licence said",
      res.ok && runs.some((r) => /fetch --depth 1 origin pull\/3\/head:comfyui-nodes/.test(r)) && runs.some((r) => /checkout comfyui-nodes/.test(r))
      && dls.join() === "solarrenderer_control_lora.safetensors,solarrenderer_4step_lora.safetensors,solarrenderer_causal_control_lora.safetensors,solarrenderer_causal_4step_lora.safetensors"
      && lines.some((l) => /Community License/.test(l)) && SA.status(pl).installed && SA.status(pl).pack, { res, runs, dls });
    const wf = SA.workflows(pl);
    check("solar workflows: the pack's workflows/*.json are listed and read (for ⤒ Import & check); anything else is refused",
      wf.map((w) => w.name).join() === "solarrenderer_full,solarrenderer_long" && JSON.parse(SA.readWorkflow("workflows/solarrenderer_full.json", pl).text)["1"].class_type === "SaveVideo"
      && (() => { try { SA.readWorkflow("../../etc/passwd", pl); return false; } catch (e) { return e.status === 404; } })());
    const rm = []; await SA.remove((l) => rm.push(l), pl);
    check("solar remove: the LoRAs + the pack folder (TAEH3 stays - H3 uses it)", !fs.existsSync(path.join(cn, "SolarRenderer")) && !fs.existsSync(path.join(pl.models, "loras", "solarrenderer_4step_lora.safetensors")));

    // ---- the wiring
    const IDX = rd("routes", "index.js"), ADD = rd("lib", "addons.js"), GC = rd("static", "graphcheck.js"), H = rd("static", "index.html"), LT = rd("routes", "refmodLib.js");
    check("wiring: the routes mounted (not server.js); /api/generate reads the @tags into refmods; refmodmgr.js loaded after the trainer; Add-ons ▸ SolarRenderer; Graphs ▸ ☀ SolarRenderer imports through ⤒ Import & check",
      /require\("\.\/refmodLib"\)\.mount\(app\)/.test(IDX) && /require\("\.\/solar"\)\.mount\(app\)/.test(IDX) && /require\("\.\.\/lib\/refmodLib"\)\.forPrompt\(prompt/.test(IDX) && /refmods: libMods\.length \? libMods : undefined/.test(IDX)
      && H.indexOf('src="/static/refmodmgr.js"') > H.indexOf('src="/static/loratrain.js"') && /id: "solar", label: "SolarRenderer/.test(ADD) && /fetch\("\/api\/solar"\)/.test(GC) && /return importFile\(\{ name: j\.name \+ "\.json"/.test(GC)
      && /upload\.array\("files", 200\)/.test(LT) && !/refmod/.test(rd("misc/server.js")));
    check("refmod/ is this PC's library - not in the zips (.gitignore = make_zips)", /^refmod\/$/m.test(rd(".gitignore")) && /! -path "\.\/refmod\/\*"/.test(rd("scripts", "make_zips.sh")) && (!fs.existsSync(path.join(ROOT, "misc", "_gitignore")) || rd(".gitignore") === rd("misc/_gitignore")));
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
