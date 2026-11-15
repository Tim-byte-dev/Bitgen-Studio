#!/usr/bin/env node
/* bitGen Studio — 2.786.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311) started with
 * H3_OPENROUTER_API=http://127.0.0.1:8397/v1 (OpenRouter's lists - this test's stand-in) and
 * H3_API_BASE_OPENROUTER=http://127.0.0.1:8396/or (the renders - this test's stand-in too; never the real service).
 * Tim (verbatim): "Add an openrouter button to remote generation docker to select models to use, show dialog with free and paid
 * models and tabs for each type and inside each type have tabs for each family + 1 tab for all - but show price for paid service.
 * use 2 frames ... when user double clicks model then add the model to users models with a delete button at the end of each model
 * name. when user closes the dialog update all the dropdowns ... as openrouter/model name but don't remove the other models, if use
 * model is selected and an openrouter model is selected use openrouter" + "if openrouter model is not found, remove it from our list"
 *   - ☁ Remote generation ▸ OpenRouter models… opens the dialog: Image / Video / LLM / Vision LLM tabs, family tabs (All + makers),
 *     Available with prices (free / $ per image), double-click adds to My models (🗑 at the end), ✓ on the left;
 *   - closing: Basic Settings' checkpoint lists openrouter/<id> (the ComfyUI files kept), the video Model list too, the LLM list
 *     gets "☁ OpenRouter · your models";
 *   - a picture with openrouter/<id> + Use model: the price box first (Cancel = no render, Render = rendered on OpenRouter);
 *   - ☁ Runs on ▸ Video = OpenRouter: a video rendered there with the length snapped to the model's (6 s from 5 s);
 *   - a model OpenRouter no longer lists is taken off (⟳), the line says so;
 *   - 💲 Costs ▸ OpenRouter counts the renders; an LLM picked from your list = the LLM on OpenRouter.
 * Put back afterwards. No server / no Playwright / 8397 or 8396 busy = SKIP. */
"use strict";
const path = require("path"), fs = require("fs"), http = require("http"), os = require("os");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.786.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
let MP4 = Buffer.from("not a real video");
try { const f = path.join(os.tmpdir(), "ui786.mp4"); execSync(`ffmpeg -y -loglevel error -f lavfi -i testsrc=size=160x90:rate=24 -t 1 -pix_fmt yuv420p "${f}"`); MP4 = fs.readFileSync(f); } catch { /* the bytes above */ }
const LLMS = [
  { id: "meta/llama-free:free", name: "Llama Free", context_length: 32000, pricing: { prompt: "0", completion: "0" }, architecture: { input_modalities: ["text"], output_modalities: ["text"] } },
  { id: "qwen/vl-free:free", name: "Qwen VL Free", context_length: 32000, pricing: { prompt: "0", completion: "0" }, architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] } },
  { id: "big/paid", name: "Big Paid", context_length: 200000, pricing: { prompt: "0.000003", completion: "0.000015" }, architecture: { input_modalities: ["text"], output_modalities: ["text"] } },
];
const IMAGES = [
  { id: "bytedance-seed/seedream-4.5", supported_parameters: { aspect_ratio: { type: "enum", values: ["1:1", "16:9", "9:16"] }, input_references: { type: "range", min: 0, max: 4 } } },
  { id: "google/flash-image", supported_parameters: { aspect_ratio: { type: "enum", values: ["1:1"] } } },
];
const IMG_GENERAL = [{ id: "bytedance-seed/seedream-4.5", name: "ByteDance Seed: Seedream 4.5", description: "Pictures from words." }, { id: "google/flash-image", name: "Google: Flash Image" }];
const VIDEOS = [
  { id: "google/veo-3.1", name: "Google: Veo 3.1", supported_durations: [4, 6, 8], supported_aspect_ratios: ["16:9", "9:16"], pricing_skus: { "per-video-second": "0.40" } },
  { id: "kwaivgi/kling-3", name: "Kling 3", supported_durations: [5, 10], supported_aspect_ratios: ["16:9"], pricing_skus: { "per-video-second": "0.10" } },
];
const S = { dropVeo: false, seen: [] };
const json = (s, o, code) => { s.writeHead(code || 200, { "Content-Type": "application/json" }); s.end(JSON.stringify(o)); };

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.786.0 browser test did not run"); process.exit(0); }
  const lists = http.createServer((q, s) => {
    const u = q.url.split("?")[0];
    S.seen.push("L " + q.method + " " + q.url);
    if (u === "/v1/models") return json(s, { data: /output_modalities=image/.test(q.url) ? IMG_GENERAL : LLMS });
    if (u === "/v1/images/models") return json(s, { data: IMAGES });
    if (u === "/v1/images/models/bytedance-seed/seedream-4.5/endpoints") return json(s, { data: { id: "bytedance-seed/seedream-4.5", endpoints: [{ provider_name: "x", pricing: [{ billable: "output_image", unit: "image", cost_usd: 0.04 }] }] } });
    if (u === "/v1/images/models/google/flash-image/endpoints") return json(s, { data: { endpoints: [{ pricing: [{ billable: "output_image", unit: "image", cost_usd: 0 }] }] } });
    if (u === "/v1/videos/models") return json(s, { data: VIDEOS.filter((v) => !(S.dropVeo && v.id === "google/veo-3.1")) });
    if (u === "/v1/key") return json(s, { data: { label: "ui786", usage: 1, usage_daily: 1, usage_weekly: 1, usage_monthly: 1, is_free_tier: false } });
    json(s, { error: "no " + u }, 404);
  });
  const renders = http.createServer((q, s) => {
    let body = ""; q.on("data", (d) => { body += d; }); q.on("end", () => {
      const u = q.url.split("?")[0];
      let b = null; try { b = JSON.parse(body || "null"); } catch { b = null; }
      S.seen.push("R " + q.method + " " + u + " " + (b ? JSON.stringify(b).slice(0, 300) : ""));
      if (u === "/or/images" && q.method === "POST") return json(s, { data: [{ b64_json: PNG.toString("base64"), media_type: "image/png" }], usage: { cost: 0.04 } });
      if (u === "/or/videos" && q.method === "POST") return json(s, { id: "vid786", polling_url: "x", status: "pending" }, 202);
      if (u === "/or/videos/vid786") return json(s, { id: "vid786", status: "completed", usage: { cost: 2.4 } });
      if (u === "/or/videos/vid786/content") { s.writeHead(200, { "Content-Type": "video/mp4" }); return s.end(MP4); }
      json(s, { error: "no " + u }, 404);
    });
  });
  for (const [srv, port] of [[lists, 8397], [renders, 8396]]) {
    try { await new Promise((ok, bad) => { srv.once("error", bad); srv.listen(port, "127.0.0.1", ok); }); }
    catch { console.log("SKIP: port " + port + " is busy - the 2.786.0 browser test did not run"); process.exit(0); }
  }
  const o0 = await api("/api/openrouter"), m0 = await api("/api/ormodels/mine"), g0 = await api("/api/gpusplit"), e0 = await api("/api/remotegen"), u0 = await api("/api/basic-use");
  await api("/api/openrouter", { key: "sk-or-v1-UI786test" });
  await api("/api/remotegen/enabled", { on: true });
  await api("/api/remotehosts", { kind: "all", host: "local" });
  await api("/api/basic-use", { image_model: true, video_model: true });
  for (const t of ["image", "video", "llm", "vlm"]) for (const m of (m0.mine || {})[t] || []) await api("/api/ormodels/remove", { type: t, id: m.id });
  const styles = await api("/api/styles?kind=image");
  const style = ((styles.styles || styles || []).filter ? (styles.styles || styles) : []).find((x) => x && x.kind !== "music" && x.kind !== "video" && !x.chain);
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
    await ctx.addInitScript(() => { window.H3_RBTN_POLL = 800; });
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3OrModels && window.H3OrMine && document.getElementById("tRgen") && window.SecFloat && SecFloat.windows.rgen, null, { timeout: 30000 });
    await sleep(1200);
    await p.click("#tRgen");
    await p.waitForSelector("#rhOrBtn", { timeout: 15000 }).catch(() => {});
    check("☁ Remote generation has the OpenRouter models… button under Runs on", await ev(() => { const b = document.getElementById("rhOrBtn"); return !!b && b.closest("#rgdWhere") && b.offsetParent !== null; }));
    await p.click("#rhOrBtn");
    await sleep(500); await p.click("#orRefresh");   // OpenRouter's lists asked again (the studio keeps them 10 minutes)
    await p.waitForFunction(() => document.querySelectorAll("#orAvail li[data-id]").length === 2, null, { timeout: 20000 }).catch(() => {});
    const tabs = await ev(() => [...document.querySelectorAll("#orTypes [data-ort]")].map((x) => x.dataset.ort));
    check("the dialog: type tabs Image / Video / LLM / Vision LLM", tabs.join() === "image,video,llm,vlm", tabs);
    const fams = await ev(() => [...document.querySelectorAll("#orFams [data-orf]")].map((x) => x.textContent));
    check("…family tabs: All + each maker with its count", fams[0] === "All 2" && fams.includes("ByteDance Seed 1") && fams.includes("Google 1"), fams);
    const av = await ev(() => [...document.querySelectorAll("#orAvail li[data-id]")].map((li) => ({ id: li.dataset.id, name: li.querySelector("b").textContent, price: li.querySelector(".orPrice").textContent, cls: li.querySelector(".orPrice").className })));
    const sd = av.find((x) => x.id === "bytedance-seed/seedream-4.5"), gf = av.find((x) => x.id === "google/flash-image");
    check("…Available: names, a paid model's price per picture, a free one in green", sd && sd.name === "ByteDance Seed: Seedream 4.5" && sd.price === "$0.04 / image" && /paid/.test(sd.cls) && gf && gf.price === "free" && /free/.test(gf.cls), av);
    await p.click('#orFams [data-orf="google"]');
    check("…a family tab shows only its models", (await ev(() => [...document.querySelectorAll("#orAvail li[data-id]")].map((x) => x.dataset.id))).join() === "google/flash-image");
    await p.click('#orFams [data-orf="all"]');
    await p.dblclick('#orAvail li[data-id="bytedance-seed/seedream-4.5"]');
    await p.waitForFunction(() => document.querySelectorAll("#orMine li[data-id]").length === 1, null, { timeout: 8000 }).catch(() => {});
    const my = await ev(() => [...document.querySelectorAll("#orMine li[data-id]")].map((li) => ({ id: li.dataset.id, del: !!li.querySelector("[data-ordel]") && li.lastElementChild.matches("[data-ordel]"), t: li.textContent })));
    check("double-click adds it to My models - with 🗑 at the end, openrouter/<id>", my.length === 1 && my[0].id === "bytedance-seed/seedream-4.5" && my[0].del && /openrouter\/bytedance-seed\/seedream-4\.5/.test(my[0].t), my);
    check("…✓ on the left, Image (1) on its tab", (await ev(() => !!document.querySelector('#orAvail li[data-id="bytedance-seed/seedream-4.5"] .mine'))) && /Image \(1\)/.test(await ev(() => document.querySelector('#orTypes [data-ort="image"]').textContent)));
    await p.dblclick('#orAvail li[data-id="google/flash-image"]'); await sleep(800);
    await p.click('#orMine [data-ordel="google/flash-image"]'); await sleep(800);
    check("🗑 takes one off", (await ev(() => [...document.querySelectorAll("#orMine li[data-id]")].map((x) => x.dataset.id))).join() === "bytedance-seed/seedream-4.5");
    await p.click('#orTypes [data-ort="video"]');
    await sleep(500); await p.click("#orRefresh");
    await p.waitForFunction(() => document.querySelectorAll("#orAvail li[data-id]").length === 2 && document.querySelector('#orAvail li[data-id="google/veo-3.1"]'), null, { timeout: 15000 }).catch(() => {});
    check("Video tab: $ per second", /\$0\.4 \/ second/.test(await ev(() => (document.querySelector('#orAvail li[data-id="google/veo-3.1"] .orPrice') || {}).textContent || "")));
    await p.dblclick('#orAvail li[data-id="google/veo-3.1"]'); await sleep(900);
    await p.click('#orTypes [data-ort="llm"]');
    await p.waitForFunction(() => document.querySelector('#orAvail li[data-id="big/paid"]'), null, { timeout: 15000 }).catch(() => {});
    check("LLM tab: $ in / out per M tokens", /\$3 in \/ \$15 out per M tokens/.test(await ev(() => (document.querySelector('#orAvail li[data-id="big/paid"] .orPrice') || {}).textContent || "")));
    await p.dblclick('#orAvail li[data-id="big/paid"]'); await sleep(900);
    await p.click("#orDlgX"); await sleep(1800);
    check("closing: the dialog shuts", !(await ev(() => document.getElementById("orDlg").open)));
    const lists1 = await ev(() => ({
      ckpt: [...document.querySelectorAll("#imgCkptCombo .cmfile option")].map((o) => o.value),
      ckGroup: !!document.querySelector('#imgCkptCombo .cmfile optgroup[data-or]'),
      vid: [...document.querySelectorAll("#vidModelList option")].map((o) => o.value),
      llm: [...document.querySelectorAll("#llmSel option")].map((o) => o.value),
    }));
    check("…Basic Settings' checkpoint lists openrouter/<id> in a ☁ OpenRouter group, the other entries kept", lists1.ckGroup && lists1.ckpt.includes("openrouter/bytedance-seed/seedream-4.5") && lists1.ckpt.includes(""), lists1.ckpt);
    check("…the video Model list has openrouter/google/veo-3.1", lists1.vid.includes("openrouter/google/veo-3.1"), lists1.vid.slice(-4));
    check("…the LLM list has openrouter/big/paid", lists1.llm.includes("openrouter/big/paid"), lists1.llm.slice(-4));

    // ---- a picture with openrouter/<id>: the price box first
    const sid = style && style.id;
    const go = (model) => ev((a) => fetch("/api/genimage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "a red fox", style_id: a.sid, model: a.model, width: 1280, height: 720 }) }).then((r) => r.json().then((j) => ({ status: r.status, j }))), { sid, model });
    let pr = go("openrouter/bytedance-seed/seedream-4.5");
    await p.waitForSelector("#orCostDlg", { timeout: 10000 }).catch(() => {});
    const box = await ev(() => { const d = document.getElementById("orCostDlg"); return d ? d.textContent : ""; });
    check("the price box before a paid render: the model + about $0.04 + what OpenRouter does not take", /Render on OpenRouter - ByteDance Seed: Seedream 4\.5/.test(box) && /\$0\.040/.test(box) && /LoRAs/.test(box), box);
    await p.click("#orCostNo");
    let r1 = await pr;
    check("…Cancel = not rendered (409 cancelled)", r1.status === 409 && r1.j.cancelled === true, r1);
    const before = S.seen.filter((x) => /^R POST \/or\/images/.test(x)).length;
    pr = go("openrouter/bytedance-seed/seedream-4.5");
    await p.waitForSelector("#orCostDlg", { timeout: 10000 }).catch(() => {});
    await p.click("#orCostGo");
    r1 = await pr;
    check("…Render = queued", r1.status === 200 && r1.j.id, r1);
    let job = null;
    for (let i = 0; i < 60 && r1.j && r1.j.id; i++) { job = await api("/api/jobs/" + r1.j.id); if (job && /done|failed|error/.test(job.status)) break; await sleep(500); }
    const req = S.seen.filter((x) => /^R POST \/or\/images/.test(x)).slice(before);
    check("…made on OpenRouter: POST /images with the model, the aspect 16:9 (snapped), the job done", job && job.status === "done" && req.length === 1 && /"model":"bytedance-seed\/seedream-4\.5"/.test(req[0]) && /"aspect_ratio":"16:9"/.test(req[0]), { status: job && job.status, req, log: job && (job.log || []).slice(-6) });
    check("…the log says OpenRouter, nothing on this graphics card", /rendered on OpenRouter/.test(JSON.stringify((job && job.log) || "")));

    // ---- Runs on ▸ Video = OpenRouter: a video made there, its length snapped
    const h = await api("/api/remotehosts", { kind: "video", host: "openrouter" });
    check("☁ Runs on ▸ Video = OpenRouter (the line names the model + its price)", h.hosts && h.hosts.video === "openrouter" && /Veo 3\.1 · \$0\.4 \/ second/.test((h.kinds.find((x) => x.k === "video") || {}).note || ""), h.kinds && h.kinds.find((x) => x.k === "video"));
    const vb = S.seen.filter((x) => /^R POST \/or\/videos/.test(x)).length;
    const vr = ev(() => { const f = new FormData(); f.append("mode", "t2va"); f.append("prompt", "a fox runs"); f.append("frames", "120"); f.append("width", "1280"); f.append("height", "720");
      return fetch("/api/generate", { method: "POST", body: f }).then((r) => r.json().then((j) => ({ status: r.status, j }))); });
    await p.waitForSelector("#orCostDlg", { timeout: 10000 }).catch(() => {});
    const vbox = await ev(() => (document.getElementById("orCostDlg") || {}).textContent || "");
    check("…its price box: 6 s × $0.4", /about \$2\.40 \(6 s × \$0\.4 a second\)/.test(vbox), vbox);
    await p.click("#orCostGo").catch(() => {});
    const v1 = await vr;
    let vjob = null;
    for (let i = 0; i < 80 && v1.j && v1.j.id; i++) { vjob = await api("/api/jobs/" + v1.j.id); if (vjob && /done|failed|error/.test(vjob.status)) break; await sleep(500); }
    const vreq = S.seen.filter((x) => /^R POST \/or\/videos/.test(x)).slice(vb);
    check("…made on OpenRouter: POST /videos with veo-3.1, duration 6 (5 s snapped), 16:9; the job done", vjob && vjob.status === "done" && vreq.length === 1 && /"model":"google\/veo-3\.1"/.test(vreq[0]) && /"duration":6/.test(vreq[0]) && /"aspect_ratio":"16:9"/.test(vreq[0]), { st: vjob && vjob.status, vreq, log: vjob && (vjob.log || []).slice(-6) });
    await api("/api/remotehosts", { kind: "video", host: "local" });

    // ---- 💲 Costs ▸ OpenRouter counts the renders
    const cs = await api("/api/costs?range=today&refresh=1");
    const orRow = (cs.rows || []).find((x) => x.id === "openrouter");
    check("💲 Costs ▸ OpenRouter counts the renders", orRow && /render/.test(orRow.sub), cs.rows);

    // ---- the LLM list: a pick of yours = the LLM on OpenRouter
    await ev(() => { const s = document.getElementById("llmSel"); s.value = "openrouter/big/paid"; s.dispatchEvent(new Event("change", { bubbles: true })); });
    await sleep(1800);
    const hh = await api("/api/remotehosts"), oo = await api("/api/openrouter");
    check("an LLM picked from your OpenRouter list: the LLM runs on OpenRouter with it", hh.hosts.llm === "openrouter" && oo.model === "big/paid", { llm: hh.hosts.llm, model: oo.model });

    // ---- a model OpenRouter no longer lists is taken off
    S.dropVeo = true;
    await ev(() => H3OrModels.open("video")); await sleep(600);
    await p.click("#orRefresh");
    await p.waitForFunction(() => /no longer lists/.test((document.getElementById("orMsg") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => {});
    check("⟳: a model OpenRouter no longer lists is taken off - the line says which", /no longer lists Google: Veo 3\.1/.test(await ev(() => document.getElementById("orMsg").textContent)) && (await api("/api/ormodels/mine")).mine.video.length === 0);
    await p.click("#orDlgX"); await sleep(600);
    check("no page errors", errs.length === 0, errs);
  } finally {
    await b.close();
    for (const t of ["image", "video", "llm", "vlm"]) for (const m of ((await api("/api/ormodels/mine").catch(() => ({}))).mine || {})[t] || []) await api("/api/ormodels/remove", { type: t, id: m.id }).catch(() => {});
    for (const t of ["image", "video", "llm", "vlm"]) for (const m of (m0.mine || {})[t] || []) await api("/api/ormodels/add", { type: t, id: m.id }).catch(() => {});
    await api("/api/remotehosts", { kind: "all", host: "local" }).catch(() => {});
    await api("/api/gpusplit", { where: g0.where || "local", per: false, engine: g0.engine || undefined }).catch(() => {});
    await api("/api/openrouter", { key: o0.key || "", model: o0.model || "", vlm_model: o0.vlm_model || "" }).catch(() => {});
    await api("/api/remotegen/enabled", { on: !!e0.enabled }).catch(() => {});
    await api("/api/basic-use", u0).catch(() => {});
    lists.close(); renders.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
