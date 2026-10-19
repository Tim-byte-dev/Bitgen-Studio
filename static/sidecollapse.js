/* bitGen Studio — static/sidecollapse.js (2.514.0): THE SIDE DOCKERS FOLD TO A TITLE STRIP. window.H3SideCollapse.
 *
 * Tim (verbatim): "when the dockers are docked make them into dropdowns so user can hide the content of the docker but
 * keep the titlebar" - asked how a full-height side docker should look folded: "Thin title strip".
 *   ▾ at the start of a side docker's title (Settings, References, Assets, Queue, Gallery) folds it: the column shrinks
 *   to a thin strip with its title running down it - click the strip (or ▸) to open it again. The bottom dockers
 *   already fold to their title bar (their ▾). Kept in this browser (h3.sc.<docker>).
 * Pure: COLS (docker -> its column / seam variables).
 */
(function (root) {
  "use strict";
  const COLS = { ldock: ["c1", "s1"], refsdock: ["c2", "s2"], assetsdock: ["c3", "s3"], qdock: ["c4", "s5"], rdock: ["c5", "s4"] };
  const STRIP = 30;
  const get = (k) => { try { return root.localStorage.getItem("h3.sc." + k) === "1"; } catch (e) { return false; } };
  const put = (k, v) => { try { root.localStorage.setItem("h3.sc." + k, v ? "1" : "0"); } catch (e) { /* private */ } };
  function css() {
    if (document.getElementById("h3scCss")) return;
    const st = document.createElement("style"); st.id = "h3scCss";
    st.textContent = Object.keys(COLS).map((id) => `#app.sc-${id}{--${COLS[id][0]}:${STRIP}px !important;--${COLS[id][1]}:0px !important}`).join("")
      + ".dock .sccaret{flex:none;cursor:pointer;color:var(--dim,#9a917f);font-size:.8rem;user-select:none;padding:0 2px}.dock .sccaret:hover{color:var(--tiger,#f59e2c)}"
      + ".dock.sidecol>:not(.dockhead){display:none !important}"
      + ".dock.sidecol>.dockhead{writing-mode:vertical-rl;flex:1;justify-content:flex-start;align-items:center;padding:10px 0;border-bottom:0;cursor:pointer;min-height:0;gap:8px}"
      + ".dock.sidecol>.dockhead>:not(h1):not(.sccaret){display:none !important}.dock.sidecol>.dockhead h1{margin:0;white-space:nowrap}.dock.sidecol>.dockhead:hover{background:var(--panel-2,#26221b)}";
    document.head.appendChild(st);
  }
  function set(id, on) {
    const d = document.getElementById(id), app = document.getElementById("app"); if (!d || !app) return;
    d.classList.toggle("sidecol", !!on); app.classList.toggle("sc-" + id, !!on); put(id, !!on);
    const c = d.querySelector(":scope > .dockhead > .sccaret"); if (c) { c.textContent = on ? "▸" : "▾"; c.title = on ? "Open this docker" : "Fold this docker to a title strip"; }
    try { root.dispatchEvent(new root.Event("resize")); } catch (e) { /* old */ }
  }
  const folded = (id) => { const d = document.getElementById(id); return !!(d && d.classList.contains("sidecol")); };
  function start() {
    css();
    for (const id of Object.keys(COLS)) {
      const d = document.getElementById(id), head = d && d.querySelector(":scope > .dockhead"); if (!head || head.querySelector(".sccaret")) continue;
      const c = document.createElement("span"); c.className = "sccaret"; c.setAttribute("role", "button"); c.dataset.sc = id;
      head.insertBefore(c, head.firstChild);
      c.addEventListener("click", (e) => { e.stopPropagation(); set(id, !folded(id)); });
      head.addEventListener("click", (e) => { if (folded(id) && !e.target.closest("button:not(.sccaret)")) set(id, false); });
      set(id, get(id));
    }
  }
  root.H3SideCollapse = { COLS, set, folded, start };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  setTimeout(start, 2000);                                  // the 📌 pins go in by script - the caret stays first
})(window);
