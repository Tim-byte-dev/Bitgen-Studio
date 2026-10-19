/* pcatn.js — PHOTOSHOP ACTION FILES (.atn) IN (2.469.0), window.PCAtn. Pure (Node: scripts/test-atn.js).
 *
 * Tim (verbatim): "continue with the photoshop gap closure. add cad tools, create sketch layers for cad in image editor"
 * - the gap row "Photoshop .atn files". Actions ▸ Load Actions… now takes an .atn: its set and actions come in; each
 * step Photoshop recorded becomes the matching bitGen step where there is one (filters with their settings, layer and
 * selection commands, opacity / blend mode, rotate / flip, Stop); a step with no match comes in switched OFF, named
 * after the Photoshop step, so the rest plays.
 *
 *   read(bytes)        -> {version, name, actions: [{name, fkey, shift, cmd, color, items: [{event, name, enabled,
 *                         dialog, desc}]}]}   (the binary format: version 16, Unicode strings, action descriptors)
 *   readDescriptor     an action descriptor -> a plain object (_class + keys; enum -> {type, value}; units ->
 *                         {units, value}; references -> [{kind, class, key / enum / name / index / id}])
 *   toSet(atn)         -> a bitGen action set {name, actions [{name, steps}]} (+ notes: {mapped, skipped})
 *   stepOf(item)       one Photoshop item -> a bitGen step (null = no match)
 */
(function (root) {
  "use strict";
  /* ================================ the binary reader ================================ */
  function reader(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let o = 0;
    const need = (n) => { if (o + n > u8.length) throw new Error("the .atn file ends too early"); };
    const r = {
      get pos() { return o; },
      u8() { need(1); return u8[o++]; },
      u16() { need(2); const v = dv.getUint16(o); o += 2; return v; },
      i32() { need(4); const v = dv.getInt32(o); o += 4; return v; },
      u32() { need(4); const v = dv.getUint32(o); o += 4; return v; },
      f64() { need(8); const v = dv.getFloat64(o); o += 8; return v; },
      bytes(n) { need(n); const v = u8.subarray(o, o + n); o += n; return v; },
      ascii(n) { return String.fromCharCode(...r.bytes(n)); },
      /** a Unicode string: a char count (with its trailing NUL), UTF-16 BE */
      uni() { const n = r.u32(); if (n > 1e6) throw new Error("a broken Unicode string"); let s = ""; for (let i = 0; i < n; i++) { const c = r.u16(); if (c) s += String.fromCharCode(c); } return s; },
      /** an ID: a length (0 = a 4-char key follows) + ASCII */
      id() { const n = r.u32(); return r.ascii(n || 4); },
      pascal() { const n = r.u32(); return r.ascii(n); },
    };
    return r;
  }
  function readValue(r, type) {
    switch (type) {
      case "obj ": return readReference(r);
      case "Objc": case "GlbO": return readDescriptor(r);
      case "VlLs": { const n = r.u32(), out = []; for (let i = 0; i < n; i++) out.push(readValue(r, r.ascii(4))); return out; }
      case "doub": return r.f64();
      case "UntF": { const units = r.ascii(4); return { units, value: r.f64() }; }
      case "UnFl": { const units = r.ascii(4), n = r.u32(), v = []; for (let i = 0; i < n; i++) v.push(r.f64()); return { units, values: v }; }
      case "TEXT": return r.uni();
      case "enum": { const t = r.id(), v = r.id(); return { type: t, value: v }; }
      case "long": return r.i32();
      case "comp": { const hi = r.i32(), lo = r.u32(); return hi * 4294967296 + lo; }
      case "bool": return !!r.u8();
      case "type": case "GlbC": { const name = r.uni(); return { class: r.id(), name }; }
      case "alis": case "tdta": case "Pth ": { const n = r.u32(); return { bytes: r.bytes(n).length }; }
      case "ObAr": { r.u32(); r.uni(); r.id(); const n = r.u32(); for (let i = 0; i < n; i++) { r.id(); const t = r.ascii(4); if (t !== "UnFl") throw new Error("an object array this reader does not know"); readValue(r, t); } return { objectArray: n }; }
    }
    throw new Error(`an unknown value type "${type}"`);
  }
  function readReference(r) {
    const n = r.u32(), out = [];
    for (let i = 0; i < n; i++) {
      const k = r.ascii(4);
      if (k === "prop") { r.uni(); const c = r.id(); out.push({ kind: "prop", class: c, key: r.id() }); }
      else if (k === "Clss") { r.uni(); out.push({ kind: "class", class: r.id() }); }
      else if (k === "Enmr") { r.uni(); const c = r.id(), t = r.id(); out.push({ kind: "enum", class: c, type: t, enum: r.id() }); }
      else if (k === "rele") { r.uni(); const c = r.id(); out.push({ kind: "offset", class: c, offset: r.i32() }); }
      else if (k === "Idnt") out.push({ kind: "id", id: r.i32() });
      else if (k === "indx") out.push({ kind: "index", index: r.i32() });
      else if (k === "name") { r.uni(); const c = r.id(); out.push({ kind: "name", class: c, name: r.uni() }); }
      else throw new Error(`an unknown reference "${k}"`);
    }
    return out;
  }
  function readDescriptor(r) {
    r.uni(); const cls = r.id(), n = r.u32(), out = { _class: cls };
    for (let i = 0; i < n; i++) { const key = r.id(), type = r.ascii(4); out[key] = readValue(r, type); }
    return out;
  }
  /** an .atn's bytes -> its set */
  function read(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), r = reader(u8);
    const version = r.u32(); if (version !== 16) throw new Error(`not an .atn action file (version ${version}, expected 16)`);
    const name = r.uni(); r.u8();
    const n = r.u32(), actions = [];
    for (let a = 0; a < n; a++) {
      const fkey = r.u16(), shift = !!r.u8(), cmd = !!r.u8(), color = r.u16(), aname = r.uni(); r.u8();
      const m = r.u32(), items = [];
      for (let k = 0; k < m; k++) {
        r.u8(); const enabled = !!r.u8(), dialog = !!r.u8(), dlgOpt = r.u8();
        const idType = r.ascii(4), event = idType === "TEXT" ? r.pascal() : r.ascii(4);
        const iname = r.pascal(), has = r.i32();
        const desc = has === -1 ? readDescriptor(r) : null;
        items.push({ event, name: iname, enabled, dialog, dlgOpt, desc });
      }
      actions.push({ name: aname, fkey, shift, cmd, color, items });
    }
    return { version, name, actions };
  }

  /* ================================ Photoshop steps -> bitGen steps ================================ */
  const num = (v) => (v == null ? undefined : typeof v === "object" ? +v.value : +v);
  const BLEND = { Nrml: "normal", Dslv: "dissolve", Drkn: "darken", Mltp: "multiply", CBrn: "color-burn", linearBurn: "linear-burn", Lghn: "lighten", Scrn: "screen", CDdg: "color-dodge", linearDodge: "linear-dodge",
    Ovrl: "overlay", SftL: "soft-light", HrdL: "hard-light", vividLight: "vivid-light", linearLight: "linear-light", pinLight: "pin-light", hardMix: "hard-mix", Dfrn: "difference", Xclu: "exclusion", H: "hue", Strt: "saturation", Clr: "color", Lmns: "luminosity" };
  const targets = (d, cls) => !!(d && Array.isArray(d.null) && d.null.some((x) => x.class === cls));
  const F = (id, params, label) => ({ kind: "filter", id, params: params || {}, label });
  const C = (id, label) => ({ kind: "cmd", id, label });
  const clean = (o) => { const out = {}; for (const [k, v] of Object.entries(o)) if (v != null && !Number.isNaN(v)) out[k] = v; return out; };
  /** one Photoshop item -> a bitGen step | null */
  function stepOf(it) {
    const d = it.desc || {}, e = it.event;
    switch (e) {
      case "GsnB": case "gaussianBlur": return F("gaussian", clean({ radius: num(d["Rds "]) }), "Gaussian Blur");
      case "UnsM": case "unsharpMask": return F("unsharp", clean({ amount: num(d.Amnt), radius: num(d["Rds "]), threshold: num(d.Thsh) }), "Unsharp Mask");
      case "MdnN": case "median": return F("median", clean({ radius: num(d["Rds "]) }), "Median");
      case "Invr": case "invert": return F("invert", {}, "Invert");
      case "Dstt": case "desaturate": return F("desaturate", {}, "Desaturate");
      case "Eqlz": case "equalize": return F("equalize", {}, "Equalize");
      case "Pstr": case "posterization": return F("posterize", clean({ levels: num(d.Lvls) }), "Posterize");
      case "Thrs": case "thresholdClassEvent": return F("threshold", clean({ level: num(d["Lvl "]) }), "Threshold");
      case "Msc ": case "mosaic": return F("pixelate", clean({ cell: num(d.ClSz) }), "Mosaic");
      case "AdNs": case "addNoise": return F("noise", clean({ amount: num(d.Nose), mono: d.Mnch }), "Add Noise");
      case "Embs": case "emboss": return F("emboss", clean({ angle: num(d.Angl), height: num(d.Hght), amount: num(d.Amnt) }), "Emboss");
      case "BrgC": case "brightnessEvent": return F("brightness", clean({ brightness: num(d.Brgh), contrast: num(d.Cntr) }), "Brightness / Contrast");
      case "HStr": case "hueSaturation": {
        const a = Array.isArray(d.Adjs) ? d.Adjs.find((x) => !x.LclR) || d.Adjs[0] : null;
        return F("huesat", clean({ hue: num(a && a["H   "]), saturation: num(a && a.Strt), lightness: num(a && a.Lght) }), "Hue / Saturation");
      }
      case "Fltn": case "flattenImage": return C("layer.flatten", "Flatten Image");
      case "Mrg2": case "MrgL": case "mergeLayersNew": return C("layer.mergedown", "Merge Down");
      case "Dplc": case "duplicate": return targets(d, "Lyr ") || !d.null ? C("layer.dup", "Duplicate Layer") : null;
      case "Dlt ": case "delete": return targets(d, "Lyr ") ? C("layer.del", "Delete Layer") : null;
      case "Mk  ": case "make": return targets(d, "Lyr ") ? C("layer.new", "New Layer") : null;
      case "Invs": case "inverse": return C("sel.inverse", "Inverse");
      case "Rtte": case "rotateEventEnum": { if (!targets(d, "Dcmn")) return null; const a = num(d.Angl); return a === 90 ? C("image.rot90", "Rotate 90° CW") : a === -90 || a === 270 ? C("image.rot-90", "Rotate 90° CCW") : a === 180 || a === -180 ? C("image.rot180", "Rotate 180°") : null; }
      case "Flip": case "flip": { if (!targets(d, "Dcmn")) return null; const ax = d.Axis && d.Axis.value; return ax === "Hrzn" ? C("image.fliph", "Flip Canvas Horizontal") : ax === "Vrtc" ? C("image.flipv", "Flip Canvas Vertical") : null; }
      case "Stop": case "stop": return { kind: "stop", msg: String(d.Msge || "").slice(0, 300), cont: !!d.Cntn };
      case "setd": case "set": {
        const sel = Array.isArray(d.null) && d.null.find((x) => x.class === "Chnl" && x.key === "fsel");
        if (sel) { const t = d["T   "]; if (t && t.value === "Al  ") return C("sel.all", "Select All"); if (t && t.value === "None") return C("sel.none", "Deselect"); return null; }
        if (targets(d, "Lyr ") && d["T   "] && d["T   "]._class === "Lyr ") {
          const L = d["T   "];
          if (L.Opct != null) return { kind: "set", what: "opacity", value: Math.round(num(L.Opct)) };
          if (L.fillOpacity != null) return { kind: "set", what: "fill", value: Math.round(num(L.fillOpacity)) };
          if (L["Md  "]) { const m = BLEND[String(L["Md  "].value).trim()] || BLEND[L["Md  "].value]; return m ? { kind: "set", what: "blend", value: m } : null; }
        }
        return null;
      }
    }
    return null;
  }
  /** an .atn (read) -> a bitGen set; unmatched steps come in OFF, named after the Photoshop step */
  function toSet(atn) {
    const notes = { mapped: 0, skipped: 0, names: [] };
    const actions = atn.actions.map((a) => ({
      name: String(a.name || "Action").slice(0, 60),
      steps: a.items.map((it) => {
        let st = null; try { st = stepOf(it); } catch (e) { st = null; }
        if (st) { notes.mapped++; return Object.assign({ on: it.enabled !== false }, st, it.dialog && (st.kind === "filter" || st.kind === "cmd") ? { modal: true } : {}); }
        notes.skipped++; if (!notes.names.includes(it.name)) notes.names.push(it.name);
        return { kind: "stop", msg: `.atn step: "${it.name}" (${it.event}) has no match here - switched off`, cont: true, on: false, label: "✕ " + String(it.name || it.event).slice(0, 50) };
      }),
    }));
    return { set: { name: String(atn.name || ".atn Actions").slice(0, 60), open: true, actions }, notes };
  }

  const PCAtn = { read, readDescriptor, readReference, readValue, reader, stepOf, toSet, BLEND };
  if (typeof module !== "undefined" && module.exports) module.exports = PCAtn;
  else root.PCAtn = PCAtn;
})(typeof window !== "undefined" ? window : globalThis);
