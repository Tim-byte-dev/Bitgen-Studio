#!/usr/bin/env node
/* bitGen Studio — 2.858.0 units: 🌐 Build Website ▸ ☑ into this project's www folder (lib/webProject.js importBuild via
 * lib/siteBuild.js build {toWww}: the build's files copied in, your own files kept, an inc/config.php already there kept with the
 * build's missing settings added) + ⤴ Publish www to GitHub (lib/sitePublish.js publishWww / wwwSettings on the shared pushDir -
 * never inc/config.php, settings in web/publish.json); the wiring (routes, the Build dialog tick, the Web editor's ⤴ Publish). */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
(async () => {
  const W = require(path.join(ROOT, "lib/webProject.js")), B = require(path.join(ROOT, "lib/siteBuild.js")), P = require(path.join(ROOT, "lib/sitePublish.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t858-")), PJ = path.join(tmp, "projects", "Rosie"); fs.mkdirSync(PJ, { recursive: true });
  W.setProjectDir(() => PJ); B.setDir(path.join(tmp, "sites")); P.setBase(tmp); P.setApi("https://api.example");
  W.create(undefined, "Rosie");
  const www = path.join(PJ, "www");
  fs.writeFileSync(path.join(www, "my-own.html"), "MINE");
  fs.writeFileSync(path.join(www, "inc", "config.php"), "<?php\ndefine('DB_NAME', getenv('DB_NAME') ?: 'rosie_site');\ndefine('DB_PASS', getenv('DB_PASS') ?: 'typed-on-server');\n");
  B.save({ name: "Rosie", title: "Rosie's Bakery", stack: "php", admin: true, pages: [{ title: "Home", w: 1200, h: 800, els: [{ kind: "text", text: "Fresh bread", size: 30, box: { x: 0, y: 0, w: 500, h: 40 } }] }], assets: [{ name: "a.png", b64: Buffer.from("PNG").toString("base64") }] });
  const r = await B.build("Rosie", { ai: false, toWww: true });
  const cfg = fs.readFileSync(path.join(www, "inc", "config.php"), "utf8"), key = JSON.parse(fs.readFileSync(path.join(tmp, "sites", "Rosie", "site.json"), "utf8")).adminKey;
  check("Build Website ▸ ☑ into www: the built files copied into the project's www (the home page replaced, its pictures, the admin area)", r.www && r.www.copied > 5 && /Fresh bread/.test(fs.readFileSync(path.join(www, "index.php"), "utf8")) && fs.existsSync(path.join(www, "assets", "a.png")) && fs.existsSync(path.join(www, "admin", "index.php")), r.www);
  check("...your own files in www stay; inc/config.php kept (the CRM's database, the server's password) with the build's missing settings added (the setup key)", fs.readFileSync(path.join(www, "my-own.html"), "utf8") === "MINE" && /'rosie_site'/.test(cfg) && /typed-on-server/.test(cfg) && cfg.includes(key) && (cfg.match(/define\('DB_NAME'/g) || []).length === 1 && r.www.configMerged > 0, cfg);
  const r2 = await B.build("Rosie", { ai: false });
  check("...without the tick nothing goes into www", r2.www === null);
  // ⤴ publish www
  const repos = {}, calls = [];
  const sha = (s) => crypto.createHash("sha1").update(s).digest("hex"), blobSha = (b) => crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob " + b.length + "\0"), b])).digest("hex");
  P.setFetch(async (url, o) => {
    const p = new URL(url).pathname, m = o.method, body = o.body ? JSON.parse(o.body) : null, res = (st, j) => ({ ok: st < 300, status: st, text: async () => JSON.stringify(j) });
    calls.push(m + " " + p);
    if (p === "/user") return res(200, { login: "timpaul" });
    if (m === "POST" && p === "/user/repos") { repos["timpaul/" + body.name] = { files: {}, priv: body.private }; return res(201, { html_url: "https://github.com/timpaul/" + body.name }); }
    const mm = /^\/repos\/([^/]+\/[^/]+)(\/.*)?$/.exec(p), R = mm && repos[mm[1]], rest = mm ? mm[2] || "" : "";
    if (!R) return res(404, { message: "Not Found" });
    if (!rest) return res(200, { html_url: "https://github.com/" + mm[1] });
    if (/^\/git\/ref\/heads\//.test(rest)) return R.head ? res(200, { object: { sha: R.head } }) : res(404, {});
    if (/^\/git\/commits\//.test(rest) && m === "GET") return res(200, { tree: { sha: "T" } });
    if (/^\/git\/trees\//.test(rest)) return res(200, { tree: Object.entries(R.files).map(([path, s]) => ({ path, type: "blob", sha: s })) });
    if (rest === "/git/blobs") { const b = Buffer.from(body.content, "base64"); R.blobs = R.blobs || {}; R.blobs[blobSha(b)] = b; return res(201, { sha: blobSha(b) }); }
    if (rest === "/git/trees") { R.next = Object.assign({}, body.base_tree ? R.files : {}); for (const e of body.tree) { if (e.sha === null) delete R.next[e.path]; else R.next[e.path] = e.sha; } return res(201, { sha: "T2" }); }
    if (rest === "/git/commits") return res(201, { sha: sha(JSON.stringify(R.next)) });
    if (rest === "/git/refs" || /^\/git\/refs\/heads\//.test(rest)) { R.files = R.next; R.head = body.sha; return res(201, {}); }
    return res(404, { message: rest });
  });
  const st = P.wwwSettings();
  check("⤴ the www publish settings: the repository named after the project, main, private, no token yet", st.built && st.publish.repo === "rosie" && st.publish.branch === "main" && st.publish.private && !st.token, st);
  const pr = await P.publishWww({ token: "ghp_testtoken1234567890abcdef", message: "site" });
  const R = repos["timpaul/rosie"], got = (f) => R.blobs[R.files[f]] ? R.blobs[R.files[f]].toString() : null;
  check("⤴ publish www: the repository made (private), www's files sent - inc/config.php NEVER (its password, the setup key), the sample + .gitignore + DEPLOY.md instead", pr.created && R.priv && got("index.php") && got("my-own.html") === "MINE" && !R.files["inc/config.php"] && !Object.values(R.files).some((s) => /typed-on-server/.test(String(R.blobs[s]))) && !Object.values(R.files).some((s) => String(R.blobs[s]).includes(key)) && /define\('DB_PASS', getenv\('DB_PASS'\) \?: ''\);/.test(got("inc/config.sample.php")) && /inc\/config\.php/.test(got(".gitignore")) && /Plesk/.test(got("DEPLOY.md")), { pr, files: Object.keys(R.files) });
  const pj = JSON.parse(fs.readFileSync(path.join(PJ, "web", "publish.json"), "utf8"));
  check("...where it went kept in the project's web/publish.json (no token); a second publish with nothing changed sends nothing", pj.publish.repo === "rosie" && pj.published.commit === pr.commit && !JSON.stringify(pj).includes("ghp_") && (await P.publishWww({})).nothing, pj);
  fs.rmSync(tmp, { recursive: true, force: true });
  const RW = src("routes/webEditor.js"), H = src("ext/webdock/webdock.js"), DH = src("ext/webdock/dock.html"), S = src("ext/imageeditdock/pcsite.js");
  check("the wiring: /api/web/publish (GET + POST), /api/sites/build toWww, Build Website's ☑ into www, the Web editor's ⤴ Publish panel", /app\.get\("\/api\/web\/publish"/.test(RW) && /app\.post\("\/api\/web\/publish"/.test(RW) && /toWww: !!req\.body\.toWww/.test(src("routes/sites.js")) && /id="siteWww"/.test(S) && /toWww \}\)/.test(S) && /id="wbPub"/.test(DH) && /id="wbPubForm"/.test(DH) && /\/api\/web\/publish/.test(H));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
