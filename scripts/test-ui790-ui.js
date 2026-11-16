#!/usr/bin/env node
/* bitGen Studio — 2.790.0 browser test: 🧩 MODEL MANAGER ☐ Local ☐ RunPod ☐ OpenRouter ☐ All, 🗑 BY PLACE, ☁ OPENROUTER TAB WITH ＋
 * (lib/mmSources.js, routes/mmSources.js, static/mmsrc.js, static/mmor.js, lib/orModels.js endpoint) on a running studio (H3_URL,
 * default :8311) started with H3_OPENROUTER_API=http://127.0.0.1:8397/v1 (this test's stand-in OpenRouter lists).
 * Tim (verbatim): "in model manager docker add checkboxes for local - runpod - openrouter - all use this to filter the models the user
 * uses, allow user to delete models, if model is local delete the model (exists but without the local clause), if model is remote or
 * runpod remove it from the list. add an openrouter tab show models from openrouter , free , paid and the other filters, put a +
 * button next to the openrouter model to add the model to our model list and save it's endpoint"
 * A stand-in pod's inventory gives the RunPod cards; your OpenRouter list is put back afterwards. No server / no Playwright / 8397
 * busy = SKIP. */
"use strict";
const path = require("path"), fs = require("fs"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.790.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());
const DIR = path.join(__dirname, "..", "runpod", "pods"), POD = "pod790test", NAME = "Test pod";
const IMAGES = [{ id: "bytedance-seed/seedream-4.5", supported_parameters: { aspect_ratio: { type: "enum", values: ["1:1"] } } }, { id: "google/flash-image", supported_parameters: { aspect_ratio: { type: "enum", values: ["1:1"] } } }];
const GENERAL = [{ id: "bytedance-seed/seedream-4.5", name: "ByteDance Seed: Seedream 4.5", description: "Pictures from words." }, { id: "google/flash-image", name: "Google: Flash Image" }];
const LLMS = [{ id: "meta/llama-free:free", name: "Llama Free", context_length: 32000, pricing: { prompt: "0", completion: "0" }, architecture: { input_modalities: ["text"], output_modalities: ["text"] } }];
const json = (s, o, code) => { s.writeHead(code || 200, { "Content-Type": "application/json" }); s.end(JSON.stringify(o)); };

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.790.0 browser test did not run"); process.exit(0); }
  const lists = http.createServer((q, s) => {
    const u = q.url.split("?")[0];
    if (u === "/v1/models") return json(s, { data: /output_modalities=image/.test(q.url) ? GENERAL : LLMS });
    if (u === "/v1/images/models") return json(s, { data: IMAGES });
    if (u === "/v1/images/models/bytedance-seed/seedream-4.5/endpoints") return json(s, { data: { endpoints: [{ pricing: [{ billable: "output_image", unit: "image", cost_usd: 0.04 }] }] } });
    if (u === "/v1/images/models/google/flash-image/endpoints") return json(s, { data: { endpoints: [{ pricing: [{ billable: "output_image", unit: "image", cost_usd: 0 }] }] } });
    if (u === "/v1/videos/models") return json(s, { data: [] });
    json(s, { error: "no " + u }, 404);
  });
  try { await new Promise((ok, bad) => { lists.once("error", bad); lists.listen(8397, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8397 is busy - the 2.790.0 browser test did not run"); process.exit(0); }
  // your OpenRouter list emptied for the test (put back afterwards)
  const before = (await api("/api/ormodels/mine")).mine || {};
  for (const t of Object.keys(before)) for (const m of before[t] || []) await api("/api/ormodels/remove", { type: t, id: m.id });
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, POD + ".json"), JSON.stringify({ v: 1, id: POD, name: NAME, gone: false, at: Date.now(), listed_at: Date.now(), files: [
    { cat: "checkpoints", rel: "Models/krea2_mine.safetensors", size: 12e9, kind: "model", state: "on" }, { cat: "loras", rel: "krea_grain.safetensors", size: 2e8, kind: "lora", state: "on" }] }));
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3ModelMgr && window.H3MmSrc && window.H3MmOr, null, { timeout: 60000 });
    await ev(() => { try { localStorage.removeItem("h3.mmsrc"); localStorage.removeItem("h3mm.sel.v1"); } catch (e) { /* fine */ } H3ModelMgr.show(true); });
    await sleep(800);

    // ☁ OpenRouter tab: the models, Free / Paid, ＋
    await p.click('[data-mmtab="openrouter"]');
    await p.waitForFunction(() => document.querySelectorAll("#mmOr .mmorc").length >= 2, null, { timeout: 20000 }).catch(() => {});
    const t1 = await ev(() => ({ cards: [...document.querySelectorAll("#mmOr .mmorc")].map((c) => c.textContent), types: [...document.querySelectorAll("#mmOr .mmortype option")].map((x) => x.textContent), free: !!document.querySelector('#mmOr .mmorprice option[value="free"]'), paid: !!document.querySelector('#mmOr .mmorprice option[value="paid"]'), fam: !!document.querySelector("#mmOr .mmorfam"), sort: !!document.querySelector("#mmOr .mmorsort"), adds: document.querySelectorAll("#mmOr [data-oradd]").length, grid: getComputedStyle(document.getElementById("mmGrid")).display }));
    check("☁ OpenRouter tab: OpenRouter's picture models with their price, ＋ on each, the type / family / price / sort dropdowns (2.796.0), the Models grid hidden", t1.cards.some((t) => /Seedream 4\.5/.test(t) && /\$0\.04/.test(t)) && t1.cards.some((t) => /Flash Image/.test(t) && /free/.test(t)) && t1.adds === 2
      && t1.types.join("|").includes("Image") && t1.types.join("|").includes("Vision LLM") && t1.free && t1.paid && t1.fam && t1.sort && t1.grid === "none", t1);
    await ev(() => { const c = document.querySelector("#mmOr .mmorprice"); c.value = "free"; c.dispatchEvent(new Event("change", { bubbles: true })); });
    await sleep(200);
    const onlyFree = await ev(() => [...document.querySelectorAll("#mmOr .mmorc")].map((c) => c.dataset.orid));
    check("price ▸ free only: only the free one", onlyFree.join() === "google/flash-image", onlyFree);
    await ev(() => { const c = document.querySelector("#mmOr .mmorprice"); c.value = "both"; c.dispatchEvent(new Event("change", { bubbles: true })); });
    await sleep(200);
    await ev(() => document.querySelector('#mmOr [data-oradd="bytedance-seed/seedream-4.5"]').click());
    await p.waitForFunction(() => document.querySelector('#mmOr [data-orrm="bytedance-seed/seedream-4.5"]'), null, { timeout: 10000 }).catch(() => {});
    await p.waitForFunction(() => /renders at/.test(document.getElementById("mmMsg").textContent), null, { timeout: 10000 }).catch(() => {});
    const mine = ((await api("/api/ormodels/mine")).mine || {}).image || [];
    const msg = await ev(() => document.getElementById("mmMsg").textContent);
    check("＋ adds it to your models with its endpoint (the card says ✓ yours)", mine.length === 1 && mine[0].id === "bytedance-seed/seedream-4.5" && mine[0].endpoint === "http://127.0.0.1:8397/v1/images" && /renders at http:\/\/127\.0\.0\.1:8397\/v1\/images/.test(msg)
      && await ev(() => /✓ yours/.test(document.querySelector('#mmOr [data-orid="bytedance-seed/seedream-4.5"]').textContent)), { mine, msg });

    // Models tab: every place, tagged, the ticks
    await p.click('[data-mmtab="models"]');
    await p.waitForFunction(() => [...document.querySelectorAll("#mmGrid .mmcard")].some((c) => /^or:/.test(c.dataset.key)), null, { timeout: 15000 }).catch(() => {});
    const cards = () => ev(() => [...document.querySelectorAll("#mmGrid .mmcard")].map((c) => ({ key: c.dataset.key, tag: (c.querySelector(".tag.src") || {}).textContent || "" })));
    let c1 = await cards();
    const pc = c1.find((c) => c.key === "pi:" + POD + "|checkpoints|Models/krea2_mine.safetensors"), oc = c1.find((c) => c.key === "or:image:bytedance-seed/seedream-4.5");
    const bar = await ev(() => [...document.querySelectorAll("#mmPlace option")].map((x) => x.value + ":" + x.textContent));
    check("Models: the pod's checkpoint (RunPod) + your OpenRouter model (OpenRouter) beside this computer's; the place dropdown (2.796.0) with counts", pc && pc.tag === "RunPod" && oc && oc.tag === "OpenRouter"
      && bar.length === 4 && /^all:All places \(\d+\)/.test(bar[0]) && bar.some((x) => /^runpod:RunPod \(1\)/.test(x)) && bar.some((x) => /^openrouter:OpenRouter \(1\)/.test(x)) && bar.some((x) => /^local:This computer \(\d+\)/.test(x)), { c1, bar });
    const place = (v) => ev((x) => { const c = document.querySelector("#mmPlace"); c.value = x; c.dispatchEvent(new Event("change", { bubbles: true })); }, v);
    await place("openrouter"); await sleep(300);
    let c2 = await cards();
    check("place ▸ OpenRouter: only your OpenRouter model", c2.length >= 1 && c2.every((c) => /^or:/.test(c.key)), c2);
    await place("local"); await sleep(300);
    c2 = await cards();
    check("place ▸ This computer: no pod / OpenRouter cards", !c2.some((c) => /^(pi|or):/.test(c.key)), c2);
    await place("all"); await sleep(300);
    c2 = await cards();
    check("…All places again, remembered", c2.some((c) => /^pi:/.test(c.key)) && c2.some((c) => /^or:/.test(c.key)) && await ev(() => JSON.parse(localStorage.getItem("h3.mmsrc")).place === "all"));
    await place("runpod"); await sleep(300);
    c2 = await cards();
    check("place ▸ RunPod: only the pod's files", c2.length >= 1 && c2.every((c) => /^(pi|rm):/.test(c.key)), c2);
    await place("all"); await sleep(300);

    // the LoRAs tab has the pod's LoRA
    await p.click('[data-mmtab="loras"]'); await sleep(500);
    check("LoRAs: the pod's LoRA (RunPod)", (await cards()).some((c) => c.key === "pi:" + POD + "|loras|krea_grain.safetensors" && c.tag === "RunPod"));
    await p.click('[data-mmtab="models"]'); await sleep(500);

    // 🗑 by place: a pod file off the list (the pod keeps it), an OpenRouter model off your list; a card of this computer keeps its disk delete
    const acts = await ev((k) => { const c = document.querySelector('#mmGrid .mmcard[data-key="' + k + '"]'); return c ? [...c.querySelectorAll(".acts button")].map((b) => Object.keys(b.dataset).join()) : null; }, "pi:" + POD + "|checkpoints|Models/krea2_mine.safetensors");
    check("a pod card's actions: only 🗑 (off the list) - no ✎ / ⓘ / disk delete", acts && acts.join() === "mmsrcdel", acts);
    await ev((k) => document.querySelector('#mmGrid .mmcard[data-key="' + k + '"] [data-mmsrcdel]').click(), "pi:" + POD + "|checkpoints|Models/krea2_mine.safetensors");
    await p.waitForFunction((k) => !document.querySelector('#mmGrid .mmcard[data-key="' + k + '"]'), "pi:" + POD + "|checkpoints|Models/krea2_mine.safetensors", { timeout: 10000 }).catch(() => {});
    await p.waitForFunction(() => /pod keeps the file/.test(document.getElementById("mmMsg").textContent), null, { timeout: 10000 }).catch(() => {});
    const inv = JSON.parse(fs.readFileSync(path.join(DIR, POD + ".json"), "utf8"));
    const cm = await api("/api/comfymodels");
    check("🗑 the pod's checkpoint: gone from the Model manager and Basic Settings' lists, the pod's inventory keeps the file (hidden)", !(await cards()).some((c) => /krea2_mine/.test(c.key)) && inv.files.length === 2 && (inv.hidden || []).includes("checkpoints/Models/krea2_mine.safetensors")
      && !(((cm.categories || {}).checkpoints || {}).files || []).some((f) => /krea2_mine/.test(f.name)) && /pod keeps the file/.test(await ev(() => document.getElementById("mmMsg").textContent)), inv.hidden);
    await ev(() => document.querySelector('#mmGrid .mmcard[data-key="or:image:bytedance-seed/seedream-4.5"] [data-mmsrcdel]').click());
    await p.waitForFunction(() => !document.querySelector('#mmGrid .mmcard[data-key="or:image:bytedance-seed/seedream-4.5"]'), null, { timeout: 10000 }).catch(() => {});
    check("🗑 the OpenRouter model: off your OpenRouter models", (((await api("/api/ormodels/mine")).mine || {}).image || []).length === 0 && !(await cards()).some((c) => /^or:/.test(c.key)));
    const lc = await ev(() => [...document.querySelectorAll("#mmGrid .mmcard")].filter((c) => !/^(pi|or|rm):/.test(c.dataset.key)).map((c) => [...c.querySelectorAll(".acts button")].map((b) => Object.keys(b.dataset).join())));
    check("a card of this computer (if any here) keeps 🗑 delete-from-disk (asks first)", lc.every((a) => a.includes("mmdel")), lc);
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the test crashed: " + e.message, false); }
  finally {
    await b.close();
    try { fs.unlinkSync(path.join(DIR, POD + ".json")); } catch { /* gone */ }
    try { fs.rmdirSync(DIR); fs.rmdirSync(path.dirname(DIR)); } catch { /* kept: others there */ }
    const now = (await api("/api/ormodels/mine").catch(() => ({}))).mine || {};
    for (const t of Object.keys(now)) for (const m of now[t] || []) await api("/api/ormodels/remove", { type: t, id: m.id }).catch(() => {});
    for (const t of Object.keys(before)) for (const m of before[t] || []) await api("/api/ormodels/add", { type: t, id: m.id }).catch(() => {});
    lists.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
