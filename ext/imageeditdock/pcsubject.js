/* pcsubject.js — SELECT SUBJECT WITHOUT A DOWNLOAD, AND WITH THE AI MATTE (2.488.0): the image editor's gap, round H.
 * window.PCSubject.
 *
 * Tim (verbatim): "close the photoshop gap."
 *
 *   Select ▸ Subject              the picture's main subject selected in one go - nothing to type:
 *                                   Built in    works out of the box, in the page: the background learnt from the
 *                                               picture's edges, the subject from what differs (colour models
 *                                               refined a few times), tidied (small bits dropped, holes filled) and
 *                                               fitted to the real edges (a guided filter on the full picture)
 *                                   AI matte    BiRefNet (rembg) on this computer - the same install as the path
 *                                               layers' AI matte (venvs/matte); hair and fur edges
 *                                   Auto        the AI matte when it is installed, else built in
 *   Select ▸ Subject Settings…    the method, the AI model, ⬇ Install
 *   Layer ▸ Remove Background     the subject as the active layer's mask
 *   (Select ▸ Subject by Words… is Segment Anything - pcsam.js)
 *
 * Pure (Node: scripts/test-subject.js): toLab, kmeans, otsu, components, subjectSmall, guidedFilter, subjectMask.
 */
(function (root) {
  "use strict";

  const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const LIN8 = Float32Array.from({ length: 256 }, (_, i) => lin(i / 255));
  const f3 = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  function toLab(r, g, b) {
    const R = LIN8[r], G = LIN8[g], B = LIN8[b];
    const fx = f3((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), fy = f3(0.2126 * R + 0.7152 * G + 0.0722 * B), fz = f3((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  /** k-means on Lab points (Float32Array, 3 per point): centres, deterministic (seeded by lightness quantiles) */
  function kmeans(pts, k, iters) {
    const n = pts.length / 3; if (!n) return [];
    const kk = Math.min(k, n), order = Array.from({ length: n }, (_, i) => i).sort((a, b) => pts[a * 3] - pts[b * 3]);
    let C = Array.from({ length: kk }, (_, j) => { const i = order[Math.floor((j + 0.5) / kk * n)]; return [pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]]; });
    const as = new Int32Array(n);
    for (let it = 0; it < (iters || 8); it++) {
      const S = C.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < n; i++) { let b = 0, bd = Infinity; for (let j = 0; j < C.length; j++) { const c = C[j], d = (pts[i * 3] - c[0]) ** 2 + (pts[i * 3 + 1] - c[1]) ** 2 + (pts[i * 3 + 2] - c[2]) ** 2; if (d < bd) { bd = d; b = j; } } as[i] = b; const s = S[b]; s[0] += pts[i * 3]; s[1] += pts[i * 3 + 1]; s[2] += pts[i * 3 + 2]; s[3]++; }
      C = C.map((c, j) => (S[j][3] ? [S[j][0] / S[j][3], S[j][1] / S[j][3], S[j][2] / S[j][3]] : c));
    }
    return C;
  }
  const nearest = (C, l, a, b) => { let bd = Infinity; for (const c of C) { const d = (l - c[0]) ** 2 + (a - c[1]) ** 2 + (b - c[2]) ** 2; if (d < bd) bd = d; } return Math.sqrt(bd); };
  /** Otsu's threshold for values in 0..1 */
  function otsu(v) {
    const H = new Float64Array(256); for (const x of v) H[Math.max(0, Math.min(255, Math.round(x * 255)))]++;
    const N = v.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * H[i];
    let sB = 0, wB = 0, best = 0, t1 = 128, t2 = 128;
    for (let i = 0; i < 256; i++) { wB += H[i]; if (!wB) continue; const wF = N - wB; if (!wF) break; sB += i * H[i]; const mB = sB / wB, mF = (sum - sB) / wF, b = wB * wF * (mB - mF) ** 2; if (b > best * (1 + 1e-9)) { best = b; t1 = t2 = i; } else if (b >= best * (1 - 1e-9)) t2 = i; }
    return ((t1 + t2) / 2 + 0.5) / 255;                                    // the middle of an empty gap, not its start
  }
  /** 4-connected parts of m (1s): {label Int32Array, sizes [], touches [] (the edge)} */
  function components(m, W, H, val) {
    const lab = new Int32Array(W * H).fill(-1), sizes = [], touches = [], v = val == null ? 1 : val;
    for (let s = 0; s < W * H; s++) {
      if (m[s] !== v || lab[s] >= 0) continue;
      const id = sizes.length, st = [s]; lab[s] = id; let n = 0, edge = false;
      while (st.length) { const p = st.pop(), x = p % W, y = (p - x) / W; n++; if (!x || !y || x === W - 1 || y === H - 1) edge = true; if (x > 0 && m[p - 1] === v && lab[p - 1] < 0) { lab[p - 1] = id; st.push(p - 1); } if (x < W - 1 && m[p + 1] === v && lab[p + 1] < 0) { lab[p + 1] = id; st.push(p + 1); } if (y > 0 && m[p - W] === v && lab[p - W] < 0) { lab[p - W] = id; st.push(p - W); } if (y < H - 1 && m[p + W] === v && lab[p + W] < 0) { lab[p + W] = id; st.push(p + W); } }
      sizes.push(n); touches.push(edge);
    }
    return { lab, sizes, touches };
  }
  function box(a, W, H, r) {
    const t = new Float32Array(W * H), o = new Float32Array(W * H), n = 2 * r + 1;
    for (let y = 0; y < H; y++) { let s = 0; const row = y * W; for (let k = -r; k <= r; k++) s += a[row + Math.min(W - 1, Math.max(0, k))]; for (let x = 0; x < W; x++) { t[row + x] = s / n; s += a[row + Math.min(W - 1, x + r + 1)] - a[row + Math.max(0, x - r)]; } }
    for (let x = 0; x < W; x++) { let s = 0; for (let k = -r; k <= r; k++) s += t[Math.min(H - 1, Math.max(0, k)) * W + x]; for (let y = 0; y < H; y++) { o[y * W + x] = s / n; s += t[Math.min(H - 1, y + r + 1) * W + x] - t[Math.max(0, y - r) * W + x]; } }
    return o;
  }
  /** the subject on a small copy: {p (Float32 0..1), m (Uint8 0/1), W, H} */
  function subjectSmall(d, w, h, o) {
    const opt = o || {}, k = Math.min(1, (opt.maxSide || 200) / Math.max(w, h)), W = Math.max(8, Math.round(w * k)), H = Math.max(8, Math.round(h * k)), fx = w / W, fy = h / H;
    const L = new Float32Array(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx)), y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
      let r = 0, g = 0, b = 0, n = 0; for (let yy = y0; yy < Math.min(h, y1); yy++) for (let xx = x0; xx < Math.min(w, x1); xx++) { const i = (yy * w + xx) * 4, a = d[i + 3] / 255; r += d[i] * a + 255 * (1 - a); g += d[i + 1] * a + 255 * (1 - a); b += d[i + 2] * a + 255 * (1 - a); n++; }
      const c = toLab(Math.round(r / n), Math.round(g / n), Math.round(b / n)); L.set(c, (y * W + x) * 3);
    }
    const N = W * H, bw = Math.max(2, Math.round(Math.min(W, H) * 0.04)), isB = (x, y) => x < bw || y < bw || x >= W - bw || y >= H - bw;
    const pick = (f, cap) => { const idx = []; for (let p = 0; p < N; p++) if (f(p)) idx.push(p); const step = Math.max(1, Math.floor(idx.length / cap)), out = []; for (let i = 0; i < idx.length; i += step) out.push(L[idx[i] * 3], L[idx[i] * 3 + 1], L[idx[i] * 3 + 2]); return Float32Array.from(out); };
    // the background: the edge's colours - but not one that only covers a small stretch of it (a subject standing on
    // the bottom edge, a portrait's shoulders)
    const edgePts = pick((p) => isB(p % W, Math.floor(p / W)), 4000);
    let bgC = kmeans(edgePts, 6, 8);
    { const share = bgC.map(() => 0), n = edgePts.length / 3; for (let i = 0; i < n; i++) { let b = 0, bd = Infinity; bgC.forEach((c, j) => { const d = (edgePts[i * 3] - c[0]) ** 2 + (edgePts[i * 3 + 1] - c[1]) ** 2 + (edgePts[i * 3 + 2] - c[2]) ** 2; if (d < bd) { bd = d; b = j; } }); share[b]++; }
      const keep = bgC.filter((_, j) => share[j] / n >= 0.12); if (keep.length) bgC = keep; }
    // first guess: how far from the edge's colours, a little more in the middle
    const dB = new Float32Array(N); for (let p = 0; p < N; p++) dB[p] = nearest(bgC, L[p * 3], L[p * 3 + 1], L[p * 3 + 2]);
    const sorted = Float32Array.from(dB).sort(), scale = sorted[Math.floor(N * 0.95)] || 1;
    let p0 = new Float32Array(N);
    for (let p = 0; p < N; p++) { const x = p % W, y = (p - x) / W, cx = (x + 0.5) / W - 0.5, cy = (y + 0.5) / H - 0.5, c = Math.exp(-(cx * cx + cy * cy) / (2 * 0.3 * 0.3)); p0[p] = Math.min(1, dB[p] / scale) * (0.6 + 0.4 * c); }
    // a pixel starts as subject when it is clearly unlike the background: further from its colours than the background's
    // own spread (the edge pixels' distances) allows - or above Otsu's split, whichever is lower
    const edgeD = []; for (let p = 0; p < N; p++) if (isB(p % W, Math.floor(p / W))) edgeD.push(dB[p]); edgeD.sort((a, b) => a - b);
    const spread = edgeD.length ? edgeD[Math.floor(edgeD.length * 0.9)] : 5, tAbs = Math.max(8, spread * 2.5) / scale;
    const t0 = Math.max(0.05, Math.min(Math.max(0.12, otsu(p0)), tAbs));
    let m = new Uint8Array(N); for (let p = 0; p < N; p++) m[p] = p0[p] > t0 ? 1 : 0;
    let prob = p0;
    const tidy = () => {
      // the biggest parts (and any at least a quarter of the biggest) kept; holes filled
      const C = components(m, W, H, 1); if (!C.sizes.length) return;
      const big = Math.max(...C.sizes);
      for (let p = 0; p < N; p++) if (m[p] && C.sizes[C.lab[p]] < big * 0.25) m[p] = 0;
      const B = components(m, W, H, 0);
      for (let p = 0; p < N; p++) if (!m[p] && !B.touches[B.lab[p]]) m[p] = 1;
    };
    tidy();
    for (let it = 0; it < (opt.iters || 4); it++) {
      let nf = 0; for (let p = 0; p < N; p++) nf += m[p]; if (nf < 4 || nf > N - 4) break;
      const fgC = kmeans(pick((p) => m[p] === 1, 5000), 6, 6); bgC = kmeans(pick((p) => m[p] === 0, 5000), 6, 6);
      const pr = new Float32Array(N);
      for (let p = 0; p < N; p++) { const b = nearest(bgC, L[p * 3], L[p * 3 + 1], L[p * 3 + 2]), f = nearest(fgC, L[p * 3], L[p * 3 + 1], L[p * 3 + 2]); pr[p] = b / (b + f + 1e-6); }
      prob = box(box(pr, W, H, 1), W, H, 1);
      for (let p = 0; p < N; p++) m[p] = prob[p] > 0.5 ? 1 : 0;
      tidy();
    }
    return { p: prob, m, W, H };
  }
  /** a guided filter: p smoothed so its edges follow the guide I (both Float32, 0..1) */
  function guidedFilter(I, p, W, H, r, eps) {
    const mI = box(I, W, H, r), mp = box(p, W, H, r), Ip = new Float32Array(W * H), II = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) { Ip[i] = I[i] * p[i]; II[i] = I[i] * I[i]; }
    const mIp = box(Ip, W, H, r), mII = box(II, W, H, r), a = new Float32Array(W * H), b = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) { const cov = mIp[i] - mI[i] * mp[i], v = mII[i] - mI[i] * mI[i]; a[i] = cov / (v + eps); b[i] = mp[i] - a[i] * mI[i]; }
    const ma = box(a, W, H, r), mb = box(b, W, H, r), q = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) q[i] = ma[i] * I[i] + mb[i];
    return q;
  }
  /** the subject of an RGBA picture: Uint8Array(w * h), 0..255 */
  function subjectMask(d, w, h, o) {
    const sm = subjectSmall(d, w, h, o), { W, H } = sm, hard = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) hard[i] = sm.m[i];
    // up to full size (bilinear), then fitted to the picture's own edges
    const up = new Float32Array(w * h), sx = W / w, sy = H / h;
    for (let y = 0; y < h; y++) {
      const fy = Math.min(H - 1, Math.max(0, (y + 0.5) * sy - 0.5)), y0 = Math.floor(fy), y1 = Math.min(H - 1, y0 + 1), ty = fy - y0;
      for (let x = 0; x < w; x++) { const fx = Math.min(W - 1, Math.max(0, (x + 0.5) * sx - 0.5)), x0 = Math.floor(fx), x1 = Math.min(W - 1, x0 + 1), tx = fx - x0; up[y * w + x] = (hard[y0 * W + x0] * (1 - tx) + hard[y0 * W + x1] * tx) * (1 - ty) + (hard[y1 * W + x0] * (1 - tx) + hard[y1 * W + x1] * tx) * ty; }
    }
    const I = new Float32Array(w * h); for (let i = 0; i < w * h; i++) I[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    const r = Math.max(2, Math.round(1.5 / Math.min(sx, sy))), q = guidedFilter(I, up, w, h, r, (o && o.eps) || 1e-3), out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) { const v = (q[i] - 0.5) * 1.6 + 0.5; out[i] = Math.round(255 * Math.max(0, Math.min(1, v))); }
    return out;
  }
  const pure = { toLab, kmeans, otsu, components, box, subjectSmall, guidedFilter, subjectMask };

  /* ---------------- the page ---------------- */
  function install(E) {
    const { S, store } = E, doc = E.doc || root.document, win = doc.defaultView || root;
    const say = (t) => (E.say ? E.say(t) : null), esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    let busy = false, aiState = null;
    async function status() { try { aiState = await (await win.fetch("/api/subject/status")).json(); } catch (e) { aiState = { ai: false, error: e.message }; } return aiState; }
    const flatData = () => E.flatten().getContext("2d").getImageData(0, 0, S.w, S.h).data;
    async function aiMask() {
      const f = E.flatten(), png = await new Promise((ok) => f.toBlob(ok, "image/png"));
      const q = new URLSearchParams({ model: store.get("subject.model", "birefnet-general") }); if (store.get("subject.fake", false)) q.set("fake", "1");
      const r = await win.fetch("/api/subject/matte?" + q, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: png });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "the AI matte did not answer");
      const im = await createImageBitmapOf(await r.blob()), c = doc.createElement("canvas"); c.width = S.w; c.height = S.h; const g = c.getContext("2d"); g.drawImage(im, 0, 0, S.w, S.h);
      const dd = g.getImageData(0, 0, S.w, S.h).data, m = new Uint8Array(S.w * S.h); for (let i = 0; i < m.length; i++) m[i] = dd[i * 4];
      return m;
    }
    const createImageBitmapOf = (blob) => (win.createImageBitmap ? win.createImageBitmap(blob) : new Promise((ok, no) => { const im = new win.Image(); im.onload = () => ok(im); im.onerror = no; im.src = win.URL.createObjectURL(blob); }));
    /** the subject's mask by the chosen method: {mask, method} */
    async function find(methodWanted) {
      let method = methodWanted || store.get("subject.method", "auto");
      if (method === "auto") method = (aiState || await status()).ai || store.get("subject.fake", false) ? "ai" : "builtin";
      if (method === "ai") { try { return { mask: await aiMask(), method }; } catch (e) { if (methodWanted === "ai") throw e; say("AI matte: " + e.message + " - built in instead"); } }
      await new Promise((ok) => win.setTimeout(ok, 20));
      return { mask: subjectMask(flatData(), S.w, S.h, {}), method: "builtin" };
    }
    async function guarded(what, f) {
      if (!S.w) return say("open a picture first");
      if (busy) return say("still finding the last subject");
      busy = true; say(what + "…");
      try { return await f(); } catch (e) { say(what + " failed: " + e.message); return null; } finally { busy = false; }
    }
    const count = (m) => { let n = 0; for (let i = 0; i < m.length; i++) if (m[i] > 127) n++; return n; };
    const selectSubject = (method) => guarded("Select Subject", async () => {
      const r = await find(method); if (!count(r.mask)) return say("no subject found");
      E.changeSel(r.mask, "Select Subject"); E.lastSubject = { method: r.method, n: count(r.mask) };
      say(`subject selected (${r.method === "ai" ? "AI matte" : "built in"})`);
    });
    const removeBackground = (method) => guarded("Remove Background", async () => {
      const L = E.layer && E.layer(); if (!L || L.type !== "pixel") return say("pick a pixel layer");
      const r = await find(method); if (!count(r.mask)) return say("no subject found");
      E.docOp("Remove Background", () => {
        const c = doc.createElement("canvas"); c.width = S.w; c.height = S.h; const g = c.getContext("2d"), id = g.createImageData(S.w, S.h);
        for (let i = 0; i < r.mask.length; i++) { id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = r.mask[i]; id.data[i * 4 + 3] = 255; }
        g.putImageData(id, 0, 0); L.mask = E.newMask("#000"); L.mask.canvas = c; L.mask.ver = 1; L.ver = (L.ver || 0) + 1;
      });
      E.lastSubject = { method: r.method, n: count(r.mask) };
      say(`background hidden by a layer mask (${r.method === "ai" ? "AI matte" : "built in"}) - paint the mask to fix it`);
    });
    // 2.601.0: the AI matte install's state in words
    const sbRun = (s) => !!(s && s.installing && s.installing.state === "running");
    const sbWords = (s) => {
      const i = s && s.installing, last = i && (i.log || []).slice(-1)[0] ? String(i.log.slice(-1)[0]).replace(/^\[[^\]]{1,20}\]\s*/, "").slice(0, 70) : "";
      return sbRun(s) ? "⏳ installing…" + (last ? " " + last : "") : i && i.state === "error" ? "✗ " + (i.error || "the install failed") : s && s.ai ? "✓ installed" : "not installed";
    };
    async function settings() {
      const st = await status(), m = store.get("subject.method", "auto"), model = store.get("subject.model", "birefnet-general");
      const d = E.ui.dialog("Select Subject Settings", `
        <div class="kxrow"><span>Method</span><select id="sbM"><option value="auto"${m === "auto" ? " selected" : ""}>Auto (the AI matte when installed)</option><option value="builtin"${m === "builtin" ? " selected" : ""}>Built in (no download)</option><option value="ai"${m === "ai" ? " selected" : ""}>AI matte (BiRefNet on this computer)</option></select></div>
        <div class="kxrow"><span>AI model</span><select id="sbModel">${(st.models || ["birefnet-general"]).map((x) => `<option${x === model ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></div>
        <div class="kxrow"><span>AI matte</span><button class="ghost" id="sbInstall"${sbRun(st) ? ' disabled aria-busy="true"' : ""} title="${st.ai ? "Installed - install it again over the top (repairs a broken install)" : "rembg + BiRefNet in venvs/matte (about 1 GB once)"}">${st.ai ? "⟳ Reinstall" : "⬇ Install"}</button><b id="sbState" role="status" style="margin-left:6px">${esc(sbWords(st))}</b></div>
        <div class="kxrow" style="color:var(--pc-dim)">The AI matte is the one the path layers use (rembg + BiRefNet in venvs/matte, about 1 GB once). Built in needs nothing and suits a clear subject on a plainer background.</div>`,
        (dd) => { store.set("subject.method", dd.querySelector("#sbM").value); store.set("subject.model", dd.querySelector("#sbModel").value); say("Select Subject: " + dd.querySelector("#sbM").selectedOptions[0].textContent); }, { okLabel: "OK" });
      const b = d && d.querySelector ? d.querySelector("#sbInstall") : null;
      // 2.601.0 (Tim: "let the user know the status next to the button and disable the button when download/install
      // starts"): the button is disabled and "⏳ installing… <its last line>" sits beside it until it ends (✓ / ✗);
      // installed = ⟳ Reinstall
      const stEl = d && d.querySelector ? d.querySelector("#sbState") : null;
      const follow = () => setTimeout(async () => {
        const s = await status();
        if (!b.isConnected) return;
        if (stEl) stEl.textContent = sbWords(s);
        if (sbRun(s)) { follow(); return; }
        b.disabled = false; b.removeAttribute("aria-busy"); b.textContent = s.ai ? "⟳ Reinstall" : "⬇ Install";
        say(s.ai ? "the AI matte is installed" : "the AI matte install did not finish - " + sbWords(s));
      }, 1500);
      if (b && sbRun(st)) follow();
      if (b) b.onclick = async () => {
        b.disabled = true; b.setAttribute("aria-busy", "true"); if (stEl) stEl.textContent = "⏳ starting the install…";
        try {
          const r = await win.fetch("/api/subject/install", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); const j = await r.json();
          if (j.error) { b.disabled = false; b.removeAttribute("aria-busy"); if (stEl) stEl.textContent = "✗ " + j.error; return; }
          follow();
        } catch (e) { b.disabled = false; b.removeAttribute("aria-busy"); if (stEl) stEl.textContent = "✗ " + e.message; say("install failed: " + e.message); }
      };
      return d;
    }
    const C = E.ui.addCmd, docOpen = () => !!S.w;
    C("sel.subjectauto", "Subject", "", () => selectSubject(), { enabled: docOpen }, ["Select", "sel.range"]);
    C("sel.subjectset", "Subject Settings…", "", settings, {}, ["Select", "sel.subjectauto"]);
    C("layer.removebg", "Remove Background", "", () => removeBackground(), { enabled: () => !!(E.layer && E.layer() && E.layer().type === "pixel") }, ["Layer", "layer.clip"]);
    const sam = E.ui.CMD.get("sel.subject"); if (sam) sam.label = "Subject by Words…";
    E.subject = { find, selectSubject, removeBackground, settings, status };
  }

  const PCSubject = Object.assign({ install }, pure);
  if (typeof module !== "undefined" && module.exports) module.exports = PCSubject;
  else root.PCSubject = PCSubject;
})(typeof window !== "undefined" ? window : globalThis);
