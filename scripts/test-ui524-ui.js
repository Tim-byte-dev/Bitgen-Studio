#!/usr/bin/env node
/* bitGen Studio — 2.524.0 in a REAL browser: 🏠 THE HOUSE BUILDER docker - a room dragged on the plan (its 4 walls), a
 * door + a window clicked onto walls, a sofa from the library, a camera (press, drag where it looks), undo / redo, moving
 * the sofa, a floor above + stairs, 💾 Save (+ the plan picture), the 3D view drawn, 📍 360° -> a real Location (its pano
 * file), 📷 shot + depth + normal -> Image assets, the panorama / shot point where the camera looks (a red box straight
 * ahead is in the middle), ⤓ .obj zip, ✨ Make it real queues a job with the shot as its picture.
 * Tim (verbatim): "i would like a floorplan/housebuilder floating docker that i can use as a location as well"
 * Against the running app (H3_URL, default :8311). Everything it makes is removed again (the house + its assets, the
 * Location, the queued job). */
"use strict";
const path = require("path"), fs = require("fs");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.524 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const SHOTS = process.env.H3_SHOTS || "";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body, method) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined && !method ? {} : { method: method || "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })).json();
const NAME = "E2E house 524", SLUG = "e2e-house-524";

(async () => {
  const envs0 = new Set(((await api("/api/environments")).environments || []).map((e) => e.name));
  await fetch(URL_ + "api/house/" + SLUG + "?assets=1", { method: "DELETE" }).catch(() => {});
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1000 }, acceptDownloads: true });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let jobId = "", envName = "";
  const shot = async (n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n) }); };
  /** the plan's screen point for a world point (metres) */
  const at = async (x, y) => ev(([x, y]) => { const S = H3House.state(), r = document.getElementById("hbPlan").getBoundingClientRect(); return [r.left + x * S.zoom + S.ox, r.top + y * S.zoom + S.oy]; }, [x, y]);
  const clickAt = async (x, y) => { const s = await at(x, y); await p.mouse.click(s[0], s[1]); await p.waitForTimeout(120); };
  const model = () => ev(() => { const m = H3House.model(); return { walls: m.walls.length, rooms: m.rooms.length, openings: m.openings.map((o) => o.kind), items: m.items.map((i) => i.type), cams: m.cameras.length, floors: m.floors.length, stairs: m.stairs.length }; });
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3House && document.getElementById("hbBody"), null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    check("🏠 House is a statusbar button", await ev(() => !!document.getElementById("hbBtn") && /House/.test(document.getElementById("hbBtn").textContent)));
    await p.click("#hbBtn"); await p.waitForTimeout(600);
    check("…it opens the 🏠 House builder floating docker", await ev(() => SecFloat.state("house").shown && /House builder/.test(SecFloat.windows.house.el.querySelector(".sft").textContent)));
    await ev((n) => { H3House.load({ name: n }); const S = H3House.state(); S.zoom = 50; S.ox = 40; S.oy = 40; H3House.setView("plan"); }, NAME);
    await p.waitForTimeout(300);

    /* ---- draw */
    await p.click('#hbBody [data-tool="room"]');
    let a0 = await at(1, 1), a1 = await at(6, 5);
    await p.mouse.move(a0[0], a0[1]); await p.mouse.down(); await p.mouse.move((a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2, { steps: 4 }); await p.mouse.move(a1[0], a1[1], { steps: 4 }); await p.mouse.up();
    await p.waitForTimeout(200);
    let m = await model();
    check("▭ Room: a dragged 5 × 4 m rectangle = 1 room + its 4 walls", m.rooms === 1 && m.walls === 4, m);
    const area = await ev(() => H3HouseGeo.area(H3House.model().rooms[0].poly));
    check("…20 m² (metres, snapped)", Math.abs(Math.abs(area) - 20) < 0.01, area);
    await p.click('#hbBody [data-tool="door"]'); await clickAt(3, 1.02);
    await p.click('#hbBody [data-tool="window"]'); await clickAt(6, 3);
    m = await model();
    check("🚪 a door + 🪟 a window clicked onto walls", m.openings.join() === "door,window", m);
    await p.click('#hbBody [data-tool="item"]'); await p.waitForTimeout(150);
    check("🛋 the furniture library shows by category", await ev(() => document.querySelectorAll("#hbProps [data-lib]").length >= 30 && /Living/i.test(document.getElementById("hbProps").textContent)));
    await p.click('#hbProps [data-lib="sofa"]'); await clickAt(3.5, 4.3);
    await p.click('#hbBody [data-tool="camera"]');
    a0 = await at(1.6, 1.6); a1 = await at(5, 4.5);
    await p.mouse.move(a0[0], a0[1]); await p.mouse.down(); await p.mouse.move(a1[0], a1[1], { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(150);
    m = await model();
    const cam = await ev(() => H3House.model().cameras[0]);
    check("📷 a camera: where it was pressed, looking where it was dragged (down-right ≈ 40°), named after its room", m.items.join() === "sofa" && m.cams === 1 && Math.abs(cam.x - 1.6) < 0.01 && cam.yaw > 30 && cam.yaw < 50 && cam.name === "Room 1", cam);
    await p.focus("#hbBody"); await p.keyboard.press("Control+z"); await p.waitForTimeout(100);
    const undone = (await model()).cams;
    await p.keyboard.press("Control+y"); await p.waitForTimeout(100);
    check("Ctrl+Z / Ctrl+Y undo / redo (the camera goes, comes back)", undone === 0 && (await model()).cams === 1, undone);
    await p.click('#hbBody [data-tool="select"]');
    a0 = await at(3.5, 4.3); a1 = await at(4.5, 4.3);
    await p.mouse.move(a0[0], a0[1]); await p.mouse.down(); await p.mouse.move(a1[0], a1[1], { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(150);
    const sofa = await ev(() => H3House.model().items[0]);
    check("⬚ Select: the sofa dragged 1 m along (and it is the selection - its properties show)", Math.abs(sofa.x - 4.5) < 0.06 && /Sofa/.test(await ev(() => document.getElementById("hbProps").textContent)), sofa);
    await p.keyboard.press("r"); await p.waitForTimeout(80);
    check("R turns it 15°", (await ev(() => H3House.model().items[0].rot)) === 15);
    await p.click("#hbAddFloor"); await p.waitForTimeout(150);
    check("＋ a floor above (its tab is the shown floor)", (await model()).floors === 2 && await ev(() => H3House.state().floor === 1));
    await p.click('#hbFloors [data-fl="0"]'); await p.click('#hbBody [data-tool="stairs"]'); await clickAt(1.8, 3.2);
    check("⇗ stairs on the ground floor (up to the floor above)", (await model()).stairs === 1);
    await shot("ui524-plan.png");

    /* ---- save + 3D */
    await p.click("#hbSave");
    await p.waitForFunction(() => /saved/.test(document.getElementById("hbMsg").textContent), null, { timeout: 15000 });
    await p.waitForTimeout(800);
    const list = await api("/api/house");
    const me = list.find((h) => h.slug === SLUG);
    check("💾 Save: the house is in the project's list (rooms, area)", me && me.rooms === 1 && me.area === 20 && me.floors === 2, list);
    const back = await api("/api/house/" + SLUG);
    check("…read back: the same model (walls, openings, the turned sofa, the camera)", back.walls.length === 4 && back.openings.length === 2 && back.items[0].rot === 15 && back.cameras[0].name === "Room 1", back);
    const plan = await fetch(URL_ + "api/house/" + SLUG + "/plan.png");
    check("…its plan picture (plan.png)", plan.ok && (await plan.arrayBuffer()).byteLength > 2000);
    await ev(() => H3House.setView("both"));
    await p.waitForFunction(() => H3House.state().three && H3House.state().three.built, null, { timeout: 30000 });
    await p.waitForTimeout(800);
    const px = await ev(() => { const c = document.getElementById("hb3d"), x = document.createElement("canvas"); x.width = 64; x.height = 64; const g = x.getContext("2d"); g.drawImage(c, 0, 0, 64, 64); const d = g.getImageData(0, 0, 64, 64).data, set = new Set(); for (let i = 0; i < d.length; i += 4) set.add((d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4)); return set.size; });
    check("🧊 the 3D view is drawn (three.js - many colours, not a blank canvas)", px > 20, px);
    await ev(() => { const S = H3House.state(); S.look = S.m.cameras[0].id; document.getElementById("hbLook").innerHTML += ""; });
    await shot("ui524-3d.png");

    /* ---- the renders point where the camera looks: a red box straight ahead */
    await ev(() => { const m = H3House.model(), c = m.cameras[0], a = c.yaw * Math.PI / 180; c.pitch = 0; m.items.push({ id: "e2ered", floor: 0, type: "box", x: c.x + Math.cos(a) * 1.4, y: c.y + Math.sin(a) * 1.4, rot: 0, w: 0.5, d: 0.5, h: 2.4, color: "#ff0000" }); });
    const aim = await ev(async () => {
      const c = H3House.model().cameras[0];
      const read = (blob, w, h) => new Promise((ok) => { const i = new Image(); i.onload = () => { const x = document.createElement("canvas"); x.width = w; x.height = h; const g = x.getContext("2d"); g.drawImage(i, 0, 0, w, h); ok(g); }; i.src = URL.createObjectURL(blob); });
      const red = (g, x, y) => { const d = g.getImageData(x, y, 1, 1).data; return d[0] > 120 && d[1] < 80 && d[2] < 80; };
      const pano = await H3House.renderPano(c, 1024), gp = await read(pano, 1024, 512);
      const s = await H3House.renderShot(c, 320, 180, ["shot", "depth"]), gs = await read(s.shot, 320, 180), gd = await read(s.depth, 320, 180);
      const dc = gd.getImageData(160, 90, 1, 1).data, de = gd.getImageData(4, 176, 1, 1).data;
      return { panoMid: red(gp, 512, 256), panoBack: red(gp, 8, 256) || red(gp, 1015, 256), panoQuarter: red(gp, 256, 256), shotMid: red(gs, 160, 90), depthGrey: dc[0] === dc[1] && dc[1] === dc[2], depthNearBright: dc[0] > 60, depthEdge: de[0] };
    });
    check("📍 the 360° panorama has what the camera looks at in its MIDDLE (the Location's yaw 0) - not behind, not to the side", aim.panoMid && !aim.panoBack && !aim.panoQuarter, aim);
    check("📷 the shot looks the same way; the depth map is grey, the near box bright", aim.shotMid && aim.depthGrey && aim.depthNearBright, aim);
    await ev(() => { const m = H3House.model(); m.items = m.items.filter((i) => i.id !== "e2ered"); });

    /* ---- as a location */
    await ev(() => { document.getElementById("hbCam").value = H3House.model().cameras[0].id; });
    await p.click("#hbShot");
    await p.waitForFunction(() => /Image assets/.test(document.getElementById("hbMsg").textContent) || /hbad/.test(document.getElementById("hbMsg").className), null, { timeout: 60000 });
    const shotMsg = await ev(() => document.getElementById("hbMsg").textContent);
    const assets = await api("/api/passets");
    const imgs = JSON.stringify(assets);
    check("📷 Shot + maps: the picture, its depth map and its normal map are Image assets", ["shot", "depth", "normal"].every((k) => imgs.includes("house-" + SLUG + "-room-1-" + k + ".png")), shotMsg);
    check("…and shown in the docker (3 thumbnails)", await ev(() => document.querySelectorAll("#hbShots img").length === 3));
    await p.click("#hbPano");
    await p.waitForFunction(() => /is ready/.test(document.getElementById("hbMsg").textContent) || /hbad/.test(document.getElementById("hbMsg").className), null, { timeout: 90000 });
    const panoMsg = await ev(() => document.getElementById("hbMsg").textContent);
    const envs = ((await api("/api/environments")).environments || []).filter((e) => !envs0.has(e.name));
    envName = (envs[0] || {}).name || "";
    check("📍 360° location: a new Location (named house + camera), with its panorama", envs.length === 1 && /e2e-house-524-room-1/.test(envName) && /is ready/.test(panoMsg), { panoMsg, envs });
    const env = envs[0] || {};
    check("…its view starts where the camera looks (yaw 0) with the camera's lens", env.yaw === 0 && Math.abs((env.fov || 0) - 70) < 0.01, env);
    await shot("ui524-location.png");

    /* ---- .obj */
    const z = Buffer.from(await (await fetch(URL_ + "api/house/" + SLUG + "/obj")).arrayBuffer());
    check("⤓ .obj: a zip with house.obj + house.mtl (+ README)", z.slice(0, 2).toString() === "PK" && z.includes("house.obj") && z.includes("house.mtl") && z.includes("README.txt"), z.length);

    /* ---- ✨ Make it real */
    const st = await api("/api/house/styles");
    check("✨ the styles that take a picture are offered (edit workflows; no inpaint / upscale)", Array.isArray(st) && await ev(() => document.getElementById("hbStyle").options.length) === st.length && !st.some((s) => /inpaint/i.test(s.name)), st.map((s) => s.name));
    if (st.length) {
      await p.click("#hbPromptGo");
      const pr = await ev(() => document.getElementById("hbPrompt").value);
      check("✍ the prompt is written from the room (its size, floor, walls, the sofa, the light)", /a room \(20 m², 5\.0 × 4\.0 m/.test(pr) && /sofa/.test(pr) && /Photorealistic/.test(pr), pr);
      await p.click("#hbReal");
      await p.waitForFunction(() => /queued|✨ /.test(document.getElementById("hbMsg").textContent) && !/queueing/.test(document.getElementById("hbMsg").textContent), null, { timeout: 30000 });
      const rm = await ev(() => document.getElementById("hbMsg").textContent);
      jobId = (rm.match(/job ([^)\s]+)/) || [])[1] || "";
      const job = jobId ? await api("/api/jobs/" + jobId) : {};
      check("✨ Make it real: a job is queued with the camera's shot as its picture", /queued/.test(rm) && !!jobId && JSON.stringify(job).includes("house-" + SLUG + "-room-1-shot.png"), { rm, job: JSON.stringify(job).slice(0, 400) });
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run finished", false, String(e && e.stack || e)); }
  finally {
    try { await b.close(); } catch { /* fine */ }
    if (jobId) { await api("/api/jobs/" + jobId + "/cancel", {}).catch(() => {}); await fetch(URL_ + "api/jobs/history/" + jobId, { method: "DELETE" }).catch(() => {}); }
    if (envName) await fetch(URL_ + "api/environments/" + encodeURIComponent(envName), { method: "DELETE" }).catch(() => {});
    await fetch(URL_ + "api/house/" + SLUG + "?assets=1", { method: "DELETE" }).catch(() => {});
    const left = await api("/api/passets").catch(() => ({}));
    check("cleaned up: the house's assets are gone with ?assets=1", !JSON.stringify(left).includes("house-" + SLUG));
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
