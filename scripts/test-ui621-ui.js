#!/usr/bin/env node
/* bitGen Studio — 2.621.0 in a REAL browser: THE SFX DOCKER'S 🗣 SPEECH & DIALOG.
 * Tim: "in the sfx docker can you add an input that the user can copy/paste text, or get input from the llm or type custom
 * text to create speech/dialog user can choose the voice/voices and the text will be read with emotion using omnivoice or
 * ming voices. save formats will be wav or mp3 to save the read voice into assets-audio. The name of the file will be an
 * input above the speech input, description will be below - it would be great if we can save the date,time,description and
 * text in the files metadata"
 *   the name above / the description below the text; typed dialog -> the cast (a voice + an emotion per speaker); a sound
 *   tag; 📋 Paste from the clipboard; ✨ Write (the LLM's answer - stood in for here: the stub server has no LLM); 🗣 Read &
 *   save -> a .wav in the Audio assets (the stand-in OmniVoice: one batch, each speaker's voice, the moods' pace) with the
 *   date + time, description and text in it; .mp3 the same; Ming not installed = where to get it; the draft kept.
 * Against the running app (H3_URL) with the gate's stand-in OmniVoice venv (venvs/omnivoice -> scripts/stub-venv.py).
 * No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.621.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_speech_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const st = await api("/api/tts");
  if (!st.omnivoice || !st.omnivoice.installed) { console.log("SKIP: no (stand-in) OmniVoice venv here - the gate makes venvs/omnivoice before this test"); process.exit(0); }
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1200 }, permissions: ["clipboard-read", "clipboard-write"] });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: PN });
    await api("/api/projects/load", { name: PN });
    // two voices: Ben designed, Anna cloned (a tone stands in for her clip)
    await api("/api/tts/voices/design", { name: "Ben", instruct: "male, low pitch" });
    execSync("ffmpeg -y -loglevel error -f lavfi -i sine=frequency=330:duration=4 /tmp/sp621_anna.wav");
    const fd = new FormData(); fd.append("name", "Anna"); fd.append("text", "hello there this is anna"); fd.append("file", new Blob([require("fs").readFileSync("/tmp/sp621_anna.wav")]), "anna.wav");
    await fetch(URL_ + "api/tts/voices", { method: "POST", body: fd });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SpeechDialog && document.getElementById("spEngine").options.length, null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("sfxdock"); if (d.classList.contains("dockgone")) toggleDockGone("sfxdock", "tSfx"); if (d.classList.contains("collapsed")) toggleCollapse("sfxdock"); toggleMax("sfxdock", true);
      const pd = document.getElementById("promptdock"); if (pd && !pd.classList.contains("dockgone")) toggleDockGone("promptdock", "tP"); });   // the floating prompt sits over it
    await p.waitForTimeout(500);
    await ev(() => H3SpeechDialog.load());
    const lay = await ev(() => { const y = (id) => document.getElementById(id).getBoundingClientRect().top; return { name: y("spName"), text: y("spText"), desc: y("spDesc"), engines: [...document.getElementById("spEngine").options].map((o) => o.textContent), voices: [...document.getElementById("spVoice").options].map((o) => o.value) }; });
    check("the SFX docker's 🗣 Speech & dialog: the file NAME above the text, the DESCRIPTION below; OmniVoice / Ming-3.0 TTS (not installed); the project's voices",
      lay.name < lay.text && lay.text < lay.desc && lay.engines.some((t) => /^OmniVoice$/.test(t)) && lay.engines.some((t) => /Ming-3\.0 TTS \(not installed\)/.test(t)) && lay.voices.includes("Anna") && lay.voices.includes("Ben"), lay);

    /* typed dialog -> the cast */
    await p.fill("#spName", "Kitchen scene");
    await p.click("#spText");
    await p.keyboard.type("Anna (happy): We made it!\nBen: Already? ");
    await p.selectOption("#spTag", "[laughter]");
    await p.keyboard.type("\n\n(sad) It is over though.");
    await p.fill("#spDesc", "the two of them back home");
    await p.waitForTimeout(700);
    const cast = await ev(() => ({ rows: [...document.querySelectorAll("#spCast select[data-k=voice]")].map((s) => s.getAttribute("aria-label")), text: document.getElementById("spText").value, prog: document.getElementById("spProg").textContent }));
    check("typed dialog: the cast lists its speakers (Anna, Ben) - a voice + an emotion each; ＋ tag put [laughter] where the cursor was",
      cast.rows.join() === "Anna's voice,Ben's voice" && /Already\? \[laughter\] /.test(cast.text) && /3 lines · 2 speakers/.test(cast.prog), cast);
    await p.selectOption('#spCast select[aria-label="Anna\'s voice"]', "Anna");
    await p.selectOption('#spCast select[aria-label="Ben\'s voice"]', "Ben");
    await p.selectOption('#spCast select[aria-label="Ben\'s emotion"]', "surprised");

    /* 📋 Paste */
    await ev(() => navigator.clipboard.writeText("Anna: And the cake?"));
    await ev(() => { const t = document.getElementById("spText"); t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
    await p.keyboard.type("\n");
    await p.click("#spPaste"); await p.waitForTimeout(600);
    const pasted = await ev(() => document.getElementById("spText").value);
    check("📋 Paste: the clipboard's text goes in where the cursor is", /It is over though\.\nAnna: And the cake\?$/.test(pasted), pasted);

    /* 🗣 Read & save: WAV */
    const r1 = await ev(async () => { const j = await H3SpeechDialog.go(); return { j, msg: document.getElementById("spMsg").textContent, meta: document.getElementById("spMeta").textContent, src: document.getElementById("spPlay").getAttribute("src"), shown: document.getElementById("spPlay").style.display }; });
    const j = r1.j || {};
    check("🗣 Read & save: \"Kitchen scene.wav\" in the Audio assets - 4 lines (OmniVoice: Anna's clone, Ben's designed voice a little faster - surprised)",
      j.name === "Kitchen scene.wav" && j.lines === 4 && j.engine === "omnivoice" && j.plan[0].voice === "Anna" && j.plan[0].emotion === "happy" && j.plan[1].voice === "Ben" && j.plan[1].emotion === "surprised" && j.plan[2].emotion === "sad" && /saved in the Audio assets/.test(r1.msg) && r1.shown === "block" && /\/passets\/sound\/Kitchen%20scene\.wav/.test(r1.src), r1);
    const assets = await api("/api/passets");
    const meta = await api("/api/speech/meta?name=" + encodeURIComponent("Kitchen scene.wav"));
    check("…it is a sound asset; its metadata: title, date + time, the description, the text, the voices",
      (assets.sound || []).some((x) => x.name === "Kitchen scene.wav" && x.duration > 1) && meta.title === "Kitchen scene" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(meta.date) && meta.description === "the two of them back home" && /We made it!/.test(meta.text) && /And the cake\?/.test(meta.text) && meta.voices === "Anna, Ben", meta);

    /* MP3, one voice */
    await p.selectOption("#spFmt", "mp3"); await p.selectOption("#spMode", "single"); await p.selectOption("#spVoice", "Ben"); await p.selectOption("#spEmo", "angry");
    await p.waitForTimeout(500);
    const r2 = await ev(async () => { const j = await H3SpeechDialog.go(); return { j, cast: document.getElementById("spCast").children.length }; });
    const m2 = await api("/api/speech/meta?name=" + encodeURIComponent((r2.j || {}).name || ""));
    check("MP3 + one voice reads it all (Ben, angry): \"Kitchen scene.mp3\", no cast, the ID3 text + description", r2.j && r2.j.name === "Kitchen scene.mp3" && r2.j.plan.every((x) => x.voice === "Ben" && (x.emotion === "angry" || x.emotion === "sad" || x.emotion === "happy")) && r2.cast === 0 && /We made it!/.test(m2.text) && m2.description === "the two of them back home", { r2, m2 });

    /* Ming not installed */
    await p.selectOption("#spEngine", "ming");
    const r3 = await ev(async () => { await H3SpeechDialog.go(); return document.getElementById("spMsg").textContent; });
    check("Ming-3.0 TTS picked but not installed: it says where to install it (nothing written)", /Ming-3\.0 TTS is not installed/.test(r3) && /Add-ons/.test(r3), r3);
    await p.selectOption("#spEngine", "omnivoice");

    /* ✨ Write (the LLM's answer stood in for) */
    await p.route("**/api/speech/write", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "Cara (excited): Look at this!\nDan (fearful): Is it safe?", speakers: ["Cara", "Dan"] }) }));
    await p.fill("#spBrief", "two people find a strange box");
    await p.click("#spWrite"); await p.waitForTimeout(900);
    const w = await ev(() => ({ text: document.getElementById("spText").value, mode: document.getElementById("spMode").value, rows: [...document.querySelectorAll("#spCast select[data-k=voice]")].map((s) => s.getAttribute("aria-label")), msg: document.getElementById("spMsg").textContent }));
    check("✨ Write: the LLM's lines replace the text, the cast becomes theirs (Cara, Dan), back to dialog", /^Cara \(excited\): Look at this!\nDan \(fearful\): Is it safe\?$/.test(w.text) && w.mode === "dialog" && w.rows.join() === "Cara's voice,Dan's voice" && /written/.test(w.msg), w);
    await p.keyboard.press("Control+z"); await p.waitForTimeout(200);
    const undone = await ev(() => document.getElementById("spText").value);
    check("…Ctrl+Z in the box brings the old text back", /We made it!/.test(undone), undone);

    /* the draft is kept */
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3SpeechDialog && document.getElementById("spEngine").options.length && document.getElementById("spText").value, null, { timeout: 60000 });
    const kept = await ev(() => ({ name: document.getElementById("spName").value, desc: document.getElementById("spDesc").value, fmt: document.getElementById("spFmt").value, text: document.getElementById("spText").value }));
    check("the draft (name, text, description, format) is still there after a reload", kept.name === "Kitchen scene" && kept.desc === "the two of them back home" && kept.fmt === "mp3" && /We made it!/.test(kept.text), kept);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
