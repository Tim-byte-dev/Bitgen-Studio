#!/usr/bin/env node
/* bitGen Studio — 2.592.0 in a REAL browser, against the running app (H3_URL) + a stub ComfyUI started here:
 *   🎭 the image editor's 🔲 Zones ▸ ▦ Regional: each box's 🎭 (shown only in ▦ Regional) opens ComfyUI's LoRA list +
 *   a strength; two boxes with two character LoRAs -> ✨ Generate zones -> the job queues ONE
 *   NouganRegionalCharacterLoRA (its log says LoRA A / B and their boxes); a third LoRA is refused before any job;
 *   ⏱ the prompt docker with an LTX style: the ⏱ button shows, adds [0-2s] / [2-4s] lines; the LTX job runs Prompt
 *   Relay (its log: "⏱ Prompt Relay (PromptRelayEncode): 2 timed line(s)").
 * Tim: "lets just add the regional character lora and prompt relay". Settings put back. No Playwright = SKIP. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, spawn } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.592.0 browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const CPORT = 8398;
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (p, b) => (await fetch(URL_ + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) })).json();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-ui592-"));
async function waitJob(id, ms) {
  const t0 = Date.now();
  for (;;) {
    const j = await (await fetch(URL_ + `api/jobs/${id}?log_from=0`)).json();
    if (["done", "failed", "cancelled"].includes(j.status) || Date.now() - t0 > ms) return j;
    await sleep(500);
  }
}

(async () => {
  const cfg0 = await (await fetch(URL_ + "api/config")).json();
  const eng0 = JSON.parse(JSON.stringify(cfg0.engine || {}));
  const comfyDir = path.join(tmp, "ComfyUI");
  fs.mkdirSync(path.join(comfyDir, "models", "loras", "chars"), { recursive: true });
  for (const f of ["tim.safetensors", "ana.safetensors", "bob.safetensors"]) fs.writeFileSync(path.join(comfyDir, "models", "loras", "chars", f), "x");
  const stub = spawn("python3", [path.join(__dirname, "stub-comfy.py"), String(CPORT), path.join(tmp, "comfy-out")], { stdio: "ignore" });
  for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://127.0.0.1:${CPORT}/system_stats`)).ok) break; } catch { /* not yet */ } await sleep(250); }
  await post("api/config", { engine: { backend: "comfy", comfy: Object.assign({}, eng0.comfy || {}, { url: `http://127.0.0.1:${CPORT}`, dir: comfyDir }) } });
  try { await fetch(URL_ + "api/docker-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docks: { imageeditdock: { state: "open", hidden: false, maximized: false } } }) }); } catch { /* older */ }
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  let gm0 = null, vs0 = null, pr0 = "";
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.imageEditorInstance && window.imageEditorInstance.E && window.imageEditorInstance.E.zones && window.H3Relay, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await ev(() => { const d = document.getElementById("imageeditdock"); if (d.classList.contains("dockgone")) toggleDockGone("imageeditdock", "tIE"); if (d.classList.contains("collapsed")) toggleCollapse("imageeditdock"); });
    await ev(() => new Promise((ok) => { const c = document.createElement("canvas"); c.width = 512; c.height = 384; const g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, 512, 384); window.imageEditorInstance.load(c.toDataURL("image/png"), "ui592"); setTimeout(ok, 800); }));
    await p.waitForFunction(() => window.imageEditorInstance.E.S.w === 512, null, { timeout: 20000 });
    await ev(async () => { if (typeof loadComfyModels === "function") { try { await loadComfyModels(true); } catch (e) { /* the list */ } } });

    /* ---------------- 🎭 zones */
    await ev(() => { const E = window.imageEditorInstance.E; const zs = E.zones.list(); zs.length = 0;
      zs.push({ x: 0, y: 0, w: 256, h: 384, text: "Tim, a man in a blue coat", color: "red" }, { x: 256, y: 0, w: 256, h: 384, text: "Ana, a woman in red", color: "blue" });
      E.zones.open(); });
    await p.waitForTimeout(500);
    const vis = await ev(() => { const m = document.getElementById("pzMethod"); const shown = () => [...document.querySelectorAll("#kxZones .pzl")].map((b) => b.style.display !== "none" && !!b.offsetWidth);
      m.value = "boxes"; m.onchange(); const a = shown(); m.value = "regional"; m.onchange(); const r = shown(); return { boxes: a, regional: r, hint: document.getElementById("pzHint").textContent }; });
    check("🎭 on each box line only in ▦ Regional (hidden for ▣ One box at a time); the hint names the add-on",
      vis.boxes.length === 2 && vis.boxes.every((x) => !x) && vis.regional.every(Boolean) && /Nougan Nodes/.test(vis.hint), vis);
    await ev(() => document.querySelector('#kxZones [data-zl="0"]').click());
    await p.waitForTimeout(300);
    const row = await ev(() => { const r = document.querySelector('#kxZones [data-zlr="0"]'); const sel = r && r.querySelector("select.cmfile");
      return { row: !!r, combo: !!sel, opts: sel ? [...sel.options].map((o) => o.value).filter(Boolean) : [], strength: !!(r && r.querySelector('input[type=number]')) }; });
    check("🎭 opens the box's row: ComfyUI's LoRA list (the page's model combo) + a strength", row.row && row.combo && row.strength, row);
    const set = async (i, file, w) => {
      if (!(await ev((i) => !!document.querySelector(`#kxZones [data-zlr="${i}"]`), i))) await ev((i) => document.querySelector(`#kxZones [data-zl="${i}"]`).click(), i);
      await ev(([i, file, w]) => { const inp = document.getElementById("pzLi" + i); const sel = document.querySelector(`#kxZones [data-zlr="${i}"] select.cmfile`);
        if (sel && [...sel.options].some((o) => o.value === file)) { sel.value = file; sel.onchange(); } else { inp.value = file; inp.dispatchEvent(new Event("input", { bubbles: true })); }
        const n = document.querySelector(`#kxZones [data-zlw="${i}"]`); n.value = String(w); n.dispatchEvent(new Event("input", { bubbles: true })); }, [i, file, w]);
    };
    await set(0, "chars/tim.safetensors", 0.9);
    await set(1, "chars/ana.safetensors", 1);
    const zs = await ev(() => window.imageEditorInstance.E.zones.list().map((z) => ({ lora: z.lora, w: z.lora_w })));
    check("the boxes keep their LoRA + strength; 🎭 lit on a box with one", zs[0].lora === "chars/tim.safetensors" && zs[0].w === 0.9 && zs[1].lora === "chars/ana.safetensors"
      && await ev(() => document.querySelector('#kxZones [data-zl="0"]').classList.contains("on")), zs);
    const posted = [];
    p.on("request", (r) => { if (/\/api\/genimage$/.test(r.url()) && r.method() === "POST") { try { posted.push(JSON.parse(r.postData() || "{}")); } catch { posted.push({}); } } });
    await ev(async () => { const s = document.getElementById("pzStyle"); s.focus(); await new Promise((r) => setTimeout(r, 600));
      const o = [...s.options].find((x) => /FLUX\.2 9B \(verified\)/.test(x.textContent)) || [...s.options].find((x) => /FLUX\.2/.test(x.textContent)); if (o) { s.value = o.value; s.onchange(); } });
    await ev(() => { window.__jid = null; const f = window.fetch; window.__f0 = f; window.fetch = async function (u, o) { const r = await f.apply(this, arguments); if (/\/api\/genimage$/.test(String(u))) { try { const j = await r.clone().json(); window.__jid = j.id; } catch (e) { /* not json */ } } return r; }; });
    await ev(() => document.getElementById("pzGo").click());
    await p.waitForFunction(() => window.__jid, null, { timeout: 30000 }).catch(() => null);
    const jid = await ev(() => window.__jid);
    const body = posted[0] || {};
    check("✨ Generate zones (▦ Regional): /api/genimage gets each box's LoRA + strength", body.regions && body.regions[0].lora === "chars/tim.safetensors" && body.regions[0].lora_strength === 0.9
      && body.regions[1].lora === "chars/ana.safetensors", body.regions);
    const job = jid ? await waitJob(jid, 90000) : {};
    const log = (job.log || []).join("\n");
    check("the job queues ONE NouganRegionalCharacterLoRA - LoRA A (box 1) and LoRA B (box 2), the scene over the whole picture; it renders through the stub",
      job.status === "done" && /🎭 regional character LoRAs \(NouganRegionalCharacterLoRA, node [^)]+\): LoRA A chars\/tim\.safetensors @ 0\.9 in box\(es\) 1; LoRA B chars\/ana\.safetensors @ 1 in box\(es\) 2/.test(log),
      { status: job.status, log: (job.log || []).filter((l) => /🎭|error|fail|zone/i.test(l)).slice(-6) });
    await ev(() => { window.fetch = window.__f0; });
    // a third LoRA: refused before any job
    await ev(() => { const zs = window.imageEditorInstance.E.zones.list(); zs.push({ x: 100, y: 250, w: 120, h: 120, text: "Bob", color: "green", lora: "chars/bob.safetensors" }); window.imageEditorInstance.E.zones.paint(); });
    const n0 = posted.length;
    await ev(() => document.getElementById("pzGo").click());
    await p.waitForTimeout(800);
    check("three different character LoRAs: refused in the editor, no job sent (the node has LoRA A and B)", posted.length === n0, posted.length - n0);
    await ev(() => { const zs = window.imageEditorInstance.E.zones.list(); zs.length = 0; window.imageEditorInstance.E.zones.paint(); });

    /* ---------------- ⏱ Prompt Relay */
    gm0 = await ev(() => document.getElementById("genModeSel").value);
    vs0 = await ev(() => document.getElementById("videoStyleSel").value);
    pr0 = await ev(() => document.getElementById("prompt").value);
    await ev(() => { const s = document.getElementById("genModeSel"); s.value = "video"; s.onchange && s.onchange(); });
    await p.waitForTimeout(500);
    const pick = await ev(() => { const s = document.getElementById("videoStyleSel"); const o = [...s.options].find((x) => /LTX 2\.5/.test(x.textContent)); if (!o) return false; s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); if (typeof ltxModePaint === "function") ltxModePaint(); return true; });
    await p.waitForTimeout(400);
    const btn = await ev(() => { const b = document.getElementById("ltxRelayBtn"); return { shown: !!b && !b.hidden && !!b.offsetWidth, title: b ? b.title : "" }; });
    check("an LTX style: ⏱ beside the LTX mode (says what it does and the add-on)", pick && btn.shown && /Prompt Relay/.test(btn.title) && /Nougan Nodes/.test(btn.title), { pick, btn });
    await ev(() => { document.getElementById("prompt").value = "a red fox in the snow, cinematic"; document.getElementById("seconds").value = "4"; });
    await ev(() => document.getElementById("ltxRelayBtn").click());
    await ev(() => { const t = document.getElementById("prompt"); t.value += "the fox sniffs the ground"; });
    await ev(() => document.getElementById("ltxRelayBtn").click());
    await ev(() => { const t = document.getElementById("prompt"); t.value += "the fox looks up"; });
    const txt = await ev(() => document.getElementById("prompt").value);
    check("⏱ adds the next timed line each time: [0-2s] then [2-4s]", txt === "a red fox in the snow, cinematic\n[0-2s] the fox sniffs the ground\n[2-4s] the fox looks up", txt);
    const lid = await ev(async () => { try { return await window.submitLtx(document.getElementById("prompt").value); } catch (e) { return "ERR " + e.message; } });
    const lj = lid && !/^ERR/.test(String(lid)) ? await waitJob(lid, 180000) : { log: [String(lid)] };
    const ll = (lj.log || []).join("\n");
    check("the LTX job: Prompt Relay wired in - 2 timed lines at 0-2 s / 2-4 s, the global prompt over the clip; it renders",
      lj.status === "done" && /⏱ Prompt Relay \(PromptRelayEncode\): 2 timed line\(s\) - 0\.0-2\.0s "the fox sniffs the ground"; 2\.0-4\.0s "the fox looks up"/.test(ll),
      { status: lj.status, log: (lj.log || []).filter((l) => /⏱|error|fail|relay/i.test(l)).slice(-8) });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally {
    try { await ev(([g, v, t]) => { const s = document.getElementById("genModeSel"); if (g && s) { s.value = g; s.onchange && s.onchange(); } const vs = document.getElementById("videoStyleSel"); if (v && vs) { vs.value = v; vs.dispatchEvent(new Event("change", { bubbles: true })); } document.getElementById("prompt").value = t || ""; }, [gm0, vs0, pr0]); } catch { /* fine */ }
    try { await b.close(); } catch { /* fine */ }
    try { await post("api/config", { engine: eng0 }); } catch { /* fine */ }
    try { stub.kill(); } catch { /* fine */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
