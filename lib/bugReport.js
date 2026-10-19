// bitGen Studio — lib/bugReport.js (2.522.0): 🐞 BUG REPORTS (the docker: static/bugreport.js, Ctrl+Alt+Shift+B).
// Tim (verbatim): "can you add a bug report floating docker - ctrl+alt+shift+b opens it. this will be where a user can
// document bugs and send to the repo. i will upload the bug report file to you" - he chose: a report FILE (no GitHub),
// with a screenshot, the logs, the system + settings and the recorded steps attached.
//
//   A REPORT   bug-reports/<id>/ in the app folder: report.json (everything, machine-readable), report.md (the same to
//              read), screenshot.png (with the marks drawn on it), logs/ (app.txt = the app console - lib/appLog.js,
//              comfyui.txt, vision.txt, jobs.txt = the last jobs' logs, failed ones first)
//   THE FILE   ⤓ = one .zip of that folder (lib/zipWrite) - bitgen-bug-<date>-<title>.zip - the file to send
//   PRIVACY    the settings go through scrub(): every value under a key that looks like a token / key / password /
//              secret is replaced, and token-shaped strings anywhere (hf_..., ghp_..., sk-..., rpa_..., Bearer ...) too;
//              the recorded steps never hold what was typed (static/bugreport.js); "👁 What is included" shows it all first
// Pure (scripts/test-bugreport522.js): scrub, scrubText, slug, reportId, toMarkdown, SEVERITIES, clean.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");

const SEVERITIES = [
  { id: "crash", label: "💥 Crash / freeze" }, { id: "broken", label: "⛔ Something does not work" },
  { id: "wrong", label: "⚠ Wrong result" }, { id: "looks", label: "🎨 Looks wrong" }, { id: "idea", label: "💡 Idea / wish" },
];
const SECRET_KEY = /(token|secret|passw|api_?key|apikey|^key$|_key$|auth|cookie|credential|private)/i;
const SECRET_VAL = /\b(hf_[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{16,}|rpa_[A-Za-z0-9]{16,}|xox[abp]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/g;

/** a string with the token-shaped parts hidden (pure) */
function scrubText(s) {
  return String(s == null ? "" : s).replace(SECRET_VAL, (m) => m.slice(0, 4) + "•••").replace(/(Bearer\s+)[A-Za-z0-9._-]{8,}/gi, "$1•••")
    .replace(/([?&](?:token|key|api_key|apikey)=)[^&\s"']+/gi, "$1•••")
    .replace(/(\b(?:token|api_key|apikey|password|passwd|secret)\s*[=:]\s*)(?!•)[^&\s"',;]+/gi, "$1•••");
}
/** settings with every secret hidden (pure, deep copy) */
function scrub(v, keyName) {
  if (Array.isArray(v)) return v.map((x) => scrub(x, keyName));
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = SECRET_KEY.test(k) && (typeof x === "string" ? x : x != null && typeof x !== "object") ? (x === "" || x === false || x == null ? x : "•••") : scrub(x, k);
    return o;
  }
  if (typeof v === "string") return keyName && SECRET_KEY.test(keyName) && v ? "•••" : scrubText(v);
  return v;
}
function slug(t) { return String(t || "bug").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "bug"; }
/** bug-<YYYYMMDD-HHMMSS>-<slug> (pure) */
function reportId(title, when) {
  const d = when ? new Date(when) : new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `bug-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${slug(title)}`;
}
const txt = (v, n) => String(v == null ? "" : v).replace(/\r\n/g, "\n").slice(0, n);
/** the docker's form, cleaned (pure) */
function clean(b) {
  const o = b || {};
  return {
    title: txt(o.title, 200).replace(/\s+/g, " ").trim() || "Untitled bug",
    severity: SEVERITIES.some((s) => s.id === o.severity) ? o.severity : "broken",
    area: txt(o.area, 120).trim(),
    happened: txt(o.happened, 20000), expected: txt(o.expected, 20000), steps: txt(o.steps, 20000),
    recorded: (Array.isArray(o.recorded) ? o.recorded : []).slice(-200).map((s) => ({ t: txt(s && s.t, 20), what: scrubText(txt(s && s.what, 300)) })),
    page_errors: (Array.isArray(o.page_errors) ? o.page_errors : []).slice(-50).map((e) => scrubText(txt(e, 2000))),
    failed_requests: (Array.isArray(o.failed_requests) ? o.failed_requests : []).slice(-50).map((e) => scrubText(txt(e, 400))),
    page: { url: scrubText(txt(o.page && o.page.url, 400)), size: txt(o.page && o.page.size, 40), ua: txt(o.page && o.page.ua, 300),
            dockers: (Array.isArray(o.page && o.page.dockers) ? o.page.dockers : []).slice(0, 40).map((d) => txt(d, 80)) },
    include: Object.assign({ screenshot: true, logs: true, system: true, steps: true }, o.include || {}),
  };
}
/** report.md - what a person reads first (pure) */
function toMarkdown(r) {
  const sev = (SEVERITIES.find((s) => s.id === r.severity) || {}).label || r.severity;
  const sys = r.system || {};
  const L = [`# 🐞 ${r.title}`, "", `- **Severity:** ${sev}`, `- **Where:** ${r.area || "-"}`, `- **App:** bitGen Studio ${sys.version || "?"}`,
    `- **When:** ${r.when}`, `- **Report:** ${r.id}`, ""];
  const sec = (h, body) => { if (String(body || "").trim()) L.push(`## ${h}`, "", String(body).trim(), ""); };
  sec("What happened", r.happened);
  sec("What I expected", r.expected);
  sec("Steps to reproduce", r.steps);
  if (r.include.steps && r.recorded.length) sec("Recorded steps (the last clicks and keys - never what was typed)", r.recorded.map((s) => `- \`${s.t}\` ${s.what}`).join("\n"));
  if (r.page_errors.length) sec("Errors in the page", r.page_errors.map((e) => "```\n" + e + "\n```").join("\n"));
  if (r.failed_requests.length) sec("Requests that failed", r.failed_requests.map((e) => `- ${e}`).join("\n"));
  if (r.include.system && r.system) {
    sec("System", [`- OS: ${sys.os || "?"}`, `- CPU: ${sys.cpu || "?"} · RAM ${sys.ram_gb || "?"} GB`, `- Graphics: ${sys.gpu || "?"}`,
      `- Node ${sys.node || "?"} · ${sys.electron ? "Electron " + sys.electron : "browser"}`, `- ComfyUI: ${sys.comfy || "?"}`,
      `- Window: ${r.page.size || "?"} · dockers open: ${(r.page.dockers || []).join(", ") || "-"}`].join("\n"));
  }
  const att = [];
  if (r.files && r.files.screenshot) att.push("- screenshot.png");
  for (const f of (r.files && r.files.logs) || []) att.push(`- logs/${f}`);
  if (r.include.system) att.push("- report.json (the settings, with every key / token hidden)");
  sec("Attached", att.join("\n"));
  return L.join("\n");
}

/* ---------------- live */
function core() { return require("./core"); }
function dir() { return path.join(core().BASE, "bug-reports"); }
function safeId(id) { const s = String(id || ""); if (!/^bug-\d{8}-\d{6}-[a-z0-9-]{1,40}$/.test(s)) { const e = new Error("no such report"); e.status = 404; throw e; } return s; }
/** the computer, the app, ComfyUI (the System part of a report) */
async function system() {
  let ver = "?"; try { ver = JSON.parse(fs.readFileSync(path.join(core().BASE, "package.json"), "utf8")).version; } catch { /* ? */ }
  let gpu = "?";
  try { const p = require("./setupGpu").detect(); gpu = p.main ? `${p.main.name} (${p.vram_gb} GB)` : (p.other && p.other.name) || "none found"; } catch { gpu = "?"; }
  let comfy = "not running";
  try {
    const st = await require("./comfy").status();
    if (st.reachable) {
      const u = (((core().getConfig().engine || {}).comfy || {}).url || "http://127.0.0.1:8188").replace(/\/+$/, "");
      const r = await fetch(u + "/system_stats", { signal: AbortSignal.timeout(3000) });
      const j = await r.json();
      comfy = `${(j.system || {}).comfyui_version || "?"} (Python ${String((j.system || {}).python_version || "?").split(" ")[0]}, PyTorch ${(j.system || {}).pytorch_version || "?"})`;
    }
  } catch { /* stays as is */ }
  const cpus = os.cpus() || [];
  return { version: ver, os: `${os.type()} ${os.release()} (${process.platform} ${process.arch})`, cpu: `${(cpus[0] || {}).model || "?"} × ${cpus.length}`,
    ram_gb: Math.round(os.totalmem() / 1073741824), gpu, node: process.version, electron: process.versions.electron || "", comfy };
}
/** the logs (each a file in logs/) */
function logs() {
  const out = {};
  try { out["app.txt"] = scrubText(require("./appLog").text(3000)); } catch { /* none */ }
  try { const c = require("./comfy").logFrom(0); const l = (c && (c.lines || c.log)) || []; if (l.length) out["comfyui.txt"] = scrubText((Array.isArray(l) ? l : [l]).slice(-1500).map((x) => (typeof x === "string" ? x : x.line || JSON.stringify(x))).join("\n")); } catch { /* none */ }
  try { const v = require("./captioner").logs(); if (v && v.length) out["vision.txt"] = scrubText(v.slice(-800).map((x) => (typeof x === "string" ? x : `${x.t || ""} ${x.line || x.msg || JSON.stringify(x)}`)).join("\n")); } catch { /* none */ }
  try {
    const jobs = [...core().jobs.values()].sort((a, b) => (b.created || 0) - (a.created || 0));
    const pick = jobs.filter((j) => j.status === "failed" || j.status === "error").slice(0, 3).concat(jobs.filter((j) => j.status !== "failed" && j.status !== "error").slice(0, 3));
    if (pick.length) out["jobs.txt"] = scrubText(pick.map((j) => `==== job ${j.id} · ${(j.params || {}).mode || "?"} · ${j.status} · ${new Date((j.created || 0) * 1000).toISOString()}\n${String((j.params || {}).prompt || "").slice(0, 300)}\n${(j.log || []).slice(-250).join("\n")}`).join("\n\n"));
  } catch { /* none */ }
  return out;
}
/** 👁 what a report would include right now (before it is saved) */
async function preview() {
  const l = logs();
  let settings = {}; try { settings = scrub(core().getConfig()); } catch { settings = {}; }
  return { system: await system(), settings, logs: Object.fromEntries(Object.entries(l).map(([k, v]) => [k, { lines: v.split("\n").length, tail: v.split("\n").slice(-40).join("\n") }])), severities: SEVERITIES };
}
/** 💾 write the report folder -> {id, files} */
async function save(body, png) {
  const r = clean(body);
  r.when = new Date().toISOString();
  r.id = reportId(r.title);
  const d = path.join(dir(), r.id);
  fs.mkdirSync(path.join(d, "logs"), { recursive: true });
  r.files = { screenshot: false, logs: [] };
  if (r.include.screenshot && png && png.length > 8 && png.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    fs.writeFileSync(path.join(d, "screenshot.png"), png); r.files.screenshot = true;
  }
  if (r.include.logs) for (const [f, t] of Object.entries(logs())) { fs.writeFileSync(path.join(d, "logs", f), t, "utf8"); r.files.logs.push(f); }
  if (r.include.system) { r.system = await system(); try { r.settings = scrub(core().getConfig()); } catch { r.settings = {}; } }
  if (!r.include.steps) r.recorded = [];
  fs.writeFileSync(path.join(d, "report.json"), JSON.stringify(r, null, 2), "utf8");
  fs.writeFileSync(path.join(d, "report.md"), toMarkdown(r), "utf8");
  try { require("./testPlan").event("bugreport_saved", { what: r.id }); } catch { /* the 🧪 checklist */ }
  return { id: r.id, files: r.files, title: r.title };
}
function list() {
  let ids = []; try { ids = fs.readdirSync(dir()).filter((x) => /^bug-\d{8}-\d{6}-/.test(x)).sort().reverse(); } catch { ids = []; }
  return ids.slice(0, 200).map((id) => {
    let j = {}; try { j = JSON.parse(fs.readFileSync(path.join(dir(), id, "report.json"), "utf8")); } catch { j = {}; }
    return { id, title: j.title || id, severity: j.severity || "", when: j.when || "", area: j.area || "", screenshot: !!(j.files && j.files.screenshot) };
  });
}
/** ⤓ the report as one .zip (the file to send) */
function zip(id) {
  const d = path.join(dir(), safeId(id));
  if (!fs.existsSync(d)) { const e = new Error("no such report"); e.status = 404; throw e; }
  const entries = [];
  const walk = (p, rel) => { for (const f of fs.readdirSync(p)) { const a = path.join(p, f), r = rel ? rel + "/" + f : f; if (fs.statSync(a).isDirectory()) walk(a, r); else entries.push({ name: `${id}/${r}`, data: fs.readFileSync(a) }); } };
  walk(d, "");
  return { name: `bitgen-${id}.zip`, data: require("./zipWrite").zip(entries) };
}
function remove(id) { const d = path.join(dir(), safeId(id)); if (!fs.existsSync(d)) return false; fs.rmSync(d, { recursive: true, force: true }); return true; }
function screenshot(id) { const f = path.join(dir(), safeId(id), "screenshot.png"); return fs.existsSync(f) ? f : null; }

module.exports = { SEVERITIES, scrub, scrubText, slug, reportId, clean, toMarkdown, system, logs, preview, save, list, zip, remove, screenshot, dir, safeId };
