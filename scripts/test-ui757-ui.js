#!/usr/bin/env node
/* bitGen Studio — 2.757.0 in a REAL browser against a running studio (H3_URL / H3_PORT - default 8311) started with
 * H3_API_BASE_OPENROUTER=http://127.0.0.1:8396/or (this test's stand-in OpenRouter on 8396 - never the real one, no money).
 * Tim (verbatim): "can you add an api tab to bitgen with add api input and name input and a use checkbox for each api the
 * use adds. if api is checked add it to styles with prefix API_ so bitgen can truly work without good hardware".
 *   - Settings ▸ API after Remote generation: Service (Auto-detect), Name, API key, Use, + Add;
 *   - a pasted OpenRouter key is recognised; + Add with Use = API_<name> pictures / video in the style lists (the prompt
 *     docker's image style, the video style list), the key only as its last 4 - encrypted in settings/keys.json;
 *   - ✓ Test asks the service; Use for the LLM; untick Use = its styles go; ✕ Remove asks, then removes;
 *   - a picture rendered with the API_ style: the job runs misc/api_worker.py against the stand-in, the picture lands in
 *     the project's output - no ComfyUI involved;
 *   - Settings ▸ Image: the style's Runs on shows ◉ API with this API picked and its model.
 * Put back afterwards. No server / no Playwright / 8396 busy = SKIP. */
"use strict";
const path = require("path"), http = require("http"), fs = require("fs");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.757.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEY = "sk-or-v1-UI757" + "z".repeat(40), CKEY = "sk-ant-api03-UI757" + "c".repeat(60);
let claudeBody = null;
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("ui757 picture")]);

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.757.0 browser test did not run"); process.exit(0); }
  const seen = [];
  const or = http.createServer((q, s) => {
    let b = ""; q.on("data", (d) => { b += d; }); q.on("end", () => {
      seen.push(q.method + " " + q.url + " " + (q.headers.authorization || "") + " " + b.slice(0, 300));
      const send = (code, j) => { s.writeHead(code, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
      // Claude (Anthropic) stand-in on /anth: ✓ Test = GET /models with x-api-key; the LLM = POST /chat/completions with Bearer
      if (q.url.startsWith("/anth/")) {
        if (q.url === "/anth/models?limit=1") return q.headers["x-api-key"] === CKEY && q.headers["anthropic-version"] ? send(200, { data: [{ id: "claude-sonnet-5-5" }] }) : send(401, {});
        if (q.url === "/anth/chat/completions" && q.headers.authorization === "Bearer " + CKEY) { claudeBody = JSON.parse(b); return send(200, { choices: [{ message: { role: "assistant", content: "Hello from the Claude stand-in." } }] }); }
        return send(401, {});
      }
      if (q.headers.authorization !== "Bearer " + KEY) return send(401, { error: { message: "no" } });
      if (q.url === "/or/key") return send(200, { data: { label: "ui757", usage: 0 } });
      if (q.url === "/or/images" && q.method === "POST") return send(200, { data: [{ b64_json: PNG.toString("base64"), media_type: "image/png" }], usage: { cost: 0.04 } });
      send(404, {});
    });
  });
  try { await new Promise((ok, no) => { or.once("error", no); or.listen(8396, "127.0.0.1", ok); }); } catch { console.log("SKIP: 8396 is busy - the 2.757.0 browser test did not run"); process.exit(0); }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e)));
  const ev = (fn, a) => page.evaluate(fn, a);
  let apiId = null;
  try {
    await page.goto(URL0, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!window.H3Apis && !!document.querySelector('#settings .stabs [data-stab="api"]'), null, { timeout: 30000 });
    await ev(() => { document.getElementById("openSettings").onclick(); document.querySelector('#settings .stabs [data-stab="api"]').click(); });
    await page.waitForFunction(() => document.querySelectorAll("#apiSvc option").length > 6, null, { timeout: 15000 });
    const t = await ev(() => {
      const tabs = [...document.querySelectorAll("#settings .stabs button")].map((b) => b.dataset.stab);
      return { after: tabs[tabs.indexOf("api") - 1], active: document.getElementById("stab-api").classList.contains("active"),
        svcs: [...document.querySelectorAll("#apiSvc option")].map((o) => o.textContent), keyType: document.getElementById("apiKey").type,
        use: document.getElementById("apiUse").checked, add: document.getElementById("apiAdd").textContent, list: document.getElementById("apiList").textContent };
    });
    check("Settings ▸ API, right after Remote generation: Service (Auto-detect + the seven, Claude too), Name, API key (hidden), Use (ticked), + Add; empty list says so",
      t.after === "rgpu" && t.active && t.svcs.join("|") === "Auto-detect from the key|OpenRouter|fal.ai|Replicate|OpenAI|Google Gemini|Claude (Anthropic)|RunningHub" && t.keyType === "password" && t.use && t.add === "+ Add"
      && /No APIs yet/.test(t.list), t);
    await page.fill("#apiKey", KEY);
    const h = await ev(() => document.getElementById("apiHint").textContent);
    check("…pasting an OpenRouter key: 'Looks like OpenRouter' + what it does + where to get a key", /Looks like OpenRouter/.test(h) && /Get a key/.test(h), h);
    await page.fill("#apiName", "UI Test");
    await page.click("#apiAdd");
    await page.waitForFunction(() => document.querySelector("#apiList [data-api]"), null, { timeout: 15000 });
    const a = await ev((KEY) => { const r = document.querySelector("#apiList [data-api]"); return { id: r.dataset.api, txt: r.textContent, on: r.classList.contains("on"), use: r.querySelector('[data-act="use"]').checked, say: document.getElementById("apiSay").textContent, key: document.getElementById("apiKey").value, html: document.getElementById("stab-api").innerHTML.includes(KEY) }; }, KEY);
    apiId = a.id;
    check("+ Add: the API is listed with Use ticked, OpenRouter, the key only as its last 4 (the page never has it), pictures / video / LLM; the key box emptied",
      a.on && a.use && /UI Test/.test(a.txt) && /OpenRouter/.test(a.txt) && a.txt.includes("key …" + KEY.slice(-4)) && !a.html && a.key === "" && /pictures/.test(a.txt) && /video/.test(a.txt) && /LLM/.test(a.txt), a);
    check("…'Added UI Test. Styles: API_UI Test pictures, API_UI Test video'", /Added UI Test\. Styles: API_UI Test pictures, API_UI Test video/.test(a.say), a.say);
    await page.waitForFunction(() => [...document.querySelectorAll("#styleSel option")].some((o) => o.textContent === "API_UI Test pictures"), null, { timeout: 15000 });
    const lists = await ev(() => fetch("/api/styles?kind=video").then((r) => r.json()).then((j) => ({ vids: (j.styles || []).map((s) => s.name), img: [...document.querySelectorAll("#styleSel option")].map((o) => o.textContent) })));
    check("…the prompt docker's picture styles list API_UI Test pictures at once; the video styles have API_UI Test video", lists.img.includes("API_UI Test pictures") && lists.vids.includes("API_UI Test video"), lists);
    let cs = ""; try { cs = fs.readFileSync(path.join(ROOT, "custom.settings"), "utf8"); } catch { cs = ""; }
    let kj = ""; try { kj = fs.readFileSync(path.join(ROOT, "settings", "keys.json"), "utf8"); } catch { kj = ""; }
    check("…the key kept encrypted in settings/keys.json (apis.<id>.key), not in custom.settings", !cs.includes(KEY) && new RegExp('"apis\\.' + apiId + '\\.key": "v1:').test(kj) && !kj.includes(KEY), { inCustom: cs.includes(KEY) });

    // ✓ Test
    await page.click(`#apiList [data-api="${apiId}"] [data-act="test"]`);
    await page.waitForFunction((id) => /OpenRouter accepted the key|✗/.test(document.querySelector(`#apiList [data-api="${id}"] [data-line]`).textContent), apiId, { timeout: 15000 });
    const tl = await ev((id) => document.querySelector(`#apiList [data-api="${id}"] [data-line]`).textContent, apiId);
    check("✓ Test: asks OpenRouter (/key with the key) -> '✓ OpenRouter accepted the key'", /✓ OpenRouter accepted the key/.test(tl) && seen.some((x) => /^GET \/or\/key Bearer sk-or-v1-UI757/.test(x)), { tl, seen });

    // render a picture with the API_ style - no ComfyUI
    const style = await ev(() => fetch("/api/styles?kind=image").then((r) => r.json()).then((j) => j.styles.find((s) => s.name === "API_UI Test pictures")));
    const job = await ev((sid) => fetch("/api/genimage", { method: "POST", headers: { "Content-Type": "application/json", "X-Models-Check": "skip" }, body: JSON.stringify({ prompt: "a ui757 fox", style_id: sid, seed: 5 }) }).then((r) => r.json()), style.id);
    let jj = null;
    for (let i = 0; i < 60; i++) { await sleep(500); jj = await ev((id) => fetch("/api/jobs/" + id).then((r) => r.json()), job.id); if (jj && /done|error|failed|cancelled/.test(jj.status)) break; }
    const logTxt = (jj && (jj.log || []).join("\n")) || "";
    const outs = (jj && (jj.outputs || (jj.output ? [jj.output] : []))) || [];
    check("a picture with API_UI Test pictures: the job runs on the service (misc/api_worker.py -> the stand-in's /images with the prompt + the model), done, the picture saved",
      jj && jj.status === "done" && /\[api\] OpenRouter \(UI Test\) · image · model google\/gemini-2\.5-flash-image/.test(logTxt) && /nothing runs on this computer's graphics card/.test(logTxt)
      && seen.some((x) => /^POST \/or\/images .*"prompt": ?"a ui757 fox"/.test(x) && /"model": ?"google\/gemini-2\.5-flash-image"/.test(x)), { status: jj && jj.status, log: logTxt.slice(-900), outs });
    check("…no ComfyUI in it: no [comfy] line, no free-VRAM hand-over", !/\[comfy\]/.test(logTxt) && !/queued prompt|ComfyUI/i.test(logTxt.replace(/no ComfyUI/g, "")), logTxt.slice(-600));

    // Settings ▸ Image: Runs on ◉ API
    const ro = await ev((sid) => {
      document.querySelector('#settings .stabs [data-stab="image"]').click();
      return fetch("/api/styles?kind=image").then((r) => r.json()).then((j) => new Promise((done) => {
        paintStyleForm(j.styles.find((x) => x.id === sid));      // the Image tab's own form painter
        setTimeout(() => {
          const r = document.querySelector('input[name="s_strunson"]:checked');
          done({ v: r && r.value, choices: [...document.querySelectorAll('input[name="s_strunson"]')].map((i) => i.value), api: document.getElementById("s_stapiid") && document.getElementById("s_stapiid").value,
            shown: document.getElementById("s_stapi") && document.getElementById("s_stapi").style.display, model: document.getElementById("s_stapimodel") && document.getElementById("s_stapimodel").value,
            opts: document.getElementById("s_stapiid") ? [...document.getElementById("s_stapiid").options].map((o) => o.textContent) : [] });
        }, 1500);
      }));
    }, style.id);
    check("Settings ▸ Image, the API_ style: Runs on ◉ This computer ◉ Remote GPU ◉ API - API picked, this API in the list, its model",
      ro.choices.join() === "local,remote,api,pod" && ro.v === "api" && ro.api === apiId && ro.shown === "flex" && ro.model === "google/gemini-2.5-flash-image" && ro.opts.some((o) => /UI Test \(OpenRouter\)/.test(o)), ro);
    await ev(() => document.querySelector('#settings .stabs [data-stab="api"]').click());

    // Use for the LLM
    await page.click(`#apiList [data-api="${apiId}"] [data-act="llm"]`);
    await page.waitForFunction((id) => /The LLM now runs on OpenRouter/.test(document.querySelector(`#apiList [data-api="${id}"] [data-line]`).textContent), apiId, { timeout: 10000 });
    const llm = await ev(() => fetch("/api/apis").then((r) => r.json()));
    check("Use for the LLM: 'The LLM now runs on OpenRouter (google/gemini-2.5-flash)'", llm.apis[0].llm === true, llm.apis[0]);
    await page.click(`#apiList [data-api="${apiId}"] [data-act="llm"]`);
    await sleep(600);

    // untick Use
    await page.click(`#apiList [data-api="${apiId}"] [data-act="use"]`);
    await page.waitForFunction((id) => /Use is off/.test(document.querySelector(`#apiList [data-api="${id}"] [data-line]`).textContent), apiId, { timeout: 10000 });
    await page.waitForFunction(() => ![...document.querySelectorAll("#styleSel option")].some((o) => o.textContent === "API_UI Test pictures"), null, { timeout: 15000 });
    check("untick Use: 'Use is off - its API_ styles were removed', gone from the prompt docker's list", true);

    // ✕ Remove asks first
    await page.click(`#apiList [data-api="${apiId}"] [data-act="del"]`);
    const ask = await ev((id) => document.querySelector(`#apiList [data-api="${id}"] [data-act="del"]`).textContent, apiId);
    await page.click(`#apiList [data-api="${apiId}"] [data-act="del"]`);
    await page.waitForFunction(() => /No APIs yet/.test(document.getElementById("apiList").textContent), null, { timeout: 10000 });
    let kj2 = ""; try { kj2 = fs.readFileSync(path.join(ROOT, "settings", "keys.json"), "utf8"); } catch { kj2 = ""; }
    check("✕ asks '✕ Remove?' first, then the API is gone - its key out of keys.json too", ask === "✕ Remove?" && !kj2.includes("apis." + apiId), ask);
    apiId = null;

    // Claude (Tim: "can we add claude as well?") - the LLM only
    await page.fill("#apiKey", CKEY);
    const ch = await ev(() => document.getElementById("apiHint").textContent);
    await page.fill("#apiName", "Claude");
    await page.click("#apiAdd");
    await page.waitForFunction(() => document.querySelector("#apiList [data-api]"), null, { timeout: 15000 });
    const c = await ev(() => { const r = document.querySelector("#apiList [data-api]"); return { id: r.dataset.api, txt: r.textContent, llm: r.querySelector('[data-act="llm"]').checked, say: document.getElementById("apiSay").textContent }; });
    apiId = c.id;
    check("Claude: an sk-ant- key 'Looks like Claude (Anthropic)'; + Add with Use = Use for the LLM ticked, no styles, 'The LLM now runs on Claude (Anthropic) (claude-sonnet-5-5)'",
      /Looks like Claude \(Anthropic\)/.test(ch) && c.llm && /Claude \(Anthropic\)/.test(c.txt) && /LLM/.test(c.txt) && !/pictures/.test(c.txt) && /The LLM now runs on Claude \(Anthropic\) \(claude-sonnet-5-5\)/.test(c.say) && !/Styles:/.test(c.say), { ch, c });
    await page.click(`#apiList [data-api="${apiId}"] [data-act="test"]`);
    await page.waitForFunction((id) => /accepted the key|✗/.test(document.querySelector(`#apiList [data-api="${id}"] [data-line]`).textContent), apiId, { timeout: 15000 });
    check("…✓ Test asks Anthropic's /v1/models (x-api-key + anthropic-version) -> '✓ Claude (Anthropic) accepted the key'",
      /✓ Claude \(Anthropic\) accepted the key/.test(await ev((id) => document.querySelector(`#apiList [data-api="${id}"] [data-line]`).textContent, apiId)));
    const chat = await ev(() => fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "ui757 hello claude" }) }).then((r) => r.json()));
    check("…the prompt chat answers from Claude: Bearer key, claude-sonnet-5-5, NO temperature / top_p (Claude 5 refuses them), max_tokens room for its thinking (>= 2048)",
      /Hello from the Claude stand-in/.test(chat.reply || "") && claudeBody && claudeBody.model === "claude-sonnet-5-5" && !("temperature" in claudeBody) && !("top_p" in claudeBody) && claudeBody.max_tokens >= 2048
      && claudeBody.messages.some((m) => /ui757 hello claude/.test(typeof m.content === "string" ? m.content : JSON.stringify(m.content))), { chat, claudeBody });
    await fetch(URL0 + "api/apis/" + apiId, { method: "DELETE" }); apiId = null;
    await ev(() => window.H3Apis.refresh());
    if (process.env.SHOT) {
      await ev(() => document.querySelector('#settings .stabs [data-stab="api"]').click());
      await page.fill("#apiKey", KEY); await page.fill("#apiName", "OpenRouter"); await page.click("#apiAdd");
      await page.waitForFunction(() => document.querySelector("#apiList [data-api]"), null, { timeout: 15000 });
      await page.locator("#settings").screenshot({ path: process.env.SHOT });
      apiId = await ev(() => document.querySelector("#apiList [data-api]").dataset.api);
    }
    check("no page errors", errs.length === 0, errs);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  if (apiId) await fetch(URL0 + "api/apis/" + apiId, { method: "DELETE" }).catch(() => {});
  await browser.close(); or.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
