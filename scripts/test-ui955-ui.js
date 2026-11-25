#!/usr/bin/env node
/* bitGen Studio — 2.955.0 in a REAL browser (Tim: "add a send to timeline button in keyboard, send last recorded piece, add a record
 * button to looper and send button to send last recorded piece to timeline, allow user to drag audio from gallery, assets,reference
 * to timeline ask if track goes on the layer it is dragged to or create a new layer. allow user to open audio file to new layer,
 * make the keyboard and looper panels into collapsible dockers inside the synth tab"). Against the running app (H3_URL). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const C = require("../ext/synthdock/synthcore.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tone = (hz, sec) => { const n = Math.round(48000 * sec), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = 0.5 * Math.sin(2 * Math.PI * hz * i / 48000); return Buffer.from(C.wav([x], 48000)); };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const info = () => ev(() => window.H3Synth.info());
  const tl = () => ev(() => window.H3SynthTL.tl());
  const made = [];
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 });
    await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady && document.querySelector("#synthdock .autabs"), null, { timeout: 60000 });
    await ev(() => { window.H3Audio.tab("synthdock"); window.toggleMax("synthdock", true); }); await sleep(600);
    await p.click("#syBody", { position: { x: 900, y: 6 } });
    await ev(() => window.H3Synth.refresh());
    /* ---- the parts as dockers that fold */
    const heads = await ev(() => [...document.querySelectorAll("#syBody .sysechead")].map((h) => h.textContent));
    check("the tab's parts are dockers with title bars: Synth (the rack), Keyboard, Looper, Timeline", heads.join("|") === "▾🎛 Synth|▾🎹 Keyboard|▾🥁 Looper|▾🎞 Timeline"
      && (await ev(() => ["syRack", "syDeck", "syTL"].every((id) => document.getElementById(id).parentElement.classList.contains("sysecbody")) && !!document.querySelector("#sySec_loop .syloop"))), heads);
    await p.click("#sySecH_keys"); await p.click("#sySecH_loop");
    const folded = await ev(() => ({ deck: document.getElementById("syDeck").offsetHeight, loop: document.querySelector("#syBody .syloop").offsetHeight, f: window.H3Synth.info().folded, aria: document.getElementById("sySecH_keys").getAttribute("aria-expanded") }));
    check("click a title bar: Keyboard and Looper fold away (▸, aria-expanded false)", folded.deck === 0 && folded.loop === 0 && folded.f.join() === "keys,loop" && folded.aria === "false", folded);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Synth && window.H3SynthTL && typeof dsReady !== "undefined" && dsReady, null, { timeout: 60000 });
    await ev(() => { window.H3Audio.tab("synthdock"); window.toggleMax("synthdock", true); }); await sleep(500);
    check("…kept over a reload", (await info()).folded.join() === "keys,loop", (await info()).folded);
    await p.click("#sySecH_keys"); await p.click("#sySecH_loop"); await sleep(150);
    check("…and back", (await info()).folded.length === 0 && (await ev(() => document.getElementById("syPiano").offsetHeight)) > 150);
    await p.click("#syBody", { position: { x: 900, y: 6 } });
    await ev(() => window.H3Synth.refresh());
    /* ---- the keyboard's take -> the timeline */
    check("→ 🎞 on the keyboard: off until something is recorded", await ev(() => document.getElementById("syScSend").disabled));
    await p.click("#syScRec"); await sleep(500);   // half a second of silence first - cut from the take
    for (const m of [60, 64, 67]) { await ev((n) => window.H3Synth.noteOn(n, 0.9), m); await sleep(300); await ev((n) => window.H3Synth.noteOff(n), m); }
    await sleep(400); await p.click("#syScStop"); await sleep(100);
    const take = await ev(() => { const t = window.H3SynthScore.take(); return t && { secs: t.seconds, lead: (() => { let i = 0; while (i < t.chans[0].length && Math.abs(t.chans[0][i]) < 0.0015) i++; return i / t.sampleRate; })() }; });
    check("● Rec on the deck records the sound too: about 1.3 s of playing, the silence before the first note cut", !!take && take.secs > 0.9 && take.secs < 2.2 && take.lead < 0.05 && !(await ev(() => document.getElementById("syScSend").disabled)), take);
    const n0 = (await tl()).layers.length;
    await ev(() => window.H3SynthTL.seek(1));
    await p.click("#syScSend");
    await p.waitForFunction((n) => window.H3SynthTL.tl().layers.length === n + 1 && window.H3SynthTL.tl().layers[n].clips.length === 1, n0, { timeout: 15000 });
    let L = (await tl()).layers[n0];
    made.push(L.clips[0].src.slice(3));
    check("→ 🎞: the take on a NEW layer (\"Keys take\") at the playhead, as a WAV in My samples", L.name === "Keys take" && /^my:Keys take \d\d-\d\d-\d\d\.wav$/.test(L.clips[0].src) && L.clips[0].start === 1 && Math.abs(L.clips[0].len - take.secs) < 0.05, L);
    /* ---- the looper's take */
    check("the looper: ⏺ Rec and → 🎞 Timeline (off until a take)", await ev(() => !!document.getElementById("syLRec") && document.getElementById("syLSend").disabled));
    await p.click("#syLRec"); await sleep(1300);
    const lr = (await info()).loop;
    await ev(() => window.H3SynthPads.hit(12, 1)); await sleep(300);   // pad 13 (its own sound) is heard by the take too
    await p.click("#syLRec"); await sleep(100);
    const li = (await info()).loop;
    check("⏺ Rec: the loop starts and is recorded; ⏺ again stops both - a take of about 1.6 s", lr.recording && lr.playing && !li.recording && !li.playing && li.take > 1.2 && li.take < 2.4, { lr: [lr.recording, lr.playing], li: [li.recording, li.playing, li.take] });
    await p.click("#syLSend");
    await p.waitForFunction((n) => window.H3SynthTL.tl().layers.length === n + 2 && window.H3SynthTL.tl().layers[n + 1].clips.length === 1, n0, { timeout: 15000 });
    L = (await tl()).layers[n0 + 1];
    made.push(L.clips[0].src.slice(3));
    check("→ 🎞 Timeline: the looper's take on a new layer (\"Loop take\")", L.name === "Loop take" && /^my:Loop take /.test(L.clips[0].src) && Math.abs(L.clips[0].len - li.take) < 0.05, L);
    // a pad's own sound reaches the take: the take is louder after 1.3 s than silent
    const padHeard = await ev(async () => { const b2 = await window.H3SynthLoop.buffer(window.H3SynthTL.tl().layers[window.H3SynthTL.tl().layers.length - 1].clips[0].src); const d = b2.getChannelData(0); let m = 0; for (let i = Math.floor(1.3 * b2.sampleRate); i < d.length; i++) m = Math.max(m, Math.abs(d[i])); return m; });
    check("…the drum pads are in the take (they play through the looper's bus)", padHeard > 0.05, padHeard);
    /* ---- drags from the gallery / the assets / the references: this layer or a new one? */
    const up = await ev(async (b64) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const fd = new FormData(); fd.append("to", "sound"); fd.append("name", "t955 asset"); fd.append("file", new Blob([u], { type: "audio/wav" }), "a.wav");
      return (await fetch("/api/synth/to-project", { method: "POST", body: fd })).json(); }, tone(330, 0.6).toString("base64"));
    check("(a sound in the project's Sound assets for the drags)", up.ok && /^t955 asset/.test(up.name), up);
    const dropAt = async (payload, layer, x) => ev(([pl, ly, xx]) => {
      window.eval("dragPayload = " + JSON.stringify(pl));
      const cv = document.getElementById("syTCanvas"), r = cv.getBoundingClientRect(), G = window.H3SynthTL.geo();
      const dt = new DataTransfer(), e = new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + xx, clientY: r.top + G.RULER + ly * G.LH + 30 });
      cv.dispatchEvent(e); window.eval("dragPayload = null");
      const box = document.getElementById("syTAsk"); return box ? { text: box.textContent, btns: [...box.querySelectorAll("button")].map((x) => x.textContent) } : null;
    }, [payload, layer, x]);
    let box = await dropAt({ type: "asset", kind: "sound", name: up.name }, 1, 80);
    check("an asset's sound dropped on layer 2: it asks - layer 2 (here), a new layer, or cancel", !!box && box.text.includes(up.name) && box.btns.length === 3 && /Layer 2 \(here\)/.test(box.btns[0]) && /new layer/.test(box.btns[1]), box);
    await p.click('#syTAsk [data-w="here"]');
    await p.waitForFunction((nm) => window.H3SynthTL.tl().layers[1].clips.some((c) => c.src === "snd:" + nm), up.name, { timeout: 8000 });
    const c1 = (await tl()).layers[1].clips.find((c) => c.src === "snd:" + up.name);
    check("…here: on layer 2, where it was dropped (2 s, snapped)", Math.abs(c1.start - 2) < 0.07, c1);
    const nb = (await tl()).layers.length;
    box = await dropAt({ type: "asset", kind: "sound", name: up.name }, 0, 120);
    await p.click('#syTAsk [data-w="new"]');
    await p.waitForFunction((n) => window.H3SynthTL.tl().layers.length === n + 1 && window.H3SynthTL.tl().layers[n].clips.length === 1, nb, { timeout: 8000 });
    L = (await tl()).layers[nb];
    check("…a new layer: one of its own, named after the sound, at the drop time (3 s)", L.name === up.name.replace(/\.wav$/, "") && Math.abs(L.clips[0].start - 3) < 0.07, L);
    box = await dropAt({ type: "output", kind: "sound", name: up.name }, 0, 40);
    await p.click('#syTAsk [data-w=""]');
    check("✕ cancels (nothing added); a gallery sound maps to the project's output folders (out:)", !(await ev(() => document.getElementById("syTAsk"))) && (await tl()).layers.length === nb + 1
      && (await ev(() => window.H3SynthTL.dropped({ dataTransfer: { getData: (k) => k === "text/h3multi" ? JSON.stringify([{ type: "output", kind: "sound", name: "song.mp3" }, { type: "asset", kind: "video", name: "v.mp4" }, { type: "asset", kind: "sound", name: "s.wav" }]) : "", files: [] } }).srcs.join())) === "out:song.mp3,snd:s.wav");
    box = await dropAt({ type: "output", kind: "images", name: "pic.png" }, 0, 40);
    check("a picture is not a sound: not taken, said in words", box === null && /Only sounds go on the timeline/.test(await ev(() => document.getElementById("syMsg").textContent)));
    /* ---- 📂 Open → new layer */
    const nc = (await tl()).layers.length;
    await p.setInputFiles("#syTOpenFile", [{ name: "t955 one.wav", mimeType: "audio/wav", buffer: tone(440, 0.4) }, { name: "t955 two.wav", mimeType: "audio/wav", buffer: tone(550, 0.4) }]);
    await p.waitForFunction((n) => window.H3SynthTL.tl().layers.length === n + 2 && window.H3SynthTL.tl().layers[n + 1].clips.length === 1, nc, { timeout: 15000 });
    const two = (await tl()).layers.slice(nc).map((l) => l.name + ":" + l.clips[0].src);
    made.push("t955 one.wav", "t955 two.wav");
    check("📂 Open → new layer: each file on a layer of its own, named after it", two.join("|") === "t955 one:my:t955 one.wav|t955 two:my:t955 two.wav", two);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e && e.stack || e)); }
  finally {
    try { for (const n of made) await ev((nm) => fetch("/api/synth/samples/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm }) }), n); } catch (e) { /* gone */ }
    try { await ev(() => { Object.keys(localStorage).filter((k) => /^h3\.synth\./.test(k)).forEach((k) => localStorage.removeItem(k)); }); } catch (e) { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
