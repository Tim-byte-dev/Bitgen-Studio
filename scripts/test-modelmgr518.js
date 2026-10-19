#!/usr/bin/env node
/* bitGen Studio — 2.518.0 units: 🧩 THE MODEL + LoRA MANAGER (lib/modelCards.js, static/modelmgr.js, routes/modelMgr.js)
 * and CIVITAI (lib/civitai.js, routes/civitai.js).
 * Tim (verbatim): "create a model and lora manager floating docker with checkbox to overide styles setting and a button
 * to create new style from the model i select ... Add civitai.red(if i can get an api key) so models can be downloaded to
 * the appropriate folder on my machine without moving it or choosing save as."
 * The live part reads a fake ComfyUI folder (scripts/mmfixture518.js - real safetensors / GGUF headers, a .civitai.info,
 * preview pictures) and builds styles from its cards against the shipped starter styles. No network. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const MC = require("../lib/modelCards.js"), CV = require("../lib/civitai.js"), MM = require("../static/modelmgr.js"), FX = require("./mmfixture518.js");

/* ---- detection (pure) */
check("Civitai base models -> the type: SDXL 1.0, Pony, Illustrious, Flux.1 D, Flux.2 Klein 9B, Qwen, Wan Video, LTXV, SD 1.5",
  MC.baseFamily("SDXL 1.0") === "sdxl" && MC.baseFamily("Pony") === "pony" && MC.baseFamily("Illustrious") === "illustrious" && MC.baseFamily("Flux.1 D") === "flux"
  && MC.baseFamily("Flux.2 Klein 9B") === "flux2" && MC.baseFamily("Qwen") === "qwen" && MC.baseFamily("Wan Video 2.2 T2V-A14B") === "wan" && MC.baseFamily("LTXV") === "ltx" && MC.baseFamily("SD 1.5") === "sd15" && MC.baseFamily("") === "");
check("names -> the type: pony / illustrious / krea / anima / flux2 klein / qwen / wan / ltx / sdxl",
  MC.nameFamily("checkpoints/ponyDiffusionV6XL.safetensors") === "pony" && MC.nameFamily("waiIllustriousSDXL_v140") === "illustrious" && MC.nameFamily("krea2_turbo.safetensors") === "krea"
  && MC.nameFamily("anima-aesthetic-v1.1") === "anima" && MC.nameFamily("flux-2-klein-9b.gguf") === "flux2" && MC.nameFamily("qwen_image_edit_2511") === "qwen"
  && MC.nameFamily("wan2.2_t2v_14B") === "wan" && MC.nameFamily("ltx-2.3-dev") === "ltx" && MC.nameFamily("juggernautXL_v9") === "sdxl" && MC.nameFamily("random") === "");
check("headers -> the type: modelspec, kohya ss_base_model_version, tensor names (SDXL / SD 1.5 / Flux / Wan)",
  MC.headerFamily({ meta: { "modelspec.architecture": "stable-diffusion-xl-v1-base" }, keys: [] }) === "sdxl"
  && MC.headerFamily({ meta: { ss_base_model_version: "sd_v1" }, keys: [] }) === "sd15"
  && MC.headerFamily({ meta: {}, keys: ["double_blocks.0.img_attn.qkv.weight"] }) === "flux"
  && MC.headerFamily({ meta: {}, keys: ["blocks.0.cross_attn.k_img.weight"] }) === "wan"
  && MC.headerFamily({ meta: {}, keys: ["double_blocks.0.x"] }, { keys: false }) === "");
check("familyOf: your edit > Civitai > a header's metadata > the name > tensor names > GGUF arch; a Pony name beats a generic SDXL header",
  MC.familyOf({ user: "anima", base_model: "Pony" }) === "anima" && MC.familyOf({ base_model: "Pony", name: "x" }) === "pony"
  && MC.familyOf({ header: { meta: { "modelspec.architecture": "stable-diffusion-xl-v1-base" }, keys: [] }, name: "ponyV6" }) === "pony"
  && MC.familyOf({ header: { meta: { "modelspec.architecture": "stable-diffusion-xl-v1-base" }, keys: [] }, name: "qwen" }) === "sdxl"
  && MC.familyOf({ gguf: "flux", name: "mystery" }) === "flux" && MC.familyOf({ name: "zzz" }) === "other");
check("categories: image / image edit (edit, kontext, inpaint, fill) / video / music",
  MC.categoryOf("sdxl", { name: "x" }) === "image" && MC.categoryOf("qwen", { name: "qwen_image_edit_2511" }) === "image edit" && MC.categoryOf("flux", { base_model: "Flux.1 Kontext" }) === "image edit"
  && MC.categoryOf("wan", {}) === "video" && MC.categoryOf("music", {}) === "music");
const st = (() => { const h = {}; h.__metadata__ = { a: "1" }; h["x.weight"] = { dtype: "F16", shape: [1], data_offsets: [0, 2] }; const j = Buffer.from(JSON.stringify(h)); const l = Buffer.alloc(8); l.writeBigUInt64LE(BigInt(j.length)); return Buffer.concat([l, j]); })();
check("parseSafetensorsHeader: the metadata + tensor names from the first bytes; too short / junk = null",
  JSON.stringify(MC.parseSafetensorsHeader(st)) === JSON.stringify({ meta: { a: "1" }, keys: ["x.weight"], nkeys: 1 }) && MC.parseSafetensorsHeader(Buffer.from("nope")) === null && MC.parseSafetensorsHeader(st.slice(0, 20)) === null);
check("topTags: kohya ss_tag_frequency -> a LoRA's most used tags", JSON.stringify(MC.topTags({ ss_tag_frequency: JSON.stringify({ a: { "x": 3, "y": 9 }, b: { "x": 7 } }) }, 2)) === JSON.stringify(["x", "y"]) && MC.topTags({}).length === 0);
const inf = MC.mergeInfo({ id: 9, modelId: 7, name: "v1", baseModel: "Pony", trainedWords: ["zz"], publishedAt: "2025-01-02T00:00:00Z", stats: { thumbsUpCount: 3, thumbsDownCount: 1 },
  model: { name: "M", type: "LORA", description: "<p>a <b>b</b></p><ul><li>c</li></ul>" }, images: [{ meta: { cfgScale: 7, steps: 20 } }, { meta: { cfgScale: 5, steps: 30, sampler: "DPM++ 2M" } }, { meta: { cfgScale: 6, steps: 25 } }] });
check("mergeInfo (Civitai's version JSON / .civitai.info / LoRA Manager): title, base model, release date, ★ from thumbs, the example pictures' median cfg / steps, keywords, its link",
  inf.title === "M · v1" && inf.base_model === "Pony" && inf.released === "2025-01-02" && inf.rating === 3.8 && inf.rating_count === 4 && inf.cfg === 6 && inf.steps === 25 && inf.sampler === "DPM++ 2M"
  && JSON.stringify(inf.keywords) === '["zz"]' && /civitai\.com\/models\/7\?modelVersionId=9/.test(inf.civitai.url) && inf.description === "a b\n• c" && Object.keys(MC.mergeInfo({ x: 1 })).length === 0, inf);
check("textOf: Civitai's HTML -> plain text (no tag reaches the page; the page escapes it again)", !/[<>]/.test(MC.textOf("<p>hi<script>x</script></p><br>&amp; <img src=x onerror=1>")) && MC.textOf("<p>a</p><p>b</p>") === "a\nb");

/* ---- the folders */
const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg518m-"));
const F = FX.make(T);
const sc = require("../lib/comfyModels.js").scan(F.comfy, {});
const L = MC.list({ scan: sc, refresh: true });
const by = (k) => L.models.concat(L.loras).find((c) => c.key === k);
check("list: 5 models (checkpoints + diffusion_models) and 2 LoRAs from ComfyUI's folders, + the VAE / text encoder lists", L.models.length === 5 && L.loras.length === 2 && L.vae[0] === "sdxl_vae.safetensors" && L.te[0] === "qwen_3_06b_base.safetensors", { m: L.models.length, l: L.loras.length });
const pony = by("checkpoints|ponyDiffusionV6XL.safetensors"), jug = by("checkpoints|juggernautXL_v9.safetensors"), gg = by("diffusion_models|mystery-model-Q8_0.gguf");
const wan = by("diffusion_models|wan2.2_t2v_14B_fp8.safetensors"), qe = by("diffusion_models|qwen_image_edit_2511_fp8.safetensors");
check("cards: Pony (header SDXL + the name), SDXL (tensor names), Flux (the GGUF header), Wan = video, Qwen edit = image edit",
  pony.family === "pony" && pony.family_label === "Pony" && jug.family === "sdxl" && gg.family === "flux" && wan.family === "wan" && wan.category === "video" && qe.family === "qwen" && qe.category === "image edit",
  [pony.family, jug.family, gg.family, wan.family, wan.category, qe.category]);
check("thumbnails: <stem>.preview.png beside the model; none = false", jug.thumb === true && pony.thumb === false && MC.thumbFile !== undefined);
const lin = by("loras|anime_lineart.safetensors"), det = L.loras.find((c) => /detail_tweaker/.test(c.key));
check("a LoRA from a .civitai.info: Illustrious, ★ 4.5 (90 up / 10 down), released 2026-03-14, cfg 5.5 / steps 28 (median), keywords lineart, monochrome",
  lin.family === "illustrious" && lin.rating === 4.5 && lin.released === "2026-03-14" && lin.cfg === 5.5 && lin.steps === 28 && lin.keywords.join(",") === "lineart,monochrome" && lin.source === "civitai" && /Clean lineart/.test(lin.description), lin);
check("a LoRA with kohya metadata only: SDXL, its top tags as keywords, in a subfolder", det.family === "sdxl" && det.keywords[0] === "highly detailed" && /sdxl[\\/]detail_tweaker_xl\.safetensors$/.test(det.name), det);

/* ---- ✎ edits */
const cards = require("../lib/modelCards.js");
const realFind = cards.find;
// edit() / find() use the live scan: point them at the fixture
const live = () => MC.list({ scan: sc, refresh: true });
live();
const ed = MC.edit("checkpoints|ponyDiffusionV6XL.safetensors", { cfg: 6.5, steps: 25, keywords: "score_9, score_8_up", user_rating: 4.5, family: "pony", vae: "sdxl_vae.safetensors" });
const side = JSON.parse(fs.readFileSync(path.join(F.models, "checkpoints", "ponyDiffusionV6XL.bitgen.json"), "utf8"));
check("✎ edit: your fields into <stem>.bitgen.json `user` beside the model", ed.ok && side.user.cfg === 6.5 && side.user.steps === 25 && side.user.keywords.join("|") === "score_9|score_8_up" && side.user.user_rating === 4.5, side);
const L2 = live(); const pony2 = L2.models.find((c) => c.key === "checkpoints|ponyDiffusionV6XL.safetensors");
check("…and the card reads them back (cfg 6.5, steps 25, your ★ 4.5 shown, edited)", pony2.cfg === 6.5 && pony2.steps === 25 && pony2.user_rating === 4.5 && pony2.edited && MM.stars(pony2) === "★ 4.5" && pony2.vae === "sdxl_vae.safetensors", pony2);
MC.edit("checkpoints|ponyDiffusionV6XL.safetensors", { cfg: "" });
check("✎ a blank field clears it (back to the style's)", live().models.find((c) => c.key === "checkpoints|ponyDiffusionV6XL.safetensors").cfg === null);

/* ---- ✚ styles */
const styles = require("../lib/styles.js");
const starters = styles.STARTER_STYLES.map((s, i) => Object.assign({ id: "st_" + i, kind: "image" }, s));
const r1 = MC.styleFrom(Object.assign({}, pony2, { cfg: 6, steps: 26 }), { loras: [{ path: "anime_lineart.safetensors", weight: 0.7 }], name: "My Pony" }, starters);
check("styleFrom: a Pony model -> the Pony starter copied (its SDXL workflow), this model, the LoRA, the card's cfg / steps / VAE",
  r1.raw && r1.template.name === "Pony" && r1.raw.model === "ponyDiffusionV6XL.safetensors" && r1.raw.workflow === "comfy_workflows/img_sdxl_t2i.json" && r1.raw.loras.some((l) => l.path === "anime_lineart.safetensors" && l.weight === 0.7)
  && r1.raw.cfg === 6 && r1.raw.steps === 26 && r1.raw.vae === "sdxl_vae.safetensors" && r1.raw.name === "My Pony" && !("id" in r1.raw), r1);
const n1 = styles.normalize(r1.raw, null);
check("…normalize() keeps it a real image style (a new id, arch sdxl, the LoRA)", n1.kind === "image" && n1.arch === "sdxl" && n1.model === "ponyDiffusionV6XL.safetensors" && n1.loras.length >= 1 && /^st_/.test(n1.id), n1);
const r2 = MC.styleFrom(gg, {}, starters);
check("a Flux GGUF -> a Flux style; Krea GGUF -> the Krea GGUF twin; Anima -> Anima", r2.raw && /FLUX/.test(r2.template.name)
  && MC.templateFor({ family: "krea", name: "x.gguf" }, starters).name === "Krea 2 Turbo GGUF" && MC.templateFor({ family: "anima", name: "x.safetensors" }, starters).name === "Anima", r2.template);
const r3 = MC.styleFrom(wan, {}, starters.concat(styles.STARTER_STYLES.filter((s) => s.kind === "video").map((s, i) => Object.assign({ id: "sv_" + i }, s))));
check("a Wan model -> a video style: the model in its first sampler phase", r3.raw && r3.template.kind === "video" && r3.raw.phases[0].model === "wan2.2_t2v_14B_fp8.safetensors", r3);
check("no template for its type -> an error that says pick one; a LoRA alone -> pick a model", /no style renders/.test(MC.styleFrom({ kind: "model", family: "hidream", family_label: "HiDream", name: "h" }, {}, starters).error)
  && /pick a model/.test(MC.styleFrom(lin, {}, starters).error));
const r4 = MC.styleFrom(pony2, { template_id: "st_" + styles.STARTER_STYLES.findIndex((s) => s.name === "Illustrious") }, starters);
check("the template you pick wins over the automatic one", r4.template.name === "Illustrious", r4.template);

/* ---- Civitai (pure) */
check("catFor: Checkpoint -> checkpoints (a GGUF -> diffusion_models), LORA / LoCon / DoRA -> loras, VAE, embeddings, controlnet, upscale; a training-data zip -> nothing",
  CV.catFor("Checkpoint", { type: "Model", name: "a.safetensors" }) === "checkpoints" && CV.catFor("Checkpoint", { type: "Model", name: "a.gguf", metadata: { format: "GGUF" } }) === "diffusion_models"
  && CV.catFor("LORA", { type: "Model" }) === "loras" && CV.catFor("LoCon", {}) === "loras" && CV.catFor("DoRA", {}) === "loras" && CV.catFor("Checkpoint", { type: "VAE" }) === "vae"
  && CV.catFor("TextualInversion", {}) === "embeddings" && CV.catFor("Controlnet", {}) === "controlnet" && CV.catFor("Upscaler", {}) === "upscale_models" && CV.catFor("LORA", { type: "Training Data" }) === "" && CV.catFor("Workflows", {}) === "");
check("isBareDiffusion: no VAE and no text encoder inside = UNETLoader's (diffusion_models); a full checkpoint is not",
  CV.isBareDiffusion({ keys: ["double_blocks.0.x", "img_in.weight"] }) && !CV.isBareDiffusion({ keys: ["first_stage_model.x", "model.diffusion_model.y"] }) && !CV.isBareDiffusion({ keys: ["conditioner.embedders.0.x"] }) && !CV.isBareDiffusion(null));
const ver = { files: [{ id: 1, type: "Training Data" }, { id: 2, type: "Model", primary: false }, { id: 3, type: "Model", primary: true }] };
check("pickFile: the one asked for, else the primary model file", CV.pickFile(ver).id === 3 && CV.pickFile(ver, 2).id === 2 && CV.pickFile({ files: [] }) === null);
check("pickImage: the first still (no video), safe-for-work unless mature is on", CV.pickImage([{ url: "a.mp4", type: "video" }, { url: "b.jpeg", type: "image", nsfwLevel: 8 }, { url: "c.jpeg", type: "image", nsfwLevel: 1 }]).url === "c.jpeg"
  && CV.pickImage([{ url: "b.jpeg", type: "image", nsfwLevel: 8 }], true).url === "b.jpeg" && CV.pickImage([], false) === null);
check("safeName: a file name that cannot climb out of the folder", CV.safeName("../../evil.safetensors") === "evil.safetensors" && CV.safeName("a:b*c.safetensors") === "a_b_c.safetensors" && CV.safeName("...x") === "x");
check("rating: thumbs -> ★ (Civitai dropped the 5-star average)", CV.rating({ thumbsUpCount: 95, thumbsDownCount: 5 }).rating === 4.8 && CV.rating({ rating: 4.71, ratingCount: 9 }).rating === 4.7 && CV.rating({}).rating === null);
const mm = CV.mapModel({ id: 77, name: "Lineart Pony", type: "LORA", description: "<p>x</p>", stats: { thumbsUpCount: 9, thumbsDownCount: 1, downloadCount: 1000 }, creator: { username: "me" },
  modelVersions: [{ id: 8, name: "v1", baseModel: "Pony", publishedAt: "2026-05-01T00:00:00Z", trainedWords: ["lineart"], images: [{ url: "https://image.civitai.com/a/width=450/1.jpeg", type: "image", nsfwLevel: 1 }],
    files: [{ id: 5, name: "lp.safetensors", sizeKB: 1024, type: "Model", primary: true, hashes: { SHA256: "ABC" } }] }] });
check("mapModel: a search result -> a card (type Pony, ★ 4.5, released, keywords, its picture, each file and where it would go)",
  mm.family === "pony" && mm.rating === 4.5 && mm.released === "2026-05-01" && mm.keywords[0] === "lineart" && /image\.civitai\.com/.test(mm.thumb) && mm.versions[0].files[0].cat === "loras" && mm.versions[0].files[0].sha256 === "abc" && mm.description === "x", mm);
check("siteBase: civitai.red (default) / civitai.com", CV.siteBase("civitai.com") === "https://civitai.com/api/v1" && CV.siteBase("nope") === "https://civitai.red/api/v1");

/* ---- the page (pure) */
const cs = [{ title: "B", family: "pony", category: "image", rating: 4, released: "2025-01-01", keywords: ["neon"] }, { title: "a", family: "wan", category: "video", rating: 4.9, file_date: "2026-01-01" }, { title: "C", family: "pony", category: "image", user_rating: 5 }];
check("filterCards: category / type / words (name, type, keywords)", MM.filterCards(cs, { category: "image" }).length === 2 && MM.filterCards(cs, { family: "wan" }).length === 1 && MM.filterCards(cs, { q: "neon" })[0].title === "B" && MM.filterCards(cs, { q: "pony video" }).length === 0);
check("sortCards: A-Z (case-blind), newest (release date, else the file's), rating (yours first)", MM.sortCards(cs, "name").map((c) => c.title).join("") === "aBC" && MM.sortCards(cs, "newest")[0].title === "a" && MM.sortCards(cs, "rating")[0].title === "C");
const hp = MM.hoverPos({ left: 100, right: 240, top: 50, bottom: 250 }, 320, 300, 1280, 800), hp2 = MM.hoverPos({ left: 1000, right: 1140, top: 700, bottom: 900 }, 320, 300, 1280, 800);
check("hoverPos: the description card right of the card, or left when there is no room, always inside the window", hp.x === 248 && hp.y === 50 && hp2.x === 1000 - 8 - 320 && hp2.y === 800 - 300 - 4, [hp, hp2]);
const ml = MM.mergeLoras([{ path: "mine.safetensors", weight: 1 }, { path: "old.safetensors", weight: 0.5 }], ["old.safetensors"], [{ path: "new.safetensors", weight: 0.8 }]);
check("mergeLoras: your own temporary LoRAs stay, the manager's last ones go, its selection comes in", JSON.stringify(ml) === JSON.stringify([{ path: "mine.safetensors", weight: 1 }, { path: "new.safetensors", weight: 0.8 }]), ml);
check("thumbUrl: a local card -> /api/modelmgr/thumb; a Civitai one -> the /api/civitai/img proxy; none -> ''", /^\/api\/modelmgr\/thumb\?key=checkpoints%7Cx/.test(MM.thumbUrl({ key: "checkpoints|x", thumb: true }))
  && /^\/api\/civitai\/img\?u=https%3A/.test(MM.thumbUrl({ remote: true, thumb: "https://image.civitai.com/a.jpeg" })) && MM.thumbUrl({ key: "k", thumb: false }) === "");

/* ---- wiring */
const IDX = read("routes", "index.js"), HT = read("static", "index.html"), RM = read("routes", "modelMgr.js"), RC = read("routes", "civitai.js"), CVS = read("lib", "civitai.js");
const SRV = (() => { try { return read("server.js"); } catch { return ""; } })();
check("routes mounted from routes/index.js: /api/modelmgr/cards|thumb|card|style, /api/civitai/test|search|download|downloads|lookup|img; server.js untouched",
  /require\("\.\/modelMgr"\)\.mount\(app\)/.test(IDX) && /require\("\.\/civitai"\)\.mount\(app\)/.test(IDX) && ["cards", "thumb", "card", "style"].every((x) => RM.includes('"/api/modelmgr/' + x + '"'))
  && ["test", "search", "download", "downloads", "lookup", "img"].every((x) => RC.includes('"/api/civitai/' + x + '"')) && !/modelCards|civitai/.test(SRV));
check("the key is only ever sent to Civitai (the API's Authorization header, ?token= on a download) and the image proxy takes Civitai's hosts only",
  /Authorization: "Bearer " \+ tok/.test(CVS) && /u\.searchParams\.set\("token", c\.token\)/.test(CVS) && /IMG_HOSTS\.test\(url\.hostname\)/.test(CVS) && !/console\.log\([^)]*token/.test(CVS));
check("the page: modelmgr.js loaded; Settings -> General has the Civitai key (+ site, mature), the override reaches /api/genimage",
  /<script src="\/static\/modelmgr\.js"><\/script>/.test(HT) && /id="s_cvtok"/.test(HT) && /id="s_cvsite"/.test(HT) && /<option value="civitai\.red">/.test(HT)
  && /body\.mm_override = true/.test(HT) && /if \(b\.mm_override === true\) styled = Object\.assign\(\{\}, styled, \{ mm_override: true \}\)/.test(IDX));
try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
