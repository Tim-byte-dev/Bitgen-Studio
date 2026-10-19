"""bitGen Studio — a TINY random-weight MiniMax-H3 in the official diffusers layout (2.352.0, test tool).

    <python with torch + diffusers + transformers> tiny_h3.py <root>

Writes <root>/MiniMax-H3 exactly as the real download is laid out -
modular_model_index.json, transformer/ (fl2va / t2va), transformer_ref/
(ref2va), text_encoder/ (a tiny Qwen3-VL with 51 decoder layers: H3 reads
hidden_states[50]), tokenizer/, processor/, vae/, audio_vae/, scheduler/,
audio_scheduler/ - so scripts/native/*.py run their REAL code paths on CPU.
Numbers are noise; this proves plumbing against diffusers/transformers, not looks.
"""
import json
import os
import sys

import torch


def build(root, seed=0):
    from diffusers import (AutoencoderKLMiniMaxH3, AutoencoderKLMiniMaxH3Audio, MiniMaxH3Scheduler,
                           MiniMaxH3Transformer3DModel)
    from tokenizers import Tokenizer, models, pre_tokenizers, decoders
    from transformers import (Qwen2TokenizerFast, Qwen3VLConfig, Qwen3VLForConditionalGeneration, Qwen3VLProcessor)
    from transformers.models.qwen2_vl.image_processing_qwen2_vl import Qwen2VLImageProcessor
    from transformers.models.qwen3_vl.video_processing_qwen3_vl import Qwen3VLVideoProcessor

    torch.manual_seed(seed)
    base = os.path.join(root, "MiniMax-H3")
    os.makedirs(base, exist_ok=True)
    # ---- tokenizer: byte-level BPE over the 256 bytes + Qwen's vision specials
    from tokenizers.pre_tokenizers import ByteLevel
    alphabet = ByteLevel.alphabet()
    vocab = {ch: i for i, ch in enumerate(sorted(alphabet))}
    tok = Tokenizer(models.BPE(vocab=vocab, merges=[]))
    tok.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tok.decoder = decoders.ByteLevel()
    specials = ["<|endoftext|>", "<|im_start|>", "<|im_end|>", "<|vision_start|>", "<|vision_end|>",
                "<|image_pad|>", "<|video_pad|>"]
    tok.add_special_tokens(specials)
    ht = Qwen2TokenizerFast(tokenizer_object=tok, eos_token="<|endoftext|>", pad_token="<|endoftext|>", unk_token=None)
    ids = {s: ht.convert_tokens_to_ids(s) for s in specials}
    ht.save_pretrained(os.path.join(base, "tokenizer"))
    # ---- text encoder: tiny Qwen3-VL, 51 decoder layers, vision patch 16 / merge 2 / temporal 2 (the real geometry)
    text_dim = 16
    cfg = Qwen3VLConfig(
        text_config=dict(hidden_size=text_dim, num_hidden_layers=51, num_attention_heads=2, num_key_value_heads=1,
                         intermediate_size=32, head_dim=8, vocab_size=len(ht), max_position_embeddings=4096,
                         rope_scaling={"rope_type": "default", "mrope_section": [1, 1, 2], "mrope_interleaved": True},
                         rope_theta=10000.0),
        vision_config=dict(hidden_size=16, depth=2, num_heads=2, intermediate_size=32, patch_size=16,
                           spatial_merge_size=2, temporal_patch_size=2, out_hidden_size=text_dim,
                           deepstack_visual_indexes=[0], num_position_embeddings=64, in_channels=3),
        image_token_id=ids["<|image_pad|>"], video_token_id=ids["<|video_pad|>"],
        vision_start_token_id=ids["<|vision_start|>"], vision_end_token_id=ids["<|vision_end|>"])
    Qwen3VLForConditionalGeneration(cfg).save_pretrained(os.path.join(base, "text_encoder"))
    proc = Qwen3VLProcessor(image_processor=Qwen2VLImageProcessor(patch_size=16, merge_size=2, temporal_patch_size=2,
                                                                   min_pixels=32 * 32, max_pixels=64 * 64),
                            tokenizer=ht,
                            video_processor=Qwen3VLVideoProcessor(patch_size=16, merge_size=2, temporal_patch_size=2))
    proc.save_pretrained(os.path.join(base, "processor"))
    # ---- the DiT (two partitions), the VAEs, the schedulers
    tcfg = dict(num_attention_heads=2, attention_head_dim=16, hidden_size=24, num_layers=2, num_refiner_layers=2,
                ffn_dim=32, in_channels=4, audio_in_channels=8, patch_size=(1, 2, 2), text_dim=text_dim, freq_dim=8,
                time_embed_hidden_dim=24, time_embed_dim=16, rope_freq_dim=2)
    MiniMaxH3Transformer3DModel(**tcfg).save_pretrained(os.path.join(base, "transformer"))
    MiniMaxH3Transformer3DModel(**tcfg).save_pretrained(os.path.join(base, "transformer_ref"))
    AutoencoderKLMiniMaxH3(in_channels=3, out_channels=3, latent_channels=4, block_out_channels=(8, 16), layers_per_block=1,
                           spatial_downsample_factors=(2, 2), temporal_downsample_factors=(2, 2), norm_num_groups=8,
                           decoder_num_layers=2, decoder_num_attention_heads=2, decoder_attention_head_dim=8,
                           decoder_num_register_tokens=2, decoder_ffn_mult=2, clip_length=17, token_drop=3,
                           latents_mean=(0.0,) * 4, latents_std=(1.0,) * 4).save_pretrained(os.path.join(base, "vae"))
    AutoencoderKLMiniMaxH3Audio(encoder_dim=4, encoder_rates=(2, 2), latent_dim=32, latent_channels=8, num_attention_heads=2,
                                decoder_dim=16, decoder_rates=(2, 2), decoder_kernel_sizes=(4, 4), resblock_kernel_sizes=(3, 7),
                                resblock_dilation_sizes=((1, 3), (1, 3)), sampling_rate=32000, latents_mean=[0.0] * 8,
                                latents_std=[1.0] * 8).save_pretrained(os.path.join(base, "audio_vae"))
    MiniMaxH3Scheduler(shift=12.0).save_pretrained(os.path.join(base, "scheduler"))
    MiniMaxH3Scheduler(shift=3.0).save_pretrained(os.path.join(base, "audio_scheduler"))

    def spec(lib, cls, sub):
        return [lib, cls, {"type_hint": [lib, cls], "pretrained_model_name_or_path": "MiniMaxAI/MiniMax-H3",
                           "subfolder": sub, "variant": None, "revision": None}]
    idx = {"_class_name": "MiniMaxH3ModularPipeline", "_diffusers_version": "0.36.0.dev0", "_blocks_class_name": "MiniMaxH3Blocks",
           "text_encoder": spec("transformers", "Qwen3VLForConditionalGeneration", "text_encoder"),
           "tokenizer": spec("transformers", "Qwen2TokenizerFast", "tokenizer"),
           "processor": spec("transformers", "Qwen3VLProcessor", "processor"),
           "vae": spec("diffusers", "AutoencoderKLMiniMaxH3", "vae"),
           "audio_vae": spec("diffusers", "AutoencoderKLMiniMaxH3Audio", "audio_vae"),
           "transformer": spec("diffusers", "MiniMaxH3Transformer3DModel", "transformer"),
           "transformer_ref": spec("diffusers", "MiniMaxH3Transformer3DModel", "transformer_ref"),
           "scheduler": spec("diffusers", "MiniMaxH3Scheduler", "scheduler"),
           "audio_scheduler": spec("diffusers", "MiniMaxH3Scheduler", "audio_scheduler")}
    json.dump(idx, open(os.path.join(base, "modular_model_index.json"), "w"), indent=1)
    # ---- a matching Viggle-Animate folder: its transformer (the ref2va shape), a bare-key LoRA, the frozen prompt
    from peft import LoraConfig, get_peft_model_state_dict
    from safetensors.torch import save_file
    vig = os.path.join(root, "Viggle-Animate")
    tv = MiniMaxH3Transformer3DModel(**tcfg)
    tv.save_pretrained(os.path.join(vig, "transformer"))
    tv.add_adapter(LoraConfig(r=4, lora_alpha=4, target_modules=["to_q", "to_k", "to_v"], init_lora_weights=False))
    os.makedirs(os.path.join(vig, "lora"), exist_ok=True)
    save_file({k: v.contiguous() for k, v in get_peft_model_state_dict(tv).items()},
              os.path.join(vig, "lora", "pytorch_lora_weights.safetensors"))
    os.makedirs(os.path.join(vig, "assets"), exist_ok=True)
    torch.save({"prompt_embeds": torch.randn(1, 6, text_dim), "text_token_tags": torch.ones(6, dtype=torch.long),
                "presentation": "<Video 1>: <Picture 1>: replace the person"},
               os.path.join(vig, "assets", "fixed_embed_fwd_anyframe.pt"))
    return base


if __name__ == "__main__":
    print(build(os.path.abspath(sys.argv[1])))
