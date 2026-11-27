#!/usr/bin/env node
/* bitGen Studio — 2.980.0 in a REAL browser: 🧬 DAZ Tools (test-977's made-up library: OUR OWN Mini figure, shirt, hair).
 * The menu bar button; on = the 📚 DAZ Library docker left of the main column and the 🧭 DAZ Explorer + 🎚 Shape controls
 * docker right of it; a figure clicked = a character; clothing / hair worn; a dial; rename; 💨; 🧍 Build; 🕺 Pose; 💾 Save /
 * ✕ / 📂; the splitter; kept over a reload; off = both gone. Tim: "add a toggle button to the top toolbar DAZ Tools ..." */
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
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
  const t977 = fs.readFileSync(path.join(__dirname, "test-977.js"), "utf8");
  const code = t977.slice(t977.indexOf("const pt = "), t977.indexOf("(async () => {"));
  const makeLib = new Function("require", "path", "fs", "zlib", "execFileSync", code + "; return makeLib;")(require, path, fs, require("zlib"), require("child_process").execFileSync);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui980_")), lib = makeLib(path.join(tmp, "My Library"));
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), p = await b.newPage({ viewport: { width: 2400, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const box = (id) => ev((i) => { const e = document.getElementById(i); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), d: getComputedStyle(e).display }; }, id);
  let before = null, made = "";
  try {
    before = (await (await p.request.get(URL_ + "api/dazlib")).json());
    await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: [lib.dir] } });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.daztools\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DazTools && document.getElementById("dazTools"), null, { timeout: 60000 });
    await p.waitForTimeout(1700);
    const b0 = await ev(() => { const bt = document.getElementById("dazTools"), kids = [...document.getElementById("menubar").children]; return { text: bt.textContent, pressed: bt.getAttribute("aria-pressed"), after: kids[kids.indexOf(bt) - 1] && kids[kids.indexOf(bt) - 1].id, left: !!document.getElementById("dzLib") && getComputedStyle(document.getElementById("dzLib")).display }; });
    check("🧬 DAZ Tools on the top menu bar (after the app strip), off at first - no Daz dockers", /DAZ Tools/.test(b0.text) && b0.pressed === "false" && b0.after === "appStrip" && (b0.left === false || b0.left === "none"), b0);
    const m0 = await box("ppView");   // 2.983.0: the dockers are in the Sketcher
    await p.click("#dazTools");
    await p.waitForSelector("#dzLib .dzit", { timeout: 15000 });
    const L = await box("dzLib"), R = await box("dzSide"), M = await box("ppView");
    check("on (2.983.0): the Sketcher opens with the 📚 DAZ Library FLOATING over its view and the 🧭 Explorer docker RIGHT of the view", L.d !== "none" && R.d !== "none" && L.l >= M.l - 220 && L.l + L.w <= M.l + M.w && M.l + M.w <= R.l + 2 && L.w === 300 && R.w === 330 && R.h > 200 && (await ev(() => !document.getElementById("pushpulldock").classList.contains("dockgone"))), { L, R, M });
    const t1 = await ev(() => ({ pressed: document.getElementById("dazTools").getAttribute("aria-pressed"), note: document.querySelector("#dzLib .dznote").textContent, items: [...document.querySelectorAll("#dzGrid .dzit span")].map((s) => s.textContent), heads: [...document.querySelectorAll("#dzSide .dzhead b")].map((x) => x.textContent) }));
    check("the button lit; the not-a-replacement words; the library's figures; the right docker = Explorer + Shape controls", t1.pressed === "true" && /Not a replacement for Daz Studio/.test(t1.note) && t1.items.join() === "Mini" && t1.heads.join() === "🧭 DAZ Explorer,🎚 Parameters", t1);
    await p.click("#dzGrid .dzit");
    await p.waitForSelector("#dzDials .dzdial", { timeout: 10000 });
    const t2 = await ev(() => ({ tree: [...document.querySelectorAll("#dzTree .dzc span, #dzTree .dzcomp span")].map((s) => s.textContent.trim()), groups: [...document.querySelectorAll("#dzDials summary")].map((s) => s.textContent), dial: document.querySelector("#dzDials .dzdial span").textContent }));
    check("a figure clicked = a character in the explorer (its figure as a component); its shape controls by group", t2.tree.join("|") === "🧍 Mini|🦴 Mini (figure)" && /^Size/.test(t2.groups[0]) && t2.dial === "Tall", t2);
    await p.click('#dzTabs [data-kind="clothing"]'); await p.waitForFunction(() => [...document.querySelectorAll("#dzGrid .dzit span")].some((s) => s.textContent === "Shirt"), null, { timeout: 8000 }); await p.click("#dzGrid .dzit");
    await p.click('#dzTabs [data-kind="hair"]'); await p.waitForFunction(() => [...document.querySelectorAll("#dzGrid .dzit span")].some((s) => s.textContent === "Hair"), null, { timeout: 8000 }); await p.click("#dzGrid .dzit");
    const t3 = await ev(() => ({ tree: [...document.querySelectorAll("#dzTree .dzcomp span")].map((s) => s.textContent.trim()), worn: document.querySelector("#dzGrid .dzit").classList.contains("worn") }));
    check("👕 the shirt and 💇 the hair are the character's components (the tile marked worn)", t3.tree.join("|") === "🦴 Mini (figure)|👕 Shirt|💇 Hair" && t3.worn, t3);
    await ev(() => { const r = document.querySelector("#dzDials .dzdial input"); r.value = "0.5"; r.dispatchEvent(new Event("input")); });
    await p.check("#dzChanged");
    const t4 = await ev(() => ({ rows: [...document.querySelectorAll("#dzDials .dzdial")].map((r) => r.querySelector("span").textContent + "=" + r.querySelector("output").textContent), set: document.querySelector("#dzDials .dzdial").classList.contains("set") }));
    check("a shape dial set (0.50) - 'changed' shows only the dials that are not 0", t4.rows.join() === "Tall=0.50" && t4.set, t4);
    await p.dblclick("#dzTree .dzc span"); await p.keyboard.press("Control+A"); await p.keyboard.type("Hero"); await p.keyboard.press("Enter");
    await p.check('#dzOpts [data-drape="clothing"]'); await p.fill("#dzFrames", "8"); await p.dispatchEvent("#dzFrames", "change");
    check("renamed by a double-click; 💨 clothing physics kept with the character", (await ev(() => [H3DazTools.cur().name, H3DazTools.cur().drape.kinds.join(), H3DazTools.cur().drape.frames].join("|"))) === "Hero|clothing|8");
    const bp = p.waitForResponse((r) => r.url().includes("/api/dazlib/build"), { timeout: 60000 });
    await p.click("#dzBuild");
    const resp = await (await bp).json(); made = resp.model || "";
    await p.waitForFunction(() => /✔|⚠/.test(document.getElementById("dzMsg").textContent), null, { timeout: 20000 });
    const t5 = await ev(() => ({ msg: document.getElementById("dzMsg").textContent, pose: document.getElementById("dzPose").disabled, last: H3DazTools.cur().last }));
    check("🧍 Build: Hero_daz.glb - 4 pieces (body, eyes, shirt, hair), the dial in it, the shirt draped; 🕺 Pose / ⤒ Open ready", /^Hero_daz(_\d+)?\.glb$/.test(made) && resp.info.pieces.length === 4 && resp.info.dials.some((d) => d.label === "Tall" && d.value === 0.5) && resp.info.pieces.find((x) => x.kind === "clothing").draped_mm > 0 && !t5.pose && t5.last === made && /✔/.test(t5.msg), { t5, info: resp.info });
    await p.click("#dzPose");   // 2.983.0: the 🕺 Pose TAB on the character in the Sketcher's scene (no dialog)
    await p.waitForFunction(() => H3DazTools.state.tab === "pose" && document.querySelectorAll("#dzBone option").length > 0, null, { timeout: 30000 });
    check("🕺 Pose: the Pose tab with the built character's skeleton (it is in the Sketcher's scene)", (await ev(() => H3DazScene.rig(H3DazTools.cur().id).model)) === made && (await ev(() => document.querySelectorAll("#dzBone option").length)) >= 5);
    await p.click('#dzParTabs [data-tab="shape"]');
    await p.click("#dzSave"); await p.waitForFunction(() => /💾/.test(document.getElementById("dzMsg").textContent), null, { timeout: 8000 });
    await p.click("#dzTree .dzc [data-del]");
    check("✕ takes the character out of the explorer", (await ev(() => H3DazTools.info().chars)) === 0);
    await p.waitForFunction(() => [...document.querySelectorAll("#dzChars option")].some((o) => o.textContent === "Hero"), null, { timeout: 8000 });
    await p.selectOption("#dzChars", "Hero");
    await p.waitForFunction(() => H3DazTools.info().chars === 1, null, { timeout: 8000 });
    const t6 = await ev(() => H3DazTools.info());
    check("💾 Save -> 📂 Saved… brings it back (its wear and its dial)", t6.sel === "Hero" && t6.wear.join() === "Shirt,Hair" && (await ev(() => Object.values(H3DazTools.cur().dials).join())) === "0.5", t6);
    const sp = await box("dzSplitR");
    const sy = Math.round(sp.t + sp.h / 2); await p.mouse.move(sp.l + 2, sy); await p.mouse.down(); await p.mouse.move(sp.l - 58, sy, { steps: 4 }); await p.mouse.up();
    check("the splitter sizes the explorer docker (kept)", Math.abs((await box("dzSide")).w - 390) <= 2 && Math.abs((await ev(() => JSON.parse(localStorage.getItem("h3.daztools.w")).r)) - 390) <= 2);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DazTools && document.getElementById("dzLib"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    const t7 = await ev(() => Object.assign(H3DazTools.info(), { app: document.getElementById("pushpulldock").classList.contains("dz-on"), w: Math.round(document.getElementById("dzSide").getBoundingClientRect().width) }));
    check("after a reload: still on, the same width, the character still in the explorer", t7.on && t7.app && Math.abs(t7.w - 390) <= 2 && t7.chars === 1 && t7.sel === "Hero", t7);
    await p.click("#dazTools"); await p.waitForTimeout(300);
    const off = { L: await box("dzLib"), R: await box("dzSide"), M: await box("ppView"), pressed: await ev(() => document.getElementById("dazTools").getAttribute("aria-pressed")) };
    check("off: the Daz dockers hidden, the Sketcher's view gets its room back, the button dark", off.L.d === "none" && off.R.d === "none" && off.M.w > M.w && off.pressed === "false", { off, m0 });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + e.message); }
  try { await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.daztools\./.test(k)).forEach((k) => localStorage.removeItem(k)); }); } catch (e) { /* fine */ }
  try { await p.request.post(URL_ + "api/dazlib/roots", { data: { roots: (before && before.roots && before.detected && before.roots.join() !== before.detected.join()) ? before.roots : [] } }); } catch (e) { /* fine */ }
  try { const d = path.join(__dirname, "..", "projects"); for (const pr of fs.readdirSync(d)) { for (const f of [path.join(d, pr, "models3d", made), path.join(d, pr, "dazchars", "Hero.json")]) if (made && fs.existsSync(f)) fs.rmSync(f); } } catch (e) { /* fine */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  await b.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
