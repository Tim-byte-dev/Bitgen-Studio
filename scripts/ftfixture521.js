// bitGen Studio — scripts/ftfixture521.js (2.521.0): a STAND-IN Unsloth for the fine-tune tests (scripts/test-finetune521.js,
// scripts/test-ui521-ui.js). The real scripts/ft_unsloth.py runs against it unchanged: stand-in unsloth / trl / transformers /
// datasets modules (they record every call in $FT_FAKE_LOG and "train" by calling the progress callback), a venv python
// that puts them first on PYTHONPATH, and a stand-in llama.cpp convert_hf_to_gguf.py (+ llama-quantize) that writes small
// files. Nothing here needs a GPU.
//   make(dir) -> {mods, venv(dir), llamaSrc(dir), quantize(dir), log}
"use strict";
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");

const UNSLOTH = `import json, os
__version__ = "stand-in"
def _log(what, **kw):
    p = os.environ.get("FT_FAKE_LOG")
    if p:
        with open(p, "a") as f:
            f.write(json.dumps({"what": what, **{k: (v if isinstance(v, (str, int, float, bool, list, dict, type(None))) else str(type(v).__name__)) for k, v in kw.items()}}) + "\\n")
class _Tok:
    bos_token = "<bos>"
    def apply_chat_template(self, m, tokenize=False, add_generation_prompt=False):
        def txt(c):
            return c if isinstance(c, str) else " ".join(x.get("text", "<image>") for x in c)
        return "<bos>" + "".join("<|%s|>%s" % (x["role"], txt(x["content"])) for x in m)
    def save_pretrained(self, d):
        os.makedirs(d, exist_ok=True); open(os.path.join(d, "tokenizer.json"), "w").write("{}")
class _Model:
    def save_pretrained(self, d):
        os.makedirs(d, exist_ok=True); open(os.path.join(d, "adapter_config.json" if os.path.basename(d) == "adapter" else "config.json"), "w").write("{}")
        _log("save_pretrained", dir=os.path.basename(d))
    def save_pretrained_merged(self, d, tok, save_method=None):
        os.makedirs(d, exist_ok=True); json.dump({"save_method": save_method}, open(os.path.join(d, "config.json"), "w"))
        open(os.path.join(d, "model.safetensors"), "wb").write(b"merged")
        _log("save_pretrained_merged", save_method=save_method)
class FastLanguageModel:
    @staticmethod
    def from_pretrained(**kw):
        _log("from_pretrained", loader="language", **kw); return _Model(), _Tok()
    @staticmethod
    def get_peft_model(model, **kw):
        _log("get_peft_model", **kw); return model
class FastModel:
    @staticmethod
    def from_pretrained(**kw):
        if "load_in_16bit" in kw:
            raise TypeError("FastModel takes no load_in_16bit")
        _log("from_pretrained", loader="model", **kw); return _Model(), _Tok()
    @staticmethod
    def get_peft_model(model, **kw):
        _log("get_peft_model", **kw); return model
class FastVisionModel:
    @staticmethod
    def from_pretrained(name, **kw):
        _log("from_pretrained", loader="vision", model_name=name, **kw); return _Model(), _Tok()
    @staticmethod
    def get_peft_model(model, **kw):
        _log("get_peft_model", **kw); return model
    @staticmethod
    def for_training(model):
        _log("for_training")
`;
const CHAT = `from unsloth import _log
def get_chat_template(tok, chat_template=None):
    _log("get_chat_template", chat_template=chat_template); return tok
`;
const UTRAINER = `class UnslothVisionDataCollator:
    def __init__(self, model, tok):
        pass
`;
const TRL = `import math, os, json
from unsloth import _log
class SFTConfig:
    def __init__(self, **kw):
        if "max_seq_length" in kw:
            raise TypeError("this TRL calls it max_length")
        self.kw = kw
        for k, v in kw.items():
            setattr(self, k, v)
class _State:
    def __init__(self, n, m):
        self.global_step, self.max_steps = n, m
class SFTTrainer:
    def __init__(self, processing_class=None, model=None, train_dataset=None, args=None, callbacks=None, data_collator=None):
        self.ds, self.args, self.cbs = train_dataset, args, callbacks or []
        first = train_dataset[0] if len(train_dataset) else None
        _log("SFTTrainer", n=len(train_dataset), collator=data_collator is not None, args=args.kw,
             first=(first.get("text") if isinstance(first, dict) and "text" in first else json.dumps(first, default=lambda o: "<image>")[:400]),
             second=(train_dataset[1].get("text") if len(train_dataset) > 1 and isinstance(train_dataset[1], dict) and "text" in train_dataset[1] else ""))
    def train(self):
        a = self.args.kw
        steps = a.get("max_steps") or math.ceil(len(self.ds) * a.get("num_train_epochs", 1) / (a["per_device_train_batch_size"] * a["gradient_accumulation_steps"]))
        for i in range(1, steps + 1):
            for cb in self.cbs:
                cb.on_log(self.args, _State(i, steps), None, logs={"loss": round(2.0 / i, 4), "learning_rate": a["learning_rate"]})
        _log("train", steps=steps)
`;
const TRANSFORMERS = "class TrainerCallback:\n    pass\n";
const DATASETS = `class Dataset(list):
    @staticmethod
    def from_list(l):
        return Dataset(l)
`;
const CONVERT = `import sys, json, os
a = sys.argv[1:]
src = a[0]
out = a[a.index("--outfile") + 1]
kind = "mmproj" if "--mmproj" in a else "model"
if not os.path.isdir(src):
    print("no model folder " + src); sys.exit(1)
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "wb") as f:
    f.write(b"GGUF" + json.dumps({"kind": kind, "outtype": a[a.index("--outtype") + 1] if "--outtype" in a else ""}).encode())
print("stand-in convert_hf_to_gguf: wrote " + out)
`;

function make(dir) {
  const mods = path.join(dir, "ftmods");
  const w = (p, t) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, t); };
  w(path.join(mods, "unsloth", "__init__.py"), UNSLOTH);
  w(path.join(mods, "unsloth", "chat_templates.py"), CHAT);
  w(path.join(mods, "unsloth", "trainer.py"), UTRAINER);
  w(path.join(mods, "trl", "__init__.py"), TRL);
  w(path.join(mods, "transformers", "__init__.py"), TRANSFORMERS);
  w(path.join(mods, "datasets", "__init__.py"), DATASETS);
  const log = path.join(dir, "ft-calls.jsonl");
  const py3 = execSync(process.platform === "win32" ? "where python" : "command -v python3", { encoding: "utf8" }).split(/\r?\n/)[0].trim();
  return {
    mods, log, py3,
    /** a venv whose python sees the stand-ins first (+ .bitgen-installed) */
    venv(vdir) {
      const bin = path.join(vdir, "bin");
      fs.mkdirSync(bin, { recursive: true });
      const py = path.join(bin, "python");
      w(py, `#!/bin/sh\nPYTHONPATH="${mods}\${PYTHONPATH:+:\$PYTHONPATH}" PYTHONDONTWRITEBYTECODE=1 exec "${py3}" "$@"\n`);
      fs.chmodSync(py, 0o755);
      w(path.join(vdir, "pyvenv.cfg"), "home = " + path.dirname(py3) + "\n");
      w(path.join(vdir, ".bitgen-installed"), "{}");
      return py;
    },
    llamaSrc(sdir) { w(path.join(sdir, "convert_hf_to_gguf.py"), CONVERT); return sdir; },
    quantize(qdir) { const q = path.join(qdir, "llama-quantize"); w(q, '#!/bin/sh\necho "stand-in llama-quantize $3"\ncp "$1" "$2"\n'); fs.chmodSync(q, 0o755); return q; },
  };
}
module.exports = { make };
