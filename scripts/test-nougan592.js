#!/usr/bin/env node
/* bitGen Studio — scripts/test-nougan592.js (2.592.0): Nougan_Nodes' 🎭 regional character LoRA + ⏱ Prompt Relay - the
 * app side. Tim: "lets just add the regional character lora and prompt relay". The add-on (lib/nouganAddon.js, Settings ▸
 * Add-ons), a zone's LoRA (lib/regions.js, ext/imageeditdock/pczones.js), the ⏱ timed lines (static/promptrelay.js, the
 * prompt docker's button). The graph side is scripts/test-nougan592.py. No server. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-nougan592-"));

(async () => {
  try {
    // ---- a zone's 🎭 LoRA
    const RG = require("../lib/regions");
    const c = RG.clean([{ x: 0, y: 0, w: 0.5, h: 1, text: "Tim", lora: "chars\\tim.safetensors", lora_strength: "0.876" },
      { x: 0.5, y: 0, w: 0.5, h: 1, text: "Ana", lora: "../../evil.safetensors" }, { x: 0, y: 0.5, w: 0.2, h: 0.2, text: "dog", lora: "", lora_strength: 3 },
      { x: 0.2, y: 0, w: 0.2, h: 0.2, text: "x", lora: "a.safetensors", lora_strength: 99 }]);
    check("regions.clean keeps a box's 🎭 LoRA + its strength (-4..4, 2 decimals); a path that climbs out or an empty one = no LoRA",
      c[0].lora === "chars\\tim.safetensors" && c[0].lora_strength === 0.88 && !("lora" in c[1]) && !("lora" in c[2]) && c[3].lora_strength === 4, c);
    check("regions.loras: the different LoRAs (either slash); LORAS_MAX 2; /api/genimage refuses a third in words",
      RG.loras([{ lora: "a\\b" }, { lora: "a/b" }, {}, { lora: "c" }]).join() === "a/b,c" && RG.LORAS_MAX === 2
      && /loras\(rg\)\.length > require\("\.\.\/lib\/regions"\)\.LORAS_MAX/.test(rd("routes", "index.js")) && /two different character LoRAs at most/.test(rd("routes", "index.js")));
    const Z = require("../ext/imageeditdock/pczones.js");
    const r = Z.regionsOf([{ x: 0, y: 0, w: 50, h: 100, text: "Tim", lora: " chars/tim.safetensors ", lora_w: 0.8 }, { x: 50, y: 0, w: 50, h: 100, text: "Ana", lora: "" }], 100, 100);
    check("pczones.regionsOf: a box's 🎭 LoRA + strength go with it (none = none)", r[0].lora === "chars/tim.safetensors" && r[0].lora_strength === 0.8 && !("lora" in r[1]), r);
    check("pczones.charLoras: the boxes with words, different LoRAs only; LORAS_MAX 2",
      Z.charLoras([{ text: "a", lora: "x\\t" }, { text: "b", lora: "x/t" }, { text: "", lora: "y" }, { text: "c", lora: "z" }]).join() === "x/t,z" && Z.LORAS_MAX === 2);
    const ZS = rd("ext", "imageeditdock", "pczones.js");
    check("the zones panel: 🎭 per box (▦ Regional only) opens ComfyUI's LoRA list (the page's cmCombo, onChange) + a strength; a third LoRA is refused before the job",
      /data-zl="\$\{i\}"/.test(ZS) && /win\.cmCombo\(host, inp, \["loras"\], \{ blank: "— no character LoRA —"/.test(ZS) && /data-zlw/.test(ZS)
      && /el\.style\.display = m === "regional" \? "" : "none"/.test(ZS) && /cl\.length > LORAS_MAX/.test(ZS));
    check("the image worker names the add-on when the node is missing", /NouganRegionalCharacterLoRA" in missing/.test(rd("misc", "image_worker.py")) && /Settings ▸ Add-ons ▸ Nougan Nodes/.test(rd("misc", "image_worker.py")));

    // ---- ⏱ timed lines
    const PR = require("../static/promptrelay.js");
    const p = PR.parse("a fox in the snow\n[0-2s] sniffs\n[2s] looks up\n[3.5 - 9 s] runs\n[4-5]  ");
    check("promptrelay.parse: the global lines + the timed ones by start ([0-2s], [2s], [3.5 - 9 s]); an empty line dropped; nothing timed = null",
      p.global === "a fox in the snow" && p.segments.map((s) => [s.start, s.end, s.text].join()).join("|") === "0,2,sniffs|2,,looks up|3.5,9,runs" && PR.parse("a fox") === null, p);
    check("promptrelay.nextLine: from where the last line ends (or its start + 2 s), 2 s long, inside the clip",
      PR.nextLine("", 5) === "[0-2s] " && PR.nextLine("a\n[0-2s] x", 5) === "[2-4s] " && PR.nextLine("[3s] x", 5) === "[4.5-5s] " && PR.nextLine("[0-2s] a\n[2-4.5s] b", 5) === "[4.5-5s] ",
      [PR.nextLine("", 5), PR.nextLine("a\n[0-2s] x", 5), PR.nextLine("[3s] x", 5), PR.nextLine("[0-2s] a\n[2-4.5s] b", 5)]);
    const DOCK = rd("ext", "promptdock", "dock.html"), PAGE = rd("static", "index.html");
    check("the prompt docker: ⏱ beside the LTX mode (hidden), shown for an LTX style by ltxModePaint; static/promptrelay.js on the page",
      /<button id="ltxRelayBtn" class="ghost" type="button" hidden/.test(DOCK) && /Nougan Nodes/.test(DOCK)
      && /\$\("ltxRelayBtn"\)\.hidden = !on; if \(window\.H3Relay\) H3Relay\.wire\(\);/.test(PAGE) && /<script src="\/static\/promptrelay\.js"><\/script>/.test(PAGE));

    // ---- the add-on
    const A = require("../lib/addons").LIST.find((a) => a.id === "nougan");
    check("Settings ▸ Add-ons ▸ Nougan Nodes: what it is for (🎭 Zones, ⏱ LTX timed lines), what it needs, no model files",
      A && /regional character LoRAs/.test(A.label) && /Prompt Relay/.test(A.label) && /🔲 Zones/.test(A.for) && /\[0-2s\]/.test(A.for) && /MIT/.test(A.needs) && /no model files/.test(A.size)
      && typeof A.install === "function" && typeof A.remove === "function");
    const NA = require("../lib/nouganAddon");
    const CN = path.join(tmp, "custom_nodes"); fs.mkdirSync(CN);
    const pl = { ok: true, customNodes: CN, models: path.join(tmp, "models"), python: "" };
    check("status: not installed", NA.status(pl).installed === false && NA.status(pl).note === "not installed");
    fs.mkdirSync(path.join(CN, NA.KIJAI));
    check("status: Kijai's ComfyUI-PromptRelay alone = Prompt Relay works, Install adds the regional LoRA", NA.status(pl).relay === true && /Kijai/.test(NA.status(pl).note));
    const logs = [];
    const fetched = [];
    const res = await NA.install((l) => logs.push(l), { place: pl, git: "", exec: { which: () => "", run: async () => 0 },
      fetchRepo: async (url, dest) => { fetched.push([url, dest]); fs.mkdirSync(path.join(dest, "prompt_relay"), { recursive: true }); fs.writeFileSync(path.join(dest, "nougan_regional_lora.py"), "#"); return { ok: true }; } });
    check("install: github.com/Winnougan/Nougan_Nodes into custom_nodes/Nougan_Nodes; ready = the regional LoRA + Prompt Relay; says to restart ComfyUI",
      res.ok && fetched[0][0] === "https://github.com/Winnougan/Nougan_Nodes" && fetched[0][1] === path.join(CN, "Nougan_Nodes")
      && NA.status(pl).installed && NA.status(pl).relay && /restart ComfyUI/.test(logs.join("\n")), { res, logs });
    const bad = path.join(tmp, "cn2"); fs.mkdirSync(bad);
    const res2 = await NA.install(() => {}, { place: { ok: true, customNodes: bad }, git: "", exec: { which: () => "", run: async () => 0 }, fetchRepo: async (u, d) => { fs.mkdirSync(d, { recursive: true }); return { ok: true }; } });
    check("install: a copy without nougan_regional_lora.py = refused in words", !res2.ok && /nougan_regional_lora\.py/.test(res2.error));
    check("install: no ComfyUI = refused in words", !(await NA.install(() => {}, { place: { ok: false, error: "no folder" } })).ok);
    check("the graph side ships: scripts/comfy_regions.py (NouganRegionalCharacterLoRA), scripts/prompt_relay.py (PromptRelayEncode), misc/ltx_worker.py uses it",
      /CHAR_NODE = "NouganRegionalCharacterLoRA"/.test(rd("scripts", "comfy_regions.py")) && /NODE = "PromptRelayEncode"/.test(rd("scripts", "prompt_relay.py"))
      && /import prompt_relay as _PR/.test(rd("misc", "ltx_worker.py")));
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
