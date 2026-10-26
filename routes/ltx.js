// bitGen Studio — LTX 2.5 from the prompt docker (2.338.0). Mounted from
// routes/index.js (never server.js). What a job carries is lib/ltx.js; the
// render is ltx_worker.py (one mode of Tim's all-in-one canvas).
//
//   GET  /api/ltx/modes   {modes:[{id,label,needs}], styles:[{id,name}], default}
//   POST /api/ltx         multipart: references (up to 3 pictures, in the
//                         reference dock's order = first, last / middle, last),
//                         ref_audios / ref_videos (JSON names - the first is
//                         used), audio_start, video_start, prompt, seconds,
//                         width, height, seed, ltx_mode (auto | an id),
//                         video_style_id, transition ("", "on", "off"), ltx_engine ("" | "canvas", 2.401.5),
//                         ic_lora / ic_strength (2.402.0: LTX 2.3's 3DREAL - "" = the newest 3DREAL file in loras)
//                         -> {id, params, note}
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const core = require("../lib/core");
const trap = require("../lib/trap");
const styles = require("../lib/styles");
const ltx = require("../lib/ltx");
const basicOverride = require("../lib/basicOverride");   // 2.409.0: Basic Settings' Override style

/** The LTX styles; the picked one when it is LTX, else "LTX 2.5", else the first. */
function ltxStyles() { return styles.read(core.STYLES_DIR, "video").filter((s) => ltx.isLtxStyle(s)); }
function pickStyle(id) {
  const all = ltxStyles();
  return all.find((s) => s.id === String(id || "")) || all.find((s) => s.name === "LTX 2.5") || all[0] || null;
}
const names = (v) => { try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a.map(String).filter(Boolean) : []; } catch { return []; } };

function mount(app) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 64 * 1024 * 1024, files: 3 } });

  app.get("/api/ltx/modes", (_req, res) => {
    const st = ltxStyles();
    // 2.402.0: + LTX 2.3 - each style says its family; modes23 = what an LTX 2.3 style offers (with 3DREAL)
    res.json({ modes: ltx.MODES.map((m) => ({ id: m.id, label: m.label, needs: m.needs })),
               modes23: ltx.modesFor({ arch: ltx.ARCH23 }).map((m) => ({ id: m.id, label: m.label, needs: m.needs })),
               styles: st.map((s) => ({ id: s.id, name: s.name, family: s.arch === ltx.ARCH23 ? "ltx23" : "ltx25" })),
               default: (pickStyle() || {}).id || "" });
  });

  app.post("/api/ltx", upload.array("references", 3), trap.guard((req, res) => {
    const b = req.body || {};
    // 2.409.0: Override style ON - Basic Settings' model (phase 1) + temporary LoRAs ride on a copy of the style,
    // its seed is the job's, its steps / cfg go into the graph
    const bo = basicOverride.parse(b.basic);
    const style = basicOverride.withStyle(pickStyle(b.video_style_id), bo, { loras: true, topModel: true });
    if (!style) return res.status(400).json({ error: "no LTX 2.5 video style - restart the app to seed \"LTX 2.5\" (Settings -> Video styles)" });
    const id = crypto.randomBytes(6).toString("hex");
    const dir = path.join(core.JOBS_DIR, id);
    fs.mkdirSync(dir, { recursive: true });
    const images = [];
    (req.files || []).forEach((f, i) => {
      let ext = path.extname(f.originalname || "").toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".webp", ".bmp"].includes(ext)) ext = ".png";
      const p = path.join(dir, `ltx_image${i + 1}${ext}`);
      fs.writeFileSync(p, f.buffer);
      images.push(p);
    });
    const a0 = names(b.ref_audios)[0], v0 = names(b.ref_videos)[0];
    /* 2.399.0 (Tim: "will we be able to tell mmh3 , wan and ltx to follow these paths and camera movement"): the
       timeline's 🎥 camera (lib/camPlan.forLtx) - the path in words, the LTX-2 camera LoRA for its main move
       (ltx_worker.py finds it in ComfyUI's loras), and the exact path: the DEPTH guide through the style-transfer
       mode (v2v - the union-control IC-LoRA reads depth) with the first picture as its first frame */
    let prompt = b.prompt, ltxMode = String(b.ltx_mode || "auto"), vid = v0 ? { path: path.join(core.pDir("video"), path.basename(v0)), start: +b.video_start || 0 } : null;
    let cam = null;
    const pk = require("../lib/camPlan").parse(b.camera);
    if (pk) {
      cam = require("../lib/camPlan").forLtx(pk, { seconds: +b.seconds || 5 });
      prompt = require("../lib/camPlan").join(prompt, cam.text);
      if (cam.depth && images.length) { ltxMode = "v2v"; vid = { path: cam.depth, start: 0 }; images.splice(1); cam.notes.push("exact path: the depth guide through LTX's style-transfer mode (v2v), the first picture as its first frame"); }
      else if (cam.depth) cam.notes.push("exact path: LTX's guide mode needs a first picture in the reference dock - the camera LoRA / words only");
    }
    const p = ltx.jobParams({
      style, workflow: ltx.workflowFor(style, core.BASE), mode: ltxMode,
      prompt, images, negative: require("../static/negprompt.js").clean(b.negative),   // 2.419.0: ⊖ the negative docker (empty = the style's)
      audio: a0 ? { path: path.join(core.pDir("sound"), path.basename(a0)), start: +b.audio_start || 0 } : null,
      video: vid,
      seconds: b.seconds, width: b.width, height: b.height, seed: require("../lib/seedPick").pick(bo ? bo.seed : b.seed, style, { override: !!bo, max: 2 ** 31 - 1 }), basic: bo,   // 2.598.0: + the style's fixed seed
      transition: b.transition === "on" ? true : b.transition === "off" ? false : null,
      engine: b.ltx_engine === "canvas" ? "canvas" : "",
      ic_lora: b.ic_lora, ic_strength: b.ic_strength,           // 2.402.0: 3DREAL (LTX 2.3)
    });
    if (p.error) { fs.rmSync(dir, { recursive: true, force: true }); return res.status(400).json({ error: p.error }); }
    if (cam) {                                     // 2.399.0
      if (cam.lora) p.camera_lora = cam.lora;
      if (ltxMode === "v2v" && cam.depth) p.raw_guide = true;
      p.camera_notes = cam.notes;
    }
    { const sf = require("../lib/socialFormat").forJob(b.format); if (sf.social) p.social = sf.social; }   // 2.600.0: Format ▸ social media
    const job = core.makeJob(p, id, dir);
    for (const n of (cam && cam.notes) || []) try { job.log.push("[camera] " + n); } catch { /* fine */ }
    if (bo) try { job.log.push("[bitgen-studio] " + basicOverride.note(bo, "LTX")); } catch { /* fine */ }
    res.json({ id: job.id, params: p, note: ltx.summary(p) + (cam && cam.notes.length ? " · " + cam.notes.join(" · ") : "") });
  }));
}

module.exports = { mount, pickStyle, ltxStyles };
