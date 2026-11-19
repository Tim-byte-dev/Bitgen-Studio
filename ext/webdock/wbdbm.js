/* bitGen Studio — ext/webdock/wbdbm.js (2.868.0): 🗄 the Web editor's DB manager tab (Tim: "add a db manager tab to web builder").
 *   which      the site's database (the one 🗂 CRM ▸ 🗄 linked) by default; ▾ any database of this project's MariaDB or your server
 *   tables     the list with their rows; a view marked 👁; a table's columns (type, key 🔑, link →) under its name
 *   rows       50 at a time (‹ ›), double-click a cell to change it (Enter keeps, Esc not; ∅ = NULL), ＋ Row (a form of its columns),
 *              🗑 a row (asked first) - by the primary key, parameterised on the server (lib/webDbAdmin.js); 🔍 filters the page shown
 *   ⌨ SQL      run statements (/api/db/sql - the results as tables, a DROP / DELETE / UPDATE / TRUNCATE / ALTER asked first)
 *   ⤓ / ⤒      a table as CSV / SQL, the whole database as .sql; a .sql file run into it
 * window.WbDbm = {paint, …}; danger() is pure. */
(function (root) {
  "use strict";
  const DANGER = /\b(drop|truncate|delete|update|alter|rename|grant|revoke)\b/i;
  const danger = (sql) => DANGER.test(String(sql || "").replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`[^`]*`/g, ""));
  if (typeof module !== "undefined" && module.exports && typeof window === "undefined") { module.exports = { danger }; return; }
  const doc = root.document, $ = (id) => doc.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const S = { scope: "", db: "", info: null, table: "", off: 0, page: null, find: "", built: false };
  async function api(u, body) {
    const r = await root.fetch(u, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
    const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw Object.assign(new Error(j.error || "HTTP " + r.status), { status: r.status }); return j;
  }
  const say = (t, err) => { const o = $("wbDbmOut"); if (o) { o.textContent = t || ""; o.classList.toggle("err", !!err); } };
  const q = () => `scope=${encodeURIComponent(S.scope)}&db=${encodeURIComponent(S.db)}`;
  function build() {
    const p = $("wbDbm"); if (!p || S.built) return; S.built = true;
    p.innerHTML = `<div class="wbbar"><b>🗄 Database</b><select id="wbDbmPick" title="Which database"></select><button class="ghost" type="button" id="wbDbmRe" title="Read it again">⟳</button>
<span class="sep"></span><button class="ghost" type="button" id="wbDbmSqlB" title="Run SQL">⌨ SQL</button><button class="ghost" type="button" id="wbDbmDump" title="The whole database as a .sql file">⤓ .sql</button>
<label class="ghost wbDbmImp" title="Run a .sql file into this database">⤒ .sql<input type="file" id="wbDbmImp" accept=".sql,text/plain" hidden></label><span id="wbDbmOut"></span></div>
<div id="wbDbmSql" hidden><textarea id="wbDbmSqlT" rows="4" spellcheck="false" placeholder="SELECT * FROM clients WHERE email LIKE '%@example.com'; - Ctrl+Enter runs"></textarea><div class="wbbar"><button class="go" type="button" id="wbDbmRun">▶ Run</button><span style="font-size:11px;color:var(--dim)">Statements that remove or change tables are asked first.</span></div><div id="wbDbmRes"></div></div>
<div id="wbDbmBody"><div id="wbDbmTables"></div><div id="wbDbmMain"><div id="wbDbmNone">Pick a table on the left.</div></div></div>`;
    $("wbDbmPick").addEventListener("change", (e) => { const [s, d] = e.target.value.split("|"); S.scope = s; S.db = d; S.table = ""; load(); });
    $("wbDbmRe").addEventListener("click", () => load());
    $("wbDbmSqlB").addEventListener("click", () => { const b = $("wbDbmSql"); b.hidden = !b.hidden; if (!b.hidden) $("wbDbmSqlT").focus(); });
    $("wbDbmRun").addEventListener("click", runSql);
    $("wbDbmSqlT").addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runSql(); } });
    $("wbDbmDump").addEventListener("click", () => { if (S.db) root.location.assign(`/api/web/dbm/export?${q()}`); });
    $("wbDbmImp").addEventListener("change", importFile);
    $("wbDbmTables").addEventListener("click", (e) => { const t = e.target.closest("[data-t]"); if (t) { S.table = t.dataset.t; S.off = 0; S.find = ""; rows(); paintTables(); } });
  }
  async function pickList() {
    const sel = $("wbDbmPick"), opts = [];
    let link = null; try { link = (await api("/api/web/db")); } catch (e) { /* none */ }
    for (const scope of ["project", "external"]) { try { const r = await api("/api/db/databases?scope=" + scope); r.databases.forEach((d) => opts.push([scope, d])); } catch (e) { /* not there */ } }
    if (link && link.linked && !opts.some(([s, d]) => s === link.scope && d === link.name)) opts.unshift([link.scope, link.name]);
    if (!S.db && link && link.linked) { S.scope = link.scope; S.db = link.name; }
    if (!S.db && opts.length) { S.scope = opts[0][0]; S.db = opts[0][1]; }
    sel.innerHTML = opts.map(([s, d]) => `<option value="${esc(s + "|" + d)}">${s === "external" ? "🌐" : "💻"} ${esc(d)}${link && link.linked && link.name === d && link.scope === s ? " (the site's)" : ""}</option>`).join("") || '<option value="">no databases</option>';
    sel.value = S.scope + "|" + S.db;
  }
  async function load() {
    say("reading…");
    try {
      await pickList();
      if (!S.db) { $("wbDbmTables").innerHTML = ""; $("wbDbmMain").innerHTML = '<div id="wbDbmNone">No database yet - 🗂 CRM ▸ 🗄 Create the site\'s database.</div>'; return say(""); }
      S.info = await api(`/api/web/dbm?${q()}`);
      if (S.table && !S.info.tables.some((t) => t.name === S.table)) S.table = "";
      paintTables(); if (S.table) await rows(); else $("wbDbmMain").innerHTML = '<div id="wbDbmNone">Pick a table on the left.</div>';
      say(`${S.info.tables.length} table(s) in ${S.db}`);
    } catch (e) { say("✗ " + e.message, true); }
  }
  function paintTables() {
    const T = (S.info && S.info.tables) || [];
    $("wbDbmTables").innerHTML = T.map((t) => `<div class="it${t.name === S.table ? " on" : ""}" data-t="${esc(t.name)}" title="${esc(t.columns.map((c) => c.name + " " + c.type).join("\n"))}">${t.kind === "view" ? "👁" : "▦"} ${esc(t.name)}<span>${t.rows == null ? "" : t.rows}</span></div>`).join("");
  }
  const tableInfo = () => S.info && S.info.tables.find((t) => t.name === S.table);
  async function rows() {
    const T = tableInfo(); if (!T) return;
    try { S.page = await api(`/api/db/rows?${q()}&table=${encodeURIComponent(S.table)}&limit=50&offset=${S.off}`); } catch (e) { return say("✗ " + e.message, true); }
    paintRows();
  }
  const keyCols = () => { const T = tableInfo(); return T ? T.columns.filter((c) => c.key === "PRI").map((c) => c.name) : []; };
  function paintRows() {
    const T = tableInfo(), P = S.page, pk = keyCols(), edit = T.kind === "table" && pk.length;
    const cols = P.columns.length ? P.columns : T.columns.map((c) => c.name), f = S.find.toLowerCase();
    const shown = P.rows.map((r, i) => [r, i]).filter(([r]) => !f || cols.some((c) => String(r[c] == null ? "" : r[c]).toLowerCase().includes(f)));
    const head = T.columns.map((c) => `<span class="col" title="${esc(c.type + (c.null ? "" : " NOT NULL") + (c.default != null ? " DEFAULT " + c.default : "") + (c.extra ? " " + c.extra : ""))}">${c.key === "PRI" ? "🔑 " : ""}${esc(c.name)}${c.ref ? ` → ${esc(c.ref)}` : ""} <i>${esc(c.type)}</i></span>`).join("");
    $("wbDbmMain").innerHTML = `<div class="wbbar"><b>${T.kind === "view" ? "👁" : "▦"} ${esc(T.name)}</b><span style="font-size:11px;color:var(--dim)">${P.total} row(s)${edit ? " · double-click a cell to change it" : T.kind === "view" ? " · a view (read only)" : " · no primary key: change it with ⌨ SQL"}</span>
<input id="wbDbmFind" placeholder="🔍 in this page" value="${esc(S.find)}" style="max-width:160px">${edit ? '<button class="ghost" type="button" id="wbDbmAdd">＋ Row</button>' : ""}
<button class="ghost" type="button" id="wbDbmCsv" title="This table as CSV">⤓ CSV</button><button class="ghost" type="button" id="wbDbmTsql" title="This table as SQL">⤓ SQL</button>
<span style="margin-left:auto"></span><button class="ghost" type="button" id="wbDbmPrev"${S.off ? "" : " disabled"}>‹</button><span style="font-size:11px">${P.total ? S.off + 1 : 0}-${Math.min(P.total, S.off + 50)}</span><button class="ghost" type="button" id="wbDbmNext"${S.off + 50 < P.total ? "" : " disabled"}>›</button></div>
<div class="wbDbmCols">${head}</div><div id="wbDbmAddForm" hidden></div>
<div class="wbDbmGrid"><table><tr>${edit ? "<th></th>" : ""}${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>${shown.map(([r, i]) => `<tr data-i="${i}">${edit ? `<td><button class="ghost" type="button" data-del="${i}" title="Delete this row">🗑</button></td>` : ""}${cols.map((c) => `<td data-c="${esc(c)}"${r[c] == null ? ' class="nul"' : ""}>${r[c] == null ? "∅" : esc(typeof r[c] === "object" ? JSON.stringify(r[c]) : r[c])}</td>`).join("")}</tr>`).join("")}</table></div>`;
    const m = $("wbDbmMain");
    $("wbDbmFind").addEventListener("input", (e) => { S.find = e.target.value; const pos = e.target.selectionStart; paintRows(); const n = $("wbDbmFind"); n.focus(); n.setSelectionRange(pos, pos); });
    $("wbDbmFind").addEventListener("keydown", (e) => e.stopPropagation());
    $("wbDbmPrev").addEventListener("click", () => { S.off = Math.max(0, S.off - 50); rows(); });
    $("wbDbmNext").addEventListener("click", () => { S.off += 50; rows(); });
    $("wbDbmCsv").addEventListener("click", () => root.location.assign(`/api/web/dbm/export?${q()}&table=${encodeURIComponent(T.name)}&format=csv`));
    $("wbDbmTsql").addEventListener("click", () => root.location.assign(`/api/web/dbm/export?${q()}&table=${encodeURIComponent(T.name)}&format=sql`));
    if (!edit) return;
    $("wbDbmAdd").addEventListener("click", addForm);
    m.querySelector(".wbDbmGrid").addEventListener("dblclick", (e) => { const td = e.target.closest("td[data-c]"); if (td) editCell(td); });
    m.querySelector(".wbDbmGrid").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-del]"); if (!b) return;
      const r = S.page.rows[+b.dataset.del], key = {}; pk.forEach((c) => { key[c] = r[c]; });
      if (!root.confirm(`Delete the row ${pk.map((c) => c + " = " + r[c]).join(", ")} from ${T.name}?`)) return;
      try { await api("/api/web/dbm/delete", { scope: S.scope, db: S.db, table: T.name, key }); say("🗑 deleted"); await rows(); refreshCount(-1); } catch (er) { say("✗ " + er.message, true); }
    });
  }
  function refreshCount(d) { const T = tableInfo(); if (T && T.rows != null) { T.rows = Math.max(0, T.rows + d); paintTables(); } }
  function editCell(td) {
    if (td.querySelector("input")) return;
    const tr = td.closest("tr"), r = S.page.rows[+tr.dataset.i], col = td.dataset.c, pk = keyCols(), old = r[col];
    const inp = doc.createElement("input"); inp.value = old == null ? "" : typeof old === "object" ? JSON.stringify(old) : String(old); inp.className = "wbDbmIn";
    const nul = doc.createElement("button"); nul.type = "button"; nul.className = "ghost"; nul.textContent = "∅"; nul.title = "Make it NULL";
    td.textContent = ""; td.appendChild(inp); td.appendChild(nul); inp.focus(); inp.select();
    let done = false;
    const keep = async (val) => {
      if (done) return; done = true;
      if (val === (old == null ? null : String(old))) return paintRows();
      const key = {}; pk.forEach((c) => { key[c] = r[c]; });
      try { await api("/api/web/dbm/cell", { scope: S.scope, db: S.db, table: S.table, key, col, value: val }); r[col] = val; say(`✓ ${col} changed`); if (pk.includes(col)) await rows(); else paintRows(); }
      catch (e) { say("✗ " + e.message, true); paintRows(); }
    };
    inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") keep(inp.value); if (e.key === "Escape") { done = true; paintRows(); } });
    inp.addEventListener("blur", () => setTimeout(() => { if (!done && doc.activeElement !== nul) keep(inp.value); }, 120));
    nul.addEventListener("mousedown", (e) => e.preventDefault()); nul.addEventListener("click", () => keep(null));
  }
  function addForm() {
    const T = tableInfo(), f = $("wbDbmAddForm"); if (!f.hidden) { f.hidden = true; return; }
    f.innerHTML = T.columns.map((c) => `<label><span>${esc(c.name)}</span><input data-col="${esc(c.name)}" placeholder="${esc(/auto_increment/i.test(c.extra) ? "(made by the database)" : c.default != null ? "default " + c.default : c.null ? "empty = NULL" : c.type)}"></label>`).join("") + '<div class="wbbar"><button class="go" type="button" id="wbDbmAddGo">＋ Add the row</button><button class="ghost" type="button" id="wbDbmAddNo">Cancel</button></div>';
    f.hidden = false; f.querySelectorAll("input").forEach((i) => i.addEventListener("keydown", (e) => e.stopPropagation()));
    $("wbDbmAddNo").addEventListener("click", () => { f.hidden = true; });
    $("wbDbmAddGo").addEventListener("click", async () => {
      const values = {}; f.querySelectorAll("input[data-col]").forEach((i) => { if (i.value !== "") values[i.dataset.col] = i.value; });
      try { const r = await api("/api/web/dbm/insert", { scope: S.scope, db: S.db, table: T.name, values }); say("＋ added" + (r.insertId ? " (id " + r.insertId + ")" : "")); f.hidden = true; await rows(); refreshCount(1); }
      catch (e) { say("✗ " + e.message, true); }
    });
  }
  async function runSql() {
    const sql = $("wbDbmSqlT").value.trim(); if (!sql || !S.db) return;
    if (danger(sql) && !root.confirm("This SQL removes or changes things in " + S.db + " (DROP / DELETE / TRUNCATE / ALTER …). Run it?")) return;
    $("wbDbmRun").disabled = true;
    try {
      const r = await api("/api/db/sql", { scope: S.scope, db: S.db, sql });
      $("wbDbmRes").innerHTML = r.results.map((x) => !x.ok ? `<div class="err">✗ ${esc(x.error)}<br><code>${esc(x.sql.slice(0, 300))}</code></div>`
        : x.columns ? `<div>✓ ${x.count} row(s)</div><div class="wbDbmGrid"><table><tr>${x.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>${x.rows.slice(0, 200).map((rw) => `<tr>${x.columns.map((c) => `<td${rw[c] == null ? ' class="nul"' : ""}>${rw[c] == null ? "∅" : esc(typeof rw[c] === "object" ? JSON.stringify(rw[c]) : rw[c])}</td>`).join("")}</tr>`).join("")}</table></div>`
        : `<div>✓ ${x.affected} row(s) changed${x.insertId ? " · id " + x.insertId : ""}</div>`).join("");
      say("⌨ ran " + r.results.length + " statement(s)"); S.info = await api(`/api/web/dbm?${q()}`); paintTables(); if (S.table) rows();
    } catch (e) { $("wbDbmRes").innerHTML = `<div class="err">✗ ${esc(e.message)}</div>`; }
    $("wbDbmRun").disabled = false;
  }
  async function importFile(e) {
    const file = e.target.files[0]; e.target.value = ""; if (!file || !S.db) return;
    if (!root.confirm(`Run ${file.name} into ${S.db}? It may replace tables of the same name.`)) return;
    say("⤒ running " + file.name + "…");
    try { const r = await api("/api/web/dbm/import", { scope: S.scope, db: S.db, sql: await file.text() }); say(r.ok ? `⤒ ${r.done} statement(s) run` : `✗ stopped at ${r.done + 1} of ${r.total}: ${r.error}`, !r.ok); await load(); }
    catch (er) { say("✗ " + er.message, true); }
  }
  function paint() { build(); load(); }
  root.WbDbm = { paint, load, danger, state: () => S };
  // the tab may already be open (kept from last time) before this file loaded
  const first = () => { const p = $("wbDbm"); if (p && p.classList.contains("on") && !S.built) paint(); };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", () => setTimeout(first, 600)); else setTimeout(first, 600);
})(typeof window !== "undefined" ? window : globalThis);
