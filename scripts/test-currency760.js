#!/usr/bin/env node
/* bitGen Studio — 2.760.0 units: Settings ▸ General ▸ Currency (lib/currency.js, routes/currency.js, static/currency.js), the
 * Audio docker (static/audiodock.js) and the PODS docker's 🖥 My pods view (static/podsdock.js).
 * Tim (verbatim): "put music stems and sfx as tabs in an new docker called audio, remove those buttons from the statusbar -
 * it is getting cluttered. in general tab add currency (AUD,USD,CNY,JPY)etc. convert to this currency when showing prices"
 * + "in pods docker add a button for my pods (only show my pods when this is clicked), when creating a pod hide all the
 * templates, after the pod is created only show my pods" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), http = require("http"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let CFG = {};
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: fs.mkdtempSync(path.join(os.tmpdir(), "cur760-")) };
require.cache[coreP] = fake;
const C = require("../lib/currency"), M = require("../static/currency.js"), A = require("../static/audiodock.js"), U = require("../lib/usageLog");

(async () => {
  /* ---- lib/currency.js */
  check("the currencies offered: USD, AUD, CNY, JPY … (the ones Tim named first)", ["USD", "AUD", "CNY", "JPY", "EUR", "GBP"].every((c) => C.CODES.includes(c)) && C.codeOf("aud") === "AUD" && C.codeOf("XYZ") === "");
  const v2 = C.parseRates([{ date: "2026-11-10", base: "USD", quote: "AUD", rate: 1.5321 }, { date: "2026-11-10", base: "USD", quote: "JPY", rate: 152.3 }, { date: "2026-11-10", base: "EUR", quote: "GBP", rate: 0.86 }, { base: "USD", quote: "ABC", rate: 2 }, { base: "USD", quote: "CNY", rate: -1 }]);
  check("parseRates: Frankfurter v2 (an array of {date, base, quote, rate}) - USD-based rows only, unknown / bad rates dropped, USD = 1",
    v2.rates.AUD === 1.5321 && v2.rates.JPY === 152.3 && !("GBP" in v2.rates) && !("ABC" in v2.rates) && !("CNY" in v2.rates) && v2.rates.USD === 1 && v2.date === "2026-11-10", v2);
  check("…and v1's shape ({date, rates})", C.parseRates({ date: "2026-11-09", rates: { AUD: 1.5, CNY: 7.1 } }).rates.CNY === 7.1 && C.parseRates({ date: "2026-11-09", rates: { AUD: 1.5 } }).date === "2026-11-09");
  const fx = { code: "AUD", manual: {}, rates: { AUD: 1.5 } };
  check("rateOf / convert: the fetched rate; a typed one wins; USD is 1; none known = null",
    C.rateOf(fx, "AUD") === 1.5 && C.convert(2, "AUD", fx) === 3 && C.rateOf({ manual: { AUD: 1.6 }, rates: { AUD: 1.5 } }, "AUD") === 1.6 && C.rateOf(fx, "USD") === 1 && C.rateOf(fx, "JPY") === null && C.convert(1, "JPY", fx) === null);
  check("tidy: bad codes / rates out, USD never typed, the code USD by default", JSON.stringify(C.tidy({ code: "zzz", manual: { USD: 2, AUD: "x", JPY: 150 }, rates: { AUD: 1.5, QQQ: 3 } })) === JSON.stringify({ code: "USD", manual: { JPY: 150 }, rates: { AUD: 1.5 }, date: "", at: 0 }));
  // the live part, against a stand-in rates service
  let hits = 0, lastUrl = "";
  const srv = http.createServer((q, s) => { hits++; lastUrl = q.url; s.setHeader("Content-Type", "application/json"); s.end(JSON.stringify([{ date: "2026-11-10", base: "USD", quote: "AUD", rate: 1.53 }, { date: "2026-11-10", base: "USD", quote: "CNY", rate: 7.12 }])); });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  process.env.H3_FX_API = "http://127.0.0.1:" + srv.address().port;
  let v = await C.get();
  check("GET with USD picked: no fetch, US dollars", v.code === "USD" && v.rate === 1 && v.source === "usd" && hits === 0, v);
  v = await C.set({ code: "AUD" });
  check("POST {code: AUD}: the day's rates fetched (base USD, every currency offered) and kept in config.fx", v.code === "AUD" && v.rate === 1.53 && v.source === "fetched" && v.date === "2026-11-10" && hits === 1
    && /^\/v2\/rates\?base=USD&quotes=AUD,EUR,GBP,CNY,JPY/.test(lastUrl) && CFG.fx.rates.CNY === 7.12 && CFG.fx.at > 0, { v, lastUrl, fx: CFG.fx });
  v = await C.get();
  check("…fetched at most every 12 hours (the next GET uses the kept rate)", hits === 1 && v.rate === 1.53);
  v = await C.set({ manual: "1.6" });
  check("a typed rate is used instead (source typed); blank = the fetched one again", v.rate === 1.6 && v.source === "typed" && (await C.set({ manual: "" })).rate === 1.53);
  let bad = null; try { await C.set({ code: "ABC" }); } catch (e) { bad = e; }
  check("an unknown currency is refused (400)", bad && bad.status === 400);
  srv.close();
  process.env.H3_FX_API = "http://127.0.0.1:9";
  CFG.fx.at = 1; v = await C.get();
  check("offline: the rates service unreachable - the kept rate stays", v.rate === 1.53 && v.source === "fetched");
  const r = await C.refresh();
  check("…↻ says why", r.ok === false && r.error.length > 0, r);
  check("usdIn: a remote GPU's US dollars in the bill's currency (unchanged for USD or a currency with no rate)", Math.abs(C.usdIn(2, "AUD") - 3.06) < 1e-9 && C.usdIn(2, "USD") === 2 && C.usdIn(2, "THB") === 2);
  /* ---- lib/usageLog.js */
  const e = U.entryFor({ id: "j1", status: "done", started: 1000, finished: 4600, params: { mode: "image" } }, { currency: "AUD" }, { mode: "runpod", label: "pod", cost_hr: 0.5 });
  check("usage log: a remote job's cost goes on the bill in the bill's currency (cost) with its US dollars (cost_usd)", e.remote.cost === 0.765 && e.remote.cost_usd === 0.5, e.remote);
  const e2 = U.entryFor({ id: "j2", status: "done", started: 1000, finished: 4600, params: {} }, { currency: "USD" }, { mode: "runpod", label: "pod", cost_hr: 0.5 });
  check("…in USD: the cost as it was, no cost_usd", e2.remote.cost === 0.5 && !("cost_usd" in e2.remote));
  check("routes/currency.js mounted from routes/index.js (not misc/server.js); GET / POST / refresh",
    /require\("\.\/currency"\)\.mount\(app\)/.test(rd("routes", "index.js")) && !/currency/.test(rd("misc", "server.js")) && ['"/api/currency"', '"/api/currency/refresh"'].every((x) => rd("routes", "currency.js").includes(x)));
  /* ---- static/currency.js */
  check("fmt: A$ / CN¥ / ¥ (no decimals) / $ - small amounts keep their cents", M.fmt(0.41, "AUD") === "A$0.41" && M.fmt(7.12, "CNY") === "CN¥7.12" && M.fmt(42.4, "JPY") === "¥42" && M.fmt(1.2, "USD") === "$1.20" && M.fmt(0.075, "USD") === "$0.075" && M.fmt(0.4, "JPY") === "¥0.40",
    [M.fmt(0.41, "AUD"), M.fmt(7.12, "CNY"), M.fmt(42.4, "JPY"), M.fmt(1.2, "USD"), M.fmt(0.075, "USD"), M.fmt(0.4, "JPY")]);
  const t = M.usdText(0.27, { code: "AUD", rate: 1.53, source: "fetched", date: "2026-11-10" }, "/h");
  check("usdText: the price in the picked currency, the dollars and the rate on hover", t.text === "A$0.41/h" && t.title === "$0.27/h · 1 USD = 1.53 AUD (2026-11-10)", t);
  check("…USD picked or no rate yet: US dollars (and why on hover)", M.usdText(0.27, { code: "USD", rate: 1 }, "/h").text === "$0.27/h" && /no JPY rate yet/.test(M.usdText(0.27, { code: "JPY", rate: null }).title));
  const H = rd("static", "index.html");
  check("Settings ▸ General: Currency (the list, 1 USD = [rate] for your own, ↻) before Energy cost; static/currency.js loaded",
    H.indexOf('id="s_cur"') > H.indexOf('id="stab-general"') && H.indexOf('id="s_cur"') < H.indexOf('id="s_kwh"') && /id="s_currate"/.test(H) && /id="s_curre"/.test(H) && /<script src="\/static\/currency\.js"><\/script>/.test(H)
    && ["AUD", "USD", "CNY", "JPY"].every((c) => new RegExp('id="s_cur"[\\s\\S]{0,600}<option>' + c + "</option>").test(H)));
  const PD = rd("static", "podsdock.js"), RG = rd("static", "remotegpu.js"), OR = rd("static", "openrouter.js");
  check("prices through H3Money: the PODS docker's GPUs, the price an hour, the pods; Remote generation's pods; OpenRouter's models",
    /esc\(money\(g\.price, "\/h"\)\)/.test(PD) && /"About " \+ money\(g\.price \* n\)/.test(PD) && /moneyHtml\(\+p\.cost_hr \|\| 0, "\/h"\)/.test(PD) && !/" · \$" \+/.test(PD)
    && /H3Money\.usdHtml\(\+p\.cost_hr \|\| 0, "\/h"\)/.test(RG) && /usd\(m\.in\) \+ " \/ " \+ usd\(m\.out\)/.test(OR) && /addEventListener\("h3:currency"/.test(PD));
  /* ---- the Audio docker */
  check("audiodock keep(): one showing = it; one just shown wins over the one before; the active tab when two come up at once; none = null",
    A.keep([], ["stemsdock"], "musicdock") === "stemsdock" && A.keep(["musicdock"], ["musicdock", "sfxdock"], "musicdock") === "sfxdock"
    && A.keep([], ["musicdock", "stemsdock"], "stemsdock") === "stemsdock" && A.keep([], ["musicdock", "stemsdock"], "sfxdock") === "musicdock"
    && A.keep(["musicdock", "stemsdock"], ["musicdock", "stemsdock"], "stemsdock") === "stemsdock" && A.keep([], [], "musicdock") === null);
  check("the statusbar: Music / Stems / SFX gone, one Audio button; static/audiodock.js loaded; no handler left for the old buttons",
    !/id="tMu"|id="tSt"|id="tSfx"/.test(H) && /<button id="tAu" title="Audio docker/.test(H) && /<script src="\/static\/audiodock\.js"><\/script>/.test(H) && !/\$\("tMu"\)|\$\("tSt"\)|\$\("tSfx"\)/.test(H));
  const W = require("../static/workspaces.js");
  check("workspaces: Basic / Image hide Audio; Music video opens the Audio docker on Music (one tab at a time - not stems too)",
    W.hidden("basic").includes("tAu") && W.hidden("image").includes("tAu") && !W.hidden("musicvideo").includes("tAu") && W.plan("musicvideo").bottom.musicdock === "open" && W.plan("musicvideo").bottom.stemsdock === "gone");
  check("voice chat: show music / stems / sfx = that tab of the Audio docker", /root\.H3Audio\.tab\(d\.el\)/.test(rd("static", "voicechat.js")));
  /* ---- the PODS docker */
  // 2.780.0: no template tabs any more - 🖥 My pods / 📦 Presets / ＋ Create pod, one view at a time
  check("PODS: 🖥 My pods tab; the views (pdMine), Create pod alone (pdMaking); a pod created -> My pods",
    /\["mine", "🖥 My pods"\]/.test(PD) && /classList\.toggle\("pdMine", S\.src === "mine"\)/.test(PD) && /classList\.toggle\("pdMaking", S\.src === "create"\)/.test(PD)
    && /go\("mine"\);\s+\/\/ 2\.760\.0: a pod created/.test(PD) && /\.pdk:not\(\.pdMine\) #pdMineBox\{display:none\}/.test(PD));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
