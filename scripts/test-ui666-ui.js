#!/usr/bin/env node
/* bitGen Studio — 2.666.0 in a REAL browser: THE SKETCHER'S ROOF TYPES - the Roof tool's panel and a picked roof's panel show
 * the twelve types as pictures; a click changes the roof (one undo step); the type's own settings (Dutch gable's hip part,
 * gambrel's lower pitch, skillion's flip) appear; a new roof takes the tool's settings. H3_SHOT=<dir>: pictures of each type.
 * Tim (verbatim): "can you add roof options, gable, skilion, hip etc"
 * Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.666.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const PN = "zz_roofs666_" + process.pid;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  const ev = (f, a) => p.evaluate(f, a);
  const setNum = (label, v) => ev(([l, v]) => { const r = [...document.querySelectorAll("#ppProps .ppr")].find((x) => x.querySelector("span").textContent.startsWith(l)); const i = r.querySelector("input,select"); if (i.type === "checkbox") i.checked = !!v; else i.value = String(v); i.dispatchEvent(new Event("change")); }, [label, v]);
  const labels = () => ev(() => [...document.querySelectorAll("#ppProps .ppr > span")].map((s) => s.textContent));
  try {
    await api("/api/projects/new", { name: PN }); await api("/api/projects/load", { name: PN });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3PushPull && document.getElementById("tX_pushpulldock"), null, { timeout: 60000 });
    await ev(() => { const d = document.getElementById("pushpulldock"); if (d.classList.contains("dockgone")) toggleDockGone("pushpulldock", "tX_pushpulldock"); (localStorage.setItem("h3.dockmax.off", "1"), localStorage.removeItem("pp.archopt"), H3PushPullFrame.toggleMaxed(true)); });
    await p.waitForFunction(() => H3PushPull.state.booted && H3PushPull.state.M, null, { timeout: 40000 });
    await ev(() => { const S = H3PushPull.state, b0 = H3PushPull.snapshot(), A = S.M.arch = PPArch.empty(); PPArch.addRoom(A, PPArch.rectPts([0, 0], [8, 5]), { name: "Hall" }); H3PushPull.commit("room", b0); S.T.use("roof"); });
    await p.waitForTimeout(250);
    const tp = await ev(() => [...document.querySelectorAll("#ppProps .pproofs button")].map((b) => ({ t: b.dataset.roof, on: b.classList.contains("on"), svg: !!b.querySelector("svg"), name: b.textContent })));
    check("the Roof tool's panel: twelve types as pictures (Gable on), each named - Skillion, Dutch gable, Clipped gable, Gambrel …", tp.length === 12 && tp.every((x) => x.svg) && tp.find((x) => x.on).t === "gable" && tp.map((x) => x.name).join() === "Gable,Hip,Skillion,Dutch gable,Clipped gable,Gambrel,Mansard,Saltbox,Pyramid,Butterfly,Flat,Follow walls", tp);
    await ev(() => document.querySelector('#ppProps .pproofs button[data-roof="gambrel"]').click()); await p.waitForTimeout(200);
    const l1 = await labels();
    check("Gambrel picked for the next roof: Upper pitch, Lower pitch, Break - in from the walls", l1.some((x) => /^Upper pitch/.test(x)) && l1.some((x) => /^Lower pitch/.test(x)) && l1.some((x) => /^Break - in from the walls/.test(x)), l1);
    await setNum("Lower pitch", 70); await p.waitForTimeout(150);
    // a click on the room: the roof with those settings
    const c = await ev(() => { const S = H3PushPull.state, s = S.V.screen([4, 2.5, 0]), r = S.V.canvas.getBoundingClientRect(); return [r.left + s[0], r.top + s[1]]; });
    await p.mouse.move(c[0], c[1], { steps: 3 }); await p.mouse.click(c[0], c[1]); await p.waitForTimeout(500);
    const rf = await ev(() => { const r = H3PushPull.state.M.arch.roofs[0]; return r && { type: r.type, pitch2: r.pitch2 }; });
    check("…clicked on the room: a gambrel roof, its lower pitch 70°", rf && rf.type === "gambrel" && rf.pitch2 === 70, rf);
    // the picked roof's panel
    await ev(() => { const S = H3PushPull.state; S.T.use("select"); S.T.arch.setSel({ ak: "roof", id: S.M.arch.roofs[0].id }); S.T.arch.props(); }); await p.waitForTimeout(200);
    const pp = await ev(() => ({ n: document.querySelectorAll("#ppProps .pproofs button").length, on: (document.querySelector("#ppProps .pproofs button.on") || {}).dataset }));
    check("the picked roof's panel: the twelve pictures, Gambrel on", pp.n === 12 && pp.on && pp.on.roof === "gambrel", pp);
    const shots = process.env.H3_SHOT;
    if (shots) await ev(() => { const S = H3PushPull.state; S.V.view("iso"); S.V.extents && S.V.extents(); });
    for (const t of ["gable", "hip", "shed", "dutch", "jerkin", "gambrel", "mansard", "saltbox", "pyramid", "butterfly"]) {
      await ev((t) => document.querySelector('#ppProps .pproofs button[data-roof="' + t + '"]').click(), t); await p.waitForTimeout(250);
      if (shots) { await ev(() => { const S = H3PushPull.state; S.T.arch.setSel(null); S.V.view("iso"); S.V.extents && S.V.extents(); }); await p.waitForTimeout(400); await p.screenshot({ path: path.join(shots, "roof666-" + t + ".png"), clip: { x: 300, y: 100, width: 1000, height: 820 } }); await ev(() => { const S = H3PushPull.state; S.T.arch.setSel({ ak: "roof", id: S.M.arch.roofs[0].id }); S.T.arch.props(); }); }
    }
    const last = await ev(() => H3PushPull.state.M.arch.roofs[0].type);
    check("a click on each picture changes the roof (gable … butterfly)", last === "butterfly", last);
    await ev(() => document.querySelector('#ppProps .pproofs button[data-roof="shed"]').click()); await p.waitForTimeout(200);
    const l2 = await labels();
    check("Skillion: Pitch + Flip - the other side high (no break / lower pitch)", l2.some((x) => /^Flip - the other side high/.test(x)) && l2.some((x) => /^Pitch/.test(x)) && !l2.some((x) => /^Lower pitch/.test(x)), l2);
    await setNum("Flip - the other side high", true); await p.waitForTimeout(200);
    check("…Flip ticked: the roof's flip saved", await ev(() => H3PushPull.state.M.arch.roofs[0].flip === true));
    await ev(() => document.querySelector('#ppProps .pproofs button[data-roof="dutch"]').click()); await p.waitForTimeout(200);
    await setNum("Hip part of the rise", 0.7); await p.waitForTimeout(200);
    check("Dutch gable: its hip part (0.7) saved", await ev(() => { const r = H3PushPull.state.M.arch.roofs[0]; return r.type === "dutch" && Math.abs(r.k - 0.7) < 1e-9; }));
    await ev(() => H3PushPull.undo()); await p.waitForTimeout(250);
    check("↶ one undo step: the hip part back to its own (null)", await ev(() => { const r = H3PushPull.state.M.arch.roofs[0]; return r.type === "dutch" && r.k == null; }));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  try { await api("/api/projects/load", { name: "default" }); await api("/api/projects/delete", { name: PN }); } catch { /* fine */ }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
