#!/usr/bin/env node
/* bitGen Studio — 2.327.0: THE ASSETS DOCK - select, group, send, delete.
 * Run: node scripts/test-assetgroups.js
 * Tim: "allow user to select multiple items from the asset folder and group
 * them. allow user to delete assets (send to recycle bin) create new folders
 * for groups, allow user to add assets to group or send asset to a group".
 * Answers: folders in the dock (files never move) · mixed kinds · Add = also,
 * Send = move.
 *   1. lib/assetGroups: create / rename / delete / add / send / ungroup /
 *      forget / prune / usage, the name rules, load + save on a real dir;
 *   2. the wiring (routes/assets.js mounted from routes/index.js, the bin);
 *   3. static/assetgroups.js in jsdom: sections, the bar, select (checkbox,
 *      Ctrl, Shift range, plain click = lightbox), the calls for Group /
 *      Add / Send / Ungroup / Delete, the Delete key, a drop on a header. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const G = require(path.join(ROOT, "lib", "assetGroups"));

// ---- 1. lib/assetGroups
const A = { kind: "images", name: "a.png" }, B = { kind: "video", name: "b.mp4" }, C = { kind: "sound", name: "c.wav" };
let r = G.create(G.blank(), "Heroes", [A, B, A, { kind: "nope", name: "x" }, { kind: "images", name: "../evil.png" }]);
check("create: a group with the selection, duplicates + bad kinds dropped, names basename'd",
  !r.error && r.group.name === "Heroes" && r.state.groups[0].items.length === 3
  && r.state.groups[0].items[2].name === "evil.png", r.state);
let st = r.state;
const heroes = st.groups[0].id;
check("create: a clashing name (any case) or a blank one is refused",
  G.create(st, "heroes").error && G.create(st, "   ").error && G.create(st, "x".repeat(81)).error);
r = G.create(st, "Villains"); st = r.state; const vill = r.group.id;
check("groups can mix pictures, videos and sounds", G.add(st, vill, [C, A]).state.groups[1].items.length === 2);
st = G.add(st, vill, [C, A]).state;
check("ADD = also: the asset stays in its other group", st.groups[0].items.some((i) => i.name === "a.png")
  && st.groups[1].items.some((i) => i.name === "a.png"));
r = G.send(st, vill, [B], heroes);
check("SEND = move: out of the group it was picked in, into the target",
  !r.state.groups[0].items.some((i) => i.name === "b.mp4") && r.state.groups[1].items.some((i) => i.name === "b.mp4"));
r = G.create(st, "Extras", [A]); let st3 = r.state;
r = G.send(st3, vill, [A]);
check("SEND with no 'from' = out of every other group",
  r.state.groups.filter((g) => g.items.some((i) => i.name === "a.png")).map((g) => g.name).join() === "Villains");
r = G.send(st3, vill, [A], heroes);
check("SEND from one group leaves a third group alone",
  r.state.groups.find((g) => g.name === "Extras").items.length === 1
  && !r.state.groups.find((g) => g.name === "Heroes").items.some((i) => i.name === "a.png"));
r = G.ungroup(st, heroes, [A]);
check("ungroup: out of that group only (the other keeps it)",
  !r.state.groups[0].items.some((i) => i.name === "a.png") && r.state.groups[1].items.some((i) => i.name === "a.png"));
r = G.rename(st, heroes, "The Heroes");
check("rename: new name; clash refused; unknown id refused",
  r.state.groups[0].name === "The Heroes" && G.rename(st, heroes, "VILLAINS").error && G.rename(st, "zzz", "q").error
  && !G.rename(st, heroes, "heroes").error);
r = G.remove(st, heroes);
check("delete group: the group goes, its assets stay elsewhere", r.state.groups.length === 1
  && r.state.groups[0].items.some((i) => i.name === "a.png") && G.remove(st, "nope").error);
r = G.forget(st, [A]);
check("forget (after a delete): gone from EVERY group", r.state.groups.every((g) => !g.items.some((i) => i.name === "a.png")));
r = G.prune(st, (it) => it.name !== "c.wav");
check("prune: items whose file is gone are dropped, counted", r.dropped === 1
  && !r.state.groups[1].items.some((i) => i.name === "c.wav"));
check("usage: the names the project file still mentions (JSON-escaped)",
  G.usage('{"take":"a.png","clip":"we\\"ird.mp4"}', [A, B, { kind: "video", name: 'we"ird.mp4' }]).map((i) => i.name).join()
  === 'a.png,we"ird.mp4');
check("safe: junk in -> blank; bad items stripped; dup names collapsed",
  G.safe(null).groups.length === 0 && G.safe({ groups: [{ name: "x", items: [7, A] }, { name: "X" }] }).groups.length === 1
  && G.safe({ groups: [{ name: "x", items: [7, A] }] }).groups[0].items.length === 1);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agrp-"));
try {
  G.save(tmp, st);
  const back = G.load(tmp);
  check("save + load: projects/<p>/asset_groups.json round-trips",
    fs.existsSync(path.join(tmp, "asset_groups.json")) && JSON.stringify(back) === JSON.stringify(G.safe(st)));
  fs.writeFileSync(path.join(tmp, "asset_groups.json"), "{broken");
  check("load: a broken file = no groups (never a crash)", G.load(tmp).groups.length === 0);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

// ---- 2. the wiring
const idx = read("routes", "index.js"), rt = read("routes", "assets.js");
check("routes/assets.js is mounted from routes/index.js (not server.js)",
  /require\("\.\/assets"\)\.mount\(app\)/.test(idx) && !/assetGroups|routes\/assets/.test(read("server.js")));
check("routes: GET/POST groups, usage, recycle",
  rt.includes('app.get("/api/passets/groups"') && rt.includes('app.post("/api/passets/groups"')
  && rt.includes('app.post("/api/passets/usage"') && rt.includes('app.post("/api/passets/recycle"'));
check("delete = lib/recycleBin (never a hard delete), then dropped from every group",
  /recycleBin\.recycle\(/.test(rt) && /groups\.forget\(/.test(rt) && !/unlinkSync|rmSync/.test(rt));

// ---- 3. the dock (jsdom)
const html = read("static", "index.html");
check("the page loads static/assetgroups.js after the file dialog",
  html.indexOf('<script src="/static/assetgroups.js"></script>') > html.indexOf('<script src="/static/filedialog.js"></script>'));
check("refreshAssets loads the groups and paints through AssetGroups",
  /await window\.AssetGroups\.load\(\)/.test(html) && /window\.AssetGroups\.paint\(kind, pane, assets\[kind\]\)/.test(html)
  && /window\.AssetGroups\.install\(\{/.test(html));

(async () => {
  let JSDOM;
  try { ({ JSDOM } = require("jsdom")); } catch { console.log("(jsdom missing - the dock checks are skipped)"); return; }
  const dom = new JSDOM(`<!doctype html><body>
    <aside id="assetsdock"><div id="assettabs"><button data-atab="images" class="active">I</button></div>
    <div id="assetscroll"><div class="dpane active" data-apane="images" data-lb-group></div>
    <div class="dpane" data-apane="video" data-lb-group></div>
    <div class="dpane" data-apane="sound" data-lb-group><div class="dpane-items"></div></div></div></aside>
    </body>`, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://127.0.0.1/" });
  const w = dom.window, d = w.document;
  const calls = [];
  let groups = [];
  let nextId = 1;
  w.fetch = async (url, o) => {
    const body = o && o.body ? JSON.parse(o.body) : null;
    calls.push({ url, body });
    if (url === "/api/passets/groups" && !body) return { json: async () => ({ groups }) };
    if (url === "/api/passets/groups") {
      if (body.op === "create") { const g = { id: "g" + nextId++, name: body.name.trim(), items: body.items || [] }; groups = groups.concat([g]); return { json: async () => ({ ok: true, groups, group: g }) }; }
      if (body.op === "add" || body.op === "send") {
        groups = groups.map((g) => g.id === body.id ? { ...g, items: g.items.concat(body.items) }
          : body.op === "send" && g.id === body.from ? { ...g, items: g.items.filter((i) => !body.items.some((x) => x.name === i.name)) } : g);
        return { json: async () => ({ ok: true, groups }) };
      }
      if (body.op === "ungroup") {
        groups = groups.map((g) => g.id === body.id ? { ...g, items: g.items.filter((i) => !body.items.some((x) => x.name === i.name)) } : g);
        return { json: async () => ({ ok: true, groups }) };
      }
      return { json: async () => ({ ok: true, groups }) };
    }
    if (url === "/api/passets/usage") return { json: async () => ({ inUse: body.items.filter((i) => i.name === "a.png") }) };
    if (url === "/api/passets/recycle") return { json: async () => ({ ok: true, moved: body.items, groups }) };
    return { json: async () => ({}) };
  };
  const LIST = { images: [{ name: "a.png" }, { name: "b.png" }, { name: "c.png" }], video: [{ name: "v.mp4", duration: 2 }], sound: [] };
  let lb = 0, refreshed = 0, confirms = [], answer = "Heroes", drag = null, cfgv = { ui: { confirm_delete: false } };
  d.getElementById("assetscroll").addEventListener("click", (e) => { if (e.target.closest("[data-lb-url]")) lb++; });
  const assetItem = (kind, a) => {
    const el = d.createElement("div"); el.className = "aitem"; el.dataset.lbUrl = "/passets/" + kind + "/" + a.name;
    el.innerHTML = '<div class="an"><span>' + a.name + "</span></div>"; return el;
  };
  const paintAll = async () => {
    await w.AssetGroups.load();
    for (const k of ["images", "video", "sound"]) {
      const o = d.querySelector('[data-apane="' + k + '"]');
      w.AssetGroups.paint(k, o.querySelector(".dpane-items") || o, LIST[k]);
    }
    w.AssetGroups.markSel();
  };
  w.eval(read("static", "assetgroups.js"));
  const AG = w.AssetGroups;
  AG.install({ $: (id) => d.getElementById(id), assetItem, refresh: async () => { refreshed++; await paintAll(); },
    confirm: async (m) => { confirms.push(m); return true; }, ask: async () => answer, note: () => {},
    cfg: () => cfgv, drag: () => drag });
  await paintAll();

  const sec = AG.sections("images", LIST.images, [{ id: "g1", name: "H", items: [{ kind: "images", name: "b.png" }, { kind: "video", name: "v.mp4" }] },
    { id: "g2", name: "E", items: [] }]);
  check("sections: each group with ITS items of this tab (even none), then Ungrouped",
    sec.map((s) => s.name + ":" + s.items.map((i) => i.name).join("+")).join() === "H:b.png,E:,Ungrouped:a.png+c.png"
    && sec[0].total === 2, sec);
  check("no groups yet: plain tiles, no folder headers; the bar with 📁＋ is there",
    !d.querySelector(".aghead") && d.querySelectorAll("[data-apane=images] .aitem").length === 3
    && d.querySelector('#agBar [data-act="new"]') && d.querySelector('#agBar [data-act="del"]').style.display === "none");
  const tiles = () => Array.from(d.querySelectorAll("[data-apane=images] [data-agkey]"));
  const click = (el, o) => el.dispatchEvent(new w.MouseEvent("click", Object.assign({ bubbles: true, cancelable: true }, o || {})));
  click(tiles()[0]);
  check("a plain click with nothing selected still opens the lightbox", lb === 1 && AG.state.sel.size === 0);
  click(tiles()[0].querySelector(".agchk"));
  check("the ☐ selects (no lightbox); the bar shows the count + the actions",
    lb === 1 && AG.state.sel.size === 1 && tiles()[0].classList.contains("agsel")
    && /1 selected/.test(d.querySelector("#agBar .agcount").textContent)
    && d.querySelector('#agBar [data-act="send"]').style.display === "");
  click(tiles()[2], { shiftKey: true });
  check("Shift-click selects the range", AG.state.sel.size === 3);
  click(tiles()[1]);
  check("with a selection, a plain click toggles (no lightbox)", AG.state.sel.size === 2 && lb === 1);
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  check("Esc clears", AG.state.sel.size === 0 && !d.querySelector(".agsel"));
  click(tiles()[0], { ctrlKey: true }); click(tiles()[1], { ctrlKey: true });
  d.querySelector('#agBar [data-act="group"]').click();
  await new Promise((res) => setTimeout(res, 20));
  const cr = calls.filter((c) => c.body && c.body.op === "create").pop();
  check("🗂 Group: a new group named in the dialog holding the selection; selection cleared; a folder header appears",
    cr && cr.body.name === "Heroes" && cr.body.items.map((i) => i.name).join() === "a.png,b.png"
    && AG.state.sel.size === 0 && d.querySelector('[data-apane=images] .aghead[data-gid="g1"]')
    && d.querySelector('[data-apane=images] .agbody[data-gid="g1"]').querySelectorAll(".aitem").length === 2, cr);
  check("the other tab shows the group too (empty for that kind), with Ungrouped",
    d.querySelector('[data-apane=video] .aghead[data-gid="g1"]') && d.querySelector("[data-apane=video] .agempty")
    && d.querySelector("[data-apane=video] .aghead.agun"));
  answer = "Villains";
  d.querySelector('#agBar [data-act="new"]').click();
  await new Promise((res) => setTimeout(res, 20));
  check("📁＋ New group: an empty group", groups.length === 2 && groups[1].items.length === 0);
  // pick a.png INSIDE Heroes, send to Villains
  const inH = () => d.querySelector('[data-apane=images] .agbody[data-gid="g1"] [data-agname="a.png"]');
  click(inH().querySelector(".agchk"));
  check("a tile picked in a group remembers that group (from)", AG.state.sel.get("images/a.png").from === "g1");
  await AG.sendTo("g2");
  const sc = calls.filter((c) => c.body && c.body.op === "send").pop();
  check("➜ Send to: op send with from = the group it was picked in; it moves",
    sc && sc.body.id === "g2" && sc.body.from === "g1" && !groups[0].items.some((i) => i.name === "a.png")
    && groups[1].items.some((i) => i.name === "a.png"), sc && sc.body);
  // pick c.png from Ungrouped, Add to Heroes
  const ug = () => Array.from(d.querySelectorAll("[data-apane=images] .agbody")).pop().querySelector('[data-agname="c.png"]');
  click(ug().querySelector(".agchk"));
  await AG.addTo("g1");
  const ac = calls.filter((c) => c.body && c.body.op === "add").pop();
  check("＋ Add to: op add (the asset stays wherever else it is)", ac && ac.body.id === "g1"
    && ac.body.items[0].name === "c.png" && groups[0].items.some((i) => i.name === "c.png"));
  AG.state.sel.clear(); AG.markSel();
  check("⊖ is disabled for a selection from Ungrouped only", (click(Array.from(d.querySelectorAll("[data-apane=video] .agbody")).pop().querySelector('[data-agname="v.mp4"] .agchk')), d.querySelector('#agBar [data-act="ungroup"]').disabled));
  AG.state.sel.clear(); AG.markSel();
  click(d.querySelector('[data-apane=images] .agbody[data-gid="g1"] [data-agname="c.png"] .agchk'));
  check("⊖ is enabled only for a selection picked inside a group",
    !d.querySelector('#agBar [data-act="ungroup"]').disabled);
  await AG.ungroup();
  const uc = calls.filter((c) => c.body && c.body.op === "ungroup").pop();
  check("⊖ Out of group: op ungroup on the group it was picked in",
    uc && uc.body.id === "g1" && uc.body.items[0].name === "c.png" && !groups[0].items.some((i) => i.name === "c.png"));
  // a drop on a header: send (Ctrl = add)
  drag = { type: "asset", kind: "images", name: "b.png" };
  const hd = d.querySelector('[data-apane=images] .aghead[data-gid="g2"]');
  const dropEv = (ctrl) => { const e = new w.Event("drop", { bubbles: true, cancelable: true }); e.ctrlKey = ctrl; e.metaKey = false; return e; };
  const nSend = calls.filter((c) => c.body && c.body.op === "send").length, nAdd = calls.filter((c) => c.body && c.body.op === "add").length;
  hd.dispatchEvent(dropEv(false));
  await new Promise((res) => setTimeout(res, 20));
  const d1 = calls.filter((c) => c.body && (c.body.op === "send" || c.body.op === "add")).pop();
  check("drop a tile on a group header = Send there (op add for an Ungrouped / unknown source)",
    calls.filter((c) => c.body && (c.body.op === "send" || c.body.op === "add")).length === nSend + nAdd + 1
    && d1.body.id === "g2" && d1.body.items[0].name === "b.png");
  hd.dispatchEvent(dropEv(true));
  await new Promise((res) => setTimeout(res, 20));
  const d2 = calls.filter((c) => c.body && c.body.op === "add").pop();
  check("Ctrl-drop on a header = Add", d2.body.id === "g2" && d2.body.items[0].name === "b.png");
  drag = null;
  // delete: usage check -> confirm because a.png is in use -> recycle
  AG.state.sel.clear();
  click(tiles().find((t) => t.dataset.agname === "a.png").querySelector(".agchk"));
  const nConf = confirms.length;
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
  await new Promise((res) => setTimeout(res, 30));
  const rc = calls.filter((c) => c.url === "/api/passets/recycle").pop();
  check("Delete key: asks usage, confirms because the project still uses it, then recycles + refreshes",
    calls.some((c) => c.url === "/api/passets/usage") && confirms.length === nConf + 1
    && /still used/i.test(confirms[confirms.length - 1]) && /recycle bin/.test(confirms[confirms.length - 1])
    && rc && rc.body.items[0].name === "a.png" && refreshed >= 1 && AG.state.sel.size === 0);
  click(tiles().find((t) => t.dataset.agname === "c.png").querySelector(".agchk"));
  const nC2 = confirms.length;
  await AG.del();
  check("an unused asset with Confirm delete OFF goes straight to the bin (no dialog)",
    confirms.length === nC2 && calls.filter((c) => c.url === "/api/passets/recycle").pop().body.items[0].name === "c.png");
  cfgv = { ui: { confirm_delete: true } };
  click(tiles().find((t) => t.dataset.agname === "c.png").querySelector(".agchk"));
  await AG.del();
  check("with Settings -> Confirm delete ON it asks every time", confirms.length === nC2 + 1);
  // the ⋯ group menu
  const more = d.querySelector('[data-apane=images] .aghead[data-gid="g1"] .agmore');
  more.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  const menu = d.querySelector(".agmenu");
  check("⋯ on a group: Rename / Select all / Delete group (the assets stay)",
    menu && /Rename/.test(menu.textContent) && /Select all/.test(menu.textContent) && /Delete group \(the assets stay\)/.test(menu.textContent));
  const hdr = d.querySelector('[data-apane=images] .aghead[data-gid="g1"]');
  const body = d.querySelector('[data-apane=images] .agbody[data-gid="g1"]');
  click(hdr.querySelector(".agnm"));
  check("a header click collapses the group (▸), again expands it", body.style.display === "none"
    && hdr.querySelector(".agcar").textContent === "▸");
  click(hdr.querySelector(".agnm"));
  check("  ...expanded", body.style.display === "" && hdr.querySelector(".agcar").textContent === "▾");
})().then(() => {
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}).catch((e) => { console.log("FAIL: crashed " + e.stack); process.exit(1); });
