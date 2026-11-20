/* ext/acctdock/accttax.js — 2.883.0: 🧾 Taxes… and ＋ 👷 Pay run in 📒 Accounts (window.H3AcctTax, given the docker's helpers by
 * acctdock.js ctx()). The tax settings (lib/accountingTax.js): the business structure, how often the BAS is lodged, GST (registered,
 * cash / accrual), PAYG withholding, the super guarantee rate, PAYG instalments (the ATO's amount T7, or its rate T2 on the instalment
 * income T1). A pay run: the gross, the tax withheld (from the ATO's tax tables - not shipped here), super - the journal entry made
 * for you; W1 / W2 / 4, T1 / T7 / 5A and 8A / 8B / 9 then show on the BAS tab. No tax file numbers are asked or kept.
 * Tim (verbatim, 2.877.0): "use au tax system, we will add a dialog for the users taxes and costs later" + "yes, please add the next steps" */
(function (root) {
  "use strict";
  const doc = root.document, $ = (id) => doc.getElementById(id);
  const num = (v) => { const n = parseFloat(String(v || "").replace(/[$,\s]/g, "")); return Number.isFinite(n) ? n : 0; };

  async function open(c) {
    const S = c.S, esc = c.esc, T = await c.api("/api/accounts/tax?" + c.qs({ biz: S.biz })), t = T.tax, st = S.books.settings;
    const sel = (id, obj, v) => `<select id="${id}">${Object.entries(obj).map(([k, x]) => `<option value="${esc(k)}"${k === v ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>`;
    const html = `<h4 class="tx-h">Your business</h4>`
      + `<div class="acrow"><span>Structure</span>${sel("actxStruct", T.structures, t.structure)}<span>BAS lodged</span>${sel("actxCycle", T.cycles, t.cycle)}</div>`
      + `<h4 class="tx-h">GST</h4><div class="acrow"><label><input type="checkbox" id="actxGst"${st.gstRegistered ? " checked" : ""}> registered for GST</label>`
      + `<span>Accounting</span><select id="actxBasis"><option value="cash"${st.basis === "cash" ? " selected" : ""}>Cash (when paid)</option><option value="accrual"${st.basis === "accrual" ? " selected" : ""}>Accrual (when invoiced)</option></select></div>`
      + `<h4 class="tx-h">PAYG withholding (W1, W2)</h4><div class="acrow"><label><input type="checkbox" id="actxWh"${t.withholding ? " checked" : ""}> registered - I pay wages and withhold tax</label></div>`
      + `<div class="acrow"><span>Wages account</span><select id="actxWages">${c.accOpts((a) => a.type === "expense", t.wages[0])}</select><span>Super guarantee</span><input id="actxSuper" class="n" style="width:56px" value="${esc(String(t.superRate))}"><span>% of ordinary pay</span></div>`
      + `<h4 class="tx-h">PAYG income tax instalments (T1, T2, T7)</h4><div class="acrow">${sel("actxInst", T.instalments, t.instalments)}</div>`
      + `<div class="acrow" data-inst="amount"><span>Instalment amount a quarter (T7) $</span><input id="actxAmt" class="n" style="width:100px" value="${t.instalmentAmount ? (t.instalmentAmount / 100).toFixed(2) : ""}" placeholder="0.00"></div>`
      + `<div class="acrow" data-inst="rate"><span>Instalment rate (T2)</span><input id="actxRate" class="n" style="width:70px" value="${t.instalmentRate || ""}" placeholder="0.0"><span>% of the instalment income (T1 = income without GST)</span></div>`
      + `<div class="acnote">The amounts and rates come from the ATO (your activity statement or your tax agent). The BAS tab then shows W1 / W2, T1 / T7, 5A and the total (8A, 8B, 9). A worksheet - check it with your tax agent.</div>`;
    c.dialog("🧾 Taxes", html, async () => {
      const tax = { structure: $("actxStruct").value, cycle: $("actxCycle").value, withholding: $("actxWh").checked, wages: [$("actxWages").value], superRate: num($("actxSuper").value),
        instalments: $("actxInst").value, instalmentAmount: $("actxAmt").value || 0, instalmentRate: num($("actxRate").value) };
      await c.api("/api/accounts/tax", { tax });
      await c.api("/api/accounts/settings", { settings: { gstRegistered: $("actxGst").checked, basis: $("actxBasis").value } });
      S.basis = ""; c.msg("✔ the tax settings are kept");
    }, (b) => {
      const inst = () => { const v = $("actxInst").value; b.querySelectorAll("[data-inst]").forEach((r) => { r.style.display = r.dataset.inst === v ? "" : "none"; }); };
      $("actxInst").addEventListener("change", inst); inst();
    });
  }
  async function payRun(c) {
    const S = c.S, esc = c.esc, T = await c.api("/api/accounts/tax?" + c.qs({ biz: S.biz })), t = T.tax;
    const people = [...new Set((S.books.journals || []).filter((j) => j.payrun).map((j) => j.payrun.employee))];
    const html = `<div class="acrow"><span>Paid to</span><input id="acprName" list="acprPeople" style="width:200px" placeholder="Name"><datalist id="acprPeople">${people.map((p) => `<option value="${esc(p)}">`).join("")}</datalist>`
      + `<span>Pay date</span><input type="date" id="acprDate" value="${c.todayStr()}"><span>For</span><input id="acprPer" style="width:150px" placeholder="week ending 16/11/2026"></div>`
      + `<div class="acrow"><span>Gross pay $</span><input id="acprGross" class="n" style="width:100px" placeholder="0.00"><span>Tax withheld $</span><input id="acprTax" class="n" style="width:90px" placeholder="0.00" title="From the ATO's tax tables or its tax withheld calculator">`
      + `<span>Super $</span><input id="acprSuper" class="n" style="width:90px" placeholder="0.00" title="${esc(t.superRate + " % of the gross - change it when some of the pay is not ordinary pay")}"></div>`
      + `<div class="acrow"><span>From</span><select id="acprBank">${c.accOpts((a) => a.bank, "1100")}</select><span>Wages account</span><select id="acprWages">${c.accOpts((a) => a.type === "expense", t.wages[0])}</select><span>Job</span><select id="acprJob">${c.jobOpts("")}</select></div>`
      + `<div class="acnote" id="acprSum"></div>`
      + (t.withholding ? "" : `<div class="acnote">PAYG withholding is not ticked in 🧾 Taxes - the BAS still shows W1 / W2 once a pay run is entered.</div>`)
      + `<div class="acnote">The tax withheld comes from the ATO's tax tables (or its calculator) - bitGen does not work it out. No tax file number is needed here.</div>`;
    c.dialog("👷 Pay run", html, async () => {
      const pay = { employee: $("acprName").value, date: $("acprDate").value, period: $("acprPer").value, gross: $("acprGross").value, tax: $("acprTax").value,
        super: $("acprSuper").value, account: $("acprBank").value, wages: $("acprWages").value, job: $("acprJob").value };
      const j = await c.api("/api/accounts/payrun", { pay });
      c.msg(`✔ pay run for ${j.payrun.employee}: gross $${c.dollars(j.payrun.gross)}, tax $${c.dollars(j.payrun.tax)}, net $${c.dollars(j.payrun.net)}, super $${c.dollars(j.payrun.super)} - in the General Journal`);
    }, () => {
      let touched = false;
      const sum = () => {
        const g = Math.round(num($("acprGross").value) * 100), tx = Math.round(num($("acprTax").value) * 100);
        if (!touched) $("acprSuper").value = g ? (Math.round(g * t.superRate / 100) / 100).toFixed(2) : "";
        const sp = Math.round(num($("acprSuper").value) * 100);
        $("acprSum").textContent = g ? `Net pay $${c.dollars(g - tx)} from the bank · $${c.dollars(tx)} to the ATO (PAYG withheld) · $${c.dollars(sp)} super to the fund` : "";
      };
      ["acprGross", "acprTax"].forEach((id) => $(id).addEventListener("input", sum));
      $("acprSuper").addEventListener("input", () => { touched = true; sum(); });
    });
  }
  /** 2.893.0: 👷 a year's payment summary per person (lib/accountingPaySummary.js) - the year, each person's figures, 🖨 a page
   *  each (or all), ⤓ CSV. Tim (verbatim): "continue next" (parked: "👷 A year's payment summary per person ... from the pay runs") */
  async function paySummary(c) {
    const S = c.S, esc = c.esc, q = (fy, more) => c.qs(Object.assign({ biz: S.biz, fy }, more || {}));
    const body = (P) => (P.people.length ? `<table class="actab acps-tab"><tr><th>Name</th><th class="n">Pays</th><th>First - last</th><th class="n">Gross</th><th class="n">Tax withheld</th><th class="n">Net</th><th class="n">Super</th><th></th></tr>`
      + P.people.map((p) => `<tr><td>${esc(p.name)}</td><td class="n">${p.runs}</td><td>${esc(p.first)} - ${esc(p.last)}</td><td class="n">${c.N(p.gross)}</td><td class="n">${c.N(p.tax)}</td><td class="n">${c.N(p.net)}</td><td class="n">${c.N(p.super)}</td>`
        + `<td class="act"><button type="button" data-psprint="${esc(p.name)}" title="This person's payment summary - to print or save as PDF">🖨</button></td></tr>`).join("")
      + `<tr class="tot"><td>Total</td><td class="n">${P.totals.runs}</td><td></td><td class="n">${c.N(P.totals.gross)}</td><td class="n">${c.N(P.totals.tax)}</td><td class="n">${c.N(P.totals.net)}</td><td class="n">${c.N(P.totals.super)}</td><td></td></tr></table>`
      : `<div class="acnote">No pay runs in ${esc(P.label)} - ＋ 👷 Pay run enters them.</div>`);
    let P = await c.api("/api/accounts/paysummary?" + q(""));
    const html = `<div class="acrow"><span>Financial year</span><select id="acpsFy">${P.years.map((y) => `<option value="${y.end}"${y.end === P.end ? " selected" : ""}>${esc(y.label)} (1 July ${y.end - 1} - 30 June ${y.end})</option>`).join("")}</select>`
      + `<button type="button" class="ghost" id="acpsAll" title="Every person's page (and the year's totals) - to print or save as PDF">🖨 All</button><button type="button" class="ghost" id="acpsCsv">⤓ CSV</button></div>`
      + `<div id="acpsBody">${body(P)}</div>`
      + `<div class="acnote">From the pay runs (👷) in the books. A record for you, each person and your tax agent - not a lodgement: since Single Touch Payroll the ATO gives employees their income statement in myGov from what the employer reports. No tax file numbers are kept.</div>`;
    c.dialog("👷 Payment summaries", html, async () => {}, (b) => {
      const fy = () => $("acpsFy").value;
      $("acpsFy").addEventListener("change", async () => { P = await c.api("/api/accounts/paysummary?" + q(fy())); $("acpsBody").innerHTML = body(P); });
      b.addEventListener("click", (e) => {
        const t = e.target, x = t.closest("[data-psprint]");
        if (x) root.open("/api/accounts/paysummary/print?" + q(fy(), { person: x.dataset.psprint }), "_blank");
        else if (t.id === "acpsAll") root.open("/api/accounts/paysummary/print?" + q(fy()), "_blank");
        else if (t.id === "acpsCsv") root.open("/api/accounts/paysummary/csv?" + q(fy()), "_blank");
      });
    });
  }
  root.H3AcctTax = { open, payRun, paySummary };
})(typeof window !== "undefined" ? window : globalThis);
