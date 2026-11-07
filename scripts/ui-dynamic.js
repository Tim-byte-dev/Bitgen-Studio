#!/usr/bin/env node
/* bitGen Studio — scripts/ui-dynamic.js (2.706.0): THE WORDS THE APP BUILDS WHILE IT RUNS, read from its code, for the UI
 * translations (static/uilang.js). ui-strings.js collects what one run happens to show; this reads every place the code
 * WRITES words - el.textContent / innerText / title / placeholder / innerHTML = …, setAttribute("title", …) - and turns each
 * expression into the strings it can produce:
 *   "Saved"                                        -> a string
 *   `Installed ${name} (${size})`                  -> a PATTERN  "Installed {0} ({1})"      (any value fills a {n})
 *   (a ? "floating" : "in its place") + " · " + h + " px high"
 *                                                  -> "floating · {0} px high", "in its place · {0} px high"
 *   innerHTML = `<b>${n}</b> files - <i>ready</i>` -> its text pieces: "files -", "ready"
 * Scope (2.706.0, Tim: "do the settings dialog next, the other dockers can go into the next edit"): the Settings dialog -
 * the files that draw its tabs (FILES) and, in static/index.html, the code that writes into an element of the dialog.
 *   node scripts/ui-dynamic.js [--all]     -> static/i18n/ui/dynamic.json {strings: [{s, src}], patterns: [{p, src}]}
 * Needs the TypeScript compiler as a JavaScript parser (npm i -g typescript - a developer tool, not shipped with the app).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
let ts;
for (const p of ["typescript", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "typescript"); } catch (e) { return ""; } })()]) { if (!p) continue; try { ts = require(p); break; } catch (e) { /* next */ } }
if (!ts && require.main === module) { console.log("needs the TypeScript compiler (npm i -g typescript)"); process.exit(2); }
const ROOT = path.join(__dirname, "..");
const U = require(path.join(ROOT, "static", "uilang.js"));
// the files that draw Settings' tabs (each writes only there, or mostly there)
const FILES = ["about.js", "addons.js", "comfyupdate.js", "dockreset.js", "hwpanel.js", "llmtab.js", "remotegpu.js", "settings3d.js",
  "speechengines.js", "updater.js", "layouts.js", "stylecard.js"].map((f) => path.join(ROOT, "static", f));
const PROPS = new Set(["textContent", "innerText", "title", "placeholder", "innerHTML", "value"]);
const MAXALT = 12;

/** the ids of every element inside <dialog id="settings"> (the static HTML) */
function settingsIds(html) {
  const a = html.indexOf('<dialog id="settings">'), b = html.indexOf("</dialog>", a);
  const ids = new Set(); for (const m of html.slice(a, b).matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
  return ids;
}
/** the strings an expression can produce, as patterns ({n} = a value the code fills in) - at most MAXALT */
function forms(node, sf) {
  const K = ts.SyntaxKind;
  const lit = (t) => [{ t, n: 0 }];
  const hole = () => [{ t: "\u0000", n: 1 }];
  const cat = (A, B) => { const out = []; for (const a of A) for (const b of B) { out.push({ t: a.t + b.t, n: a.n + b.n }); if (out.length >= MAXALT) return out; } return out; };
  const go = (e) => {
    switch (e.kind) {
      case K.StringLiteral: case K.NoSubstitutionTemplateLiteral: return lit(e.text);
      case K.NumericLiteral: return lit(e.text);
      case K.ParenthesizedExpression: return go(e.expression);
      case K.TemplateExpression: { let acc = lit(e.head.text); for (const sp of e.templateSpans) { acc = cat(cat(acc, go(sp.expression)), lit(sp.literal.text)); } return acc; }
      case K.BinaryExpression:
        if (e.operatorToken.kind === K.PlusToken) return cat(go(e.left), go(e.right));
        if (e.operatorToken.kind === K.BarBarToken || e.operatorToken.kind === K.QuestionQuestionToken) { const r = go(e.right); return [...hole(), ...r].slice(0, MAXALT); }
        return hole();
      case K.ConditionalExpression: return [...go(e.whenTrue), ...go(e.whenFalse)].slice(0, MAXALT);
      default: return hole();
    }
  };
  return go(node);
}
/** a produced string -> its text pieces (innerHTML: split at tags), placeholders numbered, the app's split() applied */
function pieces(t, html) {
  const parts = html ? t.split(/<[^>]*>|&[a-z]+;|&#\d+;/) : [t];
  const out = [];
  for (const raw of parts) {
    if (!raw || !/[A-Za-z]{2}/.test(raw.replace(/\u0000/g, ""))) continue;
    const core = U.split(raw.replace(/\u0000/g, "Zq9hole")).core.replace(/Zq9hole/g, "\u0000").trim();      // a hole is a word for split (kept, even first)
    if (!core) continue;
    const letters = core.replace(/\u0000/g, "").replace(/[^A-Za-z]/g, "");
    if (letters.length < 2 || /^[\u0000\s\W\d]*$/.test(core.replace(/[A-Za-z]{1}\b/g, ""))) continue;
    let k = 0; const p = core.replace(/\u0000+/g, () => "{" + (k++) + "}").replace(/\s+/g, " ");
    if (/^\{0\}$/.test(p) || /^[\w.-]+\.(js|json|png|py|bat|sh|safetensors|gguf)$/i.test(p) || /^https?:/.test(p)) continue;
    if (/^[a-z_$][\w$]*(\.[\w$]+)+$/.test(p)) continue;                 // code-like (a.b.c)
    if (/[{};]/.test(p.replace(/\{\d+\}/g, "")) && /:\s*[^\s]/.test(p) && /;/.test(p)) continue;   // CSS written into a <style>
    out.push(p);
  }
  return out;
}
function scan(code, file, onlyIds) {
  const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const res = []; const K = ts.SyntaxKind;
  const targetOk = (expr) => { if (!onlyIds) return true; const t = expr.getText(sf); for (const m of t.matchAll(/["'`]([A-Za-z][\w-]*)["'`]/g)) if (onlyIds.has(m[1])) return true; return false; };
  const take = (rhs, html, node) => { const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1; for (const f of forms(rhs, sf)) for (const p of pieces(f.t, html)) res.push({ p, src: path.basename(file) + ":" + line }); };
  // .push(…) words count when the function they are in writes into the Settings dialog (all of a Settings file's own code)
  const fnOf = (n) => { let p = n.parent; while (p && !ts.isFunctionLike(p)) p = p.parent; return p; };
  const pushOk = (n) => { if (!onlyIds) return true; const f = fnOf(n); if (!f) return false; const t = f.getText(sf); for (const m of t.matchAll(/["'`]([A-Za-z][\w-]*)["'`]/g)) if (onlyIds.has(m[1])) return true; return false; };
  const visit = (n) => {
    if (n.kind === K.BinaryExpression && n.operatorToken.kind === K.EqualsToken && n.left.kind === K.PropertyAccessExpression && PROPS.has(n.left.name.text)) {
      const prop = n.left.name.text;
      if (prop !== "value" && targetOk(n.left.expression)) take(n.right, prop === "innerHTML", n);
    } else if (n.kind === K.CallExpression && n.expression.kind === K.PropertyAccessExpression && n.expression.name.text === "push" && n.arguments.length === 1 && pushOk(n)) {
      take(n.arguments[0], false, n);            // lines.push("…") / p.push(h + " px high") - joined into one text later (static/uilang.js trAll)
    } else if (n.kind === K.CallExpression && n.expression.kind === K.PropertyAccessExpression && n.expression.name.text === "setAttribute" && n.arguments.length === 2
      && n.arguments[0].kind === K.StringLiteral && /^(title|placeholder|aria-label)$/.test(n.arguments[0].text) && targetOk(n.expression.expression)) take(n.arguments[1], false, n);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return res;
}
if (require.main === module) {
  const html = fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8"), ids = settingsIds(html);
  const all = [];
  // index.html's own scripts: only code writing into an element of the Settings dialog
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) all.push(...scan(m[1], "index.html", ids));
  for (const f of FILES) if (fs.existsSync(f)) all.push(...scan(fs.readFileSync(f, "utf8"), f, null));
  const S = new Map(), P = new Map();
  for (const r of all) { const m = /\{\d+\}/.test(r.p) ? P : S; if (!m.has(r.p)) m.set(r.p, r.src); }
  const out = { made: new Date().toISOString().slice(0, 10), scope: "settings", strings: [...S].map(([s, src]) => ({ s, src })), patterns: [...P].map(([p, src]) => ({ p, src })) };
  fs.writeFileSync(path.join(ROOT, "static", "i18n", "ui", "dynamic.json"), JSON.stringify(out, null, 1) + "\n");
  console.log(`ui-dynamic: ${out.strings.length} strings, ${out.patterns.length} patterns (settings ids ${ids.size})`);
}
module.exports = { forms, pieces, scan, settingsIds, hasParser: !!ts };
