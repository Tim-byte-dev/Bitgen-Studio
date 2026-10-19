// bitGen Studio — 2.225.0 CHARACTER REFMODS. lib/refmods.js (the extraction
// graph built from VERIFIED pack schemas), the routes' extract/adopt/forget
// endpoints, queueRefScene's mod ride, and the 🧬 client wiring.
// The worker's render-side splice is Part E of scripts/test-patcher.py.
// Run from repo root: node scripts/test-refmods.js
const fs = require("fs");
const path = require("path");

const R = require(path.join(__dirname, "..", "lib", "refmods"));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log("PASS: " + name); pass++; }
  else { console.log("FAIL: " + name + (extra !== undefined ? " -> " + JSON.stringify(extra) : "")); fail++; }
}

/* ---- naming --------------------------------------------------------- */
check("modName is stable, tag-safe and recognisably ours",
      R.modName("Jinx O'Hara") === "bitgen_jinx_o_hara"
      && R.modName("") === "bitgen_character", R.modName("Jinx O'Hara"));
check("the pack pin, caps and empty-slot value are recorded (the 🚧-repo risk flag)",
      /^[0-9a-f]{40}$/.test(R.PIN) && R.MAX_REFS === 16
      && R.MAX_MOD_SLOTS === 8 && R.NONE_SLOT === "(none)");
check("modPath answers models/refmods/<name>.safetensors inside the ComfyUI folder",
      R.modPath("/x/ComfyUI", "bitgen_jinx")
        === path.join("/x/ComfyUI", "models", "refmods", "bitgen_jinx.safetensors"));

/* ---- the extraction graph ------------------------------------------- */
const files = ["/d/a.png", "/d/b.png", "/d/clothing/c.png"];
const built = R.extractGraph("Jinx", files, { description: "manic, blue hair" });
const g = built.graph;
check("one LoadImage per dataset picture, dotted 0-BASED autogrow keys on the extract node (the ref2va export's own serialization)",
      g.img_0 && g.img_1 && g.img_2
      && g.extract.inputs["refs_image.ref_image_0"][0] === "img_0"
      && g.extract.inputs["refs_image.ref_image_2"][0] === "img_2"
      && !("refs_image.ref_image_3" in g.extract.inputs));
check("the extract node is Full Reference @1024, identity concept, SAVE ON — the node itself writes the safetensors",
      g.extract.class_type === "MiniMaxH3RefModExtract"
      && g.extract.inputs.mode === "Full Reference"
      && g.extract.inputs.concept_type === "identity"
      && g.extract.inputs.ref_resolution === 1024
      && g.extract.inputs.save === true
      && g.extract.inputs.name === "bitgen_jinx"
      && g.extract.inputs.description === "manic, blue hair", g.extract.inputs);
check("the VAE loader is Tim's own working export's, VERBATIM (node 119 of ref2va.json)",
      g.vae.class_type === "VAELoader"
      && g.vae.inputs.vae_name === "minimax_h3_video_vae_fp16.safetensors"
      && g.extract.inputs.vae[0] === "vae");
check("the preview tail gives graph_worker its one required file: Inspect(stored, first_frame) → SaveImage",
      g.inspect.class_type === "MiniMaxH3RefModInspect"
      && g.inspect.inputs.mods[0] === "extract"
      && g.inspect.inputs.preview === "stored"
      && g.inspect.inputs.visual_preview === "first_frame"
      && g.inspect.inputs.vae[0] === "vae"
      && g.save.class_type === "SaveImage"
      && String(g.save.inputs.images) === "inspect,1"
      && /^refmod_bitgen_jinx/.test(g.save.inputs.filename_prefix));
check("uploads follow graph_worker's own {node,input,path,kind} contract, one per picture, in order",
      built.uploads.length === 3
      && built.uploads.every((u, i) => u.node === "img_" + i
           && u.input === "image" && u.path === files[i] && u.kind === "image"));
check("the 17th picture stays out — the autogrow's 16-slot cap",
      (() => { const many = Array.from({ length: 20 }, (_, i) => "/d/p" + i + ".png");
               const b2 = R.extractGraph("x", many);
               return b2.uploads.length === 16
                   && !("refs_image.ref_image_16" in b2.graph.extract.inputs); })());
check("an empty dataset is refused in words, never a silent empty graph",
      (() => { try { R.extractGraph("x", []); return false; }
               catch (e) { return /dataset folder is empty/.test(e.message); } })());

/* ---- route pins (live legs run in the e2e proper) -------------------- */
const RT = fs.readFileSync(path.join(__dirname, "..", "routes", "characters.js"), "utf8");
check("routes: extraction queues a mode:'graph' job from the DATASET walk (root then clothing/, sorted)",
      RT.includes('app.post("/api/characters/:name/refmod"')
      && RT.includes('mode: "graph", graph: built.graph')
      && RT.includes("walk(dd).concat(walk(path.join(dd, \"clothing\")))")
      && RT.includes("dataset folder is empty"));
check("routes: adoption VERIFIES the safetensors landed before the profile remembers it (the harvest rule)",
      RT.includes('app.post("/api/characters/:name/refmod/adopt"')
      && (() => { const i = RT.indexOf("refmod/adopt");
                  const s = RT.slice(i, i + 1600);
                  return /fs\.existsSync\(p\)/.test(s)
                      && s.includes("prof.refmod = mod;"); })());
check("routes: forget clears the profile and best-effort removes the file",
      RT.includes('app.delete("/api/characters/:name/refmod"')
      && RT.includes('prof.refmod = "";'));
check("routes: comfy engine required for extraction, said in words",
      (() => { const i = RT.indexOf('app.post("/api/characters/:name/refmod"');
               return /RefMod extraction runs through ComfyUI/.test(RT.slice(i, i + 900)); })());
check("routes: queueRefScene — a modded character rides the MOD, their sheet leaves the 9-image walk, and the job carries refmods",
      (() => { const i = RT.indexOf("function queueRefScene");
               const s = RT.slice(i, RT.indexOf("function queueExtend"));
               return s.includes("if (c.refmod) {")
                   && s.includes("castMods.push(c.refmod);")
                   && s.includes("refmods: castMods,")
                   && s.indexOf("chars.referenceImage(c, project)") > s.indexOf("if (c.refmod) {"); })());
check("routes: voices still ride for modded characters (mods are visual-only)",
      (() => { const i = RT.indexOf("function queueRefScene");
               const s = RT.slice(i, RT.indexOf("function queueExtend"));
               const voice = s.indexOf("for (const v of (c.voices || []))");
               const close = s.indexOf("}", s.indexOf("else notes.push(c.name"));
               return voice > close; })());

/* ---- lib + client pins ----------------------------------------------- */
const CH = require(path.join(__dirname, "..", "lib", "characters"));
check("the profile blank carries refmod:'' so every save has the shape",
      CH.blank("x").refmod === "");
const SHELL = fs.readFileSync(path.join(__dirname, "..", "static", "index.html"), "utf8");
check("shell: the 🧬 button is in the character dialog's thumb row",
      /id="chRefmod"/.test(SHELL) && /Extract RefMod/.test(SHELL));
const VJS = fs.readFileSync(path.join(__dirname, "..", "ext", "videodock", "characters.js"), "utf8");
check("videodock js: 🧬 queues the extraction, polls the job, then ADOPTS (verify-then-remember)",
      VJS.includes('"/refmod", {})')
      && VJS.includes('"/refmod/adopt", { mod: d.mod }')
      && VJS.includes("save the character first"));
check("videodock js: the card facts show the character's mod",
      VJS.includes('c.refmod ? " · 🧬" + esc(c.refmod)'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
