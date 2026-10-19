#!/usr/bin/env node
/* bitGen Studio — 2.401.0 in a REAL browser: Basic Settings' video style card (its model, a quick change saved into
 * the style) + the prompt docker's ⏫ Enhance upscaling the video selected in the gallery, the Video assets or the
 * reference dock.
 * Tim (verbatim): "show the selected video style settings with it's model in basic settings . allow user to quick
 * change the model. use the enhance button in the prompt docker to upscale the selected video - the selected video
 * will be the one selected from gallery,assets or reference"
 * Against the running app (H3_URL, default the e2e server on :8311). No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the style card / Enhance browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); }
};
const J = (u, b) => fetch(URL_ + u, b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const made = [];
  let wanBefore = null;
  try {
    const sent = [];
    await p.route("**/api/seedvr2", (r) => { if (r.request().method() !== "POST") return r.continue(); sent.push(JSON.parse(r.request().postData() || "{}")); r.fulfill({ json: { id: "svx", note: "x", target: { width: 640, height: 384, mult: 2 } } }); });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3_PROJECT_READY && window.StyleCard && window.SelVideo && window.SeedVR2Panel, null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    const list = (await J("api/styles?kind=video")).styles;
    const tpl = list.find((s) => s.arch === "minimax-h3" && !Object.values(s.workflows || {}).some(Boolean) && s.name !== "MM3_Characters");
    const wan = list.find((s) => s.arch === "wan22");
    wanBefore = wan ? JSON.parse(JSON.stringify(wan)) : null;
    // 2.408.0: the page restores the style picked last (a previous run's Wan) shortly after load - pick ours until it sticks
    let card = null;
    await p.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    let held = 0;
    for (let k = 0; k < 30 && held < 2; k++) {
      card = await ev((id) => { if (window.SecFloat) { SecFloat.show("camera", false); SecFloat.show("basic", true); }
        const s = document.getElementById("videoStyleSel"); if (s.value !== id) { s.value = id; s.dispatchEvent(new Event("change")); } }, tpl.id);
      await p.waitForTimeout(500);
      if (await ev((id) => document.getElementById("videoStyleSel").value === id && (document.getElementById("bscSel") || {}).value === id, tpl.id)) held++;
      else held = 0;
    }
    // 2.408.0: the card fills in from the server - under the full gate's load that can take a while (it flaked at 10 s)
    await p.waitForFunction(() => /the workflow's own\)/.test((document.querySelector("#bsStyleCard .bscuse") || {}).textContent || "")
      && document.querySelector("#bsStyleCard .bscextra") && document.querySelector("#bsStyleCard select.cmfile"), null, { timeout: 45000 }).catch(() => {});
    const c1 = await ev(() => ({ sel: document.getElementById("bscSel").value, kind: document.querySelector("#bsStyleCard .bsckind").textContent,
      use: document.querySelector("#bsStyleCard .bscuse").textContent, label: document.querySelector("#bsStyleCard .bscphase label").textContent,
      blank: document.querySelector("#bsStyleCard select.cmfile").options[0].textContent, extra: document.querySelector("#bsStyleCard .bscextra").textContent }));
    check(`Basic Settings shows the prompt docker's video style (${tpl.name}): its kind, 'Model' + what it renders with (the template's model), encoder / VAE / LoRAs`,
      c1.sel === tpl.id && /MiniMax H3/.test(c1.kind) && /^uses minimax_h3_\S+ \(the workflow's own\)$/.test(c1.use) && c1.label === "Model"
      && /^— the workflow's own: minimax_h3_/.test(c1.blank) && /Text encoder/.test(c1.extra) && /VAE/.test(c1.extra) && /LoRAs/.test(c1.extra), c1);

    if (wan) {
      await ev((id) => { const s = document.getElementById("bscSel"); s.value = id; s.dispatchEvent(new Event("change")); }, wan.id);
      await p.waitForFunction(() => document.querySelectorAll("#bsStyleCard .bscphase label").length === 2
        && [...document.querySelectorAll("#bsStyleCard .bscuse")].every((x) => /auto - the Wan file/.test(x.textContent)), null, { timeout: 45000 }).catch(() => {});
      const c2 = await ev(() => ({ prompt: document.getElementById("videoStyleSel").value, labels: [...document.querySelectorAll("#bsStyleCard .bscphase label")].map((x) => x.textContent),
        uses: [...document.querySelectorAll("#bsStyleCard .bscuse")].map((x) => x.textContent) }));
      check("picking Wan 2.2 in the card picks it in the prompt docker too; two rows - high noise / low noise - auto",
        c2.prompt === wan.id && c2.labels.join("|") === "Model · high noise|Model · low noise" && c2.uses.every((u) => /auto - the Wan file ComfyUI lists/.test(u)), c2);
      // quick change: the low-noise model (the style had one phase) -> saved into the style file
      await ev(() => { const s = document.querySelectorAll("#bsStyleCard select.cmfile")[1]; const o = document.createElement("option"); o.value = "e2e_wan22_low.safetensors"; o.textContent = o.value; s.appendChild(o); s.value = o.value; s.dispatchEvent(new Event("change")); });
      await p.waitForFunction(() => /the next render uses it/.test((document.getElementById("bscMsg") || {}).textContent || ""), null, { timeout: 10000 }).catch(() => {});
      const saved = (await J("api/styles?kind=video")).styles.find((s) => s.id === wan.id);
      const c3 = await ev(() => ({ msg: document.getElementById("bscMsg").textContent, uses: [...document.querySelectorAll("#bsStyleCard .bscuse")].map((x) => x.textContent) }));
      check("a quick change of the low-noise model is SAVED into the style (phase 2 created), the card says the next render uses it",
        saved && saved.phases.length === 2 && saved.phases[1].model === "e2e_wan22_low.safetensors" && saved.phases[0].model === ((wanBefore.phases || [])[0] || {}).model
        && /low noise|phase 2/.test(c3.msg) && /e2e_wan22_low\.safetensors - the next render uses it/.test(c3.msg) && c3.uses[1] === "uses e2e_wan22_low.safetensors", { saved: saved && saved.phases, c3 });
      await ev(() => document.getElementById("bscEdit").click());
      await p.waitForTimeout(500);
      const c4 = await ev(() => ({ open: document.getElementById("settings").open, tab: (document.querySelector("#settings .stabs button.active") || {}).dataset.stab, list: (document.getElementById("s_vslist") || {}).value }));
      await ev(() => document.getElementById("settings").close());
      check("⚙ on the card opens Settings → Video on that style", c4.open && c4.tab === "video" && c4.list === wan.id, c4);
    }

    // ---- ⏫ Enhance on the selected video
    await ev(() => { window.__refKeep = refVids.slice(); refVids.length = 0; renderRefLists(); for (const x of document.querySelectorAll("#gallery .thumb.sel")) x.classList.remove("sel"); SelVideo.clear(); });
    await p.waitForTimeout(200);
    const e0 = await ev(() => ({ label: document.getElementById("enhanceBtn").textContent, title: document.getElementById("enhanceBtn").title, armed: document.getElementById("enhanceBtn").classList.contains("armed") }));
    await ev(() => document.getElementById("enhanceBtn").click());
    await p.waitForTimeout(500);
    const e0b = await ev(() => ({ shown: SeedVR2Panel.shown(), plan: document.getElementById("svPlan").textContent, go: document.getElementById("svGo").disabled }));
    await ev(() => SeedVR2Panel.close());
    check("⏫ Enhance (the prompt menubar) with nothing selected: not armed, says to click a video; the panel says so, Upscale off",
      e0.label === "⏫ Enhance" && !e0.armed && /click a video in the gallery, the Video assets or the reference dock first/.test(e0.title)
      && e0b.shown && /select a video first/.test(e0b.plan) && e0b.go, { e0, e0b });

    const where = await J("api/outputs/where");
    const proj = (where.dirs || where).find((x) => x.where === "project");
    const gname = `sel_gal_${process.pid}.mp4`, aname = `sel_ast_${process.pid}.mp4`;
    const gfile = path.join(proj.dir, "output", gname), afile = path.join(proj.dir, "video", aname);
    for (const [f, size] of [[gfile, "320x192"], [afile, "256x144"]]) {
      fs.mkdirSync(path.dirname(f), { recursive: true });
      execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `testsrc2=size=${size}:rate=24`, "-t", "1", "-pix_fmt", "yuv420p", "-c:v", "libx264", f]);
      made.push(f);
    }
    // the gallery
    await ev(async () => { galTab = "video"; await refreshGallery(); });
    await p.waitForTimeout(400);
    await ev((n) => { document.querySelector(`#gallery .thumb[data-name="${n}"]`).click(); }, gname);
    await p.waitForTimeout(300);
    await ev(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
    const g1 = await ev(() => ({ sel: SelVideo.get(), title: document.getElementById("enhanceBtn").title, armed: document.getElementById("enhanceBtn").classList.contains("armed"),
      ring: [...document.querySelectorAll("#gallery .thumb.svpick")].map((x) => x.dataset.name) }));
    check("a click on a gallery video selects it: ⏫ Enhance armed, its tooltip names it, the tile ringed",
      g1.sel && g1.sel.name === gname && g1.sel.from === "gallery" && g1.armed && g1.title.includes(gname) && /\(gallery\)/.test(g1.title) && g1.ring.join() === gname, g1);
    await ev(() => document.getElementById("enhanceBtn").click());
    await p.waitForFunction(() => /→/.test(document.getElementById("svPlan").textContent), null, { timeout: 10000 }).catch(() => {});
    const g2 = await ev(() => ({ src: document.getElementById("svSrc").textContent, plan: document.getElementById("svPlan").textContent }));
    await ev(() => { const s = document.getElementById("svSize"); s.value = "x2"; s.dispatchEvent(new Event("change")); });
    await p.waitForTimeout(500);
    await ev(() => document.getElementById("svGo").click());
    await p.waitForTimeout(500);
    check("⏫ Enhance opens SeedVR2 on it ('<name> · gallery', 320×192 → …); Upscale sends name + from gallery",
      g2.src === gname + " · gallery" && /^320×192 → \d+×\d+/.test(g2.plan) && sent.length === 1 && sent[0].name === gname && sent[0].from === "gallery" && sent[0].size === "x2", { g2, sent });

    // the Video assets
    await ev(async () => { await refreshAssets(); setAtab("video"); });
    await p.waitForTimeout(500);
    const hasTile = await ev((n) => !!document.querySelector(`[data-apane="video"] .aitem[data-lb-name="${n}"]`), aname);
    await ev((n) => { const t = document.querySelector(`[data-apane="video"] .aitem[data-lb-name="${n}"]`); if (t) t.click(); }, aname);
    await p.waitForTimeout(300);
    await ev(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
    const a1 = await ev(() => ({ sel: SelVideo.get(), ring: [...document.querySelectorAll('[data-apane="video"] .aitem.svpick')].map((x) => x.dataset.lbName) }));
    await ev(() => document.getElementById("enhanceBtn").click());
    await p.waitForFunction(() => /→/.test(document.getElementById("svPlan").textContent), null, { timeout: 10000 }).catch(() => {});
    const a2 = await ev(() => ({ src: document.getElementById("svSrc").textContent, plan: document.getElementById("svPlan").textContent }));
    check("a click on a Video asset selects it instead (ringed); Enhance: '<name> · Video assets', 256×144 → …",
      hasTile && a1.sel && a1.sel.name === aname && a1.sel.from === "asset" && a1.ring.join() === aname && a2.src === aname + " · Video assets" && /^256×144 → /.test(a2.plan), { hasTile, a1, a2 });
    // a new pick while the panel is open retargets it: the gallery video again
    await ev((n) => { document.querySelector(`#gallery .thumb[data-name="${n}"]`).click(); }, gname);
    await p.waitForTimeout(400);
    await ev(() => document.querySelectorAll("dialog[open]").forEach((d) => d.close()));
    const a3 = await ev(() => ({ shown: SeedVR2Panel.shown(), src: document.getElementById("svSrc").textContent }));
    await ev(() => SeedVR2Panel.close());
    check("picking another video while the panel is open retargets it (the gallery video again)", a3.src === gname + " · gallery", a3);

    // the reference dock
    await ev((n) => { refVids.push(n); renderRefLists(); }, aname);
    await p.waitForTimeout(300);
    await ev((n) => { const t = document.querySelector(`#refvids [data-refvid="${n}"]`); if (t) t.click(); }, aname);
    await p.waitForTimeout(400);
    await ev(() => { try { if (window.RefSelect) RefSelect.close(); } catch { /* fine */ } document.querySelectorAll("dialog[open]").forEach((d) => d.close()); });
    const r1 = await ev(() => ({ sel: SelVideo.get(), title: document.getElementById("enhanceBtn").title }));
    check("a click on a reference video selects it: Enhance names it (reference dock)",
      r1.sel && r1.sel.name === aname && r1.sel.from === "ref" && r1.title.includes(aname) && /\(reference dock\)/.test(r1.title), r1);
    await ev(() => { refVids.length = 0; renderRefLists(); });
    await p.waitForTimeout(300);
    const r2 = await ev(() => SelVideo.get());
    check("removed from the dock -> the pick falls back (the gallery's ringed video)", r2 && r2.from === "gallery" && r2.name === gname, r2);
    check("no page errors", !errs.length, errs);
  } catch (e) {
    check("ran without throwing", false, String(e && e.stack || e));
  } finally {
    try { await ev(() => { if (window.__refKeep) { refVids.length = 0; refVids.push(...window.__refKeep); renderRefLists(); } }); } catch { /* fine */ }
    if (wanBefore) { const bdy = { ...wanBefore }; delete bdy.swap; delete bdy.ltx; delete bdy._file; await J("api/styles", bdy).catch(() => {}); }
    for (const f of made) try { fs.rmSync(f, { force: true }); } catch { /* fine */ }
    await b.close();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
