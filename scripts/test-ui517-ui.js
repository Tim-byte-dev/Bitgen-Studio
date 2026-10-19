#!/usr/bin/env node
/* bitGen Studio — 2.517.0 in a REAL browser: ⚡ POWER DRAW + CLOCK SPEEDS in the System stats and a finished job's ENERGY.
 * Tim (verbatim): "Can we add powerdraw and clockspeed to the system stats. when a job is completed add total power
 * consumed?"
 * Against the running app (H3_URL, default :8311). Where nvidia-smi is not there (the test machine) the app should be
 * started with a stand-in on PATH (scripts/test-power517.js makes one the same way) - without one the GPU checks SKIP.
 * A ⚙ Compile job runs (a tiny timeline): its log ends with [power], its card in the queue's Done tab says ⚡ … Wh. */
"use strict";
const path = require("path");
const fs = require("fs");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.517 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "e2e_pw517";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2000, height: 1200 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const pd = path.join(ROOT, "projects", P);
  try {
    await api("/api/projects/load", { name: P });
    fs.mkdirSync(path.join(pd, "video"), { recursive: true });
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=s=320x180:r=24:d=2", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-deadline", "realtime", path.join(pd, "video", "pw_v1.webm")]);
    const st0 = await api("/api/stats");
    const hasGpu = st0.gpus && st0.gpus.length > 0;
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Power && window.TlCanvas, null, { timeout: 60000 });
    await p.waitForTimeout(6000);                       // a few stats polls
    const sys = await ev(() => {
      const labels = [...document.querySelectorAll("#stats .stat .row span")].map((x) => x.textContent), vals = {};
      document.querySelectorAll("#stats .stat").forEach((s) => { const l = s.querySelector(".row span"), v = s.querySelector(".row b"); if (l && v) vals[l.textContent] = v.textContent; });
      const head = document.querySelector("#stats .gpuframe .gtitle b");
      return { labels, vals, head: head ? head.textContent : "" };
    });
    check("System: CPU clock (and ⚡ since start) beside CPU load / temp / RAM", sys.labels.includes("CPU clock") && sys.labels.includes("⚡ since start") && /(GHz|MHz|n\/a)/.test(sys.vals["CPU clock"] || ""), sys);
    if (hasGpu) {
      const pk = Object.keys(sys.vals).find((k) => /^Power/.test(k)), ck = Object.keys(sys.vals).find((k) => /^Clock/.test(k));
      check("System: each GPU's frame has its power draw (0 - its limit W) and its clock (0 - its top MHz) graphs; its title adds watts and GHz",
        pk && /^\d+ W$/.test(sys.vals[pk]) && /450 W/.test(pk) && ck && /GHz/.test(sys.vals[ck]) && /2850 MHz/.test(ck) && /\d+ W · [\d.]+ GHz/.test(sys.head), sys);
    } else console.log("SKIP: no nvidia-smi on this machine (start the app with a stand-in on PATH) - the GPU power / clock checks did not run");
    // a job: ⚙ Compile of a tiny timeline
    await ev(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      tl.video = [{ name: "pw_v1.webm", src: "video", start: 0, dur: 2, in: 0, out: 2, opacity: 1 }]; tl.vlayers = []; tl.images = []; tl.audio = [];
      tlSave(); renderTimeline();
    });
    await p.waitForTimeout(1500);
    const resp = p.waitForResponse((r) => /\/api\/export$/.test(r.url()), { timeout: 120000 });
    await p.click("#tlExport");
    const job = await (await resp).json();
    let d = null;
    for (let i = 0; i < 240 && job.id; i++) { d = await api("/api/jobs/" + job.id); if (d.status === "done" || d.status === "failed") break; await new Promise((ok) => setTimeout(ok, 1000)); }
    const E = d && d.energy, line = d && (d.log || []).find((l) => /^\[power\]/.test(l));
    const st1 = await api("/api/stats"), meters = !!(st1.power && ((st1.power.gpus || []).some((g) => g.power_w != null) || st1.power.cpu_power_w != null));
    if (!meters) {
      check("no power meter on this computer (no nvidia-smi, no readable CPU energy): the job finishes without an energy figure (none made up)", d && d.status === "done" && !E && !line, { status: d && d.status, E, line });
      throw Object.assign(new Error("no meters"), { skip: true });
    }
    check("a finished job: its energy (Wh, GPU / CPU, average / peak watts, seconds) on the job and a [power] line in its log",
      d && d.status === "done" && E && E.wh >= 0 && E.secs >= 0 && typeof E.avg_w === "number" && line && /Wh/.test(line) && (!hasGpu || (E.gpu_measured && E.gpu_wh > 0)), { status: d && d.status, E, line });
    await ev(() => { if (typeof refreshJobs === "function") refreshJobs(); const t = document.querySelector('.qtab[data-qtab="done"]'); if (t) t.click(); });
    await p.waitForTimeout(1500);
    const card = await ev((id) => { const el = document.querySelector(`#jobs .job[data-id="${id}"] .jenergy`); return el ? { text: el.textContent, title: el.title } : null; }, job.id);
    check("the queue's Done tab: the job's card says ⚡ … Wh (its tooltip: GPU / CPU, average and peak, how long)", card && /^⚡ [\d.]+ (Wh|kWh)$/.test(card.text) && /Energy used/.test(card.title) && /Average \d+ W/.test(card.title), card);
    const hist = await api("/api/jobs/history");
    const info = fs.existsSync(path.join(pd, "jobs.info")) ? JSON.parse(fs.readFileSync(path.join(pd, "jobs.info"), "utf8")).find((x) => x.id === job.id) : null;
    check("the project's jobs.info keeps it (the Done tab after a restart shows it too)", info && info.energy && info.energy.wh === E.wh, { info: info && info.energy, hist: !!hist });
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    if (e && e.skip) { console.log("SKIP: no power meter here - the job's ⚡ card checks did not run (start the app with nvidia-smi, or a stand-in on PATH)"); check("no page errors", errs.length === 0, errs); }
    else check("the browser run finished", false, String(e && e.stack || e).slice(0, 900));
  } finally {
    try { await ev(() => { tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline(); }); } catch { /* closed */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
