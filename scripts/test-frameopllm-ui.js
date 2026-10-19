#!/usr/bin/env node
/* bitGen Studio — 2.395.0 in a REAL browser: Append / Prepend = fl2va, the Image tab's first picture is <Picture 2>,
 * and the LLM (✨ Enhance, the prompt chat) is sent the op.
 * Tim (verbatim): "when prepend or append video use fl2va not ref2a or i2v . if there are pictures in the ref images
 * tab label the first picture as picture 2. let the llm know the details"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the Append / Prepend fl2va browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const field = (body, k) => { const m = new RegExp(`name="${k}"\\r\\n\\r\\n([^\\r]*)`).exec(body || ""); return m ? m[1] : null; };
const files = (body) => [...(body || "").matchAll(/name="(?:references|ref_images)"; filename="([^"]+)"/g)].map((m) => m[1]);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1900, height: 1150 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const gen = [], enh = [], chat = [];
  const pick = (sel, v) => p.evaluate(([q, val]) => { const e = document.querySelector(q); e.value = val; e.dispatchEvent(new Event("change", { bubbles: true })); }, [sel, v]);
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.route("**/api/generate", (r) => { gen.push(r.request().postData() || ""); r.fulfill({ json: { id: "fol1", status: "queued" } }); });
    await p.route("**/api/enhance", (r) => { enh.push(r.request().postData() || ""); r.fulfill({ json: { text: "she walks on" } }); });
    await p.route("**/api/chat", (r) => { if (r.request().method() !== "POST") return r.continue(); chat.push(r.request().postData() || ""); r.fulfill({ json: { reply: "ok", session: "s" } }); });
    await p.route("**/api/comfy/status", (r) => r.fulfill({ json: { ok: true, running: true, reachable: true, engine: "sdcli" } }));
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof renderRefLists === "function" && window.RefRoles && RefRoles.frameOpTags && typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY, null, { timeout: 60000 });
    await p.waitForTimeout(2000);
    await ev(() => {
      const d = document.getElementById("refsdock");
      if (d.classList.contains("dockgone")) toggleDockGone("refsdock", null);
      if (d.classList.contains("collapsed")) toggleCollapse("refsdock");
      document.querySelector('.modes button[data-mode="ref2va"]') && document.querySelector('.modes button[data-mode="ref2va"]').click();
      const mk = (n) => ({ file: new File([new Uint8Array([137, 80, 78, 71])], n, { type: "image/png" }), url: "", subject: 1, role: "person", roleOther: "" });
      refs.length = 0; refs.push(mk("girl.png"), mk("dog.png"));
      refVids.length = 0; refVids.push("fol_a.mp4"); refVidOps = {}; renderRefLists(); renderTray();
    });
    await p.waitForTimeout(200);
    const tags = () => ev(() => [...document.querySelectorAll("#tray .slot:not(.add)")].map((s) => s.querySelector(".tag").textContent + (s.classList.contains("fopoff") ? "~off" : "")));
    const t0 = await tags();
    check("no op: the Image tab is References as before (<Picture 1>, <Picture 2>)", t0.join("|") === "<Picture 1>|<Picture 2>", t0);

    // Append
    await pick('#refvids [data-refvid="fol_a.mp4"] .rvop', "append");
    await p.waitForTimeout(200);
    const t1 = await tags();
    const note1 = await ev(() => (document.querySelector('#refvids [data-refvid="fol_a.mp4"] .rvnote') || {}).textContent);
    const map1 = await ev(() => ({ hidden: document.getElementById("mapline").classList.contains("hidden"), lines: mappingLines() }));
    check("Append: the first picture is labelled 'Picture 2 · last frame', the other 'not used' (dimmed)", t1.join("|") === "Picture 2 · last frame|not used (append)~off", t1);
    check("...the video says what it gives: fl2va, <Picture 1> = its last frame, <Picture 2> = the Image tab's picture", /^fl2va · <Picture 1> = its last frame - the new part starts on it; <Picture 2>/.test(note1 || ""), note1);
    check("...no <subject n> mapping lines (the pictures are frames now)", map1.hidden && map1.lines === "", map1);
    await ev(() => submitJob("she walks on"));
    await p.waitForTimeout(400);
    const g1 = gen[gen.length - 1];
    check("Generate: mode fl2va (not ref2va / i2v), ref_video_op append, the FIRST picture sent (untyped)",
      field(g1, "mode") === "fl2va" && field(g1, "ref_video_op") === '{"name":"fol_a.mp4","op":"append"}' && files(g1).join() === "girl.png", { mode: field(g1, "mode"), op: field(g1, "ref_video_op"), files: files(g1) });

    // ✨ Enhance
    await ev(() => { document.getElementById("prompt").value = "she walks on"; enhancePrompt();   /* 2.401.0: the ⏫ Enhance button upscales a video now */ });
    await p.waitForTimeout(800);
    const e1 = JSON.parse(enh[enh.length - 1] || "{}");
    check("✨ Enhance is told: ref_video_op + the picture as <Picture 2> (only the one used)",
      e1.ref_video_op && e1.ref_video_op.op === "append" && e1.ref_video_op.name === "fol_a.mp4" && e1.refs.length === 1 && e1.refs[0].picture === 2 && e1.refs[0].name === "girl.png", e1);

    // Prepend + a typed First frame on the second picture: that one is <Picture 2>
    await ev(() => { refs[1].role = "first frame"; renderTray(); });
    await pick('#refvids [data-refvid="fol_a.mp4"] .rvop', "prepend");
    await p.waitForTimeout(200);
    const t2 = await tags();
    check("Prepend with a picture typed First frame: THAT one is 'Picture 2 · first frame', the other not used", t2.join("|") === "not used (prepend)~off|Picture 2 · first frame", t2);
    await ev(() => submitJob("she walks on"));
    await p.waitForTimeout(400);
    const g2 = gen[gen.length - 1];
    check("Generate: fl2va, prepend, dog.png sent", field(g2, "mode") === "fl2va" && /"op":"prepend"/.test(field(g2, "ref_video_op") || "") && files(g2).join() === "dog.png", { mode: field(g2, "mode"), files: files(g2) });

    // the prompt chat
    const sent = await ev(() => { if (typeof chatSend !== "function") return false; const g = document.getElementById("genModeSel"); if (g) g.value = "video"; chatSend("write the prompt"); return true; });
    await p.waitForTimeout(800);
    if (sent && chat.length) {
      const c1 = chat[chat.length - 1];
      const ctx = JSON.parse(field(c1, "context") || (() => { try { return JSON.stringify(JSON.parse(c1).context); } catch { return "{}"; } })());
      check("the prompt chat is told: context.ref_video_op prepend, the picture used sent (dog.png) as the dock's one picture",
        ctx.ref_video_op && ctx.ref_video_op.op === "prepend" && ctx.refs && ctx.refs.length === 1 && ctx.refs[0].name === "dog.png" && files(c1).join() === "dog.png", { ctx, files: files(c1) });
    } else check("the prompt chat is told (the chat box was found and sent)", false, { sent, n: chat.length });

    // Reference again: back to References
    await pick('#refvids [data-refvid="fol_a.mp4"] .rvop', "");
    await p.waitForTimeout(200);
    const t3 = await tags();
    check("Use = Reference again: the Image tab back to <Picture 1> / its typed role, nothing dimmed", t3.join("|") === "<Picture 1>|first frame", t3);
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    try { await ev(() => { refs.length = 0; refVids.length = 0; refVidOps = {}; renderRefLists(); renderTray(); }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
