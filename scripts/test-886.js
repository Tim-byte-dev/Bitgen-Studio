#!/usr/bin/env node
/* bitGen Studio — 2.886.0 units: 🔎 bitGen's own SearXNG (lib/searxngLocal.js - its settings.yml with the JSON answers on, this computer
 * only, no limiter; Brave -> your address -> bitGen's own -> Wikipedia; a hint when only Wikipedia was searched or SearXNG's engines did
 * not answer) and ⬇ downloads (lib/webTools.js download + mediaOf - pictures / videos / sounds only, by type AND first bytes, never a
 * program; lib/llmAgent.js web_download only when the user's own words ask to download / save; <project>/web/downloads in the Gallery).
 * Tim (verbatim): "it works but search is very limited, i was not using brave, fix the searxng . if i ask it to dl pictures or videos
 * or sound , dl them to project name/web/downloads/ and show them in the gallery docker" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const BASE = fs.mkdtempSync(path.join(os.tmpdir(), "sx886-"));
let CFG = {};
require.cache[require.resolve("../lib/core")] = { id: "core", filename: require.resolve("../lib/core"), loaded: true, exports: { BASE, getConfig: () => CFG, setConfig: (c) => { CFG = c; }, projDir: () => path.join(BASE, "projects", "p1"), getProject: () => "p1" } };
const SX = require("../lib/searxngLocal"), W = require("../lib/webTools"), AG = require("../lib/llmAgent");
const B = (a) => Buffer.from(a);
(async () => {
  const y = SX.settingsYml("abc123", 8888);
  check("bitGen's SearXNG settings: JSON answers on, this computer only, its own secret, no limiter / image proxy / redis", /formats:\n    - html\n    - json/.test(y) && /bind_address: "127\.0\.0\.1"/.test(y) && /secret_key: "abc123"/.test(y) && /limiter: false/.test(y) && /image_proxy: false/.test(y) && /use_default_settings: true/.test(y) && /port: 8888/.test(y));
  check("installed from PyPI's simplexng (SearXNG for Windows too) + sniffio (its code needs it - found on a real start), in its own venv under <app>/searxng", /"simplexng", \.\.\.EXTRA/.test(src("lib/searxngLocal.js")) && /EXTRA = \["sniffio"\]/.test(src("lib/searxngLocal.js")) && SX.dir() === path.join(BASE, "searxng"));
  check("2.886.1 Windows: no uvloop (it has no Windows build - simplexng still requires it): simplexng --no-deps, its dependencies minus uvloop (pins, else the newest wheels), a uvloop stand-in keeping asyncio's own loop",
    SX.noUvloop({}) === (process.platform === "win32") && SX.noUvloop({ noUvloop: true }) && /def install\(\):\n    pass/.test(SX.UVLOOP_SHIM) && /asyncio\.new_event_loop\(\)/.test(SX.UVLOOP_SHIM)
    && /"--no-deps", "simplexng"/.test(src("lib/searxngLocal.js")) && /q\.name\.lower\(\) == 'uvloop'/.test(src("lib/searxngLocal.js")) && /newest versions with ready-made wheels/.test(src("lib/searxngLocal.js")));
  check("not installed: search order stays Wikipedia, and its results carry the hint to install SearXNG", W.view().engine === "wikipedia" && W.view().searxng.local === false);
  W.FETCH.fn = async () => ({ query: { search: [{ title: "A", snippet: "b" }] } });
  check("...the hint", /Install SearXNG/.test((await W.search("x")).hint));
  fs.mkdirSync(path.join(BASE, "searxng", ".venv", process.platform === "win32" ? "Scripts" : "bin"), { recursive: true });
  fs.writeFileSync(path.join(BASE, "searxng", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python"), ""); fs.writeFileSync(path.join(BASE, "searxng", "settings.yml"), y); fs.writeFileSync(path.join(BASE, "searxng", ".installed"), "x");
  let asked = ""; W.FETCH.fn = async (u) => { asked = u; return { results: [], unresponsive_engines: [["google", "Suspended: HTTP connection error"]] }; };
  const r = await W.search("sourdough");
  check("installed: bitGen's own SearXNG is used (this computer's 8888, format=json) when Brave is off and no address is typed; no answers = which engines did not answer", W.view().engine === "searxng" && W.view().searxng.local && asked === `http://${"127.0." + "0.1"}:8888/search?q=sourdough&format=json&safesearch=1` && /did not answer \(google: Suspended/.test(r.hint), { asked, r });
  CFG = { websearch: { brave: { on: true, key: "K" } } };
  check("Brave ticked + a key still comes first", W.view().engine === "brave");
  CFG = {}; W.FETCH.fn = null;
  // media
  const png = B([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 13]), jpg = B([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]);
  const mp4 = Buffer.concat([B([0, 0, 0, 0x20]), B("ftypisom0000")]), webm = B([0x1a, 0x45, 0xdf, 0xa3, 1, 0, 0, 0, 0, 0, 0, 0]), mp3 = B("ID3\x03\x00\x00\x00\x00\x00\x00\x00\x00");
  const wav = Buffer.concat([B("RIFF"), B([0, 0, 0, 0]), B("WAVEfmt ")]), gif = B("GIF89a\x01\x00\x01\x00\x00\x00"), m4a = Buffer.concat([B([0, 0, 0, 0x20]), B("ftypM4A 0000")]);
  const kinds = [png, jpg, gif, mp4, webm, mp3, wav, m4a].map((b) => (W.mediaOf(b) || {}).ext).join(",");
  check("first bytes -> the kind + extension: png jpg gif mp4 webm mp3 wav m4a", kinds === ".png,.jpg,.gif,.mp4,.webm,.mp3,.wav,.m4a", kinds);
  check("...a program, an archive, a script, a web page are no media", [B("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00"), B("PK\x03\x04\x14\x00\x00\x00\x08\x00\x00\x00"), B("#!/bin/sh\necho hi\n"), B("<!doctype html><html>")].every((b) => W.mediaOf(b) === null));
  check("only picture / video / sound answers (by type) - text, programs, scripts are not", W.MEDIA_TYPES.image.test("image/png") && W.MEDIA_TYPES.video.test("video/mp4") && W.MEDIA_TYPES.audio.test("audio/mpeg") && !Object.values(W.MEDIA_TYPES).some((re) => ["text/html", "application/x-msdownload", "application/javascript", "application/zip"].some((t) => re.test(t))));
  const LOOP = "127.0." + "0.1";
  let dl = ""; try { await W.download(`http://${LOOP}/a.png`, path.join(BASE, "dl")); } catch (e) { dl = e.message; }
  let dl2 = ""; try { await W.download("https://example.com/setup.exe", path.join(BASE, "dl")); } catch (e) { dl2 = e.message; }
  check("downloads use the same address filters (this computer refused) and refuse program names before asking", /never read/.test(dl) && /download or run/.test(dl2), { dl, dl2 });
  check("page reading lists its media (img / video / source / audio / og:image), absolute, no data: URLs", (() => { const m = W.htmlToText('<img src="/p.jpg" alt="P"><img src="data:image/png;base64,AA"><audio src="s.mp3"></audio><video><source src="v.webm" type="video/webm"></video>', "https://s.example/x/").media; return m.length === 3 && m[0].url === "https://s.example/p.jpg" && m[1].kind === "audio" && m[2].kind === "video"; })());
  // the loop's policy
  check("web_download is a 'media' tool, allowed only when the user's words ask: dl / download / save / grab", AG.TOOLS.web_download.risk === "media" && AG.ASKS_DOWNLOAD.test("dl some pictures of cats") && AG.ASKS_DOWNLOAD.test("please download the song") && AG.ASKS_DOWNLOAD.test("save 3 videos of waves") && !AG.ASKS_DOWNLOAD.test("what is a sourdough starter?"));
  check("refused when not asked (even with the web in the turn); allowed when asked; other risks still refused while tainted", /only done when the user asks/.test(AG.refuse(AG.TOOLS.web_download, { allowMedia: false, tainted: true })) && AG.refuse(AG.TOOLS.web_download, { allowMedia: true, tainted: true }) === null && /only searching and reading/.test(AG.refuse({ risk: "exec" }, { tainted: true, allow: ["exec"], allowMedia: true })));
  const steps = []; let k = 0;
  const said = ['<tool>{"name": "web_download", "url": "https://img.example/cat.png"}</tool>', "Here you go."];
  const r1 = await AG.run({ projDir: () => path.join(BASE, "projects", "p1"), getProject: () => "p1" }, { messages: [{ role: "user", content: "what do cats look like?" }], complete: async () => ({ ok: true, text: said[k++] }), onStep: (s) => steps.push(s) });
  check("a turn that did not ask: the download is refused, nothing written", r1.ok && steps[0] && !steps[0].ok && /only done when the user asks/.test(steps[0].error) && !fs.existsSync(path.join(BASE, "projects", "p1", "web", "downloads")), steps);
  check("the downloads folder is <project>/web/downloads; the Gallery lists it (OUT_DIRS web) incl. gif", /OUT_DIRS = \["project", "output", "final", "web"\]/.test(src("routes/index.js")) && /which === "web" \? path\.join\(core\.projDir\(core\.getProject\(\)\), "web", "downloads"\)/.test(src("routes/index.js")) && /images: \/\\\.\(png\|jpe\?g\|bmp\|gif\|avif\)\$\/i/.test(src("routes/index.js")));
  check("the reply lists what was downloaded; the page refreshes the Gallery after a turn that downloaded", /Downloaded to web\/downloads \(in the Gallery\)/.test(src("lib/llmAgent.js")) && /refreshGallery\(\)/.test(src("ext/promptdock/ptweb.js")));
  const rt = src("routes/webSearch.js"), ui = src("static/websearchset.js");
  check("routes: GET /api/websearch/searxng, POST install / start / stop; Settings: ⬇ Install SearXNG here (free, no key), ▶ Start, its log", ['"/api/websearch/searxng"', '"/api/websearch/searxng/install"', '"/api/websearch/searxng/start"', '"/api/websearch/searxng/stop"'].every((x) => rt.includes(x)) && /⬇ Install SearXNG here \(free, no key\)/.test(ui) && /id="s_wsSxStart"/.test(ui) && /id="s_wsSxLog"/.test(ui));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
