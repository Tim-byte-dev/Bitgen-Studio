#!/usr/bin/env node
/* bitGen Studio — 2.685.0 against the RUNNING app (+ a real browser): BASIC SETTINGS' OVERRIDE STYLE REACHES THE IMAGE
 * PREVIEW'S 🎨 CHANGE STYLE. The real /api/aiedit makes the job (only the job's progress is stubbed for the browser):
 *   a checkpoint style (Illustrious / Pony / SDXL) - Refine over the whole picture = image to image with the style's own
 *   graph; the job carries Basic Settings' steps / CFG / checkpoint / temporary LoRA (2.684.0: the SDXL inpaint export ran
 *   as exported and dropped them all, the style's own model too);
 *   an edit model - steps / CFG / LoRA ride; a checkpoint that does not fit it is said, not silently dropped;
 *   the preview's bar says what Override put on the render.
 * Tim (verbatim): "i don't think the overide style in basic settings is being used in the preview change style"
 * Against the running app (H3_URL). No Playwright = the browser part SKIPs. */
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
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAIAAADBrGu+AAAAT0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyD0aJPaIiU1OTAAAAABJRU5ErkJggg==";
const get = async (u) => (await fetch(URL_ + u.replace(/^\//, ""))).json();
const CKPT = "juggernautXL_v9_e2e685.safetensors";
const OVR = { steps: 37, cfg: 3.3, model: CKPT, extra_loras: [{ path: "loras/e2e685.safetensors", weight: 0.6 }] };
async function aiedit(fields, refine) {
  const fd = new FormData(), png = new Blob([Buffer.from(PNG, "base64")], { type: "image/png" });
  fd.append("crop", png, "restyle.png");
  if (refine) { fd.append("mask", png, "mask.png"); fd.append("rgba", png, "hole.png"); }
  Object.keys(fields).forEach((k) => fd.append(k, String(fields[k])));
  const r = await fetch(URL_ + "api/aiedit", { method: "POST", body: fd }); return { ok: r.ok, j: await r.json() };
}
const cancel = async (id) => { for (const u of ["api/jobs/" + id + "/cancel", "api/cancel/" + id]) { try { const r = await fetch(URL_ + u, { method: "POST" }); if (r.ok) return; } catch { /* next */ } } };

(async () => {
  const E = await get("/api/aiedit/engines");
  const ck = (E.inpaint || []).find((s) => s.refine && /^(Illustrious|Pony|SDXL)$/.test(s.name));
  const ed = (E.edit || []).find((s) => /Klein.*edit/i.test(s.name)) || (E.edit || [])[0];
  check("the test server has a checkpoint style that refines (" + (ck && ck.name) + ") and an edit model (" + (ed && ed.name) + ")", !!ck && !!ed);
  if (!ck || !ed) { console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(1); }
  const base = { prompt: "anime style", count: 1, width: 512, height: 512, whole: "1", seed: 1234 };
  // 1 a checkpoint style, Override on
  const a = await aiedit(Object.assign({ mode: "refine", style_id: ck.id, strength: 70, ovr: JSON.stringify(OVR) }, base), true);
  const ja = a.j.jobs && a.j.jobs[0] ? await get("/api/jobs/" + a.j.jobs[0].id) : {}, pa = ja.params || {}, sa = pa.style || {};
  check(ck.name + " (a checkpoint style), Refine over the whole picture: image to image with the style's OWN graph (not the SDXL inpaint export), strength 0.70",
    a.ok && /style's own graph/.test(a.j.note || "") && !/img_inpaint_sdxl/.test(a.j.workflow || "") && a.j.denoise === 0.7, { ok: a.ok, note: a.j.note, wf: a.j.workflow, error: a.j.error });
  check("…the job carries Basic Settings' Override: steps 37, CFG 3.3, the checkpoint, the temporary LoRA",
    pa.steps === 37 && pa.cfg === 3.3 && sa.model === CKPT && sa.model_override === true && (sa.loras || []).some((l) => l.path === "loras/e2e685.safetensors" && l.weight === 0.6),
    { steps: pa.steps, cfg: pa.cfg, model: sa.model, loras: sa.loras });
  check("…the answer says what Override applied", a.j.override && /steps 37, CFG 3\.3, checkpoint juggernautXL_v9_e2e685\.safetensors, 1 temporary LoRA/.test(a.j.override.applied), a.j.override);
  // 2 the same, Override off: the style's own values (no steps / cfg / checkpoint from Basic Settings), its own model
  const b = await aiedit(Object.assign({ mode: "refine", style_id: ck.id, strength: 70 }, base), true);
  const jb = b.j.jobs && b.j.jobs[0] ? await get("/api/jobs/" + b.j.jobs[0].id) : {}, pb = jb.params || {}, sb = pb.style || {};
  check("Override off: the style's own model and values (nothing from Basic Settings), no override in the answer",
    b.ok && pb.steps == null && pb.cfg == null && sb.model !== CKPT && !sb.model_override && b.j.override === null, { steps: pb.steps, model: sb.model, override: b.j.override });
  // 3 an edit model + a checkpoint that does not fit it
  const c = await aiedit(Object.assign({ mode: "edit", style_id: ed.id, strength: 100, ovr: JSON.stringify(OVR) }, base), false);
  const jc = c.j.jobs && c.j.jobs[0] ? await get("/api/jobs/" + c.j.jobs[0].id) : {}, pc = jc.params || {}, sc = pc.style || {};
  check(ed.name + " (an edit model): steps / CFG / the temporary LoRA ride; the SDXL checkpoint is not forced on it - and that is SAID (override.note)",
    c.ok && pc.steps === 37 && pc.cfg === 3.3 && (sc.loras || []).some((l) => l.path === "loras/e2e685.safetensors") && sc.model !== CKPT && c.j.override && c.j.override.note && !/checkpoint/.test(c.j.override.applied),
    { steps: pc.steps, model: sc.model, override: c.j.override });
  for (const r of [a, b, c]) if (r.j.jobs && r.j.jobs[0]) await cancel(r.j.jobs[0].id);
  // 4 the preview, for real: Override on in Basic Settings, the checkpoint style in the prompt, 🎨 Change style
  if (!chromium) { console.log("SKIP: playwright is not installed here - the browser part did not run"); }
  else {
    const br = await chromium.launch(), p = await br.newPage({ viewport: { width: 1500, height: 950 } });
    const errs = []; p.on("pageerror", (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
    const ev = (f, x) => p.evaluate(f, x);
    let sent = null, made = null;
    await p.route("**/api/aiedit", async (r) => { sent = r.request().postDataBuffer().toString("latin1"); const res = await r.fetch(); made = await res.json(); await r.fulfill({ response: res, json: made }); });
    await p.route("**/api/jobs/*", async (r) => { const u = r.request().url(); if (made && made.jobs && u.includes(made.jobs[0].id)) { await new Promise((ok) => setTimeout(ok, 2500)); return r.fulfill({ json: { status: "running", progress: { step: 5, total: 37 } } }); } return r.continue(); });
    try {
      await p.goto(URL_, { waitUntil: "domcontentloaded" });
      await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3Restyle && document.getElementById("lb_restyle") && document.getElementById("styleSel").options.length > 2, null, { timeout: 40000 });
      await p.waitForTimeout(3500);   // the start-up restores (styles, ⇄) are done
      await ev(([id, ck]) => { const s = document.getElementById("styleSel"); s.value = id; s.dispatchEvent(new Event("change", { bubbles: true }));
        const o = document.getElementById("ovrStyle"); o.checked = true; o.dispatchEvent(new Event("change", { bubbles: true }));
        const set = (i, v) => { const c = document.getElementById(i); c.value = v; c.dispatchEvent(new Event("input", { bubbles: true })); c.dispatchEvent(new Event("change", { bubbles: true })); };
        set("imgSteps", "37"); set("imgCfg", "3.3"); document.getElementById("imgCkpt").value = ck; }, [ck.id, CKPT]);
      await ev((png) => lbOpen([{ url: "data:image/png;base64," + png, kind: "image", name: "e2e685_source.png" }], 0), PNG);
      await p.selectOption("#lb_rslook", "anime"); await p.click("#lb_restyle");
      await p.waitForFunction(() => /Override:/.test(document.getElementById("lb_rsmsg").textContent), null, { timeout: 15000 }).catch(() => {});
      const msg = await ev(() => document.getElementById("lb_rsmsg").textContent);
      const ovrSent = (/name="ovr"\r\n\r\n([^\r]*)/.exec(sent || "") || [])[1] || "";
      check("the preview with Override on: the request carries Basic Settings (steps 37, CFG 3.3, the checkpoint)", /"steps":37/.test(ovrSent) && /"cfg":3\.3/.test(ovrSent) && ovrSent.includes(CKPT), ovrSent);
      check("…the real route made an image-to-image job with the style's own graph", made && /style's own graph/.test(made.note || ""), made && made.note);
      await p.waitForTimeout(2800);
      const msg2 = await ev(() => document.getElementById("lb_rsmsg").textContent);
      check("…the preview's bar says what Override put on it - queued and while it renders", /Override: steps 37, CFG 3\.3, checkpoint juggernautXL_v9_e2e685\.safetensors/.test(msg) && /Override: steps 37/.test(msg2), { msg, msg2 });
      check("no page errors", errs.length === 0, errs);
      if (made && made.jobs && made.jobs[0]) await cancel(made.jobs[0].id);
      await ev(() => { const o = document.getElementById("ovrStyle"); o.checked = false; o.dispatchEvent(new Event("change", { bubbles: true })); document.getElementById("imgCkpt").value = ""; });
    } catch (e) { fail++; console.log("FAIL: the browser part stopped - " + (e.stack || e.message)); }
    await br.close();
  }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
