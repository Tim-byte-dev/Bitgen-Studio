#!/usr/bin/env node
/* bitGen Studio — 2.899.0 in a REAL browser: the prompt chat and ✨ Enhance in IMAGE mode send the References docker's
 * pictures (tray order, names, the pictures themselves) so the server can name them the image model's way; in Video mode
 * (References) they go as before; the server's reply (stubbed here) is shown with the model's words, no file name.
 * Tim (verbatim): "fix the way the llm returns a picture name for different video types and image models. it is returning
 * the filename instead of picture 1 or image 1" */
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
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const sent = [];
  await p.route("**/api/chat", async (r) => {
    if (r.request().method() !== "POST") return r.continue();
    const body = r.request().postDataBuffer() || Buffer.from("");
    sent.push({ ct: r.request().headers()["content-type"] || "", body: body.toString("latin1") });
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ session: "t899.chat", reply: "```image\nThe woman from image 1 wearing the dress from image 2\n```", context: 0 }) });
  });
  await p.route("**/api/enhance", async (r) => {
    sent.push({ enhance: true, body: r.request().postData() || "" });
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "The woman from image 1 wearing the dress from image 2", note: "the pictures named for FLUX.2 Klein 9B: ava_face.png -> image 1" }) });
  });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && typeof chatPost === "function" && document.getElementById("genModeSel"), null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    const klein = await ev(() => { const o = [...document.getElementById("styleSel").options].find((x) => /Klein 9B$/.test(x.textContent.trim()) || x.textContent.trim() === "FLUX.2 Klein 9B"); return o ? o.value : ""; });
    await ev(async (kid) => {
      const pic = async (col, name) => { const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d"); g.fillStyle = col; g.fillRect(0, 0, 32, 32); const blob = await new Promise((ok) => c.toBlob(ok, "image/png")); return new File([blob], name, { type: "image/png" }); };
      refs.splice(0, refs.length);                                       // eslint-disable-line no-undef
      for (const [col, name] of [["#e00000", "ava_face.png"], ["#00c000", "dress.png"]]) { const f = await pic(col, name); refs.push({ file: f, url: URL.createObjectURL(f), subject: 1, role: "person", roleOther: "" }); }   // eslint-disable-line no-undef
      renderTray();                                                      // eslint-disable-line no-undef
      const gm = document.getElementById("genModeSel"); gm.value = "image"; gm.dispatchEvent(new Event("change", { bubbles: true }));
      if (kid) { const ss = document.getElementById("styleSel"); ss.value = kid; ss.dispatchEvent(new Event("change", { bubbles: true })); }
    }, klein);
    await p.waitForTimeout(300);
    const r1 = await ev(async () => { const { j } = await chatPost("write the prompt", ""); return j; });   // eslint-disable-line no-undef
    const c1 = sent.filter((x) => !x.enhance).pop() || { body: "" };
    const ctx1 = (() => { const m = /name="context"\r\n\r\n([^\r]*)\r\n/.exec(c1.body); try { return JSON.parse(m[1]); } catch (e) { return null; } })();
    check("💬 chat in IMAGE mode: multipart with both pictures as ref_images (tray order) + context.refs (names, the image style)",
      /multipart\/form-data/.test(c1.ct) && /name="ref_images"; filename="ava_face\.png"[\s\S]*name="ref_images"; filename="dress\.png"/.test(c1.body)
      && ctx1 && ctx1.gen_mode === "image" && (ctx1.refs || []).map((r) => r.name).join() === "ava_face.png,dress.png" && !ctx1.ref_video_op && (!klein || ctx1.image_style_id === klein), { ct: c1.ct, ctx: ctx1 });
    check("...the reply comes back in the model's words (image 1 / image 2), no file name", /image 1/.test(r1.reply) && !/\.png/.test(r1.reply), r1);
    // Video mode, References: as before
    await ev(() => { const gm = document.getElementById("genModeSel"); gm.value = "video"; gm.dispatchEvent(new Event("change", { bubbles: true })); mode = "ref2va"; });   // eslint-disable-line no-undef
    await ev(async () => { await chatPost("write the video prompt", ""); });   // eslint-disable-line no-undef
    const c2 = sent.filter((x) => !x.enhance).pop() || { body: "" };
    const ctx2 = (() => { const m = /name="context"\r\n\r\n([^\r]*)\r\n/.exec(c2.body); try { return JSON.parse(m[1]); } catch (e) { return null; } })();
    check("💬 chat in VIDEO mode (References): the pictures go as before", ctx2 && ctx2.gen_mode === "video" && (ctx2.refs || []).length === 2 && /name="ref_images"; filename="ava_face\.png"/.test(c2.body), ctx2);
    // ✨ Enhance in Image mode
    await ev(() => { const gm = document.getElementById("genModeSel"); gm.value = "image"; gm.dispatchEvent(new Event("change", { bubbles: true })); document.getElementById("prompt").value = "the woman in the dress"; });
    await ev(async () => { await enhancePrompt(); });                    // eslint-disable-line no-undef
    const e1 = sent.filter((x) => x.enhance).pop();
    const eb = (() => { try { return JSON.parse(e1.body); } catch (e) { return null; } })();
    check("✨ Enhance in IMAGE mode: sends the dock's pictures (picture 1 / 2, names), gen_mode image, the image style, no fl2va op",
      eb && eb.gen_mode === "image" && (eb.refs || []).map((r) => r.picture + ":" + r.name).join() === "1:ava_face.png,2:dress.png" && !eb.ref_video_op && (!klein || eb.image_style_id === klein), eb);
    check("...the enhanced text shown", (await ev(() => document.getElementById("enhancedText").value)) === "The woman from image 1 wearing the dress from image 2");
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: " + (e && e.stack || e));
  } finally {
    await b.close();
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
