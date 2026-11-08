#!/usr/bin/env node
/* bitGen Studio — 2.719.0 in a REAL browser: MODELS NOT FOUND, asked before a render (static/modelsfound.js).
 * Tim: "check if models are in a model path before render - create a list of found models so it can be a quick check save
 * the list as /misc/models_found.json. if models are not found bring up a msgbox to download/cancel model names not found"
 *   1. the server: GET /api/models/found (misc/models_found.json), POST /api/models/check answers
 *   2. the box: every file not found - its name, its folder, its download or "not in bitGen's download list"; ⬇ Download
 *      only for the downloadable ones; Cancel = no render; asked once for the same files in a queue (20 s); Esc = Cancel
 *   3. ⬇ Download: POST /api/setup/download with the catalogue ids, a progress bar each, then checked again - all there =
 *      the render goes on; still missing = said, the failed download's reason under it
 *   4. the wiring: Generate image / video send the check first (the style, Basic Settings, the mode) and a Cancel sends
 *      no render
 *   5. 2.719.1: ANY render request in the page (the image editor's ✨ AI, a JSON /api/genimage) is checked first; Cancel =
 *      409 to that caller; X-Models-Check: skip; one check per render
 * The check's answers are played by the page (route) - no model files needed. Against the running app (H3_URL, default the
 * e2e server on :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the models-not-found browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

const T8 = { id: "qwen21_turbo8", label: "Qwen Image 2.1 Turbo8 LoRA (8 steps)", size: 1360000000, repo: "chriswritescode/Turbo8-LoRA-Qwen-Image-2.1", dest: "comfy/loras" };
const miss = (tag) => ({ checked: true, why: "", needed: 3, found: 1, rescanned: true, missing: [
  { name: "turbo8_lora_step2500.safetensors", cat: "loras", folder: "models/loras", from: "style", source: T8 },
  { name: "my_own_" + tag + ".safetensors", cat: "checkpoints", folder: "models/checkpoints", from: "workflow", source: null }] });

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const S = { checks: [], answer: () => miss("a"), downloads: [], state: [], renders: [] };
  try {
    // 1. the server
    const fl = await api("/api/models/found?names=0");
    check("GET /api/models/found: the list's file (misc/models_found.json), when it was made, its count", fl.file === "misc/models_found.json" && !!fl.made && typeof fl.count === "number", fl);
    const ck = await api("/api/models/check", { kind: "image", style_id: "no-such-style" });
    check("POST /api/models/check: a style that is not there = not checked (the render says why)", ck.checked === false && ck.why === "no style picked", ck);

    await p.route("**/api/models/check", async (r) => { S.checks.push(JSON.parse(r.request().postData() || "{}")); await r.fulfill({ json: S.answer() }); });
    await p.route("**/api/setup/download", async (r) => { S.downloads.push(JSON.parse(r.request().postData() || "{}")); await r.fulfill({ json: { ok: true, busy: true } }); });
    await p.route("**/api/setup/state", async (r) => { await r.fulfill({ json: S.state.length > 1 ? S.state.shift() : S.state[0] || { busy: false } }); });
    await p.route("**/api/genimage", async (r) => { S.renders.push("image"); await r.fulfill({ status: 400, json: { error: "test" } }); });
    await p.route("**/api/generate", async (r) => { S.renders.push("video"); await r.fulfill({ status: 400, json: { error: "test" } }); });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ModelsFound, null, { timeout: 60000 });
    await p.waitForTimeout(800);

    // 2. the box
    await ev(() => { window.__mf1 = H3ModelsFound.ensure({ kind: "image", style_id: "s1" }).then((v) => { window.__mf1v = v; }); });
    await p.waitForSelector("#mfDlg[open]", { timeout: 5000 });
    const box = await ev(() => ({ title: document.querySelector("#mfDlg h2").textContent, lead: document.querySelector("#mfDlg .mfnote").textContent,
      rows: [...document.querySelectorAll("#mfList li")].map((li) => ({ name: li.querySelector(".mfname").textContent, where: li.querySelector(".mfwhere").textContent, src: li.querySelector(".mfsrc").textContent })),
      dl: document.getElementById("mfDownload").textContent, dlOff: document.getElementById("mfDownload").disabled, cancel: document.getElementById("mfCancel").textContent, focus: document.activeElement && document.activeElement.id, modal: document.getElementById("mfDlg").matches(":modal") }));
    check("a message box 'Models not found': 'This render needs 2 model files that are not in any of ComfyUI's model paths'", box.title === "Models not found" && /needs 2 model files that are not in any of ComfyUI's model paths/.test(box.lead) && box.modal, box);
    check("…each file by name, with the folder it goes in (the style's / the workflow's)", box.rows.length === 2 && box.rows[0].name === "turbo8_lora_step2500.safetensors" && /goes in models\/loras \(the style\)/.test(box.rows[0].where) && /models\/checkpoints \(the workflow\)/.test(box.rows[1].where), box.rows);
    check("…the catalogue's one: its size and repo; the other: not in bitGen's download list (where to put it)", /1\.4 GB - Hugging Face: chriswritescode\/Turbo8-LoRA-Qwen-Image-2\.1/.test(box.rows[0].src) && /Not in bitGen's download list.*models\/checkpoints/.test(box.rows[1].src), box.rows);
    check("…⬇ Download (1.4 GB) (on - one can be downloaded, its size) and Cancel - Cancel has the focus (Enter never starts a download)", box.dl === "⬇ Download (1.4 GB)" && !box.dlOff && box.cancel === "Cancel" && box.focus === "mfCancel", box);
    await p.click("#mfCancel"); await p.waitForTimeout(200);
    check("Cancel: no render (false), the box gone", (await ev(() => window.__mf1v)) === false && !(await ev(() => !!document.getElementById("mfDlg"))));
    const again = await ev(() => H3ModelsFound.ensure({ kind: "image", style_id: "s1" }));
    const logT = await ev(() => document.getElementById("log").textContent);
    check("…the next queued render of the same files is refused without asking again (said in the console)", again === false && !(await ev(() => !!document.getElementById("mfDlg"))) && /cancelled a moment ago/.test(logT));
    S.answer = () => ({ checked: true, missing: [miss("b").missing[1]] });
    await ev(() => { window.__mf2 = H3ModelsFound.ensure({ kind: "image", style_id: "s2" }).then((v) => { window.__mf2v = v; }); });
    await p.waitForSelector("#mfDlg[open]", { timeout: 5000 });
    const none = await ev(() => ({ off: document.getElementById("mfDownload").disabled, note: document.getElementById("mfNote").textContent }));
    check("nothing downloadable: ⬇ Download off, 'put the files in the folders above, then press Generate again'", none.off && /Put the files in the folders above/.test(none.note), none);
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    check("…Esc = Cancel", (await ev(() => window.__mf2v)) === false && !(await ev(() => !!document.getElementById("mfDlg"))));

    // 3. ⬇ Download
    let n = 0;
    S.answer = () => (n++ === 0 ? miss("c") : { checked: true, missing: [] });
    S.state = [{ busy: true, files: { qwen21_turbo8: { state: "run", got: 50, total: 100 } } }, { busy: true, files: { qwen21_turbo8: { state: "run", got: 50, total: 100 } } },
      { busy: false, result: { ok: true, done: [], failed: [] }, files: { qwen21_turbo8: { state: "ok", got: 100, total: 100 } } }];
    await ev(() => { window.__mf3 = H3ModelsFound.ensure({ kind: "video", video_style_id: "v1", mode: "t2va" }).then((v) => { window.__mf3v = v; }); });
    await p.waitForSelector("#mfDlg[open]", { timeout: 5000 });
    await p.click("#mfDownload");
    await p.waitForFunction(() => { const i = document.querySelector("#mfList li .mfbar i"); return i && i.style.width === "50%"; }, null, { timeout: 5000 }).catch(() => {});
    const prog = await ev(() => ({ w: (document.querySelector("#mfList li .mfbar i") || {}).style.width, shown: (document.querySelector("#mfList li .mfbar") || {}).style.display, note: document.getElementById("mfNote").textContent, off: document.getElementById("mfDownload").disabled }));
    check("⬇ Download: POST /api/setup/download with the catalogue id (the saved token - none sent); a progress bar (50 %), the button off", S.downloads.length === 1 && JSON.stringify(S.downloads[0]) === '{"ids":["qwen21_turbo8"]}' && prog.w === "50%" && prog.shown === "block" && prog.off && /Downloading/.test(prog.note), { d: S.downloads, prog });
    await p.waitForFunction(() => window.__mf3v !== undefined, null, { timeout: 8000 }).catch(() => {});
    check("…done: checked again - all there = the render goes on by itself (true), the box closed", (await ev(() => window.__mf3v)) === true && !(await ev(() => !!document.getElementById("mfDlg"))) && S.checks.length >= 2 && S.checks[S.checks.length - 1].mode === "t2va", S.checks.slice(-2));
    S.answer = () => miss("d");
    S.state = [{ busy: false, result: { ok: false, done: [], failed: [{ id: "qwen21_turbo8", error: "gated - needs a Hugging Face token" }] }, files: { qwen21_turbo8: { state: "err", error: "gated - needs a Hugging Face token" } } }];
    await ev(() => { window.__mf4 = H3ModelsFound.ensure({ kind: "image", style_id: "s4" }).then((v) => { window.__mf4v = v; }); });
    await p.waitForSelector("#mfDlg[open]", { timeout: 5000 });
    await p.click("#mfDownload");
    await p.waitForFunction(() => /Still not found/.test(document.getElementById("mfNote").textContent), null, { timeout: 6000 }).catch(() => {});
    const still = await ev(() => ({ note: document.getElementById("mfNote").textContent, err: [...document.querySelectorAll("#mfList .mferr")].map((e) => e.style.display === "none" ? "" : e.textContent), open: document.getElementById("mfDlg").open, dl: !document.getElementById("mfDownload").disabled }));
    check("…a failed download: the box stays - 'Still not found: 2', the reason under the file, ⬇ Download again", still.open && /Still not found: 2/.test(still.note) && still.err[0] === "gated - needs a Hugging Face token" && still.dl, still);
    await p.click("#mfCancel"); await p.waitForTimeout(150);
    check("…Cancel then = no render", (await ev(() => window.__mf4v)) === false);

    // 4. the wiring
    S.answer = () => miss("e"); S.checks.length = 0;
    const sid = await ev(() => { const s = document.getElementById("styleSel"); const o = [...s.options].find((x) => x.value); if (o) s.value = o.value; return s.value; });
    await ev(() => { window.__img = startImageJob("a cat on a roof").then((v) => { window.__imgv = v; }); });
    await p.waitForSelector("#mfDlg[open]", { timeout: 6000 }).catch(() => {});
    const imgReq = S.checks[0] || {};
    check("Generate image: the check is sent first (kind image, the picked style) and the box opens", imgReq.kind === "image" && imgReq.style_id === sid && !!sid && await ev(() => !!document.getElementById("mfDlg")), imgReq);
    await p.click("#mfCancel").catch(() => {}); await p.waitForTimeout(400);
    check("…Cancel: no picture is rendered (no /api/genimage)", (await ev(() => window.__imgv)) === null && !S.renders.includes("image"), S.renders);
    S.answer = () => miss("f"); S.checks.length = 0;
    const vsid = await ev(() => { const s = document.getElementById("videoStyleSel"); return s ? s.value : ""; });
    await ev(() => { window.__vid = submitJob("a dog runs").then((v) => { window.__vidv = v; }); });
    await p.waitForSelector("#mfDlg[open]", { timeout: 6000 }).catch(() => {});
    const vReq = S.checks[0] || {};
    check("Generate video: the check is sent first (kind video, the video style, the mode, Basic Settings)", vReq.kind === "video" && vReq.video_style_id === vsid && ["ref2va", "t2va", "fl2va"].includes(vReq.mode) && "basic" in vReq && Array.isArray(vReq.extra_loras), vReq);
    await p.click("#mfCancel").catch(() => {}); await p.waitForTimeout(400);
    check("…Cancel: no video is rendered (no /api/generate)", (await ev(() => window.__vidv)) === null && !S.renders.includes("video"), S.renders);
    // 5. 2.719.1: every render in the page - whoever sends it (Tim's log: the image editor's ✨ AI went straight to ComfyUI)
    S.answer = () => miss("g"); S.checks.length = 0; S.renders.length = 0;
    await p.route("**/api/aiedit", async (r) => { S.renders.push("aiedit"); await r.fulfill({ json: { mode: "edit", jobs: [{ id: "j1" }], workflow: "comfy_workflows/img_qwen21_edit.json" } }); });
    await ev(() => { const fd = new FormData(); fd.append("mode", "edit"); fd.append("style_id", "t8"); fd.append("prompt", "x"); fd.append("crop", new Blob(["x"]), "crop.png");
      window.__ae = fetch("/api/aiedit", { method: "POST", body: fd }).then(async (r) => { window.__aev = { status: r.status, j: await r.json() }; }); });
    await p.waitForSelector("#mfDlg[open]", { timeout: 6000 }).catch(() => {});
    const aeReq = S.checks[0] || {};
    check("2.719.1 the image editor's ✨ AI (a FormData POST /api/aiedit from any code in the page): checked first - kind aiedit, its style, Edit; the box opens",
      aeReq.kind === "aiedit" && aeReq.style_id === "t8" && aeReq.mode === "edit" && await ev(() => !!document.getElementById("mfDlg")), aeReq);
    await p.click("#mfCancel").catch(() => {});
    await p.waitForFunction(() => window.__aev, null, { timeout: 5000 }).catch(() => {});
    const aev = await ev(() => window.__aev);
    check("…Cancel: the caller gets 409 {models_missing, error 'Not rendered - …'} (it shows its own message), nothing reaches /api/aiedit",
      aev && aev.status === 409 && aev.j.models_missing === true && /Not rendered/.test(aev.j.error) && !S.renders.includes("aiedit"), { aev, r: S.renders });
    n = 0; S.answer = () => (n++ === 0 ? miss("h") : { checked: true, missing: [] }); S.checks.length = 0;
    S.state = [{ busy: false, result: { ok: true, done: [], failed: [] }, files: { qwen21_turbo8: { state: "ok", got: 1, total: 1 } } }];
    await ev(() => { window.__gi = fetch("/api/genimage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "p", style_id: "s9", model: "ck.safetensors", extra_loras: [{ path: "t.safetensors", weight: 1 }] }) })
      .then((r) => { window.__giv = r.status; }); });
    await p.waitForSelector("#mfDlg[open]", { timeout: 6000 }).catch(() => {});
    await p.click("#mfDownload").catch(() => {});
    await p.waitForFunction(() => window.__giv !== undefined, null, { timeout: 8000 }).catch(() => {});
    const giReq = S.checks[0] || {};
    check("…a JSON POST /api/genimage (the StoryBoard, the characters, the timeline …): checked with its style, model and LoRAs; ⬇ Download then the request goes on",
      giReq.kind === "image" && giReq.style_id === "s9" && giReq.model === "ck.safetensors" && giReq.extra_loras && giReq.extra_loras[0].path === "t.safetensors"
      && (await ev(() => window.__giv)) === 400 && S.renders.includes("image"), { giReq, r: S.renders });
    S.checks.length = 0;
    await ev(() => fetch("/api/genimage", { method: "POST", headers: { "Content-Type": "application/json", "X-Models-Check": "skip" }, body: JSON.stringify({ prompt: "p", style_id: "s10" }) }).catch(() => null));
    check("…X-Models-Check: skip (the 🩺 Style doctor) = not checked", S.checks.length === 0, S.checks);
    S.answer = () => ({ checked: true, missing: [] }); S.checks.length = 0;
    await ev(() => H3ModelsFound.ensure({ kind: "image", style_id: "s11" }));
    await ev(() => fetch("/api/genimage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "p", style_id: "s11" }) }).catch(() => null));
    check("…just checked by Generate = its own request is not checked again (one check per render)", S.checks.length === 1, S.checks);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run finished", false, String(e && e.stack || e)); }
  finally { try { await b.close(); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
