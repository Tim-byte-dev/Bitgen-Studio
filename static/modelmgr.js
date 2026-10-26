/* bitGen Studio — static/modelmgr.js (2.518.0): 🧩 THE MODEL + LoRA MANAGER, a floating docker (window.H3ModelMgr).
 * Tim (verbatim): "create a model and lora manager floating docker with checkbox to overide styles setting and a button
 * to create new style from the model i select. a card for each model, thumbnail, description, date released, rating,
 * cfg,steps,vae, text-encoder, the card will show thumbnail, name, rating, date released,model type(qwen,krea,flux,pony,
 * sdxl,illustrious etc), model category(image, image edit)video,music description will be a card that shows next to the
 * modelcard on mouseover and closes onmouseout. user will be able to select model + loras from the model manager. Lora
 * cards will have the same + keywords.Add civitai.red(if i can get an api key) so models can be downloaded to the
 * appropriate folder on my machine without moving it or choosing save as. etc."
 *
 *   🧩 Models (statusbar)   shows / hides it - a SecFloat docker: float it, dock it beside / inside another
 *   TABS          Models (checkpoints + diffusion models) · LoRAs · Civitai
 *   FILTERS       search · category (image / image edit / video / music) · type (SDXL, Pony, Flux ...) · sort
 *   A CARD        thumbnail, name, ★ rating, release date, type, category (LoRAs + their keywords); ✎ edits it,
 *                 🔍 looks a file up on Civitai by its SHA-256. Hover = the DESCRIPTION CARD beside it (description,
 *                 base model, cfg, steps, sampler, VAE, text encoder, keywords, size, file) - it closes when the
 *                 pointer leaves the card
 *   SELECT        click a model card = THE model; click LoRA cards = add / remove them (each with a weight); a
 *                 keyword chip clicked goes into the prompt
 *   ☐ Override the style   ticked: the selection is what Basic Settings renders with (Override style on, the
 *                 checkpoint override, the LoRAs as temporary LoRAs, the card's steps / cfg); unticked: put back
 *   ✚ New style   a new style from the selected model (+ LoRAs): the style that renders its type is copied
 *                 (lib/modelCards.styleFrom) - pick another template if you like
 *   CIVITAI       search (type, sort, base model) -> a result's versions -> ⤓ Download: it goes straight into the
 *                 right ComfyUI folder (lib/civitai.js), its picture + card beside it; the downloads list shows progress
 * 2.537.0 (Tim: "paginate the models tab, i have over 400 models ... make the card size resizable in edit mode, move
 * cards to fit the space of the docker, add a model info page, download info and thumbs and examples from civitai for
 * each matching model name, keep them in model_info folder made available to all projects. add a "used in this
 * project" tab to models docker, add tabs for each folder...not checkpoints/sdxl, but just SDXL etc. ... clicking the
 * card will select the model to use, clicking on it's mouseover description will go to full details of the model"):
 *   TABS          📌 This project (the models / LoRAs its jobs used) · Models · LoRAs · Civitai; under them the FOLDER
 *                 tabs - every first folder inside the category (checkpoints/SDXL/… -> "SDXL"), All first
 *   PAGES         as many cards as fit the docker (auto - it follows a resize) or 24 / 48 / 96 / 200 a page; ‹ 1 2 … ›
 *   ⇲ EDIT        card size: drag a card's corner (or the slider) - every card follows, the columns refill the width
 *   INFO PAGE     click the hover card (or ⓘ, or I on a focused card): the picture, every field, trigger words, the
 *                 description, the example pictures with their prompts (Use this prompt), ✓ Use this model, ✎, Civitai
 *   ⤓ CIVITAI INFO  details + thumbnail + example pictures for every card on this tab that has none yet (Shift = all
 *                 again), matched by the file's name - kept in <app>/model_info for every project (lib/modelInfo.js)
 * 2.538.0 (Tim: "add download button to civitai models ... store the folder location for each type of model and
 * lora ... shift+click the download button will open the dialog to change the folder ... add a sync button"):
 *   ⤓ ON A CIVITAI CARD  the newest version's main file -> the folder set for its type (lib/modelFolders.js keys
 *                 image|image-edit|video|music / sd1|sdxl|pony|... / model|lora|..., <app>/model_folders.json); none
 *                 set yet (or Shift+click) = the Select Folder dialog first, remembered. The versions view's ⤓ too.
 *   📁            the folders per type: Change… / ✕ forget / pick one for any type
 *   🔄 SYNC       Civitai's details for EVERY model + LoRA on this computer (every tab) - by its Civitai version id
 *                 when it has one, else SHA-256, else the file name (Shift = all of them again)
 * Pure (Node: scripts/test-modelmgr518.js, test-modelinfo537.js): filterCards, sortCards, stars, hoverPos, fmtSize,
 * mergeLoras, thumbUrl, pageOf, autoPer, pagerModel, inFolder.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  function filterCards(cards, f) {
    var q = String((f && f.q) || "").toLowerCase().trim(), cat = (f && f.category) || "", fam = (f && f.family) || "";
    return (cards || []).filter(function (c) {
      if (cat && c.category !== cat) return false;
      if (fam && c.family !== fam) return false;
      if (f && f.nsfw === false && c.nsfw) return false;          // 2.575.0: 🔞 unticked = NSFW cards hidden
      if (f && f.mtype && c.model_type !== f.mtype) return false; // 2.575.0: the model type
      if (!q) return true;
      var hay = [c.title, c.name, c.family_label, c.base_model, (c.keywords || []).join(" "), c.description].join(" ").toLowerCase();
      return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
    });
  }
  function sortCards(cards, by) {
    var a = (cards || []).slice();
    var rate = function (c) { return c.user_rating != null ? c.user_rating : c.rating || 0; };
    var date = function (c) { return c.released || c.file_date || ""; };
    if (by === "newest") a.sort(function (x, y) { return date(y) < date(x) ? -1 : date(y) > date(x) ? 1 : 0; });
    else if (by === "rating") a.sort(function (x, y) { return rate(y) - rate(x); });
    else if (by === "size") a.sort(function (x, y) { return (y.size || 0) - (x.size || 0); });
    else a.sort(function (x, y) { return String(x.title).localeCompare(String(y.title), undefined, { sensitivity: "base" }); });
    return a;
  }
  /** ★ 4.5 · 312 */
  function stars(c) {
    var r = c && c.user_rating != null ? c.user_rating : c && c.rating;
    if (r == null || !(r > 0)) return "";
    return "★ " + (Math.round(r * 10) / 10).toFixed(1) + (c.user_rating == null && c.rating_count ? " · " + c.rating_count : "");
  }
  /* 2.575.0 (Tim: "make the rating input in model manager 5 stars increment by 0.5 stars use actual stars the user can
     select, eg if user picks 4.5 stars show 4.5 fill stars like a ratings editor"): five stars, each filled 0 / half /
     whole (pure) - the editor's (data-mmstar on each, a click on its left half = .5) and the cards' (read-only) */
  function starBar(v, edit) {
    var r = v == null || !(+v >= 0) ? 0 : Math.max(0, Math.min(5, Math.round(+v * 2) / 2)), out = "";
    for (var i = 0; i < 5; i++) {
      var f = Math.max(0, Math.min(1, r - i));
      out += '<span class="mst"' + (edit ? ' data-mmstar="' + (i + 1) + '"' : "") + '><span class="mfill" style="width:' + (f * 100) + '%">★</span>★</span>';
    }
    return '<span class="mmstars' + (edit ? " edit" : "") + '"' + (edit ? ' role="slider" tabindex="0" aria-label="Your rating" aria-valuemin="0" aria-valuemax="5" aria-valuenow="' + r + '" aria-valuetext="' + r + ' stars"' : ' title="' + r + ' of 5"') + ">" + out + "</span>"
      + (edit ? "" : '<span class="mmstxt" style="margin-left:3px;color:#e6c84a">' + r.toFixed(1) + "</span>");
  }
  /** the half-star a pointer at x (0..1 across star n, 1-based) picks (pure) */
  function starAt(n, frac) { return Math.max(0.5, Math.min(5, (n - 1) + (frac < 0.5 ? 0.5 : 1))); }
  /** where the description card goes: right of the card, else left, else below; inside the window */
  function hoverPos(r, w, h, vw, vh) {
    var gap = 8, x, y = Math.max(4, Math.min(vh - h - 4, r.top));
    if (r.right + gap + w <= vw - 4) x = r.right + gap;
    else if (r.left - gap - w >= 4) x = r.left - gap - w;
    else { x = Math.max(4, Math.min(vw - w - 4, r.left)); y = Math.min(vh - h - 4, r.bottom + gap); }
    return { x: Math.round(x), y: Math.round(Math.max(4, y)) };
  }
  function fmtSize(b) { b = +b || 0; return b >= 1073741824 ? (b / 1073741824).toFixed(1) + " GB" : b >= 1048576 ? Math.round(b / 1048576) + " MB" : b >= 1024 ? Math.round(b / 1024) + " KB" : b ? b + " B" : ""; }
  /** the temp LoRA list with the manager's selection in it: `cur` minus what the manager added last time (`mine`), plus the selection */
  function mergeLoras(cur, mine, sel) {
    var drop = {}; (mine || []).forEach(function (p) { drop[p] = 1; });
    var out = (cur || []).filter(function (l) { return !drop[l.path]; });
    (sel || []).forEach(function (l) { var i = out.findIndex(function (x) { return x.path === l.path; }); if (i >= 0) out[i] = { path: l.path, weight: l.weight }; else out.push({ path: l.path, weight: l.weight }); });
    return out.slice(0, 12);
  }
  /** 2.581.0: a video thumbnail / example fills its box as a looping muted video (a GIF / WebP moves on its own) */
  function vidFill(u) { return '<video class="mmvid" src="' + esc(u) + '" muted loop autoplay playsinline preload="metadata" aria-hidden="true"></video>'; }
  function thumbUrl(c, v) { return c.remote ? (c.thumb ? "/api/civitai/img?u=" + encodeURIComponent(c.thumb) : "") : (c.thumb ? "/api/modelmgr/thumb?key=" + encodeURIComponent(c.key) + "&v=" + (v || 0) + (c.thumb_v ? "-" + encodeURIComponent(c.thumb_v) : "") : ""); }
  /* 2.537.0: pages */
  /** one page of a list -> {items, page (clamped), pages, from, to} (pure) */
  function pageOf(list, page, per) {
    var n = (list || []).length, pp = Math.max(1, Math.floor(+per || 1)), pages = Math.max(1, Math.ceil(n / pp));
    var p = Math.max(0, Math.min(pages - 1, Math.floor(+page || 0)));
    return { items: (list || []).slice(p * pp, p * pp + pp), page: p, pages: pages, from: n ? p * pp + 1 : 0, to: Math.min(n, p * pp + pp) };
  }
  /** how many cards fill a W x H grid: columns of at least cardW (they stretch), the thumb square + bodyH (pure) */
  function autoPer(W, H, cardW, bodyH, gap) {
    var g = gap == null ? 6 : gap, cw = Math.max(40, +cardW || 138);
    var cols = Math.max(1, Math.floor(((+W || 0) + g) / (cw + g)));
    var real = cols ? ((+W || cw) - (cols - 1) * g) / cols : cw;
    var rows = Math.max(1, Math.floor(((+H || 0) + g) / (real + (+bodyH || 70) + g)));
    return { cols: cols, rows: rows, per: cols * rows };
  }
  /** the page buttons: first, last, the current ±2, "…" between (pure) */
  function pagerModel(page, pages) {
    var out = [], last = -1;
    for (var i = 0; i < pages; i++) {
      if (i === 0 || i === pages - 1 || Math.abs(i - page) <= 2) { if (last >= 0 && i - last > 1) out.push("…"); out.push(i); last = i; }
    }
    return out;
  }
  /** a card in a folder tab ("" = all) (pure) */
  function inFolder(c, folder) { return !folder || String(c.folder || "").toLowerCase() === String(folder).toLowerCase(); }
  var pure = { starBar: starBar, starAt: starAt, filterCards: filterCards, sortCards: sortCards, stars: stars, hoverPos: hoverPos, fmtSize: fmtSize, mergeLoras: mergeLoras, thumbUrl: thumbUrl,
    pageOf: pageOf, autoPer: autoPer, pagerModel: pagerModel, inFolder: inFolder };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ================================ page ================================ */
  var CSS = ""
    + ".mmgr{display:flex;flex-direction:column;gap:6px;height:100%;min-height:0;font-size:.76rem}"
    // 2.581.0: a video thumbnail / example fills its box
    + ".mmgr .mmcard .th,.mmgr .mminfo .hero,.mmgr .mminfo .exg div{position:relative;overflow:hidden}.mmgr video.mmvid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;pointer-events:none}"
    + ".mmgr .mmanim{position:absolute;right:3px;bottom:3px;font-size:.55rem;padding:0 3px;border-radius:4px;background:rgba(0,0,0,.6);color:#ddd}"
    + ".mmgr .mmtabs{display:flex;gap:4px;flex-wrap:wrap;align-items:center}.mmgr .mmtabs button.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
    + ".mmgr .mmbar{display:flex;gap:4px;flex-wrap:wrap;align-items:center}.mmgr .mmbar input[type=search]{flex:1;min-width:120px}.mmgr .mmbar select{max-width:140px}"
    + ".mmgr .mmsel{border:1px solid var(--line,#3a342a);border-radius:6px;padding:5px 6px;display:flex;flex-direction:column;gap:4px;background:rgba(255,255,255,.02)}"
    + ".mmgr .mmsel .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.mmgr .mmsel .lab{color:var(--dim,#999)}"
    + ".mmgr .mmchip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line,#444);border-radius:12px;padding:1px 6px}"
    + ".mmgr .mmchip input[type=range]{width:70px}.mmgr .mmchip b{font-family:var(--mono,monospace);font-size:.68rem}"
    + ".mmgr .mmgrid{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--mmw,138px),1fr));gap:6px;align-content:start;padding:1px}"
    // 2.537.0: folder tabs, pages, edit mode (card size), the info page, the clickable hover card
    + ".mmgr .mmfold{display:flex;gap:3px;flex-wrap:wrap}.mmgr .mmfold button{padding:1px 7px;font-size:.68rem;border-radius:10px}.mmgr .mmfold button.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}.mmgr .mmfold i{font-style:normal;color:var(--dim,#999);margin-left:3px}"
    + ".mmgr .mmpager{display:flex;gap:3px;align-items:center;justify-content:center;flex-wrap:wrap}.mmgr .mmpager button{min-width:26px;padding:0 6px}.mmgr .mmpager button.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}.mmgr .mmpager span{color:var(--dim,#999)}"
    + ".mmgr .mmgrid.edit .mmcard{outline:1px dashed rgba(245,158,44,.45)}.mmgr .mmcard .grip{display:none;position:absolute;right:0;bottom:0;width:14px;height:14px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 50%,var(--tiger,#f59e2c) 50%)}.mmgr .mmgrid.edit .mmcard .grip{display:block}"
    + ".mmgr .mmfoldbox{display:flex;flex-direction:column;gap:4px;padding:6px;border:1px solid var(--line,#333);border-radius:6px;font-size:.78rem}.mmgr .mmfoldbox .r{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.mmgr .mmfoldbox code{flex:1;min-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dim,#999)}.mmgr #mmFoldBtn.on{outline:1px solid var(--acc,#6af)}"
    + ".mmgr .mmfetch{display:flex;gap:6px;align-items:center;color:var(--dim,#999)}.mmgr .mmcard .nfo{position:absolute;top:3px;left:3px;font-size:.6rem;padding:0 4px;border-radius:6px;background:rgba(0,0,0,.6);color:#9e9}"
    + ".mmgr .mminfo{grid-column:1/-1;display:flex;flex-direction:column;gap:8px}.mmgr .mminfo .ih{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.mmgr .mminfo .ih b{font-size:.95rem}"
    + ".mmgr .mminfo .ib{display:grid;grid-template-columns:minmax(140px,240px) 1fr;gap:10px}.mmgr .mminfo .hero{aspect-ratio:1/1;border-radius:8px;background:#111 center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:var(--dim);font-size:2rem}"
    + ".mmgr .mminfo .fg{display:grid;grid-template-columns:110px 1fr;gap:3px 8px;align-content:start}.mmgr .mminfo .fg span{color:var(--dim,#999)}.mmgr .mminfo .fg b{font-weight:500;word-break:break-word}"
    + ".mmgr .mminfo .btns{display:flex;gap:6px;flex-wrap:wrap}.mmgr .mminfo .st{color:var(--dim,#999)}.mmgr .mminfo .ds{white-space:pre-wrap;max-height:240px;overflow:auto;border:1px solid var(--line,#3a342a);border-radius:6px;padding:6px 8px}"
    + ".mmgr .mminfo .exg{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:5px}.mmgr .mminfo .exg div{aspect-ratio:1/1;border-radius:6px;background:#111 center/cover no-repeat;cursor:pointer;border:1px solid transparent}.mmgr .mminfo .exg div.on{border-color:var(--tiger,#f59e2c)}"
    + ".mmgr .mminfo .exm{border:1px solid var(--line,#3a342a);border-radius:6px;padding:6px 8px;display:flex;flex-direction:column;gap:4px}.mmgr .mminfo .exm pre{white-space:pre-wrap;margin:0;font:inherit;max-height:140px;overflow:auto}"
    + ".mmgr .mmcard{position:relative;border:1px solid var(--line,#3a342a);border-radius:7px;overflow:hidden;cursor:pointer;background:var(--panel,#1b1814);display:flex;flex-direction:column}"
    + ".mmgr .mmcard.sel{border-color:var(--tiger,#f59e2c);box-shadow:0 0 0 1px var(--tiger,#f59e2c)}"
    + ".mmgr .mmcard .th{aspect-ratio:1/1;background:#111 center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:var(--dim,#777);font-size:1.4rem;font-weight:600}"
    + ".mmgr .mmcard .bd{padding:4px 6px;display:flex;flex-direction:column;gap:2px}"
    + ".mmgr .mmcard .nm{font-weight:600;line-height:1.2;max-height:2.4em;overflow:hidden;word-break:break-word}"
    + ".mmgr .mmcard .mt{display:flex;gap:4px;flex-wrap:wrap;color:var(--dim,#999);font-size:.66rem}"
    + ".mmgr .mmcard .tag{border:1px solid var(--line,#444);border-radius:8px;padding:0 5px;font-size:.62rem}"
    + ".mmgr .mmcard .tag.fam{color:var(--tiger,#f59e2c)}.mmgr .mmcard .rt{color:#e6c84a}"
    // 2.575.0: the stars, NSFW, your media
    + ".mmstars{display:inline-flex;gap:1px;line-height:1;vertical-align:middle}.mmstars .mst{position:relative;display:inline-block;color:rgba(255,255,255,.22)}"
    + ".mmstars .mfill{position:absolute;left:0;top:0;overflow:hidden;color:#e6c84a;white-space:nowrap}.mmstars.edit{font-size:22px;cursor:pointer;outline:none}.mmstars.edit:focus{box-shadow:0 0 0 1px var(--tiger,#f59e2c);border-radius:4px}"
    + ".mmgr .mmcard .nsfw{position:absolute;top:3px;right:3px;font-size:.6rem;padding:0 4px;border-radius:6px;background:rgba(170,30,30,.85);color:#fff}"
    + ".mmgr .mmmediag{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:5px;margin:4px 0}.mmgr .mmmediag.drop{outline:2px dashed var(--tiger,#f59e2c)}"
    + ".mmgr .mmmedia{position:relative;aspect-ratio:1/1;border:1px solid var(--line,#3a342a);border-radius:6px;overflow:hidden;background:#111 center/cover no-repeat;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.6rem}"
    + ".mmgr .mmmedia.on{border-color:var(--tiger,#f59e2c)}.mmgr .mmmedia video{width:100%;height:100%;object-fit:cover;pointer-events:none}.mmgr .mmmedia .mk{position:absolute;top:2px;left:3px;font-size:.62rem;background:rgba(0,0,0,.6);border-radius:5px;padding:0 3px}"
    + ".mmgr .mmmedia .mmthumbmark{position:absolute;top:2px;right:3px;font-size:.62rem;background:var(--tiger,#f59e2c);color:#111;border-radius:5px;padding:0 3px}"
    + ".mmgr .mmmeta{display:grid;grid-template-columns:70px 1fr 70px 1fr;gap:3px 6px;align-items:center}.mmgr .mmmeta textarea{grid-column:2/5;min-height:54px}.mmgr .mmmeta input{width:100%}"
    + ".mmgr .mmcard .acts{position:absolute;top:3px;right:3px;display:flex;gap:2px;opacity:0;transition:opacity .12s}.mmgr .mmcard:hover .acts{opacity:1}"
    + ".mmgr .mmcard .acts button{padding:0 4px;font-size:.7rem;background:rgba(0,0,0,.6)}"
    + ".mmgr .mmcard .kw{display:flex;gap:3px;flex-wrap:wrap}.mmgr .kwc{font-size:.62rem;border-radius:8px;padding:0 5px;background:rgba(155,123,230,.18);color:#c9b8f2;cursor:copy}"
    + ".mmgr .mmmsg{color:var(--dim,#999);min-height:1em}.mmgr .mmmsg.bad{color:#e66}.mmgr .mmmsg.ok{color:#7c7}"
    + ".mmgr .mmform{border:1px solid var(--tiger,#f59e2c);border-radius:7px;padding:8px;display:grid;grid-template-columns:110px 1fr;gap:4px 8px;align-items:center}"
    + ".mmgr .mmform textarea{min-height:70px;grid-column:1/3}.mmgr .mmform .btns{grid-column:1/3;display:flex;gap:6px;justify-content:flex-end}"
    + ".mmgr .mmdl{max-height:120px;overflow:auto;border-top:1px solid var(--line,#3a342a);padding-top:4px}.mmgr .mmdl .d{display:grid;grid-template-columns:1fr 70px;gap:2px 6px}"
    + ".mmgr .mmdl .bar{grid-column:1/3;height:3px;background:rgba(255,255,255,.08)}.mmgr .mmdl .bar>i{display:block;height:100%;background:var(--tiger,#f59e2c)}"
    + ".mmgr .mmvers{border:1px solid var(--line,#3a342a);border-radius:7px;padding:6px;display:flex;flex-direction:column;gap:4px}"
    + "#mmHover{position:fixed;z-index:400;width:320px;max-height:70vh;overflow:auto;background:var(--panel,#1b1814);border:1px solid var(--tiger,#f59e2c);border-radius:8px;padding:9px 10px;box-shadow:0 12px 34px rgba(0,0,0,.55);font-size:.74rem;cursor:pointer;display:none}"
    + "#mmHover .go{color:var(--tiger,#f59e2c);font-size:.68rem;margin-top:6px;text-align:right}#mmHover:hover{box-shadow:0 0 0 1px var(--tiger,#f59e2c),0 12px 34px rgba(0,0,0,.55)}"
    + "#mmHover.on{display:block}#mmHover h4{margin:0 0 4px;font-size:.84rem}#mmHover .g{display:grid;grid-template-columns:96px 1fr;gap:2px 6px;margin:6px 0}#mmHover .g span{color:var(--dim,#999)}"
    + "#mmHover .ds{white-space:pre-wrap;color:var(--text,#ddd);max-height:30vh;overflow:hidden}#mmHover .kw{display:flex;gap:3px;flex-wrap:wrap;margin-top:4px}";
  var S = { tab: "models", data: null, q: "", category: "", family: "", sort: "name", sel: { model: null, loras: [] }, override: false,
            mine: [], prevOvr: null, prevCkpt: null, cv: { items: [], next: "", q: "", types: "", sort: "Highest Rated", base: "", open: null }, dl: [], v: 0, form: null,
            folder: "", page: 0, per: "auto", cardW: 138, nsfw: true, mtype: "", media: null, mSel: -1, mEdit: false, edit: false, info: null, infoData: null, exSel: 0, used: null, fetch: null, mf: {}, mfList: null, fold: false };
  var LS = "h3mm.sel.v1";
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function jget(u) { return fetch(u).then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); }); }
  function jpost(u, b) { return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); }); }
  function say(t, cls) { var m = $("mmMsg"); if (m) { m.textContent = t || ""; m.className = "mmmsg" + (cls ? " " + cls : ""); } }
  function lsGet() { try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) { return null; } }
  function lsSet() { try { localStorage.setItem(LS, JSON.stringify({ sel: S.sel, override: S.override, mine: S.mine, tab: S.tab, sort: S.sort, per: S.per, cardW: S.cardW, folder: S.folder, nsfw: S.nsfw })); } catch (e) { /* private window */ } }
  function all() { return S.data ? S.data.models.concat(S.data.loras) : []; }
  function byKey(k) { return all().find(function (c) { return c.key === k; }) || null; }

  function load(refresh) {
    say("reading the model folders…");
    return jget("/api/modelmgr/cards" + (refresh ? "?refresh=1" : "")).then(function (d) {
      if (d.error) { say(d.error, "bad"); return; }
      S.data = d; S.v++;
      say((d.models.length + " models · " + d.loras.length + " LoRAs") + (d.warnings && d.warnings.length ? " · " + d.warnings[0] : ""));
      paintFilters(); paint();
    }).catch(function (e) { say("could not read the model folders: " + e.message, "bad"); });
  }
  function paintFilters() {
    var fam = $("mmFam"); if (!fam || !S.data) return;
    var cur = fam.value;
    var mt = $("mmMType");
    if (mt) { var cm = mt.value; mt.innerHTML = '<option value="">every model type</option>' + (S.data.model_types || []).map(function (t) { return '<option>' + esc(t) + "</option>"; }).join(""); mt.value = cm; }
    fam.innerHTML = '<option value="">every family</option>' + S.data.families.map(function (f) { return '<option value="' + esc(f.id) + '">' + esc(f.label) + "</option>"; }).join("");
    fam.value = cur;
  }
  function cardHtml(c) {
    var sel = c.kind === "model" ? S.sel.model === c.key : S.sel.loras.some(function (l) { return l.key === c.key; });
    var t = thumbUrl(c, S.v), init = esc((c.family_label || "?").slice(0, 2));
    var date = c.released ? c.released : c.file_date ? "file " + c.file_date : "";
    return '<div class="mmcard' + (sel ? " sel" : "") + '" data-key="' + esc(c.key) + '" tabindex="0" role="button" aria-pressed="' + sel + '">'
      + '<div class="th"' + (t && c.thumb_kind !== "video" ? ' style="background-image:url(&quot;' + esc(t) + '&quot;)"' : "") + ">" + (t ? (c.thumb_kind === "video" ? vidFill(t) : "") : init) + "</div>"
      + (c.remote ? "" : c.info_status === "found" ? '<span class="nfo" title="Civitai details + ' + (c.examples || 0) + ' example pictures in model_info">ⓘ ' + (c.examples || 0) + "</span>" : "")
      + '<div class="acts">' + (c.remote ? '<button class="ghost" data-cvget title="⤓ Download the newest version into its type\'s folder (model_folders.json - asked once per type). Shift+click: change the folder">⤓</button>' : '<button class="ghost" data-mminfo title="ⓘ The full details (I)">ⓘ</button><button class="ghost" data-mmedit title="✎ Edit this card (name, type, cfg, steps, VAE, keywords…)">✎</button><button class="ghost" data-mmdel title="🗑 Delete this model from the disk (the file, its preview / info files beside it and its model_info page) - asks first">🗑</button>'
        + (c.civitai ? "" : '<button class="ghost" data-mmlook title="🔍 Look this file up on Civitai (reads its SHA-256 once)">🔍</button>')) + "</div>"
      + (c.nsfw ? '<span class="nsfw" title="marked NSFW">🔞</span>' : "")
      + (c.remote ? "" : '<span class="grip" data-mmgrip title="Drag: the card size (every card)"></span>')
      + '<div class="bd"><div class="nm" title="' + esc(c.name || c.title) + '">' + esc(c.title) + "</div>"
      + '<div class="mt">' + (c.remote ? '<span class="rt">' + esc(stars(c)) + "</span>" : (c.user_rating != null || c.rating ? starBar(c.user_rating != null ? c.user_rating : c.rating) : "")) + "<span>" + esc(date) + "</span></div>"
      + '<div class="mt"><span class="tag fam">' + esc(c.family_label) + '</span><span class="tag">' + esc(c.category) + "</span>" + (c.remote ? '<span class="tag">' + esc(c.type) + "</span>" : c.model_type ? '<span class="tag">' + esc(c.model_type) + "</span>" : "") + "</div>"
      + (c.kind === "lora" && (c.keywords || []).length ? '<div class="kw">' + c.keywords.slice(0, 4).map(function (k) { return '<span class="kwc" data-kw="' + esc(k) + '" title="Put it in the prompt">' + esc(k) + "</span>"; }).join("") + "</div>" : "")
      + "</div></div>";
  }
  function selHtml() {
    var m = S.sel.model ? byKey(S.sel.model) : null;
    var loras = S.sel.loras.map(function (l, i) {
      var c = byKey(l.key);
      return '<span class="mmchip" data-i="' + i + '">' + esc(c ? c.title : l.path) + ' <input type="range" min="-2" max="2" step="0.05" value="' + esc(l.weight) + '" aria-label="LoRA weight"><b>' + (+l.weight).toFixed(2)
        + '</b><button class="ghost" data-mmrm="' + i + '" title="Remove">✕</button></span>';
    }).join("");
    return '<div class="row"><span class="lab">Model</span>' + (m ? '<span class="mmchip"><b style="font-family:inherit">' + esc(m.title) + '</b><button class="ghost" data-mmrmm title="Clear the model">✕</button></span>' : '<span class="lab">click a model card</span>')
      + '<span class="lab">LoRAs</span>' + (loras || '<span class="lab">click LoRA cards</span>') + "</div>"
      + '<div class="row"><label title="Ticked: Basic Settings renders with this model + these LoRAs (Override style on, the checkpoint override, temporary LoRAs, the card\'s steps / cfg). Unticked: put back."><input type="checkbox" id="mmOverride"' + (S.override ? " checked" : "") + "> Override the style's model + LoRAs</label>"
      + '<button class="ghost" id="mmNewStyle" type="button"' + (m ? "" : " disabled") + ' title="A new style from the selected model (+ LoRAs) - the style that renders its type is copied">✚ New style from it…</button></div>';
  }
  function paint() {
    var host = $("mmBody"); if (!host) return;
    ["used", "models", "loras", "civitai", "paths"].forEach(function (t) { var b = document.querySelector('.mmgr [data-mmtab="' + t + '"]'); if (b) b.classList.toggle("on", S.tab === t); });
    // 2.580.0: 📁 Model paths - every group of extra_model_paths.yaml (static/mmpaths.js, lib/extraPaths.js)
    var paths = S.tab === "paths" && !S.info && !S.form;
    ["mmSel", "mmGrid", "mmFolders"].forEach(function (id) { var e = $(id); if (e && paths) e.style.display = "none"; });
    if ($("mmPaths")) $("mmPaths").style.display = paths ? "" : "none";
    if (paths) { $("mmLocalBar").style.display = "none"; $("mmCvBar").style.display = "none"; $("mmPager").style.display = "none"; if (window.H3ModelPaths) window.H3ModelPaths.render($("mmPaths"), say); return; }
    $("mmSel").style.display = ""; $("mmGrid").style.display = "";
    $("mmLocalBar").style.display = S.tab === "civitai" ? "none" : "";
    $("mmCvBar").style.display = S.tab === "civitai" ? "" : "none";
    $("mmSel").innerHTML = selHtml();
    var grid = $("mmGrid");
    grid.style.setProperty("--mmw", S.cardW + "px");
    grid.classList.toggle("edit", !!S.edit && !S.info && S.tab !== "civitai");
    if ($("mmEdit")) $("mmEdit").classList.toggle("on", !!S.edit);
    if ($("mmSizeBox")) $("mmSizeBox").style.display = S.edit ? "" : "none";
    if ($("mmSize")) $("mmSize").value = S.cardW;
    $("mmFolders").style.display = S.tab === "civitai" || S.info ? "none" : "";
    $("mmPager").style.display = "none";
    paintFetch();
    if (S.form || S.info) { try { hideHover(); } catch (e) { /* fine */ } }   // 2.575.0: the hover card never sits over the editor / the info page
    if (S.form) { grid.innerHTML = S.form; bindForm(); return; }
    if (S.info) {
      var hadBack = document.activeElement && document.activeElement.id === "mmBack";
      grid.innerHTML = infoHtml(); bindInfo(); paintDl(); bindSel();
      if (hadBack && $("mmBack")) try { $("mmBack").focus({ preventScroll: true }); } catch (e) { /* fine */ }
      return;
    }
    if (S.tab === "civitai") {
      var cv = S.cv;
      grid.innerHTML = (cv.open ? versHtml(cv.open) : "") + (cv.items.length ? cv.items.map(function (c) { return cardHtml(c); }).join("") : '<div class="mmmsg" style="grid-column:1/-1">' + (cv.msg || "Search Civitai - models go straight into the right ComfyUI folder.") + "</div>")
        + (cv.next ? '<div style="grid-column:1/-1"><button class="ghost" id="mmMore" type="button">More…</button></div>' : "");
      if ($("mmMore")) $("mmMore").onclick = function () { cvSearch(true); };
      bindVers();
    } else {
      var list = tabList();
      paintFolders(list);
      var shown = shownList(list);
      var per = perPage(); S.lastPer = per;
      var pg = pageOf(shown, S.page, per);
      S.page = pg.page;
      grid.innerHTML = shown.length ? pg.items.map(cardHtml).join("") : '<div class="mmmsg" style="grid-column:1/-1">' + (S.data ? (list.length ? "nothing matches" + (S.folder ? " in " + esc(S.folder) : "")
        : S.tab === "used" ? (S.used == null ? "reading this project's jobs…" : "this project's jobs have not used a model ComfyUI lists yet - pick one in Models") : "no " + (S.tab === "loras" ? "LoRAs" : "models") + " in ComfyUI's folders" + (S.data.dir ? "" : " - set the ComfyUI folder in Settings -> ComfyUI")) : "…") + "</div>";
      paintPager(pg, shown.length);
    }
    paintDl();
    bindSel();
  }
  /* ---- 2.537.0: tabs, folders, pages, edit mode */
  function tabList() {
    if (!S.data) return [];
    if (S.tab === "loras") return S.data.loras;
    if (S.tab === "used") { var set = {}; (S.used || []).forEach(function (k) { set[k] = 1; }); return all().filter(function (c) { return set[c.key]; }); }
    return S.data.models;
  }
  function shownList(list) {
    return sortCards(filterCards(list, { q: S.q, category: S.category, family: S.family, nsfw: S.nsfw, mtype: S.mtype }).filter(function (c) { return inFolder(c, S.folder); }), S.sort);
  }
  function perPage() {
    if (S.per !== "auto") return Math.max(1, +S.per || 48);
    var grid = $("mmGrid"); if (!grid || !grid.clientWidth) return 48;
    var one = grid.querySelector(".mmcard .bd"), bodyH = one ? one.offsetHeight + 2 : 70;
    return autoPer(grid.clientWidth - 2, grid.clientHeight - 2, S.cardW, bodyH, 6).per;
  }
  function paintFolders(list) {
    var box = $("mmFolders"); if (!box) return;
    var seen = {}, tabs = [];
    list.forEach(function (c) { var f = String(c.folder || ""); if (!f) return; var k = f.toLowerCase(); if (!seen[k]) { seen[k] = { id: k, label: f, n: 0 }; tabs.push(seen[k]); } seen[k].n++; });
    tabs.sort(function (a, b) { return a.label.localeCompare(b.label, undefined, { sensitivity: "base" }); });
    if (S.folder && !seen[S.folder]) S.folder = "";
    box.innerHTML = tabs.length ? '<button class="ghost' + (S.folder ? "" : " on") + '" data-mmfold="" type="button">All<i>' + list.length + "</i></button>"
      + tabs.map(function (t) { return '<button class="ghost' + (S.folder === t.id ? " on" : "") + '" data-mmfold="' + esc(t.id) + '" type="button" title="the ' + esc(t.label) + ' folder">' + esc(t.label) + "<i>" + t.n + "</i></button>"; }).join("") : "";
    box.querySelectorAll("[data-mmfold]").forEach(function (b) { b.onclick = function () { S.folder = b.dataset.mmfold; S.page = 0; lsSet(); if (window.H3FolderMem) window.H3FolderMem.set("mm:" + S.tab, S.folder || null); paint(); }; });   // 2.559.0: kept per tab
  }
  function paintPager(pg, n) {
    var box = $("mmPager"); if (!box) return;
    box.style.display = n ? "" : "none";
    var btn = function (i, lbl, dis) { return '<button class="ghost' + (i === pg.page && lbl == null ? " on" : "") + '" type="button" data-mmpg="' + i + '"' + (dis ? " disabled" : "") + ">" + (lbl != null ? lbl : i + 1) + "</button>"; };
    box.innerHTML = btn(pg.page - 1, "‹", pg.page <= 0) + pagerModel(pg.page, pg.pages).map(function (x) { return x === "…" ? "<span>…</span>" : btn(x); }).join("") + btn(pg.page + 1, "›", pg.page >= pg.pages - 1)
      + '<span>' + pg.from + "-" + pg.to + " of " + n + "</span>"
      + '<select id="mmPer" aria-label="Cards a page" title="Cards a page - auto = as many as fit the docker"><option value="auto">auto (fit)</option><option>24</option><option>48</option><option>96</option><option>200</option></select>';
    $("mmPer").value = String(S.per);
    $("mmPer").onchange = function (e) { var first = S.page * perPage(); S.per = e.target.value; S.page = Math.floor(first / perPage()); lsSet(); paint(); };
    box.querySelectorAll("[data-mmpg]").forEach(function (b) { b.onclick = function () { S.page = +b.dataset.mmpg; paint(); $("mmGrid").scrollTop = 0; }; });
  }
  function setCardW(w, quiet) {
    S.cardW = Math.max(90, Math.min(360, Math.round(+w || 138)));
    var grid = $("mmGrid"); if (grid) grid.style.setProperty("--mmw", S.cardW + "px");
    if ($("mmSize")) $("mmSize").value = S.cardW;
    if (!quiet) { lsSet(); paint(); }
  }
  var refit = null;
  function onResize() {
    if (S.per !== "auto" || S.info || S.form || S.tab === "civitai" || S.tab === "paths") return;
    clearTimeout(refit); refit = setTimeout(function () { var first = S.page * (S.lastPer || perPage()); var p = perPage(); if (p !== S.lastPer) { S.page = Math.floor(first / p); S.lastPer = p; paint(); } }, 120);
  }
  function loadUsed() {
    return jget("/api/modelmgr/used").then(function (j) { S.used = (j && j.keys) || []; if (S.tab === "used") paint(); }).catch(function () { S.used = []; });
  }
  /* ---- ⤓ details + thumbs + examples from Civitai (lib/modelInfo.js) */
  var fetchT = null;
  function startFetch(force) {
    var keys = S.tab === "civitai" ? [] : shownList(tabList()).map(function (c) { return c.key; });
    if (!keys.length) { say("no cards on this tab to look up", "bad"); return; }
    jpost("/api/modelmgr/fetch", { keys: keys, force: !!force }).then(function (j) {
      if (j.error) { say(j.error, "bad"); return; }
      say("⤓ asking Civitai about " + j.queued + " model" + (j.queued === 1 ? "" : "s") + (j.skipped ? " (" + j.skipped + " already have their details - Shift+click fetches again)" : "") + " - kept in model_info for every project", "ok");
      S.fetch = j.status; paintFetch(); pollFetch(); if (root.H3CivitaiSync) root.H3CivitaiSync.watch();   // 2.575.0
    });
  }
  function pollFetch() {
    clearTimeout(fetchT);
    jget("/api/modelmgr/fetch").then(function (st) {
      var was = S.fetch && S.fetch.running;
      S.fetch = st; paintFetch();
      if (st.running) fetchT = setTimeout(pollFetch, 1500);
      else if (was) { say("⤓ Civitai: " + st.found + " found, " + st.nomatch + " with no match" + (st.failed ? ", " + st.failed + " failed" + (st.log && st.log.length ? " (" + st.log[st.log.length - 1] + ")" : "") : ""), st.failed ? "bad" : "ok"); load(true); }
    }).catch(function () { /* offline */ });
  }
  function paintFetch() {
    var box = $("mmFetchMsg"); if (!box) return;
    var st = S.fetch;
    box.style.display = st && (st.running || st.total) ? "" : "none";
    if (!st) return;
    box.innerHTML = (st.running ? "⤓ Civitai " + st.done + " / " + st.total + (st.current ? " · " + esc(st.current) : "") : "⤓ last run: " + st.done + " / " + st.total)
      + " · " + st.found + " found · " + st.nomatch + " no match" + (st.failed ? " · " + st.failed + " failed" : "") + (st.running ? ' <button class="ghost" id="mmFetchStop" type="button">■ Stop</button>' : "");
    if ($("mmFetchStop")) $("mmFetchStop").onclick = function () { jpost("/api/modelmgr/fetch/stop", {}).then(function (x) { S.fetch = x; paintFetch(); }); };
  }
  /* ---- the info page */
  function openInfo(key) {
    var c = byKey(key); if (!c) return;
    hideHover();
    S.info = key; S.infoData = null; S.exSel = 0; S.form = null; S.media = null; S.mSel = -1; S.mEdit = false; paint();
    loadMedia(key);                                                       // 2.575.0: your files of it
    try { $("mmBack").focus({ preventScroll: true }); } catch (e) { /* fine */ }        // Esc = back (the card it was on is gone)
    jget("/api/modelmgr/info?key=" + encodeURIComponent(key)).then(function (d) { if (S.info !== key) return; S.infoData = d.error ? { error: d.error } : d; paint(); });
  }
  function closeInfo() { S.info = null; S.infoData = null; paint(); }
  /* 2.579.0 (Tim: "allow user to delete models in model manager" + "when user deletes model in model manager, delete it from
     the disk too"): 🗑 - what goes is listed first (the file, the files beside it, its model_info page, the styles that
     use it), then the file is deleted from the disk for good (lib/modelDelete.js) */
  function delModel(key) {
    var c = byKey(key); if (!c) return Promise.resolve(null);
    return jget("/api/modelmgr/delete?key=" + encodeURIComponent(key)).then(function (d) {
      if (d.error) { say(d.error, "bad"); return null; }
      var lines = ["Delete " + d.name + " (" + fmtSize(d.size) + ") from the disk?", "", "This removes for good (not the recycle bin):", "• " + d.abs];
      if (d.sidecars.length) lines.push("• beside it: " + d.sidecars.join(", "));
      if (d.info) lines.push("• its model_info page (Civitai details, examples, your pictures of it)");
      if (d.styles.length) lines.push("", "⚠ Used by " + d.styles.length + " style(s): " + d.styles.slice(0, 8).join(", ") + (d.styles.length > 8 ? " …" : "") + " - they will miss it.");
      var ask = typeof root.appConfirm === "function" ? root.appConfirm(lines.join("\n"), "Delete model") : Promise.resolve(root.confirm(lines.join("\n")));
      return Promise.resolve(ask).then(function (ok) {
        if (!ok) { say("not deleted"); return null; }
        say("deleting " + d.name + "…");
        return jpost("/api/modelmgr/delete", { key: key }).then(function (r) {
          if (r.error) { say(r.error, "bad"); return null; }
          if (S.sel.model === key) S.sel.model = "";
          S.sel.loras = S.sel.loras.filter(function (l) { return l.key !== key; });
          lsSet();
          if (S.info === key) { S.info = null; S.infoData = null; }
          S.form = null;
          return load(true).then(function () { say("🗑 " + d.name + " deleted from the disk (" + fmtSize(r.freed) + " freed)", "ok"); return r; });
        });
      });
    }).catch(function (e) { say("delete: " + e.message, "bad"); return null; });
  }
  function infoHtml() {
    var c = byKey(S.info), d = S.infoData;
    if (!c) return '<div class="mminfo"><button class="ghost" id="mmBack" type="button">‹ Back</button> that card is gone</div>';
    var row = function (k, v) { return v == null || v === "" ? "" : "<span>" + esc(k) + "</span><b>" + esc(v) + "</b>"; };
    var t = thumbUrl(c, S.v), sel = c.kind === "model" ? S.sel.model === c.key : S.sel.loras.some(function (l) { return l.key === c.key; });
    var ver = d && d.version, ex = (d && d.examples) || [];
    var stTxt = !d ? "reading…" : d.error ? d.error : d.status === "found" ? "Civitai details kept in " + d.folder + " (matched by " + ({ file: "file name", stem: "file name", hash: "SHA-256", size: "size + name" }[d.match] || d.match) + (d.fetched_at ? ", " + new Date(d.fetched_at).toLocaleDateString() : "") + ")"
      : d.status === "nomatch" ? "No Civitai model matched this file's name yet (searched for “" + esc((d.query || c.file)) + "”) - 🔍 By SHA-256 is exact" : c.civitai ? "Civitai details from beside the model file" : "No Civitai details yet - ⤓ Civitai info fetches them";
    var kw = (c.keywords && c.keywords.length ? c.keywords : (ver && ver.trained_words) || []);
    var desc = (c.description || (ver && ver.description) || "");
    var e = ex[S.exSel], em = e ? e.meta || {} : null;
    return '<div class="mminfo"><div class="ih"><button class="ghost" id="mmBack" type="button" title="Back to the cards (Esc)">‹ Back</button><b>' + esc(c.title) + '</b> ' + (c.user_rating != null || c.rating ? starBar(c.user_rating != null ? c.user_rating : c.rating) : "") + (c.nsfw ? ' <span title="marked NSFW">🔞</span>' : "")
      + '<span class="tag fam" style="color:var(--tiger)">' + esc(c.family_label) + "</span><span>" + esc(c.category) + "</span>" + (c.folder ? "<span style='color:var(--dim)'>📁 " + esc(c.folder) + "</span>" : "") + "</div>"
      + '<div class="ib"><div class="hero"' + (t && c.thumb_kind !== "video" ? ' style="background-image:url(&quot;' + esc(t) + '&quot;)"' : "") + ">" + (t ? (c.thumb_kind === "video" ? vidFill(t) : "") : esc((c.family_label || "?").slice(0, 2))) + "</div>"
      + '<div><div class="fg">' + row("Rating", stars(c) || "—") + row("Released", c.released || (c.file_date ? "— (file " + c.file_date + ")" : "")) + row("Base model", c.base_model || (ver && ver.base_model))
      + row("Version", ver && ver.name) + row("Model type", c.model_type || (ver && ver.model_type) || (c.kind === "lora" ? "LoRA" : c.cat)) + row("NSFW", c.nsfw ? "yes 🔞" : "") + row("CFG", c.cfg == null ? "— (the style's)" : c.cfg) + row("Steps", c.steps == null ? "— (the style's)" : c.steps)
      + row("Sampler", c.sampler) + row("VAE", c.vae || "the workflow's own") + row("Text encoder", c.te || "the workflow's own") + row("Size", c.on_disk === false ? "ComfyUI lists it - its file is not where this computer can read it" : fmtSize(c.size)) + row("File", c.name) + "</div>"
      + '<div class="btns" style="margin-top:8px"><button type="button" id="mmIUse"' + (sel ? ' class="ghost"' : "") + ">" + (sel ? "✓ In use - click to remove" : c.kind === "lora" ? "✓ Add this LoRA" : "✓ Use this model") + "</button>"
      + '<button class="ghost" type="button" id="mmIEdit">✎ Edit card</button><button class="ghost" type="button" id="mmIFetch" title="Ask Civitai again for this file (Shift: even if it has details)">⤓ ' + (d && d.status === "found" ? "Again" : "Civitai info") + "</button>"
      + '<button class="ghost" type="button" id="mmILook" title="Read the file\'s SHA-256 once and ask Civitai (exact)">🔍 By SHA-256</button>'
      + '<button class="ghost" type="button" id="mmIDel" title="Delete this model from the disk - the file, its preview / info files beside it and its model_info page (asks first)">🗑 Delete</button>'
      + (d && d.url ? '<a class="ghost" href="' + esc(d.url) + '" target="_blank" rel="noopener" style="align-self:center">Civitai ↗</a>' : "") + "</div>"
      + '<div class="st" style="margin-top:6px">' + stTxt + "</div></div></div>"
      + (kw.length ? '<div class="kw" style="display:flex;gap:3px;flex-wrap:wrap">' + kw.slice(0, 40).map(function (k) { return '<span class="kwc" data-kw="' + esc(k) + '" title="Put it in the prompt">' + esc(k) + "</span>"; }).join("") + "</div>" : "")
      + (desc ? '<div class="ds">' + esc(desc) + "</div>" : "")
      + mediaHtml(c)                                                      // 2.575.0: your pictures / videos / sounds
      + (ex.length ? "<b>Civitai's examples</b><div class=\"exg\">" + ex.map(function (x, i) { var exu = "/api/modelmgr/example?key=" + encodeURIComponent(c.key) + "&n=" + i + "&v=" + (d.fetched_at || 0); return '<div data-mmex="' + i + '" data-media="' + esc(x.media || "image") + '" class="' + (i === S.exSel ? "on" : "") + '"' + (x.media === "video" ? "" : ' style="background-image:url(&quot;' + esc(exu) + '&quot;)"') + ' title="Click: see it whole (its prompt + settings below) · then Ctrl+↓: the card\'s thumbnail">' + (x.media === "video" ? vidFill(exu) : x.media === "animated" ? '<span class="mmanim">GIF</span>' : "") + "</div>"; }).join("") + "</div>"
        + (em ? '<div class="exm"><pre>' + esc(em.prompt || "(no prompt with this picture)") + "</pre>" + (em.negative ? "<pre style='color:var(--dim)'>Negative: " + esc(em.negative) + "</pre>" : "")
          + '<div style="color:var(--dim)">' + esc([em.cfg != null ? "cfg " + em.cfg : "", em.steps != null ? em.steps + " steps" : "", em.sampler, em.seed != null ? "seed " + em.seed : "", em.size].filter(Boolean).join(" · ")) + "</div>"
          + (em.prompt ? '<div class="btns"><button class="ghost" type="button" id="mmIPrompt" title="Its prompt with its seed, cfg and steps into the prompt box + Basic Settings">✎→ To prompt (prompt, seed, cfg, steps)</button></div>' : "") + "</div>" : "") : "")
      + "</div>";
  }
  function bindInfo() {
    var key = S.info, c = byKey(key);
    if ($("mmBack")) $("mmBack").onclick = closeInfo;
    if (!c) return;
    if ($("mmIUse")) $("mmIUse").onclick = function () { pick(key); };
    if ($("mmIEdit")) $("mmIEdit").onclick = function () { S.info = null; editForm(key); };
    if ($("mmIDel")) $("mmIDel").onclick = function () { delModel(key); };
    if ($("mmILook")) $("mmILook").onclick = function () { lookup(key); };
    if ($("mmIFetch")) $("mmIFetch").onclick = function (e) {
      jpost("/api/modelmgr/fetch", { keys: [key], force: true }).then(function (j) { if (j.error) { say(j.error, "bad"); return; } say("⤓ asking Civitai about " + c.file + "…"); S.fetch = j.status; pollFetch(); var wait = function () { jget("/api/modelmgr/fetch").then(function (st) { if (st.running) setTimeout(wait, 1200); else load(true).then(function () { if (S.info === key) openInfo(key); }); }); }; setTimeout(wait, 1200); });
      void e;
    };
    var grid = $("mmGrid");
    // 2.575.0 (Tim: "when user clicks one of the preview thumbs open the whole image in the dialog we currently use"):
    // a click opens the viewer (and picks it - its prompt + settings show below when the viewer closes)
    grid.querySelectorAll("[data-mmex]").forEach(function (x) {
      x.onclick = function () {
        var n = +x.dataset.mmex;
        var items = ((S.infoData || {}).examples || []).map(function (e, i) { return { url: "/api/modelmgr/example?key=" + encodeURIComponent(key) + "&n=" + i + "&v=" + ((S.infoData || {}).fetched_at || 0), kind: e.media === "video" ? "video" : "image", name: c.title + " · example " + (i + 1) }; });
        S.exSel = n; S.lastPick = "ex"; paint();
        if (typeof root.lbOpen === "function") root.lbOpen(items, n);
      };
    });
    if ($("mmIPrompt")) $("mmIPrompt").onclick = function () {
      var e = ((S.infoData || {}).examples || [])[S.exSel]; if (!e) return;
      useMeta(e.meta || {}, kindForCard(c));                               // 2.575.0: + its seed, cfg, steps
    };
    var hero = $("mmGrid").querySelector(".mminfo .hero");
    if (hero && thumbUrl(c, S.v)) { hero.style.cursor = "pointer"; hero.title = "Click: see it whole"; hero.onclick = function () { if (typeof root.lbOpen === "function") root.lbOpen([{ url: thumbUrl(c, S.v), kind: c.thumb_kind === "video" ? "video" : "image", name: c.title }], 0); }; }
    bindMedia(c);                                                          // 2.575.0
  }
  function bindSel() {
    var box = $("mmSel");
    box.querySelectorAll(".mmchip[data-i]").forEach(function (ch) {
      var i = +ch.dataset.i, r = ch.querySelector("input[type=range]"), b = ch.querySelector("b");
      r.oninput = function () { S.sel.loras[i].weight = +r.value; b.textContent = (+r.value).toFixed(2); };
      r.onchange = function () { changed(); };
    });
    box.querySelectorAll("[data-mmrm]").forEach(function (x) { x.onclick = function () { S.sel.loras.splice(+x.dataset.mmrm, 1); changed(); paint(); }; });
    var rm = box.querySelector("[data-mmrmm]"); if (rm) rm.onclick = function () { S.sel.model = null; changed(); paint(); };
    $("mmOverride").onchange = function (e) { setOverride(e.target.checked); };
    $("mmNewStyle").onclick = function () { newStyleForm(); };
  }
  function changed() { lsSet(); if (S.override) apply(); }
  function pick(key) {
    var c = byKey(key); if (!c) return;
    if (c.kind === "model") S.sel.model = S.sel.model === key ? null : key;
    else {
      var i = S.sel.loras.findIndex(function (l) { return l.key === key; });
      if (i >= 0) S.sel.loras.splice(i, 1); else S.sel.loras.push({ key: key, path: c.name, weight: 1 });
    }
    changed(); paint();
  }

  /* ---- override: the selection IS Basic Settings' render settings */
  /* the page's own helpers (index.html): its functions are window's; `store` is a top-level const (shared by every script) */
  function g(name) {
    if (name === "store") { try { return typeof store !== "undefined" ? store : undefined; } catch (e) { return undefined; } }
    return root[name];
  }
  function apply() {
    var m = S.sel.model ? byKey(S.sel.model) : null;
    var video = m && m.category === "video";
    var kind = video ? "video" : "image";
    var ovr = $("ovrStyle");
    if (ovr && S.prevOvr === null) S.prevOvr = ovr.checked;
    if (ovr && !ovr.checked) { ovr.checked = true; ovr.dispatchEvent(new Event("change", { bubbles: true })); }
    if (!video) {
      var ck = $("imgCkpt"), store_ = g("store");
      if (ck) {
        if (S.prevCkpt === null) S.prevCkpt = ck.value;
        ck.value = m ? m.name : (S.prevCkpt || "");
        try { if (store_ && store_.set) store_.set("imgckpt", ck.value); } catch (e) { /* fine */ }
        var pc = g("paintImgCkpt"); if (typeof pc === "function") try { pc(); } catch (e) { /* fine */ }
      }
      if (m && m.steps != null && $("imgSteps")) { $("imgSteps").value = m.steps; $("imgSteps").dispatchEvent(new Event("input", { bubbles: true })); }
      if (m && m.cfg != null && $("imgCfg")) { $("imgCfg").value = m.cfg; $("imgCfg").dispatchEvent(new Event("input", { bubbles: true })); }
    }
    var tl = g("tempLoras"), mount = root.mountTempLoras, saveT = g("saveTempLoras");
    if (typeof tl === "function" && typeof mount === "function") {
      var host = kind === "video" ? "tlvRows" : "tliRows";
      var next = mergeLoras(tl(kind), S.mine, S.sel.loras.map(function (l) { return { path: l.path, weight: l.weight }; }));
      mount(kind, host, next);
      if (typeof saveT === "function") try { saveT(kind); } catch (e) { /* fine */ }
      S.mine = S.sel.loras.map(function (l) { return l.path; });
      S.mineKind = kind;
    }
    lsSet();
    say("Basic Settings now renders with " + (m ? m.title : "the style's model") + (S.sel.loras.length ? " + " + S.sel.loras.length + " LoRA" + (S.sel.loras.length > 1 ? "s" : "") : "") + (video ? " (a video model: its LoRAs ride along; ✚ New style makes a video style from it)" : ""), "ok");
  }
  function unapply() {
    var tl = g("tempLoras"), mount = root.mountTempLoras, saveT = g("saveTempLoras"), kind = S.mineKind || "image";
    if (typeof tl === "function" && typeof mount === "function" && S.mine.length) {
      mount(kind, kind === "video" ? "tlvRows" : "tliRows", mergeLoras(tl(kind), S.mine, []));
      if (typeof saveT === "function") try { saveT(kind); } catch (e) { /* fine */ }
    }
    S.mine = [];
    var ck = $("imgCkpt");
    if (ck && S.prevCkpt !== null) {
      ck.value = S.prevCkpt; var store_ = g("store"); try { if (store_ && store_.set) store_.set("imgckpt", ck.value); } catch (e) { /* fine */ }
      var pc = g("paintImgCkpt"); if (typeof pc === "function") try { pc(); } catch (e) { /* fine */ }
    }
    var ovr = $("ovrStyle");
    if (ovr && S.prevOvr !== null && ovr.checked !== S.prevOvr) { ovr.checked = S.prevOvr; ovr.dispatchEvent(new Event("change", { bubbles: true })); }
    S.prevCkpt = null; S.prevOvr = null;
    lsSet();
    say("the style's own model + LoRAs again");
  }
  function setOverride(on) { S.override = !!on; if (on) apply(); else unapply(); paint(); }

  /* ---- ✚ New style */
  function newStyleForm() {
    var m = S.sel.model ? byKey(S.sel.model) : null; if (!m) return;
    var fam = (S.data.families || []).find(function (f) { return f.id === m.family; }) || {};
    var kind = m.category === "video" ? "video" : m.category === "music" ? "music" : "image";
    var tpls = (S.data.templates || []).filter(function (t) { return t.kind === kind; });
    S.form = '<form class="mmform" id="mmForm" style="grid-column:1/-1"><b style="grid-column:1/3">✚ New style from ' + esc(m.title) + (S.sel.loras.length ? " + " + S.sel.loras.length + " LoRA(s)" : "") + "</b>"
      + '<label for="mmfName">Name</label><input id="mmfName" value="' + esc(m.title).slice(0, 80) + '">'
      + '<label for="mmfTpl">Copy the style</label><select id="mmfTpl"><option value="">automatic (' + esc(fam.label || m.family_label) + ")</option>"
      + tpls.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.name) + (t.arch ? " · " + esc(t.arch) : "") + "</option>"; }).join("") + "</select>"
      + '<span class="lab" style="grid-column:1/3;color:var(--dim)">Its workflow, text encoder, VAE, sampler and negative are copied; this model, the LoRAs and the card\'s cfg / steps / VAE / text encoder replace them.</span>'
      + '<div class="btns"><button type="button" class="ghost" id="mmfCancel">Cancel</button><button type="submit" id="mmfGo">✚ Create the style</button></div></form>';
    paint();
  }
  /* ---- 2.575.0: the star editor - hover shows, a click sets (left half of a star = .5), ←/→ by half a star */
  function bindStars(host) {
    var w = host && host.querySelector(".mmstars.edit"), inp = $("mmeRate"), txt = $("mmeRateTxt"); if (!w || !inp) return;
    var show = function (v) { var r = v == null || v === "" ? null : +v; w.querySelectorAll(".mst").forEach(function (st, i) { st.firstChild.style.width = (Math.max(0, Math.min(1, (r || 0) - i)) * 100) + "%"; }); };
    var set = function (v) { inp.value = v == null ? "" : String(v); w.setAttribute("aria-valuenow", v == null ? 0 : v); w.setAttribute("aria-valuetext", v == null ? "not rated" : v + " stars"); if (txt) txt.textContent = v == null ? "not rated" : v + " / 5"; show(v); };
    var at = function (e) { var st = e.target.closest && e.target.closest("[data-mmstar]"); if (!st) return null; var r = st.getBoundingClientRect(); return starAt(+st.dataset.mmstar, r.width ? (e.clientX - r.left) / r.width : 1); };
    w.addEventListener("mousemove", function (e) { var v = at(e); if (v != null) { show(v); if (txt) txt.textContent = v + " / 5"; } });
    w.addEventListener("mouseleave", function () { set(inp.value === "" ? null : +inp.value); });
    w.addEventListener("click", function (e) { var v = at(e); if (v != null) set(v); });
    w.addEventListener("keydown", function (e) {
      var cur = inp.value === "" ? 0 : +inp.value;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); set(Math.min(5, cur + 0.5)); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); set(cur - 0.5 <= 0 ? null : cur - 0.5); }
      else if (/^[0-5]$/.test(e.key)) { e.preventDefault(); e.stopPropagation(); set(+e.key || null); }
    });
    if ($("mmeRateX")) $("mmeRateX").onclick = function () { set(null); };
  }
  /** the cards again, then the same view (the edit form / the info page) on the same card */
  function reloadKeep(key, editing) {
    return load(true).then(function () { if (editing) editForm(key); else if (S.info === key) openInfo(key); });
  }
  /** 🖼 a picture (a File) as the card's thumbnail, or {item: id} - one of its own pictures */
  function setThumb(key, x) {
    var p;
    if (x && x.item) p = jpost("/api/modelmgr/thumb", { key: key, item: x.item });
    else { var fd = new FormData(); fd.append("key", key); fd.append("file", x, x.name || "thumb.png"); p = fetch("/api/modelmgr/thumb", { method: "POST", body: fd }).then(function (r) { return r.json(); }); }
    return p.then(function (j) { if (j.error) { say(j.error, "bad"); return; } say("🖼 the card's thumbnail is set (kept in model_info - the model's folder is untouched)", "ok"); reloadKeep(key, !!S.form); });
  }

  /* ---- 2.575.0 (Tim: "allow user to change the thumbnail and add images,sound or video of the model and example prompts
     or metadata from the image/video/music. when user clicks one of the preview thumbs open the whole image in the
     dialog we currently use to view images/videos/music"): YOUR FILES of the model (lib/modelMedia) - ＋ Add (files,
     or drop pictures / videos / songs from the gallery or Assets), a click opens the viewer (lbOpen), ✎→ its prompt +
     seed / cfg / steps to the prompt, 🖼 as the thumbnail, ✎ its prompt + settings, 🗑 */
  function mediaUrl(key, it) { return "/api/modelmgr/media/file?key=" + encodeURIComponent(key) + "&id=" + encodeURIComponent(it.id); }
  function loadMedia(key) {
    return jget("/api/modelmgr/media?key=" + encodeURIComponent(key)).then(function (d) { if (S.info !== key) return; S.media = d.error ? { items: [], thumb: "", error: d.error } : d; paint(); });
  }
  function kindForCard(c) { return c && c.category === "video" ? "video" : c && c.category === "music" ? "audio" : "image"; }
  function mediaHtml(c) {
    var m = S.media, items = (m && m.items) || [];
    var tile = function (it, i) {
      var u = esc(mediaUrl(c.key, it)), meta = it.meta || {};
      var inner = it.kind === "image" ? "" : it.kind === "video" ? '<video src="' + u + '#t=0.1" preload="metadata" muted></video>' : "🔊";
      return '<div class="mmmedia' + (i === S.mSel ? " on" : "") + '" data-mmm="' + i + '"' + (it.kind === "image" ? ' style="background-image:url(&quot;' + u + '&quot;)"' : "")
        + ' title="' + esc(it.name + (meta.prompt ? "\n" + meta.prompt.slice(0, 200) : "") + "\nclick: see it whole · then Ctrl+↓: the card's thumbnail") + '">' + inner
        + '<span class="mk">' + ({ image: "🖼", video: "🎬", audio: "🔊" }[it.kind] || "") + "</span>"
        + (m.thumb && (it.kind === "image" || it.kind === "video") && m.thumb_of === it.id ? '<span class="mmthumbmark">thumb</span>' : "")
        + '<span style="position:absolute;right:2px;bottom:2px;display:flex;gap:2px">'
        + (meta.prompt || meta.seed != null ? '<button type="button" class="ghost" data-mmmuse="' + i + '" title="✎→ To prompt: its prompt with its seed, cfg and steps" style="padding:0 3px;font-size:11px;background:rgba(20,18,15,.8)">✎→</button>' : "")
        + (it.kind === "image" || it.kind === "video" ? '<button type="button" class="ghost" data-mmmthumb="' + i + '" title="Use it as the card\'s thumbnail" style="padding:0 3px;font-size:11px;background:rgba(20,18,15,.8)">🖼</button>' : "")
        + '<button type="button" class="ghost" data-mmmedit="' + i + '" title="Its prompt + settings" style="padding:0 3px;font-size:11px;background:rgba(20,18,15,.8)">✎</button>'
        + '<button type="button" class="ghost" data-mmmdel="' + i + '" title="Delete it (from model_info)" style="padding:0 3px;font-size:11px;background:rgba(20,18,15,.8)">🗑</button></span></div>';
    };
    var sel = items[S.mSel], sm = sel ? sel.meta || {} : null;
    return '<div class="mmmine"><b>Your pictures, videos and sounds</b> <button type="button" class="ghost" id="mmMAdd" title="Add pictures, videos or sounds of this model - from this computer (or drop them here from the gallery / Assets)">＋ Add…</button>'
      + '<input type="file" id="mmMFile" accept="image/*,video/*,audio/*" multiple hidden>'
      + ' <span style="color:var(--dim);font-size:.7rem">' + (m ? (items.length ? items.length + " file(s) - click one to see it whole" : "none yet - ＋ Add, or drop pictures / videos / songs here from the gallery or Assets") : "reading…") + "</span>"
      + '<div class="mmmediag" id="mmMGrid">' + items.map(tile).join("") + "</div>"
      + (sel && S.mEdit ? '<form class="mmmeta" id="mmMMeta"><b style="grid-column:1/5">✎ ' + esc(sel.name) + (sm.from ? ' <small style="color:var(--dim)">(read from: ' + esc(sm.from) + ")</small>" : "") + "</b>"
        + '<label for="mmMPrompt">Prompt</label><textarea id="mmMPrompt">' + esc(sm.prompt || "") + "</textarea>"
        + '<label for="mmMNeg">Negative</label><textarea id="mmMNeg" style="min-height:30px">' + esc(sm.negative || "") + "</textarea>"
        + '<label for="mmMSeed">Seed</label><input id="mmMSeed" type="number" value="' + esc(sm.seed == null ? "" : sm.seed) + '"><label for="mmMSteps">Steps</label><input id="mmMSteps" type="number" min="1" max="200" value="' + esc(sm.steps == null ? "" : sm.steps) + '">'
        + '<label for="mmMCfg">CFG</label><input id="mmMCfg" type="number" step="0.1" min="0" max="30" value="' + esc(sm.cfg == null ? "" : sm.cfg) + '"><label for="mmMSampler">Sampler</label><input id="mmMSampler" value="' + esc(sm.sampler || "") + '">'
        + '<div class="btns" style="grid-column:1/5;display:flex;gap:6px"><button type="button" class="ghost" id="mmMCancel">Close</button><button type="button" class="ghost" id="mmMUse">✎→ To prompt</button><button type="submit">💾 Save</button></div></form>' : "")
      + "</div>";
  }
  function mediaMetaOf(it) { return (it && it.meta) || {}; }
  function addMediaFiles(key, files) {
    var list = [].slice.call(files || []);
    if (!list.length) return Promise.resolve();
    say("adding " + list.length + " file(s)…");
    return list.reduce(function (p, file) {
      return p.then(function () {
        var fd = new FormData(); fd.append("key", key); fd.append("file", file, file.name);
        return fetch("/api/modelmgr/media", { method: "POST", body: fd }).then(function (r) { return r.json(); }).then(function (j) { if (j.error) say(file.name + ": " + j.error, "bad"); return j; });
      });
    }, Promise.resolve()).then(function () { say("added - a click on one shows it whole; ✎ its prompt + settings", "ok"); return loadMedia(key).then(function () { reloadCardsQuiet(); }); });
  }
  function addMediaProject(key, src, name) {
    say("adding " + name + "…");
    return jpost("/api/modelmgr/media", { key: key, src: src, name: name }).then(function (j) {
      if (j.error) { say(j.error, "bad"); return; }
      var mm = (j.item && j.item.meta) || {};
      say("added " + name + (mm.prompt ? " - with its prompt" + (mm.seed != null ? ", seed " + mm.seed : "") + (mm.steps != null ? ", " + mm.steps + " steps" : "") + (mm.cfg != null ? ", cfg " + mm.cfg : "") : " (no prompt in it - ✎ adds one)"), "ok");
      return loadMedia(key).then(function () { reloadCardsQuiet(); });
    });
  }
  function reloadCardsQuiet() { return jget("/api/modelmgr/cards?refresh=1").then(function (d) { if (!d.error) { S.data = d; S.v++; } }); }
  function bindMedia(c) {
    var key = c.key, items = (S.media && S.media.items) || [], grid = $("mmMGrid");
    if ($("mmMAdd")) $("mmMAdd").onclick = function () { $("mmMFile").value = ""; $("mmMFile").click(); };
    if ($("mmMFile")) $("mmMFile").onchange = function () { addMediaFiles(key, this.files); };
    var box = grid ? grid.parentNode : null;
    if (box) {
      box.addEventListener("dragover", function (e) { e.preventDefault(); grid.classList.add("drop"); });
      box.addEventListener("dragleave", function (e) { if (!box.contains(e.relatedTarget)) grid.classList.remove("drop"); });
      box.addEventListener("drop", function (e) {
        e.preventDefault(); grid.classList.remove("drop");
        var dp = g("dragPayload");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { addMediaFiles(key, e.dataTransfer.files); return; }
        var multi = null; try { multi = JSON.parse(e.dataTransfer.getData("text/h3multi") || "null"); } catch (er) { multi = null; }
        var list = multi && multi.length ? multi : dp ? [dp] : [];
        if (!list.length) { var n = e.dataTransfer.getData("text/plain"); if (n) list = [{ type: "output", name: n }]; }
        list.reduce(function (p, x) { return p.then(function () { var src = x.type === "asset" ? (x.kind === "images" || x.kind === "video" || x.kind === "sound" ? x.kind : "images") : "output"; return addMediaProject(key, src, x.name); }); }, Promise.resolve());
      });
    }
    if (!grid) return;
    grid.querySelectorAll("[data-mmm]").forEach(function (t) {
      t.addEventListener("click", function (e) {
        if (e.target.closest("button")) return;
        var i = +t.dataset.mmm;
        S.mSel = i; S.lastPick = "media";                                  // 2.576.0: Ctrl+↓ = this one as the thumbnail
        grid.querySelectorAll("[data-mmm]").forEach(function (x) { x.classList.toggle("on", x === t); });
        var lb = items.map(function (it) { return { url: mediaUrl(key, it), kind: it.kind, name: c.title + " · " + it.name }; });
        if (typeof root.lbOpen === "function") root.lbOpen(lb, i);
      });
    });
    var each = function (attr, fn) { grid.querySelectorAll("[" + attr + "]").forEach(function (b) { b.addEventListener("click", function (e) { e.stopPropagation(); fn(+b.getAttribute(attr)); }); }); };
    each("data-mmmuse", function (i) { useMeta(mediaMetaOf(items[i]), items[i].kind === "audio" ? "audio" : items[i].kind); });
    each("data-mmmthumb", function (i) { setThumb(key, { item: items[i].id }); });
    each("data-mmmedit", function (i) { S.mSel = i; S.mEdit = true; paint(); });
    each("data-mmmdel", function (i) {
      var go = function () { jpost("/api/modelmgr/media/delete", { key: key, id: items[i].id }).then(function (j) { if (j.error) { say(j.error, "bad"); return; } S.mSel = -1; S.mEdit = false; loadMedia(key); reloadCardsQuiet(); }); };
      var cf = root.appConfirm ? root.appConfirm("Delete " + items[i].name + " from this model's files?") : Promise.resolve(root.confirm("Delete " + items[i].name + "?"));
      Promise.resolve(cf).then(function (ok) { if (ok) go(); });
    });
    var f = $("mmMMeta");
    if (f) {
      var read = function () { var n = function (id) { var v = $(id).value; return v === "" ? null : +v; }; return { prompt: $("mmMPrompt").value, negative: $("mmMNeg").value, seed: n("mmMSeed"), steps: n("mmMSteps"), cfg: n("mmMCfg"), sampler: $("mmMSampler").value }; };
      f.querySelectorAll("input,textarea").forEach(function (x) { x.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
      $("mmMCancel").onclick = function () { S.mEdit = false; paint(); };
      $("mmMUse").onclick = function () { var it = items[S.mSel]; useMeta(read(), it && it.kind === "audio" ? "audio" : it ? it.kind : kindForCard(c)); };
      f.onsubmit = function (e) {
        e.preventDefault();
        var it = items[S.mSel]; if (!it) return;
        jpost("/api/modelmgr/media/update", { key: key, id: it.id, meta: Object.assign({}, it.meta || {}, read(), { from: "you" }) }).then(function (j) { if (j.error) { say(j.error, "bad"); return; } say("saved its prompt + settings", "ok"); S.mEdit = false; loadMedia(key); });
      };
    }
  }
  /** ✎→ To prompt - static/usemeta.js (the prompt + seed / cfg / steps into the prompt box + Basic Settings) */
  function useMeta(meta, kind) {
    var U = root.H3UseMeta;
    if (!U) { var pr = $("prompt"); if (pr && meta.prompt) { pr.value = meta.prompt; pr.dispatchEvent(new Event("input", { bubbles: true })); } return; }
    var w = U.apply(meta || {}, kind || "image");
    say(w ? "✎→ " + w : "no prompt or settings to use", w ? "ok" : "bad");
  }
  function bindForm() {
    var f = $("mmForm"); if (!f) return;
    $("mmfCancel") && ($("mmfCancel").onclick = function () { S.form = null; paint(); });
    if ($("mmfGo") && $("mmfName")) f.onsubmit = function (e) {
      e.preventDefault();
      var body = { model: S.sel.model, loras: S.sel.loras.map(function (l) { return { key: l.key, weight: l.weight }; }), name: $("mmfName").value.trim(), template_id: $("mmfTpl").value };
      $("mmfGo").disabled = true;
      jpost("/api/modelmgr/style", body).then(function (j) {
        if (j.error) { say(j.error, "bad"); $("mmfGo").disabled = false; return; }
        S.form = null; paint();
        say("✚ style \"" + j.style.name + "\" made - " + (j.notes || []).join("; ") + (j.missing && j.missing.length ? " · still missing: " + j.missing.join(", ") : ""), "ok");
        var rs = j.style.kind === "video" ? g("refreshVideoStyles") : g("refreshStyles");
        if (typeof rs === "function") try { rs(); } catch (er) { /* fine */ }
      });
    };
    bindStars(f);
    if ($("mmeThumb")) $("mmeThumb").onclick = function () { $("mmeThumbF").value = ""; $("mmeThumbF").click(); };
    if ($("mmeThumbF")) $("mmeThumbF").onchange = function () { var x = this.files && this.files[0]; if (x) setThumb(f.dataset.key, x); };
    if ($("mmeThumbX")) $("mmeThumbX").onclick = function () { jpost("/api/modelmgr/thumb/clear", { key: f.dataset.key }).then(function (j) { if (j.error) { say(j.error, "bad"); return; } say("its own thumbnail again", "ok"); reloadKeep(f.dataset.key, true); }); };
    if ($("mmeSave")) f.onsubmit = function (e) {
      e.preventDefault();
      var key = f.dataset.key, v = function (id) { return $(id) ? $(id).value : ""; };
      var fields = { title: v("mmeTitle"), user_rating: v("mmeRate"), family: v("mmeFam"), category: v("mmeCat"), cfg: v("mmeCfg"), steps: v("mmeSteps"), vae: v("mmeVae"), te: v("mmeTe"),
        model_type: v("mmeType"), nsfw: !!($("mmeNsfw") && $("mmeNsfw").checked),
        keywords: v("mmeKw"), released: v("mmeRel"), description: v("mmeDesc") };
      jpost("/api/modelmgr/card", { key: key, fields: fields }).then(function (j) {
        if (j.error) { say(j.error, "bad"); return; }
        S.form = null; say("card saved (beside the model as " + key.split("|").pop().replace(/\.[^.]+$/, "") + ".bitgen.json)", "ok"); load(true);
      });
    };
  }
  function editForm(key) {
    var c = byKey(key); if (!c) return;
    var opt = function (list, cur, blank) { return (blank != null ? '<option value="">' + esc(blank) + "</option>" : "") + list.map(function (x) { var id = x.id != null ? x.id : x, lb = x.label != null ? x.label : x; return '<option value="' + esc(id) + '"' + (String(id) === String(cur) ? " selected" : "") + ">" + esc(lb) + "</option>"; }).join(""); };
    S.form = '<form class="mmform" id="mmForm" data-key="' + esc(key) + '" style="grid-column:1/-1"><b style="grid-column:1/3">✎ ' + esc(c.file) + "</b>"
      + '<label for="mmeTitle">Name</label><input id="mmeTitle" value="' + esc(c.title) + '">'
      // 2.575.0: the thumbnail (your picture - kept in model_info, the model's folder untouched)
      + '<label>Thumbnail</label><span style="display:flex;gap:6px;align-items:center"><span class="mmethumb" style="position:relative;overflow:hidden;width:56px;height:56px;border-radius:6px;background:#111 center/cover no-repeat' + (thumbUrl(c, S.v) && c.thumb_kind !== "video" ? ";background-image:url(&quot;" + esc(thumbUrl(c, S.v)) + "&quot;)" : "") + '">' + (thumbUrl(c, S.v) && c.thumb_kind === "video" ? vidFill(thumbUrl(c, S.v)) : "") + '</span>'
        + '<button type="button" class="ghost" id="mmeThumb" title="A picture from this computer as the card\'s thumbnail">🖼 Change…</button>'
        + (c.thumb_v ? '<button type="button" class="ghost" id="mmeThumbX" title="Back to its own thumbnail (Civitai\'s / the one beside the file)">↺ Its own</button>' : "")
        + '<input type="file" id="mmeThumbF" accept="image/png,image/jpeg,image/webp,image/gif" hidden></span>'
      // 2.575.0 (Tim: "5 stars increment by 0.5 stars use actual stars the user can select"): the star editor
      + '<label>Your rating</label><span style="display:flex;gap:8px;align-items:center">' + starBar(c.user_rating, true) + '<span id="mmeRateTxt" style="color:var(--dim)">' + (c.user_rating == null ? "not rated" : c.user_rating + " / 5") + '</span><button type="button" class="ghost" id="mmeRateX" title="No rating">✕</button>'
        + '<input id="mmeRate" type="hidden" value="' + esc(c.user_rating == null ? "" : c.user_rating) + '"></span>'
      // 2.575.0 (Tim: "also add model type(checkpoint/lora/etc) to modelmanager editor" / "add a nsfw checkbox to modelmanager editor")
      + '<label for="mmeType">Model type</label><select id="mmeType">' + opt(S.data.model_types || [], c.model_type) + "</select>"
      + '<label for="mmeNsfw">NSFW</label><label style="display:inline-flex;gap:4px;align-items:center"><input type="checkbox" id="mmeNsfw"' + (c.nsfw ? " checked" : "") + '> 🔞 this model makes adult content (the 🔞 filter hides it)</label>'
      + '<label for="mmeFam">Family</label><select id="mmeFam">' + opt(S.data.families, c.family) + "</select>"
      + '<label for="mmeCat">Category</label><select id="mmeCat">' + opt(S.data.categories, c.category) + "</select>"
      + '<label for="mmeCfg">CFG</label><input id="mmeCfg" type="number" step="0.1" min="0" max="30" value="' + esc(c.cfg == null ? "" : c.cfg) + '">'
      + '<label for="mmeSteps">Steps</label><input id="mmeSteps" type="number" min="1" max="200" value="' + esc(c.steps == null ? "" : c.steps) + '">'
      + '<label for="mmeVae">VAE</label><select id="mmeVae">' + opt(S.data.vae || [], c.vae, "the workflow's own") + "</select>"
      + '<label for="mmeTe">Text encoder</label><select id="mmeTe">' + opt(S.data.te || [], c.te, "the workflow's own") + "</select>"
      + '<label for="mmeKw">Keywords</label><input id="mmeKw" value="' + esc((c.keywords || []).join(", ")) + '" placeholder="comma separated">'
      + '<label for="mmeRel">Released</label><input id="mmeRel" type="date" value="' + esc(c.released || "") + '">'
      + '<textarea id="mmeDesc" placeholder="Description">' + esc(c.description || "") + "</textarea>"
      + '<div class="btns"><button type="button" class="ghost" id="mmfCancel">Cancel</button><button type="submit" id="mmeSave">💾 Save card</button></div></form>';
    paint();
  }

  /* ---- the description card on hover */
  function hoverHtml(c) {
    var row = function (k, v) { return v == null || v === "" ? "" : "<span>" + esc(k) + "</span><b>" + esc(v) + "</b>"; };
    var desc = String(c.description || "").slice(0, 1400);
    return "<h4>" + esc(c.title) + "</h4><div style='color:var(--dim)'>" + esc([c.family_label, c.category, c.remote ? c.type : c.model_type || (c.kind === "lora" ? "LoRA" : c.cat), c.nsfw ? "🔞 NSFW" : ""].filter(Boolean).join(" · ")) + "</div>"
      + '<div class="g">' + row("Rating", stars(c) || "—") + row("Released", c.released || (c.file_date ? "— (file " + c.file_date + ")" : "")) + row("Base model", c.base_model)
      + row("CFG", c.cfg == null ? "— (the style's)" : c.cfg) + row("Steps", c.steps == null ? "— (the style's)" : c.steps) + row("Sampler", c.sampler)
      + row("VAE", c.remote ? "" : c.vae || "the workflow's own") + row("Text encoder", c.remote ? "" : c.te || "the workflow's own")
      + row("Size", fmtSize(c.size)) + row("File", c.name) + row("Creator", c.creator) + row("Downloads", c.downloads || "") + "</div>"
      + (desc ? '<div class="ds">' + esc(desc) + "</div>" : '<div class="ds" style="color:var(--dim)">No description yet' + (c.remote ? "" : " - 🔍 looks it up on Civitai, ✎ writes your own") + ".</div>")
      + ((c.keywords || []).length ? '<div class="kw">' + c.keywords.slice(0, 24).map(function (k) { return '<span class="kwc">' + esc(k) + "</span>"; }).join("") + "</div>" : "")
      + (c.remote ? '<div class="go">click: its versions + downloads ›</div>' : '<div class="go">click for the full details' + (c.examples ? " + " + c.examples + " example pictures" : "") + " ›</div>");
  }
  function showHover(el) {
    var key = el.dataset.key, c = S.tab === "civitai" ? S.cv.items.find(function (x) { return x.key === key; }) : byKey(key);
    var h = $("mmHover"); if (!c || !h) return;
    clearTimeout(hoverT);
    h.innerHTML = hoverHtml(c); h.classList.add("on"); h.dataset.key = key;
    var r = el.getBoundingClientRect(), p = hoverPos(r, h.offsetWidth || 320, h.offsetHeight || 300, window.innerWidth, window.innerHeight);
    h.style.left = p.x + "px"; h.style.top = p.y + "px";
  }
  function hideHover() { clearTimeout(hoverT); var h = $("mmHover"); if (h) h.classList.remove("on"); S.hoverEl = null; }
  // 2.537.0: the hover card stays while the pointer moves onto it - and a click on it opens the info page
  var hoverT = null;
  function hideSoon() { clearTimeout(hoverT); hoverT = setTimeout(hideHover, 260); }

  /* ---- Civitai */
  function cvSearch(more) {
    var cv = S.cv;
    cv.q = $("mmCvQ").value.trim(); cv.types = $("mmCvType").value; cv.sort = $("mmCvSort").value; cv.base = $("mmCvBase").value.trim();
    var qs = "query=" + encodeURIComponent(cv.q) + "&types=" + encodeURIComponent(cv.types) + "&sort=" + encodeURIComponent(cv.sort) + (cv.base ? "&baseModels=" + encodeURIComponent(cv.base) : "") + (more && cv.next ? "&cursor=" + encodeURIComponent(cv.next) : "");
    cv.msg = "asking Civitai…"; if (!more) { cv.items = []; cv.open = null; } paint();
    return jget("/api/civitai/search?" + qs).then(function (j) {
      if (j.error) { cv.msg = j.error; paint(); return; }
      var items = (j.items || []).map(function (m) { return Object.assign({}, m, { key: "cv|" + m.model_id, remote: true, kind: /lora|locon|dora/i.test(m.type) ? "lora" : "model" }); });
      cv.items = more ? cv.items.concat(items) : items; cv.next = j.next || ""; cv.msg = items.length ? "" : "nothing found";
      paint();
    });
  }
  function versHtml(c) {
    return '<div class="mmvers" style="grid-column:1/-1"><b>' + esc(c.title) + '</b> <a href="' + esc(c.url) + '" target="_blank" rel="noopener" style="color:var(--dim)">on Civitai ↗</a>'
      + c.versions.slice(0, 8).map(function (v) {
        return '<div class="row" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b>' + esc(v.name) + '</b><span style="color:var(--dim)">' + esc(v.base_model) + " · " + esc(v.released) + "</span>"
          + v.files.filter(function (f) { return f.cat; }).map(function (f) { return '<button class="ghost" type="button" data-cvdl="' + v.id + '" data-file="' + f.id + '" title="Download ' + esc(f.name) + " into ComfyUI's " + esc(f.cat) + ' folder">⤓ ' + esc(f.name) + " · " + fmtSize((f.size_kb || 0) * 1024) + " → " + esc(f.cat) + "</button>"; }).join("")
          + "</div>";
      }).join("")
      + '<div class="row" style="display:flex;gap:6px;align-items:center"><label for="mmCvSub">Into a subfolder (optional)</label><input id="mmCvSub" placeholder="e.g. sdxl" style="width:120px"><button class="ghost" type="button" id="mmCvClose">Close</button></div></div>';
  }
  function bindVers() {
    if ($("mmCvClose")) $("mmCvClose").onclick = function () { S.cv.open = null; paint(); };
    document.querySelectorAll(".mmgr [data-cvdl]").forEach(function (b) {
      b.onclick = function (e) {     // 2.538.0: into the type's folder (asked once; Shift+click changes it)
        var it = S.cv.open; if (!it) return;
        var v = (it.versions || []).find(function (x) { return String(x.id) === b.dataset.cvdl; }); if (!v) return;
        var f = (v.files || []).find(function (x) { return String(x.id) === b.dataset.file; }); if (!f) return;
        cvGet(it, v, f, e.shiftKey, ($("mmCvSub") || {}).value || "");
      };
    });
  }
  /* ---- 2.538.0: ⤓ a Civitai model into ITS TYPE'S FOLDER (lib/modelFolders.js, model_folders.json)
     Tim: "if folder location is set for a model type don't show the dialog, just download it to it's folder.
     shift+click the download button will open the dialog to change the folder. use the folder select dialog" */
  function bestFile(v) {
    var fs_ = ((v && v.files) || []).filter(function (f) { return f.cat; });
    return fs_.find(function (f) { return f.primary; }) || fs_[0] || null;
  }
  function cvQuick(key, shift) {
    var it = S.cv.items.find(function (x) { return x.key === key; }); if (!it) return;
    var v = (it.versions || [])[0], f = bestFile(v);
    if (!f) { say("this model has no file ComfyUI loads - open it on Civitai", "bad"); return; }
    cvGet(it, v, f, shift, "");
  }
  function pickFolder(r) {
    var title = "Where do " + r.label + " go?", start = r.dir || r.suggest || "";
    if (window.FileDialog && window.FileDialog.open) return window.FileDialog.open({ mode: "dir", title: title, okLabel: "Select", key: "modelfolder", start: start }).then(function (x) { return x ? (x.path || x.dir || "") : ""; });
    var t = window.prompt(title, start); return Promise.resolve(t ? t.trim() : "");
  }
  function cvGet(it, v, f, shift, sub) {
    return jpost("/api/modelfolders/resolve", { base_model: v.base_model, name: (it.title || "") + " " + (f.name || ""), cat: f.cat, type: it.type }).then(function (r) {
      if (r.error) { say(r.error, "bad"); return; }
      var go = function () {
        return jpost("/api/civitai/download", { version_id: v.id, file_id: f.id, folder: r.key, subfolder: sub || "", title: it.title }).then(function (j) {
          if (j.error) { say(j.error, "bad"); return; }
          say("⤓ " + f.name + " → " + r.label + " (" + r.dir + ")" + (shift ? "" : " · Shift+click changes the folder"), "ok"); pollDl();
        });
      };
      if (r.dir && !shift) return go();
      return pickFolder(r).then(function (dir) {
        if (!dir) { say("⤓ not downloaded - no folder picked for " + r.label); return; }
        return jpost("/api/modelfolders", { key: r.key, dir: dir }).then(function (x) {
          if (x.error) { say(x.error, "bad"); return; }
          S.mf[r.key] = x.dir; r.dir = x.dir; if (S.fold) loadFolders();
          return go();
        });
      });
    });
  }
  /* ---- 📁 the folders each type downloads to */
  function loadFolders() {
    return jget("/api/modelfolders").then(function (j) { S.mfList = j; S.mf = {}; (j.folders || []).forEach(function (x) { S.mf[x.key] = x.dir; }); paintFoldBox(); });
  }
  function paintFoldBox() {
    var box = $("mmFoldBox"); if (!box) return;
    box.style.display = S.fold ? "" : "none";
    if (!S.fold) return;
    var j = S.mfList; if (!j) { box.textContent = "…"; return; }
    var opt = function (o) { return Object.keys(o).map(function (k) { return '<option value="' + esc(k) + '">' + esc(o[k]) + "</option>"; }).join(""); };
    var mains = { image: "Image", "image-edit": "Image edit", video: "Video", music: "Music" };
    box.innerHTML = "<b>📁 Where each type downloads to</b> <span style='color:var(--dim)'>model_folders.json · ⤓ asks once per type, Shift+⤓ changes it</span>"
      + ((j.folders || []).length ? (j.folders || []).map(function (x) { return '<div class="r" data-mfkey="' + esc(x.key) + '"><span>' + esc(x.label) + '</span><code title="' + esc(x.dir) + '">' + esc(x.dir) + '</code><button class="ghost" type="button" data-mfchg>Change…</button><button class="ghost" type="button" data-mfdel title="Forget it - the next ⤓ asks again">✕</button></div>'; }).join("") : "<div style='color:var(--dim)'>none yet - the first ⤓ of each type asks</div>")
      + '<div class="r"><select id="mfMain" aria-label="Main category">' + opt(mains) + '</select><select id="mfType" aria-label="Model type">' + opt(j.types || {}) + '</select><select id="mfKind" aria-label="Kind">' + opt(j.kinds || {}) + '</select><button class="ghost" type="button" id="mfAdd">Pick a folder…</button></div>';
    var setKey = function (key, label, cur) {
      pickFolder({ label: label, dir: cur, suggest: "" }).then(function (dir) {
        if (!dir) return;
        jpost("/api/modelfolders", { key: key, dir: dir }).then(function (x) { if (x.error) { say(x.error, "bad"); return; } say("📁 " + x.label + " → " + x.dir, "ok"); loadFolders(); });
      });
    };
    box.querySelectorAll("[data-mfchg]").forEach(function (b) { b.onclick = function () { var k = b.closest("[data-mfkey]").dataset.mfkey, x = (j.folders || []).find(function (y) { return y.key === k; }) || {}; setKey(k, x.label || k, x.dir || ""); }; });
    box.querySelectorAll("[data-mfdel]").forEach(function (b) { b.onclick = function () { var k = b.closest("[data-mfkey]").dataset.mfkey; jpost("/api/modelfolders", { key: k, dir: "" }).then(function () { say("📁 forgotten - the next ⤓ asks again"); loadFolders(); }); }; });
    $("mfAdd").onclick = function () { var k = $("mfMain").value + "/" + $("mfType").value + "/" + $("mfKind").value; setKey(k, $("mfMain").selectedOptions[0].text + " · " + $("mfType").selectedOptions[0].text + " " + $("mfKind").selectedOptions[0].text, S.mf[k] || ""); };
  }
  /* ---- 🔄 Sync: Civitai's details for EVERY model on this computer (lib/modelInfo fetch {all, sync}) */
  function startSync(force) {
    jpost("/api/modelmgr/fetch", { all: true, sync: true, force: !!force }).then(function (j) {
      if (j.error) { say(j.error, "bad"); return; }
      say("🔄 syncing " + j.queued + " model" + (j.queued === 1 ? "" : "s") + " with Civitai" + (j.skipped ? " (" + j.skipped + " up to date - Shift+click syncs them all again)" : "") + " - by version id, SHA-256 or the file name", "ok");
      S.fetch = j.status; paintFetch(); pollFetch();
      if (root.H3CivitaiSync) root.H3CivitaiSync.watch();                 // 2.575.0: the status bar follows it
    });
  }
  var dlTimer = null;
  function pollDl() {
    clearTimeout(dlTimer);
    jget("/api/civitai/downloads").then(function (list) {
      var was = (S.dl || []).filter(function (d) { return d.status !== "done" && d.status !== "failed"; }).length;
      S.dl = Array.isArray(list) ? list : [];
      paintDl();
      var active = S.dl.some(function (d) { return d.status !== "done" && d.status !== "failed"; });
      if (active) dlTimer = setTimeout(pollDl, 1200);
      else if (was) load(true);
    }).catch(function () { /* offline */ });
  }
  function paintDl() {
    var box = $("mmDl"); if (!box) return;
    box.style.display = S.dl.length ? "" : "none";
    box.innerHTML = S.dl.slice(0, 8).map(function (d) {
      var pct = d.total ? Math.min(100, Math.round(d.got / d.total * 100)) : d.status === "done" ? 100 : 0;
      return '<div class="d"><span title="' + esc(d.dest || "") + '">' + esc(d.file || d.name || d.version_id) + (d.cat ? " → " + esc(d.cat) : "") + "</span><b>" + esc(d.status === "downloading" ? pct + " %" : d.status) + "</b>"
        + '<div class="bar"><i style="width:' + pct + '%"></i></div>' + (d.error ? '<span style="grid-column:1/3;color:#e66">' + esc(d.error) + "</span>" : d.note ? '<span style="grid-column:1/3;color:var(--dim)">' + esc(d.note) + "</span>" : "") + "</div>";
    }).join("");
  }
  var lookTimer = null;
  function lookup(key) {
    jpost("/api/civitai/lookup", { key: key }).then(function (j) {
      if (j.error) { say(j.error, "bad"); return; }
      say("🔍 reading the file's SHA-256 and asking Civitai…");
      clearTimeout(lookTimer);
      var poll = function () {
        jget("/api/civitai/lookups").then(function (ls) {
          var L = (ls || []).find(function (x) { return x.key === key; }); if (!L) return;
          if (L.status === "hashing" || L.status === "asking") { say("🔍 " + (L.status === "hashing" ? "reading the file " + (L.total ? Math.round(L.got / L.total * 100) + " %" : "") : "asking Civitai…")); lookTimer = setTimeout(poll, 1000); return; }
          say(L.status === "done" ? "🔍 found on Civitai - card filled in" : "🔍 " + (L.error || L.status), L.status === "done" ? "ok" : "bad");
          if (L.status === "done") load(true);
        });
      };
      poll();
    });
  }

  function build() {
    var body = document.createElement("div"); body.className = "mmgr"; body.id = "mmBody";
    body.innerHTML = '<div class="mmtabs"><button class="ghost" data-mmtab="used" type="button" title="The models + LoRAs this project\'s jobs used">📌 This project</button><button class="ghost" data-mmtab="models" type="button">Models</button><button class="ghost" data-mmtab="loras" type="button">LoRAs</button>'
      + '<button class="ghost" data-mmtab="civitai" type="button" title="Search Civitai and download into ComfyUI\'s folders">Civitai</button>'
      + '<button class="ghost" data-mmtab="paths" type="button" title="📁 ComfyUI\'s extra_model_paths.yaml - every group of paths: add a group (other_ui1 …), change a path, delete a group, ⟳ Restart ComfyUI">📁 Model paths</button>'
      + '<button class="ghost" id="mmFetch" type="button" style="margin-left:auto" title="⤓ Details, a thumbnail and example pictures from Civitai for every card on this tab that has none yet - matched by the file name, kept in model_info for every project. Shift+click: fetch them all again">⤓ Civitai info</button>'
      + '<button class="ghost" id="mmSync" type="button" title="🔄 Sync: Civitai\'s details, thumbnails and example pictures for EVERY model + LoRA on this computer (every tab) that has none yet or is out of date - by its Civitai version id, its SHA-256, else the file name. Shift+click: all of them again">🔄 Sync</button>'
      + '<button class="ghost" id="mmFoldBtn" type="button" title="📁 The folder each model type downloads to (model_folders.json)">📁</button>'
      + '<button class="ghost" id="mmEdit" type="button" title="⇲ Edit mode: drag a card\'s corner to size every card">⇲ Edit</button>'
      + '<button class="ghost" id="mmRescan" type="button" title="Read the model folders again">⟳</button></div>'
      + '<div class="mmfold" id="mmFolders" aria-label="Folders"></div>'
      + '<div class="mmbar" id="mmLocalBar"><input type="search" id="mmQ" placeholder="Search name, type, keywords…" aria-label="Search the models">'
      + '<select id="mmCat" aria-label="Category"><option value="">every category</option><option value="image">image</option><option value="image edit">image edit</option><option value="video">video</option><option value="music">music</option></select>'
      + '<select id="mmFam" aria-label="Family"><option value="">every family</option></select>'
      + '<select id="mmMType" aria-label="Model type" title="2.575.0: the kind of file - checkpoint, LoRA …"><option value="">every model type</option></select>'
      + '<label class="mmnsfw" title="2.575.0: 🔞 ticked = NSFW cards shown; unticked = hidden (mark a card NSFW in ✎ Edit)" style="display:inline-flex;gap:3px;align-items:center;white-space:nowrap;font-size:.72rem"><input type="checkbox" id="mmNsfw">🔞 NSFW</label>'
      + '<select id="mmSort" aria-label="Sort"><option value="name">A-Z</option><option value="newest">newest</option><option value="rating">rating</option><option value="size">size</option></select>'
      + '<span id="mmSizeBox" style="display:none" title="Card size"> ⇲ <input type="range" id="mmSize" min="90" max="360" step="2" aria-label="Card size"></span></div>'
      + '<div class="mmbar" id="mmCvBar" style="display:none"><input type="search" id="mmCvQ" placeholder="Search Civitai…" aria-label="Search Civitai">'
      + '<select id="mmCvType" aria-label="Civitai type"><option value="">every type</option><option value="Checkpoint">Checkpoint</option><option value="LORA">LoRA</option><option value="LoCon">LoCon</option><option value="DoRA">DoRA</option><option value="VAE">VAE</option><option value="TextualInversion">Embedding</option><option value="Controlnet">ControlNet</option><option value="Upscaler">Upscaler</option></select>'
      + '<select id="mmCvSort" aria-label="Civitai sort"><option>Highest Rated</option><option>Most Downloaded</option><option>Most Liked</option><option>Newest</option></select>'
      + '<input id="mmCvBase" placeholder="base model e.g. Pony" style="width:120px" aria-label="Base model"><button class="ghost" id="mmCvGo" type="button">Search</button></div>'
      + '<div class="mmsel" id="mmSel"></div><div class="mmmsg" id="mmMsg" aria-live="polite"></div><div class="mmfetch" id="mmFetchMsg" style="display:none"></div><div class="mmfoldbox" id="mmFoldBox" style="display:none"></div><div class="mmgrid" id="mmGrid"></div><div class="mmpaths" id="mmPaths" style="display:none"></div>'
      + '<div class="mmpager" id="mmPager" style="display:none"></div><div class="mmdl" id="mmDl" style="display:none"></div>';
    return body;
  }
  function wire(body) {
    body.querySelectorAll("[data-mmtab]").forEach(function (b) { b.onclick = function () { S.tab = b.dataset.mmtab; S.form = null; S.info = null; S.page = 0; S.folder = (window.H3FolderMem && window.H3FolderMem.get("mm:" + S.tab)) || ""; lsSet(); paint(); if (S.tab === "civitai") pollDl(); if (S.tab === "used") loadUsed(); if (S.tab === "paths" && window.H3ModelPaths) window.H3ModelPaths.load(); }; });
    $("mmRescan").onclick = function () { load(true); if (S.tab === "used") loadUsed(); };
    $("mmFetch").onclick = function (e) { startFetch(e.shiftKey); };
    $("mmSync").onclick = function (e) { startSync(e.shiftKey); };
    $("mmFoldBtn").onclick = function () { S.fold = !S.fold; $("mmFoldBtn").classList.toggle("on", S.fold); if (S.fold) loadFolders(); else paintFoldBox(); };
    $("mmEdit").onclick = function () { S.edit = !S.edit; paint(); };
    $("mmSize").oninput = function (e) { setCardW(e.target.value, true); };
    $("mmSize").onchange = function (e) { setCardW(e.target.value); };
    $("mmQ").oninput = function (e) { S.q = e.target.value; S.page = 0; paint(); };
    $("mmCat").onchange = function (e) { S.category = e.target.value; S.page = 0; paint(); };
    $("mmFam").onchange = function (e) { S.family = e.target.value; S.page = 0; paint(); };
    $("mmMType").onchange = function (e) { S.mtype = e.target.value; S.page = 0; paint(); };
    $("mmNsfw").checked = S.nsfw !== false;
    $("mmNsfw").onchange = function (e) { S.nsfw = e.target.checked; S.page = 0; lsSet(); paint(); };
    $("mmSort").onchange = function (e) { S.sort = e.target.value; lsSet(); paint(); };
    $("mmSort").value = S.sort;
    $("mmCvGo").onclick = function () { cvSearch(false); };
    $("mmCvQ").onkeydown = function (e) { e.stopPropagation(); if (e.key === "Enter") cvSearch(false); };
    $("mmQ").onkeydown = function (e) { e.stopPropagation(); };
    var grid = $("mmGrid");
    grid.addEventListener("click", function (e) {
      var kw = e.target.closest && e.target.closest("[data-kw]");
      if (kw) { e.stopPropagation(); var p = $("prompt"); if (p) { p.value = (p.value.trim() ? p.value.replace(/\s*$/, ", ") : "") + kw.dataset.kw; p.dispatchEvent(new Event("input", { bubbles: true })); say("“" + kw.dataset.kw + "” is in the prompt", "ok"); } return; }
      var card = e.target.closest && e.target.closest(".mmcard"); if (!card) return;
      if (e.target.closest("[data-mmgrip]")) return;
      if (e.target.closest("[data-mminfo]")) { openInfo(card.dataset.key); return; }
      if (e.target.closest("[data-mmedit]")) { editForm(card.dataset.key); return; }
      if (e.target.closest("[data-mmdel]")) { delModel(card.dataset.key); return; }       // 2.579.0
      if (e.target.closest("[data-mmlook]")) { lookup(card.dataset.key); return; }
      if (e.target.closest("[data-cvget]")) { cvQuick(card.dataset.key, e.shiftKey); return; }   // 2.538.0
      if (S.tab === "civitai") { S.cv.open = S.cv.items.find(function (x) { return x.key === card.dataset.key; }) || null; paint(); grid.scrollTop = 0; return; }
      pick(card.dataset.key);
    });
    grid.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("mmcard")) { e.preventDefault(); e.target.click(); }
      else if ((e.key === "i" || e.key === "I") && e.target.classList.contains("mmcard") && S.tab !== "civitai") { e.preventDefault(); openInfo(e.target.dataset.key); }
    });
    // 2.576.0 (Tim: "when user clicks on an image and presses ctrl+ the down arrow to make this the primary thumbnail for
    // the model"): on the info page, the picture last clicked (yours or a Civitai example) -> the card's thumbnail
    // (in the viewer itself static/tomodel.js does the same)
    document.addEventListener("keydown", function (e) {
      if (!S.info || !(e.ctrlKey || e.metaKey) || e.key !== "ArrowDown") return;
      if (document.getElementById("lb") && document.getElementById("lb").open) return;
      var a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
      var key = S.info, items = (S.media && S.media.items) || [];
      if (S.lastPick === "media" && items[S.mSel] && (items[S.mSel].kind === "image" || items[S.mSel].kind === "video")) { e.preventDefault(); setThumb(key, { item: items[S.mSel].id }); }
      else if (S.lastPick === "ex" && ((S.infoData || {}).examples || [])[S.exSel]) {
        e.preventDefault();
        jpost("/api/modelmgr/thumb", { key: key, example: S.exSel }).then(function (j) { if (j.error) { say(j.error, "bad"); return; } say("🖼 Civitai's example " + (S.exSel + 1) + " is the card's thumbnail now", "ok"); reloadKeep(key, false); });
      }
    });
    document.addEventListener("keydown", function (e) {     // Esc on the info page = ‹ Back (focus in the docker, or nowhere)
      if (e.key !== "Escape" || !S.info) return;
      var a = document.activeElement;
      if (a && a !== document.body && !body.contains(a)) return;
      e.stopPropagation(); closeInfo();
    }, true);
    grid.addEventListener("mouseover", function (e) { if (S.info || S.drag) return; var c = e.target.closest && e.target.closest(".mmcard"); if (c && c !== S.hoverEl) { S.hoverEl = c; showHover(c); } else if (c) clearTimeout(hoverT); });
    grid.addEventListener("mouseout", function (e) { var c = e.target.closest && e.target.closest(".mmcard"); if (c && !(e.relatedTarget && (c.contains(e.relatedTarget) || ($("mmHover") && $("mmHover").contains(e.relatedTarget))))) { S.hoverEl = null; hideSoon(); } });
    grid.addEventListener("scroll", hideHover);
    // ⇲ edit mode: a card's corner sizes every card (the columns refill the docker's width)
    grid.addEventListener("pointerdown", function (e) {
      var g = e.target.closest && e.target.closest("[data-mmgrip]"); if (!g || !S.edit) return;
      e.preventDefault(); e.stopPropagation(); hideHover();
      var card = g.closest(".mmcard"), r = card.getBoundingClientRect();
      S.drag = { x: e.clientX, w: r.width, id: e.pointerId };
      try { g.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
      var mv = function (ev) { if (!S.drag) return; setCardW(S.drag.w + (ev.clientX - S.drag.x), true); };
      var up = function () { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); S.drag = null; setCardW(S.cardW); };
      document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
    });
    if (root.ResizeObserver) new ResizeObserver(onResize).observe(grid);
  }
  /* ---- Settings -> General -> Civitai (config.civitai {token, site, mature}) */
  function cvFill() {
    jget("/api/config").then(function (c) {
      var cv = (c && c.civitai) || {};
      if ($("s_cvtok") && document.activeElement !== $("s_cvtok")) $("s_cvtok").value = cv.token || "";
      if ($("s_cvsite")) $("s_cvsite").value = cv.site === "civitai.com" ? "civitai.com" : "civitai.red";
      if ($("s_cvmature")) $("s_cvmature").checked = !!cv.mature;
    }).catch(function () { /* offline */ });
  }
  function cvSave() {
    var b = { civitai: { token: ($("s_cvtok").value || "").trim(), site: $("s_cvsite").value, mature: !!$("s_cvmature").checked } };
    try { if (typeof cfg !== "undefined" && cfg) cfg.civitai = b.civitai; } catch (e) { /* fine */ }
    return jpost("/api/config", b);
  }
  function cvSettings() {
    if (!$("s_cvtok")) return;
    var st = $("s_cvstatus"), t = null;
    $("s_cvtok").addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { cvSave(); st.textContent = "saved - Test key checks it"; }, 500); });
    $("s_cvshow").onchange = function (e) { $("s_cvtok").type = e.target.checked ? "text" : "password"; };
    $("s_cvsite").onchange = function () { cvSave(); };
    $("s_cvmature").onchange = function () { cvSave(); };
    $("s_cvtest").onclick = function () {
      st.textContent = "asking Civitai…";
      cvSave().then(function () { return jget("/api/civitai/test"); }).then(function (j) {
        st.textContent = j.ok ? "✓ the key works" + (j.user ? " - signed in as " + j.user : "") + " (" + j.site + ")" : "✗ " + (j.error || "not accepted");
        st.style.color = j.ok ? "#7c7" : "#e66";
      });
    };
    var os = $("openSettings"); if (os) os.addEventListener("click", function () { setTimeout(cvFill, 60); });
    cvFill();
  }
  function start() {
    if (!window.SecFloat || !SecFloat.add || !SecFloat.started || !$("tP")) { setTimeout(start, 150); return; }
    if ($("mmBody")) return;
    try { cvSettings(); } catch (e) { /* the settings dialog is optional */ }
    if (!$("mmCss")) { var st = document.createElement("style"); st.id = "mmCss"; st.textContent = CSS; document.head.appendChild(st); }
    var saved = lsGet();
    if (saved) { S.sel = saved.sel && Array.isArray(saved.sel.loras) ? saved.sel : S.sel; S.override = !!saved.override; S.mine = saved.mine || []; S.tab = saved.tab || S.tab; S.sort = saved.sort || S.sort;
      S.per = saved.per || "auto"; S.cardW = +saved.cardW || 138; S.folder = saved.folder || ""; S.nsfw = saved.nsfw !== false; }
    var body = build();
    var hv = document.createElement("div"); hv.id = "mmHover"; hv.setAttribute("role", "tooltip"); document.body.appendChild(hv);
    hv.addEventListener("mouseenter", function () { clearTimeout(hoverT); });
    hv.addEventListener("mouseleave", function () { hideSoon(); });
    hv.addEventListener("click", function () {
      var key = hv.dataset.key; if (!key) return;
      if (S.tab === "civitai") { S.cv.open = S.cv.items.find(function (x) { return x.key === key; }) || null; hideHover(); paint(); return; }
      openInfo(key);
    });
    var btn = document.createElement("button"); btn.type = "button"; btn.id = "mmBtn"; btn.textContent = "🧩 Models";
    btn.title = "Model manager - your models + LoRAs as cards, select them, a new style from one, Civitai downloads";
    var anchor = $("negBtn") || $("tP"); anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    SecFloat.add({ id: "modelmgr", title: "Model manager", w: 760, h: 640, body: body, button: btn,
      onShow: function () { if (!S.data) load(false); else paint(); if (S.tab === "used") loadUsed(); pollFetch(); } });
    wire(body);
    paint();
    if (S.override) setTimeout(function () { load(false).then(function () { if (S.override) apply(); }); }, 2500);
  }
  root.H3ModelMgr = Object.assign({ delModel: delModel, reloadKeep: function (key) { return reloadKeep(key, !!S.form); }, load: load, state: function () { return S; }, pick: pick, openInfo: openInfo, closeInfo: closeInfo, setCardW: setCardW, perPage: perPage, startFetch: startFetch, loadUsed: loadUsed, setOverride: setOverride, overriding: function () { return !!S.override; },
    show: function (on) { return window.SecFloat && SecFloat.show ? SecFloat.show("modelmgr", on) : false; }, apply: apply, search: cvSearch }, pure);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
