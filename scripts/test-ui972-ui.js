#!/usr/bin/env node
/* bitGen Studio — 2.972.0 in a REAL browser: the 🎹 EDIT BOOTH tab and its keyboard's INSTRUMENTS.
 *   the Audio docker's tab reads "🎹 Edit Booth"; the VOICE row over the keys (14 banks), a bank's button picks its first voice,
 *   again the next, the voice's name lit; the patch list grouped by bank; MIDI program change.
 *   Sounds rendered in the page's own engine (OfflineAudioContext) and MEASURED: every voice of every bank sounds (no silence,
 *   no NaN, no clipping), the pitched ones in tune; a piano note dies away, an organ note holds, a soft piano note is darker
 *   than a hard one; FM / organ / string notes all play live from the keys.
 * Tim: "change synth tab name in audio docker to Edit Booth. Add preset instruments to the keyboard like piano, organ, and all
 * the other synthesized sounds on the electronic keyboards" */
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
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 1200))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] }), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let before = null;
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Synth && window.H3Audio && window.H3SynthInst, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    before = await ev(() => window.H3Synth.info().preset);
    await ev(() => { H3Audio.tab("synthdock"); toggleMax("synthdock", true); });
    await p.waitForTimeout(800);
    await p.click("#syBody", { position: { x: 900, y: 6 } });

    const tabs = await ev(() => [...document.querySelectorAll("#synthdock [data-autab]")].map((x) => x.textContent).join("|"));
    check("the Audio docker's third tab is 🎹 Edit Booth", tabs === "🎵 Music|💥 SFX|🎹 Edit Booth", tabs);

    const row = await ev(() => ({ btns: [...document.querySelectorAll("#syVoiceGrid .syvb")].map((x) => x.textContent), cats: H3SynthCore.CATS.map((c) => c[1]),
      above: document.getElementById("syVoice").getBoundingClientRect().bottom <= document.getElementById("syPiano").getBoundingClientRect().top + 1,
      groups: [...document.querySelectorAll("#syPreset optgroup")].map((g) => g.label) }));
    check("the VOICE row over the keys: PIANO MALLET ORGAN GUITAR BASS STRINGS CHOIR BRASS REED PIPE LEAD PAD WORLD SYNTH",
      row.btns.join(" ") === "PIANO MALLET ORGAN GUITAR BASS STRINGS CHOIR BRASS REED PIPE LEAD PAD WORLD SYNTH" && row.btns.join() === row.cats.join() && row.above, row);
    check("the patch list grouped by bank (🎹 Piano … 🎛 Synth)", row.groups.slice(0, 3).join("|") === "🎹 Piano|🔔 Mallets|⛪ Organ" && row.groups.includes("🎛 Synth") && row.groups.length >= 14, row.groups);

    await p.click('#syVoiceGrid .syvb[data-cat="Piano"]'); await p.waitForTimeout(200);
    const v1 = await ev(() => ({ preset: H3Synth.info().preset, bank: H3Synth.info().bank, lit: [...document.querySelectorAll("#syVoiceGrid .syvb.on")].map((x) => x.dataset.cat), name: document.getElementById("syVoiceName").textContent, sel: document.getElementById("syPreset").value }));
    await p.click('#syVoiceGrid .syvb[data-cat="Piano"]'); await p.waitForTimeout(200);
    const v2 = await ev(() => ({ preset: H3Synth.info().preset, name: document.getElementById("syVoiceName").textContent }));
    await p.click('#syVoiceGrid .syvb[data-cat="Organ"]'); await p.waitForTimeout(200);
    const v3 = await ev(() => ({ preset: H3Synth.info().preset, lit: [...document.querySelectorAll("#syVoiceGrid .syvb.on")].map((x) => x.dataset.cat), tone: H3Synth.info().p.tone, bars: H3Synth.info().p.bars }));
    check("PIANO = Grand Piano (lit, its name on the row's screen, the list follows); again = Bright Piano; ORGAN = Drawbar Organ (drawbars 888000000)",
      v1.preset === "o:Grand Piano" && v1.bank === "Piano" && v1.lit.join() === "Piano" && v1.name === "Grand Piano" && v1.sel === "o:Grand Piano"
      && v2.preset === "o:Bright Piano" && v2.name === "Bright Piano" && v3.preset === "o:Drawbar Organ" && v3.lit.join() === "Organ" && v3.tone === "organ" && v3.bars === "888000000", { v1, v2, v3 });
    const lastWrap = await ev(() => { const n = H3SynthCore.bank("World").length; let r; for (let i = 0; i <= n; i++) r = H3Synth.voice("World"); return r; });
    check("a bank goes round: past its last voice back to its first", lastWrap === "Koto", lastWrap);
    const pc = await ev(() => { H3Synth.midi([0xC0, 1]); const a = H3Synth.info().preset; H3Synth.midi([0xC0, 20]); return [a, H3Synth.info().preset]; });
    check("MIDI program change picks the n-th patch (1 = Grand Piano)", pc[0] === "o:Grand Piano" && pc[1] === "o:" + (await ev(() => H3SynthCore.PRESETS[20].name)), pc);

    // ---- every voice rendered by the engine and measured
    const all = await ev(async () => {
      const C = H3SynthCore, sr = 48000, out = [];
      const rms = (x, a, b) => { a = Math.round(a * sr); b = Math.min(x.length, Math.round(b * sr)); let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };
      const pitch = (x, lo, hi, at) => { let best = -1, bl = 0; const s = Math.round(sr * at), n = 4096; for (let L = Math.floor(sr / hi); L <= Math.ceil(sr / lo); L++) { let r = 0; for (let i = 0; i < n; i++) r += x[s + i] * x[s + i + L]; if (r > best) { best = r; bl = L; } } return sr / bl; };
      for (const x of C.PRESETS) {
        const pt = C.patch(x.name), m = 57 + (pt.aOct < 0 ? 12 : 0) - (pt.aOct > 0 ? 12 : 0);   // A3 (A4 for the low voices, A2 for the high ones)
        const r = await H3SynthVoice.sampleNote(pt, m, 0.8, sr), d = r.chans[0];
        let pk = 0, nan = false; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a !== a) nan = true; else if (a > pk) pk = a; }
        const f = 440 * Math.pow(2, (m + 12 * pt.aOct - 69) / 12);
        out.push({ name: x.name, cat: x.cat, tone: pt.tone, pk: +pk.toFixed(3), nan, early: +rms(d, 0.05, 0.25).toFixed(4), late: +rms(d, 0.6, 0.78).toFixed(4),
                   hz: x.cat === "Synth" || /Noise|Wobble|Choir|Oohs|Pan Flute|Timpani|Tubular|Steel Drum|Glass|Music Box|Funk|Harmonica/.test(x.name) ? null : +pitch(d, f * 0.45, f * 2.2, 0.3).toFixed(1), want: +f.toFixed(1) });
      }
      return out;
    });
    const silent = all.filter((r) => r.nan || r.pk < 0.02 || r.pk >= 1.0);
    check("every voice of every bank (" + all.length + ") sounds: no silence, no NaN, no clipping", all.length > 80 && silent.length === 0, silent);
    const off = all.filter((r) => r.hz && Math.abs(1200 * Math.log2(r.hz / r.want)) > 35 && Math.abs(1200 * Math.log2(r.hz / (2 * r.want))) > 35 && Math.abs(1200 * Math.log2(r.hz * 2 / r.want)) > 35);
    check("the pitched voices play the note pressed (within 35 cents, an octave either way allowed for a voice's register)", off.length === 0, off);
    const gp = all.find((r) => r.name === "Grand Piano"), org = all.find((r) => r.name === "Drawbar Organ"), gt = all.find((r) => r.name === "Nylon Guitar"), vib = all.find((r) => r.name === "Marimba");
    check("a piano note dies away while held (later quieter), a guitar too, a marimba fast; an organ holds its level", gp.late < gp.early * 0.8 && gt.late < gt.early && vib.late < vib.early * 0.3 && org.late > org.early * 0.7, { gp, gt, vib, org });
    check("each engine is there: " + ["strike", "pluck", "fm", "organ", "synth"].join(" / "), ["strike", "pluck", "fm", "organ", "synth"].every((t) => all.some((r) => r.tone === t)));

    // ---- velocity: a soft piano note is darker
    const vel = await ev(async () => {
      const C = H3SynthCore, sr = 48000;
      const one = async (v) => { const ctx = new OfflineAudioContext(2, sr, sr), E = new H3SynthVoice.Engine(ctx); E.setAll(C.patch("Grand Piano")); E.noteOn(60, v, 0.01); E.noteOff(60, 0.8);
        const d = (await ctx.startRendering()).getChannelData(0); let hi = 0, all = 0; for (let i = 720; i < 6000; i++) { const df = d[i] - 2 * d[i - 1] + d[i - 2]; hi += df * df; all += d[i] * d[i]; } return hi / all; };
      return [await one(0.25), await one(1)];
    });
    check("velocity: a soft piano note is darker than a hard one (less of its sound in the highs)", vel[0] < vel[1] * 0.8, vel);

    // ---- live from the keys
    const live = await ev(async () => {
      const o = {};
      for (const n of ["Grand Piano", "Tine E.Piano", "Drawbar Organ", "Finger Bass", "Flute"]) {
        H3Synth.preset(n); H3Synth.noteOn(60, 0.9); await new Promise((r) => setTimeout(r, 120));
        const E = H3Synth.engine(), a = new Float32Array(2048); E.scope.getFloatTimeDomainData(a); let pk = 0; for (const x of a) pk = Math.max(pk, Math.abs(x));
        o[n] = { voices: E.sounding(), pk: +pk.toFixed(3) }; H3Synth.noteOff(60); await new Promise((r) => setTimeout(r, 300));
      }
      o.cache = H3SynthVoice.zoneCache(); return o;
    });
    check("live from the keys: a piano, an electric piano, an organ, a bass and a flute each sound (one voice, the scope moves); the string notes are kept",
      Object.keys(live).filter((k) => k !== "cache").every((k) => live[k].voices === 1 && live[k].pk > 0.01) && live.cache > 3, live);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the run threw - " + (e && e.stack || e)); }
  try { if (before) await ev((x) => { H3Synth.preset(x); toggleMax("synthdock", false); H3Audio.tab("musicdock"); }, before); await p.waitForTimeout(900); } catch { /* fine */ }
  await b.close();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
