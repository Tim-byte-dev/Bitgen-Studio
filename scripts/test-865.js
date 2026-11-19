#!/usr/bin/env node
/* bitGen Studio — 2.865.0 units: ✨ the Web editor's AI prompt docker - lib/webAi.js edit() with a stand-in LLM: the whole file or only
 * the selected part (put back in its place), the code block picked from the answer, an answer with no code / half a page refused, a
 * file too long without a selection refused, "+n −m" lines; the site's file names given to the LLM; the wiring (route, wbai.js, 🎙). */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  const A = require(path.join(ROOT, "lib/webAi.js")), W = require(path.join(ROOT, "lib/webProject.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t865-")), PJ = path.join(tmp, "projects", "Cafe"); fs.mkdirSync(PJ, { recursive: true });
  W.setProjectDir(() => PJ); W.create(undefined, "Cafe"); fs.writeFileSync(path.join(PJ, "www", "images", "croissant.jpg"), "x");
  let seen = null, answer = "";
  A.setComplete(async (x) => { seen = x; return { ok: true, text: answer }; });
  const page = "<html>\n<body>\n<h1>Hello</h1>\n<p>Old text</p>\n</body>\n</html>";
  answer = "Here you go:\n```html\n<html>\n<body>\n<h1 class=\"big\">Hello</h1>\n<p>Fresh bread</p>\n</body>\n</html>\n```\nDone.";
  const r = await A.edit({ path: "index.html", text: page, ask: "bigger heading, better words" });
  check("the whole file: the code block taken from the answer (not the chat around it); +2 −2 lines", /<h1 class="big">/.test(r.text) && !/Here you go/.test(r.text) && r.added === 2 && r.removed === 2 && r.kind === "html", r);
  check("...the LLM told: the file, what to do, the site's files (images/croissant.jpg) and to answer in ONE code block", /File: index\.html/.test(seen.messages[1].content) && /What to do: bigger heading/.test(seen.messages[1].content) && /images\/croissant\.jpg/.test(seen.messages[1].content) && /ONE ```html code block/.test(seen.messages[0].content) && /WHOLE file/.test(seen.messages[0].content));
  const a = page.indexOf("<p>"), b = page.indexOf("</p>") + 4;
  answer = "```html\n<p>Croissants every morning</p>\n```";
  const r2 = await A.edit({ path: "index.html", text: page, ask: "about croissants", a, b });
  check("a selection: only that part sent ('ONLY A PART') and put back in its place, the rest untouched; the new part's range back", /ONLY A PART/.test(seen.messages[0].content) && !/<h1>/.test(seen.messages[1].content.split("```html")[1]) && r2.text === page.replace("<p>Old text</p>", "<p>Croissants every morning</p>") && r2.text.slice(r2.a, r2.b) === "<p>Croissants every morning</p>", r2);
  answer = "Sorry, I can't.";
  let e = ""; try { await A.edit({ path: "index.html", text: page, ask: "x" }); } catch (x) { e = x.message; }
  check("an answer with no code: refused (the file not touched)", /no code/.test(e), e);
  answer = "```html\n<h1>Hello</h1>\n```";
  e = ""; try { await A.edit({ path: "index.html", text: page, ask: "x" }); } catch (x) { e = x.message; }
  check("half a page back for a whole page: refused - select the part", /only part of the page/.test(e), e);
  e = ""; try { await A.edit({ path: "index.html", text: "x".repeat(A.MAX + 1), ask: "x" }); } catch (x) { e = x.message + x.status; }
  check("a file too long without a selection: 413 - select the part", /too long/.test(e) && /413/.test(e), e);
  answer = "```css\nbody { color: red; }\n```";
  const r3 = await A.edit({ path: "css/style.css", text: "body { color: blue; }", ask: "red" });
  check("a .css file: the LLM asked for a css block; the answer used", /```css/.test(seen.messages[1].content) && r3.text === "body { color: red; }" && r3.kind === "css", r3);
  e = ""; try { await A.edit({ path: "index.html", text: page, ask: " " }); } catch (x) { e = x.message; } check("nothing asked: refused", /say what to change/.test(e));
  check("countDiff counts changed lines", JSON.stringify(A.countDiff("a\nb\nc", "a\nB\nc\nd")) === JSON.stringify({ added: 2, removed: 1 }));
  const R = src("routes/webEditor.js"), J = src("ext/webdock/wbai.js"), E = JSON.parse(src("ext/webdock/ext.json")), Wj = src("ext/webdock/webdock.js");
  check("wiring: POST /api/web/ai/edit (routes/webEditor.js), wbai.js loaded, H3Web.setText / currentText, 🎙 -> /api/voice/hear with a 16 kHz wav + the Download / Cancel box for speech to text", /\/api\/web\/ai\/edit/.test(R) && E.scripts.includes("wbai.js") && /function setText\(t\)/.test(Wj) && /\/api\/voice\/hear/.test(J) && /encodeWav\(V\.downsample\(all, r\.rate, 16000\), 16000\)/.test(J) && /H3NeedInstall\.ensure\("whisper"/.test(J));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
