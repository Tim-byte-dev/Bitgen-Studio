#!/usr/bin/env node
/* bitGen Studio — 2.715.0: LANGUAGE PACKS (lib/langPacks.js, routes/langPacks.js, static/helplang.js / uilang.js /
 * langpacks.js). Every language besides English is a pack - built in (docs/i18n/<id>/pack.json) or installed
 * (<install>/langpacks/<id>/, Settings ▸ Languages) - and the master pack starts a new one.
 * Tim (verbatim): "is it too late to make the languages into language packs,so we can add a new language easily later?" -
 * "lets do number 2, this way we don't have to create all the packs at once - if we could have a master pack so users can
 * translate the strings and upload to tigerart for the community it would be ideal" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const LP = require("../lib/langPacks");
const I = require("../lib/helpI18n");
const U = require("../lib/unzip");
const Z = require("../lib/zipWrite");
const H = require("../static/helplang.js");
const P = require("../static/langpacks.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lp715-"));
LP.setBase(ROOT, tmp);
const unpack = (buf) => U.entries(buf).map((e) => ({ name: e.name, data: U.read(buf, e) }));
function edit(buf, meta, words, more) {
  const ents = unpack(buf);
  const pj = ents.find((e) => e.name === "pack.json"), ui = ents.find((e) => e.name === "ui.json");
  pj.data = JSON.stringify(Object.assign(JSON.parse(pj.data), meta));
  const u = JSON.parse(ui.data); Object.assign(u.strings, words || {}); ui.data = JSON.stringify(u);
  return Z.zip(ents.concat(more || []).map((e) => ({ name: e.name, data: e.data, deflate: true })));
}

try {
  // ---- the built-in packs
  const L = LP.list();
  check("built in: 简体中文, 繁體中文, 日本語 - each docs/i18n/<id>/pack.json, in that order", JSON.stringify(L.map((p) => [p.id, p.native, p.source])) === JSON.stringify([["zh-CN", "简体中文", "built-in"], ["zh-TW", "繁體中文", "built-in"], ["ja", "日本語", "built-in"]]), L);
  const F = LP.files("ja");
  check("…a built-in's files: its pack.json says where the older ones are (static/i18n/ui/ja.json, static/help/ja), the rest beside it", F.ui === path.join(ROOT, "static", "i18n", "ui", "ja.json") && F.help === path.join(ROOT, "static", "help", "ja") && F.usage === path.join(ROOT, "docs", "i18n", "ja", "USAGE.md"), F);
  check("…the browser languages each picks, keepAll, the guide's notes in its language", JSON.stringify(LP.get("zh-TW").browser) === JSON.stringify(["zh-tw", "zh-hk", "zh-mo", "zh-hant"]) && LP.get("ja").keepAll && /英語/.test(LP.get("ja").words.stale));
  check("lib/helpI18n.js reads the languages from the packs (LANGS, isLang, each file)", I.LANGS.length === 3 && I.isLang("zh-CN") && !I.isLang("ko") && I.fileOf(ROOT, "ja", "usage") === F.usage);
  const cov = LP.coverage("ja");
  check("coverage(ja): the app's words 99 %+, every pattern, the guide 190+ sections, 3 help pages, every shortcut group, all 957 features",
    cov.ui.done / cov.ui.total > 0.99 && cov.patterns.done === cov.patterns.total && cov.guide.done >= 190 && cov.help.done === 3 && cov.shortcuts.done === cov.shortcuts.total && cov.features.done === cov.features.total && cov.features.total > 900, cov);

  // ---- pack.json rules
  const bad = (j) => LP.cleanMeta(j).error || "";
  check("pack.json: refused - English, the master's xx, a code that is not one, no native name",
    /English is built in/.test(bad({ id: "en", native: "x" })) && /"xx"/.test(bad({ id: "xx", native: "x" })) && /language code/.test(bad({ id: "../x", native: "x" })) && /native/.test(bad({ id: "ko" })) && /native/.test(bad({ id: "ko", native: "Your language (in its own words)" })));
  const m = LP.cleanMeta({ id: "pt-BR", native: "Português", browser: ["PT-BR", "<x>"], authors: ["Ana", "Your name"], words: { stale: "Mais novo", x: "y" }, keepAll: "yes" });
  check("…cleaned: browser tags lower case (junk out), the master's placeholder author out, unknown words out, keepAll only when true", JSON.stringify(m.browser) === '["pt-br"]' && JSON.stringify(m.authors) === '["Ana"]' && JSON.stringify(m.words) === '{"stale":"Mais novo"}' && m.keepAll === false && m.name === "Português", m);

  // ---- the master pack
  const master = LP.masterZip(), names = unpack(master).map((e) => e.name);
  check("the master pack: pack.json, TRANSLATING.txt, ui.json, USAGE.md, shortcuts.json, FEATURES.md, help/<every topic>.html", ["pack.json", "TRANSLATING.txt", "ui.json", "USAGE.md", "shortcuts.json", "FEATURES.md"].every((n) => names.includes(n)) && LP.englishTopics().every((t) => names.includes("help/" + t + ".html")), names);
  const mui = JSON.parse(unpack(master).find((e) => e.name === "ui.json").data), E = LP.englishUi();
  check("…ui.json: every English string and pattern the app has, each \"\" (to fill in)", Object.keys(mui.strings).length === E.strings.length && Object.keys(mui.patterns).length === E.patterns.length && Object.values(mui.strings).every((v) => v === ""), [Object.keys(mui.strings).length, E.strings.length]);
  const musage = unpack(master).find((e) => e.name === "USAGE.md").data.toString();
  check("…USAGE.md: the English guide with a <!-- en: id hash --> line in every section", (musage.match(/<!-- en: /g) || []).length === I.rawSections(rd("docs/USAGE.md")).length, (musage.match(/<!-- en: /g) || []).length);
  check("…compressed (deflate - the text packs about 4x smaller)", master.length < 700000 && U.entries(master).some((e) => e.method === 8), master.length);
  let err = ""; try { LP.check(master); } catch (e) { err = e.message; }
  check("…installing it as it is says to put the language's code in pack.json", /put your language's code/.test(err), err);

  // ---- install a pack made from it
  const eo = edit(master, { id: "eo", name: "Esperanto", native: "Esperanto", authors: ["Test"] }, { Themes: "Temoj", "Bad {0}": "x" },
    [{ name: "help/zz.html", data: Buffer.from("<!-- en: zz 0123456789ab -->\n<h3 id=\"a\" onclick=\"x()\">Hi</h3><script>alert(1)</script><img src=x onerror=alert(1)><b>ok</b> 1 < 2") }, { name: "evil.exe", data: Buffer.from("x") }]);
  const r = LP.install(eo);
  check("install(): the pack in langpacks/eo, listed after the built-in ones", r.pack.id === "eo" && r.pack.source === "installed" && fs.existsSync(path.join(tmp, "eo", "pack.json")) && LP.list().map((p) => p.id).join() === "zh-CN,zh-TW,ja,eo", LP.list().map((p) => p.id));
  check("…a translation whose {0} … differ from the English is left out (with a note); a file that is not part of a pack is left out (with a note)", r.warnings.some((w) => /1 translation\(s\) left out/.test(w)) && r.warnings.some((w) => /evil\.exe/.test(w)) && !fs.existsSync(path.join(tmp, "eo", "evil.exe")), r.warnings);
  check("…its coverage: 1 word of the app; the guide, help, shortcuts, features 0 (still word for word the English = not translated)", r.coverage.ui.done === 1 && r.coverage.guide.done === 0 && r.coverage.help.done === 0 && r.coverage.shortcuts.done === 0 && r.coverage.features.done === 0, r.coverage);
  const zz = fs.readFileSync(path.join(tmp, "eo", "help", "zz.html"), "utf8");
  check("…a help page from a pack: plain tags only - no script, no onclick, no img (the marker line kept, the text escaped)", zz === '<!-- en: zz 0123456789ab -->\n<h3 id="a">Hi</h3><b>ok</b> 1 &lt; 2', zz);
  check("…the English guide still shown for its sections (lang en), its ui.json \"\" left out", I.load(ROOT, "eo").sections.every((s) => s.lang === "en") && JSON.stringify(JSON.parse(fs.readFileSync(path.join(tmp, "eo", "ui.json"))).strings) === '{"Themes":"Temoj"}');
  err = ""; try { LP.install(eo); } catch (e) { err = e; }
  check("…again: 409 'installed already - replace it?' (exists)", err.status === 409 && err.exists === true, err && err.message);
  check("…with replace: installed over it", LP.install(eo, { replace: true }).pack.id === "eo");
  // a built-in's id
  const jaZip = LP.exportZip("ja");
  const ja2 = edit(jaZip, { version: "9", authors: ["Community"] }, { Themes: "テーマ（新）" });
  const rj = LP.install(ja2);
  check("export(ja) + install: a pack with a built-in's id is used instead of it (replaces) - its translations all kept", rj.pack.replaces === true && rj.pack.version === "9" && LP.files("ja").ui === path.join(tmp, "ja", "ui.json") && rj.coverage.ui.done === cov.ui.done && rj.coverage.guide.done === cov.guide.done && rj.coverage.features.done === cov.features.done, [rj.coverage, cov]);
  check("…remove(): the built-in one is back", LP.remove("ja").builtin === true && LP.get("ja").source === "built-in");
  err = ""; try { LP.remove("zh-CN"); } catch (e) { err = e.message; }
  check("…a built-in pack cannot be removed", /built in/.test(err), err);
  // ---- export for translating: today's English added, translations kept
  const ex = unpack(LP.exportZip("eo")), exui = JSON.parse(ex.find((e) => e.name === "ui.json").data);
  check("exportZip(eo): every current English string, its own translation kept, the rest \"\"", exui.strings.Themes === "Temoj" && Object.keys(exui.strings).length === E.strings.length && exui.strings.General === "");
  const jx = unpack(jaZip).find((e) => e.name === "USAGE.md").data.toString(), jaMd = rd("docs/i18n/ja/USAGE.md");
  check("exportZip(ja): the guide's translated sections as they are, the untranslated ones in English with their marker", /アプリ|プロンプト/.test(jx) && (jx.match(/<!-- en: /g) || []).length === I.rawSections(rd("docs/USAGE.md")).length && jx.length > jaMd.length * 0.9);
  // ---- broken / hostile zips
  const refuse = (buf) => { try { LP.check(buf); return ""; } catch (e) { return e.message; } };
  check("not a zip: refused", /not a \.zip/.test(refuse(Buffer.from("hello"))));
  check("a zip without pack.json: refused", /no pack\.json/.test(refuse(Z.zip([{ name: "ui.json", data: "{}" }]))));
  check("a path that climbs out (../): refused", /unsafe path/.test(refuse(Z.zip([{ name: "pack.json", data: JSON.stringify({ id: "ko", native: "한국어" }) }, { name: "../x.txt", data: "x" }]))));
  const big = Z.zip([{ name: "pack.json", data: JSON.stringify({ id: "ko", native: "한국어" }) }, { name: "USAGE.md", data: Buffer.alloc(9 * 1024 * 1024, 32), deflate: true }]);
  check("a file that unpacks too big (a zip bomb): refused", /too big/.test(refuse(big)), refuse(big));
  check("a zip of the folder (everything under ko/) is read the same", LP.check(Z.zip([{ name: "ko/pack.json", data: JSON.stringify({ id: "ko", native: "한국어" }) }, { name: "ko/ui.json", data: JSON.stringify({ strings: { Save: "저장" } }) }])).pack.id === "ko");

  // ---- the page side
  check("helplang fromSystem: the packs' browser tags, the longest match (zh-Hant-TW -> zh-TW, zh -> zh-CN, ko-KR -> an installed ko, pt-BR over pt)",
    H.fromSystem(["zh-Hant-TW"]) === "zh-TW" && H.fromSystem(["zh"]) === "zh-CN" && H.fromSystem(["ko-KR"], [{ id: "ko", browser: ["ko"] }]) === "ko" && H.fromSystem(["pt-BR"], [{ id: "pt", browser: ["pt"] }, { id: "pt-BR", browser: ["pt-br"] }]) === "pt-BR" && H.fromSystem(["fr"]) === "en");
  H.setPacks(LP.client().filter((p) => p.source === "built-in").concat([{ id: "eo", native: "Esperanto", browser: ["eo"], words: { english: "Montri la anglan" } }]));
  check("helplang setPacks: LANGS and WORDS from the packs (an installed pack's own notes)", H.LANGS.map((l) => l.id).join() === "en,zh-CN,zh-TW,ja,eo" && H.say("english", "eo") === "Montri la anglan" && H.say("english", "ja") === "英語版を表示");
  const HL = rd("static/helplang.js"), UL = rd("static/uilang.js"), LPJ = rd("static/langpacks.js");
  check("…the dropdown's names as text (never markup), refilled when the packs change; the list kept in localStorage bg.langPacks and asked of /api/langpacks", /o\.textContent = l\.native/.test(HL) && !/innerHTML/.test(HL) && /onPacks\(fill\)/.test(HL) && /bg\.langPacks/.test(HL) && /\/api\/langpacks"/.test(HL));
  check("uilang: the words from the pack (/api/langpacks/<id>/ui.json), \"\" = not translated, keep-all for every pack that says keepAll", /"\/api\/langpacks\/" \+ encodeURIComponent\(lang\) \+ "\/ui\.json"/.test(UL) && /function dropEmpty/.test(UL) && /p\.keepAll/.test(UL) && !/\/static\/i18n\/ui\/" \+ lang/.test(UL));
  check("Settings ▸ Languages: pct / summary (pure)", P.pct({ done: 3, total: 3 }) === "3 of 3" && P.pct({ done: 1, total: 9704 }) === "<1 %" && P.pct({ done: 9700, total: 9704 }) === "99 %" && P.summary(cov).map((x) => x[0]).join() === "App,Guide,Help,Shortcuts,Features");
  check("…a pack's names and notes go in as text (textContent), not markup", /nm\.textContent = p\.native/.test(LPJ) && /li\.textContent = x/.test(LPJ) && !/innerHTML = [^'"]*p\.(native|name)/.test(LPJ));

  // ---- the routes (in-process: the handlers with a fake app)
  const R = {}; require("../routes/langPacks").mount({ get: (u, ...f) => { R["GET " + u] = f[f.length - 1]; }, post: (u, ...f) => { R["POST " + u] = f[f.length - 1]; } });
  const call = (k, req) => new Promise((done) => { const res = { code: 200, h: {}, status(c) { this.code = c; return this; }, set(a, b) { this.h[a] = b; return this; }, type() { return this; }, json(j) { done({ code: this.code, j }); }, send(b) { done({ code: this.code, b, h: this.h }); }, sendFile(f) { done({ code: this.code, file: f }); } }; R[k](Object.assign({ params: {}, query: {}, body: null }, req), res); });
  (async () => {
    const lst = await call("GET /api/langpacks", {});
    const ui = await call("GET /api/langpacks/:id/ui.json", { params: { id: "eo" } });
    const no = await call("GET /api/langpacks/:id/ui.json", { params: { id: "xx" } });
    const mz = await call("GET /api/langpacks/master.zip", {});
    const ck = await call("POST /api/langpacks/check", { body: eo });
    const dup = await call("POST /api/langpacks/install", { body: eo, query: {} });
    const rm = await call("POST /api/langpacks/remove", { body: { id: "eo" } });
    check("routes: GET /api/langpacks, /:id/ui.json (the pack's file; 404 for none), master.zip (attachment), POST check (installed: …), install 409 {exists}, remove",
      lst.j.packs.some((p) => p.id === "eo") && ui.file === path.join(tmp, "eo", "ui.json") && no.code === 404 && /attachment; filename="bitGen-language-pack-master\.zip"/.test(mz.h["Content-Disposition"]) && ck.j.installed && ck.j.installed.source === "installed" && dup.code === 409 && dup.j.exists === true && rm.j.removed === "eo",
      { lst: lst.j.packs.length, ui, no: no.code, ck: ck.j, dup, rm: rm.j });
    check("wired: routes/index.js mounts routes/langPacks.js (never server.js); index.html loads langpacks.js; langpacks/ kept out of the repo and the release zip",
      /require\("\.\/langPacks"\)\.mount\(app\)/.test(rd("routes/index.js")) && !/langPacks/.test(rd("misc/server.js")) && /<script src="\/static\/langpacks\.js">/.test(rd("static/index.html")) && /^langpacks\/$/m.test(rd(".gitignore")) && /\.\/langpacks\/\*/.test(rd("scripts/make_zips.sh")));
    const zt = U.entries(Z.zip([{ name: "a", data: "x".repeat(5000), deflate: true }, { name: "b", data: "y" }]));
    check("lib/zipWrite.js deflate (method 8) + lib/unzip.js read(…, max): a capped inflate", zt[0].method === 8 && zt[0].csize < 100 && zt[1].method === 0 && /maxOutputLength/.test(rd("lib/unzip.js")));
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  })().catch((e) => { console.log("FAIL: " + e.stack); process.exit(1); });
} catch (e) { console.log("FAIL: " + e.stack); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(1); }
