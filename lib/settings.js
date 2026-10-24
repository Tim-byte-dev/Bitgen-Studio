"use strict";
/**
 * Layered settings (2.99.0, by instruction).
 *
 *   code DEFAULT_CONFIG  ->  default.settings  ->  custom.settings  =  effective
 *
 * Tim: "write a default settings file with default settings that works for all
 * our features. when we change the settings save the new settings as
 * custom.settings, default.settings will be the default, in the general tab add
 * a reset settings button."
 *
 *  - default.settings  ships with the app and is (re)written from the code
 *    defaults when missing, so there is always a file to read and edit. It is
 *    never written by a Save.
 *  - custom.settings   holds ONLY what differs from default.settings — a deep
 *    diff — so editing a default later flows through to everything the user
 *    never touched, and a reset is simply "no custom layer".
 *  - config.json       is the pre-2.99 store. On first boot it becomes the
 *    custom layer (migrated to custom.settings, renamed *.migrated) so nothing a
 *    user set is lost, and misc\\clear-comfy.bat reads the new files first.
 *
 * Everything here takes paths, so scripts/test-settings.js exercises it in a
 * temp dir; lib/core.js is the only production caller and just binds BASE.
 */
const fs = require("fs");
const path = require("path");

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Recursive merge: objects merge, arrays and scalars replace. Never mutates. */
function deepMerge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : clone(over);
  const out = clone(base);
  for (const [k, v] of Object.entries(over)) {
    out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : clone(v);
  }
  return out;
}

/** Keys of `cur` whose value differs from `base`, recursively. {} when equal. */
function deepDiff(cur, base) {
  const out = {};
  if (!isObj(cur)) return out;
  for (const [k, v] of Object.entries(cur)) {
    const b = isObj(base) ? base[k] : undefined;
    if (isObj(v) && isObj(b)) {
      const d = deepDiff(v, b);
      if (Object.keys(d).length) out[k] = d;
    } else if (JSON.stringify(v) !== JSON.stringify(b)) {
      out[k] = clone(v);
    }
  }
  return out;
}

function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

/**
 * Load the three layers. Returns { config, base, notes } where `base` is the
 * default layer the custom diff is taken against, and `notes` says what
 * happened (a migration, a rewritten defaults file) for the boot log.
 */
function load({ defaults, defaultsPath, customPath, legacyPath }) {
  const notes = [];
  let fileDefaults = readJson(defaultsPath);
  if (!fileDefaults) {
    // Missing or unreadable: (re)write it from the code defaults so the user
    // always has a real file to look at and edit. An unreadable one is kept
    // aside rather than silently replaced.
    if (fs.existsSync(defaultsPath)) {
      try { fs.renameSync(defaultsPath, defaultsPath + ".broken"); notes.push("default.settings was unreadable; kept as default.settings.broken"); } catch {}
    }
    writeJson(defaultsPath, defaults);
    fileDefaults = clone(defaults);
    notes.push("default.settings written from the code defaults");
  }
  const base = deepMerge(defaults, fileDefaults);
  let custom = readJson(customPath);
  if (!custom && legacyPath && fs.existsSync(legacyPath)) {
    // pre-2.99 config.json: it IS the user's settings — keep every bit of it
    const legacy = readJson(legacyPath);
    if (legacy) {
      custom = deepDiff(deepMerge(base, legacy), base);
      writeJson(customPath, custom);
      try { fs.renameSync(legacyPath, legacyPath + ".migrated"); } catch {}
      notes.push("config.json migrated to custom.settings (old file kept as config.json.migrated)");
    }
  }
  const config = custom ? deepMerge(base, custom) : clone(base);
  return { config, base, notes };
}

/** Persist: only the diff from the default layer goes to custom.settings. */
function save({ config, base, customPath }) {
  writeJson(customPath, deepDiff(config, base));
}

/**
 * Reset: drop the custom layer (kept as custom.settings.bak) and return the
 * defaults. `keep` names top-level keys that are STATE rather than settings
 * (the open project) and survive the reset.
 */
function reset({ base, customPath, current, keep = [] }) {
  if (fs.existsSync(customPath)) {
    try { fs.copyFileSync(customPath, customPath + ".bak"); } catch {}
  }
  const config = clone(base);
  for (const k of keep) if (current && current[k] !== undefined) config[k] = clone(current[k]);
  writeJson(customPath, deepDiff(config, base));
  return config;
}

module.exports = { deepMerge, deepDiff, load, save, reset, readJson, writeJson };
