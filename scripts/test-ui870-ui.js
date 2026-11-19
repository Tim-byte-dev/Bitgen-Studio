#!/usr/bin/env node
/* bitGen Studio — 2.870.0 in a REAL browser: the Character creator's 🪪 Character sheet is the H3 Character Sheet Designer's -
 * its panel (the views preset + 13 ticks, clothing / hands / feet / style / size, layout guide, part pictures with roles,
 * part notes, view instructions), the layout drawn from the pack's preview (a stand-in ComfyUI), No clothing greys the
 * clothing views, not installed = ⬇ Install… opens the Download / Cancel box, ▶ Generate sheet posts the take with the part
 * picture, the choices are remembered over a reload, the old Kind / Look / Pose sheet / Render style are gone.
 * Against the running app (H3_URL). */
"use strict";
const path = require("path"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=", "base64");
const LIST = ["minimax_h3_image_pruned_int8_convrot.safetensors", "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", "minimax_h3_image_vae_fp16.safetensors"];
const stand = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => { b += c; }); req.on("end", () => {
    const send = (code, o) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url === "/system_stats") return send(200, {});
    if (req.url === "/object_info") return send(200, { UNETLoader: { input: { required: { unet_name: [LIST] } } }, CLIPLoader: { input: { required: { clip_name: [LIST] } } },
      VAELoader: { input: { required: { vae_name: [LIST] } } }, MiniMaxH3ImageConditioning: {}, MiniMaxH3ImageCharacterSheetDesigner: { input: { required: {}, optional: { style: [["none", "anime"]] } } } });
    if (req.url === "/h3_character_sheet_designer/minimax_image/preview") {
      const v = JSON.parse(JSON.parse(b).state_json).views;
      return send(200, { width: 3200, height: 1280, megapixels: 4.1, semantic_layout: { panels: v.map((id, i) => ({ id, rect: [i / v.length, 0, 1 / v.length, 1], view: id })) },
        default_view_prompts: Object.fromEntries(v.map((id) => [id, "the default for " + id])) });
    }
    send(404, {});
  });
});
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  await new Promise((r) => stand.listen(0, "127.0.0.1", r));
  const api = (u, body) => fetch(new URL(u, URL_), body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}).then((r) => r.json());
  const eng0 = (await api("/api/config")).engine || {};
  await api("/api/config", { engine: { backend: "comfy", comfy: { url: "http://127.0.0.1:" + stand.address().port } } });
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let installed = false; const posts = [], jobs = [];
  await p.route("**/api/charsheet/h3", async (route) => {
    const rq = route.request();
    if (rq.method() !== "GET") { posts.push(rq.postDataBuffer() ? rq.postDataBuffer().toString("latin1") : ""); return route.continue(); }
    const r = await route.fetch(); const j = await r.json(); j.installed = installed; route.fulfill({ response: r, json: j });
  });
  p.on("response", async (r) => { if (/\/api\/charsheet\/h3$/.test(r.url()) && r.request().method() === "POST") { try { const j = await r.json(); if (j.id) jobs.push(j.id); } catch (e) { /* */ } } });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.evaluate(() => { try { localStorage.removeItem("h3sheet.v1"); } catch (e) { /* */ } });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SheetDesign && document.getElementById("chNewPic"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => document.getElementById("chNewPic").click());
    await p.waitForFunction(() => document.getElementById("chMaskDlg").open && document.querySelectorAll("#h3sViews input").length === 13, null, { timeout: 15000 });
    await p.waitForFunction(() => /px/.test(document.getElementById("h3sSize").textContent), null, { timeout: 15000 });
    const v0 = await ev(() => ({ presets: [...document.querySelectorAll("#h3sPreset option")].map((o) => o.value), preset: document.getElementById("h3sPreset").value,
      ticked: [...document.querySelectorAll("#h3sViews input:checked")].map((c) => c.value), cloth: document.getElementById("h3sCloth").options.length, style: document.getElementById("h3sStyle").options.length,
      size: document.getElementById("h3sSize").textContent, cv: document.getElementById("h3sCv").width, status: document.getElementById("h3sStatus").textContent,
      inst: !!document.getElementById("h3sInstall"), old: ["chOptKind", "chOptGender", "chOptStyle", "chOptDesc", "chPoseBtn", "chSheetStyleSel"].filter((id) => document.getElementById(id)) }));
    check("🖼 NEW opens the Character creator with the designer's panel: 7 presets + My own views (Standard 5), 13 view ticks (5 ticked), the selects filled",
      v0.presets.length === 8 && v0.presets[7] === "custom" && v0.preset === "five" && v0.ticked.join() === "face_front,face_left,body_front,body_left,body_back" && v0.cloth === 4 && v0.style === 10, v0);
    check("...the layout drawn from the pack's preview (3200 × 1280 px · 4.1 MP · Standard · 5 views)", /3200 × 1280 px · 4\.1 MP · Standard · 5 views/.test(v0.size) && v0.cv > 100, v0.size);
    check("...not installed: said, with ⬇ Install…; the old Kind / Gender / Look / Description / Pose sheet / Render style are gone", /not installed/.test(v0.status) && v0.inst && !v0.old.length, v0);
    const shot = await ev(() => { const c = document.getElementById("h3sCv"), g = c.getContext("2d"); const px = g.getImageData(Math.round(c.width * 0.1), Math.round(c.height / 2), 1, 1).data; return [px[0], px[1], px[2], c.height]; });
    check("...the canvas holds the panels (tinted, 2.5 : 1 like the sheet)", shot[0] > 200 && shot[2] < 230 && Math.abs(v0.cv / shot[3] - 2.5) < 0.1, shot);
    await ev(() => { const c = document.querySelector('#h3sViews input[data-view="hands"]'); c.click(); });
    const v1 = await ev(() => document.getElementById("h3sPreset").value);
    await p.selectOption("#h3sPreset", "head");
    const v2 = await ev(() => [...document.querySelectorAll("#h3sViews input:checked")].map((c) => c.value));
    check("a tick of my own = My own views; the Head · 6 views preset ticks the six head views", v1 === "custom" && v2.length === 6 && v2.every((v) => /^face_/.test(v)), { v1, v2 });
    await p.selectOption("#h3sPreset", "five");
    await p.selectOption("#h3sCloth", "none");
    const v3 = await ev(() => [...document.querySelectorAll("#h3sViews input")].filter((c) => c.disabled).map((c) => c.value));
    check("No clothing greys out the two clothing views", v3.join() === "clothing_front,clothing_back", v3);
    await p.selectOption("#h3sCloth", "reference");
    // a part picture
    // the ＋ button picks the slot and opens #h3sRefFile (headless: the file goes straight into that input)
    await ev(() => { const f = document.getElementById("h3sRefFile"); f.click = function () {}; document.getElementById("h3sRefPic1").click(); });
    const slot = await ev(() => document.getElementById("h3sRefFile").dataset.slot);
    await p.setInputFiles("#h3sRefFile", { name: "boots.png", mimeType: "image/png", buffer: PNG });
    await p.waitForFunction(() => /url\(/.test(document.getElementById("h3sRefPic1").style.backgroundImage));
    await p.selectOption("#h3sRole1", "footwear");
    const v4 = await ev(() => ({ x: document.querySelectorAll("#h3sRefs .h3sRef")[1].querySelector("button:last-child").disabled, roles: window.H3SheetDesign.state().roles }));
    check("part picture 2: ＋ picks its slot, the picture is shown, ✕ enabled, its role Footwear", slot === "1" && !v4.x && v4.roles[1] === "footwear", { slot, v4 });
    // notes + view instructions
    await ev(() => { document.getElementById("h3sPartsBox").open = true; document.getElementById("h3sVpBox").open = true; });
    await p.selectOption("#h3sPart", "footwear");
    await p.fill("#h3sPartText", "red boots");
    await p.selectOption("#h3sVp", "face_front");
    await p.waitForFunction(() => document.getElementById("h3sVpText").value === "the default for face_front", null, { timeout: 10000 });
    await p.fill("#h3sVpText", "Smiling, front.");
    const v5 = await ev(() => ({ ps: document.getElementById("h3sPartsSum").textContent, vs: document.getElementById("h3sVpSum").textContent, s: window.H3SheetDesign.state() }));
    await ev(() => document.getElementById("h3sVpReset").click());
    const v6 = await ev(() => ({ t: document.getElementById("h3sVpText").value, vs: document.getElementById("h3sVpSum").textContent }));
    check("✏ Part notes (1) and ✏ View instructions (1 edited) - the default shown, edited, ↺ Default puts it back",
      /Part notes \(1\)/.test(v5.ps) && /\(1 edited\)/.test(v5.vs) && v5.s.parts.footwear === "red boots" && v5.s.viewPrompts.face_front === "Smiling, front." && v6.t === "the default for face_front" && !/edited/.test(v6.vs), { v5, v6 });
    // not installed -> the Download / Cancel box
    await ev(() => document.getElementById("h3sInstall").click());
    await p.waitForSelector("#niDlg[open]");
    const v7 = await ev(() => ({ which: document.getElementById("niDlg").dataset.which, t: document.getElementById("niDlg").textContent }));
    await ev(() => document.getElementById("niCancel").click());
    const v7b = await ev(() => !document.getElementById("niDlg"));
    check("⬇ Install… = the Download / Cancel box for the H3 Character Sheet Designer (its size, what it does); Cancel closes it", v7.which === "h3sheet" && /H3 Character Sheet Designer is not installed yet/.test(v7.t) && /MiniMax H3 Image/.test(v7.t) && v7b, v7);
    // installed -> a take
    installed = true;
    await ev(() => window.H3SheetDesign.refresh());
    await p.waitForFunction(() => !document.getElementById("h3sInstall"));
    await p.setInputFiles("#chNewPicFile", { name: "hero.png", mimeType: "image/png", buffer: PNG });
    await p.waitForTimeout(500);
    await ev(() => document.getElementById("chSheetGen").click());
    await p.waitForFunction(() => /generating take 1/.test(document.getElementById("chSheetStatus").textContent), null, { timeout: 15000 });
    const v8 = await ev(() => document.getElementById("chSheetStatus").textContent);
    const body = posts[posts.length - 1] || "";
    check("▶ Generate sheet posts the take (the picture, part picture 2, the choices with the note and the edit) and the line names it",
      /Standard · 5 views/.test(v8) && /name="image"; filename="hero\.png"/.test(body) && /name="ref2"; filename="boots\.png"/.test(body) && /red boots/.test(body) && /"footwear"/.test(body) && jobs.length === 1, { v8, body: body.replace(/[^\x20-\x7e\n]/g, "").slice(0, 600) });
    const jb = jobs[0] ? await api("/api/jobs/" + jobs[0]) : {};
    check("...the job is the designer's graph with part picture 2 wired (image_3) and both pictures to upload", jb.params && jb.params.mode === "graph" && JSON.stringify(jb.params.graph.cond.inputs["images.image_3"]) === '["design",6]'
      && jb.params.graph_uploads.length === 2, jb.params && jb.params.graph_uploads);
    // remembered
    await ev(() => document.getElementById("chMaskCancel").click());
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SheetDesign && document.getElementById("chNewPic"), null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => document.getElementById("chNewPic").click());
    await p.waitForFunction(() => document.querySelectorAll("#h3sViews input").length === 13, null, { timeout: 15000 });
    const v9 = await ev(() => ({ roles: window.H3SheetDesign.state().roles, parts: window.H3SheetDesign.state().parts, role1: document.getElementById("h3sRole1").value }));
    check("over a reload: the roles and the part note remembered (the pictures themselves are not)", v9.roles[1] === "footwear" && v9.role1 === "footwear" && v9.parts.footwear === "red boots", v9);
    check("no page errors", !errs.length, errs);
  } catch (e) { check("no exception: " + (e && e.stack || e), false); }
  finally {
    for (const id of jobs) await api("/api/jobs/" + id + "/cancel", {}).catch(() => {});
    await api("/api/config", { engine: eng0 }).catch(() => {});
    await b.close(); stand.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
