#!/usr/bin/env node
/* bitGen Studio — 2.854.0 units: ⤴ PUBLISH A WEBSITE TO GITHUB - lib/sitePublish.js against an in-memory GitHub (the REST
 * calls it makes: /user, repos, git refs / commits / trees / blobs): the repository made when missing (private), only the
 * changed files sent (git's own blob ids), files the site no longer has taken out (.github/ left alone), the secrets never
 * sent (inc/config.php -> config.sample.php with the key + password blanked, no README.txt), DEPLOY.md + .gitignore + the
 * FTP workflow, the token kept encrypted (settings/keys.json) and never in site.json; the wiring (routes/sites.js, pcsite,
 * the Web ribbon). The browser: test-ui854-ui.js. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
/** a tiny GitHub: repos {key: {private, branches {name: commitSha}, commits, trees, blobs}} */
function fakeGitHub(login) {
  const G = { repos: {}, calls: [], blobsSent: 0, login };
  const sha = (s) => crypto.createHash("sha1").update(s).digest("hex");
  const res = (status, j) => ({ ok: status < 300, status, text: async () => JSON.stringify(j) });
  G.fetch = async (url, o) => {
    const u = new URL(url), m = o.method, p = decodeURIComponent(u.pathname), body = o.body ? JSON.parse(o.body) : null;
    G.calls.push(m + " " + p);
    if (o.headers.Authorization !== "Bearer ghp_testtoken1234567890abcdef") return res(401, { message: "Bad credentials" });
    if (m === "GET" && p === "/user") return res(200, { login });
    if (m === "POST" && /^\/orgs\/[^/]+\/repos$/.test(p)) { const k = p.split("/")[2] + "/" + body.name; G.repos[k] = { private: body.private, branches: {}, commits: {}, trees: {}, blobs: {} }; return res(201, { html_url: "https://github.com/" + k }); }
    if (m === "POST" && p === "/user/repos") { const k = login + "/" + body.name; G.repos[k] = { private: body.private, branches: {}, commits: {}, trees: {}, blobs: {} }; if (body.auto_init) { const R = G.repos[k], b = Buffer.from("# " + body.name + "\n"), bs = blobSha(b); R.blobs[bs] = b; const ts = sha("t0"); R.trees[ts] = { "README.md": bs }; const cs = sha("c0"); R.commits[cs] = { tree: ts }; R.branches.main = cs; } return res(201, { html_url: "https://github.com/" + k, full_name: k }); }
    let mm = /^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/.exec(p); if (!mm) return res(404, { message: "Not Found" });
    const k = mm[1] + "/" + mm[2], R = G.repos[k], rest = mm[3] || "";
    if (!R) return res(404, { message: "Not Found" });
    if (m === "GET" && !rest) return res(200, { html_url: "https://github.com/" + k });
    if (m === "GET" && (mm = /^\/git\/ref\/heads\/(.+)$/.exec(rest))) return R.branches[mm[1]] ? res(200, { object: { sha: R.branches[mm[1]] } }) : res(404, { message: "Not Found" });
    if (m === "GET" && (mm = /^\/git\/commits\/(\w+)$/.exec(rest))) return res(200, { tree: { sha: R.commits[mm[1]].tree } });
    if (m === "GET" && (mm = /^\/git\/trees\/(\w+)$/.exec(rest))) return res(200, { tree: Object.entries(R.trees[mm[1]]).map(([path, s]) => ({ path, type: "blob", sha: s })) });
    if (m === "POST" && rest === "/git/blobs") { const b = Buffer.from(body.content, "base64"), s = blobSha(b); R.blobs[s] = b; G.blobsSent++; return res(201, { sha: s }); }
    if (m === "POST" && rest === "/git/trees") { const t = Object.assign({}, body.base_tree ? R.trees[body.base_tree] : {}); for (const e of body.tree) { if (e.sha === null) delete t[e.path]; else t[e.path] = e.sha; } const s = sha(JSON.stringify(Object.entries(t).sort())); R.trees[s] = t; return res(201, { sha: s }); }
    if (m === "POST" && rest === "/git/commits") { const s = sha(body.message + body.tree + Date.now() + Math.random()); R.commits[s] = { tree: body.tree, parents: body.parents, message: body.message }; return res(201, { sha: s }); }
    if (m === "PATCH" && (mm = /^\/git\/refs\/heads\/(.+)$/.exec(rest))) { R.branches[mm[1]] = body.sha; return res(200, {}); }
    if (m === "POST" && rest === "/git/refs") { R.branches[body.ref.replace("refs/heads/", "")] = body.sha; return res(201, {}); }
    return res(404, { message: "Not Found " + m + " " + rest });
  };
  G.files = (k, br) => { const R = G.repos[k], t = R.trees[R.commits[R.branches[br || "main"]].tree]; const o = {}; for (const [f, s] of Object.entries(t)) o[f] = R.blobs[s].toString(); return o; };
  return G;
}
function blobSha(buf) { return crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob " + buf.length + "\0"), buf])).digest("hex"); }
(async () => {
  const P = require(path.join(ROOT, "lib/sitePublish.js")), B = require(path.join(ROOT, "lib/siteBuild.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "t854-")); B.setDir(path.join(tmp, "sites")); P.setBase(tmp); P.setApi("https://api.example");
  check("git's own blob id (the same as `git hash-object`)", P.blobSha(Buffer.from("hello\n")) === "ce013625030ba8dba906f756967f9e9ca394464a");
  check("the repository's name from the site's; owner / repo / branch checked", P.repoName("Rosie's Bakery!") === "rosie-s-bakery" && P.clean({}, "Rosie").repo === "rosie" && P.clean({}, "x").private === true && P.clean({ private: false }, "x").private === false
    && (() => { try { P.clean({ owner: "bad owner!" }, "x"); return false; } catch (e) { return /owner/.test(e.message); } })() && (() => { try { P.clean({ branch: "a..b" }, "x"); return false; } catch (e) { return /branch/.test(e.message); } })());
  B.save({ name: "Rosie", title: "Rosie's Bakery", stack: "php", admin: true, pages: [{ title: "Home", w: 1200, h: 800, els: [{ kind: "text", text: "Fresh bread", size: 30, box: { x: 0, y: 0, w: 500, h: 40 } }] }], assets: [{ name: "a.png", b64: Buffer.from("PNG").toString("base64") }] });
  await B.build("Rosie", { ai: false });
  const meta = JSON.parse(fs.readFileSync(path.join(tmp, "sites", "Rosie", "site.json"), "utf8")), key = meta.adminKey;
  let e0 = ""; try { await P.publish({ name: "Rosie" }); } catch (e) { e0 = e.message; }
  check("no token = asked for one (where to make it)", /GitHub token first/.test(e0), e0);
  let e1 = ""; try { P.setToken("not a token!"); } catch (e) { e1 = e.message; }
  check("a token that is not one refused", /does not look like/.test(e1));
  const G = fakeGitHub("timpaul"); P.setFetch(G.fetch);
  const r1 = await P.publish({ name: "Rosie", token: "ghp_testtoken1234567890abcdef", ftp: true, message: "first" });
  const files = G.files("timpaul/rosie"), all = Object.values(files).join("\n");
  check("the first publish: the repository made (private, the token's user), the site's files in one commit on main", r1.created && G.repos["timpaul/rosie"].private === true && r1.sent > 5 && !!files["index.php"] && !!files["assets/a.png"] && !!files["css/site.css"] && r1.url === "https://github.com/timpaul/rosie", { r1, files: Object.keys(files) });
  check("the secrets never sent: no inc/config.php, no README.txt, the setup key nowhere; config.sample.php with the key blanked; .gitignore keeps config.php out",
    !files["inc/config.php"] && !files["README.txt"] && !all.includes(key) && /define\('ADMIN_SETUP_KEY', getenv\('ADMIN_SETUP_KEY'\) \?: ''\);/.test(files["inc/config.sample.php"] || "") && /^inc\/config\.php$/m.test(files[".gitignore"] || ""), { key, sample: (files["inc/config.sample.php"] || "").slice(-300) });
  check("DEPLOY.md (Plesk ▸ Git into httpdocs, the FTP secrets, copy config.sample.php) + the FTP workflow on the branch", /Plesk:\*\* Websites & Domains ▸ Git/.test(files["DEPLOY.md"]) && /FTP_PASSWORD/.test(files["DEPLOY.md"]) && /copy\n`inc\/config\.sample\.php` to `inc\/config\.php`/.test(files["DEPLOY.md"]) && /branches: \["main"\]/.test(files[".github/workflows/deploy.yml"] || "") && /secrets\.FTP_SERVER/.test(files[".github/workflows/deploy.yml"]), files["DEPLOY.md"]);
  const kj = fs.readFileSync(path.join(tmp, "settings", "keys.json"), "utf8"), sj = fs.readFileSync(path.join(tmp, "sites", "Rosie", "site.json"), "utf8");
  check("the token kept encrypted in settings/keys.json, never in site.json; site.json keeps where it went + the commit", /SITE_GITHUB_TOKEN/.test(kj) && !kj.includes("ghp_testtoken") && !sj.includes("ghp_") && JSON.parse(sj).publish.repo === "rosie" && JSON.parse(sj).published.commit === r1.commit && P.settings("Rosie").token === true);
  const n1 = G.blobsSent, r2 = await P.publish({ name: "Rosie" });
  check("published again with nothing changed: nothing sent, no commit (the kept token used)", r2.nothing && G.blobsSent === n1 && r2.commit === r1.commit && r2.kept === r1.sent + r1.kept, r2);
  // a page changed + a picture gone + a workflow of the user's own in .github/
  G.repos["timpaul/rosie"].trees[G.repos["timpaul/rosie"].commits[G.repos["timpaul/rosie"].branches.main].tree][".github/workflows/mine.yml"] = blobSha(Buffer.from("x"));
  G.repos["timpaul/rosie"].blobs[blobSha(Buffer.from("x"))] = Buffer.from("x");
  B.save({ name: "Rosie", title: "Rosie's Bakery", stack: "php", pages: [{ title: "Home", w: 1200, h: 800, els: [{ kind: "text", text: "Fresh bread daily", size: 30, box: { x: 0, y: 0, w: 500, h: 40 } }] }], assets: [] });
  fs.unlinkSync(path.join(tmp, "sites", "Rosie", "assets", "a.png")); await B.build("Rosie", { ai: false });
  const n2 = G.blobsSent, r3 = await P.publish({ name: "Rosie", ftp: false }), f3 = G.files("timpaul/rosie");
  check("a change: only the changed files sent, a picture the site no longer has + the old FTP workflow taken out, the user's own .github/ file left, the README the repository was made with taken out",
    !r3.nothing && r3.sent === G.blobsSent - n2 && r3.sent < 6 && /Fresh bread daily/.test(f3["index.php"]) && !f3["assets/a.png"] && !f3[".github/workflows/deploy.yml"] && !!f3[".github/workflows/mine.yml"] && !f3["README.md"] && r3.removed >= 2, { r3, files: Object.keys(f3) });
  const c3 = G.repos["timpaul/rosie"].commits[r3.commit];
  check("the commit follows the last one; the default message names the site", c3.parents[0] === r1.commit && /Rosie's Bakery - published from bitGen Studio/.test(c3.message), c3);
  // another owner = an organisation; a token GitHub refuses
  const r4 = await P.publish({ name: "Rosie", owner: "tigerart", repo: "bakery-site", branch: "live" });
  check("another owner = made in that organisation; an empty repository's branch made by the first commit (no parent)", G.calls.includes("POST /orgs/tigerart/repos") && r4.created && G.repos["tigerart/bakery-site"].branches.live === r4.commit && !G.repos["tigerart/bakery-site"].commits[r4.commit].parents.length && !!G.files("tigerart/bakery-site", "live")["index.php"], r4);
  P.setToken("ghp_wrongtoken1234567890abcdef"); let e2 = ""; try { await P.publish({ name: "Rosie" }); } catch (e) { e2 = e.message; }
  check("GitHub refusing the token is said with what to do", /refused the token/.test(e2) && /repo scope/.test(e2), e2);
  P.setToken(""); check("✕ forgets the token", P.tokenOf() === "" && P.settings("Rosie").token === false);
  fs.rmSync(tmp, { recursive: true, force: true });
  /* ---- the wiring */
  const R = src("routes/sites.js"), S = src("ext/imageeditdock/pcsite.js");
  check("routes/sites.js (not server.js): GET /api/sites/publish, POST /api/sites/publish, POST /api/sites/publish/token", /app\.get\("\/api\/sites\/publish"/.test(R) && /app\.post\("\/api\/sites\/publish"/.test(R) && /app\.post\("\/api\/sites\/publish\/token"/.test(R) && !/sitePublish/.test(src("misc/server.js")));
  check("pcsite: ⤴ Publish to GitHub… in Build Website, File ▸ ⤴ Publish Website to GitHub…, the Web ribbon's ⤴", /id="sitePub"/.test(S) && /addCmd\("file\.sitepub", "⤴ Publish Website to GitHub…"/.test(S) && /\["cmd", "file\.sitepub", "Publish to GitHub", "⤴"\]/.test(src("ext/imageeditdock/pcviews.js")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
