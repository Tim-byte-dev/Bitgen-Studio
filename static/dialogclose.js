/* bitGen Studio — static/dialogclose.js (2.875.0): A ✕ CLOSE BUTTON AT THE TOP RIGHT OF EVERY DIALOG (window.H3DialogClose).
 *
 * Tim (verbatim): "add an x(close) button to the top right of every dialog".
 * Watches the page (a MutationObserver, at most every 120 ms) for dialogs as they open and gives each one without a close
 * button of its own a ✕ in its top right corner:
 *   <dialog> (open)            ✕ = what Esc does: a cancelable "cancel" event, then close() (the dialog's own cancel / close
 *                              handlers run as they do for Esc)
 *   .kxdlg (the editors' boxes) and any [role="dialog"] / *dlg box with a Cancel / Close button
 *                              ✕ = its own Cancel / Close button pressed (so its code runs); a .kxdlg without one is removed
 * A dialog that already has a close button (a button reading ✕ × ✖, or labelled Close) is left alone; data-noclose opts out
 * (the lock screen, the splash). The ✕ is a real <button> (Tab reaches it; "Close" for screen readers).
 *   closeOf(el)      what the ✕ would press: {kind: "dialog" | "button" | "remove", button?} | null
 *   hasClose(el)     does it have a close button already?
 *   scan()           decorate what is open now (the observer calls it)
 */
(function (root) {
  "use strict";
  const doc = root.document;
  if (!doc) return;
  const XTEXT = /^\s*[✕×✖⨯xX]\s*$/;
  const isBtn = (b) => b && (b.tagName === "BUTTON" || b.getAttribute("role") === "button" || (b.tagName === "INPUT" && /^(button|submit)$/i.test(b.type)));
  const label = (b) => ((b.getAttribute("aria-label") || "") + " " + (b.getAttribute("title") || "")).trim();
  /** in the box's head: a direct child, inside its first child, or inside a heading / title / head bar of it */
  function inHead(b, el) {
    if (b.parentElement === el || (el.firstElementChild && el.firstElementChild.contains(b))) return true;
    const h = b.closest("h1,h2,h3,h4,h5,h6,header,[class*=head],[class*=title],[class*=hdr],[class*=titlebar]");
    return !!h && h !== el && el.contains(h);
  }
  /** a close button of its own: a ✕ / × in its head (a ✕ further down - "no logo", "remove this row" - is not one), or a
   *  button labelled Close */
  function hasClose(el) {
    return Array.prototype.some.call(el.querySelectorAll("button,[role=button],.close,.x,[data-close]"), (b) => {
      if (b.classList.contains("h3dlgx")) return true;
      const t = (b.textContent || b.value || "").trim();
      if (/^close\b/i.test(label(b))) return true;
      return (XTEXT.test(t) || (b.classList.contains("close") && t.length <= 2)) && inHead(b, el);
    });
  }
  /** the box's own Cancel / Close button (the last one wins - footers put it last) */
  function cancelOf(el) {
    const bs = Array.prototype.filter.call(el.querySelectorAll("button,input[type=button]"), (b) => isBtn(b) && !b.classList.contains("h3dlgx"));
    const pick = (re) => bs.filter((b) => re.test((b.textContent || b.value || "").trim()) || re.test(label(b))).pop();
    return el.querySelector(":scope > .bt .cn, :scope .bt > .cn") || pick(/^(cancel|close|not now|done|ok)\b/i) || null;
  }
  function closeOf(el) {
    if (!el || el.hasAttribute("data-noclose")) return null;
    if (el.tagName === "DIALOG") return { kind: "dialog" };
    const b = cancelOf(el);
    if (b) return { kind: "button", button: b };
    return el.classList.contains("kxdlg") ? { kind: "remove" } : null;
  }
  function press(el) {
    const how = closeOf(el); if (!how) return;
    if (how.kind === "dialog") {
      const ev = new Event("cancel", { cancelable: true });
      if (el.dispatchEvent(ev) && el.open) el.close();
      return;
    }
    if (how.kind === "button") { how.button.click(); return; }
    el.remove();
  }
  function decorate(el) {
    if (el.dataset.h3x || el.hasAttribute("data-noclose")) return false;
    if (hasClose(el)) { el.dataset.h3x = "own"; return false; }
    if (!closeOf(el)) return false;                          // no Cancel / Close button yet - looked at again on the next change
    const b = doc.createElement("button");
    b.type = "button"; b.className = "h3dlgx"; b.textContent = "✕"; b.title = "Close (Esc)"; b.setAttribute("aria-label", "Close");
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); press(el); });
    b.addEventListener("pointerdown", (e) => e.stopPropagation());     // never starts a drag of the box's title
    const cs = root.getComputedStyle ? root.getComputedStyle(el) : null;
    if (cs && cs.position === "static") el.style.position = "relative";
    el.appendChild(b);
    el.dataset.h3x = "1";
    return true;
  }
  // every <dialog> (open or not - the ✕ sits inside it), the editors' boxes and ARIA dialogs
  const SEL = "dialog, .kxdlg, [role=dialog], [role=alertdialog]";
  function scan() {
    let n = 0;
    doc.querySelectorAll(SEL).forEach((el) => {
      // a closed <dialog> opened again keeps its ✕; one that lost it (its content re-rendered) gets it back
      if (el.dataset.h3x === "1" && !el.querySelector(":scope > .h3dlgx")) delete el.dataset.h3x;
      if (decorate(el)) n++;
    });
    return n;
  }
  function css() {
    if (doc.getElementById("h3dlgxcss")) return;
    const s = doc.createElement("style"); s.id = "h3dlgxcss";
    s.textContent = ".h3dlgx{position:absolute;top:6px;right:6px;z-index:5;width:24px;height:24px;padding:0;line-height:22px;text-align:center;font-size:14px;"
      + "border:1px solid transparent;border-radius:6px;background:transparent;color:var(--text,inherit);opacity:.75;cursor:pointer}"
      + ".h3dlgx:hover,.h3dlgx:focus-visible{opacity:1;border-color:var(--line,rgba(128,128,128,.5));background:var(--panel-2,rgba(128,128,128,.15))}";
    (doc.head || doc.documentElement).appendChild(s);
  }
  let t = null;
  const soon = () => { if (t) return; t = setTimeout(() => { t = null; try { scan(); } catch (e) { /* never in the way */ } }, 120); };
  function start() {
    css(); scan();
    if (typeof MutationObserver === "function") new MutationObserver(soon).observe(doc.body || doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
  root.H3DialogClose = { scan, closeOf, hasClose, press };
})(typeof window !== "undefined" ? window : globalThis);
