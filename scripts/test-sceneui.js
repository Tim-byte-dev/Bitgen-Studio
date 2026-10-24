// bitGen Studio — the Video docker's scene board + environments UI, rendered
// for real (jsdom + the page's own markup + static/characters.js executed)
// with canned data, then every control asserted to EXIST and to hit the right
// endpoint when used.
//
// WHY THIS TEST EXISTS (2.142.1): the 2.140.0 ⏫ upscale button was added by
// a scripted edit whose needle didn't match — python's str.replace no-ops
// silently — so the handler shipped but the button never rendered, and no
// test noticed because nothing asserted the DOM. A UI feature is not shipped
// until a test has SEEN it. Run from repo root: node scripts/test-sceneui.js
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const PAGE = require("../lib/extensions").pageHtml(require("path").join(__dirname, ".."));


let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log("PASS: " + name); pass++; }
  else { console.log("FAIL: " + name + (extra !== undefined ? " -> " + JSON.stringify(extra) : "")); fail++; }
}

const html = PAGE;
const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
const w = dom.window, d = w.document;

const calls = [];
const bodies = {};        // url -> last POSTed body (2.146.0 edit assertions)
const canned = {
  "/api/scenes/workflow/reset": { ok: true, file: "MM3_Characters_tmp.json",
    cast: 2, notes: ["cast wired"] },
  "/api/scenes/refs": { ok: true, tag: "pose_horse", chapter: "",
    refs: { "Act One": [{ file: "pose_horse.png", label: "pose_horse", tag: "pose_horse",
                          type: "pose", description: "rearing, front legs high" }],
            "": [{ file: "barn_low.png", label: "barn low sun", tag: "barn_low",
                   type: "location", description: "low golden light" }] } },
  "/api/characters": { characters: [
    { name: "Jinx", tag: "jinx", age: "19", pronouns: "she", wardrobe: "jacket",
      images: ["sheet1.png", "sheet2.png"], voices: ["v.wav"], notes: "manic" },
    { name: "Kev", tag: "kev", age: "40", images: ["kev.png"], voices: [] }] },
  "/api/environments": { environments: [{ name: "Old Warehouse", tag: "old_warehouse",
    scenes: "1:3", yaw: 30, pitch: 0, fov: 90, pano: "pano.png", view: "view.png" }] },
  "/api/screenplay/prefix": { prefix: ["subject_definitions:", "",
    "@jinx is the character defined by the provided character reference sheet.",
    "", "voice_assignments: @jinx speaks in (S1) using the provided voice reference."] },
  "/api/scenes": { chapters: ["Act One"], plan: { shots: [] }, pending: ["c4"], list: [
    { n: 1, id: "c1", chapter: "Act One", prompt: ["[Shot 1] x"], status: "rendered",
      output: "scene1_Act_One.mp4", upscaled: "", job: "", upjob: "", updated: "" },
    { n: 2, id: "c2", chapter: "", prompt: ["y"], status: "running",
      output: "", upscaled: "", job: "j", upjob: "", updated: "",
      error: "" },
    { n: 4, id: "c4", chapter: "", prompt: ["[Shot 4]", "the real action"],
      status: "idle", output: "", upscaled: "", job: "", upjob: "",
      error: "ComfyUI refused node 5108", updated: "" },
    { n: 3, id: "c3", chapter: "", prompt: ["z"], status: "kept",
      output: "s3.mp4", upscaled: "s3_up.mp4", job: "", upjob: "u", updated: "" }] },
};
w.fetch = (url, opts) => {
  const u = String(url).split("?")[0];
  calls.push(((opts || {}).method || "GET") + " " + u);
  if ((opts || {}).body) bodies[u] = String(opts.body);
  return Promise.resolve({ ok: true, json: () =>
    Promise.resolve(canned[u] || { ok: true, changed: true,
      ...canned["/api/scenes"], ...canned["/api/environments"] }) });
};
global.window = w; global.document = d;
// characters.js calls bare fetch(); without this it would resolve to Node's
// REAL fetch and every call would fail silently into the UI's catch(){} —
// exactly the class of quiet no-op this test exists to catch.
global.fetch = w.fetch; global.FormData = w.FormData;

const errors = [];
w.addEventListener("error", (e) => errors.push(e.message));
try {
  new Function(fs.readFileSync(path.join(__dirname, "..", "ext", "videodock", "characters.js"),
                               "utf8")).call(w);
} catch (e) { errors.push("characters.js threw on load: " + e.message); }

const tick = () => new Promise((r) => setTimeout(r, 250));

(async () => {
  await tick(); await tick();
  check("characters.js runs against the real page without throwing",
        errors.length === 0, errors);

  // ---- the scene board renders its controls ------------------------------
  check("a scene card renders per scene",
        d.querySelectorAll("[data-sc]").length === 4);
  check("a FAILED scene shows its reason on the card — never a silent idle",
        /ComfyUI refused node 5108/.test(
          (d.querySelector('[data-sc="4"]') || { innerHTML: "" }).innerHTML));
  check("the card preview skips a bare [Shot N] marker and shows the action",
        /the real action/.test(
          (d.querySelector('[data-sc="4"]') || { innerHTML: "" }).innerHTML));
  check("every scene has a play button; a running scene's is disabled",
        d.querySelectorAll("[data-scplay]").length === 4
        && d.querySelector('[data-scplay="2"]').disabled === true);
  check("a RENDERED scene shows the ⏫ upscale button (the 2.140.0 regression)",
        !!d.querySelector('[data-scup="1"]'));
  check("a RUNNING scene has no upscale button",
        !d.querySelector('[data-scup="2"]'));
  // 2.391.1 (Tim: "put the scenes in a dropdown" - "Both"): the scene PICKER - All scenes or one card only
  {
    const pk = d.getElementById("scPick"), vis = () => [...d.querySelectorAll("#scList .sccard[data-sc]")].filter((c) => c.style.display !== "none").map((c) => c.getAttribute("data-sc")).join();
    const opts = pk ? [...pk.options].map((o) => o.value + "=" + o.textContent) : [];
    check("2.391.1: the scene picker lists All scenes (4) + every scene in board order with its state (● rendered, ⏳ rendering, ✕ failed, ✔ kept) and its first words",
          opts.length === 5 && opts[0] === "=All scenes (4)" && opts[1] === "1=● Scene 1 · x" && opts[2] === "2=⏳ Scene 2 · y"
          && opts[3] === "4=✕ Scene 4 · the real action" && opts[4] === "3=✔ Scene 3 · z" && vis() === "1,2,4,3", opts);
    pk.value = "4"; pk.dispatchEvent(new w.Event("change", { bubbles: true }));
    let kept = true; try { kept = w.localStorage.getItem("h3.scpick") === "4"; } catch { kept = true; }   // jsdom without an origin has no storage
    check("...picking Scene 4 shows its card only (kept for the next paint)", vis() === "4" && kept, vis());
    d.getElementById("scPickNext").click();
    const v3 = vis();
    d.getElementById("scPickNext").click();
    check("...▶ steps to the next scene in board order and wraps round to the first; ◀ goes back", v3 === "3" && vis() === "1"
          && (d.getElementById("scPickPrev").click(), vis() === "3"), [v3, vis()]);
    pk.value = ""; pk.dispatchEvent(new w.Event("change", { bubbles: true }));
    check("...All scenes shows every card again", vis() === "1,2,4,3", vis());
  }
  check("a scene already in the upscale queue shows ⏫ disabled",
        d.querySelector('[data-scup="3"]')
        && d.querySelector('[data-scup="3"]').disabled === true);
  check("icon-only buttons carry title AND aria-label",
        ["[data-scplay=\"1\"]", "[data-scup=\"1\"]"].every((s) => {
          const b = d.querySelector(s);
          return b && b.getAttribute("title") && b.getAttribute("aria-label");
        }));
  // 2.299.0 (Tim: "remove the chapter drowndown from each scene"): no
  // per-card chapter <select>; the scene's chapter still shows in its title
  check("no scene card carries a chapter dropdown; scene 1's chapter shows in its title",
        !d.querySelector("[data-scchap]")
        && /Scene 1 · Act One/.test(d.querySelector('[data-sc="1"]').textContent));
  for (const id of ["scChapAdd", "scKeep", "scRedo"])
    check(`#${id} exists`, !!d.getElementById(id));
  // 2.391.0 (Tim: "remove Start clip / Range / Redo scene / ⇥ Timeline / 🎬 Produce from videodocker")
  check("2.391.0: ⇥ Timeline, 🎬 Produce, Start clip, Range and Redo scene are gone from the video docker",
        ["scProduce", "scToTl", "chStart", "chRange", "chRedo"].every((id) => !d.getElementById(id)));

  // ---- the controls hit the right endpoints ------------------------------
  const clickAwait = async (el) => {
    if (el) el.dispatchEvent(new w.Event("click", { bubbles: true }));
    await tick();
  };
  calls.length = 0;
  await clickAwait(d.querySelector('[data-scup="1"]'));
  check("⏫ posts to /api/scenes/1/upscale",
        calls.some((c) => c === "POST /api/scenes/1/upscale"), calls);
  calls.length = 0;
  // 2.307.0: a scene WITH a take shows ↻ (redo -> a new scene_<n>_<x>
  // take); one without shows ▶ (generate); a running one ⏳, disabled
  const pb = (n) => d.querySelector('[data-scplay="' + n + '"]');
  check("2.307.0: the play button is ↻ Redo on a rendered / kept scene, ▶ on an unrendered one, ⏳ while running",
        pb(1).textContent === "↻" && pb(1).dataset.scredo === "1" && /Redo scene 1/.test(pb(1).getAttribute("aria-label"))
        && /scene_1_2/.test(pb(1).title) && pb(3).textContent === "↻"
        && pb(4).textContent === "▶" && !pb(4).dataset.scredo && /Generate scene 4/.test(pb(4).getAttribute("aria-label"))
        && pb(2).textContent === "⏳" && pb(2).disabled,
        [pb(1).textContent, pb(3).textContent, pb(4).textContent, pb(2).textContent, pb(1).title]);
  await clickAwait(pb(1));
  check("↻ on a rendered scene posts to /api/scenes/1/redo (a new take)",
        calls.some((c) => c === "POST /api/scenes/1/redo") && !calls.some((c) => c === "POST /api/scenes/1/generate"), calls);
  calls.length = 0;
  await clickAwait(pb(4));
  check("▶ on an unrendered scene posts to /api/scenes/4/generate",
        calls.some((c) => c === "POST /api/scenes/4/generate"), calls);
  calls.length = 0;
  d.querySelector('[data-sc="3"]').dispatchEvent(new w.Event("click", { bubbles: true }));
  await tick();
  // ---- 2.223.8: 🖼 NEW opens the DIALOG, the picker lives inside it ----
  {
    const SRC8 = require("fs").readFileSync(
      require("path").join(__dirname, "..", "ext", "videodock", "characters.js"), "utf8");
    check("2.223.8: clicking 🖼 NEW opens the sheet dialog EMPTY — no file dialog first",
          /el\("chNewPic"\)\.addEventListener\("click", function \(\) \{\n      chMaskShowEmpty\(\);/.test(SRC8)
          && /function chMaskShowEmpty\(\)/.test(SRC8));
    check("2.223.8: 📂 Load picture sits INSIDE the dialog and opens the picker",
          !!d.getElementById("chSheetLoad")
          && d.getElementById("cspane-sheet").contains(d.getElementById("chSheetLoad"))
          && /el\("chSheetLoad"\)\.addEventListener\("click", function \(\) \{\n      el\("chNewPicFile"\)\.click\(\);/.test(SRC8));
    check("2.223.8: with nothing loaded the canvas shows a hint, dragging is off, and ▶ Generate refuses in words",
          /Load a picture, or generate one in/.test(SRC8)
          && /if \(!chMask\.img\) return;\s+\/\/ 2\.223\.8/.test(SRC8)
          && /load a picture first \(📂\), or create one in 🎨/.test(SRC8));
  }

  // ---- 2.223.12: H3-Character_creator — Tim's H3 look-sheet workflow ----
  {
    const fsx = require("fs"), px = require("path");
    const SRCB = fsx.readFileSync(px.join(__dirname, "..", "ext", "videodock", "characters.js"), "utf8");
    const RTS = fsx.readFileSync(px.join(__dirname, "..", "routes", "characters.js"), "utf8");
    const IW = fsx.readFileSync(px.join(__dirname, "..", "misc", "image_worker.py"), "utf8");
    const CC = fsx.readFileSync(px.join(__dirname, "..", "scripts", "comfy_client.py"), "utf8");
    check("2.223.12: the workflow ships and IS Tim's export (both LoadImages, SaveImage + SaveVideo, LookSheets nodes)",
          (() => { const g = JSON.parse(fsx.readFileSync(px.join(__dirname, "..",
                     "comfy_workflows", "h3_character_creator.json"), "utf8"));
                   const cts = Object.values(g).map((n) => n.class_type);
                   return cts.includes("SaveVideo") && cts.includes("SaveImage")
                       && cts.filter((x) => x === "LoadImage").length === 2
                       && cts.includes("H3LookSheetsSelectFrames"); })());
    check("2.223.12: offered ONLY through the sheet dialog's sheetstyles listing, nowhere else",
          /concat\(\[\{ id: "h3charcreator"/.test(RTS)
          && !/h3charcreator/.test(fsx.readFileSync(px.join(__dirname, "..", "routes", "index.js"), "utf8"))
          && !/h3charcreator/.test(fsx.readFileSync(px.join(__dirname, "..", "lib", "styles.js"), "utf8")));
    check("2.223.12: sheetgen branches — comfy engine required, both LoadImage slots get the picture, synthetic style carries the workflow",
          /b\.style_id === "h3charcreator"/.test(RTS)
          && /images: \[photo, photo\]/.test(RTS)
          && /workflow: "comfy_workflows\/h3_character_creator\.json"/.test(RTS)
          && /switch it on/.test(RTS));
    check("2.223.12: the worker runs the export AS-IS — no patcher, seeds re-rolled via setdefault, saved outputs only",
          /params\.get\("h3sheet"\)/.test(IW)
          && /node\.setdefault\("inputs", \{\}\)/.test(IW)
          && /output_videos/.test(IW)
          && /it\.get\("type", "output"\) == "output"/.test(IW)
          && /def output_videos/.test(CC));
    check("2.223.12: the dialog gains a video player, shown only when a take carries a video, cleared otherwise",
          !!d.getElementById("chSheetVid")
          && /j\.vid = outs\.filter/.test(SRCB)
          && /vEl\.style\.display = "none"/.test(SRCB));
  }

  // ---- 2.223.10: the LOCATION dialog — upload or generate, 360 preview ----
  {
    const SRCA = require("fs").readFileSync(
      require("path").join(__dirname, "..", "ext", "videodock", "characters.js"), "utf8");
    check("2.223.10: 🌐 NEW opens a location dialog SIZED like the sheet dialog, two tabs",
          !!d.getElementById("envNewDlg") && !!d.getElementById("envCreDlg")
          && /max-width:min\(96vw,1960px\);width:min\(96vw,1960px\)/.test(
               d.getElementById("envCreDlg").getAttribute("style"))
          && !!d.getElementById("ectabView") && !!d.getElementById("ectabCreate"));
    for (const id of ["ecName", "ecLoad", "ec360", "ecPano", "ecPrev", "ecStrip", "ecUse",
                      "ecPrompt", "ecStyle", "ecW", "ecH", "ecSteps", "ecCfg",
                      "ecSched", "ecBatch", "ecLoraAdd", "ecGen"])
      check("2.223.10: location control #" + id + " exists", !!d.getElementById(id));
    check("2.223.10: the settings sit in an accordion and load the style's values",
          d.getElementById("ecAdv").tagName === "DETAILS"
          && /function ecApplyStyle\(\)/.test(SRCA)
          && /ecEl\("ecStyle"\)\.addEventListener\("change", ecApplyStyle\)/.test(SRCA));
    check("2.223.10: the 360 toggle rides VR360 on the pano image, off restores it",
          /window\.VR360 && window\.VR360\.attach\(im, ecEl\("ecViewWrap"\)\)/.test(SRCA)
          && /function ec360Off\(\)/.test(SRCA));
    check("2.223.10: upload goes through the tone-mapping pano route; generated picks go through pano-from",
          /\/pano",\n                \{ method: "POST", body: fd \}/.test(SRCA.replace(/\r/g, ""))
          && /\/pano-from"/.test(SRCA)
          && /pano-from", \(req, res\)/.test(require("fs").readFileSync(
               require("path").join(__dirname, "..", "routes", "characters.js"), "utf8")));
    check("2.223.10: the strip is THIS location's gens (env-prefixed), not the gallery",
          /"env " \+ \(ecName2\(\) \|\| "unnamed"\)/.test(SRCA));
  }

  // ---- 2.223.9: style settings load into the accordion; panes same size ----
  {
    const SRC9 = require("fs").readFileSync(
      require("path").join(__dirname, "..", "ext", "videodock", "characters.js"), "utf8");
    check("2.223.9: selecting a style SETS the sliders and W×H to the style's own settings",
          /function ccApplyStyle\(\)/.test(SRC9)
          && /el\("ccW"\)\.value = row\.width/.test(SRC9)
          && /el\("ccSteps"\)\.value = Math\.min\(60, row\.steps\)/.test(SRC9)
          && /Math\.round\(row\.cfg \* 2\)/.test(SRC9)
          && /sch\.value = row\.sampler/.test(SRC9)
          && /el\("ccStyle"\)\.addEventListener\("change", ccApplyStyle\)/.test(SRC9)
          && /ccApplyStyle\(\);\s+\/\/ 2\.223\.9/.test(SRC9));
    check("2.223.9: the create pane keeps the sheet pane's height (measured before the switch)",
          /el\("cspane-sheet"\)\.offsetHeight/.test(SRC9)
          && /el\("cspane-create"\)\.style\.minHeight = sh \+ "px"/.test(SRC9));
  }

  // ---- 2.223.7: the CHARACTER CREATOR tab in the sheet dialog ----
  check("2.223.7: the dialog has two tabs, sheet first, and the whole sheet UI lives in its pane",
        !!d.getElementById("cstabSheet") && !!d.getElementById("cstabCreate")
        && !!d.getElementById("cspane-sheet") && !!d.getElementById("cspane-create")
        && d.getElementById("cspane-create").style.display === "none"
        && d.getElementById("cspane-sheet").contains(d.getElementById("chMaskCanvas")));
  // 2.369.0 (Tim: "resize load image to fit in the dialog (keep aspect ratio). so the dialog doesn't resize or
  // look messy. fix the input widths. make it's appearance conform with the rest of the app")
  {
    const DOCK = fs.readFileSync(path.join(__dirname, "..", "ext", "videodock", "dock.html"), "utf8");
    check("2.369.0: the creator dialog has a FIXED height and two-column panes (the picture never resizes it)",
          /#chMaskDlg \{ padding: 0; height: min\(90vh, 980px\)/.test(DOCK)
          && /#chMaskDlg \.chPane \{[^}]*grid-template-columns: minmax\(0, 1fr\) 380px/.test(DOCK)
          && d.getElementById("cspane-sheet").classList.contains("chPane") && d.getElementById("cspane-create").classList.contains("chPane"));
    check("2.369.0: the picture sits in a stage and is scaled to FIT it, aspect kept (max-width/height 100%, auto size)",
          d.getElementById("chMaskCanvas").parentElement.classList.contains("chStage")
          && d.getElementById("ccPrev").parentElement.classList.contains("chStage")
          && !/width:100%/.test(d.getElementById("chMaskCanvas").getAttribute("style") || "")
          && /\.chStage > canvas, #chMaskDlg \.chStage > img \{[^}]*max-width: 100%; max-height: 100%;\s*width: auto; height: auto/.test(DOCK));
    check("2.369.0: the fields are full-width rows of a label/control grid (no fixed 120px / flex:1 inputs), ✕ in the header",
          !!d.getElementById("chOptGender").closest(".chForm") && !!d.getElementById("chOptDesc").closest(".chForm")
          && !!d.getElementById("ccLoraSel").closest(".chForm") && !/width:120px/.test(d.getElementById("chOptGender").getAttribute("style") || "")
          && !!d.getElementById("chMaskCancel").closest(".chHead"));
  }
  for (const id of ["ccPrev", "ccPrompt", "ccStyle", "ccStrip", "ccMakeSheet",
                    "ccW", "ccH", "ccSteps", "ccCfg", "ccSched", "ccBatch",
                    "ccLoraFolder", "ccLoraSel", "ccLoraW", "ccLoraAdd", "ccLoraList", "ccGen", "ccStat"])
    check("2.223.7: creator control #" + id + " exists", !!d.getElementById(id));
  check("2.223.7: size/steps/cfg/scheduler/batch sit in an ACCORDION (a real <details>)",
        d.getElementById("ccAdv").tagName === "DETAILS"
        && d.getElementById("ccAdv").contains(d.getElementById("ccSched"))
        && d.getElementById("ccAdv").contains(d.getElementById("ccBatch")));
  const CCSRC = require("fs").readFileSync(
    require("path").join(__dirname, "..", "ext", "videodock", "characters.js"), "utf8");
  check("2.223.7: the strip is THIS character's gens, not the gallery",
        /\/api\/characters\/gens\?name=/.test(CCSRC)
        && /gens", \{ method: "POST"/.test(CCSRC));
  check("2.223.7: generate posts /api/genimage with the accordion overrides + LoRAs, then polls the job",
        /fetch\("\/api\/genimage"/.test(CCSRC) && /body\.sampler = el\("ccSched"\)\.value/.test(CCSRC)
        && /body\.extra_loras = ccLoras/.test(CCSRC) && /\/api\/jobs\//.test(CCSRC));
  check("2.223.7: Create-character-sheet hands the SELECTED image to chMaskOpen and flips to the sheet tab",
        /chMaskOpen\(img, decodeURIComponent/.test(CCSRC) && /csTab\("sheet"\)/.test(CCSRC));
  check("2.223.7: the gens routes + the sampler passthrough exist server-side",
        /\/api\/characters\/gens/.test(require("fs").readFileSync(
          require("path").join(__dirname, "..", "routes", "characters.js"), "utf8"))
        && /p\.sampler = b\.sampler\.trim/.test(require("fs").readFileSync(
          require("path").join(__dirname, "..", "routes", "index.js"), "utf8")));

  // 2.223.6 (by instruction): NOTHING plays inline in the video docker —
  // the take bar shows for a scene with output, ▶ opens the floating
  // dialog with the UPSCALED take, ✕ stops and clears it.
  check("2.223.6: no inline preview element remains in the docker",
        !d.getElementById("scPreview"));
  check("2.223.6: a kept scene shows the take bar (watch/keep/redo), nothing playing",
        d.getElementById("scPrevBtns").style.display === "flex"
        && !!d.getElementById("scWatch")
        && (d.getElementById("scWatchVid").getAttribute("data-src") || "") === "");
  await clickAwait(d.getElementById("scWatch"));
  check("2.223.6: ▶ loads the UPSCALED take into the FLOATING dialog on demand",
        (d.getElementById("scWatchVid").getAttribute("data-src") || "")
          .indexOf("s3_up.mp4") >= 0
        && d.getElementById("scWatchDlg").tagName === "DIALOG",
        d.getElementById("scWatchVid").getAttribute("data-src"));
  await clickAwait(d.getElementById("scWatchClose"));
  check("2.223.6: ✕ stops the player and clears the src — no silent playback",
        (d.getElementById("scWatchVid").getAttribute("data-src") || "") === ""
        && !d.getElementById("scWatchVid").getAttribute("src"));

  // ---- THE EDITABLE BOARD (2.146.0, by instruction) ----------------------
  // add scene, editable prompts with icon-only save, the shared prompt with
  // save + populate-from-cast. Every control must be SEEN (the 2.142.1 rule)
  // and hit its endpoint.
  for (const id of ["scAdd", "scPrefix", "scPrefixSave", "scPrefixGen"])
    check(`#${id} exists`, !!d.getElementById(id));
  check("the prefix buttons are icon-only WITH title and aria-label",
        ["scPrefixSave", "scPrefixGen"].every((id) => {
          const b = d.getElementById(id);
          return b && b.getAttribute("title") && b.getAttribute("aria-label"); }));
  check("every scene card carries an editable prompt and an icon-only save",
        d.querySelectorAll("[data-scedit]").length === 4
        && d.querySelectorAll("[data-scsave]").length === 4
        && d.querySelector('[data-scsave="1"]').getAttribute("title")
        && d.querySelector('[data-scsave="1"]').getAttribute("aria-label"));
  check("the card editor holds the WHOLE prompt, every line",
        d.querySelector('[data-scedit="4"]').value === "[Shot 4]\nthe real action",
        d.querySelector('[data-scedit="4"]').value);
  // ---- NO PER-CARD DURATION (2.171.0, by instruction: "remove the
  // duration from each scene... use the default duration for all scenes,
  // the workflow doesn't like scenes of different lengths") --------------
  check("NO scene card carries a per-scene duration input anymore",
        d.querySelectorAll("[data-scdur]").length === 0);
  check("the one duration control (#scDefDur) remains, titled for ALL scenes",
        !!d.getElementById("scDefDur")
        && /EVERY scene/i.test(d.getElementById("scDefDur").getAttribute("title") || ""),
        d.getElementById("scDefDur") && d.getElementById("scDefDur").getAttribute("title"));
  // ---- THE EDIT DIALOG (2.179.0, by instruction: "add an edit button to
  // each scene... open a dialog with an editor... same size as the settings
  // dialog") --------------------------------------------------------------
  if (!d.defaultView.HTMLDialogElement.prototype.showModal) {
    d.defaultView.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    d.defaultView.HTMLDialogElement.prototype.close = function () { this.open = false; };
  }
  check("every scene card carries an ✎ edit button, titled",
        d.querySelectorAll("[data-scmodal]").length === 4
        && /editor dialog/.test(d.querySelector('[data-scmodal="1"]').getAttribute("title")));
  check("the dialog SHARES the settings dialog's size rule — one CSS selector, no drift",
        /#settings,\s*#scEditDlg\s*\{[^}]*min\(1240px, 96vw\)/.test(html));
  await clickAwait(d.querySelector('[data-scmodal="2"]'));
  const dlg = d.getElementById("scEditDlg");
  check("✎ opens the dialog with the scene named and the prompt prefilled",
        dlg.open === true
        && /Scene 2/.test(d.getElementById("scEditTitle").textContent)
        && d.getElementById("scEditText").value === "y",
        { open: dlg.open, title: d.getElementById("scEditTitle").textContent });
  calls.length = 0;
  d.getElementById("scEditText").value = "[Shot 2] rewritten in the big editor";
  await clickAwait(d.getElementById("scEditSave"));
  check("Save posts the dialog's text to the scene's prompt and closes",
        calls.indexOf("POST /api/scenes/2/prompt") >= 0
        && /rewritten in the big editor/.test(bodies["/api/scenes/2/prompt"] || "")
        && dlg.open === false,
        { calls, open: dlg.open });
  await clickAwait(d.querySelector('[data-scmodal="3"]'));
  calls.length = 0;
  await clickAwait(d.getElementById("scEditCancel"));
  check("Cancel closes without posting anything",
        dlg.open === false && calls.length === 0, { calls, open: dlg.open });
  // ---- CHAPTER LOAD (2.182.0) --------------------------------------------
  check("the dock has the ⤓ chapter-load button beside ＋, titled",
        !!d.getElementById("scChapLoad")
        && /saved scenes/.test(d.getElementById("scChapLoad").getAttribute("title")));
  d.defaultView.bgScenes.select(null);
  d.getElementById("scChapName").value = "Act Nine";
  calls.length = 0;
  await clickAwait(d.getElementById("scChapLoad"));
  check("⤓ posts /api/scenes/load with the chapter the field names",
        calls.indexOf("POST /api/scenes/load") >= 0
        && /Act Nine/.test(bodies["/api/scenes/load"] || ""),
        bodies["/api/scenes/load"]);
  d.getElementById("scChapName").value = "";
  // ---- CHAPTER REFERENCE IMAGES (2.180.0, by instruction) ----------------
  check("the dock has the 🖼＋ add-reference button and the reference DIALOG exists",
        !!d.getElementById("scAddRef") && !!d.getElementById("scRefDlg")
        && !!d.getElementById("scRefType") && !!d.getElementById("scRefDesc")
        && /chapter/i.test(d.getElementById("scAddRef").getAttribute("title")));
  // 2.181.0 (Tim: "the reference picture dialog next to chapter doesn't
  // work"): the selection guard is GONE — the button always opens the
  // picker; with nothing selected the chapter comes from the chapter-name
  // FIELD beside it, else "".
  d.defaultView.bgScenes.select(null);
  d.getElementById("scChapName").value = "Act Two";
  await clickAwait(d.getElementById("scAddRef"));
  const rdlg = d.getElementById("scRefDlg");
  check("🖼＋ opens the DIALOG prefilled: auto name 'Picture 1', the field's chapter shown",
        rdlg.open === true
        && d.getElementById("scRefName").value === "Picture 1"
        && /Act Two/.test(d.getElementById("scRefChap").textContent),
        { open: rdlg.open, name: d.getElementById("scRefName").value });
  await clickAwait(d.getElementById("scRefSave"));
  check("Save without a file explains that the reference IS the file, dialog stays",
        /pick a picture or sound file/.test(d.getElementById("scNotes").textContent)
        && rdlg.open === true);
  d.getElementById("scRefType").value = "pose";
  d.getElementById("scRefDesc").value = "a woman riding a horse, low sun";
  Object.defineProperty(d.getElementById("scRefFile"), "files",
    { configurable: true,
      value: [new d.defaultView.File(["x"], "cape.png", { type: "image/png" })] });
  calls.length = 0;
  await clickAwait(d.getElementById("scRefSave"));
  check("Save POSTS /api/scenes/refs with the chapter and closes; the note names the tag",
        calls.indexOf("POST /api/scenes/refs") >= 0 && rdlg.open === false
        && /@pose_horse added/.test(d.getElementById("scNotes").textContent),
        { calls, note: d.getElementById("scNotes").textContent });
  d.getElementById("scChapName").value = "";
  d.defaultView.bgScenes.select(1);
  await new Promise((r) => setTimeout(r, 0));
  const strip = d.getElementById("scRefStrip");
  await clickAwait(d.getElementById("scAddRef"));
  d.getElementById("scRefName").value = "horse pose";
  Object.defineProperty(d.getElementById("scRefFile"), "files",
    { configurable: true,
      value: [new d.defaultView.File(["x"], "pose_horse.png", { type: "image/png" })] });
  calls.length = 0;
  await clickAwait(d.getElementById("scRefSave"));
  check("with a scene selected the dialog posts to ITS chapter and the note names the tag",
        calls.indexOf("POST /api/scenes/refs") >= 0
        && /@pose_horse added/.test(d.getElementById("scNotes").textContent),
        { calls, note: d.getElementById("scNotes").textContent });
  check("the strip lists the selected chapter's references by tag, with ✕",
        strip.style.display !== "none" && /@pose_horse/.test(strip.innerHTML)
        && !!strip.querySelector("[data-refdel]"), strip.innerHTML.slice(0, 140));
  calls.length = 0;
  await clickAwait(strip.querySelector("[data-refdel]"));
  check("✕ DELETEs the reference through /api/scenes/refs",
        calls.indexOf("DELETE /api/scenes/refs") >= 0, calls);
  calls.length = 0;
  await clickAwait(d.querySelector('[data-scsave="4"]'));
  check("💾 posts the prompt WITHOUT any seconds field",
        !!bodies["/api/scenes/4/prompt"]
        && !/seconds/.test(bodies["/api/scenes/4/prompt"] || ""),
        bodies["/api/scenes/4/prompt"]);
  // ▶ with an UNSAVED edit saves first (2.155.0 — the revert Tim saw),
  // now exercised through the PROMPT editor since durations left the card
  calls.length = 0;
  const ed1 = d.querySelector('[data-scedit="1"]');
  ed1.value = ed1.value + "\nan unsaved line";
  await clickAwait(d.querySelector('[data-scplay="1"]'));
  check("↻ with an unsaved prompt saves it FIRST, then redoes — in that order",
        calls.indexOf("POST /api/scenes/1/prompt") >= 0
        && calls.indexOf("POST /api/scenes/1/redo") > calls.indexOf("POST /api/scenes/1/prompt")
        && /an unsaved line/.test(bodies["/api/scenes/1/prompt"] || "")
        && !/seconds/.test(bodies["/api/scenes/1/prompt"] || ""),
        { calls, body: bodies["/api/scenes/1/prompt"] });
  calls.length = 0;
  await clickAwait(d.querySelector('[data-scplay="2"]'));
  check("▶ with nothing edited generates straight away, no needless save",
        calls.indexOf("POST /api/scenes/2/generate") >= 0
        && calls.indexOf("POST /api/scenes/2/prompt") === -1, calls);
  // ---- the console follows the render (2.158.0) --------------------------
  // "it says it's rendering, but nothing is showing in the console": the
  // console streams only the SELECTED job, and the board never selected
  // its render's. Now a running record's job is selected once as it appears.
  {
    const seen = [];
    w.selectJob = function (id) { seen.push(id); };
    canned["/api/scenes"].list[0].status = "running";
    canned["/api/scenes"].list[0].job = "job-live-1";
    await w.bgScenes.refresh();
    await w.bgScenes.refresh();   // same job again — must not re-select
    check("a running scene's job is selected in the console ONCE, and the log follows",
          seen.length === 1 && seen[0] === "job-live-1", seen);
    canned["/api/scenes"].list[0].status = "idle";
    canned["/api/scenes"].list[0].job = "";
    delete w.selectJob;
    await w.bgScenes.refresh();
  }
  calls.length = 0;
  await clickAwait(d.getElementById("scAdd"));
  check("＋ Scene posts to /api/scenes/add",
        calls.some((c) => c === "POST /api/scenes/add"), calls);
  calls.length = 0;
  const ed4 = d.querySelector('[data-scedit="4"]');
  ed4.value = "[Shot 4]\nan edited action line";
  await clickAwait(d.querySelector('[data-scsave="4"]'));
  check("💾 on a card posts the edited text to /api/scenes/4/prompt",
        calls.some((c) => c === "POST /api/scenes/4/prompt")
        && /an edited action line/.test(bodies["/api/scenes/4/prompt"] || ""),
        { calls, body: bodies["/api/scenes/4/prompt"] });
  calls.length = 0;
  await clickAwait(d.getElementById("scPrefixGen"));
  check("👥 fetches /api/screenplay/prefix and FILLS the box without saving",
        calls.some((c) => c === "GET /api/screenplay/prefix")
        && /subject_definitions:/.test(d.getElementById("scPrefix").value)
        && /@jinx/.test(d.getElementById("scPrefix").value)
        && !calls.some((c) => c === "POST /api/scenes/prefix"),
        { calls, value: d.getElementById("scPrefix").value });
  calls.length = 0;
  await clickAwait(d.getElementById("scPrefixSave"));
  check("💾 on the shared prompt posts it to /api/scenes/prefix",
        calls.some((c) => c === "POST /api/scenes/prefix")
        && /@jinx/.test(bodies["/api/scenes/prefix"] || ""),
        { calls, body: bodies["/api/scenes/prefix"] });
  // the 4-second poll must never wipe an edit in progress
  const edg = d.querySelector('[data-scedit="1"]');
  edg.focus(); edg.value = "half-typed edit";
  await w.bgScenes.refresh();
  check("a repaint while an editor has focus does not wipe the unsaved text",
        d.querySelector('[data-scedit="1"]').value === "half-typed edit",
        d.querySelector('[data-scedit="1"]').value);
  edg.blur();
  await w.bgScenes.refresh();
  check("after blur the next refresh repaints normally (the guard is not a lock)",
        d.querySelector('[data-scedit="1"]').value !== "half-typed edit");

  // ---- RENDER SELECTED (2.149.0, by instruction) -------------------------
  for (const id of ["scSelAll", "scRenderSel"])
    check(`#${id} exists, titled`, !!d.getElementById(id)
          && d.getElementById(id).getAttribute("title"));
  check("every scene card carries a selection checkbox, titled + labelled",
        d.querySelectorAll("[data-scsel]").length === 4
        && d.querySelector('[data-scsel="1"]').getAttribute("title")
        && d.querySelector('[data-scsel="1"]').getAttribute("aria-label"));
  calls.length = 0;
  await clickAwait(d.getElementById("scRenderSel"));
  check("▶ Selected with nothing ticked asks for a tick instead of posting",
        !calls.some((c) => c === "POST /api/scenes/render")
        && /tick at least one/.test(d.getElementById("scNotes").textContent),
        d.getElementById("scNotes").textContent);
  d.getElementById("scSelAll").checked = true;
  d.getElementById("scSelAll").dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  check("the select-all checkbox ticks every card",
        [...d.querySelectorAll("[data-scsel]")].every((c) => c.checked));
  const c3 = d.querySelector('[data-scsel="3"]');
  c3.checked = false;
  c3.dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  check("unticking one scene unticks select-all (it mirrors reality)",
        d.getElementById("scSelAll").checked === false);
  calls.length = 0;
  await clickAwait(d.getElementById("scRenderSel"));
  check("▶ Selected posts the ticked scene numbers, in order",
        calls.some((c) => c === "POST /api/scenes/render")
        && (bodies["/api/scenes/render"] || "").indexOf('"scenes":[1,2,4]') >= 0,
        bodies["/api/scenes/render"]);
  canned["/api/scenes"].list[1].audio = false;
  await w.bgScenes.refresh();
  check("a take PROBED silent wears the 🔇 badge (audio false is an ffprobe answer, not a guess)",
        /🔇 silent file/.test((d.querySelector('[data-sc="2"]') || { innerHTML: "" }).innerHTML),
        (d.querySelector('[data-sc="2"]') || {}).innerHTML);
  delete canned["/api/scenes"].list[1].audio;
  await w.bgScenes.refresh();
  check("a queued scene wears the ⏳ queued badge",
        (function () {
          scStatePendingProbe: {
            // the canned /api/scenes answer now includes pending c4; the
            // refresh after the POST repainted from it
            return /⏳ queued/.test(
              (d.querySelector('[data-sc="4"]') || { innerHTML: "" }).innerHTML);
          }
        })(), (d.querySelector('[data-sc="4"]') || {}).innerHTML);

  // ---- character tiles + click-to-edit (2.150.0; thumbnails 2.153.0) -----
  // 2.153.0, by instruction ("make the character image a thumbnail"): the
  // card is a compact roster row — a 56px square image, NOT the full-width
  // .slot tile it wore in 2.150.0.
  check("character cards are compact rows with a 56px THUMBNAIL, not full-width slots",
        d.querySelectorAll(".chcard").length === 2
        && d.querySelectorAll(".chcard.slot").length === 0
        && !!d.querySelector('.chcard[data-name="Jinx"] img.chthumb')
        && /width:56px/.test(d.querySelector('.chcard[data-name="Jinx"] img.chthumb')
             .getAttribute("style") || ""),
        (d.querySelector('.chcard[data-name="Jinx"]') || { innerHTML: "" }).innerHTML.slice(0, 200));
  // 2.161.0, by instruction: the C marks a CHARACTER sheet so the label
  // cannot be confused with the reference dock's "Picture 1" — but the
  // PROMPT token stays the pack's own "<Picture N>", taught in the title.
  // 2.168.0: ONE picture per character (several sheets stitch into one
  // composite), so labels are one number per character in cast order and
  // Jinx's card SAYS her two sheets are stitched.
  check("labels are ONE Picture per character — Jinx C1 (2 sheets stitched), Kev C2",
        /Picture C1 \(2 sheets stitched\)/.test(d.querySelector('.chcard[data-name="Jinx"]').innerHTML)
        && /Picture C2/.test(d.querySelector('.chcard[data-name="Kev"]').innerHTML),
        d.querySelector('.chcard[data-name="Jinx"]').innerHTML.slice(0, 200));
  check("the title teaches the REAL prompt token — <Picture N> without the C",
        /<Picture 1>/.test(d.querySelector('.chcard[data-name="Jinx"]').getAttribute("title"))
        && /not part of the prompt token/.test(d.querySelector('.chcard[data-name="Jinx"]').getAttribute("title"))
        && /<Picture 2>/.test(d.querySelector('.chcard[data-name="Kev"]').getAttribute("title")),
        d.querySelector('.chcard[data-name="Kev"]').getAttribute("title"));
  d.querySelector('.chcard[data-name="Jinx"]').dispatchEvent(new w.Event("click", { bubbles: true }));
  await tick();
  check("clicking a character opens the editor PREFILLED, name locked",
        d.getElementById("chDlgTitle").textContent === "Edit Jinx"
        && d.getElementById("chName").value === "Jinx"
        && d.getElementById("chName").readOnly === true
        && d.getElementById("chAge").value === "19"
        && d.getElementById("chPronouns").value === "she"
        && d.getElementById("chWardrobe").value === "jacket",
        { title: d.getElementById("chDlgTitle").textContent,
          age: d.getElementById("chAge").value });
  check("the editor says what exists and that uploads ADD",
        /2 sheet\(s\), 1 voice clip\(s\)/.test(d.getElementById("chDlgMsg").textContent)
        && /ADDED/.test(d.getElementById("chDlgMsg").textContent),
        d.getElementById("chDlgMsg").textContent);
  // ---- Save vs Add character (2.160.0, by instruction) -------------------
  check("while EDITING, the button reads Save — an edit updates in place, never a second character",
        d.getElementById("chSave").textContent === "Save"
        && /no new character is created/.test(d.getElementById("chSave").title || ""),
        d.getElementById("chSave").textContent);
  calls.length = 0;
  await clickAwait(d.getElementById("chSave"));
  check("Save posts the SAME name to /api/characters (the upsert) and never a create-else route",
        calls.some((c) => c === "POST /api/characters")
        && /"name":"Jinx"/.test(bodies["/api/characters"] || ""),
        { calls, body: bodies["/api/characters"] });
  check("...and after the save the dialog resets to Add character for next time",
        d.getElementById("chSave").textContent === "Add character");
  d.querySelector('.chcard[data-name="Jinx"]').dispatchEvent(new w.Event("click", { bubbles: true }));
  await tick();
  await clickAwait(d.getElementById("chCancel"));
  check("a CANCELLED edit also restores Add character (no stale Save on a New dialog)",
        d.getElementById("chSave").textContent === "Add character"
        && d.getElementById("chName").readOnly === false,
        d.getElementById("chSave").textContent);
  // ---- the detailed character sheet (2.166.0, by instruction) ------------
  check("the sheet has a TYPE dropdown (person/animal/vehicle) and the per-type fields",
        d.getElementById("chType") && d.getElementById("chSubtype")
        && d.getElementById("chBreed") && d.getElementById("chColor")
        && d.getElementById("chModel") && d.getElementById("chYear")
        && d.getElementById("chType").querySelectorAll("option").length === 4);
  check("the Pictures input takes SEVERAL files and the dialog has a clickable thumbnail",
        d.getElementById("chSheet").hasAttribute("multiple")
        && !!d.getElementById("chDlgThumb")
        && /add or change/i.test(d.getElementById("chDlgThumb").getAttribute("title") || ""));
  // ---- ＋ button + the stitch promise + clothing (2.168.0) ----------------
  check("a ＋ button beside the thumbnail opens the picture picker and its title teaches the STITCH",
        !!d.getElementById("chAddPic")
        && /STITCHED into one reference/.test(d.getElementById("chAddPic").getAttribute("title") || ""));
  {
    let clicked = 0;
    const orig = d.getElementById("chSheet").click;
    d.getElementById("chSheet").click = function () { clicked++; };
    d.getElementById("chAddPic").dispatchEvent(new w.Event("click", { bubbles: true }));
    check("＋ opens the SAME picker as the thumbnail", clicked === 1, clicked);
    d.getElementById("chSheet").click = orig;
  }
  check("Clothing is a TYPE, with subtype and color rows tagged for it",
        !!d.querySelector('#chType option[value="clothing"]')
        && d.getElementById("chSubtype").dataset.chtype.indexOf("clothing") >= 0
        && d.getElementById("chColor").dataset.chtype.indexOf("clothing") >= 0);
  d.querySelector('.chcard[data-name="Jinx"]').dispatchEvent(new w.Event("click", { bubbles: true }));
  await tick();
  check("editing prefills the thumbnail from the first sheet and counts the pictures",
        /Jinx/.test(d.getElementById("chDlgThumb").src || "")
        && /2 picture/.test(d.getElementById("chDlgPics").textContent),
        { src: d.getElementById("chDlgThumb").src,
          pics: d.getElementById("chDlgPics").textContent });
  d.getElementById("chType").value = "vehicle";
  d.getElementById("chType").dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  check("picking Vehicle shows model/year and hides wardrobe — values hidden, never erased",
        d.getElementById("chModel").style.display !== "none"
        && d.getElementById("chYear").style.display !== "none"
        && d.getElementById("chWardrobe").style.display === "none"
        && d.getElementById("chBreed").style.display === "none");
  d.getElementById("chModel").value = "Trans Am";
  d.getElementById("chYear").value = "1982";
  calls.length = 0;
  await clickAwait(d.getElementById("chSave"));
  check("Save posts the type and its detail fields",
        /"type":"vehicle"/.test(bodies["/api/characters"] || "")
        && /"model":"Trans Am"/.test(bodies["/api/characters"] || "")
        && /"year":"1982"/.test(bodies["/api/characters"] || ""),
        bodies["/api/characters"]);
  if (d.getElementById("chDlg").close) d.getElementById("chDlg").close();
  calls.length = 0;
  d.querySelector('[data-del="Kev"]').dispatchEvent(new w.Event("click", { bubbles: true }));
  await tick();
  check("✕ deletes (after confirm) and does NOT open the editor",
        d.getElementById("chDlgTitle").textContent !== "Edit Kev",
        d.getElementById("chDlgTitle").textContent);
  check("NEW resets the editor back to a clean create form",
        (function () {
          d.getElementById("chNew").dispatchEvent(new w.Event("click", { bubbles: true }));
          return d.getElementById("chDlgTitle").textContent === "New character"
              && d.getElementById("chName").readOnly === false;
        })(), d.getElementById("chDlgTitle").textContent);
  if (d.getElementById("chDlg").close) d.getElementById("chDlg").close();

  // ---- THE MOVIE FILE MENU (2.150.0, by instruction) ---------------------
  for (const id of ["mvNew", "mvName", "mvSave", "mvSel", "mvLoad", "mvCompile", "mvResetWf"])
    check(`#${id} exists`, !!d.getElementById(id));
  // 2.196.0 (by instruction): the ♻ Workflow button rebuilds the tmp
  // workflow on demand so new parameters reach the next render.
  calls.length = 0;
  await clickAwait(d.getElementById("mvResetWf"));
  check("♻ posts /api/scenes/workflow/reset and reports the rebuilt file",
        calls.some((c) => c === "POST /api/scenes/workflow/reset")
        && /workflow rebuilt: MM3_Characters_tmp\.json/.test(d.getElementById("scNotes").textContent),
        d.getElementById("scNotes").textContent);
  check("the movie bar sits at the TOP of the videodock body, before the cast",
        d.getElementById("videodock").querySelector(".bbody").children[0]
          && d.getElementById("videodock").querySelector(".bbody").children[0].id === "mvBar",
        (d.getElementById("videodock").querySelector(".bbody").children[0] || {}).id);
  calls.length = 0;
  await clickAwait(d.getElementById("mvNew"));
  check("🆕 ARMS first — no native confirm exists in Electron, so the second press fires",
        !calls.some((c) => c === "POST /api/movies/new")
        && /press 🆕 again/.test(d.getElementById("scNotes").textContent),
        d.getElementById("scNotes").textContent);
  await clickAwait(d.getElementById("mvNew"));
  check("...and the second press posts /api/movies/new",
        calls.some((c) => c === "POST /api/movies/new"), calls);
  calls.length = 0;
  await clickAwait(d.getElementById("mvSave"));
  check("💾 with no name asks for one instead of posting",
        !calls.some((c) => c === "POST /api/movies/save")
        && /name the movie/.test(d.getElementById("scNotes").textContent));
  d.getElementById("mvName").value = "The Handoff";
  await clickAwait(d.getElementById("mvSave"));
  check("💾 posts the movie name to /api/movies/save",
        calls.some((c) => c === "POST /api/movies/save")
        && /The Handoff/.test(bodies["/api/movies/save"] || ""),
        bodies["/api/movies/save"]);
  calls.length = 0;
  await clickAwait(d.getElementById("mvLoad"));
  check("📂 with nothing picked asks for a pick instead of posting",
        !calls.some((c) => c === "POST /api/movies/load"));
  calls.length = 0;
  await clickAwait(d.getElementById("mvCompile"));
  check("🎬 posts /api/movies/compile",
        calls.some((c) => c === "POST /api/movies/compile"), calls);

  // ---- delete selected / clear / default duration (2.163.0) --------------
  for (const id of ["scDelSel", "scClear", "scDefDur"])
    check(`#${id} exists, titled`, !!d.getElementById(id)
          && d.getElementById(id).getAttribute("title"));
  check("the default-duration input LOADED from the chain settings (frames → seconds)",
        d.getElementById("scDefDur").value !== "", d.getElementById("scDefDur").value);
  calls.length = 0;
  w.appConfirm = function () { return Promise.resolve(true); };
  await clickAwait(d.getElementById("scDelSel"));
  check("🗑 with nothing ticked asks for a tick instead of posting",
        !calls.some((c) => c === "POST /api/scenes/delete")
        && /tick at least one/.test(d.getElementById("scNotes").textContent));
  d.getElementById("scSelAll").checked = true;
  d.getElementById("scSelAll").dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  calls.length = 0;
  await clickAwait(d.getElementById("scDelSel"));
  await tick();
  check("🗑 Selected posts the ticked scene numbers behind an appConfirm",
        calls.some((c) => c === "POST /api/scenes/delete")
        && /"scenes":\[1,2,3,4\]/.test(bodies["/api/scenes/delete"] || ""),
        bodies["/api/scenes/delete"]);
  calls.length = 0;
  await clickAwait(d.getElementById("scClear"));
  await tick();
  check("🧹 Clear posts /api/scenes/clear behind an appConfirm",
        calls.some((c) => c === "POST /api/scenes/clear"), calls);
  w.appConfirm = function () { return Promise.resolve(false); };
  calls.length = 0;
  await clickAwait(d.getElementById("scClear"));
  await tick();
  check("a declined appConfirm posts NOTHING — the confirm is real, not decoration",
        !calls.some((c) => c === "POST /api/scenes/clear"), calls);
  delete w.appConfirm;
  calls.length = 0;
  d.getElementById("scDefDur").value = "10";
  d.getElementById("scDefDur").dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  check("the default duration posts /api/scenes/duration in SECONDS — it now applies to EVERY scene",
        calls.some((c) => c === "POST /api/scenes/duration")
        && /"seconds":10/.test(bodies["/api/scenes/duration"] || "")
        && !calls.some((c) => c === "POST /api/config"),
        { calls, body: bodies["/api/scenes/duration"] });

  // ---- environments render and act ---------------------------------------
  check("an environment row renders with its view, camera and range inputs",
        !!d.querySelector(".envrow") && !!d.querySelector('[data-envk="yaw"]')
        && !!d.querySelector('[data-envk="scenes"]'));
  check("env rows carry pano-upload and delete buttons, titled",
        !!d.querySelector("[data-envpano]") && !!d.querySelector("[data-envdel]")
        && d.querySelector("[data-envpano]").getAttribute("title"));
  calls.length = 0;
  const yaw = d.querySelector('[data-envk="yaw"]');
  yaw.value = "45";
  yaw.dispatchEvent(new w.Event("change", { bubbles: true }));
  await tick();
  check("editing the camera saves the environment",
        calls.some((c) => c === "POST /api/environments"), calls);

  // ---- the docker's HOME (2.142.2 regression) ----------------------------
  // videodock began as a grid ASIDE with no grid column; whenever it was
  // visible, auto-placement slid every dock one column over (Tim: "refs
  // button closes video docker, assets button toggles refs docker"). It must
  // stay a bdock BLOCK directly under the timeline, never a grid child.
  const vd = d.getElementById("videodock");
  check("videodock is a bdock block, not a grid aside",
        vd && vd.classList.contains("bdock") && vd.tagName !== "ASIDE");
  const mainOrder = [...d.querySelectorAll("#maincol .bdock")].map((x) => x.id);
  check("videodock sits directly under the timeline dock (Tim's instruction)",
        mainOrder.indexOf("videodock") === mainOrder.indexOf("timelinedock") + 1,
        mainOrder);
  check("the grid has exactly its five dock asides — a sixth would shift every column",
        [...d.querySelectorAll("#app > aside")].map((a) => a.id).join(",")
          === "ldock,refsdock,assetsdock,qdock,rdock",
        [...d.querySelectorAll("#app > aside")].map((a) => a.id));
  check("no stray grid splitter for a 'video' column remains",
        !d.querySelector('[data-resize="video"]'));
  check("the status bar has a Video toggle wired to the block",
        !!d.getElementById("tV")
        && vd.querySelector('[data-collapse="videodock"]') !== null);


  // ---- 2.198.0: reference THUMBNAILS in a dropdown, each editable --------
  {
    const strip = d.getElementById("scRefStrip");
    const th = strip && strip.querySelector("img.refthumb");
    check("references render as THUMBNAILS served from /api/scenes/refs/file",
          !!th && /\/api\/scenes\/refs\/file\?file=pose_horse\.png/.test(th.getAttribute("src")),
          strip && strip.innerHTML.slice(0, 200));
    check("...inside the References dropdown (header + secbody)",
          !!d.getElementById("scRefHead") && !!d.getElementById("sec-vdrefs")
          && d.getElementById("scRefHead").style.display !== "none");
    await clickAwait(th);
    check("clicking a thumbnail opens the dialog PREFILLED for editing",
          d.getElementById("scRefDlg").dataset.editFile === "pose_horse.png"
          && d.getElementById("scRefName").value === "pose_horse"
          && d.getElementById("scRefType").value === "pose"
          && d.getElementById("scRefDesc").value === "rearing, front legs high");
    d.getElementById("scRefDesc").value = "rearing, front legs high, dust motes";
    calls.length = 0;
    await clickAwait(d.getElementById("scRefSave"));
    check("saving an edit PATCHes /api/scenes/refs with the new details (file unchanged)",
          calls.some((c) => c === "PATCH /api/scenes/refs")
          && /dust motes/.test(bodies["/api/scenes/refs"] || "")
          && /pose_horse\.png/.test(bodies["/api/scenes/refs"] || ""),
          calls.concat([bodies["/api/scenes/refs"]]));
    check("...and the notes line reports the update",
          /reference updated/.test(d.getElementById("scNotes").textContent),
          d.getElementById("scNotes").textContent);
  }


  // ---- 2.198.0: statusbar toggles hide the WHOLE dock; accordion groups ---
  {
    const html = PAGE;
    check("statusbar: .dockgone hides a dock ENTIRELY (titlebar included)",
          /\.dockgone \{ display: none !important; \}/.test(html));
    const wired = ["tP", "tT", "tV", "tPv", "tC", "tMu", "tIE", "tCF"]
      .every((b) => new RegExp('\\$\\("' + b + '"\\)\\.onclick = \\(\\) => \\{? ?toggleDockGone\\(').test(html));
    check("statusbar: all 8 center-dock buttons toggle full-hide (not collapse)",
          wired && /const GONE_DOCKS = \{/.test(html)
          && !/\$\("tV"\)\.onclick = \(\) => toggleCollapse/.test(html));
    check("statusbar: hidden docks persist and restore at boot with the button lit",
          /store\.set\("g\." \+ id/.test(html)
          && /store\.get\("g\." \+ id\) === "1"/.test(html));
    for (const sec of ["vdcast", "vdscenes", "vdenv", "vdrefs"])   // 2.391.1: vdscenes is back - the scene board's dropdown
      check(`accordion: ${sec} header + body pair exists in the video docker`,
            new RegExp('data-sec="' + sec + '"').test(html)
            && new RegExp('id="sec-' + sec + '"').test(html));
    check("accordion: the video docker groups are Characters / Locations / Scenes (2.391.1: the scene board in its own dropdown)",
          />Characters</.test(html) && /data-sec="vdscenes"[^>]*><span class="caret">▾<\/span>Scenes </.test(html)
          && />Locations \(360°\)</.test(html)
          && html.indexOf('id="sec-vdscenes"') < html.indexOf('id="scList"') && html.indexOf('id="scList"') < html.indexOf("<!-- /sec-vdscenes -->"));
  }


  // ---- 2.199.0: a character FROM ONE PICTURE ------------------------------
  {
    check("the Characters accordion has the 🖼 NEW-from-picture button and hidden file input",
          !!d.getElementById("chNewPic") && !!d.getElementById("chNewPicFile")
          && d.getElementById("chNewPicFile").type === "file");
    check("...and the sheet panel with preview, name box, Add / Regenerate / Dismiss",
          !!d.getElementById("chSheetPanel") && !!d.getElementById("chSheetImg")
          && !!d.getElementById("chSheetName") && !!d.getElementById("chSheetAdopt")
          && !!d.getElementById("chSheetRegen") && !!d.getElementById("chSheetDismiss"));
    await clickAwait(d.getElementById("chSheetAdopt"));
    check("Add without a name explains itself instead of posting",
          /name the character first/.test(d.getElementById("chSheetStatus").textContent),
          d.getElementById("chSheetStatus").textContent);
    const CODE2 = require("fs").readFileSync(
      require("path").join(__dirname, "..", "ext", "videodock", "characters.js"), "utf8");
    check("the flow is wired: upload posts sheetgen, preview serves /outputs/, adopt reopens the editor",
          /\/api\/characters\/sheetgen/.test(CODE2)
          && /"\/outputs\/" \+ encodeURIComponent\(chSheetOut\)/.test(CODE2)
          && /adopt-sheet/.test(CODE2) && /card\.click\(\)/.test(CODE2));
  }


  // ---- 2.202.0: the sheet previews in a DIALOG — fullscreen, keep, discard
  {
    check("the sheet preview lives in a dialog with ⛶ fullscreen and ✕ Discard",
          d.getElementById("chSheetDlg") && d.getElementById("chSheetDlg").tagName === "DIALOG"
          && d.getElementById("chSheetDlg").contains(d.getElementById("chSheetImg"))
          && !!d.getElementById("chSheetFull")
          && /Discard/.test(d.getElementById("chSheetDismiss").textContent));
    await clickAwait(d.getElementById("chSheetFull"));   // no fullscreen API in the harness — must not throw
    check("⛶ is guarded — clicking without a fullscreen API does not throw", true);
    d.getElementById("chSheetDlg").setAttribute("open", "");
    d.getElementById("chSheetPanel").style.display = "block";
    await clickAwait(d.getElementById("chSheetDismiss"));
    check("✕ Discard closes the dialog and the panel",
          !d.getElementById("chSheetDlg").hasAttribute("open")
          && d.getElementById("chSheetPanel").style.display === "none");
    const CODE3 = require("fs").readFileSync(
      require("path").join(__dirname, "..", "ext", "videodock", "characters.js"), "utf8");
    check("the flow is wired: done opens the dialog, discard DELETEs the render, keep/regen close it",
          /chSheetDlg"\)\.showModal\(\)/.test(CODE3)
          && /DELETE/.test(CODE3) && /\/api\/outputs\/" \+ encodeURIComponent\(out\)/.test(CODE3)
          && /requestFullscreen/.test(CODE3));
  }


  // ---- 2.203.0: the subject mask — one person out of a group ------------
  {
    check("the mask dialog exists: canvas + Use selection / Whole picture / Cancel",
          d.getElementById("chMaskDlg") && d.getElementById("chMaskDlg").tagName === "DIALOG"
          && !!d.getElementById("chMaskCanvas")
          && /Use selection/.test(d.getElementById("chMaskUse").textContent)
          && !!d.getElementById("chMaskAll") && !!d.getElementById("chMaskCancel"));
    d.getElementById("chMaskDlg").setAttribute("open", "");
    await clickAwait(d.getElementById("chMaskCancel"));
    check("Cancel closes the mask dialog and clears the file input",
          !d.getElementById("chMaskDlg").hasAttribute("open")
          && d.getElementById("chNewPicFile").value === "");
    const CODE4 = require("fs").readFileSync(
      require("path").join(__dirname, "..", "ext", "videodock", "characters.js"), "utf8");
    check("the mask is wired: corner handles, move + resize with a 24px floor, blackout preview",
          /chMaskHandles/.test(CODE4) && /"nw"/.test(CODE4) && /"se"/.test(CODE4)
          && /MIN = 24/.test(CODE4) && /rgba\(0,0,0,0\.72\)/.test(CODE4));
    check("✔ composes at FULL resolution — black fills outside the box, png uploads to sheetgen",
          /naturalWidth; out\.height = img\.naturalHeight/.test(CODE4)
          && /fillStyle = "#000"/.test(CODE4)
          && /toBlob/.test(CODE4) && /chSheetUpload\(b,/.test(CODE4));
    check("a chosen file opens the MASK first — the upload happens after the choice",
          /img\.onload = function \(\) \{ chMaskOpen\(img, f\.name\); \}/.test(CODE4));
  }


  // ---- 2.205.0: options + Generate-only; autostart checkboxes ------------
  {
    check("the mask dialog carries the options: kind (person/animal/vehicle/object), gender, style (photo/2.5d/anime), description",
          d.getElementById("chOptKind") && d.getElementById("chOptKind").options.length === 4
          && !!d.getElementById("chOptGender")
          && d.getElementById("chOptStyle") && /photo/.test(d.getElementById("chOptStyle").innerHTML)
          && !!d.getElementById("chOptDesc") && !!d.getElementById("chSheetGen"));
    const CODE5 = require("fs").readFileSync(
      require("path").join(__dirname, "..", "ext", "videodock", "characters.js"), "utf8");
    check("NOTHING renders until ▶ Generate: the mask buttons only pick the mode; Generate composes",
          /chMaskUse"\)\.addEventListener\("click", function \(\) \{ chMaskPick\(true\); \}/.test(CODE5)
          && /chSheetGen"\)\.addEventListener\("click", function \(\) \{ chMaskCompose\(chMaskMode\); \}/.test(CODE5));
    check("the options ride the upload AND the regenerate",
          /chSheetLastOpts = chSheetOpts\(\)/.test(CODE5)
          && /Object\.assign\(\{ file: chSheetInput \}, chSheetLastOpts/.test(CODE5));
    check("Settings has both autostart checkboxes (ComfyUI tab + LLM tab)",
          !!d.getElementById("s_cauto") && !!d.getElementById("s_lauto")
          && d.getElementById("s_cauto").type === "checkbox");
    const HTML5 = PAGE;
    check("the Prompt dropdown's model persists to llm.last_file for the autostart",
          /llm: \{ last_file: file \}/.test(HTML5)
          && /autostart: \$\("s_cauto"\)\.checked/.test(HTML5)
          && /autostart: \$\("s_lauto"\)\.checked/.test(HTML5));
  }


  // ---- 2.206.0/2.207.0: the sheet's style is visible; poses ride a template
  // (hybrid horses: the auto-pick used to grab the first capable style
  // alphabetically, LoRAs and all; then the photo rode SLOT 1 — the image
  // being edited — so renders held onto its shapes. Now the Prompt dock's
  // styleSel IS the sheet's style, a line-drawing pose template rides slot 1,
  // and the dialog says all of it out loud.)
  {
    const CODE6 = require("fs").readFileSync(
      require("path").join(__dirname, "..", "ext", "videodock", "characters.js"), "utf8");
    // 2.577.0: the dropdown is gone - a 🧍 Pose sheet button opens a dialog of the user's own pose sheets
    // (pose_sheets/, ext/videodock/posepick.js); the pick rides the hidden #chOptPose
    check("2.577.0: the mask dialog's pose dropdown became the 🧍 Pose sheet button (+ the hidden #chOptPose the options read)",
          d.getElementById("chOptPose")
          && d.getElementById("chOptPose").tagName === "INPUT" && d.getElementById("chOptPose").type === "hidden"
          && !!d.getElementById("chPoseBtn")
          && /posepick\.js/.test(require("fs").readFileSync(require("path").join(__dirname, "..", "ext", "videodock", "ext.json"), "utf8")));
    check("2.223.4: the style LABEL became a DROPDOWN — capable styles listed with LoRA counts, refreshed each open",
          !!d.getElementById("chSheetStyleSel")
          && d.getElementById("chSheetStyleSel").tagName === "SELECT"
          && /\/api\/characters\/sheetstyles/.test(CODE6)
          && /chStyleHint\(\);/.test(CODE6.split("chMaskDraw();")[1] || ""));
    check("2.223.4: seeded from the Prompt dock's styleSel, the USER can change it, and the pick renders",
          /sel\.value = seeded \? seed : rows\[0\]\.id/.test(CODE6)
          && /style_id: \(dlgSel && dlgSel\.value\) \|\| \(sSel \? sSel\.value : ""\)/.test(CODE6));
    check("2.223.4: an incapable Prompt-dock style falls to the first capable one and the hint says why",
          /can't take the reference — using/.test(CODE6));
    check("2.223.4: the dialog is DOUBLE size (980 -> 1960, viewport-capped, width set for real)",
          /max-width:min\(96vw,1960px\);width:min\(96vw,1960px\)/.test(
            d.getElementById("chMaskDlg").getAttribute("style")));
    check("the pose choice rides the sheet options (upload AND regenerate)",
          /pose: el\("chOptPose"\)\.value/.test(CODE6));
    check("the hint reports the LoRA count and warns when the style can't take the reference",
          /no LoRAs/.test(CODE6) && /can't take the reference/.test(CODE6));
    check("the status line reports style, LoRAs and the pose template in use",
          /chSheetVia/.test(CODE6) && /LoRAs: /.test(CODE6)
          && /pose: " \+ job\.pose_name/.test(CODE6));
  }

  // ---- 2.212.0: multi-take sheets + drops into the character editor -------
  // (Tim: "keep the dialog open when generating image, allow the user to
  // generate multiple images and save images they like. in the new
  // character/edit character dialog, allow user to drag images from gallery
  // or reference images or asset images")
  {
    const CODE7 = require("fs").readFileSync(
      require("path").join(__dirname, "..", "ext", "videodock", "characters.js"), "utf8");
    check("the mask dialog holds the take strip and its in-dialog status line",
          !!d.getElementById("chSheetStrip") && !!d.getElementById("chSheetGenNote")
          && d.getElementById("chMaskDlg").contains(d.getElementById("chSheetStrip"))
          && d.getElementById("chMaskDlg").contains(d.getElementById("chSheetGenNote")));
    // ▶ Generate KEEPS the dialog open: compose never closes it — assert the
    // FUNCTION BODY, not the whole file, so a close() elsewhere can't hide one
    // here (the 2.209.0 orphan-dict lesson: assert the thing, not the report)
    const compose = (CODE7.split("function chMaskCompose")[1] || "")
      .split("el(\"chMaskUse\")")[0];
    check("▶ Generate keeps the mask dialog open — chMaskCompose never calls close()",
          compose.length > 50 && compose.indexOf("chMaskDlg\").close") < 0
          && /STAYS OPEN/.test(compose));
    check("every press is its own take: jobs accumulate, one poll drives them, the strip paints them",
          /chSheetJobs\.push\(/.test(CODE7) && /chSheetPaintStrip/.test(CODE7)
          && /chSheetTick/.test(CODE7)
          && /setInterval\(chSheetTick/.test(CODE7));
    check("a take opens the EXISTING adopt flow (preview dialog) — one path into the cast",
          /function chSheetPreview/.test(CODE7)
          && /chSheetPreview\(j\)/.test(CODE7));
    check("💾 keeps a liked take by ADOPTING it into the Images assets — never a re-save",
          /\/api\/passets\/adopt/.test(CODE7) && /kind: "images"/.test(CODE7)
          && /function chAdoptImage/.test(CODE7));
    check("✕ Discard in the preview drops ONE take and the session survives",
          /chSheetJobs = chSheetJobs\.filter/.test(CODE7)
          && /chMaskDlg"\)\.hasAttribute\("open"\)/.test(CODE7));
    check("the character dialog is a drop target with the queued-attach note",
          !!d.getElementById("chDropNote")
          && d.getElementById("chDlg").contains(d.getElementById("chDropNote"))
          && /addEventListener\("dragenter"/.test(CODE7)
          && /addEventListener\("drop"/.test(CODE7));
    check("gallery drops ADOPT first (the 2.19x lesson), asset drops attach by name, tray drops carry bytes",
          /p\.type === "output"/.test(CODE7) && /chAdoptImage\(p\.name\)/.test(CODE7)
          && /p\.type === "asset"/.test(CODE7) && /p\.type === "refimg"/.test(CODE7));
    check("dropped pictures attach at SAVE beside picked files — by name via asset-from, by bytes via the multipart route",
          /chDropQueue\.forEach/.test(CODE7) && /asset-from/.test(CODE7)
          && /q\.blob/.test(CODE7) && /q\.file/.test(CODE7));
    check("NEW, edit-open, Cancel and a successful save all reset the drop queue",
          (CODE7.match(/chDropReset\(\)/g) || []).length >= 4);
  }

  // ---- 2.214.0: a PICTURE loads into the preview tab (EXR/HDR included) ---
  // (Tim: "allow me to load a picture in the preview tab, so i can see the
  // exr previews etc")
  {
    const HTML8 = PAGE;
    check("the preview dock holds the picture element beside the player, plus the 🖼 button and picker",
          !!d.getElementById("pvImg") && !!d.getElementById("pvLoad")
          && !!d.getElementById("pvLoadFile")
          && d.getElementById("viewerwrap").contains(d.getElementById("pvImg"))
          && d.getElementById("pvLoadFile").type === "file");
    check("the picker enumerates image types plus .exr and .hdr — no wildcard",
          (() => { const a = d.getElementById("pvLoadFile").getAttribute("accept") || "";
                   return /\.exr/.test(a) && /\.hdr/.test(a)
                       && /image\/png/.test(a) && a.indexOf("image/*") < 0; })());
    check("EXR/HDR picks round-trip through /api/preview/hdr; other pictures stay client-side",
          /\/api\/preview\/hdr/.test(HTML8)
          && /previewImage\(URL\.createObjectURL\(f\), f\.name\)/.test(HTML8)
          && /URL\.createObjectURL\(await r\.blob\(\)\)/.test(HTML8));
    check("exactly ONE of player/picture shows: previewImage parks the player and every unhide path yields the picture",
          /function pvImgHide/.test(HTML8)
          && (HTML8.match(/pvImgHide\(\);/g) || []).length >= 5
          && /p\.pause\(\); p\.classList\.add\("hidden"\)/.test(HTML8));
    check("refusals and conversion errors are SPOKEN in the title line",
          /tone-mapping \$\{f\.name\}/.test(HTML8)
          && /HDR preview failed/.test(HTML8));
    check("the freed blob never leaks — hiding revokes the object URL",
          /revokeObjectURL\(im\.src\)/.test(HTML8));
    // 2.216.1: 💾 Save — the USER picks the folder via the native save
    // dialog; a cancel is silent, every real failure is spoken
    check("💾 Save exists and saves through the native folder-picking dialog",
          !!d.getElementById("pvSaveBtn")
          && /showSaveFilePicker\(\{ suggestedName: base/.test(HTML8)
          && /createWritable/.test(HTML8));
    check("…with a plain-download fallback and a spoken empty-preview refusal",
          /a\.download = base/.test(HTML8)
          && /load a picture first/.test(HTML8)
          && /AbortError/.test(HTML8));
  }

  // ---- 2.216.0: persona/backstory tabs + the 🎭 Actors dialog -------------
  {
    const CODE9 = require("fs").readFileSync(
      require("path").join(__dirname, "..", "ext", "videodock", "characters.js"), "utf8");
    check("the character dialog holds the four tabs and the 2.216.0 panes (Clothing joined in 2.224.0)",
          d.querySelectorAll("#chTabs .chtabbtn").length === 5
          && !!d.getElementById("chTabPersona") && !!d.getElementById("chTabBackstory")
          && !!d.getElementById("chPersonaIn") && !!d.getElementById("chBackstoryIn"));
    check("tab switching is wired and every open lands on Profile",
          /function chTabShow/.test(CODE9)
          && (CODE9.match(/chTabShow\("chTabProfile"\)/g) || []).length >= 3);
    check("Save carries persona and backstory to the profile",
          /persona: el\("chPersonaIn"\)/.test(CODE9)
          && /backstory: el\("chBackstoryIn"\)/.test(CODE9));
    check("the 🎭 Actors dialog exists: button, thumbnail grid, Everyone/Save",
          !!d.getElementById("chCastBtn") && !!d.getElementById("chCastDlg")
          && !!d.getElementById("chCastGrid") && !!d.getElementById("chCastAll")
          && !!d.getElementById("chCastSave"));
    check("the grid toggles ids and Save PUTs them to /api/characters/cast",
          /chCastSel\[c\.id\] = !chCastSel\[c\.id\]/.test(CODE9)
          && /fetch\("\/api\/characters\/cast", \{ method: "PUT"/.test(CODE9));
    check("an empty selection is SPOKEN as everyone-in-the-scene",
          /EVERYONE is in the scene/.test(CODE9));
  }

  // ---- 2.227.0 (Tim verbatim: "remove the extend workflow, this workflow
  // needs a node that corrupts the other h3 nodes"): the extend flows are
  // GONE; H3_Video_Ref renders EVERY scene through the native ref2va
  // export, scene n carrying scene n-1's take in ref2va's own
  // video-reference slot. What remains pinned here: the removal itself,
  // the tick-driven Produce, and the H3_Video_Ref flow. -----------------
  {
    const fsx = require("fs"), px = require("path");
    const CODE13 = fsx.readFileSync(
      px.join(__dirname, "..", "ext", "videodock", "characters.js"), "utf8");
    const RTS13 = fsx.readFileSync(
      px.join(__dirname, "..", "routes", "characters.js"), "utf8");
    check("2.227.0: the Extend checkbox, its endpoint and queueExtend are GONE from page, client and routes",
          !d.getElementById("scExtend")
          && !/scExtend/.test(CODE13)
          && !/app\.post\("\/api\/scenes\/extend"/.test(RTS13)
          && !/function queueExtend/.test(RTS13)
          && !fsx.existsSync(px.join(__dirname, "..", "comfy_workflows",
                                     "h3_video_extend.json")));
    // 2.391.0: the docker's 🎬 Produce button is gone (Tim) - the route still joins ticked / kept scenes
    check("2.227.0: /api/produce joins the given scenes, kept scenes otherwise (2.391.0: no button in the video docker)",
          !/scPost\("\/api\/produce"/.test(CODE13)
          && /Array\.isArray\(b\.scenes\)/.test(RTS13)
          && /outs = scenes\.keptOutputs\(st\)/.test(RTS13));
    check("2.223.16: the flow dropdown persists via its route and paints from the board",
          !!d.getElementById("scStyleSel")
          && /vdStylePost\(el\("scStyleSel"\)\.value, "vdWorkflow"\)/.test(CODE13)
          && /scPost\("\/api\/scenes\/style", \{ name: name \}\)/.test(CODE13)
          // 2.323.0: an unknown / retired style paints the native flow
          && /el\("scStyleSel"\)\.value = scState\.style \|\| VD_FLOWS\[0\]\[0\]/.test(CODE13)
          && /app\.post\("\/api\/scenes\/style"/.test(RTS13));
    check("2.227.0: H3_Video_Ref (2.573.0: and FastH3 Omni) routes EVERY scene to queueRefScene — no prior-take gate, no extend branch",
          /extendVideo\.isRefFlow\(st\.style\)/.test(RTS13)
          && /return queueRefScene\(project, st, r\);/.test(RTS13)
          && !/refStyle/.test(RTS13));
    check("2.227.0: scene n>1 carries scene n-1's take as ref2va's OWN video reference; a missing prior is a NOTE, not a refusal",
          /extendVideo\.priorTake\(st, n, project\)/.test(RTS13)
          && /refVids\.push\(prior\.abs\)/.test(RTS13)
          && /ref_videos: refVids/.test(RTS13)
          && /renders standalone/.test(RTS13));
    check("2.223.16: every scene rides the reference walk — sheets/mods, voices, env views, chapter pictures, global prompt",
          /function queueRefScene\(/.test(RTS13)
          && /chars\.cast\(project\)/.test(RTS13.slice(RTS13.indexOf("function queueRefScene")))
          && /ref_audios: auds/.test(RTS13)
          && /prompt_prefix/.test(RTS13.slice(RTS13.indexOf("function queueRefScene")))
          && /extendVideo\.MAX_REF_AUDIOS/.test(RTS13));
    check("2.223.16: the H3_Video_Ref style SHIPS and pins every mode to the native ref2va export",
          (() => { const st16 = JSON.parse(fsx.readFileSync(px.join(__dirname, "..",
                     "styles", "video", "H3_Video_Ref.json"), "utf8"));
                   // the SEEDER normalizes workflows to {t2va:"",ref2va:"",
                   // fl2va:""} — all blank means the top-level workflow rules
                   // (and queueRefScene pins workflows:{} on the job anyway)
                   return st16.name === "H3_Video_Ref" && st16.kind === "video"
                       && st16.workflow === "comfy_workflows/ref2va.json"
                       && Object.values(st16.workflows || {}).every((v) => !v); })());
    check("2.227.0: the reference order inside the 9-cap holds in queueRefScene — sheets/mods first, clothing, environments, chapter pictures",
          /extendVideo\.MAX_REF_IMAGES/.test(RTS13)
          && RTS13.indexOf("chars.referenceImage(c, project)",
                           RTS13.indexOf("function queueRefScene"))
             < RTS13.indexOf("activeClothing(project, r.n)",
                             RTS13.indexOf("function queueRefScene")));
    check("2.223.13: the duration comes from the docker's knob through chainOverrides — ladder-free by design",
          /extendVideo\.extendFrames\(\s*project, scenes\.chainOverrides\(project\)/.test(RTS13)
          && !/i \* 24/.test(fsx.readFileSync(px.join(__dirname, "..", "lib", "extendVideo.js"), "utf8")));
  }

  /* ---- 2.224.0 MULTI-SHEET + CLOTHING: the DOM legs (a UI feature is not
     shipped until a test has SEEN it — these run against the assembled
     page with the videodock's characters.js executed). ------------------- */
  {
    check("2.224.0: the Clothing tab button is in the character dialog and its pane exists",
          !!d.querySelector('#chDlg [data-chtab="chTabClothing"]')
          && !!d.getElementById("chTabClothing"));
    check("2.224.0: the clothing adder row renders — picture, type, color, notes, ＋",
          ["chClothFile", "chClothType", "chClothColor", "chClothNotes",
           "chClothAdd", "chClothList"].every((id) => !!d.getElementById(id)));
    check("2.224.0: the clothing tab SAYS the selection rule (mention selects, carries over)",
          /mentions its type/.test(d.getElementById("chTabClothing").textContent)
          && /carries over/.test(d.getElementById("chTabClothing").textContent));
    check("2.224.0: ＋ without a type refuses in words (nothing queues blind)",
          (() => { d.getElementById("chClothType").value = "";
                   d.getElementById("chClothAdd").click();
                   return /needs a type/.test(d.getElementById("chClothMsg").textContent); })());
    check("2.224.0: the source picker takes MULTIPLE pictures (one sheet job per source)",
          d.getElementById("chNewPicFile").hasAttribute("multiple"));
    check("2.224.0: the 🧵 Stitch bar renders (hidden until a take is done) with its hint",
          !!d.getElementById("chStitchBar") && !!d.getElementById("chStitchBtn")
          && /tick two or more/.test(d.getElementById("chStitchHint").textContent));
    check("2.228.0: 📁 Create dataset and ＋📁 Add to dataset render beside 🧬, with the hidden picker",
          !!d.getElementById("chDatasetMake") && !!d.getElementById("chDatasetAdd")
          && !!d.getElementById("chDatasetFile")
          && d.getElementById("chDatasetFile").hasAttribute("multiple"));
    check("2.228.0: the sheet creator's ＋📁 Dataset button renders with its own multi-file picker",
          !!d.getElementById("chSheetDataset")
          && !!d.getElementById("chSheetDatasetFile")
          && d.getElementById("chSheetDatasetFile").hasAttribute("multiple"));
    check("2.232.0: the create-images LoRA input is a DROPDOWN with a folder filter (comfyui + extra_model_paths), the old free-text input gone — in the character AND environment creators",
          !!d.getElementById("ccLoraFolder") && !!d.getElementById("ccLoraSel")
          && !!d.getElementById("ecLoraFolder") && !!d.getElementById("ecLoraSel")
          && !d.getElementById("ccLoraPath") && !d.getElementById("ecLoraPath")
          && d.querySelector("#ccLoraFolder option[value='*']").textContent === "all folders");
    check("2.232.0: ONE catalogue feeds both — /api/comfymodels' loras category, fetched on every dialog open, folder change repaints, ＋ reads the select",
          (() => { const J = require("fs").readFileSync(require("path").join(__dirname, "..", "ext", "videodock", "characters.js"), "utf8");
                   return J.includes('fetch("/api/comfymodels")')
                       && J.split('loraPaint("ccLoraFolder", "ccLoraSel")').length >= 3
                       && J.includes('loraPaint("ecLoraFolder", "ecLoraSel")')
                       && J.includes('(el("ccLoraSel").value || "").trim()')
                       && J.includes('(ecEl("ecLoraSel").value || "").trim()')
                       && J.includes("check Settings"); })());
    check("2.225.0: the 🧬 Extract RefMod button renders in the character dialog",
          !!d.getElementById("chRefmod")
          && /Extract RefMod/.test(d.getElementById("chRefmod").title));
    check("2.224.0: the clothing file input never uses the image-slash-star wildcard (the comment-stripper hazard)",
          !/id="chClothFile"[^>]*image\/\*/.test(
            fs.readFileSync(path.join(__dirname, "..", "static", "index.html"), "utf8")));
  }

  /* ---- 2.233.0 PICTURES IN THE PROMPT (Tim verbatim: "another dropdown
     under prompt to choose the vision model, and a + button to add
     image/images to the prompt? layout the prompt images like this website
     does. Add a Describe Image checkbox to the prompt menubar") — a UI
     feature is not shipped until a DOM test has confirmed it. ------------ */
  {
    const pd = d.getElementById("promptdock");
    check("2.233.0: the Vision dropdown sits in the llmrow beside the LLM picker",
          (() => {
            const row = pd && pd.querySelector(".llmrow");
            const v = row && row.querySelector("#visionSel");
            return !!(v && row.querySelector("#llmSel"));
          })());
    check("2.233.0: ...its empty option says what to run",
          (d.getElementById("visionSel") || { textContent: "" }).textContent
            .includes("(no vision models - run misc\\get-qwen3vl.ps1)"));
    check("2.233.0: the \uFF0B attach button and its hidden multi-image picker exist beside the prompt input",
          (() => {
            const b = d.getElementById("pdAttachBtn");
            const f = d.getElementById("pdAttachFile");
            return !!(b && f && f.multiple && f.classList.contains("hidden")
                      && pd.contains(b) && pd.contains(f));
          })());
    check("2.233.0: the picker's accept list is explicit png/jpeg/webp — never the image-slash-star wildcard",
          (() => {
            const f = d.getElementById("pdAttachFile");
            const a = (f && f.getAttribute("accept")) || "";
            return /image\/png/.test(a) && /image\/jpeg/.test(a)
                   && /image\/webp/.test(a) && !/image\/\*/.test(a);
          })(), (d.getElementById("pdAttachFile") || { getAttribute: () => "" }).getAttribute("accept"));
    check("2.233.0: the chip strip renders INSIDE the composer, ABOVE the text input, hidden when empty",
          (() => {
            const c = d.getElementById("pdChips");
            const t = d.getElementById("prompt");
            if (!c || !t || !c.classList.contains("hidden")) return false;
            const kids = Array.from(t.parentElement.children);
            return t.parentElement.classList.contains("pleft")
                   && kids.indexOf(c) > -1 && kids.indexOf(c) < kids.indexOf(t);
          })());
    check("2.233.0: the \uD83D\uDDBC Describe image checkbox lives in the prompt MENUBAR (pmBar), default ON",
          (() => {
            const bar = d.getElementById("pmBar");
            const cb = d.getElementById("pdDescribe");
            return !!(bar && cb && bar.contains(cb) && cb.checked);
          })());
    check("2.233.0: the promptdock's own script is assembled into the page",
          /\/ext\/promptdock\/promptdock\.js/.test(html));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
