/* pcbizinfo.js — THE BUSINESS DETAILS DIALOG (2.875.0), window.PCBizInfo -> E.bizInfo.
 * Tim (verbatim): "when user clicks image-edit ai template business card, letterhead,flyer,poster the get user details, name of
 * comany, name, address, phone number, list of services provided. company logo (image) , brand colors, description of card user
 * would like front and description of card back - this will be in a new dialog ... save all the contact information to a json
 * file for now, later we will add it to mariadb"
 *   dialog(kind, {ask, pictures})  the box: your saved details (▾, 🗑), company, your name, role, address, phone, email, website,
 *                                  services (one a line), the logo (a picture, shown), brand colours (up to three, ticked), the front
 *                                  (and for a card / flyer the back) described; ✨ Create keeps the details (POST /api/business/profiles
 *                                  - lib/businessProfiles.js, a JSON file) and makes it (E.create.make with the business)
 *   last() -> Promise<profile | null>   the details used last (the prompt docker's "make a business card …")
 * Pure (Node: scripts/test-875.js): fromForm(values) -> {profile}, sideLabels(kind) */
(function (root) {
  "use strict";
  const TITLES = { card: "💳 Business card", letterhead: "✉ Letterhead", flyer: "📰 Flyer", poster: "🪧 Poster" };
  /** what the front / back boxes are called for a kind (null = no back) */
  function sideLabels(kind) {
    if (kind === "card") return { front: "Front of the card - what it should look like and say", back: "Back of the card - what it should look like and say" };
    if (kind === "flyer") return { front: "Front - what the flyer should look like and say", back: "Back - leave empty for a one-sided flyer" };
    if (kind === "letterhead") return { front: "The letterhead - how it should look (layout, mood, what to show)", back: null };
    return { front: "The poster - what it is for and how it should look", back: null };
  }
  /** the form's values -> the profile sent (colours only the ticked ones, services one a line) */
  function fromForm(v) {
    const o = v || {}, t = (x) => String(x == null ? "" : x).trim();
    return { id: t(o.id) || undefined, company: t(o.company), name: t(o.name), role: t(o.role), address: t(o.address), phone: t(o.phone),
      email: t(o.email), website: t(o.website), services: t(o.services).split(/\r?\n/).map(t).filter(Boolean),
      colours: (o.colours || []).filter((c) => c && c.on && /^#[0-9a-f]{6}$/i.test(c.hex)).map((c) => c.hex.toLowerCase()), front: t(o.front), back: t(o.back) };
  }
  const pure = { sideLabels, fromForm, TITLES };
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
    function dialog(kind, o) {
      const opt = o || {}, k = TITLES[kind] ? kind : "card", side = sideLabels(k);
      const fld = (id, label, ph, type) => `<label class="pcbz-f"><span>${esc(label)}</span><input id="${id}" type="${type || "text"}" placeholder="${esc(ph || "")}" autocomplete="off"></label>`;
      const html = `<div class="pcbz">
        <div class="kxrow"><span>Saved details</span><select id="pcbzPick" style="flex:1"><option value="">＋ New details</option></select><button class="ghost" id="pcbzDel" type="button" title="Delete these saved details" hidden>🗑</button></div>
        <div class="pcbz-g">
          ${fld("pcbzCompany", "Company name", "Rosie's Bakery")}${fld("pcbzName", "Your name", "Rosie Smith")}
          ${fld("pcbzRole", "Role / title", "Owner - head baker")}${fld("pcbzPhone", "Phone number", "0412 345 678", "tel")}
          ${fld("pcbzEmail", "Email", "hello@rosiesbakery.com.au", "email")}${fld("pcbzWeb", "Website", "rosiesbakery.com.au")}
          <label class="pcbz-f pcbz-w"><span>Address</span><textarea id="pcbzAddr" rows="2" placeholder="12 Main Street, Springfield QLD 4300"></textarea></label>
          <label class="pcbz-f pcbz-w"><span>Services - one a line</span><textarea id="pcbzServ" rows="4" placeholder="Sourdough and rye breads&#10;Celebration cakes&#10;Wholesale to cafes"></textarea></label>
        </div>
        <div class="kxrow pcbz-logo"><span>Company logo</span><span class="pcbz-lp" id="pcbzLogoPv">no logo</span>
          <button class="ghost" id="pcbzLogoBtn" type="button">📂 Choose…</button><button class="ghost" id="pcbzLogoNo" type="button" title="No logo" hidden>✕</button>
          <input type="file" id="pcbzLogoFile" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" style="display:none"></div>
        <div class="kxrow pcbz-cols"><span>Brand colours</span>${[0, 1, 2].map((i) => `<label class="pcbz-c"><input type="checkbox" id="pcbzCon${i}"><input type="color" id="pcbzCol${i}" value="${DEF[i]}"></label>`).join("")}<span class="pcbz-dim">the first is the main colour</span></div>
        <label class="pcbz-f pcbz-w"><span>${esc(side.front)}</span><textarea id="pcbzFront" rows="3" placeholder="Clean and warm, cream with the logo top left, my name big, the phone and email under it"></textarea></label>
        ${side.back ? `<label class="pcbz-f pcbz-w"><span>${esc(side.back)}</span><textarea id="pcbzBack" rows="3" placeholder="The logo in the middle on our main colour, the services under it"></textarea></label>` : ""}
        ${k === "flyer" || k === "poster" ? `<div class="kxrow"><label><input type="checkbox" id="pcbzPics"${opt.pictures ? " checked" : ""}> 🖼 Pictures - made with the prompt docker's image style</label></div>` : ""}
        <div class="pcbz-dim">Kept on this computer for next time (business/profiles.json). The LLM writes the words around them; your details are used exactly.</div>
      </div>`;
      let logoData = "", dropLogo = false, cur = null;
      const d = E.ui.dialog(TITLES[k] + " - your business details", html, (dd) => {
        const v = (id) => dd.querySelector("#" + id);
        const prof = fromForm({ id: cur ? cur.id : "", company: v("pcbzCompany").value, name: v("pcbzName").value, role: v("pcbzRole").value, address: v("pcbzAddr").value,
          phone: v("pcbzPhone").value, email: v("pcbzEmail").value, website: v("pcbzWeb").value, services: v("pcbzServ").value,
          colours: [0, 1, 2].map((i) => ({ on: v("pcbzCon" + i).checked, hex: v("pcbzCol" + i).value })), front: v("pcbzFront").value, back: v("pcbzBack") ? v("pcbzBack").value : "" });
        if (!prof.company && !prof.name) { say("✨ give the company's name or your name"); v("pcbzCompany").focus(); return false; }
        const pics = !!(v("pcbzPics") && v("pcbzPics").checked);
        win.fetch("/api/business/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: prof, logo: logoData || undefined, drop_logo: dropLogo }) })
          .then((r) => r.json().then((j) => { if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; }))
          .then((saved) => { cache = null; say("✨ your details are kept - making the " + TITLES[k].replace(/^\S+ /, "").toLowerCase() + "…");
            return E.create.make({ kind: k, ask: opt.ask || "", pictures: pics, business: saved }); })
          .then((m) => m && say(m)).catch((e) => say("✨ " + e.message));
      }, { okLabel: "✨ Create", wide: true, init: (dd) => {
        const v = (id) => dd.querySelector("#" + id);
        const paintLogo = (url) => { const pv = v("pcbzLogoPv"); pv.innerHTML = url ? `<img src="${esc(url)}" alt="the logo">` : "no logo"; v("pcbzLogoNo").hidden = !url; };
        const fill = (p) => {
          cur = p || null; logoData = ""; dropLogo = false;
          const P = p || {};
          [["pcbzCompany", "company"], ["pcbzName", "name"], ["pcbzRole", "role"], ["pcbzPhone", "phone"], ["pcbzEmail", "email"], ["pcbzWeb", "website"], ["pcbzAddr", "address"], ["pcbzFront", "front"], ["pcbzBack", "back"]]
            .forEach(([id, key]) => { if (v(id)) v(id).value = P[key] || ""; });
          v("pcbzServ").value = (P.services || []).join("\n");
          [0, 1, 2].forEach((i) => { const c = (P.colours || [])[i]; v("pcbzCon" + i).checked = !!c; v("pcbzCol" + i).value = c || DEF[i]; });
          paintLogo(P.logo_url || ""); v("pcbzDel").hidden = !p;
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
        load().then(paintPick).then((j) => { const p = (j.profiles || []).find((x) => x.id === j.last) || null; if (p) { v("pcbzPick").value = p.id; } fill(p); if (opt.ask && !v("pcbzFront").value) v("pcbzFront").value = opt.ask; })
          .catch(() => fill(null));
        setTimeout(() => v("pcbzCompany").focus(), 0);
      } });
      return d;
    }
    const css = doc.createElement("style");
    css.textContent = ".pcbz{display:flex;flex-direction:column;gap:7px;min-width:min(620px,86vw)}.pcbz-g{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px}"
      + ".pcbz-f{display:flex;flex-direction:column;gap:2px;font-size:11px}.pcbz-f>span{color:var(--pc-dim)}.pcbz-f input,.pcbz-f textarea{width:100%;box-sizing:border-box}.pcbz-w{grid-column:1/-1}"
      + ".pcbz-lp{display:inline-flex;align-items:center;min-width:60px;height:44px;padding:2px 6px;border:1px dashed var(--pc-line);border-radius:6px;color:var(--pc-dim);font-size:11px}.pcbz-lp img{max-height:40px;max-width:160px}"
      + ".pcbz-c{display:inline-flex;align-items:center;gap:3px}.pcbz-c input[type=color]{width:34px;height:24px;padding:0;border:none;background:none}.pcbz-dim{color:var(--pc-dim);font-size:11px}";
    doc.head.appendChild(css);
    E.bizInfo = { dialog, last, load };
  }
  const PCBizInfo = Object.assign({ install }, pure);
  if (root && root.document) root.PCBizInfo = PCBizInfo;
})(typeof window !== "undefined" ? window : globalThis);
