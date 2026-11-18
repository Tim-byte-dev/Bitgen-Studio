#!/usr/bin/env node
/* bitGen Studio — 2.853.0 in a REAL browser: 🎬 the hero video + 🛒 Product Pictures (the LLM's plan, the picture, film and edit
 * jobs stood in):
 *   🌐 Build Me a Website with 🎬 Hero video ticked = the film job sent with the prompt docker's video style, from the hero photo
 *   (fl2va + the photo as its first frame), 5 s; the hero layer becomes 🎬 hero.mp4 and the built Home page plays it (muted,
 *   looping, the photo as its poster). Then File ▸ 🛒 Product Pictures… lists the shop's products with their pictures; ✏ Edit
 *   sends the picture + the words to the edit model (Qwen picked first), the new one shows beside the old one, ✔ Use it puts it
 *   in the site; 🌐 Build again puts it in admin-schema.sql. The Web ribbon's 🛒 Product Pictures.
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
const PNG = require("fs").readFileSync(path.join(__dirname, "..", "static", "favicon.png"));
const PLAN = { title: "Hero Bakery 853", tagline: "Baked at dawn", palette: { bg: "#fff8f0", accent: "#8b4513", ink: "#2b1d12", accentInk: "#ffffff" },
  contact: { phone: "0412 345 678", email: "", address: "", hours: "" }, video: "slow pan across warm loaves",
  pages: [{ title: "Home", kind: "home", heading: "Fresh every morning", intro: "Sourdough and cakes.", cta: "Order", picture: "a rustic bakery counter", sections: [] },
    { title: "Contact", kind: "contact", heading: "Contact us", intro: "Say hello.", cta: "", picture: "", sections: [] }],
  products: [{ name: "Sourdough loaf", category: "Bread", price: 8.5, description: "Our classic.", picture: "a sourdough loaf" }],
  booking: null, features: { shop: true, booking: false, contact: true, video: true } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  await p.addInitScript(() => { window.__H3_PENDING_AUTO = true; });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  p.on("dialog", (d) => d.dismiss().catch(() => {}));
  let planAsk = null, jobs = 0, film = null, edit = null;
  await p.route("**/api/siteai/plan", async (r) => { planAsk = JSON.parse(r.request().postData() || "{}"); await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ plan: PLAN }) }); });
  await p.route("**/api/genimage", async (r) => { jobs++; await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "t853-" + jobs }) }); });
  await p.route("**/api/generate", async (r) => { const body = r.request().postDataBuffer() || Buffer.alloc(0), s = body.toString("latin1"); const f = (k) => { const m = new RegExp('name="' + k + '"\\r\\n\\r\\n([^\\r]*)').exec(s); return m ? m[1] : null; }; film = { mode: f("mode"), frames: f("frames"), style: f("video_style_id"), w: f("width"), h: f("height"), ref: /name="references"/.test(s), prompt: f("prompt") }; await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "t853v" }) }); });
  await p.route("**/api/aiedit/engines", async (r) => { let j = {}; try { j = await (await r.fetch()).json(); } catch { /* none */ } j.edit = [{ id: "flux-kontext", name: "Flux Kontext" }, { id: "qwen-edit-2511", name: "Qwen Image Edit 2511" }]; await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(j) }); });   // the real answer, the edit list stood in
  await p.route(/\/api\/aiedit$/, async (r) => { const s = (r.request().postDataBuffer() || Buffer.alloc(0)).toString("latin1"); const f = (k) => { const m = new RegExp('name="' + k + '"\\r\\n\\r\\n([^\\r]*)').exec(s); return m ? m[1] : null; }; edit = { mode: f("mode"), style: f("style_id"), prompt: f("prompt"), whole: f("whole"), crop: /name="crop"/.test(s) }; await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mode: "edit", workflow: "x/edit.json", jobs: [{ id: "t853e" }] }) }); });
  await p.route(/\/api\/jobs\/t853(-\d+|e)$/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "done", outputs: ["t853.png"] }) }));
  await p.route(/\/api\/jobs\/t853v$/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "done", outputs: ["t853.mp4"] }) }));
  await p.route("**/outputs/t853.png", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await p.route("**/outputs/t853.mp4", (r) => r.fulfill({ status: 200, contentType: "video/mp4", body: Buffer.from("FAKE-MP4-853") }));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.webAi && window.imageEditorInstance.E.site, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => { document.querySelectorAll(".h3fp.dfm-float, #promptdock").forEach((d) => { d.style.display = "none"; }); const d = document.getElementById("imageeditdock"); d.style.cssText += ";position:fixed;left:10px;top:40px;width:1660px;height:960px;z-index:9999"; });
    await ev(() => { const s = document.getElementById("styleSel"); if (s && !s.value) { const o = document.createElement("option"); o.value = "t853style"; o.textContent = "T853"; s.appendChild(o); s.value = "t853style"; }
      const v = document.getElementById("videoStyleSel"); if (v && !v.value) { const o = document.createElement("option"); o.value = "t853video"; o.textContent = "T853 video"; v.appendChild(o); v.value = "t853video"; } });
    const vstyle = await ev(() => (document.getElementById("videoStyleSel") || {}).value || "");
    await ev(() => window.imageEditorInstance.E.webAi.dialog());
    await p.waitForSelector(".kxdlg.pcd #pwaVideo");
    await p.fill(".kxdlg.pcd #pwaAsk", "a website for my bakery with a shop");
    await p.check(".kxdlg.pcd #pwaVideo"); await p.check(".kxdlg.pcd #pwaShop"); await p.uncheck(".kxdlg.pcd #pwaAi");
    await p.click(".kxdlg.pcd .ok");
    await p.waitForFunction(() => /is built|was not|failed|✗/.test(document.body.innerText) && !window.imageEditorInstance.E.webAi.busy(), null, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(500);
    check("🎬 asked with the plan; the film made with the prompt docker's video style from the hero photo (fl2va, its first frame sent), 5 s = 120 frames, 1280 x 736", planAsk && planAsk.video && film && film.mode === "fl2va" && film.ref && film.frames === "120" && film.style === vstyle && film.w === "1280" && film.h === "736" && /warm loaves/.test(film.prompt), { planAsk, film, vstyle });
    const hero = await ev(() => { const E = window.imageEditorInstance.E; E.pages.go(0); const L = E.S.layers.find((x) => x.webVideo); return L ? { v: L.webVideo, name: L.name } : null; });
    check("the hero picture layer is now 🎬 hero.mp4", hero && hero.v === "hero.mp4" && /^🎬 /.test(hero.name), hero);
    const last = await ev(() => { const l = window.imageEditorInstance.E.webAi.last; return l ? { name: l.site.name, assets: l.assets.map((x) => x.name) } : null; });
    const name = last && last.name;
    const JSZip = require(path.join(__dirname, "..", "node_modules", "jszip"));
    const zipOf = async () => JSZip.loadAsync(Buffer.from(await (await fetch(new URL("/api/sites/zip?name=" + encodeURIComponent(name || "x"), URL_))).arrayBuffer()));
    let zz = await zipOf(); const idx = zz.file("index.php") ? await zz.file("index.php").async("string") : "";
    const poster = (/poster="assets\/([^"]+)"/.exec(idx) || [])[1];
    check("built: Home plays the film muted and looping with the hero photo as its poster; both in assets/", last.assets.includes("hero.mp4") && /<video src="assets\/hero\.mp4" poster="assets\/[^"]+\.jpg" autoplay muted loop playsinline/.test(idx) && !!zz.file("assets/hero.mp4") && !!poster && !!zz.file("assets/" + poster), { assets: last.assets, idx: idx.slice(0, 700) });
    /* ---- 🛒 Product Pictures */
    await ev(() => window.imageEditorInstance.E.ui.runCmd ? window.imageEditorInstance.E.ui.runCmd("file.prodpics") : window.imageEditorInstance.E.webAi.productPictures());
    await p.waitForSelector(".kxdlg.pwpDlg .pwp-r", { timeout: 15000 });
    const dl = await ev(() => { const d = document.querySelector(".kxdlg.pwpDlg"); return { t: d.querySelector("h4").textContent, rows: [...d.querySelectorAll(".pwp-r b")].map((x) => x.textContent), img: !!d.querySelector(".pwp-im img"), st: d.querySelector("#pwpStyle").value }; });
    const imgOk = await ev(() => new Promise((ok) => { const im = document.querySelector(".kxdlg.pwpDlg .pwp-im img"); if (!im) return ok(false); if (im.complete) return ok(im.naturalWidth > 0); im.onload = () => ok(im.naturalWidth > 0); im.onerror = () => ok(false); }));
    check("🛒 Product Pictures: the site's product with its picture (served from the site), the edit model = Qwen Image Edit (picked over the first one)", /Product Pictures/.test(dl.t) && dl.rows.join() === "Sourdough loaf" && dl.img && imgOk && dl.st === "qwen-edit-2511", Object.assign(dl, { imgOk }));
    await p.fill(".kxdlg.pwpDlg .pwp-t", "on a white background");
    await p.click(".kxdlg.pwpDlg .pwp-e");
    await p.waitForSelector(".kxdlg.pwpDlg .pwp-new img", { timeout: 20000 });
    check("✏ Edit: the picture + the words to the edit model (mode edit, the whole picture); the new one beside the old one with ✔ Use it", edit && edit.mode === "edit" && edit.style === "qwen-edit-2511" && edit.prompt === "on a white background" && edit.whole === "1" && edit.crop && await p.isVisible(".kxdlg.pwpDlg .pwp-ok"), edit);
    await p.click(".kxdlg.pwpDlg .pwp-ok");
    await p.waitForFunction(() => /in the website's pictures|✗/.test((document.querySelector(".kxdlg.pwpDlg .pwp-m") || {}).textContent || ""), null, { timeout: 15000 });
    const msg = await ev(() => document.querySelector(".kxdlg.pwpDlg .pwp-m").textContent);
    const pr = await (await fetch(new URL("/api/sites/products?name=" + encodeURIComponent(name), URL_))).json();
    const got = await (await fetch(new URL(`/api/sites/asset?name=${encodeURIComponent(name)}&file=${encodeURIComponent(pr.products[0].image)}`, URL_))).arrayBuffer();
    check("✔ Use it: the edited picture is the product's picture in the site", /in the website's pictures/.test(msg) && Buffer.from(got).equals(PNG), { msg, pr });
    await p.click(".kxdlg.pwpDlg #pwpBuild");
    await p.waitForFunction(() => /built again|🌐 [^\n]*(error|refused)/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
    zz = await zipOf(); const schema = zz.file("admin-schema.sql") ? await zz.file("admin-schema.sql").async("string") : "";
    check("🌐 Build again: the product with its picture in admin-schema.sql and assets/", new RegExp("'" + pr.products[0].image.replace(/\./g, "\\.") + "'").test(schema) && !!zz.file("assets/" + pr.products[0].image), schema.slice(-400));
    await ev(() => { const d = document.querySelector(".kxdlg.pwpDlg"); if (d) d.querySelector(".ok").click(); });
    await ev(() => window.imageEditorInstance.E.views.apply("web")); await p.waitForTimeout(400);
    const rib = await ev(() => !![...document.querySelectorAll("#imageeditdock .cbbtn, #imageeditdock [data-cbid], #imageeditdock button")].find((x) => /Product Pictures/.test(x.textContent + (x.title || ""))));
    check("the Web ribbon has 🛒 Product Pictures", rib);
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e.stack || e) + "\n      page errors: " + JSON.stringify(errs).slice(0, 600)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
