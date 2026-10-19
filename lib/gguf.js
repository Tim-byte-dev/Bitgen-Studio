"use strict";
/**
 * bitGen Studio — minimal GGUF metadata reader (2.193.0).
 *
 * WHY (Tim: "why is chronos hermes 13b and synthia 13b using 23gb vram on
 * the 3090 and 118gb system ram, can we fix this"): the launcher passed the
 * Settings ctx (set to 64k+ for the 26B) to EVERY model. The 26B has GQA —
 * cheap KV cache — but Llama-2-era 13Bs have 40 FULL KV heads at ~0.8 MB of
 * KV per token: a 128k -c allocates ~100 GB, fills the 3090 and spills the
 * rest into system RAM via the driver's sysmem fallback, all for context
 * the model never trained past 4k on. The fix is to ASK THE FILE: every
 * .gguf carries its trained context and attention shape in its header.
 *
 * This reader walks only the metadata KV section, stops as soon as the
 * needed keys are in hand (they precede the multi-MB tokenizer arrays), and
 * never loads the tensor data. Anything unreadable answers null — the
 * launcher then runs exactly as configured, as before.
 */
const fs = require("fs");

// GGUF value types (spec v3)
const T = { U8: 0, I8: 1, U16: 2, I16: 3, U32: 4, I32: 5, F32: 6, BOOL: 7,
            STR: 8, ARR: 9, U64: 10, I64: 11, F64: 12 };
const SIZES = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8 };

/** Buffered sequential reader over the head of the file. */
function reader(file) {
  const fd = fs.openSync(file, "r");
  let buf = Buffer.alloc(0), off = 0, fpos = 0;
  const need = (n) => {
    while (buf.length - off < n) {
      const chunk = Buffer.alloc(Math.max(n, 65536));
      const got = fs.readSync(fd, chunk, 0, chunk.length, fpos);
      if (got <= 0) throw new Error("gguf: truncated header");
      fpos += got;
      buf = Buffer.concat([buf.subarray(off), chunk.subarray(0, got)]);
      off = 0;
    }
  };
  return {
    u32: () => { need(4); const v = buf.readUInt32LE(off); off += 4; return v; },
    u64: () => { need(8); const v = Number(buf.readBigUInt64LE(off)); off += 8; return v; },
    i64: () => { need(8); const v = Number(buf.readBigInt64LE(off)); off += 8; return v; },
    f64: () => { need(8); const v = buf.readDoubleLE(off); off += 8; return v; },
    f32: () => { need(4); const v = buf.readFloatLE(off); off += 4; return v; },
    bytes: (n) => { need(n); const v = buf.subarray(off, off + n); off += n; return v; },
    skip: (n) => { // skip without buffering huge runs
      const have = buf.length - off;
      if (n <= have) { off += n; return; }
      fpos += n - have; buf = Buffer.alloc(0); off = 0;
    },
    close: () => { try { fs.closeSync(fd); } catch { /* closed */ } },
  };
}

function readScalar(r, type) {
  switch (type) {
    case T.U8: return r.bytes(1).readUInt8(0);
    case T.I8: return r.bytes(1).readInt8(0);
    case T.U16: return r.bytes(2).readUInt16LE(0);
    case T.I16: return r.bytes(2).readInt16LE(0);
    case T.U32: return r.u32();
    case T.I32: { const b = r.bytes(4); return b.readInt32LE(0); }
    case T.F32: return r.f32();
    case T.BOOL: return r.bytes(1).readUInt8(0) !== 0;
    case T.U64: return r.u64();
    case T.I64: return r.i64();
    case T.F64: return r.f64();
    default: return undefined;
  }
}

function skipValue(r, type) {
  if (type === T.STR) { r.skip(r.u64()); return; }
  if (type === T.ARR) {
    const et = r.u32(); const n = r.u64();
    if (et === T.STR) { for (let i = 0; i < n; i++) r.skip(r.u64()); return; }
    if (et === T.ARR) { for (let i = 0; i < n; i++) skipValue(r, T.ARR); return; }
    r.skip((SIZES[et] || 1) * n); return;
  }
  r.skip(SIZES[type] || 1);
}

/**
 * The metadata keys the launcher needs, or null when the file is not a
 * readable GGUF. Stops early once every wanted key is in hand.
 */
function meta(file) {
  let r;
  try {
    r = reader(file);
    if (r.bytes(4).toString("latin1") !== "GGUF") { r.close(); return null; }
    const version = r.u32();
    if (version < 2 || version > 3) { r.close(); return null; }
    r.u64(); // tensor count
    const nkv = r.u64();
    const out = {};
    const wantSuffix = [".context_length", ".block_count", ".embedding_length",
                        ".attention.head_count", ".attention.head_count_kv"];
    const wanted = (k) => k === "general.architecture"
      || wantSuffix.some((s) => k.endsWith(s));
    let found = 0;
    for (let i = 0; i < nkv && i < 4096; i++) {
      const klen = r.u64();
      const key = r.bytes(klen).toString("utf8");
      const type = r.u32();
      if (wanted(key) && type !== T.ARR && type !== T.STR) {
        out[key] = readScalar(r, type); found++;
      } else if (key === "general.architecture" && type === T.STR) {
        const n = r.u64(); out[key] = r.bytes(n).toString("utf8"); found++;
      } else skipValue(r, type);
      if (found >= 6) break; // arch + the five numbers
    }
    r.close();
    return out;
  } catch { try { r && r.close(); } catch { /* closed */ } return null; }
}

/** The launcher's view: trained context and KV bytes per token. */
function llmShape(file) {
  const m = meta(file);
  if (!m) return null;
  const arch = m["general.architecture"] || "";
  const g = (suffix) => m[`${arch}${suffix}`] ?? Object.entries(m)
    .filter(([k]) => k.endsWith(suffix)).map(([, v]) => v)[0];
  const trainCtx = g(".context_length");
  const layers = g(".block_count");
  const embd = g(".embedding_length");
  const heads = g(".attention.head_count");
  const kvHeads = g(".attention.head_count_kv") || heads;
  let kvBytesPerToken = null;
  if (layers && embd && heads)
    // K + V, fp16 (2 bytes), per layer, at the KV heads' share of the width
    kvBytesPerToken = 2 * layers * embd * (kvHeads / heads) * 2;
  return { arch, trainCtx: trainCtx || null, kvBytesPerToken };
}

/**
 * The context llama-server should actually be launched with. A configured
 * ctx past the model's trained window buys nothing but KV cache — the model
 * cannot attend that far — so it clamps, with the memory math in the note.
 * `force` (config.llm.ctx_force) launches as configured for rope-scaled
 * finetunes whose headers understate what they can do.
 */
function clampCtx(requested, shape, force) {
  const req = Number(requested) || 0;
  if (force || !shape || !shape.trainCtx || req <= shape.trainCtx)
    return { ctx: req, note: "" };
  const gb = (t) => shape.kvBytesPerToken
    ? ` (~${(t * shape.kvBytesPerToken / 2 ** 30).toFixed(1)} GB KV cache)` : "";
  return { ctx: shape.trainCtx,
           note: `ctx ${req}${gb(req)} exceeds this model's trained context `
               + `${shape.trainCtx}${gb(shape.trainCtx)} — clamped; the model `
               + "cannot attend past its training window, so the extra cache "
               + "buys nothing (set llm.ctx_force to launch as configured)" };
}

module.exports = { meta, llmShape, clampCtx };
