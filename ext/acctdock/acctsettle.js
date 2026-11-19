/* ext/acctdock/acctsettle.js — 2.889.0: 💵 PAY THE ATO and 💵 PAY SUPER in 📒 Accounts (window.H3AcctSettle, given the docker's
 * helpers by acctdock.js ctx()). The first of the parked next steps (Tim 2026-11-19: "keep your next step suggestions saved").
 *   💵 Pay the ATO…  a BAS period (last quarter by default) + its basis -> what lodging it posts (lib/accountingSettle.js atoPlan:
 *                    1A / 1B / W2 / 5A, the whole-dollar rounding, label 9 into 2330 ATO Integrated Client Account), the date it was
 *                    lodged, ☑ Paid now (the amount, the bank account, the date) - one journal entry for the lodging, one for the
 *                    payment; a period already lodged = a payment (or refund) against what is still owed. The bank tab matches it.
 *   💵 Pay super…    the super owed as at a date, the pay runs since the last super payment by person, the amount, the bank, the
 *                    fund / clearing house - Dr Superannuation Payable, Cr the bank. */
(function (root) {
  "use strict";
  const doc = root.document, $ = (id) => doc.getElementById(id);

  async function ato(c, o) {
    const S = c.S, esc = c.esc, $d = (v) => "$" + c.dollars(v);
    let plan = null;
    const html = `<div class="acrow"><span>BAS period</span><select id="acstPer"><option value="lastquarter">Last quarter</option><option value="quarter">This quarter</option><option value="month">This month</option><option value="custom">From - to…</option></select>`
      + `<input type="date" id="acstFrom" style="display:none"><input type="date" id="acstTo" style="display:none">`
      + `<span>GST basis</span><select id="acstBasis"><option value="cash"${S.books.settings.basis === "cash" ? " selected" : ""}>Cash</option><option value="accrual"${S.books.settings.basis === "accrual" ? " selected" : ""}>Accrual</option></select></div>`
      + `<div id="acstPlan"></div>`
      + `<div class="acrow" id="acstLodgeRow"><span>Lodged on</span><input type="date" id="acstDate"></div>`
      + `<div class="acrow"><label><input type="checkbox" id="acstPaid"> <span id="acstPaidLbl">Paid now</span></label><span>$</span><input id="acstAmt" class="n" style="width:110px" placeholder="0.00">`
      + `<span>Bank</span><select id="acstBank">${c.accOpts((a) => a.bank, "1100")}</select><span>on</span><input type="date" id="acstPaidOn"></div>`
      + `<div class="acnote">The lodging moves what the BAS says into <b>2330 ATO Integrated Client Account</b>; a payment (now or later, all or part) takes it out of the bank. The 🏦 Bank tab matches the payment to your statement. Lodge the BAS itself with the ATO or your tax agent - this keeps your books in step with it.</div>`;
    const qs = () => { const per = $("acstPer").value; return c.qs({ biz: S.biz, period: per, from: per === "custom" ? $("acstFrom").value : "", to: per === "custom" ? $("acstTo").value : "", basis: $("acstBasis").value }); };
    async function load() {
      const box = $("acstPlan"); if (!box) return;
      $("acstFrom").style.display = $("acstTo").style.display = $("acstPer").value === "custom" ? "" : "none";
      if ($("acstPer").value === "custom" && !($("acstFrom").value && $("acstTo").value)) { box.innerHTML = `<div class="acnote">Pick the dates.</div>`; plan = null; return; }
      try { plan = await c.api("/api/accounts/settle/ato?" + qs()); } catch (e) { box.innerHTML = `<div class="acnote bad">${esc(e.message)}</div>`; plan = null; return; }
      const done = plan.already.length > 0, refund = plan.owed < 0;
      box.innerHTML = `<div class="acsub">${esc(plan.from)} - ${esc(plan.to)} · ${esc(plan.basis)} basis · <b>${esc(plan.label)}</b></div>`
        + (done ? `<div class="acnote">This BAS is already in the books (entered ${esc(plan.already[0].date)}). Still owed to the ATO now: <b>${$d(Math.max(0, plan.atoBalance))}</b>${plan.atoBalance < 0 ? ` · the ATO owes you ${$d(-plan.atoBalance)}` : ""}. Record a payment${plan.atoBalance < 0 ? " or the refund" : ""} below.</div>`
          : plan.lines.length ? `<table class="actab"><tr><th>Account</th><th>For</th><th class="n">Debit</th><th class="n">Credit</th></tr>${plan.lines.map((l) => `<tr><td>${esc(l.account)} ${esc(l.name)}</td><td>${esc(l.why)}</td><td class="n">${l.dr ? c.N(l.dr) : ""}</td><td class="n">${l.cr ? c.N(l.cr) : ""}</td></tr>`).join("")}</table>`
          : `<div class="acnote">Nothing to lodge for this period - no GST and no PAYG.</div>`);
      $("acstLodgeRow").style.display = done || !plan.lines.length ? "none" : "";
      if (!$("acstDate").value || $("acstDate").value < plan.to) $("acstDate").value = c.todayStr() > plan.to ? c.todayStr() : plan.to;
      const owe = done ? plan.atoBalance : plan.owed;
      $("acstPaidLbl").textContent = (done ? owe < 0 : refund) ? "Refund received" : done ? "Paid" : "Paid now";
      $("acstAmt").value = owe ? (Math.abs(owe) / 100).toFixed(2) : "";
      $("acstPaid").checked = done && !!owe;
      if (!$("acstPaidOn").value) $("acstPaidOn").value = c.todayStr();
    }
    c.dialog("💵 Pay the ATO", html, async () => {
      if (!plan) throw new Error("pick the BAS period");
      const pay = $("acstPaid").checked ? { amount: $("acstAmt").value, account: $("acstBank").value, date: $("acstPaidOn").value } : null;
      if (plan.already.length) {
        if (!pay) throw new Error("this BAS is in the books already - tick Paid to record a payment or the refund");
        const j = await c.api("/api/accounts/settle/atopay", { pay: Object.assign({ refund: plan.atoBalance < 0 }, pay) });
        return c.msg(`✔ ${j.settle.refund ? "refund from" : "paid to"} the ATO: $${c.dollars(j.lines[0].dr)} - in the General Journal`);
      }
      if (!plan.lines.length) throw new Error("nothing to lodge for this period");
      const r = await c.api("/api/accounts/settle/ato", { lodge: { from: plan.from, to: plan.to, basis: plan.basis, date: $("acstDate").value, pay } });
      c.msg(`✔ BAS ${plan.from} - ${plan.to} in the books (${plan.label})` + (r.paid ? ` and ${r.paid.settle.refund ? "the refund received" : "paid"}: $${c.dollars(r.paid.lines[0].dr)}` : " - record the payment when it is made"));
    }, () => {
      if (o && o.from && o.to) { $("acstPer").value = "custom"; $("acstFrom").value = o.from; $("acstTo").value = o.to; }
      if (o && o.basis) $("acstBasis").value = o.basis;
      ["acstPer", "acstFrom", "acstTo", "acstBasis"].forEach((id) => $(id).addEventListener("change", load));
      load();
    });
  }

  async function superPay(c) {
    const S = c.S, esc = c.esc;
    const html = `<div class="acrow"><span>Paid on</span><input type="date" id="acsuDate" value="${c.todayStr()}"><span>From</span><select id="acsuBank">${c.accOpts((a) => a.bank, "1100")}</select></div>`
      + `<div id="acsuPlan"></div>`
      + `<div class="acrow"><span>Amount $</span><input id="acsuAmt" class="n" style="width:110px" placeholder="0.00"><span>To</span><input id="acsuFund" style="width:220px" placeholder="the fund or clearing house (optional)"></div>`
      + `<div class="acnote">Takes the super out of <b>2310 Superannuation Payable</b> (what the pay runs 👷 put there) and out of the bank - the 🏦 Bank tab matches it. Pay it through your clearing house or the funds by the due date; check the dates with the ATO or your tax agent.</div>`;
    async function load() {
      const box = $("acsuPlan"); if (!box) return;
      let p; try { p = await c.api("/api/accounts/settle/super?" + c.qs({ biz: S.biz, at: $("acsuDate").value })); } catch (e) { box.innerHTML = `<div class="acnote bad">${esc(e.message)}</div>`; return; }
      box.innerHTML = `<div class="acsub">Super owed on ${esc(p.at)}: <b>$${c.dollars(p.owed)}</b>${p.since ? ` · paid last on ${esc(p.since)}` : ""}</div>`
        + (p.people.length ? `<table class="actab"><tr><th>Pay runs ${p.since ? "since then" : "so far"}</th><th class="n">Super</th></tr>${p.people.map((x) => `<tr><td>${esc(x.name)}</td><td class="n">${c.N(x.amount)}</td></tr>`).join("")}</table>` : `<div class="acnote">No pay runs with super ${p.since ? "since the last payment" : "yet"}.</div>`);
      $("acsuAmt").value = p.owed > 0 ? (p.owed / 100).toFixed(2) : "";
    }
    c.dialog("💵 Pay super", html, async () => {
      const j = await c.api("/api/accounts/settle/super", { pay: { date: $("acsuDate").value, account: $("acsuBank").value, amount: $("acsuAmt").value, fund: $("acsuFund").value } });
      c.msg(`✔ super paid: $${c.dollars(j.lines[0].dr)}${j.settle.fund ? " to " + j.settle.fund : ""} - in the General Journal`);
    }, () => { $("acsuDate").addEventListener("change", load); load(); });
  }
  root.H3AcctSettle = { ato, superPay };
})(typeof window !== "undefined" ? window : globalThis);
