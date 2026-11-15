#!/usr/bin/env node
/* bitGen Studio — 2.786.0 units: OpenRouter models (lib/orModels.js), pictures / video on OpenRouter (lib/orRender.js), the
 * dropdown entries (static/ormine.js), the price box (static/orcost.js), the dialog's lists (static/ormodels.js) and Runs on
 * (lib/remoteHosts.js). Pure - no studio, no network. */
"use strict";
const path = require("path"), fs = require("fs");
const ROOT = path.join(__dirname, "..");
const OM = require("../lib/orModels"), ORR = require("../lib/orRender"), RH = require("../lib/remoteHosts");
const MINE = require("../static/ormine.js"), COST = require("../static/orcost.js"), DLG = require("../static/ormodels.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };

// ---- families
check("makerOf", OM.makerOf("Black-Forest-Labs/flux.2-pro") === "black-forest-labs");
check("familyLabel known + Title Case", OM.familyLabel("openai") === "OpenAI" && OM.familyLabel("bytedance-seed") === "ByteDance Seed" && OM.familyLabel("some-new_lab") === "Some New Lab");
const fam = OM.families([{ id: "google/a" }, { id: "google/b" }, { id: "openai/c" }]);
check("families: All first, then by count", fam[0].id === "all" && fam[0].n === 3 && fam[1].id === "google" && fam[1].n === 2 && fam[2].label === "OpenAI", fam);

// ---- prices
const lines = OM.pricesIn({ data: { endpoints: [{ provider: "x", pricing: [{ billable: "output_image", unit: "image", cost_usd: 0.04 }, { billable: "input_tokens", unit: "token", cost_usd: 0.000002 }] }] } });
check("pricesIn finds every pricing line, nested", lines.length === 2 && lines[0].usd === 0.04, lines);
check("imagePrice: the output image line", JSON.stringify(OM.imagePrice(lines)) === JSON.stringify({ usd: 0.04, unit: "image" }), OM.imagePrice(lines));
check("imagePrice: per megapixel", OM.imagePrice([{ billable: "output_image", unit: "megapixel", usd: 0.012 }]).unit === "megapixel");
const vp = OM.videoPrice({ "per-video-second": "0.50", "per-video-second-1080p": "0.75" });
check("videoPrice: per second, base sku, from", vp.usd === 0.5 && vp.unit === "second" && vp.skus["per-video-second-1080p"] === 0.75 && vp.from === true, vp);
check("priceText", OM.priceText({ usd: 0.04, unit: "image" }) === "$0.04 / image" && OM.priceText({ usd: 0.5, unit: "second", from: true }) === "from $0.5 / second"
  && OM.priceText({ free: true }) === "free" && OM.priceText({ in: 3, out: 15 }) === "$3 in / $15 out per M tokens", [OM.priceText({ usd: 0.04, unit: "image" }), OM.priceText({ usd: 0.5, unit: "second", from: true })]);

// ---- mapping
const im = OM.mapImage({ id: "bytedance-seed/seedream-4.5", supported_parameters: { aspect_ratio: { type: "enum", values: ["1:1", "16:9", "9:16"] }, input_references: { type: "range", min: 0, max: 14 }, n: { max: 4 } } },
  { name: "ByteDance Seed: Seedream 4.5", description: "makes  pictures" }, { usd: 0.04, unit: "image" });
check("mapImage: name from /models, caps, price", im.name === "ByteDance Seed: Seedream 4.5" && im.caps.refs === 14 && im.caps.aspect.length === 3 && im.price === "$0.04 / image" && im.maker === "bytedance-seed" && im.desc === "makes pictures", im);
const vm = OM.mapVideo({ id: "google/veo-3.1", name: "Google: Veo 3.1", supported_durations: [4, 6, 8], supported_aspect_ratios: ["16:9", "9:16"], pricing_skus: { "per-video-second": "0.40" } });
check("mapVideo: durations, price", vm.caps.durations.join() === "4,6,8" && vm.usd === 0.4 && vm.price === "$0.4 / second", vm);
check("mapText: vlm only takes vision models", OM.mapText({ id: "a/b", name: "B", vision: false }, "vlm") === null && OM.mapText({ id: "a/b", name: "B", vision: true, free: true }, "vlm").price === "free");

// ---- prune / snap / estimate
const pr = OM.prune([{ id: "a" }, { id: "b" }], ["a", "c"]);
check("prune: a model OpenRouter no longer lists is removed", pr.keep.length === 1 && pr.removed[0].id === "b");
check("snapDuration: nearest, a tie = the longer, none listed = the seconds", OM.snapDuration({ durations: [4, 6, 8] }, 5) === 6 && OM.snapDuration({ durations: [4, 6, 8] }, 3) === 4 && OM.snapDuration({}, 7.4) === 7);
check("snapAspect: nearest ratio", OM.snapAspect({ aspect: ["1:1", "16:9", "9:16"] }, 1280, 720) === "16:9" && OM.snapAspect({ aspect: ["1:1", "16:9", "9:16"] }, 900, 1000) === "1:1" && OM.snapAspect({}, 1, 1) === "");
const ve = OM.estimate(Object.assign({}, vm, OM.entryOf(vm)), { seconds: 5, w: 1280, h: 720 });
check("estimate video: 6 s × $0.4", ve.usd === 2.4 && /6 s/.test(ve.text), ve);
const ve2 = OM.estimate({ type: "video", usd: 0.5, unit: "second", skus: { "per-video-second": 0.5, "per-video-second-1080p": 0.75 }, caps: { durations: [4] } }, { seconds: 4, w: 1920, h: 1080 });
check("estimate video at 1080p takes its own price", ve2.usd === 3, ve2);
check("estimate image: n × price", OM.estimate({ type: "image", usd: 0.04, unit: "image" }, { n: 3 }).usd === 0.12);
check("estimate free = 0, unknown price = said after", OM.estimate({ free: true }, {}).usd === 0 && OM.estimate({ type: "image", usd: null, price: "paid" }, {}).usd === null);
check("entryOf keeps caps + price", (() => { const e = OM.entryOf(vm); return e.caps.durations.length === 3 && e.price === vm.price && e.type === "video" && e.added > 0; })());

// ---- orRender
check("idOf", ORR.idOf("openrouter/google/veo-3.1") === "google/veo-3.1" && ORR.idOf("OpenRouter/x/y") === "x/y" && ORR.idOf("flux.safetensors") === "" && ORR.idOf("openrouter/") === "");
const st = ORR.styleFor({ name: "My style", loras: [{ name: "a" }], workflow: "x.json", id: "s1", kind: "video" }, "video", OM.entryOf(vm), { w: 1280, h: 720, seconds: 5 });
check("styleFor: an API style copy - OpenRouter, the model, snapped length / aspect, no LoRAs / workflow",
  st.runs_on === "api" && st.api_id === "__openrouter" && st.api_model === "google/veo-3.1" && st.api_extra.duration === 6 && st.api_extra.aspect_ratio === "16:9" && !st.loras && !st.workflow && st.id === "s1", st);
const cfg = { rgpu: { openrouter: { key: "sk-or-x" } }, apis: { other: { key: "k" } } };
check("jobApis: only OpenRouter's key for an OpenRouter job", ORR.jobApis(cfg, { style: st }) && Object.keys(cfg.apis).join() === "__openrouter" && cfg.apis.__openrouter.service === "openrouter" && cfg.apis.__openrouter.key === "sk-or-x");
check("jobApis: another job untouched", !ORR.jobApis({ apis: {} }, { style: { name: "x" } }));
check("IGNORED words", ORR.IGNORED.image.includes("LoRAs") && ORR.IGNORED.video.includes("CFG"));

// ---- Runs on: OpenRouter makes pictures + video now
const opt = (k) => RH.optionsFor(k).find((o) => o.id === "openrouter");
check("Runs on: OpenRouter takes Image / Video / LLM, not Music", !opt("image").off && !opt("video").off && !opt("llm").off && opt("music").off);
const hs = RH.hostsOf({}, { where: "local" }, {}, () => "", { image: true, video: false });
check("hostsOf: rgpu.openrouter.runs puts Image on OpenRouter", hs.image === "openrouter" && hs.video === "local" && RH.whereFor(hs) === "both", hs);

// ---- the page's pure parts
check("ormine isOr / optionText", MINE.isOr("openrouter/a/b") && !MINE.isOr("openrouter/") && MINE.optionText({ id: "a/b", price: "$1 / image" }) === "openrouter/a/b · $1 / image");
const g = MINE.groupHtml([{ id: "a/b", price: "$1" }, { id: "c/d", free: true }], "openrouter/c/d");
check("ormine groupHtml: an optgroup, the current one known", /<optgroup label="☁ OpenRouter \(paid\)" data-or="1">/.test(g.html) && /value="openrouter\/a\/b"/.test(g.html) && g.has === true && MINE.groupHtml([], "").html === "");
check("orcost reqOf image", JSON.stringify(COST.reqOf("image", JSON.stringify({ model: "openrouter/x/y", batch: 2, width: 512, height: 768 }))) === JSON.stringify({ kind: "image", model: "openrouter/x/y", n: 2, w: 512, h: 768 }));
const rv = COST.reqOf("video", JSON.stringify({ basic: JSON.stringify({ override: true, model: "openrouter/v/m" }), frames: 144, width: 1280, height: 720 }));
check("orcost reqOf video: Basic Settings' model only with Override on, seconds from frames", rv.model === "openrouter/v/m" && rv.seconds === 6 && COST.reqOf("video", JSON.stringify({ basic: JSON.stringify({ override: false, model: "openrouter/v/m" }) })).model === "", rv);
const bt = COST.boxText({ id: "v/m", name: "Veo", estimate: { usd: 2.4, text: "about $2.40 (6 s × $0.4 a second)" }, why: "picked in Basic Settings", ignored: ["steps", "CFG"] });
check("orcost boxText", bt.title === "Render on OpenRouter - Veo" && /\$2\.40/.test(bt.cost) && /steps, CFG/.test(bt.ignored) && /Basic Settings/.test(bt.why), bt);
const L = [{ id: "google/a", name: "A", free: true }, { id: "openai/b", name: "B", usd: 0.1 }, { id: "openai/c", name: "C cheap", usd: 0.01, created: 5 }];
check("dialog filterList: family / free / paid / words", DLG.filterList(L, { fam: "openai" }).length === 2 && DLG.filterList(L, { paid: false }).length === 1 && DLG.filterList(L, { q: "cheap" })[0].id === "openai/c");
check("dialog sortList: cheapest / newest / free first", DLG.sortList(L, "price").map((m) => m.id).join() === "google/a,openai/c,openai/b" && DLG.sortList(L, "newest")[0].id === "openai/c" && DLG.sortList(L, "name")[0].free === true);
check("dialog typeLabel", DLG.typeLabel("vlm", 2) === "Vision LLM (2)" && DLG.typeLabel("image", 0) === "Image");

// ---- wired in
const idx = fs.readFileSync(path.join(ROOT, "routes", "index.js"), "utf8"), core = fs.readFileSync(path.join(ROOT, "lib", "core.js"), "utf8");
check("routes: mounted, genimage + generate hand OpenRouter models over", /require\("\.\/orModels"\)\.mount\(app\)/.test(idx) && (idx.match(/modelFor\("image"/g) || []).length === 1 && (idx.match(/modelFor\("video"/g) || []).length === 1);
check("core: an OpenRouter job gets its key", /orRender"\)\.jobApis\(jobCfg, job\.params\)/.test(core));
const html = fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8");
check("page: ormine before remotellm (its change listener first), the combo asks comboExtra",
  html.indexOf("/static/ormine.js") > 0 && html.indexOf("/static/ormine.js") < html.indexOf("/static/remotellm.js") && /H3OrMine\.comboExtra\(inp\.id, cur\)/.test(html) && html.indexOf("/static/orcost.js") > 0);
check("models-found skips OpenRouter renders", /it renders on OpenRouter - no model files here/.test(fs.readFileSync(path.join(ROOT, "routes", "modelsFound.js"), "utf8")));
check("costs count OpenRouter renders", /api_id === "__openrouter"/.test(fs.readFileSync(path.join(ROOT, "lib", "costs.js"), "utf8")));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
