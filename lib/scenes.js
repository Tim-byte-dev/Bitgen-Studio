// bitGen Studio — the Scene Board's state model.
//
// One record per scene of the screenplay, persisted IN THE PROJECT FILE
// (core.prjPath) under the `scenes` key — the project file is the one store
// this project has, and a second JSON beside it would be a second source of
// truth (HANDOVER: build order step 2). save() reads the .prj, replaces only
// `scenes`, and writes it back, so the description/timeline/whatever else
// lives there is never clobbered.
//
// THE PLAN IS THE TRUTH. A scene record is DERIVED from a plan_json shot
// (fromPlan), never authored independently — the trap in the handover is the
// scene list drifting from plan_json until the board shows one film and the
// graph renders another. Render state (status/output/seed/chapter/…) is OURS
// and is carried over by shot id when the plan is re-derived, so rewriting
// the screenplay does not forget which scenes were already kept.
//
// A record:
//   { n, id, chapter, prompt: [line…], length, seed,
//     status: "idle" | "running" | "rendered" | "kept",
//     output, upscaled, job, updated }
//
// Everything here is pure state + disk; no UI, no server, no ComfyUI. It is
// tested exactly that way (scripts/test-scenes.js).
const fs = require("fs");
const path = require("path");
const core = require("./core");
const chars = require("./characters");
const sceneEdit = require("./sceneEdit");      // 2.337.0: ✎ First frame (Qwen 2.1)

const STATUSES = ["idle", "running", "rendered", "kept"];

/** The empty board every project starts from. `plan` is the accepted
 *  screenplay (normalized plan_json) — stored here because the tmp graph is
 *  REBUILT from the base style on every cast change, so the graph cannot be
 *  the plan's home; the board writes it back in before each scene render. */
/* The scene's anchor radio (2.288.0; 2.292.0 adds "transition"):
   reference = ref2va (a new location/character; the previous take's end
   rides as <Video 1> on the native-audio style), first = fl2va starting on
   the picked frame, transition = fl2va from that frame to the new
   location's still. "last" stays valid for boards saved before 2.292 (it
   always rendered as First). lib/nativeAudio.plan reads it. */
// 2.296.0: "continue" (Cont) = ref2va opening on the previous scene's frame
// WITH the cast sheets (First's fl2va has no reference slots)
const ANCHORS = ["reference", "first", "continue", "transition", "last"];

function blank() { return { chapters: [], list: [], plan: null, pending: [],
                            style: "" }; }

function slot(x) {
  return x && x.file ? { file: path.basename(String(x.file)), label: String(x.label || "").slice(0, 80) }
    : undefined;
}

/** Coerce whatever was read from disk into a board we can trust. */
function safe(s) {
  const b = blank();
  if (!s || typeof s !== "object") return b;
  if (s.plan && typeof s.plan === "object" && Array.isArray(s.plan.shots))
    b.plan = s.plan;
  // the RENDER QUEUE (2.149.0): stable record ids, in order. Ids, not scene
  // numbers, so an edit or added scene mid-queue cannot shift which scene a
  // queued entry means; unknown ids are dropped on read.
  if (Array.isArray(s.pending))
    b.pending = s.pending.map(String).filter((x, i, a) => x && a.indexOf(x) === i);
  // EXTEND VIDEO (2.223.13): the menubar checkbox persists WITH the board —
  // the .prj is the project state, so the flag survives restarts exactly
  // like gen.seconds does, and every save path (safe -> save) carries it.
  // H3_VIDEO_REF (2.223.16): the board's style pick — "" is the character
  // chain (the default, unchanged), a name routes the render flow
  b.style = String(s.style || "");
  if (s.audio) b.audio = String(s.audio);   // 2.288.0: the board's song
  // 2.289.0: the song whose segment map was last STAGED on the board
  // (lib/segBoard) - a re-save of the same song keeps the written scenes
  if (s.seg_song) b.seg_song = String(s.seg_song);
  // 2.293.0: "▶ as written" - the writer queues each scene for render as
  // it lands (lib/autoRender); a board switch, saved with the board
  if (s.auto_render === true) b.auto_render = true;
  // 2.358.0: the song strip's transition gap - {dur (s), type} (lib/sceneBridge)
  if (s.seg_gap && typeof s.seg_gap === "object" && require("./sceneBridge").normGap(s.seg_gap.dur) > 0)
    b.seg_gap = { dur: require("./sceneBridge").normGap(s.seg_gap.dur), type: require("./sceneBridge").normType(s.seg_gap.type) };
  // 2.323.0: the board's Scenes field (blank = scenes.txt, else the LLM decides)
  { const c = parseInt(s.scene_count, 10);
    if (Number.isFinite(c) && c >= 1 && c <= 40) b.scene_count = c; }
  if (Array.isArray(s.chapters))
    b.chapters = s.chapters.map((c) => chars.slug(c)).filter(Boolean)
      .filter((c, i, a) => a.indexOf(c) === i);
  if (Array.isArray(s.list))
    b.list = s.list.filter((r) => r && typeof r === "object").map((r, i) => ({
      n: Number.isInteger(r.n) && r.n > 0 ? r.n : i + 1,
      id: String(r.id || `clip_${String(i + 1).padStart(2, "0")}`),
      chapter: chars.slug(r.chapter || ""),
      prompt: Array.isArray(r.prompt) ? r.prompt.map(String) : [],
      length: Number.isFinite(r.length) ? r.length : undefined,
      seed: r.seed === undefined || r.seed === null ? "" : String(r.seed),
      // 2.288.0: the trim pivot's per-scene settings survive the sanitizer
      audio_start: Number.isFinite(r.audio_start) ? r.audio_start : undefined,
      audio_dur: Number.isFinite(r.audio_dur) ? r.audio_dur : undefined,
      anchor: ANCHORS.includes(r.anchor) ? r.anchor : undefined,
      cont_src: Number.isFinite(r.cont_src) ? r.cont_src : undefined,
      cont_time: Number.isFinite(r.cont_time) ? r.cont_time : undefined,
      // 2.291.0: a fresh take waiting for the timeline dock (lib/sceneTimeline)
      tl_pending: r.tl_pending === true ? true : undefined,
      tl_start: Number.isFinite(r.tl_start) ? r.tl_start : undefined,
      tl_dur: Number.isFinite(r.tl_dur) ? r.tl_dur : undefined,
      tl_from: ["scene", "seg", "sequence", "song"].includes(r.tl_from) ? r.tl_from : undefined,   // 2.377.0: + song
      // 2.295.0: this scene's own reference pictures (lib/sceneRefs)
      refs: Array.isArray(r.refs) && r.refs.length
        ? r.refs.filter((x) => x && x.file).slice(0, 9).map((x) => ({
            file: path.basename(String(x.file)), label: String(x.label || "").slice(0, 60) }))
        : undefined,
      // 2.297.0: the scene's chosen FIRST / LAST frame pictures (lib/sceneRefs)
      fl_first: slot(r.fl_first), fl_last: slot(r.fl_last),
      // 2.352.0: the H3_Viggle 🎬 motion video (lib/h3Viggle)
      motion: slot(r.motion),
      // 2.302.0: drop the take's first frame (it repeats the frame it started on)
      trim_first: r.trim_first === true ? true : undefined,
      // 2.358.0: a BRIDGE scene between two segments (lib/sceneBridge) - {type, after}
      bridge: require("./sceneBridge").safeBridge(r.bridge),
      // 2.337.0: ✎ First frame (Qwen 2.1) - the accordion's picks + its job
      qedit: r.qedit && !sceneEdit.isBlank(r.qedit) ? sceneEdit.safe(r.qedit) : undefined,
      status: STATUSES.includes(r.status) ? r.status : "idle",
      output: r.output ? String(r.output) : "",
      upscaled: r.upscaled ? String(r.upscaled) : "",
      job: r.job ? String(r.job) : "",
      upjob: r.upjob ? String(r.upjob) : "",
      error: r.error ? String(r.error) : "",
      updated: r.updated ? String(r.updated) : "",
      // 2.384.0 (lib/sceneSeed): the card's own seed, the seed the last take used, its render time + metadata
      user_seed: Number.isSafeInteger(r.user_seed) && r.user_seed >= 0 ? r.user_seed : undefined,
      seed_used: Number.isSafeInteger(r.seed_used) || /^\d+$/.test(String(r.seed_used == null ? "" : r.seed_used)) ? r.seed_used : undefined,
      render_seconds: Number.isFinite(r.render_seconds) ? r.render_seconds : undefined,
      meta: r.meta && typeof r.meta === "object" ? r.meta : undefined,
    }));
  return b;
}

// ---- persistence: the .prj file, and only its `scenes` key ---------------
function readPrj(project) {
  try { return JSON.parse(fs.readFileSync(core.prjPath(project || core.getProject()), "utf8")) || {}; }
  catch { return {}; }
}

/** Never throws: a project with no board (or a corrupt one) is an empty one. */
function load(project) { return safe(readPrj(project).scenes); }

/** Read–merge–write so the other keys in the project file survive. */
function save(state, project) {
  const p = project || core.getProject();
  const d = readPrj(p);
  d.scenes = safe(state);
  try {
    fs.mkdirSync(path.dirname(core.prjPath(p)), { recursive: true });
    fs.writeFileSync(core.prjPath(p), JSON.stringify(d, null, 2));
    writeSceneFiles(d.scenes, p);   // 2.182.0: the per-scene mirror
    return d.scenes;
  } catch { return d.scenes; }
}

// ---- per-scene files (2.182.0, by instruction: "save each scene to
// chapter name<n>.json n is the scene number. load the scenes when the
// movie and chapter is selected") ------------------------------------------
// projects/<p>/scenes/<chapterslug><n>.json — one file per scene, rewritten
// on EVERY board save (stale files of vanished scenes are removed so the
// folder always mirrors the board), loadable back per chapter. The .prj
// stays the working truth; these files are the durable per-chapter store.
function sceneFileDir(project) {
  return path.join(core.projDir(project || core.getProject()), "scenes");
}
function sceneFileName(n, chapter) {
  const c = chars.slug(chapter || "").replace(/\s+/g, "_");
  return `${c || "main"}${n}.json`;
}
function writeSceneFiles(state, project) {
  try {
    const dir = sceneFileDir(project);
    fs.mkdirSync(dir, { recursive: true });
    const keep = new Set();
    const shots = ((state.plan || {}).shots) || [];
    (state.list || []).forEach((r) => {
      const shot = shots.find((sh) => String(sh && sh.id) === String(r.id)) || {};
      const name = sceneFileName(r.n, r.chapter);
      keep.add(name);
      fs.writeFileSync(path.join(dir, name), JSON.stringify({
        n: r.n, id: r.id, chapter: r.chapter || "",
        prompt: r.prompt || [], length: r.length, seed: r.seed,
        prompt_prefix: (state.plan || {}).prompt_prefix || [],
      }, null, 2), "utf8");
    });
    for (const f of fs.readdirSync(dir)) {
      if (/\.json$/.test(f) && !keep.has(f)) fs.unlinkSync(path.join(dir, f));
    }
  } catch { /* the mirror never breaks a save */ }
}
/** Read a chapter's scene files back, ordered by n. "" reads main*.json. */
function readSceneFiles(project, chapter) {
  const dir = sceneFileDir(project);
  const c = chars.slug(chapter || "").replace(/\s+/g, "_") || "main";
  const out = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      const m = new RegExp(`^${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)\\.json$`).exec(f);
      if (!m) continue;
      try {
        const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
        out.push({ ...d, n: parseInt(m[1], 10) });
      } catch { /* one bad file never sinks the load */ }
    }
  } catch { /* no folder yet */ }
  return out.sort((a, b) => a.n - b.n);
}

// ---- naming --------------------------------------------------------------
/**
 * `scene<n>_<chapter>` — the name a rendered scene is saved under. The
 * chapter is user text and becomes part of a filename, so it goes through
 * THE slugger (lib/characters.js:slug — reuse, never a second one). A blank
 * chapter is just `scene<n>`; the extension is the caller's, because the
 * scene does not know what format the render came out as.
 */
function fileName(n, chapter) {
  const c = chars.slug(chapter || "").replace(/\s+/g, "_");
  return `scene${parseInt(n, 10) || 0}` + (c ? `_${c}` : "");
}

/** 2.307.0 (Tim: "after a scene renders, change the play button to redo,
 *  rerun the render as scene_n_x"): the file name for a NEW take of scene
 *  n in `dir`. The first take keeps its scene name (scene<n>[_chapter]);
 *  every take after it is scene_<n>_<x>, x = one past the highest take
 *  number already there (the first take counts as 1), so a deleted take's
 *  number is never reused while a later one exists. */
function takeName(dir, n, chapter, ext) {
  ext = ext || ".mp4";
  const base = fileName(n, chapter) + ext;
  if (!fs.existsSync(path.join(dir, base))) return base;
  const k = parseInt(n, 10) || 0;
  const re = new RegExp(`^scene_${k}_(\\d+)\\.[^.]+$`);
  let x = 1;
  try {
    for (const f of fs.readdirSync(dir)) {
      const m = re.exec(f);
      if (m) x = Math.max(x, parseInt(m[1], 10));
    }
  } catch { /* an unreadable folder: start after the first take */ }
  for (let i = x + 1; i < x + 1000; i++) {
    const cand = `scene_${k}_${i}${ext}`;
    if (!fs.existsSync(path.join(dir, cand))) return cand;
  }
  return null;
}

// ---- deriving scenes from the plan ---------------------------------------
/**
 * plan_json.shots -> scene records, carrying render state over from `prev`
 * BY SHOT ID (the id is the stable handle; `n` renumbers when shots are
 * inserted). A shot whose id is new starts idle; a shot that vanished takes
 * its record with it — the plan is the truth. Prompt/length/seed always come
 * from the PLAN (a re-derive after an edit must show the edited prompt); a
 * carried record whose prompt changed drops back from rendered/kept to idle
 * with its old output still attached, because the preview of the old take is
 * still worth showing while the new one renders.
 */
function fromPlan(plan, prev, now) {
  /* 2.358.0: a plan that knows nothing of the board's BRIDGE scenes (the writer writes the song's
     segments only) gets them woven back in, each after the content scene it follows (lib/sceneBridge) */
  { const shots0 = Array.isArray(plan && plan.shots) ? plan.shots : null;
    const bridges = (safe(prev).list || []).filter((r) => r.bridge);
    if (shots0 && bridges.length && !shots0.some((x) => x && x.bridge))
      plan = { ...plan, shots: require("./sceneBridge").weave(shots0, bridges) }; }
  const old = new Map((safe(prev).list || []).map((r) => [r.id, r]));
  const t = (now || new Date()).toISOString();
  const shots = Array.isArray(plan && plan.shots) ? plan.shots : [];
  const oldIdOfN = new Map((safe(prev).list || []).map((r) => [r.n, r.id]));
  const newNOfId = new Map(shots.filter((x) => x && typeof x === "object")
    .map((x, i) => [String(x.id || `clip_${String(i + 1).padStart(2, "0")}`), i + 1]));
  const remapN = (n) => {
    const id = oldIdOfN.get(n);
    return id !== undefined && newNOfId.has(id) ? newNOfId.get(id) : undefined;
  };
  const list = shots.filter((s) => s && typeof s === "object").map((s, i) => {
    const id = String(s.id || `clip_${String(i + 1).padStart(2, "0")}`);
    const o = old.get(id);
    const prompt = Array.isArray(s.prompt) ? s.prompt.map(String) : [String(s.prompt || "")];
    // a different DURATION is a different render too (2.153.0) — but only
    // when both sides actually carry a length, so boards saved before
    // records had one do not reset every scene on their first plan write
    const sameLen = !o || o.length === undefined || !Number.isFinite(s.length)
                 || o.length === s.length;
    const same = o && JSON.stringify(o.prompt) === JSON.stringify(prompt) && sameLen;
    return {
      n: i + 1, id,
      chapter: o ? o.chapter : "",
      prompt,
      length: Number.isFinite(s.length) ? s.length : undefined,
      seed: s.seed === undefined || s.seed === null ? "" : String(s.seed),
      status: o ? (same ? o.status : "idle") : "idle",
      output: o ? o.output : "",
      upscaled: o && same ? o.upscaled : "",
      job: o && same ? o.job : "",
      upjob: o && same ? o.upjob : "",
      updated: o && same ? o.updated : t,
      /* 2.288.0: the audio-trim window, the anchor choice and a picked
         continuation frame are the USER'S settings on the scene - a plan
         rewrite (the writer, an edit) never wipes them. */
      audio_start: o && o.audio_start !== undefined ? o.audio_start
        : (Number.isFinite(s.audio_start) ? s.audio_start : undefined),
      audio_dur: o && o.audio_dur !== undefined ? o.audio_dur
        : (Number.isFinite(s.audio_dur) ? s.audio_dur
          // 2.323.0: a screenplay scene's own seconds (no song) are its Duration
          : (Number.isFinite(Number(s.seconds)) && Number(s.seconds) > 0 && !safe(prev).audio
            ? Math.max(1, Math.min(60, Number(s.seconds))) : undefined)),
      anchor: o && o.anchor ? o.anchor : (s.anchor || undefined),
      // 2.297.0: cont_src names a scene NUMBER - an insert or a delete
      // renumbers, so it is remapped through the source row's stable id
      cont_src: o && Number.isFinite(o.cont_src) ? remapN(o.cont_src) : undefined,
      cont_time: o ? o.cont_time : undefined,
      // 2.291.0: the timeline flag rides with the take it describes
      tl_pending: o ? o.tl_pending : undefined,
      tl_start: o ? o.tl_start : undefined,
      tl_dur: o ? o.tl_dur : undefined,
      tl_from: o ? o.tl_from : undefined,
      // 2.295.0: the scene's own pictures are the USER'S - a rewrite keeps them
      refs: o ? o.refs : undefined,
      fl_first: o ? o.fl_first : undefined,
      trim_first: o && o.trim_first === true ? true : undefined,   // 2.302.0
      fl_last: o ? o.fl_last : undefined,
      motion: o ? o.motion : undefined,      // 2.352.0: the H3_Viggle motion video is the user's
      qedit: o ? o.qedit : undefined,        // 2.337.0: the ✎ First frame picks are the user's
      bridge: s.bridge ? s.bridge : (o ? o.bridge : undefined),   // 2.358.0: the bridge rides its shot
      // 2.384.0: the card's own seed is the USER'S; the last take's seed / time / metadata ride with that take
      user_seed: o ? o.user_seed : undefined,
      seed_used: o && same ? o.seed_used : undefined,
      render_seconds: o && same ? o.render_seconds : undefined,
      meta: o && same ? o.meta : undefined,
    };
  });
  return { chapters: safe(prev).chapters, list,
           audio: safe(prev).audio,       // 2.288.0: the board's song survives too
           seg_song: safe(prev).seg_song, // 2.289.0: so does the staged map's song
           auto_render: safe(prev).auto_render, // 2.293.0: and the ▶-as-written switch
           seg_gap: safe(prev).seg_gap,         // 2.358.0: and the strip's transition gap
           scene_count: safe(prev).scene_count, // 2.323.0: and the Scenes field
           // the render queue survives a plan edit; an entry for a DELETED
           // shot is dropped (its id no longer names anything renderable)
           pending: safe(prev).pending.filter((id) => list.some((r) => r.id === id)),
           style: safe(prev).style,        // 2.223.16: so does the style pick
           plan: plan && Array.isArray(plan.shots) ? plan : safe(prev).plan };
}

// ---- transitions (all idempotent, all never-throw) -----------------------
function at(state, n) {
  return (state.list || []).find((r) => r.n === parseInt(n, 10)) || null;
}

/** A chapter name is user text; slugged once here, deduped, order kept. */
function addChapter(state, name) {
  const s = safe(state);
  const c = chars.slug(name).replace(/\s+/g, " ");
  if (c && !s.chapters.includes(c)) s.chapters.push(c);
  return { state: s, chapter: c || null };
}

function setChapter(state, n, chapter) {
  const s = safe(state);
  const r = at(s, n);
  if (!r) return { state: s, changed: false };
  const c = chars.slug(chapter || "");
  const changed = r.chapter !== c;
  r.chapter = c;
  if (c && !s.chapters.includes(c)) s.chapters.push(c);
  return { state: s, changed };
}

/** Generate pressed: running, with the queue's job id attached. */
function starting(state, n, jobId, now) {
  const s = safe(state);
  const r = at(s, n);
  if (!r) return { state: s, changed: false };
  r.status = "running"; r.job = String(jobId || ""); r.error = "";
  r.updated = (now || new Date()).toISOString();
  return { state: s, changed: true };
}

/** The render finished: record the output, keep `kept` if it already was. */
function rendered(state, n, output, now, hasAudio) {
  const s = safe(state);
  const r = at(s, n);
  if (!r) return { state: s, changed: false };
  const changed = r.status === "running" || r.output !== String(output || "");
  r.output = String(output || "");
  // audio presence, PROBED not presumed (2.161.0): true/false when ffprobe
  // answered, absent when it could not — the badge only accuses a file of
  // silence on a real probe
  if (hasAudio === true || hasAudio === false) r.audio = hasAudio;
  else delete r.audio;
  if (r.status !== "kept") r.status = "rendered";
  r.job = ""; r.error = "";
  if (changed) r.updated = (now || new Date()).toISOString();
  return { state: s, changed };
}

/**
 * KEEP marks the take and is IDEMPOTENT — the handover trap is "pressing keep
 * twice must not upscale twice", so the caller launches the upscale only when
 * `changed` is true. Keeping a scene that has not rendered is refused rather
 * than marking a take that does not exist.
 */
function keep(state, n, now) {
  const s = safe(state);
  const r = at(s, n);
  if (!r || !r.output || r.status === "running")
    return { state: s, changed: false, error: r ? "nothing rendered to keep" : "no such scene" };
  if (r.status === "kept") return { state: s, changed: false };
  r.status = "kept"; r.updated = (now || new Date()).toISOString();
  return { state: s, changed: true };
}

/**
 * A render FAILED: back to idle like redo, but the reason STAYS ON THE CARD —
 * "it doesn't render" with no explanation cost a whole debugging round; the
 * board must show the worker's last words, not shrug.
 */
function failed(state, n, reason, now) {
  const s = safe(state);
  const r = at(s, n);
  if (!r) return { state: s, changed: false };
  r.status = r.status === "kept" ? "kept" : "idle";
  r.job = ""; r.upjob = "";
  r.error = String(reason || "the render failed — see the queue log");
  r.updated = (now || new Date()).toISOString();
  return { state: s, changed: true };
}

/** REDO drops back to idle but the last take stays attached for the preview. */
function redo(state, n, now) {
  const s = safe(state);
  const r = at(s, n);
  if (!r) return { state: s, changed: false, error: "no such scene" };
  if (r.status === "idle" && !r.job) return { state: s, changed: false };
  r.status = "idle"; r.job = ""; r.upjob = ""; r.upscaled = "";
  r.updated = (now || new Date()).toISOString();
  return { state: s, changed: true };
}

// ---- the upscale queue (2.140.0) -----------------------------------------
// The graph's upscale is an in-line resample stage, not a standalone video
// upscaler, so "upscale this scene" = re-render it through the SAME chain
// with the upscale stage LEFT IN and the same plan seeds — the base content
// reproduces and the upscale pass refines it. Fast renders strip the stage
// (worker._strip_upscale). One job at a time comes free: it is the one
// generate queue this app has.

/** Upscale queued: remember the job, leave the status alone — a kept scene
 *  stays kept while its upscale renders. Refused while a render runs. */
function upscaling(state, n, jobId, now) {
  const s = safe(state);
  const r = at(s, n);
  if (!r) return { state: s, changed: false, error: "no such scene" };
  if (!r.output) return { state: s, changed: false, error: "nothing rendered to upscale" };
  if (r.status === "running")
    return { state: s, changed: false, error: "this scene is still rendering" };
  r.upjob = String(jobId || "");
  r.updated = (now || new Date()).toISOString();
  return { state: s, changed: true };
}

/** The upscale job failed or vanished: forget it, keep everything else. */
function upscaleFailed(state, n, now) {
  const s = safe(state);
  const r = at(s, n);
  if (!r || !r.upjob) return { state: s, changed: false };
  r.upjob = ""; r.updated = (now || new Date()).toISOString();
  return { state: s, changed: true };
}

/**
 * A finished upscale becomes `scene<n>_<chapter>_upscaled<ext>` beside the
 * base take in Video assets (uniquified, never an overwrite). The status is
 * NOT touched: rendered stays rendered, kept stays kept — Produce simply
 * prefers `upscaled` when it exists (keptOutputs).
 */
function recordUpscale(state, n, srcAbs, project, now) {
  const autoAssets = require("./autoAssets");
  const s = safe(state);
  const r = at(s, n);
  if (!r || !srcAbs || !fs.existsSync(srcAbs)) return { state: s, name: null, changed: false };
  try {
    const dir = path.join(core.projDir(project || core.getProject()), "video");
    fs.mkdirSync(dir, { recursive: true });
    const name = autoAssets.freeName(dir,
      fileName(n, r.chapter) + "_upscaled" + path.extname(srcAbs));
    try { fs.linkSync(srcAbs, path.join(dir, name)); }
    catch { fs.copyFileSync(srcAbs, path.join(dir, name)); }
    r.upscaled = name; r.upjob = "";
    r.updated = (now || new Date()).toISOString();
    return { state: s, name, changed: true };
  } catch {
    r.upjob = ""; return { state: s, name: null, changed: false };
  }
}

/**
 * The reason a job died, from its log — for the scene card (2.142.6).
 * "worker exited with code 2" is the SHELL's shrug, never the reason: the
 * worker's convention is a "[worker] <reason>" line just before exit, and a
 * ComfyUI rejection prints "[comfy] rejected:" plus per-node culprit lines
 * just before THAT. Preference order: the node culprits (they name the exact
 * input), then the worker's verdict, then any error-ish line, then the last
 * line that is not the exit shrug. Prefixes are stripped for the card.
 */
function reasonFromLog(log) {
  const tail = (Array.isArray(log) ? log : []).map(String)
    .filter((l) => l.trim() && !/exited with code/i.test(l));
  const verdict = [...tail].reverse().find((l) => l.startsWith("[worker] "));
  const culprits = tail.filter((l) =>
    /^\[comfy\]\s+node |^\[comfy\] rejected:/.test(l)).slice(-2);
  // 2.153.0 (the H3 preflight card said "2 error(s), 2 warning(s)" and
  // nothing else): the worker now says the exception's ITEMIZED lines as
  // "[comfy]   <detail>" continuations under the culprit — put up to two of
  // them on the card, because a count without the items is not a reason.
  let details = [];
  if (culprits.length) {
    const li = tail.lastIndexOf(culprits[culprits.length - 1]);
    for (let i = li + 1; i < tail.length && details.length < 2; i++) {
      if (/^\[comfy\]   \S/.test(tail[i])) details.push(tail[i].replace(/^\[comfy\]\s+/, ""));
      else break;
    }
  }
  // 2.143.1: the worker's execution-error verdict now NAMES the failing node
  // itself; when a culprit line already carries that node id, appending the
  // verdict would say the same thing twice on a 400-char card.
  const dup = !!verdict && culprits.some((c) => {
    const m = /node (\S+)/.exec(c);
    return m && verdict.includes(`node ${m[1]} `);
  });
  let why = culprits.length
    ? culprits.concat(details).concat(verdict && !dup ? [verdict] : []).join(" · ")
    : verdict
    || [...tail].reverse().find((l) =>
        /error|failed|traceback|refused|missing|cannot|invalid|not found|not reachable|rejected|timed out|no .* found/i.test(l))
    || tail.slice(-1)[0] || "";
  return String(why).replace(/\[worker\] /g, "").replace(/\[comfy\]\s*/g, "")
    .slice(0, 600) || "the render failed — see the queue log";
}

/** The scenes worth putting in the film, in order — what Produce joins. */
/** EVERY rendered take in scene order — Compile's list (2.150.0): the whole
 *  loaded movie, not just the kept scenes. Upscaled preferred, as ever. */
function allOutputs(state) {
  return safe(state).list.filter((r) => r.output)
    .sort((a, b) => a.n - b.n)
    .map((r) => ({ n: r.n, name: r.upscaled || r.output }));
}

function keptOutputs(state) {
  return safe(state).list.filter((r) => r.status === "kept" && r.output)
    .sort((a, b) => a.n - b.n)
    .map((r) => ({ n: r.n, name: r.upscaled || r.output }));
}

/**
 * A finished render becomes `scene<n>_<chapter><ext>` in the project's VIDEO
 * assets — the folder the gallery, the reference dock and the timeline all
 * address by name, which is why the scene goes there rather than staying an
 * output. Hard link first (autoAssets' rule), copy across volumes; the name
 * is uniquified with autoAssets.freeName so a redo's second take never
 * overwrites the first. Returns the name the take actually got, or null —
 * never throws, because losing the naming must not lose the render.
 */
function recordRender(state, n, srcAbs, project, now) {
  const autoAssets = require("./autoAssets");
  const r = at(safe(state), n);
  if (!r || !srcAbs || !fs.existsSync(srcAbs)) return { state: safe(state), name: null, changed: false };
  try {
    const dir = path.join(core.projDir(project || core.getProject()), "video");
    fs.mkdirSync(dir, { recursive: true });
    // 2.307.0: a second take is scene_<n>_<x>, never "scene<n> (2)"
    const name = takeName(dir, n, r.chapter, path.extname(srcAbs))
      || autoAssets.freeName(dir, fileName(n, r.chapter) + path.extname(srcAbs));
    try { fs.linkSync(srcAbs, path.join(dir, name)); }
    catch { fs.copyFileSync(srcAbs, path.join(dir, name)); }
    // 2.301.0: the take's LOSSLESS master follows it to its scene name
    // (raw/<worker output>.avi -> raw/<scene take>.avi)
    try { require("./rawMaster").adopt(project, path.basename(srcAbs), name); }
    catch { /* no master - the take is complete without one */ }
    // audio is PROBED at harvest (2.161.0, "the sound doesn't work"): a take
    // with no audio stream must wear it on its badge, or a graph problem
    // masquerades as a speaker problem
    const hasA = core.probeAudio ? core.probeAudio(path.join(dir, name)) : null;
    return { ...rendered(state, n, name, now, hasA), name };
  } catch { return { ...rendered(state, n, path.basename(srcAbs), now), name: null }; }
}

/**
 * RENDER SELECTED (2.149.0, by instruction). Append the picked scenes to the
 * render queue as record IDS, in the given order — a scene already rendering
 * or already queued is skipped, never doubled. The route starts the first
 * job; syncJobs shifts the next id off `pending` each time the board has no
 * live render, so the tmp graph (rewritten per scene at queue time) is only
 * ever written for the ONE scene about to run.
 */
/** The chain overrides every scene render/normalize uses (2.223.2, by
 * instruction: "in video docker i set duration to 15 seconds but every scene
 * in the queue is getting shorter, can we make all the scenes 15 seconds?").
 * The Video docker's Seconds field is the everyday duration knob and it
 * already persists in the PROJECT STATE (gen.seconds, saved with 💾), so
 * scene rendering reads it as the uniform scene length — the docker and the
 * scene queue can no longer disagree. PRECEDENCE: an explicit Basic
 * Settings → Character chain "Length (frames)" still wins (the
 * frames-precise power knob — its title says so); then the docker's
 * Seconds; then the export default. normalize() snaps whatever this returns
 * to the pack's own 17k+5 grid. Applied at NORMALIZE time, so an EXISTING
 * queue re-renders at the docker's duration without touching one record. */
function chainOverrides(project) {
  const chain = { ...(core.getConfig().chain || {}) };
  if (chain.length !== undefined && chain.length !== null
      && String(chain.length).trim() !== "") return chain;
  try {
    const st = JSON.parse(fs.readFileSync(core.prjPath(project || core.getProject()), "utf8")) || {};
    const secs = parseFloat(st.gen && st.gen.seconds);
    if (Number.isFinite(secs) && secs > 0)
      chain.length = Math.max(5, Math.round(secs * 24));   // 24 = the app's FPS
  } catch { /* no saved project state yet — the export default applies */ }
  return chain;
}

function queueRenders(s, ns) {
  const errors = [], ids = [], seen = new Set(s.pending || []);
  for (const n of (Array.isArray(ns) ? ns : [])) {
    const r = at(s, n);
    if (!r) { errors.push(`no scene ${n}`); continue; }
    if (r.job) continue;               // already rendering — pressing ▶ twice is not two renders
    if (seen.has(r.id)) continue;      // already queued — same rule
    seen.add(r.id);
    ids.push(r.id);
  }
  // 2.358.0: a BRIDGE renders from the takes on both sides of it - picked with them, it queues after them
  const isB = (id) => !!((s.list || []).find((x) => x.id === id) || {}).bridge;
  ids.sort((a, b) => (isB(a) ? 1 : 0) - (isB(b) ? 1 : 0));
  const pending = (s.pending || []).concat(ids);
  return { state: { ...s, pending }, queued: ids, errors };
}

/** Pop the next queued id that still names a scene; {state, n:null} when empty. */
function shiftPending(s) {
  const p = [...(s.pending || [])];
  while (p.length) {
    const id = p.shift();
    const r = (s.list || []).find((x) => x.id === id);
    if (r) return { state: { ...s, pending: p }, n: r.n };
  }
  return { state: { ...s, pending: [] }, n: null };
}

module.exports = { ANCHORS, blank, safe, load, save, writeSceneFiles, readSceneFiles, sceneFileName, fileName, fromPlan, at,
                   queueRenders, shiftPending, chainOverrides,
                   addChapter, setChapter, starting, rendered, keep, redo, failed,
                   reasonFromLog,
                   upscaling, upscaleFailed, recordUpscale,
                   keptOutputs, allOutputs, recordRender, STATUSES, takeName };
