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
      ...), 2.585.0 objective sft | dpo | orpo + beta + prefs (prefs.jsonl: {prompt: [messages], chosen, rejected} - TRL's
      DPOTrainer / ORPOTrainer; a chat or pair longer than max_seq_length is left out and said, never cut), (images:
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


def load_prefs(path, system):
    """2.585.0: dataset/prefs.jsonl -> [{prompt: [messages], chosen, rejected}] (the job's system prompt added when the
    pair has none) - 🔁 Compare LLMs: the reply picked vs each one not picked"""
    rows = []
    try:
        f = open(path, encoding="utf-8")
    except OSError:
        return rows
    with f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except Exception:                                   # noqa: BLE001
                continue
            p = r.get("prompt") or []
            if isinstance(p, str):
                p = [{"role": "user", "content": p}]
            ch, rj = str(r.get("chosen") or "").strip(), str(r.get("rejected") or "").strip()
            if not p or p[-1].get("role") != "user" or not ch or not rj or ch == rj:
                continue
            if system and p[0].get("role") != "system":
                p = [{"role": "system", "content": system}] + p
            rows.append({"prompt": p, "chosen": ch, "rejected": rj})
    return rows


def _text_tok(tok):
    """a multimodal loader hands back a processor - its text tokenizer counts and trains text"""
    return getattr(tok, "tokenizer", None) or tok


def _strip_bos(tok, t):
    bos = getattr(_text_tok(tok), "bos_token", None) or ""
    return t[len(bos):] if bos and t.startswith(bos) else t      # the tokenizer adds it again (Unsloth's Gemma notebooks)


def _ntok(tok, text):
    """how many tokens (0 = this tokenizer cannot say - nothing is left out then)"""
    t = _text_tok(tok)
    try:
        return len(t(text, add_special_tokens=False)["input_ids"])
    except Exception:                                           # noqa: BLE001
        try:
            return len(t.encode(text, add_special_tokens=False))
        except Exception:                                       # noqa: BLE001
            return 0


def sft_texts(chats, tok, max_len):
    """the chats as training text; one longer than Max length is LEFT OUT (cut, its answer would be lost) -> (texts, skipped)"""
    out, skipped = [], 0
    for m in chats:
        t = _strip_bos(tok, tok.apply_chat_template(m, tokenize=False, add_generation_prompt=False))
        if max_len and _ntok(tok, t) > max_len:
            skipped += 1
            continue
        out.append({"text": t})
    return out, skipped


def pref_rows(prefs, tok, max_len):
    """2.585.0: the pairs as TRL's plain-text preference rows - the prompt through the model's chat template (with the
    assistant's turn opened), the two answers as written; a pair longer than Max length is left out -> (rows, skipped)"""
    out, skipped = [], 0
    for r in prefs:
        p = _strip_bos(tok, tok.apply_chat_template(r["prompt"], tokenize=False, add_generation_prompt=True))
        if max_len and _ntok(tok, p) + max(_ntok(tok, r["chosen"]), _ntok(tok, r["rejected"])) + 2 > max_len:
            skipped += 1
            continue
        out.append({"prompt": p, "chosen": r["chosen"], "rejected": r["rejected"]})
    return out, skipped


def pref_classes(dpo):
    """TRL's DPO pair - ORPO lives in trl.experimental.orpo since TRL 1.x (trl itself before)"""
    if dpo:
        from trl import DPOConfig, DPOTrainer
        return DPOConfig, DPOTrainer
    try:
        from trl import ORPOConfig, ORPOTrainer
    except ImportError:
        from trl.experimental.orpo import ORPOConfig, ORPOTrainer
    return ORPOConfig, ORPOTrainer


def pref_config(Cls, base, beta, max_len, max_prompt):
    """DPOConfig / ORPOConfig across TRL versions (max_prompt_length went away in some)"""
    for extra in (dict(beta=beta, max_length=max_len, max_prompt_length=max_prompt), dict(beta=beta, max_length=max_len), dict(beta=beta)):
        try:
            return Cls(**base, **extra)
        except TypeError:
            continue
    return Cls(**base)


def make_pref_trainer(Cls, model, tok, data, args, callbacks, dpo):
    """DPOTrainer (ref_model None = the base without the LoRA is the reference) / ORPOTrainer (no reference at all)"""
    kw = dict(model=model, args=args, train_dataset=data, callbacks=callbacks)
    if dpo:
        kw["ref_model"] = None
    t = _text_tok(tok)
    try:
        return Cls(processing_class=t, **kw)
    except TypeError:
        return Cls(tokenizer=t, **kw)


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
    say(f"[ft] {kind} fine-tune of {cfg['model']} - {cfg['method']}" + (f" {cfg['objective'].upper()}" if cfg.get("objective") in ("dpo", "orpo") else "") + (f" r={L['r']} alpha={L['alpha']}" if L else " (every weight)"))
    import unsloth  # noqa: F401  (first: it patches transformers / trl)
    from unsloth import FastLanguageModel, FastModel, FastVisionModel
    from trl import SFTConfig, SFTTrainer
    from transformers import TrainerCallback

    class Progress(TrainerCallback):
        def on_log(self, args, state, control, logs=None, **kw):     # noqa: D401
            if logs and "loss" in logs:
                say(f"[ft] step {state.global_step}/{state.max_steps} loss {float(logs['loss']):.4f}"
                    + (f" lr {float(logs['learning_rate']):.2e}" if "learning_rate" in logs else "")
                    # 2.585.0: DPO / ORPO - how often the picked answer already scores above the other
                    + (f" picked-wins {float(logs['rewards/accuracies']):.2f}" if "rewards/accuracies" in logs else ""))

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
    elif cfg.get("objective") in ("dpo", "orpo"):
        # 2.585.0: PREFERENCE TRAINING - your choices in 🔁 Compare LLMs: the reply picked over each one not picked
        from datasets import Dataset
        dpo = cfg["objective"] == "dpo"
        prefs = load_prefs(cfg.get("prefs") or "", cfg.get("system") or "")
        rows, skipped = pref_rows(prefs, tok, cfg["max_seq_length"])
        if skipped:
            say(f"[ft] {skipped} pair(s) longer than Max length ({cfg['max_seq_length']} tokens) left out - raise Max length to use them")
        if not rows:
            say("[ft] no preference pairs to train on in " + str(cfg.get("prefs")))
            return 2
        say(f"[ft] {len(rows)} preference pairs - {cfg['objective'].upper()}, beta {cfg.get('beta', 0.1)}")
        try:
            from unsloth import PatchDPOTrainer
            PatchDPOTrainer()
        except Exception:                                       # noqa: BLE001  (newer Unsloth patches TRL by itself)
            pass
        PCfg, PTrainer = pref_classes(dpo)
        args = pref_config(PCfg, dict(base, remove_unused_columns=False), float(cfg.get("beta") or 0.1), cfg["max_seq_length"], max(64, cfg["max_seq_length"] // 2))
        trainer = make_pref_trainer(PTrainer, model, tok, Dataset.from_list(rows), args, [Progress()], dpo)
    else:
        from datasets import Dataset
        chats = load_chats(cfg["data"], cfg.get("system") or "")
        if not chats:
            say("[ft] no chats in " + cfg["data"])
            return 2
        texts, skipped = sft_texts(chats, tok, cfg["max_seq_length"])
        if skipped:
            say(f"[ft] {skipped} chat(s) longer than Max length ({cfg['max_seq_length']} tokens) left out - raise Max length to use them")
        if not texts:
            say("[ft] every chat is longer than Max length - raise it")
            return 2
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
