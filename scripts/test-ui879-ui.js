#!/usr/bin/env node
/* bitGen Studio — 2.879.0 in a REAL browser: 📒 Accounts starts OFF (the docker + its 📒 button gone; Settings ▸ Dockers lists it,
 * 👁 turns it on); 🧾 Insert Field… in the image editor places {{fields}} as text layers you move into place + a line items table;
 * the layout saved as an invoice template; Accounts ▸ Invoice layout ▾ = that template; 🖨 opens it in the image editor filled
 * with the invoice - the total due where it was put, a row per line.
 * Tim (verbatim): "hide the accounting docker and button. let user enable it in settings-dockers, and continue, allow user to use
 * an invoice template created by image-editor - let user place fields where they should be, like total due is in a box on the
 * invoice somewhere, it should be placed in the right position, the same with quotes" */
"use strict";
const path = require("path"), fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.SHOTS || "";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const TPL = "UI879 layout " + Date.now().toString(36);
  let profId = "";
  try {
    const prof = await (await fetch(URL_ + "api/business/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: { company: "UI879 Signs", abn: "51 824 753 556" } }) })).json();
    profId = prof.id;
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Accounts && window.H3Layouts && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.docTpl, null, { timeout: 60000 });
    await p.waitForTimeout(4500);
    const off = await ev(() => { const b = document.getElementById("tX_acctdock"); return { off: H3Layouts.isOff({ kind: "dock", id: "acctdock" }), btnShown: !!(b && b.offsetParent), gone: document.getElementById("acctdock").classList.contains("dockgone") || getComputedStyle(document.getElementById("acctdock")).display === "none" }; });
    check("📒 Accounts starts OFF: the docker and its 📒 button are gone", off.off && !off.btnShown && off.gone, off);
    const listed = await ev(async () => { const b = document.getElementById("openSettings"); if (b) b.click(); await new Promise((r) => setTimeout(r, 600)); const t = [...document.querySelectorAll("button, .stab, [data-tab]")].find((x) => /^\s*Dockers\s*$/.test(x.textContent)); if (t) t.click(); await new Promise((r) => setTimeout(r, 600)); const txt = document.body.innerText; const c = [...document.querySelectorAll("dialog[open] .h3dlgx, dialog[open] .bt .cn")][0]; return { has: /Accounts/.test(txt) }; });
    check("Settings ▸ Dockers lists Accounts (to turn on with 👁)", listed.has, listed);
    await ev(() => { document.querySelectorAll("dialog[open]").forEach((d) => d.close()); H3Layouts.set({ kind: "dock", id: "acctdock" }, false); }); await p.waitForTimeout(400);
    const on = await ev(() => { const b = document.getElementById("tX_acctdock"); return { off: H3Layouts.isOff({ kind: "dock", id: "acctdock" }), btnShown: !!(b && b.offsetParent) }; });
    check("👁 on: the 📒 button is back on the top bar", !on.off && on.btnShown, on);
    // the image editor: 🧾 Insert Field…
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await ev(() => { const E = window.imageEditorInstance.E; E.pages.newDocument({ preset: "A4", wmm: 210, hmm: 297, orient: "portrait", dpi: 150 }, 1, "Layout"); E.ui.run ? E.ui.run("file.tplfield") : E.docTpl.fieldDialog(); });
    await p.waitForSelector("[data-fk=balance_due]", { timeout: 5000 });
    const cmd = await ev(() => ({ btns: [...document.querySelectorAll("[data-fk]")].map((b) => b.dataset.fk), title: document.querySelector(".kxdlg.pcd h4").textContent }));
    check("🧾 Insert Field…: Your business / Customer / Document / Totals fields + the line items table", /Insert Field/.test(cmd.title) && ["from_name", "from_abn", "client_name", "number", "due_date", "total", "balance_due", "gst_note", "_items"].every((k) => cmd.btns.includes(k)), cmd);
    for (const k of ["title", "number", "client_name", "balance_due", "_items"]) { await p.click(`[data-fk=${k}]`); await p.waitForTimeout(150); }
    await p.click(".kxdlg.pcd .ok");
    // "drag" the balance due into its box at the bottom right
    const placed = await ev(() => { const E = window.imageEditorInstance.E, L = E.S.layers.find((x) => x.text && x.text.str === "{{balance_due}}"); L.text.x = 900; L.text.y = 1500; E.D.rasterize(L); E.refresh(); return { x: L.text.x, y: L.text.y, names: E.S.layers.map((x) => x.name), table: E.S.layers.some((x) => x.type === "doc" && /\{\{item\.amount\}\}/.test(x.doc.html)) }; });
    check("each field a text layer named after it ({{balance_due}} moved into its box at 900, 1500), the line items a WP table", placed.names.includes("🧾 Balance due (total due)") && placed.table, placed);
    // saved as an invoice template (as File ▸ 💾 Save as Template… does)
    const saved = await ev(async (name) => { const E = window.imageEditorInstance.E, out = await E.bgi.toBytes(), bytes = out && out.bytes ? out.bytes : out; const r = await fetch("/api/doctemplates/save?" + new URLSearchParams({ name, kind: "invoice", taxRate: "10", currency: "$", dueDays: "14" }), { method: "POST", body: bytes }); return r.json(); }, TPL);
    check("the layout saved as an invoice template", saved.meta && saved.meta.kind === "invoice", saved);
    // Accounts: Layout ▾ = the template; an invoice; 🖨
    await ev((id) => { const S = H3Accounts.state(); S.biz = id; return H3Accounts.refresh().then(() => H3Accounts.show("accounts")); }, profId);
    await p.waitForSelector("#acInvLay");
    const opts = await ev(() => [...document.getElementById("acInvLay").options].map((o) => o.value).concat(document.getElementById("acDesign") ? ["#design"] : []));
    check("Accounts ▸ Invoice layout ▾: the ledger page + the image editor's templates; 🎨 Design a layout", opts[0] === "" && opts.includes(TPL) && opts.includes("#design"), opts);
    await p.selectOption("#acInvLay", TPL); await p.waitForTimeout(600);
    const inv = await ev(async () => { const S = H3Accounts.state(); const r = await fetch("/api/accounts/doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ biz: S.biz, doc: { kind: "invoice", party: "Ms J Lee", date: "2026-11-19", lines: [{ desc: "Shop sign", account: "4200", qty: 1, unit: 2200 }, { desc: "Fitting", account: "4200", qty: 2, unit: 165 }] } }) }); return r.json(); });
    await ev((id) => H3Accounts.printDoc(id), inv.id);
    await p.waitForTimeout(1500);
    const filled = await ev(() => { const E = window.imageEditorInstance.E, T = E.S.layers.filter((x) => x.type === "text").map((x) => ({ s: x.text.str, x: x.text.x, y: x.text.y })), W = E.S.layers.find((x) => x.type === "doc"); return { T, rows: W ? (W.doc.html.match(/<tr/g) || []).length : 0, html: W ? W.doc.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") : "", msg: document.getElementById("acMsg").textContent }; });
    const bal = filled.T.find((t) => t.s === "$2,530.00");
    check("🖨 with the layout: the image editor opens it filled - Tax Invoice, INV-0001, Ms J Lee, the balance due $2,530.00 where it was placed (900, 1500)",
      filled.T.some((t) => t.s === "Tax Invoice") && filled.T.some((t) => t.s === "INV-0001") && filled.T.some((t) => t.s === "Ms J Lee") && bal && bal.x === 900 && bal.y === 1500, filled);
    check("...the line items table: a row per line (header + 2), Shop sign $2,200.00, Fitting 2 x $165.00 = $330.00 with its GST $30.00",
      filled.rows === 3 && /Shop sign 1 \$2,200\.00 \$200\.00 \$2,200\.00/.test(filled.html) && /Fitting 2 \$165\.00 \$30\.00 \$330\.00/.test(filled.html) && /Print Preview/.test(filled.msg), filled);
    if (SHOTS) await p.locator("#imageeditdock").screenshot({ path: path.join(SHOTS, "invoice-layout.png") });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally {
    try { await fetch(URL_ + "api/doctemplates/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: TPL }) }); } catch { /* left */ }
    try { if (profId) await fetch(URL_ + "api/business/profiles/" + profId, { method: "DELETE" }); } catch { /* left */ }
    try { if (profId) fs.rmSync(path.join(process.env.H3_ROOT || "/tmp/t819", "accounting", profId), { recursive: true, force: true }); } catch { /* left */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
