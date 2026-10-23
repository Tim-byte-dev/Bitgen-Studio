#!/usr/bin/env node
/* bitGen Studio — 2.580.0 in a REAL browser: the 🧩 Model manager's 📁 Model paths tab - every group of ComfyUI's
 * extra_model_paths.yaml listed, ➕ New group (other_ui1, its paths from the folders under the picked base), a path
 * changed / added / removed and 💾 saved, 🗑 a group deleted, the file's other groups and comments kept, and ⟳ Restart
 * ComfyUI (an outside ComfyUI is left alone and says so). Tim: "in modelmanager add a tab with comfyui extra model paths
 * listed, allow user to add new group of paths and chenge individual paths and delete a group of paths - group of paths
 * will be other_ui<n> etc" + "add restart comfy button in this tab". Against the running app (H3_URL). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.580.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();

(async () => {
  const cfg0 = await api("/api/config");
  const keepDir = ((cfg0.engine || {}).comfy || {}).dir || "";
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg580ui-"));
  const FX = require("./mmfixture518.js"), F = FX.make(T);
  const Y = path.join(F.comfy, "extra_model_paths.yaml");
  const ORIG = "# my own notes about this file\na111:\n    base_path: " + path.join(T, "webui") + "\n    checkpoints: models/Stable-diffusion\n    vae: models/VAE\n\n#comfyui:\n#    base_path: x\n";
  fs.writeFileSync(Y, ORIG);
  fs.mkdirSync(path.join(T, "webui", "models", "Stable-diffusion"), { recursive: true });
  const OU = path.join(T, "other"); fs.mkdirSync(path.join(OU, "models", "checkpoints"), { recursive: true }); fs.mkdirSync(path.join(OU, "models", "loras"), { recursive: true }); fs.mkdirSync(path.join(OU, "models", "vae"), { recursive: true });
  FX.safetensors(path.join(OU, "models", "loras", "e2e580_otherlora.safetensors"), null, ["lora_unet_x.lora_down.weight"]);
  await api("/api/config", { engine: { comfy: { dir: F.comfy } } });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2000, height: 1250 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const msg = () => ev(() => (document.getElementById("mmMsg") || {}).textContent || "");
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ModelMgr && window.H3ModelPaths, null, { timeout: 90000 });
    await p.waitForTimeout(2000);
    await ev(() => { document.getElementById("mmBtn").click(); });
    await p.waitForSelector('.mmgr [data-mmtab="paths"]', { timeout: 20000 });
    await ev(() => document.querySelector('.mmgr [data-mmtab="paths"]').click());
    await p.waitForSelector('#mmPaths .xpg[data-xpg="a111"]', { timeout: 15000 });
    const s1 = await ev(() => ({ file: document.querySelector("#mmPaths .xph code").textContent, groups: [...document.querySelectorAll("#mmPaths .xpg")].map((g) => g.dataset.xpg),
      rows: [...document.querySelectorAll('#mmPaths .xpg[data-xpg="a111"] .xprow')].map((r) => r.querySelector(".xpkey").value + "=" + r.querySelector(".xpval").value + (r.querySelector(".st.ok") ? "✓" : r.querySelector(".st.bad") ? "✗" : "?")),
      grid: document.getElementById("mmGrid").style.display, bar: document.getElementById("mmLocalBar").style.display, on: document.querySelector('.mmgr [data-mmtab="paths"]').classList.contains("on"),
      newBtn: (document.getElementById("xpNew") || {}).textContent, restart: !!document.getElementById("xpRestart") }));
    check("📁 Model paths tab: the yaml ComfyUI reads, its group with each path (✓ there / ✗ not), the cards + search bar hidden",
      s1.file === Y.replace(/\\/g, "\\") && s1.groups.join() === "a111" && s1.rows.join() === "checkpoints=models/Stable-diffusion✓,vae=models/VAE✗" && s1.grid === "none" && s1.bar === "none" && s1.on, s1);
    check("...with ➕ New group (other_ui1) and ⟳ Restart ComfyUI", /New group \(other_ui1\)/.test(s1.newBtn) && s1.restart, s1);

    /* ➕ New group - the folder picker answers with OU */
    await ev((dir) => { window.__fdKeep = window.FileDialog.open; window.FileDialog.open = (o) => Promise.resolve({ path: o.title.indexOf("The folder for") === 0 ? dir + "/models/vae" : dir }); }, OU);
    await ev(() => document.getElementById("xpNew").click());
    await p.waitForSelector('#mmPaths .xpg[data-xpg="other_ui1"]', { timeout: 10000 });
    const s2 = await ev(() => ({ rows: [...document.querySelectorAll('#mmPaths .xpg[data-xpg="other_ui1"] .xprow')].map((r) => r.querySelector(".xpkey").value + "=" + r.querySelector(".xpval").value + (r.querySelector(".st.ok") ? "✓" : "✗")),
      base: document.querySelector('#mmPaths .xpg[data-xpg="other_ui1"] .xpbase').value, next: document.getElementById("xpNew").textContent, msg: document.getElementById("mmMsg").textContent }));
    let text = fs.readFileSync(Y, "utf8");
    check("➕ New group: other_ui1 with the picked base and the folders found under it (checkpoints, vae, loras ✓), written after the rest of the file",
      s2.base === OU && s2.rows.join() === "checkpoints=models/checkpoints✓,vae=models/vae✓,loras=models/loras✓" && /other_ui2/.test(s2.next) && text.startsWith(ORIG) && /\nother_ui1:\n    base_path: /.test(text) && /Restart ComfyUI/.test(s2.msg), { s2, text });
    const cards = await api("/api/modelmgr/cards?refresh=1");
    check("...and the Model manager finds the LoRA in the new group's folder", (cards.loras || []).some((c) => /e2e580_otherlora/.test(c.name || c.key)), (cards.loras || []).map((c) => c.key));

    /* change individual paths in a111: edit one, 🗑 one, + one (📁 picked, made relative to the base), 💾 */
    await ev(() => {
      const g = document.querySelector('#mmPaths .xpg[data-xpg="a111"]');
      const v = g.querySelectorAll(".xprow")[0].querySelector(".xpval"); v.value = "models/Stable-diffusion/sdxl"; v.dispatchEvent(new Event("input", { bubbles: true }));
      g.querySelectorAll(".xprow")[1].querySelector("[data-xpdelrow]").click();
      g.querySelector("[data-xpadd]").click();
      const r = [...g.querySelectorAll(".xprow")].pop(); r.querySelector(".xpkey").value = "loras"; r.querySelector(".xpkey").dispatchEvent(new Event("input", { bubbles: true }));
    });
    const dirty = await ev(() => { const g = document.querySelector('#mmPaths .xpg[data-xpg="a111"]'); return { dirty: g.classList.contains("dirty"), save: !g.querySelector("[data-xpsave]").disabled, n: g.querySelectorAll(".xprow").length }; });
    // the 📁 of the new row: the picker answers <OU>/models/vae - outside a111's base, so it stays a full path
    await ev(() => { const g = document.querySelector('#mmPaths .xpg[data-xpg="a111"]'); [...g.querySelectorAll(".xprow")].pop().querySelector("[data-xppick]").click(); });
    await p.waitForTimeout(300);
    // ...and the same 📁 inside other_ui1's base becomes relative
    await ev(() => { const g = document.querySelector('#mmPaths .xpg[data-xpg="other_ui1"]'); g.querySelectorAll(".xprow")[0].querySelector("[data-xppick]").click(); });
    await p.waitForTimeout(300);
    const picked = await ev(() => ({ a: [...document.querySelectorAll('#mmPaths .xpg[data-xpg="a111"] .xprow')].pop().querySelector(".xpval").value, o: document.querySelector('#mmPaths .xpg[data-xpg="other_ui1"] .xprow .xpval').value, odirty: document.querySelector('#mmPaths .xpg[data-xpg="other_ui1"]').classList.contains("dirty") }));
    check("editing marks the group changed (💾 Save on); 📁 fills a path - relative when it is inside the group's base",
      dirty.dirty && dirty.save && dirty.n === 2 && picked.a === OU + "/models/vae" && picked.o === "models/vae" && picked.odirty, { dirty, picked });
    await ev(() => document.querySelector('#mmPaths .xpg[data-xpg="a111"] [data-xpsave]').click());
    await p.waitForFunction(() => /a111 saved/.test(document.getElementById("mmMsg").textContent), null, { timeout: 10000 });
    text = fs.readFileSync(Y, "utf8");
    const s3 = await ev(() => ({ rows: [...document.querySelectorAll('#mmPaths .xpg[data-xpg="a111"] .xprow')].map((r) => r.querySelector(".xpkey").value + "=" + r.querySelector(".xpval").value),
      odirty: document.querySelector('#mmPaths .xpg[data-xpg="other_ui1"]').classList.contains("dirty"), ov: document.querySelector('#mmPaths .xpg[data-xpg="other_ui1"] .xprow .xpval').value }));
    check("💾 Save: a111 written with the changed path, vae gone, the new loras path - the comment above it, other_ui1 and the commented block kept",
      /a111:\n    base_path: .*\n    checkpoints: models\/Stable-diffusion\/sdxl\n    loras: .*other\/models\/vae\n\n#comfyui:\n#    base_path: x\n/.test(text) && text.startsWith("# my own notes about this file\na111:") && /\nother_ui1:\n/.test(text) && !/vae: models\/VAE/.test(text)
      && s3.rows.join() === "checkpoints=models/Stable-diffusion/sdxl,loras=" + OU + "/models/vae", { text, s3 });
    check("...and other_ui1's unsaved change is still there (not lost to a111's save)", s3.odirty && s3.ov === "models/vae", s3);
    await ev(() => document.querySelector('#mmPaths .xpg[data-xpg="other_ui1"] [data-xprevert]').click());

    /* rename a group */
    await ev(() => { const g = document.querySelector('#mmPaths .xpg[data-xpg="a111"]'); const n = g.querySelector(".xpname"); n.value = "webui"; n.dispatchEvent(new Event("input", { bubbles: true })); g.querySelector(".xpdef").click(); g.querySelector("[data-xpsave]").click(); });
    await p.waitForSelector('#mmPaths .xpg[data-xpg="webui"]', { timeout: 10000 });
    text = fs.readFileSync(Y, "utf8");
    check("💾 a new name + is_default: the group renamed in the file, in its place", /# my own notes about this file\nwebui:\n    base_path: .*\n    is_default: true\n/.test(text) && !/^a111:/m.test(text), text);

    /* 🗑 Delete group */
    await ev(() => document.querySelector('#mmPaths .xpg[data-xpg="other_ui1"] [data-xpdelg]').click());
    await p.waitForFunction(() => document.querySelector("dialog[open] #note_body"), null, { timeout: 10000 });
    const ask = await ev(() => document.querySelector("dialog[open] #note_body").textContent);
    await ev(() => document.querySelector("dialog[open] #note_ok").click());
    await p.waitForFunction(() => !document.querySelector('#mmPaths .xpg[data-xpg="other_ui1"]'), null, { timeout: 10000 });
    text = fs.readFileSync(Y, "utf8");
    check("🗑 Delete group: asked first (the folders stay on the disk), then gone from the file - the rest kept, the folder kept",
      /other_ui1/.test(ask) && /stay on the disk/.test(ask) && !/other_ui1/.test(text) && /webui:/.test(text) && /#comfyui:/.test(text) && fs.existsSync(path.join(OU, "models", "loras", "e2e580_otherlora.safetensors")), { ask, text });
    check("...the previous file kept as extra_model_paths.yaml.bak", fs.existsSync(Y + ".bak") && /other_ui1/.test(fs.readFileSync(Y + ".bak", "utf8")));

    /* the file changed by hand meanwhile: the save is refused and the tab reads it again */
    fs.appendFileSync(Y, "\nhand_made:\n    checkpoints: /x\n"); const st = fs.statSync(Y); fs.utimesSync(Y, st.atime, new Date(st.mtimeMs + 4000));
    await ev(() => { const g = document.querySelector('#mmPaths .xpg[data-xpg="webui"]'); const v = g.querySelector(".xpval"); v.value = "models/x"; v.dispatchEvent(new Event("input", { bubbles: true })); g.querySelector("[data-xpsave]").click(); });
    await p.waitForSelector('#mmPaths .xpg[data-xpg="hand_made"]', { timeout: 10000 });
    check("changed on disk since the tab read it: not overwritten - said so, and the tab shows the file as it is now",
      /changed on disk/.test(await msg()) && /hand_made:/.test(fs.readFileSync(Y, "utf8")) && !/models\/x\n/.test(fs.readFileSync(Y, "utf8")));

    /* ⟳ Restart ComfyUI (the stub ComfyUI here was started by the test, not by the app) */
    const stc = await api("/api/comfy/status");
    await ev(() => document.getElementById("xpRestart").click());
    await p.waitForFunction(() => /⟳ (?!restarting)/.test(document.getElementById("mmMsg").textContent), null, { timeout: 30000 });
    const rm = await msg();
    if (stc.reachable && !stc.managed) check("⟳ Restart ComfyUI: a ComfyUI the app did not start is left alone, and it says why", /not started by bitGen Studio/.test(rm), rm);
    else check("⟳ Restart ComfyUI: answered (" + (stc.reachable ? "running" : "not running") + ")", /⟳ /.test(rm) && !/restarting…$/.test(rm), rm);
    try { await api("/api/comfy/stop", {}); } catch (e) { /* fine */ }

    /* back to Models: the cards again */
    await ev(() => document.querySelector('.mmgr [data-mmtab="models"]').click());
    const back = await ev(() => ({ grid: document.getElementById("mmGrid").style.display, paths: document.getElementById("mmPaths").style.display, bar: document.getElementById("mmLocalBar").style.display }));
    check("back on Models: the cards and the search bar again, the paths hidden", back.grid === "" && back.paths === "none" && back.bar === "", back);
    await ev(() => { window.FileDialog.open = window.__fdKeep; });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    await b.close();
    try { await api("/api/config", { engine: { comfy: { dir: keepDir } } }); } catch (e) { /* fine */ }
    fs.rmSync(T, { recursive: true, force: true });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
