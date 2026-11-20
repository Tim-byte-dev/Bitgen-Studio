#!/usr/bin/env node
/* bitGen Studio — 2.893.0 in a REAL browser: (1) the image editor's business card details box is wider (860 px) with every input
 * inside its frame and ☑ 🖼 Backgrounds; the card's front / back backgrounds are made from the descriptions (the picture job is
 * answered by the test) and lie under the words; (2) 📒 Accounts ▸ 👷 Pay summary… - the year, a row per person, another year,
 * the 🖨 page for one person.
 * Tim (verbatim): "continue next. with the business card descriptions in image-editor , use them as prompts for the background for
 * the front an back, make the dialog wider, the input boxes go past the dialog frame" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1800, height: 1100 } }), p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const made = [], BIZ = "ui893" + Date.now().toString(36);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.bizInfo && window.imageEditorInstance.E.create && window.H3Accounts, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await ev(() => {
      const E = window.imageEditorInstance.E;
      try { E.store.set("create.cardSize", ""); E.store.set("create.cardBgs", "1"); } catch (e) { /* none */ }
      const pal = { bg: "#fff7ed", accent: "#b45309", ink: "#3b2f2f", accentInk: "#ffffff" };
      window.__pics = [];
      const f0 = window.fetch;
      window.fetch = async (u, o) => {
        if (String(u).includes("/api/create/plan")) {
          const j = JSON.parse(o.body), bz = j.business || {};
          // the server's applyBusiness makes these from the descriptions (scripts/test-893.js) - here the same words come back
          const plan = { kind: "card", name: "Rosie Smith", role: "Owner", company: "Rosie's Bakery", tagline: "", phone: "0412 345 678", email: "", web: "", address: "", back: { heading: "What we bake", text: "Bread" }, services: ["Bread"], palette: pal,
            frontBg: bz.front ? "FRONT: " + bz.front : "", backBg: bz.back ? "BACK: " + bz.back : "" };
          return new Response(JSON.stringify({ plan }), { headers: { "Content-Type": "application/json" } });
        }
        return f0(u, o);
      };
      // the picture job answered here: a plain tile in the description's colour
      E.docAi.picture = async (prompt, w, h) => { window.__pics.push({ prompt, w, h }); const c = document.createElement("canvas"); c.width = 64; c.height = 40; const g = c.getContext("2d"); g.fillStyle = /^FRONT/.test(prompt) ? "#3a7d44" : "#5b2a86"; g.fillRect(0, 0, 64, 40); return c.toDataURL(); };
    });
    await p.click('#pcQuickBar [data-qcmd="file.createai"]'); await p.waitForTimeout(300);
    await p.click('.pccr-k:has(input[value="card"])');
    await p.waitForSelector("#pcbzFront", { timeout: 10000 }); await p.waitForTimeout(600);
    const box = await ev(() => {
      const d = document.querySelector(".kxdlg.pcd"), r = d.getBoundingClientRect();
      const out = [...d.querySelectorAll("input:not([type=file]):not([type=checkbox]):not([type=color]),textarea,select")].filter((x) => x.offsetParent).map((x) => { const q = x.getBoundingClientRect(); return { id: x.id, l: q.left - r.left, rr: r.right - q.right }; });
      return { w: Math.round(r.width), past: out.filter((x) => x.l < 0 || x.rr < 0), n: out.length, bgs: !!document.getElementById("pcbzBgs") && document.getElementById("pcbzBgs").checked,
        lbl: document.getElementById("pcbzFront").closest("label").querySelector("span").textContent, scrolls: getComputedStyle(d.querySelector(".pcdb")).overflowY };
    });
    check("💳 the details box is wider (860 px) and every box stays inside its frame; ☑ 🖼 Backgrounds; the front's label says its background is made from it",
      box.w === 860 && box.n > 10 && box.past.length === 0 && box.bgs && /background is made from this/.test(box.lbl) && box.scrolls === "auto", box);
    await p.fill("#pcbzCompany", "Rosie's Bakery UI893"); await p.fill("#pcbzName", "Rosie Smith");
    await p.fill("#pcbzFront", "warm cream linen with soft wheat stalks"); await p.fill("#pcbzBack", "deep brown with a thin gold border");
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => window.__pics.length === 2 && /made/.test(document.body.innerText) && window.imageEditorInstance.E.pages.count() === 2, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    const r = await ev(async () => {
      const E = window.imageEditorInstance.E, sides = [];
      for (let i = 0; i < 2; i++) {
        E.pages.go(i); await new Promise((ok) => setTimeout(ok, 200));
        const L = E.S.layers, bi = L.findIndex((x) => /background$/.test(x.name)), ti = L.map((x, k) => (x.type === "text" ? k : -1)).filter((k) => k >= 0);
        const bg = L[bi], px = bg && bg.canvas.getContext("2d").getImageData(Math.round(E.S.w / 2), Math.round(E.S.h * 0.3), 1, 1).data;
        sides.push({ name: bg && bg.name, bi, minText: Math.min(...ti), px: px && [...px].slice(0, 3), type: bg && bg.type, placeholders: L.filter((x) => x.type === "shape" && /🖼/.test(x.name)).length });
      }
      E.pages.go(0);
      return { pics: window.__pics, sides };
    });
    check("✨ Create: two background jobs - the front's description and the back's as the prompts, at the card's size",
      r.pics.length === 2 && r.pics[0].prompt === "FRONT: warm cream linen with soft wheat stalks" && r.pics[1].prompt === "BACK: deep brown with a thin gold border" && r.pics[0].w === 1063 && r.pics[0].h === 650, r.pics);
    check("...each side's background picture is laid in (front green, back purple), named, UNDER every text layer; no stand-in left",
      r.sides[0].name === "🖼 Front background" && r.sides[1].name === "🖼 Back background" && r.sides.every((s) => s.bi >= 0 && s.bi < s.minText && s.placeholders === 0)
      && r.sides[0].px.join() === "58,125,68" && r.sides[1].px.join() === "91,42,134", r.sides);
    const kept = await ev(async () => { const j = await (await fetch("/api/business/profiles")).json(); return j.profiles.find((x) => x.id === j.last); });
    if (kept) made.push(kept.id);
    // unticked: the colours as before, no job
    await p.click('#pcQuickBar [data-qcmd="file.createai"]'); await p.waitForTimeout(300);
    await p.click('.pccr-k:has(input[value="card"])');
    await p.waitForSelector("#pcbzBgs", { timeout: 10000 }); await p.waitForTimeout(600);
    await ev(() => { window.__pics = []; });
    await p.uncheck("#pcbzBgs"); await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => /laid out as layers/.test(document.body.innerText), null, { timeout: 20000 }); await p.waitForTimeout(1200);
    const off = await ev(() => ({ n: window.__pics.length, kept: window.imageEditorInstance.E.store.get("create.cardBgs", "") }));
    check("☐ Backgrounds unticked: no picture job, the colours as before - and the choice is kept", off.n === 0 && off.kept === "0", off);
    await ev(() => { window.imageEditorInstance.E.store.set("create.cardBgs", "1"); });

    // ---- 👷 Pay summary
    await ev(() => { const d = document.getElementById("imageeditdock"); d.style.display = "none"; if (H3Layouts.isOff({ kind: "dock", id: "acctdock" })) H3Layouts.set({ kind: "dock", id: "acctdock" }, false); });
    await p.waitForTimeout(300);
    await ev(async (biz) => {
      const d = document.getElementById("acctdock"); if (d.classList.contains("dockgone")) document.getElementById("tX_acctdock").click();
      d.style.cssText += ";position:fixed;left:10px;top:40px;width:1700px;height:1000px;z-index:9999";
      const S = H3Accounts.state(); S.biz = biz;
      const pay = (employee, date, gross, tax) => fetch("/api/accounts/payrun", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ biz, pay: { employee, date, gross, tax } }) });
      await pay("Sam Lee", "2026-07-03", 1200, 150); await pay("Sam Lee", "2026-07-10", 1300, 170); await pay("Alex Wu", "2026-09-01", 2000, 400); await pay("Sam Lee", "2026-06-20", 1000, 100);
      await H3Accounts.refresh(); await H3Accounts.show("journals");
    }, BIZ);
    await p.click("#acPaySum"); await p.waitForSelector("#acpsFy", { timeout: 10000 });
    await ev(() => { const s = document.getElementById("acpsFy"); s.value = "2027"; s.dispatchEvent(new Event("change")); });
    await p.waitForFunction(() => document.querySelectorAll(".acps-tab tr").length === 4, null, { timeout: 8000 });
    const ps = await ev(() => ({ t: document.getElementById("acDlgT").textContent, years: [...document.querySelectorAll("#acpsFy option")].map((o) => o.value), rows: [...document.querySelectorAll(".acps-tab tr")].map((r) => r.textContent) }));
    check("👷 Pay summary…: the years with pay runs, FY 2026-27 = Alex Wu + Sam Lee (2 pays, gross 2,500.00, tax 320.00) and the total",
      ps.t === "👷 Payment summaries" && ps.years.includes("2027") && ps.years.includes("2026") && /Alex Wu1/.test(ps.rows[1]) && /Sam Lee2/.test(ps.rows[2]) && /2,500\.00/.test(ps.rows[2]) && /320\.00/.test(ps.rows[2]) && /^Total3/.test(ps.rows[3]), ps);
    await ev(() => { const s = document.getElementById("acpsFy"); s.value = "2026"; s.dispatchEvent(new Event("change")); });
    await p.waitForFunction(() => document.querySelectorAll(".acps-tab tr").length === 3, null, { timeout: 8000 });
    check("...FY 2025-26: Sam's June pay only", await ev(() => /Sam Lee1/.test(document.querySelectorAll(".acps-tab tr")[1].textContent)));
    await ev(() => { const s = document.getElementById("acpsFy"); s.value = "2027"; s.dispatchEvent(new Event("change")); });
    await p.waitForFunction(() => document.querySelectorAll(".acps-tab tr").length === 4, null, { timeout: 8000 });
    const [pop] = await Promise.all([ctx.waitForEvent("page", { timeout: 10000 }), p.click('[data-psprint="Sam Lee"]')]);
    await pop.waitForLoadState("domcontentloaded");
    const page = await pop.evaluate(() => ({ sheets: document.querySelectorAll(".sheet").length, txt: document.body.innerText }));
    check("🖨 Sam Lee's page: one sheet - Payment summary, FY 2026-27, his two pays, gross $2,500.00, the Single Touch Payroll note",
      page.sheets === 1 && /Payment summary/i.test(page.txt) && /FY 2026-27/.test(page.txt) && /Sam Lee/.test(page.txt) && !/Alex Wu/.test(page.txt) && /\$2,500\.00/.test(page.txt) && /Single Touch Payroll/.test(page.txt), page.txt.slice(0, 400));
    await pop.close();
    await ev(() => document.getElementById("acDlgCancel").click());
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally {
    for (const id of made) { try { await fetch(URL_ + "api/business/profiles/" + encodeURIComponent(id), { method: "DELETE" }); } catch { /* left */ } }
    try { require("fs").rmSync(path.join(process.env.H3_ROOT || "/tmp/t819", "accounting", BIZ), { recursive: true, force: true }); } catch { /* left */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
