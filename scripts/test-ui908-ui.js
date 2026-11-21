#!/usr/bin/env node
/* bitGen Studio — 2.908.0 in a REAL browser:
 *   ⏱ the time estimate under Generate (Tim: "the time estimate will be good"): a FastH3 Omni render through the real server
 *     + worker (stub ComfyUI) - then the line says "⏱ about …" from that render, its tooltip names the style; the server's
 *     estimate scales with the size (4x the pixels = 4x the generation); 💬 Chat mode hides the line;
 *   📷 Capture frame -> the Gallery (Tim: "add the saved captured frame from video preview dialog to the gallery"): the
 *     render's video opened in the preview, 📷 - the Gallery turns to its Images tab and the frame's tile is lit.
 * Against the running app (H3_URL) with the stub ComfyUI the gate configures. */
"use strict";
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
(async () => {
  try { const r = await fetch(URL_); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.route("**/api/comfy/ensure", (r) => r.fulfill({ json: { ok: true, reachable: true } }));
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3TimeEst && window.H3LbFrame && typeof videoStyles !== "undefined" && videoStyles.some((s) => s.name === "FastH3 Omni"), null, { timeout: 60000 });
    await p.waitForFunction(() => performance.now() > 6500, null, { timeout: 20000 });
    const id = await p.evaluate(() => videoStyles.find((s) => s.name === "FastH3 Omni").id);
    await p.evaluate((v) => {
      const g = document.getElementById("genModeSel"); g.value = "video"; g.dispatchEvent(new Event("change"));
      const s = document.getElementById("videoStyleSel"); s.value = v; s.dispatchEvent(new Event("change"));
    }, id);
    await p.waitForFunction(() => /^⏱/.test(document.getElementById("go").getAttribute("data-est") || ""), null, { timeout: 10000 }).catch(() => {});
    check("⏱ the estimate rides in the Generate button (its foot line + tooltip), the label kept", await p.evaluate(() => { const g = document.getElementById("go"); const a = getComputedStyle(g, "::after").content || "";
      return /^"⏱/.test(a) && /^⏱/.test(g.getAttribute("data-est") || "") && !!g.title && g.textContent.trim().length > 0 && g.getBoundingClientRect().height === 46; }),
      await p.evaluate(() => (document.getElementById("goEst") || {}).textContent));
    // a render (the real server + worker on the stub)
    const before = new Set(await p.evaluate(async () => (((d) => (Array.isArray(d) ? d : d.jobs || []))(await (await fetch("/api/jobs?all=1")).json())).map((j) => j.id)));
    await p.evaluate(async () => {
      document.querySelector('.modes button[data-mode="ref2va"]').click();
      const rs = document.getElementById("resSel"); rs.value = "540"; rs.dispatchEvent(new Event("change", { bubbles: true }));
      const a = document.getElementById("arSel"); a.value = "16:9"; a.dispatchEvent(new Event("change", { bubbles: true }));
      const bl = await (await fetch("/static/icon.png")).blob();
      refs.length = 0; refs.push({ file: new File([bl], "who.png", { type: "image/png" }) });
    });
    await p.fill("#prompt", "a red cat walks <Picture 1>");
    await p.click("#go");
    let job = null;
    for (let i = 0; i < 60 && !job; i++) {
      await p.waitForTimeout(1000);
      const all = await p.evaluate(async () => ((d) => (Array.isArray(d) ? d : d.jobs || []))(await (await fetch("/api/jobs?all=1")).json()));
      const nw = all.filter((j) => !before.has(j.id));
      if (nw.length) { const d = await p.evaluate(async (jid) => (await fetch("/api/jobs/" + jid)).json(), nw[nw.length - 1].id); if (!["queued", "running"].includes(d.status)) job = d; }
    }
    check("the render finished", job && job.status === "done", job && [job.status, (job.log || []).slice(-5)]);
    await p.evaluate(() => H3TimeEst.ask(true));
    await p.waitForFunction(() => /^⏱ about/.test((document.getElementById("goEst") || {}).textContent || ""), null, { timeout: 10000 }).catch(() => {});
    const est = await p.evaluate(() => { const e = document.getElementById("goEst"); return { text: e.textContent, title: e.title }; });
    check("after it: '⏱ about …', the tooltip names FastH3 Omni", /^⏱ about \d/.test(est.text) && /renders? of FastH3 Omni here/.test(est.title), est);
    const q = (w, h) => p.evaluate(async ([v, w, h]) => (await (await fetch("/api/timeestimate", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "video", style: v, name: "FastH3 Omni", width: w, height: h, seconds: 4, steps: 0, cfg: 1 }) })).json()).estimate, [id, w, h]);
    const e1 = await q(960, 544), e4 = await q(1920, 1088);
    check("the server's estimate scales with the size: 4x the pixels = 4x the generation", e1 && e4 && Math.abs(e4.gen_ms / e1.gen_ms - 4) < 0.05 && e1.basis === "style", { e1, e4 });
    await p.evaluate(() => { const g = document.getElementById("genModeSel"); g.value = "chat"; g.dispatchEvent(new Event("change")); H3TimeEst.ask(true); });
    check("💬 Chat mode: no estimate on the button", await p.evaluate(() => !document.getElementById("go").hasAttribute("data-est")));
    await p.evaluate(() => { const g = document.getElementById("genModeSel"); g.value = "video"; g.dispatchEvent(new Event("change")); H3TimeEst.ask(true); });
    // 📷 Capture frame from the preview -> the Gallery's Images tab, the tile lit
    const out = (job && (job.output || (job.outputs || [])[0])) || "";
    const vname = path.basename(String(out));
    await p.evaluate(() => { const v = document.querySelector('.gtabs button[data-gtab="video"]'); if (v) v.click(); });
    await p.evaluate((n) => lbOpen([{ kind: "video", url: "/outputs/" + encodeURIComponent(n), name: n }], 0), vname);
    await p.waitForFunction(() => { const v = document.querySelector("#lb_wrap video"); return v && v.readyState >= 2 && !document.getElementById("lb_fgrp").hidden && /frame/.test(document.getElementById("lb_fno").textContent); }, null, { timeout: 20000 }).catch(() => {});
    await p.click("#lb_fcap");
    await p.waitForFunction(() => /saved as|not saved/.test(document.getElementById("lb_fmsg").textContent), null, { timeout: 20000 }).catch(() => {});
    const msg = await p.evaluate(() => document.getElementById("lb_fmsg").textContent);
    const fname = (msg.match(/saved as (\S+\.png)/) || [])[1] || "";
    check("📷 saved, the message says Gallery ▸ Images", !!fname && /\(Assets \+ Gallery ▸ Images\)/.test(msg), msg);
    const lit = await p.waitForFunction((n) => [...document.querySelectorAll("#gallery .thumb.lbJustSaved")].some((t) => (t.querySelector(".gname") || {}).textContent === n), fname, { timeout: 2500 }).then(() => true, () => false);
    await p.waitForFunction((n) => [...document.querySelectorAll("#gallery .thumb")].some((t) => (t.querySelector(".gname") || {}).textContent === n), fname, { timeout: 8000 }).catch(() => {});
    const g = await p.evaluate((n) => ({ tab: galTab, active: (document.querySelector(".gtabs button[data-gtab].active") || {}).dataset.gtab,
      has: [...document.querySelectorAll("#gallery .thumb")].some((t) => (t.querySelector(".gname") || {}).textContent === n) }), fname);
    check("…the Gallery turned to Images and shows the frame", g.tab === "images" && g.active === "images" && g.has, g);
    check("…its tile lit for a moment", lit, g);
    check("no page errors", errs.length === 0, errs);
  } finally { await b.close(); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
