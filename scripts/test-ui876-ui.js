#!/usr/bin/env node
/* bitGen Studio — 2.876.0 in a REAL browser: the business card's details box has Card size ▾ - Cardboard / paper (Australia
 * 90 × 55 first) and PVC (plastic) CR80 / CR79 / CR90 / CR100; PVC CR80 picked makes an 85.6 × 54 mm card (1011 × 638 at 300 dpi)
 * with round corners, the size kept with the details and chosen again next time; ✉ a letterhead's box has no size. The plan is
 * answered by the test.
 * Tim (verbatim): "in the business card dialog add dropdown for size, cardboard or pvc those are common sizes" */
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
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const made = [];
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.bizInfo && window.imageEditorInstance.E.create, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await ev(() => {
      try { window.imageEditorInstance.E.store.set("create.cardSize", ""); } catch (e) { /* none */ }
      const pal = { bg: "#fff7ed", accent: "#b45309", ink: "#3b2f2f", accentInk: "#ffffff" };
      const plans = { card: { kind: "card", name: "Rosie Smith", role: "Owner", company: "Rosie's Bakery", tagline: "Baked at dawn", phone: "0412 345 678", email: "", web: "", address: "", back: { heading: "What we bake", text: "Bread" }, services: ["Bread"], palette: pal },
        letterhead: { kind: "letterhead", company: "Rosie's Bakery", tagline: "", contact: "0412 345 678", footer: "", palette: pal } };
      const f0 = window.fetch;
      window.fetch = async (u, o) => { if (String(u).includes("/api/create/plan")) { const j = JSON.parse(o.body); return new Response(JSON.stringify({ plan: plans[j.kind] }), { headers: { "Content-Type": "application/json" } }); } return f0(u, o); };
    });
    const openCard = async () => {
      await p.click('#pcQuickBar [data-qcmd="file.createai"]'); await p.waitForTimeout(300);
      await p.click('.pccr-k:has(input[value="card"])');
      await p.waitForSelector("#pcbzSize", { timeout: 10000 }); await p.waitForTimeout(600);
    };
    await openCard();
    const d0 = await ev(() => { const s = document.getElementById("pcbzSize"); return { groups: [...s.querySelectorAll("optgroup")].map((g) => g.label), n: s.options.length, val: s.value, sel: s.selectedOptions[0].textContent,
      pvc: [...s.querySelectorAll('optgroup:nth-of-type(2) option')].map((o) => o.value), label: s.closest(".kxrow").querySelector("span").textContent }; });
    check("💳 the details box: Card size ▾ - Cardboard / paper + PVC (plastic) (CR80 / CR79 / CR90 / CR100), Australia 90 × 55 mm chosen first",
      d0.label === "Card size" && d0.groups.join("|") === "Cardboard / paper|PVC (plastic)" && d0.n === 12 && d0.val === "au" && d0.sel === "Australia / NZ - 90 × 55 mm" && d0.pvc.join() === "cr80,cr79,cr90,cr100", d0);
    await p.fill("#pcbzCompany", "Rosie's Bakery UI876"); await p.fill("#pcbzName", "Rosie Smith"); await p.fill("#pcbzPhone", "0412 345 678");
    await p.selectOption("#pcbzSize", "cr80");
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => { const E = window.imageEditorInstance.E; return E.pages.count() === 2 && E.S.w === 1011; }, null, { timeout: 20000 });
    const c1 = await ev(() => { const E = window.imageEditorInstance.E, bg = E.S.layers.find((l) => l.shape && l.shape.w === E.S.w && l.shape.h === E.S.h);
      return { w: E.S.w, h: E.S.h, names: E.pages.list().map((x) => x.name), r: bg && bg.shape.radius, pg: E.pages.list()[0] && [E.pages.list()[0].wmm, E.pages.list()[0].hmm, E.pages.list()[0].dpi] }; });
    check("PVC CR80 picked: the card is 85.6 × 54 mm at 300 dpi (1011 × 638), Front + Back, its background round-cornered (38 px = 3.18 mm)",
      c1.w === 1011 && c1.h === 638 && c1.names.join() === "Front,Back" && c1.r === 38 && (!c1.pg || (c1.pg[0] === 85.6 && c1.pg[1] === 54 && c1.pg[2] === 300)), c1);
    const kept = await ev(async () => { const j = await (await fetch("/api/business/profiles")).json(); return j.profiles.find((x) => x.id === j.last); });
    if (kept) made.push(kept.id);
    check("...the size is kept with the details (business/profiles.json card_size)", kept && kept.company === "Rosie's Bakery UI876" && kept.card_size === "cr80", kept);
    await openCard();
    await p.waitForFunction(() => document.getElementById("pcbzCompany").value === "Rosie's Bakery UI876", null, { timeout: 10000 });
    const d1 = await ev(() => document.getElementById("pcbzSize").value);
    check("...next time the box comes with CR80 chosen", d1 === "cr80", d1);
    await p.selectOption("#pcbzSize", "us");
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => window.imageEditorInstance.E.S.w === 1050, null, { timeout: 20000 });
    const c2 = await ev(() => { const E = window.imageEditorInstance.E, bg = E.S.layers.find((l) => l.shape && l.shape.w === E.S.w && l.shape.h === E.S.h); return { w: E.S.w, h: E.S.h, r: bg && bg.shape.radius }; });
    check("paper US / Canada picked: 88.9 × 50.8 mm (1050 × 600), square corners", c2.w === 1050 && c2.h === 600 && c2.r === 0, c2);
    await p.click('#pcQuickBar [data-qcmd="file.createai"]'); await p.waitForTimeout(300);
    await p.click('.pccr-k:has(input[value="letterhead"])');
    await p.waitForSelector("#pcbzCompany", { timeout: 10000 }); await p.waitForTimeout(400);
    const lh = await ev(() => !!document.getElementById("pcbzSize"));
    check("✉ a letterhead's box has no Card size", lh === false, lh);
    await ev(() => { const x = document.querySelector(".kxdlg.pcd > .h3dlgx"); if (x) x.click(); });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally {
    for (const id of made) { try { await fetch(URL_ + "api/business/profiles/" + encodeURIComponent(id), { method: "DELETE" }); } catch { /* left */ } }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
