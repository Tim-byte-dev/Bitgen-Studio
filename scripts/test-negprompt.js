#!/usr/bin/env node
/* bitGen Studio — 2.419.0 units: ONE PROMPT DOCKER + THE ⊖ NEGATIVE PROMPT DOCKER
 *   1. static/negprompt.js: split() takes an LLM reply's "Negative:" lines out of the positive prompt (every way models
 *      write it), accepts() says which models use a negative (SDXL / Pony / Illustrious, a ComfyUI image style at cfg > 1,
 *      LTX, Wan, MiniMax H3 at cfg > 1 - not FLUX / Qwen / Z-Image at cfg 1, music, speech)
 *   2. static/promptbind.js: the tools' prompt boxes follow the prompt docker (their own default when it is empty)
 *   3. the server: /api/generate (H3 negative_prompt, Wan), /api/ltx, wan.fromGenerate / ltx.jobParams carry it; the
 *      LLM's video guide is the selected video style's (LTX / Wan ask for a "Negative:" line)
 *   4. the page: every generation sends the docker's negative, the LLM's reply goes through take(), key 2 (SecFloat
 *      free + skip while the multi-camera dialog is open), docker_status.json keeps it, the shortcut list says it
 * Tim: "use the prompt docker for all prompts ... add a negative prompt docker - "2" toggles negative prompt docker.
 * put the negative prompts the llm creates in this docker. use negative prompts with models that accept it". */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

/* ---- 1. split / accepts */
const N = require(path.join(ROOT, "static", "negprompt.js"));
const s1 = N.split("portrait of a woman, 85mm photograph\nNegative: blurry, deformed hands, text");
check("split: the 'Negative:' line leaves the positive, its text is the negative", s1.positive === "portrait of a woman, 85mm photograph" && s1.negative === "blurry, deformed hands, text", s1);
const s2 = N.split("**Negative prompt:** low quality, watermark\nA red fox in snow, telephoto");
check("...'**Negative prompt:**' (markdown bold), anywhere in the reply", s2.positive === "A red fox in snow, telephoto" && s2.negative === "low quality, watermark", s2);
const s3 = N.split("A dancer spins.\nNegative:\n- flicker\n- extra limbs\n\nThe end.");
check("...a list under it (until a blank line) joined with commas; the rest kept", s3.negative === "flicker, extra limbs" && s3.positive === "A dancer spins.\n\nThe end.", s3);
const s4 = N.split("a cat on a mat\nnegative: text\nNEG: text");
check("...lower case, 'NEG:', repeated phrases once", s4.positive === "a cat on a mat" && s4.negative === "text", s4);
const s5 = N.split("The negative space around the subject is calm.\nNo text.");
check("...a sentence that merely says 'negative' is left alone; no negative = ''", s5.positive === "The negative space around the subject is calm.\nNo text." && s5.negative === "", s5);
check("clean: whitespace evened, capped at " + N.MAX, N.clean("  a \t b  ") === "a b" && N.clean("x".repeat(5000)).length === N.MAX);
const A = (c) => N.accepts(c);
check("accepts: SDXL (its arch says negative) yes; FLUX at cfg 1 no; a ComfyUI image style at cfg 5 yes; no style = says so",
  A({ mode: "image", imageStyle: { arch: "sdxl", engine: "comfy", cfg: 6 }, imageArch: { negative: true, label: "SDXL" } }).use
  && !A({ mode: "image", imageStyle: { arch: "flux", engine: "sdcli", cfg: 1 }, imageArch: { negative: false } }).use
  && A({ mode: "image", imageStyle: { arch: "flux2klein9b", engine: "comfy", cfg: 5 }, imageArch: { negative: false } }).use
  && /pick an image style/.test(A({ mode: "image" }).why));
check("accepts: LTX yes, Wan 2.1 / 2.2 yes, MiniMax H3 at cfg 1 no (says to raise cfg), at cfg 3 yes (true CFG); music / speech / swap no",
  A({ mode: "video", videoStyle: { ltx: true, arch: "ltx-2.3" } }).use && A({ mode: "video", videoStyle: { arch: "wan22" } }).use
  && !A({ mode: "video", videoStyle: { arch: "minimax-h3" }, cfg: 1 }).use && /raise cfg/.test(A({ mode: "video", cfg: 1 }).why)
  && A({ mode: "video", videoStyle: null, cfg: 3 }).use && !A({ mode: "audio" }).use && !A({ mode: "speech" }).use && !A({ mode: "swap" }).use);

/* ---- 2. promptbind */
const B = require(path.join(ROOT, "static", "promptbind.js"));
check("promptbind: the tools' boxes it takes over (image editor ✨ AI, ✨ Fill, path subject, ✨ AI scene, 3DREAL look, character creator, environment, VR world)",
  ["#iePrompt", "#tlfPrompt", "#ppPrompt", "#tlbAiPrompt", "#tlbLook", "#ccPrompt", "#ecPrompt", "textarea[data-k=prompt]"].every((x) => B.SELECTORS.includes(x)));
check("effective: the docker's text wins; empty docker = the tool's own default; neither = none",
  JSON.stringify(B.effective("own", " docker ")) === JSON.stringify({ text: "docker", from: "docker" }) && B.effective("own", "").from === "own" && B.effective("", "").from === "none");

/* ---- 3. the server */
const IX = read("routes", "index.js");
check("/api/generate: the negative -> H3's negative_prompt (true CFG at cfg > 1) and Wan's negative", /const negOf = \(b\) => require\("\.\.\/static\/negprompt\.js"\)\.clean\(b && b\.negative\)/.test(IX)
  && /\.\.\.\(negOf\(f\) \? \{ negative_prompt: negOf\(f\) \} : \{\}\)/.test(IX) && /negative: negOf\(f\),/.test(IX));
check("/api/ltx passes it to ltx.jobParams", /prompt, images, negative: require\("\.\.\/static\/negprompt\.js"\)\.clean\(b\.negative\)/.test(read("routes", "ltx.js")));
const wan = require(path.join(ROOT, "lib", "wan.js"));
const WST = { id: "w", name: "Wan 2.1", kind: "video", engine: "comfy", arch: "wan21", negative: "style negative", phases: [{}], loras: [] };
const w1 = wan.fromGenerate({ style: WST, mode: "t2va", prompt: "a fox", files: [], frames: 49, width: 832, height: 480, seed: 1, steps: 0, cfg: 0, negative: "docker negative" });
const w2 = wan.fromGenerate({ style: WST, mode: "t2va", prompt: "a fox", files: [], frames: 49, width: 832, height: 480, seed: 1, steps: 0, cfg: 0 });
check("wan.fromGenerate: the docker's negative beats the style's; none = the style's own", w1.negative === "docker negative" && w2.negative === "style negative", { a: w1.negative, b: w2.negative, e: w1.error });
const G = require(path.join(ROOT, "lib", "promptGuides.js"));
const gw = G.guideFor(null, { kind: "video", arch: "wan21", model: "" }), gl = G.guideFor(null, { kind: "video", arch: "ltx", model: "" }), gh = G.guideFor(null, { kind: "video", arch: "h3", model: "" });
check("the LLM's video guide: Wan has its own (with a 'Negative:' line), LTX asks for a last 'Negative:' line, H3 stays H3's",
  /Wan 2\.1 \/ 2\.2/.test(gw) && /Negative:/.test(gw) && /'Negative:'/.test(gl) && /MiniMax H3/.test(gh));
check("lib/llmChat.js picks the video guide by the selected video style (video_style_id), not always H3",
  /const vs = pick\(c\.video_style_id\);/.test(read("lib", "llmChat.js")) && /video_style_id: \$\("videoStyleSel"\)/.test(read("static", "index.html")));

/* ---- 4. the page */
const IH = read("static", "index.html");
check("every generation sends the docker's negative: H3 / Wan (submitJob), LTX (submitLtx), image (startImageJob), the editor's / ✨ Fill's AI edits",
  (IH.match(/if \(window\.H3Neg && H3Neg\.get\(\)\) fd\.append\("negative", H3Neg\.get\(\)\);/g) || []).length === 2 && /body\.negative = H3Neg\.get\(\)/.test(IH)
  && /fd\.append\("negative", H3Neg\.get\(\)\)/.test(read("ext", "imageeditdock", "mount.js")) && (read("ext", "timelinedock", "fill.js").match(/fd\.append\("negative", H3Neg\.get\(\)\)/g) || []).length === 2);
check("the LLM's Negative: line never rides in the positive: ⬇ To prompt, a ```image / ```video fence and Generate go through H3Neg.take",
  /\$\("prompt"\)\.value = window\.H3Neg \? H3Neg\.take\(text\) : text;   \/\/ 2\.419\.0: its Negative: line/.test(IH) && (IH.match(/H3Neg\.take\(/g) || []).length >= 3
  && /gm !== "chat" && \/neg\/i\.test\(\$\("prompt"\)\.value\)/.test(IH));
check("the project keeps it (save + load); both scripts load", /negative: window\.H3Neg \? H3Neg\.get\(\) : undefined/.test(IH) && /if \(d\.negative != null && window\.H3Neg\) H3Neg\.set\(d\.negative\)/.test(IH)
  && /<script src="\/static\/negprompt\.js"><\/script>/.test(IH) && /<script src="\/static\/promptbind\.js"><\/script>/.test(IH));
const SF = read("static", "secfloat.js"), NJ = read("static", "negprompt.js");
check("key 2: a SecFloat window (free over the editor / canvas, skipped while the 🎥 multi-camera dialog is open); docker_status.json keeps floats.negprompt; docs/shortcuts.json lists 2",
  /if \(!wants\(ev, sp\.key, a, dlg, sp\.free \? false : owner/.test(SF) && /if \(sp\.skip\)/.test(SF) && /SecFloat\.add\(\{ id: "negprompt", title: "Negative prompt", key: "2"/.test(NJ) && /tlMulticamDlg/.test(NJ)
  && /const FLOATS = \["basic", "llmtok", "camera", "negprompt"\]/.test(read("lib", "dockerStatus.js")) && JSON.parse(read("docs", "shortcuts.json")).groups[0].rows.some((r) => r[0] === "2"));
const SFp = require(path.join(ROOT, "static", "secfloat.js"));
check("SecFloat.wants: 2 toggles (not while typing, not with Shift / Ctrl, not with a dialog open)", SFp.wants({ key: "2" }, "2", null, false, false) && !SFp.wants({ key: "2", shiftKey: true }, "2", null, false, false)
  && !SFp.wants({ key: "2" }, "2", { tagName: "TEXTAREA" }, false, false) && !SFp.wants({ key: "2" }, "2", null, true, false));
const DS = require(path.join(ROOT, "lib", "dockerStatus.js"));
const ds = DS.normalize ? DS.normalize({ floats: { negprompt: { shown: true, x: 10, y: 20, w: 300, h: 200 } } }) : null;
check("docker_status.json: floats.negprompt is kept (shown, x, y, w, h)", !ds || (ds.floats && ds.floats.negprompt && ds.floats.negprompt.shown === true && ds.floats.negprompt.w === 300), ds && ds.floats);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
