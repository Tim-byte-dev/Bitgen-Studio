#!/usr/bin/env node
/* bitGen Studio — 2.763.5 browser test: DOCKER WINDOWS GO INTO ANY NAMED DOCKER, THE FLOATING DIALOGS STAY OVER THE DOCKERS,
 * THE 💲 RUNPOD DOCKER (static/dgdock.js, static/dockgroup.js, static/floatpanels.js, static/floatz.js, static/runpoddock.js)
 * on a running studio (H3_URL, default :8311).
 * Tim (verbatim): "allow multiple dockers to dock in the custom created docker, move the pods docker in front of any custom
 * docker, right now it goes behind the custom docker and can't dock in the custom docker, make a new docker for runpod prices
 * and move runpod balance and usage costs from the basic settings docker to the runpod docker"
 * The RunPod figures come from the page's own stand-ins (page.route) - no RunPod is asked. The layout is put back afterwards.
 * No server / no Playwright = SKIP. */
"use strict";
const fs = require("fs"), path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.763.5 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
const ROOT = path.join(__dirname, "..");
const LAYF = path.join(ROOT, "panel_layout.cfg");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.763.5 browser test did not run"); process.exit(0); }
  let lay0 = null; try { lay0 = fs.readFileSync(LAYF); } catch { lay0 = null; }
  fs.rmSync(LAYF, { force: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  // RunPod stand-ins for the page
  const json = (route, j) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(j) });
  let acctAsked = 0;
  await p.route("**/api/gpusplit", async (route) => { const r = await route.fetch(); const j = await r.json(); j.engine = Object.assign({}, j.engine, { provider: "runpod", pods: true }); j.enabled = true; json(route, j); });
  await p.route("**/api/pods/account*", (route) => { acctAsked++; json(route, { balance: 42.5, spend_hr: 0.85, spend_limit: 80, under: false, lasts_hr: 50, at: Date.now() }); });
  await p.route("**/api/pods/costs*", (route) => json(route, { running: 1, running_hr: 0.44, today_usd: 1.23, month_usd: 17.5, pods: { pod7635a: { today: 1.2, month: 9.5 }, podGone: { today: 0, month: 8 } }, at: Date.now() }));
  await p.route("**/api/pods/mine", (route) => json(route, { pods: [{ id: "pod7635a", name: "Krea pod", status: "RUNNING", gpu: "A40", gpus: 1, cost_hr: 0.44 }] }));
  await p.route("**/api/pods/gpus*", (route) => { const c = /COMMUNITY/.test(route.request().url());
    json(route, { cloud: c ? "COMMUNITY" : "SECURE", gpus: [{ id: "NVIDIA A40", name: "A40", memory: 48, price: c ? 0.35 : 0.44, availability: "HIGH", offered: true, max: 8 },
      { id: "NVIDIA RTX 4090", name: "RTX 4090", memory: 24, price: c ? 0.34 : 0.69, availability: "LOW", offered: true, max: 4 }, { id: "NVIDIA H100", name: "H100 SXM", memory: 80, price: 2.99, availability: "NONE", offered: false, max: 8 }] }); });
  const boot = async () => {
    await p.goto(URL0, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3DockGroup && window.H3DGDock && window.SecFloat && SecFloat.started && SecFloat.windows.pods && SecFloat.windows.runpod && window.PFloat && PFloat.started && window.H3RunPod, null, { timeout: 60000 });
    await p.waitForTimeout(2500);
  };
  const rect = (sel) => ev((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  const dragTo = async (from, to) => {
    await p.mouse.move(from.x, from.y); await p.mouse.down(); await p.mouse.move(from.x + 12, from.y + 6, { steps: 3 }); await p.mouse.move(to.x, to.y, { steps: 16 });
    const z = await ev(() => { const z = document.getElementById("dgZone"); return z && z.style.display === "block" ? z.textContent : ""; });
    await p.mouse.up(); await p.waitForTimeout(900); return z;
  };
  const head = async (id) => { const r = await rect("#sf-" + id + " > .sfhead .sft"); return { x: r.l + 20, y: r.y }; };
  const stateOf = (id) => ev((i) => { const r = H3Panels.get(i); return r ? r.state + ">" + (r.docker || "") : "none"; }, id);
  try {
    await boot();
    /* ---- 1 a docker made with ⊞ Docker configs ▸ ▣ New docker… takes PODS, Basic Settings, LLM tokens */
    await ev(() => { H3Panels.newDocker({ id: "t7635-mine", name: "Mine" }); H3Panels.float("t7635-mine", { x: 420, y: 140, w: 980, h: 720 }); });
    await p.waitForTimeout(500);
    await ev(() => { SecFloat.show("pods", true); SecFloat.windows.pods.panel.float(80, 80, 560, 420); SecFloat.show("pods", true); });
    await p.waitForTimeout(400);
    const pane = async () => { const r = await rect('.h3fp[data-fp="t7635-mine"] .h3fd'); return { x: r.l + r.w * 0.75, y: r.t + r.h * 0.6 }; };
    const z1 = await dragTo(await head("pods"), await pane());
    check("PODS dragged by its title bar over a ▣ New docker… docker: the orange line \"PODS → Mine\"", /PODS → Mine/.test(z1), z1);
    check("…let go = IN that docker (it could not go in before)", (await stateOf("sf.pods")) === "in>t7635-mine", await stateOf("sf.pods"));
    for (const id of ["basic", "llmtok"]) {
      await ev((i) => { SecFloat.show(i, true); SecFloat.windows[i].panel.float(60, 560, 340, 300); SecFloat.show(i, true); }, id);
      await p.waitForTimeout(400);
      await dragTo(await head(id), await pane());
    }
    const tabs = await ev(() => H3Panels.get("t7635-mine").tabs.slice().sort());
    check("several docker windows in the one docker: PODS + Basic Settings + LLM tokens", JSON.stringify(tabs) === JSON.stringify(["sf.basic", "sf.llmtok", "sf.pods"]), tabs);
    const inside = await ev(() => { const w = H3Panels.get("t7635-mine").win; return ["pods", "basic", "llmtok"].every((i) => w.contains(document.getElementById("sf-" + i))) && !!w.querySelector("#pdBody"); });
    check("…each window's own content inside it (the PODS docker's body too)", inside);
    // a reload: they are back in it
    await boot();
    await p.waitForFunction(() => H3Panels.get("t7635-mine") && H3Panels.get("sf.pods") && H3Panels.get("sf.pods").state === "in", null, { timeout: 15000 }).catch(() => {});
    check("after a reload PODS is back in that docker", (await stateOf("sf.pods")) === "in>t7635-mine", await stateOf("sf.pods"));
    // out again: its little title bar in the docker dragged out = floats on its own
    await ev(() => { for (const i of ["sf.pods", "sf.basic", "sf.llmtok"]) H3Panels.float(i, { x: 60, y: 80, w: 560, h: 420 }); });
    await p.waitForTimeout(1200);
    check("floated out again: PODS on its own (floating, not in the docker)", await ev(() => { const el = document.getElementById("sf-pods"); return el.classList.contains("df-float") && !H3Panels.get("t7635-mine").win.contains(el); }));

    /* ---- 2 PODS in front of the custom dockers - a ▣ New docker… one confined to a docker was 9300 (THE BUG) */
    await ev(() => { H3Panels.show("t7635-mine", false); SecFloat.show("basic", false); SecFloat.show("llmtok", false); });
    const host = await ev(() => { for (const i of ["ldock", "previewdock", "rdock", "qdock"]) { const e = document.getElementById(i); if (e && e.getBoundingClientRect().width > 200 && e.getBoundingClientRect().height > 300) return i; } return null; });
    await ev((h) => { const r = document.getElementById(h).getBoundingClientRect(); H3Panels.newDocker({ id: "t7635-conf", name: "Inside" }); H3Panels.confineTo("t7635-conf", h); H3Panels.float("t7635-conf", { x: r.left + 4, y: r.top + 30, w: r.width - 8, h: r.height - 60 }); }, host);
    await p.waitForTimeout(500);
    const hr = await rect("#" + host);
    await ev((r) => { SecFloat.show("pods", true); SecFloat.windows.pods.panel.float(Math.round(r.l + 20), Math.round(r.t + 60), 560, 420); SecFloat.show("pods", true); }, hr);
    await p.waitForTimeout(400);
    const spot = { x: hr.l + 60, y: hr.t + 140 };
    const under = () => ev((s) => { const t = document.elementFromPoint(s.x, s.y); return document.getElementById("sf-pods").contains(t) ? "pods" : H3Panels.get("t7635-conf").win.contains(t) ? "confined" : (t && (t.id || t.className)) || ""; }, spot);
    const zc = await ev(() => +getComputedStyle(H3Panels.get("t7635-conf").win).zIndex);
    check("a docker confined to " + host + ": in the floating band (60-199), not 9300", zc >= 60 && zc < 200, zc);
    check("PODS over it where they overlap", (await under()) === "pods", await under());
    const ct = await ev(() => { const r = H3Panels.get("t7635-conf").win.querySelector(".h3fp-t").getBoundingClientRect(); return { x: r.right - 60, y: r.top + r.height / 2 }; });
    await p.mouse.click(ct.x, ct.y); await p.waitForTimeout(200);
    check("…the confined docker pressed: PODS STAYS in front of it", (await under()) === "pods", await under());
    // a ▣ docker pressed: PODS stays in front too
    await ev(() => H3Panels.show("t7635-conf", false));
    await ev(() => H3DockGroup.toggle(true)); await p.waitForFunction(() => H3DockGroup.shown(), null, { timeout: 8000 });
    await ev((r) => H3Panels.float("fd-dockers", { x: Math.round(r.l), y: Math.round(r.t + 20), w: 700, h: 500 }), hr);
    await p.waitForTimeout(500);
    const gt = await ev(() => { const r = H3Panels.get("fd-dockers").win.querySelector(".h3fp-t").getBoundingClientRect(); return { x: r.left + r.width * 0.8, y: r.top + r.height / 2 }; });
    await p.mouse.click(gt.x, gt.y); await p.waitForTimeout(200);
    const zz = await ev(() => ({ pods: +getComputedStyle(document.getElementById("sf-pods")).zIndex, g: +getComputedStyle(H3Panels.get("fd-dockers").win).zIndex }));
    check("a ▣ docker pressed: PODS stays in front of it (floating dialogs over every docker)", (await under()) === "pods" && zz.pods > zz.g, zz);
    await p.mouse.click(spot.x, spot.y); await p.waitForTimeout(200);
    await ev(() => H3DockGroup.toggle(false));

    /* ---- 3 the 💲 RunPod docker */
    const bs = await ev(() => { const b = document.getElementById("gpuRpDock"); return { has: !!b, shown: !!b && b.style.display !== "none", inGpu: !!b && !!b.closest("#rgdOpts"), cost: !!document.getElementById("gpuPodCost") }; });
    check("the ☁ Remote generation docker (2.768.0 - the remote options moved there from Basic Settings ▸ GPU): a 💲 RunPod button (RunPod chosen) and no 💲 cost line any more", bs.has && bs.shown && bs.inGpu && !bs.cost, bs);
    await ev(() => { SecFloat.show("runpod", false); document.getElementById("gpuRpDock").click(); });
    await p.waitForFunction(() => document.getElementById("rpBalance") && document.querySelector("#rpPods tbody tr") && document.querySelector("#rpGpus tbody tr"), null, { timeout: 15000 }).catch(() => {});
    const rp = await ev(() => ({ shown: (SecFloat.state("runpod") || {}).shown, bal: (document.getElementById("rpBalance") || {}).textContent, spend: (document.getElementById("rpSpend") || {}).textContent, lasts: (document.getElementById("rpLasts") || {}).textContent,
      cost: (document.getElementById("rpCost") || {}).textContent, pods: [...document.querySelectorAll("#rpPods tbody tr")].map((r) => r.dataset.rppod), gpus: [...document.querySelectorAll("#rpGpus tbody tr")].map((r) => r.dataset.rpgpu),
      off: !!document.querySelector('#rpGpus tr[data-rpgpu="NVIDIA H100"].off'), pressed: document.getElementById("gpuRpDock").getAttribute("aria-pressed") }));
    check("💲 RunPod opens its docker: the balance, spending now, how long it lasts", rp.shown && /42\.5/.test(rp.bal) && /0\.85/.test(rp.spend) && /about 2 days|about 50 h/.test(rp.lasts), rp);
    check("…usage: running now, today, this month; each pod (and a terminated one still on the bill)", /1\.23/.test(rp.cost) && /17\.5/.test(rp.cost) && /Running now/.test(rp.cost) && rp.pods.join(",") === "pod7635a,podGone", rp);
    check("…GPU prices: cheapest first, none free greyed at the end; the button lit", rp.gpus.join(",") === "NVIDIA A40,NVIDIA RTX 4090,NVIDIA H100" && rp.off && rp.pressed === "true", rp);
    await p.fill("#rpQ", "4090"); await p.waitForTimeout(150);
    const f1 = await ev(() => [...document.querySelectorAll("#rpGpus tbody tr")].map((r) => r.dataset.rpgpu));
    await p.fill("#rpQ", ""); await p.selectOption("#rpSort", "memory"); await p.waitForTimeout(150);
    const f2 = await ev(() => [...document.querySelectorAll("#rpGpus tbody tr")].map((r) => r.dataset.rpgpu));
    await p.selectOption("#rpCloud", "COMMUNITY"); await p.waitForTimeout(800);
    const f3 = await ev(() => document.querySelector('#rpGpus tr[data-rpgpu="NVIDIA RTX 4090"] td:nth-child(3)').textContent);
    check("…search (\"4090\"), most memory first, Community cloud's prices", f1.join() === "NVIDIA RTX 4090" && f2[0] === "NVIDIA H100" && /0\.34/.test(f3), { f1, f2, f3 });
    const a0 = acctAsked; await p.click("#rpRefresh"); await p.waitForTimeout(600);
    check("🔄 asks again", acctAsked > a0, { a0, acctAsked });
    await ev(() => { SecFloat.show("pods", true); }); await p.waitForTimeout(300);
    await ev(() => SecFloat.show("runpod", false)); await p.click("#pdRpDock"); await p.waitForTimeout(300);
    check("the PODS docker's 💲 RunPod opens it too", await ev(() => !!(SecFloat.state("runpod") || {}).shown));
    // the 💲 RunPod docker goes into a docker like the others
    await ev(() => { H3Panels.show("t7635-mine", true); H3Panels.float("t7635-mine", { x: 420, y: 140, w: 980, h: 720 }); SecFloat.windows.runpod.panel.float(60, 80, 520, 420); SecFloat.show("runpod", true); });
    await p.waitForTimeout(500);
    await dragTo(await head("runpod"), await pane());
    check("the 💲 RunPod docker goes into a ▣ New docker… docker too", (await stateOf("sf.runpod")) === "in>t7635-mine", await stateOf("sf.runpod"));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run finished", false, String(e && e.stack || e)); }
  finally {
    try { await ev(() => { for (const i of ["sf.pods", "sf.basic", "sf.llmtok", "sf.runpod"]) if (H3Panels.get(i) && H3Panels.get(i).state === "in") H3Panels.float(i); for (const i of ["t7635-mine", "t7635-conf"]) if (H3Panels.get(i)) H3Panels.remove(i); SecFloat.show("pods", false); SecFloat.show("runpod", false); }); await p.waitForTimeout(800); } catch { /* fine */ }
    await b.close();
    if (lay0) fs.writeFileSync(LAYF, lay0); else fs.rmSync(LAYF, { force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
