// bitGen Studio v2 — every endpoint, mounted from here so server.js stays minimal.
// Ported 1:1 from the standalone server.js, plus:
//   GET  /api/plan                  4n+1 chunk plan preview (generation tools)
//   GET  /api/jobs/:id/preview      progressive joined preview (job dir)
//   GET  /api/modelfiles            Comfy-Org repo manifest + local status
//   POST /api/modeltools            queue a download / convert-to-GGUF job
//   GET  /api/frames                frame-exact strip for a clip range (lib/frames)
//   GET  /framecache/:key/:file     a single extracted frame jpeg
//   POST /api/timeline/edit         keep/cut a selection on one layer (lib/timelineEdit)
//   GET  /api/transitions           the transition catalogue (lib/transitions.json)
//   POST /api/projects/new          create + switch to a new project (lib/projects)
//   GET  /api/tts                   OpenAudio status + saved cloned voices
//   POST /api/tts/voices            save a voice clone (reference clip + text)
//   DELETE /api/tts/voices/:name    remove a voice clone
//   POST /api/tts/speak             synthesize -> project Sound folder
//   GET  /api/tts/checkpoint        diagnose the OpenAudio checkpoint folder
//   POST /api/tts/checkpoint/repair fix tokenizer_class so AutoTokenizer works
//   GET  /api/asr                   speech-to-text status + saved transcripts
//   POST /api/asr/transcribe        transcribe a sound/video asset (lyrics mode
//                                   also writes a timed .lrc)
//   GET  /api/asr/file/:name        read back a saved .txt/.srt/.lrc
//   POST /api/quickprompt           song -> transcript -> LLM -> timed shot list
//   POST /api/lyrics/burn           karaoke lyrics onto a rendered video
//   POST /api/llm/start             start llama-server on a chosen .gguf
//   POST /api/llm/stop              stop the running llama-server
//   GET  /api/hf                    whether a HuggingFace token is set (masked)
//   POST /api/hf/test               validate the token against HuggingFace
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const core = require("../lib/core");
const comfy = require("../lib/comfy");
const comfyPaths = require("../lib/comfyPaths");
const autostart = require("../lib/autostart");
const refContext = require("../lib/refContext");   // 2.354.0: the reference dock for the prompt LLM
const dockers = require("../lib/dockers");
const extensions = require("../lib/extensions");   // 2.217.0: dockers are ext/<id>/ extensions
const frames = require("../lib/frames");
const recycleBin = require("../lib/recycleBin");   // 2.223.15: soft delete
const tts = require("../lib/tts");
const asr = require("../lib/asr");
const quick = require("../lib/quickPrompt");
const lyrics = require("../lib/lyrics");
const venv = require("../lib/venv");
const transitions = require("../lib/transitions");
const styles = require("../lib/styles");
const modelFit = require("../lib/modelFit");   // 2.540.3: a checkpoint override only where it fits
const h3Long = require("../lib/h3Long");                 // 2.503.0: MiniMax H3 long single runs (up to 30 s)
const swapLib = require("../lib/swap");   // 2.328.0: swap styles (mmh3_chr_swap)
const imageSeed = require("../lib/imageSeed");
const projects = require("../lib/projects");
const clipTransform = require("../lib/clipTransform");   // 2.377.0: the timeline canvas's layer transforms
const keyframes = require("../lib/keyframes");           // 2.379.0: ◆ keyframes + tweens (static/keyframes.js)
const tlKeys = require("../lib/tlKeys");                 // 2.379.0: an image / text clip's keyframes for the export
const envs = require("../lib/environments");
const os = require("os");
const { spawnSync } = require("child_process");
const tledit = require("../lib/timelineEdit");
const tlspan = require("../lib/timelineSpan");
const clipFx = require("../lib/clipFx");             // 2.406.0: speed / reverse / ramps, grade + LUTs, sound clean-up, the mix
const captionsLib = require("../lib/captions");      // 2.406.0: the caption track
const deliverLib = require("../lib/deliver");
const frameSize = require("../static/framesize.js");   // 2.513.0: the timeline's frame size (shared with the page)        // 2.407.0: the 📤 Export queue
const splitEdit = require("../lib/splitEdit");       // 2.407.0: J / L cuts
const targetsLib = require("../static/tltargets.js");  // 2.412.0: a picture whose sound was taken out is silent
const nestLib = require("../lib/nest");                 // 2.414.0: a nested sequence's render
const negOf = (b) => require("../static/negprompt.js").clean(b && b.negative);   // 2.419.0: ⊖ the negative prompt docker
const tlRenderLib = require("../lib/tlRender");         // 2.418.0: ⚡ a render preview
const mixer = require("../lib/mixer");                  // 2.415.0: 🎚 the track mixer's faders, pans, master
const basicOverride = require("../lib/basicOverride"); // 2.409.0: Basic Settings' Override style for every video model
const waveform = require("../lib/waveform");
const adopt = require("../lib/adopt");
const comfyModels = require("../lib/comfyModels");
const cnTypes = require("../lib/controlnetTypes");   // 2.305.0
const cnBasics = require("../lib/cnBasics");         // 2.316.0: Basic Settings -> ControlNet
const faceFix = require("../lib/faceFix");           // 2.322.0: Basic Settings -> Face fix
const modelInstall = require("../lib/modelInstall");
const refGroups = require("../lib/refGroups");
const projectRefs = require("../lib/projectRefs");   // 2.101.0: reference media per project
const uiLayout = require("../lib/uiLayout");        // 2.103.0: dock layout in the settings file
const promptGuides = require("../lib/promptGuides"); // 2.104.0: how to prompt each model
const imageRefs = require("../lib/imageRefs");       // 2.105.0: Klein 9B renders with the reference dock
const qwenRefs = require("../lib/qwenRefs");         // 2.340.0: the dock's pictures as Qwen Image 2.1's <imageN>
const timelines = require("../lib/timelines");     // 2.107.0: named timelines in the project folder
const infill = require("../lib/infill");           // 2.108.0: image editor infill
const tempLoras = require("../lib/tempLoras");     // 2.111.0: per-project temporary LoRAs
const songs = require("../lib/songs");             // 2.241.0: the music dock's saved songs
const songwriter = require("../lib/songwriter");   // 2.244.0: "create a song" in the chat
const jobsInfo = require("../lib/jobsInfo");        // 2.113.0: per-project job history
const chatStore = require("../lib/chatStore");
const chatRecall = require("../lib/chatRecall");
const charsLib = require("../lib/characters");
const envsLib = require("../lib/environments");
const scenesLib = require("../lib/scenes");        // 2.230.0: the board's global prompt
const screenplayLib = require("../lib/screenplay");
const chapterRefsLib = require("../lib/chapterRefs");
const camera = require("../lib/camera");
const comfyGraphs = require("../lib/comfyGraphs");   // 2.120.0: a ComfyUI graph wired to H3 inputs
const graphToApi = require("../lib/graphToApi");     // 2.120.0: UI export -> API prompt, via /object_info
const llmChat = require("../lib/llmChat");
const captioner = require("../lib/captioner"); // 2.233.0: pictures in the prompt
const { planChunks, framesForSeconds, resolveAuto, FPS, MAX_SINGLE_RUN,
        GRIDS, gridFor, planShots, splitSong,
        MUSIC_MAX_FRAMES } = require("../lib/framePlan");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 64 * 1024 * 1024, files: 9 } });

function mount(app) {
  require("../lib/appLog").start();   // 2.522.0: the app console kept for 🐞 bug reports (from the first line on)
  app.use(express.json());
  require("./jxl").mount(app);         // 2.479.0: JPEG XL - a .jxl sent to an <img> goes as a PNG (lib/jxl.js)
  require("./remote").mount(app);      // phone pairing, QR, uploads, voice chat
  require("./characters").mount(app);  // the Video docker's character panel
  require("./swap").mount(app);        // 2.324.0: character swap (prompt docker Swap mode + a scene's ⇄)
  require("./refvideo").mount(app);    // 2.325.0: the reference dock's video selection dialog
  require("./filedialog").mount(app);  // 2.326.0: the Windows-11-style file / folder dialog
  require("./assets").mount(app);      // 2.327.0: asset groups + delete to the recycle bin
  require("./swapdlg").mount(app);     // 2.329.0: the character swap dialog (segments, vidTemp / vidSwap, compile)
  require("./viggleNative").mount(app); // 2.351.0: Viggle (native) - our own engine's install + status
  require("./native").mount(app);       // 2.352.0: the native engine behind Viggle (native) (status / check / install)
  require("./components").mount(app);   // 2.353.0: components.txt - Viggle (native) installed on start
  require("./sceneBridge").mount(app);  // 2.358.0: bridge scenes between the song's segments (types + the card's picker)
  require("./saveAs").mount(app);       // 2.359.0: Save / Save as for a picture, clip or song (the last save-as folder)
  require("./sfx").mount(app);          // 2.360.0: the SFX dock - audio from video / audio files, keep / delete a selection
  require("./screenCap").mount(app);    // 2.367.0: the left dock's 📷 screenshot / ⏺ screen recording -> the gallery
  require("./vrWorld").mount(app);      // 2.368.0: 🥽 VR World - a performer inside a 360 / 180 picture (vr_world_worker.py)
  require("./karaoke").mount(app);      // 2.373.0: the video docker's 🎤 Karaoke overlays + a song's lyrics file (lib/karaoke.js)
  require("./recycleBin").mount(app);   // 2.374.0: the left dock's 🗑 Recycle bin dialog + ↺ Reset project (lib/recycleBin, lib/projects)
  require("./pathGen").mount(app);      // 2.387.0: path layers - Wan ATI along a drawn path, the green screen cut away
  require("./blender").mount(app);      // 2.385.0: the Blender bridge - the add-on's sends, the Blender render bake
  require("./blendView").mount(app);    // 2.403.0: a .blend in the preview canvas - open, edit, save, render to real
  require("./sceneAI").mount(app);      // 2.404.0: ✨ build a scene with AI (LLM plan -> Blender) + 🧊 picture -> 3D model
  require("./daz").mount(app);          // 2.405.0: the Daz Studio bridge - renders, pictures, scenes (open / merge), figures
  require("./clipfx").mount(app);       // 2.406.0: the LUT library + the sound clean-up preview
  require("./captions").mount(app);     // 2.406.0: captions from what is said on the timeline
  require("./deliver").mount(app);      // 2.407.0: the 📤 Export queue's presets + delivered files
  require("./textfx").mount(app);       // 2.411.0: text effect presets (from PSD text effects)
  require("./nest").mount(app, core);   // 2.414.0: nested sequences
  require("./multicam").mount(app);     // 2.416.0: 🎥 multi-camera (angles synced by sound)
  require("./proxy").mount(app);        // 2.416.0: proxies for heavy footage
  require("./mogrt").mount(app);        // 2.417.0: 🧩 motion graphics templates
  require("./tlrender").mount(app, core); // 2.418.0: ⚡ render previews (real-time playback)
  require("./tlai").mount(app);          // 2.420.0: 🤖 AI inside the timeline
  require("./interchange").mount(app);  // 2.407.0: FCP XML / EDL / OTIO out, XML / EDL in
  require("./effects").mount(app);      // 2.409.0: the adjustment layer's placeholder picture
  require("./textedit").mount(app);     // 2.408.0: edit by transcript (a clip's words) + scene-cut detection
  require("./jobMeta").mount(app);      // 2.384.0: a render's metadata (seed, cfg, steps, models, loras) + the seeds to reuse
  require("./dockerCfg").mount(app);    // 2.392.0: docker.cfg - ⊞ Docker configs: the layout per set of dockers open together
  require("./dockerStatus").mount(app); // 2.381.0: docker_status.json - every dock's open / closed / hidden / size / 📌 max / maximized
  require("./tlCanvas").mount(app);     // 2.377.0: the timeline's preview canvas - its text layers' pictures
  require("./camPath").mount(app);      // 2.399.0: the timeline's 🎥 camera path - guide videos, what each model is told
  require("./seedvr2").mount(app);      // 2.400.0: ⏫ SeedVR2 video upscaling (preview dock + the ⚙ Upscaler's SeedVR2)
  require("./dlss5").mount(app);        // 2.504.0: ⚡ DLSS 5 enhance / upscale / frame generation (preview dock + the ⚙ Upscaler's DLSS 5)
  require("./scene").mount(app);        // 2.515.0: 🧍 cut-out through a shot, 📷 3D camera tracker, 🩹 content-aware fill
  require("./ueProject").mount(app);    // 2.513.0: 🎮 Load UE project (the bridge plugin put in, Unreal restarted)
  require("./lottie").mount(app);       // 2.512.0: ⤓ Lottie (JSON) export of the picture / text layers
  require("./audioAnalyze").mount(app); // 2.508.0: ♪ a sound's loudness / waveform / spectrum (Audio → keys, Waveform / Spectrum layers, ƒx audio())
  require("./styleCard").mount(app);    // 2.401.0: Basic Settings' video style card - the workflow's own models per phase
  require("./aiedit").mount(app);      // 2.332.0: the image editor's AI (regenerate / refine / remove / Qwen Edit / Kontext)
  require("./segment").mount(app);     // 2.390.0: Segment Anything (SAM + CLIPSeg) for the image editor - select / mask / layers
  require("./psd").mount(app);         // 2.390.0: the image editor's PSD files kept in the project (projects/<p>/psd)
  require("./pdf").mount(app);         // 2.424.0: the image editor's PDF files kept in the project (projects/<p>/pdf)
  require("./batch").mount(app);       // 2.427.0: the image editor's batch results kept in the project (projects/<p>/batch/<run>)
  require("./themes").mount(app);      // 2.435.0: saved themes - themes/<name>.json (Settings ▸ Themes)
  require("./fonts").mount(app);       // 2.435.0: the computer's font files - the image editor's PDF save embeds them
  require("./bgfiles").mount(app);     // 2.436.0: the image editor's .bgi + the timeline's .bgv in the project
  require("./bgp").mount(app);         // 2.436.0: the whole project as one .bgp (XML; self-contained or a manifest)
  require("./patterns").mount(app);    // 2.437.0: the image editor's pattern library - patterns/<name>.png
  require("./brushes").mount(app);     // 2.484.0: the image editor's brush presets - brushes/<name>.json (lib/brushStore.js)
  require("./imgconvert").mount(app);
  require("./subject").mount(app);
  require("./layerBake").mount(app);   // 2.490.0: baked timeline layers - a parented layer drawn by the page (lib/layerBake.js)     // 2.488.0: Select ▸ Subject with the AI matte - one still (lib/subjectMatte.js)  // 2.485.0: Export As ▸ AVIF - made with ffmpeg on this computer (lib/imgConvert.js)
  require("./quickprompts").mount(app);   // 2.451.0: the prompt docker's quick prompts - quick_prompts.json
  require("./storyboard").mount(app);   // 2.456.0: the StoryBoard's pictures - projects/<p>/storyboard/
  require("./layer3d").mount(app);      // 2.460.0: a Daz / Blender scene as a 3D layer of the image editor - projects/<p>/scene3d/
  require("./cad").mount(app);          // 2.464.0: sketch layers as .dxf / .svg - projects/<p>/cad/
  require("./trackpts").mount(app);     // 2.499.0: 🎯 tracking points / a plane (lib/trackPoints.js, scripts/track_points.py)
  require("./linked").mount(app);       // 2.469.0: linked smart objects' pictures - projects/<p>/linked/
  require("./body3d").mount(app);       // 2.471.0: parametric 3D bodies - the engine setting + the Blender engine
  require("./unreal").mount(app);       // 2.472.0: the Unreal Engine 5.8 bridge (lib/unreal.js <-> ue/bitGenBridge)
  require("./layout").mount(app);      // 2.438.0: dialog_layout.cfg / panel_layout.cfg - where windows were left
  require("./stylesRestore").mount(app);   // 2.547.0: ↺ the built-in styles back (Krea 2 …)
  require("./refKeep").mount(app);         // 2.548.0: the reference docker kept as it changes (POST /api/projects/refs)
  require("./sceneedit").mount(app);   // 2.337.0: the scene cards' ✎ First frame (Qwen Image 2.1)
  require("./voice").mount(app);       // 2.564.0: the 🎙 voice chat (lib/asrLive, lib/voiceAgent)
  require("./ltx").mount(app);         // 2.338.0: LTX 2.5 from the prompt docker (Tim's all-in-one canvas)
  require("./h3Viggle").mount(app);    // 2.352.0: the H3_Viggle style - each scene's 🎬 motion video
  require("./setup").mount(app);       // 2.341.0: the model catalog + the Hugging Face CLI inside the studio
  require("./queuePresets").mount(app); // 2.518.0: the menu bar's ⏱ queue presets (lib/queuePresets.js)
  require("./modelMgr").mount(app);     // 2.518.0: the 🧩 Model manager's cards + ✚ New style (lib/modelCards.js)
  require("./civitai").mount(app);      // 2.518.0: Civitai search / download into ComfyUI's folders (lib/civitai.js)
  require("./updater").mount(app);      // 2.540.5: ⟳ Update bitGen Studio from GitHub (lib/updater.js)
  require("./addons").mount(app);       // 2.540.4: Settings ▸ Add-ons - optional engines (YuE2, Viggle native) installed in the app (lib/addons.js)
  require("./realRefs").mount(app);     // 2.540.0: Blender / Unreal renders made real with the reference docker's pictures (lib/realRefs.js)
  require("./modelFolders").mount(app); // 2.538.0: model_folders.json - where each model type's downloads go (lib/modelFolders.js)
  require("./testPlan").mount(app);     // 2.518.0: the 🧪 Testing docker's checklist + the log to upload (lib/testPlan.js)
  require("./loraTrain").mount(app);    // 2.520.0: the 🎓 LoRA trainer (ai-toolkit - lib/loraTrain.js, lora_worker.py)
  require("./bugReport").mount(app);    // 2.522.0: the 🐞 Bug report docker (lib/bugReport.js, lib/appLog.js)
  require("./house").mount(app);        // 2.524.0: the 🏠 House builder docker (lib/house.js, static/housegeo.js)
  require("./workspaces").mount(app);   // 2.526.0: the Workspace dropdown's memory (lib/workspaces.js, workspaces.json)
  require("./styleDoctor").mount(app);  // 2.527.0: 🩺 the Style doctor (lib/styleDoctor.js)
  require("./help").mount(app);         // 2.530.0: the in-app help for the Ctrl+K palette (lib/helpDocs.js)
  require("./usage").mount(app);        // 2.520.0: 📊 the usage log (lib/usageLog.js)
  require("./remoteGpu").mount(app);    // 2.520.0: Settings -> Remote GPU (lib/remoteGpu.js)
  // 2.239.0: Cache-Control no-cache on the app's own assets. Without it,
  // Chromium's HEURISTIC caching (Last-Modified and no Cache-Control =
  // "fresh" for 10% of the file's age, hours for files months old) can
  // serve a docker's OLD script after an update without ever asking the
  // server — an updated feature that "is not in the docker" until a hard
  // reload. no-cache forces revalidation; unchanged files still answer as
  // cheap 304s, so nothing gets slower.
  const NO_CACHE = { setHeaders: (res) => res.setHeader("Cache-Control", "no-cache") };
  app.use("/static", express.static(path.join(core.BASE, "static"), NO_CACHE));
  // 2.217.0: the dockers live in ext/<id>/ — the page is ASSEMBLED per
  // request (shell + installed extensions), so dropping a folder into ext/
  // or deleting one takes effect on the next reload, no restart.
  app.use("/ext", express.static(path.join(core.BASE, "ext"), NO_CACHE));
  // 2.381.0: the page carries docker_status.json in its head (window.H3_DOCK_STATUS) - the layout is loaded first
  app.get("/", (_req, res) => res.type("html").send(require("./dockerStatus").page(extensions.pageHtml())));
  app.get("/api/extensions", (_req, res) => res.json({ extensions:
    extensions.list().map((e) => ({ id: e.id, name: e.name, order: e.order,
      html: !!e.html, scripts: e.scripts })) }));
  // 2.218.0: Settings → Extensions — install every extension zip in a folder
  // the user picked with the server-side path browser. Content-qualified
  // (ext/<id>/ext.json inside), overwrite-is-upgrade, per-zip report back.
  app.post("/api/extensions/install", (req, res) => {
    const dir = String((req.body || {}).dir || "").trim();
    if (!dir) return res.status(400).json({ error: "pick a folder first" });
    try { res.json(extensions.installFromDir(dir)); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });

  app.get("/outputs/:name", (req, res) => {
    const hit = findOutput(req.params.name);
    if (!hit) return res.status(404).json({
      error: `not in ${core.getProject()}/output or /final` });
    res.sendFile(hit.path);
  });
  app.get("/passets/:kind/:name", (req, res) => {
    const kind = ["images", "video", "sound"].includes(req.params.kind) ? req.params.kind : "images";
    res.sendFile(path.join(core.pDir(kind), path.basename(req.params.name)));
  });

  // Waveform peaks for a timeline clip. The response always describes the
  // WHOLE source file (see lib/waveform.js), so the UI slices it by in/out and
  // one fetch serves every clip cut from that file at every zoom level. Kinds
  // beyond sound are accepted because a video clip has a soundtrack too.
  app.get("/api/waveform", async (req, res) => {
    const kind = ["sound", "video", "output", "final"].includes(req.query.src)
      ? req.query.src : "sound";
    const name = path.basename(String(req.query.name || ""));
    if (!name) return res.status(400).json({ error: "name is required" });
    const file = path.join(core.pDir(kind), name);
    try {
      const w = await waveform.peaks(file, core.projDir(core.getProject()));
      // Peaks are derived from an immutable (path,size,mtime) triple, so they
      // are safe to cache hard in the browser as well as on disk.
      res.set("Cache-Control", "private, max-age=86400");
      res.json({ name, src: kind, ...w });
    } catch (e) {
      res.status(404).json({ error: String(e.message || e) });
    }
  });

  // ------------------------------------------------------------- config
  app.get("/api/config", (_req, res) => res.json(core.getConfig()));

  /** THE GLOBAL DOCK LAYOUT (2.159.0, by instruction): heights and
   *  min/max/normal states in dockers.json at the install root — the same
   *  layout in every project. POST merges a partial per dock. */
  app.get("/api/dockers", (_req, res) => res.json(dockers.load(core.BASE)));
  app.post("/api/dockers", (req, res) => {
    try { res.json(dockers.save(core.BASE, req.body || {})); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  // 2.99.0: the layered settings. default.settings is the default; a Save
  // writes only the difference to custom.settings; Reset drops that layer
  // (kept as custom.settings.bak) and keeps the open project.
  app.get("/api/settings/info", (_req, res) => res.json(core.settingsPaths()));
  app.post("/api/config/reset", (_req, res) => {
    try { res.json({ ok: true, config: core.resetConfig(), ...core.settingsPaths() }); }
    catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  app.post("/api/config", (req, res) => {
    const config = core.getConfig();
    const data = req.body || {};
    const prevComfy = { ...((config.engine || {}).comfy || {}) };   // pre-merge snapshot
    for (const k of ["python", "sd_cli", "lora_dir", "extra_args"]) if (k in data) config[k] = data[k];
    // NOTE: this is an allow-list — a new top-level config section MUST be
    // added here or its settings save silently, do nothing, and read back as
    // the defaults (which is exactly what "tts" did before it was listed).
    // 2.518.0: + power (Energy cost), civitai (the API key + site), queue (the queue preset) - Settings / the menu bar
    for (const s of ["models", "flags", "defaults", "llm", "gpu", "hf", "engine", "tts", "asr", "ui", "captioner", "power", "civitai", "queue", "setup"])   // 2.520.0: + setup (the hardware answers)
      if (data[s] && typeof data[s] === "object") config[s] = { ...config[s], ...data[s] };
    // `chain` REPLACES rather than merges (2.150.0): the tab's empty field
    // means "back to the export's default", which a merge could never say.
    if (data.chain && typeof data.chain === "object") config.chain = { ...data.chain };
    // engine.comfy is nested one level deeper — deep-merge it so a partial
    // update (e.g. just url/dir) never wipes the workflows mapping.
    if (data.engine && data.engine.comfy && typeof data.engine.comfy === "object")
      config.engine.comfy = { ...prevComfy, ...data.engine.comfy };
    core.setConfig(config);
    res.json(config);
  });

  // -------------------------------------------------------------- stats
  app.get("/api/stats", async (_req, res) => {
    const [gpus, cpuTemp] = await Promise.all([core.readGpus(), core.readCpuTemp()]);
    const os = require("os");
    const running = core.isRunning();
    res.json({
      cpu: core.cpuPercent(),
      cpu_temp: cpuTemp,
      ram_used: Math.round((os.totalmem() - os.freemem()) / 1048576),
      ram_total: Math.round(os.totalmem() / 1048576),
      gpus,
      power: (() => { try { return require("../lib/power").stats(); } catch { return null; } })(),   // 2.517.0: ⚡ power draw + clocks
      queue: core.queue.length,
      running: running ? { id: running.id, started: running.started,
                           chunk: running.chunk, preview_version: running.preview_version,
                           log_tail: running.log[running.log.length - 1] || "",
                           progress: require("../lib/jobMeta").progress(running) } : null,   // 2.384.0
    });
  });

  app.get("/api/health", async (_req, res) => {
    const cfg = core.resolvedConfig();
    const checks = { sd_cli: fs.existsSync(cfg.sd_cli) };
    const eng = core.getConfig().engine || {};
    if (eng.backend === "comfy") {
      const url = ((eng.comfy || {}).url || "http://127.0.0.1:8188").replace(/\/$/, "");
      try {
        const r = await fetch(url + "/system_stats", { signal: AbortSignal.timeout(1500) });
        checks.sd_cli = r.ok;   // health dot = engine reachable
        checks.comfy = r.ok;
        try {
          const n = await fetch(url + "/object_info/RHMiniMaxH3RefGen", { signal: AbortSignal.timeout(1500) });
          checks.comfy_nodes = n.ok;
        } catch { checks.comfy_nodes = false; }
      } catch { checks.sd_cli = false; checks.comfy = false; }
    }
    for (const [k, v] of Object.entries(cfg.models)) checks[k] = fs.existsSync(v);
    const py = require("child_process").spawnSync(core.getConfig().python, ["--version"]);
    checks.python = py.status === 0;
    res.json(checks);
  });

  // The single-run ceiling a plan may use (2.99.0): the model's grid ceiling,
  // lowered to engine.comfy.vram_ceiling when the video worker has learned
  // that a longer single run dies of GPU out-of-memory on this machine. Only
  // the comfy grid has a learned value; sd-cli keeps its own OOM ladder.
  const effectiveCeiling = (grid, long) => {
    const G = GRIDS[grid];
    // 2.503.0: a video style with Long video on (lib/h3Long) - one run up to 719f (30 s) on the H3 grid
    const MC = h3Long.modelCeiling(grid, G.ceiling, !!long);
    // 107f floor (2.99.4): below it a "ceiling" is not a memory limit but a bad
    // value, and honouring it shreds a clip into dozens of hand-offs.
    let v = grid === "17k5" ? (+((core.getConfig().engine || {}).comfy || {}).vram_ceiling || 0) : 0;
    if (v > 0 && v < 107) v = 0;
    return v > 0 ? Math.max(5, Math.min(MC, G.down(v))) : MC;
  };
  /** 2.503.0: does the request's video style run H3 long single runs? (?video_style_id= / body.video_style_id) */
  const longFor = (id) => {
    if (!id) return false;
    try { return h3Long.on(styles.byId(core.STYLES_DIR, String(id))); } catch { return false; }
  };

  // ------------------------------------------- generation tools: plan API
  app.get("/api/plan", (req, res) => {
    const seconds = req.query.seconds !== undefined ? parseFloat(req.query.seconds) : null;
    let frames = req.query.frames !== undefined ? parseInt(req.query.frames, 10) : null;
    if (frames === null && seconds !== null) frames = framesForSeconds(seconds);
    if (!frames || frames < 1 || frames > 24000) return res.status(400).json({ error: "invalid frames/seconds" });
    const segSec = parseFloat(req.query.segment_seconds || "15");
    // engine decides the frame grid: sd-cli = 4n+1 (ceiling 361), native
    // ComfyUI MiniMaxH3 = 17k+5 (ceiling 362). ?engine= overrides for preview.
    const eng = req.query.engine || (core.getConfig().engine || {}).backend || "sdcli";
    const grid = gridFor(eng);
    const G = GRIDS[grid];
    const long = longFor(req.query.video_style_id) || ["1", "true"].includes(String(req.query.long || ""));
    const CEIL = effectiveCeiling(grid, long);
    const MC = h3Long.modelCeiling(grid, G.ceiling, long);
    const maxChunk = Math.min(CEIL, G.up(Math.round(segSec * FPS)));
    const requested = ["auto", "single", "chunked", "png_rebuild"].includes(req.query.pipeline) ? req.query.pipeline : "auto";
    const pipeline = resolveAuto(requested, frames, CEIL);
    const force = ["1", "true", "yes"].includes(String(req.query.force_chunks || ""));
    const p = planChunks(frames, pipeline === "single" ? CEIL : maxChunk, grid,
                         force && pipeline !== "single", CEIL);
    const cc = ((core.getConfig().engine || {}).comfy || {});
    res.json({ targetFrames: frames, seconds: frames / FPS, fps: FPS, pipeline, grid,
               requestedPipeline: requested, maxSingleRun: CEIL, modelCeiling: MC, long,
               vramCeiling: CEIL < MC ? CEIL : 0,
               vramCeilingNote: CEIL < MC ? (cc.vram_ceiling_note || "") : "", ...p });
  });

  // ----------------------------------------------------------- generate
  app.post("/api/generate", upload.array("references", 9), (req, res) => {
    const f = req.body || {};
    let mode = f.mode || "ref2va";
    let prompt = (f.prompt || "").trim();
    const files = req.files || [];
    /* 2.399.0 (Tim: "can we add camera movement to follow a 3d path, pan,roll and dolly, height and angle to the tools
       in timeline docker. will we be able to tell mmh3 , wan and ltx to follow these paths"): the timeline's 🎥 camera
       path (lib/camPlan.js) - H3 gets its own camera sentence (+ the guide video as a reference video for the exact
       path), Wan the path in prose + its Fun Camera move / the depth guide (wan_worker.py picks by the files) */
    let camNotes = [], camWan = null;
    {
      const camPlan = require("../lib/camPlan");
      const pk = camPlan.parse(f.camera);
      if (pk) {
        const vsPick = f.video_style_id ? styles.byId(core.STYLES_DIR, String(f.video_style_id)) : null;
        const secs = (parseInt(f.frames, 10) || 120) / 24;
        if (vsPick && require("../lib/wan").isWanStyle(vsPick)) {
          const w = camPlan.forWan(pk, { seconds: secs });
          prompt = camPlan.join(prompt, w.text); camWan = w.camera; camNotes = w.notes;
        } else {
          let vids = [];
          try { vids = JSON.parse(f.ref_videos || "[]").map((n) => path.basename(String(n))); } catch { vids = []; }
          const h = camPlan.forH3(pk, { mode, refVideos: vids, seconds: secs });
          prompt = camPlan.join(prompt, h.text); camNotes = h.notes;
          if (h.addVideo && !vids.includes(h.addVideo)) f.ref_videos = JSON.stringify(vids.concat([h.addVideo]));
        }
      }
    }
    const askedMode = mode, typedPrompt = prompt;     // 2.368.0: a Wan style takes the request as typed

    if (!["ref2va", "fl2va", "t2va"].includes(mode))
      return res.status(400).json({ error: "mode must be ref2va, fl2va or t2va" });
    if (!prompt) return res.status(400).json({ error: "prompt is required" });
    /* 2.353.0 (Tim: "for video generation from prompt the h3_Video_ref workflow doesn't use video
       reference, can we add video and sound slots when a reference video and/or sound is added"): a
       reference video or sound in the dock IS a reference - Reference mode renders with it even without
       a picture, and Text mode with one goes through ref2va (worker.py adds the graph's video / sound
       slots - scripts/refslots.py) */
    /* 2.364.0 (Tim: "i think the llm is not following directions"): a prompt that writes speech as plain quotes
       ("says with a smile: \"Thank you!\"") renders as babble on MiniMax H3 - every spoken line is marked as H3
       dialogue here, typed or written by the LLM (lib/voiceStyle.markSpeech), and the job log says so */
    let speechNote = "";
    {
      const vs = require("../lib/voiceStyle");
      let auNames = [];
      try { auNames = JSON.parse(f.ref_audios || "[]").map((n) => path.basename(String(n))); } catch { auNames = []; }
      // 2.365.0: the whole H3 shape (casing, [English], the timbre, one voice definition, one closing line)
      const ms = vs.formatSpeech(prompt, { audioNames: auNames });
      if (ms.changes.length) {
        prompt = ms.text;
        speechNote = "formatted for MiniMax H3: " + ms.changes.join("; ");
      }
    }
    const avCount = (k) => { try { return (JSON.parse(f[k] || "[]") || []).length; } catch { return 0; } };
    const hasAv = avCount("ref_videos") + avCount("ref_audios") > 0;
    let modeNote = "";
    if (mode === "t2va" && hasAv) {
      mode = "ref2va";
      modeNote = "a reference video / sound is loaded - rendered as ref2va so the model uses it";
    }
    if (mode === "ref2va" && files.length === 0 && !hasAv)
      return res.status(400).json({ error: "ref2va needs at least one reference image, video or sound" });
    if (mode === "fl2va" && files.length > 2)
      return res.status(400).json({ error: "fl2va takes at most 2 frames (first, last)" });

    const d = core.getConfig().defaults;
    const clamp = (name, def, lo, hi) => {
      const v = parseInt(f[name], 10);
      return Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : def));
    };

    const id = require("crypto").randomBytes(6).toString("hex");
    const dir = path.join(core.JOBS_DIR, id);
    fs.mkdirSync(dir, { recursive: true });

    const referenceFiles = [], referenceNames = [];
    files.forEach((file, i) => {
      let ext = path.extname(file.originalname || "img.png").toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".webp", ".bmp"].includes(ext)) ext = ".png";
      const name = `ref_${String(i + 1).padStart(2, "0")}${ext}`;
      fs.writeFileSync(path.join(dir, name), file.buffer);
      referenceFiles.push(path.join(dir, name));
      referenceNames.push((file.originalname || name).replace(/[^A-Za-z0-9._-]+/g, "_"));
    });

    let refVideos = [], refAudios = [];
    try { refVideos = JSON.parse(f.ref_videos || "[]").map((n) => path.join(core.pDir("video"), path.basename(n))); } catch {}
    try { refAudios = JSON.parse(f.ref_audios || "[]").map((n) => path.join(core.pDir("sound"), path.basename(n))); } catch {}
    /* 2.388.0 (Tim: "add option to dropdown in reference docker video dropdown -"Append" ... take the last frame,
       upscale the png then generate an i2v or fl2va video from that frame-append the video" / "prepend" the same with
       the first frame): lib/frameOp - the frame out of the video, the render fl2va / i2v from it at the video's size,
       the worker upscales the frame and joins (scripts/clipjoin.py) */
    let frameOp = null;
    if (f.ref_video_op) {
      frameOp = require("../lib/frameOp").build({ raw: f.ref_video_op, videoDir: core.pDir("video"), jobDir: dir,
        files: referenceFiles, names: referenceNames, upscaler: require("../lib/renderSettings").read(core.projDir(core.getProject())).png_upscaler });
      if (frameOp && frameOp.error) return res.status(400).json({ error: frameOp.error });
      if (frameOp) {
        mode = "fl2va";
        referenceFiles.splice(0, referenceFiles.length, ...frameOp.files);
        referenceNames.splice(0, referenceNames.length, ...frameOp.files.map((p) => path.basename(p)));
        refVideos = refVideos.filter((p) => p !== frameOp.video);   // the op video is joined, not a reference
        if (modeNote && /ref2va/.test(modeNote)) modeNote = "";
      }
    }

    // ---- generation tools: 4n+1 planner params ----
    const frames = clamp("frames", d.frames, 1, 5760);
    const grid = gridFor((core.getConfig().engine || {}).backend);
    const G = GRIDS[grid];
    const long = longFor(f.video_style_id);       // 2.503.0: Long video (lib/h3Long) - one run up to 30 s
    const MC = h3Long.modelCeiling(grid, G.ceiling, long);
    const CEIL = effectiveCeiling(grid, long);  // learned VRAM ceiling applies here too
    // a long run's segment (when it still chunks) may be up to its ceiling, not the 15 s of a normal one
    const segSec = Math.max(2, Math.min(long ? MC / 24 : 15.05, parseFloat(f.segment_seconds) || 15));
    const maxChunk = Math.min(CEIL, G.up(Math.round((long && !f.segment_seconds ? MC / 24 : segSec) * 24)));
    const requested = ["auto", "single", "chunked", "png_rebuild"].includes(f.pipeline) ? f.pipeline : "auto";
    if (requested === "single" && frames > MC)
      return res.status(400).json({ error: `single-run supports up to ${MC} frames (${(MC / 24).toFixed(2)}s)`
        + (long ? "" : grid === "17k5" ? " - turn on Long video (a MiniMax H3 style's accelerators) for up to 30 s" : "") + "; use Auto" });
    const pipeline = resolveAuto(requested, frames, CEIL);
    const forceChunks = f.force_chunks === "true" || f.force_chunks === true;
    const plan = planChunks(frames, pipeline === "single" ? MC : maxChunk, grid,
                            forceChunks && pipeline !== "single", CEIL);

    // VIDEO STYLE (2.110.0): the dropdown beside the image style. Its own
    // workflow per mode, phases (model/steps/cfg), te, vae, LoRAs — applied by
    // worker.py apply_video_style(). Blank = the Settings -> ComfyUI template.
    let videoStyle = null;
    const bo = basicOverride.parse(f.basic);          // 2.409.0: Override style ON -> Basic Settings decide
    if (f.video_style_id) {
      const vs = styles.byId(core.STYLES_DIR, String(f.video_style_id));
      if (!vs || vs.kind !== "video") return res.status(400).json({ error: "that video style no longer exists — pick another in the dropdown" });
      // 2.328.0: a CHARACTER-SWAP style (mmh3_chr_swap) only renders in Swap mode
      if (swapLib.isSwapStyle(vs, core.BASE))
        return res.status(400).json({ error: `"${vs.name}" is a character-swap style - it only runs in Swap mode `
          + "(Basic Settings -> Swap). Pick Swap, or another video style for this render." });
      // 2.338.0: an LTX 2.5 style renders through POST /api/ltx (routes/ltx.js)
      if (require("../lib/ltx").isLtxStyle(vs))
        return res.status(400).json({ error: `"${vs.name}" is an LTX style - it renders through the LTX modes `
          + "(the prompt docker sends it to /api/ltx; reload the page if this came from an old tab)." });
      // 2.368.0 (Tim: "add a wan2.1 style so we can use wan as well, also wan2.2"): a Wan style renders through
      // wan_worker.py - the request's own pictures / sound / size / length (lib/wan.fromGenerate)
      { const wan = require("../lib/wan");
        if (wan.isWanStyle(vs)) {
          // 2.409.0: Override style ON - Basic Settings' steps / cfg (even 1) / seed / model / LoRAs beat the Wan style
          const wp = wan.fromGenerate({ style: basicOverride.withStyle(vs, bo, { loras: true }), mode: frameOp ? "fl2va" : askedMode, prompt: typedPrompt, files: referenceFiles,
            negative: negOf(f),                                  // 2.419.0: ⊖ the negative docker
            refAudios, frames: clamp("frames", d.frames, 1, 5760),
            width: frameOp ? frameOp.width : clamp("width", d.width, 128, 2048),
            height: frameOp ? frameOp.height : clamp("height", d.height, 128, 2048), seed: bo ? bo.seed : clamp("seed", -1, -1, 2 ** 31 - 1),
            steps: bo ? bo.steps : clamp("steps", 0, 0, 100), cfg: bo && bo.cfg != null ? bo.cfg : styles.numOr(f.cfg, 0),
            cfgExact: !!(bo && bo.cfg != null), camera: camWan });
          if (wp.error) return res.status(400).json({ error: wp.error });
          if (frameOp) wp.frame_op = Object.assign({}, frameOp.frame_op, { width: wp.width, height: wp.height });   // 2.388.0
          if (bo && bo.model) wp.basic_model = bo.model;      // 2.409.0: wan_worker uses it as it is (pick_models matches by name)
          const wjob = core.makeJob(wp, id, dir);
          wjob.chunk = { i: 0, n: 1 };
          const wnote = wan.summary(wp) + (frameOp ? " · " + frameOp.note : "") + (camNotes.length ? " · " + camNotes.join(" · ") : "");
          try { wjob.log.push("[bitgen-studio] " + wnote); } catch {}
          if (bo) try { wjob.log.push("[bitgen-studio] " + basicOverride.note(bo, "Wan")); } catch {}
          return res.json({ ...core.jobDict(wjob), note: wnote });
        } }
      // 2.352.0: H3_Viggle - a picture performing the reference dock's first video
      const hvWhy = require("../lib/h3Viggle").generateError(vs, mode, refVideos, files.length);
      if (hvWhy) return res.status(400).json({ error: hvWhy });
      videoStyle = vs;
    }
    // 2.111.0: temporary VIDEO LoRAs (Basic Settings): appended to the video
    // style's chain, or carried by a synthetic style when none is selected
    let extraV = [];
    try { extraV = tempLoras.normalize(JSON.parse(f.extra_loras || "[]")); } catch { extraV = []; }
    if (extraV.length) {
      videoStyle = videoStyle
        ? Object.assign({}, videoStyle, { loras: tempLoras.merge(videoStyle.loras, extraV) })
        : { id: null, name: "(temporary LoRAs)", kind: "video", engine: "comfy", arch: "minimax-h3",
            workflow: "", workflows: {}, phases: [{}], te: [""], vae: "", loras: extraV, negative: "", synthetic: true };
    }
    // 2.409.0: Override style ON - Basic Settings' model becomes phase 1's (the LoRAs rode in as extra_loras above)
    if (bo && bo.model)
      videoStyle = basicOverride.withStyle(videoStyle, bo, { synth: { id: null, name: "(Basic Settings model)", kind: "video", engine: "comfy",
        arch: "minimax-h3", workflow: "", workflows: {}, phases: [{}], te: [""], vae: "", loras: [], negative: "", synthetic: true } });
    const job = core.makeJob({
      mode, prompt, extra_loras: extraV,
      video_style: videoStyle, video_style_id: videoStyle && videoStyle.id ? videoStyle.id : null,
      video_style_name: videoStyle ? videoStyle.name : null,
      width: frameOp ? frameOp.width : clamp("width", d.width, 128, 2048),
      height: frameOp ? frameOp.height : clamp("height", d.height, 128, 2048),
      frames,
      // 0 = AUTO (2.100.0): the worker takes the count from the workflow —
      // the LoRA's own count when the turbo LoRA is on, else the base (20).
      steps: bo && bo.steps ? Math.min(200, bo.steps) : clamp("steps", d.steps, 0, 50),   // 2.409.0: Override style
      // the Basic-Settings CFG slider (2.93.0). 1.0 is MiniMax H3's intended
      // value (distilled); absent means exactly that, so old clients change
      // nothing. numOr, not ||: a numeric field never goes through truthiness.
      cfg: Math.max(0.5, Math.min(15, bo && bo.cfg != null ? bo.cfg : styles.numOr(f.cfg, 1))),
      seed: bo ? bo.seed : clamp("seed", -1, -1, 2 ** 31 - 1),
      // 2.102.1: mp4 is the default (webm does not share over Messenger)
      format: ["mp4", "webm", "avi"].includes(f.format) ? f.format : "mp4",
      speed: ["quality", "balanced", "fast", "turbo"].includes(f.speed) ? f.speed : "quality",
      segment_frames: maxChunk,
      pipeline, requested_pipeline: requested, plan,
      trim_exact: f.trim_exact !== "false" && f.trim_exact !== false,
      force_chunks: forceChunks,
      extra_args: (f.extra_args || "").trim(),
      reference_files: referenceFiles,
      reference_names: referenceNames,
      ref_videos: refVideos, ref_audios: refAudios,
      ...(modeNote ? { mode_note: modeNote } : {}),
      ...(frameOp ? { frame_op: frameOp.frame_op } : {}),           // 2.388.0
      // 2.419.0: ⊖ the negative docker - MiniMax H3 uses it through true CFG when cfg > 1 (worker.py / scripts/truecfg.py)
      ...(negOf(f) ? { negative_prompt: negOf(f) } : {}),
    }, id, dir);
    job.chunk = { i: 0, n: plan.chunks.length };
    if (modeNote) try { job.log.push("[bitgen-studio] " + modeNote); } catch {}
    if (speechNote) try { job.log.push("[bitgen-studio] " + speechNote); } catch {}
    if (frameOp) try { job.log.push("[bitgen-studio] " + frameOp.note); } catch {}
    for (const n of camNotes) try { job.log.push("[camera] " + n); } catch {}      // 2.399.0
    if (bo) try { job.log.push("[bitgen-studio] " + basicOverride.note(bo, "MiniMax H3")); } catch {}   // 2.409.0
    const notes = [modeNote, speechNote, frameOp && frameOp.note, ...camNotes].filter(Boolean).join(" · ");
    res.json({ ...core.jobDict(job), ...(notes ? { note: notes } : {}) });
  });

  // --------------------------------------------------------------- jobs
  app.get("/api/jobs", (req, res) => {
    // 2.345.1: only ids still in memory (a cleared job's id must not reach jobDict)
    // 2.371.0 (Tim: "when user creates a new project clear all the dockers"): the FINISHED jobs shown are the
    // current project's - a fresh project's queue starts empty; queued / running work is shown whatever project
    // it belongs to (it is still using the GPU). ?all=1 = every job in memory.
    const cur = core.getProject();
    const all = req.query.all === "1";
    res.json([...core.order].reverse().filter((id) => core.jobs.has(id)).map((id) => core.jobs.get(id))
      .filter((j) => all || j.status === "queued" || j.status === "running" || !j.project || j.project === cur)
      .map((j) => core.jobDict(j)));
  });
  /* JOB HISTORY (2.113.0): the project's jobs.info entries that are not in
     memory — done ones for the Done tab, interrupted pending ones for the
     Pending tab with Resume / Discard. */
  app.get("/api/jobs/history", (_req, res) => {
    res.json({ project: core.getProject(), history: jobsInfo.history(core.projDir(core.getProject()), [...core.jobs.keys()]) });
  });
  app.post("/api/jobs/history/:id/resume", (req, res) => {
    const pdir = core.projDir(core.getProject());
    const e = jobsInfo.read(pdir).find((x) => x.id === req.params.id);
    if (!e) return res.status(404).json({ error: "no such job in this project's jobs.info" });
    if (core.jobs.has(e.id)) return res.status(409).json({ error: "that job is already in memory" });
    if (e.state !== "pending" || !e.params) return res.status(400).json({ error: "only an interrupted pending job can be resumed" });
    // same id and folder, so its log/preview/reference files carry on
    const job = core.makeJob(e.params, e.id, path.join(core.JOBS_DIR, e.id));
    // 2.562.0: the StoryBoard scene that lost this job to the restart takes it back - its progress bar, not the ⚠
    let scenesBack = [];
    try { scenesBack = require("../lib/sceneResume").relink(core.getProject(), e.id); } catch { /* the job runs anyway */ }
    res.json(Object.assign(core.jobDict(job), scenesBack.length ? { scenes: scenesBack } : {}));
  });
  /* 2.260.0 ("add a clear button in the queue docker to clear the done
     queue"): one call empties the Done tab — this run's finished jobs
     leave memory, the project's finished history leaves jobs.info; the
     pending/interrupted entries (the resume list) are untouched. */
  app.delete("/api/jobs/done", (_req, res) => {
    let mem = 0;
    for (const [id, j] of [...core.jobs]) {
      if (j.status !== "queued" && j.status !== "running") { core.jobs.delete(id); mem++; }
    }
    // 2.345.1: ...and out of the job ORDER too - a cleared id left there broke
    // GET /api/jobs (jobDict(undefined)), so the list stopped refreshing
    for (let i = core.order.length - 1; i >= 0; i--) if (!core.jobs.has(core.order[i])) core.order.splice(i, 1);
    const hist = jobsInfo.clearDone(core.projDir(core.getProject()));
    res.json({ removed_memory: mem, removed_history: hist });
  });

  app.delete("/api/jobs/history/:id", (req, res) => {
    const ok = jobsInfo.remove(core.projDir(core.getProject()), req.params.id);
    if (!ok) return res.status(404).json({ error: "no such job in jobs.info" });
    try { require("../lib/sceneResume").forget(core.getProject(), req.params.id); } catch { /* 2.562.0: no scene waits for it */ }
    res.json({ removed: true });
  });
  app.get("/api/jobs/:id", (req, res) => {
    const job = core.jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: "no such job" });
    const from = parseInt(req.query.log_from, 10) || 0;
    res.json(core.jobDict(job, from));
  });
  app.post("/api/jobs/:id/cancel", (req, res) => {
    const job = core.jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: "no such job" });
    job.status = "cancelled";
    core.killTree(job);
    core.recordJob(job);
    res.json(core.jobDict(job));
  });
  app.get("/api/jobs/:id/reference/:n", (req, res) => {
    const job = core.jobs.get(req.params.id);
    const n = parseInt(req.params.n, 10);
    if (!job || !n || n > (job.params.reference_files || []).length)
      return res.status(404).json({ error: "not found" });
    res.sendFile(job.params.reference_files[n - 1]);
  });
  // progressive joined preview written by the worker into the job dir
  app.get("/api/jobs/:id/preview", (req, res) => {
    const job = core.jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: "no such job" });
    const p = path.join(job.dir, `preview.${job.params.format || "mp4"}`);
    if (!fs.existsSync(p)) return res.status(404).json({ error: "no preview yet" });
    res.sendFile(p);
  });

  // ------------------------------------------------------------ outputs
  // A finished job lands in output/ (renders) or final/ (timeline exports and
  // music-video cuts) — the gallery reads BOTH, or exports stay invisible.
  // "project" is the project ROOT, where a timeline compile writes
  // <project>.mp4. It is listed FIRST so that the compiled movie wins a name
  // lookup over a same-named render in output/ or final/.
  const OUT_DIRS = ["project", "output", "final"];
  const outDir = (which) => (which === "final"
    ? path.join(core.projDir(core.getProject()), "final")
    : which === "project"
      ? core.projDir(core.getProject())
      : core.pDir("output"));
  const findOutput = (name) => {           // first folder that has the file
    for (const w of OUT_DIRS) {
      const p = path.join(outDir(w), path.basename(name));
      if (fs.existsSync(p)) return { path: p, where: w };
    }
    return null;
  };
  // ?kind=images lists generated STILLS (the gallery's Images tab). Default
  // stays video so every existing caller — the gallery, the timeline, the
  // lyrics picker — keeps the exact response it has always had.
  // ?kind=audio lists generated SONGS (the gallery's Audio tab, 2.90.0).
  const OUT_RX = { video: /\.(webm|avi|webp|mp4|mkv|mov)$/i,
                   images: /\.(png|jpe?g|bmp)$/i,
                   audio: /\.(mp3|wav|flac|ogg|opus|m4a)$/i };
  app.get("/api/outputs", (req, res) => {
    // Never 500 here: the gallery and the timeline both read this endpoint,
    // and a throw used to leave both silently empty forever.
    try { core.ensureProject(core.getProject()); } catch {}
    const kind = ["images", "audio"].includes(String(req.query.kind || ""))
      ? String(req.query.kind) : "video";
    const rx = OUT_RX[kind];
    const files = [];
    const seen = new Set();
    for (const where of OUT_DIRS) {
      const dir = outDir(where);
      let names = [];
      try { names = fs.readdirSync(dir); } catch { continue; }
      for (const f of names) {
        if (!rx.test(f) || seen.has(f)) continue;
        try {
          const st = fs.statSync(path.join(dir, f));
          seen.add(f);
          files.push({ name: f, size: st.size, mtime: st.mtimeMs / 1000, where,
                       // ffprobe on a still is a wasted process per file per
                       // refresh, and the answer is meaningless anyway.
                       duration: kind === "images" ? null
                                 : core.probeDuration(path.join(dir, f)) });
        } catch { /* deleted mid-scan */ }
      }
    }
    files.sort((a, b) => b.mtime - a.mtime);
    res.json(files);
  });
  app.delete("/api/outputs/:name", (req, res) => {
    const hit = findOutput(req.params.name);
    if (!hit) return res.status(404).json({ error: "not found" });
    // 2.223.15 (by instruction): the Settings → General "Confirm delete"
    // checkbox decides the FATE, not just the dialog — checked means the
    // page asked and the file really goes; unchecked means no dialog and
    // the file moves to projects/<name>/recycle_bin instead, recoverable
    // by hand. The server reads the flag itself so a stale page can never
    // hard-delete what the settings say to keep.
    if ((core.getConfig().ui || {}).confirm_delete) {
      fs.unlinkSync(hit.path);
      return res.json({ deleted: path.basename(req.params.name), where: hit.where });
    }
    const moved = recycleBin.recycle(hit.path);
    res.json({ deleted: path.basename(req.params.name), where: hit.where,
               recycled: true, as: moved.name });
  });

  // 2.223.15 (by instruction): "add button at the top of the gallery to
  // clear gallery (this just moves the files to the project name\
  // recycle_bin)" — ALWAYS a move, never an unlink, whatever the checkbox
  // says: a one-press mass action must be recoverable. Every file the
  // gallery can list (all three kinds, all output folders) goes; the bin
  // itself is a subfolder, so the top-level scan can never eat it.
  app.post("/api/outputs/clear", (_req, res) => {
    let cleared = 0, to = null;
    for (const w of OUT_DIRS) {
      const dir = outDir(w);
      let names = [];
      try { names = fs.readdirSync(dir); } catch { continue; }
      for (const f of names) {
        if (!Object.values(OUT_RX).some((rx) => rx.test(f))) continue;
        const pth = path.join(dir, f);
        try {
          if (!fs.statSync(pth).isFile()) continue;
          to = recycleBin.recycle(pth).to; cleared++;
        } catch { /* deleted mid-scan */ }
      }
    }
    res.json({ ok: true, cleared, to: to || recycleBin.binDir() });
  });

  // ------------------------------------------------- frame inspector
  // "Show me every frame between these two markers." One ffmpeg pass, cached
  // on disk; the browser only ever fetches finished jpegs.
  app.get("/api/frames", (req, res) => {
    const file = frames.resolveMedia(req.query.name, req.query.src);
    if (!file) return res.status(404).json({ error: "clip media not found: " + (req.query.name || "") });
    try {
      const strip = frames.extract({
        file, start: req.query.start, end: req.query.end,
        fps: req.query.fps, width: req.query.width,
      });
      res.json(Object.assign({ name: path.basename(file), max_frames: frames.MAX_FRAMES }, strip));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get("/framecache/:key/:file", (req, res) => {
    const p = frames.framePath(req.params.key, req.params.file);
    if (!p) return res.status(404).json({ error: "frame expired — reopen the inspector" });
    res.sendFile(p);
  });

  // ------------------------------------------------- timeline editing
  // Keep / cut a time selection on one layer. The maths lives in
  // lib/timelineEdit.js so the UI and the unit tests share one implementation.
  // The dropdown is built from this, never from a list hard-coded in the page,
  // so adding a transition means editing lib/transitions.json and nothing else.
  app.get("/api/transitions", (_req, res) => {
    try { res.json(Object.assign({ transitions: transitions.list() }, transitions.defaults())); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/timeline/edit", (req, res) => {
    const b = req.body || {};
    if (!Array.isArray(b.clips)) return res.status(400).json({ error: "clips must be an array" });
    const kind = b.kind || "video";
    const fps = parseFloat(b.fps) || tledit.FPS;
    try {
      // Task B (2.95.0): trim the ONE clip under the playhead to start/end there
      if (b.op === "trim_head" || b.op === "trim_tail") {
        const at = parseFloat(b.at);
        if (!isFinite(at)) return res.status(400).json({ error: "at must be seconds" });
        let clips = tledit.trimAt(b.clips, kind, b.op === "trim_head" ? "head" : "tail", at, { fps });
        if (b.compact) clips = tledit.compact(clips, kind);
        return res.json({ op: b.op, kind, removed: b.clips.length - clips.length, clips });
      }
      if (!["keep", "cut"].includes(b.op))
        return res.status(400).json({ error: "op must be keep, cut, trim_head or trim_tail" });
      const a = parseFloat(b.a), z = parseFloat(b.b);
      if (!isFinite(a) || !isFinite(z)) return res.status(400).json({ error: "a and b must be seconds" });
      if (Math.abs(z - a) < 1e-6) return res.status(400).json({ error: "selection is empty" });
      // Task B (2.95.0): scope=clip edits only the clip under `at` (the UI
      // sends the selection midpoint); compact would drag the whole chain, so
      // it is deliberately ignored for this scope
      if (b.scope === "clip") {
        const at = isFinite(parseFloat(b.at)) ? parseFloat(b.at) : (a + z) / 2;
        const clips = tledit.applyClip(b.op, b.clips, kind, a, z, at, { ripple: !!b.ripple, fps });
        return res.json({ op: b.op, kind, scope: "clip", removed: b.clips.length - clips.length, clips });
      }
      const clips = tledit.apply(b.op, b.clips, kind, a, z, {
        ripple: !!b.ripple, compact: !!b.compact, fps });
      res.json({ op: b.op, kind, removed: b.clips.length - clips.length, clips });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // ------------------------------------------------- OpenAudio TTS
  app.get("/api/tts", async (_req, res) => {
    try { res.json(await tts.status()); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/tts/voices", upload.single("file"), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "a reference clip is required" });
      res.json(Object.assign(
        tts.saveVoice(req.body.name, req.body.text, req.file.buffer,
                      { start: req.body.start, end: req.body.end }),
        { voices: tts.listVoices() }));
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.delete("/api/tts/voices/:name", (req, res) => {
    try { res.json(Object.assign(tts.deleteVoice(req.params.name), { voices: tts.listVoices() })); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  // 2.102.0: a DESIGNED voice — a description, no clip (OmniVoice only)
  app.post("/api/tts/voices/design", (req, res) => {
    const b = req.body || {};
    try { res.json(Object.assign(tts.saveDesignVoice(b.name, b.instruct), { voices: tts.listVoices() })); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  // import test of the OmniVoice venv, for the status line
  app.get("/api/tts/omnivoice", async (_req, res) => {
    try { res.json(await tts.checkOmnivoice()); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/tts/speak", async (req, res) => {
    const b = req.body || {};
    try { res.json(await tts.speak(b.text, b.voice, b.name)); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });

  // 2.264.0: the OpenAudio checkpoint doctor is GONE with the engine —
  // OmniVoice pulls its model from the HF cache; nothing to inspect/repair.

  // ------------------------------------------- HuggingFace token
  // The token is never echoed back in full — only whether one is set and its
  // last few characters, so the field can be confirmed without exposing it.
  const maskTok = (t) => (!t ? "" : t.length <= 8 ? "•".repeat(t.length)
                                : "•".repeat(6) + t.slice(-4));
  app.get("/api/hf", (_req, res) => {
    const hf = core.getConfig().hf || {};
    res.json({ repo: hf.repo || "", has_token: !!hf.token, masked: maskTok(hf.token || "") });
  });
  app.post("/api/hf/test", async (req, res) => {
    const tok = String((req.body || {}).token || (core.getConfig().hf || {}).token || "").trim();
    if (!tok) return res.status(400).json({
      error: "no token set — paste one from huggingface.co/settings/tokens" });
    try {
      const r = await fetch("https://huggingface.co/api/whoami-v2", {
        headers: { Authorization: "Bearer " + tok },
        signal: AbortSignal.timeout(10000),
      });
      if (r.status === 401) return res.status(400).json({ error: "HuggingFace rejected that token (401)" });
      // a 403 from a corporate proxy or egress filter looks identical to a
      // permissions problem, so say both rather than blaming the token
      if (r.status === 403) return res.status(400).json({
        error: "403 from huggingface.co — either the token lacks read access, "
             + "or something on the network is blocking the request" });
      if (!r.ok) return res.status(400).json({ error: `HuggingFace returned ${r.status}` });
      const j = await r.json();
      res.json({ ok: true, name: j.name || j.fullname || "(unnamed)",
                 type: j.type || "user",
                 orgs: (j.orgs || []).map((o) => o.name).slice(0, 5) });
    } catch (e) {
      res.status(400).json({ error: e.name === "TimeoutError"
        ? "huggingface.co did not respond within 10s — check the network"
        : `could not reach huggingface.co (${e.message})` });
    }
  });

  // ------------------------------- local installs (venv per tool)
  app.post("/api/audio/install", (req, res) => {
    const which = (req.body || {}).which;
    // 2.264.0: openaudio is gone — OmniVoice and whisper are the venvs
    if (!["whisper", "omnivoice", "demucs"].includes(which))
      return res.status(400).json({ error: "which must be omnivoice, whisper or demucs" });
    const cfgv = which === "omnivoice" ? ((core.getConfig().tts || {}).omnivoice || {})
               : which === "demucs" ? (core.getConfig().stems || {})
               : (core.getConfig().asr || {});
    const dir = venv.venvDir(which, cfgv.venv);
    const job = core.makeJob({
      mode: `install_${which}`,
      project: core.getProject(),
      prompt: `[install] ${which} venv at ${dir}`,
      width: 0, height: 0, frames: 0, steps: 0, seed: 0, format: "webm",
      venv: dir,
      torch_index: (req.body || {}).torch_index || "",
      source: (req.body || {}).source || "",
      // lets the installer skip the ~600 MB CUDA wheels for a CPU-only setup
      device: which === "whisper" ? ((core.getConfig().asr || {}).device || "auto")
            : which === "demucs" ? ((core.getConfig().stems || {}).device || "auto")
            : ((core.getConfig().tts || {}).device || "cuda"),
      weights_dir: "",   // 2.264.0: OmniVoice pulls weights from the HF cache
      weights_repo: (req.body || {}).weights_repo
        || (core.getConfig().tts || {}).weights_repo || "",
      hf_token: (core.getConfig().hf || {}).token || "",
      // Highest compute capability present, so the installer can pick wheels
      // that actually CONTAIN kernels for this card — sm_120 (RTX 50-series)
      // has none in CUDA 12.4 builds. readGpus() is async and does not query
      // this, so ask nvidia-smi directly; 0 simply means "use the default".
      cuda_capability: (() => {
        try {
          const r = spawnSync("nvidia-smi",
            ["--query-gpu=compute_cap", "--format=csv,noheader"], { encoding: "utf8" });
          const caps = String(r.stdout || "").trim().split("\n")
            .map((x) => parseFloat(x)).filter((x) => isFinite(x));
          return caps.length ? Math.max(...caps) : 0;
        } catch { return 0; }
      })(),
    });
    res.json({ id: job.id, venv: dir, which });
  });

  // Cut the selected region of a clip and save it as a voice-clone reference.
  // Selecting by ear in the waveform beats trimming the file by hand, and the
  // cut happens server-side so the browser never re-encodes audio.
  app.post("/api/tts/voices/clip", (req, res) => {
    const b = req.body || {};
    try {
      const src = asr.findAsset(b.name);
      if (!src) return res.status(400).json({ error: `clip not found: ${b.name || "(none)"}` });
      const start = Math.max(0, parseFloat(b.start) || 0);
      const end = parseFloat(b.end);
      if (!isFinite(end) || end - start < 0.3)
        return res.status(400).json({ error: "select at least 0.3s of audio" });
      const tmp = path.join(os.tmpdir(), `h3ref_${Date.now().toString(36)}.wav`);
      const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
        "-ss", start.toFixed(3), "-i", src, "-t", (end - start).toFixed(3),
        "-vn", "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", tmp], { encoding: "utf8" });
      if (r.status !== 0 || !fs.existsSync(tmp))
        return res.status(400).json({ error: "could not cut that region: "
          + String(r.stderr || "").trim().split("\n").pop() });
      const buf = fs.readFileSync(tmp);
      try { fs.unlinkSync(tmp); } catch {}
      res.json(Object.assign(tts.saveVoice(b.voice, b.text, buf),
                             { voices: tts.listVoices(), from: path.basename(src),
                               start, end }));
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // Speak a short line to a temp file purely to prove the pipeline works.
  // Deliberately NOT saved into the Sound assets - a test should not leave
  // litter behind every time it is pressed.
  // polled by the UI while a synthesis runs, so a slow model load shows what
  // it is doing instead of an unexplained wait
  app.get("/api/tts/progress", (_req, res) => res.json(tts.progressState()));
  app.post("/api/tts/test", async (req, res) => {
    const b = req.body || {};
    const text = String(b.text || "").trim() || "The quick brown fox jumps over the lazy dog.";
    const tmpName = `__ttstest_${Date.now().toString(36)}`;
    try {
      const r = await tts.speak(text, b.voice || "", tmpName);
      const p = path.join(core.pDir("sound"), r.name);
      const bytes = r.bytes;
      const duration = r.duration;
      try { fs.unlinkSync(p); } catch {}
      res.json({ ok: true, bytes, duration, voice: r.voice, text });
    } catch (e) {
      try { fs.unlinkSync(path.join(core.pDir("sound"), tmpName + ".wav")); } catch {}
      res.status(400).json({ error: e.message });
    }
  });

  // Transcribe a saved voice clone (or an arbitrary region of a clip) so the
  // user does not have to type out what the reference says by hand — the
  // transcript is what zero-shot cloning conditions on, so getting it right
  // matters more than it looks.
  app.post("/api/tts/voices/transcribe", async (req, res) => {
    const b = req.body || {};
    try {
      let file = null, cleanup = null;
      if (b.voice) {
        const v = tts.readVoice(b.voice);
        if (!v) return res.status(400).json({ error: `voice "${b.voice}" not found` });
        file = v.path;
      } else {
        const src = asr.findAsset(b.name);
        if (!src) return res.status(400).json({ error: `clip not found: ${b.name || "(none)"}` });
        const start = Math.max(0, parseFloat(b.start) || 0);
        const end = parseFloat(b.end);
        if (!isFinite(end) || end - start < 0.3)
          return res.status(400).json({ error: "select at least 0.3s of audio" });
        file = path.join(os.tmpdir(), `h3tr_${Date.now().toString(36)}.wav`);
        cleanup = file;
        const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
          "-ss", start.toFixed(3), "-i", src, "-t", (end - start).toFixed(3),
          "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", file], { encoding: "utf8" });
        if (r.status !== 0) return res.status(400).json({ error: "could not cut that region" });
      }
      try {
        const tr = await asr.transcribeFile(file);
        res.json({ text: tr.text, language: tr.language });
      } finally { if (cleanup) { try { fs.unlinkSync(cleanup); } catch {} } }
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // Transcribe an uploaded file (the "Choose file" path, where the audio only
  // exists in the browser and is not a project asset yet).
  app.post("/api/asr/transcribe-upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "no file" });
    const tmp = path.join(os.tmpdir(), `h3up_${Date.now().toString(36)}`);
    fs.writeFileSync(tmp, req.file.buffer);
    try {
      const b = req.body || {};
      let src = tmp;
      const st = parseFloat(b.start), en = parseFloat(b.end);
      if (isFinite(st) && isFinite(en) && en > st) {
        src = tmp + ".cut.wav";
        spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
          "-ss", st.toFixed(3), "-i", tmp, "-t", (en - st).toFixed(3),
          "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", src], { encoding: "utf8" });
      }
      const tr = await asr.transcribeFile(src);
      if (src !== tmp) { try { fs.unlinkSync(src); } catch {} }
      res.json({ text: tr.text, language: tr.language });
    } catch (e) { res.status(400).json({ error: e.message }); }
    finally { try { fs.unlinkSync(tmp); } catch {} }
  });

  // ---------------------------------------- speech to text / lyrics
  app.get("/api/asr", async (_req, res) => {
    try { res.json(await asr.status()); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/asr/transcribe", async (req, res) => {
    try { res.json(await asr.transcribe(req.body || {})); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.get("/api/asr/file/:name", (req, res) => {
    const body = asr.readTranscript(req.params.name);
    if (body == null) return res.status(404).json({ error: "no such transcript" });
    res.type("text/plain").send(body);
  });

  // --------------------------------------- karaoke lyrics layer
  // Builds an ASS subtitle from a transcript (transcribing the song first if
  // there isn't one yet) and queues a worker job to burn it onto a video.
  app.post("/api/lyrics/burn", async (req, res) => {
    const b = req.body || {};
    try {
      const vid = asr.findAsset(b.video);
      if (!vid) return res.status(400).json({ error: `video not found: ${b.video || "(none)"}` });

      let segs = Array.isArray(b.segments) && b.segments.length ? b.segments : null;
      let from = "supplied";
      if (!segs && b.lyrics_file) {                     // reuse a saved .lrc/.srt
        const p = path.join(lyrics.ASS_DIR(), path.basename(b.lyrics_file));
        if (!fs.existsSync(p)) return res.status(400).json({ error: "no such transcript: " + b.lyrics_file });
        segs = lyrics.segmentsFromFile(p);
        from = path.basename(p);
      }
      if (!segs) {                                      // otherwise transcribe now
        const src = b.song || b.video;
        const tr = await asr.transcribe({ name: src, mode: "lyrics" });
        segs = tr.segments;
        from = "transcribed " + tr.name;
      }
      if (!segs || !segs.length)
        return res.status(400).json({ error: "no lyric lines to burn" });

      const ass = lyrics.writeAss(path.basename(vid), segs, {
        preset: b.preset, font: b.font, size: b.size, lead_in: b.lead_in,
        width: b.width, height: b.height,
      });
      const job = core.makeJob({
        mode: "lyrics",
        project: core.getProject(),
        prompt: `[lyrics] ${segs.length} line(s) onto ${path.basename(vid)}`,
        width: 0, height: 0, frames: 0, steps: 0, seed: 0, format: "webm",
        source: vid, ass,
      });
      res.json({ id: job.id, lines: segs.length, ass: path.basename(ass), source: from });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // ------------------------------- quick prompt (song -> timed shots)
  // Chains ASR and the LLM, so it can take a while: the LLM is loaded on
  // demand by core.ensureLlama and a long track transcribes first.
  app.post("/api/quickprompt", async (req, res) => {
    try { res.json(await quick.quickPrompt({ ...(req.body || {}), styles_dir: core.STYLES_DIR })); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });

  // ------------------------------------------------------------- assets
  app.post("/api/assets", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "no file" });
    let ext = path.extname(req.file.originalname || "a.bin").toLowerCase();
    const ok = [".wav", ".mp3", ".ogg", ".flac", ".m4a", ".opus", ".png", ".jpg", ".jpeg", ".webp", ".bmp"];
    if (!ok.includes(ext)) return res.status(400).json({ error: "unsupported file type " + ext });
    const name = Date.now().toString(36) + "_" + path.basename(req.file.originalname || "audio", path.extname(req.file.originalname || "")).replace(/[^A-Za-z0-9._-]+/g, "_") + ext;
    const p = path.join(core.ASSETS_DIR, name);
    fs.writeFileSync(p, req.file.buffer);
    const isImg = [".png", ".jpg", ".jpeg", ".webp", ".bmp"].includes(ext);
    res.json({ name, kind: isImg ? "image" : "audio", duration: isImg ? null : core.probeDuration(p) });
  });
  app.get("/api/assets", (_req, res) => {
    const files = fs.readdirSync(core.ASSETS_DIR).map((f) => ({
      name: f, duration: core.probeDuration(path.join(core.ASSETS_DIR, f)) }));
    res.json(files);
  });
  app.get("/assets/:name", (req, res) =>
    res.sendFile(path.join(core.ASSETS_DIR, path.basename(req.params.name))));

  /* 2.272.0: the ONE asset-save path, shared by /api/passets and the stems
     dock's 512MB song upload — same uniquify rule, same kind detection.
     Dropping a file whose name is already taken used to overwrite the asset
     in place. That is silent data loss twice over: the old file is gone, and
     every timeline clip still referencing that name now plays different
     footage. Uniquify instead — an upload always adds, never replaces. */
  function saveAssetFile(file) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const kind = core.kindOf(ext);
    if (!kind) { const e = new Error("unsupported file type " + ext);
                 e.status = 400; throw e; }
    const safe = path.basename(file.originalname).replace(/[^A-Za-z0-9._ -]+/g, "_");
    const dir = core.pDir(kind);
    const sufx = path.extname(safe);
    const stem = path.basename(safe, sufx);
    let name = safe;
    for (let n = 2; fs.existsSync(path.join(dir, name)); n++) name = `${stem} (${n})${sufx}`;
    const p = path.join(dir, name);
    // 2.330.0: a big upload arrives ON DISK (file.path, the asset multer
    // below) - moved into place, never read into memory
    if (file.path) {
      try { fs.renameSync(file.path, p); }
      catch { fs.copyFileSync(file.path, p); try { fs.unlinkSync(file.path); } catch { /* the copy is what counts */ } }
    } else fs.writeFileSync(p, file.buffer);
    const dur = kind === "images" ? null : core.probeDuration(p);
    return { name, kind, duration: dur, renamed: name !== safe ? safe : undefined };
  }
  /* 2.330.0 (Tim: "the video dialog is not loading movies, is there a
     maximum duration of movie that can be uploaded?"): there is no DURATION
     limit - the asset upload had a 64 MB in-memory SIZE limit, and its
     refusal was an HTML error page, so the callers said nothing at all.
     Assets now stream to disk (the project's temp folder, same volume ->
     a rename), any size, and a refusal is JSON in words. */
  const assetUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _f, cb) => { try { cb(null, core.tempDir()); } catch (e) { cb(e); } },
      filename: (_req, _f, cb) => cb(null, "upload_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8)),
    }),
    limits: { files: 1 },
  });
  app.post("/api/passets", (req, res) => {
    assetUpload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ error: "the upload failed: " + (err.message || err) });
      if (!req.file) return res.status(400).json({ error: "no file" });
      try { res.json(saveAssetFile(req.file)); }
      catch (e) {
        try { if (req.file.path) fs.unlinkSync(req.file.path); } catch { /* already moved or gone */ }
        res.status(e.status || 500).json({ error: String(e.message || e) });
      }
    });
  });
  /* Bring a GALLERY file (projects/<p>/{,output,final}) into the project's
     asset folders so it can be addressed BY NAME (2.70.0).

     WHY THIS EXISTS AS AN ENDPOINT AND NOT A BROWSER-SIDE COPY: the reference
     dock hands ref_videos/ref_audios to POST /api/generate as bare names, and
     that route resolves them under core.pDir("video") / pDir("sound") and
     nowhere else. A name dragged straight out of the gallery would resolve to a
     path that does not exist, the job would start anyway, and the render would
     come back silently missing its reference. Adopting first makes the name
     true. See lib/adopt.js for the link-not-copy and .webp reasoning. */
  app.post("/api/passets/adopt", (req, res) => {
    try { core.ensureProject(core.getProject()); } catch { /* listing still works */ }
    const b = req.body || {};
    const r = adopt.adopt(b.name, {
      searchDirs: core.outputDirs(),
      dirs: { images: core.pDir("images"), video: core.pDir("video"),
              sound: core.pDir("sound") },
      kinds: core.PKINDS,
      hint: ["images", "video", "sound"].includes(b.kind) ? b.kind : undefined,
    });
    if (!r.ok)
      return res.status(r.code === "missing" ? 404 : 400)
                .json({ error: r.error, code: r.code });
    const p = path.join(core.pDir(r.kind), r.name);
    res.json({ name: r.name, kind: r.kind, how: r.how,
               renamed: r.name !== path.basename(String(b.name || "")) ? path.basename(String(b.name || "")) : undefined,
               duration: r.kind === "images" ? null : core.probeDuration(p) });
  });

  /**
   * 2.214.0 (by instruction: "allow me to load a picture in the preview tab,
   * so i can see the exr previews etc"): tone-map an uploaded .exr/.hdr into
   * PNG bytes and stream them straight back. Nothing is stored, named or
   * adopted — this is a LOOK, not an import; the browser frees the blob when
   * the preview changes. Ordinary images never come here: the client shows
   * those from a local object URL without a round trip, so a non-HDR
   * extension is refused in words instead of converted for nothing. The
   * chain is lib/environments' HDR_TONEMAP — ONE tone-mapper in the app,
   * so what the preview shows is exactly the look a Locations pano gets.
   * (This router's multer is memoryStorage, so the buffer stages to a temp
   * file for ffmpeg and both temp files die when the response has gone.)
   */
  app.post("/api/preview/hdr", upload.single("file"), (req, res) => {
    if (!req.file || !req.file.buffer) return res.status(400).json({ error: "no file" });
    const ext = path.extname(req.file.originalname || "").toLowerCase();
    if (!envs.HDR_EXT.has(ext)) return res.status(400).json({ error:
      `${req.file.originalname}: not an HDR image (.exr / .hdr) — the `
      + "browser previews ordinary pictures directly" });
    const stem = path.join(os.tmpdir(),
      `h3-hdrprev-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`);
    const src = stem + ext, out = stem + ".png";
    const gone = () => { fs.unlink(src, () => {}); fs.unlink(out, () => {}); };
    try { fs.writeFileSync(src, req.file.buffer); }
    catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
    const r = envs.convertHdrPano(src, out);
    if (r.error) { gone(); return res.status(400).json({ error: r.error }); }
    res.type("png");
    res.sendFile(out, () => gone());
  });

  /* 2.298.0 (Tim: "scan the projects subfolders for images and music and
     videos before adding it to a dropdown. scan for assets, characters,
     locations etc."): every media file in the project, grouped by where it
     lives (lib/projectMedia); a pick outside the asset folders is adopted
     into them so its NAME works everywhere the asset names do. */
  app.get("/api/pmedia", (req, res) => {
    const pm = require("../lib/projectMedia");
    const all = pm.scan(req.query.project);
    const kind = String(req.query.kind || "");
    res.json(["images", "video", "sound"].includes(kind) ? { [kind]: all[kind] } : all);
  });
  app.get("/pmedia", (req, res) => {
    const p = require("../lib/projectMedia").resolve(req.query.project, req.query.rel);
    if (!p) return res.status(404).json({ error: "not a media file in this project" });
    res.sendFile(p);
  });
  app.post("/api/pmedia/adopt", (req, res) => {
    const b = req.body || {};
    const r = require("../lib/projectMedia").adopt(b.project, b.rel);
    if (!r.ok) return res.status(400).json({ error: r.error });
    res.json(r);
  });
  app.get("/api/passets", (_req, res) => {
    const out = {};
    for (const kind of ["images", "video", "sound"]) {
      out[kind] = fs.readdirSync(core.pDir(kind)).map((f) => ({
        name: f,
        duration: kind === "images" ? null : core.probeDuration(path.join(core.pDir(kind), f)),
      }));
    }
    res.json(out);
  });

  // ----------------------------------------------------------- projects
  // ------------------------------------------------------- music video
  // A song is cut into shots on the frame grid (15 s by default: 0-15,
  // 15-30, …). Each shot renders with its own prompt, the shots are chained
  // with the usual fl2va hand-off + seam-dropped join, and the song is muxed
  // over the finished cut — the video is frame-exact at 24 fps, so shot
  // boundaries land on exact song timestamps with no drift.
  app.get("/api/musicvideo/plan", (req, res) => {
    const grid = gridFor((core.getConfig().engine || {}).backend);
    const per = Math.max(1, parseFloat(req.query.shot_seconds || "15"));
    let secs = [];
    if (req.query.song) {
      const p = path.join(core.pDir("sound"), path.basename(req.query.song));
      if (!fs.existsSync(p)) return res.status(404).json({ error: "song not in the project's Sound assets" });
      const dur = core.probeDuration(p);
      if (!dur) return res.status(400).json({ error: "could not read the song's duration (is ffprobe installed?)" });
      const from = Math.max(0, parseFloat(req.query.start || "0"));
      const want = Math.min(dur - from, parseFloat(req.query.seconds || String(dur - from)));
      secs = splitSong(Math.max(1, want), per, grid);
      const plan = planShots(secs, grid);
      return res.json({ song: path.basename(req.query.song), songSeconds: dur,
                        start: from, shotSeconds: per, ...plan });
    }
    const want = Math.max(1, parseFloat(req.query.seconds || "60"));
    secs = splitSong(want, per, grid);
    res.json({ songSeconds: null, start: 0, shotSeconds: per, ...planShots(secs, grid) });
  });

  app.post("/api/musicvideo", (req, res) => {
    const b = req.body || {};
    // 2.338.0: an LTX 2.5 style makes music videos on the scene board (the
    // Video docker's Workflow "LTX 2.5" - each shot lip-synced to its slice)
    { const vs0 = b.video_style_id ? styles.byId(core.STYLES_DIR, String(b.video_style_id)) : null;
      if (vs0 && require("../lib/wan").isWanStyle(vs0))       // 2.368.0
        return res.status(400).json({ error: `"${vs0.name}" is a Wan style - Wan renders from the prompt docker `
          + "(Ref / F-L / Text in Basic Settings) or in the 🥽 VR World dialog; music videos run on MiniMax H3 or LTX 2.5" });
      if (vs0 && require("../lib/ltx").isLtxStyle(vs0))
        return res.status(400).json({ error: `"${vs0.name}" is an LTX style - LTX music videos run on the scene board: `
          + "StoryBoard -> Workflow \"LTX 2.5\", load the song, ▶ render (each scene lip-syncs to its slice)" }); }
    const grid = gridFor((core.getConfig().engine || {}).backend);
    const shotsIn = Array.isArray(b.shots) ? b.shots : [];
    if (!shotsIn.length) return res.status(400).json({ error: "no shots — add at least one" });
    // saved reference groups -> image paths, so a shot can re-anchor the
    // character instead of inheriting drift from the previous frame
    const groupImages = (name) => {
      if (!name) return [];
      try {
        // per-group files under references/ (2.82.0), with the legacy
        // refgroups.json migrated on first read — see lib/refGroups.js
        const g = refGroups.byName(core.projDir(core.getProject()), name);
        return (g ? g.images : [])
          .map((im) => path.join(core.pDir("images"), im.name))
          .filter((p) => fs.existsSync(p)).slice(0, 9);
      } catch { return []; }
    };
    const defGroup = b.ref_group || null;
    const shots = shotsIn.map((s, i) => {
      const group = s.ref_group === undefined ? defGroup : (s.ref_group || null);
      let mode = String(s.mode || "").trim();
      if (!["ref", "cont", "t2va"].includes(mode))
        mode = i === 0 ? (group ? "ref" : "t2va") : String(b.default_mode || "cont");
      const refs = mode === "ref" ? groupImages(group) : [];
      if (mode === "ref" && !refs.length) mode = i === 0 ? "t2va" : "cont";
      return {
        prompt: String(s.prompt || "").trim(),
        seconds: Math.max(0.5, parseFloat(s.seconds) || 15),
        mode, ref_group: mode === "ref" ? group : null, refs,
      };
    });
    if (shots.some((s) => !s.prompt))
      return res.status(400).json({ error: "every shot needs a prompt" });
    const plan = planShots(shots.map((s) => s.seconds), grid);
    if (plan.overCap)
      return res.status(400).json({ error: `music videos are capped at ${MUSIC_MAX_FRAMES / FPS / 60} minutes` });
    const bad = plan.shots.find((s) => s.overCeiling);
    if (bad)
      return res.status(400).json({ error: `shot ${bad.index} is ${bad.seconds.toFixed(2)}s — max ${plan.maxShotSeconds.toFixed(2)}s per shot on this engine` });

    if (shots[0].mode === "cont") shots[0].mode = shots[0].refs.length ? "ref" : "t2va";
    let music = null;
    if (b.song) {
      music = path.join(core.pDir("sound"), path.basename(b.song));
      if (!fs.existsSync(music)) return res.status(400).json({ error: "song not found in the project's Sound assets" });
    }
    const d = core.getConfig().defaults;
    const id = require("crypto").randomBytes(6).toString("hex");
    const dir = path.join(core.JOBS_DIR, id);
    fs.mkdirSync(dir, { recursive: true });

    const referenceFiles = shots[0].refs.slice();     // shot 1 seeds the job
    const mode = referenceFiles.length ? "ref2va" : "t2va";

    const job = core.makeJob({
      mode, prompt: shots[0].prompt,
      width: parseInt(b.width, 10) || d.width,
      height: parseInt(b.height, 10) || d.height,
      frames: plan.frames,
      steps: Math.max(0, parseInt(b.steps, 10) || d.steps || 0),   // 0 = auto (2.100.0)
      // 2.110.0: the music video takes the same video style as Generate
      video_style: (() => {
        const vs = b.video_style_id ? styles.byId(core.STYLES_DIR, String(b.video_style_id)) : null;
        const base = vs && vs.kind === "video" ? vs : null;
        const extra = tempLoras.normalize(b.extra_loras);
        if (!extra.length) return base;
        return base ? Object.assign({}, base, { loras: tempLoras.merge(base.loras, extra) })
                    : { id: null, name: "(temporary LoRAs)", kind: "video", engine: "comfy", arch: "minimax-h3", workflow: "", workflows: {}, phases: [{}], te: [""], vae: "", loras: extra, negative: "", synthetic: true };
      })(),
      seed: Number.isFinite(parseInt(b.seed, 10)) ? parseInt(b.seed, 10) : -1,
      format: ["mp4", "webm", "avi"].includes(b.format) ? b.format : "mp4",
      speed: "quality",
      pipeline: "chunked", trim_exact: true,
      segment_frames: GRIDS[grid].ceiling,
      shots, music, music_start: Math.max(0, parseFloat(b.start) || 0),
      reference_files: referenceFiles, reference_names: referenceFiles.map((f) => path.basename(f)),
      ref_videos: [], ref_audios: [],
      plan: { chunks: plan.shots.map((s) => s.gen), unique: plan.frames, trim: 0 },
    }, id, dir);
    job.chunk = { i: 0, n: shots.length };
    res.json(core.jobDict(job));
  });

  // --------------------------------------------------- reference groups
  // A named set of reference media inside the current project, stored in
  // projects/<p>/refgroups.json. Images/videos/sounds themselves live in the
  // project's own asset folders (uploaded via /api/passets), so a group is
  // just names + the per-image subject/aspect assignment.
  /* Reference groups: ONE FILE PER GROUP, projects/<p>/references/<name>.json,
     each item recorded as filename + reference type (image | video | sound) —
     see lib/refGroups.js for the format and the one-way migration from the old
     single refgroups.json. The wire shape below is unchanged on purpose. */
  app.get("/api/refgroups", (_req, res) =>
    res.json({ project: core.getProject(),
               groups: refGroups.read(core.projDir(core.getProject())) }));
  app.post("/api/refgroups", (req, res) => {
    const b = req.body || {};
    const group = {
      name: b.name,
      images: Array.isArray(b.images) ? b.images.slice(0, 9) : [],
      videos: (Array.isArray(b.videos) ? b.videos : []).slice(0, 3),
      audios: (Array.isArray(b.audios) ? b.audios : []).slice(0, 3),
      notes: b.notes && typeof b.notes === "object" ? b.notes : undefined,      // 2.539.0: the videos' / sounds' descriptions
    };
    try {
      core.ensureProject(core.getProject());
      const saved = refGroups.save(core.projDir(core.getProject()), group);
      res.json({ saved: saved.name,
                 groups: refGroups.read(core.projDir(core.getProject())) });
    } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.delete("/api/refgroups/:name", (req, res) => {
    const dir = core.projDir(core.getProject());
    if (!refGroups.remove(dir, req.params.name))
      return res.status(404).json({ error: "no such group" });
    res.json({ deleted: refGroups.safeName(req.params.name),
               groups: refGroups.read(dir) });
  });

  // ------------------------------------------------- image styles + image gen
  // A style is a saved model/VAE/TE/steps/cfg/LoRA set for still images. It
  // lives in styles/<name>.json rather than config.json BECAUSE
  // POST /api/config is an allow-list and a user-owned growing list does not
  // belong behind one — see the header of lib/styles.js.
  //
  // NOTE THE ALLOW-LIST DOCTRINE STILL APPLIES HERE, just in one place:
  // lib/styles.js normalize() is the single field list. This route must NEVER
  // hand-copy fields, or the two lists will drift and a new field will save
  // silently, do nothing, and read back as a default.
  /* Camera presets (2.88.0). Served rather than embedded so the vocabulary in
     lib/cameraPresets.json can be edited without rebuilding the page, and so
     the mode filter (a still has no camera MOVE) is applied in one place. */
  app.get("/api/camera", (req, res) => {
    const mode = String(req.query.mode || "video");
    res.json({ mode, groups: camera.list(mode) });
  });
  app.post("/api/camera/phrase", (req, res) => {
    const b = req.body || {};
    res.json({ phrase: camera.phrase(b.select || b.ids || [], b.mode || "video") });
  });

  app.get("/api/imagearchs", (_req, res) => {
    try { res.json(styles.catalogue()); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  /* The music-model catalogue (2.90.0) — lib/musicArch.json, one entry per
     music generator, read by the Settings -> Music tab. Same doctrine as the
     image one: the dropdown and the worker cannot disagree about what exists. */
  app.get("/api/musicarchs", (_req, res) => {
    try { res.json(styles.musicCatalogue()); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  // 2.110.0: video style architectures (lib/videoArch.json)
  app.get("/api/videoarchs", (_req, res) => {
    try { res.json(styles.videoCatalogue()); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  /* The files ComfyUI can actually load, for the Settings → Image dropdowns
     (2.71.0). In comfy mode those fields are ComfyUI dropdown VALUES, not paths
     on this machine, so free text is how you get "Value not in list" — see the
     2.12.x saga in HANDOVER.md. lib/comfyModels.js reads both the default
     models tree and extra_model_paths.yaml.

     CACHED, because a models tree is tens of thousands of files on a real
     install and the Settings dialog would stall every time it opened. The cache
     is keyed on the ComfyUI folder AND the yaml's mtime, so editing the yaml
     invalidates it by itself; ?refresh=1 forces a rescan for the case the cache
     cannot see (a file dropped into a folder). A stale list here is not
     cosmetic — it is a name the user picks that ComfyUI then rejects — so the
     TTL is deliberately short and the UI has a visible refresh button. */
  let cmCache = null;
  app.get("/api/comfymodels", async (req, res) => {
    try {
      const c = (core.getConfig().engine || {}).comfy || {};
      const dir = c.dir || "";
      const url = (c.url || "http://127.0.0.1:8188").replace(/\/$/, "");
      const dirAbs = dir ? core.resolvePath(dir) : "";
      const extraPaths = c.extra_paths || "";
      let stamp = "";
      try {
        const y = comfyModels.findYaml(dirAbs, extraPaths);
        stamp = y ? String(fs.statSync(y).mtimeMs) : "";
      } catch { /* no yaml, or unreadable — scan() reports that itself */ }
      const key = dirAbs + "\u0000" + url + "\u0000" + stamp;
      const fresh = req.query.refresh === "1" || req.query.refresh === "true";
      if (!fresh && cmCache && cmCache.key === key && Date.now() - cmCache.at < 30000)
        return res.json({ ...cmCache.data, cached: true });
      // ComfyUI's own /object_info is authoritative when it answers; the folder
      // scan is the fallback for configuring things before it is running
      const data = await comfyModels.list(dirAbs, url, { extraPaths });
      // The Model field draws from several categories at once; serving the list
      // means the dropdown and lib/comfyModels.js cannot drift apart.
      data.model_categories = comfyModels.MODEL_CATEGORIES;
      cmCache = { key, at: Date.now(), data };
      res.json({ ...data, cached: false });
    } catch (e) {
      // never 500: the Settings dialog has to open even when this cannot answer
      res.json({ ok: false, dir: "", dir_exists: false, yaml: null, source: "none",
                 categories: {}, model_categories: comfyModels.MODEL_CATEGORIES,
                 warnings: [String(e.message || e)], cached: false });
    }
  });

  /* Make a model visible to a DIFFERENT ComfyUI loader (2.79.0).

     ComfyUI resolves a combo value inside the search paths registered for that
     folder type, so a FLUX diffusion model filed under `checkpoints` cannot be
     picked by UNETLoader however correct the file is. Tim had been copying such
     models into ComfyUI's own folder by hand; this does it as a hard link, and
     preserves the subfolder so the style's saved name keeps working unchanged.
     See lib/modelInstall.js for the cross-volume refusal. */
  app.post("/api/comfymodels/install", async (req, res) => {
    try {
      const b = req.body || {};
      const c = ((core.getConfig().engine || {}).comfy || {});
      const dirAbs = c.dir ? core.resolvePath(c.dir) : "";
      // roots come from the SCAN, not the live list: /object_info says what
      // ComfyUI can load, never where on disk it would look
      const sc = comfyModels.scan(dirAbs, { extraPaths: c.extra_paths || "" });
      const rootsOf = (k) => ((sc.categories || {})[k] || {}).roots || [];
      if (!(sc.categories || {})[b.from] || !(sc.categories || {})[b.to])
        return res.status(400).json({ error: "unknown model category", code: "bad-category" });
      const r = modelInstall.install({
        name: b.name, fromRoots: rootsOf(b.from), toRoots: rootsOf(b.to),
        allowCopy: !!b.allow_copy,
      });
      if (!r.ok) return res.status(r.code === "missing" ? 404 : 409).json(r);
      cmCache = null;         // the lists just changed; never serve the old one
      res.json(r);
    } catch (e) {
      res.status(500).json({ error: String(e.message || e), code: "error" });
    }
  });

  /* THE CONTROLNET TYPES + PREPROCESSOR FILES (2.305.0, by instruction):
     Settings -> ControlNet's Type list and its INPUT model picker. The
     annotators live in ComfyUI's custom_nodes/comfyui_controlnet_aux/ckpts,
     which the models scan never walks - lib/controlnetTypes scans it. */
  app.get("/api/controlnet/preprocessors", (req, res) => {
    try {
      const c = ((core.getConfig().engine || {}).comfy || {});
      const dirAbs = c.dir ? core.resolvePath(c.dir) : "";
      const sc = cnTypes.scan(dirAbs);
      res.json({ types: cnTypes.catalogue(), exts: cnTypes.EXTS, comfy_dir: dirAbs,
                 dirs: sc.dirs, exists: sc.exists, files: sc.files });
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });

  /* 2.316.0 (Tim: "add controlnet accordian menuitem to basic settings in
     left docker, checkbox - use controlnet, dropdown-types, dropdown-
     preprocessor, dropdown model folder, dropdown model, cfg slider, steps
     slider, lora folder, lora dropdown, add lora button, lora weight
     slider"): the per-project record (lib/cnBasics); its LoRAs are the
     "cnet" temporary list (/api/temploras/cnet) */
  app.get("/api/controlnet/basic", (_req, res) => {
    const pdir = core.projDir(core.getProject());
    res.json({ settings: cnBasics.read(pdir), loras: tempLoras.read(pdir, "cnet"),
               types: cnTypes.catalogue() });
  });
  app.post("/api/controlnet/basic", (req, res) => {
    try {
      const pdir = core.projDir(core.getProject());
      const s = cnBasics.save(pdir, (req.body || {}).settings || req.body || {});
      res.json({ saved: true, settings: s });
    } catch (e) { res.status(400).json({ error: String(e.message || e) }); }
  });

  /* 2.322.0 (Tim: "is there any way to get the persons face to look 'not
     distorted'" -> "please add the 2 reccommendations"): Basic Settings ->
     Face fix, one record per project (lib/faceFix) */
  app.get("/api/facefix", (_req, res) => {
    res.json({ settings: faceFix.read(core.projDir(core.getProject())), default_detector: faceFix.DEFAULT_DETECTOR });
  });
  app.post("/api/facefix", (req, res) => {
    try {
      const s = faceFix.save(core.projDir(core.getProject()), (req.body || {}).settings || req.body || {});
      res.json({ saved: true, settings: s });
    } catch (e) { res.status(400).json({ error: String(e.message || e) }); }
  });

  /* ?kind=image|music narrows the list (2.90.0). Without it EVERY style comes
     back, which is what every caller before 2.90.0 expects; each entry now
     carries its `kind`, so a caller that wants both can still tell them apart. */
  app.get("/api/styles", (req, res) => {
    const kind = styles.KINDS.includes(String(req.query.kind || ""))
      ? String(req.query.kind) : undefined;
    const list = styles.read(core.STYLES_DIR, kind);
    res.json({
      styles: list,
      kind: kind || "all",
      // The UI greys out Generate Image for an incomplete style rather than
      // letting the user press a button that can only fail.
      incomplete: Object.fromEntries(
        list.map((s) => [s.id, styles.missingSlots(s)]).filter(([, m]) => m.length)),
      // reference-image slots per style, so the UI knows whether to send the
      // reference dock (an image-edit workflow needs one; a text-to-image
      // workflow refuses them)
      image_slots: Object.fromEntries(
        list.map((s) => [s.id, styles.imageSlots(s, core.BASE)])),
      // 2.340.0: styles whose reference pictures are optional (qwen2_1: no
      // picture = text-to-image)
      refs_optional: Object.fromEntries(list.filter((s) => s.refs_optional === true).map((s) => [s.id, true])),
      // 2.105.0: styles whose text-to-image workflow can be swapped for a
      // reference-conditioned sibling when the dock has pictures (Klein 9B)
      // 2.109.0: styles the image editor can infill with (their inpaint path resolves)
      inpaint_capable: Object.fromEntries(
        list.map((s) => [s.id, (() => { try { infill.resolve(s, core.BASE); return true; } catch { return false; } })()])),
      ref_capable: Object.fromEntries(
        list.map((s) => [s.id, styles.imageSlots(s, core.BASE) > 0
          || (imageRefs.isKlein9b(s) && imageRefs.resolve(s, 1, core.BASE).swapped)])),
      // Which ComfyUI model CATEGORY each style's workflow can accept. The
      // Model dropdown merges checkpoints/diffusers/diffusion_models, but the
      // patcher writes the chosen name into whichever loader key the graph HAS
      // — so an unnarrowed list lets a checkpoint name land in `unet_name` and
      // ComfyUI refuses it. See modelKinds() in lib/styles.js.
      model_kinds: Object.fromEntries(
        list.map((s) => [s.id, styles.modelKinds(s, core.BASE)])),
      // 2.328.0: the character-swap video styles (mmh3_chr_swap) - picking
      // one switches the prompt bar to Swap mode
      swap_styles: Object.fromEntries(
        list.filter((s) => swapLib.isSwapStyle(s, core.BASE)).map((s) => [s.id, true])),
    });
  });
  app.post("/api/styles", (req, res) => {
    try {
      const b = req.body || {};
      // ControlNet chain semantics (2.97.0): the stages must be EXISTING image
      // styles that are not themselves chains, and a model must be picked —
      // normalize only shape-checks, because only this route holds the folder
      if (b.chain) {
        const all = styles.read(core.STYLES_DIR, "image");
        const f = all.find((x) => x.id === String(b.chain.first_id || ""));
        const g = all.find((x) => x.id === String(b.chain.second_id || ""));
        if (!f || !g) return res.status(400).json({
          error: "both chain stages must be existing image styles" });
        if (f.chain || g.chain) return res.status(400).json({
          error: "a chain stage cannot itself be a chain style" });
        if (!String(b.chain.controlnet || "").trim()) return res.status(400).json({
          error: "pick a ControlNet model for the chain" });
        // 2.305.0: a type, when sent, must be one of the four
        if (String(b.chain.cn_type || "").trim() && !cnTypes.normType(b.chain.cn_type))
          return res.status(400).json({ error: "unknown ControlNet type \"" + String(b.chain.cn_type).slice(0, 40)
            + "\" - use " + cnTypes.IDS.join(", ") });
      }
      const style = styles.save(core.STYLES_DIR, req.body || {});
      res.json({ style, missing: styles.missingSlots(style), file: style._file,
                 styles: styles.read(core.STYLES_DIR) });
    } catch (e) {
      // A name clash is REFUSED, not resolved: styles are stored as
      // styles/<name>.json, so overwriting would be silent data loss and
      // uniquifying the file would leave two identical-looking entries in the
      // dropdown backed by different files. 409, so the UI can say which.
      res.status(e.code === "duplicate-name" ? 409 : 400)
         .json({ error: String(e.message || e), code: e.code || null });
    }
  });
  app.delete("/api/styles/:id", (req, res) => {
    const left = styles.remove(core.STYLES_DIR, String(req.params.id));
    if (left === null) return res.status(404).json({ error: "no such style" });
    res.json({ deleted: req.params.id, styles: left });
  });

  // Queue an image render. Separate from /api/generate on purpose: that route
  // is about frame grids, chunk planning and reference uploads, none of which
  // exist here, and mode=image is run by image_worker.py rather than worker.py
  // (lib/core.js WORKER_FOR).
  /* INFILL (2.108.0): the image editor's "✨ Infill selection". Multipart:
     crop (PNG of the selection + context), mask (PNG, transparent = fill),
     prompt, style_id, feather. Both pictures are saved into the project's
     Images assets (so the job can reference them by name like any other
     render) and ONE image job is queued at the crop's size with the inpaint
     graph lib/infill.js picks. The editor polls the job and composites. */
  app.post("/api/infill", upload.fields([{ name: "crop", maxCount: 1 }, { name: "mask", maxCount: 1 }, { name: "rgba", maxCount: 1 }]), (req, res) => {
    const b = req.body || {};
    const files = req.files || {};
    const crop = (files.crop || [])[0], mask = (files.mask || [])[0], rgba = (files.rgba || [])[0];
    if (!crop || !crop.buffer) return res.status(400).json({ error: "crop image missing" });
    if (!mask || !mask.buffer) return res.status(400).json({ error: "mask image missing" });
    const prompt = String(b.prompt || "").trim();
    if (!prompt) return res.status(400).json({ error: "write what should appear in the selection in the prompt box first" });
    const style = styles.byId(core.STYLES_DIR, String(b.style_id || ""));
    if (!style) return res.status(400).json({ error: "pick an image style first (Settings → Image)" });
    let wf;
    try { wf = infill.resolve(style, core.BASE); } catch (e) { return res.status(400).json({ error: e.message }); }
    const w = Math.max(64, parseInt(b.width, 10) || 0), h = Math.max(64, parseInt(b.height, 10) || 0);
    if (!w || !h) return res.status(400).json({ error: "width/height of the crop are required" });
    // a one-slot inpaint graph reads the hole from the picture's ALPHA: the
    // editor sends that RGBA as `rgba`; without it the mask is useless there
    if (wf.input === "rgba" && !(rgba && rgba.buffer))
      return res.status(400).json({ error: "this inpaint graph takes ONE picture whose alpha is the hole — the editor must send `rgba` (update the page)" });
    const stamp = Date.now().toString(36);
    const cropName = `infill-${stamp}-crop.png`, maskName = `infill-${stamp}-mask.png`, rgbaName = `infill-${stamp}-hole.png`;
    fs.writeFileSync(path.join(core.pDir("images"), cropName), crop.buffer);
    fs.writeFileSync(path.join(core.pDir("images"), maskName), mask.buffer);
    if (rgba && rgba.buffer) fs.writeFileSync(path.join(core.pDir("images"), rgbaName), rgba.buffer);
    // a self-contained inpaint export carries its own inpaint UNet, refiner,
    // steps and cfg: the style's overrides would break it, so only prompt,
    // negative, seed and the picture are written (2.108.1)
    let styled = styles.applyLoraWeights(style, null);
    if (wf.selfContained) styled = Object.assign({}, styled, { model: "", vae: "", te: "", loras: [], steps: null, cfg: null, width: null, height: null });
    const imgs = wf.input === "rgba" ? [rgbaName]
               : wf.input === "crop+mask" ? [cropName, maskName] : [cropName];
    if (wf.graph) { const gp = path.join(core.tempDir(), `infill-${stamp}-fill.json`); fs.writeFileSync(gp, JSON.stringify(wf.graph, null, 1)); wf.workflow = gp; }   // 2.550.0: the seamless fill's graph (lib/inpaintLatent.js)
    const p = { mode: "image", prompt, style: styled, style_id: style.id, style_name: style.name,
                width: w, height: h, batch: 1,
                workflow: wf.workflow, workflow_note: wf.note, infill: true, infill_input: wf.input,
                images: imgs.map((n) => path.join(core.pDir("images"), n)) };
    if (b.negative) p.negative = String(b.negative).slice(0, 2000);
    const rolled = imageSeed.forRequest(styles.numOrNull(b.seed));
    p.seed = rolled.seed; p.seed_random = rolled.random;
    const job = core.makeJob(p);
    job.chunk = { i: 0, n: 1 };
    res.json(Object.assign(core.jobDict(job), { crop: cropName, mask: maskName, workflow: wf.workflow, takes_mask: wf.takesMask, input: wf.input }));
  });
  app.post("/api/genimage", (req, res) => {
    const b = req.body || {};
    const prompt = String(b.prompt || "").trim();
    if (!prompt) return res.status(400).json({ error: "prompt is required" });
    const style = styles.byId(core.STYLES_DIR, String(b.style_id || ""));
    if (!style) return res.status(400).json({
      error: "pick an image style first (Settings → Image)" });
    // A ControlNet CHAIN style saves and selects today; GENERATING one lands
    // in the next build — stage 2 needs the verified ControlNet workflow
    // exported from ComfyUI (HANDOVER: "CONTROLNET CHAIN"). Refusing in words
    // beats silently running stage 1 alone and calling it the chain.
    if (style.chain) return res.status(400).json({
      error: "\"" + style.name + "\" is a ControlNet chain style. Saving and selecting"
        + " work today; the three-stage run (style 1 → temp, ControlNet → temp,"
        + " style 2 → images) lands in the next build, once the ControlNet workflow"
        + " you export from ComfyUI is in comfy_workflows/." });
    // One folder holds both kinds (lib/styles.js read); a song style cannot
    // render a still, and the image worker would only find out at ComfyUI.
    if (style.kind === "music") return res.status(400).json({
      error: `"${style.name}" is a music style, not an image one — pick one from Settings → Image` });
    const missing = styles.missingSlots(style);
    if (missing.length) return res.status(400).json({
      error: `style "${style.name}" is missing: ${missing.join(", ")}` });

    // Overrides are OPTIONAL: anything absent must fall through to the style,
    // and then to the architecture default, inside scripts/image_gen.py. Only
    // send a key when the request actually carried one — passing null here
    // would look "present" to the worker and beat the style's own value.
    // Per-render LoRA weights from the Basic-Settings sliders (2.93.0): the
    // patcher reads style.loras, so the override IS a modified style copy —
    // one contract, no second lora path through the worker.
    let styled = styles.applyLoraWeights(style, b.lora_weights);
    // 2.115.0: a checkpoint picked in Basic Settings replaces the style's for this render
    // 2.540.3: ...only when the model FITS the style's workflow (lib/modelFit.js) - an SDXL / Anima checkpoint in a
    // FLUX 3 Klein or Qwen edit workflow can only fail; it is left out for this render and the log says why
    let overrideNote = "";
    if (b.model && typeof b.model === "string" && b.model.trim() && !b.model.includes("..")) {
      const mf = modelFit.fit(styled, b.model.trim());
      if (mf.ok) styled = Object.assign({}, styled, { model: b.model.trim().slice(0, 300), model_override: true });
      else overrideNote = modelFit.note(styled, mf, b.model.trim());
    }
    // 2.111.0: temporary LoRAs from Basic Settings ride along, after the style's own
    const extra = tempLoras.normalize(b.extra_loras);
    if (extra.length) styled = Object.assign({}, styled, { loras: tempLoras.merge(styled.loras, extra) });
    if (b.mm_override === true) styled = Object.assign({}, styled, { mm_override: true });   // 2.518.0: the 🧩 Model manager's selection
    const p = { mode: "image", prompt, style: styled,
                style_id: style.id, style_name: style.name };
    if (overrideNote) p.workflow_note = overrideNote;                                  // 2.540.3: shown in the worker log
    /* 2.316.0 (Tim: "show the first image generated, the controlnet
       preprocessor gen and the final generation in the gallery"): Basic
       Settings -> ControlNet ticked = first image -> control map -> final
       (image_worker.run_controlnet, scripts/cn_stage.py). Only the prompt's
       Generate Image asks for it (b.controlnet) - the character creator and
       the other image callers never pick it up by accident */
    if (b.controlnet === true || (b.controlnet && typeof b.controlnet === "object")) {
      const pdir = core.projDir(core.getProject());
      // 2.318.0: the panel's settings as sent (always "on" - the client only
      // sends them while Use ControlNet is ticked); `true` = the saved record
      const rec = typeof b.controlnet === "object"
        ? cnBasics.normalize({ ...b.controlnet, v: 2, enabled: true }) : cnBasics.read(pdir);
      if (!rec.enabled) return res.status(400).json({ error: "Use ControlNet is ticked but the saved "
        + "ControlNet settings are off - tick it again in Basic Settings -> ControlNet" });
      // 2.317.0: the second model's style (an image style that renders it,
      // else a shipped template by family) - lib/cnBasics.secondStyle
      const cn = cnBasics.jobSpec(rec, tempLoras.read(pdir, "cnet"),
                                  styles.read(core.STYLES_DIR, "image"), core.BASE);
      if (cn && cn.error) return res.status(400).json({ error: cn.error });
      // 2.320.0: "final image only" - the first image and the control image
      // live in projects/<p>/temp/controlnet as gen_<name> / ctn_<name>
      if (cn && cn.final_only) cn.temp_dir = path.join(pdir, "temp", "controlnet");
      if (cn) p.controlnet = cn; }
    /* 2.322.0: Face fix - the panel's settings ride inline (only the prompt's
       Generate Image sends them); FaceDetailer on the FINAL image */
    if (b.face_fix && typeof b.face_fix === "object") {
      const ff = faceFix.jobSpec({ ...b.face_fix, enabled: true });
      if (ff) p.face_fix = ff;
    }
    for (const k of ["width", "height", "steps", "cfg", "clip_skip", "seed"]) {
      const n = styles.numOrNull(b[k]);
      if (n !== null) p[k] = n;
    }
    if (b.negative !== undefined) p.negative = String(b.negative).slice(0, 2000);
    if (b.extra_args !== undefined) p.extra_args = String(b.extra_args).slice(0, 500);
    // 2.223.7: the character creator's scheduler dropdown — image_gen.py has
    // always read params.sampler; the route just never passed it through
    if (b.sampler && typeof b.sampler === "string" && b.sampler.trim())
      p.sampler = b.sampler.trim().slice(0, 60);
    p.batch = Math.max(1, Math.min(8, styles.numOr(b.batch, 1)));
    // Reference images for an image-EDIT workflow, named from the project's
    // Images assets (the reference dock). Resolved to real paths here so the
    // worker only ever handles files it can open; the worker uploads them to
    // ComfyUI, which cannot see this machine's disk.
    if (Array.isArray(b.images) && b.images.length) {
      // 2.340.0: as many as the style's workflow has slots (Qwen Image 2.1:
      // 8, qwen2_1: 10) - it was a flat 3
      p.images = b.images.slice(0, Math.max(3, Math.min(qwenRefs.MAX_IMAGES, styles.imageSlots(styled, core.BASE))))
        .map((n) => path.join(core.pDir("images"), path.basename(String(n))))
        .filter((f) => fs.existsSync(f));
      if (!p.images.length) return res.status(400).json({
        error: "none of those reference images are in this project's Images assets" });
      // 2.105.0: a FLUX.2 Klein 9B text-to-image style renders WITH the dock
      // by running its sibling edit (reference-latent) workflow. The swap is
      // decided here, recorded on the job, and honoured by image_worker.py.
      const rw = imageRefs.resolve(styled, p.images.length, core.BASE);
      if (rw.swapped) {
        p.workflow = rw.workflow;
        p.workflow_note = [p.workflow_note, rw.note].filter(Boolean).join(" · ");
        if (p.images.length > rw.slots) p.images = p.images.slice(0, rw.slots);
      } else if (rw.note) p.workflow_note = [p.workflow_note, rw.note].filter(Boolean).join(" · ");
    }
    // 2.340.0: Qwen Image 2.1 reads the dock's pictures as <image1..N>
    if (qwenRefs.isQwen21Style(styled, core.BASE)) {
      const q = qwenRefs.prompt(p.prompt, (p.images || []).length, Array.isArray(b.image_roles) ? b.image_roles.map(String) : []);
      p.prompt = q.prompt;
      if (q.note) p.workflow_note = [p.workflow_note, q.note].filter(Boolean).join(" · ");
    }
    // ONE PRESS = ONE FRESH SEED, decided HERE (2.83.0).
    // The worker can roll its own -1 and still does, but a number drawn down
    // there is invisible to this job record and to the filename, and on the
    // sd-cli path it defeated the batch walk entirely. Rolling at the request
    // makes the seed a fact the job carries: it goes into job.json, into the
    // worker log, and into the name of every file the render produces, so a
    // picture worth keeping can be made again by typing its own filename back
    // in. A seed the caller pinned is obeyed; see lib/imageSeed.js.
    const rolled = imageSeed.forRequest(p.seed);
    p.seed = rolled.seed;
    p.seed_random = rolled.random;

    const job = core.makeJob(p);
    job.chunk = { i: 0, n: p.batch };
    res.json(core.jobDict(job));
  });

  /* Queue a SONG (2.90.0). Separate from /api/genimage for the same reason
     that is separate from /api/generate: the request shape, the worker
     (music_worker.py via WORKER_FOR) and the output folder (sound/) all differ,
     and one route with three `if`s is how a mode ends up silently handed the
     wrong worker. THE LYRICS ARE THE PROMPT: `prompt` is the words of the song;
     the caption (genre, BPM, key, mood, vocal, arrangement) lives in the STYLE.
     A caption sent with the request overrides the style's for this one song. */
  app.post("/api/genmusic", upload.single("ref"), (req, res) => {
    const b = req.body || {};
    // 2.236.0 (Tim: "add a tab to our music docker for sheet music and tabs
    // for each of yue2's capabilities"): the ONE song route grows variants —
    // "generate" (unchanged), "cover" (a reference track is transcribed to
    // ABC and sung in your style/lyrics), "abc" (SHEET MUSIC only: the score
    // from lyrics, or a transcription of a reference track — want:"abc"
    // makes the worker collect the PreviewAny text instead of audio). The
    // variant workflows are the arch's own hints; a JSON body still works —
    // multer only touches multipart.
    const variant = String(b.variant || "generate");
    const prompt = String(b.prompt || "").trim();
    const needsLyrics = variant !== "cover" && !(variant === "abc" && req.file);
    if (!prompt && needsLyrics) return res.status(400).json({ error: "lyrics are required — the prompt box is the lyrics" });
    const style = styles.byId(core.STYLES_DIR, String(b.style_id || ""));
    if (!style) return res.status(400).json({
      error: "pick a music style first (Settings → Music)" });
    if (style.kind !== "music") return res.status(400).json({
      error: `"${style.name}" is an image style, not a music one — pick one from Settings → Music` });
    const missing = styles.missingSlots(style);
    if (missing.length) return res.status(400).json({
      error: `style "${style.name}" is missing: ${missing.join(", ")}` });

    // The style is COPIED into the job with any per-request override applied,
    // so the worker (and job.json, which is what gets read back when a song is
    // worth reproducing) records exactly what was rendered.
    const st = { ...style };
    if (b.caption !== undefined) st.caption = String(b.caption).slice(0, 6000);
    const p = { mode: "music", prompt, style: st,
                style_id: style.id, style_name: style.name };

    // ---- 2.236.0: the variant picks the workflow and the extras ----------
    const arch = styles.musicArchById(style.arch) || {};
    if (variant === "cover" || variant === "abc") {
      const wf = variant === "cover" ? arch.workflow_cover_hint
        : (req.file ? arch.workflow_transcribe_hint : arch.workflow_abc_hint);
      if (!wf) return res.status(400).json({
        error: `"${style.name}" (${style.arch}) has no ${variant === "cover" ? "cover" : "sheet-music"} `
          + "workflow — pick a YuE2 (ComfyUI) style for this tab" });
      st.workflow = wf;
      if (variant === "abc") p.want = "abc";
    }
    if (variant === "cover" && !req.file) return res.status(400).json({
      error: "a cover needs a reference track — pick an audio file" });
    if (req.file) {
      // the reference rides the JOB's own folder (the /api/generate pattern:
      // pre-made dir, files first, makeJob after) and the worker uploads it
      // to ComfyUI's input folder before queueing.
      const id = require("crypto").randomBytes(6).toString("hex");
      const dir = path.join(core.JOBS_DIR, id);
      fs.mkdirSync(dir, { recursive: true });
      let ext = path.extname(req.file.originalname || "ref.wav").toLowerCase();
      if (![".wav", ".mp3", ".flac", ".ogg", ".m4a", ".opus"].includes(ext)) ext = ".wav";
      const rp = path.join(dir, "ref" + ext);
      fs.writeFileSync(rp, req.file.buffer);
      p.ref_path = rp;
      p._pre = { id, dir };
    }
    for (const k of ["steps", "cfg", "max_duration", "seed"]) {
      const n = styles.numOrNull(b[k]);
      if (n !== null) p[k] = n;
    }
    if (p.max_duration !== undefined) {
      const a = styles.musicArchById(style.arch) || {};
      const cap = styles.numOr((a.limits || {}).max_duration, 600);
      p.max_duration = Math.max(1, Math.min(cap, p.max_duration));
      st.max_duration = p.max_duration;
    }
    // 2.238.0 (Tim: "add a filetype to save the song to ... flac, mp3,
    // wav"): the graphs save lossless flac; the worker converts to the
    // picked container afterwards (one path for every engine). Whitelisted;
    // anything else keeps flac.
    const fmt = String(b.format || "").toLowerCase();
    if (["flac", "mp3", "wav"].includes(fmt)) p.audio_format = fmt;
    // 2.243.0: the song's title — filename lead (worker) + saved-song field
    const title = String(b.title || "").trim().slice(0, 120);
    if (title) p.title = title;
    // A batch is capped lower than images: a song is minutes of GPU, not seconds.
    p.batch = p.want === "abc" ? 1 : Math.max(1, Math.min(4, styles.numOr(b.batch, 1)));
    // ONE PRESS = ONE FRESH SEED, the same rule as images (lib/imageSeed.js):
    // the number goes into job.json, the log and the filename.
    const rolled = imageSeed.forRequest(p.seed);
    p.seed = rolled.seed;
    p.seed_random = rolled.random;

    const pre = p._pre; delete p._pre;
    const job = pre ? core.makeJob(p, pre.id, pre.dir) : core.makeJob(p);
    job.chunk = { i: 0, n: 1 };
    res.json(core.jobDict(job));
  });

  app.get("/api/projects", (_req, res) => {
    fs.mkdirSync(core.PROJECTS_DIR, { recursive: true });
    const names = fs.readdirSync(core.PROJECTS_DIR).filter((d) =>
      fs.statSync(path.join(core.PROJECTS_DIR, d)).isDirectory());
    res.json({ current: core.getProject(), projects: names });
  });
  app.get("/api/outputs/where", (_req, res) => {
    const dirs = OUT_DIRS.map((where) => {
      const dir = outDir(where);
      let files = 0, exists = fs.existsSync(dir);
      try { files = fs.readdirSync(dir).filter((f) => /\.(webm|avi|webp|mp4|mkv|mov)$/i.test(f)).length; } catch {}
      return { where, dir, exists, files };
    });
    // `dir` is where GENERATIONS land, and callers rely on that — it is not
    // simply "the first of OUT_DIRS". Resolve it explicitly, or adding a new
    // search location silently repoints every consumer of this endpoint.
    res.json({ project: core.getProject(), dir: outDir("output"),
               files: dirs.reduce((a, d) => a + d.files, 0), dirs });
  });

  /* 2.101.0: reading a project VERIFIES its reference manifest against
     reference/<kind>/ — an entry whose file has gone is dropped and named in
     `missing_references`, never served as a broken tray slot. */
  const readProject = () => {
    let data = null;
    try { data = JSON.parse(fs.readFileSync(core.prjPath(core.getProject()), "utf8")); } catch {}
    let missing = [];
    if (data && data.references) {
      const v = projectRefs.verify(core.projDir(core.getProject()), data.references);
      data.references = v.manifest; missing = v.missing;
    }
    // 2.107.0: the ACTIVE timeline comes from projects/<p>/timelines/<name>.json
    if (data) data = timelines.attach(core.projDir(core.getProject()), data);
    const pdir = core.projDir(core.getProject());
    const temp_loras = { image: tempLoras.read(pdir, "image"), video: tempLoras.read(pdir, "video"),
                         cnet: tempLoras.read(pdir, "cnet") };   // 2.111.0 (+ 2.316.0 ControlNet)
    return { name: core.getProject(), data, missing_references: missing, temp_loras };
  };
  /* NAMED TIMELINES (2.107.0): files under projects/<p>/timelines/. The
     toolbar's dropdown lists them, Save writes the active one, Save as… copies
     to a new name and makes it active. */
  /* TEMPORARY LoRAs (2.111.0): projects/<p>/<kind>-loras-temp.json */
  app.get("/api/temploras", (_req, res) => {
    const pdir = core.projDir(core.getProject());
    res.json({ image: tempLoras.read(pdir, "image"), video: tempLoras.read(pdir, "video"),
               cnet: tempLoras.read(pdir, "cnet") });          // 2.316.0
  });
  app.post("/api/temploras/:kind", (req, res) => {
    try {
      const pdir = core.projDir(core.getProject());
      const list = tempLoras.write(pdir, req.params.kind, (req.body || {}).loras || req.body);
      res.json({ saved: true, kind: req.params.kind, loras: list, file: path.basename(tempLoras.file(pdir, req.params.kind)) });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  /* SAVED SONGS (2.241.0, Tim: "save the song, including lyrics and
     details ... load a song ... new song"): projects/<p>/songs/<name>.json,
     the temploras pattern — the server knows the project. */
  /* ------------------------------------------- training DATASETS (2.265.0)
     The character-sheet creator's Dataset tab. lib/datasets.js owns the
     store (app-root datasets/<name>, image + <stem>.txt caption pairs);
     these routes are thin. Auto Caption runs the SAME vision model the
     prompt docker's dropdown selected (captioner config) — one model,
     one description style, everywhere. */
  const datasets = require("../lib/datasets");
  const dsUpload = multer({ storage: multer.memoryStorage(),
                            limits: { fileSize: 64 * 1024 * 1024, files: 100 } });
  app.get("/api/datasets/:name", (req, res) => {
    try { res.json({ name: datasets.safeName(req.params.name), images: datasets.list(req.params.name) }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.post("/api/datasets/:name/images", dsUpload.array("images", 100), (req, res) => {
    try {
      const stored = (req.files || []).map((f) => datasets.addImage(req.params.name, f.originalname, f.buffer));
      res.json({ stored, images: datasets.list(req.params.name) });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.get("/api/datasets/:name/file/:file", (req, res) => {
    try {
      const p = datasets.filePath(req.params.name, req.params.file);
      if (!p) return res.status(404).json({ error: "no such image" });
      res.sendFile(p);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.put("/api/datasets/:name/caption", (req, res) => {
    try { res.json(datasets.setCaption(req.params.name, String((req.body || {}).file || ""), (req.body || {}).caption)); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.delete("/api/datasets/:name/images/:file", (req, res) => {
    try { res.json({ removed: datasets.remove(req.params.name, req.params.file) }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.delete("/api/datasets/:name/images", (req, res) => {
    try { res.json({ removed: datasets.removeAll(req.params.name) }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  // Auto Caption: the SELECTED images only ("Auto Caption will only auto
  // caption selected pictures") — the client sends the checked file names;
  // each description is written straight into the sidecar.
  app.post("/api/datasets/:name/autocaption", async (req, res) => {
    try {
      const want = Array.isArray((req.body || {}).files) ? req.body.files : [];
      if (!want.length) return res.status(400).json({ error: "no images selected" });
      const out = [];
      for (const f of want) {
        const p = datasets.filePath(req.params.name, String(f));
        if (!p) { out.push({ file: f, error: "no such image" }); continue; }
        const mt = /\.png$/i.test(p) ? "image/png" : /\.webp$/i.test(p) ? "image/webp" : "image/jpeg";
        const d = await captioner.describe(core, [{ path: p, mimetype: mt }]);
        const caption = String((d && d[0]) || "").trim();   // describe returns strings
        datasets.setCaption(req.params.name, String(f), caption);
        out.push({ file: f, caption });
      }
      res.json({ captions: out });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  /* ---------------------------------------- STEM SEPARATION (2.269.0)
     The Stems dock: demucs in venvs/demucs splits a song into vocals
     (the lyrics) and instrumental. lib/stems.js owns it. */
  const stems = require("../lib/stems");
const trap = require("../lib/trap");
  app.get("/api/stems", (_req, res) => {
    const rt = stems.runtime();
    res.json({ installed: rt.installed, venv: rt.dir, model: rt.model,
               device: rt.device });
  });
  app.post("/api/stems/separate", async (req, res) => {
    const name = String((req.body || {}).file || "").trim();
    if (!name) return res.status(400).json({ error: "file names the song asset to separate" });
    try {
      const r = await stems.separate(name, {
        onLog: (s) => core.jobsSay && core.jobsSay(s) });
      res.json({ ok: true, ...r });
    } catch (e) {
      res.status(e.status || 500).json({ error: String(e.message || e) });
    }
  });

  /* 2.270.0 (Tim: "user will be able to add the vocal stem to the prompt
     docker using the + button. automatically split the track into 15
     second files, and add them to each scene as audio reference. teach the
     llm the names of the files. save segments in music\temp\songname_<n>.
     <ext> if song name or title doesn't exist call it tmp_stem_<n>.<ext>"):
     the promptdock's ＋ posts the audio here. The track splits into 15s
     files at <app>/music/temp/<base>_<n>.<ext> (lib/stems.split), segment n
     is registered on board scene n as a scene-bound chapter SOUND reference
     (chapterRefs.addExternal — forChain sends it only to that scene's
     queue), and the writer learns the names through refsBrief's grouped
     segment line on every screenplay call. A new split replaces the old
     assignment wholesale. Songs are big — this multer takes one file to
     512 MB and stages the buffer to a temp file for ffmpeg. */
  const stemUpload = multer({ storage: multer.memoryStorage(),
    limits: { fileSize: 512 * 1024 * 1024, files: 1 } });
  app.post("/api/stems/split", stemUpload.single("file"), async (req, res) => {
    if (!req.file || !req.file.buffer)
      return res.status(400).json({ error: "attach the track as multipart field \"file\"" });
    const orig = req.file.originalname || "track.wav";
    const name = String((req.body || {}).name || "").trim() || orig;
    const tmp = path.join(os.tmpdir(),
      `bitgen-split-${Date.now()}${path.extname(orig).toLowerCase() || ".wav"}`);
    try {
      fs.writeFileSync(tmp, req.file.buffer);
      const r = await stems.split(tmp, name);
      // 2.275.0: assignment extracted into stems.assignSegments — the split
      // route and POST /api/stems/reassign share the ONE binder. No tmp
      // rebuild here: every scene QUEUE rebuilds its tmp with its own
      // chapter + scene (the 2.180/2.224 per-queue scoping).
      const a = stems.assignSegments(core.getProject(), r);
      res.json({ ok: true, base: r.base, ext: r.ext, seconds: r.seconds,
                 dir: r.dir, files: r.files, ...a });
    } catch (e) {
      res.status(e.status || 500).json({ error: String(e.message || e) });
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* already gone */ }
    }
  });

  /* 2.272.0 (Tim: "add a folder select button after the song dropdown in
     stems, allow user to upload songs from anywhere"): the Stems dock's 📂
     posts each picked file here. Same save path as /api/passets
     (saveAssetFile — one uniquify rule in the app), but on the 512MB
     multer, because a song outgrows the general 64MB asset limit; sounds
     only — anything else is refused in words. */
  app.post("/api/stems/upload", stemUpload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error:
      "attach the song as multipart field \"file\"" });
    try {
      /* 2.299.0 (Tim: "song can be loaded from anywhere but is copied to
         the active project"): the song is COPIED into the active project's
         sound assets - loading the SAME song again reuses that copy
         instead of piling up "song (2).mp3" duplicates */
      const safe0 = path.basename(req.file.originalname || "").replace(/[^A-Za-z0-9._ -]+/g, "_");
      const have = safe0 && core.kindOf(path.extname(safe0).toLowerCase()) === "sound"
        ? path.join(core.pDir("sound"), safe0) : "";
      if (have && fs.existsSync(have) && fs.statSync(have).size === req.file.buffer.length
          && fs.readFileSync(have).equals(req.file.buffer))
        return res.json({ ok: true, name: safe0, kind: "sound",
                          duration: core.probeDuration(have), existed: true });
      const r = saveAssetFile(req.file);
      if (r.kind !== "sound") {
        try { fs.unlinkSync(path.join(core.pDir(r.kind), r.name)); } catch {}
        return res.status(400).json({ error:
          `${req.file.originalname}: not an audio file — the Stems dock `
          + "takes songs (wav, mp3, flac, ogg, m4a)" });
      }
      res.json({ ok: true, ...r });
    } catch (e) {
      res.status(e.status || 500).json({ error: String(e.message || e) });
    }
  });

  /* 2.275.0 (Tim: "break the song loaded into the prompt into segments of
     15 seconds each and add it to each scene as the audio reference for
     lipsync"): re-bind the LAST split's segments to the board as it stands
     NOW. The music-video ask calls this after the writer put fresh scenes
     on the board — segment n rides scene n again. No split yet → said in
     words, never an invented one. */
  /* 2.285.0: the SEGMENT MAP api - the dock's red lines and the
     iterative writer both speak to <base>.seg through these. */
  app.get("/api/stems/segments", trap.guard((req, res) => {
    const song = String(req.query.song || "");
    if (!song) return res.status(400).json({ error: "song required" });
    res.json({ ok: true, ...stems.segments(song) });
  }));
  app.post("/api/stems/segments", trap.guard((req, res) => {
    const b = req.body || {};
    if (!b.song) return res.status(400).json({ error: "song required" });
    res.json({ ok: true, ...stems.saveSegments(b.song, b.durations, b.manual) });
  }));
  /* 2.287.0: SEGMENT EXPORT + SEND-TO-VIDEO. Export cuts real files at
     the .seg map (mp3|wav) under projects/<p>/songs/<base>/segments/.
     Send-to-video exports if needed, then stages the BOARD: one blank
     scene per segment (its length pinned to its segment, its prompt a
     placeholder the writer will replace on "create the music video"),
     and binds segment n as scene n's soundtrack reference. */
  app.post("/api/stems/export", trap.guard(async (req, res) => {
    const b = req.body || {};
    if (!b.song) return res.status(400).json({ error: "song required" });
    const r = await stems.exportSegments(b.song, b.format);
    res.json({ ok: true, ...r });
  }));
  app.post("/api/stems/send-to-video", trap.guard(async (req, res) => {
    const b = req.body || {};
    if (!b.song) return res.status(400).json({ error: "song required" });
    /* 2.288.0 (the trim pivot): NO segment files, NO bindings - the song
       itself becomes the board's audio and each blank scene carries its
       start/duration window (from the .seg map) for the graph's
       TrimAudioDuration to cut worker-side.
       2.289.0: the staging lives in lib/segBoard.stage - ONE path shared
       with the video docker's Load-audio 💾 (POST
       /api/scenes/from-segments); a re-send of the same song keeps the
       written scenes and rewrites only their windows. */
    const r = require("../lib/segBoard").stage(b.song, b.project);
    res.json({ ok: true, ...r });
  }));
  app.post("/api/stems/reassign", trap.guard((_req, res) => {
    const last = stems.lastSplit();
    if (!last) return res.status(404).json({ error:
      "no split segments yet — attach the song (or its vocal stem) with ＋ "
      + "in the prompt docker first and it splits into 15s segments" });
    const a = stems.assignSegments(core.getProject(), last);
    res.json({ ok: true, base: last.base, files: last.files, ...a });
  }));

  /* 2.276.0 (Tim: "the vocal separation still has some instrumental
     artifacts ... set the volume for the selected part (flatten the
     wave)"): apply a gain to ONE region of a sound asset and save in
     place. The stems dock's waveform selection posts fractions; gain 0
     flattens the region. */
  app.post("/api/stems/volume", async (req, res) => {
    const b = req.body || {};
    const name = String(b.file || "").trim();
    if (!name) return res.status(400).json({ error: "file names the sound asset to edit" });
    try {
      const r = await stems.volumeEdit(name, b.from, b.to, b.gain,
        { rebase: b.rebase });
      res.json({ ok: true, ...r });
    } catch (e) {
      res.status(e.status || 500).json({ error: String(e.message || e) });
    }
  });

  // 2.256.0: the ldock "Tokens consumed" label polls this — llmChat's own
  // session counter, covering every LLM call (chat, Enhance, screenplay)
  app.get("/api/llm/usage", (_req, res) => res.json(llmChat.usage()));

  app.get("/api/songs", (_req, res) => {
    // 2.250.0: the ▶ button plays a RECORDED filename. Each saved song is
    // joined with its <name>.music render record (written by core the
    // moment the job finished): audio = the record's filename when that
    // file still exists in the output folders, else the 2.248 title scan
    // (renders from before the record era), else "". Records with no
    // matching saved .json list too — a rendered song loads from its
    // record (title + lyrics live in it). Details ride each row for the
    // ⓘ hover card.
    const pdir = core.projDir(core.getProject());
    const dirs = core.outputDirs();
    const onDisk = (f) => !!f && dirs.some((d) => {
      try { return require("fs").existsSync(path.join(d, f)); } catch { return false; }
    });
    const recs = songs.listRecords(pdir);
    const recBy = {};
    for (const r of recs) recBy[r.name.toLowerCase()] = r;
    const seen = new Set();
    const out = songs.list(pdir).map((s) => {
      const r = recBy[s.name.toLowerCase()]
        || recBy[songs.safeName(s.title || s.name).toLowerCase()];
      if (r) seen.add(r.name.toLowerCase());
      const audio = r && onDisk(r.filename) ? r.filename
        : songs.audioFor(dirs, s.name, s.title);
      return { ...s, audio, record: r || null };
    });
    for (const r of recs) {
      if (seen.has(r.name.toLowerCase())) continue;
      out.push({ name: r.name, saved_at: r.created_at, title: r.title,
                 style_name: r.created_by, lyrics_chars: r.lyrics.length,
                 audio: onDisk(r.filename) ? r.filename : "",
                 record: r, record_only: true });
    }
    res.json({ songs: out });
  });
  app.get("/api/songs/:name", (req, res) => {
    const pdir = core.projDir(core.getProject());
    try { return res.json(songs.read(pdir, req.params.name)); }
    catch (e) {
      // 2.250.0: no saved .json — a render RECORD still loads as a song
      const r = songs.readRecord(pdir, req.params.name);
      if (r) return res.json({ name: songs.safeName(req.params.name),
                               title: r.title, lyrics: r.lyrics });
      return res.status(404).json({ error: e.message });
    }
  });
  app.post("/api/songs/:name", (req, res) => {
    try {
      const r = songs.write(core.projDir(core.getProject()), req.params.name, req.body || {});
      res.json({ saved: true, name: r.name, file: r.file });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/timelines", (_req, res) => {
    let active = timelines.DEFAULT;
    try { active = timelines.safe(JSON.parse(fs.readFileSync(core.prjPath(core.getProject()), "utf8")).timeline); } catch { /* default */ }
    res.json({ active, timelines: timelines.list(core.projDir(core.getProject())) });
  });
  app.get("/api/timelines/:name", (req, res) => {
    try {
      const t = timelines.read(core.projDir(core.getProject()), req.params.name);
      if (!t) return res.status(404).json({ error: `no timeline "${req.params.name}"` });
      res.json({ name: timelines.safe(req.params.name), tl: t });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.post("/api/timelines/:name", (req, res) => {
    try {
      const b = req.body || {};
      const pdir = core.projDir(core.getProject());
      const name = timelines.write(pdir, req.params.name, b.tl);
      if (b.activate !== false) {          // the saved one becomes the project's active timeline
        let d = {};
        try { d = JSON.parse(fs.readFileSync(core.prjPath(core.getProject()), "utf8")) || {}; } catch { /* new */ }
        d.timeline = name; delete d.tl;
        fs.writeFileSync(core.prjPath(core.getProject()), JSON.stringify(d, null, 2));
      }
      res.json({ saved: true, name, active: b.activate !== false ? name : undefined, timelines: timelines.list(pdir) });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.delete("/api/timelines/:name", (req, res) => {
    try {
      const pdir = core.projDir(core.getProject());
      if (!timelines.remove(pdir, req.params.name)) return res.status(404).json({ error: "no such timeline" });
      res.json({ deleted: true, timelines: timelines.list(pdir) });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  /* DOCK LAYOUT (2.103.0): size + open/closed/max per dock, in the settings
     file. GET gives the normalized record; POST merges a partial update (the
     client sends just the dock that changed) and persists the diff. */
  // 2.104.0: what the LLM is taught for a given selection (and the full list)
  app.get("/api/prompt-guides", (req, res) => {
    const all = promptGuides.load(core.STYLES_DIR);
    const q = req.query || {};
    const g = (q.kind || q.arch || q.model) ? promptGuides.pick(all, { kind: q.kind, arch: q.arch, model: q.model }) : null;
    // 2.118.0: ?text=<the user's words> reports which addenda would fire
    const ax = q.text ? promptGuides.matchAddenda(promptGuides.loadAddenda(core.STYLES_DIR), q.kind, q.text) : [];
    res.json({ guides: all.map((x) => ({ id: x.id, kind: x.kind, label: x.label })),
               picked: g ? g.id : null, text: g ? promptGuides.render(g) : "",
               addenda: ax.map((a) => a.id),
               addenda_text: ax.map(promptGuides.render).join("\n\n") });
  });
  app.get("/api/ui/layout", (_req, res) =>
    res.json({ docks: uiLayout.normalize(((core.getConfig().ui || {}).docks)) }));
  app.post("/api/ui/layout", (req, res) => {
    const c = core.getConfig();
    c.ui = c.ui || {};
    c.ui.docks = uiLayout.merge(c.ui.docks, (req.body || {}).docks || req.body);
    core.setConfig(c);
    res.json({ saved: true, docks: c.ui.docks });
  });

  /* ================= COMFYUI GRAPHS (2.120.0, by instruction) =============
     Settings -> ComfyUI -> Graphs: load a workflow, convert it to an API
     prompt if it is a UI export, list the inputs that can be changed, and wire
     each one to a control (toggle / dropdown / text / slider / spinner) that
     then appears in Basic Settings. The MODEL is lib/comfyGraphs.js; the
     UI-export conversion is lib/graphToApi.js. Nothing below re-implements
     either — these routes are the folder, the HTTP shape and ComfyUI's
     /object_info, and that is all. */
  const WF_DIR = path.join(core.BASE, "comfy_workflows");
  /** A workflow path the caller named, forced back inside comfy_workflows/. */
  function wfPath(rel) {
    const clean = String(rel || "").trim().replace(/\\/g, "/").replace(/^\/+/, "")
      .replace(/^comfy_workflows\//i, "");
    if (!clean || clean.includes("..")) return null;
    const p = path.resolve(WF_DIR, clean);
    // resolve() is what makes this a check and not a hope: a name that walks
    // out of the folder by any spelling lands outside WF_DIR and is refused.
    return p.startsWith(path.resolve(WF_DIR) + path.sep) || p === path.resolve(WF_DIR)
      ? p : null;
  }
  function wfList() {
    try {
      return fs.readdirSync(WF_DIR).filter((f) => f.toLowerCase().endsWith(".json"))
        .sort().map((f) => {
          let fmt = "unknown"; let nodes = 0;
          try {
            const g = JSON.parse(fs.readFileSync(path.join(WF_DIR, f), "utf8"));
            fmt = comfyGraphs.format(g);
            nodes = fmt === "api" ? Object.keys(g).length
              : fmt === "ui" ? (g.nodes || []).length : 0;
          } catch { /* one unreadable file costs one row */ }
          return { file: "comfy_workflows/" + f, name: f, format: fmt, nodes };
        });
    } catch { return []; }
  }
  /** The graph a request means: an inline one, or a file under comfy_workflows/. */
  function graphFrom(body) {
    const b = body || {};
    if (b.graph && typeof b.graph === "object") return { graph: b.graph, file: b.file || "" };
    const p = wfPath(b.file);
    if (!p) { const e = new Error("no workflow given (send `graph`, or a `file` inside comfy_workflows/)"); e.status = 400; throw e; }
    if (!fs.existsSync(p)) { const e = new Error(`no such workflow: ${b.file}`); e.status = 404; throw e; }
    let g;
    try { g = JSON.parse(fs.readFileSync(p, "utf8")); }
    catch (err) { const e = new Error(`that file is not valid JSON: ${err.message}`); e.status = 400; throw e; }
    return { graph: g, file: "comfy_workflows/" + path.basename(p) };
  }

  app.get("/api/graphs", (req, res) => {
    const kind = comfyGraphs.KINDS.includes(String(req.query.kind || ""))
      ? String(req.query.kind) : undefined;
    const list = comfyGraphs.read(core.GRAPHS_DIR, kind);
    // Which bindings still resolve: a workflow re-exported with different node
    // ids is the normal way a wire goes stale, and the dropdown should say so
    // rather than let a render come back with the old value.
    const stale = {};
    for (const g of list) {
      if (!g.file) { stale[g.id] = ["no workflow file is set"]; continue; }
      try { stale[g.id] = comfyGraphs.validate(graphFrom({ file: g.file }).graph, g); }
      catch (e) { stale[g.id] = [String(e.message || e)]; }
    }
    res.json({ graphs: list, kind: kind || "all", stale,
               files: wfList(), types: comfyGraphs.TYPES, kinds: comfyGraphs.KINDS });
  });
  app.get("/api/graphs/:id", (req, res) => {
    const g = comfyGraphs.byId(core.GRAPHS_DIR, req.params.id);
    if (!g) return res.status(404).json({ error: "no such graph" });
    let analysis = null; let error = null;
    try { analysis = comfyGraphs.analyze(graphFrom({ file: g.file }).graph); }
    catch (e) { error = String(e.message || e); }
    res.json({ graph: g, analysis, error, warnings: analysis ? comfyGraphs.validate(analysis.api ? graphFrom({ file: g.file }).graph : {}, g) : [] });
  });
  app.post("/api/graphs", (req, res) => {
    try {
      const g = comfyGraphs.save(core.GRAPHS_DIR, req.body || {});
      res.json({ graph: g, file: g._file, graphs: comfyGraphs.read(core.GRAPHS_DIR) });
    } catch (e) {
      res.status(e.code === "duplicate-name" ? 409 : 400)
         .json({ error: String(e.message || e), code: e.code || null });
    }
  });
  app.delete("/api/graphs/:id", (req, res) => {
    const left = comfyGraphs.remove(core.GRAPHS_DIR, String(req.params.id));
    if (left === null) return res.status(404).json({ error: "no such graph" });
    res.json({ deleted: req.params.id, graphs: left });
  });

  /* Is this an API workflow, and what can be changed in it? */
  app.post("/api/graphs/analyze", (req, res) => {
    try {
      const { graph, file } = graphFrom(req.body);
      res.json({ file, ...comfyGraphs.analyze(graph) });
    } catch (e) { res.status(e.status || 400).json({ error: String(e.message || e) }); }
  });

  /* "Export as API": a UI export converted with COMFYUI'S OWN widget order
     (/object_info), so any installed node pack works without a table here to
     keep up to date. ComfyUI has to be running for that, and saying so is the
     whole error message — a guessed widget order is a workflow that renders
     the wrong thing with no error at all. */
  app.post("/api/graphs/toapi", async (req, res) => {
    let graph; let file;
    try { ({ graph, file } = graphFrom(req.body)); }
    catch (e) { return res.status(e.status || 400).json({ error: String(e.message || e) }); }
    if (comfyGraphs.isApi(graph)) {
      return res.json({ file, already_api: true, graph,
                        ...comfyGraphs.analyze(graph), warnings: [], dropped: [] });
    }
    let info;
    try { info = await comfy.objectInfo(); }
    catch (e) { return res.status(503).json({ error:
      "ComfyUI is not reachable, and its /object_info is where the widget names come from. "
      + "Start ComfyUI (Settings → ComfyUI → Start), then press this again. "
      + `(${String(e.message || e)})` }); }
    let out;
    try { out = graphToApi.convert(graph, info); }
    catch (e) { return res.status(400).json({ error: String(e.message || e) }); }
    if (!out.graph) return res.status(400).json({
      error: "ComfyUI does not know these node types, so their widget order cannot be read: "
        + out.unknown.join(", ") + ". Install the pack that provides them (Manager → Install "
        + "Missing Custom Nodes) and try again.", unknown: out.unknown });
    // Saving is optional: the tab converts to look, and saves when asked.
    let saved = null;
    const asName = String((req.body || {}).save_as || "").trim();
    if (asName) {
      const p = wfPath(asName.toLowerCase().endsWith(".json") ? asName : asName + ".json");
      if (!p) return res.status(400).json({ error: "that name is not a file inside comfy_workflows/" });
      fs.mkdirSync(WF_DIR, { recursive: true });
      fs.writeFileSync(p, JSON.stringify(out.graph, null, 2));
      saved = "comfy_workflows/" + path.basename(p);
    }
    res.json({ file, already_api: false, graph: out.graph, saved,
               warnings: out.warnings, dropped: out.dropped,
               ...comfyGraphs.analyze(out.graph) });
  });

  /* Save a workflow the user loaded from their disk into comfy_workflows/, so
     the binding can name a file rather than carry a copy of the graph. */
  app.post("/api/graphs/import", (req, res) => {
    const b = req.body || {};
    if (!b.graph || typeof b.graph !== "object") return res.status(400).json({ error: "no workflow in the request" });
    const name = String(b.name || "").trim() || "imported.json";
    const p = wfPath(name.toLowerCase().endsWith(".json") ? name : name + ".json");
    if (!p) return res.status(400).json({ error: "that name is not a file inside comfy_workflows/" });
    if (fs.existsSync(p) && !b.overwrite) return res.status(409).json({
      error: `comfy_workflows/${path.basename(p)} already exists`, code: "exists" });
    fs.mkdirSync(WF_DIR, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(b.graph, null, 2));
    const file = "comfy_workflows/" + path.basename(p);
    res.json({ saved: true, file, ...comfyGraphs.analyze(b.graph), files: wfList() });
  });

  /* Run a wired graph. THE CONTROLS ARE APPLIED HERE, not in the worker: the
     control model has exactly one implementation (lib/comfyGraphs.js) and
     graph_worker.py receives a finished API prompt. Two copies of "how a graph
     is patched" is precisely how worker.py and comfy_client.py drifted apart. */
  app.post("/api/graphs/run", (req, res) => {
    const b = req.body || {};
    const g = comfyGraphs.byId(core.GRAPHS_DIR, String(b.id || ""));
    if (!g) return res.status(404).json({ error: "no such graph" });
    if ((core.getConfig().engine || {}).backend !== "comfy") return res.status(400).json({
      error: "a wired graph runs through ComfyUI — set Settings → ComfyUI → Engine to ComfyUI API." });
    let src;
    try { src = graphFrom({ file: g.file }); }
    catch (e) { return res.status(e.status || 400).json({ error: String(e.message || e) }); }
    if (!comfyGraphs.isApi(src.graph)) return res.status(400).json({
      error: `comfy_workflows/${path.basename(g.file)} is not an API workflow — open it in `
        + "Settings → ComfyUI → Graphs and press “Export as API” first." });
    const { graph, applied, warnings } = comfyGraphs.apply(src.graph, g, b.values || {});
    /* THE REFERENCE DOCK FILLS THE LOAD NODES (2.121.0, by instruction).
       Names arrive from the dock and are resolved HERE against this project's
       asset folders, so the worker only ever handles files it can open — the
       same contract /api/genimage already has. A loader input the user wired a
       control to is held back, because a deliberate choice must outrank the
       dock. Anything left over is bypassed by comfyGraphs.assignRefs(). */
    const held = new Set();
    for (const a of applied) held.add(a.node + "." + a.input);
    const ASSET_DIR = { images: "images", videos: "video", audio: "sound" };
    const missing = [];
    const refs = {};
    for (const kind of comfyGraphs.REF_KINDS) {
      const want = Array.isArray(b[kind]) ? b[kind] : [];
      refs[kind] = want.map((n) => {
        const name = path.basename(String((n && n.file) || (n && n.name) || n || ""));
        const p = path.join(core.pDir(ASSET_DIR[kind]), name);
        if (!name || !fs.existsSync(p)) { if (name) missing.push(`${kind}/${name}`); return null; }
        return { name, path: p };
      }).filter(Boolean);
    }
    const fill = comfyGraphs.assignRefs(graph, refs, held);
    if (missing.length) fill.warnings.push(`not in this project's assets, so not used: ${missing.join(", ")}`);
    const seed = imageSeed.forRequest(b.seed);
    const job = core.makeJob({
      mode: "graph", graph: fill.graph, graph_id: g.id, graph_name: g.name, graph_file: g.file,
      graph_kind: g.kind, seed: seed.seed, seed_random: seed.random,
      // The worker uploads each of these to ComfyUI (which cannot see this
      // machine's disk) and writes the name ComfyUI gives back into the node.
      graph_uploads: fill.assigned.map((a) => ({ node: a.node, input: a.input, path: a.path, kind: a.kind })),
      graph_applied: applied.map((a) => `${a.label} → node ${a.node}.${a.input} = ${JSON.stringify(a.value)}`)
        .concat(fill.assigned.map((a) => `reference ${a.kind}[${a.index}] → node ${a.node}.${a.input} = ${a.name}`))
        .concat(fill.bypassed.map((x) => `bypassed unused ${x.class_type} (node ${x.node}) — ${x.why}`)),
      graph_warnings: warnings.concat(fill.warnings),
    });
    res.json({ job: job.id, applied, warnings: warnings.concat(fill.warnings),
               assigned: fill.assigned, bypassed: fill.bypassed, seed: seed.seed });
  });
  app.get("/api/projects/current", (_req, res) => res.json(readProject()));
  // the project's reference media (2.101.0): reference/images|videos|audio
  app.get("/projrefs/:kind/:name", (req, res) => {
    if (!projectRefs.KINDS[req.params.kind]) return res.status(404).json({ error: "no such kind" });
    const p = projectRefs.servePath(core.projDir(core.getProject()), req.params.kind, req.params.name);
    if (!fs.existsSync(p)) return res.status(404).json({ error: "no such reference" });
    res.sendFile(p);
  });
  // Separate from /save on purpose: /save happily writes over whatever is
  // there, which is right for saving and very wrong for "New".
  app.post("/api/projects/new", (req, res) => {
    const b = req.body || {};
    try { res.json(projects.create(b.name, b.description)); }
    catch (e) { res.status(e.status || 400).json({ error: e.message }); }
  });
  app.post("/api/projects/load", (req, res) => {
    const name = (req.body || {}).name;
    if (!name) return res.status(400).json({ error: "name required" });
    core.ensureProject(name);
    core.setProject(name);
    res.json(readProject());
  });
  /* SAVE (2.101.0): JSON as before, OR multipart with a `data` JSON field and
     the tray's pictures as `ref_images` files. The whole state goes in the
     .prj (timeline, gallery tab, generation settings, music lyrics/caption/
     style/length/seed, image style, camera, chat mode — whatever the client
     puts in `data`), and the reference media is COPIED into
     reference/images|videos|audio with the manifest written back under
     data.references. Videos/sounds are named project assets (video/, sound/)
     and are copied from there. A save WITHOUT a `references` key keeps the
     manifest already on disk (the beforeunload beacon cannot carry files). */
  app.post("/api/projects/save", require("../lib/refKeep").upload().array("ref_images", projectRefs.MAX_IMAGES), (req, res) => {   // 2.548.0: was 9 - a 10th picture refused the whole save
    const b = req.body || {};
    let data = b.data;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch { return res.status(400).json({ error: "data is not JSON" }); } }
    data = data && typeof data === "object" ? data : {};
    const cur = core.getProject();
    const want = String(b.name || "").trim();
    // 2.372.0: a NEW name = Save as - the whole project folder is copied first (lib/projects.copy), so the scene
    // board, its song, the chat, characters, assets and gallery come along; an existing other project is refused
    let copied = null;
    if (want && want.toLowerCase() !== cur.toLowerCase()) {
      try { copied = projects.copy(cur, want); }
      catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
    }
    const name = copied ? copied.name : cur;
    core.ensureProject(name);
    core.setProject(name);
    const pdir = core.projDir(core.getProject());
    let prev = {};
    try { prev = JSON.parse(fs.readFileSync(core.prjPath(core.getProject()), "utf8")) || {}; } catch {}
    let stored = null;
    if (data.references !== undefined) {
      // pictures: uploaded bytes win (the tray may hold images that exist nowhere else); a manifest entry with no
      // upload must already be stored (2.548.0: lib/projectRefs.store - the dock's autosave uses the same)
      stored = projectRefs.store(pdir, data.references, req.files || [], (assetKind, n) => path.join(core.pDir(assetKind), n));
      data.references = stored;
    } else if (prev.references) {
      data.references = prev.references;
    }
    if (data.description == null && prev.description) data.description = prev.description;
    if (!data.created && prev.created) data.created = prev.created;
    // 2.107.0: the timeline goes to timelines/<name>.json; the .prj keeps the name
    if (data.timeline == null && prev.timeline) data.timeline = prev.timeline;
    timelines.persist(pdir, data);
    data.saved = new Date().toISOString();
    // 2.372.0: MERGED into what is there - the .prj also holds server-owned keys (the scene board and its song
    // under `scenes`, `chapterRefs`); writing the page's object alone wiped the video docker's song and scenes
    const merged = projects.mergeState(prev, data);
    delete merged.tl; delete merged.timelines;      // the timeline lives in timelines/<name>.json (2.107.0)
    fs.writeFileSync(core.prjPath(core.getProject()), JSON.stringify(merged, null, 2));
    res.json({ name: core.getProject(), saved: true, timeline: merged.timeline, references: merged.references || null,
               copied_from: copied ? copied.from : undefined });
  });

  // ------------------------------------------------------------- export
  const u01 = (v, d) => Math.min(1, Math.max(0, v == null ? d : +v));
  /** An audio/image track in either shape -> {clips, transition_in, transition_out}.
   *  Legacy payloads sent a bare array of clips and carried no transitions, so
   *  those normalize to cuts and the compile behaves exactly as it used to. */
  const trackOf = (track, mapClip) => {
    const arr = Array.isArray(track) ? track : (track && track.clips) || [];
    const L = Array.isArray(track) ? {} : (track || {});
    return {
      clips: arr.map(mapClip),
      transition_in: transitions.normalize(L.transition_in),
      transition_out: transitions.normalize(L.transition_out),
    };
  };
  app.post("/api/export", (req, res) => {
    const t = req.body || {};
    if (Array.isArray(t.video)) t.video = t.video.map((c) => typeof c === "string" ? { name: c } : c);
    if (!Array.isArray(t.video) || !t.video.length)
      return res.status(400).json({ error: "timeline has no video clips" });
    try { clipFx.check(t); } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }   // 2.406.0
    // `dur` is the SOURCE file's length, which only the browser knows (it read
    // it off the <video> element). Copying it through is what lets
    // lib/timelineSpan.js work out the compile's length without the worker
    // having to ffprobe every untrimmed clip. Like every other key here it is
    // a manual allow-list entry: leave it out and it silently disappears.
    const timeline = {
      video: t.video.map((c) => ({
        path: path.join(core.pDir(c.src === "video" ? "video" : "output"), path.basename(c.name)),
        in: Math.max(0, +c.in || 0), out: +c.out || null,
        dur: +c.dur || null,
        start: Math.max(0, +c.start || 0),
        opacity: Math.min(1, Math.max(0, c.opacity == null ? 1 : +c.opacity)),
        ...clipFx.clipKeys(c),                  // 2.406.0: fx (speed / reverse / ramp, grade + LUT, sound) + tl_len
      })),
      video_role: clipFx.role(t.video_role, "voice"),   // 2.406.0: V1's sound in the mix (ducking)
      mix: clipFx.mixCfg(t.mix),                        // 2.406.0: ducking + loudness
      captions: captionsLib.normalize(t.captions),      // 2.406.0: burned in and / or a .srt beside the movie
      deliver: deliverLib.normalize(t.deliver),         // 2.407.0: the 📤 Export queue (made from the master)
      tc: deliverLib.tc(t.tc),                          // 2.407.0: the start timecode
      frame: frameSize.normalize(t.frame) || undefined, // 2.513.0: the timeline's frame size (V1 fitted into it)
      deliver_range: deliverLib.range(t.deliverRange, t.sel),   // 2.410.0: 📤 In / Out only (the ruler selection)
      deliver_hw: t.deliverHw === true,                 // 2.411.0: 📤 the graphics card's encoder when it has one
      video_muted: !!t.video_muted,
      video_volume: mixer.gain(t.video_volume, 1),      // 2.415.0: 🎚 a fader goes to +6 dB (2)
      video_pan: mixer.pan(t.video_pan),                // 2.415.0: 🎚 V1's pan
      master: mixer.master(t.master),                   // 2.415.0: 🎚 the master fader
      video_opacity: u01(t.video_opacity, 1),
      // Transitions are normalized HERE, at the boundary, so the worker only
      // ever sees {type,dur} with a known id. Before 2.60.0 these keys were
      // simply not copied onto the job at all: the UI sent them, this route
      // dropped them, and the worker's tl.get("video_transition_out") was
      // therefore always None — every transition was silently discarded.
      // Any new transition-bearing field MUST be added here too.
      video_transition_in: transitions.normalize(t.video_transition_in),
      video_transition_out: transitions.normalize(
        t.video_transition_out != null ? t.video_transition_out : t.video_transition),
      // V2+ layers: overlaid on the base track in ARRAY ORDER (later = on
      // top), each with its own mute, volume and layer-wide opacity
      video_layers: (t.video_layers || []).map((L) => ({
        name: String(L.name || "").slice(0, 40),
        muted: !!L.muted,
        volume: mixer.gain(L.volume, 1),        // 2.415.0: 🎚 to +6 dB
        pan: mixer.pan(L.pan),                  // 2.415.0: 🎚
        opacity: u01(L.opacity, 1),
        transition_in: transitions.normalize(L.transition_in),
        transition_out: transitions.normalize(L.transition_out),
        clips: (L.clips || []).map((c) => ({
          path: path.join(core.pDir(c.src === "video" ? "video" : "output"), path.basename(c.name)),
          in: Math.max(0, +c.in || 0), out: +c.out || null,
          dur: +c.dur || null,
          start: Math.max(0, +c.start || 0),
          opacity: Math.min(1, Math.max(0, c.opacity == null ? 1 : +c.opacity)),
          tf: clipTransform.normalize(c.tf),      // 2.377.0: the canvas's position / scale / rotation
          kf: keyframes.normalize(c.kf),          // 2.379.0: ◆ keyframes - opacity / position / scale / rotation tweens
          ...clipFx.clipKeys(c),                  // 2.406.0
          ...tlKeys.layerKeys(c),                 // 2.491.0: the layer's blend mode + track matte
          ...tlKeys.maskKeys(c),                  // 2.498.0: ✒ its masks (a grey mask video)
          ...tlKeys.pinKeys(c),                   // 2.499.0: ▢ its corner pin (the corners as keys)
          ...tlKeys.timeKeys(c),                  // 2.500.0: ⏱ motion blur / posterize time / echo
          ...tlKeys.distKeys(c),                  // 2.505.0: 〰 its distortion maps (two grey videos)
          ...tlKeys.vbakeKeys(c),                 // 2.506.0: 🎞 baked whole by the page (rays, warps, 3D ...)
          ...tlKeys.cutKeys(c),                   // 2.515.0: 🧍 its cut-out (the subject with its alpha) in place of the clip
          role: clipFx.role(L.role, "voice"),     // 2.406.0: the layer's sound in the mix
        })),
      })).filter((L) => L.clips.length),
      // An audio/image track arrives either as a bare array of clips (the
      // shape every build before 2.60.0 sent, still accepted so an older
      // saved project compiles) or as {clips, transition_in, transition_out}.
      // trackOf() collapses the two so the worker sees one shape.
      audio: (t.audio || []).map((track) => trackOf(track, (c) => ({
        // 2.412.0: a video clip's sound taken out (🔗) plays from the video file itself
        path: path.join(core.pDir(c.src === "video" ? "video" : c.src === "output" ? "output" : "sound"), path.basename(c.name)),
        start: Math.max(0, +c.start || 0),
        in: Math.max(0, +c.in || 0), out: +c.out || null,
        dur: +c.dur || null,
        volume: mixer.gain(c.volume, 1),          // 2.415.0: 🎚 the layer's fader x the clip's, to +6 dB
        pan: mixer.pan(c.pan),                    // 2.415.0: 🎚 the layer's pan
        kf: keyframes.normalize(c.kf),            // 2.379.0: ◆ volume keyframes
        ...clipFx.soundKeys(c),                   // 2.406.0: the clip's sound clean-up + its role (music by default)
      }))),
      images: (t.images || []).map((track) => trackOf(track, (c) => ({
        path: path.join(core.pDir("images"), path.basename(c.name)),
        start: Math.max(0, +c.start || 0),
        len: Math.max(0.1, +c.len || 3),
        opacity: Math.min(1, Math.max(0, +c.opacity ?? 1)),
        tf: clipTransform.normalize(c.tf),        // 2.377.0: an image / TEXT layer placed on the canvas
        ...tlKeys.imageKeys(c, core.pDir("images")),   // 2.379.0: kf, lopacity, tint (a keyframed text colour)
        ...tlKeys.layerKeys(c),                   // 2.491.0: the layer's blend mode + track matte
        ...clipFx.adjustKeys(c),                  // 2.409.0: an adjustment layer - its grade + effects, not a picture
      }))),
      keep_original_audio: t.keep_original_audio !== false,
    };
    // How long the compiled movie must be: the end of the LAST clip on ANY
    // layer, not the end of the base video track. The worker pads V1 with
    // black/silence up to this and caps the output there. Computed on this
    // side because `dur` above is only known here; the worker recomputes and
    // takes the larger of the two, so an old payload without it still works.
    // 2.407.0: J / L cuts - the split sound as an extra track + where V1's own sound is silenced
    const split = splitEdit.forJob(t.video, timeline.video, timeline.video_volume);
    if (split.track) { timeline.audio.push(split.track); timeline.v1_mute = split.mute; }
    // 2.412.0: J / L cuts on the video layers (V2+) too - their sound joins the same track, the clips under it are silenced
    const layerSplit = [];
    splitEdit.forLayers((t.video_layers || []).filter((L) => (L.clips || []).length), timeline.video_layers, layerSplit);
    if (layerSplit.length) { if (split.track) split.track.clips.push(...layerSplit); else timeline.audio.push({ clips: layerSplit }); }
    // 2.412.0: a picture whose sound was taken out as its own clip (🔗) is silent - V1 through v1_mute, a layer's clip amute
    const tlLen = (m) => (m.tl_len != null ? +m.tl_len : Math.max(0, (+m.out || +m.dur || 0) - (+m.in || 0)));
    const v1Out = targetsLib.silentSpans(t.video.map((c, i) => Object.assign({}, timeline.video[i], { soundOut: !!c.soundOut })), tlLen);
    if (v1Out.length) timeline.v1_mute = (timeline.v1_mute || []).concat(v1Out);
    (t.video_layers || []).filter((L) => (L.clips || []).length).forEach((L, li) => {
      const ml = timeline.video_layers[li]; if (!ml) return;
      (L.clips || []).forEach((c, ci) => { const m = ml.clips[ci]; if (c && c.soundOut && m) (m.amute = m.amute || []).push([+(+m.start || 0).toFixed(4), +((+m.start || 0) + tlLen(m)).toFixed(4)]); });
    });
    timeline.scene_end = tlspan.sceneEnd(timeline);
    // 2.414.0: a NESTED SEQUENCE's render - its own file (nest_<name>.mp4, adopted into video/ by /api/nest/adopt), the
    // finer master (it is compiled again inside the outer timeline), no deliverables, no .srt beside it
    let nestOut = null;
    if (t.nest) {
      try { nestOut = nestLib.outName(t.nest, nestLib.hashOf(core.projDir(core.getProject()), t.nest)); } catch (e) { return res.status(400).json({ error: e.message }); }
      timeline.deliver = []; timeline.deliver_range = null;
      if (timeline.captions && timeline.captions.srt) timeline.captions = Object.assign({}, timeline.captions, { srt: false });
    }
    // 2.418.0: a ⚡ RENDER PREVIEW - the same compile into its own file (preview_<id>.mp4, adopted into cache/preview by
    // /api/tlrender/adopt), no deliverables, no .srt; the canvas plays it where the timeline is too heavy to draw live
    let previewOut = null;
    if (t.preview && !nestOut) {
      try { previewOut = tlRenderLib.outName(t.preview); } catch (e) { return res.status(400).json({ error: e.message }); }
      timeline.deliver = []; timeline.deliver_range = null;
      if (timeline.captions && timeline.captions.srt) timeline.captions = Object.assign({}, timeline.captions, { srt: false });
    }
    const job = core.makeJob({
      ...(timeline.deliver.length || nestOut ? { crf: 14 } : {}),   // 2.407.0: a finer master when the queue re-encodes it
      ...(nestOut ? { out_name: nestOut } : {}),
      ...(previewOut ? { out_name: previewOut } : {}),
      mode: "export",
      project: core.getProject(),
      prompt: `[compile] ${t.video.length} video clip(s), ${(t.audio || []).flat().length} audio clip(s)`,
      width: 0, height: 0, frames: 0, steps: 0, seed: 0, format: "webm",
      timeline,
    });
    res.json(core.jobDict(job));
  });

  // ----------------------------------------------------------------- llm
  app.post("/api/sdcli/install", (_req, res) => {
    const job = core.makeJob({ mode: "install_sdcli", prompt: "[install sd-cli engine]",
      width: 0, height: 0, frames: 0, steps: 0, seed: 0, format: "webm" });
    res.json(core.jobDict(job));
  });
  app.post("/api/llm/install", (_req, res) => {
    const job = core.makeJob({ mode: "install_llm", prompt: "[install llama.cpp engine]",
      width: 0, height: 0, frames: 0, steps: 0, seed: 0, format: "webm" });
    res.json(core.jobDict(job));
  });
  app.get("/api/llms", (_req, res) => {
    const { dir, exe } = core.llmPaths();
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".gguf")).sort(); } catch {}
    const llama = core.llamaState();
    res.json({ files, engine_found: fs.existsSync(exe),
               running: llama.proc ? { file: llama.file, ready: llama.ready } : null,
               external: !!core.getConfig().llm.external_url });
  });
  // Start llama-server explicitly. ensureLlama is a no-op when the requested
  // model is already loaded and healthy, so pressing Start twice is harmless.
  app.post("/api/llm/start", async (req, res) => {
    const b = req.body || {};
    const { dir } = core.llmPaths();
    let file = String(b.file || "").trim();
    if (!file) {
      // no model named: fall back to the only/first .gguf in the folder, which
      // is what "just start it" means on a machine with one model
      let files = [];
      try { files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".gguf")).sort(); } catch {}
      if (!files.length) return res.status(400).json({
        error: `no .gguf models in ${dir} — drop one in, or set the LLM folder in Settings → LLM` });
      file = files[0];
    }
    try {
      await core.ensureLlama(path.basename(file));
      const st = core.llamaState();
      res.json({ started: true, file: st.file, ready: st.ready });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  /* 2.259.0 (Tim: "reset all memory, cpu and gpu cached memory and eject
     all models, so nothing is loaded in the system"): one button, one
     endpoint. Stops the chat LLM and the vision model (their RAM frees
     with the processes), WAITS for each card's VRAM to actually drain
     (core.gpuSettle — the 2.258.0 no-stacking rule), and tells ComfyUI to
     unload its models and free its caches (/free, best-effort — an
     unreachable ComfyUI has nothing loaded to eject). ASR and TTS run as
     per-call python that exits when done — nothing resident to eject. */
  app.post("/api/models/reset", async (_req, res) => {
    const capt = require("../lib/captioner");
    const cfg = core.getConfig();
    const llmDev = String((cfg.llm && cfg.llm.device) || "cuda1");
    const visDev = capt.visionDevice(core);
    const out = { llm: false, vision: false, comfy: null };
    if (core.llamaState().proc) { core.stopLlama(); out.llm = true; }
    out.vision = capt.freeForJob("the reset button was pressed");   // no core = always-free
    if (out.llm) await core.gpuSettle(llmDev);
    if (out.vision && visDev !== llmDev) await core.gpuSettle(visDev);
    try { out.comfy = await comfy.freeMemory(); }
    catch (e) { out.comfy = { ok: false, error: e.message }; }
    res.json({ ok: true, ...out });
  });

  app.post("/api/llm/stop", (_req, res) => {
    core.stopLlama();
    res.json({ stopped: true });
  });

  app.post("/api/enhance", async (req, res) => {
    const config = core.getConfig();
    const { prompt, refs } = req.body || {};
    let { mode } = req.body || {};
    if (!prompt || !prompt.trim()) return res.status(400).json({ error: "prompt is required" });
    // 2.395.0: an Append / Prepend video = fl2va: <Picture 1> its frame (described), <Picture 2> the dock's picture
    const eop = refContext.opOf(req.body || {});
    if (eop) mode = "fl2va (" + eop.op + " " + eop.name + ")";
    // picture number is the slot order the UI sends; one subject may appear in
    // several pictures (face / body / clothing of the same character)
    const mapping = eop ? "" : (refs || [])
      .map((r, i) => {
        const role = (r.role || "person").trim();
        const what = (role === "person" || role === "subject") ? "" : role + " ";
        const note = String(r.note || "").replace(/\s+/g, " ").trim().slice(0, 200);         // 2.539.0: the user's description
        return `<Subject ${r.subject}> ${what}is in <Picture ${r.picture || i + 1}>` + (note ? ` (${note})` : "");   // 2.365.0: H3's own casing
      }).join("\n");
    // 2.104.0: the H3 guide (lib/promptGuides.json) is the teaching; the
    // mapping lines are the app's own convention and stay verbatim.
    const system = [
      "You rewrite rough video-generation prompts into detailed prompts for MiniMax H3, an audio-video model.",
      "Rules:",
      "- Keep every <Subject n>, <Picture n>, <Video n> and <Audio n> tag exactly as given; do not invent new ones; never write a file name as a tag.",
      "- Say what each reference gives: e.g. keep the head, face and hair of the woman in <Picture 1>, keep the body of the woman in <Picture 2>, she does the action in <Video 1>, her voice is <Audio 1>.",
      // 2.364.0 (Tim: "i think the llm is not following directions"): speech in H3's dialogue syntax
      require("../lib/voiceStyle").ENHANCE_RULE,
      // 2.365.0 (Tim: "can u teach the llm to write a proper formatted prompt please"): the full shape + an example
      "",
      require("../lib/voiceStyle").TEACHING,
      "",
      "- The same <Subject n> may be shown in several pictures (face, body, clothing); treat them as one character.",
      "- Keep (do not rewrite) the reference mapping lines at the top if provided; in the prompt body refer to people by <Picture n>.",
      "- One paragraph after the mapping lines. No headings, no options, no commentary.",
      "- Output ONLY the final prompt text.",
      "",
      promptGuides.guideFor(core.STYLES_DIR, { kind: "video", arch: "h3", model: "" }),
      // 2.118.0 (Tim): "sbs vr" in the rough prompt pulls the VR stereo-pair
      // addendum in — the enhanced prompt must never mirror the right eye
      promptGuides.addendaFor(core.STYLES_DIR, "video", prompt),
    ].filter(Boolean).join("\n");
    // 2.354.0: the dock's videos + sounds (and picture names) - lib/refContext.js
    const eb = req.body || {};
    let eFrame = "";
    if (eop) try { eFrame = (await refContext.frameDesc(core, chatDir(), eop, core.pDir("video"), true)).desc; } catch { eFrame = ""; }
    const eDock = refContext.dock({ refs: (refs || []).map((r) => ({ name: r.name, subject: r.subject, role: r.role, note: r.note })),
                                    ref_videos: eb.ref_videos, ref_audios: eb.ref_audios, ref_video_op: eb.ref_video_op, ref_notes: eb.ref_notes }, [], eFrame);
    const avLines = eop ? refContext.block(eDock).trim()
      : eDock.videos.map((v) => `<Video ${v.n}> is the reference video (its motion / action)${v.desc ? ": " + v.desc : ""}`)
        .concat(eDock.audios.map((a) => `<Audio ${a.n}> is the reference sound (a voice or sound)${a.desc ? ": " + a.desc : ""}`)).join("\n");
    const user = (mapping ? mapping + "\n" : "") + (avLines ? avLines + "\n" : "") + (mapping || avLines ? "\n" : "")
      + `Rough prompt (mode: ${mode}): ${prompt}`;
    // The model is chosen and called in lib/llmChat.js, shared with the prompt
    // chat below. Two copies of "which .gguf, at which URL, started how" is the
    // duplication that let worker.py and comfy_client.py drift apart.
    const out = await llmChat.complete(core, {
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.7, max_tokens: 600, llm_file: (req.body || {}).llm_file });
    if (!out.ok) return res.status(out.status || 502).json({ error: out.error });
    /* 2.364.0 (Tim: "i think the llm is not following directions" - the reply wrote speech as plain quotes):
       whatever the model wrote, every spoken line comes back as H3 dialogue (lib/voiceStyle.markSpeech) */
    const tagged = refContext.retag(out.text, eDock).text;
    const vs = require("../lib/voiceStyle");
    // 2.365.0: the whole H3 shape, not only the quotes (lib/voiceStyle.formatSpeech)
    const ms = vs.formatSpeech(tagged, { audioNames: eDock.audios.map((a) => a.name) });
    res.json({ text: ms.text, ...(ms.changes.length ? { note: "formatted for MiniMax H3: " + ms.changes.join("; ") } : {}) });
  });

  /* ------------------------------------------------- the prompt chat (2.85.0)
     A conversation ABOUT what to make, stored per project at
     projects/<p>/chat/<date_time>.chat and replayed to the model so it knows
     where you got to. Distinct from /api/enhance, which rewrites one line into
     one finished prompt; this is for working out what you want in the first
     place. lib/chatStore.js owns the files, lib/llmChat.js owns the call. */
  const chatDir = () => core.pDir("chat");

  app.get("/api/chat", (req, res) => {
    const dir = chatDir();
    const days = Math.max(1, Math.min(14, Number(req.query.days) || 2));
    res.json({
      session: chatStore.currentSession(dir),
      days,
      // 2.115.1: the window shows the CURRENT session; ?days=N (history) is
      // still there for anyone who wants the day's earlier sessions
      messages: req.query.session === "all" ? chatStore.history(dir, { days, limit: 0 }) : chatStore.current(dir, { limit: 0 }),
      sessions: chatStore.sessions(dir),
      saved: chatStore.byRecent(dir),            // 2.370.0: the picker, newest first (titled saves included)
    });
  });

  app.post("/api/chat/new", (_req, res) =>
    res.json({ session: chatStore.newSession(chatDir()), messages: [] }));

  /** SAVE (2.164.0, by instruction): freeze the current conversation file as
   *  the archive; the chat continues in a fresh copy. */
  /* 2.370.0 (Tim: "save the chat as <subject summary> - <date>"): the archive is named by its subject -
     lib/chatTitle (the running LLM names it, else the first words asked) + lib/chatStore.saveAs */
  app.post("/api/chat/save", async (_req, res) => {
    const dir = chatDir();
    const msgs = chatStore.current(dir, { limit: 0 });
    if (!msgs.length) return res.status(400).json({ error: "nothing to save yet — say something first" });
    const chatTitle = require("../lib/chatTitle");
    let t;
    try { t = await chatTitle.titleFor(core, msgs); } catch { t = { title: chatTitle.heuristic(msgs), how: "first words" }; }
    const r = chatStore.saveAs(dir, chatTitle.savedName(t.title));
    if (!r) return res.status(500).json({ error: "the chat could not be saved (is the project folder writable?)" });
    res.json({ ok: true, saved: r.saved, name: r.saved.replace(/\.chat$/, ""), title: t.title, how: t.how,
               from: r.from, session: r.session });
  });

  /* 2.370.0 ("add a clear chat icon only button next to the dropdown"): the current conversation emptied */
  app.post("/api/chat/clear", (_req, res) => {
    const r = chatStore.clear(chatDir());
    if (r.error) return res.status(500).json({ error: "the chat could not be cleared" });
    res.json({ ok: true, session: r.session, cleared: r.cleared });
  });

  /** LOAD (2.164.0): open a past conversation as a fresh copy — the picked
   *  file is never written again. */
  app.post("/api/chat/load", (req, res) => {
    const name = String((req.body || {}).session || "");
    const r = chatStore.openCopy(chatDir(), name);
    if (!r) return res.status(404).json({ error: `no such saved chat: ${name || "(none picked)"}` });
    res.json({ ok: true, loaded: r.from, session: r.session,
               messages: chatStore.current(chatDir(), { limit: 0 }) });
  });

  /* 2.233.0 PICTURES IN THE PROMPT (Tim verbatim: "upload a picture or
     pictures into the prompt and have a te ... describe the pictures to the
     llm and for the llm to use the descriptions and the prompt"). The same
     endpoint now also takes multipart/form-data — multer only touches
     multipart requests, so every JSON caller is byte-for-byte unaffected.
     Fields: text, llm_file, context (JSON string), describe ("1"/"0" — the
     prompt dock's 🖼 Describe image checkbox); files under "images".
     Describe ON: lib/captioner describes each picture and the descriptions
     fold into the system context AND into the stored chat as a bracketed
     user-side note, so chat-recall (and the screenplay writer's recall) sees
     them forever. OFF: the pictures store as files with a plain
     "[N picture(s) attached, not described]" note and the captioner is
     never started. Captioner failures fall back IN WORDS — never a dead
     chat. */
  // 2.354.0: + "ref_images" - the reference dock's pictures (lib/refContext.js describes + tags them)
  app.post("/api/chat", upload.fields([{ name: "images", maxCount: 9 }, { name: "ref_images", maxCount: 9 }]), async (req, res) => {
    const b = req.body || {};
    const text = String(b.text || "").trim();
    if (!text) return res.status(400).json({ error: "say something first" });
    if (typeof b.context === "string") {           // multipart fields arrive as strings
      try { b.context = JSON.parse(b.context); } catch { b.context = {}; }
    }
    const dir = chatDir();
    const session = chatStore.currentSession(dir);
    // WRITTEN BEFORE THE MODEL IS CALLED. If the LLM is down, what you typed is
    // still on disk — losing the user's own words to somebody else's 502 is not
    // a trade worth making.
    chatStore.append(dir, session, "user", text);
    let visionNote = "";                            // rides the system context
    const attached = ((req.files || {}).images) || [];
    const images = attached.filter((f) =>
      /^image\/(png|jpe?g|webp)$/i.test(String(f.mimetype || "")));
    if (attached.length && !images.length) {
      chatStore.append(dir, session, "user",
        "[attachment refused: only png/jpg/webp pictures can ride the prompt]");
    }
    if (images.length) {
      // the pictures attach to the stored chat as FILES either way — the
      // conversation folder keeps what was actually sent
      const att = path.join(dir, "attachments");
      const saved = [];
      try {
        fs.mkdirSync(att, { recursive: true });
        for (const f of images) {
          let name = path.basename(f.originalname || "picture.png").replace(/[^\w.\-]+/g, "_");
          for (let n = 1; fs.existsSync(path.join(att, name)); n++) {
            name = name.replace(/(\.[^.]+)$/, `-${n}$1`);
            if (n > 99) break;
          }
          fs.writeFileSync(path.join(att, name), f.buffer);
          saved.push(name);
        }
      } catch { /* the descriptions still ride; storage is best-effort */ }
      if (String(b.describe || "1") !== "0") {
        try {
          const descs = await captioner.describe(core, images);
          // 2.234.0 (Tim verbatim): "save the description in images.tmp" —
          // the descriptions persist beyond this turn; tmpRag() below loads
          // them back into EVERY chat call's system context.
          try {
            captioner.tmpSave(core, descs.map((d, i) => ({
              file: saved[i] || (images[i] && images[i].originalname) || `picture-${i + 1}`,
              desc: d })));
          } catch { /* the fold below still rides this turn */ }
          const lines = descs.map((d, i) => `${i + 1}) ${d}`);
          visionNote = "\n\nTHE ATTACHED PICTURES (described by the local "
            + "vision model — treat these as what the user is showing you):\n"
            + lines.join("\n");
          chatStore.append(dir, session, "user",
            "[attached " + images.length + " picture(s)"
            + (saved.length ? " (" + saved.join(", ") + ")" : "")
            + ", described by the local vision model: "
            + lines.join(" ") + "]");
        } catch (e) {
          // fall back IN WORDS: the chat continues without the pictures' eyes
          const why = String((e && e.message) || "the vision model is not installed - run get-qwen3vl.ps1");
          visionNote = "\n\n(The user attached " + images.length + " picture(s) "
            + "but they could not be described: " + why + ")";
          chatStore.append(dir, session, "user",
            "[" + images.length + " picture(s) attached but not described — " + why + "]");
        }
      } else {
        chatStore.append(dir, session, "user",
          "[" + images.length + " picture(s) attached, not described"
          + (saved.length ? ": " + saved.join(", ") : "") + "]");
      }
    }
    const prior = chatStore.current(dir);           // 2.115.1: a New chat resets the model's context too
    // CHAT RECALL (2.169.0): the session is REBUILT to a hard budget instead
    // of replayed whole. The old way, llama-server truncated an overgrown
    // prompt from the TOP — the system prompt (and the cast with it) fell off
    // first, and the second screenplay ask in a session came back about
    // nobody. Now the seed + the relevant middle + the recent tail ride
    // inside the budget, and the cast facts are re-sent EVERY call so no
    // amount of history can push the characters out of sight.
    // 2.174.0: the config key is llm.ctx (2.152.0) — this read said
    // llm.context and silently fell back to 8192 forever, so the slider
    // never moved the chat budget. ctx=0 means "the model's own training
    // context" (-c 0); the budget cannot know that number, so 0 keeps the
    // 8192 floor. The 24000-char cap stands regardless of a 128k ctx: the
    // recall is meant to keep prompts SMALL.
    const llmCfg = core.getConfig().llm || {};
    const ctxTokens = Math.max(2048,
      (llmCfg.ctx | 0) || (llmCfg.context | 0) || 8192);
    const budget = Math.min(24000, Math.max(3000, (ctxTokens - 1600) * 3));
    const recalled = chatRecall.build(prior, text, budget);
    // 2.230.0 (Tim verbatim): "when i ask to create a sceenplay, or
    // screenplay of, or make a screenplay, check the global prompt in
    // video docker, if it is empty build the prompt, save the prompt and
    // pass it to the llm rag". The video docker's global prompt IS the
    // plan's prompt_prefix (the board's shared prompt). Empty -> built by
    // the SAME buildPrefix the writer uses (cast + chapter-reference
    // paragraphs) and SAVED (the shots-less save shape of
    // /api/scenes/prefix, so the docker's editor shows it immediately);
    // either way it rides this chat call's system context — the recall-
    // built stack IS the llm rag.
    let boardPrompt = "";
    if (screenplayLib.asksForScreenplay(text)) {
      try {
        const stB = scenesLib.load(b.project);
        let pfx = ((stB.plan || {}).prompt_prefix) || [];
        if (!pfx.some((l) => String(l).trim())) {
          pfx = screenplayLib.buildPrefix(charsLib.list(b.project),
            { refParagraphs: chapterRefsLib.prefixParagraphs(b.project),
              locations: require("../lib/locationPrefix").lines(envsLib.list(b.project)) });
          scenesLib.save({ ...stB,
            plan: { ...(stB.plan || { shots: [] }), prompt_prefix: pfx } },
            b.project);
        }
        boardPrompt = pfx.join("\n").slice(0, 4000);
      } catch { boardPrompt = ""; }
    }
    // 2.234.0 (Tim verbatim): "load images.tmp into rag for llm model
    // before running the llm" — the saved descriptions ride EVERY chat
    // call's system context (the recall-built stack is the llm rag), so a
    // picture described three turns ago is still in sight. "" when the
    // file is empty; a broken file never breaks the chat.
    let tmpRag = "";
    try { tmpRag = captioner.tmpRag(core); } catch { tmpRag = ""; }
    // 2.244.0 (Tim verbatim: "when i prompt, create a song or make a song,
    // create a song in prompt chat and send the lyrics to lyrics in music
    // docker, and style to the style input ... and title to the title
    // input"): the screenplay pattern for songs — the ask teaches the LLM
    // the TITLE/STYLE/LYRICS shape for THIS call, the parsed reply rides
    // the response as `song`, and the page pours it into the music dock.
    const songAsk = songwriter.asksForSong(text);
    // 2.354.0 (Tim: "the llm now returns <filename.ext> instead of <picture 1>"): the reference dock -
    // tags, subjects, descriptions, videos, sounds - and the rule for writing with them (lib/refContext.js)
    let refDock = null, refBlock = "";
    const rctx = b.context || {};
    const rop = refContext.opOf(rctx);           // 2.395.0: an Append / Prepend video = fl2va, its frame <Picture 1>
    if (rop || (rctx.refs || []).length || (rctx.ref_videos || []).length || (rctx.ref_audios || []).length) {
      const describe = String(b.describe || "1") !== "0";
      const dsc = await refContext.describePictures(core, dir, ((req.files || {}).ref_images) || [], describe);
      const fd = rop ? await refContext.frameDesc(core, dir, rop, core.pDir("video"), describe) : { desc: "", note: "" };
      refDock = refContext.dock(rctx, dsc.descs, fd.desc);
      const notes = [dsc.note, fd.note].filter(Boolean).join("; ");
      refBlock = refContext.block(refDock) + (notes ? "\n(" + notes + ")" : "");
    }
    const messages = [{ role: "system",
      content: llmChat.CHAT_SYSTEM + llmChat.selectionContext(core.STYLES_DIR, b.context,
        recalled.filter((m) => m.role === "user").map((m) => m.text).join("\n"))
        + chatRecall.castNote(charsLib.list(b.project), envsLib.list(b.project))
        + (boardPrompt ? "\n\nTHE BOARD'S GLOBAL PROMPT (the StoryBoard's "
            + "shared prompt — any screenplay you discuss or draft must be "
            + "consistent with it):\n" + boardPrompt : "")
        + tmpRag
        + refBlock
        + (songAsk ? songwriter.FORMAT_NOTE : "")
        + visionNote }];
    for (const m of recalled) messages.push({ role: m.role, content: m.text });
    const out = await llmChat.complete(core, {
      messages, temperature: 0.8, max_tokens: 700, llm_file: b.llm_file });
    if (!out.ok) return res.status(out.status || 502).json({ error: out.error, session });
    // 2.354.0: a file name written as a tag -> its <Picture n> / <Video n> / <Audio n>; <sound n> -> <Audio n>
    out.text = refContext.retag(out.text, refDock).text;
    chatStore.append(dir, session, "assistant", out.text);
    // a song ask whose reply parses carries the song; one that does not is
    // a chat reply like any other — never an error
    const song = songAsk ? songwriter.parse(out.text) : null;
    res.json(song ? { session, reply: out.text, context: prior.length, song }
                  : { session, reply: out.text, context: prior.length });
  });

  /** 2.233.0: the Prompt dock's Vision dropdown — every .gguf that has an
   *  mmproj projector .gguf BESIDE it (anywhere in the name) (in <app>/qwen3vl/ or the LLM models dir); a
   *  model without its projector is NOT listed (it cannot see). */
  /** 2.234.0 ("show loading vision model in statusbar"): the one line the
   *  promptdock polls while a describe is in flight — {running, loading,
   *  ready, model}. `loading` covers exactly the up-to-3-minute window
   *  between spawn and a green /health. */
  app.get("/api/captioner/status", (_req, res) => {
    res.json(captioner.status());
  });

  /** 2.237.0 (Tim verbatim: "no logs to show. show all logs in console and
   *  make it copiable"): the whole vision log ring — captioner lines AND
   *  the vision llama-server's own piped output — for the Console dock's
   *  🖼 Vision view. */
  app.get("/api/captioner/logs", (_req, res) => {
    res.json({ lines: captioner.logs(), status: captioner.status() });
  });

  app.get("/api/captioner/models", (_req, res) => {
    // 2.233.2: the full report — models PLUS every scanned dir's census and
    // a why-empty note, so a blank dropdown diagnoses itself.
    try { res.json(captioner.scanReport(core)); }
    catch (e) { res.status(500).json({ models: [], dirs: [], note: e.message, error: e.message }); }
  });

  // -------------------------------------- server-side path browser (Settings)
  app.get("/api/fsbrowse", (req, res) =>
    res.json(core.fsBrowse(String(req.query.dir || ""), String(req.query.exts || ""))));

  // ------------------------------------------- ComfyUI launcher (lib/comfy.js)
  app.get("/api/comfy/status", async (_req, res) => {
    try { res.json(await comfy.status()); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/comfy/start", async (_req, res) => {
    try { res.json(await comfy.start()); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.post("/api/comfy/stop", (_req, res) => res.json(comfy.stop()));
  // 2.100.0: the decisive [Errno 22] test as one button — stop the managed
  // ComfyUI and start it again with a REAL console window (lib/comfyStdio.js).
  app.post("/api/comfy/relaunch-console", async (req, res) => {
    try { res.json(await comfy.relaunchConsole(req.body || {})); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  // 2.98.0: "Free VRAM now" — ComfyUI unloads every model and empties its
  // cache (POST /free), and the reply carries before -> after per card. The
  // workers do the same automatically before each generation unless
  // engine.comfy.free_before_gen is false; this is the manual button.
  app.post("/api/comfy/free", async (_req, res) => {
    try {
      const j = await comfy.freeMemory();
      res.status(j.ok ? 200 : 503).json(j);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  /* Clean exit for the WHOLE app (2.81.3). Electron's before-quit used to just
     server.kill() — on Windows that is TerminateProcess, so this process died
     with its exit handlers never run, and the ComfyUI we launched survived as a
     hidden orphan holding port 8188 and the VRAM. Tim found it the honest way:
     quit the app, try to start ComfyUI by hand, and it cannot bind. Electron
     now POSTs here first; the reply goes out before the sweep so the caller is
     not left waiting on a process that is busy dying. */
  app.post("/api/shutdown", (_req, res) => {
    res.json({ ok: true, stopping: true });
    setTimeout(() => {
      try { comfy.shutdownAll("app quit"); } catch { /* dying anyway */ }
      process.exit(0);
    }, 60);
  });
  // Generate calls this first: if ComfyUI is not answering, launch it. Returns
  // as soon as the process is spawned; the UI polls /api/comfy/status for
  // readiness so a slow model load never holds the request open.
  app.post("/api/comfy/ensure", async (req, res) => {
    // force: this job needs ComfyUI whatever the VIDEO backend is set to — an
    // image style carries its own engine (2.73.0)
    try { res.json(await comfy.ensure({ force: !!(req.body || {}).force })); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  // Incremental launch log for the in-app console (same shape as job logs).
  // Comfy Kitchen (fast quantized kernels) — detection + optional install into
  // ComfyUI's own interpreter. All logic lives in lib/comfy.js.
  // 2.223.11: Settings → ComfyUI → Folders — extra_model_paths.yaml
  app.get("/api/comfy/modelpaths", (_req, res) => {
    const d = comfyPaths.read();
    res.status(d.error ? 400 : 200).json(d);
  });
  app.post("/api/comfy/modelpaths", (req, res) => {
    const d = comfyPaths.save(req.body || {});
    res.status(d.error ? 400 : 200).json(d);
  });
  app.get("/api/comfy/accel", (_req, res) => {
    try { res.json(comfy.accelStatus()); }
    catch (e) { res.json({ error: String(e.message || e), gpus: [], notes: [] }); }
  });
  app.post("/api/comfy/accel/install", (_req, res) => {
    try { res.json(comfy.accelInstall()); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  // VIDEO ACCELERATORS (2.116.0): sage wheel + KJNodes + Spectrum for the
  // MiniMax H3 video styles. Status probes ComfyUI's python and custom_nodes;
  // install streams pip/git output into the app console (lib/comfy.js).
  app.get("/api/comfy/vaccel", (_req, res) => {
    try { res.json(comfy.videoAccelStatus()); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  app.post("/api/comfy/vaccel/install", (req, res) => {
    try { res.json(comfy.videoAccelInstall(String((req.body || {}).what || ""))); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });

  app.get("/api/comfy/log", async (req, res) => {
    const st = await comfy.status();
    res.json({ ...comfy.logFrom(parseInt(req.query.from, 10) || 0),
               reachable: st.reachable, managed: st.managed, starting: st.starting });
  });
  // Native Windows 11 folder picker (IFileOpenDialog / FOS_PICKFOLDERS).
  app.get("/api/comfy/pickdir", async (_req, res) => {
    try { res.json(await comfy.pickFolderNative()); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });

  // ------------------------------------------- model manager (ComfyUI repo)
  app.get("/api/modelfiles", (_req, res) => {
    const repo = core.getConfig().hf.repo;
    const local = [];
    try {
      for (const f of fs.readdirSync(core.MODELS_DIR)) {
        const st = fs.statSync(path.join(core.MODELS_DIR, f));
        if (st.isFile()) local.push({ file: f, gb: +(st.size / 1e9).toFixed(2) });
      }
    } catch {}
    const manifest = core.MODEL_MANIFEST.map((m) => ({
      ...m, repo: m.repo || repo,
      local: local.some((l) => l.file === path.basename(m.path)),
    }));
    res.json({ repo, manifest, local });
  });

  app.post("/api/modeltools", (req, res) => {
    const b = req.body || {};
    const repo = (b.repo || core.getConfig().hf.repo).trim();
    if (b.op === "download") {
      const rel = String(b.path || "").trim();
      if (!rel || rel.includes("..")) return res.status(400).json({ error: "path required" });
      const job = core.makeJob({ mode: "download", prompt: `[download] ${repo} :: ${rel}`,
        repo, file_path: rel, hf_token: (core.getConfig().hf || {}).token || "",
        width: 0, height: 0, frames: 0, steps: 0, seed: 0, format: "webm" });
      return res.json(core.jobDict(job));
    }
    if (b.op === "convert") {
      const src = path.basename(String(b.source || ""));
      const qtype = String(b.qtype || "q8_0").replace(/[^a-z0-9_]/gi, "");
      if (!src) return res.status(400).json({ error: "source required" });
      const srcAbs = path.join(core.MODELS_DIR, src);
      if (!fs.existsSync(srcAbs)) return res.status(400).json({ error: `not in models/: ${src}` });
      const out = src.replace(/\.(safetensors|gguf|sft)$/i, "") + `-${qtype}.gguf`;
      const job = core.makeJob({ mode: "convert",
        prompt: `[convert] ${src} -> ${out} (${qtype})`,
        source: srcAbs, out_file: out, qtype,
        width: 0, height: 0, frames: 0, steps: 0, seed: 0, format: "webm" });
      return res.json(core.jobDict(job));
    }
    res.status(400).json({ error: "op must be download or convert" });
  });

  // 2.205.0 (by instruction): start the engines WITH the app when Settings
  // says so — ComfyUI (Settings → ComfyUI) and llama-server with the Prompt
  // dock dropdown's model (Settings → LLM). Fire-and-forget: a machine that
  // cannot start an engine still boots the studio; failures land in the log.
  setTimeout(() => {
    autostart.run(core.getConfig(),
      { comfy: () => comfy.start(),
        llm: (f) => core.ensureLlama(f) },
      (m) => console.log(m)).catch(() => {});
  }, 1500);
  // 2.378.0: LAST - an error under /api answers JSON, never Express's HTML page (the page's r.json() read
  // "<!DOCTYPE ..." as "Unexpected token '<'"); an /api address that does not exist answers a JSON 404
  require("../lib/tempUpload").jsonErrors(app);
}

module.exports = { mount };
