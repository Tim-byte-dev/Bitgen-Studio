#!/usr/bin/env node
/* bitGen Studio — 2.795.0 units: 🧩 MODEL MANAGER ▸ ＋ ADD SOURCE (lib/apiSources.js, routes/apiSources.js, static/mmapisrc.js) and the
 * docker renamed GPU. Pure + a stand-in core + three stand-in model APIs on localhost (OpenAI-compatible, Ollama, Anthropic-style)
 * + source pins - no studio. */
"use strict";
const path = require("path"), fs = require("fs"), http = require("http");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// a stand-in core (the config in memory) - lib/apiSources.js only reads / writes the config through it
let CFG = {};
const corePath = require.resolve("../lib/core");
require.cache[corePath] = { id: corePath, filename: corePath, loaded: true, exports: { getConfig: () => CFG, setConfig: (c) => { CFG = JSON.parse(JSON.stringify(c)); } } };
const AS = require("../lib/apiSources");

(async () => {
  // ---- pure
  check("normUrl: no trailing / or /v1 (the templates add them)", AS.normUrl(" https://api.together.xyz/v1/ ") === "https://api.together.xyz" && AS.normUrl("http://localhost:11434") === "http://localhost:11434");
  const oa = { format: "openai", url: "https://api.groq.com/openai", key: "gsk_123456" };
  check("endpointFor: OpenAI-compatible = {url}/v1/chat/completions; the list {url}/v1/models", AS.endpointFor(oa, "llama-3.3-70b") === "https://api.groq.com/openai/v1/chat/completions" && AS.listUrl(oa) === "https://api.groq.com/openai/v1/models");
  const ol = { format: "ollama", url: "http://localhost:11434" };
  check("Ollama: the list /api/tags, the chat its OpenAI door, no key", AS.listUrl(ol) === "http://localhost:11434/api/tags" && AS.endpointFor(ol, "qwen3:8b") === "http://localhost:11434/v1/chat/completions" && JSON.stringify(AS.headersFor(ol)) === "{}");
  const an = { format: "anthropic", url: "https://api.anthropic.com", key: "sk-ant-x1234" };
  check("Anthropic-style: the list with x-api-key + anthropic-version, the chat (its OpenAI door) with Bearer", AS.headersFor(an, true)["x-api-key"] === "sk-ant-x1234" && AS.headersFor(an, true)["anthropic-version"] === "2023-06-01" && AS.headersFor(an, false).Authorization === "Bearer sk-ant-x1234");
  const cu = { format: "custom", url: "https://my.host/api", chat_tpl: "{url}/models/{model}/chat", list_tpl: "{url}/list", auth: "x-api-key", key: "k9" };
  check("Custom template: {url} + {model} filled in (a / in the model kept), its key header", AS.endpointFor(cu, "org/m 1") === "https://my.host/api/models/org/m%201/chat" && AS.listUrl(cu) === "https://my.host/api/list" && AS.headersFor(cu)["x-api-key"] === "k9");
  check("headersFor: Bearer for OpenAI-compatible; none without a key", AS.headersFor(oa).Authorization === "Bearer gsk_123456" && JSON.stringify(AS.headersFor({ format: "openai" })) === "{}");
  check("parseList: OpenAI data[], Ollama models[], a plain array; duplicates once, display_name kept", JSON.stringify(AS.parseList({ data: [{ id: "a" }, { id: "b", display_name: "B!" }, { id: "a" }] })) === JSON.stringify([{ id: "a", name: "a" }, { id: "b", name: "B!" }])
    && AS.parseList({ models: [{ name: "qwen3:8b" }] })[0].id === "qwen3:8b" && AS.parseList(["x", "y"]).length === 2 && AS.parseList(null).length === 0);
  const g = (x) => AS.kindGuess(x);
  check("kindGuess: LLM / Vision LLM / Image / Video from the name", g("llama-3.3-70b-versatile") === "llm" && g("qwen2.5-vl-72b") === "vlm" && g("gpt-4o-mini") === "vlm" && g("dall-e-3") === "image" && g("black-forest-labs/FLUX.1-schnell") === "image" && g("veo-3.1") === "video" && g("Wan2.2-T2V") === "video" && g("deepseek-chat") === "llm", ["llama", "qwen2.5-vl", "gpt-4o", "dall-e", "flux", "veo", "wan", "deepseek"].map(g));
  const c1 = AS.cleanSource({ name: "Groq", format: "openai", url: "https://api.groq.com/openai/v1/", key: "abc" }, null);
  check("cleanSource: a new source (name, format, url cleaned, key)", c1.name === "Groq" && c1.format === "openai" && c1.url === "https://api.groq.com/openai" && c1.key === "abc" && c1.auth === "bearer");
  const c2 = AS.cleanSource({ key: "" }, c1), c3 = AS.cleanSource({ format: "ollama" }, c1), c4 = AS.cleanSource({ clear_key: 1 }, c1);
  check("cleanSource: an empty key keeps the one kept; a format change resets the key header; clear_key empties it", c2.key === "abc" && c3.auth === "none" && c3.format === "ollama" && c4.key === "");
  const v = AS.view("s1", c1);
  check("view: never the key (has_key + its last 4)", !("key" in v) && v.has_key === true && v.key_tail === "…abc" && v.chat_tpl_used === "{url}/v1/chat/completions");
  check("mineOf: <source name>/<model> refs", JSON.stringify(AS.mineOf({ s1: { name: "Groq", models: [{ id: "m1", kind: "llm" }] } })) === JSON.stringify([{ source: "s1", name: "Groq", model: "m1", kind: "llm", ref: "Groq/m1" }]));
  const t = AS.targetOf(an, "claude-sonnet-4", "llm");
  check("targetOf: the chat target (url, model, headers, label); Anthropic-style keeps room for the answer", t.url === "https://api.anthropic.com/v1/chat/completions" && t.model === "claude-sonnet-4" && t.headers.Authorization === "Bearer sk-ant-x1234" && t.min_tokens === 1024 && /Model manager source/.test(t.label));

  // ---- three stand-in APIs
  const seen = [];
  const srv = http.createServer((q, r) => {
    seen.push({ url: q.url, auth: q.headers.authorization || "", xk: q.headers["x-api-key"] || "", av: q.headers["anthropic-version"] || "" });
    r.setHeader("Content-Type", "application/json");
    if (q.url === "/oa/v1/models") { if (q.headers.authorization !== "Bearer sk-good") { r.statusCode = 401; return r.end('{"error":"bad key"}'); } return r.end(JSON.stringify({ data: [{ id: "llama-3.3-70b" }, { id: "qwen2.5-vl-7b" }, { id: "flux-schnell" }] })); }
    if (q.url === "/api/tags") return r.end(JSON.stringify({ models: [{ name: "qwen3:8b" }, { name: "llava:13b" }] }));
    if (q.url === "/an/v1/models") { if (q.headers["x-api-key"] !== "sk-ant" || !q.headers["anthropic-version"]) { r.statusCode = 401; return r.end("{}"); } return r.end(JSON.stringify({ data: [{ id: "claude-sonnet-4", display_name: "Claude Sonnet 4" }] })); }
    r.statusCode = 404; r.end("{}");
  });
  await new Promise((ok) => srv.listen(0, "localhost", ok));
  const base = "http://localhost:" + srv.address().port;
  try {
    const a = AS.add({});
    check("add: a new source 'Source 1' (OpenAI-compatible) - its tab", a.id && a.sources.length === 1 && a.sources[0].name === "Source 1" && a.sources[0].format === "openai");
    let e1 = null; try { AS.add({ name: "openrouter" }); } catch (e) { e1 = e.message; }
    check("add: a name bitGen's lists already use (openrouter …) is refused", /already used by bitGen/.test(e1 || ""), e1);
    const u = AS.update(a.id, { name: "Groq", url: base + "/oa/v1", key: "sk-bad" });
    check("update: named, URL cleaned, the key kept encrypted later (secrets: sources.<id>.key is a key path)", u.sources[0].name === "Groq" && u.sources[0].url === base + "/oa" && CFG.sources[a.id].key === "sk-bad"
      && require("../lib/secrets").isKeyPath("sources." + a.id + ".key") && require("../lib/secrets").pathsOf(CFG).includes("sources." + a.id + ".key"));
    let e2 = null; try { await AS.models(a.id, true); } catch (e) { e2 = e.message; }
    check("models: a wrong key = the API's 401 said, with what to check", /answered HTTP 401/.test(e2 || "") && /check the API key/.test(e2 || ""), e2);
    const tst = await AS.test({ id: a.id, key: "sk-good" });
    check("test: the dialog's values (the typed key) - count, the models, the endpoint filled in", tst.count === 3 && tst.models.join() === "llama-3.3-70b,qwen2.5-vl-7b,flux-schnell" && tst.endpoint === base + "/oa/v1/chat/completions", tst);
    AS.update(a.id, { key: "sk-good" });
    const m = await AS.models(a.id, true);
    check("models: the API's list, each with its type guess and the endpoint filled in; kept (list_at)", m.list.length === 3 && m.list[1].kind === "vlm" && m.list[2].kind === "image" && m.list[0].endpoint === base + "/oa/v1/chat/completions" && CFG.sources[a.id].list.length === 3 && m.list_at > 0, m.list);
    AS.setMine(a.id, { model: "llama-3.3-70b", kind: "llm" }); AS.setMine(a.id, { model: "qwen2.5-vl-7b" });
    const mine = AS.mine().mine;
    check("setMine: ＋ to yours (the type given or guessed); mine() = Groq/<model>", mine.length === 2 && mine[0].ref === "Groq/llama-3.3-70b" && mine[1].kind === "vlm", mine);
    let e3 = null; try { AS.use("llm", a.id, "flux-schnell"); } catch (e) { e3 = e.message; }
    check("use: only a model of yours", /not one of Groq's models of yours/.test(e3 || ""), e3);
    const us = AS.use("llm", a.id, "llama-3.3-70b");
    const tg = AS.llmTarget("llm");
    check("use + llmTarget: the chat goes to the endpoint bitGen filled in, with the key", us.endpoint === base + "/oa/v1/chat/completions" && tg.url === base + "/oa/v1/chat/completions" && tg.model === "llama-3.3-70b" && tg.headers.Authorization === "Bearer sk-good" && AS.llmTarget("vlm") === null, tg);
    AS.clearUse("llm");
    check("clearUse: back to the list's own choice", AS.llmTarget("llm") === null);
    const b = AS.add({ name: "Home Ollama", format: "ollama" }); AS.update(b.id, { url: base });
    const mb = await AS.models(b.id, true);
    check("Ollama: /api/tags read, no key sent", mb.list.map((x) => x.id).join() === "qwen3:8b,llava:13b" && mb.list[1].kind === "vlm" && seen.filter((x) => x.url === "/api/tags").every((x) => !x.auth));
    const c = AS.add({ name: "Claude", format: "anthropic" }); AS.update(c.id, { url: base + "/an", key: "sk-ant" });
    const mc = await AS.models(c.id, true);
    check("Anthropic-style: x-api-key + anthropic-version on the list, display_name kept", mc.list[0].id === "claude-sonnet-4" && mc.list[0].name === "Claude Sonnet 4" && seen.some((x) => x.url === "/an/v1/models" && x.xk === "sk-ant" && x.av));
    AS.use("vlm", a.id, "qwen2.5-vl-7b");
    const r = AS.remove(a.id);
    check("remove: the source, its key and its picks go", r.sources.length === 2 && !CFG.sources[a.id] && !(CFG.source_use || {}).vlm);
    AS.setMine(b.id, { model: "qwen3:8b" }); AS.use("llm", b.id, "qwen3:8b"); AS.setMine(b.id, { model: "qwen3:8b", add: false });
    check("setMine add:false: off yours, its pick ends", AS.llmTarget("llm") === null && AS.mine().mine.length === 0);
  } finally { srv.close(); }

  // ---- the page (pure)
  const P = require("../static/mmapisrc.js");
  check("tabsHtml: 🔌 <name> per source, data-mmtab src:<id>, the open one on", /data-mmtab="src:s1"/.test(P.tabsHtml([{ id: "s1", name: "Groq", format_name: "OpenAI-compatible", url: "x" }], "src:s1")) && /class="ghost on"/.test(P.tabsHtml([{ id: "s1", name: "Groq", format_name: "f" }], "src:s1")));
  const rows = P.rowsHtml({ models: [{ id: "a", kind: "llm" }], list: [{ id: "a", kind: "llm" }, { id: "b", kind: "image", endpoint: "E" }, { id: "c", kind: "llm" }] }, "", "", 1);
  check("rowsHtml: yours first (🗑), the API's others (type + ＋, the endpoint on hover), 'N more' past the limit", /data-srdel="a"/.test(rows) && /data-sradd="b"/.test(rows) && !/data-sradd="a"/.test(rows) && /Endpoint: E/.test(rows) && /1 more/.test(rows));
  const dh = P.dialogHtml({ name: "Groq", format: "custom", url: "https://h", has_key: true, key_tail: "…1234", chat_tpl: "{url}/x/{model}", list: [{ id: "m1" }] }, [{ id: "openai", name: "OpenAI-compatible", chat: "{url}/v1/chat/completions" }, { id: "custom", name: "Custom template" }]);
  check("dialogHtml: name, format, URL, the key never shown (kept …1234), custom templates, Model + the endpoint filled in, ✓ Test / Save", /id="srUrl" value="https:\/\/h"/.test(dh) && /kept \(…1234\)/.test(dh) && !/id="srCustom" style/.test(dh) && /id="srEndpoint" readonly value="https:\/\/h\/x\/m1"/.test(dh) && /id="srTest"/.test(dh) && /id="srSave"/.test(dh));
  check("groupOf: the LLM list takes LLM + vision models, the Vision list the vision ones", P.groupOf([{ kind: "llm" }, { kind: "vlm" }, { kind: "image" }], "llm").length === 2 && P.groupOf([{ kind: "llm" }, { kind: "vlm" }], "vlm").length === 1);

  // ---- wiring
  const GS = src("lib/gpuSplit.js"), RH = src("lib/remoteHosts.js"), RI = src("routes/index.js"), MM = src("static/modelmgr.js"), IX = src("static/index.html");
  check("gpuSplit.llmTarget asks the picked source first", GS.indexOf('require("./apiSources").llmTarget(kind)') > 0 && GS.indexOf('require("./apiSources").llmTarget(kind)') < GS.indexOf('require("./apis").llmTarget(kind)'));
  check("a Runs on choice for the LLMs ends a source pick; the row's line says the source", /require\("\.\/apiSources"\)\.clearUse\(k\)/.test(RH) && /function srcNote\(kind\)/.test(RH));
  check("routes mounted from routes/index.js (not server.js); index.html loads mmapisrc.js", /require\("\.\/apiSources"\)\.mount\(app\)/.test(RI) && /<script src="\/static\/mmapisrc\.js"><\/script>/.test(IX) && !/apiSources/.test(src("misc/server.js")));
  check("Model manager: ＋ Add source + the sources' tabs (#mmSrcTabs), a src:<id> tab drawn by H3ApiSrc, every tab button lit by data-mmtab", /id="mmAddSrc"/.test(MM) && /id="mmSrcTabs"/.test(MM) && /window\.H3ApiSrc\.render\(\$\("mmApiSrc"\), S\.tab\.slice\(4\)/.test(MM) && /querySelectorAll\("\.mmgr \[data-mmtab\]"\)/.test(MM));
  // the rename (Tim: "change the name of the remote docker to GPU seeing as we use local and remote together")
  check("the docker is called GPU (its window + the status bar's button)", /SecFloat\.add\(\{ id: "rgen", title: "GPU",/.test(src("static/remotedock.js")) && /btn\("tRgen", "GPU", "GPU docker/.test(src("static/remotebtns.js")));
  check("no '☁ Remote generation docker' / '☁ Remote generation ▸' left in what the page or the server says", !/☁ Remote generation (docker|▸)/.test(["static/remotehosts.js", "static/openrouter.js", "static/remotegpu.js", "lib/orRender.js", "lib/llmChat.js", "lib/remoteModels.js", "routes/remotePrep.js", "lib/gpuSplit.js"].map(src).join("\n")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
