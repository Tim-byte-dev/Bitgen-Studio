/* ext/sheetdock/sheetfmtdlg.js — ▦ FORMAT CELLS (2.823.0): the dialog, window.H3SheetFormat.open([tab]).
 *
 * Tim: "continue , add format cells button, format the cells like excel". ▤ Format… on the toolbar, Ctrl+1, or the cells'
 * right-click menu. Six tabs:
 *   Number      General / Number / Currency / Accounting / Date / Time / Percentage / Fraction / Scientific / Text /
 *               Special / Custom (any code - sheetfmt.js), a live sample of the active cell
 *   Alignment   horizontal (general, left, centre, right, fill, justify, centre across selection, distributed) + indent,
 *               vertical, wrap / shrink to fit / merge, text direction, orientation (a dial, degrees, vertical text)
 *   Font        font (this computer's too), style, size, underline (single / double / accounting), colour, strikethrough,
 *               superscript / subscript, a preview
 *   Border      13 line styles + colour, presets None / Outline / Inside, each edge (inside lines, diagonals) by button
 *               or by clicking the preview
 *   Fill        a colour palette (No colour, more colours), two-colour shading, 17 patterns + their colour, a sample
 *   Protection  Locked / Hidden (they work once the sheet is protected) + protect the sheet
 * Only what is changed in the dialog is applied to every selected cell (the others keep their own) - one undo step.
 * Uses H3Sheet._ (sheetdock.js) and SheetFmt (sheetfmt.js).
 */
(function (root) {
  "use strict";
  const doc = root.document; if (!doc) return;
  const H = () => root.H3Sheet, X = () => root.H3Sheet._, F = () => root.SheetFmt;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const $ = (id) => doc.getElementById(id);
  let dlg = null, D = null, T = null, SEL = null;
  const touch = (k) => T.add(k);

  const TABS = [["number", "Number"], ["align", "Alignment"], ["font", "Font"], ["border", "Border"], ["fill", "Fill"], ["prot", "Protection"]];
  const CAT_HINT = {
    General: "Shows a number as it is, with as many decimals as fit - no particular look.",
    Number: "Plain numbers with a set number of decimal places. Currency and Accounting are for money.",
    Currency: "Money amounts with a currency sign. Accounting lines the signs and decimal points up in a column.",
    Accounting: "Money in columns: the sign at the cell's left edge, decimal points lined up, a zero shown as a dash.",
    Date: "A date is a number of days - pick how it looks. Times of day are the part after the decimal point.",
    Time: "A time is a part of a day - pick how it looks. [h] counts hours past 24.",
    Percentage: "The value x 100 with a % sign.",
    Fraction: "The part after the decimal point as a fraction.",
    Scientific: "A number times a power of ten: 1.23E+05 = 123,000.",
    Text: "The cell shows exactly what is typed, numbers and = too (they are not worked out).",
    Special: "Postcodes, phone and ID numbers - leading zeros kept, spaces where they belong.",
    Custom: "Type a format code or start from one below: 0 # ? digits, , thousands, % percent, d m y h s dates and times, [Red] a colour, \"text\", sections positive;negative;zero;text.",
  };
  const HA = [["general", "General"], ["left", "Left (indent)"], ["center", "Centre"], ["right", "Right (indent)"], ["fill", "Fill"], ["justify", "Justify"], ["centerSel", "Centre across selection"], ["distributed", "Distributed (indent)"]];
  const VA = [["top", "Align top"], ["center", "Align middle"], ["bottom", "Align bottom"], ["justify", "Justify"], ["distributed", "Distributed"]];
  const FONTS = ["Arial", "Calibri", "Cambria", "Candara", "Consolas", "Constantia", "Corbel", "Courier New", "Georgia", "Helvetica", "Inter", "Noto Sans", "Noto Serif", "Roboto", "Segoe UI", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana"];
  const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
  const LINES = ["hair", "dotted", "dashDotDot", "dashDot", "dashed", "thin", "mediumDashDotDot", "slantDashDot", "mediumDashDot", "mediumDashed", "medium", "thick", "double"];
  const DASH = { hair: "1 1", dotted: "1 2", dashDotDot: "6 2 1 2 1 2", dashDot: "6 2 1 2", dashed: "4 2", thin: "", mediumDashDotDot: "6 2 2 2 2 2", slantDashDot: "8 2 3 2", mediumDashDot: "8 3 2 3", mediumDashed: "6 3", medium: "", thick: "", double: "" };
  const LW = { hair: 1, dotted: 1, dashDotDot: 1, dashDot: 1, dashed: 1, thin: 1, mediumDashDotDot: 2, slantDashDot: 2, mediumDashDot: 2, mediumDashed: 2, medium: 2, thick: 3, double: 1 };
  const EDGES = ["top", "insideH", "bottom", "left", "insideV", "right", "d1", "d2"];
  const EDGE_TIP = { top: "Top border", insideH: "Inside horizontal border", bottom: "Bottom border", left: "Left border", insideV: "Inside vertical border", right: "Right border", d1: "Diagonal border up", d2: "Diagonal border down" };
  const EDGE_ICON = { top: "▔", insideH: "═", bottom: "▁", left: "▏", insideV: "║", right: "▕", d1: "⟋", d2: "⟍" };
  const THEME = ["#ffffff", "#000000", "#e7e6e6", "#44546a", "#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47"];
  const STANDARD = ["#c00000", "#ff0000", "#ffc000", "#ffff00", "#92d050", "#00b050", "#00b0f0", "#0070c0", "#002060", "#7030a0"];
  const PAT_NAMES = { gray75: "75% grey", gray50: "50% grey", gray25: "25% grey", gray125: "12.5% grey", gray0625: "6.25% grey", darkHorizontal: "Thick horizontal stripe", darkVertical: "Thick vertical stripe",
    darkDown: "Thick reverse diagonal stripe", darkUp: "Thick diagonal stripe", darkGrid: "Thick diagonal crosshatch", darkTrellis: "Thick trellis", lightHorizontal: "Thin horizontal stripe",
    lightVertical: "Thin vertical stripe", lightDown: "Thin reverse diagonal stripe", lightUp: "Thin diagonal stripe", lightGrid: "Thin horizontal crosshatch", lightTrellis: "Thin trellis" };
  const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  function shade(h, f) { const n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return f >= 0 ? "#" + hex2(r + (255 - r) * f) + hex2(g + (255 - g) * f) + hex2(b + (255 - b) * f) : "#" + hex2(r * (1 + f)) + hex2(g * (1 + f)) + hex2(b * (1 + f)); }

  const CSS = `
    dialog.shfd { padding: 0; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); color: var(--text); width: min(720px, 96vw); max-height: 92vh; font-size: 12px; }
    dialog.shfd::backdrop { background: rgba(0,0,0,.45); }
    .shfd .fdHead { display: flex; align-items: center; padding: 8px 12px; font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--line); }
    .shfd .fdHead button { margin-left: auto; }
    .shfd .fdTabs { display: flex; gap: 2px; padding: 6px 10px 0; border-bottom: 1px solid var(--line); }
    .shfd .fdTabs button { border: 1px solid var(--line); border-bottom: 0; border-radius: 6px 6px 0 0; padding: 4px 12px; background: var(--panel-2); color: var(--dim); }
    .shfd .fdTabs button.on { background: var(--panel); color: var(--tiger); font-weight: 600; }
    .shfd .fdBody { padding: 10px 12px; height: 430px; overflow: auto; }
    .shfd .fdPane { display: none; } .shfd .fdPane.on { display: block; }
    .shfd fieldset { border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px 8px; margin: 0 0 8px; }
    .shfd legend { color: var(--dim); padding: 0 4px; }
    .shfd label { display: flex; align-items: center; gap: 6px; margin: 3px 0; }
    .shfd label.ck { display: inline-flex; margin-right: 12px; }
    .shfd select, .shfd input[type=number], .shfd input[type=text] { font-size: 12px; width: auto; }
    .shfd input[type=color] { width: 30px; height: 22px; padding: 0; border: 1px solid var(--line); background: none; }
    .shfd .fdHint { color: var(--dim); margin: 8px 0 0; line-height: 1.4; }
    .shfd .fdCols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .shfd .fdCols3 { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; }
    .shfd .fdNum { display: grid; grid-template-columns: 150px 1fr; gap: 10px; }
    .shfd .fdList { border: 1px solid var(--line); border-radius: 4px; overflow: auto; background: var(--ink); }
    .shfd .fdList > div { padding: 3px 8px; cursor: pointer; white-space: nowrap; }
    .shfd .fdList > div:hover { background: var(--panel-2); }
    .shfd .fdList > div.on { background: color-mix(in srgb, var(--tiger) 22%, var(--panel-2)); color: var(--tiger); }
    #fdCats { height: 390px; }
    .shfd .fdTypes { height: 200px; }
    .shfd .fdSample { min-height: 20px; font: 13px monospace; white-space: pre; padding: 2px 4px; background: var(--ink); border-radius: 3px; }
    .shfd .fdPrev { height: 56px; display: flex; align-items: center; justify-content: center; background: var(--ink); border-radius: 4px; overflow: hidden; white-space: nowrap; }
    .shfd .fdStyles { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; }
    .shfd .fdStyles button, .shfd .fdEdge, .shfd .fdPresets button { padding: 2px; border: 1px solid var(--line); border-radius: 3px; background: var(--ink); color: var(--text); }
    .shfd .fdStyles button.on, .shfd .fdEdge.on { border-color: var(--tiger); box-shadow: 0 0 0 1px var(--tiger) inset; }
    .shfd .fdStyles svg { display: block; width: 100%; height: 12px; }
    .shfd .fdPresets { display: flex; gap: 8px; }
    .shfd .fdPresets button { width: 64px; height: 46px; font-size: 11px; line-height: 1.3; }
    .shfd .fdBd { display: grid; grid-template-columns: 34px 1fr; grid-template-rows: 1fr 34px; gap: 4px; }
    .shfd .fdBd .vbtns { display: flex; flex-direction: column; justify-content: space-between; }
    .shfd .fdBd .hbtns { grid-column: 2; display: flex; justify-content: space-between; }
    .shfd .fdEdge { width: 30px; height: 28px; font-size: 15px; line-height: 1; }
    .shfd .fdEdge:disabled { opacity: .35; }
    .shfd #fdBdPrev { width: 100%; height: 150px; background: var(--ink); border-radius: 4px; cursor: pointer; }
    .shfd .fdPal { display: grid; grid-template-columns: repeat(10, 18px); gap: 2px; margin: 6px 0; }
    .shfd .fdPal button, .shfd .fdPats button { width: 18px; height: 18px; padding: 0; border: 1px solid var(--line); border-radius: 2px; }
    .shfd .fdPal button.on, .shfd .fdPats button.on { outline: 2px solid var(--tiger); outline-offset: 1px; }
    .shfd .fdPats { display: grid; grid-template-columns: repeat(6, 24px); gap: 4px; margin-top: 6px; }
    .shfd .fdPats button { width: 24px; height: 18px; background-color: var(--panel); }
    .shfd .fdFillPrev { height: 60px; border: 1px solid var(--line); border-radius: 4px; }
    .shfd .fdOr { display: flex; gap: 10px; align-items: center; }
    .shfd .fdStack { width: 34px; height: 120px; line-height: 1.15; font-size: 12px; border: 1px solid var(--line); border-radius: 4px; background: var(--ink); color: var(--text); }
    .shfd .fdStack.on { border-color: var(--tiger); color: var(--tiger); }
    .shfd #fdDial { width: 130px; height: 130px; background: var(--ink); border-radius: 4px; cursor: pointer; touch-action: none; }
    .shfd .fdFoot { display: flex; gap: 8px; align-items: center; padding: 8px 12px; border-top: 1px solid var(--line); }
    .shfd .fdFoot .fdNote { color: var(--dim); margin-right: auto; }
    .shfd .fdFoot button { min-width: 80px; }
    .shfd #fdOk { border-color: var(--tiger); color: var(--tiger); font-weight: 600; }
  `;

  /* ------------------------------------------------------------------ building */
  function lineSvg(s, color) {
    if (s === "none") return `<svg viewBox="0 0 60 12"><text x="30" y="10" font-size="9" text-anchor="middle" fill="currentColor">None</text></svg>`;
    const c = color || "currentColor";
    if (s === "double") return `<svg viewBox="0 0 60 12"><line x1="2" y1="4" x2="58" y2="4" stroke="${c}" stroke-width="1"/><line x1="2" y1="8" x2="58" y2="8" stroke="${c}" stroke-width="1"/></svg>`;
    return `<svg viewBox="0 0 60 12"><line x1="2" y1="6" x2="58" y2="6" stroke="${c}" stroke-width="${LW[s]}"${DASH[s] ? ` stroke-dasharray="${DASH[s]}"` : ""}/></svg>`;
  }
  function build() {
    dlg = doc.createElement("dialog"); dlg.id = "shFmtDlg"; dlg.className = "shfd";
    const pal = [THEME, ...[0.8, 0.6, 0.4, -0.25, -0.5].map((f) => THEME.map((h) => shade(h, h === "#ffffff" && f > 0 ? -f / 3 : h === "#000000" && f < 0 ? -f / 2 : f))), STANDARD];
    const P = X().PATTERNS;
    dlg.innerHTML = `<style>${CSS}</style>
      <div class="fdHead">▤ Format Cells<button class="ghost" type="button" data-x="1" title="Close (Esc)" aria-label="Close">✕</button></div>
      <div class="fdTabs">${TABS.map(([k, l]) => `<button type="button" data-tab="${k}">${l}</button>`).join("")}</div>
      <div class="fdBody">
        <div class="fdPane" data-pane="number"><div class="fdNum">
          <div class="fdList" id="fdCats" role="listbox" aria-label="Category">${F().CATS.map((c) => `<div data-cat="${c}">${c}</div>`).join("")}</div>
          <div><fieldset><legend>How it looks</legend><div id="fdSample" class="fdSample"></div></fieldset><div id="fdOpts"></div><p class="fdHint" id="fdHint"></p></div>
        </div></div>
        <div class="fdPane" data-pane="align"><div class="fdCols"><div>
          <fieldset><legend>Text alignment</legend>
            <label>Horizontal: <select id="fdHa">${HA.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
            <label>Indent: <input type="number" id="fdInd" min="0" max="15" step="1" style="width:60px"></label>
            <label>Vertical: <select id="fdVa">${VA.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label></fieldset>
          <fieldset><legend>Text control</legend>
            <label class="ck"><input type="checkbox" id="fdWrap"> Wrap text</label><br>
            <label class="ck"><input type="checkbox" id="fdShrink"> Shrink to fit</label><br>
            <label class="ck"><input type="checkbox" id="fdMerge"> Merge cells</label></fieldset>
          <fieldset><legend>Right-to-left</legend><label>Text direction: <select id="fdDir"><option value="">From the text</option><option value="ltr">Left-to-right</option><option value="rtl">Right-to-left</option></select></label></fieldset>
        </div><div>
          <fieldset><legend>Orientation</legend>
            <div class="fdOr"><button type="button" id="fdStack" class="fdStack" title="Vertical text: one letter under another">T<br>e<br>x<br>t</button><svg id="fdDial" viewBox="0 0 130 130" aria-label="Turn the text"></svg></div>
            <label><input type="number" id="fdRot" min="-90" max="90" step="1" style="width:64px"> Degrees</label></fieldset>
        </div></div></div>
        <div class="fdPane" data-pane="font">
          <div class="fdCols3">
            <label style="flex-direction:column;align-items:stretch">Font: <select id="fdFont" data-h3fonts><option value="">(the app's font)</option>${FONTS.map((f) => `<option value="${f}" data-noi18n>${f}</option>`).join("")}</select></label>
            <label style="flex-direction:column;align-items:stretch">Font style: <select id="fdFs"><option value="r">Regular</option><option value="i">Italic</option><option value="b">Bold</option><option value="bi">Bold Italic</option></select></label>
            <label style="flex-direction:column;align-items:stretch">Size: <input type="number" id="fdSize" min="1" max="409" step="0.5" list="fdSizes"><datalist id="fdSizes">${SIZES.map((n) => `<option value="${n}">`).join("")}</datalist></label>
          </div>
          <div class="fdCols">
            <label>Underline: <select id="fdU"><option value="none">None</option><option value="single">Single underline</option><option value="double">Double underline</option><option value="acc">Single accounting underline</option><option value="dacc">Double accounting underline</option></select></label>
            <label>Colour: <label class="ck"><input type="checkbox" id="fdColAuto"> Automatic</label><input type="color" id="fdCol" value="#e8e2d6"></label>
          </div>
          <div class="fdCols"><fieldset><legend>Effects</legend>
              <label class="ck"><input type="checkbox" id="fdStrike"> Strikethrough</label><br>
              <label class="ck"><input type="checkbox" id="fdSup"> Superscript</label><br>
              <label class="ck"><input type="checkbox" id="fdSub"> Subscript</label></fieldset>
            <fieldset><legend>Preview</legend><div class="fdPrev" id="fdFontPrev"><span data-noi18n>AaBbCcYyZz 123</span></div></fieldset></div>
          <label class="ck"><input type="checkbox" id="fdNormal"> Normal font</label>
        </div>
        <div class="fdPane" data-pane="border"><div class="fdCols" style="grid-template-columns:150px 1fr">
          <div><fieldset><legend>Line</legend><div>Line style:</div>
            <div class="fdStyles" id="fdStyles"><button type="button" data-ls="none" title="None">${lineSvg("none")}</button>${LINES.map((s) => `<button type="button" data-ls="${s}" title="${s}">${lineSvg(s)}</button>`).join("")}</div>
            <div style="margin-top:8px">Colour:</div><label class="ck"><input type="checkbox" id="fdLcAuto" checked> Automatic</label><input type="color" id="fdLc" value="#000000"></fieldset></div>
          <div><fieldset><legend>Presets</legend><div class="fdPresets">
              <button type="button" data-pre="none" title="No borders">▢<br>None</button><button type="button" data-pre="outline" title="Outline">▣<br>Outline</button><button type="button" data-pre="inside" title="Inside lines">╋<br>Inside lines</button></div></fieldset>
            <fieldset><legend>Border</legend><div class="fdBd">
              <div class="vbtns">${["top", "insideH", "bottom"].map((e) => `<button type="button" class="fdEdge" data-edge="${e}" title="${EDGE_TIP[e]}">${EDGE_ICON[e]}</button>`).join("")}</div>
              <svg id="fdBdPrev" viewBox="0 0 200 120" preserveAspectRatio="none"></svg>
              <div class="hbtns">${["d1", "left", "insideV", "right", "d2"].map((e) => `<button type="button" class="fdEdge" data-edge="${e}" title="${EDGE_TIP[e]}">${EDGE_ICON[e]}</button>`).join("")}</div>
            </div></fieldset>
            <p class="fdHint">Pick a line style and a colour, then click a preset, an edge button or the preview. Click an edge again to take it off.</p></div>
        </div></div>
        <div class="fdPane" data-pane="fill"><div class="fdCols"><div>
          <fieldset><legend>Background colour</legend><button type="button" class="ghost" id="fdNoFill">No colour</button>
            <div class="fdPal" id="fdPal">${pal.map((row) => row.map((h) => `<button type="button" data-bg="${h}" title="${h}" style="background:${h}"></button>`).join("")).join("")}</div>
            <label>More colours… <input type="color" id="fdBgMore" value="#4472c4"></label></fieldset>
          <fieldset><legend>Fill effects (two colours)</legend>
            <label>Colour 1 <input type="color" id="fdG1" value="#ffffff"> Colour 2 <input type="color" id="fdG2" value="#4472c4"></label>
            <label>Shading: <select id="fdGd"><option value="">None</option><option value="h">Horizontal</option><option value="v">Vertical</option><option value="du">Diagonal up</option><option value="dd">Diagonal down</option><option value="c">From centre</option></select></label></fieldset>
        </div><div>
          <fieldset><legend>Pattern</legend>
            <label>Pattern colour: <label class="ck"><input type="checkbox" id="fdPcAuto" checked> Automatic</label><input type="color" id="fdPc" value="#ffffff"></label>
            <div>Pattern style:</div>
            <div class="fdPats" id="fdPats"><button type="button" data-pat="" title="None" style="background:var(--panel)">∅</button>${Object.keys(P).map((k) => `<button type="button" data-pat="${k}" title="${PAT_NAMES[k] || k}"></button>`).join("")}</div></fieldset>
          <fieldset><legend>Sample</legend><div class="fdFillPrev" id="fdFillPrev"></div></fieldset>
        </div></div></div>
        <div class="fdPane" data-pane="prot">
          <label class="ck"><input type="checkbox" id="fdLock"> Locked</label><br>
          <label class="ck"><input type="checkbox" id="fdHide"> Hidden</label>
          <p class="fdHint">Locked and Hidden only count while the sheet is protected: then locked cells cannot be changed (unlocked ones can be typed in), and a hidden cell's formula is not shown in the ƒx bar. Every cell starts locked - untick Locked on the cells people should still fill in.</p>
          <fieldset style="margin-top:10px"><legend>This sheet</legend><label class="ck"><input type="checkbox" id="fdProtect"> Protect this sheet when I press OK</label>
            <p class="fdHint">Also from the sheet's tab: right-click ▸ Protect sheet / Unprotect sheet. There is no password - protection keeps cells from being changed by accident.</p></fieldset>
        </div>
      </div>
      <div class="fdFoot"><span class="fdNote" id="fdNote" data-noi18n></span><button type="button" class="ghost" id="fdCancel">Cancel</button><button type="button" class="ghost" id="fdOk">OK</button></div>`;
    doc.body.appendChild(dlg);
    wire();
  }

  /* ------------------------------------------------------------------ the state */
  function edgesOf(s) {
    const I = X(), st = (c, r) => I.style(c, r).bd || {};
    const val = (list) => { if (!list.length) return null; const vs = list.map((b) => { const o = I.sideOf(b); return o ? JSON.stringify({ s: o.s, c: I.okColor(o.c) || undefined }) : "null"; }); return vs.every((x) => x === vs[0]) ? JSON.parse(vs[0]) : "mixed"; };
    const cap = (arr) => arr.slice(0, 2000);
    const row = (r, k) => { const o = []; for (let c = s.c1; c <= s.c2; c++) o.push(st(c, r)[k]); return o; };
    const col = (c, k) => { const o = []; for (let r = s.r1; r <= s.r2; r++) o.push(st(c, r)[k]); return o; };
    const all = (k, f) => { const o = []; for (let r = s.r1; r <= s.r2 && o.length < 2000; r++) for (let c = s.c1; c <= s.c2; c++) if (!f || f(c, r)) o.push(st(c, r)[k]); return o; };
    return { top: val(cap(row(s.r1, "t"))), bottom: val(cap(row(s.r2, "b"))), left: val(cap(col(s.c1, "l"))), right: val(cap(col(s.c2, "r"))),
      insideH: s.r2 > s.r1 ? val(all("b", (c, r) => r < s.r2)) : null, insideV: s.c2 > s.c1 ? val(all("r", (c, r) => c < s.c2)) : null, d1: val(all("d1")), d2: val(all("d2")) };
  }
  function init() {
    const I = X(), St = H().St, cell = I.cellAt(St.act.c, St.act.r) || {}, S = cell.s || {};
    SEL = I.norm(St.sel);
    const code = I.codeOf(cell), det = F().detect(code);
    D = { code, cat: det.cat, opt: Object.assign({ dp: 2, sep: false, neg: "minus", sym: "$", type: "" }, det.opt) };
    if (det.cat === "Custom") D.opt.type = code;
    D.v = H().book().get(H().W.active, St.act.c, St.act.r);
    Object.assign(D, { ha: S.align || "general", ind: +S.indent || 0, va: S.valign || "bottom", wrap: !!S.wrap, shrink: !!S.shrink, dir: S.dir || "", rot: +S.rot || 0, stack: !!S.stack });
    D.merge = (I.sh().merges || []).some((g) => { const [a, b] = g.split(":").map((x) => root.SheetCalc.parseAddr(x)); return !(b.r < SEL.r1 || a.r > SEL.r2 || b.c < SEL.c1 || a.c > SEL.c2); });
    Object.assign(D, { font: S.font || "", b: !!S.b, i: !!S.i, size: +S.size || 9, u: S.u === true ? "single" : S.u || "none", color: I.okColor(S.color), strike: !!S.strike, sup: !!S.sup, sub: !!S.sub });
    D.bd = edgesOf(SEL); D.ls = "thin"; D.lc = null;
    D.bg = I.okColor(S.bg); D.pat = { t: (S.pat && S.pat.t) || "", c: S.pat ? I.okColor(S.pat.c) : null };
    D.grad = S.grad ? { c1: I.okColor(S.grad.c1) || "#ffffff", c2: I.okColor(S.grad.c2) || "#4472c4", d: S.grad.d || "c" } : { c1: "#ffffff", c2: "#4472c4", d: "" };
    D.unlock = !!S.unlock; D.hide = !!S.hide; D.protect = !!I.sh().protect;
    T = new Set();
  }

  /* ------------------------------------------------------------------ Number */
  const sampleValue = () => (typeof D.v === "number" ? D.v : D.cat === "Date" || D.cat === "Time" ? 46343.5458 : D.v === "" || D.v == null ? 1234.5678 : D.v);
  function sampleHtml(code, v) { const R = F().render(v, code); return `<span data-noi18n${R.color ? ` style="color:${R.color}"` : ""}>${esc(R.fill ? R.fill.left + " " + R.fill.right : R.text)}</span>`; }
  function paintSample() { $("fdSample").innerHTML = D.v === "" || D.v == null ? `${sampleHtml(D.code, 1234.5678)} <span style="color:var(--dim);font-family:inherit">(the cell is empty - a sample number)</span>` : sampleHtml(D.code, D.v); }
  function paintNumber() {
    for (const el of dlg.querySelectorAll("#fdCats [data-cat]")) el.classList.toggle("on", el.dataset.cat === D.cat);
    const o = D.opt, cat = D.cat, Fm = F();
    const dp = `<label>Decimal places: <input type="number" id="fdDp" min="0" max="30" step="1" value="${o.dp}" style="width:60px"></label>`;
    const negList = () => `<div>Negative numbers:</div><div class="fdList fdTypes" style="height:96px" data-noi18n>${Fm.NEG.map((n) => `<div data-neg="${n}" class="${o.neg === n ? "on" : ""}">${sampleHtml(Fm.build(cat, Object.assign({}, o, { neg: n })), -1234.1)}</div>`).join("")}</div>`;
    const sym = `<label>Symbol: <select id="fdSym">${Fm.SYMBOLS.map((s) => `<option value="${esc(s.id)}"${s.id === o.sym ? " selected" : ""}>${esc(s.label)}</option>`).join("")}</select></label>`;
    const types = (list) => `<div>Type:</div><div class="fdList fdTypes" data-noi18n>${list.map(([code, label]) => `<div data-type="${esc(code)}" class="${code === o.type ? "on" : ""}" title="${esc(code)}">${label ? esc(label) + " " : ""}<span style="color:var(--dim)">${sampleHtml(code, sampleValue())}</span></div>`).join("")}</div>`;
    let h = "";
    switch (cat) {
      case "Number": h = dp + `<label class="ck"><input type="checkbox" id="fdSep"${o.sep ? " checked" : ""}> Use 1000 separator (,)</label>` + negList(); break;
      case "Currency": h = dp + sym + negList(); break;
      case "Accounting": h = dp + sym; break;
      case "Percentage": case "Scientific": h = dp; break;
      case "Date": h = types(Fm.DATES.map((c) => [c, ""])); break;
      case "Time": h = types(Fm.TIMES.map((c) => [c, ""])); break;
      case "Fraction": h = types(Fm.FRACTIONS); break;
      case "Special": h = types(Fm.SPECIAL); break;
      case "Custom": {
        const used = new Set(); for (const S of H().W.sheets) for (const c of Object.values(S.cells)) if (c.f && !Fm.CUSTOM.includes(c.f)) used.add(X().codeOf(c));
        h = `<label>Type: <input type="text" id="fdCode" value="${esc(o.type || D.code)}" style="flex:1;font-family:monospace" data-noi18n></label>` + `<div class="fdList fdTypes" style="height:230px;font-family:monospace" data-noi18n>${[...Fm.CUSTOM, ...used].map((c) => `<div data-type="${esc(c)}" class="${c === (o.type || D.code) ? "on" : ""}">${esc(c)}</div>`).join("")}</div>`;
        break;
      }
      default: h = "";
    }
    $("fdOpts").innerHTML = h;
    $("fdHint").textContent = CAT_HINT[cat] || "";
    paintSample();
  }
  function setNum(patch, repaint) { Object.assign(D.opt, patch); D.code = F().build(D.cat, D.opt); touch("fmt"); if (repaint) paintNumber(); else { paintSample(); for (const el of dlg.querySelectorAll("#fdOpts [data-neg]")) el.classList.toggle("on", el.dataset.neg === D.opt.neg); } }

  /* ------------------------------------------------------------------ Alignment */
  function paintDial() {
    const a = D.stack ? 0 : D.rot, rad = (a * Math.PI) / 180, cx = 22, cy = 65, R = 52;
    let h = `<path d="M ${cx} ${cy - R} A ${R} ${R} 0 0 1 ${cx} ${cy + R}" fill="none" stroke="var(--line)"/>`;
    for (let d = -90; d <= 90; d += 15) { const r2 = (d * Math.PI) / 180; h += `<circle cx="${cx + R * Math.cos(r2)}" cy="${cy - R * Math.sin(r2)}" r="${d % 45 === 0 ? 2.6 : 1.6}" fill="${d === a ? "var(--tiger)" : "var(--dim)"}"/>`; }
    const ex = cx + R * Math.cos(rad), ey = cy - R * Math.sin(rad);
    h += `<line x1="${cx + 30 * Math.cos(rad)}" y1="${cy - 30 * Math.sin(rad)}" x2="${ex}" y2="${ey}" stroke="var(--tiger)" stroke-width="2"/>`;
    h += `<text x="${cx}" y="${cy}" font-size="11" fill="var(--text)" transform="rotate(${-a} ${cx} ${cy})" dominant-baseline="middle">Text</text>`;
    h += `<circle cx="${ex}" cy="${ey}" r="4" fill="var(--tiger)"/>`;
    $("fdDial").innerHTML = h;
  }
  function paintAlign() {
    $("fdHa").value = D.ha; $("fdVa").value = D.va; $("fdInd").value = D.ind; $("fdInd").disabled = !["left", "right", "distributed"].includes(D.ha);
    $("fdWrap").checked = D.wrap; $("fdShrink").checked = D.shrink; $("fdShrink").disabled = D.wrap; $("fdMerge").checked = D.merge; $("fdDir").value = D.dir;
    $("fdRot").value = D.stack ? "" : D.rot; $("fdRot").disabled = D.stack; $("fdStack").classList.toggle("on", D.stack);
    paintDial();
  }

  /* ------------------------------------------------------------------ Font */
  function paintFont() {
    const sel = $("fdFont");
    if (D.font && ![...sel.options].some((o) => o.value === D.font)) { const op = doc.createElement("option"); op.value = D.font; op.textContent = D.font; op.setAttribute("data-noi18n", ""); sel.appendChild(op); }
    sel.value = D.font; $("fdFs").value = (D.b ? "b" : "") + (D.i ? "i" : "") || "r"; $("fdSize").value = D.size; $("fdU").value = D.u;
    $("fdColAuto").checked = !D.color; if (D.color) $("fdCol").value = D.color.length === 4 ? "#" + D.color.slice(1).split("").map((x) => x + x).join("") : D.color.slice(0, 7);
    $("fdStrike").checked = D.strike; $("fdSup").checked = D.sup; $("fdSub").checked = D.sub;
    $("fdNormal").checked = !D.font && !D.b && !D.i && +D.size === 9 && D.u === "none" && !D.color && !D.strike && !D.sup && !D.sub;
    const p = $("fdFontPrev").firstElementChild, deco = [D.u !== "none" ? "underline" : "", D.strike ? "line-through" : ""].filter(Boolean).join(" ");
    p.style.cssText = `font-family:${D.font ? `'${X().okFont(D.font)}',` : ""}inherit;font-weight:${D.b ? 700 : 400};font-style:${D.i ? "italic" : "normal"};font-size:${Math.min(40, (+D.size || 9) * 4 / 3)}px;color:${D.color || "var(--text)"};text-decoration:${deco || "none"};` +
      (D.u === "double" || D.u === "dacc" ? "text-decoration-style:double;" : "") + (D.sup ? "vertical-align:super;font-size:75%;" : D.sub ? "vertical-align:sub;font-size:75%;" : "");
  }

  /* ------------------------------------------------------------------ Border */
  function lineOf(v, x1, y1, x2, y2, edge) {
    let vis = "";
    if (v === "mixed") vis = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--dim)" stroke-width="3" stroke-dasharray="2 3" opacity=".6"/>`;
    else if (v) {
      const c = v.c || "var(--text)";
      if (v.s === "double") { const dx = y1 === y2 ? 0 : 1.6, dy = y1 === y2 ? 1.6 : 0; vis = `<line x1="${x1 - dx}" y1="${y1 - dy}" x2="${x2 - dx}" y2="${y2 - dy}" stroke="${c}"/><line x1="${x1 + dx}" y1="${y1 + dy}" x2="${x2 + dx}" y2="${y2 + dy}" stroke="${c}"/>`; }
      else vis = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${LW[v.s] || 1}"${DASH[v.s] ? ` stroke-dasharray="${DASH[v.s]}"` : ""}/>`;
    }
    return vis + `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="12" data-edge="${edge}" style="cursor:pointer"/>`;
  }
  function paintBorder() {
    for (const b of dlg.querySelectorAll("[data-ls]")) b.classList.toggle("on", b.dataset.ls === D.ls);
    $("fdLcAuto").checked = !D.lc; if (D.lc) $("fdLc").value = D.lc;
    const multiR = SEL.r2 > SEL.r1, multiC = SEL.c2 > SEL.c1;
    for (const b of dlg.querySelectorAll(".fdEdge")) { const e = b.dataset.edge; b.disabled = (e === "insideH" && !multiR) || (e === "insideV" && !multiC); b.classList.toggle("on", !!D.bd[e] && D.bd[e] !== "mixed"); }
    const L = 20, R = 180, Tp = 12, B = 108, mx = (L + R) / 2, my = (Tp + B) / 2;
    let h = `<rect x="${L}" y="${Tp}" width="${R - L}" height="${B - Tp}" fill="none" stroke="var(--line)" stroke-dasharray="1 3"/>`;
    for (const [cx, cy] of multiR || multiC ? [[multiC ? (L + mx) / 2 : mx, multiR ? (Tp + my) / 2 : my], ...(multiC ? [[(mx + R) / 2, multiR ? (Tp + my) / 2 : my]] : []), ...(multiR ? [[multiC ? (L + mx) / 2 : mx, (my + B) / 2]] : []), ...(multiR && multiC ? [[(mx + R) / 2, (my + B) / 2]] : [])] : [[mx, my]])
      h += `<text x="${cx}" y="${cy}" font-size="11" fill="var(--dim)" text-anchor="middle" dominant-baseline="middle">Text</text>`;
    h += lineOf(D.bd.top, L, Tp, R, Tp, "top") + lineOf(D.bd.bottom, L, B, R, B, "bottom") + lineOf(D.bd.left, L, Tp, L, B, "left") + lineOf(D.bd.right, R, Tp, R, B, "right");
    if (multiR) h += lineOf(D.bd.insideH, L, my, R, my, "insideH");
    if (multiC) h += lineOf(D.bd.insideV, mx, Tp, mx, B, "insideV");
    h += lineOf(D.bd.d1, L, B, R, Tp, "d1") + lineOf(D.bd.d2, L, Tp, R, B, "d2");
    $("fdBdPrev").innerHTML = h;
  }
  const want = () => (D.ls === "none" ? null : Object.assign({ s: D.ls }, D.lc ? { c: D.lc } : {}));
  const same = (a, b) => a && b && a !== "mixed" && a.s === b.s && (a.c || null) === (b.c || null);
  function toggleEdge(e) { const w = want(); D.bd[e] = !w || same(D.bd[e], w) ? null : w; touch("bd." + e); paintBorder(); }
  function preset(p) {
    const w = want();
    if (p === "none") for (const e of EDGES) { D.bd[e] = null; touch("bd." + e); }
    if (p === "outline") for (const e of ["top", "bottom", "left", "right"]) { D.bd[e] = w; touch("bd." + e); }
    if (p === "inside") { if (SEL.r2 > SEL.r1) { D.bd.insideH = w; touch("bd.insideH"); } if (SEL.c2 > SEL.c1) { D.bd.insideV = w; touch("bd.insideV"); } }
    paintBorder();
  }

  /* ------------------------------------------------------------------ Fill */
  function fillState() { return { bg: D.bg, pat: D.pat.t ? { t: D.pat.t, c: D.pat.c } : null, grad: D.grad.d ? D.grad : null }; }
  function paintFill() {
    for (const b of dlg.querySelectorAll("[data-bg]")) b.classList.toggle("on", !!D.bg && b.dataset.bg.toLowerCase() === D.bg.toLowerCase() && !D.grad.d);
    for (const b of dlg.querySelectorAll("[data-pat]")) { b.classList.toggle("on", b.dataset.pat === D.pat.t); if (b.dataset.pat) b.style.backgroundImage = X().patternUrl(b.dataset.pat, D.pat.c || X().autoInk()); }
    $("fdPcAuto").checked = !D.pat.c; if (D.pat.c) $("fdPc").value = D.pat.c;
    $("fdG1").value = D.grad.c1; $("fdG2").value = D.grad.c2; $("fdGd").value = D.grad.d;
    const css = X().fillCss(fillState());
    $("fdFillPrev").style.cssText = css || "background:var(--panel)";
  }

  /* ------------------------------------------------------------------ Protection */
  function paintProt() { $("fdLock").checked = !D.unlock; $("fdHide").checked = D.hide; $("fdProtect").checked = D.protect; }

  function paintAll() { paintNumber(); paintAlign(); paintFont(); paintBorder(); paintFill(); paintProt(); }
  function tab(k) {
    for (const b of dlg.querySelectorAll("[data-tab]")) b.classList.toggle("on", b.dataset.tab === k);
    for (const p of dlg.querySelectorAll("[data-pane]")) p.classList.toggle("on", p.dataset.pane === k);
    try { root.localStorage.setItem("h3.sheet.fmttab", k); } catch (e) { /* fine */ }
  }

  /* ------------------------------------------------------------------ events */
  function wire() {
    const on = (sel, ev, fn) => dlg.addEventListener(ev, (e) => { const t = e.target.closest(sel); if (t && dlg.contains(t)) fn(t, e); });
    on("[data-tab]", "click", (t) => tab(t.dataset.tab));
    on("[data-x], #fdCancel", "click", () => dlg.close());
    on("#fdOk", "click", apply);
    dlg.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && !e.target.closest("textarea, select") && e.target.id !== "fdCode") { e.preventDefault(); apply(); } });
    // Number
    on("[data-cat]", "click", (t) => {
      const cat = t.dataset.cat, o = D.opt; D.cat = cat;
      if (cat === "Date" && !F().DATES.includes(o.type)) o.type = F().DATES[0];
      if (cat === "Time" && !F().TIMES.includes(o.type)) o.type = F().TIMES[0];
      if (cat === "Fraction" && !F().FRACTIONS.some((x) => x[0] === o.type)) o.type = F().FRACTIONS[0][0];
      if (cat === "Special" && !F().SPECIAL.some((x) => x[0] === o.type)) o.type = F().SPECIAL[0][0];
      if (cat === "Custom") o.type = D.code;
      setNum({}, true);
    });
    on("#fdDp", "input", (t) => setNum({ dp: Math.max(0, Math.min(30, Math.round(+t.value || 0))) }));
    on("#fdSep", "change", (t) => setNum({ sep: t.checked }));
    on("#fdSym", "change", (t) => setNum({ sym: t.value }));
    on("[data-neg]", "click", (t) => setNum({ neg: t.dataset.neg }));
    on("[data-type]", "click", (t) => { setNum({ type: t.dataset.type }); for (const el of dlg.querySelectorAll("#fdOpts [data-type]")) el.classList.toggle("on", el === t); const c = $("fdCode"); if (c) c.value = t.dataset.type; });
    on("[data-type]", "dblclick", () => apply());
    on("#fdCode", "input", (t) => { D.opt.type = t.value; D.code = t.value || "General"; touch("fmt"); paintSample(); });
    // Alignment
    on("#fdHa", "change", (t) => { D.ha = t.value; touch("ha"); if (!["left", "right", "distributed"].includes(D.ha) && D.ind) { D.ind = 0; touch("ind"); } paintAlign(); });
    on("#fdInd", "input", (t) => { D.ind = Math.max(0, Math.min(15, Math.round(+t.value || 0))); touch("ind"); });
    on("#fdVa", "change", (t) => { D.va = t.value; touch("va"); });
    on("#fdWrap", "change", (t) => { D.wrap = t.checked; touch("wrap"); if (D.wrap && D.shrink) { D.shrink = false; touch("shrink"); } paintAlign(); });
    on("#fdShrink", "change", (t) => { D.shrink = t.checked; touch("shrink"); });
    on("#fdMerge", "change", (t) => { D.merge = t.checked; touch("merge"); });
    on("#fdDir", "change", (t) => { D.dir = t.value; touch("dir"); });
    on("#fdRot", "input", (t) => { D.rot = Math.max(-90, Math.min(90, Math.round(+t.value || 0))); D.stack = false; touch("rot"); paintDial(); });
    on("#fdStack", "click", () => { D.stack = !D.stack; if (D.stack) D.rot = 0; touch("rot"); paintAlign(); });
    const dial = (e) => { const r = $("fdDial").getBoundingClientRect(), x = (e.clientX - r.left) * 130 / r.width - 22, y = (e.clientY - r.top) * 130 / r.height - 65; let a = Math.round((Math.atan2(-y, Math.max(0, x)) * 180) / Math.PI); if (!e.shiftKey) a = Math.round(a / 5) * 5; D.rot = Math.max(-90, Math.min(90, a)); D.stack = false; touch("rot"); paintAlign(); };
    on("#fdDial", "pointerdown", (t, e) => { e.preventDefault(); dial(e); t.setPointerCapture(e.pointerId); const mv = (ev) => dial(ev), up = () => { t.removeEventListener("pointermove", mv); t.removeEventListener("pointerup", up); }; t.addEventListener("pointermove", mv); t.addEventListener("pointerup", up); });
    // Font
    on("#fdFont", "change", (t) => { D.font = t.value; touch("font"); paintFont(); });
    on("#fdFs", "change", (t) => { D.b = /b/.test(t.value); D.i = /i/.test(t.value); touch("fs"); paintFont(); });
    on("#fdSize", "input", (t) => { const n = +t.value; if (n > 0 && n <= 409) { D.size = n; touch("size"); paintFont(); } });
    on("#fdU", "change", (t) => { D.u = t.value; touch("u"); paintFont(); });
    on("#fdColAuto", "change", (t) => { D.color = t.checked ? null : $("fdCol").value; touch("color"); paintFont(); });
    on("#fdCol", "input", (t) => { D.color = t.value; touch("color"); paintFont(); });
    on("#fdStrike", "change", (t) => { D.strike = t.checked; touch("strike"); paintFont(); });
    on("#fdSup", "change", (t) => { D.sup = t.checked; if (t.checked) D.sub = false; touch("sup"); paintFont(); });
    on("#fdSub", "change", (t) => { D.sub = t.checked; if (t.checked) D.sup = false; touch("sup"); paintFont(); });
    on("#fdNormal", "change", (t) => { if (!t.checked) return paintFont(); Object.assign(D, { font: "", b: false, i: false, size: 9, u: "none", color: null, strike: false, sup: false, sub: false }); for (const k of ["font", "fs", "size", "u", "color", "strike", "sup"]) touch(k); paintFont(); });
    // Border
    on("[data-ls]", "click", (t) => { D.ls = t.dataset.ls; paintBorder(); });
    on("#fdLcAuto", "change", (t) => { D.lc = t.checked ? null : $("fdLc").value; paintBorder(); });
    on("#fdLc", "input", (t) => { D.lc = t.value; $("fdLcAuto").checked = false; paintBorder(); });
    on("[data-pre]", "click", (t) => preset(t.dataset.pre));
    on("[data-edge]", "click", (t) => { if (!t.disabled) toggleEdge(t.dataset.edge); });
    // Fill
    on("#fdNoFill", "click", () => { D.bg = null; D.pat.t = ""; D.grad.d = ""; touch("fill"); paintFill(); });
    on("[data-bg]", "click", (t) => { D.bg = t.dataset.bg; D.grad.d = ""; touch("fill"); paintFill(); });
    on("#fdBgMore", "input", (t) => { D.bg = t.value; D.grad.d = ""; touch("fill"); paintFill(); });
    on("#fdG1", "input", (t) => { D.grad.c1 = t.value; if (!D.grad.d) D.grad.d = "h"; touch("fill"); paintFill(); });
    on("#fdG2", "input", (t) => { D.grad.c2 = t.value; if (!D.grad.d) D.grad.d = "h"; touch("fill"); paintFill(); });
    on("#fdGd", "change", (t) => { D.grad.d = t.value; touch("fill"); paintFill(); });
    on("#fdPcAuto", "change", (t) => { D.pat.c = t.checked ? null : $("fdPc").value; touch("fill"); paintFill(); });
    on("#fdPc", "input", (t) => { D.pat.c = t.value; touch("fill"); paintFill(); });
    on("[data-pat]", "click", (t) => { D.pat.t = t.dataset.pat; touch("fill"); paintFill(); });
    // Protection
    on("#fdLock", "change", (t) => { D.unlock = !t.checked; touch("lock"); });
    on("#fdHide", "change", (t) => { D.hide = t.checked; touch("hide"); });
    on("#fdProtect", "change", (t) => { D.protect = t.checked; touch("protect"); });
  }

  /* ------------------------------------------------------------------ OK */
  function apply() {
    const I = X(), St = H().St, s = SEL, has = (k) => T.has(k);
    if (!T.size) { dlg.close(); return; }
    I.step();
    const bdKeys = EDGES.filter((e) => has("bd." + e));
    const side = (v) => (v && v !== "mixed" ? Object.assign({ s: v.s }, v.c ? { c: v.c } : {}) : null);
    I.eachSel((c, r) => I.setStyle(c, r, (S, cell) => {
      if (has("fmt")) { delete S.dp; if (!D.code || /^general$/i.test(D.code)) delete cell.f; else cell.f = D.code; }
      if (has("ha")) S.align = D.ha === "general" ? null : D.ha;
      if (has("ind")) S.indent = D.ind || null;
      if (has("va")) S.valign = D.va === "bottom" ? null : D.va;
      if (has("wrap")) S.wrap = D.wrap || null;
      if (has("shrink")) S.shrink = D.shrink || null;
      if (has("dir")) S.dir = D.dir || null;
      if (has("rot")) { S.rot = D.stack ? null : D.rot || null; S.stack = D.stack || null; }
      if (has("font")) S.font = D.font || null;
      if (has("fs")) { S.b = D.b || null; S.i = D.i || null; }
      if (has("size")) S.size = +D.size && +D.size !== 9 ? +D.size : null;
      if (has("u")) S.u = D.u === "none" ? null : D.u === "single" ? true : D.u;
      if (has("color")) S.color = D.color || null;
      if (has("strike")) S.strike = D.strike || null;
      if (has("sup")) { S.sup = D.sup || null; S.sub = D.sub || null; }
      if (has("fill")) { const f = fillState(); S.bg = f.bg || null; S.pat = f.pat ? Object.assign({ t: f.pat.t }, f.pat.c ? { c: f.pat.c } : {}) : null; S.grad = f.grad ? { c1: f.grad.c1, c2: f.grad.c2, d: f.grad.d } : null; }
      if (has("lock")) S.unlock = D.unlock || null;
      if (has("hide")) S.hide = D.hide || null;
      if (bdKeys.length) {
        const bd = Object.assign({}, S.bd || {});
        const put = (k, v) => { if (v === "mixed") return; const o = side(v); if (o) bd[k] = o; else delete bd[k]; };
        if (has("bd.top") && r === s.r1) put("t", D.bd.top);
        if (has("bd.bottom") && r === s.r2) put("b", D.bd.bottom);
        if (has("bd.left") && c === s.c1) put("l", D.bd.left);
        if (has("bd.right") && c === s.c2) put("r", D.bd.right);
        if (has("bd.insideH")) { if (r < s.r2) put("b", D.bd.insideH); if (r > s.r1 && D.bd.insideH !== "mixed") delete bd.t; }
        if (has("bd.insideV")) { if (c < s.c2) put("r", D.bd.insideV); if (c > s.c1 && D.bd.insideV !== "mixed") delete bd.l; }
        if (has("bd.d1")) put("d1", D.bd.d1);
        if (has("bd.d2")) put("d2", D.bd.d2);
        S.bd = Object.keys(bd).length ? bd : null;
      }
    }));
    const sh = I.sh();
    if (has("merge")) {
      const M = sh.merges || (sh.merges = []);
      for (let k = M.length - 1; k >= 0; k--) { const [a, b] = M[k].split(":").map((x) => root.SheetCalc.parseAddr(x)); if (!(b.r < s.r1 || a.r > s.r2 || b.c < s.c1 || a.c > s.c2)) M.splice(k, 1); }
      if (D.merge && (s.r2 > s.r1 || s.c2 > s.c1)) {
        M.push(root.SheetCalc.addr(s.c1, s.r1) + ":" + root.SheetCalc.addr(s.c2, s.r2));
        for (let r = s.r1; r <= s.r2; r++) for (let c = s.c1; c <= s.c2; c++) if (r !== s.r1 || c !== s.c1) { const cell = I.cellAt(c, r); if (cell) delete cell.v; }
        St.act = { r: s.r1, c: s.c1 };
      }
    }
    // taller rows for a bigger font, turned or wrapped text (only ever grown; a row you sized stays if it is tall enough)
    if (has("size") || has("rot") || has("wrap")) {
      for (let r = s.r1; r <= Math.min(s.r2, s.r1 + 500); r++) {
        let need = 0;
        for (let c = s.c1; c <= s.c2; c++) {
          const S = I.style(c, r), px = (+S.size || 9) * 4 / 3;
          need = Math.max(need, Math.ceil(px * 1.4) + 4);
          const t = H().shown(c, r);
          if (t && S.wrap && !S.stack && !S.rot) {
            const avail = Math.max(10, (sh.cols[c] || I.DW) - 8), lh = S.size ? Math.round(px * 1.3) : 15, fnt = I.fontOf(S);
            const lines = String(t).split("\n").reduce((n, para) => n + Math.max(1, Math.ceil(I.measure(para, fnt) / avail)), 0);
            need = Math.max(need, lines * lh + 6);
          }
          if (t && (S.stack || S.rot)) { const w = I.measure(t, I.fontOf(S)); need = Math.max(need, Math.ceil(S.stack ? t.length * px * 1.15 + 8 : w * Math.abs(Math.sin((+S.rot * Math.PI) / 180)) + px + 8)); }
        }
        need = Math.min(409, need);
        if (need > (sh.rows[r] || I.DH)) sh.rows[r] = need;
      }
    }
    if (has("protect")) { sh.protect = D.protect || undefined; I.tabs(); }
    I.changed();
    dlg.close();
    const where = s.r1 === s.r2 && s.c1 === s.c2 ? root.SheetCalc.addr(s.c1, s.r1) : root.SheetCalc.addr(s.c1, s.r1) + ":" + root.SheetCalc.addr(s.c2, s.r2);
    I.msg("▤ formatted " + where);
    const g = doc.getElementById("shGrid"); if (g) g.focus({ preventScroll: true });
  }

  function open(which) {
    if (!H() || !X() || !F()) return;
    if (X().guardSheet()) return;
    if (!dlg) build();
    init();
    paintAll();
    let k = which; if (!k) { try { k = root.localStorage.getItem("h3.sheet.fmttab"); } catch (e) { k = null; } }
    tab(TABS.some((t) => t[0] === k) ? k : "number");
    const s = SEL; $("fdNote").textContent = s.r1 === s.r2 && s.c1 === s.c2 ? root.SheetCalc.addr(s.c1, s.r1) : root.SheetCalc.addr(s.c1, s.r1) + ":" + root.SheetCalc.addr(s.c2, s.r2);
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  }
  root.H3SheetFormat = { open, get state() { return D; }, get touched() { return T; }, apply, close: () => dlg && dlg.close() };
})(window);
