#!/usr/bin/env node
/* bitGen Studio — 2.409.0 in a REAL browser against the REAL app:
 *   1. Basic Settings: the Model (override) box lists ComfyUI's models, the line under Override style says what it
 *      decides; with an LTX style, Generate sends `basic` (steps / cfg / seed / model / LoRAs) to /api/ltx; Enhance's
 *      Generate goes the same way (it used to go to /api/generate, which refuses LTX)
 *   2. ✨ Effects in a clip's Properties: a green screen keyed on the canvas (the layer under it shows through)
 *   3. ◐ an adjustment layer: a new top layer, Colour + Effects only, grey on the canvas while it is on - not outside
 * Run against the running app (H3_URL, default :8311). No Playwright = SKIP (exit 0).
 * Tim: "if overide is checked in basic settings docker then all models including ltx2.3 and 2.5 use basic settings
 * ... continue with the premier close gap". */
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
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.409 browser test did not run"); console.log("\nRESULT: 0 failed"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
const P = "zz_bfxui_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
const T = fs.mkdtempSync(path.join(os.tmpdir(), "bfxui_"));
const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error"].concat(a), { stdio: "ignore" });
const vp9 = ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-pix_fmt", "yuv420p", "-an"];
ff(["-f", "lavfi", "-i", "color=c=0xc02020:s=320x180:r=25:d=4"].concat(vp9, [path.join(T, "uired.webm")]));
ff(["-f", "lavfi", "-i", "color=c=0x00ff00:s=320x180:r=25:d=4,drawbox=x=110:y=60:w=100:h=60:color=white:t=fill"].concat(vp9, [path.join(T, "uigreen.webm")]));
ff(["-f", "lavfi", "-i", "testsrc2=size=320x180:rate=25:duration=4"].concat(vp9, [path.join(T, "uicol.webm")]));
const field = (body, name) => { const m = new RegExp('name="' + name + '"\\r\\n\\r\\n([^\\r]*)').exec(body || ""); return m ? m[1] : null; };

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2000, height: 1250 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
  p.on("dialog", (d) => { d.accept().catch(() => {}); });
  try {
    await api("/api/projects/new", { name: P });
    await api("/api/projects/load", { name: P });
    for (const f of ["uired.webm", "uigreen.webm", "uicol.webm"]) {
      const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(T, f))]), f);
      await fetch(URL_ + "api/passets", { method: "POST", body: fd });
    }
    await p.route("**/api/comfymodels*", (r) => r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, categories: { diffusion_models: ["ltx-2.5-22b-distilled.safetensors", "wan2.2_t2v_high.safetensors"], checkpoints: ["h3.safetensors"] }, model_categories: ["checkpoints", "diffusers", "diffusion_models"] }) }));
    const sent = { ltx: [], gen: [] };
    await p.route("**/api/ltx", async (r) => { sent.ltx.push(r.request().postData() || ""); await r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "test: not rendering" }) }); });
    await p.route("**/api/generate", async (r) => { sent.gen.push(r.request().postData() || ""); await r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "test: not rendering" }) }); });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Basic && window.H3Vfx && window.TlClipFx && document.getElementById("tlAdjBtn") && document.getElementById("vidModel"), null, { timeout: 30000 });

    /* ---- 1. Basic Settings + the override */
    await p.evaluate(() => {
      const ov = document.getElementById("ovrStyle"); ov.checked = true; ov.dispatchEvent(new Event("change"));
      const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input")); e.dispatchEvent(new Event("change")); };
      set("steps", "12"); set("cfg", "2.5"); set("seed", "4242");
    });
    await p.evaluate(() => document.getElementById("vidModel").dispatchEvent(new Event("focus")));   // the box may sit in a closed section
    await p.waitForFunction(() => document.querySelectorAll("#vidModelList option").length === 3, null, { timeout: 10000 }).catch(() => {});
    const opts = await p.evaluate(() => [...document.querySelectorAll("#vidModelList option")].map((o) => o.value));
    check("the Model (override) box lists ComfyUI's models (diffusion models + checkpoints)", opts.includes("ltx-2.5-22b-distilled.safetensors") && opts.includes("h3.safetensors"), opts);
    await p.evaluate(() => { const m = document.getElementById("vidModel"); m.value = "ltx-2.5-22b-distilled.safetensors"; m.dispatchEvent(new Event("change")); H3Basic.summary(); });
    const sum = await p.evaluate(() => document.getElementById("ovrSummary").textContent);
    check("the line under Override style says what it decides for every video model", /MiniMax H3, Wan, LTX 2\.3 \/ 2\.5/.test(sum) && /12 steps/.test(sum) && /cfg 2\.5/.test(sum) && /seed 4242/.test(sum) && /ltx-2\.5-22b-distilled/.test(sum), sum);
    await p.waitForFunction(() => typeof videoStyles !== "undefined" && videoStyles.some((x) => x.ltx), null, { timeout: 20000 }).catch(() => {});
    const ltxId = await p.evaluate(() => { const s = (typeof videoStyles !== "undefined" ? videoStyles : []).find((x) => x.ltx); if (!s) return ""; const sel = document.getElementById("videoStyleSel"); sel.value = s.id; sel.dispatchEvent(new Event("change")); return s.id; });
    // the style's pick copies its own steps / cfg into the sliders - set ours again, as a user would after picking
    await p.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input")); }; set("steps", "12"); set("cfg", "2.5"); set("seed", "4242");
      document.getElementById("genModeSel").value = "video"; document.getElementById("prompt").value = "A fox turns its head."; });
    await p.click("#go");
    await p.waitForFunction(() => true, null, { timeout: 500 });
    for (let i = 0; i < 40 && !sent.ltx.length; i++) await p.waitForTimeout(250);
    const bl = sent.ltx.length ? JSON.parse(field(sent.ltx[0], "basic") || "{}") : {};
    check("Generate with an LTX style sends Basic Settings to /api/ltx: override, steps 12, cfg 2.5, seed 4242, the model", !!ltxId && bl.override === true && bl.steps === 12 && bl.cfg === 2.5
      && bl.seed === 4242 && bl.model === "ltx-2.5-22b-distilled.safetensors" && field(sent.ltx[0], "prompt") === "A fox turns its head.", { ltxId, bl });
    await p.waitForTimeout(800);
    const nL = sent.ltx.length, nG = sent.gen.length;
    await p.evaluate(() => { document.getElementById("enhancedText").value = "An enhanced fox prompt."; document.getElementById("enhGenerate").click(); });
    for (let i = 0; i < 40 && sent.ltx.length === nL; i++) await p.waitForTimeout(250);
    check("Enhance's Generate with an LTX style goes to /api/ltx (the prompt chat's text), not /api/generate", sent.ltx.length === nL + 1 && sent.gen.length === nG
      && field(sent.ltx[nL], "prompt") === "An enhanced fox prompt.", { ltx: sent.ltx.length, gen: sent.gen.length });

    /* ---- 2. effects: a green screen keyed */
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 820);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = [{ name: "uired.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1 }];
      tl.vlayers = [mkLayer("V2", [{ name: "uigreen.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1 }])]; tl.images = []; tl.audio = [];
      PXS = 60; tlSave(); renderTimeline();
      window.__g = tl.vlayers[0].clips[0]; TlCanvas.select(__g, TlCanvas.layerOf(__g));
    });
    const shot = async (t, region) => p.evaluate(async ([t, region]) => {
      TlCanvas.go(t);
      for (let i = 0; i < 60; i++) {
        TlCanvas.draw();
        const ok = (tl.video.concat(...(tl.vlayers || []).map((L) => L.clips))).every((c) => { const b = TlCanvas.box(c, tl.video.includes(c) ? "v1" : "vl", t); const v = b && b.src; return !v || v.tagName !== "VIDEO" || (v.readyState >= 2 && !v.seeking); });
        if (ok) break; await new Promise((r) => setTimeout(r, 100));
      }
      await new Promise((r) => setTimeout(r, 200));
      const im = new Image(); im.src = TlCanvas.snapshot(); await im.decode();
      const cv = document.createElement("canvas"); cv.width = 320; cv.height = 180; const g = cv.getContext("2d"); g.drawImage(im, 0, 0, 320, 180);
      const r = region || [0, 0, 320, 180], d = g.getImageData(r[0], r[1], r[2], r[3]).data, m = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) { m[0] += d[i]; m[1] += d[i + 1]; m[2] += d[i + 2]; }
      return m.map((v) => v / (d.length / 4));
    }, [t, region || null]);
    const before = await shot(1, [5, 5, 50, 40]);
    const ef = await p.evaluate(() => { const d = document.getElementById("tfxEffects"); if (!d) return null; d.open = true;
      return { sliders: [...d.querySelectorAll("input[data-vfx]")].map((i) => i.dataset.vfx), key: !!document.getElementById("tfxKey"), crop: d.querySelectorAll("input[data-crop]").length, stab: !!document.getElementById("tfxStab") }; });
    check("✨ Effects in a video clip's Properties: blur, sharpen, glow, vignette, grain, crop, key, stabilise", ef && ef.sliders.join() === "blur,sharpen,glow,vignette,grain" && ef.key && ef.crop === 4 && ef.stab, ef);
    await p.evaluate(() => { const k = document.getElementById("tfxKey"); k.checked = true; k.dispatchEvent(new Event("change")); });
    const kfx = await p.evaluate(() => __g.fx && __g.fx.vfx && __g.fx.vfx.key);
    const after = await shot(1, [5, 5, 50, 40]), box = await shot(1, [130, 70, 60, 40]);
    check("key: stored (#00ff00), the canvas shows V1's red through the green, the white box stays", kfx && kfx.color === "#00ff00" && before[1] > 200 && after[0] > 150 && after[1] < 80 && box.every((v) => v > 200), { kfx, before, after, box });

    /* ---- 3. an adjustment layer */
    await p.evaluate(() => { tl.video = [{ name: "uicol.webm", src: "video", in: 0, out: 4, dur: 4, start: 0, opacity: 1 }]; tl.vlayers = []; tl.images = []; tlSave(); renderTimeline(); setPlayhead(1); });
    await p.evaluate(() => { const n = document.getElementById("notedlg"); if (n && n.open) n.close(); document.getElementById("tlAdjBtn").click(); });   // the faked 400s left a note open
    await p.waitForFunction(() => (tl.images || []).some((L) => (L.clips || []).some((c) => c.adjust)), null, { timeout: 10000 });
    const ad = await p.evaluate(() => { const L = tl.images[tl.images.length - 1], c = L.clips[0]; window.__a = c;
      return { name: L.name, c: { name: c.name, start: c.start, len: c.len, adjust: c.adjust }, folds: ["tfxSpeed", "tfxColour", "tfxEffects", "tfxSound"].map((id) => !!document.getElementById(id)),
               title: /Adjustment layer/.test(document.getElementById("tlProps").textContent), key: !!document.getElementById("tfxKey") }; });
    check("◐ adds an adjustment layer on top at the marker (5 s); its Properties: Colour + Effects only (no speed / sound / key)", /^Adjust 1$/.test(ad.name) && ad.c.adjust && ad.c.start === 1 && ad.c.len === 5
      && JSON.stringify(ad.folds) === "[false,true,true,false]" && ad.title && !ad.key, ad);
    await p.evaluate(() => { __a.len = 1; tlSave(); renderTimeline(); TlCanvas.select(__a, TlCanvas.layerOf(__a)); document.getElementById("tfxColour").open = true;
      const s = document.getElementById("tfxLook"); s.value = "mono"; s.dispatchEvent(new Event("change")); });
    const sat = async (t) => { const r = await p.evaluate(async (t) => {
      TlCanvas.go(t); for (let i = 0; i < 60; i++) { TlCanvas.draw(); const v = TlCanvas.box(tl.video[0], "v1", t).src; if (v.readyState >= 2 && !v.seeking) break; await new Promise((r) => setTimeout(r, 100)); }
      await new Promise((r) => setTimeout(r, 200));
      const im = new Image(); im.src = TlCanvas.snapshot(); await im.decode();
      const cv = document.createElement("canvas"); cv.width = 320; cv.height = 180; const g = cv.getContext("2d"); g.drawImage(im, 0, 0, 320, 180);
      const d = g.getImageData(0, 0, 320, 180).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); return s / (d.length / 4);
    }, t); return r; };
    const s0 = await sat(0.5), s1 = await sat(1.5), s2 = await sat(2.5);
    check("the adjustment (mono) greys the canvas while it is on - and not before or after", s1 < 8 && s0 > 40 && s2 > 40, { s0, s1, s2 });
    await p.evaluate(() => document.getElementById("tlColourBtn").click());
    const cd = await p.evaluate(() => !!document.getElementById("tcpW_gain"));
    check("🎨 Colour dialog works on the adjustment layer too", cd);
    await p.keyboard.press("Escape");
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
