#!/usr/bin/env node
/* bitGen Studio — 2.568.0 in a REAL browser: the StoryBoard's pictures written by the LLM from their scenes, with the
 * character sheet and the scene before's last frame as references; changing a picture; the whole card is the picture.
 * Tim: "in the scene editor send the scene created by the llm back to the llm to create an image for the scene thumbnail -
 * reference image will be character and last frame of previous video if the previous video doesn't exist it will be of the
 * character + scene description - this image can be changed - make the entire card the thumnail because we get the scene
 * frame when we click the thumbnail anyway".
 * Against the running e2e app (H3_URL, default :8311; its "E2E Look" image style) + a stand-in llama-server. No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const { execSync, spawnSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the storyboard picture browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const BASE = URL_.replace(/\/$/, "");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, b) => { const r = await fetch(BASE + u, b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined); return r.json(); };

(async () => {
  const PRJ = "zz-sb568";
  let before = null;
  try { before = (await api("/api/projects/current")).name || null; } catch { before = null; }
  await api("/api/projects/new", { name: PRJ }); await api("/api/projects/load", { name: PRJ });
  await api("/api/characters", { name: "Mara" });
  { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(path.join(ROOT, "scripts", "fixtures", "sample-person.png"))], { type: "image/png" }), "mara_sheet.png");
    await fetch(BASE + "/api/characters/Mara/asset", { method: "POST", body: fd }); }
  await api("/api/scenes/add", { text: "Mara walks through the neon market at night, rain on the stalls" });
  await api("/api/scenes/add", { text: "Mara climbs the fire escape to the rooftop" });
  const all = (await api("/api/styles")).styles || [];
  const st = all.find((s) => /^E2E Look$/.test(s.name) && s.engine === "sdcli") || all.find((s) => /^E2E Look$/.test(s.name)) || null;   // (the stub sd-cli one makes a picture without ComfyUI)
  // the stand-in llama-server: the picture's prompt, dressed like a real model's answer
  const asked = [];
  const llm = http.createServer((req, res) => { let b = ""; req.on("data", (d) => { b += d; }); req.on("end", () => {
    let j = {}; try { j = JSON.parse(b); } catch (e) { j = {}; }
    const m = j.messages || []; asked.push(m);
    const sys = (m[0] || {}).content || "", user = (m[1] || {}).content || "";
    const n = /This scene:\n.*fire escape/.test(user) ? 2 : 1;
    const text = /OPENING FRAME/.test(sys) ? `<think>which pictures…</think>\nPrompt: "**Mara** from Picture ${n === 2 ? 2 : 1} ${n === 2 ? "climbs the wet fire escape of Picture 1" : "walks through the rainy neon market"}, wide shot, blue neon light."` : "ok";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }] })); }); });
  await new Promise((r) => llm.listen(0, "127.0.0.1", r));
  const llm0 = ((await api("/api/config")) || {}).llm || {};
  await api("/api/config", { llm: { external_url: `http://127.0.0.1:${llm.address().port}/v1/chat/completions`, external_model: "stub" } });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1800, height: 1100 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const gen = []; p.on("request", (q) => { if (/\/api\/genimage$/.test(q.url()) && q.method() === "POST") { try { gen.push(JSON.parse(q.postData() || "{}")); } catch (e) { /* fine */ } } });
  const ev = (f, a) => p.evaluate(f, a);
  const item = async (n) => (((await api("/api/storyboard")).items || []).find((x) => x.n === n)) || null;
  const waitPic = (n, at) => p.waitForFunction(([n, at]) => { const t = (window.H3Story.items() || []).find((x) => x.n === n); return !!t && String(t.at) !== String(at || "") && !window.H3Story.busy(n); }, [n, at || ""], { timeout: 120000 }).catch(() => {});
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3SbGrid && window.H3Story && window.H3Story.refresh && window.bgScenes && window.bgScenes.pickPicture, null, { timeout: 60000 });
    await ev(() => { window.ensureComfyReady = async () => true;          // (the e2e server's image jobs are its stand-in - no ComfyUI to start)
      try { localStorage.removeItem("sb.view"); localStorage.removeItem("sb.opts"); } catch (e) { /* fine */ } window.H3SbGrid.setView("grid");
      const d = document.getElementById("videodock"); if (d.classList.contains("dockgone")) toggleDockGone("videodock", "tV"); if (d.classList.contains("collapsed")) toggleCollapse("videodock");
      const s = document.getElementById("scPick"); if (s && s.value) { s.value = ""; s.dispatchEvent(new Event("change")); } });
    await p.waitForFunction(() => document.querySelectorAll("#sbGrid .sbgcard").length >= 2 && document.getElementById("sbLlm"), null, { timeout: 20000 });
    const bar = await ev(() => ({ llm: document.getElementById("sbLlm").checked, prev: document.getElementById("sbPrev").checked }));
    check("the StoryBoard bar: ☑ LLM writes it and ☑ Previous last frame, both on", bar.llm && bar.prev, bar);
    check("an image model to make the pictures with (the e2e's \"E2E Look\")", !!st);
    if (!st) throw new Error("no E2E Look style");
    // (the bar lists the image styles once the page has them - wait for this one, then pick it)
    await p.waitForFunction((id) => { const s = document.getElementById("sbStyle"); s.dispatchEvent(new Event("focus")); return [...s.options].some((o) => o.value === id); }, st.id, { timeout: 30000 }).catch(() => {});
    const picked = await ev((id) => { const s = document.getElementById("sbStyle"); s.value = id; s.dispatchEvent(new Event("change")); const a = document.getElementById("sbAuto"); if (!a.checked) a.click(); return s.value; }, st.id);
    check("...picked on the StoryBoard bar", picked === st.id, { picked, want: st.id });

    /* 1 scene 1 - no take before it: the character + the scene's words */
    await p.hover('#sbGrid .sbgcard[data-sbg="1"]'); await p.click('#sbGrid [data-sbgmake="1"]');
    await waitPic(1); await p.waitForTimeout(800);
    const note = await ev(() => { const d = document.getElementById("notedlg"); return d && d.open ? d.textContent.replace(/\s+/g, " ").slice(0, 300) : ""; });
    if (note) console.log("NOTE (a message box is open): " + note + " | " + await ev(() => (document.getElementById("sbMsg") || {}).textContent || ""));
    const i1 = await item(1), q1 = asked.find((m) => /OPENING FRAME/.test((m[0] || {}).content || "") && /walks through the neon market/.test((m[1] || {}).content || ""));
    const g1 = gen.find((x) => /neon market/.test(x.prompt || ""));
    const short = (m) => m && String(m[1].content).replace(/Global prompt of the film:[\s\S]*?\n\n/, "");
    check("🖼 scene 1: the LLM got the scene back (no frame before it: the place from its words, Mara's sheet as Picture 1) and wrote the picture's prompt - the picture was made from it, with the sheet",
      !!q1 && /no frame of a previous scene/.test(q1[0].content) && /Picture 1 = Mara's character sheet/.test(q1[1].content) && !!g1 && g1.prompt === "Mara from Picture 1 walks through the rainy neon market, wide shot, blue neon light."
      && (g1.images || []).length >= 1 && !(g1.images || []).some((x) => /^sb_prev_/.test(x)) && !!i1 && i1.prompt === g1.prompt, { q1: short(q1), g1, i1 });

    /* 2 scene 1 has a take now: scene 2 starts from its last frame */
    const vdir = path.join(ROOT, "projects", PRJ, "video"); fs.mkdirSync(vdir, { recursive: true });
    const mp4 = path.join(vdir, "zz568_s1.mp4");
    spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=red:s=320x180:d=1", "-pix_fmt", "yuv420p", mp4]);
    const pf = path.join(ROOT, "projects", PRJ, PRJ + ".prj"), pj = JSON.parse(fs.readFileSync(pf, "utf8"));
    const s1 = pj.scenes.list.find((x) => x.n === 1); s1.status = "rendered"; s1.output = "zz568_s1.mp4"; fs.writeFileSync(pf, JSON.stringify(pj, null, 1));
    await ev(() => window.bgScenes.refresh()); await p.waitForTimeout(600);
    await p.hover('#sbGrid .sbgcard[data-sbg="2"]'); await p.click('#sbGrid [data-sbgmake="2"]');
    await waitPic(2); await p.waitForTimeout(800);
    const q2 = asked.find((m) => /OPENING FRAME/.test((m[0] || {}).content || "") && /fire escape/.test((m[1] || {}).content || ""));
    const g2 = gen.find((x) => /fire escape/.test(x.prompt || "")), i2 = await item(2);
    const prevPng = fs.readdirSync(path.join(ROOT, "projects", PRJ, "images")).find((f) => /^sb_prev_/.test(f));
    const red = prevPng ? spawnSync("ffmpeg", ["-v", "error", "-i", path.join(ROOT, "projects", PRJ, "images", prevPng), "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]).stdout : null;
    check("🖼 scene 2: scene 1's LAST FRAME (its take) rides first + Mara's sheet; the LLM was told it continues from it, with the scene before's words",
      !!q2 && /continues from that moment/.test(q2[0].content) && /Picture 1 = scene 1's last frame/.test(q2[1].content) && /Picture 2 = Mara's character sheet/.test(q2[1].content) && /The scene before:\nMara walks/.test(q2[1].content)
      && !!g2 && /^sb_prev_/.test((g2.images || [])[0] || "") && (g2.images || []).length >= 2 && !!red && red[0] > 200 && red[1] < 60 && !!i2 && /Picture 1/.test(i2.prompt), { q2: short(q2), g2, prevPng, red: red && [...red] });

    /* 3 the whole card is the picture */
    const card = await ev(() => { const c = document.querySelector('#sbGrid .sbgcard[data-sbg="2"]'), th = c.querySelector(".th"), a = c.getBoundingClientRect(), t = th.getBoundingClientRect(), cap = c.querySelector(".cap").getBoundingClientRect();
      return { pic: c.dataset.pic, full: Math.abs(a.width - t.width) < 3 && Math.abs(a.height - t.height) < 3, ratio: Math.round(a.width / a.height * 100) / 100, bg: th.style.backgroundImage, capIn: cap.bottom <= a.bottom + 1 && cap.top > a.top, tip: c.title }; });
    check("the card IS the picture: it fills the 16:9 card, the name + text over its bottom, the tooltip = the scene's words + the picture's prompt",
      card.pic === "1" && card.full && card.ratio > 1.7 && card.ratio < 1.8 && /storyboard\/2\/thumb/.test(card.bg) && card.capIn && /🖼 the picture: Mara from Picture 2/.test(card.tip), card);

    if (process.env.SHOTS) { await p.hover('#sbGrid .sbgcard[data-sbg="2"]'); await p.locator("#sbGrid").screenshot({ path: path.join(process.env.SHOTS, "568-grid.png") }); }
    /* 4 change it: 📁 -> the picker -> a project picture */
    const at2 = i2 && i2.at;
    await p.hover('#sbGrid .sbgcard[data-sbg="2"]'); await p.click('#sbGrid [data-sbgpick="2"]');
    await p.waitForSelector("#scFlPick", { timeout: 10000 });
    await p.click('#scFlPick [data-fltab="project"]');
    await p.waitForSelector('#scFlPick [data-flrel*="mara_sheet"]', { timeout: 15000 });
    await p.click('#scFlPick [data-flrel*="mara_sheet"]');
    await p.waitForFunction(() => !document.getElementById("scFlPick"), null, { timeout: 10000 }).catch(() => {});
    await waitPic(2, at2); await p.waitForTimeout(1200);
    const i2b = await item(2), r2 = ((await api("/api/scenes")).list || []).find((x) => x.n === 2) || {};
    check("📁 changes it: the scene picker (its 🎬 / 🎞 / 📁 / ⤒ tabs) -> Mara's sheet is scene 2's storyboard picture now - and, Start on it, its First frame",
      !!i2b && i2b.at !== at2 && /mara_sheet/.test(i2b.label) && i2b.style === "chosen" && !!(r2.fl_first && /storyboard/i.test(JSON.stringify(r2.fl_first))), { i2b, fl: r2.fl_first });

    /* 5 a click on the card = its full card */
    await p.click('#sbGrid .sbgcard[data-sbg="1"] .tx'); await p.waitForTimeout(400);
    check("a click on the picture opens the scene's full card (its frames, every setting)", await ev(() => document.getElementById("scPick").value === "1" && !!document.querySelector('#scList .sccard[data-sc="1"]') && document.querySelector('#scList .sccard[data-sc="1"]').offsetParent !== null));
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    await b.close();
    await api("/api/config", { llm: { external_url: llm0.external_url || "", external_model: llm0.external_model || "" } }).catch(() => {});
    llm.close();
    if (before && before !== PRJ) { try { await api("/api/projects/load", { name: before }); } catch { /* fine */ } }
    try { fs.rmSync(path.join(ROOT, "projects", PRJ), { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
