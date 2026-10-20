#!/usr/bin/env node
/* EXECUTES the Settings -> Image paint path in a real DOM and asserts the model
 * dropdowns actually fill. Run: node scripts/test-imagedom.js
 *
 * WHY THIS EXISTS. scripts/test-imageui.js greps the SOURCE. It confirmed, over
 * several releases, that cmCombo existed, that it was wired to the right
 * categories, that the folder filter offered "All folders" — every one of those
 * checks green while Tim's dropdowns were empty on the actual machine. A regex
 * cannot tell you a function returns nothing; only running it can.
 *
 * jsdom is a devDependency-by-hand (npm install jsdom --no-save). If it is not
 * present this script SKIPS with exit 0 rather than failing the suite, because
 * an offline install must still be able to run the e2e run.
 */
let JSDOM;
try { ({ JSDOM } = require("jsdom")); }
catch {
  console.log("SKIP: jsdom is not installed (npm install jsdom) — DOM checks not run");
  process.exit(0);
}
const fs = require("fs");
const path = require("path");
const PAGE = require("../lib/extensions").pageHtml(require("path").join(__dirname, ".."));


let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log("PASS: " + n); };
const bad = (n, got) => { fail++; console.log("FAIL: " + n + "\n      got " + JSON.stringify(got)); };
const check = (n, cond, got) => (cond ? ok(n) : bad(n, got));

const HTML = PAGE;

/* A models answer shaped exactly like GET /api/comfymodels, with the awkward
   cases in it on purpose: a file loose in a root (folder ""), a file in a
   subfolder, and a category with nothing in it. */
const MODELS = {
  ok: true, dir: "D:\\ComfyUI", dir_exists: true, yaml: null, source: "folders",
  cached: false, warnings: [],
  model_categories: ["checkpoints", "diffusers", "diffusion_models"],
  categories: {
    checkpoints: { roots: [], folders: ["", "SDXL"], files: [
      { name: "base.safetensors", folder: "", size: 1, root: "r", source: "models" },
      { name: "SDXL/jugg.safetensors", folder: "SDXL", size: 1, root: "r", source: "models" }] },
    diffusers: { roots: [], folders: [], files: [] },
    diffusion_models: { roots: [], folders: ["flux_klein_9B"], files: [
      { name: "flux_klein_9B/aisha.safetensors", folder: "flux_klein_9B", size: 1, root: "r", source: "models" }] },
    vae: { roots: [], folders: [""], files: [
      { name: "flux2-vae.safetensors", folder: "", size: 1, root: "r", source: "models" }] },
    text_encoders: { roots: [], folders: [""], files: [
      { name: "qwen_3_8b_fp8mixed.safetensors", folder: "", size: 1, root: "r", source: "models" }] },
    loras: { roots: [], folders: ["", "flux"], files: [
      { name: "detail.safetensors", folder: "", size: 1, root: "r", source: "models" },
      { name: "flux/grain.safetensors", folder: "flux", size: 1, root: "r", source: "models" }] },
    clip_vision: { roots: [], folders: [], files: [] },
    controlnet: { roots: [], folders: [], files: [] },
    style_models: { roots: [], folders: [], files: [] },
    upscale_models: { roots: [], folders: [], files: [] },
    embeddings: { roots: [], folders: [], files: [] },
  },
};
const STYLE = {
  id: "sty_1", name: "FLUX.2 9B", engine: "comfy", arch: "flux2klein9b",
  workflow: "comfy_workflows/img_flux2_9b_t2i_verified.json",
  model: "", vae: "", te: ["", ""], loras: [{ path: "flux/grain.safetensors", weight: 0.8 }],
  steps: 20, cfg: 5, width: 1024, height: 1024, negative: "", sampler: "euler",
};
// the REAL catalogue, not a hand-made one — a fixture that drifts from
// lib/imageArch.json would test a UI that no longer exists
const ARCHS = require(path.join(__dirname, "..", "lib", "styles")).catalogue();

const ROUTES = {
  // 2.159.0: the GLOBAL dock layout — a stored timeline height and a
  // minimized music dock must be APPLIED at boot
  "/api/dockers": () => ({ docks: { timelinedock: { height: 333 } } }),
  // 2.381.0: docker_status.json - THE layout record (jsdom has no record in the page head, so boot GETs it)
  "/api/docker-status": (opts) => opts && opts.method === "POST" ? JSON.parse(opts.body)
    : { version: 1, docks: {
        timelinedock: { state: "open", hidden: false, height: 333, width: 900, max_height: 0, max_width: 0, maximized: false },
        musicdock: { state: "open", hidden: false, height: 171, width: 900, max_height: 0, max_width: 0, maximized: false },
        chatdock: { state: "closed", hidden: false, height: 201, width: 900, max_height: 0, max_width: 0, maximized: false },
        promptdock: { state: "open", hidden: false, height: 121, width: 900, max_height: 121, max_width: 0, maximized: false },
        consoledock: { state: "closed", hidden: false, height: 191, width: 900, max_height: 0, max_width: 0, maximized: false },
        ldock: { state: "open", hidden: true, height: 900, width: 311, max_height: 0, max_width: 280, maximized: false },
        refs: { state: "open", hidden: false, height: 900, width: 260, max_height: 0, max_width: 0, maximized: false } } },
  "/api/jobs/history": () => ({ project: "p", history: [
    { id: "old1", state: "done", status: "done", mode: "t2va", prompt: "finished yesterday", width: 960, height: 544, output: "old.mp4" },
    { id: "old2", state: "pending", status: "interrupted", interrupted: true, mode: "image", prompt: "never ran", params: { mode: "image" } }] }),
  "/api/jobs/history/old2/resume": () => ({ id: "old2", status: "queued", params: { mode: "image", prompt: "never ran" } }),
  "/api/temploras": () => ({ image: [{ path: "saved_img.safetensors", weight: 0.6 }], video: [] }),
  "/api/temploras/image": () => ({ saved: true }), "/api/temploras/video": () => ({ saved: true }),
  "/api/videoarchs": () => ({ archs: [{ id: "minimax-h3", label: "MiniMax H3", modes: ["t2va", "ref2va", "fl2va"], phases_max: 1, te: [{ label: "Text encoder" }], vae: {}, defaults: {} },
                                      { id: "wan22", label: "Wan 2.2", modes: ["t2va", "ref2va", "fl2va"], phases_max: 2, te: [{ label: "TE" }], vae: {}, defaults: {} }] }),
  "/api/timelines": () => ({ active: "main", timelines: [{ name: "main", clips: 0 }, { name: "alt cut", clips: 3 }] }),
  "/api/timelines/alt%20cut": (opts) => opts && opts.method === "POST"
    ? { saved: true, name: "alt cut", active: "alt cut", timelines: [{ name: "alt cut", clips: 1 }, { name: "main", clips: 0 }] }
    : { name: "alt cut", tl: { video: [{ name: "x.mp4", start: 0, dur: 2, in: 0, out: 2, opacity: 1 }], audio: [], images: [], vlayers: [] } },
  // 2.103.0: the dock layout the settings file hands back at boot
  "/api/ui/layout": (opts) => opts && opts.method === "POST"
    ? { saved: true }
    : { docks: { timelinedock: { height: 233, state: "open" }, musicdock: { height: 171, state: "open" },
                 chatdock: { height: 201, state: "closed" }, promptdock: { height: 121, state: "open" },
                 consoledock: { height: 191, state: "closed" },
                 ldock: { width: 311, state: "closed" }, refs: { width: 260, state: "open" },
                 assets: { width: 260, state: "open" }, qdock: { width: 200, state: "open" },
                 rdock: { width: 300, state: "open" } } },
  "/api/comfymodels": () => MODELS,
  // 2.305.0: the ControlNet types + the preprocessor (input) files
  "/api/controlnet/preprocessors": () => ({ types: require(path.join(__dirname, "..", "lib", "controlnetTypes")).catalogue(),
    exts: [".pth", ".onnx"], exists: true, dirs: ["D:\\ComfyUI\\custom_nodes\\comfyui_controlnet_aux\\ckpts"],
    files: [{ name: "yzd-v/DWPose/dw-ll_ucoco_384.onnx", types: ["pose"] },
            { name: "depth-anything/depth_anything_v2_vitl.pth", types: ["depth"] },
            { name: "lllyasviel/Annotators/sk_model.pth", types: ["lineart"] }] }),
  "/api/imagearchs": () => ARCHS,
  "/api/timeline/edit": (opts) => {
    const b = JSON.parse((opts && opts.body) || "{}");
    if (b.op === "trim_head" || b.op === "trim_tail") {
      const clips = TEDIT.trimAt(b.clips, b.kind, b.op === "trim_head" ? "head" : "tail", b.at, { fps: b.fps });
      return { op: b.op, clips };
    }
    const clips = b.scope === "clip"
      ? TEDIT.applyClip(b.op, b.clips, b.kind, b.a, b.b, b.at, { ripple: b.ripple, fps: b.fps })
      : TEDIT.apply(b.op, b.clips, b.kind, b.a, b.b, { ripple: b.ripple, compact: b.compact, fps: b.fps });
    return { op: b.op, clips };
  },
  "/api/transitions": () => ({ default_duration: 0.5, min_duration: 0.1,
    max_duration: 3, transitions: [{ id: "fade", label: "Fade" }] }),
  "/api/styles": () => ({ styles: [STYLE], image_slots: { sty_1: 0 },
                          model_kinds: { sty_1: ["diffusion_models"] } }),
  "/api/comfy/status": () => ({ backend: "comfy", reachable: false, url: "http://127.0.0.1:8188",
                                dir: "D:\\ComfyUI", dir_exists: true, workflows: [] }),
  "/api/config": () => ({ engine: { backend: "comfy", comfy: { dir: "D:\\ComfyUI" } },
                          models: {}, defaults: {}, flags: {}, llm: {}, gpu: {}, hf: {},
                          tts: {}, asr: {} }),
  "/api/stats": () => ({ gpus: [], cpu: 0, ram: {} }),
  "/api/outputs": () => ({ files: [] }),
  "/api/passets": () => ({ images: [], video: [], sound: [] }),
  "/api/projects": () => ({ projects: [], current: "p" }),
};
/* Unlisted endpoints answer with an empty ARRAY-and-object hybrid, because the
   page polls several list endpoints during startup and `{}` makes .filter blow
   up before the Image tab is ever reached. This is a stub, not a server: the
   only thing it has to be faithful about is /api/comfymodels. */
const CALLS = [];
const near = (a, b, e = 1e-4) => Math.abs(a - b) < e;
const TEDIT = require(path.join(__dirname, "..", "lib", "timelineEdit"));
function route(url, opts) {
  const p = String(url).split("?")[0];
  for (const [k, v] of Object.entries(ROUTES)) if (p === k) return v(opts);
  if (p === "/api/jobs") return [];
  // Everything else gets an object carrying every list key the startup
  // painters reach for. This is a stub, not a server: the only endpoint it has
  // to be faithful about is /api/comfymodels.
  return { files: [], gpus: [], styles: [], projects: [], images: [], video: [],
           sound: [], archs: [], samplers: [], voices: [], models: [],
           categories: {}, warnings: [], log: [] };
}

(async () => {
  const errors = [];
  // The stubs MUST be installed before the inline script parses: it calls
  // init() -> loadConfig() -> fetch() during load, so anything installed after
  // construction is already too late.
  const dom = new JSDOM(HTML, {
    runScripts: "dangerously", pretendToBeVisual: true,
    url: "http://127.0.0.1:8311/",
    beforeParse(w) {
      /* 2.122.0: LOAD THE PAGE'S OWN MODULES. jsdom has no resource loader
         here, so every <script src="/static/..."> silently did not exist and
         the page was tested against globals that are real in a browser. That
         is an unfaithful harness in the worst direction: it hid a top-level
         use of GENQUEUE that works everywhere except here. They are evaluated
         in the order the page lists them, so a load-order mistake fails here
         too rather than only on Tim's machine. */
      /* jsdom has no ResizeObserver; the docks use it to keep their scroll
         rails in step. A no-op is the right stub: the rails are geometry the
         DOM suite does not assert on, and the alternative is not loading the
         modules at all, which is what hid the bug above. */
      if (!w.ResizeObserver) w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
      for (const m of (HTML.match(/<script src="\/static\/([^"]+)"/g) || [])) {
        // 2.242.0: the URLs are version-stamped (?v=) — strip the query
        // before the disk read; the stamp is cache truth, not a file name.
        const file = m.replace(/^<script src="\/static\//, "").replace(/"$/, "").replace(/\?.*$/, "");
        try { w.eval(fs.readFileSync(path.join(__dirname, "..", "static", file), "utf8")); }
        catch (e) { errors.push(`static/${file}: ${e.message}`); }
      }
      w.fetch = async (url, opts) => {
        CALLS.push({ url: String(url), body: opts && opts.body ? String(opts.body) : "" });
        return { ok: true, status: 200, json: async () => route(url, opts), text: async () => "" };
      };
      w.alert = () => {};
      w.confirm = () => true;
      w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      /* A REAL dialog fires a "close" event, and code legitimately hangs
         cleanup off it — the lightbox releases its <video> there. A stub that
         only flips .open would let that cleanup silently never run and the test
         would report a product bug that does not exist. */
      w.HTMLDialogElement.prototype.close = function () {
        this.open = false;
        this.dispatchEvent(new w.Event("close"));
      };
      w.HTMLCanvasElement.prototype.getContext = () => null;
      /* jsdom's play() returns undefined and logs "Not implemented"; the page
         (like every real browser) expects a promise. */
      w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
      w.HTMLMediaElement.prototype.pause = function () {};
      w.HTMLMediaElement.prototype.load = function () {};
      /* 2.223.14: imageeditdock's glue (mount.js) is pure function
         definitions with no load-time DOM access, so it loads HERE — before
         the inline script, the real page's order — and the boot's optional
         window.mountImageEditor call finds it, mounting at boot as always. */
      try { w.eval(fs.readFileSync(path.join(__dirname, "..", "ext", "imageeditdock", "mount.js"), "utf8")); }
      catch (e) { errors.push(`ext/imageeditdock/mount.js: ${e.message}`); }
      w.addEventListener("error", (e) => errors.push(String(e.message || e.error)));
      w.addEventListener("unhandledrejection", (e) => errors.push(String(e.reason)));
    },
  });
  const w = dom.window;
  const html = () => PAGE;
  /* 2.223.14: the four dockers' PRIVATE wiring moved into their ext folders
     (by instruction) — the tl-, music-, comfy-frame- and image-edit bindings
     this suite presses live there now. They run HERE, after construction:
     in the real page the panels precede the scripts, and running them in
     beforeParse would bind against an empty document. */
  for (const ef of ["timelinedock/timelinedock.js", "musicdock/musicdock.js",
                    "comfydock/comfydock.js"]) {
    try { w.eval(fs.readFileSync(path.join(__dirname, "..", "ext", ef), "utf8")); }
    catch (e) { errors.push(`ext/${ef}: ${e.message}`); }
  }
  // let the inline script finish its own startup work
  await new Promise((r) => setTimeout(r, 300));

  check("the page's inline script runs without throwing", errors.length === 0, errors);

  const $ = (id) => w.document.getElementById(id);
  check("the Settings dialog and the Image tab exist", !!$("stab-image") && !!$("s_stmodel"), null);

  // THE ACTUAL PAINT. This is the path a user takes: refresh the style list,
  // which loads the archs + the model lists and paints the form.
  if (typeof w.refreshStyles !== "function") {
    bad("refreshStyles is reachable from the page scope", typeof w.refreshStyles);
  } else {
    ok("refreshStyles is reachable from the page scope");
    await w.refreshStyles("sty_1");
    await new Promise((r) => setTimeout(r, 100));

    const opts = (sel) => Array.from((sel || {}).options || []).map((o) => o.value);
    const combo = (hostId) => {
      const host = $(hostId);
      return host ? {
        folder: host.querySelector("select.cmfolder"),
        file: host.querySelector("select.cmfile"),
      } : {};
    };

    // ---- the failure Tim reported, asserted directly ----
    const m = combo("s_stmodelcombo");
    check("the Model dropdown is built at all", !!m.file, Object.keys(m));
    check("the Model dropdown has models in it, not just the blank option",
      opts(m.file).filter(Boolean).length > 0, opts(m.file));
    check("the Model folder filter lists folders, not just All",
      opts(m.folder).filter((v) => v !== "\u0000all").length > 0, opts(m.folder));
    // narrowed to what the workflow's loader takes (model_kinds says
    // diffusion_models), so the checkpoint must NOT be offered here
    check("the Model dropdown is narrowed to the workflow's loader category",
      opts(m.file).includes("flux_klein_9B/aisha.safetensors")
      && !opts(m.file).includes("base.safetensors"), opts(m.file));

    const v = combo("s_stvaecombo");
    check("the VAE dropdown has the VAE in it",
      opts(v.file).includes("flux2-vae.safetensors"), opts(v.file));

    const t = combo("s_sttecombo0");
    check("the text-encoder dropdown has the encoder in it",
      opts(t.file).includes("qwen_3_8b_fp8mixed.safetensors"), opts(t.file));

    const lorabox = $("s_stloras");
    const lc = lorabox && lorabox.querySelector(".loracombo");
    const lfile = lc && lc.querySelector("select.cmfile");
    const lfold = lc && lc.querySelector("select.cmfolder");
    const realOpts = (sel) => Array.from((sel || {}).options || [])
      .filter((o) => o.value && !/hidden by the folder filter|not found/.test(o.textContent))
      .map((o) => o.value);
    /* REAL options only. The "keep the stored value" branch re-adds a saved
       entry that the filter hid, and that single option is what made this
       dropdown look healthy while Model/VAE/TE were empty — the NUL sentinel
       bug was half-invisible because of it. A check that cannot tell the
       fallback from a working list is not a check. */
    check("the LoRA row has a dropdown with the LoRAs in it",
      lfile && realOpts(lfile).includes("flux/grain.safetensors")
      && realOpts(lfile).includes("detail.safetensors"),
      lfile && Array.from(lfile.options).map((o) => [o.value, o.textContent]));
    check("the LoRA folder filter lists its subfolders",
      lfold && opts(lfold).filter((x) => x !== "\u0000all").length > 0,
      lfold && opts(lfold));
    check("the saved LoRA is the one selected",
      lfile && lfile.value === "flux/grain.safetensors", lfile && lfile.value);

    // ---- the folder filter must actually filter ----
    if (lfold && lfile) {
      const fluxOpt = Array.from(lfold.options).find((o) => /flux/.test(o.textContent));
      if (fluxOpt) {
        lfold.value = fluxOpt.value;
        lfold.dispatchEvent(new w.Event("change"));
        check("choosing a folder narrows the file list to it",
          opts(lfile).filter(Boolean).every((n) => n.startsWith("flux/")), opts(lfile));
      } else bad("the LoRA folder filter offers the flux subfolder", opts(lfold));
    }

    /* THE SENTINEL MUST SURVIVE innerHTML. This is the actual 2.76.1 bug in one
       assertion: "All folders" has to be selectable, because when it is not,
       every list filters down to a folder named "" and comes back empty. */
    check("the All-folders option is genuinely selected, not just present",
      m.folder.selectedIndex >= 0 && m.folder.value === m.folder.options[0].value,
      { idx: m.folder.selectedIndex, value: m.folder.value,
        first: m.folder.options[0] && m.folder.options[0].value });
    check("the sentinel survives a round trip through innerHTML",
      !/[\u0000\uFFFD]/.test(m.folder.options[0].value),
      m.folder.options[0].value);

    // ---- the status line must say where the list came from ----
    const status = $("s_cmstatus");
    check("the status line names the ComfyUI folder actually used",
      status && status.textContent.includes(MODELS.dir), status && status.textContent);
    check("the status line shows per-category counts",
      status && /vae 1/.test(status.textContent), status && status.textContent);

    /* WHY A FOLDER IS MISSING must be on screen. The model_kinds stub narrows
       this style to diffusion_models, so the checkpoint folders are hidden ON
       PURPOSE — and that is indistinguishable from a broken scanner unless it
       is said. This is the question Tim actually asked. */
    check("the status line explains the Model list being narrowed",
      status && /narrowed to diffusion_models/.test(status.textContent),
      status && status.textContent);
    check("the status line says whether extra_model_paths.yaml was read",
      status && /extra_model_paths/.test(status.textContent),
      status && status.textContent);
    check("there is a way to see every folder that was searched",
      !!$("s_cmdet"), null);

    /* ---- THE REFUSAL, exercised (2.77.2) ----
       Tim's case exactly: a CHECKPOINT saved into a style whose workflow loads
       with unet_name. "not a diffusion model" is true and nearly useless; the
       message has to say what the value actually IS, and be copyable. */
    /* The preflight only judges when ComfyUI ITSELF is the source — a
       folder-scan list disagreeing proves nothing. The fixture above is a
       folder scan, so flip it for this block and check that refusal to judge
       first, because that guard is the reason the whole feature is safe. */
    check("no verdict is given while the list is only a folder scan",
      (await w.comfyPreflight({ ...STYLE, model: "SDXL/jugg.safetensors" })) === null,
      "a folder-scan list disagreeing with ComfyUI proves nothing");
    MODELS.source = "comfyui";
    if (typeof w.comfyPreflight !== "function") {
      bad("comfyPreflight is reachable", typeof w.comfyPreflight);
    } else {
      const wrongKind = { ...STYLE, model: "SDXL/jugg.safetensors" };
      const res0 = await w.comfyPreflight(wrongKind);
      const msg = res0 && res0.text;
      check("a wrong-kind model is refused before the job is sent", !!msg, msg);
      // the refusal is ACTIONABLE, not just readable
      check("...and offers to link the model into the right folder",
        res0.fix && res0.fix.name === "SDXL/jugg.safetensors"
        && res0.fix.from === "checkpoints" && res0.fix.to === "diffusion_models",
        res0.fix);
      check("the refusal names what the value actually is",
        /is: a checkpoints/.test(msg || ""), msg);
      check("...and what the workflow's loader wants instead",
        /unet_name/.test(msg || ""), msg);
      check("...and lists the entries that would work",
        /flux_klein_9B\/aisha\.safetensors/.test(msg || ""), msg);

      // a separator/case-only difference is a different, one-click problem
      const misspelt = { ...STYLE, model: "flux_klein_9B\\aisha.safetensors" };
      const m2r = await w.comfyPreflight(misspelt);
      const m2 = m2r && m2r.text;
      check("a separator-only difference names the exact spelling to use",
        m2 && /ComfyUI spells it:\s+flux_klein_9B\/aisha\.safetensors/.test(m2), m2);
      // a spelling mistake is NOT something to fix by moving files
      check("...and does not offer to move anything for a spelling mistake",
        m2r.fix === null, m2r.fix);

      // a value ComfyUI does offer must NOT be refused
      const fine = { ...STYLE, model: "flux_klein_9B/aisha.safetensors" };
      check("a valid model is not refused", (await w.comfyPreflight(fine)) === null,
        await w.comfyPreflight(fine));
      // blank means "use the workflow's own" and is always fine
      check("a blank override is never refused",
        (await w.comfyPreflight({ ...STYLE, model: "" })) === null, null);

      // ---- and the refusal must be COPYABLE ----
      w.showRefusal("Test refusal", "line one\nline two");
      check("the refusal goes to the console, which is selectable",
        /line two/.test($("log").textContent), $("log").textContent.slice(-120));
      check("the refusal dialog shows the same text in a selectable block",
        $("pf_body") && /line two/.test($("pf_body").textContent), null);
      check("...with a Copy button", !!$("pf_copy"), null);
    }

    /* A NAME COMFYUI DOES NOT LIST, BUT THAT IS ON DISK. Tim picked a LoRA from
       the dropdown (built by the folder scan while ComfyUI was down), then
       ComfyUI started and refused it: ComfyUI caches its filename lists at
       startup, so anything added since is invisible to it. 433 on disk against
       430 in its list. Saying "it is not in any folder ComfyUI searches" was
       simply wrong, and sent him looking in the wrong place. */
    MODELS.disk = { loras: ["B010726.safetensors"] };
    {
      const r = await w.comfyPreflight({ ...STYLE,
        loras: [{ path: "B010726.safetensors", weight: 1 }] });
      check("a LoRA ComfyUI has not noticed is still refused", !!r && !!r.text, r);
      check("...but the reason given is the cache, not a missing file",
        /has not noticed it/.test(r.text) && /RESTART COMFYUI/.test(r.text), r.text);
      check("...and it does not tell you to go hunting for the file",
        !/not on disk in any folder/.test(r.text), r.text);
      check("...and offers no file move, because nothing needs moving",
        r.fix === null, r.fix);
    }
    {
      // a name that really is absent must keep the original advice
      const r = await w.comfyPreflight({ ...STYLE,
        loras: [{ path: "ghost.safetensors", weight: 1 }] });
      check("a genuinely absent name still says so",
        r && /not on disk in any folder/.test(r.text), r && r.text);
    }
    delete MODELS.disk;

    MODELS.source = "folders";      // leave the fixture as the later checks expect

    /* ---- SAVING A STYLE MUST NOT LOCK THE TAB (2.80.1) ----
       Tim: "the image tab locks up after save style button is pressed". The
       save handler awaits refreshStyles(), which awaits loadComfyModels(), and
       then paints. If any of that never settles the dialog is dead. Run the
       real handler and require it to finish. */
    ROUTES["/api/styles"] = () => ({ styles: [STYLE], image_slots: { sty_1: 0 },
                                     model_kinds: { sty_1: ["diffusion_models"] },
                                     style: STYLE, file: "x.json", missing: [] });
    {
      const done = await Promise.race([
        (async () => { await $("s_stsave").onclick(); return "finished"; })(),
        new Promise((r) => setTimeout(() => r("HUNG"), 4000)),
      ]);
      check("Save style completes instead of hanging the Image tab",
        done === "finished", done);
      /* "STILL EXISTS" IS NOT "STILL WORKS". The first version of this check
         only asserted the <select> was present, and it passed while Tim's
         dropdowns were dead. Assert the whole chain: options present, and
         choosing one reaches the hidden input the save path reads. */
      const opts2 = (sel) => Array.from((sel || {}).options || []).map(o => o.value);
      const after = $("s_stmodelcombo").querySelector("select.cmfile");
      check("...and the Model dropdown still has its options after a save",
        opts2(after).filter(Boolean).length > 0, opts2(after));
      const foldAfter = $("s_stmodelcombo").querySelector("select.cmfolder");
      check("...and the folder filter is still populated and selected",
        opts2(foldAfter).length > 1 && foldAfter.selectedIndex >= 0,
        { opts: opts2(foldAfter), idx: foldAfter && foldAfter.selectedIndex });
      after.value = "flux_klein_9B/aisha.safetensors";
      after.dispatchEvent(new w.Event("change"));
      check("...and choosing a model still writes through to the saved value",
        $("s_stmodel").value === "flux_klein_9B/aisha.safetensors", $("s_stmodel").value);
      const laf = $("s_stloras").querySelector(".loracombo select.cmfile");
      check("...and the LoRA dropdown survives the repaint too",
        laf && opts2(laf).filter(Boolean).length > 0, laf && opts2(laf));
    }

    /* SWITCHING BETWEEN DIFFERENT STYLES, which is what actually happens. The
       fixture had one style, so "change style" repainted the SAME shape every
       time and could never hit a field that only exists on one of them. Tim has
       four, including an image-EDIT style with a different workflow and no
       width/height. */
    {
      const STYLE2 = { id: "sty_2", name: "FLUX.2 9B edit", engine: "comfy",
        arch: "flux2klein9b",
        workflow: "comfy_workflows/img_flux2_9b_edit_verified.json",
        model: "", vae: "", te: null, loras: [], steps: 20, cfg: 5,
        negative: "", sampler: "euler" };            // te:null and no size, on purpose
      const STYLE3 = { id: "sty_3", name: "sd-cli look", engine: "sdcli",
        arch: "flux", model: "models/x.gguf", vae: "", te: [], loras: [],
        steps: 8, cfg: 1, width: 512, height: 512 };
      ROUTES["/api/styles"] = () => ({
        styles: [STYLE, STYLE2, STYLE3],
        image_slots: { sty_1: 0, sty_2: 2, sty_3: 0 },
        model_kinds: { sty_1: ["diffusion_models"], sty_2: ["diffusion_models"], sty_3: [] },
        style: STYLE, file: "x.json", missing: [] });
      await w.refreshStyles("sty_1");
      const opts4 = (sel) => Array.from((sel || {}).options || []).map(o => o.value);
      const live = () => {
        const m = $("s_stmodelcombo").querySelector("select.cmfile");
        return m && opts4(m).filter(Boolean).length > 0;
      };
      for (const id of ["sty_2", "sty_1", "sty_3", "sty_1", "sty_2"]) {
        const before = errors.length;
        $("s_stylelist").value = id;
        $("s_stylelist").dispatchEvent(new w.Event("change"));
        await new Promise((r) => setTimeout(r, 60));
        check(`switching to ${id} throws nothing`, errors.length === before,
          errors.slice(before));
        const comfy = $("s_stengine").value === "comfy";
        check(`switching to ${id} leaves the form usable`,
          comfy ? live() : $("s_stmodel").style.display !== "none",
          { comfy, engine: $("s_stengine").value });
      }
      ROUTES["/api/styles"] = () => ({ styles: [STYLE], image_slots: { sty_1: 0 },
        model_kinds: { sty_1: ["diffusion_models"] }, style: STYLE,
        file: "x.json", missing: [] });
      await w.refreshStyles("sty_1");
    }
    {
      $("s_stylelist").value = "sty_1";
      $("s_stylelist").dispatchEvent(new w.Event("change"));
      await new Promise((r) => setTimeout(r, 60));
      const opts3 = (sel) => Array.from((sel || {}).options || []).map(o => o.value);
      const m3 = $("s_stmodelcombo").querySelector("select.cmfile");
      check("switching style leaves the Model dropdown working",
        m3 && opts3(m3).filter(Boolean).length > 0, m3 && opts3(m3));
      const v3 = $("s_stvaecombo").querySelector("select.cmfile");
      check("...and the VAE dropdown", v3 && opts3(v3).filter(Boolean).length > 0,
        v3 && opts3(v3));
      const t3 = $("s_sttecombo0") && $("s_sttecombo0").querySelector("select.cmfile");
      check("...and the text-encoder dropdown",
        t3 && opts3(t3).filter(Boolean).length > 0, t3 && opts3(t3));
    }

    // ---- an sd-cli style shows plain paths, not ComfyUI dropdowns ----
    $("s_stengine").value = "sdcli";
    $("s_stengine").dispatchEvent(new w.Event("change"));
    await new Promise((r) => setTimeout(r, 50));
    check("switching to sd-cli shows the plain path field back",
      $("s_stmodel").style.display !== "none"
      && $("s_stmodelcombo").style.display === "none",
      { input: $("s_stmodel").style.display, combo: $("s_stmodelcombo").style.display });
    check("and hides the ComfyUI launch bar",
      $("s_cmbar").style.display === "none", $("s_cmbar").style.display);
  }

  /* ================= MEDIA LIGHTBOX (2.80.0) =================
     Built by hand rather than by painting a dock, so the checks are about the
     BEHAVIOUR — sliding, zooming, panning, releasing media — not about which
     dock the thumbnails came from. */
  {
    const d = w.document;
    const host = d.createElement("div");
    host.setAttribute("data-lb-group", "");
    host.innerHTML =
      `<div id="t1" data-lb-url="/outputs/a.png" data-lb-kind="image" data-lb-name="a.png"></div>` +
      `<div id="t2" data-lb-url="/outputs/b.webm" data-lb-kind="video" data-lb-name="b.webm">` +
      `<button class="gdel">x</button></div>` +
      `<div id="t3" data-lb-url="/passets/sound/c.wav" data-lb-kind="audio" data-lb-name="c.wav"></div>`;
    d.body.appendChild(host);

    d.getElementById("t2").click();
    check("clicking a thumbnail opens the lightbox", $("lb").open === true, $("lb").open);
    check("...on the one that was clicked, not the first in the list",
      $("lb_name").textContent === "b.webm", $("lb_name").textContent);
    check("...and says where you are in the set",
      $("lb_pos").textContent === "2 / 3", $("lb_pos").textContent);
    check("a video gets a real <video> element",
      !!$("lb_wrap").querySelector("video"), $("lb_wrap").innerHTML.slice(0, 120));

    // sliding
    w.lbGo(1);
    check("next slides to the following item", $("lb_name").textContent === "c.wav", $("lb_name").textContent);
    check("audio gets an <audio> element, not a video",
      !!$("lb_wrap").querySelector("audio") && !$("lb_wrap").querySelector("video"),
      $("lb_wrap").innerHTML.slice(0, 160));
    // zoom controls are meaningless for a sound file and must not be offered
    check("zoom is hidden for audio", $("lb_in").style.display === "none", $("lb_in").style.display);
    w.lbGo(1);
    check("it wraps round to the first item", $("lb_name").textContent === "a.png", $("lb_name").textContent);
    check("an image gets an <img>", !!$("lb_wrap").querySelector("img"), null);
    check("zoom is offered again for an image", $("lb_in").style.display !== "none", null);
    w.lbGo(-1);
    check("previous wraps backwards too", $("lb_name").textContent === "c.wav", $("lb_name").textContent);

    // zoom + pan, on an image
    w.lbOpen([{ url: "/outputs/a.png", kind: "image", name: "a.png" }], 0);
    check("zoom starts at 100%", $("lb_zoom").textContent === "100%", $("lb_zoom").textContent);
    $("lb_in").click();
    check("zoom in changes the scale", $("lb_zoom").textContent !== "100%", $("lb_zoom").textContent);
    const img = $("lb_wrap").querySelector("img");
    check("the zoom is applied as a transform on the media",
      /scale\(/.test(img.style.transform), img.style.transform);
    check("the stage is marked zoomed, which is what enables panning",
      $("lb_wrap").classList.contains("zoomed"), $("lb_wrap").className);
    $("lb_fit").click();
    check("Fit returns to 100% and re-centres",
      $("lb_zoom").textContent === "100%" && !/scale\(([^1]|1[^)])/.test(img.style.transform),
      [$("lb_zoom").textContent, img.style.transform]);
    check("...and panning is disabled again at 100%",
      !$("lb_wrap").classList.contains("zoomed"), $("lb_wrap").className);
    // zooming far out then back must not drift off centre
    for (let i = 0; i < 4; i++) $("lb_out").click();
    for (let i = 0; i < 4; i++) $("lb_in").click();
    check("zooming out and back returns to 100%",
      $("lb_zoom").textContent === "100%", $("lb_zoom").textContent);

    /* MEDIA MUST BE RELEASED. A <video> left holding a src keeps buffering and,
       on Windows, can keep a deleted file locked. */
    w.lbOpen([{ url: "/outputs/b.webm", kind: "video", name: "b.webm" },
              { url: "/outputs/a.png", kind: "image", name: "a.png" }], 0);
    const vid = $("lb_wrap").querySelector("video");
    let paused = false;
    vid.pause = () => { paused = true; };
    w.lbGo(1);
    check("navigating away pauses the video it was playing", paused, null);
    w.lbOpen([{ url: "/outputs/b.webm", kind: "video", name: "b.webm" }], 0);
    let paused2 = false;
    $("lb_wrap").querySelector("video").pause = () => { paused2 = true; };
    $("lb").close();
    check("closing releases the media too", paused2, null);

    /* ---- filmstrip + controls under the picture (2.81.0) ---- */
    w.lbOpen([{ url: "/outputs/a.png", kind: "image", name: "a.png" },
              { url: "/outputs/b.webm", kind: "video", name: "b.webm" },
              { url: "/passets/sound/c.wav", kind: "audio", name: "c.wav" }], 0);
    check("the filmstrip has a frame per item",
      $("lb_film").children.length === 3, $("lb_film").children.length);
    check("the current frame is marked",
      $("lb_film").children[0].classList.contains("cur"), $("lb_film").children[0].className);
    check("a video frame loads metadata only, not the whole clip",
      $("lb_film").children[1].querySelector("video").getAttribute("preload") === "metadata",
      $("lb_film").children[1].innerHTML);
    check("an audio item gets a placeholder rather than a broken <img>",
      $("lb_film").children[2].classList.contains("snd"), $("lb_film").children[2].className);
    $("lb_film").children[2].click();
    check("clicking a frame jumps to it",
      $("lb_name").textContent === "c.wav", $("lb_name").textContent);
    check("...and the highlight follows",
      $("lb_film").children[2].classList.contains("cur")
      && !$("lb_film").children[0].classList.contains("cur"), null);
    /* The strip must NOT be rebuilt on every slide: that would restart each
       video's metadata load and throw away the horizontal scroll position, so
       paging through a folder would jitter. */
    const firstFrame = $("lb_film").children[0];
    w.lbGo(1);
    check("paging does not rebuild the filmstrip",
      $("lb_film").children[0] === firstFrame, "the strip was recreated");
    w.lbOpen([{ url: "/outputs/only.png", kind: "image", name: "only.png" }], 0);
    check("a single item hides the strip entirely",
      $("lb_film").style.display === "none", $("lb_film").style.display);

    // controls live UNDER the picture now, and both prev/next pairs work
    check("the control bar sits below the stage",
      !!$("lb_pv") && !!$("lb_nx") && !!$("lb_zoom").closest(".lbbar"),
      "zoom/nav must be in .lbbar, not the title strip");
    w.lbOpen([{ url: "/outputs/a.png", kind: "image", name: "a.png" },
              { url: "/outputs/b.webm", kind: "video", name: "b.webm" }], 0);
    $("lb_nx").click();
    check("the Next button under the picture works",
      $("lb_name").textContent === "b.webm", $("lb_name").textContent);
    $("lb_pv").click();
    check("...and Prev", $("lb_name").textContent === "a.png", $("lb_name").textContent);
    $("lb").close();

    /* NOTHING MAY LEAVE THE APP BEHIND YOUR BACK. A gallery still used to fire
       window.open as well as the lightbox, so one click gave you the dialog AND
       an Edge window — and in Electron that leaves the app entirely. */
    {
      const src = PAGE;
      /* 2.223.14: the ComfyUI dock's opener moved with its docker (ext-owned
         wiring) — the pin counts BOTH homes so an accidental third site in
         either still fails here. */
      const opens = (src.match(/window\.open\(/g) || []).length
        + (fs.readFileSync(path.join(__dirname, "..", "ext", "comfydock", "comfydock.js"), "utf8").match(/window\.open\(/g) || []).length;
      /* 2.120.0: a SECOND explicit one arrived - the ComfyUI dock's button,
         which opens ComfyUI in a real browser window. The count is still
         pinned and both ids are named, so an accidental third still fails. */
      check("window.open survives only on the two explicit Open-externally buttons",
        opens === 2 && /id="lb_open"/.test(src) && /id="cfOpen"/.test(src), `${opens} window.open calls`);
    }

    // the controls inside a thumbnail must keep doing their own job
    $("lb").close();
    d.getElementById("t2").querySelector(".gdel").click();
    check("a delete button inside a thumbnail does not open the lightbox",
      $("lb").open === false, $("lb").open);

    /* THE TIMELINE PREVIEW IS NOT THE LIGHTBOX. #player belongs to the timeline;
       a gallery click used to hijack it, so the preview stopped matching what a
       compile would produce. */
    check("the gallery no longer sends clips to the timeline preview",
      !/v\.onclick = \(\) => playVideo/.test(
        PAGE),
      "gallery tiles must open the lightbox, not #player");
  }

  /* ===== the docks, 2.90.1 — EXECUTED =====================================
     Three instructions in one breath: a Music dock under the timeline, a
     console that starts minimized and never opens itself, and a maximize
     toggle on every dock. Each is a thing that only shows up when the page
     runs, so each is run here. */
  {
    const d = w.document;
    const has = (id, cls) => $(id) && $(id).classList.contains(cls);
    // ---- the console starts minimized and nothing opens it but the user
    check("the console dock starts collapsed on every load",
      has("consoledock", "collapsed"), $("consoledock") && $("consoledock").className);
    // 2.386.0 (Tim: "if a docker is visible, either open or closed, highlight the toggle button in the statusbar")
    check("...and its status-bar button is LIT (collapsed is still on screen - only hiding darkens it)", has("tC", "on"), null);
    const before = errors.length;
    w.selectJob("nope");
    await new Promise((r) => setTimeout(r, 80));
    check("selecting a job no longer opens the console",
      has("consoledock", "collapsed"), $("consoledock").className);
    w.followComfy();
    await new Promise((r) => setTimeout(r, 80));
    check("following the ComfyUI log no longer opens the console either",
      has("consoledock", "collapsed"), $("consoledock").className);
    check("...and neither path threw", errors.length === before, errors.slice(before));
    w.toggleCollapse("consoledock");
    check("the user can still open it", !has("consoledock", "collapsed") && has("tC", "on"), null);
    w.toggleCollapse("consoledock");

    // ---- the Preview dock (2.148.0, by instruction) ----------------------
    check("the viewer sits inside a Preview bdock at the TOP of the column",
      !!$("previewdock") && $("previewdock").classList.contains("bdock")
      && $("previewdock").contains($("viewerpane")) && $("previewdock").contains($("player")),
      null);
    check("...first in the column, above the timeline",
      [...d.querySelectorAll("#maincol .bdock")].map((x) => x.id)[0] === "previewdock",
      [...d.querySelectorAll("#maincol .bdock")].map((x) => x.id));
    check("...with a lit status-bar toggle (starts open)",
      !!$("tPv") && has("tPv", "on") && !has("previewdock", "collapsed"), null);
    w.toggleCollapse("previewdock");
    check("...that collapses to a header - its button stays lit (on screen), 2.386.0",
      has("previewdock", "collapsed") && has("tPv", "on")
      && /▸ Preview/.test($("previewdock").querySelector(".bhead").textContent),
      $("previewdock").querySelector(".bhead").textContent);
    w.toggleCollapse("previewdock");
    check("...and reopens with its children intact (the header rewrite keeps them)",
      !has("previewdock", "collapsed") && !!$("previewdock").querySelector(".maxbtn")
      && $("previewdock").contains($("fsBtn")), null);
    // ---- LLM tokens (2.148.0) --------------------------------------------
    // 2.393.0: LLM tokens floats in a docker of its own (static/secfloat.js, L)
    check("the LLM tokens window shows the token estimate and budget slider",
      !!$("tokCount") && !!$("tokMax") && !!$("tokMaxV")
      && ($("ldock").contains($("tokCount")) || (!!$("sf-llmtok") && $("sf-llmtok").contains($("tokCount")))), null);
    $("prompt").value = "twelve chars.";   // 13 chars → ≈4 tokens
    $("prompt").dispatchEvent(new w.Event("input", { bubbles: true }));
    check("typing in the Prompt box updates the ≈ token estimate live",
      /≈4 in prompt/.test($("tokCount").textContent), $("tokCount").textContent);
    $("prompt").value = "";
    $("prompt").dispatchEvent(new w.Event("input", { bubbles: true }));

    // ---- the Music dock sits under the timeline, above the chat
    check("there is a Music dock", !!$("musicdock") && $("musicdock").classList.contains("bdock"), null);
    const order = [...d.querySelectorAll("#maincol .bdock")].map((x) => x.id);
    check("...below the timeline dock (2.108.0 put the Image editor under it; "
        + "2.142.2 moved the Video docker between them, by instruction: "
        + "\"the video docker should be under the timeline docker\")",
      order.indexOf("videodock") === order.indexOf("timelinedock") + 1
      && order.indexOf("imageeditdock") === order.indexOf("videodock") + 1
      && order.indexOf("comfydock") === order.indexOf("imageeditdock") + 1
      && order.indexOf("musicdock") === order.indexOf("comfydock") + 1, order);
    check("...with its own splitter and height variable",
      !!d.querySelector('.hsplit[data-hresize="mh"]') && /--mh:/.test(html()), null);
    check("...a status-bar toggle, lit because it starts open",
      !!$("tMu") && has("tMu", "on") && !has("musicdock", "collapsed"), null);
    w.toggleCollapse("musicdock");
    check("...that collapses - its button stays lit (on screen), 2.386.0",
      has("musicdock", "collapsed") && has("tMu", "on") && /▸ Music/.test($("musicdock").querySelector(".bhead").textContent),
      $("musicdock").querySelector(".bhead").textContent);
    w.toggleCollapse("musicdock");
    for (const id of ["muLyrics", "muCaption", "musicSel", "muDur", "muBatch", "muSeed", "goMusic", "muStatus"]) {
      check(`the Music dock has #${id}`, !!$(id) && $("musicdock").contains($(id)), null);
    }
    check("the prompt dock no longer carries the music controls",
      !$("promptdock").contains($("musicSel")) && !$("promptdock").contains($("goMusic")), null);

    // ---- Generate Music sends what the dock holds
    w.ensureComfyReady = async () => true;       // ComfyUI is not the thing under test here
    w.comfyPreflight = async () => null;
    ROUTES["/api/genmusic"] = () => ({ id: "job_1", params: { seed: 42 } });
    ROUTES["/api/jobs/job_1"] = () => ({ status: "done" });
    await w.refreshMusicStyles("sty_1");
    $("muLyrics").value = "";
    $("prompt").value = "";
    check("with no lyrics anywhere, nothing is sent and the dock says why",
      (await w.startMusicJob()) === null && /lyrics/.test($("muStatus").textContent),
      $("muStatus").textContent);
    $("muLyrics").value = "[verse]\nneon rain";
    $("muCaption").value = "Global Metadata: Genre: polka.";
    $("muDur").value = "7";
    $("muBatch").value = "9";
    $("muSeed").value = "42";
    CALLS.length = 0;
    const jid = await w.startMusicJob();
    const post = CALLS.find((c) => c.url === "/api/genmusic");
    const body = post ? JSON.parse(post.body) : null;
    check("Generate Music posts to /api/genmusic", !!post && jid === "job_1", CALLS.map((c) => c.url));
    check("...the lyrics box is the prompt", body && body.prompt === "[verse]\nneon rain", body);
    check("...the caption override, length and seed go along", body && body.caption === "Global Metadata: Genre: polka."
      && body.max_duration === 7 && body.seed === 42, body);
    check("...and the batch is capped at 4 in the page too", body && body.batch === 4, body);
    check("...and the dock reports the job and its seed", /job_1/.test($("muStatus").textContent)
      && /42/.test($("muStatus").textContent), $("muStatus").textContent);
    check("...without opening the console", has("consoledock", "collapsed"), null);
    $("muCaption").value = ""; $("muDur").value = ""; $("muSeed").value = ""; $("muBatch").value = "1";
    CALLS.length = 0;
    await w.startMusicJob();
    const body2 = JSON.parse((CALLS.find((c) => c.url === "/api/genmusic") || {}).body || "{}");
    check("blank fields are NOT sent, so the style's own values apply",
      !("caption" in body2) && !("max_duration" in body2) && !("seed" in body2) && body2.batch === 1, body2);
    $("muLyrics").value = "";
    $("prompt").value = "from the prompt box";
    CALLS.length = 0;
    await w.startMusicJob();
    const body3 = JSON.parse((CALLS.find((c) => c.url === "/api/genmusic") || {}).body || "{}");
    check("an empty lyrics box falls back to the prompt box (the mode dropdown's 🎶 path)",
      body3.prompt === "from the prompt box", body3);
    await new Promise((r) => setTimeout(r, 1400));   // let the awaitJob tick land
    check("...and the status line follows the job to done",
      /done/.test($("muStatus").textContent), $("muStatus").textContent);

    /* THE AUDIO TAB IS PAINTED, WITH A DURATION. paintAudioTiles shipped in
       2.90.0 calling fmtT(), a helper that never existed — a ReferenceError on
       the first real song, an empty Audio tab, and no test noticed because
       none ever painted a tile with a duration. This one does. */
    {
      const gerr = errors.length;
      w.paintAudioTiles($("gallery"), [{ name: "song.mp3", size: 123456, mtime: 1700000000,
                                         duration: 83.4, where: "output" }]);
      check("an audio tile paints without throwing (fmtT, 2.91.1)",
        errors.length === gerr, errors.slice(gerr));
      const tile = $("gallery").querySelector('.thumb[data-name="song.mp3"]');
      check("...with a player, a delete button and the duration in the title",
        tile && !!tile.querySelector("audio") && !!tile.querySelector(".gdel")
        && /1:23/.test(tile.querySelector(".gname").title),
        tile && tile.querySelector(".gname") && tile.querySelector(".gname").title);
      /* 2.223.15: the dialog only appears when Confirm delete is ON — the
         shipped default is OFF (silent move to the recycle bin). Both sides
         of the flag are pressed here. */
      w.eval("cfg.ui = Object.assign({}, cfg.ui, { confirm_delete: true })");
      tile.querySelector(".gdel").click();
      check("with Confirm delete ON, delete asks through the in-page dialog, not the native confirm",
        $("notedlg").open && /song\.mp3/.test($("note_body").textContent), null);
      $("note_cancel").click();
      w.eval("cfg.ui.confirm_delete = false");
      const delsBefore = CALLS.filter((c) => c.url.includes("/api/outputs/")).length;
      tile.querySelector(".gdel").click();
      await new Promise((r) => setTimeout(r, 30));
      check("with it OFF (the default), no dialog — the DELETE fires straight away and the server recycles",
        !$("notedlg").open
        && CALLS.filter((c) => c.url.includes("/api/outputs/")).length === delsBefore + 1, null);
      $("gallery").innerHTML = "";
    }

    // ---- maximize (2.91.1: bottom docks only, vertical, siblings minimize)
    for (const id of ["timelinedock", "musicdock", "chatdock", "promptdock", "consoledock"]) {
      check(`#${id} has a maximize button in its header`,
        !!$(id) && !!$(id).querySelector(`.maxbtn[data-max="${id}"]`), null);
    }
    for (const id of ["ldock", "refsdock", "assetsdock", "qdock", "rdock"]) {
      check(`#${id} (a vertical dock) has NO maximize button`,
        !!$(id) && !$(id).querySelector(".maxbtn"), null);
    }
    check("toggleMax refuses a vertical dock outright",
      (() => { w.toggleMax("rdock"); return !$("rdock").classList.contains("maxed")
               && !$("maincol").classList.contains("has-max"); })(), $("rdock").className);
    // remember the user's own collapsed choices before maximizing
    if ($("chatdock").classList.contains("collapsed")) w.toggleCollapse("chatdock"); // chat OPEN
    if (!$("consoledock").classList.contains("collapsed")) w.toggleCollapse("consoledock"); // console SHUT
    w.toggleMax("timelinedock");
    check("maximizing marks the dock and the main column",
      has("timelinedock", "maxed") && $("maincol").classList.contains("has-max"), null);
    // 2.381.0 (Tim: "if other dockers are open they will expand to their height or max-height (the lesser value)")
    check("2.381.0: ...the other OPEN docks stay open at their own height - nothing is minimized (the prompt dock too)",
      !d.querySelector(".minned") && !has("musicdock", "collapsed") && !has("chatdock", "collapsed") && !has("promptdock", "collapsed"),
      [...w.document.querySelectorAll("#maincol .bdock")].map((x) => [x.id, x.className]));
    check("...a dock the USER had collapsed stays collapsed",
      has("consoledock", "collapsed") && !has("consoledock", "minned"), $("consoledock").className);
    check("...and the button now offers Restore",
      /Restore/.test($("timelinedock").querySelector(".maxbtn").title), $("timelinedock").querySelector(".maxbtn").title);
    w.toggleMax("musicdock");
    check("maximizing a second dock swaps: the first is an ordinary open dock again (its own height)",
      has("musicdock", "maxed") && !has("timelinedock", "maxed") && !has("timelinedock", "minned") && !has("timelinedock", "collapsed"),
      [$("musicdock").className, $("timelinedock").className]);
    check("...and the user's console stays collapsed through the swap",
      has("consoledock", "collapsed"), $("consoledock").className);
    d.querySelectorAll("dialog[open]").forEach((x) => x.close());
    d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    check("Escape restores everything: no maxed, no minned, chat back open, console still shut",
      !d.querySelector(".maxed") && !d.querySelector(".minned")
      && !$("maincol").classList.contains("has-max")
      && !has("chatdock", "collapsed") && has("consoledock", "collapsed"),
      [...w.document.querySelectorAll("#maincol .bdock")].map((x) => x.className));
    w.toggleMax("musicdock");
    $("pf_body").closest("dialog").showModal();
    d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    check("...but while a dialog is open, Escape belongs to the dialog", has("musicdock", "maxed"), null);
    $("pf_body").closest("dialog").close();
    check("opening a CLOSED dock beside the maximize keeps the maximize — the maxed dock just shrinks (2.92.1)",
      (() => { if (!has("chatdock", "collapsed")) w.toggleCollapse("chatdock");   // the user closes chat...
               w.toggleCollapse("chatdock");                                     // ...and opens it beside the maximize
               return has("musicdock", "maxed") && $("maincol").classList.contains("has-max")
                 && !has("chatdock", "minned") && !has("chatdock", "collapsed"); })(),
      [$("musicdock").className, $("chatdock").className]);
    check("...the status-bar toggle now HIDES the dock entirely (2.198.0) and leaves the maximize alone",
      (() => { $("tT").onclick();              // statusbar = full hide now
               const hid = has("timelinedock", "dockgone") && !has("tT", "on")
                 && has("musicdock", "maxed");
               $("tT").onclick();              // and back, lit again
               return hid && !has("timelinedock", "dockgone") && has("tT", "on"); })(),
      $("timelinedock").className);
    check("2.381.0: ...clicking its header again is the user's own close - the maximize stays",
      (() => { w.toggleCollapse("chatdock");
               return has("chatdock", "collapsed") && !has("chatdock", "minned")
                 && has("musicdock", "maxed"); })(), $("chatdock").className);
    check("...and Escape restores: nothing maximized, the docks as the user left them",
      (() => { d.querySelectorAll("dialog[open]").forEach((x) => x.close());
               d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
               const ok = !d.querySelector(".maxed") && !d.querySelector(".minned")
                 && !$("maincol").classList.contains("has-max")
                 && has("chatdock", "collapsed") && !has("timelinedock", "collapsed");
               w.toggleCollapse("chatdock");
               return ok; })(),
      [...d.querySelectorAll("#maincol .bdock")].map((x) => [x.id, x.className]));
    w.toggleMax("musicdock");   // re-establish for the collapse-the-maxed check below
    w.toggleCollapse("consoledock"); // console open again for the next block
    if (has("consoledock", "collapsed")) w.toggleCollapse("consoledock");
    w.toggleMax("consoledock");
    check("maximizing a collapsed-at-the-time dock opens it",
      (() => { w.toggleMax("consoledock", false); w.toggleCollapse("consoledock");
               w.toggleMax("consoledock");
               return has("consoledock", "maxed") && !has("consoledock", "collapsed"); })(),
      $("consoledock").className);
    w.toggleCollapse("consoledock");
    check("collapsing a maximized dock restores the layout first, then collapses it",
      !has("consoledock", "maxed") && has("consoledock", "collapsed")
      && !d.querySelector(".minned") && !$("maincol").classList.contains("has-max"),
      $("consoledock").className);
    // the header button must not collapse the dock it sits in
    const tl = $("timelinedock");
    if (tl.classList.contains("collapsed")) w.toggleCollapse("timelinedock");
    tl.querySelector(".maxbtn").click();
    check("clicking the maximize button does not collapse the dock",
      tl.classList.contains("maxed") && !tl.classList.contains("collapsed"), tl.className);
    tl.querySelector(".maxbtn").click();
    check("...and clicking it again restores", !tl.classList.contains("maxed") && !d.querySelector(".minned"), tl.className);
    check("a chat header button no longer collapses the chat dock",
      (() => { const c = $("chatdock"); if (c.classList.contains("collapsed")) w.toggleCollapse("chatdock");
               $("chatNew").click(); return !c.classList.contains("collapsed"); })(), $("chatdock").className);
    check("nothing in the dock work threw", errors.length === before, errors.slice(before));
  }

  /* ===== native alert()/confirm() are dead (2.91.1) — EXECUTED =============
     In Electron the native dialog steals the window's keyboard focus and every
     input LOOKS LOCKED afterwards ("all the inputs are locking up"). The page
     now rebinds alert() to an in-page dialog and every confirm() site awaits
     appConfirm(). jsdom cannot show the focus theft, but it can prove the
     natives are no longer what runs. */
  {
    const d = w.document;
    let nativeAlerts = 0;
    // the test's own beforeParse stub was the "native" alert the page captured;
    // re-point the CAPTURABLE part: any call reaching it now is a bug
    check("window.alert has been rebound away from the native call",
      String(w.alert).includes("appNote"), String(w.alert).slice(0, 60));
    w.alert("hello from a refusal path");
    check("an alert opens the in-page dialog with the message, selectable",
      $("notedlg").open && /hello from a refusal path/.test($("note_body").textContent),
      $("note_body").textContent);
    check("...with its Cancel hidden — an alert has one button",
      $("note_cancel").classList.contains("hidden"), null);
    $("note_ok").click();
    check("OK closes it", !$("notedlg").open, null);
    const pending = w.appConfirm("Clear the whole timeline?");
    check("a confirm shows both buttons", $("notedlg").open && !$("note_cancel").classList.contains("hidden"), null);
    $("note_cancel").click();
    check("Cancel answers false", (await pending) === false, null);
    const pending2 = w.appConfirm("again?");
    $("note_ok").click();
    check("OK answers true", (await pending2) === true, null);
    const pending3 = w.appConfirm("esc?");
    $("notedlg").close();
    check("Esc (dialog close) answers false", (await pending3) === false, null);
    check("no call site uses the native confirm any more",
      nativeAlerts === 0, null);
    // the timeline-clear button actually awaits the dialog now
    const clipsBefore = "guarded";
    const p1 = $("tlClear").onclick();
    check("Clear-timeline asks through the in-page dialog", $("notedlg").open, null);
    $("note_cancel").click();
    await p1;
    check("...and Cancel leaves the timeline alone", clipsBefore === "guarded", null);
  }

  /* ===== the chat knows the selection; a block fills the Music dock (2.92.0) */
  {
    const d = w.document;
    // ---- chatSend carries the selection ids
    ROUTES["/api/chat"] = () => ({ session: "s", reply: "ok", context: 1 });
    await w.refreshMusicStyles("sty_1");
    if ($("styleSel")) $("styleSel").value = "sty_1";
    if ($("genModeSel")) $("genModeSel").value = "image";
    CALLS.length = 0;
    await w.chatSend("write me a song about rain");
    const post = CALLS.find((c) => c.url === "/api/chat");
    const body = post ? JSON.parse(post.body) : null;
    check("the chat POST carries the current selection",
      body && body.context && body.context.gen_mode === "image"
      && body.context.image_style_id === "sty_1" && body.context.music_style_id === "sty_1",
      body && body.context);

    // ---- the parser: taught shape, untagged shape, no-metadata shape
    const taught = "Theme: rainy city nights\nGenre: lo-fi hip-hop\nInstruments: Rhodes, brushed drums\nBPM: 72\nVocals: soft female\n\n[verse]\nneon rain on the glass\n[chorus]\nstay, stay";
    let r = w.musicFromBlock(taught);
    check("the taught shape splits: metadata to caption, [tagged] lines to lyrics",
      /^Theme: rainy city nights\nGenre:/.test(r.caption) && /BPM: 72/.test(r.caption)
      && r.lyrics.startsWith("[verse]") && /stay, stay$/.test(r.lyrics)
      && !/Theme/.test(r.lyrics) && !/\[verse\]/.test(r.caption), r);
    r = w.musicFromBlock("just two lines\nof plain lyrics");
    check("a block with no metadata is ALL lyrics, caption untouched",
      r.lyrics === "just two lines\nof plain lyrics" && r.caption === "", r);
    r = w.musicFromBlock("Genre: polka\nBPM: 140\n\nroll out the barrel\nBPM: this line is a lyric now");
    check("metadata AFTER the first lyric line is lyrics — a BPM: inside a verse is a lyric",
      r.caption === "Genre: polka\nBPM: 140" && /BPM: this line is a lyric now$/.test(r.lyrics), r);

    // ---- the 🎶 Music button end to end, through a rendered block
    $("muLyrics").value = ""; $("muCaption").value = "";
    if (!$("musicdock").classList.contains("collapsed")) w.toggleCollapse("musicdock");
    const msg = w.chatAdd("assistant", "here you go:\n```\n" + taught + "\n```");
    const btn = [...msg.querySelectorAll(".cbacts button")].find((b) => /Music/.test(b.textContent));
    check("a rendered assistant block has the 🎶 Music button (and no 🎵 Song)",
      !!btn && ![...msg.querySelectorAll("button")].some((b) => /Song/.test(b.textContent)),
      [...msg.querySelectorAll(".cbacts button")].map((b) => b.textContent));
    btn.click();
    check("clicking it fills the lyrics box from the tags down",
      $("muLyrics").value.startsWith("[verse]") && /stay, stay$/.test($("muLyrics").value),
      $("muLyrics").value);
    check("...and the caption box with the Theme/Genre/Instruments/BPM/Vocals lines",
      /Instruments: Rhodes/.test($("muCaption").value) && /Vocals: soft female/.test($("muCaption").value),
      $("muCaption").value);
    check("...opening the Music dock to show it",
      !$("musicdock").classList.contains("collapsed"), $("musicdock").className);
    check("...and the status line says where it came from",
      /from the chat/.test($("muStatus").textContent), $("muStatus").textContent);

    // ---- the prompt dock survives a maximize (2.92.0)
    if ($("promptdock").classList.contains("collapsed")) w.toggleCollapse("promptdock");
    w.toggleMax("timelinedock");
    check("2.381.0: maximizing leaves the others open (nothing minimized), the prompt dock included",
      $("timelinedock").classList.contains("maxed")
      && !$("musicdock").classList.contains("minned")
      && !$("promptdock").classList.contains("minned")
      && !$("promptdock").classList.contains("collapsed"),
      [...d.querySelectorAll("#maincol .bdock")].map((x) => [x.id, x.className]));
    w.toggleMax("timelinedock", false);
    w.toggleCollapse("promptdock");          // the USER closes it
    w.toggleMax("timelinedock");
    check("...but a prompt dock the user closed stays closed through a maximize",
      $("promptdock").classList.contains("collapsed")
      && !$("promptdock").classList.contains("minned"), $("promptdock").className);
    w.toggleMax("timelinedock", false);
    w.toggleCollapse("promptdock");
  }

  /* ===== mode-aware Basic Settings (2.93.0) — EXECUTED ==================== */
  {
    const d = w.document;
    // the dropdown flips the sets
    $("genModeSel").value = "image"; $("genModeSel").onchange();
    check("image mode shows the image set and hides the video set",
      !$("iset").classList.contains("hidden") && $("vset").classList.contains("hidden"), null);
    $("genModeSel").value = "video"; $("genModeSel").onchange();
    check("video mode shows the video set again",
      $("iset").classList.contains("hidden") && !$("vset").classList.contains("hidden"), null);
    check("the video set has the CFG slider with its readout",
      $("cfg").type === "range" && $("steps").type === "range"
      && $("cfgv").textContent.length > 0, [$("cfg").type, $("cfgv").textContent]);

    // the image set seeds from the selected style
    $("styleSel").value = "sty_1"; $("styleSel").onchange();
    check("the sliders seed from the style's own steps and cfg",
      $("imgSteps").value === "20" && $("imgCfg").value === "5",
      [$("imgSteps").value, $("imgCfg").value]);
    const rows = [...$("imgLoras").querySelectorAll(".lorarow")];
    check("every LoRA of the style gets a row: basename shown, slider at the style's weight",
      rows.length === 1
      && rows[0].querySelector("span").textContent === "grain.safetensors"
      && rows[0].querySelector("span").title === "flux/grain.safetensors"
      && rows[0].querySelector("input").value === "0.8",
      rows.map((r) => [r.querySelector("span").textContent, r.querySelector("input").value]));

    // untouched panel sends nothing extra
    w.ensureComfyReady = async () => true;
    w.comfyPreflight = async () => null;
    ROUTES["/api/genimage"] = () => ({ id: "ijob", params: {} });
    ROUTES["/api/jobs/ijob"] = () => ({ status: "done" });
    CALLS.length = 0;
    await w.startImageJob("a red fox");
    let body = JSON.parse((CALLS.find((c) => c.url === "/api/genimage") || {}).body || "{}");
    // 2.111.6 (Tim: "the preset in basic settings should overwrite the style"):
    // Basic Settings ARE the render settings — the seeded steps/cfg always go
    // with the job; a size goes whenever a preset (not "Style's own") is chosen
    check("an untouched panel sends the seeded steps/cfg (Basic Settings = render settings), no size while 'Style's own', no LoRA map",
      !("width" in body) && body.steps === 20 && body.cfg === 5 && !("lora_weights" in body),
      body);

    // touched controls ride along
    $("imgRes").value = "1024"; $("imgRes").onchange();
    $("imgAr").value = "16:9"; $("imgAr").onchange();
    $("imgSteps").value = "12"; $("imgSteps").oninput();
    $("imgCfg").value = "2.5"; $("imgCfg").oninput();
    const slider = rows[0].querySelector("input");
    slider.value = "0"; slider.oninput();
    check("...the readouts follow the sliders",
      $("imgStepsV").textContent === "12" && $("imgCfgV").textContent === "2.5"
      && rows[0].querySelector("b").textContent === "0.00",
      [$("imgStepsV").textContent, $("imgCfgV").textContent]);
    check("...and the size readout shows the computed 16-multiple",
      /1024×576/.test($("imgWh").textContent), $("imgWh").textContent);
    CALLS.length = 0;
    await w.startImageJob("a red fox");
    body = JSON.parse((CALLS.find((c) => c.url === "/api/genimage") || {}).body || "{}");
    check("touched controls ride with the render: size, steps, cfg",
      body.width === 1024 && body.height === 576 && body.steps === 12 && body.cfg === 2.5, body);
    check("...and the LoRA slider goes as a weight map keyed by the FULL path — 0 included",
      body.lora_weights && body.lora_weights["flux/grain.safetensors"] === 0, body.lora_weights);

    // a style re-select resets the panel to the style's truth
    $("styleSel").onchange();
    check("re-selecting the style reseeds the panel and clears every touch",
      $("imgSteps").value === "20"
      && $("imgLoras").querySelector("input").value === "0.8"
      && (() => { CALLS.length = 0; return true; })(),
      [$("imgSteps").value, $("imgLoras").querySelector("input").value]);
    await w.startImageJob("a red fox");
    body = JSON.parse((CALLS.find((c) => c.url === "/api/genimage") || {}).body || "{}");
    check("...the LoRA map is gone, and the size preset the user picked SURVIVES the style change (2.111.6)",
      !("lora_weights" in body) && body.width === 1024 && $("imgRes").value === "1024", body);
  }

  /* ===== two-way playhead sync (Task C, 2.93.0) — EXECUTED ================
     Player -> timeline: a STANDALONE #player (not the preview; pvTickBody
     already owns the marker there) moves the red marker via timeupdate/seeked,
     mapped global = clip.start + (local - clip.in), nearest placement wins.
     Timeline -> player: setPlayhead on the very clip that is playing seeks it
     and keeps it playing. Guards: pv.seeking eats the programmatic echo. */
  {
    const d = w.document;
    const p = $("player");
    const tl = w.tlState();
    const oldVideo = tl.video;
    tl.video = [{ name: "a.mp4", src: "output", start: 2, in: 1, out: 5 },
                { name: "a.mp4", src: "output", start: 10, in: 1, out: 5 }];
    w.pv.on = false; w.pv.seeking = false;
    w.playVideo("a.mp4");                        // curVideo = a.mp4, standalone
    w.renderTimeline();
    p.currentTime = 3;                            // local 3 -> global 2+(3-1)=4
    w.playerSyncTick();
    check("timeupdate maps clip-local to global and moves the readout (start+local-in)",
      /▏4\.0s/.test($("tlPh").textContent) && / a\.mp4/.test($("tlPh").textContent),
      $("tlPh").textContent);
    w.renderTimeline();                       // playhead is 4 now, so the element exists
    const ph = d.getElementById("playhead");
    const l1 = ph ? ph.style.left : "";
    p.currentTime = 4;                        // local 4 -> global 5
    w.playerSyncTick();
    check("...and moves the red marker ELEMENT itself, without a full re-render",
      !!ph && ph.style.left !== l1 && d.getElementById("playhead") === ph,
      [l1, ph && ph.style.left]);
    // nearest placement wins when the same file sits on the track twice
    w.setPlayhead(10.2);                          // park the marker by the SECOND copy
    w.pv.seeking = false;                         // eat previewAt's guard for a clean read
    p.currentTime = 3;
    w.playerSyncTick();
    check("of two placements of the same file, the one nearest the marker wins",
      /▏12\.0s/.test($("tlPh").textContent), $("tlPh").textContent);
    // local time outside every placement's media window moves nothing
    w.setPlayhead(12);
    w.pv.seeking = false;
    const before = $("tlPh").textContent;
    p.currentTime = 0.5;                          // < in (1) on both copies
    w.playerSyncTick();
    check("a local time outside the clip's media window moves nothing",
      $("tlPh").textContent === before, $("tlPh").textContent);
    // the preview clock owns the marker while pv.on
    w.pv.on = true;
    p.currentTime = 3;
    w.playerSyncTick();
    check("while a preview runs, the standalone listener stands down",
      $("tlPh").textContent === before, $("tlPh").textContent);
    w.pv.on = false;
    // the programmatic-seek echo is eaten exactly once
    w.pv.seeking = true;
    p.currentTime = 3;
    w.playerSyncTick();
    check("a programmatic seek's echo is swallowed by the guard",
      $("tlPh").textContent === before && w.pv.seeking === false,
      [$("tlPh").textContent, w.pv.seeking]);
    w.playerSyncTick();
    check("...and only once — the next real tick syncs again",
      /▏12\.0s/.test($("tlPh").textContent), $("tlPh").textContent);
    // a file that is not on the base track moves nothing: the marker is a
    // timeline position and a gallery-only video has no timeline meaning
    w.playVideo("elsewhere.mp4");
    w.pv.seeking = false;
    const before2 = $("tlPh").textContent;
    p.currentTime = 2;
    w.playerSyncTick();
    check("a gallery-only video (not on the track) never moves the marker",
      $("tlPh").textContent === before2, $("tlPh").textContent);
    // timeline -> player: a marker drop on the PLAYING clip seeks, keeps playing
    w.playVideo("a.mp4");
    Object.defineProperty(p, "paused", { get: () => false, configurable: true });
    p.classList.remove("hidden");
    w.pv.seeking = false;
    w.setPlayhead(4);                             // inside copy 1: off = 1+(4-2)=3
    check("dropping the marker on the clip that is PLAYING seeks it in place (off = in + t - start)",
      Math.abs(p.currentTime - 3) < 1e-6 && w.pv.seeking === true,
      [p.currentTime, w.pv.seeking]);
    delete p.paused;                              // restore the jsdom getter
    w.pv.seeking = false;
    tl.video = oldVideo;
    w.renderTimeline();
  }

  /* ===== Task B (2.95.0): keep/cut on AUDIO through the real buttons, the
     playhead trims, and the one-clip scope — EXECUTED against the REAL
     lib/timelineEdit maths (the harness route runs it), so the UI payloads
     and the maths cannot drift. The audio path had never been driven from
     the UI before — that was finding 2 in the handover. */
  {
    const d = w.document;
    const tl = w.tlState();
    const oldAudio = tl.audio, oldSelLayer = tl.selLayer, oldSel = tl.sel;
    tl.audio = [{ name: "song.mp3", muted: false,
                  clips: [{ name: "song.mp3", start: 0, in: 0, out: 10, dur: 10 }] }];
    const a0 = () => (tl.audio[0].clips || tl.audio[0]);
    tl.selLayer = "a:0";
    check("the audio layer helpers agree (kind + clips reachable)",
      w.lkKind("a:0") === "audio" && w.lkExists("a:0") && w.lkClips("a:0").length === 1,
      [w.lkKind("a:0"), w.lkClips("a:0")]);
    // ---- KEEP on audio through the actual toolbar button
    tl.sel = { a: 3, b: 7 };
    $("tlScope").value = "layer";
    $("tlRipple").checked = false;
    await $("tlKeepSel").onclick();
    check("⇥ Keep on an AUDIO layer trims the song to the selection (3-7)",
      a0().length === 1 && a0()[0].in === 3 && a0()[0].out === 7 && a0()[0].start === 3,
      a0());
    // ---- trim head / tail at the playhead, no selection needed
    tl.sel = null;
    w.pv.seeking = false;
    tl.audio[0].clips = [{ name: "song.mp3", start: 0, in: 0, out: 10, dur: 10 }];
    w.setPlayhead(4);
    await $("tlTrimHead").onclick();
    check("⇤ Head trims the audio clip under the playhead to start there",
      a0()[0].start === 4 && a0()[0].in === 4 && a0()[0].out === 10, a0());
    w.setPlayhead(8);
    await $("tlTrimTail").onclick();
    check("Tail ⇥ caps the same clip at the playhead",
      a0()[0].out === 8 && a0()[0].in === 4, a0());
    // ---- one-clip scope: the neighbour clip is untouched
    tl.audio[0].clips = [{ name: "a.mp3", start: 0, in: 0, out: 4, dur: 4 },
                         { name: "b.mp3", start: 5, in: 0, out: 10, dur: 10 }];
    tl.sel = { a: 6, b: 9 };
    $("tlScope").value = "clip";
    $("tlRipple").checked = true;
    await $("tlCutSel").onclick();
    check("scope=clip ✂ Cut edits ONLY the clip under the selection; ripple joins its halves",
      a0().length === 3 && a0()[0].name === "a.mp3" && a0()[0].out === 4
      && a0()[1].start === 5 && a0()[1].out === 1
      && a0()[2].start === 6 && a0()[2].in === 4, a0());
    // ---- refusals speak up through the in-page dialog, not a dead native
    tl.sel = null;
    await $("tlKeepSel").onclick();
    check("Keep with no selection explains itself in the in-page dialog",
      $("notedlg").open && /selection/.test($("note_body").textContent), $("note_body").textContent);
    $("note_ok").click();
    w.setPlayhead(20);                       // a gap — no clip under it
    await $("tlTrimHead").onclick();
    check("a trim in a gap surfaces the server's message",
      $("notedlg").open && /no clip under 20/.test($("note_body").textContent), $("note_body").textContent);
    $("note_ok").click();
    check("the toolbar offers the whole Task B set: Head, Tail, scope, ripple",
      !!$("tlTrimHead") && !!$("tlTrimTail") && !!$("tlScope")
      && [...$("tlScope").options].map((o) => o.value).join(",") === "layer,clip", null);
    check("dead selectLayer() is gone (finding 1) — pickLayer is the one true path",
      typeof w.selectLayer === "undefined" && typeof w.pickLayer === "function", typeof w.selectLayer);
    tl.audio = oldAudio; tl.selLayer = oldSelLayer; tl.sel = oldSel;
    $("tlScope").value = "layer";
    w.renderTimeline();
  }

  /* ===== keyframes (2.96.0) — EXECUTED: double-click drops a ◆, the popover
     edits opacity/volume per clip kind, interpolation ramps linearly and
     holds at the ends, and the preview reads it (the page's kfValue). */
  {
    const d = w.document;
    const tl = w.tlState();
    const oldV = tl.video, oldA = tl.audio;
    tl.video = [{ name: "a.mp4", src: "output", start: 2, in: 0, out: 6, dur: 6 }];
    tl.audio = [{ name: "song.mp3", muted: false,
                  clips: [{ name: "song.mp3", start: 0, in: 0, out: 10, dur: 10 }] }];
    w.renderTimeline();
    const clipEl = d.querySelector(".clip:not(.audio)") || d.querySelector("#tlinner .clip");
    check("a video clip renders (fixture)", !!clipEl, null);
    // ---- 2.300.0: double-click opens the START-TIME dialog; its ◆ button
    // drops the diamond at the double-clicked frame (what dblclick used to do)
    const r = clipEl.getBoundingClientRect();
    clipEl.dispatchEvent(new w.MouseEvent("dblclick", { bubbles: true, clientX: r.left + 28, clientY: r.top + 4 }));
    const c = tl.video[0];
    const csPop = d.querySelector(".tlpop.clipstart");
    check("2.300.0: double-click opens the clip's start-time dialog, prefilled with its start (2s) and naming the layer",
      !!csPop && csPop.querySelector('[data-cs="start"]').value === "2" && /V1/.test(csPop.textContent)
      && !c.kf, csPop && csPop.textContent.slice(0, 120));
    csPop.querySelector('[data-cs="kf"]').onclick();
    check("double-click → ◆ adds a keyframe on that frame, seeded from the current values",
      Array.isArray(c.kf) && c.kf.length === 1 && c.kf[0].op != null && c.kf[0].vol != null,
      c.kf);
    check("...and its editor popover opened with opacity AND volume for a video clip",
      !!d.querySelector(".tlpop input[data-kf='op']") && !!d.querySelector(".tlpop input[data-kf='vol']"),
      d.querySelector(".tlpop") && d.querySelector(".tlpop").innerHTML.slice(0, 80));
    // ---- the slider writes the keyframe
    const rng = d.querySelector(".tlpop input[data-kf='op']");
    rng.value = "30"; rng.oninput();
    check("moving the opacity slider writes the diamond's value", near(c.kf[0].op, 0.3), c.kf[0]);
    w.closePops();
    // ---- diamonds are marked with ◆ and reopen their editor on click
    w.renderTimeline();
    const dia = d.querySelector(".clip:not(.audio) .kfd");
    check("the keyframe is marked with a diamond ◆", !!dia && dia.textContent === "◆", dia && dia.textContent);
    dia.onclick(new w.MouseEvent("click"));
    check("clicking the diamond reopens its editor", !!d.querySelector(".tlpop [data-kfdel]"), null);
    // ---- a second diamond; the ramp between them is linear, held outside
    w.closePops();
    c.kf = [{ at: 1, op: 1, vol: 1 }, { at: 3, op: 0.5, vol: 0.2 }];
    check("transition from one keyframe to the next is a linear ramp (midpoint)",
      near(w.kfValue(c, 2, "op", 1), 0.75) && near(w.kfValue(c, 2, "vol", 1), 0.6),
      [w.kfValue(c, 2, "op", 1), w.kfValue(c, 2, "vol", 1)]);
    check("...and HOLDS before the first and after the last, like After Effects",
      near(w.kfValue(c, 0, "op", 1), 1) && near(w.kfValue(c, 5.5, "op", 1), 0.5), null);
    // ---- clip kinds gate the sliders: audio has no opacity, image no volume
    w.renderTimeline();
    const adia = d.querySelector(".clip.audio");
    const ar = adia.getBoundingClientRect();
    adia.dispatchEvent(new w.MouseEvent("dblclick", { bubbles: true, clientX: ar.left + 12, clientY: ar.top + 3 }));
    d.querySelector('.tlpop.clipstart [data-cs="kf"]').onclick();   // 2.300.0: ◆ lives in the start dialog
    check("an audio clip's keyframe editor offers volume but NOT opacity",
      !!d.querySelector(".tlpop input[data-kf='vol']") && !d.querySelector(".tlpop input[data-kf='op']"),
      d.querySelector(".tlpop") && d.querySelector(".tlpop").innerHTML.slice(0, 80));
    check("...and the audio keyframe carries no opacity field",
      tl.audio[0].clips[0].kf.length === 1 && tl.audio[0].clips[0].kf[0].op == null,
      tl.audio[0].clips[0].kf);
    // ---- delete via the popover ✕
    d.querySelector(".tlpop [data-kfdel]").onclick();
    check("✕ deletes the diamond and empties kf off the clip",
      !tl.audio[0].clips[0].kf, tl.audio[0].clips[0].kf);
    /* ---- 2.300.0 (Tim: "if user clicks on a clip in timeline layer, allow
       user to set start position, double click will show a start time
       input dialog, move start of the clip on that layer to the start
       time") - EXECUTED on the real page */
    w.renderTimeline();
    let au = d.querySelector(".clip.audio");
    au.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    check("2.300.0: a click SELECTS the clip (outlined), without re-rendering it away",
      au.isConnected && au.classList.contains("sel") && d.querySelectorAll("#tlinner .clip.sel").length === 1, null);
    au.dispatchEvent(new w.MouseEvent("dblclick", { bubbles: true, clientX: 30, clientY: 3 }));
    let pop2 = d.querySelector(".tlpop.clipstart");
    const inp2 = pop2 && pop2.querySelector('[data-cs="start"]');
    check("...double-click opens the start-time dialog with the input focused",
      !!inp2 && d.activeElement === inp2 && inp2.value === "0", inp2 && inp2.value);
    inp2.value = "1:05.5";
    inp2.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    const song = tl.audio[0].clips[0];
    au = d.querySelector(".clip.audio");
    check("...Enter moves the clip's START on its own layer (1:05.5 = 65.5s), redrawn there, still selected",
      song.start === 65.5 && !d.querySelector(".tlpop.clipstart") && au && au.classList.contains("sel")
      && Math.abs(parseFloat(au.style.left) - (w.eval("LABW") + 65.5 * w.eval("PXS"))) < 0.5,
      [song.start, au && au.style.left]);
    check("...and saved to the timeline store", /"start":65.5/.test(w.eval('store.get("tl","")')), null);
    // a bad time is refused in words and nothing moves
    au.dispatchEvent(new w.MouseEvent("dblclick", { bubbles: true, clientX: 30, clientY: 3 }));
    pop2 = d.querySelector(".tlpop.clipstart");
    pop2.querySelector('[data-cs="start"]').value = "-4";
    pop2.querySelector('[data-cs="move"]').onclick();
    check("...a negative / unreadable time is refused in words, the dialog stays, nothing moves",
      song.start === 65.5 && !!d.querySelector(".tlpop.clipstart")
      && /is not a start time/.test(pop2.querySelector('[data-cs="err"]').textContent), null);
    pop2.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    check("...Escape closes it", !d.querySelector(".tlpop.clipstart"), null);
    // Enter on the SELECTED clip (nothing focused) opens the dialog too
    d.activeElement && d.activeElement.blur && d.activeElement.blur();
    d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    check("...Enter on the selected clip opens its start dialog",
      !!d.querySelector(".tlpop.clipstart") && d.querySelector('.tlpop.clipstart [data-cs="start"]').value === "65.5", null);
    w.closePops();
    // V1 is one-after-another: a start inside another clip lands after it
    tl.video = [{ name: "a.mp4", src: "output", start: 0, in: 0, out: 6, dur: 6 },
                { name: "b.mp4", src: "output", start: 6, in: 0, out: 4, dur: 4 }];
    w.renderTimeline();
    const vb = [...d.querySelectorAll("#tlinner .clip:not(.audio):not(.img)")].find((x) => /b\.mp4/.test(x.textContent));
    vb.dispatchEvent(new w.MouseEvent("dblclick", { bubbles: true, clientX: 5, clientY: 3 }));
    const vp = d.querySelector(".tlpop.clipstart");
    check("...on V1 the dialog says the layer plays one after another",
      !!vp && /one after another/.test(vp.textContent), null);
    vp.querySelector('[data-cs="start"]').value = "12";
    vp.querySelector('[data-cs="move"]').onclick();
    check("...V1: b.mp4 moves to 12s (a gap is fine), a.mp4 stays at 0",
      tl.video.find((x) => x.name === "b.mp4").start === 12 && tl.video.find((x) => x.name === "a.mp4").start === 0,
      tl.video.map((x) => [x.name, x.start]));
    w.closePops();
    tl.video = oldV; tl.audio = oldA;
    w.renderTimeline();
  }

  /* ===== the ControlNet chain tab (2.97.0) — EXECUTED ===================== */
  {
    const d = w.document;
    // two plain styles + one chain in the list; the tab and the two editors
    // must split them: chains stay OUT of the Image editor, IN styleSel
    ROUTES["/api/styles"] = () => ({ styles: [STYLE,
      { ...STYLE, id: "sty_2", name: "Style Two" },
      { id: "sty_ch", name: "A Chain", kind: "image",
        chain: { first_id: "sty_1", controlnet: "cn.safetensors", second_id: "sty_2" } }],
      image_slots: {}, incomplete: {}, model_kinds: {} });
    await w.refreshStyles();
    check("the ControlNet tab exists in Settings",
      !!d.querySelector('[data-stab="cnet"]') && !!$("stab-cnet"), null);
    check("chain styles reach the prompt dropdown but NOT the Image editor list",
      [...$("styleSel").options].some(o => o.value === "sty_ch")
      && ![...$("s_stylelist").options].some(o => o.value === "sty_ch"),
      [[...$("styleSel").options].map(o => o.value), [...$("s_stylelist").options].map(o => o.value)]);
    check("...and the chain list in the tab carries it",
      [...$("s_cnlist").options].some(o => o.value === "sty_ch"),
      [...$("s_cnlist").options].map(o => o.value));
    // selecting the chain paints its three fields
    $("s_cnlist").value = "sty_ch"; $("s_cnlist").onchange();
    // 2.305.0: the type + the input (preprocessor) model paint from the chain
    ROUTES["/api/styles"] = () => ({ styles: [STYLE,
      { ...STYLE, id: "sty_2", name: "Style Two" },
      { id: "sty_ch", name: "A Chain", kind: "image",
        chain: { first_id: "sty_1", controlnet: "cn.safetensors", second_id: "sty_2" } },
      { id: "sty_dp", name: "Depth Chain", kind: "image",
        chain: { first_id: "sty_1", controlnet: "depth_cn.safetensors", second_id: "sty_2",
                 cn_type: "depth", preprocessor: "depth-anything/depth_anything_v2_vitl.pth" } }],
      image_slots: {}, incomplete: {}, model_kinds: {} });
    await w.refreshStyles();
    await new Promise((r) => setTimeout(r, 30));
    check("2.305.0: the type list is Pose, Scribble, Lineart, Depth",
      JSON.stringify([...$("s_cntype").options].map(o => o.value)) === '["pose","scribble","lineart","depth"]',
      [...$("s_cntype").options].map(o => o.value));
    $("s_cnlist").value = "sty_dp"; $("s_cnlist").onchange();
    const grp = [...$("s_cnpresel").querySelectorAll("optgroup")].map(g => [g.label, [...g.children].map(o => o.value)]);
    check("...a Depth chain paints its type, its input model (Depth files first) and its output model",
      $("s_cntype").value === "depth" && $("s_cnpre").value === "depth-anything/depth_anything_v2_vitl.pth"
      && $("s_cnpresel").value === "depth-anything/depth_anything_v2_vitl.pth"
      && grp[0][0] === "Depth files" && grp[0][1].length === 1 && grp[1][0] === "Other files" && grp[1][1].length === 2
      && $("s_cnmodel").value === "depth_cn.safetensors"
      && !!$("s_cnmodelcombo").querySelector(".cmcombo select.cmfile"),
      [$("s_cntype").value, $("s_cnpre").value, grp, $("s_cnmodel").value]);
    check("...and the type hint names the preprocessor node", /DepthAnythingV2Preprocessor/.test($("s_cntypehint").textContent),
      $("s_cntypehint").textContent);
    $("s_cntype").value = "pose"; $("s_cntype").onchange();
    check("...switching the type re-sorts the input list (Pose files first), the pick stays",
      $("s_cnpresel").querySelector("optgroup").label === "Pose files" && $("s_cnpresel").value === "depth-anything/depth_anything_v2_vitl.pth",
      $("s_cnpresel").querySelector("optgroup").label);
    $("s_cnlist").value = "sty_ch"; $("s_cnlist").onchange();
    check("...an older chain with no type paints Pose and the preprocessor's own default",
      $("s_cntype").value === "pose" && $("s_cnpre").value === "" && $("s_cnpresel").value === "",
      [$("s_cntype").value, $("s_cnpre").value]);
    check("selecting a chain paints name, stages and model (unscanned model kept)",
      $("s_cnname").value === "A Chain" && $("s_cnfirst").value === "sty_1"
      && $("s_cnsecond").value === "sty_2" && $("s_cnmodel").value === "cn.safetensors",
      [$("s_cnname").value, $("s_cnfirst").value, $("s_cnsecond").value, $("s_cnmodel").value]);
    // save posts the chain shape
    $("s_cnlist").value = ""; $("s_cnlist").onchange();
    $("s_cnname").value = "Fresh Chain";
    $("s_cnfirst").value = "sty_1"; $("s_cnsecond").value = "sty_2";
    $("s_cntype").value = "lineart"; $("s_cntype").onchange();
    $("s_cnpresel").value = "lllyasviel/Annotators/sk_model.pth"; $("s_cnpresel").onchange();
    ROUTES["/api/styles"] = (opts) => opts && opts.body
      ? { style: { id: "sty_new", ...JSON.parse(opts.body) }, styles: [] }
      : { styles: [STYLE, { ...STYLE, id: "sty_2", name: "Style Two" }],
          image_slots: {}, incomplete: {}, model_kinds: {} };
    CALLS.length = 0;
    await $("s_cnsave").onclick();
    const post = CALLS.find(c => c.url === "/api/styles" && c.body);
    const body = post ? JSON.parse(post.body) : null;
    check("💾 Save posts kind=image with the full chain",
      body && body.kind === "image" && body.name === "Fresh Chain"
      && body.chain && body.chain.first_id === "sty_1"
      && body.chain.second_id === "sty_2" && !!body.chain.controlnet,
      body);
    check("...with the type and the input model (2.305.0)",
      body && body.chain.cn_type === "lineart" && body.chain.preprocessor === "lllyasviel/Annotators/sk_model.pth",
      body && body.chain);
    check("...and the hint says where the style landed and what is deferred",
      /Image dropdown/.test($("s_cnhint").textContent) && /next build/.test($("s_cnhint").textContent),
      $("s_cnhint").textContent);
  }

  /* ===== Basic Settings -> ControlNet (2.316.0) — EXECUTED ==================
     Tim: "add controlnet accordian menuitem to basic settings in left docker,
     checkbox - use controlnet, dropdown-types, dropdown-preprocessor, dropdown
     model folder, dropdown model, cfg slider, steps slider, lora folder, lora
     dropdown, add lora button, lora weight slider" */
  {
    const d = w.document;
    const head = d.querySelector('h2.sec.drop[data-sec="cnet"]');
    check("2.316.0: a ControlNet accordion inside Basic Settings' image set (header + body, collapses)",
      !!head && !!$("sec-cnet") && $("iset").contains(head) && $("sec-basic").contains($("sec-cnet"))
      && /ControlNet/.test(head.textContent), null);
    head.onclick();
    const closed = $("sec-cnet").classList.contains("closed");
    head.onclick();
    check("...the header toggles it like the dock's other sections",
      closed && !$("sec-cnet").classList.contains("closed"), closed);
    check("...every control Tim listed: Use ControlNet, Type, Preprocessor, Model folder + Model, Steps + CFG sliders, ＋ LoRA",
      $("cnUse").type === "checkbox" && JSON.stringify([...$("cnType").options].map(o => o.value)) === '["pose","scribble","lineart","depth"]'
      && $("cnPre").tagName === "SELECT" && $("cnSteps").type === "range" && $("cnCfg").type === "range"
      && !!$("cnLoraAdd") && !!$("cnLoras"), null);
    // 2.317.0 (Tim: "the model will be a diffusion model or checkpoint, the
    // preprocessor will be the controlnet model from controlnet folder in
    // comfyui"): the Preprocessor lists models/controlnet (the type's first),
    // the Model combo lists checkpoints + diffusion models (the SECOND model)
    const oldCn = MODELS.categories.controlnet.files;
    MODELS.categories.controlnet.files = [
      { name: "sdxl/controlnet-depth-sdxl.safetensors", folder: "sdxl", size: 1, root: "r", source: "models" },
      { name: "control_v11p_sd15_openpose.pth", folder: "", size: 1, root: "r", source: "models" },
      { name: "union_promax.safetensors", folder: "", size: 1, root: "r", source: "models" }];
    await w.loadComfyModels(true);
    ROUTES["/api/controlnet/basic"] = (opts) => opts && opts.body
      ? { saved: true, settings: { ...JSON.parse(opts.body).settings } }
      : { settings: { v: 2, enabled: true, type: "depth", controlnet: "sdxl/controlnet-depth-sdxl.safetensors",
                      model: "SDXL/jugg.safetensors", model_cat: "checkpoints", cfg: 4.5, steps: 28, strength: 1 }, loras: [] };
    await w.cnBasicLoad();
    await new Promise((r) => setTimeout(r, 40));
    const grp = [...$("cnPre").querySelectorAll("optgroup")].map(g => [g.label, [...g.children].map(o => o.value)]);
    const combo = $("cnModelCombo").querySelector(".cmcombo");
    const mopts = combo ? [...combo.querySelectorAll("select.cmfile option")].map(o => o.value) : [];
    check("...the saved record paints: on, Depth, the Preprocessor = the ControlNet (Depth ControlNets first), the second model, steps 28, cfg 4.5",
      $("cnUse").checked === true && $("cnType").value === "depth"
      && $("cnPre").value === "sdxl/controlnet-depth-sdxl.safetensors"
      && JSON.stringify(grp) === JSON.stringify([["Depth ControlNets", ["sdxl/controlnet-depth-sdxl.safetensors"]],
        ["Other ControlNets", ["control_v11p_sd15_openpose.pth", "union_promax.safetensors"]]])
      && $("cnModel").value === "SDXL/jugg.safetensors" && $("cnSteps").value === "28" && $("cnCfg").value === "4.5"
      && $("cnStepsV").textContent === "28" && $("cnCfgV").textContent === "4.5",
      [$("cnUse").checked, $("cnType").value, $("cnPre").value, grp, $("cnModel").value, $("cnSteps").value, $("cnCfg").value]);
    check("...the Model is a folder dropdown + a model dropdown (+ 📁) over checkpoints AND diffusion models (the second model)",
      !!combo && !!combo.querySelector("select.cmfolder") && mopts.includes("SDXL/jugg.safetensors")
      && mopts.includes("flux_klein_9B/aisha.safetensors") && !mopts.includes("union_promax.safetensors"), mopts);
    CALLS.length = 0;
    $("cnType").value = "pose"; $("cnType").onchange();
    $("cnSteps").value = "0"; $("cnSteps").oninput(); $("cnSteps").onchange();
    const msel = combo.querySelector("select.cmfile");
    msel.value = "flux_klein_9B/aisha.safetensors"; msel.onchange();
    await new Promise((r) => setTimeout(r, 400));
    const post = CALLS.filter(c => c.url === "/api/controlnet/basic" && c.body).pop();
    const body = post ? JSON.parse(post.body).settings : null;
    check("...a change saves the record (debounced): Pose re-sorts (OpenPose first, the pick kept), steps 0 = the model's own, the second model + its category",
      body && body.v === 2 && body.enabled === true && body.type === "pose"
      && body.controlnet === "sdxl/controlnet-depth-sdxl.safetensors" && body.steps === null && body.cfg === 4.5
      && body.model === "flux_klein_9B/aisha.safetensors" && body.model_cat === "diffusion_models"
      && $("cnPre").querySelector("optgroup").label === "Pose ControlNets" && $("cnStepsV").textContent === "model's own",
      body);
    /* 2.318.0 (Tim: "the control net is not working at all"): the panel
       is painted at BOOT, before the models scan lands - the combos must
       fill when it does, or the second model can never be picked */
    const cats0 = MODELS.categories;
    MODELS.categories = {};
    await w.loadComfyModels(true);
    w.cnBasicPaint({ v: 2, enabled: true, type: "pose", controlnet: "", model: "" });
    const before = [...$("cnModelCombo").querySelectorAll("select.cmfile option")].map(o => o.value);
    const preBefore = [...$("cnPre").querySelectorAll("option")].map(o => o.value);
    MODELS.categories = cats0;
    await w.loadComfyModels(true);
    const after = [...$("cnModelCombo").querySelectorAll("select.cmfile option")].map(o => o.value);
    const preAfter = [...$("cnPre").querySelectorAll("option")].map(o => o.value);
    check("2.318.0: painted before the models scan (empty lists), the second-model combo AND the ControlNet list fill the moment the scan lands",
      before.length === 1 && preBefore.length === 1 && after.includes("SDXL/jugg.safetensors")
      && after.includes("flux_klein_9B/aisha.safetensors") && preAfter.includes("union_promax.safetensors"),
      [before, preBefore, after, preAfter]);
    // 2.320.0: "Final image only"
    const fo0 = $("cnFinalOnly").checked;
    CALLS.length = 0;
    $("cnFinalOnly").checked = true; $("cnFinalOnly").onchange();
    await new Promise((r) => setTimeout(r, 400));
    const fpost = CALLS.filter(c => c.url === "/api/controlnet/basic" && c.body).pop();
    w.cnBasicPaint({ v: 2, enabled: true, final_only: true, type: "pose" });
    check("2.320.0: a \"Final image only\" checkbox in the ControlNet section - off by default, saves final_only, paints back",
      !!$("cnFinalOnly") && $("sec-cnet").contains($("cnFinalOnly")) && fo0 === false
      && fpost && JSON.parse(fpost.body).settings.final_only === true && $("cnFinalOnly").checked === true
      && w.cnBasicRead().final_only === true, fpost && fpost.body);
    /* 2.321.0 (Tim: "add the second model prompt + negative prompt, the
       strength slider and the end slider and a checkbox above the positive
       prompt to use prompt docker prompt") */
    w.cnBasicPaint({ v: 2, enabled: true, type: "pose", use_main_prompt: false, prompt: "photo, a woman",
                     negative: "anime", strength: 0.6, end: 0.7 });
    const order = ["cnUseMain", "cnPrompt", "cnNeg", "cnStrength", "cnEnd"].map((id) => $(id));
    const inSec = order.every((x) => x && $("sec-cnet").contains(x));
    const above = inSec && (order[0].compareDocumentPosition(order[1]) & 4) === 4;
    check("2.321.0: Use prompt docker prompt (above the positive prompt), prompt, negative, Strength + End sliders - painted from the record",
      inSec && above && $("cnUseMain").checked === false && $("cnPrompt").value === "photo, a woman" && $("cnPrompt").disabled === false
      && $("cnNeg").value === "anime" && $("cnStrength").value === "0.6" && $("cnStrengthV").textContent === "0.60"
      && $("cnEnd").value === "70" && $("cnEndV").textContent === "70%", [inSec, above, $("cnPrompt").value, $("cnEnd").value]);
    CALLS.length = 0;
    $("cnUseMain").checked = true; $("cnUseMain").onchange();
    $("cnStrength").value = "0.75"; $("cnStrength").oninput(); $("cnStrength").onchange();
    $("cnEnd").value = "80"; $("cnEnd").oninput(); $("cnEnd").onchange();
    $("cnNeg").value = "anime, cartoon"; $("cnNeg").oninput();
    await new Promise((r) => setTimeout(r, 400));
    const ppost = CALLS.filter(c => c.url === "/api/controlnet/basic" && c.body).pop();
    const pb = ppost ? JSON.parse(ppost.body).settings : null;
    check("...ticking Use prompt docker prompt greys the own prompt; the changes save: use_main_prompt, strength 0.75, end 0.8, the negative (the own prompt kept)",
      $("cnPrompt").disabled === true && pb && pb.use_main_prompt === true && pb.strength === 0.75 && pb.end === 0.8
      && pb.negative === "anime, cartoon" && pb.prompt === "photo, a woman" && $("cnEndV").textContent === "80%", pb);
    /* 2.322.0 (Tim: faces "distorted" -> "please add the 2 reccommendations") */
    w.cnBasicPaint({ v: 2, enabled: true, type: "pose", pose_face: true });
    const pfOn = $("cnPoseFace").checked;
    CALLS.length = 0;
    $("cnPoseFace").checked = false; $("cnPoseFace").onchange();
    await new Promise((r) => setTimeout(r, 400));
    const pfPost = CALLS.filter(c => c.url === "/api/controlnet/basic" && c.body).pop();
    check("2.322.0: \"Pose: face points\" in the ControlNet section - paints, saves pose_face",
      $("sec-cnet").contains($("cnPoseFace")) && pfOn === true && pfPost && JSON.parse(pfPost.body).settings.pose_face === false,
      pfPost && pfPost.body);
    const ffHead = d.querySelector('h2.sec.drop[data-sec="facefix"]');
    ROUTES["/api/facefix"] = (opts) => opts && opts.body ? { saved: true, settings: JSON.parse(opts.body).settings }
      : { settings: { enabled: true, denoise: 0.35, detector: "bbox/face_yolov8n.pt" } };
    const oldU = MODELS.categories.ultralytics;
    MODELS.categories.ultralytics = { roots: [], folders: ["bbox"], files: [
      { name: "bbox/face_yolov8m.pt", folder: "bbox", size: 1, root: "r", source: "models" },
      { name: "bbox/face_yolov8n.pt", folder: "bbox", size: 1, root: "r", source: "models" }] };
    await w.loadComfyModels(true);
    await w.ffLoad();
    const detOpts = [...$("ffDetCombo").querySelectorAll("select.cmfile option")].map(o => o.value);
    check("...a Face fix section in Basic Settings' image set: checkbox, Denoise slider, Face detector dropdown (models/ultralytics) - painted from the record",
      !!ffHead && $("iset").contains(ffHead) && !!$("sec-facefix") && $("ffUse").checked === true
      && $("ffDenoise").value === "0.35" && $("ffDenoiseV").textContent === "0.35" && $("ffDet").value === "bbox/face_yolov8n.pt"
      && detOpts.includes("bbox/face_yolov8m.pt") && detOpts.includes("bbox/face_yolov8n.pt"), [detOpts, $("ffDet").value]);
    CALLS.length = 0;
    $("ffDenoise").value = "0.5"; $("ffDenoise").oninput(); $("ffDenoise").onchange();
    await new Promise((r) => setTimeout(r, 400));
    const ffPost = CALLS.filter(c => c.url === "/api/facefix" && c.body).pop();
    check("...a change saves (denoise 0.5), and Generate Image sends the Face fix settings only while ticked",
      ffPost && JSON.parse(ffPost.body).settings.denoise === 0.5 && JSON.parse(ffPost.body).settings.enabled === true
      && HTML.includes('if ($("ffUse") && $("ffUse").checked) body.face_fix = ffRead();'), ffPost && ffPost.body);
    MODELS.categories.ultralytics = oldU;
    MODELS.categories.controlnet.files = oldCn;
    $("cnLoraAdd").onclick();
    const row = $("cnLoras").querySelector(".lorarow");
    check("...＋ adds a LoRA row: folder dropdown, LoRA dropdown, weight slider (the cnet temporary list)",
      !!row && row.dataset.temp === "cnet" && !!row.querySelector("select.cmfolder") && !!row.querySelector("select.cmfile")
      && !!row.querySelector('input[type="range"]'), row && row.outerHTML.slice(0, 200));
    const SRC = HTML;
    check("...Generate Image sends the panel's settings with the request (2.318.0), only while Use ControlNet is ticked",
      SRC.includes('if ($("cnUse") && $("cnUse").checked) body.controlnet = cnBasicRead();'), null);
    row.querySelector(".lx").onclick();
  }

  /* ===== the chat dock collapses without taking startup with it (2.85.3) ====
     toggleCollapse() rewrites the header's text to swap the arrow, which
     destroys its children on the way past. It re-appended exactly ONE button —
     fine while every header had one, wrong the moment the chat dock arrived
     with two buttons and a status span. And its toolbar-button lookup returned
     undefined for a dock that has no toolbar button, so `$(undefined).classList`
     threw — on EVERY load, because this dock starts collapsed. Read from the
     source it looked harmless; executed, it is not. */
  if (typeof w.toggleCollapse === "function" && $("chatdock")) {
    const head = $("chatdock").querySelector(".bhead");
    const before = head.querySelectorAll("button").length;
    let threw = null;
    try { w.toggleCollapse("chatdock"); } catch (e) { threw = e.message; }
    check("collapsing the chat dock does not throw", threw === null, threw);
    check("...and the header still names the dock, not 'undefined'",
      /Prompt chat/.test(head.textContent), head.textContent);
    check("...and keeps EVERY header button, not just the first",
      head.querySelectorAll("button").length === before,
      [before, head.querySelectorAll("button").length]);
    // 2.164.0, by instruction: the note (and the buttons) moved from the
    // header into the chat MENUBAR — the header rewrite must not need them,
    // and the note must live in #chatBar now.
    check("...and the note span lives in the chat menubar now, not the header",
      !head.querySelector("#chatnote") && !!$("chatBar")
      && !!$("chatBar").querySelector("#chatnote"), $("chatBar") && $("chatBar").innerHTML.slice(0, 120));
    try { w.toggleCollapse("chatdock"); } catch (e) { threw = e.message; }
    check("reopening it works the same way", threw === null
      && /Prompt chat/.test(head.textContent), [threw, head.textContent]);
    check("the other docks still collapse as they did",
      (() => { try { w.toggleCollapse("consoledock"); w.toggleCollapse("consoledock"); return true; }
               catch { return false; } })(), null);
  }

  /* THE CHAT WINDOW IS THE DOCK (2.85.3): the dock's own background, no frame,
     and it flexes so dragging the splitter resizes it. min-height:0 is the
     load-bearing half — without it a flex child will not shrink below its
     content and the dock stops following the handle. */
  {
    const css = PAGE;
    const rule = (/#chatlog\s*\{[^}]*\}/.exec(css) || [""])[0];
    check("the chat window carries the dock's background, not the sunken log one",
      /background:\s*transparent/.test(rule) && !/#0f0d0a/.test(rule), rule);
    check("...with no frame of its own",
      /border:\s*0/.test(rule), rule);
    check("...and it fills the dock and scales with it",
      /flex:\s*1/.test(rule) && /min-height:\s*0/.test(rule), rule);
  }

  /* ===== /br/ splits a prompt into consecutive generations (2.86.0) ========
     Executed rather than grepped, because the interesting cases are all about
     what a person actually types: a stray space, a trailing seam, a URL that
     happens to contain slashes. */
  if (typeof w.splitPrompt === "function") {
    const sp = w.splitPrompt;
    check("a plain prompt is one generation",
      JSON.stringify(sp("a cat on a wall")) === '["a cat on a wall"]', sp("a cat on a wall"));
    check("/br/ splits it in two",
      JSON.stringify(sp("first shot /br/ second shot")) === '["first shot","second shot"]',
      sp("first shot /br/ second shot"));
    check("extra spaces around the seam are fine",
      sp("a   /br/   b").length === 2, sp("a   /br/   b"));
    check("...but the seam MUST stand alone: glued to a word it is not one, "
      + "because that is what a URL looks like",
      sp("a/br/b").length === 1, sp("a/br/b"));
    check("...and on its own line, which is how anybody would write it",
      sp("a\n/br/\nb").length === 2, sp("a\n/br/\nb"));
    check("case does not matter", sp("a /BR/ b").length === 2, sp("a /BR/ b"));
    check("a trailing seam does not make an empty job",
      JSON.stringify(sp("only this /br/  ")) === '["only this"]', sp("only this /br/  "));
    check("nor does a leading one", sp(" /br/ only this ").length === 1, sp(" /br/ only this "));
    check("an empty prompt is nothing to generate, not one empty job",
      sp("").length === 0 && sp("   ").length === 0, null);
    check("multiline text inside a segment survives — Shift+Enter is a newline, "
      + "not a seam", sp("line one\nline two").length === 1, sp("line one\nline two"));
    check("a URL is not mistaken for a seam",
      sp("see https://x.com/br/thing").length === 1, sp("see https://x.com/br/thing"));
    check("null and undefined do not throw on the way to the worker",
      sp(null).length === 0 && sp(undefined).length === 0, null);
  } else {
    check("splitPrompt is reachable for testing", false, "not on window");
  }

  /* ===== the mode dropdown decides what Generate means ===================== */
  {
    const sel = $("genModeSel");
    check("there is a mode dropdown", !!sel, null);
    if (sel) {
      const vals = [...sel.options].map((o) => o.value);
      check("...offering the five modes asked for",
        ["video", "image", "audio", "speech", "chat"].every((m) => vals.includes(m)), vals);
      check("...and it sits under the Generate button",
        html().indexOf('id="genModeSel"') > html().indexOf('id="go"'), null);
    }
    check("Enter generates and Shift+Enter does not",
      /e\.key !== "Enter" \|\| e\.shiftKey/.test(html()), null);
    check("a run is refused while one is already going — these jobs each want a "
      + "whole GPU", /if \(genBusy\) return;/.test(html()), null);
    check("the next segment waits for the previous to FINISH, not to be accepted",
      /await awaitJob\(|return awaitJob\(/.test(html()), null);
  }

  /* ===== a reply is prose AND prompts (2.86.1) ============================ */
  if (typeof w.chatParts === "function" && typeof w.chatAdd === "function") {
    const P = w.chatParts;
    const one = P("Try this:\n```\na cat on a wall\n```\nWant it wider?");
    check("a fenced block is separated from the prose around it",
      one.length === 3 && one[1].code === true && one[1].text === "a cat on a wall",
      one);
    check("...and the prose around it is NOT a prompt",
      one[0].code === false && one[2].code === false, one);
    check("a language tag on the fence is not part of the prompt",
      P("```text\nhello\n```")[0].text === "hello", P("```text\nhello\n```"));
    check("two blocks in one reply are two blocks",
      P("```\na\n```\nand\n```\nb\n```").filter((x) => x.code).length === 2, null);
    check("a reply with no fence is all prose — a question must not grow "
      + "Generate buttons", P("What lens did you have in mind?")
      .every((x) => !x.code), null);
    const cut = P("Here you go:\n```\na long prompt that was cut off");
    check("an UNCLOSED fence still yields the prompt — a reply truncated by the "
      + "token cap is when you most want the part that arrived",
      cut.some((x) => x.code && /cut off/.test(x.text)), cut);

    // rendering: buttons exist, and the model's text cannot become markup
    const log = $("chatlog");
    log.textContent = "";
    w.chatAdd("assistant", "ok\n```\n<img src=x onerror=alert(1)>\n```");
    const pre = log.querySelector("pre.cb");
    check("the block renders", !!pre, log.innerHTML.slice(0, 200));
    check("MODEL TEXT IS TEXT, never markup — a reply arrives over HTTP and is "
      + "not trusted", !!pre && pre.querySelector("img") === null
      && /<img/.test(pre.textContent), pre && pre.innerHTML);
    const labels = [...log.querySelectorAll(".cbacts button")].map((b) => b.textContent);
    for (const want of ["Picture", "Video", "Music", "Speech", "Copy"]) {
      check(`the block offers ${want}`, labels.some((l) => l.includes(want)), labels);
    }
    log.textContent = "";
    w.chatAdd("user", "a woman in the rain");
    const ul = [...log.querySelectorAll(".cbacts button")].map((b) => b.textContent);
    check("your own message offers Retry and Copy",
      ul.some((l) => /Retry/.test(l)) && ul.some((l) => /Copy/.test(l)), ul);
    check("...and nothing else — you cannot render your own question",
      ul.length === 2, ul);
    check("a message with no fence has no prompt block",
      log.querySelector("pre.cb") === null, log.innerHTML.slice(0, 200));
  }

  /* ===== window.prompt() is dead in Electron (2.87.0) ===================== */
  {
    const src = html();
    /* THE BUG BEHIND "fix the open project button". Electron logs "prompt() is
       and will not be supported" and returns undefined, so every button built
       on it did nothing AT ALL in the desktop app while working perfectly in a
       browser tab. A grep is the right check here: the point is that not one
       call site is left, and there is no way to execute an Electron shell in
       jsdom to catch a new one. */
    /* Comments stripped first: the explanation of this very bug quotes
       Electron's own "prompt() is and will not be supported", and a check that
       cannot tell a warning from the thing it warns about teaches the next
       person to delete the warning. Same lesson as clear-comfy.bat's guard. */
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    /* No space before the paren: `prompt (up to N)` is English inside a
       template string, `prompt(` is a call. */
    const calls = (code.match(/(?:^|[^.\w"'`])prompt\(/g) || [])
      .filter((c) => !/window\.prompt/.test(c));
    check("no code path calls window.prompt() — Electron does not implement it",
      calls.length === 0, calls.slice(0, 4));
    check("...and there is a real dialog to ask with instead",
      /id="askdlg"/.test(src) && /function askText\(/.test(src), null);
    check("Open project offers the projects as buttons rather than asking you "
      + "to type a number", /askText\("Open project"/.test(src), null);
    check("...and strips the (current) marker off the label it hands back",
      /replace\(\/\\s\+\\\(current\\\)\$\//.test(src), null);
    check("...counting the one deliberate window.prompt fallback as fine",
      /window\.prompt \? window\.prompt\(/.test(src), null);
    check("the askText fallback only fires when there is no <dialog> at all",
      /if \(!dlg \|\| !dlg\.showModal\)/.test(src), null);
    const dlg = $("askdlg");
    check("the dialog and its controls are in the page",
      !!dlg && !!$("ask_input") && !!$("ask_ok") && !!$("ask_cancel") && !!$("ask_list"),
      null);
  }

  /* ===== talking to it (2.87.0) =========================================== */
  {
    const src = html();
    check("there is a mic button beside the prompt", !!$("micBtn"), null);
    check("...and a read-replies checkbox", !!$("readBack"), null);
    check("recording is press-to-start, press-to-stop",
      /if \(micRec\) \{ micRec\.stop\(\); return; \}/.test(src), null);
    check("the microphone is RELEASED before the upload, not after it",
      (() => { const b = src.slice(src.indexOf("micRec.onstop"));
               return b.indexOf("getTracks().forEach") < b.indexOf("transcribe-upload"); })(),
      null);
    check("dictation APPENDS to the prompt rather than clobbering it",
      /box\.value\.trim\(\) \? box\.value/.test(src), null);
    check("it uses the STT endpoint that already existed",
      /\/api\/asr\/transcribe-upload/.test(src), null);
    check("read-aloud speaks the PROSE only — a fenced block is a prompt, not "
      + "something to listen to",
      /chatParts\(text\)\.filter\(\(p\) => !p\.code\)/.test(src), null);
    check("...and only when the box is ticked",
      /if \(!\$\("readBack"\) \|\| !\$\("readBack"\)\.checked\) return;/.test(src), null);
  }

  /* ===== the settings dialog is ONE size (2.89.0) ========================= */
  {
    const src = html();
    check("the dialog has a fixed width rather than one per tab (rule shared with #scEditDlg since 2.179.0)",
      /#settings, #scEditDlg \{ width:/.test(src), null);
    check("...and the PANE scrolls, so a long tab does not resize the box",
      /#settings \.stab\.active \{[^}]*overflow-y: auto/.test(src), null);
    check("...at a fixed height, so switching tabs cannot make it jump",
      /#settings \.stab\.active \{[^}]*height:/.test(src), null);
    check("the tab strip WRAPS, so another tab does not squeeze the others out",
      /#settings \.stabs \{ flex-wrap: wrap/.test(src), null);
  }

  check("no uncaught errors during the whole paint", errors.length === 0, errors);
  console.log("=======================");
  /* ===== dock layout from the settings file (2.103.0) — EXECUTED ==========
     Boot handed back a record above; every value in it must be on screen. */
  {
    const has = (id, cls) => $(id) && $(id).classList.contains(cls);
    const px = (k) => w.getComputedStyle(w.document.documentElement).getPropertyValue("--" + k).trim();
    check("2.381.0: boot applies docker_status.json's heights (timeline 333, music 171, chat 201, prompt 121, console 191)",
      px("th") === "333px" && px("mh") === "171px" && px("ch2") === "201px" && px("ph") === "121px" && px("ch") === "191px",
      [px("th"), px("mh"), px("ch2"), px("ph"), px("ch")]);
    check("...the side dock's width + hidden (left dock 311px, hidden by its status-bar toggle)",
      px("ldock") === "311px" && has("app", "no-left") && !has("tL", "on"), [px("ldock"), $("app").className]);
    check("...📌 first in every dock's header; pinned ones lit (prompt: max-height 121 inline; left dock: max-width 280)",
      [...w.document.querySelectorAll("#maincol .bdock")].every((b) => b.querySelector(".bhead").firstChild.classList.contains("pinbtn"))
      && ["ldock", "refsdock", "assetsdock", "qdock", "rdock"].every((id) => $(id).querySelector(".dockhead").firstChild.classList.contains("pinbtn"))
      && $("promptdock").querySelector(".pinbtn").classList.contains("on") && $("promptdock").style.maxHeight === "121px"
      && $("ldock").querySelector(".pinbtn").classList.contains("on") && !$("musicdock").querySelector(".pinbtn").classList.contains("on"),
      [$("promptdock").style.maxHeight]);
    // ---- docker_status.json writes (2.381.0) ------------------------------
    {
      const posts = () => CALLS.filter((c) => c.url === "/api/docker-status" && c.body);
      const n0 = posts().length;
      w.toggleCollapse("timelinedock");
      await new Promise((r) => setTimeout(r, 600));
      const p1 = posts().slice(n0).pop();
      check("collapsing a dock writes the WHOLE record to /api/docker-status (state closed), debounced",
        posts().length === n0 + 1 && JSON.parse(p1.body).docks.timelinedock.state === "closed"
        && Object.keys(JSON.parse(p1.body).docks).length === 16, p1 && p1.body.slice(0, 300));
      w.toggleCollapse("timelinedock");
      await new Promise((r) => setTimeout(r, 600));
      check("...reopening writes state open at the height it had", JSON.parse(posts().pop().body).docks.timelinedock.state === "open"
        && JSON.parse(posts().pop().body).docks.timelinedock.height === 333, posts().pop().body.slice(0, 200));
      // 📌 pin / unpin
      const pin = $("musicdock").querySelector(".pinbtn");
      pin.click();
      await new Promise((r) => setTimeout(r, 600));
      let mu = JSON.parse(posts().pop().body).docks.musicdock;
      check("📌 pinning a dock sets max_height = its current height (jsdom: its height var, 171), the button lit",
        mu.max_height === 171 && pin.classList.contains("on") && $("musicdock").style.maxHeight === "171px", mu);
      pin.click();
      await new Promise((r) => setTimeout(r, 600));
      mu = JSON.parse(posts().pop().body).docks.musicdock;
      check("...📌 again: max_height = 0 (any height), the inline cap gone", mu.max_height === 0 && !pin.classList.contains("on") && $("musicdock").style.maxHeight === "", mu);
      // 📌 a side dock
      const rp = $("rdock").querySelector(".pinbtn");
      rp.click();
      await new Promise((r) => setTimeout(r, 600));
      check("📌 on a side dock pins its WIDTH (max_width = its width)", JSON.parse(posts().pop().body).docks.rdock.max_width === parseInt(px("rdock"), 10), px("rdock"));
      rp.click();
      // the status-bar hide
      $("tT").onclick();
      await new Promise((r) => setTimeout(r, 600));
      check("the status-bar toggle writes hidden: true", JSON.parse(posts().pop().body).docks.timelinedock.hidden === true, null);
      $("tT").onclick();
      await new Promise((r) => setTimeout(r, 600));
    }
    // a record with the console OPEN and one dock MAXIMIZED, applied as boot would (the older shapes are read too)
    const nA = CALLS.filter((c) => c.url === "/api/docker-status" && c.body).length;
    w.applyLayout({ consoledock: { height: 191, state: "open" }, musicdock: { height: 171, state: "closed" },
                    chatdock: { height: 201, state: "max" }, timelinedock: { height: 233, state: "open" },
                    promptdock: { height: 121, state: "open", hidden: false } });
    check("...the console OPENS when the record says so (the 2.90.1 first-paint default is overridden)",
      !has("consoledock", "collapsed") && has("tC", "on"), $("consoledock").className);
    check("...music is closed, the chat dock is MAXIMIZED, the others OPEN beside it (2.381.0: nothing minimized)",
      has("musicdock", "collapsed") && has("chatdock", "maxed") && has("maincol", "has-max")
      && !has("timelinedock", "minned") && !has("timelinedock", "collapsed") && !has("promptdock", "minned"), [$("chatdock").className, $("timelinedock").className]);
    await new Promise((r) => setTimeout(r, 600));
    check("applying a record does not write it back (no POST while applying)",
      CALLS.filter((c) => c.url === "/api/docker-status" && c.body).length === nA, null);
    // a user change posts the record, and the record reads the DOM truthfully
    const n0 = CALLS.filter((c) => c.url === "/api/docker-status" && c.body).length;
    w.toggleMax("chatdock", false);
    w.toggleCollapse("musicdock");
    w.setVar("th", 300);
    await new Promise((r) => setTimeout(r, 600));
    const posts = CALLS.filter((c) => c.url === "/api/docker-status" && c.body);
    check("changes are POSTed to /api/docker-status (debounced into one write)", posts.length === n0 + 1, posts.length - n0);
    const sent = posts.length ? JSON.parse(posts[posts.length - 1].body).docks : {};
    check("...carrying the whole record: timeline height 300, music open, chat no longer maximized, the left dock still hidden",
      sent.timelinedock && sent.timelinedock.height === 300 && sent.musicdock.state === "open"
      && sent.chatdock.maximized === false && sent.ldock.hidden === true, sent);
    const st = w.layoutState();
    check("layoutState() reports every dock (11 bottom + 5 side) in docker_status's shape",
      Object.keys(st).length === 16 && !!st.stemsdock && !!st.sfxdock && !!st.videodock && !!st.previewdock
      && Object.values(st).every((d) => (d.height || d.width) > 0 && ["open", "closed"].includes(d.state)
        && typeof d.hidden === "boolean" && typeof d.maximized === "boolean" && Number.isFinite(d.max_height) && Number.isFinite(d.max_width)), st);
  }

  /* ===== named timelines + new-project reset + chat "Send" (2.107.0) ===== */
  {
    const TL = () => w.eval("tl"), TLN = () => w.eval("tlName");
    check("the timeline toolbar has the timeline dropdown, Save and Save as…",
      $("tlSel") && $("tlSaveBtn") && $("tlSaveAs"), null);
    await w.tlRefreshList();
    check("the dropdown lists the project's timelines with the active one selected",
      [...$("tlSel").options].map((o) => o.value).join("|") === "main|alt cut" && $("tlSel").value === "main", [...$("tlSel").options].map((o) => o.value));
    $("tlSel").value = "alt cut"; await $("tlSel").onchange(); await new Promise((r) => setTimeout(r, 20));
    check("switching loads that timeline's clips and makes it the active name",
      TL().video.length === 1 && TL().video[0].name === "x.mp4" && TLN() === "alt cut", [TL().video.length, TLN()]);
    check("...vlayers/markers are filled in when the file lacks them (no undefined.flat() later)",
      Array.isArray(TL().vlayers) && TL().markers && Array.isArray(TL().markers.refs), TL().markers);
    const n0 = CALLS.filter((c) => c.url.includes("/api/timelines/") && c.body).length;
    await w.tlSaveNamed("alt cut");
    const posted = CALLS.filter((c) => c.url.includes("/api/timelines/") && c.body).slice(-1)[0];
    check("Save posts the timeline object to /api/timelines/<name> and activates it",
      posted && posted.url.endsWith("/api/timelines/alt%20cut") && JSON.parse(posted.body).tl.video.length === 1 && JSON.parse(posted.body).activate === true, posted && posted.url);
    check("projectState() carries the active timeline name", w.projectState().timeline === "alt cut", w.projectState().timeline);
    // new project reset
    $("prompt").value = "leftover prompt"; $("muLyrics") && ($("muLyrics").value = "la la"); $("chatlog").innerHTML = "<div>old chat</div>";
    w.resetWorkspace();
    check("resetWorkspace clears the timeline, the prompt, the music lyrics and the chat pane",
      TL().video.length === 0 && TLN() === "main" && $("prompt").value === "" && (!$("muLyrics") || $("muLyrics").value === "") && $("chatlog").innerHTML === "", [TL().video.length, $("prompt").value]);
    // 2.371.0: New project resets through freshReload (resetWorkspace + a reload, so every docker starts empty)
    check("...and the New-project handler resets the workspace (freshReload -> resetWorkspace, then a reload)",
      /\/\/ 2\.107\.0[^\n]*\n\s*freshReload\(j\.name\);/.test(HTML)
      && /function freshReload\(name, kind\) \{[\s\S]{0,200}resetWorkspace\(\);/.test(HTML), null);
    // chat mode: Send
    $("genModeSel").value = "video"; $("genModeSel").onchange();
    check("the button says Generate outside chat mode", $("go").textContent === "Generate", $("go").textContent);
    $("genModeSel").value = "chat"; $("genModeSel").onchange();
    check("...and Send in chat mode", $("go").textContent === "Send", $("go").textContent);
    $("prompt").value = "hello assistant";
    w.chatSend = async () => {};                    // no LLM here
    await w.runGenerate();
    check("submitting in chat mode clears the prompt box", $("prompt").value === "", $("prompt").value);
    check("...and the button reads Send again afterwards (not Generate)", $("go").textContent === "Send", $("go").textContent);
    $("genModeSel").value = "video"; $("genModeSel").onchange();
  }

  /* ===== checkpoint override in Basic Settings (2.115.0) ===== */
  {
    check("Basic Settings → image has a checkpoint combo above the temporary LoRAs",
      $("imgCkptCombo") && $("imgCkptCombo").querySelector(".cmfile") && $("iset").contains($("imgCkptCombo"))
      && $("imgCkptCombo").compareDocumentPosition($("tliRows")) & 4, null);
    check("...blank means the style's own: no `model` in the job body", !("model" in w.imgBasicsBody({})), w.imgBasicsBody({}));
    const sel = $("imgCkptCombo").querySelector(".cmfile");
    const opt = [...sel.options].find((o) => o.value && /safetensors|ckpt/.test(o.value)) || sel.options[1];
    sel.value = opt.value; sel.dispatchEvent(new w.Event("change"));
    check("picking one sends it as `model` with the image job and remembers it",
      w.imgBasicsBody({}).model === opt.value && w.eval('store.get("imgckpt","")') === opt.value, [w.imgBasicsBody({}).model, opt.value]);
    sel.value = ""; sel.dispatchEvent(new w.Event("change"));
    check("...and clearing it goes back to the style's", !("model" in w.imgBasicsBody({})), null);
  }

  /* ===== chat replies pick the mode (2.114.0) ===== */
  {
    $("genModeSel").value = "chat"; $("genModeSel").onchange();
    const r = w.chatApplyKind("Here you go:\n```image\nscore_9, 1girl, silver hair, forest\n```\nWant another?");
    check("an ```image fence switches the mode to image (Basic Settings follow) and fills the prompt box",
      r && r.mode === "image" && $("genModeSel").value === "image" && $("prompt").value === "score_9, 1girl, silver hair, forest"
      && $("iset").style.display !== "none" && $("go").textContent === "Generate", [r, $("genModeSel").value, $("go").textContent]);
    const v = w.chatApplyKind("```video\nOne continuous take of a fox on a boardwalk. Sound: waves.\n```");
    check("a ```video fence switches to video", v && v.mode === "video" && $("genModeSel").value === "video" && /boardwalk/.test($("prompt").value) && $("vset").style.display !== "none", [v, $("genModeSel").value]);
    check("an untagged fence changes nothing (current mode stays)", w.chatApplyKind("```\nplain prompt\n```") === null && $("genModeSel").value === "video", null);
    check("music / speech fences map to their modes", w.chatApplyKind("```music\n[verse] la\n```").mode === "audio" && w.chatApplyKind("```speech\nhello there\n```").mode === "speech", null);
    check("the reply handler calls it and the system prompt teaches the tags",
      /chatApplyKind\(j\.reply\)/.test(HTML) && /TAG THE FENCE WITH WHAT IT IS FOR/.test(fs.readFileSync(path.join(__dirname, "..", "lib", "llmChat.js"), "utf8")), null);
    $("genModeSel").value = "video"; $("genModeSel").onchange(); $("prompt").value = "";
  }

  /* ===== queue dock: Pending / Done tabs + jobs.info history (2.113.0) ===== */
  {
    check("the queue dock has Pending and Done tabs", $("qtabPending") && $("qtabDone"), null);
    w.eval('qTab = "pending"'); await w.refreshJobs();
    let cards = [...$("jobs").querySelectorAll(".job")];
    check("Pending shows the interrupted job from jobs.info with ▶ Resume and ✕, not the finished one",
      cards.length === 1 && /never ran/.test(cards[0].textContent) && cards[0].querySelector(".hbtns button").textContent === "▶ Resume" && /interrupted/.test(cards[0].textContent), cards.map((c) => c.textContent));
    check("...the tab labels carry counts", /Pending \(1\)/.test($("qtabPending").textContent) && /Done \(1\)/.test($("qtabDone").textContent), [$("qtabPending").textContent, $("qtabDone").textContent]);
    $("qtabDone").click(); await new Promise((r) => setTimeout(r, 10));
    cards = [...$("jobs").querySelectorAll(".job")];
    check("Done shows the finished history entry with Open and ✕", cards.length === 1 && /finished yesterday/.test(cards[0].textContent) && cards[0].querySelector(".hbtns button").textContent === "Open", cards.map((c) => c.textContent));
    check("...and the choice is remembered", w.eval('store.get("qtab", "")') === "done", null);
    $("qtabPending").click(); await new Promise((r) => setTimeout(r, 10));
    const before = CALLS.length;
    $("jobs").querySelector(".hbtns button").click(); await new Promise((r) => setTimeout(r, 20));
    check("▶ Resume posts /api/jobs/history/<id>/resume and selects the re-queued job",
      CALLS.slice(before).some((c) => c.url.endsWith("/api/jobs/history/old2/resume")) && w.eval("selJob") === "old2", CALLS.slice(before).map((c) => c.url));
  }

  /* ===== temporary LoRAs in Basic Settings (2.111.0) ===== */
  {
    check("Basic Settings has a temporary-LoRA adder for image (in #iset) and for video (in #vset)",
      $("tliAdd") && $("tliRows") && $("iset").contains($("tliRows")) && $("tlvAdd") && $("tlvRows") && $("vset").contains($("tlvRows")), null);
    // (an earlier block's resetWorkspace() already wiped what boot painted; paint as a project open does)
    w.paintTempLoras(route("/api/temploras"));
    check("opening the project paints the saved image LoRA row (from image-loras-temp.json)",
      $("tliRows").querySelectorAll(".lorarow").length === 1 && w.tempLoras("image")[0].path === "saved_img.safetensors" && w.tempLoras("image")[0].weight === 0.6, w.tempLoras("image"));
    check("...and both boot and applyProjectState fetch /api/temploras to do so",
      (HTML.match(/fetch\("\/api\/temploras"\)\.then\(\(r\) => r\.json\(\)\)\.then\(paintTempLoras\)/g) || []).length === 2, null);
    $("tlvAdd").click();
    const row = $("tlvRows").querySelector(".lorarow");
    check("＋ adds a row with the LoRA picker, a weight slider and ✕", row && row.querySelector(".cmfile") && row.querySelector("input[type=range]") && row.querySelector(".lx"), null);
    check("...as a stacked FRAME (2.111.1): folder and LoRA dropdowns inside the combo, the slider + value + ✕ on their own line below",
      row.classList.contains("stacked") && row.querySelector(".cmcombo .cmfolder") && row.querySelector(".cmcombo .cmfile")
      && row.querySelector(".lline input[type=range]") && row.querySelector(".lline .lw") && row.querySelector(".lline .lx")
      && row.lastElementChild.classList.contains("lline"), row.innerHTML.slice(0, 200));
    check("the IMAGE temp-LoRA frames hide the folder filter (2.111.5); the video ones keep it",
      /#tliRows \.lorarow\.stacked \.cmcombo select\.cmfolder \{ display: none; \}/.test(HTML) && !/#tlvRows [^\n]*cmfolder \{ display: none/.test(HTML), null);
    check("...the frame CSS puts the folder on a full-width row of its own",
      /\.lorarow\.stacked \.cmcombo select\.cmfolder \{ grid-column: 1 \/ -1; width: 100%/.test(HTML) && /\.lorarow\.stacked \{ display: block; border: 1px solid/.test(HTML), null);
    row.querySelector("input[type=text]").value = "tmp_vid.safetensors";
    const rng = row.querySelector("input[type=range]"); rng.value = "0.35"; rng.dispatchEvent(new w.Event("change"));
    await new Promise((r) => setTimeout(r, 400));
    const posted = CALLS.filter((c) => c.url.endsWith("/api/temploras/video") && c.body).slice(-1)[0];
    check("a change saves the list to the project (POST /api/temploras/video, debounced)",
      posted && JSON.parse(posted.body).loras[0].path === "tmp_vid.safetensors" && JSON.parse(posted.body).loras[0].weight === 0.35, posted && posted.body);
    const b = w.imgBasicsBody({});
    check("the image job body carries extra_loras (not the style's lora_weights)", Array.isArray(b.extra_loras) && b.extra_loras[0].path === "saved_img.safetensors", b);
    check("the video Generate form appends extra_loras, and the music video body too",
      /fd\.append\("extra_loras", JSON\.stringify\(extra\)\)/.test(HTML) && /extra_loras: tempLoras\("video"\)/.test(HTML), null);
    row.querySelector(".lx").click();
    check("✕ removes the row", $("tlvRows").querySelectorAll(".lorarow").length === 0, null);
    w.resetWorkspace();
    check("a new project starts with no temporary LoRAs", $("tliRows").querySelectorAll(".lorarow").length === 0, null);
  }

  /* ===== video styles (2.110.0) ===== */
  {
    check("Settings has a Video tab with the Image tab's shape: checkpoint / text encoder / VAE / LoRAs, plus phases",
      $("stab-video") && $("s_vsphases") && $("s_vsphaseadd") && $("s_vste") && $("s_vsvae") && $("s_vsloras") && $("s_vsloraadd"), null);
    check("the prompt bar has the Video style dropdown beside the image style", $("videoStyleSel") && $("styleSel").nextElementSibling && /videoStyleSel/.test($("styleSel").parentElement.innerHTML), null);
    await w.loadVideoArchs();
    $("s_vsarch").value = "wan22"; w.vsPaintForm(null);
    check("a new style starts with one phase row", $("s_vsphases").children.length === 1, $("s_vsphases").children.length);
    $("s_vsphaseadd").click();
    check("＋ adds a second phase (checkpoint + steps + cfg row) for Wan 2.2", $("s_vsphases").children.length === 2 && $("s_vsphases").children[1].querySelector(".vscfg"), null);
    $("s_vsphaseadd").click();
    check("...and stops at the arch's phases_max", $("s_vsphases").children.length === 2, $("s_vsphases").children.length);
    $("s_vsphases").children[0].querySelector(".vsmodel").value = "high.safetensors"; $("s_vsphases").children[0].querySelector(".vssteps").value = "8";
    $("s_vsphases").children[1].querySelector(".vsmodel").value = "low.safetensors"; $("s_vsphases").children[1].querySelector(".vscfg").value = "3";
    $("s_vsname").value = "Wan test"; $("s_vste").value = "umt5"; $("s_vswf_t2va").value = "comfy_workflows/wan.json";
    const body = w.vsReadForm();
    check("the form reads back as a video style: phases in order, te, per-mode workflow",
      body.kind === "video" && body.arch === "wan22" && body.phases.length === 2 && body.phases[0].model === "high.safetensors" && body.phases[0].steps === 8
      && body.phases[1].cfg === 3 && body.te[0] === "umt5" && body.workflows.t2va === "comfy_workflows/wan.json", body);
    // 2.303.0 (Tim: "add the 8-bit loading option for users who are using
    // the bf16 models"): each phase row has its LOAD PRECISION, read back
    const dt = [...$("s_vsphases").children].map((r) => r.querySelector(".vsdtype"));
    check("2.303.0: every phase row has a 'Load as' select (the workflow's own / full / fp8 / fp8 fast / e5m2), blank by default",
      dt.length === 2 && dt.every((x) => x && x.value === "" && JSON.stringify([...x.options].map((o) => o.value))
        === '["","default","fp8_e4m3fn","fp8_e4m3fn_fast","fp8_e5m2"]'), dt.map((x) => x && x.value));
    dt[1].value = "fp8_e4m3fn";
    const body2 = w.vsReadForm();
    check("...and the form reads it back per phase", body2.phases[0].dtype === "" && body2.phases[1].dtype === "fp8_e4m3fn", body2.phases);
    w.vsPaintForm({ id: "x", name: "bf16", arch: "wan22", phases: [{ model: "a.safetensors", dtype: "fp8_e4m3fn_fast" }], te: [""], loras: [] });
    check("...and a saved style paints its phase's precision back",
      $("s_vsphases").children[0].querySelector(".vsdtype").value === "fp8_e4m3fn_fast", null);
    w.vsPaintForm(null);
    check("Generate sends the chosen video style id", /fd\.append\("video_style_id", \$\("videoStyleSel"\)\.value\)/.test(HTML) && /video_style: fieldVal\("videoStyleSel"\)/.test(HTML), null);
    // 2.111.2: the dialog is wider and the Video tab is a list column + form, phases as frames
    // 2.184.0 (by instruction): icon-only Start-ComfyUI beside Generate Music
    check("an icon-only Start-ComfyUI button sits in the PROMPT dock's icon row (2.185.0: moved), titled",
      !!$("goComfyStart") && $("goComfyStart").textContent.trim() === "⚙"
      && $("goComfyStart").getAttribute("title") === "Start ComfyUI"
      && $("goComfyStart").previousElementSibling
      && $("goComfyStart").previousElementSibling.id === "mvBtn"
      && $("goComfyStart").classList.contains("ibtn"), null);
    check("...wired ONCE to the same comfyStart() the status bar uses (repaint-guarded)",
      /goComfyStart[\s\S]{0,200}dataset\.wired[\s\S]{0,200}comfyStart\(\)/.test(HTML), null);
    check("the Settings dialog is wider (min(1240px, 96vw)) and scrolls inside — the rule is SHARED with #scEditDlg since 2.179.0 so the two sizes never drift", /#settings, #scEditDlg \{ width: min\(1240px, 96vw\); max-height: 92vh; overflow: auto; \}/.test(HTML), null);
    const ph = $("s_vsphases").children[0];
    check("a phase is a frame: header with its number and ✕, the checkpoint combo on its own row, steps + cfg side by side",
      ph.querySelector(".vshead .vsphaseno") && ph.querySelector(".vshead .lx") && ph.querySelector(".vscombo") && ph.querySelector(".vsnums .vssteps") && ph.querySelector(".vsnums .vscfg"), ph.innerHTML.slice(0, 160));
    check("the Video tab's saved styles are a DROPDOWN above the form (2.111.4), with '— new video style —' first",
      $("s_vslist").tagName === "SELECT" && !$("s_vslist").hasAttribute("size") && $("s_vslist").options[0].value === "" && !$("stab-video").querySelector(".vsgrid").contains($("s_vslist")), null);
    await w.refreshVideoStyles();
    check("...refreshing keeps the placeholder first and selects nothing when no style is being edited", $("s_vslist").options[0].value === "" && $("s_vslist").value === "", $("s_vslist").value);
    // 2.111.3: presets instead of width/height, inherited into Basic Settings on pick
    check("the Video tab offers resolution (480/540/720/1080p) and aspect presets, no width/height",
      $("s_vsres") && [...$("s_vsres").options].map((o) => o.value).join() === ",480,540,720,1080" && $("s_vsaspect") && !$("s_vswidth"), null);
    $("s_vsres").value = "720"; $("s_vsaspect").value = "9:16";
    check("...and the form reads them back", w.vsReadForm().res === "720" && w.vsReadForm().aspect === "9:16" && !("width" in w.vsReadForm()), w.vsReadForm());
    w.eval('videoStyles = [{ id: "vs1", name: "Wan tall", arch: "wan22", res: "720", aspect: "9:16", phases: [{ model: "h", steps: 14, cfg: 4.5 }, { model: "l", steps: 10, cfg: 3 }] }]');
    $("videoStyleSel").innerHTML = '<option value=""></option><option value="vs1">Wan tall</option>';
    $("videoStyleSel").value = "vs1"; $("videoStyleSel").onchange();
    check("picking a video style makes Basic Settings inherit its presets and phase 1's steps/cfg",
      $("resSel").value === "720" && $("arSel").value === "9:16" && $("steps").value === "14" && $("cfg").value === "4.5" && $("width").value === "720" && $("height").value === "1280",
      [$("resSel").value, $("arSel").value, $("steps").value, $("cfg").value, $("width").value, $("height").value]);
    $("videoStyleSel").value = ""; $("videoStyleSel").onchange();
  }

  /* ===== 2.291.0: a fresh scene take lands on a NEW timeline layer at its
     start (Tim: "after each scene is generated add it to a new video layer
     in our timeline docker at the start position set in the video docker
     scene") — the core function the video docker hands takes to ===== */
  {
    const errs0 = errors.length;
    const T = w.tlState();
    const before = T.vlayers.length, v1Before = T.video.length;
    const L = w.tlPlaceScene({ n: 3, name: "scene3_verse.mp4", start: 30, dur: 8.5,
                               label: "Scene 3" });
    const T2 = w.tlState();
    const c = L && L.clips && L.clips[0];
    check("tlPlaceScene puts the take on a NEW video layer named for its scene, at its start, for its length, from the Video assets",
      T2.vlayers.length === before + 1 && T2.vlayers[T2.vlayers.length - 1] === L
      && L.name === "Scene 3" && c && c.name === "scene3_verse.mp4" && c.start === 30
      && c.dur === 8.5 && c.in === 0 && c.out === 8.5 && c.src === "video", L);
    check("...V1 is never touched (its sequential packing would move the start), and the paint throws nothing",
      T2.video.length === v1Before && errors.length === errs0, errors.slice(errs0));
    const L2 = w.tlPlaceScene({ n: 3, name: "scene3_verse (2).mp4", start: 30, dur: 8 });
    check("...a second take of the same scene gets ANOTHER new layer (nothing already placed is disturbed)",
      w.tlState().vlayers.length === before + 2 && L.clips[0].name === "scene3_verse.mp4"
      && L2.clips[0].name === "scene3_verse (2).mp4");
    check("...and a call with no file places nothing", w.tlPlaceScene({ n: 4 }) === null
      && w.tlState().vlayers.length === before + 2);
    // 2.309.0: END TO END - the next scene starts where the previous one
    // ENDS as it sits on the timeline now (moved and trimmed included)
    L.clips[0].start = 31; L.clips[0].in = 0.5; L.clips[0].out = 7.5;     // moved + trimmed by hand
    const L4 = w.tlPlaceScene({ n: 4, name: "scene4.mp4", start: 99, dur: 12.25, after: "scene3_verse.mp4" });
    check("2.309.0: a take placed after the previous scene starts where that clip ENDS on the timeline (31 + 7.0 = 38), not at the server's start",
      L4 && L4.clips[0].start === 38 && L4.clips[0].dur === 12.25, L4 && L4.clips[0]);
    const L5 = w.tlPlaceScene({ n: 5, name: "scene_5_2.mp4", start: 41, dur: 3, after: "projects\\p\\video\\scene4.mp4" });
    check("...each scene's OWN length counts (scene 5 at 38 + 12.25 = 50.25), whatever path form names the previous take",
      L5 && L5.clips[0].start === 50.25, L5 && L5.clips[0]);
    const L6 = w.tlPlaceScene({ n: 6, name: "scene6.mp4", start: 44.5, dur: 2, after: "not_on_the_timeline.mp4" });
    check("...a previous take that is not on the timeline falls back to the server's end-to-end start",
      L6 && L6.clips[0].start === 44.5, L6 && L6.clips[0]);
    w.tlState().vlayers.splice(before, 5);
    w.renderTimeline();
  }

  /* ===== 2.311.0: the transport + the marker at the visible top (Tim: "make
     the timeline marker grabbable even when the timeline is scrolled down
     ... add goto start button and goto end button in the timeline menu (on
     either side of the preview button) make preview button icon only. Add
     all the media buttons, icon only") ===== */
  {
    const d = w.document;
    // 2.383.0 (Tim: "remove the media play,stop,pause next and previous buttons from the timeline menubar"): the
    // transport left the timeline's menu bar - the jumps below are the core engine the canvas and keys still use
    check("2.383.0: the timeline's menu bar has NO transport (⏮ ▶ ⏭ ⏸ ⏹ ⏪ ⏩); pvPause / pvStop no longer need ⏸",
      !d.querySelector("#tlbar .transport") && ["tlToStart", "tlPlay", "tlToEnd", "tlPause", "tlStop", "tlStepBack", "tlStepFwd"].every((id) => !$(id))
      && (() => { try { w.pvStop(); return true; } catch (e) { return false; } })(), null);
    const T = w.tlState();
    const oldV = T.video; T.video = [{ name: "a.mp4", start: 0, dur: 10, in: 0, out: 10, opacity: 1 },
                                     { name: "b.mp4", start: 10, dur: 6, in: 0, out: 6, opacity: 1 }];
    const oldSel = T.sel; T.sel = null;
    w.renderTimeline();
    w.tlGotoEnd();
    const atEnd = w.eval("playhead");
    w.tlGotoStart();
    const atStart = w.eval("playhead");
    w.tlStep(1, false); w.tlStep(1, false);
    const two = w.eval("playhead");
    w.tlStep(1, true);
    const sec = w.eval("playhead");
    w.tlStep(-1, false);
    const back = w.eval("playhead");
    w.tlGotoStart(); w.tlStep(-1, false);
    const floor = w.eval("playhead");
    check("...tlGotoEnd parks the marker at the last frame with content (16 s), ⏮ at 0",
      atEnd === 16 && atStart === 0, [atEnd, atStart]);
    check("...tlStep moves ONE frame (1/24 s), Shift steps one second, never before 0",
      Math.abs(two - 2 / 24) < 1e-9 && Math.abs(sec - (2 / 24 + 1)) < 1e-9
      && Math.abs(back - (1 / 24 + 1)) < 1e-9 && floor === 0, [two, sec, back, floor]);
    // the marker head rides the visible top of the scroll box
    const sc = $("tlscroll");
    Object.defineProperty(sc, "scrollTop", { configurable: true, get: () => 57, set() {} });
    sc.dispatchEvent(new w.Event("scroll"));
    const v1 = $("tlinner").style.getPropertyValue("--phtop");
    w.renderTimeline();
    const v2 = $("tlinner").style.getPropertyValue("--phtop");
    delete sc.scrollTop;
    check("...scrolled down 57 px, the marker's head and grab tab sit at the visible top (--phtop 57px, on scroll AND after a repaint)",
      v1 === "57px" && v2 === "57px", [v1, v2]);
    check("...the CSS puts the head, the grab tab and the preview cursor's head at --phtop",
      /#playhead::after \{[^}]*top: var\(--phtop, 0px\)/.test(HTML)
      && /#playhead \.phgrab \{[^}]*top: var\(--phtop, 0px\)/.test(HTML)
      && /#playcursor::after \{[^}]*top: var\(--phtop, 0px\)/.test(HTML)
      && /#playcursor \.pcgrab \{[^}]*top: var\(--phtop, 0px\)/.test(HTML), null);
    check("...a repaint KEEPS the scroll position (emptying the track box used to snap a scrolled-down timeline back to the top on every drag); proved in Chromium by the probe",
      /function renderTimeline\(\) \{\s*const sc = \$\("tlscroll"\);\s*const keepT = sc \? sc\.scrollTop : 0, keepL = sc \? sc\.scrollLeft : 0;\s*renderTimelineBody\(\);\s*if \(sc\) \{ sc\.scrollTop = keepT; sc\.scrollLeft = keepL; \}/.test(HTML), null);
    T.video = oldV; T.sel = oldSel;
    w.renderTimeline();
  }

  /* ===== image editor dock (2.108.0) ===== */
  {
    check("there is an Image editor dock below the timeline with its own splitter and toolbar button",
      $("imageeditdock") && $("imageeditdock").nextElementSibling && $("imageeditdock").nextElementSibling.dataset.hresize === "eh"
      && $("timelinedock").compareDocumentPosition($("imageeditdock")) & 4 && $("tIE"), null);
    check("...it ships collapsed and the toolbar button opens it", $("imageeditdock").classList.contains("collapsed"), $("imageeditdock").className);
    $("tIE").click();       // 2.198.0: press 1 on a visible dock = full hide
    check("...press one HIDES it entirely (2.198.0 statusbar contract)",
      $("imageeditdock").classList.contains("dockgone") && !$("tIE").classList.contains("on"),
      $("imageeditdock").className);
    $("tIE").click();       // press 2 = show, and showing UN-collapses
    check("...press two shows it OPEN (a collapsed dock un-collapses on show)",
      !$("imageeditdock").classList.contains("dockgone")
      && !$("imageeditdock").classList.contains("collapsed")
      && $("tIE").classList.contains("on"), $("imageeditdock").className);
    check("the dock is in the layout record so its size/state persist", w.layoutState().imageeditdock && w.layoutState().imageeditdock.height > 0, w.layoutState().imageeditdock);
    /* 2.223.14: the imageeditdock GLUE moved into its folder (mount.js, by
       instruction) — these pins read it from its new home; the boot call in
       the shell is the optional form so a removed docker no-ops. */
    const GLUE = fs.readFileSync(path.join(__dirname, "..", "ext", "imageeditdock", "mount.js"), "utf8");
    check("the page loads the imageeditdock extension's imageedit.js and mounts it into #ieHost at boot",
      /<script src="\/ext\/imageeditdock\/imageedit\.js\?v=[0-9.]+"><\/script>/.test(HTML)
      && /<script src="\/ext\/imageeditdock\/mount\.js\?v=[0-9.]+"><\/script>/.test(HTML)
      && /if \(window\.mountImageEditor\) window\.mountImageEditor\(\);/.test(HTML)
      && /ImageEdit\.mount\(\$\("ieHost"\)/.test(GLUE), null);
    check("the editor toolbar has its own Infill style dropdown (imageedit.js), the style form an Inpaint workflow field (2.109.0)",
      /<select id="ieStyle"/.test(fs.readFileSync(path.join(__dirname, "..", "ext", "imageeditdock", "imageedit.js"), "utf8"))
      && $("s_stinpaint") && /inpaint_workflow: \$\("s_stinpaint"\)/.test(HTML) && /function paintIeStyles\(\)/.test(GLUE)
      && /flux fill inpaint/i.test(GLUE.match(/function paintIeStyles[\s\S]{0,600}/)[0]), null);
    // 2.332.0: the ✨ AI panel posts /api/aiedit (mode, prompt, style_id, strength, count ...)
    check("the glue maps gallery / asset / reference drops to a URL, saves into Images, and posts /api/aiedit with crop+mask+rgba+mode+style",
      /kind === "images"\) return \{ url: `\/outputs\//.test(GLUE) && /fetch\("\/api\/aiedit", \{ method: "POST", body: fd \}\)/.test(GLUE)
      && /"mode", "prompt", "style_id", "strength", "count"/.test(GLUE) && /fd\.append\("hint", "images"\)/.test(GLUE), null);
    $("tIE").click();
  }


/* ---- 2.231.0 (Tim verbatim): "in the menubar of the music docker add a
 * button - Create video - make a create video dialog, style of video,
 * characters,locations etc.  use the lyrics and details to send to llm,
 * llm will create the screenplay and pass it to video-docker" ----------- */
{
  const d = w.document;
  const fsx = require("fs"), px = require("path");
  check("music docker: 🎬 Create video sits at the RIGHT of the 2.240.0 menubar (#muBar, margin-left:auto), no longer in the dock head",
        (() => { const b = d.getElementById("muVidBtn");
                 return !!b && b.closest("#muBar") !== null
                     && b.closest(".bhead") === null
                     && b.style.marginLeft === "auto"
                     && /Create video/.test(b.textContent); })());
  check("the dialog holds style-of-video, characters, locations, scene count, Go and Cancel",
        ["muVidDlg", "muVidStyle", "muVidCast", "muVidEnvs", "muVidScenes",
         "muVidGo", "muVidCancel", "muVidMsg"].every((id) => !!d.getElementById(id)));
  const MJ = fsx.readFileSync(px.join(__dirname, "..", "ext", "musicdock", "musicdock.js"), "utf8");
  check("Go stores the 🎭 selection first (the selection IS the reference chain), then rides the SAME /api/screenplay writer",
        MJ.includes('fetch("/api/characters/cast", { method: "PUT"')
        && MJ.includes('fetch("/api/screenplay", { method: "POST"')
        && MJ.indexOf('"/api/characters/cast", { method: "PUT"')
           < MJ.indexOf('"/api/screenplay"'));
  check("the brief names the scene count (>=2 engages the iterative writer), the style, the ticked locations, and folds the LYRICS in as the story",
        MJ.includes('"Create a MUSIC VIDEO screenplay for this song in " + n')
        && MJ.includes('" Video style: " + style')
        && MJ.includes('" Locations to use: " + envs.join(", ")')
        && MJ.includes("THE LYRICS:"));
  check("empty lyrics and an empty cast are refused in words; the answer points at the StoryBoard",
        MJ.includes("the lyrics box is empty")
        && MJ.includes("tick at least one character")
        && MJ.includes("Open the StoryBoard"));
}

console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
