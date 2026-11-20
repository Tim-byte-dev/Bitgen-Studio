#!/usr/bin/env node
/* bitGen Studio — 2.890.0 units: PAN 2 (MBZUAI's world model) as a video style. lib/pan2.js: the caption PAN 2 needs (its own
 * rewriter policy to the LLM, checked like their prompt_tools.py, asked again with the problems, wrapped by bitGen when the LLM
 * fails; a caption typed in used as it is; the first picture described for the writer), the fixed negative with its times,
 * 4n+1 frames at 24 fps, 32-px sizes, the job params; the add-on (int8 / bf16 sets, the shared text encoder + VAE once), the
 * catalogue, the architecture, the starter style, the model family, the routes and the page's dispatch.
 * Tim (verbatim): "can you add this to our video models https://huggingface.co/Comfy-Org/PAN2" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const P = require("../lib/pan2");

(async () => {
  const good10 = JSON.stringify({ video_style: "Realistic, one continuous shot.", lighting: "Soft morning light.", perspective_view: "Eye level, wide.",
    subjects_lifecycle: [{ subject_id: "<|Subject1|>", display_name: "Dog", subject_attribute: "A brown terrier." }],
    init_frame_visual_description: "A brown terrier stands on wet sand facing the sea.",
    events: [{ event_index: 0, time_range_sec: "0 to 6", event_description: "The dog runs along the waterline.", camera_motion: [{ time_range_sec: "0 to 6", camera_motion: ["track_right"] }],
      contained_actions: [{ time_range_sec: "0 to 6", action: "<|Subject1|> runs to the right." }] },
    { event_index: 1, time_range_sec: "6 to 10", event_description: "It stops and shakes off water.", camera_motion: [{ time_range_sec: "6 to 10", camera_motion: ["static"] }],
      contained_actions: [{ time_range_sec: "6.5 to 9", action: "<|Subject1|> shakes its coat." }] }],
    quality: { video_quality: "Sharp.", text_logos_overlays: null, artifacts: null } });

  // the policy + negative are PAN 2's own, unchanged
  const neg0 = src("lib/pan2/generic_negative.txt");
  check("PAN 2's rewriter policy and fixed negative are vendored unchanged (ifm-ai/PAN2, Apache-2.0; the negative's sha256 their prompt_tools.py pins)",
    /# Video prompt rewriter/.test(src("lib/pan2/system_prompt.md")) && require("crypto").createHash("sha256").update(fs.readFileSync(path.join(ROOT, "lib/pan2/generic_negative.txt"))).digest("hex") === "280152759e5488f547da6ac13f6a72ebe05fdf959371a6571c7e9782d466c501"
    && (neg0.match(/\{duration_sec\}/g) || []).length === 3 && /PAN 2/.test(src("misc/NOTICE.md")) && /ifm-ai\/PAN2/.test(src("misc/NOTICE.md")));

  // frames, sizes, seconds
  check("frames: 4n+1 at 24 fps - 10 s = 241, 20 s = 481 (the most), 1 s = 25, 13 s = 313", P.framesFor(10) === 241 && P.framesFor(20) === 481 && P.framesFor(60) === 481
    && P.framesFor(1) === 25 && P.framesFor(13) === 313 && P.framesFor() === 241 && P.secondsOf(241) === 10 && P.secondsOf(313) === 13);
  check("size: 32-px steps, 1248 x 704 when not given", JSON.stringify(P.size()) === '{"width":1248,"height":704}' && JSON.stringify(P.size(1280, 720)) === '{"width":1280,"height":704}'
    && JSON.stringify(P.size(9999, 10)) === '{"width":2048,"height":256}');

  // parse + check
  const c = P.parseCaption(good10);
  check("parseCaption: a caption string, {refined_prompt: string} and {refined_prompt: object} all give the object; plain words give null",
    c && c.events.length === 2 && P.parseCaption(JSON.stringify({ refined_prompt: good10 })).events.length === 2
    && P.parseCaption({ refined_prompt: JSON.parse(good10) }).events.length === 2 && P.parseCaption("a dog on a beach") === null
    && P.parseCaption("```json\n" + JSON.stringify({ refined_prompt: good10 }) + "\n```").lighting === "Soft morning light.");
  check("check: a good caption passes at 10 s", P.check(c, 10).length === 0, P.check(c, 10));
  const probs = (mut) => { const o = JSON.parse(good10); mut(o); return P.check(P.ordered(o), 10).join(" | "); };
  check("check: events not reaching the duration, a gap, a bad camera tag, static + movement, an action without a declared ID, IDs in the first frame",
    /must end at 10/.test(probs((o) => { o.events[1].time_range_sec = "6 to 9"; o.events[1].camera_motion[0].time_range_sec = "6 to 9"; o.events[1].contained_actions[0].time_range_sec = "6.5 to 8"; }))
    && /must start at 6/.test(probs((o) => { o.events[1].time_range_sec = "7 to 10"; o.events[1].camera_motion[0].time_range_sec = "7 to 10"; o.events[1].contained_actions[0].time_range_sec = "7 to 9"; }))
    && /tags must be from/.test(probs((o) => { o.events[0].camera_motion[0].camera_motion = ["fly_around"]; }))
    && /never combine static/.test(probs((o) => { o.events[1].camera_motion[0].camera_motion = ["static", "pan_left"]; }))
    && /declared subject ID/.test(probs((o) => { o.events[0].contained_actions[0].action = "<|Subject2|> runs."; }))
    && /must not contain subject IDs/.test(probs((o) => { o.init_frame_visual_description = "<|Subject1|> stands."; }))
    && /exactly these keys/.test(P.check(Object.assign({}, c, { extra: 1 }), 10).join()));
  check("ordered: the seven keys in PAN 2's order, artifacts null", Object.keys(P.ordered({ events: [], quality: { video_quality: "q", artifacts: "x" }, lighting: "l", video_style: "v", perspective_view: "p", subjects_lifecycle: [], init_frame_visual_description: "i" })).join() === P.KEYS.join()
    && P.ordered({ quality: { video_quality: "q", artifacts: "x" } }).quality.artifacts === null);
  check("wrap: bitGen's one-event caption passes the checks, H3 markup made plain", P.check(P.wrap("A <Subject 1> dog <d>woof</d> runs", 13), 13).length === 0
    && P.wrap("A <Subject 1> dog <d>woof</d> runs", 13).events[0].event_description === "A subject 1 dog \"woof\" runs");

  // the negative
  const n10 = JSON.parse(P.negative(10)), n13x = JSON.parse(P.negative(13, "cartoon look"));
  check("negative: PAN 2's fixed one, its three time ranges 0 to the duration; the ⊖ docker's words added to its video_style; a whole negative caption used as it is",
    JSON.stringify(n10).split("\"0 to 10\"").length === 4 && !/duration_sec/.test(JSON.stringify(n10)) && Object.keys(n10).join() === P.KEYS.join()
    && /cartoon look$/.test(n13x.video_style) && JSON.stringify(n13x).split("\"0 to 13\"").length === 4
    && JSON.parse(P.negative(10, good10)).lighting === "Soft morning light.");

  // caption(): the LLM path
  let calls = [];
  P.setComplete(async (o) => { calls.push(o.messages); return { ok: true, text: "<think>planning</think>" + JSON.stringify({ refined_prompt: good10 }) }; });
  let r = await P.caption({ prompt: "a dog runs on a beach", seconds: 10 });
  check("caption: the LLM gets PAN 2's whole policy as the system prompt and {original_prompt, duration_sec}; its answer (thinking stripped) checked and used",
    r.how === "llm" && JSON.parse(r.caption).events.length === 2 && calls.length === 1 && calls[0][0].role === "system" && /Positive caption schema/.test(calls[0][0].content)
    && JSON.parse(calls[0][1].content).duration_sec === 10 && JSON.parse(calls[0][1].content).original_prompt === "a dog runs on a beach", r);
  calls = []; let n = 0;
  P.setComplete(async (o) => { calls.push(o.messages.slice()); n++; return { ok: true, text: n === 1 ? JSON.stringify({ refined_prompt: good10.replace('"6 to 10"', '"6 to 9"') }) : JSON.stringify({ refined_prompt: good10 }) }; });
  r = await P.caption({ prompt: "a dog", seconds: 10 });
  check("caption: a caption that fails the checks is sent back once with the problems, the second one used", r.how === "llm" && calls.length === 2
    && /problems/.test(calls[1][calls[1].length - 1].content) && /second try/.test(r.notes.join()), { r, n: calls.length });
  P.setComplete(async () => ({ ok: true, text: "Sure! Here is a lovely video idea." }));
  r = await P.caption({ prompt: "a dog runs", seconds: 13 });
  check("caption: failing twice = bitGen's wrapped caption at the right length, said", r.how === "wrapped" && P.check(JSON.parse(r.caption), 13).length === 0 && /failed the checks twice/.test(r.notes.join()), r);
  P.setComplete(async () => ({ ok: false, error: "no LLM running" }));
  r = await P.caption({ prompt: "a dog runs", seconds: 10 });
  check("caption: no LLM = wrapped, the reason said", r.how === "wrapped" && /could not write the caption: no LLM running/.test(r.notes.join()), r);
  r = await P.caption({ prompt: good10, seconds: 10 });
  check("caption: a caption typed in is used as it is (no LLM call)", r.how === "given" && JSON.parse(r.caption).lighting === "Soft morning light.");
  r = await P.caption({ prompt: good10, seconds: 12 });
  check("caption: a typed caption at the wrong length is still used, the problem said", r.how === "given" && /problem/.test(r.notes.join()));
  const img = path.join(os.tmpdir(), "pan2-890.png"); fs.writeFileSync(img, Buffer.from("89504e470d0a1a0a", "hex"));
  let seenFiles = null;
  P.setDescribe(async (files) => { seenFiles = files; return ["A woman in a red coat stands at a bus stop, holding an umbrella."]; });
  calls = []; P.setComplete(async (o) => { calls.push(o.messages); return { ok: true, text: JSON.stringify({ refined_prompt: good10 }) }; });
  r = await P.caption({ prompt: "she walks away", seconds: 10, image: img });
  check("caption: image to video - the vision model describes the first picture, the writer is told what it saw", seenFiles && seenFiles[0].mimetype === "image/png"
    && /red coat/.test(calls[0][1].content) && /init_frame_visual_description/.test(calls[0][1].content) && /described the first picture/.test(r.notes.join()));
  let threw = false; try { await P.caption({ prompt: "   " }); } catch (e) { threw = e.status === 400; }
  check("caption: no words = refused", threw);

  // params
  const st = { id: "s1", name: "PAN 2", kind: "video", arch: "pan2", phases: [{ model: "", steps: null, cfg: null }], te: [""], vae: "", loras: [] };
  const p1 = P.params({ style: st, caption: good10, negative: "{}", seconds: 10, width: 1280, height: 720 });
  check("params: mode pan2, text to video, 241 frames / 10 s, 1280x704, PAN 2's 50 steps / cfg 2.5 / shift 9, random seed",
    p1.mode === "pan2" && p1.pan2_mode === "t2v" && p1.frames === 241 && p1.seconds === 10 && p1.width === 1280 && p1.height === 704
    && p1.steps === 50 && p1.cfg === 2.5 && p1.shift === 9 && p1.seed === -1 && p1.video_style_name === "PAN 2", p1);
  const p2 = P.params({ style: Object.assign({}, st, { phases: [{ model: "pan2_bf16.safetensors", steps: 40, cfg: 3 }] }), caption: good10, image: img, seconds: 30, steps: 0, seed: 7 });
  check("params: a first picture = image to video; 30 s capped at 20 (481 frames); the style's model / steps / cfg; the seed kept",
    p2.pan2_mode === "i2v" && p2.image === img && p2.frames === 481 && p2.seconds === 20 && p2.model === "pan2_bf16.safetensors" && p2.steps === 40 && p2.cfg === 3 && p2.seed === 7, p2);
  check("params: not a PAN 2 style / a picture that is gone are refused", /not a PAN 2/.test(P.params({ style: { kind: "video", arch: "wan22" } }).error)
    && /gone/.test(P.params({ style: st, image: "/nope/x.png" }).error) && /not a picture/.test(P.params({ style: st, image: "/tmp/a.mp4" }).error));
  check("summary: the line for the queue", /PAN 2 from text · 10s \(241 frames at 24 fps\) · 1280x704 · 50 steps, cfg 2.5, shift 9/.test(P.summary(p1)), P.summary(p1));

  // ComfyUI's support
  const fake = (types) => async () => ({ ok: true, json: async () => ({ CLIPLoader: { input: { required: { type: [types] } } } }) });
  check("comfySupport: CLIPLoader type pan2 = yes (the v0.46.0 release), without it = update ComfyUI, nothing answering = offline",
    (await P.comfySupport({ url: "http://x", fetch: fake(["wan", "pan2"]) })).nodes === true
    && (await P.comfySupport({ url: "http://x", fetch: fake(["wan"]) })).nodes === false
    && (await P.comfySupport({ url: "http://x", fetch: async () => ({ ok: true, json: async () => ({ CLIPLoader: { input: { required: { type: { type: "COMBO", options: ["pan2"] } } } } }) }) })).nodes === true
    && (await P.comfySupport({ url: "http://x", fetch: async () => { throw new Error("down"); } })).online === false);

  // the add-on + catalogue
  const M = require("../lib/setupModels"), AD = require("../lib/pan2Addon");
  const ids = ["pan2_int8", "pan2_bf16", "pan2_te", "pan2_vae"];
  check("catalogue: the four Comfy-Org/PAN2 files in group pan2 into diffusion_models / text_encoders / vae",
    ids.every((i) => M.byId(i) && M.byId(i).repo === "Comfy-Org/PAN2") && M.byId("pan2_int8").dest === "comfy/diffusion_models" && M.byId("pan2_te").dest === "comfy/text_encoders"
    && M.byId("pan2_vae").file === "vae/wan2.2_vae.safetensors" && JSON.parse(src("lib/modelCatalog.json")).groups.some((g) => g.id === "pan2"));
  const mroot = fs.mkdtempSync(path.join(os.tmpdir(), "pan2m-"));
  const got = [];
  const res = await AD.install(() => {}, ["int8", "bf16"], { place: { ok: true, models: mroot }, download: async (m) => { got.push(m.id); return { ok: true }; }, comfy: async () => ({ online: true, nodes: false }) });
  check("add-on: int8 + bf16 download each file once (the text encoder + VAE shared), a ComfyUI without PAN 2 warned",
    res.ok && got.join() === "pan2_int8,pan2_te,pan2_vae,pan2_bf16", got);
  const logs = [];
  await AD.install((t) => logs.push(t), [], { place: { ok: true, models: mroot }, download: async () => ({ ok: true }), comfy: async () => ({ online: true, nodes: false }) });
  check("add-on: nothing ticked = the int8 set; the warning names the update", /does not know PAN 2/.test(logs.join("\n")) && /0\.46\.0/.test(logs.join("\n")));
  check("add-on: status before = not installed; Settings ▸ Add-ons lists PAN 2", AD.status({ ok: true, models: mroot }).installed === false
    && require("../lib/addons").LIST.some((a) => a.id === "pan2" && /Add-ons|PAN 2/.test(a.label)));
  fs.rmSync(mroot, { recursive: true, force: true });

  // arch, style, family, wiring
  const S = require("../lib/styles"), MC = require("../lib/modelCards"), FF = require("../lib/famFilter");
  const va = JSON.parse(src("lib/videoArch.json")).archs.find((a) => a.id === "pan2");
  check("videoArch: pan2 - text / F/L, 50 steps cfg 2.5 1248x704, the Qwen3.5 9B + Wan 2.2 VAE hints", va && va.modes.join() === "t2va,fl2va" && va.defaults.steps === 50
    && va.defaults.cfg === 2.5 && va.defaults.width === 1248 && /qwen3\.5_9b/.test(va.te[0].hint) && va.vae.hint === "wan2.2_vae.safetensors");
  const stn = S.normalize(S.STARTER_STYLES.find((x) => x.name === "PAN 2"), null);
  check("starter style \"PAN 2\" (video, arch pan2) is seeded; isPan2Style knows it", stn.kind === "video" && stn.arch === "pan2" && P.isPan2Style(stn) && !P.isPan2Style({ kind: "video", arch: "wan22" }));
  check("model family pan2: its files by name (not the Wan 2.2 VAE, not japan2x); Basic Settings' lists follow it", MC.nameFamily("pan2_int8_convrot.safetensors") === "pan2"
    && MC.nameFamily("models/PAN2/pan2_bf16.safetensors") === "pan2" && MC.nameFamily("wan2.2_vae.safetensors") === "wan" && MC.nameFamily("japan2x.safetensors") !== "pan2"
    && FF.rule(stn, "video").families.join() === "pan2" && MC.FAMILIES.pan2.label === "PAN 2");
  const RI = src("routes/index.js"), IX = src("static/index.html"), RP = src("routes/pan2.js");
  check("wired: routes/pan2.js mounted from routes/index.js (nothing in misc/server.js); /api/generate turns a PAN 2 style away; GET / POST /api/pan2 + /api/pan2/caption",
    /require\("\.\/pan2"\)\.mount\(app\)/.test(RI) && /is a PAN 2 style/.test(RI) && !/pan2/i.test(src("misc/server.js"))
    && /app\.get\("\/api\/pan2"/.test(RP) && /app\.post\("\/api\/pan2"/.test(RP) && /app\.post\("\/api\/pan2\/caption"/.test(RP));
  check("page: static/pan2gen.js loaded; Generate sends a PAN 2 style to H3Pan2Gen.submit; the Download / Cancel box knows pan2; RunPod Serverless hides it with a reason",
    /<script src="\/static\/pan2gen\.js"><\/script>/.test(IX) && /H3Pan2Gen\.style\(\) \? await H3Pan2Gen\.submit\(text\)/.test(IX)
    && /pan2: \{ name: "PAN 2"/.test(src("static/needinstall.js")) && /pan2: "the PAN 2 worker/.test(src("lib/rpslStyles.js")));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
