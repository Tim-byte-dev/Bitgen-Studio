#!/usr/bin/env node
/* bitGen Studio — 2.968.0 in a REAL browser: the Timeline docker's technical look (Tim: "is it possible to make the timeline
 * docker look technical like you did with the synth tab?"). Against the running app (H3_URL): the class is on by default,
 * the Synth's colours are what the browser draws, NOTHING MOVES between the two looks (every clip, header and the ruler in
 * the same place), the grid follows the zoom, and ⚙ Timeline settings ▸ Look ▸ Classic saves and takes it off (put back
 * after). */
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 3000, height: 1500 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let orig = null;
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.TlLook && window.TimelineSettings && typeof renderTimeline === "function" && typeof cfg === "object" && cfg, null, { timeout: 60000 });
    orig = await ev(() => (cfg.ui || {}).tl_look || null);
    if (orig === "classic") await ev(() => { cfg.ui.tl_look = "tech"; window.TlLook.set("tech"); });
    await ev(() => { window.__tl968 = JSON.parse(JSON.stringify({ video: tl.video, audio: tl.audio, images: tl.images }));
      tl.video = [{ name: "ui968_a.mp4", start: 0, in: 0, out: 6 }, { name: "ui968_b.mp4", start: 6, in: 0, out: 5 }];
      tl.audio = [{ name: "Music", clips: [{ name: "ui968.wav", start: 1, in: 0, out: 9, src: "sound" }] }];
      tl.images = [{ name: "Logo", clips: [{ name: "ui968.png", start: 2, len: 4, opacity: 0.8 }] }];
      renderTimeline(); window.toggleMax("timelinedock", true); });          // maximized: whatever size an earlier run left it at
    await sleep(500);
    const geo = () => ev(() => { const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)].join(); };
      return { clips: [...document.querySelectorAll("#tlinner .clip")].map(r), heads: [...document.querySelectorAll("#tlinner .tlab")].map(r), ruler: r(document.querySelector("#tlinner .tlruler")),
        tracks: [...document.querySelectorAll("#tlinner .tltrack")].map((e) => Math.round(e.getBoundingClientRect().height)).join() }; });
    const look = () => ev(() => { const cs = (q, k) => { const e = document.querySelector(q); return e ? getComputedStyle(e)[k] : null; };
      return { on: document.getElementById("timelinedock").classList.contains("tl-tech"), scroll: cs("#tlscroll", "backgroundColor"), ph: cs("#tlPh", "color"),
        phFont: cs("#tlPh", "fontFamily"), cn: cs("#tlinner .clip .cn", "fontFamily"), audioBorder: cs("#tlinner .clip.audio", "borderTopColor"), shadow: cs("#tlinner .clip", "boxShadow"),
        layers: getComputedStyle(document.querySelector("#tlinner .tlruler"), "::before").content, edit: getComputedStyle(document.getElementById("tlbar"), "::before").content,
        float: (() => { const h = document.querySelector("#tlFloat h2"); return h ? getComputedStyle(h).color : null; })() }; });
    const t1 = await look(), g1 = await geo();
    check("the technical look is on by default: the dark scroll box, LCD readouts in cyan, mono clip names, the LAYERS / EDIT labels, clips that glow",
      t1.on && t1.scroll === "rgb(7, 9, 12)" && t1.ph === "rgb(56, 225, 255)" && /monospace|Consolas/.test(t1.phFont) && /monospace|Consolas/.test(t1.cn) && t1.layers === '"LAYERS"' && t1.edit === '"EDIT"' && /rgba?\(/.test(t1.shadow) && t1.shadow !== "none", t1);
    check("each layer keeps its colour: the audio clip's edge is its layer's colour (not the old #4a6e8a)", t1.audioBorder && t1.audioBorder !== "rgb(74, 110, 138)", t1.audioBorder);
    check("🧰 Tools & Properties (the timeline's own panel) wears it too: a cyan title", t1.float === "rgb(56, 225, 255)", t1.float);
    const hitSplit = await ev(() => { const sp = document.getElementById("tlStageSplit"); if (!sp || !sp.getClientRects().length) return "hidden";
      if (window.TlFloat && TlFloat.show) TlFloat.show(false);              // 🧰 floats wherever it was left - it may sit over the bar
      const r = sp.getBoundingClientRect(), xs = [r.left + 20, r.left + r.width / 2, r.right - 20], ys = [r.top + 0.5, r.top + r.height / 2, r.bottom - 0.5];
      const bad = []; xs.forEach((x) => ys.forEach((y) => { const e = document.elementFromPoint(x, y); if (e !== sp) bad.push(Math.round(x) + "," + y.toFixed(1) + " " + (e ? (e.id || e.className || e.tagName) : "none")); }));
      if (window.TlFloat && TlFloat.show) TlFloat.show(true);
      return bad.length ? bad : true; });
    check("the preview's resize bar above the menu bar still gets the mouse everywhere (the EDIT label is click-through, the bar does not reach up)", hitSplit === true || hitSplit === "hidden", hitSplit);
    // the grid follows the zoom
    const z = await ev(async () => { const out = []; const zr = document.getElementById("tlZoom"), v0 = zr.value;
      for (const v of ["0", "60", "100"]) { zr.value = v; zr.dispatchEvent(new Event("input", { bubbles: true })); await new Promise((r) => setTimeout(r, 120));
        const st = document.getElementById("tlinner").style; out.push({ pxs: PXS, g: parseFloat(st.getPropertyValue("--tgrid")), g2: parseFloat(st.getPropertyValue("--tgrid2")) }); }
      zr.value = v0; zr.dispatchEvent(new Event("input", { bubbles: true })); await new Promise((r) => setTimeout(r, 120)); return out; });
    const stepOk = z.every((q) => { const step = q.pxs >= 96 ? 1 : q.pxs >= 24 ? 5 : 15; const want = Math.max(12, q.pxs * step); return Math.abs(q.g - want) < 0.01 && (Math.abs(q.g2 - want / 5) < 0.01 || (want / 5 < 10 && Math.abs(q.g2 - want) < 0.01)); });
    check("the grid follows the zoom: a line at the ruler's step (1 / 5 / 15 s), a faint one every fifth", stepOk && new Set(z.map((q) => q.g)).size > 1, z);
    await sleep(200);
    const g1b = await geo();
    // ⚙ Timeline settings ▸ Look ▸ Classic
    await ev(() => window.TimelineSettings.open("look"));
    await p.waitForSelector("#tlsDlg[open] #tlsLookClassic", { timeout: 8000 });
    const radios = await ev(() => ({ tech: document.getElementById("tlsLookTech").checked, classic: document.getElementById("tlsLookClassic").checked, tab: !!document.querySelector('#tlsDlg [data-tlstab="look"].on') }));
    await p.check("#tlsLookClassic"); await p.click("#tlsSave");
    await p.waitForFunction(() => !document.querySelector("#tlsDlg[open]"), null, { timeout: 8000 });
    await sleep(250);
    const t2 = await look(), g2 = await geo();
    const saved = await ev(() => fetch("/api/config").then((r) => r.json()).then((c) => (c.ui || {}).tl_look));
    check("⚙ Timeline settings ▸ Look opens on Technical; Classic + Save: saved (ui.tl_look classic), the warm look is back at once", radios.tech && !radios.classic && radios.tab && saved === "classic" && !t2.on && t2.scroll === "rgb(15, 13, 10)" && t2.edit === "none" && t2.float !== "rgb(56, 225, 255)", { radios, saved, t2 });
    check("NOTHING MOVES between the two looks: every clip, every layer header, the ruler and every track's height the same", JSON.stringify(g2) === JSON.stringify(g1b) && JSON.stringify(g1) === JSON.stringify(g1b), { tech: g1b, classic: g2 });
    // a fresh page keeps Classic (from the settings file)
    const p2 = await b.newPage({ viewport: { width: 1600, height: 1000 } });
    await p2.goto(URL_, { waitUntil: "domcontentloaded" });
    await p2.waitForFunction(() => window.TlLook && typeof cfg === "object" && cfg, null, { timeout: 60000 });
    await p2.waitForFunction(() => !document.getElementById("timelinedock").classList.contains("tl-tech"), null, { timeout: 8000 }).catch(() => {});
    const k2 = await p2.evaluate(() => document.getElementById("timelinedock").classList.contains("tl-tech"));
    await p2.close();
    check("a fresh page keeps Classic (the settings file says so)", k2 === false, k2);
    // back to Technical through the dialog
    await ev(() => window.TimelineSettings.open("look"));
    await p.waitForSelector("#tlsDlg[open] #tlsLookTech", { timeout: 8000 });
    await p.check("#tlsLookTech"); await p.click("#tlsSave");
    await p.waitForFunction(() => document.getElementById("timelinedock").classList.contains("tl-tech"), null, { timeout: 8000 });
    check("Technical + Save: on again", (await look()).on);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try {
      await ev((o) => { window.toggleMax("timelinedock", false); if (window.__tl968) { Object.assign(tl, window.__tl968); renderTimeline(); }
        return fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ui: { tl_look: o || "tech" } }) }); }, orig);
      await sleep(900);
    } catch (e) { /* gone */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
