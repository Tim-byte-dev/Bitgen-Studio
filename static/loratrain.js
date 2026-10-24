/* bitGen Studio — static/loratrain.js (2.520.0): 🎓 THE LoRA TRAINER, a floating docker (window.H3LoraTrain).
 * Tim (verbatim): "build a lora floating docker for creating lora's like ai toolkit by ostris. keep our theme."
 *   🎓 LoRA (statusbar)   shows / hides it (a SecFloat docker: float it, dock it beside / inside another)
 *   ai-toolkit            ready ✓, or ⚙ Install ai-toolkit (a queue job: the repo, its venv, PyTorch for this card)
 *   JOB tab               base model (Z-Image Turbo, FLUX.1, Qwen-Image, SDXL, SD 1.5, Chroma, Wan 2.1 - what each needs
 *                         vs your card), model path, trigger word (+ into the captions), rank / alpha, steps, learning
 *                         rate, batch, optimizer, resolutions, caption dropout, flip, low VRAM, quantize, save every /
 *                         keep, samples every + their prompts ([trigger]), notes; 💾 Save; 📄 YAML (the ai-toolkit config
 *                         it makes - ✎ edit it and Use my YAML, ↺ back to the generated one)
 *   DATASET tab           ＋ pictures from this computer, 🖼 from the gallery, ✨ captions from the vision model (the empty
 *                         ones / all), every picture with its caption (saved as you leave the box), ✕ removes it
 *   RUN tab               ▶ Start training (a queue job), its step / total, loss, the last log lines, ⏹ Stop; the
 *                         checkpoints, the sample pictures as they come; the finished LoRA lands in ComfyUI's loras
 *                         folder (trained/<name>) - the 🧩 Model manager shows it; ⤓ Export job (.zip) for another
 *                         machine (a RunPod pod - Settings -> Remote GPU)
 * 2.521.0 (Tim: "can we add a checkpoint finetune option to the lora creator docker to build on existing llm, vision and
 *   image models? reccomend the best base models for the tasks"): every job has a TYPE (the Job tab's first row) -
 *     🎨 LoRA (pictures / video)           as before; a finished picture LoRA can be ⧉ BAKED into its base model (a new
 *                                         checkpoint - ComfyUI does it, any card)
 *     🧱 Checkpoint fine-tune (pictures)   every weight of a picture model (ai-toolkit's full fine-tune: Lumina 2, Flex.1,
 *                                         FLUX.2 klein, SDXL) -> ComfyUI's diffusion_models/trained
 *     💬 LLM fine-tune (the assistant)     Unsloth on your chats (typed here or imported JSONL / JSON / CSV) -> a .gguf in
 *                                         the LLM folder
 *     👁 Vision fine-tune (the captioner)  Unsloth on pictures + the answer for each -> .gguf + mmproj in the vision folder
 *   the base models are marked ★ (the recommended ones for each kind) with what each needs vs your card
 * Pure (Node: scripts/test-lora520.js, test-finetune521.js): fitText, stepText, lossOf, kindOf, presetsOf, chatToJsonl,
 * isFt, doneText.
 */
(function (root) {
  "use strict";
  function fitText(pre, gpu) {
    if (!pre) return "";
    if (!gpu || !gpu.vram_gb) return "needs about " + pre.vram_gb + " GB of VRAM (no NVIDIA card found here - Export the job for a bigger machine)";
    return gpu.vram_gb >= pre.vram_gb ? "needs about " + pre.vram_gb + " GB - your " + gpu.name + " has " + gpu.vram_gb + " GB ✓"
      : "needs about " + pre.vram_gb + " GB - your " + gpu.name + " has " + gpu.vram_gb + " GB: try Low VRAM, or Export the job for a bigger machine";
  }
  function stepText(p) { return p && p.total ? "step " + p.step + " / " + p.total + " (" + Math.round(p.step / p.total * 100) + " %)" : ""; }
  function lossOf(lines) { for (var i = (lines || []).length - 1; i >= 0; i--) { var m = /loss[:= ]\s*([0-9.eE+-]+)/.exec(lines[i]); if (m) return +m[1]; } return null; }
  var KINDS = [{ id: "lora", label: "🎨 LoRA (pictures / video - ai-toolkit)" }, { id: "ckpt", label: "🧱 Checkpoint fine-tune (pictures - every weight)" },
    { id: "llm", label: "💬 LLM fine-tune (the assistant - Unsloth)" }, { id: "vision", label: "👁 Vision fine-tune (the captioner - Unsloth)" }];
  function isFt(k) { return k === "llm" || k === "vision"; }
  function kindOf(j) { return (j && (j.kind || (j.settings && j.settings.kind))) || "lora"; }
  /** the base models a kind picks from (st = /api/loratrain) */
  function presetsOf(st, kind) {
    if (!st) return [];
    if (isFt(kind)) return ((st.ft || {})[kind]) || [];
    return (st.presets || []).filter(function (p) { return !!p.full === (kind === "ckpt"); });
  }
  /** an LLM job's examples as chat.jsonl text */
  function chatToJsonl(list) {
    return (list || []).filter(function (c) { return c && c.messages && c.messages.some(function (m) { return m.role === "user" && String(m.content).trim(); }) && c.messages.some(function (m) { return m.role === "assistant" && String(m.content).trim(); }); })
      .map(function (c) { return JSON.stringify({ messages: c.messages.filter(function (m) { return String(m.content).trim(); }) }); }).join("\n");
  }
  /** the Run tab's "it is in place" line for a finished job */
  function doneText(kind, inst) {
    if (!inst || !inst.file) return "";
    if (kind === "llm") return "✓ the model is in the LLM folder: " + inst.file + " - Settings -> LLM picks it for the assistant";
    if (kind === "vision") return "✓ the vision model is in " + inst.file + (inst.mmproj ? " (+ its mmproj)" : " - no mmproj was made") + " - Settings -> LLM -> Vision model picks it";
    if (kind === "ckpt") return "✓ the fine-tuned model is in ComfyUI: " + inst.file + " - Load Diffusion Model";
    return "✓ the LoRA is in ComfyUI: " + inst.file;
  }
  var pure = { fitText: fitText, stepText: stepText, lossOf: lossOf, KINDS: KINDS, isFt: isFt, kindOf: kindOf, presetsOf: presetsOf, chatToJsonl: chatToJsonl, doneText: doneText };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var CSS = ".ltd{display:flex;flex-direction:column;gap:6px;height:100%;min-height:0;font-size:.76rem}"
    + ".ltd .lbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.ltd .lbar select{max-width:220px}"
    + ".ltd .ltabs{display:flex;gap:4px}.ltd .ltabs button.on{border-color:var(--tiger,#f59e2c);color:var(--tiger,#f59e2c)}"
    + ".ltd .lpane{flex:1;min-height:0;overflow:auto;display:none}.ltd .lpane.on{display:block}"
    + ".ltd .lform{display:grid;grid-template-columns:150px 1fr 150px 1fr;gap:5px 10px;align-items:center}"
    + ".ltd .lform h5{grid-column:1/-1;margin:8px 0 0;color:var(--tiger,#f59e2c);font-size:.72rem;text-transform:uppercase;letter-spacing:.06em}"
    + ".ltd .lform .wide{grid-column:2/-1}.ltd .lform textarea{min-height:56px;width:100%}.ltd .lform input[type=number]{width:100%}"
    + ".ltd .lnote{color:var(--dim,#999);font-size:.7rem}.ltd .lwarn{color:#e6a23c}.ltd .lok{color:#7c7}.ltd .lbad{color:#e66}"
    + ".ltd .lgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px}"
    + ".ltd .lim{border:1px solid var(--line,#3a342a);border-radius:7px;overflow:hidden;background:var(--panel,#1b1814);display:flex;flex-direction:column;position:relative}"
    + ".ltd .lim img{width:100%;aspect-ratio:1/1;object-fit:cover;background:#111}.ltd .lim textarea{border:0;border-top:1px solid var(--line,#3a342a);min-height:58px;font-size:.7rem;resize:vertical;background:transparent;color:inherit}"
    + ".ltd .lim .lx{position:absolute;top:3px;right:3px;padding:0 5px;background:rgba(0,0,0,.6)}"
    + ".ltd .lprog{height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden}.ltd .lprog>i{display:block;height:100%;background:var(--tiger,#f59e2c);width:0}"
    + ".ltd .llog{font:11px/1.35 ui-monospace,monospace;background:#0b0b0b;border:1px solid var(--line,#333);border-radius:6px;max-height:140px;overflow:auto;padding:4px 6px;white-space:pre-wrap}"
    + ".ltd .lsamp{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:4px}.ltd .lsamp img{width:100%;border-radius:5px}"
    + ".ltd .lpick{border:1px solid var(--tiger,#f59e2c);border-radius:7px;padding:6px;margin-bottom:6px}.ltd .lpick .lgrid{grid-template-columns:repeat(auto-fill,minmax(90px,1fr))}"
    + ".ltd .lpick label{display:flex;flex-direction:column;gap:2px;font-size:.62rem;word-break:break-all}.ltd .lpick img{width:100%;aspect-ratio:1/1;object-fit:cover}"
    + ".ltd .lchat{border:1px solid var(--line,#3a342a);border-radius:7px;padding:5px 6px;margin-bottom:6px;background:var(--panel,#1b1814);position:relative}"
    + ".ltd .lchat .lturn{display:grid;grid-template-columns:72px 1fr;gap:4px;align-items:start;margin-top:3px}.ltd .lchat .lturn b{font-size:.66rem;color:var(--dim,#999);padding-top:4px}"
    + ".ltd .lchat textarea{width:100%;min-height:38px;font-size:.72rem;resize:vertical}.ltd .lchat .lx{position:absolute;top:3px;right:3px;padding:0 5px}"
    + ".ltd .lbake{border:1px solid var(--tiger,#f59e2c);border-radius:7px;padding:6px;margin-top:8px}.ltd .lbake select{max-width:340px}";
  var S = { st: null, job: null, tab: "job", ds: [], chat: [], run: null, runJob: null, timer: null, pick: null, chatT: null, bases: null };
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function jget(u) { return fetch(u).then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); }); }
  function jsend(m, u, b) { return fetch(u, { method: m, headers: { "Content-Type": "application/json" }, body: b === undefined ? undefined : JSON.stringify(b) }).then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = "HTTP " + r.status; return j; }); }); }
  function say(t, cls) { var m = $("ltMsg"); if (m) { m.textContent = t || ""; m.className = "lnote " + (cls || ""); } }
  function E(k) { return encodeURIComponent(k); }
  function cur() { return S.job ? (S.st.jobs || []).find(function (j) { return j.name === S.job; }) : null; }

  function load() {
    return jget("/api/loratrain").then(function (st) {
      if (st.error) { say(st.error, "lbad"); return; }
      if (!st || !Array.isArray(st.jobs)) return;   // no trainer answer (offline / an old server)
      S.st = st;
      if (!S.job && st.jobs.length) S.job = st.jobs[0].name;
      if (S.job && !cur()) S.job = st.jobs.length ? st.jobs[0].name : null;
      paint();
      if (S.job) loadDs();
    });
  }
  function loadDs() {
    if (!S.job) { S.ds = []; S.chat = []; paintDs(); return Promise.resolve(); }
    if (kindOf(cur()) === "llm") return jget("/api/loratrain/chat/" + E(S.job)).then(function (d) { S.chat = Array.isArray(d) ? d : []; S.ds = []; paintDs(); paintTabs(); });
    return jget("/api/loratrain/dataset/" + E(S.job)).then(function (d) { S.ds = Array.isArray(d) ? d : []; paintDs(); paintTabs(); });
  }
  function paint() {
    var st = S.st; if (!st || !$("ltBody")) return;
    var ic = { lora: "🎨", ckpt: "🧱", llm: "💬", vision: "👁" };
    $("ltJob").innerHTML = (st.jobs.length ? "" : '<option value="">- no jobs yet -</option>') + st.jobs.map(function (j) { var k = kindOf(j); return '<option value="' + esc(j.name) + '"' + (j.name === S.job ? " selected" : "") + ">" + (ic[k] || "") + " " + esc(j.name) + " (" + (k === "llm" ? (j.examples || 0) + " chats" : j.images + " pictures") + ")</option>"; }).join("");
    var a = st.aitk, u = st.unsloth || {}, ft = isFt(kindOf(cur()));
    $("ltAitk").innerHTML = ft ? (u.ready ? '<span class="lok">Unsloth ✓</span>' + (u.convert ? "" : ' <span class="lwarn">(no GGUF converter - ⚙ install again)</span>') : '<span class="lwarn">Unsloth is not installed</span> <button class="ghost" id="ltInstall" type="button" title="A queue job: Unsloth in its own Python (uv, PyTorch for your card) + llama.cpp\'s GGUF converter (~8 GB)">⚙ Install Unsloth</button>')
      : (a.ready ? '<span class="lok">ai-toolkit ✓</span>' : '<span class="lwarn">ai-toolkit is not installed</span> <button class="ghost" id="ltInstall" type="button" title="A queue job: the ai-toolkit repo, its own Python with PyTorch for your card, its requirements (~10 GB)">⚙ Install ai-toolkit</button>');
    if ($("ltInstall")) $("ltInstall").onclick = function () { var en = ft ? "unsloth" : "aitoolkit"; jsend("POST", "/api/loratrain/install", { engine: en }).then(function (j) { say(j.error || "⚙ installing " + (ft ? "Unsloth" : "ai-toolkit") + " - follow it in the Queue (it takes a while)", j.error ? "lbad" : "lok"); }); };
    paintTabs(); paintForm(); paintRun();
  }
  /** 2.585.0: the preference pairs' line (Dataset) - the count and whether this job learns from them */
  function paintPrefInfo() {
    var pj = cur(); if (!$("ltPrefInfo") || !pj) return;
    $("ltPrefInfo").textContent = (pj.prefs || 0) + " pairs" + (pj.settings.objective && pj.settings.objective !== "sft" ? " - this job learns from them (" + pj.settings.objective.toUpperCase() + ")" : " - Job ▸ Learn from ▸ Preferences uses them");
  }
  function paintTabs() {
    paintPrefInfo();
    ["job", "dataset", "run"].forEach(function (t) { var b = document.querySelector('.ltd [data-ltab="' + t + '"]'); if (b) b.classList.toggle("on", S.tab === t); var p = $("ltP_" + t); if (p) p.classList.toggle("on", S.tab === t); });
    var b = document.querySelector('.ltd [data-ltab="dataset"]'); if (b) b.textContent = "Dataset (" + (kindOf(cur()) === "llm" ? S.chat.length : S.ds.length) + ")";
    // the picture tools vs the chat tools
    var llm = kindOf(cur()) === "llm";
    if ($("ltDsPics")) $("ltDsPics").style.display = llm ? "none" : "";
    if ($("ltDsChat")) $("ltDsChat").style.display = llm ? "" : "none";
    var vis = kindOf(cur()) === "vision";
    if ($("ltCap")) $("ltCap").textContent = vis ? "✨ Answer the empty ones" : "✨ Caption the empty ones";
    if ($("ltCap")) $("ltCap").title = vis ? "The vision model you have now writes a first answer (your instruction) for every picture without one - then correct them" : "The vision model writes a caption for every picture without one";
  }
  function opt(list, v) { return list.map(function (x) { var id = x.id != null ? x.id : x, lb = x.label != null ? x.label : x; return '<option value="' + esc(id) + '"' + (String(id) === String(v) ? " selected" : "") + ">" + esc(lb) + "</option>"; }).join(""); }
  function kindRow(k) {
    return '<label for="ltKind">Type</label><select id="ltKind" class="wide" title="What this job trains">' + opt(KINDS, k) + "</select>";
  }
  function preOpts(list, v) {
    return list.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === v ? " selected" : "") + ">" + (p.rec ? "★ " : "") + esc(p.label) + " - " + p.vram_gb + " GB" + (p.checked === false ? " (check its config)" : "") + "</option>"; }).join("");
  }
  function paintForm() {
    var host = $("ltP_job"); if (!host || !S.st) return;
    var j = cur();
    if (!j) { host.innerHTML = '<div class="lnote">＋ New job to start: give it a name (letters, digits, _ -), then pick its Type - a picture LoRA, a checkpoint fine-tune, or a fine-tune of the assistant (LLM) or the vision model.</div>'; return; }
    var k = kindOf(j);
    if (isFt(k)) return paintFtForm(host, j, k);
    var s = j.settings, list = presetsOf(S.st, k), pre = list.find(function (p) { return p.id === s.preset; }) || list[0];
    var full = k === "ckpt";
    var res = [512, 768, 1024, 1280].map(function (r) { return '<label style="display:inline-flex;gap:3px;align-items:center;margin-right:8px"><input type="checkbox" data-res="' + r + '"' + (s.resolutions.indexOf(r) >= 0 ? " checked" : "") + ">" + r + "</label>"; }).join("");
    host.innerHTML = '<div class="lform">'
      + "<h5>Model</h5>" + kindRow(k)
      + '<label for="ltPre">Base model</label><select id="ltPre" class="wide">' + preOpts(list, s.preset) + "</select>"
      + '<span></span><span class="lnote ' + (S.st.gpu && S.st.gpu.vram_gb >= pre.vram_gb ? "lok" : "lwarn") + '" style="grid-column:2/-1">' + esc(fitText(pre, S.st.gpu)) + (pre.checked ? "" : " · its ai-toolkit keys are best knowledge - check 📄 YAML") + (pre.note ? "<br>" + esc(pre.note) : "") + "</span>"
      + '<label for="ltPath">Model path</label><input id="ltPath" class="wide" placeholder="' + esc(pre.model.name_or_path) + ' (blank = this; a Hugging Face repo or a local folder)" value="' + esc(s.model_path) + '">'
      + '<label for="ltTrig">Trigger word</label><input id="ltTrig" placeholder="' + (full ? "optional - a word that calls up what it learns" : "e.g. t1m_style (a made-up word)") + '" value="' + esc(s.trigger) + '">'
      + '<label title="On ▶ Start, every caption without it gets it in front"><input type="checkbox" id="ltTic"' + (s.trigger_in_captions ? " checked" : "") + "> into every caption</label><span></span>"
      + (full ? "<h5>Full fine-tune</h5>"
        + '<label><input type="checkbox" id="ltSwap"' + (s.param_swap ? " checked" : "") + "> Parameter swapping</label>"
        + '<span class="lnote">trains part of the weights each step - much less VRAM, slower (ai-toolkit, adafactor only)</span>'
        + '<label for="ltSwapF">Swapping factor</label><input id="ltSwapF" type="number" min="0.05" max="1" step="0.05" value="' + s.swap_factor + '" title="1.0 = every weight each step, lower = less VRAM">'
        + '<span class="lnote" style="grid-column:3/5">every weight of the model is trained: a NEW model (diffusion_models/trained), not an add-on - a small learning rate, fewer steps</span>'
        : "<h5>Network</h5>"
        + '<label for="ltRank">Rank (linear)</label><input id="ltRank" type="number" min="1" max="256" value="' + s.rank + '">'
        + '<label for="ltAlpha">Alpha</label><input id="ltAlpha" type="number" min="1" max="256" value="' + s.alpha + '">')
      + "<h5>Training</h5>"
      + '<label for="ltSteps">Steps</label><input id="ltSteps" type="number" min="50" max="100000" step="50" value="' + s.steps + '">'
      + '<label for="ltLr">Learning rate</label><input id="ltLr" type="number" min="0.000001" max="0.01" step="0.000001" value="' + s.lr + '">'
      + '<label for="ltBatch">Batch size</label><input id="ltBatch" type="number" min="1" max="16" value="' + s.batch + '">'
      + '<label for="ltOpt">Optimizer</label><select id="ltOpt"' + (full ? ' disabled title="a full fine-tune trains with adafactor"' : "") + ">" + opt(S.st.optimizers, s.optimizer) + "</select>"
      + '<label>Resolutions</label><div class="wide" id="ltRes">' + res + "</div>"
      + '<label for="ltDrop">Caption dropout</label><input id="ltDrop" type="number" min="0" max="0.5" step="0.01" value="' + s.caption_dropout + '">'
      + '<label><input type="checkbox" id="ltFlip"' + (s.flip ? " checked" : "") + "> flip pictures</label><span></span>"
      + '<label><input type="checkbox" id="ltLow"' + (s.low_vram ? " checked" : "") + "> Low VRAM</label>"
      + '<label style="grid-column:3/5"><input type="checkbox" id="ltQuant"' + (s.quantize ? " checked" : "") + "> Quantize the model (8-bit - less VRAM)</label>"
      + "<h5>Saving and samples</h5>"
      + '<label for="ltSave">Save every (steps)</label><input id="ltSave" type="number" min="50" step="50" value="' + s.save_every + '">'
      + '<label for="ltKeep">Keep the last</label><input id="ltKeep" type="number" min="1" max="100" value="' + s.keep + '">'
      + '<label for="ltSampEvery">Samples every</label><input id="ltSampEvery" type="number" min="0" step="50" value="' + s.sample_every + '" title="0 = no samples">'
      + "<span></span><span></span>"
      + '<label for="ltPrompts">Sample prompts</label><textarea id="ltPrompts" class="wide" placeholder="one per line - [trigger] is your trigger word">' + esc(s.sample_prompts.join("\n")) + "</textarea>"
      + '<label for="ltNotes">Notes</label><textarea id="ltNotes" class="wide" style="min-height:36px">' + esc(s.notes) + "</textarea>"
      + "</div>" + cfgBar(j, "📄 YAML", "ai-toolkit's own config - every key it knows works here");
    wireForm(host);
  }
  function paintFtForm(host, j, k) {
    var s = j.settings, list = presetsOf(S.st, k), pre = list.find(function (p) { return p.id === s.preset; }) || list[0];
    var full = s.method === "full";
    var mlab = { lora: "LoRA (16-bit) - merged into the model", qlora: "QLoRA (4-bit) - less VRAM", full: "Full fine-tune - every weight (≈4x the VRAM)" };
    host.innerHTML = '<div class="lform">'
      + "<h5>Model</h5>" + kindRow(k)
      + '<label for="ltPre">Base model</label><select id="ltPre" class="wide">' + preOpts(list, s.preset) + "</select>"
      + '<span></span><span class="lnote ' + (S.st.gpu && S.st.gpu.vram_gb >= pre.vram_gb ? "lok" : "lwarn") + '" style="grid-column:2/-1">' + esc(fitText(pre, S.st.gpu)) + " · " + esc(pre.licence || "") + (pre.note ? "<br>" + esc(pre.note) : "") + "</span>"
      + '<label for="ltPath">Model path</label><input id="ltPath" class="wide" placeholder="' + esc(pre.model) + ' (blank = this; a Hugging Face repo or a local folder)" value="' + esc(s.model_path) + '">'
      + '<label for="ltMethod">Method</label><select id="ltMethod" class="wide">' + opt(pre.methods.map(function (m) { return { id: m, label: mlab[m] || m }; }), s.method) + "</select>"
      // 2.585.0: what an LLM learns from - the answers you want (SFT) or your choices "this, not that" (DPO / ORPO)
      + (k === "llm" ? '<label for="ltObj">Learn from</label><select id="ltObj" class="wide" title="Examples = the chats in Dataset; Preferences = the pairs from 🔁 Compare LLMs (the reply you picked vs each one you did not)">'
        + opt([{ id: "sft", label: "Examples - the answers you want (SFT)" }, { id: "dpo", label: "Preferences - this, not that (DPO)" }, { id: "orpo", label: "Preferences - ORPO (no reference model, less VRAM)" }], s.objective || "sft") + "</select>"
        + (s.objective && s.objective !== "sft" ? '<label for="ltBeta">Beta</label><input id="ltBeta" type="number" min="0.01" max="1" step="0.01" value="' + (s.beta || 0.1) + '" title="how far it may move from the base model to prefer the picked replies - 0.1 is the usual; higher = stays closer to the base">'
          + '<span class="lnote" style="grid-column:3/5">' + (cur() && cur().prefs ? cur().prefs + " pairs" : "no pairs yet") + " - Dataset ▸ ⤒ From 🔁 Compare LLMs</span>" : "") : "")
      + (full ? "" : '<label for="ltRank">LoRA rank</label><input id="ltRank" type="number" min="1" max="256" value="' + s.rank + '"><label for="ltAlpha">Alpha</label><input id="ltAlpha" type="number" min="1" max="512" value="' + s.alpha + '">')
      + "<h5>Training</h5>"
      + '<label for="ltEpochs">Epochs</label><input id="ltEpochs" type="number" min="1" max="100" value="' + (s.epochs || 2) + '" title="times through every example">'
      + '<label for="ltMax">Max steps</label><input id="ltMax" type="number" min="0" max="1000000" value="' + s.max_steps + '" title="0 = the epochs decide">'
      + '<label for="ltLr">Learning rate</label><input id="ltLr" type="number" min="0.000001" max="0.01" step="0.000001" value="' + s.lr + '">'
      + '<label for="ltBatch">Batch size</label><input id="ltBatch" type="number" min="1" max="16" value="' + s.batch + '">'
      + '<label for="ltAcc">Gradient accumulation</label><input id="ltAcc" type="number" min="1" max="64" value="' + s.grad_accum + '">'
      + '<label for="ltSeq">Max length (tokens)</label><input id="ltSeq" type="number" min="256" max="32768" step="256" value="' + s.max_seq + '">'
      + '<label for="ltWarm">Warm-up steps</label><input id="ltWarm" type="number" min="0" max="10000" value="' + s.warmup + '">'
      + '<label for="ltSaveE">Checkpoint every</label><input id="ltSaveE" type="number" min="0" step="50" value="' + s.save_every + '" title="steps - 0 = only the end">'
      + "<h5>" + (k === "llm" ? "The assistant" : "The vision model") + "</h5>"
      + (k === "vision" ? '<label for="ltInstr">Instruction</label><textarea id="ltInstr" class="wide" placeholder="the question every picture answers">' + esc(s.instruction) + "</textarea>" : "")
      + '<label for="ltSys">System prompt</label><textarea id="ltSys" class="wide" placeholder="optional - who the model is, how it answers (added to every example)">' + esc(s.system) + "</textarea>"
      + '<label for="ltQ">Model file size</label><select id="ltQ">' + opt((S.st.quants || []).map(function (q) { return { id: q, label: q.toUpperCase() + (q === "q4_k_m" ? " (small, the usual)" : q === "q8_0" ? " (near-lossless)" : q === "f16" ? " (full size)" : "") }; }), s.quant) + "</select>"
      + '<span class="lnote" style="grid-column:3/5">' + (k === "llm" ? "the .gguf goes into the LLM folder" : "the .gguf + its mmproj go into the vision folder") + "</span>"
      + '<label for="ltNotes">Notes</label><textarea id="ltNotes" class="wide" style="min-height:36px">' + esc(s.notes) + "</textarea>"
      + "</div>" + cfgBar(j, "📄 Config", "Unsloth's run as JSON (scripts/ft_unsloth.py) - edit any value");
    wireForm(host);
    $("ltMethod").onchange = function () { save().then(function () { paint(); }); };
    if ($("ltObj")) $("ltObj").onchange = function () { save().then(function () { paint(); paintRun(); }); };
  }
  function cfgBar(j, label, hint) {
    return '<div class="lbar" style="margin-top:8px"><button type="button" id="ltSaveBtn">💾 Save</button><button type="button" class="ghost" id="ltYamlBtn">' + label + (j.custom_yaml ? " (yours)" : "") + "</button></div>"
      + '<div id="ltYaml" style="display:none;margin-top:6px"><textarea id="ltYamlTxt" spellcheck="false" style="width:100%;min-height:260px;font:11px/1.35 ui-monospace,monospace"></textarea>'
      + '<div class="lbar"><button type="button" class="ghost" id="ltYamlUse" title="Start with this instead of the one made from the form">✎ Use mine</button><button type="button" class="ghost" id="ltYamlReset">↺ Back to the generated one</button>'
      + '<span class="lnote">' + esc(hint) + "</span></div></div>";
  }
  function wireForm(host) {
    $("ltKind").onchange = function () { var s = formSettings(); s.kind = $("ltKind").value; s.preset = ""; s.steps = 0; s.lr = 0; s.method = ""; postSettings(s).then(function () { paint(); loadDs(); }); };
    $("ltPre").onchange = function () { save().then(function () { paint(); }); };
    $("ltSaveBtn").onclick = function () { save().then(function (r) { if (r && !r.error) say("💾 saved", "lok"); }); };
    $("ltYamlBtn").onclick = function () {
      var box = $("ltYaml"); var on = box.style.display === "none"; box.style.display = on ? "" : "none";
      if (on) save().then(function () { return jget("/api/loratrain/yaml/" + E(S.job)); }).then(function (y) { $("ltYamlTxt").value = (y && y.yaml) || ""; });
    };
    $("ltYamlUse").onclick = function () { jsend("POST", "/api/loratrain/yaml/" + E(S.job), { yaml: $("ltYamlTxt").value }).then(function (r) { if (r.error) { say(r.error, "lbad"); return; } say("✎ yours is used at ▶ Start", "lok"); load(); }); };
    $("ltYamlReset").onclick = function () { jsend("POST", "/api/loratrain/yaml/" + E(S.job), { yaml: "" }).then(function () { return jget("/api/loratrain/yaml/" + E(S.job)); }).then(function (y) { $("ltYamlTxt").value = y.yaml || ""; say("↺ made from the form again"); load(); }); };
    host.querySelectorAll("input,select,textarea").forEach(function (el) { el.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
  }
  function formSettings() {
    var j = cur(); if (!j || !$("ltPre")) return j ? Object.assign({}, j.settings) : null;
    var v = function (id) { return $(id) ? $(id).value : undefined; };
    var k = kindOf(j);
    if (isFt(k)) {
      return { name: j.name, kind: k, preset: v("ltPre"), model_path: v("ltPath"), method: v("ltMethod"), rank: $("ltRank") ? +v("ltRank") : j.settings.rank, alpha: $("ltAlpha") ? +v("ltAlpha") : j.settings.alpha,
        epochs: +v("ltEpochs"), max_steps: +v("ltMax"), lr: +v("ltLr"), batch: +v("ltBatch"), grad_accum: +v("ltAcc"), max_seq: +v("ltSeq"), warmup: +v("ltWarm"),
        save_every: +v("ltSaveE"), instruction: $("ltInstr") ? v("ltInstr") : "", system: v("ltSys"), quant: v("ltQ"), notes: v("ltNotes"),
        objective: $("ltObj") ? v("ltObj") : j.settings.objective, beta: $("ltBeta") ? +v("ltBeta") : j.settings.beta };
    }
    return { name: j.name, kind: k, preset: v("ltPre"), model_path: v("ltPath"), trigger: v("ltTrig"), trigger_in_captions: $("ltTic").checked,
      rank: $("ltRank") ? +v("ltRank") : j.settings.rank, alpha: $("ltAlpha") ? +v("ltAlpha") : j.settings.alpha, steps: +v("ltSteps"), lr: +v("ltLr"), batch: +v("ltBatch"), optimizer: v("ltOpt"),
      resolutions: [].slice.call(document.querySelectorAll("#ltRes input:checked")).map(function (c) { return +c.dataset.res; }),
      caption_dropout: +v("ltDrop"), flip: $("ltFlip").checked, low_vram: $("ltLow").checked, quantize: $("ltQuant").checked,
      param_swap: $("ltSwap") ? $("ltSwap").checked : false, swap_factor: $("ltSwapF") ? +v("ltSwapF") : 0.9,
      save_every: +v("ltSave"), keep: +v("ltKeep"), sample_every: +v("ltSampEvery"), sample_prompts: v("ltPrompts").split(/\r?\n/), notes: v("ltNotes") };
  }
  function postSettings(s) { return jsend("POST", "/api/loratrain/job", { settings: s }).then(function (r) { if (r.error) say(r.error, "lbad"); else { S.st.jobs = r.jobs; } return r; }); }
  function save() {
    var s = formSettings(); if (!s) return Promise.resolve(null);
    // a new base model starts from its own steps / learning rate
    var j = cur(); if (j && s.preset !== j.settings.preset) { s.steps = 0; s.lr = 0; s.method = ""; }
    if (j && isFt(s.kind) && (s.method !== j.settings.method || (s.objective || "sft") !== (j.settings.objective || "sft"))) s.lr = 0;   // 2.585.0: preferences want a smaller rate
    return postSettings(s);
  }
  function newJob() {
    // the app's own question box (static/floatpanels.js) - Electron has no window.prompt
    var ask = root.H3Panels && H3Panels.ask ? H3Panels.ask("New training job", "A name for it (letters, digits, _ -) - then pick its Type in the Job tab:", "my_lora") : Promise.resolve(window.prompt ? prompt("A name for the job:", "my_lora") : "my_lora");
    Promise.resolve(ask).then(function (n) {
      if (!n) return;
      jsend("POST", "/api/loratrain/job", { settings: { name: n } }).then(function (r) {
        if (r.error) { say(r.error, "lbad"); return; }
        S.job = r.settings.name; S.st.jobs = r.jobs; S.tab = "job"; paint(); loadDs(); say("＋ " + S.job + " - pick its Type and base model, then add the Dataset", "lok");
      });
    });
  }
  function delJob() {
    if (!S.job) return;
    var ok = typeof appConfirm === "function" ? appConfirm("Delete the job " + S.job + " - its dataset and checkpoints? (a LoRA / model already copied into ComfyUI or the LLM folder stays)") : Promise.resolve(confirm("Delete " + S.job + "?"));
    Promise.resolve(ok).then(function (y) { if (!y) return; jsend("DELETE", "/api/loratrain/job/" + E(S.job)).then(function () { S.job = null; load(); }); });
  }

  /* ---- dataset */
  function paintChat() {
    var host = $("ltChatList"); if (!host) return;
    var shown = S.chat.slice(0, 200);
    host.innerHTML = shown.length ? shown.map(function (c, i) {
      return '<div class="lchat" data-ci="' + i + '"><button class="ghost lx" type="button" data-crm title="Remove this example">✕</button>' + c.messages.map(function (m, t) {
        return '<div class="lturn"><b>' + (m.role === "user" ? "They ask" : m.role === "assistant" ? "It answers" : "System") + '</b><textarea data-ct="' + t + '" placeholder="' + (m.role === "user" ? "the question / the request" : "the answer you want") + '">' + esc(m.content) + "</textarea></div>";
      }).join("") + '<button type="button" class="ghost" data-cturn style="margin-top:3px;font-size:.66rem">＋ a follow-up turn</button></div>';
    }).join("") + (S.chat.length > 200 ? '<div class="lnote">showing the first 200 of ' + S.chat.length + " - ⤓ chat.jsonl has them all</div>" : "")
      : '<div class="lnote">No examples yet - ＋ Example, or ⤒ Import a JSONL / CSV.</div>';
    var n = S.chat.length, turns = S.chat.reduce(function (a, c) { return a + c.messages.filter(function (m) { return m.role === "assistant"; }).length; }, 0);
    if ($("ltChatInfo")) $("ltChatInfo").textContent = n + " examples · " + turns + " answers";
    paintPrefInfo();
    if ($("ltChatDl")) $("ltChatDl").href = "data:application/x-ndjson;charset=utf-8," + encodeURIComponent(chatToJsonl(S.chat));
  }
  function saveChat() {
    clearTimeout(S.chatT);
    S.chatT = setTimeout(function () {
      fetch("/api/loratrain/chat/" + E(S.job) + "/import?replace=1&file=chat.jsonl", { method: "POST", headers: { "Content-Type": "text/plain" }, body: chatToJsonl(S.chat) })
        .then(function (r) { return r.json(); }).then(function (r) { if (r.error) say(r.error, "lbad"); else { say("💾 " + r.examples + " examples saved", "lok"); var j = cur(); if (j) j.examples = r.examples; paintTabs(); } });
    }, 500);
  }
  function paintDs() {
    if (kindOf(cur()) === "llm") { paintChat(); return; }
    var host = $("ltDsGrid"); if (!host) return;
    if (!S.job) { host.innerHTML = '<div class="lnote">Pick or make a job first.</div>'; return; }
    var vis = kindOf(cur()) === "vision";
    host.innerHTML = S.ds.length ? S.ds.map(function (d) {
      return '<div class="lim" data-file="' + esc(d.file) + '"><img loading="lazy" alt="" src="/api/loratrain/img/' + E(S.job) + "/" + E(d.file) + "?s=" + d.size + '">'
        + '<button class="ghost lx" type="button" data-rm title="Take it out of the dataset">✕</button>'
        + '<textarea data-cap placeholder="' + (vis ? "the answer the vision model should give for this picture" : "caption - what is in the picture (the trigger word is added at ▶ Start)") + '">' + esc(d.caption) + "</textarea></div>";
    }).join("") : '<div class="lnote" style="grid-column:1/-1">' + (vis ? "No pictures yet. Add pictures and write, under each, the answer you want for the job's instruction (Job tab) - 50-500 pictures teach a captioning style." : "No pictures yet. 10-30 varied pictures of the subject / style (different angles, light, backgrounds) train best.") + "</div>";
    var nc = S.ds.filter(function (d) { return !d.caption.trim(); }).length;
    $("ltDsInfo").textContent = S.ds.length + " pictures" + (nc ? " · " + nc + " without a caption" : " · all captioned");
  }
  function uploadFiles(files) {
    var list = [].slice.call(files || []).filter(function (f) { return /^image\//.test(f.type); });
    var i = 0;
    var next = function () {
      if (i >= list.length) { say("＋ " + list.length + " picture(s) added", "lok"); loadDs(); load(); return; }
      var f = list[i++]; say("adding " + f.name + " (" + i + " / " + list.length + ")");
      fetch("/api/loratrain/dataset/" + E(S.job) + "/add?file=" + E(f.name), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: f })
        .then(function () { next(); }, function () { next(); });
    };
    next();
  }
  function pickGallery() {
    var box = $("ltPick");
    if (box.style.display !== "none") { box.style.display = "none"; return; }
    box.style.display = ""; box.innerHTML = '<div class="lnote">reading the gallery…</div>';
    jget("/api/outputs?kind=images").then(function (list) {
      var files = (Array.isArray(list) ? list : (list.files || [])).filter(function (f) { return /\.(png|jpe?g|webp)$/i.test(f.name); }).slice(0, 300);
      box.innerHTML = '<div class="lbar"><b>🖼 From the gallery</b><span class="lnote">' + files.length + " pictures</span><button type=\"button\" id=\"ltPickAdd\">＋ Add the ticked ones</button><button type=\"button\" class=\"ghost\" id=\"ltPickClose\">Close</button></div>"
        + '<div class="lgrid">' + files.map(function (f) { return '<label><img loading="lazy" alt="" src="/outputs/' + E(f.name) + '"><span><input type="checkbox" data-pick="' + esc(f.name) + '"> ' + esc(f.name) + "</span></label>"; }).join("") + "</div>";
      $("ltPickClose").onclick = function () { box.style.display = "none"; };
      $("ltPickAdd").onclick = function () {
        var names = [].slice.call(box.querySelectorAll("[data-pick]:checked")).map(function (c) { return c.dataset.pick; });
        if (!names.length) return;
        jsend("POST", "/api/loratrain/dataset/" + E(S.job) + "/from", { names: names }).then(function (r) { say(r.error || "＋ " + (r.added || []).length + " picture(s) from the gallery", r.error ? "lbad" : "lok"); box.style.display = "none"; loadDs(); load(); });
      };
    });
  }
  function autoCaption(all) {
    jsend("POST", "/api/loratrain/dataset/" + E(S.job) + "/autocaption", { overwrite: !!all }).then(function (r) {
      if (r.error) { say(r.error, "lbad"); return; }
      var poll = function () {
        jget("/api/loratrain/captioning").then(function (c) {
          say("✨ captioning " + c.done + " / " + c.total + (c.error ? " · " + c.error : ""), c.error ? "lwarn" : "");
          if (c.busy) setTimeout(poll, 1500); else { say("✨ captions written (" + c.done + ")" + (c.error ? " - " + c.error : ""), c.error ? "lwarn" : "lok"); loadDs(); }
        });
      };
      poll();
    });
  }

  /* ---- run */
  function paintRun() {
    var host = $("ltP_run"); if (!host || !S.st) return;
    var j = cur();
    if (!j) { host.innerHTML = '<div class="lnote">Pick or make a job first.</div>'; return; }
    var r = j.run || {}, k = kindOf(j), ft = isFt(k), rj = S.runJob;
    var pref = k === "llm" && j.settings.objective && j.settings.objective !== "sft";    // 2.585.0: DPO / ORPO learn from the pairs
    var a = ft ? (S.st.unsloth || {}) : S.st.aitk, have = k === "lora" || k === "ckpt" ? j.images : pref ? (j.prefs || 0) : j.examples;
    var eng = ft ? "Unsloth" : "ai-toolkit", what = pref ? "preference pairs (" + j.settings.objective.toUpperCase() + ")" : k === "llm" ? "chats" : k === "vision" ? "pictures with an answer" : "pictures";
    var live = rj && (rj.status === "running" || rj.status === "queued");
    var lines = rj ? (rj.log || []).slice(-14) : [];
    var prog = rj && rj.progress ? rj.progress : null;
    host.innerHTML = '<div class="lbar"><button type="button" id="ltStart"' + (a.ready && have && !live ? "" : " disabled") + ' title="' + esc(!a.ready ? "Install " + eng + " first" : !have ? "Add " + what + " first" : "Queue the training run") + '">▶ Start ' + (k === "lora" ? "training" : "the fine-tune") + "</button>"
      + (live ? '<button type="button" class="ghost" id="ltStop">⏹ Stop</button>' : "")
      + '<a class="ghost" href="/api/loratrain/export/' + E(j.name) + '" download style="text-decoration:none;padding:3px 8px;border:1px solid var(--line,#444);border-radius:5px;color:inherit" title="config.yaml + the dataset as a .zip - run it with ai-toolkit on another machine (a RunPod pod)">⤓ Export job</a>'
      + '<span class="lnote">' + esc((ft ? (j.settings.max_steps ? j.settings.max_steps + " steps" : j.settings.epochs + " epochs") + " · " + j.settings.method : j.settings.steps + " steps") + " · " + have + " " + what + " · " + ((presetsOf(S.st, k).find(function (p) { return p.id === j.settings.preset; }) || {}).label || "")) + "</span></div>"
      + (rj ? '<div style="margin-top:6px"><b>' + esc(rj.status) + "</b> " + esc(stepText(prog ? { step: prog.step, total: prog.total } : null)) + (lossOf(lines) != null ? " · loss " + lossOf(lines) : "")
        + '<div class="lprog"><i style="width:' + (prog && prog.pct != null ? prog.pct : rj.status === "done" ? 100 : 0) + '%"></i></div><div class="llog">' + esc(lines.join("\n")) + "</div></div>" : "")
      + (r.installed ? '<div class="lok" style="margin-top:6px">' + esc(doneText(k, r.installed)) + (ft ? "" : ' - <a href="#" id="ltOpenMm">🧩 the Model manager</a>') + "</div>" : "")
      + (k === "lora" && r.installed ? '<div class="lbake" id="ltBake"><b>⧉ Bake into a new checkpoint</b> <span class="lnote">the LoRA merged into its base model for good - a new model file, any card (ComfyUI does it)</span>'
        + '<div class="lbar" style="margin-top:4px"><label for="ltBBase">Base</label><select id="ltBBase"><option value="">reading ComfyUI\'s models…</option></select>'
        + '<label for="ltBStr">Strength</label><input id="ltBStr" type="number" min="-2" max="2" step="0.05" value="1" style="width:70px">'
        + '<label for="ltBOut">Name</label><input id="ltBOut" value="' + esc(j.name + "_merged") + '" style="width:160px"><button type="button" id="ltBGo">⧉ Bake</button></div></div>' : "")
      + (r.checkpoints && r.checkpoints.length ? '<div class="lnote" style="margin-top:6px">checkpoints: ' + esc(r.checkpoints.join(", ")) + "</div>" : "")
      + (r.samples && r.samples.length ? '<div style="margin-top:6px"><b>Samples</b> <span class="lnote">(newest last)</span><div class="lsamp">' + r.samples.slice(-24).map(function (f) {
        return /\.(mp4|webm)$/i.test(f) ? '<video src="/api/loratrain/sample/' + E(j.name) + "/" + E(f) + '" muted loop controls></video>' : '<img loading="lazy" alt="' + esc(f) + '" title="' + esc(f) + '" src="/api/loratrain/sample/' + E(j.name) + "/" + E(f) + '">';
      }).join("") + "</div></div>" : "");
    if ($("ltStart")) $("ltStart").onclick = function () {
      save().then(function () { return jsend("POST", "/api/loratrain/start/" + E(j.name)); }).then(function (res) {
        if (res.error) { say(res.error, "lbad"); return; }
        S.runJob = res.job; say("▶ queued - " + (res.custom_yaml ? "with your YAML" : "the config made from the form"), "lok"); follow(); paintRun();
      });
    };
    if ($("ltStop")) $("ltStop").onclick = function () { jsend("POST", "/api/jobs/" + E(rj.id) + "/cancel").then(function () { follow(); }); };
    if ($("ltOpenMm")) $("ltOpenMm").onclick = function (e) { e.preventDefault(); if (root.H3ModelMgr) { H3ModelMgr.show(true); H3ModelMgr.load(true); } };
    if ($("ltBake")) paintBake(j);
  }
  /** ⧉ bake: ComfyUI's checkpoints + diffusion models, the LoRA's own family first */
  function paintBake(j) {
    var fill = function (list) {
      var sel = $("ltBBase"); if (!sel) return;
      var fam = ((presetsOf(S.st, "lora").find(function (p) { return p.id === j.settings.preset; }) || {}).family || "").toLowerCase();
      var same = function (m) { return String(m.family || "").toLowerCase() === fam ? 1 : 0; };
      var sorted = list.slice().sort(function (x, y) { return same(y) - same(x) || String(x.name).localeCompare(String(y.name)); });
      sel.innerHTML = sorted.length ? sorted.map(function (m) { return '<option value="' + esc(m.cat + "|" + m.name) + '">' + (same(m) ? "★ " : "") + esc(m.name) + " (" + (m.cat === "checkpoints" ? "checkpoint" : "diffusion model") + (m.family ? ", " + m.family : "") + ")</option>"; }).join("")
        : '<option value="">no checkpoints / diffusion models in ComfyUI yet</option>';
    };
    if (S.bases) fill(S.bases); else jget("/api/loratrain/bases").then(function (l) { S.bases = Array.isArray(l) ? l : []; fill(S.bases); });
    $("ltBGo").onclick = function () {
      var v = $("ltBBase").value; if (!v) { say("pick the base model it was trained for", "lwarn"); return; }
      var cut = v.indexOf("|");
      jsend("POST", "/api/loratrain/merge/" + E(j.name), { cat: v.slice(0, cut), base: v.slice(cut + 1), strength: +$("ltBStr").value || 1, out: $("ltBOut").value })
        .then(function (r) { if (r.error) { say(r.error, "lbad"); return; } S.runJob = r.job; S.bases = null; say("⧉ baking - follow it here or in the Queue", "lok"); follow(); paintRun(); });
    };
  }
  function follow() {
    clearTimeout(S.timer);
    if (!S.runJob) return;
    jget("/api/jobs/" + E(S.runJob.id) + "?log_from=0").then(function (d) {
      if (d && d.id) S.runJob = d;
      var live = d && (d.status === "running" || d.status === "queued");
      if (live) S.timer = setTimeout(follow, 2500); else load();
      paintRun();
    });
  }

  function build() {
    var body = document.createElement("div"); body.className = "ltd"; body.id = "ltBody";
    body.innerHTML = '<div class="lbar"><label for="ltJob">Job</label><select id="ltJob" aria-label="LoRA job"></select><button type="button" class="ghost" id="ltNew">＋ New job</button>'
      + '<button type="button" class="ghost" id="ltDel" title="Delete this job">🗑</button><span id="ltAitk" style="margin-left:auto"></span></div>'
      + '<div class="ltabs"><button type="button" class="ghost" data-ltab="job">Job</button><button type="button" class="ghost" data-ltab="dataset">Dataset</button><button type="button" class="ghost" data-ltab="run">Run & samples</button></div>'
      + '<div class="lnote" id="ltMsg" aria-live="polite"></div>'
      + '<div class="lpane" id="ltP_job"></div>'
      + '<div class="lpane" id="ltP_dataset"><div id="ltDsPics"><div class="lbar"><button type="button" id="ltAdd">＋ Pictures…</button><input type="file" id="ltFile" accept="image/png,image/jpeg,image/webp" multiple hidden>'
      + '<button type="button" class="ghost" id="ltGal">🖼 From the gallery</button><button type="button" class="ghost" id="ltCap" title="The vision model writes a caption for every picture without one">✨ Caption the empty ones</button>'
      + '<button type="button" class="ghost" id="ltCapAll" title="Write every caption again">✨ all</button><span class="lnote" id="ltDsInfo"></span></div>'
      + '<div class="lpick" id="ltPick" style="display:none"></div><div class="lgrid" id="ltDsGrid"></div></div>'
      // 2.521.0: an LLM job's examples - chats (user / assistant turns), typed here or imported
      + '<div id="ltDsChat" style="display:none"><div class="lbar"><button type="button" id="ltChatAdd">＋ Example</button><button type="button" class="ghost" id="ltChatImp" title="JSONL / JSON ({messages}, ShareGPT conversations, instruction / output, prompt / completion, question / answer) or a CSV with a header row">⤒ Import…</button>'
      + '<input type="file" id="ltChatFile" accept=".jsonl,.json,.csv,.txt" hidden><label class="lnote"><input type="checkbox" id="ltChatRep"> replace what is here</label>'
      + '<a class="ghost" id="ltChatDl" download="chat.jsonl" style="text-decoration:none;padding:3px 8px;border:1px solid var(--line,#444);border-radius:5px;color:inherit">⤓ chat.jsonl</a><span class="lnote" id="ltChatInfo"></span></div>'
      // 2.585.0: the preference pairs (DPO / ORPO) - 🔁 Compare LLMs: the reply picked vs each one not picked
      + '<div class="lbar" style="margin:4px 0;border:1px solid var(--line,#3a342a);border-radius:7px;padding:5px 6px"><b style="font-size:.72rem">🔁 Preference pairs</b><span class="lnote" id="ltPrefInfo"></span>'
      + '<button type="button" class="ghost" id="ltPrefFrom" title="Every decided round of 🔁 Compare LLMs: the picked reply as an example (chat) + one pair per reply not picked - with the full prompt the LLMs were sent">⤒ From 🔁 Compare LLMs</button>'
      + '<button type="button" class="ghost" id="ltPrefDl" title="the pairs as prefs.jsonl ({prompt, chosen, rejected})">⤓ prefs.jsonl</button><button type="button" class="ghost" id="ltPrefClr">🗑 Clear the pairs</button></div>'
      + '<div class="lnote" style="margin:2px 0 6px">Each example is a short conversation: what someone asks and the answer you want the assistant to give. 100+ good examples teach a style or a task; a few thousand teach knowledge. Preference pairs (Job ▸ Learn from ▸ Preferences) teach your taste: a few hundred picks.</div><div id="ltChatList"></div></div></div>'
      + '<div class="lpane" id="ltP_run"></div>';
    return body;
  }
  function wire() {
    $("ltJob").onchange = function (e) { S.job = e.target.value || null; S.runJob = null; paint(); loadDs(); };
    $("ltNew").onclick = newJob; $("ltDel").onclick = delJob;
    document.querySelectorAll(".ltd [data-ltab]").forEach(function (b) { b.onclick = function () { if (S.tab === "job" && b.dataset.ltab !== "job") save(); S.tab = b.dataset.ltab; paintTabs(); if (S.tab === "run") { paintRun(); load(); } }; });   // the Run tab reads the counts again (answers typed since)
    $("ltAdd").onclick = function () { if (S.job) $("ltFile").click(); };
    $("ltFile").onchange = function (e) { uploadFiles(e.target.files); e.target.value = ""; };
    $("ltGal").onclick = function () { if (S.job) pickGallery(); };
    $("ltCap").onclick = function () { if (S.job) autoCaption(false); };
    $("ltCapAll").onclick = function () { if (S.job) autoCaption(true); };
    var grid = $("ltDsGrid");
    grid.addEventListener("change", function (e) {
      if (!e.target.hasAttribute("data-cap")) return;
      var f = e.target.closest(".lim").dataset.file;
      jsend("POST", "/api/loratrain/dataset/" + E(S.job) + "/caption", { file: f, caption: e.target.value }).then(function (r) { if (r.error) say(r.error, "lbad"); else { var d = S.ds.find(function (x) { return x.file === f; }); if (d) d.caption = e.target.value; paintDsInfo(); } });
    });
    grid.addEventListener("keydown", function (e) { e.stopPropagation(); });
    grid.addEventListener("click", function (e) {
      if (!e.target.hasAttribute("data-rm")) return;
      var f = e.target.closest(".lim").dataset.file;
      jsend("DELETE", "/api/loratrain/dataset/" + E(S.job) + "/" + E(f)).then(function () { loadDs(); load(); });
    });
    // 2.521.0: the chat editor
    $("ltChatAdd").onclick = function () { if (!S.job) return; S.chat.unshift({ messages: [{ role: "user", content: "" }, { role: "assistant", content: "" }] }); paintChat(); var t = document.querySelector('#ltChatList textarea'); if (t) t.focus(); };
    $("ltChatImp").onclick = function () { if (S.job) $("ltChatFile").click(); };
    // 2.585.0: the preference pairs
    $("ltPrefFrom").onclick = function () {
      if (!S.job) return;
      jsend("POST", "/api/llmarena/to-trainer", { job: S.job, what: "both", include_system: true }).then(function (r) {
        if (r.error) { say(r.error, "lbad"); return; }
        say("⤒ from " + r.rounds + " decided round(s): +" + r.chats_added + " examples, +" + r.prefs_added + " pairs" + (r.longest_tokens > (r.max_seq || 0) ? " - the longest is ≈" + r.longest_tokens + " tokens: raise Job ▸ Max length (longer ones are left out)" : ""), "lok");
        load();
      });
    };
    $("ltPrefDl").onclick = function () {
      if (!S.job) return;
      jget("/api/loratrain/prefs/" + E(S.job)).then(function (l) {
        var a = document.createElement("a"); a.download = "prefs.jsonl";
        a.href = "data:application/x-ndjson;charset=utf-8," + encodeURIComponent((Array.isArray(l) ? l : []).map(function (x) { return JSON.stringify(x); }).join("\n") + "\n");
        document.body.appendChild(a); a.click(); a.remove();
      });
    };
    $("ltPrefClr").onclick = function () {
      if (!S.job) return;
      var c = root.appConfirm ? root.appConfirm("Delete every preference pair of " + S.job + "? (🔁 Compare LLMs keeps its rounds - ⤒ brings them back)") : Promise.resolve(window.confirm("Clear the pairs?"));
      Promise.resolve(c).then(function (ok) { if (ok) jsend("DELETE", "/api/loratrain/prefs/" + E(S.job)).then(function () { say("🗑 the pairs are cleared"); load(); }); });
    };
    $("ltChatFile").onchange = function (e) {
      var f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
      say("importing " + f.name + "…");
      f.text().then(function (txt) {
        return fetch("/api/loratrain/chat/" + E(S.job) + "/import?file=" + E(f.name) + ($("ltChatRep").checked ? "&replace=1" : ""), { method: "POST", headers: { "Content-Type": "text/plain" }, body: txt }).then(function (r) { return r.json(); });
      }).then(function (r) { say(r.error || "⤒ " + r.added + " examples from " + f.name + " (" + r.format + ")" + (r.skipped ? " · " + r.skipped + " skipped (no question + answer)" : "") + " - " + r.examples + " in all", r.error ? "lbad" : "lok"); loadDs(); load(); });
    };
    var cl = $("ltChatList");
    cl.addEventListener("input", function (e) {
      var t = e.target; if (!t.hasAttribute("data-ct")) return;
      var c = S.chat[+t.closest(".lchat").dataset.ci]; if (!c) return;
      c.messages[+t.dataset.ct].content = t.value; saveChat();
    });
    cl.addEventListener("click", function (e) {
      var box = e.target.closest(".lchat"); if (!box) return;
      var i = +box.dataset.ci;
      if (e.target.hasAttribute("data-crm")) { S.chat.splice(i, 1); paintChat(); saveChat(); paintTabs(); }
      else if (e.target.hasAttribute("data-cturn")) { S.chat[i].messages.push({ role: "user", content: "" }, { role: "assistant", content: "" }); paintChat(); }
    });
    cl.addEventListener("keydown", function (e) { e.stopPropagation(); });
    // pictures dropped on the dataset
    var ds = $("ltP_dataset");
    ds.addEventListener("dragover", function (e) { if (e.dataTransfer && [].slice.call(e.dataTransfer.types || []).indexOf("Files") >= 0) e.preventDefault(); });
    ds.addEventListener("drop", function (e) { if (!S.job || !e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); uploadFiles(e.dataTransfer.files); });
  }
  function paintDsInfo() { var nc = S.ds.filter(function (d) { return !d.caption.trim(); }).length; $("ltDsInfo").textContent = S.ds.length + " pictures" + (nc ? " · " + nc + " without a caption" : " · all captioned"); }
  function start() {
    if (!window.SecFloat || !SecFloat.add || !SecFloat.started || !$("tP")) { setTimeout(start, 150); return; }
    if ($("ltBody")) return;
    if (!$("ltCss")) { var st = document.createElement("style"); st.id = "ltCss"; st.textContent = CSS; document.head.appendChild(st); }
    var body = build();
    var btn = document.createElement("button"); btn.type = "button"; btn.id = "ltBtn"; btn.textContent = "🎓 LoRA";
    btn.title = "LoRA & fine-tune trainer - LoRAs and checkpoint fine-tunes of picture models (ai-toolkit), fine-tunes of the assistant and the vision model (Unsloth)";
    var anchor = $("mmBtn") || $("negBtn") || $("tP"); anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    SecFloat.add({ id: "loratrain", title: "LoRA & fine-tune trainer", w: 880, h: 740, body: body, button: btn, onShow: function () { load(); } });
    wire();
    setTimeout(function () { if (!S.st) load(); }, 4000);          // ready before the first look
  }
  root.H3LoraTrain = Object.assign({ load: load, state: function () { return S; }, show: function (on) { return window.SecFloat && SecFloat.show ? SecFloat.show("loratrain", on) : false; }, select: function (n) { S.job = n; paint(); return loadDs(); } }, pure);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
