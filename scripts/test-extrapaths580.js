#!/usr/bin/env node
/* bitGen Studio — scripts/test-extrapaths580.js (2.580.0): the 🧩 Model manager's 📁 Model paths tab - lib/extraPaths.js
 * (every group of extra_model_paths.yaml: list, ➕ other_ui<n>, change paths, rename, delete; the rest of the file kept
 * byte for byte; read back the same by lib/comfyModels and found by its scan) + lib/comfyRestart.js (⟳ Restart ComfyUI)
 * + static/mmpaths.js relTo. No server, no ComfyUI. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const XP = require("../lib/extraPaths");
const CR = require("../lib/comfyRestart");
const CM = require("../lib/comfyModels");
const { relTo } = require("../static/mmpaths.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

const T = fs.mkdtempSync(path.join(os.tmpdir(), "xp580-"));
const Y = path.join(T, "ComfyUI", "extra_model_paths.yaml");
fs.mkdirSync(path.dirname(Y), { recursive: true });
let changed = 0;
XP.setDeps({ where: () => ({ file: Y, also: [] }), parse: CM.parseExtraPaths, changed: () => { changed++; } });

(async () => {
  /* pure */
  check("scalar: a plain path stays plain, a Windows path too; '# ' / ': ' / a leading quote get single quotes",
    XP.scalar("models/checkpoints") === "models/checkpoints" && XP.scalar("C:\\AI\\models") === "C:\\AI\\models" && XP.scalar("D:/my #1 models") === "'D:/my #1 models'"
    && XP.scalar("a: b") === "'a: b'" && XP.scalar("'x") === null && XP.scalar("true") === "'true'");
  check("nextName: the first free other_ui<n>", XP.nextName([]) === "other_ui1" && XP.nextName(["other_ui1", "Other_UI2", "comfyui"]) === "other_ui3" && XP.nextName(["other_ui2"]) === "other_ui1");
  const ex = (p) => /[\\/]models[\\/](checkpoints|vae)$/.test(p) || /^[\\/]x[\\/]loras$/.test(p);
  const fill = XP.fillFrom("/x", ex);
  check("fillFrom: the folders that exist under the base (models/checkpoints, models/vae, loras)",
    JSON.stringify(fill) === JSON.stringify([{ key: "checkpoints", value: "models/checkpoints" }, { key: "vae", value: "models/vae" }, { key: "loras", value: "loras" }]), fill);
  check("fillFrom: none there - checkpoints + loras under models/", XP.fillFrom("/nothing", () => false).map((p) => p.key).join() === "checkpoints,loras");
  check("fillFrom: an A1111 install - models/Stable-diffusion + models/Lora", XP.fillFrom("/a", (p) => /Stable-diffusion$|Lora$/.test(p)).map((p) => p.value).join() === "models/Stable-diffusion,models/Lora");
  check("relTo: inside the base -> relative with /, outside -> unchanged",
    relTo("C:\\AI\\webui", "C:\\AI\\webui\\models\\Lora") === "models/Lora" && relTo("/a/b/", "/a/b/c") === "c" && relTo("/a/b", "/a/bc") === "/a/bc" && relTo("", "/q") === "/q");

  /* a file in the wild: comments, an a1111 group with a | block, CRLF-free here, a top comment */
  const ORIG = "#Rename this to extra_model_paths.yaml and ComfyUI will load it\n\n"
    + "#config for a1111 ui\n#all you have to do is change the base_path to where yours is installed\n"
    + "a111:\n    base_path: path/to/stable-diffusion-webui/\n\n    checkpoints: models/Stable-diffusion\n    configs: models/Stable-diffusion\n"
    + "    vae: models/VAE\n    loras: |\n         models/Lora\n         models/LyCORIS\n\n"
    + "#comfyui:\n#     base_path: path/to/comfyui/\n\n"
    + "bitgen:\n  base_path: \"D:/AI\"\n  is_default: true\n  checkpoints: \"ckpt\"\n";
  fs.writeFileSync(Y, ORIG);
  let r = XP.read();
  const a = r.groups.find((g) => g.name === "a111");
  check("read: every group, in file order, with its paths (a | block = one row per path)",
    r.groups.map((g) => g.name).join() === "a111,bitgen" && a.paths.length === 5 && a.paths.filter((p) => p.key === "loras").map((p) => p.value).join() === "models/Lora,models/LyCORIS"
    && a.base_path === "path/to/stable-diffusion-webui/" && r.next === "other_ui1" && r.exists, r.groups);
  check("read: a relative base_path is under the yaml's folder; bitgen is_default + marked as Settings ▸ Folders' too",
    a.base_abs === path.resolve(path.dirname(Y), "path/to/stable-diffusion-webui/") && r.groups[1].is_default && /Folders/.test(r.groups[1].managed) && !a.is_default);

  /* ➕ a new group */
  const B = path.join(T, "otherui"); fs.mkdirSync(path.join(B, "models", "checkpoints"), { recursive: true }); fs.mkdirSync(path.join(B, "models", "loras"), { recursive: true });
  r = XP.addGroup({ base_path: B, mtime: r.mtime });
  const n1 = r.groups.find((g) => g.name === "other_ui1");
  check("➕ New group: other_ui1, its paths from the folders under the base, both there (✓)",
    r.ok && r.name === "other_ui1" && n1 && n1.paths.map((p) => p.key).join() === "checkpoints,loras" && n1.paths.every((p) => p.exists) && r.next === "other_ui2", r);
  let text = fs.readFileSync(Y, "utf8");
  check("...appended after a blank line; everything above it byte for byte; the old file kept as .bak",
    text.startsWith(ORIG) && text.slice(ORIG.length) === "\nother_ui1:\n    base_path: " + XP.scalar(B) + "\n    checkpoints: models/checkpoints\n    loras: models/loras\n"
    && fs.readFileSync(Y + ".bak", "utf8") === ORIG && changed === 1, text.slice(ORIG.length));
  const r2 = XP.addGroup({ base_path: "/nowhere", mtime: r.mtime });
  check("➕ again: other_ui2 (no folders there -> checkpoints + loras, ✗)", r2.name === "other_ui2" && r2.groups.find((g) => g.name === "other_ui2").paths.every((p) => !p.exists));
  check("➕ a name that is taken / not a name: refused", XP.addGroup({ name: "A111" }).error && XP.addGroup({ name: "bad name:" }).error);

  /* scan: ComfyUI's model list sees the new group */
  fs.writeFileSync(path.join(B, "models", "loras", "x.safetensors"), "");
  const sr = CM.searchRoots("", { yamlPath: Y });
  check("lib/comfyModels' scan reads the new group (yaml:other_ui1 loras -> <base>/models/loras)",
    sr.roots.some((x) => x.source === "yaml:other_ui1" && x.category === "loras" && x.dir === path.join(B, "models", "loras") && x.exists), sr.roots.filter((x) => /other_ui1/.test(x.source)));

  /* change individual paths */
  r = XP.read();
  const before = fs.readFileSync(Y, "utf8");
  let s = XP.saveGroup({ name: "a111", base_path: "C:\\AI\\webui", is_default: false, mtime: r.mtime,
    paths: [{ key: "checkpoints", value: "models/Stable-diffusion" }, { key: "loras", value: "models/Lora" }, { key: "loras", value: "D:/more loras" }, { key: "embeddings", value: "D:/my #1 embeds" }, { key: "vae", value: "models/VAE" }, { key: "", value: "" }] });
  text = fs.readFileSync(Y, "utf8");
  const ga = s.groups && s.groups.find((g) => g.name === "a111");
  check("💾 Save: the group rewritten - base_path changed, configs gone, two loras as a | block, an empty row ignored",
    s.ok && ga.base_path === "C:\\AI\\webui" && ga.paths.map((p) => p.key + "=" + p.value).join("|") === "checkpoints=models/Stable-diffusion|loras=models/Lora|loras=D:/more loras|embeddings=D:/my #1 embeds|vae=models/VAE", ga);
  check("...only that group's lines changed: the comments above it, the commented-out comfyui block, bitgen and other_ui1/2 kept",
    text.indexOf("#config for a1111 ui\n#all you have to do") > 0 && text.indexOf("#comfyui:\n#     base_path: path/to/comfyui/\n\nbitgen:\n  base_path: \"D:/AI\"") > 0
    && text.slice(text.indexOf("bitgen:")) === before.slice(before.indexOf("bitgen:")) && /loras: \|\n        models\/Lora\n        D:\/more loras\n    embeddings: 'D:\/my #1 embeds'\n    vae: models\/VAE\n/.test(text), text);
  check("...and the .bak is the file before the save", fs.readFileSync(Y + ".bak", "utf8") === before);
  // rename + is_default
  r = XP.read();
  s = XP.saveGroup({ name: "other_ui2", rename: "my_drive", base_path: "/nowhere", is_default: true, mtime: r.mtime, paths: [{ key: "checkpoints", value: "ckpts" }] });
  check("💾 Save with a new name + is_default: the group renamed in place", s.ok && s.groups.map((g) => g.name).join() === "a111,bitgen,other_ui1,my_drive" && s.groups[3].is_default
    && /\nmy_drive:\n    base_path: \/nowhere\n    is_default: true\n    checkpoints: ckpts\n?$/.test(fs.readFileSync(Y, "utf8")));
  check("💾 refused: a bad folder type, a path missing, renaming onto another group, a group that is not there",
    XP.saveGroup({ name: "my_drive", paths: [{ key: "check points", value: "x" }] }).error && XP.saveGroup({ name: "my_drive", paths: [{ key: "vae", value: "" }] }).error
    && XP.saveGroup({ name: "my_drive", rename: "a111", paths: [] }).error && XP.saveGroup({ name: "nope", paths: [] }).status === 404);
  check("💾 the bitgen group: one path per type (Settings ▸ ComfyUI ▸ Folders reads it)",
    /one path per/.test(XP.saveGroup({ name: "bitgen", base_path: "D:/AI", paths: [{ key: "vae", value: "a" }, { key: "vae", value: "b" }] }).error || ""));
  // the file changed on disk since the tab read it
  r = XP.read();
  const st = fs.statSync(Y); fs.utimesSync(Y, st.atime, new Date(st.mtimeMs + 5000));
  const c = XP.saveGroup({ name: "my_drive", paths: [], mtime: r.mtime });
  check("changed on disk since it was read: refused with 409, nothing written", c.status === 409 && /changed on disk/.test(c.error) && /my_drive:\n    base_path/.test(fs.readFileSync(Y, "utf8")), c);

  /* the file read back by ComfyUI's rules (parseExtraPaths) is what was saved */
  const p = CM.parseExtraPaths(fs.readFileSync(Y, "utf8"));
  check("parseExtraPaths reads the saved file back the same (Windows base, the # path, the block)",
    p.groups.a111.base_path[0] === "C:\\AI\\webui" && p.groups.a111.loras.join("|") === "models/Lora|D:/more loras" && p.groups.a111.embeddings[0] === "D:/my #1 embeds" && !p.warnings.length && p.groups.my_drive.is_default[0] === "true", p);

  /* 🗑 delete a group */
  r = XP.read();
  const d = XP.deleteGroup({ name: "other_ui1", mtime: r.mtime });
  text = fs.readFileSync(Y, "utf8");
  check("🗑 Delete group: its lines gone (no double blank line left), the others kept", d.ok && d.groups.map((g) => g.name).join() === "a111,bitgen,my_drive" && !/other_ui1/.test(text) && !/\n\n\n/.test(text) && /bitgen:/.test(text), text);
  r = XP.read();
  const d2 = XP.deleteGroup({ name: "a111", mtime: r.mtime });
  text = fs.readFileSync(Y, "utf8");
  check("🗑 the first group: the comments above it stay (they may describe the file)", d2.ok && text.startsWith("#Rename this") && /#all you have to do.*\n\n#comfyui:/s.test(text) && !/^a111:/m.test(text), text);
  check("🗑 a group that is not there: 404", XP.deleteGroup({ name: "a111" }).status === 404);
  check("next: other_ui1 is free again", XP.read().next === "other_ui1");

  /* no file yet: ➕ makes it */
  fs.rmSync(Y); fs.rmSync(Y + ".bak");
  r = XP.read();
  check("no file yet: read says so, no groups", !r.exists && r.groups.length === 0);
  const m = XP.addGroup({ base_path: B });
  check("➕ with no file: the file made with just other_ui1, no .bak", m.ok && fs.readFileSync(Y, "utf8").startsWith("other_ui1:\n") && !fs.existsSync(Y + ".bak"));
  XP.setDeps({ where: () => ({ file: null, also: [] }), parse: CM.parseExtraPaths, changed() {} });
  check("no ComfyUI configured: a plain error", /ComfyUI/.test(XP.read().error || ""));

  /* ⟳ Restart ComfyUI */
  const calls = [];
  const fake = (st0) => { let up = st0.reachable; return { status: async () => ({ reachable: up, managed: st0.managed }), stop: () => { calls.push("stop"); up = false; }, start: async () => { calls.push("start"); return { started: true, how: "fake" }; }, sleep: async () => {} }; };
  CR.setDeps(fake({ reachable: true, managed: true }));
  let rr = await CR.restart();
  check("⟳ the ComfyUI bitGen started: stopped, then started", rr.ok && rr.restarted && calls.join() === "stop,start", { rr, calls });
  calls.length = 0; CR.setDeps(fake({ reachable: false, managed: false }));
  rr = await CR.restart();
  check("⟳ not running: started", rr.ok && rr.started && !rr.restarted && calls.join() === "start", rr);
  calls.length = 0; CR.setDeps(fake({ reachable: true, managed: false }));
  rr = await CR.restart();
  check("⟳ started by someone else: left alone, says why", !rr.ok && rr.external && /not started by bitGen/.test(rr.reason) && !calls.length, rr);
  CR.setDeps({ status: async () => ({ reachable: false, managed: false }), start: async () => { throw new Error("Set the ComfyUI folder first"); }, stop() {}, sleep: async () => {} });
  rr = await CR.restart();
  check("⟳ start fails: the reason comes back", !rr.ok && /ComfyUI folder/.test(rr.error), rr);

  /* the wiring */
  const ix = fs.readFileSync(path.join(__dirname, "..", "routes", "index.js"), "utf8"), sv = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const mm = fs.readFileSync(path.join(__dirname, "..", "static", "modelmgr.js"), "utf8"), html = fs.readFileSync(path.join(__dirname, "..", "static", "index.html"), "utf8");
  check("wired: routes/extraPaths mounted in routes/index.js (not server.js), the tab in modelmgr.js, mmpaths.js in the page",
    /require\("\.\/extraPaths"\)\.mount\(app\)/.test(ix) && !/extraPaths|comfyRestart/.test(sv) && /data-mmtab="paths"/.test(mm) && /id="mmPaths"/.test(mm) && /H3ModelPaths\.render/.test(mm) && /src="\/static\/mmpaths\.js"/.test(html));

  fs.rmSync(T, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
