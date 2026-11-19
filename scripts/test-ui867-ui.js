#!/usr/bin/env node
/* bitGen Studio — 2.867.0 in a REAL browser: 🎛 the element properties docker - a click on the WYSIWYG page picks an element (dashed),
 * its values shown; each corner's radius, 🔗 all four, a shadow, opacity, a background gradient, colour and text go into its style="", the
 * page marked changed, the pick mark never saved; ⬆ parent, ✕ Clear styles, folded. Against the running app (H3_URL). */
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
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const api = (u, body) => fetch(new URL(u, URL_), body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}).then((r) => r.json());
  try {
    await fetch(new URL("/api/web/create", URL_), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    await fetch(new URL("/api/web/file", URL_), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: "p867.html", text: "<!DOCTYPE html><html><head><title>t</title></head><body><main><section class=\"box\"><h1>Title</h1><p id=\"para\">Hello there</p></section></main></body></html>" }) });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Web && window.WbProps, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => document.getElementById("tX_webdock").click());
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("webdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await p.waitForSelector('#wbTree .it[data-p="p867.html"]', { timeout: 15000 });
    await p.click('#wbTree .it[data-p="p867.html"]'); await p.waitForTimeout(300);
    await p.click('#webdock .wbtab[data-tab="wys"]'); await p.waitForTimeout(800);
    const v0 = await ev(() => ({ shown: getComputedStyle(document.getElementById("wbProps")).display !== "none", off: document.getElementById("wbPropsBody").classList.contains("off") }));
    await p.frameLocator("#wbWys").locator("#para").click();
    const v1 = await ev(() => ({ what: document.getElementById("wbPropsWhat").textContent, picked: document.getElementById("wbWys").contentDocument.querySelector("#para").hasAttribute("data-bg-picked"), fs: document.getElementById("wbP_fs").value }));
    check("🎛 Properties beside the WYSIWYG page; a click picks <p#para> (dashed), its font size shown", v0.shown && v0.off && v1.what === "<p#para>" && v1.picked && +v1.fs > 0, { v0, v1 });
    const setv = (id, val) => ev(([i, v]) => { const e = document.getElementById("wbP_" + i); if (e.type === "checkbox") e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.type === "checkbox" || e.tagName === "SELECT" ? "change" : "input", { bubbles: true })); }, [id, val]);
    await setv("rlink", false); await setv("rtl", 20); await setv("rbr", 4);
    await setv("sh", true); await setv("shy", 8); await setv("shb", 20);
    await setv("op", 0.8);
    await setv("grad", true); await setv("gang", 90); await setv("gc1", "#ff0000"); await setv("gc2", "#0000ff");
    await setv("tc", "#112233"); await setv("ta", "center");
    const st = await ev(() => { const e = document.getElementById("wbWys").contentDocument.querySelector("#para"); return e.getAttribute("style") + " | " + ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"].map((k) => e.style[k]).join(","); });
    check("each corner on its own (top-left 20, bottom-right 4), a shadow, opacity .8, a linear gradient red -> blue at 90°, the text colour + centred - in its style=\"\"", /\| 20px,0px,4px,0px$/.test(st) && /box-shadow: [^;]*8px 20px/.test(st) && /opacity: 0\.8/.test(st) && /linear-gradient\(90deg, (rgb\(255, 0, 0\)|#ff0000) 0%, (rgb\(0, 0, 255\)|#0000ff) 100%\)/.test(st) && /color: (rgb\(17, 34, 51\)|#112233)/.test(st) && /text-align: center/.test(st), st);
    await setv("rlink", true); await setv("rtl", 12);
    const st2 = await ev(() => { const e = document.getElementById("wbWys").contentDocument.querySelector("#para"); return ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"].map((k) => e.style[k]).join(","); });
    check("🔗 all four: one value for every corner", st2 === "12px,12px,12px,12px", st2);
    const code = await ev(() => window.H3Web.currentText());
    check("the page marked changed; the saved text has the styles and NOT the pick mark", await ev(() => document.getElementById("wbFileName").classList.contains("dirty")) && /<p id="para" style="[^"]*border-radius: 12px/.test(code) && !/data-bg-picked/.test(code), code.slice(code.indexOf("<main>"), code.indexOf("</main>")));
    await p.click("#wbPropsUp");
    check("⬆ picks the parent <section.box>", await ev(() => document.getElementById("wbPropsWhat").textContent === "<section.box>"));
    await p.frameLocator("#wbWys").locator("#para").click(); await p.click("#wbPropsClear");
    check("✕ Clear styles takes the element's own styles off", await ev(() => !document.getElementById("wbWys").contentDocument.querySelector("#para").hasAttribute("style")));
    await p.click("#wbPropsFold");
    check("▸ folds the docker to a strip", await ev(() => document.getElementById("wbProps").getBoundingClientRect().width < 40));
    await p.click("#wbPropsFold");
    await p.click('#webdock .wbtab[data-tab="code"]'); await p.waitForTimeout(200);
    check("...on the Code tab it is not shown", await ev(() => getComputedStyle(document.getElementById("wbProps")).display === "none"));
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
