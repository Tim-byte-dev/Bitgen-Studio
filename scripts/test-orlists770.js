#!/usr/bin/env node
/* bitGen Studio — 2.770.0: LLM / Vision LLM Local or Remote (the platform Settings picks - OpenRouter by default), Settings ▸
 * OpenRouter Show free / Show paid, the prompt docker's lists 10 at a time with a search, and the ☰ All dialog's filters / sort
 * (lib/openRouter.js, lib/podLlm.js providerOf / whereOf, lib/remoteLlm.js, static/remotellm.js, static/remoteprep.js). Pure.
 * Tim (verbatim): "in the remote generation docker , remove the openrouter search, and runpod and openrouter dialog, instead just
 * have local and remote radio buttons for llm and vllm. in settings openrouter and checkbox show paid, show free, add the list to
 * the dropdowns but only show 10 at a time, add a search to each dropdown , add a button to the docker , show all - this will show
 * all openrouter models in a dialog, with filtering,sort,search, free, paid and details in a list, whn user selects one and clicks
 * use then change the dropdown to the model and we use that model" + "the remote platform will be selected in settings with
 * openrouter as default" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const OR = require("../lib/openRouter"), PL = require("../lib/podLlm"), UI = require("../static/remotellm.js");
const raw = (id, p, vis, extra) => Object.assign({ id, name: id.split("/")[1], context_length: 8000, architecture: { input_modalities: vis ? ["text", "image"] : ["text"], output_modalities: ["text"] }, pricing: { prompt: String(p), completion: String(p * 2) } }, extra || {});
const DATA = [raw("a/free1:free", 0), raw("b/paid1", 0.000001), raw("c/vis:free", 0, true, { description: "A  vision\\nmodel", created: 1760000000 }), raw("d/paid2", 0.000003, true)];
check("listView: free only (Settings: Show free), paid only (Show paid), both, none", OR.listView(DATA, { free: true, paid: false }).length === 2 && OR.listView(DATA, { free: false, paid: true }).length === 2 && OR.listView(DATA, { free: true, paid: true }).length === 4 && OR.listView(DATA, { free: false, paid: false }).length === 0);
const m = OR.mapModel(DATA[2]);
check("mapModel: the details for ☰ All - description, when it was added, its maker", /^A vision/.test(m.desc) && m.created === 1760000000 && m.maker === "c", m);
check("whereOf: 'remote' = the platform Settings picks (rgpu.llm_provider) - OpenRouter by default, RunPod when picked; Local / an old choice as they were",
  PL.whereOf({ llm_where: { llm: "remote" } }, "llm") === "openrouter" && PL.whereOf({ llm_where: { llm: "remote" }, llm_provider: "runpod" }, "llm") === "runpod" && PL.whereOf({ llm_where: { llm: "local" } }, "llm") === "local" && PL.whereOf({ llm_where: { vlm: "openrouter" } }, "vlm") === "openrouter");
const many = Array.from({ length: 25 }, (_, i) => ({ id: "m/model" + i, name: "Model " + i, free: i % 2 === 0, note: i % 2 ? "$1/$2 per M" : "free" }));
let o = UI.optionsOf({ host: "openrouter", models: many, current: "m/model20" }, "", 10);
check("optionsOf: 10 at a time (+ the current one), how many more", o.items.length === 11 && o.items[0].value === "m/model20" && o.items[0].selected && o.more === 15, { n: o.items.length, more: o.more });
o = UI.optionsOf({ host: "openrouter", models: many, current: "" }, "model1", 10);
check("…the search: every word (name / id / free / paid)", o.items.every((it) => /Model 1/.test(it.text)) && o.items.length === 10 && o.more === 1 && UI.optionsOf({ host: "openrouter", models: many }, "paid", 10).items.every((it) => /\$1/.test(it.text)));
check("…nothing matches: said", /nothing matches "zzz"/.test(UI.optionsOf({ host: "openrouter", models: many }, "zzz", 10).empty));
const L = OR.listView(DATA, { free: true, paid: true });
check("listOf (☰ All): Free / Paid / 👁 Vision filters and a search", UI.listOf(L, { free: false }).every((x) => !x.free) && UI.listOf(L, { paid: false }).every((x) => x.free) && UI.listOf(L, { vision: true }).map((x) => x.id).sort().join() === "c/vis:free,d/paid2" && UI.listOf(L, { q: "paid2" }).length === 1);
check("…sorted by price (free first), context, newest, name", UI.listOf(L, {}, "price").map((x) => x.id).slice(-1)[0] === "d/paid2" && UI.listOf(L, {}, "newest")[0].id === "c/vis:free" && UI.listOf(L, {}, "name")[0].id === "a/free1:free");
const rp = fs.readFileSync(path.join(ROOT, "static", "remoteprep.js"), "utf8"), rl = fs.readFileSync(path.join(ROOT, "static", "remotellm.js"), "utf8"), so = fs.readFileSync(path.join(ROOT, "static", "openrouter.js"), "utf8");
check("the docker: LLM / Vision LLM = Local / Remote only (no OpenRouter search, no RunPod / OpenRouter choice); Settings: Show free + Show paid; the prompt docker: a search per list, ☰ All, its dialog with Use for LLM / Vision LLM",
  /var CHOICES = \[\["local", "Local"[^\]]*\], \["remote", "Remote"/.test(rp) && !/rpOr_/.test(rp) && /id="rgOrFree"> Show free/.test(so) && /id="rgOrPaid"> Show paid/.test(so)
  && !/q\.id = "rlQ_"/.test(rl) && /b\.id = "rlAll"/.test(rl) && /name="rlDlgK" value="vlm"/.test(rl) && /pick\(k, id\)\.then/.test(rl));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
