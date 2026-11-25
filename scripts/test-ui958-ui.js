#!/usr/bin/env node
/* bitGen Studio — 2.958.0 in a REAL browser (Tim: "continue" - the mixer with per-layer effects and meters, the metronome and the
 * count-in, timeline markers, stems). Against the running app (H3_URL). */
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
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const tl = () => ev(() => window.H3SynthTL.tl());
  const madeFiles = [];
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthMix && window.H3SynthClick && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady && document.querySelector("#synthdock .autabs"), null, { timeout: 60000 });
    await ev(() => { window.H3Audio.tab("synthdock"); window.toggleMax("synthdock", true); window.H3Synth.fold("rack", true); window.H3Synth.fold("keys", true); window.H3Synth.fold("loop", true); }); await sleep(600);
    await p.click("#syBody", { position: { x: 900, y: 6 } });
    await ev(async () => { window.H3SynthTL.setTL(null); await window.H3SynthTL.addClip("kit:crash", 0, 0); await window.H3SynthTL.addClip("kit:boom", 1, 0.25); });
    /* ---- the mixer */
    await p.click("#syTMixBtn"); await sleep(200);
    const mx = await ev(() => ({ info: window.H3SynthMix.info(), knobs: [...document.querySelectorAll('#syMix .systrip[data-l="0"] [data-mix]')].map((k) => k.dataset.mix) }));
    check("🎚 Mixer: a strip per layer (4) + master; each: a meter, Vol, Pan, Low / Mid / High, Comp, Rev, M / S", mx.info.open && mx.info.strips === 5 && mx.knobs.join() === "vol,pan,lo,mid,hi,comp,rev"
      && (await ev(() => document.querySelectorAll("#syMix canvas.symeter").length)) === 5, mx);
    await p.focus('#syMix .systrip[data-l="0"] [data-mix="hi"]'); for (let i = 0; i < 6; i++) await p.keyboard.press("ArrowDown");
    await p.focus('#syMix .systrip[data-l="1"] [data-mix="rev"]'); for (let i = 0; i < 10; i++) await p.keyboard.press("ArrowUp");
    await p.focus('#syMix .systrip[data-l="1"] [data-mix="comp"]'); for (let i = 0; i < 5; i++) await p.keyboard.press("ArrowUp");
    const fx = await ev(() => window.H3SynthTL.tl().layers.slice(0, 2).map((l) => l.fx));
    check("the knobs set the layer's effects (High cut on layer 1, Rev + Comp on layer 2) - kept in the timeline", fx[0].hi < -1 && fx[1].rev >= 0.09 && fx[1].comp >= 0.04, fx);
    // the effects change the sound: the reverb makes layer 2 ring after its sound ends
    const tail = await ev(async () => { const r = await window.H3SynthTL.render(48000, 1); const d = r.chans[0], a = Math.floor(1.6 * 48000); let m = 0; for (let i = a; i < Math.min(d.length, a + 4800); i++) m = Math.max(m, Math.abs(d[i])); return m; });
    await ev(() => { window.H3SynthTL.tl().layers[1].fx.rev = 0; });
    const dry = await ev(async () => { const r = await window.H3SynthTL.render(48000, 1); const d = r.chans[0], a = Math.floor(1.6 * 48000); let m = 0; for (let i = a; i < Math.min(d.length, a + 4800); i++) m = Math.max(m, Math.abs(d[i])); return m; });
    check("…heard in the mix (the reverb send rings on after the sound - louder than dry)", tail > dry * 1.2 && tail > 0.0005, { tail, dry });
    await ev(() => { window.H3SynthTL.tl().layers[1].fx.rev = 0.4; window.H3SynthTL.changedFx(); });
    await ev(() => window.H3SynthTL.seek(0)); await p.click("#syTPlay"); await sleep(500);
    const hold = await ev(() => window.H3SynthMix.info().hold);
    await p.click("#syTPlay");
    check("▶ Play: the meters move (layer 1 and the master)", hold["0"] && hold["0"].v > -40 && hold.master && hold.master.v > -40, hold);
    /* ---- the metronome */
    await p.click("#syClick");
    check("🕒 Click: on (kept)", (await ev(() => window.H3Synth.clickOn())) && (await ev(() => localStorage.getItem("h3.synth.click"))) === "1");
    await ev(() => window.H3SynthTL.seek(0)); await p.click("#syTPlay"); await sleep(300);
    const clk = (await ev(() => window.H3SynthTL.info())).clicking;
    await p.click("#syTPlay");
    check("…the timeline's ▶ clicks the beats (and stops with it)", clk && !(await ev(() => window.H3SynthTL.info())).clicking);
    const times = await ev(() => window.H3SynthClick.times(120, 0, 2.01, 4).map((c) => (c.accent ? "A" : "b") + c.t).join());
    check("the click: every beat at the BPM, the bar's first one higher", times === "A0,b0.5,b1,b1.5,A2", times);
    // count-in: 1 bar at 120 = 2 s before ● starts
    await ev(() => window.H3Synth.fold("keys", false)); await sleep(200);
    await p.selectOption("#syCount", "1");
    await p.click("#syScRec"); await sleep(600);
    const during = await ev(() => window.H3SynthScore.info().mode);
    await sleep(1800);
    const after = await ev(() => window.H3SynthScore.info().mode);
    check("Count-in 1 bar: ● waits a bar of clicks (2 s at 120 BPM), then records", during === "idle" && after === "rec", { during, after });
    await ev(() => { window.H3Synth.noteOn(60, 0.8); }); await sleep(200); await ev(() => window.H3Synth.noteOff(60));
    await p.click("#syScStop");
    await p.waitForFunction(() => window.H3SynthScore.take() && window.H3SynthScore.take().file, null, { timeout: 15000 });
    madeFiles.push(await ev(() => window.H3SynthScore.take().file));
    await p.selectOption("#syCount", "0"); await p.click("#syClick");
    /* ---- markers */
    await ev(() => window.H3SynthTL.seek(0.5)); await p.click("#syTMark");
    await ev(() => window.H3SynthTL.seek(1.5)); await p.focus("#syTCanvas"); await p.keyboard.press("m");
    let mk = (await tl()).markers;
    check("⚑ Marker at the playhead (and M on the timeline)", mk.length === 2 && mk[0].t === 0.5 && mk[1].t === 1.5 && mk[0].name === "Marker 1", mk);
    const G = await ev(() => window.H3SynthTL.geo()), cvb = await p.locator("#syTCanvas").boundingBox();
    await ev(() => window.H3SynthTL.seek(0));
    await p.mouse.click(cvb.x + 1.5 * G.zoom - G.scroll + 2, cvb.y + 15);
    check("click a marker on the ruler = the playhead goes there", Math.abs((await ev(() => window.H3SynthTL.info().ph)) - 1.5) < 1e-9);
    await p.mouse.dblclick(cvb.x + 0.5 * G.zoom - G.scroll + 2, cvb.y + 15); await p.waitForSelector("#syDlg input");
    await p.fill("#syDlg input", "Chorus"); await p.click("#syDlg [data-ok]"); await sleep(150);
    check("double-click a marker = rename it", (await tl()).markers[0].name === "Chorus");
    await p.mouse.click(cvb.x + 1.5 * G.zoom - G.scroll + 2, cvb.y + 15, { button: "right" });
    check("right-click = gone", (await tl()).markers.length === 1);
    /* ---- stems */
    const st = await ev(() => window.H3SynthTL.stems());
    const snd = await ev(() => fetch("/api/synth/sources").then((r) => r.json()).then((j) => j.groups.find((g) => g.id === "snd").items.map((i) => i.name)));
    check("⬇ Stems: each layer with sounds rendered alone into the Sound assets (timeline - Layer 1, - Layer 2)", st.length === 2 && st.every((n) => snd.includes(n)) && /Layer 1/.test(st[0]) && /Layer 2/.test(st[1]), { st });
    /* ---- undo covers the mixer */
    await ev(() => window.H3Synth.commit());
    await ev(() => { window.H3SynthTL.tl().layers[0].fx.lo = 9; window.H3SynthTL.changedFx(); }); await sleep(500);
    await ev(() => window.H3Synth.undo()); await sleep(100);
    check("↶ undoes a mixer change", (await tl()).layers[0].fx.lo !== 9);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try {
      for (const n of madeFiles) { await ev((nm) => fetch("/api/synth/files/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm }) }), n);
        await ev((nm) => fetch("/api/synth/samples/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm.replace(/\.sfx$/, ".wav") }) }), n); }
      await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    } catch (e) { /* gone */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
