#!/usr/bin/env node
/* bitGen Studio — 2.894.0 in a REAL browser: ✨ Auto edit on the timeline - two videos, two pictures and a 120 BPM click track put
 * in Assets; the ✨ box: Assets ticked, the song, 16 s, no LLM -> ✨ Plan: the storyboard (shots, beats adding up, moves, seams,
 * words); a shot's move changed; ✔ Build: a new timeline "Auto edit N" with ✨ Video A / B, ✨ Pictures A / B, ✨ Titles and
 * ✨ Music, every cut on a beat of the song, keyframes the canvas plays; the old timeline kept.
 * Tim (verbatim): "https://github.com/Vincentwei1021/video-shotcraft, can we add these to timeline to automate video editing?" */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const tag = "ae" + Date.now().toString(36), dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui894-"));
  const files = { [`${tag}_a.webm`]: "testsrc2=s=640x360:d=6:r=24", [`${tag}_b.webm`]: "mandelbrot=s=480x360:r=24" };
  for (const [n, src] of Object.entries(files)) execSync(`ffmpeg -v error -y -f lavfi -i ${src} -t 6 -c:v libvpx-vp9 -b:v 300k ${path.join(dir, n)}`);
  execSync(`ffmpeg -v error -y -f lavfi -i "color=c=orange:s=800x600" -frames:v 1 ${path.join(dir, tag + "_c.png")}`);
  execSync(`ffmpeg -v error -y -f lavfi -i "color=c=teal:s=600x900" -frames:v 1 ${path.join(dir, tag + "_d.png")}`);
  // a click track at 120 BPM (a short 1 kHz click every 0.5 s, the first at 0.3 s)
  execSync(`ffmpeg -v error -y -f lavfi -i "aevalsrc='if(lt(mod(t-0.3,0.5),0.03)*gte(t,0.3),sin(2*PI*1000*t),0)':s=22050:d=24" ${path.join(dir, tag + "_song.wav")}`);
  const up = async (f) => { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(dir, f))]), f); const r = await fetch(URL_ + "api/passets", { method: "POST", body: fd }); return r.json(); };
  const ups = []; for (const f of fs.readdirSync(dir)) ups.push(await up(f));
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1800, height: 1100 } }), p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.TlAutoEdit && window.H3AutoEdit && document.getElementById("tlAutoEditBtn"), null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    const before = await ev(() => ({ name: tlName, v: (tl.video || []).length + (tl.vlayers || []).length }));
    await ev(() => { const d = document.getElementById("timelinedock"); if (d && d.classList.contains("dockgone") && typeof toggleDockGone === "function") toggleDockGone("timelinedock"); });
    await ev(() => window.TlAutoEdit.open());
    await p.waitForSelector("#aeSrc");
    await p.selectOption("#aeSrc", "assets");
    await p.waitForFunction(() => document.getElementById("aeAssets").dataset.done === "1", null, { timeout: 10000 });
    const n = await ev((t) => { let k = 0; document.querySelectorAll("#aeAssets input[type=checkbox]").forEach((x) => { x.checked = x.value.startsWith(t); if (x.checked) k++; }); return k; }, tag);
    await ev((t) => { const s = document.getElementById("aeSong"); const o = [...s.options].find((x) => x.value.indexOf(t + "_song") >= 0); s.value = o ? o.value : ""; s.dispatchEvent(new Event("change")); }, tag);
    await p.fill("#aeLen", "16"); await p.check("#aeNoLlm"); await p.fill("#aeBrief", "A promo for Rosie's Bakery. Come and visit us!");
    check("✨ on the timeline bar opens Auto edit: our 2 videos + 2 pictures ticked in Assets, the song picked, the pace row hidden with a song",
      n === 4 && (await ev(() => document.getElementById("aeSong").value)).indexOf("_song") > 0 && (await ev(() => document.getElementById("aeTempoRow").style.display)) === "none", n);
    await p.click("#aePlan");
    await p.waitForFunction(() => /shots planned/.test(document.getElementById("aeMsg").textContent) || /^✗/.test(document.getElementById("aeMsg").textContent), null, { timeout: 60000 });
    const pl = await ev(() => ({ msg: document.getElementById("aeMsg").textContent, sum: document.getElementById("aeSum").textContent, rows: document.querySelectorAll("#aeBoard tr[data-i]").length, st: window.TlAutoEdit.state }));
    check("✨ Plan (no LLM): the beats of the song found (120 BPM), 16 s = 32 beats, the storyboard - shots adding up to 32 beats, bitGen's own plan",
      /shots planned by bitGen/.test(pl.msg) && /of 32 beats/.test(pl.sum) && /120 BPM/.test(pl.sum) && pl.rows >= 4 && pl.st.plan.shots.reduce((t, s) => t + s.beats, 0) === 32 && Math.abs(pl.st.grid.spb - 0.5) < 0.02, { msg: pl.msg, sum: pl.sum, rows: pl.rows });
    await ev(() => { const s = document.querySelector('#aeBoard tr[data-i="1"] .aeM'); if (s) { s.value = "drift"; s.dispatchEvent(new Event("change", { bubbles: true })); } });
    const mv = await ev(() => window.TlAutoEdit.state.plan.shots[1].move);
    check("...a shot's move changed in the storyboard is kept", mv === "drift", mv);
    await p.click("#aeBuild");
    await p.waitForFunction(() => /^✔ built on "Auto edit/.test(document.getElementById("aeMsg").textContent), null, { timeout: 20000 });
    const r = await ev(() => {
      const L = (tl.vlayers || []).map((x) => x.name).concat((tl.images || []).map((x) => x.name), (tl.audio || []).map((x) => x.name));
      const all = (tl.vlayers || []).concat(tl.images || []).flatMap((x) => x.clips);
      return { name: tlName, layers: L, starts: all.filter((c) => !c.text).map((c) => c.start), shots: all.filter((c) => c.ae && c.ae.shot).length, kf: all.filter((c) => c.kf && c.kf.length).length,
        music: tl.audio[0] && tl.audio[0].clips[0], muted: (tl.vlayers || []).every((x) => x.muted), msg: document.getElementById("aeMsg").textContent, notes: document.getElementById("aeNotes").textContent, drift: all.some((c) => c.ae && c.ae.move === "drift") };
    });
    check("✔ Build: a new timeline \"Auto edit N\" with ✨ Video A / B, ✨ Pictures A / B, ✨ Titles, ✨ Music; the clips keyframed; the videos muted under the song",
      /^Auto edit \d+$/.test(r.name) && ["✨ Video A", "✨ Video B", "✨ Pictures A", "✨ Pictures B", "✨ Titles", "✨ Music"].every((x) => r.layers.includes(x)) && r.kf >= 4 && r.muted && r.drift, r);
    check("...every cut on a beat of the click track: the music starts on its first click (0.3 s), the check found nothing to fix", r.music && Math.abs(r.music.in - 0.3) < 0.03 && /the check found nothing/.test(r.msg), { music: r.music, msg: r.msg, notes: r.notes });
    // ⚙ the compile draws the same edit: 16 s, the orange picture where its shot is (no words over it), every keyframe taken
    const orange = await ev((t) => { const c = (tl.images || []).flatMap((x) => x.clips).find((x) => x.name === t + "_c.png"); const words = (tl.images || []).flatMap((x) => x.clips).filter((x) => x.text);
      return c ? { t: c.start + c.len * 0.6, words: words.some((w) => w.start <= c.start + c.len * 0.6 && w.start + w.len >= c.start + c.len * 0.6) } : null; }, tag);
    const payload = await ev(() => window.TlExportBody(tl));
    const job = await (await fetch(URL_ + "api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })).json();
    let js = {};
    for (let i = 0; i < 300 && job.id; i++) { js = await (await fetch(URL_ + "api/jobs/" + job.id)).json(); if (js.status === "done" || js.status === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const proj = (await (await fetch(URL_ + "api/projects/current")).json()).name, root = process.env.H3_ROOT || path.join(__dirname, "..");
    const movie = [path.join(root, "projects", proj, proj + ".mp4")].concat((js.outputs || []).map((o) => path.join(root, "projects", proj, "final", String(o).split("/").pop()))).find((f) => fs.existsSync(f));
    const durOf = (f) => +execSync(`ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${f}"`).toString().trim();
    const rgbAt = (f, t) => [...execSync(`ffmpeg -loglevel error -ss ${t} -i "${f}" -frames:v 1 -vf scale=1:1:flags=area -f rawvideo -pix_fmt rgb24 -`)];
    const cd = movie ? durOf(movie) : 0, col = movie && orange ? rgbAt(movie, orange.t.toFixed(2)) : null;
    check("⚙ Compile of the auto edit: done, 16 s long, the orange picture on screen at its shot (red high, blue low)",
      js.status === "done" && movie && Math.abs(cd - 16) < 0.3 && col && (orange.words || (col[0] > 150 && col[2] < 90)), { job, status: js.status, err: js.error, movie, cd, col, orange });
    await ev(() => { try { TlCanvas.go(3); } catch (e) { /* closed */ } });
    await p.waitForTimeout(800);
    const tls = await ev(async () => { const j = await (await fetch("/api/timelines")).json(); return (j.timelines || []).map((t) => t.name); });
    check("...the timeline you had is kept next to it", tls.includes(before.name) && tls.some((t) => /^Auto edit/.test(t)), { tls, before });
    await ev((nm) => tlSwitch(nm), before.name);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("ran: " + e.message, false); }
  finally {
    try { const j = await (await fetch(URL_ + "api/timelines")).json(); for (const t of j.timelines || []) if (/^Auto edit/.test(t.name)) await fetch(URL_ + "api/timelines/" + encodeURIComponent(t.name), { method: "DELETE" }); } catch { /* left */ }
    fs.rmSync(dir, { recursive: true, force: true });
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
