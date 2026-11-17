#!/usr/bin/env node
/* bitGen Studio — 2.828.0 against the RUNNING app (+ a real browser): ▦ the spreadsheet from the PROMPT DOCKER. Tim: "can i use
 * prompt docker to upload a file and the llm formats it or creates a dashboard etc. if i say create a dashboard it creates a
 * dashboard, if i say received a payment of <number> it adds it to the right columns with description".
 *   a .csv put on the prompt docker's ＋ opens in the spreadsheet; "format it" formats the table; "create a dashboard of units by
 *   region" builds it by a stand-in LLM (Settings ▸ LLM's endpoint for the run, put back after)
 *   "received a payment of 540 for rent" -> the row shown first (editable) -> ✔ Add -> the Ledger (made), Income 540, Rent,
 *   today; "paid 80 for power on 3/02/2026" -> Expense, in date order; Cancel adds nothing; one undo
 *   "rent went up to 580 from 12/01/2027" with a Rent constant -> the Constants form filled; ordinary chat still goes to the LLM
 * H3_SHOTS=<dir> saves pictures. No Playwright = SKIP. */
"use strict";
const path = require("path"), fs = require("fs"), http = require("http"), os = require("os");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/", SHOTS = process.env.H3_SHOTS || "";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (method, u, body) => { const r = await fetch(new URL(u, URL_), { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined }); return r.json(); };
const asked = [];
const PLAN = { title: "Units by region", sheet: "orders", kpis: [{ label: "Units", func: "SUM", column: "Units", format: "integer" }], breakdowns: [{ title: "Units by region", by: "Region", value: "Units", func: "SUM", chart: "bar" }], trend: null, formats: {}, theme: "green" };
function llmServer() {
  return http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => { body += c; });
    req.on("end", () => {
      let j = {}; try { j = JSON.parse(body); } catch (e) { /* empty */ }
      const all = (j.messages || []).map((m) => m.content).join("\n"); asked.push(all);
      const text = /You design dashboards/.test(all) ? JSON.stringify(PLAN) : "an ordinary chat answer from the stand-in";
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }] }));
    });
  }).listen(0, "127.0.0.1");
}
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const llm = llmServer(); await new Promise((r) => llm.on("listening", r));
  const cfg0 = await api("GET", "api/config"), llm0 = { external_url: (cfg0.llm || {}).external_url || "", external_model: (cfg0.llm || {}).external_model || "local" };
  await api("POST", "api/config", { llm: { external_url: `http://127.0.0.1:${llm.address().port}/v1/chat/completions`, external_model: "stand-in" } });
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  const shot = async (n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + ".png") }); } };
  const send = (t) => ev((t) => chatSend(t), t);
  const lastReply = () => ev(() => { const L = [...document.querySelectorAll("#chatlog .cm")]; return (L[L.length - 1] || {}).textContent || ""; });
  const raw = (name, a) => ev(([n, a]) => { const s = window.H3Sheet.W.sheets.find((s) => s.name === n), c = s && s.cells[a]; return c ? c.v : ""; }, [name, a]);
  const shown = (name, a) => ev(([n, a]) => { const H = window.H3Sheet, si = H.W.sheets.findIndex((s) => s.name === n), act = H.W.active; H.W.active = si; const q = window.SheetCalc.parseAddr(a), t = H.shown(q.c, q.r); H.W.active = act; return t; }, [name, a]);
  const today = (() => { const t = new Date(); return `${t.getDate()}/${String(t.getMonth() + 1).padStart(2, "0")}/${t.getFullYear()}`; })();
  const csv = path.join(os.tmpdir(), "orders-t828.csv");
  fs.writeFileSync(csv, "Order,Region,Units,Price\n" + Array.from({ length: 12 }, (_, i) => `O-${i + 1},${["North", "South", "East"][i % 3]},${i + 1},${(i % 4) + 2.5}`).join("\n") + "\n");
  try {
    await p.addInitScript(() => { try { localStorage.removeItem("h3.g.sheetdock"); localStorage.removeItem("h3.sheet.draft"); } catch (e) { /* fine */ } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Sheet && window.H3SheetChat && typeof chatSend === "function", null, { timeout: 60000 });
    check("the spreadsheet docker starts closed; the prompt docker's ＋ accepts workbooks", await ev(() => document.getElementById("sheetdock").classList.contains("dockgone") && /\.xlsx/.test(document.getElementById("pdAttachFile").accept)));
    // ＋ a .csv on the prompt docker
    await p.setInputFiles("#pdAttachFile", csv);
    await p.waitForFunction(() => window.H3Sheet.W.sheets[0].name === "orders-t828" && !document.getElementById("sheetdock").classList.contains("dockgone"), null, { timeout: 15000 });
    await ev(() => { const d = document.getElementById("sheetdock"); d.dataset.t828css = d.getAttribute("style") || ""; d.style.cssText += ";position:fixed;left:10px;top:60px;width:1100px;height:820px;z-index:50"; });
    check("＋ orders.csv on the prompt docker: it opens in the spreadsheet (shown), the chat says what to do with it", (await raw("orders-t828", "C2")) === "1" && /orders-t828\.csv is open in the spreadsheet/.test(await lastReply()), await lastReply());
    await send("format it");
    check("\"format it\": the table formatted - heading styled, the heading kept on screen, a filter; the chat says so", /formatted as a table: 4 columns, 12 rows/.test(await lastReply()) && (await ev(() => { const S = window.H3Sheet.W.sheets[0]; return !!(S.cells.A1.s && S.cells.A1.s.b) && S.freeze.r === 1 && S.filter && S.filter.r2 === 12; })), await lastReply());
    const n0 = asked.length;
    await send("create a dashboard of units by region");
    await p.waitForFunction(() => window.H3Sheet.W.sheets[0].name === "Dashboard", null, { timeout: 30000 });
    check("\"create a dashboard of units by region\": built by the LLM (asked with \"units by region\"), the chat says what was made", asked.length > n0 && /What the user wants to see: units by region/.test(asked[asked.length - 1]) && /Dashboard" built in the spreadsheet/.test(await lastReply()), [await lastReply(), (asked[asked.length - 1] || "").slice(-200)]);

    // payments
    await send("received a payment of 540 for rent");
    await p.waitForSelector("#shEntryDlg[open]");
    const d1 = await ev(() => ({ date: document.getElementById("sheDate").value, desc: document.getElementById("sheDesc").value, cat: document.getElementById("sheCat").value, amt: document.getElementById("sheAmt").value, kind: document.querySelector('[name="sheKind"]:checked').value, where: document.getElementById("sheWhere").textContent }));
    check("\"received a payment of 540 for rent\": the row shown first - today, Rent, $540, Income (received) - no ledger yet said", d1.amt === "540" && d1.kind === "income" && d1.desc === "Rent" && /no ledger yet/.test(d1.where) && /Income \(received\) \$540 · Rent/.test(await lastReply()) && (await ev(() => !window.H3Sheet.W.sheets.some((s) => s.name === "Ledger"))), [d1, await lastReply()]);
    await shot("1-entry");
    await p.fill("#sheDesc", "Rent from the tenant"); await p.fill("#sheCat", "Rent");
    await p.click("#sheAdd");
    check("…✔ Add (the words changed first): a Ledger made, the row in it - today, Rent from the tenant, Rent, Income 540; the chat says it was added", (await raw("Ledger", "B2")) === "Rent from the tenant" && (await raw("Ledger", "C2")) === "Rent" && (await raw("Ledger", "D2")) === "540" && (await shown("Ledger", "A2")) === today && /added to "Ledger"/.test(await lastReply()), [await raw("Ledger", "B2"), await shown("Ledger", "A2"), await lastReply()]);
    await send("paid 80 for power on 3/02/2026");
    await p.waitForSelector("#shEntryDlg[open]");
    check("\"paid 80 for power on 3/02/2026\": Expense (paid), 3/02/2026, Power", (await ev(() => document.querySelector('[name="sheKind"]:checked').value)) === "expense" && (await ev(() => document.getElementById("sheDate").value)) === "2026-02-03" && (await ev(() => document.getElementById("sheDesc").value)) === "Power");
    await p.click("#sheAdd");
    check("…added in date order (before today's rent), Expense 80; the balance runs", (await raw("Ledger", "B2")) === "Power" && (await raw("Ledger", "E2")) === "80" && (await raw("Ledger", "B3")) === "Rent from the tenant", [await raw("Ledger", "B2"), await raw("Ledger", "B3")]);
    await ev(() => window.H3Sheet.undo());
    check("…one Ctrl+Z takes the power payment out again", (await raw("Ledger", "B2")) === "Rent from the tenant" && (await raw("Ledger", "B3")) === "");
    await send("paid 15 for parking");
    await p.waitForSelector("#shEntryDlg[open]");
    await ev(() => document.querySelector('#shEntryDlg [data-x]').click());
    check("Cancel adds nothing", (await raw("Ledger", "B3")) === "" && !(await ev(() => document.getElementById("shEntryDlg").open)));

    // a new amount for a constant
    await ev(() => { window.H3Sheet.W.constants = [{ id: "k1", name: "Rent", kind: "expense", desc: "Rent payment", rates: [{ amount: 540, every: "week", start: "2026-01-13" }] }]; });
    await send("rent went up to 580 from 12/01/2027");
    await p.waitForSelector("#shConstDlg[open]");
    const f1 = await ev(() => ({ name: document.getElementById("sckName").value, amt: document.getElementById("sckAmt").value, every: document.getElementById("sckEvery").value, start: document.getElementById("sckStart").value, btn: document.getElementById("sckAdd").textContent }));
    check("\"rent went up to 580 from 12/01/2027\": the Constants open with Rent, 580, week, 12/01/2027 filled - ＋ Add a new amount to Rent", f1.name === "Rent" && f1.amt === "580" && f1.every === "week" && f1.start === "2027-01-12" && f1.btn === "＋ Add a new amount to Rent" && /press ＋ Add a new amount to Rent/.test(await lastReply()), [f1, await lastReply()]);
    await shot("2-rate");
    await ev(() => document.querySelector('#shConstDlg [data-x]').click());

    // ordinary chat still goes to the LLM
    const n1 = asked.length;
    await send("what is a good lens for portraits?");
    await p.waitForFunction((n) => !document.querySelector("#chatlog .cm:last-child") || !/thinking/.test(document.querySelector("#chatlog .cm:last-child").textContent), null, { timeout: 20000 });
    await p.waitForTimeout(500);
    check("an ordinary message still goes to the chat LLM (the spreadsheet open or not)", asked.length > n1 && /ordinary chat answer from the stand-in/.test(await lastReply()), await lastReply());
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    try { await api("POST", "api/config", { llm: llm0 }); } catch (e) { /* fine */ }
    try { await ev(() => { const d = document.getElementById("sheetdock"); d.style.cssText = d.dataset.t828css || ""; localStorage.removeItem("h3.sheet.draft"); if (!d.classList.contains("dockgone")) toggleDockGone("sheetdock", "tX_sheetdock"); }); } catch (e) { /* fine */ }
    await b.close(); llm.close(); try { fs.unlinkSync(csv); } catch (e) { /* fine */ }
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
