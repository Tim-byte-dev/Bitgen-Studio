#!/usr/bin/env node
/* bitGen Studio — 2.748.0 units: THE API KEYS IN settings/, ENCRYPTED (lib/secrets.js, lib/settings.js, lib/community.js).
 * Tim (verbatim): "save the users api keys in a file in a folder called settings, maybe encrypt the keys and decrptt them
 * when using the app. so user doesn't need to add them with new updates"
 *   secrets   pick / strip / put; AES-256-GCM each key (a fresh IV each time; a changed byte = refused)
 *   store     settings/keys.json + keys.master (0600, folder 0700), no key in plain text; one store per folder; a missing
 *             keys.master = the keys put aside, said
 *   settings  load: a key in custom.settings (an install from before) moves to settings/ and leaves the file (and .bak);
 *             the config has it decrypted; save: custom.settings never holds one, a cleared key is removed; reset keeps them
 *   community the sign-in token in settings/ too (an old community.json's moved)
 *   updates   settings/ is git-ignored and not in the repo - a git pull / the zip update never touches it */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const SEC = require("../lib/secrets.js"), ST = require("../lib/settings.js");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "keys748-"));
const WIN = process.platform === "win32";
const mode = (p) => fs.statSync(p).mode & 0o777;

/* ---- pure */
const cfg = { hf: { repo: "x", token: "hf_ABC" }, rgpu: { mode: "local", runpod: { key: "rpa_KEY", pod_id: "p1" }, ssh: { key: "C:/Users/tim/.ssh/id_ed25519" } }, civitai: { token: "" }, engine: { runpod: { api_key: "rk" } } };
check("pick: the API keys set (an empty one left out; the SSH key FILE's path is not a key)", JSON.stringify(SEC.pick(cfg)) === JSON.stringify({ "hf.token": "hf_ABC", "engine.runpod.api_key": "rk", "rgpu.runpod.key": "rpa_KEY" }), SEC.pick(cfg));
const sc = SEC.strip(cfg);
check("strip: a copy with the key fields gone, everything else kept (the original untouched)", !("token" in sc.hf) && sc.hf.repo === "x" && !("key" in sc.rgpu.runpod) && sc.rgpu.runpod.pod_id === "p1" && sc.rgpu.ssh.key === cfg.rgpu.ssh.key && cfg.hf.token === "hf_ABC", sc);
check("put: back in place, objects made as needed; a name that is not a key setting ignored", JSON.stringify(SEC.put({}, { "rgpu.runpod.key": "k", "x.y": "no" })) === JSON.stringify({ rgpu: { runpod: { key: "k" } } }));
const mk = require("crypto").randomBytes(32), e1 = SEC.encrypt(mk, "rpa_SECRET"), e2 = SEC.encrypt(mk, "rpa_SECRET");
const bad = (() => { const b = Buffer.from(e1.slice(3), "base64"); b[b.length - 1] ^= 1; try { SEC.decrypt(mk, "v1:" + b.toString("base64")); return false; } catch { return true; } })();
check("AES-256-GCM: opens again; a fresh IV each time (the same key encrypts differently); a changed byte is refused", SEC.decrypt(mk, e1) === "rpa_SECRET" && e1 !== e2 && !e1.includes("SECRET") && bad);

/* ---- the store */
const A = path.join(TMP, "a");
fs.mkdirSync(A);
const s1 = SEC.store(A, { log: () => {} });
s1.update(SEC.PATHS, { "hf.token": "hf_ABC", "rgpu.runpod.key": "rpa_KEY" });
const kj = fs.readFileSync(path.join(A, "settings", "keys.json"), "utf8");
check("settings/keys.json: each key encrypted, no key in plain text; keys.master beside it", /"hf\.token": "v1:/.test(kj) && !/hf_ABC|rpa_KEY/.test(kj) && /^[0-9a-f]{64}\n$/.test(fs.readFileSync(path.join(A, "settings", "keys.master"), "utf8")));
if (!WIN) check("…readable by this account only: the files 0600, the folder 0700", mode(path.join(A, "settings", "keys.json")) === 0o600 && mode(path.join(A, "settings", "keys.master")) === 0o600 && mode(path.join(A, "settings")) === 0o700);
check("one store per folder (the settings and the Community sign-in share it)", SEC.store(A) === s1);
s1.update(["hf.token"], {});
check("update: a key cleared is removed, the others stay", JSON.stringify(s1.read()) === JSON.stringify({ "rgpu.runpod.key": "rpa_KEY" }));
const B = path.join(TMP, "b"); fs.mkdirSync(path.join(B, "settings"), { recursive: true });
fs.copyFileSync(path.join(A, "settings", "keys.json"), path.join(B, "settings", "keys.json"));
const said = []; const sb = SEC.store(B, { log: (m) => said.push(m) });
check("keys.json without its keys.master: nothing opened, the file put aside (keys.json.unreadable), said", JSON.stringify(sb.read()) === "{}" && fs.existsSync(path.join(B, "settings", "keys.json.unreadable")) && /cannot be opened/.test(said.join()), said);

/* ---- settings: load / save / reset */
const C = path.join(TMP, "c"); fs.mkdirSync(C);
const defaults = { hf: { repo: "Comfy-Org/MiniMax-H3", token: "" }, engine: { runpod: { api_key: "" } }, ui: { a: 1 } };
const P = { defaults, defaultsPath: path.join(C, "default.settings"), customPath: path.join(C, "custom.settings"), legacyPath: path.join(C, "config.json") };
fs.writeFileSync(P.customPath, JSON.stringify({ hf: { token: "hf_OLD" }, rgpu: { mode: "serverless", runpod: { key: "rpa_OLD", pod_id: "p" } }, ui: { a: 2 } }));
fs.writeFileSync(P.customPath + ".bak", JSON.stringify({ civitai: { token: "cv_OLD" } }));
const ks = SEC.store(C, { log: () => {} });
let r = ST.load(Object.assign({ secrets: ks }, P));
const cust = JSON.parse(fs.readFileSync(P.customPath, "utf8"));
check("load (an install from before): the keys move out of custom.settings into settings/, the rest of the file kept, said",
  !JSON.stringify(cust).includes("OLD") && cust.ui.a === 2 && cust.rgpu.runpod.pod_id === "p" && ks.read()["hf.token"] === "hf_OLD" && ks.read()["rgpu.runpod.key"] === "rpa_OLD" && r.notes.some((n) => /API keys moved to .*keys\.json, encrypted \(hf\.token, rgpu\.runpod\.key\)/.test(n)), { cust, notes: r.notes });
check("…custom.settings.bak scrubbed too", !fs.readFileSync(P.customPath + ".bak", "utf8").includes("cv_OLD"));
check("…the config the app reads has them, decrypted (config.hf.token, config.rgpu.runpod.key)", r.config.hf.token === "hf_OLD" && r.config.rgpu.runpod.key === "rpa_OLD" && r.config.hf.repo === "Comfy-Org/MiniMax-H3");
const c2 = JSON.parse(JSON.stringify(r.config)); c2.civitai = { token: "cv_NEW", site: "civitai.com" }; c2.hf.token = "";
ST.save({ config: c2, base: r.base, customPath: P.customPath, secrets: ks });
const cust2 = fs.readFileSync(P.customPath, "utf8");
check("save: custom.settings never holds a key (civitai.site kept); a new key stored, a cleared one removed", !/cv_NEW|rpa_OLD|hf_/.test(cust2) && /"site": "civitai.com"/.test(cust2)
  && ks.read()["civitai.token"] === "cv_NEW" && !("hf.token" in ks.read()) && ks.read()["rgpu.runpod.key"] === "rpa_OLD", { cust2, keys: Object.keys(ks.read()) });
ks._drop();
r = ST.load(Object.assign({ secrets: ks }, P));
check("…an update later (a fresh start reading the files): the keys are back", r.config.civitai.token === "cv_NEW" && r.config.rgpu.runpod.key === "rpa_OLD");
const rs = ST.reset({ base: r.base, customPath: P.customPath, current: r.config, keep: [], secrets: ks });
check("Reset settings to defaults: the settings go back, the API keys stay", rs.ui.a === 1 && rs.civitai.token === "cv_NEW" && rs.rgpu.runpod.key === "rpa_OLD");

/* ---- community */
const D = path.join(TMP, "d"); fs.mkdirSync(D);
fs.writeFileSync(path.join(D, "community.json"), JSON.stringify({ url: "https://tigerart.com.au/bitgen-community/api.php", handle: "tim", token: "tok_OLD" }));
const CM = require("../lib/community.js"); CM.setBase(D);
const st = CM.state();
const cj = fs.readFileSync(path.join(D, "community.json"), "utf8");
check("Community: the sign-in token moves from community.json to settings/ (encrypted); still signed in", st.joined && st.handle === "tim" && !/tok_OLD|"token"/.test(cj) && SEC.store(D).read()["community.token"] === "tok_OLD"
  && !fs.readFileSync(path.join(D, "settings", "keys.json"), "utf8").includes("tok_OLD"), { st, cj });
CM.setUrl("https://example.com/other/api.php");
check("…another server = signed out there: the token removed from settings/", !("community.token" in SEC.store(D).read()) && !CM.state().joined);

/* ---- updates never touch it */
const gi = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
let tracked = "";
try { tracked = execFileSync("git", ["ls-files", "settings"], { cwd: ROOT, encoding: "utf8" }); } catch { tracked = ""; }
check("settings/ is git-ignored and nothing in it is in the repo - a git pull / the in-app update / a new zip leaves it", /^\/settings\/$/m.test(gi) && tracked.trim() === "");
const core = fs.readFileSync(path.join(ROOT, "lib", "core.js"), "utf8");
check("core.js: load, save and reset all go through the store; Settings ▸ General shows the file + the names (never a value)",
  /secrets: keyStore \}\);/.test(core) && (core.match(/secrets: keyStore/g) || []).length === 3 && /keys_saved: keyStore\.names\(\)/.test(core) && /keys:    \$\{j\.keys\}/.test(fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8")));

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* fine */ }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
