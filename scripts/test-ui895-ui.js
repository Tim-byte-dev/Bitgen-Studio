#!/usr/bin/env node
/* bitGen Studio — 2.895.0 in a REAL browser: ✨ Auto edit PART 2 - 👁 look at them first (no vision model here: the plan goes on and says so),
 * a flash cut picked in the storyboard, ✔ Build with 🔊 sound effects: bitGen's own sounds made in the project, on ✨ SFX A / B pinned
 * to the seams, the white flash on ✨ Flash; ⚙ Compile: the whoosh heard before its beat; the prompt docker's "auto edit …".
 * Tim (verbatim): "continue with part 2" */
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
  const tag = "ax" + Date.now().toString(36), dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui895-"));
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
    const before = await ev(() => ({ name: tlName }));
    await ev(() => { const d = document.getElementById("timelinedock"); if (d && d.classList.contains("dockgone") && typeof toggleDockGone === "function") toggleDockGone("timelinedock"); });
    await ev(() => window.TlAutoEdit.open());
    await p.waitForSelector("#aeSrc");
    await p.selectOption("#aeSrc", "assets");
    await p.waitForFunction(() => document.getElementById("aeAssets").dataset.done === "1", null, { timeout: 10000 });
    await ev((t) => { document.querySelectorAll("#aeAssets input[type=checkbox]").forEach((x) => { x.checked = x.value.startsWith(t); }); const s = document.getElementById("aeSong"); const o = [...s.options].find((x) => x.value.indexOf(t + "_song") >= 0); s.value = o ? o.value : ""; s.dispatchEvent(new Event("change")); }, tag);
    await p.fill("#aeLen", "20"); await p.check("#aeNoLlm");
    const ticks = await ev(() => ({ look: document.getElementById("aeLook").checked, sfx: document.getElementById("aeSfx").checked }));
    check("the box has ☑ 👁 look at them first and ☑ 🔊 sound effects, both on", ticks.look && ticks.sfx, ticks);
    await p.click("#aePlan");
    await p.waitForFunction(() => /shots planned/.test(document.getElementById("aeMsg").textContent) || /^✗/.test(document.getElementById("aeMsg").textContent), null, { timeout: 90000 });
    const pl = await ev(() => ({ msg: document.getElementById("aeMsg").textContent, notes: document.getElementById("aeNotes").textContent, n: window.TlAutoEdit.state.plan.shots.length, moves: [...document.querySelector("#aeBoard .aeM").options].map((o) => o.value), enters: [...document.querySelector("#aeBoard .aeE").options].map((o) => o.value) }));
    check("👁 with no vision model the plan still comes (said under the storyboard); the storyboard offers freeze / slow motion and the flash cut",
      /shots planned/.test(pl.msg) && /👁 not looked at/.test(pl.notes) && pl.moves.includes("freeze") && pl.moves.includes("slowmo") && pl.enters.includes("flash"), pl);
    // a flash cut into shot 3, slow motion on the first video shot
    await ev(() => { const s = document.querySelector('#aeBoard tr[data-i="2"] .aeE'); s.value = "flash"; s.dispatchEvent(new Event("change", { bubbles: true })); });
    await p.click("#aeBuild");
    await p.waitForFunction(() => /^✔ built on "Auto edit/.test(document.getElementById("aeMsg").textContent), null, { timeout: 60000 });
    const r = await ev(() => ({ msg: document.getElementById("aeMsg").textContent, audio: (tl.audio || []).map((L) => L.name + ":" + L.clips.length), sfx: (tl.audio || []).filter((L) => /SFX/.test(L.name)).flatMap((L) => L.clips.map((c) => ({ name: c.name, start: c.start, in: c.in, kind: c.ae.sfx, why: c.ae.why }))),
      flash: (tl.images || []).filter((L) => L.name === "✨ Flash").flatMap((L) => L.clips), shot3: window.TlAutoEdit.state.plan.shots[2].enter }));
    const proj = (await (await fetch(URL_ + "api/projects/current")).json()).name, root = process.env.H3_ROOT || path.join(__dirname, "..");
    const onDisk = r.sfx.every((c) => fs.existsSync(path.join(root, "projects", proj, "sound", c.name)));
    check("✔ Build: sound effects on ✨ SFX A / B (bitGen's own, made in the project's sound folder), a white flash on ✨ Flash at shot 3, said in the message",
      r.sfx.length >= 3 && r.audio.some((x) => /✨ SFX A/.test(x)) && onDisk && r.sfx.every((c) => /^autoedit-sfx-/.test(c.name)) && r.flash.some((c) => c.ae && c.ae.flash === 3) && r.shot3 === "flash" && /sound effects/.test(r.msg) && r.sfx.some((c) => c.kind === "riser"), r);
    const payload = await ev(() => window.TlExportBody(tl));
    const job = await (await fetch(URL_ + "api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })).json();
    let js = {};
    for (let i = 0; i < 300 && job.id; i++) { js = await (await fetch(URL_ + "api/jobs/" + job.id)).json(); if (js.status === "done" || js.status === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const movie = [path.join(root, "projects", proj, proj + ".mp4")].concat((js.outputs || []).map((o) => path.join(root, "projects", proj, "final", String(o).split("/").pop()))).find((f) => fs.existsSync(f));
    const wh = r.sfx.find((c) => c.kind === "whoosh" || c.kind === "swish"), rise = r.sfx.find((c) => c.kind === "riser");
    const rms = (f, a, d) => { const o = execSync(`ffmpeg -v info -ss ${a.toFixed(2)} -t ${d} -i "${f}" -af astats=metadata=0 -vn -f null - 2>&1`).toString(); const m = o.match(/RMS level dB: (-?[\d.]+|-inf)/); return m ? (m[1] === "-inf" ? -200 : +m[1]) : null; };
    const probe = rise ? rise.start + 1.2 : wh ? wh.start + 0.25 : 1;
    const lv = movie ? rms(movie, probe, 0.2) : null, quiet = movie ? rms(movie, 0.05, 0.15) : null;
    check("⚙ Compile with the sounds: done; the riser is heard in the movie between the clicks (louder than the click track alone)",
      js.status === "done" && movie && lv != null && lv > -45 && (quiet == null || lv > quiet - 3), { status: js.status, err: js.error, lv, quiet, probe });
    // the prompt docker's words
    await ev(() => document.getElementById("aeDone").click());
    const said = await ev(() => window.TlAutoEdit.route("auto edit these clips to the music for Rosie's Bakery"));
    const after = await ev(() => ({ open: document.getElementById("tlAutoEditDlg").open, brief: document.getElementById("aeBrief").value, no: window.TlAutoEdit.wants("what is the weather today") }));
    check("the prompt docker: \"auto edit these clips to the music …\" opens ✨ Auto edit with the words and plans (the reply says so); other words are not taken",
      /Auto edit is open on the timeline/.test(said || "") && after.open && /Rosie's Bakery/.test(after.brief) && after.no === false, { said, after });
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
