/* bitGen Studio — THE CHARACTER SWAP DIALOG (2.329.0).
 *
 * Tim (verbatim): "create a dialog for character swap, image placeholder on
 * the left, click opens select file dialog, in the middle is the video
 * preview, below the preview is the filmstrip and selector box, this one
 * will be able to do the entire movie in segments of max length which will
 * be an input in the video menubar, the video menubar will be above the
 * filmstrip but below the preview. Swap button in menubar, load video
 * button, start time, duration, automatic segment button (this will segment
 * to the max duration input on the menubar. the final video preview will be
 * on the right with save and retry and upscale buttons in it's menubar. add
 * a button in the video docker "Swap" to open the dialog" + "add the
 * finished segments to a vidTemp folder, user will be able to select
 * segments to join. allow user to start 1 segment at a time or all
 * segments, the segments to keep will be put in vidSwap folder, add a
 * compile button to the right menubar".
 *
 *   LEFT    the new character: click = the file dialog (the upload shim ->
 *           static/filedialog.js), or drop a picture / an Image asset;
 *           optional direction text (the swap template always rides)
 *   MIDDLE  the preview (plays the BOX only, looping) · the video menubar:
 *           📂 Load video · Start · Duration · Max · ✂ Auto segment ·
 *           ⇄ Swap (the box) · ⇄ Swap all · the filmstrip + box + the
 *           segment bands · the segment chips (click = box on it, ▶ = swap
 *           that one, ✕ = drop it from the plan)
 *   RIGHT   the result preview · 💾 Save (a copy to Video assets) · ↻ Retry
 *           (same window, new seed) · ⏫ Upscale (same seed + the ⚙
 *           upscaler) · 🎬 Compile (the ticked kept segments, in time
 *           order) · Finished (vidTemp: ▶ ✓ Keep 🗑) · Kept (vidSwap:
 *           ☑ to join, ▶, ↩ back)
 * Server: routes/swapdlg.js + lib/swapSession.js; every segment is a mode
 * "swap" job through the swap style (mmh3_chr_swap unless a swap style is
 * picked in the prompt bar).
 *
 * window.SwapDialog = {
 *   install(ctx)  ctx = { size() -> {width, height}, styleId(), drag(),
 *                 refVideo() (the reference dock's first video), note(msg),
 *                 refreshAssets() }
 *   open() / close()
 *   snapDown(n) · boxFrames(dur) · fmt(s)   (pure, tested)
 *   state()
 * }                                                                        */
(function () {
  "use strict";
  var FPS = 24, THUMB_H = 50, CHUNK = 12;
  var ctx = { size: function () { return {}; }, styleId: function () { return ""; }, drag: function () { return null; },
              refVideo: function () { return ""; }, note: function () {}, refreshAssets: function () {} };
  var cur = null;           // the open dialog

  function snapDown(n) { n = Math.floor(+n || 0); return n < 5 ? 0 : 5 + 17 * Math.floor((n - 5) / 17); }
  function boxFrames(dur) { return snapDown(Math.round((+dur || 0) * FPS)); }
  function fmt(s) {
    s = Math.max(0, +s || 0);
    var m = Math.floor(s / 60), r = s - m * 60;
    return m + ":" + (r < 10 ? "0" : "") + r.toFixed(2);
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function jpost(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); });
  }

  var CSS = ""
    + "dialog.swdlg{width:96vw;max-width:96vw;height:92vh;max-height:92vh;padding:0;display:flex;flex-direction:column;overflow:hidden}"
    + "dialog.swdlg:not([open]){display:none}"
    + ".swdlg .swHead{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line,#333)}"
    + ".swdlg .swHead h2{margin:0;font-size:.9rem;flex:1}"
    + ".swdlg .swGrid{flex:1;min-height:0;display:grid;grid-template-columns:220px minmax(0,1fr) 380px;gap:10px;padding:10px}"
    + ".swdlg .swCol{min-width:0;min-height:0;display:flex;flex-direction:column;gap:6px}"
    + ".swdlg .swRight{overflow-y:auto}"
    + ".swdlg .swLbl{font-family:var(--disp);font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--tiger,#f59e2c)}"
    + ".swdlg .swPic{aspect-ratio:3/4;border:2px dashed var(--line,#444);border-radius:8px;display:flex;align-items:center;"
    + "justify-content:center;text-align:center;color:var(--dim,#999);font-size:.75rem;cursor:pointer;overflow:hidden;background:var(--panel-2,#222)}"
    + ".swdlg .swPic:hover,.swdlg .swPic.hot{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
    + ".swdlg .swPic img{width:100%;height:100%;object-fit:contain;display:block}"
    + ".swdlg .swPrev,.swdlg .swOut{width:100%;background:#000;border-radius:6px;display:block;min-height:120px}"
    + ".swdlg .swPrevWrap{position:relative;flex:1;min-height:0;display:flex}"
    + ".swdlg .swPrev{flex:1;min-height:0;width:100%;height:100%;object-fit:contain}"
    // 2.347.0: a generated picture / video shown in the big preview
    + ".swdlg .swPrevImg{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;border-radius:6px}"
    + ".swdlg .swPrevBack{position:absolute;top:6px;left:6px;z-index:2;background:rgba(0,0,0,.72);color:#fff;border:1px solid var(--tiger,#f59e2c);border-radius:5px;padding:2px 8px;font-size:.72rem;cursor:pointer;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".swdlg .swFFCard img.ffMain,.swdlg .swRow .nm{cursor:zoom-in}"
    + ".swdlg .swAimLayer{position:absolute;left:0;top:0;right:0;bottom:44px;cursor:crosshair;display:none}"
    + ".swdlg.vr .swAimLayer{display:block}"
    + ".swdlg .swAimBox{position:absolute;border:2px solid var(--tiger,#f59e2c);box-shadow:0 0 0 1px #000;pointer-events:none;border-radius:3px}"
    + ".swdlg .swAimDot{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:var(--tiger,#f59e2c);box-shadow:0 0 0 2px #000;pointer-events:none}"
    + ".swdlg .swVrBar{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;font-size:.74rem;padding:0 0 4px}"
    + ".swdlg .swVrBar input[type=number]{width:64px}"
    + ".swdlg .swVrBar .vrOnly{display:none}.swdlg.vr .swVrBar .vrOnly{display:inline-flex;align-items:center;gap:4px}"
    + ".swdlg .swVrView{display:none;width:100%;border-radius:6px;background:#000;border:1px solid var(--line,#444)}"
    + ".swdlg.vr .swVrView{display:block}"
    + ".swdlg .swVrLbl{display:none}.swdlg.vr .swVrLbl{display:block}"
    + ".swdlg .swWrite{margin-top:4px;align-self:flex-start}"
    + ".swdlg .swOut{max-height:34vh}"
    + ".swdlg .swBar{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;font-size:.74rem;padding:4px 0}"
    + ".swdlg .swBar input[type=number]{width:74px}"
    + ".swdlg .swBar .gbtn{padding:2px 8px}"
    + ".swdlg .swF{font-family:var(--mono,monospace);color:var(--dim,#999);font-size:.68rem}"
    + ".swdlg .swView{position:relative;overflow-x:auto;overflow-y:hidden;border:1px solid var(--line,#444);border-radius:6px;"
    + "background:var(--panel-2,#222);height:" + (THUMB_H + 38) + "px;cursor:crosshair;flex:none}"
    + ".swdlg .swTrack{position:relative;height:100%}"
    + ".swdlg .swRuler{position:absolute;left:0;top:0;height:14px;width:100%;font:10px var(--mono,monospace);color:var(--dim,#999)}"
    + ".swdlg .swTick{position:absolute;top:0;height:14px;border-left:1px solid var(--line,#555);padding-left:2px;white-space:nowrap}"
    + ".swdlg .swThumbs{position:absolute;left:0;top:16px;height:" + THUMB_H + "px;width:100%}"
    + ".swdlg .swThumbs img{position:absolute;top:0;height:" + THUMB_H + "px;object-fit:cover;border-right:1px solid rgba(0,0,0,.5);pointer-events:none}"
    + ".swdlg .swSegs{position:absolute;left:0;top:" + (THUMB_H + 18) + "px;height:16px;width:100%}"
    + ".swdlg .swSeg{position:absolute;top:0;height:14px;box-sizing:border-box;border:1px solid #555;border-radius:3px;background:#2a2f3a;"
    + "font:9px var(--mono,monospace);color:#ccc;padding-left:3px;overflow:hidden;white-space:nowrap;cursor:pointer}"
    + ".swdlg .swSeg.queued{background:#3a3f4c}.swdlg .swSeg.running{background:#6b4a14;border-color:var(--tiger,#f59e2c)}"
    + ".swdlg .swSeg.done{background:#1d4d2e;border-color:#3fa45f}.swdlg .swSeg.failed{background:#5a1f1f;border-color:#c44}"
    + ".swdlg .swBox{position:absolute;top:14px;height:" + (THUMB_H + 4) + "px;box-sizing:border-box;border:2px solid var(--tiger,#f59e2c);"
    + "background:rgba(245,158,44,.14);border-radius:4px;cursor:grab;z-index:2;touch-action:none}"
    + ".swdlg .swBox.drag{cursor:grabbing}"
    + ".swdlg .swBoxLbl{position:absolute;left:3px;bottom:2px;font:10px var(--mono,monospace);color:#fff;text-shadow:0 1px 2px #000;white-space:nowrap;pointer-events:none}"
    + ".swdlg .swHeadLine{position:absolute;top:12px;width:2px;height:" + (THUMB_H + 8) + "px;background:#fff;z-index:3;pointer-events:none}"
    + ".swdlg .swChips{display:flex;flex-wrap:wrap;gap:4px;max-height:84px;overflow-y:auto}"
    + ".swdlg .swChip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line,#444);border-radius:12px;padding:1px 4px 1px 8px;"
    + "font:11px var(--mono,monospace);cursor:pointer;background:var(--panel-2,#222)}"
    + ".swdlg .swChip.sel{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
    + ".swdlg .swChip button{background:none;border:0;color:var(--dim,#999);cursor:pointer;padding:0 3px}"
    + ".swdlg .swChip button:hover{color:var(--tiger,#f59e2c)}"
    // 2.342.0: the ⚙ settings dialog
    + "dialog.swSetDlg{width:min(460px,94vw);padding:0}dialog.swSetDlg:not([open]){display:none}"
    + ".swSetDlg .sh{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line,#333)}.swSetDlg .sh h3{margin:0;font-size:.9rem;flex:1}"
    + ".swSetDlg .sb{padding:10px 12px;display:flex;flex-direction:column;gap:8px;font-size:.8rem}"
    + ".swSetDlg .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.swSetDlg .row label{min-width:92px}"
    + ".swSetDlg input[type=number]{width:6.5em}.swSetDlg .note{color:var(--dim,#999);font-size:.72rem}"
    + ".swSetDlg .sf{display:flex;gap:8px;justify-content:flex-end;padding:8px 12px;border-top:1px solid var(--line,#333)}"
    // 2.339.0: LTX Ripple's ✎ first frames, one card per segment
    + ".swdlg .swFF{display:flex;gap:6px;overflow-x:auto;min-height:0;padding-bottom:2px}"
    + ".swdlg .swFF[hidden]{display:none}"
    + ".swdlg .swFFCard{flex:0 0 auto;width:132px;border:1px solid var(--line,#444);border-radius:6px;padding:3px;font-size:.72rem;display:flex;flex-direction:column;gap:2px}"
    + ".swdlg .swFFCard img{width:100%;height:74px;object-fit:contain;background:#000;border-radius:4px}"
    + ".swdlg .swFFCard .ph{height:74px;display:flex;align-items:center;justify-content:center;background:#111;border-radius:4px;color:var(--dim,#999);text-align:center;padding:2px}"
    + ".swdlg .swFFCard.bad .ph{color:#e66}"
    + ".swdlg .swFFCard .acts{display:flex;justify-content:space-between}"
    // 2.348.0: the candidates - click = use it, double-click = see it big
    + ".swdlg .swFFCard .ffcs{display:flex;flex-wrap:wrap;gap:2px}"
    + ".swdlg .swFFCard .ffc{width:28px;height:20px;object-fit:cover;border:2px solid transparent;border-radius:3px;cursor:pointer;background:#000}"
    + ".swdlg .swFFCard .ffc.on{border-color:var(--tiger,#f59e2c)}"
    + ".swdlg .swFFCard button{background:none;border:0;color:var(--dim,#999);cursor:pointer;padding:0 2px}"
    + ".swdlg .swFFCard button:hover{color:var(--tiger,#f59e2c)}"
    + ".swdlg .swDot{width:8px;height:8px;border-radius:50%;background:#555;flex:none}"
    + ".swdlg .swDot.queued{background:#8a8f9c}.swdlg .swDot.running{background:var(--tiger,#f59e2c)}"
    + ".swdlg .swDot.done{background:#3fa45f}.swdlg .swDot.failed,.swdlg .swDot.lost,.swdlg .swDot.cancelled{background:#c44}"
    + ".swdlg .swList{display:flex;flex-direction:column;gap:3px;font-size:.72rem}"
    + ".swdlg .swRow{display:flex;align-items:center;gap:6px;border:1px solid var(--line,#333);border-radius:5px;padding:3px 6px;background:var(--panel-2,#222)}"
    + ".swdlg .swRow.cur{border-color:var(--tiger,#f59e2c)}"
    + ".swdlg .swRow .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono,monospace);font-size:.66rem}"
    + ".swdlg .swRow button{padding:0 5px}"
    + ".swdlg .swMsg{font-size:.72rem;color:var(--dim,#999);min-height:1.2em}"
    + ".swdlg .swMsg.bad{color:#ff8b6b}";

  function injectCss() {
    if (document.getElementById("swdlgCss")) return;
    var s = el("style"); s.id = "swdlgCss"; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function build() {
    injectCss();
    var dlg = el("dialog", "swdlg");
    dlg.setAttribute("aria-label", "Character swap");
    dlg.innerHTML =
      '<div class="swHead"><h2>⇄ Character swap</h2><span class="swF swStyle"></span>'
      + '<button type="button" class="ghost gbtn swClose" title="Close (the renders keep going in the queue)">✕</button></div>'
      + '<div class="swGrid">'
      // LEFT
      + '<div class="swCol swLeft"><div class="swLbl">New character</div>'
      + '<div class="swPic" tabindex="0" role="button" title="Click to choose the picture of the new character - or drop a picture / an Image asset here">＋<br>Click to choose<br>the new character</div>'
      + '<input type="file" class="swPicIn" accept="image/png,image/jpeg,image/webp,image/bmp" hidden>'
      + '<div class="swLbl swVrLbl" style="margin-top:6px">What the swap sees (VR)</div>'
      + '<img class="swVrView" alt="The virtual camera\'s view of the left eye" title="The part of the VR frame the swap renders - click the preview to aim it">'
      + '<label class="swLbl" style="margin-top:6px">Prompt / direction (optional)</label>'
      + '<textarea class="swText" rows="8" spellcheck="false" placeholder="Extra direction - the swap instructions always ride. Or ✎ Write prompt: a whole swap prompt (it names &lt;Video 1&gt; and &lt;Picture 1&gt;) replaces them"></textarea>'
      + '<button type="button" class="ghost gbtn swWrite" title="The vision model describes the new character and the video at the box, the LLM writes the swap prompt into this box (your words here ride along as wishes). Takes a minute - two models load in turn">✎ Write prompt</button>'
      + '<div class="hint">Every segment renders as its own job in the queue; you can close this dialog while they run.</div></div>'
      // MIDDLE
      + '<div class="swCol swMid"><div class="swPrevWrap"><video class="swPrev" playsinline controls preload="auto"></video>'
      + '<img class="swPrevImg" alt="" hidden><button type="button" class="swPrevBack" hidden title="Back to the video you are swapping (Esc)"></button>'
      + '<div class="swAimLayer" title="VR: click on the person to aim the virtual camera"><div class="swAimBox"></div><div class="swAimDot"></div></div></div>'
      + '<div class="swBar">'
      + '<button type="button" class="ghost gbtn swLoad" title="Load the video to swap (the file dialog) - or drop a Video asset on the preview">📂 Load video</button>'
      + '<button type="button" class="ghost gbtn swSet" title="Settings - video size, duration, steps, LoRAs, seed" aria-label="Swap settings">⚙</button>'
      + '<input type="file" class="swVidIn" accept="video/*" hidden>'
      + '<span class="swF swVName"></span>'
      + '<label>Start <input type="number" class="swStart" min="0" step="0.04"> s</label>'
      + '<label>Duration <input type="number" class="swDur" min="0.25" step="0.04"> s</label>'
      + '<span class="swF swBoxF"></span>'
      + '<label title="The longest segment - ✂ Auto segment cuts the whole movie into pieces of this length (at most one H3 run). 5 s is the default: the new character holds best on 4-5 s shots, longer runs can drift back to the original performer">Max <input type="number" class="swMax" min="1" step="0.5"> s</label>'
      + '<label title="MiniMax H3 = the swap LoRA through H3, one job per segment. Viggle (H3) = the same ✎ first frame, carried through the clip by Viggle-Animate on MiniMax H3 (3 steps). Viggle (native) = the same model in bitGen\'s own engine - no ComfyUI, the weights streamed to the GPU (⚙ to install it). LTX Ripple = ✎ Qwen Image 2.1 puts the character into each segment\'s first frame (check it, touch it up), then the LTX Ripple IC-LoRA carries that edit through the original clip">Engine <select class="swEng"><option value="h3">MiniMax H3</option><option value="ripple">LTX Ripple</option><option value="viggle">Viggle (H3)</option><option value="viggle_native">Viggle (native)</option></select></label>'
      + '<button type="button" class="ghost gbtn swFFAll" hidden title="LTX Ripple / Viggle: make another first frame (✎×N) for the segment in the box - the box becomes a segment if it is not one yet (Qwen Image 2.1)">✎ First frames</button>'
      // 2.348.0: how many candidates each ✎ makes
      + '<select class="swFFN" hidden title="How many ✎ first-frame candidates each press makes - click one on its card to use it, double-click to see it big"><option value="1">✎×1</option><option value="2">✎×2</option><option value="3">✎×3</option><option value="4">✎×4</option></select>'
      + '<label class="swQualL" title="Fast = the turbo LoRA at 4 steps (quickest, weakest swap). Full = no turbo, 20 steps (ComfyUI\'s own H3 reference settings). Best = no turbo, 28 steps (how the H3 Character Swap LoRA was tested). Full / Best take about 5-7x longer than Fast">Quality <select class="swQual"><option value="fast">Fast (turbo, 4 steps)</option><option value="full">Full (20 steps)</option><option value="best">Best (28 steps)</option></select></label>'
      + '<button type="button" class="ghost gbtn swAuto" title="Cut the WHOLE video into back-to-back segments of the Max length">✂ Auto segment</button>'
      + '<button type="button" class="gbtn swGo" title="Swap the character in the box">⇄ Swap</button>'
      + '<button type="button" class="ghost gbtn swAll" title="Queue every segment that has no finished or waiting result">⇄ Swap all</button>'
      + '<span style="margin-left:auto;display:inline-flex;gap:4px">'
      + '<button type="button" class="ghost gbtn swOutZ" title="Zoom out">−</button>'
      + '<button type="button" class="ghost gbtn swInZ" title="Zoom in">+</button>'
      + '<button type="button" class="ghost gbtn swFit" title="The whole video in view">Fit</button></span></div>'
      + '<div class="swVrBar">'
      + '<label title="VR video: the swap renders a virtual camera aimed at the person, never the whole sphere; stereo builds the other eye from the original depth">VR '
      + '<select class="swVrMode"><option value="off">Off (flat video)</option><option value="mono360">360° mono</option>'
      + '<option value="tb360">360° stereo (top-bottom)</option><option value="sbs180">180° stereo (side by side)</option></select></label>'
      + '<span class="vrOnly"><label title="Where the virtual camera looks - left / right, degrees (click the preview to aim)">Yaw <input type="number" class="swYaw" min="-180" max="180" step="1"></label>'
      + '<label title="Up / down, degrees">Pitch <input type="number" class="swPitch" min="-85" max="85" step="1"></label>'
      + '<label title="How wide the view is, degrees - frame the person with a little room; narrower = sharper">View <input type="number" class="swFov" min="20" max="140" step="5">°</label>'
      + '<label title="The view\'s shape (a standing person: 3:4 or 9:16)">Shape <select class="swShape"><option>1:1</option><option>3:4</option><option>9:16</option><option>4:3</option><option>16:9</option></select></label>'
      + '<button type="button" class="ghost gbtn swVrLook" title="Show what the swap will see at the preview\'s current time">👁 View</button></span>'
      + '<span class="swF swVrHint"></span></div>'
      + '<div class="swView"><div class="swTrack"><div class="swRuler"></div><div class="swThumbs"></div><div class="swSegs"></div>'
      + '<div class="swBox" tabindex="0" role="slider" aria-label="The window to swap"><span class="swBoxLbl"></span></div>'
      + '<div class="swHeadLine"></div></div></div>'
      + '<div class="swChips" aria-label="Segments"></div>'
      + '<div class="swFF" hidden aria-label="LTX Ripple first frames"></div>'
      + '<input type="file" class="swFFIn" accept="image/*" hidden>'
      + '<div class="swMsg"></div></div>'
      // RIGHT
      + '<div class="swCol swRight"><div class="swLbl">Result</div>'
      + '<video class="swOut" playsinline controls preload="metadata"></video>'
      + '<div class="swBar">'
      + '<button type="button" class="ghost gbtn swSave" title="Save a copy of the previewed segment to the project\'s Video assets">💾 Save</button>'
      + '<button type="button" class="ghost gbtn swRetry" title="Render the previewed segment again with a new seed">↻ Retry</button>'
      + '<button type="button" class="ghost gbtn swUp" title="Upscale the previewed segment - the same window and seed with the StoryBoard ⚙ upscaler">⏫ Upscale</button>'
      + '<button type="button" class="gbtn swCompile" title="Join the ticked KEPT segments (vidSwap), in time order, into one video in the Video assets">🎬 Compile</button>'
      + '</div><div class="swF swOutName"></div>'
      + '<div class="swLbl">Finished · vidTemp</div><div class="swList swTempL"></div>'
      + '<div class="swLbl">Kept · vidSwap <span class="swF">(☑ = joined by Compile)</span></div><div class="swList swKeepL"></div>'
      + '</div></div>';
    document.body.appendChild(dlg);
    var q = function (c) { return dlg.querySelector("." + c); };
    var c = { dlg: dlg, q: q, st: null, info: null, pps: 1, sel: { start: 0, dur: 15 }, chunks: {}, stepKey: "",
              out: null, compileSel: {}, poll: 0, segSel: "" };
    cur = c;
    wire(c);
    return c;
  }

  // ------------------------------------------------------------ state
  function msg(t, bad) {
    if (!cur) return;
    var m = cur.q("swMsg");
    m.textContent = t || ""; m.classList.toggle("bad", !!bad);
    if (t && ctx.note) try { ctx.note(t); } catch (e) {}
  }
  /* 2.343.0: what changed since the last look that the user must hear about -
     a segment render that FAILED (with the worker's reason), a first frame
     that failed, a render that started on its own after its first frame. */
  /* 2.344.0: the engines that start from a ✎ first frame (lib/rippleSwap FIRST_FRAME_ENGINES) */
  var FF_ENGINES = { ripple: "LTX Ripple", viggle: "Viggle", viggle_native: "Viggle (native)" };   // 2.351.0: + our own engine
  function failNews(a, b) {
    if (!a || !a.results || !b || !b.results) return "";
    var segNo = function (id) { var i = (b.segments || []).findIndex(function (g) { return g.id === id; }); return i >= 0 ? "#" + (i + 1) : "a segment"; };
    var was = {}; a.results.forEach(function (r) { was[r.id] = r.status; });
    var ffWas = {}; (a.segments || []).forEach(function (g) { ffWas[g.id] = (g.ff || {}).status; });
    var out = [];
    b.results.forEach(function (r) {
      if (r.status === "failed" && was[r.id] && was[r.id] !== "failed") out.push("⚠ " + segNo(r.seg) + " " + (r.error || "the render failed"));
      // 2.350.0: a black take that safe mode rescued
      else if (r.status === "done" && r.safe && was[r.id] && was[r.id] !== "done")
        out.push("🛟 " + segNo(r.seg) + " came back black - safe mode rendered it; ⚙ Viggle safe mode is on now");
      else if (!was[r.id] && FF_ENGINES[r.engine] && ffWas[r.seg] === "running" && (r.status === "queued" || r.status === "running"))
        out.push("▶ " + segNo(r.seg) + " has its first frame - rendering with " + FF_ENGINES[r.engine]);
    });
    (b.segments || []).forEach(function (g) {
      var ff = g.ff || {};
      if (ff.status === "failed" && ffWas[g.id] === "running") out.push("⚠ " + segNo(g.id) + " first frame: " + (ff.error || "failed"));
      else if (ff.error && /^▶ could not start/.test(ff.error) && ffWas[g.id] === "running") out.push("⚠ " + segNo(g.id) + " " + ff.error);
    });
    return out.join(" · ");
  }
  function apply(st) {
    if (!cur || !st) return st;
    if (st.error) { msg("⚠ " + st.error, true); }
    if (!st.results) return st;
    var prevVideo = cur.st && cur.st.video;
    var said = failNews(cur.st, st);                                            // 2.343.0
    cur.st = st;
    if (said) msg(said, /⚠/.test(said));
    paintLeft(); paintRight(); paintChips(); paintSegs(); paintVr();
    var max = cur.q("swMax");
    if (document.activeElement !== max) max.value = (st.max || st.best_seconds || st.max_seconds || 15).toFixed(2);
    max.max = String(st.max_seconds || 15.08);
    var ql = cur.q("swQual");
    if (ql && document.activeElement !== ql) ql.value = st.quality || "full";
    var en = cur.q("swEng"), rip = !!FF_ENGINES[st.engine];                     // 2.339.0 (2.344.0: + Viggle)
    if (en && document.activeElement !== en) en.value = st.engine || "h3";
    cur.q("swQualL").hidden = rip;
    cur.q("swFFAll").hidden = !rip;
    cur.q("swFFN").hidden = !rip;
    cur.q("swUp").hidden = rip;
    paintFF();
    if (st.video !== prevVideo) loadVideo(st.video);
    schedule();
    return st;
  }
  function refresh() { return fetch("/api/swapdlg").then(function (r) { return r.json(); }).then(apply).catch(function () {}); }
  function schedule() {
    if (!cur) return;
    clearTimeout(cur.poll);
    var busy = (cur.st.results || []).some(function (r) { return r.status === "queued" || r.status === "running"; })
      || (cur.st.segments || []).some(function (g) { return g.ff && g.ff.status === "running"; });
    if (busy && cur.dlg.open) cur.poll = setTimeout(refresh, 2500);
  }

  // ------------------------------------------------------------ left
  function paintLeft() {
    var st = cur.st, pic = cur.q("swPic");
    pic.innerHTML = st.picture ? '<img alt="The new character" src="' + st.picture_url + "&t=" + Date.now() + '">'
      : "＋<br>Click to choose<br>the new character";
    var t = cur.q("swText");
    if (document.activeElement !== t) t.value = st.text || "";
    var sid = ctx.styleId ? ctx.styleId() : "";
    cur.q("swStyle").textContent = "style: " + (sid && ctx.styleName ? ctx.styleName(sid) || "mmh3_chr_swap" : "mmh3_chr_swap");
  }
  function sendPicture(file) {
    var fd = new FormData(); fd.append("image", file, file.name);
    msg("uploading the picture…");
    return fetch("/api/swapdlg/picture", { method: "POST", body: fd }).then(function (r) { return r.json(); })
      .then(function (j) { if (!j.error) msg("the new character: " + file.name); return apply(j); });
  }

  // ------------------------------------------------------------ middle
  /** A movie the player cannot decode (H.265 / 8K VR in some builds): a
   *  small H.264 PREVIEW copy is made on the server (the swap still reads
   *  the original). */
  function proxyFor(name) {
    var c = cur;
    if (!c || c.proxying === name) return;
    c.proxying = name;
    msg("this player cannot show " + name + " - making a small preview copy (the swap uses the original)…");
    function poll() {
      if (cur !== c || !c.st || c.st.video !== name) return;
      fetch("/api/swapdlg/proxy?name=" + encodeURIComponent(name)).then(function (r) { return r.json(); }).then(function (j) {
        if (j.status === "ready") { c.q("swPrev").src = j.url; msg("preview copy ready"); return; }
        if (j.status === "failed") { msg("⚠ the preview copy failed - the filmstrip still shows the frames", true); return; }
        setTimeout(poll, 3000);
      }).catch(function () { setTimeout(poll, 5000); });
    }
    jpost("/api/swapdlg/proxy", { name: name }).then(function (j) { if (j.error) msg("⚠ " + j.error, true); else poll(); });
  }
  function loadVideo(name) {
    if (cur.view) backToVideo(true);
    var v = cur.q("swPrev");
    cur.info = null; cur.chunks = {}; cur.proxying = "";
    cur.q("swThumbs").innerHTML = "";
    cur.q("swVName").textContent = name || "no video loaded";
    if (!name) { v.removeAttribute("src"); try { v.load(); } catch (e) {} return Promise.resolve(null); }
    v.src = "/passets/video/" + encodeURIComponent(name);
    return fetch("/api/swapdlg/info?name=" + encodeURIComponent(name)).then(function (r) { return r.json(); })
      .then(function (info) {
        if (!cur || info.error) { if (info && info.error) msg("⚠ " + info.error, true); return null; }
        cur.info = info;
        cur.thumbW = Math.max(40, Math.round(THUMB_H * (info.width > 0 && info.height > 0 ? info.width / info.height : 16 / 9)));
        var mx = +(cur.st.max || cur.st.best_seconds || cur.st.max_seconds || 15);
        setSel(cur.sel.start || 0, Math.min(info.duration, mx));
        setZoom(zr().min, 0, 0);
        return info;
      });
  }
  function viewW() { return cur.q("swView").clientWidth || 600; }
  function dur() { return cur.info ? cur.info.duration : 1; }
  function zr() {
    var fit = Math.max(1e-3, viewW() / Math.max(1 / FPS, dur()));
    return { min: fit, max: Math.max(fit, FPS * (cur.thumbW || 80)) };
  }
  function clampSel(start, d) {
    var total = dur(), mx = +(cur.st && (cur.st.max_seconds || 15.08)) || 15.08;
    d = Math.max(5 / FPS, Math.min(+d || mx, mx, total));
    start = Math.max(0, Math.min(+start || 0, total - d));
    return { start: Math.round(start * FPS) / FPS, dur: Math.round(d * FPS) / FPS };
  }
  function setSel(start, d, seek) {
    if (cur.view && seek !== false) backToVideo();           // 2.347.0: the box is the source video again
    cur.sel = clampSel(start, d);
    var s = cur.sel, box = cur.q("swBox");
    box.style.left = (s.start * cur.pps) + "px";
    box.style.width = Math.max(4, s.dur * cur.pps) + "px";
    var n = boxFrames(s.dur);
    cur.q("swBoxLbl").textContent = fmt(s.start) + " – " + fmt(s.start + s.dur);
    if (document.activeElement !== cur.q("swStart")) cur.q("swStart").value = s.start.toFixed(2);
    if (document.activeElement !== cur.q("swDur")) cur.q("swDur").value = s.dur.toFixed(2);
    cur.q("swBoxF").textContent = "→ " + n + " frames" + (n / FPS < s.dur - 1e-6 ? " (" + (n / FPS).toFixed(2) + "s on H3's grid)" : "");
    if (seek !== false) { try { cur.q("swPrev").currentTime = s.start; } catch (e) {} }
    paintChips();
  }
  function setZoom(pps, anchorT, anchorX) {
    var z = zr();
    cur.pps = Math.max(z.min, Math.min(z.max, pps));
    cur.q("swTrack").style.width = Math.max(viewW(), Math.ceil(dur() * cur.pps)) + "px";
    cur.q("swThumbs").innerHTML = ""; cur.chunks = {};
    var raw = Math.max(1 / FPS, (cur.thumbW || 80) / cur.pps);
    cur.stepKey = String(Math.max(1, Math.round(raw * FPS)) / FPS);
    paintRuler(); setSel(cur.sel.start, cur.sel.dur, false); paintSegs();
    if (anchorT != null) cur.q("swView").scrollLeft = Math.max(0, anchorT * cur.pps - (anchorX || viewW() / 2));
    loadThumbs();
  }
  function paintRuler() {
    var ruler = cur.q("swRuler"); ruler.innerHTML = "";
    var every = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find(function (x) { return x * cur.pps >= 70; }) || 600;
    for (var t = 0; t <= dur() + 1e-9; t += every) {
      var k = el("div", "swTick"); k.style.left = (t * cur.pps) + "px"; k.textContent = fmt(t); ruler.appendChild(k);
    }
  }
  var thumbTimer = 0;
  function loadThumbs() { clearTimeout(thumbTimer); thumbTimer = setTimeout(loadNow, 80); }
  function loadNow() {
    if (!cur || !cur.info) return;
    var step = +cur.stepKey, span = step * CHUNK, view = cur.q("swView");
    var a = view.scrollLeft / cur.pps, b = (view.scrollLeft + viewW()) / cur.pps;
    for (var k = Math.max(0, Math.floor(a / span)); k <= Math.floor(Math.min(dur(), b) / span); k++) loadChunk(k, step, span);
  }
  function loadChunk(k, step, span) {
    var c = cur, key = c.stepKey + ":" + k;
    if (c.chunks[key]) return;
    c.chunks[key] = 1;
    var st = k * span, en = Math.min(dur(), st + span);
    if (en <= st) return;
    var url = "/api/frames?src=video&name=" + encodeURIComponent(c.info.name) + "&start=" + st.toFixed(4)
      + "&end=" + en.toFixed(4) + "&fps=" + Math.min(60, Math.max(0.01, 1 / step)).toFixed(4) + "&width=" + Math.min(320, c.thumbW * 2);
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      if (cur !== c || String(step) !== c.stepKey || !d || !d.frames) return;
      for (var j = 0; j < CHUNK; j++) {
        var t = st + j * step;
        if (t >= en - 1e-9) break;
        var best = null;
        d.frames.forEach(function (f) { if (!best || Math.abs(f.t - t) < Math.abs(best.t - t)) best = f; });
        if (!best) continue;
        var im = el("img"); im.alt = ""; im.draggable = false; im.loading = "lazy";
        im.src = "/framecache/" + d.key + "/" + best.file;
        im.style.left = (t * c.pps) + "px"; im.style.width = Math.max(2, step * c.pps) + "px";
        c.q("swThumbs").appendChild(im);
      }
    }).catch(function () { c.chunks[key] = 0; });
  }
  /** A segment's state: its newest result's status (done wins over an older failure). */
  function segStatus(id) {
    var rs = (cur.st.results || []).filter(function (r) { return r.seg === id; });
    if (rs.some(function (r) { return r.status === "running"; })) return "running";
    if (rs.some(function (r) { return r.status === "queued"; })) return "queued";
    if (rs.some(function (r) { return r.status === "done"; })) return "done";
    return rs.length ? rs[rs.length - 1].status : "";
  }
  function paintSegs() {
    if (!cur || !cur.st) return;
    var lay = cur.q("swSegs"); lay.innerHTML = "";
    (cur.st.segments || []).forEach(function (g, i) {
      var b = el("div", "swSeg " + segStatus(g.id));
      b.style.left = (g.start * cur.pps) + "px"; b.style.width = Math.max(3, g.dur * cur.pps - 1) + "px";
      b.textContent = "#" + (i + 1); b.title = "#" + (i + 1) + " " + fmt(g.start) + " – " + fmt(g.start + g.dur) + " " + (segStatus(g.id) || "not swapped yet");
      b.dataset.seg = g.id;
      lay.appendChild(b);
    });
  }
  function paintChips() {
    if (!cur || !cur.st) return;
    var box = cur.q("swChips"); box.innerHTML = "";
    (cur.st.segments || []).forEach(function (g, i) {
      var on = Math.abs(g.start - cur.sel.start) < 0.5 / FPS && Math.abs(g.dur - cur.sel.dur) < 0.5 / FPS;
      var ch = el("span", "swChip" + (on ? " sel" : ""));
      ch.dataset.seg = g.id;
      ch.innerHTML = '<span class="swDot ' + segStatus(g.id) + '"></span>#' + (i + 1) + " " + fmt(g.start) + "–" + fmt(g.start + g.dur)
        + '<button type="button" data-act="run" title="Swap this segment">▶</button>'
        + '<button type="button" data-act="rm" title="Drop it from the plan (its results stay)">✕</button>';
      box.appendChild(ch);
    });
    if (!(cur.st.segments || []).length) box.innerHTML = '<span class="hint">No segments yet - ⇄ Swap the box, or ✂ Auto segment the whole video.</span>';
  }

  // ------------------------------------------------------------ ⚙ settings (2.342.0)
  /* Tim: "maybe have a settings (icon only button) in the menubar with load
     video in character swap ... in the settings dialog, show video settings,
     video size (get from video), duration, steps, add lora button (like our
     other add lora inputs), seed (random or fixed)". Size + duration + seed
     apply to both engines; steps, the Ripple strength and the LoRAs to LTX
     Ripple (H3's steps are its Quality). */
  function setDlg() {
    if (cur.setDlg) return cur.setDlg;
    var d = el("dialog", "swSetDlg");
    d.innerHTML = '<div class="sh"><h3>⚙ Swap settings</h3><button type="button" class="ghost ssX" title="Close">✕</button></div>'
      + '<div class="sb">'
      + '<div class="row"><label>Video size</label><label style="min-width:0"><input type="checkbox" class="ssAuto"> from the video</label>'
      + '<span class="note ssFrom"></span></div>'
      + '<div class="row"><label></label><input type="number" class="ssW" min="256" max="2048" step="32"> × <input type="number" class="ssH" min="256" max="2048" step="32">'
      + '<button type="button" class="ghost ssFromBtn" title="The loaded video\'s aspect at 768 (multiples of 32)">⟲ from video</button></div>'
      + '<div class="row"><label>Duration</label><input type="number" class="ssDur" min="1" step="0.5"> s <span class="note">each segment (✂ Auto segment cuts the video into these)</span></div>'
      + '<div class="row"><label>Steps</label><input type="number" class="ssSteps" min="1" max="100"> <span class="note">LTX Ripple (MiniMax H3 uses Quality, Viggle its own below)</span></div>'
      + '<div class="row"><label>Ripple strength</label><input type="number" class="ssStr" min="0" max="3" step="0.05"> <span class="note">the Ripple LoRA (1.35 = its README)</span></div>'
      // 2.344.0: Viggle's own (the 3-step DMD schedule; 5 / 7 = its slower presets)
      + '<div class="row"><label>Viggle steps</label><input type="number" class="ssVSteps" min="1" max="50"> <span class="note">3 = the DMD fast preset (5 / 7 = slower, finer)</span></div>'
      + '<div class="row"><label>Viggle DMD</label><input type="number" class="ssVStr" min="0" max="3" step="0.05"> <span class="note">the Viggle DMD LoRA strength (1)</span></div>'
      // 2.346.0: Sol-Attn crashed ComfyUI on Tim's run - off unless ticked (2.350.0: + fp16 accumulation, which can turn a take black)
      + '<div class="row"><label>Viggle speed</label><label style="min-width:0" title="The workflow\'s speed patches: the Sol-Attn attention patch (ComfyUI-SolAttn_triton) and fp16 accumulation. Faster when they work - Sol-Attn crashed ComfyUI in a real test and fp16 accumulation can make a black take, so they are off by default">'
      + '<input type="checkbox" class="ssVSol"> speed patches (Sol-Attn + fp16 accumulation)</label></div>'
      // 2.350.0 (Tim: a Viggle take came back ALL BLACK): safe mode - ticks itself when it rescues a black take
      + '<div class="row"><label>Viggle safe</label><label style="min-width:0" title="Renders with everything that can make NaNs (a black take) switched off: no speed patches, no fp16 accumulation, ComfyUI\'s own attention instead of the workflow\'s backend, a full-precision H3 VAE when you have one. Slower. A black take is always tried once more like this - and when that works, this ticks itself">'
      + '<input type="checkbox" class="ssVSafe"> safe mode (a black take is re-rendered like this automatically)</label></div>'
      // 2.351.0 (Tim: "can we build our own wan2gp engine?"): Viggle (native) - install, where, how
      + '<div class="row ssVnHead"><label>Viggle native</label><span class="note ssVnState">…</span>'
      + '<button type="button" class="ghost ssVnInst" title="The native engine\'s install: its Python environment, then what Viggle still needs - your ComfyUI Viggle files are used when the engine can read them, the rest comes from the official download (resumable). A gated repo needs its license accepted on huggingface.co and your token in Settings">⤓ Install</button></div>'
      + '<div class="row"><label></label><span class="note ssVnSrc" style="flex:1;min-width:0"></span>'
      + '<button type="button" class="ghost ssVnCheck" title="Read the headers of the Viggle files in your ComfyUI models folders (no weights are loaded) and use every one the engine can read - no download for those">🔍 Use my ComfyUI files</button></div>'
      + '<div class="row"><label></label><input type="text" class="ssVnDir" placeholder="models/native" title="Where the downloaded weights go (blank = models/native)" style="flex:1;min-width:0"></div>'
      + '<div class="row"><label>Native steps</label><input type="number" class="ssVnSteps" min="1" max="12"> <span class="note">4 = Viggle\'s operating point (3 passes) - more is not better</span></div>'
      + '<div class="row"><label>Native shift</label><input type="number" class="ssVnShift" min="0.5" max="12" step="0.5"> <span class="note">3 = what the distilled model wants</span></div>'
      + '<div class="row" style="align-items:flex-start"><label>LoRAs</label><div style="flex:1;min-width:0"><div id="swSetLoras" class="swSetLoras"></div>'
      + '<button type="button" class="ghost ssAddLora" title="Add a LoRA to the LTX Ripple / Viggle render">＋ Add LoRA</button></div></div>'
      + '<div class="row"><label>Seed</label><select class="ssSeedMode"><option value="random">Random</option><option value="fixed">Fixed</option></select>'
      + '<input type="number" class="ssSeed" min="0" step="1"><button type="button" class="ghost ssDice" title="A new random number">🎲</button></div>'
      // 2.343.0 (Tim: "ltx doesn't start the render after the picture is generated")
      + '<div class="row"><label>Ripple / Viggle</label><label style="min-width:0" title="Off: ▶ Swap stops at the ✎ first frame so you can check / touch it up, then ▶ Swap again">'
      + '<input type="checkbox" class="ssAutoRender"> ▶ render as soon as the ✎ first frame is made</label></div>'
      + '<div class="note ssNote"></div></div>'
      + '<div class="sf"><button type="button" class="ghost ssCancel">Cancel</button><button type="button" class="ssSave">Save</button></div>';
    document.body.appendChild(d);
    var g = function (c) { return d.querySelector("." + c); };
    g("ssX").onclick = g("ssCancel").onclick = function () { d.close(); };
    g("ssAuto").onchange = function () { g("ssW").disabled = g("ssH").disabled = this.checked; if (this.checked) fromVideo(); };
    g("ssFromBtn").onclick = function () { g("ssAuto").checked = false; fromVideo(true); g("ssW").disabled = g("ssH").disabled = false; };
    g("ssSeedMode").onchange = function () { g("ssSeed").disabled = this.value !== "fixed"; };
    g("ssDice").onclick = function () { g("ssSeedMode").value = "fixed"; g("ssSeed").disabled = false; g("ssSeed").value = Math.floor(Math.random() * 2147483647); };
    g("ssAddLora").onclick = function () {
      if (typeof window.addTempLoraTo === "function") window.addTempLoraTo("swap", "swSetLoras");
      else g("ssNote").textContent = "the LoRA picker is not available in this window";
    };
    g("ssSave").onclick = saveSettings;
    g("ssVnInst").onclick = vnInstall;
    g("ssVnCheck").onclick = vnCheck;
    function fromVideo(fill) {
      var st = cur.st || {}, vi = st.video_info || {};
      var rs = sizeFrom(vi.width, vi.height);
      if (fill !== false) { g("ssW").value = rs.width; g("ssH").value = rs.height; }
    }
    cur.setDlg = { dlg: d, g: g };
    return cur.setDlg;
  }
  /** The video's aspect at 768 on the short side, multiples of 32 (lib/rippleSwap.size);
   *  2.344.0: 480 for Viggle (lib/viggleSwap.SHORT - its reference canvas is 480x832). */
  function sizeFrom(w, h, short) {
    short = +short || (cur && cur.st && /^viggle/.test(cur.st.engine || "") ? 480 : 768);
    w = +w || 1152; h = +h || 768;
    var k = short / Math.min(w, h), r = function (v) { return Math.max(256, Math.min(2048, Math.round(v * k / 32) * 32)); };
    return { width: r(w), height: r(h) };
  }
  function openSettings() {
    var S = setDlg(), g = S.g, st = cur.st || {}, set = st.settings || {}, vi = st.video_info || {}, rs = st.render_size || sizeFrom(vi.width, vi.height);
    g("ssAuto").checked = set.auto_size !== false;
    g("ssW").value = set.auto_size === false && set.width ? set.width : rs.width;
    g("ssH").value = set.auto_size === false && set.height ? set.height : rs.height;
    g("ssW").disabled = g("ssH").disabled = g("ssAuto").checked;
    g("ssFrom").textContent = vi.width ? "(the video is " + vi.width + "×" + vi.height + ")" : "(load a video)";
    g("ssDur").value = (st.max || st.best_seconds || 5).toFixed(2);
    g("ssDur").max = String(st.max_seconds || 15.08);
    g("ssSteps").value = set.steps || 8;
    g("ssStr").value = set.strength != null ? set.strength : 1.35;
    g("ssVSteps").value = set.viggle_steps || 3;
    g("ssVStr").value = set.viggle_strength != null ? set.viggle_strength : 1;
    g("ssVSol").checked = set.viggle_solattn === true;
    g("ssVSafe").checked = set.viggle_safe === true;
    g("ssVnSteps").value = set.vn_steps || 4;
    g("ssVnShift").value = set.vn_shift || 3;
    vnState();
    g("ssSeedMode").value = set.seed_mode === "fixed" ? "fixed" : "random";
    g("ssSeed").value = set.seed || 0;
    g("ssSeed").disabled = g("ssSeedMode").value !== "fixed";
    g("ssAutoRender").checked = set.auto_render !== false;
    g("ssNote").textContent = "";
    if (typeof window.mountTempLoras === "function") window.mountTempLoras("swap", "swSetLoras", st.loras || []);
    if (S.dlg.showModal) S.dlg.showModal(); else S.dlg.setAttribute("open", "");
  }
  function readSettings() {
    var g = setDlg().g;
    return { auto_size: g("ssAuto").checked, width: +g("ssW").value || 0, height: +g("ssH").value || 0,
             steps: +g("ssSteps").value || 8, strength: g("ssStr").value === "" ? 1.35 : +g("ssStr").value,
             seed_mode: g("ssSeedMode").value, seed: +g("ssSeed").value || 0, auto_render: g("ssAutoRender").checked,
             viggle_steps: +g("ssVSteps").value || 3, viggle_strength: g("ssVStr").value === "" ? 1 : +g("ssVStr").value,
             viggle_solattn: g("ssVSol").checked, viggle_safe: g("ssVSafe").checked,
             vn_steps: +g("ssVnSteps").value || 4, vn_shift: +g("ssVnShift").value || 3 };
  }
  // 2.351.0: Viggle (native) - its state in the ⚙ dialog, ⤓ Install, the folder
  function vnPaint(s) {
    var d = cur && cur.setDlg; if (!d || !s) return s;
    var g = d.g, job = s.job || {};
    var busy = job.status === "queued" || job.status === "running";
    g("ssVnState").textContent = s.ready ? "✓ installed - " + s.root
      : busy ? "⤓ installing… (follow it in the queue) " + String(job.last || "").slice(0, 90)
      : (s.venv_ready ? "the Python environment is ready; " : "") + (s.weights_ready ? "the weights are in place" : "missing: " + (s.missing || []).join(", ") + " (~" + (s.download_gb || 0) + " GB)") + " - ⤓ Install";
    g("ssVnInst").disabled = busy;
    g("ssVnInst").textContent = s.ready ? "⤓ Reinstall" : "⤓ Install";
    var HOW = { comfy: "your ComfyUI file", official: "downloaded", missing: "missing", unchecked: "ComfyUI file found - 🔍 to use it" };
    g("ssVnSrc").textContent = (s.sources || []).filter(function (x) { return x.id !== "base" && x.id !== "viggle_assets"; }).map(function (x) {
      // 2.353.0: a file Tim's ComfyUI workflow names - used, not downloaded (checked once the venv is there)
      if (x.how === "unchecked" && x.workflow) return x.label + ": " + String(x.workflow).split(/[\\/]/).pop() + " (your workflow's - checked after ⤓ Install)";
      return x.label + ": " + (x.how === "comfy" ? String(x.file || "").split(/[\\/]/).pop() : (HOW[x.how] || x.how));
    }).join(" · ");
    g("ssVnCheck").disabled = busy || !s.venv_ready;
    if (document.activeElement !== g("ssVnDir")) g("ssVnDir").value = s.dir_setting || "";
    g("ssVnDir").setAttribute("data-was", s.dir_setting || "");
    return s;
  }
  function vnState() {
    return fetch("/api/viggle-native/status").then(function (r) { return r.json(); }).then(vnPaint).catch(function () { return null; });
  }
  function vnCheck() {
    var S = setDlg();
    S.g("ssVnState").textContent = "🔍 reading the ComfyUI files' headers…";
    return jpost("/api/viggle-native/check", {}).then(function (j) {
      if (j.error) { S.g("ssNote").textContent = "⚠ " + j.error; }
      vnPaint(j);
      if (!j.error) msg("🔍 checked " + (j.checked || 0) + " ComfyUI file(s) - " + (j.ready ? "Viggle (native) is ready" : (j.note || "")));
      return j;
    });
  }
  function vnInstall() {
    var S = setDlg();
    var dir = S.g("ssVnDir").value.trim();
    return jpost("/api/viggle-native/config", { dir: dir }).then(function () {
      return jpost("/api/viggle-native/install", {});
    }).then(function (j) {
      if (j.error) { S.g("ssNote").textContent = "⚠ " + j.error; return j; }
      vnPaint(j);
      msg("⤓ Viggle (native) is installing - the native engine's Python environment, then " + ((j.components || []).join(", ") || "no downloads") + " (follow it in the queue; it resumes if it stops)");
      return j;
    });
  }
  function saveSettings() {
    var S = setDlg();
    var body = { settings: readSettings(), max: +S.g("ssDur").value || undefined };
    var vnDir = S.g("ssVnDir").value.trim(), vnWas = S.g("ssVnDir").getAttribute("data-was");
    var pre = vnWas != null && vnDir !== vnWas ? jpost("/api/viggle-native/config", { dir: vnDir }) : Promise.resolve(null);
    return pre.then(function () { return jpost("/api/swapdlg/set", body); }).then(function (j) {
      if (j.error) { S.g("ssNote").textContent = "⚠ " + j.error; return j; }
      apply(j);
      S.dlg.close();
      var s = j.settings || {}, rs = j.render_size || {};
      msg("⚙ " + (rs.width ? rs.width + "×" + rs.height + (s.auto_size ? " (from the video)" : "") + " · " : "")
        + (j.max ? j.max.toFixed(2) + " s segments · " : "") + (s.steps || 8) + " steps · seed " + (s.seed_mode === "fixed" ? s.seed : "random")
        + ((j.loras || []).length ? " · " + j.loras.length + " LoRA(s)" : ""));
      return j;
    });
  }

  // ------------------------------------------------------------ LTX Ripple first frames (2.339.0)
  function paintFF() {
    if (!cur || !cur.st) return;
    var box = cur.q("swFF"), rip = !!FF_ENGINES[cur.st.engine];
    box.hidden = !rip; box.innerHTML = "";
    if (!rip) return;
    var shown = 0;
    (cur.st.segments || []).forEach(function (g, i) {
      // 2.349.0 (Tim: "when user deletes the first frame image (x) remove the
      // placeholder and reorder the list"): a card only for a segment that
      // HAS first frames (or is making them / failed to) - no empty placeholders
      var ff0 = g.ff || {};
      if (!ff0.file && ff0.status !== "running" && ff0.status !== "failed" && !(ff0.cands || []).length) return;
      shown++;
      var ff = g.ff || {}, card = el("div", "swFFCard" + (ff.status === "failed" ? " bad" : ""));
      card.dataset.seg = g.id;
      var cands = ff.cands || (ff.file ? [{ file: ff.file, label: ff.label, at: ff.at }] : []), making = (ff.jobs || []).length;
      var pic = ff.file && (ff.status === "done" || ff.status === "running")
        ? '<img alt="" class="ffMain" title="Double-click: see it big" src="/api/swapdlg/ff/' + encodeURIComponent(g.id) + "?v=" + encodeURIComponent(ff.file + (ff.at || "")) + '">'
        : '<div class="ph">' + (ff.status === "running" ? "✎ making…" : ff.status === "failed" ? "⚠ " + esc(ff.error || "failed") : "no first frame") + "</div>";
      // 2.348.0: every candidate - click = use it, double-click = see it big
      var strip = cands.length > 1 ? '<div class="ffcs">' + cands.map(function (c, k) {
        return '<img alt="" class="ffc' + (c.file === ff.file ? " on" : "") + '" data-file="' + esc(c.file) + '" title="' + esc((k + 1) + "/" + cands.length + " " + (c.label || c.file))
          + ' - click: use it, double-click: see it big" src="/api/swapdlg/ff/' + encodeURIComponent(g.id) + "?f=" + encodeURIComponent(c.file) + "&v=" + encodeURIComponent(c.at || "") + '">';
      }).join("") + "</div>" : "";
      card.innerHTML = "<div>#" + (i + 1) + " " + fmt(g.start) + (ff.label ? " · " + esc(ff.label) : "")
        + (cands.length > 1 ? " · " + (cands.findIndex(function (c) { return c.file === ff.file; }) + 1) + "/" + cands.length : "")
        + (making && ff.file ? " · ✎ " + making + " more…" : "") + "</div>" + pic + strip
        + '<div class="acts"><button type="button" data-ff="make" title="✎ Make more first frames with Qwen Image 2.1 (how many: ✎×N in the menubar) - each is kept, click the one to use">✎</button>'
        + '<button type="button" data-ff="edit"' + (ff.status === "done" ? "" : " disabled") + ' title="Touch it up in the Image editor (this dialog closes; 💾 Save there, then reopen ⇄ and press ⤓)">🖌</button>'
        + '<button type="button" data-ff="latest" title="Use the picture you saved last in the Image assets (a touch-up from the Image editor)">⤓</button>'
        + '<button type="button" data-ff="put" title="Use a picture file as this first frame">⤒</button>'
        + '<button type="button" data-ff="clear"' + (ff.file ? "" : " disabled") + ' title="Remove the first frame in use (the newest other one is used)">✕</button></div>';
      box.appendChild(card);
    });
    if (!shown) box.innerHTML = '<span class="hint">No first frames yet - ✎ First frames makes one for the segment in the box (⇄ Swap makes it when a segment has none).</span>';
  }
  function ffAct(act, id) {
    var g = (cur.st.segments || []).find(function (x) { return x.id === id; });
    if (!g) return null;
    if (act === "make") {
      msg("✎ making " + ffCount() + " first frame(s) (Qwen Image 2.1)…");
      return jpost("/api/swapdlg/firstframe", { ids: [id], text: cur.q("swText").value, count: ffCount() }).then(function (j) { apply(j); if (!j.error) msg(j.note); return j; });
    }
    if (act === "latest") return jpost("/api/swapdlg/firstframe/put", { id: id, asset: "@latest" }).then(function (j) { apply(j); if (!j.error) msg(j.note); return j; });
    if (act === "clear") return jpost("/api/swapdlg/firstframe/clear", { id: id, file: (g.ff || {}).file }).then(apply);
    if (act === "select") return jpost("/api/swapdlg/firstframe/select", { id: id, file: arguments[2] }).then(function (j) { apply(j); if (!j.error) msg(j.note); return j; });
    if (act === "put") { cur.ffFor = id; cur.q("swFFIn").click(); return null; }
    if (act === "edit") {
      var url = "/api/swapdlg/ff/" + encodeURIComponent(id) + "?v=" + Date.now();
      if (typeof window.ieOpenUrl !== "function") { msg("⚠ the Image editor dock is not installed (ext/imageeditdock)", true); return null; }
      try { cur.dlg.close(); } catch (e) {}
      window.ieOpenUrl(url, "ripple_first_" + (g.start || 0).toFixed(2).replace(".", "_") + ".png");
      return null;
    }
    return null;
  }
  /** 2.348.0: ✎×N in the menubar. */
  function ffCount() { var n = +((cur && cur.q("swFFN") || {}).value || 1); return n >= 1 && n <= 4 ? n : 1; }
  /* 2.349.0 (Tim: "when user clicks first frame button, create another image
     for the first frame"): ✎ First frames ALWAYS makes more (✎×N) - for the
     segment in the box; the box on no segment yet becomes one first. */
  function boxSeg() {
    var s = cur.sel;
    return (cur.st.segments || []).find(function (g) { return Math.abs(g.start - s.start) < 0.5 / FPS && Math.abs(g.dur - s.dur) < 0.5 / FPS; }) || null;
  }
  function ffAll() {
    if (!cur.st.video) { msg("load the video to swap first (📂 Load video)", true); return Promise.resolve(null); }
    var n = ffCount(), text = cur.q("swText").value;
    var make = function (g, i) {
      msg("✎ making " + n + " more first frame(s) for #" + (i + 1) + " " + fmt(g.start) + "…");
      return jpost("/api/swapdlg/firstframe", { ids: [g.id], text: text, count: n }).then(function (j) { apply(j); if (!j.error) msg(j.note); return j; });
    };
    var g = boxSeg();
    if (g) return make(g, (cur.st.segments || []).indexOf(g));
    return jpost("/api/swapdlg/segments", { op: "add", start: cur.sel.start, dur: cur.sel.dur }).then(function (j) {
      if (j.error || !j.seg) { if (j.error) msg("⚠ " + j.error, true); return apply(j); }
      apply(j);
      setSel(j.seg.start, j.seg.dur, false);                  // the box sits on the new segment
      var i = (cur.st.segments || []).findIndex(function (x) { return x.id === j.seg.id; });
      return make(cur.st.segments[i] || j.seg, i);
    });
  }

  // ------------------------------------------------------------ VR (2.330.0)
  var VR_SPAN = { mono360: 360, tb360: 360, sbs180: 180 };
  function vrOn() { return !!(cur && cur.st && cur.st.vr && cur.st.vr.mode && cur.st.vr.mode !== "off"); }
  /** A click at (u, v) of the whole frame -> the aim in the LEFT eye (a
   *  click in the right eye aims at the same spot) - lib/swapSession.aimFromClick. */
  function aimFromClick(mode, u, v) {
    if (!VR_SPAN[mode]) return null;
    var x = +u, y = +v;
    if (mode === "tb360") y = (y % 0.5) * 2;
    if (mode === "sbs180") x = (x % 0.5) * 2;
    return { yaw: Math.round((x - 0.5) * VR_SPAN[mode] * 10) / 10, pitch: Math.round((0.5 - y) * 180 * 10) / 10 };
  }
  /** The aim -> where it sits on the whole frame (u, v) + an approximate box. */
  function aimToFrame(vr) {
    var span = VR_SPAN[vr.mode] || 360;
    var u = 0.5 + vr.yaw / span, v = 0.5 - vr.pitch / 180;
    var sh = String(vr.shape || "1:1").split(":"), ar = (+sh[0] || 1) / (+sh[1] || 1);
    var hv = Math.atan(Math.tan(vr.fov * Math.PI / 360) / ar) * 360 / Math.PI;
    var bw = vr.fov / span, bh = hv / 180;
    if (vr.mode === "tb360") { v /= 2; bh /= 2; }
    if (vr.mode === "sbs180") { u /= 2; bw /= 2; }
    return { u: u, v: v, bw: bw, bh: bh };
  }
  /** The video's drawn picture inside its box (object-fit: contain). */
  function drawnRect() {
    var v = cur.q("swPrev"), r = v.getBoundingClientRect();
    var vw = v.videoWidth || (cur.info && cur.info.width) || 16, vh = v.videoHeight || (cur.info && cur.info.height) || 9;
    var hgt = Math.max(1, r.height - 44);                  // the controls strip is not picture
    var s = Math.min(r.width / vw, hgt / vh);
    var w = vw * s, h = vh * s;
    return { left: (r.width - w) / 2, top: (hgt - h) / 2, width: w, height: h, box: r };
  }
  function paintVr() {
    if (!cur || !cur.st) return;
    var vr = cur.st.vr || { mode: "off" }, q = cur.q, on = vrOn();
    cur.dlg.classList.toggle("vr", on);
    var sel = q("swVrMode");
    if (document.activeElement !== sel) sel.value = vr.mode || "off";
    [["swYaw", "yaw"], ["swPitch", "pitch"], ["swFov", "fov"]].forEach(function (k) {
      if (document.activeElement !== q(k[0])) q(k[0]).value = String(vr[k[1]] != null ? vr[k[1]] : "");
    });
    if (document.activeElement !== q("swShape")) q("swShape").value = vr.shape || "1:1";
    var hint = q("swVrHint");
    if (!on) { hint.textContent = ""; return; }
    var info = cur.info || {};
    var eye = info.width ? (vr.mode === "tb360" ? info.width + "×" + Math.round(info.height / 2)
      : vr.mode === "sbs180" ? Math.round(info.width / 2) + "×" + info.height : info.width + "×" + info.height) : "?";
    hint.textContent = "eye " + eye + (vr.mode === "mono360" ? "" : " · the other eye is built from the original depth")
      + " · output " + FPS + " fps";
    var dot = q("swAimDot"), bx = q("swAimBox"), d = drawnRect(), a = aimToFrame(vr);
    dot.style.left = (d.left + a.u * d.width) + "px"; dot.style.top = (d.top + a.v * d.height) + "px";
    bx.style.left = (d.left + (a.u - a.bw / 2) * d.width) + "px"; bx.style.top = (d.top + (a.v - a.bh / 2) * d.height) + "px";
    bx.style.width = (a.bw * d.width) + "px"; bx.style.height = (a.bh * d.height) + "px";
  }
  var lookTimer = 0;
  function look(now) {
    clearTimeout(lookTimer);
    lookTimer = setTimeout(function () {
      if (!cur || !vrOn() || !cur.st.video) return;
      var t = +cur.q("swPrev").currentTime || cur.sel.start || 0;
      cur.q("swVrView").src = "/api/swapdlg/vrview?t=" + t.toFixed(2) + "&r=" + Date.now();
    }, now ? 0 : 400);
  }
  function setVr(patch) {
    return jpost("/api/swapdlg/set", { vr: patch }).then(function (j) { apply(j); look(); return j; });
  }

  // ------------------------------------------------------------ right
  function rowFor(r, i) {
    var st = cur.st;
    var idx = (st.segments || []).findIndex(function (g) { return g.id === r.seg; });
    var row = el("div", "swRow" + (cur.out && cur.out.id === r.id ? " cur" : ""));
    row.dataset.id = r.id;
    var label = (idx >= 0 ? "#" + (idx + 1) + " " : "") + fmt(r.start) + "–" + fmt(r.start + r.dur)
      + (r.upscaled ? " ⏫" : "") + (r.file ? " · " + r.file : " · " + r.status)
      + (r.status === "failed" && r.error ? " - " + r.error.replace(/^the render failed:\s*/, "") : "");      // 2.343.0
    var h = '<span class="swDot ' + r.status + '" title="' + esc(r.status + (r.error ? ": " + r.error : "")) + '"></span>';
    if (r.where === "keep") h += '<input type="checkbox" data-act="pick" title="Join this one with 🎬 Compile"' + (cur.compileSel[r.id] !== false ? " checked" : "") + ">";
    h += '<span class="nm" title="' + esc(label + (r.seed >= 0 ? " · seed " + r.seed : "")) + '">' + esc(label) + "</span>";
    if (r.status === "done") {
      h += '<button type="button" class="ghost gbtn" data-act="play" title="Preview it on the right">▶</button>';
      h += r.where === "keep"
        ? '<button type="button" class="ghost gbtn" data-act="unkeep" title="Back to vidTemp">↩</button>'
        : '<button type="button" class="ghost gbtn" data-act="keep" title="Keep it - moves to vidSwap, ready to join">✓ Keep</button>';
    }
    if (r.status !== "queued" && r.status !== "running")
      h += '<button type="button" class="ghost gbtn" data-act="del" title="Discard - to the project\'s recycle bin">🗑</button>';
    row.innerHTML = h;
    return row;
  }
  function paintRight() {
    var st = cur.st, T = cur.q("swTempL"), K = cur.q("swKeepL");
    T.innerHTML = ""; K.innerHTML = "";
    var mine = (st.results || []).slice().sort(function (a, b) { return a.start - b.start; });
    mine.filter(function (r) { return r.where !== "keep"; }).forEach(function (r, i) { T.appendChild(rowFor(r, i)); });
    mine.filter(function (r) { return r.where === "keep" && r.status === "done"; }).forEach(function (r, i) { K.appendChild(rowFor(r, i)); });
    if (!T.children.length) T.innerHTML = '<span class="hint">Swapped segments land here.</span>';
    if (!K.children.length) K.innerHTML = '<span class="hint">✓ Keep the good ones - Compile joins them.</span>';
    if (cur.out) {
      var still = (st.results || []).find(function (r) { return r.id === cur.out.id; });
      if (!still || still.status !== "done") { if (cur.out.id) showOut(null); }
      else if (still.file !== cur.out.file || still.where !== cur.out.where) showOut(still);
    }
    var hasOut = !!(cur.out && cur.out.id);
    ["swSave", "swRetry", "swUp"].forEach(function (k) { cur.q(k).disabled = !hasOut; });
  }
  function showOut(r) {
    var v = cur.q("swOut");
    cur.out = r;
    if (!r) { v.removeAttribute("src"); try { v.load(); } catch (e) {} cur.q("swOutName").textContent = ""; return; }
    v.src = r.url || ("/api/swapdlg/file/" + (r.where === "keep" ? "keep" : "temp") + "/" + encodeURIComponent(r.file));
    cur.q("swOutName").textContent = r.file + (r.seed >= 0 ? " · seed " + r.seed : "") + (r.upscaled ? " · upscaled" : "");
    Array.prototype.forEach.call(cur.dlg.querySelectorAll(".swRow"), function (x) { x.classList.toggle("cur", x.dataset.id === r.id); });
    ["swSave", "swRetry", "swUp"].forEach(function (k) { cur.q(k).disabled = !r.id; });
  }

  // ------------------------------------------------------------ actions
  function run(body, what) {
    var sz = ctx.size ? ctx.size() || {} : {};
    body.width = sz.width; body.height = sz.height;
    body.video_style_id = ctx.styleId ? ctx.styleId() : "";
    body.text = cur.q("swText").value;
    body.ff_count = ffCount();                                  // 2.348.0
    msg(what + "…");
    return jpost("/api/swapdlg/run", body).then(function (j) {
      if (!j.error) msg(j.note || "queued");
      return apply(j);
    });
  }
  // 2.335.0: ✎ Write prompt - routes/swapdlg.js /writeprompt (lib/swapPrompt)
  function writePrompt() {
    if (!cur.st.picture) return msg("pick the new character's picture first (the box on the left)", true);
    var btn = cur.q("swWrite"), box = cur.q("swText");
    var t = cur.sel && cur.sel.dur ? cur.sel.start + cur.sel.dur / 2 : (+cur.q("swPrev").currentTime || 0);
    btn.disabled = true;
    msg("✎ writing the prompt - the vision model looks at the picture and the frame at " + t.toFixed(2) + " s, then the LLM writes it (about a minute)…");
    return jpost("/api/swapdlg/writeprompt", { t: t, text: box.value, llm_file: ctx.llmFile ? ctx.llmFile() || "" : "" })
      .then(function (j) {
        btn.disabled = false;
        if (j.error) return msg("⚠ " + j.error, true);
        box.value = j.prompt || "";
        apply(j);
        msg(j.note || "✎ prompt written");
        return j;
      }, function (e) { btn.disabled = false; msg("⚠ " + (e && e.message || e), true); });
  }
  function swapBox() { return run({ start: cur.sel.start, dur: cur.sel.dur }, "queueing the box"); }
  function swapAll() {
    var st = cur.st;
    var ids = (st.segments || []).filter(function (g) { var s = segStatus(g.id); return s !== "done" && s !== "queued" && s !== "running"; })
      .map(function (g) { return g.id; });
    if (!(st.segments || []).length) { msg("✂ Auto segment first (or ⇄ Swap the box)", true); return Promise.resolve(null); }
    if (!ids.length) { msg("every segment has a finished or waiting result - ↻ Retry one on the right to redo it"); return Promise.resolve(null); }
    return run({ ids: ids }, "queueing " + ids.length + " segment(s)");
  }
  function auto() {
    return jpost("/api/swapdlg/segments", { op: "auto", max: +cur.q("swMax").value }).then(function (j) {
      apply(j);
      if (!j.error) msg(j.note || "segmented");
      if (j.segments && j.segments[0]) setSel(j.segments[0].start, j.segments[0].dur);
      return j;
    });
  }
  /* 2.347.0 (Tim: "when user clicks on one of the generated pictures in swap
     character dialog open it in the preview window. do the same with the
     generated video"): the big preview shows a ✎ first frame (a picture over
     the player) or a finished segment (the player plays it, the box loop
     paused); "✕ back to the video" (or Esc, or touching the box / filmstrip)
     returns to the video being swapped where it was. */
  function viewInPreview(kind, url, label) {
    var v = cur.q("swPrev"), img = cur.q("swPrevImg"), back = cur.q("swPrevBack");
    if (!cur.view) cur.view = { src: v.getAttribute("src") || "", t: +v.currentTime || 0 };
    cur.view.kind = kind;
    back.textContent = "✕ back to the video · " + label;
    back.hidden = false;
    if (kind === "img") {
      try { v.pause(); } catch (e) {}
      if (v.getAttribute("src") !== cur.view.src) { v.src = cur.view.src; try { v.currentTime = cur.view.t; } catch (e) {} }
      img.src = url; img.hidden = false;
    } else {
      img.hidden = true; img.removeAttribute("src");
      v.src = url;                                   // 2.562.0: loaded, not started (Tim: "don't automatically play videos or music")
    }
    msg((kind === "img" ? "🖼 " : "▶ ") + label + " in the preview - ✕ (or Esc) goes back to the video");
  }
  function backToVideo(quiet) {
    if (!cur || !cur.view) return;
    var v = cur.q("swPrev"), img = cur.q("swPrevImg"), back = cur.q("swPrevBack"), was = cur.view;
    cur.view = null;
    img.hidden = true; img.removeAttribute("src");
    back.hidden = true;
    if (!quiet && v.getAttribute("src") !== was.src) {
      if (was.src) { v.src = was.src; try { v.currentTime = was.t; } catch (e) {} } else { v.removeAttribute("src"); }
    }
  }
  function onRow(e) {
    var b = e.target.closest("[data-act]");
    if (!b) {           // 2.347.0 / 2.348.0: click = the Result (selected), double-click = the big preview
      var row0 = e.target.closest(".swRow"); if (!row0 || (e.type !== "click" && e.type !== "dblclick")) return;
      var r0 = (cur.st.results || []).find(function (x) { return x.id === row0.dataset.id; });
      if (!r0 || r0.status !== "done" || !r0.file) return;
      showOut(r0);
      if (e.type === "click") return;
      return viewInPreview("vid", r0.url || ("/api/swapdlg/file/" + (r0.where === "keep" ? "keep" : "temp") + "/" + encodeURIComponent(r0.file)), r0.file);
    }
    if (e.type === "dblclick") return;                         // 2.348.0: a button double-click is two clicks, not a third action
    var id = e.target.closest(".swRow").dataset.id;
    var r = (cur.st.results || []).find(function (x) { return x.id === id; });
    if (!r) return;
    var act = b.dataset.act;
    if (act === "pick") { cur.compileSel[id] = b.checked; return; }
    if (act === "play") { showOut(r); try { cur.q("swOut").play(); } catch (er) {} return; }
    if (act === "keep" || act === "unkeep")
      return jpost("/api/swapdlg/keep", { id: id, keep: act === "keep" }).then(function (j) {
        apply(j); if (!j.error) msg(act === "keep" ? "kept - moved to vidSwap" : "back in vidTemp");
      });
    if (act === "del")
      return Promise.resolve(ctx.confirm ? ctx.confirm("Discard " + (r.file || "this result") + "? It goes to the project's recycle bin.") : true)
        .then(function (ok) { if (ok) return jpost("/api/swapdlg/discard", { id: id }).then(function (j) { if (cur.out && cur.out.id === id) showOut(null); apply(j); }); });
  }
  function compile() {
    var ids = (cur.st.results || []).filter(function (r) { return r.where === "keep" && r.status === "done" && cur.compileSel[r.id] !== false; })
      .map(function (r) { return r.id; });
    if (!ids.length) { msg("✓ Keep some segments first - Compile joins the ticked kept ones", true); return Promise.resolve(null); }
    msg("joining " + ids.length + " segment(s)…");
    cur.q("swCompile").disabled = true;
    return jpost("/api/swapdlg/compile", { ids: ids }).then(function (j) {
      cur.q("swCompile").disabled = false;
      if (j.error) { msg("⚠ " + j.error, true); return j; }
      msg(j.note);
      showOut({ id: "", file: j.name, url: "/passets/video/" + encodeURIComponent(j.name), seed: -1 });
      if (ctx.refreshAssets) try { ctx.refreshAssets(); } catch (e) {}
      return j;
    });
  }
  function again(kind) {
    if (!cur.out || !cur.out.id) return Promise.resolve(null);
    var sz = ctx.size ? ctx.size() || {} : {};
    msg(kind === "upscale" ? "queueing the upscale…" : "queueing a retry…");
    return jpost("/api/swapdlg/" + kind, { id: cur.out.id, width: sz.width, height: sz.height,
                                          video_style_id: ctx.styleId ? ctx.styleId() : "" })
      .then(function (j) { if (!j.error) msg(j.note); return apply(j); });
  }
  function saveOut() {
    if (!cur.out || !cur.out.id) return Promise.resolve(null);
    return jpost("/api/swapdlg/save", { id: cur.out.id }).then(function (j) {
      if (j.error) msg("⚠ " + j.error, true); else { msg(j.note); if (ctx.refreshAssets) try { ctx.refreshAssets(); } catch (e) {} }
      return j;
    });
  }
  /* 2.330.0: a dropped / browser-picked video STREAMS to disk (no size
     limit - the old path went through a 64 MB in-memory asset upload whose
     refusal was not JSON, so nothing happened at all). */
  function uploadVideo(file) {
    var fd = new FormData(); fd.append("file", file, file.name);
    msg("uploading " + file.name + (file.size ? " (" + Math.round(file.size / 1048576) + " MB)" : "") + "…");
    return fetch("/api/swapdlg/upload", { method: "POST", body: fd })
      .then(function (r) { return r.json().catch(function () { return { error: "HTTP " + r.status }; }); })
      .then(loaded).catch(function (e) { msg("⚠ the upload failed: " + e, true); return null; });
  }
  /** The app's own file dialog hands a PATH: imported in place (a hard
   *  link, else a copy on the server) - any size, nothing read into the page. */
  function importPath(p) {
    msg("loading " + p + "…");
    return jpost("/api/swapdlg/import", { path: p }).then(loaded).catch(function (e) { msg("⚠ " + e, true); return null; });
  }
  function loaded(j) {
    if (!j || j.error) { msg("⚠ " + ((j && j.error) || "the video did not load"), true); return null; }
    if (ctx.refreshAssets) try { ctx.refreshAssets(); } catch (e) {}
    var d = j.detected || {};
    msg((j.note || "loaded " + j.video) + (d.sure && d.mode ? " - VR " + d.mode + " (from its name)"
      : d.mode ? " - it could be VR (" + d.mode + "): set VR below if it is" : ""));
    return apply(j);
  }
  function pickVideo() {
    var FD = window.FileDialog;
    if (FD && FD.enabled && FD.local && FD.open) {
      return FD.open({ mode: "file", title: "Load video", okLabel: "Load", key: "swapvideo",
        filters: [{ label: "Video files", exts: [".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v", ".mpg", ".mpeg", ".ts", ".wmv"] }] })
        .then(function (r) { return r && r.path ? importPath(r.path) : null; });
    }
    cur.q("swVidIn").click();
    return Promise.resolve(null);
  }
  function setVideo(name) {
    return jpost("/api/swapdlg/set", { video: name }).then(function (j) { if (!j.error) msg("loaded " + name); return apply(j); });
  }

  // ------------------------------------------------------------ wiring
  function wire(c) {
    var q = c.q, dlg = c.dlg;
    q("swClose").addEventListener("click", close);
    // 2.347.0: Esc first leaves a picture / result shown in the preview
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); if (cur && cur.view) backToVideo(); else close(); });
    q("swPrevBack").addEventListener("click", function () { backToVideo(); msg("back to the video"); });
    // left
    var pic = q("swPic"), picIn = q("swPicIn");
    pic.addEventListener("click", function () { picIn.click(); });
    pic.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); picIn.click(); } });
    picIn.addEventListener("change", function () { var f = picIn.files && picIn.files[0]; picIn.value = ""; if (f) sendPicture(f); });
    pic.addEventListener("dragover", function (e) { e.preventDefault(); pic.classList.add("hot"); });
    pic.addEventListener("dragleave", function () { pic.classList.remove("hot"); });
    pic.addEventListener("drop", function (e) {
      e.preventDefault(); e.stopPropagation(); pic.classList.remove("hot");
      var d = ctx.drag ? ctx.drag() : null;
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) return sendPicture(f);
      if (d && d.type === "asset" && d.kind === "images")
        return jpost("/api/swapdlg/picture", { asset: d.name }).then(apply);
      msg("drop a picture file or an Image asset", true);
    });
    q("swText").addEventListener("change", function () { jpost("/api/swapdlg/set", { text: this.value }).then(apply); });
    q("swWrite").addEventListener("click", writePrompt);
    // middle
    var vidIn = q("swVidIn"), prev = q("swPrev");
    q("swLoad").addEventListener("click", pickVideo);
    q("swSet").addEventListener("click", openSettings);                    // 2.342.0
    vidIn.addEventListener("change", function () { var f = vidIn.files && vidIn.files[0]; vidIn.value = ""; if (f) uploadVideo(f); });
    var wrap = q("swPrevWrap");
    wrap.addEventListener("dragover", function (e) { e.preventDefault(); });
    wrap.addEventListener("drop", function (e) {
      e.preventDefault(); e.stopPropagation();
      var d = ctx.drag ? ctx.drag() : null;
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) return uploadVideo(f);
      if (d && d.type === "asset" && d.kind === "video") return setVideo(d.name);
      msg("drop a video file or a Video asset", true);
    });
    q("swStart").addEventListener("change", function () { setSel(+this.value, cur.sel.dur); });
    q("swDur").addEventListener("change", function () { setSel(cur.sel.start, +this.value); });
    q("swMax").addEventListener("change", function () {
      jpost("/api/swapdlg/set", { max: +this.value }).then(function (j) {
        apply(j);
        if (j.max && cur.sel.dur > j.max) setSel(cur.sel.start, j.max);
      });
    });
    q("swAuto").addEventListener("click", auto);
    q("swQual").addEventListener("change", function () { jpost("/api/swapdlg/set", { quality: this.value }).then(apply); });
    // 2.339.0: the engine + LTX Ripple's first frames
    q("swEng").addEventListener("change", function () {
      jpost("/api/swapdlg/set", { engine: this.value }).then(function (j) {
        apply(j);
        if (!j.error) msg(FF_ENGINES[j.engine] ? FF_ENGINES[j.engine] + ": ⇄ Swap makes each segment's ✎ first frame (Qwen Image 2.1), then renders it (⚙ to check the frames first)"
          + (j.engine === "viggle" ? " - Viggle-Animate on MiniMax H3, 3 steps" : "")
          + (j.engine === "viggle_native" ? " - Viggle-Animate in bitGen's own engine (no ComfyUI), 4 steps" : "") : "MiniMax H3");
        if (!j.error && j.engine === "viggle_native") vnState().then(function (s) { if (s && !s.ready) msg("⚠ " + s.note, true); });
      });
    });
    q("swFFAll").addEventListener("click", ffAll);
    q("swFF").addEventListener("click", function (e) {
      // 2.348.0 (Tim: "double click will do the preview, single click will
      // select the file"): a candidate click = use it; the pictures preview
      // on DOUBLE-click (the dblclick handler below)
      var fc = e.target.closest(".swFFCard .ffc");
      if (fc) {
        if (fc.classList.contains("on")) return;
        return ffAct("select", fc.closest(".swFFCard").dataset.seg, fc.dataset.file);
      }
      if (e.target.closest(".swFFCard img")) return;
      var b = e.target.closest("[data-ff]"); if (!b || b.disabled) return;
      ffAct(b.dataset.ff, e.target.closest(".swFFCard").dataset.seg);
    });
    q("swFF").addEventListener("dblclick", function (e) {
      var im = e.target.closest(".swFFCard img"); if (!im) return;
      var card = im.closest(".swFFCard"), segs = (cur.st && cur.st.segments) || [];
      var i = segs.findIndex(function (x) { return x.id === card.dataset.seg; });
      var all = card.querySelectorAll(".ffc"), k = Array.prototype.indexOf.call(all, im);
      viewInPreview("img", im.getAttribute("src"), "first frame #" + (i + 1) + (i >= 0 ? " at " + fmt(segs[i].start) : "")
        + (k >= 0 ? " · " + (k + 1) + "/" + all.length : ""));
    });
    q("swFFIn").addEventListener("change", function () {
      var f = this.files && this.files[0], id = cur.ffFor; this.value = "";
      if (!f || !id) return;
      var fd = new FormData(); fd.append("id", id); fd.append("image", f, f.name);
      fetch("/api/swapdlg/firstframe/put", { method: "POST", body: fd }).then(function (r) { return r.json(); })
        .then(function (j) { apply(j); if (!j.error) msg(j.note); });
    });
    // 2.330.0: VR - the format, the aim (numbers or a click on the person), 👁
    q("swVrMode").addEventListener("change", function () { setVr({ mode: this.value }); });
    [["swYaw", "yaw"], ["swPitch", "pitch"], ["swFov", "fov"]].forEach(function (k) {
      q(k[0]).addEventListener("change", function () { var o = {}; o[k[1]] = +this.value; setVr(o); });
    });
    q("swShape").addEventListener("change", function () { setVr({ shape: this.value }); });
    q("swVrLook").addEventListener("click", function () { look(true); });
    q("swAimLayer").addEventListener("click", function (e) {
      if (!vrOn()) return;
      var d = drawnRect();
      var u = (e.clientX - d.box.left - d.left) / d.width, v = (e.clientY - d.box.top - d.top) / d.height;
      if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) return;
      var a = aimFromClick(cur.st.vr.mode, u, v);
      if (a) { msg("aimed at yaw " + a.yaw + "°, pitch " + a.pitch + "°"); setVr(a); }
    });
    window.addEventListener("resize", function () { if (cur) paintVr(); });
    q("swPrev").addEventListener("loadedmetadata", function () { paintVr(); if (vrOn()) look(); });
    q("swGo").addEventListener("click", swapBox);
    q("swAll").addEventListener("click", swapAll);
    q("swInZ").addEventListener("click", function () { setZoom(cur.pps * 1.6, cur.sel.start + cur.sel.dur / 2); });
    q("swOutZ").addEventListener("click", function () { setZoom(cur.pps / 1.6, cur.sel.start + cur.sel.dur / 2); });
    q("swFit").addEventListener("click", function () { setZoom(zr().min, 0, 0); });
    var view = q("swView"), track = q("swTrack"), box = q("swBox");
    view.addEventListener("scroll", loadThumbs);
    view.addEventListener("wheel", function (e) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        var r = view.getBoundingClientRect(), x = e.clientX - r.left;
        setZoom(cur.pps * (e.deltaY < 0 ? 1.25 : 0.8), (view.scrollLeft + x) / cur.pps, x);
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); view.scrollLeft += e.deltaY; }
    }, { passive: false });
    function tAt(x) { return (x - track.getBoundingClientRect().left) / cur.pps; }
    var drag = null;
    box.addEventListener("pointerdown", function (e) {
      e.preventDefault(); e.stopPropagation();
      drag = { dx: tAt(e.clientX) - cur.sel.start }; box.classList.add("drag");
      try { box.setPointerCapture(e.pointerId); } catch (er) {}
    });
    box.addEventListener("pointermove", function (e) { if (drag) setSel(tAt(e.clientX) - drag.dx, cur.sel.dur); });
    function end() { drag = null; box.classList.remove("drag"); }
    box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
    box.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
      if (!d) return;
      e.preventDefault(); setSel(cur.sel.start + d * (e.shiftKey ? 1 : 1 / FPS), cur.sel.dur);
    });
    track.addEventListener("pointerdown", function (e) {
      if (box.contains(e.target)) return;
      var sg = e.target.closest(".swSeg");
      if (sg) { var g = cur.st.segments.find(function (x) { return x.id === sg.dataset.seg; }); if (g) setSel(g.start, g.dur); return; }
      setSel(tAt(e.clientX) - cur.sel.dur / 2, cur.sel.dur);
    });
    q("swChips").addEventListener("click", function (e) {
      var ch = e.target.closest(".swChip"); if (!ch) return;
      var g = cur.st.segments.find(function (x) { return x.id === ch.dataset.seg; }); if (!g) return;
      var act = (e.target.closest("[data-act]") || {}).dataset;
      if (act && act.act === "run") return run({ ids: [g.id] }, "queueing segment " + fmt(g.start));
      if (act && act.act === "rm") return jpost("/api/swapdlg/segments", { op: "remove", id: g.id }).then(apply);
      setSel(g.start, g.dur);
    });
    // the preview plays the BOX only, looping
    function keep() {
      if (cur.view) return;                              // 2.347.0: a result is playing in the preview
      var t = +prev.currentTime || 0, s = cur.sel;
      if (t < s.start - 0.5 / FPS || t >= s.start + s.dur - 0.25 / FPS) { try { prev.currentTime = s.start; } catch (e) {} }
      q("swHeadLine").style.left = ((+prev.currentTime || 0) * cur.pps) + "px";
    }
    prev.addEventListener("timeupdate", keep);
    prev.addEventListener("error", function () {
      if (cur && cur.st && cur.st.video && prev.src.indexOf("/passets/video/") >= 0) proxyFor(cur.st.video);
    });
    prev.addEventListener("seeked", keep);
    prev.addEventListener("loadedmetadata", function () { try { prev.currentTime = cur.sel.start; } catch (e) {} });
    // right
    q("swTempL").addEventListener("click", onRow);
    q("swTempL").addEventListener("dblclick", onRow);                // 2.348.0
    q("swKeepL").addEventListener("dblclick", onRow);
    q("swKeepL").addEventListener("click", onRow);
    q("swKeepL").addEventListener("change", onRow);
    q("swSave").addEventListener("click", saveOut);
    q("swRetry").addEventListener("click", function () { again("retry"); });
    q("swUp").addEventListener("click", function () { again("upscale"); });
    q("swCompile").addEventListener("click", compile);
  }

  function open() {
    var c = cur || build();
    if (!c.dlg.open) { try { c.dlg.showModal(); } catch (e) { c.dlg.setAttribute("open", ""); } }
    return fetch("/api/swapdlg").then(function (r) { return r.json(); }).then(function (st) {
      apply(st);
      // nothing loaded yet: start from the reference dock's video, if any
      var rv = ctx.refVideo ? ctx.refVideo() : "";
      if (!st.video && rv) return setVideo(rv).then(function () { return c; });
      return c;
    }).catch(function () { return c; });
  }
  function close() {
    if (!cur) return;
    var c = cur;
    clearTimeout(c.poll);
    try { c.q("swPrev").pause(); c.q("swOut").pause(); } catch (e) {}
    try { c.dlg.close(); } catch (e) { c.dlg.removeAttribute("open"); }
    if (c.dlg.parentNode) c.dlg.parentNode.removeChild(c.dlg);
    cur = null;
  }
  function install(o) {
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ctx[k] = o[k];
    // the video docker's "⇄ Swap" button (ext/videodock/dock.html #vdSwapDlg)
    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("#vdSwapDlg")) { e.preventDefault(); open(); }
    });
  }

  window.SwapDialog = { install: install, open: open, close: close, snapDown: snapDown, boxFrames: boxFrames, fmt: fmt,
                        state: function () { return cur; }, aimFromClick: aimFromClick, aimToFrame: aimToFrame,
                        _api: { vnInstall: vnInstall, vnState: vnState, vnCheck: vnCheck, viewInPreview: viewInPreview, backToVideo: backToVideo, failNews: failNews, writePrompt: writePrompt, swapBox: swapBox, swapAll: swapAll, auto: auto, compile: compile, again: again,
                                saveOut: saveOut, setSel: setSel, showOut: showOut, refresh: refresh, setVideo: setVideo,
                                setVr: setVr, pickVideo: pickVideo, importPath: importPath, uploadVideo: uploadVideo,
                                proxyFor: proxyFor, look: look, openSettings: openSettings, saveSettings: saveSettings, readSettings: readSettings, sizeFrom: sizeFrom } };
})();
