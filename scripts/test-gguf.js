"use strict";
// bitGen Studio — lib/gguf.js unit tests (2.193.0).
//
// THE 118-GB 13B. Tim: "why is chronos hermes 13b and synthia 13b using
// 23gb vram on the 3090 and 118gb system ram, can we fix this" — the
// Settings ctx (64k+, sized for the 26B's GQA) rode every launch; a
// Llama-2-era 13B's 40 full KV heads turn that into ~100 GB of KV cache.
// The launcher now reads the .gguf header and clamps to the trained
// context. These tests build synthetic GGUF files byte-by-byte, so the
// reader is proven against the spec, not against whatever happens to be
// on disk.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { meta, llmShape, clampCtx } = require("../lib/gguf.js");

let fail = 0;
function check(name, cond, detail) {
  if (cond) console.log("PASS: " + name);
  else { fail++; console.log("FAIL: " + name, detail === undefined ? "" : JSON.stringify(detail)); }
}

// ---- a tiny GGUF writer (spec v3, little-endian) ---------------------------
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; }
function u64(n) { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; }
function f32(n) { const b = Buffer.alloc(4); b.writeFloatLE(n); return b; }
function str(s) { const d = Buffer.from(s, "utf8"); return Buffer.concat([u64(d.length), d]); }
function kvStr(key, val) { return Buffer.concat([str(key), u32(8), str(val)]); }
function kvU32(key, val) { return Buffer.concat([str(key), u32(4), u32(val)]); }
function kvF32(key, val) { return Buffer.concat([str(key), u32(6), f32(val)]); }
function kvStrArr(key, items) {
  return Buffer.concat([str(key), u32(9), u32(8), u64(items.length),
                        ...items.map((s) => str(s))]);
}
function writeGguf(file, kvs) {
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from("GGUF", "latin1"), u32(3), u64(0), u64(kvs.length), ...kvs]));
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gguf-test-"));

// ---- a Llama-2 13B shaped header (no GQA), tokenizer arrays in the way -----
{
  const f = path.join(tmp, "llama2-13b.gguf");
  // a fat string array BEFORE some wanted keys proves the skip logic
  const fatTokens = Array.from({ length: 5000 }, (_, i) => `token_${i}_padding_padding`);
  writeGguf(f, [
    kvStr("general.architecture", "llama"),
    kvU32("llama.context_length", 4096),
    kvU32("llama.block_count", 40),
    kvStrArr("tokenizer.ggml.tokens", fatTokens),
    kvU32("llama.embedding_length", 5120),
    kvU32("llama.attention.head_count", 40),
    kvU32("llama.attention.head_count_kv", 40),
    kvF32("llama.rope.freq_base", 10000),
  ]);
  const m = meta(f);
  check("meta reads arch + shape keys and skips a 5000-string tokenizer array",
        m && m["general.architecture"] === "llama"
        && m["llama.context_length"] === 4096
        && m["llama.embedding_length"] === 5120, m);
  const sh = llmShape(f);
  check("llmShape: a no-GQA 13B is ~0.78 MB of KV per token (2*40*5120*2)",
        sh && sh.trainCtx === 4096 && sh.kvBytesPerToken === 2 * 40 * 5120 * 2, sh);
  const c = clampCtx(131072, sh, false);
  check("clampCtx: a 128k request on the 13B clamps to 4096 and the note does the GB math",
        c.ctx === 4096 && /clamped/.test(c.note)
        && /100\.0 GB KV cache/.test(c.note) && /ctx_force/.test(c.note), c);
  check("clampCtx: llm.ctx_force launches as configured",
        clampCtx(131072, sh, true).ctx === 131072
        && clampCtx(131072, sh, true).note === "");
  check("clampCtx: a request within the window is untouched",
        clampCtx(4096, sh, false).ctx === 4096
        && clampCtx(2048, sh, false).ctx === 2048);
}

// ---- a GQA model (26B-style): big ctx is cheap and stays -------------------
{
  const f = path.join(tmp, "gqa-26b.gguf");
  writeGguf(f, [
    kvStr("general.architecture", "qwen3"),
    kvU32("qwen3.context_length", 131072),
    kvU32("qwen3.block_count", 48),
    kvU32("qwen3.embedding_length", 6144),
    kvU32("qwen3.attention.head_count", 48),
    kvU32("qwen3.attention.head_count_kv", 8),
  ]);
  const sh = llmShape(f);
  check("llmShape: GQA shrinks KV by head_count_kv/head_count (8/48)",
        sh && sh.kvBytesPerToken === 2 * 48 * 6144 * (8 / 48) * 2, sh);
  check("clampCtx: 64k on the GQA model is inside its window — launched as asked",
        clampCtx(65536, sh, false).ctx === 65536
        && clampCtx(65536, sh, false).note === "");
}

// ---- garbage in, launch-as-configured out ----------------------------------
{
  const f = path.join(tmp, "not-a.gguf");
  fs.writeFileSync(f, "MZ this is not a gguf at all");
  check("a non-GGUF file answers null shape and clampCtx passes the request through",
        llmShape(f) === null && clampCtx(65536, null, false).ctx === 65536);
  check("a missing file also answers null, never throws",
        llmShape(path.join(tmp, "absent.gguf")) === null);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log("==============================");
console.log(fail ? `${fail} FAILED` : "ALL PASS");
process.exit(fail ? 1 : 0);
