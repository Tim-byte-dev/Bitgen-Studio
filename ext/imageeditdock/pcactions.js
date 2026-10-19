/* pcactions.js — THE IMAGE EDITOR'S ACTIONS (RECORD / PLAY / EDIT) AND FILE ▸ AUTOMATE ▸ BATCH (2.427.0), window.PCActions.
 *
 * Tim: "continue with the photoshop gap closure" - the order agreed with the 2.425.0 plan: "2.427.0 Actions + batch".
 * Photoshop's, our own code:
 *
 *   ACTIONS     the Actions tab (next to History; Window ▸ Actions, Alt+F9): sets ▸ actions ▸ steps. ● records what you
 *               do: every menu command / shortcut / palette command (pcui's run -> E.ui.onRun), the values of the dialog
 *               it opened when you press OK (E.ui.onDialogOk - Cancel drops the step), filters and adjustments with
 *               their settings (imageedit's E.onFilterDone), the Layers panel's buttons, blend mode and opacity. ■
 *               stops. ▶ plays the picked action (or from the picked step); each step can be switched off (☑) or made
 *               to stop in its dialog (▢ - the "dialog toggle"); Insert Stop (a message, Continue / Stop), Insert Menu
 *               Item; ▲ ▼ move, double-click renames / records a step's dialog again; a function key per action;
 *               Button Mode; Load / Save Actions (.json); a Default Actions set.
 *   BATCH       File ▸ Automate ▸ Batch…: an action over picked files or a folder: each picture opened, played, saved -
 *               to the project (projects/<p>/batch/<run>/, lib/batchStore.js + routes/batch.js), to the image gallery,
 *               downloaded, or left - PNG or JPEG, a name suffix; stop on an error or log it and go on; a report.
 *
 * Pure (Node: scripts/test-psactions.js): DEFAULT_SETS, normalize, stepLabel, summary, captureFrom, fileName, freeKeys,
 * isRecordable.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const NOT_RECORDED = /^(win\.|view\.|help\.|theme\.|tool\.|act\.|edit\.undo|edit\.redo|file\.(open|save|export|download|place|new)|sel\.segset|ch\.view\.|so\.(done|cancel))/;
  const isRecordable = (id) => !!id && !NOT_RECORDED.test(id);
  const KEYS = ["F2", "F3", "F4", "F9", "F11", "Shift+F2", "Shift+F3", "Shift+F4", "Shift+F7", "Shift+F8", "Shift+F9", "Shift+F10", "Shift+F11", "Shift+F12"];
  /** the function keys an action can still take (not the editor's own, not another action's) */
  const freeKeys = (used, taken) => KEYS.filter((k) => !(used || []).includes(k) && !(taken || []).includes(k));
  const DEFAULT_SETS = [{ name: "Default Actions", open: true, actions: [
    { name: "Vignette", steps: [{ kind: "filter", id: "vignette", params: {}, label: "Vignette" }] },
    { name: "Sepia Toning (layer)", steps: [{ kind: "cmd", id: "layer.dup", label: "Duplicate Layer" }, { kind: "filter", id: "sepia", params: {}, label: "Sepia" }, { kind: "set", what: "opacity", value: 80, label: "Set Opacity" }] },
    { name: "Black & White Punch", steps: [{ kind: "filter", id: "bw", params: {}, label: "Black & White" }, { kind: "cmd", id: "image.autocontrast", label: "Auto Contrast" }] },
    { name: "Soft Glow", steps: [{ kind: "cmd", id: "layer.dup", label: "Duplicate Layer" }, { kind: "filter", id: "gaussian", params: {}, label: "Gaussian Blur" }, { kind: "set", what: "blend", value: "screen", label: "Set Blend Mode" }, { kind: "set", what: "opacity", value: 50, label: "Set Opacity" }] },
    { name: "Sharpen + Flatten", steps: [{ kind: "filter", id: "unsharp", params: {}, label: "Unsharp Mask" }, { kind: "cmd", id: "layer.flatten", label: "Flatten Image" }] },
  ] }];
  const clone = (o) => JSON.parse(JSON.stringify(o));
  /** sets from storage / a file, made sane */
  function normalize(sets) {
    const okStep = (s) => s && typeof s === "object" && ((s.kind === "cmd" && typeof s.id === "string") || (s.kind === "filter" && typeof s.id === "string") || (s.kind === "set" && ["opacity", "blend", "fill"].includes(s.what)) || (s.kind === "stop")
      // 2.468.0 (pcactionsx.js): a brush stroke, a hand-made selection, a conditional
      || (s.kind === "stroke" && Array.isArray(s.pts) && typeof s.tool === "string") || (s.kind === "sel" && s.path && Array.isArray(s.path.subs)) || (s.kind === "cond" && typeof s.test === "string"));
    return (Array.isArray(sets) ? sets : []).filter((s) => s && typeof s.name === "string").map((s) => ({ name: s.name.slice(0, 60), open: s.open !== false,
      actions: (Array.isArray(s.actions) ? s.actions : []).filter((a) => a && typeof a.name === "string").map((a) => Object.assign({ name: a.name.slice(0, 60), steps: (Array.isArray(a.steps) ? a.steps : []).filter(okStep).map((x) => Object.assign({ on: x.on !== false }, x)) },
        a.key ? { key: String(a.key) } : {}, a.open ? { open: true } : {})) }));
  }
  /** a step's name in the panel */
  function stepLabel(st, cmdLabel) {
    if (st.kind === "stop") return "Stop" + (st.msg ? ": " + st.msg : "");
    if (st.kind === "set") return st.what === "blend" ? "Set Blend Mode" : st.what === "fill" ? "Set Fill" : "Set Opacity";
    if (st.kind === "stroke") return st.label || "Brush Stroke";
    if (st.kind === "sel") return st.path.subs.length ? "Set Selection" : "Deselect";
    if (st.kind === "cond") return "Conditional";
    return String(st.label || (cmdLabel ? cmdLabel(st.id) : st.id)).replace(/…$/, "");
  }
  /** what a step does, in a few words (its settings) */
  function summary(st) {
    if (st.kind === "set") return st.what === "blend" ? String(st.value) : st.value + " %";
    if (st.kind === "stop") return st.cont === false ? "" : "with Continue";
    if (st.kind === "stroke") return `${st.pts.length} points, ${Math.round(st.size || 0)} px${st.fg ? ", " + st.fg : ""}`;
    if (st.kind === "sel") return st.path.subs.length ? `${st.path.subs.length} outline(s) - ${st.how || "drawn by hand"}` : "";
    if (st.kind === "cond") return `if ${st.test}: ${st.then ? st.then.join(" ▸ ") : "nothing"}${st.else ? " · else " + st.else.join(" ▸ ") : ""}`;
    const vals = st.kind === "filter" ? st.params : st.dialog && st.dialog.values;
    if (!vals) return "";
    return Object.entries(vals).filter(([, v]) => v !== "" && v != null && typeof v !== "object").slice(0, 4).map(([k, v]) => `${k.replace(/^(pd|pc|pt|pn|op|vl)/, "")}: ${typeof v === "boolean" ? (v ? "on" : "off") : v}`).join(", ");
  }
  /** a dialog's settings: every input / select / textarea with an id (checkboxes and radios as true / false) */
  function captureFrom(els) {
    const out = {};
    for (const el of els) {
      if (!el || !el.id || el.type === "button" || el.type === "file") continue;
      out[el.id] = el.type === "checkbox" || el.type === "radio" ? !!el.checked : el.value;
    }
    return out;
  }
  /** a batch result's name: the picture's name + the suffix, the format's extension */
  const fileName = (name, suffix, ext) => String(name || "picture").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[^\w .()-]+/g, "_").slice(0, 90) + (suffix || "") + "." + (ext === "jpg" ? "jpg" : "png");
  const pure = { NOT_RECORDED, isRecordable, KEYS, freeKeys, DEFAULT_SETS, normalize, stepLabel, summary, captureFrom, fileName };

  /* ================================ the editor ================================ */
  function install(E) {
    const { S, D, doc, $, say, store } = E;
    if (!E.ui || !E.ui.addCmd) return;
    const win = doc.defaultView || root;
    const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    if (!doc.getElementById("pcactCss")) {
      const st = doc.createElement("style"); st.id = "pcactCss";
      st.textContent = ".kx .actbar{display:flex;gap:3px;flex-wrap:wrap;margin-bottom:5px}.kx .actbar button{min-width:26px;padding:2px 5px}.kx .actbar .rec.on{color:#e33;border-color:#e33}"
        + ".kx .actlist{border:1px solid var(--pc-line);border-radius:4px;min-height:120px;max-height:320px;overflow:auto;font-size:12px}"
        + ".kx .actlist .ar{display:flex;gap:4px;align-items:center;padding:2px 4px;cursor:pointer;white-space:nowrap}.kx .actlist .ar.on{background:var(--pc-on)}.kx .actlist .ar.play{outline:1px solid var(--pc-accent)}"
        + ".kx .actlist .ar .tw{width:12px;color:var(--pc-dim)}.kx .actlist .ar .ck,.kx .actlist .ar .md{width:16px;text-align:center;color:var(--pc-dim)}.kx .actlist .ar .sm{color:var(--pc-dim);overflow:hidden;text-overflow:ellipsis}"
        + ".kx .actlist .ar .ky{margin-left:auto;color:var(--pc-dim)}.kx .actbtns{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:4px}.kx .actbtns button{text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}";
      doc.head.appendChild(st);
    }
    let sets = normalize(store.get("actions.sets", null) || clone(DEFAULT_SETS));
    if (!sets.length) sets = normalize(clone(DEFAULT_SETS));
    const save = () => store.set("actions.sets", sets);
    let sel = { s: 0, a: sets[0] && sets[0].actions.length ? 0 : -1, i: -1 };
    let buttonMode = !!store.get("actions.buttons", false);
    const CMD = () => E.ui.CMD;
    const cmdLabel = (id) => { const c = CMD() && CMD().get(id); return c ? c.label : id; };
    const fxName = (id) => { const f = E.FX && E.FX.byId ? E.FX.byId(id) : null; return f ? f.name : id; };
    const curSet = () => sets[sel.s] || null, curAct = () => { const s = curSet(); return s && sel.a >= 0 ? s.actions[sel.a] || null : null; };

    /* ---------------- recording ---------------- */
    let rec = null;           // {act, dialogFor, pendingFilter}
    let playing = false, stopReq = false, playAt = null, pendingFill = null;
    const push = (st) => {
      if (!rec) return null;
      if (st.kind === "set") {                      // a field that fires twice (change + blur), or changes again straight away: one step
        const steps = rec.act.steps;
        for (let k = steps.length - 1; k >= 0 && steps[k].kind === "set"; k--) {
          if (steps[k].what !== st.what) continue;
          if (steps[k].value === st.value) return steps[k];
          if (k === steps.length - 1) { steps[k].value = st.value; save(); paint(); return steps[k]; }
          break;
        }
      }
      const s = Object.assign({ on: true }, st); rec.act.steps.push(s); save(); paint(); return s;
    };
    E.ui.onRun = (id) => {
      if (!rec || playing || !isRecordable(id)) return;
      if (/^(flt|adj)\./.test(id)) { rec.pendingFilter = id; return; }          // the filter's own settings come with onFilterDone
      rec.dialogFor = push({ kind: "cmd", id, label: cmdLabel(id) }); rec.inCmd = true;
    };
    E.ui.onRunDone = () => { if (rec) { rec.dialogFor = null; rec.inCmd = false; } };
    E.ui.onDialog = (d, title) => {
      if ((rec && rec.dialogFor && !playing) || rerec) {
        if (rec && rec.dialogFor && !playing) { d.__actStep = rec.dialogFor; rec.dialogFor.dlg = title; }
        // which fields the user changes, in order - played back, only those "type" (a dependent field follows them)
        d.__changed = [];
        const note = (e) => { const id = e.target && e.target.id; if (!id || e.__actFill) return; const k = d.__changed.indexOf(id); if (k >= 0) d.__changed.splice(k, 1); d.__changed.push(id); };
        d.addEventListener("input", note, true); d.addEventListener("change", note, true);
      }
      if (playing && pendingFill) {
        const f = pendingFill; pendingFill = null;
        fill(d, f.values || {}, f.changed);
        if (!f.modal) win.setTimeout(() => { const ok = d.querySelector(".ok"); if (ok && d.isConnected) ok.click(); }, 0);
        else say("Actions: the step's dialog is open - change it and press OK to carry on (Cancel stops the action)");
      }
      if (rerec) d.__actRerec = rerec;
    };
    E.ui.onDialogOk = (d) => {
      const st = d.__actStep || (d.__actRerec && d.__actRerec.step);
      if (st) { st.dialog = { title: st.dlg || d.querySelector("h4") && d.querySelector("h4").textContent || "", values: captureFrom(d.querySelectorAll("input,select,textarea")), changed: (d.__changed || []).slice() }; delete st.dlg; save(); paint(); }
      if (d.__actRerec) { rerec = null; say("the step's settings were recorded again"); }
    };
    E.ui.onDialogCancel = (d) => {
      const st = d.__actStep;
      if (st && rec) { const i = rec.act.steps.indexOf(st); if (i >= 0) rec.act.steps.splice(i, 1); save(); paint(); }
      if (playing && !d.__actStop) cancelled = true;
      if (d.__actRerec) rerec = null;
    };
    E.onFilterDone = (id, params) => {
      if (rerec && rerec.step.kind === "filter" && rerec.step.id === id) { rerec.step.params = params; rerec = null; save(); paint(); say("the filter's settings were recorded again"); return; }
      if (!rec || playing) return;
      rec.pendingFilter = null;
      push({ kind: "filter", id, params, label: fxName(id) });
    };
    E.onFilterCancel = () => { if (playing) cancelled = true; if (rec) rec.pendingFilter = null; };
    // the Layers panel's buttons, blend mode and opacity (they are not menu commands)
    for (const [bid, cid] of [["kxLAdd", "layer.new"], ["kxLDup", "layer.dup"], ["kxLCopy", "layer.viacopy"], ["kxLUp", "layer.forward"], ["kxLDown", "layer.backward"], ["kxLDel", "layer.del"], ["kxLMerge", "layer.mergedown"], ["kxLMask", "mask.reveal"], ["kxLGroup", "layer.newgroup"]]) {
      const b = $(bid); if (b) b.addEventListener("click", () => { if (rec && !playing && S.w) push({ kind: "cmd", id: cid, label: cmdLabel(cid) }); }, true);
    }
    const bl = $("kxBlend"); if (bl) bl.addEventListener("change", () => { if (rec && !playing && S.w) push({ kind: "set", what: "blend", value: bl.value }); });
    const opn = $("kxLOpacityN"), opr = $("kxLOpacity");
    if (opn) opn.addEventListener("change", () => { if (rec && !playing && S.w) push({ kind: "set", what: "opacity", value: Math.round(+opn.value || 0) }); });
    if (opr) opr.addEventListener("change", () => { if (rec && !playing && S.w) push({ kind: "set", what: "opacity", value: Math.round(+opr.value || 0) }); });
    const fl = $("pcFill"); if (fl) fl.addEventListener("change", () => { if (rec && !playing && S.w) push({ kind: "set", what: "fill", value: Math.round(+fl.value || 0) }); });
    function startRec() {
      const a = curAct(); if (!a) return say("pick an action (or ＋ make a new one) first");
      if (playing) return say("an action is playing");
      rec = { act: a, dialogFor: null, pendingFilter: null }; a.open = true; paint();
      say(`recording "${a.name}" - menu commands, their dialogs' settings, filters, the Layers panel; ■ stops`);
    }
    function stopRec() { if (!rec) return; const a = rec.act; rec = null; save(); paint(); say(`"${a.name}": ${a.steps.length} step(s)`); }

    /* ---------------- playing ---------------- */
    let cancelled = false, rerec = null;
    const tick = (ms) => new Promise((r) => win.setTimeout(r, ms || 0));
    /** a dialog's fields set to the recorded values; then the ones the user changed are "typed" again, in order, so
     *  fields that follow them (Image Size's height and percent) work it out as they did */
    function fill(d, values, changed) {
      const find = (id) => { try { return d.querySelector("#" + (win.CSS && win.CSS.escape ? win.CSS.escape(id) : id)); } catch (e) { return null; } };
      const set = (el, v) => { if (el.type === "checkbox" || el.type === "radio") el.checked = !!v; else el.value = v; };
      const fire = (el) => { for (const t of ["input", "change"]) { const ev = new win.Event(t, { bubbles: true }); ev.__actFill = true; el.dispatchEvent(ev); } };
      const vals = values || {};
      for (const [id, v] of Object.entries(vals)) { const el = find(id); if (el) set(el, v); }
      const order = Array.isArray(changed) ? changed : Object.keys(vals);
      for (const id of order) { const el = find(id); if (!el || !(id in vals)) continue; set(el, vals[id]); fire(el); }
      // what the typing changed back is set once more (except the fields that follow the typed ones)
      if (!Array.isArray(changed)) return;
    }
    const openDialogs = () => [...E.kx.querySelectorAll(".kxdlg")].filter((d) => d.isConnected && !d.__actStop && !d.classList.contains("actprog") && d.offsetParent !== null);
    async function waitDialogs(modal) {
      const t0 = Date.now();
      while (openDialogs().length) {
        if (stopReq) { openDialogs().forEach((d) => { const c = d.querySelector(".cn"); if (c) c.click(); }); throw new Error("stopped"); }
        if (!modal && Date.now() - t0 > 20000) throw new Error("its dialog stayed open");
        await tick(60);
      }
    }
    const KINDS = {};               // 2.468.0: more step kinds (pcactionsx.js): kind -> async run(st)
    async function runStep(st) {
      cancelled = false;
      if (KINDS[st.kind]) { await KINDS[st.kind](st); return; }
      if (st.kind === "cmd") {
        const c = CMD() && CMD().get(st.id); if (!c) throw new Error("no such command here");
        if (c.enabled && !c.enabled()) throw new Error("not available now (no picture / layer / selection for it)");
        pendingFill = { values: st.dialog ? st.dialog.values : null, changed: st.dialog ? st.dialog.changed : null, modal: !!st.modal };
        E.ui.run(st.id);
        await tick(0);
        pendingFill = null;
        await waitDialogs(!!st.modal);
        if (cancelled) throw new Error("cancelled in its dialog");
        return;
      }
      if (st.kind === "filter") {
        if (st.modal) {
          try { store.set("fx." + st.id, st.params || {}); } catch (e) { /* fine */ }
          E.openFilter(st.id); await tick(0); await waitDialogs(true); if (cancelled) throw new Error("cancelled in its dialog"); return;
        }
        if (!E.applyFilter(st.id, st.params || {}, fxName(st.id))) throw new Error("could not be applied (no pixel layer to work on?)");
        return;
      }
      if (st.kind === "set") {
        const L = E.layer(); if (!L) throw new Error("no layer");
        E.structOp(st.what === "blend" ? "blend mode" : st.what === "fill" ? "fill opacity" : "opacity", () => {
          if (st.what === "blend") L.blend = String(st.value); else if (st.what === "fill") L.fillOpacity = Math.max(0, Math.min(100, +st.value)) / 100; else L.opacity = Math.max(0, Math.min(100, +st.value)) / 100;
        });
        return;
      }
      if (st.kind === "stop") {
        await new Promise((ok, no) => {
          const d = E.ui.dialog("Action Stopped", `<div style="max-width:360px">${esc(st.msg || "The action stopped here.")}</div>`, () => { ok(); }, { okLabel: st.cont === false ? "Stop" : "Continue", cancel: () => no(new Error("stopped at its Stop")) });
          d.__actStop = true;
          if (st.cont === false) { d.querySelector(".ok").onclick = () => { d.remove(); no(new Error("stopped at its Stop")); }; }
        });
      }
    }
    /** play an action (from step `from`): {ok, error, steps} */
    async function play(a, from, quiet) {
      if (!a) return { ok: false, error: "no action" };
      if (playing) return { ok: false, error: "an action is already playing" };
      if (rec) stopRec();
      playing = true; stopReq = false; let n = 0;
      try {
        for (let i = Math.max(0, from || 0); i < a.steps.length; i++) {
          const st = a.steps[i]; if (st.on === false) continue;
          playAt = { a, i }; paint();
          if (stopReq) throw new Error("stopped");
          try { await runStep(st); } catch (e) { throw new Error(`step ${i + 1} (${stepLabel(st, cmdLabel)}): ${e.message}`); }
          n++;
          await tick(0);
        }
        if (!quiet) say(`"${a.name}" played - ${n} step(s)`);
        return { ok: true, steps: n };
      } catch (e) {
        if (!quiet) say(`"${a.name}" stopped - ${e.message}`);
        return { ok: false, error: e.message, steps: n };
      } finally { playing = false; playAt = null; pendingFill = null; paint(); }
    }

    /* ---------------- the panel ---------------- */
    const allKeys = () => sets.flatMap((s) => s.actions.map((a) => a.key).filter(Boolean));
    function paint() {
      const box = $("pcActions"); if (!box || !box.classList.contains("on")) return;
      const recOn = !!rec;
      let h = `<div class="actbar">
        <button class="ghost" id="actStop" title="Stop recording / playing">■</button><button class="ghost rec${recOn ? " on" : ""}" id="actRec" title="Begin recording into the picked action">●</button>
        <button class="ghost" id="actPlay" title="Play the picked action (from the picked step)">▶</button><span style="width:6px"></span>
        <button class="ghost" id="actNewSet" title="New set">📁</button><button class="ghost" id="actNew" title="New action">＋</button><button class="ghost" id="actDel" title="Delete the picked step / action / set">🗑</button>
        <button class="ghost" id="actUp" title="Move up">▲</button><button class="ghost" id="actDown" title="Move down">▼</button><button class="ghost" id="actMenu" title="More: Insert Stop, Insert Menu Item, Duplicate, Button Mode, Load / Save, Batch">☰</button></div>`;
      if (buttonMode) {
        h += `<div class="actbtns">${sets.flatMap((s, si) => s.actions.map((a, ai) => `<button class="ghost" data-pbs="${si}" data-pba="${ai}" title="${esc(a.name)}${a.key ? " (" + a.key + ")" : ""}">▶ ${esc(a.name)}</button>`)).join("")}</div>`;
      } else {
        h += `<div class="actlist" id="actList">`;
        sets.forEach((s, si) => {
          h += `<div class="ar${sel.s === si && sel.a < 0 ? " on" : ""}" data-s="${si}"><span class="tw" data-tw="s">${s.open ? "▾" : "▸"}</span>📁 <b>${esc(s.name)}</b></div>`;
          if (!s.open) return;
          s.actions.forEach((a, ai) => {
            const on = sel.s === si && sel.a === ai && sel.i < 0, pl = playAt && playAt.a === a && false;
            h += `<div class="ar${on ? " on" : ""}${pl ? " play" : ""}" data-s="${si}" data-a="${ai}" style="padding-left:16px"><span class="tw" data-tw="a">${a.open ? "▾" : "▸"}</span>${rec && rec.act === a ? '<span style="color:#e33">●</span>' : "▶"} ${esc(a.name)}<span class="ky">${esc(a.key || "")}</span></div>`;
            if (!a.open) return;
            a.steps.forEach((st, i) => {
              const hasDlg = st.kind === "filter" || (st.kind === "cmd" && st.dialog);
              const onS = sel.s === si && sel.a === ai && sel.i === i, pl2 = playAt && playAt.a === a && playAt.i === i;
              h += `<div class="ar${onS ? " on" : ""}${pl2 ? " play" : ""}" data-s="${si}" data-a="${ai}" data-i="${i}" style="padding-left:30px" title="${esc(summary(st))}">
                <span class="ck" data-ck="1" title="Include this step">${st.on === false ? "☐" : "☑"}</span><span class="md" data-md="1" title="Stop in its dialog when played (the dialog toggle)">${hasDlg ? (st.modal ? "▣" : "▢") : ""}</span>
                ${esc(stepLabel(st, cmdLabel))} <span class="sm">${esc(summary(st))}</span></div>`;
            });
          });
        });
        h += `</div>`;
      }
      const a = curAct();
      h += `<div class="kxrow" style="margin-top:5px;color:var(--pc-dim)">${rec ? `● recording "${esc(rec.act.name)}"` : playing ? "▶ playing…" : a ? `"${esc(a.name)}" - ${a.steps.length} step(s)` : "pick an action"}</div>`;
      box.innerHTML = h;
      for (const f of panelHooks) { try { f(box); } catch (e) { /* a hook's own trouble */ } }      // 2.468.0: droplets
      const q = (id) => box.querySelector("#" + id);
      q("actStop").onclick = () => { if (rec) stopRec(); if (playing) { stopReq = true; say("stopping…"); } };
      q("actRec").onclick = () => (rec ? stopRec() : startRec());
      q("actPlay").onclick = () => { const x = curAct(); if (!x) return say("pick an action first"); play(x, sel.i >= 0 ? sel.i : 0); };
      q("actNewSet").onclick = () => dlgName("New Set", "Set " + (sets.length + 1), (n) => { sets.push({ name: n, open: true, actions: [] }); sel = { s: sets.length - 1, a: -1, i: -1 }; save(); paint(); });
      q("actNew").onclick = () => dlgNewAction();
      q("actDel").onclick = () => del();
      q("actUp").onclick = () => moveSel(-1); q("actDown").onclick = () => moveSel(1);
      q("actMenu").onclick = (e) => { e.stopPropagation(); const r = e.target.getBoundingClientRect(), kr = E.kx.getBoundingClientRect();
        if (E.ui.menuAt) E.ui.menuAt(["act.stop", "act.item", E.ui.sep, "act.dup", "act.buttons", E.ui.sep, "act.cond", "act.load", "act.save", "act.reset", E.ui.sep, "act.batch", "act.processor", "act.droplet"], r.left - kr.left, r.bottom - kr.top + 2); };
      box.querySelectorAll("[data-pbs]").forEach((b) => { b.onclick = () => { const x = sets[+b.dataset.pbs].actions[+b.dataset.pba]; sel = { s: +b.dataset.pbs, a: +b.dataset.pba, i: -1 }; play(x, 0); }; });
      box.querySelectorAll(".actlist .ar").forEach((row) => {
        const si = +row.dataset.s, ai = row.dataset.a != null ? +row.dataset.a : -1, i = row.dataset.i != null ? +row.dataset.i : -1;
        row.onclick = (e) => {
          const t = e.target;
          if (t.dataset.tw === "s") { sets[si].open = !sets[si].open; save(); paint(); return; }
          if (t.dataset.tw === "a") { const x = sets[si].actions[ai]; x.open = !x.open; save(); paint(); return; }
          if (t.dataset.ck && i >= 0) { const st = sets[si].actions[ai].steps[i]; st.on = st.on === false; save(); paint(); return; }
          if (t.dataset.md && i >= 0) { const st = sets[si].actions[ai].steps[i]; if (st.kind === "filter" || st.dialog) { st.modal = !st.modal; save(); paint(); } return; }
          sel = { s: si, a: ai, i }; paint();
        };
        row.ondblclick = () => {
          if (i >= 0) return rerecord(sets[si].actions[ai].steps[i]);
          if (ai >= 0) return dlgActionOptions(sets[si].actions[ai]);
          dlgName("Rename Set", sets[si].name, (n) => { sets[si].name = n; save(); paint(); });
        };
      });
    }
    E.ui.actions = paint;
    const panelHooks = [];
    function dlgName(title, val, ok) {
      E.ui.dialog(title, `<div class="rw"><span>Name</span><input type="text" id="actN" value="${esc(val)}" style="grid-column:2/4"></div>`, (d) => { const n = d.querySelector("#actN").value.trim().slice(0, 60); if (n) ok(n); });
    }
    const keyOpts = (cur) => `<option value="">None</option>` + freeKeys([...KEYMAP_USED()], allKeys().filter((k) => k !== cur)).concat(cur ? [cur] : []).filter((k, i, arr) => arr.indexOf(k) === i).map((k) => `<option${k === cur ? " selected" : ""}>${k}</option>`).join("");
    const KEYMAP_USED = () => { const out = new Set(); if (CMD()) for (const c of CMD().values()) if (c.key) out.add(c.key); return out; };
    function dlgNewAction() {
      if (!sets.length) sets.push({ name: "Set 1", open: true, actions: [] });
      const si = Math.max(0, sel.s);
      E.ui.dialog("New Action", `<div class="rw"><span>Name</span><input type="text" id="actN" value="Action ${sets[si].actions.length + 1}" style="grid-column:2/4"></div>
        <div class="rw"><span>Set</span><select id="actS" style="grid-column:2/4">${sets.map((s, i) => `<option value="${i}"${i === si ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
        <div class="rw"><span>Function key</span><select id="actK" style="grid-column:2/4">${keyOpts("")}</select></div>
        <div style="color:var(--pc-dim)">Record starts straight away - ■ stops.</div>`, (d) => {
        const n = d.querySelector("#actN").value.trim().slice(0, 60) || "Action", s2 = +d.querySelector("#actS").value, k = d.querySelector("#actK").value;
        const a = Object.assign({ name: n, steps: [], open: true }, k ? { key: k } : {});
        sets[s2].actions.push(a); sets[s2].open = true; sel = { s: s2, a: sets[s2].actions.length - 1, i: -1 }; save();
        win.setTimeout(() => startRec(), 0);
      }, { okLabel: "● Record" });
    }
    function dlgActionOptions(a) {
      E.ui.dialog("Action Options", `<div class="rw"><span>Name</span><input type="text" id="actN" value="${esc(a.name)}" style="grid-column:2/4"></div>
        <div class="rw"><span>Function key</span><select id="actK" style="grid-column:2/4">${keyOpts(a.key || "")}</select></div>`, (d) => {
        a.name = d.querySelector("#actN").value.trim().slice(0, 60) || a.name; const k = d.querySelector("#actK").value; if (k) a.key = k; else delete a.key; save(); paint();
      });
    }
    function del() {
      const s = curSet(); if (!s) return;
      if (sel.i >= 0) { const a = curAct(); a.steps.splice(sel.i, 1); sel.i = Math.min(sel.i, a.steps.length - 1); }
      else if (sel.a >= 0) { s.actions.splice(sel.a, 1); sel.a = Math.min(sel.a, s.actions.length - 1); }
      else { sets.splice(sel.s, 1); sel = { s: Math.max(0, sel.s - 1), a: -1, i: -1 }; }
      if (rec && !sets.some((x) => x.actions.includes(rec.act))) rec = null;
      save(); paint();
    }
    function moveSel(d) {
      const s = curSet(); if (!s) return;
      const sw = (arr, i) => { const j = i + d; if (j < 0 || j >= arr.length) return i; [arr[i], arr[j]] = [arr[j], arr[i]]; return j; };
      if (sel.i >= 0) sel.i = sw(curAct().steps, sel.i); else if (sel.a >= 0) sel.a = sw(s.actions, sel.a); else sel.s = sw(sets, sel.s);
      save(); paint();
    }
    /** record a step's settings again: its dialog opens with them, OK keeps the new ones */
    function rerecord(st) {
      if (!S.w) return say("open a picture first - the step's dialog works on it");
      if (st.kind === "filter") { rerec = { step: st }; try { store.set("fx." + st.id, st.params || {}); } catch (e) { /* fine */ } E.openFilter(st.id); return; }
      if (st.kind === "cmd" && st.dialog) { rerec = { step: st }; const p0 = playing; playing = true; pendingFill = { values: st.dialog.values, changed: st.dialog.changed, modal: true }; E.ui.run(st.id); pendingFill = null; playing = p0; return; }
      if (st.kind === "stop") return dlgStop(st);
      say("this step has no settings to record again");
    }
    function dlgStop(st) {
      const a = curAct(); if (!a && !st) return say("pick an action first");
      E.ui.dialog("Record Stop", `<div class="rw"><span>Message</span><input type="text" id="actM" value="${esc(st ? st.msg : "")}" style="grid-column:2/4"></div>
        <div class="rw"><label style="grid-column:1/4"><input type="checkbox" id="actC" ${!st || st.cont !== false ? "checked" : ""}> Allow Continue</label></div>`, (d) => {
        const v = { kind: "stop", msg: d.querySelector("#actM").value.slice(0, 300), cont: d.querySelector("#actC").checked, on: true };
        if (st) Object.assign(st, v); else { const at = sel.i >= 0 ? sel.i + 1 : a.steps.length; a.steps.splice(at, 0, v); sel.i = at; }
        save(); paint();
      });
    }
    function dlgItem() {
      const a = curAct(); if (!a) return say("pick an action first");
      const items = [...CMD().values()].filter((c) => isRecordable(c.id) && !c.hidden).map((c) => [c.id, c.label]);
      E.ui.dialog("Insert Menu Item", `<input type="text" id="actQ" placeholder="type to find a command" style="width:100%"><select id="actI" size="10" style="width:100%;margin-top:4px">${items.map(([id, l]) => `<option value="${id}">${esc(l)} — ${id}</option>`).join("")}</select>
        <div style="color:var(--pc-dim)">Played, it runs the command; a dialog it opens stays open for you (the dialog toggle).</div>`, (d) => {
        const id = d.querySelector("#actI").value; if (!id) return false;
        const at = sel.i >= 0 ? sel.i + 1 : a.steps.length;
        a.steps.splice(at, 0, { kind: "cmd", id, label: cmdLabel(id), on: true, modal: true }); sel.i = at; save(); paint();
      }, { init: (d) => { const qn = d.querySelector("#actQ"), s = d.querySelector("#actI"); qn.oninput = () => { const t = qn.value.toLowerCase(); [...s.options].forEach((o) => { o.hidden = t && !o.textContent.toLowerCase().includes(t); }); }; } });
    }
    function dup() {
      const s = curSet(), a = curAct(); if (!s || !a) return say("pick an action first");
      const c = clone(a); c.name = a.name + " copy"; delete c.key; s.actions.splice(sel.a + 1, 0, c); sel.a++; save(); paint();
    }
    let loadIn = null;
    function loadActions() {
      if (!loadIn) { loadIn = doc.createElement("input"); loadIn.type = "file"; loadIn.accept = ".json,.atn,application/json"; loadIn.style.display = "none"; E.kx.appendChild(loadIn); }
      loadIn.onchange = async () => {
        const f = loadIn.files && loadIn.files[0]; loadIn.value = ""; if (!f) return;
        if (/\.atn$/i.test(f.name)) { try { loadAtn(new Uint8Array(await f.arrayBuffer()), f.name); } catch (e) { say(`${f.name}: ${e.message}`); } return; }     // 2.469.0
        try { const j = JSON.parse(await f.text()); const add = normalize(j.sets || j); if (!add.length) throw new Error("no action sets in it"); sets.push(...add); save(); paint(); say(`loaded ${add.length} set(s) from ${f.name}`); }
        catch (e) { say(`${f.name}: ${e.message} (bitGen's .json action files or .atn action files)`); }
      };
      loadIn.click();
    }
    /** 2.469.0: a Photoshop .atn (pcatn.js): its set comes in - matched steps play, the others come in switched off */
    function loadAtn(bytes, name) {
      const T = root.PCAtn; if (!T) throw new Error("the .atn reader (pcatn.js) is not loaded");
      const { set, notes } = T.toSet(T.read(bytes)), add = normalize([set]);
      if (!add.length || !add[0].actions.length) throw new Error("no actions in it");
      sets.push(...add); sel = { s: sets.length - 1, a: 0, i: -1 }; save(); paint();
      say(`${name}: "${add[0].name}" - ${add[0].actions.length} action(s), ${notes.mapped} step(s) matched` + (notes.skipped ? `, ${notes.skipped} with no match here came in switched off (${notes.names.slice(0, 4).join(", ")}${notes.names.length > 4 ? "…" : ""})` : ""));
      return { set: add[0], notes };
    }
    function saveActions() {
      const s = curSet(); const data = { bitgenActions: 1, sets: s ? [s] : sets };
      const a = doc.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); a.download = String(s ? s.name : "actions").replace(/[^\w.-]+/g, "_") + ".json"; doc.body.appendChild(a); a.click();
      win.setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      say(`saved "${s ? s.name : "all sets"}" as a .json action file`);
      return data;
    }

    /* ---------------- function keys ---------------- */
    const baseKey = E.ui.key;
    E.ui.key = (e) => {
      const U = root.PCUI; const acc = U && U.accelOf ? U.accelOf(e) : null;
      if (acc && /F\d+$/.test(acc)) for (const s of sets) for (const a of s.actions) if (a.key === acc) { play(a, 0); return true; }
      if (acc === "Alt+F9") { if (E.ui.showTab) E.ui.showTab("pcActions"); return true; }
      return baseKey ? baseKey(e) : false;
    };

    /* ---------------- File ▸ Automate ▸ Batch ---------------- */
    let batchRun = null;
    function dlgBatch() {
      const all = sets.flatMap((s, si) => s.actions.map((a, ai) => [si + ":" + ai, s.name + " ▸ " + a.name]));
      if (!all.length) return say("record an action first (the Actions tab)");
      const cur = curAct() ? sel.s + ":" + sel.a : all[0][0];
      const d = E.ui.dialog("Batch", `<div class="rw"><span>Action</span><select id="btA" style="grid-column:2/4">${all.map(([v, n]) => `<option value="${v}"${v === cur ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></div>
        <div class="rw"><span>Source</span><button class="ghost" id="btFiles">Choose files…</button><button class="ghost" id="btFolder">Choose a folder…</button></div>
        <div class="rw"><span></span><span id="btN" style="grid-column:2/4;color:var(--pc-dim)">no pictures picked</span></div>
        <div class="rw"><span>Errors</span><select id="btE" style="grid-column:2/4"><option value="stop">Stop for errors</option><option value="log" selected>Log errors and go on</option></select></div>
        <div class="rw"><span>Destination</span><select id="btD" style="grid-column:2/4"><option value="project" selected>Project folder (batch)</option><option value="gallery">Image gallery</option><option value="download">Download each</option><option value="none">None (leave the last one open)</option></select></div>
        <div class="rw"><span>Folder name</span><input type="text" id="btR" value="batch-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}" style="grid-column:2/4"></div>
        <div class="rw"><span>File name</span><input type="text" id="btS" value="-edited" title="added to each picture's name"><select id="btF"><option value="png">PNG</option><option value="jpg">JPEG</option></select></div>
        <div class="rw"><span>JPEG quality</span><input type="number" id="btQ" min="10" max="100" value="90"><span></span></div>`, (dd) => {
        const files = dd.__files || []; if (!files.length) { say("pick the pictures first (files or a folder)"); return false; }
        const [si, ai] = dd.querySelector("#btA").value.split(":").map(Number);
        batch({ action: sets[si].actions[ai], files, onError: dd.querySelector("#btE").value, dest: dd.querySelector("#btD").value, run: dd.querySelector("#btR").value.trim() || "batch",
          suffix: dd.querySelector("#btS").value, format: dd.querySelector("#btF").value, quality: Math.max(10, Math.min(100, +dd.querySelector("#btQ").value || 90)) / 100 });
      }, { okLabel: "▶ Run", wide: true });
      const pickIn = (dir) => {
        const inp = doc.createElement("input"); inp.type = "file"; inp.multiple = true; inp.accept = "image/*"; if (dir) { inp.webkitdirectory = true; inp.setAttribute("webkitdirectory", ""); }
        inp.style.display = "none"; E.kx.appendChild(inp);
        inp.onchange = () => { d.__files = [...(inp.files || [])].filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp|jxl)$/i.test(f.name)); d.querySelector("#btN").textContent = `${d.__files.length} picture(s)`; inp.remove(); };
        inp.click();
      };
      d.querySelector("#btFiles").onclick = () => pickIn(false); d.querySelector("#btFolder").onclick = () => pickIn(true);
      d.__setFiles = (fs) => { d.__files = fs; d.querySelector("#btN").textContent = `${fs.length} picture(s)`; };    // the browser test hands files in
      return d;
    }
    const loadImg = (file) => new Promise((ok, no) => { const u = URL.createObjectURL(file), im = new win.Image(); im.onload = () => { ok(im); win.setTimeout(() => URL.revokeObjectURL(u), 1000); }; im.onerror = () => { URL.revokeObjectURL(u); no(new Error("not a picture the browser can read")); }; im.src = u; });
    /** the batch: {action, files, onError, dest, run, suffix, format, quality} -> {done, errors, saved} */
    async function batch(o) {
      if (batchRun) return say("a batch is running");
      const rep = { done: 0, errors: [], saved: [] };
      batchRun = o; stopReq = false; let batchStop = false;
      // the progress box is our own (a pcui dialog would be closed by the next dialog a step opens)
      const prog = doc.createElement("div"); prog.className = "kxdlg actprog"; prog.__actStop = true;
      prog.style.cssText = "left:auto;right:16px;top:auto;bottom:40px;min-width:260px";
      prog.innerHTML = `<h4>Batch</h4><div class="pcdb" style="padding:0 10px"><div id="btP">starting…</div></div><div class="bt"><button class="ghost cn" id="btStop">■ Stop</button></div>`;
      prog.querySelector("#btStop").onclick = () => { batchStop = true; stopReq = true; };
      E.kx.appendChild(prog);
      const status = (t) => { const el = prog.querySelector("#btP"); if (el) el.textContent = t; };
      try {
        for (let k = 0; k < o.files.length; k++) {
          if (batchStop) { rep.errors.push("stopped"); break; }
          const f = o.files[k];
          status(`${k + 1} / ${o.files.length}: ${f.name}`);
          let opened = null;
          const shut = () => { if (opened && E.docs && E.docs.live() === opened) E.docs.closeNow(opened); };
          try {
            const img = await loadImg(f);
            E.openImage(img, f.name);
            opened = E.docs ? E.docs.live() : null;
            await tick(30);
            const r = await play(o.action, 0, true);
            if (!r.ok) throw new Error(r.error);
            const out = fileName(f.name, o.suffix, o.format);
            if (o.dest !== "none") {
              const blob = await new Promise((ok) => E.flatten().toBlob(ok, o.format === "jpg" ? "image/jpeg" : "image/png", o.quality));
              if (o.dest === "project") {
                const res = await win.fetch(`/api/batch/save?run=${encodeURIComponent(o.run)}&name=${encodeURIComponent(out)}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: blob });
                const j = await res.json(); if (!res.ok) throw new Error(j.error || "the save was refused"); rep.saved.push(j.name);
              } else if (o.dest === "gallery") { const n = await E.saveToImages(blob, out); if (!n) throw new Error("the gallery did not take it"); rep.saved.push(n); }
              else { const a = doc.createElement("a"); a.href = URL.createObjectURL(blob); a.download = out; doc.body.appendChild(a); a.click(); win.setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); rep.saved.push(out); }
            }
            rep.done++;
          } catch (e) {
            rep.errors.push(`${f.name}: ${e.message}`);
            if (o.onError === "stop") { shut(); break; }
          }
          shut();     // 2.430.0: each picture is a document of its own - closed when it is done (Photoshop's batch)
        }
      } finally { batchRun = null; if (prog.isConnected) prog.remove(); }
      const where = o.dest === "project" ? ` in the project's batch/${o.run}` : o.dest === "gallery" ? " in the image gallery" : o.dest === "download" ? " (downloaded)" : "";
      E.ui.dialog("Batch Done", `<div>${rep.done} of ${o.files.length} picture(s) done${esc(where)}.</div>${rep.errors.length ? `<div style="margin-top:6px;color:var(--pc-dim)">Errors:</div><div style="max-height:180px;overflow:auto;font-size:11px">${rep.errors.map((x) => `<div>${esc(x)}</div>`).join("")}</div>` : ""}`, () => true, { okLabel: "OK" });
      say(`Batch: ${rep.done} done, ${rep.errors.length} error(s)`);
      E.batchReport = rep;
      return rep;
    }

    /* ---------------- commands ---------------- */
    const C = E.ui.addCmd;
    C("win.pcActions", "Actions", "Alt+F9", () => E.ui.showTab && E.ui.showTab("pcActions"), {}, ["Window", "win.pcHistory"]);
    C("act.batch", "Automate: Batch…", "", dlgBatch, {}, ["File", "file.download", true]);
    C("act.stop", "Actions: Insert Stop…", "", () => dlgStop(null), { enabled: () => !!curAct() });
    C("act.item", "Actions: Insert Menu Item…", "", dlgItem, { enabled: () => !!curAct() });
    C("act.dup", "Actions: Duplicate", "", dup, { enabled: () => !!curAct() });
    C("act.buttons", "Actions: Button Mode", "", () => { buttonMode = !buttonMode; store.set("actions.buttons", buttonMode); paint(); });
    C("act.load", "Actions: Load Actions…", "", loadActions);
    C("act.save", "Actions: Save Actions…", "", saveActions);
    C("act.reset", "Actions: Reset Actions", "", () => { sets = normalize(clone(DEFAULT_SETS)); sel = { s: 0, a: 0, i: -1 }; save(); paint(); say("the Default Actions are back (your own sets were removed - Save Actions first to keep them)"); });
    C("act.play", "Actions: Play", "", () => { const a = curAct(); if (a) play(a, sel.i >= 0 ? sel.i : 0); else say("pick an action first"); }, { enabled: () => !!curAct() });
    C("act.record", "Actions: Start / Stop Recording", "", () => (rec ? stopRec() : startRec()), { enabled: () => !!curAct() || !!rec });

    E.actions = { sets: () => sets, setSets: (x) => { sets = normalize(x); save(); paint(); }, select: (s, a, i) => { sel = { s, a: a == null ? -1 : a, i: i == null ? -1 : i }; paint(); },
      startRec, stopRec, play, batch, dlgBatch, saveActions, recording: () => !!rec, playing: () => playing, stop: () => { stopReq = true; },
      // 2.468.0: for pcactionsx.js - record a step, more kinds, nested steps, the panel's hooks
      record: (st) => (rec && !playing ? push(st) : null), inCmd: () => !!(rec && rec.inCmd), dialogsOpen: () => openDialogs().length > 0, addKind: (k, f) => { KINDS[k] = f; },
      runStep, panelHooks, loadAtn, current: () => ({ set: curSet(), action: curAct(), step: sel.i }), insert: (st) => { const a = curAct(); if (!a) return false; const at = sel.i >= 0 ? sel.i + 1 : a.steps.length; a.steps.splice(at, 0, Object.assign({ on: true }, st)); sel.i = at; save(); paint(); return true; },
      find: (setName, actName) => { const s = sets.find((x) => x.name === setName); return s ? s.actions.find((a) => a.name === actName) || null : null; }, paint };
  }

  root.PCActions = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = Object.assign({ install }, pure);
})(typeof window !== "undefined" ? window : globalThis);
