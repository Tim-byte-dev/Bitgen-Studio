"""bitGen Studio — a workflow's model file -> the name THIS ComfyUI lists (2.345.0).

Tim's LTX Ripple run: "node 821: Value not in list [unet_name] =
ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors ... not in
(list of length 37)". A workflow names a file the way ITS machine listed it;
the same file in a subfolder here (LTX\\...), or a sibling variant, is a
different string. comfy_client.canonicalise_combos only repairs separator /
case differences; this goes one step further, and never guesses blindly:

  1. the same base name anywhere in the list (a subfolder) - always safe;
  2. else, only when a pattern says what KIND of file it is (the LTX 2.5
     transformer, the Gemma text encoder ...), the listed file of that kind
     sharing the most name tokens with the wanted one;
  3. else None - the caller fails in words, naming what it looked for.

Pure: no ComfyUI, no files.
"""
import re
from pathlib import PurePath


def base(n):
    return PurePath(str(n).replace("\\", "/")).name.lower()


def tokens(n):
    return set(t for t in re.split(r"[^a-z0-9]+", base(n).rsplit(".", 1)[0]) if t)


def best(names, want, pattern=None):
    """-> (name as listed | None, how): how = "exact" | "subfolder" |
    "similar" | "unlisted" (no list to check: the wanted name kept) | ""."""
    names = [str(x) for x in (names or [])]
    if not names:
        return want, "unlisted"
    if want in names:
        return want, "exact"
    b = base(want)
    same = [n for n in names if base(n) == b]
    if same:
        return same[0], "subfolder"
    if not pattern:
        return None, ""
    kind = [n for n in names if re.search(pattern, base(n), re.I)]
    if not kind:
        return None, ""
    tw = tokens(want)
    kind.sort(key=lambda n: (-len(tokens(n) & tw), len(base(n)), n))
    return kind[0], "similar"
