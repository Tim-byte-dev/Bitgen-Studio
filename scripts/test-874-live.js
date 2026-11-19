#!/usr/bin/env node
/* bitGen Studio — 2.874.0 over the running app (H3_URL) with a stand-in ComfyUI: the sheet designer's catalog, the layout
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
let mode = "full", previews = [], concat = true;
function info() {
  const o = { UNETLoader: { input: { required: { unet_name: [LIST] } } }, CLIPLoader: { input: { required: { clip_name: [LIST] } } },
    VAELoader: { input: { required: { vae_name: [mode === "novae" ? ["other.safetensors"] : LIST] } } }, MiniMaxH3ImageConditioning: {} };
  if (concat) o.StringConcatenate = { input: { required: { string_a: ["STRING", {}], string_b: ["STRING", {}], delimiter: ["STRING", {}] } } };
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
  const jobs = [], made = [];
  try {
    await post("/api/config", { engine: { backend: "comfy", comfy: { url: "http://127.0.0.1:" + port } } });
    const zlib = require("zlib");
    const big = (w, h) => { const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
      const ch = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
      const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; const raw = Buffer.alloc((w + 1) * h, 99); for (let y = 0; y < h; y++) raw[y * (w + 1)] = 0;
      return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ch("IHDR", ih), ch("IDAT", zlib.deflateSync(raw)), ch("IEND", Buffer.alloc(0))]); };
    const up = (kind, buf, name) => { const fd = new FormData(); fd.append("file", new Blob([buf], { type: "image/png" }), name); return form("/api/charsheet/library/" + kind, fd); };
    const t = await up("templates", big(1200, 600), "turnaround.png"); made.push(["templates", t.id]);
    const m = await up("mannequins", big(300, 800), "doll.png"); made.push(["mannequins", m.id]);
    const lib = await get("/api/charsheet/library");
    check("the library: a template and a mannequin added, listed with their sizes", t.w === 1200 && t.h === 600 && m.name === "doll" && lib.templates.some((x) => x.id === t.id) && lib.mannequins.some((x) => x.id === m.id), { t, m });
    const f = await fetch(new URL(t.url, URL_));
    check("...the picture served from its address", f.status === 200 && (await f.arrayBuffer()).byteLength > 50);
    const bad = await up("templates", Buffer.from("just some words, no picture in here"), "x.png");
    check("...not a picture: refused in words", bad.http === 400 && /not a PNG/.test(bad.error), bad);
    const om = await post("/api/charsheet/h3/mannequin", { sex: "own:" + m.id });
    check("your mannequin as the start picture: copied into Images as mannequin-own-<id>.png", om.http === 200 && om.own === true && om.name === "mannequin-own-" + m.id + ".png" && om.label === "doll", om);
    const fd = new FormData();
    fd.append("image", new Blob([PNG], { type: "image/png" }), "hero.png");
    fd.append("choices", JSON.stringify({ views: ["face_front", "body_front", "body_left", "body_back"], detail: "high" }));
    fd.append("style", "none"); fd.append("template", t.id);
    const j1 = await form("/api/charsheet/h3", fd); if (j1.id) jobs.push(j1.id);
    const G = (j1.params || {}).graph || {};
    check("a sheet with the template: your sheet in the layout slot, its 2:1 shape, the extra words through String Concatenate, said in the job",
      j1.http === 200 && G.tpl && JSON.stringify(G.cond.inputs["images.image_1"]) === '["tpl",0]' && Math.abs(G.cond.inputs.width / G.cond.inputs.height - 2) < 0.02 && G.tplPrompt
      && G.design.inputs.use_layout_image === true && / · template turnaround/.test(j1.params.graph_applied[0]) && j1.params.graph_uploads.some((u) => u.node === "tpl"), { a: j1.params && j1.params.graph_applied, c: G.cond && G.cond.inputs });
    concat = false;
    const fd2 = new FormData(); fd2.append("image", new Blob([PNG], { type: "image/png" }), "hero.png");
    fd2.append("choices", JSON.stringify({ views: ["body_front"] })); fd2.append("template", t.id);
    const j2 = await form("/api/charsheet/h3", fd2); if (j2.id) jobs.push(j2.id);
    check("...a ComfyUI without String Concatenate: the template still rides, a warning says so", j2.http === 200 && !j2.params.graph.tplPrompt && /String Concatenate/.test(j2.params.graph_warnings[0]), j2.params && j2.params.graph_warnings);
    const fd3 = new FormData(); fd3.append("image", new Blob([PNG], { type: "image/png" }), "hero.png");
    fd3.append("choices", JSON.stringify({ views: ["body_front"] })); fd3.append("template", "nope");
    const j3 = await form("/api/charsheet/h3", fd3);
    check("...a template no longer in the library: 400 in words", j3.http === 400 && /not in your library/.test(j3.error), j3);
    for (const [k, id] of made) await fetch(new URL(`/api/charsheet/library/${k}/${id}`, URL_), { method: "DELETE" });
    const lib2 = await get("/api/charsheet/library");
    check("DELETE: both gone", !lib2.templates.some((x) => x.id === t.id) && !lib2.mannequins.some((x) => x.id === m.id));
  } finally {
    for (const id of jobs) { try { await post(`/api/jobs/${id}/cancel`, {}); } catch (e) { /* gone */ } }
    await post("/api/config", { engine: eng0 });
    stand.close();
  }
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
