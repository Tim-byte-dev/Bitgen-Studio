#!/usr/bin/env node
/* bitGen Studio — 2.635.0: GLOBAL / PROJECT ASSETS IN REAL "Assets" FOLDERS, A FOLDER = A GROUP (lib/assetLibrary.js) +
 * the wiring (routes, the dock's dropdown and right-click menu).
 * Tim: "add a dropdown to the top of assets dialog, Global, Project or All, global assets will be kept in project
 * root/Assets, project assets will be kept in project name/Assets, folders in the assets folders will be a group" +
 * "new uploads live in project name/assets, right click context menu will have "move to Global"" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const R0 = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (p) => fs.readFileSync(path.join(R0, p), "utf8");
const L = require(path.join(R0, "lib", "assetLibrary.js"));

const T = fs.mkdtempSync(path.join(os.tmpdir(), "alib635_"));
const ROOT = path.join(T, "projects"), PD = path.join(ROOT, "film");
const kindOf = (e) => ({ ".png": "images", ".jpg": "images", ".mp4": "video", ".wav": "sound" })[e] || null;
const c = { proot: path.join(PD, "Assets"), groot: path.join(ROOT, "Assets"), pDir: (k) => path.join(PD, k), links: path.join(PD, "asset_links.json"), kindOf };
for (const k of ["images", "video", "sound"]) fs.mkdirSync(c.pDir(k), { recursive: true });
const put = (p, txt) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, txt); };
const names = (lst, k) => lst[k].map((a) => a.name + "@" + a.scope + (a.group ? "/" + a.group : "")).sort();

// an older project: files straight in the type folders + 2.327.0 groups
put(path.join(c.pDir("images"), "old.png"), "OLD");
put(path.join(c.pDir("images"), "tree.png"), "TREE");
put(path.join(c.pDir("sound"), "song.wav"), "SONG");
fs.writeFileSync(path.join(PD, "asset_groups.json"), JSON.stringify({ groups: [{ id: "a1", name: "Forest", items: [{ kind: "images", name: "tree.png" }, { kind: "sound", name: "song.wav" }] }] }));
const nmig = L.migrate(c, PD);
check("the old groups become folders: projects/<name>/Assets/Forest holds (links to) its files; asset_groups.json -> .migrated", nmig === 2 && fs.existsSync(path.join(c.proot, "Forest", "tree.png")) && !fs.existsSync(path.join(PD, "asset_groups.json")) && fs.existsSync(path.join(PD, "asset_groups.migrated.json")) && L.same(path.join(c.proot, "Forest", "tree.png"), path.join(c.pDir("images"), "tree.png")));
let lst = L.list(c, "project");
check("Project: the Forest group's files (scope project, group Forest) + the type folder's own file (no group) - each once", names(lst, "images").join() === "old.png@project,tree.png@project/Forest" && names(lst, "sound").join() === "song.wav@project/Forest", lst);
const g0 = L.groups(c, "project");
check("the groups ARE the folders: [{id p:Forest, name, scope project, items}]", g0.length === 1 && g0[0].id === "p:Forest" && g0[0].scope === "project" && g0[0].items.length === 2, g0);

// a new upload -> projects/<name>/Assets + the type folder (same name)
const tmp = path.join(T, "up1"); put(tmp, "NEW");
const up = L.adoptUpload(c, tmp, "old.png", "p");
check("an upload: into projects/<name>/Assets under a name free there AND in the type folder (old (2).png), linked into images/", up.name === "old (2).png" && up.kind === "images" && fs.existsSync(path.join(c.proot, "old (2).png")) && L.same(path.join(c.proot, "old (2).png"), path.join(c.pDir("images"), "old (2).png")) && !fs.existsSync(tmp), up);

// a global asset dropped into <projects>/Assets by hand, in a group folder
put(path.join(c.groot, "Skies", "sky.png"), "SKY");
put(path.join(c.groot, "logo.png"), "LOGO");
put(path.join(c.groot, "notes.txt"), "not an asset");
lst = L.list(c, "global");
check("Global: <projects root>/Assets - its files (group = their folder); not-assets skipped; linked into THIS project's type folder so their names work here", names(lst, "images").join() === "logo.png@global,sky.png@global/Skies" && fs.existsSync(path.join(c.pDir("images"), "sky.png")), lst);
lst = L.list(c, "project");
check("…Project does not show them (their links in images/ are known)", !names(lst, "images").some((x) => /sky|logo/.test(x)), names(lst, "images"));
lst = L.list(c, "all");
check("All: both", names(lst, "images").length === 5 && names(lst, "images").includes("sky.png@global/Skies") && names(lst, "images").includes("old.png@project"), names(lst, "images"));
check("All's groups: 📁 Forest + 🌐 Skies", L.groups(c, "all").map((g) => g.id).join() === "p:Forest,g:Skies");

// a name clash: a global file with a name a project file already has (different content)
put(path.join(c.groot, "old.png"), "A DIFFERENT OLD");
lst = L.list(c, "global");
const clash = lst.images.find((a) => a.rel === "old.png");
check("a global file whose name is taken here gets its own working name (old (3).png) - nothing overwritten", clash && clash.name === "old (3).png" && fs.readFileSync(path.join(c.pDir("images"), "old.png"), "utf8") === "OLD", clash);

// groups: create, send (move), add (link too), ungroup, rename, delete
check("create a group: a folder (a bad / taken name refused)", !L.create(c, "p", "Hero").error && fs.existsSync(path.join(c.proot, "Hero")) && L.create(c, "p", "hero").error && L.create(c, "p", "a/b").error);
let r = L.place(c, { kind: "images", name: "old.png" }, "p", "Hero", "move", "");
check("send a type-folder-only file into Hero: linked into the folder (the type folder keeps it)", !r.error && L.same(path.join(c.proot, "Hero", "old.png"), path.join(c.pDir("images"), "old.png")), r);
r = L.place(c, { kind: "images", name: "tree.png" }, "p", "Hero", "move", "p:Forest");
check("send tree.png from Forest to Hero: the FILE moves folder (Forest no longer has it)", !r.error && fs.existsSync(path.join(c.proot, "Hero", "tree.png")) && !fs.existsSync(path.join(c.proot, "Forest", "tree.png")));
r = L.place(c, { kind: "images", name: "tree.png" }, "p", "Forest", "copy");
check("add tree.png to Forest too: in both folders (one file - a link)", !r.error && L.same(path.join(c.proot, "Forest", "tree.png"), path.join(c.proot, "Hero", "tree.png")));
const gHero = L.groups(c, "project").find((g) => g.id === "p:Hero");
check("…the groups list it in both", gHero.items.some((i) => i.name === "tree.png") && L.groups(c, "project").find((g) => g.id === "p:Forest").items.some((i) => i.name === "tree.png"));
r = L.place(c, { kind: "images", name: "tree.png" }, "p", "", "move", "p:Hero");
check("ungroup (out of Hero): back in the Assets folder itself", !r.error && fs.existsSync(path.join(c.proot, "tree.png")) && !fs.existsSync(path.join(c.proot, "Hero", "tree.png")));
r = L.rename(c, "p:Hero", "Heroes");
check("rename a group = rename its folder (the working names stay)", !r.error && r.id === "p:Heroes" && fs.existsSync(path.join(c.proot, "Heroes", "old.png")) && Object.keys(L.loadLinks(c)).includes("p:Heroes/old.png"));
r = L.remove(c, "p:Heroes");
check("delete a group: the folder goes, its files back in Assets (nothing deleted)", !r.error && !fs.existsSync(path.join(c.proot, "Heroes")) && fs.existsSync(path.join(c.pDir("images"), "old.png")));
lst = L.list(c, "project");
check("…every name still listed once-or-more and still in images/", ["old.png", "tree.png", "old (2).png"].every((n) => lst.images.some((a) => a.name === n)) && lst.images.every((a) => fs.existsSync(path.join(c.pDir("images"), a.name))), names(lst, "images"));

// Move to Global / Move to Project
r = L.moveScope(c, { kind: "sound", name: "song.wav" }, "global");
check("🌐 Move to Global: song.wav (in Forest) -> <projects>/Assets/Forest/song.wav (its group kept); the project's working file stays", !r.error && fs.existsSync(path.join(c.groot, "Forest", "song.wav")) && !fs.existsSync(path.join(c.proot, "Forest", "song.wav")) && fs.existsSync(path.join(c.pDir("sound"), "song.wav")));
lst = L.list(c, "all");
check("…now listed as global (group Forest), not project", names(lst, "sound").join() === "song.wav@global/Forest", names(lst, "sound"));
r = L.moveScope(c, { kind: "images", name: "logo.png" }, "project");
check("📁 Move to Project: logo.png -> projects/<name>/Assets", !r.error && fs.existsSync(path.join(c.proot, "logo.png")) && !fs.existsSync(path.join(c.groot, "logo.png")) && L.list(c, "all").images.find((a) => a.name === "logo.png").scope === "project");

// delete -> the bin, library places unlinked
const bin = path.join(PD, "recycle_bin"); fs.mkdirSync(bin, { recursive: true });
const rec = (p) => { const to = path.join(bin, path.basename(p)); fs.renameSync(p, to); return { to: bin, name: path.basename(p) }; };
r = L.recycle(c, { kind: "images", name: "tree.png" }, rec);
check("delete: the working file to the recycle bin, its Assets places removed, gone from the lists", r.name === "tree.png" && fs.existsSync(path.join(bin, "tree.png")) && !fs.existsSync(path.join(c.proot, "tree.png")) && !fs.existsSync(path.join(c.proot, "Forest", "tree.png")) && !L.list(c, "all").images.some((a) => a.name === "tree.png"));

// a copy (no hard links on this drive) is still known as the same file
const a1 = path.join(T, "x1.png"), a2 = path.join(T, "x2.png"); put(a1, "SAME"); fs.copyFileSync(a1, a2); const st = fs.statSync(a1); fs.utimesSync(a2, st.atime, st.mtime);
check("same(): a hard link, or a copy with the same size + time stamp", L.same(a1, a2) && !L.same(a1, path.join(c.pDir("images"), "old.png")));

/* the wiring */
const RA = read("routes/assets.js"), RI = read("routes/index.js"), UI = read("static/assetgroups.js"), IX = read("static/index.html"), PJ = read("lib/projects.js");
check("routes: GET /api/passets?scope= (default all) from the library; uploads (on disk) into Assets (?scope=global -> the global one)", /lib\.list\(c, scope\)/.test(RI) && /adoptUpload\(lib\.forCore\(core\), file\.path, safe/.test(RI) && /req\.query\.scope/.test(RI));
check("routes: the groups are the folders (create / rename / delete / add / send / ungroup), POST /api/passets/scope (Move to Global / Project), recycle via the library", /lib\.groups\(ctx\(\), scopeOf/.test(RA) && /\/api\/passets\/scope/.test(RA) && /lib\.moveScope/.test(RA) && /lib\.recycle\(c, it/.test(RA) && /lib\.migrate/.test(RA));
check("projects: <projects>/Assets is not a project (listed nowhere, the name refused)", /d\.toLowerCase\(\) !== "assets"/.test(PJ) && /d\.toLowerCase\(\) !== "assets"/.test(RI) && /\^assets\$\/i/.test(PJ));
check("the dock: 📁 Project | 🌐 Global | All in its head (remembered), its groups by scope, 🌐 on a global tile", /id = "assetScope"/.test(UI) && /<option value="project">📁 Project<\/option><option value="global">🌐 Global<\/option><option value="all">All<\/option>/.test(UI) && /ag\.scope/.test(UI) && /\/api\/passets\/groups\?scope=/.test(UI) && /agglob/.test(UI));
check("right-click a tile: 🌐 Move to Global / 📁 Move to Project / New group / Delete", /addEventListener\("contextmenu", tileMenu/.test(UI) && /🌐 Move to Global/.test(UI) && /📁 Move to Project/.test(UI) && /\/api\/passets\/scope/.test(UI));
check("index.html: `assets` stays everything (the pickers), the dock filtered by its scope; an upload in the Global view goes global", /fetch\("\/api\/passets\?scope=all"\)/.test(IX) && /AssetGroups\.paint\(kind, pane, shown\(assets\[kind\]\)\)/.test(IX) && /"\/api\/passets" \+ \(glob \? "\?scope=global" : ""\)/.test(IX));

fs.rmSync(T, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
