# 使用 bitGen Studio
<!-- en: _top f2ff26c89c08 -->

帶你遊覽整個工作室：從一個提示詞到一部完整的影片。如果尚未安裝，請先閱讀
[INSTALL.md](INSTALL.md)。

- [視窗](#the-window)
- [用提示詞生成一個片段](#one-clip-from-a-prompt)
- [角色](#characters)
- [在場景板上製作影片](#a-film-on-the-scene-board)
- [音樂影片](#a-music-video)
- [角色替換](#character-swap)
- [選擇參考影片的影格](#choosing-the-frames-of-a-reference-video)
- [影像、ControlNet 與面部修復](#images-controlnet-and-face-fix)
- [音樂、分軌與人聲](#music-stems-and-voices)
- [時間軸與匯出](#timeline-and-export)
- [📏 Sketcher - 3D 建模、房間與攝影機](#-sketcher---3d-modelling-rooms-and-cameras-2619---2653)
- [專案、佇列與相簿](#projects-queue-and-gallery)
- [檔案對話方塊](#the-file-dialog)
- [技巧](#tips)
- [致謝](#credits)

---

## 視窗
<!-- en: the-window b01c2509e256 -->

![The main window](images/overview.png)

| 區域 | 說明 |
|---|---|
| **Left**（左側） | 系統狀態，以及兩個按鈕，分別用於顯示浮動的 **LLM tokens**（L）視窗和 **Basic Settings**（S）視窗。Basic Settings（基本設定）包含生成模式（Ref · F/L · Text · Swap）、解析度、長寬比、秒數、步數、CFG、種子、格式、LoRA、ControlNet 和面部修復 |
| **References**（參考） | 隨下一次生成一同使用的圖片、影片和聲音（從 Assets 或 Gallery 拖入） |
| **Assets**（素材） | 專案的影像、影片和聲音——把檔案拖放到這裡即可匯入 |
| 中央面板 | Preview、Timeline、**Video**（場景板）、Music、Stems、Image editor、ComfyUI、**Prompt**、Prompt chat、Console |
| **Queue**（佇列） | 待處理和已完成的任務，以及它們的日誌 |
| **Gallery**（相簿） | 你渲染過的所有內容 |

底部的一排按鈕用於顯示和隱藏各個面板；每個面板都可以摺疊（▾）或最大化（⛶——按 Esc
恢復）。佈局會被記住。

## 用提示詞生成一個片段
<!-- en: one-clip-from-a-prompt 10352f50a58d -->

1. 在 **Basic Settings**（基本設定）中（按 **S** 顯示）選擇一種模式：
   - **Ref**（ref2va）——最多 9 張參考圖；托盤中的每個槽位都是一個可以在提示詞中引用的
     `<Picture n>`（點選槽位的徽標即可插入其標籤）。References 面板中的影片和聲音也會一同使用。
   - **F/L**（fl2va）——一張圖片 = 首幀；兩張圖片 = 從首幀動畫過渡到尾幀。
   - **Text**（t2va）——不使用參考圖。
   - **Swap**——參見[角色替換](#character-swap)。
   - 每張 Ref 圖片下方的 **Type**（類型）（person、face、clothing……；2.340.0 起新增
     **first frame**、**last frame**）：把某張圖片的 Type 設為 **first frame**，
     Generate 就會以它為起點渲染 **First/Last**（fl2va）——如果有 Type 為
     **last frame** 的圖片，則一直渲染到該圖片。其他圖片不會被使用（主控台會提示這一點）。沒有首幀時，渲染仍為 **Ref**（ref2va，最多 9 張圖片），單獨的尾幀會被當作普通參考圖。
     LTX 2.5 風格使用相同的 Type：首幀放在最前，尾幀放在最後。
2. 選擇解析度、長寬比和 **Seconds**（秒數）。MiniMax H3 以 24 fps 渲染；如果片段長度超出顯示卡單次執行所能處理的範圍，會被拆分後再無縫拼接。
3. 編寫提示詞並按下 **GENERATE**（其下方的下拉式選單顯示 Generate 要生成的內容：
   🎬 Video、🖼 Image、🎶 Music、🗣 Speech、⚙ Graph、💬 Chat）。

`/br/` 單獨佔一行時，會把提示詞拆分為多個依次執行的任務。在提示詞中按 **Enter** 可讓本機 LLM
改進提示詞。**⏫ Enhance** 會放大所選影片（參見 *使用 SeedVR2 放大影片*）。

## 角色
<!-- en: characters 80f5593fe0ff -->

在 **Video** 面板的 **Characters**（角色）部分中：

- **NEW**——建立一個角色，包含名稱、詳細資訊、一張 **character sheet**（角色設定圖，即正面 /
  側面 / 背面圖片），還可選配一段 **voice clip**（語音片段）。它的 `@tag`（例如
  `@anna`）是提示詞和劇本引用該角色的方式。
- **🖼 NEW**——*用一張圖片*建立角色：上傳一張照片或渲染圖，即可生成一張參考設定圖（可使用
  pose_sheets 資料夾中你自己的姿勢設定圖，照片風格或插畫風格均可），然後點選 **Keep** 保留它。
- **🎭 Actors**——選擇目前場景中出場的角色；只有他們會參與參考圖和劇本。
- 每個角色都有一個用於 **RefMod**（身分模型）的資料集資料夾、在各場景間跟隨角色的服裝條目，以及用於原生音訊對白的專屬聲音。

## 在場景板上製作影片
<!-- en: a-film-on-the-scene-board c5d9bcd362a8 -->

![The scene board](images/video-docker.png)

1. **Workflow**（工作流程，位於 StoryBoard 頂部）：*Native audio · ref2va / fl2va*——
   每個場景都是一個獨立的片段，同時包含影片**和**聲音。
2. **Scenes**（場景）：輸入你想要的場景數量，或者留空——此時由
   `projects\<name>\scenes.txt`、你請求中的數字或 LLM 來決定。
3. 在提示詞中按 **🎬**（*create screenplay*，建立劇本）並描述故事，例如 *create screenplay: Anna and Rex reach the rooftop at night…* LLM
   會把各個場景寫到場景板上，角色會說出各自的臺詞（`@anna says: "We made it."`）。沒有歌曲 = 一部影片：模型會用每個角色的複製聲音，自行生成對白、音效和環境聲。
4. 為每個場景選擇它如何銜接上一個場景：

   | | |
   |---|---|
   | **Ref** | 根據參考圖（角色設定圖、地點圖片）生成一個新鏡頭；在 Native audio 下，上一個鏡次的結尾會作為過渡影片一同使用 |
   | **First** | **精確地**從上一個鏡次的某一個影格開始（fl2va——不使用角色設定圖） |
   | **Cont** | 從該影格開始，**同時**使用演員的設定圖，使角色保持一致 |
   | **Trans** | 從該影格過渡到新地點的圖片 |

   **All:** 一次性設定所有場景。
5. 按場景的圓形 **▶** 按鈕即可渲染該場景，或勾選多個場景後按 **▶ Selected**。渲染在背景進行；你可以繼續編輯。
6. 每個鏡次下方是它的 **filmstrip**（膠片條）——點選某一個影格，即可將其設為下一個場景的首幀。
   **✎ First frame (Qwen 2.1)**（2.337.0）——展開場景 First / Last 影格槽位下方的摺疊面板，即可用 Qwen Image 2.1 *製作*該場景的首幀：勾選 **characters**（角色，使用其設定圖），選擇一張 **📍 location**（地點）圖片和最多三個 **🧸 props**（道具），輸入一行指導說明（或留空，以使用場景自身的提示詞），然後按 **✎ Make first frame**。**Start from** 用於選擇 Qwen
   要編輯的圖片：地點圖片（角色會被放入其中）、**the frame the scene continues from**
   （場景所銜接的那一個影格：姿勢和位置不變，只更換地點——適用於 Cont / First / Trans 場景），或場景自身的 First 圖片；*Auto* 會在存在銜接影格時選用銜接影格。生成結果會放入場景的
   **First** 槽位（Ref 場景會變為 First）。此功能需要 Qwen Image 2.1 模型（Setup → Models → Image editing）。
7. 場景板下方的鏡次列：**▶** 觀看 · **✔** 保留 · **↻** 重做 ·
   **⇄** 替換角色。**⏫** 會使用 ⚙ 中的放大器放大你滿意的鏡次（無需重新渲染）。
8. **🎬 Compile**（位於 StoryBoard 頂部）按場景順序把已渲染的鏡次合併成一部影片。從 2.391.0 起，場景板不再有單獨的 🎬 Produce 和 ⇥ Timeline 按鈕。

StoryBoard 底部的 **info line**（資訊行）與狀態列高度相同。它顯示該面板的最新訊息；將滑鼠停留在上面即可閱讀完整文字。

**Scenes 下拉式選單（2.391.1）。** 場景板（共享提示詞、場景選單列和場景卡片）與 Characters
和 Locations 一樣，位於一個 **Scenes** 下拉式選單中。點選其標題即可展開或收起；標題會顯示場景總數以及正在渲染的數量。

在下拉式選單中，卡片上方的 **scene picker**（場景選擇器）可以顯示 **All scenes**（全部場景），也可以只顯示某一個場景的卡片。每個場景都會列出其狀態（⏳ 正在渲染、● 已渲染、✔ 已保留、
✕ 失敗）以及提示詞的開頭幾個詞。**◀** 和 **▶** 用於跳到上一個或下一個場景。選擇器會記住你的選擇。

場景渲染期間，其卡片會顯示 **rendering step n of total**（正在渲染第 n 步，共 total 步），並附帶進度列和已用時間。在第一步開始之前，它顯示 **rendering - loading the models**。

包含所有快捷鍵的完整 **PDF guide**（PDF 指南）位於 `docs\bitGen-Studio-Guide.pdf`。

**⚙**（渲染設定）用於設定場景的尺寸、步數、LoRA、Sage / Spectrum / Comfy Kitchen
加速器、放大器，以及用於保持連貫性的尾幀。StoryBoard 頂部的 **🆕 New / 💾 Save / 📂 Load**
用於新增、儲存和重新載入整部影片（演員、章節、場景和渲染結果）。

## 音樂影片
<!-- en: a-music-video 18fb81084a22 -->

1. 用 **📂 Load** 載入一首歌曲（或在 **Audio** 下拉式選單中選擇）。它的波形開啟時已自動分段；調整剪下點後按 **💾**——每個分段對應一個場景，各自帶有起始時間和時長。
2. 在 Prompt 面板中按 **🎤**（*create music video*，建立音樂影片）並描述你想要的內容；編劇會把歌曲的分段用作場景，並讓角色演唱各自的歌詞。
3. 每個場景都會對歌曲中屬於自己的那一段進行唇形同步。

## LTX 2.5（首幀 / 尾幀、唇形同步、音訊轉影片）
<!-- en: ltx-2-5-first-last-frame-lipsync-audio-to-video d24fa406ffb1 -->

LTX 2.5 透過 Tim 的 **LTX 2.5 All-In-One** 畫布（`comfy_workflows/LTX25_All_In_One.json`）進行渲染，每個片段使用一種模式。選擇
**LTX 2.5** 影片風格（Settings → Video styles 中已將它作為入門風格提供）。

**從 Prompt 面板使用。** 選取 LTX 2.5 風格後，範本清單旁邊會出現兩個下拉式選單：

- **LTX mode**（LTX 模式）——*Auto* 會根據參考面板中的內容自動選擇：

  | 參考面板 | 模式 |
  |---|---|
  | 一個影片（+ 圖片 1） | 影片轉影片（風格遷移，姿勢取自影片） |
  | 音訊 + 3 張圖片 | 首幀 / 中間幀 / 尾幀（圖片 1、2、3） |
  | 音訊 + 2 張圖片 | 首幀 / 尾幀唇形同步 |
  | 音訊 + 1 張圖片 | 唇形同步（由圖片 1 演唱該音訊） |
  | 僅音訊 | 音訊轉影片 |
  | 2 張圖片 | 首幀 / 尾幀 |
  | 1 張圖片 | 影像轉影片（圖片 1 為首幀） |
  | 無 | 文字轉影片 |

  你也可以自己選擇模式；如果某個模式缺少所需的圖片 / 音訊，會提示需要載入什麼。面板中只會使用第一個音訊和第一個影片。
- **Transition**（過渡）——即 *ltx2.3-transition* LoRA。*Auto* 只會在需要在圖片之間過渡的模式（首幀 / 尾幀、首幀 / 尾幀唇形同步、首幀 / 中間幀 / 尾幀）中啟用它。

**Seconds**、**Width / Height**（取整為 32 的倍數）和 **Seed** 欄位均會生效；片段為 24 fps，時長 1–30 s。

**在場景板上使用。** 將 StoryBoard 的 **Workflow** 設為 **LTX 2.5**。每個場景的卡片決定其模式：

| 場景 | 無歌曲 | 使用場景板的歌曲 |
|---|---|---|
| **Ref**（未設定任何內容） | 文字轉影片 | 音訊轉影片 |
| **First / Cont**（或有 First 圖片） | 從該影格開始的影像轉影片 | 對該場景所對應的那段歌曲進行唇形同步 |
| **Trans**（或有 Last 圖片） | 首幀 / 尾幀：從銜接影格到 Last 圖片（沒有則到地點圖片） | 首幀 / 尾幀唇形同步 |

**執行哪個工作流程（2.401.5）。** *文字轉影片*、*影像轉影片*和*首幀 / 尾幀*在
**Comfy-Org 官方的 LTX 2.5 範本**
（`comfy_workflows/ltx25_official_t2v.json`、`_i2v`、`_flf2v`）上執行。它們只使用
ComfyUI 內建的節點，因此無需從 Manager 安裝任何東西。應用程式會為你填好以下內容：你的提示詞、秒數、尺寸、種子、圖片、風格中的 LoRA 和負面提示詞。如果你的模型是 GGUF，則透過
ComfyUI-GGUF 載入。這些範本需要 ComfyUI 的 LTX 2.5 檔案：transformer（int8 或 GGUF）、
Gemma 4 12B 文字編碼器、影片和音訊 VAE，以及 x2 放大器（首幀 / 尾幀不需要放大器）。如果缺少其中某個檔案，任務日誌會指出缺的是哪一個，並改用畫布渲染該片段。畫布保留了只有它才有的模式（音訊轉影片、唇形同步、首幀 / 尾幀唇形同步、首幀 / 中間幀 / 尾幀、風格遷移）、LTX Ripple、時間軸攝影機的精確路徑，以及設為 *On* 時的 *Transition* LoRA。任務日誌會顯示執行的是哪個工作流程："on Comfy-Org's own template …" 或
"converted LTX25_All_In_One.json …"。請保持 ComfyUI 為最新版本：這些範本使用了較新的核心節點（TextGenerateLTX2Prompt、ComfySwitchNode、
ResizeImageMaskNode）。

✎ First frame (Qwen 2.1) 在這裡同樣可用——先製作開場圖片，再進行渲染。提示詞中的 @tag
會變成角色的名字（LTX 沒有參考設定圖；外觀來自首幀）。LTX 鏡次目前還不能使用 **⏫** 放大。

**模型和節點。** *Settings → Models → ⤓ Model catalog*（或設定精靈的 Models 頁面）
→ *Video - LTX 2.5*：
- Q4_K_M GGUF（15 GB，畫布載入的就是它）或 int8 模型；
- Gemma 4 12B 文字編碼器和 Gemma 4 E2B 文字編碼器；
- 影片 / 音訊 VAE、TAE 預覽 VAE 以及空間放大器；
- （2.341.0）畫布使用的 LoRA：OmniNFT RL、Transition、IC-LoRA Union Control
  （風格遷移）、IC-LoRA Detailer 和 LTX Ripple。

Lightricks 的儲存庫需要授權存取：請在 Hugging Face 上接受其授權條款，並把你的存取權杖（token）填入模型目錄。下載大檔案時，請在 **Download with** 中選擇 Hugging Face CLI（**Install hf CLI** 可安裝它）。畫布需要以下節點套件：ComfyUI-GGUF、KJNodes、VideoHelperSuite、rgthree、mxToolkit、
Easy-Use 和 controlnet_aux（Setup → Node packs）；任務開始時，缺失的節點會連同其所屬的節點套件一起列出。從 2.401.2 起，畫布不再需要 ComfyMath（它已從 GitHub 上消失）或 pysssss 數學節點：其數值轉換和公式改由 ComfyUI 內建的 **Math Expression** 節點執行。如果你從自己的 ComfyUI
重新匯出的畫布中仍包含這些節點，應用程式會在任務開始時自動轉換。從 2.401.3 起，它也不再需要
ComfyUI-MediaMixer：其 "last frame" 選取改由畫布本來就在使用的 KJNodes
（Get Image Range From Batch）完成。

現在，每個影片任務（MiniMax H3、Wan、LTX、替換、Viggle、SeedVR2）都會顯示 ComfyUI 的即時進度：正在執行哪個節點，以及取樣時的 "step n of total"。如果長時間沒有動靜，並顯示
"running UNETLoader" 或某個載入器節點，說明 ComfyUI 仍在載入模型；Wan 2.2 的兩個 14B
模型首次載入可能需要幾分鐘。

## LTX 2.3 與 3D 渲染 → 真實（Blender → 照片級真實感）
<!-- en: ltx-2-3-and-3d-render-real-blender-photoreal 464c95398bb6 -->

選擇 **LTX 2.3** 影片風格（Settings → Video styles 中已將它作為入門風格提供）。它執行
**Comfy-Org 官方的 LTX 2.3 範本**，只使用 ComfyUI 內建的節點（`comfy_workflows/ltx23_official_*.json`）。它有四種模式。LTX mode 下拉式選單只顯示這四種，*Auto* 會根據參考面板中的內容自動選擇：

| 參考面板 | 模式 |
|---|---|
| 一個影片 | **3D render → real**（3D 渲染 → 真實）。該影片是一段渲染畫面（來自 Blender、遊戲視埠或任意 CG 片段）；fal 的 **3DREAL** IC-LoRA 會在保持相同佈局和攝影機運動的前提下，將其轉為照片級真實感畫面。再加一張圖片 = 一張真實的首幀（可選）。 |
| 2 張圖片 | 首幀 / 尾幀 |
| 1 張圖片 | 影像轉影片（首幀） |
| 無 | 文字轉影片 |

唇形同步、音訊轉影片、首幀 / 中間幀 / 尾幀和風格遷移屬於 LTX 2.5 畫布的模式。如需使用這些模式，請選擇 LTX 2.5 風格。

**3DREAL**（huggingface.co/fal/LTX-2.3-3DREAL-LoRA）：模式旁邊的選擇框用於選擇變體：

- *strong v2*：最新版本（支援多場景、音訊，面部效果更好）；
- *strong*：更強力地推向照片級真實感；
- *light*：忠於原畫面，效果溫和；
- *Auto*：ComfyUI 中已有的最新版本。

bitGen 會把 LoRA 的觸發詞放在你的提示詞最前面（"3DREAL. Make it photorealistic. …"）。請描述鏡頭應有的樣子：材質、光線、天氣、一天中的時間。

**從 Blender 使用**（bitgen-blender-addon 1.1）：在 Blender 中佈置好場景，然後使用
**sidebar (N) → bitGen → Render scene (LTX 2.3 · 3DREAL)**。幾個灰色方塊加上一段攝影機運動就足夠了。設定項：

- **Looks like**：提示詞。
- **Engine**：*Solid*（最快；粗模佈局用它就夠了）、*EEVEE*，或場景自身的引擎。
- **3DREAL**：變體。
- **Strength**：渲染畫面對 LTX 的引導強度（1 = LoRA 自身的強度）。
- **Max seconds**：時長上限。
- **Render in bitGen**：勾選後，任務會立即加入佇列。

**🎬 Render scene → bitGen** 透過 **scene camera**（場景攝影機）渲染影格範圍。長邊最多 1280，兩邊均為 32 的倍數，輸出為 H.264 .mp4。渲染結果會作為 **Video assets →
blender_<name>.mp4** 傳送到目前開啟的專案；勾選 *Render in bitGen* 時，LTX 2.3 任務會立即開始。
Blender 中的所有渲染設定在之後都會恢復原狀。取消勾選 *Render in bitGen* 則只發送渲染結果，之後再由你自己把它放入參考面板（如有需要，可以新增一張真實的首幀圖片）。

**模型**（*Settings → Models → ⤓ Model catalog → Video - LTX 2.3*），放在 ComfyUI 的以下資料夾中：

- **checkpoints**：`ltx-2.3-22b-distilled-fp8` 可執行所有模式。新增 `ltx-2.3-22b-dev-fp8` +
  `ltx_2.3_22b_distilled_1.1_lora…`（loras），即可按 Comfy-Org 範本的方式執行文字 / 影像模式。
- **text_encoders**：`gemma_3_12B_it_fp4_mixed`。
- **latent_upscale_models**：`ltx-2.3-spatial-upscaler-x2-1.1`（文字 / 影像）。
- **loras**：`3DREAL-strong-v2` / `3DREAL-strong` / `3DREAL-light`，以及可選的 Gemma "abliterated" LoRA
  （缺失時會被略過）。

任務日誌會列出所用的檢查點（checkpoint）、編碼器和 3DREAL 檔案，並說明略過了哪些。請保持 ComfyUI
為最新版本：這些範本使用了它最新的 LTX 節點（GetICLoRAParameters、LTXVAddGuide、LTXAVTextEncoderLoader）。


### 在預覽畫布中開啟 .blend：環視、編輯，並將一個分段渲染為真實畫面

點選時間軸畫布工具中的 **🟧**，然後選擇一個 `.blend`。Blender（無介面模式）會讀取它，場景隨即出現在預覽畫布上，並按場景的渲染尺寸取景。bitGen 在副本上工作：`<project>/blender/<name>.tmp`。在你儲存到原檔案之前，原檔案不會被改動。

- **🎥 Scene camera** 透過場景的活動攝影機觀看，並播放其動畫。**🧭 Free view**：拖曳可環繞旋轉，右鍵拖曳或 Shift 拖曳可平移，滾輪可縮放，按 **F** 可框選全部內容。
- **Zoom**（縮放，2.546.0）：**🔍＋ / 🔍－**，或 **Alt+drag**——向前（向上）拖曳拉近，向後（向下）拖曳拉遠。
  **⌖ Zoom to object**（或 **Z**）會從你目前觀看的方向把檢視拉近到所選物件；未選擇任何物件時則框選整個場景。在 🎥 Scene camera 下縮放時，會先在攝影機所在位置切換到自由檢視。
- **Select**（選擇）物件：點選該物件，或在 **Tools & Properties**（按鍵 1）的物件清單中選擇。**G / R / S**
  （或 ✥ ⟲ ⤡）可在移動、旋轉和縮放之間切換操作手柄。Properties 中也可以輸入 X / Y / Z（Blender 的座標軸）和尺寸。
- **Edits**（編輯）：
  - 移動一個由 Blender 驅動動畫的物件時，會在目前影格插入一個 **key**（關鍵影格）。移動其他任何物件則會為它設定新的位置。勾選 *Auto-key every move* 可為所有移動插入關鍵影格。
  - **◆ Key** 在此處為物件插入關鍵影格，**✕ Key** 刪除目前影格的關鍵影格，點選關鍵影格行（◇ 為 Blender 的，◆ 為你的）中的關鍵影格即可跳轉到該影格。
  - **⧉** 複製，**◌ Hide** / 👁 在渲染中隱藏該物件，**🗑** 刪除，**↺** 復原對它的所有編輯。
  - **Ctrl+Z** 復原。預覽在關鍵影格之間按直線插值播放；Blender 則會進行緩入緩出。
- **Segment**（分段）：拖曳影格條定位，然後按 **[ In** 和 **Out ]**。影格條會顯示分段長度；LTX 最長支援 30 s。
- **Save to**（儲存位置，位於 Properties 中）：
  - *Only in bitGen*：`<project>/blender/<name>.blend`。
  - *Write back to the original .blend*：Blender 會將舊檔案保留為 `.blend1`。
  - *Copy to a new file*：在原檔案旁邊生成 `<name>_bitgen.blend`。

  **💾 Save** 總會同時寫入專案中的 `<name>.blend`，並把你的編輯烘焙到工作副本中。
- **Render to real**：選擇攝影機（*the scene camera*，或 *this view*——在你目前觀看的位置放置一臺靜止攝影機）、引擎（粗模佈局用 *Solid* 就夠了）、外觀描述、3DREAL 變體和強度，然後按 **🎬 Render to real**。
  Blender 會把該分段渲染為 **Video assets → blender_<name>_<in>-<out>.mp4**；勾選 *Render in bitGen* 時，
  LTX 2.3 3DREAL 任務會加入佇列，與附加元件的 Render scene 相同。
- ✕ 返回時間軸畫布。場景會保持開啟；🟧 可以把它重新調出來。**⟲ Reload** 會丟棄你的編輯並重新讀取該 .blend。

必須安裝 Blender（其路徑在 🟧 Blender settings 中設定）。

### ✨ 用 AI 構建場景，以及從圖片生成 3D 模型

本機 LLM 可以為你佈置一個 3D 場景。開啟 **🟧**（未開啟場景時，會顯示 **📂 Open a .blend** 和 **✨ Build
a scene with AI**；已開啟場景時，**✨ New scene with AI ▸** 位於 Properties 頂部）。描述鏡頭（畫面裡有什麼、什麼在動、攝影機如何移動），設定時長，然後按 **✨ Build**：

1. LLM 會寫出一份**計劃**：每個物件都歸為一種已知類型（汽車、卡車、樹、房屋、建築、道路、人、狗、路燈柱、長椅、桌子……共 58 種），並帶有以米為單位的尺寸、位置、朝向和顏色，以及什麼東西在何時移動、攝影機的路徑。它從不編寫程式碼。如果回覆不是一份計劃，會重新請求一次。
2. 沒有合適類型的物體（動物、雕像、特殊車輛、角色）會變成 **3D models**（3D 模型）。每個物體先用 Basic Settings
   中選定的影像風格畫成一張圖片（單獨一個物體，白色背景），然後在 ComfyUI 中轉換為 .glb。
   *Max 3D* 限制其數量；取消勾選 *3D models* 則全部用簡單形狀來構建。這些都是佇列中的普通任務。
3. Blender 會構建 `<project>/blender/ai/<title>.blend`（計劃儲存在它旁邊，名為 `<title>.plan.json`），並在預覽中開啟它：你可以環視、移動物體、插入關鍵影格，然後 **Render to real**。用相同標題再次構建會生成
   `<title>_2.blend`；不會覆蓋任何檔案。

如果某張圖片或某個 3D 模型無法生成，該物件會變成其類型的簡單替代體，日誌會說明原因；場景仍然會被構建出來。
**■ Stop** 可停止構建。

**Image to 3D**（影像轉 3D，使用 ComfyUI 內建節點和 Comfy-Org 的範本）：

| 選項 | 得到的結果 | 檔案（Settings → Models → ⤓ Model catalog → **3D models**） |
|---|---|---|
| **Hunyuan3D 2.1**（預設） | 只有形狀，沒有顏色；反正 3DREAL 會畫出真實的外觀 | `hunyuan_3d_v2.1.safetensors`（checkpoints）、`birefnet.safetensors`（background_removal——先把物件去背，可選） |
| **TRELLIS.2** | 形狀 + 烘焙紋理，速度較慢 | `trellis_2_int8_convrot`（diffusion_models）、`trellis_2_shape_vae_bf16` + `trellis_2_texture_vae_bf16`（vae）、`dino_v3_L_naf_fp32`（clip_vision）、`birefnet` |

*Auto* 在有 Hunyuan3D 2.1 時使用它，否則使用 TRELLIS.2。缺失的檔案會在任務日誌中列出。

**任意圖片上的 🧊**：Gallery（Images）和 Assets 面板（Images）中的每張圖片都有一個 🧊。選擇 Hunyuan3D 或
TRELLIS.2，生成的 .glb 會放入專案的 `models3d/`。之後，在 .blend 預覽的 Properties 中點選 **＋ Model**，即可將其新增到開啟的場景中（高 1 m，立在視線所指的位置；可用 S 鍵或 Size 框縮放），💾 Save 會把它存入該 .blend。時間軸的 🧊 3D 圖層也可以使用這些檔案。

授權條款：Hunyuan3D 2.1 採用騰訊的 Hunyuan 3D 社群授權條款（不適用於歐盟、英國和韓國）；
TRELLIS.2 的程式碼採用 MIT 授權（其中部分元件有各自的授權條款）。商業使用前，請檢查每個模型的授權條款。

### Daz Studio → bitGen（bitGen Bridge 指令碼）

**安裝** `bitgen-daz-bridge-v1.0.0.zip`：把其中的 `Scripts` 資料夾複製到你的某個 Daz 內容庫中（例如
*Documents/DAZ 3D/Studio/My Library*）。在 Daz Studio 中，開啟 **Content Library → (your library) → Scripts → bitGen**，然後雙擊 **bitGen Bridge**。為方便隨時使用，可透過 *Window → Workspace → Customize* 把它拖到工具列上。它適用於
Daz Studio 4.2x 以及 Daz Studio 2025 / 6。bitGen Studio 必須在同一臺電腦上執行；**Test connection**
可檢查連線。

橋接視窗（有自己的標題列）提供五種傳送方式：

| 傳送方式 | bitGen 的處理 |
|---|---|
| **Render the animation → real** | Daz 使用*你自己的*渲染設定（Iray、Filament 或 3Delight；Filament 較快）渲染時間軸的播放範圍。這些影格會在 Video assets 中生成 `daz_<scene>.mp4`（長邊 1280，最長 30 s）。勾選 *Render in bitGen right away* 時，LTX 2.3 · 3DREAL 會使用你的 *Looks like* 文字、3DREAL 變體和強度，將其渲染為真實畫面。 |
| **Render this frame → a picture** | 放入 Gallery 和 Images 素材中，可直接用作參考圖、首幀或 🧊 3D。 |
| **The scene as 3D → open in bitGen's preview** | Daz 匯出 FBX：帶骨骼和動畫的人物、道具，以及按勾選匯出的燈光 / 攝影機。Blender 會把它轉換為 `blender/daz/<scene>.blend`，並在 🟧 預覽中開啟，你可以在那裡編輯它並渲染為真實畫面。 |
| **The scene as 3D → merge into the scene open in bitGen** | bitGen 會開啟 **Merge** 對話方塊（見下文）。 |
| **The selected figure / prop → a 3D model** | 儲存到 `models3d/<figure>.glb`，可在預覽中透過 ＋ Model 使用。勾選 *also add it as a 3D layer* 可同時把它放到時間軸上。 |

**Merge 對話方塊**：當預覽中已開啟一個 .blend，又有 Daz 場景傳來需要合併時，bitGen 會彈出此對話方塊。你可以拖曳其標題列移動它；✕ 或 Esc 會關閉它，場景則保持等待狀態。它把 Daz 場景分為三組列出：
**Figures & objects**、**Lights** 和 **Cameras**。每個項目都有核取方塊，每組都有 *all* / *none*。然後選擇：

- **Scene camera**：保留場景自身的攝影機，或使用某臺已勾選的 Daz 攝影機。
- **Stretch the frame range**：延長場景的影格範圍，以覆蓋整個 Daz 動畫。

**Merge** 會把勾選的項目連同其下的所有內容（人物的身體和服裝會隨其骨骼一起帶過來）追加到所開啟 .blend 中一個名為 "Daz" 的集合裡。Daz 動畫會按場景的幀率重新分佈，例如把 30 fps 的動畫放入 24 fps 的場景，隨後預覽會重新載入。**Open on its own** 則改為單獨開啟該 Daz 場景。**Cancel** 會丟棄它。

3D 傳送方式需要 Blender（bitGen 會自動找到它；其路徑在 *🟧 Blender settings* 中設定）。橋接只發送 Daz 所寫出檔案的路徑，因此 Daz 和 bitGen 必須在同一臺電腦上執行。它使用 curl，Windows 10+ 和 macOS 均已內建。

## 📏 Sketcher - 3D 建模、房間與攝影機（2.619 - 2.653）
<!-- en: sketcher-3d-modelling-rooms-and-cameras-2-619-2-653 a19392027f87 -->

**Sketcher**（草圖建模）面板（其按鈕在狀態列中，預設隱藏）用於以快捷的方式進行 3D 建模：在地面或某個面上畫出形狀，然後將其推拉成實體；也可用來搭建房間乃至整棟房屋，作為影片的拍攝場景。它取代了舊版本中的 House builder。完整清單見其 ❔。

**功能概覽：**

- **建模**：直線、矩形、圓、多邊形、推/拉、偏移、移動/旋轉/縮放（也可複製）、群組、面的擠出或扭轉、邊的移動/擠出/倒圓角，隨時可輸入精確尺寸。
- **搭建**（Build 工具）：帶共用牆的房間、獨立牆、門窗（開啟或關閉）、地板、天花板（平頂或隨斜牆傾斜）、屋頂、樓梯和燈光（白天/🌙 夜晚）；牆可沿垂直於自身軸線的方向拖曳，也可自由拖曳；牆頂可傾斜。
- **📐 Floorplan**（平面圖，2.647.0）：採用應用程式主題配色（2.649.0）的正俯檢視，每次顯示一層——牆體以實心剖切顯示，門帶開啟弧線，窗、樓梯、家具和燈光以平面符號表示，並標出每個房間的名稱、Width × Length（寬 × 長）和面積。每個工具在此的繪製方式都與 3D 中相同；點選可選取符號。在任意位置按 **Esc**：取消工具、取消選擇，回到 🔄 Orbit。
- **🗂 Outline**（大綱）：列出每個房間及其組成部分（牆、地板、天花板、踢腳線、頂角線、門、窗），可隱藏或顯示，房間可編組。在檢視或大綱中點選某個部分，會顯示**該部分自身的屬性**（牆的長度、高度和顏色；天花板的類型；踢腳線的輪廓）。
- **輪廓**：踢腳線、頂角線、門框、窗框和窗臺的輪廓可從帶圖示的下拉式清單中選取，也可在 **✎ Profiles**（輪廓）對話方塊中繪製並儲存在專案中。
- **⛰ Terrain**（地形，2.653.0）：建築周圍的地面——可用畫筆抬高、降低、平滑和壓平；可按你在各自高度上繪製的 〰 等高線塑形；可由高度圖圖片生成；可在房間下方找平；其等高線會顯示在地面和平面圖上。
- **佈置家具**：🛋 家具庫和人物、帶紋理的材質、🪄 Furnish（由 LLM 佈置房間）、專案中的 3D 模型。
- **📷 Cameras**（攝影機）：可選取、移動（箭頭）和轉動（圓環，雙擊），可設定鏡頭/焦距/視場角，👁 Look through（並可在其自身視角中移動或轉動它），可拍攝帶深度圖和法線圖的畫面，可為影片渲染設定 📍 360° 地點。
- **輸出**：透過提示詞面板生成模型的 ✨ 真實照片，將圖片或 3D 圖層傳送到影像編輯器和時間軸，傳送到 Blender、Unreal，或匯出為 .glb / .obj / .stl。

1. 按 **R**（Rectangle），在地面上點選一個角點，移動滑鼠，輸入 `4,3` + Enter——得到一個 4 × 3 m 的面。
2. 按 **P**（Push/Pull），點選該面，向上移動，輸入 `2.7` + Enter——得到一個 2.7 m 高的盒子。
3. 在盒子的側面**上**畫一個矩形並將其推入——得到一個窗洞；一直推穿——得到一個孔洞。
4. 或者：在地板面上使用 **F**（Offset），輸入 0.2 + Enter，然後將環形面向上推——得到圍合房間的四面牆。

尺寸可隨時輸入（無需點選輸入框）：長度（`1.5`、`150cm`、`1500mm`、`5'`）、兩個值（`3,2`）、邊數（`36s`）、角度。標記會顯示該點吸附到的物件（Endpoint、Midpoint、On Edge、On Face、On Ground），當你位於紅/綠/藍軸上時會顯示一條虛線——按住 **Shift** 或按 **→ ← ↑** 可鎖定該軸。按住中鍵拖曳可環繞檢視，按住右鍵拖曳可平移，滾輪縮放，**Shift+Z** 顯示全部。

其他工具：**L** Line（穿過面的線會將其分割）、**C** Circle、**N** Polygon、**M** Move（**Ctrl** = 複製，可輸入 `x,y,z`）、**Q** Rotate、**S** Scale、**T** Tape、**B** Paint、**E** Eraser、**Space** Select（雙擊群組可進入其內部編輯，**G** 建立群組）。模型儲存在專案中（projects/<project>/pushpull），並會自動儲存；**↶ ↷** 復原/重做。**➜ Send** 可將模型傳送到影像編輯器（檢視的圖片）、時間軸（3D 圖層）、Blender 或 Unreal；**⤓ Export** 匯出 .glb / .obj / .stl；**⤒ Import** 將專案中的 3D 模型作為群組匯入。

### 搭建：房間、共用牆、門、窗、屋頂、燈光（2.620.0）

建模工具下方的 **Build**（搭建）工具可建立始終保持可編輯的建築：

1. 按 **U**（Room），點選一個角點，輸入 `4,3` + Enter——得到一個帶牆、地板和天花板的 4 × 3 m 房間。
2. 在稍遠處再畫一個房間，然後用 **Space**（Select）按住它並向第一個房間拖曳。當它的牆靠近第一個房間的牆時會吸附上去——兩個房間現在擁有**一面共用牆**（並且角點對齊）。
3. 按 **D**（Door），在共用牆上點選——門會貫穿該牆。按 **I**（Window），在外牆上點選。用 Select 可沿牆拖曳門或窗；其尺寸、樣式和窗臺在右側面板中設定。
4. 按 **X**（Light），在面板中選擇類型——筒燈、吸頂燈、吊燈、枝形吊燈、射燈、壁燈、落地燈或檯燈——然後在房間內點選：燈會安裝在該房間的天花板上（房間中心處有吸附）。**🌙 Night**（夜晚）會調暗太陽，讓燈光照亮房間。
5. 按 **Y**（Roof），點選一個房間——在其上方生成雙坡屋頂；**Shift+click** 另一個房間可將其納入同一屋頂之下。在面板中可選擇雙坡（Gable）、四坡（hip）、單坡（shed）或平頂（flat），並設定坡度和挑簷。**⌂ Cut-away** 可隱藏屋頂和天花板。

另有：**W** Wall（獨立牆；再次點選起點可圍成房間）、**J** Floor（不帶牆的地板）、**K** Ceiling（開/關房間的天花板）、**V** Stairs。點選任何已搭建的物件可檢視其設定——房間的尺寸、牆高和牆厚、室內顏色、⟳ 90°、⧉ Duplicate。**B** 可為牆/地板/天花板/門/屋頂上色，**E** 或 **Delete** 用於刪除。所有內容都會隨模型一起儲存、復原、匯出和傳送（燈光會以 glTF 燈光的形式進入 Blender 和 Unreal）。

**⛶**（位於面板標題列上）可讓面板鋪滿 bitGen 視窗中標題列與狀態列之間的整個區域（2.625.0）；此時它變為 **⇲ Dock**——點選它或按 **Esc** 即可還原。旁邊的 **✕** 用於關閉面板（2.624.0）。
**☰ File** 中有 New、Open、Save、Save as、Rename、Import（專案中的 3D 模型或本機上的檔案）、Export、Send、Delete 和 Close；**🖼 → Image editor** 和 **🎞 → Timeline** 是工具列上的按鈕。

### 地板上的牆、斜牆、隨牆傾斜的天花板和屋頂（2.624.0）

- **bitGen 的主題配色**：面板及其 3D 檢視的背景、網格和選取範圍都採用主題配色（並隨主題變化）。
- **Offset from floor edge**（距地板邊緣偏移，位於 Room 和 Wall 工具的面板中）：沿地板（J）邊緣繪製的房間或牆，其牆體外表面會從邊緣內縮該距離（0 = 位於邊緣上）。
- **拖曳單面牆**（使用 Select，在房間的某面牆上按住）：牆會沿垂直於自身的方向移動，房間隨之拉伸。拖曳時地板邊緣會顯示其**吸附區域**；在其中鬆開，牆的外表面就會落在邊緣上（含偏移量）。拖曳整個房間時也會吸附到地板邊緣。Shift = 不吸附。
- **雙擊牆頂** = 在該處新增一個切點；上下拖曳該切點，牆頂會從兩端角點向它傾斜（形成山牆）。點選**頂邊**並拖曳（或在面板中輸入其兩端的高度）可使牆傾斜——拖曳角點時會帶動相鄰的牆。選取切點或邊後按 **Delete** 可將其刪除。
- 房間的 **Ceiling**（天花板）：None、**Flat** 或 **Follows the walls' slope**。**Roof** 工具的類型 **Follows the walls' slope** 會落在傾斜的牆頂上，並帶有 **Eaves width**（簷口寬度）。
- **雙擊空白處**：取消所有選擇，工具切換為 **🔄 Orbit**（按 Space 再次切換為 Select）。

### 編輯面、邊和角點；手動調整門窗（2.625.0）

使用 **Select** 時：
- **面**：面板顯示 **Extrude**（擠出；+ 向外，- 向內 = 切入物體）和 **Twist**（扭轉）。**拖曳面**可隨指標擠出（類似 Blender）；**Ctrl+drag** 使其繞法線旋轉——剛擠出的面會使其擠出部分隨之扭轉。在 Measurements 框中輸入距離可修改上一次擠出。
- **邊**：拖曳可移動它（Shift：單軸）。**Shift+click** 可選擇更多邊，**Ctrl+click** 選擇其所在面周圍整圈的邊。面板中有：**Length**、**Extrude edge**（生成一個新面——向上、從其所在面向外、沿紅/綠軸）、**Fillet**（半徑 + 段數；將兩個面之間的邊倒圓）。
- **角點**：點選並拖曳（Shift：單軸；會吸附到其他角點上），或輸入 X / Y / Z。被彎折而不再平整的面會被分割成三角形。
- **門或窗**：其兩側、頂部和底部（門除外）有控制柄——拖曳它們可調整寬度、高度和離地高度；窗本身可沿牆拖曳，也可上下拖曳。窗的面板中有 **Elevation (height from floor)**（離地高度）。

### 大綱面板、踢腳線 + 頂角線、拖曳牆、房間組（2.639.0）

- **🗂 Outline**（位於 Sketcher 的工具列上）——檢視左側的一個面板，列出所有物件：Room groups、Rooms ▸ Room 1 ▸ Wall 1 … n、Floor 1、Ceiling 1、Skirting 1、Cornice 1、Floor slab 1、Door 1、Window 1 …；獨立的 Walls、Roofs、Floors、Stairs、Lights、Furniture、Cameras。點選即選取；**👁** 隱藏/顯示（可復原，隨模型儲存）。
- **Room groups**（房間組）——＋ 新增一個組，房間上的 ⊞ 將其放入（或移出）組；組的 👁 可隱藏/顯示其中所有房間。
- **踢腳線和頂角線**——新房間預設兩者都有；在房間面板中可開關它們，並設定其尺寸和顏色。
- **牆**——被拖曳的牆沿垂直於自身軸線的方向移動（相鄰的牆隨之伸長或縮短；地板、天花板、踢腳線和頂角線隨之調整）；**Alt+drag** 可自由移動；**Shift+click** 選取整個房間。

### 選取、移動和轉動攝影機（2.641.0）

- 點選攝影機即可選取：它會醒目顯示（周圍沒有框），並顯示**移動箭頭**——紅色 X、綠色 Y、藍色 Z。
- **拖曳攝影機**可在其目前高度上移動；**拖曳箭頭**則只沿該軸移動（藍色箭頭用於升降）；步長 1 cm，Shift = 自由移動。指標下方的箭頭會變成黃色。
- **雙擊攝影機**顯示**旋轉圓環**（藍色為轉向，紅色為俯仰，綠色為滾轉——與 2.633.0 相同）；再次雙擊切換回箭頭。其面板中也有 ✥ Move / ⟳ Rotate。
- 點選其他任何物件會選取該物件並釋放攝影機；在攝影機線條旁邊點選會選取那裡的物件（以前一米以內的點選都會被攝影機捕獲）。
- **透過攝影機觀看**（2.643.0）——當選取的攝影機開啟 👁 Look through 時，其面板中的 ✥ Move / ⟳ Rotate 會在你眼前（右下方）顯示控制項：拖曳箭頭或圓環，攝影機——以及檢視——會隨之移動或轉動。**Esc** 取消選擇攝影機（檢視保持不變）。


### 各部分的獨立屬性；踢腳線、頂角線、門窗框和窗臺的輪廓（2.640.0）

- **選取某部分 = 顯示其獨立面板**——在檢視中（或在 🗂 Outline 中其所在行）點選牆、地板、天花板、踢腳線或頂角線，面板將只顯示該部分：
  - **Wall n**——Length（矩形房間會保持其形狀）、Height（僅此牆）、Thickness（房間的所有牆）、其自身的 **Inside colour**（室內顏色；↺ 恢復為房間的顏色）、👁 Shown、牆上的門/窗。
  - **Floor n**——On、Colour、Level、Floor slab；**Ceiling n**——None / Flat / Follows the walls、Colour、Height。
  - **Skirting n / Cornice n**——On、**Profile**、Height / Size、Colour、✎ Profiles…；**Floor slab n**——On。
  - ⌂ *Room*'s settings 返回整個房間的設定。對某部分按 **Delete** 會將其關閉（牆則為隱藏）——房間保留。
- **輪廓**——一個帶圖示的下拉式清單（每個輪廓都繪製為其截面）：7 種踢腳線（Square、Pencil round、Bullnose、Chamfered、Ogee、Torus、Lamb's tongue），6 種頂角線（Square、Cove、Quadrant、Ogee、Stepped、Cove + band），6 種門框和 6 種窗框（Flat、Bullnose、Chamfered、Splayed、Colonial、Lamb's tongue），5 種窗臺（Square、Bullnose、Round nosing、Chamfered、With an apron），然後是 **This project**（本專案）自己的輪廓。
  - 踢腳線沿房間一圈掃掠生成，轉角處斜接，並在門框處終止；頂角線沿天花板下方延伸。
  - 門或窗的面板：**Door frame** / **Window frame**（洞口周圍的門窗套——門為兩面，窗為房間一側）和 **Window sill**（位於窗下，向後延伸至窗框），初始為 None，另有 Frame / sill colour。
- **✎ Profiles…**（下拉式清單的最後一行，或該部分的按鈕）——側邊列出同類的所有輪廓；在畫布上繪製：點選可在最近的邊上新增一個點，拖曳可移動它，按 Delete / 右鍵點選可刪除它（1 mm 網格，Shift = 自由）；輸入 Width / Height 可縮放；**＋ New** 複製目前顯示的輪廓。**💾 Save** 將其儲存在專案中（projects/<project>/pushpull/profiles.json）並套用；模型會保留其所用每個輪廓的副本。

### 旋轉圓環、滾轉、鏡頭（2.633.0）

- 選取的攝影機或家具會顯示三個圓環：**藍色**使其轉向（偏航），**紅色**使其俯仰，**綠色**使其滾轉。沿圓環拖曳：步長 5°，按住 **Shift** 可自由旋轉，**Ctrl+Z** 可撤回。
- 也可在其面板中以數值設定：攝影機的 **Turn (yaw)**、**Tilt (pitch)**、**Roll**；家具的 **Turn (yaw)**、**Pitch**、**Roll**。
- 攝影機的 **Lens**（鏡頭）：Fisheye (8 mm)、Ultra wide (14 mm)、Wide angle (24 mm)、35 mm、50 mm (normal)、85 mm (portrait)、135 mm、200 mm (telephoto) 或 Custom；**Focal length**（焦距，mm，全畫幅）與 **Field of view**（視場角，°）相互聯動。魚眼鏡頭提供最寬的視野（但不繪製其畸變曲線本身）。Camera 工具的面板中也有相同的 Lens / Focal length / Field of view。
- **Zoom extents** 現在也會將攝影機納入範圍。

### 選取、移動、轉動攝影機；取消選擇（2.632.0）

- 攝影機繪製在所有物件之上——位於房間內（在其天花板和屋頂下方）的攝影機點選即可選取，而不會選取房間。拖曳可移動它；**R** 使其轉動 15°，**Shift+R** 反向轉回（家具：R 為 90°，Shift+R 反向）。
- **Esc** 或**雙擊空白處**會取消所有選擇（2.647.0：按一次 Esc 也會放下目前工具，切換為 🔄 Orbit；2.648.0：在 Orbit 中按 Esc = ➤ Select，Ctrl+click 可選取多個物件）。
- **🔄 Orbit** 的指標是環繞游標（圍繞一個點的兩個箭頭），而不是手形（✋ Pan 仍為手形）。

### 攝影機檢視、開啟的門窗、自動屋頂 + 地板（2.631.0）

- **View ▾** 會隨著攝影機的新增、重新命名或刪除列出模型中的攝影機（📷 Camera 1、…）；從中選擇一個作為檢視——採用它的位置、朝向和鏡頭（其自身的圖示會移到不擋視線的地方）。在其面板中更改轉向/俯仰/鏡頭會使檢視隨之變化；環繞、平移或縮放（或切換到標準檢視）則會脫離該攝影機檢視。
- 門或窗：**Open (%)** 和一個方向核取方塊——門向房間內開啟（**Opens outward**：向外開），窗扇向外開啟（**Opens inward**：向內開），推拉門/窗則滑動其中一扇（**The other pane slides**：改為滑動另一扇）。
- Room 工具：為每個新房間提供 **Auto roof**（採用 Roof 工具的類型）和 **Auto floor**（牆下 20 cm 厚的樓板）；房間面板中：**Floor slab under the walls** 和 **Roof** 開/關。

### 人物；舊版本的房屋（2.630.0）

- **🛋 ▸ People**：站立、坐著、行走或揮手的人體模型——在地板上點選放置；選取後可設定：Name、Pose、Height、Turn。
- **☰ File ▸ 🏠 A house from the House builder…**：由舊版本 House builder 儲存的房屋會轉換為 Sketcher 模型——房間（每層位於各自的高度）、門、窗、家具、人物、攝影機、燈光、樓梯；未能轉換的部分（3D 模型部件、屋頂）會在狀態行中列出。
- **Sketcher 取代了舊版本的 House builder**。SolidCraft 的 **📏 Send to Sketcher** 可將零件作為群組匯入。

### 材質、攝影機 + 360° 地點、Furnish（2.629.0）

- **▦ Materials ▾**（位於顏色旁）：各種材質——磚、石材、混凝土、橡木/胡桃木地板、瓷磚、大理石、地毯、草地……均帶紋理；選擇一種後即可為面、牆和地板上色（B）。
- **Z 📷 Camera**：先點選攝影機的站立位置，再點選其注視位置（視線高度 + 鏡頭在面板中設定）。選取後：**👁 Look through**、**📷 Shot + depth + normal**（三張圖片存入 Image assets）以及 **📍 360° location**（由此生成的全景圖成為一個 Location——帶有它的 @tag，即提示詞中的地點）。用 Select 可拖曳它；在面板中可轉動/俯仰/命名。
- **🪄 Furnish**（位於房間面板中）：為房間佈置家具——若有 LLM 在執行則由其挑選，否則使用該房間常規的家具組合；可選填描述（"a reading corner"）。Ctrl+Z 可撤除。
- 家具現在也會包含在 .glb / .obj 匯出中。

### 家具和專案的 3D 模型；最大化 = 獨佔（2.628.0）

- **A 🛋 Furniture**（Build 工具）：家具庫——選擇一個 **Category**（Living、Dining、Kitchen、Bedroom、Bathroom、Lights、Outside）和一件家具，在地板上點選即可放置（它會立在房間的地板上，帶有其材質和紋理）。**R** 使下一件家具轉動 90°（或輸入角度）。使用 **Select** 時：拖曳家具，R 使其轉動；其面板中有 Width / Depth / Height、Turn、Up from the floor、其自身顏色、⧉ Duplicate、🗑 Delete。家具隨模型一起儲存。
- **3D models** 類別列出專案中的 3D 模型（.glb / .obj——SolidCraft 生成的或匯入的）；點選即可將其作為群組匯入（可移動、縮放、上色）。
- **⛶ Maximize** 現在會關閉其他所有面板（標題列和狀態列保留）；**⇲ Dock** / Esc 會重新開啟那些面板。

### 模型的真實照片；Sketcher 圖層（2.626.0）

該面板現在名為 **Sketcher**（原名 PushPull；**Push/Pull** 工具保留原名）。
- **當提示詞面板開啟時**（且影像編輯器不在螢幕上——它有自己的 Edit 連結——除非 Sketcher 已最大化）：提示詞面板切換到 **🖼 Image**，並使用一個**編輯模型**（Qwen Image Edit、FLUX Kontext、FLUX.2 Klein edit ...——若該處所選模型支援編輯則使用它，否則使用預設模型），空的提示詞會填入 **create a real photo of the model in view**，按鈕顯示為 **✏ Edit (Sketcher)**。Generate 會將 Sketcher 的檢視傳送給該編輯模型，照片以**真實影像**的形式返回——即專案 **Image assets** 中的一張普通圖片（若影像編輯器已開啟，還會成為其中的一個普通圖層）。修改描述可得到其他效果（"a rainy evening street, cinematic"）。
  2.627.0：傳送給編輯模型的是檢視的**乾淨渲染圖**（無輪廓線、網格或座標軸；帶陰影；日光天空）作為圖片 1，以及其**深度圖**（近處為白，遠處為黑）作為圖片 2，且提示詞以
  "Convert image 1: Turn this 3D render into a photorealistic photograph of a building: real brick, timber, glass and concrete, natural daylight, soft shadows, no outlines, DSLR photo." 開頭，並附加一行說明圖片 2 是其深度圖（對圖片的稱呼採用編輯模型自己的寫法——Qwen 2.1 為 <image1>）。你的描述會新增在其後。關閉 Sketcher 時，提示詞面板的模式、風格和文字會恢復原樣。
- **🖼 → Image editor** 將檢視作為一個 **📏 Sketcher layer**（以模型命名）傳送；再次傳送時會更新該圖層，而不是新增一個。**🎞 → Timeline** 將模型作為 **📏 Sketcher layer**（3D）放入時間軸。

## 在時間軸上編輯：速度、調色、聲音、混音和字幕（2.406.0）
<!-- en: editing-on-the-timeline-speed-colour-sound-mix-and-captions-2-406-0 88fa8720a65f -->

在時間軸畫布上選擇一個片段；其 **Properties**（屬性）中會出現三個摺疊欄。所有設定都隨時間軸儲存，畫布會即時預覽，**⚙ Compile** 會將其渲染出來。

### 🎬 Speed（速度）

| 控制項 | 作用 |
|---|---|
| **Speed %** | 50 = 半速（在時間軸上時長加倍），200 = 兩倍速（時長減半）；10 – 1000 % |
| **⇄ reverse** | 片段倒放 |
| **Ramp** | 速度沿片段變化：*slow → fast*、*fast → slow*、*slow middle*、*fast middle*（會取代 Speed %） |
| **Frames** | 慢放影格的生成方式：*repeat*（清晰，但有頓挫感）、*blend*（混合相鄰影格）、*optical flow*（流暢；編譯較慢） |

片段在時間軸上的長度隨其速度變化。修剪邊緣修剪的仍是*源素材*，對變速片段執行 keep / cut 也會保留正確的影格。在畫布中，倒放或變速曲線片段會靜音播放（瀏覽器無法倒放聲音）；編譯時會按該速度渲染其聲音（保持音調不變）。

### 🎨 Colour（調色）

- **Look**：teal & orange、warm film、cool night、bleach bypass、vivid、faded、mono——作為滑桿調整的起點。
- **滑桿**：exposure（曝光，單位為檔）、contrast（對比度）、saturation（飽和度）、temperature（色溫，藍 ↔ 琥珀）、tint（色調，綠 ↔ 品紅）、hue（色相）。
- **LUT**：任意 3D `.cube` LUT（來自相機廠商、調色師或 LUT 包）。**＋ LUT** 將其匯入專案的 `luts/` 資料夾；應用程式自身 `luts/` 資料夾中的 LUT 在所有專案中均可使用。**LUT mix** 控制其混合比例。

先套用 LUT，再套用滑桿。畫布顯示的調色效果使用的正是編譯時所用的同一張顏色表（整個調色效果會烘焙進一個 33 點 LUT），因此所見即所得。

### 🎧 Sound（聲音）

在影片片段或聲音片段上：**voice clarity**（去除低頻隆隆聲，略微增加臨場感並均衡音量）、**denoise**（去除穩定的背景噪聲：嗡嗡聲、嘶嘶聲、風扇聲）和 **gain**（增益，dB）。**🎧 before / after** 從位置標記處開始播放幾秒鐘，先播放原聲，再播放處理後的聲音。

### 🎚 Mix（混音）

時間軸上的 **🎚** 開啟 Mix 對話方塊：

- **Roles**：每個圖層為 🗣 *voice*、🎵 *music* 或 💥 *sfx*（V1 和影片圖層初始為 voice，聲音圖層初始為 music）。
- **Ducking**：只要有人聲出現，音樂就會按所選幅度（3 – 30 dB）降低，之後再恢復。
- **Loudness**：測量成片的響度，並將其統一到目標值：-14 LUFS（YouTube、Spotify）、-16（播客、Apple）、-23（廣播電視，EBU R128）或 -24（美國廣播電視）。真峰值保持在 -1.5 dB 以下。

### 💬 Captions（字幕）

時間軸上的 **💬** 開啟 Captions 對話方塊。

1. **✨ From speech** 在本機上使用 faster-whisper（在 *Settings → Audio* 中安裝）轉錄所有含語音的內容（V1、影片圖層，以及設為 🗣 voice 的任何聲音圖層），並生成字幕——每個片段的文字放在該片段所在的位置，並計入其修剪和速度。每個檔案只轉錄一次，結果會被記住。*max chars* 設定單條字幕的最大長度；*language* 可保持為 auto。
2. 編輯字幕：開始和結束時間、文字，**＋** 在位置標記處新增一條字幕，**✕** 刪除一條，**▶** 跳轉到該處。
3. **Style**：字型、字號（佔畫面高度的 %）、顏色、粗體、描邊或文字後面的 **box**（底框，可設顏色和不透明度）、底部/中間/頂部位置及邊距。
4. **Output**：*burn into the movie* 和/或 *.srt beside it*（以影片名加 `.srt` 命名——播放器和 YouTube 會將其作為字幕軌讀取）。**⬇ .srt** 立即下載字幕。取消勾選 *on* 可保留字幕但不使用。

畫布繪製字幕的位置與編譯時燒錄的位置完全一致。

## 編輯工具、調色面板、匯出佇列和交換（2.407.0）
<!-- en: edit-tools-colour-panel-export-queue-and-exchange-2-407-0 4dd0750a653b -->


### 編輯工具

時間軸的工具按鈕：**▸ Select**（移動、修剪——與以前相同）、**⇤ Ripple**（拖曳邊緣：修剪它，並移動該圖層上其後的所有內容）、**⇹ Roll**（拖曳兩個相接片段之間的邊緣：剪下點移動，總長度不變）、**⇆ Slip**（拖曳片段：顯示其源素材的其他影格，位置和長度不變）以及 **↔ Slide**（拖曳片段：它移動，兩側片段相應伸縮）。指標旁的提示會顯示拖曳的效果。放大檢視可讓每個邊緣都有各自的控制柄。倒放的片段無法用這些工具編輯（其邊緣方向是反的）。

**▯ Frame**（圖層上方的 F）用於選擇單影格：點選某圖層的軌道（在片段上或片段之間），指標下方**該**圖層上的影格即被選取——位置標記跳到該影格，並在該行上框出該影格。橫向拖曳可選擇多影格，Shift+click 可從已選影格一直選到所點選的影格，← / → 將選取範圍移動一個影格（Shift：移動其末端）——在任何縮放級別下都精確。**Del**（或 ⌫）從該圖層刪除所選影格並閉合間隙（無論 ripple 核取方塊如何設定，總是如此）；↶ / Ctrl+Z 恢復；Esc 取消選取範圍。
▯ Frame 開啟時片段不會移動——按 V 切換到 ▸ Select。

**被剪下的片段仍是一個片段。** 在 ripple 開啟時，若 ✂ Cut（或對影格按 Del）穿過片段中間，剪下點之前和之後的部分會重新合併為一個連續的片段：影片（或聲音）會生成一個新檔案——專案 Video assets 中的 "<name>-join1.mp4"（聲音則為 Sound 中的 "-join1.flac"）——其中被剪掉的部分已去除，精確到影格；圖片則只是變短。剪下會立即顯示，合併稍後完成（較長的影片需要幾秒鐘）；一次 ↶ 即可同時復原兩者。以下情況保留為兩個片段（狀態行會說明原因）：變速片段（speed / reverse / ramp）、cut-out 片段、文字/形狀/3D/生成的片段，以及 ripple 關閉時的剪下（間隙保留）。預覽也會在下一個片段開始前一秒預先載入它，因此兩個片段之間的剪下點不再閃黑。

**播放時用 Ctrl 標記 ▼ 範圍。** 反白一個圖層，播放預覽，在範圍應開始的位置輕按 Ctrl（按下後鬆開）——時間標尺上位置標記處會出現一個 ▼——在範圍結束處再輕按一次 Ctrl（出現第二個 ▼）。播放會繼續進行，因此一遍即可標記任意多個範圍；每個範圍有各自的顏色，並在其圖層行上顯示一條色帶。暫停時，指標位於時間軸上時輕按 Ctrl 效果相同。Esc 會放棄已開始的範圍。無論焦點在哪裡（▶、速度清單、已勾選的核取方塊、縮放滑桿），輕按 Ctrl 都會生效——只有可輸入文字的框會攔截它——預覽面板的播放器在播放時間軸上的某個片段時也同樣生效（範圍會落在該片段在時間軸上對應的時刻）。拖曳 ▼ 可移動該端點（以整影格為單位）——預覽顯示其下方的影格。點選 ▼ 會**選取**其範圍（Ctrl+click 或 Shift+click 可選取更多；Esc 取消選取）；右鍵點選 ▼ 會刪除其範圍，Del 刪除所選範圍的標記。時間軸選單列中的 ▼ 組包括：計數、**✂ Cut**（剪掉所選範圍——"✂ Cut 2 picked"——若未選取任何範圍，則剪掉所有範圍：從其圖層中移除，是否波紋移動取決於其核取方塊；被多次剪下的片段會重新成為一個片段；選擇欄中的 ✂ Cut 也會剪掉所選範圍）、**⏩ Speed up**，可選 2× / 4× / 8× / 10×（影片圖層上的所選範圍或全部範圍以相應倍速播放——就像快進跳過一段你不想等待的渲染；在 ripple 下其後的內容會前移），以及 ✕（刪除所選標記，或全部標記）。Ctrl+Z 可復原以上任何操作。

**停留時間和播放速度。** 在時間軸上停留時，會在一個小框中顯示指標下方的時間（時間碼 · 秒 · 影格）。預覽下方 🔁 旁的速度清單可按 0.125×、0.25×、0.5×、1×、2×、4× 或 8× 播放（▶ 和 Space 使用該速度；播放中更改會立即生效；設定會被保留）。J / K / L 仍可用於穿梭播放。

**✂ to new layer**（時間軸選單列中的核取方塊，設定會保留）：✂ Cut、對影格按 Del 以及 Ctrl+K 分割會將剪下點**之後**的部分放到緊鄰上方的新圖層（"<layer> ✂"；V1 的部分放到第一個影片圖層）。剪下點之前的部分保持原位。一次 ↶ 即可復原。

**J / L 剪輯**（V1）：在 V1 片段的 🎧 Sound 中，*J … s early* 讓其聲音先於畫面開始，*L … s late* 讓聲音在畫面結束後繼續；相鄰片段自身的聲音在這段時間內會被靜音。

**時間碼**：位置旁顯示 HH:MM:SS:FF。起始時間碼（例如 01:00:00:00）和幀率在 📤 Export 或 ⇄ Exchange 中設定。

### 🎨 調色面板

時間軸上的 🎨（或片段 Colour 摺疊欄中的 *🎨 more…*）會為所選片段開啟 Colour 對話方塊：

- **Wheels**（色輪）：Lift（暗部）、Gamma（中間調）、Gain（高光）。將圓點拖向某種顏色；每個色輪下方的滑桿使該亮度範圍變暗或變亮；雙擊色輪可使其歸中。
- **Curves**（曲線）：Master、R、G、B。點選新增點，拖曳移動點，雙擊刪除點。
- **HSL secondaries**：最多六個色相範圍，每個都可單獨偏移、增減飽和度或提亮（更藍的天空、更暖的膚色、更柔和的綠色）——畫面其餘部分不受影響。
- **Scopes**（示波器）：位置標記處畫面的波形圖、RGB 分量圖、向量示波器和直方圖，顯示的是影片最終得到的畫面。

所有這些都會烘焙進與 Look 預設和 LUT 相同的顏色表中，因此畫布與編譯結果一致。

### 📤 Export（匯出）

新增影片需要輸出的所有格式——一次編譯即可全部生成，存放在 `<project>.mp4` 旁邊：

| 格式 | 用途 |
|---|---|
| MP4 · H.264 | 通用 |
| MP4 · H.265 / HEVC | 體積約減半；需要較新的播放器 |
| MOV · ProRes 422 HQ | 剪輯和後期精修（體積大） |
| MOV · DNxHR HQ | Avid、Resolve（體積大） |
| WebM · VP9 | 網頁 |
| GIF | 預覽（無聲音，15 fps，寬度最大 640） |
| WAV, MP3 | 僅聲音 |

每種格式都有 **size**（短邊尺寸）、**reframe**（9:16、1:1、4:5、21:9——*crop* 裁切中間部分，*pad* 用黑邊填充，或用 *blur* 填充：在後方墊一份模糊的副本）、**frame rate**（幀率）和 **quality**（品質）。預設包可一次新增多個格式（*social*、*for editing*、*web*）。
*make them on every ⚙ Compile* 使該清單始終生效；**⚙ Compile + export** 立即執行。**Delivered** 列出可下載的檔案。起始時間碼會寫入 MP4 和 MOV 檔案；字幕的 `.srt` 放在每部影片旁邊。

### ⇄ Exchange（交換）

- **Send to another editor**：*Final Cut Pro 7 XML*（可在 DaVinci Resolve、Avid 及大多數其他影片剪輯軟體中開啟）、*CMX3600 EDL*（僅 V1——該格式只能容納一條畫面軌）或 *OpenTimelineIO*。片段指向本專案中的檔案。保留：片段、修剪、圖層、靜態圖片、速度和倒放、不透明度、音量、時間碼。不保留：運動和關鍵影格、調色、字幕、3D 圖層。
- **Bring in from another editor**：選擇一個 XML（大多數剪輯軟體：*File → Export → Final Cut Pro XML*；Resolve：*Export Timeline → FCP 7 XML*）或 EDL。它會作為一條新的命名時間軸開啟；片段按檔名與本專案的素材匹配，缺失的片段會列出來（新增它們後再匯入一次）。

## 按文字稿剪輯、場景剪下、卡拉 OK 錯詞修正（2.408.0）
<!-- en: edit-by-transcript-scene-cuts-karaoke-word-fixes-2-408-0 77ba86c0d7d0 -->

### 📝 Transcript（文字稿）

在時間軸上選擇一個影片或聲音片段，然後按時間軸上的 **📝**。片段中的文字會顯示出來：其檔案在本機上只轉錄一次（faster-whisper，*Settings → Audio*），結果會被記住，與 💬 Captions 相同。

- **選擇文字**：點選文字，shift-click 選擇一段連續文字，或橫向拖曳選擇。雙擊某個詞可跳轉到該處。
- **✂ Cut them**：刪除所選文字並閉合間隙；該圖層上其後的片段前移。
- **⇥ Keep only them**：刪除所選文字以外的所有內容。
- **Remove pauses over … s**：每段長於該時長的靜音（包括片段末尾）都會縮短為 0.3 s。
- **Remove filler words**：刪除 um、uh、erm、hmm 之類的填充詞（以斜體顯示）。
- **↺ Undo** 恢復上一次剪下。片段會變為同一檔案的多個片段，文字稿會繼續跟隨它們，因此可以繼續剪下。
- **✂ Scene cuts** 在鏡頭切換處分割片段。調低 *sensitivity* 數值可偵測到更柔和的切換。

速度已更改（🎬）的片段必須先恢復為 100 % 才能按文字剪下。

### 🎤 Karaoke：錯詞修正

- **✎ Edit lyrics**：若某首歌曲沒有已儲存的歌詞，此框現在會顯示語音轉文字識別出的文字——即卡拉 OK 所顯示的文字——以便你更正錯詞（或貼上真實歌詞）。**Generate** 會儲存歌詞，並重新將其與歌曲對時。
- **⏱ Words & timing**：疊加層將顯示的每個詞，及其開始和結束時間。▶ 播放某個詞。可在此更正單個詞或微調其時間；**Generate** 會為該歌曲保留你的更正（*↺ undo my corrections* 會將其刪除）。之後若更改歌詞，將從新歌詞重新開始。
- **💾 Save words** 為該歌曲儲存更正，但不立即生成疊加層。
- **從 StoryBoard 中**：🎤 Karaoke 旁的 **✎** 會針對分鏡腳本的歌曲開啟此對話方塊。執行 **💾 Save words** 後，每個已有歌詞疊加層的場景都會用更正後的文字重新生成疊加層（新疊加層會替換時間軸 Karaoke 圖層上的舊疊加層）。

## 為所有影片模型啟用 Override style（2.409.0）
<!-- en: override-style-for-every-video-model-2-409-0 ad09dc44a701 -->

在 Basic Settings 頂部勾選 **Override style**（覆蓋風格）後，無論風格如何設定，都由 Basic Settings 為**所有**影片模型做決定——MiniMax H3、Wan 2.1 / 2.2 以及 LTX 2.3 / 2.5：

| 設定 | 開啟 Override style 時的作用 |
|---|---|
| **Steps** | 使用該步數（0 = 模型自身的步數）。LTX 的 8 步排程會沿同一曲線按該步數重新劃分；其簡短的精煉步驟保持不變 |
| **CFG** | 引導強度（LTX：其 CFG 引導器，LTX 2.5 的影片 CFG——音訊 CFG 保持不變） |
| **Seed** | -1 = 隨機，任意數字 = 使用該種子 |
| **Model** | 新增的 *Model (override)* 框：ComfyUI 列出的任何模型；留空 = 使用風格自身的模型。Wan 2.2：替換高噪聲模型（低噪聲模型保持不變）。`.gguf` 檔案透過 ComfyUI-GGUF 的載入器載入 |
| **LoRAs** | *Temporary LoRAs (video)* 會疊加在風格內建的 LoRA 之上 |

開關下方的一行文字會說明它目前正在決定哪些設定。若取消勾選，則與以前一樣，以各風格自身的設定為準。
Generate 使用提示詞面板中的文字；聊天中的 ⬇ To prompt / ▶ 按鈕以及 Enhance 的 **Generate** 也以同樣方式傳送各自的文字（Enhance 的 Generate 以前在使用 LTX 風格時會失敗）。場景板上的 ▶ 也會使用該模型、步數和 CFG（其場景保留 StoryBoard 的 ⚙ 中各自的種子規則）。LTX 模型是針對 8 步和 CFG 1 蒸餾的——增加步數或提高 CFG 會改變畫面效果，且耗時更長。

## ✨ Effects 和 ◐ 調整圖層（2.409.0）
<!-- en: effects-and-adjustment-layers-2-409-0 7fe06e2b0737 -->

**✨ Effects**（特效，位於影片片段的 Properties 中）：blur（模糊）、sharpen（銳化）、glow（輝光）、vignette（暗角）、grain（顆粒）；**crop**（裁切，每條邊以 % 設定，裁掉的部分變為透明——畫面保持原位）；**key**（去背，用於綠幕或藍幕：選取顏色，*match* = 多接近的顏色仍會被去除，*edge* = 柔化邊緣，*spill* = 去除邊緣上幕布顏色的溢色——下方圖層會透出來）；**stabilise**（穩定，在編譯時穩定抖動的鏡頭）。畫布對 key 和 crop 的顯示完全準確，其他效果則為近似顯示。

**◐ Adjustment layer**（調整圖層，位於時間軸工具列中）：在位置標記處、新的頂層圖層上新增一個片段。其 🎨 Colour（Look、滑桿、LUT、色輪、曲線、HSL）和 ✨ Effects（模糊、銳化、輝光、暗角、顆粒）作用於其下方的所有內容，且僅在它覆蓋的時段內生效。可像圖片一樣修剪、移動和淡入淡出；其不透明度控制調整效果的混合程度。

## 🎤 Karaoke：逐詞微調、標記下方的歌詞行（2.433.0）
<!-- en: karaoke-word-nudges-the-line-under-the-marker-2-433-0 4ff941804b91 -->

在 🎤 Karaoke ▸ **⏱ Words & timing** 中，每個詞都有 **◀ ▶**（提前/推後）——詞的開始和結束時間一起移動：

| | 移動物件 | 移動量 |
|---|---|---|
| 點選 | 該詞 | **微調量**（0.05 s） |
| **Shift**+click | 該詞 | **較大微調量**（0.25 s） |
| **Ctrl**+click（Mac 上為 ⌘） | 該詞**及其後的所有詞** | 微調量 |
| **Shift+Ctrl**+click | 該詞及其後的所有詞 | 較大微調量 |

這兩個數值即清單上方的兩個框（**Nudge** / **Shift**）——會保留到下次使用。任何詞都不會移到 0 s 之前：若某次移動會導致這種情況，該次移動涉及的每個詞的移動量都會被同等縮短，從而保持它們的間距不變（提示會說明實際移動了多少）。
Generate（或 💾 Save words）會為該歌曲保留新的時間。

**標記下方的歌詞行**會醒目顯示——即預覽標記所在處正在演唱的那一行的所有詞（若下一行在 1.5 s 內開始，則為下一行）；正在演唱的詞更亮，👁 on canvas 會在畫布上繪製同一行。

## 🎤 Karaoke 和 🧰 Tools 作為畫布旁的面板（2.410.0）
<!-- en: karaoke-and-tools-as-dockers-beside-the-canvas-2-410-0 a1a5eda6a2fd -->

兩者現在都是**面板**，不再是對話方塊。按住標題列將其拖到預覽畫布的**左側或右側邊緣**（該側會亮起）後鬆開——或點選其標題列中的 **◧** / **◨**。停靠後，它與畫布等高，畫布會為其讓出空間；拖曳該欄的內側邊緣可將其加寬。將標題列拖開（或點選已反白的 ◧ / ◨），它會再次浮動。🎤 Karaoke 首次開啟時會停靠在右側（畫布足夠寬時），這樣就可以一邊播放歌曲一邊更正歌詞：

- 在 **⏱ Words & timing** 中，正在演唱的詞會亮起，清單跟隨預覽捲動；
- 詞的**時間**是一個按鈕，點選即可將預覽定位到該處；
- 開始/結束時間旁的 **⤓** 會將其設為預覽目前所在的位置；
- **👁 on canvas** 會在預覽上繪製更正後的文字（僅顯示在畫布上，絕不會進入影片）。

**Space** 可在應用程式中的任何位置暫停預覽——畫布、即時預覽或 Preview 面板中的影片——除非你正在框中輸入文字。暫停時按下則繼續播放。

## ⌨ 時間軸快捷鍵、標記、In / Out 匯出、影格（2.410.0）
<!-- en: timeline-keys-markers-in-out-export-frames-2-410-0 b730de5e8c21 -->

當指標位於時間軸的**圖層**上方時（畫布保留其自身的快捷鍵）：

| 按鍵 | 作用 |
|---|---|
| V / B / N / Y / U / F | ▸ Select / ⇤ Ripple / ⇹ Roll / ⇆ Slip / ↔ Slide / ▯ Frame |
| Del / ⌫ | （▯ Frame）從所在圖層刪除所選影格——間隙閉合 |
| Ctrl（輕按） | 播放時：在反白圖層上，從位置標記處開始一個 ▼ 範圍——在結束處再輕按一次 |
| I / O | 在位置標記處設定標尺選取範圍的入點 / 出點（In / Out） |
| Ctrl+K | 在位置標記處分割（所選片段，否則為反白圖層上的片段） |
| ↑ / ↓ | 上一個/下一個編輯點 |
| Home / End | 開頭/結尾 |
| M | 新增標記（位於標記上時：編輯其名稱、顏色、備註） |
| Shift+M / Alt+M | 下一個/上一個標記 |
| Ctrl+Shift+E | 將位置標記處的影格匯出為 PNG（指標在畫布上方時也可用） |

**標記**是標尺上的旗標：點選 = 跳轉到該處，拖曳 = 移動，雙擊 = 名稱/顏色/備註/🗑。📝 ✂ Scene cuts **as markers** 會在每次鏡頭切換處放置一個標記，而不是進行剪下。標記會在 ⇄ Exchange 中雙向傳遞（XML `<marker>`、EDL `* LOC:`、OTIO 標記）。

📤 Export 的 **Range**：*the whole movie* 或 *In / Out only*——選擇後者時，每種格式都只包含標尺選取範圍（`<project>_<format>_io.<ext>`），其時間碼從該部分的起點開始，其 .srt 也會裁切到該部分。**🖼 Export frame** 將位置標記處的畫面儲存為 `<project>_frame_HHhMMmSSsFF.png`，放在影片旁邊。

## 🅰 文字特效預設（2.411.0）
<!-- en: text-effect-presets-2-411-0 3f55fbeb835d -->

文字圖層的 Properties（時間軸）以及影像編輯器的 Type 工具/文字 Properties 中有 **Preset**（預設）：由分層 PSD 文字特效製作的文字特效——應用程式內建 **Arena Gold 3D** 和 **Trend Candy 3D**——以及經典樣式。文字會**在你輸入時即時**以該預設繪製（文字變化時顯示快速預覽圖，停止輸入後顯示清晰版本）；⚙ Compile 始終使用清晰版本。**＋ Import PSD text effects or a zip…** 可將你自己的 PSD（文字為帶圖層效果的智慧型物件）轉換為預設；背景和裝飾元素會被排除。可一次選擇多個 PSD，或選擇包含它們的 **zip**（文字特效包）：其中的每個 .psd / .psb（位於任意資料夾中）都會成為一個預設，其中的 bitGen 預設 .json 會原樣新增，其附帶的字型（.ttf / .otf）會放入應用程式自身的字型資料夾（安裝資料夾中的 `fonts\`——之後所有字型清單都會顯示這些字型）。預覽圖、說明檔案以及 macOS 的 `__MACOSX` 副本會被排除；不是文字特效的 PSD 會在說明匯入內容的那一行中列出，其餘檔案仍會照常匯入。字型並不包含在 PSD 檔案本身中：Preset 下方的提示會列出它所使用的字型。也可透過命令列操作：`node scripts/textfx_build.js <file.psd> "<Name>"` 會將內建預設寫入 `textfx/`。

## ⏯ J / K / L、AV1、10 位色深、顯示卡（2.411.0）
<!-- en: j-k-l-av1-10-bit-the-graphics-card-2-411-0 ea987911a828 -->

| 按鍵（在時間軸面板內任意位置） | 作用 |
|---|---|
| L | 正向播放；再按一次依次為 2×、4×、8× |
| J | 反向播放；再按一次依次為 2×、4×、8×（到開頭即停止） |
| K | 停止 |
| K + L / K + J | 前進 / 後退一個影格（按住 K） |

📤 Export 新增 **MP4 · AV1** 和 **MP4 · H.265 10-bit**（以及 *smallest* 交付包）。**use the graphics card's encoder when it has one**（顯示卡有編碼器時使用顯示卡編碼器）：只要在本機上可用，就用 NVENC、Quick Sync 或 AMF 生成 H.264 / H.265 / AV1，否則使用軟體編碼器——日誌會註明用的是哪一個。

## ⏱ 一些較小的剪輯改進（2.412.0）
<!-- en: smaller-editing-jobs-2-412-0 04346b1e0bfd -->

- **丟影格時間碼**（29.97 / 59.94）：📤 Export / ⇄ Exchange → *drop-frame*；檔案中使用 HH:MM:SS;FF，XML（DF）、EDL（FCM: DROP FRAME）和時間軸讀數中也是如此。
- **標記範圍**：標記編輯器中的 *length*（或 ⟦ ⟧ = 標尺的 In / Out，即入點 / 出點）；拖曳色帶的末端即可調整。**片段標記**：對選取的片段按 Ctrl+Shift+M——經過修剪、滑移、變速和倒放後，標記仍停留在原來的那一個影格上。
- **◎ Track targets**（軌道目標）：未選取任何片段時按 Ctrl+K，會切分所有設為目標的圖層。
- **🔗 Linked sound**（連結聲音）：Properties → 🔗 Sound → ⤓ 將聲音拆為獨立片段；選單列中的 🔗 linked selection 讓這一對片段一起移動；⛓ Unlink（取消連結）/ ↩ Sound back（聲音歸位）。
- 在 V2 及以上圖層和變速片段上也可以進行 **J / L 剪輯**。
- 片段 Sound 部分中的 **🎧 EQ / multiband / reverb**（均衡器 / 多頻段 / 混響）。
- 調色面板中的 **🎨 H/H and H/S curves**（H/H 與 H/S 曲線）。
- **✨ Effect keyframes**（效果關鍵影格）：先按 ◆ key here，然後在片段的其他位置移動滑桿。
- **📤 ProRes 4444 (alpha)**（*overlay* 交付包）、**H.264 10-bit**，以及顯示卡編碼器中新增的 **VAAPI**。

## ✅ 部分完成的剪輯功能現已完成（2.413.0）
<!-- en: partly-done-editing-items-finished-2-413-0 9a1df335297a -->

- 在**倒放**和**變速漸變**片段上，波紋 / 滾動 / 滑移 / 滑動編輯、邊緣手柄和 Ctrl+K 均精確到影格。
- 變速片段上也可以使用 **Edit by transcript**（按文字稿剪輯）和 **scene cuts**（場景切點）。
- 📤 適配方式 **follow** = 智慧重構圖（裁切框跟隨人臉、人物和畫面中的顯著內容）。
- ✨ **Stabilise**（穩定）：*smooth* 和 *locked*；編譯時會測量抖動（vidstab）；畫布顯示穩定後的預覽。
- ⇄ XML 中的速度採用常見剪輯軟體的約定（按速度調整後的入點 / 出點），已用 OpenTimelineIO 驗證。
- 🅰 文字預設：保留斜面和浮雕的輪廓等高線（2.413 之前製作的 PSD 需重新匯入才能獲得）。

## ✅ 巢狀序列、更完整的 XML、FCPXML、整序列文字稿（2.414.0）
<!-- en: nested-sequences-the-fuller-xml-fcpxml-whole-sequence-transcripts-2-414-0 91a7c064a10f -->

- **⧉ Nest**（巢狀，位於時間軸的選單列）：選擇另一個已命名的時間軸——它會被編譯成**一個**片段，放在位置標記處新增的圖層「⧉ name」上。可以像任何片段一樣修剪、移動和調色。當那個時間軸再次儲存時，該片段的徽標會顯示 **↻ out of date**（已過期）：Properties → **↻ Re-render**（重新渲染；片段保持原有位置和修剪）或 **⧉ Open**（切換過去進行編輯）。一個時間軸不能包含它自己，也不能包含已經用到它的時間軸。
- ⇄ **XML 攜帶更多資訊**：位置 / 縮放 / 旋轉（Basic Motion）以及不透明度 / 音量，各自帶有 ◆ 關鍵影格；💬 字幕作為文字標題；**調色**——每個調過色的片段的完整效果都會烘焙成匯出檔案旁邊的一個 .cube（`exports/<name>_luts/`），檔名寫在片段的註釋中；將其作為片段的輸入 LUT 套用即可（Resolve：節點的 LUT；Final Cut：Custom LUT）。bitGen 能精確讀回自己的調色。
- ⇄ **FCPXML 1.10**，用於 Final Cut Pro X，支援匯出和匯入：V1 為主要故事情節，其他圖層為連線的通道，聲音圖層在下方；包括速度、移動、關鍵影格、標記、字幕和起始時間碼。
- 📝 **Transcript scope**（文字稿範圍）：*this clip*、*its whole layer* 或 *the whole sequence*（V1、各影片圖層和 🗣 人聲聲音圖層按播放順序合成一段文字）。剪掉文字時，會從說出這些話的那個片段中刪去；作用於整個序列時，其後的所有圖層也會一起前移，因此音樂和畫面保持同步。↺ 可復原。

## ✅ 軌道混音器、扭曲效果、轉場庫、顏色匹配（2.415.0）
<!-- en: track-mixer-distort-effects-the-transitions-library-colour-match-2-415-0 371d6a26a3ac -->

- **🎚 Mixer**（混音器，位於時間軸的選單列）：每條軌道一個通道條——V1、每個影片圖層、每個聲音圖層——外加 **master**（主控）：推子（−∞ .. +6 dB）、**pan**（聲像，L 100 .. C .. R 100）、**M**ute（靜音）、**S**olo（獨奏），以及畫布播放時的即時 **level meter**（電平表，左 / 右，保持峰值）。雙擊推子恢復 0 dB，雙擊聲像恢復居中。成片也以同樣的方式進行聲像和混音（平衡定律：聲像向右時，左側音量降低）。
- 片段 Effects 中的 ✨ **Distort**（扭曲）：**lens**（鏡頭；向右 = 桶形 / 魚眼，向左 = 枕形）、**mirror**（鏡像；左 → 右、上 → 下、四向）、**warp**（變形；*wave*——橫向波紋，可調大小和速度；*twirl*——中心處的旋渦）。畫布顯示的與成片完全一致。
- **轉場**：現在共 59 種（擦向角落、柔和擦除、覆蓋 / 揭示、擠壓、光圈、穀倉門、切片、風吹、縮放……）。影片或圖片圖層的**入場 / 出場**會按其形狀繪製（擦除、滑動、光圈）——畫布和成片中都是如此——而不再總是疊化。
- 🎨 **🎯 Match**（匹配）：選擇時間軸上的另一個片段——本片段的 R / G / B 曲線會被設定成使其色調與那個片段的畫面相匹配（各片段取位置標記所在的那一個影格，位置標記不在其上時取中間幀）。強度 10 .. 100 %。這些曲線就是普通曲線：可以繼續微調，或重設以復原。

## ✅ 遮罩 + 追蹤、多機位、代理（2.416.0）
<!-- en: masks-tracking-multi-camera-proxies-2-416-0 57f3a43d726f -->

- 調色面板中的 🎨 **◯ Mask (power window)**（遮罩 / 視窗）：*ellipse*（橢圓）或 *box*（矩形）——中心、大小、旋轉、**feather**（羽化，即柔和邊緣）、**invert**（反轉）。片段的調色及其後的效果（模糊、輝光、暗角、扭曲……）隨後只作用於其內部（或只作用於外部）。面板開啟時，其輪廓會顯示在畫布上。也適用於調整圖層。
- **🎯 Track**（追蹤）：把位置標記放在遮罩正好覆蓋目標的位置，按 🎯——遮罩會跟隨目標直到片段結尾（畫布和成片中都是）。如果跟丟了（目標離開畫面），遮罩會停在那裡並給出提示；**✕ track** 刪除追蹤。移動已追蹤遮罩的中心會平移整條追蹤軌跡。
- **🎥 Multi-camera**（多機位）：把同一時刻的所有角度都放到時間軸上，開啟 🎥，勾選它們（第一個為參考），選擇播放哪一個的聲音 → **⇆ Sync by sound**（按聲音同步）。V1 成為節目軌；播放它並按 **1 - 9**（或點選網格中的某個角度）即可在該處切換到那個角度。**⇲ Flatten**（拼合）會把這些切換保留為普通片段。
- **🪶 Proxies**（代理）：會列出高負載素材（寬度超過 1920、HEVC / ProRes / DNx、位元速率超過 40 Mbit/s）；點選 **Make for the heavy ones**（為高負載素材生成），然後勾選 **play proxies on the canvas**（在畫布上播放代理）。成片、交付檔案和交換檔案仍使用原始素材。

## ✅ HDR、AAF、倒放片段的聲音、動態圖形範本（2.417.0）
<!-- en: hdr-aaf-the-sound-of-reversed-clips-motion-graphics-templates-2-417-0 d72759394706 -->

- 📤 **HDR**：10 位預設（H.265 10-bit、AV1、ProRes 422 HQ、ProRes 4444）帶有 **colour**（色彩）選項：*SDR*（與母版相同）、**HDR10**（PQ、BT.2020，帶 HDR10 後設資料）、**HLG**（廣播 HDR）或 **Rec.2020 SDR**（廣色域）。母版的白色落在 203 尼特（HDR 參考白），因此在 HDR 螢幕上看起來與調色時一致。**HDR pack** 一次性新增一個 HDR10 檔案和一個 HLG 檔案。時間軸上的 **HDR 片段**（手機拍攝的 HDR 影片）會經過色調對應再進入成片——不再發灰泛白。
- ⇄ **AAF**（Exchange → *AAF - Avid Media Composer, Pro Tools*）：將剪輯匯出為 .aaf——每個影片圖層為一條畫面軌，聲音為若干單聲道軌，包括空隙和起始時間碼；媒體按原位置連結。Avid / Pro Tools 得到的是剪輯結構，不包括不透明度、音量、移動或調色（Resolve 和其他剪輯軟體請使用 FCP 7 XML）。WebM / MP3 媒體按原樣連結——Avid 可能需要 .mov / .mxf 格式。需要 `pip install pyaaf2`（requirements.txt）。
- 🔊 **倒放 / 變速漸變片段在畫布上也能聽到聲音**：只要位置標記落在它們上面，其聲音就會渲染一次（使用成片自身的變速處理），然後與畫面同步播放。
- 🧩 **Motion graphics templates**（動態圖形範本，位於選單列）：選擇一個範本，填寫其中的文字，點選 **⤓ Insert at the playhead**（插入到播放頭）——其圖層會按你的畫面尺寸落到時間軸上，並帶有各自的移動和關鍵影格。內建範本：*Lower third*、*Title card*、*End card*、*Corner tag*。**💾 Save as a template**（另存為範本）：勾選畫面 / 文字圖層（位置標記下方的圖層已預設勾選），為文字命名並儲存——所有專案都能看到它（清單中帶 ★；🗑 刪除已儲存的範本）。

## ✅ 即時播放：渲染條、⚡ Render、⏱、播放解析度（2.418.0）
<!-- en: real-time-playback-the-render-bar-render-playback-resolution-2-418-0 610c3c55b007 -->

- **渲染條**（標尺下方的一條細線）：沒有線 = 畫布可以即時繪製該段；**黃色** = 可能掉影格；**紅色** = 負載太重，無法即時繪製（圖層多、調色、模糊 / 輝光、遮罩、倒放或變速漸變片段、3D、調整圖層——將滑鼠停留其上可檢視原因），或者播放時**確實**掉過影格；**綠色** = 已渲染。
- **⚡ Render**（渲染，位於選單列）：時間軸會被編譯一次（真正的成片，存入專案快取），每一段都變為綠色；畫布在綠色段上**播放**時會顯示這份渲染結果——即以全速播放的精確成片。一次編輯只會讓它所涉及的那一段重新變紅 / 變黃；再按一次 ⚡ 即可重新整理。**Shift+click ⚡** 可關閉 / 開啟這些預覽。
- ▶ 旁邊的 **⏱**：自按下 ▶ 以來有多少影格繪製延遲（綠色 0 = 流暢）。
- 其旁邊的 **Full / ½ / ¼**：播放解析度——播放時，片段的調色、效果和遮罩在一半 / 四分之一尺寸的畫面上處理（暫停時的畫面保持全尺寸）。

## ✅ 統一的提示詞面板、⊖ 負面提示詞面板（2.419.0）
<!-- en: one-prompt-docker-the-negative-prompt-docker-2-419-0 c669710f70b8 -->

- **所有工具共用一個提示詞面板**：影像編輯器的 ✨ AI、時間軸的 ✨ Fill、路徑圖層的主體、✨ AI scene、3DREAL 外觀、角色建立器、環境和 VR 世界不再各自擁有提示詞輸入框——它們使用 **prompt docker**（提示詞面板，P）中的內容。原來輸入框的位置會顯示一行文字，即該工具將使用的內容；點選它即可在提示詞面板中編輯。提示詞面板為空時，工具保留其自身的預設值。（場景自己的提示詞、場景編輯器、歌詞、語音和字幕保持原位——它們是該場景 / 歌曲自己的文字。）
- **⊖ Negative prompt docker**（負面提示詞面板）——按 **2**（輸入文字時無效；🎥 多機位對話方塊開啟時，1 - 9 用於切換機位）或點選狀態列中的 **Negative**。寫下畫面中**不得**出現的內容。它會隨每一次影像和影片生成以及 AI 編輯一起傳送；為空 = 使用風格內建的負面提示詞。其狀態行會說明所選模型是否使用負面提示詞：SDXL / Pony / Illustrious（以及 cfg > 1 時的 ComfyUI 影像風格）、LTX、Wan 2.1 / 2.2 和 cfg > 1 時的 MiniMax H3 會使用；FLUX / Qwen / Z-Image（蒸餾模型）、音樂和語音不使用。**↺ style** 會把風格內建的負面提示詞放進來供你編輯。
- **LLM 給出的負面提示詞會放到這裡**：回覆中的「Negative: …」行不再進入提示詞——⬇ To prompt、```image / ```video 回覆以及 Generate 本身都會把它移到 ⊖ 面板（取消勾選 *put the LLM's "Negative:" lines here* 可保留你自己的內容）。選取 LTX 或 Wan 影片風格時，LLM 現在會專門針對**該**模型來寫（並附帶一行 Negative）。

## ✅ 🤖 時間軸內的 AI（2.420.0）
<!-- en: ai-inside-the-timeline-2-420-0 06819015cfcd -->

🤖 位於時間軸的選單列中。每次渲染都從 **prompt docker**（提示詞面板）取得文字，從 **⊖ negative docker**（負面提示詞面板）取得負面提示詞，並使用所選的影片風格（MiniMax H3、Wan 或 LTX）。對話方塊會在你按下之前顯示這兩項內容。
- **🔁 New take**（新鏡次）：選取一個影片片段並按下——它會在自己的位置重新渲染（相同的起點、長度、位置和關鍵影格）；「start from its first frame」會保留該鏡頭的開場畫面。舊檔案保留為一個鏡次：按 **⇆** 切換。
- **⇥ Extend**（延長）：從片段的最後一個影格繼續生成 N 秒，緊接在它後面；其後的片段會順延。
- **🎞 B-roll**（空鏡）：把位置標記放在 V1 的空白段 → 生成一個片段填滿它（可選擇從前一個片段繼續）；或者在標尺上選擇一個範圍並選擇 *a cutaway* → 在其上方新增一個「B-roll」圖層，其聲音關閉，讓 V1 的聲音繼續播放。
- **✂ Cut to the beat**（按節拍剪輯）：選擇歌曲（某個聲音圖層的片段或 V1），點選 **♪ Find the beats**（查詢節拍；會顯示其速度），然後選擇 **⚑ Beat markers**（每 N 拍一個節拍標記）或 **✂ Cut the selected clip on the beats**（在節拍處切分選取的片段；切成同一檔案的若干段）。

## ✅ GPU 合成器（2.420.0）
<!-- en: the-gpu-compositor-2-420-0 b9443ca6abb4 -->

畫布**播放**時，各圖層在顯示卡上合成：每個片段的畫面作為一張紋理，在一次繪製中完成（移動、縮放、旋轉及其不透明度）；只帶有 🎨 調色的片段也在同一次繪製中完成調色。暫停的畫面、圖層的擦除轉場和調整圖層仍像以前一樣走 2D 路徑。⏱ 旁邊的 **GPU** 可關閉 / 開啟該功能。

## Wan 2.1 和 Wan 2.2
<!-- en: wan-2-1-and-wan-2-2 c2e6a202f010 -->

在 Basic Settings 的影片風格清單中選擇 **Wan 2.1** 或 **Wan 2.2**，然後照常從提示詞面板進行渲染。

| 模式 | Wan 的作用 |
|---|---|
| **Text** | 文字生成影片 |
| **F/L**，一張圖片 | 該圖片作為首幀（影像生成影片） |
| **F/L**，兩張圖片 | 首幀和尾幀 |
| **Ref** | 第一張圖片作為角色（Wan VACE）。沒有 VACE 模型時，該圖片改為用作首幀，日誌會註明 |

- **模型：** bitGen 使用 ComfyUI 內建的 Wan 節點自行構建 Wan 圖，因此不需要工作流程檔案。它會按檔名為每種模式選用 ComfyUI 中已有的模型檔案（t2v、i2v 480p / 720p、flf2v、vace）。對於 Wan 2.2，它會選用 high-noise + low-noise 這一對模型。如果缺少檔案，任務會告訴你檔名。請從 Comfy-Org 的 *Wan_2.1_ComfyUI_repackaged* / *Wan_2.2_ComfyUI_Repackaged* 下載到 `ComfyUI/models/diffusion_models`，並下載 `umt5_xxl_fp8_e4m3fn_scaled.safetensors`（text_encoders）、`wan_2.1_vae.safetensors`（vae），Wan 2.1 的圖片模式還需要 `clip_vision_h.safetensors`（clip_vision）。
- **強制使用某個檔案：** 在風格的階段中設定一個模型（Settings → Video styles），只要該檔案適用於目前模式就會使用它。
- **步數和 CFG：** 留空則使用 Wan 自己的預設值（2.1：30 步，cfg 6；2.2：20 步，cfg 3.5）。使用 Lightning、lightx2v 或 CausVid LoRA 時，改用 4 步、cfg 1。
- **聲音：** Wan 不生成聲音。參考面板中的第一個聲音會鋪在片段下方。
- **幀率：** Wan 以 16 fps 渲染。片段會透過運動插影格轉為 24 fps，以便與你的其他片段平滑銜接。每個片段最長 10 s；Wan 是用 5 s 的素材訓練的，更長的片段可能出現漂移。

## 🥽 VR World（置身 360° / 180° 畫面中的表演者）
<!-- en: vr-world-a-performer-inside-a-360-180-picture 5157f74b1d2f -->

StoryBoard 的 **🥽 VR World** 按鈕會開啟該對話方塊。

1. **🌐 World**（世界）：選擇一張 360° 或 180° 圖片，或拖入一張圖片或一個 Image 素材。類型會根據檔名（`_360`、`_360_TB`、`_360_LR`、`_180_LR`、`SBS`、`TB`...）或畫面比例判斷。如果對話方塊有提示，請檢查 **Type**。
2. **瞄準：** 在全景圖上點選表演者站立的位置。**View °** 設定攝影機的視野寬度；數值越小，表演者顯得越大、越清晰。**Shape** 和 **Size** 設定渲染參數（Size 0 = 與圖片的清晰度相匹配）。*What the camera sees* 顯示該檢視。
3. **表演者：** 最多新增三張圖片、一個聲音（歌曲或人聲）及其起始位置，以及一段提示詞。
4. **Engine**（引擎）：
   - **MiniMax H3** 自己生成聲音和語音。
   - **H3 + the sound lip-synced** 使用 MMH3_NativeAudio_MV，讓表演者唱出或說出你提供的聲音。
   - 任何 **Wan** 風格都會把你的聲音鋪在片段下方。
5. **✎ First frame**（首幀，可選，推薦）：影像編輯風格（Qwen Image 2.1 edit）會把表演者放進檢視中。渲染隨後從這一個影格開始，因此場所保持不變。不使用它時，渲染從空檢視開始，由提示詞把表演者帶入畫面。
6. **▶ Render VR**。

完成的 `…_vrworld_360` / `_360_TB` / `_360_LR` / `_180_LR` mp4 會帶著 VR 後設資料進入相簿。把它複製到你的頭顯上，用頭顯的播放器開啟（DeoVR、Skybox、Meta Quest TV...）。

須知：

- **只有表演者會動。** 表演者周圍的區域會動起來；世界的其餘部分是你的靜態圖片。
- **Lock the background**（鎖定背景）：在表演者以外的區域，兩隻眼睛看到的都是圖片本身。這樣可以消除閃爍或接縫，但也會失去地面上的陰影。
- **立體深度：** 場所保持其自身的深度（根據圖片的左右眼畫面測得）。表演者沒有另一隻眼睛的畫面，因此會像一張平面卡片一樣，站在其腳下地面所在的深度。從幾米外看起來是正確的。
- **最佳效果：** 固定機位（會自動加入提示詞）、表演者四周留有一定邊距、View ° 設為 50–80，並使用 ✎ 首幀。

## 角色替換
<!-- en: character-swap 718cba8d6d7b -->

把一個新人物放進現有素材中——表演、攝影機運動、背景和**原始聲音**都保留不變；只有角色發生變化。

**從提示詞面板操作**

![Swap mode](images/swap-mode.png)

1. Basic Settings → **SWAP**。
2. References → **Image**：一張新角色的圖片（`<Picture 1>`——H3 對它的稱呼；清晰的全身照效果最好）。
3. References → **Video**：素材（使用第一個影片——[修剪它](#choosing-the-frames-of-a-reference-video)，只保留你需要的部分）。
4. 可選：**Swap from** / **Swap length**（秒），以及在提示詞框中寫入額外的指示（替換指令總會隨同傳送；輸入框可以留空）。
5. **GENERATE**。

**讓新角色穩定保持**（2.334.0）

- 每次替換 **4–5 秒的分段**。替換對話方塊的 ✂ Auto segment 預設切成 5 s 的分段；一次性執行 15 s 往往在幾秒後就滑回原來的表演者。
- 安裝 **H3 Character Swap LoRA**（Setup → Models → Video extras，或者把 `h3_character_swap_pro4500_1000.safetensors` 放到 ComfyUI 的 `models/loras` 資料夾下任意位置，然後重新啟動 ComfyUI）。只要 ComfyUI 中有它，替換就會自動將其加入工作流程，任務日誌也會註明（「swap LoRA: … stacked」）。沒有它，僅靠 H3 很少能保持住新角色。
- **Quality**（品質，位於替換對話方塊的選單列，2.336.0）：**Full**（預設——不使用 turbo LoRA，20 步，ComfyUI 內建的 H3 參考設定）、**Best**（28 步——替換 LoRA 測試時使用的設定）或 **Fast**（turbo LoRA，4 步——最快，但替換效果最弱）。Full 和 Best 的耗時大約是 Fast 的 5–7 倍。任務日誌會寫明所用的品質。
- 圖片以完整細節傳送給 H3（`ref_image_size` 取最大值），提示詞將其命名為 `<Picture 1>`，這是 H3 自己的標籤。

**在已渲染的場景上**

![Swap on a scene](images/scene-swap.png)

選取場景，按鏡次列上的 **⇄**，選擇一張角色設定表（或選擇一個圖片檔案），可選地設定一個時間視窗和一些指示，然後點選 **⇄ Swap**。結果會成為該場景的下一個鏡次——舊鏡次保留在你的素材中。

一次執行最多覆蓋約 15 秒；更長的時間視窗會在此處截斷，日誌會註明（其餘部分可以用更晚的起點再次替換）。

**整部影片——Swap 對話方塊**

StoryBoard 的 **⇄ Swap** 按鈕會開啟角色替換對話方塊，用於長於一次執行（約 15 s）的素材：

- **左側**——點選方框選擇新角色的圖片（或把圖片 / Image 素材拖到上面）；下方是提示詞框，其下有 **✎ Write prompt**（見下文）。
- **中間**——預覽只播放選框範圍內的內容。其下方的選單列：**📂 Load video**（或把 Video 素材拖到預覽上）、**Start**、**Duration**（選框）、**Max**（最長分段）、**✂ Auto segment**（把*整個*影片切成首尾相接、長度為 Max 的分段）、**⇄ Swap**（選框）和 **⇄ Swap all**（所有尚未完成的分段）。再往下是帶選框的膠片條，每個分段對應一條彩色帶；其下的標籤用於選擇分段，**▶** 只替換該分段，**✕** 刪除該分段。
- **右側**——結果預覽，帶有 **💾 Save**（儲存一份副本到 Video 素材）、**↻ Retry**（相同時間視窗，新種子）、**⏫ Upscale**（相同時間視窗和種子，使用 StoryBoard ⚙ 中的放大器）和 **🎬 Compile**。完成的分段存放在 `projects/<name>/vidTemp`；**✓ Keep** 會把一個分段移到 `projects/<name>/vidSwap`；Compile 會按時間順序把勾選的已保留分段合成為 Video 素材中的一個影片（`<video>_swapped.mp4`）。

**Engine: LTX Ripple**（2.339.0）——對話方塊的 **Engine** 下拉式選單可在 **MiniMax H3**（即上面的替換方式）和 **LTX Ripple** 之間切換。Ripple 對每個分段分兩步處理：

1. **✎ First frame**（首幀）。Qwen Image 2.1 會把新角色放進分段起點處的畫面中：相同的姿勢、構圖、光線和背景。每個分段會在分段標籤下方出現一張卡片。第一次按 **⇄ Swap**（或選單列中的 **✎ First frames**）會生成這些卡片。每張卡片上：
   - **✎** 重新生成。
   - **🖌** 在 Image editor 中開啟它。對話方塊會關閉；修飾完成後點選 **💾 Save**，然後重新開啟 **⇄** 並按 **⤓**（使用你最近儲存到 Image 素材中的圖片）。
   - **⤒** 使用任意圖片檔案。
   - **✕** 刪除它。
2. **渲染。** 預設情況下，分段的首幀一生成就開始渲染，因此一次 **⇄ Swap** 就能完成兩步（2.343.0）。如果想先檢查或修飾首幀，請取消勾選 **⚙ → ▶ render as soon as the ✎ first frame is made**，滿意後再按一次 **⇄ Swap**。分段透過 Tim 自己的工作流程 **LTX_Ripple_FFAF_Edit_v11** 渲染（2.342.0；它隨完整 zip 檔的 `comfy_workflows` 資料夾一起提供，並附有其 API 版本）。它會把你編輯過的首幀貫穿整個片段，同時保留原片的動作、節奏和攝影機運動。

鏡次會被精確修剪到分段長度並帶上原始聲音，因此 ✓ Keep 和 🎬 Compile 的用法與 H3 相同。（Tim 的工作流程把編輯後的靜影格放在第 0 影格；應用程式會多渲染一個影格並將其丟棄，使鏡次與聲音對齊。）

**多個首幀**（2.348.0）：選單列中的 **✎×N** 設定每次 ✎ 生成多少個首幀（1-4，每個使用新的種子）。每一個都會以小條帶的形式保留在分段卡片上：**點選**某一個即可使用它，**雙擊**可放大檢視。✕ 刪除目前使用的那一個。設定為 ✎×2 或以上時，⇄ Swap 會先生成這些首幀，等你挑選後再渲染。

**✎ First frames**（2.349.0）總會為選框所在的分段再生成 ✎×N 個首幀——如果選框還不在某個分段上，會先把它變成一個分段。⇄ Swap 只為還沒有首幀的分段生成首幀，否則直接從你選取的那一個影格開始渲染。分段只有在擁有首幀時才有卡片：在最後一個首幀上按 ✕ 會刪除該卡片，其他卡片隨之上移。

如果渲染結果**全黑**，該分段會以此為原因判定失敗，而不會儲存一段黑色影片（用新種子重試；如果仍然是黑的，請重新啟動 ComfyUI）。

**檢視生成的內容**（2.347.0）：雙擊某張 ✎ 首幀圖片，或 Finished / Kept 清單中某個已完成的分段，它會在中間的大預覽中開啟（按一下某個分段會使其成為 Result，這樣 💾 Save 和 ↻ Retry 就作用於它）。點選 **✕ back to the video**（預覽左上角）、按 Esc 或觸碰選框，即可回到你正在替換的影片。

**⚙ Settings**（📂 Load video 旁邊的圖示，2.342.0）：
- **Video size**（影片尺寸）：「from the video」（按影片的長寬比，短邊 768，取 32 的倍數），或你自己設定的寬 × 高（⟲ from video 會自動填入）。
- **Duration**（時長）：分段長度（與 **Max** 相同；✂ Auto segment 按此長度切分影片）。
- **Steps**（步數，用於 LTX Ripple；Tim 的工作流程為 8）以及 **Ripple strength**（Ripple 強度，1.35）。
- **LoRAs**：＋ Add LoRA，與 Basic Settings 中的 LoRA 行相同。它們會在 Ripple LoRA 之後加入 Ripple 渲染。
- **Seed**（種子）：Random，或 Fixed 並填寫數值（🎲 隨機選一個）。固定種子對 ↻ Retry 同樣有效。
- **LTX Ripple: ▶ render as soon as the ✎ first frame is made**（首幀一生成即渲染；預設開啟，2.343.0）。

應用程式會把 Ripple 或 Viggle 工作流程中指定的模型檔案與你的 ComfyUI 列出的檔案進行匹配（子資料夾中的同一檔案，或同類中最接近的檔案），並在任務日誌中註明（2.345.0）。載入一個看起來不像 VR 的影片時，會關閉 VR。

如果某個分段渲染失敗，其所在行會說明原因（工作處理程序的原話，例如缺少某個節點套件或 LoRA），選單列下方的訊息行也會發出通知。

尺寸和種子同樣適用於 MiniMax H3；H3 的步數由其 **Quality** 決定。

Ripple 需要 LTX 2.5 模型、ComfyUI `models/loras` 中的 `LTX25_Ripple_v11.safetensors`、conv 影片 VAE，以及除 KJNodes 和 VideoHelperSuite 之外的節點套件 **ComfyUI-LTXVideo** 和 **RES4LYF**（*Settings → Models → ⤓ Model catalog*；節點套件在 Setup 中安裝）。渲染開始時，缺少的節點會連同其所屬節點套件一起列出名稱。

**Engine: Viggle (H3)**（2.344.0）——Viggle-Animate，一個專為角色替換而做的 MiniMax H3 微調模型。它的用法與 LTX Ripple 完全相同：每個分段都會得到其 ✎ 首幀（由 Qwen Image 2.1 把角色重繪到分段的第一個影格中），Viggle 會把這一個影格貫穿整個片段，同時保留動作、節奏和攝影機運動。工作流程是 Tim 上傳的 `viggle_animate_h3_api.json`（位於完整 zip 檔的 `comfy_workflows` 資料夾中）。

- **尺寸：** 「from the video」即按影片的長寬比、短邊 **480**（Viggle 自己的畫布是 480 × 832）；可在 ⚙ 中自行設定。
- **Viggle steps**（⚙）：**3** 是工作流程所用的快速 DMD 排程（「a 3 step Viggle Animate」）；5 和 7 是它較慢但更精細的預設。
- **Viggle DMD**（⚙）：DMD LoRA 的強度（1）。
- **Speed patches**（加速補丁，⚙，預設關閉）：工作流程的 Sol-Attn 注意力補丁及其 fp16 累加。兩者生效時都更快，但 Sol-Attn 在一次實際測試中導致 ComfyUI 崩潰，fp16 累加也可能使鏡次變黑，因此除非你勾選該框，否則應用程式會將它們關閉。
- **Safe mode**（安全模式，⚙，2.350.0）：關閉所有可能導致黑色鏡次的選項進行渲染。即：不使用加速補丁，不使用 fp16 累加，使用 ComfyUI 內建的注意力機制而不是工作流程的注意力後端，並且在兩者都有時使用 fp16 H3 VAE 而不是 int8 版本。速度會更慢。
- **黑色鏡次：** 當 Viggle 鏡次全黑時，應用程式會用相同的種子在安全模式下再渲染一次。如果成功，該鏡次記為完成，該行會顯示 🛟，並且 ⚙ 安全模式在接下來的渲染中保持開啟（取消勾選即可再次嘗試快速設定）。如果在安全模式下仍然是黑的，該行會註明：那就是模型檔案或 ComfyUI 本身的問題。請重新啟動 ComfyUI，更新它及其自訂節點，並檢查模型是否已下載完整。
- ⚙ LoRAs 會加在 DMD LoRA 之後。不使用 Direction 框（Viggle 使用固定的文字條件）。
- 鏡次包含分段的每個影格，並帶有原始聲音。
- **幀數**（2.351.0）：MiniMax H3 只渲染 17 × n + 5 影格，至少 124 影格（約 5.2 s），最多 362 影格（15.08 s）。較短或幀數不符合要求的分段會按下一個有效幀數渲染，之後再修剪回去。在 2.351.0 之前，傳送的是分段自身的幀數（例如 120 或 48），而 H3 影片 VAE 無法編碼這樣的幀數。這很可能就是出現黑色鏡次的原因。

**Engine: Viggle (native)**（2.351.0；自 2.352.0 起擁有自己的常駐引擎）是由 bitGen 自己的引擎執行的同一個 Viggle-Animate 模型，不需要 ComfyUI 圖。它是可選的：其他所有任務仍以 ComfyUI 為引擎，上面普通的 **Viggle (H3)** 引擎沒有它也能工作。它使用 Viggle 凍結的提示詞嵌入，因此不需要文字編碼器，並以 4 步（3 遍）、flow shift 3 進行渲染，這是 Viggle 自己的設定。

- **安裝：** ⚙ → *Viggle native* → **⤓ Install**。它會構建自己的 Python 環境（`venvs/native`），並且只下載仍然缺少的內容。
- **🔍 Use my ComfyUI files**（使用我的 ComfyUI 檔案）：引擎只讀取每個檔案的檔案頭，並儘可能使用你 ComfyUI 中的 Viggle 模型、其 DMD LoRA 和 H3 VAE（bf16、int8、int8-ConvRot 或 fp8；無法讀取 nvfp4）。⚙ 區塊會列出每個部分的來源：按檔名列出你的檔案、「ComfyUI file found - 🔍 to use it」，或顯示缺失。只會下載仍然缺少的內容。
- **記憶體**（2.352.0）：2.351 版引擎以全精度載入 66 GB 的模型，*同時*還保留一份鎖頁副本，所需記憶體超過了 128 GB 機器的容量，因此渲染一直停在「no steps started」。現在模型以 int8 打包形式儲存在記憶體中（約為原來的一半大小）。每個塊在執行前才在 GPU 上解包，同時下一個塊已經在複製中（Wan2GP 的技術，從零重寫）。一個小型本機伺服器會在分段之間保持模型載入，因此只有每次會話的第一次渲染需要承擔載入開銷；當 ComfyUI 任務開始時，它會歸還記憶體和 GPU。日誌會分步顯示載入過程（「packing the weights N%」）。
- **啟動時安裝**（2.353.0）：每次啟動都會檢查 Viggle (native) 是否已安裝，並把結果記錄在安裝資料夾的 `components.txt` 中。值為 0 時會立即開始安裝（可在佇列中檢視進度）。安裝程式會讀取你的 ComfyUI 工作流程中指定的模型檔案（先是 `viggle_animate_h3_api.json`，然後是 H3_Viggle 及其他工作流程）：Viggle 模型、其 DMD LoRA，以及 H3 影片和音訊 VAE。如果這些檔案在 ComfyUI 的模型資料夾中，就直接使用，不再下載。Python 環境構建完成後會逐一檢查這些檔案；只會下載引擎無法讀取的檔案（這會多一次安裝步驟，且 DMD LoRA 現在是單獨的 2.5 GB 下載）。其餘部分很小：設定檔和 Viggle 的提示詞嵌入。
- **`components.txt`**（2.355.0）：`viggle native=0` 表示在下次啟動時安裝，`1` 表示已安裝（不做任何操作），`2` 表示不安裝。設定精靈在你勾選 **Viggle (native)** 時寫入 0，不勾選時寫入 2；該選框會顯示下載大小。值為 2 時仍可透過 ⚙ → Viggle native → ⤓ Install 安裝，安裝完成後變為 1。
- **Native steps / shift**（⚙）：4 和 3。對這個蒸餾模型來說，步數越多並不意味著越好。
- ✎ 首幀仍由 ComfyUI 中的 Qwen Image 生成。原生渲染本身不需要執行 ComfyUI。
- ⚙ LoRAs 以及 ComfyUI 的加速 / 安全模式開關不適用於原生引擎。
- 一個鏡次為 5 到 14.4 s（124 到 345 影格）：較短的分段會按 124 影格渲染，再修剪回去。

Viggle 需要節點套件 **ComfyUI-Viggle-Animate-H3**（在 Setup 中）、Viggle 模型（`minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors`，21 GB，位於 `models/diffusion_models`）、DMD LoRA（`viggle_animate_dmd_lora_r64.safetensors`，`models/loras`）、文字條件（`fixed_embed_fwd_anyframe.safetensors`，`models/text_cond`）以及 MiniMax H3 影片 VAE（int8 或 fp16 版本均可）。它們都可以在 *Settings → Models → ⤓ Model catalog* 的 **Video - Viggle-Animate** 下找到。工作流程的加速補丁（Sol-Attn、Chunk FeedForward）在你的 ComfyUI 中有時會使用，沒有時則跳過。

一些限制：

- **Quality** 和 **⏫ Upscale** 僅適用於 H3（不適用於 Ripple 或 Viggle 鏡次）。如需更大的 Ripple 鏡次，請在 ⚙ 中調大尺寸，然後點選 **↻ Retry**。
- Ripple 和 Viggle 不支援 VR。
- Direction 框中的普通文字會隨同傳送（例如「rain on her coat」）；帶有 `<Video 1>` 標籤的 H3 提示詞會被忽略。

**✎ Write prompt**（2.335.0）——視覺模型會檢視新角色的圖片以及選框中間位置的影片畫面，然後 LLM（在提示詞面板的提示詞下方所選的那個）會把一段替換提示詞寫入輸入框：替換誰（「the man in the purple shirt」）、角色的臉、髮型、服裝和畫風、保留動作、保留其他一切。輸入框中已有的內容會作為你的要求一起附帶（「keep his red cap」、「photoreal」），所以可以先輸入要求再按下按鈕。大約需要一分鐘（兩個模型依次載入）。結果可以隨意編輯。同時包含 `<Video 1>` 和 `<Picture 1>` 的提示詞會作為**完整**提示詞傳送；普通文字則會新增在內建替換指令之下。沒有視覺模型時，LLM 仍會寫出提示詞（對話方塊會說明圖片未被描述）。LLM 遵循的規則是 `lib/promptGuides.json` 中的 `minimax_h3_swap` 指南——把它複製到 `styles/prompt-guides.json` 中即可修改。

分段按 H3 的影格網格切分，因此銜接時沒有間隙；最後不足一個網格步長的零點幾秒不會被替換（對話方塊會說明有多長）。每個分段都是佇列中的一個獨立任務，因此在它們渲染期間你可以關閉對話方塊。

**VR 影片（360° 和 180° 立體）**

在影片選單列下方的那一行設定 **VR**：*360° mono*、*360° stereo (top-bottom)* 或 *180° stereo (side by side)*。檔名中註明了類型的檔案（`_360_TB`、`_180_LR`、`_360` …）會自動開啟它。

- 替換從不渲染整個球面。它渲染的是一個對準人物的**虛擬攝影機**：在預覽中點選人物（或輸入 **Yaw** / **Pitch**），設定 **View**（視野寬度，單位為度）和 **Shape**（站立的人物用 3:4 或 9:16）。**👁 View** 會精確顯示替換將看到的畫面——構圖時給人物四周留一點空間。視野越窄越清晰。
- 對於立體影片，只替換左眼；右眼根據你原始素材的深度由左眼生成，因此兩隻眼睛看到的是同一個角色，並且處於正確的距離。
- 替換後的檢視會以柔和的邊緣放回未經改動的全解析度畫面中。結果保持 VR 佈局和尺寸，超過 4K 時使用 H.265，檔名帶有播放器識別的字尾，並攜帶 VR（球面）後設資料。輸出為 24 fps——即模型的幀率。
- 立體功能需要應用程式的 Python 中裝有 `numpy` 和 `opencv-python-headless`（`start.bat` 會安裝它們）。

**載入長影片：** 沒有長度限制。📂 Load video 會開啟應用程式的檔案對話方塊，並*按路徑*引入檔案（硬連結或副本——不會透過頁面上傳任何內容）。如果播放器無法顯示某部影片（H.265 / 8K），對話方塊會生成一個小的預覽副本；替換始終使用原始檔案。

**替換風格——`mmh3_chr_swap`**

替換透過影片風格 **mmh3_chr_swap** 進行渲染（Settings → Video styles；*Used for: Character swap*，替換工作流程位於其 ref2va 槽位）。在提示詞欄的風格下拉式選單中選擇它會切換到 Swap 模式。可以像編輯任何影片風格一樣編輯它——更換 H3 模型、載入精度、文字編碼器、VAE、LoRA 或 Sage attention——也可以點選 **Duplicate** 保留多個變體（副本仍然是替換風格）。如果下拉式選單中選取的是替換風格，Swap 模式就使用它，否則使用 mmh3_chr_swap。替換風格不能用於普通渲染（應用程式會給出提示）。

## H3_Viggle 風格
<!-- en: the-h3-viggle-style af1e7b3397b9 -->

**H3_Viggle**（2.352.0）透過 ComfyUI，以 Viggle-Animate 的方式渲染場景。場景的**動作影片**驅動動作，一張圖片決定由誰來表演：

- **ref2va：** 由角色設定表或圖片來表演（`comfy_workflows/H3_Viggle_ref2va.json`）；
- **fl2va：** 由場景的首幀來表演（`comfy_workflows/H3_Viggle_fl2va.json`）。

兩者都是 Tim 的 Viggle-Animate 圖，只是去掉了並排對比部分。它們需要的 ComfyUI 檔案與替換對話方塊的 Viggle (H3) 引擎相同（見上文 *角色替換*）。

**從提示詞面板操作：** 選擇影片風格 **H3_Viggle**，並把動作片段放進參考面板的 **Video** 分頁（其中第一個影片即為動作來源）。然後：

- **Ref**（ref2va）：由第一張參考圖來表演。Viggle 只接受一張圖片；其他圖片會被捨棄，日誌會註明。
- **F/L**（fl2va）：由首幀來表演。
- **t2va** 會被拒絕，因為沒有可以驅動的物件。

**在場景板上：** 把 StoryBoard 的 *Workflow* 設定為 **H3_Viggle**。此後每個場景都會顯示一個 **🎬 Motion** 槽位。Choose… 可從專案、其他場景的鏡次或檔案中選擇影片；✕ 將其移除。場景的類型決定使用哪種變體：

- **Ref：** 由第一張角色設定表（或場景的第一張圖片）來表演，使用 ref2va。
- **First / Cont / Trans：** 由場景開始的那一個影格來表演，使用 fl2va。即該場景的 First 圖片，若沒有則為它所接續的那一個影格。

沒有動作影片的場景會被拒絕，並以文字說明原因。

長度和渲染的工作方式：

- **長度：** 場景板歌曲中分配給該場景的時間視窗；若沒有，則為場景自身的長度；再沒有，則為動作片段的長度。如果片段更短，會定格其最後一個影格。
- **幀數：** H3 渲染 17 × n + 5 影格，Viggle 至少 124 影格。較短的場景按 124 影格渲染後再修剪。超過 15 s 會分塊：從第 2 塊起，每塊都從交接影格繼續（fl2va），並從上一塊停止的位置開始擷取動作。
- **動作片段**會按每個分塊以渲染尺寸切分（縮放填滿、居中裁切、32 的倍數），幀率為 24 fps，其自身的聲音保留在鏡次上。
- 使用 Viggle 的 3 步 DMD 排程，而不是 ⚙ 中的步數。風格的 LoRA 串接在 DMD LoRA 之後。fp16 累加處於關閉狀態，因為它可能使 Viggle 鏡次變黑。全黑的鏡次會被拒絕，並以文字說明原因。
- H3 加速器、RefMods 和 ⏫ 放大階段不適用。

## SFX 面板
<!-- en: the-sfx-dock 32bca537ef49 -->

用於管理專案音效的面板。音效以 48 kHz 立體聲 WAV 檔案儲存在 projects/<project>/sfx 中，因此每次剪下都精確到取樣點，反覆剪下也不會損失音質。

- **📂 Add**（新增）可匯入音訊檔案（wav、mp3、flac、ogg、m4a、aac、opus、wma、aiff）和影片檔案（.mov、
  .mp4、.m4v、.mkv、.webm、.avi、.wmv、.flv、.mpg、.3gp、.mts/.m2ts、.ts、.mxf）。匯入影片時會提取其音軌。沒有音軌的影片會被拒絕，並顯示相應提示。
- **波形：** 在波形上拖曳可選取一段，點選可移動播放位置。🔍+ 放大顯示選取範圍，⤢ 重新顯示整個聲音。Start 和 End 可輸入精確的秒數。▶ 播放選取範圍；沒有選取範圍時播放整個聲音。
- **Duration**（時長）為選取範圍設定固定長度。在波形上按下，會以指標為中心放下一個該秒數長度的框，然後拖曳即可滑動它。更改 Duration 時，框會從其起點開始調整大小；輸入 Start 或 End 則會移動整個框。將 Duration 留空即可拖選任意長度。任何選取範圍都可以抓住後滑動。
- **相簿：** 每次儲存的剪下（Keep 或 Delete）也會以 sfx_<name> 的名稱複製到相簿的 **Audio** 分頁，並自動開啟該分頁顯示它。再次剪下同一聲音或使用 ↶ Undo，會更新這份副本。
- **✂ Keep selected**（保留所選）只保留選取的部分。**🗑 Delete selected**（刪除所選）剪掉選取部分，並把兩側拼接起來。每個剪下邊緣都會加上 5 ms 的淡變，避免產生爆音。
- **剪下的去向：** 剪下會直接修改檔案本身，**↶ Undo**（復原）可恢復到上次剪下之前的版本。勾選 **as a new file**（另存為新檔案）則會寫入 name_keep.wav 或 name_cut.wav，原檔案保持不變。
- **→ 🔊** 將音效複製到 Sound 素材中，供時間軸和參考面板使用。**🗑** 刪除該檔案。

### 🗣 Speech & dialog（語音與對話）(2.621.0)

在音效下方，SFX 面板還能帶情感地朗讀文字——可以是單一聲音，也可以是為每位說話人分配一個聲音的對話——使用 OmniVoice 或 Ming-3.0 TTS，並儲存到 **Audio assets**（音訊素材，projects/<project>/sound）中。

1. **File name**（檔名，文字上方的框）——檔案以該名稱儲存為 .wav 或 .mp3；已存在的名稱永遠不會被覆蓋（會加上 _2）。
2. **文字**——直接輸入，用 **📋 Paste**（貼上）貼上（或按 Ctrl+V），或者寫一段簡要說明後按 **✨ Write**，讓 LLM 寫出臺詞（在框中按 Ctrl+Z 可恢復舊文字）。**＋ tag** 會在游標處插入 `[laughter]` 或 `[sigh]` 之類的聲音標籤。
3. **Description**（描述，文字下方的框）——說明它的用途。
4. 對話每行一句：`Anna (happy): We made it!`、`Ben: Already?`、`(sad) It is over.`。沒有名字的行沿用上一行的說話人；空行表示較長的停頓。**Cast**（演員表）列出找到的說話人——為每人指定一個聲音（來自 Settings ▸ Audio ▸ Voices），並為未標註情感的臺詞指定一種情感。**One voice reads it all**（一個聲音讀全部）會用所選的 **Voice** 朗讀全部文字。
5. 選擇 **Engine**（引擎）、**Emotion**（情感）、**WAV / MP3** 以及行與行之間的 **Pause**（停頓），然後點選 **🗣 Read & save to Audio**。下方的播放器會播放結果。

情感：neutral（中性）、happy（高興）、sad（悲傷）、angry（憤怒）、fearful（恐懼）、disgusted（厭惡）、surprised（驚訝）。**Ming-3.0 TTS** 用其 EMOTION 任務朗讀每一行（複製的聲音也可以）。**OmniVoice** 沒有情感開關：情感會略微改變語速；儲存為 `Anna.happy`（Anna 用高興的語氣錄製）的聲音會用於 Anna 的高興臺詞；聲音標籤會被讀成相應的聲音。

檔案內建 **metadata**（後設資料）：標題、生成的日期和時間、描述、完整文字以及所用的聲音（WAV：INFO 清單；MP3：ID3——文字作為其歌詞）。

## Save 與 Save as（預覽對話方塊和相簿）
<!-- en: save-and-save-as-preview-dialog-and-gallery 6ede84779993 -->

- **Save as**（另存為）是每個相簿縮圖左上角的小 💾 圖示（歌曲的則位於名稱行中）；滑鼠停留在縮圖上時它會變亮。它會以 Save As 模式開啟檔案對話方塊：選擇資料夾，可按需修改名稱，然後按 Save。如果該名稱的檔案已存在，對話方塊會詢問一次，再次按 Save 即會替換。該資料夾會成為你的 **last save-as location**（上次另存位置）。
- 預覽對話方塊中的 **💾 Save**（儲存，位於 ↗ Open externally 旁邊）會以檔案自身的名稱將副本直接儲存到上次另存位置，不彈出對話方塊。如果同名檔案已存在，副本會命名為「name (2)」，依此類推：Save 永遠不會覆蓋檔案。第一次使用或該資料夾已不存在時，會以 Save as 的方式詢問。按住 Shift 點選 Save 仍可選擇資料夾。按鈕的提示資訊會顯示將要使用的資料夾。
- 該位置對整個安裝生效並被記住（workspace/save_as.json），在各專案之間通用。
- 從手機或另一臺電腦（遠端頁面）操作時，這兩個按鈕都會透過瀏覽器下載，因為儲存操作是寫入執行 bitGen Studio 的那臺電腦。

## 歌曲分段之間的過渡（橋接場景）
<!-- en: transitions-between-song-segments-bridge-scenes def16a1fcd25 -->

在 StoryBoard 的歌曲條上，勾選 **Transition**（過渡，位於 💾 之前），設定其長度（0.1 - 4 秒）和類型，然後按 💾。除最後一個分段外，每個分段都會把結尾的這幾秒讓給一個 **bridge**（橋接）場景，因此每個分段仍從你放置的剪下點開始。以三個分段為例，分鏡腳本會變為：場景 1、橋接、場景 2、橋接、場景 3。歌曲的 .seg 檔案會原樣保留你的剪下點。

橋接從前一個場景的**最後一個影格**過渡到後一個場景的**第一個影格**，因此要先渲染兩側相鄰的場景（Render selected 會把橋接排在其前後場景之後）。每張橋接卡片上都有一個類型選擇器，取代 Ref / First / Cont / Trans：

- **AI (fl2va)**——原生音訊分鏡腳本（MMH3_NativeAudio_MV）用模型渲染這段運動，從最後一個影格開始、到第一個影格結束。H3 渲染 17n+5 影格，因此 0.5 s 的橋接會渲染 22 影格，然後精確適配為 0.5 s，並配上下方的歌曲。
- **標準過渡**——交叉溶解、溶解、黑場/白場過渡、擦除、滑動、圓形、時鐘、像素化、模糊（即時間軸的過渡清單）。由 ffmpeg 在兩影格之間繪製：不需要模型，在任何工作流程上都只需幾秒即可渲染完成。

音樂影片編寫器只編寫分段；橋接保持原位。以相同類型再次儲存會保留每張卡片各自的選擇；在歌曲條上選擇新類型會套用到所有橋接；取消勾選 Transition 並儲存則會移除橋接。

## 場景板上的渲染尺寸
<!-- en: render-size-on-the-scene-board cc791480d451 -->

分鏡腳本渲染（卡片上的 ▶、↻ 重做、Render selected——包括原生音訊音樂影片）按以下順序確定渲染尺寸：

1. StoryBoard 的 ⚙ **Resolution**（解析度），當它設為 480p/540p/720p/1080p 時；
2. 否則使用左側 **Basic Settings** 的寬 x 高（其 Resolution/Aspect 選擇器，或自訂欄位）——每次按下時都會發送，並為該專案儲存，因此排隊的和自動啟動的場景也會使用它；
3. 否則使用應用程式的預設尺寸（Settings）。

任務備註會說明使用了哪一種（"render size 1280x720 (Basic Settings, the left dock)"）。尺寸越大畫面越清晰，但速度越慢，需要的顯示記憶體也越多；720p 加上 ⚙ 放大器（對滿意的鏡次點 ⏫）是不錯的平衡。

## 時間軸的預覽畫布
<!-- en: the-timeline-s-preview-canvas 16831c3c0ea9 -->

時間軸面板頂部現在有一塊預覽畫布，左側是工具列，右側是 **Layers**（圖層）面板。時間軸選單列中的 **⧉** 可顯示或隱藏它們，畫布下方的拖曳條可調高或調矮畫布。如果畫布顯得侷促，可把時間軸面板拖高。

- **拖放：** 可以從 Assets、相簿或你的電腦把影片、圖片或聲音拖放到畫布上。每一項都會放在位置標記處的一個**新圖層**上，位於你放下的位置。拖放到空時間軸上的影片會放在 V1 上。
- **工具列：**
  - **✥ Move (V)**（移動）——點選圖層將其選取，然後拖曳來移動它。拖曳角點可縮放，拖曳頂部的圓形手柄可旋轉。按住 Shift 可按 15° 步進旋轉，或沿單一軸移動。V1 是底層畫面：它始終鋪滿畫面，不能移動。
  - **T Text (T)**（文字）——點選即可新增文字圖層，然後在 Layers 面板中輸入文字。字型、字號、顏色、粗體、斜體、描邊、陰影和對齊方式都在那裡設定。用 T 點選文字圖層或雙擊它即可編輯。
  - **✋ Hand (H, or hold Space)**（抓手）用於平移檢視。**🔍 Zoom (Z)**（縮放）用於放大；Alt 點選（或 Ctrl + 滾輪）縮小。**⤢** 使畫面適合檢視。
- **播放：** 使用畫布下方的 ▶ / ⏸，或在滑鼠位於畫布上時按 Space。所有圖層會帶聲音一起播放，時間軸的位置標記也會隨之移動。🔁 循環播放標尺選取範圍，或整條時間軸。
- **Layers 面板：** 👁 顯示或隱藏圖層，▲ ▼ 調整其順序，🗑 刪除圖層，雙擊可重新命名。下方顯示所選片段的 X、Y、Scale、Rotation、Opacity 和長度。
- **Compile**（合成）會完全按照畫布上顯示的位置，繪製經過移動、縮放和旋轉的圖層以及文字。

### 在選取範圍內生成（✨ Fill）

1. 選擇 **⬚ Select** (M) 並在區域上拖出一個框，或選擇 **🖌 Mask** (B) 塗抹該區域（Alt 擦除）。
2. 在 Layers 面板的 **✨ Fill** 中寫下那裡應出現的內容，選擇 **Image** 或 **Video**（以及秒數），然後點選
   **✨ Generate**。
3. 結果會放在一個新圖層上，正好覆蓋該區域，並帶有柔和的邊緣（羽化），以便與場景融為一體。圖片的持續時間為標尺選取範圍的長度，或 3 s；影片從位置標記處開始。

### 用關鍵影格為圖層製作動畫

關鍵影格可以讓圖層隨時間移動、變大、旋轉、淡入淡出或改變顏色。在兩個關鍵影格之間，畫布會為你計算出每個影格（補間），Compile 也會繪製相同的動畫。

1. 選取圖層，把位置標記移到動畫開始的位置。
2. 點選 Layers 面板中 X / Y / Scale / Rot 下方的 **◇ Key**。這會儲存該圖層在此刻的位置、大小、旋轉、不透明度（文字圖層還包括顏色）。時間軸中的該片段上會出現一個 **◆**。
3. 把位置標記往後移，然後修改圖層：拖曳、縮放、旋轉它，或輸入新的 X、Y、Scale、Rot、Opacity 或顏色值。系統會自動在那裡建立第二個關鍵影格。
4. 按 ▶。圖層會從第一個關鍵影格動畫過渡到第二個關鍵影格。

關鍵影格的數量不限。某個屬性一旦有了關鍵影格，修改它時總是會編輯位置標記處的關鍵影格，或在那裡新增一個。沒有關鍵影格的屬性保持不變。

- ◇ Key 旁邊的 **◀ ▶** 跳到上一個或下一個關鍵影格。位於關鍵影格上時，它們旁邊的選單用於設定如何過渡到下一個關鍵影格：**linear**（線性）、**ease in**（緩入，開始時慢）、**ease out**（緩出，結束時慢）、**ease in+out**（緩入緩出），或 **hold**（保持不動，到下一個關鍵影格時直接跳變）。**✕◆** 刪除該關鍵影格。
- 點選時間軸中片段上的 **◆** 可直接編輯該關鍵影格：不透明度、音量、X、Y、縮放、旋轉、顏色和緩動。帶緩動的菱形為藍色；保持型的為白色。
- 聲音片段也可以有音量關鍵影格，現在 Compile 也會套用這些關鍵影格。

## H3 的渲染尺寸
<!-- en: render-size-with-h3 0ec15bb50627 -->

H3 以 32 像素為步長渲染。在 StoryBoard 的 ⚙ 中，**H3 size** 決定介於兩個步長之間的尺寸如何處理：
**704** 向下取整（1280×720 渲染為 1280×704），**736** 渲染 1280×736，再把鏡次裁回正好
1280×720（約慢 4%）。2.379.2 之前渲染的鏡次底部有一條暗帶；請重新渲染它們。

## 場景與歌曲
<!-- en: scenes-and-the-song 018ad1bb5722 -->

場景會對照歌曲中屬於自己的那一段來渲染：從 15.5 s 開始的場景使用歌曲 15.5 s 起的部分。分鏡腳本上有歌曲時，每個渲染好的鏡次都會放在時間軸上相同的時間點，使畫面與歌曲保持同步。如果想讓每個鏡次緊接在上一個之後放置，請在 ⚙ Timeline settings 中取消勾選 "Place each rendered scene at its song time"。

## 微移時間軸片段
<!-- en: nudging-timeline-clips 708970a7a978 -->

- 時間軸選單列右端的 **⚙** 會開啟 **Timeline settings**（時間軸設定）。在 **Nudge**（微移）下，設定 ← / → 每次移動片段的幀數（預設 1），以及 Shift + ← / → 每次移動的幀數（預設 24 = 1 秒）。對話方塊也會以秒為單位顯示每個值。
- 點選片段將其選取，然後按 ← 或 → 在其圖層上把它往前或往後微移。片段永遠不會移到 0 之前。V1 會依次播放其片段，因此 V1 上的片段會停在緊鄰它的前一個片段處。要讓片段重疊，請使用影片圖層。
- 在欄位中輸入內容或有對話方塊開啟時，方向鍵不會觸發微移。

## Override style 與 StoryBoard
<!-- en: override-style-and-the-storyboard 4e7a03445a62 -->

在 Basic Settings 中勾選 **Override style**（覆蓋風格）後，StoryBoard 的渲染會使用 Basic Settings 的 **Steps** 和
**CFG**。它們優先於 StoryBoard 的 ⚙ 以及工作流程自身的步數。取消勾選時，由 ⚙ 決定（留空 = 使用工作流程自身的設定）。渲染的備註會說明使用了哪一個。Steps 為 0（"auto"）時，步數交由 ⚙ 或工作流程決定。

## 垃圾桶與重設專案
<!-- en: recycle-bin-and-resetting-a-project 48bdd209109a -->

- **🗑 Recycle bin**（垃圾桶，位於左側面板選單列）：開啟專案的垃圾桶。從相簿或素材中刪除的檔案會進入這裡。每個檔案都會顯示其來源位置和刪除時間。
  - **↩ Restore**（恢復）把所選檔案放回原來的資料夾（雙擊檔案效果相同）。
  - **✕ Delete**（刪除）永久刪除所選檔案。會先詢問確認。
  - **🧹 Empty**（清空）永久刪除垃圾桶中的所有內容。會先詢問確認。
- **↺ Reset project**（重設專案，位於左側面板選單列）：刪除整個專案資料夾（包括其垃圾桶），然後以相同的名稱和描述重新建立一個空專案。操作前會先要求你確認。之後每個面板都從空白開始，就像新專案一樣：佇列中該專案已完成的任務及其快取檔案也會被清除，該專案仍在排隊或正在執行的渲染都會被停止（確認框會顯示數量）。
- 如果專案中的某個檔案仍在其他程式中開啟（媒體播放器、檔案總管的預覽窗格、ComfyUI），Windows 不允許刪除它。重設仍會把專案變為新專案，然後告訴你哪些檔案正在使用中。這些檔案會在下次啟動 bitGen Studio 時刪除。
- 重設後可以立即新增角色（帶圖片）；上傳的內容總是進入目前開啟的專案。

## 卡拉 OK：帶跳動小球的歌詞
<!-- en: karaoke-lyrics-with-a-bouncing-ball 5ba9b3c8ea95 -->

- **歌詞檔案：** bitGen 生成的每首歌曲都會把歌詞儲存為專案資料夾中的 `lyrics/<song name>.txt`。對於你自己匯入的歌曲，請把歌詞放進該資料夾中同名的 txt 檔案。
- **🎤 Karaoke**（卡拉 OK，位於 StoryBoard 選單列）：場景渲染完成後，bitGen 會為它再生成一個影片。該影片背景透明，顯示該場景對應部分的歌詞：目前行在演唱時由白變黃，下一行在下方等候，一個小球會跳到每個字詞上。場景本身的影片不含歌詞。
- 歌詞影片放在時間軸的 **Karaoke** 圖層上，與其場景對齊。該圖層始終位於最上層，Compile 會透過透明部分顯示場景。
- **計時：** 如果安裝了語音轉文字（faster-whisper，Settings → Audio），它會根據演唱為歌詞計時。沒有安裝時，歌詞會平均分佈在整首歌曲上，作為粗略參考。
- 開啟 🎤 也會為已經渲染好的場景生成歌詞影片。
- **場景底部出現橫條或字幕？** 歌曲完成計時後，每個場景的提示詞都會包含該部分演唱的歌詞（用於唇形同步）。提示詞會告訴影片模型不要把這些歌詞顯示為文字。如果場景仍有橫條，請隱藏 Karaoke 圖層（👁），然後在相簿中單獨檢視該場景：如果橫條依然存在，說明是模型把它畫進了影片，請重新渲染該場景。
- **時間軸選單列中的 🎤** 可為任意歌曲製作卡拉 OK 疊加層：在時間軸上選擇一個聲音片段（或一個聲音素材），選擇整首歌曲或標尺選取範圍，檢查歌詞，然後點選 **Generate**。疊加層放在 Karaoke 圖層上，與歌曲對齊。
- **🎤 Karaoke style**（卡拉 OK 樣式，位於 StoryBoard 的 ⚙ 和時間軸的 ⚙ 中）：字型、字號、顏色、不透明度、描邊、文字陰影、背景條（顏色、不透明度、邊框、框陰影、高度、距頂部的位置）以及小球的大小和顏色。新的疊加層會使用這些設定。

## 儲存與開啟專案
<!-- en: saving-and-opening-a-project ed4ab6ddb5f3 -->

- **💾 Save**（儲存）會儲存專案中的一切：StoryBoard 的歌曲和場景、提示詞、提示詞聊天、角色、環境、參考圖、素材、相簿、時間軸以及每個面板的欄位（例如音樂標題和增強後的提示詞）。保持名稱不變即可原地儲存。
- **參考面板會隨你的修改即時儲存**（2.548.0）：新增、移除或描述過的圖片、影片或聲音會在幾秒內寫入專案，因此即使沒有執行 💾 Save，關閉應用程式也會保留它們。所有內容都會保留——以前儲存時只保留 9 張圖片，第 10 張會導致整個儲存被拒絕。同名圖片（貼上的圖片都叫「image.png」）會獲得各自的名稱（image_2.png …）。
- **F/L、Swap 和 Text 不再丟棄圖片**（2.548.0）：面板會保留全部圖片；F/L 傳送前兩張（其餘顯示為淡化），Swap 傳送第一張，Text 不傳送。切回 Ref 時它們都還在。
- **StoryBoard 的共享提示詞會在輸入時隨時儲存**（2.548.0）——在你停止輸入片刻後、離開輸入框時以及應用程式關閉時都會儲存；旁邊的 💾 仍會立即儲存。其中的 @tag 標籤、章節參考圖以及每個場景各自的圖片，都會透過 Save、Save as 和關閉操作隨專案一起保留。
- **Save as**（另存為）：在同一個框中輸入新名稱。整個專案會以該名稱複製一份，應用程式隨即開啟該副本。原專案保持不變。已存在的專案名稱會被拒絕，因此不會覆蓋任何內容。
- **Open**（開啟）：會先儲存你正要離開的專案。然後應用程式重新開啟你選擇的專案，每個面板都與儲存時完全一致。

## 新增專案
<!-- en: starting-a-new-project 092f51bd16f6 -->

**New project**（新增專案）讓你從零開始。你正要離開的專案會先按原樣儲存。然後應用程式會在新專案上重新載入，因此每個面板都從空白開始：參考圖、角色和演員、環境、場景、提示詞聊天、素材、相簿、時間軸和音樂面板。佇列只顯示本專案已完成的任務。其他專案仍在渲染的內容會繼續列出，直到完成為止。**Open** 某個專案即可返回該專案；一切都在你離開時的位置。

## 儲存和清除提示詞聊天
<!-- en: saving-and-clearing-the-prompt-chat e72c6c657159 -->

- **💾 Save** 會把對話儲存為 **`<subject> - <date>`**，例如 `A woman walking in rain - 2026-10-05`。如果已有 LLM 在執行，由它來命名主題；否則名稱取自你提問的前幾個詞。已被佔用的名稱會加上 ` (2)`。聊天會在一份新副本中繼續。
- 旁邊的**清單**顯示所有已儲存的聊天，最新的在最前。**📂 Load**（載入）開啟其中一個。
- **🧹**（緊挨在清單右側）清除目前對話：包括視窗中的內容和模型記住的內容。已儲存的聊天會保留。如果聊天中有訊息，會先詢問確認。

## 截圖與螢幕錄影（宣傳片、教學）
<!-- en: screenshots-and-screen-recordings-promos-tutorials c4361e472f0f -->

選單列（視窗頂部的一排按鈕）在 ⚙ 之前有兩個圖示按鈕：

- **📷 Screenshot**（截圖，Alt+Shift+S）：儲存到相簿的 Images 中，檔名為 `screenshot_<date-time>.png`。
- **⏺ Record**（錄製，Alt+Shift+R）：點選開始。按鈕會變成閃爍的紅色 ■，滑鼠停留其上可顯示時長。再次點選即停止。錄影儲存為 H.264 mp4（`screenrec_<date-time>.mp4`），位於相簿的 Videos 中，可直接用於任何剪輯軟體或手機。錄製期間每秒都會把影片傳送到伺服器，因此錄製長教學也沒有問題。

右鍵點選任一按鈕可開啟選項。這些選項會儲存在本機上。

| 選項 | 作用 |
|---|---|
| **App window**（應用程式視窗）/ **Whole screen**（整個螢幕） | 只捕獲 bitGen Studio（教學最乾淨的畫面），或捕獲其所在的整個螢幕 |
| **Computer sound**（電腦聲音） | 錄製電腦播放的聲音，例如你預覽的渲染結果和歌曲。在應用程式中此功能適用於 Windows；在瀏覽器分頁中，瀏覽器會要求你勾選 "share audio" |
| **Microphone**（麥克風） | 錄製你的解說，並與電腦聲音混合 |
| **Countdown**（倒計時） | 關閉，或在開始前倒數 3 s 或 5 s，方便你把滑鼠放到位 |

在應用程式中，視窗或螢幕會自動為你選定。在瀏覽器分頁中，瀏覽器會詢問要共享什麼。

## MiniMax H3 上的 CFG
<!-- en: cfg-on-minimax-h3 564ef27cb0e1 -->

MiniMax H3 經過蒸餾，以 **CFG 1** 渲染：每步只進行一次模型推論，不使用負面提示詞。H3 的工作流程圖使用不帶 CFG 輸入的引導器（guider），因此在 2.366.0 之前，Basic Settings 中的 CFG 從未作用到它們。

將 CFG 設為**大於 1** 時，渲染會切換為真正的 CFG：額外執行第二次負向推論，使用相同的圖片、聲音和影片參考，並加上一段負面文字（含糊嘟囔、胡言亂語、多餘的詞、重複參考音訊）。這樣，引導只會強化你的**提示詞文字**所新增的內容，例如 `<d>...</d>` 中的臺詞和表演。每一步都要執行兩次，因此渲染時間約為原來的兩倍。

- 從 **2 到 3** 開始。更高的值會導致過度銳化和過度飽和。
- 關閉 **Settings → ComfyUI → 4-step LoRA**，並使用 **20 步以上**。turbo LoRA 是為 CFG 1 設計的，它開啟時任務日誌會發出警告。
- 任務日誌中的 `true cfg 3: 1 BasicGuider -> CFGGuider ...` 一行可確認 CFG 已生效。

## 用角色的聲音說出帶情感的臺詞（無歌曲）
<!-- en: speech-with-emotion-in-a-character-s-voice-no-song 54e16347816d -->

在沒有歌曲的分鏡腳本上，角色會說出各自的臺詞，每人都用自己的聲音。角色的聲音片段**只用於音色**：音高、口音、質感和情感色彩。模型會被告知絕不能說出片段中聽到的詞語。

- **編寫器如何寫臺詞：** 每句臺詞都帶有其情感和說話方式，例如
  `@anna whispers, voice trembling with fear: "Is someone there?"`。相應的面部和身體表現寫在臺詞之前的那一拍中。它絕不會引用或複用聲音片段中說的內容。
- **應用程式傳送的內容：** 渲染時，每句臺詞都會轉換為 MiniMax H3 自己的對白語法。表達方式放在標記之外，臺詞放在標記之內，例如
  `whispers, voice trembling with fear, in the timbre of <Audio 1>: <d>[English] Is someone there?</d>`。提示詞結尾會說明只有這些臺詞會被說出來。正是以普通敘述寫出的臺詞導致了模型胡言亂語。
- **聲音片段：** 長於 8 s 的片段會去掉開頭的靜音，以 8 s 樣本的形式傳送給模型。這樣模型能獲得聲音，而可以照搬的話語卻少得多。你的檔案不會被改動，場景備註會說明片段何時被裁切過。
- **其他語言：** 在引號中寫 `"[Spanish] ..."`，就會使用該語言代替英語。
- **提示詞面板：** 提示詞聊天（Enter）也學習了同樣的語法。本機 LLM 並不總是遵循它，因此應用程式也會自行修正它們的輸出。增強後的提示詞返回時，其中的臺詞已被標記，主控台也會給出提示。每次提示詞渲染都會標記仍在普通引號中的臺詞，例如
  `says with a bright smile: "Thank you!"` 會變為 `says with a bright smile: <d>[English] Thank you!</d>`。帶引號的名稱和招牌（"a hotel called "The Palace""）保持不變。所用的聲音是提示詞中稱為她的聲音的那個 `<Audio n>`，或者是唯一一個檔名中註明 voice 的參考聲音。

## bitGen 如何編寫帶臺詞的 MiniMax H3 提示詞
<!-- en: how-bitgen-writes-a-minimax-h3-prompt-with-speech 35022e7b0109 -->

所有編寫影片提示詞的 LLM（提示詞聊天、✨ Enhance、參考面板）都學習了這種結構，並附有一個完整範例：

```
<Subject 1> is the woman in <Picture 1>, the charismatic host of a luxury travel ad.
<Subject 2> is the reception area and desk in <Picture 2>.
<Audio 1> is the voice timbre for <Subject 1> - pitch, accent and tone only.

Medium shot. ... She looks into the camera and says with a bright, welcoming smile, in the timbre of
<Audio 1>, <d>[English] Thank you!</d> She then holds her warm smile in silence as the camera slowly
pushes in. ... Sound: only her line in <d>, then a soft sea breeze and gentle room tone.
```

- 定義放在最前面，每行一個：先是主體，然後是聲音。
- 每句臺詞都內嵌在文中，情感寫在標籤外，臺詞寫在標籤內，並標明語言。
- 一句短臺詞之後，說話者做一個無聲的動作。
- 提示詞以一行 Sound 結尾，絕不堆疊多條「不要說話」之類的否定指令。

本機 LLM 會偏離這種結構，因此 LLM 生成的提示詞以及每次提示詞渲染都會由應用程式自行整理成這種結構。主控台或任務日誌會列出所做的修改：

- `<subject n>` 變為 `<Subject n>`。
- 帶引號的臺詞變為 `<d>`，沒有標明語言的 `<d>` 會加上 `[English]`。
- 每個 `<d>` 行都會加上 "in the timbre of"（以……的音色）該聲音。
- 聲音只在主體行之後定義一次。
- 多餘的 "the voice is only the timbre of…" 句子以及重複的 "do not speak / no murmurs / DO NOT SPEAK
  AUDIO 1" 指令會被刪除。取而代之的是一句結尾說明：只有 `<d>` 行會被說出來。
- 諸如 "she does not speak until the door opens" 這樣的劇情節拍會被保留。

## 音樂影片分鏡腳本上的唇形同步
<!-- en: lip-sync-on-a-music-video-board 9bf7211ac7cb -->

在 **MMH3_NativeAudio_MV** 分鏡腳本上，歌曲就是人聲：只有當場景的提示詞中包含演唱句（`… sings the exact supplied vocal
audio with natural, precise lip synchronization …`）時，該場景才會進行唇形同步。寫有
`lips remain fully closed` 的場景會渲染為**無**唇形同步。從 2.356.0 起：

- **由歌曲帶時間軸的文字稿決定。** 對分鏡腳本歌曲的歌詞轉錄一次（Voice / Stems → Transcribe，lyrics 模式）。文字稿會以 `<song>.srt` / `.lrc` 的形式儲存在專案的 `transcripts` 資料夾中，你也可以把自己的 `.srt` / `.lrc` 放在歌曲旁邊。之後每個場景在渲染時都會檢查其時間視窗：
  - **視窗內有歌詞：** 閉唇句會變為演唱句，並把歌詞寫入提示詞（`The words sung in this clip: "…"`），以幫助唇形匹配；
  - **沒有歌詞**（前奏、獨奏、間奏）：演唱句會變為閉唇句。
- **編寫器**看到的是同樣的清單（哪些場景有演唱，以及對應的歌詞）。它必須讓每個場景都演唱，只有在文字稿（或你的簡要說明）表明是純器樂的段落上才可以閉唇。吉他或安靜的氛圍不再是閉唇的理由。
- **沒有文字稿：** 閉唇場景保持原樣，渲染備註會說明它將沒有唇形同步。

## 提示詞 LLM 與你的參考素材
<!-- en: the-prompt-llm-and-your-references d2f33a82023b -->

當你圍繞**影片**聊天時，LLM 會按照影片模型接收的方式獲得參考面板的內容（2.354.0）：

- 圖片按托盤順序為 `<Picture 1>`、`<Picture 2>` …，每張都附有其主體編號、作用，以及本機視覺模型生成的一行描述（只描述一次，之後記住；關閉 🖼 Describe 則跳過）；
- 影片為 `<Video 1..3>`，聲音為 `<Audio 1..3>`。

它會寫出這樣的提示詞：*`<subject 1> is the woman in <Picture 1>.` Keep the
head, face and hair of the woman in `<Picture 1>`, keep the body of the
woman in `<Picture 2>`. She does the action in `<Video 1>`, her voice is
`<Audio 1>`.*（意為：subject 1 是 Picture 1 中的女子。保留 Picture 1 中女子的頭部、面部和頭髮，保留 Picture 2 中女子的身體。她做出 Video 1 中的動作，她的聲音是 Audio 1。）如果模型仍把檔名寫成標籤（`<photo.png>`），或寫成 `<sound 1>`，回覆會在你看到之前被糾正為正確的標籤。MiniMax H3 把聲音稱為 `<Audio n>`。

## 提示詞渲染中的參考影片和聲音
<!-- en: reference-videos-and-sounds-in-a-prompt-render 8a3bb8227765 -->

參考面板的 **Video** 和 **Sound** 分頁會以 `<Video n>` 和 `<Audio n>` 的形式提供給 MiniMax H3 的參考渲染（ref2va）：每種最多 3 個。從 2.353.0 起：

- **按需新增槽位。** 如果風格的 ref2va 工作流程（例如 **H3_Video_Ref**）儲存時只有圖片槽位，渲染時會自行新增影片和聲音槽位。影片本身的聲音會隨影片一起送入。日誌會顯示 `the graph had no video reference slot - added 1`。
- **無需圖片。** 參考模式只用一個影片或一個聲音也能渲染。文字模式下如果載入了影片或聲音，會按 ref2va 渲染，以便用上它們，佇列也會提示這一點。
- 參考工作流程（H3_Video_Ref）上的 First / Last 也會一併傳送影片和聲音。

## 參考影片的 Append / Prepend (2.388.0)
<!-- en: append-prepend-a-reference-video-2-388-0 fd5c8eebcbc7 -->

在 **References → Video** 中，每個影片下方都有一個 **Use**（用途）下拉式選單：

- **Reference**（參考，預設）：模型跟隨該影片，與之前相同。
- **Append**（追加）：**Generate**（提示詞面板）取該影片的**最後一個影格**，將其放大到影片的尺寸（使用 ⚙ PNG 放大器，沒有則使用 lanczos），並渲染一段從它**開始**的新部分。結果是**影片 + 新部分**合成的一個片段；單獨的新部分儲存為 `<name>_part.mp4`。
- **Prepend**（前置）：同理，但使用**第一個影格**：新部分在這一個影格**結束**，並放在影片**之前**。

**始終使用首幀 / 尾幀（2.395.0）。** Append 和 Prepend 始終以 **fl2va**（MiniMax H3 的首幀 / 尾幀模型）渲染，絕不使用 References 或普通的圖生影片：

- **Picture 1** 是影片的影格：Append 時為其最後一個影格（新部分的開頭），Prepend 時為其第一個影格（新部分的結尾）。
- **Picture 2** 是 **References → Image** 中的第一張圖片：Append 時為新部分的結尾，Prepend 時為新部分的開頭。如果有 Type 為 **Last frame**（Append）或 **First frame**（Prepend）的圖片，則改用該圖片。
- Image 分頁會把這張圖片標記為 **Picture 2 · last frame**（或 **· first frame**）。fl2va 只接受兩影格，因此其他圖片會變暗並標記為 **not used**。影片自己的卡片會說明它提供的是哪一個影格。
- 沒有圖片時，新部分從影片的最後一個影格開始（Append）。對於 Prepend，則從第一個影格向後生成，再無聲倒放，使其正好銜接到影片上。
- 不會向提示詞新增 `<subject n>` 行，因為這些圖片是影格，而不是主體。

**LLM 會得到說明。** 提示詞聊天會獲得以下細節：

- 這是對該影片進行的 fl2va Append 或 Prepend；
- **Picture 1** 是它的最後一個影格（或第一個影格）。該影格會被提取出來，並像任何參考圖一樣由本機視覺模型進行描述；
- **Picture 2** 是你的圖片，以及新部分在哪裡開始或結束。

LLM 會寫出一個延續該影片或引出該影片的連續鏡頭，不含對應行，也沒有剪下。

同一時間只能有一個影片設為 Append / Prepend。它適用於 MiniMax H3 風格和 Wan 風格。**Refmods**（從角色中提取的身分 mod）也可用於 fl2va 渲染——屬於實驗性功能，由分鏡腳本的續接分塊使用。

## 浮動提示詞面板 (2.389.0)
<!-- en: the-floating-prompt-docker-2-389-0 37c14c73c3d7 -->

提示詞面板作為一個獨立視窗浮動在應用程式之上。

- **移動：** 拖曳其標題列。它的邊緣會吸附到其他面板和視窗的邊緣。
- **調整大小（2.398.0）：** 拖曳任意邊緣或角。停靠在側邊面板中時，拖曳其底邊同樣可以調整大小。停靠在欄中時，用它下方的手柄調整大小。如果它下方沒有開啟的面板，上方的面板會為它讓出空間。
- **摺疊：** 點選其標題列。
- **停靠：** 把它拖到另一個面板上方，靠近的那條邊會亮起。在那裡放下：
  - 上邊或下邊：將它放進該面板上方或下方的欄中；
  - 左邊或右邊：將它放在該面板旁邊。兩者之間的分隔條用於設定其寬度。
  - 側邊面板（Settings、References、Assets、Queue、Gallery）會在其頂部或底部接納它。
- **重新浮動：** 把它的標題列拖出停靠位置。
- **P** 可在應用程式中的任意位置顯示或隱藏它。在輸入框中輸入、有對話方塊開啟或按住 Shift 時（Shift+P 是時間軸的 Path 工具），P 不起作用。
- 它的位置和大小儲存在 docker_status.json 中。

## Basic Settings 和 LLM tokens 改為浮動 (2.393.0)
<!-- en: basic-settings-and-llm-tokens-float-2-393-0 73f7a8bca880 -->

**Basic Settings** 和 **LLM tokens** 不再位於左側面板中。它們各自成為一個獨立的浮動面板。

- **S** 顯示或隱藏 Basic Settings。**L** 顯示或隱藏 LLM tokens。
- 在輸入框中輸入、有對話方塊開啟或按住 Ctrl、Alt 或 Shift 時，這些鍵不起作用。
- 在影像編輯器和時間軸畫布上，S 和 L 仍是這些工具的快捷鍵（編輯器中的 Clone Stamp 和 Lasso，畫布上的 3D Scale 控制項）。請先把指標移開。
- 左側面板在原來這兩個區域的位置有兩個按鈕：**LLM tokens L** 和
  **Basic Settings S**。點選按鈕可顯示或隱藏對應的視窗。視窗顯示時，按鈕會亮起。
- **移動視窗：** 拖曳其標題列。它的邊緣會吸附到各面板的邊緣、彼此的邊緣以及視窗的邊緣。
- **調整視窗大小：** 拖曳任意邊緣或角。
- **✕** 隱藏視窗。
- 每個視窗是否顯示、其位置和大小都儲存在
  docker_status.json（`floats`）中。

**它們是面板（2.398.0）。** 透過標題列拖曳 Basic Settings 或 LLM tokens 時，將要放置的位置會亮起：

- **作為分頁放進某個面板：** 放到該面板的標題列上。該面板會出現一排分頁：先是它自己的名稱，然後是其中的每個面板。點選分頁即可切換。這適用於任何面板，包括左側的 Settings。
- **放在底部面板的上方或下方**（Preview、Video、Music…）：放到該面板的頂邊或底邊附近。它會在欄中佔據自己的位置，其底邊用於設定高度。
- **放在底部面板旁邊：** 放到左邊或右邊附近。其內側邊緣用於設定寬度。
- **堆疊在側邊面板中**（Settings、References、Assets、Queue、Gallery）：放到頂邊或底邊附近。其底邊用於設定高度。
- **放進左側面板的清單**（2.401.4）：把它拖到 Settings 清單（System、面板按鈕……）上方。兩個區域之間會亮起一條線，標籤會說明放置位置，例如 "Dock Basic Settings in Settings - above the
  panel buttons"。放下後，它會以完整高度位於清單中，並隨清單捲動，就像以前那些區域一樣。LLM tokens 和 Basic Settings 可以按任意順序放置。仍可透過其標題列把它拖出來。
- 在其他任何地方鬆開，它就會浮動在那裡。
- **重新浮動：** 把它的標題列或分頁拖出來。
- 無論停靠在哪裡，**S**、**L** 和 ✕ 仍可隱藏和顯示它。

每個面板的停靠位置、大小以及目前顯示的分頁都儲存在
docker_status.json 中，因此重新啟動後會恢復原樣。

## 選擇參考影片的影格
<!-- en: choosing-the-frames-of-a-reference-video bf7352c5da70 -->

![Reference video selection](images/reference-select.png)

點選 **References → Video** 分頁中的任意影片：

- **預覽**只循環播放所選的影格；
- **膠片條**可用 **− / + / 滑桿 / Ctrl+滾輪** 縮放（從整個影片一直放大到每影格一張縮圖）；**Fit** 顯示全部；
- **選擇框**的長度等於 **Duration**——可以拖曳它、點選膠片條使其居中，或用 **← →** 微移（一個影格；Shift = 一秒）。起始影格和結束影格顯示在預覽下方。

**Apply**（套用）會把這些影格精確剪下到原檔案旁邊的 `<name>_sel_f<first>-f<last>.mp4` 中，並將其放入參考槽位——此後 Ref、F/L 和 Swap 只使用這一部分。再次點選剪下後的影片會重新開啟原影片，選擇框仍在你離開時的位置。**Cancel**（取消）不做任何更改。

## 影像、ControlNet 與面部修復
<!-- en: images-controlnet-and-face-fix ff9d26565cb7 -->

將 Generate 下拉式選單設為 **🖼 Image**，並選擇一種影像風格（FLUX.2
Klein、SDXL、Z-Image、Qwen-Image…；可在 **Settings → Image** 中管理）。在 Basic Settings 中：

- **ControlNet**（2.593.0：附加元件——在 Settings ▸ General 中開啟）——先渲染第一張圖片，將其轉換為控制圖（線稿、深度、姿勢…），再用**第二個模型**（例如寫實風格的 SDXL 或 Klein）渲染最終圖片，並使用其獨立的提示詞、強度和結束點。*Final image only*（僅最終圖片）會隱藏中間圖片。
- **Face fix**（面部修復，2.593.0：附加元件——在 Settings ▸ General 中開啟）——FaceDetailer 會重新繪製最終圖片中的每張臉。
- **Image editor**（影像編輯器）面板用 AI 編輯圖片；參見下一節。
- **Qwen Image 2.1 讀取參考面板**（2.340.0）。使用 **qwen2_1**
  （最多 10 張圖片）或 **Qwen Image 2.1 edit**（8 張）時，Generate Image 會按順序把面板中的圖片以 `<image1>`、`<image2>`、… 傳送。
  - 在提示詞中寫 `<image2>` 等即可指代它們。面板自己的
    `<Picture n>` 標籤會自動為你轉換。
  - 如果提示詞中一個都沒有提到，會根據每張圖片的 Type 新增一行，說明各圖片是什麼（例如 "<image1> is the person, <image2> is the clothing"）。
  - 參考面板為空時，**qwen2_1** 僅根據文字進行渲染。

## 影像編輯器（含 ✨ AI）
<!-- en: the-image-editor-with-ai acf50a2072aa -->

從 2.389.0 起，編輯器擁有選單列、選項列、工具列和面板（佈局與 PhotoCraft 相同）。點選底部列中的 **Editor** 即可開啟。將圖片拖放到編輯器上（來自相簿、素材、參考圖或檔案）——2.549.0：如果已經開啟了一張圖片，會詢問 **▦ Add as a layer**（新增為圖層）還是 **🗋 Open as a new document**（作為新文件開啟）（Enter = 圖層，Esc = 都不選，拖放時按住 Shift = 直接新增為圖層）——也可以使用 **File ▸ Open**（Ctrl+O）或 **File ▸ New**（Ctrl+N）。**⛶** 或 **F** 讓編輯器佔滿整個螢幕。**Tab** 顯示或隱藏面板；**Shift+Tab** 只隱藏面板組。

**路徑文字、變形文字和 3D 文字（2.397.0）**

**T** 按鈕現在包含三個工具；**Shift+T** 在它們之間切換：

- **Horizontal Type**（水平文字），與以前相同。
- **Vertical Type**（垂直文字）：字母一個接一個向下排列。每一新行是右側的新一列。
- **Type on a Path**（路徑文字）：在圖片上拖出一條線，或點選若干點後雙擊（或按 **Enter**）完成，然後輸入文字。字母會沿著這條線排列。使用此工具時，拖曳路徑上的點可以改變路徑形狀。**Start** 讓文字沿路徑移動，**⇅ Flip** 把文字放到路徑的另一側。**Esc** 取消正在繪製的路徑。

Type 選項列新增四個按鈕：**TT**（全部大寫）、**U**（下劃線）、**S**（刪除線）和 **↕T**（豎排）。

**⌒ Shape / 3D…**（位於選項列、文字圖層的 Properties 中，或 **Layer ▸ Text Shape**）可即時改變文字圖層：

- **Warp**（變形）：Arc、Arc Lower、Arc Upper、Arch、Bulge、Flag、Wave、Fish、Rise、Squeeze 或 Inflate，Bend 範圍為 −100 到 100。
- **Round a circle**（環繞圓形）：文字排列在圓上。可設定半徑、文字的居中位置，以及文字是繞過頂部，還是沿底部從左向右閱讀。
- **Along a drawn path**（沿繪製的路徑）：用於以 Type on a Path 製作的文字。
- **3D**：字母向後擠出。可設定深度、方向、向後的明暗過渡以及側面顏色（預設為文字本身顏色的較暗版本，除非你另選一種）。新增 **Bevel & Emboss**（見下文）可使正面變得圓潤。

文字始終保持可編輯：用 Type 工具點選它即可修改文字內容。**Cancel** 將其恢復原狀。

**圖層樣式：Bevel & Emboss、Satin、Pattern Overlay、混合模式、Styles（2.397.0）**

Layer Style 對話方塊（**fx**，或 **Layer ▸ Layer Style**）現在列出十種圖層樣式：

- **Bevel & Emboss**（斜面和浮雕）：Inner Bevel、Outer Bevel、Emboss 或 Pillow Emboss。可設定深度、方向（上或下）、大小、軟化、光源的角度和高度，以及高光和陰影的顏色與不透明度。
- **Satin**（光澤）：形狀內部的絲緞般光澤。
- **Pattern Overlay**（圖案疊加）：十種圖案（棋盤格、條紋、斜條紋、波點、網格、磚塊、波浪、碳纖維、雜訊、半調網點），使用你選擇的兩種顏色，並可設定縮放。
- **Color、Gradient 和 Pattern Overlay** 各自都有 **blend mode**（混合模式）（Multiply、Screen、Overlay、Soft Light 以及另外十二種）。
- **Gradient Overlay** 有五種樣式（線性、徑向、角度、對稱、菱形），另有反向和縮放。它與圖層自身的內容對齊，而不是與整張圖片對齊。
- 對話方塊頂部的 **Styles** 提供一鍵外觀：Gold、Chrome、Neon、Embossed、Glass、3D Pop、Retro、Fire、Ice 和 Letterpress。每一種都會替換該圖層原有的樣式。之後你可以修改任何設定。

Bevel & Emboss 和 Satin 可以儲存到 PSD 檔案並從中讀取。PSD 中的圖案疊加目前仍會被忽略。

**新濾鏡（2.397.0）**

- **Filter ▸ Render ▸ Lens Flare**：四種鏡頭類型（50-300mm Zoom、35mm Prime、105mm Prime、Movie Prime）、亮度和色調。**對話方塊開啟時點選圖片即可放置光暈。** 在空圖層上，它會自行生成光源。
- **Filter ▸ Distort ▸ Swirl**：圍繞中心的旋渦。可設定強度、半徑和衰減，點選圖片放置中心點。
- **Filter ▸ Stylize ▸ Drop Shadow**：由圖層像素投射的陰影，可設定角度、距離、模糊、擴展、不透明度和顏色。像素周圍需要有透明區域，例如文字或去背後的影像。
- **Filter ▸ Stylize ▸ 3D Extrude**：按深度、方向和明暗擠出任意圖層的像素。側面為較暗的副本或純色。
- 點選圖片也可以為 **Radial Blur** 放置中心點。

**顏色、New、Paint Bucket 和漸層填充（2.396.0）**

- **File ▸ New** 會用**背景色**（工具列中靠後的那個色塊）填充新圖片，除非你選擇 White、Black 或 Transparent。選項旁邊會顯示該顏色。
- **⇄ swap (X)** 交換前景色和背景色。如果圖片的 **Background** 圖層仍是單一純色，它會被重新塗成新的背景色。這算作一步，所以 **Ctrl+Z** 可以恢復原來的顏色。已在上面繪畫過的 Background 圖層不受影響。Color 面板也有一個 **⇄** 按鈕，**◩ (D)** 設為黑 / 白。
- 色塊變得更大並帶有描邊，因此深色在深色主題下也清晰可見。
- **Paint Bucket** 在 Gradient 工具下方有自己的按鈕。**G** 選擇你上次使用的那個，**Shift+G** 在兩者之間切換。其選項列：
  - **Fill**：Foreground、Background 或 **Gradient**。
  - 選擇 Gradient 時，點選一下會從上到下填充該區域。拖曳可自訂方向。它使用 Gradient 工具的顏色和形狀（線性、徑向……），並且只填充所點選的區域。
  - **Tolerance**、**Contiguous**（關閉 = 填充圖片中所有匹配的像素）、**All layers**（在所有可見內容中查詢區域）和 **Opacity**。
  - 在選取範圍內點選會填充選取範圍。Alt+點選用於取色。

**看起來就像 bitGen（2.393.0）**

- 編輯器使用 **bitGen** 主題：應用程式的深色配色和橙色強調色。其選單列的高度和顏色與 bitGen 的選單列相同。其狀態行的高度和顏色與 bitGen 的狀態列相同。
- **Full screen**（全螢幕，⛶ 或 F）會保留編輯器周圍的 bitGen 介面。bitGen 的標題列、選單列和狀態列保持原位；編輯器填滿它們之間的空間。編輯器的狀態行移入 bitGen 的狀態列（"Editor · …"）。再次按 **Esc**、**F** 或 **⛶** 可將編輯器放回所在面板。
- **Window ▸ Theme** 仍然提供 Pro（深色）、Studio（淺色）和 Classic。

**佈局**

- **選單列**包含 File、Edit、Image、Layer、Select、Filter、View、Window 和 Help。每一項都有其常用快捷鍵。
- **Ctrl+K** 開啟命令面板：輸入命令的一部分並按 Enter。
- **Help ▸ Keyboard Shortcuts** 列出所有按鍵。
- 選單下方的**選項列**顯示目前工具的設定。
- **工具列**包含常見的工具組和按鍵：
  - 選擇與移動：Move (V)、Marquee (M)、Lasso (L)、Magic Wand 和快速選擇畫筆 (W)、Crop (C)、Eyedropper (I)；
  - 修飾與繪畫：Spot Healing 和 Healing Brush (J)、Brush 和 Pencil (B)、Clone Stamp (S)、History Brush (Y)、Eraser (E)、Gradient 和 Paint Bucket (G)、Blur、Sharpen 和 Smudge (R)、Dodge、Burn 和 Sponge (O)；
  - 文字與形狀：Type (T)、Shape (U)；
  - 檢視：Hand (H)、Zoom (Z)。
- 工具上的小三角表示該工具組中還有更多工具。按住 Shift 再按該工具的按鍵可循環切換，或右鍵點選、長按按鈕來選擇其中一個。
- 工具列底部：D 設為預設顏色，X 交換顏色，Q (◘) 開啟或關閉 Quick Mask。
- **P 在這裡不是工具。** P 在任何地方都用於顯示和隱藏提示詞面板。
- 右側的**面板**分為三組：
  - **Color** 和 **Swatches**；
  - **Properties**、**Adjustments**、**✨ AI** 和 **◈ Control**；
  - **Layers** 和 **History**。
- **Window ▸ Theme** 用於選擇 Pro（深色）、Studio（淺色）或 Classic。
- **View** 中可開啟 Rulers（標尺，Ctrl+R）和 Grid（網格，Ctrl+'）。

**圖層**

- **圖層類型**：
  - 像素圖層；
  - **調整圖層**（Adjustments 面板，或 Layer ▸ New Adjustment Layer）。它們會改變下方的所有內容，而不觸碰任何像素。共有 14 種：Brightness/Contrast、Levels、Curves、Exposure、Vibrance、Hue/Saturation、Color Balance、Black & White、Photo Filter、Channel Mixer、Gradient Map、Invert、Posterize 和 Threshold。其設定在 Properties 中即時生效。
  - **填充圖層**（純色或漸層）；
  - **文字圖層**（T：點選並輸入；Esc 或 Ctrl+Enter 確認；再次點選文字即可編輯）；
  - **形狀圖層**（U：矩形、圓角矩形、橢圓、三角形、多邊形、直線），始終保持可編輯；
  - **組**（Ctrl+G 將活動圖層編組；Shift+Ctrl+G 取消編組；2.549.0：在 Layers 面板中點選後也可以立即使用這些按鍵）。混合模式設為 *Pass Through* 的組，其中的調整圖層會作用到組下方的圖層。其他任何混合模式都會讓該組單獨合成。2.547.0：在 Layers 面板中**選取多個圖層**（Ctrl+點選 / Shift+點選）時，**Ctrl+G** 會將它們按原有順序全部放入一個新組；選取**一個組**時，**Ctrl+G** 會取消該編組。選取多個圖層時，**🗑** 按鈕、Layer ▸ Delete Layer 和 Shift+Del 會將它們全部刪除（一次 Ctrl+Z 即可全部恢復）。
- **圖層遮罩**（◫，或 Layer ▸ Layer Mask）在白色處顯示、在黑色處隱藏：
  - 點選遮罩縮圖即可在其上繪畫；
  - Alt+點選可檢視遮罩本身；
  - Shift+點選可停用遮罩；
  - Ctrl+點選可將其載入為選取範圍。
  - Properties 可設定其密度和羽化，並可反相、套用或刪除遮罩。
- **剪貼**（Alt+Ctrl+G）讓圖層只在其下方圖層有像素的地方顯示。
- **圖層樣式**（fx，或雙擊縮圖）：Drop Shadow、Inner Shadow、Outer Glow、Inner Glow、Stroke（外部、內部或居中）、Colour Overlay 和 Gradient Overlay。它們可以複製和貼上。
- **填充不透明度**使像素變淡，但不影響其樣式。
- **鎖定**：透明像素、影像像素、位置、全部。
- **右鍵點選圖層**可設定顏色標籤等。
- 在面板中**拖曳圖層**可重新排序，或將圖層拖放到組上以放入組內。
- **排列**：Ctrl+[ 和 Ctrl+] 將圖層下移和上移；加上 Shift 則移到最底層和最頂層。
- **合併**：Merge Down (Ctrl+E)、Merge Visible、Flatten Image、Rasterize。
- **歷史記錄**：History 面板列出每一步（最近 80 步）。點選某一步即可後退或前進到該步。

**先建立選取範圍。其他一切操作都遵循選取範圍。**

- **組合**：Shift 新增，Alt 減去，Shift+Alt 交叉（或使用選項列中的按鈕）。選項列的 **Feather** 會柔化下一次建立的選取範圍。
- **Select 選單**：
  - All (Ctrl+A)、Deselect (Ctrl+D)、Reselect、Inverse (Shift+Ctrl+I)；
  - **Color Range**；
  - **Modify**：Border、Smooth、Expand、Contract、Feather (Shift+F6)；
  - 將圖層的透明度或其遮罩載入為選取範圍。
- **Quick Mask (Q)**：選取範圍之外的區域顯示為紅色。畫筆新增到選取範圍，橡皮擦從選取範圍中移除。再次按 Q 即可將其轉回選取範圍。


**繪畫與修飾**

- **Brush (B)** 使用 20 種預設之一（▾）。按鍵 1…0 設定不透明度。Alt+點選或 Ctrl+點選可取色。數位板的壓感控制大小和/或流量。
- **Pencil**：硬邊。
- **Clone Stamp (S)**：Alt+點選設定源，然後繪畫。可選擇是否對齊，以及僅目前圖層或所有圖層。
- **Healing Brush**：同上，但顏色會與所繪製的位置相匹配。
- **Spot Healing (J)**：在斑點上塗抹，它會用周圍的內容填充。
- **History Brush (Y)**：將圖層繪製回開啟時的狀態。使用 ⟲ Set source 更改該參照點。
- **Dodge、Burn、Sponge (O)**：色調範圍和曝光度。
- **Blur、Sharpen、Smudge (R)**：強度。
- **Gradient (G)**：線性、徑向、角度、對稱或菱形。顏色可以是前景色到背景色、前景色到透明、黑白，或光譜。
- **Paint Bucket (Shift+G)**：填充顏色相近的區域。
- **Crop (C)**：拖出一個框，選擇比例，Enter 裁切（Esc 取消）。
- **Free Transform**（Ctrl+T，或 Move 工具選項列上的 **⤡ Transform**）：在框內拖曳以移動。拖曳角點會等比縮放；Shift+拖曳角點可自由縮放。在框外拖曳可旋轉（按住 Shift 以 15° 為步進）。2.551.0：**拖曳中間控制點可斜切**（游標變為傾斜箭頭；上 / 下 = 橫向，左 / 右 = 縱向）；**Shift 或 Alt + 中間控制點**拉伸該邊。你也可以在選項列中輸入 X、Y、W、H、角度和兩個斜切值（⇋ ⇵）。按 Enter 套用。如果選取範圍中不包含該圖層的任何像素，則變換整個圖層。
- **Move (V)** 與 **Paste**（2.550.0）：Ctrl+V 將圖片作為新圖層放在中央，並取消選取範圍（選取範圍原本位於複製的區域上，導致 Move 工具移動的是新圖層的空白部分）。Move 工具移動選取的像素；沒有選取範圍時——或者選取範圍中不包含該圖層的任何像素時——則移動整個圖層。
- **Edit ▸ Transform** 用於旋轉或翻轉圖層。
- **Image**：
  - Adjustments（全部 18 種，直接作用於像素）；
  - Auto Tone、Auto Contrast 和 Auto Color；
  - Image Size 和 Canvas Size（帶錨點）；
  - Image Rotation；
  - 裁切到選取範圍；
  - Trim。
- **Filter**：Blur、Distort、Noise、Pixelate、Render、Sharpen 和 Stylize 子選單，共 23 種濾鏡。每種都可即時預覽。Ctrl+F 重複上一次的濾鏡。
- 選取遮罩縮圖時，繪畫、濾鏡和填充會作用於遮罩；在 Quick Mask 中則作用於選取範圍。

**儲存**

- **File ▸ Save to Images**（Ctrl+S）將可見圖片儲存到專案的 Images 中。
- **File ▸ Export As** 可選擇 PNG、JPEG 或 WebP、品質和縮放比例。它會顯示預覽和檔案大小，並可儲存到 Images 或下載。
- 複製和貼上使用 Ctrl+C、Ctrl+X 和 Ctrl+V。Paste in Place（原位貼上）為 Shift+Ctrl+V，Copy Merged（合併複製）為 Shift+Ctrl+C。也可以貼上來自系統剪貼簿的圖片。

**✨ AI** 的工作方式與 Krita AI Diffusion 相同。模型看到的是選取範圍加上其周圍的 **context**（上下文）邊距，並縮放到不超過 **MP** 預算。結果以**新圖層**的形式返回，新像素只位於**羽化後**的選取範圍內。

- **Generate** 根據提示詞重新生成選取範圍，使用修復（inpaint）風格（FLUX Fill inpaint、SDXL……）。
- **Refine** 以低於 100 % 的**強度**（strength）重新處理：形狀保留，細節改變。
- **Remove** 移除所選內容並延續周圍的畫面。提示詞可選。
- **Edit** 使用編輯模型執行指令：**Qwen Image Edit 2511**、**FLUX.1 Kontext** 或 FLUX.2 Klein edit（"make her jacket red"、"remove the glasses"）。沒有選取範圍時，它編輯整張圖片。
- **Background** 保留選取範圍，重新生成其餘所有內容。
- **Results** 生成 1–4 個版本。點選其中一個進行比較，然後用 **✔ Apply**（Enter）將其保留為圖層，或用 **✕ Discard**（Esc）放棄。
- **⤢ Expand** 在一側或所有側擴展畫布，並選取新增的條帶區域。隨後 Generate 會將圖片延續到其中。

如果面板中的提示詞框為空，則使用主提示詞。這些模型在安裝設定（setup）的 *Image editing* 下下載。

**◈ Control layers** 的工作方式與 Krita AI Diffusion 的相同。控制圖層透過 ControlNet 引導 Generate、Refine、Remove 和 Background。它永遠不屬於圖片本身：儲存和 AI 都會跳過它。

- 選擇一種類型並按 **＋ layer**。類型包括 scribble、line art、soft edge、canny、depth、normal map、pose 和 segmentation。
- 對於線條類型，用畫筆在圖層上畫深色線條。
- 或者按 **⟲ From image**，讓該類型的前處理器根據圖片生成圖層。之後你可以用畫筆或橡皮擦進行修飾。
- **◈ active** 將你目前所在的圖層變為控制圖層。
- 每個控制圖層都有**強度**（strength）、**start / end** 範圍（它在取樣過程中起引導作用的階段），以及來自 ComfyUI 的 `models/controlnet` 的 **ControlNet model**。*auto* 會選擇名稱中包含該類型的模型，否則選擇 union / ProMax 模型。
- 最多可同時使用四個。取消勾選某個，即可在下一次執行中排除它。
- 編輯模型直接使用圖片本身，因此執行 Edit 時不會發送控制圖層。
- From image 需要 *comfyui_controlnet_aux* 節點套件。Canny 使用 ComfyUI 內建的節點。

**🎚 Adjust 和 ✦ Filter** 是作用於活動圖層的選單；有選取範圍時只作用於選取範圍內部（按其柔和邊緣混合）。

- **Adjust**：Brightness/Contrast、Hue/Saturation、Levels、Color Balance、Exposure、Vibrance、Black & White、Sepia、Invert、Posterize、Threshold 和 Auto Contrast。
- **Filter**：Gaussian Blur、Motion Blur、Unsharp Mask、Add Noise、Median、Pixelate、Emboss、Find Edges、Vignette、Glow、Chromatic Aberration 和 Oil Paint。
- 對話方塊即時預覽。**OK** 使更改成為一個復原步驟，**Ctrl+F** 重複上一次的濾鏡。

### Segment Anything、Compose、參考圖和 PSD（2.390.0）

**Segment Anything** 幫你找出物體的輪廓。它在本機上執行。首次使用時，開啟 **Select ▸ Segment Anything Settings…** 並按 **⬇ Install**。它只下載一次模型，之後即可離線工作。SAM ViT-B 模型為 375 MB；ViT-H 較慢，但邊緣效果更好。如果 ComfyUI 的 `models/sams` 中已有 SAM 模型，則直接使用該模型。

- **Object Selection Tool (W)**：點選某個物體即可選取它。**Shift**+點選新增另一個物體；**Alt**+點選移除一個。在某物周圍拖出一個框，即可選取框內的內容。
- **Find**：在該工具的選項列中輸入文字，例如 *the person's head* 或 *dog, car*。**🎯 Select** 選取它們；**◐ Mask** 將它們設為活動圖層的遮罩。
- **Select ▸ Subject…** 透過對話方塊完成同樣的操作。它還可以把每個匹配項放到單獨的圖層上。
- **Layer ▸ Segment Layer…** 將圖層拆分為各個部分，每個部分位於組內的單獨圖層上。勾選 **cut out of the layer** 可將它們從原圖層中移除。填寫 **Only** 則只保留你指定名稱的物體。
- 在 **✨ AI** 面板中，**🎯 Select from prompt** 和 **◐ Mask from prompt** 使用提示詞框中的文字。

**✨ Compose（將圖層作為參考圖）**

1. 在 Layers 面板中 **Ctrl**+點選你需要的圖層。順序很重要：**1** 是場景，**2** 和 **3** 是要放入的物體。每個選取的圖層都會顯示其編號。
2. 在 **✨ AI** 中選擇 **Compose** 和一個 Edit 模型（預設為 Qwen Image Edit 2511）。
3. 寫下要生成的內容，例如 *put the dog from Layer 2 on the sofa in Layer 1*。文字中的圖層名稱會以 Picture 1、2、3 的形式傳給模型。
4. 按 **✨ Compose**。**✔ Apply** 將結果保留為新圖層。

**→ References**：**Layer ▸ Send to References**（或 **→ References** 按鈕）將選取的圖層放入參考圖面板。隨後提示詞面板中的 **Generate** 會使用它們，生成影片時也同樣適用。

**繪製遮罩時檢視遮罩（2.391.0）**

當畫筆在圖層遮罩上繪畫時，遮罩隱藏的區域會在你繪製時變紅。筆觸結束後紅色消失。**View ▸ Mask Overlay**（**\**）在遮罩被選取期間始終顯示紅色。

**PSD 檔案**

- **File ▸ Open PSD…** 開啟 PSD，也可以直接將 PSD 拖放到編輯器上。
- **File ▸ Save as PSD…**（Shift+Ctrl+S）儲存 PSD。它儲存在專案的 `psd` 資料夾中，也可以下載。**File ▸ Open PSD from Project…** 可再次開啟它。
- 以下內容會被保留：圖層、組、遮罩、不透明度、混合模式、可見性和圖層樣式。
- 文字圖層和智慧型物件以像素形式開啟。
- 調整圖層會被忽略（編輯器會說明數量）。儲存的 PSD 仍會顯示最終畫面。
- 向量遮罩和路徑形狀圖層在讀寫兩個方向上都以路徑形式保留（2.421.0）——見下文。


### 鋼筆、路徑、向量遮罩和自訂形狀（2.421.0）

專業編輯功能的第一部分。

**工具。** **P**（Shift+P 循環切換）——**Pen**：點選 = 角點錨點，拖曳 = 平滑錨點（其控制柄對稱），點選第一個錨點 = 閉合，Alt = 尖角點（一個控制柄），Shift = 以 45° 為步進，Ctrl = 臨時切換為 Direct Selection，Enter / Esc 保持路徑開放。在選取的路徑上，Pen 線上段上點選會新增錨點，在錨點上點選會刪除錨點（**Auto Add/Delete**）。**Freeform Pen** 手繪並擬合為貝塞爾曲線（**Curve Fit** px）。**Add / Delete Anchor Point** 和 **Convert Point**（點選：曲線 ⇄ 角點；拖曳錨點：生成新控制柄；拖曳控制柄：變為尖角點）。**A**——**Path Selection**（整個元件：拖曳移動，Alt+拖曳複製，Delete 刪除，元件的運算方式，⧉ **Merge Components**，⟳ **Transform…**）和 **Direct Selection**（錨點和控制柄，Shift 新增，框選可選取多個，方向鍵微移，Delete 刪除，Corner / Smooth）。**U**——Shape 工具和新增的 **Custom Shape** 工具（心形、星形、爆炸形、箭頭、V 形、加號、叉號、對勾、閃電、對話氣泡、水滴、月亮、房子、雲、圓環、邊框——以及你自己的形狀：**Edit ▸ Define Custom Shape…** 儲存所選取的路徑）。

**Shape 還是 Path。** 選項列的 **Mode**：*Shape* 繪製形狀圖層（前景色填充，背景色 + W 描邊），*Path* 繪製 **Work Path**。運算按鈕：▣ New Layer、⊕ Combine、⊖ Subtract Front Shape、⊗ Intersect、⊘ Exclude——除 New Layer 外，其他按鈕都會把新部分新增到活動形狀圖層中。普通 Shape 工具（矩形、橢圓……）也有相同的按鈕。只要移動形狀圖層的任一錨點，它就會變為可編輯路徑。

**Paths 面板**（位於 Layers 和 History 旁邊）：Work Path、你儲存的路徑，以及活動圖層的 Shape Path / Vector Mask。點選其中之一即可選取（使用路徑工具時會顯示其錨點）；**Ctrl+點選** = 將其載入為選取範圍（Shift 新增，Alt 減去）。雙擊 Work Path 可儲存它，雙擊已儲存的路徑可重新命名。按鈕：● 用前景色填充，○ 用畫筆描邊，⬚ 作為選取範圍載入，⟲ 從選取範圍生成工作路徑，◇ 由其生成向量遮罩，＋ 新增，⧉ 複製，☰ 更多，🗑 刪除（Alt+點選 ●、○、⬚、⟲ 可開啟其選項：不透明度 / 羽化，畫筆 / 鉛筆 / 橡皮擦 + 模擬壓感，羽化 + 新增 / 減去，容差）。

**向量遮罩。** **Layer ▸ Vector Mask: Reveal All / Hide All / Current Path / Disable / Rasterize / Delete**。向量遮罩在路徑內部顯示其圖層（Reveal All：除你在其中繪製的形狀外，其他地方都顯示）。其縮圖位於圖層遮罩縮圖旁邊：點選它可編輯路徑，Shift+點選將其關閉。Properties 中有其 Density、Feather、Invert、Link 和 Rasterize（柵格化為像素遮罩）。連結的向量遮罩會隨圖層一起移動。

**一切都跟隨圖片**：裁切、畫布大小、影像大小、旋轉和擴展都會移動 / 縮放路徑。每次編輯都是一個復原步驟。

**SVG 和 PSD。** **File ▸ Export Path as SVG…**、**File ▸ Place SVG as Shape Layer…**（以及 ☰ ▸ Import SVG as Path…）。PSD 在讀寫兩個方向上都保留向量遮罩和路徑形狀圖層（PSD 向量形狀圖層：路徑、填充、描邊）。

### 智慧型物件、智慧型濾鏡和變換（2.422.0）

**智慧型物件。** **Layer ▸ Smart Objects: Convert to Smart Object**（或 **Filter ▸ Convert for Smart Filters**）將活動圖層——像素、文字、形狀或填充圖層，或整個組——轉換為智慧型物件（其縮圖上顯示 ▣）。原來的圖層進入其內部，仍可編輯；智慧型物件顯示它們的外觀。它始終根據其內容重新繪製，因此你可以將其縮小再放大、旋轉、變形，而不會有任何損失。

- **Edit Contents**（雙擊縮圖）：內部內容在編輯器中開啟，並顯示一條橫幅——可修改任何內容（文字仍是文字），**✔ Done** 將其放回智慧型物件及其所有副本，**✕ Cancel** 放棄修改。智慧型物件中的智慧型物件也以同樣方式開啟。
- **Duplicate Layer** 共享內容（編輯一個，所有副本都會改變）；**New Smart Object via Copy** 建立一個獨立的智慧型物件。
- **Replace Contents…**（一個圖片檔案；保持位置和大小）、**Export Contents…**（PNG）、**Convert to Layers**（將內部內容恢復為一個組——保持其自身大小，不旋轉）、**Rasterize**（普通像素）。
- Properties 顯示其大小、是否已變形、有多少副本共享它，以及上述所有操作的按鈕。

**智慧型濾鏡。** 對智慧型物件使用任何 **Filter** 或 **Image ▸ Adjustments** 項（以及 Ctrl+F、Auto Tone……）時，它會作為智慧型濾鏡被**新增**，而不會改變像素。濾鏡列在圖層下方：👁 關閉某個濾鏡，雙擊重新開啟其設定，右鍵點選設定其不透明度，▲ 將其在順序中後移，✕ 刪除它。一個**濾鏡遮罩**（其縮圖位於 Smart Filters 行上）限制所有濾鏡：點選它並繪畫——黑色在該處隱藏濾鏡效果，白色則顯示；Shift+點選將其關閉。

**變換。** **Edit ▸ Transform: Skew / Distort / Perspective / Warp**（以及在智慧型物件上按 **Ctrl+T**）。選項列可在以下模式間切換：Free（移動、縮放——Shift 保持比例——在框外旋轉——Shift = 以 15° 為步進）、Skew（角點沿其所在邊移動，邊可滑動）、Distort（角點可任意移動）、Perspective（一個角點與其對應角點鏡像移動）和 Warp（4 × 4 網格：拖曳其點，或在內部任意位置拖曳使其在該處彎曲；預設 Arc、Arc Lower / Upper、Arch、Bulge、Flag、Wave、Fish、Rise、Inflate、Squeeze，帶 Bend %）。Enter 套用，Esc 取消。像素圖層（或其上的選取範圍）會重新繪製一次；智慧型物件則保留變換。

**Puppet Warp**（Edit ▸ Puppet Warp）：點選在圖層內容上放置圖釘（三個或更多可保持其形狀），拖曳圖釘進行彎曲——圖釘之間的所有內容都會自然跟隨；Alt+點選或 Delete 移除圖釘；選項列中有 Density 和 Show Mesh。在智慧型物件上，它是一個智慧型濾鏡。

**Content-Aware Scale**（Edit ▸ Content-Aware Scale…，Alt+Shift+Ctrl+C）：透過去除（或加倍）最不重要的像素行，使圖層內容變窄 / 變寬 / 變矮 / 變高——人臉、物體和邊緣保持原有形狀。**Protect: the selection** 讓你選取的內容完全保持原樣。對話方塊會顯示一個小型即時預覽。

**Liquify**（Filter ▸ Liquify…，Shift+Ctrl+X）開啟它自己的視窗：**W** Forward Warp（拖曳推移），**R** Reconstruct（塗抹以恢復更改），**C** Twirl（Alt = 反方向），**S** Pucker，**B** Bloat，**F** Freeze Mask（紅色 = 該處不會移動），**D** Thaw Mask；Size（[ 和 ]）、Pressure、Restore All。OK 套用（Enter），Cancel 取消（Esc）。在智慧型物件上，它是一個智慧型濾鏡——雙擊即可繼續編輯。

### 選取範圍：Select and Mask、Magnetic Lasso、Quick Selection、Sky、Channels（2.423.0）

**Select and Mask**（Select ▸ Select and Mask…，Alt+Ctrl+R）開啟一個獨立的工作區。用 **Quick Selection**（W——會擴展到邊緣；Alt 減去）、**Refine Edge**（R——在頭髮或毛髮上塗抹：會在該處搜尋邊緣）和 **Brush**（B——手動）進行繪製；頂部有 ☁ Sky 和 ⇄ Invert。右側：**View**（Overlay red、On Black、On White、Black & White、On Layers）及其不透明度；**Edge Detection**：Radius（尋找真實邊緣的帶狀範圍——粗略的選取範圍會吸附到圖片的邊緣上）和 Smart Radius；**Global Refinements**：Smooth、Feather、Contrast、Shift Edge；**Output**：Decontaminate Colors（從邊緣去除舊背景留下的彩色雜邊）以及 Output To：Selection、Layer Mask、New Layer、New Layer with Layer Mask。Enter = OK，Esc = Cancel。

- **Magnetic Lasso**（L，Shift+L 循環切換）：點選，然後沿邊緣移動——線條會吸附到邊緣上，每隔 Frequency px 落下一個點（點選可手動設定一個點，Backspace 撤回上一個點）；雙擊、按 Enter 或點選第一個點即可閉合。選項列中有 Width、Contrast、Frequency。
- **Quick Selection**（W）：塗抹——選取範圍會擴展到畫筆下方的邊緣；第一筆建立新選取範圍，之後的筆觸為新增，Alt 減去。Tolerance；Auto-Enhance 在每一筆之後平滑邊緣。
- **Select ▸ Sky**：選取延伸到頂部邊緣的天空（藍天、陰天或日落），沿天際線邊緣柔和。
- **Channels**（位於 Layers / Paths 旁邊的分頁）：RGB、Red、Green、Blue——點選某一個可單獨檢視（Ctrl+2 … Ctrl+5），Ctrl+點選將其亮度載入為選取範圍。**Alpha 通道**是儲存的選取範圍：**Select ▸ Save Selection…**（新增，或存入某個通道：替換 / 新增 / 減去 / 交叉）、**Select ▸ Load Selection…**（反相、運算方式）；點選某個通道可檢視，Ctrl+點選載入，雙擊重新命名。它們可以復原，並跟隨裁切 / 影像大小 / 旋轉。


### 修飾：Patch、Content-Aware Move 和 Fill、Red Eye、Mixer Brush、橡皮擦、修復（2.423.0）

以下工具都不使用 AI——圖片由自身內容填充（PatchMatch）並融合（Poisson），全部在頁面內完成。

- **Spot Healing Brush**（J）：Type 選擇 **Content-Aware**（用周圍內容填充）或 Proximity Match（舊方式）。
- **Healing Brush**（J）：Alt+點選設定源，然後塗抹——複製的內容現在會採用落點處的顏色和光照（只有紋理來自源）。
- **Patch**（J）：圈出要修復的區域（或選取它），然後將其拖到乾淨的紋理上：它會採用該紋理並融合（Patch: Source）。Destination 則反向操作。
- **Content-Aware Move**（J）：選取一個物體並拖曳——它會移動，原位置由周圍內容填充（Mode: Move），或者被複製（Extend）。
- **Red Eye**（J）：點選紅色瞳孔；Pupil Size、Darken Amount。
- **Edit ▸ Content-Aware Fill…** 以及 **Edit ▸ Fill…** 中的 Content-Aware：用圖片其餘部分填充選取範圍，結果放在目前圖層或新圖層上。
- **Mixer Brush**（B）：顏料在繪製過程中會沾取畫布的顏色——Wet、Load、Mix，每筆之後 Clean。
- **Background Eraser**（E）：擦除與畫筆中心下方顏色相近的內容（Continuous / Once、Tolerance、Protect Foreground Color）。
- **Magic Eraser**（E）：點選一下即可擦除該顏色的區域（Tolerance、Contiguous）。

### Gradient Editor、Layer Comps、智慧型濾鏡混合模式（2.434.0）

- **Gradient Editor**（Edit ▸ Gradient Editor…、Gradient 工具的漸層按鈕、Gradient 填充圖層的 Properties、向量形狀的 Object Properties）：12 種預設（Foreground to Background、Foreground to Transparent、Black / White、Spectrum、Transparent Rainbow、Chrome、Copper、Gold、Sunset、Violet / Orange、Blue / Red / Yellow、Transparent Stripes）+ 你自己的預設（**New** 儲存一個；右鍵點選將其刪除）。漸層條：**在其下方點選 = 新色標**（取該處顏色），**拖曳色標** = 移動，**將其向下拖離漸層條 = 刪除**（至少保留兩個）。選取的色標：**Colour**（或 "foreground" / "background"——跟隨色塊變化）、**Opacity**、**Location**；Delete、⇄ Reverse、Distribute evenly。之後 Gradient 工具 / Paint Bucket 使用 Colours：**Custom**；填充圖層或形狀會保留色標（形狀的 SVG 也會保留）。
- **Layer Comps**（Window ▸ Layer Comps，History / Actions 旁邊的 Comps 分頁）：**＋** 儲存圖層的狀態——名稱、套用的內容（Visibility、Position、Appearance = Layer Style / 不透明度 / 混合模式）和註釋；在某個圖層複合上點選 **▶** 即可套用（一個復原步驟），**◀ ▶** 切換上一個 / 下一個，**↻** 用目前圖層狀態更新選取的圖層複合，🗑 刪除；雙擊 = 開啟其選項。**Last Document State** 恢復之前的圖層狀態。每個文件保留各自的圖層複合。
- **智慧型濾鏡混合模式**：右鍵點選智慧型濾鏡（位於 Layers 中智慧型物件下方）= **Blending Options**：Mode（24 種：Normal、Dissolve、Darken、Multiply、Color Burn、Linear Burn、Lighten、Screen、Color Dodge、Linear Dodge、Overlay、Soft / Hard / Vivid / Linear / Pin Light、Difference、Exclusion、Subtract、Divide、Hue、Saturation、Color、Luminosity）+ Opacity；該行會顯示所用的模式。

### 影像編輯器與提示詞面板：Image 模式，生成的圖片放到畫布上（2.431.0）

2.549.0：**在影像編輯模式下，Generate 始終生成一個新圖層**。沒有選取範圍時，提示詞面板自身的 Generate 會使用在那裡選擇的風格（Krea 2……）執行，圖片作為新圖層進入；有選取範圍時，編輯器會填充選取範圍，結果同樣是新圖層。它不再直接繪製到所選圖層中。

2.550.0：**選取範圍會被無縫填充**，與 Krita AI 外掛的做法相同：提示詞面板的風格（Krea 2、FLUX.2 / FLUX 3 Klein 風格、Qwen……）執行它自己的節點圖，對選取範圍周圍的圖片進行編碼，並在選取範圍上加噪聲遮罩（再加上差分擴散以獲得柔和邊緣），因此新部分會延續原有內容，而不是一張新圖片。檢查點（checkpoint）風格（SDXL……）仍使用 SDXL inpaint 匯出；風格內建的修復工作流程仍然優先。Refine（一個強度值）的工作方式相同。

2.551.0，更接近 Krita AI 外掛：選取範圍周圍傳送的區域更大（每邊至少為選取範圍尺寸的 3/4，寬約 512 px），選取範圍在編碼前會**預先填充周圍的顏色**，遮罩會被擴展並**模糊**（柔和邊緣），而未經修復訓練的風格（Krea 2、Klein、Qwen……）會從略低於完全噪聲處（0.9）開始，使新部分保持周圍的光照和顏色。若要獲得最佳填充效果，請使用真正的修復模型——FLUX Fill inpaint，或 SDXL inpaint 匯出（Krita 外掛同樣使用修復模型：SDXL 用 Fooocus inpaint，SD 1.5 用 ControlNet inpaint，以及 Flux Fill）。

2.552.0，源自 Krita AI 外掛自身的程式碼：
- 選取範圍中的 **Generate** 再次以**完全強度**執行（與 Krita 對未經修復訓練的模型的做法相同——模型繪製時保留選取範圍周圍的圖片，因此新部分是畫進其中的）。**Remove** 從選取範圍周圍的顏色開始，以 0.9 執行。
- 小選取範圍的區域會**以更大尺寸渲染**（至少約 0.75 百萬像素，最多 4 倍）再縮放回來——以 1 百萬像素訓練的模型處理 512 px 的區域時，結果會很模糊。
- 遮罩的柔和邊緣**隨選取範圍一起增大**：羽化值為選取範圍對角線的 10 %（至少 32 px），並擴展 4 px + 該值的一半，與 Krita 相同。Refine 使用的值較小（乘以其強度）。
- 當模型保留了選取範圍周圍的圖片時，結果會**稍微越過選取範圍邊緣進行融合**（不會有可見的分界線），並與周圍圖片**進行顏色匹配**（Krita 的 Color Match）。
- 選取範圍內的 **Edit**（Qwen Image Edit、FLUX Kontext、FLUX.2 / FLUX 3 Klein edit）現在**只改變選取範圍**：圖片既是模型的參考圖，也是它在同一柔和遮罩下的起點，因此選取範圍周圍的一切都保持原樣。

2.553.0——✨ AI 面板中的 **👁 fill with the edit model (sees the picture)**（用編輯模型填充，能看到圖片），預設開啟，除非你將其關閉：選取範圍中的 Generate、Remove 和 New background 透過**編輯模型**執行（如果提示詞面板的風格能夠編輯——FLUX.2 / FLUX 3 Klein、Qwen Image Edit——則使用該風格，否則使用面板的 Edit 模型）。未經填充訓練的模型（Krea 2……）看不到選取範圍周圍的圖片，會在其中畫出一張自己的圖片；編輯模型會檢視整個區域，因此新部分能融入場景。與 Krita AI 外掛相同，選取範圍會被塗成**綠色**，並告訴模型 "Fill the green spaces according to the image."，後面跟上你的提示詞（Remove："Remove the object."，New background："Replace the background while keeping the main subject."），並且只有選取範圍會改變。真正的修復風格（FLUX Fill inpaint、SDXL inpaint 匯出）始終按原樣使用。
- 有選取範圍時，**▾ Edit** **只改變選取範圍**（在其上方新增圖層）。沒有選取範圍時，它編輯所選圖層——帶有透明部分的圖層會保持其輪廓：只有它自己的像素會改變，周圍不會新增任何內容。
- 2.554.0：無法看到選取範圍周圍的風格（Krea 2……，在 👁 關閉或沒有編輯模型時）會把**選取範圍自身的邊框範圍**作為整張圖片（外加少量供柔和邊緣使用的空間），以模型的尺寸渲染後再縮放回來——因此它畫出的內容與選取範圍的大小和位置一致，而不是將一張更大的圖片裁小。


**2.555.0——Krita AI 外掛的填充方式，按模型系列區分。** 只要 ComfyUI 中有相應元件，每個系列都會使用 Krita 外掛所用的輔助元件——一個*經過訓練*專門用於填充的部件：
- **SDXL / Pony**：Fooocus inpaint 補丁（由風格**自己的**檢查點進行填充——Pony 仍然是 Pony）。
- **Illustrious / NoobAI**：NoobAI inpainting ControlNet（否則使用 Fooocus 補丁）。
- **SD 1.5**：SD 1.5 inpaint ControlNet。**FLUX.1**：Alimama FLUX inpainting ControlNet。
- **Remove**（任何風格）：先由 MAT / LaMa 移除物體。
- **FLUX.2 / FLUX 3 Klein、Qwen、Krea 2**：沒有輔助元件——👁 開啟時透過編輯模型填充（與以前相同）。同樣與 Krita 一致的還有：模型看到的區域（選取範圍先按其羽化值外擴，再按 max(圖片長邊 / 16, 選取範圍尺寸的一半) 外擴，至少 512 px），以及 Generate 的 **fill** 行——**Add content**（預設：在該處放入新內容；選取範圍以灰色開始，使用編輯模型時提示為 "Add the object to the scene."）或 **Fill**（圖片在該處延續；選取範圍以原有內容的模糊版本開始）。橫跨圖片一整條邊的選取範圍會擴展圖片。
**需要安裝的內容**（安裝精靈會列出兩者）：節點套件 **comfyui-inpaint-nodes**（在安裝設定的節點清單中），以及安裝設定模型清單中 **Selection fill - the Krita AI way** 組裡的：Fooocus inpaint head + patch（models/inpaint）、MAT（models/inpaint），以及你需要的 inpainting ControlNet（models/controlnet）。如果 Krita 外掛已經下載了它們，請在 Settings → ComfyUI → Folders 中新增 Krita 的 ComfyUI 模型資料夾，而無需重新下載。

**2.556.0——⏳ Pending：想排多少就排多少。** ✨ Generate、Edit、Refine、Fill、Remove、New background 和 Compose 不再等待上一個完成——再按一次（換一個選取範圍、一個提示詞、一個圖層），新的渲染就會排在其他渲染後面。每個結果都會進入 **⏳ Pending**，這是一個浮動在影像編輯器*內部*的小面板（拖曳其標題即可移動；✕ 隱藏它，✨ AI 面板的 **⏳ Pending** 按鈕可再次顯示它，每次新的渲染也會讓它重新出現）。每張卡片顯示疊加在其生成區域上的結果（點選圖片可在畫布上預覽）、它是什麼操作，以及它屬於哪個圖層：
- **✔ Apply** 將其放到新圖層上，**位於你發出請求時所選圖層的上方**——放在每個圖層各自對應的一個組內，組名為 **"✨ changes: <layer>"**，首次使用時建立，之後重複使用（每次 Apply 是一個復原步驟）。
- **🗑 Delete** 將其丟棄。標題列中的 **✔ all** / **🗑 all** 作用於所有卡片。

**每種 ✨ 模式中的 References 面板（2.556.0）。** 在提示詞中用參考圖在面板中的編號來指稱它——"picture 1"、"image 2"、"ref 3"——它就會隨請求一起傳送：
- **Edit**：最多兩張圖片（↳ 參考圖下拉式選單仍與以前一樣工作：那張圖片是 "Picture 2"）。
- **Generate / Fill / Remove / New background / Refine**：執行會透過**編輯模型**進行（只有編輯模型能接收圖片），選取範圍會利用這些圖片來填充，編號也會為模型重寫（面板中的 "picture 3" 變為模型的 "Picture 2"）。沒有編輯模型時，會改為把圖片的描述新增到提示詞中。
- **Compose**：寫 "ref 1" / "reference 2"（在 Compose 中，"picture N" 指第 N 個選取的圖層）；該圖片會新增在選取的圖層之後（總共三張圖片）。同時修復：2.552.0-2.555.0 中編輯器的設定（遮罩尺寸、👁 fill with the edit model、Add content / Fill）在傳送到伺服器的途中被丟棄——現在可以正確送達。

2.557.0：Krita 方式填充所需的檔案可從 **Settings ▸ Add-ons ▸ AI fill models** 下載（勾選後點選 ⤓ Download ticked）。

- 當影像編輯器處於**開啟**狀態（顯示在螢幕上，而非摺疊）時，提示詞面板的 Generate 模式為 **🖼 Image**，旁邊有一個 **→ ▦ canvas** 標籤，說明圖片的去向。編輯器關閉時，會恢復之前的模式（編輯器開啟期間選擇的模式會被保留）。切換模式的是編輯器的開啟 / 關閉；專案儲存的是你所選的模式，而不是編輯器的 Image 模式。
- **編輯器開啟期間，Generate 生成的每張圖片都會落到畫布上**：作為最前面文件中的一個新圖層，以提示詞命名（✨ a red fox …），居中放置——比畫布大時會縮小。一次生成多張圖片的渲染會為每張圖片各建一個圖層。沒有開啟文件 = 第一張圖片會作為新文件開啟。每個圖層是一個復原步驟；相簿照常保留這些圖片。編輯器關閉時不會新增任何內容。

### 文件（浮動視窗 / 分頁）、調色盤、⊠ 透明、自動填充（2.430.0）

- **每次 New / Open 都會生成一個獨立的文件**（File ▸ New、Open、Open PDF、PSD、拖入的圖片、在空編輯器中貼上）。第一個文件停靠——它填滿畫布區域，上方有一個**分頁**；之後的文件在各自的**浮動視窗**中開啟（層疊排列）——即畫布區域上方的「模組化面板」。Window ▸ Arrange ▸ Open Documents as Tabs 會讓每個新文件改為以分頁開啟。
- 每個文件都保留自己的圖層、復原 / 重做（History）、選取範圍、路徑、通道、縮放和 PDF 的頁面；最前面的文件就是工具、面板和 ✨ AI 所作用的文件。
- **分頁**：點選 = 移到最前；✕ 或滑鼠中鍵點選 = 關閉；● = 有未儲存的更改；將分頁拖離標籤列 = 在該處浮動。
- **視窗**：拖曳標題列（拖放到標籤列上 = 作為分頁停靠；雙擊標題列也會停靠），⇲ = 停靠，✕ = 關閉，拖曳右下角可調整大小。位於後面的視窗顯示其離開時的畫面——點選即可將其移到最前（畫布會移入其中）。
- File ▸ **Close**（Ctrl+W）/ **Close All**（Alt+Ctrl+W）：有未儲存的更改時會詢問——💾 Save and close / Close without saving / Cancel。Window ▸ Arrange：Consolidate All to Tabs、Float in Window、Float All in Windows、Tile、Cascade、**Next / Previous Document**（Ctrl+Tab / Shift+Ctrl+Tab）。File ▸ Automate ▸ Batch 會在每張圖片處理完後將其關閉（你原本開啟的文件保持開啟）。
- **調色盤**：編輯器右邊緣的豎條——先是 ⊠，然後是各種顏色；▲ ▼ / 滑鼠滾輪可捲動；▾ 選擇調色盤（Default、Greys、Your Swatches、Document Colours）；Window ▸ Color Palette 顯示 / 隱藏它。在曲線、形狀或文字上（所有選取的物件——在 Layers 中 Ctrl+點選——或活動物件）：**點選 = 設定其填充，右鍵點選 = 設定其輪廓**，⊠ = 無——一個復原步驟。在其他任何物件上：點選 = 前景色，右鍵點選 = 背景色。
- **⊠ transparent**（透明，位於調色盤和 Swatches 面板中）：作為前景色時，畫筆繪製透明，Paint Bucket 和 Edit ▸ Fill 會清除像素；該色塊以一條紅線表示。
- **自動填充**：用 Bézier、Pen（F5）、Freehand、Polyline、3-point curve、B-spline 或 Curvature 工具閉合的曲線、新的 F6 形狀、Pen / Shape 工具形狀——會立即用**最後選取的顏色**填充（來自調色盤、色塊、拾色器、吸管）。最後選取的是 ⊠ = 不填充。曲線工具的屬性列：▨ = 自動填充開 / 關（預設開啟）。

### 面板：Transform、Shaping、Align and Distribute、Object Properties（2.429.0）

Window ▸ Dockers 會開啟它們自己的一個面板組（✕ 關閉）。它們作用於**選取的**圖層（在 Layers 中 Ctrl+點選可選取多個）或活動圖層。

- **Transform**（Alt+F7）：Position（x / y，Relative position）、Rotate（角度，+ = 逆時針）、Scale & Mirror（%，等比，⇆ ⇅）、Size（w / h，等比）、Skew（x° / y°）——以邊框 9 個點中的一個為基準（Relative center），**Copies**（每個副本多走一步——30 px 移動的 2 個副本 = 一排三個）。向量形狀 / 線條 / 路徑精確變換（僅移動 / 縮放時，即時（live）形狀仍保持即時可編輯），像素圖層重新繪製，文字會移動並調整大小。每次 Apply 是一個復原步驟。
- **Shaping**：Weld、Trim、Intersect、Simplify、Front Minus Back、Back Minus Front、Boundary——作用於選取的向量形狀；活動形狀為目標，結果採用其外觀；Leave original source / target。
- **Align and Distribute**（Shift+Ctrl+A）：將左 / 中心 / 右 / 頂 / 中間 / 底對齊到活動物件、第一個選取的物件、選取範圍邊框、頁面邊緣或頁面中心；按左 / 中心 / 右 / 間距、頂 / 中心 / 底 / 間距分佈——在選取範圍或頁面範圍內。
- **Object Properties**（Alt+Enter）：活動向量形狀的填充（無、均勻、帶兩種顏色和一個角度的線性 / 徑向漸層——在 SVG 中也會保留）、輪廓（寬度、顏色、樣式，F12）、透明度（不透明度、混合模式）。


### 繪圖工具：形狀（F6）、Artistic Media、尺寸標註和連線線（F8）（2.428.0）

它們繪製的所有內容都是向量線條圖層——輪廓筆（F12）、填充、Shape 工具（F10）和 Convert to Curves（Ctrl+Q）對它們都適用。

- **F6**（再按 = 下一個）：**Rectangle**（每個角單獨設定圓角半徑——🔒 同時更改四個角——以及 Round / Scallop / Chamfer 角）、**3-Point Rectangle**（以任意角度拖出一條邊，鬆開，再點選確定高度）、**Ellipse**（Ellipse / Pie / Arc，帶起始和結束角度）、**3-Point Ellipse**、**Polygon**（邊數）、**Star**（角數、銳度）、**Complex Star**（角數、銳度——中間鏤空）、**Spiral**（圈數、對稱 / 對數、擴展）、**Graph Paper**（欄 x 列）、**Common Shapes**（基本形狀、箭頭、流程圖、橫幅、標註）。Ctrl = 正方形 / 圓形，Shift = 從中心繪製。它們保持**即時可編輯**：選取一個，屬性列即可修改它，直到用 F10 編輯節點或用 Ctrl+Q 轉換為曲線為止。
- **Artistic Media**（在 F5 中）：繪製一筆，它就會變成填充形狀——**Preset**（Taper、Teardrop、Flare、Uniform）及其寬度，**Calligraphic**（筆尖寬度和角度），**Pressure**（數位筆的壓感；使用滑鼠時，越慢越寬），**Sprayer**（沿筆觸分佈星星、圓點、葉子、心形、氣泡或彩紙屑——大小、間距）。它同樣保持即時可編輯。
- **F8**（再按 = 下一個）：**Parallel Dimension**、**Horizontal / Vertical Dimension**（點選兩個點，然後點選尺寸線的位置——上 / 下 = 水平，旁邊 = 垂直）、**Angular Dimension**（頂點、兩條邊上各一個點、圓弧的位置）、**3-Point Callout**（指向點、拐點、終點——文字來自屬性列）。單位 px / mm / cm / in（按指定 dpi）、小數位、文字大小。**Connector**（Straight / Right-angle / Rounded right-angle）：從一個物件拖到另一個物件——它會吸附到它們各邊的中點（或它們的中心），並且**在物件移動時跟隨**。

### Actions 和 Batch（2.427.0）

**Actions** 分頁位於 History 旁邊（Window ▸ Actions，Alt+F9）。組（📁）包含動作（▶），動作包含步驟。

- **錄製**：選取一個動作（或 ＋ New Action——立即開始錄製），然後開始操作：每個選單命令、快捷鍵或命令面板命令都是一個步驟，並帶有你按下 OK 時其所開啟對話方塊的設定（Cancel = 不記錄步驟）；濾鏡和調整帶有它們的設定；Layers 面板的按鈕、混合模式、不透明度和填充也會記錄。■ 停止。手動繪畫和手動選擇不會被錄製——Select 選單命令則會被錄製。
- **播放**：▶ 播放選取的動作，或從選取的步驟開始播放。☑ 關閉某個步驟；▢（對話方塊開關）讓步驟停在其對話方塊中以便你修改（OK 繼續，Cancel 停止動作）。無法執行的步驟（沒有圖層、沒有選取範圍）會停止動作，並說明是哪一步以及原因。
- **編輯**：▲ ▼ 移動，🗑 刪除；雙擊步驟可重新錄製其對話方塊的設定，雙擊動作可設定其名稱和功能鍵（F2 … Shift+F12——編輯器未使用的按鍵），雙擊組可重新命名。☰：Insert Stop（一條訊息，可帶或不帶 Continue）、Insert Menu Item、Duplicate、Button Mode（每個動作一個按鈕）、Load / Save Actions（.json——無法讀取 .atn 檔案）、Reset Actions、Batch。內建一個 **Default Actions** 組（Vignette、Sepia Toning、Black & White Punch、Soft Glow、Sharpen + Flatten）。動作隨應用程式一起儲存。
- **File ▸ Automate: Batch…** 對多張圖片播放一個動作：選取檔案或資料夾，設定出錯時的處理方式（停止，或記錄後繼續）、結果的去向（專案的 batch 資料夾、影像相簿、逐個下載，或不儲存）、資料夾名稱、檔名字尾，以及 PNG 或 JPEG。執行時會顯示進度框（■ Stop），結束時給出報告。

### Character 和 Paragraph 面板、段落文字、文字樣式（2.426.0）

Color / Swatches 旁邊的兩個分頁（Window ▸ Character，Window ▸ Paragraph）。它們編輯活動文字圖層——每次更改是一個復原步驟——或者在未選取文字圖層時，編輯下一段文字的初始設定。

- **Character**：字型和樣式（Regular / Bold / Italic / Bold Italic）、大小、行距、字距調整（Metrics / 0）、字元間距、垂直和水平縮放、基線偏移、顏色；Faux Bold、Faux Italic、All Caps、Small Caps、Superscript、Subscript、Underline、Strikethrough。
- **Paragraph**：左對齊 / 居中 / 右對齊，Justify last left / centred / right，Justify all；左縮排、右縮排和首行縮排；段前和段後間距；Hyphenate。
- **段落文字**：用 Type 工具（T）拖曳繪製一個文字方塊——文字在框內自動換行（點選一下仍然建立點文字）。兩端對齊的行需要文字方塊。放不下的文字會被隱藏，文字方塊的角上顯示 ⊞（Paragraph 面板也會提示——用 W / H 將文字方塊調大）。Layer ▸ Type：Convert to Paragraph Text / Convert to Point Text（放不下的行會被捨棄）。Image Size 也會縮放文字方塊和縮排。
- **Character Styles / Paragraph Styles**（兩個面板中的清單）：＋ 根據文字建立樣式，點選即可套用（文字會記住該樣式），名稱後的 + = 此後文字被修改過（⌫ Clear Override 恢復樣式），⟲ Redefine 根據文字更新該樣式以及所有使用它的文字，🗑 刪除，雙擊重新命名。樣式隨應用程式一起儲存。

### 向量線條：Bézier、曲線工具和 Shape 工具（2.425.0）

按鍵：**F5** 選取曲線工具（再按 F5 = 下一個），**F10** 為 Shape 工具，**F12** 為 Outline Pen，**Ctrl+Q** 為 Convert to Curves。每個曲線工具都繪製**向量線條**——一種在任何尺寸下都保持清晰、帶有輪廓筆的圖層——或者當你從活動線條的某個開放端點開始時，接著延續該線條。

- **Bézier**（F5）：點選 = 尖角節點（直線段），拖曳 = 平滑節點（曲線；拖曳時按 **C** 使其變為尖角節點，以便下一段可以轉向，按 **S** 恢復平滑）。Ctrl = 以 15° 為步進。點選第一個節點即可閉合；雙擊、按 Enter 或 Space = 完成；Esc 放棄正在繪製的線條。
- **Freehand**：拖曳 = 手繪線條（屬性列中有 Smoothing）；點選、再點選 = 直線。
- **2-Point Line**：從起點拖到終點。**Polyline**：點選 = 直線段，拖曳 = 一段手繪，雙擊結束。**3-Point Curve**：拖出弦，鬆開，再點選曲線彎曲經過的位置。**B-Spline**：點選控制點——曲線會平滑地跟隨它們，並且在 Shape 工具中仍保持為 B 樣條。**Node Pen**：會顯示下一段的 Bézier，並可在活動線條上點選新增 / 刪除節點。
- **屬性列**（所有曲線工具和 Shape 工具）：輪廓寬度、顏色、樣式（實線、虛線、點線、點劃線、長虛線、自訂）、起點和終點箭頭（箭頭、三角形、開放、半箭頭、圓形、方形、菱形、短橫）、閉合曲線的填充、✒ F12 和 ⇢（轉為路徑）。
- **Shape 工具**（F10）：點選 / Shift+點選 / 框選節點；拖曳節點、控制柄（尖角、平滑和對稱節點——分別為方形、圓形和菱形標記）或線段（使其彎曲）。雙擊線條 = 新增節點，雙擊節點 = 刪除節點；+ / - / Delete；C / S / Y = 尖角 / 平滑 / 對稱；方向鍵微移。屬性列：新增、刪除、連接兩個節點、斷開曲線、轉為直線、轉為曲線、節點類型、反轉方向、延長曲線以閉合、提取子路徑、自動閉合、減少節點（帶平滑度滑桿）、全選。它適用於任何形狀圖層和路徑；B 樣條會顯示其控制點。
- **Outline Pen**（F12，Layer 選單）：顏色、寬度、樣式 + 自訂虛線（以線寬為單位）、轉角和斜接限制、線端、位置（外部 / 居中 / 內部）、箭頭 + 大小 + 交換、填充、置於填充之後、隨物件縮放。沒有活動形狀圖層時，它設定之後繪製的線條的輪廓。
- **Convert to Curves**（Ctrl+Q）：矩形、橢圓、多邊形、直線或自訂形狀圖層會變成可編輯的向量線條（保留其外觀）。
- **向量線條 ⇄ 路徑**：Layer ▸ **Vector Line: Convert to Path…** 將線條作為儲存的路徑放入 Paths 面板，該路徑會記住其輪廓筆（可選擇是否保留圖層）；**Vector Line: Make from Path…**（或 Paths 面板的 〰）將路徑轉換為向量線條——由線條轉來的路徑會精確還原（名稱、寬度、虛線、箭頭），其他路徑則採用曲線工具的輪廓設定。每一步都可復原。
- **檔案**：Export Path as SVG… 會寫出帶有虛線和箭頭的向量線條（以及其輪廓筆，因此 Place SVG as Shape Layer… 能將其恢復為線條）。在 PSD 中，它是帶有 PSD 描邊（寬度、顏色、虛線、線端、轉角、位置）的向量形狀圖層；PSD 不支援箭頭，因此 bitGen 將輪廓筆儲存在檔案的 XMP 中，並在開啟該 PSD 時恢復它。

路徑方面：**Curvature Pen**（P，Shift+P 循環切換）——點選若干點，曲線會平滑地穿過它們；雙擊某點 = 在角點 / 平滑點之間切換；拖曳某點可移動它；Enter / Esc 結束。Pen 的 **Rubber Band** 選項會在你點選之前顯示下一段。**Path Selection**（A）可以將選取的元件**對齊**（左、中心、右、頂、中間、底——彼此對齊或對齊畫布），並將它們均勻**分佈**。

### PDF 檔案：開啟、編輯、儲存（2.424.0）

**File ▸ Open PDF…**（或將 .pdf 拖放到編輯器上）在編輯器中開啟 PDF；**File ▸ Open PDF from Project…** 開啟之前儲存過的 PDF。左側會出現 **Pages** 欄（✎ = 你修改過的頁面）；點選某頁即可開啟。頁面開啟後包含：

- 一個 **Background**——頁面的影像，*不含其文字*（文字是從頁面本身中去除的，而不是被塗蓋），以及
- **每行文字一個文字圖層**，位於原來的位置，並匹配其字型（襯線 / 無襯線 / 等寬、粗體、斜體）、大小、顏色和寬度。

可以用任何工具進行編輯——重新輸入一行文字、移動它、繪畫、新增圖層。在頁面之間切換時，每個頁面都會保留自己的圖層和復原記錄——即使你在中間開啟了另一張圖片也是如此（File ▸ PDF Pages 可重新顯示頁面列）。頁面列中的 dpi 設定尚未開啟的頁面在開啟時的清晰度（72 - 300，150）。

**💾 Save PDF**（File ▸ Save PDF）將修改過的頁面儲存回原檔案——即專案 pdf 資料夾中的副本——並下載它；**Save as New…** 建立一個新檔案。你未修改的頁面保持原樣（仍為向量）。修改過的頁面會變為影像，其上的文字作為**真正的 PDF 文字**（以匹配的粗細和樣式、顏色、大小和間距使用 Helvetica / Times / Courier）——可選擇、可搜尋。這些字型無法寫出的文字（其他文字系統、變形 / 3D / 路徑文字、圖層樣式、遮罩、混合模式）會改為繪製到影像中——儲存時會說明數量。pdf.js 和 pdf-lib 在頁面內完成讀取和寫入；不會向網際網路傳送任何內容。

## 音樂、分軌與人聲
<!-- en: music-stems-and-voices a43f7c3e6d68 -->

- **Music**（音樂）面板——根據歌詞和風格生成歌曲（透過 ComfyUI 使用 MiniMax Music3，或使用 YuE2），還可製作翻唱和樂譜。
- **Stems**（分軌）——將歌曲拆分為人聲 / 鼓 / 貝斯 / 其他（demucs）。
- **Voices**（聲音）——用一段短片段或一段波形區域複製聲音，然後用它朗讀文字（OmniVoice）；用 faster-whisper 轉寫語音；**🎤 Speak** 可透過語音向提示詞中輸入文字。

## 時間軸與匯出
<!-- en: timeline-and-export 2c6131409b6c -->

將片段、歌曲和圖片拖到 **Timeline**（時間軸）的圖層上，修剪並移動它們，新增轉場，然後將時間軸合成為一個影片，儲存在專案資料夾中。

## 選單列
<!-- en: the-menu-bar 13629d89a039 -->

標題列下方的那一排按鈕：**✚ New**（新增）、**📂** 載入、**💾** 儲存、**📷** 截圖、**⏺** 錄製、**🗑** 垃圾桶、**↺** 重設專案、**⚙** 設定、**⏏** 解除安裝所有已載入的模型。無論顯示或隱藏哪些面板，它都固定在原位。

## 路徑圖層（2.387.0）
<!-- en: path-layers-2-387-0 9d2969895366 -->

- **＋ Path layer** → 用 **⤳ (Shift+P)** 繪製路徑（點選新增點，拖曳以移動點，Alt-click 刪除點）→ 在其面板中寫明沿路徑移動的是什麼（動物 / 人物 / 車輛），以及 Start / Length（開始 / 時長）、起點 → 終點的大小、節奏和朝向 → **✨ Generate**。
- **In place + follow path**（原地生成 + 沿路徑移動）：綠幕上的圖片 → 原地生成影片（使用你的影片風格）→ 去除綠色 → 透過關鍵影格讓片段沿路徑移動（折返時鏡像翻轉），並按需循環。編輯後請點選 **⟲ Place again**。
- **Along the path (Wan ATI)**（沿路徑生成）：需要一個 Wan 2.1 風格和 `Wan2_1-I2V-ATI-14B_fp8_e4m3fn.safetensors`；由模型讓物件沿路徑行進；生成一個全畫幅的透明片段。
- **Cut out**（去背）：AI 去背（⬇ Install AI matte：venvs/matte，rembg + BiRefNet）或色度鍵。每個圖層都是透明的。

## 攝影機路徑：平搖、俯仰、滾轉、推拉、高度與 3D 路徑（2.399.0）
<!-- en: the-camera-path-pan-tilt-roll-dolly-height-a-3d-path-2-399-0 c382a19e2d40 -->

時間軸欄上的 **🎥 Camera** 會開啟 Camera 面板。與 Basic Settings 一樣，它是一個獨立的面板：可以讓它浮動，也可以把它停靠在另一個面板的旁邊或內部。畫布工具列中的 **🎥** 工具（**Shift+C**）會在位置標記處的畫面上繪製攝影機的取景框。

**製作運鏡**

- **Preset** ▸ **Apply**：推進、拉出、左 / 右橫移、升 / 降、平搖、俯仰、滾轉、環繞、搖臂升 / 降、變焦推近 / 拉遠、飛入。
- **Camera / Top / Side** 顯示攝影機看到的畫面，以及從上方和側面看到的路徑。在 Top 和 Side 檢視中，拖曳一個點可移動它，點選空白處可新增一個點。**＋ Point** 和 **✕ Point** 用於新增和刪除點。
- **▶** 和滑桿用於播放和拖曳瀏覽運鏡。時間軸上的標記會隨之移動。
- **Pan, Tilt, Roll, Height, Dolly, Lens**：該時刻的數值。修改其中任意一項都會在該處寫入一個 **◆ key**（關鍵影格），攝影機會在關鍵影格之間平滑移動。**◆ Key**、**✕ Key** 和 **◀ ▶** 用於新增、刪除關鍵影格以及在關鍵影格之間跳轉。
- **Aim**（朝向）：正前方、對準畫面中心（環繞時始終朝向內側），或沿路徑方向。此外還有 **Ease**（緩動）、**Length**（**= Seconds** 與 Basic Settings 保持一致）和 **From**（在時間軸上的起始位置）。
- **在畫布上使用 🎥 工具時**：拖曳可平搖和俯仰，Alt+drag 可滾轉，Shift+drag 可改變高度，滾輪可推拉，Shift+wheel 可變焦。每項操作都會在標記處寫入一個關鍵影格。

**告知影片模型**

勾選 **Use in Generate** 後，提示詞面板的 Generate 會把攝影機資訊一併傳遞。這三個模型都不支援任意的 3D 攝影機路徑，因此每個模型只會得到它能遵循的資訊：

- **MiniMax H3** 會得到專門的攝影機描述句，例如 "The camera pushes in with large amplitude at slow speed."。它**每個鏡頭只能執行一種運鏡**，因此只會被告知主要的運鏡。
- **Wan** 會以文字形式得到運鏡描述。如果 ComfyUI 中有 **Fun Camera** 模型（`wan2.2_fun_camera_high/low_noise_14B`，或 Wan 2.1 Fun Camera 模型），且參考圖面板中有圖片，它還會得到該模型的運鏡：Zoom In/Out、Pan Left/Right/Up/Down，或順時針 / 逆時針滾轉。
- **LTX** 會以文字形式得到運鏡描述。如果 ComfyUI 的 loras 中有對應的 **LTX-2 camera-control LoRA**，它還會得到該 LoRA：推進、拉出、左移或右移（dolly in / out / left / right），搖臂上升或下降（jib up / down），或靜止（static）。例如，`ltx-2-19b-lora-camera-control-dolly-in.safetensors` 來自 `Lightricks/LTX-2-19b-LoRA-Camera-Control-Dolly-In`。

面板中的 **What the models are told** 會顯示以上所有內容，以及 ComfyUI 已安裝了哪些內容。

**精確路徑（引導影片）**

1. **⟳ Use picture** 會取第一張參考圖，或位置標記處的時間軸畫布。它會儲存在 Assets（素材）中。
2. **◐ Depth** 透過 ComfyUI 使用 Depth Anything V2 生成其深度圖。這需要 comfyui_controlnet_aux。**Relief** 用於設定近處部分的突出程度。
3. **🎬 Make guide** 讓圖片沿路徑飛行，並將兩個影片儲存到 Assets：`camguide_<id>_rgb.mp4`（攝影機看到的畫面）和 `_depth.mp4`（其深度）。
4. 勾選 **Exact path**。之後 Generate 也會發送引導影片：
   - **MiniMax H3**：RGB 引導影片會成為參考影片，提示詞會要求遵循其攝影機運動。這僅在 References 渲染中有效（First / Last 渲染不接受影片），並且屬於**實驗性**功能。
   - **Wan**：深度引導影片會成為 **VACE** 的控制影片，並以第一張圖片作為其參考圖。這需要一個 VACE 模型。
   - **LTX**：深度引導影片會透過 **style-transfer** 模式作為深度引導使用，並以第一張圖片作為首幀。

如果你更改了路徑或圖片，引導影片會被標記為 **⚠**，在你重新生成它之前，Generate 不會使用它。

## 用 SeedVR2 放大影片；佇列中的執行卡片（2.400.0，⏫ Enhance 2.401.0）
<!-- en: upscaling-a-video-with-seedvr2-the-queue-s-running-card-2-400-0-enhance-2-401-0 bcd5b6c4e576 -->

預覽欄上的 **⏫ SeedVR2** 會使用 ComfyUI 內建的 SeedVR2 節點，放大你正在觀看的影片（相簿中的影片、Video 素材或匯出的影片）：

- **Size**（尺寸）：短邊（720p、1080p、1440p、4K，保持長寬比）或倍數（×2、×3、×4）。開始之前，面板會顯示結果的尺寸。
- **Colour match**（顏色匹配）：lab（最忠實）、wavelet、adain 或 none。
- **Temporal split**（時間分段）：auto 會把長片段切成適合顯示卡空閒顯示記憶體的若干段，處理後再融合回去；也可以使用固定的分段長度；或者關閉。
- **Model**（模型）：*best available* 會在 ComfyUI 中有 `seedvr2_7b_sharp_fp16.safetensors` 時使用它，否則使用其他 SeedVR2 7B 模型，再否則使用 3B 模型。**Setup → Models → Upscaling** 可下載它（16.5 GB）、較小的 3B int8 模型以及 SeedVR2 VAE。
- **Denoise**（去噪）：1 表示完全修復；數值越低，保留的原始紋理越多。

**⏫ Upscale** 會將其作為獨立任務加入佇列。結果會保留原影片的聲音，並以 `<name>_seedvr2_<size>p.mp4` 的名稱出現在相簿中。你的選擇會隨專案儲存。

**用於場景板**：在 StoryBoard 的 ⚙ 中，將 **Upscaler** 設為 **SeedVR2 (video)**。之後，場景的 ⏫ 會把它的鏡次（如有無損母版則使用母版）按 ⚙ 中的 **Upscale resolution** 送入 SeedVR2 處理，並存為該場景的放大鏡次。這適用於任何影片風格。勾選 **Upscale every render** 後，每個鏡次一生成就會被加入 SeedVR2 佇列。

提示詞面板中的 **⏫ Enhance** 會為**所選影片**開啟同一個面板：即你最後在相簿、Video 素材或參考圖面板中點選的那個影片。該縮圖會出現虛線圈，按鈕的工具提示會顯示影片名稱及其位置。如果未選擇任何影片，面板會提示你點選一個。面板開啟時點選另一個影片，面板就會切換到該影片。（LLM 提示詞改寫已移至提示詞框中的 **Enter**。）

**佇列面板**會將正在執行的渲染顯示為**一張卡片**：包括其狀態和 ⏸ ▲ ▼ ✕ 按鈕、提示詞、任務 id、模式和尺寸、進度列，以及 "chunk 1/2 · step 3 of 8 · 1:11 · 19%"。點選卡片可在主控台和預覽中追蹤它。下方的任務清單不再重複顯示它。

## Basic Settings 中的影片風格（2.401.0）
<!-- en: the-video-style-in-basic-settings-2-401-0 c2759a4256d1 -->

Basic Settings 的頂部會顯示提示詞面板的 Video 下拉式選單所選的影片風格。在這裡選擇另一個風格，兩處會同時更改。卡片顯示：

- 風格的類型（MiniMax H3、Wan 2.1 / 2.2、LTX 2.5）及其工作流程；
- **Model**，每個階段一行（Wan 2.2：high noise 和 low noise），以及實際用於渲染的模型。模型為空表示使用工作流程內建的模型，卡片會顯示該檔名。Wan 會從 ComfyUI 列出的檔案中自行選擇所用檔案；
- 每個階段的步數、cfg 和載入精度，以及文字編碼器、VAE、LoRA 和負面提示詞。

在某一行中選擇另一個模型，它會**儲存到風格中**，下一次渲染就會使用它。📁 可瀏覽 ComfyUI 的模型資料夾。**⚙** 會開啟 Settings → Video 中的完整風格編輯器。

## 狀態列的面板按鈕、3D 工具列（2.386.0）
<!-- en: the-statusbar-s-docker-buttons-the-3d-toolbar-2-386-0 0e088bed13e3 -->

- 每個面板都有一個狀態列按鈕（現在 Stems、SFX 和 Chat 也有了）。**面板顯示在螢幕上時，按鈕會亮起**（無論展開還是摺疊）；點選一次隱藏面板，再點選一次重新顯示。
- 選擇一個 3D 圖層後，預覽畫布頂部會出現一個 **3D 工具列**——控制項（✥ ⟲ ⤡ ○）、🧲 15° 吸附、檢視（前 / 左 / 右 / 頂 / 底 / 後，⟲0）、⟳ 旋轉、⤢ 重設深度 + 縮放、🎨 材質預設、☀ 影棚燈光 + 亮度、＋💡 新增燈光、◇ Key、🟧 Blender、⚙、🧊 Bake。

## Tools & Properties、關鍵影格、3D 控制項、燈光、材質、Blender（2.385.0）
<!-- en: tools-properties-keyframes-3d-widgets-lights-materials-blender-2-385-0 fbae13ff3b96 -->

- **🧰 Tools & Properties** 浮動在獨立的視窗中：按 **1** 可顯示 / 隱藏它（也可點選時間軸欄中的 🧰，或其標題列上的 ✕）；拖曳標題列可移動它，拖曳角落可調整大小。
- **◆ 關鍵影格**可沿其所在片段拖曳（不能越過相鄰的關鍵影格：第一個 ◆ 的範圍為 0 .. 下一個 − 1 影格，最後一個 ◆ 的範圍為上一個 + 1 影格 .. 片段末尾）。右鍵點選 / Alt-click / Delete 可刪除一個關鍵影格。
- **3D 控制項**（使用 Move 工具，且已選擇 3D 圖層）：**G** 移動（X / Y 橫向，藍色 Z 朝向攝影機），**R** 旋轉（球體 = 自由翻轉，圓環 = 僅 X / Y，外圈 = 滾轉），**S** 縮放（各自的 X / Y / Z，中心 = 等比縮放）。再次按同一個鍵可隱藏控制項。
- **🎨 Material**（材質）：預設（金、鉻、玻璃、霓虹 …），或顏色 / 金屬度 / 粗糙度 / 發光 / 不透明度 / 清漆層 / 玻璃 / 線框 / 平面著色 / 紋理；模型的每個部件都可以保留自己的材質、使用圖層的材質或使用某個預設。
- **💡 Lights**（燈光）：影棚燈光開 / 關 + 亮度，以及 ＋ Point / Spot / Sun / Ambient / Sky，可設定顏色、亮度滑桿和位置。
- **🟧 Blender**：在 Blender 中安裝 **bitgen-blender-addon** zip 檔（Preferences → Add-ons → Install from Disk）→ 側邊欄（N）→ bitGen：Send to bitGen（glTF，"Add as 3D layer"）、Live link（儲存時重新發送）、Get from bitGen。3D 圖層的 **Render with: Blender** 會在 Blender 中（Eevee / Cycles）渲染該圖層以供合成；⚙ 用於設定 Blender 的路徑。（2.402.0）**Render scene → bitGen** 會透過 Blender 佈局中的攝影機渲染整個場景，並由 LTX 2.3 + 3DREAL 將其變為照片級真實效果——參見 *LTX 2.3 and 3D render → real*。

## 種子與渲染詳情
<!-- en: seeds-and-render-details 26e3ee174b3b -->

- **Basic Settings → Seed**：-1 = 每次渲染使用一個隨機種子；輸入一個數字即使用該種子；**🎲** = 重新隨機；**♻** = 上次使用的種子（顯示在輸入框下方）。
- **Queue**（佇列）：正在執行的任務會顯示 *step n of total · time*。已完成的任務帶有 **ⓘ**——顯示其種子、CFG、步數、取樣器、模型、LoRA、尺寸、渲染時間和提示詞；**♻ Use** 會把它的種子填入 Basic Settings。
- **預覽對話方塊**（點選相簿中的圖片或片段）：在右側窗格中顯示相同的詳情（**ⓘ** 可隱藏該窗格）。
- **StoryBoard ⚙ → Seed**：*Random for each scene* 或 *Same seed for every scene*（使用種子框；留空 = 上次使用的種子）；**♻** 會將上次使用的種子設為種子。
- **每張場景卡片**都有自己的種子框（優先於 ⚙ 中的設定）；旁邊的 **♻** 會複用其上一個鏡次所用的種子。場景渲染時會顯示 *running step n of total*、進度列和時間；渲染完成的場景會顯示其渲染時間和種子。
- 📌 圖釘在面板被固定之前是亮的，固定後會變暗。**在已固定的面板上點選 📌** 會把它的最大高度重設為 0：將它拖到任意高度，然後再次點選 **📌** 固定該高度。已固定的面板仍可透過其邊緣縮小，但永遠不會高於固定的高度。已固定的影片面板會保持其高度（在取消固定之前，它不再佔用剩餘空間）。

## 位置標記、圖層顏色
<!-- en: the-position-marker-layer-colours fe85b9bfd22a -->

- **拖曳紅色標記**（其頭部或豎線）可在時間軸上隨意移動：正在播放的預覽會從你放下的位置繼續播放；停止狀態下，預覽會顯示該影格。在標尺或軌道上**雙擊某個時間點**可跳轉到那裡並從那裡開始播放。播放 / 暫停 / 停止按鈕位於預覽畫布下方。
- 每個圖層都有自己的顏色；所選圖層帶有輪廓。F/L 和 REF 標記行會隨縮放而變高。

## 圖層名稱
<!-- en: layer-names 0c6556f73d05 -->

在時間軸畫布的 Layers 清單中雙擊圖層名稱並輸入（Enter 確認，Esc 取消），或對所選圖層按 F2，或使用其屬性中的 **Name** 框。點選時間軸軌道上的名稱也可以。

## 面板尺寸、📌 圖釘與最大化
<!-- en: dock-sizes-pins-and-maximize ff24cc607a0b -->

- 每個面板都會記住它是開啟、關閉還是隱藏，以及它的高度和寬度、📌 圖釘狀態和是否最大化——這些資訊儲存在應用程式旁邊的 `docker_status.json` 中，所有專案使用相同的佈局，並在其他任何內容出現之前載入。
- **📌**（每個面板標題列中的第一個按鈕）會固定面板目前的高度：它可以被拖小，但不能拖高。再次點選即可取消固定。在側邊面板上，圖釘固定的是寬度。
- 開啟一個面板時，其他已固定的面板會恢復到各自的固定高度；所需的空間從未固定的面板中取得。
- **⛶ Maximize** 會讓一個面板佔據其他已開啟面板留下的全部空間——這些面板保持開啟，並保持各自的高度（或其固定高度）。所有分隔條仍然可用。按 **Esc** 或 🗗 可還原。

## Docker configs：為每組面板儲存的佈局（2.392.0）
<!-- en: docker-configs-a-saved-layout-for-each-set-of-dockers-2-392-0 b3f8789eb267 -->

**⊞**（Docker configs）是選單列右端的圖示按鈕。它讓你的面板佈局保持整齊，使你一起開啟的面板不會被擠壓或被截斷。

1. 開啟你一起使用的那些面板，例如 Music、Prompt chat 和 Prompt。按你喜歡的方式調整它們的大小。
2. 點選 **⊞ Docker layout ▸ 💾 Save layout**。每個面板的尺寸都會儲存在 **docker.cfg**（安裝資料夾中的一個檔案）中——並且（2.432.0）還會儲存**哪些面板顯示在螢幕上**（開啟、摺疊為標題列或隱藏）、顯示了哪些**側邊面板**（左側面板、References、Assets、佇列、相簿），以及**浮動面板的位置和尺寸**（Basic Settings、LLM tokens、⊖ 負面提示詞、🎥 攝影機、浮動提示詞），還有時間軸畫布旁邊的 🎤 Karaoke / 🧰 Tools 的狀態（停靠在左側 / 右側或浮動、是否顯示、各列的寬度）。
3. 此後，只要恰好是這幾個面板同時開啟，它們就會恢復為這些尺寸。

開啟第四個面板時，會查詢為這四個面板儲存的佈局。如果沒有，面板會保持原樣，你可以調整它們的大小後再次儲存。關閉第四個面板會恢復那三個面板的佈局。

**不同的螢幕。** 每組面板可以為每種視窗尺寸各儲存一個佈局（最多六個）。在你未儲存過佈局的螢幕上，會使用最接近的已儲存佈局並使其適應視窗，確保每個面板都保持可見。

彈出視窗中列出了所有已儲存的佈局：

- **Load** 會以儲存的尺寸開啟那組面板；儲存時處於摺疊狀態的面板會恢復為摺疊狀態，側邊面板和浮動面板會恢復到儲存時的樣子。
- **✕** 會刪除一個已儲存的佈局。
- **Load saved layouts automatically** 用於關閉或開啟自動載入。

當已為目前開啟的面板儲存了佈局時，該按鈕會醒目顯示。

## ▾ 提示詞面板使用哪張圖片：參考圖還是圖層，以及 🧩 Compose（2.543.0）
<!-- en: which-picture-the-prompt-docker-works-from-references-or-layers-and-compose-2-54 7ff6926c1f3c -->

提示詞面板的下拉式選單（🖼 Image 模式）現在會根據你的工作位置來選擇圖片。影像編輯器中的 ✨ AI 面板不再有自己的 Generate / Refine / Edit / Background / Compose 分頁，改由該下拉式選單進行選擇。下拉式選單旁邊的標籤會說明按鈕將使用什麼。

**影像編輯器最小化或關閉時**，下拉式選單中有 Generate、Edit、Refine、Replace background 和 🧩 Compose，它們使用 **References 面板中的圖片**（最多 3 張）。Fill 和 Remove 不會出現在清單中，因為它們需要在編輯器中有選取範圍。編輯器再次開啟時，你之前的選擇會恢復。

- **✏ Edit**：只有一張參考圖時，編輯模型會修改它。有兩張或三張時，會將它們合成在一起。
- **🖼 Replace background**：編輯模型會被要求替換背景，並保持主體不變。
- **🔁 Refine**：按滑桿的強度重繪參考圖 1。
- **🧩 Compose**：用這些參考圖合成一張圖片（"put the dog from picture 2 on the sofa in picture 1"）。
- 結果會像其他圖片一樣出現在相簿中。

**影像編輯器開啟時**，Fill 和 Remove 會重新出現，圖片來自**所選圖層**：

- **✏ Edit**、**🔁 Refine** 和 **🖼 Replace background** 使用所選圖層，即使它被其他圖層遮擋也是如此。空圖層會使用你所看到的畫面。每個結果都會作為新圖層加入。
- **選擇了多個圖層**（在 Layers 面板中 Ctrl-click）時，它們都會被使用：Edit 和 Replace background 會將它們合成，**🧩 Compose** 會用它們生成一張圖片。
- 有**選取範圍**時，Refine 和 Replace background 會像以前一樣作用於選取範圍，而 Fill 和 Remove 必須有選取範圍才能使用。

## 🟧 Blender 圖層：在影像編輯器中使用時間軸的場景工具（2.542.0）
<!-- en: a-blender-layer-the-timeline-s-scene-tools-in-the-image-editor-2-542-0 67b4554ba356 -->

影像編輯器選單列上的 **🟧**（位於 ⛶ 旁邊），或 **Layer ▸ New Blender Layer (Scene Tools)…**，會把時間軸的 Blender 場景工具顯示在畫布上方。它們與時間軸中的工具完全相同，使用同一個場景，編輯也相同：

- **📂 Open a .blend**，或繼續使用已經開啟的場景。**✨ Build a scene with AI** 在這裡同樣可用。
- **🎥 Scene camera** 透過 .blend 檔案中的攝影機觀察。**🧭 Free view**：拖曳可環繞，右鍵拖曳可平移，滾輪可縮放，按 F 可框選全部內容。**🔍＋ / 🔍－** 或 **Alt+drag**（向前 = 放大，向後 = 縮小）可縮放，**⌖ Zoom to object**（Z）會跳轉到所選物件（2.546.0）。
- 影像編輯器中沒有播放列，也沒有 Auto-key：在這裡場景是一張靜態圖片。它們在時間軸中仍然可用（2.546.0）。
- **點選物件**即可選取它，然後用 **✥ ⟲ ⤡**（G、R、S）移動、旋轉或縮放它。你也可以為它設定關鍵影格、隱藏、複製或刪除它，或用 ＋ Model 新增模型。
- 2.550.0：**綁定了骨骼的人物**（Daz 角色，或任何帶有骨架的物件）會透過其**骨骼繫結**來選取——點選其身體（或在物件清單中點選其網格）會選取骨架，因為蒙皮的身體是由骨骼驅動繪製的：單獨移動網格只會移動控制項。點選射線未命中的人物（其包圍盒是靜止姿勢下的）會透過擺好姿勢後的包圍盒找到。
- **💾 Save** 會把編輯寫入 .blend 檔案，方式與時間軸中相同。

這些工具的設定位於 **🟧 Blender** 分頁中。場景會成為一個 **Blender 圖層**，儲存你所看到的檢視。**✕**（或再次點選 🟧，或按 Esc）會關閉這些工具，圖層會保留該檢視。它是一個普通圖層：可以隱藏、移動或刪除它。選取它並按 **🟧 Scene tools** 即可再次開啟這些工具。

**從場景生成圖片。** 選取 Blender 圖層，在提示詞面板的下拉式選單中選擇 **✏ Edit**（或 🔁 Refine）。按鈕會顯示 "✏ Edit · 🟧 Blender"。輸入圖片應呈現的內容，然後按下按鈕。場景會被傳送給編輯模型，**每個結果都會作為新圖層**加入到 Blender 圖層上方。畫布上方不會留下任何東西，Blender 圖層保持選取狀態。🟧 Blender 分頁中的 **Edit from** 用於設定使用場景的哪張圖片：

- **The view as shown**（即時）：工具開啟時使用即時檢視，否則使用該圖層最後儲存的檢視。
- **Blender render - Solid** 或 **EEVEE**：Blender 先以圖片的完整尺寸渲染該檢視。

透過 Layer ▸ New 3D Layer 建立的 3D 圖層現在也以同樣方式工作：從場景進行的 Edit 會生成一個新圖層。

**References 面板中的圖片與場景一起使用**（2.546.0）。在提示詞中提到某張參考圖，它就會與場景一起傳送給編輯模型——例如 *"photo real blonde woman on a beach with the face of the woman in picture 1"*。Picture 1 是 References 面板中的第一張圖片，picture 2 是第二張，依此類推（"image 2"、"pic 2"、"ref 2" 也可以）。最多有兩張圖片能與場景一起傳送，因為編輯模型只接受三張圖片。
- 場景始終是模型收到的第一張圖片，因此 bitGen 會為模型重新編號你的參考圖，並使用模型自己的用詞：FLUX.2 / FLUX 3 Klein 收到的是 "image 2"，Qwen Image 2.1 收到的是 "<image2>"，Qwen Image Edit 2511 收到的是 "Picture 2"。無論哪種情況，你都照常寫 "picture 1"。
- 🟧 Blender 分頁中的 **References** 設定：**When the prompt names them**（預設）、**Always**（使用提到的圖片，若未提到則使用前幾張）或 **Never**。它適用於 Blender 圖層和 3D 圖層。
- 未提到任何圖片的提示詞只會傳送場景，與以前一樣。

## ▾ Generate、Edit、Refine、Fill、Replace background、Remove 與 Blender 模式（2.541.0）
<!-- en: generate-edit-refine-fill-replace-background-remove-and-blender-mode-2-541-0 e6a92d253c0c -->

在 🖼 Image 模式下，提示詞面板的選單列中有一個下拉式選單，用於說明其按鈕的功能。它的工作方式類似 Krita AI 外掛，作用於影像編輯器中開啟的圖片：

- **✨ Generate**：根據提示詞生成一張新圖片，與以前相同。編輯器開啟時，結果會作為圖層放到畫布上。
- **✏ Edit**：編輯模型按照指令（"make her jacket red"）修改選取範圍，沒有選取範圍時修改整張圖片。
- **🔁 Refine**：重繪選取範圍，沒有選取範圍時重繪整張圖片。選單列上會出現一個滑桿，用於設定變化的程度（5 – 95 %）。它與 ✨ AI 面板的強度是同一個設定。
- **🪣 Fill**：根據提示詞填充選取範圍。請先選擇區域。
- **🖼 Replace background**：保留所選內容，其餘部分全部重新生成。
- **🧽 Remove**：去除所選內容，並延續周圍的畫面。提示詞可選。

按鈕上的文字會隨所選項變化（"🔁 Refine 40%"），✨ AI 面板的分頁也會隨之切換。如果編輯器已關閉，按下按鈕會開啟它。結果會出現在 ✨ AI 面板中：點選其中一個進行比較，點選其 **✔** 可將其保留為新圖層。

**Blender 模式。** 選取一個 3D 圖層（透過 Layer ▸ New 3D Layer 建立的圖層、Daz 或 Blender 場景），下拉式選單旁邊會顯示 🟧 Blender 標籤。此時 Edit 和 Refine 會基於場景工作：Blender 使用該圖層的渲染引擎，以圖片的完整尺寸渲染場景，然後將渲染出的圖片與提示詞一起傳送給編輯模型。3D 圖層本身保持不變。

**模型。** 🧊 3D 分頁的攝影機下方有一個 **Model** 部分：

- **Object**：選擇場景中的一個物件（不列出攝影機）。
- **Move m**、**Turn °** 和 **Scale %** 在檔案中原有位置的基礎上移動、旋轉和縮放它。**hidden** 會將其排除在外。
- **🖐 Drag the object**：在畫布上點選一個物件以選取它，然後按攝影機的視角沿地面拖曳它。Shift + drag 可上下移動，Ctrl + drag 可旋轉。
- **Reset object** 和 **Reset all** 用於還原。每次更改都是一個復原步驟。

原始的 .blend 檔案永遠不會被修改。

## ⟳ 從 GitHub 更新 bitGen Studio（2.540.5）
<!-- en: update-bitgen-studio-from-github-2-540-5 30e21a3568a8 -->

**Settings ▸ General ▸ ⟳ Updates** 會顯示你的版本、bitGen Studio 的安裝方式（git clone 或完整 zip 檔）以及用於更新的 GitHub 儲存庫。

- **🔍 Check for updates** 會向 GitHub 查詢最新版本，並列出新的更改。
- **⤓ Update now** 會安裝最新版本。它會先徵求你的確認，日誌會顯示在該區域中。
  - **透過 git clone 安裝的**會切換到 GitHub 上的版本。如果你修改過應用程式自身的任何檔案，它們會先被複製到 `backups\update-<time>\`。
  - **透過 zip 檔安裝的**會下載 GitHub 上的副本，並寫入有變化的檔案。
  - **無論哪種方式**，你的專案、設定、風格、模型、ComfyUI 和已儲存的快速提示詞都不會受到影響。當 Node 或 Python 套件清單發生變化時，也會一併安裝。
  - 帶有自己提交的資料夾（開發者的副本）不會被更新。請在那裡改用 git。
- **⟳ Restart now** 會在桌面應用程式中完成更新。如果在瀏覽器中使用，請關閉執行 `start.bat` 的視窗，然後重新啟動它。
- **啟動時的提示：** 啟動後不久，bitGen Studio 會在背景靜默檢查。如果 GitHub 上有更新的版本，它會提示一次。

## 🧩 Settings ▸ Add-ons：在應用程式中安裝的可選引擎（2.540.4）
<!-- en: settings-add-ons-optional-engines-installed-in-the-app-2-540-4 aa6e5f3cd8c1 -->

**Settings ▸ Add-ons** 列出不屬於主安裝的引擎。對於每個引擎，它會顯示其用途、所需條件、大小以及是否已安裝。可在此使用 **⤓ Install**、**⟳ Reinstall** 和 **🗑 Remove**，安裝日誌會顯示在該分頁中。一次只能執行一個安裝。

- **YuE2 music**：Music 面板中的 "YuE2" 風格（根據歌詞加風格描述生成歌曲）。
  - ⤓ Install 會在應用程式的 `yue2` 資料夾中建立獨立的 Python 環境。
  - 然後為你的顯示卡安裝帶 CUDA 的 PyTorch 2.10 以及固定版本的 YuE2 管線（yue2-infer 0.1.6），約 5 GB。
  - 模型 m-a-p/YuE2-3B 會在生成第一首歌曲時下載。
  - 它需要支援 BF16 的 NVIDIA GPU、約 24 GB 顯示記憶體，以及應用程式的 Python 3.10 - 3.13。
  - 在 Windows 上，PyTorch 不帶 FlashAttention。bitGen Studio 會為 YuE2 提供另一種注意力核心（依次嘗試 cuDNN、PyTorch 內建的核心，以及較慢的無圖模式），在日誌中說明使用的是哪一種，並記住可用的那一種（2.540.7）。
  - 🗑 Remove 會刪除 `yue2` 資料夾。
- **AI fill models (the Krita AI way)**（2.557.0）：影像編輯器在選取範圍中執行 Generate / Fill / Remove 時，按模型系列所使用的模型（參見 2.555.0 的填充功能）。勾選你需要的項——每項都標有大小，已下載的會顯示 ✓ downloaded：
  - Fooocus inpaint（SDXL / Pony）、MAT（Remove）和 NoobAI inpainting ControlNet（Illustrious / NoobAI）預設已勾選；FLUX.1 和 SD 1.5 inpainting ControlNet 以及 FLUX.2 Klein 4B outpaint LoRA 可按需勾選。
  - **⤓ Download ticked** 會將節點套件 comfyui-inpaint-nodes 安裝到你的 ComfyUI 中（勾選了 ControlNet 時還會安裝 comfyui_controlnet_aux），然後將檔案下載到 ComfyUI 的 models/inpaint、models/controlnet 和 models/loras 中（支援斷點續傳；會使用你在 Settings 中填寫的 Hugging Face 權杖）。首次安裝後需重新啟動 ComfyUI 一次。
  - **🗑 Remove models** 會刪除已下載的檔案（節點套件會保留）。
  - 它需要在 Settings ▸ ComfyUI 中設定好 ComfyUI 的資料夾。
- **Viggle (native)**：啟動其內建的安裝程式。進度顯示在 Queue 中。

## 🎬 用參考圖面板中的圖片讓 Blender 和 Unreal 渲染變得真實（2.540.0）
<!-- en: blender-and-unreal-renders-made-real-with-the-reference-docker-s-pictures-2-540- dd1af62c4470 -->

Blender 或 Unreal 場景中的每個物件都可以與 References 面板中的一張圖片匹配。這樣，名為 "Car" 的灰色方塊就會變成你參考圖中的紅色跑車，再由 3DREAL 讓它動起來。

- **物件如何找到對應的圖片**
  - **按名稱**：名為 Car、SM_Car_01 或 Vehicle.002 的物件會找到描述或名稱中包含 car / sedan / truck… 的圖片，Sofa 會找到 "a green velvet chesterfield"。牆和地板會找到牆和地板的圖片。
  - **手動指定**：每個物件都有一個下拉式選單，*auto* 使用名稱匹配，*none* 保持原樣，你也可以直接選擇一張圖片。
- **🟧 Timeline ▸ Blender scene ▸ Render to real ▸ 🖼 References**
  - 勾選 **Use them** 並選擇編輯模型（能接受最多圖片的模型排在最前）。
  - 🎬 會像以前一樣渲染該片段，並額外渲染其第一個影格。該影格會作為 Picture 1 傳送給編輯模型，參考圖排在其後（"the grey shape on the left (the object "Car") becomes a red sports car in Picture 2"）。
  - 然後，LTX 2.3 **3DREAL** 會從這一真實化的第一個影格開始為渲染新增動畫。
- **🖼 Image editor**（影像編輯器）
  - 在 **Blender 3D 圖層**上，🖼 References 部分會列出該圖層的網格。之後 ✨ Generate 會使用匹配的參考圖，把該圖層的畫面變得真實，並作為新圖層加入。
  - 在 **Unreal 圖層**上，🎮 Unreal 分頁中有 **🔍 Find the objects**（由 Unreal 列出該攝影機能看到的網格 Actor）和 **✨ Make it real**。
- **🟧 Timeline ▸ UNREAL ▸ Render to Real** 對 Unreal 片段的工作方式相同：先點選 🔍 Find the objects，然後點選 OK。第一個影格會被變得真實，3DREAL 隨後會跟隨該片段的運動。
- Unreal 需要 **bitGen Bridge 1.3.0**（🎮 Load UE project 會更新它）。

## 🖼 參考圖描述、牆 / 地板 / 家具 / 燈具類型、影像編輯器中的參考圖（2.539.0）
<!-- en: reference-descriptions-the-wall-floor-furniture-light-types-references-in-the-im 470a684e6b95 -->


- **每張參考圖都可以有描述**——References 面板 Image 分頁中的每張圖片、每個影片和每個聲音下方都有一個小輸入框（"a green velvet chesterfield"、"a slow waltz"、"her voice, calm and low"）。描述會隨專案和參考圖組一起儲存，會寫入對應行（"<subject 2> furniture is in <Picture 2> (a green velvet chesterfield)"），提示詞聊天和 ✨ Enhance 也會使用它（它優先於視覺模型的猜測）。
- **新的圖片類型**：Type 下拉式選單中新增了 wall、floor、furniture 和 light（✨ Make it real 會使用它們）。
- **🖼 Image editor**（影像編輯器）
  - 將參考圖拖放到已開啟的圖片上：它會作為**新圖層**加入，並以其描述命名。
  - ✨ AI → **Edit** 中有一個 **reference** 下拉式選單：編輯模型會把那張圖片作為 Picture 2 接收（"put the lamp from Picture 2 on the table"）。

## 🧩 Civitai 下載到各類型的資料夾、📁 資料夾、🔄 Sync（2.538.0）
<!-- en: civitai-downloads-into-each-type-s-folder-the-folders-sync-2-538-0 1d02fd4ad133 -->

- **Civitai 卡片上的 ⤓** 會下載最新版本的主檔案。某個*類型*（例如 SDXL LoRA、Pony 模型、Wan LoRA）第一次下載時，**Select Folder** 對話方塊會詢問該類型存放在哪裡；之後該類型的所有模型都會直接下載到那裡——不再彈出對話方塊。**Shift+click ⤓** 可再次開啟對話方塊以更改資料夾。模型版本清單中的 ⤓ 按鈕工作方式相同。
- **類型**：主類別（image、image-edit、video、music）、模型類型（sd1、sdxl、pony、illustrious、noobai、flux、flux2、flux2klein、flux3klein、krea、qwen、z-image、chroma、hidream、sd3、anima、wan、ltx、h3、hunyuan、music …）和種類（models、LoRAs、VAEs …）。它們儲存在應用程式資料夾中的 **model_folders.json** 裡，因此所有專案都會使用它們。
- Models 面板中的 **📁** 會列出每種類型的資料夾：*Change…*、✕ 忘記（下一次 ⤓ 會再次詢問），也可以在下載之前為任意類型選擇資料夾。
- 位於 ComfyUI 模型資料夾之外的資料夾仍然可以下載，但只有將其加入 extra_model_paths.yaml 後，ComfyUI 才會列出它——下載清單中會對此進行提示。
- **🔄 Sync** 會為這臺電腦上**所有**尚無 Civitai 資訊或資訊已過期的模型和 LoRA（所有分頁）取得 Civitai 的詳情、縮圖和範例圖片。Civitai 已識別過的模型（有 .civitai.info、.metadata.json 或我們的卡片）會先按其版本 id 精確查詢，然後按 SHA-256，最後按檔名查詢。Shift+click 會重新同步所有模型。

## ⛶ 在側邊面板之間最大化（2.538.0）
<!-- en: maximize-beside-the-side-dockers-2-538-0 a9292ab3eefd -->

現在，最大化浮動面板時，它會填滿已開啟的側邊面板之間的空間——左側面板、References、Assets、Queue 和 Gallery 保持可見。關閉其中一個後，下一次最大化也會用上它騰出的空間。

## 🧩 Models：分頁、資料夾分頁、卡片尺寸、模型資訊頁以及所有模型的 Civitai 資訊（2.537.0）
<!-- en: models-pages-folder-tabs-card-size-the-model-info-page-and-civitai-info-for-ever 97b73036b139 -->

🧩 Model manager 現在可以輕鬆管理數百個模型：

- **分頁**——每頁顯示的卡片數量與面板能容納的數量相同（*auto*；調整面板大小後會重新排布），或每頁 24 / 48 / 96 / 200 張；卡片下方有 ‹ 1 2 … › 翻頁。
- **資料夾分頁**——位於 Models / LoRAs 下方：你存放模型的每個資料夾對應一個分頁（checkpoints/SDXL -> **SDXL**，loras/Pony -> **Pony**），使不同類型分開顯示。**📌 This project** 列出本專案的渲染所用過的模型和 LoRA。
- **⇲ Edit**——拖曳卡片的角（或滑桿）可調整卡片大小；各欄會重新填滿面板。該設定會被記住。
- **點選卡片**會選取它（作為要使用的模型，或要新增的 LoRA）。**停留**會顯示其描述卡片——將滑鼠移到描述卡片上並**點選它**即可開啟**資訊頁**：其中包含圖片、所有詳情、觸發詞、描述以及**範例圖片及其提示詞**（*Use this prompt*），還有 ✓ Use this model、✎ Edit card、Civitai ↗。按 ‹ Back 或 Esc 返回。
- **⤓ Civitai info**——為該分頁上所有尚無資訊的卡片取得詳情、縮圖和範例圖片，按檔名查詢（Shift+click：重新取得全部；資訊頁上的 🔍 By SHA-256 可精確查詢）。這些資訊儲存在應用程式的 **model_info** 資料夾中，因此所有專案都能看到，並且不會向你的模型資料夾寫入任何內容。它在背景執行，一次處理一個模型（每個需要幾秒鐘）；■ Stop 可結束它。

## Veda 稀疏注意力——更快的 MiniMax H3（2.536.0）
<!-- en: veda-sparse-attention-a-faster-minimax-h3-2-536-0 14925a1969d3 -->

**Veda**（veda-sparse/Veda-on-ComfyUI）是一種為 MiniMax H3 訓練的學習型稀疏注意力：由一個小型預測器判斷哪約 10 % 的注意力是重要的，再由 Triton 核心跳過其餘部分——在其訓練過的尺寸下（1344x768、768x1344、768x768、1024x768；5 / 10 / 14 s）**端到端速度約提升 2-3 倍**，比 Sage 更快。它目前還是預覽版：人臉可能會稍顯柔和，其他尺寸會使用最接近的訓練尺寸的方案——對於關鍵鏡頭，請與關閉 Veda 時的效果進行比較。

1. Settings -> ComfyUI -> **Video accelerators -> ⬇ Install Veda**（它會複製該節點套件並用 pip 安裝其相依套件；在 Windows 上會安裝 triton-windows）。它需要 **ComfyUI 0.38 或更新版本**。
2. Settings -> Models -> **Model catalog -> Veda predictor (MiniMax H3)**（275 MB，下載到 ComfyUI/models/veda）。然後重新啟動 ComfyUI。
3. Settings -> Video styles -> 某個 MiniMax H3 風格 -> **Veda sparse attention**：**On**（最快，即作者設定的 90 %），或 **Quality**（更密集——75 % / 50 %，並在第一步使用完整注意力）。預測器欄位可以留空：應用程式會選擇 ComfyUI 列出的那個（如果你有 R2VA 版本，參考圖渲染會使用它）。

Veda 會替換注意力機制，因此 Veda 開啟時會跳過風格的 Sage 設定；而開啟 Long video 時，Veda 本身會被跳過。如果 Veda 在渲染中出錯，應用程式會停用它並在不使用它的情況下重新渲染（日誌中會註明）。

## FLUX 3 Klein 需要 ComfyUI 0.41 或更新版本（2.535.0）
<!-- en: flux-3-klein-needs-comfyui-0-41-or-newer-2-535-0 c2d53d139539 -->

FLUX 3 Klein 的文字編碼器透過 CLIPLoader 的一個 *type*（`flux3`）載入，只有 ComfyUI **0.41.0 或更新版本**才提供這個類型（最好使用 0.41.1 或更新版本）。在舊版 ComfyUI 上，任務現在會明確提示這一點——*'flux3' is a CHOICE of CLIPLoader.type, not a file: this ComfyUI does not offer it*，並說明你目前的版本以及如何更新（可攜版：`update\update_comfyui.bat`；git 安裝：`git pull` + `pip install -r requirements.txt`；或透過 ComfyUI-Manager -> Update ComfyUI）——然後重新啟動 ComfyUI。🩺 Style doctor 也會給出相同的提示。模型目錄現在會以真實的檔名下載 FLUX 3 Klein（`flux3-image-klein-int8-convrot`、`flux3-image-klein-base-int8-convrot`）。

## 🧪 Test mode，以及新渲染加入已開啟的預覽（2.534.0）
<!-- en: test-mode-and-new-renders-joining-the-open-preview-2-534-0 033f70d81802 -->

**🧪 Test mode**（測試模式）位於 Settings -> General 的 Testing 下方——也可以使用 🧪 Testing 面板頂部的核取方塊。開啟時：

- 一個小的 **🧪 Try next** 框（右下角）會針對*你目前所在的位置*推薦下一項測試——在影像編輯器中從 Gaussian Blur 開始，然後是畫筆、橡皮擦、選取範圍、圖層 …；在 Settings 中則推薦 Settings 相關的測試。**✓ Tried it** 會詢問是否有效，**– Skip** 將其標記為未測試，**Later** 顯示下一項，**✕** 在本次會話中停止該區域的提醒；
- 當應用程式偵測到某項測試自行生效時（你套用了模糊、該風格的任務已完成、你選擇了某個工作區 …），會彈出 **Did it work?** 框詢問你：**✓ It worked** / **✗ It didn't** / Later，並可填寫*發生了什麼*以及 **💡 Suggestions to change this feature**。你的回答和建議會記入測試清單，並出現在你儲存的日誌（💾 Save log）頂部的 SUGGESTIONS 下；
- 面板中某一行上的 ↺ 可重新測試該項。

**關閉**時，不會自動勾選任何項，不會儲存任何內容，也不會彈出任何提示；你自己做的勾選會保留。

**預覽會跟隨新的渲染。** 如果渲染完成時圖片預覽處於開啟狀態，新圖片會立即加入其縮圖條（你正在檢視的圖片保持不變），其頂部列中的 **✨ 1 new** 按鈕可帶你跳轉到新圖片。

## 對話方塊內的下拉式清單會顯示在對話方塊前方（2.533.0）
<!-- en: dropdown-lists-inside-a-dialog-open-in-front-of-it-2-533-0 8a19b306c74e -->

較長的下拉式選單會開啟一個帶搜尋框的獨立清單（Settings -> General -> Dropdown lists）。在對話方塊內——例如 📁 *Select a LoRA* / *Select a ComfyUI model* 瀏覽器、Settings 或其他任何對話方塊——該清單現在會顯示在對話方塊前方，並接管滑鼠和鍵盤；以前它會顯示在對話方塊後面。開啟的清單也不會再在影片預覽播放或日誌捲動時自行關閉。

## 測試自動勾選、面板標題列（2.532.0）
<!-- en: tests-tick-themselves-docker-title-bars-2-532-0 03fa6cc8137f -->

**🧪 測試清單會自動勾選。** 當應用程式偵測到清單中的某項生效時——某個風格的任務完成、選擇了工作區、使用了命令面板、為房間佈置了家具、最小化了面板——該行會被勾選，並且勾選會被**保留**（顯示為 *auto ✓*），因此重新啟動後仍然存在。你自己的 ✓ / ✗ / – 始終優先；在自動勾選上新增備註會將其保留。

**每個浮動面板上都有 ▁ ⛶ ✕。** ▁ 將面板縮小為標題列（點選 ▭ 或雙擊標題可再次展開），⛶ 會填滿選單列和狀態列之間的視窗區域（🗗 將其放回原處，無論原來是停靠還是浮動），✕ 關閉面板。

在 📏 Sketcher 中，攝影機透過其專屬控制項進行選擇、移動和旋轉——參見 *Picking, moving and turning a camera (2.641.0)*。

## 缺失的模型檔案會提示從哪裡取得（2.531.0）
<!-- en: a-missing-model-file-says-where-to-get-it-2-531-0 08f278aa2b11 -->

在傳送任務之前，風格要載入的每個檔案——模型、文字編碼器、VAE、LoRA、ControlNet——都會在 ComfyUI 自己的清單中查詢。位於其他子資料夾中的檔案（例如 `Anima\qwen_3_06b_base.safetensors`）會以 ComfyUI 給出的名稱使用。完全不在任何清單中的檔案會導致 ComfyUI 拒絕該任務；現在，當應用程式的**模型目錄**中有該檔案時，提示資訊還會說明：*Settings -> Models -> ⤓ Model catalog -> "Anima text encoder (Qwen3 0.6B base)" (1.2 GB) downloads it to ComfyUI/models/text_encoders*——然後重新啟動 ComfyUI。🩺 Style doctor 也會給出相同的提示。

## 🔍 查詢任何內容——Ctrl+K 命令面板與 📖 Help（2.530.0）
<!-- en: find-anything-the-ctrl-k-command-palette-and-help-2-530-0 36ee1ae36cf0 -->

按 **Ctrl+K**（或點選選單列中的 **🔍**），然後輸入要查詢的內容，詞語順序不限：

- 每個**面板**（隱藏的面板會重新顯示在螢幕上）以及每個**浮動視窗**（🎓 LoRA、🩺 Style doctor …）；
- 選單列和狀態列中的每個**按鈕**，包括目前工作區隱藏的按鈕；
- 每個**設定項**——設定對話方塊會在該項所在的分頁開啟，並醒目顯示該項；
- **工作區**、**Generate 模式**以及你的**圖片 / 影片風格**；
- 本指南的每個**章節**——它會在 **📖 Help** 視窗中開啟，在那裡還可以選擇其他任何章節；
- 每個**快捷鍵**——📖 Help 中會開啟該快捷鍵所在分組的按鍵表。

用 ↑ ↓ 選擇，按 **Enter** 執行，按 **Esc** 關閉。經常執行的專案下次會排在前面。指標位於時間軸的圖層上方時，Ctrl+K 仍用於分割片段；在影像編輯器中，它開啟的是編輯器自己的命令面板。

## 🩺 Style doctor——哪些風格可用，其他風格為何不可用（2.527.0）
<!-- en: the-style-doctor-which-styles-work-and-why-the-others-don-t-2-527-0 45f9ebf568c7 -->

選單列中的 **🩺** 用於開啟 Style doctor（風格診斷）。它會列出所有圖片風格。**▶ Check** 會用每個已勾選的風格依次生成一張小測試圖，所走的流程與 Generate 相同：

- **Quick check**（快速檢查）——512 × 512，4 步。風格能否載入並執行？每個風格只需幾秒。
- **Real render**（真實渲染）——使用風格自身的步數和尺寸，速度較慢。

每一行最後顯示 **✓ works**（附帶耗時和測試圖），或 **✗ failed**，並附上日誌中的關鍵行以及處理辦法，例如：

- ComfyUI 未列出的模型 -> 應放入哪個模型資料夾；
- 缺少節點套件 -> 給出節點套件名稱，並提示使用 Install Missing Custom Nodes；
- ComfyUI 未執行、顯示記憶體不足、檔案未下載完整、文字編碼器與模型不匹配。

缺少欄位的風格會立即失敗，不進行渲染。編輯風格（需要輸入圖片的風格）會得到一張小測試圖。**■ Stop** 取消目前正在執行的渲染。**↻** 重新檢查單個風格。除非勾選 **Keep the test pictures**，否則測試圖不會保留在相簿或 Image 素材中。最近一次執行的結果會被保留；**⤓ Report** 將其下載為 .md 檔案，**🗑** 將其清除。

## 工作區——Basic、Image editing、Video editing、Music video、Expert（2.526.0）
<!-- en: workspaces-basic-image-editing-video-editing-music-video-expert-2-526-0 7413ab2009e2 -->

選單列中的 **Workspace**（工作區）下拉式選單可讓應用程式針對某一類工作進行佈局。每個工作區會顯示該工作所需的面板，並隱藏用不到的狀態列和選單列按鈕。沒有任何功能被停用——Expert 會顯示全部內容。

| 工作區 | 顯示內容 | Generate 設為 |
|---|---|---|
| ◯ Basic | Preview、Prompt、References、佇列和相簿——進階按鈕被隱藏 | （不變） |
| 🖼 Image editing | 影像編輯器（最大化）、Prompt、References、Assets | 🖼 Image |
| 🎬 Video editing | Preview、Timeline、StoryBoard、SFX、Prompt | 🎬 Video |
| 🎵 Music video | Preview、Timeline、StoryBoard、Music、Stems、Prompt | （不變） |
| ◆ Expert | 所有面板和所有按鈕 | （不變） |

**你所做的更改按工作區分別儲存。** 隱藏某個面板、調整面板大小、開啟 Sketcher 或 Basic Settings——切換到其他工作區再切回來時，一切都保持你離開時的樣子。第一次離開 Expert 時，你當時的佈局會成為 Expert 的佈局，因此之前設定的內容都不會丟失。下拉式選單旁邊的 **↺** 會將目前工作區恢復為預設佈局。應用程式啟動時會進入你上次所在的工作區。

## 位於其他 ComfyUI 資料夾中的模型仍能被找到（2.525.0）
<!-- en: a-model-in-another-comfyui-folder-is-still-found-2-525-0 c27ba5332d60 -->

ComfyUI 的每個載入器都只列出各自的資料夾：**Load Diffusion Model**（UNETLoader）列出 `models/diffusion_models` 和 `models/unet`；**Load Checkpoint** 列出 `models/checkpoints`。在 Civitai 上以「Checkpoint」類型下載的模型常常落在 `checkpoints` 中，而擴散模型類風格（Krea 2、Anima、Qwen Image…）看不到它。

現在，在傳送任務之前，應用程式會先詢問 ComfyUI：該風格的模型實際位於哪個清單中：

- 同一檔案位於另一個子資料夾 -> 改用 ComfyUI 列出的名稱；
- 只有 Load Checkpoint 列出的 `.safetensors` -> 該節點改為 **Load Checkpoint**（它也能載入只含模型的檔案）；工作流程保留自己的文字編碼器和 VAE 載入器。

任務日誌會註明這一點：`node 70.unet_name: Krea2/… -> as ComfyUI lists it: … loaded by Load Checkpoint`。如果該檔案不在任何清單中，錯誤資訊會說明這一點，並告訴你應放在哪裡（`ComfyUI/models/diffusion_models`，放在其子資料夾中也可以；或放在 extra_model_paths.yaml 中新增的資料夾裡——然後重新啟動 ComfyUI）。

## 風格的模型可以是 .gguf 或 .safetensors（2.523.0）
<!-- en: a-style-s-model-can-be-a-gguf-or-a-safetensors-2-523-0 74295368d92a -->

圖片風格的 **Model**（模型）可以是這兩種檔案中的任意一種。應用程式會為其選擇匹配的 ComfyUI 載入器：

- `.safetensors` 模型使用 Load Diffusion Model（UNETLoader）；
- `.gguf` 模型使用 GGUF 載入器（ComfyUI-GGUF 節點套件）。

因此，「Krea 2 Raw GGUF」可以渲染 `.safetensors` 微調模型，而「Krea 2 Raw」、「Krea 2 Turbo」和「Anima」也可以渲染 `.gguf`。任務日誌會註明何時進行了切換，例如 `model: node 70 UnetLoaderGGUF -> UNETLoader`。

兩種載入器讀取相同的資料夾：ComfyUI 的 `models/diffusion_models` 和 `models/unet`，以及其中的任何子資料夾。不需要單獨準備 `unet` 資料夾。

## 🐞 報告錯誤（2.522.0）
<!-- en: reporting-a-bug-2-522-0 6c21ef6b7309 -->

在應用程式中的任何位置按 **Ctrl+Alt+Shift+B**（正在輸入文字時也有效）。應用程式會先按原樣擷取其視窗的螢幕截圖，然後開啟 **🐞 Bug report** 面板。再按一次可隱藏該面板。也可以從 Settings ▸ General ▸ **🐞 Report a bug…** 開啟。

1. 填寫以下內容：
   - **Title**（標題）：用幾個詞說明什麼出了問題。
   - **Severity**（嚴重程度）：💥 crash / freeze（崩潰 / 卡死）、⛔ something does not work（某功能無法使用）、⚠ wrong result（結果錯誤）、🎨 looks wrong（顯示不對），或 💡 idea（建議）。
   - **Where**（位置）：預設選取你最後使用的面板；如有需要可更改。
   - **What happened**（發生了什麼）和 **what you expected**（你期望的結果）。
2. **Steps to reproduce**（重現步驟）：**⤵ Use the recorded steps** 會填入你最近的點選、選擇和快捷鍵操作，並註明每項操作所在的面板。你可以隨意編輯。
3. **截圖**：
   - **✏ Pen** 和 **▭ Box** 用紅色標出問題；**↶ Undo** 復原最後一個標記。
   - **📷 Again** 重新截圖（截圖時面板會隱藏）。
   - **📎 A picture…** 改用你自己的圖片。
   - 在網頁瀏覽器中，📷 會詢問要捕獲哪個視窗。
4. **Attached**（附件，可逐項勾選或取消勾選）：
   - 截圖；
   - **日誌**：應用程式主控台、ComfyUI、視覺模型，以及最近的任務（失敗的任務排在前面）；
   - **系統 + 設定**：版本、作業系統、顯示卡、記憶體、ComfyUI 版本；
   - **記錄的步驟**。
5. **👁 What is included** 會在儲存前顯示所有這些內容。
6. **💾 Save report** 會將報告寫入應用程式資料夾中的 `bug-reports` 資料夾，並下載 **bitgen-bug-<date>-<title>.zip**。你只需傳送這一個檔案。其中包含：
   - `report.md`，供閱讀；
   - `report.json`，包含全部內容；
   - `screenshot.png`；
   - `logs`。

**Earlier reports**（以前的報告）列出你儲存過的報告：**⤓** 重新下載某份報告，**🗑** 刪除它。已開始填寫但尚未儲存的報告會保留在此瀏覽器中，直到你儲存為止。

**隱私**：
- 記錄器只記錄按了什麼以及在哪裡按的。文字方塊只記為「edited」，從不記錄輸入的內容。
- 所有看起來像金鑰、權杖或密碼的設定都會顯示為 •••，日誌中形似權杖的文字（`hf_…`、`ghp_…`、`sk-…`、`token=…`）也同樣會被隱藏。
- 記錄器還會記錄頁面錯誤和失敗的請求（僅記錄網址和狀態，從不記錄傳送的內容）。

## 訓練器中的微調：檢查點（checkpoint）、助手（LLM）和視覺模型（2.521.0）
<!-- en: fine-tunes-in-the-trainer-checkpoints-the-assistant-llm-and-the-vision-model-2-5 9344880273eb -->

狀態列中的 **🎓 LoRA** 按鈕用於開啟 **LoRA & fine-tune trainer**（LoRA 與微調訓練器）。現在每個任務都有一個 **Type**（類型），位於 Job 分頁的第一行：

| 類型 | 訓練內容 | 引擎 | 結果 |
|---|---|---|---|
| 🎨 LoRA | 為圖片 / 影片模型新增的小型附加元件 | ai-toolkit | ComfyUI 的 `loras/trained` |
| 🧱 Checkpoint fine-tune | 圖片模型的全部權重——得到一個新模型 | ai-toolkit | ComfyUI 的 `diffusion_models/trained` |
| 💬 LLM fine-tune | 應用程式的助手，基於你自己的對話訓練 | Unsloth | LLM 資料夾中的一個 `.gguf` |
| 👁 Vision fine-tune | 應用程式的視覺模型（圖片描述、圖片問答） | Unsloth | 視覺資料夾中的一個 `.gguf` 及其 `mmproj` |

基礎模型清單用 ★ 標出推薦的模型，並對照你的顯示卡說明每個模型需要多少顯示記憶體。即使你的顯示卡太小，也仍可以在更大的機器上訓練該模型：使用 **⤓ Export job**，或 Settings ▸ Remote generation ▸ RunPod。

### 推薦的基礎模型

**助手（LLM）**：

- **★ Qwen3.5 4B**：最佳起點（12 GB 顯示卡，16 位 LoRA 約需 10 GB）。
- **★ Qwen3.5 9B**：24 GB 顯示卡能容納的最強模型。
- **Gemma 4 E4B / E2B**：Google 出品，寫作能力出色；E2B 適合 8-10 GB 顯示卡。
- **Gemma 4 31B**：在 24 GB 顯示卡上以 4 位 QLoRA 方式訓練。
- **Qwen3.5 0.8B / 2B**：小巧快速；0.8B 可以進行完整微調。
- **Qwen3.8 27B**：最新模型，適合 64-80 GB 的 pod。

以上模型均採用 Apache 2.0 許可。Qwen3.5 以 16 位訓練：Unsloth 不建議對其使用 4 位。

**視覺模型**：**★ Qwen3.5 4B vision**（12-16 GB）或 **★ Qwen3.5 9B vision**（24 GB）；Gemma 4 E4B / E2B。

**圖片**：

- **LoRA** 仍是讓模型學會某個人物、風格或物體的最佳方式，適用於任何顯示卡。新增：**FLUX.2 klein base 4B**（Apache 2.0）。它適合 24 GB 顯示卡，學習速度快，其 LoRA 可用於快速的蒸餾版 klein 4B。
- **檢查點微調**（訓練全部權重）需要大顯示記憶體顯示卡：
  - Lumina-Image 2.0：24 GB，是 ai-toolkit 內建的範例之一。
  - Flex.1-alpha：48 GB，使用 **parameter swapping**（參數交換）可以更少。
  - FLUX.2 klein 4B 和 SDXL：實驗性支援。
- **⧉ Bake** 讓你在任何顯示卡上都能得到新的檢查點：先訓練 LoRA，再將其烘焙進基礎模型。

### 💬 LLM 微調（助手）

1. **⚙ Install Unsloth**（只需一次）。一個佇列任務會為 Unsloth 建立獨立的 Python 環境，安裝適合你顯示卡的 PyTorch，以及 llama.cpp 的 GGUF 轉換器（約 8 GB）。
2. **Job** 分頁：
   - **Base model** 和 **Method**：LoRA（16 位，合併進模型）、QLoRA（4 位，佔用顯示記憶體更少）或 Full fine-tune（訓練全部權重，顯示記憶體約為 4 倍）。
   - **LoRA rank / alpha**、**epochs** 或 **max steps**、**learning rate**、**batch**、**gradient accumulation**、**max length**（token 數）和 **warm-up**。
   - **System prompt**（助手的身分設定）和 **Model file size**（通常選 Q4_K_M）。
   - **📄 Config** 以 JSON 形式顯示 Unsloth 的執行設定；編輯後按 **✎ Use mine**。
3. **Dataset** 分頁：每個範例都是一段簡短的對話。
   - **＋ Example**：輸入別人會問的問題以及你想要的回答。**＋ a follow-up turn** 可新增更多輪對話。
   - **⤒ Import…** 可讀取：
     - JSONL / JSON：`{"messages": [...]}`、ShareGPT `conversations`、`instruction` / `input` / `output`、`prompt` / `completion`、`question` / `answer`；
     - 帶標題行的 CSV。
   - **⤓ chat.jsonl** 儲存全部範例。
   - 約 100 個優質範例即可教會一種風格或一項任務；要教會知識則需要幾千個範例。
4. **Run & samples**：按 **▶ Start the fine-tune**。佇列會顯示步數和損失（loss）。訓練完成的模型會被合併、轉換為 `.gguf`，並放入 LLM 資料夾（`<name>-Q4_K_M.gguf`）；在 Settings ▸ LLM 中選擇它即可。

### 👁 視覺微調（圖片描述模型）

在 Dataset 分頁中新增圖片，並在每張圖片下方寫出視覺模型應給出的**回答**。在 Job 分頁的 **Instruction** 中寫下問題，例如 "Caption this for a storyboard."

**✨ Answer the empty ones** 會讓你目前的視覺模型先寫出初步回答，供你修改。沒有回答的圖片會被排除在外。

`.gguf` 及其 `mmproj` 投影器會放入視覺資料夾（`llm-models/vision/<name>/`，或在 Settings 中選擇的視覺資料夾），Settings ▸ LLM ▸ Vision model 中會列出它們。

### 🧱 檢查點微調（圖片）

使用與 LoRA 相同的圖片和描述，但訓練的是模型的全部權重。

- **設定**：使用 adafactor 和較小的學習率，以 diffusers 格式儲存。
- **Parameter swapping**（參數交換）每一步只訓練部分權重；所需顯示記憶體少得多，但速度較慢。
- **結果**：儲存的檔案會合併為一個 `.safetensors`，放入 ComfyUI 的 `diffusion_models/trained`，並附帶一張 Model manager 卡片。用 Load Diffusion Model 載入它。

### ⧉ 將 LoRA 烘焙為新的檢查點

圖片 LoRA 訓練完成後，Run 分頁會提供 **⧉ Bake into a new checkpoint**：

1. 選擇該 LoRA 訓練時所針對的基礎模型（ComfyUI 的檢查點和擴散模型；★ = 同一系列）。
2. 設定強度和名稱。
3. 按 **⧉ Bake**。

ComfyUI 會完成合併並儲存；新檔案會連同卡片一起移入 `checkpoints/trained`（或 `diffusion_models/trained`）。烘焙需要使用本機的 ComfyUI，不能使用遠端的 ComfyUI。

## LoRA 訓練器、尖峰 / 離峰電價、用量日誌、Remote GPU、設定中的軟體套件（2.520.0）
<!-- en: the-lora-trainer-peak-off-peak-prices-the-usage-log-remote-gpu-packages-in-setti 8c3a0bf1b840 -->

### 🎓 LoRA 訓練器

狀態列中的 **🎓 LoRA** 按鈕用於開啟 LoRA 訓練器面板。它使用 **ai-toolkit**（由 Ostris 開發）根據你的圖片訓練 LoRA，許多 LoRA 都是用這個訓練器製作的。

1. **⚙ Install ai-toolkit**（只需一次）。一個佇列任務會將 ai-toolkit 下載到應用程式資料夾，建立獨立的 Python 環境，並安裝適合你顯示卡的 PyTorch。大小約 10 GB，需要一段時間；可在 Queue 中檢視進度。
2. **＋ New job**：為 LoRA 命名。
3. **Job** 分頁：
   - **Base model**：Z-Image Turbo（最容易上手）、Z-Image、FLUX.1 dev / schnell、Qwen-Image、SDXL、SD 1.5、Chroma 或 Wan 2.1（影片）。每個模型都會註明所需顯示記憶體，以及你的顯示卡是否滿足要求。
   - **Your own model file**（可選）：填寫一個路徑，代替從 Hugging Face 下載。
   - **Trigger word**（觸發詞）：一個自造的詞，例如 `t1m_style`。它會被加在每條描述的前面。
   - **Rank / alpha, steps, learning rate, batch, optimizer, sizes**（512 / 768 / 1024…）。
   - **Caption dropout, flip, Low VRAM, quantize**。
   - **Save every / keep**、**samples every** 和 **sample prompts**（`[trigger]` 代表你的觸發詞）。
   - **📄 YAML** 顯示表單生成的 ai-toolkit 配置。編輯後按 **✎ Use my YAML** 即可用你自己的配置訓練；**↺ Back to the generated one** 恢復為表單生成的配置。
   - **💾 Save** 儲存該任務。
4. **Dataset** 分頁：透過 **＋ Pictures…**、直接拖入或 **🖼 From the gallery** 新增 10-30 張圖片。在每張圖片下方寫一條描述，或讓助手來寫：**✨ Caption the empty ones** / **✨ all**（重新編寫所有描述）。
5. **Run & samples** 分頁：按 **▶ Start training**。佇列會顯示第 N / M 步和損失，樣圖會在 ai-toolkit 生成時陸續出現。**⏹ Stop** 取消本次執行。

執行完成後，LoRA 會被複製到 ComfyUI 的 `loras/trained` 資料夾，並附帶一張 Model manager 卡片（以觸發詞作為關鍵詞），以最後一張樣圖作為卡片圖片。之後即可在 🧩 Model manager 中選擇它。

**⤓ Export job** 會將 config.yaml 連同資料集一起下載為 .zip，以便在更大的機器上訓練（例如 RunPod pod 上的 ai-toolkit）。

### 尖峰與離峰電價

Settings ▸ General ▸ Energy cost：

- **Peak price per kWh**（尖峰每 kWh 電價）和 **＋ Peak times**（尖峰時段）：星期（Mon-Sun）加上起止時間。你的電價方案有多少個時段就新增多少個；像 22:00-02:00 這樣的時段會跨越午夜。
- **尖峰時段以外的每一分鐘都屬於離峰**，按普通的每 kWh 電價計費。

功率計會將每次讀數歸為尖峰或離峰，因此跨越兩者執行的任務會被拆分計算：

- 其 ⚡ 卡片和 `[power]` 日誌行會顯示：尖峰 Wh 按尖峰電價計 + 離峰 Wh 按離峰電價計 + 其分攤的每日供電費；
- 「⚡ since start」會註明目前是否處於尖峰。

### 📊 用量日誌

**📊 Usage…**（Settings ▸ General ▸ Energy cost），或點選狀態列中的 ⚡ 數值，會開啟用量面板：

- **Ranges**（範圍）：今天、7 天、本月、上月、全部，或自訂日期。
- **Totals**（合計）：該範圍內的帳單（電費 + 供電費 + 遠端 GPU）、應用程式執行期間的耗電（尖峰 / 離峰）、任務及其耗電和費用。
- **Days**（按天）：kWh、尖峰 / 離峰、任務、小時、電費、供電費、遠端、合計。
- **Jobs**（任務）：每個已完成的任務，包括其模式、內容、狀態、分鐘數、kWh、尖峰 kWh、平均功率（瓦）、費用以及執行所用的遠端 GPU。
- **⤓ CSV** 下載你目前檢視的表格。

日誌儲存在應用程式資料夾的 `usage` 資料夾中：每月一個檔案。

### Settings ▸ Remote generation

使用另一臺機器的顯示卡進行生成：

- **This computer**（本機，即常規方式）。
- **Another machine's ComfyUI**（另一臺機器的 ComfyUI）：其位址（例如 `http://192.168.1.20:8188`，需以 `--listen` 啟動）以及每小時的費用（可選）。
- **RunPod**：填入你的 API 金鑰（runpod.io ▸ Settings ▸ API Keys）後，會列出你的 pod 及其顯示卡和價格。啟動 / 停止 pod 並選擇它；應用程式會透過 RunPod 的代理使用其 ComfyUI（該埠，預設為 8188，必須以 HTTP 方式公開）。
- **SSH tunnel**：user@host、埠和金鑰檔案。**▶ Open the tunnel** 會將該機器的 ComfyUI 轉發到本機。

**✓ Test** 會向該 ComfyUI 查詢其顯示卡和版本。**Use it** 讓應用程式改用它（此時應用程式不會啟動自己的 ComfyUI）；**Use this computer** 恢復所有設定。

任務所用的模型必須位於那臺機器上。功率計只能偵測本機，因此用量日誌中遠端任務的費用為其執行時長 × 每小時價格（RunPod pod 則按其自身價格計算）。

### Settings ▸ Models：🖥 This computer 與軟體套件

Models 分頁頂部顯示：

- 你的顯示卡、記憶體和處理器；
- 已安裝的軟體套件，以及適合本機的軟體套件；
- 四個軟體套件，以及每個軟體套件可使用的功能（✓ ~ ✗，包含在內 / 以後新增）。

**✎ Not right?** 可更正硬體資訊，方式與安裝程式詢問時相同。

**⬆ Upgrade to …** 無需重新執行安裝程式即可升級到更大的軟體套件。它會在背景安裝該軟體套件新增的內容（尚未安裝 ComfyUI 時安裝 ComfyUI 及其節點套件，以及助手、語音、語音轉文字），並下載其模型；受限（gated）模型需要使用 Settings ▸ General 中的 Hugging Face 權杖。日誌和進度會顯示在按鈕下方。

### 分組下載

在模型頁面（安裝程式的最後一步，以及 Settings ▸ Models ▸ Model downloads）中，每個分組都有自己的核取方塊。它可勾選或取消勾選整個分組，並顯示該分組需要取得的檔案數量及其大小。部分勾選的分組會顯示一條短橫線。

## 安裝程式詢問你的硬體並選擇軟體套件；每日供電費（2.519.0）
<!-- en: setup-asks-for-your-hardware-and-picks-a-package-the-daily-supply-charge-2-519-0 57950bcae746 -->

**安裝程式的第一頁**顯示你的顯示卡、記憶體和處理器。如果找不到其中某一項（非 NVIDIA 顯示卡、Windows 未報告顯示記憶體的顯示卡、沒有名稱的處理器），它會詢問你：

- **Graphics card**（顯示卡）：從清單中選擇（NVIDIA RTX 50 / 40 / 30 / 20 系列及工作站顯示卡、AMD Radeon、Intel Arc、Apple Silicon、「No graphics card」，或選擇「Another card」並填寫其名稱和顯示記憶體）。
- **System memory (RAM)** 和 **Processor (CPU)**。

Windows 的工作管理員 ▸ 效能（Task Manager ▸ Performance）會顯示這三項資訊。如果安裝程式偵測到了硬體但偵測有誤，**Not right? Tell setup your hardware** 會開啟同一個表單。

**Your package**（安裝程式的第二頁）提供四個軟體套件，並已選取適合你電腦的那一個：

| 軟體套件 | 適用於 | 安裝內容 |
|---|---|---|
| Editor | 任何電腦 | 完整的影片和影像編輯器、CAD 與 3D 草圖、聲音與交付——不含 ComfyUI，不含模型 |
| Editor + small AI | 6-12 GB 顯示卡 | + ComfyUI、Anima 和 SDXL 圖片、背景移除、語音轉文字、語音、一個小型助手 |
| Editor + mid-size AI | 12-20 GB | + Krea 2 / FLUX 3 Klein 圖片、Kontext 和 Qwen Image 2.1 編輯、較小尺寸的 MiniMax H3、歌曲、放大 |
| Everything | 20 GB+ | 全尺寸的完整工作室 |

在軟體套件下方，**What you'll be able to use** 會列出所選軟體套件的每項功能：

- ✓ 執行良好；~ 可以執行，但速度較慢或尺寸較小；✗ 本機無法使用，並說明原因（例如 "needs about 14 GB of VRAM (this card has 12)"）。
- **in this package**（包含在此軟體套件中）/ **add later**（以後新增；可隨時在 Settings ▸ Models 中新增）。
- 編輯功能在所有電腦上都可使用。AI 功能的顯示記憶體需求為估計值。

Install 按鈕上會顯示軟體套件名稱和下載大小。如果軟體套件超出了你的電腦能流暢執行的範圍，按鈕會顯示 **Install anyway**。Editor 軟體套件不安裝 ComfyUI 和任何模型，安裝完成後直接開啟工作室。

在終端機中：`node scripts/setup-cli.js --packages` 會輸出相同的清單，而 `--package editor|light|standard|full` 加上 `--gpu ID --vram GB --ram GB --cpu "NAME"` 會安裝對應的軟體套件。

**Daily supply charge**（每日供電費，位於 Settings ▸ General ▸ Energy cost）：電費帳單上每天固定收取的金額。任務的費用會按其執行時長加上相應的分攤額（30 分鐘的任務分攤一天費用的 1/48）：

- 任務的 ⚡ 卡片顯示總額（例如「⚡ 125 Wh · $0.06」）；
- 其工具提示和 `[power]` 行會將總額拆分為電費和供電費；
- 「⚡ since start」會加上自應用程式啟動以來的分攤額。

## 佇列預設、Model manager、Civitai 下載、電費、Testing 面板（2.518.0）
<!-- en: queue-presets-the-model-manager-civitai-downloads-energy-cost-the-testing-docker c7a28a024b1e -->

**⏱ Queue presets**（佇列預設，位於選單列中專案按鈕旁邊）用於設定任務佇列的執行方式：

| 預設 | 功率限制 | 任務間休息 | 顯示卡過熱時等待 |
|---|---|---|---|
| Normal | 顯示卡自身的設定 | 無 | 從不 |
| Quiet (overnight) | 70 % | 20 s | 從 80 °C 起，直到降至 70 °C |
| Eco | 60 % | 10 s | 從 78 °C 起，直到降至 68 °C |
| Cool-down between jobs | 顯示卡自身的設定 | 60 s | 從 75 °C 起，直到降至 65 °C |
| Max performance | 100 %（恢復預設值） | 無 | 從 90 °C 起，直到降至 80 °C |
| Custom | 你設定的四個數值（在 ⓘ 中設定） | | |

- **ⓘ** 會說明該預設的作用、功率限制是否已設定成功、正在暫緩的任務（"rest between jobs: 12 s left"）以及警告（"GPU 0 is 86 °C"、"probably throttling"）。
- 下拉式選單旁的徽標在有任務被暫緩時顯示 ⏸，有警告時顯示 ⚠。
- 設定功率限制需要以管理員身分（Windows）或使用 sudo（Linux）執行應用程式，且在電腦重新啟動前一直有效。沒有相應權限時會給出提示，預設的其餘部分仍然有效。選擇 Normal 會恢復顯示卡的預設功率限制。
- 暫緩結束後啟動的任務會在日誌中註明：`[queue] waited 20 s - …`。因過熱而暫緩的等待在 20 分鐘後會放棄，因此即使感測器卡住，佇列也不會永遠停止。
- 編譯（僅使用 ffmpeg）從不等待。

**🧩 Model manager**（狀態列中的 🧩 Models）是一個浮動面板：可以讓它浮動，也可以停靠在其他面板旁邊或內部。

- **分頁**：Models（ComfyUI 的 checkpoints 和 diffusion_models 資料夾，包括 extra_model_paths.yaml 中的資料夾）、LoRAs、Civitai、📁 Model paths（2.580.0，見下文）。
- **篩選**：搜尋（名稱、類型、關鍵詞）、類別、類型、排序（A-Z、最新、評分、大小）。⟳ 會重新讀取資料夾。
- **卡片**顯示縮圖、名稱、★ 評分、發布日期、模型類型（SDXL、Pony、Illustrious、Flux、Qwen、Krea、Anima、Wan、LTX …）和類別（圖片、圖片編輯、影片、音樂）。LoRA 卡片還會顯示其關鍵詞；點選某個關鍵詞即可將其加入提示詞。
- **將指標停留在卡片上**，旁邊會顯示其說明卡片：說明、基礎模型、cfg、步數、取樣器、VAE、文字編碼器、關鍵詞、大小和檔案。指標離開時說明卡片關閉。
- **卡片詳情的來源**（後面的來源優先）：
  1. 檔案本身：其名稱、所在資料夾、safetensors 檔案頭或 GGUF 檔案頭；
  2. 其他工具留在模型旁邊的檔案（`<name>.civitai.info`、`<name>.metadata.json`）；
  3. `<name>.bitgen.json`：Civitai 返回的資訊以及你自己的編輯。

  縮圖是模型旁邊的 `<name>.preview.png` / `.jpg` / `.webp`。
- **卡片上的 ✎** 用於編輯卡片：名稱、你的評分、類型、類別、cfg、步數、VAE、文字編碼器、關鍵詞、發布日期和說明。這些內容會儲存在模型旁邊。
- **卡片上的 🔍** 會按 SHA-256 在 Civitai 上查詢該檔案。檔案只讀取一次，雜湊值會被儲存下來。
- **選擇**：點選模型卡片選擇該模型，點選 LoRA 卡片新增或移除 LoRA（每個 LoRA 都有權重）。
- **☐ Override the style's model + LoRAs**：勾選後，Basic Settings 會使用所選內容進行渲染。這會開啟 Override style，將檢查點覆蓋設為該模型，把這些 LoRA 新增為臨時 LoRA，並使用卡片中的步數和 cfg。取消勾選後，一切恢復原狀。
- **✚ New style from it**：用所選模型和 LoRA 建立新風格。會複製用於渲染該類型的風格（包括其工作流程、文字編碼器、VAE、取樣器和負面提示詞），或複製你選擇的其他風格；然後用該模型、這些 LoRA 以及卡片中的 cfg、步數、VAE 和文字編碼器替換相應內容。影片模型會生成影片風格，模型位於其第一個取樣器階段。
- **已安裝但未在 Settings 中設定的 ComfyUI**（2.622.0）：當 Settings ▸ ComfyUI ▸ Folder 為空時，bitGen 會在本機上查詢 ComfyUI——$COMFYUI_PATH、bitGen Studio 旁邊、你的主資料夾（ComfyUI、可攜版、Documents、Desktop、Downloads）、Pinokio、Stability Matrix、每個磁碟機的根目錄、ComfyUI Desktop——找到後，其 **checkpoints** 和 **diffusion models**（以及 unet）會填入 Model manager、Basic Settings 的檢查點清單以及影片的 Model 清單。狀態行會顯示找到的位置；Settings ▸ ComfyUI ▸ Folder 中會顯示該位置，並提供 **Use this folder** 按鈕以永久設定。

**Civitai**（Settings ▸ General ▸ Civitai，然後使用 Model manager 的 Civitai 分頁）：

- 貼上你的 API 金鑰（civitai.com ▸ Account settings ▸ API Keys），然後點選 **Test key**。
- 選擇 **civitai.red**（你帳戶的內容級別所允許的全部內容）或 **civitai.com**（僅限適合工作場合的內容）。**Mature results** 會在帳戶允許的範圍內加入成人向的結果和圖片。
- 按關鍵詞、類型、排序方式和基礎模型進行**搜尋**，然後點選某個結果檢視其各個版本。檔案上的 **⤓** 會將其直接下載到正確的 ComfyUI 資料夾：

  | Civitai 類型 | 資料夾 |
  |---|---|
  | Checkpoint | checkpoints（GGUF，或內部不含 VAE / 文字編碼器的檔案 → diffusion_models） |
  | LoRA / LoCon / DoRA | loras |
  | VAE | vae |
  | Embedding | embeddings |
  | ControlNet | controlnet |
  | Upscaler | upscale_models |

  你輸入的子資料夾會被保留。無需手動移動檔案，也不會彈出 Save As（另存為）對話方塊。其卡片（圖片、基礎模型、關鍵詞、範例圖片的 cfg 和步數）會寫在檔案旁邊。已經存在的相同檔案不會重複下載。
- 金鑰儲存在 `custom.settings` 中，只會傳送給 Civitai。

**Energy cost**（電費，位於 Settings ▸ General）：你的每 kWh 電價和貨幣。設定後，每個已完成任務的 ⚡ 卡片、其 `[power]` 行以及 System stats 中的「⚡ since start」都會顯示相應費用（例如「⚡ 125 Wh · $0.04」）。

**🧪 Testing**（Settings ▸ General ▸ 🧪 Testing…）會開啟一個浮動面板，按發行版本逐一列出此版本需要進行的測試。

- **auto** 項目會在應用程式偵測到其正常工作時自動勾選：例如該風格的任務已完成、nvidia-smi 有回應、Civitai 下載的檔案已進入 loras 等。
- 其他項目帶有 ✓（可用）、✗（不可用）和 –（未測試）按鈕，每個項目都可以新增備註。
- **💾 Save log** 會下載 `bitgen-test-log-<version>-<date>.txt`。其中包含電腦資訊、每個項目及其判定方式、你的備註、失敗任務的最後幾行日誌，以及相同內容的 JSON 版本。請將該檔案上傳給 Claude。
- 勾選狀態和備註儲存在 `custom.settings` 中，**↺ Clear** 可從頭開始。

## 功耗與時脈頻率、任務所用的電能；Anima 圖片風格（2.517.0）
<!-- en: power-draw-and-clock-speeds-the-energy-a-job-used-anima-image-styles-2-517-0 d199bb5f26a6 -->

**System stats**（系統狀態，位於左側面板區）：

- **每塊顯示卡的區塊**中新增了兩個圖表：
  - **Power**：顯示卡的功耗（瓦），刻度從 0 到其功率限制。
  - **Clock**：顯示卡的核心頻率，刻度從 0 到其最高頻率，旁邊顯示顯示記憶體頻率。
  - 區塊標題中會加上瓦數和 GHz。
- **CPU clock**：處理器目前的頻率。
  - 在 Windows 上，該資料來自效能計數器，因此會隨加速和空閒狀態變化。
  - 在 Linux 上，該資料直接來自各個核心。
- **CPU power**：僅在電腦報告該資料時顯示。Linux 通常會報告（RAPL，應用程式可讀取）；Windows 不借助驅動程式則無法讀取。
- **⚡ since start**：自應用程式啟動以來消耗的電能。

顯示卡讀數來自 nvidia-smi，它會持續執行並每秒報告一次。

**任務所用的電能。** 任務結束時，應用程式會計算從任務開始到結束所消耗的電能。它會記錄：

- 以 Wh 或 kWh 計的總量：顯示卡耗電，加上可讀取時的 CPU 耗電；
- 平均功率和峰值功率（瓦）；
- 任務的執行時長。

這些資訊會顯示在三個位置：

- 任務日誌末尾的 **[power]** 行；
- 佇列 Done 分頁中任務卡片上的 **⚡ … Wh**（其工具提示中有詳細資訊）；
- 專案的任務清單，因此重新啟動後仍然保留。

該數值涵蓋任務執行期間整塊顯示卡和 CPU 的耗電，因此在此期間使用它們的其他程式也會被計算在內。沒有 nvidia-smi 的電腦只計算 CPU 的耗電（前提是 CPU 資料可以讀取）。

**Anima 圖片風格**（位於圖片風格清單中）：CircleStone Labs 推出的 2B 動漫與插畫模型，透過 ComfyUI 執行。

- **Anima** 使用 Aesthetic v1.1，建議從它開始。
- **Anima base** 使用 Base v1.0。
- 兩者都使用 er_sde 執行 30 步、cfg 4，並附帶模型卡片中給出的負面提示詞。

檔案存放位置：

| 檔案 | 資料夾 |
|---|---|
| `anima-aesthetic-v1.1.safetensors` / `anima-base-v1.0.safetensors` | `models/diffusion_models` |
| `qwen_3_06b_base.safetensors`（文字編碼器） | `models/text_encoders` |
| `qwen_image_vae.safetensors` | `models/vae` |

這些檔案都來自 circlestone-labs/Anima，模型安裝程式中會列出它們。

提示詞寫法：

- 提示詞以 `masterpiece, best quality, score_7, safe, ` 開頭。
- 使用 Danbooru 標籤、普通詞語或兩者混用均可。
- 約 1 MP 的尺寸效果最好：1024 × 1024、832 × 1216 等。
- 模型和 LoRA 的授權條款僅限非商業用途，但用它生成的圖片可以用於商業用途。

## 任何設定都可新增關鍵影格；Krea 2 圖片風格（2.516.0）
<!-- en: keyframes-on-any-setting-krea-2-image-styles-2-516-0 fb6699a8323d -->

**◇ 任何設定都可新增關鍵影格。** 時間軸 Properties 中片段的各項設定，以及 🎨 Colour 對話方塊中的設定，旁邊現在都有一個小小的 **◇**。

1. 將播放頭移到變化開始的位置，設定數值，然後點選 **◇**。它會變成 **◆**：表示該時刻的一個關鍵影格。
2. 移動播放頭並更改該設定。這會自動生成第二個關鍵影格，因為一旦某個設定有了關鍵影格，對它的任何更改都會在播放頭所在位置記錄為關鍵影格。
3. 已新增關鍵影格的設定帶有橙色邊框，並顯示其在播放頭處的數值。點選 **◆** 刪除播放頭處的關鍵影格，或按 **Alt+click** 刪除該設定的所有關鍵影格。

可以用這種方式新增關鍵影格的設定：

- **Colour**：曝光、對比度、飽和度、色溫、色調、色相、LUT 混合，以及 🎨 Colour 對話方塊中色輪的亮度和 HSL 範圍。
- **Effects**：鏡頭、扭曲的強度、大小和速度，以及去背工具的匹配、邊緣和溢色。
- **✒ Masks**：羽化、擴展和不透明度。遮罩的形狀和以前一樣，使用其自身的 ◇ 新增關鍵影格。
- **Text**：大小和描邊。
- **⏱ Time**：快門、取樣數、色調分離，以及回聲的副本數、間隔、起始和淡出。

位置、縮放、旋轉、不透明度、模糊、銳化、發光、暗角、顆粒、裁切、生成器、光線、扭曲、形狀、文字動畫器和 3D 之前就已經可以新增關鍵影格。每個已新增關鍵影格的設定都會列在 **📈 Graph Editor** 中，並附帶其數值曲線和速度曲線、緩動以及貝塞爾手柄。

⚙ Compile 對各類關鍵影格的處理方式：

- **顏色**關鍵影格：在關鍵影格之間每四分之一秒重新生成一次調色效果，並在各效果之間交叉淡化。
- **鏡頭、扭曲和去背工具**關鍵影格由編譯過程本身生成動畫，適用於 V1 和影片圖層。
- **遮罩**關鍵影格會寫入遮罩的影片中。
- 帶有關鍵影格設定的**圖片或文字圖層**，以及**帶有時間效果關鍵影格的影片圖層**，由應用程式逐幀渲染。
- 尚未支援：調整圖層，以及色輪的顏色（色點），因為它不是數值框。

**Krea 2 圖片風格**（位於圖片風格清單中）。這些風格需要支援 Krea 2 的 ComfyUI（0.26 或更高版本）：

- **Krea 2 Turbo**：8 步，cfg 1。
- **Krea 2 Raw**：完整模型，52 步，cfg 3.5，帶負面提示詞。
- **Krea 2 Turbo GGUF** 和 **Krea 2 Raw GGUF**：與上面相同，但使用 GGUF 檔案。

如果它們從清單中消失了（2.547.0）：下次啟動 bitGen 時，它們會自動恢復一次。對於其他丟失的內建風格：Settings ▸ Image styles（或 Video styles）▸ **↺ Built-in** 會列出缺失的內建風格，經你確認後將其恢復。你自己的風格和你編輯過的風格永遠不會被改動。

檔案存放位置：

| 檔案 | 資料夾 |
|---|---|
| `krea2_turbo_fp8_scaled.safetensors` / `krea2_raw_fp8_scaled.safetensors`（Comfy-Org/Krea-2） | `models/diffusion_models` |
| `krea2_turbo-Q5_K_M.gguf` / `krea2_raw-Q5_K_M.gguf`（vantagewithai 的 Krea-2-Turbo-GGUF / Krea-2-Raw-GGUF） | `models/unet` |
| `qwen3vl_4b_fp8_scaled.safetensors`（文字編碼器） | `models/text_encoders` |
| `qwen_image_vae.safetensors`（VAE） | `models/vae` |

注意事項：

- 模型安裝程式會列出每個檔案及其下載位址。
- 任何 GGUF 量化版本均可使用；將風格的 **Model** 設為你擁有的檔案即可。Q8_0 為 13.7 GB，Q6_K 為 10.6 GB，Q5_K_M 為 8.9 GB（適合 12 GB 顯示卡），Q4_K_M 為 7.5 GB。
- GGUF 風格需要支援 Krea 2 的 ComfyUI-GGUF 自訂節點版本。如果 ComfyUI 提示 *Unexpected architecture type*，請更新 ComfyUI-GGUF；如果仍無法解決，請使用支援 Krea 2 的分支（molbal/ComfyUI-GGUF）。
- Krea 的風格 LoRA（`krea2_*.safetensors`）可以放在風格的 LoRA 槽中，Turbo 和 Raw 均可使用。

## 主體去背、解算攝影機、移除物體；對話方塊的主題編輯模式（2.515.0）
<!-- en: cut-out-a-subject-solve-the-camera-remove-an-object-theme-edit-mode-for-dialogs- 3ec1091d835f -->

時間軸上影片片段的 Properties 中新增了三個部分，適用於 V1 或影片圖層：**🧍 Cut out**、**📷 3D camera track** 和 **🩹 Remove**。每個部分都會在背景處理片段的整個時長，並顯示進度行和 **■ Stop** 按鈕。

**🧍 Cut out：在整個鏡頭中追蹤主體**

1. 選擇片段，轉到主體清晰可見的那一個影格。
2. 按 **✚ Subject**，然後在畫面上點選主體。按 **✖ Not it**，然後點選主體旁邊不屬於主體的任何東西。或者按 **▭ Box**，圍繞主體拖出一個框。點選某個標記可將其刪除。
3. 如果在其他影格去背出錯，將播放頭移到那一個影格並新增標記。每個影格都會參照離它最近的帶標記的影格。
4. 選擇追蹤主體的方式：
   - **Auto** 使用已安裝的方式中最好的一種。
   - **SAM 2**（Segment Anything 2）效果最好。**⬇ SAM 2** 會將其安裝到 AI matte 的 venv 中：包括 torch、sam2 包及其檢查點，約 1–3 GB。
   - **AI matte**（BiRefNet）使用與 Select ▸ Subject 相同的安裝。
   - **Built in** 使用 OpenCV，無需安裝任何東西。
5. **Refine edge**（最佳化邊緣）：
   - **snap** 讓邊緣貼合畫面本身的邊緣（頭髮、毛髮）。
   - **feather** 柔化邊緣。
   - **choke** 收縮邊緣（使用負數則擴展邊緣）。
   - **smooth** 防止邊緣逐幀閃爍。
6. 按 **▶ Cut out**。結果會以 `cut_<clip>_….webm` 儲存在專案的影片中，帶有主體的透明邊緣和片段原有的聲音。

在影片圖層上，勾選 **use it** 會讓圖層在主體周圍變為透明，在畫布上和 ⚙ Compile 中均如此。在 V1 上，該核取方塊只顯示預覽，因為 V1 下方沒有任何內容。去背後的主體也正是 **🩹 Remove** 要移除的內容，以及 **📷 3D camera track** 要排除的內容。

**🩹 Remove：影片的內容識別填充**

1. 選擇要移除的內容：**🧍 the cut-out**（去背後的主體），或在影片圖層上選擇 **✒ the masks**（遮罩，用 Mask Pen 繪製；遮罩可以移動）。
2. 設定選項：
   - **grow**：擴大空洞，把邊緣或陰影也一併去除。
   - **feather**：銜接處的柔和程度。
   - **look**：向前和向後搜尋多少秒。
   - **Auto** 用周圍的影格來填充空洞，並與目前影格對齊。它只為鏡頭中從未出現過的部分進行繪製，並讓該部分保持靜止。**Paint in only** 速度更快，但可能會閃爍。
3. **Reference**（參考圖，可選）：一個影格你自己填充好的畫面。**✎ Paint one** 會在影像編輯器中開啟播放頭處的影格，空洞部分為透明。用 Generative Fill 或 Clone Stamp 填充它，按 **Ctrl+S** 將其儲存到專案的 Images 中，然後在這裡選擇它。
4. 按 **▶ Remove**。片段現在會播放 `<clip>_fill….mp4`（webm 片段則為 `.webm`）。它與原片段的時長和時間點完全相同，並帶有聲音。**↺ Original** 讓片段恢復使用其原始檔案。

**📷 3D camera track：將圖層放入拍攝的場景**

1. 選擇攝影機的運動方式：**Auto**、**Moving camera** 或 **Tripod**（只轉動）。將鏡頭保留為 **0** 可自動計算，或輸入其水平視角（度）。勾選 **leave out the cut-out**，這樣自行運動的人或汽車就不會被用於解算。
2. 按 **▶ Solve**。進度行會顯示已解算的幀數、鏡頭、以像素計的誤差以及找到的點數。這些點會繪製在畫面上；解算效果良好時，播放過程中它們會牢牢貼在場景上。
3. **📷 Pick**：點選點（按住 Shift 可新增更多點），或圍繞它們拖出一個框。
4. 選擇一個圖層（或 **＋ New text**），然後選擇 **flat on them**（平鋪在點上）、**standing on them**（立在點上）或 **facing the camera**（面向攝影機），並設定大小（佔該位置處畫面寬度的比例）。按 **📌 Place**。該圖層會變成場景中的一張 🧊 3D 卡片。
5. **🎥 Drive the 3D camera** 會根據解算結果在每個影格為 3D 攝影機設定關鍵影格：位置、朝向、縮放以及新增的 **roll**（滾轉）。📌 Place 會自動執行此操作，因此每張 3D 卡片都能與鏡頭吻合。被追蹤的片段應橫向填滿畫面並居中，就像 V1 那樣。

**對話方塊的主題編輯模式**

- **Ctrl+Shift+Alt+E** 會開啟包含對話方塊在內的主題編輯模式。已開啟的對話方塊（例如 Settings）會保持開啟，其按鈕、標籤和輸入框可以像應用程式的其他部分一樣被選取並設定樣式。Style 面板、輪廓和手柄會顯示在對話方塊內部。按 Esc 只會關閉 Style 面板，從不關閉對話方塊。
- 在主題編輯模式下（無論以哪種方式進入）按 **Ctrl+S**，會將主題儲存到 `themes/<name>.json` 並離開編輯模式。尚未命名的主題會要求你輸入名稱。
- 再次按 Ctrl+Shift+Alt+E 即可離開；如有更改，會像往常一樣彈出確認框。

## 編輯主題模式：每個按鈕及其文字（2.623.0）
<!-- en: edit-theme-mode-every-button-and-its-words-2-623-0 4629507da8bb -->

在編輯主題模式（🖌）下，每個面板、窗格和按鈕都可以選取並修改其文字：
- **雙擊任意文字**——按鈕、面板標題、分頁、標籤、標題、提示——其上方會開啟一個輸入框：輸入新文字後按 Enter（框留空 = 恢復其原有文字），或按 Esc 保持不變。按鈕會保留其圖示，面板標題會保留其 ▾ 和按鈕。
- **下拉式方塊**：點選其中一個，Style 面板會列出它的 **Options**（選項）——可以重新命名其中任意一項（其功能保持不變）。
- **Placeholder and Tooltip**（佔位文字和工具提示）：在 Style 面板中可修改空輸入框中顯示的文字，以及指標停留在任意元素上時顯示的說明。
- **浮動工具窗格**（時間軸的舞臺窗格、DLSS 5、SeedVR2、語音聊天）可以像面板一樣被選取並設定樣式。
- **Shift+click**（或 **Alt+click**）會把這次點選交給應用程式本身——按鈕執行其功能，摺疊的分割槽、分頁、面板或選單會開啟——且不會離開編輯主題模式，因此其內部的部件也能觸及並編輯。所有這些都會隨主題一起儲存（💾 Save theme），↺ Clear element styles 會恢復所有文字。

## 編輯主題模式：調整大小、移動、隱藏、重新命名；離開即儲存；摺疊面板（2.514.0）
<!-- en: edit-theme-mode-resize-move-hide-rename-leaving-saves-folding-dockers-2-514-0 9bace33e05f0 -->

**編輯主題模式（🖌）現在可以修改佈局。** 像以前一樣選取一個元素，然後：

- 用其輪廓周圍的八個控點**調整大小**。拖曳左側和頂部控點時，對邊保持不動。
- 在元素內部拖曳即可**移動**它。Style 面板的 **Layout**（佈局）分割槽會以 **Δx / Δy** 顯示移動量。
- 在 Layout 分割槽中輸入精確的 **Width / Height**（寬度 / 高度，4 到 4000 px）。
- **隱藏**它。在編輯模式下，隱藏的元素會以淡色加虛線輪廓顯示，以便再次選取；離開編輯模式後它就不再顯示。
- **Hidden in Expert mode**（在專家模式下隱藏，2.544.0）：當 Settings ▸ General ▸ Expert mode 開啟時該元素不顯示，在 Basic 模式下顯示。在開啟 Expert mode 的編輯模式下，它會以淡色加藍色虛線輪廓顯示，以便再次選取。
- **Text**（文字）：修改標籤或純文字按鈕的文字。
- **↺ Layout** 會恢復大小、移動、隱藏和文字。

**修改會隨時保留。** 每次修改都會寫入 `themes/<theme name>.tmp`。如果應用程式在儲存前關閉，下次進入編輯模式時會彈出一個對話方塊，提供 **Bring them back**（恢復修改）或 **Throw them away**（丟棄修改）。

有修改時**離開編輯模式**（🖌 或 Esc）會開啟一個對話方塊：

- **💾 Save theme "<name>"**：儲存到 `themes/<name>.json`。尚未命名的主題會要求輸入名稱。
- **Save theme as…**：以新名稱儲存，該名稱成為目前主題。
- **↺ Reset theme**：恢復到進入編輯模式時的主題狀態。
- **Not now**：離開編輯模式，修改保持顯示但不儲存。`.tmp` 會保留這些修改。
- **Cancel**：留在編輯模式。

**摺疊側邊面板。** 每個側邊面板的標題列左側都有一個 **▾**。點選它可將面板摺疊成一條保留標題的窄條，為視窗其餘部分騰出更多空間。點選 **▸** 可重新展開。應用程式會記住哪些面板已摺疊。

**影像編輯器的面板。**

- 每組分頁（Layers、Properties、History …）都以 **▾** 開頭。點選它可將該組摺疊為只顯示分頁，點選某個分頁即可重新展開。
- 每組的 **✕** 用於關閉該組。
- 影像編輯器選單中的 **View ▸ Dockers** 會列出所有影像編輯器面板，並帶勾選標記。點選其中一項可顯示或隱藏它，或使用 **All Dockers** 恢復全部面板。
- 浮動面板視窗上的 ✕ 現在可以正常使用了。此前它被用於調整視窗大小的角落遮住了。

## Load UE project，時間軸的畫幅尺寸欄（2.513.0）
<!-- en: load-ue-project-the-timeline-s-frame-size-bar-2-513-0 b3689d0759d6 -->

**在哪裡開啟 Unreal 專案。** 一如既往，在 **Unreal** 中開啟。bitGen 透過 bitGen Bridge 外掛連線到 Unreal Editor，而 Unreal 必須已開啟該專案，連線才能工作。

**🎮 Load UE project**（載入 UE 專案，位於選單列中 📦 之後）：

1. 資料夾對話方塊開啟。選擇你的 Unreal 專案資料夾（包含 `YourProject.uproject` 的那個），然後按 **Select**。
2. 之後 bitGen 會自動完成其餘工作：
   - 將 bitGen Bridge 外掛放入 `<project>\Plugins\bitGenBridge`，或更新舊版本。
   - 在 `.uproject` 中啟用橋接所需的外掛：Python Editor Script Plugin、Editor Scripting Utilities、Sequencer Scripting、Movie Render Queue 和 bitGen Bridge。原檔案會保留為 `.uproject.bitgen-bak`。
   - 如果 Unreal 已開啟該專案，則將其關閉。Unreal 會先詢問是否儲存，請作答。
   - 用該專案重新啟動 Unreal。隨後 Unreal 的 Output Log 會顯示 `[bitGen Bridge] listening`。
3. **Unreal project** 對話方塊會列出每個步驟。它還會顯示專案的狀態：外掛版本、已啟用的外掛、Unreal 是否已開啟，以及編輯器所在的位置。

該對話方塊還包含：

- **⟳ Restart Unreal**：僅用該專案重新啟動 Unreal，不改動外掛或 `.uproject`。
- **Test connection**：檢查 bitGen 是否已與 Unreal 連線。
- **Also close other Unreal windows**：如果另一個專案佔用了橋接埠，請勾選此項。
- 你以前使用過的專案。
- 如果在你的 Epic Games 安裝中找不到編輯器，會出現一個欄位，可輸入 `UnrealEditor.exe` 的路徑。

**時間軸的選單列**（位於 Timeline 面板頂部）用於設定**畫幅**：即時間軸的製作尺寸。它作用於畫布、烘焙和 ⚙ Compile。

- **width × height**：輸入尺寸。
- **Preset**（預設）：
  - **Auto** 即 V1 影片自身的尺寸，與以前相同。
  - 或選擇一個尺寸：4K、QHD、Full HD、HD、SD、直式尺寸（Reels、Shorts、TikTok）、方形、4:5、21:9、電影 2.39:1、DCI 2K 或 4:3。
- **Aspect**（長寬比）：Free、16:9、9:16、1:1、4:5、4:3、3:2、2:3、21:9、2.39:1 或 1.85:1。輸入時會保持長寬比：輸入新寬度會自動算出高度，輸入新高度會自動算出寬度。
- **CAD toolbar**：顯示或隱藏預覽上方的 Create / 3D / Sketch / Solid 工具列。

當畫幅不是 V1 影片的尺寸時，V1 會按自身長寬比適配到畫幅內，在黑底上居中。畫布會這樣顯示，編譯也會以同樣的方式生成。

**CAD 按鈕已隱藏。** 在時間軸中，請改用選單列的 **CAD toolbar** 核取方塊。在影像編輯器中，請使用 **Window ▸ CAD Toolbar**。選取草圖或 3D 實體時，它仍會自動顯示。

## Lottie（JSON）匯出（2.512.0）
<!-- en: lottie-json-export-2-512-0 28d880634999 -->

**📤 Export → ⤓ Lottie (JSON)** 會將時間軸的圖片圖層和文字圖層轉換為 Lottie 動畫：一種適用於網頁、應用程式和任何 Lottie 播放器的 JSON 檔案。它會以 `<project>_lottie.json` 儲存在影片旁邊，📤 Export 會將其列出供下載。

- **真正的動畫圖層。** 只做移動、縮放、旋轉或淡入淡出的圖層會保持為動畫圖層，其中包含它的圖片。它的 ◆ 關鍵影格會保留緩動：線性、緩入、緩出、緩入緩出、自訂曲線或定格。它的混合模式和圖層的不透明度也會保留。文字以其圖片形式匯出。
- **逐幀。** 由應用程式自行繪製的圖層會以逐幀形式匯出：每影格一張圖片，重複的影格共用。這包括遮罩、效果和外觀、生成器和粒子、變形、3D、父級、表示式、設定了關鍵影格的文字顏色、入場或出場轉場，以及彎曲的運動路徑。
- **省略的內容。** 影片圖層、基礎影片和軌道遮罩會被省略，因為 Lottie 不支援影片。提示訊息會列出省略了哪些內容。

匯出結果已在標準 Lottie 播放器 lottie-web 中播放檢驗。在所有測試的時刻，它繪製的畫面都與時間軸一致。

## 可變遮罩羽化、資料驅動動畫和範本欄位（2.511.0）
<!-- en: variable-mask-feather-data-driven-animation-and-template-fields-2-511-0 ef0c7604484c -->

**✒ Variable mask feather（可變遮罩羽化）。** 在閉合遮罩上使用 ✒ Mask Pen 時，**Shift+drag 一個點**。該點會獲得自己的羽化值，大小等於你拖曳的距離，並以虛線圓環顯示。邊緣按其上最近位置的羽化值柔化：沿邊緣的每一段，羽化值從一個點的值平滑過渡到下一個點的值。沒有單獨羽化值的點沿用遮罩的羽化值。動畫遮罩路徑的各點羽化值也會在關鍵影格之間平滑過渡。遮罩行中的 **variable feather ✕** 會將所有點恢復為遮罩的羽化值。編譯結果與畫布一致，包括影片圖層的遮罩影片。

**📋 Data（資料）。** 在任意圖層 Properties 的 **📋 Data & fields** 下，使用 **⤓ Import CSV / JSON**：

- **CSV**（逗號、分號或製表符分隔；支援帶引號的值）將第一列用作欄名。
- **JSON** 檔案可以是記錄清單、包含一條記錄的物件，或按欄排列的值。

該檔案會成為一個命名的**資料集**，隨時間軸一起儲存。每個資料集都有一個目前**列**；切換列後，所有讀取它的內容都會隨之改變。

- **在文字中**：`{{sales.region}}` 顯示目前列的 region，`{{sales.region.3}}` 顯示第 3 列的。資料中沒有的名稱會按原樣保留。編譯時，文字圖片會帶上這些值。
- **在 ƒx 中**：`data("sales", "amount")` 以數字形式給出目前列的 amount，`data("sales", "amount", 3)` 給出第 3 列的。例如，`data("sales", "amount", floor(t) + 1)` 會逐列步進，每秒一列。
- **📋 Data → keys**：選擇資料集、一欄和一個屬性（opacity、scale、x、y、turn），然後設定 **s per row**（每列秒數）、列範圍 **from … to**，以及 **x**（係數）**+**（偏移）。**📋 Make keys** 會每隔若干秒為一列設定一個關鍵影格，適用於條形圖、計數器等。

**📋 Template fields（範本欄位）。** 用標籤公開圖層的屬性：文字顏色、不透明度、縮放、x、y 或旋轉。時間軸上所有公開的欄位都會列在 **exposed on this timeline** 下，因此可以在一處統一修改。由這些圖層儲存的 🧩 範本在被拖入時，會以顏色和數字的形式提供這些欄位。已設定關鍵影格的屬性，其關鍵影格會按修改量整體偏移。

## 3D 中的 2D 圖層：卡片、移動攝影機、景深、陰影（2.510.0）
<!-- en: 2d-layers-in-3d-cards-a-moving-camera-depth-of-field-shadows-2-510-0 6adfb8dd5e58 -->

**🧊 3D layer（3D 圖層）。** 在圖層的 Properties 中（圖片、文字、形狀、生成器或影片圖層），勾選 **🧊 3D layer**。該圖層會變成 3D 空間中的一張卡片：

- **x / y**：圖層通常的移動。
- **depth z**（深度 z）：單位為像素。數值越大越遠。
- **x turn °** 和 **y turn °**：向後傾斜或左右轉動。它通常的旋轉即繞 z 軸的旋轉。
- **casts shadows**（投射陰影）和 **accepts shadows**（接受陰影）。

深度和兩個旋轉都可以設定關鍵影格（◇）。

**🎥 3D camera（3D 攝影機）。** 所有 3D 圖層都透過同一臺攝影機觀看，可在任意 3D 圖層的 Properties 中設定：

- **position x / y / z**（位置）。
- **aim at x / y / z**（瞄準點）。
- **zoom**：攝影機的鏡頭。當攝影機位於 z = −zoom 時，位於 z 0 的卡片恰好是其 2D 尺寸，因此勾選 3D 後，在你移動任何東西之前畫面都不會變化。

每個數值都可以在播放頭處設定關鍵影格（◇）。一旦某個數值有了關鍵影格，修改它就會生成關鍵影格，攝影機會在關鍵影格之間平滑移動。**reset** 會將攝影機恢復為正視前方。

**🧊 Orbit（環繞）**（Shift+O）在畫布上移動攝影機：

- **拖曳**：繞瞄準點環繞。
- **Shift+drag**：推近或拉遠。
- **Alt+drag**：平移（攝影機及其瞄準點一起移動）。

**景深。** 勾選 **depth of field**（景深），然後設定 **focus**（對焦）距離和 **aperture**（光圈）。位於對焦距離處的卡片是清晰的。與對焦距離相差一個對焦距離的卡片，會按光圈值（像素）模糊。

**陰影。** 勾選 **light (shadows)**（燈光/陰影），並放置燈光（**x / y / z**）。投射陰影的卡片會把其圖片的形狀投到身後接受陰影的卡片上。影片圖層投射的是其邊框的形狀。設定 **darkness %**（暗度）和 **softness px**（柔和度）。

**疊放與編譯。** 卡片按圖層順序疊放，與時間軸的 2D 圖層相同，因此請把較遠的卡片放在較低的位置。3D 圖片圖層由頁面逐幀渲染。3D 影片圖層會整體烘焙，並保留聲音。當攝影機、燈光或其他卡片發生變化時，它們會重新渲染，因此結果與畫布一致。

## 運動草圖、擺動器和平滑器（2.509.0）
<!-- en: motion-sketch-the-wiggler-and-the-smoother-2-509-0 45fa4c2e3a2b -->

這三項都位於圖片、文字、形狀、生成器或影片圖層 Properties 的 **〰 Motion** 下。每一項都會生成普通關鍵影格，之後可以在圖表編輯器中編輯。

**✍ Motion sketch（運動草圖）。** 選取一個圖層，並將播放頭放在動作開始的位置。

1. 按 **✍ Sketch**，或選擇 ✍ 工具（**Shift+K**）。
2. 在畫布上按下並移動指標。時間軸從播放頭開始播放，圖層跟隨指標移動。它從原來的位置出發，因此不會跳到指標處。
3. 鬆開即停止。到達圖層末尾時草圖也會停止。

路徑會變成位置關鍵影格。它經過的已有關鍵影格會被替換。

- **speed %**（速度）：繪製草圖時時間軸的播放速度。100 為即時。數值越低，你就有越多時間做出細緻的動作；回放時會更快。
- **smooth px**（平滑）：只保留使路徑變化超過該值的關鍵影格。數值越高，關鍵影格越少，路徑越平滑。

**≈ Wiggler（擺動器）。** 為屬性新增隨機運動。

- **property**（屬性）：position (x, y)、x、y、scale、turn、opacity，或設定了關鍵影格的生成器或光線數值。
- **per s**：變化的頻率。
- **amount**：向兩個方向變化的幅度。
- **noise**：smooth（流暢的曲線）或 jagged（每次一個新值）。
- **x, y apart**：用於位置時，x 和 y 各自獨立擺動。關閉時它們一起擺動。
- **seed**：每個數值產生不同的擺動。

擺動作用於屬性的第一個和最後一個關鍵影格之間，疊加在已有的運動之上。如果屬性的關鍵影格少於兩個，則作用於整個圖層。

**⌇ Smoother（平滑器）。** 平滑屬性在第一個和最後一個關鍵影格之間的關鍵影格。至少需要三個關鍵影格。

- **frames**：在前後各這麼多影格的範圍內對運動取平均。
- **tolerance**：只保留使數值變化超過該值的關鍵影格。

結果是關鍵影格更少，但整體形狀不變。兩端保持原位。

## Audio → keys、波形和頻譜圖層（2.508.0）
<!-- en: audio-keys-waveform-and-spectrum-layers-2-508-0 d06721950bb9 -->

應用程式會讀取時間軸的聲音：它的響度、波形以及隨時間變化的 64 個頻段。聲音可以是單個片段，也可以是 **All sound (the mix)**（全部聲音/混音）：所有聲音片段，以及每個正在播放的影片片段的聲音，按各自音量混合。每個檔案只讀取一次，之後會被記住。

**♪ Audio → keys** 位於每個圖片、文字、形狀、生成器或影片圖層的 Properties 中。

1. 選擇 **sound**（聲音）。
2. 選擇要跟隨的內容：**loudness**（響度）、**bass**（30–250 Hz）、**mids**（250 Hz–2 kHz）或 **treble**（2–12 kHz）。
3. 選擇 **property**（屬性）：opacity (0..1)、scale (1 = 100 %)、x、y、turn，或圖層自身的生成器或光線數值。
4. 設定 **quiet**（安靜）和 **loud**（響亮）時的數值，以及 **smooth**（前後各取多少影格求平均）。
5. 按 **♪ Make keys**。

該屬性會在圖層的整個長度上設定關鍵影格。這一段中最安靜的時刻得到 quiet 值，最響的時刻得到 loud 值。只保留起作用的關鍵影格，最多 400 個。該屬性上已有的關鍵影格會被替換，之後這些關鍵影格可以像其他關鍵影格一樣編輯。

**🌫 Waveform（波形）。** 使用 🌫 Generator 工具，在畫布上 **Alt+click**。在該圖層的 🌫 Generator 中：

- **sound**。
- **style**：wave（填充）、line 或 bars。
- **x / y**（相對畫幅中心）、**width**、**height**。
- **span s**：在播放頭周圍顯示多少秒的聲音。數值小時即波形的特寫。
- **gain %**、**thickness**，以及從左 → 右的 **colours**。

**🌫 Spectrum（頻譜）。** 用 🌫 工具 **Alt+Shift+click**。其頻率從低（左）到高（右）排列。在該圖層的 🌫 Generator 中：

- **sound**。
- **style**：bars、line 或 circle（圍成一圈的條形）。
- **bands**（4–64）、**gain %**、條形之間的 **gap %**。
- **floor %**：比它更安靜的部分不顯示。
- **thickness**，以及從低 → 高的 **colours**。

每個數值都可以設定關鍵影格（◇）或使用表示式（ƒx）。

**ƒx audio()。** 在任何表示式中，`audio()` 是該時刻混音的響度（0..1）。`audio("bass")`、`audio("mid")` 和 `audio("treble")` 跟隨各頻段。例如，`value * (1 + audio() * 0.5)` 會隨音樂跳動。兩者都在 ƒx 預設中。

**編譯。** 波形和頻譜圖層由頁面逐幀渲染，使用的是同一份聲音讀取結果，因此結果與畫布一致。頁面會等聲音讀取完成後再渲染。

## 木偶圖釘和網格變形（2.507.0）
<!-- en: puppet-pins-and-mesh-warp-2-507-0 1dce6dfe442d -->

**📌 Puppet pins（木偶圖釘）。** 選取一個圖層（圖片、文字、形狀、生成器或影片圖層）。然後選擇 **📌 Puppet** 工具（**Shift+W**）。

- 在圖層上**點選**即可放下一個圖釘。放下幾個：手臂兩端、頭部、雙腳。
- **拖曳**一個圖釘，圖層會彎曲跟隨。其他圖釘會把畫面固定在原處。在圖釘附近，畫面會隨它旋轉和移動，而不會被拉伸。
- **Alt+click** 一個圖釘可將其連同它的關鍵影格一起刪除。
- 彎曲後的畫面可以超出圖層自身的邊緣。

**為圖釘製作動畫。** 在 **📌 Warp**（位於圖層的 Properties 中）中按 **◇ key here**。它會在播放頭處為所有圖釘設定關鍵影格。此後每次拖曳都會在播放頭處生成關鍵影格，圖釘在關鍵影格之間平滑移動（這些關鍵影格在圖表編輯器中具有常規的緩動）。

**⌗ Mesh warp（網格變形）。** 在 📌 Warp 中勾選 **⌗ Mesh warp**。圖層上會出現一個點陣網格（**columns** × **rows**，最多 8 × 8）。用 📌 工具拖曳其中的點。畫面會沿穿過這些點的平滑曲線變形，而不是沿直線。**reset** 會將所有點復位。網格點與圖釘一樣，透過 ◇ key here 設定關鍵影格。圖釘和網格可以同時使用。

**📌 Warp 設定：**

- **on**：開關變形。
- **falloff**：圖釘拉力的影響範圍。低值範圍寬且柔和，高值只作用於圖釘附近。
- **detail**：繪製所用三角網格的精細程度。數值越高，在大幅彎曲時越平滑。
- **✕**：刪除圖釘、網格及其關鍵影格。

圖釘和點以在圖層自身圖片中的比例位置儲存。圖層被移動、縮放或旋轉時，變形會隨之一起變化。

**編譯。** 變形後的圖片圖層由頁面逐幀渲染。變形後的影片圖層由頁面整體烘焙，並保留聲音，與光線效果（2.506.0）相同。結果與畫布一致。

## 粒子和光線（2.506.0）
<!-- en: particles-and-light-rays-2-506-0 4df1e683491b -->

**✨ Particles（粒子）。** 使用 **🌫 Generator tool**，在畫布上 **Shift+click**。點選處會出現一個粒子發射器：一股上升後回落的柔和火花噴泉。選取該圖層。在 **🌫 Generator**（類型為 **Particles**）中可以設定：

- **emitter**（發射器）：**point**、**line** 或 **box**。設定其 **x / y**（相對畫幅中心的像素）及其 **width / height**。
- **per s**（每秒生成的數量）、**life s**（壽命）和 **pre-roll**（預捲：開始時空中已充滿粒子）。
- **speed px/s** 及其隨機 **± %**；**direction °**（0 = 向右，−90 = 向上）及其 **spread °**；**gravity** 和 **wind**。
- **particle**：dot（柔和）、circle、square、star 或 spark（沿運動方向的拖尾）。
- **size start → end** 及其隨機 **± %**；**colours** start → end；**opacity start → end %**；**seed**。

每個數值都可以設定關鍵影格（◇）或使用表示式（ƒx）。粒子是計算出來的，而不是模擬出來的：任何一個影格無論何時繪製都一樣，因此拖曳播放頭、播放和編譯的結果完全一致。為圖層設定 Add 或 Screen 之類的混合模式，可以讓它在下方畫面上發光。

**☀ Light rays（光線）** 位於任意圖片、文字、形狀、生成器或影片圖層的 Properties 中。圖層的明亮部分會從一個光源點向外拖出光線。光線可以超出圖層自身的邊緣。

- **source x / y**：相對圖層中心的像素。
- **length %**：光線延伸的距離。
- **intensity %**：光線的強度。
- **threshold**（0–255）：只有比該值更亮的光才會產生光線。
- **tint**：光線的顏色。
- **rays only**：隱藏圖層，只保留其光線。

每個數值都可以設定關鍵影格（◇）或使用表示式（ƒx）。

**影片圖層。** 帶光線效果的影片圖層會在你按 ⚙ Compile 時由頁面整體烘焙。每個影格都按其自身時間從片段中取出，並完全按畫布的方式繪製。編譯會疊加這些影格，並保留片段的聲音。較長的片段需要一點時間來烘焙。只有當它的某項內容發生變化時才會重新烘焙。

## 生成器圖層和扭曲：分形噪波、漸層、湍流置換、置換貼圖（2.505.0）
<!-- en: generator-layers-and-distortions-fractal-noise-gradient-ramp-turbulent-displace- 19054559d27a -->

**🌫 Generator** 工具（位於畫布工具箱中）會建立一個自行繪製內容的圖層：

- 在畫布任意位置**點選**，建立覆蓋整個畫幅的 **Fractal Noise** 圖層。
- **拖曳**，建立一個從按下處延伸到鬆開處的 **Gradient Ramp** 圖層。

選取該圖層，即可在其 Properties 中看到 **🌫 Generator**。每個數值都可以設定關鍵影格（◇）或使用表示式（ƒx）。

- **Fractal noise**（分形噪波）設定：
  - **type**：basic、turbulent smooth 或 turbulent sharp（帶摺痕）。
  - **contrast**、**brightness**、**invert**。
  - 以像素為單位的 **scale**，以及 **complexity**（細節層數）。
  - **sub influence** 和 **sub scaling**：每個更精細的細節層的強度和精細程度。
  - **evolution**（°）和 **evolution speed**（°/s）：噪波會自行變化。
  - **offset** 和 **drift**（px/s）：平移噪波。
  - **seed**，以及兩種 **colours**（暗 → 亮）。
  - **detail**：¼（快速）或 ½。噪波本身很平滑，因此以小尺寸計算，再放大繪製。
- **Gradient ramp**（漸層）設定：**linear** 或 **radial**，**start** 和 **end** 點（相對畫幅中心的像素），以及兩種顏色。

降低圖層的不透明度或為其設定混合模式，即可將其疊加在其他圖層上。

**〰 Distort**（扭曲）位於任意圖片、文字、形狀或影片圖層的 Properties 中：

- **Turbulent displace**（湍流置換）用分形噪波推動圖層的像素。設定 **amount**（像素）、旋渦的 **size**、**complexity**、**evolution speed**（會自行變化）和 **seed**。
- **Displacement map**（置換貼圖）用另一個圖層的畫面推動像素：可以是 Fractal Noise 或 Gradient Ramp 圖層，也可以是任意圖片圖層。中灰色使像素保持原位。**use brightness** 在兩個方向上移動相同的量；**red ↔ / green ↕** 按紅色橫向移動、按綠色上下移動。以像素為單位設定 **max across** 和 **max up-down**。
- 像素按整像素移動，每個方向最多 127，邊緣會被拉伸填充。編譯的處理方式完全相同。

**編譯。** 生成器圖層和扭曲後的圖片圖層由頁面逐幀渲染。扭曲後的影片圖層會得到兩個貼圖影片（橫向和上下，無損儲存）。編譯用它們移動每個影格的像素，因此結果與畫布一致。

## DLSS 5：影片增強、放大和影格生成（2.504.0）
<!-- en: dlss-5-enhance-upscale-and-frame-generation-for-videos-2-504-0 09d0d01e3b4d -->

**⚡ DLSS 5** 透過 NVIDIA DLSS 5 處理影片，使用的是 RunningHub 的 ComfyUI 節點（與 Tim 的 「secret sauce」 工作流程最後一步相同）。它能做三件事：

- **神經渲染。** 清理並銳化畫面。Style 用於選擇觀感：default、natural（更接近原片）、cinematic（對比度更高）或 off（僅放大）。Detail 設定保留多少改動：0 保持原片，1 為完整結果，2 為更強。Structure 設定區域性細節重建。
- **放大。** 可選尺寸有 1x（DLAA：尺寸不變，畫質增強）、NVIDIA 的固定倍率 1.5x、1.724x、2x 和 3x，或 1K / 2K / 4K / 8K。選擇 1K–8K 時，DLSS 會選取能讓短邊達到 1080 / 1440 / 2160 / 4320 的最小倍率；已經達到該尺寸的影片保持 1x。與原尺寸相差超過 3x 的尺寸會被拒絕，並給出文字說明；請選擇更小的尺寸。
- **影格生成**（可選）。真正生成的中間幀，而不是混合影格：2x / 3x / 4x 幀率，或 60 fps 之類的目標幀率，最高可達原片的 6 倍。

**使用位置。**

- 預覽欄的 **⚡ DLSS 5** 按鈕作用於你正在預覽的影片。窗格會說明它將生成什麼；**⚡ Enhance** 將其加入佇列，結果會帶著原片的聲音出現在相簿中。
- 在 StoryBoard 的 ⚙ 中，設定 **Upscaler → DLSS 5**。之後場景的 ⏫ 會將其鏡次送入 DLSS 5，使用 ⚙ 中的 Upscale 解析度（720 = DLAA，1080 = 1K，1440 = 2K，2160 = 4K）。勾選 「Upscale every render」 後，每個鏡次一生成就會被送去處理。

**安裝。** 僅支援 NVIDIA RTX 顯示卡。在 Settings → ComfyUI → Video accelerators 中，按 **Install RH DLSS 5**。然後自行將 NVIDIA 的 DLL 複製到 ComfyUI/models/dlss5/；節點套件的 README 列出了這些檔名，節點套件從不下載這些檔案。重新啟動 ComfyUI。影格生成還需要在 models/dlss5/dlssg/ 中放置其專用的 worker 檔案（README 中也有說明）。

## 長影片：MiniMax H3 單次執行最長 30 秒（2.503.0）
<!-- en: long-video-one-minimax-h3-run-up-to-30-seconds-2-503-0 7f140d0ebd20 -->

以前，一個 MiniMax H3 片段是一次最長 15 秒的生成；更長的內容會以 15 秒為一段渲染後再拼接。**Long video**（長影片）可以**一次生成最長 30 秒**。單次執行能讓角色、動作和聲音保持連貫，沒有拼接點。其設定與 Tim 的 「secret sauce」 工作流程相同：在取樣器前加入三個模型補丁。

- **MiniMax low-VRAM attention**：注意力頭分組執行（4 個一組），緩衝區用完立即釋放。
- **Chunked feed-forward**：前饋步驟沿影格方向分塊執行（序列超過 4096 個 token 後分為 2 塊）。結果相同，記憶體峰值更低。
- **Comfy kitchen attention**（可選）：在前面加入 ComfyUI 的 comfy-kitchen 注意力後端。

**啟用方法。**

- **場景板：** 在 StoryBoard 的 ⚙ 中勾選 **Long video**。之後場景一次即可渲染最長 30 秒。如果同時勾選了 **Comfy Kitchen**，還會加入 kitchen 注意力。
- **提示詞面板的 Generate：** 選擇 **MiniMax H3 Long (30 s)** 影片風格，或在任意 MiniMax H3 風格中開啟 Long video（Settings → Video styles → Long video: On，或 On + comfy kitchen attention）。之後 Seconds 下方的計劃行會將 25 秒的片段顯示為一次 600 影格的執行。
- 超過 30 秒的片段仍會被拆分後拼接，每段 30 秒。
- 開啟 Long video 時會跳過 Sage attention，因為 Long video 內建注意力補丁。Spectrum 仍可與之配合使用。
- 它僅適用於 MiniMax H3；LTX 和 Wan 風格會忽略它。

**安裝。** Long video 需要較新的 ComfyUI-KJNodes。Settings → ComfyUI → Video accelerators 中有一個 **Install / update KJNodes** 按鈕。kitchen 注意力需要 ComfyUI 0.32 或更高版本，並安裝 comfy-kitchen（見其上方的 Comfy Kitchen 部分）。如果這臺機器已經因某次顯示記憶體不足的執行而記下了較低的顯示記憶體上限，該上限仍然有效。

同一窗格還可以安裝 **Yusu H3 Unified**（MiniMax H3 的單節點前端，供使用它的匯入工作流程使用）和 **RH DLSS 5**（NVIDIA RTX 增強 / 放大 / 影格生成）。對於 DLSS 5，需要你自行將 NVIDIA 的 DLL 放入 ComfyUI/models/dlss5/；節點套件從不下載它們。

該匯出的工作流程還以 8 步執行其 turbo LoRA。新增一個 turbo LoRA 並在 Basic Settings 中設定 Steps，即可獲得相同的速度。

## FLUX 3 Image Klein，以及編輯影像模式只列出編輯風格（2.502.0）
<!-- en: flux-3-image-klein-and-edit-image-mode-lists-only-edit-styles-2-502-0 950e6d848f28 -->

**FLUX 3 Image Klein** 是 Black Forest Labs 的 5.6B 開放影像模型（2026 年 10 月）。有三個新的影像風格使用它：

- **FLUX 3 Klein**：蒸餾模型，16 步，cfg 1（4 到 16 步均可）。速度快。
- **FLUX 3 Klein base**：基礎模型，約 50 步，cfg 3.5，支援真正的負面提示詞。速度較慢，LoRA 就是基於它訓練的。
- **FLUX 3 Klein edit**：根據最多 4 張參考圖編輯圖片。第 1 張圖決定輸出尺寸。在提示詞中，可以按順序用 `<ref_image_0>`、`<ref_image_1>` 等指代這些圖片。

文生圖風格也接受參考圖面板：其中有圖片時，它們會自動切換到各自的編輯工作流程圖（基礎風格切換到基礎編輯工作流程圖）。它們從不會切換到 FLUX.2 的工作流程圖。

**模型。** Settings → Setup 列出了三個檔案：蒸餾版和基礎版 int8 權重，以及 Qwen3-VL 4B 文字編碼器。VAE 使用 FLUX.2 的 `flux2-vae.safetensors`。該 Hugging Face 儲存庫需申請存取：請先在那裡接受 FLUX Kommunity 許可，並新增你的權杖。bf16 和 nvfp4 版本位於同一儲存庫；設定風格的 Model 即可使用其中之一。FLUX 3 需要 ComfyUI 0.41.0 或更高版本。使用較長、具體的提示詞時效果最好。

**編輯影像模式。** 當影像編輯器已開啟，且提示詞面板的 ▾ 設為 **Edit**、**Replace background** 或 **Compose** 時，影像風格下拉式方塊只列出能編輯圖片的風格：FLUX 3 和 FLUX.2 Klein 風格、Qwen Image Edit、FLUX.1 Kontext 等。2.549.0：在 **✨ Generate**、Refine、Fill 或 Remove 下會列出所有風格（Krea 2、SDXL …），而在 ▾ 設為 Edit 時選擇一個不能編輯的風格，會把 ▾ 切換到 Generate。關閉編輯器後，之前選擇的風格會恢復。下次編輯時，會再次選取你上次使用的編輯風格。

## 曲線時間重對應（2.501.0）
<!-- en: time-remapping-on-a-curve-2-501-0 05c7f12e32a7 -->

影片片段的 **🎬 Speed** 部分現在新增了 **⏱ Time remap**（時間重對應）。它設定在片段的每個時刻顯示源素材的哪一秒。

- **開啟後**，片段會獲得一條曲線，播放效果與目前完全相同（其速度、變速或倒放會變成關鍵影格）。開啟重對應時，速度、倒放和變速會被關閉，關閉重對應後會恢復。
- **曲線。** 橫軸是片段在時間軸上的自身時間；縱軸是顯示的源素材秒數。
  - 上升為正向播放，下降為倒放，水平為定格。越陡越快。
  - 拖曳關鍵影格可移動它。雙擊曲線可新增關鍵影格；雙擊關鍵影格可刪除它。
  - 最後一個關鍵影格的時間即片段在時間軸上的長度。
- **◇ Key** 在播放頭處、曲線目前所在位置新增一個關鍵影格。
- **❄ Freeze** 將播放頭處的影格定格為旁邊所設的秒數；片段的其餘部分隨之後移。
- **關鍵影格行**顯示所選關鍵影格的時間和源素材秒數。可輸入新值，或按 ✕ 刪除它。
- **修剪。** 縮短重對應後的片段會保留曲線中位於片段內的部分。延長片段則會定格邊緣影格。
- **聲音。** 片段的聲音跟隨曲線：畫面倒放時聲音也倒放，定格期間靜音。預覽也以同樣方式播放。

## 運動模糊、幀率分離（Posterize Time）、殘影（Echo）（2.500.0）
<!-- en: motion-blur-posterize-time-echo-2-500-0 9f159d49f8dd -->

圖層的 Properties 中現在有一個 **⏱ Time** 部分。

- **Motion blur**（運動模糊）會模糊圖層的運動（其位置、縮放和旋轉，無論來自關鍵影格、父級還是表示式）。
  - **shutter**：模糊覆蓋每影格的比例：180° 為半影格，360° 為整影格。
  - **samples**：每影格繪製運動的次數。取樣越多，模糊越平滑，但編譯越慢。
- **Posterize time** 將圖層保持在較低的幀率（例如 8 fps），呈現頓挫的定格動畫效果。其畫面和運動都會被保持。
- **Echo** 在圖層後方、它片刻之前所在的位置繪製副本，形成運動拖尾。
  - **copies**（副本數）和 **apart**（副本之間的秒數）。
  - **first**：最近副本的強度。**fade**：每個更遠的副本保留多少。
  - 在影片圖層上，編譯還會在副本中顯示較早的影格；畫布在那裡繪製的是目前影格。

**編譯。** 圖片和文字圖層由頁面烘焙。在影片圖層上，編譯執行相同的計算：

- 運動模糊：每影格對運動多次取樣並取平均。
- Posterize：保持的影格。
- Echo：放在圖層後方的延遲副本。

## 追蹤和邊角定位（2.499.0）
<!-- en: tracking-and-corner-pin-2-499-0 8adaaeec2a31 -->

**🎯 Track（追蹤，位於影片片段的 Properties 中：V1 或影片圖層）。** 選擇要跟隨的內容：

- **◎ a point**（一個點）：位置。
- **◎◎ two points**（兩個點）：位置、縮放和旋轉。
- **▢ corner pin**（邊角定位）：分別跟隨 4 個點。
- **▣ planar**（平面）：螢幕、招牌或書頁之類的平面。它的 4 個角由其內部的所有內容共同帶動，因此即使某個角被遮擋也能保持追蹤。

**追蹤**

1. 將播放頭移到要開始追蹤的位置。
2. 按 **◎ Place**，然後將點拖到清晰的細節上。每個點周圍的方框是追蹤器要尋找的圖塊；**size** 可改變其大小。
3. 按 **▶ Track**。它會以亞像素精度、按片段自身的幀率一直跟隨到片段末尾。路徑會繪製在畫布上，並列出所有未能很好識別某個點的影格。

在 **Apply to** 中選擇一個圖層，然後按 **Apply**：

- 使用一個點（或兩個點）時，圖層的位置關鍵影格（以及縮放和旋轉）會跟隨追蹤結果。將其套用到一個 **null**（空物件）上，再把其他圖層設為該空物件的子級，即可讓它們跟隨。
- 使用邊角定位或平面追蹤時，圖層會在每個影格都被**釘入**追蹤到的四個角中。把圖片或影片貼到移動的螢幕上就是這樣做的。

**▢ Corner pin（邊角定位，任意圖層的 Properties）。** 將圖層繪製到 4 個角中。

- 勾選後會以圖層自身的四個角為起點，然後使用 **✥ Edit corners** 在畫布上拖曳它們。
- 帶關鍵影格的定位（來自追蹤）在你拖曳某個角時，會在播放頭處生成關鍵影格。

**編譯。** 定位後的圖片和文字圖層由頁面烘焙。定位後的影片圖層由編譯本身進行變形，其四個角作為關鍵影格。兩者都與畫布一致。

## 貝塞爾遮罩（2.498.0）
<!-- en: b-zier-masks-2-498-0 accb2b8c4c64 -->

時間軸上的任意圖片、文字、形狀或影片圖層都可以有**遮罩**：用於決定圖層哪一部分顯示的形狀。

**用 ✒ Mask Pen 繪製遮罩（Shift+M，位於畫布的工具列中）**

- 先選取圖層（Move 工具）。
- **點選**新增一個角點。**拖曳**新增一個平滑點；拖曳會拉出其控制柄。
- 再次點選**第一個點**，或按 **Enter**，即可閉合遮罩。**Esc** 停止繪製。
- 要修改閉合的遮罩，用 Mask Pen 拖曳其點或控制柄。按住 **Alt** 可單獨移動一個控制柄。
- 這些點以在圖層自身圖片上的位置儲存，因此圖層移動、縮放或旋轉時，遮罩會隨之移動。

**✒ Masks（圖層的 Properties）**

每個遮罩包含：

- **on / off** 和 **invert**。
- **mode**：它與清單中上方遮罩的組合方式。
  - **add** 顯示更多圖層內容。
  - **subtract** 減去部分割槽域。
  - **intersect** 只保留重疊部分。
  - **difference** 保留恰好只被其中一個覆蓋的部分。
- **feather**（px）：柔和邊緣。
- **expansion**（px）：+ 擴大遮罩，− 收縮遮罩。
- **opacity**（%）。
- **◇**：在播放頭處為遮罩路徑設定關鍵影格。有兩個或更多關鍵影格時，點會從一個形狀平滑過渡到下一個；在其他時間拖曳點會在那裡新增關鍵影格。
- **✕** 刪除遮罩。

**編譯**

- 帶遮罩的圖片、文字和形狀圖層由頁面烘焙。
- 影片圖層的遮罩會變成一個灰度遮罩影片，編譯將其用作片段的透明度。當遮罩中沒有任何運動時，它只有一個影格。
- 兩種情況下，影片都與畫布一致。

## 表示式（2.497.0）
<!-- en: expressions-2-497-0 77d6c529c047 -->

畫布圖層的 Properties 中現在有一個 **ƒx Expressions** 部分。表示式是一個小公式，會在每個影格計算出某個屬性的值。

**新增表示式**

1. 選擇一個屬性：position x / y、scale（1 = 圖層的尺寸）、rotation（°）、opacity（0–1）或 anchor point。形狀圖層還會列出其形狀數值，文字圖層會列出其動畫器和路徑文字數值。
2. 選擇一個預設或保留第一個，然後按 **＋ ƒx**。
3. 在框中編輯表示式。錯誤會立即顯示；在修正之前，該屬性保持上一個有效的表示式（或其關鍵影格給出的值）。
4. **✕** 移除表示式。

**語言**（不是 JavaScript；不能執行其他任何程式碼）

- **運算：** 數字、+ − × ÷（`* /`）、`%`、`**`、括號、比較、`&&` `||` `!`，以及 `a ? b : c`。
- **多行：** 用換行或 `;` 分隔，並用 `var name = …` 定義命名值。最後一行即結果。
- **可用的值：**
  - `value`：關鍵影格或設定目前給出的值。
  - `time`：時間軸上的秒數。`t`：進入片段後的秒數。`frame` 和 `fps`。
  - `inPoint` / `outPoint`、圖片的 `width` / `height`、`index` 和 `PI`。
- **函式：**
  - `wiggle(freq, amount)`：平滑的隨機運動，每次播放都相同。
  - `loopOut()` / `loopIn()` 配合 `"cycle"`、`"pingpong"`、`"offset"` 或 `"continue"`：在最後一個關鍵影格之後或第一個關鍵影格之前重複關鍵影格。
  - `valueAtTime(time - 0.5)`：另一時刻的值（延遲）。
  - `linear` / `ease` / `easeIn` / `easeOut(t, tMin, tMax, from, to)`：將一個範圍對應到另一個範圍。
  - `clamp`、`random(min, max)`（每影格變化）、`noise(x)`、`posterize(value, step)`。
  - `layer("Null 1", "x")`：另一個圖層的 x、y、scale、rot 或 op。用於將圖層連結在一起。
  - 常用數學函式：`sin cos tan abs min max round floor ceil sqrt pow …`。`Math.sin` 也可以使用。
- **範例：**
  - `time * 90` 每秒旋轉 90°。
  - `wiggle(2, 20)` 抖動 20 px。
  - `loopOut("pingpong")` 讓關鍵影格來回往復播放，永不停止。
  - `layer("Null 1", "x") + 100` 跟隨空物件，位於其右側 100 px。

**編譯：** 由表示式驅動移動或淡入淡出的圖層會以關鍵影格的形式進入 ⚙ Compile。這些關鍵影格逐幀計算，並精簡到運動發生彎折的位置。形狀圖層和動畫文字仍像以前一樣由頁面烘焙，因此影片與畫布一致。

## 自由形狀、Merge Paths、路徑文字、漫遊關鍵影格（2.496.0）
<!-- en: freehand-shapes-merge-paths-text-on-a-path-roving-keyframes-2-496-0 731be9bb07ed -->

**✎ Freehand（自由繪製；Shift+Q，位於畫布的工具列中）。**

- 拖曳即可繪製一條路徑。它會成為一個**自由形狀圖層**，並經過精簡和平滑處理。
- 在起點處結束繪製（或按住 Shift）會生成一個閉合的填充形狀；否則就是一條描邊寬度為 4 px 的開放線條。
- **W / H** 可以拉伸它，所有形狀操作器都能作用於它。對於開放線條，Trim Paths 從一端執行到另一端。
- 繪製時按住 **Alt**，會把這次繪製的內容作為另一條路徑新增到目前選取的形狀圖層中。

**⧉ Paths 和 ⊕ Merge Paths（位於形狀圖層的 Properties（屬性）中）。**

- **＋ Path** 在同一個形狀圖層中再新增一個矩形、橢圓、星形或多邊形，它有自己的尺寸、位置和旋轉角度。
- 不開啟 Merge Paths 時，每條路徑單獨填充。
- 開啟 **⊕ Merge Paths**（合併路徑）後，這些路徑會合成一個輪廓。每條新增的路徑按其模式與之前的路徑組合：**add**、**subtract**、**intersect** 或 **exclude**。在另一條路徑內部減去的路徑會形成一個孔洞。
- 其後的操作器（Offset、Zig Zag、Trim 等）作用於合併後的輪廓。Offset 會讓輪廓向外擴展，同時讓孔洞縮小。

**〰 Text on a path（路徑文字；位於文字圖層的 ✨ Text Animators 部分）。**

- 勾選 **On a path**，然後選擇 **an arc**（圓弧）、**a circle**（圓）、**a wave**（波浪）或 **a shape layer**（形狀圖層，使用其輪廓，位於文字所在的位置）。
- 設定半徑、跨度、高度或波長。**Start %** 指定文字在路徑上的起始位置；用 ◇ 為它設定關鍵影格，可讓文字沿路徑滑動。
- **Other way** 讓文字朝相反方向排列（排在圓的內側）。
- 動畫器仍然有效：其 x 值讓字母沿路徑移動，y 值讓字母沿垂直於路徑的方向移動。
- 編譯時會將文字烘焙下來，使其與畫布上的效果一致。

**漫遊關鍵影格（📈 Graph Editor ▸ Rove）。**

- 在 Graph Editor 中選取一個位置關鍵影格，然後按 **Rove**。之後它的時間會跟隨運動路徑，使圖層在其前後不漫遊的關鍵影格之間勻速移動。
- 移動某個關鍵影格會重新計算漫遊關鍵影格的時間。第一個和最後一個位置關鍵影格永遠不會漫遊。
- 漫遊關鍵影格所設定的其他屬性（縮放、不透明度）仍保持在原來的時間。

## 顏色混合模式，以及跟隨父級的影片圖層（2.495.0）
<!-- en: colour-blend-modes-and-video-layers-that-follow-a-parent-2-495-0 3a49938eceb8 -->

**Hue、Saturation、Color 和 Luminosity。** 時間軸圖層的 **◐ Blend**（混合）清單在原有的 13 種模式之外，現在又新增了這四種顏色模式。每種模式都會把畫面拆分為亮度和顏色兩部分，然後一部分取自該圖層，另一部分取自其下方的內容：

- **Luminosity：** 把圖層的亮度套用到下方的顏色上（例如，用一張黑白紋理為場景新增明暗，而不改變場景的顏色）。
- **Color：** 把圖層的顏色套用到下方的亮度上（用於著色或重新上色）。
- **Hue：** 採用圖層的色相，保留下方內容的飽和度和亮度。
- **Saturation：** 下方顏色的濃淡程度變為圖層的濃淡程度（灰色圖層會去掉顏色）。

畫布和 ⚙ Compile 使用相同的演算法計算這些模式，因此成片與預覽完全一致。

**影片圖層可以跟隨父級。** 影片圖層 Properties 中的 **⛓ Parent**（父級）現在的用法與圖片、文字和空物件圖層相同：

- 影片會隨父級一起移動、旋轉和縮放。選擇父級時，影片在播放頭所在時刻保持原位不動。
- 編譯時，影片在螢幕上的位置、縮放和旋轉會作為關鍵影格寫入成片。系統會逐幀檢查這些值，只在運動發生轉折的地方保留關鍵影格，因此成片會與畫布保持一致。

## CAD 功能改進：CAD 按鈕、Offset、檢視立方體、選取輪廓（2.494.0）
<!-- en: the-cad-workings-refined-the-cad-button-offset-the-view-cube-picking-profiles-2- 838e05700bb9 -->

**⌬ CAD 按鈕。** 影像編輯器的工具列底部有一個 ⌬ CAD 按鈕，時間軸的工具列中也有一個。

- **影像編輯器：** 選取草圖圖層、草圖工具或 3D 實體時，CAD 工具列（Sketch · Shapes · Solid · Unreal）會自動顯示，其餘時間則不會礙事。按 ⌬ CAD（或 Window ▸ CAD Toolbar）可讓它一直顯示。
- **時間軸：** ⌬ CAD 用於顯示或隱藏預覽上方的工具列。

**繪製草圖**

- **Select** 位於 Sketch 分頁的首位（S）。
- 編輯草圖時，**Create Sketch** 會隱藏，完成後會重新出現。
- **Finish Sketch** 會選取 Move 工具，並把工具列切換到 **Solid** 分頁，便於接著拉伸。
- **從線條繼續繪製：** 用 Select 選取一條線（或圓弧），它的兩端外側會各出現一個 ＋。點選其中一個，Line 工具就會從該端繼續繪製；之後照常點選後續各點即可。

**Offset（O）現在是一個工具**

1. 點選一條線、圓弧或圓。與它首尾相連的所有線條也會一併選取；Shift+點選可新增更多。
2. 把指標移到你想要的那一側。虛線預覽會跟隨指標，Distance 框會顯示偏移的距離。
3. 點選即可生成，或者輸入距離後按 Enter。

- **F**（或 ⇄ Flip）改用另一側。
- **Esc** 取消選取。
- 現在，無論線條按哪個方向繪製，都會偏移到同一側，圓角也會保持相連（其圓弧隨其餘部分一起擴大或縮小）。
- 📐 Sketch 分頁中的 Offset… 對話方塊仍可作用於選取的物件，現在它會顯示 **Out** 或 **In**。
- 如果草圖無法接受某次偏移（或任何草圖編輯），則不會產生任何更改。

**Extrude 和 Revolve：選取輪廓**

- 當草圖包含多個閉合區域時，Extrude / Revolve 會先讓你點選要使用的區域：
  - 指標下方的區域會醒目顯示。點選可新增該區域，再次點選可將其移除，也可以使用 **All**。
  - 然後按 **Enter** 或 **✓ OK**，開啟已勾選這些區域的設定。按 **Esc** 則停止。
- 只有一個區域的草圖會直接進入設定。
- 如果你已經用 Select 選取了某個區域的線條，則會直接使用該區域。

**3D 視埠（選取實體時）**

- 無論使用哪種工具，**Shift + 中鍵拖曳**都可以環繞檢視實體。**中鍵拖曳**用於平移，**滾輪**用於縮放，與之前相同。
- **檢視立方體**位於畫布右上角：
  - 點選某個面可切換到該面的檢視，點選某個角可切換到從該角看過去的檢視。
  - 拖曳立方體可環繞檢視。
  - 它的下方有：**⌂ Home**、**⟳ Orbit**（直接拖曳實體本身）、**✋ Pan** 和 **⤢ Fit**。
- 3D 檢視圖層同樣可以用 Shift + 中鍵拖曳來環繞檢視。開啟 🖐 時，中鍵拖曳會平移其攝影機。

## 文字動畫器（2.493.0）
<!-- en: text-animators-2-493-0 18a917f6bd01 -->

文字圖層的 Properties 面板中有一個 **✨ Text Animators**（文字動畫器）部分。動畫器可以逐個對字母進行移動、旋轉、縮放、淡化、拉開間距、模糊或重新著色，讓一行文字呈現逐字打出、升起到位或波紋起伏的效果。

- **＋ Animator** 用於新增一個動畫器。可以先選擇一個預設；每個預設都已設好關鍵影格：
  - **Typewriter**：字母逐個出現。
  - **Fade up**：字母上升並淡入。
  - **Pop in**：字母從無到有地放大出現。
  - **Slide in (words)**：單詞從左側滑入。
  - **Wave**：一道波紋貫穿整行文字。
  - **Blur in**：字母由模糊變清晰。
  - **Custom**：一個空的動畫器，由你自行設定。
- **可改變的屬性：** x 和 y（px）、縮放（%）、旋轉（°）、不透明度（%）、字距（額外間距，px）、模糊（px），還可以選擇改變顏色。
- **作用於哪些字母（範圍）：**
  - **start**、**end** 和 **offset**（%）設定動畫器影響的文字部分。**amount**（%）設定影響的強度。
  - 可以按 **letters**（字母）、**words**（單詞）或 **lines**（行）起作用。
  - 形狀決定效果在範圍內如何分佈：
    - **square**：要麼生效要麼不生效，邊緣處的字母部分生效，因此打字機效果執行流暢。
    - **ramp up / ramp down**：在範圍內逐漸增強或逐漸減弱。
    - **triangle / round / smooth**：在範圍的中間最強。
- **製作動畫：** 每個數值旁都有一個 ◇，可在播放頭處為該數值設定關鍵影格。將 offset 從 −（範圍）到 100 % 設定關鍵影格，效果就會掃過整段文字。📈 Graph Editor 中也會列出這些關鍵影格。
- 一段文字可以同時套用多個動畫器：它們的位移會相加，縮放和不透明度會相乘。
- **✕** 刪除一個動畫器及其關鍵影格。
- **編譯：** 在 ⚙ Compile 之前，帶有動畫器的文字圖層會由頁面進行烘焙，因此成片與畫布上顯示的完全一致。
- 動畫器適用於普通文字圖層。使用了文字效果預設的文字會保留其預設。

## 形狀圖層及其操作器（2.492.0）
<!-- en: shape-layers-and-their-operators-2-492-0 c10cd32d3c0d -->

- **◆ Shape tool**（形狀工具；Q，位於畫布工具列中）：在畫布上拖出一個框，即可在該位置生成同樣大小的形狀圖層。按住 Shift 可使各邊等長。完成後工具會切回 Move。
- 形狀圖層的 Properties 面板包含以下設定：
  - **類型：** Rectangle（可設圓角半徑）、Ellipse、Star（角數、內半徑）或 Polygon（頂點數）。每種都有寬度和高度。
  - **Fill：** 純色或雙色漸層，可設定不透明度。
  - **Stroke：** 顏色、寬度，以及圓頭、平頭或方頭端點。
  - **操作器。** 勾選某個操作器即可啟用它並顯示其設定：
    - **✂ Trim Paths**：start、end 和 offset（%）。只繪製輪廓的這一部分。將 end 從 0 到 100 % 設定關鍵影格，即可讓形狀逐步畫出來。
    - **⧉ Repeater**：副本數和偏移；每個副本都會在前一個的基礎上再移動（x、y）、縮放（%）和旋轉（°）一步。不透明度從起始值漸變到結束值。
    - **⇲ Offset Paths** 向外擴展輪廓，取負值則向內收縮。
    - **✳ Pucker & Bloat** 將邊緣向內收攏或向外膨脹。
    - **🌀 Twist** 讓外側比中心旋轉得更多。
    - **〰 Zig Zag** 新增銳利或平滑的鋸齒。
    - **≈ Wiggle Paths** 讓輪廓隨時間抖動。
    - **◜ Round Corners** 將所有拐角變為圓角。
- **製作動畫：** 每個數值旁都有一個 **◇**，用於在播放頭處為該數值設定關鍵影格。數值設定關鍵影格後，再修改它就會在播放頭處再次設定關鍵影格，與位置的用法相同。📈 Graph Editor 會列出已設定關鍵影格的形狀數值，方便你調整其緩動。
- **編譯：** 在 ⚙ Compile 之前，頁面會逐幀烘焙每個形狀圖層，與畫布上繪製的完全一致。未更改的形狀不會重新烘焙。

## 混合模式和軌道遮罩（2.491.0）
<!-- en: blend-modes-and-track-mattes-2-491-0 7f19a0157d79 -->

在影片或圖片圖層上選取一個片段。Properties 面板中有兩個新設定，它們作用於該片段所在的整個**圖層**：

- **◐ Blend** 設定圖層與其下方內容的混合方式：Normal、Multiply、Screen、Overlay、Darken、Lighten、Color Dodge、Color Burn、Hard Light、Soft Light、Difference、Exclusion 或 Add。
  - 例如，以 Screen 模式把一段漏光影片疊加到鏡頭上，或以 Multiply 模式疊加一張紙張紋理。
- **▣ Matte**（遮罩）讓該圖層只在**緊鄰其上方**的圖層所在之處顯示（遮罩圖層的名稱顯示在選單旁邊）：
  - **Alpha**：遮罩圖層有畫面的地方（依據其透明度）。
  - **Alpha Inverted**：遮罩圖層沒有畫面的地方。
  - **Luma**：遮罩圖層明亮的地方。
  - **Luma Inverted**：遮罩圖層暗的地方。
- 遮罩圖層本身不再被繪製。即使將其隱藏，它仍然作為遮罩起作用。
  - 例如，在影片圖層上方放一個文字圖層，並給影片圖層設定 Alpha 遮罩：影片就會在字母內部播放。
- 編輯時，畫布會同時顯示兩者。播放時，這些圖層採用繪製方式呈現。
- 編譯時會繪製出相同的畫面。

## 父子關係和空物件（2.490.0）
<!-- en: parenting-and-null-objects-2-490-0 2b2f87d37a9d -->

- **⛓ Parent**（父級；位於圖片、文字或空物件圖層的 Properties 中）讓該圖層跟隨另一個圖層。
  - 子圖層會隨父級一起移動、旋轉和縮放，但不會繼承父級的不透明度。
  - 選擇父級時，圖層在螢幕上的位置保持不變：其位置、旋轉和縮放（以及相應的關鍵影格）會轉換到父級的座標空間中。
  - 選擇 **none** 時，會以相反方向進行同樣的轉換。
  - 支援鏈式關係：父級本身也可以有父級。圖層永遠不能跟隨自身或它自己的子圖層。
  - 影片圖層可以作為父級，但不能跟隨父級。
- **＋ Null** 新增一個空的控制圖層，長度與時間軸相同。
  - 它沒有畫面，也永遠不會被編譯。畫布上它顯示為一個帶十字的紅色虛線方框。
  - 為空物件設定關鍵影格（位置、旋轉、縮放），然後將其他圖層的父級設為它，即可讓這些圖層一起移動。
- 在畫布上拖曳有父級的圖層時，無論其父級如何運動，圖層都會按你拖曳的方向移動。
- **編譯：** 在 ⚙ Compile 之前，每個有父級的圖層都會被烘焙。頁面會按畫布上顯示的樣子逐幀繪製，並將其作為透明影片儲存在專案中（video/tlb_….webm），編譯時再將其疊加。自上次烘焙以來沒有更改的圖層不會重新烘焙。

## Graph Editor、Easy Ease、錨點和曲線運動路徑（2.489.0）
<!-- en: the-graph-editor-easy-ease-the-anchor-point-and-curved-motion-paths-2-489-0 af4477b378d5 -->

在時間軸的畫布上選取一個圖片、文字或影片圖層。其 Properties 面板現在新增了以下功能：

- **⊕ Anchor X / Y**（錨點）：圖層的位置值所定位的點，也是縮放和旋轉的軸心。它以距圖層中心的像素數來計量。更改錨點時圖層保持原位，因為其位置會相應移動。如果位置已設定關鍵影格，則圖層會隨之移動。錨點也可以設定關鍵影格（在 Graph Editor 中雙擊 Anchor X 或 Anchor Y 曲線圖）。
- **Easy Ease**（F9）對播放頭處的關鍵影格進行緩入和緩出，使圖層在進入和離開該關鍵影格時減速。**Ease In** 和 **Ease Out**（Shift+F9 / Ctrl+Shift+F9）只作用於其中一側。
- **📈 Graph** 開啟 **Graph Editor**（曲線編輯器），這是一個可以拖曳到任意位置的面板：
  - 選擇一個屬性：Position X / Y、Scale、Rotation、Opacity 或 Anchor X / Y。已設定關鍵影格的屬性標有 ◆。
  - **value** 顯示該屬性在片段時間內的數值變化；**speed** 顯示其變化的快慢。
  - 拖曳 ■ 關鍵影格可以更改其時間和數值。點選關鍵影格可將其選取。
  - 選取關鍵影格的補間會顯示兩個 ● 手柄。拖曳手柄可調整曲線形狀：慢起、快收，甚至過沖。**Easy Ease**、**Linear** 和 **Hold** 可一鍵設定選取的補間。
  - 雙擊曲線圖可在該處新增關鍵影格。Delete 刪除選取的關鍵影格，F9 對其套用 Easy Ease。
- **↝ Smooth path** 為每個位置關鍵影格新增平滑手柄，使圖層沿一條穿過這些關鍵影格的曲線運動。
  - **運動路徑**在畫布上顯示為一條虛線，每個關鍵影格處有一個 ■。
  - 拖曳 ■ 可移動該關鍵影格。Alt+拖曳 ■ 可拉出其手柄。
  - 拖曳 ● 手柄可彎曲路徑。Alt+拖曳手柄則只彎曲一側。
- 關鍵影格緩動選單中新增了 **Bézier (📈 graph)** 項。
- 編譯時繪製的曲線、錨點和路徑與畫布上顯示的一致。

## PDF 頁面的新增、刪除和移動；無需下載的 Select Subject——第 H 輪（2.488.0）
<!-- en: pdf-pages-added-taken-out-and-moved-select-subject-without-a-download-round-h-2- 4abc5a306270 -->

**PDF 頁面。** 開啟 PDF 時，Pages 欄中的頁面下方有一排按鈕。它們作用於目前開啟的頁面。

- **＋ Page** 在目前頁面之後新增一個與其大小相同的空白頁。
- **⤓ PDF…** 將另一個 PDF 的所有頁面新增到目前頁面之後。
- **▲ / ▼** 將目前頁面上移或下移。也可以在頁面列中把某個頁面拖到新的位置。
- **🗑** 刪除目前頁面，並轉而開啟它的前一頁或後一頁。如果該頁有改動，會先徵求你的確認。
- 同樣的命令也位於 File ▸ Add / Remove PDF Pages 下。
- **💾 Save PDF** 按新的順序寫入頁面。未改動的頁面會按原樣複製（包括文字、向量圖形等全部內容）。改動過的頁面和新頁面則儲存為圖片加真實文字。

**Select ▸ Subject** 一步選取圖片的主體，無需輸入任何內容。

- **Built in** 無需下載即可直接使用。它從圖片邊緣學習背景，從與背景不同的部分識別主體，然後讓選取範圍貼合真實的邊緣。它最適合主體清晰、背景較簡單的圖片，對於立於圖片底邊的主體（如人像）同樣有效。
- **AI matte** 使用本機上的 BiRefNet，與路徑圖層的 AI matte 共用同一套安裝（約 1 GB，只需安裝一次）。它能更好地處理頭髮、毛髮和雜亂的背景。
- **Select ▸ Subject Settings…** 用於選擇方法：**Auto**（已安裝 AI matte 時使用它，否則使用內建方法）、**Built in** 或 **AI matte**。它還可以選擇 AI 模型，並提供 **⬇ Install**。
- **Layer ▸ Remove Background** 執行相同的操作，但會把主體放入目前圖層的遮罩中，因此背景是被隱藏而不是被刪除。在遮罩上繪製即可修正邊緣。
- Select Subject 和 Remove Background 各算一個復原步驟。
- 按文字描述選擇（Segment Anything）現在位於 **Select ▸ Subject by Words…**。

## Image ▸ Mode、Proof Colors、Gamut Warning、CMYK TIFF——第 G 輪（2.487.0）
<!-- en: image-mode-proof-colors-gamut-warning-cmyk-tiff-round-g-2-487-0 91dd0f6e5070 -->

**Image ▸ Mode** 設定文件的圖片類型。每次更改模式都算一個復原步驟，模式會儲存在文件的 .bgi 檔案中。

- **Grayscale**：所有像素圖層都變為灰度。之後繪製的任何內容也會顯示為灰色，無論是在螢幕上還是匯出時。
- **Duotone…**：用一到四種油墨印刷的灰度圖片（單色調、雙色調、三色調、四色調）。
  - 為每種油墨選擇顏色。其曲線滑桿可讓該油墨在中間調中多一些（向右）或少一些（向左）。
  - 預設：Sepia、Blue duotone、Cyanotype、Gold tritone、Warm quadtone 和 Black。
  - 圖層中儲存的是灰度圖片，因此之後仍可更改油墨。
- **Indexed Color…**：最多 256 種顏色。所有圖層會合併為一個 **Index** 圖層。
  - 調色盤：Local（由圖片生成）、Web（216）、Uniform、Grey 或 Black and white。
  - 仿色（擴散或圖案）及其數量；保留透明度，或將圖片置於白色背景上。
  - **Color Table…** 顯示所有顏色。點選某種顏色可在所有用到它的地方統一更改，也可以儲存和載入 .act 顏色表。
- **Bitmap…**：僅有黑白兩色。圖片會合併到白色背景上，可選擇 50 % 閾值、圖案仿色、擴散仿色或半調網屏（網格大小和角度）。
- **CMYK Color…**：顏色限制在印刷機能夠再現的範圍內。
  - 選擇銅版紙、膠版紙或新聞紙，黑版生成（從無到最大）以及總墨量限制。
  - 印刷機無法印出的顏色（如螢幕上鮮豔的綠色和藍色）會移到它能印出的最接近的顏色。
  - **File ▸ Export As ▸ TIFF (CMYK, for print)** 寫出四色油墨資料，供印刷廠使用。Info 面板中的 C M Y K 讀數使用同一模型。
- **RGB Color** 恢復為全彩。所離開模式的效果會保留在像素中。
- **8 Bits/Channel** 是這裡唯一的位深度，因為瀏覽器的畫布每通道只能儲存 8 位。沒有 16 位或 32 位文件。

**View ▸ Proof Setup…** 用於選擇要模擬的印刷機（紙張、黑版生成、總墨量）、是否模擬紙張顏色，以及色域警告的限值和顏色。這些設定只改變螢幕上的顯示效果：

- **View ▸ Proof Colors**（Alt+Ctrl+Y）按該印刷機印出的效果顯示圖片。
- **View ▸ Gamut Warning**（Shift+Ctrl+Y）用警告色（預設為灰色）標出印刷機無法印出的顏色。在 Info 面板中，C M Y K 數值後面的「!」也表示同樣的意思。
- 這裡的印刷機只是對紙張上印刷油墨的簡單模擬，並不是 ICC 色彩描述檔。可以用它來發現問題，準確的顏色請以印刷廠的打樣為準。

## Auto-Align Layers、Auto-Blend Layers、Photomerge、Merge to HDR——第 F 輪第 2 部分（2.486.0）
<!-- en: auto-align-layers-auto-blend-layers-photomerge-merge-to-hdr-round-f-part-2-2-486 1ca593a90e33 -->

這四項功能會自動計算圖片之間如何拼合。它們會在每張圖片中找出細小的細節（角點），在圖片之間進行匹配，然後計算出能讓圖片對齊的平移、旋轉、縮放或透視變換。圖片之間需要有一些共同的細節。純色的天空或空白的牆面沒有可供匹配的內容。

- **Edit ▸ Auto-Align Layers…** 對齊你選取的圖層（在 Layers 中 Ctrl+點選）；如果沒有選取任何圖層，則對齊所有可見的像素圖層。
  - **Layout**：Auto 或 Perspective（平移、旋轉、縮放和透視）、Move, turn and scale，或 Reposition（僅平移）。
  - **Line up on**：中間圖層、目前圖層或底部圖層。該圖層保持不動。
  - 無法匹配的圖層保持原位，狀態列會顯示這類圖層的數量。整個操作算一個復原步驟。
- **Edit ▸ Auto-Blend Layers…** 為每個圖層新增一個遮罩，顯示該圖層被採用的區域。之後可以在遮罩上繪製。
  - **Panorama**：每一處都取自它位於其中最深處的那個圖層，接縫柔和。**Seamless tones and colours** 會使各圖片之間的亮度和顏色保持一致。
  - **Stack Images**：每一處都取自該處最清晰的圖層。用於焦點堆疊（同一畫面拍攝多次，每次對焦在不同的距離）。請先對齊圖層。
- **File ▸ Automate ▸ Photomerge…** 拼接全景圖。可以選擇檔案，也可以使用已開啟的文件。
  - 圖片之間應重疊約三分之一。
  - 結果是一個新的 **Panorama** 文件，每張圖片一個圖層，已擺放到位，並且（開啟 **Blend the pictures together** 時）已新增遮罩。
  - 與其他圖片都不重疊的圖片會被排除，狀態列會給出提示。
  - 過寬的結果會縮放到 8000 像素以內。
- **File ▸ Automate ▸ Merge to HDR…** 接收包圍曝光的照片（同一場景分別以偏暗、正常和偏亮的曝光拍攝），並將其融合為一張曝光良好的圖片。
  - 每一處主要取自該處最清晰的那張曝光：對比度好、顏色好、既不過暗也不過亮。
  - 開啟 **Line the pictures up first** 時，會校正各次拍攝之間輕微的攝影機移動。
  - 結果是一張普通的 8 點陣圖片，而不是 32 位 HDR 檔案。

## 更多檔案類型、File Info、Print、Contact Sheet、Crop and Straighten Photos——第 F 輪（2.485.0）
<!-- en: more-file-types-file-info-print-contact-sheet-crop-and-straighten-photos-round-f a25d899d3dee -->

- **File ▸ Export As** 現在除 PNG、JPEG、WebP 和 JPEG XL 外，還可以寫出 **AVIF**、**GIF**、**TIFF**、**BMP** 和 **TGA**。
  - GIF 最多保留 256 種顏色（經過仿色處理，因此漸層保持平滑），並為透明區域保留一種透明色。
  - TIFF、BMP 和 TGA 保留每個像素以及透明度。對於 TIFF 和 TGA，預覽中會顯示圖片，因為瀏覽器本身無法顯示這些檔案。
  - AVIF 由本機上的 ffmpeg 生成（需要 AV1 編碼器：libaom-av1、libsvtav1 或 librav1e），並帶有品質滑桿。AVIF 檔案儲存時不含透明度。
- **File ▸ File Info…**（Alt+Shift+Ctrl+I）：標題、作者、描述、關鍵詞、版權和來源 URL。這些資訊隨文件一起儲存（也儲存在其 .bgi 檔案中），並寫入匯出的 PNG 檔案（作為文字區塊）和 JPEG 檔案（作為 XMP），因此其他程式也能顯示這些資訊。
- **File ▸ Print…**（Ctrl+Shift+P；Ctrl+P 用於把提示詞面板調到最前面）：縮放以適合頁面、以 cm 或英吋指定尺寸，或按百分比縮放；縱向、橫向或與圖片方向一致。點選 OK 會開啟系統的列印對話方塊，你可以在其中選擇印表機、紙張和份數，或另存為 PDF。
- **File ▸ Automate ▸ Contact Sheet…**：把多張圖片以網格形式排列到一個新文件上。可以選擇檔案或使用已開啟的文件；選擇頁面（A4、Letter 或 1920 x 1080）、欄數和列數、邊距，以及顯示檔名的圖注。每張圖片單獨佔一個圖層；圖片多到一頁放不下時會另起一頁。
- **File ▸ Automate ▸ Crop and Straighten Photos**：適用於一次掃描了多張照片的掃描件。程式會以純色的頁面為背景找出每張照片，將其擺正，並分別作為獨立的文件開啟（命名為「<scan> photo 1」「photo 2」……）。

## Brush Settings、畫筆預設和 .abr 畫筆——第 E 輪（2.484.0）
<!-- en: brush-settings-brush-presets-and-abr-brushes-round-e-2-484-0 55f043131c33 -->

**🖌 Brush** 分頁（位於 Properties 組中；也可透過 Window ▸ Brush Settings 開啟）用於設定 Brush、Pencil 和 Eraser 工具所使用的畫筆。

- 頂部的**預設**：bitGen 內建的 20 個、你自己建立的，以及你匯入的。點選即可使用。
  - **⤒ Import .abr…** 從畫筆檔案（.abr 版本 1、2、6、7 和 10）中匯入取樣畫筆。每個取樣畫筆都會成為一個繪製其圖案的預設。
  - **💾 New Brush Preset…** 以一個名稱儲存目前畫筆及其全部設定。你的預設位於安裝資料夾中的 **brushes/<name>.json**；複製這些檔案即可分享。
  - **🗑 Delete** 刪除你自己的某個預設；**↺ Reset** 將內建預設恢復為初始狀態。
- **Brush Tip Shape**：Angle、Roundness（扁平的書法筆尖）、Hardness、Spacing、Flip X / Y。
- **Shape Dynamics**（勾選該部分即可啟用）：Size jitter + 最小直徑；Size control（關閉、筆壓，或在 N 步內漸隱）；Angle jitter + Angle control（關閉、筆畫方向、筆壓）；Roundness jitter + 最小值；Flip X / Y jitter。
- **Scattering**：Scatter（佔畫筆尺寸的百分比，沿筆畫的橫向或兩個軸向）、Count、Count jitter。
- **Texture**：Noise、Canvas、Paper，或圖案庫中的任意圖案。Scale、Depth、Multiply / Subtract、Invert。紋理固定在圖片上。
- **Dual Brush**：第二個筆尖（任意預設）切入第一個筆尖，可設定其尺寸、散佈和數量。
- **Color Dynamics**：前景 / 背景抖動；色相、飽和度和亮度抖動；Purity；按每個筆尖套用，或每個筆畫只套用一次。
- **Transfer**：Opacity jitter、Flow jitter、由筆壓控制。
- **Smoothing**（0-95 %）：畫筆像被一根繩子牽著一樣跟隨指標，使線條更穩定。
- 每個預設都儲存自己的設定：內建預設儲存在本機的編輯器設定中，你自己的預設儲存在其檔案中。

## Navigator、Histogram、Info、測量工具、Grow / Similar / Focus Area、Matting——第 D 輪（2.483.0）
<!-- en: navigator-histogram-info-measuring-tools-grow-similar-focus-area-matting-round-d d4bf1da10324 -->

- **面板**（Color 組中的分頁，以及 Window 選單）：
  - **Navigator**：整張圖片的縮圖，目前檢視以紅框表示。在其上點選或拖曳可移動檢視；滑桿用於縮放。
  - **Histogram**：整張圖片或選取圖層（有選取範圍時僅統計選取範圍內）的 RGB、Luminosity、Red、Green、Blue 或 Colors 直方圖。它顯示 Mean、Std dev、Median 和 Pixels，以及指標所在處的色階、數量和百分位。
  - **Info**：指標所在處的 RGB、HSB 和 CMYK 值以及 X、Y 位置。它還顯示文件尺寸、選取範圍的尺寸和位置、標尺的長度和角度，以及每個顏色取樣器的顏色。
  - **Notes**：圖片上的所有註釋；⌖ 跳轉到註釋，✕ 刪除註釋，雙擊可編輯註釋。
- 吸管工具組中的**工具**（**I**，Shift+I 循環切換）：
  - **Color Sampler**：點選可放置最多 10 個取樣器，拖曳可移動取樣器；Alt+點選可將其刪除。Info 面板會讀取這些取樣器，Sample size 可以是單點、3 x 3 或 5 x 5。
  - **Ruler**：拖曳進行測量（按住 Shift 以 45° 為步進）。**↻ Straighten Layer** 旋轉目前圖層，使測量線變為水平（或垂直）；**↻ Straighten Picture** 旋轉所有圖層。
  - **Note**：點選可釘上一條註釋（附帶作者）；點選註釋可編輯，Alt+點選可刪除。
  - **Count**：點選可在帶顏色的計陣列中放置編號標記（＋ Group、顏色、大小）。選項列會顯示計數；Alt+點選會刪除最近的標記。
- **Perspective Crop**（位於 Crop 工具組中，**C**）：拖出一個框，把它的四個角移到最終應成為方正形狀的物體邊緣（如招牌、檔案、建築的正立面），然後按 **Enter**。整張圖片會連同所有圖層一起被裁切並校正為方正。整個操作算一個復原步驟。
- **Select ▸ Grow**（擴展到 Magic Wand 容差範圍內的相鄰像素）、**Similar**（所有與已選像素相似的像素）、**Focus Area…**（清晰的部分：In-focus range + Softness，即時預覽）、**Transform Selection…**（移動、縮放和旋轉選取範圍本身）。
- **Layer ▸ Matting**：**Defringe…**（邊緣像素採用相鄰實色像素的顏色）、**Remove Black Matte**、**Remove White Matte**。
- 取樣器、註釋和計數標記屬於各自的文件，並儲存在該文件的 .bgi 中。

## Develop Filter 和 Lens Correction——影像編輯器功能補齊，第 C 輪（2.482.0）
<!-- en: the-develop-filter-and-lens-correction-the-image-editor-s-gap-round-c-2-482-0 e1ab499734e9 -->

- **Filter ▸ Develop Filter…**（**Alt+Shift+Ctrl+A**）是整合在一個對話方塊中的照片沖印工具。它可以即時預覽，在選取範圍內生效，算一個復原步驟，並在智慧型物件上成為智慧型濾鏡。它的分頁如下：
  - **Basic**：Temperature、Tint、Exposure、Contrast、Highlights、Shadows、Whites、Blacks、Texture、Clarity、Dehaze、Vibrance、Saturation；**Black & White**；**✨ Auto** 根據圖片自動設定曝光、對比度、白色和黑色。
  - **Curve**：Highlights / Lights / Darks / Shadows 滑桿，以及點曲線（RGB、Red、Green、Blue）。
  - **Color**：顏色混合器：選擇 Red、Orange、Yellow、Green、Aqua、Blue、Purple 或 Magenta，然後更改其 Hue（±30°）、Saturation 和 Luminance。在 Black & White 模式下，Luminance 決定每種顏色轉換後的明暗。
  - **Grading**：為 Shadows、Midtones 和 Highlights 著色（色相、飽和度、明亮度）；Blending 和 Balance。
  - **Detail**：Sharpening（數量、半徑、細節、遮罩：0 = 所有區域，數值越大 = 越只作用於邊緣）、Noise reduction、Color noise reduction。
  - **Optics**：Distortion、Vignetting（+ 中點）、Defringe 紫邊 / 綠邊。
  - **Geometry**：Vertical / Horizontal perspective、Rotate、Scale、X / Y offset。
  - **Effects**：Grain（數量、大小、粗糙度）和裁切後暗角（數量、中點、圓度、羽化）。
  - **Presets**：Vivid、Matte、Warm film、Cool night、Portrait soft、Landscape punch、Black & White、Teal & orange。**💾 Save as preset** 儲存你自己的預設（儲存在編輯器設定中），**↺ Reset all** 清除所有設定。
- **Filter ▸ Lens Correction…**（**Alt+Shift+Ctrl+R**）：消除畸變（桶形 / 枕形）、修復紅 / 青和藍 / 黃色邊、暗角（數量、中點）、垂直 / 水平透視、角度、縮放，以及 **Edge** 的填充方式（邊緣擴展、透明、某種顏色）。對話方塊開啟時，圖片上方會顯示**網格**，便於校正水平。

## 新增 44 個濾鏡——影像編輯器功能補齊，第 B 輪（2.481.0）
<!-- en: 44-more-filters-the-image-editor-s-gap-round-b-2-481-0 7aabbf06ed3d -->

**Filter** 選單現在有十二個子選單：Artistic、Blur、Blur Gallery、Distort、Noise、Other、Pixelate、Render、Sharpen、Sketch、Stylize 和 Texture。每個濾鏡都可以即時預覽、在選取範圍內生效、算一個復原步驟，可以用 **Ctrl+F** 重複、錄製到動作中，並在智慧型物件上成為**智慧型濾鏡**。

- **Blur**：**Surface Blur**（在保留邊緣的同時進行平滑：Radius + Threshold）、**Smart Blur**（Normal / Edge Only / Overlay Edge）、**Average**、**Lens Blur**（依據透明度或亮度確定深度、焦距、光圈形狀（圓形、3-8 片光圈葉片）、葉片旋轉、用於散景的鏡面高光、雜色）。
- **Blur Gallery**：**Field Blur**（兩到三個圖釘，每個都有自己的模糊程度）、**Iris Blur**（一個保持清晰並向外漸隱的橢圓；**點選圖片可放置其中心**）、**Path Blur**（沿曲線的運動模糊：起點、彎曲、終點、速度、漸細）、**Spin Blur**（繞一個橢圓旋轉一定角度；點選可放置）。
- **Noise**：**Reduce Noise**（強度、保留細節、顏色雜色、銳化細節）、**Dust & Scratches**（半徑 + 閾值）、**Despeckle**。
- **Sharpen**：**Smart Sharpen**（數量、半徑、減少雜色；按角度移除高斯模糊、鏡頭模糊或動感模糊；在陰影 / 高光中減弱銳化）。
- **Other**：**High Pass**、**Minimum**、**Maximum**（方形或圓形）、**Offset**（折回 / 重複邊緣像素 / 透明）、**Custom**（自訂 5 x 5 卷積核，帶有預設、縮放和偏移）、**HSB / HSL**。
- **Distort**：**Displace**（使用來自某個圖層或合併圖片的置換圖：紅色通道橫向移動像素，綠色通道上下移動像素）、**Polar Coordinates**（雙向轉換）、**Pinch**、**ZigZag**、**Shear**（透過頂部 / 中部 / 底部進行彎曲）、**Glass**（磨砂、塊狀、畫布、小鏡頭）。
- **Pixelate**：**Color Halftone**（C / M / Y / K 網點按各自的角度排列）、**Crystallize**、**Pointillize**、**Facet**、**Fragment**、**Mezzotint**（點、線、描邊）。
- **Render**：**Lighting Effects**（聚光燈、點光源或無限光；顏色、強度、光源位置和照射方向、光錐 + 熱點、環境光、光澤；根據亮度或透明度生成高度紋理）、**Fibers**、**Difference Clouds**。
- **Stylize**：**Diffuse**（正常、僅變暗、僅變亮、各向異性）、**Tiles**、**Trace Contour**。
- **Artistic**：**Cutout**、**Poster Edges**、**Watercolor**、**Dry Brush**。**Sketch**：**Graphic Pen**、**Charcoal**。**Texture**：**Grain**（7 種）、**Craquelure**。

## 更多調整和 Apply Image——影像編輯器功能補齊，第 A 輪（2.480.0）
<!-- en: more-adjustments-and-apply-image-the-image-editor-s-gap-round-a-2-480-0 e925d9f90010 -->

**Image ▸ Adjustments** 中的新功能。每一項都可以即時預覽、在選取範圍內生效、算一個復原步驟，並可以用 Ctrl+F 重複、用作智慧型濾鏡或錄製到動作中：

- **Shadows / Highlights**：*區域性*提亮陰影並壓暗高光。**Amount** 設定調整的程度，**Tone** 設定作用延伸到中間調的範圍，**Radius** 設定所參考的鄰域大小。**Color correction** 恢復被更改區域的顏色，**Midtone contrast** 作用於兩者之間的區域。
- **HDR Toning**：在單張圖片上實現「HDR 效果」。**Edge glow**（半徑 + 強度）使整張圖片的光線均勻，然後用 **Gamma**、**Exposure**、**Detail**、**Vibrance** 和 **Saturation** 完成處理。
- **Selective Color**：選擇一個範圍（**Reds, Yellows, Greens, Cyans, Blues, Magentas, Whites, Neutrals, Blacks**），然後在其中增加或減少 **Cyan, Magenta, Yellow and Black**。**Relative** 按現有油墨量的比例進行調整；**Absolute** 直接加上設定的數值。
- **Replace Color**：**點選圖片**拾取顏色（或手動設定），設定 **Fuzziness** 以決定顏色需要多接近，然後調整其 **Hue / Saturation / Lightness**。
- **Match Color**：讓圖層採用另一來源的顏色：**Source** = 另一個圖層、合併圖片或某個圖片檔案（🖼…）。然後設定 **Luminance**、**Color intensity**、**Fade**，並用 **Neutralize** 去除色偏。
- **Color Lookup**：3D LUT。選擇時間軸的某個 **looks**（調色效果），或 LUT 庫中的某個 **.cube**（與時間軸的 Colour 面板共用）；**＋ .cube…** 可新增你自己的檔案。**Amount** 控制混合的程度。
- **Image ▸ Apply Image…**：將另一個圖層（或合併圖片），或其某個通道（RGB、Red、Green、Blue、alpha、luminosity），以反相或不反相的方式混合到目前圖層上。共有 11 種混合模式，另有 Opacity 和 Preserve transparency。
- **調整圖層**：新增 **Selective Color** 和 **Color Lookup**（Layer ▸ New Adjustment Layer，以及 Adjustments 面板）；在 Properties 中編輯它們。

## JPEG XL（.jxl）圖片（2.479.0）
<!-- en: jpeg-xl-jxl-pictures-2-479-0 2d2afe86f852 -->

- 像開啟其他圖片一樣，在影像編輯器中 **Open**（開啟）.jxl 檔案：File ▸ Open、拖放到畫布上、Place，或從專案中開啟。其像素會原樣匯入（每通道 8 位，sRGB；動畫檔案取第一個影格）。
- **Export As ▸ Format: JPEG XL**：**Quality**（1-100），或 **Lossless**（精確保留每個像素，並且通常比 PNG 小得多）。可以 ⤓ Download，或使用 **Save to Images**，將其作為 .jxl 儲存到專案的圖片中。
- **應用程式的其他部分**：.jxl 圖片可以顯示在 Assets 面板、相簿、媒體檢視器、檔案對話方塊的預覽以及時間軸上。瀏覽器本身無法顯示 JPEG XL，因此工作室會向顯示它的地方提供該圖片的 PNG 版本。直接讀取檔案本身的功能則會得到 .jxl。
- **生成和編譯**：用作參考圖的 .jxl 會以 PNG 形式傳送給 ComfyUI（ComfyUI 無法讀取 JPEG XL）。仍在時間軸上的 .jxl 會使用其 PNG 版本進行編譯。上傳到專案圖片以外任何位置的 .jxl 都會以 PNG 形式存放。
- 一切都在本機上執行：編解碼器（讀取用 jxl-oxide，寫入用 libjxl）位於 static/vendor/jxl/。

## 在所有下拉式清單中搜尋（2.478.0）
<!-- en: search-in-every-dropdown-list-2-478-0 e687afbd4caf -->

- 所有**包含 8 個或更多專案的下拉式清單**——無論位於面板、影像編輯器、時間軸、Settings 還是任何對話方塊中——開啟時頂部都有一個 **🔍 搜尋框**，與節點搜尋類似：
  - **輸入**文字，清單會隨輸入逐步縮小，最佳匹配排在最前：先是詞首匹配，然後是任意位置匹配，最後是按順序出現的字母（「flx2」可以找到「FLUX.2 [dev]」）。匹配的字母會醒目顯示，輸入分組的名稱可以找到該組中的專案。「12 of 340」顯示剩餘的專案數。
  - **↑ ↓**、**PgUp / PgDn**（Ctrl+Home / Ctrl+End 跳到第一行 / 最後一行）移動反白行；按 **Enter** 或**點選**即可選取該行；**Tab** 選取反白行並移到下一項；按 **Esc** 或點選清單外部會關閉清單，且不做任何更改。
  - 當某個清單獲得焦點時，按**任意字母**即可將其開啟並直接搜尋該字母；**Alt+↓**、**F4**、**Space** 或 **Enter** 可開啟清單；↑ ↓ 仍可在不開啟清單的情況下逐項切換。
- **Settings ▸ General ▸ Dropdown lists**：「Search in lists with N or more items」（預設為 8；**0** = 始終使用普通清單）。該設定儲存在目前瀏覽器中。

## 公開測試版：程式碼儲存庫、哪些功能是實驗性的、報告問題（2.477.0）
<!-- en: the-public-beta-the-repository-what-is-experimental-reporting-a-problem-2-477-0 98895596651d -->

- bitGen Studio 現已進入**公開測試版**階段，並擁有自己的程式碼儲存庫：其中包括原始碼、各類指南、Feature Reference PDF、更新日誌（**CHANGELOG.md**，涵蓋每個版本），以及 **Releases** 頁面上的安裝程式。
- **docs/BETA.md** 說明了哪些功能已經穩定、哪些仍是**實驗性**的：Unreal Engine 橋接（針對 Unreal 5.8 編寫，已在替代環境中測試，尚未在真正的 Unreal Editor 中測試）、Daz Studio 即時連結、Unreal 透明渲染，以及 macOS（MiniMax H3 影片需要 NVIDIA CUDA）。
- **報告問題**：使用 **Bug report** 範本建立一個 issue。請提供版本號（package.json，或你下載的發行版）、作業系統 / 顯示卡、你做了什麼以及發生了什麼（附截圖或簡短的螢幕錄影），以及 Console 面板的最後幾行內容。如果涉及 Unreal 橋接，請附上 Unreal Output Log 中的 `[bitGen Bridge]` 行。**切勿**公開你的 custom.settings（其中包含你的資料夾路徑和權杖）。
- **更新**：下載更新的發行版，或執行 `git pull`，然後重新執行 start.bat / misc/bitgen-studio.sh。你的專案、設定、模型和風格都不在程式碼儲存庫中，因此更新不會影響它們。
- **參與貢獻**：CONTRIBUTING.md 介紹了環境搭建、程式碼的存放位置（routes/ + lib/，每個面板都是 ext/ 中的一個擴充功能）、測試（`bash scripts/ci-units.sh`——GitHub 在每次推送時都會執行它），以及需要同步更新的文件。

## Unreal 燈光、體積光與霧——在影像編輯器和時間軸中（2.476.0）
<!-- en: unreal-lights-volumetric-lights-and-fog-in-the-image-editor-and-the-timeline-2-4 722949754ccd -->

- **更新外掛**為 **bitgen-ue-bridge-1.2.0.zip**（燈光和霧由它放置）。
- 對 Unreal 或 MetaHuman 圖層使用 **Image editor ▸ UNREAL ▸ Lights & Fog**（或 Properties 中的 **💡 Lights** 分頁，Window ▸ Unreal Lights）：
  - **＋ Lights from a preset**（從預設新增燈光）：Three-point（三點布光：主光、補光、輪廓光）、Golden hour（黃金時刻：低角度的暖色太陽 + 天空光）、Night street（夜晚街道：一盞暖色聚光燈 + 冷色補光）、Neon（霓虹：品紅 + 青色矩形燈，配合體積霧）、Studio softbox（影棚柔光箱）。
  - **＋ Point / Spot / Rect / Sun / Sky**：為攝影機放置一盞新燈——位於前方、偏上並偏向一側，對準拍攝主體。
  - 每盞燈可設定：**顏色**或以開爾文表示的**色溫**、**強度**（坎德拉；太陽光為勒克斯）、**照射範圍**、**柔和尺寸**、聚光燈的**錐角**、矩形燈的**尺寸**、**Volumetric**（體積光，即它照亮體積霧的強度——形成光束）、**陰影**、**位置**（X Y Z）和**朝向**（roll 翻滾、pitch 俯仰、yaw 偏航）；☐ 關閉該燈，✕ 刪除該燈。
  - **Fog**（霧）：高度霧（密度、衰減、顏色、起始位置）和**體積霧**（反照率、消光、作用距離），以及霧預設（light haze 薄霾、morning mist 晨霧、thick volumetric 濃重體積霧、cinema smoke 電影煙霧）。
  - **Keep them in the Unreal level**（保留在 Unreal 關卡中）：不勾選時，bitGen 的燈光和霧（命名為 bitGen_*）只在生成這張圖片時存在。
  - 每次更改都會重新渲染該圖層——**一個復原步驟**。
- **UNREAL ▸ Lights** 是**燈光工具**：每盞燈都會在圖片中其所在位置顯示一個標記（聚光燈或矩形燈還會顯示其照射方向）。在圖片上**拖曳**標記（與攝影機的距離保持不變），**Shift + 拖曳** = 拉近 / 推遠，**Alt + 拖曳** = 轉動其朝向；Del 刪除選取的燈。
- **Timeline ▸ UNREAL ▸ Lights & Fog…**（選取 Unreal、MetaHuman 或 Unreal 攝影機片段時）：同樣的面板，另有 **⇦ The image editor's lights**，可引入影像編輯器中該圖層的燈光和霧；**Render** 用這些設定重新生成該片段。

## 影像編輯器中的 Unreal 攝影機：移動、鏡頭、光圈值、曝光、預設（2.475.0）
<!-- en: the-unreal-camera-in-the-image-editor-move-it-lens-f-stop-exposure-presets-2-475 088c8621518d -->

- **更新外掛**：將 **bitgen-ue-bridge-1.1.0.zip**（或更新版本）解壓縮到專案的 Plugins 資料夾中，覆蓋舊版本（攝影機鏡頭、"To Unreal's viewport" 和 "Click to focus" 都需要它）。
- **UNREAL ▸ Camera**（選取 Unreal 或 MetaHuman 圖層時）是 **Unreal 攝影機工具**——在圖片上拖曳即可在場景中移動攝影機：
  - **拖曳** = **Orbit**（圍繞注視點環繞：以對焦距離為準，未設定時為 5 m），**Ctrl + 拖曳** = **Look**（原地轉動：yaw / pitch），**Shift + 拖曳** = **Pan**（平移），**Alt + 拖曳** = **Roll**（傾斜地平線），**滾輪** = **Dolly**（前後推拉），**Ctrl + 滾輪** = **縮放**（焦距）。
  - 這些模式也是選項列上的按鈕（Orbit、Look、Pan、Dolly、Roll、**Focus**：點選需要清晰的位置，Unreal 會測量距離）。
  - 拖曳時 Unreal 會繪製小尺寸預覽；鬆開後以完整尺寸渲染——**一個復原步驟**。三分線和對焦點會疊加顯示在圖層上。
- **🎥 Camera 分頁**（Properties；**Window ▸ Unreal Camera**；UNREAL ▸ Lens & Exposure）：
  - **Presets**（預設）：18 mm 到 200 mm 的各種鏡頭、微距、變形寬銀幕風格——還可以用 **＋ Save** 儲存你自己的預設。
  - **Lens**（鏡頭）：焦距（滑桿 + 數值）與**視野**聯動，**底片規格**（全畫幅、Super 35、APS-C、Micro 4/3、IMAX、手機）。
  - **Depth of field**（景深）：**f-stop**（光圈值，f/1.2 - f/22）和**對焦**距離（0 = 全部清晰），**🎯 Click to focus**。
  - **Exposure**（曝光），單位為 EV（-5 … +5）。
  - 以數值設定**位置**（X Y Z，cm）和**轉向**（roll、pitch、yaw，°）；**⇩ From Unreal's viewport**、**⇧ To Unreal's viewport**（Unreal 透過此攝影機觀察），**⟳ Render**。
- **時間軸**：Unreal 攝影機的 UNREAL ▸ Keys… 現在新增 **Lens** 行（焦距、光圈值、對焦、曝光），供其渲染使用。

## 無工具狀態、選擇框與同時選取多個圖層（2.474.0）
<!-- en: no-tool-the-selection-box-and-several-layers-at-once-2-474-0 c602f4827f16 -->

- **Esc** 放下工具：不選任何工具，也不選取任何物件。（工具自身的 Esc——結束鋼筆路徑、取消裁切或多邊形套索——仍然優先；在沒有工具且未選取任何物件時，Esc 的作用與以前相同，例如離開全螢幕。）按工具的字母鍵（V、M、B…）可再次選擇工具。
- **沒有工具時**，滑鼠停留在物件上會顯示藍色輪廓；**點選**即可選取（按住 **Shift** 或 **Ctrl** 可將其加入選取項或從中移除）。在圖片上**拖曳**，會有一個**虛線框**跟隨指標：
  - **從左向右**（藍色）選取**完全位於**框內的所有圖層，
  - **從右向左**（綠色）選取框**觸及**的所有圖層，
  - 按住 **Shift** 保留已選取的物件並繼續新增。點選空白處則取消所有選取。
- **Layers 面板**：點選選取一個圖層；**Shift-點選**選取上次點選的圖層與目前圖層之間的所有圖層；**Ctrl-點選**新增或移除一個圖層。選取的行會醒目顯示（其編號 1、2、3 仍是 ✨ Compose 和 → References 所用的順序）。
- 選取多個圖層時，**Move tool**（移動工具）會將它們一起移動（一個復原步驟），**Del** 會將它們全部刪除（一個復原步驟）。存在像素選取範圍時，Del 仍然是清除選取的像素。

## 功能參考 PDF（2.473.0）
<!-- en: the-feature-reference-pdf-2-473-0 930b69ae4c5e -->

- **docs/bitGen-Studio-Features.pdf** 列出了 bitGen Studio 迄今為止的全部功能——約 575 項，分為十個領域（工作區、生成影片、影像、音樂與聲音、時間軸、影像編輯器、CAD 與 3D、橋接、交付、快捷鍵）：每項功能的作用、所在位置以及自哪個版本起提供。文件開頭是各領域一覽（每項都是連結），並按領域和子領域設有書籤。
- 它在每次發布時由 **docs/FEATURES.md** 生成（`python3 scripts/make_features_pdf.py`），與 Guide（分步說明 + 快捷鍵）和宣傳手冊配套。

## Unreal Engine 5.8 橋接：Unreal 圖層、MetaHuman 圖層、Unreal 攝影機（2.472.0）
<!-- en: the-unreal-engine-5-8-bridge-unreal-layers-metahuman-layers-the-unreal-camera-2- b76a75ae9a27 -->

- **一次性安裝**（2.513.0 起：也可以交給 bitGen 完成——選單列中的 🎮 Load UE project）：將 **bitgen-ue-bridge-1.1.0.zip**（或更新版本）解壓縮到 Unreal 專案的 **Plugins** 資料夾（`<Project>\Plugins\bitGenBridge`），開啟專案並啟用它要求的外掛（Python Editor Script Plugin、Editor Scripting Utilities、Sequencer Scripting、Movie Render Queue）。Output Log 中會顯示 "[bitGen Bridge] listening"。在 bitGen 中：**Settings ▸ 3D ▸ Unreal Engine ▸ Test connection**。它只在本機（127.0.0.1）上工作；埠為 30020，除非你在兩端同時修改。
- 如需**透明背景**（MetaHuman 圖層），請在 Unreal 中開啟 Project Settings ▸ Rendering ▸ Post Processing ▸ "Enable alpha channel support in post processing"（zip 中的 README 有操作說明；如果 alpha 是反的，可用 Settings 中的 "alpha is inverted" 修正）。
- **Image editor ▸ UNREAL** 分頁（位於 CAD 工具列上，或 Layer ▸ New Unreal Layer… / New MetaHuman Layer…）：
  - **Unreal Layer**：透過所開啟專案的某臺攝影機（或保持目前狀態的關卡視埠）觀察到的一個關卡，按你選擇的尺寸生成——一個可以移動、縮放、加濾鏡和遮罩的圖片圖層。
  - **MetaHuman Layer**：專案中的一個 MetaHuman，擺出某段動畫在某一時刻的姿勢，以 **Face / Bust / Full body** 構圖並可轉向，背景透明。
  - **🎮 Unreal** 分頁（Properties）可微調攝影機（Turn、Tilt、Dolly、Field of view）或人物（構圖、轉向、姿勢時間），然後 **⟳ Renders again**——一個復原步驟。**Use Viewport** 立即採用 Unreal 目前的視埠攝影機。
- **Timeline ▸ UNREAL** 分頁：
  - **Unreal Layer**：專案中的一個 **Level Sequence**（或透過攝影機 / 視埠觀察的關卡，靜止畫面），由 Unreal 的 **Movie Render Queue** 以時間軸的尺寸和 fps 渲染 -> 在播放頭處生成影片圖層 **UE1**。
  - **MetaHuman Layer**：一個播放動畫的 MetaHuman，帶構圖和轉向，背景透明 -> **MH1**。
  - **Unreal Camera**：你自己的攝影機——第一個關鍵影格取自 Unreal 的視埠（或關卡中的某臺攝影機）；在 Unreal 中移動視埠，把播放頭移到後面的位置，然後按 **＋ Key**；**Keys…** 用於編輯關鍵影格（時間、位置、轉向、視野——攝影機在關鍵影格之間直線移動）；**Render Again** 透過它渲染關卡 -> **UE Cam1**。
  - 每個片段都會記住自己的生成方式：修改 Unreal 專案後，用 **Render Again** 即可重新生成。

## 參數化 3D 實體：Extrude、Revolve、Fillet、Chamfer、Shell、Split Body（2.471.0）
<!-- en: parametric-3d-bodies-extrude-revolve-fillet-chamfer-shell-split-body-2-471-0 63bdeef9db33 -->

- CAD 工具列上的 **SOLID** 分頁（以及 Layer ▸ Extrude… / Revolve… / Fillet… / Chamfer… / Shell… / Split Body… / Change Parameters…）。先繪製一個閉合草圖（SKETCH 分頁），然後：
  - **Extrude**（拉伸）：草圖的閉合輪廓（全部輪廓——孔洞會被挖空——或你勾選的輪廓）、距離、One side / Symmetric / Two sides、起始偏移。**New Body** 新增一個**實體圖層**；**Join / Cut / Intersect** 作用於你選取的實體。
  - **Revolve**（旋轉）：繞草圖的 X 軸、Y 軸或其中一條線旋轉，角度最大 360°。
  - 對銳邊進行 **Fillet**（圓角）/ **Chamfer**（倒角）——全部邊、頂部或底部的邊、豎直邊，或環繞各面的邊。**Shell**（抽殼）將實體挖空，在頂部或底部開口。
  - **Split Body**（分割實體）：一個平面（XY / XZ / YZ，位於指定距離）；本圖層保留一側，另一側成為一個**新的實體圖層**。兩者都保持參數化。
- **參數化**：每個數值都是可以輸入的算式——`25`、`depth`、`depth / 10 + 2`、`1 in`、`30 deg`（輸入時即顯示計算結果）。**ƒx Change Parameters** 為你的數值命名（每個參數都可以引用其他參數）；修改其中一個，所有使用它的特徵都會隨之更新。之後編輯**草圖**，其實體會自動重建。
- **🧊 Body** 分頁（Properties）按順序列出各個**特徵**：☑ 關閉某個特徵（抑制），✎ 或雙擊進行編輯，↑ ↓ 調整順序，✕ 刪除。失敗的特徵以紅色顯示並給出原因；實體的其餘部分保持不變。下方依次是：**View**（Home / Front / Back / Top / Bottom / Right / Left，Turn / Tilt / Roll，**🖐 Orbit**
  - 在畫布上拖曳實體）、**Look**（顏色、金屬度、粗糙度、邊線、細節）和 **Export**（STL、glTF .glb、STEP、→ Timeline）。每次更改都是一個復原步驟。
- 實體圖層是一個**智慧型物件**：移動、縮放、旋轉、變形、濾鏡和遮罩都對它有效。
- **Settings ▸ 3D** 用於選擇引擎：**In the browser (OpenCascade)**——精確實體，無需安裝任何東西——或 **Blender (on this computer)**。兩者構建出的實體相同。
- **時間軸**：SOLID ▸ **Body → 3D Layer** 將實體作為 3D 圖層放到時間軸上（可旋轉、打光、設定關鍵影格）。在影像編輯器中修改實體後，其 3D 圖層會自動更新（也可用 **Update Bodies** 手動更新）；**Edit in Image Editor** 會在影像編輯器中選取它。

## 像繪圖軟體一樣選取 + CAD 工具列（2.470.0）
<!-- en: picking-like-a-drawing-program-the-cad-toolbar-2-470-0 58f8eaf21084 -->

- **停留 / 選取輪廓**：使用 **Move** 工具時，指標下方的形狀、智慧型物件、文字、草圖、3D 圖層或圖片內容會顯示**藍色**輪廓——表示可以選取。選取的物件顯示**橙色**輪廓（以及移動工具的控制柄）。背景屬於畫布，不是物件。
- **點選**物件 = 選取它（按住並拖曳 = 選取並同時移動）。**點選空白畫布** = 取消選取（控制柄消失；從空白處開始的拖曳不會移動任何東西）。**Esc** = 取消選取。在 Layers 面板中點選可重新選取該圖層。存在活動選取範圍（或開啟了 Auto-select）時，移動工具的行為與以前相同。
- **繪製形狀後**（Shape、Custom Shape、Rectangle、Ellipse、Polygon、Star、Spiral、Graph Paper、常用形狀、2-Point Line），會自動切換到 **Move tool** 並選取新形狀。可以用 CAD 工具列上的 **⚙** 關閉此行為（或 SHAPES ▸ AFTER DRAWING ▸ Then Move）。
- **CAD 工具列**位於影像編輯器頂部，工具選項的上方：
  - **SKETCH**：CREATE（Create Sketch、Line、2-Point / Center Rectangle、Center / 2-Point / 3-Point Circle、3-Point Arc、Polygon、Slot、Spline、Point），MODIFY（Fillet、Trim、Offset、Chamfer、Extend、Mirror、Rectangular / Circular Pattern、Construction），CONSTRAINTS（12 個針對所選物件的小按鈕），INSPECT（Sketch Dimension、Measure），INSERT（匯入 DXF，匯出 DXF / SVG），FINISH SKETCH（+ Profiles → Shapes）。
  - **SHAPES**：SELECT（Move、Pick Nothing），DRAW（各形狀工具），AFTER DRAWING。
  - 大按鈕顯示最常用的工具；**GROUP ▾** 列出該組的全部工具。分頁會隨你的工作自動切換（使用草圖工具或選取草圖圖層 -> SKETCH）。**⌃** 將其摺疊為只顯示分頁；**Window ▸ CAD Toolbar** 隱藏 / 顯示它。
- **時間軸**的預覽行上方也有同樣的工具列：**CREATE**（Text、3D Text、3D Model…、Camera、Path、Move / Hand / Zoom / Fit / Select / Mask），**3D**（選取 3D 圖層時：控制項、檢視、◇ Key、Bake）和 **SKETCH**（**Sketch on This Frame**——播放頭所在的影格會在影像編輯器中開啟，並帶一個新的草圖圖層；**Sketch on a Blank Picture**——一張與時間軸尺寸相同的空白圖片）。使用移動工具時，指標下方的片段會在預覽上顯示藍色輪廓；選取的片段保持橙色。

## 連結的智慧型物件、保留 PSD 智慧型物件、.atn 動作（2.469.0）
<!-- en: linked-smart-objects-psd-smart-objects-kept-atn-actions-2-469-0 d6f17c8e3119 -->

- **File ▸ Place Linked…**：將你電腦上的一張圖片放入專案的 **linked** 資料夾，並作為**連結的智慧型物件**匯入（在 Layers 面板中顯示 🔗）。其內容儲存在該檔案中：修改該檔案（用任何程式修改，或另存一個新檔案覆蓋它），圖層就會隨之更新——在編輯器重新獲得焦點時、每隔 20 秒，或透過 Layer ▸ Smart Objects ▸ **Update Modified Content**。其位置、尺寸、變形和智慧型濾鏡保持不變。
- **Layer ▸ Smart Objects**：**Convert to Linked…**（將嵌入式智慧型物件的內容儲存到 linked 資料夾，該圖層及其副本改為連結），**Embed Linked**（去掉連結，保留內容），**Relink to File…**（改為連結 linked 資料夾中的另一張圖片）。對連結物件使用 **Edit Contents** 時：✔ Done 還會把新內容寫入其檔案。檔案丟失時顯示 ⚠🔗。
- **PSD**：內容嵌入在 PSD 中的智慧型物件（PNG、JPEG、GIF 或 PSD）現在會**作為智慧型物件**開啟——保留其內容和變換，因此縮放時不會損失畫質；儲存 PSD 時，智慧型物件會寫回為嵌入內容的置入圖層（經過變形的則以像素形式寫入）。
- **Actions ▸ Load Actions…** 也支援 **.atn** 動作檔案：動作組及其中的動作都會匯入；錄製的步驟會轉換為此處對應的步驟——Gaussian Blur、Unsharp Mask、Median、Invert、Desaturate、Equalize、Posterize、Threshold、Mosaic、Add Noise、Emboss、Brightness / Contrast、Hue / Saturation（連同其設定）、Duplicate / New / Delete Layer、Merge Down、Flatten、Select All、Deselect、Inverse、不透明度、填充、混合模式、Rotate、Flip、Stop。沒有對應項的步驟會以**關閉狀態**匯入，並以原步驟命名，以便其餘步驟照常播放。

## 動作：錄製畫筆筆觸與手動選取範圍、條件、Image Processor、快捷批次處理（2.468.0）
<!-- en: actions-brush-strokes-hand-made-selections-recorded-conditionals-image-processor 86a080ecfddf -->

- **錄製**（Actions 分頁，●）現在還會記錄：
  - Brush、Eraser、Pencil、Smudge 及其他畫筆工具的每一道**畫筆筆觸**——位置、大小、畫筆、不透明度、流量和顏色。播放時會在圖片的相同位置重新繪製（隨圖片尺寸縮放）；之後會恢復你自己的工具和顏色。
  - 每個**手動建立的選取範圍**（選框、套索、魔術棒、快速選擇、快速遮罩、Deselect ...）——記錄其輪廓，因此在更大或更小的圖片上播放時也會得到相同的選取範圍。
- **☰ ▸ Actions: Insert Conditional…**：如果文件為橫向 / 縱向 / 方形、有選取範圍 / 無選取範圍、圖層為像素 / 文字 / 形狀 / 調整圖層、有多個圖層——**則**播放一個動作，**否則**播放另一個。條件可以呼叫自身也含有條件的動作。
- **File ▸ Scripts: Image Processor…**：選擇圖片（檔案或資料夾）；將每張圖片儲存為 **JPEG**（品質 1-12，縮放以適合 W x H）和 / 或 **PNG**（縮放以適合），可選擇先播放一個動作——儲存到專案的 batch/<name>-JPEG 和 -PNG 資料夾，或直接下載。
- **File ▸ Automate: Create Droplet…**：將一個動作 + 結果的去向（專案 / 相簿 / 下載，PNG 或 JPEG）做成 Actions 分頁底部的一個 **💧 droplet tile**（快捷批次處理磁貼）：把圖片拖放到上面（或點選它選擇圖片），每張圖片都會被開啟、播放該動作並儲存結果（即 Batch）。磁貼上的 ✕ 可將其刪除。

## 編輯單個顏色通道；專色通道（2.467.0）
<!-- en: editing-single-colour-channels-spot-channels-2-467-0 0bf99df5156b -->

- **編輯單個顏色通道**（Channels 面板，位於 Layers / Paths 旁）：點選 **Red**、**Green** 或 **Blue**——此後繪畫、擦除、填充、濾鏡和調整**只改變該通道**（面板將其標記為 ✎ 並以灰度顯示）。**Shift-點選**另一個通道可同時編輯兩個（以彩色顯示，但不含第三個通道）。**RGB**（或 Ctrl+2）= 恢復全部通道；Ctrl+3 / Ctrl+4 / Ctrl+5 以同樣方式選擇 Red / Green / Blue。只編輯部分通道時，圖層的透明度永遠不會被改變。
- **專色通道**：Channels 面板中的 **◍**（或 Select ▸ New Spot Channel…）——設定名稱、**油墨顏色**及其**密度**（0 = 透明光油，100 = 完全遮蓋）；目前選取範圍成為其油墨。其油墨疊加顯示在圖片上（合併之前不在圖層中）；雙擊其色塊可開啟選項。
- **繪製 Alpha 通道或專色通道**：選取其所在行，點選 **✎**——畫筆增加內容，橡皮擦減去內容（顯示方式與快速遮罩相同）；**✔**（或 Q）將其保留為一個復原步驟。選取範圍不受影響。
- **⇣ Merge Spot Channel**（或 Select ▸ Merge Spot Channel）：其油墨成為最上方的一個圖層，該通道隨之移除。.bgi 檔案會保留專色通道及其顏色和密度。

## OpenType 特性、視覺字距、文字轉輪廓、形狀內文字、任意路徑圓角（2.466.0）
<!-- en: opentype-features-optical-kerning-type-to-outlines-text-in-a-shape-round-corners e5f54b6872e9 -->

- **OpenType**（Character 面板）：用於啟用字型自身特性的按鈕——Standard / Discretionary Ligatures、Contextual Alternates、Swash、Stylistic / Titling Alternates、Ordinals、Fractions、Oldstyle / Lining / Tabular Figures、Slashed Zero、字型內建的 Small Caps、Superiors / Inferiors——以及 **Stylistic set**（ss01-ss20）。文字隨後會使用你電腦上該字型的字型檔案進行排版，並以其字形繪製（面板會顯示檔名）。電腦上沒有對應字型檔案的字型會照舊繪製，不帶這些特性（面板會給出提示）。字元樣式會保留這些設定。
- **Kerning ▸ Optical**（Character 面板）：根據字母的形狀確定間距（使每對字母之間的空白與該字型自身的 "nn" / "oo" 一致），而不是根據字型的字距對——同樣需要字型檔案。
- **Layer ▸ Type: Convert to Shape**：文字圖層變為由字母輪廓構成的形狀圖層（名稱、顏色、位置、不透明度、樣式均不變；可用 Direct Selection 工具編輯輪廓）。**Type: Create Work Path**：將輪廓生成為工作路徑（文字保留）。兩者都會保留你所做的全部設定——多行、段落文字、縮放、仿斜體、基線偏移、下劃線 / 刪除線、OpenType、旋轉的文字。
- **形狀內文字**：選取形狀圖層後，用 Type 工具在其輪廓**內部**點選（或 Layer ▸ Type: Text in the Picked Shape）——文字會在該輪廓內逐行排布（對齊、兩端對齊、縮排、間距在其中同樣有效；放不下的部分會被隱藏）。Convert to Point Text 可將文字移出形狀。
- **任意路徑圓角**（Direct Selection，A）：選項列上的 **⌜ Radius** + **Round Corners** 對選取的角錨點進行圓角處理——未選取任何錨點 = 路徑的所有角。適用於與其他形狀組合（combined、merged）過的形狀、路徑和向量遮罩；半徑大於邊長時會自動縮小以適應。

## 操控變形圖釘的深度和旋轉；修補工具的內容識別模式（2.465.0）
<!-- en: puppet-pin-depth-rotation-the-patch-tool-s-content-aware-mode-2-465-0 40f657cd577a -->

- **Puppet Warp**（Edit ▸ Puppet Warp）：選取的圖釘（最後新增或點選的那個）現在有
  - 選項列上的 **Pin Depth ⬆ / ⬇**：當變形使圖層自身摺疊重疊時，向前設定的圖釘會將其所在部分繪製在上層，向後設定的則位於下層（圖釘旁的數字即其深度）；
  - **Rotate Auto / Fixed** + 角度：Auto 讓圖釘周圍的內容按網格的需要旋轉（與以前相同）；Fixed 使其保持在設定的角度。**在選取的圖釘附近 Alt-拖曳**（在其虛線圓環上）可旋轉它——它會變為 Fixed。這兩項設定都會儲存在智慧型物件的 Puppet Warp 中（在智慧型濾鏡中雙擊它即可修改）。
- **Patch**（J 組）的選項列上有 **Normal** 和 **Content-Aware**：
  - **Normal**（與以前相同——Source / Destination）+ **Transparent**（紋理只以一半強度覆蓋原有內容）+ **Diffusion** 1-7（邊緣的光線和顏色向內擴散的程度：顆粒或精細細節用低值，平滑區域用高值）。
  - **Content-Aware**：根據你拖曳到的位置重建選取範圍內容（不使用 AI）——**Structure** 1-7（7 = 只取自該位置，並保留其圖案；1 = 也取自其周圍）和 **Color** 0-10（0 = 保持其原有顏色；10 = 與周圍融合）。
- **Content-Aware Move**：**Structure** 1-7（被移動部分周圍融合邊緣的寬窄：7 = 1 px）和 **Color** 0-10（被移動部分的顏色在多大程度上適應新位置）。

## 草圖圖層：輸入尺寸、Measure 工具、單位、DXF / SVG 檔案（2.464.0）
<!-- en: sketch-layers-typed-sizes-the-measure-tool-units-dxf-svg-files-2-464-0 1e45eb26917a -->

**草圖圖層**其餘的 CAD 功能：繪製時的精確尺寸、測量，以及其他 CAD 程式能夠讀取的檔案。
- **繪製時輸入尺寸**：形狀有了第一個點之後，直接**輸入數字**——指標旁會彈出一個小輸入框。**Line**：Length，**Tab** = Angle（與水平方向的夾角，逆時針，單位為度）；**Rectangle / Center Rectangle**：Width，Tab = Height；**Circle / 2-Point Circle**：Diameter；**Polygon**：Radius。按 **Enter** 即可繪製——未輸入的值跟隨指標（指標接近水平 / 豎直方向時，線保持水平 / 豎直）——輸入的值會保留為**尺寸**（之後可以像其他尺寸一樣修改）。連續線會繼續繪製：可以直接輸入下一段的長度。支援算式（100/3）。**Esc** 關閉輸入框。
- **Measure**（選取草圖工具時按 **M**，或 📐 Sketch 分頁中的 📏）：點選點、線、圓、圓弧或樣條曲線 = 顯示其尺寸（長度、角度、半徑、直徑、周長、面積、掃掠角……）；再點選一個 = 測量兩者之間（兩點的距離及 ΔX / ΔY、點到線或圓的距離、兩條線的夾角（平行線則為間距）、兩個圓的圓心距和間隙）；在**閉合區域內部**點選 = 其**面積**和**周長**（扣除孔洞；圓弧精確計算）。數值顯示在圖片右上角的一個框中（📋 可複製）；Esc 清除。
- **單位**（📐 Sketch 分頁 ▸ Measure + CAD files）：px，或 **mm / in** 並設定 "1 px = ..."——Measure 框和匯出的檔案都使用這些單位。
- **File ▸ Export Sketch as DXF…**：生成任何 CAD、雷射或 CNC 程式都能開啟的 R12 DXF——草圖原點為 0,0，y 軸向上，使用所選單位；可按需包含構造線（圖層 CONSTRUCTION）和尺寸（圖層 DIMENSIONS）；樣條曲線以多段線匯出。**File ▸ Export Sketch as SVG…**：圖片的尺寸（以 mm / in 表示的實際尺寸）、線條，以及（草圖啟用填充時的）輪廓區域。兩者都儲存在專案的 **cad** 資料夾中（同時會下載）。
- **File ▸ Import DXF…** / **Import DXF from Project…**：線、圓、圓弧、點、多段線（其弧形凸度 = 圓弧）、樣條曲線和橢圓會匯入到選取的草圖圖層（或新增一個）；文字、填充圖案和塊會被忽略（並提示忽略了多少）。可選擇 **Fit to the picture** 或 **real size round the origin**（1 個圖紙單位 = 若干 px）。相接的端點會被連接，因此閉合輪廓會立即成為一個輪廓區域（可用於 Fill profiles、Profiles → Shapes、測量其面積）。

## 草圖修改工具：修剪、延伸、圓角、偏移、鏡像、陣列、多邊形、槽、樣條曲線（2.463.0）
<!-- en: sketch-modify-tools-trim-extend-fillet-offset-mirror-patterns-polygon-slot-splin daa3f4be4396 -->

為**草圖圖層**提供更多 CAD 工具（**N** 工具組和 📐 Sketch 分頁）。它們生成的所有內容都帶有約束，因此草圖會持續求解。
- **更多繪圖工具**：**Polygon**（先點中心，再點一個角；在選項列上設定 **Sides** 邊數——一個虛線構造圓使各角都落在圓上，且各邊相等），**Slot**（先點兩個圓心，再確定寬度——兩個半圓由切線相連，圍繞一條構造軸），**2-Point Circle**（直徑的兩個端點），**3-Point Circle**（圓上的三個點），**Spline**（逐點點選；按 Enter 或雙擊結束——生成一條穿過每個點的平滑曲線；之後可用 Sketch Select 拖曳這些點）。
- **Trim**（**T**）：指向線、圓或圓弧的某一段——位於最近的交點 / 點之間的那一段會變紅——點選即可將其剪掉（圓會變成圓弧；剪下後的端點仍停留在與之相交的物件上）。
- **Extend**（**E**）：線上的自由端附近點選，使其沿該方向延伸到下一條線或圓。
- **Fillet**（**F**）/ **Chamfer**：點選一個角（兩條線的交匯處）或這兩條線——生成帶**半徑**尺寸的相切圓弧，或帶距離尺寸的直線切角；數值取自選項列，之後可輸入新值修改。
- 📐 Sketch 分頁中的 **Modify (what is picked)**：
  - **⇉ Offset…**：在一側按指定距離（px）生成副本；相連的鏈保持相連，線保持平行，圓 / 圓弧保持同心——該距離是一個可以修改的尺寸。
  - **⇋ Mirror**：先選取各物件，最後選擇鏡像線——生成的鏡像副本相對於該線保持 **Symmetric**（對稱）。
  - **▦ Rectangular Pattern…**（欄數 / 列數及其間距）和 **✺ Circular Pattern…**（數量及分佈的總角度；圍繞選取的點或原點）——副本與原物件具有相同的約束。
- 每項操作都是一個復原步驟；輪廓功能（⬚ Profiles → Shapes、Fill profiles）會立即識別新區域。

## 草圖圖層：帶約束和尺寸的 CAD 草圖（2.462.0）
<!-- en: sketch-layers-a-cad-sketch-with-constraints-and-dimensions-2-462-0 d640fb9dcdd7 -->

**草圖圖層**是一種 CAD 風格的 2D 草圖：由**約束**和**尺寸**保持形狀的線、矩形、圓和圓弧。修改尺寸，草圖隨之變化；拖曳一個點，一切仍保持約束關係。
- **Layer ▸ New Sketch**（或直接用草圖工具繪製）：生成一個草圖圖層（在 Layers 中顯示 📐），帶有一個固定的**原點**（紅點）和兩條穿過圖片中心的構造軸。
- **草圖工具**（工具列中的 **N**，再按 N = 切換到下一個）。選取草圖工具後，可用字母鍵選擇其他工具：**S** Sketch Select、**L** Line、**R** 2-Point Rectangle（還有 Center Rectangle）、**C** Circle、**A** 3-Point Arc、**P** Point、**D** Sketch Dimension；**X** 將選取的物件轉為構造線（虛線，永遠不會繪製到圖片中）；**Delete** 刪除選取的物件；**Esc** 停止 / 取消選取。
  - **Line**：逐點點選（形成一條鏈）；按 **Esc**、雙擊或點選鏈的第一個點即可結束。接近水平 / 豎直的線會自動吸附並獲得 **Horizontal / Vertical** 約束；終點落在一個點上會將兩者連接（重合），落線上 / 圓上會使該點保持在其上（一條橫跨矩形、兩端落在其邊上的線會把矩形分成兩個區域）。
  - **Rectangle**：兩個角點（或中心和一個角點）——點選兩次或拖曳。**Circle**：先點圓心，再點邊緣。**3-Point Arc**：起點、終點，然後是弧上的一點。
  - **Sketch Dimension**：點選一條線（標註其長度——對於斜線，放在其上方 / 下方 = 水平尺寸，放在旁邊 = 豎直尺寸）、兩個點（其距離）、一個點和一條線、兩條線（其夾角；平行線 = 其間距）、一個圓（其直徑）或一段圓弧（其半徑）；然後點選放置數字的位置並輸入數值（支援算式：100-20）。之後雙擊數字即可修改。
  - **Sketch Select**：點選選取（按住 Shift 追加）；拖曳點、線和圓的邊緣——約束保持不變；拖曳數字可移動其位置。
- **📐 Sketch** 分頁（與 Properties / Adjustments / ✨ AI / ◈ Control 並列）：顯示剩餘的**自由度**數量（為零時顯示 ✓ **fully constrained**（完全約束））、針對所選物件的**約束**——Coincident（兩點重合，或點線上 / 圓上）、Collinear、Concentric、Midpoint、Fix、Parallel、Perpendicular、Horizontal、Vertical、Tangent、Equal、Symmetric（兩點關於一條線對稱）——以及 Construction、Delete、各繪圖工具，和圖層在圖片中的顯示方式（線條顏色 + 寬度、**Fill profiles** = 填充閉合區域、顯示 **Dimensions**）。
- **繪製草圖時的顏色**：藍色 = 仍可自由移動，黑色 = 完全約束，橙色虛線 = 構造線，括號中的灰色數字 = 從動（參考）尺寸。會使草圖**過約束**的約束，或已被其他約束確定的約束，會被拒絕（尺寸則改為從動尺寸）。
- **⬚ Profiles → Shapes**：將每個閉合區域生成為草圖上方的一個**形狀圖層**（可設定填充、描邊，用 ✨ 在其中生成內容…）。**✓ Finish Sketch** 返回 Move 工具。
- 每次更改都是一個復原步驟；移動 / 縮放圖層會一併移動其草圖；.bgi 檔案會保留每一個約束。

## 時間軸上的姿勢，以及 Daz 即時連結（2.461.0）
<!-- en: poses-on-the-timeline-and-the-daz-live-link-2-461-0 d0315f061871 -->

**在時間軸上**：從 Daz Studio 傳送來的場景（bitGen Bridge ▸ Scene）會在預覽畫布上方的 🟧 .blend 預覽中開啟，攝影機已經可以在其中移動（🎥 scene camera 場景攝影機 / 🧭 free view 自由視角）。其 Properties 現在新增 **Pose**：
- 選擇**人物**和一根**骨骼**（輸入其名稱的一部分即可查詢），用 **X / Y / Z** 旋轉它（單位為度，疊加在其自身姿勢之上——或疊加在其動畫之上：旋轉會隨動作一起運動）。預覽會立即顯示旋轉效果；**Reset bone / Reset pose**；Ctrl+Z 可復原。💾 **Save** 和 **🎬 Render to real** 會將姿勢交給 Blender（人物帶動畫時，會在各影格上設定關鍵影格）。
- **🧊 To the image editor**：將同一場景作為影像編輯器中的一個 **3D 圖層**，帶有此姿勢和此視角（自由視角的位置）——在那裡用 **✨ Generate from it** 生成一張新影像。

**Daz 即時連結（實驗性）**——bitGen 直接在 Daz Studio 中移動攝影機、調整姿勢：
- 在 Daz Studio 中執行 **Scripts ▸ bitGen ▸ bitGen Live Link**（來自 bitgen-daz-bridge zip，1.1.0）。連結期間會一直開啟一個小視窗；它大約每秒向 bitGen 詢問一次要做什麼。
- 在影像編輯器的 **🧊 3D** 分頁中：**📡 Camera → Daz**（Daz 的視埠透過一臺 "bitGen Camera" 觀察，其位置與 3D 圖層的視角相同），**📡 Pose → Daz**（所選人物中同名的骨骼按你設定的旋轉進行旋轉），**↺** 撤回這些旋轉，☐ **as I change** 在每次更改時同時傳送兩者。上方的一行文字會顯示 Daz 是否已連結，以及 Daz 中目前選取的是哪個人物。
- 在時間軸上：Pose 部分中的 **📡 View + pose → Daz**（自由視角 + 旋轉）。
- 照常在 Daz 中渲染，然後用 bitGen Bridge ▸ Render this frame 傳送回來 -> 得到一張圖片。
- 此功能是根據 Daz Studio 的指令碼文件編寫的，開發時未能在真實的 Daz Studio 中測試；Daz 的骨骼按 Daz 自身的軸向旋轉，可能與 Blender 的不一致。即時連結視窗的日誌會顯示失敗的原因。

## 3D 圖層：影像編輯器中的 Daz / Blender 場景（2.460.0）
<!-- en: 3d-layers-a-daz-blender-scene-in-the-image-editor-2-460-0 7d1cd9dabca1 -->

將 3D 場景帶入圖片，移動其攝影機，為其中的人物擺姿勢，並利用該視角生成新影像。
- **從 Daz Studio 傳送**：Scripts ▸ bitGen ▸ bitGen Bridge ▸ **Scene**——場景（帶骨骼繫結的人物、道具、燈光、攝影機）會作為 Blender 場景進入專案（必須安裝 Blender——🟧 Blender settings）。任何 **.blend** 檔案也同樣可用。
- **Layer ▸ New 3D Layer (Daz / Blender)…**：選擇場景（從 Daz 傳送的場景標有 "Daz ·"）或輸入 .blend 檔案的路徑。隨即出現一個 **3D 圖層**：它是一個普通的圖片圖層（遮罩、濾鏡、移動和混合模式都有效），每當你改變其視角時，Blender 都會重新繪製它。原始檔案永遠不會被修改。如果沒有開啟的圖片，會按場景尺寸新增一張。
- **🧊 3D** 分頁（在 ✨ AI / ◈ Control 旁）：
  - **Camera**：🎥 **Scene camera**（Daz / Blender 中設定的視角）、**Front / Back / Left / Right / Top**，或輸入 **Turn**、**Tilt**、**Distance** 和 **Lens**（視野，單位為度）。**🖐 Drag the view**：在畫布上拖曳 = 圍繞場景環繞，**Shift**+拖曳 = 平移，**Ctrl**+拖曳或**滾輪** = 縮放；拖曳時以線框盒顯示視角，鬆開後由 Blender 繪製（約需一秒）。
  - **Pose**：選擇**人物**和一根**骨骼**（輸入其名稱的一部分即可查詢），然後用 **X / Y / Z** 滑桿旋轉它（單位為度，疊加在原有姿勢之上）。**Reset bone** / **Reset pose**。
  - **Frame**：動畫場景的第幾影格。
  - **Render**：**Quick**（快速、平面著色——即視角預覽所用的方式）、**EEVEE** 或 **Cycles**，☐ **transparent**（透明）背景，**▶ Render** 以完整尺寸繪製該圖層（Layer ▸ Render 3D Layer 作用相同）。
  - **✨ Generate from it**：在提示詞面板中輸入你想要的內容（例如 "a photo of a woman waving in a sunny park"），然後按下此按鈕——編輯器會切換到 **Edit**，提示詞面板會根據你所看到的這張圖片生成新影像。
- 每次更改都是**一個復原步驟**（圖片及其攝影機 / 姿勢一起）。**.bgi** 檔案會保留 3D 圖層的場景、攝影機和姿勢。

## 按功能命名的工具（2.459.0）
<!-- en: tools-named-by-what-they-do-2-459-0 2b7f05e598ac -->

說明頁面、工具提示、選單、訊息、本指南和宣傳手冊現在都按功能為每個工具、面板和特性命名——不再使用其他產品的名稱。螢幕上有幾個名稱發生了變化：**Node Pen Tool**（F5 組）、**Shape Tool (nodes)**（F10）、**Dockers** 面板組（Window ▸ Float Dockers）和 **Layer ▸ Frame**。其他程式的檔案仍按原有方式讀取和寫入（PSD、Final Cut Pro 7 XML、EDL、OpenTimelineIO、AAF）。

## 自動尺寸、平面圖尺寸和連續尺寸（2.458.0）
<!-- en: auto-floorplan-and-chain-dimensions-2-458-0 e7dd15a69d36 -->

- **Auto Dimension**（Layer ▸ Auto Dimension，或尺寸工具列上的 **⊞ Auto**）：標註選取物件的總體**寬度**（在其上方）和**高度**（在其旁邊），作為兩個尺寸組，放在名為 "Size of <name>" 的組中。
- **Floorplan Dimensions**（Layer ▸ Floorplan Dimensions…，或工具列上的 **⌂ Floorplan**）：選擇一個閉合形狀——一個房間，或用形狀 / 線條工具繪製的平面圖輪廓——每面**牆**都會在其**外側**標註尺寸，並在更外側標註**總寬度和總高度**；全部放在一個名為 "Floorplan <name>" 的組中，為一個復原步驟。對話方塊中可設定尺寸與牆的距離，以及標註牆、總尺寸還是兩者都標註。（不是形狀的圖層按其邊界框測量。）
- **Chain Dimension 工具**（F8，與其他尺寸工具在一起）：沿牆依次點選各點——它們會像其他尺寸工具一樣吸附到節點和角點——然後按 **Enter** 或**雙擊**，再點選放置尺寸線的位置：在同一條線上為每兩個相鄰點之間標註尺寸，並在更外側標註**總長**。它根據各點的走向水平或豎直排布；**Shift** = 水平，**Ctrl** = 豎直。**Backspace** 撤回最後一個點，**Esc** 取消。
- 工具列上的 **↔** = 自動 / 平面圖尺寸與物件之間的距離。它們生成的每個尺寸都是普通的尺寸組：可以拖曳其各部分、修改比例。

## 尺寸組（2.457.0）
<!-- en: dimension-groups-2-457-0 1d12917c5eaf -->

尺寸現在是 Layers 面板中的一個**部件組**：**Extension Line 1**、**Extension Line 2** 和 **Dimension Line**（其上帶有兩個箭頭和數值）。每個部件都是獨立的向量線；整個組作為一個整體移動、縮放和旋轉，而各部件總是根據尺寸的測量值重新繪製，因此箭頭始終位於尺寸線上，尺寸界線也始終保持其間隙。

**繪製尺寸**（Parallel 和 Horizontal / Vertical Dimension 工具）：
- **在物件的邊上按下並向外拖曳**——測量該邊，尺寸線跟隨指標。
- 或者**先點選一個節點或一條邊，再點選另一個節點或邊**（點選邊時取邊上與第一次選取點垂直相對的點），然後**點選放置尺寸線的位置**。
- **Shift** = 尺寸線水平，**Ctrl** = 豎直（繪製和拖曳時均適用）。Esc 取消。

**編輯尺寸**（選取該組後，使用 Move 工具、Shape 工具、路徑工具或尺寸工具）：
- **拖曳尺寸界線**：其測量點沿尺寸方向滑動——長度和數值即時變化（在吸附點上會與之對齊；按住 Alt = 自由移動）。
- **拖曳尺寸界線的節點**（兩端的小方塊）：只有該尺寸界線變長或變短——即它與物件之間的間隙，或它超出尺寸線的長度。
- **拖曳尺寸線**（使用 Move 工具時：拖曳其中間的圓點）——拉近或推遠；Shift / Ctrl 使其水平 / 豎直。使用 Move 工具時，拖曳線的其餘部分或數值會移動整個組。
- 每項操作都是一個復原步驟。在畫布上點選某個部件會選取其所在的組。屬性列上的 📏 尺寸 + 單位以及 Layer ▸ Dimension Scale… 都作用於組；設定新比例後會重新測量每個組。舊版的單圖層尺寸仍可開啟，也可拖曳其端點（現在那裡同樣是 Shift = 水平，Ctrl = 豎直）。

## StoryBoard 分鏡腳本（2.456.0）
<!-- en: the-storyboard-2-456-0 9ee62e63633e -->

**影片面板現已改為 StoryBoard**（其標題列和狀態列按鈕都已更名），並且可以**浮動**：其標題列中的 **⇱** 使其成為應用程式之上的獨立視窗——拖曳標題可移動它，拖曳任意邊緣可調整大小，它可以作為分頁停靠在某個已命名的面板中，**⇲** 將其放回時間軸下方。
- **StoryBoard 欄**（位於場景上方）：用於生成圖片的**影像模型**（在你另選之前，使用提示詞面板的影像風格），以及隨每張圖片一起作為**參考圖**傳送的內容：☑ **Character sheets**（場景提示詞中提到的角色的角色設定表），☑ **Locations**（提示詞中提到的地點），☑ **Reference images**（場景自身的圖片和專案的 References）。**🖼 All missing** 為所有缺少圖片的場景生成圖片。
- **每個場景**都有一個**縮圖**：**🖼 make**（之後可用 ↻ 重新生成）用該模型根據場景的提示詞渲染縮圖——這是一個普通的影像任務（在 Queue 中可以看到）；**→ First** / **→ Last** 將其用作場景的**首幀 / 尾幀**（場景渲染以這張圖片開始 / 結束）；**✕** 將其刪除。這些圖片儲存在專案的 storyboard 資料夾中。

## Edit theme mode 下對話方塊照常可用（2.455.0）
<!-- en: edit-theme-mode-leaves-dialogs-working-2-455-0 ac5240b72ba7 -->

在 **🖌 Edit theme mode**（主題編輯模式）開啟期間，**對話方塊和彈出選單照常工作**：Style 面板中的「a picture as the icon」（用圖片作圖示）會開啟檔案對話方塊，你可以在其中瀏覽並選擇檔案；影像編輯器的各個對話方塊、Settings、選單、Liquify……都像平常一樣回應你的點選和按鍵。它們不會被描邊，也永遠不會被選取來設定樣式。在對話方塊內按 Esc 由對話方塊自己處理；在其他地方，Esc 先關閉 Style 面板，再離開該模式（焦點在 🖌 按鈕上時也是如此）。

## 面板欄本身就是面板；每個標籤組都可浮動（2.454.0）
<!-- en: the-panel-column-is-a-docker-every-tab-group-floats-2-454-0 34a11926e679 -->

- 編輯器右側欄中的**每個標籤組**都可以透過其 **⇱** 浮動：Colour（Color / Swatches / Character / Paragraph）、Properties（Properties / Adjustments / ✨ AI / ◈ Control）、Layers（Layers / Paths / Channels / History / Actions / Comps）以及 Dockers（Transform / Shaping / Align / Object）。Window ▸ Float … 的作用相同。
- **該欄是帶停靠區的面板**：按住浮動組的標題將其拖到欄上——一條**橙色線**會顯示它將放置的位置（某個組的上方或下方，或末尾）——鬆開滑鼠即停靠到該處。浮動組仍可作為標籤停靠到命名面板中（Window ▸ New Docker…）。
- **可調整寬度**：拖曳該欄的左邊緣可使其變寬或變窄（200 - 640 px）。
- 順序和寬度會保留到下次使用。

## 框架鎖定其內容（2.453.0）
<!-- en: frames-lock-their-contents-2-453-0 029c1ebc4fea -->

- **鎖定內容**：在普通模式下，框架內的內容（Lock Contents to Frame——預設開啟）不能單獨移動或變換。用 Move tool（移動工具）點選或拖曳它時，選取的是**框架**，框架的縮放 / 旋轉手柄會帶著內容一起移動、縮放、旋轉和斜切（拖曳時內容顯示為被框架裁切；整個操作為一個復原步驟）。
- 在畫布上**右鍵點選**：**Edit Frame Contents**（編輯框架內容）、Extract Contents、Lock Contents to Frame（以及 Duplicate / Delete Layer）。編輯期間，內容可以單獨移動 / 變換 / 繪製，右鍵選單會把 **Finish Editing Frame** 放在第一項（畫布上的 ✓ 欄也仍然可用）。在普通的閉合形狀上，選單提供 Place Inside Frame…。
- 現在雙擊框架會顯示 Move tool 的旋轉手柄（與任何圖層一樣）。

## Move tool：縮放 / 旋轉手柄、變換選項（2.452.0）
<!-- en: move-tool-scale-rotate-handles-transform-options-2-452-0 cfef5fe4b767 -->

使用 **Move tool (V)**（移動工具）時，活動圖層上會顯示手柄：
- **按一下** = **縮放手柄**（8 個小方塊）：拖曳角手柄會以對角為基準雙向縮放——按住 **Shift** 保持比例，按住 **Alt** 從中心縮放；邊手柄只沿一個方向拉伸。
- **雙擊** = **旋轉手柄**：拖曳角手柄（彎箭頭）繞中心旋轉——**Shift** = 以 15° 為步進；拖曳邊手柄（↔ / ↕）進行斜切。再按一下即回到縮放手柄。
- 拖曳時可以預覽變換後的位置；鬆開即套用——一個復原步驟。在其他任意位置拖曳仍然是移動圖層。像素只重繪一次，形狀保持向量，**文字保持可編輯**（現在也可以旋轉），智慧型物件保留其內容，組會變換其中的所有圖層。
- **Transform options**（變換選項，位於選項列）：∠ 角度 + ↻、⟲90 / ⟳90、⇋ / ⇵ 翻轉、W % x H %（🔗 聯動）+ ⤡——均以圖層中心為基準。

## 編輯器的 Edit / Generate 標籤驅動提示詞面板、Del 鍵、快捷提示詞（2.451.0）
<!-- en: the-editor-s-edit-generate-tabs-drive-the-prompt-docker-del-quick-prompts-2-451- 90edff815cc4 -->

- **✨ AI ▸ Edit 標籤**：提示詞面板會自動切換到 **🖼 Image**（即使目前處於 🎬 Video），其風格切換為 **Qwen Image 2.1 edit**，大按鈕顯示為 **✏ Edit**——在那裡輸入指令並按下該按鈕即可。該標籤內建的 ✨ Edit 按鈕和模型行已移除。尚未開啟任何圖片時，會提示先開啟一張圖片。
- **✨ AI ▸ Generate 標籤**：提示詞面板的按鈕顯示為 **✨ Generate**，會渲染到所選圖層的選取範圍中；✔ Apply 將結果融合進去（與 Krita AI 類似）。沒有開啟圖片時，則按常規方式生成一張新圖片。
- 切換到其他標籤（Refine、Remove……）時：提示詞面板恢復原來的模式和風格。
- **Del** 刪除目前圖層（有選取範圍時則清除選取範圍內容；Shift+Del 始終刪除圖層）。
- **快捷提示詞**——位於提示詞面板的選單列：**💾 Save** 儲存目前提示詞（以第一行作為名稱；第一行相同時會覆蓋原有項），**⚡ Quick prompts ▾** 列出已儲存的提示詞——選擇其中一個即可填入提示詞框，**🗑** 刪除最後選擇的那一個。它們儲存在安裝資料夾中的 quick_prompts.json 裡（所有專案共用）。

## Warp 網格 + 拆分線、Liquify 新增功能（2.450.0）
<!-- en: warp-grid-split-lines-liquify-extras-2-450-0 3b6528e03e1c -->

**Edit ▸ Transform ▸ Warp**——選項列現在提供：
- **Grid**（網格）：Default / 3 x 3 / 4 x 4 / 5 x 5 / Custom（欄 x 列，各 1 - 10）——單元格越多，控制越精細。已經做好的變形會保留。
- **Split Warp** ✚ Crosswise / ┃ Vertically / ━ Horizontally：在變形區域上點選要放置拆分線的位置——圖片不會移動，只是在那裡多出一些控制點。按住 **Alt 點選**拆分線可將其刪除。
- 拖曳網格點（線條交叉處——其手柄隨之移動）、手柄或單元格內的任意位置，即可彎曲該單元格。按 Enter 套用；智慧型物件會保留網格。

**Filter ▸ Liquify…** 新增：
- **Smooth (E)**：使畫筆下的扭曲變得均勻（按住不動或在其上塗抹）。
- **Push Left (O)**：向上拖曳 = 像素向左移動，向下拖曳 = 向右移動（按住 Alt = 方向相反）。
- **Face-Aware Liquify**：☺ **Face tool (A)**——圍繞一張臉拖出一個橢圓；橢圓內會放置眼睛、鼻子和嘴巴的標記，可將它們拖到實際所在的位置。然後使用滑桿：Eye Size / Height / Width / Distance、Nose Height / Width、Smile、Mouth Width / Height、Forehead、Chin Height、Jawline、Face Width（-100 .. 100）。Reset Face 將它們復原；OK 會同時套用畫筆和滑桿的效果。尚未放置臉部時，則按畫面中央的估計位置處理。

## 逐字元文字樣式（2.449.0）
<!-- en: per-character-type-2-449-0 f09de64d68b4 -->

同一個文字圖層中的不同字母可以擁有各自的設定：
- 輸入文字時（Type tool 的文字方塊處於開啟狀態），**選取若干字母**，然後在選項列中更改**字型、B、I、字號、字距或顏色**——或者更改 **Character** 面板中的任意項（垂直 / 水平縮放、基線偏移、仿粗體 / 仿斜體、All Caps、Small Caps、上標 / 下標、下劃線、刪除線）。只有這些字母會改變；文字方塊保持開啟，這些字母仍處於選取狀態。每次更改為一個復原步驟。
- **未選取任何內容**（只有插入點）= 作用於整個圖層，與以前相同。
- 在帶樣式的文欄位內輸入時，新文字沿用該樣式（插入點前一個字母的樣式）。
- 不同字號的字母共用一條基線；每行的行高取決於該行最大的字母。字號 / 字型不同時，文字方塊會浮在文字上方（與變形文字相同），以便可靠地選取字母。
- **Layer ▸ Type: Clear Character Overrides** 會將所有字母恢復為圖層本身的設定。圖層保留段落設定（對齊方式、行距、段落文字方塊）。路徑文字、豎排文字、變形文字、3D 文字以及套用了文字效果預設的文字仍只使用一種樣式。

## Content-Aware Fill 工作區（2.448.0）
<!-- en: the-content-aware-fill-workspace-2-448-0 365035787eeb -->

選取要去除的內容，然後選擇 **Edit ▸ Content-Aware Fill…**——這會開啟一個獨立的工作區：
- **圖片**：要填充的區域以紅色描邊，**取樣區域**（填充可以從中取得像素的區域）以綠色顯示。
- **Sampling**（取樣）：**Auto**（選取範圍周圍的一圈）、**Rectangular**（包圍選取範圍的矩形框）或 **Custom**——用 🖌 **Sampling Brush** 繪製：**+** 新增，**−**（或 Alt）減去，另可設定畫筆大小。**↺ Reset** = 恢復為 Auto；**show it** 可關閉綠色顯示。
- **Preview**（預覽）：結果顯示在旁邊，每次更改後（短暫停頓後）會重新生成。
- **Colour Adaptation**：None / Default / High / Very High——將填充內容的顏色和光照與周圍環境融合。
- **Output To**：Current Layer / New Layer / Duplicate Layer。**OK** = 一個復原步驟。所做的選擇會被保留。
PatchMatch（不使用 AI）：只使用取樣區域中的圖塊。

## 畫板（2.447.0）
<!-- en: artboards-2-447-0 6b19f97606bb -->

一張圖片中可以包含多個**畫板**——每個畫板都是一個擁有自己尺寸的頁面（帖子、Story、橫幅……）。
- **Layer ▸ New ▸ Artboard…**：設定名稱、尺寸（圖片的尺寸、預設——Instagram post、Story / Reel、Full HD、4K、A4、YouTube thumbnail、X post——或自訂尺寸）、背景顏色（或無背景），以及是否將選取的 / 活動的圖層放入其中。第一個畫板位於圖片左上角；之後的畫板依次放在上一個的右側，畫布會隨之擴大以容納它們。
- **Artboard tool**（畫板工具，位於 Move tool 工具組中——再按一次 V）：拖出一個矩形 = 在該處新增畫板。
- **Layer ▸ New ▸ Artboard from Group**：將活動組轉換為包圍其內容的畫板。
- 畫板就是一個組：其中的圖層**只在畫板矩形內顯示**，位於畫板背景之上；畫板的名稱和輪廓繪製在其上方。移動畫板（Move tool、方向鍵）時，其圖層會一起移動。**Properties**：X / Y / W / H、背景、**⇱ Fit**（使矩形包圍其內容）。Canvas Size 和 Image Size 也會移動 / 縮放畫板。
- **File ▸ Export ▸ Artboards to Files…**：將每個畫板匯出為單獨的 PNG（只包含它自己的圖層）——以 <picture>-<artboard>.png 的名稱儲存到專案的 Images 中，和 / 或直接下載。.psd 會將它們儲存為 PSD 畫板；.bgi 也會保留它們。

## 時間軸預覽畫布上的標尺、參考線和吸附（2.446.0）
<!-- en: rulers-guidelines-and-snapping-on-the-timeline-s-preview-canvas-2-446-0 b455d3b862ab -->

時間軸選單列中的 **📏**（位於 ⊞ 旁邊）會在預覽畫布的頂部和左側顯示**標尺**——以圖片像素為單位，從圖片左上角起算，並隨縮放和平移變化。
- **參考線**：從頂部標尺（水平參考線）或左側標尺（垂直參考線）拖到畫布上。
- 用 Move tool **移動參考線**（指標停留在參考線上時變為 ↕ / ↔）；**將其拖回所屬標尺**即可刪除；**雙擊參考線**可輸入其位置。參考線屬於時間軸（隨時間軸一起儲存），並以參考線顏色繪製（⚙ Timeline settings ▸ Grids & Guides）。
- **吸附**：用 Move tool 移動圖層時，圖層的邊緣和中心會在吸附距離內吸附到參考線、圖片的邊緣和中心，以及——在顯示網格時（⊞）——網格線。按住 **Alt** 可自由移動。

## 網格按鈕、Grids & Guides 設定（2.445.0）
<!-- en: grid-buttons-the-grids-guides-settings-2-445-0 c375fe22bea0 -->

**⊞** 用於開關網格——位於影像編輯器的頂欄（⛶ 之前）和時間軸的選單列（🧰 旁邊，網格顯示在預覽畫布上）。

相關設定位於 **Grids & Guides** 標籤中——在影像編輯器的 **⚙** 設定和時間軸的 **⚙ Timeline
settings** 中均有：
- **Grid spacing**（網格間距，單位為圖片像素；0 = 隨縮放變化）和 **Major grid every** n 條線（主網格線，繪製得更明顯；0 = 無主網格線）
- **Draw the grid as** 線條或點（每個交叉處一個點，主網格線上的點更大）
- **Grid colour** 及其濃度、**Guideline colour**、**Guideline snap distance**（螢幕像素）編輯器將這些設定與其他設定一起儲存（View ▸ Grid and Snapping… 可開啟該標籤）；時間軸將它們儲存在設定檔案中（所有瀏覽器都相同），⊞ 的開關狀態也一併儲存。

## 影像編輯器的 ✨ Edit / Generate 改由提示詞面板執行、⚙ 編輯器設定（2.444.0）
<!-- en: the-image-editor-s-edit-generate-run-from-the-prompt-docker-editor-settings-2-44 5df2535d1e0a -->

在影像編輯器已開啟且顯示其 **✨ AI** 面板時：

- **Edit** 標籤：提示詞面板的影像風格切換為 **Qwen Image 2.1 edit**，按鈕顯示為 **✏ Edit**。在提示詞面板中輸入指令（「make her jacket red」（把她的夾克改成紅色）、「turn it into a watercolor」（改成水彩畫））並按 ✏ Edit——選取範圍會被編輯（無選取範圍 = 整張圖片）。面板內建的 Edit 按鈕、模型清單和提示詞框已移除——現在在提示詞面板中輸入。離開 Edit 標籤時，提示詞面板的風格會恢復原樣。
- **Generate** 標籤：提示詞面板的按鈕顯示為 **✨ Generate**，會渲染到所選圖層的選取範圍中（無選取範圍 = 整張圖片）。結果照常出現（點選其中一個進行比較）；**✔ Apply** 將目前顯示的結果融合到該圖層中——只在（羽化的）選取範圍內，一個復原步驟——與 Krita 的 AI 功能類似。在文字 / 形狀 / 組圖層上，結果會成為一個新圖層。（在 ⚙ ▸ ✨ AI 中可設定讓 Apply 始終新增新圖層。）
- 顯示的是面板的其他標籤（或編輯器已關閉）時：提示詞面板照常工作（將圖片作為新圖層放到畫布上）。

編輯器選單列右端的 **⚙**（或 Edit ▸ Preferences…，Ctrl+,）會開啟編輯器的設定：✨ AI（結果、上下文、羽化、百萬像素、✔ Apply 的行為）和 Interface（外觀、標尺、面板、選項列）。

## Edit theme mode：為螢幕上的任何元素設定樣式（2.443.0）
<!-- en: edit-theme-mode-style-anything-on-screen-2-443-0 5ae46c473112 -->

頂欄中的 **🖌**（位於 ⚙ 旁邊——或 Settings ▸ Themes ▸ **🖌 Edit theme mode**）會開啟主題編輯模式：指標下方的元素會被描邊，點選會「選取」該元素而不是使用它（⚙ 不會開啟 Settings，按鈕也不會執行操作）。**Style** 面板會在其旁邊開啟：

- **Apply to**（套用到）——僅此元素、此面板中所有同類元素、所有同類元素（種類相同且 class 相同的元素——例如所有 ghost 按鈕），或該種類的所有元素；面板會顯示目前匹配的元素數量。
- **Text**——字型、字號、字重、顏色、文字陰影（x、y、模糊、顏色）。
- **Box**——填充、邊框顏色、圓角半徑、按鈕陰影（x、y、模糊、擴展、顏色、內陰影）。
- **Icon**——新圖示（emoji / 符號，或 🖼 一張小圖片——png、svg、jpeg、webp、gif）、圖示位置（左、右、上、下、僅圖示、隱藏）、大小及填充色（emoji 也會被著色）。文字保持不變。
- **⬆** 選取其外層元素，**↺ Clear** 刪除該規則；按住面板標題可拖曳面板。

每項更改都會立即顯示。**再按一次 🖌**（或按兩次 Esc）= LIVE 模式：點選恢復正常作用，樣式保持不變。這些樣式儲存在目前瀏覽器中，並隨主題一起儲存：**💾 Save theme** 將其寫入 themes\<name>.json，載入 / 匯入主題時會帶入該主題自己的樣式。Settings ▸ Themes 會列出這些規則（每條可用 ✕ 刪除，或用 **↺ Clear element styles** 全部清除）。如果有對話方塊在最上層開啟，Style 面板會在該對話方塊內開啟。

## 框架：形狀內的圖層、Edit Frame、生成到形狀中（2.442.0）
<!-- en: frames-layers-inside-a-shape-edit-frame-generate-into-a-shape-2-442-0 dc5574b547a0 -->

**框架**是任何閉合形狀——矩形、橢圓、多邊形、閉合路徑——其內部包含圖層：這些圖層只在形狀的輪廓內顯示（形狀的填充在它們後面，輪廓在最上層），在 Layers 中它們以樹形結構顯示在該形狀下方（▾ 展開 / 摺疊）。

- **放入圖層**：在 Layers 中按住 Ctrl 點選圖層（選取它們），將形狀設為活動圖層，然後選擇 **Layer ▸ Frame ▸ Place Inside Frame…**——對話方塊會顯示框架（可以選擇任何閉合形狀），並可將內容在框架中居中。也可以將圖層拖到 Layers 中某個閉合形狀所在行的正中間。
- **框架整體移動**：移動、旋轉、縮放或斜切框架（Move tool、property bar、Transform 面板、路徑工具）——框架內的所有內容都會隨之移動、旋轉和縮放（拖曳時即時顯示；一個復原步驟）。關閉 **Lock Contents to Frame** = 只移動框架本身。
- **Edit Frame Contents**（用 Move tool 雙擊框架，或透過選單）：內容完整顯示（框架外的部分呈淡化顯示），每項內容都可以像任何圖層一樣移動、變換和繪製；畫布上的欄——**✓ Finish Editing Frame**——用於返回普通模式。在普通模式下，點選內容會選取框架。
- **Extract Contents**：圖層會從框架中移出，放在框架上方，位置保持不變。
- **✨ 生成到形狀中**：當閉合形狀處於活動狀態時，✨ AI ▸ Generate 會在形狀的邊界框內生成圖片，✔ Apply 會將其放入形狀內部（成為框架）。Layer ▸ Frame ▸ ✨ Generate Into the Picked Shape 可關閉此功能。
- 框架儲存到 .psd 時成為一個組（形狀 + 被其裁切的內容），在 .bgi 中仍保持為框架。

## CAD 尺寸標註：精確點、即時端點、比例（2.441.0）
<!-- en: cad-dimensions-exact-points-live-ends-a-scale-2-441-0 c2d57fc73ba4 -->

**精確點**：使用尺寸標註工具（Parallel、Horizontal / Vertical、Angular）時，指標會像 CAD 程式一樣吸附——吸附到形狀的節點及其各邊的中點、每個圖層（包括圖片圖層）的角點和邊中點、形狀輪廓上的最近點、參考線交點——停留時會標出所取的點並顯示其名稱（Alt = 不吸附）。

**拖曳端點**：用 Move tool（或 Shape tool / 路徑選擇工具）選取一個尺寸標註——其兩個端點和標註線上會顯示手柄。拖曳端點時，尺寸標註及其數值會即時跟隨。**Shift** 使該端點與另一端點保持水平，**Ctrl** 使其位於另一端點的正上方 / 正下方（垂直）——自 2.457.0 起提供。中間的手柄用於移動尺寸線。每次操作為一個復原步驟。（使用尺寸標註工具時，點選端點會在該處開始繪製一個新的尺寸標註。）

**比例**：選取的尺寸標註的 property bar 會顯示 📏 其尺寸和單位。輸入實際尺寸並選擇單位（mm、cm、m、km、in、ft、yd、mi）：這就是該圖片的**比例**——圖片中的每個尺寸標註都會按此比例重新測量，之後繪製的標註也會使用該比例。⚖（或 Layer ▸ Dimension Scale…）用於設定小數位數或清除比例。圖片會保留其比例（在其 .bgi 中也是如此）；每張圖片都有自己的比例。

## 標尺、參考線和吸附（2.440.0）
<!-- en: rulers-guidelines-and-snapping-2-440-0 99596f9e5488 -->

**標尺**（View ▸ Rulers，Ctrl+R）使用 **View ▸ Ruler Units** 中設定的單位：像素、毫米、公分、英吋或點（按 View ▸ Grid and Snapping… 中設定的文件 dpi 換算）。

**參考線**：從標尺中拖出——從頂部標尺拖出水平參考線，從左側標尺拖出垂直參考線。用 **Move tool** 移動參考線（或在使用任何工具時按住 Ctrl）；將其拖回標尺（或拖出圖片）即可刪除。View ▸ Guidelines（Ctrl+;）用於顯示 / 隱藏參考線，**Lock Guidelines**（Alt+Ctrl+;）將參考線固定在原位，**New Guideline…** 透過輸入位置來放置一條參考線，**Guidelines…** 列出所有參考線（修改位置、刪除、新增、全部清除），**Clear Guidelines** 清除所有參考線。文件會保留其參考線（在其 .bgi 中也是如此）。雙擊標尺可開啟參考線清單。

**吸附**——View ▸ Snap To：**Snap**（Shift+Ctrl+;）用於開啟 / 關閉吸附，並可選擇吸附目標：**Grid**、**Guidelines**、**Objects**（其他圖層的邊緣和中心）、**Nodes**（形狀的節點）、**Midpoints**（形狀各邊的中點）、**Intersections**（參考線之間以及參考線與頁面邊緣的交點）、**Page**（頁面的邊緣和中心）。預設吸附：參考線、參考線交點和節點。繪圖、選取範圍和路徑工具（選框工具、Crop、鋼筆工具、Shape 工具、向量線條和形狀、尺寸標註、連線線）會吸附指標；**Move tool** 會將圖層邊界框的左 / 中 / 右和上 / 中 / 下吸附到附近的目標上。吸附到的目標會在該點處標明（參考線、節點、中點、中心、邊緣、交點、網格）。**Grid and Snapping…**：吸附距離（螢幕像素）、固定網格間距（0 = 按目前縮放級別繪製的網格）、文件 dpi、參考線顏色。

## 屬性列、圓角半徑、在形狀中 Add / Subtract、線寬和線型（2.439.0）
<!-- en: the-property-bar-corner-radii-add-subtract-into-a-shape-line-width-and-style-2-4 59c4e5200ba7 -->

影像編輯器在工具選項下方還有第二個欄——選取圖層的 **property bar**（屬性列）：
**X、Y、W、H**，以像素為單位（圖層的邊界框）——輸入數值並按 Enter；**🔒** 保持比例（更改寬度時高度隨之變化，反之亦然），🔓 只更改一邊。每次更改為一個復原步驟；向量形狀保持向量（其角和輪廓保持清晰銳利），文字會調整大小，像素會重新取樣。

**矩形**（Rectangle 工具繪製的矩形，F6，或 Shape 工具繪製的矩形，U）會顯示其四個**圓角半徑** ⌜ ⌝ ⌟ ⌞——**🔗** 同時更改四個角，取消連結後每個角可單獨設定。**向量形狀或線條**會顯示其**輪廓寬度**（直接輸入，或從清單中選擇：none、hairline、1 … 24 px）及其**線型**，可從每種線型的示意圖中選擇（實線、虛線、點線、點劃線……；Custom… 會開啟 Outline Pen，F12）。

F6 形狀工具（Rectangle、Ellipse、Polygon、Star……）的欄開頭有一個**繪製模式**：
◻ **New**（每個形狀單獨一個圖層）、⊕ **Add**、⊖ **Subtract**、⊗ **Intersect**、⊘ **Exclude**。在 New 以外的模式下，選取某個向量形狀時繪製的形狀會成為該形狀的一部分——新增到其中、從中挖去……——而原有形狀保持原樣（兩部分仍可作為節點編輯；復原即可再次去掉新增的部分）。

## 浮動面板、命名面板、居中對話方塊（2.438.0）
<!-- en: floating-dockers-named-dockers-dialogs-in-the-middle-2-438-0 47a7d07f1182 -->

**影像編輯器的面板組可以浮動**：點選 Layers 組分頁（Layers / Paths / Channels / History / Actions / Comps）或 Colour 組分頁（Color / Swatches / Character / Paragraph）末尾的 ⇱，也可以使用 Window ▸ Float Layers Panels / Float Colour Panels。該組會在編輯器內變成一個獨立視窗：按住標題拖曳即可移動，拖曳任意邊或角即可調整大小；⇲ 或 ✕ 將其放回右側欄（Window ▸ Panels Back in the Column 會把兩組都放回）。

**命名面板**：在影像編輯器中選擇 Window ▸ New Docker…，或在選單列中選擇 ⊞ Docker layout ▸ ▣ New docker…，即可建立一個以你所起名字命名的空浮動面板（雙擊名稱可重新命名）。按住任意浮動面板的標題將其拖到它上方（它會亮起），然後鬆開：該面板便作為分頁停靠在那裡（點選分頁即可顯示它；點選它的 ⇱，或將分頁拖出，即可再次浮動）。命名面板也可以停靠到其他命名面板中。命名面板上的 ⚙ 提供：Rename…、**Main docker**（主面板，浮動在整個應用程式之上）或 **Confined to**（限定於）某個面板（影像編輯器、時間軸、另一個命名面板……它會留在該面板內並隨之隱藏）、Delete（其中的內容回到原來的位置）。所有內容的位置（浮動、停靠、尺寸、名稱、分頁）都儲存在安裝資料夾的 **panel_layout.cfg** 中。

**▣ Docker：供其他面板放入的空面板**（2.545.0）：狀態列中的 **▣ Docker**（位於 Queue 之後）或 **Ctrl+Alt+D** 可顯示 / 隱藏它。用主面板標題列中的 **⇱** 將其浮動（Preview、Timeline、Image editor、ComfyUI、Music、Stems、SFX、Chat、Console；StoryBoard 有自己的 ⇱），然後按住標題將其拖到 ▣ Docker 上方（一條橙色線會顯示它將放置的位置），再鬆開即可。
- **並排或堆疊**：標題列中的 ⇆ = 並排（水平），點選後變為 ⇅ = 堆疊（垂直）；⚙ ▸ Layout 中還有 **Tabs**（分頁，一次顯示一個，與命名面板一貫的方式相同）。每個命名面板都可以這樣設定。
- 在並排 / 堆疊模式下，其中的每個面板都保留一個小標題列：將其拖出（或點選 ⇱）即可浮動，⇲ 將其放回主視窗。拖曳兩個面板之間的分隔條可調整它們的大小。
- **雙擊標題**可就地重新命名：按 Enter 確認，按 Esc 保持原樣。
- 其中的內容、順序、尺寸、佈局和名稱都儲存在 panel_layout.cfg 中。
- 2.549.0：**按住主面板自己的標題列即可將其拖入**：在 Music（或 Preview、Timeline……）的標題上按下並拖到 ▣ 面板上方；會有一個標籤跟隨指標，橙色線顯示其落點。普通點選仍然是摺疊該面板。（自 2.545.0 起標題列上的 ⇱ 變成了空按鈕，現在它又顯示 ⇱ 了。）
- 2.549.0：狀態列按鈕會顯示面板的**名稱**（▣ Audio）。其標題列中有 **📌 Make permanent**（設為永久）：它會變成主欄中的常規面板，帶有常規標題列（▾ 摺疊、⇱ 再次浮動、🗑、⛶ 最大化），其狀態列按鈕可顯示 / 隱藏它，下方的拖曳條可設定其高度，浮動面板仍可放入其中；還有 **🗑 Delete**（刪除，會先詢問；其中的面板回到原來的位置，該面板及其按鈕被移除）。之後再按 Ctrl+Alt+D 會新增一個。
- 2.550.0：**右鍵點選 ▣ 面板的標題列**（浮動的或已設為永久的）可使用 Rename…、Side by side / Stacked / Tabs、📌 Make permanent 或 ⇱ Float it again，以及 🗑 Delete docker。只有你自己建立的面板才有此選單。永久面板會放在原視窗所在的位置（位於其中心下方那個主面板之前），並在欄中佔據空間（它會與其他面板一起縮小，最小到 180 px；以前它被新增在底部，可能落到欄的可用空間之外）。
- 2.558.0：浮動的 ▣ 面板不再**壓在所有其他面板之上**：它現在是應用程式的浮動面板之一（與浮動提示詞面板、Basic Settings 和 LLM tokens 一樣），最後點選的那個會顯示在最前面。按住標題列拖曳面板時，每個 ▣ 面板都會顯示**橙色虛線輪廓**，方便你看清可以放在哪裡。
- 2.558.0：更多面板可以放入：**Settings、References、Assets、Queue 和 Gallery**（側欄，需在它們的標題上按下，而不是 ▾ / 📌）以及 **StoryBoard**，都可以像其他面板一樣按住標題列拖入。側欄面板放在 ▣ 面板中時，它所在的欄會關閉；**⇲** 會將它放回原位，並重新開啟其所在的欄。（提示詞面板、Basic Settings 和 LLM tokens 透過各自的放置區停靠，暫時還不能放入 ▣ 面板。）
- 2.559.0：每個**資料夾篩選器**都會記住你選擇的資料夾，直到你選擇另一個為止：包括 ComfyUI 模型下拉式清單的資料夾篩選器（Settings、Basic Settings、LoRA 行，每個下拉式清單各自記住）、📁 模型瀏覽器、角色對話方塊的 LoRA 資料夾以及 Model manager 的資料夾分頁（每個分頁各自記住）。這些都儲存在安裝資料夾的 **folder_filters.cfg** 中，因此關閉並重新啟動應用程式後依然保留。
- 2.559.0：**Basic Settings 儲存在安裝資料夾的 basic.cfg 中**：每次更改（無論是手動修改，還是由風格或專案修改）都會在片刻後寫入該檔案，應用程式啟動時會將其讀回（在讀取已開啟專案自身的設定之後），因此你會以上次的 Basic Settings 開始工作。風格卡片的模型下拉式清單不在其中（它們儲存在風格里）。若要讓 Basic Settings 從頭開始，請關閉應用程式並刪除 basic.cfg。
- 2.560.0：▣ 面板**可以像其他面板一樣停靠**：按住浮動 ▣ 面板的標題列，拖到某個面板的邊緣附近
  - 會出現與 Basic Settings 相同的藍色放置區（"Dock Docker above Preview"），鬆開後它會停靠在該面板的上方 / 下方、左側 / 右側（並排），或側欄面板（Settings、References、Assets、Queue、Gallery）的頂部 / 底部。拖曳其邊緣可調整大小；將其標題列拖開即可再次浮動（並可立即放到另一個邊緣上）。停靠位置會在下次啟動時恢復。
- 2.560.0：**Basic Settings、LLM tokens 和提示詞面板可以放入 ▣ 面板**：按住它們的標題列拖到 ▣ 面板（浮動或已停靠的均可）上方，該面板會顯示輪廓，橙色線顯示它們的放置位置，然後鬆開即可。將它們的小標題列（或分頁）拖出 ▣ 面板，或按 ⇲，它們便會再次獨立浮動。下次啟動時它們會回到所在的 ▣ 面板中。（靠近已停靠 ▣ 面板的邊緣時，它們會像以前一樣停靠在其旁邊。）
- 2.561.0：▣ 面板可以成為**獨立的一欄**：按住它的標題列，拖到**兩欄之間**的接縫上（Settings | References | Assets | 主欄 | Queue | Gallery，或視窗的左 / 右邊緣）。會出現一條高高的藍色條（"New column: Docker between References and Assets"）；鬆開後，它就會成為那裡的一個全高欄，並帶有自己的分隔條用於調整寬度。▾ 將它摺疊成一條窄條，其狀態列按鈕可隱藏它，將其標題列拖開即可再次浮動。該欄、其位置和寬度都會在下次啟動時恢復。
- 2.562.0：StoryBoard 中渲染（或 ⏫ 放大、✎ First frame）任務**因重新啟動而中斷**的場景，現在會顯示 "interrupted by a restart - ↻ Resume it in the Queue docker (Pending tab) and it carries on here"，並記住該任務。在 Queue 面板的 Pending 分頁中對該任務按 **▶ Resume**，場景就會將其接回：它會再次顯示為執行中並帶有進度列，任務完成後鏡次會出現在該場景中。（如果改為丟棄該任務，場景也會註明。）
- 2.562.0：**不再自動播放任何內容**：已完成的任務、從 Done 分頁或時間軸開啟的鏡次、正在執行任務的合併預覽、燈箱、StoryBoard 的 Watch 以及替換對話方塊的預覽，載入影片或歌曲時都處於暫停狀態；按 ▶（或 Space）開始播放。
- 2.563.0：**場景的圖片可以來自其他場景**：圖片選擇器（場景上的 ＋📁、✎ First frame 的 🅰 / 📍 / 🧸，以及 First / Last frame 槽位）會在 **🎬 Scenes** 上開啟，按編號列出其他每個場景自己的圖片（其 First / Last 影格、參考圖、✎ 圖片）；**🎞 Clips** 則可從任意已渲染的鏡次中擷取一個影格，也可用作場景的參考圖。選取的圖片會註明來源（"scene 1 · First frame"）。
- 2.563.0：**✎ First frame ▸ 🅰 Picture A**：選擇場景開始時所用的圖片，並將 *Start from* 設為 🅰 Picture A。它的風格、構圖、鏡頭取景以及人物姿勢都會被原樣保留；地點方面，如果你選了 📍 地點圖片則使用它，否則使用場景（或分鏡腳本的全域提示詞）所指定的地點及其檢視圖片，再否則使用 Picture A 自身的地點。**🤖 Write** 讓 LLM 編寫指令（它會將圖片稱為 <image1>, <image2> …），你可以按需修改；在方向說明為空時用 Picture A 執行 ✎ Make first frame，會先自動編寫指令。該影格由摺疊面板中選定的編輯風格生成。


- 2.564.0：**🎙 Voice chat：用語音和應用程式對話。**按狀態列中的 **🎙 Voice**（或 **Ctrl+Alt+V**），然後直接說話，無需按住任何按鍵：它能聽出你何時開始、何時停止說話，把你說的話轉寫成文字（在本機執行 faster-whisper，對話期間保持載入），本機 LLM 會大聲回答（使用你電腦內建的語音），並且真的會執行你要求的操作：編寫或修改提示詞（"write me a prompt of a fox in the snow"）、負面提示詞，選擇風格，修改 Basic Settings（"make it eight seconds"、"720p"、"16:9"），設定 Generate 生成的內容、影片模式，按下 Generate，生成靜影格，停止正在執行的任務，新增或渲染 StoryBoard 場景，顯示某個面板。它執行過的操作會列在回答下方。它說話時不會聆聽。⏸ 暫停聆聽，🔈 / 🔇 開關它的語音（並可選擇使用哪種語音），底部的輸入框可讓你改為打字，✕（或說再見）結束對話。它需要 faster-whisper（Settings ▸ Audio）和一個 LLM（Settings ▸ LLM）。2.564.0 還修復了 ✎ 🤖 Write（2.563.0）的問題，以及手機端聊天顯示 "[object Object]" 而不是 LLM 回覆內容的問題。
- 2.565.0：**StoryBoard 成了真正的分鏡腳本**：▦（新的預設檢視）將每個場景顯示為一張類似 Model manager 中的卡片，包括其分鏡腳本圖片（沒有則顯示其 First frame）、"Scene n"、狀態和文字，排列在網格中，每個場景到下一個場景之間有一個 ➜。卡片上：🖼 生成其圖片（↻ 換一張），▶ 渲染該場景，→ First 讓場景以這張圖片開始。點選卡片，其完整的場景卡片會在網格下方開啟，包含它原有的一切（提示詞、Ref / First / Cont / Trans、各影格、圖片、✎ First frame、膠片條……）；✕（或選擇器中的 "All scenes"）將其關閉。☰ 則像以前一樣以清單顯示。
- 2.565.0：**🎞 Write storyboard**（StoryBoard 工具列）：給它一段簡介，LLM 會編寫各個場景（使用你的角色和勾選的參考），每個場景都會得到自己的分鏡腳本圖片，由工具列中選定的影像模型和參考（☑ Character sheets / Locations / Reference images）生成。勾選 **☑ Start on it** 後，每張圖片都會成為其場景的首幀（First frame）（Ref 場景會變為 First），可用 ↻ 或場景的 First frame 選擇器更改。編寫器至少需要一個角色。
- 2.566.0：**MOSS-Image**（OpenMOSS 的開源 5B 影像模型，Apache-2.0，擅長圖片中的文字和版式）現已作為一種模型類型提供：影像風格 **MOSS-Image**（SFT，推薦使用）和 **MOSS-Image Base**（用於 LoRA）。**Settings ▸ Add-ons ▸ MOSS-Image** 會從 Comfy-Org/MOSS-Image 下載其檔案到 ComfyUI 的資料夾中：勾選 SFT / Base（int8，5.4 GB；bf16 精度更高），文字編碼器（Qwen3.5 9B）和 VAE 始終包含在內；如果你刪除了這些風格，它也會將其恢復。它需要 2026 年 10 月 16 日或更新的 ComfyUI（附加元件會檢查正在執行的 ComfyUI，若版本較舊會提示你更新）；使用 int8 檔案時約需 14 GB 顯示記憶體。25 步，cfg 2.5（ComfyUI 內建的範本）。
- 2.567.0：**主題編輯器**（🖌 Edit theme mode ▸ Style 面板）可以對齊文字並調整間距：**Text ▸ Align** ⇤ ↔ ⇥ ☰（左對齊 / 居中 / 右對齊 / 兩端對齊）和 ⤒ ↕ ⤓（頂部 / 中部 / 底部），對按鈕、成行或成列的專案以及文字塊同樣有效；**Text ▸ Padding / Margin** = 文字本身周圍的空間（純文字元素）；**Box ▸ Corners** 可單獨設定每個角的圓角（↖ ↗ ↘ ↙，優先於 Radius）；**Box ▸ Padding / Margin** = 元素邊緣內側 / 外側的空間。每項各有四個框（上、右、下、左）；**=** 將第一個值複製到全部四個框；–（或空框）= 各自獨立的值。與其他設定一樣隨主題一起儲存。
- 2.568.0：**StoryBoard 的圖片由 LLM 編寫**：🖼 會把場景發回給 LLM，由它編寫圖片的提示詞，即場景的開場畫面（誰、做什麼、在哪裡、取景、光線），並點名所用的參考圖。參考圖包括**角色設定圖**和**前一個場景的最後一個影格**（目前一個場景有已渲染的鏡次時，圖片會從那一刻接著往下）；如果前面沒有鏡次，則使用角色和場景的文字。對應 StoryBoard 工具列上的 ☑ LLM writes it / ☑ Previous last frame（兩者預設開啟）。**📁 更換圖片**：可換成另一個場景的圖片、某個鏡次的一個影格、任意專案圖片或一個檔案（勾選 ☑ Start on it 時，它也會成為場景的 First frame）。在網格中，**圖片佔滿整張卡片**：場景名稱和兩行文字疊加在底部，按鈕在停留時顯示；工具提示中包含完整文字和圖片的提示詞；點選會開啟場景的完整卡片。
- 2.569.0：**影像編輯器中的 🔲 Zones（區域）**：畫布上的方框，用來告訴 AI 在哪裡放什麼（這裡放 "a kite"，那裡放 "a dog"，那邊放 "a bench"）。✨ AI panel ▸ 🔲 Zones ▸ **🔲 Draw boxes**（Zones 工具，與選框工具放在一起）：在畫布上拖曳即可畫出一個方框（每個方框都有自己的顏色和編號），拖曳方框可移動它，拖曳其邊 / 角可調整大小，Delete 刪除選取的方框；在清單中輸入每個方框裡要放的內容。可選：場景描述（作用於整張圖片）。然後選擇生成方式，並點選 **✨ Generate zones**：
  **▣ One box at a time**：每個方框用填充風格執行一次 ✨ Generate（Add content），全部一次性加入 ⏳ Pending；勾選 ☑ Apply as they come 會將每個方框的第一個結果作為獨立圖層放入。**✎ Edit model, one pass**：把以各自顏色描出方框輪廓的圖片一次性發送給 Edit 模型（"Put a kite inside the red box …, remove the outlines"）：光線最協調，位置則較寬鬆。**▦ Regional prompt, one pass**：用 ComfyUI 影像風格根據方框生成一張新圖片：場景的文字作用於整張圖片，每個方框的文字只作用於方框內部（ComfyUI 的區域條件控制，最適合 SDXL 類風格；FLUX / Qwen 的遵循程度較寬鬆）。已有圖片時預設使用 ▣，空白畫布預設使用 ▦。方框隨文件（及其 .bgi）一起儲存，永遠不會被畫進圖片中。
- 2.570.0：影像編輯器支援 **🖊 Pen tablet**（數位板：XP-Pen、Wacom、Huion……透過 Windows Ink），即 🖌 Brush 旁邊的 **🖊 Pen** 分頁（Window ▸ Pen Tablet）：一個**測試板**，顯示壓力、傾斜、正在使用筆的哪一端，以及你的筆傳送的**壓感級別**（XP-Pen 約為 8192）；與驅動程式類似的**壓力曲線**（Extra soft、Soft、Linear、Firm、Extra firm、S-curve，也可拖曳其控制點）、**Lightest touch** 和 **Full pressure at**；對每種畫筆都可設定 ☐ **Pressure → size** / ☐ **Pressure → opacity**（以及最小尺寸）；勾選 ☑ 後，**橡皮擦端**用於擦除（把筆轉回來時畫筆會恢復）；**側鍵** = Eyedropper（吸管）；勾選 ☑ **傾斜**後會轉動筆尖（🖌 Brush ▸ Shape Dynamics ▸ Angle / Roundness control: Pen tilt）；☐ 使用滑鼠時：根據速度模擬壓力。畫筆預設 ▾ 中有七種**數位筆刷**：G-pen、Mapping pen、Brush pen、Real pencil、Fineliner、Technical pen、Calligraphy（45° 筆尖，隨傾斜轉動）。沒有壓感？在 XP-Pen 的 Pen Tablet 設定中勾選 **Windows Ink**，然後重新啟動套用。
- 2.571.0：**選取多個片段，一次性全部拖到時間軸上**：在 Gallery、Assets 面板和 References 托盤中，**Ctrl+點選**新增 / 取消一個，**Shift+點選**選取從上次點選的項到目前項的範圍（Ctrl + Shift 新增一個範圍）；普通點選與以前一樣（選取一個圖塊；Gallery 會在檢視器中開啟它）。拖曳任意一個選取項，所有選取項都會一起移動：放到時間軸（或預覽）上時，它們按**從舊到新**的順序排列，最舊的在最上方的圖層，最新的在最下方，每個各佔一個圖層，從放下的位置開始首尾相接。時間軸工具列上的 **⛓ Sequential**（在 ripple 旁邊）會將所有片段首尾相接、無間隙地排列，按圖層從上往下（V1、圖片圖層、影片圖層），並在開啟期間一直保持：刪除一個片段，後面的會自動補上；插入一個帶片段的圖層，後面的會讓出位置；修剪一個片段，後面的會隨之移動。音訊圖層、文字、形狀和卡拉 OK 圖層保持不動。
- 2.572.0：時間軸工具列上的 **✨ Auto transition [N] frames [type]**：在位於不同圖層的兩個影片片段之間的每個剪下點，下一個片段會在 N 影格內過渡進入（溶解、淡入淡出、擦除、滑動、圓形、縮放……），**而不移動任何東西**：每個片段都保持原有起點，因此與歌曲的唇形同步仍精確到影格。剪下點之前的片段會在這些影格內墊在下方（如果檔案在其結尾之後還有影格，就使用這些影格，否則定格其最後一個影格）。開啟 = 每次更改後都會保持（在 ⛓ Sequential 之後執行）；關閉 = 恢復為普通硬切；你自己設定的過渡不受影響。全部位於 V1 上的片段使用 V1 自身的銜接方式（Out），會讓它們彼此重疊。**🔊 / 🔇 Video sound** 一次性將 V1 和所有影片圖層靜音或取消靜音，使音訊圖層上的完整歌曲能夠不被打斷地播放。
- 2.573.0：StoryBoard 歌曲條上的 **✂ cut duration**（位於音訊片段的選單列中，Transition 之前）：歌曲自動切分的秒數（2-60，預設 10 / 15 / 20 / 29.9）。更改後會立即重新切分已開啟的歌曲（你透過輸入時長鎖定的分段保持不變），並且該值會被記住，用於下一首歌曲；💾 像以前一樣儲存 .seg 和場景。29.9 可確保每個場景都在一次 Long video 執行之內（⚙ Long video，MiniMax H3：719 影格）；30.0 為 720 影格，會被渲染為兩次執行再拼接。
- 2.573.0：**⟳ ComfyUI updates**（Settings ▸ ComfyUI ▸ Engine，位於 ▶ Start / ■ Stop 下方）：顯示此 ComfyUI 的版本和安裝類型、更新通道（Newest = master，與可攜版的 update_comfyui.bat 相同，FastH3 Omni 等新模型最先出現在這裡；Stable = 最新正式版），以及 🔍 Check 和 ⤓ Update ComfyUI。可攜版會執行 ComfyUI 內建的 update\update.py（它會自行安裝新的相依套件）；git 複製會執行快進（或切換到最新的發行標籤），並用 pip 安裝 requirements.txt。由 bitGen Studio 啟動的 ComfyUI 會先停止再重新啟動；以其他方式啟動的則必須先手動關閉。節點套件不受影響。
- 2.573.0：**啟動時檢查更新**：應用程式啟動 20 s 後，會向 GitHub 查詢 bitGen Studio 和 ComfyUI 的新版本；如有更新，狀態列中會出現 ⬆（點選會開啟相應的 Settings 分頁），並且每個新版本會彈出一次小卡片（Open / Later / Don't check on startup）。Settings ▸ General ▸ ⟳ Updates ▸ "Check for updates on startup" 可關閉或開啟此功能。離線時不會有任何動作。
- 2.573.0：**FastH3 Omni**：FastVideo 對 MiniMax H3 參考生成影片（reference-to-video）模型所做的 8 步蒸餾版本（輸入圖片、影片和語音，輸出帶聲音的影片，速度快數倍）。Settings ▸ Add-ons ▸ FastH3 Omni 可下載它（22 GB int8；H3 的文字編碼器和 VAE 僅在缺失時下載）；需要 ComfyUI 0.43 或更高版本（⤓ Update ComfyUI，選擇 Newest）。可將其用作影片風格 **FastH3 Omni**，或 StoryBoard 的 Workflow ▸ **FastH3 Omni · ref2va 8-step**（渲染方式與 H3_Video_Ref 相同：每個場景都用 ref2va，場景 n 承接場景 n-1 的鏡次）。任何模型為 FastH3 檔案的 H3 圖（Basic Settings ▸ Override style ▸ Model）都會自動套用其配方：sigma shift 12/3、VSA 稀疏注意力、8 步、cfg 1，並移除基礎模型的 turbo LoRA；Sage / Spectrum / Veda 會被跳過（它們會取代 VSA）。Omni 是參考生成影片模型，First / Cont / Trans（fl2va）場景應繼續使用 H3 自己的 fl2va 模型。


- 2.574.0：**theme edit mode ▸ Text 可作用於任意文字**：面板的標題列（選取它後，Text 會顯示其標題，且只針對該面板），以及除按鈕或輸入框之外還帶有自身文字的任何元素（例如帶核取方塊的標籤），都可以設定新文字；▾ / ▸ 箭頭、📌 和按鈕保持不變，摺疊後仍保留新標題，↺ Clear 恢復原來的標題。沒有自身文字的元素會提示這一點，此時請直接選取文字本身。
- 2.574.1：在 theme edit mode 中選取的每個元素，**Apply to ▸ This element only** 都是第一個選項，也是預設值：每次選取都從它開始（面板不再沿用上一個元素的 Apply to）。新文字始終只屬於選取的那個元素：使用範圍更大的 Apply to（All like it、Every <div>）時，其餘樣式會大範圍生效，但文字只留在那一個元素上。匹配到多個標題的文字規則，或者單純的標籤名（div、button），永遠不會重新命名它們；之前所有面板都變成同一個名字的主題會自行修復，請重新命名你原本想改的那個面板。
- 2.575.0：**Model manager：模型的個人檔案**：在卡片的 ⓘ 頁面上，用 **＋ Add…** 新增圖片、影片或聲音（或從相簿 / Assets 拖放到那裡）。每個檔案都保留生成時所用的提示詞、負面提示詞、種子、cfg 和步數（讀取自本應用程式自己的渲染記錄、PNG 中的 ComfyUI 圖或 A1111 文字，或者影片 / 歌曲的標籤），可用 ✎ 編輯。點選任意圖片（你的圖片、Civitai 的範例、主縮圖）會在檢視器中完整開啟它；**✎→** 會將其提示詞連同種子、cfg 和步數傳送到提示詞框和 Basic Settings；**🖼** 將其設為卡片的縮圖（也可用 ✎ Edit ▸ Thumbnail ▸ 🖼 Change… 從磁碟選擇圖片；↺ Its own 恢復原縮圖）。這些內容與模型頁面一起儲存在 model_info 中，模型資料夾永遠不會被改動。
- 2.575.0：**✎ Edit card**：**Your rating** 為五星評分，以半星為單位：停留可預覽，點選即可評分（點星星的左半邊 = ½），← → 按半星調整，✕ 清除；**Model type**（Checkpoint、Diffusion model、LoRA、LyCORIS、VAE、Text encoder、ControlNet、Upscaler、Embedding……）；**NSFW** 🔞。篩選欄包含**所有模型類型**和 **🔞 NSFW**（取消勾選 = 隱藏 NSFW 卡片，此設定會被記住）。
- 2.575.0：相簿中的圖片 / 影片 / 歌曲、Assets、References（圖片、影片、聲音）以及檢視器的 ⓘ 詳情中新增 **✎→ To prompt**：填入檔案的提示詞及其種子、cfg 和步數（圖片：填入 Basic Settings ▸ Image 的步數 / cfg；影片：填入 Basic Settings 的步數 / cfg；歌曲：填入 Music 面板的歌詞和種子）。底部會有一條提示，說明設定了哪些內容。
- 2.575.0：**狀態列中的 Civitai 同步狀態**：⤓ Civitai info / 🔄 Sync 執行期間顯示 "🔄 Civitai 12/80"（點選會開啟模型管理器），完成後顯示 "✓ Civitai synced: … found · … no match"，持續 30 s。
- 2.575.0：**面板會恢復到關閉時的樣子**：放入 ▣ 面板的面板在重新啟動後會保留其位置、分頁順序、目前顯示的分頁以及狀態（開啟 / 摺疊 / 隱藏）；最小化的浮動面板保持最小化；擴充功能面板按關閉時的狀態重新開啟或保持關閉；關閉前剛做的佈局更改也會被儲存；已儲存的 ⊞ 面板配置不再在應用程式啟動時覆蓋恢復的佈局。
- 2.576.0：**🔄 Sync 能找到已重新命名的 Civitai 模型**：按檔名找不到的模型會透過其 SHA-256 查詢（基於檔案內容，精確匹配，與檔名無關）。讀取大檔案需要一些時間，狀態列會顯示 "🔄 Civitai 3/9 · reading 45%"。之前結果為 "no match" 的模型會在下一次 🔄 Sync 時重新查詢一次。
- 2.576.0：**檢視器中的 🧩 To model…**：將你正在檢視的圖片、影片或歌曲傳送到某個模型的檔案中（model_info，連同其提示詞、種子、cfg 和步數）。生成它時所用的模型會被預先選取；勾選 **Make it the model's thumbnail** 可將其設為模型縮圖（模型還沒有縮圖時會自動勾選）。
- 2.576.0：**Ctrl+↓ = 設為模型縮圖**：在檢視器中瀏覽某個模型自己的圖片（或 Civitai 範例）時，按下它會立即將其設為縮圖；在其他任何圖片上則會開啟 🧩 選擇器，並已勾選縮圖選項。在模型管理器的 ⓘ 頁面中，先點選一張圖片 / 範例，然後按 Ctrl+↓。
- 2.577.0：**使用你自己的姿勢表**：六個內建姿勢範本已被移除。請將你的姿勢表（PNG、JPG 或 WebP；可以使用子資料夾）儲存到安裝資料夾的 **pose_sheets** 資料夾中。在 Character creator 中，**🧍 Pose sheet**（原來 Pose 下拉式清單的位置）會開啟它們的縮圖：點選一張後點 **✔ Use**（或直接雙擊）；**No pose sheet** = 自然站姿；**📂 Open folder** 開啟該資料夾，**↻ Refresh** 在你儲存新的姿勢表後重新讀取。生成的設定圖會保留你姿勢表的分格佈局，以及每一格中的姿勢和鏡頭角度，並把你的角色放進去。所做的選擇會被記住。該資料夾完全歸你所有，永遠不會出現在發布的 zip 或程式碼儲存庫中。
- 2.578.0：**📐 SolidCraft 面板**：SolidCraft（開源參數化 3D CAD，MIT OR Apache-2.0，solidcraft.io）在應用程式內以獨立面板完整執行（狀態列中的 📐 SolidCraft 按鈕）：帶約束的草圖、拉伸、旋轉、掃掠、放樣、圓角、倒角、抽殼、孔、螺紋、陣列、鈑金、塑膠件、帶關節和運動分析的裝配、參數，以及 STEP / IGES / STL / OBJ / 3MF / glTF。只需 **Install** 一次：在面板中（⤓ Install，約 20 MB，來自 SolidCraft 的 GitHub releases）或在 Settings ▸ Add-ons ▸ SolidCraft 中安裝；離線時：從其發行頁面下載 solidcraft-web-<version>.zip，然後使用 **📦 Install from a zip…**。安裝後即可離線使用；有更新版本的 SolidCraft 時，工具列中會顯示 **⤓ Update**。工具列把它與應用程式連線起來：
  **📁 Designs** 開啟專案中的設計和零件（projects/<project>/solidcraft）或電腦上的設計；**💾 Save to project** 將設計儲存到專案中，之後 SolidCraft 自己的儲存（Ctrl+S）會讓專案中的副本保持最新；**🖼 → Image editor** 會立即把模型的圖片（透明背景，使用你選擇的 **Size**，**Edges** 開或關）放入影像編輯器，**Shift**+點選則使用 SolidCraft 自己的帶光照渲染（較慢，工具列會顯示進度）；**View** 選擇角度（Iso、Front……Bottom，或你在 SolidCraft 中儲存的 Named View，這是取得自訂角度圖片的方法）；**🎞 → Timeline** 在播放頭位置將模型新增為 3D 圖層（再次傳送會更新它）；**✏ Sketch → SolidCraft** 將影像編輯器中選取的草圖圖層轉換為 SolidCraft 草圖，以便拉伸或旋轉；**⤓ Export** 將 STEP、STL、OBJ 或 3MF 儲存到專案中。
- 2.579.0：**📐 SolidCraft 面板僅在安裝了 SolidCraft 後才顯示**（其狀態列按鈕也一樣）：在 Settings ▸ Add-ons ▸ SolidCraft 中安裝（**⤓ Install**，離線時用 **📦 Install from a zip…**），面板就會出現。工具列中的 **Send** 按鈕：**🖼 Send to Image editor**、**🎞 Send to Timeline**、**📏 Send to Sketcher**（自 2.630.0 起，零件會作為一個組進入 Sketcher）、**🟠 Send to Blender**（僅在找到 Blender 時顯示：Blender 會在獨立視窗中開啟該零件，單位為米，Z 軸朝上，儲存為 projects/<project>/blender/solidcraft/<name>.blend）以及 **🎮 Send to Unreal**（僅在設定了 Unreal 專案或編輯器時顯示：零件會作為 Static Mesh 匯入到 /Game/bitGen/SolidCraft，並放置在目前開啟的關卡中；再次傳送會在原位置替換它；需要 bitGen Bridge 外掛 **1.4.0**，可用 🎮 Load UE project 更新它，或將 **bitgen-ue-bridge-1.4.0.zip** 解壓縮到專案的 Plugins 資料夾中）。
- 2.579.0：在 🧩 Model manager 中 **🗑 刪除模型**：點選卡片上的 🗑 或其 ⓘ 頁面上的 **🗑 Delete**。確認框會列出將被刪除的內容：模型檔案（從磁碟上永久刪除，不進垃圾桶）、旁邊與其同名的檔案（預覽圖、.civitai.info、.bitgen.json、它的 .yaml……）以及它的 model_info 頁面，並會提醒哪些風格正在使用它。
- 2.579.0：**Settings ▸ Dockers**：列出每個面板（主欄中的面板、側欄面板、浮動視窗（Basic Settings、Model manager……）以及每個擴充功能面板，包括你以後新增的）及其目前位置，並提供 **↺ Reset**：恢復到預設位置和大小（移出浮動視窗或 ▣ 面板，取消最大化，顯示並展開，恢復最初的高度 / 寬度；視窗則恢復到最初的位置和大小）。**↺ Reset all** 會重設所有面板。


- 2.580.0：**🧩 Model manager ▸ 📁 Model paths**：列出 ComfyUI 的 **extra_model_paths.yaml**（ComfyUI 讀取的那個檔案，路徑顯示在頂部）中的每組路徑，每組都顯示其 base_path、is_default，以及每個路徑一行（資料夾類型 + 路徑，✓ 表示資料夾存在 / ✗ 表示不存在）。
  - **➕ New group (other_ui1)**：選擇基礎資料夾（其他 UI 的安裝目錄、存放模型的硬碟……）；該組會被命名為 other_ui1、other_ui2……（取第一個未被佔用的編號），並自動填入在其下找到的模型資料夾（models/checkpoints、models/loras、models/vae……也包括 A1111 / Forge 安裝中的 models/Stable-diffusion 和 models/Lora）。
  - **修改路徑**：直接在其中輸入，或點選 **📁** 選擇資料夾（位於基礎資料夾內時會寫成相對於它的路徑）；**+ path** 新增一行，**🗑** 刪除一行；可以重新命名組或勾選 is_default；**💾 Save** 寫入該組（**↶** 放棄更改）。同一資料夾類型的多個路徑會寫成清單。
  - **🗑 Delete group** 從檔案中刪除該組（資料夾和模型仍保留在磁碟上）。
  - 只有你儲存的那個組會被更改，檔案中的其他所有組、註釋和空行都保持原樣；之前的檔案會保留為 extra_model_paths.yaml.bak。如果在該分頁讀取之後，檔案在別處被修改過，儲存會被拒絕，分頁會重新讀取檔案。
  - **⟳ Restart ComfyUI**：ComfyUI 只在啟動時讀取該檔案，此按鈕會停止由 bitGen Studio 啟動的 ComfyUI 並重新啟動它（未執行：直接啟動；由其他程式啟動：不作處理，並會給出提示）。
- 2.581.0：**🔄 Sync 和 ⤓ Civitai info 現在也會保留模型的影片和 GIF 動畫**（影片模型的範例通常是短片）：範例按 Civitai 的順序取得，包括影片（512 px，每個最多 60 MB）、GIF 和靜態圖；卡片的縮圖直接使用第一個範例的原樣，因此影片縮圖會在卡片及其 ⓘ 頁面上播放（靜音、循環）；範例中的影片會直接播放，GIF 會標註 GIF，檢視器會以影片形式開啟影片。之前同步過的模型會在下一次 🔄 Sync 時按其 Civitai 版本 id 重新取得。影片也可以作為卡片的縮圖（透過 ✎ Edit card、在選取的範例或你自己的檔案上按 Ctrl+↓，或 🧩 To model…）。
- 2.581.0：**選取 LoRA 的關鍵詞會進入 LLM 編寫的內容**：✨ Enhance 和提示詞聊天會把選取 LoRA 的關鍵詞（觸發詞）告訴 LLM，選取的 LoRA 包括 Generate 模式下 Basic Settings 的 LoRA 行（🧩 Model manager 中 ✓ 選擇的 LoRA 會放到這裡）以及 Model manager 自己選取的 LoRA；而且 ✨ Enhance 會把 LLM 遺漏的關鍵詞強制加上（放在末尾，主控台會顯示是哪些）。關鍵詞取自卡片（你在 ✎ Edit 中填寫的；沒有則用 Civitai 的訓練詞；再沒有則用 LoRA 檔案中最常用的標籤），每個 LoRA 最多 5 個。
- 2.581.0：**📐 SolidCraft 面板中的 ✨ Generate**：描述一個零件（和/或提供一張圖片），它就會作為一個個可編輯的特徵進入 SolidCraft：草圖（直線、圓弧、圓）、拉伸、切除、孔、圓角和倒角都會出現在其時間軸中，每一個都可以修改。
  - 只需安裝一次：Settings ▸ Add-ons ▸ **CAD generate**，包括 CadQuery（必需：用於執行零件的程式碼）和 **cadrille**（預設勾選：一個開源 2B 模型，可根據文字或圖片編寫零件；最好配合 NVIDIA GPU 使用；其權重採用 CC BY-NC 4.0 許可，僅限非商業用途，安裝時從 Hugging Face 下載）。
  - **Engine**：Auto（已安裝 cadrille 時使用它，否則使用應用程式的本機 LLM）、cadrille 或本機 LLM（圖片會先由視覺模型描述）。執行失敗的程式碼會連同錯誤資訊返回給 LLM，最多重試 2 次。cadrille 接受描述或圖片（兩者都提供時以圖片為準）；它是用零件的乾淨渲染圖訓練的，因此零件的渲染圖或圖紙比照片效果好得多。
  - **into the open design** 關閉（預設）：新增一個設計；開啟：新增到目前開啟的設計中。
  - 重建結果會經過檢查：SolidCraft 中的體積必須與 CadQuery 的一致。遇到暫時無法重建的步驟（旋轉、放樣、掃掠、抽殼、鏡像……），或重建結果不一致時，零件會改為作為單個實體（STEP）匯入，並說明原因。
  - 零件的 STEP + OBJ 位於專案的 solidcraft 資料夾中，其程式碼位於 solidcraft/ai/。**✎ The code**：編輯程式碼，然後點選 **▶ Run again**。在描述框中按 Ctrl+Enter 即可生成。
- 2.582.0：**編輯工具中的 Fibo 2.0**（Bria AI 的 8B 模型；其權重採用 CC BY-NC 4.0 許可，僅限非商業用途）。提供兩種影像風格：**Fibo 2.0 Edit Turbo** 根據指令用 4 步編輯圖片，**Fibo 2.0 Dev** 用 30 步根據文字生成圖片並編輯圖片。兩者都位於影像編輯器的 ✨ AI ▸ Edit 中（選取範圍中的圖片為 `<image_1>`），並且都可接受最多 4 張參考圖（`<image_1>`..`<image_4>`）；參考面板的 `<Picture n>` 標籤以及提示詞中的 "picture 2" 會自動改寫成這種形式。
  - **Low VRAM**：這些風格載入 w4a8 ConvRot 檔案（6.6 GB）以及 int8 Qwen3-VL 4B 文字編碼器，大約一張 8 GB 顯示卡即可執行，ComfyUI 會把其餘部分移到記憶體中。GGUF Q4_0 / Q5_0 / Q8_0 也可以使用：在 Settings ▸ Image 中選擇 .gguf 作為該風格的 Model（載入器會根據檔案類型自動切換；需要 ComfyUI-GGUF 節點套件）。
  - **Install**：Settings ▸ Add-ons ▸ **Fibo 2.0**，勾選所需檔案（Edit Turbo w4a8、文字編碼器和 VAE 預設勾選；選擇 GGUF 時也會安裝 ComfyUI-GGUF）。Fibo 2.0 需要 2026 年 10 月 21 日或更新的 ComfyUI。
- 2.583.0：**Team ▸ 渲染農場**（2.589.0：改為可選附加元件，見 Settings ▸ Add-ons ▸ Team render farm）：團隊成員開啟同一個專案，並在彼此的電腦上渲染，前提是得到電腦主人的許可。Settings ▸ **Team**（位於 Remote GPU 之後）：
  - **團隊資料夾**是 NAS 上每臺電腦都能開啟的資料夾（`\\nas\bitgen-team` 或對應的磁碟機）。負責人選擇該資料夾，輸入團隊名稱和自己的名字，然後按 **➕ Create the team**；其他人輸入自己的名字並按 **⇥ Join**。負責人看到請求後按 **✓ Approve**；**🗑 Remove** 將某人移出團隊（其金鑰立即失效）。在任意一臺電腦上都可以用 **⇤ Leave the team** 離開團隊。
  - **每日金鑰**：負責人的 bitGen 每天會在團隊資料夾中為每位已批准的成員寫入一個新金鑰（執行時會自動執行；**↻ Issue today's keys** 可立即執行）。金鑰有效期到當天午夜，且只能與儲存在成員自己電腦上的私鑰配合使用，複製金鑰檔案並不能讓任何人獲得存取權限。如果某天負責人的 bitGen 沒有執行，那天就沒有人能拿到金鑰（渲染農場會等待金鑰）。
  - **同一個專案**：**Use the team's projects folder** 讓這臺電腦開啟團隊資料夾中的專案（需重新啟動 bitGen）；每位成員都需要設定一次。
  - **🔌 Share this PC for team renders** 會開啟渲染埠（預設 8312）：僅在 bitGen 執行且開關開啟時生效，並且該埠上只開放渲染農場的呼叫（應用程式本身仍只在本機使用）。在同一網路中無需其他設定；透過 **Tailscale** 連線時，在 *This PC's address for the team* 中輸入這臺電腦的 Tailscale 名稱或 100.x 位址。
  - **存取權限**由電腦主人決定：成員發出的 **🔒 Ask for access** 會顯示在 *Asks for access* 下，主人可選擇 **Unrestricted**（只要 bitGen 在這臺電腦上執行，隨時都可以）、**from - to**（兩個日期和時間；超出這個範圍時，電腦會拒絕任務）或 **Deny**。*Access given* 列出可以在這裡渲染的人；**↺ Revoke** 收回權限。
  - **🖥 Render on**（狀態列）：**This PC**、某個團隊成員的電腦（✓ 表示你有存取權限，並顯示其時段；🔒 表示可申請；離線或未共享時顯示為灰色），或 **⚡ Spread**（每個新渲染任務分配給本機和你可使用的電腦中最空閒的那臺）。選單中還會顯示團隊所有電腦正在進行的渲染及其進度。會被分發出去的是生成類任務（圖片、影片、歌曲、圖、替換、放大……）；安裝、下載、訓練、影片匯出和快速 ffmpeg 任務始終在本機執行。在其他電腦上執行的任務照常顯示在你的佇列中（其日誌會傳回），完成的檔案位於共享專案中，會像其他渲染結果一樣出現在你的素材中。被其他電腦拒絕的任務（無存取權限、超出時段、未共享、檔案不在團隊的專案資料夾中）會失敗，並在日誌中註明原因。


- 2.584.0：**🔁 Compare LLMs**（比較 LLM，位於提示詞面板的選單列）——輸入提示詞後按 🔁：每個已勾選的 LLM 依次作答（先是 LLM 下拉式方塊中的那個——它已經載入好；其餘的輪到時才載入，因此一輪所需的時間與載入它們的時間相當）。每條回覆顯示在提示詞對話中，標有對應 LLM 的名稱和用時；在你滿意的回覆上按 **✓ Use this one**（就用這個）——它即成為這次對話的回答（儲存在對話中、朗讀出來，歌曲會送往 Music 面板，影像 / 影片程式碼塊會設定模式），其餘回覆則摺疊起來（可顯示 / 隱藏）。**✗ None of them**（都不行）記錄為沒有一個令人滿意；**⏹ Stop** 跳過尚未提問的 LLM。這些回覆使用的內容與普通對話輪次完全相同（風格、LoRA 關鍵詞、參考圖面板、目前為止的對話）。
  - **▾** 選擇哪些 LLM 參與（視覺投影器從不出現在清單中）。若設定了外部 LLM 端點（Settings ▸ LLM），則只有一個 LLM，因此 🔁 不可用。
  - **🏆** 顯示每項任務表現最好的 LLM——劇本、音樂影片、歌曲、影像提示詞、影片提示詞、對話（任務由提示詞中的用詞判斷，即 🎬 🖼 📹 🎵 🎤 按鈕新增的那些詞），或所有任務：每個 LLM 被選取的次數、參與的次數、勝率 %、平均用時、失敗次數。**Use** 將該 LLM 設為對話 LLM。下方列出：每一輪的請求和每條回覆（🗑 刪除單條，🗑 Clear all 全部清除），以及 **⤓ Export CSV** 匯出為電子表格。
  - 記錄儲存在安裝資料夾的 **llm_arena/** 中（每輪一個檔案）——僅屬於這臺電腦，絕不會打包進 zip。
  - 如果 LLM 埠上仍在執行舊的 llama-server，它會替每個模型作答；這樣的回覆會被拒絕並給出提示（"the LLM port answered as …"），而不會以錯誤的名稱記錄下來。
- 2.585.0：**用你在 🔁 Compare LLMs 中的選擇訓練 LLM**——這些選擇會成為 🎓 LoRA trainer（LoRA 訓練器）中 LLM 微調的訓練集，訓練結果是寫入 LLM 資料夾的一個新 .gguf。
  - 現在每一輪都會儲存傳送給各 LLM 的**完整提示詞**（bitGen 的指令——風格、指南、LoRA 關鍵詞、參考圖——目前為止的對話以及請求），這樣用它訓練出的模型能學會按 bitGen 的提問方式作答。在 🏆 ▸ 某一輪的詳情中可以檢視。2.585.0 之前的輪次只有請求。
  - **🏆 ▸ 🎓 Train an LLM on your picks** 會說明你已做出決定的輪次能提供什麼——你選取的回覆作為**範例**，每條未被選取的回覆各構成一個**偏好對**（選取 vs 未選取）——針對頂部所選的任務或所有任務。選擇訓練器的 LLM 任務（或輸入名稱新增一個），選擇範例 + 偏好對 / 只用其中一種，帶或不帶 bitGen 的指令，然後按 **⤒ Send to the trainer**。再次傳送只會新增新的內容。最長的範例以 token 數顯示：任務的 **Max length** 必須容得下它（更長的範例會被排除在本次訓練之外，並在日誌中說明——絕不截斷，截斷會丟失答案）。
  - 在 🎓 訓練器中（LLM 任務）：**Job ▸ Learn from**——**Examples (SFT)**，即你想要的答案；**Preferences (DPO)**，相對於基礎模型的「要這個，不要那個」；**Preferences (ORPO)**，同上但無需參考模型（顯示記憶體佔用更少）。偏好訓練使用小得多的學習率（已為你設好）和 **Beta**（0.1——越高越貼近基礎模型）。**Dataset ▸ 🔁 Preference pairs**：數量、⤒ From 🔁 Compare LLMs、⤓ prefs.jsonl、🗑 Clear the pairs。▶ Start 會為 DPO / ORPO 統計偏好對的數量；日誌會顯示選取的答案已經勝出的頻率。
  - 有效的訓練需要幾百次選擇，最好集中在一種任務上（比如劇本）。訓練從基礎模型的原始（Hugging Face）檔案開始——.gguf 無法訓練——結果是一個新的 .gguf。請檢查你用來訓練的每個模型回覆所屬模型的授權條款：有些模型不允許用其輸出訓練其他模型。
- 2.585.0：**LLM 將哪些 LoRA 的關鍵詞寫入提示詞**（✨ Enhance 和提示詞對話）：Basic Settings 中 **Override style**（覆蓋風格）開啟時，只用那裡的**臨時 LoRA**（屬於 Generate 模式——影像或影片）；關閉時，只用**所選風格的 LoRA**（Image 用影像風格，Video 和 Chat 用影片風格）。在 🧩 Model manager 中選的 LoRA 本身不再計入。
- 2.586.0：**Settings ▸ Add-ons ▸ LLM**——對話 / 寫作 LLM 集中在一個下拉式方塊中：選一個並按 **⤓ Download**——.gguf 會放入 LLM 資料夾（Settings ▸ LLM），並出現在提示詞面板的 LLM 下拉式方塊和 🔁 Compare LLMs 中。✓ 標記你已有的模型；**🗑 Delete it** 刪除所選的那個（不能刪除正在執行的）。
  - **★ Qwen3.8 27B**（阿里巴巴，2026 年 8 月，Apache 2.0）是我們推薦用來製作**你自己的檢查點（checkpoint）**的基礎模型：UD-Q4_K_XL（17.6 GB）可在 24 GB 顯示卡上執行，Q5_K_XL / Q8_0 品質更高。在 🎓 訓練器中，其基礎模型可在 32 GB 顯示卡上以 4-bit QLoRA 方式訓練（使用 Unsloth 的 4-bit 檢查點；16-bit LoRA 需要超過 36 GB）。
  - **Gemma 4 31B**（Google，Apache 2.0）——另一款同級別的出色寫作模型；**Gemma 4 12B**（QAT，6.7 GB）——速度快，訓練起來也快；**Qwen3.5 9B**；以及設定精靈中的 Qwen3 4B / 8B / 14B。
  - 用 🔁 Compare LLMs 在你自己的任務上比較你下載的模型，然後用你的選擇訓練勝出者。
  - Qwen3.8 和 Gemma 4 需要較新的 llama.cpp——如果模型無法載入，請用 misc\get-llama.ps1 更新。
- 2.702.1：**Credits**（致謝）——Dandyson EEbu (Baridakara) 因文字特效和字型獲得致謝（見 Settings ▸ About 以及 Credits 部分的 Text effects and fonts 下）。
- 2.702.0：**SVG 圖片**——.svg 可以放入 Assets（拖入，或 + add pictures）以及 References（拖入、+ add reference，或從 Assets 拖過來）。上傳之後的環節都不讀取 SVG（ComfyUI、時間軸和模型都需要像素），因此工作室在匯入時將其繪製為 PNG——畫質清晰，因為向量圖按實際使用的尺寸繪製（長邊至少 2048、最多 4096 像素），並保留透明背景。之後 Assets 中儲存的是 <name>.png。Open 對話方塊會將 .svg 與其他圖片一起列出，因此 Image Edit 的 Open 和 Place as Layer 也能使用 SVG。需要旁邊其他檔案（連結的圖片或字型）的 SVG 在繪製時不含這些檔案。**1920 x 1080 的徽標**位於 docs/images/bitgen-logo-1920x1080.png。
- 2.701.0：**啟動畫面**——桌面應用程式開啟時會播放一段 15 秒的徽標短片（線條繪出、翅膀扇動、"bitGen Studio"、"together · grow · transform"）以及致謝 **Produced and developed by Timothy Nolan Paul** 和 **Programmed by Claude Opus 5.5**，同時工作室在背景啟動。點選畫面或按任意鍵可跳過；短片結束時（無論如何最遲 16.5 秒後）工作室就會出現。BITGEN_NO_SPLASH=1 可將其關閉。該短片也位於 docs/images/bitgen-studio-splash.mp4。**安裝程式**也會顯示徽標（在其標題列和每一頁的頁首中）。
- 2.700.1：徽標不再被裁切——標題列顯示完整的蝴蝶（static/logo-mark.svg，即按輪廓裁切的徽標），應用程式圖示也在邊框內為翅尖留出了空間。
- 2.700.0：**bitGen Studio 徽標**——由 Tim 親自設計（為 Tiger Art 而作）：兩隻老虎象徵不畏萬難的合作，一棵樹象徵成長，它們共同組成的蝴蝶則象徵蛻變為美好的事物。它是應用程式圖示（視窗、工作列、Windows 安裝程式）、瀏覽器分頁的圖示，以及標題列左側的標誌（採用主題的強調色）。一段 10 秒的徽標介紹短片位於 docs/images/bitgen-studio-intro.mp4（由 misc/intro/ 製作——執行 node misc/intro/render.js 可重新生成）。
- 2.699.0：**編輯尺寸跟隨 Override style**——勾選 Basic Settings 的 **Override style** 時，對 References 圖片的編輯按 Basic Settings 的 Size 輸出（同 2.698.0）；未勾選（或 Size = Style's own）時，按**第一張參考圖自身的尺寸**輸出（以 16 px 為步長，長邊最多 4096 px）——工作流程保持該尺寸，而不是縮放到它自己設定的百萬像素數。
- 2.698.0：**編輯按 Basic Settings 的 Size 輸出**——對 References 面板圖片的編輯（提示詞面板的 ✏ Edit，或在影像編輯器關閉時的 Refine）現在使用 Basic Settings 的影像 **Size** + **Aspect**：圖片 1 被裁成該形狀（保留中間部分），工作流程保持該尺寸（其自身的"scale to N megapixels"步驟隨之調整）。**Style's own** 與以前一樣保持圖片自身的形狀和尺寸。在影像編輯器內進行的編輯保持選取範圍的尺寸（結果會貼回到選取範圍上）。


- 2.697.0：**P-H3 Image Edit 可以正常使用了**——此前每個 P-H3 Image Edit 任務都會失敗並報 "Return type mismatch between linked nodes [guider]"：移除未使用的圖片槽位時，把工作流程圖中的 guider 也一併移除了。現在只移除槽位自己的參考節點（角色建立器的 guider 也曾受到同樣的影響）。
- 2.696.0：**Sketcher 專用的 Photo 風格**——Sketcher 工具列上 ✨ Photo 左側的下拉式方塊列出了各種影像編輯風格；✨ Photo 使用在此選取的風格（提示詞面板保留自己的風格），上次使用的風格會保持選取（重新啟動後也是如此）。所選風格已不存在時，會回退到提示詞的編輯風格或預設編輯模型。
- 2.695.0：Sketcher 中的**屋面材料**。屋頂（或 Roof 工具）的 **Covering**（屋面材料）：預塗彩鋼板——波紋板、肋板（梯形）或直立鎖邊——混凝土瓦、陶土瓦、石板瓦、瀝青瓦或透明聚碳酸酯板。屋頂會採用該屋面材料的顏色（直到你自己選色）及其紋理——金屬板為沿坡向下的肋條，瓦片、石板瓦和瀝青瓦為成排的瓦層和錯縫。面板會給出該屋面材料典型的最小坡度，屋頂比它更平緩時發出警告（⚠）——請核對製造商自己給出的最小值。在椽子、天花擱柵和過梁校核中，瓦片和石板瓦按重型屋面計，金屬板和瀝青瓦按輕型屋面計；✨ Photo 的提示詞會寫明屋面材料（"a hip roof of terracotta roof tiles"）。
- 2.694.0：Sketcher 中的**屋頂構架**。選取屋頂的 **🪵 Roof framing**（屋頂構架）：**Rafters**（椽子）——在每個坡面按間距（450 / 600 / 900）佈置普通椽子，設一根脊板，在兩個坡面共用的斜邊上設斜脊 / 斜溝椽子，在複折式 / 孟莎式屋頂改變坡度處設折線檁條，在頂梁板上設天花擱柵，並在長度超過你設定值的坡面中部設一道下檁條（0 = 從不），用撐杆向下支撐到天花擱柵——或按間距佈置 **Trusses**（桁架）（上弦、下弦、腹杆；由桁架廠家設計）。椽子和天花擱柵同樣有 ✔ / ✗ 參考校核和 **✔ Size them**（椽子按沿坡到下檁條的跨度計算，天花擱柵按其支撐點的間距計算）。除平屋頂和隨牆坡度的屋頂外，所有屋頂類型都會生成構架。用 **🪵 Show framing** 顯示，它現在也會讓屋頂變為透明；合計數量顯示在面板和構件清單中。斜脊、屋脊、下檁條和撐杆只做佈置，不確定截面尺寸。
- 2.693.0：Sketcher 中的**牆體構架**。選取房間的 **🪵 Wall framing**（牆體構架）為每面牆設定構架：**Timber**（木結構：立柱尺寸和等級，一道或兩道頂梁板）或 **Light-gauge steel**（輕鋼：C 型鋼立柱，一道頂部導軌），立柱間距（300 / 450 / 600），橫撐的排距以及名義斜拉帶支撐；**Frame this room's walls** 可將某個房間排除在外。每面牆都有底梁板（在門處斷開）、頂梁板、按間距佈置的立柱、洞口兩側各一根邊立柱、門窗頭 / 過梁上方和窗臺托梁下方的短立柱、成排的橫撐（在洞口處斷開）、每個長 1.8 m 及以上的無洞口牆段中的一道斜拉帶支撐，以及每個轉角處的一根角柱；兩個房間共用的牆只生成一次構架。房間的合計（立柱數，立柱 / 梁板 / 橫撐的米數，支撐數）顯示在面板和構件清單中。用 **🪵 Show framing** 繪製顯示。按常規做法佈置——不校核立柱尺寸（AS 1684 的立柱表：牆高、間距、風荷載），支撐也只是名義性的（以 AS 1684 / 你的工程師為準）。
- 2.692.0：Sketcher 中的**樓板體系和過梁**。選取一個房間並設定其 **🏗 Floor system**（樓板體系）：地面板（帶邊梁）、華夫格空心板（模殼 + 肋）、加勁筏板（內梁）、墩柱上的架空樓板，或架在混凝土 / 鋼 / 磚 / 木短柱上的**架空木地板**，其托梁和擱柵尺寸由你確定（標準尺寸，MGP10 / MGP12 / MGP15 松木或 F17 硬木，間距 300 / 450 / 600）。結構會在 3D 中建在房間下方並列出（數量和長度）；架空地板在托梁下淨空不足時會給出提示。每根擱柵和托梁都會用基於該等級公開強度和剛度的簡單梁計算進行**校核 ✔ / ✗**（住宅樓面 1.5 kPa、1.8 kN 集中荷載、振動限值）；**✔ Size them** 會選出能透過校核的最小標準尺寸。外牆上的門窗會有 **🪵 Lintel**（過梁）——Auto（按其寬度、屋頂荷載寬度以及金屬板或瓦屋面選出能透過的最小尺寸）或由你自選。**🪵 Show framing** 會讓牆體變為透明，以便看到過梁。這只是參考，不是認證：未抄錄任何供應商或標準的跨度表——請對照 AS 1684 或供應商的跨度表確認尺寸，樓板 / 基礎須由你的工程師設計（AS 2870；場地類別會與樓板一起記錄）。
- 2.691.0：Sketcher 中**新牆與舊牆對接**：牆的自由端碰到另一面牆時，新牆會止於這面牆，而不再生成自己的方形端頭。首尾相接（已連接，或恰好畫在那裡）時，舊牆的端部會順著轉角塑形，使兩者的外側面相交——形成一個乾淨的轉角，如同一面牆。端點落在另一面牆軸線上的牆（從一面牆橫穿房間到另一面牆，或接入房間側面）會被裁到那面牆的牆面處，即使有角度或比它更厚也是如此。**Wall thickness**（牆厚）現在會記住你上次設定的值——無論是在 Wall 或 Room 工具中，還是在選取的牆或房間上——之後畫的牆和房間都使用這個厚度；大於 2 的數字按毫米解讀（200 = 0.2 m）。之前儲存的、卡在 2 m 上限的厚度會恢復為 150 mm。
- 2.690.0：Sketcher 中**牆體首尾相連**：用 ▮ Wall 繪製時，靠近另一面牆端點或轉角的點（約 15 cm 以內，縮小檢視時為 14 px）會被吸附上去——提示顯示 **⊕ joined**（按住 Shift 可自由放置）。在那裡結束的牆會與那面牆**連接**：拖曳新牆時，舊牆的端點隨之移動，舊牆因而變長或變短；拖曳舊牆時，新牆也同樣跟隨。從端頭引出繪製的牆也會連接，連接關係隨模型一起儲存。同時拖曳兩者則會作為一個整體移動。
- 2.689.0：**Sketcher 中的 🗄 櫃子與擱架**（🛋 Furniture ▸ Category **Cupboards & shelving**）：嵌入式衣櫃、步入式衣帽間、布草櫃、食品儲藏櫃和掃帚櫃、書架和置物架。
  - 選一個範本，或按 **🗄 Design / change…** 開啟對話方塊：名稱、佈局（**straight** 一字形、**L-shape** L 形或 **U-shape walk-in** U 形步入式）、寬 / 深 / 高（L / U 形還有衣櫃的進深）、板材厚度、踢腳、櫃門（無、平開、推拉、摺疊、玻璃——以及是否在 3D 中顯示）、拉手（條形、圓鈕、邊緣摳手）、櫃體 / 櫃門 / 拉手的顏色（任意顏色或 Sketcher 的某種材質）。
  - 每一排（Back、Left、Right）都有自己的**格位**：寬度（0 表示均分剩餘寬度）、裡面放什麼（掛衣杆、雙層掛衣、擱板、抽屜 + 擱板、鞋架、開放）、擱板 / 抽屜的數量；↑ ↓ 調整順序，✕ 移除一格，＋ Add bay 新增格位，⇔ Share evenly 均分。每次修改後，正檢視和平面圖都會隨之更新。
  - **💾 Save as template** 儲存你的設計（按名稱儲存——同名則替換），可用於所有專案；你的範本在 Furniture 面板中以 ★ 標出，並列在對話方塊的 **Yours** 下；🗑 Delete template 可刪除範本。
  - 在房間內點選，它會背靠最近的牆放置、朝向室內，靠近轉角時緊貼轉角；在房間外點選則獨立擺放。選取後，其面板有 Width / Depth / Height、Doors in 3D、**✎ Design…**（Apply = 一個 ↶ 復原步驟）和 **↔ Fit the wall**（與牆等寬；步入式衣帽間還會與房間等深）。
  - 在平面圖和 📄 Plans 中：顯示每一排及其格位，掛衣杆以虛線表示，並顯示推拉軌道或門的開啟弧線。
- 2.688.0：**Sketcher：工具列始終可見、牆端頭、Ctrl+拖曳、更真實的 Photo 提示詞。**
  - Sketcher 的頂部工具列（☰ File … ✨ Photo、📄 Plans、Send）始終顯示在螢幕上：停靠時，面板不再能被捲動到工具列下面，檢視佔據剩餘的空間。
  - **點選牆的端頭**（開口牆末端的方形端蓋），即可選取整面牆。**雙擊它**進行推 / 拉：沿牆拖曳端頭使牆變長或變短（1 cm 步長，Shift：自由；Esc 結束）。端頭自身的寬度（牆垛）在牆的面板中設定：**▪ This end's width…**。轉角保留各自的構件。
  - **Ctrl+拖曳**移動普通拖曳會移動的物件，並按你拖曳的方向鎖定為**水平或垂直**（與 Shift 類似）。不拖曳的 Ctrl+點選仍是將物件新增到選擇中（或從中移除）。
  - **✨ Photo** 現在根據模型生成提示詞：寫明其中有什麼（房間、門、窗、屋頂類型、樓梯、按名稱列出的家具、人物、泳池、道路、地面）以及你使用的材質，不要求任何別的東西。模型中沒有窗戶，提示詞中就不會出現窗戶或玻璃。


- 2.687.0：Sketcher 中**更低調的草圖平面**：點選一個面仍會將其設為草圖平面（工具列的 ✎ 標籤顯示其名稱，繪圖工具在其中繪製，⊥ Look at 轉向正對它），但不再在其上繪製橙色方框和網格。用 📌 保留的平面仍會顯示淡淡的虛線輪廓。
- 2.686.0：**🎨 Change style 先繪製線稿**：當提示詞的影像風格不是編輯模型時（SDXL、Pony、Illustrious、SD 1.5、FLUX.1 …），Change style 會先把圖片轉成 ✏ 線稿，然後由風格透過線稿 ControlNet 在其基礎上生成新外觀。新圖片保留線稿的輪廓，而外觀、顏色和渲染效果都是新的。線稿會在原圖之後出現在預覽中，結果則線上稿之後。
  - ControlNet 必須與風格的模型系列相匹配：SDXL、Pony 和 Illustrious 使用 SDXL 的 ControlNet（**Settings ▸ Add-ons ▸ ControlNet** 中的 SDXL ControlNet Union ProMax 可以使用，並會被告知輸入是線稿）；SD 1.5 和 FLUX.1 需要在 ComfyUI 的 models/controlnet 中放入各自的線稿 ControlNet。
  - 若該系列沒有 ControlNet（Krea 2、FLUX.2、Qwen、Z-Image、Anima …），或無法生成線稿（缺少 ControlNet 附加元件的節點），則改為以圖生圖的方式重新生成圖片——提示欄會說明原因。
  - 編輯模型（FLUX.2 Klein edit、Qwen Image Edit …）仍自行遵循外觀指令，不使用線稿。
  - Basic Settings 的 Override（步數、CFG、檢查點、臨時 LoRA）同樣作用於線稿渲染。
- 2.685.0：**🎨 Change style 使用 Override style**：提示詞中為 SDXL、Pony 或 Illustrious 風格時，Change style 現在會用該風格自己的工作流程（圖生圖）重新生成整張圖片。因此會使用該風格自己的檢查點和 LoRA；開啟 Basic Settings ▸ Override style 時，還會使用其中的步數、CFG、檢查點和臨時 LoRA。以前這些風格執行的是固定的 SDXL 區域性重繪工作流程，會忽略以上所有設定。渲染期間，按鈕旁的提示欄會顯示 Override 對這張圖片套用了什麼（例如 "Override: steps 30, CFG 6, checkpoint …"），或某個值為何被略去（SDXL 檢查點無法在 FLUX.2 Klein 這類編輯模型中執行）。
- 2.684.0：**整齊的外觀下拉式方塊**：在影像預覽中，🎨 Change style 旁的外觀下拉式方塊現在只與其文字等寬，並與按鈕同高，因此預覽的工具列能保持在一行內。
- 2.683.0：**⇄ 恢復正常**：現在選擇另一個影像或影片風格時，之前的那個總會成為上一個設定，因此 ⇄ 可以帶你回去（以前，Basic Settings 為新風格填入數值時會把舊設定覆蓋掉，⇄ 一直呈灰色）。**— none —** 和 **— template —** 也算作設定。還沒有可返回的設定時，⇄ 顯示為暗色，按下時旁邊會提示這一點。
- 2.682.0：**在編輯主題模式下 Shift+點選可執行按鈕**：開啟 🖌 時，按住 Shift 點選按鈕即可執行其功能（Alt+點選仍然同樣有效）。普通點選仍是選取按鈕以設定其樣式。
- 2.681.0：**外觀保持選取**：在影像預覽中，外觀現在是一個下拉式方塊（📷 Photoreal、🧸 Pixar、🧊 2.5D、🌸 Anime、🖍 Cartoon），旁邊是 **🎨 Change style**。你選的外觀會保持選取（重新啟動後也是如此），每按一次 🎨 Change style 都會以該外觀重新生成目前顯示的圖片。其工具提示會說明使用的是哪個影像風格。
- 2.680.0：**⇄ 上一個設定**：位於提示詞面板的影像風格和影片風格下拉式方塊旁。更換風格後，你之前的風格成為*上一個*設定；**⇄** 將其恢復——而被替換的那個又成為上一個，因此再按 ⇄ 會來回切換。開啟 **Override style** 時，一個設定還包含該類型的 Basic Settings 數值及其臨時 LoRA，⇄ 也會將它們一併恢復。工具提示會說明 ⇄ 將恢復什麼。設定儲存在應用程式資料夾的 model_settings.tmp 中，因此重新啟動後仍然保留。
- 2.679.0：**🎨 Restyle——結果與 ⇆ Before / after**：🎨 Style 渲染完成後，成品圖片會在預覽中緊接原圖顯示——如果你在此期間關閉了預覽，它會重新開啟並顯示結果。**⇆ Before / after**（位於 🎨 Style 旁）將原圖和結果並排顯示並加上標註；再次點選即可返回。每張重新風格化的圖片都有此功能，之後從相簿開啟結果時也是如此（此瀏覽器會記住最近 200 張）。
- 2.678.0：**P-H3 Image**（PrunaAI/P-H3-Image-Comfy——PrunaAI 基於 MiniMax H3 的影像模型）：**Settings ▸ Add-ons ▸ P-H3 Image** 會下載其 LoRA（2 GB）、文字編碼器（int8）、VAE（int8）和提示詞擴寫器（w4a8）——共約 17 GB——並使用影片已有的 MiniMax H3 FL2VA transformer（僅在缺失時才下載）。它附帶兩種風格：**P-H3 Image**（文生圖，預設 2048 x 2048——最高約 8 MP；你的提示詞會以 "Aspect ratio: … Request: …" 的形式傳送給其擴寫器）和 **P-H3 Image Edit**（將要編輯的圖片放在參考圖面板的第一位，另可再放最多 7 張作為參考；結果保持其形狀，約 4 MP）。8 步，無 CFG，無負面提示詞。P-H3 Image Edit 也可作為影像編輯器 ✨ Edit 和預覽中 🎨 Style 的編輯模型。它需要帶有 P-H3 節點的 ComfyUI——在下一個正式版（0.44）發布之前，這些節點位於 ComfyUI 的 master 分支 / nightly 版本中；較舊的 ComfyUI 會被拒絕，並提示如何更新。授權條款：MiniMax H3 Community License（未獲 MiniMax 授權時，歐盟、英國、韓國和美國被排除在外；須顯示 "Powered by MiniMax H3"）。8 MP 時約需 21-31 GB 顯示記憶體；int8 / w4a8 檔案需要 NVIDIA Ampere 或更新架構的顯示卡。
- 2.677.0：**圖片下方的重新風格化進度**：🎨 Style ▾ 渲染執行時，圖片下方（預覽按鈕上方）的一條細進度列會顯示進度——排隊和載入模型時是一條移動的條紋，之後隨取樣器的步數逐漸填充（"🧸 Pixar · step 12 of 25 · 48 %"）；完成時變為綠色（結果開啟時漸隱），失敗時變為紅色。
- 2.676.0：**影像預覽中的 🎨 Style ▾**：開啟任意圖片（相簿、素材 …），按 💾 Save 旁的 **🎨 Style ▾**——選擇 **📷 Photoreal**、**🧸 Pixar**、**🧊 2.5D**、**🌸 Anime** 或 **🖍 Cartoon**。圖片會用提示詞中選擇的影像風格重新生成：編輯模型（FLUX.2 Klein、Qwen Image Edit、FLUX Kontext …）會被要求只改變外觀，保留構圖、面部、姿勢和服裝；SDXL / Illustrious / FLUX.1 風格則用該外觀的描述詞和圖片自身的提示詞對整張圖片進行細化（強度 55-72 %）。Basic Settings 中開啟 **Override style** 時，會像 Generate 一樣使用其中的步數、CFG、種子、檢查點和 LoRA。這是一個普通任務（佇列、相簿、日誌）；完成後會在預覽中緊挨原圖開啟。兩種方式都不支援的風格會給出提示。
- 2.675.0：**📌 圖釘固定不變**：面板的 📌 圖釘（其固定高度，側邊面板則為固定寬度）在佈局變化時不再被清除——包括 ⊞ Docker configs 為你開啟的面板載入尺寸、切換 🗂 工作區、套用 🗂 Layout，或在 Settings ▸ Dockers 中執行 ↺ Reset。像以前一樣點選圖釘可固定 / 取消固定；**右鍵點選它**會彈出一個小選單：*📌 Pinned at … px* 和 **↺ Reset pin**（恢復為任意尺寸），未固定時則為 *📌 Pin at this size*。
- 2.674.0：**所有功能共用一個 ComfyUI 資料夾**：Settings ▸ ComfyUI ▸ Folder 為空時，bitGen Studio 現在會在應用程式旁的 comfy\、ComfyUI\ 和 ComfyUI_windows_portable\ 中查詢 ComfyUI（有多個時取最近更新的那個），然後再到模型清單找到它的位置查詢——啟動器、每個附加元件的下載（MOSS-Image、FIBO、AI Fill …）、模型目錄和 ComfyUI 清理都使用這同一個資料夾。以前，資料夾為空時下載會進入 comfy\ComfyUI\models，而實際在用的卻是 ComfyUI\ 中的 ComfyUI。設定資料夾（或 🔎 *Use this folder*）後仍以你的設定為準。
- 2.673.0：Sketcher 中的 **🛤 Road tool**（道路工具，Ground ▸ 🛤 Road）：選擇類型——**Dirt road**（土路）、**Street**（街道）、**Road**（公路）、**One-way road**（單行道）、**Avenue**（大道，4 車道，帶綠化中央分隔帶）或 **Highway**（高速公路，6 車道，帶中央隔離墩和護欄）——然後沿路線點選；雙擊或按 Enter 結束道路。道路貼合地面（橫向找平）。在道路端點附近點選會從那裡接著畫，在道路上點選會形成 T 形路口（Shift：不吸附）。每種類型都有最大坡度（土路 20 %、街道 15 %、公路 / 單行道 12 %、大道 8 %、高速公路 6 %）；更陡的地面會標記 ⚠，面板提供 **⛏ Cut the ground**（統一坡度，按 1 : 2 邊坡對地面挖填——顯示土方 m³）或 **🚇 Tunnel / bridge**（穿過高地時用帶洞門的隧道，跨越深谷時用帶橋墩的橋梁）；*When too steep* 可直接執行其中一種。路口會自動識別：主幹道相交處設**紅綠燈**（含人行橫道和停止線），次要道路接入主幹道處設**停車標誌**，兩條街道相交處設全向停車，街道盡頭接另一條街道處設**讓行**標誌；另外還有限速、單行和路名標誌。*Traffic keeps to the* 可設為靠左（澳大利亞、英國——白色中心線）或靠右（美國——黃色）。Alt+點選道路可拖曳其節點；➤ Select 可選取道路（名稱、類型、經過的陡坡、⛏ Grade again、🗑）。平面圖和 📄 Plans 會繪出道路及其名稱。


- 2.672.0：**MOSS-Image 替代檔案**：當 ComfyUI 中沒有該風格所需的小型 FLUX.2 VAE（flux2-vae_small）但有完整版（flux2-vae），或有另一個版本的 Qwen3.5 9B 文字編碼器（w4a8 / int8 / bf16）而非所要求的那個時，渲染會使用你已有的檔案，並在日誌中說明。未勾選任何模型時，Settings ▸ Add-ons ▸ MOSS-Image 只安裝文字編碼器 + VAE——供你自己的 MOSS 模型使用（Civitai 上的微調模型：將其設為風格的 Model）。
- 2.671.0：Sketcher 中的**簷溝截面**：選取一個屋頂——**Gutters** 列出內建截面（Quad (box)、Half round、OG (ogee front)、Square line (deep)），**Gutter profile** 以圖片形式顯示它們（以及你自己的截面），**✎ Gutter profiles…** 以 *Gutter* 類型開啟截面編輯器：封簷板是其左側的那條線，x 從封簷板向外，y 從簷溝底部向上，簷溝後壁的頂端掛在屋頂邊緣正下方。繪製方法與踢腳線或簷口線相同（點選 / 拖曳節點，雙擊線段新增節點，右鍵點選 ▸ Convert to curve / line，Delete node），然後按 💾 Save——屋頂的簷溝隨即採用你的截面（專案會儲存它，包括曲線），沿每條簷口掃掠生成；落水管位於其中部下方。Roof 工具自身的選項也可以選擇簷溝截面，用於它之後生成的屋頂。
- 2.670.0：Sketcher 截面編輯器中**帶貝塞爾曲線的截面**（踢腳線、簷口線、門 / 窗框、窗臺——✎ New / edit profiles…）：每段內建的圓弧和 S 形曲線現在都是隻有兩個節點（起點和終點）的一條曲線，因此 Cove 簷口線只有三個節點。**點選**節點或線段可將其選取；**拖曳**節點（其控制柄隨之移動）或曲線的兩個**控制柄**（在選取的線段上，或在選取節點的兩側顯示）；**雙擊**線段可在該處新增節點（曲線會被拆分而形狀不變）；**右鍵點選**線段可選擇 *Convert to curve* / *Convert to line* 和 *Add a node here*，右鍵點選節點可選擇 *Delete node*（Delete 鍵也可以）。儲存的截面會保留其曲線；較舊的截面開啟時為直邊。
- 2.669.0：**徹底清理 ComfyUI——在更新前以及 bitGen Studio 結束時。**
  - **⤓ Update ComfyUI**（Settings ▸ ComfyUI）會先執行 `misc\clear-comfy.bat`：停止所有 ComfyUI 處理程序（包括你自己啟動的——其 Python 佔用著更新要替換的包），釋放 8188 埠，並清空 ComfyUI 的 `temp\`、`__pycache__` 資料夾和 ComfyUI-Manager 的快取——絕不會動你的模型、輸出、輸入、工作流程或設定。其輸出會顯示在更新日誌中。由 bitGen Studio 啟動的 ComfyUI 會在之後重新啟動。
  - **bitGen Studio 結束時**（關閉應用程式視窗、關閉其主控台視窗 / Ctrl+C，或應用程式崩潰）：會執行 `misc\clear-comfy.bat`，結束仍在從其資料夾執行的所有 bitGen Studio 處理程序（渲染 / 音樂 / LLM 工作處理程序、llama-server、ffmpeg …），並且 `start.bat` 開啟的終端機視窗會自動關閉。
  - Settings ▸ ComfyUI ▸ **Clear ComfyUI completely when bitGen Studio exits**（bitGen Studio 結束時徹底清理 ComfyUI，預設開啟）——它優先於 *Leave ComfyUI running*；將其關閉即可像以前一樣讓 ComfyUI 在各次會話之間保持執行。
  - 為此 `misc\clear-comfy.bat` 新增了 `/nopause`（結束時不顯示 "press any key"）；手動執行時與以前相同。
- 2.668.0：Sketcher 中的**屋簷、封簷板和簷溝**：Roof 面板（工具的和選取屋頂的）以四張圖片顯示屋簷形式——**Simple**（僅挑簷）、**Open**（挑簷下露出椽尾，間距 600 mm）、**Boxed**（從封簷板到牆面的平吊頂）和 **Closed**（椽子下方順屋面坡度的襯板）。**Fascia + barge boards** 在簷口設封簷板，在山牆的山牆邊上設博風板（*Fascia height*）；**Gutters** 可選 None / Quad (box) / Half round，掛在封簷板上，並在每段簷溝末端附近設 **Downpipes**（落水管）沿牆而下。選取的屋頂還有 *Fascia / soffit colour* 和 *Gutter colour*。Roof 工具新增的屋頂預設為 Boxed，帶封簷板和 Quad 簷溝；之前建立的屋頂保持不變。它們也會顯示在建築圖紙的立面圖上。
  **MOSS-Image：** 它需要 ComfyUI **0.42.2 或更新版本**——ComfyUI 0.41.x 和 0.42.1 能識別該模型，但渲染出來全是雜訊。現在，在版本過舊的 ComfyUI 上，MOSS-Image 圖片會在排隊前就被拒絕，並說明如何更新（Settings ▸ ComfyUI ▸ ⤓ Update ComfyUI）；該附加元件的安裝過程也會提示這一點。MOSS-Image (SFT) 風格不再新增跳層引導（skip-layer guidance）（ComfyUI 內建的範本中該項為關閉；MOSS-Image Base 保留該項）。
- 2.667.0：**Sketcher 的物件面板**（其工具列上的 🗂 Outline）新增：
  - **Shapes**（形狀）——繪圖工具生成的每個形狀：*Solid n*（封閉）、*Shape n*（平面或開放）、*Lines n*（散線），以及以各自名稱列出的每個組。點選一行即可選取該形狀，然後在檢視中拖曳它的某個面進行推 / 拉。拖曳組的面也會對其推 / 拉；點選仍是選取整個組。
  - **Construction**（輔助）——其中包含 **Planes** 和 **Construction lines**。
    - *Planes*：用 ➤ Select 點選一個面將其設為草圖平面，然後用 📌（在工具列中它的標籤上，或在它的行上）將其保留。標題上的 ＋ 可建立一個經過原點的地面 / 正面 / 側面平面。點選平面所在的行可再次在其中繪製；⊥ 可正對它檢視。
    - *Construction lines*：使用 📏 Tape measure，在第二次點選時按住 **Ctrl**——生成一條穿過兩點的虛線，繪圖工具會吸附到它上面（*On Guide*，以及兩條線的交點）。
    - 👁 隱藏平面或輔助線，🗑 將其刪除。
  - **重新命名任何物件**——雙擊某行的名稱（或在選取的行上按 F2），輸入後按 Enter（按 Esc 則保持原名）：房間、房間組、牆、地板、天花板、踢腳線、簷口線、門、窗、屋頂、樓梯、燈、家具、攝影機、形狀、組、平面和輔助線。重新命名為一個復原步驟；屬性面板的標題會使用新名稱。
- 2.666.0：Sketcher 中的 **△ Roof types**（屋頂類型）：Roof 工具的面板（以及選取屋頂的面板）以圖片顯示每種類型——**Gable**（雙坡）、**Hip**（四坡）、**Skillion**（單坡 / 披屋）、**Dutch gable**（荷蘭式山牆：四坡頂，每端頂部有一個小山牆——gablet）、**Clipped gable**（截角山牆 / jerkinhead：頂部向後做成坡面的山牆）、**Gambrel**（複折式 / 穀倉式：下陡上緩）、**Mansard**（孟莎式：四面陡坡，頂部為平緩的四坡或平頂）、**Saltbox**（鹽盒式：屋脊偏離中心）、**Pyramid**（攢尖）、**Butterfly**（蝶形：兩坡向下匯成天溝）、**Flat**（平屋頂）和 **Follows the walls' slope**（隨牆坡度）。點選圖片即可更改屋頂類型。每種類型有各自的設定：Pitch（gambrel / mansard：Upper 和 Lower pitch）、荷蘭式山牆的 *hip part of the rise*（四坡部分佔屋頂升高的比例）、截角山牆的 *clipped part*（截角部分）、gambrel / mansard 的 *break*（折點）、鹽盒式的 *ridge from the front*（屋脊距正面的位置），以及 *Flip*（skillion / saltbox：將高側換到另一側）。Ridge（順向 / 橫向）、Overhang、Thickness 和 Colour 適用於所有類型。每種類型都會顯示在建築圖紙的立面圖和屋頂平面圖上。
- 2.665.0：Sketcher 中的 **📄 Building plans**（建築圖紙）：其工具列上的 **📄 Plans**（位於 ✨ Photo 之後）會開啟 *Building plans* 對話方塊——拖曳其標題列即可移動。可選擇：
  - **Sheet**（圖紙）A4 / A3 / A2 / A1，橫向或縱向，以及**比例**——*Auto (fits)*（能容納各檢視的最大標準比例）或 1:20 - 1:500。
  - **Pages**（頁面）——*All views on one sheet*（所有檢視共用一個比例，例如全部放在一張 A1 上）或 *One view per page*（在 Auto 下每頁各用自己的比例）。
  - **Views**（檢視）——每層的平面圖、四個立面圖（北、東、南、西——平面圖上北向朝上）以及屋頂 / 總平面圖（屋頂、泳池、車道、地面等高線）。
  - **Show**（顯示）——尺寸 + 標高（每個外牆面、沿牆的門 / 窗、總尺寸，單位 mm；立面圖上的 FFL 標記和高度）、房間名稱 / 尺寸 / 面積、家具、著色（使用材質的顏色）。
  - **Title block**（圖框標題列）——專案、圖名、繪圖人、日期、修訂版本和備註；還帶有指北針、比例尺和 *Sheet n of m*。預覽會顯示每一頁（◀ ▶）。**💾 Save PDF**（Ctrl+Enter）將其寫入專案的 pdf 資料夾（影像編輯器的 File ▸ Open PDF from Project 會列出它），勾選 *Download too* 時還會儲存到你的下載資料夾。對話方塊會記住你的選擇。
- 2.664.0：Sketcher 中的 **🧍 Mannequin model**（人體模型）：Furniture (🛋) ▸ Category *People* ▸ **mannequin (model)**，然後點選它站立的位置——一個建模的女性人體模型，身高與人物的 Height 相同。其面板中的 Pose 可在它和擺好姿勢的 House-builder 人物之間切換。該模型由 CGTrader 上的 dimasalcalde 和 zahers 製作（Settings ▸ About ▸ 3D models）。其檔案（ext/pushpulldock/assets/mannequin-female.json）單獨打包在一個 zip 中，不在公開儲存庫裡；沒有該檔案時會改為繪製站立人物。


- 2.663.0：Sketcher 中的**拆分牆體、草圖平面和 ⊥ Look at**。
  - **雙擊一面牆**（使用 ➤ Select——從上方看、在 📐 floorplan（平面圖）上，或在 3D 中牆頂以下的牆面上）即可在該處將其拆分；再次雙擊可繼續拆分。拆分後每一段都是一面獨立的牆：點選它，按 **Delete** 只刪除這一段；沿垂直於牆線的方向**拖曳它**即可移動——當兩側相鄰的牆呈直線延續時，每側會各生成一面新牆，把移動後的牆段與房間連接起來（形成凸出或凹進）。在 3D 中雙擊牆頂仍然是切割牆頂（形成斜坡）。
  - **Wall tool**（牆體工具）可在房間牆體的任意位置吸附（*On Wall*）：新牆的起點和終點都可以落在牆上，或落在拆分點上。
  - 點選房間的**牆角**或牆的**端頭**（Select）：其面板可設定 **Width**（寬度；比牆寬 = 壁柱），端頭還可設定 **Length past the end**（超出端部的長度）；Delete 會把它恢復為普通牆體。從它上面拖曳仍會繪製一面新牆。
  - **Sketch plane**（草圖平面）：用 Select 點選的面（牆面、地板、模型的某個面）會成為草圖平面——工具列上的標籤會顯示它的名稱（2.687.0：不再在該面上疊加繪製任何內容）。之後 Line、Rectangle、Circle 和 Polygon 都會在該平面內繪製。點選標籤上的 ✕、按 Esc 或點選空白處即可結束。工具列上的 **⊥ Look at** 會讓檢視正對該平面。
- 2.662.0：Sketcher 中的**方形牆端**，以及**從牆角和牆端拖出新牆**。
  - 現在每面牆都是從牆角到牆角的矩形——單獨選取、隱藏或升高時，牆端是方形的，而不是尖角。牆角是用於填補空隙的獨立構件，獨立牆的兩端各有一個方形端頭。
  - 使用 ➤ Select 時，將指標指向房間的外牆角或牆的端頭——它會醒目顯示。**從它的某個側面拖出**，就會沿該方向生成一面新牆（從端面拖出：沿原牆方向延伸；從側面拖出：與原牆垂直）。從它的**頂面**拖出（從上方看），新牆可以朝任意方向。新牆沿用原牆的高度、厚度和牆體類型，它自己的兩端也可以用同樣的方法繼續拖出更多牆。Ctrl+Z 可復原。
- 2.661.0：Sketcher 中的 **🧱 Wall types**（牆體類型）面板（按鈕位於工具列中）。
  - 它列出模型中的牆體類型——初始包括 Brick veneer（磚貼面）、Double brick（雙層磚）、Timber frame (weatherboard / fibre cement)（木框架，護牆板 / 纖維水泥板）、Rendered block（抹灰砌塊）、Interior stud（內牆龍骨）、Interior steel stud（內牆輕鋼龍骨）和 Wet-area stud（溼區龍骨）——並顯示每種類型的厚度以及使用它的牆的數量。
  - 選取一種類型，即可看到按比例繪製的剖面，以及**從外到內的各層**：磚、空氣層 / 空腔、防水透氣膜 / 防潮層、木框架或鋼框架（勾選 *batts* 可在龍骨之間填充保溫棉）、保溫板、石膏板（gyprock）、抹灰、護牆板、纖維水泥板、砌塊、混凝土、石材、瓷磚……可以修改每一層的種類或厚度（mm），用 ↑ ↓ 調整順序，用 ✕ 刪除，用 *＋ Add a layer* 新增一層。**Wall thickness**（牆厚）為各層厚度之和。
  - **Use it for**（套用於）：選取的牆、選取房間的所有牆、所有外牆、所有內牆（✕ None = 恢復為房間自身的牆厚）。頂部的 ＋ / ⧉ / ✕ 用於新增、複製和刪除類型。
  - 牆體按其類型的厚度、以中心線為基準向兩側構建，修改類型時會隨之更新；最外層（磚、抹灰、外掛板……）決定牆外側面的顏色，各層之間的接縫會顯示在牆頂和 📐 floorplan 上。牆自身的面板中也有 **Wall type**。
- 2.660.0：Sketcher 中的**從房間中刪除單面牆**以及**內牆 / 外牆**。
  - 在牆上使用 **⌫ Eraser**（或選取牆後按 **Delete**，或在其面板中點選 **🗑 Take this wall out**）只會刪除這一面牆——地板和天花板保留，該側變為敞開。牆上的門 / 窗會一併刪除。兩個房間共用的牆會從兩個房間中同時刪除，於是兩個房間相互連通（地板相接）。**Shift+Eraser** 仍會擦除整個房間。
  - 房間的面板：**↺ Put back** 可恢復其牆體（↶ 也可以）。
  - 牆的面板：**Interior / exterior**——*Auto*（兩側都有房間 = 內牆，否則為外牆）、*Interior* 或 *Exterior*；面板標題會顯示目前屬於哪一種。內牆的外側面採用其內側顏色（若單獨設定了 *Outside* 顏色，則仍以該顏色為準）；📐 floorplan 中內牆的填充色比外牆淺。
- 2.659.0：Sketcher 中的 **🛣 Driveway**（車道；位於 *Ground* 下，無快捷鍵）。
  - 沿路線依次點選各點——車道會平滑地穿過這些點——雙擊（或按 Enter）結束。
  - 曲線會顯示其節點（□）和控制柄（○）：拖曳**控制柄**可彎曲曲線（另一側的控制柄隨之轉動；按住 **Alt** = 只調整這一側），拖曳**節點**可移動它，**Delete** 刪除所點選的節點。點選另一條車道可編輯其曲線；可在輸入框中輸入寬度。
  - 車道貼合在 ⛰ 地面上（高出地面 4 cm）或位於某一標高，預設寬 3 m，可選配**路緣石**。
  - 用 ➤ Select 選取車道可開啟其面板：寬度、路面材質（混凝土、石材……或圖片）、路緣石、貼合地面 / 位於其標高、〰 Smooth the curve（平滑曲線）、Delete。📐 floorplan 會繪製車道及其中心線。
- 2.658.0：**Sketcher、Timeline 和 Image editor 的 ⛶ 最大化**效果取決於面板所在的位置。
  - **停靠**（位於主欄中）：⛶ 使其高度與主欄相同；下方的面板保持各自的高度並被向下推（捲動主欄即可看到），主欄會捲動到該面板的頂部。🗗 / Esc 可恢復原狀。
  - **浮動**（位於主欄之外）：⛶ 填滿標題列和狀態列之間的整個視窗，並關閉其他面板；🗗 / Esc（Sketcher 中為 ⇲ Dock）將佈局恢復原樣。
  - **停靠狀態的 Sketcher** 現在有自己的高度和底部拖曳柄（拖曳可調高 / 調矮），並像其他面板一樣有 📌 圖釘；高度會被記住。
- 2.657.0：Sketcher 中的 **🏊 Pool**（泳池）——位於 *Ground* 下、⛰ Terrain 旁邊（無快捷鍵——所有字母都已被佔用）。
  - 點選一個角，再點選對角（或輸入 `8,4` 並按 Enter）——生成矩形泳池；**Shape: Free shape** = 依次點選各個角，最後回到第一個點（或雙擊 / Enter）。其面板包括：**Shallow end** / **Deep end**（淺水端 / 深水端；池底沿長度方向在兩者之間傾斜）、**Edge**（池邊）：池邊磚（壓頂）、木平臺、池邊磚 + 木平臺或無，以及它們的寬度、水面邊緣的標高（取泳池中心處的地面高度，或手動輸入），以及 **Level the ground round it**（平整周圍地面）。
  - 在 ⛰ 地面上時，泳池下方的地面會被挖除，周圍的地面會被整平（生成一個名為 "Pool 1 surround" 的挖 / 填方平臺）。
  - 用 ➤ Select 選取泳池可開啟其面板：Length / Width、標高、深度、⇄ 互換深水端、池邊及其材質（瓷磚、木材……或圖片）、池壁內襯、池水及其顏色、水量（m³）；可拖曳，也可 Delete。
  - 📐 floorplan 會繪製水面、池邊，以及泳池的名稱、尺寸和深度。
- 2.656.0：Sketcher 的 ⛰ Terrain 中的 **✂ Cut / fill**（挖方 / 填方）——在地面上挖出 / 填築一個水平平臺。
  - ⛰ Terrain ▸ **✂ Cut / fill**：在地面上依次點選平臺的各個角，最後回到第一個點（或雙擊 / Enter）。平臺內部的地面被整平到平臺的 **level**（標高）——預設取平臺範圍內地面的平均高度（挖填平衡），也可以取消勾選 *Level = the ground's mean inside* 並手動輸入。平臺外部以 **batters**（邊坡）按 **1 : n** 的坡度回接到原始地面（每升高 / 降低 1 米對應的水平距離米數）。**Earthworks**（土方方式）：挖方和填方、僅挖方或僅填方。
  - 狀態列和面板會顯示**挖方**和**填方**量（m³），以及需要運出 / 運入的淨土方量。
  - 點選平臺可選取它：修改其標高、邊坡或土方方式（會重新挖填）；雕刻地形之後可用 **⟳ Apply again** 重新套用；**🗑 Forget** / Delete 刪除其輪廓（地面保持現有形狀）。可在輸入框中輸入標高。
  - 📐 floorplan 會顯示每個平臺的虛線輪廓、名稱、標高和挖 / 填方量。
- 2.655.0：**🩹 自動開始**——**Ctrl+click** 🩹 按鈕：修復會被設定好並且直接開始（稍後會自動為你按下 ✏ Edit）；**Shift+click**（或 Ctrl+Shift+click）：同時為黑白照片**上色**的修復，以同樣的方式開始。普通點選仍然只進行設定。如果沒有可用的照片（References 面板為空且影像編輯器已關閉），則不會開始，並會提示你該怎麼做。
- 2.654.0：**🩹 Restore / fix a photo**（修復照片）——提示詞面板左欄中的一個按鈕（位於 🎤 下方）。
  - 點選一次：Generate 模式切換為 **🖼 Image**，▾ 操作切換為 **✏ Edit**，並將修復指令放在提示詞開頭——去除劃痕、灰塵、斑點、汙漬、摺痕和撕裂，減少雜訊和顆粒，修正褪色的顏色和對比度，銳化模糊的細節，同時保持人物、面部、服裝、姿勢和構圖不變。你在其後輸入的文字會被追加進去（"her dress was dark green"）。再次點選不會重複新增。
  - **Shift+click**：效果相同，並為照片上色（適用於黑白照片）——自 2.655.0 起也會自動開始。
  - 照片來源：影像編輯器關閉時，將照片放入 **🖼 References** 面板（一張圖片——多張圖片會被一起使用）；編輯器開啟時，使用**選取的圖層**（或該圖層上的選取範圍）。按鈕旁的提示會說明將使用哪一張。然後按 **✏ Edit**——結果會出現在相簿中（在編輯器中：⏳ Pending）。
  - 編輯模型為提示詞面板的影像風格——當編輯器顯示在螢幕上時，會自動為你選擇一個支援編輯的風格（Qwen Image Edit、FLUX.2 / FLUX 3 Klein）。


- 2.653.0：**Sketcher 中的 ⛰ Terrain**（地形）——建築所在的地面，可帶有山丘、斜坡和等高線。
  - **⛰ Terrain** 位於 Sketcher 工具中的 *Ground* 下（**Alt+G**——G 已用於 Group）。在沒有地面的模型上第一次點選時會生成地面：40 m 見方或超出建築 10 m，每 0.5 m 一個高度點，略低於最低樓層，材質為草地。
  - 面板用於選擇按下滑鼠時的操作：**⬆ Raise** / **⬇ Lower**（按住並拖曳；按住 **Shift** 則反向）、**≈ Smooth**、**▬ Flatten**（向 Flatten 高度壓平——**Alt+click** 地面可取該處的高度）。**Brush size** 和 **Strength**；**[ / ]** 縮小 / 放大筆刷，也可直接輸入尺寸。每一筆為一個 ↶ 復原步驟。
  - **〰 Contour**：設定 **Elevation**（高程），然後逐次點選……繪製一條等高線（按其高程繪製）；點選回到起點可閉合，或雙擊 / Enter 結束一條開放的線。開啟 **Shape the ground after each line**（預設開啟）時，地面會隨每條繪製的線而變化：每條線上的點保持在其高程，點與點之間為平滑的斜坡；下一條線的高程會增加 **Next line +** 的值。點選已繪製的線可選取它——修改其高程、將其開放 / 閉合，**Delete** 刪除它。**⛰ Shape to the contours** 可隨時按等高線塑造地面；**Clear the lines** 清除線條但保留地形。提示：在 📐 floorplan 中，這些線會垂直向下投到平面上繪製。
  - **🖼 Heightmap picture…**：一張灰度圖——黑色 = **Lowest**，白色 = **Highest**，圖片頂部為北（+Y）邊。
  - **⌂ Level under the rooms**：將每個房間下方的地面整平到略低於其地板，並在 **Level margin** 範圍內平滑過渡回原地形。另有 **⊙ Centre on the building**、**Width / Length / Detail**（保持地形形狀）、**Material**（顏色、材質或圖片）、**Contour interval** 以及每隔 n 條加深一條的線、**Contour lines on the ground**、**Earth sides**、**▬ Flatten all**、**🗑 Remove the ground**。
  - 地面隨模型一起儲存，並隨模型一起傳送到 .glb / Blender / Unreal / 影像編輯器，也會出現在真實照片中；📐 floorplan 會在最低樓層上繪製其等高線（加深的線帶有標註）。
- 2.652.0：**真實照片使用你的材質**——Sketcher 工具列中的 **✨ Photo**（或在已關聯 Sketcher 時使用提示詞面板的 ✏ Edit）會向編輯模型傳送乾淨的渲染圖（其中包含你的背景圖 / 天空）、其深度圖以及一張**材質板**：模型使用的每張圖片各佔一個帶標籤的小塊（"Kitchen floor, Bed wall 1 outside"、"outside walls"、"Background (backdrop)"）——這些文字告訴模型在對應位置準確使用這些材質，並保留背景。提示詞框中的文字會被追加。只接受兩張圖片的編輯模型會收到不含材質板的版本（訊息中會說明——Qwen Image Edit 2511 / FLUX.2 Klein 可接受三張）。照片會儲存到專案的圖片中（如果影像編輯器已開啟，也會送到編輯器）。
- 2.651.0：**Sketcher 的材質工具**——建築的每個部分都可以有自己的材質，圖片可用作紋理，也可把一張圖片用作背景。
  - **牆的內側和外側**：牆的面板有 **Inside** 和 **Outside**；窗有 **Frame** 和 **Glass**；地板、天花板、踢腳線、頂角線、屋頂、樓梯和無牆地板也各有自己的設定。每一項都會開啟**材質選擇器**：顏色、內建材質（磚、石材、木地板、瓷磚、大理石、地毯……）或**圖片**。
  - **圖片作為紋理**：可來自 🖼 Refs 面板中的圖片、專案圖片或檔案。圖片會儲存在專案中，每隔 **Size** 米重複一次（用 **Turn °** 旋轉）。同樣的圖片也可以用來給你繪製的面上色。
  - **油漆桶**（B；Materials 按鈕會開啟同一個選擇器）現在只給**一面牆的一側**上色——即你點選的內側或外側；**Shift+click** 給該側的所有牆上色（一個房間的所有內側 / 所有外側）。玻璃單獨上色。
  - **🖼 Background**（工具列）：**Backdrop**——模型後方的一張圖片，填滿檢視且不拉伸——或 **360° sky**——環繞場景的全景圖片（可旋轉）；None = 使用主題的背景。
- 2.650.0：**Sketcher 會醒目顯示選取的物件和指標下的物件**——選取的物件（牆、房間、門、家具……，或用 Ctrl+click 選取的多個物件）以主題的強調色著色，指標下的物件以藍色著色——已被選取的除外。📐 floorplan 上也一樣：選取的符號以強調色填充，停留的符號為藍色。
- 2.649.0：**Sketcher 的 📐 floorplan 沿用應用程式的主題顏色**——背景使用主題的背景色（不再是白紙），牆、門、樓梯和標籤以主題的文字顏色繪製，地板使用其面板顏色（並帶一點各房間地板顏色的色調），玻璃和燈具使用強調色，網格使用其線條顏色。更換主題會重新繪製平面圖。
- 2.648.0：**用 Shift + 右鍵拖曳縮放、⊡ Zoom to selection 以及指標**——適用於 Sketcher、時間軸畫布和影像編輯器。**Sketcher 的 Esc 和 Ctrl+click。**
  - **Shift + 右鍵拖曳**：向前（向上）放大，向後（向下）縮小，以按下的位置為中心。在 Sketcher 中，普通的右鍵拖曳仍為平移；不拖曳的右鍵點選仍會開啟選單。在 🎨 Artist mode 中，該拖曳用於縮放，而 Shift+右鍵**點選**（不拖曳）仍會離開該模式。
  - **⊡ Zoom to selection**（縮放到所選內容）：Sketcher（在 ⤢ 旁邊——縮放到選取的內容：面、房間、牆、門、構件、攝影機……或多個物件）、時間軸（在 ⤢ 旁邊——選取的圖層）和影像編輯器（工具列中 🔍 下方、View ▸ Zoom to Selection、Ctrl+Alt+0——縮放到選取範圍，若無選取範圍則縮放到選取圖層的像素）。
  - **指標**：Sketcher 的 Select 工具以及時間軸和影像編輯器的 Move 工具都顯示為指標箭頭。
  - **Sketcher 中的 Esc**：在 🔄 Orbit 中，Esc 切換到 ➤ Select；其他情況下，它會放下目前工具並取消選擇，然後切換到 Orbit。它不再將最大化的 Sketcher 停靠回去（請使用 ⇲ Dock / ⛶）。
  - **Sketcher 中的選擇**：點選選取一個物件；**Ctrl+click** 新增更多——面和線，以及建築構件（房間、牆、門、家具、燈具、攝影機……；Ctrl+click 已選取的構件可將其移出選擇）。拖曳其中一個，所有選取的物件會一起移動（一次復原），Delete 將它們全部刪除，⊡ 縮放到它們；點選其中一個則只保留該物件。
- 2.647.0：**Sketcher 的 📐 Floorplan 檢視、Esc = Orbit、房間的 Width 和 Length。**
  - **📐 Plan**（工具列，或 View ▾ 📐 Floorplan）：檢視垂直向下俯視，如同圖紙，每次顯示一個樓層（樓層多於一層時可在清單中選擇）。牆體被剖切並以實心繪製；門顯示門扇和開啟方式（單開、雙開、推拉；洞口為虛線），窗顯示玻璃和窗臺，樓梯顯示每一級踏步以及行走線和 UP，家具顯示輪廓和名稱，燈具顯示為圓圈加十字，每個房間顯示名稱、Width × Length 和面積。建築工具的用法與 3D 中相同——在平面圖上繪製的房間、牆、門……都以這些符號表示——點選可選取門、燈具、構件、樓梯、牆或房間。Orbit 可旋轉平面圖（保持平面）。再次點選 📐、切換到其他檢視或攝影機檢視：3D 檢視恢復原樣。
  - **Esc**：按一次即放下目前工具和選取的內容，並切換到 **🔄 Orbit**——在 3D 檢視、平面圖和攝影機檢視中均如此（正在繪製的牆會保留）。當沒有可放下的內容時，它會將最大化的面板恢復原位。
  - 每個房間的 **Width 和 Length**：房間面板中有這兩項（沿第一面牆的方向及與其垂直的方向）；矩形房間保持其角點不動，其他形狀則被拉伸（門窗沿牆保持原位）。Room 工具也有 Width 和 Length：兩者都設定後，點選一次即可放置該尺寸的房間；0 = 像以前一樣透過兩個角點繪製。
- 2.646.0：**🎨 Artist mode：Alt+P 調色盤、Ctrl+P 提示詞面板、Alt+G 圖層 + Pending**——無需離開 Artist mode 即可基於正在繪製的圖層進行生成。
  - **Alt+P**——在指標處開啟調色盤（以前是 Ctrl+P）。再按 Alt+P 關閉。
  - **Ctrl+P**——在全螢幕畫布上方開啟提示詞面板，其提示詞框可直接輸入（與應用程式中其他地方的按鍵相同）。
  - **Alt+G**——在畫布上方，右側顯示 Layers 面板，旁邊顯示 ⏳ Pending（畫布保持原尺寸，其他面板仍然隱藏）。選取圖層，按 Ctrl+P，寫下提示詞，點選 ▾ Edit（或 Generate）：圖片會返回到 ⏳ Pending——可從那裡將其保留為圖層。再按 Alt+G 隱藏它們。
  - 離開 Artist mode 時，編輯器的面板欄會恢復原樣（以前較窄的編輯器會丟失面板欄）。
- 2.645.0：**Ctrl+P 將提示詞面板調到最前**——在任何地方（包括正在輸入框中輸入時）：它會開啟、展開，從關閉的 ▣ 面板中出來，並顯示在浮動視窗或最大化的面板（Sketcher、時間軸……）之上，提示詞框可直接輸入。（2.646.0：在 🎨 Artist mode 中也適用——其調色盤改為 Alt+P。）影像編輯器的 **File ▸ Print** 改為 **Ctrl+Shift+P**。


- 2.644.0：**各指南改稱 Sketcher**——README、本指南、Feature Reference、測試版頁面、說明和快捷鍵清單不再介紹 House builder（Sketcher 已在 2.630.0 中取代它）；Sketcher 一節從它現在的功能講起；新增一張 Sketcher 截圖。
- 2.643.0：**Sketcher：透過攝影機觀察時移動 / 旋轉攝影機**——攝影機面板中的 ✥ Move / ⟳ Rotate 會在檢視前方顯示其操控器；Esc 取消選擇。
- 2.642.0：**Credits**（致謝）——Settings ▸ **About** 顯示版本號、"Produced and Developed by Tim Paul"、"Programmer - Claude Opus 5.5"，以及對 bitGen Studio 所用程式碼、模型、工具和創意的所有貢獻者的致謝；同樣的致謝也是本指南的最後一節（並出現在封面上）。
- 2.641.0：**Sketcher：攝影機像物體一樣被選取、移動和旋轉**——選取的攝影機周圍不再有方框；它會顯示 X / Y / Z 移動箭頭（拖曳攝影機或箭頭），雙擊會切換為旋轉環，點選其他物件則改為選取該物件。
- 2.640.0：**Sketcher：每個部分各自的屬性，以及截面輪廓**——點選牆 / 地板 / 天花板 / 踢腳線 / 頂角線（在檢視或大綱中）會顯示其自己的面板（牆的長度、高度和內側顏色）；踢腳線、頂角線、門框、窗框和窗臺可從圖片下拉式清單中選擇截面輪廓，✎ Profiles… 可繪製自訂輪廓。
- 2.639.2：**Sketcher：3D 檢視不會再無提示地變黑**——模型中的錯誤數值（某個角點、燈具、構件）不再導致整個檢視變黑：該構件會被略過，攝影機會被複位，檢視底部會出現紅色提示說明問題所在（渲染錯誤或圖形上下文丟失時也會提示）。
- 2.639.1：**Sketcher 修復**——停靠在較窄的欄中時，新的大綱會佔用 3D 檢視的寬度（導致檢視顯示為黑色）；現在在這種情況下大綱預設關閉，🗂 使其浮動在檢視上方，並且檢視寬度不會小於 160 px。
- 2.639.0：**Sketcher：🗂 Outline 面板**（大綱；房間 ▸ 牆、地板、天花板、踢腳線、頂角線、門、窗；👁 隱藏 / 顯示；房間組）、踢腳線 + 頂角線、Alt+drag 自由拖曳牆、Shift+click = 整個房間。
- 2.638.0：**📐 SolidCraft 最大化 = 整個視窗**——⛶ 填滿 bitGen 視窗中標題列和狀態列之間的區域，並關閉所有其他面板；🗗（或 Esc）將佈局完全恢復原樣（哪些面板是開啟的、哪些是摺疊的，以及它們的尺寸）。
- 2.637.0：**Shift+right-click 離開 🎨 Artist mode**——在螢幕任意位置均可，且不彈出右鍵選單（在 Windows 上 Ctrl+Esc 會開啟開始選單；Ctrl+Esc 和 Ctrl+Shift+F 仍然有效）。
- 2.636.0：**Ctrl+Alt+S 開啟設定；bitGen Default 主題**——Ctrl+Alt+Shift+T（或 Settings ▸ Themes 中的 ⟲ bitGen Default，或在位址中加上 `?theme=default`）恢復 bitGen 自己的外觀——Dark、其強調色、無元素樣式、UI 尺寸 100 %；↶ The theme before 可復原此操作。內建的 bitGen Default 不能被覆蓋或刪除。
- 2.635.0：**Assets：Project | Global | All**——專案素材位於 `projects/<name>/Assets`，全域素材位於 `projects/Assets`，一個資料夾 = 一個分組；上傳的檔案進入 Assets；右鍵點選可選擇 🌐 Move to Global / 📁 Move to Project。
- 2.634.0：**彩色的安裝過程**——完成為綠色，正在安裝為淺綠色，警告為橙色，錯誤為紅色；長時間無輸出的步驟會提示仍在執行（以及為何耗時較長），因此安裝過程不會看起來像卡住了——適用於安裝視窗和安裝指令碼。
- 2.633.0：**Sketcher：攝影機和家具的旋轉環（偏航 / 俯仰 / 翻滾）、翻滾、鏡頭預設、焦距 / 視野**。
- 2.632.0：**Sketcher：可在房間內選取攝影機，並移動、旋轉（R）；Esc / 雙擊取消全部選擇；Orbit 游標**。
- 2.631.0：**Sketcher：攝影機檢視、開啟的門 / 窗、自動屋頂 + 地板**——View ▾ 列出所有攝影機（從攝影機看到的檢視）；門 / 窗的 Open % + 開啟方向；Room 工具的 Auto roof / Auto floor。
- 2.630.0：**House builder 已移除**——其剩餘部分已併入 Sketcher（🧍 人物、☰ File ▸ 🏠 將其儲存的房屋作為 Sketcher 模型）；SolidCraft 改為傳送到 Sketcher。
- 2.629.0：**Sketcher：材質、攝影機、360° 場景位置、Furnish**——House builder 的帶紋理材質、📷 攝影機（透過攝影機觀察，鏡頭畫面 + 深度圖 + 法線貼圖，360° Location）、🪄 Furnish（為房間佈置家具）；家具可匯出。
- 2.628.0：**Sketcher：🛋 Furniture**——在 Sketcher 中放置 House builder 的家具庫和專案中的 3D 模型；⛶ 最大化時關閉所有其他面板（⇲ Dock 會重新開啟它們）。
- 2.627.0：**Sketcher 的真實照片**——乾淨的渲染圖 + 其深度圖會發送給編輯模型，提示詞以 "Turn this 3D render into a photorealistic photograph of a building ..." 開頭（以前返回的是著色草圖）。
- 2.626.0：**PushPull 改為 Sketcher**——配合提示詞面板：🖼 Image + 一個編輯模型，"create a real photo of the model in view"，Generate = 在 Image 素材中生成一張真實照片；→ Image editor / → Timeline 傳送一個 📏 Sketcher 圖層。
- 2.625.0：**Sketcher：編輯面、邊和角點**——面的 Extrude（+ / - 為切除）和 Twist，像 Blender 一樣拖曳，Ctrl+drag 扭轉；移動邊、Length、Extrude edge、Fillet、Shift+click 多選、Ctrl+click 選擇面的邊環；移動角點；透過控制點調整門窗的大小 / 位置，窗的 Elevation；⛶ 保留狀態列。
- 2.624.0：**Sketcher：地板上的牆、傾斜的牆**——bitGen 的主題顏色；Offset from floor edge；拖曳單面牆，地板的吸附區域，吸附到其邊緣；雙擊牆頂 = 一個可上下拖曳的切口、頂邊的坡度、Delete；Ceiling Flat / Follows the walls' slope；隨牆傾斜的屋頂，帶 Eaves width；雙擊空白處 = Orbit；標題列中的 ⛶ / ⇲ Dock 和 ✕。
- 2.623.0：**Edit theme 模式：每個按鈕及其文字**——雙擊任意文字即可修改，包括下拉選項、佔位符和工具提示、浮動工具面板；Alt+click 可在不離開該模式的情況下使用套用。
- 2.622.0：**自動找到 ComfyUI**——設定中尚未指定的已安裝 ComfyUI 會被自動找到，其檢查點（checkpoint）和擴散模型會出現在 Model manager 和 Basic Settings 的模型清單中（影片 Model 清單之前一直為空——讀取清單的方式有誤；已修復）。Settings ▸ ComfyUI ▸ Folder 提供 Use this folder。
- 2.621.0：**SFX 面板中的 🗣 Speech & dialog**——輸入、貼上或由 LLM 撰寫的文字，由 OmniVoice 或 Ming-3.0 TTS 帶情感朗讀，可使用同一個聲音，也可每位說話人各用一個聲音，儲存為 .wav / .mp3 存入 Audio 素材，檔案後設資料中包含日期、時間、描述和文字。
- 2.620.0：**📏 Sketcher 的建造功能**——帶牆、地板和天花板的房間，可相互吸附，拖曳時可共用一面牆；門窗可穿過任意牆；屋頂（雙坡、四坡、單坡、平屋頂）、樓梯、樓板，以及燈具（筒燈、吸頂燈、吊燈、枝形吊燈、射燈、壁燈、落地燈和檯燈），帶 🌙 夜景檢視；面板可最大化到整個視窗，有自己的 ☰ File 選單和 🖼 / 🎞 按鈕。
- 2.619.0：**📏 Sketcher**——用於快速 3D 建模的新面板：繪製形狀，推 / 拉成實體（凹槽、通孔、由偏移生成牆），輸入精確尺寸，吸附到角點 / 邊 / 面 / 座標軸，編組，上色，復原；模型儲存在專案中；可傳送到影像編輯器、時間軸、Blender 和 Unreal，或匯出為 .glb / .obj / .stl。
- 2.618.0：**刪除或隱藏橋接圖層會關閉其橋接**——在影像編輯器中：隱藏或刪除 🟧 Blender 圖層會關閉場景工具（不會生成新圖層）以及場景本身（包括時間軸上它的 🟧 預覽）；🧊 3D (Daz / Blender) 圖層會結束其場景的 Blender，並丟棄正在等待 Daz 即時連結的內容；Unreal / MetaHuman 圖層會停止 📺 Unreal View，清除其畫面並將其隱藏。在時間軸中：圖層被隱藏（👁）或被刪除的 Unreal 片段會關閉其 📺 視窗。重新顯示（或復原）後，圖層仍保留其畫面——選取它即可再次開啟其場景 / 檢視。
- 2.617.0：**從 zip 匯入文字效果**——Presets ▾ ＋ Import PSD text effects or a zip… 可匯入文字效果的 zip（其中每個 PSD 都會成為一個預設，其中的字型會新增到工作室中），或一次匯入多個 PSD。
- 2.616.0：**一個檔案完成安裝**——單獨執行 `install_all.bat`（Windows）、`install_all.sh`（Linux）或 `install_all.command`（macOS），即可在缺少時安裝 Git 和 Node.js（Windows 還會安裝 Python），將儲存庫複製到它旁邊並啟動工作室（首次啟動時會安裝其餘部分）。之後隨時再次執行它即可開啟工作室。
- 2.615.0：**Basic Settings 跟隨風格**——每個風格都會在 misc/basic_settings.tmp 中記住自己的 Basic Settings。在任何地方（提示詞面板、Basic Settings 的風格卡片、某個板……）更換風格時，會先為你正在離開的風格儲存所有 Basic Settings 欄位和風格名稱，然後恢復你上次為新風格所做的設定。應用程式啟動時使用上次會話的風格及其設定。
- 2.614.0：**選擇 ▼ 範圍，✂ Cut 剪下它們；播放時按 Ctrl 始終有效**——點選一個 ▼ 選取其範圍（Ctrl / Shift + click：多選），✂ Cut 剪下選取的範圍（未選取時：全部剪下）。現在，在預覽播放期間，即使焦點位於 ▶、速度清單或已勾選的核取方塊上，或者預覽面板的播放器正在播放時間軸片段，按 Ctrl 也同樣有效。
- 2.613.0：**播放時用 Ctrl 標記 ▼ 範圍、✂ Cut all / ⏩ Speed up、停留時間、播放速度**——預覽播放時按一下 Ctrl 標記範圍的起點，再按一下標記終點（數量不限，每個範圍有自己的顏色，位於反白的圖層上）；拖曳 ▼ 可移動它（預覽會顯示該影格），右鍵點選可刪除它。✂ Cut all 剪下所有範圍；⏩ Speed up 以 2× - 10× 的速度播放這些範圍（快進一段渲染）。指標下的時間顯示在一個小框中；預覽可以 0.125× - 8× 的速度播放。


- 2.612.0：**剪下後的片段仍為一個片段 / ✂ to new layer**——對影格執行 ✂ Cut 和 Del 後，剪下點前後的部分會重新合併為一個連續的片段（影片或聲音：生成一個新的 "-join" 檔案；圖片：只是變短），一次 ↶ 即可復原。新的 "✂ to new layer" 核取方塊會將剪下點（或 Ctrl+K 分割點）之後的部分放到正上方的新圖層上。預覽會提前一秒載入下一個片段——剪下點處不再出現黑影格。
- 2.611.0：**▯ Frame——點選一個影格，按 Del 刪除它**——時間軸上 ▸ ⇤ ⇹ ⇆ ↔ 旁邊的 ▯ 工具（或在圖層上按 F）：在圖層上點選會選取該圖層上指標下的那一個影格，拖曳可選取多影格，Shift+click 選取到此處為止，← / → 前進 / 後退一個影格。Del / ⌫ 將它們從該圖層中剪掉並合攏空隙；↶ 可恢復。
- 2.610.0：**時間軸上的 🧬 Morph**——Properties 旁邊的 🧬 Morph 分頁（時間軸的圖層面板）：填寫 Character 1（起始形象，例如 "a monkey"）和 Character 2（最終變成的形象，例如 "a man"），選擇 Layer 1（起始片段——取其最後一個影格）和 Layer 2（結束片段——取其第一個影格），以及時長（1 - 10 s）。提示詞會自動為你寫好（可以修改——↺ 會重新生成）。🧬 Make the morph 使用工具列中選擇的影片風格，從這兩影格（按畫布上顯示的樣子）進行渲染，將結果放到兩個圖層之間的新 🧬 Morph 圖層上，從圖層 1 的片段結束處開始，並將圖層 2 的片段移到變形結束處開始。除非勾選 "keep its sound"，否則變形片段的聲音為關閉狀態。↶ 可全部復原。兩個角色的構圖相近時效果最好。
- 2.609.0：**將任意浮動面板停靠到影像編輯器的面板欄中**——按住浮動面板的標題，將其拖到 Layers 所在的欄上：橙色線條會顯示其放置位置（該欄中每個面板的上方 / 下方，或末尾）；鬆開 = 停靠到該處。適用於用 ⇱ 浮動的主面板（Assets、Gallery、References、Queue、Preview……）、▣ 面板、Basic Settings、LLM tokens、Camera 面板、提示詞面板和 ⏳ Pending。停靠後，每個面板都有一個細欄：⠿ 可將其拖到欄中的其他位置或拖出欄（重新浮動），▾ 摺疊，⇱ 浮動，⚙（▣ 面板）開啟其選單；拖曳底邊可調整大小。每個面板的停靠位置、順序、高度和摺疊狀態都會被保留，並在下次啟動時恢復；停靠在編輯器中的面板會隨編輯器一起隱藏和顯示。
- 2.608.0：**字型清單以字型本身顯示每種字型**——每個字型下拉式清單都以該字型顯示其名稱（仍可像以前一樣輸入搜尋），收起的清單也以所選字型本身的字形顯示其名稱。
- 2.608.0：**用文字填充形狀**——影像編輯器：右鍵點選形狀圖層（或 Shape 工具的選項列，或 Layer ▸ 🅰 Fill Shape with Text…），然後選擇方式：**Flow inside**（文字圖層的行在輪廓內換行；Fit = 能放下的最大字號）、**Stretch to fill**（字母彎曲並拉伸以填滿輪廓——心形、圓形、星形）或 **Repeat as fill**（形狀的填充變為成排、帶角度的文字——仍為形狀）。Flow / Stretch 可使用文字預設，並保持為可輸入的文字。時間軸：形狀圖層的 ◆ Shape ▸ 🅰 Text fill（成排），以及文字圖層的 🔤 In a shape（Stretch to fill / 在形狀圖層內 Flow inside；⌖ Place on it）。
- 2.608.0：**新增 5 個變形預設**——Shell Lower、Shell Upper、Fisheye、Twist 和 Wedge，位於 Arc … Squeeze 旁邊：見 ⌒ Shape / 3D…、Edit ▸ Transform ▸ Warp 以及時間軸的 📌 Warp ▸ ⌇ Preset。
- 2.608.0：**文字和形狀上的變形網格**——⌗ Warp Grid（Type 和 Shape 工具的選項列、右鍵選單、Edit ▸ Transform ▸ Warp）：拖曳網格點或網格內的任意位置，選擇預設，Grid 3 x 3 / 4 x 4 / 5 x 5，拆分線——按 Enter 套用。圖層仍為文字（可繼續輸入——變形隨之更新）或形狀（可更改顏色——仍保持變形）；Layer ▸ Remove Warp Grid 可將其移除。時間軸：📌 Warp ▸ ⌇ Preset 會轉換為可用 📌（Shift+W）拖曳的網格。
- 2.607.0：**文字預設在形狀和 3D 中保持有效**——帶預設的文字（Gold、Chrome、PSD 文字效果……）在你對其進行變形、繞圓或沿路徑排列、改為豎排或 3D（影像編輯器 ▸ ⌒ Shape / 3D…）時都會保留預設；3D 側面採用預設的顏色並加深（或使用你設定的側面顏色）。在時間軸上，預設文字現在也可使用 ✨ Text Animators 和 〰 On a path，3D 文字（🧊 ▸ 3D text）也有自己的 Preset ▾——預設的外觀用於正面，側面使用其顏色。
- 2.607.0：**新文字以你的預設開始**——在時間軸上，未選取任何內容時，Properties 會顯示 New text ▸ Preset；T 工具建立的下一段文字將使用該預設（在任意文字上選擇預設也會設定它）。
- 2.607.0：**電腦上的所有字型**——每個字型清單（影像編輯器的 Type 工具、Properties、Character 面板；時間軸文字、3D 文字、字幕；卡拉 OK 樣式）都將常用字型放在頂部的 "Common" 下，並在 "This computer (N)" 下列出這臺電腦上安裝的所有字型。
- 2.606.0：**點選文字即選取它並切換到 Move 工具**——手持 Type 工具時也是如此（以前會開啟文字進行輸入）。**雙擊**文字可進行編輯——游標會位於你雙擊的位置。手持繪圖工具或 Type 工具時在 Layers 面板中選取圖層，也會切換到 Move 工具。旋轉 / 斜切控制柄：使用 Move 工具選項列中新增的 ⤡ Scale / ↻ Rotate / skew 按鈕，或雙擊某個控制柄（現在雙擊文字內部會編輯文字）。
- 2.605.0：**停留時顯示 Move 工具的細框**——在影像編輯器和時間軸的預覽畫布中，指標下的物件（文字、形狀、圖片圖層……）會顯示與 Move 工具相同的細虛線框，而不是粗輪廓——使用 Move 工具時如此，使用繪圖工具時也如此（以及在文字上方使用 Type 工具時）。使用繪圖工具**點選**物件會選取它並切換到 Move 工具；**拖曳**仍會繪製新物件。在文字框內的任意位置（包括字母之間）點選都能選取文字。
- 2.605.0：**修復：第二個形狀丟失**——在已選取另一個形狀時繪製形狀沒有任何反應（出錯）；現在會繪製一個新形狀（選取一個形狀時，Ops 按鈕仍可用於合併形狀）。
- 2.604.0：**Image editor ▸ 💾 Save to Images**——在 💾 旁邊選擇格式（PNG、JPEG、WebP、JPEG XL、AVIF、GIF、TIFF、BMP、TGA）。儲存時會先為所有可見內容保留一份臨時副本，然後將其合併（JPEG / BMP 以白色為底——而非黑色），並以該格式儲存到專案的 Images（Assets）以及 Gallery 中（Gallery 不支援的格式——WebP、JPEG XL……——會在其中顯示為同一圖片的 PNG）。你的圖層保持不變。
- 2.604.0：**修復斜切**——使用 Move 工具時，雙擊顯示旋轉控制柄，然後拖曳側邊控制柄：該側傾斜，而對側保持不動（以前會朝反方向擺動）。按住 Alt 則以中心為基準傾斜。文字也可以斜切，並保持為可編輯的文字。
- 2.604.0：**右鍵點選 ▸ Rasterize Text**——適用於影像編輯器中的文字圖層以及時間軸預覽畫布上的文字：文字會變成圖片（復原可恢復）。


- 2.604.0：**選取的物件周圍不再有粗框**——影像編輯器只顯示細的控制柄邊框；時間軸畫布顯示細虛線邊框和小控制柄。
- 2.603.0：**時間軸：在單個圖層上選取範圍**——把紅色位置標記拖到範圍起點，然後在某個圖層上範圍結束的位置
  Shift+點選（點在片段上或片段之間均可；Shift+拖曳時終點跟隨指標）。範圍會畫在該圖層所在的行上，該圖層也會醒目顯示。此時
  **✂ Cut**（剪下）只會從這一個圖層上刪除整段範圍——其他圖層不受影響（開啟波紋編輯時，該圖層上的空隙會自動合攏）。在標尺上拖曳仍然是普通的選取。
- 2.603.0：**時間軸復原**——使用時間軸選單列中的 ↶ / ↷，或在指標位於圖層上方時按 Ctrl+Z / Ctrl+Shift+Z（或 Ctrl+Y）。每次編輯都是一步（一次拖曳算一步）；選取操作不算。
- 2.603.0：**重新啟動遺留執行的 ComfyUI**——如果應用程式啟動時本機上已有一個 ComfyUI 在執行（之前遺留的，或手動啟動的），應用程式會先結束它，再由自己重新啟動，這樣它的主控台、⟳ Restart 和記憶體都歸應用程式管理。對應設定為 Settings ▸ ComfyUI ▸
  "Restart a ComfyUI left running when the app starts"（預設開啟）。
- 2.602.0：**影像編輯器 ▸ Type 工具**——正在輸入的文字周圍的虛線框現在會緊貼文字，並隨每次按鍵而變大（居中文字向兩側擴展）。使用 Type 工具時，指標在文字上方顯示為文字 I 形游標，在其他位置顯示為新增文字游標（虛線框中的 I 形游標）。點選一段文字時，會直接在點選處——離點選位置最近的兩個字母之間——開始編輯，而不是全選；在正在輸入的文字內點選會把插入符移到該處。供 Move 工具的控制柄、
  Align（對齊）和點選使用的文字框，現在與字母一樣寬（之前測量得偏小）。
- 2.601.1：**已修復：Ming-3.0 TTS 報錯 "\"mul_cuda\" not implemented for 'BComplex32'"**——Ming 的整個模型以
  bfloat16 執行，而把輸出轉換為聲音的最後一步要進行復數運算，PyTorch 無法在 bfloat16 下完成。bitGen 現在以全精度（float32）執行這一步，其餘部分仍保持原來的速度。無需重新安裝任何東西。
- 2.601.0：**⟳ Reinstall，且每個安裝按鈕都會顯示正在做什麼**——已安裝的附加元件、軟體套件或模型會顯示
  **⟳ Reinstall**（重新安裝；已下載的模型顯示 **⟳ Download again**），按下後會真正重新取得全部內容，而不是跳過「已存在」的部分。安裝或下載一開始，按鈕即被停用，旁邊的狀態文字會說明目前進展——所處步驟、百分比、已用秒數——最後顯示
  **✓ installed** 或 **✗ 原因**。執行期間 Settings 視窗保持開啟。適用範圍包括：Settings ▸ Add-ons、faster-whisper、
  OmniVoice、sd-cli、Comfy Kitchen、Sage / Spectrum / 各節點套件、模型目錄、Civitai 下載、LoRA
  訓練器、Viggle（原生）、軟體套件升級、從資料夾安裝擴充功能，以及各面板中的 demucs（Stems）、AI
  去背、SAM 2、Select ▸ Subject 和 Segment Anything。
- 2.601.0：**Settings ▸ Audio ▸ 聲音複製：▶ Play**（原為 "Play selection"）——有選取範圍時播放選取範圍，沒有選取範圍時播放整個片段；播放期間按鈕變為 ■ Stop，波形上有一條白線跟隨播放位置。在波形上按一下（不拖曳）會清除選取範圍。
- 2.601.0：**已修復：Ming-3.0 TTS 報錯 "TorchCodec is required for load_with_torchcodec"**——新版 torchaudio 把音訊讀取交給了一個單獨的軟體套件（TorchCodec），而它還需要 FFmpeg 的庫。bitGen 現在自己讀寫 Ming-3.0 TTS（以及 OmniVoice）所用的語音片段，因此無需重新安裝任何東西。
- 2.600.1：**已修復："transcription failed: open() got an unexpected keyword argument 'metadata_errors'"**——該錯誤出現在生成聲音複製的轉寫文字（或任何 faster-whisper 轉寫）時。新版 PyAV（faster-whisper 使用的影片 / 音訊讀取庫）刪除了
  faster-whisper 仍在傳遞的一個選項。bitGen 現在自己讀取音訊，並直接把聲音資料交給 faster-whisper，因此無論安裝的是哪個版本的
  PyAV 都能正常工作——無需重新安裝。新安裝 faster-whisper 時，也會保留一個仍帶有該選項的 PyAV 版本。
- 2.600.0：**Basic Settings ▸ Format 中的 📱 Social media**（社交媒體）——無需使用時間軸的 Export 即可快速使用。
  Format 下拉式清單中有一個 **📱 Social media** 分組：**Reels / Stories 9:16**、**Facebook feed 4:5**、**Square 1:1**、
  **Landscape 16:9** 和 **the render's own shape**（渲染本身的形狀）。
  - 選擇其中一項會把 **Aspect** 設為對應比例，讓模型按該形狀渲染（資訊流的 4:5 會先以 3:4 渲染，再裁成
    4:5）。Format 下方的那行文字會說明將會發生什麼。
  - 渲染完成後、進入相簿和素材之前，MP4 會按照與 **📤 Export ▸ MP4 · Social media** 相同的設定轉換為適合各平臺的格式：
    H.264、48 kHz 立體聲 AAC 音訊（沒有音軌時新增靜音軌）、恆定幀率、faststart、短邊最大 1080。任務日誌會顯示
    "ready for Facebook / Instagram / TikTok"，或指出哪裡有問題。如果無法轉換，則保留普通 MP4，並在日誌中說明原因。
  - 適用於 MiniMax H3、Wan 和 LTX 渲染以及音樂影片。
- 2.599.0：**↺ Reset project 會顯示鎖定螢幕。** 確認之後，整個視窗會被一層遮罩覆蓋，顯示
  **"Resetting Project..."**——一個旋轉的圓環、跳動的圓點、目前步驟（停止任務、刪除並重新建立資料夾、重新開啟）以及已用秒數。遮罩後面的任何內容都無法點選或輸入。遮罩在頁面重新載入期間一直保留，直到空專案開啟（**✓ Project reset**）後才消失。如果重設被拒絕，遮罩會消失並顯示原因。
- 2.598.0：**種子有了 🎲 Random / 📌 Fixed 切換**——位於 Basic Settings（影片和影像）以及每個風格編輯器（影像、影片、音樂）中。
  - **🎲 Random**（隨機）：每次渲染都使用新的種子（數字框變灰）。**📌 Fixed**（固定）：每次渲染都使用旁邊的數字——
    相同設定下得到相同的畫面。輸入一個數字，或點選 ♻（上次使用的種子），即切換為 Fixed；切回 Random 時會保留該數字供下次使用。
  - **在風格中**：Fixed 表示該風格始終使用自己的種子渲染。渲染使用哪個種子：優先使用 Basic Settings 的 Fixed 種子；開啟 **Override style**（覆蓋風格）時，Basic Settings 的 Random 保持隨機；否則使用風格的 Fixed 種子；再否則使用隨機種子。之前儲存的風格為 Random（與以前一樣，不使用其舊種子）。
  - 開啟 Override style 時，會發送影像設定中的種子。
- 2.598.0：**🧩 Model manager 能找到正在執行的 ComfyUI 所擁有的模型和 LoRA**，即使它們不在
  Settings ▸ ComfyUI 中設定的 ComfyUI 資料夾裡（ComfyUI Desktop 應用程式會把它們放在自己的資料夾中，或在 ComfyUI 的命令列中指定了 yaml）。它會向 ComfyUI 查詢其模型資料夾及下拉式清單中的名稱；對於 ComfyUI 列出但本機無法開啟其檔案的模型，仍會顯示一張卡片（其大小一欄會註明）。啟動 ComfyUI 後，在管理器中按 ↻。
- 2.597.0：時間軸 **📤 Export** 中的 **MP4 · Social media**——用於 Facebook、Instagram 和 TikTok。可以將其作為一種格式選擇，或選擇 **＋ a pack… ▸ social media** 一次匯出四種：**9:16**（Reels / Stories，模糊填充）、**4:5**（Facebook
  資訊流）、**1:1** 和 **16:9**，短邊均為 1080。
  - 它完全按照各平臺的要求生成：H.264（High，8 位）、48 kHz 立體聲 AAC 音訊、恆定幀率（高於 60 fps 的影片輸出為
    30 fps）、索引位於檔案開頭（faststart）、無時間碼軌、短邊最大 1080，並設有位元速率上限，使檔案大小保持合理。沒有聲音的影片會加上一條靜音軌（有些上傳程式會拒絕沒有音軌的影片）。
  - 生成後會檢查檔案，日誌顯示 "ready for Facebook / Instagram / TikTok"——或指出哪一項有問題。時長超過 90 秒的 9:16
    影片會附帶提示：它可能會作為普通影片而不是 Reel 發布。
  - 為什麼其他檔案會被拒絕：AVI（舊式影片編碼，音訊未壓縮）不適合社交媒體；10 位、H.265 和 AV1 的 MP4
    用於剪輯和較新的播放器；而當時間軸設有起始時間碼時，普通的 MP4 · H.264 匯出會新增時間碼軌。凡是要上傳的內容，請使用
    MP4 · Social media。


- 2.596.0：**Settings ▸ LLM** 中的 **⟳ Update llama.cpp**。按鈕下方的那行文字會顯示你目前的 llama.cpp 版本，以及是否有更新的版本（"llama.cpp b10456 · the newest is b10601 - ⟳ Update available"）。
  - **⟳ Update llama.cpp** 會停止 LLM 伺服器和視覺模型，然後把最新版本覆蓋安裝到上方設定的引擎資料夾中（Windows：安裝你的驅動程式所支援的 CUDA 版本）。你的模型和設定保持不變。進度顯示在旁邊的小日誌中，Settings 視窗保持開啟。尚未安裝引擎時，此處顯示的是 **⬇ Install engine**。
  - LLM 分頁中的每個按鈕在執行操作時都會顯示正在做什麼：**▶ Start server** 先顯示 "Starting the
    server…"，然後顯示 "Loading <the model>…" 直到模型就緒，最後顯示 "✓ Model loaded"；**■ Stop**、**↻ Rescan**、
    **🔎 Scan folder** 以及 Settings 的 **Save** 會顯示 "Stopping / Scanning / Saving…"，然後顯示 ✓——或 ✗ 及原因。
- 2.595.0：**WeVisOne-VL**（騰訊出品，基於 Qwen3-VL）可用作視覺模型。**Settings ▸ Add-ons ▸ WeVisOne-VL** 中有一個下拉式清單：**★ 4B Q4_K_M**（推薦）、4B Q6_K、4B Q8_0、2B Q8_0 和 2B Q4_K_M——每一項都帶有對應的投影器（projector）。
  - 它會下載到**你的視覺模型資料夾**（在 Settings ▸ LLM 中設定的那個；未設定時為 LLM 資料夾下的
    vision 子資料夾），放在其單獨的 WeVisOne-VL-4B 或 WeVisOne-VL-2B 資料夾中，以便與正確的投影器配對。
  - 然後在提示詞面板的視覺下拉式清單中選擇它：提示詞中 📎 附加的圖片會被讀取並描述給 LLM。它擅長識別圖片中的文字、計數以及描述物體的位置。
  - 它需要較新的 llama.cpp（misc\get-llama.ps1）。它的分割和去背功能不包含在 GGUF 檔案中——
    在 bitGen 中它用於讀取和描述圖片。
- 2.594.0：**透過右鍵選單 🧊 轉換為 3D。** 在 **Gallery**、**Assets** 或
  **References** 中的圖片上右鍵點選，或在**影像編輯器的畫布**上右鍵點選（它會在選單中新增 🧊 Convert Picture to 3D… / 🧊 Convert Layer to 3D…；
  Layers 面板和 Layer 選單中也有 Convert Layer to 3D…）。
  - 選擇引擎：**Hunyuan3D 2.1**（只生成形狀，速度快）或 **TRELLIS.2**（形狀 + 紋理，較慢）。兩者都在
    ComfyUI 中執行，與 🧊 按鈕相同。
  - 選擇模型的去向：**Image editor**（作為 3D 圖層——Blender 會把模型放進一個有燈光、攝影機已對準它的場景；可在 🧊 3D
    分頁中環繞檢視、渲染並以它為基礎生成——需要 Blender）、**SolidCraft docker**（作為新設計開啟）或 **Just save it**（儲存到專案的 models3d/ 資料夾）。
  - 任務在佇列中執行；完成後，模型會在你指定的位置開啟。來自 References 或編輯器的圖片會先儲存到專案的 images 中。
- 2.594.0：**Ming-3.0 TTS**——第二個語音引擎。在 **Settings ▸ Add-ons ▸ Ming-3.0 TTS** 中安裝（包括其程式碼、獨立的 Python 和 0.5B 模型，位於 ming-tts 資料夾中），然後在 **Settings ▸ Audio ▸ Speech engine** 中選擇它。
  - 複製聲音需要其語音片段**以及**準確的轉寫文字；設計聲音（一段描述）使用 Ming 的聲音設計功能。聊天中的 🗣、Speech 面板和 Test voice 都使用所選的引擎。
  - 其作者在 Linux + CUDA 12.4 上進行測試。在 Windows 上它尚屬新嘗試：RTX 50 系列顯示卡會安裝 CUDA 12.8 版本的
    PyTorch。沒有文字規範化元件（pynini，Windows 上通常缺失）時，請把數字寫成文字。
- 2.594.0：**Bark 3.0 語音轉文字**（Underdog）。在 **Settings ▸ Add-ons ▸ Bark 3.0 speech-to-text** 中安裝，然後在 **Settings ▸ Audio ▸ Speech-to-text engine** 中選擇它。
  - 它**僅支援英語**，且**不提供逐詞時間**，因此用於普通轉寫：🎤 Transcribe 按鈕、聲音複製轉寫、手機遙控和 🎙 語音聊天。歌詞、字幕、逐詞時間和其他語言始終使用 faster-whisper（請保留安裝以供這些功能使用）。
  - 長檔案會在安靜處切分成不超過 30 秒的片段，因此轉寫結果仍帶有大致的時間。
  - 授權條款為 CC-BY-4.0（其 NOTICE 檔案保留在模型旁邊）。
- 2.593.0：**Face fix 和 ControlNet 現在是附加元件。** 在 **Settings ▸ General ▸ Add-ons in the
  studio** 中開啟它們（兩者預設關閉）。
  - **關閉**：Basic Settings 會隱藏 Face fix / ControlNet 部分（ControlNet 還會隱藏其 Settings 分頁），Settings ▸
    Add-ons 會隱藏其卡片，任何渲染都不會使用它。
  - **開啟**：它們重新顯示，bitGen 會檢查附加元件所需的一切，並自動把缺失的內容下載到正確的 ComfyUI 資料夾——立即執行，並且在附加元件開啟期間每次啟動時都會再次檢查。Settings ▸
    Add-ons 中會顯示進度。
  - **Face fix** 需要 ComfyUI-Impact-Pack 和 ComfyUI-Impact-Subpack 節點套件，以及人臉偵測器
    face_yolov8m.pt（models/ultralytics/bbox）。
  - **ControlNet** 需要 comfyui_controlnet_aux、其四個前處理器的模型（DWPose、PiDiNet、Lineart、Depth
    Anything V2——位於 custom_nodes/comfyui_controlnet_aux/ckpts），以及 SDXL ControlNet（適用於所有類型的 xinsir Union ProMax，外加 OpenPose、Scribble 和 Depth——位於 models/controlnet，約 10 GB）。它們用於 SDXL / Pony /
    Illustrious 第二模型。
  - **Settings ▸ Add-ons** 中的每張卡片都列出了所有下載連結（GitHub 節點套件和 Hugging Face 檔案，並註明每個檔案應放入的資料夾），因此你也可以自己下載。
  - 新增節點套件後，請重新啟動一次 ComfyUI。
- 2.592.0：**🎭 一張圖片中的兩個角色，各用各自的 LoRA**（來自 Winnougan 的 Nougan Nodes——Settings ▸
  Add-ons ▸ **Nougan Nodes** 會將其安裝到 ComfyUI；之後請重新啟動 ComfyUI）。在影像編輯器的 ✨ AI 面板 ▸ 🔲 Zones
  ▸ **▦ Regional prompt**（區域提示詞）中，每一行框都有一個 **🎭** 按鈕：從 ComfyUI 的 loras 中選擇該角色的 LoRA 及其強度。每個 LoRA 只在自己的框內起作用，因此兩個人各自保持自己的面孔，而不會融合成一張臉；場景的描述詞仍作用於整張圖片，沒有 🎭 的框與以前一樣工作。
  - 每張圖片最多使用兩個不同的角色 LoRA（第三個會在開始渲染前被拒絕）。兩個框可以使用同一個 LoRA。
  - 在 FLUX.2 / Krea 2 / Qwen Image 風格上效果最好，並使用為該模型訓練的 LoRA。在 Qwen Image **Edit** 上，圖片仍作為模型本身的輸入：LoRA 限定在各自的框內，框中的描述詞變為區域提示詞。
- 2.592.0：**⏱ LTX 提示詞中的定時行（Prompt Relay）**——在一次渲染中為 LTX 2.3 / 2.5 片段的每一段分別指定描述詞。不帶時間的行描述整個片段；以時間開頭的行描述對應的那一段：

      a red fox in the snow, cinematic
      [0-2s] the fox sniffs the ground
      [2-4s] the fox looks up at the camera
      [4s] it runs off to the left

  - 每一行持續到下一行開始為止（第一行從 0 秒開始，最後一行持續到片段結束）。時間單位為秒：
    `[2s]`、`[2-4s]`、`[2.5 - 4 s]`、`[2 to 4]`。
  - 提示詞面板中 LTX 模式旁邊的 **⏱** 會新增下一行（每行 2 秒）。它在
    StoryBoard 的場景中以及時間軸的 AI 片段中用法相同。
  - 需要 Settings ▸ Add-ons ▸ **Nougan Nodes**（Kijai 的 ComfyUI-PromptRelay 也可以）。沒有它時，片段會把所有行作為一個提示詞渲染，任務日誌會註明這一點。定時在第一遍中設定；範本的第二遍（細節）保留整個片段的描述詞。


- 2.591.3：**GitHub 上的測試重新透過。** Windows 上的 Git 可能會以 Linux 換行符儲存 .bat 檔案，而一項新測試按檢出後的原樣讀取它們，因而失敗。現在由一個 .gitattributes 檔案讓所有 .bat / .cmd
  在檢出時都使用 Windows 換行符；在 git 檢出目錄中，測試改為檢查這條規則，而不是檢查檔案位元組。
- 2.591.2：**push-to-github.bat 回到了應用程式資料夾中**（位於 start.bat 旁邊），並且**永遠不會進入儲存庫**：GitHub 上不會有它的副本（它被忽略，也不包含在儲存庫 zip 中）。它隨扁平 zip 一起提供。把儲存庫 zip 拖放到它上面時，不再會把它從資料夾中刪除。2.591.0 / 2.591.1 留在 misc\ 中的副本，會在下次啟動 bitGen 時自動移回上一級。
- 2.591.1：**misc\ 遷移後的 GitHub 測試。** 透過解壓縮覆蓋方式更新的儲存庫（或透過只新增檔案的上傳方式更新的儲存庫）仍保留著根目錄下的舊副本，導致 GitHub 的測試在這些檔案上中止。現在這些副本不再被視為錯誤，並且 **push-to-github.bat** 會在提交前刪除它們，使 GitHub 獲得新的目錄結構。
- 2.591.0：**整潔的應用程式資料夾。** bitGen Studio 資料夾現在只顯示 **start.bat**（外加 npm 需要放在 node_modules 旁邊的
  package.json / package-lock.json，以及用於 GitHub 頁面的 README.md / LICENSE）。原來放在它們旁邊的其他所有內容——
  server.js、Python 工作處理程序、default.settings、quick_prompts.json、requirements.txt、安裝指令碼（get-comfy.ps1、get-llama.ps1、get-sd-cli.ps1、get-yue2.ps1、get-qwen3vl.ps1、get-electron.ps1、
  download-models.ps1）、clear-comfy.bat、reset-layout.bat 以及各種說明檔案——現在都位於 **misc\** 中。
  - 啟動方式不變：雙擊 **start.bat**。
  - 用 zip 覆蓋舊資料夾進行更新時：資料夾中殘留的舊副本會在 bitGen 第一次啟動時自動清理（你自己的快速提示詞會保留——它們會移入 misc\）。
  - push-to-github.bat：（2.591.2：回到應用程式資料夾中，位於 start.bat 旁邊，且永遠不進入儲存庫。）
  - bitGen 執行時建立的資料夾和檔案（projects、styles、models、custom.settings、佈局檔案……）保持在原來的位置。
- 2.590.0：**🎨 Artist mode**（藝術家模式）是全螢幕畫布（2.588.0 的 ⬚ 專注模式）的新名稱：在影像編輯器選單（File … Help）之後有一個帶文字的 **🎨 Artist mode** 按鈕，也可使用 View ▸ Artist Mode 或 Ctrl+Shift+F。此時只顯示畫布；Ctrl+P 開啟顏色（2.646.0：Alt+P），Ctrl+B 開啟畫筆，Ctrl+Esc 返回。編輯器較窄時，其選單列現在會換到第二行，因此不會再有按鈕被截斷。
- 2.590.0：**影像編輯器的每個分頁都是一個面板。** 按住名稱拖曳一個分頁（Layers、Color、✨ AI、🎮 Unreal、🖌 Brush……）：
  - **拖到另一個面板上**（拖到其標籤列或內容區，無論它在面板欄中還是浮動）——它會成為該面板的一個**分頁**（該面板會以橙色標示）；
  - **拖到面板欄中某個面板的上邊緣或下邊緣**（或最後一個面板的下方）——它會在該處成為一個獨立的面板（一條橙色線標示位置）；
  - **拖到編輯器中的其他任意位置**——它會**浮動**：按住其標籤列的空白處拖曳它，拖曳其角落調整大小，
    ⇲ 把它放回面板欄，✕ 隱藏它。
  - 面板標籤列開頭的 **⠿** 可用同樣的方式拖曳**整個**面板（拖到另一個面板上 = 其所有分頁都併入該面板）。
  - 按一下分頁仍然只是開啟它。每個分頁的位置都會被記住。**Window ▸ Show All Dockers** 顯示所有隱藏的面板，**Window ▸ Reset Docker Tabs** 把每個分頁放回初始位置。
- 2.590.0：**📺 Unreal View**——即時顯示所選 Unreal / MetaHuman 圖層的攝影機在 Unreal 中看到的畫面（每秒幾影格）：
  - **影像編輯器**：選取一個 Unreal / MetaHuman 圖層時會開啟一個浮動面板（☑ show it when an Unreal
    layer is selected），並在 🎥 攝影機工具、🎮 Unreal 分頁、鏡頭和燈光改變攝影機時跟隨該圖層的攝影機。選取其他圖層時它會停止。它和其他分頁一樣——把它拖到某個面板上即可固定在那裡。
  - **時間軸**：選取一個 Unreal 片段時，預覽行上方會開啟一個視窗（UNREAL ▸ View ▸ 📺 Unreal View
    顯示 / 隱藏它）：顯示**播放頭**處的片段——處於關鍵影格之間的 Unreal 攝影機、處於其姿勢中的 MetaHuman、處於該影格的 Level
    Sequence（Sequencer 會在該處開啟它）。
  - 它的工具列：● live · 每秒幀數、尺寸（S / M / L——越小越快）、⏸，以及 **⚡ Keep Unreal fast**。
  - **必須讓 Unreal 保持開啟嗎？** Unreal Editor 必須在**執行**中並開啟你的專案（bitGen Bridge
    位於其中）——但它不必位於前景或顯示在螢幕上：可以最小化它，或讓它待在 bitGen 後面。預設情況下，
    Unreal 不是最前面的視窗時會降到每秒幾影格；**⚡ Keep Unreal fast** 會關閉這一行為（Editor Preferences ▸ General ▸ Performance ▸ Use Less CPU when in Background），使靜影格、渲染和即時檢視都保持快速。
  - 需要 **bitGen Bridge plugin 1.5.0**——🎮 Load UE project 會更新它（1.4.0 外掛顯示檢視較慢，且不支援序列片段）。
- 2.589.0：**Team 渲染農場現在是一個可選附加元件**（不再屬於 bitGen 本體）。它以單獨的 zip 提供，即 **bitgen-ext-teamdock-v<version>.zip**——安裝套件、儲存庫和扁平 zip 中都不包含它。**⚠ 它可能會觸發病毒檢查程式**：它會生成簽名金鑰、在網路埠上監聽團隊中的其他電腦，並每 15 秒寫入一次團隊資料夾，
  Malwarebytes 曾將其標記為勒索軟體。請只在互相為對方渲染的電腦上安裝它：
  - **Settings ▸ Add-ons ▸ Team render farm ▸ 📦 Install from a zip…**（選擇該 zip），或把 zip 放到應用程式資料夾或 Downloads（下載）資料夾中，然後按 **Install**。**重新啟動 bitGen**——Settings ▸ Team 和狀態列中的 🖥 Render on 就會出現。
  - **Remove** 會再次將其移除（需重新啟動）。本機的團隊身分和金鑰保留在應用程式的 team/ 資料夾中——刪除該資料夾即可忘記該團隊。如果你的防毒軟體阻止了它，請允許 bitGen 的資料夾，或移除該附加元件。
  - 沒有它時，所有任務都在本機渲染；已經指向團隊 NAS 資料夾的專案資料夾仍可繼續使用。
- 2.588.0：**影像編輯器中的 ⚡ 即時生成**（Krita 的即時模式）——編輯器選單列中的 ⚡（位於 ⛶ 旁邊）或
  View ▸ ⚡ Live Generation 會開啟 **⚡ Live** 面板。開始繪畫：每一次更改（一筆、一次復原、顯示 / 隱藏或新增圖層、修改提示詞、修改設定）都會在片刻之後重新渲染——以即時強度對整張圖片進行 Refine。
  - **一次只渲染一個**；渲染期間做出的更改會在下一次渲染（最新的更改優先——有更新的更改到來時，正在等待的即時渲染會被丟棄）。模型在兩次即時渲染之間保持載入（不清理顯示記憶體），即時渲染會排到佇列最前面；它們永遠不會顯示在佇列面板、相簿或素材中。
  - 面板內容：結果（按住 = 在畫布上以全尺寸顯示）、**風格**（速度快的風格才有即時感：turbo / lightning /
    LCM / FLUX schnell / Z-Image Turbo，4-8 步）、**強度**（30-50 % 能保留你的繪畫）、**步數**（0 = 使用風格自身的步數）、**尺寸**（MP——越小越快）、**🔒 種子**（相同的種子 = 結果只在你繪畫的地方變化；
    🎲 換一個新種子）、**▣ on canvas**（把結果按混合比例疊加在圖片上）、⏸ 暫停、↻ 立即渲染、
    **✔ Apply as layer**（作為圖層套用，一個復原步驟）、✕ 關閉即時模式。
  - 提示詞取自 ✨ AI 面板的輸入框；該框為空時取自主提示詞框。
- 2.588.0：**影像編輯器中的 ⬚ 專注模式**（2.590.0：改名為 🎨 Artist mode）——選單列中的 ⬚（或 View ▸ Focus Mode、Ctrl+Shift+F）：只顯示畫布，全螢幕且無邊框——bitGen 的各種欄以及編輯器的選單、工具、面板、標尺和停靠面板全部隱藏。繪畫、[ ]、縮放、按住 Space 平移和復原都照常可用。
  - **Alt+P**（2.646.0 之前為 Ctrl+P）——在指標處開啟調色盤：飽和度 / 亮度方塊和色相條（拖曳調整）、前景色 / 背景色（⇄ 交換）、十六進位制值、調色盤的色塊以及你最近用過的顏色——左鍵點選 =
    前景色，右鍵點選 = 背景色。再按一次 Alt+P、按 Esc 或在外部點選即可關閉。
  - **Alt+G**（2.646.0）——在畫布上方顯示 Layers 面板 + ⏳ Pending；**Ctrl+P**（2.646.0）——提示詞面板。
  - **Ctrl+B**——在指標處開啟畫筆：所有畫筆預設（點選 = 用它繪畫）+ 大小、不透明度和流量。
  - **Ctrl+Esc**——返回正常模式（Ctrl+Shift+F 也可以——有些 Windows 鍵盤把 Ctrl+Esc 留給「開始」選單）。瀏覽器自身的 Esc 只會離開瀏覽器的全螢幕；畫布會保持無邊框，直到按 Ctrl+Esc。
  - **Shift+右鍵點選**（2.637.0）——同樣返回正常模式，在螢幕任意位置均可（Windows 把 Ctrl+Esc 用於「開始」選單）；不會開啟右鍵選單。


- 2.588.0：**🎓 面板 ▸ 🧬 RefMods**——LoRA 與微調訓練器面板的頂部可以在 🎓 Training 和
  🧬 RefMods 之間切換：MiniMax H3 參考模組（無需訓練），儲存在應用程式的 **refmod/<name>/** 資料夾中，因此**所有專案**
  都能使用它們。
  - **＋ New RefMod**，然後選擇其**類型**：🧑 Character reference · 🏞 Location · 🚗 Vehicle · 📦 Object · 🪄 Prop · 🌿 Flora ·
    🐾 Animal，並填寫一段簡短描述。
  - **＋ Media…**（或直接拖入檔案）：圖片放入 images/，影片放入 videos/，聲音放入 audio/——每一項都有自己的說明文字框（與圖片一同上傳的 picture.txt 即為該圖片的說明文字）和 ✕。
  - **✨ Autocaption**——由視覺模型填寫空白的說明文字（✨ all = 全部重新生成）；影片的說明文字取自其中一個影格；聲音保留你輸入的說明文字。
  - **🧬 Extract RefMod**——透過 ComfyUI 執行的一個佇列任務（使用 ComfyUI-MiniMaxH3Mod 節點套件）：先處理圖片，再處理均勻分佈在各影片中的影格（共 16 影格）-> <mod>.safetensors，儲存在該 RefMod 的資料夾中（每當渲染需要時會複製回 ComfyUI 的
    models/refmods）。聲音保留在資料集中——RefMod 節點只接受圖片。
  - **＠ Use in the prompt** 會在提示詞框中插入 **@name**：MiniMax H3 渲染（References / First-last frame）會在取樣器之前載入該模組；@ 會從模型讀取的描述詞中去掉。
- 2.588.0：**Settings ▸ Add-ons ▸ SolarRenderer**——把一段**結構**影片（灰色方塊、語義圖、骨架、深度、法線、人體網格、草圖），加上可選的首幀和一段六部分的提示詞，在 4
  步內渲染成成片（Enderfga 在 MiniMax H3 上的控制 LoRA + 四步 LoRA；長片段使用一對因果 LoRA）。該附加元件會把
  SolarRenderer 節點套件放入 ComfyUI 的 custom_nodes，並下載你勾選的 LoRA；它在 MiniMax H3 的 ref2va
  模型、文字編碼器和 VAE 上渲染（Settings ▸ Setup）。然後 **Settings ▸ ComfyUI ▸ Graphs ▸ ☀ SolarRenderer** 會透過
  ⤒ Import & check 匯入該節點套件的工作流程（統計輸入數量、指出缺失檔案、進行測試執行，成功後儲存）。這些權重採用 MiniMax H3 Community License——歐盟、英國、韓國和美國屬於排除地區。
- 2.587.0：**Settings ▸ ComfyUI ▸ Graphs ▸ ⤒ Import & check**——匯入任意 ComfyUI 工作流程（儲存的工作流程或
  API 匯出檔案），bitGen 會檢查它、繪製它、測試執行它，並在它能正常工作時儲存下來：
  - **它接受的輸入**——🖼 圖片 · 🎞 影片 · 🔊 聲音（即它的 Load Image / Load Video / Load Audio 節點）；參考圖面板會按順序填充這些輸入，面板中沒有對應內容的載入器在該次渲染中會被繞過。
  - **輸出**——Preview 節點會被改為 Save 節點（預覽不會寫入檔案），不儲存的影片合成節點會被開啟；什麼都不儲存的工作流程會被拒絕。
  - **缺失的節點**（ComfyUI 中沒有——請安裝該節點套件、重新啟動 ComfyUI 後重新匯入）和**缺失的模型檔案**（載入器指定的檔案不在 ComfyUI 的清單中）都會被報告。讀取儲存的（UI）工作流程需要 ComfyUI 正在執行。
  - **它獲得的控制項**，已經連接好：Prompt（為空 = 使用提示詞框）、Negative（為空 = 使用負面提示詞）、
    Seed（bitGen 的種子）、Steps、CFG、Width / Height、Length——選取該圖時顯示在 Basic Settings 中。
  - **圖會繪製**在下方：每個節點和連線、輸入、輸出，缺失的節點和模型檔案以顏色標出；滑鼠滾輪縮放，拖曳平移，⤢ Fit 顯示全部。在該分頁中載入的工作流程（↻ Load、📁 File、選取的圖）也會以同樣方式顯示其輸入和圖。
  - **▶ Test run** 會透過 ComfyUI 將其排隊執行一次，並在每個輸入中放入測試圖片 / 聲音 / 影片。**執行成功** = 它會被儲存到 comfy_workflows/ 並儲存為一個圖（在該分頁中選取——Generate ▸ ⚙ Graph 即可執行它；測試圖片在相簿中）。**執行失敗** = 列出 ComfyUI 的錯誤，不儲存任何內容。需要真實人臉或特定圖片的工作流程可能會在測試圖案上失敗——這時請用 📁 File 手動新增。
- 2.587.0：每個面板名稱旁邊的 **Settings ▸ Dockers ▸ 👁** 可將其**關閉**：該面板及其狀態列按鈕都會被隱藏（因此不會被誤開啟）——🚫 表示它已關閉，點選一下即可同時恢復兩者。浮動視窗同樣適用。
- 2.587.0：**Settings ▸ Dockers ▸ 🗂 Layouts**——佈局是整個面板排布（每個面板的位置、大小、顯示 / 隱藏 / 關閉狀態、面板配置、浮動視窗、工作區）+ 主題：**💾 Save layout**
  （儲存為安裝資料夾中的 layouts/<name>.json）、**↺ Apply**（頁面重新載入並套用該佈局）、**⤓ Export**、**⤒ Import**、✕。
  **★ Save as the default** 會寫入 layouts/default.json 和 themes/default.json——把這兩個檔案都複製到儲存庫中：全新安裝會以該佈局啟動，從未選擇過主題的瀏覽器會使用該主題。（主題在 Settings ▸ Themes 中保留各自的
  💾 Save / ⤓ Export / ⤒ Import——themes/<name>.json。）
- 2.581.0 修復：📐 SolidCraft 面板中的 **📁 Designs ▸ open 和 📂 Open from the computer** 之前什麼都打不開（SolidCraft
  只在啟動時讀取其檔案儲存）——現在設計或零件會像直接拖放到它上面一樣載入。
- 2.574.0：**所有生成都顯示「第 n 步 / 共 total 步」**——透過 ComfyUI 生成的圖片現在會即時報告其取樣步數（之前只顯示 "rendering… Ns"），sd-cli 生成的圖片和影片也一樣；並且所有顯示正在執行的生成的地方都會顯示步數：狀態列（step n/total）、佇列、Console 中 Cancel 旁邊、Song 分頁和 Music 面板（之前顯示 "[object Object]"）、影像編輯器的結果圖塊和 ⏳ Pending 卡片、From the picture、3D /
  Unreal 真實圖片、時間軸的 ✨ 填充、🤖 AI take、攝影機深度和卡拉 OK 疊加層、StoryBoard（網格卡片、場景選擇器、⏫ 放大、✎ First frame、分鏡腳本圖片、環境 / 角色建立器、角色設定圖鏡次、
  RefMod 提取）、替換對話方塊（鏡次和首幀）、VR world、風格診斷（style doctor）和 Sketcher。

StoryBoard（時間軸下方包含各場景的面板）在所有地方都稱為 StoryBoard——它的標題、狀態列按鈕、Docker configs、各種訊息——摺疊後名稱也保持不變（2.545.0）。

**對話方塊和訊息框會在螢幕中央開啟**。按住標題移動某個對話方塊後，下次它會在你上次放置的位置開啟（按對話方塊名稱儲存在安裝資料夾中的 **dialog_layout.cfg** 裡）；如果視窗變小了，它會被拉回到螢幕內。刪除該檔案即可讓所有對話方塊重新在中央開啟。

**🧰 Tools & Properties 始終位於時間軸面板內部**：在其預覽畫布行上方（因此軌道和選單列不會被遮擋；預覽行隱藏時位於選單列下方）——無論是拖曳、調整大小，還是面板本身改變大小，它都保持在面板範圍內——絕不會超出（面板較小時它會隨之變小，內容可捲動）——時間軸面板摺疊時它會隱藏。

在影像編輯器中，**Shift+Del** 刪除所選圖層。

## 在形狀或遮罩中生成填充、圖案庫（2.437.0）
<!-- en: generate-fill-in-a-shape-or-a-mask-the-pattern-library-2-437-0 db816fafc86d -->

**✨ Generate Fill in Shape…**（在形狀中生成填充；位於 Layer 選單、圖層的右鍵選單，或 Properties 中的 ✨ fill in shape）：在所選圖層的輪廓內生成內容——輪廓可以來自形狀、文字、像素圖層的內容、智慧型物件（或其向量遮罩的路徑）。輸入要填充的內容（留空 = 使用提示詞面板中的提示詞）以及結果數量；✨ AI 面板開始生成，點選某個結果進行比較，**✔ Apply**（套用，Enter）會把它放到形狀正上方的一個新圖層上，並**剪貼**到該形狀（↳）——形狀仍是可編輯的即時形狀，填充可以移動、新增遮罩或重新生成（第二次填充位於第一次之上）。**✨ Generate Fill in Mask…**（在遮罩中生成填充）在圖層遮罩內執行同樣的操作（白色 = 生成區域）：結果會獲得該遮罩的一份副本。每種操作各佔一個復原步驟。

**圖案庫**——安裝資料夾中的 patterns/<name>.png，所有專案共享（把 .png 檔案複製進去即可共享）。**Edit ▸ Define Pattern…**（定義圖案）按畫面目前的樣子，取選取範圍的外框範圍（或整個畫面）建立一個圖案。**Edit ▸ Pattern Library…**（圖案庫）顯示所有圖案：▦ = 新增 Pattern 填充圖層，✕ = 刪除，⤒ Import PNG…，＋ Define Pattern…。**Layer ▸ New Fill Layer ▸ Pattern…** 是一個即時填充圖層（Properties 中可設定：圖案、Scale %、偏移）；**Edit ▸ Fill… ▸ Contents: Pattern** 用圖案填充選取範圍；**Layer Style ▸ Pattern Overlay** 將它們以 user:<name> 的形式列在內建圖案旁邊。.bgi 檔案會把其使用的圖案儲存在檔案內部，並在開啟它的電腦上把這些圖案新增到圖案庫。

## 專案檔案：.bgi、.bgv、.bgp（2.436.0）
<!-- en: project-files-bgi-bgv-bgp-2-436-0 49a9a31f5402 -->

bitGen 現在有了自己的檔案格式——分別用於圖片、影片剪輯和整個專案，每種都按原樣完整儲存，再次開啟後即可繼續工作。

**.bgi——影像編輯器的專案**（File ▸ **Save Project (.bgi)** Alt+Ctrl+S、**Save Project As (.bgi)…**、**Open Project (.bgi)…**、**Open Project from Project…**；使用 Open… / Ctrl+O 或把 .bgi 拖放到編輯器上也能開啟）。所有內容都保持可編輯：圖層和圖層組、遮罩、文字 / 形狀 / 填充 / 調整圖層、圖層樣式、混合模式、鎖定和標籤、智慧型物件及其內容、智慧型濾鏡和濾鏡遮罩（包括液化）、路徑、Alpha 通道、選取範圍以及圖層複合。復原歷史會從頭開始。它是一個 zip 壓縮檔：doc.xml（以 XML 表示的文件）、preview.png（畫面）以及每個圖層 / 遮罩各一個 PNG——任何解壓縮工具都能開啟。檔案儲存在專案的 **bgi** 資料夾中（勾選 "also download it" 可另外下載一份副本）；Save Project 會直接再次儲存到同一檔案，不再詢問，第一次儲存時會要求輸入名稱。

**.bgv——影片專案**（時間軸工具列上的 🎞）。**💾 Save** 將目前開啟的時間軸——每個圖層、片段、關鍵影格、效果、字幕、標記和設定——寫為 XML，同時包含其巢狀片段所用的巢狀時間軸，以及它所播放媒體的清單（並註明每個媒體當時是否存在）。儲存在專案的 **bgv** 資料夾中（需要時另外下載一份）。**📂 Open a .bgv**（從電腦或專案的清單中選擇）會先顯示其中的內容——片段、圖層、巢狀時間軸、本專案沒有的媒體——然後 **Open it** 將其作為本專案的一個命名時間軸並切換過去。只有當專案中沒有同名的巢狀時間軸時才會新增（你自己的時間軸永遠不會被覆蓋）。如果某個片段的檔案在專案中缺失，該片段仍保留在時間軸上，一旦把檔案新增到素材中即可播放。

**.bgp——整個專案**（選單列中 💾 旁邊的 📦）。XML 格式：專案的狀態、時間軸、聊天和設定均可直接閱讀；媒體以 base64 儲存。**Self-contained**（自包含）把所有內容（包括媒體）都放進檔案裡——一個檔案即可把專案搬到另一臺電腦。**Manifest only**（僅清單）保留專案檔案，並列出媒體在本機上的位置——體積小，適合備份工作成果。對話方塊會顯示每種方式的檔案大小；bitGen 可以重新生成的快取和預覽預設不包含，除非勾選（垃圾桶始終不包含）。**💾 Save…** 會詢問儲存位置（Save As 對話方塊）。**📂 Open a .bgp…** 將其作為一個新專案開啟（絕不會覆蓋現有專案；名稱可以自行修改）——**📂 Open it now** 切換到該專案。清單中列出但本機上不存在的媒體會逐一列出名稱。兩種方式都採用串流處理，因此幾 GB 的專案也沒有問題。

## 儲存的主題和 PDF 字型（2.435.0）
<!-- en: saved-themes-and-pdf-fonts-2-435-0 7a8e73547c0d -->

**Settings ▸ Themes ▸ Customize**：為主題的每個部分設定顏色（背景、面板、凸起面板、線條、文字、暗淡文字、OK 綠色、錯誤紅色、停留、畫布、選取）——應用程式（以及影像編輯器）會立即改變；修改過的顏色會有標記；**↺ The theme's colours** 可復原這些修改。

**儲存的主題**：輸入名稱，點選 **💾 Save theme**——主題會寫入安裝資料夾中的 **themes\<name>.json**（包括顏色、強調色、UI 大小以及其基於的主題），並以卡片形式顯示在下方。點選卡片即可載入，✕ 刪除該檔案。**⤓ Export** 將主題下載為 .json，**⤒ Import** 使用一個 .json 主題（之後用 💾 Save theme 儲存它）。把 .json 檔案複製到 themes 資料夾即可在多臺電腦之間共享。

**PDF ▸ Save PDF… / Save as New PDF…**（影像編輯器的 Pages 欄，或 File 選單）：儲存對話方塊中有 **Embed fonts**（嵌入字型；預設開啟，設定會被記住）：每一行文字都以其自身字型寫為真正的文字，並嵌入 PDF，只包含用到的字元。字型檔案來自本機字型（Windows、macOS、Linux 字型資料夾）或安裝目錄下的 **fonts** 資料夾（把 .ttf / .otf 放進去即可）。任何文字系統都保持為真正的文字。如果某個字型不在本機上，或缺少某個字元，則會像以前一樣回退到 PDF 的標準字型（拉丁字母）或併入頁面影像。關閉 = 僅使用標準字型。

## 主題和 UI 大小（2.432.0）
<!-- en: themes-and-the-ui-size-2-432-0 efcae0e6b7b2 -->

**Settings ▸ Themes**：

- **Theme**（主題）：Dark（bitGen 自有主題）、Darker（OLED 純黑）、Slate（冷藍灰）、
  Light、High contrast。整個應用程式都會隨之改變——面板、對話方塊、影像編輯器（其 bitGen 主題由相同的顏色構建；編輯器中的 Window ▸ Theme
  仍可單獨為編輯器選擇 Pro / Studio / Classic）。
- **Accent colour**（強調色）：為按鈕、點亮的分頁和滑桿選擇任意顏色，替代主題內建的顏色；Reset = 恢復主題的顏色。
- **UI size**（UI 大小）：一個滑桿同時調整所有字型和所有面板，範圍 60 % 到
  175 %（它從 General 移到了這裡；左側面板角落的滑桿也是同一個）。

主題、強調色和大小儲存在此瀏覽器中，並在頁面繪製之前就已生效，因此淺色主題絕不會先閃現深色。

## PDF：指南和宣傳冊（2.392.0）
<!-- en: pdfs-the-guide-and-the-brochure-2-392-0 3de91c4d4405 -->

`docs/bitGen-Studio-Guide.pdf` 是本指南外加一頁所有快捷鍵的總覽。
`docs/bitGen-Studio-Brochure.pdf` 是 bitGen Studio 的 3 頁宣傳冊。兩者都使用工作室的深色主題。

## 時間軸畫布上的 3D 文字和 3D 模型
<!-- en: 3d-text-and-3d-models-on-the-timeline-canvas fa22b48a2287 -->

- **🧊**（位於畫布工具列中 **T** 的下方）可新增 **3D text**（3D 文字）或 **3D model**（3D 模型；
  .fbx 或 .obj——選擇 OBJ 時請同時選取其 .mtl 和紋理），或專案中的某個模型。也可以把 .fbx / .obj 檔案直接拖放到畫布上。
- 可以像任何圖層一樣移動、縮放、旋轉和淡入淡出；◆ 關鍵影格同樣有效。它自己的設定：文字、字型、深度、倒角、顏色、金屬度、粗糙度、光照、Rot X / Y /
  Z（可設關鍵影格）和 Spin（每秒旋轉的度數），以及其畫面尺寸和時長。
- 畫布會即時顯示它；執行 **⚙ Compile** 時，它會被自動烘焙為透明背景影片（如果仍有待完成的烘焙，Compile 會等待）。

## 生成進度
<!-- en: generate-progress d6c829345630 -->

**Generate** 按鈕上方：目前任務的步數（將滑鼠停留其上可檢視詳情）。下方：進度列，僅在任務執行時顯示。

## 專案、佇列和相簿
<!-- en: projects-queue-and-gallery c9e2c1e30e5d -->

- **主題出錯時**（2.636.0）——**Ctrl+Alt+S** 可在任何地方開啟 Settings（即使正在輸入，即使
  ⚙ 已經不見了）；**Ctrl+Alt+Shift+T** 啟用內建的 **bitGen Default** 主題（Dark、其內建的強調色和顏色、無元素樣式、UI 大小 100 %），點選 Settings ▸ Themes 中的 ⟲ bitGen Default，或在工作室位址後加上
  `?theme=default` 開啟，效果相同。原來的主題會被保留：Settings ▸ Themes ▸ ↶ The theme before。
- **Assets: 📁 Project | 🌐 Global | All**（2.635.0，Assets 面板標題列中的下拉式方塊）——專案素材位於
  `projects\<name>\Assets\`，全域素材（每個專案都能用）位於 `projects\Assets\`（與你的各個專案並列；它本身不是專案）。新上傳的檔案進入專案的 Assets 資料夾（當面板顯示 Global 時則進入全域資料夾）。
  **Assets 資料夾中的子資料夾就是一個組**——可在檔案總管中或用 📁＋ 建立；➜ Send to 將檔案移入該資料夾，＋ Add to 則同時在那裡放置一個連結，⊖ 將其放回原處，刪除組會把其中的檔案移回（不會刪除任何檔案）。**右鍵點選圖塊**（或所選內容）：🌐 **Move to Global** / 📁 **Move to Project**、🗂 New group、🗑
  Delete。每個素材還會連結到專案的 `images\` / `video\` / `sound\` 資料夾（硬連結——不佔用額外磁碟空間），因此所有按名稱使用素材的地方都能照常工作；只存在於這些資料夾中的檔案（舊專案、渲染結果）會顯示為未分組的專案素材，舊的面板分組也已變成資料夾。
- **＋ New / 📂 / 💾**（視窗頂部的選單列）——專案。所有內容都位於
  `projects\<name>\`（`output\`、`video\`、`images\`、`sound\`、角色、場景）。
- **Queue**（佇列）——GPU 上一次只執行一個任務；可暫停、中止（Abort 對話方塊）和重試；每個任務都保留日誌。**🧹 Clear**（位於 Queue 的標題列中，兩個分頁都有）從清單中移除所有已結束的任務——包括已完成、失敗和已取消的；按鈕上的數字表示數量。排隊中或正在執行的任務不受影響，也不會刪除任何檔案。
- **Gallery**（相簿）——所有渲染結果；點選可預覽，可拖到參考圖、時間軸或場景上。

## 素材分組和刪除
<!-- en: grouping-and-deleting-assets dd2ea1d1564d -->

Assets 面板可以把專案的檔案整理成**組**——只存在於面板中的資料夾。檔案本身從不移動，因此使用它們的每個場景、時間軸片段和參考圖都能照常工作。

![Assets dock with a group](images/asset-groups.png)

- **選擇**——勾選圖塊角落的核取方塊，Ctrl+點選（Mac 上為 ⌘），或 Shift+點選選擇一個範圍。選取內容後，普通點選即可新增或移除圖塊；Ctrl+A 選擇整個分頁，Esc 清除選擇。未選取任何內容時，點選仍會開啟燈箱檢視。
- **📁＋** 建立一個空組。**🗂 Group** 新增一個包含所選內容的組。
- **＋ Add to ▾** 把所選內容*同時*放入某個組——一個素材可以位於多個組中。
- **➜ Send to ▾** 則是*移動*：從選取時所在的組移出，移入新組。也可以把圖塊拖到某個組的標題上（放下時按住 Ctrl 則改為新增）。
- **⊖** 將所選內容從選取時所在的組中移出。
- 組標題上的 **⋯**：Rename、Select all、Delete group（其中的素材會保留）。點選標題可將其摺疊。
- 一個組可以同時包含圖片、影片和聲音——每個分頁顯示該組中對應類型的專案。
- **🗑**（或 Delete 鍵）把所選內容移到 `projects/<name>/recycle_bin`——絕不會徹底刪除。當 *Settings → General → Confirm delete* 開啟時，或專案仍在使用其中某個檔案時，會先詢問。

組按專案分別儲存在 `projects/<name>/asset_groups.json` 中。

## 用 + 圖塊新增檔案（2.394.0）
<!-- en: adding-files-with-the-tiles-2-394-0 135ae13f2352 -->

虛線框的 **+ add** 圖塊會開啟下文介紹的檔案對話方塊，無需拖放即可新增檔案：

- **References → Video**：**+ add videos**，位於參考影片下方。
- **References → Sound**：**+ add sounds**，位於參考聲音下方。
- **Assets → Image / Video / Sound**：**+ add pictures / videos / sounds**，位於清單頂部。

可以像在 Windows 11 中一樣一次選擇多個：**Ctrl+點選**新增或移除一個檔案，**Shift+點選**選擇一個範圍，**Ctrl+A** 全選。點選
**Open** 即可新增。

所選的所有檔案都會進入專案的 Assets。從 References 圖塊新增時，這些檔案還會成為參考，最多達到模型的上限：三個影片和三個聲音。放不下的檔案仍留在 Assets 中，分頁上方的提示行會告訴你。圖塊會顯示剩餘的位置數，例如
**+ add videos (2 free)**，清單滿時圖塊會消失。

也可以讓圖塊獲得焦點後按 **Enter**，或把檔案拖放到圖塊上。

## 檔案對話方塊
<!-- en: the-file-dialog 150f11e04ae6 -->

![The file dialog](images/file-dialog.png)

路徑旁的每個 **📁** 和每個 *Choose file* 按鈕都會開啟 bitGen Studio
自己的 Open / Select Folder 對話方塊——在 Windows、macOS 和 Linux 上完全相同：

- **Navigation pane**（導覽窗格）——Quick access（你真實的 Desktop、Downloads、
  Documents、Pictures、Videos、Music）、bitGen Studio（應用程式資料夾、目前專案、ComfyUI）以及顯示每個磁碟機可用空間的 This PC。
- **Address bar**（位址列）——點選資料夾名稱即可跳轉到那裡，或點選空白處輸入路徑。**← → ↑ ↻** 分別為後退、前進、向上和重新整理。
- **Search**（搜尋，右上角）——在目前資料夾及其所有子資料夾中查詢名稱；
  `*` 和 `?` 可用作萬用字元。
- **☰ Details / ▦ Large icons**——可排序的 Name / Date modified / Type / Size
  欄，或圖片和影片的縮圖。
- **＋ New folder** 和 **✎ Rename**（F2）；右鍵點選可使用 Open、Rename、Copy
  path、New folder 和 Refresh。
- **File name**（檔名）——輸入名稱、完整路徑、資料夾名稱（進入該資料夾）或
  `*.png` 這樣的模式（進行篩選）；檔案類型清單就在它旁邊。
- **多個檔案**（在支援多選的按鈕處）：Ctrl+點選和 Shift+點選。
- 按鍵：Enter 開啟，Backspace / Alt+↑ 向上一級，Alt+← / Alt+→ 後退 / 前進，
  F5 重新整理，直接輸入可跳轉到對應名稱，Esc 取消。

該對話方塊讀取的是**本**機上的檔案，因此它只替換應用程式視窗或同一臺機器上瀏覽器中的檔案選擇器——手機遙控端仍使用手機內建的選擇器。
**Settings → General → Use bitGen Studio's file
dialogs** 可將 *Choose file* 按鈕切換回瀏覽器的選擇器。

## 中文與日文版指南與說明（2.703.0）
<!-- en: the-guide-and-help-in-chinese-and-japanese-2-703-0 71defce43e4e -->

指南（📖 **Help**（說明）視窗，以及 **Ctrl+K** 能找到的指南項目）、❔ 說明頁面和快捷鍵清單現在也提供**简体中文**（中國大陸）、**繁體中文**（台灣與香港，2.704.0）和**日文**（日本語）版本。應用程式本身的按鈕、選單和面板仍為英文，因此譯文中的介面名稱保留英文——你讀到的就是螢幕上顯示的。

- **選擇語言**：在 📖 Help 視窗頂端的下拉式選單中，或在 ❔ 說明頁面的標題列中選擇（**English** / **简体中文** / **繁體中文** / **日本語**）。兩處共用同一個設定，並會被記住。在你選擇之前，會依照電腦的系統語言顯示。
- **Ctrl+K** 會以所選語言搜尋指南，同時仍能用英文名稱找到對應的部分。
- 英文為原文。如果某個部分在翻譯之後英文版又有更新，譯文頂端會提示這一點，並提供一個檢視英文版的按鈕。尚未翻譯的部分會以英文顯示，並附上說明。
- **各語言的指南 PDF**：docs/bitGen-Studio-Guide-zh-CN.pdf、docs/bitGen-Studio-Guide-zh-TW.pdf 和 docs/bitGen-Studio-Guide-ja.pdf。
- 譯文檔案與英文檔案放在一起：docs/i18n/zh-CN/、docs/i18n/zh-TW/ 和 docs/i18n/ja/（USAGE.md、shortcuts.json），以及 static/help/zh-CN/、static/help/zh-TW/、static/help/ja/。繁體中文版由簡體中文版轉換而來（`python3 scripts/i18n-zhtw.py`，採用台灣用語），之後再經人工校讀。執行 `node scripts/i18n-help.js status zh-TW` 可列出已過時的內容。

## 應用程式本身的中文與日文版（2.705.0）
<!-- en: the-app-itself-in-chinese-and-japanese-2-705-0 d6320f6eb1c4 -->

選單列上 ⊞（面板版面配置）左邊的下拉選單可以切換應用程式本身的語言：**English** / **简体中文** / **繁體中文** / **日本語**。按鈕、選單、面板標題、分頁、設定、提示訊息以及空白輸入框中的提示文字會立即切換——不需要重新啟動，切回英文後所有文字都會恢復原狀。

- 它與 📖 說明指南和 ❔ 說明頁面的語言是同一個設定：變更其中一個，另一個也會跟著改變。
- 本版本翻譯了主視窗。影像編輯器、時間軸、📏 草圖建模和 CAD 面板仍為英文（將在之後的版本翻譯）；應用程式執行時即時產生的文字（例如含有數字或檔名的狀態訊息）也仍為英文。
- 譯文指南中提到的按鈕名稱與翻譯後的應用程式介面一致；介紹各編輯器的章節仍使用這些編輯器目前顯示的英文名稱。
- 介面文字來自 static/i18n/ui/<語言>.json。執行 `node scripts/i18n-ui.js status zh-TW` 可查看已翻譯的數量。

## 語言包（2.715.0）
<!-- en: language-packs-2-715-0 ec7b69eda5ac -->

除英文外，每種語言都是一個**語言包**：包含應用自身的文字、指南、❔ 說明頁面、快捷鍵列表和功能列表。简体中文、繁體中文和日本語為內建語言；無需新版本的應用即可新增更多語言。**Settings ▸ Languages** 列出所有語言包及各自的翻譯進度。

- **⤒ Install a pack** 從語言包的 .zip 新增語言。會先進行檢查；已有的語言在替換前會先詢問（內建語言的語言包會替代內建版本，直到你移除該語言包）。
- 新語言會立即出現在 ⊞ 旁的下拉選單中。語言包中未翻譯的內容以英文顯示。
- **✕ Remove** 移除已安裝的語言包（內建語言會恢復）。
- **⤓ Master pack** 包含全部英文內容，並附 TRANSLATING.txt 說明如何填寫每個檔案 - 用於將 bitGen Studio 翻譯成新語言。在 pack.json 中填入語言代碼和名稱，儘量翻譯（ui.json 中應用的文字效果最明顯），然後壓縮為 .zip 並安裝。
- **⤓ Export for translating** 會返回語言包，補入此後應用新增的部分並保留其譯文 - 用於繼續翻譯，或改進內建語言。
- 已安裝的語言包儲存在安裝目錄的 langpacks 資料夾中。語言包中的說明頁面只保留簡單的格式。
- **Shared by the community**（2.716.0）列出其他人翻譯的語言包，來自 tigerart.com.au 上的 bitGen 社群——每個語言包在顯示之前都經過管理員檢查。點選 **⤓ Install** 即可一鍵安裝。
- 在已安裝的語言包上點選 **⇪ Share**，會以你的身份傳送到社群（需先登入 💬 Community），並可附上給管理員的留言。管理員檢查後即對所有人顯示；**Your shared packs** 顯示每個語言包的狀態，✕ 可將其撤下。網站的語言包頁面（tigerart.com.au/languages.php）列出相同的語言包，提供主語言包下載，也可以上傳。

## 更快的首幀與加速修正（2.717.0）
<!-- en: faster-first-frames-and-the-speed-up-fixes-2-717-0 d7efaedbbd01 -->

一位測試者在一張 RTX 3090 上測量了 bitGen 的加速選項（同一張圖、同一個 seed、兩位盲評評審）。改動如下：

- **場景卡片上的 ✎ First frame**：樣式列表以 **Auto** 開頭。安裝了 Qwen Image Edit 2511（完整包——20 GB 的模型）時，Auto 用它的 Lightning LoRA 以 4 步生成首幀，而不是 Qwen Image 2.1 的 25 步。需要三張以上圖片（底圖、角色、道具）的首幀仍交給 Qwen Image 2.1 edit，提示中會說明。在列表中選一個樣式，就會一直使用它。
- **Qwen Image 2.1 edit Turbo8**：新的影像樣式——藉助社群的 Turbo8 LoRA，Qwen Image 2.1 只需 8 步（Settings ▸ Models ▸ Model catalog ▸ Qwen Image 2.1 Turbo8 LoRA）。細小密集的文字比 25 步時差；標題和標籤沒問題。
- **許可證**：Qwen Image 2.1 和 Turbo8 LoRA 採用 Qwen Research License——僅限非商業用途。Qwen Image Edit 2511 及其 Lightning LoRA 為 Apache 2.0——可以商用。這就是 Auto 優先使用 2511 的原因。
- **Veda** 會跳過提示詞描述打鬥、變形、爆炸或追逐的鏡頭：測試發現這類鏡頭只快 22%，畫面還會變軟。影片樣式中的 **Veda on action shots too** 讓每個鏡頭都使用 Veda。
- **Veda 與 Long video**：Veda 現在取代 Long video 的低視訊記憶體注意力（一個 12 秒的長鏡頭快了 65%）。如果很長的鏡頭視訊記憶體不足，請為它關閉 Veda。
- **Spectrum** 在 12 步以上的執行中，前 2 步和最後 3 步都真實計算——最後幾步負責繪製臉部和細節，預測這些步驟會讓它們變糊。
- Long video 仍不使用 Sage 注意力：在它之上加 Sage 只快了 17%。

## 找不到模型——渲染前先檢查（2.719.0）
<!-- en: models-not-found-checked-before-a-render-2-719-0 44e1694bba66 -->

圖片、影片或歌曲開始渲染之前，bitGen 會檢查它要載入的每個模型檔案是否在 ComfyUI 的某個模型路徑中：工作流自帶的模型、文字編碼器、VAE 和放大模型，以及樣式的模型、VAE、文字編碼器和 LoRA（開啟 Override style 時，還包括 Basic Settings 的模型和 LoRA）。

- 檢查很快：它讀取 bitGen 已找到的所有模型檔案的清單，儲存在 **misc/models_found.json**（ComfyUI 的 `models` 資料夾，以及它的 extra_model_paths.yaml 中的每個路徑）。當某個名稱不在清單中（你可能剛剛加入了這個檔案）、ComfyUI 的資料夾改變，或你在 🧩 Models 中按下 ⟳ 時，清單會重新生成。同名檔案在其他子資料夾中也算找到。
- 缺少檔案時，會彈出 **Models not found** 對話方塊，逐個列出：檔名、它應放入的資料夾，以及它來自哪裡（工作流、樣式或 Basic Settings）。bitGen 模型目錄中有的檔案會顯示大小和下載來源；**⬇ Download** 會下載這些檔案（使用 Settings ▸ Models 中儲存的 Hugging Face token），每個檔案一個進度列，然後再檢查一次——全部到位後渲染會自動開始。不在目錄中的檔案會註明這一點：請自行下載（Civitai、Hugging Face）到顯示的資料夾中。
- **Cancel**（或 Esc、Enter）不會開始渲染。已經開始的下載會繼續進行——在 Settings ▸ Models 中可以看到。佇列中等待、缺少相同檔案的渲染會直接停止，不再重複詢問。
- 不論從哪裡開始的渲染都會檢查：提示詞面板的 Generate、影像編輯器的 ✨ AI（Edit、Compose、Regenerate——包括從 References 面板的圖片開始的）、StoryBoard、角色、時間軸和音樂面板。取消後，開始渲染的地方會顯示沒有渲染。🩺 Style doctor 不會被攔下：它會在自己的表格中報告缺少的模型。
- 仍然中途停止的渲染（2.720.0）——它的 worker 以錯誤退出——也會被檢查：ComfyUI 拒絕的模型名稱，以及它的樣式載入的檔案。如果有檔案不在模型路徑中，會彈出對話方塊詢問 **The render stopped: … Download it?**，同樣提供 ⬇ Download / Cancel。下載完成後，在 Queue 面板中對該任務按 ↻ Retry（或再按一次 Generate）。這能發現渲染前的檢檢視不到的情況：自訂節點的模型、StoryBoard 自行渲染的場景、Swap、LTX 以及 Wan 自己挑選的檔案。
- 不檢查的情況：另一臺電腦上的 ComfyUI（Remote GPU）、沒有設定 ComfyUI 資料夾、sd-cli 樣式，以及 Wan 或 LTX 樣式自行挑選的檔案。

## 僅在模型改變時釋放顯示記憶體（2.722.0）
<!-- en: free-vram-only-when-the-model-changes-2-722-0 d847cda123ca -->

**Settings ▸ ComfyUI ▸ Free VRAM before a generation** 現在多了 **Free it**：**when the model changes**（預設）或 **before every generation**（與以前相同）。

- 模型改變時：使用同一模型的一串渲染會把它留在顯示卡上——中間不解除安裝、不重新載入，連續的圖片和片段開始得更快。下一次渲染載入其他模型檔案時，會先釋放顯示卡；主控台會說明是哪一種情況（“VRAM kept: the same model(s) …”或“the model changed”）。
- 顯示記憶體不會越積越多：ComfyUI 對已載入的模型只保留一份並重復使用，渲染的工作記憶體在結束時釋放，下一個流程需要空間時 ComfyUI 會自行釋放。
- 發生顯示記憶體不足的錯誤（或 ComfyUI 停止）之後，下一次渲染無論使用什麼模型都會先釋放顯示卡。
- Before every generation 是以前的做法：每次渲染都從空的顯示卡開始（在混合使用之後渲染長片段時最穩妥）。取消勾選開關則完全交給 ComfyUI 管理。

## 浮動面板：最後使用的在最上面（2.724.0）
<!-- en: floating-dockers-the-one-you-used-last-is-on-top-2-724-0 435239010efb -->

現在所有浮動面板在應用程式其餘部分之上共用一個順序：💬 Community、Basic Settings、LLM tokens、▣ 面板、用 **⊞ Docker configs ▸ ▣ New docker…** 建立的面板、用 ⇱ 浮動的主面板、時間軸的舞台面板和語音聊天。

- **點擊一個浮動面板**的任何地方（標題列、按鈕、裡面的輸入框），它就會到最上面。用鍵盤進入它也一樣。
- **打開一個面板**時（狀態列上的 💬 Community、Basic Settings 的 S、▣ 面板的按鈕）它也會到最上面。以前，用 ▣ New docker… 建立的面板總是遮住 💬 Community。
- 浮動面板位於已停靠的面板和狀態列之上，位於選單、彈出選單和訊息框之下。
- 再次停靠的面板（旁邊、裡面或欄中）會離開這個順序，再次浮動時回到最上面。
- 提示詞面板保留自己的規則：Ctrl+P 會把它提到遮住它的東西之上。

## 預覽中的歌曲：視覺化效果，Next 播放下一首（2.725.0）
<!-- en: a-song-in-the-preview-a-visualization-and-next-plays-the-next-song-2-725-0 6b82839293f0 -->

在 Gallery、Assets ▸ Sound 或 References 中點擊一首歌或一個聲音，它會在預覽中打開，就是點擊圖片時顯示圖片的那個視窗。在 **Gallery 的 Audio 分頁中按歌曲自帶播放器的 ▶**，也會在那裡打開並已經開始播放（2.725.1）。

- **▶ 會開始一個視覺化效果**，隨機選擇：頻譜條、鏡像條、波形、圓環、穿越星空或漣漪。它隨音樂變化，每首歌的效果都和上一首不同。
- 播放器旁邊的 **🎲** 可以在播放時換一個效果。暫停時，畫面靜止並變暗。
- **Next ›、‹ Prev、畫面上的箭頭和 ← →** 會跳到**你點擊它的那個面板裡**的下一首或上一首**歌**並播放。中間的圖片和影片會被跳過，最後一首之後從第一首重新開始。
- 在圖片或影片上，它們和以前一樣在清單中翻頁，不會自動開始播放。底部的縮圖列仍然可以打開任何項目。
- 關閉預覽會停止歌曲。Preview 面板（狀態列上的按鈕）不受影響。

## Neural blue 主題和 bitGen 大腦圖片（2.726.0）
<!-- en: the-neural-blue-theme-and-the-bitgen-brain-picture-2-726-0 120e0f818af3 -->

- **Settings ▸ Themes ▸ Neural blue** 會把工作室變成午夜海軍藍配電光藍強調色，也就是 bitGen 大腦圖片的顏色。Dark（虎橙）仍是預設主題，你自己選的強調色也照樣可以用在它上面。
- **啟動時**，應用程式會隨機顯示兩個啟動畫面之一：片頭影片，或帶製作人員名單的大腦圖片（8 秒）。點擊或按任意鍵都可以跳過。
- **新安裝**會在第一個專案的 Assets ▸ Images 中放入這張大腦圖片，這樣影像編輯器、✨ AI 編輯和圖生影片馬上就有圖片可以試。之後建立的專案是空的，你也可以像刪除其他圖片一樣刪除它。
- 網站（tigerart.com.au）每個頁面底部的 **Colours** 中也有同樣的 Neural blue 外觀。

## 大腦活了起來；放大後卻還是原影片的問題（2.727.0）
<!-- en: the-brain-comes-alive-upscales-that-came-back-as-the-source-2-727-0 5d0437f7fc70 -->

- **啟動畫面中的大腦圖片現在是一段影片**：閃電擊中 bitGen 大腦，一道閃光後出現巨大的 bitGen Studio 標題，共 15 秒，製作人員名單疊加在畫面上。如果影片無法播放，仍會顯示原來的圖片。和以前一樣，按一下或按任意鍵即可略過。網站首頁也播放同一段影片。
- **已修正：放大可能會把你給它的影片原樣交回。** 自 ComfyUI 2026 年 8 月的更新起，Load Video 節點會把它載入的檔案顯示在 ComfyUI 的結果中，並且排在真正的結果前面。bitGen 曾把它當作完成的影片，因此放大到 1080p 的 ⏫ SeedVR2 可能會以原影片的尺寸傳回，檔名裡卻帶著 *_seedvr2_1080p*。現在 bitGen 會略過 ComfyUI 只是回顯的檔案。同樣的修正也適用於 RTX Video、DLSS 5、LTX、Viggle 和工作流程算繪。
- **SeedVR2 會檢查拿到的尺寸。** 檔案依它的實際尺寸命名。如果 ComfyUI 交回的是原影片的尺寸，工作會停止並說明原因，而不是寫出一份副本。對於此修正之前做出的影片，請再執行一次放大，以取得真正的 1080p 版本。

## 正好 1920 × 1080，以及 RelayVSR（2.728.0）
<!-- en: 1920-1080-exactly-and-relayvsr-2-728-0 79626240c53c -->

- **1920 × 1080（正好 16:9）** 是 ⏫ SeedVR2、🔁 RelayVSR 和影片停駐欄 ⚙ **放大解析度** 中的新尺寸。不完全是 16:9 的片段（例如 960x544 的 LTX 算繪）會被放大到完全覆蓋 1920 × 1080 的畫面，再把上下多出的幾行裁掉。1080p 仍然保留整個畫面（960x544 放大為 1906x1080）。DLSS 5、RTX VFX 和算繪中的放大器會把 1920 × 1080 當作 1080p。
- 預覽列中的 **🔁 RelayVSR** 用 RelayVSR 放大正在預覽的影片，這是一種一步完成的快速影片放大器。它在 ComfyUI 內建的節點中執行，所以不需要另外安裝任何東西。選好尺寸後按 **🔁 Upscale**；結果會帶著原來的聲音放進圖庫。
  - **Model**：RelayVSR 有兩對檔案。**x2**（LightX2V 出品，用 MiniMax H3 片段訓練）適合 H3 或 LTX 算繪。**x4** 能把小片段放大到 4K。**auto** 會選擇能達到所選尺寸的較小那一對。
  - **Detail**：1 保留模型加上的全部細節；數值越低越接近普通放大。
  - 影片停駐欄的 ⚙ **放大器** 中也有 **RelayVSR**：場景的 ⏫（以及 **每次算繪都放大**）會依 ⚙ **放大解析度** 使用它。
- **準備**：RelayVSR 需要比 v0.44.0 版本更新的 ComfyUI（設定 ▸ ComfyUI ▸ ⤓ 更新 ComfyUI，選 "latest" 通道，然後重新啟動 ComfyUI）。設定 ▸ 附加元件 ▸ **RelayVSR** 會下載這些檔案（預設勾選 x2；每對約 5.3 GB）。缺少其中任何一項時，面板會提示。

## NitroFusion2：一步出圖（2.729.0）
<!-- en: nitrofusion2-pictures-in-one-step-2-729-0 df99414524e6 -->

- **NitroFusion2** 是經過訓練、能在一到兩步內完成圖片的 Z-Image-Turbo，文字清晰、細節精細。它在 ComfyUI 內建的節點中執行。有三個圖像風格使用它：
  - **NitroFusion2**：一步。最快，建議先用這個。
  - **NitroFusion2 2-step**：兩步，第一步加上作者的去蒸餾 LoRA，可以去掉一些偽影。請把步數保持為 2：這兩步是把同一個排程一分為二。
  - **NitroFusion2 GGUF**：用 GGUF 檔案一步出圖，適合小顯示卡（預設 Q4_K_M；其他檔案可選為該風格的模型）。
- cfg 保持為 1，沒有負面提示詞。它訓練時的尺寸約為 1 百萬像素（1024 x 1024）。
- 該風格的自訂 LoRA 和其他圖像風格一樣放進四個 LoRA 插槽；去蒸餾 LoRA 保持不變。
- **準備**：設定 ▸ 附加元件 ▸ **NitroFusion2** 會下載你勾選的檔案：模型（12.3 GB）和去蒸餾 LoRA 預設勾選，GGUF 檔案可選，Qwen3 4B 文字編碼器和 FLUX.1 VAE 會隨任何一項一起下載。勾選 GGUF 檔案時也會安裝 ComfyUI-GGUF。

## 🕺 從參考影片取得動作：FlowHMR（2.730.0）
<!-- en: motion-from-a-reference-video-flowhmr-2-730-0 fae293348a4b -->

> **僅限非商業用途。** FlowHMR 的程式碼是免費的（Apache-2.0），但沒有 SMPL-H 人體模型以及 Meta 的 SAM 3D Body 和 VGGT-Omega 就無法執行，而這些的授權不允許商業使用。用它捕捉的動作只供個人或研究使用。

- 預覽列中的 **🕺 動作** 會讀取正在預覽的影片，以 3D 方式捕捉其中人物的動作。結果是帶動畫的骨架（**.fbx**）和同一動作的 SMPL-H（**.npz**），以 *<影片名>_motion* 儲存在專案的 **models3d** 資料夾中。時間軸的 3D 圖層、Blender、Daz 和 Unreal 都能使用 .fbx。
- **鏡頭**：**moving** 會推算鏡頭的移動，讓人物在場景中的路徑正確；**still** 用於固定在三腳架上的鏡頭，最省資源。**鏡頭估計間隔** 每 1 格最準確，但約需 30 GB 顯示記憶體；每 10 格則輕得多。
- **準備**：設定 ▸ 附加元件 ▸ **FlowHMR 動作捕捉**。安裝會把 FlowHMR 放進它自己的 Python 環境並下載模型，但有三樣東西需要你先準備：
  - **SMPL-H 人體模型**：在 mano.is.tue.mpg.de 註冊，下載 Extended SMPL+H model，把其中 neutral 的 *model.npz* 放到附加元件指明的位置；
  - **VGGT-Omega** 和 **SAM 3D Body**：在它們的 Hugging Face 頁面申請存取，並在設定中填入你的 Hugging Face 權杖。連結都在附加元件的卡片上。準備好後再安裝一次：它會告訴你還缺什麼。
- 需要 NVIDIA 顯示卡和應用程式的 Python 3.10 - 3.12。沒有 FBX SDK（只能在 Python 3.10 上安裝）時只會得到 .npz。

## 🎼 五線譜上的樂譜，並儲存為 PDF（2.731.0）
<!-- en: sheet-music-on-the-staff-saved-as-a-pdf-2-731-0 c1f81888c457 -->

- Music 面板的 **🎼 Sheet Music** 分頁把樂譜畫成真正的五線譜：帶譜號的五線、調號和拍號、帶符桿、符尾和符槓的音符、休止符、變音記號、延音線和圓滑線、旋律上方的和弦名稱，以及歌曲的段落（Verse、Chorus …）以方框標出。YuE2 的樂譜有兩行譜表——人聲旋律和樂器聲部，用括號連在一起。
- 樂譜從哪裡來：**🎼 Write sheet from lyrics**、**📜 Transcribe audio**、**Score** 清單（專案中的每個 .abc，最新的在前；每首歌都會把樂譜儲存在音訊旁邊，開啟分頁時會畫出最新的一份），或用 **📂 Open .abc** 開啟這台電腦上的檔案。**↻** 尋找新的樂譜。
- **⛶ Read** 以全尺寸開啟各頁。**‹/› ABC text** 顯示畫出樂譜所依據的記譜，**⧉ Copy** 複製它。
- **💾 Save PDF** 把各頁儲存為 A4 的 PDF，以歌名命名，放在專案的 **pdf** 資料夾裡（影像編輯器的 File ▸ Open PDF from Project 也會列出它）。勾選 **download too** 時還會同時下載。PDF 只使用每個 PDF 閱讀器內建的字型，因此不嵌入任何內容；標題裡這些字型沒有的文字（中文、日文）會顯示為 ?。
- 製譜引擎是 bitGen Studio 自己的一部分，不是外部函式庫。除了 YuE2 自己的樂譜，它也能讀一般的 ABC 曲譜：和弦、三連音、附點節奏、反覆和反覆結尾、調號和拍號的變化、低音譜號、中音譜號和次中音譜號。裝飾音和歌詞行不會畫出。

## 🎨 樂譜下面的紙張（2.732.0）
<!-- en: the-paper-under-the-sheet-music-2-732-0 479328ee4cd2 -->

- Sheet Music 分頁裡的 **🎨 Paper** 會開啟一行選項，用來選擇畫樂譜的紙張。螢幕上的各頁、**⛶ Read** 和儲存的 PDF 都會使用它。
- **Paper colour**：任意顏色，或圓形色樣之一（White、Cream、Antique、Stone、Pale blue、Kraft、Night）。
- **Material**：Plain，或像磁磚一樣鋪滿整頁的質感：Parchment、Linen、Laid paper、Recycled、Watercolour、Canvas 或 Kraft。在 **Pictures** 下可以用專案中的任何圖片，或 **📂 From this computer…**，同樣平鋪（保持其形狀）。
- **Tile size**：一次重複在頁面上的大小，40 到 600 pt（72 pt = 1 英寸）。**Texture**：材質在顏色上顯現的強弱。
- **Ink**：音符、線條和文字的顏色。**Auto** 在淺色紙上用近黑色，在深色紙（Night）上用暖白色；Black、Sepia、Navy 和 White 是固定的。
- **in the PDF too**：取消勾選後，PDF 以白紙黑墨儲存（更適合列印），螢幕上仍保留你的紙張。帶質感的 PDF 只含一張小小的平鋪圖片，由 PDF 閱讀器重複繪製，因此檔案仍然很小。
- **↺ Plain white** 回到初始狀態。你的選擇會記在這台電腦上。

## ⏫ 圖片的 Enhance：放大一張圖片（2.733.0）
<!-- en: enhance-on-a-picture-upscale-an-image-2-733-0 3ec9caf4a12e -->

- 在圖庫的 **Images**、**Image** 素材或參考面板中點擊一張圖片，然後按提示詞面板中的 **⏫ Enhance**。它的提示會說出要放大的圖片。如果你最後點擊的是影片，Enhance 仍然用 SeedVR2 放大影片。
- 面板會顯示這張圖片以及將產生的結果，例如 320×180 → 640×360：
  - **Size**：×2、×3、×4，或短邊 1080、1440、2160 px（保持形狀，每邊最多 8192 px）。
  - **Way**：**SeedVR2** 會恢復細節（需要 ComfyUI、SeedVR2 模型和 VAE——與影片放大器相同的檔案）；**Upscale model** 使用 ComfyUI 的 models/upscale_models 中的檔案（4x-UltraSharp、RealESRGAN …），快速且銳利；**Lanczos** 完全不需要 ComfyUI，但不會增加新的細節。
  - **Model**、**Colour match** 和 **Denoise** 用於 SeedVR2（Model 也用來選擇放大模型）。
- **⏫ Upscale** 把工作加入佇列。結果是圖庫 Images 中名為 *<圖片名>_upscaled_<寬>x<高>.png* 的 PNG。面板會依專案記住你的選擇。

## ▶ 播放樂譜，發聲的音符會亮起（2.733.0）
<!-- en: playing-the-sheet-music-the-notes-lit-as-they-sound-2-733-0 fe90ac659bab -->

- 在 **🎼 Sheet Music** 分頁的樂譜下方：**⏮** 回到開頭，**⏪** 後退一小節（快速按兩次到上一小節），**▶ / ⏸** 播放和暫停，**⏩** 前進一小節，**⏭** 到結尾。旁邊顯示時間和小節號，**⛶ Read** 中也有同樣的按鈕。
- 播放時，正在發聲的音符會以橙色亮起，所在小節有一條淡淡的色帶。勾選 **follow** 時，樂譜會捲動讓該小節保持可見。點擊任意音符即可跳到那裡。
- **Sound**：**🎵 the song** 播放這份樂譜所屬的歌曲（.abc 旁邊同名的音訊檔——在 Music 面板中製作的歌曲都有，Score 清單會給這些樂譜標上 🎵）。**🎹 the notes** 在瀏覽器中演奏寫出的音符，用於沒有歌曲的樂譜（🎼 Write、📂 Open .abc）或檢查寫了什麼。
- **Sync (s)**：小節 1 之前歌曲的秒數，例如前奏。調整到亮起的音符與歌聲對齊為止。每份樂譜都會記住。
- 速度來自樂譜的速度標記（Q:）；沒有速度的樂譜按每分鐘 120 拍播放。

## 🗣 樂譜下方的歌詞（2.734.0）
<!-- en: the-words-under-the-sheet-music-2-734-0 cf22ed45b252 -->

- 在 Sheet Music 分頁勾選 **words**，Song 分頁歌詞框裡的歌詞（正在製作的歌曲）就會放在人聲譜表的音符下方，每個音符一個音節，一個單字的音節之間帶連字號。
- 歌詞按段落對應：歌詞的 **[verse]**、**[chorus]** … 標籤依序對應樂譜的 Verse、Chorus …，再次出現的副歌會再唱一遍同樣的歌詞。沒有段落的歌詞或樂譜從第一個音符開始依序放置。
- 與前一個音符用延音線相連的音符，或圓滑線內的音符，會延續前一個音節。自動分割不對的地方可以自己輸入連字號（se-ven、Hal-le-lu-jah）。中文和日文歌詞每個音符一個字。
- 狀態列會顯示有多少個演唱音符配上了歌詞，以及剩餘多少音節。編輯歌詞後片刻會重新繪製；取消勾選即可去掉。歌詞也會出現在 ⛶ Read 和儲存的 PDF 中（PDF 的字型沒有中文、日文字元，這些會顯示為 ?）。

## 🗣 唱到的歌詞會亮起（2.735.0）
<!-- en: the-words-lit-as-they-are-sung-2-735-0 b45c42a5881f -->

- 勾選 **words** 後，在 Sheet Music 分頁按 ▶：正在唱的音節會在人聲譜表下方亮成橙色，它的音符也一起亮起。
- 一個音節在整個演唱期間都保持亮著——經過與它相連的延音線、它的連線中的音符，以及跨過小節線——到休止符時熄滅。
- 點擊歌詞即從那裡播放，和點擊音符一樣。⛶ Read 中歌詞也會亮起。
- 它和音符使用同一個時鐘：如果樂譜旁邊有歌曲，請調整 **Sync**，讓音符和歌詞對上歌聲。

## 🎼 Sheet Music 分頁的版面（2.736.0）
<!-- en: the-sheet-music-tab-s-layout-2-736-0 fe58fda26898 -->

- 兩條工具列：**製作樂譜**（🎼 Write from lyrics、用來選擇錄音的 🎵 Audio file… - 選中的檔名會顯示在按鈕上 - 以及 📜 Transcribe），和**這份樂譜**（Score 清單、↻、📂 Open .abc、⛶ Read、帶 download too 的 💾 Save PDF、words、🎨 Paper、‹/› ABC text、⧉ Copy）。Write 和 Save PDF 帶橙色邊框，是主要操作。
- 播放器位於樂譜檢視區的頂部：⏮ ⏪ ▶ ⏩ ⏭、時間、小節、Sound、Sync 和 follow。播放時 ▶ 會變成橙色的 ⏸。⛶ Read 中有同樣的按鈕。

## 🎼 聲部與混音：每種樂器和人聲（2.737.0）
<!-- en: parts-and-the-mix-each-instrument-and-the-vocals-2-737-0 76d7483f0fe0 -->

- 有多個譜表的樂譜，在樂譜上方會有**分頁**：**Full score**，然後每個譜表一個（人聲的會有標記）。點一個分頁，就只顯示那個譜表的單獨樂譜，頂部寫著聲部名：鋼琴手的聲部、歌手的聲部（勾選 **words** 時帶歌詞）。⛶ Read 和 💾 Save PDF 使用目前的聲部，PDF 也以它命名（Night Drive - Piano.pdf）。切換分頁時，歌曲的位置保持不變。
- 播放器裡的 **Play** 可以邊聽邊開關：
  - 用 **🎹 the notes** 時，每個譜表一個按鈕：點擊即靜音或取消靜音，**Shift+點擊**只聽這一個（再 Shift+點擊一次恢復全部）；
  - 用 **🎵 the song** 時，歌曲分離成音軌後可使用 **Vocals** 和 **Instruments**。還沒分離的歌曲會顯示 **✂ Separate vocals**：它執行 Stems 面板的分離（demucs，在這台電腦上），完成後出現這兩個按鈕。
- 歌曲只能分成歌聲和其餘部分（分離產生的就是這兩個），所以單獨開關各個樂器只能在用音符播放時進行，錄音中做不到。

## 🎚 按圖層播放歌曲，顯示波形（2.738.0）
<!-- en: the-song-in-its-layers-as-waveforms-2-738-0 ca094b81dc7a -->

- 樂譜播放**真正的歌曲**。播放器中的 **Sound** 列出專案裡的所有歌曲：樂譜會自己找到它的歌曲（生成它時的歌曲，或標題相同的歌曲），你選擇的歌曲會按樂譜記住。**🎹 the notes (no recording)** 在瀏覽器中用柔和的鋼琴聲播放寫出的音符 - 用於沒有歌曲的樂譜。
- 歌曲按**圖層**播放，每個圖層在播放器下方佔一條軌道：它的**波形**、在上面移動的播放位置，以及開關按鈕（**Shift+點擊** = 只聽這一個圖層；再 Shift+點擊一次恢復全部）。點擊波形的任何位置，即從那裡播放。
- 還沒分開的歌曲會顯示一條 **Song** 軌道和 **✂ Split into layers**：它在這台電腦上（demucs）把歌曲分成 **Vocals、Drums、Bass** 和 **Other**（其餘所有），需要一兩分鐘。已在 Stems 面板中分離過的歌曲，在分成四個之前顯示 **Vocals** 和 **Instruments**。
- 歌曲在第 1 小節前有前奏時，仍用 **Sync (s)** 把歌曲和音符對齊。

## ✨ Create：一鍵得到歌曲的圖層和樂譜（2.739.0）
<!-- en: create-a-song-s-layers-and-its-sheet-music-in-one-press-2-739-0 9541017c13fa -->

- 在 Sheet Music 分頁選擇 **Song** - 專案中的任何歌曲（與 Song 分頁標題相同的歌曲會自動選中），或 **📂 A song from this computer…**（把它複製到專案中）- 然後按 **✨ Create**。會執行三個步驟，在按鈕旁逐一打勾：
  1. **Split** - 把歌曲分成 Vocals、Drums、Bass 和 Other（在這台電腦上）；它們的波形立即顯示在播放器下方。已經分開的歌曲會跳過這一步。
  2. **Lyrics** - Song 分頁的歌詞；該框為空時，會從人聲圖層中聽出歌詞並填進去。
  3. **Sheet music** - 根據歌曲本身寫出。開啟時音符下方帶有歌詞，並按圖層播放這首歌。
- 如果某一步無法執行（未安裝分離工具、ComfyUI 沒有執行…），Create 會停在那裡並說明原因。
- 沒有錄音的樂譜仍可使用 **🎼 Write from lyrics**：它根據歌詞和風格作曲。

## ⬇ 缺少的元件在需要時下載（2.740.0）
<!-- en: missing-parts-download-when-they-are-needed-2-740-0 20afe21c1c0a -->

- 當某個功能需要尚未安裝的元件時 - **✨ Create**、**✂ Split into layers** 或 Stems 面板的 **Separate** 所用的歌曲分離（demucs），或用來聽出歌詞的語音轉文字（Whisper）- 會彈出一個框，說明缺少什麼、它的作用和大小，並帶有 **⬇ Download** 和 **Cancel**。你不必去找 Install 按鈕。
- **⬇ Download** 會就地安裝，顯示進度條和正在做的事；完成後框會關閉，工作自動繼續（✨ Create 會依次進行分離、歌詞和樂譜）。
- **Cancel**（Enter 和 Esc 也是 - 焦點在 Cancel 上，所以大的下載不會因誤按而開始）會停止該工作並說明。對於歌詞，Cancel 只是做出不帶歌詞的樂譜。下載時按 **Close** 會讓安裝在佇列中繼續。
- ComfyUI 算圖用的模型已經以同樣方式詢問（找不到模型的提示框，2.719.0）。

## 🎶 ACE-Step 1.5，以及音訊分頁上的音樂風格（2.741.0）
<!-- en: ace-step-1-5-and-the-music-styles-on-the-audio-tab-2-741-0 444c366b67a5 -->

- **ACE-Step 1.5 Turbo** 是一個新的音樂模型：從文字和歌詞生成帶人聲的完整歌曲，10 秒到 10 分鐘，歌詞支援 50 多種語言，而且很快（8 步）。它的授權（MIT）允許商用這些歌曲。在 Music 面板中選擇 **ACE-Step 1.5** 風格；如果 ComfyUI 還沒有它的模型，第一首歌會詢問是否下載它的四個模型檔案（約 9.3 GB）。
- **設定 ▸ 音訊** 現在包含所有聲音設定：**🎶 音樂風格**（原來的 Music 分頁），然後是 **🗣 語音**，然後是
  **📝 語音轉文字**。頂部的按鈕可跳到各部分。
- ACE-Step 風格有兩個額外部分：
  - **BPM、調、每小節拍數和語言** 引導歌曲。留空（自動）則使用工作流程自己的值。
  - **LoRA**：＋ LoRA 從 ComfyUI 的 loras 資料夾中選擇一個，滑桿設定其強度。為 ACE-Step 1.5 訓練的 LoRA 會改變聲音或嗓音。
    LoRA 只對 ACE-Step 提供：尚不清楚 MiniMax Music3 和 YuE2 是否支援。
- 描述仍然是風格（類型、樂器、情緒、歌手），歌詞仍然是提示詞。

## 🗂 基本設定的每個分頁保留自己的設定（2.742.0）
<!-- en: every-basic-settings-tab-keeps-its-own-settings-2-742-0 2d36c83f3268 -->

- 在 **基本設定** 中，**Ref**、**F/L**、**Text** 和 **Swap** 各自記住自己的設定：格式、解析度、長寬比、寬和高、秒數、每段最大秒數、步數、CFG、種子和模型。切換分頁時會儲存離開的那個；回去時它的設定會恢復。從未開啟過的分頁從目前顯示的設定開始。設定儲存在此瀏覽器中，因此重新啟動後仍然保留。
- 只有您自己點擊才會切換它們。開啟專案時，或應用程式替您選擇分頁時（新增圖片、劇本），目前顯示的設定保持不變。
- **Character chain** 在您切換到 **Standard** 再回來時，即使還沒按 **💾 Save chain settings**，也會保留您輸入的內容。

## ☁ 在 RunPod Serverless 端點上算圖（2.743.0）
<!-- en: rendering-on-a-runpod-serverless-endpoint-2-743-0 acb1583d96d0 -->

**設定 ▸ 遠端生成 ▸ RunPod Serverless** 把所有算圖傳送到 RunPod Serverless 端點。無需啟動或停止機器：每次算圖是一個任務，只在工作器執行時計費。

**準備端點（在 runpod.io 上一次即可）**

1. 建立一個 **網路磁碟區**，把模型放在 `models/` 下（與 ComfyUI 相同的資料夾：`models/checkpoints`、
   `models/diffusion_models`、`models/loras`、`models/text_encoders`、`models/vae` …）。工作器從
   `/runpod-volume/models/…` 讀取。
2. 用 RunPod 的 ComfyUI 工作器映像檔 `runpod/worker-comfyui:<version>-base`（5.x 版本）建立一個 **Serverless 端點**。如果你的風格用到自訂節點（MiniMax H3 節點、VHS、KJNodes …），請以它為基礎建置自己的映像檔並裝好這些節點（在 Dockerfile 中 `RUN comfy-node-install <節點包>` - 參見工作器的自訂指南）。掛載網路磁碟區。
3. 複製端點的 **ID** 和一個 **API 金鑰**（Settings → API Keys）。

**在 bitGen Studio 中**

- 選擇 **RunPod Serverless**，貼上 API 金鑰和端點 ID，並填寫工作器每小時的費用（RunPod 按秒列出 - 乘以 3600），
  📊 使用情況會計入。**✓ 測試** 顯示就緒或執行中的工作器以及等待中的任務。**使用** 把所有算圖切換到端點；
  **這台電腦** 切換回來。
- 閒置一段時間後的第一個任務需要等待工作器啟動（冷啟動可能需要幾分鐘）。任務執行時沒有步驟顯示，進度顯示的是時間。
- 圖片、影片和歌曲都會傳回。工作器只傳回圖片和 Save Video 檔案，所以在途中，用 Video Combine 儲存的影片改用
  ComfyUI 內建的 Save Video 儲存，歌曲則裝在一個很小的無聲影片裡傳送，再在這台電腦上取出。
- 任務及其輸入檔案必須小於 **10 MB**（RunPod 的限制）。較長的參考影片或歌曲更適合用 Pod 或這台電腦；這種情況下任務會在傳送前說明。
- 算圖前的模型檢查會略過：模型在端點的磁碟區上，而不在這台電腦上。如果缺少某個模型，任務會以端點自己的訊息失敗。

## ☁ 在 RunPod Serverless 上只顯示能算圖的風格（2.744.0）
<!-- en: on-runpod-serverless-only-the-styles-it-can-render-2-744-0 95e77634c111 -->

- 使用 **設定 ▸ 遠端生成 ▸ RunPod Serverless** 時，風格清單（提示詞面板的圖片風格、影片風格、Music 面板的風格）只顯示端點能算圖的風格。清單最後一行會說明隱藏了多少個；在設定裡指向隱藏的風格可以看到原因。
- 無法詢問端點有哪些節點，所以軟體根據它的映像檔內容來判斷。RunPod 的工作器映像檔 5.10.0 帶的是 **ComfyUI 0.34.0**，沒有節點包。工作流程的每個節點都在這個 ComfyUI 裡，風格就能用。工作器需要 ComfyUI 節點清單的風格也會隱藏：
  LTX 2.3 / 2.5 和 Wan 2.1 / 2.2。
- 在遠端 GPU 的 RunPod Serverless 部分：
  - **端點映像檔裡的 ComfyUI：** 如果你的映像檔是用更新的 ComfyUI 建置的，選 **更新的 ComfyUI**（Fibo 2、YuE2、
    Qwen Image 2.1 等就會顯示）。
  - **我的映像檔有額外的節點包 - 顯示所有風格：** 軟體看不到映像檔裡有哪些節點包，所以顯示所有風格。
  - 會有一行說明端點能算圖多少個風格，其餘的風格列出原因。
- 切換回 **這台電腦** 會重新顯示所有風格。
- 修正：使用遠端 GPU 時在設定裡按 **儲存**，會把 ComfyUI 的位址改回這台電腦的，下一次算圖就在這裡進行。現在由遠端 GPU 分頁決定用哪個 ComfyUI 算圖。在 ComfyUI 分頁輸入的位址是這台電腦的，**這台電腦** 會使用它。

## 🖥 基本設定 ▸ GPU：哪些在遠端 GPU 上執行（2.745.0）
<!-- en: basic-settings-gpu-what-runs-on-the-remote-gpu-2-745-0 bbf5b58a5a1e -->

- **基本設定 ▸ GPU** 有三個選項：
  - **遠端：** 所有任務都在 設定 ▸ 遠端生成 中設定的遠端 GPU 上執行（與那裡的「使用」相同）。
  - **本機：** 全部在這台電腦上執行（與「這台電腦」相同）。遠端設定會保留，以後再用。
  - **兩者：** 選擇傳送到遠端 GPU 的內容，其餘的在這台電腦上執行。
    - **LLM：** 聊天 / 提示詞模型。
    - **視覺 LLM：** 描述圖片的模型。
    - **圖片：** 圖片、放大、圖形、3D。
    - **影片 + 歌曲：** 影片任務和歌曲。不使用 ComfyUI 的任務（匯出、卡拉 OK、訓練）始終在這裡執行。
- 下面一行會說明每種內容現在在哪裡執行。設定好遠端 GPU 後才能選擇「遠端」和「兩者」；有一個按鈕可開啟 設定 ▸ 遠端生成。
- 選「兩者」時，ComfyUI 的位址仍是這台電腦的，所以你自己的 ComfyUI 照常啟動。勾選種類的任務會在開始時傳送到遠端 GPU；日誌會說明在哪裡算圖，📊 使用情況也會記錄那裡的時間。
- **RunPod 上的 LLM：** 在 設定 ▸ 遠端生成 ▸ **🧠 LLM on RunPod (vLLM)** 中填寫 RunPod vLLM 工作器的端點 ID
  （runpod.io：Serverless ▸ New Endpoint ▸ Deploy LLM API，並填寫要執行的 Hugging Face 模型）。
  - 視覺 LLM 需要視覺語言模型，例如 Qwen2.5-VL。一個這樣的端點可以同時用於兩者 - 視覺端點留空。
  - 模型名稱留空時，軟體會詢問端點它執行的是哪個模型。✓ 測試可以逐個檢查。
  - 沒有端點時，LLM 和視覺 LLM 無法勾選，會在這裡執行。
- 選「兩者」時，RunPod Serverless 的風格篩選（2.744.0）只作用於傳送到端點的種類。
- 修正：基本設定會記住的設定（basic.cfg 和每個風格）不再包含 GPU 選項。

## 🏷 遠端風格：每個風格決定在哪裡執行（2.746.0）
<!-- en: remote-styles-each-style-says-where-it-runs-2-746-0 7b1be4d493b7 -->

- 每個風格編輯器在風格名稱下方都有 **執行於**：設定 ▸ 圖片、設定 ▸ 影片 和 設定 ▸ 音訊 ▸ 音樂風格。
  - **這台電腦：** 用這台電腦上的模型算圖。
  - **遠端 GPU：** 在遠端 GPU 上算圖，所以它的模型（以及需要的節點包）必須在那裡。會出現一個 **RunPod 端點 ID** 輸入框。留空就使用 設定 ▸ 遠端生成 中的端點；也可以給風格指定自己的端點 - 例如一個放 SDXL 模型的端點，另一個放 FLUX 的端點。
- 💾 儲存時，遠端風格的名稱會以 **R_** 開頭（R_SDXL），已經有的不會重複加上。改回「這台電腦」後 R_ 會被移除。
- **基本設定 ▸ GPU** 現在決定清單中顯示哪些風格：
  - **本機：** 只顯示這台電腦的風格。清單最後一行顯示隱藏了多少個遠端風格。
  - **遠端：** 只顯示遠端（R_）風格。在 RunPod Serverless 端點上，它無法算圖的遠端風格也會隱藏（2.744.0）。
  - **兩者：** 顯示所有風格。由風格決定在哪裡算圖：R_ 風格在遠端 GPU 上，其他的在這裡。沒有風格的任務（放大、圖表等）依「圖片」和「影片 + 歌曲」的勾選來決定。
- 任務記錄會說明在哪裡算圖以及原因，例如「this image job (R_SDXL - a remote style) renders on RunPod Serverless
  ohkr3evlck2bxn」。
- 設定 ▸ 遠端生成 ▸ RunPod Serverless 只計算你的遠端風格：「此端點可以算圖你 N 個遠端風格中的 K 個」。
- 現有風格都從「這台電腦」開始，所以更新後請為要在遠端 GPU 上使用的風格設定「執行於」。

## 🖥 GPU 預設為本機，更新檢查能順利完成（2.747.0）
<!-- en: gpu-on-local-by-default-and-an-update-check-that-finishes-2-747-0 a73226edff49 -->

- **基本設定 ▸ GPU** 現在是基本設定的第一項，位於「覆蓋風格」上方。它預設收合，標題顯示目前選擇（GPU · 本機）。展開後會像其他部分一樣保持展開。
- **預設是本機**，也是第一個選項。更新到此版本時會切換到本機一次：遠端 GPU 的「使用」把它設成了遠端，而遠端只列出 R_
  風格 - 還沒有 R_ 風格時，圖片和影片清單是空的。遠端 GPU 的設定會保留；隨時可以重新選擇遠端或兩者。
- 選了遠端但還沒有 R_ 風格時，風格清單最後一行會說明：把 基本設定 ▸ GPU 改為本機，或把風格的「執行於」設為遠端 GPU。
- **設定 ▸ 一般 ▸ 更新：** 在 git 安裝中，🔍 檢查更新 會在一次請求中下載整個更新（每個版本約 13 MB 的指南 PDF）。工作室等待請求的時間最多 5 分鐘，所以網路較慢或落後幾個版本時，檢查會以「Failed to fetch」失敗。現在它只向 GitHub 詢問最新的提交，幾秒就能完成，⤓ 立即更新 會在背景下載其餘部分（最多允許 1 小時）。如果工作室不再回應，訊息會說明這一點，而不是「Failed to fetch」。

## 🔑 你的 API 金鑰加密儲存在 settings 資料夾中（2.748.0）
<!-- en: your-api-keys-are-kept-encrypted-in-the-settings-folder-2-748-0 0181ccd6ed4a -->

- 你加入的 API 金鑰和權杖儲存在 bitGen 資料夾中的 **settings/keys.json**，每一個都單獨加密（AES-256-GCM）。包括：
  - Hugging Face 權杖
  - Civitai 權杖
  - RunPod API 金鑰（設定 ▸ 遠端生成）
  - 遠端存取金鑰
  - bitGen 社群的登入
- **settings/keys.master** 存放用來開啟它們的金鑰，在第一次儲存金鑰時產生。
- **更新不會動它們。** settings 資料夾不屬於應用程式的檔案，所以 `git pull`、⤓ 立即更新 和新的 zip 都不會碰它。金鑰只需加入一次。
- **custom.settings 不再儲存任何金鑰。** 已經在裡面的金鑰會在第一次啟動 2.748.0 時移到 settings/。custom.settings.bak
  和 community.json 中的社群登入權杖也一樣。
- **設定 ▸ 一般** 顯示金鑰檔案的位置和已儲存金鑰的名稱（從不顯示金鑰本身）。將設定恢復為預設值 會保留你的金鑰。
- **移到新資料夾或新電腦：** 把整個 settings 資料夾複製過去（keys.json 和 keys.master 一起）。單獨的 keys.json 無法開啟。
- **加密的作用：** 金鑰不再以明文出現在設定檔、它的備份或你傳給別人的檔案中。應用程式必須在不詢問你的情況下開啟它們，所以能讀取你在這台電腦上的檔案的人也能開啟 - 任何會記住金鑰的應用程式都是如此。
- 修正：misc/default.settings 現在列出了應用程式使用的所有預設值（檔案中缺少 5 個較新的值；這些值早已在使用）。

## ☁ 為 RunPod 工作器映像準備的現成遠端風格（2.749.0）
<!-- en: ready-made-remote-styles-for-runpod-s-worker-images-2-749-0 2f702f11ea3c -->

- 工作室自帶 7 個遠端風格，RunPod 的每個標準 worker-comfyui 映像有一到兩個。每個映像只有一套模型：

  | 風格 | RunPod 映像（runpod/worker-comfyui:5.10.0-…） |
  |---|---|
  | R_SDXL, R_SDXL img2img | sdxl |
  | R_FLUX.1 schnell | flux1-schnell |
  | R_FLUX.1 dev | flux1-dev |
  | R_FLUX.1 dev fp8 | flux1-dev-fp8 |
  | R_SD3 Medium | sd3 |
  | R_Z-Image Turbo | z-image-turbo |

  它們只使用 ComfyUI 自己的節點和 RunPod 放進該映像的模型檔案，所以無需上傳任何東西就能算圖。
- **設定 ▸ 遠端生成 ▸ RunPod Serverless ▸ 端點的鏡像：** 工作室向 RunPod 詢問你的端點執行的映像（🔍 詢問 RunPod，第一次會自動詢問），並只列出適合該映像的現成風格。使用 sdxl 映像時會看到 R_SDXL 和 R_SDXL img2img；其他的會隱藏，工具提示會說明原因。如果 RunPod 無法回答，請自己選擇。「base」（模型在網路磁碟區上）、「你自己的鏡像」和「尚不清楚」會顯示所有遠端風格。
- 和其他遠端風格一樣，它們在 基本設定 ▸ GPU 為遠端或兩者時顯示；為本機時隱藏。
- **記錄現在會說明任務在哪裡算圖。**
  - 在 RunPod Serverless 上，VRAM 步驟會說明由端點的工作器載入模型，而不是「VRAM kept」（那是指這台電腦）。
  - [power] 行以「rendered on RunPod Serverless …」和該任務在那裡的大致費用（根據 設定 ▸ 遠端生成 中的每小時價格）開頭，然後是這台電腦在等待期間的用電。
- 你自己的風格不能使用現成風格的名稱：因為 R_SDXL 已經存在，把 SDXL 儲存為遠端風格會被拒絕。請使用 R_SDXL，或給你的風格另取名字。

## 🧠 啟動畫面改為 bitGen 大腦和標誌 (2.752.0)
<!-- en: the-splash-is-the-bitgen-brain-with-the-logo-2-752-0 99f60c62b48a -->

- **桌面應用程式的啟動畫面現在總是 bitGen 大腦影片**：閃電擊中大腦，然後出現大大的 bitGen Studio 標題，下方是製作人員名單。橙色的標誌影片不再隨機出現。
- **官方標誌位於左上角**——尺寸小，不會遮住大腦。影片無法播放、改為顯示大腦圖片時，標誌也會留在原處。
- **大腦影片更清晰了**：從 960 × 544 提升到 1920 × 1080，使用 AI 放大工具放大，bitGen Studio 標題和各個標籤都很清晰。
- 點擊或按任意鍵仍可跳過啟動畫面。
- 網站首頁播放同一段大腦影片，標誌也在同一位置。

## 🧠 OpenRouter 上的 LLM；「遠端 GPU」現在叫「遠端生成」 (2.753.0)
<!-- en: the-llm-on-openrouter-remote-gpu-is-now-remote-generation-2-753-0 5dfe0eaeb867 -->

- **設定 ▸ 遠端 GPU 現在叫 設定 ▸ 遠端生成。** 裡面的一切照常可用。
- **LLM 可以在 OpenRouter**（openrouter.ai）上執行：一個 API 金鑰就能使用數百個模型，其中一些免費。無需安裝。顯示卡較小時最有幫助 - LLM 不必再和圖片模型共用顯示卡。
  1. 在 openrouter.ai 註冊免費帳戶並建立金鑰（Keys）。
  2. 在 設定 ▸ 遠端生成 ▸ 🧠 LLM 中選擇 **OpenRouter**，貼上金鑰。金鑰會和你的其他金鑰一起加密儲存在 settings 資料夾中。
  3. 選擇 **LLM**。一開始 **僅免費模型** 是勾選的；取消勾選即可看到付費模型及其每百萬 token 的價格。
  4. 選擇用於描述圖片的 **視覺 LLM** - 只列出能處理圖片的模型（👁）。留空則在 LLM 能處理圖片時使用該 LLM。
  5. **✓ Test** 會檢查金鑰和模型。
  6. 在 基本設定 ▸ GPU 中選擇 **兩者**，並勾選 **LLM** 和 **視覺 LLM**。沒有遠端 GPU 也能用 - 圖片、影片和歌曲仍在這臺電腦上渲染。
- 免費模型每分鐘約 20 次請求，每天 50 次；帳戶購買 $10 額度後每天 1000 次。OpenRouter 可能會調整這些限制。
- 你的提示詞和圖片會傳送給 OpenRouter 及模型提供方。私密素材請留在這臺電腦上。

## ☁ 使用遠端生成、遠端生成停靠窗和 Pod 捷徑 (2.754.0)
<!-- en: use-remote-generation-the-remote-generation-docker-and-pod-shortcuts-2-754-0 94cd5331d611 -->

- **設定 ▸ 遠端生成 ▸ 使用遠端生成** 是這個分頁的第一項。取消勾選時，分頁的其餘部分、基本設定 ▸ GPU 和遠端生成停靠窗都會隱藏，一切都在這臺電腦上執行。新安裝時預設不勾選；更新時如果已經設定過遠端，則預設勾選。
- **遠端生成停靠窗：** 在 基本設定 ▸ GPU 中按 **☁ 遠端生成停靠窗**。它和其他停靠窗一樣可以浮動和停靠，狀態列裡沒有它的按鈕。它顯示：
  - 任務在哪裡執行、正在使用的遠端 GPU，以及 LLM 在哪裡執行；
  - **我的 Pod**：你的 RunPod Pod（你的 API 金鑰 - All 權限的金鑰），帶 **▶ 開始**、**⏹ 停止** 和 **使用**（在那個 Pod 上渲染）。停止的 Pod 在 RunPod 上終止（Terminate）之前仍要支付儲存費用；
  - **Pod 捷徑**：你作為自己的 Pod 部署的 RunPod 範本（「公開 Pod」）。
- **新增 Pod 捷徑：**
  1. 在 RunPod 上開啟 **Explore**（停靠窗裡的 **瀏覽 RunPod 範本 ↗**），找到一個範本 - 請選執行 ComfyUI 的。
  2. 複製它頁面的連結（runpod.io/console/explore/…），連同名稱貼到停靠窗裡，按 **＋ 新增**。
  3. **部署 ↗** 會開啟已選好該範本的 RunPod 部署頁面（bitGen 的推薦連結）。選擇 GPU 並部署。
  4. 回到停靠窗，**🔄 我的 Pod** 會列出新的 Pod - 按 **使用**。

## ☁ 11 月 15 日之後 Pod 照常可用；正在載入 Pod、Pod 已就緒、正在停止 Pod (2.755.0)
<!-- en: pods-keep-working-after-15-november-loading-pod-pod-loaded-stopping-pod-2-755-0 78732d83c2a8 -->

- RunPod 將在 2026 年 11 月 15 日停用 bitGen 用於 Pod 的 API（REST v1）。現在 bitGen 的 🔄 我的 Pod、▶ 開始 / ⏹ 停止以及 Serverless 端點的映像都使用 RunPod 的新 API（REST v2）。你不需要做任何更改。你的 API 金鑰需要有 Pod 的存取權限 -
  All 權限的金鑰。
- **遠端生成停靠窗會顯示 Pod 正在做什麼：**
  - **▶ 開始** - RunPod 啟動 Pod、然後啟動它的 ComfyUI 時顯示「正在載入 Pod…」，ComfyUI 有回應後顯示「Pod 已就緒」。之後顯示
    Pod 已執行多久以及大約花了多少錢。
  - **⏹ 停止** - 顯示「正在停止 Pod…」，然後是「已停止」。停止的 Pod 在 RunPod 上終止（Terminate）之前仍要支付儲存費用。

## 🖥 遠端伺服器、RunPod 的 Serverless 或 Pod，以及 PODS 停靠窗 (2.756.0)
<!-- en: remote-servers-runpod-serverless-or-pods-and-the-pods-docker-2-756-0 ec394393fd67 -->

- **基本設定 ▸ GPU ▸ 遠端伺服器：** 選擇 **RunPod** 或 **OpenRouter**。OpenRouter 會在那裡執行 LLM，圖片、影片和歌曲在這臺電腦上渲染。RunPod 則選擇 **Serverless**（端點，只在任務執行時計費）或 **Pod**（你自己的 GPU 機器，執行時按小時計費）。還沒有任何設定時，這些選項顯示在本機下方，所以你可以先選 Pod - 這樣遠端就能選了。
- **PODS 停靠窗**（基本設定 ▸ GPU 中的 **🖥 PODS** 按鈕）只在選擇 RunPod ▸ Pod 時顯示：
  - RunPod 的公開範本 - **官方**、**已驗證** 和 **Community** - 帶搜尋和 **僅 ComfyUI**（開啟：bitGen 能用來渲染的範本）。點擊名稱會開啟它在 RunPod 上的頁面。
  - **建立 Pod…：** 選擇 GPU（RunPod 目前每小時的價格、顯示記憶體以及空閒情況；「none free」的不能選）、雲（**Secure** -
    RunPod 自己的資料中心 - 或 **Community** - 通常更便宜）、GPU 數量、容器磁碟（Pod 停止時清空）和 /workspace 的大小（停止時保留，收取儲存費用）。下方會顯示每小時的估算。**建立 Pod** 會在 RunPod 上建立它，然後顯示「正在載入 Pod…」和「Pod 已就緒」。
  - **我的 Pod：** 你帳戶裡的所有 Pod。🅱 表示由 bitGen 建立或啟動的。**▶ 開始** / **⏹ 停止**、**使用**（透過它的 ComfyUI
    連接埠渲染）和 **終止** - 它會先詢問，因為 Pod 及其上的所有檔案都會被刪除；只有網路磁碟區會保留。

## 🃏 每個 RunPod 範本都是一張卡片 (2.756.1)
<!-- en: every-runpod-template-as-a-card-2-756-1 8f421956bb01 -->

- PODS 停靠窗現在一次列出 RunPod 的**全部**公開範本。**全部** 把官方、已驗證和社群放在一起顯示，也可以只選一個分組；每個按鈕都顯示該分組有多少個範本。RunPod 每個分組最多提供 100 個範本。
- 每個範本都是一張**卡片**，就像 ComfyUI 的範本瀏覽器：一個帶首字母的彩色色塊，標出它適用的機器種類（NVIDIA、AMD 或 CPU），執行 ComfyUI 的還有 **ComfyUI** 標記；下面是名稱、映像、所屬分組、磁碟和 /workspace 的大小以及 Web 連接埠。**建立 Pod…** 會在卡片上方開啟表單，**↗** 開啟該範本在 RunPod 上的頁面。RunPod 的清單裡沒有範本的圖片和說明，所以色塊是 bitGen 畫的。
- 邊輸入邊**搜尋**：每個詞都必須出現在名稱、映像、連接埠、種類或分組中——例如 `comfy 3000` 或 `pytorch rocm`。**所有種類** 可以只顯示 NVIDIA、AMD 或 CPU 範本。
- **僅 ComfyUI** 現在一開始是關閉的：開啟時它會隱藏全部 100 個官方範本，因為其中沒有一個執行 ComfyUI。勾選它就只看 bitGen 能用來渲染的範本。
- 如果 RunPod 對某個分組沒有回應，其他分組仍會顯示，按鈕下方那一行會寫出缺少的是哪個分組。

## 🤖 加入社群是給真人的 (2.756.3)
<!-- en: joining-the-community-is-for-people-2-756-3 22a9362ada32 -->

- 有機器人用隨機名字和別人的電子郵件地址加入社群，於是社群寄了驗證碼郵件給陌生人。現在加入時會在寄出任何郵件之前把它們擋掉。
- bitGen Studio 裡的 **💬 社群 ▸ 加入** 會先做一個簡短的自動檢查。大約一秒鐘，你不會看到它。舊版本的 bitGen Studio 不能再加入（會提示）：請更新，或在網站上加入。登入和以前一樣。
- 網站上的 **加入** 有一個滑桿：按加入之前先把它滑到最後。
- 看起來像機器產生的名字或姓氏（一個單字裡夾著隨機的大寫字母）會被拒絕。請按實際寫法輸入你的名字。

## 🔑 設定 ▸ API - 在線上服務上生成 (2.757.0)
<!-- en: settings-api-render-on-an-online-service-2-757-0 6515d9088a9a -->

- **設定 ▸ API**（緊跟在遠端生成之後）讓 bitGen 不需要好顯示卡也能生成：由線上服務完成工作，並按每次生成向你的帳戶收費。內建七個服務 - **OpenRouter**（圖片、影片、LLM）、**fal.ai**（圖片、影片、歌曲）、**Replicate**（圖片、影片、歌曲）、**OpenAI**（圖片、LLM）、**Google Gemini**（圖片、LLM）、Anthropic 的 **Claude**（LLM）和 **RunningHub**（雲端的 ComfyUI 工作流：圖片、影片、歌曲）。
- 新增方法：貼上它的 **API 金鑰** - **服務** 設為 **根據金鑰自動識別** 時會按金鑰的格式識別（也可以手動選擇）- 輸入 **名稱**，保持勾選 **使用**，然後按 **+ Add**。輸入框下方的 **取得金鑰** 會開啟該服務的金鑰頁面。
- **使用** 會建立這個 API 的風格：`API_<name> pictures`、`API_<name> video` 和 `API_<name> songs`（只有服務能生成的類型）。它們像其他風格一樣出現在圖片、影片和歌曲的風格清單中，並在服務端生成 - 不使用這臺電腦的顯示卡，也不需要 ComfyUI。取消勾選 **使用**，它建立的風格會被移除；你自己建立的風格會保留。
- **模型和金鑰** 顯示每種類型初始使用的模型（例如 OpenRouter 的 `google/gemini-2.5-flash-image`、fal.ai 的 `fal-ai/flux/schnell`）- 輸入該服務的其他模型或新金鑰，然後按 **儲存模型和金鑰**。對 **RunningHub** 來說，模型就是 **工作流 ID** - runninghub.ai 上工作流地址中的數字。bitGen 會讀取工作流並填入你的提示詞、尺寸、種子和參考圖片。
- 任何風格都可以在 API 上執行：在設定 ▸ 圖片、影片或音訊 ▸ 音樂中，把風格的 **Runs on** 設為 **API**，選擇 API、它的 **模型**，如果模型有自己的選項，再用 JSON 填寫 **額外設定**（例如 `{"num_inference_steps": 4}`；RunningHub 則是 `{"nodeId", "fieldName", "fieldValue"}` 的清單）。名稱隨後以 **API_** 開頭。
- **Claude** 只用作 LLM，不生成圖片、影片或歌曲。新增它的金鑰（在 Claude Console 中建立，以 `sk-ant-` 開頭）後，**使用** 會自動同時勾選 **用作 LLM**：劇本寫作、提示詞幫助、圖片描述和分鏡清單都會在 `claude-sonnet-5-5` 上執行（可在 **模型和金鑰** 中更改，例如 `claude-opus-5-5` 或 `claude-haiku-5-5`）。bitGen 會去掉 Claude 不接受的設定，並給它回答前思考的空間。
- **✓ Test** 詢問服務是否接受該金鑰。**用作 LLM**（OpenRouter、OpenAI、Gemini、Claude）會把所有 LLM 呼叫 - 提示詞 LLM、圖片描述、分鏡清單 - 傳送到該服務；一次只能一個 API。**✕** 會先確認，然後刪除該 API 及其風格。
- 金鑰 **加密** 儲存在這臺電腦上（settings/keys.json），只發送給對應的服務；頁面只顯示最後四個字元。生成任務的檔案只包含它需要的金鑰。
- 影片：OpenAI 已在 2026 年 9 月停止其影片 API（Sora），Gemini 的影片模型也不通過 bitGen 使用的 API 金鑰提供 - 影片請使用 OpenRouter、fal.ai、Replicate 或 RunningHub。

## 🧩 P_ Pod 風格和 Pod 載入進度列 (2.758.0)
<!-- en: p-pod-styles-and-a-pod-s-loading-bar-2-758-0 4dd5ce6454aa -->

- **Pods 下只顯示 P_ 風格。** 基本設定 ▸ GPU 為 **RunPod ▸ Pods**（遠端或兩者）時，風格清單只顯示 **P_** 風格 - 用 Pod 上已有的模型生成的風格。在本地或 Serverless 下 P_ 風格會隱藏，因為它們需要 Pod。
- **選擇模型：🎨 Styles。** Pod 顯示 *pod loaded* 後，在 PODS 停靠窗中按它的 **🎨 Styles**。bitGen 會讀取 Pod 的 ComfyUI 並列出：
  - **Pod 的模型**，以及每個模型適合的 bitGen 風格 - 例如 `qwen_image…` → qwen2_1、`z_image_turbo…` → Z-Image Turbo、`krea2…` → Krea 2、`flux1-krea…` → FLUX.1 dev。bitGen 沒有工作流的模型（例如 Boogu 這樣的自訂模型）不能勾選 - 請使用 Pod 自己的工作流。
  - **Pod 中儲存的工作流** - 範本放在 ComfyUI 裡的工作流。它們已經使用範本的模型和自訂節點。勾選需要的內容，然後按 **🎨 Make P_ styles**。模型會變成 `P_<model file>`：該模型類型的 bitGen 工作流，填入 Pod 的模型、文字編碼器和 VAE。工作流會變成 `P_<workflow name>`，與範本做的完全一樣。目前只有圖片風格 - 影片或歌曲工作流會列出並說明原因。再次建立會更新同一個風格。
- 任何風格都可以在 Pod 上執行：設定 ▸ 圖片 ▸ 風格的 **Runs on** ▸ **RunPod pod**，填入 Pod 的 ID（留空 = 你按了 **Use it** 的 Pod）。名稱隨後以 **P_** 開頭。
- **P_ 風格下的基本設定。** 選擇 RunPod ▸ Pods 會勾選 **Override style**，基本設定的 **步數、種子、CFG、尺寸和長寬比** 會用於每次 Pod 生成。選取 P_ 風格時，**檢查點** 框和 **LoRA** 行會關閉 - 使用 Pod 自己的模型和 LoRA。Override style 關閉時，Pod 的工作流使用自己的數值。
- **載入進度列。** Pod 啟動時，PODS 停靠窗和遠端生成停靠窗會顯示目前階段：1/4 *waiting for a GPU machine*（等待 GPU 機器）→ 2/4 *starting the container*（下載範本的鏡像）→ 3/4 *ComfyUI starting*（這類别範本會在此時下載模型 - 通常是最長的部分）→ *pod loaded in …*。RunPod 不報告下載百分比，所以進度列是把已用時間與這個 Pod - 或同一範本的另一個 Pod - 上次的載入時間相比（「3 min of about 7 min」）；第一次按階段前進。
- **Pod 和 Pod 快捷方式現在在 PODS 停靠窗中。** 遠端生成停靠窗保留工作執行位置和 **🖥 PODS docker** 按鈕。Pod 快捷方式就是範本卡片上的 **☆**：按下後 bitGen 會記住這個範本 - 連結會自動填入。**★ Shortcuts** 列出它們，每個都有 **Deploy ↗**（已選好範本的 RunPod 部署頁面）和 **Create pod…**；再按一次 **★** 即可移除。RunPod 不列出的範本（私有範本）仍可在該分頁貼上連結新增。

## ⬇ 把模型下載到 Pod，以及為風格選 Pod (2.759.0)
<!-- en: models-onto-a-pod-and-pods-for-a-style-2-759-0 1ba6ab5d3dc6 -->

- **為風格選 Pod。** 在 PODS 停靠窗的 **For …**（ComfyUI only 旁邊）選擇一個 bitGen 風格：名稱或鏡像中包含該風格模型系列（Krea、Qwen、Z-Image、FLUX、Wan、SDXL 等）的範本會排在前面，並標記 **✓ fits**。這樣建立的 Pod 如果有該模型，載入後會自動得到該風格的 P_ 風格。
- 執行中 Pod 的 **⬇ Models** 會把模型下載到它的 ComfyUI。選擇 **一個風格** - 它在 bitGen 下載清單中的檔案會被勾選，並顯示總大小 - 或搜尋清單勾選單個檔案，然後按 **⬇ Download ticked**。每個檔案都有一條進度列；之後可按 **🎨 Make P_ styles from the pod**。檔案會放到 ComfyUI 讀取模型的資料夾；如果它不在 `/workspace` 下，bitGen 會提示，因為 Pod 停止後這些檔案會消失。
- ComfyUI 本身沒有「下載檔案」的介面，所以 bitGen 使用 Pod 上已有的方式：
  - **Pod 的 Jupyter** - 任何檔案都可以。bitGen 建立的 Pod 會帶有 bitGen 自己的 Jupyter 密碼（加密儲存），只要範本執行 Jupyter 就能直接使用。在 RunPod 網站上建立的 Pod，請把它的 Jupyter 密碼（RunPod ▸ Pod ▸ Connect）貼上到輸入框。
  - **ComfyUI-Manager** - 沒有 Jupyter 時使用。它只下載自己清單中的模型（Qwen Image、FLUX.1、Wan 2.2、SDXL 等 - 不包括 Z-Image 或 Krea 2）；bitGen 會列出無法通過這種方式取得的檔案。
- Hugging Face 上需要授權的模型會使用你在設定中的 Hugging Face 權杖，它只隨下載傳送到你自己的 Pod。
- **來自連結或這臺電腦的檔案**（在 ⬇ Models 中）：選擇要放入的模型資料夾（loras、checkpoints 等），然後貼上連結 - Civitai、Hugging Face 或任何網址 - 並按 **⬇ From the link**，或按 **⬆ From this computer…** 從磁碟選擇檔案。兩者都通過 Pod 的 Jupyter。來自電腦的檔案會分段傳送，所需時間取決於你的上傳速度，所以 Hugging Face 或 Civitai 上已有的模型用連結會更快。Civitai 連結使用設定中的 Civitai 權杖。

## 🎵 Audio 停靠欄、以你的貨幣顯示價格、My pods (2.760.0)
<!-- en: the-audio-docker-prices-in-your-currency-and-my-pods-2-760-0 aeeea0948303 -->

- **Audio 停靠欄。** Music、Stems 和 SFX 現在是同一個停靠欄 **Audio** 的分頁，狀態列上的三個按鈕也合併為一個
  **Audio** 按鈕。該按鈕以你上次使用的分頁顯示或隱藏 Audio 停靠欄。它的標題欄顯示 **Audio** 和分頁
  **🎵 Music · 🎚 Stems · 💥 SFX**：點一個分頁就顯示它，其餘的收起。每個分頁保留各自的高度、▾ 摺疊、⛶ 最大化和
  ⇱ 浮動。任何開啟其中之一的操作——工作區、儲存的停靠欄佈局、語音聊天——都會把它作為 Audio 停靠欄的分頁開啟。擴充功能已關閉的分頁不會顯示。
- **貨幣**（設定 ▸ General）：RunPod、OpenRouter 等服務以美元列出價格。選擇你的貨幣（AUD、USD、EUR、GBP、CNY、JPY
  等），bitGen 就以該貨幣顯示：PODS 停靠欄的 GPU、每小時價格和你的 Pod，Remote generation 的 Pod，以及 OpenRouter
  的模型。把滑鼠懸停在價格上可看到美元金額和匯率。匯率是當天的參考匯率（來自公佈各國央行匯率的 Frankfurter——無需帳戶，無需金鑰），每 12 小時檢查一次，並儲存以便離線使用。在 **1 USD = …** 中輸入匯率即可使用你自己的匯率（例如銀行的）；清空後恢復為當天的匯率。遠端 GPU 的費用以 Energy cost 的貨幣計入 📊 Usage 帳單。
- **🖥 My pods**（PODS 停靠欄）：範本分頁旁的一個按鈕，顯示你有多少個 Pod。它只顯示你的 Pod——沒有範本卡片，沒有搜尋。範本分頁（All、Official 等）只顯示範本。**Create pod…** 只顯示錶單（✕ Close 或點一個分頁即可返回），
  Pod 建立後停靠欄會切換到 My pods，載入進度列在那裡執行。

## 🖥 作為條目的 Pod：Pod 的用途、把檔案放到上面、費用，以及重新建立 Pod (2.761.0)
<!-- en: pods-as-items-what-a-pod-is-for-files-onto-it-its-cost-and-pods-made-again-2-761 c5fed3df1878 -->

- **🖥 My pods 中的每個 Pod 現在都是一個條目。** 點它的名字即可展開（▸ / ▾）。名字這一行顯示 GPU、每小時價格、狀態，以及
  RunPod 今天和本月為它收取的費用。
- **Pod 的用途**：在名字下方勾選 **Video**、**LLM**、**vLLM**（描述圖片的模型）、**Image** 和 **Image edit**。**💾 Save**
  在你做出更改之前（勾選、欄位、傳送的檔案或新建的資料夾）是關閉的，儲存後再次關閉。Save 會建立該 Pod 的 P_ 風格：對 Pod 上
  bitGen 有工作流的每個模型檔案，為每種勾選的類型各建立一個 P_ 風格（P_<file>、P_<file> edit、P_<file> video）。取消勾選的類型會刪除 Save 為它建立的 P_ 風格（🎨 Styles 建立的保留）。
- **Pod 上的 LLM / vLLM**：勾選並儲存後，bitGen 的提示詞 LLM（或描述圖片的模型）會通過 RunPod 的代理與 Pod 上執行的
  OpenAI 相容伺服器（vLLM、Ollama 等）通訊。填寫埠（預設 8000）和模型；模型留空時 bitGen 會詢問伺服器提供的是哪個模型。每項同一時間只由一個 Pod 承擔。
- **📁 New folder** 在 Pod 的 checkpoints 或 loras 中新建資料夾。**➕ Checkpoint** 和 **➕ LoRA** 把這臺電腦上的檔案傳送到
  Pod 的 models/checkpoints 或 models/loras，或傳送到 **into** 中選擇的資料夾。它們通過 Pod 的 Jupyter 傳輸（bitGen 建立的
  Pod 已就緒；其他 Pod 請在 ⬇ Models 中貼上密碼）。
- **費用**（Basic Settings ▸ GPU，選擇 RunPod ▸ Pods 時）：💲 正在執行的 Pod 數量和目前每小時費用，以及 RunPod 自己今天和本月的帳單（GPU、CPU 和磁碟）——每分鐘重新查詢。📊 Usage 按天記錄 Pod 費用，與電費並列，使用 Energy cost 的貨幣，並計入每天的帳單。
- **P_ 風格會記住它的 Pod**：範本、GPU、Secure 或 Community、磁碟大小，以及 bitGen 放到上面的檔案（和每個檔案的來源）。用 Pod 已停止的 P_ 風格渲染時，bitGen 會啟動它；RunPod 上已沒有該 Pod 時，bitGen 會用同一範本、同一 GPU 建立新 Pod，等待它的 ComfyUI，並把檔案放上去——檔案仍在這臺電腦上就從這裡上傳，否則用它的連結，再否則從 bitGen 的下載清單取得。這期間任務在佇列中等待（日誌中的 [pod] 行），然後在新 Pod 上渲染；風格會轉到新 Pod。
- 在 Basic Settings 中選擇 Pods 時，只顯示 P_ 風格。
- **Audio 停靠欄**「螢幕上只顯示一個分頁」的規則只適用於主列：浮動（⇱）或放進 ▣ Docker 的 Music、Stems、SFX 會與其他並排顯示。

## 🧩 每個 Pod 一個檢查點——Pod 就成為這個風格 (2.762.0)
<!-- en: one-checkpoint-per-pod-the-pod-becomes-the-style-2-762-0 74c6dc4c0638 -->

- **Checkpoint**（在 🖥 My pods 中某個 Pod 的條目裡）現在與 Basic Settings 的 Override style 使用相同的下拉框——資料夾篩選、檔案和 📁，列出這臺電腦上的 ComfyUI 模型。為 Pod 只選一個檢查點：Pod 就成為這個風格。**💾 Save** 會用 bitGen 為該模型系列準備的工作流建立 **P_<Pod 的名字>**（勾選了的話還有 P_<Pod> edit / P_<Pod> video）——Krea 檢查點用 bitGen 的 Krea 工作流，
  SDXL 用 SDXL 工作流——並使用 Pod 上與工作流最接近的文字編碼器和 VAE。
- 如果 Pod 上已經有這個模型（範本自帶的），就直接選用，不傳送任何東西。否則會從這臺電腦在後臺傳送一次，放進與這裡相同的子資料夾（checkpoints/Krea/…）；💾 Save 旁邊的一行顯示進度。
- **LoRAs**：＋ 會增加一行同樣的下拉框。它們與檢查點一起傳送到 Pod，並加入它的 P_ 風格。
- **Override style + Pods**：選取 P_ 風格時，Basic Settings 的檢查點框重新可用。在那裡選的檢查點會在 Pod 上使用：如果 Pod 上沒有，bitGen 會在渲染前傳送它（任務等待，日誌中有 [pod] 行），然後用它在 Pod 上的名字。P_ 風格的臨時 LoRA 行仍然關閉。
- Pod 條目中的 📁 New folder 和檔案對話方塊已移除——由下拉框取代。

## 🧩 你的風格在你的 Pod 上 (2.763.0)
<!-- en: your-styles-on-your-pods-2-763-0 760435606283 -->

- **不再生成 P_ 副本。** 在 RunPod Pods 上（Basic Settings ▸ GPU ▸ Remote 或 Both ▸ RunPod ▸ Pods），風格清單重新顯示你自己的風格，每個風格都在一個 Pod 上渲染。你以前做的 P_ 風格照樣能用。RunPod Serverless（R_）風格在 Pods 上隱藏。
- **風格用哪個 Pod：** 先是風格自己的 Pod（🖥 My pods 中 Pod 的 **Styles**），再是為它的類型（Image、Image edit、Video）勾選的
  Pod，再是正在使用的 Pod。想每種類型一個 Pod，就在不同的 Pod 上勾選 **Image**、**Image edit** 和 **Video**；想用一個 Pod
  做所有事，就在一個 Pod 上全部勾選。每種類型同一時間只屬於一個 Pod - 在一個 Pod 上勾選它，就會從另一個 Pod 上去掉。
- **Pod 的 Styles**（在 🖥 My pods 中 Pod 的專案裡）取代了 2.762.0 的 Checkpoint 和 LoRA 下拉式清單：下拉式清單列出 Generate 模式（🖼 Image、🎬 Video、🎶 Music）的風格；**All** 列出所有風格。選一個後按 **＋**；風格上的 **✕** 可以去掉它。**💾 Save** 把它們關聯到 Pod，並在 Pod 執行時在上面把它們準備好。
- **在 Pod 上準備好** 的意思是：把風格的工作流、模型、文字編碼器、VAE 和 LoRA 放到 Pod 上 - bitGen 下載清單裡的檔案由 Pod
  自己下載（很快），其他檔案從這臺電腦傳送 - 並通過 Pod 的 Jupyter 安裝工作流需要的節點包，然後通過 ComfyUI-Manager 重新啟動
  ComfyUI。💾 Save 旁邊的一行顯示進度；做不到的事（bitGen 所知的任何節點包都不提供的節點、哪裡都找不到的檔案）也會在那裡寫明。
- **還沒有 Pod 的風格：** 按 Generate 後渲染會等待，一個對話方塊詢問：用 RunPod 的「ComfyUI CUDA 13」範本 **Create pod**（在 CUDA
  13 或更新的主機上）- 選擇 Secure 或 Community、GPU（⭐ 是 bitGen 的推薦：顯示記憶體足夠放下風格模型的最便宜的一個，以你的貨幣顯示每小時價格）和磁碟 - 或者對你的某個 Pod 選 **Use this pod**（已停止的 Pod 會被啟動）。無論哪種，風格都會關聯到那個
  Pod，下次會自動去那裡。**Cancel** 取消這次渲染。
- **每次在 Pod 上渲染之前**，bitGen 會啟動已停止的 Pod；如果 RunPod 上已經沒有這個 Pod，就按當初的方式重新建立；等它的
  ComfyUI 就緒，並在應用每次執行時把風格在 Pod 上準備一次。任務日誌的 [pod] 行會說明正在發生什麼。
- **Override style** 在 Pods 上依然可用：如果 Pod 沒有 Basic Settings 的 checkpoint，會在渲染前傳送到 Pod。
- **Pod 上的 LLM：** ComfyUI 不是聊天伺服器，所以 LLM 在 Pod 上作為單獨的伺服器執行（vLLM、llama.cpp 或 Ollama）；和以前一樣，在那個 Pod 上勾選 LLM / vLLM 並填寫它的埠。

## 🖥 你的自訂節點上 Pod，以及 Pod 在做什麼 (2.763.1)
<!-- en: your-custom-nodes-on-a-pod-and-what-the-pod-is-doing-2-763-1 5d518be0fbb3 -->

- **渲染在等待它的 Pod 時**，狀態列上方的一行會說明正在發生什麼：啟動 Pod、重新建立它、等待它的 ComfyUI、把風格的檔案和節點包放上去，或者在等你回答 Pod 的詢問。任務日誌的 [pod] 行記錄每一步。
- **無法使用的 Pod 會停止渲染**，原因寫在日誌裡 - 不會再改到別處去渲染。在 Pod 的詢問中按 Cancel 會取消這次渲染。
- **Basic Settings ▸ GPU ▸ Both：** 有自己 Pod 的風格，或其類型在某個 Pod 上被勾選的風格，會送到那個 Pod。其他風格在沒有勾選
  Image（或 Video）時在這臺電腦上渲染 - 任務日誌會說明這一點以及怎樣改變。
- **你的自訂節點會上 Pod：** bitGen 為風格建立的 Pod 會裝上這臺電腦 ComfyUI 的所有自訂節點包，然後重新啟動它的 ComfyUI。來自 GitHub（或其他 git 地址）的包會在 Pod 上按你現有的同一版本 clone；其他包 - 以及 Pod 無法 clone 的包，比如私有的 -
  會在這裡打成 zip（不含 __pycache__ 和超過 50 MB 的檔案）並上傳。Pod 上已有的包保持不動，你停用的包（.disabled）不會發送。
  🖥 My pods 中 Pod 專案裡的 **⬆ My custom nodes** 可以對任何 Pod 做同樣的事。
- 當風格需要 Pod 上沒有的節點時，bitGen 會問這臺電腦的 ComfyUI 這個節點來自哪個包，併發送那個包。重新啟動時如果 Pod 有
  ComfyUI-Manager 就用它，否則由 RunPod 重新啟動 Pod。
- **2.763.2：** 送到 Pod 的渲染不再先啟動這臺電腦的 ComfyUI，也不再拿風格對照它的模型清單 - 渲染會立即傳送（以前可能還沒到
  Pod 就在這臺電腦上失敗）。渲染失敗時，說明原因的行（[pod]、[gpu]、錯誤）會顯示在日誌的「that one failed」之後。

## 🖥 沒有 Pod 的風格會開啟 PODS 停靠窗 (2.763.3)
<!-- en: the-pods-docker-opens-for-a-style-with-no-pod-2-763-3 b989403c9906 -->

- **用沒有 Pod 的風格按 Generate**，現在會開啟 🖥 PODS 停靠窗（取代小詢問框）。橫幅說明正在等待的渲染，建立表單已經在 RunPod 的「ComfyUI CUDA 13」範本上開啟，**Style** 和它的類型（**For**：Image、Image edit 或 Video）、bitGen 推薦的 GPU（顯示記憶體足夠放下風格模型的最便宜的一個）、**GPUs** 1 和磁碟都已填好。改好 GPU、GPU 數量、雲或磁碟後按 **Create pod**：風格會關聯到新 Pod，這個 Pod
  成為該類型的 Pod，Pod 載入完並有了風格的檔案後渲染就會送過去。
- **或者使用你的某個 Pod：** 渲染等待時，🖥 My pods 中每個 Pod 都會顯示 **▶ Use for <风格>**。▶ Start、⏹ Stop 和 Terminate 照舊。橫幅裡的 **Cancel the render** 會取消這次渲染。
- **渲染現在能到達 Pod：** RunPod 的代理因為渲染 worker 的自我介紹方式，用「HTTP Error 403: Forbidden」拒絕了渲染；現在它會報出自己的名字。即時步數也能通過 Pod 的 https 地址顯示。
- **會等待風格的檔案：** Pod 上的下載會一直跟進到完成。如果風格需要的檔案仍不在 Pod 上，渲染會停止，日誌寫出那個檔案 - 不會送到無法渲染它的 Pod。

## 🖥 PODS 停靠窗：Pod 在做什麼，以及建立前的全部細節 (2.763.4)
<!-- en: the-pods-docker-what-a-pod-is-doing-and-every-detail-before-it-is-made-2-763-4 da94d08fd734 -->

- **Pod 有多忙：** 在 🖥 My pods 中，每個執行中的 Pod 名字旁會顯示 GPU 負載和 GPU 顯示記憶體佔用的條。開啟 Pod 可以看到全部：GPU、顯示記憶體、
  RAM、CPU 和兩個磁碟（容器磁碟和 /workspace）。停靠窗在螢幕上時每幾秒更新一次。
- **Create pod 前的全部細節：** 表單列出 Pod 將會是什麼 - 範本和它的鏡像、GPU 和數量（總顯示記憶體）、每小時價格、雲、兩個磁碟、CUDA 13
  主機、埠、它渲染的風格和負責的類型，以及載入後會放上去的東西（這臺電腦的自訂節點、風格的檔案）。表單的每次改動都會更新它。
- **會選上提示詞停靠窗的風格：** 停靠窗的風格下拉式清單（For、Style 和 Pod 的 Styles）從提示詞停靠窗為 Generate 模式選取的風格開始。
- **已不存在的 Pod 不會自己重建：** 風格的 Pod 在 RunPod 上不存在時，渲染會開啟 PODS 停靠窗，說明 Pod 已不存在，並按舊 Pod 的方式（RunPod 還列出時用它的範本、GPU、數量、雲、磁碟）填好新 Pod - 檢查後按 Create pod，或使用你的某個 Pod。
- **從這臺電腦傳送檔案現在可以了：** bitGen 在傳送時給檔案用了隱藏的名字，所以 RunPod 的 Jupyter 拒絕了上傳（「refused part 1 (HTTP
  400)」）；現在用普通的名字。這包括 Override style 的 checkpoint、LoRA 以及從這臺電腦傳送的自訂節點。大的 checkpoint 需要的時間取決於你的上傳速度。

## 提示
<!-- en: tips 29dfdc949d42 -->

- **標籤勝過描述**——在提示詞中寫 `@anna`，會自動帶上 Anna 的角色設定圖和聲音。
- 當起始影格中沒有出現人臉時，**Cont** 在切換鏡頭後保持角色一致的效果比 **First** 好得多。
- **Free VRAM before every generation**（每次生成前釋放顯示記憶體；位於 Settings → ComfyUI）可在混合生成影像、音樂和影片時避免大多數顯示記憶體不足的錯誤。
- 將滑鼠停留在任何元素上——每個按鈕都有工具提示。熟悉操作之後，可在
  Settings → General 中開啟 *Expert mode*（專家模式），隱藏說明段落。
- 渲染失敗時，其場景卡片和 Queue 日誌中總會說明原因。


<!-- credits:start -->

## 致謝
<!-- en: credits 3eaf20d85f70 -->

**出品與開發：Tim Paul**

**程式設計師：Claude Opus 5.5**

bitGen Studio——本機 AI 影片、影像、音樂和剪輯工作室。一切都在你自己的電腦上執行：無需註冊，無需雲端。

bitGen Studio 建立在許多人的成果之上。感謝以下所有人——我們使用或借鑑了這些專案的程式碼、模型、創意和工具。

### 生成引擎

- **[ComfyUI](https://github.com/Comfy-Org/ComfyUI)**（Comfy Org 和 comfyanonymous）——生成引擎——每種影像、影片和音樂風格都以 ComfyUI 節點圖執行；工作流程的節點圖轉換沿用了其自身前端的做法
- **[comfy-kitchen](https://github.com/Comfy-Org)**（Comfy Org）——int8 ConvRot 權重佈局，已在原生引擎中重新實作（Apache-2.0）
- **[llama.cpp](https://github.com/ggml-org/llama.cpp)**（ggml-org）——本機 LLM（llama-server），為 ✨ Enhance、提示詞聊天、劇本和視覺描述生成器提供支援
- **[stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp)**（leejet）——最早的影像和影片後端（sd-cli）
- **[Hugging Face diffusers](https://github.com/huggingface/diffusers)**（Hugging Face）——原生引擎所遵循的 MiniMax H3 權重轉換和模組化管線（Apache-2.0）
- **[Hugging Face Hub](https://huggingface.co)**（Hugging Face）——模型檔案的來源
- **[FFmpeg](https://ffmpeg.org)**——編譯、匯出、代理檔案以及所有音訊 / 影片轉換

### 影片模型

- **[MiniMax H3](https://huggingface.co/Comfy-Org/MiniMax-H3)**（MiniMax）——主要影片模型——文字、參考圖、首幀 / 尾幀、原生音訊
- **[Viggle-Animate](https://huggingface.co/Viggle/Viggle-Animate)**（Viggle AI）——角色動畫；其推論程式碼（Apache-2.0）為原生引擎提供了指引
- **[LTX-Video](https://github.com/Lightricks/LTX-Video)**（Lightricks）——LTX 影片風格和官方範本
- **[Wan](https://github.com/Wan-Video)**（Wan 團隊）——Wan 影片風格、攝影機路徑（ATI）和 VR 世界
- **SeedVR2**（ByteDance Seed）——放大鏡次
- **FastH3 Omni**——用於 MiniMax H3 節點圖的 FastH3 配方
- **Veda**——MiniMax H3 的可選稀疏注意力加速器
- **[MiniMax-H3-NativeAudio-MusicVideo-Workflow](https://github.com/Shrek3OnVH5/MiniMax-H3-NativeAudio-MusicVideo-Workflow)**（Shrek3OnVH5）——MMH3_NativeAudio_MV 風格所基於的音樂影片唇形同步工作流程（MIT）

### 影像模型

- **Qwen Image 和 Qwen Image Edit**（Qwen 團隊，Alibaba）——圖片風格、✏ Edit、填充以及 Sketcher 的真實照片
- **FLUX.2 和 FLUX 3 Klein**（Black Forest Labs）——圖片風格、編輯以及 LoRA 訓練底模
- **Krea 2**（Krea）——圖片風格（Turbo 和 Raw）
- **FIBO 2.0**（Bria）——Fibo 2.0 Edit 風格
- **Anima、MOSS-Image、SDXL 和 Pony 模型**——更多圖片風格
- **SAM 2 (Segment Anything)**（Meta）——Select Subject、貫穿整個鏡頭的去背
- **Hunyuan3D 2.1**（Tencent）——🧊 圖片轉 3D（遵循其自身的社群授權條款）
- **TRELLIS.2**（Microsoft）——🧊 圖片轉 3D
- **[cadrille](https://github.com/col14m/cadrille)**（col14m）——SolidCraft 中的 ✨ Generate 根據描述或圖片編寫零件程式碼（權重為 CC BY-NC 4.0）
- **[CadQuery](https://github.com/CadQuery/cadquery)**——執行這些零件程式碼

### 語言、語音和音樂

- **Qwen3、Qwen3.5、Qwen3.8 和 Qwen3-VL**（Qwen 團隊，Alibaba）——推薦的本機 LLM、視覺描述生成器以及微調底模
- **Gemma 4**（Google）——本機 LLM 和微調底模
- **WeVisOne-VL**——視覺附加元件
- **[faster-whisper](https://github.com/SYSTRAN/faster-whisper)**（SYSTRAN）——轉錄、卡拉 OK 逐字歌詞、按轉錄稿剪輯、語音聊天
- **Whisper**（OpenAI）——faster-whisper 所執行的語音識別模型
- **OmniVoice**——文字轉語音和聲音複製
- **[OpenAudio / fish-speech](https://github.com/fishaudio/fish-speech)**（Fish Audio）——最早的文字轉語音引擎
- **Ming-3.0 和 Bark**——語音附加元件
- **YuE**——歌曲生成（YuE2），既可作為獨立引擎執行，也可在 ComfyUI 中執行
- **[Demucs](https://github.com/facebookresearch/demucs)**（Meta）——分軌分離（人聲 / 伴奏）

### 訓練

- **[ai-toolkit](https://github.com/ostris/ai-toolkit)**（Ostris）——🎓 LoRA 和檢查點（checkpoint）訓練器
- **[Unsloth](https://github.com/unslothai/unsloth)**——LLM 和視覺模型微調

### ComfyUI 節點套件

- **[ComfyUI-KJNodes](https://github.com/kijai/ComfyUI-KJNodes)**（Kijai）——MiniMax H3 長影片節點以及許多輔助節點
- **[ComfyUI-GGUF](https://github.com/city96/ComfyUI-GGUF)**（city96）——GGUF 模型載入
- **[ComfyUI-VideoHelperSuite](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite)**（Kosinkadink）——在節點圖中載入和儲存影片與音訊
- **[comfyui-inpaint-nodes](https://github.com/Acly/comfyui-inpaint-nodes)**（Acly）——影像編輯器的選取範圍填充
- **[comfyui_controlnet_aux](https://github.com/Fannovel16/comfyui_controlnet_aux)**（Fannovel16）——ControlNet 前處理器
- **ComfyUI-MiniMaxH3Mod、Spectrum-MiniMax-H3、ComfyUI-H3-NativeAudioLock**——角色 RefMod、MiniMax H3 加速、音樂影片的歌曲鎖定
- **Nougan Nodes、RH DLSS 5、SolarRenderer**——區域角色 LoRA 和 Prompt Relay、⚡ DLSS 5、☀ 太陽光渲染

### 內置於套用

- **[three.js](https://threejs.org)**——所有 3D 檢視（MIT）
- **[opentype.js](https://github.com/opentypejs/opentype.js)**——3D 文字（MIT）
- **[pdf.js](https://mozilla.github.io/pdf.js/)**（Mozilla）——在影像編輯器中開啟 PDF（Apache-2.0）
- **[pdf-lib 和 fontkit](https://pdf-lib.js.org)**——儲存嵌入字型的 PDF（MIT）
- **[ag-psd](https://github.com/Agamnentzar/ag-psd)**（Agamnentzar）——PSD 檔案及其文字效果（MIT）
- **[polygon-clipping](https://github.com/mfogel/polygon-clipping)**——Sketcher 的牆（MIT；另含 splaytree 和 robust-predicates）
- **[replicad 和 OpenCascade](https://replicad.xyz)**——參數化 3D 實體（MIT；OpenCascade 為 LGPL-2.1）
- **jxl-oxide、libjxl 和 @jsquash/jxl**——JPEG XL 的開啟和儲存（MIT / Apache-2.0 / BSD-3-Clause）
- **[Node.js、Express 和 Multer](https://nodejs.org)**——應用程式的伺服器
- **[Electron](https://github.com/electron/electron)**——桌面應用程式
- **Python、NumPy、OpenCV、soundfile 和 pyaaf2**——工作處理程序、追蹤、節拍、聲音和 AAF 匯出
- **[OpenTimelineIO](https://opentimeline.io)**——時間軸交換（OTIO、FCP XML、EDL）
- **[uv](https://github.com/astral-sh/uv)**（Astral）——安裝程式所用的 Python
- **ReportLab、pypdf、jsdom 和 Playwright**——指南 PDF 和測試套件

### 3D 模型

- **[女性人體模型](https://www.cgtrader.com/designers/dimasalcalde?utm_source=credit&utm_source=credit_item_page)**（dimasalcalde (CGTrader)）——Sketcher 的 🧍 人體模型（模型）——Furniture 工具中的 People
- **[女性人體模型](https://www.cgtrader.com/designers/zahers?utm_source=credit&utm_source=credit_item_page)**（zahers (CGTrader)）——Sketcher 的 🧍 人體模型（模型）——Furniture 工具中的 People

### 文字效果和字型

- **[Dandyson EEbu (Baridakara)](https://www.facebook.com/dandyson.godspower)**——文字效果和字型

### 與 bitGen Studio 配合使用的程式

- **[Blender](https://www.blender.org)**（the Blender Foundation）——Blender 附加元件：場景和渲染雙向互通、3D 圖層、姿勢
- **[Unreal Engine 和 MetaHuman](https://www.unrealengine.com)**（Epic Games）——bitGen Bridge 外掛：Unreal 圖層、攝影機、燈光、即時檢視
- **[Daz Studio](https://www.daz3d.com)**（Daz 3D）——Daz 橋接和即時連結
- **[SolidCraft](https://solidcraft.io)**（Tangency Labs）——開源參數化 CAD，位於其獨立的面板中
- **[Civitai](https://civitai.com)**——模型詳情、範例、搜尋和下載
- **[RunPod](https://www.runpod.io)**——在遠端 GPU 上渲染
- **DaVinci Resolve 和 Final Cut Pro**——時間軸的匯出和導回

### 創意與靈感

- **[Krita AI Diffusion](https://github.com/Acly/krita-ai-diffusion)**（Acly）——影像編輯器的選取範圍 Generate / Fill / Remove 按模型系列沿用了它的技術
- **Wan2GP 和 mmgp**（deepbeepmeep）——將模型塊流式傳輸到 GPU 的思路（未使用其程式碼）
- **Sketcher 的家具庫**——家具、人物和材質——最初為早期版本的 House builder 製作
- **專業創意工具**——照片編輯器、向量和繪圖程式、影片編輯器、動態圖形工具、3D 建模軟體和參數化 CAD 程式；影像編輯器、時間軸、CAD 工具和 Sketcher 都沿用了它們的工作方式
- **每一位測試 bitGen Studio 的人**——以及告訴我們哪裡需要修復的人

bitGen Studio 採用 MIT 授權。上述每個專案都保留其各自的授權條款——misc/NOTICE.md 列出了隨軟體附帶的內容、需要下載的內容以及模型授權條款。模型權重由你自行下載，並遵循其製作者的條款。
<!-- credits:end -->
