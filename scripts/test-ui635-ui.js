#!/usr/bin/env node
/* bitGen Studio — 2.635.0 in a REAL browser: THE ASSETS DOCK'S 📁 PROJECT | 🌐 GLOBAL | ALL, UPLOADS INTO
 * projects/<name>/Assets, RIGHT-CLICK 🌐 MOVE TO GLOBAL, A GROUP = A FOLDER.
 * Tim: "add a dropdown to the top of assets dialog, Global, Project or All, global assets will be kept in project
 * root/Assets, project assets will be kept in project name/Assets, folders in the assets folders will be a group" +
 * "new uploads live in project name/assets, right click context menu will have "move to Global""
 * Against the running app (H3_URL, the stub server run from its own folder - projects/ there). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.635.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_assets635_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
// a 1x1 png
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const upload = async (name, scope) => { const fd = new FormData(); fd.append("file", new Blob([PNG], { type: "image/png" }), name); return (await fetch(URL_ + "api/passets" + (scope ? "?scope=" + scope : ""), { method: "POST", body: fd })).json(); };

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  let ROOT = "";
  try {
    await api("/api/projects/new", { name: PN });
    await api("/api/projects/load", { name: PN });
    const where = await api("/api/outputs/where");
    const PD = path.dirname(where.dir); ROOT = path.dirname(PD);          // projects/<name>/output -> projects/<name>, projects
    const u1 = await upload("hero635.png");
    check("an upload lands in projects/<name>/Assets (and its type folder, same name)", u1.name === "hero635.png" && u1.scope === "project" && fs.existsSync(path.join(PD, "Assets", "hero635.png")) && fs.existsSync(path.join(PD, "images", "hero635.png")), u1);
    const u2 = await upload("sky635.png", "global");
    check("an upload while the dock shows Global lands in <projects>/Assets", u2.scope === "global" && fs.existsSync(path.join(ROOT, "Assets", "sky635.png")), u2);
    const pl = await api("/api/projects");
    check("<projects>/Assets is not a project", !pl.projects.some((x) => x.toLowerCase() === "assets"), pl.projects);
    const bad = await api("/api/projects/new", { name: "Assets" });
    check("…and \"Assets\" cannot be made as one", !!bad.error, bad);

    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.AssetGroups && document.getElementById("assetScope"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("assetsdock"); if (d.classList.contains("dockgone") && window.toggleDockGone) toggleDockGone("assetsdock", "tAssets"); });
    await ev(() => window.AssetGroups.setScope("project"));
    await p.waitForTimeout(500);
    const tilesOf = () => ev(() => [...document.querySelectorAll('#assetsdock [data-apane="images"] .aitem[data-agname]')].map((t) => t.dataset.agname + "@" + t.dataset.agscope));
    const opts = await ev(() => [...document.querySelectorAll("#assetScope option")].map((o) => o.textContent).join("|"));
    let t = await tilesOf();
    check("the dock's head: 📁 Project | 🌐 Global | All; Project shows the project's upload, not the global one", opts === "📁 Project|🌐 Global|All" && t.includes("hero635.png@project") && !t.some((x) => /sky635/.test(x)), { opts, t });
    await p.selectOption("#assetScope", "global"); await p.waitForTimeout(600);
    t = await tilesOf();
    const badge = await ev(() => !!document.querySelector('#assetsdock .aitem[data-agname="sky635.png"] .agglob'));
    check("🌐 Global: the global asset (with its 🌐), not the project's", t.includes("sky635.png@global") && !t.some((x) => /hero635/.test(x)) && badge, t);
    await p.selectOption("#assetScope", "all"); await p.waitForTimeout(600);
    t = await tilesOf();
    check("All: both", t.includes("sky635.png@global") && t.includes("hero635.png@project"), t);
    const assetsVar = await ev(() => (window.assets || assets).images.map((a) => a.name));
    check("the pickers' list (assets) has both whatever the dock shows", assetsVar.includes("sky635.png") && assetsVar.includes("hero635.png"), assetsVar);
    // right-click -> Move to Global
    await p.selectOption("#assetScope", "project"); await p.waitForTimeout(600);
    await p.click('#assetsdock [data-apane="images"] .aitem[data-agname="hero635.png"]', { button: "right", force: true });
    await p.waitForTimeout(150);
    const menu = await ev(() => { const m = document.querySelector(".agmenu"); return m ? [...m.querySelectorAll("button")].map((x) => x.textContent + (x.disabled ? "(off)" : "")) : null; });
    check("right-click a project tile: 🌐 Move to Global (on), 📁 Move to Project (off), New group, Delete", menu && menu[0] === "🌐 Move to Global" && /Move to Project\(off\)/.test(menu[1]) && menu.some((x) => /New group/.test(x)) && menu.some((x) => /Delete/.test(x)), menu);
    await ev(() => [...document.querySelectorAll(".agmenu button")][0].click());
    await p.waitForTimeout(800);
    t = await tilesOf();
    check("🌐 Move to Global: the file moves to <projects>/Assets; gone from Project; the project's working copy stays (names keep working)", fs.existsSync(path.join(ROOT, "Assets", "hero635.png")) && !fs.existsSync(path.join(PD, "Assets", "hero635.png")) && fs.existsSync(path.join(PD, "images", "hero635.png")) && !t.some((x) => /hero635/.test(x)), t);
    // a group in the Global view = a folder in <projects>/Assets
    await p.selectOption("#assetScope", "global"); await p.waitForTimeout(600);
    const gr = await ev(async () => { const r = await fetch("/api/passets/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "create", name: "Skies635", scope: "global", items: [{ kind: "images", name: "sky635.png", from: "" }] }) }); return r.json(); });
    await ev(() => window.refreshAssets && refreshAssets()); await p.waitForTimeout(600);
    const head = await ev(() => { const h = document.querySelector('#assetsdock [data-apane="images"] .aghead[data-gid="g:Skies635"]'); return h ? h.textContent : null; });
    check("a group made in the Global view is a folder <projects>/Assets/Skies635 holding the file; its header shows 🌐", !gr.error && fs.existsSync(path.join(ROOT, "Assets", "Skies635", "sky635.png")) && head && /🌐/.test(head) && /Skies635/.test(head), { gr: gr.error, head });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
    try { for (const f of ["hero635.png", "sky635.png", "Skies635"]) fs.rmSync(path.join(ROOT, "Assets", f), { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
