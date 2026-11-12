#!/usr/bin/env node
/* bitGen Studio — 2.766.1 units: Model manager's Civitai filters - All / Checkpoints / LoRAs (+ other types), the model family
 * (Civitai's base models grouped: Krea, Flux, Qwen …), sort by, the period (lib/civitai.js, routes/civitai.js, static/modelmgr.js).
 * Tim (verbatim): "add civitai filters to model manager, checkpoint, lora,all, model family - krea2,flux etc. sort by" */
"use strict";
const fs = require("fs"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
let CFG = { civitai: { token: "", site: "civitai.com", mature: false } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT };
require.cache[coreP] = fake;
const CV = require("../lib/civitai"), EX = require("../lib/setupExec"), MM = require("../static/modelmgr.js");

(async () => {
  check("familyOfBase: Flux.1 Krea / Krea 2 -> Krea; Flux.1 D -> Flux; Qwen Image Edit -> Qwen; SDXL Lightning -> SDXL; Wan Video 2.2 … -> Wan; unknown -> itself",
    CV.familyOfBase("Flux.1 Krea") === "Krea" && CV.familyOfBase("Krea 2") === "Krea" && CV.familyOfBase("Flux.1 D") === "Flux" && CV.familyOfBase("Qwen Image Edit") === "Qwen"
    && CV.familyOfBase("SDXL Lightning") === "SDXL" && CV.familyOfBase("Wan Video 2.2 T2V-A14B") === "Wan" && CV.familyOfBase("Mystery") === "Mystery");
  const fams = CV.familiesOf(["SD 1.5", "Flux.1 D", "Krea 2", "Flux.1 Krea", "Zeta", "Flux.1 S"]);
  check("familiesOf: grouped, Krea and Flux first (bitGen's order), others A-Z after", fams.map((f) => f.name).join() === "Krea,Flux,SD 1 / 2,Zeta" && fams[0].base_models.join() === "Krea 2,Flux.1 Krea" && fams[1].base_models.join() === "Flux.1 D,Flux.1 S", fams);
  check("qsOf: an array = the key repeated (Civitai's types=A&types=B); empty values left out", CV.qsOf({ types: ["LORA", "LoCon"], sort: "Newest", q: "" }) === "?types=LORA&types=LoCon&sort=Newest");
  // search(): what is asked of Civitai
  const asked = []; const real = EX.getJson;
  EX.getJson = async (url) => { asked.push(url); if (/\/enums/.test(url)) return { status: 200, json: { ModelType: ["Checkpoint"], BaseModel: ["Krea 2", "Flux.1 Krea", "Flux.1 D", "Qwen", "SDXL 1.0"] } }; return { status: 200, json: { items: [], metadata: {} } }; };
  const en = await CV.enums();
  check("enums: Civitai's own base models (GET /api/v1/enums) grouped into families; the types / sorts / periods", en.from === "civitai" && en.families[0].name === "Krea" && en.families[0].base_models.length === 2 && en.types.join() === ",Checkpoint,LoRA,VAE,Embedding,ControlNet,Upscaler" && en.periods.includes("Month"), en);
  asked.length = 0;
  await CV.search({ query: "girl", group: "LoRA", family: "Krea", sort: "Newest", period: "Month" });
  const u = new URL(asked[0]);
  check("search: LoRAs = LORA + LoCon + DoRA; the family = every base model in it (Krea 2 + Flux.1 Krea); sort; period", u.searchParams.getAll("types").join() === "LORA,LoCon,DoRA" && u.searchParams.getAll("baseModels").join() === "Krea 2,Flux.1 Krea"
    && u.searchParams.get("sort") === "Newest" && u.searchParams.get("period") === "Month" && u.searchParams.get("query") === "girl", asked[0]);
  asked.length = 0;
  await CV.search({ group: "Checkpoint", baseModels: "Flux.1 D", period: "AllTime" });
  const u2 = new URL(asked[0]);
  check("…Checkpoints + one base model; all time = no period sent", u2.searchParams.getAll("types").join() === "Checkpoint" && u2.searchParams.get("baseModels") === "Flux.1 D" && !u2.searchParams.has("period"), asked[0]);
  asked.length = 0;
  await CV.search({ group: "" });
  check("…All = no type sent", !new URL(asked[0]).searchParams.has("types"), asked[0]);
  EX.getJson = real;
  // the page's pure part
  check("modelmgr cvQuery: group, sort, period (not when all time), a family or one base model", MM.cvQuery({ q: "x", group: "LoRA", fam: "fam:Krea", sort: "Newest", period: "Week" }) === "query=x&group=LoRA&sort=Newest&period=Week&family=Krea"
    && MM.cvQuery({ group: "Checkpoint", fam: "bm:Flux.1 D", period: "AllTime" }) === "query=&group=Checkpoint&sort=Highest%20Rated&baseModels=Flux.1%20D");
  const fo = MM.famOptions([{ name: "Krea", base_models: ["Krea 2", "Flux.1 Krea"] }, { name: "Qwen", base_models: ["Qwen"] }]);
  check("famOptions: every family, then an optgroup per family - All <family> (when it has several) + each base model", /^<option value="">every family<\/option><optgroup label="Krea"><option value="fam:Krea">All Krea<\/option><option value="bm:Krea 2">Krea 2<\/option><option value="bm:Flux\.1 Krea">Flux\.1 Krea<\/option><\/optgroup><optgroup label="Qwen"><option value="bm:Qwen">Qwen<\/option><\/optgroup>$/.test(fo), fo);
  const src = fs.readFileSync(path.join(ROOT, "static", "modelmgr.js"), "utf8");
  check("the Civitai bar: All / Checkpoints / LoRAs chips, other types, the family, Sort by, the period - a change searches again, kept", /\[\["", "All"\], \["Checkpoint", "Checkpoints"\], \["LoRA", "LoRAs"\]\]/.test(src) && /id="mmCvFam"/.test(src) && /<label class="mmcvlab" for="mmCvSort">Sort by<\/label>/.test(src)
    && /id="mmCvPeriod"/.test(src) && /\["mmCvFam", "mmCvSort", "mmCvPeriod"\]\.forEach\(function \(id\) \{ \$\(id\)\.onchange = function \(\) \{ lsSet\(\); cvSearch\(false\); \};/.test(src) && /cvf: \{ group: S\.cv\.group, fam: S\.cv\.fam/.test(src));
  check("GET /api/civitai/enums (routes/civitai.js)", /app\.get\("\/api\/civitai\/enums"/.test(fs.readFileSync(path.join(ROOT, "routes", "civitai.js"), "utf8")));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack)); console.log("RESULT: FAIL"); process.exit(1); });
