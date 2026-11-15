#!/usr/bin/env node
/* bitGen Studio — 2.795.0 browser test: 🧩 MODEL MANAGER ▸ ＋ ADD SOURCE (static/mmapisrc.js, lib/apiSources.js) + the docker named GPU,
 * on a running studio (H3_URL) with this test's stand-in OpenAI-compatible API on 127.0.0.1:8392 (/v1/models, /v1/chat/completions).
 *   ＋ Add source -> its tab + the ⚙ dialog; URL + key, ✓ Test lists the models and fills the endpoint; Save -> the tab lists the API's
 *   models; ＋ one; the prompt docker's LLM list has "🔌 Groq · your models"; picking it -> a chat goes to the stand-in with the key.
 * No server / no Playwright / 8392 busy = SKIP. Put back afterwards (the source removed, the LLM pick cleared). */
"use strict";
const path = require("path"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.795.0 browser test did not run"); process.exit(0); }
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b, m) => fetch(URL0 + p.replace(/^\//, ""), b || m ? { method: m || "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) } : undefined).then((r) => r.json());

const seen = [];
const srv = http.createServer((q, r) => {
  let body = ""; q.on("data", (d) => (body += d)); q.on("end", () => {
    seen.push({ url: q.url, auth: q.headers.authorization || "", body });
    r.setHeader("Content-Type", "application/json");
    if (q.headers.authorization !== "Bearer sk-test-795") { r.statusCode = 401; return r.end('{"error":"bad key"}'); }
    if (q.url === "/v1/models") return r.end(JSON.stringify({ object: "list", data: [{ id: "llama-3.3-70b-versatile" }, { id: "qwen2.5-vl-7b" }, { id: "dall-e-3" }] }));
    if (q.url === "/v1/chat/completions") return r.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Hello from the stand-in source." } }] }));
    r.statusCode = 404; r.end("{}");
  });
});

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.795.0 browser test did not run"); process.exit(0); }
  try { await new Promise((ok, bad) => { srv.once("error", bad); srv.listen(8392, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8392 is busy - the 2.795.0 browser test did not run"); process.exit(0); }
  const b = await chromium.launch();
  let sid = "";
  try {
    const p = await b.newPage({ viewport: { width: 1500, height: 1000 } }); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3ApiSrc && window.H3ModelMgr && document.getElementById("tRgen"), null, { timeout: 30000 });
    await sleep(1500);
    check("the status bar's docker button is GPU, its window is called GPU", (await p.evaluate(() => document.getElementById("tRgen").textContent.trim())) === "GPU"
      && (await p.evaluate(() => { const w = window.SecFloat && SecFloat.windows && SecFloat.windows.rgen; return !!w && /GPU/.test(JSON.stringify(w.title || (w.el && w.el.querySelector(".sftitle, .title") || {}).textContent || "GPU")); })));
    await p.evaluate(() => H3ModelMgr.show(true)); await sleep(1500);
    await p.click("#mmAddSrc"); await sleep(1200);
    const st = await p.evaluate(() => ({ tab: H3ModelMgr.state().tab, open: !!(document.getElementById("srcDlg") || {}).open, tabs: Array.from(document.querySelectorAll("#mmSrcTabs [data-mmtab]")).map((x) => x.textContent) }));
    sid = (st.tab || "").slice(4);
    check("＋ Add source: a 🔌 Source N tab, open, and its ⚙ dialog", /^src:/.test(st.tab) && st.open && st.tabs.some((t) => /🔌 Source \d/.test(t)), st);
    await p.fill("#srName", "Groq");
    await p.fill("#srUrl", "http://127.0.0.1:8392/v1");
    await p.fill("#srKey", "sk-test-795");
    await p.click("#srTest");
    await p.waitForFunction(() => /✓ 3 models/.test((document.getElementById("srMsg") || {}).textContent || ""), null, { timeout: 15000 }).catch(() => null);
    await p.selectOption("#srModel", "llama-3.3-70b-versatile");
    const dl = await p.evaluate(() => ({ msg: document.getElementById("srMsg").textContent, n: document.getElementById("srModel").options.length, ep: document.getElementById("srEndpoint").value }));
    check("✓ Test: the API's 3 models in the Model list; the endpoint filled in from the URL + the model", /✓ 3 models/.test(dl.msg) && dl.n === 3 && dl.ep === "http://127.0.0.1:8392/v1/chat/completions", dl);
    await p.click("#srSave"); await sleep(1800);
    const tab = await p.evaluate(() => ({ open: !!(document.getElementById("srcDlg") || {}).open, rows: document.querySelectorAll("#srRows [data-sradd]").length, tabs: Array.from(document.querySelectorAll("#mmSrcTabs [data-mmtab]")).map((x) => x.textContent), hint: (document.querySelector("#mmApiSrc .hint") || {}).textContent || "" }));
    check("Save: the dialog closes, the tab is 🔌 Groq and lists the API's models (＋ each), the key shown as its last 4 only", !tab.open && tab.tabs.includes("🔌 Groq") && tab.rows === 3 && /key …-795/.test(tab.hint) && !/sk-test-795/.test(JSON.stringify(await api("/api/sources"))), tab);
    const kinds = await p.evaluate(() => Array.from(document.querySelectorAll("#srRows [data-srkind]")).map((s) => s.dataset.srkind + "=" + s.value));
    check("each model's type guessed (LLM / Vision LLM / Image)", kinds.join() === "llama-3.3-70b-versatile=llm,qwen2.5-vl-7b=vlm,dall-e-3=image", kinds);
    await p.click('#srRows [data-sradd="llama-3.3-70b-versatile"]'); await sleep(1500);
    check("＋: it is one of yours (🗑 to take it off)", (await p.evaluate(() => document.querySelectorAll('#srRows [data-srdel="llama-3.3-70b-versatile"]').length)) === 1);
    await sleep(1000);
    const grp = await p.evaluate(() => { const s = document.getElementById("llmSel"); const g = s && s.querySelector("optgroup[data-src]"); return g ? { label: g.label, opts: Array.from(g.querySelectorAll("option")).map((o) => o.value) } : null; });
    check("the prompt docker's LLM list: 🔌 Groq · your models with Groq/<model>", grp && grp.label === "🔌 Groq · your models" && grp.opts.join() === "Groq/llama-3.3-70b-versatile", grp);
    await p.evaluate(() => { const s = document.getElementById("llmSel"); s.value = "Groq/llama-3.3-70b-versatile"; s.dispatchEvent(new Event("change", { bubbles: true })); });
    await sleep(1200);
    const mine = await api("/api/sources/mine");
    check("picked: the LLM = that source model (source_use)", mine.use && mine.use.llm && mine.use.llm.source === sid && mine.use.llm.model === "llama-3.3-70b-versatile", mine.use);
    const rh = await api("/api/remotehosts");
    check("🖥 GPU ▸ Runs on ▸ LLM's line names the source model", /🔌 Groq\/llama-3\.3-70b-versatile - a 🧩 Model manager source/.test(((rh.kinds || []).find((k) => k.k === "llm") || {}).note || ""), (rh.kinds || []).find((k) => k.k === "llm"));
    const n0 = seen.length;
    const ch = await api("/api/chat", { text: "say hello" });
    const call = seen.slice(n0).find((x) => x.url === "/v1/chat/completions");
    check("a chat goes to the source's endpoint with its key and the model; the reply comes back", call && call.auth === "Bearer sk-test-795" && /"model":"llama-3.3-70b-versatile"/.test(call.body) && /Hello from the stand-in source/.test(JSON.stringify(ch)), { call, ch: JSON.stringify(ch).slice(0, 300) });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the test crashed: " + e.message, false); }
  finally {
    await api("/api/sources/use", { kind: "llm" }).catch(() => {});
    if (sid) await api("/api/sources/" + sid, {}, "DELETE").catch(() => {});
    for (const s of ((await api("/api/sources").catch(() => ({}))).sources || [])) if (/^(Groq|Source \d+)$/.test(s.name)) await api("/api/sources/" + s.id, {}, "DELETE").catch(() => {});
    await b.close(); srv.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
