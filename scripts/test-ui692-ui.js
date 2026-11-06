#!/usr/bin/env node
/* bitGen Studio — 2.692.0 in a REAL browser: THE SKETCHER'S FLOOR SYSTEMS + LINTELS. A picked room's 🏗 Floor system: Raised timber
 * floor builds piers / bearers / joists under it (checked ✔ / ✗ by the guide's beam sums, ✔ Size them), a slab type builds the slab;
 * a window's 🪵 Lintel (auto = the smallest that passes, or picked); 🪵 Show framing = the walls see-through + the lintels drawn.
 * Tim (verbatim): "is it possible to add framing, wood/steel to australian standards? and flooring solutions like slab, pier, raised
 * etc" + "just use the standards don't import anything - don't do anything to jepordize the free license"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.692.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && window.PPArch && window.PPStruct && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); localStorage.setItem("h3.dockmax.off", "1"); H3PushPullFrame.toggleMaxed(true); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.M, null, { timeout: 40000 });
    await p.waitForFunction(() => /📂/.test((document.getElementById("ppMsg") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(800);
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(); S.M.arch = PPArch.empty(); S.M.f = []; S.M.v = []; S.M.e = []; const A = S.M.arch;
      const R = PPArch.addRoom(A, PPArch.rectPts([0, 0], [6, 4]), true); R.z = 0.7; PPArch.addOp(A, "window", { room: R.id, edge: 0, at: 3 }, { w: 1.8 });
      H3PushPull.commit("rooms", b0); S.T.use("select"); S.T.arch.setSel({ ak: "room", id: R.id }); S.V.view("iso"); S.V.extents(); });
    await p.waitForTimeout(500);
    const row = (label) => ev((label) => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === label); const i = r && r.querySelector("select, input"); return i ? i.value : null; }, label);
    const setRow = async (label, v) => { await ev(([label, v]) => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent === label); const i = r.querySelector("select, input"); i.value = v; i.dispatchEvent(new Event("change")); }, [label, v]); await p.waitForTimeout(350); };
    const structPolys = () => ev(() => { const o = PPArch.build(H3PushPull.state.M.arch); return { struct: o.polys.filter((q) => q.tag && q.tag.part === "struct").length, lintel: o.polys.filter((q) => q.tag && q.tag.part === "lintel").length, seeThrough: o.polys.some((q) => q.tag && q.tag.ak === "wall" && q.alpha === 0.3) }; });
    check("the room panel has 🏗 Floor system (none to start)", (await row("Floor system")) === "none" && await ev(() => /🏗 Floor system/.test(document.getElementById("ppProps").textContent)));
    await setRow("Floor system", "raised");
    const r1 = await ev(() => { const R = H3PushPull.state.M.arch.rooms[0]; return { fs: R.fs && R.fs.type, checks: [...document.querySelectorAll("#ppProps [data-ppcheck]")].map((d) => d.dataset.ppcheck + " " + d.textContent.slice(0, 40)), txt: document.getElementById("ppProps").textContent }; });
    const s1 = await structPolys();
    check("Raised timber floor: built under the room (piers, bearers, joists, flooring) and the joists / bearers checked ✔", r1.fs === "raised" && s1.struct > 100 && r1.checks.length === 2 && r1.checks.every((c) => /^ok/.test(c)), r1.checks);
    check("…the members listed (joists, bearers, stumps) + the guide's words (not a certificate; AS 1684 / span tables; AS 2870)", /• Joists: 140 × 45 MGP10 @ 450/.test(r1.txt) && /Concrete stumps/.test(r1.txt) && /not a certificate/.test(r1.txt) && /AS 1684/.test(r1.txt));
    await setRow("Joists", "90x35"); await setRow("Bearer spacing (the joists' span) (m)", "2.4");
    const bad = await ev(() => [...document.querySelectorAll("#ppProps [data-ppcheck]")].map((d) => d.dataset.ppcheck));
    check("90 × 35 joists spanning 2.4 m: ✗ (too small)", bad[0] === "no", bad);
    await ev(() => { const b = [...document.querySelectorAll("#ppProps button")].find((x) => /Size them/.test(x.textContent)); b.click(); }); await p.waitForTimeout(400);
    const fixed = await ev(() => ({ c: [...document.querySelectorAll("#ppProps [data-ppcheck]")].map((d) => d.dataset.ppcheck), j: H3PushPull.state.M.arch.rooms[0].fs.joist }));
    check("✔ Size them: the smallest stock joist that passes for 2.4 m - now ✔", fixed.c.every((c) => c === "ok") && fixed.j.D > 90, fixed);
    await ev(() => document.getElementById("ppUndo").click()); await p.waitForTimeout(300);
    check("…one ↶ step back", await ev(() => H3PushPull.state.M.arch.rooms[0].fs.joist.D === 90));
    // 🪵 show framing
    await ev(() => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => /Show framing/.test(x.querySelector("span").textContent)); const i = r.querySelector("input"); if (!i.checked) i.click(); }); await p.waitForTimeout(400);
    const s2 = await structPolys();
    check("🪵 Show framing: the walls see-through and the window's lintel drawn", s2.seeThrough && s2.lintel > 0, s2);
    // the window's lintel
    await ev(() => { const S = H3PushPull.state, A = S.M.arch; S.T.arch.setSel({ ak: "op", id: A.ops[0].id }); }); await p.waitForTimeout(400);
    const L1 = await ev(() => ({ txt: document.getElementById("ppProps").textContent, c: [...document.querySelectorAll("#ppProps [data-ppcheck]")].map((d) => d.dataset.ppcheck + " " + d.textContent.slice(0, 60)) }));
    check("the window's panel: 🪵 Lintel - Auto, ✔, its span (1.9 m) and the roof load width", /🪵 Lintel/.test(L1.txt) && /Roof load width/.test(L1.txt) && L1.c.length === 1 && /^ok ✔ Lintel 2\/\d+ × 45 MGP10 over 1\.9/.test(L1.c[0]), L1.c);
    await setRow("Lintel", "90x35"); await setRow("Lintel pieces", "1");
    const L2 = await ev(() => ({ c: [...document.querySelectorAll("#ppProps [data-ppcheck]")].map((d) => d.dataset.ppcheck), lint: H3PushPull.state.M.arch.ops[0].lint }));
    check("a 90 × 35 lintel picked by hand: kept on the window and ✗", L2.lint && L2.lint.D === 90 && L2.lint.n === 1 && L2.c[0] === "no", L2);
    // a slab
    await ev(() => { const S = H3PushPull.state; S.T.arch.setSel({ ak: "room", id: S.M.arch.rooms[0].id }); }); await p.waitForTimeout(300);
    await setRow("Floor system", "waffle");
    const w = await ev(() => ({ t: document.getElementById("ppProps").textContent, fs: H3PushPull.state.M.arch.rooms[0].fs }));
    check("Waffle pod slab: the site class, pod depth, edge beam, ribs set in the panel (the engineer's design - said)", w.fs.type === "waffle" && /Site class/.test(w.t) && /Rib spacing/.test(w.t) && /AS 2870/.test(w.t));
    const kept = await ev(() => { const c = PPArch.clean(JSON.parse(JSON.stringify(H3PushPull.state.M.arch))); return c.rooms[0].fs.type === "waffle" && c.ops[0].lint.D === 90 && c.struct.show === true; });
    check("kept through a save / load (PPArch.clean): the floor system, the lintel, 🪵 show", kept);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
