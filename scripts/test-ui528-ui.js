#!/usr/bin/env node
/* bitGen Studio — 2.528.0 in a REAL browser: 🧍 CHARACTERS IN HOUSE SHOTS - the 🧍 Person tool (press where they stand,
 * drag the way they face), the character + pose in the properties, a mannequin in the 3D shot (the shot differs with and
 * without them), ✍ the prompt names "the person in picture 2 (name, age, notes)", their pose and where they are, and
 * ✨ Make it real queues the shot + the character's picture together.
 * Against the running app (H3_URL, default :8311). It makes a character, a house, a shot and a queued job, and removes
 * them all again. */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.528 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.H3_SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body, method) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined && !method ? {} : { method: method || "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })).json();
const NAME = "E2E house 528", SLUG = "e2e-house-528", CHAR = "E2E Mira 528";

(async () => {
  // a character with a picture
  await fetch(URL_ + "api/characters/" + encodeURIComponent(CHAR), { method: "DELETE" }).catch(() => {});
  await fetch(URL_ + "api/house/" + SLUG + "?assets=1", { method: "DELETE" }).catch(() => {});
  const made = await api("/api/characters", { name: CHAR, age: "29", notes: "red coat" });
  const fd = new FormData();
  fd.append("file", new Blob([require("../lib/styleDoctor.js").makePng(256, 256)], { type: "image/png" }), "mira.png");
  await fetch(URL_ + "api/characters/" + encodeURIComponent(CHAR) + "/asset", { method: "POST", body: fd });
  const charId = made.character && made.character.id;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let jobId = "";
  const at = async (x, y) => ev(([x, y]) => { const S = H3House.state(), r = document.getElementById("hbPlan").getBoundingClientRect(); return [r.left + x * S.zoom + S.ox, r.top + y * S.zoom + S.oy]; }, [x, y]);
  const drag = async (a0, a1) => { const s0 = await at(...a0), s1 = await at(...a1); await p.mouse.move(s0[0], s0[1]); await p.mouse.down(); await p.mouse.move(s1[0], s1[1], { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(200); };
  try {
    check("the character was made with a picture", !!charId && ((await api("/api/characters")).characters || []).some((c) => c.id === charId && (c.images || []).length), made);
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3House && document.getElementById("hbBody"), null, { timeout: 60000 });
    await p.waitForTimeout(800);
    await p.click("#hbBtn");
    await p.waitForFunction((id) => (H3House.state().chars || []).some((c) => c.id === id), charId, { timeout: 20000 }).catch(() => {});
    await ev((n) => { const m = H3HouseGeo.normalize({ name: n }); H3HouseGeo.addRoom(m, 0, [[0, 0], [6, 0], [6, 5], [0, 5]], "Lounge"); H3House.load(m); const S = H3House.state(); S.zoom = 60; S.ox = 60; S.oy = 60; H3House.setView("plan"); }, NAME);
    await p.waitForTimeout(300);
    check("🧍 Person is a House tool", await ev(() => !!document.querySelector('#hbBody [data-tool="person"]')));
    await p.click('#hbBody [data-tool="person"]');
    await drag([3.5, 2.5], [5.5, 2.5]);
    let q = await ev(() => H3House.model().people[0]);
    check("🧍 press + drag: a person where pressed, facing where dragged (east = 0°), standing", q && Math.abs(q.x - 3.5) < 0.01 && Math.abs(q.y - 2.5) < 0.01 && (q.rot < 10 || q.rot > 350) && q.pose === "stand", q);
    const opts = await ev(() => [...document.querySelectorAll('#hbProps [data-k="char"] option')].map((o) => o.value));
    check("…its properties list the project's characters", opts.includes(charId), opts);
    await p.selectOption('#hbProps [data-k="char"]', charId); await p.waitForTimeout(200);
    await p.selectOption('#hbProps [data-k="pose"]', "sit"); await p.waitForTimeout(200);
    q = await ev(() => H3House.model().people[0]);
    check("…the character and the pose are set", q.char === charId && q.pose === "sit", q);
    // a camera looking at them from the west wall
    await p.click('#hbBody [data-tool="camera"]');
    await drag([0.8, 2.5], [4, 2.5]);
    const cam = await ev(() => H3House.model().cameras[0]);
    check("a camera facing them", cam && Math.abs(cam.yaw) < 5, cam);
    // the mannequin is in the shot: the same shot with and without them differs where they sit
    const diff = await ev(async () => {
      const read = (blob) => new Promise((ok) => { const i = new Image(); i.onload = () => { const x = document.createElement("canvas"); x.width = 160; x.height = 90; const g = x.getContext("2d"); g.drawImage(i, 0, 0, 160, 90); ok(g.getImageData(0, 0, 160, 90).data); }; i.src = URL.createObjectURL(blob); });
      const m = H3House.model(), c = m.cameras[0];
      const withP = await read((await H3House.renderShot(c, 320, 180, ["shot"])).shot);
      const keep = m.people; m.people = [];
      const without = await read((await H3House.renderShot(c, 320, 180, ["shot"])).shot);
      m.people = keep;
      let n = 0; for (let i = 0; i < withP.length; i += 4) if (Math.abs(withP[i] - without[i]) + Math.abs(withP[i + 1] - without[i + 1]) + Math.abs(withP[i + 2] - without[i + 2]) > 30) n++;
      return n;
    });
    check("the mannequin is in the camera's shot (the picture differs with and without them)", diff > 150, diff);
    await p.click("#hbSave");
    await p.waitForFunction(() => /saved/.test(document.getElementById("hbMsg").textContent), null, { timeout: 15000 });
    await ev(() => { document.getElementById("hbCam").value = H3House.model().cameras[0].id; });
    await p.click("#hbPromptGo");
    const pr = await ev(() => document.getElementById("hbPrompt").value);
    check("✍ the prompt: replace the grey mannequin with the person in picture 2 (name, age, notes), sitting, where they are", /Replace the grey mannequin with a real person/.test(pr) && /the person in picture 2 \(E2E Mira 528, 29, red coat\), sitting/.test(pr) && /in the middle in the foreground|in the middle in the middle distance/.test(pr), pr);
    // ✨ with a style that takes 2+ pictures
    const st = (await api("/api/house/styles")).find((s) => s.slots >= 2);
    if (!st) check("(no style here takes 2 pictures - skipped the queue check)", true);
    else {
      await ev(() => { const q = H3House.model().people[0]; q.lora = "e2e/mira528.safetensors"; q.lw = 0.7; });
      await p.selectOption("#hbStyle", st.id);
      await p.click("#hbReal");
      await p.waitForFunction(() => /queued \(job|✨ /.test(document.getElementById("hbMsg").textContent) && !/queueing|rendering/.test(document.getElementById("hbMsg").textContent), null, { timeout: 60000 });
      const msg = await ev(() => document.getElementById("hbMsg").textContent);
      jobId = (msg.match(/job ([^)\s]+)/) || [])[1] || "";
      const job = jobId ? await api("/api/jobs/" + jobId) : {};
      const imgs = ((job.params || {}).images || []).map((f) => path.basename(f));
      const lor = (((job.params || {}).style || {}).loras || []).find((l) => /mira528/.test(JSON.stringify(l)));
      check("…and their LoRA rides along at its weight", !!lor && Math.abs((lor.weight != null ? lor.weight : lor.strength) - 0.7) < 1e-6, ((job.params || {}).style || {}).loras);
      check("✨ Make it real: the shot AND the character's picture go together (" + st.name + ")", imgs.length === 2 && /^house-e2e-house-528-.*-shot\.png$/.test(imgs[0]) && imgs[1] === "house-e2e-house-528-char-e2e_mira_528.png" && /2 pictures/.test(msg), { msg, imgs });
    }
    if (SHOTS) { await ev(() => H3House.setView("both")); await p.waitForTimeout(2500); await p.screenshot({ path: path.join(SHOTS, "ui528-people.png") }); }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run finished", false, String(e && e.stack || e)); }
  finally {
    try { await b.close(); } catch { /* fine */ }
    if (jobId) { await api("/api/jobs/" + jobId + "/cancel", {}).catch(() => {}); await fetch(URL_ + "api/jobs/history/" + jobId, { method: "DELETE" }).catch(() => {}); }
    await fetch(URL_ + "api/house/" + SLUG + "?assets=1", { method: "DELETE" }).catch(() => {});
    await fetch(URL_ + "api/characters/" + encodeURIComponent(CHAR), { method: "DELETE" }).catch(() => {});
    const left = JSON.stringify(await api("/api/passets").catch(() => ({})));
    check("cleaned up: no house-e2e-house-528 picture left in the Image assets", !left.includes("house-e2e-house-528"));
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
