#!/usr/bin/env node
/* bitGen Studio — 2.870.0 over the running app (H3_URL) with a stand-in ComfyUI: the sheet designer's catalog, the layout
 * preview from the pack's preview route, a take queued as a graph job (the designer's settings, the model names from
 * ComfyUI's own lists, the part picture wired where the pack numbers it, both pictures uploaded), ↻ Regenerate from the
 * names the server kept, a ComfyUI that lacks a file or the pack = 409 in words, the wrong engine / a name that climbs out /
 * no picture refused. The stand-in answers /object_info and the preview; the queued jobs are cancelled. */
"use strict";
const http = require("http");
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const get = (u) => fetch(new URL(u, URL_)).then(async (r) => ({ http: r.status, ...(await r.json()) }));
const post = (u, body) => fetch(new URL(u, URL_), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ http: r.status, ...(await r.json()) }));
const form = (u, fd) => fetch(new URL(u, URL_), { method: "POST", body: fd }).then(async (r) => ({ http: r.status, ...(await r.json()) }));
// an 8x8 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=", "base64");
const LIST = ["minimax\\minimax_h3_image_pruned_int8_convrot.safetensors", "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", "minimax_h3_image_vae_fp16.safetensors", "other.safetensors"];
let mode = "full", previews = [];
function info() {
  const o = { UNETLoader: { input: { required: { unet_name: [LIST] } } }, CLIPLoader: { input: { required: { clip_name: [LIST] } } },
    VAELoader: { input: { required: { vae_name: [mode === "novae" ? ["other.safetensors"] : LIST] } } }, MiniMaxH3ImageConditioning: {} };
  if (mode !== "nopack") o.MiniMaxH3ImageCharacterSheetDesigner = { input: { required: { state_json: ["STRING", {}] }, optional: { style: [["none", "anime", "photo"]] } } };
  return o;
}
const stand = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => { b += c; }); req.on("end", () => {
    const send = (code, o) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url === "/system_stats") return send(200, {});
    if (req.url === "/object_info") return send(200, info());
    if (req.url === "/h3_character_sheet_designer/minimax_image/preview" && req.method === "POST") {
      if (mode === "nopack") return send(404, {});
      const j = JSON.parse(b || "{}"); previews.push(j);
      const v = JSON.parse(j.state_json).views;
      return send(200, { width: 3200, height: 1280, megapixels: 4.096, experimental: false, prompt: "…",
        semantic_layout: { panels: v.map((id, i) => ({ id, rect: [i / v.length, 0, 1 / v.length, 1], view: id })) },
        default_view_prompts: Object.fromEntries(v.map((id) => [id, "the default for " + id])) });
    }
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
    const cat = await get("/api/charsheet/h3");
    check("GET /api/charsheet/h3: the catalog (13 views, 7 presets, 10 styles, 8 roles), installed or not, the pack named",
      cat.catalog.views.length === 13 && cat.catalog.presets.length === 7 && cat.catalog.styles.length === 10 && cat.catalog.roles.length === 8
      && typeof cat.installed === "boolean" && cat.pack.folder === "H3-Character-Sheet-Designer", Object.keys(cat));
    const pv = await post("/api/charsheet/h3/preview", { choices: { views: ["body_front", "face_front"], hands: "bare" }, layout: true, style: "photo", refs: [false, true, false] });
    const pj = previews[previews.length - 1] || {};
    check("preview: the pack's own route asked with bitGen's state (layout, style, which part pictures) -> size, panels, the view defaults, the summary",
      pv.width === 3200 && pv.panels.length === 2 && pv.panels[0].id === "face_front" && pv.defaults.body_front === "the default for body_front" && pv.summary === "2 views · High detail"
      && pj.use_layout_image === true && pj.style === "photo" && pj.reference_presence.reference_image_2 === true && JSON.parse(pj.state_json).hand_state === "bare", { pv, pj });
    const bad = await post("/api/charsheet/h3/preview", { choices: { views: [] } });
    check("...no view ticked: 400 in words", bad.http === 400 && /at least one view/.test(bad.error), bad);
    // a take
    const fd = new FormData();
    fd.append("image", new Blob([PNG], { type: "image/png" }), "hero.png");
    fd.append("ref2", new Blob([PNG], { type: "image/png" }), "boots.png");
    fd.append("choices", JSON.stringify({ views: ["face_front", "body_front", "body_left", "feet"], feet: "shod", roles: ["face", "footwear", "same_character"], parts: { footwear: "red boots" } }));
    fd.append("layout", "1"); fd.append("style", "anime"); fd.append("ref_files", JSON.stringify(["", "", ""]));
    const t1 = await form("/api/charsheet/h3", fd);
    if (t1.id) jobs.push(t1.id);
    const P = t1.params || {}, G = P.graph || {};
    const st = G.design ? JSON.parse(G.design.inputs.state_json) : {};
    check("POST /api/charsheet/h3: a graph job - the designer gets the views, feet, the part note and the roles; the layout + style ride",
      t1.http === 200 && P.mode === "graph" && st.views.join() === "face_front,body_front,body_left,feet" && st.footwear_state === "shod" && st.part_prompts.footwear === "red boots"
      && st.reference_roles.reference_image_2 === "footwear" && G.design.inputs.use_layout_image === true && G.design.inputs.style === "anime", { t1: Object.keys(t1), st, d: G.design });
    check("...the model names are ComfyUI's own (the sub-folder kept), the part picture wired where the pack numbers it (image_3), the seed rolled",
      G.unet.inputs.unet_name === LIST[0] && G.clip.inputs.clip_name === LIST[1] && G.vae.inputs.vae_name === LIST[2] && JSON.stringify(G.cond.inputs["images.image_3"]) === '["design",6]'
      && !("images.image_2" in G.cond.inputs) && Number.isInteger(G.sample.inputs.seed) && P.seed_random === true, G.cond && G.cond.inputs);
    check("...both pictures kept in the project's Images (charsheet-… / charref2-…) and uploaded by the worker; the answer names them + the summary",
      /^charsheet-.*\.png$/.test(t1.input) && t1.refs[0] === "" && /^charref2-.*\.png$/.test(t1.refs[1]) && P.graph_uploads.length === 2
      && P.graph_uploads[1].node === "ref2" && P.graph_uploads[1].path.endsWith(t1.refs[1]) && /4 views · High detail/.test(t1.summary) && /1 part picture/.test(P.graph_applied[0]), { input: t1.input, refs: t1.refs, up: P.graph_uploads, ap: P.graph_applied });
    // ↻ Regenerate (JSON, by the names kept)
    const t2 = await post("/api/charsheet/h3", { file: t1.input, ref_files: t1.refs, choices: { views: ["body_front"] }, layout: "", style: "none" });
    if (t2.id) jobs.push(t2.id);
    const G2 = (t2.params || {}).graph || {};
    check("↻ Regenerate: JSON with the kept names - the same pictures again, a new job, a new seed",
      t2.http === 200 && t2.id !== t1.id && t2.input === t1.input && t2.refs[1] === t1.refs[1] && (t2.params.graph_uploads || []).length === 2 && G2.design && !("images.image_1" in G2.cond.inputs), t2);
    const t3 = await post("/api/charsheet/h3", { file: "../../config.json", choices: { views: ["body_front"] } });
    check("...a name that is not a picture in the project's Images (or climbs out): refused in words", t3.http === 400 && /not in this project's Images/.test(t3.error), t3);
    const t4 = await post("/api/charsheet/h3", { choices: { views: ["body_front"] } });
    check("...no picture at all: refused in words", t4.http === 400 && /load a picture/.test(t4.error), t4);
    mode = "novae";
    const t5 = await post("/api/charsheet/h3", { file: t1.input, choices: { views: ["body_front"] } });
    check("a ComfyUI without the MiniMax H3 Image VAE: 409, needs h3sheet, the file and its folder named", t5.http === 409 && t5.needs === "h3sheet" && /minimax_h3_image_vae_fp16/.test(t5.error) && /vae/.test(t5.error), t5);
    mode = "nopack";
    const t6 = await post("/api/charsheet/h3", { file: t1.input, choices: { views: ["body_front"] } });
    const pv6 = await post("/api/charsheet/h3/preview", { choices: { views: ["body_front"] } });
    check("...without the designer pack: 409 (install it, restart ComfyUI); the preview says the pack is not loaded", t6.http === 409 && /node pack is not loaded/.test(t6.error) && pv6.nopack === true, { t6, pv6 });
    mode = "full";
    const t7 = await post("/api/charsheet/h3", { file: t1.input, choices: { views: ["body_front"] }, style: "watercolor" });
    check("...a style this version of the pack does not list: 409 in words (update it)", t7.http === 409 && /no "watercolor" style/.test(t7.error), t7);
    await post("/api/config", { engine: { backend: "sdcli" } });
    const t8 = await post("/api/charsheet/h3", { file: t1.input, choices: { views: ["body_front"] } });
    check("another engine: 400 - the sheet is drawn in ComfyUI", t8.http === 400 && /drawn in ComfyUI/.test(t8.error), t8);
    await post("/api/config", { engine: { backend: "comfy", comfy: { url: "http://127.0.0.1:1" } } });
    const pv9 = await post("/api/charsheet/h3/preview", { choices: { views: ["body_front"] } });
    const t9 = await post("/api/charsheet/h3", { file: t1.input, choices: { views: ["body_front"] } });
    check("ComfyUI not running: the preview says offline (with the summary), a take is 503 'start it'", pv9.offline === true && pv9.summary === "Single view · 1 view · High detail" && t9.http === 503 && /not running/.test(t9.error), { pv9, t9 });
    const old = await post("/api/characters/sheetgen", {});
    check("the old /api/characters/sheetgen is gone", old.http === 404 || old.http === undefined || !old.id, old);
  } catch (e) { check("no exception: " + (e && e.stack || e), false); }
  finally {
    for (const id of jobs) await post("/api/jobs/" + id + "/cancel", {}).catch(() => {});
    await post("/api/config", { engine: eng0 }).catch(() => {});
    stand.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
