#!/usr/bin/env node
/* bitGen Studio — 2.874.0 in a REAL browser: the 🪪 Character sheet tab - ＋ Upload a character sheet… puts your sheet in the
 * library and picks it as the Template (drawn as the layout, the Layout guide ticked + locked, its name said); ▶ Generate sheet
 * sends it; ＋ Add your own mannequin… adds yours to 🧍 Mannequin… (Your mannequins) and opens it in the sheet's canvas; a
 * template / mannequin deleted from the library leaves the lists. The sheet render is answered by the test. (H3_URL)
 * 2.934.0: your mannequin is the REFERENCE sheet (in place of the template, drawn in the Layout box, sent as
 * "mannequin:own:<id>"), never the start picture - the character is a picture loaded separately. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os"), zlib = require("zlib");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
function png(w, h) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  const raw = Buffer.alloc((w + 1) * h, 150); for (let y = 0; y < h; y++) raw[y * (w + 1)] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui874-"));
  fs.writeFileSync(path.join(dir, "studio sheet.png"), png(1600, 800));
  fs.writeFileSync(path.join(dir, "wooden doll.png"), png(400, 1000));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const sheets = [];
  await p.route("**/api/charsheet/h3", async (route) => {
    if (route.request().method() === "GET") { const r = await route.fetch(); const j = await r.json(); j.installed = true; return route.fulfill({ json: j }); }
    sheets.push(route.request().postDataBuffer().toString("latin1")); route.fulfill({ json: { id: "fake874", status: "queued", input: "x.png", refs: ["", "", ""], summary: "4 views" } });
  });
  await p.route("**/api/charsheet/h3/preview", (route) => route.fulfill({ json: { offline: true, summary: "" } }));
  await p.route("**/api/jobs/fake874", (route) => route.fulfill({ json: { id: "fake874", status: "queued" } }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SheetDesign && document.getElementById("chNewPic"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await ev(() => { localStorage.removeItem("h3sheet.v1"); document.getElementById("chNewPic").click(); });
    await p.waitForFunction(() => document.getElementById("h3sTpl") && document.getElementById("h3sMannequin"), null, { timeout: 15000 });
    await ev(() => window.H3SheetDesign.refresh());
    await p.waitForTimeout(500);
    const v0 = await ev(() => ({ t: [...document.getElementById("h3sTpl").options].map((o) => o.textContent), m: [...document.getElementById("h3sMannequin").options].map((o) => o.textContent) }));
    check("Template ▾ starts at None (the designer's own layout) + ＋ Upload; 🧍 Mannequin… has ＋ Add your own", v0.t[0] === "None - the designer's own layout" && v0.t[v0.t.length - 1] === "＋ Upload a character sheet…" && v0.m[v0.m.length - 1] === "＋ Add your own mannequin…", v0);
    // upload a template
    await p.setInputFiles("#h3sTplFile", path.join(dir, "studio sheet.png"));
    await p.waitForFunction(() => /template studio sheet added/.test(document.getElementById("h3sStatus").textContent), null, { timeout: 15000 });
    const v1 = await ev(() => { const s = document.getElementById("h3sTpl"), lg = document.getElementById("h3sLayout"), cv = document.getElementById("h3sCv");
      return { pick: s.selectedOptions[0].textContent, lg: lg.checked && lg.disabled, del: !document.getElementById("h3sTplDel").hidden, ratio: cv.width / cv.height, size: document.getElementById("h3sSize").textContent }; });
    check("＋ Upload: the sheet is in your library and picked (its size), drawn as the layout (2:1), the Layout guide ticked + locked, 🗑 shown",
      v1.pick === "studio sheet (1600 × 800)" && v1.lg && v1.del && Math.abs(v1.ratio - 2) < 0.05 && /the sheet follows its layout/.test(v1.size), v1);
    // own mannequin -> the reference (2.934.0), the template set aside
    await p.setInputFiles("#h3sMqFile", path.join(dir, "wooden doll.png"));
    await p.waitForFunction(() => /wooden doll is the reference sheet/.test(document.getElementById("h3sPicNote").textContent), null, { timeout: 15000 });
    const v2 = await ev(() => { const s = document.getElementById("h3sMannequin"), cv = document.getElementById("h3sCv"), t = document.getElementById("h3sTpl"), d = document.getElementById("chMaskCanvas").getContext("2d").getImageData(2, 2, 1, 1).data;
      return { pick: s.selectedOptions[0].textContent, group: s.selectedOptions[0].parentNode.label, del: !document.getElementById("h3sMqDel").hidden, ratio: cv.height / cv.width,
               tpl: t.value, tplText: t.selectedOptions[0].textContent, empty: d[0] === 12 && d[1] === 10 && d[2] === 8, size: document.getElementById("h3sSize").textContent, r: window.H3SheetDesign.reference() }; });
    check("＋ Add your own mannequin: listed under Your mannequins, picked, its picture is the REFERENCE (Layout box, its shape; Template ▾ says so), not the start picture",
      v2.pick === "wooden doll" && v2.group === "Your mannequins" && v2.del && Math.abs(v2.ratio - 2.5) < 0.05 && v2.tpl === "__mq" && /wooden doll - poses and camera angles/.test(v2.tplText)
      && v2.empty && /^Reference: wooden doll/.test(v2.size) && /^mannequin:own:/.test(v2.r && v2.r.id), v2);
    // ▶ Generate sheet with no character picture -> asked for one; with one -> the mannequin's reference rides along
    await ev(() => document.getElementById("chSheetGen").click());
    await p.waitForTimeout(400);
    check("▶ Generate sheet with no picture: nothing sent (the character must be loaded or generated)", sheets.length === 0);
    await p.route("**/outputs/char874.png", (route) => route.fulfill({ body: png(300, 600), contentType: "image/png" }));
    await ev(() => window.H3CharSheetPic.open("/outputs/char874.png", "char874.png"));
    await p.waitForFunction(() => { const d = document.getElementById("chMaskCanvas").getContext("2d").getImageData(2, 2, 1, 1).data; return !(d[0] === 12 && d[1] === 10 && d[2] === 8); }, null, { timeout: 10000 }).catch(() => {});
    await ev(() => document.getElementById("chSheetGen").click());
    for (let i = 0; i < 50 && !sheets.length; i++) await p.waitForTimeout(100);
    const lib = await ev(() => window.H3SheetDesign.library());
    const tid = lib.templates[0] && lib.templates[0].id, mid = lib.mannequins[0] && lib.mannequins[0].id;
    check("...with your picture: the mannequin's reference rides as template=mannequin:own:<id>", sheets.length === 1 && new RegExp(`name="template"\\r\\n\\r\\nmannequin:own:${mid}\\r\\n`).test(sheets[0]), sheets[0] && sheets[0].slice(0, 300));
    // the template picked again -> the mannequin set aside; ▶ Generate sheet sends the template
    await ev(() => { try { document.getElementById("chSheetDlg").close(); } catch (e) {} });
    await p.selectOption("#h3sTpl", tid);
    check("Template picked: the mannequin is no longer the reference", await ev(() => document.getElementById("h3sMannequin").value === "" && window.H3SheetDesign.reference().id) === tid);
    await ev(() => window.H3CharSheetPic.open("/outputs/char874.png", "char874.png"));
    await p.waitForTimeout(400);
    await ev(() => document.getElementById("chSheetGen").click());
    for (let i = 0; i < 50 && sheets.length < 2; i++) await p.waitForTimeout(100);
    check("▶ Generate sheet: the template's id rides with the picture", sheets.length === 2 && new RegExp(`name="template"\\r\\n\\r\\n${tid}\\r\\n`).test(sheets[1]), sheets[1] && sheets[1].slice(0, 300));
    // remembered over a reload
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SheetDesign && document.getElementById("chNewPic"), null, { timeout: 60000 });
    await p.waitForTimeout(600);
    await ev(() => document.getElementById("chNewPic").click());
    await p.waitForFunction(() => document.getElementById("h3sTpl") && document.getElementById("h3sTpl").options.length > 2, null, { timeout: 15000 });
    check("the picked template is kept over a reload", await ev(() => document.getElementById("h3sTpl").value) === tid);
    // deleted from the library (the API) -> the lists follow
    await ev(async (o) => { await fetch("/api/charsheet/library/templates/" + o.t, { method: "DELETE" }); await fetch("/api/charsheet/library/mannequins/" + o.m, { method: "DELETE" }); await window.H3SheetDesign.loadLibrary(); },
      { t: tid, m: lib.mannequins[0].id });
    const v3 = await ev(() => ({ t: document.getElementById("h3sTpl").value, n: document.getElementById("h3sTpl").options.length, lg: document.getElementById("h3sLayout").disabled, mq: document.getElementById("h3sMannequin").querySelector("optgroup") }));
    check("deleted: back to None (the Layout guide free again), Your mannequins gone", v3.t === "" && v3.n === 2 && v3.lg === false && v3.mq === null, v3);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
