/* ext/maildock/mailview.js — ✉ MAIL (2.818.0): the pure parts of the docker, window.H3MailView (+ require() in Node:
 * scripts/test-mail818.js). No DOM, no fetch - the list's order and filter, dates, the AI flag's look, the reading pane's
 * safe frame document, who a reply goes to, the composer's text from its HTML.
 */
(function (root) {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LEVELS = [
    { n: 0, name: "Low", cls: "mllv0", icon: "⚑", tip: "low - newsletters, offers, automated mail" },
    { n: 1, name: "Normal", cls: "mllv1", icon: "⚑", tip: "normal - worth a look, no action" },
    { n: 2, name: "Important", cls: "mllv2", icon: "⚑", tip: "important - a person, your work, bills, appointments" },
    { n: 3, name: "Urgent", cls: "mllv3", icon: "⚑", tip: "urgent - needs you soon" },
  ];
  const FICON = { inbox: "📥", drafts: "📝", sent: "📤", trash: "🗑", junk: "🚫", archive: "🗄", all: "📚", flagged: "★", important: "❗", "": "📁" };
  /** the AI flag of an index entry -> {cls, icon, tip} | null (not rated) */
  function flagOf(m) {
    const ai = m && m.ai; if (!ai || ai.level == null) return null;
    const L = LEVELS[Math.max(0, Math.min(3, ai.level | 0))];
    return { cls: L.cls, icon: L.icon, name: L.name, tip: "✨ " + L.tip + (ai.why ? " - " + ai.why : "") };
  }
  const whoName = (a) => (a ? (a.name || a.address || "") : "");
  const fmtAddr = (a) => (a ? (a.name && a.address ? `${a.name} <${a.address}>` : (a.address || a.name || "")) : "");
  const fmtAddrs = (L) => (Array.isArray(L) ? L.map(fmtAddr).filter(Boolean).join(", ") : "");
  /** a date for the list: the time today, the weekday this week, else the day + month (+ year when not this year) */
  function shortDate(iso, now) {
    const d = new Date(iso), n = now ? new Date(now) : new Date();
    if (isNaN(d)) return "";
    const p2 = (x) => String(x).padStart(2, "0");
    if (d.toDateString() === n.toDateString()) return p2(d.getHours()) + ":" + p2(d.getMinutes());
    const days = (n - d) / 86400000;
    if (days >= 0 && days < 6) return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
    const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
    return d.getDate() + " " + mon + (d.getFullYear() !== n.getFullYear() ? " " + d.getFullYear() : "");
  }
  /** the list shown: show = all | unread | important | starred, q = search words (from, subject, snippet - every word) */
  function filterMsgs(msgs, show, q) {
    const words = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
    return (msgs || []).filter((m) => {
      if (show === "unread" && m.seen) return false;
      if (show === "important" && !(m.ai && m.ai.level >= 2)) return false;
      if (show === "starred" && !m.flagged) return false;
      if (!words.length) return true;
      const hay = [whoName(m.from), (m.from || {}).address, m.subject, m.snippet, m.ai && m.ai.why].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }
  /** by = date (newest first) | ai (most important first; not rated after the rated, then newest) */
  function sortMsgs(msgs, by) {
    const t = (m) => Date.parse(m.date) || 0, lv = (m) => (m.ai && m.ai.level != null ? m.ai.level : -1);
    return (msgs || []).slice().sort(by === "ai" ? (a, b) => lv(b) - lv(a) || t(b) - t(a) : (a, b) => t(b) - t(a) || b.uid - a.uid);
  }
  /** plain text -> safe HTML with the links clickable */
  function linkify(text) {
    return esc(text).replace(/\b(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }
  /** the HTML loads pictures (or styles) from the internet? (a tracker can tell the sender the email was opened) */
  function hasRemote(html) { return /<img\b[^>]*\bsrc\s*=\s*["']?\s*(https?:)?\/\//i.test(String(html || "")) || /url\(\s*["']?\s*(https?:)?\/\//i.test(String(html || "")) || /<link\b[^>]*href\s*=\s*["']?https?:/i.test(String(html || "")); }
  /** the reading pane's frame document: a content policy (no scripts ever; internet pictures only when asked), links
   *  open in the browser, a plain look for emails without their own */
  function frameDoc(html, remote) {
    const net = remote ? " https: http:" : "";
    const csp = `default-src 'none'; img-src data: cid:${net}; style-src 'unsafe-inline'${net}; font-src data:${net}; media-src data:`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank">`
      + `<style>html,body{margin:0;padding:10px 12px;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#222;background:#fff;word-wrap:break-word}img{max-width:100%;height:auto}blockquote{border-left:3px solid #ccc;margin:0 0 0 4px;padding-left:10px;color:#555}</style>`
      + `</head><body>${String(html || "")}</body></html>`;
  }
  const lower = (s) => String(s || "").trim().toLowerCase();
  /** who a reply goes to: {to, cc} as address lists ("Name <a@b>"); me never on it; all = the other recipients in Cc */
  function replyTargets(b, me, all) {
    const o = b || {}, mine = lower(me);
    const first = (o.replyTo && o.replyTo.length ? o.replyTo : [o.from]).filter((a) => a && a.address);
    const fromMe = first.length && lower(first[0].address) === mine;
    let to = fromMe ? (o.to || []) : first;           // replying to your own sent email = to its recipients
    const seen = new Set(to.map((a) => lower(a.address)));
    let cc = [];
    if (all) {
      for (const a of [...(o.to || []), ...(o.cc || [])]) {
        const k = lower(a && a.address); if (!k || k === mine || seen.has(k)) continue;
        seen.add(k); cc.push(a);
      }
    }
    const notMe = to.filter((a) => lower(a.address) !== mine);
    if (notMe.length) to = notMe;                       // an email to yourself only: the reply still has somewhere to go
    return { to: to.map(fmtAddr).join(", "), cc: cc.map(fmtAddr).join(", ") };
  }
  /** the composer's HTML -> plain text for the text part (lists, breaks and links kept readable) */
  function textOf(html) {
    let s = String(html || "");
    s = s.replace(/<br\s*\/?>/gi, "\n").replace(/<(ul|ol)\b[^>]*>/gi, "\n").replace(/<li\b[^>]*>/gi, "• ").replace(/<\/(p|div|h\d|li|ul|ol|blockquote|tr)>/gi, "\n");
    s = s.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, h, t) => { const tt = t.replace(/<[^>]+>/g, ""); return tt.trim() === h ? h : `${tt} (${h})`; });
    s = s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
    return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  /** plain text (the AI's draft) -> the composer's HTML (paragraphs + line breaks) */
  function htmlOfText(t) {
    return String(t || "").trim().split(/\n{2,}/).map((p) => "<div>" + esc(p).replace(/\n/g, "<br>") + "</div>").join("<div><br></div>");
  }
  /** a size in words */
  function size(n) { n = Number(n) || 0; return n < 1024 ? n + " B" : n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(1) + " MB"; }
  const api = { esc, LEVELS, FICON, flagOf, whoName, fmtAddr, fmtAddrs, shortDate, filterMsgs, sortMsgs, linkify, hasRemote, frameDoc, replyTargets, textOf, htmlOfText, size };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.H3MailView = api;
})(typeof window !== "undefined" ? window : globalThis);
