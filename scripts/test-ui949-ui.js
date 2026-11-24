#!/usr/bin/env node
/* bitGen Studio — 2.949.0 in a REAL browser: the ⇄ Swap dialog's OpenJutsu engine. Engine ▸ OpenJutsu opens its bar (the
 * mode's fields, the size, the extra characters), its settings are saved at once, ✂ Auto segment cuts 30 s pieces; END TO
 * END the real server -> lib/openjutsu.js -> misc/openjutsu_worker.py -> the stub ComfyUI (8388) -> a take in vidTemp; 🎨 Fix
 * colours on it, 👁 Check mask (never kept), 🙂 Fix faces only after "I accept", ↻ on a fix refused in words.
 * Against the running app (H3_URL) with the stub ComfyUI configured (the gate's). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const MODELS = process.env.STUB_MODELS_ROOT || "/tmp/e2e_comfy/ComfyUI/models";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (p, body) => { const r = await fetch(new URL(p, URL_), body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}); return r.json(); };

(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  // the files OpenJutsu's graph loads, under bitGen's usual H3 names (the worker points OpenJutsu's names at them)
  const planted = [];
  for (const [d, f] of [["diffusion_models", "minimax_h3_ref2va_pruned_int8_convrot.safetensors"], ["loras", "minimax_h3_DMAD_4step_full_lora_avg_rank_39_bf16.safetensors"],
                        ["text_encoders", "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"], ["text_encoders", "qwen3vl_8b_int8_convrot.safetensors"],
                        ["vae", "minimax_h3_video_vae_fp16.safetensors"], ["vae", "minimax_h3_audio_vae_fp32.safetensors"], ["checkpoints", "sam3.1_multiplex_fp16.safetensors"]]) {
    const p = path.join(MODELS, d, f);
    if (!fs.existsSync(p)) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, "x"); planted.push(p); }
  }
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "ui949-"));
  const vid = path.join(T, "oj949_dance.mp4"), pic2 = path.join(T, "oj949_second.png"), pic1 = path.join(T, "oj949_first.png");
  execSync(`ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=640x360:rate=24 -f lavfi -i sine=frequency=300:sample_rate=44100 -t 6 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "${vid}"`);
  execSync(`ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=600x900 -frames:v 1 "${pic1}"`);
  execSync(`ffmpeg -y -loglevel error -f lavfi -i testsrc2=size=500x800 -frames:v 1 "${pic2}"`);
  const st0 = await api("/api/swapdlg");
  const keep0 = { engine: st0.engine, video: st0.video, max: st0.max };
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const state = () => api("/api/swapdlg");
  const waitDone = async (ids, ms) => {
    for (let t = 0; t < ms; t += 1000) {
      const s = await state();
      const rows = s.results.filter((r) => ids.includes(r.id));
      if (rows.length === ids.length && rows.every((r) => !["queued", "running"].includes(r.status))) return { s, rows };
      await sleep(1000);
    }
    const s = await state(); return { s, rows: s.results.filter((r) => ids.includes(r.id)) };
  };
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.SwapDialog && window.H3OjSwap, null, { timeout: 60000 });
    // the video + the picture through the dialog's own routes
    const up = await p.evaluate(async (b64) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const fd = new FormData(); fd.append("file", new Blob([bin], { type: "video/mp4" }), "oj949_dance.mp4");
      return (await fetch("/api/swapdlg/upload", { method: "POST", body: fd })).json();
    }, fs.readFileSync(vid).toString("base64"));
    await p.evaluate(async (b64) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const fd = new FormData(); fd.append("image", new Blob([bin], { type: "image/png" }), "oj949_first.png");
      return (await fetch("/api/swapdlg/picture", { method: "POST", body: fd })).json();
    }, fs.readFileSync(pic1).toString("base64"));
    check("setup: the test video in the Video assets, the character picked", !!up.video, up.error || up.note);
    await ev(() => window.SwapDialog.open());
    await p.waitForSelector("dialog.swdlg[open] .swEng", { timeout: 10000 });
    await p.selectOption("dialog.swdlg .swEng", "openjutsu");
    await p.waitForSelector("dialog.swdlg .swOjBar:not([hidden])", { timeout: 8000 });
    let s = await state();
    const ui = await ev(() => { const d = document.querySelector("dialog.swdlg"); const q = (c) => d.querySelector("." + c);
      return { quality: q("swQualL").hidden, up: q("swUp").hidden, mode: q("ojMode").value, simple: !q("ojSimple").hidden, adv: q("ojAdv").hidden, obj: q("ojObj").hidden,
               res: q("ojRes").value, dmad: q("ojDmad").checked, spec: q("ojSpec").disabled, face: q("ojFace").disabled, max: +q("swMax").max }; });
    check("Engine ▸ OpenJutsu: its bar opens (Simple, 736p, DMAD on, Spectrum off while DMAD, 🙂 off until accepted), Quality + ⏫ hidden, Max up to a minute",
      s.engine === "openjutsu" && ui.quality && ui.up && ui.mode === "simple" && ui.simple && ui.adv && ui.obj && ui.res === "736p" && ui.dmad && ui.spec && ui.face
      && Math.abs(ui.max - 59.71) < 0.05, ui);
    await p.selectOption("dialog.swdlg .ojMode", "object"); await sleep(500);
    const ob = await ev(() => { const d = document.querySelector("dialog.swdlg"); return { obj: !d.querySelector(".ojObj").hidden, simple: d.querySelector(".ojSimple").hidden, hat: d.querySelector(".ojHat").parentNode.hidden }; });
    check("Mode ▸ Object: change / remove / background + what / becomes shown, the person fields + hat fix hidden", ob.obj && ob.simple && ob.hat, ob);
    await p.selectOption("dialog.swdlg .ojMode", "advanced"); await sleep(400);
    // (a click on the slot opens the app's own file dialog - the input says which slot it is for)
    await ev(() => { document.querySelector("dialog.swdlg .ojPicIn").dataset.n = "2"; });
    await p.setInputFiles("dialog.swdlg .ojPicIn", pic2);
    await sleep(1200);
    await p.fill("dialog.swdlg .ojRoleN[data-i='1']", "the drummer"); await p.press("dialog.swdlg .ojRoleN[data-i='1']", "Tab"); await sleep(500);
    s = await state();
    const thumb = await ev(() => document.querySelector('dialog.swdlg .ojPic[data-n="2"]').classList.contains("on"));
    check("Advanced: character 2 picked (its thumbnail on), its role saved in the record", s.oj.mode === "advanced" && /^_oj_character_2\.png$/.test(s.oj.pictures[0]) && s.oj.roles[1] === "the drummer" && thumb, s.oj);
    await p.selectOption("dialog.swdlg .ojMode", "simple"); await sleep(300);
    await p.selectOption("dialog.swdlg .ojRes", "480p"); await sleep(500);
    s = await state();
    check("Size ▸ 480p saved at once", s.oj.resolution === "480p", s.oj.resolution);
    await ev(() => window.SwapDialog._api.auto()); await sleep(1500);
    s = await state();
    check("✂ Auto segment on OpenJutsu: one 6 s video = one segment (30 s pieces, not H3's 5 s)", s.segments.length === 1 && s.segments[0].frames >= 140, s.segments);
    // END TO END
    const seg = s.segments[0];
    const run = await api("/api/swapdlg/run", { ids: [seg.id] });
    check("⇄ Swap: queued as an OpenJutsu job (the note says so)", (run.queued || []).length === 1 && /OpenJutsu simple swap/.test(run.note || "") || /queued/.test(run.note || ""), run.error || run.note);
    let w = await waitDone(run.queued || [], 120000);
    const take = w.rows[0] || {};
    check("END TO END: the take lands in vidTemp (the stub ran OpenJutsu's graph)", take.status === "done" && /_swap_01_/.test(take.file) && take.engine === "openjutsu" && take.oj === "simple", take);
    // 🎨 on it
    const before = new Set((await state()).results.map((r) => r.id));
    await ev(() => window.SwapDialog._api.refresh());
    await ev((id) => { const c = window.SwapDialog.state(); const r = c.st.results.find((x) => x.id === id); window.SwapDialog._api.showOut(r); }, take.id);
    await p.click("dialog.swdlg .ojColor"); await sleep(800);
    const said = await ev(() => document.querySelector("dialog.swdlg .swMsg").textContent);
    s = await state();
    const col = s.results.find((r) => r.oj === "color" && !before.has(r.id));
    w = await waitDone(col ? [col.id] : [], 90000);
    check("🎨 Fix colours on the previewed take: a new take of the same segment, named _color", w.rows[0] && w.rows[0].status === "done" && /_color\.mp4$/.test(w.rows[0].file) && w.rows[0].seg === seg.id, { row: w.rows[0], said });
    const re = await api("/api/swapdlg/retry", { id: col && col.id });
    check("↻ on a 🎨 take is refused in words", /🎨 Fix colours again on the take it came from/.test(re.error || ""), re);
    // 👁 mask
    await p.click("dialog.swdlg .ojMask"); await sleep(800);
    s = await state();
    const mk = s.results.find((r) => r.oj === "mask" && !before.has(r.id));
    w = await waitDone(mk ? [mk.id] : [], 90000);
    const kp = await api("/api/swapdlg/keep", { id: mk && mk.id, keep: true });
    check("👁 Check mask: a _mask preview take - and it cannot be kept", w.rows[0] && w.rows[0].status === "done" && /_mask\.mp4$/.test(w.rows[0].file) && /mask check is a preview/.test(kp.error || ""), { row: w.rows[0], kp });
    // 🙂 after "I accept"
    p.once("dialog", (d) => d.accept());
    await p.click("dialog.swdlg .ojFaceOk"); await sleep(800);
    s = await state();
    const faceOn = await ev(() => !document.querySelector("dialog.swdlg .ojFace").disabled);
    check("🙂 I accept (after the licence warning): saved, the button enabled", s.oj.face.ok === true && faceOn, s.oj.face);
    const ad = await api("/api/openjutsu");
    check("GET /api/openjutsu: the add-on's state, the modes, the licence words", ad.addon && Array.isArray(ad.addon.items) && ad.modes.length === 4 && /non-commercial/.test(ad.licence.face));
    check("no page errors", !errs.length, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally {
    // this test's own takes + video asset leave (unique oj949_ names - the shared project stays as it was)
    try {
      const s = await api("/api/swapdlg");
      for (const r of s.results.filter((x) => /^oj949_/.test(x.video || ""))) await api("/api/swapdlg/discard", { id: r.id });
      const names = [...new Set(s.results.map((x) => x.video).concat(s.video || []).filter((v) => /^oj949_/.test(v || "")))];
      if (names.length) await api("/api/passets/recycle", { items: names.map((n) => ({ kind: "video", name: n })) });
      if (/^oj949_/.test(s.video || "")) await api("/api/swapdlg/set", { video: keep0.video && !/^oj949_/.test(keep0.video) ? keep0.video : "" });
      await api("/api/swapdlg/segments", { op: "clear" });
    } catch (e) { /* server gone */ }
    try { await api("/api/openjutsu/settings", { oj: { mode: "simple", resolution: "736p", face: { ok: false } } }); await api("/api/openjutsu/picture", { n: 2, clear: true }); } catch (e) { /* server gone */ }
    try { await api("/api/swapdlg/set", { engine: keep0.engine || "h3" }); } catch (e) { /* */ }
    for (const f of planted) { try { fs.unlinkSync(f); } catch (e) { /* */ } }
    fs.rmSync(T, { recursive: true, force: true });
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
