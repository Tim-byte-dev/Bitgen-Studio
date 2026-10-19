"""bitGen Studio — Basic Settings' OVERRIDE STYLE written into a ComfyUI API graph (2.409.0): the steps and the CFG for
graphs that do not carry them as a plain number (LTX 2.3 / 2.5: a ManualSigmas schedule + CFGGuider /
LTXVDualCFGGuider; 3DREAL: a KSampler). ltx_worker.py calls apply(graph, params["basic"]) on the graph it queues.

Tim: "if overide is checked in basic settings docker then all models including ltx2.3 and 2.5 use basic settings
including, cfg, steps, seed, model and loras".

  steps  the MAIN pass's sigma list (the longest ManualSigmas - LTX's 8-step distilled schedule) re-drawn with that many
         steps, keeping its shape (linear in the schedule's own index); the short refine pass (the upscale stage's 3)
         stays; a KSampler / KSamplerAdvanced gets `steps`
  cfg    CFGGuider.cfg, LTXVDualCFGGuider.video_cfg (its audio_cfg stays), KSampler(Advanced).cfg
The seed, the model and the LoRAs ride on the job's own fields (lib/basicOverride.js) - not here.
"""


def _num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def parse_sigmas(text):
    out = []
    for p in str(text or "").replace("\n", ",").split(","):
        p = p.strip()
        if not p:
            continue
        try:
            out.append(float(p))
        except ValueError:
            return None
    return out


def resample(sig, steps):
    """`sig` (steps0 + 1 values, falling) -> steps + 1 values on the same curve (piecewise linear in its index)"""
    n0 = len(sig) - 1
    if n0 < 1 or steps < 1:
        return list(sig)
    out = []
    for i in range(steps + 1):
        x = i * n0 / steps
        k = min(int(x), n0 - 1)
        f = x - k
        out.append(sig[k] + (sig[k + 1] - sig[k]) * f)
    out[0], out[-1] = sig[0], sig[-1]
    return out


def fmt_sigmas(sig):
    return ", ".join(("%.6f" % v).rstrip("0").rstrip(".") if v not in (0.0, 1.0) else ("1.0" if v == 1.0 else "0.0") for v in sig)


def apply(graph, basic):
    """-> notes. `basic` = {steps, cfg} (None / empty = nothing to do)"""
    notes = []
    if not isinstance(basic, dict):
        return notes
    steps = basic.get("steps")
    steps = int(steps) if _num(steps) and steps >= 1 else 0
    cfg = basic.get("cfg")
    cfg = float(cfg) if _num(cfg) else None
    if not steps and cfg is None:
        return notes
    sig_nodes = []
    for nid, node in graph.items():
        if not isinstance(node, dict):
            continue
        ct = node.get("class_type") or ""
        ins = node.get("inputs") or {}
        if ct == "ManualSigmas" and isinstance(ins.get("sigmas"), str):
            s = parse_sigmas(ins["sigmas"])
            if s and len(s) >= 2:
                sig_nodes.append((nid, s))
        if ct in ("KSampler", "KSamplerAdvanced"):
            if steps and _num(ins.get("steps")):
                notes.append(f"steps {ins['steps']} -> {steps} ({nid} {ct}, Basic Settings override)")
                ins["steps"] = steps
            if cfg is not None and _num(ins.get("cfg")):
                notes.append(f"cfg {ins['cfg']} -> {cfg} ({nid} {ct})")
                ins["cfg"] = cfg
        elif ct == "CFGGuider" and cfg is not None and _num(ins.get("cfg")):
            notes.append(f"cfg {ins['cfg']} -> {cfg} ({nid} CFGGuider, Basic Settings override)")
            ins["cfg"] = cfg
        elif ct == "LTXVDualCFGGuider" and cfg is not None and _num(ins.get("video_cfg")):
            notes.append(f"video cfg {ins['video_cfg']} -> {cfg} ({nid} LTXVDualCFGGuider; its audio cfg {ins.get('audio_cfg')} kept)")
            ins["video_cfg"] = cfg
    if steps and sig_nodes:
        longest = max(len(s) for _n, s in sig_nodes)
        for nid, s in sig_nodes:
            if len(s) != longest:
                notes.append(f"{nid}: the {len(s) - 1}-step refine pass kept")
                continue
            if len(s) - 1 == steps:
                notes.append(f"{nid}: already {steps} steps")
                continue
            new = resample(s, steps)
            graph[nid]["inputs"]["sigmas"] = fmt_sigmas(new)
            notes.append(f"steps {len(s) - 1} -> {steps} ({nid} ManualSigmas re-drawn on the same curve, Basic Settings override)")
    elif steps and not any(n.startswith("steps ") for n in notes):
        notes.append(f"steps {steps}: this graph has no step count to set (no ManualSigmas / KSampler) - its own kept")
    return notes
