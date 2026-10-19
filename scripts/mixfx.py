"""bitGen Studio — the compile's SOUND MIX: roles, ducking, loudness (2.406.0). worker.py's export hands every sound
it mixes here with its role; this adds the filters and answers the label of the finished mix.

Tim: "lets start closing the gap and go with your suggestions as you see fit" (audio clean-up + ducking was one).

  roles     voice (V1's own sound and the video layers' by default) | music (the sound layers by default) | sfx -
            set per layer in the timeline (its 🔊 role)
  ducking   tl.mix.duck = {on, amount: 6..24 dB}: the music is pressed down while anyone speaks (a sidechain compressor
            keyed by the voices), then comes back
  loudness  tl.mix.loudness = {on, target: -23..-9 LUFS (-14 = YouTube / Spotify, -16 = podcasts, -23 = broadcast)}:
            EBU R128 normalisation of the whole mix, true peak -1.5 dB
"""

ROLES = ("voice", "music", "sfx")


def _amix(parts, labels, out):
    if len(labels) == 1:
        parts.append(f"{labels[0]}anull[{out}]")
    else:
        parts.append(f"{''.join(labels)}amix=inputs={len(labels)}:duration=longest:normalize=0[{out}]")
    return f"[{out}]"


def settings(cfg):
    c = cfg or {}
    d = c.get("duck") or {}
    lo = c.get("loudness") or {}
    try:
        amount = max(3.0, min(30.0, float(d.get("amount") or 12)))
    except (TypeError, ValueError):
        amount = 12.0
    try:
        target = max(-30.0, min(-6.0, float(lo.get("target") or -14)))
    except (TypeError, ValueError):
        target = -14.0
    return {"duck": bool(d.get("on")), "amount": amount, "loud": bool(lo.get("on")), "target": target}


def active(cfg):
    s = settings(cfg)
    return s["duck"] or s["loud"]


def mix(parts, ins, cfg, say=None):
    """ins = [(label, role)] -> the finished mix's label ("[aout]") or None (no sound at all)"""
    if not ins:
        return None
    s = settings(cfg)
    voice = [l for l, r in ins if r == "voice"]
    music = [l for l, r in ins if r == "music"]
    other = [l for l, r in ins if r not in ("voice", "music")]
    final = [l for l, _r in ins]
    if s["duck"] and voice and music:
        v = _amix(parts, voice, "dkv")
        parts.append(f"{v}asplit=2[dkvk][dkvo]")
        m = _amix(parts, music, "dkm")
        # amount dB of reduction while the voices are over the threshold: ratio from the amount (6 dB ~ 2.5:1 ... 24 ~ 20:1)
        ratio = max(2.0, min(20.0, 1.25 ** (s["amount"] / 1.0) / 1.0))
        parts.append(f"{m}[dkvk]sidechaincompress=threshold=0.02:ratio={ratio:.2f}:attack=20:release=400:makeup=1[dkmd]")
        final = ["[dkvo]", "[dkmd]"] + other
        if say:
            say(f"[worker] mix: the music ({len(music)}) ducks about {s['amount']:.0f} dB under the voices ({len(voice)})")
    elif s["duck"] and say:
        say("[worker] mix: ducking is on but there is " + ("no music" if voice else "no voice") + " to duck - left as is")
    lbl = _amix(parts, final, "amx")
    if s["loud"]:
        parts.append(f"{lbl}loudnorm=I={s['target']:.1f}:TP=-1.5:LRA=11,aresample=48000[aout]")
        if say:
            say(f"[worker] mix: loudness normalised to {s['target']:.0f} LUFS (true peak -1.5 dB)")
    else:
        parts.append(f"{lbl}anull[aout]")
    return "[aout]"


# ---------------- 2.415.0: the 🎚 TRACK MIXER - pan per track + the master fader (lib/mixer.js has the same numbers)
# Tim: "lets do the medium jobs now". The BALANCE law (Premiere's for stereo tracks): panned right, the left side is
# turned down by the amount and the right kept at full (and the other way round).

def pan_gains(p):
    """-1 .. 1 -> (left, right)"""
    try:
        q = max(-1.0, min(1.0, float(p or 0)))
    except (TypeError, ValueError):
        q = 0.0
    if abs(q) < 1e-4:
        return 1.0, 1.0
    return (1.0 - q if q > 0 else 1.0), (1.0 + q if q < 0 else 1.0)


def panned(tl):
    """does the timeline pan anything or move the master fader? (the compile then takes the full sound pass)"""
    def off(v):
        try:
            return abs(float(v or 0)) > 1e-4
        except (TypeError, ValueError):
            return False
    if off(tl.get("video_pan")):
        return True
    if any(off(L.get("pan")) for L in (tl.get("video_layers") or [])):
        return True
    for T in tl.get("audio") or []:
        for c in (T if isinstance(T, list) else (T.get("clips") or [])):
            if isinstance(c, dict) and off(c.get("pan")):
                return True
    m = tl.get("master") or {}
    try:
        return abs(float(m.get("volume", 1)) - 1) > 1e-4
    except (TypeError, ValueError):
        return False


def pan_inputs(parts, labels, pans, say=None):
    """each mix input panned (stereo first) -> the new labels; an unpanned input passes untouched"""
    out = []
    n = 0
    for i, (lbl, p) in enumerate(zip(labels, pans)):
        gl, gr = pan_gains(p)
        if gl == 1.0 and gr == 1.0:
            out.append(lbl)
            continue
        n += 1
        parts.append(f"{lbl}aformat=channel_layouts=stereo,pan=stereo|c0={gl:.4f}*c0|c1={gr:.4f}*c1[pan{i}]")
        out.append(f"[pan{i}]")
    if n and say:
        say(f"[worker] mixer: {n} track(s) panned")
    return out


def master_out(parts, label, master, say=None):
    """the master fader on the finished mix -> its label"""
    try:
        v = max(0.0, min(2.0, float((master or {}).get("volume", 1))))
    except (TypeError, ValueError):
        v = 1.0
    if not label or abs(v - 1) < 1e-4:
        return label
    parts.append(f"{label}volume={v:.4f}[amaster]")
    if say:
        import math
        say(f"[worker] mixer: master {('%+.1f dB' % (20 * math.log10(v))) if v > 1e-4 else '-inf dB'}")
    return "[amaster]"
