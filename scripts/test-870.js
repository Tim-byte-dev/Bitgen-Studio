#!/usr/bin/env node
/* bitGen Studio — 2.870.0 units: the Character creator's sheet by the H3 Character Sheet Designer (lib/charSheetH3.js): the
 * choices in bitGen Studio's words, the designer's state (whitelisted, ordered, sizes on 32s, part notes / view instructions
 * capped, No clothing needs a non-clothing view), the model files found in ComfyUI's lists (any sub-folder), what this ComfyUI
 * lacks in words, the graph (the pack's MiniMax H3 Image wiring - only the pictures that are there), the add-on (pack + files
 * with fakes), the lists (nodePacks / modelCatalog / addons), the routes (not server.js) and the old designer gone.
 * Tim (verbatim): "https://github.com/ukr8b3g-cmyk/H3-Character-Sheet-Designer can we integrate this into bitgen, if we can
 * then remove our character designer and use this one" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const throws = (fn) => { try { fn(); return ""; } catch (e) { return e.message || String(e); } };
(async () => {
  const S = require(path.join(ROOT, "lib/charSheetH3.js"));
  check("the catalog: 13 views in the designer's order (6 head, 3 body, clothing front / back, hands, feet), 7 presets - Standard 5 first",
    S.VIEW_IDS.join() === "face_front,face_left,face_right,face_3q_left,face_3q_right,face_back,body_front,body_left,body_back,clothing_front,clothing_back,hands,feet"
    && S.PRESETS.length === 7 && S.PRESETS[0].id === "five" && S.PRESETS[0].views.length === 5 && S.PRESETS.find((p) => p.id === "detail").views.length === 13, S.PRESETS.map((p) => p.id));
  check("...the designer's own values: 10 styles (none first), 8 picture roles, 8 parts, 4 sizes, No clothing = clothing_type none",
    S.STYLES.length === 10 && S.STYLES[0][0] === "none" && S.ROLES.map((r) => r[0]).join() === "same_character,face,head,clothing,clothing_front,clothing_back,hands,footwear"
    && S.PARTS.length === 8 && S.SIZES.map((s) => s[0]).join() === "current,high,max_8mp,max_16mp" && S.CLOTHING.some((c) => c[0] === "none"));
  const st = S.state({ views: ["feet", "body_front", "nope", "face_front"], clothing: "pants", hands: "glovez", feet: "unshod", detail: "max_8mp",
    parts: { face: "  a scar  ", other: "   ", bogus: "x" }, roles: ["face", "", "footwear"], viewPrompts: { hands: "Both hands open.", nope: "x" } });
  check("state(): schema 3, the views in the designer's order (unknown dropped), unknown values back to 'as in the picture', garment mode",
    st.schema_version === 3 && st.views.join() === "face_front,body_front,feet" && st.hand_state === "reference" && st.footwear_state === "unshod"
    && st.clothing_type === "pants" && st.clothing_mode === "garment" && st.resolution_profile === "max_8mp", st);
  check("...part notes trimmed (empty / unknown left out), roles for all three pictures (blank = more of the same character), view instructions known only",
    JSON.stringify(st.part_prompts) === '{"face":"a scar"}' && JSON.stringify(st.reference_roles) === '{"reference_image_1":"face","reference_image_2":"same_character","reference_image_3":"footwear"}'
    && JSON.stringify(st.view_prompts) === '{"hands":"Both hands open."}', st);
  const plain = S.state({ views: ["body_front"] });
  check("...no roles / no instructions = the keys are left out (the pack refuses partial reference_roles); auto size, High detail",
    !("reference_roles" in plain) && !("view_prompts" in plain) && plain.size.mode === "auto" && plain.resolution_profile === "high" && plain.size.body_height === 1120, plain);
  const man = S.state({ views: ["body_front"], size: { mode: "manual", width: 2050, height: 10 } });
  check("...an exact size snaps to the designer's 32s (2050 -> 2048; too small -> the default)", man.size.mode === "manual" && man.size.manual_width === 2048 && man.size.manual_height === 1280, man.size);
  check("...no view = refused in words; No clothing with only clothing views = refused in words",
    /at least one view/.test(throws(() => S.state({ views: [] }))) && /No clothing leaves out the clothing views/.test(throws(() => S.state({ views: ["clothing_front"], clothing: "none" })))
    && S.state({ views: ["clothing_front", "hands"], clothing: "none" }).views.length === 2);
  check("...a part note over 1000 / a view instruction over 2000 characters: refused, named",
    /"Face" is longer than 1000/.test(throws(() => S.state({ views: ["face_front"], parts: { face: "x".repeat(1001) } })))
    && /"Hands" is longer than 2000/.test(throws(() => S.state({ views: ["hands"], viewPrompts: { hands: "x".repeat(2001) } }))));
  check("summary(): the preset's name, the views, the size", S.summary(S.state({ views: S.PRESETS[0].views })) === "Standard · 5 views · High detail"
    && S.summary(man) === "Single view · 1 view · 2048 × 1280" && S.summary(S.state({ views: ["face_front", "clothing_back", "hands"], clothing: "none" })) === "2 views · High detail");
  const L = ["other.safetensors", "minimax\\minimax_h3_image_pruned_int8_convrot.safetensors", "qwen3vl_32b_minimax_h3_int8_convrot.safetensors", "sub/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"];
  check("pickName(): ComfyUI's own value, any sub-folder / separator; the nvfp4 text encoder before the int8 one; none = \"\"",
    S.pickName(L, "unet") === "minimax\\minimax_h3_image_pruned_int8_convrot.safetensors" && S.pickName(L, "clip") === "sub/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"
    && S.pickName(L.slice(0, 3), "clip") === "qwen3vl_32b_minimax_h3_int8_convrot.safetensors" && S.pickName(L, "vae") === "" && S.pickName(null, "unet") === "");
  const info = { MiniMaxH3ImageCharacterSheetDesigner: { input: { required: { state_json: ["STRING", {}] }, optional: { style: [["none", "anime", "photo"]] } } },
    MiniMaxH3ImageConditioning: {}, UNETLoader: { input: { required: { unet_name: [L] } } }, CLIPLoader: { input: { required: { clip_name: [L] } } },
    VAELoader: { input: { required: { vae_name: ["COMBO", { options: ["minimax_h3_image_vae_fp16.safetensors"] }] } } } };
  const rd = S.readiness(info);
  check("readiness(): the pack + MiniMax H3 Image Conditioning + the three files (both /object_info list forms), the pack's styles",
    rd.designer && rd.cond && rd.names.vae === "minimax_h3_image_vae_fp16.safetensors" && rd.names.clip.endsWith("nvfp4_awq.safetensors") && rd.styles.join() === "none,anime,photo" && !rd.missing.length, rd);
  const rd0 = S.readiness({ UNETLoader: { input: { required: { unet_name: [["x.safetensors"]] } } } });
  check("...an old / bare ComfyUI: each missing part said with what to do (Add-ons, update to 0.45, the file and its folder)",
    rd0.missing.length === 5 && /Settings ▸ Add-ons ▸ H3 Character Sheet Designer/.test(rd0.missing[0]) && /0\.45/.test(rd0.missing[1]) && /diffusion_models/.test(rd0.missing[2]) && /text_encoders/.test(rd0.missing[3]), rd0.missing);
  const names = { unet: "u.safetensors", clip: "c.safetensors", vae: "v.safetensors" };
  const g1 = S.graph({ state: st, layout: true, style: "anime", seed: 77, names, character: "/p/images/c.png", refs: [null, "/p/images/r2.png", null], prefix: "charsheet" });
  const G = g1.graph;
  check("graph(): LoadImage for the character + only the part pictures given; the designer gets state_json, the layout switch, the style, the pictures",
    G.char.class_type === "LoadImage" && G.ref2 && !G.ref1 && !G.ref3 && G.design.class_type === "MiniMaxH3ImageCharacterSheetDesigner"
    && JSON.parse(G.design.inputs.state_json).views.join() === st.views.join() && G.design.inputs.use_layout_image === true && G.design.inputs.style === "anime"
    && JSON.stringify(G.design.inputs.character_image) === '["char",0]' && JSON.stringify(G.design.inputs.reference_image_2) === '["ref2",0]' && !("reference_image_1" in G.design.inputs), G.design);
  check("...MiniMax H3 Image Conditioning: prompt / width / height from the designer, image_0 = character, image_1 = the layout guide, image_3 = part picture 2 (the pack's numbering)",
    G.cond.class_type === "MiniMaxH3ImageConditioning" && JSON.stringify([G.cond.inputs.prompt, G.cond.inputs.width, G.cond.inputs.height]) === '[["design",0],["design",1],["design",2]]'
    && JSON.stringify(G.cond.inputs["images.image_0"]) === '["design",4]' && JSON.stringify(G.cond.inputs["images.image_1"]) === '["design",3]'
    && JSON.stringify(G.cond.inputs["images.image_3"]) === '["design",6]' && !("images.image_2" in G.cond.inputs) && !("images.image_4" in G.cond.inputs), G.cond.inputs);
  check("...the pack's template sampling: CLIPLoader type minimax, KSampler euler / simple / 6 steps / cfg 1 / denoise 1 with the seed, a zeroed negative, latent from the conditioning, SaveImage",
    G.clip.inputs.type === "minimax" && G.unet.inputs.unet_name === "u.safetensors" && G.sample.inputs.seed === 77 && G.sample.inputs.steps === 6 && G.sample.inputs.cfg === 1
    && G.sample.inputs.sampler_name === "euler" && G.sample.inputs.scheduler === "simple" && G.sample.inputs.denoise === 1
    && JSON.stringify(G.sample.inputs.negative) === '["zero",0]' && JSON.stringify(G.sample.inputs.latent_image) === '["cond",1]' && G.decode.class_type === "VAEDecode" && G.save.class_type === "SaveImage", G.sample);
  check("...the uploads (graph_worker's contract): the character, then part picture 2", JSON.stringify(g1.uploads.map((u) => [u.node, u.input, u.path])) === '[["char","image","/p/images/c.png"],["ref2","image","/p/images/r2.png"]]', g1.uploads);
  const g2 = S.graph({ state: plain, layout: false, style: "bogus", seed: 1, names, character: "/c.png", refs: [], tiled: true }).graph;
  check("...layout off = no image_1; an unknown style = none; tiled decode 512 / 64 / 64 / 8", !("images.image_1" in g2.cond.inputs) && g2.design.inputs.style === "none"
    && g2.decode.class_type === "VAEDecodeTiled" && g2.decode.inputs.tile_size === 512 && g2.decode.inputs.temporal_overlap === 8, g2.decode);
  const pb = S.previewBody(plain, true, "photo", [true, false]);
  check("previewBody(): what the pack's preview route takes (all three presence keys)", JSON.parse(pb.state_json).views[0] === "body_front" && pb.use_layout_image === true && pb.style === "photo"
    && JSON.stringify(pb.reference_presence) === '{"reference_image_1":true,"reference_image_2":false,"reference_image_3":false}' && S.PREVIEW_PATH === "/h3_character_sheet_designer/minimax_image/preview");
  check("the pack: ukr8b3g-cmyk/H3-Character-Sheet-Designer v1.5.2, the commit its names were read from", S.PACK.url === "https://github.com/ukr8b3g-cmyk/H3-Character-Sheet-Designer" && /^[0-9a-f]{40}$/.test(S.PACK.commit) && S.PACK.version === "1.5.2");

  // the lists
  const NP = JSON.parse(src("lib/nodePacks.json")).packs;
  const pk = NP.find((p) => p.id === "h3sheet");
  check("lib/nodePacks.json: H3-Character-Sheet-Designer (provides the designer node) instead of ComfyUI-H3LookSheets", pk && pk.folder === "H3-Character-Sheet-Designer" && pk.url === S.PACK.url
    && pk.provides.includes("MiniMaxH3ImageCharacterSheetDesigner") && !NP.some((p) => p.id === "looksheets"), pk);
  const cat = JSON.parse(src("lib/modelCatalog.json")), img = cat.models.filter((m) => m.group === "h3img");
  check("lib/modelCatalog.json: group h3img - the MiniMax H3 Image transformer + VAE from Comfy-Org/MiniMax-H3-Image into diffusion_models / vae; the text encoder is the video's h3_te",
    cat.groups.some((g) => g.id === "h3img") && img.map((m) => m.id).join() === "h3img_dit,h3img_vae" && img.every((m) => m.repo === "Comfy-Org/MiniMax-H3-Image")
    && img.map((m) => m.dest).join() === "comfy/diffusion_models,comfy/vae" && path.basename(img[0].file) === S.WANT.unet[0] && path.basename(img[1].file) === S.WANT.vae[0]
    && path.basename(cat.models.find((m) => m.id === "h3_te").file) === S.WANT.clip[0], img);
  const AD = require(path.join(ROOT, "lib/addons.js")).LIST.find((a) => a.id === "h3sheet");
  check("Settings ▸ Add-ons ▸ H3 Character Sheet Designer: what it is for, ComfyUI 0.45, a size, the links (pack + files with where they go)",
    AD && /Character sheet/.test(AD.for) && /0\.45/.test(AD.needs) && /GB/.test(AD.size) && AD.links().length === 3 && AD.links()[0].kind === "pack" && AD.links().every((l) => l.url && l.dest), AD && AD.links());

  // the add-on with fakes
  const H = require(path.join(ROOT, "lib/h3SheetAddon.js"));
  const st0 = H.status({ ok: false, error: "no folder", customNodes: "", models: "" });
  check("status() without ComfyUI: not installed, said, the four parts listed (pack, transformer, VAE, text encoder)", !st0.installed && /ComfyUI not found/.test(st0.note) && st0.items.map((i) => i.id).join() === "pack,dit,vae,te");
  const os = require("os"), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t870-")), cn = path.join(tmp, "custom_nodes"), mdl = path.join(tmp, "models");
  fs.mkdirSync(cn, { recursive: true }); fs.mkdirSync(path.join(mdl, "text_encoders"), { recursive: true });
  fs.writeFileSync(path.join(mdl, "text_encoders", S.WANT.clip[0]), "te");
  const pl = { ok: true, customNodes: cn, models: mdl, python: "" };
  const log = [], packs = [], got = [];
  const r = await H.install((l) => log.push(l), [], { place: pl, packInstall: async (p) => { packs.push(p.folder); fs.mkdirSync(path.join(cn, p.folder)); return { ok: true }; },
    download: async (m) => { got.push(m.id); const f = path.join(mdl, m.dest.split("/")[1], path.basename(m.file)); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, "x"); return { ok: true }; },
    comfy: async () => ({ online: true, designer: false, cond: false }) });
  check("install(): the pack into custom_nodes, the transformer + VAE downloaded, the text encoder already there (not fetched), the licence said",
    r.ok && packs.join() === "H3-Character-Sheet-Designer" && got.join() === "h3img_dit,h3img_vae" && log.some((l) => /qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors \(already there\)/.test(l)) && log.some((l) => /MIT/.test(l)), { r, log });
  check("...a running ComfyUI without the pack / the conditioning node: restart it, update it to 0.45 - in words", log.some((l) => /restart ComfyUI once/.test(l)) && log.some((l) => /0\.45 or newer/.test(l)));
  check("...status afterwards: installed, ready", H.status(pl).installed && /ready/.test(H.status(pl).note), H.status(pl));
  const lr = []; await H.remove((l) => lr.push(l), pl);
  check("remove(): the transformer + VAE deleted; the text encoder (the video's) and the pack stay", !fs.existsSync(path.join(mdl, "vae", S.WANT.vae[0])) && fs.existsSync(path.join(mdl, "text_encoders", S.WANT.clip[0]))
    && fs.existsSync(path.join(cn, "H3-Character-Sheet-Designer")) && /text encoder stays/.test(lr.join("\n")), lr);
  const fk = (has) => async (u) => ({ ok: true, json: async () => (has.some((c) => u.endsWith("/" + c)) ? { [u.split("/").pop()]: {} } : {}) });
  const cs1 = await H.comfySupport({ url: "http://c", fetch: fk(["MiniMaxH3ImageCharacterSheetDesigner", "MiniMaxH3ImageConditioning"]) }), cs2 = await H.comfySupport({ url: "http://c", fetch: fk([]) });
  check("comfySupport(): the designer + the conditioning node asked one by one", cs1.online && cs1.designer && cs1.cond && cs2.online && !cs2.designer && !cs2.cond);
  fs.rmSync(tmp, { recursive: true, force: true });

  // routes, the page, the old designer gone
  const IX = src("routes/index.js"), RC = src("routes/charSheetH3.js"), RCH = src("routes/characters.js");
  check("routes/charSheetH3.js: GET /api/charsheet/h3, POST /preview, POST (the take) - mounted from routes/index.js, not server.js",
    /require\("\.\/charSheetH3"\)\.mount\(app\)/.test(IX) && /app\.get\("\/api\/charsheet\/h3"/.test(RC) && /app\.post\("\/api\/charsheet\/h3\/preview"/.test(RC) && /app\.post\("\/api\/charsheet\/h3", upload\.fields/.test(RC)
    && !/charSheetH3/.test(src("misc/server.js")));
  check("...a take is a mode:\"graph\" job (graph_worker), the engine must be ComfyUI, ComfyUI's /object_info decides (409 with needs h3sheet)",
    /mode: "graph", graph: built\.graph/.test(RC) && /Engine to ComfyUI first/.test(RC) && /needs: "h3sheet"/.test(RC) && /objectInfo\(15000\)/.test(RC));
  const gone = ["routes/poseSheets.js", "lib/poseSheets.js", "lib/sheetStyles.js", "ext/videodock/posepick.js", "comfy_workflows/h3_character_creator.json"].filter((f) => fs.existsSync(path.join(ROOT, f)));
  check("the old designer is gone: sheetgen / sheetstyles routes, pose sheets, the sheet-style helper, the H3-Character_creator workflow + its worker branch",
    !gone.length && !/app\.(post|get)\("\/api\/characters\/(sheetgen|sheetstyles)"/.test(RCH) && !/poseSheets|sheetStyles/.test(RCH.replace(/\/\*[\s\S]*?\*\//g, "")) && !/params\.get\("h3sheet"\)/.test(src("misc/image_worker.py"))
    && !/poseSheets/.test(IX), gone);
  const EJ = JSON.parse(src("ext/videodock/ext.json")), DK = src("ext/videodock/dock.html"), CH = src("ext/videodock/characters.js"), HS = src("ext/videodock/h3sheet.js");
  check("the Character creator: #chH3Opts in the sheet tab instead of Kind / Look / Pose sheet / Render style; h3sheet.js loads (before characters.js, audioseg.js right after it)",
    /<div id="chH3Opts"><\/div>/.test(DK) && !/id="chOptKind"|id="chOptStyle"|id="chPoseBtn"|id="chSheetStyleSel"/.test(DK) && EJ.scripts.indexOf("h3sheet.js") >= 0
    && EJ.scripts.indexOf("h3sheet.js") < EJ.scripts.indexOf("characters.js") && EJ.scripts.indexOf("audioseg.js") === EJ.scripts.indexOf("characters.js") + 1 && !EJ.scripts.includes("posepick.js"), EJ.scripts);
  check("...characters.js posts the take to /api/charsheet/h3 (upload + ↻ regenerate) through window.H3SheetDesign; the status names the summary",
    /fetch\("\/api\/charsheet\/h3", \{ method: "POST", body: fd \}\)/.test(CH) && /scPost\("\/api\/charsheet\/h3",/.test(CH) && /D\.ready\(\)/.test(CH) && /chSheetVia = job\.summary/.test(CH) && !/\/api\/characters\/sheetgen/.test(CH));
  check("...h3sheet.js: the presets + 13 view ticks, clothing / hands / feet / style / size, layout guide, tiled decode, 3 part pictures with roles, part notes, view instructions, the layout drawn from the preview; no window.prompt",
    /window\.H3SheetDesign = /.test(HS) && /id="h3sPreset"/.test(HS) && /id="h3sLayout"/.test(HS) && /id="h3sTiled"/.test(HS) && /h3sRefFile/.test(HS) && /h3sPartText/.test(HS) && /h3sVpText/.test(HS)
    && /\/api\/charsheet\/h3\/preview/.test(HS) && /H3NeedInstall\.ensure\("h3sheet"/.test(HS) && !/window\.prompt|\bprompt\(/.test(HS));
  const NI = src("static/needinstall.js");
  check("the Download / Cancel box knows the add-on part h3sheet (Settings ▸ Add-ons install + its job)", /h3sheet: \{ name: "H3 Character Sheet Designer"/.test(NI) && /addon: "h3sheet"/.test(NI) && /\/api\/addons\/" \+ encodeURIComponent\(P\.addon\) \+ "\/install"/.test(NI) && /\/api\/addons\/job\?from=/.test(NI));
  check("misc/NOTICE.md: the designer credited (MIT code; its artwork not used)", /H3 Character Sheet Designer \(ukr8b3g-cmyk\)/.test(src("misc/NOTICE.md")) && /artwork/.test(src("misc/NOTICE.md")));

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
