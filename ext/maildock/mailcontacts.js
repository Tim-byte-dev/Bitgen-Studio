/* ext/maildock/mailcontacts.js — ✉ MAIL (2.820.0): ADDRESS SUGGESTIONS IN THE COMPOSER, window.H3MailContacts.
 *
 * Tim (verbatim): "finish the mail client ... it looks like it is just the start". Typing in To / Cc / Bcc suggests the
 * people already in the mail kept on this computer (lib/mailBatch.js contacts - from / to / cc of every folder's copy,
 * the most used first): ↑ ↓ pick, Enter / Tab put it in ("Name <address>, "), Esc closes; a click works too.
 * Pure: lastToken(value, caret), putIn(value, caret, contact).
 */
(function (root) {
  "use strict";
  const doc = root.document;
  /** the address being typed: the text after the last comma / semicolon before the caret -> {start, text} */
  function lastToken(value, caret) {
    const v = String(value || ""), c = caret == null ? v.length : caret, head = v.slice(0, c);
    const i = Math.max(head.lastIndexOf(","), head.lastIndexOf(";"));
    const start = i + 1, text = head.slice(start).replace(/^\s+/, "");
    return { start: start + (head.slice(start).length - head.slice(start).replace(/^\s+/, "").length), text };
  }
  const fmt = (c) => (c.name && c.name.toLowerCase() !== c.address ? `${c.name.replace(/[",<>]/g, "")} <${c.address}>` : c.address);
  /** the contact in place of the token being typed -> {value, caret} */
  function putIn(value, caret, contact) {
    const v = String(value || ""), c = caret == null ? v.length : caret, t = lastToken(v, c);
    const rest = v.slice(c).replace(/^[^,;]*/, "").replace(/^[,;]\s*/, "");
    const before = v.slice(0, t.start), lead = before && !/\s$/.test(before) ? " " : "";
    const ins = lead + fmt(contact) + ", ";
    return { value: before + ins + rest, caret: (before + ins).length };
  }
  const pure = { lastToken, putIn, fmt };
  if (!doc) { if (typeof module !== "undefined" && module.exports) module.exports = pure; return; }

  const $ = (id) => doc.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let box = null, inp = null, list = [], on = 0, timer = 0, seq = 0;
  const accId = () => (($("mlCFrom") || {}).value) || (root.H3Mail && root.H3Mail.S.acc) || "";
  function close() { if (box) box.remove(); box = null; list = []; }
  function paint() {
    if (!list.length) { close(); return; }
    if (!box) { box = doc.createElement("div"); box.className = "mlsugg"; box.setAttribute("role", "listbox"); doc.body.appendChild(box); box.addEventListener("mousedown", (e) => { const it = e.target.closest("[data-i]"); if (it) { e.preventDefault(); pick(+it.dataset.i); } }); }
    const r = inp.getBoundingClientRect();
    box.style.left = Math.round(r.left) + "px"; box.style.top = Math.round(r.bottom + 2) + "px"; box.style.minWidth = Math.round(Math.min(r.width, 420)) + "px";
    box.innerHTML = list.map((c, i) => `<div data-i="${i}" role="option" class="${i === on ? "on" : ""}">${esc(c.name || c.address)}${c.name ? `<span class="ad">${esc(c.address)}</span>` : ""}</div>`).join("");
  }
  function pick(i) {
    const c = list[i]; if (!c || !inp) return;
    const r = putIn(inp.value, inp.selectionStart, c);
    inp.value = r.value; inp.setSelectionRange(r.caret, r.caret); inp.dispatchEvent(new Event("input", { bubbles: true }));
    close(); inp.focus();
  }
  async function ask(el) {
    inp = el;
    const t = lastToken(el.value, el.selectionStart).text;
    if (!t || t.length < 1 || /[<>]/.test(t)) { close(); return; }
    const id = accId(); if (!id) return;
    const mine = ++seq;
    try {
      const r = await fetch(`/api/mail/${encodeURIComponent(id)}/contacts?q=${encodeURIComponent(t)}`);
      const j = await r.json();
      if (mine !== seq || doc.activeElement !== el) return;
      // the ones already in the field are left out
      const have = el.value.toLowerCase();
      list = (j.contacts || []).filter((c) => !have.includes("<" + c.address + ">") && !new RegExp("(^|[\\s,;])" + c.address.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[,;]").test(have)).slice(0, 8);
      on = 0; paint();
    } catch (e) { close(); }
  }
  function wire() {
    for (const id of ["mlCTo", "mlCCc", "mlCBcc"]) {
      const el = $(id); if (!el || el.dataset.mlsugg) continue;
      el.dataset.mlsugg = "1"; el.setAttribute("autocomplete", "off");
      el.addEventListener("input", (e) => { if (e.isTrusted === false && !list.length) return; clearTimeout(timer); timer = setTimeout(() => ask(el), 120); });
      el.addEventListener("keydown", (e) => {
        if (!box || inp !== el) return;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); on = (on + (e.key === "ArrowDown" ? 1 : list.length - 1)) % list.length; paint(); }
        else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); e.stopPropagation(); pick(on); }
        else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      });
      el.addEventListener("blur", () => setTimeout(() => { if (doc.activeElement !== el) close(); }, 150));
    }
  }
  root.H3MailContacts = Object.assign({ close, wire, ask }, pure);
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else setTimeout(wire, 0);
})(typeof window !== "undefined" ? window : globalThis);
