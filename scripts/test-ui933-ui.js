#!/usr/bin/env node
/* bitGen Studio — 2.933.0 in a REAL browser: 🧍 Drape on the mannequin in the Garment designer (static/garment.js).
 * A T-shirt made (GarmentCode on the server: GARMENT_PY / GARMENT_SRC), 🧍 Drape (jersey, blue): the progress said, then the
 * front / side / back views, the quality line; → References puts the three views in the References docker (addRefImageByUrl);
 * 🧊 hands garment-<slug>.glb to the image editor (H3To3D.deliver, "editor"); ⤓ OBJ is the draped garment. Opening the garment
 * again shows its drape. Without Blender on the server: the drape's refusal said. Against the running app (H3_URL). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
const URL_ = (process.env.H3_URL || "http://127.0.0.1:8311/").replace(/\/$/, "");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const getj = async (p) => (await fetch(URL_ + p)).json();
(async () => {
  try { const r = await fetch(URL_ + "/"); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL_); process.exit(0); }
  if (!chromium) { console.log("SKIP: playwright is not installed here"); return; }
  const st = await getj("/api/garment");
  if (!st.installed) { console.log("SKIP: the server has no GarmentCode (GARMENT_PY / GARMENT_SRC) - nothing to drape"); return; }
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const note = () => ev(() => document.getElementById("gmDrapeNote").textContent);
  let slug = "";
  try {
    await p.goto(URL_ + "/", { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.H3Garment, null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await ev(() => window.H3Garment.open({ sex: "female", from: "test" }));
    await p.waitForFunction(() => document.querySelectorAll("[data-gmpreset]").length, null, { timeout: 20000 });
    check("🧍 Drape is greyed until there is a pattern", await ev(() => document.getElementById("gmDrape").disabled));
    await ev(() => { document.getElementById("gmName").value = "UI933 tee"; document.getElementById("gmName").dataset.auto = "0"; });
    await p.click('[data-gmpreset="tshirt"]');
    await p.waitForFunction(() => { const c = window.H3Garment.state().cur; return c && c.slug === "ui933-tee"; }, null, { timeout: 60000 });
    slug = "ui933-tee";
    check("…a pattern made -> 🧍 Drape on the mannequin can be pressed; fabric + colour beside it", await ev(() => !document.getElementById("gmDrape").disabled && document.getElementById("gmFabric").options.length === 4 && document.getElementById("gmColor").type === "color"));
    await ev(() => { document.getElementById("gmFabric").value = "jersey"; document.getElementById("gmColor").value = "#2b6cd6"; document.getElementById("gmDrape").click(); });
    await p.waitForTimeout(1500);
    const first = await note();
    if (/Blender is not installed/.test(first)) {
      check("no Blender on the server: the refusal is said under the button, Drape can be pressed again", await ev(() => !document.getElementById("gmDrape").disabled) && document, first);
      console.log("NOTE: the server has no Blender - the drape legs were not run");
    } else {
      const notes = new Set([first]);
      for (let i = 0; i < 400; i++) {
        const t = await note(); notes.add(t);
        if (/^[✓⚠✗]/.test(t)) break;
        await p.waitForTimeout(1000);
      }
      const end = await note();
      check("the progress was said while Blender worked (sewing / settling / rendering, %), then ✓ with the quality", [...notes].some((t) => /⏳ .*%/.test(t)) && /^✓ draped - seams closed/.test(end), [...notes].slice(-6));
      const views = await ev(() => Promise.all([...document.querySelectorAll("#gmViews img")].map((im) => new Promise((ok) => { const f = () => ok({ v: im.dataset.view, w: im.naturalWidth }); if (im.complete) f(); else { im.onload = f; im.onerror = f; } }))));
      check("…the front, side and back views shown (they load)", views.map((v) => v.v).join() === "front,side,back" && views.every((v) => v.w > 100), views);
      const cur = await ev(() => window.H3Garment.state().cur.drape);
      check("…the garment carries its drape: jersey, the model garment-ui933-tee.glb, the views in Images", cur && cur.fabric === "jersey" && cur.model === "garment-ui933-tee.glb" && cur.images.front === "garment-ui933-tee-front.png", cur);
      // → References
      const refs = await ev(() => { const got = []; const orig = window.addRefImageByUrl; window.addRefImageByUrl = function (u, n) { got.push(n); try { return orig.apply(this, arguments); } catch (e) { return null; } }; document.getElementById("gmToRefs").click(); window.addRefImageByUrl = orig; return got; });
      check("→ References: the three views go to the References docker", refs.join() === "garment-ui933-tee-front.png,garment-ui933-tee-side.png,garment-ui933-tee-back.png" && /3 views/.test(await note()), refs);
      // ⤓ OBJ
      const href = await ev(() => document.getElementById("gmObj").getAttribute("href"));
      const obj = await (await fetch(URL_ + href)).text();
      check("⤓ OBJ is the draped garment (vertices + faces)", /drape-garment\.obj$/.test(href) && /\nv /.test(obj) && /\nf /.test(obj), href);
      // 🧊 3D layer
      const sent = await ev(() => new Promise((ok) => { const orig = window.H3To3D && window.H3To3D.deliver; window.H3To3D = window.H3To3D || {}; window.H3To3D.deliver = function (m, d) { window.H3To3D.deliver = orig; ok({ m, d, closed: !document.getElementById("gmDlg").open }); return Promise.resolve({}); }; document.getElementById("gmTo3d").click(); setTimeout(() => ok(null), 3000); }));
      check("🧊 hands garment-ui933-tee.glb to the image editor as a 3D layer (the dialog closes)", sent && sent.m === "garment-ui933-tee.glb" && sent.d === "editor" && sent.closed, sent);
      // opened again
      await ev(() => window.H3Garment.open({ from: "test" }));
      await p.waitForTimeout(800);
      await ev(() => document.querySelector('#gmList .gmitem[data-slug="ui933-tee"]').click());
      await p.waitForTimeout(800);
      check("opening the garment again shows its drape (views + the quality line)", await ev(() => !document.getElementById("gmDrapeBox").hidden && document.querySelectorAll("#gmViews img").length === 3) && /✓/.test(await note()));
    }
    check("no page errors", !errs.length, errs);
  } finally {
    await b.close();
    if (slug) { try { await fetch(URL_ + "/api/garment/" + slug, { method: "DELETE" }); } catch { /* gone */ } }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack || e)); process.exit(1); });
