#!/usr/bin/env node
/* bitGen Studio — 2.782.0: runs scripts/test-llmswap782.py (the pod's node swapping the card between the LLM and ComfyUI, run for
 * real under a stand-in ComfyUI) - gate leg (child_process). */
"use strict";
const r = require("child_process").spawnSync("python3", [require("path").join(__dirname, "test-llmswap782.py")], { encoding: "utf8", timeout: 170000 });
process.stdout.write(r.stdout || ""); process.stderr.write(r.stderr || "");
console.log(r.status === 0 ? "\nRESULT: PASS" : "\nRESULT: FAIL"); process.exit(r.status === 0 ? 0 : 1);
