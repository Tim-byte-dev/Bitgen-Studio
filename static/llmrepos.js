/* bitGen Studio — static/llmrepos.js (2.782.0): THE LLM DIALOG FOR YOUR POD (window.H3LlmRepos; lib/llmRepos.js, routes/llmRepos.js,
 * lib/podLlm.js).
 * Tim (verbatim): "can we upload llama.cpp to the pod and select an llm from a hf repo to send to the pod. ask the user if they
 * want to save the repo. if they save it add it to a list of repos with the llm name. if user selects runpod for llm then show only
 * this list in the llm dropdown, same with vllm. Check with user if they want to create a separate pod for the llm/vllm or use the
 * existing one. we should be able to run our llm, vllm,image and video of 1 pod by clearing vram before a new model loads and
 * increasing the space"
 *   Opened from the prompt docker's LLM / Vision list on a RunPod pod ("＋ From Hugging Face… / your list"):
 *     LLM | Vision LLM tabs; YOUR LIST (Use / 🗑); FROM HUGGING FACE: a repo (owner/name or its address) -> its GGUFs by size
 *     and quantisation (a split one as one), the vision projector (mmproj) for a vision LLM, the name; RUN IT ON: one of your pods
 *     (sharing its card with pictures and video: bitGen swaps the models - ☐ off) or a new pod just for it; the pod's volume made
 *     bigger; ▶ Send to the pod -> then "Keep it in your list?" (Save / Not now); how far the pod is.
 * Pure (Node: scripts/test-llmrepos782.js): gb, defaultModel, needGb.
 */
(function (root) {
  "use strict";
  function gb(n) { n = +n || 0; return n >= 1e9 ? (n / 1e9).toFixed(1) + " GB" : n >= 1e6 ? Math.round(n / 1e6) + " MB" : n ? Math.round(n / 1e3) + " KB" : "?"; }
  /** the GGUF ticked first: the list is sorted best-first by the server (Q4_K_M …) */
  function defaultModel(models) { return (models && models[0]) ? models[0].file : ""; }
  /** a volume that fits the model with room: the model + the mmproj + 20 GB, in 10s, at least 50 */
  function needGb(size, mm) { var n = Math.ceil(((+size || 0) + (+mm || 0)) / 1e9) + 20; return Math.max(50, Math.ceil(n / 10) * 10); }
  var pure = { gb: gb, defaultModel: defaultModel, needGb: needGb };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document, S = { kind: "llm", d: null, data: null, hf: null, file: "", mm: "", name: "", pod: "", ask: null, msg: "", busy: false, poll: 0 };
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function getJ(u) { return root.fetch(u).then(function (r) { return r.json(); }).catch(function (e) { return { error: String(e) }; }); }
  function postJ(u, b) { return root.fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }).then(function (r) { return r.json(); }).catch(function (e) { return { error: String(e) }; }); }
  function css() {
    if (doc.getElementById("lrcss")) return;
    var s = doc.createElement("style"); s.id = "lrcss";
    s.textContent = "dialog.lrdlg{width:min(680px,95vw);max-height:90vh;overflow:auto;padding:14px 16px}"
      + "dialog.lrdlg:not([open]){display:none}.lrdlg h2{margin:0 0 6px;font-size:1rem}.lrdlg h3{margin:12px 0 4px;font-size:.85rem;color:var(--dim)}"
      + ".lrdlg .lrrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:3px 0}.lrdlg .lrlist{border:1px solid var(--line);border-radius:6px;padding:4px 8px;max-height:28vh;overflow:auto}"
      + ".lrdlg label.lrf{display:flex;gap:8px;align-items:center;margin:2px 0}.lrdlg .lrgrow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + ".lrdlg .lrask{border:1px solid var(--accent,#4a8);border-radius:6px;padding:8px;margin-top:8px}.lrdlg .rowbtns{display:flex;gap:6px;justify-content:flex-end;margin-top:10px}";
    doc.head.appendChild(s);
  }
  function kindWord(k) { return k === "vlm" ? "vision LLM" : "LLM"; }
  function paint() {
    var d = S.d; if (!d) return;
    var D = S.data || {}, k = S.kind, mine = (D.repos || []).filter(function (e) { return e.kind === k; }), cur = (D.pick || {})[k] || "";
    var h = "<h2>🧠 Your " + kindWord(k) + " on RunPod</h2>"
      + '<div class="lrrow"><label class="chk"><input type="radio" name="lrK" value="llm"' + (k === "llm" ? " checked" : "") + "> LLM</label>"
      + '<label class="chk"><input type="radio" name="lrK" value="vlm"' + (k === "vlm" ? " checked" : "") + "> Vision LLM</label></div>";
    // your list
    h += "<h3>Your list</h3>";
    h += mine.length ? '<div class="lrlist">' + mine.map(function (e) {
      return '<div class="lrrow"><span class="lrgrow" title="' + esc(e.repo + " / " + e.file) + '">' + (cur === e.id ? "● " : "") + "<b>" + esc(e.name) + '</b> <span class="hint">' + esc(e.repo) + " · " + gb(e.size) + "</span></span>"
        + '<button type="button" class="ghost" data-lruse="' + esc(e.id) + '"' + (cur === e.id ? " disabled" : "") + ">Use</button>"
        + '<button type="button" class="ghost" data-lrdel="' + esc(e.id) + '" title="Take it off your list (it stays on the pod - 📁 Files deletes it there)">🗑</button></div>';
    }).join("") + "</div>" : '<div class="hint">Nothing yet - send one from Hugging Face below and keep it.</div>';
    // from Hugging Face
    h += "<h3>From Hugging Face</h3>"
      + '<div class="lrrow"><input id="lrRepo" style="flex:1;min-width:220px" placeholder="owner/name - for example unsloth/Qwen3-8B-GGUF (or paste its address)" value="' + esc(S.repo || "") + '">'
      + '<button type="button" class="ghost" id="lrList">List its GGUF files</button></div>';
    var H = S.hf;
    if (H && H.error) h += '<div class="hint" style="color:#e88">✗ ' + esc(H.error) + "</div>";
    else if (H) {
      h += '<div class="lrlist">' + H.models.map(function (m) {
        return '<label class="lrf"><input type="radio" name="lrFile" value="' + esc(m.file) + '"' + (S.file === m.file ? " checked" : "") + '><span class="lrgrow" title="' + esc(m.file) + '">' + esc(m.file.split("/").pop()) + (m.parts.length > 1 ? " (" + m.parts.length + " parts)" : "") + '</span><span class="hint">' + esc(m.quant || "") + " · " + gb(m.size) + "</span></label>";
      }).join("") + "</div>";
      if (k === "vlm") h += '<div class="lrrow"><span class="hint">Vision projector (mmproj)</span><select id="lrMm" style="width:auto">'
        + (H.mmprojs.length ? H.mmprojs.map(function (m) { return '<option value="' + esc(m.file) + '"' + (S.mm === m.file ? " selected" : "") + ">" + esc(m.file.split("/").pop()) + " · " + gb(m.size) + "</option>"; }).join("") : '<option value="">this repo has none - a vision LLM needs one</option>')
        + "</select></div>";
      h += '<div class="lrrow"><span class="hint">Name</span><input id="lrName" style="flex:1" value="' + esc(S.name) + '"></div>';
      // the pod
      var pods = D.pods || [], pc = (D.pod || {})[k];
      h += "<h3>Run it on</h3>";
      pods.forEach(function (p) {
        h += '<label class="lrf"><input type="radio" name="lrPod" value="' + esc(p.id) + '"' + (S.pod === p.id ? " checked" : "") + "> 🖥 " + esc(p.name) + ' <span class="hint">' + esc((p.gpu || "") + " · " + String(p.status || "").toLowerCase()) + (pc && pc.id === p.id ? " · runs it now" : "") + "</span></label>";
      });
      h += '<label class="lrf"><input type="radio" name="lrPod" value="new"' + (S.pod === "new" ? " checked" : "") + "> ＋ a new pod just for the " + kindWord(k) + "</label>";
      if (S.pod && S.pod !== "new") {
        var sz = (H.models.find(function (m) { return m.file === S.file; }) || {}).size || 0, mm = (H.mmprojs.find(function (m) { return m.file === S.mm; }) || {}).size || 0;
        h += '<div class="lrrow" style="padding-left:22px"><label class="chk"><input type="checkbox" id="lrShare"' + (D.share !== false ? " checked" : "") + '> Share the card with pictures and video</label>'
          + '<span class="hint" style="flex-basis:100%">bitGen swaps the models: a render stops the ' + kindWord(k) + " and frees its VRAM; the next chat unloads ComfyUI's models and loads the " + kindWord(k) + " again.</span></div>"
          + '<div class="lrrow" style="padding-left:22px"><span class="hint">The model needs ' + gb(sz + mm) + " on the pod's volume.</span> <span class=\"hint\">Make the volume</span> <input id=\"lrGb\" type=\"number\" min=\"10\" max=\"4000\" style=\"width:80px\" value=\"" + needGb(sz, mm) + "\"> GB "
          + '<button type="button" class="ghost" id="lrGrow" title="RunPod makes the pod\'s volume this big (only bigger) - it may restart the pod; /workspace is kept">Make it bigger</button></div>';
      }
    }
    if (S.ask) h += '<div class="lrask">Keep <b>' + esc(S.ask.name) + "</b> (" + esc(S.ask.repo) + ") in your " + kindWord(S.ask.kind) + ' list? <button type="button" class="ghost" id="lrSave">Save</button> <button type="button" class="ghost" id="lrNo">Not now</button></div>';
    var st = (D.state || {})[k];
    if (st && st.phase) h += '<div class="hint" style="margin-top:8px" aria-live="polite">Pod: ' + (st.phase === "ready" ? "✓ " : st.phase === "failed" ? "✗ " : "⏳ ") + esc(st.note || st.phase) + "</div>";
    if (S.msg) h += '<div class="hint" style="margin-top:6px" aria-live="polite">' + esc(S.msg) + "</div>";
    h += '<div class="rowbtns">' + (H && !H.error ? '<button type="button" id="lrSend"' + (S.file && S.pod && !S.busy && (k !== "vlm" || S.mm) ? "" : " disabled") + ">▶ Send to the pod</button>" : "")
      + '<button type="button" class="ghost" id="lrClose">Close</button></div>';
    d.innerHTML = h; wire();
  }
  function q(s) { return S.d.querySelector(s); }
  function wire() {
    var d = S.d;
    d.querySelectorAll('input[name="lrK"]').forEach(function (r) { r.onchange = function () { S.kind = r.value; S.ask = null; S.msg = ""; pickDefaults(); paint(); }; });
    d.querySelectorAll("[data-lruse]").forEach(function (b) { b.onclick = function () { postJ("/api/llmrepos/pick", { kind: S.kind, id: b.dataset.lruse }).then(function (j) { S.msg = j.error ? "✗ " + j.error : "✓ picked - the pod sets it up at the next prompt"; reload(); notify(); }); }; });
    d.querySelectorAll("[data-lrdel]").forEach(function (b) { b.onclick = function () { postJ("/api/llmrepos/remove", { id: b.dataset.lrdel }).then(function (j) { S.msg = j.error ? "✗ " + j.error : "✓ taken off your list"; reload(); notify(); }); }; });
    var rp = q("#lrRepo"); rp.oninput = function () { S.repo = rp.value; }; rp.onkeydown = function (e) { if (e.key === "Enter") list(); };
    q("#lrList").onclick = list;
    d.querySelectorAll('input[name="lrFile"]').forEach(function (r) { r.onchange = function () { S.file = r.value; S.name = autoName(); paint(); }; });
    var mm = q("#lrMm"); if (mm) mm.onchange = function () { S.mm = mm.value; paint(); };
    var nm = q("#lrName"); if (nm) nm.oninput = function () { S.name = nm.value; S.named = true; };
    d.querySelectorAll('input[name="lrPod"]').forEach(function (r) { r.onchange = function () { S.pod = r.value; paint(); }; });
    var sh = q("#lrShare"); if (sh) sh.onchange = function () { postJ("/api/llmrepos/share", { share: sh.checked }).then(function () { if (S.data) S.data.share = sh.checked; }); };
    var gr = q("#lrGrow"); if (gr) gr.onclick = function () {
      gr.disabled = true; S.msg = "⏳ asking RunPod for a bigger volume…"; paint();
      postJ("/api/llmrepos/grow", { pod: S.pod, gb: +q("#lrGb").value }).then(function (j) { S.msg = j.error ? "✗ " + j.error : "✓ the volume is " + j.volume_gb + " GB now (RunPod may restart the pod)"; paint(); });
    };
    var se = q("#lrSend"); if (se) se.onclick = send;
    var sv = q("#lrSave"); if (sv) sv.onclick = function () { var a = S.ask; postJ("/api/llmrepos/save", a).then(function (j) { S.ask = null; S.msg = j.error ? "✗ " + j.error : "✓ " + j.entry.name + " is in your list"; reload(); notify(); }); };
    var no = q("#lrNo"); if (no) no.onclick = function () { S.ask = null; S.msg = "Not saved - it stays picked until you pick another"; paint(); };
    q("#lrClose").onclick = close;
  }
  function autoName() {
    if (S.named) return S.name;
    var repo = (S.hf && S.hf.repo) || "", base = repo.split("/").pop().replace(/[-_.]?gguf$/i, "").replace(/[-_]+/g, " ").trim();
    var m = S.hf && S.hf.models.find(function (x) { return x.file === S.file; });
    return (base + (m && m.quant ? " (" + m.quant + ")" : "")).slice(0, 80);
  }
  function pickDefaults() {
    var H = S.hf; if (!H || H.error) return;
    if (!H.models.some(function (m) { return m.file === S.file; })) S.file = defaultModel(H.models);
    if (!H.mmprojs.some(function (m) { return m.file === S.mm; })) S.mm = H.mmprojs[0] ? H.mmprojs[0].file : "";
    S.name = autoName();
    if (!S.pod) { var pc = ((S.data || {}).pod || {})[S.kind], pods = (S.data || {}).pods || []; S.pod = pc && pods.some(function (p) { return p.id === pc.id; }) ? pc.id : pods[0] ? pods[0].id : "new"; }
  }
  function list() {
    S.repo = q("#lrRepo").value.trim(); if (!S.repo) return;
    S.hf = null; S.named = false; S.msg = "⏳ asking Hugging Face…"; paint();
    getJ("/api/llmrepos/hf?repo=" + encodeURIComponent(S.repo)).then(function (j) { S.msg = ""; S.hf = j; pickDefaults(); paint(); });
  }
  function send() {
    var H = S.hf, m = H.models.find(function (x) { return x.file === S.file; }), mm = H.mmprojs.find(function (x) { return x.file === S.mm; });
    var pod = ((S.data || {}).pods || []).find(function (p) { return p.id === S.pod; });
    var body = { kind: S.kind, repo: H.repo, file: m.file, parts: m.parts, size: m.size, mmproj: S.kind === "vlm" && mm ? mm.file : "", mm_size: mm ? mm.size : 0, name: S.name, pod: S.pod, pod_name: pod ? pod.name : "" };
    S.busy = true; S.msg = "⏳ sending…"; paint();
    postJ("/api/llmrepos/send", body).then(function (j) {
      S.busy = false;
      if (j.error) { S.msg = "✗ " + j.error; paint(); return; }
      S.ask = { kind: S.kind, repo: body.repo, file: body.file, parts: body.parts, size: body.size, mmproj: body.mmproj, mm_size: body.mm_size, name: body.name };
      if (j.new_pod) {
        S.msg = "Make the pod in PODS ▸ Create pod, then tick " + (S.kind === "vlm" ? "vLLM" : "LLM") + " on it in My pods - the " + kindWord(S.kind) + " is set up at the first prompt.";
        try { if (root.H3Pods) { H3Pods.show(true); H3Pods.go("create"); } } catch (e) { /* fine */ }
      } else S.msg = "✓ sent - the pod is getting it (llama.cpp is built once on the pod and kept)";
      reload(); notify(); watch();
    });
  }
  function watch() {
    clearTimeout(S.poll);
    S.poll = setTimeout(function () {
      if (!S.d) return;
      getJ("/api/llmrepos/state").then(function (j) { if (S.data && j && !j.error) { S.data.state = j; paint(); } var st = j && j[S.kind]; if (st && st.phase === "preparing") watch(); });
    }, 3000);
  }
  function notify() { try { doc.dispatchEvent(new root.CustomEvent("h3:rgpu")); } catch (e) { /* fine */ } }
  function reload() { return getJ("/api/llmrepos").then(function (j) { if (!j.error) S.data = j; pickDefaults(); paint(); }); }
  function close() { clearTimeout(S.poll); if (S.d) { try { S.d.close(); } catch (e) { /* fine */ } S.d.remove(); } S.d = null; }
  /** the dialog for a kind ("llm" | "vlm") */
  function open(kind) {
    css(); close();
    S.kind = kind === "vlm" ? "vlm" : "llm"; S.ask = null; S.msg = ""; S.pod = "";
    var d = doc.createElement("dialog"); d.className = "lrdlg"; d.id = "llmReposDlg"; S.d = d;
    d.addEventListener("cancel", function () { setTimeout(close, 0); });
    doc.body.appendChild(d); d.showModal();
    d.innerHTML = '<div class="hint">⏳ reading your list…</div>';
    return reload().then(function () { var st = ((S.data || {}).state || {})[S.kind]; if (st && st.phase === "preparing") watch(); });
  }
  root.H3LlmRepos = Object.assign({ open: open, close: close, state: function () { return S; } }, pure);
})(typeof window !== "undefined" ? window : globalThis);
