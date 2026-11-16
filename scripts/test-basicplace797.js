#!/usr/bin/env node
/* bitGen Studio — 2.797.0 units: Basic Settings' model + LoRA lists by place (static/basicplace.js, index.html cmCombo, static/basicset.js,
 * static/ormine.js), the ☐ Remote rows gone, the Civitai buttons in the Civitai tab (static/modelmgr.js). Pure + source pins. */
"use strict";
const path = require("path"), fs = require("fs");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const BP = require("../static/basicplace.js");

check("placeOf: openrouter/<id> = OpenRouter; a pod's file (pod / remote / nopod) = RunPod; else this computer", BP.placeOf("openrouter/x/y") === "openrouter" && BP.placeOf({ name: "Krea pod/a.safetensors", pod: "p1", remote: true }) === "runpod"
  && BP.placeOf({ name: "NO_Pod (x)/a", nopod: true }) === "runpod" && BP.placeOf({ name: "m.safetensors", remote: true }) === "runpod" && BP.placeOf({ name: "a.safetensors" }) === "local" && BP.placeOf("a.gguf") === "local");
check("counts: all + per place", JSON.stringify(BP.counts([{ name: "a" }, { name: "b", pod: "p" }, "openrouter/c", { name: "d" }])) === '{"all":4,"local":2,"runpod":1,"openrouter":1}');
const mo = BP.optionsHtml("image-model", "runpod", { all: 5, local: 3, runpod: 1, openrouter: 1 });
check("optionsHtml (model list): All places (n) / This computer (n) / RunPod (n) / OpenRouter (n), the kept one selected", /<option value="all">All places \(5\)<\/option>/.test(mo) && /value="local">This computer \(3\)/.test(mo) && /value="runpod" selected>RunPod \(1\)/.test(mo) && /value="openrouter">OpenRouter \(1\)/.test(mo), mo);
const lo = BP.optionsHtml("image-loras", "openrouter", { all: 2, local: 1, runpod: 1 });
check("optionsHtml (LoRA list): no OpenRouter (it has no LoRAs); a kept OpenRouter falls back to All", !/openrouter/.test(lo) && /value="all" selected>All places \(2\)/.test(lo), lo);
check("keep: only all / local / runpod / openrouter", BP.keep("video-model", "local") === "local" && BP.keep("video-model", "nope") === "all" && BP.keep("video-loras", "openrouter") === "all" && BP.keep("video-model", "openrouter") === "openrouter");
const fake = (sel, id) => ({ id: id || "", closest: (q) => (q.split(",").map((x) => x.trim()).includes(sel) ? {} : null) });
check("listOf: the picture checkpoint, the picture / video LoRA rows, the video Model; anything else none", BP.listOf(fake("#imgCkptCombo")) === "image-model" && BP.listOf(fake("#tliRows")) === "image-loras" && BP.listOf(fake("#tlvRows")) === "video-loras" && BP.listOf(fake("", "vidModel")) === "video-model" && BP.listOf(fake("#s_stloras")) === null);

const IX = src("static/index.html"), BS = src("static/basicset.js"), OM = src("static/ormine.js"), MM = src("static/modelmgr.js"), BPS = src("static/basicplace.js");
check("index.html cmCombo: in Basic Settings' lists the first dropdown is the place (cmplace), found when it paints, counted after the family filter", /const bsNow = \(\) => \{/.test(IX) && /bsList = BP\.listOf\(host\);/.test(IX) && /fsel\.className = "cmplace";/.test(IX) && /const n = BP\.counts\(famFiles\(cmFiles\(cats\)\)\);/.test(IX) && /fsel\.innerHTML = BP\.optionsHtml\(bsList, BP\.get\(bsList\), n\);/.test(IX));
check("…the files of the place picked (after the family filter); OpenRouter's only on All / OpenRouter; the place kept per list", /if \(bsList && place !== "all"\) files = files\.filter\(f => BP\.placeOf\(f\) === place\);/.test(IX) && /\(place === "all" \|\| place === "openrouter"\) \? H3OrMine\.comboExtra\(inp\.id, cur\)/.test(IX) && /if \(bsList\) \{ BP\.set\(bsList, fsel\.value\); paintFiles\(\); return; \}/.test(IX) && IX.indexOf("const FF = window.H3FamFilter") < IX.indexOf("if (bsList && place !== \"all\")"));
check("the video Model: a place dropdown (#vidModelPlace) before it; basicset.js fills it after the family filter and lists that place", /<select id="vidModelPlace" class="cmplace"/.test(IX) && /ps\.innerHTML = BP\.optionsHtml\("video-model", pl, n\);/.test(BS) && /if \(pl !== "all"\) shown = full\.filter\(function \(x\) \{ return BP\.placeOf\(x\) === pl; \}\);/.test(BS) && /pod: f\.pod, remote: f\.remote, nopod: f\.nopod/.test(BS));
check("ormine: your OpenRouter video models only on All / OpenRouter", /var pl = root\.H3BasicPlace \? root\.H3BasicPlace\.get\("video-model"\) : "all"; if \(pl !== "all" && pl !== "openrouter"\) return;/.test(OM));
check("Tim: 'in basic settings remove the remote checkboxes' - remoteuse.js no longer loaded, basicplace.js is (before the main script); an old pod pick is cleared once", !/<script src="\/static\/remoteuse\.js">/.test(IX) && IX.indexOf('<script src="/static/basicplace.js">') > 0 && IX.indexOf('<script src="/static/basicplace.js">') < IX.indexOf("function cmCombo(") && /\["image_model_pod", "image_loras_pod", "video_model_pod", "video_loras_pod"\]/.test(BPS) && /new w\.MutationObserver/.test(BPS));
check("Tim: 'move the civitai info and sync buttons into the civitai tab' - ⤓ Civitai info + 🔄 Sync in #mmCvBar, not the tab bar", (() => { const bar = MM.indexOf('id="mmCvBar"'), f = MM.indexOf('id="mmFetch"'), y = MM.indexOf('id="mmSync"'), tabs = MM.indexOf('id="mmRescan"'); return f > bar && y > bar && f > tabs && />⤓ Civitai info<\/button>/.test(MM) && />🔄 Sync<\/button>/.test(MM); })());
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
