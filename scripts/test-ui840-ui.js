#!/usr/bin/env node
/* bitGen Studio — 2.840.0 in a REAL browser: a .docx opened with its pictures (each a figure layer at its place in the
 * text), and a WP frame's edge dragged = its margin (one undo; Layer ▸ 📏 WP Margins… typed in mm).
 * Tim: "Bring in the pictures when opening a .docx., allow user to resize wp frame to change it's margins".
 *   Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path"), zlib = require("zlib");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
function png(w, h) {
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w * 3 + 1) + 1 + x * 3] = 220;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
(async () => {
  const D = require(path.join(__dirname, "..", "node_modules", "docx"));
  const docx = Buffer.from(await D.Packer.toBuffer(new D.Document({ sections: [{ children: [new D.Paragraph("A document with a picture."),
    new D.Paragraph({ children: [new D.ImageRun({ type: "png", data: png(400, 200), transformation: { width: 400, height: 200 }, altText: { name: "red", description: "Figure 1: red", title: "Figure 1: red" } })] }), new D.Paragraph("After it.")] }] }))).toString("base64");
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.docMargins && window.imageEditorInstance.E.docx, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { if (d.style.display !== "none") d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:60px;width:1600px;height:900px;z-index:9999"; });
    await p.waitForTimeout(400);
    // a .docx opened: its picture comes along
    await ev(async (b64) => { const E = window.imageEditorInstance.E, bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); const o = await E.docx.openBytes(bin.buffer, "pic.docx"); E.docx.place(o, { size: "A4", orient: "portrait", margin: 25 }); }, docx);
    await p.waitForTimeout(1200);
    const o1 = await ev(() => { const E = window.imageEditorInstance.E, W = E.S.layers.find((x) => x.type === "doc"), N = E.S.layers.find((x) => x.anchor && x.anchor.flow === W.doc.flow.id);
      const b = N && N.anchor.box, P = (x, y) => Array.from(N.canvas.getContext("2d").getImageData(x, y, 1, 1).data);
      return { html: W.doc.html, name: N && N.name, box: b, mid: b && P(b.x + (b.w >> 1), b.y + (b.h >> 1)), fr: { x: W.doc.x, y: W.doc.y, w: W.doc.w } }; });
    check("a .docx opened: its picture is a layer at its place in the text (after the first line, centred at its own width, its alt text the caption), drawn there",
      /A document with a picture\.<\/p><p data-fig="dx[^"]+-0" style="[^"]*"><i>Figure 1: red<\/i><\/p><p>After it\.<\/p>/.test(o1.html) && o1.box && o1.box.y > o1.fr.y && o1.box.x > o1.fr.x && o1.mid[0] > 200 && o1.mid[3] === 255, o1);
    // a WP frame's edge dragged = its margin
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 1000; c.height = 1400; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 1000, 1400); window.imageEditorInstance.load(c.toDataURL("image/png"), "m840"); setTimeout(() => { window.imageEditorInstance.E.fitView(); ok(); }, 800); }));
    await ev(() => { const E = window.imageEditorInstance.E; const A = E.docText.addFrame(100, 100, 800, 1000, {}, false); E.docText.end(); A.doc.html = E.docText.sanitize("<p>" + "Words in the frame. ".repeat(60) + "</p>"); E.docText.reflow(A.doc.flow.id); E.setTool("move"); window.__A = A; });
    const sp = (x, y) => ev(([x, y]) => { const E = window.imageEditorInstance.E, r = E.stage.getBoundingClientRect(); return [r.left + E.S.panX + x * E.S.zoom, r.top + E.S.panY + y * E.S.zoom]; }, [x, y]);
    const a = await sp(100, 600), z = await ev(() => window.imageEditorInstance.E.S.zoom);
    await p.mouse.move(a[0] + 20, a[1]); await p.mouse.move(a[0], a[1], { steps: 2 });
    const cur = await ev(() => window.imageEditorInstance.E.stage.style.cursor);
    await p.mouse.down(); await p.mouse.move(a[0] + 50 * z, a[1], { steps: 4 });
    const mid = await ev(() => ({ dragging: window.imageEditorInstance.E.docMargins.dragging(), x: window.__A.doc.x }));
    await p.mouse.move(a[0] + 100 * z, a[1] + 3, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(400);
    const m1 = await ev(() => { const d = window.__A.doc; return { x: d.x, y: d.y, w: d.w, h: d.h, lines: d.lines }; });
    check("the pointer on the frame's left edge shows a resize arrow; dragging it moves that margin (the right edge stays), the text flowing again",
      cur === "ew-resize" && mid.dragging && Math.abs(m1.x - 200) <= 2 && Math.abs(m1.x + m1.w - 900) <= 1 && m1.y === 100 && m1.h === 1000, { cur, mid, m1 });
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(200);
    const m2 = await ev(() => ({ x: window.__A.doc.x, w: window.__A.doc.w }));
    check("…one Ctrl+Z puts the margin back", m2.x === 100 && m2.w === 800, m2);
    // the bottom edge
    const bt = await sp(500, 1100);
    await p.mouse.move(bt[0], bt[1] - 20); await p.mouse.move(bt[0], bt[1], { steps: 2 }); await p.mouse.down(); await p.mouse.move(bt[0], bt[1] - 150 * z, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
    const m3 = await ev(() => ({ y: window.__A.doc.y, h: window.__A.doc.h }));
    check("…the bottom edge dragged up: a bigger bottom margin", m3.y === 100 && Math.abs(m3.h - 850) <= 2, m3);
    // typed in mm
    const dl = await ev(() => { const E = window.imageEditorInstance.E; E.setActive(E.S.layers.indexOf(window.__A)); E.ui.run("layer.docmargins"); const d = document.querySelector(".kxdlg.pcd"); const r = { title: d && d.querySelector("h4").textContent };
      d.querySelector("#pdm_top").value = 10; d.querySelector("#pdm_bottom").value = 10; d.querySelector("#pdm_left").value = 30; d.querySelector("#pdm_right").value = 15; d.querySelector(".ok").click();
      const a = window.__A.doc; return Object.assign(r, { x: a.x, y: a.y, w: a.w, h: a.h, k: a.k }); });
    const k = dl.k * 96 / 25.4;
    check("Layer ▸ 📏 WP Margins… typed in mm: the frame is the page less them", dl.title === "📏 WP Margins" && Math.abs(dl.x - 30 * k) <= 1 && Math.abs(dl.y - 10 * k) <= 1 && Math.abs(dl.x + dl.w - (1000 - 15 * k)) <= 1 && Math.abs(dl.y + dl.h - (1400 - 10 * k)) <= 1, dl);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
