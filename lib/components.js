"use strict";
/**
 * components.js — components.txt: WHICH OPTIONAL COMPONENTS ARE INSTALLED (2.353.0).
 *
 * Tim: "check to see if viggle native is installed on start, add a file components.txt, if a component
 * like viggle gets installed list it - viggle native=1 if not installed, viggle native=0, if start finds
 * viggle=0 then install viggle, check if comfy workflow for the component exists, if it exists use the
 * models in the workflow so user doesn't have to dl new ones".
 *
 * The file sits at the install root, one component per line:
 *
 *     # bitGen Studio components - 0 = install it on the next start, 1 = installed, 2 = do not install
 *     viggle native=1
 *
 * 2.355.0 (Tim: "give option in the initial install to install native viggle, show size to dl. if not
 * selected then make viggle=2 in components.txt, in start change to if viggle=0 then install, if 1 already
 * installed, an 2 - do not install"): the three values -
 *     0  install it on the next start          (the setup wizard's ticked box, or no line yet)
 *     1  installed - nothing to do              (written when the install is there)
 *     2  do not install                         (the wizard's unticked box; "skip" / "off" / "no" too)
 * The start only ever installs on 0. Whatever is actually installed is written 1 (a 2 the user installed
 * himself with the swap dialog's ⚙ ⤓ Install too); a 2 that is not installed stays 2.
 * routes/components.js runs the start check and the install; this module is the file + the decision.
 */
const fs = require("fs");
const path = require("path");

const NAME = "components.txt";
const HEADER = [
  "# bitGen Studio components - 0 = install it on the next start, 1 = installed, 2 = do not install",
  "# (the swap dialog's ⚙ ⤓ Install can still install a 2)",
];
// the components the start check knows (key = the name in the file)
const KNOWN = [{ key: "viggle native", label: "Viggle (native)" }];
const SKIP = new Set(["2", "skip", "off", "no", "never", "-1"]);

function file(base) { return path.join(base || ".", NAME); }

/** {key: "1" | "0" | "skip" | ...} (keys lower-cased, trimmed; comments and junk ignored). */
function read(base) {
  const out = {};
  let txt = "";
  try { txt = fs.readFileSync(file(base), "utf8"); } catch { return out; }
  for (const line of txt.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    out[t.slice(0, i).trim().toLowerCase().replace(/\s+/g, " ")] = t.slice(i + 1).trim().toLowerCase();
  }
  return out;
}

/** Write {key: value}; lines for keys not given are kept. -> the path. */
function write(base, values) {
  const cur = read(base);
  const all = { ...cur, ...values };
  const keys = [...KNOWN.map((k) => k.key), ...Object.keys(all).filter((k) => !KNOWN.some((x) => x.key === k)).sort()];
  const body = HEADER.concat(keys.filter((k) => k in all).map((k) => `${k}=${all[k]}`)).join("\n") + "\n";
  const f = file(base);
  let old = null;
  try { old = fs.readFileSync(f, "utf8"); } catch {}
  if (old !== body) fs.writeFileSync(f, body);
  return f;
}

const isSkip = (v) => SKIP.has(String(v || "").toLowerCase());

/**
 * The start decision for one component (PURE). o = {key, installed (bool), current (the file's value or
 * undefined), busy (an install is already running), allowed (auto-install permitted)}.
 * -> {value (what the file gets), action: "none" | "install", why}
 */
function decide(o) {
  const cur = o.current;
  if (o.installed) return { value: "1", action: "none", why: `${o.key} is installed` };   // (a 2 installed by hand too)
  if (isSkip(cur)) return { value: cur, action: "none", why: `${o.key}=${cur} in ${NAME} - do not install` };
  if (String(cur) === "1") return { value: "1", action: "none",
    why: `${o.key}=1 in ${NAME} (installed) - nothing installed on start; its files are not all there, set it to 0 to install it again` };
  if (o.busy) return { value: "0", action: "none", why: `${o.key} is not installed - its install is already running` };
  if (!o.allowed) return { value: "0", action: "none", why: `${o.key} is not installed - install on start is off here` };
  return { value: "0", action: "install", why: `${o.key} is not installed - installing it` };
}

module.exports = { NAME, HEADER, KNOWN, file, read, write, isSkip, decide };
