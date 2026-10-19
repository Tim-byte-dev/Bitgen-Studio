/* bitGen Studio — lib/helpDocs.js (2.530.0): the in-app HELP the Ctrl+K command palette searches and the 📖 Help window
 * shows (static/palette.js): docs/USAGE.md cut into its "## " sections + docs/shortcuts.json.
 * From the recommendations Tim asked to be worked through ("Ctrl+K command palette: type 'depth map', 'lora',
 * 'house' and jump to any docker, setting, or action").
 *   sections(md) (pure)  [{id, title, md (the section's own markdown, pictures left out), text (plain words, for the search)}]
 *   load(base)           both files, re-read when they change (mtime)
 */
"use strict";
const fs = require("fs");
const path = require("path");

function slug(t) { return String(t || "").toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "section"; }
function plain(md) {
  return String(md || "").replace(/```[\s\S]*?```/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>|]/g, " ").replace(/-{3,}/g, " ").replace(/\s+/g, " ").trim();
}
/** USAGE.md -> its "## " sections (pure) */
function sections(md) {
  const out = [], seen = {};
  let cur = null;
  for (const line of String(md || "").split(/\r?\n/)) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m && !/^###/.test(line)) {
      if (cur) out.push(cur);
      let id = slug(m[1]); if (seen[id]) id += "-" + (++seen[id]); else seen[id] = 1;
      cur = { id, title: m[1].replace(/[*`]/g, ""), lines: [] };
      continue;
    }
    if (cur && !/^!\[[^\]]*\]\([^)]*\)\s*$/.test(line)) cur.lines.push(line);
  }
  if (cur) out.push(cur);
  return out.map((s) => { const body = s.lines.join("\n").replace(/\n---\s*$/, "").trim(); return { id: s.id, title: s.title, md: body, text: plain(body).slice(0, 6000) }; });
}
let CACHE = { key: "", val: null };
function load(base) {
  const u = path.join(base, "docs", "USAGE.md"), k = path.join(base, "docs", "shortcuts.json");
  let key = "";
  try { key = fs.statSync(u).mtimeMs + ":" + fs.statSync(k).mtimeMs; } catch { key = "x"; }
  if (CACHE.key === key && CACHE.val) return CACHE.val;
  let md = "", sc = { groups: [] };
  try { md = fs.readFileSync(u, "utf8"); } catch { md = ""; }
  try { sc = JSON.parse(fs.readFileSync(k, "utf8")); } catch { sc = { groups: [] }; }
  const val = { sections: sections(md), shortcuts: { groups: (sc.groups || []).map((g) => ({ title: String(g.title || ""), rows: (g.rows || []).map((r) => [String(r[0]), String(r[1])]) })) } };
  CACHE = { key, val };
  return val;
}
module.exports = { slug, plain, sections, load };
