#!/usr/bin/env node
/* bitGen Studio — 2.801.0 in a REAL browser: LINKED TEXT FRAMES + TEXT WRAP (pcflow.js, pctype.js) and paragraph text in the export
 * (pcdtpout.js). Tim: "ok, next please" (desktop publishing part 3). Against the running app (H3_URL, default :8311). No Playwright = SKIP. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the text flow browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const has = (bin) => { try { execSync("command -v " + bin, { stdio: "ignore" }); return true; } catch { return false; } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message + " @ " + String(e.stack || "").split("\n").slice(1, 3).join(" | ")));
  const ev = (f, a) => p.evaluate(f, a);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui801-"));
  const N = 100, STORY = Array.from({ length: N }, (_, i) => "w" + (i + 1)).join(" ");
  const pdfPages = async () => {
    const r = await ev(async () => { const x = await window.imageEditorInstance.E.dtpOut.build("pdf", {}); return Array.from(x.bytes); });
    const f = path.join(tmp, "d" + Math.random().toString(36).slice(2) + ".pdf"); fs.writeFileSync(f, Buffer.from(r));
    return has("pdftotext") ? [1, 2].map((i) => execFileSync("pdftotext", ["-f", String(i), "-l", String(i), f, "-"], { encoding: "utf8" })) : null;
  };
  const words = (txt) => (txt.match(/\bw\d+\b/g) || []);
  const frames = () => ev(() => { const E = window.imageEditorInstance.E, out = []; for (const [id, arr] of E.flow.stories()) out.push({ id, frames: arr.map((f) => ({ idx: f.L.text.flow.idx, page: f.pl.page, str: f.L.text.str, holes: (f.L.text.wrapHoles || []).length })) }); return out; });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.flow, null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => document.getElementById("kxFull").click()); await p.waitForTimeout(800);
    await ev((story) => {
      const E = window.imageEditorInstance.E, D = window.PCDoc;
      E.pages.newDocument({ preset: "A5", orient: "portrait", dpi: 72 }, 2, "Flow");
      const T = E.makeLayer("Story", 420, 595, "text"); T.text = Object.assign({}, D.TEXT_DEFAULT, { str: story, size: 14, x: 20, y: 60, box: { w: 180, h: 120 }, color: "#111111" }); D.rasterize(T); E.addLayer(T, "story", false);
    }, STORY);
    await p.waitForTimeout(400);

    /* 1 ＋ Frame (Properties) beside it: the text goes on */
    const hasRow = await ev(() => !!document.getElementById("ppFlHere"));
    check("Properties: a paragraph frame gets the ⛓ Text flow row (＋ Frame, ＋ Next page, ✎ Story…)", hasRow);
    await ev(() => document.getElementById("ppFlHere").click()); await p.waitForTimeout(500);
    let st = await frames();
    const f0 = st[0] && st[0].frames;
    const shown0 = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.name === "Story"), PT = window.PCType; const Lo = PT.layout(L.text, PT.canvasMeasure(L.text, document.createElement("canvas").getContext("2d"))); return Lo.lines.filter((l) => !l.over).map((l) => l.text).join(" "); });
    check("＋ Frame: a second frame beside the first; it starts with the word after the first frame's last shown word", f0 && f0.length === 2 && f0[0].str === STORY && f0[1].str.length > 0 && STORY.indexOf(shown0 + " " + f0[1].str) === 0, { f0, shown0 });

    /* 2 ＋ Next page: a third frame on page 2 with the rest - every word once */
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((x) => x.text && x.text.flow && x.text.flow.idx === 1)); });
    await ev(() => window.imageEditorInstance.E.flow.addNextPage()); await p.waitForTimeout(600);
    st = await frames();
    const f1 = st[0].frames;
    check("＋ Next page: frame 3 on page 2 (in front now), ending with the story's last word", f1.length === 3 && f1[2].page === 1 && new RegExp("w" + N + "$").test(f1[2].str) && (await ev(() => window.imageEditorInstance.E.pages.cur())) === 1, f1.map((f) => [f.page, f.str.slice(0, 20), f.str.slice(-8)]));
    let pg = await pdfPages();
    if (pg) { const all = words(pg[0]).concat(words(pg[1])); check("Export PDF: the frames are real text - w1 … w120 each exactly once, in order, over the 2 pages", all.length === N && all.every((w, i) => w === "w" + (i + 1)), all.slice(0, 5).concat(["…"], all.slice(-5), [all.length])); }

    /* 3 typed in a later frame: it goes into the story at its place */
    await p.click('#pcPagesPanel [data-pgi="0"]'); await p.waitForTimeout(500);
    await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.text && x.text.flow && x.text.flow.idx === 1); E.setLayer(L, "type", (x) => { x.text.str = "INSERTED " + x.text.str; }); });
    await p.waitForTimeout(900);
    st = await frames();
    const head = st[0].frames[0].str, pos = head.indexOf("INSERTED");
    check("typing in frame 2 goes back into the story at frame 2's start (and flows on)", pos > 0 && head.split(" ").length === N + 1 && head.slice(pos + 9).startsWith(f0[1].str.split(" ")[0]), head.slice(Math.max(0, pos - 20), pos + 30));

    const und = await ev(async () => { const E = window.imageEditorInstance.E, H = () => E.S.layers.find((x) => x.name === "Story").text.str; E.undo(); await new Promise((r) => setTimeout(r, 800)); const a = H().includes("INSERTED"); const f2 = E.S.layers.find((x) => x.text && x.text.flow && x.text.flow.idx === 1).text.str.includes("INSERTED"); E.redo(); await new Promise((r) => setTimeout(r, 800)); return { a, f2, b: H().includes("INSERTED") }; });
    check("…Ctrl+Z takes the typing out of the story (and frame 2) again; Ctrl+Y puts it back", !und.a && !und.f2 && und.b, und);

    /* 4 text wrap: a shape in the first frame pushes its text aside */
    const before = (await frames())[0].frames[1].str.split(" ")[0];
    await ev(() => { const E = window.imageEditorInstance.E, D = window.PCDoc; const B = E.makeLayer("Photo box", 420, 595, "shape"); B.shape = Object.assign({}, D.SHAPE_DEFAULT || {}, { kind: "ellipse", x: 110, y: 70, w: 120, h: 80, fill: "#3366cc", fillOn: true, strokeOn: false }); D.rasterize(B); E.addLayer(B, "photo", false); });
    await p.waitForTimeout(400);
    const wrapRow = await ev(() => !!document.getElementById("ppWrapOn"));
    await ev(() => { const el = document.getElementById("ppWrapOn"); el.checked = true; el.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(700);
    st = await frames();
    const after = st[0].frames[1].str.split(" ")[0];
    const wi = (w) => st[0].frames[0].str.split(" ").indexOf(w);
    check("Text wrap on an ellipse (Properties ☐ Text wrap): frame 1 gets a hole, fits fewer words - frame 2 now starts earlier in the story", wrapRow && st[0].frames[0].holes === 1 && wi(after) < wi(before), { before, after, holes: st[0].frames[0].holes });
    const beside = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.name === "Story"), PT = window.PCType; const Lo = PT.layout(L.text, PT.canvasMeasure(L.text, document.createElement("canvas").getContext("2d"))); return Lo.lines.filter((l) => !l.over && l.y + 16 > 70 && l.y < 150).map((l) => Math.round(l.x + l.w)); });
    check("…the lines beside the ellipse end before it (x < 110 + the gap)", beside.length > 0 && beside.every((x) => x <= 112), beside);
    pg = await pdfPages();
    if (pg) { const all = words(pg[0]).concat(words(pg[1])); check("…exported: still every word once, in order (the wrapped lines too)", all.length === N && all.every((w, i) => w === "w" + (i + 1)), all.length); }

    /* 5 Edit Story… */
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((x) => x.name === "Story")); E.ui.run("flow.story"); });
    await p.waitForTimeout(300);
    const ta = await ev(() => document.getElementById("storyTxt").value.split(" ").length);
    await ev(() => { const t = document.getElementById("storyTxt"); t.value = t.value.replace("INSERTED ", ""); document.getElementById("storyOk").click(); });
    await p.waitForTimeout(700);
    st = await frames();
    check("✎ Story…: the whole story in a box; OK changes it (undoable) and the frames follow", ta === N + 1 && st[0].frames[0].str === STORY && st[0].frames[1].str.split(" ")[0] === after.replace("INSERTED", "w1") || (st[0].frames[0].str === STORY && !st[0].frames.some((f) => /INSERTED/.test(f.str))), st[0].frames.map((f) => f.str.slice(0, 12)));
    const undone = await ev(async () => { const E = window.imageEditorInstance.E; E.undo(); await new Promise((r) => setTimeout(r, 700)); return E.S.layers.find((x) => x.name === "Story").text.str.includes("INSERTED"); });
    check("…Ctrl+Z brings the old story back", undone);
    await ev(() => window.imageEditorInstance.E.redo()); await p.waitForTimeout(600);

    /* 6 Unlink frame 2: the chain breaks there - two stories, every word still once */
    await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.findIndex((x) => x.text && x.text.flow && x.text.flow.idx === 1)); E.flow.unlink(); });
    await p.waitForTimeout(700);
    st = await frames();
    check("Unlink frame 2: two stories - frame 1 alone; frame 2 starts a new one that goes on to page 2", st.length === 2 && st.some((s) => s.frames.length === 1) && st.some((s) => s.frames.length === 2 && s.frames[1].page === 1), st.map((s) => s.frames.map((f) => [f.idx, f.page, f.str.slice(0, 10)])));
    pg = await pdfPages();
    if (pg) { const all = words(pg[0]).concat(words(pg[1])); check("…exported: every word still exactly once, in order", all.length === N && all.every((w, i) => w === "w" + (i + 1)), all.length); }

    /* 7 .bgi keeps the frames and the wrap */
    const bg = await ev(async () => Array.from((await window.imageEditorInstance.E.bgi.toBytes()).bytes));
    await ev(async (a) => { await window.imageEditorInstance.E.bgi.openBytes(new Uint8Array(a), "Flow.bgi"); }, bg);
    await p.waitForTimeout(900);
    st = await frames();
    const wrapKept = await ev(() => { const E = window.imageEditorInstance.E; E.pages.go(0); const L = E.S.layers.find((x) => x.name === "Photo box"); return !!(L && L.wrap && L.wrap.on); });
    check("Save / open the .bgi: both stories (3 frames over 2 pages) and the wrap kept", st.length === 2 && st.reduce((n, s) => n + s.frames.length, 0) === 3 && wrapKept, st.map((s) => s.frames.length));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + (e && e.stack)); }
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
