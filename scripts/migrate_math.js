#!/usr/bin/env node
/* bitGen Studio — rewrite custom math nodes as ComfyUI's core Math Expression in workflow files (2.401.2).
 * Tim: "comfy math nodes are no longer available, ltx2.5 workflow does not work, nodes not found".
 *   node scripts/migrate_math.js [file|folder ...]   (default: comfy_workflows) - UI exports only; lists what changed
 *   node scripts/migrate_math.js --check [...]        exit 1 naming any file that still uses ComfyMath / pysssss math
 * The conversion itself is lib/mathNodes.js (also run on every LTX conversion and, for a ComfyUI without the pack,
 * on every graph conversion). */
"use strict";
const fs = require("fs");
const path = require("path");
const M = require(path.join(__dirname, "..", "lib", "mathNodes"));

function files(args) {
  const out = [];
  for (const a of args) {
    let st = null;
    try { st = fs.statSync(a); } catch { continue; }
    if (st.isDirectory()) for (const f of fs.readdirSync(a)) { if (/\.json$/i.test(f)) out.push(path.join(a, f)); }
    else if (/\.json$/i.test(a)) out.push(a);
  }
  return out.sort();
}
function main(argv) {
  const check = argv.includes("--check");
  const args = argv.filter((a) => !a.startsWith("--"));
  const list = files(args.length ? args : [path.join(__dirname, "..", "comfy_workflows")]);
  let bad = 0, n = 0;
  for (const f of list) {
    let raw, ui;
    try { raw = fs.readFileSync(f, "utf8"); ui = JSON.parse(raw); } catch { continue; }
    if (!ui || !Array.isArray(ui.nodes)) continue;
    const left = M.leftover(ui);
    if (!left.length) continue;
    if (check) { bad++; console.log(`NOT MIGRATED: ${f} (${left.join(", ")})`); continue; }
    const done = M.migrate(ui);
    const m = /\n( +)["{[]/.exec(raw);
    fs.writeFileSync(f, JSON.stringify(ui, null, m ? m[1].length : 0) + (raw.endsWith("\n") ? "\n" : ""));
    n += done.length;
    console.log(`migrated: ${f} (${done.length}: ${[...new Set(done.map((d) => d.from))].join(", ")})`);
  }
  console.log(check ? (bad ? `RESULT: ${bad} file(s) still use custom math nodes` : "RESULT: clean") : `RESULT: ${n} math node(s) migrated`);
  return check && bad ? 1 : 0;
}
if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { main };
