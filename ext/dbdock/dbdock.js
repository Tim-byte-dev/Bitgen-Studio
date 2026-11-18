/* dbdock.js — 🗄 THE DATABASE DOCKER (2.842.0), window.H3Db.
 *
 * Tim (verbatim): "allow user to create a mysql or mariadb inside the project or global, llm will create all of the
 * tables,fields and views".
 *   WHERE      📁 This project (its own MariaDB, data in projects/<p>/db) · 🌐 Global (<app>/db, every project) · 🖧 Your server
 *              (⚙ host / port / user / password, kept encrypted). The server starts by itself when it is needed; ▶ / ⏹.
 *   MISSING    MariaDB not on this computer -> the Download / Cancel box (⬇ archive.mariadb.org into <app>/mariadb, a bar).
 *   ✨ DESIGN  describe what it is for -> the prompt docker's LLM writes CREATE TABLE / views / indexes / keys (lib/dbAi.js -
 *              never DROP TABLE) -> the SQL shown, changeable -> ▶ Run, statement by statement (the first error stops it).
 *   TABLES     the tables and views with their fields (key, type, links) · 📋 Data: the rows · ⌨ SQL: any SQL.
 *   THE PROMPT DOCKER  "create a database for my shop with customers and orders" -> this docker opens with the design in it.
 * Pure (Node: scripts/test-842.js): wants, gridHtml.
 */
(function (root) {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  /** a prompt-docker message that asks for a database -> {ask} | null */
  function wants(t) {
    const s = String(t || "").trim();
    if (!/\b(create|make|design|build|set up|setup|plan)\b/i.test(s) || !/\b(database|db|tables?|schema|mariadb|mysql)\b/i.test(s)) return null;
    if (/\b(spreadsheet|slides?|presentation|invoice|quote|receipt|picture|image|video|song)\b/i.test(s)) return null;
    return { ask: s.replace(/^(please\s+)?(can you\s+)?/i, "") };
  }
  /** rows -> an HTML table */
  function gridHtml(columns, rows) {
    const cols = columns && columns.length ? columns : rows && rows[0] ? Object.keys(rows[0]) : [];
    return `<table class="dbgrid"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${(rows || []).map((r) => `<tr>${cols.map((c) => `<td title="${esc(r[c])}">${r[c] == null ? '<i style="color:var(--dim)">NULL</i>' : esc(r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  const pure = { wants, gridHtml };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  const doc = root.document, $ = (id) => doc.getElementById(id);
  const store = { get: (k, d) => { try { const v = root.localStorage.getItem("h3.db." + k); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { root.localStorage.setItem("h3.db." + k, v); } catch (e) { /* fine */ } } };
  const S = { scope: store.get("scope", "project"), db: "", schema: null, table: "", status: null };
  const api = async (u, body) => { const r = await root.fetch(u, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) { const e = new Error(j.error || "HTTP " + r.status); e.status = r.status; throw e; } return j; };
  const msg = (t, bad) => { const m = $("dbMsg"); if (m) { m.textContent = t || ""; m.classList.toggle("bad", !!bad); } };
  const q = (o) => Object.entries(o).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  async function refreshStatus() {
    S.status = await api("/api/db/status");
    const sc = S.status.scopes[S.scope], on = S.scope === "external" ? !!S.status.external.host : !!(sc && sc.running);
    $("dbDot").classList.toggle("on", on);
    $("dbStart").style.display = $("dbStop").style.display = S.scope === "external" ? "none" : "";
    $("dbExtBtn").style.display = S.scope === "external" ? "" : "none";
    return S.status;
  }
  /* ---- MariaDB missing: the Download / Cancel box */
  let needWait = null;
  function need() {
    const box = $("dbNeed"), st = S.status, d = st && st.download;
    $("dbNeedWhere").textContent = d ? `${d.size}, downloaded once into the app's mariadb folder (MariaDB ${st.version}).` : "There is no download for this computer here - on a Mac: brew install mariadb (bitGen finds it), or use ⚙ Your server.";
    $("dbNeedGo").disabled = !d; box.classList.add("on");
    return new Promise((ok) => { needWait = ok; });
  }
  async function download() {
    $("dbNeedGo").disabled = true; msg("⬇ downloading MariaDB…");
    try { await api("/api/db/download", {}); } catch (e) { msg("✗ " + e.message, true); $("dbNeedGo").disabled = false; return; }
    for (;;) {
      await new Promise((r) => setTimeout(r, 800));
      const st = await refreshStatus(), i = st.install || {};
      const pct = i.total ? Math.round(i.got / i.total * 100) : 0; $("dbNeedBar").firstElementChild.style.width = (i.phase === "unpacking" ? 100 : pct) + "%";
      if (i.state === "running") { msg(i.phase === "unpacking" ? "📦 unpacking…" : `⬇ ${pct}% (${Math.round((i.got || 0) / 1048576)} MB)`); continue; }
      if (i.state === "failed") { msg("✗ " + i.error, true); $("dbNeedGo").disabled = false; return; }
      $("dbNeed").classList.remove("on"); msg("✓ MariaDB is installed"); if (needWait) { needWait(true); needWait = null; } return;
    }
  }
  /** the server there (installed + started) -> true */
  async function ready() {
    const st = await refreshStatus();
    if (S.scope === "external") { if (!st.external.host) { openExt(); return false; } return true; }
    if (!st.server && !(await need())) return false;
    if (!st.scopes[S.scope].running) { msg("▶ starting the database server…"); await api("/api/db/start", { scope: S.scope }); await refreshStatus(); msg("● running"); }
    return true;
  }
  async function loadDbs(pick) {
    if (!(await ready())) return;
    const j = await api("/api/db/databases?" + q({ scope: S.scope })), sel = $("dbDbSel");
    sel.innerHTML = j.databases.length ? j.databases.map((n) => `<option>${esc(n)}</option>`).join("") : '<option value="">(no database yet - ＋ New)</option>';
    S.db = pick && j.databases.includes(pick) ? pick : j.databases.includes(store.get("db." + S.scope, "")) ? store.get("db." + S.scope, "") : j.databases[0] || "";
    sel.value = S.db; await loadSchema();
  }
  async function loadSchema() {
    const box = $("dbTables");
    if (!S.db) { box.innerHTML = '<div class="dbh">no database</div>'; S.schema = null; return; }
    store.set("db." + S.scope, S.db);
    S.schema = await api("/api/db/schema?" + q({ scope: S.scope, db: S.db }));
    const tabs = S.schema.tables.filter((t) => t.kind === "table"), views = S.schema.tables.filter((t) => t.kind === "view");
    const one = (t) => `<div class="dbt${t.name === S.table ? " on" : ""}" data-t="${esc(t.name)}">${t.kind === "view" ? "👁" : "▦"} ${esc(t.name)}${t.rows != null ? ` <span style="color:var(--dim)">${t.rows}</span>` : ""}</div><div class="dbcols">${t.columns.map((c) => `${c.key === "PRI" ? "🔑" : c.ref ? "🔗" : "·"} ${esc(c.name)} <span title="${esc(c.ref ? "→ " + c.ref : "")}">${esc(c.type)}</span>`).join("<br>")}</div>`;
    box.innerHTML = `<div class="dbh">Tables (${tabs.length})</div>${tabs.map(one).join("")}<div class="dbh">Views (${views.length})</div>${views.map(one).join("")}`;
  }
  function tab(n) { doc.querySelectorAll("#dbTabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === n)); doc.querySelectorAll("#dbRight .dbpane").forEach((p) => p.classList.toggle("on", p.dataset.pane === n)); }
  async function showRows(t) {
    S.table = t; tab("data"); loadSchema().catch(() => {});
    try { const j = await api("/api/db/rows?" + q({ scope: S.scope, db: S.db, table: t, limit: 200 })); $("dbDataMsg").textContent = `${t}: ${j.total} row(s)${j.total > 200 ? " - the first 200" : ""}`; $("dbData").innerHTML = gridHtml(j.columns, j.rows); }
    catch (e) { $("dbDataMsg").textContent = "✗ " + e.message; $("dbData").innerHTML = ""; }
  }
  function results(out, r) {
    out.innerHTML = r.results.map((x) => x.ok ? (x.columns ? `<div class="dbres">✓ ${esc(x.sql.slice(0, 80))} - ${x.count} row(s)</div>${gridHtml(x.columns, x.rows)}` : `<div class="dbres">✓ ${esc(x.sql.slice(0, 120))}${x.affected ? ` - ${x.affected} row(s)` : ""}</div>`) : `<div class="dbres bad">✗ ${esc(x.sql.slice(0, 120))}<br>${esc(x.error)}</div>`).join("");
  }
  async function runSql(sql, out) {
    if (!S.db && S.scope !== "external") { msg("＋ make a database first", true); return null; }
    out.innerHTML = '<div class="dbres">⏳ running…</div>';
    try { const r = await api("/api/db/sql", { scope: S.scope, db: S.db, sql }); results(out, r); await loadSchema(); return r; }
    catch (e) { out.innerHTML = `<div class="dbres bad">✗ ${esc(e.message)}</div>`; return null; }
  }
  async function design(ask) {
    const a = String(ask || $("dbAsk").value || "").trim(); if (!a) { msg("say what the database is for", true); return null; }
    $("dbAsk").value = a; tab("design");
    if (!(await ready())) return null;
    if (!S.db) { const name = (a.toLowerCase().match(/\b(?:for|of)\s+(?:my|our|a|an|the)?\s*([a-z][a-z0-9 ]{2,30}?)(?:\s+with|\s+that|[,.]|$)/) || [])[1]; await newDb((name || "my_database").trim().replace(/\s+/g, "_").replace(/[^\w]/g, "").slice(0, 40) || "my_database"); }
    $("dbDesignMsg").textContent = "✨ the LLM is designing…"; $("dbExplain").textContent = ""; $("dbDesignOut").innerHTML = "";
    try {
      const r = await api("/api/db/ai", { scope: S.scope, db: S.db, ask: a });
      $("dbDesignSql").value = r.sql; $("dbExplain").textContent = r.explain + (r.left && r.left.length ? `\n(left out: ${r.left.join("; ")})` : "");
      $("dbDesignMsg").textContent = `${r.statements} statement(s) - read them, change them if you like, then ▶ Run`;
      return r;
    } catch (e) { $("dbDesignMsg").textContent = "✗ " + e.message; return null; }
  }
  async function newDb(name) {
    if (!name) { const i = $("dbNewName"); i.style.display = ""; i.value = ""; i.focus(); return; }   // (no window.prompt in the desktop app)
    const n = name;
    try { await api("/api/db/create", { scope: S.scope, name: n }); await loadDbs(n); msg(`＋ database ${n}`); } catch (e) { msg("✗ " + e.message, true); }
  }
  function openExt() {
    const d = $("dbExtDlg"), c = (S.status && S.status.external) || {};
    $("dbExtHost").value = c.host || ""; $("dbExtPort").value = c.port || 3306; $("dbExtUser").value = c.user || ""; $("dbExtDb").value = c.database || ""; $("dbExtPw").value = "";
    if (d && d.showModal) d.showModal();
  }
  function show() { const d = $("dbdock"); if (d && d.classList.contains("dockgone") && typeof root.toggleDockGone === "function") root.toggleDockGone("dbdock", "tX_dbdock"); }
  function wire() {
    const d = $("dbdock"); if (!d) return;
    try { if (root.localStorage.getItem("h3.g.dbdock") == null) { root.localStorage.setItem("h3.g.dbdock", "1"); d.classList.add("dockgone"); } } catch (e) { /* fine */ }
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    $("dbScope").value = S.scope;
    on("dbCloseBtn", "click", (e) => { e.stopPropagation(); if (typeof root.toggleDockGone === "function") root.toggleDockGone("dbdock", "tX_dbdock"); });
    on("dbScope", "change", (e) => { S.scope = e.target.value; store.set("scope", S.scope); S.db = ""; S.table = ""; loadDbs().catch((er) => msg("✗ " + er.message, true)); });
    on("dbStart", "click", () => api("/api/db/start", { scope: S.scope }).then(() => loadDbs(S.db)).catch((e) => { if (e.status === 409) ready().then((ok) => ok && loadDbs()); else msg("✗ " + e.message, true); }));
    on("dbStop", "click", () => api("/api/db/stop", { scope: S.scope }).then(refreshStatus).then(() => msg("⏹ stopped")).catch((e) => msg("✗ " + e.message, true)));
    on("dbDbSel", "change", (e) => { S.db = e.target.value; S.table = ""; loadSchema().catch((er) => msg("✗ " + er.message, true)); });
    on("dbNew", "click", () => ready().then((ok) => ok && newDb()));
    on("dbNewName", "keydown", (e) => { if (e.key === "Enter") { const v = e.target.value.trim(); e.target.style.display = "none"; if (v) newDb(v.replace(/\s+/g, "_")); } if (e.key === "Escape") e.target.style.display = "none"; });
    on("dbDrop", "click", async () => { if (!S.db || !root.confirm(`Delete the database "${S.db}" and everything in it?`)) return; try { await api("/api/db/drop", { scope: S.scope, name: S.db }); S.db = ""; await loadDbs(); msg("🗑 deleted"); } catch (e) { msg("✗ " + e.message, true); } });
    on("dbExtBtn", "click", openExt);
    on("dbExtSave", "click", async (e) => { e.preventDefault(); try { await api("/api/db/external", { host: $("dbExtHost").value, port: $("dbExtPort").value, user: $("dbExtUser").value, password: $("dbExtPw").value, database: $("dbExtDb").value }); $("dbExtDlg").close(); await loadDbs(); } catch (er) { msg("✗ " + er.message, true); } });
    on("dbNeedGo", "click", download);
    on("dbNeedNo", "click", () => { $("dbNeed").classList.remove("on"); if (needWait) { needWait(false); needWait = null; } msg("MariaDB not installed - ⚙ Your server works too"); });
    on("dbTabs", "click", (e) => { const b = e.target.closest("button[data-tab]"); if (b) tab(b.dataset.tab); });
    on("dbTables", "click", (e) => { const t = e.target.closest(".dbt"); if (t) showRows(t.dataset.t); });
    on("dbDesign", "click", () => design());
    on("dbDesignRun", "click", () => runSql($("dbDesignSql").value, $("dbDesignOut")));
    on("dbSqlRun", "click", () => runSql($("dbSql").value, $("dbSqlOut")));
    // when it is shown, it looks
    const look = () => { if (!d.classList.contains("dockgone") && !S.status) loadDbs().catch((e) => msg("✗ " + e.message, true)); };
    if (root.MutationObserver) new root.MutationObserver(look).observe(d, { attributes: true, attributeFilter: ["class"] });
    setTimeout(look, 500);
  }
  /* ---- the prompt docker */
  async function maybe(text) {
    const w = wants(text); if (!w) return null;
    show();
    const r = await design(w.ask);
    if (!r) return "🗄 the database design did not come - see the 🗄 Database docker";
    return `🗄 ${r.statements} statement(s) for the tables, fields and views are in the 🗄 Database docker (${S.scope === "project" ? "this project" : S.scope === "global" ? "global" : "your server"}, database ${S.db}) - read the SQL, then ▶ Run. ${r.explain}`;
  }
  root.H3ChatRoutes = [maybe].concat(root.H3ChatRoutes || []);
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire); else wire();
  root.H3Db = Object.assign({ design, runSql, loadDbs, ready, newDb, show, state: () => S }, pure);
})(typeof window !== "undefined" ? window : globalThis);
