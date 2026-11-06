#!/usr/bin/env node
/* bitGen Studio — 2.698.0 in a REAL browser: AN EDIT OF A REFERENCES PICTURE COMES OUT AT BASIC SETTINGS' SIZE. With Size set
 * (1024, 1:1) and Override style ticked, the References docker's picture 1 (1000 x 500) is sent cropped to 1024 x 1024 with exact=1;
 * 2.699.0: Override NOT ticked (or "Style's own") = the first picture's own size (1008 x 496 - 16 px steps), exact=1 too.
 * Tim (verbatim, 2.699.0): "if override is not checked use the first reference image size"
 * Tim (verbatim): "when we edit an image it always uses the ref-image resolution can we change this to use our resolution using
 * basic settings docker?"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.698.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.promptLink && window.H3BasicImageSize, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    // the References docker's picture: 1000 x 500; /api/aiedit stubbed - what it is sent is kept
    await ev(() => {
      const c = document.createElement("canvas"); c.width = 1000; c.height = 500; const g = c.getContext("2d"); g.fillStyle = "#d02020"; g.fillRect(0, 0, 1000, 500); g.fillStyle = "#2050d0"; g.fillRect(400, 0, 200, 500);
      window.__pic = c.toDataURL("image/png"); window.H3Refs.images = () => [{ i: 0, name: "test", url: window.__pic, role: "", desc: "" }];
      window.__sent = []; const real = window.fetch.bind(window);
      window.fetch = async (u, o) => { const s = String(u);
        if (s === "/api/aiedit") { const fd = o.body, cr = fd.get("crop"), bm = await createImageBitmap(cr), t = document.createElement("canvas"); t.width = bm.width; t.height = bm.height; const g2 = t.getContext("2d"); g2.drawImage(bm, 0, 0);
          const mid = Array.from(g2.getImageData(Math.floor(bm.width / 2), 5, 1, 1).data.slice(0, 3)), edge = Array.from(g2.getImageData(3, 5, 1, 1).data.slice(0, 3));
          window.__sent.push({ w: fd.get("width"), h: fd.get("height"), exact: fd.get("exact"), crop: [bm.width, bm.height], mid, edge });
          return new Response(JSON.stringify({ jobs: [{ id: "t698" }] }), { status: 200, headers: { "Content-Type": "application/json" } }); }
        return real(u, o); };
    });
    const ovr = (on) => ev((on) => { const c = document.getElementById("ovrStyle"); if (c && c.checked !== on) c.click(); return c ? c.checked : null; }, on);
    const ovr0 = await ev(() => { const c = document.getElementById("ovrStyle"); return c ? c.checked : null; });
    await ovr(true);
    const sizeTo = (res, ar) => ev(([res, ar]) => { const r = document.getElementById("imgRes"), a = document.getElementById("imgAr"); r.value = res; r.dispatchEvent(new Event("change")); a.value = ar; a.dispatchEvent(new Event("change")); return window.H3BasicImageSize(); }, [res, ar]);
    const go = () => ev(async () => { const E = window.imageEditorInstance.E; await E.promptLink.takeOp({ kind: "refs", op: "edit", mode: "edit" }, "make it night"); });
    const want = await sizeTo("1024", "1:1");
    check("Basic Settings' Size 1024 + 1:1: H3BasicImageSize = 1024 x 1024", want && want.width === 1024 && want.height === 1024, want);
    await go(); await p.waitForFunction(() => window.__sent.length >= 1, null, { timeout: 20000 }).catch(() => {});
    const s1 = await ev(() => window.__sent[0]);
    check("the References picture (1000 x 500) is sent at 1024 x 1024 with exact=1 - cropped, its middle kept (blue stripe in the middle, red at the edge)",
      s1 && s1.crop[0] === 1024 && s1.crop[1] === 1024 && s1.w === "1024" && s1.h === "1024" && s1.exact === "1" && s1.mid[2] > 150 && s1.edge[0] > 150, s1);
    await sizeTo("", "1:1");
    check("Style's own: H3BasicImageSize = null", (await ev(() => window.H3BasicImageSize())) === null);
    await ev(() => { window.__sent = []; }); await go(); await p.waitForFunction(() => window.__sent.length >= 1, null, { timeout: 20000 }).catch(() => {});
    const s2 = await ev(() => window.__sent[0]);
    check("…then the first picture's own size (1000 x 500 -> 1008 x 496, 16 px steps), exact=1 (the workflow keeps it)", s2 && s2.crop[0] === 1008 && s2.crop[1] === 496 && s2.exact === "1", s2);
    // 2.699.0: Override not ticked - Basic Settings' Size is not used
    await sizeTo("1024", "1:1"); await ovr(false);
    check("Override style NOT ticked: H3BasicImageSize = null even with Size 1024", (await ev(() => window.H3BasicImageSize())) === null);
    await ev(() => { window.__sent = []; }); await go(); await p.waitForFunction(() => window.__sent.length >= 1, null, { timeout: 20000 }).catch(() => {});
    const s3 = await ev(() => window.__sent[0]);
    check("…the first picture's own size is sent (1008 x 496), exact=1", s3 && s3.crop[0] === 1008 && s3.crop[1] === 496 && s3.w === "1008" && s3.h === "496" && s3.exact === "1", s3);
    await sizeTo("", "1:1"); if (ovr0 !== null) await ovr(ovr0);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
