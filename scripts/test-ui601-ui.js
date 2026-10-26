#!/usr/bin/env node
/* bitGen Studio — 2.601.0 in a REAL browser, against the running app (H3_URL): ⟳ REINSTALL + THE STATUS BESIDE THE BUTTON.
 * Tim: "if an addon/package/model has been installed change the button to reinstall", then "when installing an addon -
 * let the user know the status next to the button and disable the button when download/install starts. do this with all
 * buttons so user knows whats happening." The server's answers are stand-ins (page.route) - nothing is installed:
 *   Add-ons     an installed add-on: ⟳ Reinstall; pressed = {reinstall: true}, at once its buttons are disabled and
 *               "Installing… <the last log line>" sits beside them; at the end "✓ installed" and they come back
 *   Audio       faster-whisper installed: ⟳ Reinstall faster-whisper; pressed = disabled, "Installing faster-whisper… -
 *               <the job's line>" beside it while the job runs; "✓ faster-whisper installed" + enabled when it is done
 *   Models      the catalog: a downloaded model can be ticked; ticked alone = ⟳ Download again ({force: true}); while it
 *               downloads "Downloading 1 of 1 · 50 %" beside the disabled button, then "✓ 1 downloaded"
 *   sd-cli      found = ⟳ Reinstall sd-cli (…)
 * No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.601.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const posts = [];
  // ---- the stand-ins
  let aoState = "idle", jobState = "running", dlState = "idle";
  await p.route(/\/api\/addons$/, (r) => r.fulfill({ json: { addons: [{ id: "zz601", label: "Test add-on", for: "the test", needs: "nothing", size: "1 MB", installed: true, actions: ["reinstall", "remove"] }], job: null } }));
  await p.route(/\/api\/addons\/zz601\/install$/, (r) => { posts.push({ url: "addon", body: r.request().postDataJSON() }); aoState = "running"; r.fulfill({ json: { ok: true, job: { id: "zz601", action: "install", state: "running" } } }); });
  await p.route(/\/api\/addons\/job/, (r) => r.fulfill({ json: aoState === "running" ? { job: { id: "zz601", action: "install", state: "running" }, lines: ["[..] fetching the wheel 3 of 7"], next: 1 } : { job: { id: "zz601", action: "install", state: "done" }, lines: ["[done] zz601 installed"], next: 2 } }));
  await p.route(/\/api\/asr$/, (r) => r.fulfill({ json: { installed: true, model: "base", device: "cpu", language: "", venv: "venvs/whisper", transcripts: [], engine: "whisper", bark: {} } }));
  await p.route(/\/api\/audio\/install$/, (r) => { posts.push({ url: "audio", body: r.request().postDataJSON() }); r.fulfill({ json: { id: "jz601", venv: "venvs/whisper", which: "whisper" } }); });
  await p.route(/\/api\/jobs\/jz601/, (r) => r.fulfill({ json: jobState === "running" ? { id: "jz601", status: "running", log: ["[worker] installing ctranslate2 4.6"], log_next: 1, progress: { pct: null } } : { id: "jz601", status: "done", log: [], log_next: 1 } }));
  await p.route(/\/api\/health$/, (r) => r.fulfill({ json: { sd_cli: true } }));
  await p.route(/\/api\/setup\/models$/, (r) => r.fulfill({ json: { groups: [{ id: "g", label: "Group" }], rows: [{ id: "have", group: "g", label: "Have it", size: 1e9, available: true, present: true, for: "x" }, { id: "need", group: "g", label: "Need it", size: 2e9, available: true, present: false, for: "y" }], free: 1e12 } }));
  await p.route(/\/api\/setup\/download$/, (r) => { posts.push({ url: "download", body: r.request().postDataJSON() }); dlState = "busy"; r.fulfill({ json: { ok: true } }); });
  await p.route(/\/api\/setup\/state$/, (r) => r.fulfill({ json: dlState === "busy" ? { busy: true, what: "download", started: 7, files: { have: { state: "run", got: 5e8, total: 1e9 } }, log: [] } : dlState === "done" ? { busy: false, what: "download", started: 7, result: { ok: true }, files: { have: { state: "ok" } }, log: [] } : { busy: false, log: [] } }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY && window.H3Install && window.H3Addons, null, { timeout: 60000 });
    // ---- Add-ons
    await ev(() => { window.H3Addons.open(); return window.H3Addons.refresh(); });
    await p.waitForSelector('#aoList .ao[data-addon="zz601"] [data-act="install"]');
    const lab = await ev(() => document.querySelector('#aoList .ao[data-addon="zz601"] [data-act="install"]').textContent);
    check("Add-ons: an installed add-on's button says ⟳ Reinstall", lab === "⟳ Reinstall", lab);
    await ev(() => document.querySelector('#aoList .ao[data-addon="zz601"] [data-act="install"]').click());
    await p.waitForTimeout(1500);
    const a1 = await ev(() => { const c = document.querySelector('#aoList .ao[data-addon="zz601"]'); return { chip: (c.querySelector(".h3inst") || {}).textContent || "", run: !!c.querySelector(".h3inst.run"), off: [...c.querySelectorAll(".btns button")].every((x) => x.disabled) }; });
    check("…pressed: {reinstall: true} is sent, its buttons are disabled and the status beside them says what it is doing (the last log line)",
      posts.some((x) => x.url === "addon" && x.body && x.body.reinstall === true) && a1.off && a1.run && /^Installing… fetching the wheel 3 of 7/.test(a1.chip), { a1, posts });
    aoState = "done";
    await p.waitForFunction(() => { const c = document.querySelector('#aoList .ao[data-addon="zz601"] .h3inst'); return c && /✓ installed/.test(c.textContent); }, null, { timeout: 10000 });
    const a2 = await ev(() => [...document.querySelectorAll('#aoList .ao[data-addon="zz601"] .btns button')].every((x) => !x.disabled));
    check("…done: \"✓ installed\" beside them and the buttons are back", a2);
    // ---- Audio: faster-whisper
    await ev(() => document.querySelector('#settings .stabs [data-stab="audio"]').click());
    await ev(() => refreshAsr());
    await p.waitForFunction(() => document.getElementById("s_asrinstall").textContent === "⟳ Reinstall faster-whisper", null, { timeout: 8000 }).catch(() => {});
    const w0 = await ev(() => ({ t: document.getElementById("s_asrinstall").textContent, re: document.getElementById("s_asrinstall").classList.contains("h3re") }));
    check("Audio: faster-whisper installed = ⟳ Reinstall faster-whisper (green)", w0.t === "⟳ Reinstall faster-whisper" && w0.re, w0);
    await ev(() => document.getElementById("s_asrinstall").click());
    await p.waitForFunction(() => { const c = document.getElementById("s_asrinstall_inst"); return c && /ctranslate2/.test(c.textContent); }, null, { timeout: 10000 }).catch(() => {});
    const w1 = await ev(() => ({ dis: document.getElementById("s_asrinstall").disabled, chip: (document.getElementById("s_asrinstall_inst") || {}).textContent || "", next: document.getElementById("s_asrinstall").nextElementSibling.id }));
    check("…pressed: the button is disabled and RIGHT beside it \"Installing faster-whisper… - <the job's line>\"", w1.dis && w1.next === "s_asrinstall_inst" && /^Installing faster-whisper… - installing ctranslate2 4\.6/.test(w1.chip), w1);
    jobState = "done";
    await p.waitForFunction(() => { const c = document.getElementById("s_asrinstall_inst"); return c && /✓/.test(c.textContent); }, null, { timeout: 10000 }).catch(() => {});
    const w2 = await ev(() => ({ dis: document.getElementById("s_asrinstall").disabled, chip: document.getElementById("s_asrinstall_inst").textContent }));
    check("…the job done: \"✓ faster-whisper installed\" and the button is back", !w2.dis && w2.chip === "✓ faster-whisper installed", w2);
    // ---- sd-cli
    await ev(() => refreshSdStatus());
    await p.waitForTimeout(400);
    const sd = await ev(() => document.getElementById("s_sdinstall").textContent);
    check("sd-cli found: ⟳ Reinstall sd-cli (latest CUDA build, ~900 MB)", sd === "⟳ Reinstall sd-cli (latest CUDA build, ~900 MB)", sd);
    // ---- the model catalog
    await ev(() => window.ModelsDialog.open());
    await p.waitForSelector('.mList input[data-id="have"]');
    const m0 = await ev(() => { const h = document.querySelector('.mList input[data-id="have"]'), n = document.querySelector('.mList input[data-id="need"]'), g = document.querySelector(".mList input[data-grp]"); g.checked = true; g.onchange(); return { haveOff: h.disabled, haveTicked: h.checked, needTicked: n.checked }; });
    check("Models: a downloaded model can be ticked (it was greyed out); the group box ticks only the missing ones", !m0.haveOff && !m0.haveTicked && m0.needTicked, m0);
    const m1 = await ev(() => { const h = document.querySelector('.mList input[data-id="have"]'), n = document.querySelector('.mList input[data-id="need"]'); n.checked = false; h.checked = true; h.onchange(); return document.querySelector(".mGo").textContent; });
    check("…the downloaded one ticked alone: ⟳ Download again", m1 === "⟳ Download again", m1);
    await ev(() => window.ModelsDialog._api.go());
    await p.waitForTimeout(1600);
    const m2 = await ev(() => { const g = document.querySelector(".mGo"), c = g.nextElementSibling; return { dis: g.disabled, chip: c && c.classList.contains("h3inst") ? c.textContent : "" }; });
    check("…pressed: {force: true}, the button disabled and beside it \"Downloading 1 of 1 · 50 %\"", posts.some((x) => x.url === "download" && x.body.force === true && x.body.ids.join() === "have") && m2.dis && /^Downloading 1 of 1 · 50 %/.test(m2.chip), { m2, posts: posts.filter((x) => x.url === "download") });
    dlState = "done";
    await p.waitForFunction(() => { const c = document.querySelector(".mGo").nextElementSibling; return c && /✓/.test(c.textContent); }, null, { timeout: 10000 }).catch(() => {});
    const m3 = await ev(() => document.querySelector(".mGo").nextElementSibling.textContent);
    check("…done: \"✓ 1 downloaded\"", m3 === "✓ 1 downloaded", m3);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { try { await b.close(); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
