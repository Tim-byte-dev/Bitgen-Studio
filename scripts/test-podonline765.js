#!/usr/bin/env node
/* bitGen Studio — 2.765.0 units: a model of this computer found on Civitai (civitai.com / civitai.red) is downloaded BY THE POD
 * instead of being sent from this computer (lib/podOnline.js + lib/podSend.js viaCivitai + lib/podModels.js fromLink's key).
 * Tim (verbatim): "can you find my checkpoint and send it to the pod via civitai or civitai.red . if is very slow from my pc ,
 * 0.5mb/sec" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const T = fs.mkdtempSync(path.join(os.tmpdir(), "podonline765-"));
process.env.H3_REMOTE_MODELS = path.join(T, "remote_models.json");   // 2.766.0: a model the pod got from Civitai goes in the list
let CFG = { civitai: { token: "CIVKEY765", site: "civitai.red" }, rgpu: {} };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT };
require.cache[coreP] = fake;
const PO = require("../lib/podOnline");

(async () => {
  /* ---- pure */
  check("sitesFor: the site picked in Settings first, then the other", PO.sitesFor("civitai.com").join() === "civitai.com,civitai.red" && PO.sitesFor("civitai.red").join() === "civitai.red,civitai.com" && PO.sitesFor("").join() === "civitai.red,civitai.com");
  const ver = { id: 77, name: "v2.0", model: { name: "jibMix Krea" }, files: [
    { name: "jibMixKrea_v20.safetensors", sizeKB: 6000, hashes: { SHA256: "AAAA" }, downloadUrl: "https://civitai.com/api/download/models/77?type=Model&format=SafeTensor" },
    { name: "jibMixKrea_v20_fp8.safetensors", sizeKB: 3000, hashes: { SHA256: "BBBB" }, downloadUrl: "https://civitai.com/api/download/models/77?type=Model&format=SafeTensor&fp=fp8" }] };
  check("matchFile: by SHA-256 - the very same file (the fp8 one here), not the version's other file", PO.matchFile(ver, { sha256: "bbbb" }).name === "jibMixKrea_v20_fp8.safetensors");
  check("…a SHA-256 none of its files has -> nothing (a different file is never taken)", PO.matchFile(ver, { sha256: "cccc", name: "jibMixKrea_v20.safetensors", size: 6000 * 1024 }) === null);
  check("…no SHA-256 kept: the same name AND size; a renamed / other-size file -> nothing", PO.matchFile(ver, { name: "JIBMIXKREA_V20.safetensors", size: 6000 * 1024 }).hashes.SHA256 === "AAAA"
    && PO.matchFile(ver, { name: "jibMixKrea_v20.safetensors", size: 5000 * 1024 }) === null && PO.matchFile(ver, { name: "mine.safetensors", size: 6000 * 1024 }) === null);
  const u = PO.dlUrl(ver.files[0].downloadUrl, "civitai.red", "KEY");
  check("dlUrl: on the site asked, its query kept, the key as ?token= only when given; not Civitai -> \"\"",
    u === "https://civitai.red/api/download/models/77?type=Model&format=SafeTensor&token=KEY" && PO.dlUrl(ver.files[0].downloadUrl, "civitai.com", "") === ver.files[0].downloadUrl
    && PO.dlUrl("https://civitai.com/api/download/models/77?token=OLD", "", "") === "https://civitai.com/api/download/models/77" && PO.dlUrl("https://evil.example/api/download/models/1", "civitai.red", "K") === "", u);
  check("isCivitaiDownload: civitai.com / civitai.red download addresses only", PO.isCivitaiDownload("https://civitai.red/api/download/models/77?type=Model") && PO.isCivitaiDownload("https://civitai.com/api/download/models/77")
    && !PO.isCivitaiDownload("https://civitai.com.evil.io/api/download/models/77") && !PO.isCivitaiDownload("http://civitai.com/api/download/models/77"));

  /* ---- find(): a checkpoint of this computer */
  const ck = path.join(T, "jibMixKrea_v20_fp8.safetensors"), blob = crypto.randomBytes(200000); fs.writeFileSync(ck, blob);
  const sha = crypto.createHash("sha256").update(blob).digest("hex");
  const asked = [], kept = [], said = [];
  const civ = (answers) => async (site, p, token) => { asked.push(site + p + (token ? " key" : "")); const a = answers[site + p]; if (a instanceof Error) throw a; return a || null; };
  const verOf = (h) => ({ id: 91, name: "v2.0", model: { name: "jibMix Krea" }, files: [{ name: "jibMixKrea_v20_fp8.safetensors", sizeKB: 200000 / 1024, hashes: { SHA256: h.toUpperCase() }, downloadUrl: "https://civitai.com/api/download/models/91?type=Model" }] });
  const base = { cfg: () => ({ token: "CIVKEY765", site: "civitai.com" }), size: () => 200000, keepSha: (a, s) => kept.push(s), sha256: (a, cb) => { cb(100000); cb(200000); return Promise.resolve(sha); } };
  // no card: its SHA-256 read (once, kept), asked on civitai.com (the site picked) then civitai.red (mature models)
  let r = await PO.find(ck, (t) => said.push(t), Object.assign({}, base, { card: () => ({}), get: civ({ ["civitai.red/model-versions/by-hash/" + sha.toUpperCase()]: verOf(sha) }) }));
  check("find: no card - its SHA-256 read once (kept in its card) and looked up on civitai.com, then civitai.red where it is",
    r && r.site === "civitai.red" && r.version_id === 91 && r.from === "its SHA-256" && r.url === "https://civitai.red/api/download/models/91?type=Model" && kept[0] === sha
    && asked.join("|") === "civitai.com/model-versions/by-hash/" + sha.toUpperCase() + " key|civitai.red/model-versions/by-hash/" + sha.toUpperCase() + " key", { r, asked, kept });
  check("…it said what it was doing (reading it once, % read, asking Civitai)", said[0] === "reading jibMixKrea_v20_fp8.safetensors to find it on Civitai (once)" && said.some((t) => /- 50%$/.test(t)) && said.includes("asking Civitai for jibMixKrea_v20_fp8.safetensors"), said);
  asked.length = 0;
  r = await PO.find(ck, null, Object.assign({}, base, { sha256: () => { throw new Error("must not read it again"); }, card: () => ({ sha256: sha, civitai: { id: 91 } }), get: civ({ "civitai.com/model-versions/91": verOf(sha) }) }));
  check("…its card names the Civitai version (Model manager's look-up): that version asked, no reading, no by-hash", r && r.from === "its card" && r.site === "civitai.com" && asked.join() === "civitai.com/model-versions/91 key", { r, asked });
  asked.length = 0;
  r = await PO.find(ck, null, Object.assign({}, base, { card: () => ({ sha256: sha, civitai: { id: 91 } }), get: civ({ "civitai.com/model-versions/91": verOf("ffff"), ["civitai.com/model-versions/by-hash/" + sha.toUpperCase()]: null }) }));
  check("…the card's version does not hold THIS file (another hash): not taken; by-hash asked; nowhere -> null", r === null && asked.length === 3 && /by-hash/.test(asked[1]), asked);
  r = await PO.find(ck, null, Object.assign({}, base, { card: () => ({ sha256: sha }), get: civ({ ["civitai.com/model-versions/by-hash/" + sha.toUpperCase()]: Object.assign(new Error("offline"), { status: 0 }) }) }));
  check("…Civitai not reached -> null (the file is sent from this computer as before)", r === null);

  /* ---- sendOne: Civitai first, this computer only when that fails */
  const SD = require("../lib/podSend"), PM = require("../lib/podModels");
  process.env.H3_POD_REVIVE_POLL = "5";
  const calls = []; let states = [], upl = 0;
  PM.fromLink = async (id, b) => { calls.push(b); return { way: "jupyter", started: 1, name: b.name }; };
  PM.state = async () => states.shift() || { running: false, files: [] };
  PM.upload = async () => { upl++; return { way: "upload" }; };
  const realFind = PO.find;
  PO.find = async () => ({ url: "https://civitai.red/api/download/models/91?type=Model", site: "civitai.red", file: "jibMixKrea_v20_fp8.safetensors", size: 200000, model: "jibMix Krea - v2.0", from: "its SHA-256" });
  const log = [];
  states = [{ running: true, files: [{ name: "jibMixKrea_v20_fp8.safetensors", state: "downloading", done: 50000, size: 200000 }] }, { running: false, files: [{ name: "jibMixKrea_v20_fp8.safetensors", state: "done", done: 200000, size: 200000 }] }];
  const w1 = await SD.viaCivitai("pod765", 3000, { path: ck, rel: "Krea/jibMixKrea_v20_fp8.safetensors" }, "checkpoints/Krea", "jibMixKrea_v20_fp8.safetensors", 200000, (t) => log.push(t));
  check("viaCivitai: found -> the pod downloads it from civitai.red into the same folder (checkpoints/Krea), not sent from this computer", w1 === "" && calls.length === 1 && calls[0].url === "https://civitai.red/api/download/models/91?type=Model"
    && calls[0].folder === "checkpoints/Krea" && calls[0].name === "jibMixKrea_v20_fp8.safetensors" && calls[0].port === 3000 && upl === 0, { w1, calls, upl });
  check("…the render's note says so, with the pod's progress (25%) and the end", /is on Civitai \(jibMix Krea - v2\.0\) - the pod downloads it from civitai\.red instead of this computer sending it/.test(log[0])
    && log.some((t) => /^the pod is downloading jibMixKrea_v20_fp8\.safetensors from civitai\.red - 0\.1 of 0\.2 GB|^the pod is downloading jibMixKrea_v20_fp8\.safetensors from civitai\.red - 0 MB of 0 MB|\(25%\)/.test(t)) && /is on the pod \(downloaded from civitai\.red\)/.test(log[log.length - 1]), log);
  calls.length = 0; log.length = 0;
  states = [{ running: false, files: [{ name: "jibMixKrea_v20_fp8.safetensors", state: "failed: Civitai refused it - add your Civitai API key", done: 0 }] }, { running: false, files: [{ name: "jibMixKrea_v20_fp8.safetensors", state: "failed: HTTP Error 404", done: 0 }] }];
  const w2 = await SD.viaCivitai("pod765", 3000, { path: ck, rel: "jibMixKrea_v20_fp8.safetensors" }, "checkpoints", "jibMixKrea_v20_fp8.safetensors", 200000, (t) => log.push(t));
  check("…refused on civitai.red: civitai.com tried; both failed -> this computer sends it (null), saying why", w2 === null && calls.map((c) => c.url.split("/")[2]).join() === "civitai.red,civitai.com" && /could not download jibMixKrea_v20_fp8\.safetensors from Civitai \(HTTP Error 404\) - sending it from this computer/.test(log[log.length - 1]), { calls, log });
  PO.find = async () => null; calls.length = 0;
  check("…not on Civitai: nothing asked of the pod, sent from this computer", (await SD.viaCivitai("pod765", 3000, { path: ck, rel: "x" }, "checkpoints", "x.safetensors", 1, () => {})) === null && calls.length === 0);
  process.env.H3_POD_NO_CIVITAI = "1"; PO.find = async () => { throw new Error("must not ask"); };
  check("…H3_POD_NO_CIVITAI=1 (tests): not asked", (await SD.viaCivitai("pod765", 3000, { path: ck, rel: "x" }, "checkpoints", "x.safetensors", 1, () => {})) === null);
  delete process.env.H3_POD_NO_CIVITAI; PO.find = realFind;
  check("pullText: the pod's download in words", SD.pullText("checkpoints/a.safetensors", "civitai.red", 3e9, 6e9, 60) === "the pod is downloading a.safetensors from civitai.red - 3.0 GB of 6.0 GB (50%) · 50.0 MB/s · under 2 min left"
    && SD.pullText("a.safetensors", "civitai.com", 0, 0, 0) === "the pod is downloading a.safetensors from civitai.com", SD.pullText("checkpoints/a.safetensors", "civitai.red", 3e9, 6e9, 60));

  /* ---- wired in */
  const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8"), PS = src("lib/podSend.js"), PMs = src("lib/podModels.js");
  check("sendOne asks Civitai first, uploads only when that returns null", /const on = o\.noCivitai \? null : await viaCivitai\(id, port, local, folder, name, size, tell, o\);\n  if \(on === ""\) return "";/.test(PS));
  check("fromLink: a Civitai address takes the key as ?token= in the pod's job only (no Authorization header, not in the kept address)",
    /const token = civ \? "" : /.test(PMs) && /const jobUrl = civ && ckey \? require\("\.\/podOnline"\)\.dlUrl\(u, "", ckey\) \|\| u : u;/.test(PMs) && /dlCode\(\[\{ name, folder, url: jobUrl, size: \+o\.size \|\| 0, token \}\]/.test(PMs) && /putFiles\(w\.pod_id, \[\{ name, folder, url: u \}\]\)/.test(PMs));
  check("…Civitai's refusal in words on the pod (the key, civitai.red for mature models); the key cut from the address it shows", /'Civitai refused it - add your Civitai API key in Settings > General > Civitai/.test(PMs) && /else url\.split\('\?'\)\[0\]/.test(PMs));
  fs.rmSync(T, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack)); console.log("RESULT: FAIL"); process.exit(1); });
