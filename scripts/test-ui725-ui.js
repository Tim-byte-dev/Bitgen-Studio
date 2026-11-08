#!/usr/bin/env node
/* bitGen Studio — 2.725.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311): A SOUND IN THE
 * PREVIEW DIALOG (#lb, opened by clicking a file in a docker) - ▶ starts a random visualization on a canvas that moves
 * with the sound, 🎲 another look, paused = still; Next / Prev (and → ←) on a sound go to the next / previous SOUND of the
 * list it was clicked in (a picture between them skipped, the end wraps) and play it; on a picture they page as before
 * and nothing plays by itself; closing stops it. Three sounds + a picture in a [data-lb-group] list, as the Gallery /
 * Assets / References give the preview. No server / no Playwright = SKIP.
 * Tim (verbatim): "when user starts to play an audio show a random visualization, next button will play the next audio
 * in the docker the file was clicked in our preview dialog where we show pictures when a picture is clicked not the
 * preview docker with the button in statusbar" */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.725.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.725.0 browser test did not run"); process.exit(0); }
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3LbAudio && typeof lbOpen === "function" && document.getElementById("lb"), null, { timeout: 30000 });
    await p.waitForTimeout(600);
    // a list as a docker gives it: three sounds (made here - 4 s tones) and a picture between the first two
    await ev(() => {
      const wav = (hz, secs) => { const sr = 22050, n = sr * secs, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
        const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
        w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / sr * hz * 2 * Math.PI) * (0.4 + 0.4 * Math.sin(i / sr * 6)) * 32767, true);
        return URL.createObjectURL(new Blob([buf], { type: "audio/wav" })); };
      const c = document.createElement("canvas"); c.width = c.height = 8; c.getContext("2d").fillRect(0, 0, 8, 8);
      const box = document.createElement("div"); box.id = "t725"; box.setAttribute("data-lb-group", ""); box.style.cssText = "position:fixed;left:10px;top:120px;z-index:5;display:flex;gap:6px";
      const add = (url, kind, name) => { const d = document.createElement("div"); d.className = "thumb"; d.dataset.lbUrl = url; d.dataset.lbKind = kind; d.dataset.lbName = name; d.textContent = name; d.style.cssText = "padding:6px;background:#333;color:#fff"; box.appendChild(d); };
      add(wav(220, 4), "audio", "song-one.wav"); add(c.toDataURL(), "image", "picture.png"); add(wav(440, 4), "audio", "song-two.wav"); add(wav(330, 4), "audio", "song-three.wav");
      document.body.appendChild(box);
    });
    await p.click('#t725 [data-lb-name="song-one.wav"]'); await p.waitForTimeout(400);
    const o = await ev(() => { const box = document.querySelector("#lb_wrap .lbaud"); return { open: document.getElementById("lb").open, name: document.getElementById("lb_name").textContent,
      viz: box && box.classList.contains("lbviz"), paused: box && box.classList.contains("paused"), canvas: !!(box && box.querySelector("canvas.lbcv")), dice: !!document.getElementById("lb_viz"),
      audio: !!(box && box.querySelector(".lbarow audio")), playing: H3LbAudio.state().playing }; });
    check("clicking a sound in a docker opens the preview with a stage-filling canvas, its player and 🎲 - not playing yet", o.open && o.name === "song-one.wav" && o.viz && o.paused && o.canvas && o.dice && o.audio && !o.playing, o);

    // ▶ - a random look that moves with the sound
    await ev(() => document.querySelector("#lb_wrap audio").play()); await p.waitForTimeout(900);
    const s1 = await ev(() => { const cv = document.querySelector("#lb_wrap canvas.lbcv"), g = cv.getContext("2d"), d = g.getImageData(0, 0, cv.width, cv.height).data;
      let lit = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
      return Object.assign(H3LbAudio.state(), { lit, w: cv.width, h: cv.height, dataViz: cv.dataset.viz, cls: document.querySelector("#lb_wrap .lbaud").className }); });
    check("▶: a visualization starts (one of bars / mirror / wave / ring / stars / ripples), drawn every frame from the sound (Web Audio analyser), the canvas lit",
      s1.playing && s1.hooked && H3LbAudioVIZ(s1.viz) && s1.frames > 10 && s1.lit > 5 && s1.dataViz === s1.viz && /playing/.test(s1.cls) && s1.w > 300, s1);
    const v1 = s1.viz;
    await p.click("#lb_viz"); await p.waitForTimeout(400);
    const s2 = await ev(() => H3LbAudio.state());
    check("🎲 Another visualization: a different look, still playing", s2.viz && s2.viz !== v1 && s2.playing, { v1, s2 });
    await ev(() => document.querySelector("#lb_wrap audio").pause()); await p.waitForTimeout(200);
    const f0 = await ev(() => H3LbAudio.state().frames); await p.waitForTimeout(500);
    const f1 = await ev(() => ({ frames: H3LbAudio.state().frames, paused: document.querySelector("#lb_wrap .lbaud").classList.contains("paused") }));
    check("paused: the picture holds still (no frames drawn), dimmed", f1.frames === f0 && f1.paused, { f0, f1 });

    // Next on a sound = the next SOUND (the picture skipped), played; the look picked again
    const seen = new Set([v1, s2.viz]);
    await p.click("#lb_nx"); await p.waitForTimeout(900);
    let n = await ev(() => ({ name: document.getElementById("lb_name").textContent, pos: document.getElementById("lb_pos").textContent, st: H3LbAudio.state(), paused: document.querySelector("#lb_wrap audio").paused }));
    seen.add(n.st.viz);
    check("Next › on a sound: the next SOUND in that list (the picture between skipped) - and it plays, with a visualization", n.name === "song-two.wav" && n.pos === "3 / 4" && !n.paused && n.st.playing && H3LbAudioVIZ(n.st.viz) && n.st.frames > 5, n);
    await p.click("#lb_next"); await p.waitForTimeout(700);
    n = await ev(() => ({ name: document.getElementById("lb_name").textContent, paused: document.querySelector("#lb_wrap audio").paused, viz: H3LbAudio.state().viz }));
    seen.add(n.viz);
    check("› on the stage: the one after (song-three), playing", n.name === "song-three.wav" && !n.paused, n);
    await p.keyboard.press("ArrowRight"); await p.waitForTimeout(700);
    n = await ev(() => ({ name: document.getElementById("lb_name").textContent, paused: document.querySelector("#lb_wrap audio").paused, viz: H3LbAudio.state().viz }));
    seen.add(n.viz);
    check("→ at the last sound: wraps to the first sound of the list, playing", n.name === "song-one.wav" && !n.paused, n);
    await p.click("#lb_pv"); await p.waitForTimeout(700);
    n = await ev(() => ({ name: document.getElementById("lb_name").textContent, paused: document.querySelector("#lb_wrap audio").paused, viz: H3LbAudio.state().viz }));
    seen.add(n.viz);
    check("‹ Prev on a sound: the previous sound (wrapping back to the last), playing", n.name === "song-three.wav" && !n.paused, n);
    check("random: the looks change from track to track (" + [...seen].join(", ") + ")", seen.size >= 3, [...seen]);

    // on a picture: Next / Prev page as before, nothing plays by itself
    await ev(() => { lb.i = 1; lbShow(); }); await p.waitForTimeout(200);
    await p.click("#lb_pv"); await p.waitForTimeout(500);
    n = await ev(() => ({ name: document.getElementById("lb_name").textContent, paused: document.querySelector("#lb_wrap audio") ? document.querySelector("#lb_wrap audio").paused : null }));
    check("on a picture: ‹ Prev pages to the item before it (a sound) and does NOT start it", n.name === "song-one.wav" && n.paused === true, n);
    // closing stops the sound and the drawing
    await ev(() => document.querySelector("#lb_wrap audio").play()); await p.waitForTimeout(400);
    await ev(() => document.getElementById("lb").close()); await p.waitForTimeout(300);
    const c0 = await ev(() => H3LbAudio.state()); await p.waitForTimeout(400);
    const c1 = await ev(() => H3LbAudio.state());
    check("closing the preview stops the sound and the visualization", !c1.playing && c1.frames === c0.frames, { c0, c1 });
    // every look draws (a loud and a quiet sound) on a real canvas
    const dr = await ev(() => { const c = document.createElement("canvas"); c.width = 640; c.height = 360; const g = c.getContext("2d"), out = {};
      const f = new Uint8Array(1024).map((_, i) => 255 - (i % 255)), w = new Uint8Array(2048).map((_, i) => 128 + Math.round(90 * Math.sin(i / 20)));
      for (const v of H3LbAudio.VIZ) { g.fillStyle = "#000"; g.fillRect(0, 0, 640, 360); let ok = true;
        try { for (let k = 0; k < 4; k++) H3LbAudio.DRAW[v](g, 640, 360, k % 2 ? f : new Uint8Array(1024), w, k * 0.1, 33); } catch (e) { ok = String(e); }
        const d = g.getImageData(0, 0, 640, 360).data; let lit = 0; for (let i = 0; i < d.length; i += 4 * 53) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
        out[v] = { ok, lit }; }
      return out; });
    check("every look (bars, mirror, wave, ring, stars, ripples) draws on a real canvas, silence included", Object.keys(dr).length === 6 && Object.values(dr).every((x) => x.ok === true && x.lit > 0), dr);
    await ev(() => document.getElementById("t725").remove());
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: the test stopped - " + (e.stack || e.message)); }
  await b.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
function H3LbAudioVIZ(v) { return ["bars", "mirror", "wave", "ring", "stars", "ripples"].includes(v); }
