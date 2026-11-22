"""bitGen Studio test stand-in (2.919.0) for Inworld's `inworld` namespace: sava + voice_isolation with the same API the real
packages document (sava.load / Session / TurnSegmenter / Policy; voice_isolation.VoiceIsolator(mode="streaming").stream()),
numpy only, so scripts/voice_stream.py runs in the suite with no torch and no weights. Speech = a frame's level above a
threshold; the end of a turn = 400 ms quiet after speech. The voice isolator halves anything below the speech level."""
