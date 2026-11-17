#!/usr/bin/env node
/* bitGen Studio — 2.825.0 against the RUNNING app (+ a real browser): ▦ ✨ AI in the cells. Tim: "lets go next" (after the
 * dashboard: write a formula from words, explain a formula, fill a column from examples). A stand-in OpenAI-style LLM is
 * Settings ▸ LLM's endpoint for the run (put back after).
 *   🪄 Ctrl+E with one example of first names = filled here (no LLM), one undo takes it back
 *   🪄 totals from two examples: the LLM's first formula does not give them (checked here) - asked again, its second does
 *      and goes into the empty rows
 *   🪄 tiers no formula gives = the LLM's values, said to be its guess
 *   ✍ Write a formula… from ✨ AI ▾: the result shown before it goes in, Put it in; a per-row formula + Fill down
 *   💡 Explain this formula from the cell's right-click menu: what it reads now + the LLM's words
 *   the LLM down: said, nothing changed. H3_SHOTS=<dir> saves pictures. No Playwright = SKIP. */
"use strict";
const path = require("path"), fs = require("fs"), http = require("http");
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
function llmServer() {
  return http.createServer((req, res) => {
    let body = ""; req.on("data", (c) => { body += c; });
    req.on("end", () => {
      let j = {}; try { j = JSON.parse(body); } catch (e) { /* empty */ }
      const all = (j.messages || []).map((m) => m.content).join("\n"); asked.push(all);
      let text = "?";
      if (/You write spreadsheet formulas/.test(all)) text = /gross/i.test(all) ? '{"formula": "=D2*E2*1.1", "explain": "Units times price, plus 10%."}' : '```json\n{"formula": "=SUM(D2:D7)", "explain": "Adds up the Units column."}\n```';
      else if (/You explain a spreadsheet formula/.test(all)) text = "<think>ok</think>It multiplies the units by the price and adds 10%.\n- D2: the units\n- E2: the price";
      else if (/The column to fill: G/.test(all) && /Find the rule/.test(all)) text = /did not give the examples/.test(all) ? '{"formula": "=D2*E2", "explain": "Units times price."}' : '{"formula": "=D2+E2"}';
      else if (/The column to fill: H/.test(all) && /Find the rule/.test(all)) text = '{"formula": "=C2"}';
      else if (/Fill in the missing rows/.test(all)) { const rows = [...all.split("The rows to fill:")[1].matchAll(/row (\d+): .*D="(\d+)"/g)]; text = JSON.stringify({ values: Object.fromEntries(rows.map((m) => [m[1], +m[2] >= 5 ? "Big" : "Small"])) }); }
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }] }));
    });
  }).listen(0, "127.0.0.1");
}
const DATA = [["Name", "Email", "Region", "Units", "Price"], ["john smith", "john@acme.com", "North", "5", "2.5"], ["mary jones", "mary@acme.com", "South", "3", "10"], ["ann lee", "ann@x.org", "East", "2", "4"],
  ["bob brown", "bob@y.net", "West", "10", "1.5"], ["li wei chen", "li@z.com", "North", "1", "99"], ["sam o'neil", "sam@q.com", "South", "4", "0.5"]];
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const llm = llmServer(); await new Promise((r) => llm.on("listening", r));
  const cfg0 = await api("GET", "api/config"), llm0 = { external_url: (cfg0.llm || {}).external_url || "", external_model: (cfg0.llm || {}).external_model || "local" };
  const useLlm = (port) => api("POST", "api/config", { llm: { external_url: `http://127.0.0.1:${port}/v1/chat/completions`, external_model: "stand-in" } });
  await useLlm(llm.address().port);
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  const S = (a) => ev((a) => { const q = window.SheetCalc.parseAddr(a); return window.H3Sheet.shown(q.c, q.r); }, a);
  const raw = (a) => ev((a) => { const c = window.H3Sheet.W.sheets[window.H3Sheet.W.active].cells[a]; return c ? c.v : ""; }, a);
  const col = async (L, r1, r2) => { const o = []; for (let r = r1; r <= r2; r++) o.push(await S(L + r)); return o; };
  const msg = () => ev(() => document.getElementById("shMsg").textContent);
  const pick = (a) => ev((a) => { const q = window.SheetCalc.parseAddr(a); window.H3Sheet.go(q.c, q.r); document.getElementById("shGrid").focus(); }, a);
  const type = (a, v) => ev(([a, v]) => { const H = window.H3Sheet, q = window.SheetCalc.parseAddr(a); H._.step(); H.setRaw(q.c, q.r, v); H._.changed(); }, [a, v]);
  const shot = async (n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + ".png") }); } };
  try {
    await p.addInitScript(() => { try { localStorage.removeItem("h3.g.sheetdock"); localStorage.removeItem("h3.sheet.draft"); } catch (e) { /* fine */ } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Sheet && window.H3SheetAI, null, { timeout: 60000 });
    await p.$eval("#tX_sheetdock", (e) => e.click()); await p.waitForTimeout(400);
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { if (d.style.display !== "none") { d.dataset.t825 = d.style.display; d.style.display = "none"; } }); const d = document.getElementById("sheetdock"); d.dataset.t825css = d.getAttribute("style") || ""; d.style.cssText += ";position:fixed;left:10px;top:60px;width:1380px;height:820px;z-index:9999"; });
    await ev((D) => { const H = window.H3Sheet; H.W.sheets[0].cells = {}; D.forEach((row, r) => row.forEach((v, c) => H.setRaw(c, r, v))); H.St.book = null; H._.changed(); }, DATA);
    check("✨ AI ▾ is on the spreadsheet's toolbar", await ev(() => { const x = document.getElementById("shAi"); return !!x && x.offsetWidth > 0 && /AI/.test(x.textContent); }));

    // 🪄 first names: the rule found here
    await type("F1", "First"); await type("F2", "John");
    const n0 = asked.length;
    await pick("F2"); await p.keyboard.press("Control+e"); await p.waitForTimeout(250);
    check("🪄 Ctrl+E with one example (John): the rule found here - Mary, Ann, Bob, Li, Sam - no LLM asked", JSON.stringify(await col("F", 3, 7)) === JSON.stringify(["Mary", "Ann", "Bob", "Li", "Sam"]) && asked.length === n0, await col("F", 2, 7));
    check("…the status line says what was filled and the rule", /5 cells of F filled from your example: first word of "Name" \(Proper Case\)/.test(await msg()), await msg());
    await shot("1-flashfill");
    await ev(() => window.H3Sheet.undo());
    check("…one Ctrl+Z takes the 5 back (the example stays)", (await raw("F3")) === "" && (await raw("F7")) === "" && (await raw("F2")) === "John");
    await pick("F2"); await p.keyboard.press("Control+e"); await p.waitForTimeout(200);

    // 🪄 totals: the LLM's formula, checked here
    await type("G1", "Total"); await type("G2", "12.5"); await type("G3", "30");
    await pick("G3");
    const fillG = await ev(() => window.H3SheetAI.fillFromExamples());
    const qG = asked.filter((a) => /The column to fill: G/.test(a));
    check("🪄 totals: no rule of words - the LLM's first formula (=D2+E2) gave 7.5, not 12.5, so it was asked again with why", qG.length === 2 && /=D2\+E2 gave "7\.5" in row 2 \(wanted "12\.5"\)/.test(qG[1]) && /row 2: .*D="5", E="2\.5".*->  G="12\.5"/.test(qG[0]), qG.map((x) => x.slice(-500)));
    check("…its second (=D2*E2) gives both examples, so it fills the empty rows as formulas", fillG && fillG.how === "formula" && (await raw("G4")) === "=D4*E4" && (await raw("G7")) === "=D7*E7" && JSON.stringify(await col("G", 4, 7)) === JSON.stringify(["8", "15", "99", "2"]) && (await raw("G2")) === "12.5", [fillG, await raw("G4"), await col("G", 4, 7)]);
    check("…the status line names the formula", /with a formula that gives every example: =D2\*E2/.test(await msg()), await msg());

    // 🪄 tiers: no formula fits - the LLM's values
    await type("H1", "Tier"); await type("H2", "Big"); await type("H3", "Small");
    await pick("H2");
    const fillH = await ev(() => window.H3SheetAI.fillFromExamples());
    check("🪄 tiers: no formula gave the examples (asked twice) - the LLM fills the values, called its guess", fillH && fillH.how === "values" && JSON.stringify(await col("H", 4, 7)) === JSON.stringify(["Small", "Big", "Small", "Small"]) && /its guess, check them/.test(await msg()), [fillH, await col("H", 4, 7), await msg()]);
    check("…the LLM was told the rows to fill (their cells), never the whole table for a formula", asked.some((a) => /The rows to fill:\nrow 4: /.test(a)) && !asked.filter((a) => /Find the rule/.test(a)).some((a) => /sam@q\.com/.test(a)));
    await shot("2-filled");

    // ✍ Write a formula… from the ✨ AI ▾ menu
    await pick("D9");
    await p.click("#shAi"); await p.waitForSelector('.shmenu [data-ai="write"]'); await ev(() => document.querySelector('.shmenu [data-ai="write"]').click());
    await p.waitForSelector("#shAiDlg[open]");
    await p.fill("#shaiAsk", "the total of the units"); await p.click("#shaiGo");
    await p.waitForFunction(() => !document.getElementById("shaiOut").hidden, null, { timeout: 15000 });
    const w1 = await ev(() => ({ f: document.getElementById("shaiF").value, res: document.getElementById("shaiRes").textContent, why: document.getElementById("shaiWhy").textContent, put: document.getElementById("shaiPut").textContent, down: !document.getElementById("shaiDownBox").hidden }));
    check("✍ the LLM's formula, worked out here before it goes in: =SUM(D2:D7) = 25, its reason, Put it in D9 (no Fill down under a total)", w1.f === "=SUM(D2:D7)" && w1.res === "= 25" && /Adds up/.test(w1.why) && w1.put === "Put it in D9" && !w1.down, w1);
    const qW = asked.filter((a) => /You write spreadsheet formulas/.test(a)).pop();
    check("…the LLM was told the columns (headings, kinds, a few values), the cell and what was asked", /column D "Units": numbers/.test(qW) && /The formula goes in cell D9/.test(qW) && /the total of the units/.test(qW) && !/li wei chen/.test(qW), qW.slice(0, 1200));
    await p.fill("#shaiF", "=SUM(D2:D7)/0");
    check("…a changed formula is worked out again as you type (an error said)", /#DIV\/0!/.test(await ev(() => document.getElementById("shaiRes").textContent)) && (await ev(() => document.getElementById("shaiRes").classList.contains("bad") && /check the cells it reads/.test(document.getElementById("shaiResWhy").textContent))));
    await p.fill("#shaiF", "=SUM(D2:D7)");
    await shot("3-write");
    await p.click("#shaiPut");
    check("…Put it in: D9 = 25, the dialog closed", (await raw("D9")) === "=SUM(D2:D7)" && (await S("D9")) === "25" && !(await ev(() => document.getElementById("shAiDlg").open)));
    await ev(() => window.H3Sheet.undo());
    check("…one undo takes it out", (await raw("D9")) === "");

    // ✍ a per-row formula + Fill down
    await type("I1", "Gross"); await pick("I2");
    await ev(() => window.H3SheetAI.openWrite());
    await p.fill("#shaiAsk", "gross: units times price plus 10%"); await p.keyboard.press("Enter");
    await p.waitForFunction(() => !document.getElementById("shaiOut").hidden, null, { timeout: 15000 });
    const w2 = await ev(() => ({ f: document.getElementById("shaiF").value, res: document.getElementById("shaiRes").textContent, down: !document.getElementById("shaiDownBox").hidden, on: document.getElementById("shaiDown").checked, l: document.getElementById("shaiDownL").textContent }));
    check("✍ a formula for one row (=D2*E2*1.1 = 13.75) offers Fill down the table's rows (to row 7), ticked", w2.f === "=D2*E2*1.1" && w2.res === "= 13.75" && w2.down && w2.on && /to row 7/.test(w2.l), w2);
    await p.click("#shaiPut");
    check("…Put it in + Fill down: I2:I7 each its own row, one step", (await raw("I7")) === "=D7*E7*1.1" && (await S("I5")) === "16.5" && /I2 \+ 5 rows below/.test(await msg()), [await raw("I7"), await S("I5"), await msg()]);

    // 💡 Explain from the cell's right-click menu
    await pick("I2");
    const box = await ev(() => { const H = window.H3Sheet, g = document.getElementById("shGrid").getBoundingClientRect(), cell = document.querySelector("#shPane .c.act, #shPane .act") || null; return { x: g.left + 300, y: g.top + 120, cell: !!cell }; });
    await ev(({ x, y }) => { const pane = document.getElementById("shPane"); pane.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y })); }, box);
    const menuHas = await ev(() => [...document.querySelectorAll(".shmenu [data-a]")].map((d) => d.dataset.a));
    check("the cell's right-click menu has ✍ Write a formula… / 💡 Explain this formula / 🪄 Fill from examples", ["aiWrite", "aiExplain", "aiFill"].every((k) => menuHas.includes(k)), menuHas);
    await ev(() => document.querySelector('.shmenu [data-a="aiExplain"]').click());
    await p.waitForFunction(() => /multiplies/.test(document.getElementById("shaiText").textContent), null, { timeout: 15000 });
    const x1 = await ev(() => ({ fx: document.getElementById("shaiFx").textContent, refs: document.getElementById("shaiRefs").textContent, text: document.getElementById("shaiText").textContent }));
    check("💡 Explain: the formula and its result, what it reads now (D2 = 5, E2 = 2.5), the LLM's plain words", /I2\s+=D2\*E2\*1\.1\s+→\s+13\.75/.test(x1.fx) && /D25/.test(x1.refs.replace(/\s/g, "")) && /E22\.5/.test(x1.refs.replace(/\s/g, "")) && /^It multiplies/.test(x1.text) && /- E2: the price/.test(x1.text), x1);
    await shot("4-explain");
    await ev(() => document.getElementById("shAiDlg").close());
    await pick("A2"); await ev(() => window.H3SheetAI.openExplain());
    check("💡 on a cell with no formula: said, no dialog", /has no formula to explain/.test(await msg()) && !(await ev(() => document.getElementById("shAiDlg").open)));

    // the LLM down
    await api("POST", "api/config", { llm: { external_url: "http://127.0.0.1:9/v1/chat/completions", external_model: "gone" } });
    await type("J1", "Sum"); await type("J2", "7.5");
    await pick("J2"); const before = await raw("J3");
    const fillJ = await ev(() => window.H3SheetAI.fillFromExamples());
    check("🪄 with the LLM down: said, nothing changed", fillJ === null && /✗ the LLM/.test(await msg()) && (await raw("J3")) === before, await msg());
    check("ƒ▾ lists the new functions (PROPER, TEXTJOIN, MAXIFS, EOMONTH, SWITCH …)", await ev(() => ["PROPER", "TEXTJOIN", "MAXIFS", "EOMONTH", "SWITCH", "IFNA"].every((f) => window.SheetCalc.FUNCS.includes(f))));
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e)); }
  finally {
    try { await api("POST", "api/config", { llm: llm0 }); } catch (e) { /* fine */ }
    try { await ev(() => { const d = document.getElementById("sheetdock"); d.style.cssText = d.dataset.t825css || ""; document.querySelectorAll("[data-t825]").forEach((x) => { x.style.display = x.dataset.t825; delete x.dataset.t825; }); localStorage.removeItem("h3.sheet.draft"); if (!d.classList.contains("dockgone")) toggleDockGone("sheetdock", "tX_sheetdock"); }); } catch (e) { /* fine */ }
    await b.close(); llm.close();
    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
