#!/usr/bin/env node
/* bitGen Studio — 2.574.0 units: theme edit mode changes a docker's title and any element's own words (static/themeedit.js
 * words / unwords - the ▾ caret and the buttons stay, a collapse keeps the new title, ↺ puts the old one back), and
 * "step n of total" for every generation (static/stepstext.js, lib/jobMeta's sd-cli bar, lib/jobSteps, the displays).
 * Tim: "in theme edit mode, allow me to change the headings of dockers and all selected text. show step number of steps
 * for all generations(image,music,video) in all places that show it" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };

(async () => {
  /* 1 theme edit: a docker's title bar */
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM(`<!doctype html><html><head></head><body><div id="videodock"><div class="bhead" data-collapse="videodock"><button class="pinbtn">📌</button>▾ StoryBoard<button id="vdMax">⛶</button></div></div>
    <label id="lb"><input type="checkbox" id="cb"> Transition</label><div id="none"><span>a</span></div></body></html>`, { runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.eval(rd("static", "themeedit.js"));
  const TE = w.H3ThemeEdit, d = w.document, head = d.querySelector(".bhead");
  const own = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join("|");
  TE.setStyles({ "#videodock div.bhead": { text: "Music Video" } }, true);
  check("a docker's title bar gets its new title in place - the ▾ caret, the 📌 and the ⛶ buttons stay",
    own(head) === "▾ Music Video" && head.querySelector(".pinbtn") && d.getElementById("vdMax") && head.firstChild.className === "pinbtn" && head.dataset.h3words === "StoryBoard", own(head));
  // the app's collapse rebuilds the title from the head's text nodes (index.html toggleCollapse)
  const had = [...head.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ").replace(/[▾▸]/g, "").replace(/\s+/g, " ").trim();
  const pin = head.querySelector(".pinbtn"), kids = [...head.children].filter((k) => k !== pin);
  head.textContent = "▸ " + had; head.insertBefore(pin, head.firstChild); kids.forEach((k) => head.appendChild(k));
  TE.applyIcons();
  check("...a collapse keeps it (▸ Music Video) - the app reads the words back from the same text node", own(head) === "▸ Music Video", own(head));
  TE.setStyles({ "#lb": { text: "Bridge" } }, true);
  check("cleared: the title it had comes back (with the caret as it is now); a label with a checkbox gets its words, the box kept",
    own(head) === "▸ StoryBoard" && !head.classList.contains("h3words") && own(d.getElementById("lb")).trim() === "Bridge" && d.getElementById("cb"), [own(head), own(d.getElementById("lb"))]);
  const TS = rd("static", "themeedit.js");
  check("the Style panel: Text is open for an element with words of its own (mixed), every pick (a title bar too) starts on This element only",
    /const mixed = !plain && \(el\.classList\.contains\("h3words"\) \|\| hasOwnWords\(el\)\)/.test(TS) && /\$\{plain \|\| mixed \? "" : " disabled"\}/.test(TS)
    && /scope = opts\[0\]\.sel;/.test(TS));   // 2.574.1: every pick starts on This element only

  /* 2 the words for a step */
  const H = require(path.join(ROOT, "static", "stepstext.js"));
  check("H3Steps.text / tag: step n of total; a chunked render says its chunk; before the sampler counts: loading the models",
    H.text({ step: 3, total: 8 }) === "step 3 of 8" && H.tag({ step: 3, total: 8 }) === " · step 3 of 8" && H.text({ step: 2, total: 8, chunk: { i: 2, n: 3 } }) === "chunk 2/3 · step 2 of 8"
    && H.text({ step: null, total: null }) === "loading the models" && H.text(null) === "" && H.tag(null) === "");
  const JM = require(path.join(ROOT, "lib", "jobMeta.js"));
  const j = { status: "running" };
  JM.onLine(j, "  |==========>                 | 7/20 - 1.23s/it");
  const j2 = { status: "running" }; JM.onLine(j2, "|====| 4/30 - 2.10it/s");
  check("lib/jobMeta reads stable-diffusion.cpp's bar (sd-cli pictures and video): | 7/20 - 1.23s/it", j.step && j.step.n === 7 && j.step.total === 20 && j2.step.n === 4, [j.step, j2.step]);
  const JS = require(path.join(ROOT, "lib", "jobSteps.js"));
  const jobs = new Map([["a", { status: "running", step: { n: 2, total: 8 }, started: Date.now() / 1000 }], ["b", { status: "done", step: { n: 8, total: 8 } }]]);
  const pa = JS.progressOf("a", jobs);
  check("lib/jobSteps.progressOf: a running job's progress, nothing for a finished / unknown one", pa && pa.step === 2 && pa.total === 8 && JS.progressOf("b", jobs) === null && JS.progressOf("x", jobs) === null && JS.progressOf("", jobs) === null, pa);
  const RR = require(path.join(ROOT, "static", "realrefs.js"));
  check("the 3D-to-real chain's words: … (job x) · step n of total while it runs",
    / \(job e1\) · step 2 of 8$/.test(RR.stepText({ state: "edit", edit: "e1", take: 2, progress: { step: 2, total: 8 } })) && /\(job e1\)…$/.test(RR.stepText({ state: "edit", edit: "e1", take: 2 })));
  const G = require(path.join(ROOT, "ext", "videodock", "sbgrid.js"));
  check("the StoryBoard grid card: rendering · step n of total (was a percentage)", G.state({ status: "running", progress: { pct: 25, step: 2, total: 8 } }).word === "rendering · step 2 of 8");

  /* 3 the displays */
  const IX = rd("static", "index.html");
  check("index.html: H3Steps loaded; the status bar says step n/total; ONE awaitJob that tells the page every poll (h3:jobtick); the song tab's status (was [object Object]); the console's followed job",
    /<script src="\/static\/stepstext\.js"><\/script>/.test(IX) && /textContent = m \? `step \$\{m\[1\]\}\/\$\{m\[2\]\}`/.test(IX) && (IX.match(/async function awaitJob\(/g) || []).length === 1
    && /new CustomEvent\("h3:jobtick", \{ detail: j \}\)/.test(IX) && /muStatus\(`rendering · job \$\{j\.id\}` \+ \(window\.H3Steps \? H3Steps\.tag\(jj\.progress\)/.test(IX) && /\$\("logStep"\)\.textContent/.test(IX));
  check("music dock: covers / sheet music / transcribe say step n of total (was [object Object]); the nest compile's % (was NaN)",
    /window\.H3Steps\.tag\(jj\.progress\)/.test(rd("ext", "musicdock", "musicdock.js")) && /g\.progress && g\.progress\.pct != null/.test(rd("ext", "timelinedock", "nest.js")));
  const IE = rd("ext", "imageeditdock", "imageedit.js"), PP = rd("ext", "imageeditdock", "pcpending.js"), MT = rd("ext", "imageeditdock", "mount.js");
  check("image editor: result tiles + ⏳ Pending cards follow h3:jobtick (their job id carried); From the picture, the 3D / Unreal real pictures say their step",
    /doc\.addEventListener\("h3:jobtick"/.test(IE) && /w\.dataset\.job = r\.id/.test(IE) && /E\.pending\.add\(\{ job: j\.id/.test(IE) && /doc\.addEventListener\("h3:jobtick"/.test(PP) && /function waitText\(it\)/.test(PP)
    && /E\.pending\.add\(\{ job: job\.id/.test(rd("ext", "imageeditdock", "pczones.js")) && /awaitResult: async \(id, say, onStep\)/.test(MT) && /from the picture" \+ window\.H3Steps\.tag/.test(MT)
    && /awaitResult\(j\.edit, say, \(t\) =>/.test(rd("ext", "imageeditdock", "pc3d.js")) && /awaitResult\(j\.edit, say, \(t\) =>/.test(rd("ext", "imageeditdock", "pcunreal.js")));
  check("timeline: ✨ fill (image / video), 🤖 AI take, camera depth, karaoke overlay say their step",
    /waitJob\(id, "✨ image"\)/.test(rd("ext", "timelinedock", "fill.js")) && /waitJob\(j\.id, "✨ video"\)/.test(rd("ext", "timelinedock", "fill.js"))
    && /H3Steps\.watch\(\$\("taiMsg"\), x\.id\)/.test(rd("ext", "timelinedock", "tlai.js")) && /H3Steps\.watch\(\$\("cpPicSay"\), j\.job\)/.test(rd("ext", "timelinedock", "camera.js"))
    && /H3Steps\.watch\(\$\("kgMsg"\), j\.job/.test(rd("ext", "timelinedock", "karaokegen.js")));
  const CH = rd("ext", "videodock", "characters.js");
  check("StoryBoard: ⏫ upscaling, the scene picker, the environment + character creators, the sheet takes, RefMod extraction; storyboard pictures; ✎ First frame",
    /"⏫ upscaling" \+ \(r\.up_progress/.test(CH) && /var stp = r\.status === "running" && r\.progress && r\.progress\.total/.test(CH) && /ecEl\("ecStat"\)\.textContent = "rendering" \+ window\.H3Steps\.tag/.test(CH)
    && /el\("ccStat"\)\.textContent = "rendering" \+ window\.H3Steps\.tag/.test(CH) && /function chSheetStepTag\(\)/.test(CH) && /dataset picture\(s\) · step "/.test(CH)
    && /⏳ step \$\{j\.progress\.step\} of \$\{j\.progress\.total\}/.test(rd("ext", "videodock", "storyboard.js")) && /"⏳ making" \+ \(q\.progress/.test(rd("ext", "videodock", "qedit.js")));
  const RC = rd("routes", "characters.js");
  check("the board's answer carries up_progress (⏫) and qedit.progress (✎); the swap dialog's takes + first frames; the real-refs chain",
    /up_progress: upr/.test(RC) && /qedit: \{ \.\.\.r\.qedit, progress: qpr \}/.test(RC) && /withPr\(r, r\.job\)/.test(rd("routes", "swapdlg.js")) && /function stepTag\(pr\)/.test(rd("static", "swapdlg.js"))
    && /require\("\.\.\/lib\/jobSteps"\)\.progressOf\(id\)/.test(rd("routes", "realRefs.js")));
  check("VR world, style doctor (was a %) say step n of total (2.630.0: the House builder is gone)",
    /"rendering" \+ \(window\.H3Steps \? window\.H3Steps\.tag\(jb\.progress\)/.test(rd("static", "vrworld.js")) && /"step " \+ d\.progress\.step \+ " of " \+ d\.progress\.total/.test(rd("static", "styledoctor.js")));
  const IW = rd("misc/image_worker.py");
  check("image_worker.py: pictures through ComfyUI print live steps (scripts/comfy_progress run / queue_live + wait_live); sd-cli's \\r bar split into lines",
    (IW.match(/_cprog\.run\(_comfy, base/g) || []).length >= 3 && /_cprog\.queue_live\(_comfy, base, g, say\)/.test(IW) && /re\.split\(rb"\\r\\n\|\\r\|\\n", buf\)/.test(IW) && /^import re$/m.test(IW));

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
