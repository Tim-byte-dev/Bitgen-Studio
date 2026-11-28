"use strict";
/**
 * teTokenizer.js — does a umT5 / T5 text-encoder file carry its tokenizer? (3.16.1; the Python side: scripts/te_tokenizer.py)
 *
 * ComfyUI's umT5 loader reads the sentencepiece tokenizer from INSIDE the file (the tensor "spiece_model"). Weights-only
 * copies (Kijai's "umt5-xxl-enc-bf16", re-uploads, fine-tunes such as "nsfw_wan_umt5-xxl_bf16") lack it, and CLIPLoader
 * stops with "invalid tokenizer". So such a file must not count as "ComfyUI has a umT5 already" (lib/longcatAddon.js) -
 * then the add-on offers Comfy-Org's file in its Download box.
 *
 *   headerKeys(file)    the tensor names of a .safetensors (null: unreadable / not one)
 *   hasTokenizer(file)  true / false / null (not a .safetensors: cannot tell - a .gguf carries its own)
 *   usable(file)        not KNOWN to lack it (true or null)
 */
const fs = require("fs");

const KEY = "spiece_model";

function headerKeys(file, limit) {
  let fd = null;
  try {
    fd = fs.openSync(file, "r");
    const h = Buffer.alloc(8);
    if (fs.readSync(fd, h, 0, 8, 0) < 8) return null;
    const n = Number(h.readBigUInt64LE(0));
    if (!(n > 0) || n > (limit || 256 * 1024 * 1024)) return null;
    const b = Buffer.alloc(n);
    fs.readSync(fd, b, 0, n, 8);
    const j = JSON.parse(b.toString("utf8"));
    return j && typeof j === "object" ? Object.keys(j).filter((k) => k !== "__metadata__") : null;
  } catch { return null; } finally { if (fd !== null) { try { fs.closeSync(fd); } catch { /* closed */ } } }
}
function hasTokenizer(file) {
  if (!/\.safetensors$/i.test(String(file || ""))) return null;
  const k = headerKeys(file);
  return k ? k.includes(KEY) : null;
}
const usable = (file) => hasTokenizer(file) !== false;

module.exports = { headerKeys, hasTokenizer, usable, KEY };
