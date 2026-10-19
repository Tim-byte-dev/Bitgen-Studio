#!/usr/bin/env node
/* bitGen Studio — 2.299.2: EACH SCENE'S TYPE RADIO GROUP WORKS.
 * Run: node scripts/test-scenetype.js
 *
 * Tim (verbatim): "let the user select from the radio group for each scene
 * ref, first, cont, trans, check to see if it a valid group, make the group
 * name scene_<n>_type_group for each scene created. i think they all have
 * the same name now so it doesn't change."
 *
 * What was wrong: the names were already per scene (scAnchor1, ...), but a
 * click on a radio or its label BUBBLED to the scene card, whose click
 * selects the card and REPAINTS the list - the radio was replaced before
 * its change event fired, so the pick never reached the server. In jsdom
 * the card's repaint is observable the same way (the probe counts it).
 *   1. one group per scene: name scene_<n>_type_group, four radios with
 *      ids scene_<n>_type_<type> and labels FOR them, one checked;
 *   2. a LABEL click and a RADIO click each change the type, post it, and
 *      never reach the card (no select, no repaint swallowing it);
 *   3. the card follows the pick at once (Ref: Last slot only);
 *   4. a radio that is not a valid group member (wrong name / value) posts
 *      nothing and says so. */
"use strict";
const path = require("path");
const { execFileSync } = require("child_process");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const J = (x) => JSON.stringify(x);

const probe = `
const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM("<body>" + fs.readFileSync("ext/videodock/dock.html", "utf8") + "</body>",
  { url: "http://x/", runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
const posts = [];
const board = { chapters: [], pending: [], plan: { shots: [] }, style: "MMH3_NativeAudio_MV", audio: "",
  list: [{ n: 1, id: "c1", prompt: ["a"], status: "idle", anchor: "reference" },
         { n: 2, id: "c2", prompt: ["b"], status: "idle", anchor: "last" },
         { n: 3, id: "c3", prompt: ["c"], status: "idle", anchor: "continue" }] };
w.fetch = (u, o) => {
  u = String(u); const bare = u.split("?")[0];
  const ok = (b) => Promise.resolve({ ok: true, json: () => Promise.resolve(b) });
  if (o && o.method === "POST") {
    posts.push([bare, o.body]);
    const m = /^\\/api\\/scenes\\/(\\d+)\\/anchor$/.exec(bare);
    if (m) { const r = board.list.find((x) => x.n === +m[1]); const a = JSON.parse(o.body).anchor;
             r.anchor = a; return ok({ ok: true, n: r.n, anchor: a }); }
  }
  if (bare === "/api/scenes") return ok(JSON.parse(JSON.stringify(board)));
  if (bare === "/api/pmedia") return ok({ sound: [], images: [] });
  return ok({ ok: true, characters: [], environments: [], refs: {}, movies: [] });
};
global.window = w; global.document = w.document; global.fetch = w.fetch;
global.FormData = w.FormData; global.CustomEvent = w.CustomEvent;
w.eval(fs.readFileSync("static/pmedia.js", "utf8"));
const src = fs.readFileSync("ext/videodock/characters.js", "utf8");
const ids = new Set(); src.replace(/el\\("([\\w-]+)"\\)/g, (m, id) => ids.add(id));
for (const id of ids) if (!w.document.getElementById(id)) {
  const e = w.document.createElement(/Sel$|Select$/.test(id) ? "select" : "input");
  e.id = id; e.style.display = "none"; w.document.body.appendChild(e);
}
w.eval(src);
const q = (s) => w.document.querySelector(s);
const qa = (s) => [...w.document.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// count repaints of the scene list (the card's select repaints it)
let paints = 0;
new w.MutationObserver(() => { paints++; }).observe(w.document.getElementById("scList"), { childList: true });
(async () => {
  const out = {};
  w.document.dispatchEvent(new w.CustomEvent("vd:scenes-changed"));
  await wait(300);
  out.groups = [1, 2, 3].map((n) => {
    const r = qa('[data-scanchor="' + n + '"]');
    return { names: [...new Set(r.map((x) => x.name))], ids: r.map((x) => x.id),
      labels: r.map((x) => { const l = q('label[for="' + x.id + '"]'); return l ? l.textContent : null; }),
      checked: r.filter((x) => x.checked).map((x) => x.value),
      role: (q('[data-scanchorgroup="' + n + '"]') || {}).getAttribute ? q('[data-scanchorgroup="' + n + '"]').getAttribute("role") : null };
  });
  // a LABEL click on scene 2's Trans
  posts.length = 0;
  const sel0 = qa(".sccard").filter((c) => /background:#20242c/.test(c.getAttribute("style"))).length;
  q('label[for="scene_2_type_transition"]').click();
  await wait(200);
  out.afterLabel = { posts: posts.map((p) => [p[0], JSON.parse(p[1])]),
    checked: qa('[data-scanchor="2"]').filter((x) => x.checked).map((x) => x.value),
    selectedCards: qa(".sccard").filter((c) => /background:#20242c/.test(c.getAttribute("style"))).length,
    sel0, stored: board.list[1].anchor, notes: q("#scNotes").textContent };
  // a RADIO click on scene 1's First
  posts.length = 0;
  q("#scene_1_type_first").click();
  await wait(200);
  out.afterRadio = { posts: posts.map((p) => [p[0], JSON.parse(p[1])]),
    checked: qa('[data-scanchor="1"]').filter((x) => x.checked).map((x) => x.value),
    slots1: qa('[data-scfl="1"]').map((x) => x.dataset.slot) };
  // back to Ref: the First slot goes
  q('label[for="scene_1_type_reference"]').click();
  await wait(200);
  out.refSlots = qa('[data-scfl="1"]').map((x) => x.dataset.slot);
  // an invalid group member: a radio whose value is not a scene type
  posts.length = 0;
  const bad = q("#scene_3_type_first");
  bad.value = "sideways";
  bad.checked = true;
  bad.dispatchEvent(new w.Event("change", { bubbles: true }));
  await wait(100);
  out.bad = { posts: posts.length, notes: q("#scNotes").textContent };
  // a radio moved to another scene's group name
  const moved = q("#scene_3_type_transition");
  moved.name = "scene_2_type_group";
  moved.checked = true;
  moved.dispatchEvent(new w.Event("change", { bubbles: true }));
  await wait(100);
  out.moved = { posts: posts.length };
  console.log("@@ST " + JSON.stringify(out));
  process.exit(0);
})();`;
let d = null;
try {
  const o = execFileSync(process.execPath, ["-e", probe], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
  const line = o.split("\n").find((l) => l.startsWith("@@ST "));
  d = line ? JSON.parse(line.slice(5)) : { raw: o.slice(-800) };
} catch (e) { d = { error: String(e.message).slice(0, 800) }; }

const T = ["reference", "first", "continue", "transition"];
check("one radio group per scene, named scene_<n>_type_group (a radiogroup)",
  d && d.groups && d.groups.every((g, i) => J(g.names) === J([`scene_${i + 1}_type_group`]) && g.role === "radiogroup"),
  d && d.groups);
check("each radio has its own id scene_<n>_type_<type> and a label FOR it (Ref, First, Cont, Trans)",
  d && d.groups && d.groups.every((g, i) => J(g.ids) === J(T.map((t) => `scene_${i + 1}_type_${t}`))
    && J(g.labels) === '["Ref","First","Cont","Trans"]'), d && d.groups);
check("exactly one is checked per scene - the stored type (an old \"last\" shows as First)",
  d && d.groups && J(d.groups.map((g) => g.checked)) === '[["reference"],["first"],["continue"]]', d && d.groups);
check("a LABEL click changes the scene's type, posts it once, and never reaches the card (no card selected)",
  d && d.afterLabel && J(d.afterLabel.posts) === J([["/api/scenes/2/anchor", { anchor: "transition" }]])
  && J(d.afterLabel.checked) === '["transition"]' && d.afterLabel.stored === "transition"
  && d.afterLabel.selectedCards === d.afterLabel.sel0 && /scene 2 is Trans/.test(d.afterLabel.notes), d && d.afterLabel);
check("a RADIO click does the same, and the card follows at once (First: First + Last frame slots)",
  d && d.afterRadio && J(d.afterRadio.posts) === J([["/api/scenes/1/anchor", { anchor: "first" }]])
  && J(d.afterRadio.checked) === '["first"]' && J(d.afterRadio.slots1) === '["first","last"]', d && d.afterRadio);
check("back to Ref: the First slot goes, Last stays", d && J(d.refSlots) === '["last"]', d && d.refSlots);
check("a value that is not a scene type posts NOTHING and is refused in words",
  d && d.bad && d.bad.posts === 0 && /"sideways" is not a scene type/.test(d.bad.notes), d && d.bad);
check("a radio whose name is another scene's group posts nothing", d && d.moved && d.moved.posts === 0, d && d.moved);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
