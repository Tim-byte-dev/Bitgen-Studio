#!/usr/bin/env node
/* bitGen Studio — 2.817.0 against the RUNNING app (+ a real browser): the app strip on the menu bar - 🖼 Editor | 📐
 * SolidCraft 📏 Sketcher, icon only, moved out of the statusbar (same ids), lit while open, a click toggles.
 * Tim (verbatim): "put the button for this on the top menu-strip as icon only, not in the statusbar, add a separator before
 * and after this group of buttons (editor,mail,spreadsheet,slides) then add (solidcraft and sketcher buttons)". No
 * Playwright = SKIP. */
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
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1900, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, x) => p.evaluate(f, x);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    const s = await ev(() => { const st = document.getElementById("appStrip"); return {
      inMenubar: !!st && st.parentElement.id === "menubar", afterProj: !!st && [...st.parentElement.children].indexOf(st) > [...st.parentElement.children].findIndex((c) => c.classList.contains("projbtns")),
      kids: st ? [...st.children].map((c) => c.className + ":" + [...c.children].map((x) => x.id).join(",")) : [],
      sbHas: ["tIE", "tX_pushpulldock", "tX_solidcraftdock"].filter((id) => { const e = document.getElementById(id); return e && e.closest("#statusbar"); }),
      ie: (() => { const e = document.getElementById("tIE"); return { t: e.textContent, title: e.title }; })(),
      sk: (() => { const e = document.getElementById("tX_pushpulldock"); return { t: e.textContent, title: e.title }; })() }; });
    check("the strip sits in the menu bar after the project buttons", s.inMenubar && s.afterProj, s);
    check("| 🖼 Editor ✉ Mail (2.818.0) | 📐 SolidCraft 📏 Sketcher |: separator, group 1, separator, group 2, separator", JSON.stringify(s.kids) === JSON.stringify(["asep:", "asgrp:tIE,tX_maildock", "asep:", "asgrp:tX_solidcraftdock,tX_pushpulldock", "asep:"]), s.kids);
    check("moved out of the statusbar (none left there)", s.sbHas.length === 0, s.sbHas);
    check("icon only, the name in the tooltip", s.ie.t === "🖼" && /Image editor/.test(s.ie.title) && s.sk.t === "📏" && /Sketcher/.test(s.sk.title), s);
    const was = await ev(() => !document.getElementById("imageeditdock").classList.contains("dockgone"));
    await p.click("#tIE"); await p.waitForTimeout(400);
    const now = await ev(() => ({ open: !document.getElementById("imageeditdock").classList.contains("dockgone"), lit: document.getElementById("tIE").classList.contains("on") }));
    check("a click toggles the image editor and the icon is lit while it is open", now.open === !was && now.lit === now.open, { was, now });
    await p.click("#tX_pushpulldock"); await p.waitForTimeout(400);
    const sk = await ev(() => ({ open: !document.getElementById("pushpulldock").classList.contains("dockgone"), lit: document.getElementById("tX_pushpulldock").classList.contains("on") }));
    check("the Sketcher icon toggles the Sketcher, lit with it", sk.lit === sk.open, sk);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran without throwing: " + e.message, false); }
  await b.close();
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
