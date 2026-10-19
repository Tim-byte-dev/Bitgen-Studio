#!/usr/bin/env python3
"""bitGen Studio — THE image output name builder (2.83.0).

Every still this app produces gets its name from here, so there is one place
that decides what a generated picture is called and one place to change it.

THE NAME IS A RECORD, NOT A LABEL:

    20260822-193545_s316826193_61e2ec4b3780.png
    |               |          |
    |               |          +-- the job id: unique per press, full stop
    |               +------------- the seed that drew it
    +----------------------------- when it was drawn (sorts chronologically)

WHY THE SEED IS IN THE NAME. A picture worth keeping is worth being able to
make again, and the seed is the only thing that lets you. It used to live in
the job log, which is discarded when the job list is trimmed, while the picture
lives in the project forever. The two facts belong on the same object.

WHY THE JOB ID IS STILL IN THE NAME even though the seed is nearly unique on
its own: a pinned seed is not unique at all. Type seed 7 twice and the two
renders differ only by the id. The timestamp does not cover it either — two
presses inside the same second share it.

WHY reserve() EXISTS ANYWAY. Everything above is generated, and generated
uniqueness is an argument, not a guarantee: a clock that goes backwards, a
restored project, a job dir reused by a caller that pre-allocates one. An
overwrite loses a picture silently, which is the one outcome worth spending a
stat() per file to avoid. So the name is checked against the disk before it is
written and stepped aside if it is taken, using the same " (2)" convention as
freeName() in lib/autoAssets.js, so a project's files all read alike.

Pure apart from reserve(), which is the only function here that touches disk.
"""
import os
import time

__all__ = ["stamp", "build_stem", "image_name", "reserve"]


def stamp(when=None):
    """`YYYYMMDD-HHMMSS` in local time — the same format renders already use."""
    return time.strftime("%Y%m%d-%H%M%S", time.localtime(when))


def build_stem(job_id, seed=None, when=None):
    """The shared part of every filename in one job.

    `seed` is omitted from the name when it is None or negative: a negative seed
    means "the engine will roll its own", so writing it down would be a lie
    (it would say `s-1`, which reproduces nothing).
    """
    parts = [stamp(when)]
    try:
        s = int(seed)
    except (TypeError, ValueError):
        s = -1
    if seed is not None and s >= 0:
        parts.append("s%d" % s)
    jid = "".join(c for c in str(job_id or "") if c.isalnum() or c in "-_")
    if jid:
        parts.append(jid)
    return "_".join(parts)


def image_name(stem, index=0, count=1, ext=".png"):
    """`<stem>.png` for a single image, `<stem>_01.png`.. for a batch.

    A batch is numbered even when it is short, because "_01" next to "_02" reads
    as an ordered set while "cat.png" next to "cat_2.png" reads as an accident.
    """
    if not ext.startswith("."):
        ext = "." + ext
    if count <= 1:
        return stem + ext
    return "%s_%02d%s" % (stem, index + 1, ext)


def reserve(directory, name):
    """A name inside `directory` that is not taken. Never returns an existing one.

    Mirrors lib/autoAssets.js freeName(): `x.png` -> `x (2).png` -> `x (3).png`.
    Gives up after 999 and appends the clock in microseconds, because failing to
    name a file that has already been rendered would throw the picture away.
    """
    if not name:
        raise ValueError("reserve() needs a name")
    if not os.path.exists(os.path.join(directory, name)):
        return name
    stem, ext = os.path.splitext(name)
    for n in range(2, 1000):
        cand = "%s (%d)%s" % (stem, n, ext)
        if not os.path.exists(os.path.join(directory, cand)):
            return cand
    return "%s (%d)%s" % (stem, int(time.time() * 1e6) % 10 ** 9, ext)
