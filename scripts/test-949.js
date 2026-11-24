#!/usr/bin/env node
// bitGen Studio 2.949.0 - the ⇄ Swap dialog's OpenJutsu engine (Tim: "is this worth adding? https://github.com/D3voz/openjutsu"
// -> "lets do it"). The GRAPH is asserted (doctrine), not the report. Run: node scripts/test-949.js
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n, got === undefined ? "" : JSON.stringify(got).slice(0, 700)); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

(async () => {
  const OJ = require("../lib/openjutsu");
  const byTitle = (g, t) => Object.values(g).filter((n) => ((n._meta || {}).title || "") === t);
  const cls = (g) => new Set(Object.values(g).map((n) => n.class_type));
  const links = (g) => Object.entries(g).every(([, n]) => Object.values(n.inputs || {}).every((v) => !(OJ.isLink(v)) || g[v[0]]));
  const base = { video: "/v.mp4", picture: "/p1.png", seed: 42 };

  // ---- the shipped workflows: OpenJutsu's own files, unmodified (MIT) + its licence beside them
  const SHA = { "advanced.api.json": "e192bf774435f907e8dfc38953b14e8dd2c81b2683465c21c554344139fb52d7", "advanced_maxq.api.json": "5aa5fd9eae7f526e6b6a4614764d5213459f2bdb155453656637c73d7ef24670",
    "color.api.json": "1a81f437b9aa8f746d083c8ea8e47695628009d62447590b03ae0b2e4bf5b7a8", "face.api.json": "6ebc74af833a352ec68e19ba2be6ef43fca132c426cb22c11bfd99d10548dd81",
    "mask.api.json": "86d7902c94a557eaf03fa1440bca53724ccc3939d2a3b7927890e0216102e4d7", "object.api.json": "fbfec05071d7f6d9986ba2650d58db9a0e5810a1e13f8efba36afbbf0f67eee2",
    "simple.api.json": "24dc5b8ef45788c839beb96b617b404308ddfd8921e89cfd9008442ad29a666a" };
  const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, "comfy_workflows", "openjutsu", f), "utf8").replace(/\r\n/g, "\n")).digest("hex");
  check("comfy_workflows/openjutsu: the seven workflows byte-for-byte OpenJutsu's (commit 7fe118b), its MIT licence beside them",
    Object.entries(SHA).every(([f, h]) => sha(f) === h) && /MIT License[\s\S]*Copyright \(c\) 2026 D3voz/.test(src("comfy_workflows/openjutsu/LICENSE.txt"))
    && OJ.PIN.commit === "7fe118bb5a61fcfac0148e1bfea3dd29884dbf26", Object.keys(SHA).filter((f) => sha(f) !== SHA[f]));

  // ---- the classes: every one a graph can use is ComfyUI core (lib/comfyCoreNodes.json) or a pack's verified export
  const core = new Set(JSON.parse(src("lib/comfyCoreNodes.json")).versions.latest.nodes);
  const packed = new Set(OJ.PACKS.flatMap((p) => p.provides));
  const unknown = OJ.KINDS.flatMap((k) => OJ.requiredClasses(k).filter((c) => !core.has(c) && !packed.has(c)).map((c) => k + ":" + c));
  check("every class of the seven graphs is ComfyUI core or provided by a listed pack (never guessed)", !unknown.length, unknown);
  check("packOf: the pack each class comes from (core -> '')", OJ.packOf("H3OneClickSwapPlan") === "comfyui-h3-oneclick-swap"
    && OJ.packOf("MiniMaxH3ChainAssemble") === "ComfyUI-MiniMaxH3-Contex-Loop" && OJ.packOf("H3FaceStitch") === "ComfyUI-H3-FaceRefine" && OJ.packOf("SAM3_VideoTrack") === "");

  // ---- settings
  const b0 = OJ.settingsBlank();
  check("settings blank: OpenJutsu's own defaults - simple, 736p, motion 512, normal margin, hat fix + no lip-sync off, 6 s clips, DMAD 6 steps, Fix faces NOT accepted",
    b0.mode === "simple" && b0.resolution === "736p" && b0.motion === 512 && b0.margin === "normal" && !b0.hat && !b0.nolip && b0.clip === 6 && b0.dmad && b0.steps === 6 && !b0.face.ok && b0.object.outline);
  const s1 = OJ.settingsSafe({ mode: "zz", resolution: "999p", motion: 333, margin: "x", clip: 99, steps: 0, dmad: true, spectrum: true, width: 1001, height: 9, pictures: ["../../etc/x.png"], face: { ok: "yes" } });
  check("settingsSafe: junk -> defaults; clip 15 max, steps 1 min, custom sizes snapped to 32 (256..2048), picture names basename'd, Spectrum only without DMAD, face.ok only true",
    s1.mode === "simple" && s1.resolution === "736p" && s1.motion === 512 && s1.margin === "normal" && s1.clip === 15 && s1.steps === 1 && !s1.spectrum
    && s1.width === 992 && s1.height === 256 && s1.pictures[0] === "x.png" && s1.face.ok === false && OJ.settingsSafe({ dmad: false, spectrum: true }).spectrum === true, s1);
  check("kindFor: the bar's mode -> the workflow", OJ.kindFor({ mode: "maxq" }) === "advanced_maxq" && OJ.kindFor({ mode: "object" }) === "object" && OJ.kindFor({}) === "simple");

  // ---- simple
  let b = OJ.build("simple", { ...base, settings: { role: "the drummer  -  red cap", resolution: "480p" }, start: 0, length: 4 });
  let g = b.graph;
  check("simple: the plan carries seed / clip seconds / roles (whitespace squeezed) / 480p; the video + picture uploads; the Final Video at the end",
    g[OJ.NODES.plan].inputs.seed === 42 && g[OJ.NODES.plan].inputs.clip_seconds === 6 && g[OJ.NODES.plan].inputs.roles === "the drummer - red cap"
    && g[OJ.NODES.plan].inputs.resolution === "480p" && b.final === "67" && g["67"].class_type === "MiniMaxH3ChainAssemble"
    && JSON.stringify(b.uploads) === JSON.stringify([{ node: "5", input: "video", path: "/v.mp4" }, { node: "2", input: "image", path: "/p1.png" }]), g[OJ.NODES.plan].inputs);
  check("simple: hat fix off = the six hat nodes gone, the grow mask reads the people mask; no lip-sync off = its nodes gone, H3 hears the soundtrack",
    !["47", "48", "49", "50", "51", "52"].some((k) => g[k]) && JSON.stringify(g["42"].inputs.mask) === JSON.stringify(["39", 0])
    && !byTitle(g, "No lip-sync in the prompt").length && !byTitle(g, "Mute the clip audio H3 hears").length && links(g));
  check("simple: every VHS soundtrack read goes through H3SoundtrackOrSilence (a silent video does not crash VHS)",
    g["5_soundtrack"] && g["5_soundtrack"].class_type === "H3SoundtrackOrSilence" && !Object.values(g).some((n) => Object.values(n.inputs).some((v) => OJ.isLink(v) && v[0] === "5" && v[1] === 2 && n !== g["5_soundtrack"])));
  check("simple: the window at 24 fps on the loader (skip / cap)", g["5"].inputs.skip_first_frames === 0 && g["5"].inputs.frame_load_cap === 96);
  b = OJ.build("simple", { ...base, settings: { hat: true, nolip: true, motion: 768, resolution: "custom", width: 1000, height: 576, dmad: false, steps: 24, spectrum: true, margin: "loose" }, start: 1.5, length: 2 });
  g = b.graph;
  check("simple + options: hats kept, no-lip-sync kept, motion 768 (+ its own run name), custom size = the centre-crop ImageScale + short edge, loose margin 60",
    g["47"] && g["68"] && byTitle(g, "Motion reference video (~512 px)")[0].inputs.largest_size === 768 && g.motion_run_name && g.custom_size.inputs.width === 992
    && g[OJ.NODES.plan].inputs.short_edge === 576 && g["42"].inputs.expand === 60 && g["5"].inputs.skip_first_frames === 36 && g["5"].inputs.frame_load_cap === 48 && links(g));
  check("DMAD off: the LoRA node is gone (the model feeds on), 24 steps; Spectrum wraps the model before each guider; the run name knows the components",
    !Object.values(g).some((n) => n.class_type === "LoraLoaderModelOnly") && g[OJ.NODES.plan].inputs.steps === 24
    && Object.values(g).some((n) => n.class_type === "SpectrumApplyMiniMaxH3") && Object.values(g).filter((n) => n.class_type === "BasicGuider").every((n) => g[n.inputs.model[0]].class_type === "SpectrumApplyMiniMaxH3")
    && g.model_run_name && /^_model[0-9a-f]+$/.test(g.model_run_name.inputs.string_b));
  b = OJ.build("simple", { ...base, settings: {}, start: 0, length: 3 });
  check("default model = no run-name suffix (OpenJutsu's resumable default runs); the DMAD LoRA wired", !b.graph.model_run_name && !b.graph.motion_run_name
    && b.graph["16"].inputs.lora_name === OJ.DEFAULT_MODEL.lora && b.graph["16"].inputs.strength_model === 1);
  let threw = ""; try { OJ.build("simple", { video: "/v.mp4", settings: {} }); } catch (e) { threw = e.message; }
  check("simple without a picture: refused in words", /character's picture first/.test(threw), threw);

  // ---- advanced / one pass per person
  b = OJ.build("advanced", { ...base, pictures: ["/p2.png", "/p3.png"], settings: { roles: ["the singer", "", "the drummer", "x"] } });
  g = b.graph;
  check("advanced, 3 characters: picture 4 + its shrink + its describer removed, roles by line (blank = by screen time), 3 uploads + the video",
    !byTitle(g, "Picture 4").length && !byTitle(g, "Describe picture 4").length && byTitle(g, "Picture 3").length
    && byTitle(g, "Swap Plan (roles, seed, size)")[0].inputs.roles === "the singer\nthe person with the second most screen time\nthe drummer"
    && b.uploads.length === 4 && b.uploads[3].path === "/p3.png" && links(g), byTitle(g, "Swap Plan (roles, seed, size)")[0].inputs.roles);
  b = OJ.build("advanced_maxq", { ...base, pictures: ["/p2.png", "/p3.png"], settings: {} });
  check("one pass per person: 2 characters at most (said), two passes in the graph", b.uploads.length === 3 && /takes 2 characters/.test(b.notes[0])
    && Object.values(b.graph).filter((n) => n.class_type === "SamplerCustomAdvanced").length === 2 && links(b.graph), b.notes);
  check("pictureCount: 1 + the extra pictures set, capped by the kind", OJ.pictureCount({ pictures: ["a", "", "c"] }, "advanced") === 3 && OJ.pictureCount({ pictures: ["a", "b", "c"] }, "advanced_maxq") === 2);

  // ---- object
  b = OJ.build("object", { ...base, settings: { object: { mode: "change", target: "hair, top", change_to: "pink hair", outline: false, biggest: true } } });
  g = b.graph;
  let plan = byTitle(g, "Object Swap Plan (what to change)")[0].inputs;
  check("object change: SAM told the targets, the plan carries mode / change_to / keep_outline off, one of each (max_people 2), the describer asks about both things",
    byTitle(g, "SAM: what to change")[0].inputs.text === "hair, top" && plan.mode === "change" && plan.change_to === "pink hair" && plan.keep_outline === false
    && byTitle(g, "Tracked area")[0].inputs.max_people === 2 && /Describe the hair and the top/.test(byTitle(g, "Describe picture 1")[0].inputs.prompt)
    && !("ref_videos.ref_video_0" in byTitle(g, "Reference Conditioning")[0].inputs) && links(g), plan);
  b = OJ.build("object", { video: "/v.mp4", seed: 1, settings: { object: { mode: "remove", target: "hat" } } });
  check("object remove: no picture at all (its loader, shrink, describer gone), no picture upload", !byTitle(b.graph, "Picture 1").length && b.uploads.length === 1 && links(b.graph));
  b = OJ.build("object", { ...base, settings: { object: { mode: "background", target: "person" } } });
  g = b.graph;
  check("object background: the grow mask flipped, the whole of it turns grey", byTitle(g, "Grow mask")[0].inputs.flip_input === true
    && JSON.stringify(byTitle(g, "Turn it grey (shape and movement only)")[0].inputs.mask) === JSON.stringify([OJ.nodeByTitle(g, "Grow mask"), 0]));
  threw = ""; try { OJ.build("object", { video: "/v.mp4", settings: { object: { mode: "change", target: "hat", change_to: "" } } }); } catch (e) { threw = e.message; }
  check("object change with neither words nor a picture: refused in words", /what it becomes/.test(threw), threw);

  // ---- mask / colours / faces
  b = OJ.build("mask", { video: "/v.mp4", settings: { hat: false, margin: "tight" }, start: 0, length: 2 });
  check("👁 mask: hats off -> the grow mask reads the people mask, tight = 20 px, the preview VideoCombine at the end",
    !b.graph["10"] && b.graph["9"].inputs.expand === 20 && b.final === "18" && b.graph["18"].class_type === "VHS_VideoCombine" && b.uploads.length === 1 && links(b.graph));
  b = OJ.build("color", { video: "/take.mp4", settings: { color: { detail: -0.35 } } });
  g = b.graph;
  let tone = JSON.parse(byTitle(g, "Tone mapper")[0].inputs.raw_settings);
  check("🎨 colours: detail contrast -0.35, the tone mapper's raw settings = OpenJutsu's H3 soft (Reinhard 0.2), the fixed video last",
    byTitle(g, "Detail contrast")[0].inputs.detail_contrast === -0.35 && tone.settings.mode === "Reinhard" && tone.settings.strength === 0.2 && tone.node_type === "color_fx_dctl_tone_mapper"
    && b.final === OJ.nodeByTitle(g, "Fixed video"));
  b = OJ.build("color", { video: "/take.mp4", settings: { color: { detail_on: false } } });
  check("🎨 colours with Detail off: that node gone, the tone mapper reads the video", !byTitle(b.graph, "Detail contrast").length && links(b.graph));
  threw = ""; try { OJ.build("face", { ...base, settings: {} }); } catch (e) { threw = e.message; }
  check("🙂 faces: refused until the licence is accepted, naming InsightFace non-commercial + YOLO AGPL-3.0", /non-commercial/.test(threw) && /AGPL-3\.0/.test(threw) && /I accept/.test(threw), threw);
  b = OJ.build("face", { ...base, settings: { face: { ok: true, style: "photo", chunk: 8 } } });
  g = b.graph;
  check("🙂 faces (photo): no blurred face to follow, chunks 8 s, the seed on the noise, the picture uploaded",
    !byTitle(g, "Blurred face (follow the mouth)").length && byTitle(g, "Face Fix Chunks")[0].inputs.chunk_seconds === 8 && byTitle(g, "Seed")[0].inputs.noise_seed === 42
    && b.uploads.length === 2 && links(g));

  // ---- the job
  const p = OJ.jobParams({ kind: "simple", settings: { resolution: "576p" }, seed: 7, video: "/v.mp4", start: 3, length: 5, frames: 120, picture: "/p1.png" });
  check("jobParams: mode openjutsu, the window for the worker to cut (start 3, 5 s) and the graph reading the cut from its start, the packs named",
    p.mode === "openjutsu" && p.kind === "simple" && p.cut.start === 3 && p.cut.length === 5 && p.graph["5"].inputs.skip_first_frames === 0
    && p.graph["5"].inputs.frame_load_cap === 120 && p.packs.H3OneClickSwapPlan === "comfyui-h3-oneclick-swap" && !p.packs.SAM3_VideoTrack && p.final === "67", p.cut);
  const pc = OJ.jobParams({ kind: "color", settings: {}, seed: 1, video: "/take.mp4", start: 3, length: 5 });
  check("jobParams (🎨 a take): the WHOLE take, no window", pc.cut.start === 0 && pc.cut.length === 0);
  check("jobParams: an error in words, never a half graph", /character's picture/.test(OJ.jobParams({ kind: "simple", video: "/v.mp4" }).error || ""));
  check("summary: the kind, the window, size, motion, steps (DMAD)", /^OpenJutsu simple swap · 5\.00s from 3\.00s · 576p · motion 512px · 6 steps \(DMAD\) · 6s clips$/.test(OJ.summary(p)), OJ.summary(p));
  check("CEILING: a minute on H3's grid (OpenJutsu chains its clips itself)", OJ.CEILING === 1433 && (OJ.CEILING - 5) % 17 === 0);

  // ---- the dialog record + the engine list
  const SS = require("../lib/swapSession");
  const RS = require("../lib/rippleSwap");
  const st = SS.safe({ engine: "openjutsu", oj: { mode: "advanced", roles: ["a"] }, results: [{ id: "r1", oj: "color" }, { id: "r2", oj: "nope" }] });
  check("swap record: engine openjutsu kept, st.oj sanitised, a take's kind kept (junk dropped), the take names (_color / _mask / _face)",
    st.engine === "openjutsu" && st.oj.mode === "advanced" && st.oj.roles[0] === "a" && st.results[0].oj === "color" && st.results[1].oj === undefined
    && SS.resultName("v.mp4", 2, 1, 4, false, "", "color") === "v_swap_02_1.00-5.00s_color.mp4" && SS.resultName("v.mp4", 2, 1, 4, false, "") === "v_swap_02_1.00-5.00s.mp4"
    && SS.blank().oj.mode === "simple", st.results);
  check("engines: OpenJutsu listed, not a first-frame engine", RS.engineOf("openjutsu") === "openjutsu" && RS.ENGINES.some((e) => e.id === "openjutsu") && !RS.usesFirstFrame("openjutsu") && !RS.isViggle("openjutsu"));
  const AR = SS.addResult(SS.blank(), { seg: "s", start: 0, dur: 5, frames: 120, seed: 1, job: "j", engine: "openjutsu", oj: "mask" });
  check("addResult keeps the take's kind", AR.result.oj === "mask" && AR.result.engine === "openjutsu");

  // ---- routes + the page (source)
  const R = require("../routes/openjutsu");
  const m = R.mergeSettings({ object: { mode: "change", target: "hat" }, roles: ["a", "b"], pictures: ["x.png"] }, { object: { mode: "remove" }, roles: [null, "B"], pictures: ["evil.png"] });
  check("routes mergeSettings: nested parts merge, roles by index (null = keep), pictures only through /picture",
    m.object.mode === "remove" && m.object.target === "hat" && m.roles[0] === "a" && m.roles[1] === "B" && m.pictures[0] === "x.png", m);
  const sd = src("routes/swapdlg.js");
  check("routes/swapdlg.js: the OpenJutsu branch in queue(), its ceiling, a mask check never kept, ⏫ refused, the bar's routes mounted (never server.js)",
    /=== "openjutsu"\) return queueOpenjutsu/.test(sd) && /ceilFor/.test(sd) && /a mask check is a preview/.test(sd) && /require\("\.\/openjutsu"\)\.mount\(app/.test(sd)
    && !/openjutsu/i.test(src("misc/server.js")));
  const page = src("static/swapdlg.js"), oj = src("static/ojswap.js"), idx = src("static/index.html");
  check("the page: Engine ▸ OpenJutsu, the bar painted after every update, static/ojswap.js loaded after swapdlg.js",
    /<option value="openjutsu">OpenJutsu<\/option>/.test(page) && /H3OjSwap\.paint\(cur, st\)/.test(page)
    && idx.indexOf("/static/ojswap.js") > idx.indexOf("/static/swapdlg.js") && /window\.H3OjSwap = /.test(oj) && /\/api\/openjutsu\/fix/.test(oj) && /I accept/.test(oj));
  check("core: mode openjutsu runs misc/openjutsu_worker.py", /openjutsu: "openjutsu_worker\.py"/.test(src("lib/core.js")) && fs.existsSync(path.join(ROOT, "misc", "openjutsu_worker.py")));

  // ---- the add-on
  const A = require("../lib/openjutsuAddon");
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "oj949-"));
  const models = path.join(T, "models"), nodes = path.join(T, "custom_nodes");
  for (const d of ["diffusion_models", "text_encoders", "vae", "loras", "checkpoints"]) fs.mkdirSync(path.join(models, d), { recursive: true });
  fs.mkdirSync(nodes, { recursive: true });
  const pl = { ok: true, models, customNodes: nodes, python: "python3" };
  // bitGen's usual H3 files under its own names + an OLD Context Loop
  for (const [d, f] of [["diffusion_models", "minimax_h3_ref2va_pruned_int8_convrot.safetensors"], ["text_encoders", "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"],
                        ["vae", "minimax_h3_video_vae_fp16.safetensors"], ["vae", "minimax_h3_audio_vae_fp32.safetensors"], ["text_encoders", "qwen3vl_8b_int8_convrot.safetensors"]])
    fs.writeFileSync(path.join(models, d, f), "x");
  fs.mkdirSync(path.join(nodes, "ComfyUI-MiniMaxH3-Contex-Loop", ".git"), { recursive: true });
  fs.writeFileSync(path.join(nodes, "ComfyUI-MiniMaxH3-Contex-Loop", "pyproject.toml"), '[project]\nname = "x"\nversion = "0.7.2"\n');
  let s = A.status(pl);
  const it = (id) => s.items.find((x) => x.id === id);
  check("status: bitGen's own H3 files count (any ref2va / text encoder / VAEs / Qwen3-VL 8B); DMAD + SAM missing; an old Context Loop said",
    it("h3").present && it("te").present && it("vae").present && it("describer").present && !it("dmad").present && !it("sam").present && !s.installed
    && s.contexloop.old && s.contexloop.version === "0.7.2" && /0\.7\.2 is older than the 0\.7\.3/.test(s.note), s);
  check("older(): dotted versions", A.older("0.7.2", "0.7.3") && !A.older("0.7.3", "0.7.3") && !A.older("0.10.0", "0.7.3") && !A.older("", "0.7.3"));
  check("the items: Fix faces + Spectrum opt-in (unticked), the rest needed; Fix faces says the licences",
    !it("face").dflt && !it("face").need && !it("spectrum").need && it("packs").need && it("dmad").need && /non-commercial/.test(it("face").for) && /AGPL-3\.0/.test(it("face").for));
  const did = { packs: [], pulls: 0, dl: [] };
  const fakes = { place: pl,
    packInstall: async (pk) => { did.packs.push(pk.id); fs.mkdirSync(path.join(nodes, pk.folder), { recursive: true }); return { ok: true }; },
    pull: async (dir) => { did.pulls++; fs.writeFileSync(path.join(dir, "pyproject.toml"), 'version = "0.7.3"\n'); return { ok: true }; },
    download: async (mm) => { did.dl.push(mm.id); const d = require("../lib/setupModels").destPath(mm, { comfyModels: models, app: ROOT }); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, "x"); return { ok: true }; } };
  const lines = [];
  let r = await A.install((l) => lines.push(l), [], fakes);
  check("install (nothing ticked): the six missing packs, Context Loop updated to 0.7.3, only DMAD + SAM 3.1 downloaded (bitGen's H3 files used), no Fix faces / Spectrum",
    r.ok && did.packs.sort().join() === ["detailcontrast", "fantasticpb", "kjnodes", "oneclick", "orionfx", "vhs"].join() && did.pulls === 1
    && did.dl.sort().join() === "oj_dmad,oj_sam31" && lines.some((l) => /restart ComfyUI once/.test(l)), { r, did });
  s = A.status(pl);
  check("...then ready", s.installed && !s.contexloop.old && /ready/.test(s.note), s.note);
  did.packs = []; did.dl = []; lines.length = 0;
  r = await A.install((l) => lines.push(l), ["face"], fakes);
  check("install with 🙂 Fix faces ticked: the licence warned in the log, Impact + H3-FaceRefine, the YOLO face / person detectors + SAM ViT-B",
    r.ok && did.packs.sort().join() === "h3facerefine,impact" && did.dl.sort().join() === "face_yolo,oj_person_seg,oj_sam_vitb"
    && lines.some((l) => /non-commercial/.test(l)), { did, lines: lines.slice(0, 3) });
  lines.length = 0;
  r = await A.remove((l) => lines.push(l), pl);
  check("remove: OpenJutsu's own files only - H3's files stay (the rest of bitGen uses them)", r.ok
    && !fs.existsSync(path.join(models, "loras", "minimax_h3_DMAD_4step_full_lora_avg_rank_39_bf16.safetensors"))
    && fs.existsSync(path.join(models, "diffusion_models", "minimax_h3_ref2va_pruned_int8_convrot.safetensors")) && lines.some((l) => /H3's model/.test(l)));
  fs.rmSync(T, { recursive: true, force: true });

  // ---- the lists
  const NP = JSON.parse(src("lib/nodePacks.json")).packs, ids = NP.map((x) => x.id);
  check("nodePacks: Oneclick Swap, PromptBuilder, Detail Contrast, Orion4D FX added (a pod image gets them); H3-FaceRefine NOT (opt-in only)",
    ["oneclick", "fantasticpb", "detailcontrast", "orionfx"].every((x) => ids.includes(x)) && !ids.includes("h3facerefine") && ids.includes("contexloop"));
  const MC = JSON.parse(src("lib/modelCatalog.json"));
  const mc = (id) => MC.models.find((x) => x.id === id) || {};
  check("modelCatalog: group openjutsu - DMAD (Kijai), SAM 3.1 (Comfy-Org, checkpoints), the int8 video VAE, the INT4 text encoder, the face files",
    MC.groups.some((x) => x.id === "openjutsu") && mc("oj_dmad").repo === "Kijai/MiniMax-H3-experimental" && mc("oj_dmad").dest === "comfy/loras"
    && mc("oj_sam31").dest === "comfy/checkpoints" && mc("oj_vvae").size === 3171670912 && mc("oj_te_int4").repo === "Merserk/MiniMax-H3-INT4-ConvRot"
    && mc("oj_person_seg").dest === "comfy/ultralytics/segm" && mc("oj_sam_vitb").dest === "comfy/sams");
  check("Settings ▸ Add-ons lists OpenJutsu swap; NOTICE + credits name OpenJutsu (MIT) and the Fix faces licences",
    /id: "openjutsu", label: "OpenJutsu swap/.test(src("lib/addons.js")) && /D3voz\/openjutsu/.test(src("misc/NOTICE.md")) && /NON-COMMERCIAL/.test(src("misc/NOTICE.md"))
    && /"name": "OpenJutsu"/.test(src("lib/credits.json")));

  console.log(`\nRESULT: ${P} passed, ${F} failed`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed", e && e.stack); process.exit(1); });
