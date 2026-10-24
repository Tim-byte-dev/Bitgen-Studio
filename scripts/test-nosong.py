#!/usr/bin/env python3
"""bitGen Studio — 2.323.0: NATIVE AUDIO WITHOUT A SONG (scripts/nosong.py).
Tim: "if screenplay then there won't be a song, but i would still like to
render with the nativeaudio workflow".
  1. the fl2va twin: the lock out, model / latent re-wired, VAEDecodeAudio
     makes the sound, the song loader + trim gone;
  2. a ref2va-shaped graph: the song slot dropped, the voice slots renumbered
     from 0 (the app's <Audio n> numbering), the song loader gone;
  3. a graph with no lock is untouched; the worker runs it BEFORE any loader
     is filled, only for a no_song job.
Run from repo root: python3 scripts/test-nosong.py"""
import copy, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import nosong as ns  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {extra}"))
    if not cond:
        FAILED.append(name)


FL = json.loads((ROOT / "comfy_workflows" / "MMH3_NativeAudio_MV_fl2va.json").read_text())
g, n = ns.unlock(FL)
cls = {k: v["class_type"] for k, v in g.items() if isinstance(v, dict)}
dec = next((k for k, c in cls.items() if c == "VAEDecodeAudio"), None)
check("fl2va twin: no NativeAudioLock, no song loader / trim; the model's own audio decoded by VAEDecodeAudio (the audio VAE)",
      "MiniMaxH3NativeAudioLock" not in cls.values() and "LoadAudio" not in cls.values()
      and "TrimAudioDuration" not in cls.values() and dec and g[dec]["inputs"]["samples"] == ["54", 0]
      and g[dec]["inputs"]["vae"] == ["13", 0] and "the model makes the sound itself" in n[0], (cls, n))
check("...the guider + scheduler take the loader's model, the sampler the gen node's AV latent, CreateVideo the decoded audio",
      g["53"]["inputs"]["model"] == ["10", 0] and g["52"]["inputs"]["model"] == ["10", 0]
      and g["54"]["inputs"]["latent_image"] == ["40", 1] and g["61"]["inputs"]["audio"] == [dec, 0]
      and FL["61"]["inputs"]["audio"] == ["41", 2], (g["53"], g["54"], g["61"]))
R2 = {
    "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "m"}},
    "2": {"class_type": "VAELoader", "inputs": {"vae_name": "v"}},
    "3": {"class_type": "VAELoader", "inputs": {"vae_name": "a"}},
    "30": {"class_type": "LoadAudio", "inputs": {"audio": "SONG.mp3"}},
    "31": {"class_type": "TrimAudioDuration", "inputs": {"audio": ["30", 0], "start_index": 0, "duration": 5}},
    "32": {"class_type": "LoadAudio", "inputs": {"audio": "voice1.wav"}},
    "33": {"class_type": "LoadAudio", "inputs": {"audio": "voice2.wav"}},
    "40": {"class_type": "MiniMaxH3ReferenceToVideo", "inputs": {
        "prompt": "", "ref_audios.ref_audio_0": ["31", 0], "ref_audios.ref_audio_1": ["32", 0],
        "ref_audios.ref_audio_2": ["33", 0], "vae": ["2", 0]}},
    "41": {"class_type": "MiniMaxH3NativeAudioLock", "inputs": {"model": ["1", 0], "av_latent": ["40", 1],
                                                                 "audio_vae": ["3", 0], "audio": ["31", 0]}},
    "53": {"class_type": "BasicGuider", "inputs": {"model": ["41", 0], "conditioning": ["40", 0]}},
    "54": {"class_type": "SamplerCustomAdvanced", "inputs": {"guider": ["53", 0], "latent_image": ["41", 1]}},
    "60": {"class_type": "VAEDecode", "inputs": {"samples": ["54", 0], "vae": ["2", 0]}},
    "61": {"class_type": "CreateVideo", "inputs": {"images": ["60", 0], "audio": ["41", 2]}},
    "62": {"class_type": "SaveVideo", "inputs": {"video": ["61", 0]}},
}
g2, _ = ns.unlock(R2)
gen = g2["40"]["inputs"]
check("ref2va shape: the song slot dropped, the voices renumbered ref_audio_0 / _1 (the <Audio n> order holds), the song loader + trim gone",
      gen.get("ref_audios.ref_audio_0") == ["32", 0] and gen.get("ref_audios.ref_audio_1") == ["33", 0]
      and "ref_audios.ref_audio_2" not in gen and "30" not in g2 and "31" not in g2 and "41" not in g2
      and "32" in g2 and "33" in g2, gen)
check("...no lock -> untouched, silent; the input graph is never mutated",
      ns.unlock({"1": {"class_type": "SaveVideo", "inputs": {}}}) == ({"1": {"class_type": "SaveVideo", "inputs": {}}}, [])
      and R2["40"]["inputs"]["ref_audios.ref_audio_0"] == ["31", 0])
W = (ROOT / "misc" / "worker.py").read_text()
check("worker: a no_song job takes the lock out right after the graph loads - BEFORE any upload / loader fill",
      'if params.get("no_song"):' in W and "g, nsnotes = _ns.unlock(g)" in W
      and W.index("g, nsnotes = _ns.unlock(g)") < W.index("srcs, snotes = _frame_sources(g, seg_mode, refs, first_frame, last_frame)"))
print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
