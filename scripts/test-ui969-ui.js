#!/usr/bin/env node
/* bitGen Studio — 2.969.0 in a REAL browser: the Timeline docker's 🎛 DECK (Tim: "can you add knobs and sliders and slide
 * wheels like and jog wheels? for a cool aesthetic?"). Every control driven with the mouse against the running app (H3_URL):
 * the jog (frames), the shuttle ring (plays at 1x..8x while held, stops when let go), the ZOOM and SPEED wheels, the transport
 * keys, the picked layer's knobs and fader (written to the layer, saved), which layers have which, the DECK tab, the
 * columns of a short docker and stepping aside when there is no room. The timeline is put back after. */
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
  const ctx = await b.newContext({ viewport: { width: 3000, height: 1500 } });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const info = () => ev(() => window.TlDeck.info());
  const box = (sel) => ev((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; }, sel);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.TlDeck && window.TlCanvas && typeof renderTimeline === "function", null, { timeout: 60000 });
    await ev(() => { window.__tl969 = JSON.parse(JSON.stringify({ video: tl.video, audio: tl.audio, images: tl.images, vlayers: tl.vlayers, sel: tl.selLayer, z: document.getElementById("tlZoom").value, sp: (document.getElementById("tlCSpeed") || {}).value }));
      tl.video = [{ name: "ui969_a.mp4", start: 0, in: 0, out: 6 }, { name: "ui969_b.mp4", start: 6, in: 0, out: 6 }];
      tl.audio = [{ name: "Music", clips: [{ name: "ui969.wav", start: 0, in: 0, out: 12, src: "sound" }] }];
      tl.images = [{ name: "Logo", clips: [{ name: "ui969.png", start: 1, len: 4, opacity: 1 }] }];
      tl.selLayer = null; renderTimeline(); window.toggleMax("timelinedock", true); window.TlFloat && TlFloat.show(false); TlDeck.show(true); TlCanvas.pause(); TlCanvas.go(0); });
    await sleep(700);
    const i0 = await info();
    const look = await ev(() => { const d = document.getElementById("tlDeck"), r = d.getBoundingClientRect(), s = document.getElementById("tlscroll").getBoundingClientRect(), t = document.getElementById("tlDeckTog").getBoundingClientRect();
      return { deck: [Math.round(r.left), Math.round(r.width)], scrollLeft: Math.round(s.left), tabRight: Math.round(t.right), tc: document.getElementById("tlDeckTc").textContent, layer: document.getElementById("tlDeckLayer").textContent,
               knobsOff: document.querySelectorAll(".tdk-knob.off").length, faderOff: document.querySelector(".tdk-fader").classList.contains("off") }; });
    check("the deck shows beside the layers (the tab, then the deck, then the layers - no overlap), LCD at 0:00:00:00; no layer picked = knobs and fader off",
      i0.shown && !i0.squeezed && look.deck[0] >= look.tabRight && look.scrollLeft >= look.deck[0] + look.deck[1] && look.tc === "0:00:00:00" && /no layer picked/.test(look.layer) && look.knobsOff === 3 && look.faderOff, { i0, look });

    // JOG: drag round the middle of the wheel - clockwise moves on, a frame per 15°
    const jb = await box("#tlDeckJog");
    const R = jb.w * 0.3, pt = (deg) => [jb.cx + Math.sin(deg * Math.PI / 180) * R, jb.cy - Math.cos(deg * Math.PI / 180) * R];
    await p.mouse.move(...pt(0)); await p.mouse.down();
    for (let d = 10; d <= 95; d += 5) await p.mouse.move(...pt(d));
    await p.mouse.up(); await sleep(200);
    const j1 = await ev(() => ({ ph: playhead, t: TlCanvas.state.t, tc: document.getElementById("tlDeckTc").textContent, jogA: TlDeck.info().jogA }));
    const f1 = Math.round(j1.ph * 24);
    check("JOG: turned 95° clockwise = 6 frames on (a frame per 15°); the marker and the LCD follow", f1 === 6 && Math.abs(j1.t - j1.ph) < 1e-6 && j1.tc === "0:00:00:06" && j1.jogA > 1.5, j1);
    for (let k = 0; k < 3; k++) { await p.mouse.move(jb.cx, jb.cy); await p.mouse.wheel(0, -100); }
    await sleep(150);
    const j2 = Math.round((await ev(() => playhead)) * 24);
    await ev(() => TlCanvas.go(10 / 24));
    await p.mouse.move(...pt(90)); await p.mouse.down();
    for (let d = 80; d >= 15; d -= 5) await p.mouse.move(...pt(d));
    await p.mouse.up(); await sleep(150);
    const j3 = Math.round((await ev(() => playhead)) * 24);
    check("...the mouse wheel over it: a frame a notch (6 -> 3); turned back 75° from frame 10: 5 frames back (frame 5)", j2 === 3 && j3 === 5, { j2, j3 });

    // SHUTTLE: hold the outer ring right of the top -> plays forwards at 2x; let go -> stops
    await ev(() => { TlCanvas.go(0); });
    const RR = jb.w * 0.46, rp = (deg) => [jb.cx + Math.sin(deg * Math.PI / 180) * RR, jb.cy - Math.cos(deg * Math.PI / 180) * RR];
    await p.mouse.move(...rp(0)); await p.mouse.down(); await p.mouse.move(...rp(30), { steps: 3 }); await p.mouse.move(...rp(55), { steps: 3 });
    await sleep(400);
    const s1 = await info(), st1 = await ev(() => document.getElementById("tlDeckState").textContent);
    await p.mouse.move(...rp(120), { steps: 4 }); await sleep(150);
    const s2 = await info();
    await p.mouse.up(); await sleep(350);
    const s3 = await info();
    check("SHUTTLE: hold the ring at 55° = plays forwards at 2x (the LCD says ▶ 2×), further = 8x; let go = it springs back and stops",
      s1.playing && s1.rate === 2 && s1.shut === 2 && st1 === "▶ 2×" && s2.rate === 8 && !s3.playing && s3.shut === 0 && /STOP/.test(s3.state), { s1, st1, s2, s3 });
    await ev(() => TlCanvas.go(3));
    await p.mouse.move(...rp(0)); await p.mouse.down(); await p.mouse.move(...rp(-25), { steps: 3 }); await sleep(300);
    const s4 = await info(); await p.mouse.up(); await sleep(300);
    check("...left of the top it plays backwards (1x)", s4.playing && s4.rate === -1 && /◀/.test(s4.state), s4);

    // the transport keys
    await ev(() => TlCanvas.go(2));
    await p.click("#tlDeckPlay"); await sleep(250);
    const k1 = await info();
    await p.click("#tlDeckPlay"); await sleep(150);
    const k2 = await info();
    await p.click("#tlDeckFwd"); await sleep(150); await p.click("#tlDeckFwd"); await sleep(150);
    const k3 = await info();
    await p.click("#tlDeckStop"); await sleep(150);
    await p.click("#tlDeckStart"); await sleep(150);
    const k4 = await ev(() => ({ i: TlDeck.info(), ph: playhead }));
    check("the keys: ▶ plays, again pauses; ▶▶ twice = 2x forwards; ■ stops; ⏮ to 0", k1.playing && k1.rate === 1 && !k2.playing && k3.playing && k3.rate === 2 && !k4.i.playing && k4.ph === 0, { k1, k2, k3, k4 });

    // the ZOOM wheel (drag up = zoom in) and the SPEED wheel (a notch at a time)
    const zb = await box("#tlDeckZoom"), z0 = (await info()).zoom;
    await p.mouse.move(zb.cx, zb.cy); await p.mouse.down(); await p.mouse.move(zb.cx, zb.cy - 50, { steps: 5 }); await p.mouse.up(); await sleep(250);
    const z1 = await ev(() => ({ z: +document.getElementById("tlZoom").value, pxs: PXS, lcd: document.getElementById("tlDeckZoomV").textContent }));
    await p.dblclick("#tlDeckZoom"); await sleep(200);
    const z2 = await ev(() => +document.getElementById("tlZoom").value);
    check("ZOOM wheel: rolled up = the timeline zooms in (#tlZoom +20, PXS with it, the LCD says so); double-click = 30", z1.z === z0 + 20 && Math.abs(z1.pxs - zoomPx(z1.z)) < 1e-6 && z1.lcd === "ZOOM " + z1.z && z2 === 30, { z0, z1, z2 });
    function zoomPx(z) { return 2 * Math.pow(96, z / 100); }
    const sb = await box("#tlDeckSpeed");
    await p.mouse.move(sb.cx, sb.cy); await p.mouse.wheel(0, -100); await sleep(150);
    const sp1 = await ev(() => ({ sel: (document.getElementById("tlCSpeed") || {}).value, prate: TlCanvas.state.prate, lab: document.getElementById("tlDeckSpeedV").textContent }));
    await p.mouse.move(sb.cx, sb.cy); await p.mouse.down(); await p.mouse.move(sb.cx, sb.cy + 40, { steps: 6 }); await p.mouse.up(); await sleep(150);
    const sp2 = await ev(() => ({ sel: (document.getElementById("tlCSpeed") || {}).value, prate: TlCanvas.state.prate }));
    await p.dblclick("#tlDeckSpeed"); await sleep(150);
    const sp3 = await ev(() => TlCanvas.state.prate);
    check("SPEED wheel: a notch up = 2x (the transport's speed picker and ▶ follow); rolled down 40 px = 2 notches = 0.5x; double-click = 1x",
      sp1.sel === "2" && sp1.prate === 2 && sp1.lab === "2×" && sp2.sel === "0.5" && sp2.prate === 0.5 && sp3 === 1, { sp1, sp2, sp3 });

    // the picked layer: V1 - the opacity knob, the fade in knob, the volume fader
    await ev(() => { tl.selLayer = "v1"; renderTimeline(); TlDeck.paint(); });
    await sleep(200);
    const kb = await box('.tdk-knob[data-k="opacity"] canvas');
    await p.mouse.move(kb.cx, kb.cy); await p.mouse.down(); await p.mouse.move(kb.cx, kb.cy + 45, { steps: 5 }); await p.mouse.up(); await sleep(250);
    const o1 = await ev(() => ({ L: v1().opacity, deck: TlDeck.info().opacity, val: document.querySelector('.tdk-knob[data-k="opacity"] .tdk-val').textContent, tr: +getComputedStyle(document.querySelector('#tlinner .tltrack[data-lk="v1"]')).opacity, op: document.querySelector('#tlinner .tltrack[data-lk="v1"] .tlab .op').classList.contains("on") }));
    check("OPACITY knob dragged down 45 px = 70%: written to the layer, the track shows it, its ◐ lit (the header redrawn once let go)", Math.abs(o1.L - 0.7) < 0.011 && o1.val === Math.round(o1.L * 100) + "%" && Math.abs(o1.tr - o1.L) < 0.02 && o1.op, o1);
    const fb = await box('.tdk-knob[data-k="fin"] canvas');
    await p.mouse.move(fb.cx, fb.cy); await p.mouse.down(); await p.mouse.move(fb.cx, fb.cy - 30, { steps: 5 }); await p.mouse.up(); await sleep(250);
    const fi = await ev(() => ({ t: v1().transitionIn, val: document.querySelector('.tdk-knob[data-k="fin"] .tdk-val').textContent, tin: document.querySelector('#tlinner .tltrack[data-lk="v1"] .tlab .tin').classList.contains("on") }));
    await p.dblclick('.tdk-knob[data-k="fin"] canvas'); await sleep(250);
    const fi2 = await ev(() => ({ t: v1().transitionIn, val: document.querySelector('.tdk-knob[data-k="fin"] .tdk-val').textContent }));
    check("FADE IN knob up 30 px = a fade of 0.80 s (it had none: a fade; ⇥ lit); double-click = a cut again", fi.t.type === "fade" && Math.abs(fi.t.dur - 0.8) < 0.03 && /^0\.[78]\d s$/.test(fi.val) && fi.tin && fi2.t.type === "none" && fi2.val === "CUT", { fi, fi2 });
    const vb = await box(".tdk-fader .tdk-cap");
    await p.mouse.move(vb.cx, vb.cy); await p.mouse.down(); await p.mouse.move(vb.cx, vb.cy + 41, { steps: 5 }); await p.mouse.up(); await sleep(250);
    const vo = await ev(() => ({ v: v1().volume, m: !!v1().muted, val: document.querySelector(".tdk-fader .tdk-val").textContent }));
    await p.mouse.move(vb.cx, vb.cy + 41); await p.mouse.down(); await p.mouse.move(vb.cx, vb.cy + 140, { steps: 5 }); await p.mouse.up(); await sleep(250);
    const vo2 = await ev(() => ({ v: v1().volume, m: !!v1().muted, val: document.querySelector(".tdk-fader .tdk-val").textContent, icon: document.querySelector('#tlinner .tltrack[data-lk="v1"] .tlab .vol').textContent }));
    check("VOLUME fader: half way down = 50%; all the way = MUTE (L.muted, the header's 🔇)", Math.abs(vo.v - 0.5) < 0.02 && !vo.m && vo.val === "50%" && vo2.v === 0 && vo2.m && vo2.val === "MUTE" && vo2.icon === "🔇", { vo, vo2 });
    const saved = await ev(() => fetch("/api/timelines/current").then((r) => r.ok ? r.json() : null).catch(() => null));
    check("...kept (tlSave): the layer's values are in what the timeline saves", await ev(() => { try { return JSON.stringify(tlSnapshot ? tlSnapshot() : tl).indexOf('"muted":true') >= 0; } catch (e) { return JSON.stringify(tl).indexOf('"muted":true') >= 0; } }), saved && Object.keys(saved));
    // which layers have what
    await ev(() => { tl.selLayer = "a:0"; TlDeck.paint(); });
    const al = await ev(() => ({ op: document.querySelector('.tdk-knob[data-k="opacity"]').classList.contains("off"), fin: document.querySelector('.tdk-knob[data-k="fin"]').classList.contains("off"), vol: document.querySelector(".tdk-fader").classList.contains("off"), name: document.getElementById("tlDeckLayer").textContent }));
    await ev(() => { tl.selLayer = "i:0"; TlDeck.paint(); });
    const il = await ev(() => ({ op: document.querySelector('.tdk-knob[data-k="opacity"]').classList.contains("off"), vol: document.querySelector(".tdk-fader").classList.contains("off"), name: document.getElementById("tlDeckLayer").textContent }));
    check("an audio layer: no opacity knob (off), its fades and volume on; an image layer: opacity on, no volume; the LCD names the layer",
      al.op && !al.fin && !al.vol && /Music/.test(al.name) && !il.op && il.vol && /Logo/.test(il.name), { al, il });

    // the DECK tab hides it: the layers get the room; it comes back the same way, and is remembered
    const w0 = (await box("#tlscroll")).w;
    await p.click("#tlDeckTog"); await sleep(250);
    const h1 = await ev(() => ({ hidden: document.getElementById("tlDeck").hidden, ls: localStorage.getItem("h3.tl.deck"), tab: document.getElementById("tlDeckTog").getAttribute("aria-pressed") }));
    const w1 = (await box("#tlscroll")).w;
    await p.click("#tlDeckTog"); await sleep(250);
    const w2 = (await box("#tlscroll")).w;
    check("the DECK tab: hides it (remembered: h3.tl.deck 0) and the layers widen by its width; again = back", h1.hidden && h1.ls === "0" && h1.tab === "false" && w1 > w0 + 200 && Math.abs(w2 - w0) < 2, { h1, w0, w1, w2 });

    // a short docker: side by side columns, never more than 40% of the row; no room = it steps aside
    await ev(() => { window.toggleMax("timelinedock", false); const s = document.getElementById("tlStageTog"); if (s.classList.contains("on")) s.click(); document.getElementById("timelinedock").style.height = "430px"; });
    await sleep(500);
    const c1 = await ev(() => ({ cols: TlDeck.layout(), sq: TlDeck.info().squeezed, rowW: document.getElementById("tlDeckRow").clientWidth, rowH: document.getElementById("tlDeckRow").clientHeight, deckW: document.getElementById("tlDeck").offsetWidth, deckH: document.getElementById("tlDeck").scrollHeight }));
    await ev(() => { document.getElementById("timelinedock").style.height = "300px"; });
    await sleep(500);
    const c2 = await ev(() => ({ cols: TlDeck.layout(), sq: TlDeck.info().squeezed, rowH: document.getElementById("tlDeckRow").clientHeight, shown: document.getElementById("tlDeck").offsetWidth > 0, space: document.getElementById("tlDeckSpace").offsetWidth }));
    check("a short docker: the sections side by side (2 or 3 columns within 40% of the row - it only scrolls when that cap binds); too short = the deck steps aside and gives the room back",
      !c1.sq && c1.cols >= 2 && c1.deckW <= c1.rowW * 0.4 + 30 && (c1.deckH <= c1.rowH + 2 || c1.cols === Math.floor(c1.rowW * 0.4 / 242)) && (c2.rowH >= 120 || (c2.sq && !c2.shown && c2.space === 0)), { c1, c2 });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try {
      await ev(() => { const s0 = window.__tl969; document.getElementById("timelinedock").style.height = ""; const s = document.getElementById("tlStageTog"); if (s && !s.classList.contains("on")) s.click();
        window.toggleMax("timelinedock", false); window.TlFloat && TlFloat.show(true); TlCanvas.pause();
        if (s0) { tl.video = s0.video; tl.audio = s0.audio; tl.images = s0.images; tl.vlayers = s0.vlayers; tl.selLayer = s0.sel; TlDeck.zoom(+s0.z || 30); if (s0.sp) { const c = document.getElementById("tlCSpeed"); if (c) { c.value = s0.sp; c.dispatchEvent(new Event("change", { bubbles: true })); } } tlSave(); renderTimeline(); }
        localStorage.removeItem("h3.tl.deck"); });
      await sleep(900);
    } catch (e) { /* gone */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
