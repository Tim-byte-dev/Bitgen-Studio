/* bitGen Studio — lib/styleDoctor.js (2.527.0): 🩺 THE STYLE DOCTOR (static/styledoctor.js).
 * Tim asked for the recommendations to be worked through; this is the first: "one click makes a tiny test picture with
 * every style and shows a pass/fail table with the failing log line" - it would have caught Krea and Anima before he did.
 *
 *   THE STYLES   every image style, with what can be told WITHOUT rendering: a chain style / a music style (skipped),
 *                a missing slot (the style is incomplete - fails at once, no job)
 *   A CHECK      the docker queues each style through /api/genimage (the same path as Generate - the same patcher, the
 *                same loader repair) with a fixed prompt and seed, small and few steps (Quick) or as the style says (Real),
 *                ONE at a time, and waits for each
 *   WHY IT FAILED  explain(log) (pure): the line that matters and what to do - a model ComfyUI does not list, a missing
 *                node pack, ComfyUI not running, out of VRAM, a half-downloaded file, a text encoder that does not fit the
 *                model, a workflow older than its nodes, a worker crash
 *   THE PICTURE  collect(job, style): the test picture leaves the gallery and the Image assets (it is not your work) and
 *                becomes the row's thumbnail: projects/<p>/doctor/<style id>.png
 *   THE REPORT   projects/<p>/doctor/report.json - the last run, shown again when the docker opens; toMarkdown for a copy
 */
"use strict";
const fs = require("fs");
const path = require("path");

function core() { return require("./core"); }
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }

/* ---------------- why a job failed (pure) */
const RULES = [
  { kind: "model", re: /Value not in list \[(unet_name|ckpt_name|vae_name|clip_name\d?|lora_name|model_name|t5_name)\]\s*=\s*(.+)$/m,
    advice: (m) => `ComfyUI does not have "${m[2].trim()}" in its ${m[1]} list. Put the file in ComfyUI/models/${
      /lora/.test(m[1]) ? "loras" : /vae/.test(m[1]) ? "vae" : /clip|t5/.test(m[1]) ? "text_encoders" : /ckpt/.test(m[1]) ? "checkpoints" : "diffusion_models"} (a subfolder is fine), or add its folder to extra_model_paths.yaml, then restart ComfyUI - or pick another file in the style.` },
  // 2.535.0: an OPTION this ComfyUI does not offer (Tim: CLIPLoader.type = flux3) = ComfyUI older than the model
  { kind: "comfyold", re: /Value not in list \[(type|sampler_name|scheduler|weight_dtype|clip_type|mode|method)\]\s*=\s*(.+)$/m,
    advice: (m) => `This ComfyUI does not offer "${m[2].trim()}" for ${m[1]} - it is older than the model${/^flux3$/i.test(m[2].trim()) ? " (FLUX 3 Klein needs ComfyUI 0.41.0 or newer, 0.41.1+ is best)" : /^moss_image$/i.test(m[2].trim()) ? " (MOSS-Image needs ComfyUI from 16 Oct 2026 or newer)" : ""}. Update ComfyUI (the portable build: update\\update_comfyui.bat; a git install: git pull + pip install -r requirements.txt; or ComfyUI-Manager -> Update ComfyUI), then restart it.` },
  { kind: "nodes", re: /ComfyUI does not have these node types: ([^\n.]+)/, advice: (m) => `Install the node pack that provides ${m[1].trim()} (ComfyUI Manager -> Install Missing Custom Nodes), then restart ComfyUI.` },
  { kind: "comfy", re: /cannot reach ComfyUI|Connection refused|ECONNREFUSED|ComfyUI is not running/i, advice: () => "Start ComfyUI (the ComfyUI item on the statusbar), then run the check again." },
  { kind: "vram", re: /out of memory|OutOfMemoryError|CUDA error: out of memory|Allocation on device/i, advice: () => "Out of video memory. Use a smaller (GGUF / fp8) model file, lower the size, or press ⏏ to unload other models first." },
  { kind: "file", re: /HeaderTooLarge|Error while deserializing header|safetensors_rust|incomplete metadata|invalid load key|unexpected EOF|PytorchStreamReader failed/i, advice: () => "The model file is damaged or only half downloaded. Download it again." },
  { kind: "mismatch", re: /mat1 and mat2 shapes cannot be multiplied|size mismatch for|Error\(s\) in loading state_dict|shape '\[.*\]' is invalid/i, advice: () => "A file does not fit the model: usually the wrong text encoder or VAE for this model family. Check the style's text encoder / VAE against the model's page." },
  { kind: "input", re: /Required input is missing|Prompt outputs failed validation/i, advice: () => "The workflow does not match this ComfyUI's nodes. Update ComfyUI and the node packs, or export the workflow again from ComfyUI." },
  { kind: "slots", re: /style "[^"]+" is missing: ([^\n]+)/, advice: (m) => `The style is incomplete (${m[1].trim()}). Open it in Settings -> Image and fill those in.` },
  { kind: "crash", re: /Traceback \(most recent call last\)|worker exited with code [1-9]/, advice: () => "The worker stopped with an error - the line above is the reason. Send a 🐞 report (Ctrl+Alt+Shift+B) if it is not clear." }
];
/** 2.531.0: a file the model catalog (lib/modelCatalog.json) can download -> where (pure) */
function catalogHint(value) {
  let cat = []; try { cat = require("./modelCatalog.json").models || []; } catch { cat = []; }
  const want = String(value || "").trim().replace(/\\/g, "/").split("/").pop().toLowerCase();
  if (!want) return "";
  const m = cat.find((x) => [String(x.as || ""), String(x.file || "").split("/").pop()].map((t) => t.toLowerCase()).includes(want));
  if (!m) return "";
  return `It is in the model catalog: Settings -> Models -> ⤓ Model catalog -> "${m.label || want}"${m.size ? ` (${(m.size / 1e9).toFixed(1)} GB)` : ""} downloads it to ${String(m.dest || "").replace("comfy/", "ComfyUI/models/")}.`;
}
/** the failing line + what to do -> {kind, line, advice} (kind "unknown" when nothing matched) */
function explain(log) {
  const lines = (Array.isArray(log) ? log : String(log || "").split(/\r?\n/)).map(String);
  const text = lines.join("\n");
  for (const r of RULES) {
    const m = text.match(r.re);
    if (!m) continue;
    const idx = lines.findIndex((l) => r.re.test(l) || l.includes(m[0].split("\n")[0]));
    let line = idx >= 0 ? lines[idx].trim() : m[0].trim();
    if (r.kind === "model") { const det = lines.find((l) => /not in \(list of length|not in \[/.test(l)); if (det) line += " - " + det.trim(); }
    if (r.kind === "crash") { const err = [...lines].reverse().find((l) => /Error|error:|ERROR/.test(l) && !/worker exited/.test(l)); if (err) line = err.trim(); }
    let advice = r.advice(m);
    if (r.kind === "model") { const h = catalogHint(m[2]); if (h) advice += " " + h; }   // 2.531.0: the catalog has it
    return { kind: r.kind, line: line.slice(0, 400), advice };
  }
  const last = [...lines].reverse().find((l) => /ERROR|Error|failed|refused/.test(l));
  return { kind: "unknown", line: (last || lines.filter(Boolean).slice(-1)[0] || "").trim().slice(0, 400), advice: "See the job's log in the Queue (it is kept there)." };
}

/* ---------------- the styles */
function list() {
  const C = core(), S = require("./styles");
  let all = []; try { all = S.read(C.STYLES_DIR, "image"); } catch { all = []; }
  return all.filter((s) => s && s.kind !== "music").map((s) => {
    let missing = []; try { missing = S.missingSlots(s); } catch { missing = []; }
    const skip = s.chain ? "a ControlNet chain style - not rendered on its own" : "";
    let slots = 0; try { slots = S.imageSlots(s, C.BASE); } catch { slots = 0; }
    return { id: s.id, name: s.name, arch: s.arch || "", model: s.model || "", steps: s.steps || null, width: s.width || null, height: s.height || null,
             missing, skip, slots };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/* ---------------- the picture */
function dir() { const d = path.join(core().projDir(core().getProject()), "doctor"); fs.mkdirSync(d, { recursive: true }); return d; }
function safeId(id) { const s = String(id || "").replace(/[^A-Za-z0-9_-]/g, ""); if (!s) throw bad("a style id"); return s; }
/** the test picture out of the gallery + the Image assets -> doctor/<style>.png (+ the job's other files removed) */
function collect(jobId, styleId) {
  const C = core(), job = C.jobs.get(String(jobId || ""));
  if (!job) throw bad("no such job", 404);
  const sid = safeId(styleId);
  const names = [...new Set([...(job.outputs || []), job.output].filter(Boolean).map((n) => path.basename(String(n))))];
  let thumb = "";
  const imgDir = C.pDir("images");
  for (const n of names) {
    const src = C.outputDirs().map((d) => path.join(d, n)).find((p) => fs.existsSync(p));
    if (!src) continue;
    let ino = null; try { ino = fs.statSync(src).ino; } catch { ino = null; }
    // its Image asset is a hard link of the same file (lib/autoAssets) - only that one goes
    try { const a = path.join(imgDir, n); if (fs.existsSync(a) && ino !== null && fs.statSync(a).ino === ino) fs.unlinkSync(a); } catch { /* fine */ }
    if (!thumb && /\.(png|jpe?g|webp)$/i.test(n)) {
      const to = path.join(dir(), sid + path.extname(n).toLowerCase());
      try { fs.renameSync(src, to); } catch { fs.copyFileSync(src, to); fs.unlinkSync(src); }
      thumb = path.basename(to);
    } else { try { fs.unlinkSync(src); } catch { /* fine */ } }
  }
  return { thumb, removed: names.length };
}
function thumbPath(name) { const f = path.join(dir(), path.basename(String(name || ""))); return fs.existsSync(f) ? f : null; }

/* ---------------- a test picture for the styles that EDIT one (a workflow with LoadImage nodes) */
const REF = "_style-doctor-ref.png";
/** a small PNG (pure): a soft sky-to-sand gradient with a red ball - something an edit model can work on */
function makePng(w, h) {
  const zlib = require("zlib");
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const t = y / h, o = y * (w * 3 + 1) + 1 + x * 3;
      let r = Math.round(120 + 110 * t), g = Math.round(170 + 30 * t), b = Math.round(230 - 120 * t);
      const dx = x - w * 0.5, dy = y - h * 0.58, rr = Math.min(w, h) * 0.18;
      if (dx * dx + dy * dy < rr * rr) { const k = 1 - Math.sqrt(dx * dx + dy * dy) / rr; r = Math.round(170 + 80 * k); g = Math.round(30 + 40 * k); b = Math.round(30 + 30 * k); }
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (buf) => { let c = 0xffffffff; for (const v of buf) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
/** the reference picture in the Image assets for this run (genimage takes pictures from there only) -> its name */
function ensureRef() { const f = path.join(core().pDir("images"), REF); fs.mkdirSync(path.dirname(f), { recursive: true }); if (!fs.existsSync(f)) fs.writeFileSync(f, makePng(512, 512)); return REF; }
function removeRef() { try { fs.unlinkSync(path.join(core().pDir("images"), REF)); return true; } catch { return false; } }

/* ---------------- the report */
const STATUS = ["ok", "fail", "skip", "stopped"];
function cleanRow(r) {
  const x = r && typeof r === "object" ? r : {};
  return { id: String(x.id || "").slice(0, 80), name: String(x.name || "").slice(0, 120), status: STATUS.includes(x.status) ? x.status : "stopped",
           secs: Number.isFinite(+x.secs) ? Math.round(+x.secs * 10) / 10 : null, job: String(x.job || "").slice(0, 60),
           kind: String(x.kind || "").slice(0, 20), line: String(x.line || "").slice(0, 400), advice: String(x.advice || "").slice(0, 400), thumb: String(x.thumb || "").slice(0, 120) };
}
function saveReport(rep) {
  const r = rep && typeof rep === "object" ? rep : {};
  const out = { at: new Date().toISOString(), mode: r.mode === "real" ? "real" : "quick", rows: (Array.isArray(r.rows) ? r.rows : []).slice(0, 500).map(cleanRow) };
  fs.writeFileSync(path.join(dir(), "report.json"), JSON.stringify(out, null, 1));
  try { require("./testPlan").event("style_doctor", { cat: out.mode, what: out.mode + ": " + `${out.rows.filter((x) => x.status === "ok").length} ok / ${out.rows.filter((x) => x.status === "fail").length} failed` }); } catch { /* the 🧪 checklist */ }
  return out;
}
/** 🗑 the last run and its pictures */
function clearReport() { const d = dir(); let n = 0; for (const f of fs.readdirSync(d)) { try { fs.unlinkSync(path.join(d, f)); n++; } catch { /* fine */ } } return n; }
function loadReport() { try { return JSON.parse(fs.readFileSync(path.join(dir(), "report.json"), "utf8")); } catch { return null; } }
/** the report as text to paste or keep (pure) */
function toMarkdown(rep, version) {
  const r = rep || { rows: [] }, rows = r.rows || [];
  const n = (s) => rows.filter((x) => x.status === s).length;
  const out = [`# Style doctor - ${r.at || ""}`, "", `bitGen Studio ${version || ""} · ${r.mode === "real" ? "Real render (each style's own steps + size)" : "Quick check (512 × 512, 4 steps)"}`,
    "", `**${n("ok")} work · ${n("fail")} failed · ${n("skip")} skipped**`, "", "| Style | Result | Time | Why / what to do |", "|---|---|---|---|"];
  const cell = (t) => String(t == null ? "" : t).replace(/\|/g, "/").replace(/\r?\n/g, " ");
  for (const x of rows) out.push(`| ${cell(x.name)} | ${x.status === "ok" ? "✓ works" : x.status === "fail" ? "✗ failed" : x.status === "skip" ? "– skipped" : "■ stopped"} | ${x.secs != null ? x.secs + " s" : ""} | ${cell([x.line, x.advice].filter(Boolean).join(" → "))} |`);
  return out.join("\n") + "\n";
}

module.exports = { RULES, REF, catalogHint, explain, list, collect, thumbPath, makePng, ensureRef, removeRef, cleanRow, saveReport, loadReport, clearReport, toMarkdown };
