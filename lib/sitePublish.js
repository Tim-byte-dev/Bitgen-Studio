// lib/sitePublish.js — 2.854.0 ⤴ publish a built website to GitHub (Tim: "then do the publish to github").
// The built site (<site>/build) goes into a GitHub repository through GitHub's REST API (git blobs / trees / commits -
// no git program needed): the repository is made when it is not there (private unless asked), only the files that
// changed are sent, files the site no longer has are taken out (the repository's own .github/ is left alone), one
// commit per publish. The host then deploys it - Plesk ▸ Git pulling the repository into httpdocs, or the optional
// GitHub Actions workflow that sends it by FTP (its login in the repository's secrets, never here).
// NEVER in the repository: inc/config.php (the database password + the admin's setup key) and README.txt (the setup
// key) - inc/config.sample.php (the key blanked) + DEPLOY.md go instead and .gitignore keeps inc/config.php out.
// The token is kept encrypted (lib/secrets.js, settings/keys.json, SITE_GITHUB_TOKEN); site.json keeps
// {owner, repo, branch, private, ftp} (meta.publish) - never the token.
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const TOKEN = "SITE_GITHUB_TOKEN";
let API = null, BASE = null, fetchFn = null;
const api = () => API || process.env.BITGEN_GITHUB_API || "https://api.github.com";
const base = () => BASE || require("./core").BASE;
function setApi(u) { API = u; }
function setBase(b) { BASE = b; }
function setFetch(f) { fetchFn = f; }
const bad = (m, s) => Object.assign(new Error(m), { status: s || 400 });
const keys = () => require("./secrets").store(base());
function tokenOf() { return keys().read()[TOKEN] || ""; }
function setToken(t) { const v = String(t || "").trim(); if (v && !/^[\w-]{20,255}$/.test(v)) throw bad("that does not look like a GitHub token"); keys().update([TOKEN], v ? { [TOKEN]: v } : {}); return { saved: !!v }; }

/** owner/repo checked: GitHub's own rules (letters, digits, - _ .) */
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, REPO_RE = /^[A-Za-z0-9._-]{1,100}$/, BRANCH_RE = /^(?!.*\.\.)(?!\/)[A-Za-z0-9._\/-]{1,100}(?<!\/)(?<!\.lock)$/;
function repoName(name) { return String(name || "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 90) || "website"; }
function clean(o, siteName) {
  const a = o || {};
  const out = { owner: String(a.owner || "").trim(), repo: String(a.repo || "").trim() || repoName(siteName), branch: String(a.branch || "").trim() || "main", private: a.private !== false, ftp: !!a.ftp };
  if (out.owner && !OWNER_RE.test(out.owner)) throw bad("the owner is a GitHub user or organisation name (letters, digits, -)");
  if (!REPO_RE.test(out.repo) || /^\.+$/.test(out.repo)) throw bad("the repository name is letters, digits, - _ .");
  if (!BRANCH_RE.test(out.branch)) throw bad("that is not a branch name");
  return out;
}
/** git's own blob id: sha1("blob <len>\0" + bytes) - a file GitHub already has is not sent again */
function blobSha(buf) { return crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob " + buf.length + "\0"), buf])).digest("hex"); }
/** the files that go up: {path: Buffer} - the build minus its secrets, plus the sample config, DEPLOY.md, .gitignore, the workflow */
function filesOf(dir, meta, o) {
  const out = {};
  const walk = (d, rel) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const r = rel ? rel + "/" + f.name : f.name; if (f.isDirectory()) walk(path.join(d, f.name), r); else if (f.isFile()) out[r] = fs.readFileSync(path.join(d, f.name)); } };
  walk(dir, "");
  const php = !!out["inc/config.php"];
  if (php) out["inc/config.sample.php"] = Buffer.from(String(out["inc/config.php"]).replace(/(define\('ADMIN_SETUP_KEY',\s*getenv\('ADMIN_SETUP_KEY'\)\s*\?:\s*')[^']*(')/, "$1$2").replace(/(define\('DB_PASS',\s*getenv\('DB_PASS'\)\s*\?:\s*')[^']*(')/, "$1$2"));
  delete out["inc/config.php"]; delete out["README.txt"];
  out[".gitignore"] = Buffer.from("# kept on the server only - the database password and the admin's setup key\ninc/config.php\n");
  out["DEPLOY.md"] = Buffer.from(deployMd(meta, o, php));
  if (o.ftp) out[".github/workflows/deploy.yml"] = Buffer.from(WORKFLOW(o.branch));
  return out;
}
const WORKFLOW = (branch) => `# bitGen Studio: send the website to the host by FTP on every publish.
# The login goes in the repository's Settings > Secrets and variables > Actions: FTP_SERVER, FTP_USERNAME, FTP_PASSWORD
# (and FTP_DIR, e.g. httpdocs/ - the folder on the host, ending with /).
name: Deploy the website
on:
  push:
    branches: [${JSON.stringify(branch)}]
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: \${{ secrets.FTP_SERVER }}
          username: \${{ secrets.FTP_USERNAME }}
          password: \${{ secrets.FTP_PASSWORD }}
          server-dir: \${{ secrets.FTP_DIR || './' }}
          exclude: |
            **/.git*
            **/.git*/**
            .github/**
            DEPLOY.md
`;
function deployMd(meta, o, php) {
  return `# ${meta.title || meta.name} - made with bitGen Studio

This repository is the website as bitGen Studio built it. Each ⤴ Publish to GitHub in bitGen Studio sends a new commit.

## Put it on your host

**Plesk:** Websites & Domains ▸ Git ▸ Add Repository - Remote Git hosting, this repository's address (a private
repository: add Plesk's SSH key as a deploy key in the repository's Settings ▸ Deploy keys), Deployment mode Automatic,
Deployment path \`httpdocs\`. Every publish then lands on the site (or press Pull Updates).
${o.ftp ? `
**FTP (GitHub Actions):** .github/workflows/deploy.yml sends the website on every publish. Put FTP_SERVER,
FTP_USERNAME, FTP_PASSWORD and FTP_DIR (e.g. \`httpdocs/\`) in the repository's Settings ▸ Secrets and variables ▸ Actions.
` : ""}${php ? `
## Once, on the server

The database password and the admin's setup key are NOT in this repository. On the host, copy
\`inc/config.sample.php\` to \`inc/config.php\` and fill in DB_HOST, DB_NAME, DB_USER, DB_PASS${meta.admin ? " and ADMIN_SETUP_KEY (the\nkey bitGen Studio showed when it built the site - in its own README.txt)" : ""}. \`.gitignore\` keeps \`inc/config.php\`
out of the repository, so a publish never overwrites it. Then import schema.sql${meta.admin ? " (and admin-schema.sql into the admin database)" : ""}.
` : ""}`;
}

async function gh(tok, method, p, body) {
  const f = fetchFn || globalThis.fetch;
  const r = await f(api() + p, { method, headers: { Authorization: "Bearer " + tok, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "bitGen-Studio", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = { message: t.slice(0, 300) }; }
  return { status: r.status, ok: r.ok, j: j || {} };
}
function why(r, what) {
  const m = (r.j && r.j.message) || "HTTP " + r.status;
  if (r.status === 401) return bad("GitHub refused the token (" + m + ") - make a new one with the repo scope (or Contents: read and write)", 401);
  if (r.status === 403) return bad("GitHub said no to " + what + " (" + m + ") - the token needs the repo scope (Contents + Administration to make the repository)", 403);
  return bad(what + ": " + m, r.status >= 400 && r.status < 600 ? r.status : 502);
}
/** the publish settings for a site (+ whether a token is kept) */
function settings(name) {
  const B = require("./siteBuild"), dir = B.siteDir(name), f = path.join(dir, "site.json");
  if (!fs.existsSync(f)) throw bad("no website called " + name, 404);
  const meta = JSON.parse(fs.readFileSync(f, "utf8"));
  return { publish: Object.assign({ owner: "", repo: repoName(meta.name), branch: "main", private: true, ftp: false }, meta.publish || {}), token: !!tokenOf(), built: fs.existsSync(path.join(dir, "build")), last: meta.published || null };
}
/** ⤴ publish: {name, owner?, repo, branch, private, ftp, message?, token?} -> {url, commit, sent, kept, removed, created} */
async function publish(o) {
  const a = o || {}, B = require("./siteBuild"), dir = B.siteDir(a.name), mf = path.join(dir, "site.json");
  if (!fs.existsSync(mf)) throw bad("no website called " + a.name, 404);
  const out = path.join(dir, "build"); if (!fs.existsSync(out)) throw bad("build the website first (🌐 Build Website)");
  const meta = JSON.parse(fs.readFileSync(mf, "utf8"));
  return pushDir(out, meta, a, (pub, done) => { meta.publish = pub; meta.published = done; fs.writeFileSync(mf, JSON.stringify(meta, null, 2)); });
}
/** 2.858.0: the project's www folder (🌐 Web editor ▸ ⤴ Publish) - settings in projects/<p>/web/publish.json */
const wwwPubFile = () => path.join(path.dirname(require("./webProject").root()), "web", "publish.json");
function wwwMeta() {
  const W = require("./webProject"), proj = path.basename(path.dirname(W.root()));
  let m = {}; try { m = JSON.parse(fs.readFileSync(wwwPubFile(), "utf8")); } catch (e) { /* none yet */ }
  let title = proj; try { const t = /<title[^>]*>([^<]*)<\/title>/i.exec(fs.readFileSync(path.join(W.root(), "index.html"), "utf8")); if (t && t[1].trim()) title = t[1].trim(); } catch (e) { /* no index */ }
  const admin = fs.existsSync(path.join(W.root(), "admin", "index.php"));
  return Object.assign({ name: proj, title, admin }, m);
}
function wwwSettings() {
  const W = require("./webProject"), m = wwwMeta();
  return { publish: Object.assign({ owner: "", repo: repoName(m.name), branch: "main", private: true, ftp: false }, m.publish || {}), token: !!tokenOf(), built: W.has(), last: m.published || null };
}
async function publishWww(o) {
  const W = require("./webProject"); if (!W.has()) throw bad("this project has no www folder yet - 🌐 Make the www folder", 404);
  const m = wwwMeta();
  return pushDir(W.root(), m, o || {}, (pub, done) => { fs.mkdirSync(path.dirname(wwwPubFile()), { recursive: true }); fs.writeFileSync(wwwPubFile(), JSON.stringify({ publish: pub, published: done }, null, 2)); });
}
/** the shared push: a folder -> a GitHub repository (only the changed files, one commit) */
async function pushDir(out, meta, a, remember) {
  if (a.token) setToken(a.token);
  const tok = tokenOf(); if (!tok) throw bad("give a GitHub token first (github.com ▸ Settings ▸ Developer settings ▸ Personal access tokens)", 401);
  const given = {};
  for (const k of ["owner", "repo", "branch", "private", "ftp"]) if (a[k] !== undefined && a[k] !== "") given[k] = a[k];
  const p = clean(Object.assign({}, meta.publish || {}, given), meta.name);   // what was used last time, unless said now
  const me = await gh(tok, "GET", "/user"); if (!me.ok) throw why(me, "reading who the token belongs to");
  const owner = p.owner || me.j.login; if (!owner) throw bad("GitHub did not say who the token belongs to");
  const R = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(p.repo)}`;
  let created = false, rp = await gh(tok, "GET", R);
  if (rp.status === 404) {
    const mk = await gh(tok, "POST", owner.toLowerCase() === String(me.j.login || "").toLowerCase() ? "/user/repos" : `/orgs/${encodeURIComponent(owner)}/repos`, { name: p.repo, private: p.private, auto_init: true, description: `${meta.title || meta.name} - a website made with bitGen Studio` });
    if (!mk.ok) throw why(mk, "making the repository " + owner + "/" + p.repo);
    created = true; rp = mk;
  } else if (!rp.ok) throw why(rp, "opening " + owner + "/" + p.repo);
  // the branch's head (a new / empty repository: none -> the first commit has no parent)
  let head = null, baseTree = null, have = {};
  const ref = await gh(tok, "GET", `${R}/git/ref/heads/${p.branch.split("/").map(encodeURIComponent).join("/")}`);
  if (ref.ok) {
    head = ref.j.object && ref.j.object.sha;
    const c = await gh(tok, "GET", `${R}/git/commits/${head}`); if (!c.ok) throw why(c, "reading the last commit");
    baseTree = c.j.tree && c.j.tree.sha;
    const t = await gh(tok, "GET", `${R}/git/trees/${baseTree}?recursive=1`); if (!t.ok) throw why(t, "reading the repository's files");
    for (const e of t.j.tree || []) if (e.type === "blob") have[e.path] = e.sha;
  } else if (ref.status !== 404 && ref.status !== 409) throw why(ref, "reading the branch " + p.branch);
  const files = filesOf(out, meta, p), entries = [];
  let sent = 0, kept = 0, removed = 0;
  for (const [fp, buf] of Object.entries(files).sort()) {
    if (have[fp] === blobSha(buf)) { kept++; continue; }
    const b = await gh(tok, "POST", `${R}/git/blobs`, { content: buf.toString("base64"), encoding: "base64" }); if (!b.ok) throw why(b, "sending " + fp);
    entries.push({ path: fp, mode: "100644", type: "blob", sha: b.j.sha }); sent++;
  }
  for (const fp of Object.keys(have)) if (!(fp in files) && (!/^\.github\//.test(fp) || fp === ".github/workflows/deploy.yml") && fp !== "inc/config.php") { entries.push({ path: fp, mode: "100644", type: "blob", sha: null }); removed++; }
  const url = (rp.j && rp.j.html_url) || `https://github.com/${owner}/${p.repo}`;
  let commit = head;
  if (entries.length) {
    const t = await gh(tok, "POST", `${R}/git/trees`, Object.assign({ tree: entries }, baseTree ? { base_tree: baseTree } : {})); if (!t.ok) throw why(t, "making the commit's files");
    const msg = String(a.message || "").trim().slice(0, 500) || `Website ${meta.title || meta.name} - published from bitGen Studio`;
    const c = await gh(tok, "POST", `${R}/git/commits`, { message: msg, tree: t.j.sha, parents: head ? [head] : [] }); if (!c.ok) throw why(c, "making the commit");
    commit = c.j.sha;
    const u = head ? await gh(tok, "PATCH", `${R}/git/refs/heads/${p.branch}`, { sha: commit, force: false }) : await gh(tok, "POST", `${R}/git/refs`, { ref: "refs/heads/" + p.branch, sha: commit });
    if (!u.ok) throw why(u, "moving the branch " + p.branch + (u.status === 422 ? " (someone else pushed to it - publish again)" : ""));
  }
  remember({ owner, repo: p.repo, branch: p.branch, private: p.private, ftp: p.ftp }, { at: new Date().toISOString(), commit, url });
  return { url, owner, repo: p.repo, branch: p.branch, commit, sent, kept, removed, created, nothing: !entries.length };
}
module.exports = { publishWww, wwwSettings, pushDir, TOKEN, setApi, setBase, setFetch, setToken, tokenOf, clean, repoName, blobSha, filesOf, deployMd, settings, publish };
