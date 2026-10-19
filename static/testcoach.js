/* bitGen Studio — static/testcoach.js (2.534.0): 🧪 TEST MODE - THE COACH THAT SUGGESTS THE NEXT TEST AND ASKS WHETHER IT WORKED.
 *
 * Tim (verbatim): "create a checkbox in settings for test mode . when in test mode check if tests are successful,
 * prompt the user to test features - eg if i am in image edit mode, pop up a little reminder to test blur, then the next
 * test in image editor. when out of test mode no tests are done" + "once the user does the test confirm with a dialog
 * that the test was successful, have an input box for suggestions to change feature"
 *
 *   THE SWITCH   Settings -> General -> 🧪 Test mode (and the 🧪 Testing docker's own box): POST /api/testplan/mode.
 *                Off: no event is sent or kept, nothing ticks, this coach shows nothing.
 *   WHERE YOU ARE  contexts(): settings (the dialog open), house (the 🏠 window), lora (the trainer), imageedit (the
 *                image editor docker), timeline, image (the Image generation mode), app - in that order. Each test
 *                item has `where` (lib/testPlan.json).
 *   🧪 TRY NEXT   a small box (bottom right) with the first test not done yet where you are: ✓ Tried it (-> the
 *                confirm box), – Skip, Later (the next one), ✕ (no more reminders in this area this session).
 *   DID IT WORK?  when the app sees a test work (an auto item ticks - a filter applied, a job of that style finished,
 *                a workspace picked ...) or you press ✓ Tried it: ✓ It worked / ✗ It didn't / Later, with "what
 *                happened" and "💡 suggestions to change this feature" -> POST /api/testplan/mark {state, note, suggest}.
 *                What was already seen working when Test mode came on is not asked about (confirm those in the docker).
 *   THE EDITOR   the image editor's undo steps (E.onPush) -> H3TestEvent("ie_action", the step's name) - Gaussian Blur,
 *                paint, erase, selection, move, new layer ... tick the image editor's tests.
 *   The box sits in the open modal dialog (Settings) as a top-layer popover, like the dropdown lists (2.533).
 * Pure (Node: scripts/test-testcoach534.js): order, nextTest, toConfirm, AREA.
 */
(function (root) {
  "use strict";
  const ORDER = ["settings", "house", "lora", "imageedit", "timeline", "image", "app"];
  const AREA = { settings: "Settings", house: "🏠 House builder", lora: "🎓 LoRA trainer", imageedit: "🖼 Image editor", timeline: "🎞 Timeline", image: "🎨 Image generation", app: "the app" };
  /** the areas you are in, most specific first (pure) */
  function order(flags) { return ORDER.filter((k) => k === "app" || (flags && flags[k])); }
  /** the first test not done in the first area that has one (pure): -> {row, where, left} | null */
  function nextTest(rows, areas, snoozed, hidden) {
    for (const w of areas || []) {
      if (hidden && hidden[w]) continue;
      const todo = (rows || []).filter((r) => r.where === w && !r.state && !(snoozed && snoozed[r.id]));
      if (todo.length) return { row: todo[0], where: w, left: todo.length };
    }
    return null;
  }
  /** seen working since Test mode came on, not answered yet (pure) */
  function toConfirm(rows, base, answered) {
    return (rows || []).filter((r) => r.pending && !(base && base[r.id]) && !(answered && answered[r.id]));
  }
  const pure = { ORDER, AREA, order, nextTest, toConfirm };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const C = { on: false, st: null, base: null, answered: {}, snooze: {}, hidden: {}, box: null, show: null, pollT: null, soonT: null, flash: null };
  const CSS = ".tcoach{position:fixed;right:14px;bottom:40px;left:auto;top:auto;margin:0;z-index:2147482000;width:340px;max-width:calc(100vw - 28px);background:var(--panel,#1d1a15);color:var(--text,#e8e2d6);"
    + "border:1px solid var(--line,#3a342a);border-radius:10px;box-shadow:0 12px 34px rgba(0,0,0,.55);padding:8px 10px;font:12.5px var(--body,system-ui,sans-serif);display:flex;flex-direction:column;gap:6px}"
    + ".tcoach.confirm{border-color:var(--tiger,#f59e2c)}.tcoach .tch{display:flex;gap:6px;align-items:center;font-weight:600}.tcoach .tch .tcn{flex:1;color:var(--dim,#9a917f);font-weight:400;font-size:.72rem}"
    + ".tcoach .tch .x{background:none;border:0;color:var(--dim,#9a917f);cursor:pointer;font-size:.85rem;padding:0 2px}.tcoach .tct{line-height:1.35}.tcoach .tchow{color:var(--dim,#9a917f);font-size:.72rem}"
    + ".tcoach textarea{width:100%;box-sizing:border-box;min-height:40px;resize:vertical;font:inherit;font-size:.76rem;background:var(--ink,#14120f);color:inherit;border:1px solid var(--line,#3a342a);border-radius:5px;padding:4px 6px}"
    + ".tcoach .tcb{display:flex;gap:6px;flex-wrap:wrap}.tcoach .tcb button{flex:1}.tcoach .tcb .ok{border-color:#7c7;color:#9e9}.tcoach .tcb .no{border-color:#e66;color:#f99}.tcoach .tcdone{color:#9e9}";
  function post(u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then((r) => r.json()); }
  function flags() {
    const vis = (id) => { const el = $(id); return !!el && el.offsetParent !== null && !el.classList.contains("dockgone") && !el.classList.contains("collapsed"); };
    const sf = (id) => { const el = $("sf-" + id); return !!el && !el.classList.contains("sf-hidden") && !el.classList.contains("sf-min"); };
    const gm = $("genModeSel");
    return { settings: !!($("settings") && $("settings").open), house: sf("house"), lora: sf("loratrain"), imageedit: vis("imageeditdock"), timeline: vis("timelinedock"), image: !!(gm && gm.value === "image") };
  }
  function contexts() { return order(flags()); }
  function hostOf() {
    const modal = [...document.querySelectorAll("dialog[open]")].filter((d) => { try { return d.matches(":modal"); } catch (e) { return false; } }).pop();
    return modal || document.body;
  }
  function place(box) {
    const h = hostOf();
    if (box.parentElement !== h) { try { if (box.matches(":popover-open")) box.hidePopover(); } catch (e) { /* fine */ } h.appendChild(box); }
    try { if (typeof box.showPopover === "function") { if (!box.hasAttribute("popover")) box.setAttribute("popover", "manual"); if (!box.matches(":popover-open")) box.showPopover(); } } catch (e) { /* the host holds it */ }
  }
  function drop() { if (C.box) { try { if (C.box.matches(":popover-open")) C.box.hidePopover(); } catch (e) { /* fine */ } C.box.remove(); } C.box = null; }
  function hide() { drop(); C.show = null; }
  function card(cls, html) {
    if (!$("tcCss")) { const st = document.createElement("style"); st.id = "tcCss"; st.textContent = CSS; document.head.appendChild(st); }
    drop();
    const box = document.createElement("div"); box.className = "tcoach " + cls; box.id = "tcBox"; box.setAttribute("role", "dialog"); box.innerHTML = html;
    box.addEventListener("keydown", (e) => e.stopPropagation());     // typing a suggestion is not a shortcut
    place(box); C.box = box; return box;
  }
  function busy() { return C.box && C.box.contains(document.activeElement) && /TEXTAREA|INPUT/.test(document.activeElement.tagName); }

  /** "Did it work?" for one item (manual = you pressed ✓ Tried it) */
  function confirmBox(row, n, manual) {
    C.show = { kind: "confirm", id: row.id };
    const b = card("confirm", `<div class="tch">🧪 Did it work?<span class="tcn">${n > 1 ? "1 of " + n : esc(AREA[row.where] || "")}</span><button class="x" data-a="later" title="Later (it stays in the 🧪 docker)">✕</button></div>`
      + `<div class="tct">${esc(row.title)}</div>` + (!manual && row.how ? `<div class="tchow">seen: ${esc(String(row.how).replace(/^auto: /, ""))}</div>` : "")
      + `<textarea class="tcnote" placeholder="What happened? (if it did not work: what you saw)" aria-label="What happened">${esc(row.note || "")}</textarea>`
      + `<textarea class="tcsug" placeholder="💡 Suggestions to change this feature (optional)" aria-label="Suggestions">${esc(row.suggest || "")}</textarea>`
      + `<div class="tcb"><button class="ghost ok" data-a="pass">✓ It worked</button><button class="ghost no" data-a="fail">✗ It didn't</button><button class="ghost" data-a="later">Later</button></div>`);
    b.onclick = (e) => {
      const a = e.target.closest && e.target.closest("[data-a]"); if (!a) return;
      const act = a.dataset.a, note = b.querySelector(".tcnote").value.trim(), sg = b.querySelector(".tcsug").value.trim();
      C.answered[row.id] = act;
      if (act === "later") { hide(); update(); return; }
      post("/api/testplan/mark", { id: row.id, state: act, note, suggest: sg }).then(() => {
        C.flash = { text: (act === "pass" ? "✓ Saved - it works" : "✗ Saved - thanks, it is in the log") + (sg ? " (with your suggestion)" : ""), until: Date.now() + 1800 };
        if (root.H3TestDock && H3TestDock.refresh) H3TestDock.refresh();
        poll();
      });
    };
    if (manual) setTimeout(() => { const t = b.querySelector(".tcnote"); if (t) t.focus(); }, 30);   // (seen by itself: no focus stolen from your work)
  }
  /** "Try next" where you are */
  function nextBox(nx) {
    C.show = { kind: "next", id: nx.row.id };
    const r = nx.row;
    const b = card("next", `<div class="tch">🧪 Try next · ${esc(AREA[nx.where] || nx.where)}<span class="tcn">${nx.left} left here</span><button class="x" data-a="hide" title="No more reminders in ${esc(AREA[nx.where] || "")} (this session)">✕</button></div>`
      + (C.flash && C.flash.until > Date.now() ? `<div class="tcdone">${esc(C.flash.text)}</div>` : "")
      + `<div class="tct">${esc(r.title)}</div>` + (r.steps && r.steps.length ? `<div class="tchow">${r.steps.map(esc).join(" → ")}</div>` : "")
      + `<div class="tchow">${r.auto ? "It ticks itself when the app sees it work - then it asks you." : "Try it, then ✓ Tried it."}</div>`
      + `<div class="tcb"><button class="ghost ok" data-a="done" title="Say whether it worked (and what to change)">✓ Tried it</button><button class="ghost" data-a="skip" title="Not tested (no hardware / not used)">– Skip</button><button class="ghost" data-a="later" title="The next one">Later</button></div>`);
    b.onclick = (e) => {
      const a = e.target.closest && e.target.closest("[data-a]"); if (!a) return;
      const act = a.dataset.a;
      if (act === "done") { confirmBox(r, 1, true); return; }
      if (act === "skip") { C.answered[r.id] = "skip"; post("/api/testplan/mark", { id: r.id, state: "skip", note: "" }).then(poll); return; }
      if (act === "later") { C.snooze[r.id] = 1; update(); return; }
      if (act === "hide") { C.hidden[nx.where] = 1; update(); }
    };
  }
  function update() {
    if (!C.on || !C.st || !C.st.mode || !C.base) { hide(); return; }   // (until a poll with Test mode on has set what was seen before)
    if (busy()) return;                                        // never redraw under your typing
    if (C.show && C.show.kind === "confirm" && C.box && !C.answered[C.show.id]) { place(C.box); return; }
    const rows = C.st.rows || [];
    const pend = toConfirm(rows, C.base, C.answered);
    if (pend.length) { if (!(C.show && C.show.kind === "confirm" && C.show.id === pend[0].id)) confirmBox(pend[0], pend.length, false); return; }
    const nx = nextTest(rows, contexts(), Object.assign({}, C.snooze, C.answered), C.hidden);
    if (!nx) { hide(); return; }
    if (C.show && C.show.kind === "next" && C.show.id === nx.row.id && C.box) { place(C.box); const n = C.box.querySelector(".tcn"); if (n) n.textContent = nx.left + " left here"; return; }
    nextBox(nx);
  }
  function poll() {
    clearTimeout(C.pollT);
    return fetch("/api/testplan").then((r) => r.json()).then((st) => {
      C.st = st; const was = C.on; C.on = !!st.mode; root.H3TestMode = C.on;
      if ($("s_testmode")) $("s_testmode").checked = C.on;
      if (C.on && (!was || !C.base)) { C.base = {}; (st.rows || []).forEach((r) => { if (r.pending || r.auto_state === "pass") C.base[r.id] = 1; }); }   // what was seen before: the docker, not a pop-up
      if (!C.on) C.base = null;
      update();
      return st;
    }).catch(() => null).finally(() => { C.pollT = setTimeout(poll, C.on ? 4000 : 20000); });
  }
  function soon() { clearTimeout(C.soonT); C.soonT = setTimeout(poll, 500); }
  function modeChanged(on) { C.on = !!on; root.H3TestMode = C.on; if (!on) { hide(); C.base = null; } soon(); }
  function setMode(on) { return post("/api/testplan/mode", { on: !!on }).then((r) => { modeChanged(!!r.on); if (root.H3TestDock && H3TestDock.refresh) H3TestDock.refresh(); return r; }); }
  // the image editor's every undo step = what you just did there
  function hookEditor() {
    const I = root.imageEditorInstance, E = I && I.E;
    if (!E || E.__tcHook) return !!(E && E.__tcHook);
    E.__tcHook = true;
    const prev = E.onPush;
    E.onPush = function (e) {
      try { if (prev) return prev.apply(this, arguments); }
      finally { if (C.on && e && e.label && root.H3TestEvent) root.H3TestEvent("ie_action", String(e.label).slice(0, 80)); }
    };
    return true;
  }
  function start() {
    const cb = $("s_testmode");
    if (cb && !cb.dataset.tc) { cb.dataset.tc = "1"; cb.addEventListener("change", () => setMode(cb.checked)); }
    setInterval(() => { hookEditor(); if (C.on) update(); }, 1500);   // the editor mounts late; areas open and close
    poll();
  }
  root.H3TestCoach = Object.assign({ poll, soon, modeChanged, setMode, contexts, flags, hookEditor, update, state: () => C, hide }, pure);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
