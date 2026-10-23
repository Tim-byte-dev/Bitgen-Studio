#!/usr/bin/env python3
"""bitGen Studio — scripts/test-ftpref585.py (2.585.0): scripts/ft_unsloth.py's PREFERENCE training (DPO / ORPO) and
its SFT length guard, with the REAL TRL trainers on the CPU and a tiny model built here (no download, no Unsloth, no GPU).

Tim: "can we use this to train a gguff llm?" -> "go with your suggestions": 🔁 Compare LLMs' picks become prefs.jsonl
({prompt, chosen, rejected}); the trainer learns "this, not that". Checks: load_prefs (the job's system prompt added, bad
rows dropped), pref_rows (the prompt through the chat template with the answer turn opened; a pair over Max length left
out), sft_texts (a chat over Max length left out, never cut), pref_config across TRL versions, pref_classes (ORPO from
trl or trl.experimental.orpo), and two real optimizer steps of DPOTrainer + ORPOTrainer on a LoRA-free tiny Llama.

Run with a Python that has torch + transformers + trl + datasets (CADGEN_VENV / FTPREF_PY in the gate); without them:
SKIP (exit 0).
"""
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
PASS = FAIL = 0


def check(name, ok, got=None):
    global PASS, FAIL
    if ok:
        PASS += 1
        print("PASS: " + name)
    else:
        FAIL += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + repr(got)[:900]))


try:
    import torch  # noqa: F401
    import transformers  # noqa: F401
    import trl  # noqa: F401
    import datasets  # noqa: F401
except Exception as e:                                          # noqa: BLE001
    print("SKIP: no torch / transformers / trl / datasets here (" + str(e) + ") - the 2.585.0 trainer test did not run")
    sys.exit(0)

import ft_unsloth as F                                          # noqa: E402
from tokenizers import Tokenizer, models, pre_tokenizers, trainers  # noqa: E402
from transformers import LlamaConfig, LlamaForCausalLM, PreTrainedTokenizerFast  # noqa: E402

tmp = tempfile.mkdtemp(prefix="bg-ftpref585-")

# ---------------------------------------------------------------- a tiny tokenizer + model, made here
corpus = ["write a video prompt about a fox at dawn", "a red fox walks through misty grass, golden light, slow dolly",
          "fox, dawn, mist", "you are the assistant of bitGen Studio", "the user asks", "the assistant answers"] * 20
tk = Tokenizer(models.WordLevel(unk_token="<unk>"))
tk.pre_tokenizer = pre_tokenizers.Whitespace()
tk.train_from_iterator(corpus, trainers.WordLevelTrainer(special_tokens=["<unk>", "<pad>", "<s>", "</s>", "<|user|>", "<|assistant|>", "<|system|>"]))
tok = PreTrainedTokenizerFast(tokenizer_object=tk, unk_token="<unk>", pad_token="<pad>", bos_token="<s>", eos_token="</s>")
tok.chat_template = ("{{ bos_token }}{% for m in messages %}<|{{ m['role'] }}|> {{ m['content'] }} </s> {% endfor %}"
                     "{% if add_generation_prompt %}<|assistant|> {% endif %}")
model = LlamaForCausalLM(LlamaConfig(vocab_size=len(tok), hidden_size=32, intermediate_size=64, num_hidden_layers=2,
                                     num_attention_heads=2, num_key_value_heads=2, max_position_embeddings=256,
                                     pad_token_id=tok.pad_token_id, bos_token_id=tok.bos_token_id, eos_token_id=tok.eos_token_id))

# ---------------------------------------------------------------- the data
prefs_path = os.path.join(tmp, "prefs.jsonl")
rows = [
    {"prompt": [{"role": "user", "content": "write a video prompt about a fox at dawn"}],
     "chosen": "a red fox walks through misty grass, golden light, slow dolly", "rejected": "fox, dawn, mist"},
    {"prompt": [{"role": "system", "content": "you are the assistant of bitGen Studio"}, {"role": "user", "content": "write a video prompt about a fox at dawn"}],
     "chosen": "a red fox walks through misty grass", "rejected": "fox, dawn"},
    {"prompt": [{"role": "user", "content": "x"}], "chosen": "same", "rejected": "same"},             # no difference: dropped
    {"prompt": [{"role": "assistant", "content": "x"}], "chosen": "a", "rejected": "b"},           # does not end with the user: dropped
    {"prompt": "write a video prompt about a fox at dawn", "chosen": "a red fox", "rejected": "fox"},  # a plain-text prompt
]
with open(prefs_path, "w", encoding="utf-8") as f:
    f.write("\n".join(json.dumps(r) for r in rows) + "\nnot json\n")
P = F.load_prefs(prefs_path, "you are the assistant of bitGen Studio")
check("load_prefs: good rows kept (3 of 5 + a broken line), the job's system prompt added where a pair has none, a plain prompt becomes a user turn",
      len(P) == 3 and all(p["prompt"][0]["role"] == "system" for p in P) and P[2]["prompt"][-1] == {"role": "user", "content": "write a video prompt about a fox at dawn"}, P)
R, skipped = F.pref_rows(P, tok, 256)
check("pref_rows: the prompt through the chat template with the answer turn open (no doubled <s>), the answers as written",
      len(R) == 3 and skipped == 0 and R[0]["prompt"].endswith("<|assistant|> ") and not R[0]["prompt"].startswith("<s>") and R[0]["chosen"].startswith("a red fox"), R[:1])
R2, sk2 = F.pref_rows(P, tok, 12)
check("pref_rows: a pair longer than Max length is left out (never cut)", sk2 >= 1 and len(R2) + sk2 == 3, (len(R2), sk2))
chats = [[{"role": "user", "content": "the user asks"}, {"role": "assistant", "content": "the assistant answers"}],
         [{"role": "user", "content": " ".join(["fox"] * 80)}, {"role": "assistant", "content": "dawn"}]]
T, sk3 = F.sft_texts(chats, tok, 40)
check("sft_texts: a chat over Max length is left out (its answer would be cut off), the short one kept", len(T) == 1 and sk3 == 1 and "the assistant answers" in T[0]["text"], (T, sk3))

# ---------------------------------------------------------------- the real trainers, two steps each
from datasets import Dataset  # noqa: E402

base = dict(per_device_train_batch_size=1, gradient_accumulation_steps=1, warmup_steps=0, learning_rate=1e-3, logging_steps=1,
            optim="adamw_torch", weight_decay=0.0, lr_scheduler_type="linear", seed=3407, report_to="none", max_steps=2, save_strategy="no",
            use_cpu=True)
for obj in ("dpo", "orpo"):
    dpo = obj == "dpo"
    Cfg, Tr = F.pref_classes(dpo)
    args = F.pref_config(Cfg, dict(base, output_dir=os.path.join(tmp, obj), remove_unused_columns=False), 0.1, 256, 128)
    check(obj.upper() + ": pref_config takes beta + max length on this TRL (" + trl.__version__ + ")", abs(float(args.beta) - 0.1) < 1e-9 and getattr(args, "max_length", 256) == 256)
    logs = []

    from transformers import TrainerCallback

    class Keep(TrainerCallback):
        def on_log(self, a, state, control, logs=None, **kw):
            if logs:
                logs_list.append(dict(logs))

    logs_list = logs
    m = LlamaForCausalLM(model.config)
    try:
        trainer = F.make_pref_trainer(Tr, m, tok, Dataset.from_list(R), args, [Keep()], dpo)
        trainer.train()
        losses = [x["loss"] for x in logs if "loss" in x]
        check(obj.upper() + ": the real trainer ran 2 steps on the pairs and logged a loss" + (" + how often the picked answer wins" if dpo else ""),
              trainer.state.global_step == 2 and losses and all(l == l for l in losses) and (not dpo or any("rewards/accuracies" in x for x in logs)), logs[-2:])
    except Exception as e:                                      # noqa: BLE001
        import traceback
        traceback.print_exc()
        check(obj.upper() + ": the real trainer ran", False, str(e))

src = open(os.path.join(HERE, "ft_unsloth.py"), encoding="utf-8").read()
check("main(): objective dpo / orpo -> load_prefs + pref_rows + PatchDPOTrainer (when Unsloth has it) + the pair's trainer; sft keeps SFTTrainer with the length guard",
      'cfg.get("objective") in ("dpo", "orpo")' in src and "PatchDPOTrainer()" in src and "pref_classes(dpo)" in src and "sft_texts(chats, tok, cfg[\"max_seq_length\"])" in src)
print(f"\n{PASS} passed, {FAIL} failed")
print("RESULT: FAIL" if FAIL else "RESULT: PASS")
sys.exit(1 if FAIL else 0)
