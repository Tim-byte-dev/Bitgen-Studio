# bitGen Studio — the bitGen pod image (2.900.0): RunPod's PyTorch image + ComfyUI, its Python environment, ComfyUI-Manager
# and the node packs bitGen's styles use most, already installed. Built and published by GitHub
# (.github/workflows/pod-image.yml) as ghcr.io/tim-byte-dev/bitgen-pod - the image of the "bitGen Studio pod" RunPod template.
# Build from the REPO's top folder:   docker build -f misc/pod-image/Dockerfile --build-arg BASE=<a line of bases.txt> .
ARG BASE=runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2404
FROM ${BASE}
ARG BASE
ARG COMFY_REF=
ARG BITGEN_IMAGE=ghcr.io/tim-byte-dev/bitgen-pod
LABEL org.opencontainers.image.source="https://github.com/Tim-byte-dev/Bitgen-Studio" \
      org.opencontainers.image.title="bitGen Studio pod" \
      org.opencontainers.image.description="RunPod PyTorch + ComfyUI, ComfyUI-Manager and bitGen Studio's node packs, ready to use" \
      org.opencontainers.image.licenses="MIT" \
      ai.bitgen.base="${BASE}"
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN (command -v git >/dev/null && command -v curl >/dev/null) || (apt-get update -qq && apt-get install -y -qq --no-install-recommends git curl && rm -rf /var/lib/apt/lists/*)
COPY lib/nodePacks.json misc/pod-image/packs.txt misc/pod-image/bake.sh /opt/bitgen/build/
RUN COMFY_REF="${COMFY_REF}" BITGEN_IMAGE="${BITGEN_IMAGE}" POD_HERE=/opt/bitgen/build bash /opt/bitgen/build/bake.sh && rm -rf /opt/bitgen/build /root/.cache
COPY misc/pod-image/pre_start.sh /pre_start.sh
COPY misc/pod-image/post_start.sh /post_start.sh
RUN chmod +x /pre_start.sh /post_start.sh
# RunPod's /start.sh (the base image's command) stays the command: nginx, /pre_start.sh, SSH, Jupyter, /post_start.sh
