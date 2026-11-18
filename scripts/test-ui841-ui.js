#!/usr/bin/env node
/* bitGen Studio — 2.841.0 in a REAL browser: 🧾 templates in the image editor - the built-in Invoice opened, filled from the
 * 🧾 Fill box (✨ Ask the AI with a stand-in LLM; the sums worked out here), undone, saved as your own template, and an invoice
 * made from the prompt docker's words. Tim: "allow user to create a template in image editor so user can create invoices,
 * user can talk to llm or type invoice needs." Against the running app (H3_URL). No Playwright = SKIP. */
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
const api = async (method, u, body) => { const r = await fetch(new URL(u, URL_), { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined }); return r.json(); };
const asked = [];
function llmServer() {
  return http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => { body += c; });
    req.on("end", () => {
      let j = {}; try { j = JSON.parse(body); } catch (e) { /* empty */ }
      const all = (j.messages || []).map((m) => m.content).join("\n"); asked.push(all);
      const text = /You fill in a business document/.test(all) ? (/Bob/.test(all) ? JSON.stringify({ fields: { client_name: "Bob" }, items: [{ description: "Editing", qty: 2, price: 50 }] }) : JSON.stringify({ fields: { client_name: "Acme Pty Ltd", client_email: "ap@acme.test" }, items: [{ description: "Logo design", qty: 3, price: 90 }, { description: "Hosting", qty: 1, price: 20 }] })) : "an ordinary chat answer";
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }] }));
    });
  }).listen(0, "127.0.0.1");
}
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const llm = llmServer(); await new Promise((r) => llm.on("listening", r));
  const cfg0 = await api("GET", "api/config"), llm0 = { external_url: (cfg0.llm || {}).external_url || "", external_model: (cfg0.llm || {}).external_model || "local" };
  await api("POST", "api/config", { llm: { external_url: `http://127.0.0.1:${llm.address().port}/v1/chat/completions`, external_model: "stand-in" } });
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.docTpl && window.imageEditorInstance.E.pages, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { if (d.style.display !== "none") d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:60px;width:1600px;height:900px;z-index:9999"; });
    await p.waitForTimeout(400);
    const html = () => ev(() => { const E = window.imageEditorInstance.E, W = E.S.layers.find((x) => x.type === "doc"); return W ? W.doc.html : ""; });
    // the File menu + the built-in Invoice
    const m0 = await ev(() => { const E = window.imageEditorInstance.E; return { has: ["file.tplnew", "file.tplfill", "file.tplsave"].every((id) => E.ui.CMD.get(id)) }; });
    await ev(() => window.imageEditorInstance.E.ui.run("file.tplnew")); await p.waitForTimeout(400);
    const nd = await ev(() => { const d = document.querySelector(".kxdlg.pcd"); return { title: d && d.querySelector("h4").textContent, n: d ? d.querySelectorAll("input[name=tplPick]").length : 0 }; });
    await ev(() => document.querySelector(".kxdlg.pcd .ok").click());
    await p.waitForFunction(() => !!document.querySelector("#tplAsk"), null, { timeout: 8000 });
    const h0 = await html();
    check("File ▸ 🧾 New From Template… lists the built-in Invoice / Quote / Receipt; Open makes an A4 invoice (its {{fields}}, an item row) and opens the 🧾 Fill box",
      m0.has && nd.title === "🧾 New From Template" && nd.n >= 3 && /INVOICE/.test(h0) && /\{\{client_name\}\}/.test(h0) && /\{\{item\.description\}\}/.test(h0), { m0, nd });
    // ✨ Ask the AI in the box, then Fill
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector("#tplAsk").value = "3 hours of logo design at $90 and hosting $20 for Acme Pty Ltd"; d.querySelector("#tpl_from_name").value = "Tiger Art"; d.querySelector("#tplAskGo").click(); });
    await p.waitForFunction(() => { const d = document.querySelector(".kxdlg.pcd"); return d && d.querySelector("#tpl_client_name").value === "Acme Pty Ltd"; }, null, { timeout: 8000 });
    const rows = await ev(() => [...document.querySelectorAll(".kxdlg.pcd .tplItems tbody tr")].map((tr) => [tr.querySelector(".tplD").value, tr.querySelector(".tplQ").value, tr.querySelector(".tplP").value]));
    check("✨ Ask the AI fills the box: the client's details and the items (what the LLM was told: the fields, the kind, the currency)",
      rows.length === 2 && rows[0][0] === "Logo design" && rows[0][1] === "3" && rows[0][2] === "90" && /client_name/.test(asked.find((a) => /You fill in/.test(a)) || ""), rows);
    await ev(() => document.querySelector(".kxdlg.pcd .ok").click());
    await p.waitForFunction(() => { const W = window.imageEditorInstance.E.S.layers.find((x) => x.type === "doc"); return W && /Acme/.test(W.doc.html); }, null, { timeout: 8000 });
    const h1 = await html();
    check("🧾 Fill: the fields, a row per item, the number INV-0001, today's date, the sums worked out here (3 x 90 + 20 = 290, tax 10 % = 29, total 319), no {{…}} left",
      /Acme Pty Ltd/.test(h1) && /Tiger Art/.test(h1) && /INV-0001/.test(h1) && /\$270\.00/.test(h1) && /Subtotal \$290\.00/.test(h1) && /\$29\.00/.test(h1) && /Total \$319\.00/.test(h1) && !/\{\{/.test(h1), h1.slice(0, 1500));
    await ev(() => window.imageEditorInstance.E.undo()); await p.waitForTimeout(300);
    check("…one Ctrl+Z takes the filling back (the {{fields}} again)", /\{\{client_name\}\}/.test(await html()));
    // saved as your own template
    await ev(() => window.imageEditorInstance.E.ui.run("file.tplsave")); await p.waitForTimeout(300);
    await ev(() => { const d = document.querySelector(".kxdlg.pcd"); d.querySelector("#tplName").value = "Tiger invoice"; d.querySelector("#tplTax").value = "10"; d.querySelector(".ok").click(); });
    await p.waitForTimeout(1500);
    const list = await api("GET", "api/doctemplates");
    const mine = (list.templates || []).find((t) => t.name === "Tiger invoice");
    check("💾 Save as Template… keeps the document as your own template (kind invoice, its counter)", mine && mine.kind === "invoice" && mine.prefix === "INV-" && mine.size > 1000, list);
    // the prompt docker
    const reply = await ev(async () => { for (const r of window.H3ChatRoutes) { const out = await r("make an invoice for Bob for 2 hours of editing at $50"); if (out != null) return out; } return null; });
    await p.waitForTimeout(800);
    const h2 = await html();
    check("the prompt docker: \"make an invoice for Bob …\" opens your newest invoice template, fills it (INV-0001 of that template, 2 x 50 + 10 % = $110.00)",
      /Invoice INV-0001/.test(reply || "") && /\$110\.00/.test(reply || "") && /Bob/.test(h2) && /Total \$110\.00/.test(h2) && /Tiger Art/.test(h2), { reply, h2: h2.slice(0, 600) });
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally {
    try { await api("POST", "api/config", { llm: llm0 }); } catch (e) { /* fine */ }
    try { await api("POST", "api/doctemplates/delete", { name: "Tiger invoice" }); } catch (e) { /* fine */ }
    await b.close(); llm.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
