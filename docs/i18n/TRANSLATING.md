# Translating the bitGen Studio guide / help (brief for every translator)

bitGen Studio is a local desktop AI video / image / music / editing studio. Its user guide (Markdown), its in-app ❔ help
pages (HTML fragments) and its shortcut list (JSON) are being translated into:
- **zh-CN** = Simplified Chinese for mainland China (简体中文, mainland vocabulary, full-width Chinese punctuation ，。：；？！（）
  in Chinese sentences; half-width punctuation inside code / keys / English names).
- **zh-TW** = Traditional Chinese for Taiwan / Hong Kong (2.704.0) - NOT translated separately: made from the reviewed
  zh-CN with `python3 scripts/i18n-zhtw.py` (OpenCC s2twp, Taiwan's words), then read over by a Taiwan editor.
- **ja** = Japanese (です・ます調, natural technical-manual Japanese, full-width 、。 punctuation).

The translation must read as if written by a native technical writer: clear, direct, instructional. Translate meaning, not
word for word. Keep it complete - every sentence, list item, table cell and note is translated; nothing summarised or dropped.

## The app's UI stays English - so UI names stay English
The app's buttons, menus, docker names, tabs, settings, dialog titles and on-screen messages are in ENGLISH. Readers must be
able to find them on screen. So:
- A name that appears on screen - usually written **bold**, in `code`, after an emoji (✨ Enhance, 🧩 Model manager,
  📏 Sketcher), in a menu path (Settings ▸ Add-ons ▸ LLM), or a quoted on-screen message - is kept EXACTLY in English
  (same capitals, same emoji, same ▸). You MAY add a short translation in full-width parentheses after it the first time it
  appears in a section, e.g. zh-CN: **Override style**（覆盖风格）; ja: **Override style**（スタイルの上書き）. Do not add one
  every time.
- Text in quotes that the app SENDS to a model or shows literally (e.g. "Fill the green spaces according to the image.")
  stays English.
- Product / model / project names stay as written (ComfyUI, MiniMax H3, LTX, Qwen, FLUX, Blender, Unreal, Daz, LoRA, GGUF,
  Civitai, SeedVR2 ...). Never add other companies' product names that the English does not have.
- Keyboard keys stay as written: Ctrl+K, Shift+click, Alt, Esc, Del, F1, Space, ← →. ("click" etc. in prose is translated.)

## Never change (the checker compares these with the English)
- The marker lines `<!-- en: ... -->` - copy them EXACTLY, on the same place (right after the heading they follow; in an
  HTML page the first line). Any other HTML comment `<!-- ... -->` too.
- Markdown structure: the same headings (#, ##, ###) in the same order and level, the same list nesting and bullets, the same
  tables (same rows and columns - translate the cells), blank lines where they are.
- Everything in `inline code` and ``` code blocks ``` - byte for byte.
- Links: translate the [text] but keep the (url) exactly. Picture lines `![...](...)` - keep the whole line as is.
- Version numbers (2.540.0), numbers, units (GB, px, mm, kPa, fps), file names and paths (docs/USAGE.md, misc\get-llama.ps1),
  emoji.
- HTML: every tag, attribute and id exactly as is; translate only the text between tags and the text of title= / alt= /
  placeholder= attributes. Do not translate <style> or <script> contents. Keep `<kbd>`, `<code>`, `<b>` around the same words.
- JSON: same structure, same "en" values, same keys (rows[i][0]); translate the group "title" and each rows[i][1].

## Glossary (use these consistently)
| English | zh-CN | ja |
|---|---|---|
| docker / dock (a panel of the app) | 面板 | ドッカー |
| floating (docker) | 浮动 | フローティング |
| timeline | 时间线 | タイムライン |
| layer | 图层 | レイヤー |
| style (a generation preset) | 风格 | スタイル |
| prompt | 提示词 | プロンプト |
| negative prompt | 负面提示词 | ネガティブプロンプト |
| reference (picture) | 参考图 | 参照画像 |
| render / rendering | 渲染 | レンダリング |
| scene | 场景 | シーン |
| take (one render of a scene) | 镜次 | テイク |
| clip | 片段 | クリップ |
| model | 模型 | モデル |
| checkpoint | 检查点（checkpoint） first time, then 检查点 | チェックポイント |
| workflow (ComfyUI) | 工作流 | ワークフロー |
| node / node pack | 节点 / 节点包 | ノード / ノードパック |
| assets | 素材 | アセット |
| gallery | 图库 | ギャラリー |
| queue | 队列 | キュー |
| preview | 预览 | プレビュー |
| selection (image editor) | 选区 | 選択範囲 |
| mask | 蒙版 | マスク |
| keyframe | 关键帧 | キーフレーム |
| seed | 种子 | シード |
| upscale | 放大 | アップスケール |
| storyboard | 故事板 | ストーリーボード |
| lip sync | 口型同步 | リップシンク |
| song / vocals / stems | 歌曲 / 人声 / 分轨 | 曲 / ボーカル / ステム |
| canvas | 画布 | キャンバス |
| image editor | 图像编辑器 | 画像エディター |
| settings | 设置 | 設定 |
| add-on | 附加组件 | アドオン |
| theme | 主题 | テーマ |
| wall / room / roof / floor (Sketcher) | 墙 / 房间 / 屋顶 / 地板 | 壁 / 部屋 / 屋根 / 床 |
| GPU / VRAM / LLM | GPU / 显存 / LLM | GPU / VRAM / LLM |
| click / double-click / right-click / drag | 点击 / 双击 / 右键点击 / 拖动 | クリック / ダブルクリック / 右クリック / ドラッグ |

## How to work
1. Read your English file(s) fully with the Read tool (in parts if long).
2. Translate in order, keeping the structure. Write the result with the Write tool in pieces of roughly 8-12 KB of English
   each, to the exact file names your task gives (part numbers in order). Each piece is plain text that continues where the
   last stopped; the pieces are joined with a blank line between them, so cut only between paragraphs / list items / table
   blocks (never inside a table, a code block or a list item).
3. When done, re-read your output once: every marker line present and unchanged, no English sentence left untranslated
   (UI names in English are expected), nothing dropped.
4. Reply with ONE line: the files you wrote and anything you were unsure about (at most two short notes). No summary of the
   content.

## The app's own words (2.705.0) - static/i18n/ui/<lang>.json

The UI is translated at run time by static/uilang.js from a dictionary per language {"strings": {"English": "translation"}}.
- `H3_URL=http://127.0.0.1:8311/ node scripts/ui-strings.js` collects every word of the running app - the main window,
  Settings, and (2.707.0) every docker with its tabs / tools / modes / menus picked in turn - into static/i18n/ui/strings.json,
  with where each one appears; readouts (sizes, levels, dates, colour codes) and what a pattern makes from a number are left
  out, and what an earlier collection found is kept (`--fresh` starts over, `--clean` re-filters the file without a browser).
- `node scripts/ui-dynamic.js` (needs `npm i -g typescript`, a developer tool) reads ALL the app's code - static/*.js, every
  ext/<docker>/*.js, index.html - for the words it writes while it runs (static/i18n/ui/dynamic.json): strings, and patterns
  with {0} {1} for the values it fills in; also the words the editors keep as data ({label: "…"}, ["id", "Label"], tooltips
  inside HTML built in a .map). `--settings` = the 2.706.0 scope (the Settings dialog only).
- Translators get pieces of that list and return one JSON object per piece; `node scripts/i18n-ui.js build <lang> <dir>`
  merges them (a dir holding ONLY the new pieces - otherwise older pieces overwrite reviewed words), `check` must say 0
  problems, `status` says what is missing. zh-TW: `python3 scripts/i18n-zhtw.py --ui` converts only the words zh-TW lacks.
- UI rules: labels short, in the software style of the language (保存 / 開く); tooltips in full sentences (ja です・ます);
  names, model / style names, file names, code, keys, literal values the app sends stay as they are; placeholders and ▸
  menu paths kept; a fragment (its icon and trailing ":" "…" are kept by the app) translated so it still works.
- The guides take the button names from the dictionary at read time (lib/helpI18n.js uiNames) - in every section and ❔ page
  since 2.707.0 (EDITORS / UI_EDITOR_PAGES there are empty; put a docker back in them if its UI ever stops being translated).
- Not translated: words drawn on a canvas (the timeline's ruler and clip labels, the image editor's on-canvas readouts), what
  the user types, the guide's own text (it has its own translations), code / file names.

## Language packs (2.715.0) - every language besides English is a pack
Tim: "make the languages into language packs, so we can add a new language easily later" - "if we could have a master pack so
users can translate the strings and upload to tigerart for the community it would be ideal". The code: lib/langPacks.js.
- **Built in**: `docs/i18n/<id>/pack.json` (zh-CN, zh-TW, ja). Its `"files"` says where the older parts live
  (static/i18n/ui/<id>.json, static/help/<id>/); USAGE.md, shortcuts.json and FEATURES.md sit beside it. A new built-in
  language = a new docs/i18n/<id>/ folder with a pack.json (and its parts) - no code changes; add it to scripts/cjkfont.py /
  scripts/make_guide_pdf.py only if it should get a Guide PDF.
- **Installed**: `<install>/langpacks/<id>/` from Settings ▸ Languages ▸ ⤒ Install a pack (a .zip: pack.json, ui.json,
  USAGE.md, shortcuts.json, FEATURES.md, site.json, help/<topic>.html - any of them may be missing or half done). An installed
  pack with a built-in's id is used instead of it until removed. A pack's help pages are sanitised (plain tags only).
- **The master pack** (Settings ▸ Languages ▸ ⤓ Master pack, or GET /api/langpacks/master.zip): every part in English, ui.json
  values "", id "xx", TRANSLATING.txt for community translators. A part still word for word the English counts as not
  translated, so a half-done pack shows English there.
- **⤓ Export for translating** (GET /api/langpacks/<id>/export.zip): a pack - built in or installed - with today's English
  parts added and its translations kept (a translated guide section keeps its old hash, so it still shows as older).
- pack.json: id (ko, es, pt-BR, zh-Hant ...; not en / xx), name, native, region, browser (the system languages that pick it -
  the longest tag match wins), keepAll (CJK), version, authors, words {stale, missing, english, lang}.
- **Shared by the community (2.716.0)**: members share packs through the bitGen Community (community/lib/act_packs.php -
  pack_list / pack_get / pack_upload / pack_delete / admin_pack_moderate; an admin approves each). The app: Settings ▸
  Languages ▸ Shared by the community (⤓ Install) and ⇪ Share on an installed pack; the website: tigerart.com.au/languages.php
  (the list, the master pack - made by the website's daily refresh from lib/langPacks.js - uploads, the admins' checks).
- **The website's words in a pack**: docs/i18n/site-keys.json is the website's English (tigerart: `php scripts/site-i18n.php
  export <bitgen>` refreshes it); the master pack carries them as site.json. The website itself still uses its own
  public/inc/i18n/<lang>.json - a pack's site.json is there for the website to adopt later.
