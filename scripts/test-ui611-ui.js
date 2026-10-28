#!/usr/bin/env node
/* bitGen Studio — 2.611.0 in a REAL browser: ▯ FRAME - click a frame on a layer to select it, Del removes it.
 * Tim: "can we add a click frame to select frame and del button deletes it".
 *   the ▯ button beside the edit tools + F over the layers; a click on a clip selects the ONE frame under the pointer on
 *   that layer (marker there, the frame outlined on its row, the clip NOT moved); Del cuts it out of that layer and the
 *   rest moves up (ripple on even with the box off - the box left as it was); ↶ puts it back; a drag = several frames;
 *   Shift+click = from the selected frame; Esc drops it; ▸ Select still drags clips; the gallery's Del untouched.
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.611.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const P = "zz_frame_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2200, height: 1300 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.TlFrame && window.TlEdit && document.getElementById("tlEdit_frame") && document.getElementById("tlUndo"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      if (typeof setVar === "function") setVar("th", 700);
      tl.video = [{ name: "base.mp4", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1 }];
      tl.audio = []; tl.images = [];
      tl.vlayers = [mkLayer("Shots", [{ name: "a.mp4", src: "video", in: 0, out: 2, dur: 5, start: 0, opacity: 1 }, { name: "b.mp4", src: "video", in: 0, out: 2, dur: 5, start: 2, opacity: 1 }])];
      tl.sel = null; tlSave(); renderTimeline();
      document.getElementById("tlRipple").checked = false;
      const z = document.getElementById("tlZoom"); z.value = "100"; z.dispatchEvent(new Event("input")); z.dispatchEvent(new Event("change"));
    });
    await p.waitForTimeout(500);
    const at = (lk, t) => ev(([lk, t]) => {
      const tr = document.querySelector('.tltrack[data-lk="' + lk + '"]'); tr.scrollIntoView({ block: "center", inline: "nearest" });
      const sc = document.getElementById("tlscroll"); const inner = document.getElementById("tlinner").getBoundingClientRect(), r = tr.getBoundingClientRect();
      const x = inner.left + LABW + t * PXS; if (x > sc.getBoundingClientRect().right - 20) sc.scrollLeft += x - sc.getBoundingClientRect().right + 200;
      const i2 = document.getElementById("tlinner").getBoundingClientRect();
      return { x: i2.left + LABW + t * PXS, y: r.top + r.height / 2 };
    }, [lk, t]);
    const F = await ev(() => TLFPS);

    /* the tool */
    const bar = await ev(() => { const b = document.getElementById("tlEdit_frame"); return { txt: b.textContent, title: b.title, keys: (window.TlKeys && TlKeys.KEYS || []).map((k) => k[0]) }; });
    check("▯ Frame is an edit tool beside ▸ ⇤ ⇹ ⇆ ↔ (its tip says click / Del / Ctrl+Z), and F + Del are in the shortcut list",
      bar.txt === "▯" && /click a frame/.test(bar.title) && /Del removes/.test(bar.title) && bar.keys.includes("F") && bar.keys.includes("Del / ⌫"), bar);
    let pt = await at("vl:0", 1);
    await p.mouse.move(pt.x, pt.y); await p.keyboard.press("f"); await p.waitForTimeout(150);
    check("F over the layers turns it on (the button lit, the tracks' cursor a cell)", await ev(() => TlEdit.mode() === "frame" && document.getElementById("tlEdit_frame").classList.contains("on") && document.getElementById("tlinner").dataset.edit === "frame"));

    /* click a frame */
    const t1 = 2.5 + 0.4 / F;        // inside frame round(2.5*F) of the second clip
    pt = await at("vl:0", t1);
    await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(350);
    const s1 = await ev(() => ({ sel: tl.sel, lk: tl.selLayer, ph: playhead, b: tl.vlayers[0].clips[1].start, band: (document.querySelector('.tltrack[data-lk="vl:0"] .tlrsel .lab') || {}).textContent || "", log: (document.getElementById("sblog") || {}).textContent }));
    const f1 = Math.round(2.5 * F);
    check("a click on a clip selects the ONE frame under the pointer on that layer; the marker jumps to it; the clip did not move; the row says which frame",
      s1.sel && s1.sel.frame && s1.lk === "vl:0" && Math.abs(s1.sel.a - f1 / F) < 1e-6 && Math.abs(s1.sel.b - (f1 + 1) / F) < 1e-6 && Math.abs(s1.ph - f1 / F) < 1e-3 && s1.b === 2 && s1.band.includes("▯ frame " + f1) && /Del removes/.test(s1.log), s1);

    /* Del */
    await p.mouse.move(pt.x, pt.y + 2); await p.keyboard.press("Delete"); await p.waitForTimeout(700);
    const s2 = await ev(() => ({ clips: tl.vlayers[0].clips.map((c) => [c.start, c.in, c.out]).sort((a, b) => a[0] - b[0]), v1: tl.video.map((c) => [c.start, c.in, c.out]), sel: tl.sel, ripple: document.getElementById("tlRipple").checked }));
    const tot = s2.clips.reduce((s, c) => s + (c[2] - c[1]), 0);
    check("Del cuts that frame out of THAT layer only and the rest moves up (ripple even with the box off - the box left off); the selection is gone",
      Math.abs(tot - (4 - 1 / F)) < 1e-4 && Math.abs(Math.max(...s2.clips.map((c) => c[0] + c[2] - c[1])) - (4 - 1 / F)) < 1e-4 && JSON.stringify(s2.v1) === JSON.stringify([[0, 0, 4]]) && !s2.sel && s2.ripple === false, s2);
    await p.click("#tlUndo"); await p.waitForTimeout(400);
    const s3 = await ev(() => tl.vlayers[0].clips.map((c) => [c.start, c.in, c.out]));
    check("↶ puts the frame back (one step)", JSON.stringify(s3) === JSON.stringify([[0, 0, 2], [2, 0, 2]]), s3);

    /* drag = several; Shift+click = up to here */
    await ev(() => renderTimeline()); await p.waitForTimeout(200);
    const pa = await at("vl:0", 0.5 + 0.4 / F), pb = await at("vl:0", 0.5 + 4.4 / F);
    await p.mouse.move(pa.x, pa.y); await p.mouse.down(); await p.mouse.move((pa.x + pb.x) / 2, pa.y, { steps: 3 }); await p.mouse.move(pb.x, pb.y, { steps: 3 }); await p.mouse.up(); await p.waitForTimeout(350);
    const s4 = await ev(() => ({ sel: tl.sel, starts: tl.vlayers[0].clips.map((c) => c.start), band: (document.querySelector('.tltrack[data-lk="vl:0"] .tlrsel .lab') || {}).textContent || "" }));
    const fa = Math.round(0.5 * F);
    check("a drag across selects several frames (5) - no clip moved", s4.sel && s4.sel.frame && Math.round(s4.sel.a * F) === fa && Math.round((s4.sel.b - s4.sel.a) * F) === 5 && JSON.stringify(s4.starts) === "[0,2]" && s4.band.includes("(5)"), s4);
    const pc = await at("vl:0", 0.5 + 9.4 / F);
    await p.keyboard.down("Shift"); await p.mouse.click(pc.x, pc.y); await p.keyboard.up("Shift"); await p.waitForTimeout(350);
    const s5 = await ev(() => tl.sel);
    check("Shift+click: from the selected frame to this one (10 frames)", s5 && s5.frame && Math.round(s5.a * F) === fa && Math.round((s5.b - s5.a) * F) === 10, s5);
    await p.mouse.move(pc.x, pc.y + 2); await p.keyboard.press("Backspace"); await p.waitForTimeout(700);
    const s6 = await ev(() => tl.vlayers[0].clips.map((c) => [c.start, c.in, c.out]).sort((a, b) => a[0] - b[0]));
    check("⌫ removes them too: 10 frames out of the first clip (it splits around the hole), the second clip 10 frames earlier", s6.length === 3 && Math.abs(s6[2][0] - (2 - 10 / F)) < 1e-4 && Math.abs(s6.reduce((s, c) => s + c[2] - c[1], 0) - (4 - 10 / F)) < 1e-4, s6);
    await p.click("#tlUndo"); await p.waitForTimeout(300);

    /* ← / → at any zoom */
    await ev(() => { const z = document.getElementById("tlZoom"); z.value = "0"; z.dispatchEvent(new Event("input")); z.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(300);
    const pz = await at("vl:0", 1.02);
    await p.mouse.click(pz.x, pz.y); await p.waitForTimeout(300);
    const z0 = await ev(() => ({ f: Math.round(tl.sel.a * TLFPS), n: Math.round((tl.sel.b - tl.sel.a) * TLFPS), pxf: PXS / TLFPS, log: document.getElementById("sblog").textContent }));
    await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("Shift+ArrowRight"); await p.waitForTimeout(300);
    const z1 = await ev(() => ({ f: Math.round(tl.sel.a * TLFPS), n: Math.round((tl.sel.b - tl.sel.a) * TLFPS), ph: Math.round(playhead * TLFPS), starts: tl.vlayers[0].clips.map((c) => c.start) }));
    check("zoomed out (a frame under a pixel - the status line says zoom in): → moves the selected frame one on, Shift+→ grows it; no clip nudged",
      z0.pxf < 3 && /zoom in/.test(z0.log) && z0.n === 1 && z1.f === z0.f + 2 && z1.n === 2 && z1.ph === z1.f && JSON.stringify(z1.starts) === "[0,2]", { z0, z1 });
    await ev(() => { const z = document.getElementById("tlZoom"); z.value = "100"; z.dispatchEvent(new Event("input")); z.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(300);

    /* V1 too; Esc */
    pt = await at("v1", 1 + 0.4 / F);
    await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(300);
    const s7 = await ev(() => ({ lk: tl.selLayer, f: tl.sel && tl.sel.frame }));
    await p.keyboard.press("Escape"); await p.waitForTimeout(250);
    const s8 = await ev(() => ({ sel: tl.sel, n: document.querySelectorAll(".tlrsel").length, v1: tl.video.length }));
    check("on V1 too; Esc drops the selection (nothing removed)", s7.lk === "v1" && s7.f && !s8.sel && s8.n === 0 && s8.v1 === 1, { s7, s8 });

    /* ▸ Select is as before */
    await p.click("#tlEdit_select"); await p.waitForTimeout(150);
    pt = await at("vl:0", 2.6);
    const hit = await ev(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.className + "|" + (e.closest(".clip") ? "clip" : "") : null; }, [pt.x, pt.y]);
    await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await p.mouse.move(pt.x + 60, pt.y, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(400);
    const s9 = await ev(() => ({ sel: tl.sel, starts: tl.vlayers[0].clips.map((c) => c.start) }));
    await p.keyboard.press("Delete"); await p.waitForTimeout(300);
    check("▸ Select: a drag still moves the clip, no frame selected - and Del with no frame selection takes nothing", !(s9.sel && s9.sel.frame) && s9.starts[1] > 2.05 && await ev(() => tl.vlayers[0].clips.length === 2), { s9, hit });

    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/projects/delete", { name: P }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
