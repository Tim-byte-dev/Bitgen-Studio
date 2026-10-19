#!/usr/bin/env node
/* bitGen Studio — 2.527.0 in a REAL browser: 🩺 THE STYLE DOCTOR - the menu-bar 🩺 opens it with every image style; ▶
 * Check (Quick) renders the picked styles one at a time through Generate's own path; each row ends ✓ (time + its test
 * picture, which is NOT left in the gallery or the Image assets) or ✗ (the log line + what to do); an incomplete style
 * fails without a render; ■ Stop cancels the running job; ↻ checks one again; the run is kept and comes back after a
 * reload; ⤓ Report downloads the .md.
 * Against the running app (H3_URL, default :8311). If its ComfyUI does not answer, the test starts the stub ComfyUI
 * (scripts/stub-comfy.py) and points the app at it for the run, then puts the setting back. It clears the doctor's report. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const { execSync, spawn } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.527 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.H3_SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body, method) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined && !method ? {} : { method: method || "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })).json();

(async () => {
  // a ComfyUI to render with: the app's own, else the stub for this run
  let stubProc = null, url0 = null;
  const st0 = await api("/api/comfy/status").catch(() => ({}));
  if (!st0 || st0.reachable === false) {
    const cfg = await api("/api/config");
    url0 = ((cfg.engine || {}).comfy || {}).url || "";
    const port = 8389 + Math.floor(Math.random() * 400);
    stubProc = spawn("python3", [path.join(__dirname, "stub-comfy.py"), String(port), fs.mkdtempSync(path.join(os.tmpdir(), "sd527stub-"))], { stdio: "ignore", detached: true });
    for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/system_stats`)).ok) break; } catch { /* starting */ } await new Promise((ok) => setTimeout(ok, 250)); }
    await api("/api/config", { engine: { comfy: { url: `http://127.0.0.1:${port}` } } });
    console.log(`(the app's ComfyUI did not answer - the stub ComfyUI on :${port} for this run)`);
  }
  await api("/api/doctor/report", undefined, "DELETE");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 }, acceptDownloads: true });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n) }); };
  const ready = async () => { await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3StyleDoctor && document.getElementById("sdBtn"), null, { timeout: 60000 }); await p.waitForTimeout(1000); };
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await ready();
    const styles = await api("/api/doctor/styles");
    check("🩺 is in the menu bar", await ev(() => !!document.querySelector("#menubar #sdBtn")));
    await p.click("#sdBtn");
    await p.waitForFunction((n) => document.querySelectorAll("#sdRows tr").length === n && n > 0, styles.length, { timeout: 15000 });
    check("…it opens the 🩺 Style doctor with every image style", (await ev(() => document.querySelectorAll("#sdRows tr").length)) === styles.length && /Style doctor/.test(await ev(() => SecFloat.windows.doctor.el.querySelector(".sft").textContent)), styles.length);
    // three to check: two plain styles + (if there is one) an incomplete one
    const plain = styles.filter((s) => !s.skip && !s.missing.length && !s.slots).slice(0, 2);
    const incomplete = styles.find((s) => s.missing.length);
    const pick = plain.concat(incomplete ? [incomplete] : []).map((s) => s.id);
    const gal0 = new Set((await api("/api/outputs?kind=images")).map((f) => f.name));
    await ev((ids) => { const S = H3StyleDoctor.state(); S.styles.forEach((s) => { S.picked[s.id] = ids.includes(s.id); }); }, pick);
    await ev(() => H3StyleDoctor.load());   // repaint with the ticks
    await p.selectOption("#sdMode", "quick");
    await p.click("#sdGo");
    await p.waitForFunction(() => !H3StyleDoctor.state().running && /done/.test(document.getElementById("sdMsg").textContent), null, { timeout: 240000 });
    const rows = await ev((ids) => ids.map((i) => H3StyleDoctor.state().rows[i]), pick);
    check("▶ Check: every picked style ends ✓ works or ✗ failed (none left waiting)", rows.every((r) => r && (r.status === "ok" || r.status === "fail")), rows);
    check("…a ✗ row carries the log line that matters and what to do", rows.filter((r) => r.status === "fail").every((r) => r.line && r.advice), rows);
    const ok = rows.filter((r) => r.status === "ok");
    check("…a ✓ row: its time and its test picture", ok.length > 0 && ok.every((r) => r.secs >= 0 && r.thumb), rows);
    check("…the test pictures are NOT left in the gallery", (await api("/api/outputs?kind=images")).filter((f) => !gal0.has(f.name)).length === 0);
    if (incomplete) {
      const r = rows.find((x) => x.id === incomplete.id);
      check("an incomplete style fails at once - no render - saying what is missing", r.status === "fail" && !r.job && /missing/.test(r.line), r);
    }
    const thumbOk = ok.length ? (await fetch(URL_ + "api/doctor/thumb/" + encodeURIComponent(ok[0].thumb))).ok : false;
    check("…the row's picture is served", thumbOk);
    check("the summary line counts them", new RegExp(`${rows.filter((r) => r.status === "ok").length} work`).test(await ev(() => document.getElementById("sdSum").textContent)));
    await shot("ui527-doctor.png");

    // ↻ one again
    const one = pick[0];
    await p.click(`#sdRows [data-one="${one}"]`);
    await p.waitForFunction(() => !H3StyleDoctor.state().running && /done/.test(document.getElementById("sdMsg").textContent), null, { timeout: 120000 });
    check("↻ checks one style again", ["ok", "fail"].includes((await ev((i) => H3StyleDoctor.state().rows[i].status, one))));

    // ■ Stop: every style, stopped as soon as the first is checking
    await ev(() => { const S = H3StyleDoctor.state(); S.styles.forEach((s) => { S.picked[s.id] = true; }); });
    await p.click("#sdGo");
    await p.waitForFunction(() => H3StyleDoctor.state().running && Object.values(H3StyleDoctor.state().rows).some((r) => r.status === "run"), null, { timeout: 30000 });
    await p.click("#sdStop");
    await p.waitForFunction(() => !H3StyleDoctor.state().running, null, { timeout: 120000 });
    const after = await ev(() => Object.values(H3StyleDoctor.state().rows).map((r) => r.status));
    check("■ Stop ends the run: the rest are ■ stopped (none still waiting)", after.includes("stopped") && !after.some((s) => s === "wait" || s === "run") && /stopped/.test(await ev(() => document.getElementById("sdMsg").textContent)), after);
    const q = await api("/api/jobs");
    const live = (Array.isArray(q) ? q : q.jobs || []).filter((j) => (j.status === "queued" || j.status === "running") && j.params && j.params.prompt === "a red apple on a wooden table by a window, soft daylight, simple photo");
    check("…and no doctor render is left queued or running", live.length === 0, live.map((j) => j.id));

    const rep = await api("/api/doctor/report");
    check("the run is kept (report.json)", Array.isArray(rep.rows) && rep.rows.length >= pick.length && rep.rows.every((r) => ["ok", "fail", "skip", "stopped"].includes(r.status)), rep.rows && rep.rows.length);
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#sdMd")]);
    const mdPath = await dl.path();
    check("⤓ Report: the .md downloads (counts + a row per style)", dl.suggestedFilename() === "style-doctor.md" && /# Style doctor/.test(fs.readFileSync(mdPath, "utf8")) && /\| Style \| Result \|/.test(fs.readFileSync(mdPath, "utf8")));

    // a new page: the docker opens with the last run (report.json)
    await p.reload({ waitUntil: "domcontentloaded" }); await ready();
    await p.click("#sdBtn");
    await p.waitForFunction(() => document.querySelectorAll("#sdRows tr").length > 0, null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(500);
    const back = await ev(() => ({ tr: document.querySelectorAll("#sdRows tr").length, rows: Object.keys(H3StyleDoctor.state().rows).length, sum: document.getElementById("sdSum").textContent }));
    check("after a reload the docker shows the last run again", back.tr === styles.length && back.rows >= pick.length && /work/.test(back.sum), back);
    await ev(() => SecFloat.show("doctor", false));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run finished", false, String(e && e.stack || e)); }
  finally {
    try { await b.close(); } catch { /* fine */ }
    await api("/api/doctor/report", undefined, "DELETE").catch(() => {});
    if (url0 !== null) await api("/api/config", { engine: { comfy: { url: url0 } } }).catch(() => {});
    if (stubProc) try { process.kill(-stubProc.pid); } catch { try { stubProc.kill(); } catch { /* gone */ } }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
