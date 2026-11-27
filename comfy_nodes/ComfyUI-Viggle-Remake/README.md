# ComfyUI-Viggle-Remake (bundled with bitGen Studio 3.4.0)

Viggle Remake's ComfyUI nodes (https://huggingface.co/Viggle/Viggle-Remake - SPDX Apache-2.0, see the header of nodes.py):
RemakeConditioning, RemakeKeyframeUntil, RemakeNoise, RemakePrefix - on ComfyUI's built-in MiniMax H3 support.

This copy is the one Tim uploaded (2026-11-27): `tokenize_segments` tokenizes with `llama_template="{}"` and accepts the
PlatoKeys wrapper's `hf_text`, so a Viggle Remake graph runs with a lighter text encoder patched by PlatoKeys
(Basic Settings ▸ Text encoder - lib/platoKeys.js, scripts/plato_keys_apply.py) as well as with the stock Qwen3-VL-32B.

bitGen copies this folder into ComfyUI's custom_nodes (lib/setupPacks.js, pack "viggle_remake" in lib/nodePacks.json:
"bundled") when a workflow needs one of its nodes, and Settings ▸ Add-ons ▸ 🔑 PlatoKeys puts it there / refreshes an
older copy. Restart ComfyUI after it changes. Powered by Viggle Remake (https://huggingface.co/Viggle/Viggle-Remake).
