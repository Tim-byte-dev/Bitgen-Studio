/* ext/imageeditdock/pccardlist.js — 2.896.0: 📇 a card per row of a list (a team's names) for the Business Card Sheet
 * (pccardsheet.js). The rows pasted from a spreadsheet / CSV (the first row = the column names); each column replaces a line of
 * the card's words - guessed from the business details the card was made with (lib/businessProfiles.js: name, role, phone, email,
 * website, company, address) or the line's look (an @ = the email, a run of digits = the phone, www / .com = the website), changed
 * by hand in the dialog. A "copies" column (copies / qty / how many) says how many of that person's cards.
 * Pure (Node: scripts/test-896.js): parseRows, fieldOf, cardLines, guessMap, applyRow, variants.
 * Tim (2026-11-19, PARKED item 4): "several different cards on one sheet (a team's names)" */
(function (root) {
  "use strict";
  const MAX_ROWS = 500;
  /** the column words -> a business-details field ("" = none of them; "copies" = how many cards) */
  const FIELD_WORDS = {
    copies: ["copies", "copy", "qty", "quantity", "how many", "count", "number of cards", "cards"],
    email: ["email", "e-mail", "mail", "email address"],
    phone: ["phone", "mobile", "mob", "tel", "telephone", "cell", "ph", "phone number", "direct"],
    website: ["website", "web", "url", "site", "web site", "homepage"],
    company: ["company", "business", "organisation", "organization", "firm", "company name", "business name"],
    address: ["address", "location", "office", "street"],
    role: ["role", "title", "job title", "position", "job", "jobtitle"],
    name: ["name", "full name", "fullname", "person", "staff", "employee", "staff member", "member", "first and last name"],
  };
  const norm = (s) => String(s == null ? "" : s).toLowerCase().replace(/[_.:]+/g, " ").replace(/\s+/g, " ").trim();
  function fieldOf(header) {
    const h = norm(header); if (!h) return "";
    for (const [k, words] of Object.entries(FIELD_WORDS)) if (words.includes(h)) return k;
    for (const [k, words] of Object.entries(FIELD_WORDS)) if (words.some((w) => w.length > 3 && h.includes(w))) return k;
    return "";
  }
  /** one CSV / TSV line in cells (quotes kept the spreadsheet way: "a, b" and "" for a quote) */
  function cells(line, sep) {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"' && !cur.trim()) { q = true; cur = ""; }
      else if (ch === sep) { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  }
  /** the pasted rows: tabs (pasted from a spreadsheet), else commas, else semicolons; the first row the column names ->
   *  {headers, rows} (empty lines skipped, short rows padded, at most MAX_ROWS) */
  function parseRows(text) {
    const lines = String(text == null ? "" : text).replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
    if (!lines.length) return { headers: [], rows: [] };
    const sep = lines.some((l) => l.includes("\t")) ? "\t" : lines[0].includes(",") ? "," : lines[0].includes(";") ? ";" : "\t";
    const headers = cells(lines[0], sep).map((h, i) => h || `Column ${i + 1}`);
    const rows = lines.slice(1, MAX_ROWS + 1).map((l) => { const c = cells(l, sep); while (c.length < headers.length) c.push(""); return c.slice(0, headers.length); })
      .filter((r) => r.some((v) => v));
    return { headers, rows, cut: Math.max(0, lines.length - 1 - MAX_ROWS) };
  }
  /** every line of words on the card's sides (each text layer split at its line ends), once each, in order */
  function cardLines(texts) {
    const seen = new Set(), out = [];
    for (const t of texts || []) for (const l of String(t == null ? "" : t).split("\n")) { const s = l.trim(); if (s && !seen.has(s)) { seen.add(s); out.push(s); } }
    return out;
  }
  const looks = {
    email: (l) => /\S+@\S+\.\S+/.test(l),
    phone: (l) => (l.match(/\d/g) || []).length >= 8 && (l.match(/[a-z]/gi) || []).length <= 4,
    website: (l) => !/@/.test(l) && /(^|\s)(www\.|https?:\/\/)|\.(com|net|org|au|nz|uk|io|co)(\/|\s|$)/i.test(l),
  };
  /** what each column replaces on the card: the business details' value where a line holds it (the value itself), else a line
   *  that looks like it (the whole line); "#copies" for the copies column; "" = nothing. Two columns never take the same words. */
  function guessMap(headers, lines, profile) {
    const p = profile || {}, used = new Set();
    return (headers || []).map((h) => {
      const k = fieldOf(h);
      if (k === "copies") return "#copies";
      if (!k) return "";
      const v = String(p[k] || "").trim();
      if (v) {
        // a field on one line of the card (or inside a longer one: "Tim Paul · Director")
        const line = lines.find((l) => l === v) || lines.find((l) => l.includes(v));
        if (line && !used.has(v)) { used.add(v); return v; }
      }
      if (looks[k]) { const line = lines.find((l) => looks[k](l) && !used.has(l)); if (line) { used.add(line); return line; } }
      return "";
    });
  }
  /** a card's words with this row's values: every place the mapped words stand, the row's value instead */
  function applyRow(str, pairs) {
    let s = String(str == null ? "" : str);
    for (const pr of pairs || []) if (pr && pr.find && s.includes(pr.find)) s = s.split(pr.find).join(pr.value == null ? "" : String(pr.value));
    return s;
  }
  /** the cards to make: one per row -> [{label, pairs: [{find, value}], copies}] (copies from the copies column, else `each`) */
  function variants(parsed, map, each) {
    const P = parsed || { headers: [], rows: [] }, m = map || [], dflt = Math.max(1, Math.min(500, Math.round(+each || 1)));
    const ci = m.indexOf("#copies");
    return P.rows.map((r, i) => {
      const pairs = []; m.forEach((find, j) => { if (find && find !== "#copies") pairs.push({ find, value: r[j] || "" }); });
      // its name in the preview: the first column that is not the copies (a list starts with the name), else any value
      const named = r.find((v, j) => v && m[j] !== "#copies") || `Row ${i + 1}`;
      const c = ci >= 0 ? Math.round(+String(r[ci]).replace(/[^\d.]/g, "")) : NaN;
      return { label: String(named).slice(0, 40), pairs, copies: c > 0 ? Math.min(500, c) : dflt };
    });
  }
  const PCCardList = { MAX_ROWS, FIELD_WORDS, fieldOf, parseRows, cardLines, guessMap, applyRow, variants };
  if (typeof module !== "undefined" && module.exports) module.exports = PCCardList;
  else if (root) root.PCCardList = PCCardList;
})(typeof window !== "undefined" ? window : globalThis);
