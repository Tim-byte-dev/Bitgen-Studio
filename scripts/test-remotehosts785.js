#!/usr/bin/env node
/* bitGen Studio — 2.785.0: "RUNS ON" PER TYPE (lib/remoteHosts.js, static/remotehosts.js, static/remotebtns.js).
 * Tim (verbatim): "remove the radiogroups from remote generation docker, replace them with a dropdown, local, runpod,
 * openrouter,LAN,Team (gray out lan and team for now , until we get them working) for each type. show the pods button in
 * statusbar only if one of the selections is runpod" + "go". Pure + source checks (no server).
 */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
function check(name, ok, got) { if (ok) { pass++; console.log("PASS: " + name); } else { fail++; console.log("FAIL: " + name + (got === undefined ? "" : "\n      got " + JSON.stringify(got))); } }
const H = require("../lib/remoteHosts");
const ids = (k) => H.optionsFor(k).map((o) => (o.off ? "-" : "+") + o.id).join();
check("eight kinds: Image, Video, Music, Text to speech, Speech to text, Song separation, LLM, Vision LLM", H.KINDS.map((x) => x[0]).join() === "image,video,music,tts,stt,stems,llm,vlm");
check("hosts: Local, RunPod, OpenRouter, LAN, Team - LAN and Team greyed on every kind", H.KINDS.every(([k]) => /-lan,-team$/.test(ids(k))));
check("OpenRouter open on the LLM / Vision LLM, greyed on pictures / video (next release) and speech / transcripts / stems / music", ids("llm") === "+local,+runpod,+openrouter,-lan,-team" && ids("vlm") === ids("llm")
  && ids("image") === "+local,+runpod,-openrouter,-lan,-team" && /next release/.test(H.optionsFor("video").find((o) => o.id === "openrouter").why) && /does not run/.test(H.optionsFor("stems").find((o) => o.id === "openrouter").why));
const per = { where: "both", per: true, image: true, video: false, music: false, tts: true, stt: false, stems: false };
let h = H.hostsOf({ mode: "runpod" }, per, { provider: "runpod", pods: true }, (k) => (k === "llm" ? "openrouter" : ""));
check("hostsOf: per-type remote = RunPod, the rest Local; the LLM's platform as it is", h.image === "runpod" && h.tts === "runpod" && h.video === "local" && h.llm === "openrouter" && h.vlm === "local", h);
h = H.hostsOf({ mode: "ssh" }, { where: "remote" }, {}, () => "");
check("hostsOf: the old Remote = every render kind remote; another computer / SSH tunnel = LAN", ["image", "video", "music", "tts", "stt", "stems"].every((k) => h[k] === "lan"), h);
check("hostsOf: Local = everything here, whatever the boxes say", Object.values(H.hostsOf({}, { where: "local", per: true, image: true }, {}, () => "")).every((x) => x === "local"));
check("whereFor: nothing remote = local; anything remote = both (the rows decide)", H.whereFor({ image: "local", llm: "local" }) === "local" && H.whereFor({ image: "local", llm: "openrouter" }) === "both" && H.whereFor({ image: "runpod" }) === "both");
check("anyRunpod: only a RunPod row (OpenRouter alone = no Pods button)", H.anyRunpod({ image: "runpod" }) && !H.anyRunpod({ llm: "openrouter", image: "local" }));
let threw = ""; try { H.set("image", "lan"); } catch (e) { threw = e.message; }
check("set refuses a greyed host with why (LAN)", /LAN - not working yet/.test(threw), threw);
const RH = require("../static/remotehosts.js");
check("optionText: a greyed option says why in a few words", RH.optionText({ label: "LAN", off: true, why: "not working yet - coming later" }) === "LAN (coming later)" && RH.optionText({ label: "OpenRouter", off: true, why: "OpenRouter's paid picture / video models come in the next release" }) === "OpenRouter (next release)" && RH.optionText({ label: "Local", off: false }) === "Local");
check("setAllValue: the one host every row is on, else mixed", RH.setAllValue({ a: "runpod", b: "runpod" }) === "runpod" && RH.setAllValue({ a: "runpod", b: "local" }) === "");
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
check("routes/gpuSplit.js mounts GET / POST /api/remotehosts (not server.js)", /app\.get\("\/api\/remotehosts"/.test(src("routes/gpuSplit.js")) && /app\.post\("\/api\/remotehosts"/.test(src("routes/gpuSplit.js")) && !/remotehosts/.test(src("misc/server.js")));
check("the Pods button follows any_runpod", /useP = !!S\.on && \(S\.h \? !!S\.h\.any_runpod : anyRemote\(S\.v\)\)/.test(src("static/remotebtns.js")));
check("index.html loads remotehosts.js after remotetypes.js", src("static/index.html").indexOf("/static/remotehosts.js") > src("static/index.html").indexOf("/static/remotetypes.js"));
check("the old radio groups hidden (All local / All remote / Both, Remote servers, the types' rows, the LLM rows)", /#rgdWhere #gpuWhere/.test(src("static/remotehosts.js")) && /\.rtSec\[data-rtsec=\\"servers\\"\]/.test(src("static/remotehosts.js")) && /#rgdBody \.rtSec #gpuLlmWhere \.rpRow/.test(src("static/remotehosts.js")));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
