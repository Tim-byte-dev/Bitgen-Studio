#!/usr/bin/env node
/* bitGen Studio — 2.932.0 in a REAL browser: 👗 the Garment designer (static/garment.js + routes/garment.js).
 * The image editor's 👗 (icon bar + File menu) opens it; the 12 kinds; Trousers -> the waistband + trousers settings and a
 * pattern (an SVG from GarmentCode); a slider changed = made again (☑ Auto); your own height = a bigger pattern; ✨ describe it in
 * words; ⤓ PDF (A3, 1 cm seam allowance) downloaded; your garments listed, opened, deleted; 👗 Garment… in the Character
 * creator's sheet tab. With no GarmentCode on the server: the Download / Cancel box, and the words still read.
 * Against the running app (H3_URL) - started with GARMENT_PY / GARMENT_SRC for the full run. No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/$/, "");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const getj = async (p) => (await fetch(URL_ + p)).json();
(async () => {
  try { const r = await fetch(URL_ + "/"); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  const st = await getj("/api/garment");
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const say = () => ev(() => document.getElementById("gmSay").textContent);
  try {
    await p.goto(URL_ + "/", { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Garment && window.H3GarmentSpec, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    if (!st.installed) {
      await ev(() => { window.H3Garment.open({ from: "test" }); });
      await p.waitForFunction(() => document.querySelector("dialog.nidlg[open]"), null, { timeout: 15000 }).catch(() => {});
      const box = await ev(() => { const d = document.querySelector("dialog.nidlg[open]"); return d ? d.textContent : ""; });
      check("not installed: the Download / Cancel box names the Garment designer", /Garment designer/.test(box) && /Cancel/.test(box), box.slice(0, 200));
      await ev(() => { const d = document.querySelector("dialog.nidlg[open]"); [...d.querySelectorAll("button")].find((x) => /Cancel/.test(x.textContent)).click(); });
      await p.waitForTimeout(600);
      check("…Cancel: the dialog stays, says it is not installed", /not installed/.test(await say()) && await ev(() => document.getElementById("gmDlg").open), await say());
      await ev(() => { document.getElementById("gmWords").value = "wide-leg trousers"; document.getElementById("gmDescribe").click(); });
      await p.waitForFunction(() => /Trousers|trousers/.test(document.getElementById("gmSay").textContent), null, { timeout: 20000 }).catch(() => {});
      check("…the words are still read (trousers, wide legs) without GarmentCode", await ev(() => window.H3Garment.state().values["meta.bottom"] === "Pants" && window.H3Garment.state().values["pants.width"] === 1.4), await ev(() => window.H3Garment.state().values));
      console.log("NOTE: the server has no GarmentCode (GARMENT_PY) - the pattern legs were not run");
    } else {
      /* the image editor's 👗 */
      await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
      await p.waitForFunction(() => document.querySelector('#pcQuickBar [data-qcmd="file.garment"]'), null, { timeout: 30000 }).catch(() => {});
      const btn = await ev(() => { const q = document.querySelector('#pcQuickBar [data-qcmd="file.garment"]'); return q ? { text: q.textContent, label: q.getAttribute("aria-label"), off: q.disabled, last: q === [...document.querySelectorAll("#pcQuickBar [data-qcmd]")].pop(), after: q.previousElementSibling && q.previousElementSibling.dataset.qcmd } : null; });
      check("👗 on the image editor's icon bar: icon only, last, after 🪪, not greyed; File ▸ 👗 Garment Designer…", btn && btn.text === "👗" && btn.label === "Garment Designer" && !btn.off && btn.last && btn.after === "file.charsheet"
        && await ev(() => { const c = window.imageEditorInstance && window.imageEditorInstance.E.ui.CMD.get("file.garment"); return !!c; }), btn);
      await ev(() => document.querySelector('#pcQuickBar [data-qcmd="file.garment"]').click());
      await p.waitForFunction(() => document.getElementById("gmDlg") && document.getElementById("gmDlg").open && document.querySelectorAll("[data-gmpreset]").length, null, { timeout: 20000 });
      check("…it opens the Garment designer: 12 kinds, the female mannequin's measurements filled in", await ev(() => document.querySelectorAll("[data-gmpreset]").length === 12
        && +document.getElementById("gmHeight").value > 160 && +document.getElementById("gmWaist").value > 50 && document.getElementById("gmSex").value === "female"));
      /* Trousers */
      await ev(() => { document.getElementById("gmName").value = "UI932 trousers"; document.getElementById("gmName").dataset.auto = "0"; });
      await p.click('[data-gmpreset="trousers"]');
      await p.waitForFunction(() => document.getElementById("gmImg") && /pieces/.test(document.getElementById("gmInfo").textContent), null, { timeout: 60000 }).catch(() => {});
      const g1 = await ev(() => ({ groups: [...document.querySelectorAll("#gmGroups details")].map((d) => d.dataset.group), img: (document.getElementById("gmImg") || {}).src || "", info: document.getElementById("gmInfo").textContent, on: !!document.querySelector('[data-gmpreset="trousers"].on'), cur: window.H3Garment.state().cur }));
      check("Trousers: lit, the Waistband + Trousers settings shown (no top ones), the pattern drawn (GarmentCode's SVG), pieces + seams said",
        g1.on && g1.groups.join() === "meta,waistband,pants" && /\/api\/garment\/file\/ui932-trousers\/pattern\.svg/.test(g1.img) && /6 pieces/.test(g1.info) && g1.cur && g1.cur.slug === "ui932-trousers", g1);
      const imgOk = await ev(() => new Promise((ok) => { const i = document.getElementById("gmImg"); if (i.complete) ok(i.naturalWidth > 50); else { i.onload = () => ok(i.naturalWidth > 50); i.onerror = () => ok(false); } }));
      check("…the SVG loads as a picture", imgOk);
      const size1 = g1.cur.size_cm;
      /* a slider */
      await ev(() => { const r = document.querySelector('[data-gmpath="pants.length"] input[type=range]'); r.value = "0.5"; r.dispatchEvent(new Event("input")); r.dispatchEvent(new Event("change")); });
      await p.waitForFunction((h) => { const c = window.H3Garment.state().cur; return c && c.size_cm[1] < h - 5; }, size1[1], { timeout: 60000 }).catch(() => {});
      const g2 = await ev(() => window.H3Garment.state());
      check("a slider (Trousers ▸ Length 0.9 -> 0.5): made again by itself, shorter", g2.values["pants.length"] === 0.5 && g2.cur.size_cm[1] < size1[1] - 5, [size1, g2.cur && g2.cur.size_cm]);
      /* your own height */
      const h0 = g2.cur.size_cm[1];
      await ev(() => { const i = document.getElementById("gmHeight"); i.value = "190"; i.dispatchEvent(new Event("change")); });
      await p.waitForFunction((h) => { const c = window.H3Garment.state().cur; return c && c.size_cm[1] > h + 2; }, h0, { timeout: 60000 }).catch(() => {});
      const g3 = await ev(() => window.H3Garment.state().cur);
      check("your own height (190 cm): a longer pattern, kept with the garment", g3.size_cm[1] > h0 + 2 && g3.body.height === 190, [h0, g3.size_cm, g3.body]);
      /* PDF */
      await ev(() => { document.getElementById("gmPaper").value = "a3"; document.getElementById("gmSa").value = "1"; });
      const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }).catch(() => null), p.click("#gmPdf")]);
      await p.waitForFunction(() => /pattern-a3-sa10mm\.pdf/.test(document.getElementById("gmSay").textContent), null, { timeout: 30000 }).catch(() => {});
      check("⤓ PDF (A3, 1 cm seam allowance): downloaded, the pages said", dl && /pattern-a3-sa10mm\.pdf$/.test(dl.suggestedFilename()) && /pages/.test(await say()), [dl && dl.suggestedFilename(), await say()]);
      const head = await (await fetch(URL_ + "/api/garment/file/ui932-trousers/pattern-a3-sa10mm.pdf")).arrayBuffer();
      check("…the file is a PDF", Buffer.from(head).slice(0, 5).toString() === "%PDF-");
      /* words */
      await ev(() => { document.getElementById("gmWords").value = "a knee-length A-line skirt with a waistband"; document.getElementById("gmDescribe").click(); });
      await p.waitForFunction(() => window.H3Garment.state().values["meta.bottom"] === "SkirtCircle" && !document.getElementById("gmDescribe").disabled, null, { timeout: 90000 }).catch(() => {});
      await p.waitForFunction(() => { const c = window.H3Garment.state().cur; return c && c.values && c.values["meta.bottom"] === "SkirtCircle"; }, null, { timeout: 60000 }).catch(() => {});
      const g4 = await ev(() => ({ v: window.H3Garment.state().values, cur: window.H3Garment.state().cur, say: document.getElementById("gmSay").textContent, groups: [...document.querySelectorAll("#gmGroups details")].map((d) => d.dataset.group) }));
      check("✨ describe it: an A-line skirt with a waistband at the knee, its settings shown, the pattern made",
        g4.v["meta.bottom"] === "SkirtCircle" && g4.v["meta.wb"] && g4.groups.includes("flare-skirt") && g4.cur && g4.cur.values["meta.bottom"] === "SkirtCircle", g4);
      /* the list */
      const list = await getj("/api/garment/list");
      const rows = await ev(() => [...document.querySelectorAll("#gmList .gmitem")].map((i) => i.dataset.slug));
      check("your garments: both listed (newest first) in the dialog and by the server", list.some((x) => x.slug === "ui932-trousers") && rows.includes("ui932-trousers") && rows.includes(g4.cur.slug), [rows, list.map((x) => x.slug)]);
      await ev(() => document.querySelector('#gmList .gmitem[data-slug="ui932-trousers"]').click());
      await p.waitForTimeout(500);
      check("…a click opens one again: its settings, name and body back", await ev(() => window.H3Garment.state().values["meta.bottom"] === "Pants" && document.getElementById("gmName").value === "UI932 trousers" && document.getElementById("gmHeight").value === "190"));
      /* the sheet tab's 👗 Garment… */
      await ev(() => document.getElementById("gmDlg").close());
      await ev(() => document.getElementById("chNewPic").click());          // the sheet tab builds its mannequin row when it opens
      await p.waitForFunction(() => document.getElementById("h3sGarment"), null, { timeout: 15000 }).catch(() => {});
      const sheet = await ev(() => { const s = document.getElementById("h3sMannequin"), g = document.getElementById("h3sGarment"); return { has: !!g, near: !!(s && g && s.parentNode === g.parentNode) }; });
      check("👗 Garment… beside 🧍 Mannequin in the Character creator's sheet tab", sheet.has && sheet.near, sheet);
      await ev(() => { const s = document.getElementById("h3sMannequin"); s.value = "male"; s.dispatchEvent(new Event("change")); });
      await p.waitForTimeout(400);
      await ev(() => { document.querySelectorAll("dialog[open]").forEach((d) => { if (d.id !== "gmDlg") d.close(); }); document.getElementById("h3sGarment").click(); });
      await p.waitForFunction(() => document.getElementById("gmDlg").open, null, { timeout: 10000 }).catch(() => {});
      await p.waitForTimeout(800);
      check("…it opens the designer on that mannequin (Male -> the male mannequin's measurements)", await ev(() => document.getElementById("gmDlg").open && document.getElementById("gmSex").value === "male" && +document.getElementById("gmHeight").value > 178));
      /* delete */
      for (const s of rows) await ev((slug) => { const it = document.querySelector('#gmList .gmitem[data-slug="' + slug + '"] button'); if (it) it.click(); }, s);
      await p.waitForTimeout(1200);
      const after = await getj("/api/garment/list");
      check("🗑 deletes them (the server's list without them)", !after.some((x) => rows.includes(x.slug)), after.map((x) => x.slug));
    }
    check("no page errors", !errs.length, errs);
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack || e)); process.exit(1); });
