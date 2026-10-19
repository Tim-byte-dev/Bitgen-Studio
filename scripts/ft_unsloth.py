#!/usr/bin/env python3
"""bitGen Studio - scripts/ft_unsloth.py (2.521.0): ONE Unsloth fine-tune, run INSIDE the Unsloth venv (venvs/unsloth)
by finetune_worker.py (or by hand on another machine: python ft_unsloth.py config.json - the trainer's ⤓ Export job).

Tim (verbatim): "can we add a checkpoint finetune option to the lora creator docker to build on existing llm, vision and
image models?"

    config.json (lib/fineTune.js buildFtConfig):
      kind llm | vision, model (a Hugging Face repo or a local folder), loader language | model | vision,
      method lora | qlora | full, chat_template, max_seq_length, lora {r, alpha, dropout, target_modules},
      train {epochs, max_steps, lr, batch, grad_accum, warmup_steps, optimizer, weight_decay, scheduler, seed, save_steps},
      system, instruction (vision: the question every picture answers), data (chat.jsonl), images (the picture folder:
      <picture> + <same name>.txt = the answer), output_dir
    writes output_dir/adapter (the LoRA alone) and output_dir/merged (the whole model, 16-bit - the GGUF converter's
    input); progress lines "[ft] step N/M loss X" (the queue's progress bar)
"""
import json
import os
import sys
import time


def say(msg):
    print(msg, flush=True)


def load_chats(path, system):
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                m = json.loads(line).get("messages") or []
            except Exception:                                   # noqa: BLE001
                continue
            if system and not (m and m[0].get("role") == "system"):
                m = [{"role": "system", "content": system}] + m
            rows.append(m)
    return rows


def load_pictures(folder, instruction, system):
    from PIL import Image
    out = []
    for f in sorted(os.listdir(folder)):
        if not f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            continue
        cap = os.path.join(folder, os.path.splitext(f)[0] + ".txt")
        try:
            answer = open(cap, encoding="utf-8").read().strip()
        except OSError:
            answer = ""
        if not answer:
            continue
        img = Image.open(os.path.join(folder, f)).convert("RGB")
        msgs = []
        if system:
            msgs.append({"role": "system", "content": [{"type": "text", "text": system}]})
        msgs.append({"role": "user", "content": [{"type": "image", "image": img}, {"type": "text", "text": instruction}]})
        msgs.append({"role": "assistant", "content": [{"type": "text", "text": answer}]})
        out.append({"messages": msgs})
    return out


def sft_config(SFTConfig, base, extra, max_len):
    """TRL renamed max_seq_length -> max_length; try the new name first"""
    try:
        return SFTConfig(**base, **extra, max_length=max_len)
    except TypeError:
        return SFTConfig(**base, **extra, max_seq_length=max_len)


def make_trainer(SFTTrainer, **kw):
    """newer TRL: processing_class=; older (and Unsloth's notebooks): tokenizer="""
    tok = kw.pop("tok")
    try:
        return SFTTrainer(processing_class=tok, **kw)
    except TypeError:
        return SFTTrainer(tokenizer=tok, **kw)


def main():
    cfg = json.load(open(sys.argv[1], encoding="utf-8"))
    kind, T, L = cfg["kind"], cfg["train"], cfg.get("lora")
    out = cfg["output_dir"]
    os.makedirs(out, exist_ok=True)
    full = bool(cfg.get("full_finetuning"))
    say(f"[ft] {kind} fine-tune of {cfg['model']} - {cfg['method']}" + (f" r={L['r']} alpha={L['alpha']}" if L else " (every weight)"))
    import unsloth  # noqa: F401  (first: it patches transformers / trl)
    from unsloth import FastLanguageModel, FastModel, FastVisionModel
    from trl import SFTConfig, SFTTrainer
    from transformers import TrainerCallback

    class Progress(TrainerCallback):
        def on_log(self, args, state, control, logs=None, **kw):     # noqa: D401
            if logs and "loss" in logs:
                say(f"[ft] step {state.global_step}/{state.max_steps} loss {float(logs['loss']):.4f}"
                    + (f" lr {float(logs['learning_rate']):.2e}" if "learning_rate" in logs else ""))

    seed = T.get("seed", 3407)
    if kind == "vision":
        kw = dict(load_in_4bit=bool(cfg.get("load_in_4bit")), use_gradient_checkpointing="unsloth")
        if full:
            kw["full_finetuning"] = True
        model, tok = FastVisionModel.from_pretrained(cfg["model"], **kw)
        if L:
            model = FastVisionModel.get_peft_model(model, finetune_vision_layers=bool(L.get("vision_layers", True)),
                                                   finetune_language_layers=True, finetune_attention_modules=True,
                                                   finetune_mlp_modules=True, r=L["r"], lora_alpha=L["alpha"],
                                                   lora_dropout=L.get("dropout", 0), bias="none", random_state=seed)
        Loader = FastVisionModel
    else:
        Loader = FastModel if cfg.get("loader") == "model" else FastLanguageModel
        kw = dict(model_name=cfg["model"], max_seq_length=cfg["max_seq_length"], load_in_4bit=bool(cfg.get("load_in_4bit")), full_finetuning=full)
        if Loader is FastLanguageModel and not cfg.get("load_in_4bit"):
            kw["load_in_16bit"] = True                       # Unsloth: Qwen3.5 trains in 16-bit (4-bit is not recommended)
        try:
            model, tok = Loader.from_pretrained(**kw)
        except TypeError:
            kw.pop("load_in_16bit", None)
            model, tok = Loader.from_pretrained(**kw)
        if L:
            model = Loader.get_peft_model(model, r=L["r"], target_modules=L.get("target_modules"), lora_alpha=L["alpha"],
                                          lora_dropout=L.get("dropout", 0), bias="none", use_gradient_checkpointing="unsloth",
                                          random_state=seed)
    if cfg.get("chat_template"):
        from unsloth.chat_templates import get_chat_template
        tok = get_chat_template(tok, chat_template=cfg["chat_template"])

    base = dict(per_device_train_batch_size=T["batch"], gradient_accumulation_steps=T["grad_accum"], warmup_steps=T["warmup_steps"],
                learning_rate=T["lr"], logging_steps=T.get("logging_steps", 1), optim=T.get("optimizer", "adamw_8bit"),
                weight_decay=T.get("weight_decay", 0.01), lr_scheduler_type=T.get("scheduler", "linear"), seed=seed,
                output_dir=out, report_to="none")
    if T.get("max_steps"):
        base["max_steps"] = T["max_steps"]
    else:
        base["num_train_epochs"] = T.get("epochs", 2) or 1
    if T.get("save_steps"):
        base.update(save_strategy="steps", save_steps=T["save_steps"])
    else:
        base["save_strategy"] = "no"

    if kind == "vision":
        from unsloth.trainer import UnslothVisionDataCollator
        data = load_pictures(cfg["images"], cfg.get("instruction") or "Describe this picture.", cfg.get("system") or "")
        if not data:
            say("[ft] no picture has an answer (.txt) - nothing to train")
            return 2
        say(f"[ft] {len(data)} pictures with their answers")
        FastVisionModel.for_training(model)
        args = sft_config(SFTConfig, base, dict(remove_unused_columns=False, dataset_text_field="", dataset_kwargs={"skip_prepare_dataset": True}),
                          cfg["max_seq_length"])
        trainer = make_trainer(SFTTrainer, model=model, tok=tok, data_collator=UnslothVisionDataCollator(model, tok),
                               train_dataset=data, args=args, callbacks=[Progress()])
    else:
        from datasets import Dataset
        chats = load_chats(cfg["data"], cfg.get("system") or "")
        if not chats:
            say("[ft] no chats in " + cfg["data"])
            return 2
        bos = getattr(tok, "bos_token", None) or ""
        texts = []
        for m in chats:
            t = tok.apply_chat_template(m, tokenize=False, add_generation_prompt=False)
            if bos and t.startswith(bos):
                t = t[len(bos):]                              # the tokenizer adds it again (Unsloth's Gemma notebooks)
            texts.append({"text": t})
        say(f"[ft] {len(texts)} chats")
        args = sft_config(SFTConfig, base, dict(dataset_text_field="text"), cfg["max_seq_length"])
        trainer = make_trainer(SFTTrainer, model=model, tok=tok, train_dataset=Dataset.from_list(texts), args=args, callbacks=[Progress()])

    t0 = time.time()
    trainer.train()
    say(f"[ft] trained in {(time.time() - t0) / 60:.1f} min")
    merged = os.path.join(out, "merged")
    if L:
        model.save_pretrained(os.path.join(out, "adapter"))
        tok.save_pretrained(os.path.join(out, "adapter"))
        say("[ft] saving the merged 16-bit model (the base + your LoRA)")
        model.save_pretrained_merged(merged, tok, save_method="merged_16bit")
    else:
        model.save_pretrained(merged)
        tok.save_pretrained(merged)
    say("[ft] the merged model is in " + merged)
    return 0


if __name__ == "__main__":
    sys.exit(main())
