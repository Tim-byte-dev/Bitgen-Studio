#!/usr/bin/env node
/* bitGen Studio — 2.407.0: the edit tools, the Colour / Export / Exchange dialogs and J / L cuts in a REAL browser
 * against the REAL app.
 * Tim: "can we do the pipelines, editing tools, colour and export now, keep track of what is left to do".
 *   1. the timeline's edit modes: ⇆ slip, ⇹ roll, ⇤ ripple, ↔ slide - each a mouse drag on the clips; the timecode readout
 *   2. 🎨 Colour: a TITLE BAR, a wheel puck dragged, a curve point added, an HSL range, the four scopes drawn
 *   3. J / L: the V1 clip's 🎧 inputs store clip.split
 *   4. 📤 Export: a TITLE BAR, the social pack, the timecode; ⚙ Compile + export sends the queue + the split, and the
 *      files are listed
 *   5. ⇄ Exchange: a TITLE BAR; FCP XML downloaded; the same XML imported back opens as a new named timeline
 * Run against the running app (H3_URL, default :8311). No Playwright = SKIP (exit 0). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.407 browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_prem2ui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); }
};
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} :
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "prem2ui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
ff(["-f", "lavfi", "-i", "testsrc2=size=320x180:rate=25:duration=4", "-f", "lavfi", "-i", "sine=frequency=440:duration=4",
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-deadline", "realtime", "-pix_fmt", "yuv420p", "-c:a", "libopus", "-shortest", path.join(T, "uiA.webm")]);
ff(["-f", "lavfi", "-i", "testsrc=size=320x180:rate=25:duration=6", "-f", "lavfi", "-i", "sine=frequency=880:duration=6",
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-deadline", "realtime", "-pix_fmt", "yuv420p", "-c:a", "libopus", "-shortest", path.join(T, "uiB.webm")]);

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await b.newContext({ viewport: { width: 2000, height: 1250 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    for (const f of ["uiA.webm", "uiB.webm"]) {
      const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, f))]), f);
      await fetch(URL_ + "api/passets", { method: "POST", body: fd });
    }
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.TlEdit && window.TlColour && window.TlDeliver && window.TlExchange && document.getElementById("tlEditModes")
      && document.getElementById("tlColourBtn") && document.getElementById("tlDeliverBtn") && document.getElementById("tlExchangeBtn"), null, { timeout: 30000 });
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      // the floating prompt docker sits over the tracks at this size (where it was left) - out of the way of the drags
      const pd = document.getElementById("promptdock"); if (pd && /pf-float/.test(pd.className)) pd.style.visibility = "hidden";
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "uiA.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1 }, { name: "uiB.webm", src: "video", in: 1, out: 4, dur: 6, start: 4, opacity: 1 }];
      tl.vlayers = []; tl.images = []; tl.audio = []; delete tl.deliver; delete tl.tc;
      PXS = 60;                                            // zoomed in: each edge its own handle
      tlSave(); renderTimeline();
    });
    const A = () => p.evaluate(() => ({ a: Object.assign({}, tl.video[0]), b: Object.assign({}, tl.video[1]) }));
    const box = (name, part) => p.evaluate(([name, part]) => {
      const el = [...document.querySelectorAll("#tlinner .clip")].find((e) => e._clip && e._clip.name === name);
      if (!el) return null;
      const t = part ? el.querySelector(".h." + part) : el;
      // an edge handle: grab it just INSIDE its own clip (the neighbour's handle touches it)
      const r = t.getBoundingClientRect(), x = part === "r" ? r.left + 2 : part === "l" ? r.right - 2 : r.left + r.width / 2;
      return { x, y: r.top + r.height / 2, pxs: PXS };
    }, [name, part]);
    const drag = async (bx, dxSec) => {
      await p.mouse.move(bx.x, bx.y); await p.mouse.down();
      await p.mouse.move(bx.x + dxSec * bx.pxs, bx.y, { steps: 8 }); await p.mouse.up();
      await p.waitForTimeout(150);
    };

    /* ---- 1. edit tools */
    const modes = await p.evaluate(() => [...document.querySelectorAll("#tlEditModes button")].map((x) => x.textContent));
    check("the timeline's edit modes: ▸ ⇤ ⇹ ⇆ ↔", modes.join("") === "▸⇤⇹⇆↔", modes);
    await p.click("#tlEdit_slip");
    await drag(await box("uiB.webm"), -1);
    let s = await A();
    check("⇆ slip (drag 1 s left): later frames - in 1 -> 2, out 4 -> 5, same start", Math.abs(s.b.in - 2) < 0.06 && Math.abs(s.b.out - 5) < 0.06 && s.b.start === 4, s.b);
    await p.click("#tlEdit_roll");
    await drag(await box("uiB.webm", "l"), -0.5);
    s = await A();
    check("⇹ roll (the cut 0.5 s left): A ends 0.5 s sooner, B starts 0.5 s sooner and earlier in its media", Math.abs(s.a.out - 3.5) < 0.06 && Math.abs(s.b.start - 3.5) < 0.06 && Math.abs(s.b.in - 1.5) < 0.06, s);
    await p.click("#tlEdit_ripple");
    await drag(await box("uiA.webm", "r"), -1);
    s = await A();
    check("⇤ ripple (A's tail 1 s left): A shorter, B follows (no gap)", Math.abs(s.a.out - 2.5) < 0.06 && Math.abs(s.b.start - 2.5) < 0.06 && Math.abs(s.b.in - 1.5) < 0.06, s);
    await p.click("#tlEdit_slide");
    await drag(await box("uiB.webm"), 0.5);
    s = await A();
    check("↔ slide (B 0.5 s right): A gives 0.5 s more, B's content unchanged", Math.abs(s.a.out - 3) < 0.06 && Math.abs(s.b.start - 3) < 0.06 && Math.abs(s.b.in - 1.5) < 0.06, s);
    await p.click("#tlEdit_select");
    const tc = await p.evaluate(() => { setPlayhead(1.5); return new Promise((r) => setTimeout(() => r(document.getElementById("tlTc") && document.getElementById("tlTc").textContent), 400)); });
    check("the timecode readout beside the position (00:00:01:12 at 1.5 s, 25 fps)", tc === "00:00:01:12", tc);

    /* ---- 2. colour */
    await p.evaluate(() => { window.__b = tl.video[1]; TlCanvas.select(__b, TlCanvas.layerOf(__b)); });
    await p.click("#tlColourBtn");
    await p.waitForFunction(() => document.getElementById("tlColourDlg") && document.getElementById("tlColourDlg").open && document.getElementById("tcpW_gain"), null, { timeout: 10000 });
    const cd = await p.evaluate(() => { const d = document.getElementById("tlColourDlg"), bar = d.querySelector(".fx-title"); return { title: bar.querySelector("h2").textContent, x: !!bar.querySelector(".fx-x"), first: d.firstElementChild === bar }; });
    check("🎨 Colour: a dialog with a TITLE BAR (Colour + ✕)", cd.title === "Colour" && cd.x && cd.first, cd);
    const wb = await (await p.$("#tcpW_gain")).boundingBox();
    await p.mouse.move(wb.x + wb.width / 2, wb.y + wb.height / 2); await p.mouse.down();
    await p.mouse.move(wb.x + wb.width * 0.25, wb.y + wb.height * 0.85, { steps: 5 }); await p.mouse.up();
    const cb = await (await p.$("#tcpCurve")).boundingBox();
    await p.mouse.click(cb.x + cb.width * 0.5, cb.y + cb.height * 0.25);
    await p.click("#tcpHslAdd");
    await p.evaluate(() => { const r = document.querySelector('#tcpHsl input[data-k="sat"]'); r.value = "-60"; r.dispatchEvent(new Event("input")); r.dispatchEvent(new Event("change")); });
    const g = await p.evaluate(() => __b.fx && __b.fx.grade);
    check("🎨 a wheel puck dragged (gain toward blue-ish), a curve point added (master), an HSL range desaturating", g && g.wheels && g.wheels.gain && g.wheels.gain.y < -0.3 && g.curves && g.curves.m && g.curves.m.length === 3 && g.hsl && g.hsl[0].sat === -60, g);
    const drawn = [];
    for (const sc of ["waveform", "parade", "vectorscope", "histogram"]) {
      drawn.push(await p.evaluate(async (sc) => {
        const s2 = document.getElementById("tcpScopeSel"); s2.value = sc; s2.dispatchEvent(new Event("change"));
        const cv = document.getElementById("tcpScope"), d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
        let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
        return lit;
      }, sc));
    }
    check("🎨 the four scopes draw the picture (waveform, parade, vectorscope, histogram)", drawn.every((n) => n > 50), drawn);
    await p.keyboard.press("Escape");

    /* ---- 3. J / L */
    await p.evaluate(() => { TlCanvas.select(__b, TlCanvas.layerOf(__b)); const d = document.getElementById("tfxSound"); if (d) d.open = true;
      const j = document.getElementById("tfxJ"); j.value = "0.5"; j.dispatchEvent(new Event("change")); });
    const sp = await p.evaluate(() => __b.split);
    check("J / L: the V1 clip's 🎧 inputs store the split (J 0.5 s)", sp && sp.lead === 0.5 && sp.tail === 0, sp);

    /* ---- 4. export */
    await p.click("#tlDeliverBtn");
    await p.waitForFunction(() => document.getElementById("tlDeliverDlg") && document.getElementById("tlDeliverDlg").open && document.getElementById("tdlPack"), null, { timeout: 10000 });
    const ed = await p.evaluate(() => { const d = document.getElementById("tlDeliverDlg"), bar = d.querySelector(".fx-title"); return { title: bar.querySelector("h2").textContent, first: d.firstElementChild === bar }; });
    check("📤 Export: a dialog with a TITLE BAR (Export)", ed.title === "Export" && ed.first, ed);
    await p.evaluate(() => {
      const s2 = document.getElementById("tdlPack"); s2.value = "social"; s2.dispatchEvent(new Event("change"));
      const t = document.getElementById("tdlTc"); t.value = "01:00:00:00"; t.dispatchEvent(new Event("change"));
      const f = document.getElementById("tdlFps"); f.value = "25"; f.dispatchEvent(new Event("change"));
    });
    const dq = await p.evaluate(() => ({ rows: document.querySelectorAll("#tdlRows [data-i]").length, list: tl.deliver, tc: tl.tc }));
    check("📤 the social pack (2.597.0: the MP4 · Social media preset): four rows (9:16 blur, 4:5 crop, 1:1 crop, 16:9 pad), the timecode stored", dq.rows === 4 && dq.list.map((d) => d.aspect).join() === "9:16,4:5,1:1,16:9" && dq.list.every((d) => d.preset === "social") && dq.tc.start === "01:00:00:00" && dq.tc.fps === 25, dq);
    let sent = null;
    await p.route("**/api/export", async (route) => { sent = JSON.parse(route.request().postData() || "{}"); await route.continue(); });
    const answered = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 20000 }).catch(() => null);
    await p.click("#tdlGo");
    const ar = await answered;
    const job = ar ? await ar.json().catch(() => null) : null;
    check("⚙ Compile + export sends the queue, the timecode and the J cut", sent && sent.deliver && sent.deliver.length === 4 && sent.tc.start === "01:00:00:00" && sent.video[1].split.lead === 0.5, sent && { deliver: sent.deliver, tc: sent.tc });
    let st = "";
    for (let i = 0; i < 240 && job; i++) { const gj = await api("/api/jobs/" + job.id); st = gj.status; if (st === "done" || st === "failed") break; await new Promise((r) => setTimeout(r, 1000)); }
    check("... the compile finishes", st === "done", st);
    await p.click("#tdlRefresh");
    await p.waitForTimeout(800);
    const files = await p.evaluate(() => [...document.querySelectorAll("#tdlFiles a")].map((a) => a.textContent));
    check("📤 Delivered lists the master + the four", files.length >= 5 && files.some((f) => /_social_9x16_1080p\.mp4$/.test(f)) && files.some((f) => /_social_4x5_1080p\.mp4$/.test(f)) && files.some((f) => /_social_1x1_1080p\.mp4$/.test(f)), files);
    await p.click("#tdlDone");

    /* ---- 5. exchange */
    await p.click("#tlExchangeBtn");
    await p.waitForFunction(() => document.getElementById("tlExchangeDlg") && document.getElementById("tlExchangeDlg").open && document.getElementById("tixOut"), null, { timeout: 10000 });
    const xd = await p.evaluate(() => { const d = document.getElementById("tlExchangeDlg"), bar = d.querySelector(".fx-title"); return { title: bar.querySelector("h2").textContent, first: d.firstElementChild === bar }; });
    check("⇄ Exchange: a dialog with a TITLE BAR (Exchange)", xd.title === "Exchange" && xd.first, xd);
    await p.evaluate(() => { const n = document.getElementById("tixName"); n.value = "UI Cut"; });
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }), p.click("#tixOut")]);
    const xf = path.join(T, "UI Cut.xml"); await dl.saveAs(xf);
    const xml = fs.readFileSync(xf, "utf8");
    check("⇄ FCP XML downloaded (xmeml, both clips, 25 fps, 01:00:00:00)", dl.suggestedFilename() === "UI Cut.xml" && /<xmeml version="5">/.test(xml) && /uiB\.webm/.test(xml) && /<timebase>25<\/timebase>/.test(xml) && /01:00:00:00/.test(xml));
    await p.setInputFiles("#tixFile", xf);
    await p.waitForFunction(() => document.getElementById("tixOpen"), null, { timeout: 10000 });
    await p.evaluate(() => { document.getElementById("tixAs").value = "from xml"; document.getElementById("tixOpen").click(); });
    await p.waitForFunction(() => typeof tlName !== "undefined" && tlName === "from xml", null, { timeout: 10000 }).catch(() => {});
    const im = await p.evaluate(() => ({ name: tlName, n: tl.video.length, b: tl.video[1] && { start: tl.video[1].start, in: tl.video[1].in }, tc: tl.tc }));
    check("⇄ the XML imported back opens as the timeline \"from xml\": both clips at their places, the timecode", im.name === "from xml" && im.n === 2 && Math.abs(im.b.start - 3) < 0.05 && Math.abs(im.b.in - 1.5) < 0.05 && im.tc && im.tc.start === "01:00:00:00", im);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed " + (e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch { /* fine */ }
    try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }
    console.log(`\n${pass} passed, ${fail} failed`);
    console.log("RESULT: " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }
})();
