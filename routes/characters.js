// bitGen Studio — the endpoints behind the Video docker's character panel.
//
// Mounted from routes/index.js, never from server.js. lib/characters.js owns
// the disk layout and the reference-chain rebuild; this file is the HTTP skin
// over it plus the one thing that needs the network: uploading each character's
// sheet and voice to ComfyUI so the chain can name them.
const express = require("express");
const fs = require("fs");
const path = require("path");
const core = require("../lib/core");
const promptGuides = require("../lib/promptGuides");   // 2.275.0: writer addenda
const chars = require("../lib/characters");
const screenplay = require("../lib/screenplay");
const llmChat = require("../lib/llmChat");
const chatStore = require("../lib/chatStore");
const chatRecall = require("../lib/chatRecall");
const scenes = require("../lib/scenes");
const envs = require("../lib/environments");
// 2.299.0: the set locations ride the global prompt by @tag
const locationPrefix = require("../lib/locationPrefix");
// 2.301.0: a take's lossless master (projects/<p>/raw/<take>.avi)
const rawMaster = require("../lib/rawMaster");
const styles = require("../lib/styles");
const framePlan = require("../lib/framePlan");
const tlspan = require("../lib/timelineSpan");
const timelines = require("../lib/timelines");
const chapterRefs = require("../lib/chapterRefs");
const sheetStyles = require("../lib/sheetStyles");   // 2.206.0: wraps imageRefs for the sheet path
const poseSheets = require("../lib/poseSheets");     // 2.207.0: B&W line-drawing pose templates
const clothing = require("../lib/clothing");         // 2.224.0: the scene-mention clothing resolver
const refmods = require("../lib/refmods");           // 2.225.0: H3 identity mods from the dataset
const imageSeed = require("../lib/imageSeed");
const tempLoras = require("../lib/tempLoras");
const renderSettings = require("../lib/renderSettings");   // 2.312.0: the video docker's ⚙
const h3Long = require("../lib/h3Long");                     // 2.503.0: Long video - one H3 run up to 30 s
const tailFrames = require("../lib/tailFrames");           // 2.313.0: the take's last 2 s as PNGs
const takeUpscale = require("../lib/takeUpscale");         // 2.315.0: ⏫ upscales the previewed take
const seedvr2 = require("../lib/seedvr2");                 // 2.400.0: ⏫ with the ⚙ Upscaler on SeedVR2 (video)
const sceneResume = require("../lib/sceneResume");         // 2.562.0: a job a restart took away comes back to its scene
const dlss5 = require("../lib/dlss5");                     // 2.504.0: ⏫ with the ⚙ Upscaler on DLSS 5
const sceneCount = require("../lib/sceneCount");           // 2.323.0: the Scenes field / scenes.txt
const movies = require("../lib/movies");
const comfy = require("../lib/comfy");
const extendVideo = require("../lib/extendVideo");
const trap = require("../lib/trap");
const stems = require("../lib/stems");   // 2.223.13: extend-video
const refMap = require("../lib/refMap");
const nativeAudio = require("../lib/nativeAudio");
const autoRender = require("../lib/autoRender");
const segBoard = require("../lib/segBoard");
const mvWriter = require("../lib/mvWriter");
const sceneRefs = require("../lib/sceneRefs");
const sceneEdit = require("../lib/sceneEdit");      // 2.337.0: ✎ First frame (Qwen 2.1)
const ltxScenes = require("../lib/ltxScenes");      // 2.338.0: the board's LTX 2.5 flow
const sceneLyrics = require("../lib/sceneLyrics");
const sceneBridge = require("../lib/sceneBridge");          // 2.358.0: bridge scenes between the song's segments  // 2.356.0: what is sung in each scene's window
const h3Viggle = require("../lib/h3Viggle");        // 2.352.0: the board's H3_Viggle flow
const sceneTiming = require("../lib/sceneTiming");
const projectMedia = require("../lib/projectMedia");
const sceneTimeline = require("../lib/sceneTimeline");   // 2.291.0: takes -> timeline dock   // 2.290.0: <Picture n>/<Audio n> for native ref2va

const TMP_STYLE = "MM3_Characters_tmp.json";
// 2.141.0: when Tim exports a dedicated upscale workflow under this name, the
// upscale queue drives IT instead of re-rendering through the chain. The
// scene's rendered take rides as the job's ref video, so a LoadVideo slot in
// the export receives it (the worker already assigns ref_videos to LoadVideo
// loaders). Absent the file, the 2.140.0 fallback re-renders with the
// upscale stage kept — nothing breaks while the export does not exist.
const UPSCALE_WF = "MM3_Characters_upscale.json";
const BASE_STYLE = "MM3_Characters.json";
/* 2.268.0: a SECOND chain style — MMH3_Music_Video renders through its
   OWN tmp, rebuilt from its own base the same way MM3_Characters does.
   The base is CONVERTED from the pack's UI export on first render (live
   /object_info supplies the widget names; they are never guessed). */
const CHAIN_STYLES = {
  MM3_Characters: { base: BASE_STYLE, tmp: "MM3_Characters_tmp.json" },
  MMH3_Music_Video: { base: "MMH3_Music_Video.json",
                      tmp: "MMH3_Music_Video_tmp.json",
                      ui: "MMH3_Music_Video.ui.json" },
};
function chainFor(styleName) {
  return CHAIN_STYLES[String(styleName || "")] || CHAIN_STYLES.MM3_Characters;
}
/** Make sure a chain style's API base exists — converting the shipped UI
 *  export through live ComfyUI when it does not. Only the render routes
 *  call this (they already guarantee ComfyUI is up). */
/* 2.282.0: styles that CONVERT on first render but stay VERBATIM — no cast-rebuilt tmp, no writePlan; the graph's own
   loaders and timeline state are the truth (the MM3H-Character-ref rule),
   only the ui→API conversion is ours. ensureChainBase serves them through
   this map before the chain table, at the same call sites. */
const CONVERT_STYLES = {
  /* 2.284.0 (Tim's pivot: "we use the app to co-ordinate the extended
     length videos ... use ref2va to start a scene, fl2va to continue")
     — the per-scene NATIVE-AUDIO lipsync workflow: one character
     reference, the scene's song segment locked into the H3 audio
     latent, one clip out. The timeline dock assembles; no loop chain. */
  /* 2.290.0 (Tim: "add 9 images and 3 audio files to the
     mmh3_native audio_mv workflow ... so we can use the characters and
     character sheets, locations, props, vehicles etc."): the export now
     carries NINE picture loaders and THREE audio loaders on its
     MiniMaxH3ReferenceToVideo (the core node's own 9/3 limits). board:
     the scene board renders THIS graph verbatim (queueScene) - before
     2.290 a board on this style silently fell through to the character
     chain. follow: the converted base is re-converted whenever the
     export changes (sidecar hash), so an install converted from the
     one-picture export picks up the new slots on its next ▶. */
  MMH3_NativeAudio_MV: {
    base: "MMH3_NativeAudio_MV.json", ui: "MMH3_NativeAudio_MV.ui.json",
    /* 2.292.0 (Tim: "can we use ref2va and fl2va in the mmh3 native audio
       workflow?"): the fl2va twin - MiniMaxH3ImageToVideo (first/last
       frame) into the SAME NativeAudioLock. Shipped in API format (no
       conversion); lib/nativeAudio.plan picks the graph per scene. */
    fl2va: "MMH3_NativeAudio_MV_fl2va.json",
    board: true, follow: true,
    packs: "ComfyUI-H3-NativeAudioLock (from the "
      + "MiniMax-H3-NativeAudio-MusicVideo-Workflow repo)" },
  /* OBVPM_Timeline REMOVED (2.291.0, Tim: "remove the ovpm timeline, we
     will use our timeline docker") - the export, its entry, the worker's
     compose-loader and pack cascade special cases and its legs are gone;
     a board still naming it renders through the character chain, and the
     styles store hides the name (lib/styles REMOVED_STYLES). */
};
/** The export's fingerprint - a converted base remembers which export it
 *  came from in <base>.src (2.290.0). 2.292.0: the CONVERTER's version is
 *  part of it - lib/graphToApi's widget walk was fixed (a linked widget's
 *  value shifted every later one: ref_image_size went out as '' and
 *  ComfyUI rejected the prompt), so every base converted by the old walk
 *  re-converts on its next ▶ even though the export itself is unchanged. */
const CONVERTER_VERSION = "2.292.0";
function uiHash(file) {
  try { return require("crypto").createHash("sha1")
    .update(fs.readFileSync(file)).update("|converter " + CONVERTER_VERSION)
    .digest("hex"); } catch { return ""; }
}
function baseIsCurrent(ch) {
  if (!fs.existsSync(wfPath(ch.base))) return false;
  if (!ch.follow || !fs.existsSync(wfPath(ch.ui))) return true;
  let seen = "";
  try { seen = fs.readFileSync(wfPath(ch.base) + ".src", "utf8").trim(); } catch {}
  return seen === uiHash(wfPath(ch.ui));
}
async function ensureChainBase(styleName) {
  const ch = CONVERT_STYLES[String(styleName || "")] || chainFor(styleName);
  if (!ch.ui || baseIsCurrent(ch)) return { ok: true };
  const src = wfPath(ch.ui);
  if (!fs.existsSync(src)) return { ok: false, error:
    `comfy_workflows/${ch.ui} is missing — restore it from the delivery zip` };
  let info;
  try { info = await comfy.objectInfo(); }
  catch (e) { return { ok: false, error:
    `ComfyUI's /object_info is unreachable, and that is where the Music Video `
    + `workflow's widget names come from (${e.message})` }; }
  let out;
  try {
    const graphToApi = require("../lib/graphToApi");
    out = graphToApi.convert(JSON.parse(fs.readFileSync(src, "utf8")), info);
  } catch (e) { return { ok: false, error: `conversion failed: ${e.message}` }; }
  if (!out.graph) return { ok: false, error:
    "ComfyUI does not know these node types, so the Music Video workflow "
    + "cannot be converted: " + (out.unknown || []).join(", ")
    + ". Install " + (ch.packs || "ComfyUI-MiniMaxH3-Contex-Loop and ComfyUI-KJNodes")
    + " (Manager → Install Missing Custom Nodes), restart ComfyUI, and render again." };
  fs.writeFileSync(wfPath(ch.base), JSON.stringify(out.graph, null, 2));
  try { fs.writeFileSync(wfPath(ch.base) + ".src", uiHash(src) + "\n"); } catch {}
  return { ok: true, converted: true, warnings: out.warnings || [] };
}

function wfPath(name) { return path.join(core.BASE, "comfy_workflows", name); }

/**
 * Build MM3_Characters_tmp.json from the current cast.
 *
 * `uploader(absPath)` returns the name ComfyUI knows the file by; pass null to
 * use the bare filename, which is what the tests and a dry run want. The tmp
 * file is a BUILD ARTIFACT: it is rewritten on every generate and must never be
 * hand-edited, because the next generate will silently overwrite the edit.
 */
async function buildTmpStyle(project, uploader) {
  const base = JSON.parse(fs.readFileSync(wfPath(BASE_STYLE), "utf8"));
  const cast = chars.cast(project);        // 2.216.0: the actors IN the scene
  const uploaded = new Map();
  if (uploader) {
    for (const c of cast) {
      for (const kind of ["images", "voices"]) {
        const f = (c[kind] || [])[0];
        if (!f) continue;
        const abs = path.join(chars.charDir(c.name, project), f);
        try { uploaded.set(`${c.name}/${f}`, await uploader(abs)); }
        catch (e) { uploaded.set(`${c.name}/${f}`, f); }
      }
    }
  }
  const resolve = (c, file) => uploaded.get(`${c.name}/${file}`) || file;
  const built = chars.buildChain(base, cast, resolve, undefined, project);
  fs.writeFileSync(wfPath(TMP_STYLE), JSON.stringify(built.graph, null, 2), "utf8");
  return { ...built, cast: cast.length, file: TMP_STYLE };
}

/**
 * Scene controls live on MiniMaxH3ChainLoopStart, whose real inputs are
 * `start_clip` and `scene_range` ("1:2"). Read off Tim's own working export -
 * not guessed. Redoing one scene is simply a range of that scene to itself.
 */
function applyScenes(graph, { start_clip, scene_range, redo_scene } = {}) {
  const notes = [];
  const ids = Object.keys(graph).filter(
    (k) => (graph[k] || {}).class_type === "MiniMaxH3ChainLoopStart");
  if (!ids.length) { notes.push("this workflow has no MiniMaxH3ChainLoopStart, so "
    + "scene selection does not apply to it"); return { graph, notes }; }
  const range = redo_scene ? `${redo_scene}:${redo_scene}` : scene_range;
  for (const id of ids) {
    const ins = graph[id].inputs || (graph[id].inputs = {});
    if (start_clip !== undefined && start_clip !== null && start_clip !== "")
      ins.start_clip = parseInt(start_clip, 10) || 1;
    if (range) ins.scene_range = String(range);
    notes.push(`scenes ${ins.scene_range || "all"} from clip ${ins.start_clip || 1}`
               + (redo_scene ? ` (redoing scene ${redo_scene})` : ""));
  }
  return { graph, notes };
}

/**
 * Keep MM3_Characters_tmp.json in step with the cast.
 *
 * The MM3_Characters style renders through the TMP file, so if it were only
 * written when someone pressed Build, a cast change would render the previous
 * cast - or, on a fresh install, nothing at all. Every mutation rebuilds it,
 * and mount() writes it once at startup so the style is never pointing at a
 * file that does not exist. Failures are logged, never thrown: a broken rebuild
 * must not take down the route that was doing something useful.
 */
/**
 * 2.224.0: the clothing entries ACTIVE at one board scene, across the cast —
 * the resolver's walk of the PLAN (mention selects, silence inherits, a new
 * mention replaces; per character, against their own entries). Returns
 * [{char, tag, type, file}] in a deterministic order both the chain builder
 * and the upload list spell identically. No plan (or no scene) = nothing.
 */
function activeClothing(project, sceneN) {
  try {
    const st = scenes.load(project);
    if (!st.plan) return [];
    return clothing.forScene(st.plan, sceneN, chars.cast(project), chars.tagOf);
  } catch { return []; }
}

function syncTmp(project, why, chapter, scene, styleName) {
  try {
    const ch = chainFor(styleName);
    if (!fs.existsSync(wfPath(ch.base))) {
      console.warn(`[characters] ${ch.base} does not exist yet (${why}) — `
        + "it is converted from the pack's UI export on first render");
      return null;
    }
    const base = JSON.parse(fs.readFileSync(wfPath(ch.base), "utf8"));
    const cast = chars.cast(project);      // 2.216.0: the actors IN the scene
    // 2.142.0: environments ride the same chain — each with a fresh view
    // projected from its 360 pano through its own camera (cached in
    // lib/environments; a missing pano is a named note, never a crash)
    const d = core.getConfig().defaults || {};
    const es = envs.list(project).map((e) => {
      const v = envs.extractView(e.name, project, { width: d.width, height: d.height });
      return { ...e, view: v.ok ? path.basename(v.view) : "" };
    });
    // 2.180.0: chapter reference images ride ONLY when the caller names a
    // chapter (a scene queue); cast-change rebuilds pass none — the tmp is
    // rebuilt again at queue time with the right chapter anyway
    const cr = chapter === undefined ? { refs: [], missing: [] }
      : chapterRefs.forChain(project, chapter, scene);
    // 2.224.0: clothing rides ONLY when the caller names the scene being
    // rendered (a scene queue) — the same per-queue scoping chapter refs
    // use; cast-change rebuilds pass none
    const cw = scene === undefined ? [] : activeClothing(project, scene);
    const r = chars.buildChain(base, cast, (c, f) => f, es, project, cr.refs, cw);
    if (r && cr.missing.length) r.notes.push(...cr.missing);
    fs.writeFileSync(wfPath(chainFor(styleName).tmp), JSON.stringify(r.graph, null, 2), "utf8");
    return r;
  } catch (e) {
    console.warn(`[characters] could not rebuild ${chainFor(styleName).tmp} (${why}): ${e.message}`);
    return null;
  }
}

// ---- THE SCENE BOARD (2.139.0) -------------------------------------------
// State lives in lib/scenes.js, persisted in the .prj; these are the HTTP
// skin plus the two things that need the rest of the app: the generate queue
// and the compile path. The PLAN is stored on the board because the tmp graph
// is rebuilt from the base style on every cast change — the graph cannot be
// the screenplay's home, so it is written back in before every scene render.

/** Where a finished job's file actually is, mirroring core.outputDirs(). */
function outputPath(name, project) {
  const root = core.projDir(project || core.getProject());
  for (const d of [path.join(root, "output"), path.join(root, "final"), root]) {
    const p = path.join(d, path.basename(name));
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Reconcile the board with the job queue: a running scene whose job finished
 * becomes `rendered` with the take linked into the project's Video assets as
 * `scene<n>_<chapter>` (so the gallery and the timeline can address it), and
 * a job that failed or vanished drops the scene back to idle rather than
 * showing "running" forever. Called from GET /api/scenes — the UI polls that.
 */
function syncJobs(project) {
  let st = scenes.load(project);
  let dirty = false;
  for (const r of [...st.list]) {
    if (r.job) {
      const job = core.jobs.get(r.job);
      if (!job || job.finished) {
        const src = job && job.status === "done" && job.output
          ? outputPath(job.output, project) : null;
        // a failure carries its REASON onto the card — the worker's verdict
        // and ComfyUI's per-node culprits, never the shell's "exited with
        // code 2" shrug (scenes.reasonFromLog, pinned in test-scenes)
        // 2.562.0: a job a restart took away - the scene keeps its id (row.lost) and says how to get it back; ↻ Resume
        // in the Queue docker hands it back to this scene (lib/sceneResume.relink) with its progress bar
        const why = job ? scenes.reasonFromLog(job.log)
                        : sceneResume.lost(st.list.find((x) => x.n === r.n) || r, "job", r.job, sceneResume.resumable(core.projDir(project || core.getProject()), r.job));
        try {
          if (src) {
            // 2.358.0: an AI bridge is fitted to its gap before it is filed (lib/sceneBridge.fit)
            if (job.params && job.params.bridge_fit) {
              const f = sceneBridge.fit(src, job.params.bridge_fit);
              try { job.log.push("[bitgen-studio] " + f.note); } catch {}
            }
            const rr = scenes.recordRender(st, r.n, src, project);
            st = rr.state;
            // 2.384.0: the seed the take used, its render time, its metadata (lib/sceneSeed)
            try { st = require("../lib/sceneSeed").harvest(project, st, r.n, job); } catch { /* the take is filed */ }
            // 2.313.0: the tail PNGs follow the take to its scene name
            if (rr.name) { try { tailFrames.adopt(project, st, r.n, path.basename(src), rr.name); } catch {} }
          } else st = scenes.failed(st, r.n, why).state;
          // 2.291.0 (Tim: "after each scene is generated add it to a new
          // video layer in our timeline docker at the start position set in
          // the video docker scene"): the fresh take is flagged for the page,
          // which owns the timeline and places it on a NEW video layer
          if (src) st = sceneTimeline.markRendered(st, r.n, project);
          // 2.373.0: 🎤 on -> the take's transparent karaoke overlay is queued (lib/karaoke; the take is untouched)
          if (src) { try { require("../lib/karaoke").onTake(project, st, r.n); } catch { /* never stall the board */ } }
          // 2.400.0: the ⚙ on SeedVR2 + "Upscale every render" -> the take's SeedVR2 job (the board saved first: it reloads)
          if (src && seedvr2.isUpscaler(renderSettings.read(core.projDir(project || core.getProject())))) {
            try { scenes.save(st, project); const q = seedvr2.onTake(project, r.n); if (q && q.job) st = scenes.load(project); }
            catch { /* never stall the board */ }
          }
          // 2.504.0: the same for the ⚙ on DLSS 5
          if (src && dlss5.isUpscaler(renderSettings.read(core.projDir(project || core.getProject())))) {
            try { scenes.save(st, project); const q = dlss5.onTake(project, r.n); if (q && q.job) st = scenes.load(project); }
            catch { /* never stall the board */ }
          }
        } catch (e) {
          // 2.308.0: a finished job ALWAYS leaves "running" - a harvest that
          // throws fails the scene in words rather than freezing it
          st = scenes.failed(st, r.n, `the take could not be filed: ${String(e && e.message || e).slice(0, 200)}`).state;
        }
        dirty = true;
      }
    }
    if (r.upjob) {
      const job = core.jobs.get(r.upjob);
      if (!job || job.finished) {
        const src = job && job.status === "done" && job.output
          ? outputPath(job.output, project) : null;
        if (!job) sceneResume.lost(st.list.find((x) => x.n === r.n) || r, "upjob", r.upjob, false);   // 2.562.0
        st = src ? scenes.recordUpscale(st, r.n, src, project).state
                 : scenes.upscaleFailed(st, r.n).state;
        dirty = true;
      }
    }
  }
  // 2.337.0: a finished ✎ First frame job (routes/sceneedit.js) files its
  // picture into the scene's First slot - the same poll that harvests takes
  try {
    if (sceneEdit.harvest(st.list, { jobs: core.jobs, outputPath: (nm) => outputPath(nm, project),
        setFirst: (row, src, label) => sceneRefs.setSlot(project, row, "first", src, label),
        reason: (job) => scenes.reasonFromLog(job.log),
        resumable: (id) => sceneResume.resumable(core.projDir(project || core.getProject()), id) })) dirty = true;
  } catch { /* a harvest problem must never stall the board */ }
  if (dirty) scenes.save(st, project);
  try { require("../lib/karaoke").harvest(project); } catch { /* 2.373.0: overlays filed beside the board */ }
  // RENDER QUEUE ADVANCE (2.149.0): when nothing is rendering and scenes are
  // queued, start the next one HERE — the poll that notices a finished job is
  // the same poll that launches its successor, so the tmp graph is only ever
  // rewritten for the one scene about to run (writing it at queue time for
  // several at once would race: last writer wins, every job renders it).
  const live = st.list.some((r) => {
    const j = r.job && core.jobs.get(r.job);
    return j && !j.finished;
  });
  if (!live && (st.pending || []).length) {
    const sh = scenes.shiftPending(st);
    scenes.save(sh.state, project);
    st = sh.state;
    if (sh.n != null) {
      // 2.308.0: a throw while queueing the next scene fails THAT scene in
      // words instead of stalling the queue
      let q;
      try { q = queueScene(project, sh.n, { upscale: false }); }
      catch (e) { q = { error: String(e && e.message || e).slice(0, 300) }; }
      st = scenes.load(project);           // queueScene saved `starting`
      if (q.error) {
        st = scenes.failed(st, sh.n, `queued render refused: ${q.error}`).state;
        scenes.save(st, project);
      }
    }
  }
  return st;
}

/**
 * Queue ONE scene through the existing generate queue: the tmp graph, the
 * stored plan written back in, and `scene_range` set to n:n — exactly what
 * applyScenes already does; there is no second path. The cast's sheets and
 * voices ride as the job's reference files IN CAST ORDER, the order
 * buildChain made the loaders in, so the worker's patcher fills the same
 * slots the chain expects instead of pruning them as unused.
 */
function queueScene(project, n, opts) {
  const upscale = !!(opts && opts.upscale);
  const st = scenes.load(project);
  const r = scenes.at(st, n);
  if (!r) return { status: 404, error: "no such scene" };
  const running = r.job && core.jobs.get(r.job);
  if (running && !running.finished)
    return { status: 409, error: `scene ${n} is already rendering` };
  if (upscale) {
    if (!r.output) return { status: 400, error:
      `scene ${n} has no rendered take to upscale — press ▶ first` };
    const uprunning = r.upjob && core.jobs.get(r.upjob);
    if (uprunning && !uprunning.finished)
      return { status: 409, error: `scene ${n} is already in the upscale queue` };
  }
  // 2.400.0 (Tim: "add seedvr2 for upscaling videos"): the ⚙ Upscaler on SeedVR2 (video) - the take itself goes
  // through ComfyUI's core SeedVR2 nodes as its own job (lib/seedvr2.queueTake); any style's take, no re-render
  if (upscale && seedvr2.isUpscaler(renderSettings.read(core.projDir(project || core.getProject()))))
    return seedvr2.queueTake(project, n);
  // 2.504.0: the ⚙ Upscaler on DLSS 5 - the take through RunningHub's DLSS 5 nodes as its own job (lib/dlss5)
  if (upscale && dlss5.isUpscaler(renderSettings.read(core.projDir(project || core.getProject()))))
    return dlss5.queueTake(project, n);
  const upExport = upscale && fs.existsSync(wfPath(UPSCALE_WF));
  if (!st.plan) return { status: 400, error:
    "write and apply a screenplay first — the board has no plan to render from" };
  // 2.227.0 (Tim verbatim): "remove the extend workflow, this workflow
  // needs a node that corrupts the other h3 nodes" — h3_video_extend.json
  // and queueExtend are GONE. H3_Video_Ref renders EVERY scene through the
  // native ref2va export; scene n>1 carries scene n-1's take in ref2va's
  // OWN video-reference slot (queueRefScene does the carry).
  /* 2.358.0 (Tim: "render segment 1 and 3 as ref for example and segment 2 as fl2va, first frame will be
     last frame of segment 1 and last frame will be first frame of segment 3. If user clicks transition then
     we can do standard transitions like wipe, fade, dissolve"): a BRIDGE scene (lib/sceneBridge) - a
     standard transition is drawn by bridge_worker.py (no model); an AI bridge is a First (fl2va) scene that
     ends on the scene after's first frame, through the native-audio board */
  let bridgeAi = null;
  if (r.bridge && !upscale) {
    if (r.bridge.type !== sceneBridge.AI) return sceneBridge.queue(project, st, r);
    if (st.style !== "MMH3_NativeAudio_MV")
      return { status: 400, error: `bridge scene ${r.n} is AI (fl2va) - that renders through the MMH3_NativeAudio_MV `
        + "board; pick a standard transition (fade, wipe, ...) on its card for this Workflow" };
    bridgeAi = sceneBridge.aiLast(st, r);
    if (bridgeAi.error) return { status: 409, error: bridgeAi.error };
    r.anchor = "first"; r.cont_src = undefined; r.cont_time = undefined;
  }
  if (!upscale && extendVideo.isRefFlow(st.style))   // 2.573.0: + FastH3 Omni
    return queueRefScene(project, st, r);
  // 2.338.0: the board's Workflow "LTX 2.5" - every scene one LTX clip
  if (ltxScenes.isLtxFlow(st.style)) {
    if (upscale) return { status: 400, error: "⏫ upscales H3 takes - an LTX 2.5 take renders at its size (the canvas has its own x2 latent upscaler)" };
    return queueLtxScene(project, st, r);
  }
  // 2.352.0: the board's Workflow "H3_Viggle" - each scene's 🎬 motion video, performed
  if (h3Viggle.isViggleFlow(st.style)) {
    if (upscale) return { status: 400, error: "⏫ upscales H3 takes - an H3_Viggle take renders at its size" };
    return h3Viggle.queue(project, st, r);
  }
  // 2.268.0: the board's style names WHICH chain renders — MM3_Characters
  // or MMH3_Music_Video, each through its own base + tmp pair
  const chainName = CHAIN_STYLES[st.style] ? st.style : "MM3_Characters";
  const ch = chainFor(chainName);
  /* 2.290.0: a BOARD convert style (MMH3_NativeAudio_MV) renders ITS OWN
     converted graph, verbatim - no cast-rebuilt tmp, no writePlan. Before
     this the board fell through to the character chain whatever the
     Workflow picker said. */
  const convName = (CONVERT_STYLES[st.style] || {}).board ? st.style : "";
  const conv = convName ? CONVERT_STYLES[convName] : null;
  const styleName = convName || chainName;
  let style = styles.read(core.STYLES_DIR)
    .find((s) => s.kind === "video" && s.name === styleName);
  /* 2.284.0: chain/convert styles resolve BY NAME even when the styles
     store lacks them (starters retired; a new install loading an old
     board must still render it) - the chain path overrides the workflow
     anyway, so a minimal synthesized entry is the honest fallback. */
  if (!style && (CHAIN_STYLES[styleName] || CONVERT_STYLES[styleName]))
    style = { name: styleName, kind: "video", arch: "minimax-h3",
              workflows: CONVERT_STYLES[styleName]
                ? { ref2va: "comfy_workflows/" + CONVERT_STYLES[styleName].base }
                : {} };
  if (!style) return { status: 400, error: `the ${styleName} video style is missing` };
  /* 2.315.0 (Tim: "does it upscale automatically or do i need to press the
     upscale button in the scene. i would prefer to press the button so i
     can preview the scene"): on a board convert style (one clip per scene)
     ⏫ upscales THE TAKE on disk with the ⚙'s upscaler - the scene's own
     graph with the MMH3 stage reading the take (lib/takeUpscale,
     scripts/upscalestage.from_take), never a new sample. The character
     chain keeps its 2.140 re-render; a dedicated upscale export still wins. */
  let takeUp = null;
  if (upscale && !upExport && convName) {
    const pdir = core.projDir(project || core.getProject());
    const src = takeUpscale.source(pdir, r.output);
    const tp = takeUpscale.plan(renderSettings.read(pdir), src, src && takeUpscale.probeSize(src.file));
    if (tp.error) return { status: 400, error: `scene ${n}: ${tp.error}` };
    takeUp = { file: src.file, stage: tp.stage, note: tp.note };
  }
  const needBase = conv || ch;
  if (needBase.ui && !fs.existsSync(wfPath(needBase.base))) return { status: 503, error:
    `${needBase.base} has not been converted yet — press ▶ again with ComfyUI `
    + "running (the render route converts the pack's UI export through "
    + "/object_info on first use)" };
  // the converted base is the ONLY graph a board convert style has - both
  // modes pin to it (the anchor radio's fl2va lands in the same graph)
  // 2.292.0: a convert style with an fl2va twin (MMH3_NativeAudio_MV_fl2va)
  // pins fl2va to it; the queue mode below chooses which one runs
  const convFl = conv && conv.fl2va && fs.existsSync(wfPath(conv.fl2va))
    ? conv.fl2va : (conv ? conv.base : "");
  if (conv) style = { ...style, workflow: "comfy_workflows/" + conv.base,
                      workflows: { ref2va: "comfy_workflows/" + conv.base,
                                   fl2va: "comfy_workflows/" + convFl } };
  // 2.200.0 (Tim: "is it possible to add multiple loras to our
  // character_ref_tmp workflow from our basic settings (left docker) ref
  // tab?") — YES, and now they DO: the Basic Settings VIDEO temp LoRAs
  // (2.111.0, up to 12 with weights) merge into the chain style here, the
  // same merge every plain video render gets, and worker.py's
  // apply_video_style hangs them off phase 1's model loader
  // (LoraLoaderModelOnly chain, "lora N: <path> @ <w>" in the job log).
  // The style FILE never changes; remove them in Basic Settings and the
  // next render is clean.
  const extraV = tempLoras.read(core.projDir(project || core.getProject()), "video");
  const styled = extraV.length
    ? { ...style, loras: tempLoras.merge(style.loras, extraV) } : style;
  const cast = chars.cast(project);        // 2.216.0: the actors IN the scene
  let notes = [];
  if (!upExport && !convName) {
    // the chain path: rebuild tmp from the live cast, write the stored plan
    // back in, select this scene. (For an upscale WITHOUT an export this is
    // the 2.140.0 fallback: same chain, upscale stage kept, same plan seeds.)
    // 2.180.0: the rendered scene's CHAPTER rides into the rebuild, so the
    // tmp carries exactly that chapter's reference images
    syncTmp(project, `scene ${n} ${upscale ? "upscale" : "generate"}`, r.chapter || "", n, chainName);
    let g;
    try { g = JSON.parse(fs.readFileSync(wfPath(ch.tmp), "utf8")); }
    catch (e) { return { status: 500, error: `cannot read ${ch.tmp}: ${e.message}` }; }
    // NORMALIZE AT QUEUE TIME TOO (2.173.0): the full-render path already
    // normalizes before the graph, but this single-scene path wrote the
    // stored plan RAW — a board saved with a bad source_reference (or a
    // pre-2.171.0 mixed-length board) kept dying at ChainPlan on every ▶
    // until some edit re-normalized it. The store heals on the next edit
    // write; the tmp is derived and derives repaired. Idempotent on a
    // clean plan (seeds and prompts untouched).
    const qplan = screenplay.normalize(
      JSON.parse(JSON.stringify(st.plan)), scenes.chainOverrides(project));
    const w = screenplay.writePlan(g, qplan, scenes.chainOverrides(project));
    const scened = applyScenes(w.graph, { redo_scene: n });
    fs.writeFileSync(wfPath(ch.tmp), JSON.stringify(scened.graph, null, 2), "utf8");
    notes = w.notes.concat(scened.notes);
    if (upscale) notes.push(`no ${UPSCALE_WF} — re-rendering through the chain `
      + "with the upscale stage kept; export a dedicated upscale workflow "
      + `under that name to switch to direct upscaling of the take`);
  } else if (upExport) {
    notes.push(`upscaling through ${UPSCALE_WF} — the rendered take rides `
      + "into its LoadVideo slot as the job's reference video");
  }
  const referenceFiles = [], referenceNames = [], refAudios = [], refVideos = [];
  // 2.290.0: WHAT each reference is (tag, kind) beside the file - the
  // native reference map (lib/refMap) numbers them for the prompt
  const imgMeta = [], audMeta = [];
  const missing = [];
  const sheetless = [];        // 2.281.0: cast whose tag would alias to NOTHING
  for (const c of cast) {
    // ONE picture per character (2.168.0, by instruction — several sheets
    // are STITCHED into a composite; the pack must never see the same tag
    // twice) and EVERY voice (2.144.0, unchanged), in buildChain's own
    // loader order — the worker fills slots by insertion order, so this
    // list and the chain must be spelt from the same walk of the cast.
    const vs = c.voices || [];
    const pick = chars.referenceImage(c, project);
    const ctag = chars.tagOf(c.tag || c.name);
    if (pick) {
      referenceFiles.push(path.join(chars.charDir(c.name, project), pick));
      referenceNames.push(pick);
      imgMeta.push({ file: path.join(chars.charDir(c.name, project), pick), name: pick,
                     tag: ctag, kind: "sheet", label: c.name });
    } else { missing.push(`${c.name}: no sheet`);
              sheetless.push({ name: c.name, tag: ctag }); }
    for (const v of vs) {
      refAudios.push(path.join(chars.charDir(c.name, project), v));
      audMeta.push({ file: path.join(chars.charDir(c.name, project), v),
                     tag: `${ctag}_voice`, kind: "voice", label: c.name });
    }
  }
  /* 2.281.0 (Tim's field report: "ValueError: Prompt uses unknown scheduled
     reference tag @character" from the pack's own _replace_reference_aliases):
     validation proves a @tag EXISTS in the cast; it never proved the
     character has a SHEET. buildChain skips a sheetless character's picture
     reference with only a note, so the pack meets an aliased tag with
     nothing behind it and hard-fails mid-render. The refusal belongs HERE,
     in words, before ComfyUI: if THIS scene's prompt casts a sheetless
     character, name the character, the fix, and the voice truth (a voice
     clip is optional — lips sync to the scene's song segment). */
  {
    const text = (r.prompt || []).filter(Boolean).join("\n");
    const hit = sheetless.find((x) =>
      new RegExp("@" + x.tag + "(?![\\w-])", "i").test(text));
    if (hit && !upExport) return { status: 400, error:
      `scene ${n}'s prompt casts @${hit.tag}, but ${hit.name} has no `
      + "character sheet — the render pack refuses an aliased tag with no "
      + "picture reference behind it. Add a sheet for "
      + `${hit.name} in the Characters tab (a VOICE clip is optional: in a `
      + "music video the lips sync to the scene's 15-second song segment), "
      + `or drop @${hit.tag} from the prompt.` };
    /* 2.281.0, second door (the card-edit hole — /api/scenes/:n/prompt
       saves without tag validation, so an UNKNOWN tag typed on the card
       reached the pack's ValueError): any @tag in this scene's prompt
       that names nobody refuses here, in words, with the real tags. */
    if (!upExport) {
      const knownT = new Set();
      for (const c of cast) { const t = chars.tagOf(c.tag || c.name);
        knownT.add(t.toLowerCase()); knownT.add(t.toLowerCase() + "_voice"); }
      for (const e of envs.list(project)) if (e && e.tag)
        knownT.add(String(e.tag).toLowerCase());
      for (const t of chapterRefs.tags(project))
        knownT.add(String(t).toLowerCase());
      const rx = /(^|[^\w@])@([A-Za-z][\w-]*)/g;
      let m2;
      while ((m2 = rx.exec(text))) {
        if (!knownT.has(m2[2].toLowerCase())) return { status: 400, error:
          `scene ${n}'s prompt casts @${m2[2]}, and no character, environment `
          + "or chapter reference carries that tag — the render pack refuses "
          + "an unknown alias mid-render. Real tags: "
          + ([...knownT].filter((k) => !k.endsWith("_voice"))
              .map((k) => "@" + k).join(", ") || "none (create a character "
          + "with a sheet first)") + `. Fix the prompt or the tag.` };
      }
    }
  }
  // environments' extracted views ride AFTER the cast's sheets — the same
  // order buildChain appends their loaders in, so the slots line up
  for (const e of envs.list(project)) {
    const v = envs.extractView(e.name, project,
                               { width: core.getConfig().defaults.width,
                                 height: core.getConfig().defaults.height });
    if (v.ok) { referenceFiles.push(v.view); referenceNames.push(path.basename(v.view));
                imgMeta.push({ file: v.view, name: path.basename(v.view),
                               tag: chars.tagOf(e.tag || e.name), kind: "location",
                               label: e.name }); }
    else missing.push(v.error || `${e.name}: no environment view`);
  }
  // CHAPTER REFERENCE IMAGES ride LAST (2.180.0) — the same walk order as
  // buildChain's ref_img_* loaders, so the worker's insertion-order slot
  // fill lines up with the upload list
  if (!upExport) {
    // 2.270.0: the scene number rides in — scene-bound music-video segments
    // reach ONLY their own scene's queue
    const cr = chapterRefs.forChain(project, r.chapter || "", r.n);
    // 2.266.0: chapter SOUNDS ride the audio pool (after the cast's
    // voices — the same order buildChain emits ref_aud_* after
    // char_aud_*, so the worker's audio slot fill lines up); pictures
    // keep the image walk
    for (const x of cr.refs) {
      const xtag = chars.tagOf(x.tag || x.file);
      if (x.kind === "sound") {
        refAudios.push(x.path);
        audMeta.push({ file: x.path, tag: xtag, kind: "sound", label: x.file });
      } else {
        referenceFiles.push(x.path); referenceNames.push(x.file);
        imgMeta.push({ file: x.path, name: x.file, tag: xtag, kind: "reference",
                       label: x.file });
      }
    }
    missing.push(...cr.missing);
    // 2.268.0 (MMH3_Music_Video): the pack SOURCE-TRACK LoadAudio slot.
    // The worker fills audio loaders alpha-ids first (char_aud_*,
    // ref_aud_*) then numeric ids - the pack own LoadAudio is numeric
    // and fills LAST, so the song rides ONCE MORE at the end of the pool
    // for it. With no chapter sound the slot goes unfilled and the worker
    // PRUNES it: the model generates its own audio (the pack mode B).
    if (chainName === "MMH3_Music_Video") {
      // 2.270.0: the scene's OWN 15s segment outranks an unbound chapter
      // sound for the source-track slot - per-scene timing is the point
      const snd = cr.refs.find(function (x) { return x.kind === "sound" && x.scene; })
        || cr.refs.find(function (x) { return x.kind === "sound"; });
      if (snd) {
        refAudios.push(snd.path);
        notes.push("@music source track: " + snd.file + " rides the pack Load "
          + "Audio slot - the final assemble muxes the real song");
      } else {
        notes.push("no chapter SOUND reference - the source-track audio "
          + "slot is pruned and H3 generates the music (drop the song on "
          + "this chapter references to lock lyrics and timing)");
      }
    }
    // 2.224.0: CLOTHING rides last — the same rows syncTmp just built
    // wear_img_* loaders for, in the same order, so the worker's slot fill
    // lines up. Mention selects, silence inherits, a new mention replaces.
    for (const w of activeClothing(project, r.n)) {
      const wp = chars.clothingPath(w.char, w.file, project);
      if (fs.existsSync(wp)) { referenceFiles.push(wp); referenceNames.push(w.file);
        imgMeta.push({ file: wp, name: w.file, tag: chars.tagOf(w.tag || w.type),
                       kind: "clothing", label: `${w.char}: ${w.type}` }); }
      else missing.push(`${w.char}: clothing picture ${w.file} is missing from the dataset`);
    }
  }
  if (upExport) {
    const take = path.join(core.projDir(project || core.getProject()), "video",
                           path.basename(r.output));
    if (!fs.existsSync(take)) return { status: 400, error:
      `scene ${n}'s take (${r.output}) is no longer in the project's Video assets` };
    refVideos.push(take);
  }
  // the upscale export gets the SHOT's own seed so its conditioning matches
  // the take it is refining; the chain path keeps seeds in plan_json instead
  const shot = ((st.plan || {}).shots || []).find((s) => String(s.id) === r.id) || {};
  const shotSeed = parseInt(shot.seed, 10);
  /* 2.284.0 (Tim's pivot: "use ref2va to start a scene, fl2va to continue
     a scene, and ref2va to move to a different location or character"):
     visual_context_source - taught to the writer and validated for eras -
     finally drives the render. A shot naming its predecessor CONTINUES it:
     the previous scene's rendered take gives up its FINAL FRAME (ffmpeg
     from the tail), and that frame rides as the reference - mode fl2va
     when the style brings an fl2va graph, else ref2va with the frame as
     the sole anchor (same continuity, the style's own graph). A fresh
     scene keeps the sheets exactly as before. The app coordinates; no
     loop chain. */
  /* 2.288.0 (Tim's trim pivot: "we don't need to segment the file ...
     we enter each one into the trim audio duration node's start index
     and duration ... remove all the audio segments"): with a board song
     loaded, THE SONG is the audio reference for every scene (the graph's
     TrimAudioDuration cuts the window worker-side), and any chapter
     segment bindings are left out. The window: the row's own
     audio_start/audio_dur, else the scene's slot in the .seg map. */
  let audioWin = null, songPath = "";
  if (st.audio) {
    songPath = path.join(core.pDir("sound"), path.basename(st.audio));
    if (!fs.existsSync(songPath)) songPath = "";
    if (songPath) {
      refAudios.length = 0;
      /* 2.290.0: a PLAIN PATH - the worker uploads every ref audio by
         Path(x).name, and the 2.288 {file, name} object raised a
         TypeError there before a single node was filled. */
      refAudios.push(songPath);                     // the song (trimmed per scene)
      // the ONE window rule (lib/sceneTimeline.windowFor, 2.291.0 - the
      // timeline placement reads the same): the row's own start/duration,
      // else the scene's slot in the board song's .seg map
      const w0 = sceneTimeline.windowFor(st, n);
      if (w0.start !== null || w0.dur !== null)
        audioWin = { start: w0.start || 0, dur: w0.dur };
    }
  }
  let queueMode = "ref2va";
  let contFrame = null, contTake = null;
  // 2.315.0: a take upscale rebuilds the SAME inputs the take had (mode,
  // frame, references) - its conditioning drives the refine pass
  if (!upscale || takeUp) {
    const shot = ((st.plan || {}).shots || []).find((x) => x && x.id === r.id);
    let srcId = shot && shot.visual_context_source;
    /* 2.288.0: a FRAME PICKED on the filmstrip wins - the row's cont_src
       names the source scene and cont_time the exact second. The anchor
       radio says how the frame lands: reference (ref2va), first or last
       (fl2va when the style brings one). */
    let pickRow = null;
    if (Number.isFinite(r.cont_src) && Number.isFinite(r.cont_time)) {
      pickRow = (st.list || []).find((x) => x && x.n === r.cont_src);
      if (pickRow) srcId = pickRow.id;
    }
    /* 2.295.0 (Tim: "if user selects render all use the last frame of the
       previous scene"): a First / Trans scene with no picked frame and no
       writer-named source follows the scene BEFORE it - its last frame.
       The render queue is serial, so in a render-all that scene's take
       has landed by the time this one launches. */
    if (!srcId && ["first", "continue", "transition", "last"].includes(String(r.anchor || ""))) {
      const prev = (st.list || []).filter((x) => x && x.n < r.n)
        .sort((a, b) => b.n - a.n)[0];
      if (prev) srcId = prev.id;
    }
    if (srcId) {
      /* OPPORTUNISTIC, never a gate: boards render out of order (the
         render-selected flow queues 2 and 3 in parallel), so a source
         without a rendered take falls back to the sheets with a note -
         exactly the old behaviour - and only a source take actually on
         disk donates its final frame. Rows carry scene numbers; shots
         do not - the source resolves BY ID. */
      const srcRow = (st.list || []).find((x) => x && x.id === srcId);
      let contNote = "";
      const srcPath = srcRow && srcRow.output
        && ["rendered", "kept"].includes(srcRow.status)
        ? (path.isAbsolute(srcRow.output) ? srcRow.output
           : path.join(core.pDir("video"), path.basename(srcRow.output)))
        : "";
      if (srcPath && fs.existsSync(srcPath)) {
        const framePng = path.join(core.tempDir(),
          `scene${n}_continuation.png`);
        const seekArgs = pickRow && Number.isFinite(r.cont_time)
          ? ["-ss", String(Math.max(0, r.cont_time))]   // the PICKED frame
          : ["-sseof", "-0.2"];                          // the tail (default)
        /* 2.301.0 (Tim: "why am i losing quality with each scene rendered
           with a first/last image"): the frame - and the tail clip - come
           from the take's LOSSLESS master (projects/<p>/raw/<take>.avi)
           when it has one, never from the compressed playback mp4 */
        const srcMaster = rawMaster.forTake(srcPath);
        /* 2.313.0 (Tim: "save the last 2 seconds of the video as 1080p png,
           and use one of those frames to continue the video or first frame
           for next video, i am still losing a lot of quality when getting
           to scene 8"): the source take's TAIL PNGs (lib/tailFrames) - the
           last frame, or the picked one when it lies in those 2 s - beat
           a frame pulled from the video */
        const tailPng = tailFrames.pick(project, st, srcRow,
          pickRow && Number.isFinite(r.cont_time) ? r.cont_time : null);
        try { fs.rmSync(framePng, { force: true }); } catch {}
        if (tailPng) {
          try { fs.copyFileSync(tailPng.file, framePng); } catch (e) { /* falls to the video below */ }
        }
        if (!fs.existsSync(framePng)) try {
          require("child_process").execFileSync("ffmpeg",
            ["-y", ...seekArgs, "-i", srcMaster || srcPath, "-frames:v", "1",
             "-update", "1", framePng],
            { stdio: "ignore", timeout: 30000 });
        } catch (e) { /* tail seek can miss on very short clips */ }
        // 2.292.0: the source take itself - a ref2va (new location) scene
        // carries its END as <Video 1>, the transition reference
        contTake = { path: srcMaster || srcPath, n: srcRow.n, id: srcId };
        if (fs.existsSync(framePng)) {
          contFrame = { file: framePng, name: `continuation frame (${srcId})`,
                        kind: "frame", label: (pickRow
                          ? `scene ${pickRow.n} at ${Math.round((r.cont_time || 0) * 10) / 10}s`
                          : `the end of ${srcId}`) + " - keep its framing, identity and lighting" };
          referenceFiles.length = 0; referenceNames.length = 0;
          referenceFiles.push(framePng);
          referenceNames.push(`continuation frame (${srcId})`);
          const anch = String(r.anchor || "reference");
          // 2.296.0: Cont is a ref2va mode (the frame + the sheets)
          if (anch !== "reference" && anch !== "continue"
              && ((styled || {}).workflows || {}).fl2va) queueMode = "fl2va";
          contNote = (pickRow
            ? `continues ${srcId} from the picked frame `
              + `(${Math.round((r.cont_time || 0) * 10) / 10}s, as ${anch})`
            : `continues ${srcId} from its final frame`)
            + (tailPng ? ` (from its ${tailPng.width}x${tailPng.height} tail PNG ${tailPng.name}, ${tailPng.upscaler})`
               : srcMaster ? " (from its lossless master)" : " (from its mp4 - it has no lossless master)");
        } else contNote = `continuation frame extraction failed - `
          + `starting fresh from the sheets`;
      } else if (srcRow) contNote = `${srcId} has no rendered take yet - `
        + `starting fresh from the sheets (render it and redo scene ${n} `
        + "to continue from its final frame)";
      if (contNote) missing.push(contNote);
    }
  }
  /* 2.290.0 THE NATIVE REFERENCE MAP + 2.292.0 THE TWO MODES (Tim: "can
     we use ref2va and fl2va in the mmh3 native audio workflow? so our
     following scenes can follow from the frame we select in the scene
     before using fl2va, or if we change location to use ref2va for the
     new location and transition from the previous scene?"). The scene's
     anchor radio decides, lib/nativeAudio.plan does the deciding:
       Ref    ref2va - every sheet/location/prop/clothing as <Picture n>,
              the song window as <Audio 1>, the previous take's end as
              <Video 1> (the transition into the new location);
       First  fl2va - the clip starts on the picked (or tail) frame;
       Trans  fl2va - starts on that frame, ends on the new location still.
     Both graphs lock the board song's window (NativeAudioLock). */
  let jobPrompt = (r.prompt || []).filter(Boolean).join("\n") || `scene ${n}`;
  /* 2.323.0 (Tim: "if screenplay then there won't be a song, but i would
     still like to render with the nativeaudio workflow"): the song is
     OPTIONAL - without one the scene renders through the same native-audio
     graphs with the lock taken out (scripts/nosong.py): the model speaks
     the scene's lines in the characters' own voices */
  const noSong = !!(conv && convName === "MMH3_NativeAudio_MV" && !upExport && !songPath);
  if (conv && convName === "MMH3_NativeAudio_MV" && !upExport) {
    /* 2.294.0: the render-time safety net - a scene written before the
       music-video writer rules (or typed with the chain's syntax) loses its
       <d> dialogue markup and (S1) speaker IDs, and gains the singing line
       when it has none; the card keeps its text, the note says what went */
    /* 2.295.0 (Tim: "allow user to add reference images to each scene
       individually"): the scene's OWN pictures join right after the cast
       sheets - the user put them on THIS scene, so they outrank the
       chapter-wide pictures for the nine slots */
    const sr = sceneRefs.forRender(project, r);
    if (sr.refs.length) {
      const at = imgMeta.filter((x) => x.kind === "sheet").length;
      imgMeta.splice(at, 0, ...sr.refs.map((x) => ({ file: x.file, name: x.name, tag: "",
        kind: "scene", label: x.label })));
    }
    missing.push(...sr.missing);
    // 2.356.0: the song's timed transcript decides sung vs instrumental for THIS window (lib/sceneLyrics)
    const lyr = noSong ? null : sceneLyrics.forWindow(songPath, audioWin,
      path.join(core.projDir(project || core.getProject()), "transcripts"));
    const cl = mvWriter.cleanPrompt(jobPrompt, noSong ? "dialogue" : "song", cast.map((c) => chars.tagOf(c.tag || c.name)), lyr);
    if (cl.changes.length) {
      jobPrompt = cl.text;
      notes.push((noSong ? "cleaned for the native-audio render (the chain's markup -> spoken lines): "
        : "cleaned for the native-audio render (the song is the voice): ")
        + cl.changes.join(", "));
    }
    const naPrompt = jobPrompt;
    const p = nativeAudio.plan({
      anchor: r.anchor, prompt: jobPrompt, imgMeta, audMeta,
      song: songPath, window: audioWin, frame: contFrame, take: contTake,
      // 2.297.0: the scene's chosen first / last frame pictures
      flFirst: sceneRefs.slotFor(project, r, "first"),
      flLast: sceneRefs.slotFor(project, r, "last") || (bridgeAi ? bridgeAi.frame : null),
      tmpDir: core.tempDir(), n });
    referenceFiles.length = 0; referenceFiles.push(...p.files);
    referenceNames.length = 0; referenceNames.push(...p.names);
    refAudios.length = 0; refAudios.push(...p.audios);
    refVideos.length = 0; refVideos.push(...p.videos);
    jobPrompt = p.prompt;
    queueMode = p.mode;
    if (p.mode === "fl2va" && convFl === conv.base) missing.push(
      `comfy_workflows/${conv.fl2va} is missing - restore it from the `
      + "delivery zip (this scene renders through the ref2va graph instead)");
    if (p.mode === "fl2va" && convFl === conv.base) {
      // no twin on disk: the honest fallback is the ref2va plan
      const q = nativeAudio.plan({
        anchor: "reference", prompt: naPrompt,
        imgMeta: (contFrame ? [contFrame] : []).concat(imgMeta), audMeta,
        song: songPath, window: audioWin, frame: null, take: contTake,
        tmpDir: core.tempDir(), n });
      referenceFiles.length = 0; referenceFiles.push(...q.files);
      referenceNames.length = 0; referenceNames.push(...q.names);
      refAudios.length = 0; refAudios.push(...q.audios);
      refVideos.length = 0; refVideos.push(...q.videos);
      jobPrompt = q.prompt; queueMode = "ref2va";
      notes.push(...q.notes); missing.push(...q.missing);
    } else { notes.push(...p.notes); missing.push(...p.missing); }
  }
  const grid = framePlan.gridFor((core.getConfig().engine || {}).backend);
  const G = framePlan.GRIDS[grid];
  /* 2.503.0 (Tim: "the secret sauce workflow is meant to be able to do 25 sec video"): the ⚙ Long video (or a
     MiniMax H3 style with Long video on) lets ONE scene render up to 30 s (lib/h3Long) - not capped at 15 s */
  const longScene = h3Long.on({ ...(styled || {}), kind: "video",
    accel: { ...((styled || {}).accel || {}), ...(renderSettings.read(core.projDir(project || core.getProject())).long_run ? { long: "on" } : {}) } });
  const CEIL = h3Long.modelCeiling(grid, G.ceiling, longScene);
  if (longScene && grid === "17k5") notes.push(`Long video: one generation up to ${CEIL} frames (${(CEIL / 24).toFixed(2)} s)`);
  let frames = Math.min(CEIL,
    Math.max(1, parseInt(r.length, 10) || screenplay.DEFAULTS.length));
  /* 2.297.0 (Tim: "adjust the timing for all the scenes if the start time
     or duration changes for any scene"): on the native-audio board the
     clip is as long as its song window - a scene whose duration changed
     renders that many frames (snapped to the H3 grid, capped at the
     single-run ceiling), not the board's one default length */
  if (conv && convName === "MMH3_NativeAudio_MV" && !upExport && audioWin
      && Number.isFinite(audioWin.dur) && audioWin.dur > 0)
    frames = sceneTiming.framesFor(audioWin.dur, CEIL);
  /* 2.358.0: an AI bridge renders the H3 length that COVERS its gap (17n+5 frames, the next one up) over a
     song window that long, then is fitted to the gap exactly when it lands (sceneBridge.fit in syncJobs) */
  let bridgeFit = null;
  if (bridgeAi && audioWin && Number.isFinite(audioWin.dur) && audioWin.dur > 0) {
    frames = sceneBridge.framesFor(audioWin.dur, CEIL);
    bridgeFit = { seconds: audioWin.dur, song: songPath || "", start: audioWin.start || 0 };
    audioWin = { start: audioWin.start || 0, dur: Math.round(frames / 24 * 1000) / 1000 };
    notes.push(`bridge: ${frames} frames from scene ${bridgeAi.prev.n}'s last frame to scene ${bridgeAi.next.n}'s first `
      + `frame, fitted to its ${bridgeFit.seconds}s gap when it lands`);
  }
  /* 2.323.0: a screenplay scene (no song) is as long as ITS duration - the
     row's own Duration, else the seconds the writer gave it, else the
     board default. Never the chain's uniform / growing lengths. */
  if (noSong) {
    const sh2 = ((st.plan || {}).shots || []).find((x) => x && x.id === r.id) || {};
    const secs = [Number(r.audio_dur), Number(sh2.seconds)].find((x) => Number.isFinite(x) && x > 0);
    if (secs) {
      frames = sceneTiming.framesFor(secs, CEIL);
      notes.push(`no song: the scene runs ${Math.round(secs * 10) / 10}s (${frames} frames)`);
    }
  }
  /* 2.302.0 (Tim: "add a trim first frame checkbox ... right now if i use
     the last frame from the previous scene i am duplicating the frame so u
     can see the jump. i want to make the merge seamless. when trim first
     frame is checked, add an additional frame before render (to keep the
     same frame count) and remove the first frame of the video from the raw
     and compressed versions"): a scene that STARTS on a given frame (First
     / Cont / Trans - its first frame is that picture again) renders ONE
     more frame, its song window starts one frame (1/24 s) earlier so the
     lips stay on the song, and the worker drops that first frame (and its
     1/24 s of audio) from the master and the playback file: the same frame
     count as before, and no repeated frame at the join. */
  const trimHead = r.trim_first === true && !upscale
    && ["first", "continue", "transition", "last"].includes(String(r.anchor || ""));
  if (trimHead) {
    frames += 1;
    if (audioWin) {
      const back = Math.min(1 / 24, Math.max(0, audioWin.start || 0));
      audioWin = { start: (audioWin.start || 0) - back,
                   dur: Number.isFinite(audioWin.dur) ? audioWin.dur + back : audioWin.dur };
      if (back < 1 / 24 - 1e-9)
        notes.push("trim first frame: the song window already starts at 0 s - "
          + "the dropped frame takes the first 1/24 s of the song with it");
    }
    notes.push(`trim first frame: renders ${frames} frames, the first one `
      + "(the frame it starts on, repeated) is dropped from the take and its master");
  }
  const pipeline = framePlan.resolveAuto("auto", frames, CEIL);
  const plan = framePlan.planChunks(frames, CEIL, grid, false, CEIL);
  const d = core.getConfig().defaults;
  /* 2.312.0 (Tim: "add a settings button to the right of the video docker
     menu bar ... resolution, steps, cfg, lora adder, sage attention
     checkbox, spectrum checkbox, comfy kitchen checkbox, upscaler dropdown,
     upscale resolution"): the ⚙'s record rides every board render - blank
     fields keep what the job had (lib/renderSettings.jobOverrides) */
  const rs = renderSettings.jobOverrides(
    renderSettings.read(core.projDir(project || core.getProject())),
    { width: d.width, height: d.height,
      style: upExport ? { ...styled, workflow: "comfy_workflows/" + UPSCALE_WF, workflows: {} } : styled });
  notes.push(...rs.notes);
  // 2.313.0: the take's last 2 s as PNGs (the ⚙'s Tail PNG size / upscaler)
  if (takeUp) notes.push(takeUp.note);
  const tailSpec = upscale ? null : tailFrames.spec(project, st, r.n,
    renderSettings.read(core.projDir(project || core.getProject())), rs.width, rs.height);
  if (tailSpec) notes.push(`tail PNGs: the last ${tailFrames.SECONDS}s at ${tailSpec.width}x${tailSpec.height} `
    + `(${tailSpec.upscaler || "lanczos"}) -> ${path.basename(path.dirname(tailSpec.dir))}/${path.basename(tailSpec.dir)}/`);
  const job = core.makeJob({
    mode: queueMode,
    // 2.302.0: the worker drops this many frames from the head (0 = none)
    trim_head: trimHead ? 1 : 0,
    // 2.323.0: no song - the worker takes the song lock out (scripts/nosong.py)
    ...(noSong ? { no_song: true } : {}),
    // FAST BY DEFAULT: a plain render strips the graph's in-line
    // *UltimateUpscale stage (worker._strip_upscale — API-format bypass is
    // physical removal, the Ctrl+B rule). An upscale job re-renders the SAME
    // scene with the stage LEFT IN and the same plan seeds, so the base
    // content reproduces and the upscale pass refines it. One at a time
    // comes free: this is the one generate queue the app has.
    upscale,
    prompt: jobPrompt,
    video_style: rs.video_style,
    video_style_id: style.id || null, video_style_name: style.name,
    audio_start: audioWin ? audioWin.start : undefined,
    audio_dur: audioWin && Number.isFinite(audioWin.dur) ? audioWin.dur : undefined,
    anchor: r.anchor || undefined,
    width: rs.width, height: rs.height, frames, steps: rs.steps, cfg: rs.cfg,
    seed: upExport && Number.isFinite(shotSeed) ? shotSeed : -1,
    // 2.384.0: the plan's seed (a chain graph keeps it) - said in the log as the seed used (the job's metadata)
    ...(shot.seed !== undefined && shot.seed !== "" ? { plan_seed: String(shot.seed) } : {}),
    // 2.312.0: the ⚙ upscaler - scripts/upscalestage.py (an upscale JOB
    // already runs its own stage, so it never doubles one). 2.315.0: a
    // plain render runs it only with the ⚙'s "Upscale every render"; the
    // ⏫ of a convert-style scene upscales the take itself
    ...(takeUp ? { upscale_stage: takeUp.stage, upscale_take: takeUp.file }
      : rs.upscale_stage && rs.upscale_auto && !upscale ? { upscale_stage: rs.upscale_stage } : {}),
    ...(tailSpec ? { tail_pngs: tailSpec } : {}),
    format: "mp4", speed: "quality", segment_frames: CEIL,
    // 2.301.0: a lossless FFV1 master beside the playback mp4 (projects/<p>/raw)
    // (2.358.0: not for an AI bridge - it is retimed to its gap, a master would keep the long render)
    raw_master: !upscale && !bridgeFit,
    ...(bridgeFit ? { bridge_fit: bridgeFit } : {}),
    upscale_workflow: upExport ? UPSCALE_WF : "",
    pipeline, requested_pipeline: pipeline, plan, trim_exact: true,
    force_chunks: false, extra_args: "",
    reference_files: referenceFiles, reference_names: referenceNames,
    ref_videos: refVideos, ref_audios: refAudios,
    scene: { n: r.n, chapter: r.chapter, upscale },
  });
  job.chunk = { i: 0, n: plan.chunks.length };
  scenes.save(upscale ? scenes.upscaling(st, n, job.id).state
                      : scenes.starting(st, n, job.id).state, project);
  return { job, notes: notes.concat(missing) };
}

/**
 * EXTEND VIDEO (2.223.13): queue ONE scene through Tim's export. Same job /
 * status / keep machinery as queueScene's chain path — this function only
 * decides WHAT rides the job: the previous scene's take as the ref video,
 * the scene's chapter reference pictures as the ref images, the docker's
 * duration as the length, a fresh seed. The worker's generic patcher does
 * the rest (literal length onto the gen node, VHS_LoadVideo <- the uploaded
 * take, ImageBatchMulti slots adapted to the real picture count, unused
 * loaders physically removed — the Ctrl+B rule).
 */
/**
 * H3_VIDEO_REF, SCENE 1 (2.223.16): the first scene renders through the
 * NATIVE ref2va export (comfy_workflows/ref2va.json, 9 image / 3 audio /
 * 3 video reference slots) carried by the bundled H3_Video_Ref style. Its
 * references are the CHAIN's own walk, same order, same priorities: one
 * sheet per cast character, then the environments' extracted views, then
 * the chapter's reference pictures - capped at the export's 9 image slots
 * - and the cast's voice clips as the ref audios (capped at its 3). The
 * global prompt (the plan's prompt prefix) rides ahead of the scene's own
 * prompt. Duration comes from the docker's Seconds through the same knob
 * extend reads; the seed re-rolls per press; unused reference slots are
 * physically pruned by the worker (the Ctrl+B rule - proven for this very
 * export in test-patcher Part B).
 */
function queueRefScene(project, st, r) {
  const n = r.n;
  // 2.573.0: H3_Video_Ref or FastH3 Omni - the same flow, each with its own style + graph
  const flow = extendVideo.isRefFlow(st.style) ? st.style : extendVideo.REF_STYLE;
  const wf = extendVideo.refWorkflow(flow);
  const backend = (core.getConfig().engine || {}).backend;
  if (backend !== "comfy") return { status: 400, error:
    flow + " renders through ComfyUI (" + wf + ") - switch "
    + "Settings → ComfyUI → Engine to comfy, or pick the character chain" };
  if (!fs.existsSync(wfPath(wf))) return { status: 400, error:
    "comfy_workflows/" + wf + " is missing - restore it from "
    + "the delivery zip, or pick another Workflow" };
  const style = styles.read(core.STYLES_DIR)
    .find((x) => x.kind === "video" && x.name === flow);
  if (!style) return { status: 400, error:
    "the " + flow + " video style is missing - restore styles/video/"
    + flow + ".json from the delivery zip" + (flow === extendVideo.FAST_STYLE ? " (or Settings ▸ Add-ons ▸ FastH3 Omni ▸ Install puts it back)" : "") };
  const extraV = tempLoras.read(core.projDir(project || core.getProject()), "video");
  const styled = extraV.length
    ? { ...style, loras: tempLoras.merge(style.loras, extraV) } : style;
  const notes = [];
  const referenceFiles = [], referenceNames = [], refAudios = [];
  // 2.225.0: a cast member WITH an extracted RefMod rides their MOD (the
  // worker splices Load+Apply before the sampler) and their sheet stays
  // OUT of the 9-image walk — that is the whole point: identity via the
  // mod, the freed slots for clothing and chapter pictures. Members
  // without a mod keep the 2.223.16 sheet ride. Voices always ride.
  const castMods = [];
  for (const c of chars.cast(project)) {
    if (c.refmod) {
      castMods.push(c.refmod);
      notes.push(c.name + ": rides refmod " + c.refmod + " (sheet freed)");
    } else {
      const pick = chars.referenceImage(c, project);
      if (pick) {
        referenceFiles.push(path.join(chars.charDir(c.name, project), pick));
        referenceNames.push(pick);
      } else notes.push(c.name + ": no sheet");
    }
    for (const v of (c.voices || []))
      refAudios.push(path.join(chars.charDir(c.name, project), v));
  }
  // 2.224.0: CLOTHING rides right after the sheets (identity, then what
  // it wears), ahead of environments and chapter pictures inside the
  // export's 9-image cap. Active set per the resolver: mention selects,
  // silence inherits, a new mention replaces.
  let wornN = 0;
  for (const w of activeClothing(project, r.n)) {
    const wp = chars.clothingPath(w.char, w.file, project);
    if (fs.existsSync(wp)) {
      referenceFiles.push(wp); referenceNames.push(w.file); wornN++;
    } else notes.push(w.char + ": clothing picture " + w.file + " is missing from the dataset");
  }
  for (const e of envs.list(project)) {
    const v = envs.extractView(e.name, project,
                               { width: core.getConfig().defaults.width,
                                 height: core.getConfig().defaults.height });
    if (v.ok) { referenceFiles.push(v.view); referenceNames.push(path.basename(v.view)); }
    else notes.push(v.error || (e.name + ": no environment view"));
  }
  const cr = chapterRefs.forChain(project, r.chapter || "", r.n);
  // 2.266.0: chapter SOUNDS ride the audio references (after the cast's
  // voices, inside the export's 3-audio cap); pictures keep the 9-walk
  for (const x of cr.refs) {
    if (x.kind === "sound") refAudios.push(x.path);
    else { referenceFiles.push(x.path); referenceNames.push(x.file); }
  }
  notes.push(...cr.missing);
  if (referenceFiles.length > extendVideo.MAX_REF_IMAGES)
    notes.push((referenceFiles.length - extendVideo.MAX_REF_IMAGES)
      + " reference picture(s) beyond the export's "
      + extendVideo.MAX_REF_IMAGES + "-image limit stay out");
  const imgs = referenceFiles.slice(0, extendVideo.MAX_REF_IMAGES);
  const imgNames = referenceNames.slice(0, extendVideo.MAX_REF_IMAGES);
  if (refAudios.length > extendVideo.MAX_REF_AUDIOS)
    notes.push((refAudios.length - extendVideo.MAX_REF_AUDIOS)
      + " audio reference(s) (voice clips and chapter sounds) beyond the export's "
      + extendVideo.MAX_REF_AUDIOS + "-audio limit stay out");
  const auds = refAudios.slice(0, extendVideo.MAX_REF_AUDIOS);
  const grid = framePlan.gridFor(backend);
  const G = framePlan.GRIDS[grid];
  // 2.227.0: CONTINUITY WITHOUT THE EXTEND PACK — scene n>1 rides scene
  // n-1's take as ref2va's OWN video reference (the export's 3 ref_video
  // slots; the worker's prune/grow machinery fills slot 0 and prunes the
  // rest). A missing prior is a NOTE, never a refusal — Tim renders out
  // of order; the scene then stands alone.
  const refVids = [];
  if (n > 1) {
    const prior = extendVideo.priorTake(st, n, project);
    if (!prior.error) {
      refVids.push(prior.abs);
      notes.push("continues scene " + (n - 1) + "'s take (" + prior.name
        + ") as a video reference");
    } else notes.push(prior.error + " — this scene renders standalone");
  }
  const frames = Math.min(G.ceiling, extendVideo.extendFrames(
    project, scenes.chainOverrides(project), screenplay.DEFAULTS.length));
  const pipeline = framePlan.resolveAuto("auto", frames, G.ceiling);
  const plan = framePlan.planChunks(frames, G.ceiling, grid, false, G.ceiling);
  const d = core.getConfig().defaults;
  const rs = renderSettings.jobOverrides(       // 2.312.0: the video docker's ⚙
    renderSettings.read(core.projDir(project || core.getProject())),
    { width: d.width, height: d.height, style: { ...styled, workflows: {} } });
  notes.push(...rs.notes);
  const job = core.makeJob({
    mode: "ref2va",
    upscale: false,
    prompt: ((st.plan || {}).prompt_prefix || [])
      .concat(r.prompt || []).filter(Boolean).join("\n") || ("scene " + n),
    video_style: rs.video_style,   // pin every mode to ref2va.json (workflows: {})
    video_style_id: style.id || null, video_style_name: style.name,
    width: rs.width, height: rs.height, frames, steps: rs.steps, cfg: rs.cfg,
    seed: -1,
    // 2.315.0: only with the ⚙'s "Upscale every render" - else ⏫ does it
    ...(rs.upscale_stage && rs.upscale_auto ? { upscale_stage: rs.upscale_stage } : {}),
    ...((() => { const t = tailFrames.spec(project, st, r.n,         // 2.313.0
      renderSettings.read(core.projDir(project || core.getProject())), rs.width, rs.height);
      return t ? { tail_pngs: t } : {}; })()),
    format: "mp4", speed: "quality", segment_frames: G.ceiling,
    raw_master: true,                  // 2.301.0: the lossless master too
    upscale_workflow: "",
    pipeline, requested_pipeline: pipeline, plan, trim_exact: true,
    force_chunks: false, extra_args: "",
    reference_files: imgs, reference_names: imgNames,
    ref_videos: refVids, ref_audios: auds,
    refmods: castMods,                 // 2.225.0: worker._apply_refmods
    scene: { n: r.n, chapter: r.chapter, upscale: false, ref_style: true },
  });
  job.chunk = { i: 0, n: plan.chunks.length };
  notes.push(flow + ": scene " + n + " through ref2va" + (flow === extendVideo.FAST_STYLE ? " (FastH3 Omni, 8 steps)" : "") + " - "
    + imgs.length + " picture(s)" + (wornN ? " (" + wornN + " clothing)" : "")
    + ", " + auds.length + " voice clip(s), "
    + frames + "f = " + (Math.round(frames / 24 * 10) / 10) + "s; "
    + "later scenes extend this take");
  scenes.save(scenes.starting(st, n, job.id).state, project);
  return { job, notes };
}

/**
 * 2.338.0: one scene through LTX 2.5 (lib/ltxScenes.plan picks the mode from
 * the card: its First / Last pictures or the frame it continues from, and the
 * board's song slice for the lipsync variants).
 */
function queueLtxScene(project, st, r) {
  const ltx = require("../lib/ltx");
  const sceneFrames = require("../lib/sceneFrames");
  const all = styles.read(core.STYLES_DIR, "video").filter((x) => ltx.isLtxStyle(x));
  const rsRec = renderSettings.read(core.projDir(project || core.getProject()));
  const d0 = core.getConfig().defaults || {};
  const style = all.find((x) => x.id === (rsRec || {}).video_style_id) || all.find((x) => x.name === "LTX 2.5") || all[0];
  if (!style) return { status: 400, error: "no LTX 2.5 video style - restart the app to seed \"LTX 2.5\"" };
  // 2.409.0: Override style ON - Basic Settings' temporary video LoRAs ride on LTX scenes too (H3 scenes always had them)
  const extraV = rsRec && rsRec.basic_override ? tempLoras.read(core.projDir(project || core.getProject()), "video") : [];
  const rs = renderSettings.jobOverrides(rsRec, { width: d0.width, height: d0.height,
    style: extraV.length ? { ...style, loras: tempLoras.merge(style.loras, extraV) } : style });
  const first = sceneRefs.slotFor(project, r, "first"), last = sceneRefs.slotFor(project, r, "last");
  const needCont = !first && ["first", "continue", "transition", "last"].includes(String(r.anchor || ""));
  const cont = needCont ? sceneFrames.contFrame(project, st, r) : null;
  const place = String(r.anchor || "") === "transition" && !last ? (((sceneRefs.forRender(project, r) || {}).refs || [])[0] || null) : null;
  let song = null, win = null;
  if (st.audio) {
    song = path.join(core.pDir("sound"), path.basename(st.audio));
    const w0 = sceneTimeline.windowFor(st, r.n);
    win = { start: w0.start || 0, dur: w0.dur || null };
  }
  // 2.409.0: the style with Basic Settings' model / LoRAs (rs.video_style) and its steps / cfg (rs.basic) - they used to
  // be computed here and dropped, while the notes said they were used
  const out = ltxScenes.plan({ r, style: rs.video_style || style, base: core.BASE, cast: chars.cast(project) || [],
    first: first && first.file, last: last && last.file, cont: cont && cont.file,
    place: place && place.file, song, win, width: rs.width, height: rs.height, basic: rs.basic });
  if (out.error) return { status: 400, error: `scene ${r.n}: ${out.error}` };
  const job = core.makeJob(out.params);
  job.chunk = { i: 0, n: 1 };
  scenes.save(scenes.starting(st, r.n, job.id).state, project);
  return { job, notes: [out.note, ...(rs.notes || [])] };
}

function mount(app) {
  // 2.378.0: the CURRENT project's temp/ per request + JSON errors (lib/tempUpload) - a folder fixed at start was
  // gone after a project reset, and the new character's picture upload answered an HTML error page
  const upload = require("../lib/tempUpload").tempUpload({ fileSize: 100 * 1024 * 1024 });
  if (!fs.existsSync(wfPath(TMP_STYLE))) syncTmp(undefined, "startup");

  // RESET WORKFLOW (2.196.0, Tim: "add a reset workflow button to the scene
  // menu, i think the tmp workflow that is being rendered needs to be
  // rebuilt with the new parameters"). One press = one rebuild of
  // MM3_Characters_tmp.json from the base workflow with the current cast,
  // environments and settings — the same syncTmp every mutation runs, but
  // on demand and answering with its notes so the user SEES what went in.
  app.post("/api/scenes/workflow/reset", (req, res) => {
    const b = req.body || {};
    const r = syncTmp(b.project, "reset button", b.chapter || "");
    if (!r) return res.status(500).json({ error:
      `could not rebuild ${TMP_STYLE} — see the server log` });
    res.json({ ok: true, file: TMP_STYLE,
               cast: chars.cast(b.project).length, notes: r.notes || [] });
  });

  /**
   * 2.216.0 (by instruction: "make a dialog with a thumbnail grid to select
   * which Actors will be in the current scene"): the 🎭 selection. GET
   * answers the full roster plus who is active; PUT stores the chosen ids
   * and rebuilds the tmp chain, because the actors in the scene ARE the
   * reference chain. An empty selection means everyone (the lib rule).
   */
  app.get("/api/characters/cast", (req, res) =>
    res.json({ characters: chars.list(req.query.project),
               active: chars.activeIds(req.query.project) || [],
               cast: chars.cast(req.query.project).map((c) => c.id) }));
  app.put("/api/characters/cast", (req, res) => {
    const b = req.body || {};
    const act = chars.setActive(Array.isArray(b.active) ? b.active : [], b.project);
    syncTmp(b.project, "cast selection changed");
    res.json({ ok: true, active: act,
               cast: chars.cast(b.project).map((c) => c.name) });
  });

  app.get("/api/characters", (req, res) =>
    res.json({ characters: chars.list(req.query.project),
               project: req.query.project || core.getProject() }));

  app.get("/api/characters/briefing", (req, res) =>
    res.json({ briefing: chars.briefing(req.query.project) }));

  app.post("/api/characters", (req, res) => {
    const b = req.body || {};
    if (!chars.slug(b.name)) return res.status(400).json({ error: "a character needs a name" });
    try {
      const existing = chars.readProfile(b.name, b.project);
      const type = ["person", "animal", "vehicle", "clothing"].includes(b.type) ? b.type
                 : (existing?.type || "person");
      const p = chars.writeProfile({ ...(existing || chars.blank(b.name)),
        name: b.name, type,
        subtype: b.subtype ?? existing?.subtype ?? "",
        breed: b.breed ?? existing?.breed ?? "",
        color: b.color ?? existing?.color ?? "",
        model: b.model ?? existing?.model ?? "",
        year: b.year ?? existing?.year ?? "",
        age: b.age ?? existing?.age ?? "",
        height: b.height ?? existing?.height ?? "",
        weight: b.weight ?? existing?.weight ?? "",
        notes: b.notes ?? existing?.notes ?? "",
        persona: b.persona ?? existing?.persona ?? "",
        backstory: b.backstory ?? existing?.backstory ?? "",
        pronouns: b.pronouns || existing?.pronouns || "they",
        wardrobe: b.wardrobe ?? existing?.wardrobe ?? "",
        slot: b.slot || existing?.slot || "",
        scenes: b.scenes || existing?.scenes || "all" }, b.project);
      chars.buildComposite(p.name, b.project);   // the stitch (2.168.0)
      syncTmp(b.project, "character saved");
      res.json({ ok: true, character: p });
    } catch (e) { res.status(400).json({ error: String(e.message || e) }); }
  });

  app.post("/api/characters/:name/asset", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "no file" });
    try {
      const r = chars.addAsset(req.params.name, req.file.path,
                               req.file.originalname, (req.body || {}).project);
      fs.unlink(req.file.path, () => {});
      chars.buildComposite(req.params.name, (req.body || {}).project);   // the stitch (2.168.0)
      syncTmp((req.body || {}).project, "asset added");
      res.json({ ok: true, ...r });
    } catch (e) {
      fs.unlink(req.file.path, () => {});
      res.status(400).json({ error: String(e.message || e) });
    }
  });

  /**
   * 2.212.0 (by instruction: "allow user to drag images from gallery or
   * reference images or asset images"): attach an EXISTING project image as a
   * character asset WITHOUT re-uploading its bytes. The name resolves in ONE
   * place — projects/<p>/images — the same invariant POST /api/generate
   * upholds; a gallery drop is ADOPTED into that folder first by the client
   * (/api/passets/adopt, the 2.19x lesson: an un-adopted gallery name is a
   * name the server cannot resolve), so by the time this runs the name is
   * true. addAsset COPIES into the character's folder, exactly as the
   * multipart route does, so deleting the project asset later never breaks
   * the sheet.
   */
  app.post("/api/characters/:name/asset-from", (req, res) => {
    const b = req.body || {};
    const base = path.basename(String(b.file || ""));
    if (!base) return res.status(400).json({ error: "which picture? pass its file name" });
    const src = path.join(core.pDir("images"), base);
    if (!fs.existsSync(src)) return res.status(404).json({
      error: `${base} is not in this project's Images assets — gallery `
        + "pictures adopt in on drop; anything else lands there via the "
        + "Assets dock first" });
    try {
      const r = chars.addAsset(req.params.name, src, base, b.project);
      chars.buildComposite(req.params.name, b.project);   // the stitch (2.168.0)
      syncTmp(b.project, "asset attached from the project's images");
      res.json({ ok: true, ...r });
    } catch (e) { res.status(400).json({ error: String(e.message || e) }); }
  });

  /* ---- CLOTHING (2.224.0, by instruction): each entry = a picture (a
   * clothing photo or a sheet wearing it) + type + color + free text;
   * multiple entries per character. Files land in dataset/clothing/ (the
   * RefMod training set), the manifest rides the profile, and
   * lib/clothing.js decides which entries ride which scene (mention
   * selects, silence inherits, a new mention replaces). The list arrives
   * with GET /api/characters — the profile carries it. */
  app.post("/api/characters/:name/clothing", upload.single("image"), (req, res) => {
    const b = req.body || {};
    // an upload, or an EXISTING project image by name (the asset-from
    // pattern — drops from the gallery adopt in first, client-side)
    let src = req.file && req.file.path;
    let original = req.file && req.file.originalname;
    if (!src && b.file) {
      original = path.basename(String(b.file));
      src = path.join(core.pDir("images"), original);
      if (!fs.existsSync(src)) return res.status(404).json({
        error: `${original} is not in this project's Images assets` });
    }
    if (!src) return res.status(400).json({ error: "upload a clothing picture" });
    try {
      const r = chars.clothingAdd(req.params.name, src,
        { type: b.type, color: b.color, notes: b.notes, original }, b.project);
      if (req.file) fs.unlink(req.file.path, () => {});
      res.json({ ok: true, file: r.file, profile: r.profile });
    } catch (e) {
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(400).json({ error: String(e.message || e) });
    }
  });
  app.delete("/api/characters/:name/clothing", (req, res) => {
    const q = req.query || {};
    const p = chars.clothingRemove(req.params.name, q.file, q.project);
    if (!p) return res.status(404).json({ error: "no such character" });
    res.json({ ok: true, profile: p });
  });
  app.get("/api/characters/:name/clothing/:file", (req, res) => {
    const f = chars.clothingPath(req.params.name, req.params.file,
                                 req.query.project);
    if (!fs.existsSync(f)) return res.status(404).json({ error: "not found" });
    res.sendFile(f);
  });

  /* 2.224.0 (by instruction): "add a button to stitch all the selected
   * images into 1 file" — the ticked takes join side by side through the
   * SAME ffmpeg chain the save-time composite uses (chars.stitchFiles —
   * one implementation, per the pointer). The result lands in the
   * project's output dir, so it is a take like any other: it paints in
   * the strip, ✔ adopts it as the sheet, 💾 keeps it. With a character
   * name it ALSO lands in that character's dataset. */
  app.post("/api/characters/stitch", (req, res) => {
    const b = req.body || {};
    const names = (Array.isArray(b.files) ? b.files : [])
      .map((f) => path.basename(String(f || ""))).filter(Boolean);
    if (names.length < 2) return res.status(400).json({
      error: "tick at least two generated images to stitch" });
    const srcs = [], missing = [];
    for (const nm of names) {
      const hit = ["output", "final", "images"]
        .map((k) => path.join(core.pDir(k), nm)).find((f) => fs.existsSync(f));
      if (hit) srcs.push(hit); else missing.push(nm);
    }
    if (missing.length) return res.status(404).json({
      error: missing.join(", ") + " — not among this project's renders" });
    const out = "sheet-stitch-" + Date.now().toString(36) + ".png";
    fs.mkdirSync(core.pDir("output"), { recursive: true });
    if (!chars.stitchFiles(srcs, path.join(core.pDir("output"), out)))
      return res.status(500).json({ error:
        "could not stitch — is ffmpeg installed and on PATH?" });
    const dataset = b.name
      ? chars.datasetAdd(b.name, path.join(core.pDir("output"), out), out, b.project)
      : null;
    res.json({ ok: true, file: out, stitched: names.length,
               dataset: dataset || undefined });
  });

  /* ---- THE DATASET BUTTONS (2.228.0, by instruction: "add a create
   * dataset button ... Create dataset folder for the character, add a
   * addto dataset button so user can add files to the dataset with a
   * select file dialog. Add a button to the character sheet creator/
   * generator to add files to dataset"). Creation is explicit (the folder
   * becomes real and browsable before anything lands); additions land
   * through the SAME datasetAdd every 2.224.0 flow rides. Pictures feed
   * the RefMod extraction; videos are stored too (the pack's folder
   * loader reads both) but the extraction currently rides pictures only
   * — said in the response, never silent. */
  app.post("/api/characters/:name/dataset", (req, res) => {
    try {
      const r = chars.datasetCreate(req.params.name, (req.body || {}).project);
      res.json({ ok: true, dir: r.dir, files: r.files });
    } catch (e) { res.status(404).json({ error: String(e.message || e) }); }
  });
  app.post("/api/characters/:name/dataset/file", upload.array("files", 32),
           (req, res) => {
    const b = req.body || {};
    const name = req.params.name;
    if (!chars.readProfile(name, b.project)) {
      for (const f of (req.files || [])) fs.unlink(f.path, () => {});
      return res.status(404).json({ error: `no such character: ${name}` });
    }
    const IMGX = [".png", ".jpg", ".jpeg", ".webp", ".bmp"];
    const VIDX = [".mp4", ".webm", ".mov", ".mkv"];
    const added = [], refused = [];
    let videos = 0;
    for (const f of (req.files || [])) {
      const ext = path.extname(f.originalname || "").toLowerCase();
      if (IMGX.includes(ext) || VIDX.includes(ext)) {
        const base = chars.datasetAdd(name, f.path,
          path.basename(f.originalname), b.project);
        if (base) { added.push(base); if (VIDX.includes(ext)) videos++; }
        else refused.push(f.originalname + " (could not store)");
      } else refused.push(f.originalname + " (" + (ext || "no extension")
        + " — pictures and videos only)");
      fs.unlink(f.path, () => {});
    }
    if (!added.length && !refused.length)
      return res.status(400).json({ error: "no files arrived" });
    const notes = [];
    if (videos) notes.push(videos + " video(s) stored — RefMod extraction "
      + "currently rides pictures only");
    if (refused.length) notes.push("refused: " + refused.join(", "));
    res.json({ ok: added.length > 0, added, refused, notes });
  });

  /* ---- CHARACTER REFMODS (2.225.0, by instruction: "now proceed with the
   * refmod"). The ComfyUI-MiniMaxH3Mod pack (pinned in lib/refmods.js)
   * turns a character's DATASET folder — every sheet, source, composite
   * and clothing picture 2.224.0 lands there — into a tiny no-training
   * identity mod in ComfyUI's models/refmods/. Extraction runs as a
   * mode:"graph" job (graph_worker: transport + collection only) whose
   * one file output is the pack's own decoded preview of the stored
   * latent; ADOPTION then verifies the safetensors really landed before
   * the profile remembers the mod. H3_Video_Ref renders splice the cast's
   * mods before the sampler (worker._apply_refmods) — sheets stay out of
   * the 9-slot walk for modded characters, freeing slots for pictures. */
  app.post("/api/characters/:name/refmod", (req, res) => {
    const b = req.body || {};
    const name = req.params.name;
    const prof = chars.readProfile(name, b.project);
    if (!prof) return res.status(404).json({ error: `no such character: ${name}` });
    if ((core.getConfig().engine || {}).backend !== "comfy")
      return res.status(400).json({ error:
        "RefMod extraction runs through ComfyUI — switch Settings → ComfyUI "
        + "→ Engine to comfy first" });
    // the TRAINING SET is the dataset folder (2.224.0's whole point):
    // root pictures first, then clothing/, sorted by name — deterministic
    const dd = chars.datasetDir(name, b.project);
    const walk = (dir) => {
      try {
        return fs.readdirSync(dir)
          .filter((f) => [".png", ".jpg", ".jpeg", ".webp", ".bmp"]
            .includes(path.extname(f).toLowerCase()))
          .sort().map((f) => path.join(dir, f));
      } catch { return []; }
    };
    const files = walk(dd).concat(walk(path.join(dd, "clothing")));
    if (!files.length) return res.status(400).json({ error:
      `${name}'s dataset folder is empty — generate or upload character `
      + "sheets first (everything a character gains lands there)" });
    let built;
    try {
      built = refmods.extractGraph(name, files,
        { description: [prof.subtype, prof.color, prof.notes]
            .filter(Boolean).join(", ").slice(0, 300) });
    } catch (e) { return res.status(400).json({ error: String(e.message || e) }); }
    const notes = [];
    if (files.length > refmods.MAX_REFS)
      notes.push((files.length - refmods.MAX_REFS) + " dataset picture(s) beyond "
        + "the pack's " + refmods.MAX_REFS + "-image limit stay out");
    const job = core.makeJob({
      mode: "graph", graph: built.graph,
      graph_name: "RefMod extract: " + name,
      graph_file: "(built from " + name + "'s dataset)",
      graph_uploads: built.uploads,
      graph_applied: ["mod \"" + built.name + "\" ← " + built.uploads.length
        + " dataset picture(s), Full Reference @1024 — saves to ComfyUI's "
        + "models/refmods/"],
      graph_warnings: notes,
      seed: -1, prompt: "",
    });
    job.chunk = { i: 0, n: 1 };
    res.json(Object.assign(core.jobDict(job),
      { mod: built.name, pictures: built.uploads.length, notes }));
  });

  /** After the extraction job reports done: verify the safetensors REALLY
   *  landed in ComfyUI's models/refmods (an extraction whose only proof is
   *  a green job is a mod that may not exist — the harvest rule), then the
   *  profile remembers it. */
  app.post("/api/characters/:name/refmod/adopt", (req, res) => {
    const b = req.body || {};
    const name = req.params.name;
    const prof = chars.readProfile(name, b.project);
    if (!prof) return res.status(404).json({ error: `no such character: ${name}` });
    const mod = String(b.mod || refmods.modName(name));
    const cdir = comfy.comfyCfg().dir;
    if (!cdir) return res.status(400).json({ error:
      "cannot verify the mod — no ComfyUI folder is configured or "
      + "discovered (Settings → ComfyUI)" });
    const p = refmods.modPath(path.isAbsolute(cdir) ? cdir
      : path.join(core.BASE, cdir), mod);
    if (!fs.existsSync(p)) return res.status(404).json({ error:
      `the extraction finished but ${p} is not there — check the job log; `
      + "the pack may have refused the save (budget_policy) or ComfyUI "
      + "runs from a different folder" });
    prof.refmod = mod;
    chars.writeProfile(prof, b.project);
    res.json({ ok: true, mod, path: p,
               size: (fs.statSync(p).size / 1024).toFixed(1) + " KB" });
  });

  app.delete("/api/characters/:name/refmod", (req, res) => {
    const q = req.query || {};
    const prof = chars.readProfile(req.params.name, q.project);
    if (!prof) return res.status(404).json({ error: "no such character" });
    const mod = prof.refmod || "";
    prof.refmod = "";
    chars.writeProfile(prof, q.project);
    // best-effort file removal — we made it, we may remove it; a locked or
    // missing file never fails the forget
    try {
      const cdir = comfy.comfyCfg().dir;
      if (mod && cdir) fs.rmSync(refmods.modPath(
        path.isAbsolute(cdir) ? cdir : path.join(core.BASE, cdir), mod),
        { force: true });
    } catch { /* the profile is the truth */ }
    res.json({ ok: true, forgot: mod });
  });

  app.get("/api/characters/:name/file/:file", (req, res) => {
    const f = path.join(chars.charDir(req.params.name, req.query.project),
                        path.basename(req.params.file));
    if (!fs.existsSync(f)) return res.status(404).json({ error: "not found" });
    res.sendFile(f);
  });

  app.delete("/api/characters/:name", (req, res) => {
    const ok = chars.remove(req.params.name, req.query.project);
    syncTmp(req.query.project, "character removed");
    res.json({ ok });
  });

  /**
   * Teach the model the pipeline's grammar, ask for a screenplay, and REFUSE
   * anything that would not render. The dangerous reply is not a badly written
   * one - it is a well-written one that mentions a character nobody has a
   * reference sheet for, which renders as a stranger and looks exactly like the
   * character-drift bug. `validate` is the gate; `apply` only ever sees a plan
   * that passed it.
   */
  app.post("/api/screenplay", trap.guard(async (req, res) => {
    const b = req.body || {};
    /* 2.283.0 (Tim's report: "5 segment(s) beyond the board's 12 scene(s)
       stay unassigned" — the writer was never told the song's shape): with
       the board on the music-video chain and a split on disk, the brief
       carries the segment count so the writer plans ONE SHOT PER SEGMENT
       and the whole song lands on the board. */
    try {
      // 2.323.0: a native board without a song is a screenplay - no song shape
      if (["MMH3_Music_Video", "MMH3_NativeAudio_MV"].includes(scenes.load(b.project).style)
          && (scenes.load(b.project).style !== "MMH3_NativeAudio_MV" || scenes.load(b.project).audio)) {
        const seg = (stems.lastSplit() || {}).files || [];
        if (seg.length && b.brief) {
          b.brief += `\n\nSONG SHAPE: the song is split into ${seg.length} `
            + "fifteen-second segments. Write EXACTLY "
            + `${seg.length} shots (scene 1..${seg.length}), one per segment `
            + "in order, each lip-syncing that segment's lyric.";
          /* 2.294.0: on the native board the song IS the voice - "lyric"
             invited quoting the words as speech */
          if (scenes.load(b.project).style === "MMH3_NativeAudio_MV")
            b.brief = b.brief.replace("each lip-syncing that segment's lyric.",
              "each ONE continuous clip of the performer singing that stretch "
              + "of the real song (no dialogue - the song is the voice).");
        }
      }
    } catch (e) { /* best-effort; the writer runs regardless */ }
    const cast = chars.cast(b.project);      // 2.216.0: write around the 🎭 cast
    if (!cast.length) return res.status(400).json({
      error: "add at least one character first - a screenplay with no cast has "
           + "no @tags it is allowed to use" });
    const brief = chars.briefing(b.project);
    // The subject definitions and voice assignments are generated from the
    // profiles and handed over ready-made: they are facts about the cast, and a
    // model asked to invent them re-describes a character differently in every
    // scene.
    const prefix = screenplay.buildPrefix(cast,
      { ...b, refParagraphs: chapterRefs.prefixParagraphs(b.project),
        locations: locationPrefix.lines(envs.list(b.project)) });
    // THE STORY RODE IN THE CHAT (2.174.0, Tim: "save the chat when a
    // screenplay is asked for, clear the chat context when using models
    // >12gb and do a rag of the chat to complete the response"). The writer
    // used to see ONLY the typed line — everything the user developed in
    // conversation stayed behind, so "create a screenplay" wrote about
    // nothing in particular. The current session is RECALLED against the
    // ask (the same retriever /api/chat uses) and rides the system prompt
    // as compact excerpts. No assistant turns are added to the messages,
    // so the return-ONLY-JSON discipline is untouched.
    const askText = String(b.brief || b.prompt || "");
    let chatPrior = [];
    try { chatPrior = chatStore.current(core.pDir("chat")); } catch { /* no chat yet */ }
    const convo = chatPrior.length
      ? chatRecall.digest(chatPrior, askText, 8000) : "";
    // 2.183.0: the chapter references' details ride EVERY writer call so
    // the model can use them in the screenplay (by instruction)
    const refsNote = chapterRefs.refsBrief(b.project);
    // refs_in_prompt rides every writer response (2.183.0) so the e2e — and
    // a curious user — can SEE whether the reference details reached the
    // model, without archaeology in the request records
    res.set("X-Refs-In-Prompt", refsNote ? "1" : "0");
    // THE BOARD'S SHARED PROMPT IS READ, NOT REPLACED (2.192.0, Tim: "does
    // the llm read the shared prompt before making the scenes?" — it did
    // not: the writer regenerated prompt_prefix from the cast and the
    // user's 💾-saved edits were invisible to the model AND overwritten).
    // Now: a saved shared prompt with the plan's shape (first solid line
    // "subject_definitions:") IS the prefix — the model reads it in the
    // system message and returns it unchanged, and the plan keeps it. A
    // saved prompt in any other shape cannot BE prompt_prefix (validate
    // would refuse the plan), so the generated prefix stands in and the
    // saved text rides the system message as standing notes instead.
    // X-Shared-Prefix says which way it went: board | notes | generated.
    const savedPrefix = (() => {
      try {
        const p = ((scenes.load(b.project) || {}).plan || {}).prompt_prefix;
        return Array.isArray(p) && p.some((l) => String(l).trim()) ? p : null;
      } catch { return null; }
    })();
    const savedValid = !!savedPrefix
      && String(savedPrefix.find((l) => String(l).trim()) || "").trim()
         === "subject_definitions:";
    const prefixNote = savedPrefix && !savedValid
      ? "\n\nTHE BOARD'S SHARED PROMPT (the user's standing notes for every "
        + "scene — the screenplay must be consistent with them):\n"
        + savedPrefix.join("\n").slice(0, 4000)
      : "";
    res.set("X-Shared-Prefix", savedValid ? "board"
                             : savedPrefix ? "notes" : "generated");
    const writerPrefix = savedValid ? savedPrefix : prefix;
    // 2.275.0: the addenda (music_video's lyric lock + lipsync rules among
    // them) are matched on the USER'S OWN brief and ride the WRITER's
    // system message — the model that writes the scenes gets the rules,
    // not just the chat.
    /* 2.294.0 (Tim: "can we teach the llm how to write scenes for the
       music video workflow ... it put in unknown characters and is using
       (s1) dialog instead of singing the song"): a MMH3_NativeAudio_MV
       board gets ITS OWN writer contract (lib/mvWriter) - not the chain's
       guide with its (S1)/<d> dialogue, not the MMH3_Music_Video addendum
       (whose lip-sync IS "(S1) sings, <d>lyric</d>"), and not the board
       prefix's subject definitions and voice slots. The song is the voice. */
    const native = mvWriter.isNative(scenes.load(b.project).style);
    // 2.323.0: a native board with no song is a SCREENPLAY - the dialogue writer
    const wMode = mvWriter.modeOf(scenes.load(b.project));
    const briefAddenda = (() => {
      try {
        if (!native) return promptGuides.addendaFor(core.STYLES_DIR, "video",
          String(b.brief || ""));
        return promptGuides.matchAddenda(promptGuides.loadAddenda(core.STYLES_DIR),
          "video", String(b.brief || ""))
          .filter((a) => a.id !== "music_video").map(promptGuides.render).join("\n\n");
      } catch { return ""; }
    })();
    /* 2.299.0 (Tim: "llm should read global prompt before generating
       scenes for videos or music videos"): the global prompt is read FIRST,
       right after the rules - on a music-video board too (mvWriter.
       globalNote keeps its looks, locations, pictures and notes and drops
       the voice slots / dialogue). X-Global-Prompt says whether it rode. */
    const globalFirst = native
      ? mvWriter.globalNote(savedPrefix || writerPrefix, wMode)
      : (savedPrefix
        ? "\n\nTHE GLOBAL PROMPT - READ IT BEFORE YOU WRITE (it fronts every "
          + "scene you write; the screenplay must be consistent with it):\n"
          + savedPrefix.join("\n").slice(0, 4000)
        : "");
    res.set("X-Global-Prompt", globalFirst ? "1" : "0");
    // 2.356.0: on a music-video board, what is sung in each scene's window (the song's timed transcript)
    const lyricsNote = (() => {
      if (!native || wMode !== "song") return "";
      try {
        const stL = scenes.load(b.project);
        const song = stL.audio ? path.join(core.pDir("sound"), path.basename(stL.audio)) : "";
        // 2.358.0: numbered as the writer numbers them - content scenes only (the bridges are not written)
        const wins = (stL.list || []).filter((r) => !r.bridge)
          .map((r, k) => ({ ...sceneTimeline.windowFor(stL, r.n), n: k + 1 }))
          .filter((w) => Number.isFinite(w.start) && Number.isFinite(w.dur) && w.dur > 0);
        return sceneLyrics.boardNote(wins, song, path.join(core.projDir(b.project || core.getProject()), "transcripts"));
      } catch { return ""; }
    })();
    const msgs = [
      { role: "system", content: (native
            ? mvWriter.guide(cast, envs.list(b.project), chapterRefs.tags(b.project), wMode)
            : screenplay.guide(cast, envs.list(b.project)))
          + globalFirst
          + lyricsNote
          + (briefAddenda ? "\n\n" + briefAddenda : "")
          + refsNote + "\n\n" + brief
          + (native
            ? "\n\n" + mvWriter.castLine(cast) + "\nPut your work in `shots`."
            // 2.299.0: a saved global prompt IS the prefix and was read
            // first - not sent twice (the plan keeps it whatever the
            // model echoes)
            : savedValid
              ? "\n\nThe prompt_prefix is the GLOBAL PROMPT above - it is added "
                + "for you; put your work in `shots`."
              : "\n\nThe prompt_prefix is already written for you; return it "
                + "unchanged as `prompt_prefix` and put your work in `shots`:\n"
                + JSON.stringify(writerPrefix))
          // 2.299.0: the saved prompt already rode first (globalFirst)
          + (globalFirst ? "" : prefixNote)
          + (convo ? "\n\nTHE CONVERSATION SO FAR (recalled excerpts — the "
              + "story the user developed with you; the screenplay must tell "
              + "THIS story):\n"
              // 2.294.0: the STORY, not an old chain plan's (S1)/<d> format
              + (native ? mvWriter.storyOnly(convo, wMode) : convo) : "") },
      { role: "user", content: String(b.brief || b.prompt || "").slice(0, 8000)
          || "Write a short scene for this cast." },
    ];
    try {
      // THE ITERATIVE WRITER (2.182.0, Tim's own design: "if i ask for 8
      // scenes, create each scene separately, clear the context, read the
      // previous scenes (rag) and generate the next scene"). A 26B model
      // that cannot hold an 8-scene JSON in one reply writes ONE scene per
      // call instead: every call is stateless (context cleared by
      // construction), the story so far rides as a recall digest, and the
      // assembled plan takes the SAME normalize/validate/apply tail as the
      // one-shot path. Engaged when the brief names a scene count >= 2;
      // a count-less brief keeps the classic single call.
      let notesProbe = "";
      let nScenes = screenplay.sceneCount(askText);
      /* 2.323.0 (Tim: "the llm counts the scenes (or we have a txt file with
         number of scenes)"): the video docker's Scenes field, else
         projects/<p>/scenes.txt, else the request's number, else the LLM
         (below). A loaded song's segments still win (next block). */
      { const pk = sceneCount.pick(scenes.load(b.project).scene_count,
          core.projDir(b.project || core.getProject()), nScenes);
        if (pk) { nScenes = pk.n; notesProbe = `${pk.n} scene(s) - from ${pk.source}`; } }
      /* 2.285.0 (Tim: "have the llm create number of scenes = number of
         segments ... auto assign the duration for each scene"): a segment
         map is the count's single source of truth when one exists - the
         song named in the request, else the last split's base. Each
         round then pins its scene's LENGTH to its segment (seconds x 24,
         snapped by normalize), so the board's durations mirror the red
         lines in the stems dock. */
      let segMap = null;
      try {
        /* 2.289.0: the BOARD'S song leads after the request's own - the
           map the video docker's 💾 (or the stems dock's 📤) staged is the
           one the blank scenes came from, so the writer counts the same
           segments. The last split is the pre-pivot fallback. */
        const stSeg = scenes.load(b.project);
        /* 2.323.0: a native board with NO song is a screenplay - the last
           split of some other song must not decide its scenes */
        const segSong = b.song || stSeg.seg_song || stSeg.audio
          || (native && wMode === "dialogue" ? ""
            : (stems.lastSplit() ? stems.lastSplit().base + stems.lastSplit().ext : ""));
        if (segSong) {
          const sm = stems.segments(segSong);
          if (sm && sm.total > 0 && (sm.file || (sm.durations || []).length))
            segMap = sm;
        }
      } catch { /* no song, no map - the probe decides as before */ }
      if (segMap && (segMap.durations || []).length && b.single !== true) {
        nScenes = segMap.durations.length;
        notesProbe = `${nScenes} scene(s) - one per song segment `
          + `(${segMap.file || "15s grid"})`;
      }
      // ITERATIVE BY DEFAULT (2.186.0, Tim: "it is still trying to write
      // all the scenes at once, it will run out of context. i would like
      // it to write 1 scene, save the scene to the video docker, then
      // clear the context and read the previously generated scenes and
      // create the next scene and repeat"). The count gate was the bug —
      // a brief without a digit fell back to the whole-plan single call.
      // Now: no count in the brief -> ONE tiny probe call asks the model
      // for a number (clamped 1..20, fallback 4). single:true is the
      // explicit whole-plan escape (tests and power users).
      if (!nScenes && b.single !== true) {
        try {
          const pr = await llmChat.complete(core, { messages: [
            { role: "system", content: "Reply with ONLY a number." },
            { role: "user", content: "How many scenes (1-20) should this "
              + "story have? " + (askText || "a short story") } ],
            max_tokens: 12, llm_file: b.llm_file });
          const m = /\d{1,2}/.exec(String((pr && pr.text) || ""));
          nScenes = m ? Math.min(20, Math.max(1, parseInt(m[0], 10))) : 4;
        } catch { nScenes = 4; }
        notesProbe = `the model chose ${nScenes} scene(s) for this brief`;
      }
      if (nScenes >= 1 && b.single !== true) {
        const shots = [];
        const nativeFixes = [];      // 2.294.0: deterministic repairs, said
        /* 2.293.0 (Tim: "can we populate each scene as they are created so
           users with 2 gpu's can start rendering while waiting for new
           scenes to be created"): with the board's "▶ as written" switch
           on, each scene joins the render queue as it lands (lib/
           autoRender decides live vs after-the-writer from the two cards).
           ComfyUI is brought up BESIDE the writer - never in its way: the
           scenes queue as state at once, and the queue is only kicked once
           ComfyUI and the style's converted base are ready. */
        const ar = autoRender.mode(core.getConfig(), scenes.load(b.project));
        const arNotes = ar.note ? [ar.note] : [];
        const arQueued = [];
        let arState = ar.mode === "off" ? "off" : "starting";
        const arReady = ar.mode === "off" ? Promise.resolve("") : (async () => {
          try { await comfy.ensure({ force: true }); }
          catch (e) { return "ComfyUI is not up and could not be started ("
            + String(e.message || e) + ") - the scenes are written; press ▶ "
            + "when it is up"; }
          try {
            const eb = await ensureChainBase(scenes.load(b.project).style);
            return eb.ok ? "" : String(eb.error || "the workflow could not be prepared");
          } catch (e) { return String(e.message || e); }
        })().then((why) => {
          arState = why ? "failed" : "ready";
          if (why) {
            arNotes.push("▶ as written stopped: " + why);
            // take OUR queued scenes back out - a launch would only fail
            try {
              const st1 = scenes.load(b.project);
              const mine = new Set(arQueued.map((n) => (scenes.at(st1, n) || {}).id));
              scenes.save({ ...st1, pending: (st1.pending || []).filter((id) => !mine.has(id)) },
                          b.project);
            } catch { /* best-effort */ }
          } else if (ar.mode === "live" && arQueued.length) {
            try { syncJobs(b.project); } catch { /* the board's poll advances it */ }
          }
          return why;
        });
        for (let i = 1; i <= nScenes; i++) {
          const sofar = shots.length
            ? "\n\nSCENES ALREADY WRITTEN (the story so far — continue it "
              + "directly, do not restart or repeat):\n"
              + screenplay.sceneDigest(shots, 6000)
            : "";
          const segLine = segMap && segMap.durations && segMap.durations[i - 1] > 0
            ? `\nThis scene covers song segment ${i}, which lasts `
              + `${Math.round(segMap.durations[i - 1] * 10) / 10} seconds - `
              + "its length is set for you; write the action and lip-sync "
              + "to fill exactly that stretch of the song."
            : "";
          const ask = segLine + `\n\nWrite ONLY scene ${i} of ${nScenes} — a NEW scene `
            + "that CONTINUES the story after the scenes already written; "
            + "never rewrite or repeat an earlier scene — as ONE JSON "
            + 'object {"shots":[{ ... exactly one shot ... }]} — no prose, '
            + "no markdown, no other scenes.";
          const mi = [
            { role: "system", content: msgs[0].content + sofar + ask },
            { role: "user", content: askText || "continue the story" },
          ];
          // ALL THE SCENES WERE IDENTICAL (2.190.0, Tim: "the llm is not
          // writing a new scene each time or we are copying a cached scene
          // ... it should read all the previous scenes and create new
          // scenes"). Two model habits, one blind loop: a model handed the
          // full plan-writing guide often answers scene i with the WHOLE
          // story (or the story so far plus the new scene), and the loop
          // took shots[0] every time — scene 1, N times over. And a model
          // that simply re-writes scene 1 despite the digest was never
          // caught. So: (a) when the reply carries several shots, scene i
          // lives at index i-1 when there are at least i, else it is the
          // LAST one (both full-plan and story-so-far-plus-new answers
          // agree); (b) a chosen shot whose prompt text matches an earlier
          // scene verbatim is a DUPLICATE — one correcting retry names it,
          // and a second copy fails loudly rather than silently rendering
          // N identical scenes.
          const promptKey = (sh) => ((sh && sh.prompt) || [])
            .map((l) => String(l)).join(" ").replace(/\s+/g, " ").trim();
          let shot = null, lastRaw = "", why = "", nativeProbs = [];
          for (let attempt = 0; attempt < 2 && !shot; attempt++) {
            // THE RETRY MUST ALTERNATE (2.188.0, Tim's card verbatim:
            // "Unable to generate parser for this template ...
            // raise_exception('After the optional system message, con...").
            // Strict chat templates (Mistral/Gemma family) refuse two user
            // turns in a row, and the old retry was [system, user, user] —
            // scene 7/8 died the moment attempt 0 failed to parse. The
            // model's own failed reply rides as the assistant turn (the
            // classic repair round's shape), which is also the better
            // prompt: the model sees exactly what it wrote wrong.
            const correction = why === "duplicate"
              ? `That is a COPY of an earlier scene. Write scene ${i} of `
                + `${nScenes} — a NEW scene with NEW action that continues `
                + "the story. Reply with ONLY the JSON."
              : why === "native"
              // 2.294.0: the music-video rules it broke, in words
              ? `That scene breaks the music-video rules: ${nativeProbs.join("; ")}. `
                + `Rewrite scene ${i} of ${nScenes} with the same story beat, `
                + "following the rules. Reply with ONLY the JSON."
              : "That was not ONE JSON object with exactly one shot. "
                + "Reply with ONLY the JSON.";
            const ri = await llmChat.complete(core, { messages: attempt
                ? mi.concat([
                    { role: "assistant", content: (lastRaw || "(no reply)").slice(0, 8000) },
                    { role: "user", content: correction }])
                : mi,
              max_tokens: Math.max(1500,
                ((core.getConfig().llm || {}).max_tokens | 0)),
              llm_file: b.llm_file });
            if (!ri || ri.ok === false)
              return res.status(ri?.status || 500).json({ error:
                `scene ${i}/${nScenes}: ` + (ri?.error || "the model did not answer") });
            lastRaw = ri.text || "";
            const p = screenplay.parseReply(lastRaw);
            if (p && Array.isArray(p.shots) && p.shots.length) {
              const cand = p.shots.length >= i
                ? p.shots[i - 1] : p.shots[p.shots.length - 1];
              const key = promptKey(cand);
              if (!key) { why = "not-json"; continue; }
              if (shots.some((s0) => promptKey(s0) === key)) { why = "duplicate"; continue; }
              if (native) {
                /* 2.294.0: dialogue markup, speaker IDs, invented tags or
                   no singing line - one correcting retry names them; the
                   second answer is repaired deterministically, said in
                   the notes */
                const pr = mvWriter.problems(cand, cast, envs.list(b.project),
                                             chapterRefs.tags(b.project), wMode);
                if (pr.length && attempt === 0) { why = "native"; nativeProbs = pr; continue; }
                if (pr.length) {
                  const rp = mvWriter.repair(cand, cast, envs.list(b.project),
                                             chapterRefs.tags(b.project), wMode);
                  if (rp.changes.length) nativeFixes.push(`scene ${i}: ` + rp.changes.join(", "));
                  shot = rp.shot;
                  continue;
                }
                /* 2.323.0: a screenplay scene's "seconds" become its length
                   (the repair is also the converter; nothing else changes) */
                if (wMode === "dialogue") {
                  shot = mvWriter.repair(cand, cast, envs.list(b.project),
                                         chapterRefs.tags(b.project), wMode).shot;
                  continue;
                }
              }
              shot = cand;
            } else why = "not-json";
          }
          if (!shot) return res.status(422).json({ error:
            why === "duplicate"
            ? `scene ${i}/${nScenes}: the model returned a COPY of an earlier `
              + "scene twice in a row — it is not continuing the story. Try a "
              + "bigger model for the screenplay, or add the missing scenes "
              + "one at a time with the Add Scene box."
            : `scene ${i}/${nScenes}: the model did not return a one-shot JSON — `
              + (screenplay.parseProblem(lastRaw) || "unrecognized reply")
              + (lastRaw.trim() ? ` · it said: "${lastRaw.trim().slice(0, 160)}`
                                + `${lastRaw.trim().length > 160 ? "…" : ""}"` : ""),
            scenes_written: shots.length });
          shot.id = `clip_${String(i).padStart(2, "0")}`;
          if (segMap && segMap.durations && segMap.durations[i - 1] > 0)
            // 2.285.0: the scene lasts exactly its segment - seconds x 24
            // frames; normalize snaps to the grid and clamps the ceiling
            shot.length = Math.max(1, Math.round(segMap.durations[i - 1] * 24));
          shots.push(shot);
          // SAVE TO THE VIDEO DOCKER AS IT WRITES (2.186.0, his words):
          // the board shows scene i the moment it exists — a crash at
          // scene 5 keeps scenes 1-4 saved, and refresh shows progress.
          try {
            const partial = screenplay.normalize(
              { prompt_prefix: writerPrefix, shots },
              scenes.chainOverrides(b.project));
            const st0 = scenes.load(b.project);
            // 2.293.0: the seed normalize drew is written BACK into the
            // shot, so every later save (and the final plan) keeps it -
            // a scene rendering from this save renders the plan's seed
            partial.shots.forEach((ps, k) => {
              if (shots[k] && (shots[k].seed === undefined || shots[k].seed === ""))
                shots[k].seed = ps.seed;
            });
            /* 2.293.0: staged BLANK scenes past the ones written (the
               video docker's .seg staging, lib/segBoard) stay on the board
               while the writer works - before, the first save dropped them
               and the board shrank to the scenes written so far */
            // 2.358.0: the board's BRIDGES are not the writer's - fromPlan weaves them back in
            const staged = ((st0.plan || {}).shots || []).filter((sh) => !(sh && sh.bridge)).slice(shots.length)
              .filter((sh) => sh && segBoard.isBlank(sh.prompt));
            const withStaged = staged.length
              ? { ...partial, shots: partial.shots.concat(staged) } : partial;
            scenes.save(scenes.fromPlan(withStaged, st0), b.project);
            if (arState === "starting" || arState === "ready") {
              if (ar.mode === "live") {
                // 2.358.0: the writer's scene i is the board's i-th CONTENT scene (bridges sit between)
                const stW = scenes.load(b.project);
                const q = autoRender.queueWritten(stW, [sceneBridge.contentN(stW, i) || i]);
                scenes.save(q.state, b.project);
                arQueued.push(...q.queued);
                if (arState === "ready") syncJobs(b.project);
              }
            }
          } catch { /* the final apply still lands the whole plan */ }
        }
        if (ar.mode !== "off") {
          const why = await arReady;
          if (!why && ar.mode === "after") {
            // one card: hand the LLM's VRAM to the render first
            try {
              if (core.llamaState().proc) {
                core.stopLlama();
                await core.gpuSettle(ar.devices.llm);
                arNotes.push("the LLM was stopped to free " + ar.devices.llm
                  + " for the render (it reloads on the next chat message)");
              }
            } catch { /* best-effort */ }
            const stW = scenes.load(b.project);
            const q = autoRender.queueWritten(stW,
              shots.map((_, k) => sceneBridge.contentN(stW, k + 1) || k + 1));
            scenes.save(q.state, b.project);
            arQueued.push(...q.queued);
            syncJobs(b.project);
          }
          if (!why) arNotes.push(`${arQueued.length} scene(s) queued to render `
            + (ar.mode === "live" ? "as they were written" : "now the writer is done"));
        }
        const plan = { prompt_prefix: writerPrefix, shots };
        let norm = screenplay.normalize(plan, scenes.chainOverrides(b.project));
        if (notesProbe) { /* carried into notes below */ }
        const v = screenplay.validate(norm, cast, envs.list(b.project), chapterRefs.tags(b.project));
        const notes = [`written scene by scene (${nScenes} calls, context `
          + "cleared between scenes, the story so far recalled into each)"];
        if (notesProbe) notes.push(notesProbe);
        notes.push(...arNotes);
        if (native) notes.push("music-video writer rules (MMH3_NativeAudio_MV): "
          + "the song is the voice - no dialogue, no speaker IDs, cast tags only");
        for (const f of nativeFixes) notes.push("repaired " + f);
        if (v.ok && chatPrior.length) {
          const lim = Number((core.getConfig().llm || {}).big_model_gb);
          const limit = Number.isFinite(lim) ? lim : 12;
          const gb = limit > 0 ? llmChat.modelSizeGb(core, b.llm_file) : 0;
          if (limit > 0 && gb >= limit) {
            const prev = chatStore.currentSession(core.pDir("chat"));
            chatStore.newSession(core.pDir("chat"));
            notes.push(`chat saved as ${prev} and the context cleared `
              + `(${gb.toFixed(1)} GiB model ≥ ${limit} GiB) — the story `
              + "rode into this screenplay via recall; load the chat back "
              + "from the chat menu any time");
          }
        }
        return res.json({ ok: v.ok, plan: norm, errors: v.errors,
                          warnings: v.warnings.concat(notes),
                          iterative: nScenes,
                          // 2.293.0: what ▶ as written did (the chat says it)
                          rendering: { mode: ar.mode, queued: arQueued } });
      }
      // A whole screenplay is LONG: at the default 600-token budget the JSON
      // is cut off mid-object every time, so this call carries its own.
      // llm_file rides through (2.145.0) so the screenplay uses the model the
      // user PICKED, not the alphabetically-first .gguf in the folder.
      const r = await llmChat.complete(core, { messages: msgs,
                                               // 4096 is the FLOOR (a plan never
                                               // fits in less); the slider can
                                               // only raise it (2.148.0)
                                               max_tokens: Math.max(4096,
                                                 ((core.getConfig().llm || {}).max_tokens | 0)),
                                               llm_file: b.llm_file });
      if (!r || r.ok === false)
        return res.status(r?.status || 500).json({ error: r?.error || "the model did not answer" });
      // complete() already returns readReply()'s {ok, text} — unwrapping it a
      // SECOND time found no `choices`, produced an error object, and
      // String()ed it into "[object Object]", so every screenplay failed with
      // "did not return a JSON plan" no matter what the model said. The text
      // is already thinking-stripped; parseReply strips again for belt and
      // braces.
      const raw = r.text || "";
      const plan = screenplay.parseReply(raw);
      if (!plan) return res.status(422).json({
        error: "the model did not return a JSON plan — "
             + (screenplay.parseProblem(raw) || "unrecognized reply")
             // the model's OWN opening words (2.152.0): "not populating the
             // scenes" is undebuggable blind — a refusal, a prose ramble and
             // a truncation each read completely differently
             + (raw.trim() ? ` · it said: "${raw.trim().slice(0, 160)}`
                           + `${raw.trim().length > 160 ? "…" : ""}"` : ""),
        reply: String(raw).slice(0, 2000) });
      // Whatever it sent back, the prefix is OURS. A model that paraphrased the
      // character paragraphs would quietly redescribe the cast.
      plan.prompt_prefix = writerPrefix;
      // 2.294.0: the native-audio board's rules, repaired deterministically
      // on the whole-plan path (the iterative path retries first)
      const singleFixes = [];
      if (native && Array.isArray(plan.shots)) plan.shots = plan.shots.map((sh, k) => {
        const rp = mvWriter.repair(sh, cast, envs.list(b.project), chapterRefs.tags(b.project), wMode);
        if (rp.changes.length) singleFixes.push(`repaired scene ${k + 1}: ` + rp.changes.join(", "));
        return rp.shot;
      });
      // normalize BEFORE validating: normalize now repairs beat spacing, so
      // warning about what was already fixed would only shout at the user
      let norm = screenplay.normalize(plan, scenes.chainOverrides(b.project));
      let v = screenplay.validate(norm, cast, envs.list(b.project), chapterRefs.tags(b.project));
      const notes = (r.note ? [r.note] : []).concat(singleFixes);
      if (!v.ok && v.errors.every((e) => /has no character in this project/.test(e))) {
        /* 2.281.0 (Tim: "the llm is getting confused, it is not adding the
           right characters"): when the ONLY sin is invented @tags, repair
           DETERMINISTICALLY — one cast member: every invented tag IS the
           singer, map it; several: strip the token. No model round needed
           for a pure copy mistake, and every substitution is said in the
           chat. Anything else still goes to the model with the errors. */
        const rt = screenplay.repairTags(norm, cast, envs.list(b.project),
                                         chapterRefs.tags(b.project));
        if (rt.changes.length) {
          const norm0 = screenplay.normalize(rt.plan, scenes.chainOverrides(b.project));
          const v0 = screenplay.validate(norm0, cast, envs.list(b.project),
                                         chapterRefs.tags(b.project));
          if (v0.ok) {
            notes.push(...rt.changes.map((c) => "tag repair: " + c));
            norm = norm0; v = v0;
          }
        }
      }
      if (!v.ok) {
        // THE REPAIR ROUND (2.154.0, Tim: supergemma4 "returns ⚠ the
        // screenplay would not render ... it does not populate the scenes").
        // The validator's messages are written to TEACH — so teach the model:
        // hand its own plan back with every error, once. Big creative models
        // routinely miss one rule on the first pass and fix it cleanly when
        // told which; failing the user over a repairable plan is the wrong
        // ending. One round only — a model that cannot repair with the
        // errors in hand will not do better on a third try.
        const repair = await llmChat.complete(core, {
          messages: msgs.concat([
            // the PARSED plan, compact — not the raw reply: the raw carries
            // think-blocks and prose that bloat the context (a big first
            // plan + the guide could pass llm.ctx and garble the retry into
            // non-JSON, which is exactly what Tim saw), and the parsed JSON
            // is the thing being corrected anyway
            { role: "assistant", content: JSON.stringify(plan).slice(0, 8000) },
            { role: "user", content:
              "That plan failed validation with these errors:\n"
              + v.errors.map((e) => "- " + e).join("\n")
              + "\n\nThe ONLY characters that exist are: "
              + (cast.length ? cast.map((c) => `@${c.tag} (${c.slot || "no slot"})`).join(", ")
                             : "none")
              + ". Replace any other @tag with one of these or remove that line."
              + "\n\nReturn ONLY the corrected JSON plan — the same structure "
              + "and scenes, with every error above fixed and nothing else "
              + "changed. No prose, no code fences." }]),
          max_tokens: Math.max(4096, ((core.getConfig().llm || {}).max_tokens | 0)),
          llm_file: b.llm_file });
        const fixedRaw = (repair && repair.ok !== false && repair.text) || "";
        const fixed = fixedRaw ? screenplay.parseReply(fixedRaw) : null;
        if (fixed) {
          fixed.prompt_prefix = writerPrefix;
          const norm2 = screenplay.normalize(fixed, scenes.chainOverrides(b.project));
          const v2 = screenplay.validate(norm2, cast, envs.list(b.project), chapterRefs.tags(b.project));
          if (v2.ok) {
            notes.push(`the model's first plan failed validation (${v.errors.length} `
              + "error(s)) and was repaired on a second pass");
            norm = norm2; v = v2;
          } else {
            // the repair's verdict is the one to show — it is what the model
            // could not fix even with the errors in hand
            norm = norm2; v = v2;
            notes.push("a repair pass was attempted and these errors remained");
          }
        } else if (fixedRaw) {
          // the second reply's own words (2.157.0): "was not a JSON plan"
          // told Tim nothing — a truncation, an apology and a ramble each
          // have a different remedy
          notes.push("a repair pass was attempted but the model's second reply "
            + "was not a JSON plan — the first plan's errors stand. It said: \""
            + fixedRaw.trim().slice(0, 120)
            + (fixedRaw.trim().length > 120 ? "…" : "") + "\"");
        } else if (repair && repair.error) {
          notes.push(`a repair pass was attempted but the model did not answer: ${repair.error}`);
        }
      }
      // BIG-MODEL CHAT ROTATION (2.174.0, "save the chat when a screenplay
      // is asked for, clear the chat context when using models >12gb"): on
      // SUCCESS only — a failed screenplay keeps the conversation intact
      // for the retry. NOT openCopy: 2.164.0's SAVE continues in a fresh
      // COPY (the messages ride along), which is the opposite of clearing.
      // newSession starts EMPTY; the old session file stays on disk in the
      // sessions list, loadable from the chat menu — saved AND cleared.
      if (v.ok && chatPrior.length) {
        const lim = Number((core.getConfig().llm || {}).big_model_gb);
        const limit = Number.isFinite(lim) ? lim : 12;
        const gb = limit > 0 ? llmChat.modelSizeGb(core, b.llm_file) : 0;
        if (limit > 0 && gb >= limit) {
          const dir = core.pDir("chat");
          const prev = chatStore.currentSession(dir);
          chatStore.newSession(dir);
          notes.push(`chat saved as ${prev} and the context cleared `
            + `(${gb.toFixed(1)} GiB model ≥ ${limit} GiB) — the story `
            + "rode into this screenplay via recall; load the chat back from "
            + "the chat menu any time");
        }
      }
      res.json({ ok: v.ok, plan: norm, errors: v.errors,
                 // the fold note (2.152.0) tells the user their model's
                 // template refused the system role and what was done about it
                 warnings: v.warnings.concat(notes),
                 cast: cast.map((c) => c.tag) });
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  }));

  /** Put an accepted screenplay into the tmp graph. Validated again here: the
   *  client could have edited it since, and this is the last gate. */
  app.post("/api/screenplay/apply", trap.guard((req, res) => {
    const b = req.body || {};
    const cast = chars.cast(b.project);      // 2.216.0: the actors IN the scene
    const plan = { ...(b.plan || {}) };
    if (b.regenerate_prefix !== false) plan.prompt_prefix = screenplay.buildPrefix(cast,
      { ...b, refParagraphs: chapterRefs.prefixParagraphs(b.project),
        locations: locationPrefix.lines(envs.list(b.project)) });
    const vnorm = screenplay.normalize(plan, scenes.chainOverrides(b.project));
    const v = screenplay.validate(vnorm, cast, envs.list(b.project), chapterRefs.tags(b.project));
    if (!v.ok) return res.status(400).json({ error: "this screenplay would not render",
                                             errors: v.errors, warnings: v.warnings });
    try {
      // 2.278.0: the plan lands in the BOARD STYLE'S OWN tmp — with the
      // board on MMH3_Music_Video, apply used to write MM3_Characters_tmp
      // and report that file, which misled (▶ re-synced the right tmp, so
      // renders were correct; the reply was not). The MM3 tmp stays the
      // fallback while a chain's base is unconverted (first ▶ converts it).
      const st0 = scenes.load(b.project);
      const ch0 = chainFor(st0.style);
      const applyTmp = fs.existsSync(wfPath(ch0.base)) ? ch0.tmp : TMP_STYLE;
      syncTmp(b.project, "screenplay applied", "", undefined, st0.style);
      const g = JSON.parse(fs.readFileSync(wfPath(applyTmp), "utf8"));
      const norm = vnorm;
      const w = screenplay.writePlan(g, norm, scenes.chainOverrides(b.project));
      const scened = applyScenes(w.graph, b);
      fs.writeFileSync(wfPath(applyTmp), JSON.stringify(scened.graph, null, 2), "utf8");
      // THE BOARD DERIVES HERE. The plan is the truth (scene board rule): the
      // same normalized plan that went into the graph becomes the scene list,
      // carrying render state over by shot id, and is stored on the board so
      // the next cast-change rebuild of the tmp graph cannot lose it.
      const board = scenes.save(
        scenes.fromPlan(norm, scenes.load(b.project)), b.project);
      /* 2.216.0 (by instruction: "store every chapter that they are in in
         their folder so they will have a memory as chapter name.history
         files"). The saved board is the truth about which shot belongs to
         which chapter, so the memory derives HERE: per chapter, each cast
         member whose @tag appears in a shot's prompt gets that chapter's
         shots (their scenes, full text) written as <chapter>.history in
         their folder. Re-applying a chapter REWRITES its file — memory
         follows the screenplay, it does not accumulate stale drafts. A
         memory write must never fail the apply. */
      try {
        const byChap = new Map();
        for (const r of board.list) {
          const key = r.chapter || "chapter";
          if (!byChap.has(key)) byChap.set(key, []);
          byChap.get(key).push(r);
        }
        for (const [chap, rows] of byChap) {
          for (const c of cast) {
            const tag = "@" + (c.tag || chars.tagOf(c.name));
            const mine = rows.filter((r) =>
              (r.prompt || []).some((ln) => String(ln).includes(tag)));
            if (!mine.length) continue;
            const text = mine.map((r) =>
              `scene ${r.n}:\n${(r.prompt || []).join("\n")}`).join("\n\n");
            chars.writeHistory(c.name, chap, text, b.project);
          }
        }
      } catch { /* memory is best-effort; the screenplay itself already applied */ }
      res.json({ ok: true, file: applyTmp, shots: (b.plan.shots || []).length,
                 scenes: board.list.length,
                 notes: w.notes.concat(scened.notes), warnings: v.warnings });
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  }));

  app.get("/api/screenplay/guide", (req, res) =>
    // 2.294.0: the guide the writer ACTUALLY gets for this board
    res.json({ guide: mvWriter.isNative(scenes.load(req.query.project).style)
      ? mvWriter.guideFor(scenes.load(req.query.project), chars.cast(req.query.project), envs.list(req.query.project),
                       chapterRefs.tags(req.query.project))
      : screenplay.guide(chars.cast(req.query.project), envs.list(req.query.project)) }));

  // ---- 360° environments (2.142.0) ---------------------------------------
  // A location is a 360 pano + a camera (yaw/pitch/fov, the 360 viewer's own
  // conventions) + a scene range. Its projected VIEW rides the reference
  // chain with its tag, so every scene in that range sees the same place.
  app.get("/api/environments", (req, res) =>
    res.json({ environments: envs.list(req.query.project) }));

  /* 2.299.0 (Tim: "add location tag to global prompt if location is
     set"): every location change rebuilds the global prompt's
     location_definitions block (lib/locationPrefix) - answered as
     prefix_note / prefix_error beside the route's own reply */
  const locSync = (project) => {
    try {
      const r = locationPrefix.sync(project, { scenes, screenplay, chars, envs, chapterRefs });
      return r.error ? { prefix_error: r.error } : r.changed ? { prefix_note: r.note } : {};
    } catch (e) { return { prefix_error: String(e.message || e) }; }
  };
  app.post("/api/environments", (req, res) => {
    const b = req.body || {};
    const r = envs.save(b, b.project);
    if (r.error) return res.status(400).json({ error: r.error });
    const v = envs.extractView(r.env.name, b.project,
                               { width: core.getConfig().defaults.width,
                                 height: core.getConfig().defaults.height });
    syncTmp(b.project, "environment saved");
    res.json({ ok: true, env: envs.get(r.env.name, b.project),
               ...(v.error ? { note: v.error } : {}), ...locSync(b.project) });
  });

  /* 2.223.10 (by instruction): the location dialog's creator tab — a
     GENERATED image (already in outputs/) becomes the pano without a
     round-trip through the browser: same setPano + extractView + syncTmp
     as the multipart route, minus the upload and minus the unlink (the
     outputs render stays where it is). */
  app.post("/api/environments/:name/pano-from", (req, res) => {
    const b = req.body || {};
    const f = String(b.file || "");
    if (!f || f.includes("..") || f.includes("/") || f.includes("\\"))
      return res.status(400).json({ error: "file must be a bare outputs name" });
    const src = path.join(core.OUTPUT_DIR, f);
    if (!fs.existsSync(src)) return res.status(404).json({ error: "no such render: " + f });
    const r2 = envs.setPano(req.params.name, src, f, b.project);
    if (r2.error) return res.status(400).json({ error: r2.error });
    const v = envs.extractView(req.params.name, b.project,
                               { width: core.getConfig().defaults.width,
                                 height: core.getConfig().defaults.height });
    syncTmp(b.project, "environment pano");
    res.json({ ok: true, view: v && v.error ? null : v, view_error: v && v.error,
               ...locSync(b.project) });
  });
  app.post("/api/environments/:name/pano", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "no file" });
    const b = req.body || {};
    const r = envs.setPano(req.params.name, req.file.path,
                           req.file.originalname, b.project);
    fs.unlink(req.file.path, () => {});
    if (r.error) return res.status(400).json({ error: r.error });
    const v = envs.extractView(req.params.name, b.project,
                               { width: core.getConfig().defaults.width,
                                 height: core.getConfig().defaults.height });
    syncTmp(b.project, "environment pano");
    res.json({ ok: true, env: envs.get(req.params.name, b.project),
               ...(v.error ? { note: v.error } : {}), ...locSync(b.project) });
  });

  app.get("/api/environments/:name/file/:file", (req, res) => {
    const f = path.join(envs.envDir(req.params.name, req.query.project),
                        path.basename(req.params.file));
    if (!fs.existsSync(f)) return res.status(404).json({ error: "not found" });
    res.sendFile(f);
  });

  app.delete("/api/environments/:name", (req, res) => {
    const ok = envs.remove(req.params.name, req.query.project);
    syncTmp(req.query.project, "environment removed");
    res.json({ ok, ...locSync(req.query.project) });
  });

  /** Does this chat message ask for a screenplay? The chat box asks HERE so
   *  the matcher has one home (lib/screenplay.js) instead of a second copy in
   *  the page — a question ABOUT screenplays stays an ordinary chat turn. */
  app.post("/api/screenplay/intent", trap.guard((req, res) => {
    const t = (req.body || {}).text;
    // EDIT is checked first (2.162.0): "change scene 2 ..." must never be
    // read as a request for a whole new screenplay or a new scene
    res.json({ edit: screenplay.wantsEditScene(t),
               add: screenplay.wantsAddScene(t),
               wants: screenplay.wantsScreenplay(t),
               // 2.275.0: a music-video ask — the videodock switches the
               // board's workflow, runs the SAME writer, then re-binds the
               // song's 15s segments to the fresh scenes
               music_video: screenplay.asksForMusicVideo(t) });
  }));

  /** REWRITE ONE SCENE from a chat instruction (2.162.0, by instruction:
   *  "edit scene 2 make it more realistic"). One LLM call with a tight
   *  contract, then the SAME normalize→validate→fromPlan gate as every
   *  other prompt writer — an edited scene resets to idle, take kept. */
  app.post("/api/scenes/:n/rewrite", trap.guard(async (req, res) => {
    const b = req.body || {};
    const inst = String(b.instruction || "").trim();
    if (!inst) return res.status(400).json({
      error: "tell me what to change — e.g. \"edit scene 2 make it more realistic\"" });
    const st = scenes.load(b.project);
    const r = scenes.at(st, parseInt(req.params.n, 10));
    if (!r) return res.status(404).json({ error: "no such scene" });
    if (!st.plan || !Array.isArray(st.plan.shots))
      return res.status(400).json({ error: "the board has no plan to edit" });
    const cast = chars.cast(b.project);      // 2.216.0: the actors IN the scene
    const roster = cast.length
      ? cast.map((c) => `@${c.tag} (${c.slot || "no slot"})`).join(", ") : "none";
    // 2.294.0: a native-audio board rewrites by ITS rules (no dialogue)
    const nativeRw = mvWriter.isNative(st.style);
    const rwMode = mvWriter.modeOf(st);         // 2.323.0
    const rr = await llmChat.complete(core, {
      messages: [
        { role: "system", content: nativeRw
          ? mvWriter.guide(cast, envs.list(b.project), chapterRefs.tags(b.project), rwMode)
            + "\n\n" + mvWriter.castLine(cast)
            + `\n\nYou rewrite ONE scene of this ${rwMode === "dialogue" ? "film" : "music video"}. Return ONLY JSON `
            + "of the shape {\"prompt\": [\"line\", ...]} — no prose, no code "
            + "fences. Keep the [Shot N] marker."
          : "You rewrite ONE shot of an H3 screenplay. Return ONLY JSON of the "
          + "shape {\"prompt\": [\"line\", ...]} — no prose, no code fences. "
          + "Keep the [Shot N] marker, the @tag/(S-slot) speaker lines, and "
          + "dialogue as <d>[Language] ...</d> glued under its speaker line. "
          + "The ONLY characters that exist are: " + roster + "." },
        { role: "user", content:
          "The shot as it stands:\n" + (r.prompt || []).join("\n")
          + "\n\nRewrite it per this instruction: " + inst }],
      max_tokens: Math.max(1024, ((core.getConfig().llm || {}).max_tokens | 0)),
      llm_file: b.llm_file });
    if (!rr || rr.ok === false)
      return res.status(rr?.status || 500).json({ error: rr?.error || "the model did not answer" });
    const parsed = screenplay.parseReply(rr.text || "");
    if (!parsed || !Array.isArray(parsed.prompt))
      return res.status(422).json({ error: "the model did not return the rewritten shot — "
        + (screenplay.parseProblem(rr.text || "") || "unrecognized reply")
        + ((rr.text || "").trim() ? ` · it said: "${(rr.text || "").trim().slice(0, 140)}"` : "") });
    const plan = JSON.parse(JSON.stringify(st.plan));
    const shot = plan.shots.find((x) => x && String(x.id) === r.id);
    if (!shot) return res.status(404).json({ error: `shot ${r.id} is not in the plan` });
    shot.prompt = parsed.prompt.map(String);
    const rwNotes = [];
    if (nativeRw) {
      const rp = mvWriter.repair(shot, cast, envs.list(b.project), chapterRefs.tags(b.project), rwMode);
      shot.prompt = rp.shot.prompt;
      if (rp.changes.length) rwNotes.push("repaired for the music video: " + rp.changes.join(", "));
    }
    const norm = screenplay.normalize(plan, scenes.chainOverrides(b.project));
    const v = screenplay.validate(norm, cast, envs.list(b.project), chapterRefs.tags(b.project));
    if (!v.ok) return res.status(400).json({ error: "the rewrite would not render",
                                             errors: v.errors, warnings: v.warnings });
    res.json({ ok: true, n: r.n, ...scenes.save(scenes.fromPlan(norm, st), b.project),
               warnings: v.warnings.concat(rr.note ? [rr.note] : [], rwNotes) });
  }));

  // ---- the scene board ---------------------------------------------------
  /** The board, reconciled with the job queue on every read (the UI polls). */
  /* 2.312.0: THE VIDEO DOCKER'S ⚙ - one record per project
     (lib/renderSettings); the LoRA list is the video temp LoRAs, served
     alongside so the dropdown paints in one fetch */
  app.get("/api/scenes/render-settings", (req, res) => {
    const pdir = core.projDir(core.getProject());
    let pack = null;
    try { pack = require("../lib/comfy").packInstalled("upscale"); } catch { /* no comfy lib */ }
    res.json({ settings: renderSettings.read(pdir), loras: tempLoras.read(pdir, "video"), upscale_pack: pack,
               options: { res: renderSettings.RES, aspects: renderSettings.ASPECTS,
                          upscale_res: renderSettings.UPSCALE_RES } });
  });
  app.post("/api/scenes/render-settings", (req, res) => {
    try {
      const pdir = core.projDir(core.getProject());
      const s = renderSettings.save(pdir, (req.body || {}).settings || req.body || {});
      const probe = renderSettings.jobOverrides(s, { width: (core.getConfig().defaults || {}).width,
        height: (core.getConfig().defaults || {}).height, style: { name: "probe" } });
      res.json({ saved: true, settings: s, preview: { width: probe.width, height: probe.height,
        upscale: probe.upscale_stage, notes: probe.notes } });
    } catch (e) { res.status(400).json({ error: String(e.message || e) }); }
  });

  app.get("/api/scenes", (req, res) => {
    // 2.308.0: the poll that reconciles finished jobs must never die - an
    // exception here used to answer 500 on EVERY poll, so the card stayed
    // "running" and the queue behind it never advanced. Said, then the
    // board as saved.
    let st;
    try { st = syncJobs(req.query.project); }
    catch (e) {
      console.warn(`[scenes] reconcile failed: ${e && e.stack || e}`);
      st = scenes.load(req.query.project);
      st = { ...st, sync_error: String(e && e.message || e).slice(0, 300) };
    }
    // 2.384.0 (Tim: "in videodocker scene, when render is running, say running step n of total and show a progress
    // bar and time taken to render"): a rendering scene carries its job's progress (lib/jobMeta) - not saved
    try {
      const jm = require("../lib/jobMeta");
      st = { ...st, list: (st.list || []).map((r) => {
        let j = r.job && core.jobs.get(r.job);
        // 2.391.1: a running scene whose own job id is not the one rendering it (a chained / re-queued render) - the
        // running job that names this scene gives the step count, so the card never sits on a bare "rendering…"
        if ((!j || j.status === "done" || j.status === "failed") && r.status === "running")
          j = [...core.jobs.values()].find((x) => x && x.status === "running" && ((x.params || {}).scene || {}).n === r.n
            && (!x.project || x.project === (req.query.project || core.getProject()))) || j;
        const pr = j && !j.finished ? jm.progress(j) : null;
        const qd = j && j.status === "queued";
        return pr || qd ? { ...r, progress: pr || { queued: true } } : r;
      }) };
    } catch { /* the board still answers */ }
    res.json({ project: req.query.project || core.getProject(), ...st });
  });

  /** Re-derive the board from an edited plan. Validated first — the last
   *  gate before a plan the board will render from. */
  app.post("/api/scenes", (req, res) => {
    const b = req.body || {};
    if (!b.plan || !Array.isArray(b.plan.shots))
      return res.status(400).json({ error: "a plan with shots is required" });
    const norm = screenplay.normalize(b.plan, scenes.chainOverrides(b.project));
    const v = screenplay.validate(norm, chars.cast(b.project), envs.list(b.project), chapterRefs.tags(b.project));
    if (!v.ok) return res.status(400).json({ error: "this screenplay would not render",
                                             errors: v.errors, warnings: v.warnings });
    const st = scenes.save(scenes.fromPlan(norm, scenes.load(b.project)), b.project);
    res.json({ ok: true, ...st, warnings: v.warnings });
  });

  /** THE EDITABLE BOARD (2.146.0, by instruction: "put an add scene button,
   *  make all the scenes editable, ... add a shared prompt input. populate
   *  the shared prompt like the example shows with character assignments and
   *  tags"). All three writers funnel through the SAME normalize → validate
   *  → fromPlan pipeline as POST /api/scenes — one gate, never a second
   *  copy. The plan stays the truth; scenes are re-derived from it, so an
   *  edited prompt resets THAT scene to idle (fromPlan's same-check) and
   *  every other scene keeps its status. */
  app.post("/api/scenes/prefix", (req, res) => {
    const b = req.body || {};
    const lines = String(b.text == null ? "" : b.text).split("\n");
    const st = scenes.load(b.project);
    const plan = { ...(st.plan || { shots: [] }), prompt_prefix: lines };
    if ((plan.shots || []).length) {
      const norm = screenplay.normalize(plan, scenes.chainOverrides(b.project));
      const v = screenplay.validate(norm, chars.cast(b.project), envs.list(b.project), chapterRefs.tags(b.project));
      if (!v.ok) return res.status(400).json({ error: "this shared prompt breaks the plan",
                                               errors: v.errors, warnings: v.warnings });
      return res.json({ ok: true,
                        ...scenes.save(scenes.fromPlan(norm, st), b.project),
                        warnings: v.warnings });
    }
    // no shots yet: the prefix is stored so Add scene starts from it —
    // validate() would refuse an empty shots array, and refusing to save a
    // shared prompt because no scene exists yet is the wrong order of work
    return res.json({ ok: true, ...scenes.save({ ...st, plan }, b.project), warnings: [] });
  });

  app.post("/api/scenes/:n/prompt", (req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    const r = scenes.at(st, parseInt(req.params.n, 10));
    if (!r) return res.status(404).json({ error: "no such scene" });
    if (!st.plan || !Array.isArray(st.plan.shots))
      return res.status(400).json({ error: "the board has no plan to edit" });
    const plan = JSON.parse(JSON.stringify(st.plan));
    const shot = plan.shots.find((s) => s && String(s.id) === r.id);
    if (!shot) return res.status(404).json({ error: `shot ${r.id} is not in the plan` });
    shot.prompt = String(b.text == null ? "" : b.text).split("\n");
    // NO PER-SCENE DURATION (2.171.0, by instruction: "remove the duration
    // from each scene... use the default duration for all scenes, the
    // workflow doesn't like scenes of different lengths"). A `seconds` an
    // old client still sends is IGNORED — normalize below writes the ONE
    // chain-default length onto every shot; /api/scenes/duration is the
    // only duration control left.
    const norm = screenplay.normalize(plan, scenes.chainOverrides(b.project));
    const v = screenplay.validate(norm, chars.cast(b.project), envs.list(b.project), chapterRefs.tags(b.project));
    if (!v.ok) return res.status(400).json({ error: "this prompt would not render",
                                             errors: v.errors, warnings: v.warnings });
    res.json({ ok: true, ...scenes.save(scenes.fromPlan(norm, st), b.project),
               warnings: v.warnings });
  });

  app.post("/api/scenes/add", trap.guard(async (req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    // first add on an empty board POPULATES the shared prompt from the cast
    // (character assignments and @tags), exactly as the example screenplay
    // carries them — buildPrefix is the ONE writer of that block
    const plan = st.plan && Array.isArray(st.plan.shots)
      ? JSON.parse(JSON.stringify(st.plan))
      : { prompt_prefix: screenplay.buildPrefix(chars.cast(b.project),
          { refParagraphs: chapterRefs.prefixParagraphs(b.project),
        locations: locationPrefix.lines(envs.list(b.project)) }), shots: [] };
    if (!Array.isArray(plan.prompt_prefix) || !plan.prompt_prefix.length)
      plan.prompt_prefix = screenplay.buildPrefix(chars.cast(b.project),
        { refParagraphs: chapterRefs.prefixParagraphs(b.project),
        locations: locationPrefix.lines(envs.list(b.project)) });
    let text = String(b.text == null ? "" : b.text).trim();
    let thought = false, thinkNote = null;
    // THE THINKING ADD (2.182.0, Tim: "when i ask to add a scene it just
    // adds my prompt to the new scene without creating a new scene... make
    // it think of the new scene, read all scenes created and create a new
    // scene based on the previous scenes and my prompt"). One stateless
    // model call: guide + the story so far (recall digest) + his prompt ->
    // ONE new shot. Any failure falls back to the verbatim prompt with a
    // named note — the add NEVER breaks because the model is down.
    if (text && b.raw !== true) {
      try {
        const cast2 = chars.list(b.project);
        // 2.294.0: a native-audio board adds its scenes by ITS rules
        const nativeAdd = mvWriter.isNative(st.style);
        const addMode = mvWriter.modeOf(st);    // 2.323.0
        const mi = [
          { role: "system", content:
              (nativeAdd
                ? mvWriter.guide(cast2, envs.list(b.project), chapterRefs.tags(b.project), addMode)
                  + "\n\n" + mvWriter.castLine(cast2)
                : screenplay.guide(cast2, envs.list(b.project)))
              + chapterRefs.refsBrief(b.project)
              // 2.192.0: the board's shared prompt rides the thinking add
              // too — the new scene must be consistent with what fronts
              // every render (not on the native board: its prefix is the
              // chain's subject definitions and (S1) voice slots)
              + (!nativeAdd && Array.isArray(plan.prompt_prefix) && plan.prompt_prefix.length
                 ? "\n\nTHE SHARED PROMPT (rides in front of every scene — "
                   + "the new scene must be consistent with it):\n"
                   + plan.prompt_prefix.join("\n").slice(0, 4000)
                 // 2.299.0: the music-video board reads it too (no voice slots)
                 : nativeAdd ? mvWriter.globalNote(plan.prompt_prefix, addMode) : "")
              + (plan.shots.length
                 ? "\n\nSCENES ALREADY WRITTEN (the story so far — the new "
                   + "scene must continue them):\n"
                   + screenplay.sceneDigest(plan.shots, 6000)
                 : "")
              + "\n\nTHE USER WANTS THIS NEW SCENE: " + text
              + '\n\nWrite ONLY the new scene as ONE JSON object '
              + '{"shots":[{ ... exactly one shot ... }]} — no prose, no '
              + "markdown, no other scenes." },
          { role: "user", content: text },
        ];
        const ri = await llmChat.complete(core, { messages: mi,
          max_tokens: Math.max(1500, ((core.getConfig().llm || {}).max_tokens | 0)),
          llm_file: b.llm_file });
        const p = ri && ri.ok !== false && ri.text
          ? screenplay.parseReply(ri.text) : null;
        if (p && Array.isArray(p.shots) && p.shots.length
            && Array.isArray(p.shots[0].prompt) && p.shots[0].prompt.length) {
          let sh0 = p.shots[0];
          if (nativeAdd) {
            const rp = mvWriter.repair(sh0, cast2, envs.list(b.project), chapterRefs.tags(b.project), addMode);
            sh0 = rp.shot;
            if (rp.changes.length) thinkNote = "repaired for the music video: " + rp.changes.join(", ");
          }
          text = sh0.prompt.join("\n");
          thought = true;
        } else thinkNote = "the model did not return a one-shot JSON — "
          + "your prompt was added verbatim instead";
      } catch (e) {
        thinkNote = `the model was unreachable (${e.message}) — your prompt `
          + "was added verbatim instead";
      }
    }
    // a FREE id, not a positional one (2.163.0): after a deletion the
    // positions have gaps — normalize's positional idOf would mint clip_03
    // beside a surviving clip_03 and validate rightly refuses the duplicate
    const used = new Set(plan.shots.map((s) => String(s && s.id)));
    let k = plan.shots.length + 1, newId;
    do { newId = `clip_${String(k).padStart(2, "0")}`; k++; } while (used.has(newId));
    plan.shots.push({ id: newId, prompt: text ? text.split("\n")
                                              : ["A new scene — describe the action."] });
    // normalize assigns the id, a digit-built seed, the export DEFAULTS and
    // chains visual_context_source to the shot before it — one copy of those
    // rules, the same one every other plan writer uses
    const norm = screenplay.normalize(plan, scenes.chainOverrides(b.project));
    const v = screenplay.validate(norm, chars.cast(b.project), envs.list(b.project), chapterRefs.tags(b.project));
    if (!v.ok) return res.status(400).json({ error: "this scene would not render",
                                             errors: v.errors, warnings: v.warnings });
    let out = scenes.fromPlan(norm, st);
    // the new scene joins the CURRENT chapter (2.162.0, by instruction:
    // "add a scene to the current chapter") — the chapter the story is in,
    // i.e. the last existing scene's; a scene-less board has none to join
    const prevLast = (st.list || [])[(st.list || []).length - 1];
    if (prevLast && prevLast.chapter)
      out = scenes.setChapter(out, out.list.length, prevLast.chapter).state;
    res.json({ ok: true, ...scenes.save(out, b.project), thought,
               warnings: v.warnings.concat(thinkNote ? [thinkNote]
                 : (thought ? ["the model wrote the new scene from the story "
                              + "so far and your prompt"] : [])) });
  }));

  /** The prefix the cast would produce, for the board's populate button —
   *  shown to the user to edit and save, never written behind their back. */
  app.get("/api/screenplay/prefix", (req, res) =>
    res.json({ prefix: screenplay.buildPrefix(chars.list(req.query.project),
      { refParagraphs: chapterRefs.prefixParagraphs(req.query.project),
        locations: locationPrefix.lines(envs.list(req.query.project)) }) }));

  /** DELETE SELECTED (2.163.0, by instruction). The ticked shots leave the
   *  plan; the continuity chain is HEALED across the gaps (a survivor whose
   *  visual_context_source named a deleted shot now follows the shot before
   *  it — the same rewired-never-cascaded doctrine as the reference chain);
   *  rendered files stay in the gallery, exactly like the movie menu's New. */
  app.post("/api/scenes/delete", (req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    if (!st.plan || !Array.isArray(st.plan.shots))
      return res.status(400).json({ error: "the board has no plan to delete from" });
    const ids = new Set((b.scenes || [])
      .map((n) => { const r = scenes.at(st, parseInt(n, 10)); return r && r.id; })
      .filter(Boolean));
    if (!ids.size) return res.status(400).json({ error: "tick at least one scene to delete" });
    const plan = JSON.parse(JSON.stringify(st.plan));
    plan.shots = plan.shots.filter((s) => !ids.has(String(s && s.id)));
    const alive = new Set(plan.shots.map((s) => String(s.id)));
    plan.shots.forEach((s, i) => {
      if (i === 0) { delete s.visual_context_source; return; }
      if (!s.visual_context_source || !alive.has(String(s.visual_context_source)))
        s.visual_context_source = String(plan.shots[i - 1].id);
    });
    if (!plan.shots.length)
      // deleting everything is a legal outcome — an empty board, like clear;
      // validate() refuses empty shots, so it is stored without the gate
      return res.json({ ok: true, deleted: ids.size,
                        ...scenes.save(scenes.fromPlan(plan, st), b.project) });
    const norm = screenplay.normalize(plan, scenes.chainOverrides(b.project));
    const v = screenplay.validate(norm, chars.cast(b.project), envs.list(b.project), chapterRefs.tags(b.project));
    if (!v.ok) return res.status(400).json({ error: "the deletion would break the plan",
                                             errors: v.errors, warnings: v.warnings });
    res.json({ ok: true, deleted: ids.size,
               ...scenes.save(scenes.fromPlan(norm, st), b.project),
               warnings: v.warnings });
  });

  /** CLEAR SCENES (2.163.0, by instruction): every shot leaves the plan; the
   *  shared prompt and the chapter list STAY (they are the movie's frame,
   *  not its scenes), and the gallery keeps every rendered file. */
  app.post("/api/scenes/clear", (req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    const plan = { ...(st.plan || {}), shots: [] };
    if (!Array.isArray(plan.prompt_prefix)) plan.prompt_prefix = [];
    res.json({ ok: true, cleared: (st.list || []).length,
               ...scenes.save(scenes.fromPlan(plan, st), b.project) });
  });

  /** THE DEFAULT DURATION, APPLIED TO EVERY SCENE (2.165.0, by instruction:
   *  "when the default duration is changed in the video menubar, change all
   *  the scenes duration to match"). Saves chain.length (MERGED — the plain
   *  /api/config POST REPLACES the chain section by design, which would have
   *  wiped the tab's other overrides); normalize then writes the ONE
   *  uniform length onto every shot (2.171.0 — per-scene durations are
   *  gone, "the workflow doesn't like scenes of different lengths"); the
   *  snap and the changed-duration-resets-the-scene rule both apply. This
   *  is now the ONLY duration control in the app. */
  // ---- CHAPTER REFERENCE IMAGES (2.180.0, by instruction) -----------------
  // clothing, poses, two-character compositions — per chapter, injected as
  // LoadImage + ScheduledPictureReference into the tmp at every scene queue.
  app.post("/api/scenes/refs", upload.single("image"), (req, res) => {
    const b = req.body || {};
    if (!req.file) return res.status(400).json({ error: "no file uploaded" });
    try {
      // 2.266.0: a chapter reference can be a SOUND (a song to lipsync);
      // the kind rides the file's own extension
      const snd = /\.(wav|mp3|flac|ogg|m4a)$/i.test(req.file.originalname || "");
      const r = chapterRefs.add(b.project, b.chapter, req.file.path,
                                req.file.originalname, b.label,
                                b.type, b.description,
                                snd ? "sound" : "image");
      fs.unlink(req.file.path, () => {});
      res.json({ ok: true, ...r, refs: chapterRefs.load(b.project) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  // CHARACTER SHEET FROM ONE PICTURE (2.199.0, by instruction: "i upload a
  // picture and it generates the character sheet, i will have option to
  // regenerate or add to characters"). One route owns THE prompt; the job is
  // the same Klein reference-edit image job /api/genimage queues, so the
  // queue, the gallery and the stubs all treat it as any other still.
  // 2.201.0 (Tim: "will the character sheet work with animals as well as
  // humans?") — the MODEL always could; the PROMPT could not: "this exact
  // person ... neutral A-pose ... head-and-shoulders ... same clothing"
  // degrades a horse or a car. Subject-neutral now, and b.subject ("a
  // horse", "a red pickup truck") pins it outright when given. The rest of
  // the pipeline was already ready: the character editor's TYPE dropdown
  // (person/animal/vehicle) and subjectDefinition handle non-humans.
  const SHEET_PROMPT = "Create a character reference sheet of this exact "
    + "subject: a full-body front view, a full-body side view and a "
    + "full-body back view in a natural, neutral standing stance for this "
    + "kind of subject, plus a close-up front portrait of the head or face "
    + "and a close-up side-profile portrait, arranged in clean panels on a "
    + "flat grey background. Identical subject in every panel — same face "
    + "or markings, same colors, same fur and surface details, and exactly "
    + "what the subject wears or carries in the source picture, if anything "
    + "— nothing added, nothing removed, nothing substituted — "
    + "consistent proportions, concept-art style.";
  // 2.207.0 (Tim: "the current renders might be using the character sheet
  // like an image to image or lineart controlnet holding onto the shapes
  // instead of just the poses ... and artifacts from the reference image is
  // in the sheet"): with a pose template riding SLOT 1 — the image being
  // edited — the render anchors layout and poses to black line figures, and
  // the photo (slot 2) contributes IDENTITY ONLY. The prompt has to say all
  // of that out loud or the model happily edits the photo anyway.
  const SHEET_PROMPT_POSED = "The first picture is a black-and-white "
    + "line-drawing pose template for a character reference sheet: clean "
    + "panels with a full-body front view, a full-body side view and a "
    + "full-body back view, plus a close-up front portrait and a close-up "
    + "side-profile portrait of the head. The second picture shows the "
    + "subject. Redraw the template as a finished character reference sheet "
    + "of that exact subject: keep the template's panel layout and the pose "
    + "in every panel, but replace each line figure with the subject, fully "
    + "rendered. Take ONLY identity from the second picture — the same face "
    + "or markings, colors, fur and surface details, and EXACTLY what the "
    + "subject wears or carries in the second picture, if anything: nothing "
    + "added, nothing removed, nothing substituted. If the subject wears or "
    + "carries nothing in the second picture, it wears and carries nothing "
    + "here either. Never take the second picture's "
    + "pose, camera angle, lighting, background or composition. Do not keep "
    + "the line-drawing style, and do not carry any background or artifacts "
    + "from the second picture into the sheet. Identical subject in every "
    + "panel, consistent proportions, on a flat grey background.";
  // 2.206.0: the dialog's image-style dropdown. Every sheet-capable image
  // style with its live LoRA count and names — the same helper sheetgen
  // picks from, so the dropdown can never disagree with the render.
  // 2.223.7: the character creator's strip — THIS character's generations
  app.get("/api/characters/gens", (req, res) =>
    res.json({ gens: chars.gensList(String((req.query || {}).name || "")) }));
  app.post("/api/characters/gens", (req, res) => {
    const b = req.body || {};
    res.json({ gens: chars.gensAdd(String(b.name || ""), b.add) });
  });
  app.get("/api/characters/sheetstyles", (_req, res) => {
    try { res.json({ styles: sheetStyles.list(core.STYLES_DIR, core.BASE).concat([{ id: "h3charcreator", name: "H3-Character_creator", loras: 0, video: true }]) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/characters/sheetgen", upload.single("image"), (req, res) => {
    const b = req.body || {};
    let refName;
    if (req.file && (req.file.path || req.file.buffer)) {
      const ext = (path.extname(req.file.originalname || "") || ".png").toLowerCase();
      refName = `charsheet-${Date.now().toString(36)}${ext}`;
      fs.mkdirSync(core.pDir("images"), { recursive: true });
      if (req.file.buffer)
        fs.writeFileSync(path.join(core.pDir("images"), refName), req.file.buffer);
      else fs.copyFileSync(req.file.path, path.join(core.pDir("images"), refName));
    } else if (b.file) {                       // REGENERATE reuses the upload
      refName = path.basename(String(b.file));
      if (!fs.existsSync(path.join(core.pDir("images"), refName)))
        return res.status(400).json({ error: `reference ${refName} is not in this project's Images assets any more — upload the picture again` });
    } else return res.status(400).json({ error: "upload a picture of the character" });
    // 2.224.0 FIX: this const lived BELOW the h3charcreator branch that
    // reads it — a temporal-dead-zone ReferenceError killed every
    // H3-Character_creator render since 2.223.12. Declared before first use.
    const photo = path.join(core.pDir("images"), refName);
    // 2.206.0 (Tim: "hybrid horses ... only load loras when there are loras
    // in the style"): the style decision — the chosen one, else the first
    // that swaps to its edit sibling — and the LoRA report both live in
    // lib/sheetStyles.js, the same helper the dialog's dropdown reads, so
    // what renders is what the dropdown SAID would render. The patcher
    // already bypasses every slot a LoRA-less style leaves empty; the rogue
    // LoRAs came from the alphabetical auto-pick landing on a style that
    // carried some, invisibly.
    /* 2.223.12 (by instruction): the H3-Character_creator option — Tim's
       own tested ComfyUI export (comfy_workflows/h3_character_creator.json),
       run AS EXPORTED by the worker's h3sheet branch: the character picture
       fills BOTH LoadImage slots (person + outfit described from the same
       photo), seeds re-roll, and the job returns the look-sheet PNG plus
       the SaveVideo turnaround. Offered ONLY through the sheet dialog's
       sheetstyles listing, nowhere else, per the instruction. */
    if (b.style_id === "h3charcreator") {
      if ((core.getConfig().engine || {}).backend !== "comfy")
        return res.status(400).json({ error:
          "H3-Character_creator renders on the ComfyUI engine — switch it on "
          + "in Settings → ComfyUI → Engine" });
      const p2 = { mode: "image", h3sheet: true, prompt: "",
                   style: { id: "h3charcreator", name: "H3-Character_creator",
                            engine: "comfy",
                            workflow: "comfy_workflows/h3_character_creator.json" },
                   style_id: "h3charcreator", style_name: "H3-Character_creator",
                   batch: 1, images: [photo, photo] };
      const rolled2 = imageSeed.forRequest(styles.numOrNull(b.seed));
      p2.seed = rolled2.seed; p2.seed_random = rolled2.random;
      const job2 = core.makeJob(p2);
      job2.chunk = { i: 0, n: 1 };
      return res.json(Object.assign(core.jobDict(job2),
        { input: refName, style_id: "h3charcreator",
          style_name: "H3-Character_creator", h3video: true }));
    }
    const picked = sheetStyles.pick(core.STYLES_DIR, core.BASE, b.style_id);
    if (!picked) return res.status(400).json({ error:
      "no reference-capable image style is installed — a FLUX.2 Klein 9B "
      + "style (Settings → Image) is what turns one picture into a sheet" });
    const { style, styled, loras } = picked;
    const subject = String(b.subject || "").trim().slice(0, 120);
    // 2.205.0 (Tim: "creating furries instead of animals and only
    // cartoons") — explicit options drive the prompt. kind kills the
    // anthropomorphizing outright; style kills the cartoon default that
    // "concept-art style" invited.
    const KINDS = {
      person: "The subject is a human person.",
      animal: "The subject is a REAL animal with natural anatomy — NOT "
        + "anthropomorphic, NOT a furry character, no human traits. The "
        + "subject wears or carries NOTHING unless the source picture shows "
        + "it; whatever the source picture shows stays on the animal exactly "
        + "as shown, and nothing else is ever added. Natural stance for "
        + "the species.",
      vehicle: "The subject is a vehicle — exterior views, true "
        + "proportions.",
      object: "The subject is an inanimate object — true proportions and "
        + "materials.",
    };
    const STYLES_TXT = {
      photo: "Photorealistic photograph style: natural lighting, realistic "
        + "skin, fur and material textures, shallow studio look. NOT a "
        + "cartoon, NOT an illustration.",
      "2.5d": "High-quality stylized 2.5D 3D-render style: soft shading, "
        + "realistic proportions with gentle stylization.",
      anime: "Clean anime illustration style: crisp line work, cel "
        + "shading.",
    };
    const kind = KINDS[String(b.kind || "").toLowerCase()] || "";
    const styleTxt = STYLES_TXT[String(b.style || "").toLowerCase()] || "";
    const gender = String(b.gender || "").trim().slice(0, 60);
    const desc = String(b.description || "").trim().slice(0, 300);
    // 2.207.0: the pose template. b.pose: "" = auto (guessed from the kind
    // plus the subject/description text), "none" = off, else a template id.
    const pose = poseSheets.pick(b.pose, b.kind, `${subject} ${desc}`);
    let images = pose ? [pose.file, photo] : [photo];
    // The template only helps when the render workflow can take BOTH
    // pictures; with fewer than two slots the photo keeps its ride
    // (identity beats layout) and the prompt falls back with it.
    let rw = sheetStyles.probe(styled, core.BASE, images.length);
    let poseNote = "";
    let posed = !!pose;
    if (pose && (!rw || (rw.slots | 0) < 2)) {
      posed = false; images = [photo];
      poseNote = `pose template "${pose.id}" skipped — the render workflow `
        + `has ${rw ? (rw.slots | 0) : 0} reference slot(s), two are needed`;
      rw = sheetStyles.probe(styled, core.BASE, 1);
    }
    // A style that cannot take ANY reference would silently render text-to-
    // image and ignore the uploaded picture — refuse instead, now that any
    // style in the Prompt dock's dropdown can be sent here (2.207.0).
    if (!rw || (!rw.swapped && (rw.slots | 0) < 1)) return res.status(400).json({
      error: `style "${style.name}" cannot take the reference picture — `
        + "pick a FLUX.2 Klein 9B style or one whose workflow has LoadImage "
        + "slots (Settings → Image)" });
    const sheetPrompt =
      (posed ? SHEET_PROMPT_POSED : SHEET_PROMPT.replace(", concept-art style.", "."))
      + (kind ? " " + kind : "")
      + (gender ? ` The subject's gender: ${gender}.` : "")
      + (subject ? ` The subject is ${subject}.` : "")
      + (desc ? ` Details: ${desc}` + (/[.!?]$/.test(desc) ? "" : ".") : "")
      + (styleTxt ? " " + styleTxt : "");
    const p = { mode: "image", prompt: sheetPrompt,
                style: styled, style_id: style.id, style_name: style.name,
                width: 1664, height: 944, batch: 1,
                images };
    if (rw.swapped) { p.workflow = rw.workflow; p.workflow_note = rw.note; }
    else if (rw.note) p.workflow_note = rw.note;
    if (poseNote) p.pose_note = poseNote;
    const rolled = imageSeed.forRequest(styles.numOrNull(b.seed));
    p.seed = rolled.seed; p.seed_random = rolled.random;
    const job = core.makeJob(p);
    job.chunk = { i: 0, n: 1 };
    // The response SAYS which style rendered and which LoRAs will load —
    // "none" when the style carries none — so a rogue LoRA is visible in
    // the dialog's status line instead of only in a hybrid render.
    res.json(Object.assign(core.jobDict(job),
                           { input: refName, sheet_prompt: sheetPrompt,
                             style_id: style.id || null, style_name: style.name,
                             pose_id: posed ? pose.id : null,
                             pose_name: posed ? pose.name : null,
                             pose_note: poseNote || null,
                             loras: loras.map((l) => ({
                               name: l.path.split(/[\\/]/).pop(),
                               weight: l.weight })) }));
  });
  // ADD TO CHARACTERS: the rendered sheet becomes a character's first
  // reference sheet — addAsset creates the profile when it is new, and the
  // UI then opens the normal editor on it.
  app.post("/api/characters/adopt-sheet", (req, res) => {
    const b = req.body || {};
    const name = String(b.name || "").trim();
    if (!name) return res.status(400).json({ error: "name the character first" });
    const base = path.basename(String(b.file || ""));
    if (!base) return res.status(400).json({ error: "which rendered sheet? pass its file name" });
    const src = ["output", "final", "images"]
      .map((k) => path.join(core.pDir(k), base)).find((f) => fs.existsSync(f));
    if (!src) return res.status(404).json({ error: `${base} is not among this project's renders` });
    try {
      const r = chars.addAsset(name, src, `${chars.slug(name)}-sheet${path.extname(base)}`, b.project);
      // 2.224.0: the SOURCE pictures the sheets were generated from land in
      // the dataset too ("every generated sheet, uploaded source image ...
      // lands in dataset") — the client passes the session's uploads; a
      // name that has since left the Images assets is skipped, never fatal.
      let sourced = 0;
      for (const s of (Array.isArray(b.sources) ? b.sources : [])) {
        const sp = path.join(core.pDir("images"), path.basename(String(s || "")));
        if (fs.existsSync(sp) &&
            chars.datasetAdd(name, sp, path.basename(sp), b.project)) sourced++;
      }
      syncTmp(b.project, "character adopted from a generated sheet");
      res.json({ ok: true, name, file: r.file, profile: r.profile,
                 dataset_sources: sourced });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/scenes/refs", (req, res) =>
    res.json({ refs: chapterRefs.load(req.query.project) }));
  // 2.198.0 ("make the reference pictures ... editable"): PATCH edits one
  // reference's label/type/description — the FILE is the identity and does
  // not change; re-upload for a different picture. The tmp workflow resyncs
  // so the next render carries the edit.
  app.patch("/api/scenes/refs", (req, res) => {
    const b = req.body || {};
    const map = chapterRefs.update(b.project, b.chapter || "", b.file, b);
    if (!map) return res.status(404).json({
      error: `no reference "${b.file}" in ${b.chapter ? `chapter “${b.chapter}”` : "the un-chaptered scenes"}` });
    syncTmp(b.project, "reference edited", b.chapter || "");
    res.json({ ok: true, refs: map });
  });
  // 2.198.0 ("make the reference pictures ... thumbnails"): serve the image
  // itself so the board can SHOW it — path-traversal is refused by resolving
  // inside the refs dir.
  app.get("/api/scenes/refs/file", (req, res) => {
    const q = req.query || {};
    const dir = path.resolve(chapterRefs.dir(q.project));
    const f = path.resolve(dir, String(q.file || ""));
    if (!f.startsWith(dir + path.sep) || !fs.existsSync(f))
      return res.status(404).json({ error: "no such reference file" });
    res.sendFile(f);
  });
  app.delete("/api/scenes/refs", (req, res) => {
    const q = req.query || {};
    const r = chapterRefs.remove(q.project, q.chapter, q.file);
    res.json({ ok: true, ...r, refs: chapterRefs.load(q.project) });
  });

  // LOAD A CHAPTER'S SCENES from its files (2.182.0, "load the scenes when
  // the movie and chapter is selected"): the chapter's <chapter><n>.json
  // files replace that chapter's scenes on the board (other chapters stay);
  // normalize + validate exactly like every other plan writer.
  app.post("/api/scenes/load", (req, res) => {
    const b = req.body || {};
    const ch = String(b.chapter == null ? "" : b.chapter);
    const files = scenes.readSceneFiles(b.project, ch);
    if (!files.length) return res.status(404).json({
      error: `no saved scene files for ${ch ? `chapter “${ch}”` : "the un-chaptered scenes"}` });
    const st = scenes.load(b.project);
    const plan = st.plan && Array.isArray(st.plan.shots)
      ? JSON.parse(JSON.stringify(st.plan))
      : { prompt_prefix: files[0].prompt_prefix
            || screenplay.buildPrefix(chars.list(b.project),
              { refParagraphs: chapterRefs.prefixParagraphs(b.project),
        locations: locationPrefix.lines(envs.list(b.project)) }), shots: [] };
    if (!Array.isArray(plan.prompt_prefix) || !plan.prompt_prefix.length)
      plan.prompt_prefix = files[0].prompt_prefix
        || screenplay.buildPrefix(chars.list(b.project),
          { refParagraphs: chapterRefs.prefixParagraphs(b.project),
        locations: locationPrefix.lines(envs.list(b.project)) });
    // this chapter's shots are REPLACED by the files; other chapters stay
    const keepIds = new Set((st.list || [])
      .filter((r) => (r.chapter || "") !== ch).map((r) => String(r.id)));
    plan.shots = plan.shots.filter((sh) => keepIds.has(String(sh && sh.id)));
    const used = new Set(plan.shots.map((sh) => String(sh && sh.id)));
    for (const f of files) {
      let id = String(f.id || ""); let k = plan.shots.length + 1;
      while (!id || used.has(id)) { id = `clip_${String(k).padStart(2, "0")}`; k++; }
      used.add(id);
      plan.shots.push({ id, prompt: f.prompt || [], seed: f.seed });
    }
    const norm = screenplay.normalize(plan, scenes.chainOverrides(b.project));
    const v = screenplay.validate(norm, chars.cast(b.project), envs.list(b.project), chapterRefs.tags(b.project));
    if (!v.ok) return res.status(400).json({ error: "the loaded scenes would not render",
                                             errors: v.errors, warnings: v.warnings });
    let out = scenes.fromPlan(norm, st);
    // the loaded shots carry the chapter they were saved under
    out.list.forEach((r) => {
      if (files.some((f) => String(f.id) === String(r.id)))
        out = scenes.setChapter(out, r.n, ch).state;
    });
    res.json({ ok: true, loaded: files.length, chapter: ch,
               ...scenes.save(out, b.project), warnings: v.warnings });
  });

  app.post("/api/scenes/duration", (req, res) => {
    const b = req.body || {};
    const sec = parseFloat(b.seconds);
    if (!Number.isFinite(sec) || sec <= 0)
      return res.status(400).json({ error: "duration must be a positive number of seconds" });
    const frames = Math.max(1, Math.round(sec * screenplay.FPS));
    const cfg = core.getConfig();
    cfg.chain = { ...(cfg.chain || {}), length: frames };
    core.setConfig(cfg);
    const st = scenes.load(b.project);
    const snapped = screenplay.snapLength(frames);
    if (!st.plan || !Array.isArray(st.plan.shots) || !st.plan.shots.length)
      return res.json({ ok: true, applied: 0, length: snapped, ...st });
    const plan = JSON.parse(JSON.stringify(st.plan));
    // no per-shot rewrite needed: normalize itself writes the uniform
    // chain-default length onto every shot (2.171.0)
    const norm = screenplay.normalize(plan, (cfg.chain || {}));
    const v = screenplay.validate(norm, chars.cast(b.project), envs.list(b.project), chapterRefs.tags(b.project));
    if (!v.ok) return res.status(400).json({ error: "the new duration would not render",
                                             errors: v.errors, warnings: v.warnings });
    res.json({ ok: true, applied: norm.shots.length, length: snapped,
               ...scenes.save(scenes.fromPlan(norm, st), b.project),
               warnings: v.warnings });
  });

  // EXTEND VIDEO (2.223.13): the menubar checkbox. Persists in the project
  // state with the board (scenes.save), exactly like the docker's Seconds
  // persists — a restart, a project switch, a plan rewrite all keep it.

  // H3_VIDEO_REF (2.223.16): the board's style pick - "" = the character
  // chain (unchanged default). Persists with the board like the extend flag.
  /* 2.288.0 (the trim pivot): the board's ONE song + per-scene windows
     + the anchor choice + the filmstrip's picked frame. */
  app.post("/api/scenes/audio", trap.guard((req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    const f = path.basename(String(b.file || ""));
    if (f && !fs.existsSync(path.join(core.pDir("sound"), f)))
      return res.status(404).json({ error: `no such sound asset: ${f}` });
    st.audio = f || undefined;
    scenes.save(st, b.project);
    res.json({ ok: true, audio: st.audio || null,
      note: f ? `"${f}" is the board's song - every scene renders against `
        + "its own start/duration window of it (the graph's "
        + "TrimAudioDuration cuts the slice; no segment files)"
        : "board song cleared" });
  }));
  /* 2.289.0 (Tim: "put a load audio button in the video docker menubar.
     load a waveform of the song, auto segment the song the same as the
     stem docker does it (do not actually cut the files) just save the
     segment start time and duration to the .seg file, create the blank
     scenes on save, populate the start and duration inputs for each
     scene"): the video docker's 💾. Writes the map the waveform holds to
     <base>.seg (lib/stems.saveSegments - "segment n: A s to B s (D
     seconds)", the start and the duration), then stages the board through
     the ONE shared path (lib/segBoard.stage - the same staging the stems
     dock's 📤 uses): one scene per segment, each card's start/duration
     inputs filled from its window, the song the board's audio. Nothing
     is cut. No durations in the body = stage the map as it stands. */
  app.post("/api/scenes/from-segments", trap.guard((req, res) => {
    const b = req.body || {};
    const song = path.basename(String(b.song || ""));
    if (!song) return res.status(400).json({ error: "song required" });
    if (!fs.existsSync(path.join(core.pDir("sound"), song)))
      return res.status(404).json({ error: `no such sound asset: ${song}` });
    let seg = null;
    if (Array.isArray(b.durations) && b.durations.length)
      seg = stems.saveSegments(song, b.durations, b.manual).file;
    // 2.358.0: the strip's ☐ Transition - a bridge of b.gap seconds after each segment (b.gap 0 = none)
    const r = require("../lib/segBoard").stage(song, b.project,
      b.gap !== undefined ? { gap: b.gap, gap_type: b.gap_type } : undefined);
    res.json({ ok: true, seg, ...r });
  }));
  /* 2.291.0: the page placed scene n's fresh take on a new timeline layer
     - clear the flag so a reload or a second window never places it twice */
  app.post("/api/scenes/:n/placed", trap.guard((req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    const r = sceneTimeline.placed(st, req.params.n, b.output);
    if (r.error === "no such scene") return res.status(404).json({ error: r.error });
    if (r.changed) scenes.save(r.state, b.project);
    res.json({ ok: !r.error, changed: r.changed, note: r.error || undefined });
  }));
  app.post("/api/scenes/:n/audio", trap.guard((req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    const r = scenes.at(st, req.params.n);
    if (!r) return res.status(404).json({ error: `no scene ${req.params.n}` });
    const was = sceneTimeline.windowFor(st, r.n);
    const ns = b.start === "" || b.start === null || b.start === undefined ? NaN : +b.start;
    const nd = b.dur === "" || b.dur === null || b.dur === undefined ? NaN : +b.dur;
    r.audio_start = Number.isFinite(ns) ? ns : undefined;
    r.audio_dur = Number.isFinite(nd) && nd > 0 ? nd : undefined;
    /* 2.297.0 (Tim: "adjust the timing for all the scenes if the start
       time or duration changes for any scene"): a real change ripples -
       the scene before ends where this one starts, every later scene
       starts where the one before it ends (lib/sceneTiming) */
    const startCh = Number.isFinite(ns) && ns !== was.start;
    const durCh = Number.isFinite(nd) && nd > 0 && nd !== was.dur;
    let rp = { changed: [] };
    if (b.ripple !== false && (startCh || durCh))
      rp = sceneTiming.ripple(st, r.n, { start: startCh, dur: durCh });
    scenes.save(st, b.project);
    res.json({ ok: true, n: r.n, audio_start: r.audio_start ?? null,
               audio_dur: r.audio_dur ?? null, rippled: rp.changed,
               note: rp.changed.length ? `timing adjusted for scene(s) ${rp.changed.join(", ")} `
                 + "so the scenes stay back to back" : undefined });
  }));
  /* 2.295.0 (Tim: "allow user to change all scenes radio buttons before
     first render so user can start job and job will run to completion"):
     one press sets every scene's anchor; scene 1 has nothing before it,
     so First/Trans start at scene 2 (scene 1 keeps Ref). */
  app.post("/api/scenes/anchors", trap.guard((req, res) => {
    const b = req.body || {};
    const a = String(b.anchor || "");
    if (!scenes.ANCHORS.includes(a) || a === "last")
      return res.status(400).json({ error: "anchor must be reference, first, continue or transition" });
    const st = scenes.load(b.project);
    const rows = (st.list || []).slice().sort((x, y) => x.n - y.n);
    let set = 0;
    rows.forEach((r0, i) => {
      const want = i === 0 && a !== "reference" ? "reference" : a;
      if (r0.anchor !== want) { r0.anchor = want; set++; }
    });
    scenes.save(st, b.project);
    res.json({ ok: true, anchor: a, set, note: `${rows.length} scene(s) set to `
      + ({ reference: "Ref", first: "First", continue: "Cont", transition: "Trans" }[a])
      + (a !== "reference" && rows.length ? " (scene 1 stays Ref - nothing comes before it)" : "") });
  }));
  /* 2.295.0 (Tim: "allow user to add reference images to each scene
     individually") - lib/sceneRefs owns the files and the rules */
  app.post("/api/scenes/:n/refs", upload.array("images", sceneRefs.MAX_PER_SCENE),
    trap.guard((req, res) => {
      const b = req.body || {};
      const files = req.files || [];
      const clean = () => files.forEach((f) => fs.unlink(f.path, () => {}));
      const st = scenes.load(b.project);
      const r = scenes.at(st, req.params.n);
      if (!r) { clean(); return res.status(404).json({ error: `no scene ${req.params.n}` }); }
      if (!files.length) return res.status(400).json({ error: "no pictures uploaded" });
      let out;
      try { out = sceneRefs.add(b.project, r, files); } finally { clean(); }
      scenes.save(st, b.project);
      res.json({ ok: true, n: r.n, refs: r.refs || [], added: out.added, skipped: out.skipped,
        note: out.added.length ? `${out.added.length} picture(s) added to scene ${r.n}` : "",
        error: !out.added.length ? out.skipped.map((x) => `${x.name}: ${x.why}`).join("; ") : undefined });
    }));
  /* 2.296.0 (Tim: "is it possible for me to add the last frame of the
     scene before as a reference image to the current scene?"): scene n's
     frame (time, or its last frame) becomes a picture on the NEXT scene */
  app.post("/api/scenes/:n/frame-ref", trap.guard((req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    const src = scenes.at(st, req.params.n);
    if (!src) return res.status(404).json({ error: `no scene ${req.params.n}` });
    const next = (st.list || []).filter((x) => x && x.n > src.n).sort((a, c) => a.n - c.n)[0];
    if (!next) return res.status(400).json({ error:
      `scene ${src.n} is the last - there is no next scene to give the frame to` });
    if (!src.output) return res.status(400).json({ error: `scene ${src.n} has no rendered take yet` });
    const take = path.isAbsolute(src.output) ? src.output
      : path.join(core.pDir("video"), path.basename(src.output));
    const t = b.time === undefined || b.time === null || b.time === "" ? null : +b.time;
    const out = sceneRefs.addFrame(b.project, next, take, Number.isFinite(t) ? t : null, src.n);
    if (!out.added.length) return res.status(400).json({ error:
      (out.skipped[0] || {}).why || "the frame was not added" });
    scenes.save(st, b.project);
    res.json({ ok: true, from: src.n, to: next.n, file: out.added[0], refs: next.refs,
      note: `${out.label} added to scene ${next.n}'s pictures - it rides that `
        + "scene's render (Ref / Cont) as a reference picture" });
  }));
  /* 2.297.0 (Tim: "if transition scene is selected allow the user to
     select first and/or last frame from previous clips or gallery or
     assets ... allow user to remove these images"): the scene's FIRST /
     LAST frame slots (lib/sceneRefs). A source is a frame of any rendered
     scene ({kind:"frame", scene, time?} - no time = its last frame), a
     gallery picture ({kind:"gallery", name}), an image asset
     ({kind:"asset", name}), or an upload (/fl/upload). */
  const takeOf = (row) => row && row.output
    ? (path.isAbsolute(row.output) ? row.output : path.join(core.pDir("video"), path.basename(row.output)))
    : "";
  app.post("/api/scenes/:n/fl", trap.guard((req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    const r = scenes.at(st, req.params.n);
    if (!r) return res.status(404).json({ error: `no scene ${req.params.n}` });
    const slot = String(b.slot || "");
    if (!sceneRefs.SLOTS.includes(slot))
      return res.status(400).json({ error: "slot must be first or last" });
    let src = "", label = "", tmp = null;
    if (b.kind === "frame") {
      const from = scenes.at(st, b.scene);
      if (!from) return res.status(404).json({ error: `no scene ${b.scene}` });
      const t = b.time === undefined || b.time === null || b.time === "" ? null : +b.time;
      tmp = sceneRefs.extractFrame(takeOf(from), Number.isFinite(t) ? t : null);
      if (!tmp) return res.status(400).json({ error:
        `scene ${from.n} has no rendered take to take a frame from` });
      src = tmp;
      label = Number.isFinite(t) ? `scene ${from.n} at ${Math.round(t * 10) / 10}s`
        : `last frame of scene ${from.n}`;
    } else if (b.kind === "project") {
      // 2.298.0: any picture in the project (the scanned list's rel path)
      src = projectMedia.resolve(b.project, b.rel);
      if (!src || projectMedia.kindOfFile(src) !== "images")
        return res.status(404).json({ error: `${b.rel} is not a picture in this project` });
      label = b.label ? String(b.label).slice(0, 80) : `${projectMedia.groupFor(b.project, b.rel)}: ${path.basename(String(b.rel))}`;   // 2.563.0
    } else if (b.kind === "gallery" || b.kind === "asset") {
      src = sceneRefs.resolveImage(b.project, b.kind, b.name);
      if (!src) return res.status(404).json({ error:
        `${b.name} is not a picture in the ${b.kind === "asset" ? "image assets" : "gallery"}` });
      label = `${b.kind}: ${path.basename(String(b.name))}`;
    } else return res.status(400).json({ error: "kind must be frame, project, gallery or asset" });
    const out = sceneRefs.setSlot(b.project, r, slot, src, label);
    if (tmp) try { fs.unlinkSync(tmp); } catch {}
    if (!out.ok) return res.status(400).json({ error: out.error });
    scenes.save(st, b.project);
    res.json({ ok: true, n: r.n, slot, fl: r["fl_" + slot],
      note: `scene ${r.n}'s ${slot} frame: ${label}` });
  }));
  app.post("/api/scenes/:n/fl/upload", upload.single("image"), trap.guard((req, res) => {
    const b = req.body || {};
    const f = req.file;
    const clean = () => { if (f) fs.unlink(f.path, () => {}); };
    const st = scenes.load(b.project);
    const r = scenes.at(st, req.params.n);
    if (!r) { clean(); return res.status(404).json({ error: `no scene ${req.params.n}` }); }
    if (!f || !/\.(png|jpe?g|webp|bmp|gif)$/i.test(f.originalname || "")) {
      clean(); return res.status(400).json({ error: "upload one picture" }); }
    const ext = path.extname(f.originalname).toLowerCase();
    const withExt = f.path + ext;
    let out;
    try { fs.renameSync(f.path, withExt);
      out = sceneRefs.setSlot(b.project, r, String(b.slot || ""), withExt,
                              "upload: " + path.basename(f.originalname)); }
    finally { try { fs.unlinkSync(withExt); } catch {} clean(); }
    if (!out.ok) return res.status(400).json({ error: out.error });
    scenes.save(st, b.project);
    res.json({ ok: true, n: r.n, slot: b.slot, fl: r["fl_" + b.slot] });
  }));
  app.post("/api/scenes/:n/fl/delete", trap.guard((req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    const r = scenes.at(st, req.params.n);
    if (!r) return res.status(404).json({ error: `no scene ${req.params.n}` });
    if (!sceneRefs.clearSlot(b.project, r, String(b.slot || "")))
      return res.status(400).json({ error: `scene ${r.n} has no ${b.slot} frame` });
    scenes.save(st, b.project);
    res.json({ ok: true, n: r.n, slot: b.slot });
  }));
  app.get("/api/scenes/:n/fl/:slot", (req, res) => {
    const st = scenes.load(req.query.project);
    const r = scenes.at(st, req.params.n);
    const sl = r && sceneRefs.slotFor(req.query.project, r, req.params.slot);
    if (!sl) return res.status(404).json({ error: "no such picture" });
    res.sendFile(sl.file);
  });
  /* 2.297.0 (Tim: "add option for user to insert scene"): a new scene
     AFTER scene `after` (0 = before scene 1). It joins the previous
     scene's chapter, continues from it, starts where it ends and lasts
     `dur` seconds (else as long as the previous scene, else 5 s) - the
     later scenes move along (lib/sceneTiming). */
  app.post("/api/scenes/insert", trap.guard((req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    if (!st.plan || !Array.isArray(st.plan.shots) || !st.plan.shots.length)
      return res.status(400).json({ error: "the board has no scenes yet - add one with ＋ Scene" });
    const after = parseInt(b.after, 10);
    if (!Number.isFinite(after) || after < 0 || after > st.plan.shots.length)
      return res.status(400).json({ error: `after must be 0..${st.plan.shots.length}` });
    sceneTiming.materialize(st);                 // explicit windows BEFORE the numbers move
    const plan = JSON.parse(JSON.stringify(st.plan));
    const used = new Set(plan.shots.map((x) => String(x && x.id)));
    let k = plan.shots.length + 1, newId;
    do { newId = `clip_${String(k).padStart(2, "0")}`; k++; } while (used.has(newId));
    const prev = after > 0 ? plan.shots[after - 1] : null;
    const next = plan.shots[after] || null;
    const text = String(b.text || "").trim();
    const shot = { id: newId, prompt: text ? text.split("\n")
      : [`[Shot ${after + 1}] A new scene - describe the action.`] };
    if (prev) shot.visual_context_source = String(prev.id);
    if (next && (!prev || next.visual_context_source === String(prev.id)))
      next.visual_context_source = newId;
    plan.shots.splice(after, 0, shot);
    const norm = screenplay.normalize(plan, scenes.chainOverrides(b.project));
    const v = screenplay.validate(norm, chars.cast(b.project), envs.list(b.project), chapterRefs.tags(b.project));
    if (!v.ok) return res.status(400).json({ error: "the new scene would not render",
                                             errors: v.errors, warnings: v.warnings });
    let out = scenes.fromPlan(norm, st);
    const n = after + 1;
    const prevRow = scenes.at(out, after);
    if (prevRow && prevRow.chapter) out = scenes.setChapter(out, n, prevRow.chapter).state;
    const nr = scenes.at(out, n);
    const dur = Number.isFinite(+b.dur) && +b.dur > 0 ? +b.dur
      : (prevRow && prevRow.audio_dur) || 5;
    nr.audio_start = prevRow ? prevRow.audio_start + prevRow.audio_dur : 0;
    nr.audio_dur = dur;
    const rp = sceneTiming.ripple(out, n, { dur: true });
    const saved = scenes.save(rp.state, b.project);
    res.json({ ok: true, n, ...saved, warnings: v.warnings,
      note: `scene ${n} inserted (${Math.round(dur * 10) / 10}s)`
        + (rp.changed.length ? ` - scenes ${rp.changed.join(", ")} moved along` : "") });
  }));
  /* 2.298.0 (Tim: "scan the projects subfolders for images ... scan for
     assets, characters, locations etc."): a picture already in the
     project (the scanned list's rel path) becomes one of scene n's own
     reference pictures - copied into its scene_refs like an upload */
  app.post("/api/scenes/:n/refs/project", trap.guard((req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    const r = scenes.at(st, req.params.n);
    if (!r) return res.status(404).json({ error: `no scene ${req.params.n}` });
    // 2.563.0 (Tim: "allow user to add reference images to each scene, include images from previous scenes"): a frame
    // of ANY scene's take (the picker's 🎞 Clips tab) - the whole take's frames, not only the last one to the next scene
    if (b.kind === "frame") {
      const from = scenes.at(st, b.scene);
      if (!from) return res.status(404).json({ error: `no scene ${b.scene}` });
      if (!from.output) return res.status(400).json({ error: `scene ${from.n} has no rendered take yet` });
      const t = b.time === undefined || b.time === null || b.time === "" ? null : +b.time;
      const fo = sceneRefs.addFrame(b.project, r, takeOf(from), Number.isFinite(t) ? t : null, from.n);
      if (!fo.added.length) return res.status(400).json({ error: (fo.skipped[0] || {}).why || "the frame was not added" });
      scenes.save(st, b.project);
      return res.json({ ok: true, n: r.n, refs: r.refs, added: fo.added, note: `${fo.label} added to scene ${r.n}'s pictures` });
    }
    const src = projectMedia.resolve(b.project, b.rel);
    if (!src || projectMedia.kindOfFile(src) !== "images")
      return res.status(404).json({ error: `${b.rel} is not a picture in this project` });
    const out = sceneRefs.add(b.project, r, [{ path: src, originalname: path.basename(src) }]);
    if (!out.added.length) return res.status(400).json({ error:
      (out.skipped[0] || {}).why || "the picture was not added" });
    const x = r.refs.find((y) => y.file === out.added[0]);
    if (x) x.label = (b.label ? String(b.label) : `${projectMedia.groupFor(b.project, b.rel)}: ${path.basename(src, path.extname(src))}`).slice(0, 60);   // 2.563.0: the 🎬 tab's words
    scenes.save(st, b.project);
    res.json({ ok: true, n: r.n, refs: r.refs, added: out.added,
      note: `${path.basename(src)} added to scene ${r.n}'s pictures` });
  }));
  app.post("/api/scenes/:n/refs/delete", trap.guard((req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    const r = scenes.at(st, req.params.n);
    const out = sceneRefs.remove(b.project, r, b.file);
    if (!out.removed) return res.status(r ? 400 : 404).json({ error: out.error });
    scenes.save(st, b.project);
    res.json({ ok: true, n: r.n, refs: r.refs || [] });
  }));
  app.get("/api/scenes/:n/refs/:file", (req, res) => {
    const st = scenes.load(req.query.project);
    const r = scenes.at(st, req.params.n);
    const p = r && sceneRefs.filePath(req.query.project, r.id, req.params.file);
    if (!p) return res.status(404).json({ error: "no such picture" });
    res.sendFile(p);
  });
  /* 2.302.0: the scene's "trim first frame" checkbox */
  app.post("/api/scenes/:n/trim-first", trap.guard((req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    const r = scenes.at(st, req.params.n);
    if (!r) return res.status(404).json({ error: `no scene ${req.params.n}` });
    r.trim_first = b.on === true ? true : undefined;
    scenes.save(st, b.project);
    res.json({ ok: true, n: r.n, trim_first: r.trim_first === true });
  }));
  app.post("/api/scenes/:n/anchor", trap.guard((req, res) => {
    const b = req.body || {};
    const a = String(b.anchor || "reference");
    if (!scenes.ANCHORS.includes(a))
      return res.status(400).json({ error: "anchor must be reference, first, continue or transition" });
    const st = scenes.load(b.project);
    const r = scenes.at(st, req.params.n);
    if (!r) return res.status(404).json({ error: `no scene ${req.params.n}` });
    r.anchor = a;
    scenes.save(st, b.project);
    res.json({ ok: true, n: r.n, anchor: a });
  }));
  app.post("/api/scenes/:n/pick-frame", trap.guard((req, res) => {
    const b = req.body || {};
    const t = +b.time;
    if (!Number.isFinite(t) || t < 0)
      return res.status(400).json({ error: "time (seconds) required" });
    const st = scenes.load(b.project);
    const src = scenes.at(st, req.params.n);
    if (!src) return res.status(404).json({ error: `no scene ${req.params.n}` });
    const next = scenes.at(st, src.n + 1);
    if (!next) return res.status(400).json({ error:
      `scene ${src.n} is the last - there is no next scene to start from `
      + "this frame" });
    next.cont_src = src.n; next.cont_time = t;
    // 2.292.0: picking a frame means "follow from here" - a scene with no
    // anchor chosen yet becomes First (fl2va); a chosen one is kept
    if (!next.anchor) next.anchor = "first";
    scenes.save(st, b.project);
    res.json({ ok: true, from: src.n, to: next.n, time: t, anchor: next.anchor,
      note: `scene ${next.n} will start from scene ${src.n}'s frame at `
        + `${Math.round(t * 10) / 10}s as ${next.anchor === "first" ? "First (fl2va)"
          : next.anchor === "transition" ? "Transition (fl2va to the new location)"
          : next.anchor === "continue" ? "Cont (ref2va opening on it, the cast sheets keep the character)"
          : "Ref (ref2va - the frame's take rides as the transition video)"}` });
  }));
  /* 2.293.0: the "▶ as written" switch (lib/autoRender) - saved with the
     board; the answer says which way it will run on THIS machine's cards */
  app.post("/api/scenes/auto-render", trap.guard((req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    const on = b.on === true || b.on === "true" || b.on === 1;
    const next = { ...st };
    if (on) next.auto_render = true; else delete next.auto_render;
    scenes.save(next, b.project);
    const m = autoRender.mode(core.getConfig(), { auto_render: on });
    res.json({ ok: true, auto_render: on, mode: m.mode,
      note: on ? m.note : "▶ as written is off - written scenes wait for ▶" });
  }));
  app.post("/api/scenes/style", trap.guard((req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    const name = String(b.name || "");
    // 2.275.0: the note tells the TRUTH per flow — a chain style names its
    // own chain, anything unknown renders through MM3 and says so
    const note = h3Viggle.isViggleFlow(name) ? h3Viggle.STYLE_NOTE
      : ltxScenes.isLtxFlow(name)
      ? "LTX 2.5 - ▶ renders each scene through the LTX 2.5 all-in-one canvas: text, "
        + "the frame it starts on (First / Cont), first + last (Trans); with the board's song "
        + "the lip-synced versions on each scene's slice (✎ First frame makes the opening picture)"
      : name === extendVideo.FAST_STYLE
      ? "FastH3 Omni - ▶ renders every scene through ref2va on FastVideo's 8-step model "
        + "(pictures + sheets + voices + global prompt); scene n carries scene n-1's take as its video reference "
        + "(Settings ▸ Add-ons ▸ FastH3 Omni downloads the model)"
      : name === extendVideo.REF_STYLE
      ? "H3_Video_Ref - ▶ renders every scene through ref2va "
        + "(pictures + sheets + voices + global prompt); scene n "
        + "carries scene n-1's take as its video reference"
      : (CHAIN_STYLES[name] && name !== "MM3_Characters")
      ? name + " - ▶ renders every scene through its own chain "
        + "(the music-video pack: lyric lock, @music source track)"
      : name
      ? name + " - no board flow of its own; ▶ renders through the "
        + "MM3 character chain"
      : "Character chain - ▶ renders through the MM3 chain";
    res.json({ ok: true,
               ...scenes.save({ ...st, style: name }, b.project),
               note });
  }));

  app.post("/api/scenes/chapters", (req, res) => {
    const b = req.body || {};
    const r = scenes.addChapter(scenes.load(b.project), b.name);
    if (!r.chapter) return res.status(400).json({ error: "a chapter needs a name" });
    // A NEW CHAPTER CLEARS THE BOARD (2.150.0, by instruction: "when user
    // adds a chapter clear all the scenes and prepare for a new chapter").
    // Scene records, the render queue and the plan's shots go; the shared
    // prompt_prefix and the chapter list stay; every rendered take is
    // already a file in the project's Video assets and is not touched.
    const cleared = { ...r.state, list: [], pending: [],
                      plan: r.state.plan ? { ...r.state.plan, shots: [] } : null };
    res.json({ ok: true, ...scenes.save(cleared, b.project),
               note: `chapter "${r.chapter}" ready — the board is cleared for its `
                   + "scenes; rendered takes stay in Video assets" });
  });

  app.post("/api/scenes/:n/chapter", (req, res) => {
    const b = req.body || {};
    const r = scenes.setChapter(scenes.load(b.project), req.params.n, b.chapter);
    if (!scenes.at(r.state, req.params.n))
      return res.status(404).json({ error: "no such scene" });
    res.json({ ok: true, ...scenes.save(r.state, b.project) });
  });

  /** The normal Generate button's CLIENT calls /api/comfy/ensure before
   *  queueing; the scene board's ▶ went straight to the queue, so on a
   *  machine where ComfyUI was not yet up the worker died with "not
   *  reachable" (exit 2) while the ordinary path worked. The scene routes
   *  ensure SERVER-side — force, because this style always renders on
   *  ComfyUI whatever the video backend says. */
  /** 2.358.0: true when every picked scene is a standard-transition bridge (bridge_worker.py, ffmpeg only). */
  function ffmpegOnly(project, ns) {
    const st = scenes.load(project);
    const rows = (ns || []).map((n) => scenes.at(st, n)).filter(Boolean);
    return rows.length > 0 && rows.every((r) => r.bridge && r.bridge.type !== sceneBridge.AI);
  }
  async function ensureComfyUp(res) {
    try { await comfy.ensure({ force: true }); return true; }
    catch (e) {
      res.status(502).json({ error: "ComfyUI is not up and could not be "
        + "started: " + String(e.message || e) });
      return false;
    }
  }

  /** The circular play button: one scene through the existing queue. FAST —
   *  the worker strips the in-line upscale stage for a plain render. */
  /** RENDER SELECTED (2.149.0, by instruction: "add a checkbox to each
   *  scene... add a render selected button"). Starts the FIRST picked scene
   *  now and queues the rest as record ids; syncJobs launches each successor
   *  when its predecessor finishes, because the tmp graph is per-scene and
   *  must not be rewritten under a job that has not run yet. */
  app.post("/api/scenes/render", trap.guard(async (req, res) => {
    const b = req.body || {};
    // 2.357.0: the left Basic Settings' size rides with the press - kept for this and the queued renders
    if (b.basic) renderSettings.rememberBasic(core.projDir(b.project || core.getProject()), b.basic);
    // 2.358.0: picks that are all standard-transition bridges are ffmpeg only - no ComfyUI to bring up
    if (!ffmpegOnly(b.project, b.scenes || [])) {
    if (!await ensureComfyUp(res)) return;
    { const st0 = scenes.load(b.project);
      const eb = await ensureChainBase(st0.style);
      if (!eb.ok) return res.status(503).json({ error: eb.error }); } }
    let st = syncJobs(b.project);
    /* 2.295.0 (Tim: "if user selects render all use the last frame of the
       previous scene"): a frame picked on a take that is about to be
       RE-RENDERED in this same run belongs to the old take - the queued
       scene follows the NEW take's last frame instead */
    { const ns = new Set((b.scenes || []).map((x) => parseInt(x, 10)));
      let cleared = 0;
      for (const r0 of st.list || []) {
        if (ns.has(r0.n) && Number.isFinite(r0.cont_src) && ns.has(r0.cont_src)) {
          r0.cont_src = undefined; r0.cont_time = undefined; cleared++;
        }
      }
      if (cleared) st = scenes.save(st, b.project); }
    const q = scenes.queueRenders(st, (b.scenes || []).map((x) => parseInt(x, 10)));
    if (!q.queued.length)
      return res.status(400).json({ error: "nothing to render", errors: q.errors,
                                    note: "pick at least one scene that is not "
                                        + "already rendering or queued" });
    scenes.save(q.state, b.project);
    // syncJobs starts the first queued scene (nothing is live, or it would
    // not have been queued behind a render) and returns the fresh board
    const out = syncJobs(b.project);
    res.json({ ok: true, queued: q.queued.length, errors: q.errors, ...out });
  }));

  app.post("/api/scenes/:n/generate", trap.guard(async (req, res) => {
    const b = req.body || {};
    // 2.357.0: the left Basic Settings' size rides with the press - kept for this and the queued renders
    if (b.basic) renderSettings.rememberBasic(core.projDir(b.project || core.getProject()), b.basic);
    // 2.358.0: a standard-transition bridge is ffmpeg only - no ComfyUI to bring up
    if (!ffmpegOnly(b.project, [req.params.n])) {
    if (!await ensureComfyUp(res)) return;
    { const eb = await ensureChainBase(scenes.load(b.project).style);
      if (!eb.ok) return res.status(503).json({ error: eb.error }); } }
    const r = queueScene(b.project, parseInt(req.params.n, 10),
                         { upscale: !!b.upscale });
    if (r.error) return res.status(r.status || 500).json({ error: r.error, notes: r.notes });
    res.json({ ok: true, job: core.jobDict(r.job), notes: r.notes });
  }));

  /**
   * ADD TO THE UPSCALE QUEUE. Each press queues one job; the app's one-at-a-
   * time generate queue serialises them, so pressing ⏫ on three scenes
   * upscales them one after another. The scene re-renders through the same
   * chain with the upscale stage kept and the same plan seeds; the result is
   * filed beside the base take as scene<n>_<chapter>_upscaled and Produce
   * prefers it automatically. Refused while that scene renders, or while it
   * is already queued for upscale.
   */
  app.post("/api/scenes/:n/upscale", trap.guard(async (req, res) => {
    const b = req.body || {};
    if (!await ensureComfyUp(res)) return;
    const r = queueScene(b.project, parseInt(req.params.n, 10), { upscale: true });
    if (r.error) return res.status(r.status || 500).json({ error: r.error, notes: r.notes });
    res.json({ ok: true, job: core.jobDict(r.job), notes: r.notes });
  }));

  /** ⏫ SELECTED (2.315.0, Tim: "i would like a icon only button in the
   *  scene menubar to upscale selected"): every ticked scene with a take
   *  goes into the upscale queue, in board order - the same queueScene
   *  path as the card's ⏫, so they run one after another. A scene that
   *  cannot (no take, already queued, no ⚙ upscaler) is named, not fatal. */
  /* 2.323.0: the video docker's Scenes field (board scene_count) and the
     number in projects/<p>/scenes.txt */
  app.get("/api/scenes/count", (req, res) => {
    const st = scenes.load(req.query.project);
    res.json({ n: st.scene_count || null,
               file_n: sceneCount.fromFile(core.projDir(req.query.project || core.getProject())) || null });
  });
  app.post("/api/scenes/count", (req, res) => {
    const b = req.body || {};
    const st = scenes.load(b.project);
    const n = parseInt(b.n, 10);
    if (Number.isFinite(n) && n >= 1 && n <= sceneCount.MAX) st.scene_count = n;
    else delete st.scene_count;
    scenes.save(st, b.project);
    res.json({ ok: true, n: scenes.load(b.project).scene_count || null });
  });

  app.post("/api/scenes/upscale", trap.guard(async (req, res) => {
    const b = req.body || {};
    const ns = takeUpscale.ticked(b.scenes);
    if (!ns.length) return res.status(400).json({ error: "tick at least one rendered scene to upscale" });
    if (!await ensureComfyUp(res)) return;
    const jobs = [], errors = [], notes = [];
    for (const n of ns) {
      const r = queueScene(b.project, n, { upscale: true });
      if (r.error) { errors.push(r.error.startsWith(`scene ${n}`) ? r.error : `scene ${n}: ${r.error}`); continue; }
      jobs.push({ n, job: r.job.id });
      notes.push(...(r.notes || []).filter((x) => /^⏫/.test(String(x))));
    }
    if (!jobs.length) return res.status(400).json({ error: "nothing to upscale", errors });
    res.json({ ok: true, queued: jobs.length, jobs, errors, notes });
  }));

  /**
   * KEEP marks the take, idempotently — `changed:false` on the second press
   * is what stops anything downstream running twice. Since 2.140.0 a plain
   * render STRIPS the in-line upscale stage (fast), so keep no longer implies
   * upscaled: the ⏫ button queues the upscale separately, and Produce
   * prefers the upscaled take when one exists.
   */
  app.post("/api/scenes/:n/keep", (req, res) => {
    const b = req.body || {};
    const r = scenes.keep(scenes.load(b.project), req.params.n);
    if (r.error) return res.status(r.error === "no such scene" ? 404 : 400)
                           .json({ error: r.error });
    scenes.save(r.state, b.project);
    res.json({ ok: true, changed: r.changed,
               note: "kept — ⏫ queues an upscale of this scene; Produce uses "
                   + "the upscaled take when one exists", ...r.state });
  });

  /** REDO = back to idle, then straight back into the queue. A scene that is
   *  still rendering is refused rather than queued twice. */
  app.post("/api/scenes/:n/redo", trap.guard(async (req, res) => {
    const b = req.body || {};
    // 2.357.0: the left Basic Settings' size rides with the press - kept for this and the queued renders
    if (b.basic) renderSettings.rememberBasic(core.projDir(b.project || core.getProject()), b.basic);
    const ffOnly = ffmpegOnly(b.project, [req.params.n]);   // 2.358.0: a standard bridge needs no ComfyUI
    if (!ffOnly && !await ensureComfyUp(res)) return;
    const st = scenes.load(b.project);
    const rec = scenes.at(st, req.params.n);
    if (!rec) return res.status(404).json({ error: "no such scene" });
    const running = rec.job && core.jobs.get(rec.job);
    if (running && !running.finished)
      return res.status(409).json({ error: `scene ${rec.n} is already rendering` });
    // 2.307.0: the card's ↻ lands here - the same base check ▶ makes
    if (!ffOnly) { const eb = await ensureChainBase(st.style);
      if (!eb.ok) return res.status(503).json({ error: eb.error }); }
    scenes.save(scenes.redo(st, rec.n).state, b.project);
    const r = queueScene(b.project, rec.n);
    if (r.error) return res.status(r.status || 500).json({ error: r.error, notes: r.notes });
    res.json({ ok: true, job: core.jobDict(r.job), notes: r.notes });
  }));

  /**
   * WRITE THE STORY ONTO THE TIMELINE (2.142.4, Tim: "it is not writing a
   * story for the timeline"). The kept scenes, in story order, become the
   * clips of a timeline named "screenplay" (saved via lib/timelines — the
   * same files the Timeline docker's dropdown lists) and it is made the
   * project's ACTIVE timeline, so the docker shows the film ready to edit.
   * The user's other timelines are untouched: "screenplay" is its own file,
   * overwritten by each press of the button, never anything else.
   */
  app.post("/api/scenes/to-timeline", trap.guard((req, res) => {
    const b = req.body || {};
    const st = syncJobs(b.project);
    const outs = scenes.keptOutputs(st);
    if (!outs.length) return res.status(400).json({
      error: "no kept scenes — render scenes and press keep on the takes you want" });
    const proj = core.projDir(b.project || core.getProject());
    const tl = timelines.empty();
    let t = 0;
    for (const o of outs) {
      const p = path.join(core.pDir("video"), path.basename(o.name));
      if (!fs.existsSync(p)) return res.status(400).json({
        error: `scene ${o.n}'s kept take (${o.name}) is no longer in the project's Video assets` });
      const dur = core.probeDuration(p) || 0;
      if (!dur) return res.status(400).json({
        error: `cannot read the length of scene ${o.n}'s take (${o.name})` });
      tl.video.push({ name: path.basename(o.name), start: t, dur, in: 0, out: dur });
      t += dur;
    }
    // 2.373.0: with 🎤 on, each kept take's karaoke overlay rides a Karaoke layer on top, at the take's start
    try {
      const kl = require("../lib/karaoke").timelineLayer(b.project, tl.video.map((c, i) => ({ n: outs[i].n, take: c.name, start: c.start })));
      if (kl) tl.vlayers = (tl.vlayers || []).concat([kl]);
    } catch { /* the film still lands */ }
    try {
      timelines.write(proj, "screenplay", tl);
      const prjFile = core.prjPath(b.project || core.getProject());
      let d = {};
      try { d = JSON.parse(fs.readFileSync(prjFile, "utf8")) || {}; } catch { /* fresh */ }
      d.timeline = "screenplay";
      fs.writeFileSync(prjFile, JSON.stringify(d, null, 2));
    } catch (e) { return res.status(500).json({ error: trap.where(e) }); }
    res.json({ ok: true, timeline: "screenplay", clips: tl.video.length,
               seconds: Math.round(t * 10) / 10 });
  }));

  /**
   * PRODUCE = the kept scenes, in story order, through the compile path the
   * timeline already uses (mode "export" — reuse, never a second joiner).
   * Each kept take sits in the project's Video assets under its scene name,
   * so the clips reference src:"video" and the compile lands in the project
   * root as <project>.mp4, exactly like a timeline export.
   */
  /** THE MOVIE FILE MENU (2.150.0, by instruction). A movie bundles the
   *  docker: cast + files, chapters, scenes and renders, saved under the
   *  project's movies/ folder (lib/movies.js). New stashes, never deletes. */
  app.get("/api/movies", (req, res) =>
    res.json({ movies: movies.list(req.query.project) }));

  app.post("/api/movies/save", (req, res) => {
    const b = req.body || {};
    const r = movies.save(b.name, b.project);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  });

  app.post("/api/movies/load", (req, res) => {
    const b = req.body || {};
    const r = movies.load(b.name, b.project);
    if (r.error) return res.status(404).json(r);
    // the loaded cast must exist in the tmp chain before anything renders
    syncTmp(b.project, `movie load: ${b.name}`);
    res.json({ ...r, ...syncJobs(b.project) });
  });

  app.post("/api/movies/new", (req, res) => {
    const b = req.body || {};
    const r = movies.newMovie(b.project);
    syncTmp(b.project, "movie new");
    res.json({ ...r, ...syncJobs(b.project) });
  });

  /** COMPILE joins EVERY rendered take of the loaded movie, in scene order
   *  (Produce joins only the KEPT ones) — same flat-timeline export path. */
  app.post("/api/movies/compile", (req, res) => {
    const b = req.body || {};
    const st = syncJobs(b.project);
    const outs = scenes.allOutputs(st);
    if (!outs.length) return res.status(400).json({
      error: "no rendered scenes to compile — render (or load) a movie first" });
    let t = 0;
    const clips = [];
    /* 2.301.0: when EVERY scene has its lossless master (projects/<p>/raw),
       the film is joined from the masters and encoded ONCE at CRF 14; one
       mp4-only scene and the whole compile uses the takes, as before (a mix
       would force a re-encode of the join itself) - said in the answer */
    const masters = outs.map((o) => rawMaster.forOutput(b.project, o.name));
    const fromMasters = masters.length > 0 && masters.every(Boolean);
    for (const [i, o] of outs.entries()) {
      const p = path.join(core.pDir("video"), path.basename(o.name));
      if (!fs.existsSync(p)) return res.status(400).json({
        error: `scene ${o.n}'s take (${o.name}) is no longer in the project's Video assets` });
      const src = fromMasters ? masters[i] : p;
      const dur = core.probeDuration(src) || 0;
      if (!dur) return res.status(400).json({
        error: `cannot read the length of scene ${o.n}'s take (${path.basename(src)})` });
      clips.push({ path: src, in: 0, out: null, dur, start: t, opacity: 1 });
      t += dur;
    }
    const missingRaw = outs.filter((o, i) => !masters[i]).map((o) => o.n);
    const timeline = { video: clips, video_layers: [], audio: [], images: [],
                       keep_original_audio: true };
    timeline.scene_end = tlspan.sceneEnd(timeline);
    const job = core.makeJob({
      mode: "export", project: core.getProject(),
      prompt: `[compile] ${clips.length} rendered scene(s)`,
      width: 0, height: 0, frames: 0, steps: 0, seed: 0, format: "webm",
      timeline,
      ...(fromMasters ? { crf: 14 } : {}),
    });
    res.json({ ok: true, job: core.jobDict(job),
               scenes: outs.map((o) => o.name), from_masters: fromMasters,
               note: fromMasters
                 ? `compiling from ${outs.length} lossless master(s) - one encode, near-transparent`
                 : `scene(s) ${missingRaw.join(", ")} have no lossless master (rendered before 2.301.0, `
                   + "or the raw folder was cleared) - compiling from the mp4 takes" });
  });

  app.post("/api/produce", (req, res) => {
    const b = req.body || {};
    const st = syncJobs(b.project);
    // "THE COMBINE BUTTON WILL COMBINE SELECTED SCENES" (2.223.13): with a
    // selection in the request, Produce joins exactly those scenes' takes in
    // board order — a ticked scene needs a take (upscaled preferred, the
    // keptOutputs rule) but not the ✔ mark, because the selection IS the
    // choice. Without a selection the kept-scenes behaviour is unchanged, so
    // nothing existing moves.
    const sel = Array.isArray(b.scenes)
      ? b.scenes.map((x) => parseInt(x, 10)).filter(Number.isFinite) : [];
    let outs;
    if (sel.length) {
      outs = [];
      for (const n of [...new Set(sel)].sort((a, c) => a - c)) {
        const r = scenes.at(st, n);
        if (!r) return res.status(400).json({ error: `no scene ${n} on the board` });
        if (!(r.upscaled || r.output)) return res.status(400).json({
          error: `scene ${n} has no rendered take yet — press ▶ on it first` });
        outs.push({ n: r.n, name: r.upscaled || r.output });
      }
    } else {
      outs = scenes.keptOutputs(st);
      if (!outs.length) return res.status(400).json({
        error: "no kept scenes to produce — render scenes and press keep on the takes you want" });
    }
    let t = 0;
    const clips = [];
    for (const o of outs) {
      const p = path.join(core.pDir("video"), path.basename(o.name));
      if (!fs.existsSync(p)) return res.status(400).json({
        error: `scene ${o.n}'s kept take (${o.name}) is no longer in the project's Video assets` });
      const dur = core.probeDuration(p) || 0;
      if (!dur) return res.status(400).json({
        error: `cannot read the length of scene ${o.n}'s take (${o.name})` });
      clips.push({ path: p, in: 0, out: null, dur, start: t, opacity: 1 });
      t += dur;
    }
    // The compile timeline's `video` is the FLAT base-track clip array — the
    // same allow-listed shape /api/timeline/compile builds (see routes/index
    // .js) — with the layer/audio/image extras empty.
    const timeline = { video: clips, video_layers: [], audio: [], images: [],
                       keep_original_audio: true };
    timeline.scene_end = tlspan.sceneEnd(timeline);
    const job = core.makeJob({
      mode: "export", project: core.getProject(),
      prompt: `[produce] ${clips.length} ${sel.length ? "selected" : "kept"} scene(s)`,
      width: 0, height: 0, frames: 0, steps: 0, seed: 0, format: "webm",
      timeline,
    });
    res.json({ ok: true, job: core.jobDict(job),
               scenes: outs.map((o) => o.name) });
  });


  // Build the tmp style now, so the panel can show what the graph will contain
  // before anything is generated.
  app.post("/api/characters/build", async (req, res) => {
    try {
      const b = req.body || {};
      const built = await buildTmpStyle(b.project, null);
      const scened = applyScenes(JSON.parse(fs.readFileSync(wfPath(TMP_STYLE), "utf8")), b);
      fs.writeFileSync(wfPath(TMP_STYLE), JSON.stringify(scened.graph, null, 2), "utf8");
      res.json({ ok: true, file: TMP_STYLE, cast: built.cast, tail: built.tail,
                 notes: built.notes.concat(scened.notes) });
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
}

module.exports = { mount, buildTmpStyle, applyScenes, syncTmp, TMP_STYLE, BASE_STYLE, wfPath };
