#!/usr/bin/env node
/* bitGen Studio — 2.654.0 in a REAL browser: 🩹 RESTORE / FIX A PHOTO in the prompt docker's left column - 🖼 Image mode,
 * ✏ Edit, the restore instruction leading the prompt (once; Shift+click: colourise too), the note saying which picture
 * Edit takes (none / the References docker's / the image editor's layer), and Generate sending the edit model that
 * picture with the instruction (the AI stubbed - what is SENT is checked).
 * Tim (verbatim): "please a a button to the shortcut buttons on the left of the prompt docker to restore/fix photo"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.654.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const st = () => ev(() => ({ mode: document.getElementById("genModeSel").value, op: window.H3ImgOp ? H3ImgOp.get() : null, prompt: document.getElementById("prompt").value,
    note: (document.getElementById("ptRestoreNote") || {}).textContent || "", noteShown: !!document.getElementById("ptRestoreNote") && !document.getElementById("ptRestoreNote").hidden }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PtRestore && window.H3ImgOp && document.getElementById("ptRestore") && window.imageEditorInstance && window.imageEditorInstance.E, null, { timeout: 60000 });
    await p.waitForTimeout(800);
    // the image editor off screen (Edit then takes the References docker's pictures), the tray empty, video mode, words typed
    await ev(() => { const d = document.getElementById("imageeditdock"); if (!d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); rgClear(); renderTray();
      const g = document.getElementById("genModeSel"); g.value = "video"; g.onchange(); document.getElementById("prompt").value = "her dress is dark green"; });
    await ev(() => H3PromptFront.front()); await p.waitForTimeout(900);         // the prompt docker on screen (Ctrl+P's way)

    /* ---- the button */
    const btn = await ev(() => { const b = document.getElementById("ptRestore"), col = document.getElementById("ptools"), ids = [...col.querySelectorAll("button")].map((x) => x.id); return { icon: b.textContent, inCol: col.contains(b), last: ids[ids.length - 1], after: ids.indexOf("ptRestore") > ids.indexOf("ptMusicVideo"), title: b.title, shown: b.getBoundingClientRect().width > 0 }; });
    check("🩹 in the prompt docker's left column, after 🎤 (a tooltip says what it does)", btn.icon === "🩹" && btn.shown && btn.inCol && btn.after && /Restore \/ fix a photo/.test(btn.title) && /Shift\+click/.test(btn.title), btn);
    await p.click("#ptRestore"); await p.waitForTimeout(300);
    const s1 = await st();
    check("a click: 🖼 Image mode, ▾ ✏ Edit, the restore instruction leads the prompt (the typed words kept after it)",
      s1.mode === "image" && s1.op === "edit" && /^Restore this photo: remove scratches/.test(s1.prompt) && /her dress is dark green$/.test(s1.prompt) && !/colourise/.test(s1.prompt), s1);
    check("…no picture yet: the note says to put the photo in the 🖼 References docker (or the image editor)", s1.noteShown && /put the photo in the 🖼 References docker/.test(s1.note), s1.note);
    const go = await ev(() => document.getElementById("go").textContent);
    check("…the Generate button reads ✏ Edit", /✏ Edit/.test(go), go);
    await p.click("#ptRestore"); await p.waitForTimeout(200);
    const s2 = await st();
    check("a second click adds nothing", s2.prompt === s1.prompt, s2.prompt);
    await p.click("#ptRestore", { modifiers: ["Shift"] }); await p.waitForTimeout(200);
    const s3 = await st();
    check("Shift+click: + colourise (once), the rest kept", (s3.prompt.match(/colourise/g) || []).length === 1 && /her dress is dark green$/.test(s3.prompt) && s3.prompt.indexOf("colourise") < s3.prompt.indexOf("her dress"), s3.prompt);

    /* ---- a photo in the References docker: the note + Generate sends it with the instruction */
    await ev(async () => { const c = document.createElement("canvas"); c.width = 320; c.height = 240; const g = c.getContext("2d"); g.fillStyle = "#8a7a60"; g.fillRect(0, 0, 320, 240); g.fillStyle = "#fff"; g.fillRect(40, 40, 3, 160);
      const bl = await new Promise((ok) => c.toBlob(ok, "image/png")); const f = new File([bl], "old-photo.png", { type: "image/png" });
      refs.push({ file: f, url: URL.createObjectURL(f), subject: 1, role: "person", roleOther: "" }); renderTray(); });
    await p.waitForTimeout(700);
    await p.click("#ptRestore"); await p.waitForTimeout(200);
    const s4 = await st();
    check("with a photo in the References docker: the note says ✏ Edit restores it", /restores the picture in the 🖼 References docker/.test(s4.note), s4.note);
    await ev(() => { const E = window.imageEditorInstance.E; window.__sent = []; window.__realAi = E.api.aiedit; E.api.aiedit = async (req) => { window.__sent.push({ mode: req.mode, prompt: req.prompt, w: req.width, h: req.height, crop: !!req.crop }); return { jobs: [{ id: "stub1" }] }; }; });
    await p.click("#go");
    await p.waitForFunction(() => window.__sent.length >= 1, null, { timeout: 15000 }).catch(() => {});
    const sent = await ev(() => window.__sent);
    check("Generate (✏ Edit): the edit model gets the References docker's photo with the restore instruction", sent.length === 1 && sent[0].mode === "edit" && sent[0].crop && /^Restore this photo:/.test(sent[0].prompt) && Math.abs(sent[0].w / sent[0].h - 4 / 3) < 0.05, sent);
    await ev(() => { const E = window.imageEditorInstance.E; E.api.aiedit = window.__realAi; rgClear(); renderTray(); });

    /* ---- the image editor open: its layer */
    await ev(() => new Promise((ok) => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock");
      const c = document.createElement("canvas"); c.width = 400; c.height = 300; c.getContext("2d").fillStyle = "#777"; c.getContext("2d").fillRect(0, 0, 400, 300); window.imageEditorInstance.load(c.toDataURL("image/png")); setTimeout(ok, 1200); }));
    await p.click("#ptRestore"); await p.waitForTimeout(300);
    const s5 = await st();
    check("the image editor open: the note says ✏ Edit restores its layer", /restores (the layer “.+”|the picture) in the image editor|the selection on/.test(s5.note), s5.note);

    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
