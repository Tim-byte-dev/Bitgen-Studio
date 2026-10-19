#!/usr/bin/env node
/* bitGen Studio — 2.530.0 units: ⌕ THE COMMAND PALETTE - static/palette.js's search (every word must match, the label
 * counts most, recent first) and its markdown for the 📖 Help window, lib/helpDocs.js (docs/USAGE.md cut into sections,
 * docs/shortcuts.json), routes/help.js. From the recommendations: "Ctrl+K command palette: type 'depth map', 'lora',
 * 'house' and jump to any docker, setting, or action" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const P = require("../static/palette.js"), HD = require("../lib/helpDocs.js");

const E = [
  { id: "w:house", group: "Window", label: "🏠 House builder", hint: "draw a floor plan, furnish it, see it in 3D; shots + depth maps" },
  { id: "w:lora", group: "Window", label: "LoRA & fine-tune trainer", hint: "LoRAs and checkpoint fine-tunes" },
  { id: "s:lorafolder", group: "Settings", label: "LoRA folder", hint: "Settings › Paths" },
  { id: "d:tl", group: "Docker", label: "Timeline", hint: "Timeline dock" },
  { id: "d:pv", group: "Docker", label: "Preview", hint: "the player above the timeline" },
  { id: "h:cn", group: "Help", label: "Images, ControlNet and face fix", hint: "the guide", body: "turns it into a control image (lineart, depth, pose) and a depth map", boost: -1 },
  { id: "k:bug", group: "Keys", label: "🐞 Bug report", hint: "Ctrl+Alt+Shift+B · Anywhere in the app", keys: "Ctrl+Alt+Shift+B", boost: -1 },
];
const ids = (q, r) => P.rank(E, q, r || []).map((e) => e.id);
check("every word must match somewhere (label, hint or the guide's text)", JSON.stringify(ids("depth map")) === JSON.stringify(["w:house", "h:cn"]) && ids("lora spaceship").length === 0, ids("depth map"));
check("the label counts most: 'lora' -> the LoRA folder / trainer before anything that only mentions it", ids("lora").slice(0, 2).sort().join() === "s:lorafolder,w:lora" && !ids("lora").includes("w:house"));
check("a label that starts with the words comes first ('timeline' -> the Timeline docker, then the Preview that mentions it)", JSON.stringify(ids("timeline")) === JSON.stringify(["d:tl", "d:pv"]), ids("timeline"));
check("a shortcut by its keys", JSON.stringify(ids("ctrl+alt+shift+b")) === JSON.stringify(["k:bug"]));
check("words in any order, any case", JSON.stringify(ids("FLOOR house")) === JSON.stringify(["w:house"]));
const two = [{ id: "a", label: "Music dock" }, { id: "b", label: "Music video workspace" }];
check("recently run ones first: an empty query lists them in order; with words a recent one beats an equal match", ids("", ["d:pv", "w:lora"])[0] === "d:pv" && ids("", ["d:pv", "w:lora"])[1] === "w:lora" && P.rank(two, "music", ["b"])[0].id === "b" && P.rank(two, "music", [])[0].id === "a");
check("at most 60", P.rank(Array.from({ length: 200 }, (_, i) => ({ id: "x" + i, label: "item " + i })), "item").length === 60);
const html = P.mdToHtml("Some **bold**, *it* and `code` and a [link](x.md).\n\n| Area | What |\n|---|---|\n| **Left** | stats <b>x</b> |\n\n- one\n  more\n- two\n\n1. first\n2. second\n\n### Sub head\n\n```\nnpm i\n```");
check("mdToHtml: bold, italic, code, a link's words, a table with a header row, lists (a wrapped item joined), a heading, a code block", /<b>bold<\/b>/.test(html) && /<i>it<\/i>/.test(html) && /<code>code<\/code>/.test(html) && /a link\./.test(html) && /<th>Area<\/th>/.test(html) && /<td><b>Left<\/b><\/td>/.test(html) && /<li>one more<\/li>/.test(html) && /<ol><li>first<\/li>/.test(html) && /<h4>Sub head<\/h4>/.test(html) && /<pre><code>npm i<\/code><\/pre>/.test(html), html);
check("…and escaped (the guide can never inject markup)", /stats &lt;b&gt;x&lt;\/b&gt;/.test(html) && !/<script/.test(P.mdToHtml("<script>alert(1)</script>")));

/* ---- the guide cut into sections */
const S = HD.sections("# Using\n\nintro\n\n## The window\n\n![shot](images/a.png)\n\n| a | b |\n\n### Sub\n\ntext\n\n---\n\n## The window\n\nagain\n");
check("sections: each '## ' a section (### stays inside), pictures left out, the same title twice gets its own id", S.length === 2 && S[0].id === "the-window" && S[1].id === "the-window-2" && /### Sub/.test(S[0].md) && !/images\/a\.png/.test(S[0].md) && !/---\s*$/.test(S[0].md), S);
check("…its plain words for the search", S[0].text === "a b Sub text");
const real = HD.load(path.join(__dirname, ".."));
check("the real guide: 150+ sections (the House builder, the Style doctor, Workspaces among them) + the shortcut groups", real.sections.length > 150 && ["house builder", "style doctor", "workspaces"].every((w) => real.sections.some((s) => s.title.toLowerCase().includes(w))) && real.shortcuts.groups.length >= 15, real.sections.length);
check("…Ctrl+K is in the shortcuts (Anywhere in the app)", real.shortcuts.groups[0].rows.some((r) => r[0] === "Ctrl+K" && /Find anything/.test(r[1])));
check("…cached until a file changes", HD.load(path.join(__dirname, "..")) === real);

/* ---- the route */
const T = fs.mkdtempSync(path.join(os.tmpdir(), "pal530-"));
fs.mkdirSync(path.join(T, "docs"));
fs.writeFileSync(path.join(T, "docs", "USAGE.md"), "## One\n\nfirst\n\n## Two\n\nsecond\n");
fs.writeFileSync(path.join(T, "docs", "shortcuts.json"), JSON.stringify({ groups: [{ title: "Anywhere", rows: [["Ctrl+K", "Find anything"]] }] }));
const stub = (rel, exp) => { const p = require.resolve(rel); require.cache[p] = { id: p, filename: p, loaded: true, exports: exp }; };
stub("../lib/core.js", { BASE: T });
const express = require("express");
const app = express(); require("../routes/help.js").mount(app);
const srv = app.listen(0, "127.0.0.1", async () => {
  try {
    const j = await (await fetch("http://127.0.0.1:" + srv.address().port + "/api/help")).json();
    check("GET /api/help: the sections + the shortcuts", j.sections.length === 2 && j.sections[1].title === "Two" && j.shortcuts.groups[0].rows[0][0] === "Ctrl+K", j);
  } catch (e) { check("the route ran", false, String(e && e.stack || e)); }
  srv.close(); fs.rmSync(T, { recursive: true, force: true });
  const root = path.join(__dirname, "..");
  check("pins: routes/help.js mounted from routes/index.js (not server.js)", /require\("\.\/help"\)\.mount\(app\)/.test(fs.readFileSync(path.join(root, "routes", "index.js"), "utf8")) && !/helpDocs/.test(fs.readFileSync(path.join(root, "server.js"), "utf8")));
  check("pins: index.html loads static/palette.js", fs.readFileSync(path.join(root, "static", "index.html"), "utf8").includes('<script src="/static/palette.js"></script>'));
  check("pins: the 🧪 checklist has the 2.530 group", JSON.parse(fs.readFileSync(path.join(root, "lib", "testPlan.json"), "utf8")).groups.some((g) => g.id === "g530"));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
});
