#!/usr/bin/env node
/* bitGen Studio — 2.872.0 over the running app (H3_URL) with a stand-in ComfyUI: H3 Long Video's GET (status + what
 * ComfyUI has), a prompt docker render queued as a graph job (the anchor + shots, the first frame and two references
 * uploaded, the character memory, the size -> aspect + megapixels, the 2K pass last), a ComfyUI without the node pack =
 * 409 needs h3long, no prompt / ComfyUI down refused in words. The queued jobs are cancelled. */
"use strict";
const http = require("http");
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const get = (u) => fetch(new URL(u, URL_)).then(async (r) => ({ http: r.status, ...(await r.json()) }));
const post = (u, body) => fetch(new URL(u, URL_), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ http: r.status, ...(await r.json()) }));
const form = (u, fd) => fetch(new URL(u, URL_), { method: "POST", body: fd }).then(async (r) => ({ http: r.status, ...(await r.json()) }));
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=", "base64");
const MODEL = "minimax_h3_fused_refdelta_r1024_turbo8_mystic07_int8_convrot.safetensors";
let mode = "full";
function info() {
  const o = {
    UNETLoader: { input: { required: { unet_name: [["minimax\\" + MODEL, "other.safetensors"]], weight_dtype: [["default", "fp8_e4m3fn"]] } } },
    CLIPLoader: { input: { required: { clip_name: [["qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"]], type: [["minimax"]] } } },
    VAELoader: { input: { required: { vae_name: [["minimax_h3_video_vae_fp16.safetensors", "minimax_h3_audio_vae_fp32.safetensors"]] } } },
    LoadImage: { input: { required: { image: [["x.png"]] } } },
    CreateVideo: { input: { required: { images: ["IMAGE"], fps: ["FLOAT", { default: 30 }] }, optional: { audio: ["AUDIO"] } } },
    SaveVideo: { input: { required: { video: ["VIDEO"], filename_prefix: ["STRING", { default: "video/ComfyUI" }] } } },
    H3SLAAttention: { input: { required: { model: ["MODEL"], sparsity_ratio: ["FLOAT", { default: 0.5 }] } } },
    RTXVideoSuperResolution: { input: { required: { images: ["IMAGE"], resize_type: ["COMFY_DYNAMICCOMBO_V3", { options: [{ key: "scale by multiplier", inputs: { required: { scale: ["FLOAT", { default: 4 }] } } }] }], quality: [["HIGH", "ULTRA"]] } } },
  };
  if (mode !== "nopack") o.H3LongVideos = { input: { required: { model: ["MODEL"], clip: ["CLIP"], vae: ["VAE"], audio_vae: ["VAE"], prompt: ["STRING", { multiline: true }],
    resolution: [["16:9", "9:16", "1:1"]], megapixels: ["FLOAT", { default: 0.5 }], shot_seconds: ["FLOAT", { default: 15 }], seed: ["INT", { default: 0 }],
    shot_length: [["from the beat", "fixed"]], character_memory: ["STRING", { multiline: true }] },
    optional: { first_frame: ["IMAGE"], ref_image_1: ["IMAGE"], ref_image_2: ["IMAGE"], ref_image_3: ["IMAGE"], ref_image_4: ["IMAGE"] } } };
  return o;
}
const stand = http.createServer((req, res) => {
  req.resume(); req.on("end", () => {
    const send = (code, o) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url === "/system_stats") return send(200, {});
    if (req.url === "/object_info") return mode === "down" ? send(500, {}) : send(200, info());
    send(404, {});
  });
});
(async () => {
  await new Promise((r) => stand.listen(0, "127.0.0.1", r));
  const port = stand.address().port;
  const cfg0 = await get("/api/config");
  const eng0 = JSON.parse(JSON.stringify(cfg0.engine || {}));
  const jobs = [];
  try {
    await post("/api/config", { engine: { backend: "comfy", comfy: { url: "http://127.0.0.1:" + port } } });
    const st = await get("/api/h3long");
    check("GET /api/h3long: the add-on's items (the pack, SLA, RTX, Easy-Use, the fused model, the H3 files) + what ComfyUI has",
      st.http === 200 && st.items.map((i) => i.id).join() === "pack,sla,rtx,easy,dit,h3" && st.comfy.online === true && st.comfy.ok === true && st.shot_max === 15, st);
    const fd = new FormData();
    fd.append("prompt", "A sunny market in ancient Olympia, photoreal.\n\nAnn smiles and says: \"Hello.\"\n\nAnn points at the temple.\n\nAnn waves goodbye.");
    fd.append("memory", "Ann: <Picture 1>, 26, red hair");
    fd.append("seconds", "40"); fd.append("width", "1280"); fd.append("height", "720"); fd.append("seed", "42"); fd.append("upscale2k", "1");
    fd.append("first", new Blob([PNG], { type: "image/png" }), "ann.png");
    fd.append("refs", new Blob([PNG], { type: "image/png" }), "r1.png");
    fd.append("refs", new Blob([PNG], { type: "image/png" }), "r2.png");
    const t = await form("/api/h3long", fd);
    if (t.id) jobs.push(t.id);
    const P = t.params || {}, G = P.graph || {};
    const by = (c) => Object.entries(G).filter(([, v]) => v.class_type === c);
    const main = (by("H3LongVideos")[0] || [])[1] || { inputs: {} };
    check("POST /api/h3long: a graph job - 3 shots of 13.33 s, fixed, the prompt kept as written, seed 42",
      t.http === 200 && P.mode === "graph" && t.shots === 3 && t.shot_seconds === 13.33 && main.inputs.shot_length === "fixed"
      && main.inputs.shot_seconds === 13.33 && main.inputs.seed === 42 && /^A sunny market[\s\S]*\n\nAnn waves goodbye\.$/.test(main.inputs.prompt), { t: Object.keys(t), m: main.inputs });
    check("...1280x720 -> 16:9 at 0.92 MP; the memory; ComfyUI's own model name (sub-folder kept); SLA in front",
      main.inputs.resolution === "16:9" && main.inputs.megapixels === 0.92 && main.inputs.character_memory === "Ann: <Picture 1>, 26, red hair"
      && by("UNETLoader")[0][1].inputs.unet_name === "minimax\\" + MODEL && by("H3SLAAttention").length === 1, main.inputs);
    check("...the first frame + two references wired and uploaded by the worker",
      Array.isArray(main.inputs.first_frame) && Array.isArray(main.inputs.ref_image_2) && !main.inputs.ref_image_3
      && (P.graph_uploads || []).length === 3 && /h3long-first-/.test(P.graph_uploads[0].path), P.graph_uploads);
    const saves = by("SaveVideo");
    check("...the 2K pass (RTX x2 ULTRA) saved last - the job's video",
      saves.length === 2 && saves[1][1].inputs.filename_prefix.startsWith("2K_Video/") && +saves[1][0] > +saves[0][0]
      && by("RTXVideoSuperResolution")[0][1].inputs["resize_type.scale"] === 2, saves);
    const none = await form("/api/h3long", (() => { const f = new FormData(); f.append("prompt", "  "); return f; })());
    check("no prompt -> 400 in words", none.http === 400 && /first paragraph/.test(none.error), none);
    mode = "nopack";
    const np = await form("/api/h3long", (() => { const f = new FormData(); f.append("prompt", "x. y."); return f; })());
    check("no H3-LongVideos node -> 409 needs h3long, the pack named", np.http === 409 && np.needs === "h3long" && /H3-LongVideos/.test(np.error), np);
    mode = "down";
    const dn = await form("/api/h3long", (() => { const f = new FormData(); f.append("prompt", "x. y."); return f; })());
    check("ComfyUI not answering -> 503 in words", dn.http === 503 && /ComfyUI/.test(dn.error), dn);
    const sty = await get("/api/styles?kind=video");
    check("the video styles list H3 Long Video (40 s), not the 30 s one",
      (sty.styles || []).some((s) => s.name === "H3 Long Video (40 s)" && s.arch === "h3-long") && !(sty.styles || []).some((s) => /Long \(30 s\)/.test(s.name)), (sty.styles || []).map((s) => s.name));
  } finally {
    for (const id of jobs) { try { await post(`/api/jobs/${id}/cancel`, {}); } catch (e) { /* gone */ } }
    await post("/api/config", { engine: eng0 });
    stand.close();
  }
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
