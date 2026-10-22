#!/usr/bin/env node
/* bitGen Studio — 2.575.0 units: the model manager's own files of a model (lib/modelMedia), what a file was made with
 * (lib/mediaMeta: PNG text chunks - ComfyUI's graph, A1111 parameters - container tags, this app's job record), ✎→ To
 * prompt (static/usemeta.js), the half-star rating + model type + NSFW (lib/modelCards, static/modelmgr.js), the Civitai
 * sync in the status bar (static/civitaisync.js) and the docker layout kept over a restart (floatpanels keepTabs /
 * restoring, dockgroup, dockcfg, secfloat min, flush on close).
 * Tim: "in modelmanager docker, allow user to change the thumbnail and add images,sound or video of the model and example
 * prompts or metadata from the image/video/music. when user clicks one of the preview thumbs open the whole image in the
 * dialog we currently use to view images/videos/music. add a button for the prompt from metadata to send to prompt - this
 * will use the seed, cfg and steps of the image/video/music(do this for gallery,assets and reference too). when a docker
 * is placed in a new docker save it's position, when bitgen starts again maintain the last position and status(open,
 * minimized,closed) of all dockers" + model type, NSFW, 0.5-star ratings, "let me know in the status bar that civitai is
 * still syncing and when it is finished" */
"use strict";
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };

/* a PNG with text chunks (a 1x1 picture) */
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, "latin1"), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); }
function png(texts) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
  const idat = zlib.deflateSync(Buffer.from([0, 255, 0, 0]));
  const tx = Object.entries(texts).map(([k, v]) => k.startsWith("i:") ? chunk("iTXt", Buffer.concat([Buffer.from(k.slice(2) + "\0\0\0\0\0", "latin1"), Buffer.from(v, "utf8")])) : chunk("tEXt", Buffer.from(k + "\0" + v, "latin1")));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), ...tx, chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}
const GRAPH = { "3": { class_type: "KSampler", inputs: { seed: 4242, steps: 26, cfg: 6.5, sampler_name: "euler", scheduler: "normal", denoise: 1, model: ["4", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0] } },
  "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "juggernaut.safetensors" } }, "5": { class_type: "EmptyLatentImage", inputs: { width: 832, height: 1216, batch_size: 1 } },
  "6": { class_type: "CLIPTextEncode", inputs: { text: ["8", 0], clip: ["4", 1] } }, "7": { class_type: "CLIPTextEncode", inputs: { text: "blurry, ugly", clip: ["4", 1] } },
  "8": { class_type: "PrimitiveStringMultiline", inputs: { value: "a red fox in the snow, golden hour" } } };

(async () => {
  const M = require(path.join(ROOT, "lib", "mediaMeta.js"));
  /* 1 reading what a file was made with */
  const pa = M.fromA1111("a castle on a hill, sunset\nNegative prompt: lowres, text\nSteps: 30, Sampler: DPM++ 2M Karras, CFG scale: 7, Seed: 123456, Size: 768x512, Model: dreamshaper");
  check("A1111 parameters: prompt, negative, steps, sampler, cfg, seed, size, model", pa && pa.prompt === "a castle on a hill, sunset" && pa.negative === "lowres, text" && pa.steps === 30 && pa.cfg === 7 && pa.seed === 123456 && pa.sampler === "DPM++ 2M Karras" && pa.width === 768 && pa.model === "dreamshaper", pa);
  const pc = M.fromComfy(GRAPH);
  check("a ComfyUI graph: the sampler's seed / steps / cfg / sampler; the positive text through its encoder and a Primitive; the negative; the checkpoint; the size",
    pc && pc.seed === 4242 && pc.steps === 26 && pc.cfg === 6.5 && pc.sampler === "euler" && pc.prompt === "a red fox in the snow, golden hour" && pc.negative === "blurry, ugly" && pc.model === "juggernaut.safetensors" && pc.width === 832, pc);
  const h3 = M.fromComfy({ "1": { class_type: "MiniMaxH3ReferenceToVideo", inputs: { prompt: "a dancer on a rooftop", width: 1344, height: 768, length: 124 } }, "2": { class_type: "RandomNoise", inputs: { noise_seed: 77 } }, "3": { class_type: "BasicScheduler", inputs: { steps: 8, scheduler: "simple" } } });
  check("an H3 graph: the generator's own prompt, RandomNoise's seed, BasicScheduler's steps", h3 && h3.prompt === "a dancer on a rooftop" && h3.seed === 77 && h3.steps === 8, h3);
  const tg = M.fromTags({ COMMENT: "a rainy street\nSteps: 12, CFG scale: 3, Seed: 9" }), tp = M.fromTags({ description: "an epic orchestral theme" });
  check("container tags: A1111 text in a comment; plain words = the prompt", tg && tg.prompt === "a rainy street" && tg.seed === 9 && tg.from === "tags" && tp && tp.prompt === "an epic orchestral theme", [tg, tp]);
  const buf = png({ prompt: JSON.stringify(GRAPH), "i:parameters": "x\nSteps: 1, Seed: 1" });
  check("pngText: tEXt and iTXt chunks", (() => { const t = M.pngText(buf); return !!t.prompt && /Steps: 1/.test(t.parameters); })());
  const TMP = fs.mkdtempSync(path.join(require("os").tmpdir(), "mm575-"));
  try {
    fs.writeFileSync(path.join(TMP, "fox.png"), buf);
    const r = M.read(path.join(TMP, "fox.png"));
    check("read(png): ComfyUI's graph wins over A1111 text", r && r.seed === 4242 && r.from === "comfy", r);
    fs.writeFileSync(path.join(TMP, "plain.png"), png({ parameters: "a lighthouse\nNegative prompt: fog\nSteps: 20, CFG scale: 4.5, Seed: 31" }));
    const r2 = M.read(path.join(TMP, "plain.png"));
    check("read(png): A1111 parameters", r2 && r2.prompt === "a lighthouse" && r2.cfg === 4.5 && r2.from === "a1111", r2);

    /* 2 a model's own files (lib/modelMedia) - in the model_info library, its user/ folder */
    const MM = require(path.join(ROOT, "lib", "modelMedia.js"));
    const card = { kind: "model", name: "e2e575_unit_model.safetensors", size: 10 };
    const dir = MM.dir(card);
    fs.rmSync(dir, { recursive: true, force: true });
    try {
      const a = MM.add(card, { path: path.join(TMP, "fox.png"), name: "fox.png" });
      check("add a picture: kept in model_info/models/<stem>/user, its prompt + seed / cfg / steps read from it", a.ok && a.item.kind === "image" && a.item.meta.seed === 4242 && a.item.meta.prompt === "a red fox in the snow, golden hour" && fs.existsSync(path.join(dir, a.item.file)) && dir.includes(path.join("model_info", "models")), a);
      fs.writeFileSync(path.join(TMP, "song.mp3"), Buffer.from("ID3"));
      const b = MM.add(card, { path: path.join(TMP, "song.mp3"), name: "song.mp3", meta: { prompt: "a sea shanty", seed: "55", steps: 50 } });
      check("add a sound with its prompt given; a .txt is refused", b.ok && b.item.kind === "audio" && b.item.meta.seed === 55 && !!MM.add(card, { buf: Buffer.from("x"), name: "notes.txt" }).error, b);
      const u = MM.update(card, b.item.id, { meta: { prompt: "a sea shanty, accordion", cfg: 2 } });
      check("update its prompt + settings", u.ok && u.item.meta.prompt === "a sea shanty, accordion" && u.item.meta.cfg === 2);
      const t = MM.setThumb(card, { item: a.item.id });
      const L = MM.list(card);
      check("🖼 one of its pictures as the thumbnail (thumb_of says which); a sound cannot be one", t.ok && L.thumb && L.thumb_of === a.item.id && MM.thumbPath(card) && !!MM.setThumb(card, { item: b.item.id }).error, L);
      check("delete one; clear the thumbnail", MM.remove(card, b.item.id).ok && MM.list(card).items.length === 1 && MM.clearThumb(card).ok && !MM.thumbPath(card));
    } finally { fs.rmSync(path.join(ROOT, "model_info", "models", "e2e575_unit_model"), { recursive: true, force: true }); }
  } finally { fs.rmSync(TMP, { recursive: true, force: true }); }

  /* 3 the card: half stars, model type, NSFW */
  const C = require(path.join(ROOT, "lib", "modelCards.js"));
  check("halfStars: 4.3 -> 4.5, 4.74 -> 4.5, 4.76 -> 5, 9 -> 5, blank -> none", C.halfStars(4.3) === 4.5 && C.halfStars(4.74) === 4.5 && C.halfStars(4.76) === 5 && C.halfStars(9) === 5 && C.halfStars("") === null);
  check("model type: the editor's list; the default from its folder (checkpoints / diffusion_models / loras)", C.MODEL_TYPES.includes("Checkpoint") && C.MODEL_TYPES.includes("LoRA") && C.typeOf("loras") === "LoRA" && C.typeOf("diffusion_models") === "Diffusion model" && C.typeOf("checkpoints") === "Checkpoint"
    && C.USER_FIELDS.includes("model_type") && C.USER_FIELDS.includes("nsfw"));
  const MG = require(path.join(ROOT, "static", "modelmgr.js"));
  const sb = MG.starBar(3.5), filled = (sb.match(/width:(\d+)%/g) || []).map((x) => +x.replace(/\D/g, ""));
  check("starBar: 3.5 = three whole stars, one half, one empty; the editor's stars are clickable (data-mmstar) and a slider", filled.join() === "100,100,100,50,0" && /data-mmstar="5"/.test(MG.starBar(0, true)) && /role="slider"/.test(MG.starBar(2, true)));
  check("starAt: the left half of star 4 = 3.5, the right half = 4", MG.starAt(4, 0.2) === 3.5 && MG.starAt(4, 0.8) === 4 && MG.starAt(1, 0.1) === 0.5);
  const cards = [{ title: "a", nsfw: true, model_type: "Checkpoint" }, { title: "b", nsfw: false, model_type: "LoRA" }];
  check("filterCards: 🔞 unticked hides NSFW cards; by model type", MG.filterCards(cards, { nsfw: false }).length === 1 && MG.filterCards(cards, { nsfw: true }).length === 2 && MG.filterCards(cards, { mtype: "LoRA" })[0].title === "b");
  const MS = rd("static", "modelmgr.js");
  check("the editor: 🖼 Change… thumbnail, the star editor, Model type, NSFW; the filter bar: model type + 🔞 NSFW (remembered)",
    /id="mmeThumb"/.test(MS) && /starBar\(c\.user_rating, true\)/.test(MS) && /id="mmeType"/.test(MS) && /id="mmeNsfw"/.test(MS) && /id="mmMType"/.test(MS) && /id="mmNsfw"/.test(MS) && /nsfw: S\.nsfw \}\)\); \} catch/.test(MS));
  check("the info page: your files (＋ Add, drop from the gallery / Assets), a click opens the viewer (lbOpen), ✎→ / 🖼 / ✎ / 🗑 each; Civitai's examples open the viewer on a click and ✎→ uses seed / cfg / steps",
    /mediaHtml\(c\)/.test(MS) && /id="mmMAdd"/.test(MS) && /root\.lbOpen\(lb, i\)/.test(MS) && /data-mmmuse/.test(MS) && /data-mmmthumb/.test(MS) && /data-mmmdel/.test(MS) && /S\.exSel = n;(?: S\.lastPick = "ex";)? paint\(\);\s+if \(typeof root\.lbOpen === "function"\) root\.lbOpen\(items, n\)/.test(MS) && /useMeta\(e\.meta \|\| \{\}, kindForCard\(c\)\)/.test(MS));

  /* 4 ✎→ To prompt */
  const U = require(path.join(ROOT, "static", "usemeta.js"));
  check("kindOf: by the extension, else the job's mode", U.kindOf("a.png") === "image" && U.kindOf("a.webm") === "video" && U.kindOf("a.flac") === "audio" && U.kindOf("x", { mode: "ref2va" }) === "video");
  const m = { prompt: "p", seed: 7, steps: 20, cfg: 4 };
  check("plan: an image -> #prompt #seed #imgSteps #imgCfg; a video -> #steps #cfg; a song -> the Music docker's lyrics + seed",
    JSON.stringify(U.plan(m, "image")) === JSON.stringify([["prompt", "p"], ["seed", "7"], ["imgSteps", "20"], ["imgCfg", "4"]]) && U.plan(m, "video").map((x) => x[0]).join() === "prompt,seed,steps,cfg"
    && U.plan(m, "audio").map((x) => x[0]).join() === "muLyrics,prompt,muSeed");
  const IX = rd("static", "index.html");
  check("the gallery (pictures, videos, songs), Assets, References (pictures, videos, sounds) have ✎→; the viewer's details pane too",
    (IX.match(/useMetaBtn\(el\.querySelector\("\.gmeta"\), "output", f\.name/g) || []).length === 3 && /useMetaBtn\(el\.querySelector\("\.an"\), kind, a\.name\)/.test(IX)
    && /H3UseMeta\.sendBlob\(r\.file/.test(IX) && /useMetaBtn\(el\.querySelector\("\.an"\), "video", n/.test(IX) && /useMetaBtn\(el\.querySelector\("\.an"\), "sound", n/.test(IX)
    && /✎→ To prompt \(prompt, seed, cfg, steps\)/.test(rd("static", "jobmeta.js")) && /\/api\/media-meta\?src=/.test(rd("static", "jobmeta.js")));
  const RM = rd("routes", "modelMgr.js"), RI = rd("routes", "index.js");
  check("routes: /api/modelmgr/media (+ /file, /update, /delete), /api/modelmgr/thumb (+ /clear), /api/media-meta - mounted from routes/index.js",
    ["/api/modelmgr/media\"", "/api/modelmgr/media/file", "/api/modelmgr/media/update", "/api/modelmgr/media/delete", "app.post(\"/api/modelmgr/thumb\"", "/api/modelmgr/thumb/clear"].every((x) => RM.includes(x))
    && /require\("\.\/mediaMeta"\)\.mount\(app\)/.test(RI) && !/mediaMeta/.test(rd("server.js")));

  /* 5 the Civitai sync in the status bar */
  const CS = require(path.join(ROOT, "static", "civitaisync.js"));
  const run = CS.text({ running: true, done: 12, total: 80, current: "x.safetensors" }), fin = CS.text({ running: false, done: 80, total: 80, found: 64, nomatch: 14, failed: 2 }, true);
  check("status bar: running = 🔄 Civitai 12/80; finished = ✓ Civitai synced: 64 found · 14 no match · 2 failed; idle = nothing",
    run.state === "running" && run.txt === "🔄 Civitai 12/80" && /x\.safetensors/.test(run.tip) && fin.state === "done" && fin.txt === "✓ Civitai synced: 64 found · 14 no match · 2 failed" && CS.text({ running: false, total: 3 }, false).state === "");
  check("the model manager's ⤓ / 🔄 tell the status bar (watch)", (MS.match(/H3CivitaiSync\.watch\(\)/g) || []).length === 2 && /civitaisync\.js/.test(IX));

  /* 6 the docker layout over a restart */
  const P = require(path.join(ROOT, "static", "floatpanels.js"));
  check("keepTabs: a member not here yet keeps its place; one moved out (here, not in the docker) is dropped; a new one goes last",
    P.keepTabs(["a", "c"], ["a", "b", "c"], (t) => t !== "b").join() === "a,b,c" && P.keepTabs(["a", "c"], ["a", "b", "c"], () => true).join() === "a,c" && P.keepTabs(["a", "d"], ["a"], () => true).join() === "a,d");
  const FP = rd("static", "floatpanels.js"), DG = rd("static", "dockgroup.js"), DC = rd("static", "dockcfg.js"), SF = rd("static", "secfloat.js");
  check("start: a docker re-docked into its ▣ docker keeps hidden / collapsed (restoring); the active tab waits for its member; saves flush on close",
    /restoring\+\+/.test(FP) && /restoring: \(\) => restoring > 0/.test(FP) && /!\(p\.restoring && p\.restoring\(\)\)\) d\.classList\.remove\("dockgone", "collapsed"\)/.test(DG)
    && /!\(P\.restoring && P\.restoring\(\)\)\) d\.classList\.remove/.test(rd("ext", "videodock", "storyboard.js")) && /root\.addEventListener\("pagehide", flush\)/.test(FP) && /window\.addEventListener\("pagehide", flushLayout\)/.test(IX));
  check("a saved ⊞ docker config does not override the restored layout at start; minimized floating panels stay minimized; a side docker in a ▣ docker is not saved as hidden; extension dockers reopen as left",
    /if \(Date\.now\(\) < bootUntil\) return;/.test(DC) && /f\.min = m;/.test(SF) && /rec\(\)\[id\]\.min\) \{ W\[id\]\.restoringMin = true/.test(SF) && /min: o\.min === true/.test(rd("lib", "dockerStatus.js"))
    && /!\(el && el\.classList\.contains\("dg-floating"\)\)/.test(IX) && /store\.get\("c\." \+ d\.id, "0"\) === "1"/.test(IX));
  check("the StoryBoard's float button has its label again (⇱)", /b\.type = "button"; b\.title = "Float the StoryBoard[^"]*"; b\.textContent = "⇱";/.test(rd("ext", "videodock", "storyboard.js")));

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
