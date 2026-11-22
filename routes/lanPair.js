// bitGen Studio — routes/lanPair.js (2.913.0): 📶 the app connects over the Wi-Fi with no QR (lib/lanPair.js) + ☁ the relay
// for when it is away from the Wi-Fi (lib/relayLink.js, 6 hours).
//   POST /api/remote/lanpair {device}       the app asks (open - lib/remoteGuard.js) -> {rid, state[, token, relay]}
//   GET  /api/remote/lanpair/:rid           the app waits (open) -> {state: pending | allowed (+ token, relay) | denied | gone}
//   GET  /api/remote/lanpair                this PC: the 📱 window + the phones asking + the relay      (local only)
//   POST /api/remote/lanpair/window {on}    📱 Let the app connect (5 minutes)                        (local only)
//   POST /api/remote/lanpair/answer {rid, allow}   ✔ Allow / ✕ Deny                                     (local only)
//   POST /api/remote/relay {on}             ☁ Away from the Wi-Fi through the relay                   (local only)
"use strict";
const remote = require("../lib/remote");
const L = require("../lib/lanPair");
const R = require("../lib/relayLink");

function version() { try { return require("../package.json").version; } catch { return ""; } }
/** the relay for the app (registered first, 6 s at most - without it the app works on the Wi-Fi only) */
async function relayFor() {
  try { await Promise.race([R.prepare(), new Promise((r) => setTimeout(r, 6000))]); } catch { /* the Wi-Fi only */ }
  return R.forApp();
}
function mount(app) {
  const local = (req, res, next) => (req.remote ? res.status(403).json({ error: "this is answered on the PC itself" }) : next());
  const viaRelay = (req) => String(req.headers["x-bitgen-via"] || "") === "relay";
  const ipOf = (req) => String(req.ip || (req.socket && req.socket.remoteAddress) || "");
  const done = async (r) => {
    if (r.state !== "allowed") return r;
    let project = ""; try { project = require("../lib/core").getProject(); } catch { project = ""; }
    return Object.assign({}, r, { ok: true, version: version(), project, relay: await relayFor() });
  };

  app.post("/api/remote/lanpair", async (req, res) => {
    if (viaRelay(req)) return res.status(403).json({ error: "connecting is done on the Wi-Fi" });
    const r = L.ask(String((req.body || {}).device || ""), ipOf(req));
    if (r.error) return res.status(r.status || 400).json(r);
    res.json(await done(r));
  });
  app.get("/api/remote/lanpair/:rid", async (req, res) => {
    if (viaRelay(req)) return res.status(403).json({ error: "connecting is done on the Wi-Fi" });
    const r = L.poll(req.params.rid);
    res.status(r.state === "gone" ? 404 : 200).json(await done(r));
  });
  app.get("/api/remote/lanpair", local, (_req, res) => res.json(Object.assign(L.status(), { relay: R.status(), remote: remote.status() })));
  app.post("/api/remote/lanpair/window", local, (req, res) => {
    if ((req.body || {}).on === false) { L.closeWindow(); return res.json(L.status()); }
    if (!remote.enabled()) return res.status(409).json({ error: "tick Remote access first (and restart bitGen Studio), so the phone can reach this PC" });
    if (remote.restartNeeded()) return res.status(409).json({ error: "Remote access is on, but bitGen Studio still listens only on this computer - close it and start it again" });
    res.json(L.openWindow());
  });
  app.post("/api/remote/lanpair/answer", local, (req, res) => {
    const b = req.body || {};
    const r = L.answer(b.rid, !!b.allow);
    res.status(r.status || 200).json(r);
  });
  app.post("/api/remote/relay", local, (req, res) => res.json(R.setOn((req.body || {}).on !== false)));

  if (process.env.H3_E2E === "1") {
    // the suite cannot wait 6 hours, and its relay is a php -S on this computer
    app.post("/api/remote/e2e-relay", local, (req, res) => {
      const b = req.body || {};
      if (b.url !== undefined) R._setUrl(String(b.url || ""));
      if (b.lan_ago_ms !== undefined) remote._setLanSeen(Date.now() - (+b.lan_ago_ms || 0));
      res.json(R.status());
    });
  }
  R.start();
}
module.exports = { mount };
