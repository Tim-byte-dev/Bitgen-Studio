"""bitGen Studio — NATIVE AUDIO WITHOUT A SONG (2.323.0).

Tim: "i would like to get rid of the looping workflows and replace them with
the ref2va and fl2va ... if screenplay then there won't be a song, but i
would still like to render with the nativeaudio workflow".

The MMH3 native-audio graphs (ref2va MMH3_NativeAudio_MV, its fl2va twin)
LOCK a song window into the H3 audio latent:
    LoadAudio(song) -> TrimAudioDuration -> MiniMaxH3NativeAudioLock
      model   -> the guider / scheduler     (the lock-patched model)
      latent  -> the sampler's latent_image
      audio   -> CreateVideo.audio          (the exact song window)
    (ref2va also feeds the trimmed song to ref_audios.ref_audio_0)
unlock(g) turns that into the plain native-audio render the official H3
fl2va / ref2va templates use - the MODEL makes the sound (speech, effects,
ambience), steered by the prompt and the voice references:
    the lock's model output  -> the loader's model
    the lock's latent output -> the gen node's AV latent
    the lock's audio output  -> VAEDecodeAudio(sampler latent, the audio VAE)
    the song loader / trim / lock are removed; the gen node's audio slots are
    renumbered from 0 over the REMAINING loaders (the voices), so the app's
    <Audio n> numbering holds.
Pure: (graph, notes) out; a graph with no lock is returned untouched.
"""
import copy
import re

LOCK = "MiniMaxH3NativeAudioLock"


def _is_link(v):
    return isinstance(v, list) and len(v) == 2 and isinstance(v[0], (str, int))


def _free(g, base):
    k = base
    while k in g:
        k += "_"
    return k


def unlock(g):
    if not isinstance(g, dict):
        return g, []
    locks = [k for k, v in g.items() if isinstance(v, dict) and v.get("class_type") == LOCK]
    if not locks:
        return g, []
    g = copy.deepcopy(g)
    notes = []
    for lk in locks:
        ins = g[lk].get("inputs") or {}
        model, latent, avae = ins.get("model"), ins.get("av_latent"), ins.get("audio_vae")
        if not (_is_link(model) and _is_link(latent) and _is_link(avae)):
            notes.append(f"no-song: lock {lk} is not wired as expected - left in place")
            continue
        # the song chain behind the lock (trim -> loader)
        song_nodes = []
        a = ins.get("audio")
        while _is_link(a) and str(a[0]) in g:
            n = g[str(a[0])]
            song_nodes.append(str(a[0]))
            a = (n.get("inputs") or {}).get("audio")
        # the sampler whose latent comes from the lock's latent output
        sampler = next((k for k, v in g.items() if isinstance(v, dict)
                        and (v.get("inputs") or {}).get("latent_image") == [lk, 1]), None)
        dec = None
        if sampler is not None:
            dec = _free(g, "ns_audio_decode")
            g[dec] = {"class_type": "VAEDecodeAudio", "_meta": {"title": "bitGen: the model's own audio"},
                      "inputs": {"samples": [sampler, 0], "vae": list(avae)}}
        for k, v in g.items():
            if not isinstance(v, dict) or k == lk:
                continue
            for key, val in list((v.get("inputs") or {}).items()):
                if not _is_link(val) or str(val[0]) != lk:
                    continue
                slot = int(val[1])
                if slot == 0:
                    v["inputs"][key] = list(model)
                elif slot == 1:
                    v["inputs"][key] = list(latent)
                elif slot == 2 and dec:
                    v["inputs"][key] = [dec, 0]
        g.pop(lk, None)
        # drop the song chain, and every gen-node slot that read it
        for k, v in g.items():
            if not isinstance(v, dict):
                continue
            ins2 = v.get("inputs") or {}
            for key in [kk for kk, vv in ins2.items() if _is_link(vv) and str(vv[0]) in song_nodes]:
                ins2.pop(key)
        for sn in song_nodes:
            g.pop(sn, None)
        # renumber the dotted audio slots from 0 (the voices keep their order)
        for k, v in g.items():
            if not isinstance(v, dict) or "MiniMaxH3" not in str(v.get("class_type", "")):
                continue
            ins3 = v.get("inputs") or {}
            slots = sorted([kk for kk in ins3 if re.fullmatch(r"\w+\.ref_audio_\d+", kk)],
                           key=lambda s: int(s.rsplit("_", 1)[1]))
            if not slots:
                continue
            prefix = slots[0].split(".", 1)[0]
            links = [ins3.pop(s) for s in slots]
            for i, link in enumerate(links):
                ins3[f"{prefix}.ref_audio_{i}"] = link
        notes.append(f"no song: the lock {lk} and the song loader are out - the model makes the "
                     f"sound itself" + (f" (audio decoded by {dec})" if dec else "")
                     + "; the voices are the audio references")
    return g, notes
