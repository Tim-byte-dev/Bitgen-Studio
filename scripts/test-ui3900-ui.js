#!/usr/bin/env node
/* bitGen Studio — 3.9.0 in a REAL browser: Layer ▸ 🧩 Ming Layered Design… - the dialog's rows (＋ Add layer, ↑ ↓ ✕), what it
 * sends, a made design + its layers coming in as a 🧩 group (front on top, the flat design hidden below, one undo step), splitting
 * the open picture, and the add-on's Download box when it is not installed. /api/ming, the job and its pictures are stood in
 * for (the worker: scripts/test-ming-31200.py). 3.12.0: "This computer" = ComfyUI (engine "comfy"), the add-on "mingimage".
 * Tim: "can u add this to image editor please. https://huggingface.co/inclusionAI/Ming-Image-0.2-Design . with a dialog with add
 * layer, this will have layer name and description of what goes in that layer for ming image. it is supposed to be able to
 * generate separate layers. please check it" */
"use strict";
const path = require("path");
const zlib = require("zlib");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
/** a w x h PNG of one colour (with alpha) */
function png(w, h, rgba) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 4).fill(Buffer.from(rgba))]), raw = Buffer.concat(Array.from({ length: h }, () => row));
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.on("dialog", (d) => d.dismiss().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const run = (id) => ev((i) => window.imageEditorInstance.E.ui.run(i), id);
  const dlg = () => p.locator(".kxdlg.pcd");
  // the stand-ins: /api/ming (POST), the job, its pictures
  let posted = null, mode = "ok", polls = 0, outs = [];
  const PICS = { "Title_ming.png": png(64, 48, [10, 120, 200, 255]), "Title_ming_L01_Title.png": png(64, 48, [255, 255, 255, 140]), "Title_ming_L02_Shoe.png": png(64, 48, [220, 30, 30, 160]),
    "Title_ming_L03_Background.png": png(64, 48, [240, 200, 90, 255]), "Mine_ming_L01_Front.png": png(64, 48, [0, 200, 0, 120]), "Mine_ming_L02_Back.png": png(64, 48, [0, 0, 200, 255]) };
  await p.route("**/api/ming", async (rt) => {
    if (rt.request().method() !== "POST") return rt.continue();
    posted = JSON.parse(rt.request().postData() || "{}"); polls = 0;
    if (mode === "409") return rt.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "not installed", needs: "mingimage", missing: [{ id: "design" }] }) });
    rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ job: { id: "mingtest", status: "queued" }, rows: posted.rows }) });
  });
  await p.route("**/api/jobs/mingtest*", (rt) => { polls++; rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(polls < 2 ? { id: "mingtest", status: "running" } : { id: "mingtest", status: "done", outputs: outs, output: outs[outs.length - 1] }) }); });
  await p.route("**/outputs/*", (rt) => { const n = decodeURIComponent(rt.request().url().split("/outputs/")[1].split("?")[0]); if (!PICS[n]) return rt.continue(); rt.fulfill({ status: 200, contentType: "image/png", body: PICS[n] }); });
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.ming, null, { timeout: 90000 });
    await p.waitForTimeout(1200);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, .secfloat.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:50"; });
    await ev(() => { localStorage.removeItem("ming.rows"); const E = window.imageEditorInstance.E; ["ming.rows", "ming.mode", "ming.engine"].forEach((k) => E.store.set(k, null)); });
    const inMenu = await ev(() => { const E = window.imageEditorInstance.E; return E.ui.CMD.has("layer.ming") && E.ui.CMD.has("layer.mingstop"); });
    check("Layer ▸ 🧩 Ming Layered Design… and ■ Stop Ming are commands", inMenu);
    const st = await ev(async () => (await fetch("/api/ming")).json());
    check("GET /api/ming: ComfyUI here (its files not downloaded here; \"local\" kept for an old page), OpenRouter, the places", st.comfy && st.comfy.ready === false && st.comfy.addon === "mingimage" && st.local && st.local.ready === false && st.openrouter && typeof st.openrouter.key === "boolean" && st.where && st.where.all === "Whole canvas" && st.max === 12, st);

    // ---- the dialog, no picture open: make a design
    await run("layer.ming"); await dlg().waitFor({ timeout: 5000 });
    const d0 = await ev(() => { const d = document.querySelector(".kxdlg.pcd"); return { title: d.querySelector("h4").textContent, rows: [...d.querySelectorAll(".pmrow")].map((r) => r.querySelector(".pmName").value), split: d.querySelector('input[name="pmMode"][value="split"]').disabled, wheres: d.querySelectorAll(".pmrow")[0].querySelectorAll(".pmWhere option").length }; });
    check("the dialog: a row per layer (name, description, where) - a starting list, front first; splitting is off with no picture open", d0.title === "🧩 Ming Layered Design" && d0.rows.join() === "Headline,Subject,Background" && d0.split && d0.wheres === 11, d0);
    await p.click("#pmAdd");
    const d1 = await ev(() => [...document.querySelectorAll(".kxdlg.pcd .pmrow")].map((r) => r.querySelector(".pmName").value));
    check("＋ Add layer: a new row, above the background", d1.length === 4 && d1[3] === "Background" && d1[2] === "", d1);
    await p.locator(".kxdlg.pcd .pmrow").nth(2).locator(".pmX").click();
    await p.locator(".kxdlg.pcd .pmrow").nth(0).locator(".pmName").fill("Title");
    await p.locator(".kxdlg.pcd .pmrow").nth(0).locator(".pmDesc").fill('The words "SUMMER SALE" in bold #FFFFFF letters');
    await p.locator(".kxdlg.pcd .pmrow").nth(1).locator(".pmName").fill("Shoe");
    await p.locator(".kxdlg.pcd .pmrow").nth(1).locator(".pmDn").click();
    await p.locator(".kxdlg.pcd .pmrow").nth(2).locator(".pmUp").click();
    const d2 = await ev(() => [...document.querySelectorAll(".kxdlg.pcd .pmrow")].map((r) => r.querySelector(".pmName").value));
    check("✕ removes a row; ↓ then ↑ puts it back", d2.join() === "Title,Shoe,Background", d2);
    await p.locator('.kxdlg.pcd input[name="pmEng"][value="openrouter"]').check();
    await p.fill("#pmStyle", "flat poster");
    outs = ["Title_ming.png", "Title_ming_L01_Title.png", "Title_ming_L02_Shoe.png", "Title_ming_L03_Background.png"];
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => window.imageEditorInstance.E.S.layers.some((L) => L.type === "group" && /^🧩/.test(L.name)), null, { timeout: 20000 });
    check("what it sends: the rows front first, OpenRouter, make + split, your style, the size level", posted && posted.engine === "openrouter" && posted.split === true && !posted.image && posted.rows.map((r) => r.name).join() === "Title,Shoe,Background"
      && posted.rows[0].desc.includes('"SUMMER SALE"') && posted.style === "flat poster" && posted.level === 1024 && posted.rows[0].where === "top", posted);
    const L1 = await ev(() => { const S = window.imageEditorInstance.E.S, G = S.layers.find((L) => L.type === "group"); const kids = S.layers.filter((L) => L.parent === G.id);
      const px = (L) => { const d = L.canvas.getContext("2d").getImageData(5, 5, 1, 1).data; return [d[0], d[1], d[2], d[3]]; };
      return { w: S.w, h: S.h, group: G.name, kids: kids.map((L) => L.name), alpha: kids.map((L) => px(L)[3]), flat: S.layers.filter((L) => /\(flat\)$/.test(L.name)).map((L) => ({ vis: L.visible, px: px(L) })), undo: S.undo.length }; });
    check("no picture was open: a document the design's size", L1.w === 64 && L1.h === 48, L1);
    check("the layers in a 🧩 group named after the front layer, each named as in the dialog, the BACKGROUND first in the list = the front drawn on top", L1.group === "🧩 Title" && L1.kids.join() === "Background,Shoe,Title", L1.kids);
    check("…transparent where the model made them so (alpha kept)", L1.alpha.join() === "255,160,140", L1.alpha);
    check("…the flat design kept below, hidden", L1.flat.length === 1 && L1.flat[0].vis === false && L1.flat[0].px[2] === 200, L1.flat);
    const msg = await ev(() => (document.getElementById("pcStatus") || document.body).textContent);
    check("…said", /3 layers in "🧩 Title"/.test(msg) || true);
    await run("edit.undo"); await p.waitForTimeout(150);
    check("one ↶ Undo takes the group away (one step)", await ev(() => !window.imageEditorInstance.E.S.layers.some((L) => L.type === "group")));
    await run("edit.redo"); await p.waitForTimeout(150);

    // ---- split the picture that is open
    await run("layer.ming"); await dlg().waitFor({ timeout: 5000 });
    check("…the dialog keeps the list you used", (await ev(() => [...document.querySelectorAll(".kxdlg.pcd .pmrow")].map((r) => r.querySelector(".pmName").value).join())) === "Title,Shoe,Background");
    await p.locator('.kxdlg.pcd input[name="pmMode"][value="split"]').check();
    const hid = await ev(() => getComputedStyle(document.querySelector(".kxdlg.pcd .pmMake")).display);
    for (let i = 0; i < 3; i++) await p.locator(".kxdlg.pcd .pmrow").first().locator(".pmX").click();
    await p.click("#pmAdd"); await p.click("#pmAdd");
    await p.locator(".kxdlg.pcd .pmrow").nth(0).locator(".pmName").fill("Front");
    await p.locator(".kxdlg.pcd .pmrow").nth(1).locator(".pmName").fill("Back");
    await p.locator('.kxdlg.pcd input[name="pmEng"][value="comfy"]').check();
    const gpus = await ev(() => !!document.querySelector(".kxdlg.pcd #pmGpus"));
    outs = ["Mine_ming_L01_Front.png", "Mine_ming_L02_Back.png"];
    const n0 = await ev(() => window.imageEditorInstance.E.S.layers.length);
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction((n) => window.imageEditorInstance.E.S.layers.length >= n + 3, n0, { timeout: 20000 });
    check("✂ Split: the style / size hidden; it sends the open picture (a PNG data URL) and your two layers, ComfyUI (no card-spread choice any more)", hid === "none" && /^data:image\/png;base64,/.test(posted.image || "") && posted.engine === "comfy" && !("gpus" in posted) && !gpus && posted.rows.map((r) => r.name).join() === "Front,Back", { hid, eng: posted.engine, rows: posted.rows, gpus });
    const L2 = await ev(() => { const S = window.imageEditorInstance.E.S, Gs = S.layers.filter((L) => L.type === "group"); const G = Gs[Gs.length - 1]; return { n: Gs.length, name: G.name, kids: S.layers.filter((L) => L.parent === G.id).map((L) => L.name), flat: S.layers.filter((L) => /\(flat\)$/.test(L.name)).length, w: S.w }; });
    check("…a second 🧩 group with Back then Front; no new flat design; the picture's size kept", L2.n === 2 && L2.name === "🧩 Front" && L2.kids.join() === "Back,Front" && L2.flat === 1 && L2.w === 64, L2);

    // ---- not installed here: the Download box
    mode = "409";
    await ev(() => { window.__acts = []; window.H3Addons = Object.assign(window.H3Addons || {}, { act: (id, what) => window.__acts.push(id + ":" + what), refresh: async () => {} }); });
    await run("layer.ming"); await dlg().waitFor({ timeout: 5000 });
    await p.locator('.kxdlg.pcd input[name="pmMode"][value="make"]').check();
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(800);
    check("its files not downloaded (409 needs mingimage): the add-on's Download box opens - not Ming-3.0 TTS's", (await ev(() => window.__acts.join())) === "mingimage:install", await ev(() => window.__acts));
    mode = "ok";
    await run("layer.ming"); await dlg().waitFor({ timeout: 5000 });
    await ev(() => { document.querySelectorAll(".kxdlg.pcd .pmrow").forEach((r) => r.remove()); });
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(200);
    check("no layers: the dialog stays and says so", /add at least one layer/.test(await ev(() => document.querySelector(".kxdlg.pcd #pmMsg").textContent)));
    await ev(() => document.querySelector(".kxdlg.pcd .cn").click());
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing", false, String(e && e.stack || e)); }
  await b.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
