#!/usr/bin/env node
// bitGen Studio v2 — entry point.
// RULE: no logic here beyond minimal imports + listen.
// All state lives in lib/core.js; all endpoints mount from routes/index.js.
const express = require("express");
const routes = require("./routes");
const remote = require("./lib/remote");

const app = express();
routes.mount(app);

const PORT = parseInt(process.env.H3_PORT, 10) || 8311;
const HOST = remote.bindHost();   // 127.0.0.1 unless remote access is switched on
app.listen(PORT, HOST, () =>
  console.log(`bitGen Studio -> http://127.0.0.1:${PORT}`
    + (HOST === "127.0.0.1" ? "" : `  (also on ${remote.lanAddress()}:${PORT} for your phone)`)));
