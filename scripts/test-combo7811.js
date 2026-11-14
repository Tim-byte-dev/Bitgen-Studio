#!/usr/bin/env node
/* bitGen Studio — 2.781.1: the Python side reads ComfyUI's newer combo lists (scripts/test-combo7811.py, run here so CI runs it).
 * Tim's log: "node 70: Value not in list [unet_name] = krea2_nsfw-aio-2.safetensors … not in []" on a new pod's ComfyUI 0.45 */
"use strict";
const path = require("path");
const r = require("child_process").spawnSync("python3", [path.join(__dirname, "test-combo7811.py")], { encoding: "utf8" });
process.stdout.write(r.stdout || ""); process.stderr.write(r.stderr || "");
console.log(r.status === 0 ? "\nRESULT: PASS" : "\nRESULT: FAIL"); process.exit(r.status === 0 ? 0 : 1);
