"""bitGen Studio — video and sound reference slots for a MiniMax H3 reference graph (2.353.0).

Tim: "for video generation from prompt the h3_Video_ref workflow doesn't use video reference, can we add
video and sound slots when a reference video and/or sound is added".

An H3 ref2va export only carries the dynamic inputs that were CONNECTED when it was saved: one saved with
pictures only has ref_images.ref_image_* and no ref_videos / ref_audios at all. worker.py's slot fill then
said "template has 0 video slot(s); 1 extra reference(s) ignored" and the reference video / sound never
reached the model. add_missing() gives the MiniMaxH3ReferenceToVideo node the slots its references need,
wired exactly like the official export:

    LoadVideo (file)  -> ref_videos.ref_video_N
    GetVideoComponents(LoadVideo).audio -> ref_video_audios.ref_video_audio_N   (the clip's own sound)
    LoadAudio (audio) -> ref_audios.ref_audio_N

The loaders get placeholder names; the worker's slot fill writes the uploaded files into them. Only a
kind the node has NO slot for is added (a graph with one video slot is grown by the worker's own clone
step). The model takes at most 3 videos and 3 sounds. Pure: no ComfyUI, no files.
"""

REF_NODES = ("MiniMaxH3ReferenceToVideo",)
# a graph that loads a kind ANYWHERE handles it its own way (the MM3 chain's VHS_LoadAudioUpload voices, a
# native-audio song loader) - slots are added only to a graph with no loader of that kind at all
LOADERS = {"LoadVideo": "videos", "VHS_LoadVideo": "videos", "VHS_LoadVideoPath": "videos",
           "LoadAudio": "audios", "VHS_LoadAudio": "audios", "VHS_LoadAudioUpload": "audios"}
MAX = {"videos": 3, "audios": 3}


def _next_id(g):
    return max((int(k) for k in g if str(k).isdigit()), default=1000) + 1


def ref_nodes(g):
    """Ids of the H3 reference nodes (the ones with ref_images.* / ref_videos.* inputs)."""
    return [k for k, v in g.items() if isinstance(v, dict) and str(v.get("class_type", "")) in REF_NODES]


def add_missing(g, n_videos, n_audios, loaders=None):
    """Add video / sound slots to the H3 reference node for the references given. loaders = {class: kind}
    (worker.LOADER_KINDS' kinds; default LOADERS). -> [notes]."""
    notes = []
    ids = ref_nodes(g)
    if not ids:
        return notes
    kinds = loaders or LOADERS
    has = {kinds.get(str(v.get("class_type", ""))) for v in g.values() if isinstance(v, dict)}
    gid = ids[0]
    ins = g[gid].setdefault("inputs", {})
    want = {"videos": min(int(n_videos or 0), MAX["videos"]), "audios": min(int(n_audios or 0), MAX["audios"])}
    if want["videos"] and "videos" not in has and not any(k.startswith("ref_videos.") for k in ins):
        for i in range(want["videos"]):
            lv = str(_next_id(g))
            g[lv] = {"class_type": "LoadVideo", "inputs": {"file": "example.mp4"},
                     "_meta": {"title": f"Load Video (ref {i + 1}, added by bitGen)"}}
            gc = str(_next_id(g))
            g[gc] = {"class_type": "GetVideoComponents", "inputs": {"video": [lv, 0]},
                     "_meta": {"title": f"Video ref {i + 1} components"}}
            ins[f"ref_videos.ref_video_{i}"] = [lv, 0]
            ins[f"ref_video_audios.ref_video_audio_{i}"] = [gc, 1]
        notes.append(f"the graph had no video reference slot - added {want['videos']} "
                     f"(LoadVideo -> {g[gid].get('class_type')}#{gid}.ref_videos, its own sound -> ref_video_audios)")
    if want["audios"] and "audios" not in has and not any(k.startswith("ref_audios.") for k in ins):
        for i in range(want["audios"]):
            la = str(_next_id(g))
            g[la] = {"class_type": "LoadAudio", "inputs": {"audio": "example.wav"},
                     "_meta": {"title": f"Load Audio (ref {i + 1}, added by bitGen)"}}
            ins[f"ref_audios.ref_audio_{i}"] = [la, 0]
        notes.append(f"the graph had no sound reference slot - added {want['audios']} "
                     f"(LoadAudio -> {g[gid].get('class_type')}#{gid}.ref_audios)")
    return notes


def takes_av(g):
    """Can this graph take reference videos / sounds (an H3 reference node, or its own loaders)?"""
    return bool(ref_nodes(g))
