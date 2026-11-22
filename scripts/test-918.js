#!/usr/bin/env node
// bitGen Studio 2.918.0 - LongCat-Video-Avatar 1.6: a person talking / singing to a sound (Tim: "https://meigen-ai.github.io/
// LongCat-Video-Avatar-1.6-Page/, can you add this"). Run: node scripts/test-918.js
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 500)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

(async () => {
  const L = require("../lib/longcat");
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "lc918-"));
  const pic = path.join(T, "person.png"), snd = path.join(T, "speech.wav");
  fs.writeFileSync(pic, "x"); fs.writeFileSync(snd, "x");
  const st = { id: "st_lc", name: "LongCat Avatar 1.6", kind: "video", arch: "longcat_avatar" };
  check("isLongcatStyle: arch longcat_avatar only", L.isLongcatStyle(st) && !L.isLongcatStyle({ kind: "video", arch: "pan2" }) && !L.isLongcatStyle({ kind: "image", arch: "longcat_avatar" }));
  const p = L.params({ style: st, prompt: "A woman talks", image: pic, audio: { path: snd, start: 1.5 }, width: 1280, height: 720, seed: 9 });
  check("params: mode longcat, the picture, the speech + its start, Basic Settings' size, the seed, the release's mix, the style kept",
    p.mode === "longcat" && p.image === pic && p.audio.path === snd && p.audio.start === 1.5 && p.width === 1280 && p.height === 720 && p.seed === 9
    && p.mix_steps === 4 && p.mix_alpha === 1 && p.ref_img_index === 10 && p.max_seconds === 0 && p.video_style_id === "st_lc", p);
  check("params: no speech / not a sound / no prompt / a gone picture are refused in words",
    /References docker/.test(L.params({ style: st, prompt: "x" }).error) && /not a sound/.test(L.params({ style: st, prompt: "x", audio: { path: pic } }).error)
    && /prompt first/.test(L.params({ style: st, audio: { path: snd } }).error) && /picture is gone/.test(L.params({ style: st, prompt: "x", image: path.join(T, "gone.png"), audio: { path: snd } }).error));
  check("params: no picture = the person from the prompt (said in the summary), the whole sound", !L.params({ style: st, prompt: "x", audio: { path: snd } }).image
    && /from the prompt alone/.test(L.summary(L.params({ style: st, prompt: "x", audio: { path: snd } }))) && /as long as the sound/.test(L.summary(p)));
  const wb = L.withBasic(st, JSON.stringify({ override: true, seed: 42, steps: 30, cfg: 5, model: "", loras: [] }), {});
  check("withBasic: Override style gives its seed (LongCat's 8 steps / cfg 1 are its own)", wb.seed === 42 && wb.bo && wb.style === st, wb);
  const fake = (j, ok = true) => async () => ({ ok, json: async () => j });
  check("comfySupport: the pack's LongCatAvatarVideo node -> nodes; none -> not; down -> offline",
    (await L.comfySupport({ url: "http://x", fetch: fake({ LongCatAvatarVideo: { input: {} } }) })).nodes === true
    && (await L.comfySupport({ url: "http://x", fetch: fake({}) })).nodes === false
    && (await L.comfySupport({ url: "http://x", fetch: async () => { throw new Error("down"); } })).online === false);

  // the add-on
  const A = require("../lib/longcatAddon");
  const models = path.join(T, "models"), nodes = path.join(T, "custom_nodes");
  fs.mkdirSync(models, { recursive: true }); fs.mkdirSync(nodes, { recursive: true });
  const place = { ok: true, models, customNodes: nodes, python: "python3" };
  let s0 = A.status(place);
  check("add-on status: nothing = not installed; the pack, LoRAs, Whisper, umT5, VAE needed; int8 ticked, W4A8 / bf16 offered",
    !s0.installed && s0.note === "not installed" && ["pack", "loras", "whisper", "te", "vae"].every((id) => s0.items.find((i) => i.id === id).need)
    && s0.items.find((i) => i.id === "int8").dflt && !s0.items.find((i) => i.id === "bf16").dflt, s0);
  fs.mkdirSync(path.join(models, "text_encoders"), { recursive: true }); fs.writeFileSync(path.join(models, "text_encoders", "umt5_xxl_bf16.safetensors"), "x");
  fs.mkdirSync(path.join(models, "vae", "wan"), { recursive: true }); fs.writeFileSync(path.join(models, "vae", "wan", "wan_2.1_vae.safetensors"), "x");
  s0 = A.status(place);
  check("add-on: any umT5 / a Wan 2.1 VAE already there counts (one folder deep) - not downloaded again",
    s0.items.find((i) => i.id === "te").present && s0.items.find((i) => i.id === "vae").present, s0.items);
  const got = [], packs = [];
  const r = await A.install(() => {}, ["w4a8", "pack", "loras"], { place, packInstall: async (pk) => { packs.push(pk.folder); fs.mkdirSync(path.join(nodes, pk.folder)); return { ok: true }; },
    download: async (m) => { got.push(m.id); const d = require("../lib/setupModels").destPath(m, { comfyModels: models, app: ROOT }); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, "x"); return { ok: true }; },
    comfy: async () => ({ online: false, nodes: false }) });
  check("add-on install: the pack cloned, the DiT ticked (W4A8 only) + the LoRAs + Whisper; umT5 / VAE skipped (there)",
    r.ok && packs[0] === "ComfyUI-LongCat-Avatar" && JSON.stringify(got) === JSON.stringify(["longcat_w4a8", "longcat_dmd", "longcat_opsd", "longcat_whisper"]), { r, got, packs });
  const s1 = A.status(place);
  check("add-on: installed now (a DiT + everything needed), the note says what to do", s1.installed && s1.pack && /pick the LongCat Avatar 1.6 video style/.test(s1.note), s1);
  check("add-on: nothing ticked = int8", JSON.stringify(A.wanted([])) === '["int8"]' && JSON.stringify(A.wanted(["pack", "bf16"])) === '["bf16"]');
  const rm = []; await A.remove((l) => rm.push(l), place);
  check("add-on remove: the DiT / LoRAs / Whisper go, umT5 + VAE + pack stay", !fs.existsSync(path.join(models, "loras", "longcat-video-avatar", "longcat_video_avatar_1.6_dmd_lora_bf16.safetensors"))
    && fs.existsSync(path.join(models, "text_encoders", "umt5_xxl_bf16.safetensors")) && /stay/.test(rm.join(" ")), rm);

  // the catalogue, the pack, the starter, the arch
  const cat = JSON.parse(src("lib/modelCatalog.json"));
  const lc = cat.models.filter((m) => m.group === "longcat");
  check("catalog: group longcat - 3 DiTs, 2 LoRAs into loras/longcat-video-avatar, Whisper into audio_encoders, umT5 + VAE from Comfy-Org's Wan 2.1 repack",
    cat.groups.some((g) => g.id === "longcat") && lc.length === 8 && lc.filter((m) => /diffusion_models\/longcat-video-avatar$/.test(m.dest)).length === 3
    && lc.filter((m) => m.dest === "comfy/loras/longcat-video-avatar").length === 2 && lc.some((m) => m.dest === "comfy/audio_encoders")
    && lc.filter((m) => m.repo === "Comfy-Org/Wan_2.1_ComfyUI_repackaged").length === 2 && lc.filter((m) => m.repo === "PedroMarinhoDev/LongCat-Video-Avatar-1.6-ComfyUI").length === 6);
  const pk = JSON.parse(src("lib/nodePacks.json")).packs.find((x) => x.id === "longcat");
  check("node pack: PedroMarinhoDev/ComfyUI-LongCat-Avatar providing the three LongCat nodes", pk && pk.url === "https://github.com/PedroMarinhoDev/ComfyUI-LongCat-Avatar"
    && ["LongCatAvatarModelLoader", "LongCatAvatarAudioEncode", "LongCatAvatarVideo"].every((c) => pk.provides.includes(c)));
  check("starter style + arch: LongCat Avatar 1.6 (longcat_avatar), 25 fps note, 8 steps cfg 1", /name: "LongCat Avatar 1\.6", kind: "video", arch: "longcat_avatar"/.test(src("lib/styles.js"))
    && JSON.parse(src("lib/videoArch.json")).archs.some((a) => a.id === "longcat_avatar" && a.defaults.steps === 8 && a.defaults.cfg === 1 && /25 fps/.test(a.note)));
  check("families: famFilter / modelCards / refTags know longcat (plain picture words, not <Picture n>)",
    /\[\/\^longcat\/, "longcat"\]/.test(src("lib/famFilter.js")) && /return "longcat"/.test(src("lib/modelCards.js"))
    && require("../lib/refTags").videoFamily({ arch: "longcat_avatar" }) === "longcat" && /longcat: "LongCat Avatar"/.test(src("lib/refTags.js")));
  const ad = require("../lib/addons").LIST.find((a) => a.id === "longcat");
  check("Settings ▸ Add-ons: LongCat Avatar 1.6 with its size, links (the pack, the files) and the module", ad && /int8 16\.0 GB/.test(ad.size) && ad.links().length === 3 && typeof ad.install({ items: ["int8"] }) === "function");
  check("core: mode longcat -> longcat_worker.py; the RunPod endpoint list says why not", /longcat: "longcat_worker\.py"/.test(src("lib/core.js")) && /longcat_avatar: "the LongCat Avatar worker/.test(src("lib/rpslStyles.js")));
  const ri = src("routes/index.js");
  check("routes: /api/longcat mounted from routes/index.js (not server.js); /api/generate sends a LongCat style there",
    /require\("\.\/longcat"\)\.mount\(app\)/.test(ri) && /isLongcatStyle\(vs\)/.test(ri) && !/longcat/i.test(src("misc/server.js")));
  const rl = src("routes/longcat.js");
  check("POST /api/longcat: ComfyUI engine, the LongCat style, a prompt + the reference sound, the add-on (409 needs longcat), the pack's nodes loaded (restart)",
    /Engine to ComfyUI/.test(rl) && /isLongcatStyle\(st\)/.test(rl) && /b\.ref_audio/.test(rl) && /needs: "longcat"/.test(rl) && /comfy-restart/.test(rl) && /core\.makeJob\(p\)/.test(rl));
  const html = src("static/index.html"), gen = src("static/longcatgen.js"), ni = src("static/needinstall.js");
  check("the page: longcatgen.js loaded, Generate dispatches a LongCat style to it, the hint painted; needinstall knows longcat",
    /src="\/static\/longcatgen\.js"/.test(html) && /H3LongCatGen\.style\(\) \? await H3LongCatGen\.submit\(text\)/.test(html) && /H3LongCatGen\.paint\(\)/.test(html)
    && /longcat: \{ name: "LongCat Avatar 1\.6"/.test(ni) && /status: "\/api\/longcat", addon: "longcat"/.test(ni));
  check("longcatgen: no sound = said before anything is sent; the first sound as ref_audio, the First-frame picture as first; 409 -> the Download box",
    /if \(!soundNow\(\)\) \{ root\.alert/.test(gen) && /fd\.append\("ref_audio", o\.sound\)/.test(gen) && /r\.role === "first frame"/.test(gen) && /ensure\("longcat"/.test(gen));
  const App = require("../lib/appApi");
  const f = App.formFor(App.routeFor({ arch: "longcat_avatar" }), { prompt: "hi", style_id: "st_lc", ref_audios: '["talk.wav"]' }, [{ name: "me.jpg" }]);
  check("the 📱 app: a LongCat style -> /api/longcat with the first picture and the first sound", App.routeFor({ arch: "longcat_avatar" }) === "longcat" && f.path === "/api/longcat"
    && f.fields.some(([k, v]) => k === "ref_audio" && v === "talk.wav") && f.files[0][0] === "first", f);
  check("credits + NOTICE: Meituan LongCat (MIT weights) and PedroMarinhoDev's pack (GPL-3.0, not shipped)", /LongCat-Video-Avatar 1\.6/.test(src("lib/credits.json"))
    && /PedroMarinhoDev/.test(src("lib/credits.json")) && /No LongCat code or weights are shipped/.test(src("misc/NOTICE.md")));
  fs.rmSync(T, { recursive: true, force: true });
  console.log(`RESULT: ${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})();
