# Downloads the MiniMax H3 model set (~50 GB) into the app's models\ folder
# Requires: pip install -r requirements.txt  (huggingface_hub)
$AppRoot = Split-Path -Parent $PSScriptRoot   # 2.591.0: this script is in misc\ - the app folder is its parent
$dest = Join-Path $AppRoot "models"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

hf download unsloth/MiniMax-H3-GGUF `
  minimax_h3_ref2va_pruned-Q6_K.gguf `
  minimax_h3_fl2va_pruned-Q6_K.gguf `
  qwen3vl_32b_minimax_h3-Q4_K_M.gguf `
  --local-dir $dest

hf download Comfy-Org/MiniMax-H3 `
  --include "*video_vae_fp16.safetensors" "*audio_vae_fp32.safetensors" `
  --local-dir $dest

# The Comfy-Org repo may nest files in subfolders; flatten them:
Get-ChildItem $dest -Recurse -Include *vae*.safetensors |
  Where-Object { $_.DirectoryName -ne $dest } |
  Move-Item -Destination $dest -Force

Write-Host "Done. Models are in $dest - bitGen Studio's defaults already point there."
