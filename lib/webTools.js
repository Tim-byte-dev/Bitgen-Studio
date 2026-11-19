// lib/webTools.js — 2.885.0: 🌐 the LLM's web tools - SEARCH and READ, nothing else.
// Tim: "is it possible to give bitgen llm live websearch ability" + "add brave but put it in settings-general tab with a
// checkbox, it will be off by default and user can select it and enter an api key. can we have security filters in place
// so no malicious scripts can be run, only search and retrieve, no local apps or installations from web sources".
//
//   search(query, {count})   Brave Search (Settings ▸ General ▸ ☑ Brave + its key, encrypted - lib/secrets.js
//                            websearch.brave.key) -> else your SearXNG server (its address) -> else Wikipedia's own search
//                            (no key). -> {engine, results: [{title, url, snippet}]}
//   read(url)                one web page as PLAIN TEXT: {url, title, text, links, warnings}
//   THE SECURITY FILTERS (every one is checked in code, none is left to the model):
//   - only http / https on their own ports (80 / 443), no user:password in the address
//   - never this computer or your network: the host name is looked up and EVERY address it gives is checked (loopback,
//     private 10/8 172.16/12 192.168/16, link-local incl. 169.254.169.254, CGNAT, multicast, IPv6 ULA / link-local / mapped)
//     - and the connection uses the address that was checked (a name cannot change between the check and the connect)
//   - redirects followed by hand (4 at most), each checked again
//   - only text answers: text/html, text/plain, markdown, json, xml - an executable, script, installer, archive, disk image
//     or "download as a file" answer is refused by its type, its file name and its first bytes (MZ, ELF, #!, PK, ...)
//   - 2 MB at most, 20 s, no cookies kept, never written to disk, never run
//   - HTML becomes words: <script> <style> <iframe> <object> <embed> <svg> <form> <template> and comments dropped, every tag
//     taken out - no markup, no script reaches the LLM or the page
//   - what a page says is marked UNTRUSTED (data, not instructions); words that try to steer the LLM ("ignore previous
//     instructions", "run this command", a pipe into a shell ...) are reported in `warnings`
//   The tool loop (lib/llmAgent.js) gives the LLM ONLY these two tools, and once web words are in a turn no other kind of
//   tool can run in it.
"use strict";
const http = require("http");
const https = require("https");
const dns = require("dns");
const net = require("net");
const { URL } = require("url");

const UA = "bitGenStudio/2 (local desktop app; web search for its own LLM)";
const MAX_BYTES = 2 * 1024 * 1024, TIMEOUT = 20000, MAX_TEXT = 12000;
const TEXT_TYPES = /^(text\/html|application\/xhtml\+xml|text\/plain|text\/markdown|text\/x-markdown|application\/json|application\/(?:[a-z.+-]+\+)?xml|text\/xml)$/i;
// file names a page answer must not have (programs, scripts, installers, archives, disk images, office macros)
const BAD_EXT = /\.(exe|msi|msix|msp|appx|bat|cmd|com|scr|pif|cpl|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|hta|lnk|reg|jar|apk|aab|ipa|dmg|pkg|mpkg|app|deb|rpm|snap|flatpak|appimage|run|bin|sh|bash|zsh|csh|py|pyw|pl|rb|php|so|dll|sys|drv|ocx|iso|img|vhd|vhdx|zip|7z|rar|tar|gz|tgz|bz2|xz|zst|cab|docm|xlsm|pptm|torrent)$/i;
// the first bytes of a program / archive: MZ (Windows), ELF, Mach-O, #! (script), PK (zip), Rar!, 7z, gzip, cab
const MAGIC = [[0x4d, 0x5a], [0x7f, 0x45, 0x4c, 0x46], [0xcf, 0xfa, 0xed, 0xfe], [0xfe, 0xed, 0xfa, 0xcf], [0xca, 0xfe, 0xba, 0xbe], [0x23, 0x21], [0x50, 0x4b, 0x03, 0x04], [0x52, 0x61, 0x72, 0x21], [0x37, 0x7a, 0xbc, 0xaf], [0x1f, 0x8b], [0x4d, 0x53, 0x43, 0x46]];
const STEER = [
  [/ignore (all |any )?(the )?(previous|prior|above|earlier) (instructions|prompts?|messages?)/i, "tries to override the LLM's instructions"],
  [/(disregard|forget) (your|all|the) (instructions|rules|system prompt)/i, "tries to override the LLM's instructions"],
  [/\b(you are now|act as|new instructions?:|system prompt:)/i, "tries to give the LLM a new role or instructions"],
  [/\b(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b[^\n]{0,200}\|\s*(sh|bash|iex|powershell|pwsh|python)/i, "a download piped into a shell"],
  [/\b(powershell|pwsh)(\.exe)?\s+[^\n]{0,40}-(e|enc|encodedcommand)\s/i, "an encoded PowerShell command"],
  [/\b(iex|invoke-expression)\s*\(/i, "PowerShell that runs downloaded code"],
  [/\b(run|execute|install|download) (this|the following) (command|script|program|file)/i, "asks for something to be run or installed"],
  [/\bcertutil\s+-urlcache|\bmshta\s+http|\bregsvr32\s+\/s\s+\/n\s+\/u\s+\/i:http|\bbitsadmin\s+\/transfer/i, "a known way to fetch and run a program"]];

function bad(msg, status) { return Object.assign(new Error(msg), { status: status || 400 }); }
const core = () => require("./core");

/* ------------------------------ which addresses are never fetched ------------------------------ */
function v4Private(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((x) => !(x >= 0 && x <= 255))) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 192 && b === 0 && p[2] === 0) || (a === 192 && b === 0 && p[2] === 2) || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && p[2] === 100) || (a === 203 && b === 0 && p[2] === 113) || a >= 224;
}
/** an address this computer must not ask a web page for (this machine, the local network, reserved ranges) */
function isPrivateIp(ip) {
  const s = String(ip || "").trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  if (net.isIPv4(s)) return v4Private(s);
  if (!net.isIPv6(s)) return true;
  if (s === "::" || s === "::1") return true;
  const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s) || /^::(\d+\.\d+\.\d+\.\d+)$/.exec(s); if (m) return v4Private(m[1]);
  const mh = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(s);
  if (mh) { const n = (parseInt(mh[1], 16) << 16) | parseInt(mh[2], 16); return v4Private([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".")); }
  const first = parseInt(s.split(":")[0] || "0", 16);
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00 || s.startsWith("2001:db8") || s.startsWith("64:ff9b") || s.startsWith("2002:");
}
const BAD_HOST = /^(localhost|localhost\.localdomain|ip6-localhost|ip6-loopback|metadata|metadata\.google\.internal|instance-data)$|\.(local|localhost|internal|intranet|lan|home|corp|home\.arpa)$/i;
/** an address the tools may ask for -> the URL object (throws with the reason) */
function checkUrl(u) {
  let x; try { x = new URL(String(u || "").trim()); } catch (e) { throw bad("that is not a web address"); }
  if (x.protocol !== "http:" && x.protocol !== "https:") throw bad("only http and https web pages are read");
  if (x.username || x.password) throw bad("an address with a user name or password is not read");
  if (x.port && !((x.protocol === "http:" && x.port === "80") || (x.protocol === "https:" && x.port === "443"))) throw bad("only web pages on the usual ports (80 / 443) are read");
  const h = x.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || BAD_HOST.test(h) || !/\./.test(h) && !net.isIP(h)) throw bad("addresses on this computer or your own network are never read");
  if (net.isIP(h) && isPrivateIp(h)) throw bad("addresses on this computer or your own network are never read");
  if (BAD_EXT.test(x.pathname)) throw bad("that is a file to download or run, not a page - it is not fetched");
  return x;
}
/** dns lookup that refuses a private answer - the connection is made to the address checked here */
function safeLookup(host, opts, cb) {
  dns.lookup(host, { all: true }, (err, list) => {
    if (err) return cb(err);
    const L = Array.isArray(list) ? list : [];
    if (!L.length) return cb(bad("the address has no IP"));
    const badOne = L.find((a) => isPrivateIp(a.address));
    if (badOne) return cb(bad("that name points at this computer or a private network - not read"));
    if (opts && opts.all) return cb(null, L);
    cb(null, L[0].address, L[0].family);
  });
}
const looksBinary = (buf) => MAGIC.some((m) => buf.length >= m.length && m.every((b, i) => buf[i] === b));
/** one GET with every filter on: {status, type, body (Buffer), url, location} */
function getOnce(x, accept, extraHeaders, media) {
  if (media) return getMedia(x, media);
  return new Promise((resolve, reject) => {
    const mod = x.protocol === "https:" ? https : http;
    const req = mod.request(x, { method: "GET", lookup: safeLookup, timeout: TIMEOUT, headers: Object.assign({ "User-Agent": UA, Accept: accept || "text/html,application/xhtml+xml,text/plain;q=0.9,application/json;q=0.8,*/*;q=0.1", "Accept-Encoding": "identity", "Accept-Language": "en-AU,en;q=0.9" }, extraHeaders || {}) }, (res) => {
      const status = res.statusCode || 0, type = String(res.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      if (status >= 300 && status < 400 && res.headers.location) { res.resume(); return resolve({ status, location: res.headers.location, url: x.href }); }
      const disp = String(res.headers["content-disposition"] || "");
      if (/attachment/i.test(disp) || BAD_EXT.test((/filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(disp) || [])[1] || "")) { res.destroy(); return reject(bad("the page answered with a file to download - not taken")); }
      if (status >= 200 && status < 300 && type && !TEXT_TYPES.test(type)) { res.destroy(); return reject(bad(`the answer is ${type}, not a text page - not taken`)); }
      const len = +res.headers["content-length"] || 0; if (len > MAX_BYTES) { res.destroy(); return reject(bad("the page is over 2 MB - not taken")); }
      const parts = []; let n = 0, first = true;
      res.on("data", (c) => {
        if (first) { first = false; if (looksBinary(c)) { res.destroy(); return reject(bad("the answer is a program or an archive, not a page - not taken")); } }
        n += c.length; if (n > MAX_BYTES) { res.destroy(); return reject(bad("the page is over 2 MB - not taken")); }
        parts.push(c);
      });
      res.on("end", () => resolve({ status, type, body: Buffer.concat(parts), url: x.href }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(bad("the page took too long")));
    req.on("error", reject);
    req.end();
  });
}
/* ---- 2.886.0: ⬇ a picture, video or sound - only these, checked by type AND first bytes, written to a .part file first */
const MEDIA_TYPES = { image: /^image\/(png|jpeg|jpg|gif|webp|avif|bmp)$/i, video: /^video\/(mp4|webm|quicktime|x-matroska|x-m4v)$/i, audio: /^audio\/(mpeg|mp3|wav|x-wav|wave|ogg|flac|x-flac|aac|mp4|x-m4a|webm|opus)$/i };
const MEDIA_MAX = { image: 40 * 1024 * 1024, video: 500 * 1024 * 1024, audio: 150 * 1024 * 1024 };
/** what a file's first bytes say it is: {kind, ext} or null (never a program - those are refused before this) */
function mediaOf(b) {
  const at = (i, s) => b.length >= i + s.length && b.slice(i, i + s.length).toString("latin1") === s;
  if (b[0] === 0x89 && at(1, "PNG")) return { kind: "image", ext: ".png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: "image", ext: ".jpg" };
  if (at(0, "GIF87a") || at(0, "GIF89a")) return { kind: "image", ext: ".gif" };
  if (at(0, "RIFF") && at(8, "WEBP")) return { kind: "image", ext: ".webp" };
  if (at(0, "RIFF") && at(8, "WAVE")) return { kind: "audio", ext: ".wav" };
  if (at(0, "BM") && b.length > 14) return { kind: "image", ext: ".bmp" };
  if (at(4, "ftyp")) { const brand = b.slice(8, 12).toString("latin1"); if (/^avi[fs]/.test(brand)) return { kind: "image", ext: ".avif" }; if (/^(M4A |M4B )/.test(brand)) return { kind: "audio", ext: ".m4a" }; if (/^qt  /.test(brand)) return { kind: "video", ext: ".mov" }; return { kind: "video", ext: ".mp4" }; }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: "video", ext: ".webm" };
  if (at(0, "OggS")) return { kind: "audio", ext: ".ogg" };
  if (at(0, "fLaC")) return { kind: "audio", ext: ".flac" };
  if (at(0, "ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0)) return { kind: "audio", ext: ".mp3" };
  return null;
}
function getMedia(x, m) {
  const fs = require("fs");
  return new Promise((resolve, reject) => {
    const mod = x.protocol === "https:" ? https : http;
    const req = mod.request(x, { method: "GET", lookup: safeLookup, timeout: 60000, headers: { "User-Agent": UA, Accept: "image/*,video/*,audio/*;q=0.9", "Accept-Encoding": "identity" } }, (res) => {
      const status = res.statusCode || 0, type = String(res.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      if (status >= 300 && status < 400 && res.headers.location) { res.resume(); return resolve({ status, location: res.headers.location, url: x.href }); }
      if (status < 200 || status >= 300) { res.resume(); return reject(bad(`the address answered HTTP ${status}`, 502)); }
      const kindT = Object.keys(MEDIA_TYPES).find((k) => MEDIA_TYPES[k].test(type));
      if (!kindT && !/^(application\/octet-stream|binary\/octet-stream)$/.test(type)) { res.destroy(); return reject(bad(type && /html|text/.test(type) ? "that address is a web page, not a picture / video / sound - read it (web_read) and use one of its media addresses" : `the answer is ${type || "of no type"} - only pictures, videos and sounds are downloaded`)); }
      const len = +res.headers["content-length"] || 0, cap = Math.min(m.max || MEDIA_MAX.video, MEDIA_MAX[kindT || "video"]);
      if (len > cap) { res.destroy(); return reject(bad(`it is ${Math.round(len / 1048576)} MB - over the ${Math.round(cap / 1048576)} MB limit`)); }
      let out = null, n = 0, info = null, head = Buffer.alloc(0), done = false;
      const fail = (e) => { if (done) return; done = true; res.destroy(); if (out) { out.destroy(); try { fs.unlinkSync(m.file); } catch (er) { /* gone */ } } reject(e); };
      res.on("data", (c) => {
        if (done) return;
        if (!info) {
          head = Buffer.concat([head, c]);
          if (head.length < 16 && !res.complete) return;
          if (looksBinary(head)) return fail(bad("that is a program or an archive - never downloaded"));
          info = mediaOf(head);
          if (!info) return fail(bad("its first bytes are not a picture, video or sound - not downloaded"));
          if (kindT && info.kind !== kindT && !(kindT === "video" && info.kind === "audio") && !(kindT === "audio" && info.kind === "video")) return fail(bad(`it says ${type} but its bytes are a ${info.kind} - not downloaded`));
          out = fs.createWriteStream(m.file); out.write(head); n = head.length; return;
        }
        n += c.length; if (n > cap) return fail(bad(`over the ${Math.round(cap / 1048576)} MB limit - stopped`));
        out.write(c);
      });
      res.on("end", () => {
        if (done) return;
        if (!info) { if (head.length && (info = mediaOf(head)) && !looksBinary(head)) { out = fs.createWriteStream(m.file); out.write(head); n = head.length; } else return fail(bad("an empty or unknown answer - not downloaded")); }
        done = true; out.end(() => resolve({ status, type, url: x.href, size: n, kind: info.kind, ext: info.ext }));
      });
      res.on("error", fail);
    });
    req.on("timeout", () => req.destroy(bad("the download took too long")));
    req.on("error", reject);
    req.end();
  });
}
/** GET with redirects checked hop by hop */
async function safeGet(u, accept, headers, media) {
  let x = checkUrl(u);
  for (let hop = 0; hop < 5; hop++) {
    const r = await getOnce(x, accept, headers, media);
    if (!r.location) return r;
    if (hop === 4) throw bad("too many redirects");
    x = checkUrl(new URL(r.location, x).href);
  }
  throw bad("too many redirects");
}

/* ------------------------------ a page as words ------------------------------ */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", copy: "©", reg: "®", mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•", middot: "·", deg: "°", euro: "€", pound: "£", yen: "¥", times: "×" };
function decode(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n < 0x110000 && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : ""; }
    return ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m;
  });
}
const clean = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁠-⁤﻿]/g, "");
/** HTML -> {title, text, links} - no markup survives */
function htmlToText(html, base) {
  let h = String(html || "");
  const title = clean(decode(((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(h) || [])[1] || "").replace(/<[^>]*>/g, ""))).replace(/\s+/g, " ").trim().slice(0, 200);
  h = h.replace(/<!--[\s\S]*?-->/g, " ").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, " ");
  for (const t of ["script", "style", "noscript", "template", "iframe", "frame", "frameset", "object", "embed", "applet", "svg", "math", "canvas", "form", "select", "textarea", "button", "head", "nav", "footer", "aside"])
    h = h.replace(new RegExp(`<${t}\\b[\\s\\S]*?<\\/${t}\\s*>`, "gi"), " ").replace(new RegExp(`<${t}\\b[^>]*\\/?>`, "gi"), " ");
  // elements hidden from people (often where steering text hides)
  h = h.replace(/<([a-z0-9]+)\b[^>]*(?:\shidden(?=[\s>=/])|display\s*:\s*none|visibility\s*:\s*hidden|aria-hidden\s*=\s*["']?true)[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
  const links = []; const seen = new Set();
  h.replace(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi, (m, a, b2, c, inner) => {
    try {
      const href = new URL(decode(a || b2 || c || ""), base).href;
      if (!/^https?:/i.test(href) || seen.has(href) || links.length >= 25) return m;
      const words = clean(decode(inner.replace(/<[^>]*>/g, " "))).replace(/\s+/g, " ").trim().slice(0, 80);
      if (words) { seen.add(href); links.push({ text: words, url: href }); }
    } catch (e) { /* a broken link */ }
    return m;
  });
  const media = [];   // 2.886.0: the page's pictures / videos / sounds (for ⬇ web_download)
  const addM = (u0, kind, alt) => { try { const u = new URL(decode(u0), base).href; if (/^https?:/i.test(u) && !media.some((x) => x.url === u) && media.length < 30) media.push({ kind, url: u, alt: clean(decode(alt || "")).slice(0, 80) }); } catch (e) { /* bad */ } };
  String(html || "").replace(/<meta\b[^>]*(?:property|name)\s*=\s*["'](og:image|og:video|og:audio|twitter:image)["'][^>]*content\s*=\s*["']([^"']+)["']/gi, (mm, k, u) => { addM(u, /video/.test(k) ? "video" : /audio/.test(k) ? "audio" : "image"); return mm; });
  h.replace(/<(img|video|audio|source)\b([^>]*)>/gi, (mm, tag, at) => {
    const src = (/\bsrc\s*=\s*["']([^"']+)["']/i.exec(at) || [])[1], alt = (/\balt\s*=\s*["']([^"']*)["']/i.exec(at) || [])[1];
    const ty = (/\btype\s*=\s*["']([^"']+)["']/i.exec(at) || [])[1] || "";
    if (src && !/^data:/i.test(src)) addM(src, tag === "img" ? "image" : tag === "audio" || /^audio/.test(ty) ? "audio" : "video", alt);
    return mm;
  });
  h = h.replace(/<(h[1-6])\b[^>]*>/gi, "\n\n## ").replace(/<\/(h[1-6])>/gi, "\n").replace(/<li\b[^>]*>/gi, "\n• ").replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|tr|table|ul|ol|pre|blockquote|header|main|dd|dt)>/gi, "\n").replace(/<(td|th)\b[^>]*>/gi, " | ");
  let text = clean(decode(h.replace(/<[^>]*>/g, " "))).replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { title, text, links, media };
}
/** words in a page that try to steer the LLM or get something run */
function steering(text) {
  const out = []; for (const [re, why] of STEER) { const m = re.exec(text); if (m && !out.some((o) => o.why === why)) out.push({ why, at: m[0].slice(0, 80) }); }
  return out;
}
/** 🌐 read one page -> {url, title, text, links, warnings, truncated} */
async function read(u) {
  const r = await safeGet(u);
  if (r.status < 200 || r.status >= 300) throw bad(`the page answered HTTP ${r.status}`, 502);
  const raw = r.body.toString("utf8");
  let page;
  if (/html|xml/.test(r.type) || /^\s*</.test(raw)) page = htmlToText(raw, r.url);
  else page = { title: "", text: clean(raw).replace(/\r/g, ""), links: [] };
  const truncated = page.text.length > MAX_TEXT;
  return { url: r.url, title: page.title, text: page.text.slice(0, MAX_TEXT), links: page.links, media: page.media || [], truncated, warnings: steering(page.text) };
}

/* ------------------------------ search ------------------------------ */
function settings() {
  const w = (core().getConfig().websearch) || {};
  const L = localSx();
  // 2.886.4 (Tim: "web search is currently hitting some heavy filters ... can we turn off the filters?"): the search engines' own
  // safe search - 0 off, 1 moderate (default), 2 strict. Only what the engines return; the security filters (what is fetched,
  // downloaded or run) are not content filters and always stay on.
  const safe = w.safe === 0 || w.safe === 2 ? w.safe : 1;
  return { safe, brave: { on: !!(w.brave && w.brave.on), key: (w.brave && w.brave.key) || "" }, searxng: { url: (w.searxng && w.searxng.url) || "", local: !!(L && L.installed()) } };
}
/** the settings for the page - the key never leaves the server */
function view() {
  const s = settings();
  return { safe: s.safe, brave: { on: s.brave.on, hasKey: !!s.brave.key, tail: s.brave.key ? s.brave.key.slice(-4) : "" }, searxng: { url: s.searxng.url, local: s.searxng.local }, engine: engineOf(s) };
}
const localSx = () => { try { return require("./searxngLocal"); } catch (e) { return null; } };
/** Brave (ticked + a key) -> your SearXNG address -> bitGen's own SearXNG (installed) -> Wikipedia */
function engineOf(s) { return s.brave.on && s.brave.key ? "brave" : s.searxng.url || s.searxng.local ? "searxng" : "wikipedia"; }
function save(b) {
  const c = core().getConfig(), w = c.websearch = Object.assign({ brave: {}, searxng: {} }, c.websearch || {});
  w.brave = Object.assign({}, w.brave); w.searxng = Object.assign({}, w.searxng);
  if (b.braveOn != null) w.brave.on = !!b.braveOn;
  if (b.safe != null) { const v = +b.safe; w.safe = v === 0 || v === 2 ? v : 1; }
  if (b.braveKey != null) w.brave.key = String(b.braveKey).trim().replace(/[^\x21-\x7e]/g, "").slice(0, 200);
  if (b.searxngUrl != null) {
    const v = String(b.searxngUrl).trim();
    if (v) { let x; try { x = new URL(v); } catch (e) { throw bad("the SearXNG address is not a web address"); } if (!/^https?:$/.test(x.protocol)) throw bad("the SearXNG address starts http:// or https://"); w.searxng.url = x.href.replace(/\/+$/, ""); }
    else w.searxng.url = "";
  }
  core().setConfig(c);
  return view();
}
const tidy = (s, n) => clean(decode(String(s || "").replace(/<[^>]*>/g, ""))).replace(/\s+/g, " ").trim().slice(0, n || 300);
/** the engines' answers -> [{title, url, snippet}] (only http / https addresses kept) */
function braveResults(j) { return (((j || {}).web || {}).results || []).map((r) => ({ title: tidy(r.title, 160), url: String(r.url || ""), snippet: tidy(r.description, 300) })).filter((r) => /^https?:\/\//i.test(r.url)); }
function searxResults(j) { return ((j || {}).results || []).map((r) => ({ title: tidy(r.title, 160), url: String(r.url || ""), snippet: tidy(r.content, 300) })).filter((r) => /^https?:\/\//i.test(r.url)); }
function wikiResults(j) { return ((((j || {}).query || {}).search) || []).map((r) => ({ title: tidy(r.title, 160), url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(String(r.title || "").replace(/ /g, "_")), snippet: tidy(r.snippet, 300) })); }
const FETCH = { fn: null };   // tests put their own here
async function getJson(url, headers, opts) {
  if (FETCH.fn) return FETCH.fn(url, headers);
  // the search engines are fixed addresses the user set (Brave / Wikipedia) - SearXNG may be the user's own machine, so it
  // goes through fetch (not the page filters, which refuse this computer) but only to the address in Settings
  const r = await fetch(url, { headers: Object.assign({ "User-Agent": UA, Accept: "application/json" }, headers || {}), signal: AbortSignal.timeout((opts && opts.timeout) || 15000), redirect: "error" });
  if (!r.ok) { let t = ""; try { t = (await r.text()).slice(0, 200); } catch (e) { /* none */ } throw bad(`HTTP ${r.status}${t ? " - " + t.replace(/\s+/g, " ") : ""}`, 502); }
  return r.json();
}
async function search(q0, o) {
  const q = String(q0 || "").replace(/\s+/g, " ").trim().slice(0, 300), count = Math.max(1, Math.min(10, (o && o.count) || 6));
  if (!q) throw bad("search for what?");
  const s = (o && o.settings) || settings(), engine = (o && o.engine) || engineOf(s);
  if (engine === "brave") {
    if (!s.brave.key) throw bad("Brave Search needs its API key (Settings ▸ General ▸ Web search)");
    const j = await getJson(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${count}&safesearch=${["off", "moderate", "strict"][s.safe]}&text_decorations=false`, { "X-Subscription-Token": s.brave.key });
    return { engine, query: q, results: braveResults(j).slice(0, count) };
  }
  if (engine === "searxng") {
    const L = localSx(), own = !s.searxng.url || (L && s.searxng.url === L.URL0), url = s.searxng.url || (L && L.URL0);
    if (!url) throw bad("no SearXNG address (Settings ▸ General ▸ Web search)");
    if (own && L && L.installed() && !FETCH.fn) { const st = await L.start(); if (!st.ok) throw bad(st.error, 502); }   // bitGen's own: started when a search needs it
    let j;
    try { j = await getJson(`${url}/search?q=${encodeURIComponent(q)}&format=json&safesearch=${s.safe}`, null, { timeout: 25000 }); }
    catch (e) { throw bad(/403/.test(e.message) ? "SearXNG refused the JSON answer - add json to search: formats: in its settings.yml" : "SearXNG did not answer: " + e.message, 502); }
    let res = searxResults(j).slice(0, count), un = (j && j.unresponsive_engines) || [];
    // 2.886.5: nothing back because engines are blocked (CAPTCHA / too many requests) -> once more with the engines that answered
    // or were not asked, then Wikipedia's own search so the LLM still has something
    if (!res.length && un.length) {
      const blocked = new Set(un.map((u) => String(Array.isArray(u) ? u[0] : u).toLowerCase()));
      const others = ["bing", "mojeek", "qwant", "brave", "duckduckgo", "yahoo", "presearch", "google", "startpage", "wikipedia"].filter((e) => !blocked.has(e));
      if (others.length) { try { const j2 = await getJson(`${url}/search?q=${encodeURIComponent(q)}&format=json&safesearch=${s.safe}&engines=${others.join(",")}`, null, { timeout: 25000 }); res = searxResults(j2).slice(0, count); if (!res.length) for (const u2 of (j2 && j2.unresponsive_engines) || []) if (!un.some((x) => String(Array.isArray(x) ? x[0] : x) === String(Array.isArray(u2) ? u2[0] : u2))) un.push(u2); } catch (e) { /* the fallback below */ } }
      if (!res.length) {
        try { const w = await getJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&utf8=1&srlimit=${count}&srsearch=${encodeURIComponent(q)}`); res = wikiResults(w).slice(0, count); } catch (e) { /* nothing */ }
        if (res.length) return { engine: "wikipedia", query: q, results: res, hint: `SearXNG's engines were blocked (${un.slice(0, 4).map((u) => (Array.isArray(u) ? u[0] + ": " + u[1] : String(u))).join("; ")}) - these are Wikipedia's results; try again in a few minutes, or tick Brave in Settings` };
      }
    }
    return Object.assign({ engine, query: q, results: res }, !res.length && un.length ? { hint: `SearXNG's search engines did not answer (${un.slice(0, 4).map((u) => (Array.isArray(u) ? u[0] + ": " + u[1] : String(u))).join("; ")}) - is this computer online?` } : {});
  }
  const j = await getJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&utf8=1&srlimit=${count}&srsearch=${encodeURIComponent(q)}`);
  return { engine: "wikipedia", query: q, results: wikiResults(j).slice(0, count), hint: "only Wikipedia was searched - for the whole web: Settings ▸ General ▸ 🌐 ⬇ Install SearXNG (free, no key) or tick Brave" };
}
async function test(which) {
  const s = settings(), engine = which === "searxng" ? "searxng" : which === "brave" ? "brave" : engineOf(s);
  const r = await search("bitGen Studio test", { settings: s, engine, count: 3 });
  return { ok: true, engine: r.engine, results: r.results.length, first: r.results[0] ? r.results[0].title : "" };
}

/** ⬇ a picture / video / sound into <dir> - {file, name, kind, size, url}; never anything else (checked above) */
async function download(u, dir0, o) {
  const fs = require("fs"), path = require("path");
  fs.mkdirSync(dir0, { recursive: true });
  const part = path.join(dir0, ".dl-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + ".part");
  let r;
  try { r = await safeGet(u, null, null, { file: part, max: (o && o.max) || 0 }); }
  catch (e) { try { fs.unlinkSync(part); } catch (er) { /* none */ } throw e; }
  let stem = "";
  try { stem = decodeURIComponent(path.basename(new URL(r.url).pathname)).replace(/\.[A-Za-z0-9]{1,5}$/, ""); } catch (e) { stem = ""; }
  stem = (String((o && o.name) || stem || r.kind).normalize("NFKC").replace(/[^\w\- ().]+/g, "_").replace(/^[._ -]+|[._ -]+$/g, "").slice(0, 60)) || r.kind;
  let name = stem + r.ext; for (let k = 2; fs.existsSync(path.join(dir0, name)); k++) name = `${stem} (${k})${r.ext}`;
  fs.renameSync(part, path.join(dir0, name));
  return { file: path.join(dir0, name), name, kind: r.kind, size: r.size, url: r.url };
}
/** the config for the page with the Brave key taken out (a copy - the server's own is untouched) */
function hideKey(c) {
  if (!c || !c.websearch || !c.websearch.brave || !c.websearch.brave.key) return c;
  return Object.assign({}, c, { websearch: Object.assign({}, c.websearch, { brave: Object.assign({}, c.websearch.brave, { key: "", hasKey: true }) }) });
}
module.exports = { download, mediaOf, MEDIA_TYPES, hideKey, search, read, test, settings, view, save, engineOf, checkUrl, isPrivateIp, htmlToText, steering, braveResults, searxResults, wikiResults, safeGet, BAD_EXT, TEXT_TYPES, FETCH, MAX_TEXT, looksBinary };
