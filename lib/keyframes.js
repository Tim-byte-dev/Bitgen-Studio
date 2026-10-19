// bitGen Studio — lib/keyframes.js (2.379.0): the keyframe / tween maths on the server side - the SAME file the page
// loads (static/keyframes.js, UMD), so the preview, the exporter's clean-up and the unit tests can never disagree.
// worker.py mirrors value() / ease() for the compile (_kf_value, _kf_expr).
module.exports = require("../static/keyframes.js");
