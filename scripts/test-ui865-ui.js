#!/usr/bin/env node
/* bitGen Studio — 2.865.0 in a REAL browser: ✨ the Web editor's AI prompt docker - open at the foot, typed ask (Enter) changes the
 * open page (the LLM stood in) as one change (+n −m, the page marked changed), ↶ Undo puts it back; a selection in </> Code sends only that
 * part; 🎙 with a fake microphone records, sends a wav to /api/voice/hear and types what was heard. Against the running app (H3_URL). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] }), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const api = (u, body) => fetch(new URL(u, URL_), body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}).then((r) => r.json());
  let sent = null, heard = null;
  await p.route(/\/api\/web\/ai\/edit$/, async (r) => { sent = JSON.parse(r.request().postData()); const part = sent.b > sent.a, t = sent.text, out = part ? t.slice(0, sent.a) + "<p>CHANGED PART</p>" + t.slice(sent.b) : t.replace("<h1", '<h1 class="ai-made"');
    await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: out, part: "", a: sent.a, b: sent.a + 19, added: 1, removed: 1 }) }); });
  await p.route(/\/api\/voice\/hear$/, async (r) => { heard = r.request().postDataBuffer(); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "make the heading red" }) }); });
  try {
    await fetch(new URL("/api/web/create", URL_), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Web && window.WbAi, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => document.getElementById("tX_webdock").click());
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("webdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await p.waitForFunction(() => /index\.html/.test(document.getElementById("wbFileName").textContent), null, { timeout: 15000 });
    await p.click('#webdock .wbtab[data-tab="code"]'); await p.waitForTimeout(300);
    const v0 = await ev(() => ({ shown: getComputedStyle(document.getElementById("wbAi")).display !== "none", scope: document.getElementById("wbAiScope").textContent, btn: !!document.getElementById("wbAiBtn"), r: document.getElementById("wbAi").getBoundingClientRect().height }));
    check("✨ the AI panel at the foot of the Web editor (open), ✨ AI on the top bar, 'the whole of index.html'", v0.shown && v0.btn && v0.r > 40 && /the whole of index\.html/.test(v0.scope), v0);
    await p.fill("#wbAiAsk", "a bigger heading"); await p.press("#wbAiAsk", "Enter");
    await p.waitForFunction(() => /✓|✗/.test(document.getElementById("wbAiOut").textContent), null, { timeout: 10000 });
    const v1 = await ev(() => ({ code: document.getElementById("wbCode").value, out: document.getElementById("wbAiOut").textContent, dirty: document.getElementById("wbFileName").classList.contains("dirty"), undo: !document.getElementById("wbAiUndo").hidden, ask: document.getElementById("wbAiAsk").value }));
    check("Enter: the ask + the page sent (no selection = whole), the change in the editor, '+1 −1', the page marked changed, ↶ Undo shown", sent && sent.ask === "a bigger heading" && sent.path === "index.html" && sent.a === 0 && sent.b === 0 && /class="ai-made"/.test(v1.code) && /\+1 −1/.test(v1.out) && v1.dirty && v1.undo && v1.ask === "", { sent: sent && Object.assign({}, sent, { text: sent.text.length }), v1: Object.assign({}, v1, { code: v1.code.slice(0, 100) }) });
    await p.click("#wbAiUndo");
    check("↶ Undo: the page as it was", await ev(() => !/ai-made/.test(document.getElementById("wbCode").value) && document.getElementById("wbAiUndo").hidden));
    await ev(() => { const c = document.getElementById("wbCode"), i = c.value.indexOf("<h1"); c.focus(); c.setSelectionRange(i, c.value.indexOf("</h1>") + 5); document.dispatchEvent(new Event("selectionchange")); });
    await p.waitForTimeout(200);
    const sc = await ev(() => document.getElementById("wbAiScope").textContent);
    await p.fill("#wbAiAsk", "just this"); await p.click("#wbAiGo");
    await p.waitForFunction(() => /✓|✗/.test(document.getElementById("wbAiOut").textContent), null, { timeout: 10000 });
    const v2 = await ev(() => { const c = document.getElementById("wbCode"); return { has: c.value.includes("<p>CHANGED PART</p>"), sel: c.value.slice(c.selectionStart, c.selectionEnd) }; });
    check("a selection in </> Code: 'the selected part', only that range sent, replaced in place and selected", /the selected part of index\.html/.test(sc) && sent.b > sent.a && v2.has && v2.sel === "<p>CHANGED PART</p>", { sc, v2, a: sent.a, b: sent.b });
    // 🎙 with the fake microphone
    await ev(() => { if (window.H3NeedInstall) window.H3NeedInstall.ensure = async () => true; });
    await p.fill("#wbAiAsk", "");
    await p.click("#wbAiMic"); await p.waitForTimeout(1500);
    const on = await ev(() => document.getElementById("wbAiMic").classList.contains("on"));
    await p.click("#wbAiMic");
    await p.waitForFunction(() => /heard|✗|nothing/.test(document.getElementById("wbAiOut").textContent), null, { timeout: 10000 });
    const v3 = await ev(() => ({ ask: document.getElementById("wbAiAsk").value, out: document.getElementById("wbAiOut").textContent }));
    check("🎙 listens (⏹), then a 16 kHz wav goes to /api/voice/hear and what was heard is typed into the box", on && heard && heard.includes(Buffer.from("WAVE")) && v3.ask === "make the heading red" && /heard/.test(v3.out), { on, n: heard && heard.length, v3 });
    await p.click("#wbAiBtn");
    check("✨ AI on the top bar folds the panel", await ev(() => getComputedStyle(document.getElementById("wbAi")).display === "none"));
    await p.click("#wbAiBtn");
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
