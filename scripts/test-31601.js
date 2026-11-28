#!/usr/bin/env node
/* bitGen Studio — 3.16.1: a umT5 text encoder with no tokenizer inside no longer counts as "ComfyUI has a umT5 already"
 * (lib/teTokenizer.js, lib/longcatAddon.js) - the add-on's Download box offers Comfy-Org's file instead.
 * Tim's log: LongCat Avatar 1.6 -> CLIPLoader "nsfw_wan_umt5-xxl_bf16.safetensors" -> ComfyUI: "invalid tokenizer". */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const T = require(path.join(ROOT, "lib/teTokenizer.js"));
const LA = require(path.join(ROOT, "lib/longcatAddon.js"));
function st(file, names) {
  const h = {}; for (const n of names) h[n] = { dtype: "U8", shape: [1], data_offsets: [0, 1] }; h.__metadata__ = { format: "pt" };
  const b = Buffer.from(JSON.stringify(h)), n = Buffer.alloc(8); n.writeBigUInt64LE(BigInt(b.length));
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.concat([n, b, Buffer.from([0])]));
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tetok-")), te = path.join(tmp, "text_encoders");
st(path.join(te, "nsfw_wan_umt5-xxl_bf16.safetensors"), ["shared.weight"]);
check("headerKeys: the tensor names (not __metadata__)", JSON.stringify(T.headerKeys(path.join(te, "nsfw_wan_umt5-xxl_bf16.safetensors"))) === '["shared.weight"]');
check("hasTokenizer: a weights-only copy false; a .gguf / missing file null (cannot tell)", T.hasTokenizer(path.join(te, "nsfw_wan_umt5-xxl_bf16.safetensors")) === false && T.hasTokenizer(path.join(te, "a.gguf")) === null && T.hasTokenizer(path.join(te, "gone.safetensors")) === null);
const it = LA.ITEMS.find((i) => i.id === "te");
check("LongCat add-on: only a umT5 WITHOUT its tokenizer -> the text encoder counts as missing (the Download box offers it)", it.tok === true && LA.anyIn(te, it.any, T.usable) === false && LA.anyIn(te, it.any) === true);
st(path.join(te, "wan", "umt5_xxl_fp8_e4m3fn_scaled.safetensors"), ["shared.weight", "spiece_model"]);
check("…with Comfy-Org's file (tokenizer inside, in a subfolder too): present", T.hasTokenizer(path.join(te, "wan", "umt5_xxl_fp8_e4m3fn_scaled.safetensors")) === true && LA.anyIn(te, it.any, T.usable) === true);
const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "tetok-")); st(path.join(tmp2, "umt5-xxl-Q8_0.gguf"), ["x"]);
check("…a .gguf umT5 counts (it carries its own tokenizer, the GGUF loader's)", LA.anyIn(tmp2, it.any, T.usable) === true);
fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(tmp2, { recursive: true, force: true });
console.log("\n" + pass + " passed, " + fail + " failed");
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
