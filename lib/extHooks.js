// bitGen Studio — lib/extHooks.js (2.589.0): HOOKS an optional extension's server part fills in.
//
// Tim: "i suspect the malwarebytes detection is due to the team renderhub ext. i think we remove this from bitgen and give
// it as an additional addon". The render farm (Team) left the core - it is ext/teamdock/ now, shipped as its own zip. The
// core still has the places a farm plugs into (a new job may be rendered on another PC, a cancelled one is cancelled
// there) - they ask here, and with no extension installed nothing is set: every job renders on this PC.
//   set(name, impl) / get(name) / clear(name?)
//   "farm": {route(params) -> target | null, dispatch(job, target), cancel(job)}     (ext/teamdock/server/index.js)
"use strict";
const H = new Map();
const set = (name, impl) => { if (impl) H.set(String(name), impl); else H.delete(String(name)); return impl; };
const get = (name) => H.get(String(name)) || null;
const clear = (name) => { if (name == null) H.clear(); else H.delete(String(name)); };
module.exports = { set, get, clear };
