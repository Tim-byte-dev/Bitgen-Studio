#!/usr/bin/env node
// Checks for the image-generation UI in static/index.html.
// Run: node scripts/test-imageui.js
//
// WHY SOURCE-LEVEL AND NOT jsdom: jsdom is not a dependency of this project, so
// a DOM test would be a test that does not run. These assertions instead guard
// the failure mode this file actually suffers from — a 6000-line single-file UI
// edited by block replacement, where a handler or an element quietly disappears
// and nothing notices until a button stops working in the browser. The handover
// records that happening more than once.
//
// The first test is the important one: the whole inline script is parsed, so a
// syntax error introduced anywhere in it fails here instead of silently killing
// every script below the break at load time.
const fs = require("fs");
const path = require("path");
const PAGE = require("../lib/extensions").pageHtml(require("path").join(__dirname, ".."));


const HTML = PAGE;

let pass = 0, fail = 0;
const check = (n, cond, got) => cond
  ? (pass++, console.log("PASS: " + n))
  : (fail++, console.log("FAIL: " + n + (got ? "\n      " + got : "")));

// ------------------------------------------------------------ syntax first
{
  const blocks = [...HTML.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]);
  check("the UI has an inline script to check", blocks.length > 0, null);
  blocks.forEach((src, i) => {
    let err = null;
    // new Function PARSES without executing, so DOM access at top level is
    // fine — we are asking "is this valid JavaScript", not running the app.
    try { new Function(src); } catch (e) { err = e.message; }
    check(`inline script block ${i + 1} parses`, err === null, err);
  });
}

// ------------------------------------------------------------- the anchors
const has = (re, n, got) => check(n, re.test(HTML), got);

has(/<button data-stab="image">Image<\/button>/,
  "Settings has an Image tab button");
has(/<div class="stab" id="stab-image">/,
  "Settings has the matching #stab-image pane");
has(/<select id="styleSel"/,
  "the prompt docker has a Style dropdown");
check("the Style dropdown sits beside the Voice dropdown",
  HTML.indexOf('id="styleSel"') - HTML.indexOf('id="voiceSel"') > 0
  && HTML.indexOf('id="styleSel"') - HTML.indexOf('id="voiceSel"') < 700,
  "styleSel is not adjacent to voiceSel");
has(/<button class="ghost ibtn" id="goImg"/,
  "there is a Generate Image button");
// ICON ONLY (2.85.0). An emoji with no text is only usable if the label lives
// somewhere a tooltip and a screen reader can both reach, so both are required
// rather than assumed.
{
  const m = /<button[^>]*id="goImg"[^>]*>([^<]*)<\/button>/.exec(HTML) || [];
  const tag = (/<button[^>]*id="goImg"[^>]*>/.exec(HTML) || [""])[0];
  check("the Generate Image button is icon only",
    (m[1] || "").trim().length <= 2, JSON.stringify(m[1]));
  check("...with its label in title= so hovering still says what it does",
    /title="[^"]{10,}"/.test(tag), tag);
  check("...and in aria-label, so it is not just an emoji to a screen reader",
    /aria-label="Generate Image"/.test(tag), tag);
}
// THE PROMPT BOX IS THE CHAT BOX (2.85.2). Its second job used to have a
// labelled button under the icon row; since 2.122.0 (by instruction) ENTER does
// it, and that slot became Abort — which is also not an icon, for the same
// reason: it is a second thing the box does, so it says which one it is.
has(/id="abortBtn"[^>]*title="[^"]{10,}"/,
  "the render can be stopped, from a labelled button");
check("the send-to-chat button is gone, and nothing still reaches for it",
  !/chatSend"\)/.test(HTML) && !/id="chatSend"/.test(HTML), null);
{
  const iconRow = (/<div class="iconrow">[\s\S]*?<\/div>/.exec(HTML) || [""])[0];
  check("Abort is not inside the icon row",
    !/id="abortBtn"/.test(iconRow), iconRow.slice(0, 120));
  // 2.164.0, by instruction: Abort (with Camera, Speak, Read replies,
  // Enhance and Clear) moved to the PROMPT MENUBAR at the top of the dock —
  // one row of actions, before the prompt itself.
  const pmBar = (/<div class="grpbar" id="pmBar"[\s\S]*?<\/div>/.exec(HTML) || [""])[0];
  check("...it lives in the prompt menubar at the dock's top, with the whole action row",
    /id="abortBtn"/.test(pmBar) && /id="camBtn"/.test(pmBar) && /id="micBtn"/.test(pmBar)
    && /id="readBack"/.test(pmBar) && /id="enhanceBtn"/.test(pmBar) && /id="promptClear"/.test(pmBar)
    && HTML.indexOf('id="pmBar"') < HTML.indexOf('id="prompt"'), pmBar.slice(0, 160));
  check("the chat dock has no input of its own any more",
    !/id="chatin"/.test(HTML), null);
  check("choosing an LLM loads it rather than only recording a preference",
    /\$\("llmSel"\)\.onchange[\s\S]{0,600}\/api\/llm\/start/.test(HTML), null);
}
/* "Under Generate" is now Generate, then the mode dropdown, then the icon row —
   so the gap grew and a byte count is the wrong way to say "adjacent". What
   actually matters is the ORDER and that nothing unrelated got between them. */
check("Generate Image sits under Generate, after the mode dropdown",
  HTML.indexOf('id="go"') < HTML.indexOf('id="genModeSel"')
  && HTML.indexOf('id="genModeSel"') < HTML.indexOf('id="goImg"'), null);
check("...and they are all still in the same control column",
  (() => {
    const col = HTML.slice(HTML.indexOf('id="go"'), HTML.indexOf('id="goImg"'));
    return !/<\/div>\s*<div class="p(left|row)"/.test(col);
  })(), null);
has(/<div class="stabs gtabs">/, "the gallery has a tab strip");
has(/data-gtab="video"[\s\S]{0,200}data-gtab="images"/,
  "the gallery tabs are Video then Images");

// every style editor control the save path reads must exist
for (const id of ["s_stylelist", "s_stylenew", "s_styledup", "s_styledel",
                  "s_stname", "s_starch", "s_stsampler", "s_stmodel", "s_stvae",
                  "s_stte", "s_ststeps", "s_stcfg", "s_stclip", "s_stwidth",
                  "s_stheight", "s_stextra", "s_stneg", "s_stloras",
                  "s_stloraadd", "s_stsave", "s_ststatus", "imgBatch"])
  has(new RegExp(`id="${id}"`), `the style editor has #${id}`);

// ...and every handler that makes them do something
for (const [sel, what] of [
  ['\\$\\("s_stsave"\\)\\.onclick', "Save style"],
  ['\\$\\("s_stylenew"\\)\\.onclick', "New style"],
  ['\\$\\("s_styledup"\\)\\.onclick', "Duplicate style"],
  ['\\$\\("s_styledel"\\)\\.onclick', "Delete style"],
  ['\\$\\("s_stloraadd"\\)\\.onclick', "Add LoRA"],
  ['\\$\\("goImg"\\)\\.onclick', "Generate Image"],
  ['\\$\\("s_starch"\\)\\.onchange', "architecture switch"],
  ['\\$\\("styleSel"\\)\\.onchange', "style selection"],
]) has(new RegExp(sel), `${what} has a handler wired`);

check("Generate Image posts to /api/genimage",
  /\/api\/genimage/.test(HTML), null);
check("the style editor talks to /api/styles",
  /\/api\/styles/.test(HTML) && /\/api\/imagearchs/.test(HTML), null);
check("the gallery asks for the image listing",
  /kind=images/.test(HTML), null);
check("styles are loaded at boot",
  /refreshStyles\(\)/.test(HTML), null);

// --------------------------------------------------- REGRESSION GUARDS
// The gallery's Video/Images strip reuses the .stabs class. An UNSCOPED
// `querySelectorAll(".stabs button")` in the settings handler meant clicking a
// gallery tab deactivated every settings tab and switched the dialog to a
// non-existent "stab-undefined" — a blank Settings dialog caused by a click
// somewhere else entirely. Both query sites must stay scoped to #settings.
check("the settings tab handler is scoped to #settings",
  !/querySelectorAll\("\.stabs button"\)/.test(HTML),
  "an unscoped .stabs query is back — a gallery tab click will blank Settings");
check("both settings tab query sites are scoped",
  (HTML.match(/querySelectorAll\("#settings \.stabs button"\)/g) || []).length >= 3,
  "expected the click handler (2 uses) and switchStab (1 use) all scoped");

// Idiom checks run against the source with COMMENTS STRIPPED. A comment that
// explains a trap ("`(l.weight || 1)` would turn every 0 back into 1") is not
// an instance of the trap, and a guard that fires on prose is a guard someone
// will eventually delete or reword around instead of trusting.
// A comment opener has to be preceded by whitespace or punctuation. Without
// that guard the `/*` inside a mime pattern (accept="image/*") reads as the
// start of a block comment and swallows the rest of the file, which silently
// hid EVERY idiom check below behind one unrelated attribute (2.134.0).
const CODE = HTML
  .replace(/<!--[\s\S]*?-->/g, " ")            // HTML comments are comments too:
  .replace(/(^|[\s;{}(,])\/\*[\s\S]*?\*\//g, "$1 ")   // the note explaining why
  .replace(/^\s*\/\/.*$/gm, " ");             // confirm() is banned is not a use of it

// THE SLIDER TRAP, in the browser this time: `(l.weight || 1)` turns every
// legitimate 0 back into 1, so a LoRA could never be switched off from the UI
// even though the server stores 0 perfectly well.
check("the LoRA slider does not use the `|| 1` truthiness idiom",
  !/weight\s*\|\|\s*1/.test(CODE),
  "found `weight || 1` — a weight of 0 will paint as 1");
check("the LoRA slider tests weight for PRESENCE",
  /l\.weight != null/.test(CODE), null);
check("the slider range reaches 0",
  /type="range" min="-1" max="2"/.test(HTML), null);

// Same trap for the numeric style fields: ?? keeps a stored 0, || would not.
for (const f of ["steps", "cfg", "clip_skip", "width", "height"]) {
  check(`a stored ${f} of 0 paints as 0 (uses ??, not ||)`,
    new RegExp(`s\\.${f} \\?\\? arch\\.defaults`).test(CODE), null);
  check(`the ${f} field does not fall back with ||`,
    !new RegExp(`s\\.${f}\\s*\\|\\|`).test(CODE), null);
}

// A .png handed to playVideo() sets it as the <video> src, fires onerror and
// blanks the player for no visible reason.
check("a finished still or SONG is not fed to the video player (2.91.1: an mp3 in a <video> is a black box)",
  /png\|jpe\?g\|bmp\|webp\|mp3\|wav\|flac\|ogg\|opus\|m4a\)\$\/i\.test\(j\.output\)/.test(HTML),
  "poll() will call playVideo() on an image or audio output");
check("native alert()/confirm() are dead: alert is rebound to the in-page dialog",
  /window\.alert = \(msg\) => \{ appNote\(msg\); \};/.test(CODE) && /id="notedlg"/.test(HTML), null);
check("...and no call site uses bare confirm() any more",
  (CODE.match(/[^A-Za-z.]confirm\(/g) || []).filter((m) => !/appConfirm|nativeConfirm/.test(m)).length === 0
  && (CODE.match(/await appConfirm\(/g) || []).length >= 15,
  (CODE.match(/await appConfirm\(/g) || []).length);

// The button must not be pressable into a guaranteed 400.
check("Generate Image is disabled for an incomplete style",
  /function updateImgBtn/.test(HTML) && /b\.disabled = true/.test(HTML), null);

// The video path must be left alone: no image code may reach for the frame
// grid, the chunk planner or the generate endpoint.
check("the image button does not touch the video generate endpoint",
  !/genimage[\s\S]{0,400}\/api\/generate\b/.test(HTML), null);

// ---------------------------------------------- ComfyUI as the image engine
for (const id of ["s_stengine", "s_stwf", "s_stwfwrap", "s_stmodellabel",
                  "s_stclipwrap", "s_stextrawrap", "s_stlorahint"])
  has(new RegExp(`id="${id}"`), `the style editor has #${id}`);
check("ComfyUI is the DEFAULT engine in the dropdown",
  /<option value="comfy">[\s\S]{0,60}<option value="sdcli">/.test(HTML),
  "sdcli must not come first — it would make a second inference engine the default");
check("switching engine repaints the form",
  /\$\("s_stengine"\)\.onchange/.test(CODE), null);
check("the form sends engine and workflow to the server",
  /engine: \$\("s_stengine"\)\.value/.test(CODE)
  && /workflow: \$\("s_stwf"\)\.value/.test(CODE), null);
// The same field means different things per engine: a path on this machine for
// sd-cli, a ComfyUI dropdown value for comfy. Saying so is what stops someone
// typing C:\models\... into a field ComfyUI resolves in its own folder.
check("the model/VAE labels change with the engine",
  /ComfyUI dropdown value/.test(CODE), null);
/* The FILESYSTEM picker must never be offered for a value ComfyUI resolves in
   its OWN folders — browsing this machine would list files ComfyUI cannot see.
   2.71.0 changed HOW that is arranged (comfy now gets a dropdown of ComfyUI's
   real models, sd-cli keeps the local picker), so this asserts the RULE rather
   than the old one-line shape it used to have: inside the text-encoder slot
   painter, addPick is reachable only on the non-comfy branch. */
{
  const fn = CODE.slice(CODE.indexOf("function paintTeSlots"));
  const body = fn.slice(0, fn.indexOf("\n}\n"));
  const comfyBranch = body.slice(body.indexOf("if (comfy) {"), body.indexOf("} else {"));
  const sdcliBranch = body.slice(body.indexOf("} else {"));
  check("the local file picker is not offered for a ComfyUI dropdown value",
    !/addPick/.test(comfyBranch) && /addPick/.test(sdcliBranch),
    { comfyBranch, sdcliBranch });
  check("a ComfyUI text-encoder slot gets a dropdown of ComfyUI's own models",
    /cmCombo\(.*"text_encoders"/s.test(comfyBranch), comfyBranch);
}
check("the workflow field DOES get a picker (it is a real file)",
  /addPick\("s_stwf", "file", "\.json"\)/.test(CODE), null);


// ---------------------------------------- image-edit styles + the Refs dock
check("the UI learns how many image slots a style's workflow has",
  /styleImgSlots/.test(CODE) && /image_slots/.test(CODE), null);
check("references are only sent when the workflow HAS slots (or the server can swap one in — Klein 9B, 2.105.0)",
  /const slots = styleImgSlots\[id\] \|\| 0;/.test(CODE)
  && /if \(\(slots > 0 && !styleRefsOptional\[id\]\) \|\| optionalRefs\)/.test(CODE),   // 2.340.0: qwen2_1 = pictures optional
  "sending images to a text-to-image workflow is refused, so it must be conditional");
check("reference pictures are saved to the project before being sent by name",
  /\/api\/passets/.test(CODE) && /body\.images = names/.test(CODE), null);
check("an edit style with an empty Refs dock says so instead of failing at ComfyUI",
  /add at least one picture to/i.test(CODE), null);

// ------------------------------- ComfyUI model dropdowns + filters (2.71.0)
// The point of these fields becoming dropdowns is that a comfy-mode value has
// to match a string ComfyUI already has. Free text is how you get "Value not in
// list"; a dropdown built from ComfyUI's own folders cannot produce one.
has(/<dialog id="cmdlg"/, "there is a ComfyUI model browser dialog");
for (const id of ["cm_folder", "cm_find", "cm_list", "cm_rescan", "cm_clear",
                  "s_stmodelcombo", "s_stvaecombo", "s_cmstatus"])
  has(new RegExp(`id="${id}"`), `the model browser has #${id}`);
check("the model list comes from the server, not from guesses",
  /\/api\/comfymodels/.test(CODE), null);
check("the Model field spans every category a workflow's loader might want",
  /cmCombo\(\$\("s_stmodelcombo"\), \$\("s_stmodel"\), cmModelCats\(\)/.test(CODE)
  && /cmData\.model_categories/.test(CODE),
  "MODEL_KEYS accepts ckpt_name, unet_name, model_name and model_path, so one "
  + "dropdown must cover checkpoints, diffusers and diffusion_models — and the "
  + "list must come from the server so the UI cannot drift from comfyModels.js");
check("the VAE field is bound to the vae folders",
  /cmCombo\(\$\("s_stvaecombo"\), \$\("s_stvae"\), \["vae"\]/.test(CODE), null);
check("a LoRA row gets its own ComfyUI dropdown",
  /cmCombo\(combo, txt, \["loras"\]/.test(CODE), null);
check("every folder filter offers All folders",
  /All folders/.test(CODE), null);
check("the folder filter has a sentinel distinct from a real folder name",
  /const CM_ALL = /.test(CODE),
  '"" is a real folder value (a file loose in the root), so All needs its own');
// A stored value that the scan cannot see must SURVIVE. Replacing it with the
// first entry would rewrite somebody's style on the next save.
check("a value missing from the scan is kept and marked, not dropped",
  /not found/.test(CODE) && /hidden by the folder filter/.test(CODE), null);
check("the text input is still the value the save path reads",
  /model: \$\("s_stmodel"\)\.value/.test(CODE)
  && /\$\("s_stmodel"\)\.style\.display = "none"/.test(CODE),
  "the dropdown must write into the input, or hand-edited styles stop round-tripping");
check("sd-cli mode shows the plain path field back",
  /\$\("s_stmodelcombo"\)\.style\.display = "none"/.test(CODE), null);
check("scan warnings are shown rather than swallowed",
  /function cmStatusLine/.test(CODE) && /warnings/.test(CODE),
  "an empty dropdown because the folder is unset looks identical to owning no models");

// ------------------ Generate Image starts ComfyUI if needed (2.73.0)
// A style carries its OWN engine, so video on sd-cli plus images through
// ComfyUI is an ordinary setup — and asking the VIDEO backend whether ComfyUI
// is needed gets that case wrong, skips the launch, and fails on a ComfyUI
// nobody started.
{
  /* IT IS A NAMED FUNCTION NOW (2.86.0): the mode dropdown runs the same path
     per `/br/` segment and needs the job id back, which an inline onclick could
     not give it. The button calls it with no argument, so its behaviour is
     unchanged — but the checks below have to read the function, not the
     assignment. */
  const fn = CODE.slice(CODE.indexOf("async function startImageJob("));
  const body = fn.slice(0, fn.indexOf("\n}\n"));
  /* 2.122.0: the button now ADDS TO THE QUEUE instead of calling
     startImageJob() itself. Two doors into the GPU is the one thing the queue
     exists to prevent, so the icon goes through it like everything else. The
     function is unchanged and is still what the runner calls. */
  check("the image button queues rather than starting a render behind the queue",
    /\$\("goImg"\)\.onclick = \(\) => \{[\s\S]{0,400}?GENQUEUE\.expand\("image"/.test(CODE)
    && /GENQUEUE\.add\(GQ,/.test(CODE), null);
  check("...and startImageJob is still what the runner calls for an image item",
    /gm === "image" \? await startImageJob\(text\)/.test(CODE), null);
  check("...and it hands back the job id, so a queued run can wait for it",
    /return j\.id;/.test(body), null);
  check("Generate Image waits for ComfyUI before submitting",
    /ensureComfyReady\(/.test(body), body.slice(0, 400));
  check("it asks by the STYLE's engine, not the video backend",
    /st\.engine \|\| "comfy"/.test(body), body.slice(0, 600));
  check("it labels the image button, not the video one, while ComfyUI loads",
    /button: \$\("goImg"\)/.test(body), body.slice(0, 600));
  check("it gives up rather than submitting a job that can only fail",
    /&&\s*!\(await ensureComfyReady\([\s\S]*?\)\)\) return null;/.test(body), body.slice(0, 800));
  const idx = CODE.indexOf("async function startImageJob(");
  check("the wait happens before the button is disabled",
    body.indexOf("ensureComfyReady") < body.indexOf('b.disabled = true'), null);
  void idx;
}
check("the launch is forced for a job whose own engine is comfy",
  /body: JSON\.stringify\(\{ force: !!o\.need \}\)/.test(CODE),
  "comfy.ensure() otherwise refuses when the VIDEO backend is sd-cli");
check("the model lists are re-read once ComfyUI answers",
  /loadComfyModels\(true\)\.then\(cmRepaintAll\)/.test(CODE),
  "a live /object_info list beats the folder-scan fallback");

// ------------- the wrong KIND of model (2.74.0) -------------
// A real render died on "Value not in list [unet_name] = flux_klein_9B/x.safetensors".
// The file existed and the name was spelled right; it was a CHECKPOINT name
// written into a diffusion_models loader key, because the merged Model dropdown
// offered all three categories regardless of what the workflow could take.
check("the Model dropdown is narrowed to the workflow's own loader category",
  /styleModelKinds\[curStyleId\]/.test(CODE),
  "an unnarrowed merged list lets a checkpoint name land in unet_name");
check("...but falls back to all categories when the workflow cannot be read",
  /return narrowed\.length \? narrowed : all;/.test(CODE),
  "a wrongly NARROW list hides the only model that would have worked");
check("the server decides which categories a workflow accepts",
  /model_kinds/.test(CODE), "parsing the graph in the browser would duplicate the patcher");
check("a style is checked against ComfyUI before the job is submitted",
  /async function comfyPreflight/.test(CODE) && /await comfyPreflight\(st\)/.test(CODE), null);
check("the preflight only judges when ComfyUI itself is the source",
  /cmData\.source !== "comfyui"/.test(CODE),
  "a folder-scan list disagreeing with ComfyUI proves nothing");
check("a blank override is not treated as a bad value",
  /if \(!v\) continue;/.test(CODE), "blank means 'use the workflow's own'");
check("a case- or separator-only difference names the exact spelling to use",
  /const near = names\.find/.test(CODE), null);
// the resolved folder must be visible: "empty dropdowns" and "reading a
// different ComfyUI install" look identical until you can see which folder
check("the resolved ComfyUI folder is shown under the fields",
  /folder: \$\{cmData\.dir\}/.test(CODE), null);
check("per-category counts are shown, not just a total",
  /text_encoders", "loras"\]/.test(CODE),
  "'the VAE list is empty' is a different fault from 'everything is empty'");

// ---------- Start ComfyUI / rescan from the Image tab (2.76.0) ----------
has(/id="s_cmstart"/, "the Image tab has a Start ComfyUI button");
{
  const fn = CODE.slice(CODE.indexOf("async function cmStartAndScan"));
  const body = fn.slice(0, fn.indexOf("\n}\n"));
  check("it launches ComfyUI and waits for the API",
    /ensureComfyReady\(\{ button: b, need: true \}\)/.test(body), body.slice(0, 500));
  // The whole point of pressing it HERE is to watch the dropdowns fill, so the
  // rescan must not be left to ensureComfyReady: that returns immediately when
  // ComfyUI is already up, and "the button did nothing" is what this prevents.
  check("it rescans even when ComfyUI was already running",
    /await loadComfyModels\(true\)/.test(body) && /cmRepaintAll\(\)/.test(body),
    body.slice(0, 800));
  check("it does NOT close the Settings dialog, unlike the ComfyUI tab's button",
    !/\$\("settings"\)\.close\(\)/.test(body), body.slice(0, 800));
  check("it re-enables and relabels itself however it ends",
    /finally \{/.test(body) && /b\.disabled = false/.test(body), body.slice(0, 900));
}
// The folder comes from Settings → ComfyUI. A second folder box here would be a
// second thing to keep in step, and the first time they disagreed nobody would
// know which one had launched what.
check("the launch folder is the one in Settings → ComfyUI, not a second copy",
  !/id="s_cmdir"/.test(CODE) && /Settings → ComfyUI/.test(CODE), null);
check("the button says which of its two jobs it will do",
  /function cmPaintStartBtn/.test(CODE) && /Rescan model folders/.test(CODE),
  "a label that never changes cannot tell you ComfyUI is already running");
check("the launch bar is hidden for an sd-cli style",
  /\$\("s_cmbar"\)\.style\.display = comfy \? "" : "none"/.test(CODE),
  "an sd-cli style never touches ComfyUI");

// ---------------- media lightbox (2.80.0) ----------------
has(/<dialog id="lb">/, "there is a media lightbox dialog");
for (const id of ["lb_prev", "lb_next", "lb_in", "lb_out", "lb_fit", "lb_open",
                  "lb_stage", "lb_wrap", "lb_zoom", "lb_pos"])
  has(new RegExp(`id="${id}"`), `the lightbox has #${id}`);
check("every dock tags its thumbnails for the lightbox",
  (CODE.match(/dataset\.lbUrl/g) || []).length >= 5,
  "gallery video, gallery image, assets, reference video, reference sound, tray");
check("each pane is its own slideshow, not one global list",
  (CODE.match(/data-lb-group/g) || []).length >= 6,
  "next should mean the next thumbnail beside the one you opened");
check("zooming is anchored at the pointer, not the centre",
  /function lbZoomAt\(factor, cx, cy\)/.test(CODE),
  "centre-anchored zoom makes the edges of a large image unreachable");
check("panning is a transform, so the dialog itself never scrolls",
  /translate\(\$\{lb\.x\}px, \$\{lb\.y\}px\) scale/.test(CODE), null);
check("media is released on navigate AND on close",
  /function lbStopMedia/.test(CODE) && /addEventListener\("close", lbStopMedia\)/.test(CODE),
  "a <video> holding a src keeps buffering and can lock a deleted file");
/* CODE has its COMMENTS STRIPPED (see the top of this file), so asserting on
   comment text always fails — and would always have passed vacuously if the
   regex had been loose. Assert the behaviour: no gallery tile calls playVideo,
   while the timeline clip still does, because that IS the timeline preview. */
check("a gallery tile no longer hijacks the timeline preview",
  !/v\.onclick = \(\) => playVideo/.test(CODE), null);
check("...but a timeline clip still drives it",
  /playVideo\(c\.name\)/.test(CODE),
  "clicking a clip should preview the timeline; that is what #player is for");

// ---- lightbox chrome (2.81.0) ----
for (const id of ["lb_film", "lb_pv", "lb_nx"])
  has(new RegExp(`id="${id}"`), `the lightbox has #${id}`);
check("the dialog has a 2px border and a 5px radius",
  /#lb \{[^}]*border: 2px solid[^}]*border-radius: 5px/s.test(HTML), null);
check("nothing in the dialog shows a scrollbar",
  /#lb, \.lbstage, \.lbwrap, \.lbfilm \{ scrollbar-width: none; \}/.test(HTML),
  "panning is a transform; a scrollbar would fight it");
check("the stage height leaves room for the controls and the strip",
  /height: calc\(90vh - 152px\)/.test(HTML),
  "or the dialog itself would need to scroll");
check("the filmstrip is built once per open, not on every slide",
  /function lbFilm\(\)/.test(CODE) && /function lbFilmMark\(\)/.test(CODE),
  "rebuilding restarts each video's metadata load and loses the scroll position");
/* 2.120.0: a SECOND deliberate one arrived — the ComfyUI dock's button, which
   opens ComfyUI in a real browser window. The count is still pinned and both
   ids are named here, so an accidental third still fails this check. */
check("only the two explicit Open-externally buttons leave the app",
  // 2.223.14: the ComfyUI dock's opener moved with its docker (ext-owned
  // wiring) — the pin now counts BOTH homes so an accidental third site in
  // either still fails here
  ((HTML.match(/window\.open\(/g) || []).length
   + (require("fs").readFileSync(require("path").join(__dirname, "..", "ext", "comfydock", "comfydock.js"), "utf8").match(/window\.open\(/g) || []).length) === 2
  && /id="lb_open"/.test(HTML) && /id="cfOpen"/.test(HTML),
  "a thumbnail click must never open the OS browser as well as the dialog");

// ------------------------------------------------- music + the queue dock (2.90.0)
// The Music tab is the Image tab's twin; the checks mirror the image ones so a
// block replacement that drops a handler is caught here, not in the browser.
check("Settings has a Music tab", /data-stab="music"/.test(HTML) && /id="stab-music"/.test(HTML), null);
for (const id of ["s_mulist", "s_munew", "s_mudup", "s_mudel", "s_musave", "s_muname", "s_muarch",
                  "s_muwf", "s_mumodelcombo", "s_muvaecombo", "s_mute", "s_musteps", "s_mucfg",
                  "s_mudur", "s_musampler", "s_musched", "s_mucaption", "s_mustatus", "s_mucmstart"]) {
  check(`the Music tab has #${id}`, new RegExp(`id="${id}"`).test(HTML), null);
}
check("the caption box is a textarea — it is ~1,500 characters on the template",
  /<textarea[^>]*id="s_mucaption"/.test(HTML), null);
check("Basic Settings is mode-aware (2.93.0): a video set and an image set, flipped by the dropdown",
  /id="vset"/.test(HTML) && /id="iset" class="hidden"/.test(HTML)
  && /function applyBasicMode\(\)/.test(CODE)
  && /store\.set\("genmode"[^}]*applyBasicMode\(\)/s.test(CODE), null);
check("...the image set has preset sizes, aspect, CFG + Steps sliders and the LoRA list",
  ["imgRes", "imgAr", "imgCfg", "imgSteps", "imgLoras", "imgWh"].every((id) => new RegExp(`id="${id}"`).test(HTML))
  && /id="imgCfg"[^>]*type="range"|type="range" id="imgCfg"/.test(HTML.replace(/\n/g, " ")), null);
check("...seeded from the SELECTED STYLE on every style change",
  /populateImageBasics\(\);/.test(CODE) && /\$\("imgSteps"\)\.value = st\.steps/.test(CODE)
  && /\$\("imgCfg"\)\.value = st\.cfg/.test(CODE), null);
check("...and only TOUCHED controls ride with the render (blank = the style's own)",
  /const imgTouched = \{ size: false, steps: false, cfg: false, loras: false \}/.test(CODE)
  && /imgBasicsBody\(\{ prompt: p, style_id: id/.test(CODE)
  && /if \(imgTouched\.loras\)/.test(CODE) && /body\.lora_weights = m/.test(CODE), null);
check("the video set gained a CFG slider and Steps became a slider, both with readouts",
  /type="range" id="steps"/.test(HTML) && /type="range" id="cfg"/.test(HTML)
  && /id="stepsv"/.test(HTML) && /id="cfgv"/.test(HTML)
  && /"width", "height", "steps", "cfg", "seed", "format"/.test(CODE), null);
check("the Music dock has the music style dropdown and the Generate Music button",
  /id="musicdock"/.test(HTML) && /id="musicSel"/.test(HTML) && /id="goMusic"/.test(HTML)
  && HTML.indexOf('id="musicSel"') > HTML.indexOf('id="musicdock"')
  && HTML.indexOf('id="musicSel"') < HTML.indexOf('id="chatdock"'), null);
check("...and the prompt dock no longer does (2.90.1: the song is made in its own dock)",
  !/<label style="margin-left:8px">Music<\/label>/.test(HTML)
  && !/ibtn" id="goMusic"/.test(HTML), null);
check("the Music dock sits under the timeline dock, above the chat",
  HTML.indexOf('id="musicdock"') > HTML.indexOf('id="timelinedock"')
  && HTML.indexOf('id="musicdock"') < HTML.indexOf('id="chatdock"'), null);
check("...with a lyrics box, a caption override, length/songs/seed and a status line",
  ["muLyrics", "muCaption", "muDur", "muBatch", "muSeed", "muStatus"].every((id) => new RegExp(`id="${id}"`).test(HTML)), null);
check("...its own splitter, height variable and status-bar toggle",
  /data-hresize="mh"/.test(HTML) && /--mh:/.test(HTML) && /id="tMu"/.test(HTML) && /"tMu"\)\.onclick/.test(CODE), null);
check("Generate Music sends the dock's fields only when filled (blank = the style's)",
  /body\.caption = cap/.test(CODE) && /body\.max_duration = dur/.test(CODE)
  && /body\.seed = seed/.test(CODE) && /Math\.min\(4, num\("muBatch"\)/.test(CODE), null);
check("the lyrics box is the prompt, the prompt box only a fallback",
  /function musicLyrics\(\)/.test(CODE) && /text == null \? musicLyrics\(\)/.test(CODE), null);
check("the console is never opened by code (2.90.1): only init collapses it; the user's statusbar press full-hides (2.198.0)",
  (CODE.match(/toggleCollapse\("consoledock"\)/g) || []).length === 1
  && /\$\("tC"\)\.onclick = \(\) => toggleDockGone\("consoledock", "tC"\)/.test(CODE)
  && !/contains\("collapsed"\)\) toggleCollapse\("consoledock"\)/.test(CODE),
  (CODE.match(/toggleCollapse\("consoledock"\)/g) || []).length);
check("...and it starts minimized regardless of the stored state",
  !/store\.get\("c\.consoledock"/.test(CODE) && /toggleCollapse\("consoledock"\);\n/.test(CODE), null);
check("every HORIZONTAL dock has a maximize button (2.91.1: bottom docks only)",
  ["timelinedock", "musicdock", "chatdock", "promptdock", "consoledock"]
    .every((id) => new RegExp(`class="maxbtn" data-max="${id}"`).test(HTML)), null);
check("...and the vertical (side) docks do NOT",
  ["ldock", "refsdock", "assetsdock", "qdock", "rdock"]
    .every((id) => !new RegExp(`data-max="${id}"`).test(HTML))
  && /!el\.classList\.contains\("bdock"\)\) return;/.test(CODE), null);
check("maximize grows the dock VERTICALLY in place — no fixed overlay",
  /\.bdock\.maxed \{ height: auto !important; flex: 1 1 auto/.test(HTML)
  && !/\.dock\.maxed/.test(HTML) && !/position: fixed[^}]*bottom: var\(--sbar\)/.test((HTML.match(/\.bdock\.maxed \{[^}]*\}/) || [""])[0]), null);
// 2.381.0 (Tim: "if other dockers are open they will expand to their height or max-height (the lesser value)"):
// a maximize no longer minimizes the other docks - they stay open at their own height
check("2.381.0: maximizing leaves the other docks OPEN at their height (no .minned tuck); the maximized dock flexes, never capped by its own pin",
  !/d\.classList\.add\("minned"\)/.test(CODE) && !/if \(d\.id === "promptdock"\) return;/.test(CODE)
  && /\.bdock\.maxed \{ max-height: none !important; \}/.test(HTML), null);
check("the chat sends the current selection with every message (2.92.0)",
  /gen_mode: \$\("genModeSel"\)/.test(CODE) && /image_style_id: \$\("styleSel"\)/.test(CODE)
  && /music_style_id: \$\("musicSel"\)/.test(CODE), null);
check("a code block has a 🎶 Music button that fills the Music dock, not the MV pipeline",
  /🎶 Music/.test(CODE) && /musicFromBlock\(text\)/.test(CODE) && !/🎵 Song/.test(CODE), null);
check("...whose parser knows the taught shape: metadata lines, blank line, [tagged] lyrics",
  /MU_META_RX/.test(CODE) && /theme\|genre\|type/.test(CODE) && /vocals\?\|vocal details/.test(CODE), null);
check("2.381.0: ...the splitters stay live while a dock is maximized (\"All dockers will be able to be resized ... even if they are maximized\"); the video dock keeps --vh",
  !/#maincol\.has-max \.hsplit \{ display: none; \}/.test(HTML) && !/#maincol\.has-max #previewdock:not\(\.maxed\) \{/.test(HTML)
  && /#maincol\.has-max #videodock:not\(\.maxed\):not\(\.collapsed\) \{ flex: 0 0 var\(--vh\); \}/.test(HTML), null);
check("...one at a time, Escape restores, and a dialog keeps its own Escape",
  /function toggleMax\(/.test(CODE) && /querySelectorAll\("\.bdock\.maxed"\)\.forEach/.test(CODE)
  && /e\.key !== "Escape"/.test(CODE) && /dialog\[open\]/.test(CODE), null);
check("opening a dock beside a maximize RESIZES the maximized dock instead of tearing it down (2.92.1; 2.381.0: a header click is always the user's own open / close)",
  /el\.classList\.remove\("minned"\);\s*el\.classList\.toggle\("collapsed"\);/.test(CODE)
  && !/mx && mx !== el && !el\.classList\.contains\("collapsed"\)/.test(CODE), null);
check("the standalone player drives the red marker (Task C, 2.93.0): timeupdate AND seeked",
  /addEventListener\("timeupdate", playerSyncTick\)/.test(CODE)
  && /addEventListener\("seeked", playerSyncTick\)/.test(CODE), null);
check("...with pvGlobalT's arithmetic (start + local - in) and nearest-placement choice",
  /\(c\.start \|\| 0\) \+ Math\.max\(0, L - cin\)/.test(CODE)
  && /Math\.abs\(g - \(playhead \|\| 0\)\)/.test(CODE), null);
check("...standing down while the preview clock owns the marker, and eating the seek echo once",
  /if \(pv\.seeking\) \{ pv\.seeking = false; return; \}/.test(CODE)
  && /if \(pv\.on\) return;/.test(CODE), null);
check("dropping the marker on the clip that is PLAYING seeks it in place, keeping playback",
  /curVideo === at\.clip && !p\.paused/.test(CODE)
  && /pv\.seeking = true;\s*p\.currentTime = at\.off;/.test(CODE), null);
check("Task B (2.95.0): the toolbar has playhead trims and a Keep/Cut scope",
  /id="tlTrimHead"/.test(HTML) && /id="tlTrimTail"/.test(HTML) && /id="tlScope"/.test(HTML)
  && /value="layer"/.test(HTML) && /value="clip"/.test(HTML), null);
check("...the trims post trim_head/trim_tail at the playhead with the layer's clips",
  /op: "trim_" \+ side/.test(CODE) && /at: playhead/.test(CODE), null);
check("...Keep/Cut sends the scope and the selection midpoint",
  /scope, at: \(tl\.sel\.a \+ tl\.sel\.b\) \/ 2/.test(CODE), null);
check("...compact stays a layer-scope, V1-only affair",
  /compact: scope === "layer" && lk === "v1" && ripple/.test(CODE), null);
// 2.380.0 (Tim: "only show timestart:timefinish - n ... keep the ui clean"): no explanation in the bar
check("...the selection bar shows only start:end - frames (empty without a selection; the how-to is in ❔ help)",
  /if \(!tl\.sel\) return "";/.test(CODE) && /\$\{tl\.sel\.a\.toFixed\(2\)\}:\$\{tl\.sel\.b\.toFixed\(2\)\} - \$\{Math\.round/.test(CODE)
  && !/no selection — drag on the ruler/.test(CODE), null);
check("dead selectLayer() removed (Task B finding 1)",
  !/function selectLayer\(/.test(CODE) && /function pickLayer\(/.test(CODE), null);
// 2.300.0: double-click opens the START-TIME dialog on all four clip kinds;
// the ◆ keyframe is its button (kfWire takes the clip's layer key)
check("keyframes (2.96.0): double-click → ◆ on all four clip kinds (2.300.0: via the start-time dialog)",
  /kfWire\(el, c, "video", "v1"\)/.test(CODE) && /kfWire\(el, c, "video", "vl:" \+ ti\)/.test(CODE)
  && /kfWire\(el, c, "audio", "a:" \+ ti\)/.test(CODE) && /kfWire\(el, c, "image", "i:" \+ ti\)/.test(CODE)
  && /onKeyframe: \(\) => \{\s*const k = kfAdd\(c, at, kind, lk\);/.test(CODE)   // 2.379.0: + the layer key
  && /className = "kfd"/.test(CODE) && /textContent = "◆"/.test(CODE), null);
check("...the old static-opacity double-click ask is gone",
  !/Opacity % \(fade toward black/.test(CODE) && !/Opacity % \(0-100\):/.test(CODE), null);
check("...keyframes live on the clip as kf:[{at,op?,vol?}] with AE hold-and-ramp maths",
  /function kfValue\(c, at, prop, fb\)/.test(CODE) && /window\.kfValue = kfValue/.test(CODE)
  && /H3Keyframes\.value\(c && c\.kf, at, prop, fb\)/.test(CODE), null);   // 2.379.0: the maths moved to static/keyframes.js (test-keyframes)
check("...the editor gates sliders by kind: no opacity on audio, no volume on an image",
  /kind !== "audio"/.test(CODE) && /kind !== "image"/.test(CODE)
  && /data-kfdel/.test(CODE), null);
check("...and the preview interpolates at EVERY application site",
  (CODE.match(/kfValue\(/g) || []).length >= 12
  && /kfValue\(bc, bat, "op"/.test(CODE) && /kfValue\(ac, gT - ac\.start, "vol"/.test(CODE)
  && /kfValue\(c2, gT - \(c2\.start \|\| 0\), "op"/.test(CODE), null);
check("the ControlNet chain tab (2.97.0): button, pane and all five controls",
  /data-stab="cnet"/.test(HTML) && /id="stab-cnet"/.test(HTML)
  && ["s_cnlist", "s_cnname", "s_cnfirst", "s_cnmodel", "s_cnsecond", "s_cnsave", "s_cndel"]
    .every(id => new RegExp(`id="${id}"`).test(HTML)), null);
check("...saving posts the chain and editing an existing one carries its id",
  /chain: \{ first_id: \$\("s_cnfirst"\)\.value/.test(CODE)
  && /if \(cur\) body\.id = cur\.id;/.test(CODE), null);
check("...chain styles are edited THERE only — the Image editor filters them out",
  /styleList\.filter\(s => !s\.chain\)/.test(CODE), null);
check("...the model list comes from ComfyUI's controlnet folder",
  /cmFiles\(\["controlnet"\]\)/.test(CODE), null);
check("a header button never collapses the dock it sits in",
  /closest\("button, select, input"\)\) return;/.test(CODE), null);
check("...and the mode dropdown's audio entry is labelled Music",
  /value="audio"[^>]*>[^<]*Music/.test(HTML), null);
for (const fn of ["loadMuCat", "paintMusicForm", "readMusicForm", "refreshMusicStyles",
                  "startMusicJob", "updateMusicBtn", "paintAudioTiles"]) {
  check(`${fn}() exists`, new RegExp(`function ${fn}\\(`).test(CODE), null);
}
check("Generate Music posts to /api/genmusic, the music worker's route",
  /fetch\("\/api\/genmusic"/.test(CODE), null);
check("...and the mode dropdown's audio entry runs the SAME path (no 'no audio engine' dead end)",
  /gm === "audio"[\s\S]{0,200}startMusicJob\(/.test(CODE) && !/no audio engine/.test(CODE), null);
check("a music style always saves as kind=music",
  /kind:\s*"music"/.test(CODE), null);
check("the image style list asks for ?kind=image, so songs never appear in it",
  /\/api\/styles\?kind=image/.test(CODE), null);
check("...and the music list asks for ?kind=music",
  /\/api\/styles\?kind=music/.test(CODE), null);
check("the ComfyUI model combos are shared with the Music tab (cmModelCats takes the style)",
  /function cmModelCats\(styleId/.test(CODE) && /s_muallkinds/.test(CODE), null);
check("the Start-ComfyUI button and status line are mirrored onto the Music tab",
  /s_mucmstart/.test(CODE) && /s_mucmstatus/.test(CODE), null);
check("Generate Music runs the preflight, like Generate Image does",
  /startMusicJob[\s\S]{0,900}comfyPreflight\(/.test(CODE), null);
check("the gallery has an Audio tab", /data-gtab="audio"/.test(HTML), null);
check("...served by /api/outputs?kind=audio", /kind=audio/.test(CODE), null);
check("audio tiles are draggable onto the timeline as SOUND, not footage",
  /kind:\s*"sound"/.test(CODE) && /a\.kind === "sound"[\s\S]{0,120}addSound\(/.test(CODE), null);

// the queue has its own dock on the right; the left one is settings + stats
check("there is a queue dock", /<aside class="dock right" id="qdock">/.test(HTML), null);
check("...and the queue frame lives in it, not in the left dock",
  HTML.indexOf('id="qframe"') > HTML.indexOf('id="qdock"')
  && HTML.indexOf('id="qframe"') < HTML.indexOf('id="rdock"'), null);
check("the left dock no longer contains the queue",
  (() => { const l = HTML.indexOf('id="ldock"'), q = HTML.indexOf('id="qframe"'),
           e = HTML.indexOf('id="qdock"'); return !(q > l && q < e); })(), null);
check("the queue dock has its own splitter and width variable",
  /data-resize="qdock"/.test(HTML) && /--qdock:/.test(HTML), null);
check("...and a toggle button in the status bar", /id="tQ"/.test(HTML), null);
check("...wired to a no-queue class the grid understands",
  /no-queue/.test(HTML) && /tQ/.test(CODE), null);
check("the queue ids the job painter uses are unchanged",
  ["qfbody", "qfcount", "jobs"].every((id) => new RegExp(`id="${id}"`).test(HTML)), null);
check("its width and visibility are remembered like the other docks",
  /\["ldock", "refs", "assets", "qdock", "rdock"/.test(CODE) && /"d\.queue"/.test(CODE), null);

// ===== free VRAM before generation (2.98.0) =================================
// "15 sec videos used to work. 10 seconds work but 15 doesn't. maybe clear vram
// before generation?" The workers do it from config; this is the UI's half:
// the switch, the manual button, the status-bar link, and the wiring that
// lets a Save actually change the config the workers read.
check("Settings -> ComfyUI has the free-VRAM switch, checked by default",
  /<input type="checkbox" id="s_cfree" checked>/.test(HTML), null);
check("...and a 'Free VRAM now' button in the launcher row",
  /id="s_cfreenow"/.test(HTML) && HTML.indexOf('id="s_cfreenow"') > HTML.indexOf('id="s_cstop"')
  && HTML.indexOf('id="s_cfreenow"') < HTML.indexOf('id="s_cstatus"'), null);
check("the switch is SAVED (free_before_gen rides in the engine.comfy payload)",
  /free_before_gen: \$\("s_cfree"\)\.checked/.test(CODE), null);
check("...and PAINTED from config, default ON (only an explicit false unchecks)",
  /\$\("s_cfree"\)\.checked = \(eng\.comfy \|\| \{\}\)\.free_before_gen !== false/.test(CODE), null);
check("the status bar has a free-VRAM link beside the ComfyUI state",
  /<span id="sbfree" class="hidden"/.test(HTML)
  && HTML.indexOf('id="sbfree"') > HTML.indexOf('id="sbcomfy"'), null);
check("...only shown while ComfyUI is reachable in comfy mode",
  /const show = j\.backend === "comfy" && j\.reachable;/.test(CODE)
  && /sf\.classList\.toggle\("hidden", !show\)/.test(CODE), null);
check("both the button and the link run the same handler",
  /\$\("s_cfreenow"\)\.onclick = comfyFreeNow/.test(CODE)
  && /\$\("sbfree"\)\.onclick = comfyFreeNow/.test(CODE), null);
check("the handler POSTs the studio endpoint, not ComfyUI directly (the server owns the URL)",
  /fetch\("\/api\/comfy\/free", \{ method: "POST" \}\)/.test(CODE) && !/8188\/free/.test(CODE), null);
check("...is re-entrancy guarded (one free at a time)",
  /if \(comfyFreeBusy\) return;/.test(CODE) && /comfyFreeBusy = true;/.test(CODE), null);
check("...writes the result to the console with the helper that exists (logLine, not log)",
  /logLine\(j\.ok \? `\[comfy\] \$\{j\.line\}`/.test(CODE) && !/[^a-zA-Z.]log\(`\[comfy\]/.test(CODE), null);
check("...and keeps the before -> after line on the Settings status across repaints",
  /comfyFreeLine \? `\\n\$\{comfyFreeLine\}` : ""/.test(CODE), null);
check("the ComfyUI status tooltip shows ComfyUI's OWN VRAM view when it has one",
  /ComfyUI sees \$\{fmtVramDevs\(j\.vram\)\}/.test(CODE), null);
check("the hint says what the switch costs and why it exists",
  /POST \/free/.test(HTML) && /OutOfMemoryError/.test(HTML) && /weights come back from RAM/.test(HTML), null);

// ===== settings files + the VRAM ceiling (2.99.0) ============================
check("General tab has the reset-settings button",
  /id="s_reset"/.test(HTML) && HTML.indexOf('id="s_reset"') > HTML.indexOf('id="stab-general"')
  && HTML.indexOf('id="s_reset"') < HTML.indexOf('id="stab-paths"'), null);
check("...it asks first (appConfirm) and POSTs /api/config/reset",
  /\$\("s_reset"\)\.onclick/.test(CODE) && /await appConfirm\("Reset every setting/.test(CODE)
  && /fetch\("\/api\/config\/reset", \{ method: "POST" \}\)/.test(CODE), null);
check("...then reloads the config into the dialog", /await loadConfig\(\);\s*logLine\("\[settings\] reset/.test(CODE), null);
check("the General tab names both files and where the customisation shows",
  /default\.settings/.test(HTML) && /custom\.settings\.bak/.test(HTML) && /id="s_setinfo"/.test(HTML), null);
check("the HF hint no longer claims config.json", !/stored\s+in your local <span class="mono">config\.json/.test(HTML), null);
check("Settings -> ComfyUI shows the learned VRAM ceiling with a reset",
  /id="s_cvram"/.test(HTML) && /id="s_cvramreset"/.test(HTML), null);
check("...the reset writes vram_ceiling 0 through /api/config",
  /vram_ceiling: 0, vram_ceiling_note: ""/.test(CODE), null);
check("a Save never writes the learned ceiling back from a stale dialog",
  /vram_ceiling: undefined, vram_ceiling_note: undefined/.test(CODE), null);
check("ceilingNow() honours the learned ceiling in comfy mode",
  // 2.519.0: 2.503.0 lets a Long-video style (longStyleOn) raise the comfy model max to 719; the learned ceiling still wins
  /function vramCeiling\(\)/.test(CODE) && /function ceilingNow\(\) \{ const v = vramCeiling\(\); return v \|\| \(comfyEngine\(\) \? \(longStyleOn\(\) \? 719 : 362\) : MAX_SINGLE_RUN\)/.test(CODE), null);
check("the plan readout says when the VRAM ceiling split the clip",
  /VRAM ceiling \$\{vramCeiling\(\)\}f/.test(CODE), null);

// ===== the text encoder off the card (2.99.2) ===============================
check("Settings -> ComfyUI has the CPU-text-encoder switch, OFF by default (2.99.3: it is slow and was not the fix)",
  /<input type="checkbox" id="s_ccpuclip">/.test(HTML), null);
check("...saved as clip_device cpu|default",
  /clip_device: \$\("s_ccpuclip"\)\.checked \? "cpu" : "default"/.test(CODE), null);
check("...painted so a missing key shows OFF (ComfyUI's own choice is the default)",
  /\(\(eng\.comfy \|\| \{\}\)\.clip_device \|\| "default"\) === "cpu"/.test(CODE), null);
check("...and the hint explains the 32B encoder and the ~2 minute cost",
  /32-billion-parameter/.test(HTML) && /CLIPLoader\.device = cpu/.test(HTML)
  && /two minutes of prompt encoding/.test(HTML), null);

// ===== don't chunk + the duplicate GPU settings (2.99.4) ====================
check("Settings -> ComfyUI has the split switch, OFF by default (Tim: don't do chunks)",
  /<input type="checkbox" id="s_cchunk">/.test(HTML) && !/id="s_cchunk" checked/.test(HTML), null);
check("...saved as chunk_on_oom", /chunk_on_oom: \$\("s_cchunk"\)\.checked/.test(CODE), null);
check("...painted so only an explicit true shows ON",
  /\(eng\.comfy \|\| \{\}\)\.chunk_on_oom === true/.test(CODE), null);
// 2.405.0 (Tim: "remove the gpu allocation tab from settings since we don't use it")
check("Settings has no GPU allocation tab / pane any more",
  !/data-stab="gpu"/.test(HTML) && !/id="stab-gpu"/.test(HTML) && !/GPU allocation</.test(HTML) && !/s_gdiff|s_dualpreset|s_sdcli_only/.test(HTML), null);
check("...and Save sends the saved gpu values back unchanged (the sd-cli engine still reads them)",
  /gpu: \{ \.\.\.\(\(cfg && cfg\.gpu\) \|\| \{\}\) \}/.test(CODE), null);

// ===== steps 0 = auto + the ComfyUI stdio choice (2.100.0) ==================
check("the Steps slider reaches 0 (= auto)", /<input type="range" id="steps" min="0" max="50"/.test(HTML), null);
check("...and the readout says so instead of printing 0",
  /function stepsLabel\(v\)/.test(CODE) && /auto \(LoRA count \/ 20 base\)/.test(CODE)
  && /\$\("stepsv"\)\.textContent = stepsLabel\(\$\("steps"\)\.value\)/.test(CODE), null);
check("...the music-video Steps field allows 0 too", /id="mv_steps" min="0"/.test(HTML), null);
check("the LoRA toggle no longer hardcodes '4-step' (fl2va's LoRA is 8-step)",
  !/4-step turbo LoRA/.test(HTML) && /turbo LoRA/.test(HTML) && /follows this toggle/.test(HTML), null);
check("Settings -> ComfyUI: the stdio choice (file | console) and the relaunch button",
  /<select id="s_cstdio">/.test(HTML) && /value="console"/.test(HTML) && /id="s_cconsole"/.test(HTML), null);
check("...painted from engine.comfy.stdio, saved back as stdio",
  /\$\("s_cstdio"\)\.value = \(\(eng\.comfy \|\| \{\}\)\.stdio === "console"\)/.test(CODE)
  && /stdio: \$\("s_cstdio"\) \? \$\("s_cstdio"\)\.value : "file"/.test(CODE), null);
check("...the button confirms in-page (never a native confirm) and posts the relaunch route",
  /s_cconsole"\)\.onclick = async/.test(CODE) && /await appConfirm\("Relaunch ComfyUI in a real console/.test(CODE)
  && /fetch\("\/api\/comfy\/relaunch-console", \{ method: "POST"/.test(CODE), null);

// ===== the project owns its reference media + the whole state (2.101.0) ====
check("projectState carries the reference manifest (images with subject/role, videos, audio)",
  /references: \{\s*images: refs\.map/.test(CODE) && /videos: refVids\.slice\(\), audio: refAuds\.slice\(\)/.test(CODE), null);
check("...and the music dock (lyrics, caption, style, length, seed), the image dock, the gallery tab, camera, speech, chat mode",
  /music: \{ lyrics: fieldVal\("muLyrics"\)/.test(CODE) && /image: \{ style: fieldVal\("styleSel"\)/.test(CODE)
  && /gallery: \{ tab:/.test(CODE) && /camera: /.test(CODE) && /speech: \{ text: fieldVal\("ttsText"\)/.test(CODE)
  && /chat: \{ mode: \(typeof window\.ieModeKept === "function" && window\.ieModeKept\(\)\) \|\| fieldVal\("genModeSel"\)/.test(CODE), null);   // 2.431.0: the mode picked, not the editor's Image
check("Save posts ONE multipart request: data JSON + the tray pictures as ref_images",
  /fd\.append\("data", JSON\.stringify\(projectState\(\)\)\)/.test(CODE) && /fd\.append\("ref_images", r\.file/.test(CODE)
  && /fetch\("\/api\/projects\/save", \{ method: "POST", body: fd \}\)/.test(CODE), null);
check("opening a project rebuilds the reference dock from /projrefs/images",
  /async function loadProjectReferences/.test(CODE) && /\/projrefs\/images\/\$\{encodeURIComponent\(im\.file\)\}/.test(CODE)
  && /if \(d\.references\) loadProjectReferences\(d\.references\)/.test(CODE), null);
check("...and puts lyrics / gallery tab / camera picks back",
  /put\("muLyrics", d\.music\.lyrics\)/.test(CODE) && /data-gtab="\$\{d\.gallery\.tab\}"/.test(CODE)
  && /camSel\[g\] = d\.camera\[g\] \|\| ""/.test(CODE), null);
check("closing the window beacons the STATE without the media (the server keeps the manifest)",
  /addEventListener\("beforeunload"/.test(CODE) && /delete d\.references/.test(CODE) && /sendBeacon\("\/api\/projects\/save"/.test(CODE), null);
check("the save failure path is the in-page note (alert() is rebound in-page anyway — 2.91.1)",
  /appNote\(j\.error \|\| "save failed"\)/.test(CODE) && /window\.alert = \(msg\) => \{ appNote\(msg\); \}/.test(CODE), null);

// ===== OmniVoice IS the engine (2.264.0 — openaudio removed) ================
check("2.264.0: Settings -> Audio shows ONE engine — OmniVoice, fixed (disabled select, single option); the openaudio option, panel, checkpoint doctor and installer are gone",
  /<select id="s_ttsengine" disabled/.test(HTML) && /value="omnivoice" selected/.test(HTML)
  && !/value="openaudio"/.test(HTML) && !/id="s_ttsckpt"/.test(HTML)
  && !/id="s_ttsinstall"/.test(HTML) && !/id="s_ttsckcheck"/.test(HTML), null);
check("...OmniVoice's own fields + Install button + designed-voice form",
  /id="s_omnimodel"/.test(HTML) && /id="s_omnivenv"/.test(HTML) && /id="s_omnisteps"/.test(HTML)
  && /id="s_omniinstall"/.test(HTML) && /id="s_vdname"/.test(HTML) && /id="s_vdinstruct"/.test(HTML) && /id="s_vdsave"/.test(HTML), null);
check("2.264.0: the payload pins engine omnivoice and nests omnivoice under tts (Device rides along; the legacy checkpoint/venv fields are gone from the save)",
  /engine: "omnivoice",/.test(CODE)
  && /omnivoice: \{ model: \$\("s_omnimodel"\)/.test(CODE)
  && !/checkpoint: \$\("s_ttsckpt"\)/.test(CODE), null);
check("...Install OmniVoice goes through the shared install path",
  /installAudio\("omnivoice", \$\("s_omniinstall"\)/.test(CODE), null);
check("...voice lists mark designed voices and the design form posts /api/tts/voices/design",
  /v\.kind === "design" \? " · designed"/.test(CODE) && /fetch\("\/api\/tts\/voices\/design"/.test(CODE), null);

// ===== mp4 default (2.102.1) ================================================
check("the Format picker lists mp4 FIRST and the project restore falls back to mp4",
  /<select id="format"[^>]*><option value="mp4">mp4<\/option><option value="webm">/.test(HTML)
  && /\$\("format"\)\.value = d\.format \|\| "mp4"/.test(CODE)
  && /<select id="mv_format"><option>mp4<\/option>/.test(HTML), null);

// ===== prompting guides (2.104.0) ===========================================
check("the chat dock has a 📖 button that fetches the guide for the current selection",
  /id="chatGuide"/.test(HTML) && /fetch\("\/api\/prompt-guides\?" \+ q\)/.test(CODE)
  && /kind: "image", arch: st\.arch \|\| "", model: st\.model \|\| ""/.test(CODE), null);

// ===== Klein 9B renders with the reference dock (2.105.0) =====================
check("Generate Image sends the dock for a ref-capable t2i style (server swaps the workflow) and still refuses an empty dock for an edit style",
  /const optionalRefs = \(slots === 0 && !!styleRefCapable\[id\] && refs\.length > 0\)/.test(CODE)
  && /\|\| \(slots > 0 && !!styleRefsOptional\[id\] && refs\.length > 0\);/.test(CODE)   // 2.340.0
  && /if \(\(slots > 0 && !styleRefsOptional\[id\]\) \|\| optionalRefs\)/.test(CODE) && /styleRefCapable = j\.ref_capable \|\| \{\}/.test(CODE), null);

// ===== audio visualizer (2.106.0) ============================================
check("timeline audio tracks are marked data-noviz so the visualizer never paints over the video",
  /a\.dataset\.noviz = "1";/.test(CODE), null);
check("gallery songs, asset previews and the speech test carry a display name for the visualizer",
  /data-viz-name="\$\{f\.name\}"/.test(CODE) && /el\.dataset\.vizName = name;/.test(CODE) && /a\.dataset\.vizName = j\.name;/.test(CODE), null);

// ===== preview dock + LLM tokens + hybrid offload (2.148.0) =================
check("the viewer lives inside a Preview bdock with a collapse header and maximize",
  /<div class="bdock" id="previewdock">/.test(HTML)
  && /data-collapse="previewdock"/.test(HTML)
  && /data-max="previewdock"/.test(HTML)
  && HTML.indexOf('id="previewdock"') < HTML.indexOf('id="viewerpane"'), null);
check("previewdock is in BOTH dock maps (label + status-bar sync) with a wired tPv toggle",
  /previewdock: "Preview"/.test(CODE) && (/previewdock: "tPv"/.test(CODE) || /tPv: "previewdock"/.test(CODE))   // 2.386.0: one map (GONE_DOCKS)
  && /id="tPv"/.test(HTML)
  && /\$\("tPv"\)\.onclick = \(\) => toggleDockGone\("previewdock", "tPv"\)/.test(CODE)
  && /store\.get\("g\." \+ id\) === "1"/.test(CODE), null);
check("2.255.0: the preview is a FIXED dock with its OWN --pvh (its handle sets its height directly); the video dock is the elastic absorber",
  /previewdock: "pvh"/.test(CODE)
  && /#previewdock \{ flex: 0 0 var\(--pvh\)/.test(HTML)
  && /#videodock \{ flex: 1 1 auto/.test(HTML), null);
check("the settings docker shows a labelled token ESTIMATE, updated as the prompt is typed",
  /id="tokCount"/.test(HTML) && /4-characters-per-token estimate/.test(HTML)
  && /\$\("prompt"\)\.addEventListener\("input", tokEstimate\)/.test(CODE), null);
check("the reply-budget slider saves llm.max_tokens on release, clamped 128..131072 (128k, 2.150.0)",
  /id="tokMax"/.test(HTML) && /id="tokMaxV"/.test(HTML)
  && /JSON\.stringify\(\{ llm: \{ max_tokens: v \} \}\)/.test(CODE)
  && /Math\.max\(128, Math\.min\(131072/.test(CODE)
  && /max="131072"/.test(HTML)
  && /tokPaint\(\(cfg\.llm \|\| \{\}\)\.max_tokens \|\| 600\)/.test(CODE), null);
check("Settings → LLM has an explicit context-size field saved to llm.ctx",
  /id="s_llmctx"/.test(HTML) && /ctx: Math\.max\(0, Math\.min\(262144/.test(CODE), null);
check("Settings → LLM has the GPU + CPU/RAM offload option with a layers input",
  /id="s_llmoffload"/.test(HTML) && /id="s_llmlayers"/.test(HTML)
  && /GPU \+ CPU\/RAM \(offload\)/.test(HTML), null);
check("the save payload carries gpu_layers: hybrid = the clamped layer count, all = -1",
  /gpu_layers: \$\("s_llmoffload"\)\.value === "hybrid"/.test(CODE)
  && /: -1,/.test(CODE), null);

check("Basic Settings has a Character chain tab exposing the MM3 export's per-shot inputs",
  /id="bsTabStd"/.test(HTML) && /id="bsTabChain"/.test(HTML) && /id="chset"/.test(HTML)
  && ["ch_steps", "ch_length", "ch_mode", "ch_ctx", "ch_actx", "ch_blend",
      "ch_srcref", "ch_gencont", "chCfgSave"].every((id) => new RegExp('id="' + id + '"').test(HTML)), null);
check("the chain tab maps its fields to the export's OWN keys and saves config.chain",
  /ch_steps: "steps"/.test(CODE) && /ch_gencont: "generated_continuity"/.test(CODE)
  && /JSON\.stringify\(\{ chain \}\)/.test(CODE), null);
check("the character editor carries pronouns and wardrobe, and a retitleable header",
  /id="chPronouns"/.test(HTML) && /id="chWardrobe"/.test(HTML)
  && /id="chDlgTitle"/.test(HTML), null);

// ===== docker_status.json (2.381.0; replaced dockers.json 2.159.0 and ui.docks 2.103.0) ======================
check("2.381.0: the layout comes from docker_status.json - the record in the page's head, else GET /api/docker-status - applied at boot",
  /dsBoot\(\);/.test(CODE) && /let rec = window\.H3_DOCK_STATUS;/.test(CODE) && /fetch\("\/api\/docker-status"\)/.test(CODE)
  && !/dockersApply\(\)/.test(CODE) && !/fetch\("\/api\/ui\/layout"\)/.test(CODE), null);
check("2.381.0: a drag end, a collapse, a hide and a maximize all write the WHOLE record to /api/docker-status (debounced)",
  /fetch\("\/api\/docker-status", \{ method: "POST"/.test(CODE) && /body: JSON\.stringify\(\{ docks \}\)/.test(CODE)
  && /saveLayout\(\);\s+\/\/ docker_status\.json: maximized/.test(CODE) && /saveLayout\(\);\s+\/\/ 2\.381\.0: docker_status\.json: hidden/.test(CODE), null);
check("2.255.0: the previewdock's --pvh is a fixed dock's var; the videodock is the elastic dock (2.381.0: its --vh only in STATUS_VARS)",
  /previewdock: "pvh"/.test(CODE) && /const STATUS_VARS = \{ \.\.\.DOCKER_VARS, videodock: "vh" \};/.test(CODE), null);

console.log("=======================");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
