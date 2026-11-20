/* pcbizinfo.js — THE BUSINESS DETAILS DIALOG (2.875.0), window.PCBizInfo -> E.bizInfo.
 * Tim (verbatim): "when user clicks image-edit ai template business card, letterhead,flyer,poster the get user details, name of
 * comany, name, address, phone number, list of services provided. company logo (image) , brand colors, description of card user
 * would like front and description of card back - this will be in a new dialog ... save all the contact information to a json
 * file for now, later we will add it to mariadb"
 *   dialog(kind, {ask, pictures})  the box: your saved details (▾, 🗑), company, your name, role, address, phone, email, website,
 *                                  services (one a line), the logo (a picture, shown), brand colours (up to three, ticked), the front
 *                                  (and for a card / flyer the back) described; ✨ Create keeps the details (POST /api/business/profiles
 *                                  - lib/businessProfiles.js, a JSON file) and makes it (E.create.make with the business)
 *   2.876.0: a card's box has Card size ▾ (Cardboard / paper by country, PVC CR80 / CR79 / CR90 / CR100) - kept with the
 *                                  details (card_size) and made at that size
 *   2.897.0: 🗄 Where they are kept… - this computer (the file), bitGen's own MariaDB or your database server (shared with your other
 *                                  computers) - lib/businessDb.js via /api/business/store; ⟳ Sync; the line says where + when synced
 *   last() -> Promise<profile | null>   the details used last (the prompt docker's "make a business card …")
 * Pure (Node: scripts/test-875.js): fromForm(values) -> {profile}, sideLabels(kind) */
(function (root) {
  "use strict";
  const TITLES = { card: "💳 Business card", letterhead: "✉ Letterhead", flyer: "📰 Flyer", poster: "🪧 Poster" };
  /** what the front / back boxes are called for a kind (null = no back) */
  function sideLabels(kind) {
    if (kind === "card") return { front: "Front of the card - what it should look like and say (its background is made from this)", back: "Back of the card - what it should look like and say (its background is made from this)" };
    if (kind === "flyer") return { front: "Front - what the flyer should look like and say", back: "Back - leave empty for a one-sided flyer" };
    if (kind === "letterhead") return { front: "The letterhead - how it should look (layout, mood, what to show)", back: null };
    return { front: "The poster - what it is for and how it should look", back: null };
  }
  /** the form's values -> the profile sent (colours only the ticked ones, services one a line) */
  function fromForm(v) {
    const o = v || {}, t = (x) => String(x == null ? "" : x).trim();
    return { id: t(o.id) || undefined, company: t(o.company), name: t(o.name), role: t(o.role), address: t(o.address), phone: t(o.phone),
      email: t(o.email), website: t(o.website), abn: t(o.abn), services: t(o.services).split(/\r?\n/).map(t).filter(Boolean),
      colours: (o.colours || []).filter((c) => c && c.on && /^#[0-9a-f]{6}$/i.test(c.hex)).map((c) => c.hex.toLowerCase()), front: t(o.front), back: t(o.back),
      card_size: /^[a-z0-9-]{1,24}$/.test(t(o.card_size)) ? t(o.card_size) : "" };
  }
  /** 2.876.0: the Card size ▾ - <optgroup>s Cardboard / paper + PVC (plastic) of pccreate.js's CARD_SIZES, `sel` chosen */
  function sizeOptions(sizes, groups, sel, esc0, tr0) {
    const e = esc0 || ((x) => String(x)), tr = tr0 || ((x) => x), list = sizes || [], pick = list.some((c) => c.id === sel) ? sel : (list[0] || {}).id;
    return Object.keys(groups || {}).map((g) => `<optgroup label="${e(tr(groups[g]))}">${list.filter((c) => c.group === g)
      .map((c) => `<option value="${e(c.id)}"${c.id === pick ? " selected" : ""}>${e(c.label)} - ${+c.wmm.toFixed(1)} × ${+c.hmm.toFixed(1)} mm</option>`).join("")}</optgroup>`).join("");
  }
  const pure = { sideLabels, fromForm, sizeOptions, TITLES };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  function install(E) {
    const { doc, win } = E, say = E.say || (() => {});
    if (!E.ui || !E.ui.dialog) return;
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const getJ = (u) => win.fetch(u).then((r) => r.json());
    let cache = null;
    const load = () => getJ("/api/business/profiles").then((j) => { cache = j || { profiles: [], last: "" }; return cache; });
    async function last() { const j = cache || await load(); return (j.profiles || []).find((p) => p.id === j.last) || null; }
    const DEF = ["#1f6feb", "#f5f7fa", "#1f2933"];
    /** an <optgroup label> in the UI language (the page translator only turns text, titles and placeholders) */
    const uiWord = (s) => { try { const L = win.H3UiLang, st = L && L.state(); const t = st && st.dict && L.tr(s, st.dict, st.pats); return t || s; } catch (e) { return s; } };
    function dialog(kind, o) {
      const opt = o || {}, k = TITLES[kind] ? kind : "card", side = sideLabels(k);
      const PC = win.PCCreate || {}, store = E.store || { get: (a, d) => d, set: () => {} };
      const fld = (id, label, ph, type) => `<label class="pcbz-f"><span>${esc(label)}</span><input id="${id}" type="${type || "text"}" placeholder="${esc(ph || "")}" autocomplete="off"></label>`;
      const html = `<div class="pcbz">
        ${k === "card" && PC.CARD_SIZES ? `<div class="kxrow pcbz-size"><span>Card size</span><select id="pcbzSize" style="flex:1">${sizeOptions(PC.CARD_SIZES, PC.CARD_GROUPS, store.get("create.cardSize", ""), esc, uiWord)}</select></div>` : ""}
        <div class="kxrow"><span>Saved details</span><select id="pcbzPick" style="flex:1"><option value="">＋ New details</option></select><button class="ghost" id="pcbzDel" type="button" title="Delete these saved details" hidden>🗑</button></div>
        <div class="pcbz-g">
          ${fld("pcbzCompany", "Company name", "Rosie's Bakery")}${fld("pcbzName", "Your name", "Rosie Smith")}
          ${fld("pcbzRole", "Role / title", "Owner - head baker")}${fld("pcbzPhone", "Phone number", "0412 345 678", "tel")}
          ${fld("pcbzEmail", "Email", "hello@rosiesbakery.com.au", "email")}${fld("pcbzWeb", "Website", "rosiesbakery.com.au")}
          ${fld("pcbzAbn", "ABN (for tax invoices)", "51 824 753 556")}
          <label class="pcbz-f pcbz-w"><span>Address</span><textarea id="pcbzAddr" rows="2" placeholder="12 Main Street, Springfield QLD 4300"></textarea></label>
          <label class="pcbz-f pcbz-w"><span>Services - one a line</span><textarea id="pcbzServ" rows="4" placeholder="Sourdough and rye breads&#10;Celebration cakes&#10;Wholesale to cafes"></textarea></label>
        </div>
        <div class="kxrow pcbz-logo"><span>Company logo</span><span class="pcbz-lp" id="pcbzLogoPv">no logo</span>
          <button class="ghost" id="pcbzLogoBtn" type="button">📂 Choose…</button><button class="ghost" id="pcbzLogoNo" type="button" title="No logo" hidden>✕</button>
          <input type="file" id="pcbzLogoFile" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" style="display:none"></div>
        <div class="kxrow pcbz-cols"><span>Brand colours</span>${[0, 1, 2].map((i) => `<label class="pcbz-c"><input type="checkbox" id="pcbzCon${i}"><input type="color" id="pcbzCol${i}" value="${DEF[i]}"></label>`).join("")}<span class="pcbz-dim">the first is the main colour</span></div>
        <label class="pcbz-f pcbz-w"><span>${esc(side.front)}</span><textarea id="pcbzFront" rows="3" placeholder="Clean and warm, cream with the logo top left, my name big, the phone and email under it"></textarea></label>
        ${side.back ? `<label class="pcbz-f pcbz-w"><span>${esc(side.back)}</span><textarea id="pcbzBack" rows="3" placeholder="The logo in the middle on our main colour, the services under it"></textarea></label>` : ""}
        ${k === "card" ? `<div class="kxrow"><label title="Each side's background made from its description above with the prompt docker's image style - the words and logo go over it as layers"><input type="checkbox" id="pcbzBgs"${store.get("create.cardBgs", "1") === "1" ? " checked" : ""}> 🖼 Backgrounds - made from the front and back descriptions</label></div>` : ""}
        ${k === "flyer" || k === "poster" ? `<div class="kxrow"><label><input type="checkbox" id="pcbzPics"${opt.pictures ? " checked" : ""}> 🖼 Pictures - made with the prompt docker's image style</label></div>` : ""}
        <div class="kxrow pcbz-store"><span class="pcbz-dim" id="pcbzWhere">Kept on this computer for next time (business/profiles.json).</span><button class="ghost" id="pcbzStoreBtn" type="button" title="Keep the details on this computer, in bitGen's own database or on your database server (shared with your other computers)">🗄 Where they are kept…</button>
          <button class="ghost" id="pcbzSync" type="button" title="Send what waits and get the database's details now" hidden>⟳ Sync</button></div>
        <div class="pcbz-storebox" id="pcbzStore" hidden>
          <label><input type="radio" name="pcbzWhereR" value="file"> 📁 On this computer only (a file)</label>
          <label><input type="radio" name="pcbzWhereR" value="global"> 🗄 In bitGen's own database (MariaDB on this computer)</label>
          <label><input type="radio" name="pcbzWhereR" value="external"> 🌐 On your database server - shared with your other computers (set it up in 🗄 Database on the top bar)</label>
          <div class="kxrow"><span>Database</span><input id="pcbzDbName" value="bitgen_business" style="width:180px" autocomplete="off"><button class="ghost" id="pcbzMove" type="button">✔ Keep them there</button></div>
          <div class="pcbz-dim" id="pcbzStoreMsg">Your details stay on this computer as well, so invoices and cards work when the database does not answer; changes made then go to the database when it answers.</div>
        </div>
        <div class="pcbz-dim">The LLM writes the words around them; your details are used exactly.</div>
      </div>`;
      let logoData = "", dropLogo = false, cur = null;
      const d = E.ui.dialog(TITLES[k] + " - your business details", html, (dd) => {
        const v = (id) => dd.querySelector("#" + id);
        const prof = fromForm({ id: cur ? cur.id : "", company: v("pcbzCompany").value, name: v("pcbzName").value, role: v("pcbzRole").value, address: v("pcbzAddr").value,
          phone: v("pcbzPhone").value, email: v("pcbzEmail").value, website: v("pcbzWeb").value, abn: v("pcbzAbn").value, services: v("pcbzServ").value,
          colours: [0, 1, 2].map((i) => ({ on: v("pcbzCon" + i).checked, hex: v("pcbzCol" + i).value })), front: v("pcbzFront").value, back: v("pcbzBack") ? v("pcbzBack").value : "",
          card_size: v("pcbzSize") ? v("pcbzSize").value : (cur && cur.card_size) || "" });
        if (!prof.company && !prof.name) { say("✨ give the company's name or your name"); v("pcbzCompany").focus(); return false; }
        const pics = !!(v("pcbzPics") && v("pcbzPics").checked);
        win.fetch("/api/business/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: prof, logo: logoData || undefined, drop_logo: dropLogo }) })
          .then((r) => r.json().then((j) => { if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; }))
          .then((saved) => { cache = null; say((saved.store && saved.store.offline ? "✨ your details are kept on this computer (the database did not answer - they go there when it does)" : "✨ your details are kept") + " - making the " + TITLES[k].replace(/^\S+ /, "").toLowerCase() + "…");
            if (v("pcbzSize")) store.set("create.cardSize", v("pcbzSize").value);
            const bgs = v("pcbzBgs") ? v("pcbzBgs").checked : undefined;
            if (bgs != null) store.set("create.cardBgs", bgs ? "1" : "0");
            return E.create.make({ kind: k, ask: opt.ask || "", pictures: pics, business: saved, cardSize: v("pcbzSize") ? v("pcbzSize").value : undefined, backgrounds: bgs }); })
          .then((m) => m && say(m)).catch((e) => say("✨ " + e.message));
      }, { okLabel: "✨ Create", wide: true, width: "min(860px, 96vw)", scroll: true, init: (dd) => {
        const v = (id) => dd.querySelector("#" + id);
        const paintLogo = (url) => { const pv = v("pcbzLogoPv"); pv.innerHTML = url ? `<img src="${esc(url)}" alt="the logo">` : "no logo"; v("pcbzLogoNo").hidden = !url; };
        const fill = (p) => {
          cur = p || null; logoData = ""; dropLogo = false;
          const P = p || {};
          [["pcbzCompany", "company"], ["pcbzName", "name"], ["pcbzRole", "role"], ["pcbzPhone", "phone"], ["pcbzEmail", "email"], ["pcbzWeb", "website"], ["pcbzAbn", "abn"], ["pcbzAddr", "address"], ["pcbzFront", "front"], ["pcbzBack", "back"]]
            .forEach(([id, key]) => { if (v(id)) v(id).value = P[key] || ""; });
          v("pcbzServ").value = (P.services || []).join("\n");
          [0, 1, 2].forEach((i) => { const c = (P.colours || [])[i]; v("pcbzCon" + i).checked = !!c; v("pcbzCol" + i).value = c || DEF[i]; });
          paintLogo(P.logo_url || ""); v("pcbzDel").hidden = !p;
          if (v("pcbzSize") && P.card_size && [...v("pcbzSize").options].some((x) => x.value === P.card_size)) v("pcbzSize").value = P.card_size;   // 2.876.0: their size
        };
        [0, 1, 2].forEach((i) => v("pcbzCol" + i).addEventListener("input", () => { v("pcbzCon" + i).checked = true; }));
        v("pcbzLogoBtn").onclick = () => { v("pcbzLogoFile").value = ""; v("pcbzLogoFile").click(); };
        v("pcbzLogoFile").onchange = () => {
          const f = v("pcbzLogoFile").files[0]; if (!f) return;
          if (f.size > 10 * 1024 * 1024) { say("✨ the logo is over 10 MB"); return; }
          const fr = new win.FileReader(); fr.onload = () => { logoData = String(fr.result); dropLogo = false; paintLogo(logoData); }; fr.readAsDataURL(f);
        };
        v("pcbzLogoNo").onclick = () => { logoData = ""; dropLogo = true; paintLogo(""); };
        v("pcbzPick").onchange = () => fill((cache.profiles || []).find((p) => p.id === v("pcbzPick").value) || null);
        v("pcbzDel").onclick = () => {
          if (!cur) return;
          const go = typeof win.appConfirm === "function" ? win.appConfirm("Delete the saved details of " + (cur.company || cur.name) + "?", "Delete") : Promise.resolve(true);
          Promise.resolve(go).then((ok) => { if (!ok) return; return win.fetch("/api/business/profiles/" + encodeURIComponent(cur.id), { method: "DELETE" }).then(() => load()).then(paintPick).then(() => fill(null)); });
        };
        const paintPick = (j) => {
          const s = v("pcbzPick"); s.innerHTML = '<option value="">＋ New details</option>';
          (j.profiles || []).forEach((p) => { const op = doc.createElement("option"); op.value = p.id; op.textContent = [p.company, p.name].filter(Boolean).join(" - "); s.appendChild(op); });
          return j;
        };
        // 2.897.0: where the details are kept (lib/businessDb.js) - this computer, bitGen's own MariaDB or your server
        const when = (t) => { try { return t ? new Date(t).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""; } catch (e) { return ""; } };
        const paintStore = (st) => {
          if (!st) return;
          const w = v("pcbzWhere"), msg = [];
          msg.push(st.mode === "db" ? `🗄 Kept ${st.where}${st.lastSync ? ` · synced ${when(st.lastSync)}` : ""}.` : "Kept on this computer for next time (business/profiles.json).");
          if (st.offline) msg.push(`⚠ the database did not answer (${st.offline}) - kept on this computer${st.waiting ? `, ${st.waiting} change${st.waiting > 1 ? "s" : ""} waiting to go there` : ""}.`);
          (st.notes || []).forEach((n) => msg.push("⚠ " + n));
          w.textContent = msg.join(" "); w.style.color = st.offline ? "var(--pc-warn, #e0a030)" : "";
          v("pcbzSync").hidden = st.mode !== "db";
          const r = st.mode === "db" ? st.scope : "file"; dd.querySelectorAll('input[name="pcbzWhereR"]').forEach((x) => { x.checked = x.value === r; });
          if (st.db) v("pcbzDbName").value = st.db;
        };
        const keepSel = (j) => { const id = cur ? cur.id : ""; paintPick(j); if (id && (j.profiles || []).some((p) => p.id === id)) { v("pcbzPick").value = id; fill(j.profiles.find((p) => p.id === id)); } else if (id) fill(null); paintStore(j.store); return j; };
        v("pcbzStoreBtn").onclick = () => { v("pcbzStore").hidden = !v("pcbzStore").hidden; };
        v("pcbzSync").onclick = () => { v("pcbzSync").disabled = true; load().then(keepSel).then((j) => say(j.store && j.store.offline ? "🗄 the database did not answer - " + j.store.offline : "🗄 synced with the database")).catch((e) => say("🗄 " + e.message)).finally(() => { v("pcbzSync").disabled = false; }); };
        v("pcbzMove").onclick = () => {
          const pick = (dd.querySelector('input[name="pcbzWhereR"]:checked') || {}).value || "file", m = v("pcbzStoreMsg");
          const body = pick === "file" ? { mode: "file" } : { mode: "db", scope: pick, db: v("pcbzDbName").value.trim() };
          v("pcbzMove").disabled = true; m.textContent = pick === "file" ? "📁 bringing them back to this computer…" : "🗄 starting the database and moving them there…";
          win.fetch("/api/business/store", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
            .then((r) => r.json().then((j) => { if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; }))
            .then((j) => { m.textContent = j.moved === "file" ? "📁 kept on this computer only now (the database keeps its copy)." : `🗄 kept ${j.where} now - ${j.sent} sent from this computer${j.had ? `, ${j.had} were there already` : ""}.`; cache = null; return load().then(keepSel); })
            .then(() => say("🗄 " + m.textContent.replace(/^\S+ /, "")))
            .catch((e) => { m.textContent = "⚠ " + e.message; say("🗄 " + e.message); }).finally(() => { v("pcbzMove").disabled = false; });
        };
        load().then(paintPick).then((j) => { const p = (j.profiles || []).find((x) => x.id === j.last) || null; if (p) { v("pcbzPick").value = p.id; } fill(p); paintStore(j.store); if (opt.ask && !v("pcbzFront").value) v("pcbzFront").value = opt.ask; })
          .catch(() => fill(null));
        setTimeout(() => v("pcbzCompany").focus(), 0);
      } });
      return d;
    }
    const css = doc.createElement("style");
    // 2.893.0 (Tim: "make the dialog wider, the input boxes go past the dialog frame"): the dialog is 860 px (pcui width), the
    // grid's columns may shrink (minmax(0, 1fr) - an input's own width no longer pushes them out), every row wraps
    css.textContent = ".pcbz{display:flex;flex-direction:column;gap:7px;min-width:0;max-width:100%;box-sizing:border-box}.pcbz-g{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px 12px}"
      + ".pcbz .kxrow{flex-wrap:wrap;min-width:0}.pcbz .kxrow select{min-width:0;max-width:100%}.pcbz textarea{resize:vertical}"
      + ".pcbz-f{display:flex;flex-direction:column;gap:2px;font-size:11px;min-width:0}.pcbz-f>span{color:var(--pc-dim)}.pcbz-f input,.pcbz-f textarea{width:100%;box-sizing:border-box}.pcbz-w{grid-column:1/-1}"
      + ".pcbz-lp{display:inline-flex;align-items:center;min-width:60px;height:44px;padding:2px 6px;border:1px dashed var(--pc-line);border-radius:6px;color:var(--pc-dim);font-size:11px}.pcbz-lp img{max-height:40px;max-width:160px}"
      + ".pcbz-storebox{display:flex;flex-direction:column;gap:4px;padding:6px 8px;border:1px solid var(--pc-line);border-radius:6px}.pcbz-storebox label{display:flex;gap:6px;align-items:center}"
      + ".pcbz-c{display:inline-flex;align-items:center;gap:3px}.pcbz-c input[type=color]{width:34px;height:24px;padding:0;border:none;background:none}.pcbz-dim{color:var(--pc-dim);font-size:11px}";
    doc.head.appendChild(css);
    E.bizInfo = { dialog, last, load };
  }
  const PCBizInfo = Object.assign({ install }, pure);
  if (root && root.document) root.PCBizInfo = PCBizInfo;
})(typeof window !== "undefined" ? window : globalThis);
