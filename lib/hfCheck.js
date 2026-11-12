/* bitGen Studio — lib/hfCheck.js (2.764.6): IS A HUGGING FACE FILE GATED? asked before a pod downloads it, so the user is told
 * why a file will not come instead of watching it sit at 0%.
 *
 * Tim (verbatim): "if the model is gated, i am guessing krea2 is gated, downloading for 5 minutes so far and still 0%, check
 * to see if it is gated and report to the user"
 *
 *   A HEAD of the file's /resolve/ address (not followed to the download servers) with the user's Hugging Face token when
 *   there is one. Hugging Face answers:
 *     2xx / 3xx                      fine - the pod downloads it
 *     401 / 403 + X-Error-Code GatedRepo   gated: the license is not accepted on that account (or no token was sent)
 *     401 without a token            gated or private (Hugging Face says 401 for both when nobody is signed in)
 *     404 / RepoNotFound / EntryNotFound   the repo or the file is not there (moved or renamed)
 *   Anything else (no network from this computer, a time-out) is not held against the file - the pod tries it.
 * Pure: repoOf, why. Live: check(files, token).  Node: scripts/test-hfcheck7646.js
 */
"use strict";

/** "https://huggingface.co/Comfy-Org/Krea-2/resolve/main/x.safetensors" -> "Comfy-Org/Krea-2" ("" when it is not one) (pure) */
function repoOf(url, base) {
  const b = String(base || "https://huggingface.co").replace(/\/+$/, ""), u = String(url || "");
  if (!u.startsWith(b + "/")) return "";
  const p = u.slice(b.length + 1).split("?")[0].split("/");
  if (p[0] === "datasets" || p[0] === "spaces") return p.length >= 3 ? p.slice(0, 3).join("/") : "";
  return p.length >= 2 && p[0] && p[1] ? p[0] + "/" + p[1] : "";
}
/** Hugging Face's answer -> "" (fine / not known) | the words for the user (pure)
 *  status, code = its X-Error-Code header, repo, token = whether a token was sent */
function why(status, code, repo, token) {
  const s = +status || 0, c = String(code || ""), page = "huggingface.co/" + (repo || "");
  if (!s || (s < 400 && !c)) return "";
  if (c === "GatedRepo" || s === 403) {
    return token
      ? `gated - your Hugging Face account has not accepted its license yet: open ${page}, sign in with the account your token belongs to and accept it, then try again`
      : `gated - open ${page}, accept its license, then add your Hugging Face token in Settings ▸ Models and try again`;
  }
  if (c === "EntryNotFound") return `not found - ${page} does not have this file (it was moved or renamed)`;
  if (c === "RepoNotFound" && token) return `not found - ${page} does not exist (or is private to another account)`;
  if (s === 401) return token ? `refused - Hugging Face did not accept your token for ${page} (check it in Settings ▸ Models)`
    : `gated or private - open ${page}, accept its license, then add your Hugging Face token in Settings ▸ Models and try again`;
  if (s === 404 || c === "RepoNotFound" || c === "RevisionNotFound") return `not found - ${page} does not have this file (it was moved or renamed)`;
  return "";
}
/** [{name, url}] -> {ok: [the files], blocked: [{name, url, why}]} - Hugging Face files only; asked together (live) */
async function check(files, token, opts) {
  const o = opts || {}, base = o.base || (process.env.H3_HF_BASE || "https://huggingface.co").replace(/\/+$/, "");
  const f0 = o.fetch || fetch, ms = +o.ms || 15000;
  const res = await Promise.all((files || []).map(async (f) => {
    const repo = repoOf(f.url, base);
    if (!repo) return "";
    const tk = String(f.token || token || "");
    try {
      const h = { "User-Agent": "bitGen-Studio" }; if (tk) h.Authorization = "Bearer " + tk;
      const r = await f0(f.url, { method: "HEAD", redirect: "manual", headers: h, signal: AbortSignal.timeout(ms) });
      return why(r.status, r.headers && r.headers.get ? r.headers.get("x-error-code") : "", repo, !!tk);
    } catch { return ""; }   // this computer could not ask - the pod tries
  }));
  const ok = [], blocked = [];
  (files || []).forEach((f, i) => { if (res[i]) blocked.push({ name: f.name, url: f.url, why: res[i] }); else ok.push(f); });
  return { ok, blocked };
}
module.exports = { repoOf, why, check };
