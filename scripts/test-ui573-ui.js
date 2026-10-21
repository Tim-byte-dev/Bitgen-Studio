#!/usr/bin/env node
/* bitGen Studio — 2.573.0 in a REAL browser: ✂ the song strip's cut duration (29.9 re-cuts a 70 s song 29.9 / 29.9 /
 * 10.2 and is remembered), ⟳ ComfyUI updates in Settings ▸ ComfyUI ▸ Engine (channel saved, ⤓ Update posts it), the
 * update check on startup (a newer bitGen Studio + ComfyUI -> the ⬆ status-bar chip and the card; its click opens the
 * ComfyUI tab), and FastH3 Omni (the StoryBoard's Workflow list, the video style, Settings ▸ Add-ons).
 * Tim: "add an input to the audio clip menu in storyboard to set the cut duration . add update comfyui button to comfyui
 * tab in settings. do an autocheck on startup for latest version of bitgen and comfyui" + "please add this workflow
 * https://www.fasth3-omni.com/en, fasth3 omni". Against the running app (H3_URL). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.573.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const BASE = URL_.replace(/\/$/, "");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, b) => { const r = await fetch(BASE + u, b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined); return r.json().catch(() => ({})); };

(async () => {
  const P = "zz-ui573";
  let before = null;
  try { before = (await api("/api/projects/current")).name || null; } catch { before = null; }
  await api("/api/projects/new", { name: P }); await api("/api/projects/load", { name: P });
  const sd = path.join(ROOT, "projects", P, "sound");
  fs.mkdirSync(sd, { recursive: true });
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=f=220:d=70", path.join(sd, "cut573.wav")]);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.evaluate(() => { try { localStorage.removeItem("h3.vd.segCut"); localStorage.removeItem("h3.update.seen.bitgen"); localStorage.removeItem("h3.update.seen.comfy"); } catch (e) { /* fine */ } });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.vdSongStrip && window.H3StartCheck && window.H3ComfyUpdate, null, { timeout: 60000 });
    await p.waitForTimeout(800);

    /* 1 ✂ cut duration */
    await ev(() => window.vdSongStrip.load("cut573.wav"));
    await p.waitForFunction(() => { const e = window.vdSongStrip.editor(); return e && e.S && e.S.total > 60; }, null, { timeout: 30000 });
    const s0 = await ev(() => ({ d: window.vdSongStrip.editor().S.durations, cut: document.getElementById("vdSegCut").value, vis: !!document.getElementById("vdSegCut").offsetParent }));
    check("the song strip opens on the 15 s grid with the ✂ cut input at 15", s0.cut === "15" && s0.d.join(",") === "15,15,15,15,10" && s0.vis, s0);
    await ev(() => { const i = document.getElementById("vdSegCut"); i.value = "29.9"; i.dispatchEvent(new Event("change")); });
    const s1 = await ev(() => ({ d: window.vdSongStrip.editor().S.durations, msg: document.getElementById("vdWaveMsg").textContent, dirty: window.vdSongStrip.dirty(), keep: localStorage.getItem("h3.vd.segCut") }));
    check("✂ 29.9: the song re-cut 29.9 / 29.9 / 10.2, unsaved (💾 writes it), the value remembered",
      s1.d.join(",") === "29.9,29.9,10.2" && s1.dirty && /re-cut every 29\.9 s: 3 segment/.test(s1.msg) && s1.keep === "29.9", s1);
    await ev(() => { const i = document.getElementById("vdSegCut"); i.value = "45"; i.dispatchEvent(new Event("change")); });
    const s2 = await ev(() => document.getElementById("vdWaveMsg").textContent);
    check("...over 29.9 s the strip says it is more than one Long video run (719 frames)", /more than one Long video run/.test(s2), s2);
    await ev(() => { const i = document.getElementById("vdSegCut"); i.value = "29.9"; i.dispatchEvent(new Event("change")); });
    await ev(() => document.getElementById("vdSegSave").click());
    await p.waitForTimeout(1500);
    const seg = await api("/api/stems/segments?song=cut573.wav");
    check("💾 saves the 29.9 s map to the .seg", JSON.stringify(seg.durations) === "[29.9,29.9,10.2]", seg);

    /* 2 FastH3 Omni in the StoryBoard and the styles */
    const flows = await ev(() => { const s = document.getElementById("scStyleSel") || document.getElementById("vdWorkflow"); return s ? [...s.options].map((o) => o.value + "=" + o.textContent) : []; });
    check("the StoryBoard's Workflow list offers FastH3 Omni · ref2va 8-step", flows.includes("FastH3 Omni=FastH3 Omni · ref2va 8-step"), flows);
    const sty = await api("/api/styles?kind=video");
    const f3 = (sty.styles || []).find((s) => s.name === "FastH3 Omni") || {};
    check("the video style FastH3 Omni (the shipped graph)", f3.workflow === "comfy_workflows/fasth3_omni_r2v.json" && f3.arch === "minimax-h3", f3);
    const sn = await api("/api/scenes/style", { name: "FastH3 Omni" });
    check("picking it on the board: the note says it renders ref2va on FastVideo's 8-step model", /FastH3 Omni - ▶ renders every scene through ref2va on FastVideo's 8-step model/.test(JSON.stringify(sn)), sn);

    /* 3 ⟳ ComfyUI updates in Settings ▸ ComfyUI */
    let started = null;
    await p.route("**/api/comfy/update/start", async (r) => { started = r.request().postDataJSON(); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }); });
    await p.route("**/api/comfy/update/job*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ job: { state: "done", from: "0.42.0", to: "0.44.0", restarted: true }, lines: ["[ok] ComfyUI 0.42.0 -> 0.44.0"], next: 1 }) }));
    await p.route("**/api/comfy/update/info", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, version: "0.42.0", mode: "portable", root: "C:/ComfyUI_windows_portable", channel: "latest" }) }));
    await ev(() => { document.getElementById("settings").showModal(); document.querySelector('[data-stab="comfy"]').click(); });
    await ev(() => window.H3ComfyUpdate.info());
    await p.waitForTimeout(400);
    const cu = await ev(() => { const s = document.getElementById("cuSec"), st = document.getElementById("s_cstatus");
      return { vis: !!(s && s.offsetParent), after: !!(st && st.nextElementSibling === s), info: document.getElementById("cuInfo").textContent, go: document.getElementById("cuGo").disabled,
        ch: [...document.getElementById("cuChannel").options].map((o) => o.value).join() }; });
    check("Settings ▸ ComfyUI ▸ Engine: ⟳ ComfyUI updates right under the start / stop status - version + kind, channel Newest / Stable, ⤓ Update ComfyUI",
      cu.vis && cu.after && /ComfyUI 0\.42\.0/.test(cu.info) && /portable build/.test(cu.info) && !cu.go && cu.ch === "latest,stable", cu);
    await ev(() => { window.appConfirm = () => Promise.resolve(true); const c = document.getElementById("cuChannel"); c.value = "stable"; });
    await ev(() => document.getElementById("cuGo").click());
    await p.waitForTimeout(1600);
    const cj = await ev(() => document.getElementById("cuJob").textContent);
    check("⤓ Update ComfyUI (confirmed) posts the channel; the job's log shows 0.42.0 → 0.44.0", started && started.channel === "stable" && /0\.42\.0 → 0\.44\.0/.test(cj) && /starting again/.test(cj), { started, cj });
    await p.unroute("**/api/comfy/update/info");
    const chs = await api("/api/comfy/update/channel", { channel: "stable" });
    const inf = await api("/api/comfy/update/info");
    await api("/api/comfy/update/channel", { channel: "latest" });
    check("the channel is saved (config.update.comfy_channel)", chs.ok && inf.channel === "stable", { chs, inf });
    await ev(() => document.getElementById("settings").close());

    /* 4 the check on startup */
    await p.route("**/api/update/check", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ current: "2.573.0", latest: "2.574.0", newer: true, behind: 0, commits: [] }) }));
    await p.route("**/api/comfy/update/check", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ current: "0.42.0", latest: "0.43.0", master: "0.44.0", newer: true, channel: "latest" }) }));
    const set0 = await api("/api/update/settings");
    await ev(() => window.H3StartCheck.run(false));
    await p.waitForTimeout(500);
    const sc = await ev(() => ({ chip: (document.getElementById("sbUpd") || {}).textContent || "", tip: (document.getElementById("sbUpd") || {}).title || "", card: (document.getElementById("updCard") || {}).textContent || "" }));
    check("startup check ON by default: a newer bitGen Studio and ComfyUI -> ⬆ Updates (2) in the status bar + the card listing both",
      set0.auto_check === true && /Updates \(2\)/.test(sc.chip) && /bitGen Studio 2\.574\.0/.test(sc.card) && /ComfyUI 0\.44\.0 \(you have 0\.42\.0\)/.test(sc.card), { set0, sc });
    await ev(() => document.getElementById("updLater").click());
    await ev(() => window.H3StartCheck.run(false));
    await p.waitForTimeout(400);
    const sc2 = await ev(() => ({ card: !!document.getElementById("updCard"), chip: !!document.getElementById("sbUpd") }));
    check("Later: the card does not come back for the same versions; the chip stays", !sc2.card && sc2.chip, sc2);
    await ev(() => { window.H3StartCheck.clear("bitgen"); });
    await ev(() => document.getElementById("sbUpd").click());
    await p.waitForTimeout(600);
    const tab = await ev(() => ({ open: document.getElementById("settings").open, comfy: document.getElementById("stab-comfy").classList.contains("active"), chip: document.getElementById("sbUpd").textContent }));
    check("the chip (only ComfyUI left after bitGen updated) opens Settings ▸ ComfyUI", tab.open && tab.comfy && /ComfyUI update/.test(tab.chip), tab);
    await ev(() => document.getElementById("settings").close());
    await ev(() => window.H3StartCheck.setAuto(false));
    await ev(() => { const s = window.H3StartCheck.state; s.bitgen = s.comfy = null; const c = document.getElementById("sbUpd"); if (c) c.remove(); });
    await ev(() => window.H3StartCheck.run(false));
    await p.waitForTimeout(300);
    const off = await ev(() => !!document.getElementById("sbUpd"));
    const set1 = await api("/api/update/settings");
    await api("/api/update/settings", { auto_check: true });
    check("switched off: no look at all on startup", !off && set1.auto_check === false, { off, set1 });

    /* 5 Add-ons ▸ FastH3 Omni */
    await ev(() => window.H3Addons && window.H3Addons.open());
    await p.waitForSelector('#stab-addons [data-addon="fasth3"]', { timeout: 45000 });
    const card = await ev(() => { const c = document.querySelector('#stab-addons [data-addon="fasth3"]'); const boxes = [...c.querySelectorAll("[data-aoi]")];
      return { title: c.querySelector("h4").textContent, on: boxes.filter((x) => x.checked).map((x) => x.value), locked: boxes.filter((x) => x.disabled).map((x) => x.value), text: c.textContent }; });
    check("Settings ▸ Add-ons ▸ FastH3 Omni: the int8 model ticked (22.2 GB), bf16 optional, H3's encoder + VAEs needed; ComfyUI 0.43",
      /FastH3 Omni/.test(card.title) && card.on.join() === "int8,te,vae" && card.locked.join() === "te,vae" && /22\.2 GB|22 GB/.test(card.text) && /0\.43/.test(card.text), card);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/update/settings", { auto_check: true }); if (before) await api("/api/projects/load", { name: before }); else await api("/api/projects/load", { name: "default" }); } catch (e) { /* fine */ }
    try { fs.rmSync(path.join(ROOT, "projects", P), { recursive: true, force: true }); } catch (e) { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
