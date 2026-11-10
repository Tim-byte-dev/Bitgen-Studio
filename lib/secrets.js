// bitGen Studio — lib/secrets.js (2.748.0): THE USER'S API KEYS, ENCRYPTED, IN settings/.
//
// Tim: "save the users api keys in a file in a folder called settings, maybe encrypt the keys and decrptt them when
// using the app. so user doesn't need to add them with new updates".
//
//   settings/keys.json     {v: 1, alg: "aes-256-gcm", keys: {"hf.token": "v1:<base64 iv|tag|text>", ...}} - each key
//                          encrypted on its own (AES-256-GCM, Node's own crypto - nothing imported)
//   settings/keys.master   the 32-byte key that opens them (random, made once, 0600) - copy the whole settings folder to
//                          carry the keys to another install
//   Neither is in the repo (.gitignore), so a git pull, the in-app update or a new zip leaves them where they are.
//   custom.settings no longer holds a key: lib/settings.js takes them out before it writes (strip) and puts them back,
//   decrypted, when it loads (put) - the rest of the app reads config.hf.token etc. as before. A key found in
//   custom.settings (an install from before) moves here at the first start.
//   What it protects: the keys are not plain text in a settings file, a backup of it or a file shared to help someone.
//   What it cannot: the app must open them without asking you anything, so someone who can read this computer's files as
//   you can read keys.master too - the same as any app that remembers a key.
//
//   PATHS                  the settings that are keys (dotted paths in the config)
//   pick(cfg) / strip(cfg) / put(cfg, map)    pure
//   store(base) -> {read(), update(names, map), file, master, names()}
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// the API keys and tokens the app saves (rgpu.ssh.key is the PATH of a key file, not a key)
const PATHS = ["hf.token", "civitai.token", "engine.runpod.api_key", "rgpu.runpod.key", "remote.key", "rgpu.openrouter.key"];   // 2.753.0: + OpenRouter
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function getAt(o, p) { let x = o; for (const k of p.split(".")) { if (!isObj(x)) return undefined; x = x[k]; } return x; }
/** the keys set in a config -> {path: value} (empty ones left out) */
function pick(cfg, paths) {
  const out = {};
  for (const p of paths || PATHS) { const v = getAt(cfg, p); if (typeof v === "string" && v.trim()) out[p] = v; }
  return out;
}
/** a copy of a config with the keys taken out (the field gone, not "") */
function strip(cfg, paths) {
  const c = cfg === undefined ? cfg : JSON.parse(JSON.stringify(cfg));
  for (const p of paths || PATHS) {
    const ks = p.split("."), last = ks.pop();
    let x = c; for (const k of ks) { if (!isObj(x)) { x = null; break; } x = x[k]; }
    if (isObj(x) && last in x) delete x[last];
  }
  return c;
}
/** put the keys into a config (in place; objects made as needed) -> cfg */
function put(cfg, map) {
  for (const [p, v] of Object.entries(map || {})) {
    if (!PATHS.includes(p)) continue;
    const ks = p.split("."), last = ks.pop();
    let x = cfg; for (const k of ks) { if (!isObj(x[k])) x[k] = {}; x = x[k]; }
    x[last] = v;
  }
  return cfg;
}

function encrypt(master, text) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", master, iv);
  const ct = Buffer.concat([c.update(String(text), "utf8"), c.final()]);
  return "v1:" + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}
function decrypt(master, s) {
  const m = /^v1:([A-Za-z0-9+/=]+)$/.exec(String(s || ""));
  if (!m) throw new Error("not an encrypted key");
  const b = Buffer.from(m[1], "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", master, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}

function writeSafe(p, text) {
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, text, { mode: 0o600 });
  fs.renameSync(tmp, p);
  try { fs.chmodSync(p, 0o600); } catch { /* Windows */ }
}

/** the store in <base>/settings - ONE per folder (the settings and the Community sign-in share it; two copies would each
 *  rewrite the file from their own cache and drop the other's key) */
const STORES = new Map();
function store(base, opts) {
  const dir = path.resolve(base, "settings");
  if (!STORES.has(dir)) STORES.set(dir, makeStore(dir, opts));
  return STORES.get(dir);
}
function makeStore(dir, opts) {
  const o = opts || {};
  const file = path.join(dir, "keys.json"), master = path.join(dir, "keys.master");
  const log = o.log || ((m) => console.log("[keys] " + m));
  let cache = null;
  function ensureDir() { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); try { fs.chmodSync(dir, 0o700); } catch { /* Windows */ } }
  function masterKey(make) {
    try { const h = fs.readFileSync(master, "utf8").trim(); if (/^[0-9a-f]{64}$/.test(h)) return Buffer.from(h, "hex"); } catch { /* none yet */ }
    if (!make) return null;
    ensureDir();
    const k = crypto.randomBytes(32);
    writeSafe(master, k.toString("hex") + "\n");
    return k;
  }
  /** -> {path: value}, decrypted; a key that cannot be opened is left out (and said once) */
  function read() {
    if (cache) return Object.assign({}, cache);
    let j = null; try { j = JSON.parse(fs.readFileSync(file, "utf8")); } catch { j = null; }
    const out = {};
    const keys = (j && isObj(j.keys)) ? j.keys : {};
    if (Object.keys(keys).length) {
      const mk = masterKey(false);
      if (!mk) {
        log(`${file} is there but ${master} is not - the keys cannot be opened; kept as keys.json.unreadable, add them again`);
        try { fs.renameSync(file, file + ".unreadable"); } catch { /* fine */ }
      } else {
        for (const [p, v] of Object.entries(keys)) {
          try { out[p] = decrypt(mk, v); } catch { log(`the saved ${p} could not be opened (keys.master changed?) - add it again`); }
        }
      }
    }
    cache = out;
    return Object.assign({}, out);
  }
  /** set the keys named (a name missing / empty in map = removed); the others stay. -> changed? */
  function update(names, map) {
    const cur = read(), next = Object.assign({}, cur);
    for (const n of names) { const v = (map || {})[n]; if (typeof v === "string" && v.trim()) next[n] = v; else delete next[n]; }
    if (JSON.stringify(Object.entries(next).sort()) === JSON.stringify(Object.entries(cur).sort())) return false;
    if (!Object.keys(next).length && !fs.existsSync(file)) { cache = next; return false; }
    const mk = masterKey(true);
    const keys = {};
    for (const [p, v] of Object.entries(next).sort()) keys[p] = encrypt(mk, v);
    ensureDir();
    writeSafe(file, JSON.stringify({ v: 1, alg: "aes-256-gcm", note: "bitGen Studio's API keys, each encrypted with settings/keys.master - copy this whole folder to keep them", keys }, null, 2) + "\n");
    cache = next;
    return true;
  }
  return { read, update, file, master, dir, names: () => Object.keys(read()), _drop: () => { cache = null; } };
}

module.exports = { PATHS, pick, strip, put, encrypt, decrypt, store };
