"""bitGen Studio — HDR + WIDE GAMUT (2.417.0): the colour of what comes in and what goes out.

Tim: "continue with the next part please the gap is getting smaller - soon bitgen should be superior" (Premiere's "HDR
(PQ / HLG) and wide-gamut output").

IN  - an HDR source (PQ = SMPTE ST 2084, HLG = ARIB STD-B67, usually BT.2020) is TONE-MAPPED into the timeline's
      Rec.709 SDR when it is compiled (zscale to linear light, the reference white (203 nits) = SDR white -> BT.709 primaries -> Möbius's curve: linear to 90 %, the highlights above white rolled off -> BT.709), instead of
      landing washed out and grey (scripts/clipfx_render.py renders such a clip once, like any clip with fx).
OUT - a 📤 deliverable's colour (lib/exportPresets.json colours, lib/deliver.js):
        sdr      Rec.709 as the master is (the default)
        hdr10    PQ, BT.2020, 10-bit, HDR10 static metadata (mastering display 1000 nits, MaxCLL / MaxFALL)
        hlg      HLG, BT.2020, 10-bit (broadcast HDR - no metadata needed)
        rec2020  BT.2020 primaries, SDR (wide gamut UHD SDR), 10-bit
      The master's SDR picture is placed into the HDR signal with its white at 203 nits (ITU-R BT.2408's reference
      white), so it looks as graded on an HDR screen; grading ABOVE white (specular highlights brighter than paper) needs
      an HDR master - not this.
"""
import json
import subprocess

REF_WHITE = 203                     # nits: BT.2408 HDR reference white = SDR 100 %
OUT = {
    "hdr10": {"p": "bt2020", "t": "smpte2084", "m": "bt2020nc", "label": "HDR10 (PQ, BT.2020)"},
    "hlg": {"p": "bt2020", "t": "arib-std-b67", "m": "bt2020nc", "label": "HLG (BT.2020)"},
    "rec2020": {"p": "bt2020", "t": "bt2020-10", "m": "bt2020nc", "label": "Rec.2020 SDR (wide gamut)"},
}
HDR_IN = ("smpte2084", "arib-std-b67")


def probe(path):
    """the source's colour: {"transfer", "primaries", "matrix", "hdr": "pq" | "hlg" | None}"""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=color_transfer,color_primaries,color_space", "-of", "json", str(path)], capture_output=True, text=True)
    try:
        s = (json.loads(r.stdout or "{}").get("streams") or [{}])[0]
    except ValueError:
        s = {}
    t = str(s.get("color_transfer") or "")
    return {"transfer": t, "primaries": str(s.get("color_primaries") or ""), "matrix": str(s.get("color_space") or ""),
            "hdr": "pq" if t == "smpte2084" else "hlg" if t == "arib-std-b67" else None}


def to_sdr(col):
    """filters that bring an HDR source into Rec.709 SDR (tone-mapped) - [] for an SDR one"""
    if not col or not col.get("hdr"):
        return []
    tin = "smpte2084" if col["hdr"] == "pq" else "arib-std-b67"
    pin = col.get("primaries") if col.get("primaries") in ("bt2020", "bt709", "smpte432") else "bt2020"
    # npl 203 (BT.2408: the HDR reference white = SDR white, so the mid-tones land where they were graded) + Möbius,
    # linear up to 90 % and only the highlights above white (up to a 1000-nit master = 4.93 x white) rolled off -
    # Hable made SDR white 60 %; npl 100 made the mid-tones twice as bright (an SDR grey 128 came back 170)
    return [f"zscale=tin={tin}:pin={pin}:min=bt2020nc:t=linear:npl={REF_WHITE}:p={pin}", "format=gbrpf32le", "zscale=p=bt709",
            "tonemap=mobius:param=0.9:peak=4.93:desat=0", "zscale=t=bt709:m=bt709:r=tv", "format=yuv420p"]


def out_chain(colour, pix_fmt):
    """filters that put the (Rec.709 SDR) picture into a deliverable's colour - "" for sdr"""
    o = OUT.get(colour)
    if not o:
        return ""
    return (f"zscale=tin=bt709:pin=bt709:min=bt709:rin=tv:t=linear:npl={REF_WHITE}:p=bt709,format=gbrpf32le,"
            f"zscale=p={o['p']}:t={o['t']}:m={o['m']}:r=tv:npl={REF_WHITE},format={pix_fmt}")


def tags(colour):
    """the stream's colour tags (every container / encoder reads these)"""
    o = OUT.get(colour)
    if not o:
        return []
    return ["-color_primaries", o["p"], "-color_trc", o["t"], "-colorspace", o["m"], "-color_range", "tv"]


def x265_params(colour):
    """x265's own colour + HDR10 metadata (the SEI an HDR TV reads)"""
    o = OUT.get(colour)
    if not o:
        return ""
    p = f"colorprim={o['p']}:transfer={o['t']}:colormatrix={o['m']}:range=limited"
    if colour == "hdr10":
        # a BT.2020 / D65 mastering display of 1000 nits; the brightest pixel = the reference white (an SDR master)
        p += (":hdr10=1:repeat-headers=1:master-display=G(8500,39850)B(6550,2300)R(35400,14600)WP(15635,16450)L(10000000,1)"
              f":max-cll={REF_WHITE},{REF_WHITE}")
    elif colour == "hlg":
        p += ":repeat-headers=1"
    return p


def svtav1_params(colour):
    o = OUT.get(colour)
    if not o:
        return ""
    cp = {"bt2020": 9}[o["p"]]
    tc = {"smpte2084": 16, "arib-std-b67": 18, "bt2020-10": 14}[o["t"]]
    p = f"color-primaries={cp}:transfer-characteristics={tc}:matrix-coefficients=9"
    if colour == "hdr10":
        p += f":mastering-display=G(0.17,0.797)B(0.131,0.046)R(0.708,0.292)WP(0.3127,0.329)L(1000,0.0001):content-light={REF_WHITE},{REF_WHITE}"
    return p
