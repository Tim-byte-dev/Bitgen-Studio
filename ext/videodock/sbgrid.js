/* bitGen Studio — THE STORYBOARD GRID (2.565.0), window.H3SbGrid.
 *
 * Tim (verbatim): "can u make the llm generate a storyboard instead of just scenes - i give it reference images and it
 * creates pictures for the storyboard that i can use as the starting reference image - we can change this image if
 * needed. the scene text will go into a card like our model manager - the thumbnails will be in a grid format with arrows
 * pointing to the next scene. keep all the other features in our storyboard scenes"
 *
 *   ▦ GRID (the new default; ☰ List = the cards as before)  every scene is a CARD like the Model manager's - its
 *                storyboard picture (else its First frame, else an empty frame) on top, "Scene n" + its state (⏳ / ● /
 *                ✔ / ✕) and chapter, its text underneath - in a grid, an ➜ ARROW from each scene to the next. On the
 *                card: 🖼 make / ↻ another picture, ▶ render (↻ redo once it has a take), → First (start on the picture).
 *   A CLICK      opens that scene's full card under the grid - every feature it had (the prompt editor, Ref / First /
 *                Cont / Trans, the First / Last frames, its pictures, ✎ First frame, the filmstrip, ⏫ …): the scene
 *                picker shows only that one; "All scenes" in it (or ✕ on the card) closes it.
 *   Kept per browser (sb.view). Painted again whenever the board or the storyboard pictures change.
 * Pure (Node: scripts/test-sbgrid565.js): state, text, cardHtml, gridHtml.
 */
(function (root) {
  "use strict";
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /** a scene's state word + mark */
  function state(r) {
    if (!r) return { mark: "", word: "" };
    if (r.status === "running") return { mark: "⏳", word: "rendering" + (r.progress && r.progress.pct ? " " + Math.round(r.progress.pct) + "%" : "") };
    if (r.error && r.status !== "kept" && r.status !== "rendered") return { mark: "✕", word: "failed" };
    if (r.status === "kept") return { mark: "✔", word: "kept" };
    if (r.status === "rendered") return { mark: "●", word: "rendered" };
    return { mark: "", word: "" };
  }
  /** its words: the prompt lines without the [Shot n] heads */
  const text = (r) => ((r && r.prompt) || []).map((l) => String(l || "").replace(/^\s*\[[^\]]*\]\s*/, "").trim()).filter(Boolean).join(" ");
  /** one card. r = the scene row, it = its storyboard picture (or null), o = {sel, busy, v} */
  function cardHtml(r, it, o) {
    const x = o || {}, n = r.n, s = state(r);
    const src = it ? `/api/storyboard/${n}/thumb?v=${encodeURIComponent(String(it.at || ""))}`
      : r.fl_first && r.fl_first.file ? `/api/scenes/${n}/fl/first?v=${encodeURIComponent(String(r.updated || ""))}` : "";
    const what = it ? "its storyboard picture" : src ? "its First frame" : "";
    return `<div class="sbgcard${x.sel ? " sel" : ""}" data-sbg="${n}" role="button" tabindex="0" aria-label="Scene ${n}${s.word ? " - " + s.word : ""}: open its card">`
      + `<div class="th"${src ? ` style="background-image:url('${src}')"` : ""} title="${esc(what ? "Scene " + n + ": " + what : "Scene " + n + " has no picture yet - 🖼 makes it")}">`
      + (src ? "" : `<span>${x.busy ? "⏳" : n}</span>`)
      + `<span class="no">${n}</span>${s.mark ? `<span class="st st-${esc(s.word.split(" ")[0])}" title="${esc(s.word)}">${s.mark}</span>` : ""}</div>`
      + `<div class="bd"><div class="nm">Scene ${n}${r.chapter ? ` <span class="ch">· ${esc(r.chapter)}</span>` : ""}</div>`
      + `<div class="tx" title="${esc(text(r))}">${esc(text(r)) || '<span class="hint">no text</span>'}</div>`
      + (r.error && s.mark === "✕" ? `<div class="er" title="${esc(r.error)}">${esc(String(r.error).slice(0, 90))}</div>` : "")
      + `<div class="bt">`
      + `<button class="ghost gbtn" type="button" data-sbgmake="${n}"${x.busy ? " disabled" : ""} title="${it ? "Make another storyboard picture" : "Make its storyboard picture"} (the StoryBoard's image model + the references ticked on the bar)">${x.busy ? "⏳" : it ? "↻ 🖼" : "🖼"}</button>`
      + `<button class="ghost gbtn" type="button" data-sbgplay="${n}"${r.status === "running" ? " disabled" : ""} title="${r.output ? "Redo - render a new take" : "Render this scene"}">${r.output ? "↻ ▶" : "▶"}</button>`
      + (it ? `<button class="ghost gbtn" type="button" data-sbgfirst="${n}" title="Start the scene on its storyboard picture (its FIRST frame)">→ First</button>` : "")
      + `</div></div></div>`;
  }
  /** the grid: cards with an arrow from each scene to the next */
  function gridHtml(rows, items, o) {
    const x = o || {};
    if (!(rows || []).length) return `<div class="modehint">No scenes yet - 🎞 Write storyboard (the LLM writes the scenes and their pictures), ＋ Scene, or ask the assistant to "create a screenplay".</div>`;
    return rows.map((r, i) => cardHtml(r, (items && items.get ? items.get(r.n) : null) || null, { sel: String(x.sel) === String(r.n), busy: !!(x.busy && x.busy(r.n)) })
      + (i < rows.length - 1 ? `<span class="sbgarr" aria-hidden="true" title="then scene ${rows[i + 1].n}">➜</span>` : "")).join("");
  }
  const API = { state, text, cardHtml, gridHtml };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }

  const doc = root.document, $ = (id) => doc.getElementById(id);
  const LS = (k, d) => { try { const v = root.localStorage.getItem("sb." + k); return v == null ? d : v; } catch (e) { return d; } };
  const LSset = (k, v) => { try { root.localStorage.setItem("sb." + k, v); } catch (e) { /* private */ } };
  let view = LS("view", "grid") === "list" ? "list" : "grid";
  function css() {
    if ($("sbgCss")) return;
    const s = doc.createElement("style"); s.id = "sbgCss";
    s.textContent = "#sbGrid{display:flex;flex-wrap:wrap;gap:6px;align-items:stretch;padding:4px 2px}"
      + "#sbGrid .sbgcard{position:relative;width:var(--sbw,186px);border:1px solid var(--line,#3a342a);border-radius:7px;overflow:hidden;cursor:pointer;background:var(--panel,#1b1814);display:flex;flex-direction:column}"
      + "#sbGrid .sbgcard:hover{border-color:var(--tiger-deep,#a35a1a)}#sbGrid .sbgcard.sel{border-color:var(--tiger,#f59e2c);box-shadow:0 0 0 1px var(--tiger,#f59e2c)}"
      + "#sbGrid .th{position:relative;aspect-ratio:16/9;background:#111318 center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:var(--dim,#777);font-size:1.3rem;font-weight:600}"
      + "#sbGrid .th .no{position:absolute;left:4px;top:3px;font-size:.62rem;padding:0 5px;border-radius:7px;background:rgba(0,0,0,.65);color:#eee}"
      + "#sbGrid .th .st{position:absolute;right:4px;top:3px;font-size:.66rem;padding:0 5px;border-radius:7px;background:rgba(0,0,0,.65)}#sbGrid .th .st-failed{color:#e88}#sbGrid .th .st-rendering{color:var(--tiger,#f59e2c)}#sbGrid .th .st-kept,#sbGrid .th .st-rendered{color:#8d8}"
      + "#sbGrid .bd{padding:4px 6px;display:flex;flex-direction:column;gap:3px;flex:1}#sbGrid .nm{font-weight:600;font-size:.74rem}#sbGrid .nm .ch{font-weight:400;color:var(--dim,#999)}"
      + "#sbGrid .tx{font-size:.68rem;line-height:1.3;color:var(--text,#ddd);display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;flex:1}"
      + "#sbGrid .er{font-size:.62rem;color:#e88;max-height:2.5em;overflow:hidden}#sbGrid .bt{display:flex;gap:3px;flex-wrap:wrap}#sbGrid .bt button{font-size:.64rem;padding:1px 5px}"
      + "#sbGrid .sbgarr{align-self:center;color:var(--tiger,#f59e2c);font-size:1.05rem;flex:none;user-select:none}"
      + "#videodock.sb-grid #scList.sbg-none{display:none}#sbViewBtns{display:inline-flex;gap:2px}#sbViewBtns button.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
      + "#sbBar #sbStyle{min-width:120px}"
      + "#sbDetailHead{display:none;align-items:center;gap:6px;font-size:.72rem;margin:4px 2px 0}#videodock.sb-grid #sbDetailHead.on{display:flex}";
    doc.head.appendChild(s);
  }
  const scenes = () => { const st = root.bgScenes && root.bgScenes.state ? root.bgScenes.state() : null; return (st && st.list) || []; };
  const picked = () => ($("scPick") ? $("scPick").value : "");
  function pick(n) {
    const s = $("scPick"); if (!s) return;
    s.value = n == null ? "" : String(n);
    if (s.value !== String(n == null ? "" : n)) { s.value = ""; }
    s.dispatchEvent(new root.Event("change"));
    paint();
  }
  let lastKey = "";
  function paint() {
    const g = $("sbGrid"), d = $("videodock"); if (!g || !d) return;
    d.classList.toggle("sb-grid", view === "grid");
    g.style.display = view === "grid" ? "" : "none";
    const vb = $("sbViewBtns"); if (vb) vb.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.sbview === view));
    const sel = picked(), list = $("scList");
    if (list) list.classList.toggle("sbg-none", view === "grid" && !sel);
    const dh = $("sbDetailHead"); if (dh) { dh.classList.toggle("on", view === "grid" && !!sel); const t = dh.querySelector("span"); if (t) t.textContent = sel ? `Scene ${sel} - its full card (every setting):` : ""; }
    if (view !== "grid") return;
    const rows = scenes(), H = root.H3Story || {}, its = new Map((H.items ? H.items() : []).map((x) => [x.n, x]));
    const key = JSON.stringify([sel, rows.map((r) => [r.n, r.status, r.error, r.output, r.chapter, (r.prompt || []).join("\n"), r.fl_first && r.fl_first.file, r.updated, r.progress && r.progress.pct]),
      [...its.values()].map((x) => [x.n, x.at]), rows.map((r) => (H.busy ? H.busy(r.n) : false))]);
    if (key === lastKey) return;
    lastKey = key;
    g.innerHTML = gridHtml(rows, its, { sel, busy: H.busy });
  }
  function wire(g) {
    g.addEventListener("click", (e) => {
      const b = e.target.closest("button"), H = root.H3Story || {};
      if (b) {
        e.stopPropagation();
        if (b.dataset.sbgmake && H.make) H.make(+b.dataset.sbgmake).then(() => { lastKey = ""; paint(); });
        else if (b.dataset.sbgfirst && H.useAs) H.useAs(+b.dataset.sbgfirst, "first", { anchor: true });
        else if (b.dataset.sbgplay) { const p = doc.querySelector(`#scList [data-scplay="${b.dataset.sbgplay}"]`); if (p && !p.disabled) p.click(); else if (H.say) H.say(`scene ${b.dataset.sbgplay} cannot render right now`); }
        lastKey = ""; root.setTimeout(paint, 300);
        return;
      }
      const c = e.target.closest(".sbgcard"); if (!c) return;
      const n = c.dataset.sbg;
      pick(picked() === n ? null : n);
      if (picked() === n) { const card = doc.querySelector(`#scList .sccard[data-sc="${n}"]`); if (card && card.scrollIntoView) card.scrollIntoView({ block: "nearest" }); }
    });
    g.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("sbgcard")) { e.preventDefault(); e.target.click(); } });
  }
  function setView(v) { view = v === "list" ? "list" : "grid"; LSset("view", view); lastKey = ""; if (view === "list" && $("scPick") && $("scPick").value) { /* the list shows the picked one, as before */ } paint(); }
  function start() {
    const list = $("scList"), bar = $("sbBar"); if (!list || !bar) return false;
    css();
    if (!$("sbGrid")) {
      const g = doc.createElement("div"); g.id = "sbGrid"; g.setAttribute("aria-label", "The storyboard - every scene, in order");
      list.parentNode.insertBefore(g, $("scPickRow") || list);
      wire(g);
      const dh = doc.createElement("div"); dh.id = "sbDetailHead";
      dh.innerHTML = '<span></span><button class="ghost gbtn" type="button" title="Close the card - back to the grid" aria-label="Close the scene card">✕</button>';
      dh.querySelector("button").onclick = () => pick(null);
      list.parentNode.insertBefore(dh, list);
    }
    if (!$("sbViewBtns")) {
      const v = doc.createElement("span"); v.id = "sbViewBtns";
      v.innerHTML = '<button class="ghost gbtn" type="button" data-sbview="grid" title="The storyboard as a grid of cards, an arrow to the next scene" aria-label="Grid view">▦</button>'
        + '<button class="ghost gbtn" type="button" data-sbview="list" title="The scenes as a list (the cards as before)" aria-label="List view">☰</button>';
      v.querySelectorAll("button").forEach((b) => { b.onclick = () => setView(b.dataset.sbview); });
      bar.insertBefore(v, bar.children[1] || null);
    }
    const H = root.H3Story; if (H) H.onPaint = () => paint();
    if (root.MutationObserver) new root.MutationObserver(() => paint()).observe(list, { childList: true });
    if ($("scPick")) $("scPick").addEventListener("change", () => root.setTimeout(paint, 0));
    root.setInterval(paint, 2500);
    paint();
    return true;
  }
  const boot = () => { if (!start()) root.setTimeout(boot, 400); };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3SbGrid = Object.assign(API, { paint, setView, pick, view: () => view });
})(typeof window !== "undefined" ? window : globalThis);
