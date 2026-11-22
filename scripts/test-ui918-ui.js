#!/usr/bin/env node
/* bitGen Studio — 2.918.0 in a REAL browser: the prompt docker with the "LongCat Avatar 1.6" video style.
 * Tim: "https://meigen-ai.github.io/LongCat-Video-Avatar-1.6-Page/, can you add this"
 *   1. the ⓘ LongCat hint beside the video style select for that style only;
 *   2. Generate with no sound in the References docker = said, nothing sent; with one: POST /api/longcat (not /api/generate)
 *      with the prompt, size, seed, the style, the first sound as ref_audio and the picture typed First frame as `first`;
 *      a 409 needs longcat opens the Download / Cancel box;
 *   3. the real server end to end: a sound uploaded to the project, Generate -> /api/longcat -> misc/longcat_worker.py -> the
 *      stub ComfyUI (the pack's nodes, the files in its models folder) -> a _longcat.mp4 as long as the sound, with it;
 *      GET /api/longcat (the add-on's status, ComfyUI's nodes, 25 fps); POST /api/longcat with another style refused;
 *      /api/generate turning a LongCat style away.
 * Against the running app (H3_URL) and its stub ComfyUI on 8388 (restarted by e2e-stub-test.sh). */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

// the stub ComfyUI's models folder (scripts/stub-comfy.py MODELS_ROOT) gets the LongCat files the worker looks for
const MROOT = process.env.STUB_MODELS_ROOT || "/tmp/e2e_comfy/ComfyUI/models";
for (const [d, f] of [["diffusion_models", "longcat-video-avatar/longcat_video_avatar_1.6_int8_convrot.safetensors"],
  ["loras", "longcat-video-avatar/longcat_video_avatar_1.6_dmd_lora_bf16.safetensors"], ["loras", "longcat-video-avatar/longcat_video_avatar_1.6_opsd_lora_bf16.safetensors"],
  ["audio_encoders", "whisper_large_v3_encoder_fp16.safetensors"], ["text_encoders", "umt5_xxl_fp8_e4m3fn_scaled.safetensors"], ["vae", "wan_2.1_vae.safetensors"]]) {
  const p = path.join(MROOT, d, f); fs.mkdirSync(path.dirname(p), { recursive: true }); if (!fs.existsSync(p)) fs.writeFileSync(p, "x");
}

(async () => {
  if (!chromium) { console.log("SKIP: playwright is not installed here"); console.log("\nRESULT: 0 passed, 0 failed"); return; }
  const wav = path.join(require("os").tmpdir(), "lc918-speech.wav");
  execSync(`ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=200:sample_rate=16000" -t 4 "${wav}"`);
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const sent = [], generic = [];
  let answer = { id: "fake918", status: "queued", notes: ["LongCat Avatar 1.6 from a start picture"] }, code = 200, intercept = true;
  await p.route("**/api/longcat", async (route) => {
    if (route.request().method() !== "POST" || !intercept) return route.continue();
    sent.push(route.request().postDataBuffer().toString("latin1"));
    route.fulfill({ status: code, json: answer });
  });
  await p.route("**/api/generate", (route) => { generic.push(1); route.fulfill({ json: { id: "nope" } }); });
  await p.route("**/api/jobs/fake918", (route) => route.fulfill({ json: { id: "fake918", status: "done", outputs: [] } }));
  await p.route("**/api/comfy/ensure", (route) => route.fulfill({ json: { ok: true, reachable: true } }));
  await p.route("**/api/comfy/status", (route) => route.fulfill({ json: { reachable: true } }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3LongCatGen && document.getElementById("videoStyleSel")
      && typeof videoStyles !== "undefined" && videoStyles.some((s) => s.arch === "longcat_avatar"), null, { timeout: 60000 });
    const id = await ev(() => videoStyles.find((s) => s.arch === "longcat_avatar").id);
    const other = await ev(() => videoStyles.find((s) => s.arch === "minimax-h3").id);
    const vis = async (v) => ev((v) => { const s = document.getElementById("videoStyleSel"); s.value = v; s.dispatchEvent(new Event("change")); const t = document.getElementById("longcatTip");
      return { has: !!t, hidden: t ? t.hidden : null, next: !!t && t.parentNode === s.parentNode, style: !!H3LongCatGen.style(), tip: t ? t.title : "" }; }, v);
    const a = await vis(id), c = await vis(other);
    check("the ⓘ LongCat hint sits with the video style select for the LongCat style only, and says the sound is the speech",
      a.has && a.hidden === false && a.next && a.style && /first sound is the speech/.test(a.tip) && c.hidden === true && !c.style, { a, c });
    await vis(id);
    await ev(() => { refs.length = 0; refAuds.length = 0; if (document.getElementById("genModeSel")) document.getElementById("genModeSel").value = "video"; });
    const none = await ev(() => H3LongCatGen.submit("A man talks"));
    const note = async () => ev(() => { const d = document.getElementById("notedlg"); const t = d && d.open ? document.getElementById("note_body").textContent : ""; if (d && d.open) d.close(); return t; });
    const said = await note();
    check("no sound in the References docker: said, nothing sent", none === null && sent.length === 0 && /References docker/.test(said), said);
    await ev(() => {
      const mk = (n) => new File([new Uint8Array([137, 80, 78, 71])], n, { type: "image/png" });
      refs.push({ file: mk("plain.png"), role: "person" }); refs.push({ file: mk("face.png"), role: "first frame" });
      refAuds.push("speech.wav");
      document.getElementById("width").value = "1280"; document.getElementById("height").value = "720"; document.getElementById("seed").value = "9";
    });
    await ev(() => generateFrom("video", "A woman in a red jacket talks to the camera in a bright studio."));
    await p.waitForTimeout(600);
    const body = sent[0] || "";
    const field = (k) => { const m = body.match(new RegExp(`name="${k}"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--`)); return m ? m[1] : null; };
    check("Generate went to /api/longcat, not /api/generate", sent.length === 1 && generic.length === 0, { sent: sent.length, generic: generic.length });
    check("...the prompt, size, seed, the style, the first sound as ref_audio", /red jacket/.test(field("prompt") || "") && field("width") === "1280" && field("height") === "720"
      && field("seed") === "9" && field("video_style_id") === id && field("ref_audio") === "speech.wav", ["prompt", "width", "height", "seed", "ref_audio"].map(field));
    check("...the picture typed First frame is `first`, the other not sent", /name="first"; filename="face\.png"/.test(body) && !/plain\.png/.test(body), body.slice(0, 400));
    code = 409; answer = { error: "LongCat Avatar's node pack and files are not installed yet - Settings ▸ Add-ons ▸ LongCat Avatar 1.6", needs: "longcat" };
    const done = ev(() => H3LongCatGen.submit("x"));
    await p.waitForSelector("dialog.nidlg[open]", { timeout: 8000 }).catch(() => null);
    const box = await ev(() => { const d = document.querySelector("dialog.nidlg[open]"); return d ? d.textContent : ""; });
    check("a 409 needs longcat opens the Download / Cancel box for LongCat Avatar 1.6", /LongCat Avatar 1\.6/.test(box) && /Cancel/.test(box), box.slice(0, 300));
    await ev(() => { const d = document.querySelector("dialog.nidlg[open]"); const bt = d && [...d.querySelectorAll("button")].find((x) => /Cancel/.test(x.textContent)); if (bt) bt.click(); });
    check("...Cancel = no job", (await done) === null);

    // the real server, end to end on the stub ComfyUI
    intercept = false;
    await p.unroute("**/api/comfy/ensure"); await p.unroute("**/api/comfy/status");
    const st = await ev(async () => (await fetch("/api/longcat")).json());
    check("GET /api/longcat: the add-on's items (pack, int8 / W4A8 / bf16, LoRAs, Whisper, umT5, VAE), ComfyUI's nodes, 25 fps",
      Array.isArray(st.items) && st.items.map((i) => i.id).join() === "pack,int8,w4a8,bf16,loras,whisper,te,vae" && st.comfy && st.comfy.online === true && st.fps === 25, st);
    const up = await ev(async (b64) => { const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)); const fd = new FormData();
      fd.append("file", new File([bin], "lc918-speech.wav", { type: "audio/wav" })); const r = await fetch("/api/passets", { method: "POST", body: fd }); return r.json(); },
    fs.readFileSync(wav).toString("base64"));
    await ev((n) => { refs.length = 0; refAuds.length = 0; refAuds.push(n); document.getElementById("width").value = "832"; document.getElementById("height").value = "480"; }, up.name);
    const jid = await ev(() => H3LongCatGen.submit("A man sings on a stage under warm lights, smiling, moving his hands."));
    const why = jid ? "" : await note();
    let job = null;
    for (let i = 0; i < 90 && jid; i++) {
      job = await ev(async (j) => (await fetch("/api/jobs/" + j + "?log=1")).json(), jid);
      if (job && /done|failed|error|cancel/.test(job.status)) break;
      await p.waitForTimeout(1000);
    }
    const log = ((job && job.log) || []).join("\n");
    const out = job && (job.output || (job.outputs || [])[0] || "");
    check("END TO END: the sound uploaded, Generate -> /api/longcat -> longcat_worker.py -> the stub's LongCat nodes -> a _longcat.mp4, done",
      up && up.name && jid && job && job.status === "done" && /_longcat\.mp4/.test(JSON.stringify(out)) && /longcat complete/.test(log), { up, jid, why, status: job && job.status, out, log: log.slice(-1500) });
    check("...as long as the sound (4 s = 2 segments of 93 frames), 480p from Basic Settings' 832x480, the int8 DiT, with the speech",
      /4\.0 s = 2 segment/.test(log) && /832x480 \(480p/.test(log) && /longcat_video_avatar_1\.6_int8_convrot/.test(log) && /with the speech/.test(log), log.slice(-1500));
    const bad = await ev(async (o) => { const fd = new FormData(); fd.append("prompt", "x"); fd.append("ref_audio", "a.wav"); fd.append("video_style_id", o); const r = await fetch("/api/longcat", { method: "POST", body: fd }); return { s: r.status, j: await r.json() }; }, other);
    check("POST /api/longcat with a style that is not LongCat is refused in words", bad.s === 400 && /LongCat Avatar 1\.6 video style/.test(bad.j.error), bad);
    const nos = await ev(async (o) => { const fd = new FormData(); fd.append("prompt", "x"); fd.append("video_style_id", o); const r = await fetch("/api/longcat", { method: "POST", body: fd }); return { s: r.status, j: await r.json() }; }, id);
    check("POST /api/longcat with no sound is refused in words", nos.s === 400 && /References docker/.test(nos.j.error), nos);
    await p.unroute("**/api/generate");
    const gen = await ev(async (o) => { const fd = new FormData(); fd.append("prompt", "x"); fd.append("mode", "t2va"); fd.append("video_style_id", o); const r = await fetch("/api/generate", { method: "POST", body: fd }); return { s: r.status, j: await r.json() }; }, id);
    check("/api/generate turns a LongCat style away (an old tab), pointing at its own path", gen.s === 400 && /LongCat Avatar style/.test(gen.j.error) && /\/api\/longcat/.test(gen.j.error), gen);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
