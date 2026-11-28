#!/usr/bin/env node
/* bitGen Studio — 2.849.0 in a REAL browser:
 *   the icon toolbar right under the image editor's menu bar (🗋 📂 💾 💾… 🖨 🔍 ↶ ↷ ✂ ⧉ 📋 ✨), greyed with no document;
 *     🗋 opens New; 🔍 Print Preview: every page of a 2-page document drawn, ◀ ▶, All pages, 🖨 Print = one print job of
 *     both pages at the page's size (the print frame's page);
 *   ✨ Create With the AI: 7 kinds; a 📰 flyer / 💳 business card / 🌐 website laid out as layers from the LLM's plan (the
 *     plan stubbed - this server has no LLM): the flyer's headline / CTA / contact as text layers on A4; the card's 2 pages;
 *     the website's web pages named from the plan.
 * Against the running app (H3_URL). No Playwright = SKIP. */
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
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.quickBar && window.imageEditorInstance.E.create, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    /* ---- the toolbar */
    const bar = await ev(() => { const q = document.getElementById("pcQuickBar"), m = document.querySelector("#imageeditdock .pcmenu"); return q ? { after: q.previousElementSibling === m, icons: [...q.querySelectorAll("[data-qcmd]")].map((b) => b.textContent).join(" "), saveOff: q.querySelector('[data-qcmd="file.savebgi"]').disabled, tip: q.querySelector('[data-qcmd="file.new"]').title, h: q.getBoundingClientRect().height } : null; });
    check("the icon toolbar right under the menu bar: 🗋 📂 💾 💾… 🖨 🔍 ↶ ↷ ✂ ⧉ 📋 ✨ 🪪 👗 (tips with keys; Save greyed with no document)", bar && bar.after && bar.icons === "🗋 📂 💾 💾… 🖨 🔍 ↶ ↷ ✂ ⧉ 📋 ✨ 🪪 👗" && bar.tip === "New (Ctrl+N)" && bar.h > 20, bar);
    await p.click('#pcQuickBar [data-qcmd="file.new"]'); await p.waitForTimeout(300);
    const newDlg = await ev(() => { const d = document.querySelector(".kxdlg.pcd"); return d ? d.querySelector("h4").textContent : null; });
    await ev(() => { const c = document.querySelector(".kxdlg.pcd .cn"); if (c) c.click(); });
    check("🗋 = File ▸ New… (its box opens)", /New/.test(newDlg || ""), newDlg);
    /* ---- 🔍 Print Preview of a 2-page document */
    await ev(() => { const E = window.imageEditorInstance.E; E.pages.newDocument({ preset: "A5", wmm: 148, hmm: 210, orient: "portrait", dpi: 72 }, 2, "PV849"); E.pages.go(1);
      const L = E.makeLayer("red", E.S.w, E.S.h); const g = L.canvas.getContext("2d"); g.fillStyle = "#ff0000"; g.fillRect(0, 0, E.S.w, E.S.h); E.addLayer(L, "t", false); E.pages.go(0); E.refresh(); });
    await p.waitForTimeout(1000);
    const saveOn = await ev(() => !document.querySelector('#pcQuickBar [data-qcmd="file.savebgi"]').disabled);
    await p.click('#pcQuickBar [data-qcmd="file.printpreview"]');
    await p.waitForSelector(".pcpv-sheet img", { timeout: 20000 });
    const pv1 = await ev(() => ({ at: document.getElementById("pcpvAt").textContent, title: document.querySelector(".kxdlg.pcd h4").textContent, sheets: document.querySelectorAll(".pcpv-sheet").length }));
    await p.click("#pcpvNext"); await p.waitForTimeout(200);
    const red = await ev(() => new Promise((ok) => { const im = document.querySelector(".pcpv-sheet img"), c = document.createElement("canvas"); c.width = 4; c.height = 4; const g = c.getContext("2d"); const go = () => { g.drawImage(im, 0, 0, 4, 4); ok([...g.getImageData(2, 2, 1, 1).data]); }; im.complete ? go() : (im.onload = go); }));
    await p.selectOption("#pcpvZoom", "all"); await p.waitForTimeout(200);
    const all = await ev(() => document.querySelectorAll(".pcpv-sheet").length);
    await ev(() => { window.__printed = 0; const o = HTMLIFrameElement.prototype; const d = Object.getOwnPropertyDescriptor(o, "contentWindow"); Object.defineProperty(o, "contentWindow", { configurable: true, get() { const w = d.get.call(this); if (w && !w.__stub) { w.print = () => { window.__printed++; }; w.__stub = 1; } return w; } }); });
    await p.click(".kxdlg.pcd .ok"); await p.waitForTimeout(1200);
    const job = await ev(() => { const f = document.getElementById("pcPrintFrame"), d = f && f.contentDocument; return d ? { pages: d.querySelectorAll(".pg img").length, css: d.querySelector("style").textContent.slice(0, 60), printed: window.__printed } : null; });
    check("🔍 Print Preview: page 1 of 2, ▶ = page 2 as it prints (its red layer), All pages = both; 🖨 Print = one print job of both pages at 148 × 210 mm",
      saveOn && pv1.title === "🔍 Print Preview" && /Page 1 of 2/.test(pv1.at) && red[0] > 200 && red[1] < 60 && all === 2 && job && job.pages === 2 && /size:148mm 210mm/.test(job.css) && job.printed === 1, { pv1, red, all, job });
    /* ---- ✨ Create With the AI (the plan stubbed) */
    await ev(() => {
      const plans = {
        flyer: { kind: "flyer", headline: "Fresh Sourdough", subheadline: "Saturday market", body: "Baked at 4am every Saturday.", bullets: ["Sourdough $8", "Croissants $4"], cta: "Come early", contact: "0412 345 678", footer: "", palette: { bg: "#fffaf0", accent: "#b45309", ink: "#3b2f2f", accentInk: "#ffffff" }, picture: "a loaf" },
        card: { kind: "card", name: "Dr Jane Lee", role: "Dentist", company: "Smile Dental", tagline: "Gentle care", phone: "02 9999 0000", email: "jane@smile.example", web: "", address: "", palette: { bg: "#ffffff", accent: "#0e7490", ink: "#1f2933", accentInk: "#ffffff" } },
        website: { kind: "website", title: "Smile Dental", tagline: "Gentle care", pages: [{ title: "Home", heading: "Gentle dental care", intro: "Hi", sections: [{ heading: "Check-ups", text: "Twice a year." }] }, { title: "Contact", heading: "Find us", intro: "", sections: [] }], contact: "02 9999 0000", palette: { bg: "#ffffff", accent: "#0e7490", ink: "#1f2933", accentInk: "#ffffff" } },
      };
      const f0 = window.fetch; window.fetch = async (u, o) => { if (String(u).includes("/api/create/plan")) { const k = JSON.parse(o.body).kind; window.__asked = (window.__asked || []).concat([k]); return new Response(JSON.stringify({ plan: plans[k] }), { headers: { "Content-Type": "application/json" } }); } return f0(u, o); };
    });
    await p.click('#pcQuickBar [data-qcmd="file.createai"]'); await p.waitForTimeout(300);
    const kinds = await ev(() => [...document.querySelectorAll('.kxdlg.pcd [name="pccrKind"]')].map((r) => r.value).join());
    // 2.875.0: a click on 📰 Flyer opens the Business details dialog (pcbizinfo.js) with what was typed
    await p.fill("#pccrAsk", "A flyer for Rosie's Bakery"); await p.click('.pccr-k:has(input[value="flyer"])');
    await p.waitForSelector("#pcbzCompany", { timeout: 10000 }); await p.waitForTimeout(400);
    await p.fill("#pcbzCompany", "Rosie's Bakery"); await ev(() => { document.getElementById("pcbzPics").checked = false; });
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => window.imageEditorInstance.E.S.layers.some((l) => l.text && l.text.str === "Come early"), null, { timeout: 20000 });
    const fl = await ev(() => { const E = window.imageEditorInstance.E; return { w: E.S.w, h: E.S.h, texts: E.S.layers.filter((l) => l.type === "text").map((l) => l.text.str), boxes: E.S.layers.filter((l) => l.type === "text").every((l) => l.text.box && l.text.box.w > 0), pic: E.S.layers.some((l) => l.name === "🖼 Picture") }; });
    check("✨ Create: 10 kinds (+ letterhead, poster; 3.13.0 + 🧩 layered); 📰 Flyer = an A4 page (1240 × 1754) with the headline, bullets, the call to action and the contact as paragraph text layers + the picture's box", kinds === "document,story,flyer,brochure,card,letterhead,poster,website,invoice,layered" && fl.w === 1240 && fl.h === 1754 && ["Fresh Sourdough", "•  Sourdough $8\n•  Croissants $4", "Come early", "0412 345 678"].every((t) => fl.texts.includes(t)) && fl.boxes && fl.pic, fl);
    await ev(() => window.imageEditorInstance.E.create.make({ kind: "card", ask: "a card for Dr Jane Lee" }));
    const cd = await ev(() => { const E = window.imageEditorInstance.E; return { n: E.pages.count(), names: E.pages.list().map((p) => p.name), w: E.S.w, h: E.S.h, front: E.S.layers.filter((l) => l.type === "text").map((l) => l.text.str) }; });
    check("💳 Business card: 90 × 55 mm at 300 dpi, Front + Back pages, the name and contact on the front", cd.n === 2 && cd.names.join() === "Front,Back" && cd.w === 1063 && cd.h === 650 && cd.front.includes("Dr Jane Lee"), cd);
    // 2.852.0: ✨ Create ▸ 🌐 Website opens 🌐 Build Me a Website (the whole site - test-ui852-ui.js) with the words
    const msg = await ev(() => window.imageEditorInstance.E.create.make({ kind: "website", ask: "a dentist's website" }));
    const ws = await ev(() => { const d = document.querySelector(".kxdlg.pcd"); const r = d ? { t: d.querySelector("h4").textContent, ask: (d.querySelector("#pwaAsk") || {}).value } : null; if (d) d.querySelector(".cn").click(); return r; });
    check("🌐 Website: ✨ Create hands it to 🌐 Build Me a Website - its box opens with the words", ws && /Build Me a Website/.test(ws.t) && ws.ask === "a dentist's website" && /Build Me a Website/.test(msg), { ws, msg });
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
