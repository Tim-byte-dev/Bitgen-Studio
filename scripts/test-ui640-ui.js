#!/usr/bin/env node
/* bitGen Studio — 2.640.0 in a REAL browser: THE SKETCHER'S PER-PART PROPERTIES (a wall / floor / ceiling / skirting / cornice
 * clicked in the view or the 🗂 outline shows ITS OWN panel) and THE PROFILES (picture dropdowns for skirting, cornices, door
 * frames, window frames and window sills; the ✎ Profiles dialog draws one and saves it to the project).
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.640.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_profile640_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const head = () => ev(() => (document.querySelector("#ppProps .pph") || {}).textContent || "");
  const row = (label) => ev((l) => { const r = [...document.querySelectorAll("#ppOutline .orow")].find((x) => x.querySelector(".olab").textContent === l); if (r) r.querySelector(".olab").click(); return !!r; }, label);
  const R0 = () => ev(() => JSON.parse(JSON.stringify(H3PushPull.state.M.arch.rooms[0])));
  const built = (part) => ev((pt) => H3PushPull.state.A.built.polys.filter((x) => x.tag && x.tag.part === pt).length, part);
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); H3PushPullFrame.toggleMaxed(true); try { localStorage.removeItem("pp.outline"); } catch (e) {} });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.A && document.getElementById("ppOutline") && window.PPProfile && window.PPProfileDlg, null, { timeout: 40000 });
    const scr = (w) => ev((w) => { const V = H3PushPull.state.V, s = V.screen(w), r = V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; }, w);
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(); S.M.arch = PPArch.empty(); const R1 = PPArch.addRoom(S.M.arch, [[0, 0], [4, 0], [4, 3], [0, 3]]); PPArch.addOp(S.M.arch, "door", 0.9, { room: R1.id, edge: 0, at: 2 }); PPArch.addOp(S.M.arch, "window", 1.2, { room: R1.id, edge: 2, at: 2 }); H3PushPull.commit("rooms", b0); S.V.view("top"); S.V.extents(); S.T.use("select"); });
    await p.waitForTimeout(400);

    // a wall clicked IN THE VIEW: its own panel
    await ev(() => { const V = H3PushPull.state.V; V.view("iso"); V.extents(); });
    await p.waitForTimeout(300);
    const [wx, wy] = await scr([4.08, 1.5, 1.3]);                      // the east wall's outside face
    await p.mouse.click(wx, wy); await p.waitForTimeout(250);
    const s1 = await ev(() => H3PushPull.state.T.arch.sel());
    const h1 = await head();
    check("a wall clicked in the view: ▮ Wall n · Room 1 panel (Length / Height / Thickness / Inside colour / 👁) - not the room's", s1 && s1.part === "wall" && /^▮ Wall \d · Room 1/.test(h1) && await ev(() => ["Length (m)", "Height (m)", "Inside", "Outside", "👁 Shown"].every((l) => [...document.querySelectorAll("#ppProps .ppr span")].some((s) => s.textContent.startsWith(l)))), { s1, h1 });
    // the outline picks its parts
    await row("Wall 2"); await p.waitForTimeout(200);
    const lenIn = await ev(() => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === "Length (m)"); return r ? +r.querySelector("input").value : null; });
    check("🗂 Wall 2 -> its panel, Length 3 m", /^▮ Wall 2/.test(await head()) && Math.abs(lenIn - 3) < 1e-3, { h: await head(), lenIn });
    await ev(() => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === "Length (m)"); const i = r.querySelector("input"); i.value = "3.5"; i.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(200);
    const r1 = await R0();
    check("…Length 3.5: the rectangle room keeps its shape (depth 3.5)", Math.abs(r1.pts[2][1] - 3.5) < 1e-6 && Math.abs(r1.pts[3][1] - 3.5) < 1e-6, r1.pts);
    // 2.651.0: Inside is a material button (ppmatpick.js) - its colour box + "Use this colour"
    await ev(() => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === "Inside"); r.querySelector("button.ppmatbtn").click(); });
    await ev(() => { const i = document.querySelector("#ppMatPick input[type=color]"); i.value = "#336699"; [...document.querySelectorAll("#ppMatPick button")].find((b) => /Use this colour/.test(b.textContent)).click(); });
    await p.waitForTimeout(200);
    const wc = await ev(() => ({ w: H3PushPull.state.M.arch.rooms[0].wcol, faces: H3PushPull.state.A.built.polys.filter((x) => x.tag.ak === "wall" && x.col === "#336699").length }));
    check("…its own inside colour: only that wall's inside faces", wc.w && wc.w[1] === "#336699" && wc.faces >= 1, wc);
    for (const [label, re] of [["Floor 1", /^▦ Floor 1 · Room 1/], ["Ceiling 1", /^⌓ Ceiling 1/], ["Cornice 1", /^▔ Cornice 1/], ["Skirting 1", /^▁ Skirting 1/]]) {
      await row(label); await p.waitForTimeout(150);
      check("🗂 " + label + " -> its own panel", re.test(await head()), await head());
    }
    // the skirting's picture dropdown
    const dd = await ev(() => { const d = document.querySelector('#ppProps .ppprof[data-kind="skirt"] .ppprof-btn'); return d ? { svg: !!d.querySelector("svg"), name: d.querySelector(".ppprof-name").textContent } : null; });
    check("Skirting panel: the profile is a picture dropdown (thumbnail + Square)", dd && dd.svg && dd.name === "Square", dd);
    await p.click('#ppProps .ppprof[data-kind="skirt"] .ppprof-btn'); await p.waitForTimeout(200);
    const lst = await ev(() => [...document.querySelectorAll(".ppprof-list .ppprof-opt")].map((o) => ({ id: o.dataset.id, svg: !!o.querySelector("svg polygon") })));
    check("…opened: every built-in skirting profile drawn as a picture (7) + ✎ New / edit profiles…", lst.length === 7 && lst.every((o) => o.svg) && await ev(() => !!document.querySelector(".ppprof-list .ppprof-edit")), lst);
    const n0 = await built("skirt");
    await p.click('.ppprof-list .ppprof-opt[data-id="preset:skirt-ogee"]'); await p.waitForTimeout(250);
    const og = { p: (await R0()).skirtP, n: await built("skirt"), name: await ev(() => document.querySelector('#ppProps .ppprof[data-kind="skirt"] .ppprof-name').textContent) };
    check("…Ogee picked: the room's skirting is swept with it (more faces), the dropdown shows it", og.p === "preset:skirt-ogee" && og.n > n0 && og.name === "Ogee", Object.assign({ n0 }, og));
    await p.keyboard.press("Control+z"); await p.waitForTimeout(200);
    check("…Ctrl+Z puts the Square back", (await R0()).skirtP === "");
    await p.keyboard.press("Control+y"); await p.waitForTimeout(200);
    // ✎ the dialog: a new profile
    await p.click('#ppProps .ppprof[data-kind="skirt"] .ppprof-btn'); await p.waitForTimeout(150);
    await p.click(".ppprof-list .ppprof-edit"); await p.waitForTimeout(300);
    const d0 = await ev(() => ({ open: document.getElementById("ppProfDlg").open, kind: document.getElementById("ppPdKind").value, pts: PPProfileDlg.state().p.pts.length, list: document.querySelectorAll("#ppPdList button").length }));
    check("✎ New / edit profiles… opens the dialog on Skirting (the one in use, the kind's profiles listed)", d0.open && d0.kind === "skirt" && d0.pts > 4 && d0.list >= 7, d0);
    await p.click("#ppPdNew"); await p.waitForTimeout(150);
    await p.fill("#ppPdName", "Tim's skirting");
    const cb = await p.locator("#ppPdCanvas").boundingBox();
    await p.mouse.click(cb.x + cb.width * 0.82, cb.y + cb.height * 0.3); await p.waitForTimeout(150);
    const d1 = await ev(() => ({ pts: PPProfileDlg.state().p.pts.length, name: PPProfileDlg.state().p.name }));
    check("…＋ New, a name, a click on the canvas adds a point", d1.pts === d0.pts + 1 && d1.name === "Tim's skirting", { d0, d1 });
    // a point dragged, one removed with Delete
    const d2 = await ev(() => { const D = PPProfileDlg.state(); return D.sel; });
    await p.keyboard.press("Delete"); await p.waitForTimeout(150);
    check("…Delete removes the picked point", await ev(() => PPProfileDlg.state().p.pts.length) === d0.pts && d2 >= 0);
    await p.mouse.click(cb.x + cb.width * 0.85, cb.y + cb.height * 0.25); await p.waitForTimeout(100);
    await ev(() => { const i = document.getElementById("ppPdH"); i.value = "140"; i.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(100);
    check("…Height 140 mm scales it", Math.abs(await ev(() => PPProfile.size(PPProfileDlg.state().p).h) - 0.14) < 1e-4);
    await p.click("#ppPdSave"); await p.waitForTimeout(600);
    const sv = await ev(() => ({ open: document.getElementById("ppProfDlg").open, R: H3PushPull.state.M.arch.rooms[0].skirtP, mine: (H3PushPull.state.M.arch.profiles || []).map((q) => q.name) }));
    const lib = await api("/api/pushpull-profiles");
    check("💾 Save: in the project's library, the model keeps a copy, the skirting uses it", !sv.open && /^p/.test(sv.R) && sv.mine.includes("Tim's skirting") && lib.profiles.some((q) => q.id === sv.R && q.name === "Tim's skirting"), { sv, lib });
    const hz = await ev(() => { const id = H3PushPull.state.M.arch.rooms[0].id; return Math.max(...H3PushPull.state.A.built.polys.filter((x) => x.tag.part === "skirt" && x.tag.id === id).flatMap((x) => x.rings[0].map((q) => q[2]))); });
    check("…drawn to the skirting's height (0.1 m)", Math.abs(hz - 0.1) < 1e-6, hz);
    await p.click('#ppProps .ppprof[data-kind="skirt"] .ppprof-btn'); await p.waitForTimeout(200);
    check("…listed under This project in the dropdown", await ev(() => [...document.querySelectorAll(".ppprof-list .ppprof-grp")].some((g) => g.textContent === "This project") && [...document.querySelectorAll(".ppprof-list .ppprof-opt")].some((o) => o.textContent === "Tim's skirting")));
    await p.keyboard.press("Escape"); await p.waitForTimeout(100);
    // cornice
    await row("Cornice 1"); await p.waitForTimeout(150);
    await p.click('#ppProps .ppprof[data-kind="cornice"] .ppprof-btn'); await p.waitForTimeout(150);
    await p.click('.ppprof-list .ppprof-opt[data-id="preset:cornice-cove"]'); await p.waitForTimeout(250);
    check("Cornice 1: Cove picked from its pictures - swept round the room", (await R0()).cornP === "preset:cornice-cove" && await built("cornice") > 20);
    // the door: its frame
    await row("Door 1"); await p.waitForTimeout(200);
    const df = await ev(() => { const d = document.querySelector('#ppProps .ppprof[data-kind="doorframe"]'); return d ? d.querySelector(".ppprof-name").textContent : null; });
    check("Door 1's panel: Door frame dropdown (None to start)", df === "None", df);
    await p.click('#ppProps .ppprof[data-kind="doorframe"] .ppprof-btn'); await p.waitForTimeout(150);
    const dl = await ev(() => [...document.querySelectorAll(".ppprof-list .ppprof-opt")].map((o) => o.dataset.id));
    await p.click('.ppprof-list .ppprof-opt[data-id="preset:doorframe-colonial"]'); await p.waitForTimeout(250);
    const fr = await ev(() => ({ op: H3PushPull.state.M.arch.ops.find((o) => o.kind === "door").frameP, n: H3PushPull.state.A.built.polys.filter((x) => x.tag.part === "frame").length }));
    check("…None + 6 frame pictures; Colonial picked: an architrave round the door on both faces", dl[0] === "" && dl.length === 7 && fr.op === "preset:doorframe-colonial" && fr.n > 100, { dl, fr });
    // the window: frame + sill
    await row("Window 1"); await p.waitForTimeout(200);
    await p.click('#ppProps .ppprof[data-kind="sill"] .ppprof-btn'); await p.waitForTimeout(150);
    await p.click('.ppprof-list .ppprof-opt[data-id="preset:sill-nosing"]'); await p.waitForTimeout(250);
    await p.click('#ppProps .ppprof[data-kind="windowframe"] .ppprof-btn'); await p.waitForTimeout(150);
    await p.click('.ppprof-list .ppprof-opt[data-id="preset:windowframe-bullnose"]'); await p.waitForTimeout(250);
    const wf = await ev(() => { const w = H3PushPull.state.M.arch.ops.find((o) => o.kind === "window"), B = H3PushPull.state.A.built.polys; return { f: w.frameP, s: w.sillP, sill: B.filter((x) => x.tag.part === "sill" && x.tag.id === w.id).length, frame: B.filter((x) => x.tag.part === "frame" && x.tag.id === w.id).length, colour: !![...document.querySelectorAll("#ppProps .ppr span")].find((s) => s.textContent === "Frame / sill colour") }; });
    check("Window 1: a sill (Round nosing) + a frame (Bullnose) from their pictures, a Frame / sill colour", wf.f === "preset:windowframe-bullnose" && wf.s === "preset:sill-nosing" && wf.sill > 5 && wf.frame > 20 && wf.colour, wf);
    // Delete on a part: that part off, the room stays
    await row("Skirting 1"); await p.waitForTimeout(150);
    await ev(() => H3PushPull.state.V.canvas.focus());
    await ev(() => { H3PushPull.state.over = true; });                  // the keys go to the Sketcher with the pointer over it
    await p.keyboard.press("Delete"); await p.waitForTimeout(250);
    const dz = await ev(() => ({ rooms: H3PushPull.state.M.arch.rooms.length, on: H3PushPull.state.M.arch.rooms[0].skirtOn, sel: H3PushPull.state.T.arch.sel() }));
    check("Delete on Skirting 1: the skirting goes off - the room stays (and is picked)", dz.rooms === 1 && dz.on === false && dz.sel && dz.sel.ak === "room" && !dz.sel.part, dz);
    // the floor clicked in the view (from above, the ceiling cut away)
    await ev(() => { const S = H3PushPull.state; S.A.cut(true); S.V.view("top"); S.V.extents(); S.T.arch.setSel(null); });
    await p.waitForTimeout(300);
    const [fx, fy] = await scr([1, 1, 0]);
    await p.mouse.click(fx, fy); await p.waitForTimeout(250);
    check("the floor clicked in the view (cut-away): ▦ Floor 1 panel", /^▦ Floor 1/.test(await head()), await head());
    await ev(() => H3PushPull.state.A.cut(false));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e.stack || e)); }
  finally {
    try { await ev(() => { if (window.PPProfileDlg) PPProfileDlg.close(); if (H3PushPullFrame.maxed()) H3PushPullFrame.toggleMaxed(false); }); } catch { /* fine */ }
    await b.close();
    try { await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
