#!/usr/bin/env node
/* bitGen Studio — 2.529.0 in a REAL browser: HOUSE BUILDER EXTRAS - ⌂ a hip roof from the House panel (in an outside
 * camera's shot), 🖼 a plan picture loaded under the plan + 📐 its scale set with two clicks and a typed distance, 🪄
 * Furnish this room (pieces inside the room, Ctrl+Z takes them out), ⤓ .glb read back by three.js's own GLTFLoader,
 * 🎬 Every camera -> StoryBoard scenes with the shots as first frames + the list as .md.
 * Against the running app (H3_URL, default :8311). The house, its pictures and the StoryBoard scenes it adds are removed. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.529 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.H3_SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body, method) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined && !method ? {} : { method: method || "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })).json();
const NAME = "E2E house 529", SLUG = "e2e-house-529";

(async () => {
  await fetch(URL_ + "api/house/" + SLUG + "?assets=1", { method: "DELETE" }).catch(() => {});
  const sc0 = await api("/api/scenes"), scenes0 = (sc0.list || []).length;
  // the StoryBoard's shared prompt can carry @tags of characters other tests left behind ("would render as a stranger"):
  // a plain one for this run, the old one back after
  const prefix0 = sc0.plan && Array.isArray(sc0.plan.prompt_prefix) ? sc0.plan.prompt_prefix.join("\n") : null;
  const pre = await api("/api/scenes/prefix", { text: "subject_definitions:" });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 }, acceptDownloads: true });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let added = [];
  const at = async (x, y) => ev(([x, y]) => { const S = H3House.state(), r = document.getElementById("hbPlan").getBoundingClientRect(); return [r.left + x * S.zoom + S.ox, r.top + y * S.zoom + S.oy]; }, [x, y]);
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3House && document.getElementById("hbBody"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await p.click("#hbBtn"); await p.waitForTimeout(800);
    await ev((n) => { const m = H3HouseGeo.example(); m.name = n; m.items = m.items.filter((i) => !H3HouseGeo.inside([i.x, i.y], m.rooms.find((r) => r.name === "Bedroom").poly));
      m.cameras.push({ id: "cst", floor: 0, name: "Street", x: -6, y: 9.5, z: 1.7, yaw: -40, pitch: 8, fov: 60 }); H3House.load(m); const S = H3House.state(); S.sel = null; S.zoom = 50; S.ox = 60; S.oy = 60; H3House.setView("plan"); }, NAME);
    await ev(() => H3House.save());
    await p.click('#hbBody [data-tool="select"]'); await p.keyboard.press("Escape");
    await p.waitForSelector('#hbProps [data-roof="kind"]');

    /* ---- ⌂ the roof */
    await p.selectOption('#hbProps [data-roof="kind"]', "hip"); await p.waitForTimeout(300);
    const roof = await ev(() => H3House.model().roof);
    check("⌂ the House panel: Hip roof (its pitch / overhang / material fields appear; 'roof' ticked in the 3D view)", roof.kind === "hip" && await ev(() => !!document.querySelector('#hbProps [data-roof="pitch"]') && document.getElementById("hbRoofShow").checked), roof);
    const sky = await ev(async () => {
      const read = (blob) => new Promise((ok) => { const i = new Image(); i.onload = () => { const x = document.createElement("canvas"); x.width = 80; x.height = 45; const g = x.getContext("2d"); g.drawImage(i, 0, 0, 80, 45); ok(g.getImageData(0, 0, 80, 45).data); }; i.src = URL.createObjectURL(blob); });
      const m = H3House.model(), c = m.cameras.find((x) => x.id === "cst");
      const a = await read((await H3House.renderShot(c, 320, 180, ["shot"])).shot);
      const keep = m.roof.kind; m.roof.kind = "none";
      const bb = await read((await H3House.renderShot(c, 320, 180, ["shot"])).shot);
      m.roof.kind = keep;
      let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - bb[i]) + Math.abs(a[i + 1] - bb[i + 1]) + Math.abs(a[i + 2] - bb[i + 2]) > 40) n++;
      return n;
    });
    check("…an outside camera's shot shows the roof (the shot differs with and without it)", sky > 80, sky);
    if (SHOTS) { const sh = await ev(async () => { const m = H3House.model(); const r = await H3House.renderShot(m.cameras.find((x) => x.id === "cst"), 800, 450, ["shot"]); return await new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result.split(",")[1]); f.readAsDataURL(r.shot); }); }); require("fs").writeFileSync(path.join(SHOTS, "ui529-roof.png"), Buffer.from(sh, "base64")); }

    /* ---- 🖼 the plan picture */
    const png = require("../lib/styleDoctor.js").makePng(400, 300);
    await p.setInputFiles("#hbTrFile", { name: "plan.png", mimeType: "image/png", buffer: png });
    await p.waitForFunction(() => H3House.model().trace && H3House.state().traceImg && H3House.state().traceImg.complete, null, { timeout: 15000 });
    const tr = await ev(() => H3House.model().trace);
    check("🖼 a plan picture loads under the plan (saved with the house, 2 cm a pixel to start)", tr.file === "trace.png" && Math.abs(tr.mpp - 0.02) < 1e-9 && (await fetch(URL_ + "api/house/" + SLUG + "/trace")).ok, tr);
    await p.click("#hbTrScale");
    const p1 = [tr.x + 1, tr.y + 1], p2 = [tr.x + 3, tr.y + 1];      // 2 m apart now (100 px)
    let s1 = await at(...p1); await p.mouse.click(s1[0], s1[1]); await p.waitForTimeout(150);
    s1 = await at(...p2); await p.mouse.click(s1[0], s1[1]);
    await p.waitForSelector("#askdlg[open]", { timeout: 5000 });
    await p.fill("#ask_input", "5"); await p.click("#ask_ok"); await p.waitForTimeout(400);
    const tr2 = await ev(() => H3House.model().trace);
    check("📐 two clicks + '5' metres: the picture is scaled ×2.5 about the first point (5 cm a pixel)", Math.abs(tr2.mpp - 0.05) < 1e-6 && Math.abs(tr2.x - (p1[0] - (p1[0] - tr.x) * 2.5)) < 0.06, { tr, tr2 });

    /* ---- 🪄 furnish */
    const room = await ev(() => H3House.model().rooms.find((r) => r.name === "Bedroom"));
    const n0 = await ev(() => H3House.model().items.length);
    const fr = await ev(async (id) => { const S = H3House.state(); return await H3House.furnish(S.m.rooms.find((r) => r.id === id), ""); }, room.id);
    const items = await ev((id) => { const m = H3House.model(), r = m.rooms.find((x) => x.id === id); return m.items.filter((i) => H3HouseGeo.inside([i.x, i.y], r.poly)).map((i) => i.type); }, room.id);
    check("🪄 Furnish this room: a bedroom's pieces in the bedroom", fr && fr.items && fr.items.length >= 4 && items.some((t) => /^bed_/.test(t)) && items.includes("wardrobe"), { fr, items });
    check("…the message says what came in and how", /🪄 \d+ pieces \((the LLM picked them|a bedroom's set)\)/.test(await ev(() => document.getElementById("hbMsg").textContent)));
    await p.focus("#hbBody"); await p.keyboard.press("Control+z"); await p.waitForTimeout(200);
    check("…Ctrl+Z takes them out", (await ev(() => H3House.model().items.length)) === n0);
    await p.keyboard.press("Control+y"); await p.waitForTimeout(200);

    /* ---- ⤓ .glb */
    const glb = await ev(async (slug) => { await H3House.save(); const buf = await (await fetch("/api/house/" + slug + "/glb")).arrayBuffer(); const T = window.H3THREE || (window.H3M3D && await H3M3D.load());
      const g = await new Promise((ok, no) => new T.GLTFLoader().parse(buf, "", ok, no)); let n = 0, glass = 0; g.scene.traverse((o) => { if (o.isMesh) { n++; if (o.material && o.material.transparent) glass++; } }); return { n, glass, bytes: buf.byteLength }; }, SLUG);
    check("⤓ .glb: three.js's own GLTFLoader reads it - every mesh group, the glass see-through", glb.n > 15 && glb.glass >= 1, glb);
    check("…the ⤓ .glb link is in the location panel", await ev(() => !!document.getElementById("hbGlb")));

    /* ---- 🎬 every camera -> the StoryBoard */
    const list = await ev(() => H3House.shotList(true));
    const scenes = (await api("/api/scenes")).list || [];
    added = list && list.rows ? list.rows.map((r) => r.scene).filter((n) => n != null) : [];
    check("🎬 Every camera: a shot each (in the Image assets) and a StoryBoard scene each", list && list.rows.length === 2 && added.length === 2 && scenes.length === scenes0 + 2, { rows: list && list.rows, n: scenes.length, scenes0 });
    const sc = scenes.filter((s) => added.includes(s.n));
    check("…each scene's first frame is its camera's shot, its prompt the room", sc.length === 2 && sc.every((s) => s.fl_first && /house-e2e-house-529-/.test(JSON.stringify(s.fl_first))) && sc.some((s) => /Interior, living room/.test(JSON.stringify(s))), sc.map((s) => ({ n: s.n, fl: s.fl_first, p: JSON.stringify(s).slice(0, 200) })));
    check("…and the list as .md (camera, room, lens, who, the shot, the scene)", /# Shot list - E2E house 529/.test(list.md) && /\| 1 \| Living room \| Living room \| 70° \|/.test(list.md) && await ev(() => document.getElementById("hbListMd").style.display !== "none"), list && list.md);
    if (SHOTS) { await ev(() => H3House.setView("both")); await p.waitForTimeout(2500); await p.screenshot({ path: path.join(SHOTS, "ui529.png") }); }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run finished", false, String(e && e.stack || e)); }
  finally {
    try { await b.close(); } catch { /* fine */ }
    if (added.length) await api("/api/scenes/delete", { scenes: added }).catch(() => {});
    if (prefix0 !== null && !pre.error) await api("/api/scenes/prefix", { text: prefix0 }).catch(() => {});
    await fetch(URL_ + "api/house/" + SLUG + "?assets=1", { method: "DELETE" }).catch(() => {});
    const left = ((await api("/api/scenes")).list || []).length;
    check("cleaned up: the StoryBoard is as it was, the house's pictures gone", left === scenes0 && !JSON.stringify(await api("/api/passets")).includes("house-e2e-house-529"), { left, scenes0 });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
