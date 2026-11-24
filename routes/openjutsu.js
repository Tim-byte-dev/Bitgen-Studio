// bitGen Studio — routes/openjutsu.js (2.949.0): THE ⇄ SWAP DIALOG'S OPENJUTSU BAR. Mounted from routes/swapdlg.js
// (it shares that dialog's record, swap_dialog.json - never server.js). lib/openjutsu.js builds the graphs,
// misc/openjutsu_worker.py renders them, lib/openjutsuAddon.js installs the node packs + files.
//
//   GET  /api/openjutsu                 {addon: the add-on's status, kinds, modes, licence}
//   POST /api/openjutsu/settings        {oj: {...}}  the bar's settings (merged, lib/openjutsu settingsSafe) -> the record
//   POST /api/openjutsu/picture         multipart "image" + n (2-4), or {n, asset} (an Image asset), or {n, clear: true}
//                                       - the extra characters of Advanced / One pass per person
//   GET  /api/openjutsu/picture/:n      that picture
//   POST /api/openjutsu/mask            {start, dur} (the box) or {id} (a segment) - 👁 check what OpenJutsu repaints
//   POST /api/openjutsu/fix             {id, kind: color | face} - 🎨 / 🙂 on a finished take -> a new take of the same
//                                       segment (🙂 needs the licence ticked: InsightFace non-commercial, YOLO AGPL-3.0)
"use strict";
const fs = require("fs");
const path = require("path");
const trap = require("../lib/trap");
const core = require("../lib/core");
const refSelect = require("../lib/refSelect");
const SS = require("../lib/swapSession");
const OJ = require("../lib/openjutsu");

const PIC_NAME = (n) => `_oj_character_${n}`;

/** The nested parts merge (a patch of object.mode keeps object.target). */
function mergeSettings(cur, patch) {
  const c = OJ.settingsSafe(cur), p = patch && typeof patch === "object" ? patch : {};
  const out = { ...c, ...p };
  for (const k of ["object", "color", "face"]) out[k] = { ...c[k], ...(p[k] && typeof p[k] === "object" ? p[k] : {}) };
  if (Array.isArray(p.roles)) out.roles = c.roles.map((r, i) => (p.roles[i] != null ? p.roles[i] : r));
  out.pictures = c.pictures;                              // pictures change through /picture only
  return OJ.settingsSafe(out);
}

function mount(app, d) {
  const addon = () => require("../lib/openjutsuAddon");

  app.get("/api/openjutsu", trap.guard((_req, res) => {
    let st = null;
    try { st = addon().status(); } catch (e) { st = { installed: false, note: String((e && e.message) || e), items: [] }; }
    res.json({ addon: st, modes: OJ.MODES, kinds: OJ.KINDS, licence: OJ.LICENCE, pin: OJ.PIN, ceiling_seconds: SS.maxSeconds(OJ.CEILING) });
  }));

  app.post("/api/openjutsu/settings", trap.guard((req, res) => {
    const st = d.current();
    st.oj = mergeSettings(st.oj, (req.body || {}).oj);
    res.json(d.view(SS.save(d.pdir(), st)));
  }));

  app.post("/api/openjutsu/picture", d.upload.single("image"), trap.guard((req, res) => {
    const b = req.body || {};
    const n = Math.floor(+b.n);
    if (!(n >= 2 && n <= OJ.MAX_CHARACTERS)) return res.status(400).json({ error: "n is the character's number, 2-4 (picture 1 is the box on the left)" });
    const st = d.current();
    const dir = SS.dirOf(d.pdir(), "temp");
    const oj = OJ.settingsSafe(st.oj);
    const drop = () => { for (const f of fs.readdirSync(dir)) if (f.startsWith(PIC_NAME(n) + ".")) fs.rmSync(path.join(dir, f), { force: true }); };
    if (b.clear === true || b.clear === "true") {
      drop(); oj.pictures[n - 2] = ""; st.oj = oj;
      return res.json(d.view(SS.save(d.pdir(), st)));
    }
    let buf = null, ext = ".png";
    if (req.file && req.file.buffer) { buf = req.file.buffer; ext = path.extname(req.file.originalname || "").toLowerCase(); }
    else if (b.asset) {
      const a = path.join(core.pDir("images"), path.basename(String(b.asset)));
      if (!fs.existsSync(a)) return res.status(400).json({ error: "that picture is not in the Image assets" });
      buf = fs.readFileSync(a); ext = path.extname(a).toLowerCase();
    }
    if (!buf) return res.status(400).json({ error: "send a picture (png / jpg / webp)" });
    if (!d.PIC_EXT.includes(ext)) return res.status(400).json({ error: "a character must be a picture (png / jpg / webp / bmp)" });
    drop();
    const name = PIC_NAME(n) + ext;
    fs.writeFileSync(path.join(dir, name), buf);
    oj.pictures[n - 2] = name;
    st.oj = oj;
    res.json(d.view(SS.save(d.pdir(), st)));
  }));

  app.get("/api/openjutsu/picture/:n", (req, res) => {
    const n = Math.floor(+req.params.n);
    const oj = OJ.settingsSafe(SS.load(d.pdir()).oj);
    const f = n >= 2 && n <= OJ.MAX_CHARACTERS && oj.pictures[n - 2] ? path.join(SS.dirOf(d.pdir(), "temp"), oj.pictures[n - 2]) : "";
    if (!f || !fs.existsSync(f)) return res.status(404).json({ error: "no picture yet" });
    res.sendFile(f);
  });

  // 👁 the mask check: the box (or a segment) through workflows/mask.api.json
  app.post("/api/openjutsu/mask", trap.guard(async (req, res) => {
    const b = req.body || {};
    let st = d.current();
    if (!st.video || !fs.existsSync(d.videoPath(st.video))) return res.status(400).json({ error: "load the video to swap first (📂 Load video)" });
    let seg = b.id ? st.segments.find((g) => g.id === String(b.id)) : null;
    if (!seg) {
      const info = refSelect.probe(d.videoPath(st.video));
      const g = info ? SS.one(info.duration, b.start, b.dur, OJ.CEILING) : null;
      if (!g) return res.status(400).json({ error: "that window is shorter than 5 frames or past the end" });
      const r = SS.addSegment(st, g);
      st = r.state; seg = r.seg;
    }
    const down = await d.comfyUp();
    if (down) return res.status(502).json({ error: down });
    const q = d.queue(st, seg, { engine: "openjutsu", ojKind: "mask" });
    if (q.error) return res.status(400).json({ error: q.error });
    const r = SS.addResult(st, { seg: seg.id, video: st.video, start: seg.start, dur: seg.dur, frames: seg.frames,
                                 seed: q.seed, job: q.job.id, engine: "openjutsu", oj: "mask" });
    res.json({ ...d.view(SS.save(d.pdir(), r.state)), queued: [r.result.id],
               note: "👁 checking the mask - cyan = what OpenJutsu repaints, orange = the tracked person, beside the grey mannequin H3 follows" });
  }));

  // 🎨 / 🙂 on a finished take
  app.post("/api/openjutsu/fix", trap.guard(async (req, res) => {
    const b = req.body || {};
    const kind = b.kind === "face" ? "face" : b.kind === "color" ? "color" : "";
    if (!kind) return res.status(400).json({ error: "kind is color or face" });
    let st = d.current();
    const r0 = st.results.find((x) => x.id === String(b.id));
    if (!r0 || r0.status !== "done") return res.status(404).json({ error: "no finished take with that id - pick one on the right" });
    if (r0.oj === "mask") return res.status(400).json({ error: "👁 that is a mask check - fix a swapped take" });
    const src = d.fileOf(r0);
    if (!fs.existsSync(src)) return res.status(404).json({ error: `${r0.file} is gone` });
    if (kind === "face" && !OJ.settingsSafe(st.oj).face.ok) return res.status(400).json({ error: OJ.LICENCE.face + " Tick \"I accept\" beside 🙂 Fix faces first.", licence: true });
    const down = await d.comfyUp();
    if (down) return res.status(502).json({ error: down });
    const seg = { id: r0.seg, start: r0.start, dur: r0.dur, frames: r0.frames };
    const q = d.queue(st, seg, { engine: "openjutsu", ojKind: kind, source: src, seed: r0.seed >= 0 ? r0.seed : undefined });
    if (q.error) return res.status(400).json({ error: q.error });
    const r = SS.addResult(st, { seg: r0.seg, video: r0.video, start: r0.start, dur: r0.dur, frames: r0.frames,
                                 seed: q.seed, job: q.job.id, engine: "openjutsu", oj: kind });
    st = r.state;
    res.json({ ...d.view(SS.save(d.pdir(), st)), queued: [r.result.id],
               note: (kind === "color" ? "🎨 fixing the colours of " : "🙂 fixing the faces of ") + r0.file + " - a new take of the same segment" });
  }));
}

module.exports = { mount, mergeSettings, PIC_NAME };
