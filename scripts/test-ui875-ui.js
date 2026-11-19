#!/usr/bin/env node
/* bitGen Studio — 2.875.0 in a REAL browser: the image editor's ✨ Create ▸ 💳 Business card opens the Business details dialog
 * (company, name, role, phone, email, website, address, services, the logo, brand colours, front + back; a ✕ top right);
 * ✨ Create keeps the details in business/profiles.json and makes the card with them + the logo on both sides; ✉ Letterhead opens
 * the dialog filled with the details kept (no back) and lays an A4 letterhead with a WP frame for the letter; 🪧 a poster is A3;
 * a text picked brings Properties up; every dialog has a ✕ (File ▸ New's box closes with it). The plan is answered by the test. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const LOGO = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=", "base64");
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui875-")); fs.writeFileSync(path.join(tmp, "logo.png"), LOGO);
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
      const pal = { bg: "#fff7ed", accent: "#b45309", ink: "#3b2f2f", accentInk: "#ffffff" };
      const plans = { card: { kind: "card", name: "Rosie Smith", role: "Owner", company: "Rosie's Bakery", tagline: "Baked at dawn", phone: "0412 345 678", email: "hello@rosies.example", web: "", address: "", back: { heading: "What we bake", text: "Bread · Cakes" }, services: ["Bread", "Cakes"], palette: pal },
        letterhead: { kind: "letterhead", company: "Rosie's Bakery", tagline: "Baked at dawn", contact: "12 Main St  ·  0412 345 678", footer: "Bread  ·  Cakes", palette: pal },
        poster: { kind: "poster", headline: "Big Bake Day", subheadline: "Saturday", body: "Come along.", bullets: ["Bread"], cta: "Visit us", contact: "0412 345 678", footer: "", palette: pal, picture: "bread" } };
      const f0 = window.fetch; window.__plans = [];
      window.fetch = async (u, o) => { if (String(u).includes("/api/create/plan")) { const j = JSON.parse(o.body); window.__plans.push(j); return new Response(JSON.stringify({ plan: plans[j.kind] }), { headers: { "Content-Type": "application/json" } }); } return f0(u, o); };
    });
    // ✨ Create ▸ 💳 Business card
    await p.click('#pcQuickBar [data-qcmd="file.createai"]'); await p.waitForTimeout(300);
    await p.fill("#pccrAsk", "for the Saturday market");
    await p.click('.pccr-k:has(input[value="card"])');
    await p.waitForSelector("#pcbzCompany", { timeout: 10000 }); await p.waitForTimeout(500);
    const d0 = await ev(() => { const d = document.querySelector(".kxdlg.pcd"); return { t: d.querySelector("h4").textContent, back: !!d.querySelector("#pcbzBack"), x: !!d.querySelector(":scope > .h3dlgx"), front: d.querySelector("#pcbzFront").value, labels: [...d.querySelectorAll(".pcbz-f > span")].map((s) => s.textContent) }; });
    check("💳 Business card opens the Business details dialog: company, name, role, phone, email, website, address, services, front + back of the card, a ✕ top right; the words typed go to the front",
      /Business card - your business details/.test(d0.t) && d0.back && d0.x && d0.front === "for the Saturday market"
      && ["Company name", "Your name", "Role / title", "Phone number", "Email", "Website", "Address", "Services - one a line"].every((l) => d0.labels.includes(l)), d0);
    await p.fill("#pcbzCompany", "Rosie's Bakery UI875"); await p.fill("#pcbzName", "Rosie Smith"); await p.fill("#pcbzRole", "Owner");
    await p.fill("#pcbzPhone", "0412 345 678"); await p.fill("#pcbzEmail", "hello@rosies.example"); await p.fill("#pcbzAddr", "12 Main St\nSpringfield");
    await p.fill("#pcbzServ", "Sourdough\nCakes\nWholesale"); await p.fill("#pcbzBack", "the logo in the middle");
    await p.setInputFiles("#pcbzLogoFile", path.join(tmp, "logo.png"));
    await p.waitForSelector("#pcbzLogoPv img", { timeout: 5000 });
    await ev(() => { const c = document.getElementById("pcbzCol0"); c.value = "#b45309"; c.dispatchEvent(new Event("input", { bubbles: true })); });
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => { const E = window.imageEditorInstance.E; return E.pages.count() === 2 && E.S.layers.some((l) => l.name === "Logo"); }, null, { timeout: 20000 });
    const kept = await ev(async () => { const j = await (await fetch("/api/business/profiles")).json(); return j.profiles.find((x) => x.id === j.last); });
    if (kept) made.push(kept.id);
    const sent = await ev(() => window.__plans[window.__plans.length - 1]);
    check("✨ Create keeps every detail (business/profiles.json): services one a line, the ticked colour, the logo file, front + back",
      kept && kept.company === "Rosie's Bakery UI875" && kept.address === "12 Main St\nSpringfield" && kept.services.join() === "Sourdough,Cakes,Wholesale" && kept.colours.join() === "#b45309" && !!kept.logo_url && kept.back === "the logo in the middle", kept);
    check("...the plan is asked with the business (and the typed words)", sent.kind === "card" && sent.business && sent.business.phone === "0412 345 678" && sent.ask === "for the Saturday market", sent);
    const card = await ev(() => { const E = window.imageEditorInstance.E, f = E.S.layers.filter((l) => l.name === "Logo").length; E.pages.go(1); const bk = E.S.layers.filter((l) => l.name === "Logo").length, words = E.S.layers.filter((l) => l.type === "text").map((l) => l.text.str); E.pages.go(0); return { f, bk, words, names: E.pages.list().map((x) => x.name) }; });
    check("...the card: Front + Back, the logo on both, the back's words", card.f === 1 && card.bk === 1 && card.words.includes("What we bake") && card.names.join() === "Front,Back", card);
    // ✉ Letterhead: the dialog filled with what was kept
    await p.click('#pcQuickBar [data-qcmd="file.createai"]'); await p.waitForTimeout(300);
    await p.click('.pccr-k:has(input[value="letterhead"])');
    await p.waitForFunction(() => document.getElementById("pcbzCompany") && document.getElementById("pcbzCompany").value, null, { timeout: 10000 });
    const d1 = await ev(() => ({ c: document.getElementById("pcbzCompany").value, back: !!document.getElementById("pcbzBack"), logo: !!document.querySelector("#pcbzLogoPv img"), pick: document.getElementById("pcbzPick").selectedOptions[0].textContent, col: document.getElementById("pcbzCon0").checked }));
    check("✉ Letterhead: the dialog comes filled with the details kept (the logo, the colour, ▾ picked), no back", d1.c === "Rosie's Bakery UI875" && !d1.back && d1.logo && /Rosie's Bakery UI875 - Rosie Smith/.test(d1.pick) && d1.col, d1);
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => { const E = window.imageEditorInstance.E; return E.S.w === 1240 && E.S.layers.some((l) => l.type === "doc") && E.S.layers.some((l) => l.name === "Logo"); }, null, { timeout: 20000 });
    const lh = await ev(() => { const E = window.imageEditorInstance.E; return { n: E.pages.count(), h: E.S.h, texts: E.S.layers.filter((l) => l.type === "text").map((l) => l.text.str), doc: E.S.layers.filter((l) => l.type === "doc").length }; });
    check("...an A4 letterhead (1240 × 1754): the logo, the company, the contact line, a WP frame for the letter", lh.n === 1 && lh.h === 1754 && lh.texts.includes("Rosie's Bakery") && lh.texts.includes("12 Main St  ·  0412 345 678") && lh.doc === 1, lh);
    // 🪧 poster
    await ev(async () => { const E = window.imageEditorInstance.E; await E.create.make({ kind: "poster", ask: "", business: await E.bizInfo.last() }); });
    const po = await ev(() => { const E = window.imageEditorInstance.E; return { w: E.S.w, h: E.S.h, logo: E.S.layers.some((l) => l.name === "Logo") }; });
    check("🪧 a poster: A3 at 150 dpi (1754 × 2480) with the logo (the kept details from the prompt docker's way in)", po.w === 1754 && po.h === 2480 && po.logo, po);
    // Properties for a text
    await ev(() => { const E = window.imageEditorInstance.E; E.ui.showTab("pcHistory"); E.ui.showTab("pcLayers"); const pr = document.querySelector('#imageeditdock .pctabs [data-tab="pcProps"]'); const g = pr && pr.closest(".pcgrp"); g && g.querySelectorAll(".pctabs button").forEach((b) => { if (b !== pr) b.click(); }); });
    const before = await ev(() => { const pr = document.querySelector('#imageeditdock .pctabs [data-tab="pcProps"]'); return pr.classList.contains("on"); });
    await ev(() => { const E = window.imageEditorInstance.E, i = E.S.layers.findIndex((l) => l.type === "text"); E.setActive(i); });
    const after = await ev(() => document.querySelector('#imageeditdock .pctabs [data-tab="pcProps"]').classList.contains("on"));
    check("a text picked: the Properties tab comes to the front", after && (before === false || before === true), { before, after });
    // ✕ on the editor's own boxes
    await p.click('#pcQuickBar [data-qcmd="file.new"]'); await p.waitForTimeout(400);
    const nx = await ev(() => !!document.querySelector(".kxdlg.pcd > .h3dlgx"));
    await p.click(".kxdlg.pcd > .h3dlgx"); await p.waitForTimeout(200);
    check("File ▸ New's box has a ✕ top right, and it closes it", nx && !(await ev(() => !!document.querySelector(".kxdlg.pcd"))));
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally {
    for (const id of made) { try { await fetch(URL_ + "api/business/profiles/" + id, { method: "DELETE" }); } catch { /* gone */ } }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
