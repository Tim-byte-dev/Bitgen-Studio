"use strict";
// bitGen Studio — lib/autostart.js (2.205.0): what starts with the app.
const { plan } = require("../lib/autostart.js");
let fail = 0;
function check(n, c, x) { if (c) console.log("PASS: " + n);
  else { fail++; console.log("FAIL: " + n, x === undefined ? "" : JSON.stringify(x)); } }

check("defaults start NOTHING", JSON.stringify(plan({})) === '{"comfy":false,"llm":null}', plan({}));
check("ComfyUI autostart alone", plan({ engine: { comfy: { autostart: true } } }).comfy === true
      && plan({ engine: { comfy: { autostart: true } } }).llm === null);
check("LLM autostart loads the Prompt dropdown's model",
      plan({ llm: { autostart: true, last_file: "phi.gguf" } }).llm === "phi.gguf");
check("...and with no remembered choice it loads the default model",
      plan({ llm: { autostart: true } }).llm === "default");
check("llm.last_file WITHOUT autostart starts nothing",
      plan({ llm: { last_file: "phi.gguf" } }).llm === null);
console.log("==============================");
console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);
