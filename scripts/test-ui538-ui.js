#!/usr/bin/env node
/* bitGen Studio — 2.538.0 in a REAL browser:
 *   🧩 Civitai tab: ⤓ on a card -> the Select Folder dialog the FIRST time for its type -> remembered in
 *   model_folders.json; ⤓ again = no dialog, straight to that folder; Shift+⤓ = the dialog to change it; another type
 *   asks for its own; 📁 lists them (✕ forgets); the versions view's ⤓ the same way; 🔄 Sync = every model ({all, sync}).
 *   🏠 ◯ Light: press + drag on the plan = a light with that reach (the circle), ⬚ select it, its ◦ handle sizes the reach.
 *   ⛶ maximize between the open side dockers (the left docker, References, Assets, Queue, Gallery), wider when one closes.
 * Against the running app (H3_URL, default :8311). Civitai is never asked: search / download / fetch are answered in the
 * page (route), the folder dialog is answered in the page; model_folders.json is put back. */
"use strict";
const fs = require("fs"), path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.538 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const MFILE = path.join(ROOT, "model_folders.json");

(async () => {
  const had = fs.existsSync(MFILE) ? fs.readFileSync(MFILE, "utf8") : null;
  const mode0 = !!((await api("/api/testplan").catch(() => ({}))).on);
  await api("/api/testplan/mode", { on: true }).catch(() => {});
  for (const k of ["image/sdxl/lora", "image/pony/model"]) await api("/api/modelfolders", { key: k, dir: "" });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  // Civitai, in the page: two results (an SDXL LoRA, a Pony checkpoint); downloads + fetch are recorded, never sent
  const posted = { dl: [], fetch: [] };
  const ITEMS = [
    { model_id: 5381, title: "E2E 538 Detail LoRA", type: "LORA", nsfw: false, creator: "e2e", description: "", family: "sdxl", family_label: "SDXL", category: "image", released: "2026-01-01", rating: 4.5, rating_count: 3, downloads: 9, keywords: [], thumb: "", url: "https://civitai.com/models/5381",
      versions: [{ id: 53810, name: "v2", base_model: "SDXL 1.0", released: "2026-01-01", keywords: [], thumb: "", files: [{ id: 1, name: "e2e538_detail.safetensors", size_kb: 1, type: "Model", primary: true, cat: "loras" }] },
        { id: 53809, name: "v1", base_model: "SDXL 1.0", released: "2025-01-01", keywords: [], thumb: "", files: [{ id: 2, name: "e2e538_detail_v1.safetensors", size_kb: 1, type: "Model", primary: true, cat: "loras" }] }] },
    { model_id: 5382, title: "E2E 538 Pony Mix", type: "Checkpoint", nsfw: false, creator: "e2e", description: "", family: "pony", family_label: "Pony", category: "image", released: "2026-01-01", rating: 4, rating_count: 2, downloads: 3, keywords: [], thumb: "", url: "https://civitai.com/models/5382",
      versions: [{ id: 53820, name: "v1", base_model: "Pony", released: "2026-01-01", keywords: [], thumb: "", files: [{ id: 3, name: "e2e538_pony.safetensors", size_kb: 1, type: "Model", primary: true, cat: "checkpoints" }] }] }];
  await p.route("**/api/civitai/search*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: ITEMS, next: "" }) }));
  await p.route("**/api/civitai/download", (r) => { const bd = JSON.parse(r.request().postData() || "{}"); posted.dl.push(bd); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, download: { id: "e2e", status: "queued" } }) }); });
  await p.route("**/api/civitai/downloads", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await p.route("**/api/modelmgr/fetch", (r) => {
    if (r.request().method() !== "POST") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ running: false, done: 0, total: 0, found: 0, nomatch: 0, failed: 0, left: 0, log: [] }) });
    posted.fetch.push(JSON.parse(r.request().postData() || "{}"));
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, queued: 7, skipped: 3, status: { running: false, done: 0, total: 0, found: 0, nomatch: 0, failed: 0, left: 0, log: [] } }) });
  });
  const dlg = async () => ev(() => window.__fd || []);
  // wait until n downloads were posted (or n dialogs asked) - the first resolve reads the model folders, it can take a while
  const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 100)); } return false; };
  const dls = (n) => until(async () => posted.dl.length >= n);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ModelMgr && window.H3House && window.SecFloat && SecFloat.started && document.getElementById("mmBtn"), null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    // the folder dialog answers in the page: the next answer is window.__fdNext
    await ev(() => { window.__fd = []; window.FileDialog = window.FileDialog || {}; window.FileDialog.open = function (o) { window.__fd.push(o); return Promise.resolve(window.__fdNext ? { path: window.__fdNext } : null); }; });

    /* ---- 🧩 ⤓ into each type's folder */
    await p.click("#mmBtn");
    await ev(() => SecFloat.float("modelmgr", 300, 80, 900, 700));
    await p.click('[data-mmtab="civitai"]'); await p.waitForTimeout(300);
    await p.fill("#mmCvQ", "e2e538"); await p.click("#mmCvGo");
    await p.waitForFunction(() => document.querySelectorAll("#mmGrid .mmcard [data-cvget]").length === 2, null, { timeout: 15000 });
    check("every Civitai card has a ⤓ button", true);
    const A = '#mmGrid .mmcard[data-key="cv|5381"] [data-cvget]', B = '#mmGrid .mmcard[data-key="cv|5382"] [data-cvget]';
    // (the hover card of the card before sits beside it - over the next card - until the pointer has left for 260 ms)
    const hit = async (sel, shift) => { await p.mouse.move(5, 600); await p.waitForTimeout(450); await p.hover(sel.replace(" [data-cvget]", "")); await p.waitForTimeout(120); if (shift) await p.keyboard.down("Shift"); await p.click(sel); if (shift) await p.keyboard.up("Shift"); };
    const D1 = "/tmp/e2e538/SDXL loras", D2 = "/tmp/e2e538/SDXL loras 2", D3 = "/tmp/e2e538/Pony";
    await ev((d) => { window.__fdNext = d; }, D1);
    await hit(A); await dls(1) || await until(async () => posted.dl.length >= 1, 30000); await p.waitForTimeout(300);
    let fd = await dlg();
    check("⤓ the first time for an SDXL LoRA: the Select Folder dialog asks (mode dir, its type in the title)", fd.length === 1 && fd[0].mode === "dir" && /SDXL LoRAs/.test(fd[0].title) && fd[0].okLabel === "Select", fd);
    check("…then it downloads: the newest version's main file, into that type (folder key image/sdxl/lora)", posted.dl.length === 1 && posted.dl[0].version_id === 53810 && posted.dl[0].file_id === 1 && posted.dl[0].folder === "image/sdxl/lora", posted.dl);
    let mf = await api("/api/modelfolders");
    check("…and model_folders.json keeps it", (mf.folders || []).some((x) => x.key === "image/sdxl/lora" && x.dir === D1) && JSON.parse(fs.readFileSync(MFILE, "utf8")).folders["image/sdxl/lora"] === D1, mf.folders);
    await hit(A); await dls(2); await p.waitForTimeout(300);
    check("⤓ again (the folder is set): NO dialog - straight into its folder", (await dlg()).length === 1 && posted.dl.length === 2 && posted.dl[1].folder === "image/sdxl/lora", [await dlg(), posted.dl.length]);
    check("…the message says where it went", /SDXL loras/.test(await ev(() => document.getElementById("mmMsg").textContent)), await ev(() => document.getElementById("mmMsg").textContent));
    await ev((d) => { window.__fdNext = d; }, D2);
    await hit(A, true); await dls(3); await p.waitForTimeout(300);
    fd = await dlg(); mf = await api("/api/modelfolders");
    check("Shift+⤓: the dialog opens (starting at the folder it has) to change it - and it downloads there", fd.length === 2 && fd[1].start === D1 && posted.dl.length === 3 && (mf.folders || []).some((x) => x.key === "image/sdxl/lora" && x.dir === D2), [fd, mf.folders]);
    await ev(() => { window.__fdNext = ""; });
    await hit(B); await until(async () => (await dlg()).length >= 3); await p.waitForTimeout(400);
    fd = await dlg();
    check("⤓ a Pony checkpoint: its own type (Image · Pony models) asks for its own folder; Cancel = nothing downloaded", fd.length === 3 && /Pony models/.test(fd[2].title) && posted.dl.length === 3 && /not downloaded/.test(await ev(() => document.getElementById("mmMsg").textContent)), [fd.length, fd[2] && fd[2].title, posted.dl.length]);
    await ev((d) => { window.__fdNext = d; }, D3);
    await hit(B); await dls(4); await p.waitForTimeout(300);
    check("…picked: into image/pony/model", posted.dl.length === 4 && posted.dl[3].folder === "image/pony/model" && posted.dl[3].version_id === 53820, posted.dl[3]);
    // the versions view: an older version's ⤓ goes the same way (no dialog - the type has its folder)
    await p.click('#mmGrid .mmcard[data-key="cv|5381"] .nm'); await p.waitForTimeout(400);
    await p.click('[data-cvdl="53809"]'); await dls(5); await p.waitForTimeout(300);
    check("the versions view's ⤓ (v1): the type's folder, no dialog", (await dlg()).length === 4 && posted.dl.length === 5 && String(posted.dl[4].version_id) === "53809" && posted.dl[4].folder === "image/sdxl/lora", posted.dl[4]);
    // 📁
    await p.click("#mmFoldBtn"); await p.waitForTimeout(500);
    const rows = await ev(() => [...document.querySelectorAll("#mmFoldBox [data-mfkey]")].map((r) => r.dataset.mfkey + "=" + r.querySelector("code").textContent));
    check("📁 lists each type's folder (model_folders.json)", rows.length === 2 && rows.includes("image/pony/model=" + D3) && rows.includes("image/sdxl/lora=" + D2), rows);
    await p.click('#mmFoldBox [data-mfkey="image/pony/model"] [data-mfdel]'); await p.waitForTimeout(500);
    check("…✕ forgets one (the next ⤓ asks again)", (await ev(() => document.querySelectorAll("#mmFoldBox [data-mfkey]").length)) === 1 && !((await api("/api/modelfolders")).folders || []).some((x) => x.key === "image/pony/model"));
    await ev(() => { window.__fdNext = "/tmp/e2e538/Wan"; });
    await p.selectOption("#mfMain", "video"); await p.selectOption("#mfType", "wan"); await p.selectOption("#mfKind", "lora");
    await p.click("#mfAdd"); await p.waitForTimeout(600);
    check("…a folder for any type: Video · Wan LoRAs picked from the form", ((await api("/api/modelfolders")).folders || []).some((x) => x.key === "video/wan/lora" && x.dir === "/tmp/e2e538/Wan"));
    // 🔄 Sync
    await p.click("#mmSync"); await p.waitForTimeout(500);
    await p.keyboard.down("Shift"); await p.click("#mmSync"); await p.keyboard.up("Shift"); await p.waitForTimeout(500);
    check("🔄 Sync asks for EVERY model on this computer ({all, sync}); Shift = all of them again (force)", posted.fetch.length === 2 && posted.fetch[0].all === true && posted.fetch[0].sync === true && !posted.fetch[0].force && posted.fetch[1].force === true, posted.fetch);
    check("…it says how many", /syncing 7 models/.test(await ev(() => document.getElementById("mmMsg").textContent)));
    await ev(() => SecFloat.show("modelmgr", false));

    /* ---- 🏠 ◯ lights */
    await p.click("#hbBtn"); await p.waitForTimeout(800);
    await ev(() => SecFloat.float("house", 300, 70, 1100, 800)); await p.waitForTimeout(300);
    await ev(() => { const m = H3HouseGeo.example(); m.name = "E2E house 538"; m.lights = []; H3House.load(m); const S = H3House.state(); S.sel = null; S.zoom = 50; S.ox = 60; S.oy = 60; H3House.setView("plan"); });
    const at = async (x, y) => ev(([x, y]) => { const S = H3House.state(), r = document.getElementById("hbPlan").getBoundingClientRect(); return [r.left + x * S.zoom + S.ox, r.top + y * S.zoom + S.oy]; }, [x, y]);
    check("the toolbar has ◯ (Light)", await ev(() => !!document.querySelector('#hbBody .htools [data-tool="light"]') && document.querySelector('#hbBody .htools [data-tool="light"]').textContent.trim() === "◯"));
    await p.click('#hbBody .htools [data-tool="light"]');
    const c0 = [2, 2], a0 = await at(...c0), a1 = await at(5, 2);
    await p.mouse.move(a0[0], a0[1]); await p.mouse.down(); await p.mouse.move(a1[0], a1[1], { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
    const L1 = await ev(() => { const S = H3House.state(); return { lights: JSON.parse(JSON.stringify(S.m.lights)), sel: S.sel, side: document.getElementById("hbProps").textContent }; });
    check("press + drag: a light where it was pressed, reaching as far as the drag (3 m) - selected, the panel shows it", L1.lights.length === 1 && Math.abs(L1.lights[0].x - 2) < 0.06 && Math.abs(L1.lights[0].reach - 3) < 0.11 && L1.sel && L1.sel.kind === "light" && /Light/.test(L1.side) && /Reach/.test(L1.side), L1);
    const lit = await ev(() => { const b = H3HouseGeo.build(H3House.state().m); return b.lights.filter((L) => L.placed).length; });
    check("…the 3D build lights it (placed, always on)", lit === 1);
    await p.click('#hbBody .htools [data-tool="select"]');
    const hd = await ev(() => { const S = H3House.state(), o = S.m.lights[0]; S.sel = { kind: "light", id: o.id }; return H3House.handles("light", o); });
    check("⬚ a selected light has its ◦ reach handle on the circle", hd.length === 1 && hd[0].h === "reach", hd);
    const h0 = await at(hd[0].p[0], hd[0].p[1]), h1 = await at(c0[0] + 4.5, c0[1]);
    await p.mouse.move(h0[0], h0[1]); await p.mouse.down(); await p.mouse.move(h1[0], h1[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(250);
    const r2 = await ev(() => H3House.state().m.lights[0].reach);
    check("…dragging it sizes the reach (4.5 m)", Math.abs(r2 - 4.5) < 0.11, r2);
    const m0 = await at(2, 2), m1 = await at(3, 3);
    await p.mouse.move(m0[0], m0[1]); await p.mouse.down(); await p.mouse.move(m1[0], m1[1], { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(250);
    const mv = await ev(() => { const o = H3House.state().m.lights[0]; return [o.x, o.y]; });
    check("…dragging its centre moves it", Math.abs(mv[0] - 3) < 0.06 && Math.abs(mv[1] - 3) < 0.06, mv);
    await p.focus("#hbBody"); await p.keyboard.press("Delete"); await p.waitForTimeout(200);
    check("…Delete removes it (Ctrl+Z brings it back)", (await ev(() => H3House.state().m.lights.length)) === 0);
    await p.keyboard.press("Control+z"); await p.waitForTimeout(200);
    check("…Ctrl+Z", (await ev(() => H3House.state().m.lights.length)) === 1);
    await ev(() => SecFloat.show("house", false));

    /* ---- ⛶ maximize between the side dockers */
    const cls0 = await ev(() => document.getElementById("app").className);
    await ev(() => { const a = document.getElementById("app"); ["no-left", "no-refs", "no-assets", "no-queue", "no-right"].forEach((c) => a.classList.remove(c)); window.dispatchEvent(new Event("resize")); });
    await p.waitForTimeout(500);
    await ev(() => { SecFloat.show("testdock", true); SecFloat.float("testdock", 500, 200, 420, 500); });
    await p.waitForTimeout(300);
    const cols = await ev(() => ["ldock", "refsdock", "assetsdock", "qdock", "rdock"].map((id) => { const el = document.getElementById(id); if (!el) return null; const r = el.getBoundingClientRect(); return { id, l: r.left, r: r.right, w: r.width, h: r.height }; }).filter((c) => c && c.w > 4 && c.h > 300));
    await p.click("#sf-testdock .sfmax"); await p.waitForTimeout(400);
    const mx = await ev(() => { const r = document.getElementById("sf-testdock").getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width }; });
    const clear = cols.every((c) => mx.r <= c.l + 1.5 || mx.l >= c.r - 1.5);
    check(`⛶ with ${cols.map((c) => c.id).join(", ")} open: it fills the room BETWEEN them, covering none`, cols.length >= 1 && clear && mx.w >= 320, { mx, cols });
    const right = cols.filter((c) => (c.l + c.r) / 2 > 900).sort((a, b) => a.l - b.l)[0];
    if (right) check("…its right edge is the first right-hand docker's left edge (" + right.id + ")", Math.abs(mx.r - right.l) < 2, { mx, right });
    await p.click("#sf-testdock .sfmax"); await p.waitForTimeout(300);
    await ev(() => { document.getElementById("app").classList.add("no-right", "no-queue", "no-assets", "no-refs"); window.dispatchEvent(new Event("resize")); });
    await p.waitForTimeout(500);
    await p.click("#sf-testdock .sfmax"); await p.waitForTimeout(400);
    const mx2 = await ev(() => { const r = document.getElementById("sf-testdock").getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width, vw: innerWidth }; });
    check("…the right-hand dockers closed: it reaches the window's right edge", Math.abs(mx2.r - mx2.vw) < 2 && mx2.w > mx.w, { mx2, mx });
    await p.click("#sf-testdock .sfmax"); await p.waitForTimeout(200);
    await ev(() => SecFloat.show("testdock", false));
    await ev((c) => { document.getElementById("app").className = c; window.dispatchEvent(new Event("resize")); }, cls0);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("crashed: " + (e.stack || e), false); }
  finally {
    try { await b.close(); } catch { /* fine */ }
    if (had == null) { try { fs.rmSync(MFILE); } catch { /* fine */ } } else fs.writeFileSync(MFILE, had);
    await api("/api/testplan/mode", { on: mode0 }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
