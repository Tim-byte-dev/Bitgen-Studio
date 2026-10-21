#!/usr/bin/env node
/* bitGen Studio — 2.571.0 in a REAL browser: several clips selected (Shift = a range, Ctrl = add / take away) in the
 * Gallery, the Assets dock and the References tray, dragged onto the timeline - oldest first, each on its own layer, one
 * after the other; ⛓ Sequential keeps them so after a delete and when a layer with a clip is put in.
 * Against the running e2e app (H3_URL, default :8311): a project of its own with three videos (dated out of name order),
 * two pictures and two reference pictures. The drags are DragEvents with a real DataTransfer. No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the multi-select browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const BASE = URL_.replace(/\/$/, "");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, b) => { const r = await fetch(BASE + u, b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined); return r.json().catch(() => ({})); };

(async () => {
  const PRJ = "zz-msel571";
  let before = null;
  try { before = (await api("/api/projects/current")).name || null; } catch { before = null; }
  await api("/api/projects/new", { name: PRJ }); await api("/api/projects/load", { name: PRJ });
  const pd = path.join(ROOT, "projects", PRJ), out = path.join(pd, "output"), img = path.join(pd, "images");
  fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(img, { recursive: true });
  // three videos: "a_new" newest, "b_mid", "c_old" oldest - 3 s, 2 s, 1 s
  const now = Date.now() / 1000;
  for (const [n, d, age, col] of [["a_new", 3, 100, "red"], ["b_mid", 2, 2000, "green"], ["c_old", 1, 9000, "blue"]]) {
    const f = path.join(out, n + ".mp4");
    spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=${col}:s=160x90:d=${d}`, "-pix_fmt", "yuv420p", f]);
    fs.utimesSync(f, now - age, now - age);
  }
  for (const [n, age] of [["p_new.png", 50], ["q_old.png", 5000]]) { fs.copyFileSync(path.join(ROOT, "static", "pose-sheets", "dog.png"), path.join(img, n)); fs.utimesSync(path.join(img, n), now - age, now - age); }

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  // a drag with a real DataTransfer: dragstart on the source, drop on the target at (x, y), dragend
  const dnd = (srcSel, dstSel, dx) => ev(async ([srcSel, dstSel, dx]) => {
    const src = document.querySelector(srcSel), dst = document.querySelector(dstSel); if (!src || !dst) return "missing " + (!src ? srcSel : dstSel);
    const dt = new DataTransfer(), r = dst.getBoundingClientRect();
    src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
    const types = [...dt.types];
    const x = r.left + (typeof dx === "number" ? dx : r.width / 2), y = r.top + Math.min(40, r.height / 2);
    dst.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    dst.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
    return types.join();
  }, [srcSel, dstSel, dx]);
  const snap = () => ev(() => ({ v1: tl.video.map((c) => [c.name, Math.round(c.start * 100) / 100]), vl: tl.vlayers.map((L) => L.clips.map((c) => [c.name, Math.round(c.start * 100) / 100])), im: tl.images.map((L) => L.clips.map((c) => [c.name, Math.round(c.start * 100) / 100])), seq: !!tl.seqAuto }));   // eslint-disable-line no-undef
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Multi && window.H3TlSeq && document.getElementById("tlSeqBtn"), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => { tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tl.seqAuto = false; tlSave(); renderTimeline(); refreshGallery(); refreshAssets(); });   // eslint-disable-line no-undef
    await p.waitForFunction(() => document.querySelectorAll('#gallery .thumb[data-name$=".mp4"]').length >= 3 && document.querySelectorAll('#assetsdock .aitem[data-agkind="images"]').length >= 2, null, { timeout: 20000 }).catch(() => {});

    const g0 = await ev(() => { const g = document.getElementById("gallery"); return { tab: g && g.dataset.gtab, n: g ? g.querySelectorAll(".thumb").length : -1, names: g ? [...g.querySelectorAll(".thumb")].map((t) => t.dataset.name).slice(0, 6) : [], shown: !!(g && g.offsetParent) }; });
    if (!g0.names.some((n) => /a_new/.test(n))) console.log("NOTE: the gallery: " + JSON.stringify(g0));
    /* 1 the gallery: click, Shift + click, Ctrl + click */
    const tile = (n) => `#gallery .thumb[data-name="${n}.mp4"]`;
    const order = await ev(() => [...document.querySelectorAll('#gallery .thumb[data-name$=".mp4"]')].map((t) => t.dataset.name));
    const first = order[0], last = order[order.length - 1];
    await p.click(`#gallery .thumb[data-name="${first}"] .gname`, { force: true, modifiers: ["Control"] });   // (a plain click opens the lightbox, as before)
    await p.click(`#gallery .thumb[data-name="${last}"] .gname`, { force: true, modifiers: ["Shift"] });
    const s1 = await ev(() => [...document.querySelectorAll("#gallery .thumb.sel")].map((t) => t.dataset.name));
    await p.click(tile("b_mid") + " .gname", { force: true, modifiers: ["Control"] });
    const s2 = await ev(() => [...document.querySelectorAll("#gallery .thumb.sel")].map((t) => t.dataset.name));
    await p.click(tile("b_mid") + " .gname", { force: true, modifiers: ["Control"] });
    const s3 = await ev(() => [...document.querySelectorAll("#gallery .thumb.sel")].map((t) => t.dataset.name).sort());
    check("Gallery: Ctrl-click + Shift-click = the range (all three); Ctrl-click takes one away and puts it back", s1.length === 3 && s2.length === 2 && !s2.includes("b_mid.mp4") && s3.join() === "a_new.mp4,b_mid.mp4,c_old.mp4", { order, s1, s2, s3 });

    /* 2 dragged onto the timeline: oldest first, each its own layer, one after the other from the drop */
    const sec2x = await ev(() => LABW + 2 * PXS);   // eslint-disable-line no-undef
    const types = await dnd(tile("a_new"), "#tlinner", sec2x);
    await p.waitForFunction(() => tl.video.length + tl.vlayers.length >= 3, null, { timeout: 15000 }).catch(() => {});   // eslint-disable-line no-undef
    const t1 = await snap();
    check("dragging one of the selected drags all three (text/h3multi): the OLDEST on the top row (V1), the newest at the bottom, one after the other from where they were dropped (2 s)",
      /text\/h3multi/.test(types) && t1.v1.length === 1 && t1.v1[0][0] === "c_old.mp4" && Math.abs(t1.v1[0][1] - 2) <= 0.15 && t1.vl.length === 2 && t1.vl[0][0][0] === "b_mid.mp4" && Math.abs(t1.vl[0][0][1] - t1.v1[0][1] - 1) < 0.02
      && t1.vl[1][0][0] === "a_new.mp4" && Math.abs(t1.vl[1][0][1] - t1.vl[0][0][1] - 2) < 0.02, { types, t1 });
    const rowsDom = await ev(() => [...document.querySelectorAll("#tlinner [data-lk]")].map((r) => r.dataset.lk).filter((k) => /^(v1|vl:)/.test(k)));
    check("...on screen: V1, then V2, then V3 down the timeline", rowsDom.slice(0, 3).join() === "v1,vl:0,vl:1", rowsDom);

    /* 3 ⛓ Sequential: arranged from 0; a delete closes up; a layer put in makes room */
    await p.click("#tlSeqBtn");
    await p.waitForTimeout(300);
    const t2 = await snap();
    const on = await ev(() => document.getElementById("tlSeqBtn").classList.contains("on"));
    check("⛓ Sequential: on - everything one after the other from 0 with no gap (1 s, 2 s, 3 s: 0, 1, 3), kept with the timeline", on && t2.seq && t2.v1[0][1] === 0 && t2.vl[0][0][1] === 1 && t2.vl[1][0][1] === 3, t2);
    await ev(() => { const L = document.querySelector('#tlinner [data-lk="vl:0"]'), c = L && L.querySelector(".clip .cx"); if (c) c.click(); });
    await p.waitForTimeout(300);
    const t3 = await snap();
    check("a clip deleted (V2's): the one below closes up straight after V1", t3.vl.length === 1 && t3.vl[0][0][0] === "a_new.mp4" && t3.vl[0][0][1] === 1, t3);
    await ev(() => { tl.vlayers.unshift(mkLayer("V9", [{ name: "b_mid.mp4", dur: 2, in: 0, out: 2, opacity: 1, start: 40, src: "output" }])); tlSave(); renderTimeline(); });   // eslint-disable-line no-undef
    await p.waitForTimeout(300);
    const t4 = await snap();
    check("a layer put in above it with a clip: that clip takes its place in the order, the one below moves on", t4.vl[0][0][0] === "b_mid.mp4" && t4.vl[0][0][1] === 1 && t4.vl[1][0][1] === 3, t4);
    await ev(() => { const c = tl.vlayers[1].clips[0]; c.out = 1.5; tlSave(); renderTimeline(); });   // eslint-disable-line no-undef
    const t4b = await snap();
    await ev(() => { tl.vlayers[0].clips[0].out = 1; tlSave(); renderTimeline(); });   // eslint-disable-line no-undef
    const t4c = await snap();
    check("...a clip trimmed shorter: the ones below follow it at once", t4b.vl[1][0][1] === 3 && t4c.vl[1][0][1] === 2, { t4b, t4c });

    /* 4 the Assets dock: its own selection (Ctrl), dropped on the preview canvas = at the playhead */
    const ph = await ev(() => { if (window.TlCanvas && TlCanvas.go) TlCanvas.go(10); return window.TlCanvas && TlCanvas.state ? Math.round(TlCanvas.state.t * 24) / 24 : 0; });
    const ak = await ev(() => [...document.querySelectorAll('#assetsdock .aitem[data-agkind="images"]')].map((t) => t.dataset.agname));
    for (const n of ["p_new.png", "q_old.png"]) await p.click(`#assetsdock .aitem[data-agkind="images"][data-agname="${n}"] img`, { force: true, modifiers: ["Control"] });
    const asel = await ev(() => window.AssetGroups && AssetGroups.state.sel ? AssetGroups.state.sel.size : -1);
    await ev(() => { tl.seqAuto = false; tlSave(); });   // eslint-disable-line no-undef
    const types2 = await dnd('#assetsdock .aitem[data-agkind="images"][data-agname="p_new.png"]', "#tlCanvasWrap");
    await p.waitForFunction(() => tl.images.length >= 2, null, { timeout: 15000 }).catch(() => {});   // eslint-disable-line no-undef
    const t5 = await snap();
    check("Assets: Ctrl-click picks two pictures; dragged onto the preview canvas: the older one first, each on its own picture layer, one after the other at the playhead",
      asel === 2 && /h3multi/.test(types2) && t5.im.length === 2 && t5.im[0][0][0] === "q_old.png" && Math.abs(t5.im[0][0][1] - ph) < 0.05 && t5.im[1][0][0] === "p_new.png" && Math.abs(t5.im[1][0][1] - ph - 3) < 0.05, { ph, ak, asel, types2, t5 });

    /* 5 the References tray */
    const rr = await ev(async () => {
      const mk = (col, t) => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 32; c.height = 32; const g = c.getContext("2d"); g.fillStyle = col; g.fillRect(0, 0, 32, 32); c.toBlob((bl) => ok(new File([bl], col + ".png", { type: "image/png", lastModified: t })), "image/png"); });
      const f1 = await mk("orange", Date.now() - 1000), f2 = await mk("purple", Date.now() - 900000);
      for (const f of [f1, f2]) refs.push({ file: f, url: URL.createObjectURL(f), subject: 1, role: "person", roleOther: "" });   // eslint-disable-line no-undef
      renderTray();   // eslint-disable-line no-undef
      return document.querySelectorAll("#tray .slot").length;
    });
    const n0 = rr;
    // (the References dock may be folded away - the clicks dispatched on the pictures, Ctrl held)
    const md = await ev(() => mode);   // eslint-disable-line no-undef
    if (n0 < 2) console.log("NOTE: the tray has " + n0 + " slot(s) in mode " + md);
    const nr = await ev(() => refs.length);   // eslint-disable-line no-undef
    await ev((nr) => { const S = document.querySelectorAll("#tray .slot"); for (const k of [nr - 2, nr - 1]) S[k].querySelector("img").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true })); }, nr);
    const rsel = await ev(() => document.querySelectorAll("#tray .slot.rsel").length);
    const im0 = await ev(() => tl.images.length);   // eslint-disable-line no-undef
    await ev((nr) => { document.querySelectorAll("#tray .slot")[nr - 1].id = "zzSlot571"; }, nr);
    const types3 = await dnd("#zzSlot571", "#tlinner", sec2x);
    await p.waitForFunction((n) => tl.images.length >= n + 2, im0, { timeout: 15000 }).catch(() => {});   // eslint-disable-line no-undef
    const t6 = await snap();
    check("References: Ctrl-click picks two pictures in the tray (no lightbox); dragged onto the timeline they are uploaded and laid down oldest first, one after the other",
      rsel === 2 && /h3multi/.test(types3) && t6.im.length === im0 + 2 && Math.abs(t6.im[im0][0][1] - 2) <= 0.15 && Math.abs(t6.im[im0 + 1][0][1] - t6.im[im0][0][1] - 3) < 0.02 && !(await ev(() => !!document.querySelector("dialog[open]"))), { rsel, types3, t6: t6.im });
    /* 6 a single drag stays single */
    await ev(() => { const d = document.querySelector("dialog[open]"); if (d) d.close(); });
    await p.click(tile("a_new") + " .gname", { force: true });
    await p.keyboard.press("Escape"); await ev(() => { const d = document.querySelector("dialog[open]"); if (d) d.close(); });
    const types4 = await dnd(tile("a_new"), "#tlinner", sec2x);
    check("a plain click then a drag = just that clip, as before (no multi)", !/h3multi/.test(types4) && /h3clip/.test(types4) && !(await ev(() => H3Multi.has())), types4);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { await ev(() => { tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tl.seqAuto = false; tlSave(); renderTimeline(); }); } catch (e) { /* gone */ }   // eslint-disable-line no-undef
    await b.close();
    try { await api("/api/projects/load", { name: before && before !== PRJ ? before : "default" }); } catch { /* fine */ }   // (never leave a deleted project current)
    try { fs.rmSync(pd, { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
