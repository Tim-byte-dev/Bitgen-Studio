# bitGen Studio — 功能參考

bitGen Studio 是一款本地離線的 AI 影片與影像工作室：無需帳戶，不依賴雲端，任何資料都不會離開你的電腦。它驅動 ComfyUI 和本地模型（MiniMax H3、LTX 2.5 / 2.3、Wan 2.1 / 2.2、FLUX、SDXL、Qwen Image 等），並由本地 LLM 撰寫提示詞和劇本，同時把圍繞它們的一切集中在一個視窗中：用於電影和音樂影片的場景板、完整的時間軸編輯器、帶向量 / CAD / AI 工具的分層影像編輯器、參數化 3D 人體，以及連線 Blender、Daz Studio 和 Unreal Engine 5.8 的橋接。本參考按領域分組，列出了迄今為止的全部功能。

## 工作區

視窗、各個面板、應用外觀、專案及其包含的檔案。

### 視窗與選單列

- **一個視窗容納所有面板** — 左側面板（系統狀態與設定）、References、Assets、中央面板（Preview、Timeline、StoryBoard、Music、Stems、SFX、Image editor、ComfyUI、Prompt、Prompt chat、Console）、Queue 和 Gallery。 *Where:* 主視窗
- **選單列** — 新建專案、開啟、儲存、截圖、錄製、回收站、重設專案、設定以及彈出所有已載入的模型，全部排在同一行中；無論顯示哪些面板，位置都保持不變。 *Where:* 標題欄下方的一行。 *Since:* 2.382.1
- **在下拉式清單中搜尋** — 每個包含 8 項或以上的清單開啟時都帶有搜尋框：輸入文字即可篩選（先匹配詞首，再按順序匹配字母），用方向鍵和 Enter 選擇；直接按一個字母會開啟清單並開始搜尋。 *Where:* 所有下拉式清單；Settings > General > Dropdown lists。 *Since:* 2.478.0
- **狀態列面板按鈕** — 每個面板都有一個按鈕，面板在螢幕上（展開或摺疊）時按鈕亮起；點選一次隱藏面板，再點選一次重新顯示。 *Where:* 狀態列。 *Since:* 2.386.0
- **系統狀態** — 電腦的即時讀數，每塊顯示卡都有單獨的邊框和圖表（溫度、顯示記憶體）。 *Where:* 左側面板
- **功耗與時脈頻率** — 每塊顯示卡的功率（以瓦計，相對其上限）和時脈頻率、CPU 的時脈頻率（以及電腦提供時的功耗）、啟動以來消耗的電能。 *Where:* System stats。 *Since:* 2.517.0
- **任務消耗的電能** — 以 Wh / kWh 計（顯示卡 + 可讀取時的 CPU），以及平均和峰值功率，顯示在任務日誌、任務卡片和專案的任務清單中。 *Where:* Queue 的 Done 分頁。 *Since:* 2.517.0
- **彈出模型** — 解除安裝所有已載入的模型以釋放顯示卡。 *Where:* 選單列
- **無邊框應用視窗** — 工作室以帶自訂標題欄的獨立視窗開啟，而不是瀏覽器分頁；瀏覽器方式仍然可用。 *Where:* 桌面應用。 *Since:* 2.45.0
- **主控台** — ComfyUI、各工作程序和每個任務的即時日誌。 *Where:* Console 面板
- **ComfyUI 面板** — ComfyUI 自身的介面嵌入在工作室中，並帶有重新載入和在瀏覽器中開啟的按鈕。 *Where:* ComfyUI 面板。 *Since:* 2.120.0
- **處處有工具提示，專家模式** — 每個按鈕都有工具提示；熟悉操作後，Expert mode 會隱藏幫助段落。 *Where:* Settings > General
- **空格鍵隨處暫停** — 只要不是在輸入文字，Space 即可暫停畫布、即時預覽或 Preview 面板中的影片。 *Where:* 任意位置。 *Since:* 2.410.0
- **媒體檢視器** — 點選任意縮圖即可全視窗開啟：在清單中滑動切換、以指標為中心縮放、平移、播放影片和聲音、開啟原檔案。 *Where:* Gallery、Assets 和 References。 *Since:* 2.80.0
- **檢視器中的渲染詳情** — 預覽對話方塊顯示圖片或片段的種子、CFG、步數、取樣器、模型、LoRA、尺寸、渲染時間和提示詞。 *Where:* 預覽對話方塊

### 面板與佈局

- **停靠或浮動時最大化** — 適用於 Sketcher、Timeline 和 Image editor：停靠時，⛶ 填滿所在列的高度，並把下方的面板向下推；浮動時，⛶ 佔滿整個視窗並關閉其他面板（還原時恢復）。Sketcher 在列中有自己可調整的高度。 *Where:* 面板的 ⛶。 *Since:* 2.658.0
- **摺疊與最大化** — 每個面板都可以摺疊到只剩標題欄，或者最大化；其他面板保持開啟並保留各自的高度，按 Esc 還原。 *Where:* 每個面板的標題欄
- **固定** — 固定按鈕會鎖定面板目前的高度（側邊面板則為寬度）；之後可以縮小，但不能變高。 *Where:* 每個面板標題欄中的第一個按鈕。 *Since:* 2.381.0
- **記住的佈局** — 每個面板的狀態、高度、寬度、固定和最大化都儲存在 docker_status.json 中，並在任何內容繪製之前載入。 *Where:* 安裝資料夾。 *Since:* 2.381.0
- **面板配置** — 為每組經常一起開啟的面板儲存一個佈局（尺寸、哪些面板在螢幕上、側邊面板和浮動面板），每組最多六種螢幕尺寸，自動載入。 *Where:* 選單列右側的 Docker layout 按鈕。 *Since:* 2.392.0
- **浮動提示詞面板** — 提示詞面板可以作為獨立視窗浮動；可拖曳、調整大小、摺疊，或停靠到其他面板的上方、下方或旁邊。 *Where:* 按鍵 P。 *Since:* 2.389.0
- **浮動的 Basic Settings 與 LLM tokens** — 兩者都是獨立面板：可以浮動，可以作為分頁停靠到其他面板中，可以放在某一列的旁邊或裡面，也可以放入左側面板的清單。 *Where:* 按鍵 S 和 L。 *Since:* 2.393.0
- **命名面板** — 建立一個使用自訂名稱的空浮動面板，再把浮動面板作為分頁停靠進去；它可以浮動在整個應用之上，也可以限定在某個面板之內。 *Where:* Docker layout > New docker。 *Since:* 2.438.0
- **▣ Docker：供其他面板放入的空面板** — 用狀態列的 ▣ Docker 或 Ctrl+Alt+D 顯示它，用 ⇱ 讓主面板浮動後拖進去；橙色線條顯示每個面板的落點（並排或堆疊），並有分隔條用於調整大小。 *Where:* 狀態列 > ▣ Docker。 *Since:* 2.545.0
- **拖入面板、設為常駐、刪除** — 拖曳主面板自身的標題欄即可將其拖入；📌 把 ▣ 面板變成主列中的常規面板，🗑 刪除它及其按鈕；狀態列按鈕顯示它的名稱。 *Where:* ▣ 面板的標題欄。 *Since:* 2.549.0
- **面板標題右鍵選單** — 右鍵點選你建立的面板（浮動或常駐），可選擇 Rename、其佈局、Make permanent / Float it again 以及 Delete docker。 *Where:* ▣ 面板的標題欄。 *Since:* 2.550.0
- **命名面板的佈局與標題** — 命名面板把其中的面板顯示為分頁、並排或堆疊（標題中的 ⇆ / ⇅，或 ⚙ > Layout）；雙擊標題即可就地重新命名。 *Where:* 命名面板的標題欄。 *Since:* 2.545.0
- **對話方塊置中顯示** — 對話方塊和訊息框在螢幕中央開啟，或在你上次移動到的位置開啟。 *Where:* dialog_layout.cfg。 *Since:* 2.438.0
- **面板佈局檔案** — 每個浮動面板的位置、尺寸、名稱和分頁都儲存在 panel_layout.cfg 中。 *Where:* 安裝資料夾。 *Since:* 2.438.0
- **StoryBoard 可以浮動** — StoryBoard 面板可以成為獨立視窗，作為分頁停靠到命名面板中，或回到時間軸下方。 *Where:* StoryBoard 標題欄。 *Since:* 2.456.0

### 主題與外觀

- **主題** — Dark、Darker（OLED 純黑）、Slate、Light 和 High contrast 會改變整個應用的外觀，影像編輯器也包括在內。 *Where:* Settings > Themes。 *Since:* 2.432.0
- **強調色** — 為按鈕、亮起的分頁和滑塊設定任意顏色。 *Where:* Settings > Themes。 *Since:* 2.432.0
- **介面大小** — 一個滑塊同時縮放所有字型和面板，範圍為 60 到 175 %。 *Where:* Settings > Themes。 *Since:* 2.432.0
- **自訂顏色** — 為主題的每個部分單獨設定顏色（背景、面板、線條、文字、正常、錯誤、懸停、畫布、選取）。 *Where:* Settings > Themes > Customize。 *Since:* 2.435.0
- **已儲存的主題** — 把主題儲存為 themes 資料夾中的 .json 檔案，從其卡片載入，匯出和匯入；匯入時會把你原來的主題保留為 <name>_old.json，立即儲存匯入的主題，↶ Revert 可以恢復原樣（2.709.0）。 *Where:* Settings > Themes。 *Since:* 2.435.0
- **主題編輯模式** — 點選螢幕上的任意元素即可選取它，並更改其字型、大小、顏色、陰影、圓角半徑或圖示，可作用於此元素、所有同類元素或其整個類別。 *Where:* 頂端列中的畫筆按鈕。 *Since:* 2.443.0
- **主題編輯模式下對話方塊照常可用** — 該模式開啟時，對話方塊和彈出選單照常響應點選和按鍵。 *Where:* 主題編輯模式。 *Since:* 2.455.0
- **編輯器主題** — 影像編輯器跟隨應用主題，或使用自己的 Pro、Studio 或 Classic 外觀。 *Where:* 影像編輯器的 Window > Theme。 *Since:* 2.393.0

### 專案與儲存

- **專案** — 所有內容都存放在各自的專案資料夾中：輸出、影片、影像、聲音、角色和場景。 *Where:* 選單列的 New、Open 和 Save
- **儲存一切內容** — 歌曲和場景、提示詞、對話、角色、環境、參考圖、素材、相簿、時間軸以及每個面板的欄位。 *Where:* 選單列的 Save。 *Since:* 2.372.0
- **另存新檔** — 以新名稱複製整個專案並開啟副本；已存在的名稱會被拒絕。 *Where:* 選單列。 *Since:* 2.372.0
- **新建專案從零開始** — 先儲存你離開的專案，然後每個面板都清空重新開始。 *Where:* 選單列的 New。 *Since:* 2.371.0
- **回收站** — 刪除的檔案會進入專案的回收站；可以還原、永久刪除或清空回收站。 *Where:* 選單列。 *Since:* 2.374.0
- **重設專案** — 清空專案並以相同名稱重新建立，同時停止其渲染並清除其已完成的任務。 *Where:* 選單列。 *Since:* 2.374.0
- **整個專案檔案（.bgp）** — 整個專案儲存為一個 XML 檔案，可以自包含全部媒體，也可以是一個小清單；採用流式讀寫，因此數 GB 也沒問題；開啟它會建立一個新專案。 *Where:* 選單列中的打包按鈕。 *Since:* 2.436.0
- **電影包** — 在 StoryBoard 上新建、儲存和載入整部電影（演員陣容、章節、場景和渲染）。 *Where:* StoryBoard 的選單列。 *Since:* 2.151.0

### 素材、參考圖、相簿與佇列

- **素材面板** — 專案中的影像、影片和聲音；把檔案拖放到上面即可匯入。 *Where:* Assets 面板
- **素材分組** — （2.635.0：一個分組就是 Assets 資料夾中的一個資料夾）把檔案歸入分組；Send 把檔案移入該資料夾，Add 則同時在那裡建立連結。 *Where:* Assets 面板
- **SolidCraft 全視窗** — SolidCraft 面板上的 ⛶ 會填滿整個視窗（標題欄和狀態列保留）並關閉其他面板；🗗 / Esc 將佈局恢復原樣。 *Where:* 📐 SolidCraft 面板。 *Since:* 2.638.0
- **Shift+右鍵點選退出 Artist 模式** — 在影像編輯器僅顯示畫布的 Artist 模式中，在任意位置 Shift+右鍵點選即可退出（不彈出右鍵選單）；Ctrl+Esc / Ctrl+Shift+F 仍然有效。 *Where:* 影像編輯器 ▸ 🎨 Artist mode。 *Since:* 2.637.0
- **bitGen Default 主題 + Ctrl+Alt+S** — Ctrl+Alt+S 可在任意位置開啟 Settings；Ctrl+Alt+Shift+T、⟲ bitGen Default 或 ?theme=default 會恢復內建預設主題（Dark，無元素樣式，介面大小 100 %），↶ The theme before 可復原此操作；內建主題不能被覆蓋或刪除。 *Where:* 任意位置；Settings ▸ Themes。 *Since:* 2.636.0
- **全域素材與專案素材** — Assets 面板中的 📁 Project | 🌐 Global | All；專案素材位於 projects/<name>/Assets，全域素材（所有專案可用）位於 projects/Assets；上傳的檔案進入 Assets；右鍵點選可選擇 🌐 Move to Global / 📁 Move to Project。 *Where:* Assets 面板。 *Since:* 2.635.0
- **選擇並刪除素材** — 勾選、Ctrl+點選或 Shift+點選圖塊；刪除會把它們移入回收站，絕不會直接永久刪除。 *Where:* Assets 面板
- **新增圖塊** — 虛線框的新增圖塊會開啟檔案對話方塊，用於新增圖片、影片或聲音，一次可新增多個。 *Where:* References 和 Assets。 *Since:* 2.394.0
- **參考圖面板** — 隨下一次生成一起傳送的圖片、影片和聲音；可從 Assets 或 Gallery 拖入。 *Where:* References 面板
- **相簿** — 所有渲染結果，分為影像、影片和音訊分頁；可以從這裡拖到參考圖、時間軸或場景上。 *Where:* Gallery
- **佇列** — 顯示卡上一次只執行一個任務；可以暫停、重新排序、中止和重試，每個任務都有自己的日誌。 *Where:* Queue。 *Since:* 2.122.0
- **Pending 與 Done 分頁** — 排隊中、執行中和被中斷的任務與已完成的任務分開顯示，並隨專案儲存；被中斷的任務可以繼續。 *Where:* Queue。 *Since:* 2.113.0
- **單張執行卡片** — 正在執行的渲染顯示為一張卡片，包含其提示詞、模式、尺寸、進度列以及分塊 / 步數 / 時間。 *Where:* Queue。 *Since:* 2.400.0
- **清除已完成的任務** — 從清單中移除所有已完成、失敗和已取消的任務，但不刪除檔案。 *Where:* Queue 標題欄
- **中止對話方塊** — 停止目前渲染、將其放到佇列最前面重試，或停止全部任務。 *Where:* Abort 按鈕
- **可重用的種子** — 每個已完成任務的詳細資訊，帶有一個按鈕，可把它的種子填回 Basic Settings。 *Where:* Queue 的資訊按鈕。 *Since:* 2.384.0
- **即時 ComfyUI 進度** — 每個影片任務都會顯示正在執行哪個節點以及 "step n of total"。 *Where:* Queue、場景卡片和 Generate 按鈕

### 檔案對話方塊與另存新檔

- **bitGen 自己的檔案對話方塊** — 快速存取、應用和專案資料夾、每個驅動器及其可用空間、位址列、支援萬用字元的搜尋、詳細資訊或大圖示檢視、新建資料夾和重新命名；在 Windows、macOS 和 Linux 上完全一致。 *Where:* 每個資料夾按鈕和 Choose file
- **從相簿另存新檔** — 每個相簿圖塊都有一個另存新檔圖示，會以 Save As 模式開啟檔案對話方塊。 *Where:* Gallery 圖塊
- **快速儲存** — 預覽對話方塊中的 Save 會把檔案複製到上次另存新檔的資料夾，不彈出對話方塊，也絕不覆蓋現有檔案。 *Where:* 預覽對話方塊

### 截圖螢幕錄影與遠端使用

- **截圖** — 把應用視窗或整個螢幕儲存到相簿。 *Where:* 選單列（Alt+Shift+S）
- **螢幕錄製** — 把應用或螢幕錄製為 H.264 mp4，可錄入電腦聲音和麥克風，並帶倒計時。 *Where:* 選單列（Alt+Shift+R）
- **在手機上使用** — 二維碼遠端連結：手機可以拍照和錄影、傳送音訊並與模型對話；所有內容都會進入專案。 *Where:* Settings > General。 *Since:* 2.132.0
- **音訊視覺化** — 任何正在播放的聲音都會在預覽中顯示即時視覺化效果（頻譜、波形、圓環、粒子、語譜圖）。 *Where:* Preview。 *Since:* 2.106.0
- **360 度播放器** — 以環視檢視觀看任意等距柱狀投影影片：拖曳環顧，滾輪縮放。 *Where:* 播放器的 360 按鈕。 *Since:* 2.119.0

### 設定、模型與安裝

- **安裝程式** — 每個系統一個安裝程式，可安裝 Node.js、Python、ComfyUI、節點包和模型，並針對你的顯示卡進行調優。 *Where:* 安裝檔案。 *Since:* 2.331.0
- **公開測試版倉庫** — 帶有 README 的原始碼、每個版本的更新日誌、貢獻指南和安全指南、問題範本，以及每次推送時執行的自動測試（scripts/ci-units.sh）；docs/BETA.md 說明哪些功能是實驗性的，以及如何報告問題。 *Where:* GitHub 倉庫、docs/BETA.md、CHANGELOG.md。 *Since:* 2.477.0
- **模型目錄** — 下載各功能所需的模型（影片、影像編輯、放大、3D 模型、Viggle 等），大檔案可使用 Hugging Face token 和 Hugging Face CLI 下載。 *Where:* Settings > Models > Model catalog
- **節點包** — 安裝 ComfyUI 自訂節點包；任務開始時，缺少的節點會連同其所屬節點包一起列出。 *Where:* Setup > Node packs
- **本地 LLM** — 選擇模型、啟動和停止其伺服器、重新掃描資料夾；啟動時會自動選取正在執行的模型。 *Where:* Settings > LLM。 *Since:* 2.43.0
- **LLM token** — 即時估算提示詞的 token 數，並提供回覆預算滑塊。 *Where:* LLM tokens 面板（L）。 *Since:* 2.148.0
- **每次生成前釋放顯示記憶體** — 在混合生成影像、音樂和影片時，可避免大多數顯示記憶體不足的錯誤。 *Where:* Settings > ComfyUI
- **影片加速器** — 按影片風格啟用 Sage attention、Spectrum 和 Comfy Kitchen 加速，一鍵安裝。 *Where:* Settings > ComfyUI 以及影片風格。 *Since:* 2.116.0
- **為任意 ComfyUI 節點圖連線** — 載入工作流，將其轉換為 API 提示，新增你自己的開關、下拉式清單、滑塊和文字框，並把它們連線到節點圖中的數值。 *Where:* Settings > ComfyUI > Graphs。 *Since:* 2.120.0
- **節點圖模式** — 用你建立的控制項從 Generate 執行已連線的節點圖；其中的載入節點會自動從參考圖面板取得內容。 *Where:* Basic Settings > Graph。 *Since:* 2.120.0
- **工作流轉換** — 把 UI 工作流轉換為 API 提示（展開子圖以及 Set / Get 節點），現在使用 ComfyUI 自己的前端完成。 *Where:* Settings > ComfyUI > Graphs。 *Since:* 2.402.1
- **模型檔案匹配** — 工作流中指定的模型檔案會與你的 ComfyUI 中已有的檔案進行匹配，任務日誌會註明匹配結果。 *Where:* 每個任務。 *Since:* 2.345.0
- **3D 設定** — 參數化 3D 人體的引擎以及 Unreal Engine 橋接設定。 *Where:* Settings > 3D。 *Since:* 2.471.0

## 生成影片

從單個提示詞到整部電影：提示詞面板、影片模型、參考圖、角色和 StoryBoard。

### 提示詞面板與生成

- **一個生成按鈕** — 按鈕下方的下拉式清單決定它生成什麼：影片、影像、音樂、語音、已連線的節點圖或對話回覆。 *Where:* 提示詞面板
- **生成、編輯、精修、填充、替換背景、移除** — 在 Image 模式下，選單列上的下拉式清單決定 Generate 對影像編輯器中的圖片做什麼，類似 Krita AI 外掛；Refine 帶有強度滑塊，按鈕上的文字會隨所選項變化。 *Where:* 提示詞面板的選單列。 *Since:* 2.541.0
- **參考圖或圖層** — 影像編輯器關閉時，Edit、Refine、Replace background 和 Compose 使用 References 面板中的圖片（Fill 和 Remove 不出現在清單中）；影像編輯器開啟時，它們使用選取的圖層或多個選取的圖層；一個標籤會顯示目前使用的是哪一種。 *Where:* 提示詞面板的選單列。 *Since:* 2.543.0
- **合成** — 用最多三張圖片合成一張圖片：可以是在影像編輯器中選取的圖層，也可以是 References 面板中的圖片。 *Where:* 提示詞面板的下拉式清單。 *Since:* 2.543.0
- **生成模式** — Ref（參考圖片）、F/L（首幀 / 尾幀）、Text 和 Swap。 *Where:* Basic Settings
- **一個提示詞生成多個任務** — 單獨佔一行的 /br/ 會把提示詞拆分成多個依次執行的任務。 *Where:* 提示詞框
- **按 Enter 最佳化提示詞** — 按 Enter 會把提示詞傳送給本地 LLM，由它進行改寫。 *Where:* 提示詞框
- **所有工具共用一個提示詞面板** — 影像編輯器的 AI、時間軸的 Fill、路徑圖層、AI 場景、3D 外觀、角色、環境和 VR 世界，都從提示詞面板取得文字。 *Where:* 按鍵 P。 *Since:* 2.419.0
- **負面提示詞面板** — 畫面中不能出現的內容，隨每次生成一起傳送；其狀態會顯示所選模型是否使用它，LLM 輸出的 "Negative:" 行也會放到這裡。 *Where:* 按鍵 2，或狀態列中的 Negative。 *Since:* 2.419.0
- **快捷提示詞** — 以第一行為名稱儲存提示詞，之後可從清單中再次選用。 *Where:* 提示詞面板的選單列。 *Since:* 2.451.0
- **生成進度** — 按鈕上方顯示執行中任務的步數，下方顯示進度列。 *Where:* Generate 按鈕
- **清空提示詞** — 只清空提示詞框。 *Where:* 提示詞面板的標題欄。 *Since:* 2.117.0
- **語音輸入** — Speak 通過麥克風錄音，並把識別出的文字新增到提示詞中。 *Where:* 提示詞面板。 *Since:* 2.87.0

### 提示詞對話與本地 LLM

- **提示詞對話** — 與本地 LLM 一起推敲創意；回覆中的提示詞會變成可以直接渲染的區塊。 *Where:* Prompt chat 面板。 *Since:* 2.85.0
- **儲存、載入和清除對話** — 對話以“主題 - 日期”的形式儲存，並按從新到舊排列；清除會清空視窗和模型的記憶。 *Where:* Prompt chat。 *Since:* 2.370.0
- **LLM 能看到你的參考圖** — 按托盤順序排列的圖片（附帶本地視覺模型生成的一行描述）、影片和聲音，讓它寫出帶有正確標籤的提示詞。 *Where:* Prompt chat。 *Since:* 2.354.0
- **針對模型編寫提示詞** — 選擇 LTX 或 Wan 風格後，LLM 會專門為該模型編寫提示詞。 *Where:* Prompt chat。 *Since:* 2.419.0
- **為 MiniMax H3 調整的語音提示詞** — 臺詞會被轉換為 H3 的對白語法，並帶上語言和音色；多餘的指令會被清理掉。 *Where:* 每次提示詞渲染
- **朗讀回覆** — 用所選聲音朗讀每條回答。 *Where:* Prompt chat。 *Since:* 2.87.0
- **長篇鏡頭清單** — 當要求的內容比一個片段更長時，LLM 會編寫一份可依次銜接的編號鏡頭清單。 *Where:* Prompt chat。 *Since:* 2.126.0
- **360 度與立體 VR 提示詞** — 當你提出要求時，LLM 會學習等距柱狀投影和左右並排立體的提示詞規則。 *Where:* Prompt chat。 *Since:* 2.118.0

### 基本設定與影片風格

- **基本設定** — 模式、解析度、長寬比、秒數、步數、CFG、種子、格式、LoRA、ControlNet 和麵部修復。 *Where:* 按鍵 S
- **種子** — -1 表示隨機種子，填入數字則使用該種子，骰子按鈕重新隨機，另一個按鈕可使用上一次的種子。 *Where:* Basic Settings。 *Since:* 2.384.0
- **臨時 LoRA** — 在風格自帶的 LoRA 之上，為接下來的渲染額外新增的 LoRA。 *Where:* Basic Settings。 *Since:* 2.111.0
- **影片風格卡片** — 所選的影片風格，顯示其每個階段的模型、步數、CFG、編碼器、VAE、LoRA 和負面提示詞；在卡片上更換模型會儲存到該風格中。 *Where:* Basic Settings 頂部。 *Since:* 2.401.0
- **覆蓋風格** — 由 Basic Settings 決定所有影片模型（MiniMax H3、Wan、LTX）的步數、CFG、種子、模型和額外 LoRA。 *Where:* Basic Settings。 *Since:* 2.409.0
- **影片風格** — 每種模式儲存的一套模型和工作流，對分階段取樣的模型還包含各個階段；複製一個風格即可保留變體。 *Where:* Settings > Video。 *Since:* 2.110.0

### MiniMax H3

- **三種渲染方式** — 參考圖片（最多九張）、首幀 / 尾幀，或僅用文字，均帶原生聲音。 *Where:* Basic Settings 的模式
- **長片段無縫拼接** — 超過單次執行長度的片段會被拆分後再拼接起來。 *Where:* Seconds
- **長影片：單次執行最長 30 秒** — 低顯示記憶體注意力和分塊前饋讓最長 30 秒的 MiniMax H3 片段可以在一次生成中渲染完成，而不必拼接多個 15 秒的片段。 *Where:* StoryBoard 的 ⚙（Long video），或 MiniMax H3 Long (30 s) 影片風格。 *Since:* 2.503.0
- **一鍵取得更多 ComfyUI 節點包** — 安裝或更新 KJNodes、Yusu H3 Unified 和 RH DLSS 5。 *Where:* Settings > ComfyUI > Video accelerators。 *Since:* 2.503.0
- **Veda 稀疏注意力** — 影片風格中可選的 MiniMax H3 加速器（On / Quality）：在其訓練尺寸下比標準注意力快約 2-3 倍，可一鍵安裝，其預測器在模型目錄中。 *Where:* Settings > Video styles；Settings > ComfyUI > Video accelerators。 *Since:* 2.536.0
- **根據盲測調整的 Veda 與 Spectrum** — Veda 會跳過提示詞描述打鬥、變形、爆炸或追逐的鏡頭（這類鏡頭省時不多，畫面還會變軟；☑ 動作鏡頭也使用 Veda 可保留），並取代 Long video 的低顯示記憶體注意力，而不再被跳過；Spectrum 在 12 步以上的執行中讓前 2 步和最後 3 步真實計算，使臉部保持清晰。 *Where:* 設定 ▸ 影片樣式 ▸ Veda 稀疏注意力 / Spectrum。 *Since:* 2.717.0
- **可管理數百個模型的模型管理器** — 適應面板大小的分頁、資料夾分頁（SDXL、Pony …）、📌 This project 分頁、可調整大小的卡片、每個模型的資訊頁（含範例圖片和提示詞），每個模型的 Civitai 詳情 + 縮圖 + 範例都儲存在一個共享的 model_info 資料夾中。 *Where:* 🧩 Models。 *Since:* 2.537.0
- **Civitai 下載到各類型的資料夾** — 任意 Civitai 卡片上的 ⤓ 會下載到你為該類型選定過一次的資料夾（SDXL LoRA、Pony 模型、Wan LoRA …）；Shift+點選可更改；📁 列出這些資料夾（model_folders.json）；🔄 Sync 為電腦上的每個模型取得 Civitai 詳情。 *Where:* 🧩 Models。 *Since:* 2.538.0
- **參考圖描述** — 每張參考圖片、每個參考影片和聲音下方都有一段簡短描述，隨專案和分組儲存，用於對映行、提示詞對話和 ✨ Enhance；另有牆 / 地板 / 家具 / 燈光等圖片類型。 *Where:* References 面板。 *Since:* 2.539.0
- **影像編輯器中的參考圖** — 拖入的參考圖會變成一個圖層；✨ Edit 可以把參考圖用作 Picture 2。 *Where:* 🖼 Image editor。 *Since:* 2.539.0
- **藉助參考圖讓渲染變為寫實** — 每個 Blender / Unreal 物件都會與一張參考圖片匹配，可按名稱匹配或手動指定。首幀由編輯模型藉助這些圖片變為寫實畫面，然後由 LTX 2.3 3DREAL 沿著渲染讓它動起來。 *Where:* 🟧 Timeline 的 Blender scene / UNREAL ▸ Render to Real，🖼 影像編輯器的 3D 和 Unreal 圖層。 *Since:* 2.540.0
- **附加元件** — Settings ▸ Add-ons 列出可選引擎（YuE2 音樂、Viggle native）：每個引擎的用途、需求和大小，以及是否已安裝；可執行 ⤓ Install / ⟳ Reinstall / 🗑 Remove，日誌顯示在該分頁中。 *Where:* Settings ▸ Add-ons。 *Since:* 2.540.4
- **⟳ 重新安裝與安裝狀態** — 任何已安裝的內容都會顯示 ⟳ Reinstall（已下載的模型顯示 ⟳ Download again），點選會重新取得全部內容；安裝或下載進行時，其按鈕被停用，旁邊的狀態顯示目前步驟、百分比和秒數，結束後顯示 ✓ 或 ✗ 及原因。 *Where:* Settings（Add-ons、Audio、ComfyUI、Models、Extensions）、模型目錄、Civitai、LoRA 訓練器以及各面板的安裝按鈕。 *Since:* 2.601.0
- **從 GitHub 更新** — Settings ▸ General ▸ ⟳ Updates：檢查 GitHub 上是否有更新的版本（列出新的提交），⤓ Update now（git 複製的安裝會切換到 GitHub 的分支，並備份你修改過的檔案；zip 安裝則取得有變化的檔案），依賴清單有變化時執行 npm / pip，⟳ Restart now；啟動後會靜默檢查一次。 *Where:* Settings ▸ General。 *Since:* 2.540.5
- **整潔的應用資料夾** — 應用資料夾中只有 start.bat（+ package.json、README、LICENSE）；伺服器、工作程序、預設設定、安裝腳本和說明都位於 misc\ 中；從 zip 更新的安裝會在首次啟動時清理掉舊的副本（快捷提示詞會保留）。 *Where:* 應用資料夾。 *Since:* 2.591.0
- **在側邊面板旁最大化** — ⛶ 填滿已開啟的 Gallery / Queue / References / Assets / 左側面板之間的空間。 *Since:* 2.538.0
- **圖片類型** — 把參考圖片標記為人物、面部、服裝、首幀或尾幀；標記首幀會把渲染切換為首幀 / 尾幀模式。 *Where:* References 面板。 *Since:* 2.340.0
- **True CFG** — CFG 大於 1 時會增加一次負向計算，只強化你的提示詞所新增的內容。 *Where:* Basic Settings。 *Since:* 2.366.0
- **H3 尺寸** — 選擇如何處理介於 H3 的 32 像素步長之間的尺寸：無條件捨去，或以更大尺寸渲染後再精確裁切回來。 *Where:* StoryBoard 設定。 *Since:* 2.380.0
- **以角色的聲音說出帶情緒的臺詞** — 每句臺詞都帶有自己的情緒，並用角色的複製聲音說出；較長的聲音片段會被裁切為 8 秒的樣本。 *Where:* StoryBoard 和提示詞
- **其他語言** — 在引號內加上語言標籤，這句臺詞就會用該語言說出。 *Where:* 提示詞
- **H3_Viggle 風格** — 由一段動作影片驅動動作，由一張圖片指定表演者。 *Where:* 影片風格清單。 *Since:* 2.352.0

### LTX 2.5 與 LTX 2.3

- **LTX 2.5 模式** — 文字、影像、首幀 / 尾幀、首幀 / 中間幀 / 尾幀、口型同步、首幀 / 尾幀口型同步、音訊轉影片以及影片轉影片（風格遷移）；Auto 會根據參考圖面板中的內容自動選擇。 *Where:* LTX 模式下拉式清單
- **⏱ 定時提示行（Prompt Relay）** — LTX 提示詞中的 `[0-2s] …` 行讓片段的每一段時間在同一次渲染中擁有各自的描述，不帶時間的行則覆蓋整個片段；⏱ 新增下一行。 *Where:* 使用 LTX 風格時的提示詞面板、StoryBoard 場景、時間軸的 AI 片段（Settings ▸ Add-ons ▸ Nougan Nodes）。 *Since:* 2.592.0
- **過渡 LoRA** — 在畫面之間過渡的模式會自動啟用它。 *Where:* Transition 下拉式清單
- **官方範本** — 文字、影像和首幀 / 尾幀使用 ComfyUI 自己的範本執行，只用內建節點。 *Where:* LTX 2.5 風格。 *Since:* 2.401.5
- **StoryBoard 上的 LTX** — 每張場景卡片決定其模式，可以使用也可以不使用故事板的歌曲。 *Where:* StoryBoard Workflow
- **LTX 2.3 模式** — 文字、影像、首幀 / 尾幀以及 3D 渲染轉寫實。 *Where:* LTX 2.3 風格。 *Since:* 2.402.0
- **3D 渲染轉寫實（3DREAL）** — 來自 Blender、遊戲或任何 CG 片段的渲染會變成照片級寫實畫面，同時保持相同的佈局和鏡頭運動；有 strong v2、strong 和 light 三種變體。 *Where:* 帶參考影片的 LTX 2.3。 *Since:* 2.402.0

### Wan 2.1 與 Wan 2.2

- **Wan 模式** — 文字、影像轉影片、首幀和尾幀，以及角色參考（VACE）。 *Where:* Wan 風格
- **自動建構節點圖** — bitGen 用 ComfyUI 自己的節點建構 Wan 節點圖，並按名稱選取正確的模型檔案。 *Where:* Wan 風格
- **24 fps 輸出** — Wan 的 16 fps 通過運動插幀提升到 24 fps，以便與你的其他片段銜接；參考圖面板中的第一個聲音會鋪在畫面下方。 *Where:* Wan 渲染

### 參考圖

- **參考影片與聲音** — 參考渲染可各附帶最多三個影片和聲音；需要時會自動在工作流中新增缺少的插槽。 *Where:* References > Video 和 Sound。 *Since:* 2.353.0
- **選擇參考影片的幀** — 迴圈播放的預覽、可縮放的膠片條和選擇框；Apply 會精確裁出這些幀。 *Where:* References > Video
- **向後追加 / 向前追加** — 渲染一段新的部分，從影片的最後一個影格開始（或在其第一幀結束），再與原影片拼接，始終以首幀 / 尾幀方式進行。 *Where:* 影片的 Use 下拉式清單。 *Since:* 2.388.0
- **時間軸捕獲** — 任意圖層上播放頭所在的幀都可以成為首幀、尾幀或參考圖。 *Where:* 時間軸的捕獲按鈕。 *Since:* 2.117.0
- **Qwen Image 2.1 讀取參考圖面板** — 圖片按順序傳送，並根據其類型在提示詞中命名。 *Where:* 影像生成。 *Since:* 2.340.0

### 角色、地點與環境

- **角色** — 名稱、詳細資訊、角色設定圖（正面 / 側面 / 背面）和一段聲音片段；它的 @標籤 會把設定圖和聲音帶入提示詞。 *Where:* StoryBoard > Characters
- **從一張圖片建立角色** — 上傳一張照片或渲染圖，即可生成參考設定圖。 *Where:* 從圖片新建按鈕
- **演員** — 選擇目前場景中有哪些角色出場。 *Where:* Actors 按鈕
- **服裝與身份模型** — 服裝條目跟隨角色；每個角色都保留一個數據集資料夾，用於身份模型。 *Where:* 角色
- **360 度環境** — 以全景圖形式呈現的地點，帶有攝影機和場景範圍，並投影為平面檢視以保持畫面連貫。 *Where:* StoryBoard > Environments。 *Since:* 2.142.0

### StoryBoard（場景板）與電影

- **建立劇本** — 描述一個故事，LLM 就會寫出各個場景，並讓角色說出各自的臺詞。 *Where:* 提示詞面板
- **場景數量** — 輸入場景數量，或交由專案、你的要求或 LLM 來決定。 *Where:* StoryBoard
- **每個場景如何銜接** — Ref（新鏡頭）、First（精確地從上一鏡次的某一幀開始）、Cont（該幀加上角色設定圖）、Trans（從該幀過渡到新地點）。 *Where:* 每張場景卡片
- **渲染單個場景或所選場景** — 渲染在後臺繼續進行，你可以同時編輯。 *Where:* 場景的播放按鈕、Render selected
- **膠片條** — 點選某個鏡次中的一幀，即可將其設為下一個場景的首幀。 *Where:* 每個鏡次下方
- **鏡次欄** — 觀看、保留、重做、更換角色或放大某個鏡次。 *Where:* 故事板下方
- **製作首幀** — Qwen Image 2.1 根據角色、地點和道具製作場景的開場畫面。 *Where:* 場景的 First / Last 插槽。 *Since:* 2.337.0
- **合成影片** — 按場景順序把已渲染的鏡次拼接成一部影片。 *Where:* StoryBoard 的選單列
- **場景下拉式清單** — 以下拉式清單形式呈現的故事板，帶有可顯示每個場景狀態的場景選擇器。 *Where:* StoryBoard。 *Since:* 2.391.1
- **場景進度** — 每張卡片上顯示 "rendering step n of total"，並帶有進度列和時間。 *Where:* 場景卡片。 *Since:* 2.391.1
- **渲染設定** — 尺寸、步數、LoRA、加速器、放大器和尾幀。 *Where:* StoryBoard 的設定按鈕
- **場景種子** — 每個場景隨機，或所有場景使用同一個種子；每張卡片都有自己的種子框。 *Where:* StoryBoard 設定。 *Since:* 2.384.0
- **渲染尺寸** — 優先使用 StoryBoard 的設定，否則使用 Basic Settings，再否則使用應用預設值；任務備註會註明使用的是哪一個。 *Where:* StoryBoard
- **StoryBoard 圖片** — 用任意影像模型根據每個場景的提示詞生成一張圖片，並使用角色設定圖、地點和參考圖；可將其用作首幀或尾幀。 *Where:* StoryBoard 工具列。 *Since:* 2.456.0
- **生成所有缺失的圖片** — 渲染每一張尚未生成的場景圖片。 *Where:* StoryBoard 工具列。 *Since:* 2.456.0
- **資訊行** — StoryBoard 的最新訊息，滑鼠懸停時顯示全文。 *Where:* StoryBoard 底部。 *Since:* 2.391.0
- **動作插槽** — 使用 H3_Viggle 時，每個場景可接收一段動作影片。 *Where:* 場景卡片。 *Since:* 2.352.0

### 音樂影片與口型同步

- **載入歌曲** — 歌曲開啟後，其波形會自動分段；每段對應一個場景。 *Where:* StoryBoard 的 Audio
- **建立音樂影片** — 編劇把歌曲的各個分段用作場景，並讓角色演唱。 *Where:* 提示詞面板
- **逐場景口型同步** — 每個場景對自己所對應的那段歌曲進行口型同步。 *Where:* 音樂影片故事板
- **由轉錄文字決定** — 歌曲帶時間戳的轉錄文字決定哪些場景需要演唱，並把歌詞放入提示詞。 *Where:* 音樂影片故事板。 *Since:* 2.356.0
- **場景對齊歌曲時間** — 每個鏡次都會放到時間軸上其對應歌曲部分開始的時間點。 *Where:* Timeline 設定
- **橋接場景** — 歌曲分段之間的短過渡，可由模型渲染，也可繪製為標準轉場。 *Where:* 歌曲條的 Transition 選項

### 角色替換

- **替換影片中的角色** — 在現有影片中換上一個新人物；表演、鏡頭、背景和聲音都保持不變。 *Where:* Basic Settings > Swap
- **替換鏡次** — 把已渲染場景中的角色替換到它的下一個鏡次中。 *Where:* 鏡次欄
- **替換對話方塊** — 適用於整部電影：載入任意長度的影片，自動分段，逐段替換，保留併合成。 *Where:* StoryBoard 的 Swap 按鈕
- **替換品質** — Full、Best 或 Fast。 *Where:* Swap 對話方塊。 *Since:* 2.336.0
- **編寫提示詞** — 視覺模型和 LLM 根據圖片和影片編寫替換提示詞。 *Where:* Swap 對話方塊。 *Since:* 2.335.0
- **LTX Ripple 引擎** — 生成一張帶有新角色的首幀，並將其貫穿整個片段。 *Where:* Swap 對話方塊的 Engine。 *Since:* 2.339.0
- **Viggle 引擎** — 通過 ComfyUI 執行的 Viggle-Animate，或 bitGen 自己的原生引擎，後者在各分段之間始終保持模型已載入。 *Where:* Swap 對話方塊的 Engine。 *Since:* 2.344.0
- **多個首幀** — 每個分段最多生成四個首幀，再從中選擇一個。 *Where:* Swap 對話方塊。 *Since:* 2.348.0
- **安全模式** — 出現黑屏的鏡次會在關閉所有可能導致黑屏的選項後重新渲染。 *Where:* Swap 對話方塊的設定。 *Since:* 2.350.0
- **VR 替換** — 通過虛擬攝影機替換 360 度或 180 度影片中的人物；立體雙眼畫面根據深度重建。 *Where:* Swap 對話方塊的 VR 一行

### VR

- **VR 世界** — 把表演者置於 360 度或 180 度圖片之中：調整攝影機朝向，新增表演者的圖片、聲音和提示詞，並帶 VR 後設資料進行渲染。 *Where:* StoryBoard 的 VR World 按鈕
- **鎖定背景** — 表演者以外的區域，雙眼都直接顯示圖片本身。 *Where:* VR World

### 放大與增強

- **SeedVR2 放大** — 把影片放大到 720p-4K 或按倍數放大，支援顏色匹配、時間分段和降噪。 *Where:* 預覽欄。 *Since:* 2.400.0
- **⏫ 圖片的 Enhance** — 點擊一張圖片（圖庫的 Images、Image 素材、參考面板），⏫ Enhance 就會放大它：×2–×4 或短邊 1080–2160 px，可用 SeedVR2（恢復細節）、ComfyUI 的 models/upscale_models 中的放大模型，或不需要 ComfyUI 的 Lanczos；結果是圖庫中的 PNG。 *Where:* 提示詞面板的 ⏫ Enhance。 *Since:* 2.733.0
- **DLSS 5 增強、放大與幀生成** — 對影片進行 NVIDIA DLSS 5 神經渲染（default / natural / cinematic），放大到 1x DLAA、1.5x-3x 或 1K-8K，並可選用幀生成，最高可達原幀率的 6 倍；僅限 RTX 顯示卡。 *Where:* 預覽欄的 ⚡ DLSS 5，以及故事板上 StoryBoard 的 ⚙ Upscaler。 *Since:* 2.504.0
- **RTX VFX 影片精修** — 對影片進行 NVIDIA RTX Video Super Resolution 處理，可選先進行一遍 Deblur，再進行一遍 High Bitrate（預設 A：VSR；預設 B：先 Deblur，再 High Bitrate；或自行選擇處理步驟），縮放 1x-4x，每次處理一批幀；適用於 Windows 上的 RTX 顯示卡，通過 DENO ComfyUI 節點實現。 *Where:* 預覽欄的 ✨ RTX VFX、StoryBoard 的 ⚙ Upscaler，以及用於安裝的 Settings > ComfyUI > Video accelerators。 *Since:* 2.708.0
- **RelayVSR 放大** — 在 ComfyUI 內建節點中執行的一步影片放大器：x2（用 MiniMax H3 片段訓練）或 x4，auto 會選擇能達到所選尺寸的那一對；正好 1920 × 1080（先覆蓋再裁切）或任意尺寸，保留原來的聲音。 *Where:* 預覽欄的 🔁 RelayVSR、StoryBoard 的 ⚙ Upscaler，檔案在 Settings > Add-ons > RelayVSR。 *Since:* 2.728.0
- **🕺 從影片取得動作（FlowHMR）** — 把影片中的人物捕捉為 3D 動作：帶動畫的骨架（.fbx）和 SMPL-H（.npz）存入專案的 models3d，可用於時間軸的 3D 圖層、Blender、Daz 和 Unreal；支援移動或固定鏡頭。僅限非商業用途（SMPL-H 人體模型以及 Meta 的 SAM 3D Body / VGGT-Omega 授權）。 *Where:* 預覽列的 🕺 動作，以及 Settings > Add-ons > FlowHMR 動作捕捉。 *Since:* 2.730.0
- **MiniMax H3 的 16 GB 模式** — 在你的 H3 渲染中使用 DENO 的 R2V Turbo 8+2 方案：取樣前解除安裝文字編碼器，第一遍以你設定的尺寸執行 8 步，然後進行潛在空間放大（×1.0-2.0），再用稀疏注意力進行 2 步精修，並保留聲音；Auto 會為顯示記憶體 16 GB 或以下的顯示卡自動開啟，ComfyUI 缺少的部分會被省略並附上說明。 *Where:* Settings > ComfyUI > 16 GB mode；所需檔案位於 Settings > Add-ons > 16 GB mode。 *Since:* 2.708.0
- **💬 bitGen 社群** — 類似 Facebook 的小型聊天面板：用使用者 ID 加入，在共享的 Help 聊天室中提問，新增好友（需對方先接受），私聊，舉報 / 封鎖，管理員可以刪除訊息和封停用戶；伺服器為 PHP + MariaDB（倉庫中的 community/）。它是一個獨立的浮動面板（可浮動 / 停靠 / 作為分頁放入其他面板，位置會被記住 - 2.711.0）。 *Where:* 狀態列的 💬 Community。 *Since:* 2.710.0
- **社群：姓名 + 已驗證的郵箱** — 加入時需要填寫名字、姓氏和電子郵件地址（只有管理員能看到）；系統會向該地址傳送一個 6 位驗證碼，確認之後才會開放 Help 聊天室（可以 Send a new code，或更改地址）；封禁也會同時封禁該郵箱地址，因此被封禁的成員無法以新的使用者 ID 重新加入；老成員會在下次登入時被要求補充這些資訊。 *Where:* 💬 Community ▸ Join，⋯ ▸ Your details。 *Since:* 2.713.0
- **討論區** — tigerart.com.au 上的論壇，與 💬 Community 使用同一個帳戶：Help / Show your work / Ideas / General；成員發帖立即顯示，訪客可以閱讀和發帖（訪客的帖子需先經管理員批准）；管理員可以批准、拒絕、刪除和封禁，並能看到真實姓名。 *Where:* 💬 Community ▸ ⋯ ▸ Discussions，或 tigerart.com.au/discussions.php。 *Since:* 2.713.0
- **增強所選影片** — 為你最後點選的影片開啟放大器。 *Where:* 提示詞面板。 *Since:* 2.401.0
- **在故事板上放大** — 把你滿意的鏡次送入 StoryBoard 的放大器，或以放大解析度使用 SeedVR2 處理；也可以選擇放大每一次渲染。 *Where:* StoryBoard 設定

### 音效（SFX 面板）

- **新增聲音和影片** — 音訊檔案以及影片檔案中的聲音，以 48 kHz WAV 格式儲存。 *Where:* SFX 面板
- **剪輯聲音** — 在波形上選擇，設定固定時長框，保留或刪除所選部分（帶無爆音的淡入淡出），可復原。 *Where:* SFX 面板
- **單個圖層上的範圍** — 把位置標記放在起點，在圖層上 Shift+點選終點：即得到該圖層上的範圍；✂ Cut 只從該圖層中刪除整個範圍，↶ / Ctrl+Z 可復原。 *Where:* 時間軸的圖層。 *Since:* 2.603.0
- **時間軸復原 / 重做** — 對時間軸的每次編輯都是一個步驟：使用其選單列中的 ↶ / ↷，或在圖層上按 Ctrl+Z / Ctrl+Shift+Z。 *Where:* 時間軸。 *Since:* 2.603.0
- **傳送到相簿和素材** — 每次剪輯的結果都會複製到相簿；也可以將其傳送到 Sound 素材。 *Where:* SFX 面板
- **語音與對白** — 由 OmniVoice 或 Ming-3.0 TTS 朗讀輸入、貼上或由 LLM 編寫的文字，可以只用一個聲音，也可以是一組角色（按 "Name (emotion): line" 為每位說話者指定聲音和情緒），支援聲音標籤和停頓；儲存為 WAV 或 MP3，放入 Audio 素材。 *Where:* SFX 面板 ▸ 🗣 Speech & dialog。 *Since:* 2.621.0
- **帶情緒的語音** — 中性、開心、悲傷、憤怒、恐懼、厭惡、驚訝：使用 Ming-3.0 TTS 的情緒任務（複製聲音同樣適用）；使用 OmniVoice 時，則通過語速、以該情緒錄製的聲音（"Name.happy"）和聲音標籤來表現。 *Where:* SFX 面板 ▸ 🗣 Speech & dialog。 *Since:* 2.621.0
- **語音檔案中的後設資料** — 標題、日期和時間、描述、文字以及所用的聲音會寫入 WAV（INFO）或 MP3（ID3）。 *Where:* SFX 面板 ▸ 🗣 Read & save。 *Since:* 2.621.0

## 影像

根據文字和參考圖生成靜態圖片，支援 ControlNet 引導、面部修復和 AI 編輯。

### 影像生成

- **影像風格** — FLUX.2 Klein、SDXL、Pony、Illustrious、Z-Image、Qwen Image 等，每種風格都是一套已儲存的工作流、模型組合和 LoRA 堆疊。 *Where:* Settings > Image. *Since:* 2.66.0
- **自動啟動 ComfyUI** — ComfyUI 未執行時，Generate Image 會自動啟動它。 *Where:* Generate. *Since:* 2.73.0
- **來自 ComfyUI 的模型下拉式清單** — 模型、VAE、編碼器和 LoRA 欄位只列出 ComfyUI 實際能載入的檔案。 *Where:* Settings > Image. *Since:* 2.71.0
- **一次生成多張** — 每按一次最多生成八張圖片。 *Where:* Generate
- **🩹 修復 / 還原照片** — 一個按鈕即可把提示詞面板切換為 🖼 Image + ✏ Edit，並在提示詞中填入修復指令（修復劃痕、灰塵、汙漬、褪色、雜訊和模糊，保留人物、面部和構圖）；提示會說明 Edit 使用的是哪張圖片（References 面板中的圖片，或影像編輯器的圖層）；Ctrl+點選直接開始修復，Shift+點選則在修復的同時為黑白照片上色（2.655.0）。 *Where:* 提示詞面板的左欄. *Since:* 2.654.0
- **影像編輯風格** — 根據最多三張參考圖編輯圖片（FLUX.2 Klein edit），使用 Qwen Image 2.1 edit 時可用更多參考圖。 *Where:* 影像模式下的 Generate. *Since:* 2.69.0
- **FLUX 3 Image Klein** — Black Forest Labs 的 5.6B 開放模型，提供三種風格：distilled（快速）、base（cfg 3.5）和 edit（最多 4 張參考圖）；參考圖面板中有圖片時，文生圖風格會自動切換到編輯圖。 *Where:* 影像風格下拉式清單；模型在 Settings > Setup 中取得. *Since:* 2.502.0
- **Krea 2** — Krea 的 12B 開放影像模型，提供四種風格：Turbo（8 步）和 Raw（52 步，帶負面提示詞），各有 safetensors 和 GGUF 兩種格式。 *Where:* 影像風格. *Since:* 2.516.0
- **Anima** — CircleStone Labs 的 2B 動漫 / 插畫模型，提供兩種風格（Aesthetic v1.1、Base v1.0；30 步，cfg 4）。 *Where:* 影像風格. *Since:* 2.517.0
- **佇列預設** — Normal / Quiet（夜間）/ Eco / Cool-down / Max performance / Custom：設定 GPU 功耗上限、任務之間的休息時間、顯示卡過熱時等待，以及降頻警告。 *Where:* 選單列的 ⏱. *Since:* 2.518.0
- **模型管理器** — 以卡片形式展示你的模型和 LoRA（縮圖、評分、釋出日期、類型、類別、關鍵詞；懸停時顯示說明卡片），選擇一個模型和若干 LoRA，用它們覆蓋風格，✚ 以某個模型新建風格，✎ 編輯卡片，🔍 在 Civitai 上查詢。 *Where:* 狀態列中的 🧩 Models. *Since:* 2.518.0
- **Civitai 下載** — 搜尋 civitai.red / civitai.com，並連同卡片直接下載到對應的 ComfyUI 資料夾。 *Where:* Model manager 的 Civitai 分頁；金鑰在 Settings ▸ General 中設定. *Since:* 2.518.0
- **電費** — 每 kWh 的電價：每個任務的 ⚡ 卡片、其 [power] 行以及啟動以來的耗電量都會顯示費用。 *Where:* Settings ▸ General. *Since:* 2.518.0
- **測試面板** — 某個版本需要做的測試，完成後逐項勾選（很多會自動勾選），可寫備註，💾 儲存日誌以便上傳。 *Where:* Settings ▸ General ▸ 🧪 Testing. *Since:* 2.518.0
- **安裝程式詢問你的硬體** — 安裝程式偵測不到時，會詢問顯示卡（從清單中選擇）、記憶體和 CPU；“Not right?” 可修改。 *Where:* 安裝程式的第一頁. *Since:* 2.519.0
- **安裝包** — Editor（無 AI）/ + small AI / + mid-size AI / Everything，按你的顯示卡推薦；安裝前即可看到你能使用哪些功能（✓ ~ ✗，可以以後再新增）以及下載量。 *Where:* 安裝程式的 Your package 頁面；setup-cli --packages. *Since:* 2.519.0
- **每日供電費** — 電費帳單上的固定日費用：任務費用按其執行時長計入相應份額。 *Where:* Settings ▸ General ▸ Energy cost. *Since:* 2.519.0
- **LoRA 訓練器** — 使用 ai-toolkit（Ostris）以你的圖片訓練 LoRA：九種基礎模型（Z-Image Turbo、FLUX、Qwen-Image、SDXL、SD 1.5、Chroma、Wan 2.1…）、觸發詞、rank、步數、帶描述文字的資料集（或由助手生成描述）、可編輯的 YAML、即時顯示步數 / loss / 樣圖；訓練好的 LoRA 連同卡片存入 ComfyUI 的 loras/trained；可將任務匯出為 zip。 *Where:* 狀態列的 🎓 LoRA. *Since:* 2.520.0
- **峰谷電價** — 設定峰時電價和峰時時段（星期幾 + 時間，也可跨越午夜）；其餘時間均為谷時；任務分別統計峰時和谷時耗電量。 *Where:* Settings ▸ General ▸ Energy cost. *Since:* 2.520.0
- **用量日誌** — 按天記錄每個任務的耗電量、峰時佔比、費用和所用遠端 GPU；可選時間範圍、顯示合計、匯出 CSV。 *Where:* Settings ▸ General ▸ 📊 Usage…，或點選狀態列中的 ⚡ 數值. *Since:* 2.520.0
- **遠端 GPU** — 使用另一臺機器上的 ComfyUI、RunPod pod（列出 / 啟動 / 停止，以及其代理）或 SSH 隧道；✓ Test；Use it / Use this computer。 *Where:* Settings ▸ Remote generation. *Since:* 2.520.0
- **本機與安裝包** — 你的硬體、已安裝的安裝包、每種安裝包可使用的功能；✎ Not right?；⬆ 無需重新安裝即可升級到更大的安裝包。 *Where:* Settings ▸ Models. *Since:* 2.520.0
- **分組下載** — 每個模型組一個核取方塊，並顯示其檔案數量和大小。 *Where:* 安裝程式的模型頁面；Settings ▸ Models ▸ Model downloads. *Since:* 2.520.0
- **檢查點微調** — 使用 ai-toolkit 訓練影像模型（Lumina 2、Flex.1、FLUX.2 klein、SDXL）的全部權重，通過參數交換降低顯示記憶體佔用；結果合併為 diffusion_models/trained 中的一個 .safetensors 檔案。 *Where:* 🎓 LoRA ▸ Type. *Since:* 2.521.0
- **LLM 微調** — 使用 Unsloth 以你自己的對話訓練助手（Qwen3.5 0.8B-9B、Gemma 4、Qwen3.8 27B；LoRA / QLoRA / 全量）；範例可手動輸入或匯入（JSONL / JSON / CSV）；輸出為 LLM 資料夾中的 .gguf。 *Where:* 🎓 LoRA ▸ Type. *Since:* 2.521.0
- **視覺模型微調** — 以圖片 + 回答訓練視覺模型（Qwen3.5 / Gemma 4 vision）；輸出 .gguf 和 mmproj 到視覺模型資料夾。 *Where:* 🎓 LoRA ▸ Type. *Since:* 2.521.0
- **融合 LoRA** — 將訓練好的 LoRA 合併到其基礎模型中，生成新的檢查點（ComfyUI），任何顯示卡均可。 *Where:* 🎓 LoRA ▸ Run & samples. *Since:* 2.521.0
- **FLUX.2 klein LoRA** — 可將 FLUX.2 klein base 4B 用作 LoRA 的基礎模型。 *Where:* 🎓 LoRA ▸ Base model. *Since:* 2.521.0
- **錯誤報告** — Ctrl+Alt+Shift+B：視窗截圖（可用 ✏ / ▭ 標註）、標題、嚴重程度、出現位置、發生了什麼 / 預期結果、操作步驟（⤵ 錄製的點選和按鍵——絕不記錄輸入的文字），並附帶日誌、系統 + 設定（隱藏金鑰）、頁面錯誤和失敗的請求；💾 儲存為一個 .zip 以便傳送；以前的報告可 ⤓ / 🗑。 *Where:* 任意位置（Ctrl+Alt+Shift+B）；Settings ▸ General ▸ 🐞 Report a bug…. *Since:* 2.522.0
- **向社群傳送錯誤報告** — 📤 Save and send 將報告發布到網站的 Discussions ▸ Bug reports 下：已登入 💬 Community 時以你的身份釋出（立即顯示），未登入或勾選 ☑ Send anonymously 時匿名釋出（需管理員先稽核）；公眾可見標題和你寫的內容，日誌、設定、系統資訊和截圖僅管理員可見；管理員可設定其狀態，並將所有錯誤下載為一份清單。 *Where:* 🐞 Bug report ▸ 📤 Save and send；Earlier reports ▸ 📤. *Since:* 2.714.0
- **載入器跟隨模型檔案** — 風格的 .safetensors 或 .gguf 模型會自動使用匹配的 ComfyUI 載入器（Load Diffusion Model / GGUF 載入器）——GGUF 風格也能渲染 .safetensors 微調模型，反之亦然。 *Where:* 每個影像風格. *Since:* 2.523.0
- **無論模型在哪個 ComfyUI 資料夾中都能找到** — 風格的擴散模型如果放在 models/checkpoints（或其他子資料夾）中，會通過 Load Checkpoint / ComfyUI 列出的名稱載入，而不會報錯 "Value not in list"；不在任何資料夾中的模型會給出提示，說明應放在哪裡。 *Where:* 每個影像、影片和音樂任務. *Since:* 2.525.0
- **工作區** — 選單列中的 Workspace 下拉式清單：Basic、Image editing、Video editing、Music video、Expert。每個工作區顯示該類工作所需的面板，隱藏用不到的按鈕（不會停用任何功能），並記住你自己的改動；↺ 可重設某個工作區。 *Where:* 選單列. *Since:* 2.526.0
- **🩺 風格診斷** — 一鍵用每種影像風格生成一張小測試圖（Quick：512 × 512，4 步；或 Real），並顯示通過 / 失敗表格：失敗的日誌行及處理方法（ComfyUI 未列出的模型及其應放入的資料夾、缺少的節點包、ComfyUI 未執行、顯示記憶體不足、檔案損壞、文字編碼器不匹配）。■ 停止，↻ 重測單項，⤓ 將報告匯出為 .md。 *Where:* 選單列中的 🩺. *Since:* 2.527.0
- **🔍 查詢任何內容（Ctrl+K）** — 命令面板，覆蓋所有面板、浮動視窗、選單 / 狀態列按鈕、Settings 欄位、工作區、Generate 模式、風格、指南章節和快捷鍵；按 Enter 即顯示 / 開啟 / 執行，指南會在 📖 Help 視窗中開啟。 *Where:* Ctrl+K 或選單列中的 🔍. *Since:* 2.530.0
- **每個模型檔案都能在 ComfyUI 列出的位置找到** — 位於其他子資料夾中的文字編碼器、VAE、LoRA 和 ControlNet 會以 ComfyUI 中的名稱使用；完全不在任何資料夾中的檔案，會給出可下載它的模型目錄條目名稱。 *Where:* 每個任務；🩺 Style doctor. *Since:* 2.531.0
- **自動勾選的測試** — 🧪 測試清單中凡是應用偵測到已正常工作的專案都會被勾選並保留（auto ✓），重新啟動後依然有效。 *Where:* Settings -> General -> 🧪 Testing. *Since:* 2.532.0
- **▁ ⛶ ✕ 面板標題欄** — 將浮動面板最小化為標題欄、最大化到整個視窗並可還原，或將其關閉。 *Where:* 每個浮動面板. *Since:* 2.532.0
- **📷 讓相機在房屋中漫遊** — 在平面圖上拖曳相機，3D 檢視會透過它觀察；方向鍵使其轉向和俯仰，Shift / Alt 使其升高和降低。 *Where:* 🏠 House. *Since:* 2.532.0
- **🧪 測試模式** — 根據你目前所在位置推薦下一項測試（影像編輯器：模糊、畫筆、橡皮擦……），應用偵測到某項測試正常工作時詢問 'Did it work?' 並提供建議框，將你的回答和建議記錄在日誌中；關閉後不會自動勾選也不會彈出任何內容。 *Where:* Settings -> General；🧪 Testing 面板. *Since:* 2.534.0
- **新渲染加入已開啟的預覽** — 預覽開啟期間完成的圖片會加入其縮圖條；✨ N new 可跳轉到新圖片。 *Where:* 圖片 / 影片預覽. *Since:* 2.534.0
- **編輯影像模式只顯示編輯風格** — 影像編輯器開啟時，影像風格下拉式清單只列出能夠編輯圖片的風格，關閉編輯器後恢復你原來的選擇。 *Where:* 提示詞面板. *Since:* 2.502.0

### ControlNet 與面部修復

- **ControlNet** — 先渲染第一張圖片，將其轉換為控制圖（線稿、深度、姿態），再用第二個模型渲染最終圖片。 *Where:* Basic Settings
- **ControlNet 鏈式風格** — 按名稱儲存的兩階段風格。 *Where:* Settings > ControlNet. *Since:* 2.97.0
- **面部修復** — 重新繪製最終圖片中的每一張臉；自 2.593.0 起為附加元件（在 Settings ▸ General 中開啟，其模型會自動下載）。 *Where:* Basic Settings
- **工作室中的附加元件** — 在 Settings ▸ General 中開啟或關閉 Face fix 和 ControlNet：關閉 = 隱藏且從不使用；開啟 = 顯示，且缺少的內容（節點包、模型）會自動下載到對應的 ComfyUI 資料夾——每次啟動時也會檢查；它們的 Add-ons 卡片列出了所有下載連結。 *Where:* Settings ▸ General / Settings ▸ Add-ons. *Since:* 2.593.0

### 將圖片送入影像編輯器

- **生成的圖片直接放到畫布上** — 影像編輯器開啟時，Generate 生成的每張圖片都會作為新圖層放到最前面的文件中。 *Where:* 提示詞面板. *Since:* 2.431.0
- **由圖片生成 3D 模型** — Gallery 和 Assets 中的每張圖片都可以變成 3D 模型（Hunyuan3D 2.1 或 TRELLIS.2）。 *Where:* 每張圖片上的 3D 按鈕. *Since:* 2.404.0
- **🧊 轉換為 3D（右鍵）** — 右鍵點選 Gallery、Assets 或 References 中的圖片，或影像編輯器的畫布（整張圖片或所選圖層，也可用 Layer ▸ Convert Layer to 3D），選擇 Hunyuan3D 2.1 或 TRELLIS.2 以及模型的去向：影像編輯器（一個可環繞檢視、渲染並據此生成內容的 3D 圖層）、SolidCraft 面板，或僅放入專案的 3D 模型中。 *Where:* 右鍵點選圖片. *Since:* 2.594.0

## 音樂、人聲與聲音

歌曲、分軌、人聲及其中的歌詞。

### 音樂

- **根據歌詞和風格生成歌曲** — 使用 MiniMax Music3 或 YuE2，每按一次最多生成四首歌曲。 *Where:* Music 面板. *Since:* 2.90.0
- **音樂風格** — 可重複使用的描述（曲風、BPM、調性、情緒、嗓音），附帶其工作流和設定。 *Where:* Settings > Music
- **翻唱和樂譜** — 在 Music 面板中製作。 *Where:* Music 面板
- **🎼 五線譜上的樂譜，可存為 PDF** — 把樂譜畫成真正的五線譜（譜號、調號和拍號、音符、符槓、休止符、變音記號、延音線、和弦名稱、歌曲段落），可全尺寸閱讀專案中或這台電腦上的任何 .abc，並儲存為 A4 的 PDF 放進專案的 pdf 資料夾；由 bitGen Studio 自己繪製，不用外部函式庫。 *Where:* Music 面板的 🎼 Sheet Music 分頁。 *Since:* 2.731.0
- **🎨 樂譜的紙張** — 任意紙張顏色、鋪滿整頁的材質（羊皮紙、亞麻、條紋紙、再生紙、水彩紙、畫布、牛皮紙）或專案中/這台電腦上的圖片，平鋪大小和強度，以及墨色（自動：淺色紙用深色，深色紙用淺色）；螢幕上和儲存的 PDF 裡都一樣，也可儲存為白底 PDF 便於列印。 *Where:* Music 面板的 🎼 Sheet Music 分頁 ▸ 🎨 Paper。 *Since:* 2.732.0
- **▶ 播放樂譜** — 播放／暫停、後退一小節、回到開頭、前進一小節、到結尾；正在發聲的音符會亮起，小節會被標出，樂譜自動跟隨，點擊音符即跳到那裡；播放樂譜旁邊的歌曲（帶用於前奏的 Sync），或由瀏覽器演奏寫出的音符。 *Where:* Music 面板的 🎼 Sheet Music 分頁及其 ⛶ Read。 *Since:* 2.733.0
- **🗣 樂譜下方的歌詞** — 勾選後，Song 分頁的歌詞會放在人聲譜表下方，每個音符一個音節並帶連字號，按段落對應（[verse] / [chorus]），重複的副歌再唱一次；編輯時自動重畫；⛶ Read 和 PDF 中也有。 *Where:* Music 面板的 🎼 Sheet Music 分頁 ▸ words。 *Since:* 2.734.0
- **✨ 唱到的歌詞會亮起** — 樂譜播放時，正在唱的音節會和它的音符一起在人聲譜表下方亮起，延音線和連線期間保持亮著，休止符時熄滅；點擊歌詞即從那裡播放；⛶ Read 中也會亮。 *Where:* Music 面板的 🎼 Sheet Music 分頁 ▸ words + ▶。 *Since:* 2.735.0
- **🎼 聲部與混音** — 總譜一個分頁，每個譜表各一個分頁：每種樂器和人聲都有單獨的樂譜（帶聲部名，人聲聲部帶歌詞），可閱讀並存為 PDF；播放時，用音符播放可逐個譜表開關（Shift+點擊 = 只聽這一個），用歌曲播放則在分離後可開關 Vocals / Instruments（✂ Separate vocals）。 *Where:* Music 面板的 🎼 Sheet Music 分頁。 *Since:* 2.737.0
- **🎚 按圖層播放歌曲** — 樂譜播放真正的歌曲（專案中的任何歌曲，自動找到或按樂譜選擇並記住），分成 Vocals、Drums、Bass 和 Other（✂ Split into layers，在這台電腦上用 demucs），每個圖層一條軌道，帶波形、播放位置、開關（Shift+點擊 = 只聽這一個）和點擊播放；沒有歌曲的樂譜用柔和的鋼琴聲播放音符。 *Where:* Music 面板的 🎼 Sheet Music 分頁。 *Since:* 2.738.0
- **✨ Create** — 一鍵把歌曲（專案中的或這台電腦上的）變成四個圖層及其波形、歌詞（Song 分頁的，或從人聲中聽出）以及音符下方帶歌詞的樂譜，並按圖層播放這首歌。 *Where:* Music 面板的 🎼 Sheet Music 分頁 ▸ Song + ✨ Create。 *Since:* 2.739.0
- **⬇ 缺少的元件就地下載** — 尚未安裝的元件（歌曲分離、語音轉文字）會在帶大小說明的 ⬇ Download / Cancel 框中詢問；Download 會帶進度條安裝，工作隨後自動繼續。 *Where:* ✨ Create、✂ Split into layers、Stems 面板的 Separate。 *Since:* 2.740.0
- **🎶 ACE-Step 1.5 歌曲** — 快速的音樂模型（8 步，MIT 授權）：從文字和歌詞生成帶人聲的歌曲，10 秒到 10 分鐘，50 多種語言；風格可設定 BPM、調、每小節拍數和語言，並可使用 LoRA。 *Where:* Music 面板（風格 ACE-Step 1.5）；設定 ▸ 音訊 ▸ 音樂風格。 *Since:* 2.741.0
- **🗂 基本設定的每個分頁保留自己的設定** — Ref、F/L、Text 和 Swap 各自記住格式、尺寸、秒數、步數、CFG、種子和模型；離開分頁時儲存，回來時恢復（重新啟動後仍保留）；Character chain 保留未儲存的輸入。 *Where:* 基本設定。 *Since:* 2.742.0
- **☁ RunPod Serverless 算圖** — 所有算圖都傳送到 RunPod Serverless 端點（RunPod 的 ComfyUI 工作器，模型在網路磁碟區上），只在工作器執行時計費；圖片、影片和歌曲都會傳回；✓ 測試顯示工作器和任務。 *Where:* 設定 ▸ 遠端 GPU ▸ RunPod Serverless。 *Since:* 2.743.0
- **☁ RunPod Serverless 只顯示能算圖的風格** — 用 RunPod Serverless 端點算圖時，圖片、影片和音樂的風格清單會隱藏它無法算圖的風格（逐個節點對照端點映像檔裡的 ComfyUI）；可以設定更新的 ComfyUI 或額外的節點包。 *Where:* 風格清單；設定 ▸ 遠端 GPU ▸ RunPod Serverless。 *Since:* 2.744.0
- **🖥 基本設定 ▸ GPU：遠端、本機或兩者** — 所有任務在遠端 GPU 上、全部在這裡，或「兩者」：勾選的 LLM、視覺 LLM、圖片和影片 + 歌曲傳送到遠端 GPU；LLM 在 RunPod vLLM 端點上執行（設定 ▸ 遠端 GPU ▸ LLM on RunPod）。 *Where:* 基本設定 ▸ GPU。 *Since:* 2.745.0
- **🏷 遠端風格** — 每個圖片、影片和音樂風格在這台電腦或遠端 GPU 上執行（執行於，可選為風格指定自己的 RunPod 端點；遠端風格的名稱以 R_ 開頭）；基本設定 ▸ GPU 為本機時列出這台電腦的風格，遠端時列出 R_ 風格，兩者時列出全部 - 選兩者時由風格決定在哪裡算圖。 *Where:* 設定 ▸ 圖片 / 影片 / 音訊 ▸ 音樂風格 ▸ 執行於；基本設定 ▸ GPU。 *Since:* 2.746.0
- **🖥 GPU 預設為本機；更新檢查很快** — 基本設定 ▸ GPU 從本機開始，位於基本設定第一項並收合（標題顯示選擇）；更新檢查只向 GitHub 詢問最新提交，任何網路都能幾秒完成，立即更新 在背景下載。 *Where:* 基本設定 ▸ GPU；設定 ▸ 一般 ▸ 更新。 *Since:* 2.747.0
- **🔑 API 金鑰加密儲存，更新後仍在** — Hugging Face、Civitai 和 RunPod 金鑰、遠端存取金鑰以及社群登入儲存在 settings/keys.json 中，每個單獨加密（AES-256-GCM，由 settings/keys.master 開啟）；更新和恢復預設值都不會動它們；custom.settings 不儲存任何金鑰。 *Where:* bitGen 資料夾中的 settings/（設定 ▸ 一般 中顯示）。 *Since:* 2.748.0
- **☁ 為 RunPod 準備的現成遠端風格** — R_SDXL（+ img2img）、R_FLUX.1 schnell / dev / dev fp8、R_SD3 Medium 和 R_Z-Image Turbo，各自對應 RunPod 的一個標準 worker-comfyui 映像（無需上傳）；工作室向 RunPod 詢問端點的鏡像並只列出適合的風格；記錄說明任務在哪裡算圖以及在那裡的大致費用。 *Where:* 基本設定 ▸ GPU 遠端 / 兩者；設定 ▸ 遠端 GPU ▸ RunPod Serverless ▸ 端點的鏡像。 *Since:* 2.749.0
- **🧠 OpenRouter 上的 LLM（免費模型）+「遠端生成」** — 劇本寫作、提示詞輔助和圖片描述可以在 OpenRouter 上執行：一個 API 金鑰（加密儲存）、免費模型（或顯示每百萬 token 價格的付費模型）、用於圖片的視覺模型、✓ Test；不需要遠端 GPU - 圖片、影片和歌曲仍在這裡渲染。設定中的 Remote GPU 分頁現在叫 Remote generation（遠端生成）。 *Where:* Settings ▸ Remote generation ▸ 🧠 LLM ▸ OpenRouter；Basic Settings ▸ GPU 選 Both 並勾選 LLM / Vision LLM。 *Since:* 2.753.0
- **☁ 使用遠端生成 + 遠端生成停靠窗 + Pod 捷徑** — 一個核取方塊開啟或關閉遠端生成（關閉：一切在這裡執行，基本設定 ▸ GPU 隱藏）；從 基本設定 ▸ GPU（而不是狀態列）開啟的浮動停靠窗顯示任務在哪裡執行、你的 RunPod Pod（開始 / 停止 / 使用）以及 Pod 捷徑：用連結新增的 RunPod 範本，部署 ↗ 會開啟已選好該範本的 RunPod。 *Where:* Settings ▸ Remote generation ▸ Use remote generation；Basic Settings ▸ GPU ▸ ☁ Remote generation docker。 *Since:* 2.754.0
- **🖥 PODS 停靠窗 + RunPod 的 Serverless 或 Pod** — 基本設定 ▸ GPU 選擇遠端伺服器（RunPod 或 OpenRouter），RunPod 再選 Serverless 或 Pod；選擇 Pod 時，PODS 停靠窗列出 RunPod 的公開範本（官方 / 已驗證 / Community、僅 ComfyUI、搜尋），建立 Pod（帶 RunPod 即時價格的 GPU、Secure / Community 雲、磁碟大小、每小時估算），並可開始、停止、使用或終止你的 Pod（🅱 = bitGen 的）。 *Where:* Basic Settings ▸ GPU ▸ Remote servers；Basic Settings ▸ GPU ▸ 🖥 PODS。 *Since:* 2.756.0
- **🃏 每個 RunPod 範本都是一張卡片** — PODS 停靠窗一次列出 RunPod 的全部公開範本（全部 / 官方 / 已驗證 / 社群，各附數量），每個範本一張卡片（帶首字母的色塊、NVIDIA / AMD / CPU 和 ComfyUI 標記；名稱、映像、分組、磁碟、/workspace 和 Web 連接埠；建立 Pod… 和 ↗ 其頁面），邊輸入邊搜尋（每個詞：名稱、映像、連接埠、種類、分組）和種類篩選；「僅 ComfyUI」一開始是關閉的。*Where:* Basic Settings ▸ GPU ▸ 🖥 PODS。 *Since:* 2.756.1
- **🔑 設定 ▸ API：線上服務作為 API_ 風格 + LLM** — 新增 OpenRouter、fal.ai、Replicate、OpenAI、Google Gemini、Claude 或 RunningHub 的 API 金鑰（根據金鑰識別服務），起個名字並勾選「使用」：它的 API_ 風格（服務能生成的圖片、影片、歌曲）會出現在風格清單中，並在服務端生成，這臺電腦不需要顯示卡或 ComfyUI；每個風格的模型都可以修改（RunningHub 為工作流 ID），✓ Test 檢查金鑰，「用作 LLM」把提示詞 LLM、字幕和分鏡清單傳送到該服務（Claude 只用作 LLM）；金鑰加密儲存。 *Where:* Settings ▸ API；風格的 Runs on ▸ API。 *Since:* 2.757.0
- **🧩 P_ Pod 風格 + Pod 載入進度列** — 基本設定 ▸ GPU 為 RunPod ▸ Pods 時只顯示 P_ 風格；在已載入的 Pod 上按 🎨 Styles 會讀取它的 ComfyUI，從模型檔案（bitGen 為 Qwen Image、Z-Image、Krea 2、FLUX、SDXL 準備的工作流，填入 Pod 的檔案）和範本儲存的工作流建立 P_ 風格；Override style 為 P_ 風格提供步數、種子、CFG、尺寸和長寬比（從不提供檢查點或 LoRA）；啟動中的 Pod 用進度列顯示階段，以及相對上次載入時間的已用時間；你的 Pod 和 Pod 快捷方式（範本卡片上的 ☆、★ Shortcuts - 連結自動填入）在 PODS 停靠窗中。 *Where:* Basic Settings ▸ GPU ▸ 🖥 PODS ▸ My pods ▸ 🎨 Styles；風格的 Runs on ▸ RunPod pod。 *Since:* 2.758.0
- **⬇ 把模型下載到 Pod + 為風格選 Pod** — PODS 停靠窗的 For … 把適合某個 bitGen 風格的範本排在前面（✓ fits），這樣建立的 Pod 載入後會自動得到該風格的 P_ 風格；⬇ Models 把風格的檔案（或 bitGen 下載清單中的單個檔案）下載到 Pod 的 ComfyUI，每個檔案一條進度列，通過 Pod 的 Jupyter（bitGen 建立的 Pod 使用 bitGen 自己的密碼，或貼上密碼）或 ComfyUI-Manager（只限其清單）；也可以從連結（Civitai、Hugging Face、任何網址）或這臺電腦的磁碟放入單個檔案。 *Where:* Basic Settings ▸ GPU ▸ 🖥 PODS ▸ For …；My pods ▸ ⬇ Models。 *Since:* 2.759.0
- **🎵 Audio 停靠欄 + 以你的貨幣顯示價格 + 🖥 My pods** — Music、Stems 和 SFX 是同一個 Audio 停靠欄的分頁（狀態列上一個按鈕；螢幕上一次只有一個分頁，上次選的會回來）；設定 ▸ General ▸ Currency 把美元價格（RunPod 的 GPU 和 Pod、OpenRouter 的模型、遠端 GPU）以 AUD、EUR、GBP、CNY、JPY 等顯示，按當天的參考匯率（儲存以便離線使用）或你輸入的匯率，懸停可見美元；PODS 停靠欄的 🖥 My pods 只顯示 Pod，Create pod… 只顯示錶單，新建的 Pod 出現在 My pods 中。 *Where:* 狀態列 ▸ Audio；設定 ▸ General ▸ Currency；Basic Settings ▸ GPU ▸ 🖥 PODS ▸ 🖥 My pods。 *Since:* 2.760.0
- **🖥 作為條目的 Pod + 它們的費用 + 重新建立 Pod** — My pods 中的每個 Pod 都是一個條目（點名字展開）：Video、LLM、vLLM、Image、Image edit 勾選項，💾 Save（有更改才可用）為勾選的類型建立 Pod 的 P_ 風格，並讓 LLM / 描述圖片的 LLM 使用 Pod 自己的 OpenAI 相容伺服器；在其 checkpoints / loras 中 📁 New folder，從這臺電腦 ➕ Checkpoint 和 ➕ LoRA；Basic Settings ▸ GPU 每分鐘顯示 Pod 的費用（目前執行、RunPod 今天和本月的帳單），📊 Usage 按天記錄；P_ 風格儲存其 Pod 的配方（範本、GPU、大小、檔案）——用它渲染時會啟動已停止的 Pod 或建立新 Pod 並把檔案放回（從這臺電腦，否則從連結）。 *Where:* Basic Settings ▸ GPU ▸ 🖥 PODS ▸ 🖥 My pods；Basic Settings ▸ GPU（💲）。 *Since:* 2.761.0
- **🧩 每個 Pod 一個檢查點——Pod 就成為這個風格** — Pod 的 Checkpoint 和 LoRAs 使用 Basic Settings 的 Override 下拉框（這臺電腦的 ComfyUI 模型）；💾 Save 用 bitGen 為該模型系列準備的工作流（Krea 用 Krea 工作流）建立 P_<Pod>，Pod 上已有就直接選用，否則在後臺傳送一次到相同的子資料夾；Override style 開啟且選取 P_ 風格時，Basic Settings 的檢查點會在渲染前傳送到 Pod 並在那裡使用。 *Where:* Basic Settings ▸ GPU ▸ 🖥 PODS ▸ 🖥 My pods ▸ 某個 Pod；Basic Settings ▸ Override style ▸ Checkpoint。 *Since:* 2.762.0
- **從聊天中創作歌曲** — 聊天會寫出符合所選音樂風格的歌詞，併發送到 Music 面板。 *Where:* 提示詞聊天. *Since:* 2.92.0
- **歌詞檔案** — 每首歌曲的歌詞都以文字檔案形式儲存在專案中。 *Where:* 專案的 lyrics 資料夾

### 分軌

- **拆分歌曲** — 人聲、鼓、貝斯和其他。 *Where:* Stems 面板

### 人聲與語音

- **聲音複製** — 從一段短片段或波形選取範圍複製聲音。 *Where:* Voice / Stems 面板
- **▶ 在聲音複製的波形中播放** — 播放選取範圍，未選擇時播放整個片段；■ 停止，波形上顯示播放頭，點選一下即可清除選取範圍。 *Where:* Settings > Audio > voice clone. *Since:* 2.601.0
- **文字轉語音** — 用複製的聲音朗讀一句話；可選 OpenAudio 或 OmniVoice（600 多種語言，支援聲音設計）。 *Where:* Settings > Audio. *Since:* 2.102.0
- **Ming-3.0 TTS** — 第二個語音引擎（inclusionAI，0.5B，44.1 kHz）：根據片段及其文字稿複製聲音，也可設計聲音。從 Settings ▸ Add-ons 安裝。 *Where:* Settings > Audio > Speech engine. *Since:* 2.594.0
- **從提示詞生成語音** — 在語音模式下使用 Generate。 *Where:* Generate 下拉式清單

### 轉錄與歌詞

- **語音轉文字** — 從任意聲音或影片中轉錄語音或提取帶時間軸的歌詞，儲存為 .txt、.srt 和 .lrc。 *Where:* 素材托盤. *Since:* 2.38.0
- **本地轉錄** — faster-whisper 在本機執行，每個檔案只轉錄一次。 *Where:* Settings > Audio
- **Bark 3.0 語音轉文字** — Underdog 的 Bark 3.0（163 MB，僅支援英語），用於普通文字稿、聲音複製文字稿、手機遙控和 🎙 語音聊天；歌詞、字幕及其他需要時間軸的工作仍使用 faster-whisper。從 Settings ▸ Add-ons 安裝。 *Where:* Settings > Audio > Speech-to-text engine. *Since:* 2.594.0
- **WeVisOne-VL 視覺模型** — 騰訊的 WeVisOne-VL（基於 Qwen3-VL）作為提示詞面板的視覺模型：它能讀取圖片中的文字、計數和查詢物體，併為 LLM 描述圖片內容。可在下拉式清單中選擇 4B 或 2B；模型會下載到你的視覺模型資料夾。 *Where:* Settings > Add-ons > WeVisOne-VL. *Since:* 2.595.0
- **⟳ 更新 llama.cpp** — 檢視已安裝的 llama.cpp 版本以及是否有更新版本，並就地更新（LLM 和視覺伺服器會先停止；模型和設定保持不變）；進度直接顯示在原處。 *Where:* Settings > LLM. *Since:* 2.596.0
- **MP4 · 社交媒體匯出** — 生成 Facebook、Instagram 和 TikTok 可直接接受的檔案：H.264 High 8-bit、AAC 48 kHz 立體聲、恆定幀率、faststart、短邊最大 1080、無時間碼軌道；編碼後進行檢查（逐項顯示是否合格，9:16 影片超過 90 s 時另有提示）。社交媒體套裝可一次生成 9:16 Reels、4:5 資訊流、1:1 和 16:9。 *Where:* 時間軸的 📤 Export. *Since:* 2.597.0
- **Basic Settings 的 Format 中的 📱 社交媒體選項** — Reels / Stories 9:16、Facebook 資訊流 4:5、Square 1:1、Landscape 16:9 或渲染本身的比例：Aspect 隨之改變，完成的 MP4 在進入相簿之前會處理成適合 Facebook / Instagram / TikTok 的格式（使用 Export 預設的設定並經過檢查）。 *Where:* Basic Settings > Format（以及音樂影片的 Format）. *Since:* 2.600.0
- **種子：🎲 隨機 / 📌 固定** — 種子旁的一個開關：Random = 每次渲染使用新種子，Fixed = 每次都使用旁邊的數字（輸入數字或用 ♻ 呼叫上次使用的種子會切換為 Fixed）。Basic Settings（影片和影像）以及每個風格（影像、影片、音樂）中都有——風格總能以自己的種子渲染。 *Where:* Basic Settings，Settings > Image / Video / Music styles. *Since:* 2.598.0
- **專案重設鎖定螢幕** — 專案重設期間，整個視窗會被遮罩覆蓋，顯示 "Resetting Project..."，帶有旋轉圓環、跳動的圓點、目前正在進行的操作和已用秒數；遮罩後面的任何內容都無法點選，並且會一直保持到重新載入完成、空專案開啟為止（"✓ Project reset"）。 *Where:* ↺ Reset project. *Since:* 2.599.0
- **模型管理器能找到 ComfyUI 已有的內容** — 它會詢問正在執行的 ComfyUI 其模型資料夾在哪裡、下拉式清單裡有哪些內容，因此即使模型和 LoRA 不在 Settings 中設定的 ComfyUI 資料夾下（例如桌面版自己的資料夾，或 ComfyUI 命令列指定的 yaml），也能顯示出來。 *Where:* 🧩 Models. *Since:* 2.598.0
- **按鈕顯示正在進行的操作** — Install、Update、Start（隨後是 Loading the model）、Stop、Rescan、Scan folder 和 Save 會變成旋轉的 "…ing" 並顯示秒數，然後顯示 ✓ 或 ✗ 及原因。 *Where:* Settings > LLM 和 Save. *Since:* 2.596.0

### 卡拉 OK

- **卡拉 OK 疊加層** — 透明的歌詞影片，帶有跳動的小球，以及隨演唱而變色的歌詞行。 *Where:* StoryBoard 的 Karaoke 按鈕. *Since:* 2.373.0
- **任意歌曲的卡拉 OK** — 選擇一個聲音片段或素材，可以是整首歌，也可以是標尺選取範圍。 *Where:* 時間軸的 Karaoke 按鈕. *Since:* 2.380.0
- **卡拉 OK 樣式** — 字型、顏色、描邊、陰影、背景條和小球。 *Where:* StoryBoard 和 Timeline settings
- **編輯歌詞** — 修正語音轉文字聽到的歌詞，或貼上真正的歌詞。 *Where:* Karaoke 面板. *Since:* 2.408.0
- **歌詞與時間** — 每個詞都有開始和結束時間，可播放、可修正；修正內容會為該歌曲保留。 *Where:* Karaoke 面板. *Since:* 2.408.0
- **微調詞語時間** — 將一個詞，或該詞及其後所有詞，以小幅或較大幅度提前或延後。 *Where:* Words and timing. *Since:* 2.433.0
- **標記處的歌詞行** — 正在演唱的行會高亮顯示，正在演唱的詞更亮。 *Where:* Words and timing. *Since:* 2.433.0
- **Karaoke 面板** — 停靠在預覽畫布旁邊，這樣可以一邊播放歌曲一邊修正；可在畫布上顯示修正後的歌詞。 *Where:* 時間軸. *Since:* 2.410.0

## 時間軸

完整的影片編輯器：帶圖層的預覽畫布、編輯工具、調色、聲音、字幕、AI 和 3D。

### 預覽畫布

- **預覽畫布** — 左側為工具列、右側為 Layers 面板的畫布。 *Where:* 時間軸面板. *Since:* 2.377.0
- **拖放新增** — 將影片、圖片或聲音拖放到畫布上；每個都會在位置標記處放到一個新圖層上。 *Where:* 預覽畫布
- **移動工具** — 選擇、移動、拖曳角點縮放、拖曳頂部手柄旋轉；按住 Shift 以 15 度為步進或鎖定單軸。 *Where:* 按鍵 V
- **文字工具** — 點選新增文字圖層，可設定字型、字號、顏色、粗體、斜體、描邊、陰影和對齊方式。 *Where:* 按鍵 T
- **本機的所有字型** — 每個字型清單在 Common 下列出常用字型，在 This computer (N) 下列出所有已安裝字型；僅存在於應用 fonts 資料夾中的字型會從其檔案載入。 *Where:* 影像編輯器和時間軸的字型清單、字幕、卡拉 OK 樣式. *Since:* 2.607.0
- **字型清單中的字型預覽** — 每個字型名稱都用該字型本身顯示（搜尋清單也一樣）；清單收起時，以所選字型顯示其名稱。 *Where:* 每個字型清單. *Since:* 2.608.0
- **右鍵選單中的 Rasterize Text** — 文字圖層（影像編輯器）或時間軸中的文字會變成圖片；復原即可恢復文字。 *Where:* 右鍵點選文字. *Since:* 2.604.0
- **保持對邊不動的斜切** — 側邊手柄以對邊為基準傾斜（Alt：以中心為基準）；文字斜切後仍是文字。 *Where:* 影像編輯器的移動工具，雙擊可顯示旋轉 / 斜切手柄. *Since:* 2.604.0
- **💾 以任意格式儲存到 Images** — 可見圖層保留為臨時副本，合併後（JPEG / BMP 以白色為底）按 💾 旁所選的格式儲存到 Images 和 Gallery。 *Where:* 影像編輯器的選單列（Ctrl+S）. *Since:* 2.604.0
- **輸入時自動貼合，點選處即可編輯** — 正在輸入的文字的邊框緊貼字母，並隨每次按鍵擴充功能；指標位於文字上方時顯示文字 I 形游標（其他位置顯示新建文字游標）；點選即可從所點位置的字母之間開始編輯，自動換行的段落文字也一樣。 *Where:* 影像編輯器的 Type 工具（T）. *Since:* 2.602.0
- **抓手與縮放** — 平移、縮放圖片以及使圖片適合視窗。 *Where:* 按鍵 H、Z
- **填充選取範圍** — 畫一個框或繪製遮罩，然後生成與之融合的圖片或影片。 *Where:* 按鍵 M 和 B，以及 Layers 面板中的 Fill. *Since:* 2.380.0
- **帶聲音播放** — 所有圖層連同聲音一起播放；可迴圈播放標尺選取範圍。 *Where:* 畫布下方
- **合成與畫布一致** — 移動、縮放和旋轉後的圖層與文字，會完全按照畫布上顯示的位置合成。 *Where:* Compile
- **懸停高亮** — 使用移動工具時，指標下方的片段以藍色輪廓顯示，選取的片段以橙色顯示。 *Where:* 預覽畫布. *Since:* 2.470.0

### 圖層、片段與位置標記

- **圖層** — V1 作為基礎畫面，另有影片、圖片、聲音、文字、3D 和 Karaoke 圖層。 *Where:* 時間軸
- **圖層顏色** — 每個圖層都有自己的顏色；選取的圖層會顯示輪廓。 *Where:* 時間軸. *Since:* 2.383.0
- **重新命名圖層** — 雙擊名稱、按 F2 或使用 Name 框。 *Where:* Layers 清單和軌道. *Since:* 2.382.1
- **拖曳標記** — 隨意移動；雙擊某個時間即可跳轉到該處並播放。 *Where:* 標尺. *Since:* 2.383.0
- **標尺選取範圍** — 選擇一段，保留或剪掉它，修剪片段的開頭或結尾。 *Where:* 標尺
- **微移片段** — 方向鍵按幀移動片段，按住 Shift 按秒移動。 *Where:* Timeline settings. *Since:* 2.376.0
- **命名的時間軸** — 一個專案可包含多條時間軸；可切換、儲存和另存新檔。 *Where:* 時間軸工具列. *Since:* 2.107.0
- **轉場** — 59 種轉場，在入點和出點處以其形狀繪製。 *Where:* 每個圖層. *Since:* 2.415.0

### 關鍵影格

- **關鍵影格** — 位置、縮放、旋轉、不透明度和文字顏色，在畫布上和合成中補間過渡。 *Where:* Layers 面板中的 Key 按鈕. *Since:* 2.379.0
- **緩動** — 線性、緩入、緩出、緩入緩出或定格。 *Where:* 關鍵影格選單
- **圖表編輯器** — 數值圖表和速度圖表，關鍵影格和貝塞爾手柄均可拖曳；一鍵應用 Easy Ease、線性和定格。 *Where:* Properties 中的 📈 Graph 按鈕. *Since:* 2.489.0
- **運動模糊、Posterize Time、Echo** — 模糊圖層的運動（快門角度、取樣數）、以較低幀率定格顯示，或在其後拖出一串副本。 *Where:* 圖層 Properties 中的 ⏱ Time. *Since:* 2.500.0
- **曲線式時間重對映** — 選擇影片片段每個時刻顯示源素材的哪一秒：正放、倒放、凍結、加快或放慢，用曲線上的關鍵影格控制，並可在播放頭處 ◇ Key 和 ❄ Freeze。 *Where:* 影片片段 🎬 Speed 中的 ⏱ Time remap. *Since:* 2.501.0
- **生成器圖層：Fractal Noise 與 Gradient Ramp** — 用 🌫 工具點選一下，即可在畫面上生成動態碎形雜訊；拖曳一下則生成線性或徑向漸層；所有設定均可設關鍵影格。 *Where:* 時間軸畫布上的 🌫 工具，圖層 Properties 中的 🌫 Generator. *Since:* 2.505.0
- **湍流置換與置換貼圖** — 用運動的雜訊或另一個圖層的畫面推動任意圖層的像素；合成結果一致，影片圖層也包括在內。 *Where:* 圖層 Properties 中的 〰 Distort. *Since:* 2.505.0
- **粒子** — 用 🌫 工具 Shift+點選即可建立粒子發射器（點、線或盒形），可設定速度、方向、擴散、重力、風和五種粒子形狀；所有設定均可設關鍵影格，且每次繪製的畫面都完全相同。 *Where:* 時間軸畫布上的 🌫 工具，圖層 Properties 中的 🌫 Generator (Particles). *Since:* 2.506.0
- **光線** — 任意圖層的明亮部分從某一點向外射出光束，延伸到圖層邊緣之外；合成時，影片圖層會由頁面整體烘焙。 *Where:* 圖層 Properties 中的 ☀ Light rays. *Since:* 2.506.0
- **操控點** — 在圖層上釘上圖釘，拖曳圖釘即可像木偶一樣彎曲圖層；其他圖釘保持不動，圖釘還可設關鍵影格，使圖層隨時間運動。 *Where:* 時間軸畫布上的 📌 Puppet 工具（Shift+W），圖層 Properties 中的 📌 Warp. *Since:* 2.507.0
- **網格變形** — 在圖層上放置最多 8 × 8 個點的網格，拖曳這些點即可沿平滑曲線彎曲畫面；可設關鍵影格，合成結果一致，影片圖層也包括在內。 *Where:* 圖層 Properties 的 📌 Warp 中的 ⌗ Mesh warp. *Since:* 2.507.0
- **音訊 → 關鍵影格** — 將任意屬性（不透明度、縮放、位置、旋轉、生成器數值）按聲音的響度、低音、中音或高音設關鍵影格，從安靜時的數值到響亮時的數值，並精簡為真正需要的關鍵影格。 *Where:* 圖層 Properties 中的 ♪ Audio → keys. *Since:* 2.508.0
- **音訊波形與頻譜圖層** — 把聲音畫出來的圖層：播放頭附近的波形（波形、線條、柱狀）或其頻率（柱狀、線條、圓形）；所有設定均可設關鍵影格；可針對一個片段或全部聲音。 *Where:* 在時間軸畫布上用 🌫 工具 Alt+點選 / Alt+Shift+點選. *Since:* 2.508.0
- **表示式中的 audio()** — 任意時刻混音的響度、低音、中音或高音（0..1），可用於任意屬性的表示式。 *Where:* 屬性上的 ƒx 及其預設. *Since:* 2.508.0
- **運動草圖** — 時間軸播放時在畫布上按住並移動：圖層跟隨指標移動，其路徑變為位置關鍵影格，並精簡為真正需要的關鍵影格。 *Where:* 時間軸畫布上的 ✍ 工具（Shift+K），圖層 Properties 中的 〰 Motion. *Since:* 2.509.0
- **搖擺器** — 以關鍵影格形式為任意屬性新增隨機運動（頻率、幅度、平滑或尖銳、位置 x / y 分開、種子），疊加在已有運動之上。 *Where:* 圖層 Properties 的 〰 Motion 中的 ≈ Wiggler. *Since:* 2.509.0
- **平滑器** — 在容差範圍內對屬性的關鍵影格求平均並精簡：關鍵影格更少，形狀不變。 *Where:* 圖層 Properties 的 〰 Motion 中的 ⌇ Smoother. *Since:* 2.509.0
- **3D 空間中的 2D 圖層** — 任意圖層都可以變成具有深度和 x / y 旋轉的卡片，由可設關鍵影格的 3D 相機（位置、朝向、變焦）以透視方式觀察，並配有環繞 / 推拉 / 平移工具。 *Where:* 圖層 Properties 中的 🧊 3D，🧊 工具（Shift+O）. *Since:* 2.510.0
- **3D 卡片的景深與光照陰影** — 卡片根據與焦點的距離產生模糊，光源會把卡片的形狀作為陰影投射到後方的卡片上。 *Where:* 3D 圖層 Properties 中的 🎥 3D camera. *Since:* 2.510.0
- **可變遮罩羽化** — 每個遮罩點都可以有自己的羽化值（用 Mask Pen 按住 Shift 拖曳該點）；邊緣在各點之間平滑過渡，動畫路徑也一樣。 *Where:* 時間軸畫布上的 ✒ Mask Pen，Properties 中的 ✒ Masks. *Since:* 2.511.0
- **資料驅動動畫** — 將 CSV 或 JSON 匯入為帶目前行的資料集；文字中使用 {{set.column}}，表示式中使用 data()，還可將某一列逐行設為任意屬性的關鍵影格。 *Where:* 圖層 Properties 中的 📋 Data & fields. *Since:* 2.511.0
- **公開的範本欄位** — 將圖層的顏色、不透明度、位置、縮放或旋轉標記為欄位；在一個清單中編輯所有欄位，範本拖入時會提供這些欄位。 *Where:* 圖層 Properties 中的 📋 Template fields，🧩 Templates. *Since:* 2.511.0
- **Lottie (JSON) 匯出** — 將圖片和文字圖層匯出為適用於網頁和應用的 Lottie 動畫：移動、縮放、旋轉和淡入淡出匯出為帶緩動的真正動畫圖層，效果圖層匯出為幀；已用 lottie-web 驗證。 *Where:* 📤 Export → ⤓ Lottie (JSON). *Since:* 2.512.0
- **載入 UE 專案** — 選擇一個 Unreal 專案資料夾，bitGen 會放入（或更新）bitGen Bridge 外掛，啟用所需外掛，並以該專案重新啟動 Unreal。 *Where:* 選單列中的 🎮. *Since:* 2.513.0
- **時間軸的畫面尺寸** — 寬 × 高、尺寸預設（從 4K 到直向和方形），以及畫布和合成共用的鎖定長寬比；V1 會適配到畫面內並置中。 *Where:* Timeline 面板頂部的欄. *Since:* 2.513.0
- **在整個鏡頭中摳出主體** — 點選主體（或框選），它就會在整個片段中被追蹤（SAM 2、AI 遮罩或內建方法），可最佳化邊緣，結果為一個透明影片圖層。 *Where:* 影片片段 Properties 中的 🧍 Cut out. *Since:* 2.515.0
- **影片內容識別填充** — 從每個影格中移除摳出的主體或遮罩區域，並用周圍幀（+ 一張參考幀）填充。 *Where:* 影片片段 Properties 中的 🩹 Remove. *Since:* 2.515.0
- **3D 攝影機追蹤器** — 解算相機和場景中的點，選擇點並將圖層平放、豎立或朝向相機放置；3D 相機跟隨解算結果（包括滾轉）。 *Where:* 影片片段 Properties 中的 📷 3D camera track. *Since:* 2.515.0
- **任意設定均可設關鍵影格** — 每個顏色、效果、遮罩、文字和時間設定旁的 ◇ 可在播放頭處為其設關鍵影格（之後修改即會自動設關鍵影格）；Graph Editor 會顯示這些關鍵影格，合成結果一致。 *Where:* 片段 Properties 和 🎨 Colour 對話方塊中的 ◇. *Since:* 2.516.0
- **主題編輯模式：調整大小、移動、隱藏、重新命名** — 拖曳手柄調整元素大小，拖曳元素移動位置，隱藏元素或修改其文字；每次修改都會儲存在 themes/<name>.tmp 中，退出編輯模式時可選擇 Save theme、Save theme as…、Reset theme、Not now 或 Cancel。 *Where:* 頂部欄中的 🖌. *Since:* 2.514.0
- **主題編輯模式：每個按鈕及其文字** — 雙擊任意文字（按鈕、面板標題、分頁、標籤、標題、提示）即可就地修改；可重新命名下拉式清單的選項；可修改佔位文字和工具提示；浮動工具面板的編輯方式與面板相同；Shift+點選（2.682.0）或 Alt+點選可執行按鈕的操作，並在不退出該模式的情況下開啟分割槽 / 分頁 / 選單。 *Where:* 頂部欄中的 🖌. *Since:* 2.623.0
- **僅在 Expert 模式下隱藏** — 主題可以只在開啟 Expert 模式時隱藏某個元素；Basic 模式下仍會顯示。 *Where:* 主題編輯模式 > Style 面板 > Hide. *Since:* 2.544.0
- **對話方塊的主題編輯模式** — Ctrl+Shift+Alt+E 也可為開啟的對話方塊（Settings 等）設定樣式；Ctrl+S 儲存主題並退出。 *Where:* 任意位置. *Since:* 2.515.0
- **摺疊面板** — 側邊面板可摺疊為細長的標題列；影像編輯器的面板組可摺疊為其分頁，並可用 ✕ 關閉；View ▸ Dockers 可顯示或隱藏每個面板。 *Where:* 面板標題欄中的 ▾；影像編輯器的 View 選單. *Since:* 2.514.0
- **運動追蹤** — 在片段中以亞像素精度追蹤一個點、兩個點（縮放和旋轉）、四個角點或一個平面（平面追蹤），然後將其應用到圖層的位置，或將圖層釘入其中。 *Where:* 影片片段 Properties 中的 🎯 Track. *Since:* 2.499.0
- **邊角定位** — 將圖層繪製到四個角點中，角點可來自追蹤或手動拖曳；合成結果與畫布一致。 *Where:* 圖層 Properties 中的 ▢ Corner pin. *Since:* 2.499.0
- **貝塞爾遮罩** — 每個圖層可用鋼筆繪製多個遮罩（角點和曲線），支援相加、相減、交集和差集，以及羽化、擴充功能、不透明度、反轉和動畫路徑；適用於圖片、文字、形狀和影片。 *Where:* ✒ Mask Pen（Shift+M）以及圖層 Properties 中的 ✒ Masks. *Since:* 2.498.0
- **表示式** — 圖層屬性（位置、縮放、旋轉、不透明度、錨點、形狀和文字動畫器數值）上的簡短公式：wiggle、迴圈、延遲、範圍、隨機、連結到其他圖層；輸入時即時檢查；合成會遵循表示式。 *Where:* 圖層 Properties 中的 ƒx Expressions. *Since:* 2.497.0
- **漂浮關鍵影格** — 位置關鍵影格的時間沿運動路徑自動調整，使其與相鄰關鍵影格之間保持勻速。 *Where:* Graph Editor 中的 Rove. *Since:* 2.496.0
- **Easy Ease** — 讓關鍵影格緩入緩出，或只緩動一側。 *Where:* Properties，F9（Shift+F9 緩入，Ctrl+Shift+F9 緩出）. *Since:* 2.489.0
- **錨點** — 位置以它為基準放置，縮放和旋轉以它為中心；可設關鍵影格；移動錨點時圖層保持不動。 *Where:* Properties 中的 ⊕ Anchor. *Since:* 2.489.0
- **曲線運動路徑** — 位置路徑繪製在畫布上，可用貝塞爾手柄彎曲；一鍵 Smooth path。 *Where:* 畫布，↝ Smooth path. *Since:* 2.489.0
- **父子關係** — 圖片、文字、空物件或（自 2.495.0 起）影片圖層跟隨另一個圖層的位置、旋轉和縮放；選擇或清除父級時圖層保持不動，合成也會遵循父子關係。 *Where:* Properties 中的 ⛓ Parent. *Since:* 2.490.0
- **空物件** — 用於設關鍵影格和作為其他圖層父級的空控制圖層；永遠不會被合成。 *Where:* Properties 中的 ＋ Null. *Since:* 2.490.0
- **混合模式** — 每個圖層可設 Multiply、Screen、Overlay、Darken、Lighten、Color Dodge 和 Burn、Hard 和 Soft Light、Difference、Exclusion、Add 以及（自 2.495.0 起）Hue、Saturation、Color 和 Luminosity，在畫布上和合成中均生效。 *Where:* Properties 中的 ◐ Blend. *Since:* 2.491.0
- **軌道遮罩** — 只在上方圖層存在的地方顯示該圖層（alpha 或亮度，或反轉）；可實現文字中的影片等效果。 *Where:* Properties 中的 ▣ Matte. *Since:* 2.491.0
- **形狀圖層** — 用 Shape 工具繪製的矩形、橢圓、星形和多邊形，可使用純色或漸層填充以及描邊。 *Where:* 畫布工具列中的 ◆（Q）. *Since:* 2.492.0
- **形狀操作器** — Trim Paths、Repeater、Offset Paths、Pucker & Bloat、Twist、Zig Zag、Wiggle Paths 和 Round Corners，所有數值均可設關鍵影格。 *Where:* 形狀圖層的 Properties. *Since:* 2.492.0
- **手繪形狀** — 手繪閉合形狀或開放線條，自動平滑；按住 Alt 可將其作為另一條路徑新增到所選形狀圖層。 *Where:* ✎ Freehand 工具（Shift+Q）. *Since:* 2.496.0
- **合併路徑** — 將一個形狀圖層中的多條路徑以相加、相減、交集或排除方式組合，包括鏤空；其後的操作器作用於合併後的輪廓。 *Where:* 形狀圖層 Properties 中的 ⧉ Paths 和 ⊕ Merge Paths. *Since:* 2.496.0
- **文字動畫器** — 對範圍所選的字母、字詞或行進行移動、旋轉、縮放、淡化、拉開間距、模糊或改色；提供 Typewriter、Fade up、Pop in、Slide in、Wave 和 Blur in 預設；所有數值均可設關鍵影格。 *Where:* 文字圖層 Properties 中的 ✨ Text Animators. *Since:* 2.493.0
- **路徑文字** — 字母沿弧線、圓形、波浪或形狀圖層的輪廓排列，並隨之轉向；起點可設關鍵影格。 *Where:* 文字圖層 Properties 中的 〰 On a path. *Since:* 2.496.0
- **編輯關鍵影格** — 點選片段上的菱形，可設定其不透明度、音量、位置、縮放、旋轉、顏色和緩動。 *Where:* 時間軸
- **拖曳和刪除關鍵影格** — 沿片段拖曳；右鍵點選、Alt+點選或按 Delete 可刪除一個關鍵影格。 *Where:* 時間軸. *Since:* 2.385.0
- **音量關鍵影格** — 聲音片段同樣適用。 *Where:* 聲音片段
- **效果關鍵影格** — 模糊、銳化、發光、暗角、顆粒和裁切在關鍵影格之間變化。 *Where:* 片段的 Effects. *Since:* 2.412.0

### 編輯工具與按鍵

- **波紋、滾動、滑移和滑動** — 修剪並移動其後的所有內容、移動剪下點、顯示其他幀，或在相鄰片段之間滑動。 *Where:* 按鍵 V、B、N、Y、U. *Since:* 2.407.0
- **分割** — 在位置標記處分割。 *Where:* Ctrl+K. *Since:* 2.410.0
- **軌道目標** — 一次分割所有設為目標的圖層。 *Where:* 每個圖層頭部的目標按鈕. *Since:* 2.412.0
- **J / K / L 穿梭播放** — 以 2x、4x、8x 倒放或正放；逐幀步進。 *Where:* 時間軸面板. *Since:* 2.411.0
- **編輯點與首尾** — 跳到上一個或下一個編輯點、開頭或結尾。 *Where:* 方向鍵、Home、End. *Since:* 2.410.0
- **在倒放和變速片段上編輯** — 編輯工具和分割在變速片段上同樣精確到幀。 *Where:* 時間軸. *Since:* 2.413.0

### 標記與時間碼

- **標記** — 帶名稱、顏色和註釋的旗標；跳到下一個和上一個標記。 *Where:* 按鍵 M. *Since:* 2.410.0
- **標記範圍與片段標記** — 帶長度的標記，以及固定在片段某一幀上的標記。 *Where:* 標記編輯器，Ctrl+Shift+M. *Since:* 2.412.0
- **時間碼** — HH:MM:SS:FF，可設起始時間和幀率；29.97 和 59.94 時使用丟幀時間碼。 *Where:* 位置旁邊. *Since:* 2.407.0

### 速度

- **速度** — 10 到 1000 %，片段長度隨之變化。 *Where:* 片段的 Speed 摺疊區. *Since:* 2.406.0
- **倒放與變速** — 倒放，或沿片段逐漸改變速度。 *Where:* 片段的 Speed 摺疊區. *Since:* 2.406.0
- **慢放幀** — 重複幀、幀混合或光流。 *Where:* 片段的 Speed 摺疊區. *Since:* 2.406.0
- **畫布上的倒放聲音** — 倒放或變速片段的聲音只渲染一次，播放時與畫面同步。 *Where:* 畫布. *Since:* 2.417.0

### 調色

- **風格預設與滑塊** — 青橙色調、暖調膠片、冷調夜景等；曝光、對比度、飽和度、色溫、色調和色相。 *Where:* 片段的 Colour 摺疊區. *Since:* 2.406.0
- **LUT** — 匯入任意 3D .cube LUT 並調節混合程度。 *Where:* 片段的 Colour 摺疊區. *Since:* 2.406.0
- **色輪與曲線** — 暗部（lift）、中間調（gamma）和亮部（gain）色輪；主曲線和 RGB 曲線。 *Where:* Colour 對話方塊. *Since:* 2.407.0
- **HSL 二級調色** — 最多六個色相範圍，可分別偏移色相、調整飽和度或提亮。 *Where:* Colour 對話方塊. *Since:* 2.407.0
- **色相曲線** — 色相對色相、色相對飽和度。 *Where:* Colour 對話方塊. *Since:* 2.412.0
- **示波器** — 波形圖、RGB 分量圖、向量示波器和直方圖。 *Where:* Colour 對話方塊. *Since:* 2.407.0
- **色彩匹配** — 將片段的曲線設定為與另一個片段匹配。 *Where:* Colour 對話方塊. *Since:* 2.415.0
- **所見即所得** — 調色結果烘焙為一張由畫布和合成共用的查詢表。 *Where:* 畫布
- **HDR 片段色調對映** — 手機拍攝的 HDR 影片會經過色調對映後放入影片。 *Where:* 合成. *Since:* 2.417.0

### 效果與調整圖層

- **效果** — 模糊、銳化、發光、暗角、顆粒、裁切、綠幕 / 藍幕去背和防抖。 *Where:* 片段的 Effects. *Since:* 2.409.0
- **扭曲效果** — 鏡頭、鏡像和變形（波浪、旋渦）。 *Where:* 片段的 Effects. *Since:* 2.415.0
- **防抖模式** — 平滑或鎖定，預覽畫面穩定。 *Where:* 片段的 Effects. *Since:* 2.413.0
- **調整圖層** — 作用於其下方所有內容的調色和效果。 *Where:* 時間軸工具列. *Since:* 2.409.0

### 遮罩與追蹤

- **遮罩（電動視窗）** — 帶羽化和反轉的橢圓或方框，用於限定調色和效果的範圍。 *Where:* Colour 面板. *Since:* 2.416.0
- **追蹤** — 遮罩跟隨目標直到片段結束。 *Where:* Colour 面板. *Since:* 2.416.0

### 聲音與混音

- **清理** — 人聲清晰度、降噪和增益，支援前後對比預覽。 *Where:* 片段的 Sound 摺疊區. *Since:* 2.406.0
- **均衡器、多段處理與混響** — 可用於任意片段的聲音。 *Where:* 片段的 Sound 摺疊區. *Since:* 2.412.0
- **J / L 剪輯** — 片段的聲音提前開始或延後結束。 *Where:* 片段的 Sound 摺疊區. *Since:* 2.407.0
- **連結的聲音** — 影片的聲音作為單獨的連結片段；可取消連結或重新連結。 *Where:* 片段的 Properties. *Since:* 2.412.0
- **Mix 對話方塊** — 人聲、音樂和音效角色，閃避（ducking）以及按目標值調整響度。 *Where:* 時間軸的 Mix 按鈕. *Since:* 2.406.0
- **軌道混音器** — 每條軌道和主輸出各有推子、聲像、靜音、獨奏和即時電平表。 *Where:* 時間軸選單列. *Since:* 2.415.0
- **波形** — 每個聲音片段都顯示其波形。 *Where:* 聲音圖層. *Since:* 2.64.0

### 字幕與文字稿

- **由語音生成字幕** — 所有有人聲的內容都在本地轉錄，並放在各片段所在的位置。 *Where:* 時間軸的 Captions 按鈕. *Since:* 2.406.0
- **編輯字幕及其樣式** — 時間、文字、字型、字號、顏色、描邊或底框、位置。 *Where:* Captions 對話方塊. *Since:* 2.406.0
- **燒錄或 .srt** — 燒錄進影片，和 / 或在旁邊生成 .srt。 *Where:* Captions 對話方塊. *Since:* 2.406.0
- **基於文字稿編輯** — 選擇詞語，將其剪掉或只保留它們；刪除停頓和填充詞。 *Where:* 時間軸的 Transcript 按鈕. *Since:* 2.408.0
- **文字稿範圍** — 目前片段、其所在圖層或整個序列。 *Where:* Transcript 對話方塊. *Since:* 2.414.0
- **場景切換點** — 在鏡頭切換處分割片段，或在那裡放置標記。 *Where:* Transcript 對話方塊. *Since:* 2.408.0

### 多機位、巢狀與代理

- **多機位** — 按聲音同步各機位，用按鍵 1 到 9 即時切換；可展平為普通片段。 *Where:* 時間軸. *Since:* 2.416.0
- **巢狀序列** — 將另一條時間軸合成為一個片段，它變化時會重新渲染。 *Where:* 時間軸選單列. *Since:* 2.414.0
- **代理** — 為大體量素材生成小副本用於播放；影片使用原始素材。 *Where:* 時間軸. *Since:* 2.416.0

### 播放

- **渲染條** — 顯示哪些區段可即時播放、可能丟幀、負載過重或已渲染。 *Where:* 標尺下方. *Since:* 2.418.0
- **渲染預覽** — 合成一次，即可在已渲染的區段以全速播放與成片完全一致的畫面。 *Where:* Render 按鈕. *Since:* 2.418.0
- **遲到幀計數與播放解析度** — 播放時使用全尺寸、二分之一或四分之一尺寸。 *Where:* 播放按鈕旁邊. *Since:* 2.418.0
- **GPU 合成器** — 播放時在顯示卡上合成圖層。 *Where:* GPU 開關. *Since:* 2.420.0

### 時間軸中的 AI

- **新鏡次** — 在片段自己的槽位中重新渲染，並可在各鏡次之間切換。 *Where:* AI 選單. *Since:* 2.420.0
- **延長** — 從片段的最後一個影格接續生成更多秒數。 *Where:* AI 選單. *Since:* 2.420.0
- **B-roll 補充鏡頭** — 填充 V1 上的空白區段，或在某個範圍上插入切出鏡頭。 *Where:* AI 選單. *Since:* 2.420.0
- **踩點剪輯** — 找出歌曲的節拍，然後在節拍處放置標記或剪下片段。 *Where:* AI 選單. *Since:* 2.420.0

### 路徑圖層

- **路徑圖層** — 繪製一條路徑，讓主體（動物、人物、車輛）沿路徑移動，可設定大小和速度。 *Where:* 時間軸欄的 Path layer 按鈕. *Since:* 2.387.0
- **原地或沿路徑** — 用關鍵影格移動的綠幕片段，或由 Wan ATI 讓主體自己行進。 *Where:* 路徑圖層的面板. *Since:* 2.387.0
- **去背** — AI 遮罩或色度去背；每個路徑圖層都是透明的。 *Where:* 路徑圖層的面板. *Since:* 2.387.0

### 相機路徑

- **相機面板** — 預設，以及搖攝、俯仰、滾轉、高度、推拉和鏡頭關鍵影格，提供相機檢視、頂檢視和側檢視。 *Where:* 時間軸欄的 Camera. *Since:* 2.399.0
- **相機工具** — 在畫布上拖曳即可搖攝、俯仰、滾轉、改變高度和推拉。 *Where:* Shift+C. *Since:* 2.399.0
- **用於生成** — 告訴每個影片模型它能遵循的運鏡。 *Where:* Camera 面板. *Since:* 2.399.0
- **精確路徑引導** — 一張帶深度的圖片沿路徑飛行，生成引導影片。 *Where:* Camera 面板. *Since:* 2.399.0

### 時間軸上的 3D 圖層

- **3D 文字與模型** — 擠出的 3D 文字，或 FBX、OBJ、GLB 和 glTF 模型，可像任何圖層一樣移動和設關鍵影格。 *Where:* T 下方的 3D 按鈕. *Since:* 2.382.0
- **3D 控制項** — 用 G、R 和 S 在 3D 空間中移動、旋轉和縮放。 *Where:* 移動工具. *Since:* 2.385.0
- **材質與燈光** — 材質預設或自訂材質，攝影棚燈光以及自訂的點光源、聚光燈、太陽光、環境光和天空光。 *Where:* 3D 圖層的 Properties. *Since:* 2.385.0
- **3D 工具列** — 控制項、吸附、檢視、旋轉、重設、材質、燈光、關鍵影格和烘焙。 *Where:* 畫布頂部. *Since:* 2.386.0
- **為合成而烘焙** — 3D 圖層會自動烘焙為透明影片。 *Where:* Compile
- **用 Blender 渲染** — 合成時由 Blender 渲染 3D 圖層。 *Where:* 3D 圖層的 Properties. *Since:* 2.385.0

### 標尺、參考線與網格

- **標尺與參考線** — 以畫面像素為單位的標尺；可拖出參考線、移動參考線或輸入其位置。 *Where:* 時間軸選單列. *Since:* 2.446.0
- **吸附** — 移動的圖層會吸附到參考線、畫面的邊緣和中心以及網格。 *Where:* 預覽畫布. *Since:* 2.446.0
- **網格** — 覆蓋在預覽畫布上的網格，有自己的設定。 *Where:* 時間軸選單列. *Since:* 2.445.0
- **網格與參考線設定** — 間距、主網格線、線或點、顏色和吸附距離。 *Where:* Timeline settings. *Since:* 2.445.0

### 文字與範本

- **文字效果預設** — 輸入時即時繪製的多層 3D 文字效果；可從 PSD 匯入你自己的效果。 *Where:* 文字圖層的 Properties. *Since:* 2.411.0
- **動畫文字、路徑文字和 3D 文字上的預設** — 帶預設的文字在使用 ✨ Text Animators 和 〰 On a path 時保留預設；3D 文字將預設用作正面（側面使用其顏色）。 *Where:* 文字的 Properties，3D 文字的 Properties. *Since:* 2.607.0
- **使用你的預設新建文字** — T 工具新建的文字預設使用上次選擇的預設；未選取任何內容時 = Properties ▸ New text ▸ Preset。 *Where:* 時間軸. *Since:* 2.607.0
- **🧬 變形** — 在兩個圖層之間讓一個角色變成另一個角色：寫出兩個角色，選擇這兩個圖層；提示詞會自動寫好，首幀 / 尾幀會自動擷取，由影片模型渲染，結果放在兩者之間的 🧬 Morph 圖層上，圖層 2 會後移到它之後開始。 *Where:* 時間軸的圖層面板 ▸ 🧬 Morph 分頁. *Since:* 2.610.0
- **▯ 幀：點選一幀，按 Del 刪除** — 一種時間軸工具，用於選擇某個圖層上的單幀（點選，拖曳選多幀，Shift+點選，← / →）；按 Del / ⌫ 將其從該圖層中剪掉併合攏空隙，↶ 可恢復。 *Where:* 時間軸的選單列 ▸ ▯（或在圖層上按 F）. *Since:* 2.611.0
- **剪下後的片段仍是一個片段** — 對跨越片段的幀執行 ✂ Cut / Del，會把前後兩部分連線成一個連續片段（影片 / 聲音會生成一個幀精確的 "-join" 檔案；圖片則只是變短）；一次 ↶ 即可復原。預覽會提前一秒載入下一個片段，因此剪下處絕不會閃黑。 *Where:* 時間軸 ▸ ✂ Cut（開啟波紋）. *Since:* 2.612.0
- **播放時標記 ▼ 範圍** — 預覽播放時按一下 Ctrl 標記範圍的開始，再按一下標記結束，可在高亮的圖層上標記任意多個，每個範圍顏色不同；拖曳 ▼ 可移動它（預覽會顯示該幀）。 *Where:* 時間軸（Ctrl），時間標尺中的 ▼. *Since:* 2.613.0
- **選擇範圍，用 ✂ Cut 剪掉** — 點選 ▼ 選擇其範圍，Ctrl / Shift + 點選可選擇更多；✂ Cut（以及 ⏩ / ✕）作用於所選範圍，未選擇時作用於全部範圍。 *Where:* 時間軸標尺的 ▼ + 選單列的 ▼ 組. *Since:* 2.614.0
- **每個風格獨立的 Basic Settings** — 每個風格都會保留你上次與它一起使用的 Basic Settings（misc/basic_settings.tmp）：切換風格時，先儲存所離開風格的設定，再恢復新風格的設定；應用啟動時會開啟上次使用的風格及其設定。影片風格儲存除影像設定組以外的所有設定；影像風格儲存影像設定組。 *Where:* 任意風格清單（提示詞面板、Basic Settings 的風格卡片）. *Since:* 2.615.0
- **彩色安裝過程，絕不看起來卡住** — 在安裝視窗的步驟、日誌和下載中，以及安裝腳本中，已完成顯示為綠色，正在安裝顯示為淺綠色（帶用時），警告為橙色，錯誤為紅色；長時間無輸出的步驟會說明它仍在執行、為何可能耗時較長，以及它並沒有卡住。 *Where:* 安裝視窗，install_all，start.bat. *Since:* 2.634.0
- **一個檔案完成安裝** — install_all.bat / install_all.sh / install_all.command：缺少 Git 和 Node.js 時自動安裝（Windows：還有 Python），將倉庫複製到該檔案旁邊，然後啟動工作室（首次啟動時安裝其餘部分）。 *Where:* 倉庫根目錄——只需下載該檔案. *Since:* 2.616.0
- **從 zip 匯入文字效果** — 一個包含 PSD 文字效果的 zip（效果包）可一次性將其中每個效果安裝為預設，並附帶其中的字型；也可以一次選擇多個 PSD。 *Where:* 文字圖層的 Properties / 影像編輯器的 Type 工具 ▸ Presets ▾ ＋ Import PSD text effects or a zip…. *Since:* 2.617.0
- **隱藏 / 刪除橋接圖層時關閉其橋接** — 隱藏或刪除 Blender、3D（Daz / Blender）或 Unreal 圖層時，會關閉其在影像編輯器和時間軸中的場景 / 即時檢視（Blender 程序結束，Unreal View 停止，Daz 中等待執行的命令被丟棄）。 *Where:* 影像編輯器的 Layers（👁 / 刪除），時間軸的圖層. *Since:* 2.618.0
- **✂ 剪掉所有範圍 / ⏩ 加速範圍** — 一次剪掉所有已標記的範圍（被剪多次的片段仍是一個片段），或將每個範圍以 2× - 10× 的速度播放，快進渲染畫面。 *Where:* 時間軸的選單列 ▸ ▼ 組. *Since:* 2.613.0
- **懸停時間 + 播放速度** — 指標所在位置的時間顯示在時間軸上方的小框中；預覽可以 0.125× - 8× 的速度播放。 *Where:* 時間軸；預覽下方的速度清單. *Since:* 2.613.0
- **✂ 到新圖層** — 一個核取方塊，勾選後剪下或 Ctrl+K 分割之後的部分會放到正上方的新圖層上。 *Where:* 時間軸的選單列. *Since:* 2.612.0
- **形狀圖層中的文字** — 文字拉伸以填滿形狀圖層的輪廓，或在其中排布（Fit），放置在形狀上；跟隨動畫形狀變化。 *Where:* 文字的 Properties ▸ 🔤 In a shape. *Since:* 2.608.0
- **🅰 形狀圖層的文字填充** — 用一行行文字填充形狀（字型、字號、顏色、角度）。 *Where:* 形狀圖層的 Properties ▸ ◆ Shape. *Since:* 2.608.0
- **任意圖層上的變形預設** — 16 種預設（Arc … Twist、Wedge），以可編輯的 ⌗ 網格形式提供，可用 📌 拖曳。 *Where:* Properties ▸ 📌 Warp ▸ ⌇ Preset. *Since:* 2.608.0
- **動態圖形範本** — 下方三分之一字幕條、標題卡、片尾卡和角標，也可儲存自己的範本。 *Where:* 時間軸選單列. *Since:* 2.417.0

### 時間軸上的工具與 CAD 工具列

- **工具與屬性面板** — 畫布工具和所選圖層的設定位於單獨的面板中，可停靠在畫布旁邊或浮動。 *Where:* 按鍵 1. *Since:* 2.385.0
- **時間軸的 CAD 工具列** — 預覽行上方的功能區，帶有 Create、3D、Sketch、Solid 和 Unreal 分頁（參見“CAD 與 3D”）。 *Where:* 時間軸. *Since:* 2.470.0
- **時間軸設定** — 微移、歌曲時間、卡拉 OK 樣式和網格。 *Where:* 時間軸選單列右側的設定按鈕. *Since:* 2.376.0

## 影像編輯器

一款分層影像編輯器，具備選取範圍、修飾、智慧物件、文字、向量繪圖、尺寸標註、CAD 草圖和 AI 功能，全部在本機執行。

### 佈局、文件與面板

- **選單列、選項欄和工具列** — File、Edit、Image、Layer、Select、Filter、View、Window 和 Help，每一項都有其常用快捷鍵；選項欄顯示目前工具的設定。 *Where:* Image editor 面板。 *Since:* 2.389.0
- **工具組** — 組內還有其他工具時，可按 Shift 加該工具的快捷鍵迴圈切換，或通過右鍵點選、長按開啟。 *Where:* 工具列
- **命令面板** — 輸入命令的一部分，然後按 Enter。 *Where:* Ctrl+K
- **快捷鍵清單** — 所有按鍵集中在一個清單中。 *Where:* Help > Keyboard Shortcuts
- **全螢幕** — 編輯器填滿 bitGen 自身各欄之間的空間；其狀態行移入 bitGen 的狀態列。 *Where:* F 鍵或全螢幕按鈕。 *Since:* 2.393.0
- **顯示或隱藏面板** — Tab 隱藏所有面板，Shift+Tab 只隱藏面板組。 *Where:* 影像編輯器
- **文件** — 每次 New 或 Open 都會生成一個獨立文件，擁有各自的圖層、復原記錄、選取範圍、路徑、通道和縮放。 *Where:* 影像編輯器。 *Since:* 2.430.0
- **分頁與浮動視窗** — 第一個文件以分頁形式停靠，之後的文件在各自的視窗中浮動；可在兩者之間拖曳。 *Where:* 文件分頁。 *Since:* 2.430.0
- **關閉與排列文件** — Close 和 Close All 會詢問如何處理未儲存的更改；平鋪、層疊、合併為分頁、下一個和上一個文件。 *Where:* File 和 Window > Arrange。 *Since:* 2.430.0
- **面板組** — Color 和 Swatches；Properties、Adjustments、AI 和 Control；Layers、Paths、Channels、History、Actions 和 Comps；另有 Character、Paragraph、Sketch、3D、Body 和 Unreal 分頁。 *Where:* 右側欄
- **浮動面板組** — 每個標籤組都可通過其浮動按鈕浮動，並可停靠回側欄。 *Where:* 各組的分頁。 *Since:* 2.438.0
- **側欄本身就是面板** — 將浮動組放到另一個組的上方或下方（橙色線條指示放置位置）；側欄寬度可在 200 到 640 px 之間拖曳調整。 *Where:* 右側欄。 *Since:* 2.454.0
- **編輯器中的命名面板** — 將浮動組作為分頁停靠到你命名的面板中。 *Where:* Window > New Docker。 *Since:* 2.438.0
- **屬性欄** — 所選圖層的 X、Y、W 和 H，帶比例鎖定；矩形的圓角半徑；向量形狀的輪廓寬度和線型。 *Where:* 選項欄下方。 *Since:* 2.439.0
- **歷史記錄** — 最近 80 步；點選其中一步即可後退或前進到該步。 *Where:* History 面板
- **編輯器設定** — AI 結果、上下文、羽化、百萬像素、Apply 的作用、外觀、標尺、面板和選項欄。 *Where:* 設定按鈕，或 Edit > Preferences（Ctrl+,）。 *Since:* 2.444.0

### 圖層

- **像素、填充、文字和形狀圖層** — 純色或漸層填充、可編輯的文字和形狀。 *Where:* Layers 面板
- **調整圖層** — 16 種（Brightness/Contrast、Levels、Curves、Exposure、Vibrance、Hue/Saturation、Color Balance、Black & White、Photo Filter、Channel Mixer、Color Lookup、Gradient Map、Selective Color、Invert、Posterize、Threshold），在 Properties 中即時調整。 *Where:* Adjustments 面板
- **組** — Ctrl+G 編組，Shift+Ctrl+G 取消編組；Pass Through 讓組內的調整作用於其下方的圖層。 *Where:* Layers 面板
- **圖層遮罩** — 在遮罩上繪畫，Alt+點選檢視遮罩，Shift+點選停用遮罩，Ctrl+點選將其載入為選取範圍；密度、羽化、反相、應用。 *Where:* Layers 面板
- **剪貼遮罩** — 圖層只在下方圖層有像素的地方顯示。 *Where:* Alt+Ctrl+G
- **填充不透明度、鎖定和標籤** — 填充不透明度只減淡像素，不影響圖層樣式；可鎖定透明度、像素、位置或全部；可從右鍵選單設定顏色標籤。 *Where:* Layers 面板
- **排列與合併** — 上下移動圖層、Merge Down、Merge Visible、Flatten Image、Rasterize。 *Where:* Layer 選單
- **圖層複合** — 儲存圖層的可見性、位置和外觀，可在各複合之間切換、更新某個複合，或回到上一次的文件狀態。 *Where:* Window > Layer Comps。 *Since:* 2.434.0
- **刪除圖層** — Del 刪除目前圖層（有選取範圍時則清除選取範圍內容）；Shift+Del 始終刪除圖層。 *Where:* 影像編輯器。 *Since:* 2.451.0
- **無工具** — Esc 放下工具（不選任何工具）；點選選取一個物件，按住 Shift 或 Ctrl 點選可追加選擇。 *Where:* 影像編輯器，Esc。 *Since:* 2.474.0
- **選擇框** — 在無工具狀態下拖出虛線框：從左向右拖曳選取完全位於框內的圖層，從右向左拖曳選取與框接觸的圖層；按住 Shift 可追加。 *Where:* 無工具狀態下的畫布。 *Since:* 2.474.0
- **同時操作多個圖層** — Shift+點選選取兩個圖層之間的所有圖層，Ctrl+點選新增或移除單個圖層；Move 工具可一起移動它們，Del 將它們全部刪除。 *Where:* Layers 面板。 *Since:* 2.474.0
- **將選取的圖層編組和刪除** — 選取多個圖層時，Ctrl+G 將它們放入一個組（對單個組按 Ctrl+G 則取消編組），🗑 按鈕將它們全部刪除。 *Where:* Layers 面板。 *Since:* 2.547.0
- **拖入為圖層或新文件** — 將圖片拖放到已開啟的畫布上時會詢問：作為圖層新增，還是作為新文件開啟。 *Where:* 影像編輯器的畫布。 *Since:* 2.549.0
- **生成 = 新圖層** — 在影像編輯模式下，生成的圖片總是作為新圖層匯入，並使用提示詞面板中選定的風格（Generate 會列出 Krea 2 及其他所有風格）。 *Where:* 影像編輯模式下的提示詞面板。 *Since:* 2.549.0
- **無縫填充** — 選取範圍通過提示詞面板所選風格的專用工作流圖（編碼後的圖片 + 雜訊遮罩 + 差分擴散）進行填充，融合效果與 Krita AI 外掛相同；Krea 2、Klein 等風格現在都能用於填充。 *Where:* 有選取範圍時的影像編輯器，Generate / Refine。 *Since:* 2.550.0
- **帶斜切的變換；粘貼後移動** — Ctrl+T（或 Move 工具選項欄上的 ⤡ Transform）可縮放、旋轉和斜切（Ctrl + 拖曳邊緣）；Paste 會取消選取範圍，以便 Move 工具移動貼上進來的圖層。 *Where:* 影像編輯器。 *Since:* 2.550.0
- **用中間控點斜切** — Free Transform 的中間控點可斜切圖層（顯示斜切游標），按住 Shift / Alt 拖曳中間控點則為拉伸。 *Where:* 影像編輯器，Ctrl+T。 *Since:* 2.551.0
- **像 Krita AI 外掛一樣填充** — 選取範圍周圍提供更多上下文，選取範圍先由其邊緣內容預填充，使用柔和遮罩，對未針對區域性重繪訓練的模型以 0.9 為起始值。 *Where:* 有選取範圍時的影像編輯器。 *Since:* 2.551.0
- **採用 Krita 外掛自身程式碼的填充與編輯** — Generate 以全強度執行，小區域放大後渲染，遮罩大小隨選取範圍而定，越過邊緣進行融合併匹配顏色，在選取範圍內 Edit 只改動選取範圍。 *Where:* 有選取範圍時的影像編輯器。 *Since:* 2.552.0
- **用編輯模型填充** — 在選取範圍中通過編輯模型執行 Generate / Remove / New background（選取範圍塗成綠色 + Krita 的指令），使新內容與場景融為一體；▾ Edit 可限定在選取範圍內，或限定在圖層自身的像素內。 *Where:* 影像編輯器的 ✨ AI 面板（👁）、提示詞面板。 *Since:* 2.553.0
- **Generate 適應選取範圍** — 無法看到選取範圍周圍內容的風格會按選取範圍自身邊界框的尺寸生成圖片，因此畫出的內容與選取範圍大小一致。 *Where:* 影像編輯器的 ✨ AI 面板（👁 關閉）、提示詞面板。 *Since:* 2.554.0
- **按模型系列採用 Krita AI 外掛的填充方式** — SDXL / Pony 使用 Fooocus inpaint 補丁，Illustrious / SD 1.5 / FLUX.1 使用區域性重繪 ControlNet，Remove 先用 MAT / LaMa 處理，並採用 Krita 的上下文邊界及其 Add content / Fill 模式。 *Where:* 影像編輯器的 ✨ AI 面板（填充行）、提示詞面板；安裝介面會列出所需節點包和模型。 *Since:* 2.555.0
- **⏳ 待處理** — 每次 ✨ 執行都直接進入佇列，無需等待；結果在編輯器內的一個面板中等待，✔ Apply 將其放到所屬圖層上方、該圖層的“✨ changes”組中，🗑 Delete 將其丟棄。 *Where:* 影像編輯器（✨ AI 面板中的 ⏳ Pending）。 *Since:* 2.556.0
- **面板欄可放入任意浮動面板** — 按住標題將浮動面板（用 ⇱ 浮動出來的主面板、▣ 面板、Basic Settings、LLM tokens、提示詞面板、⏳ Pending）拖到影像編輯器的面板欄上，即可停靠在此——可從其標題欄摺疊、移動、調整大小或再次浮動；下次啟動時保留，並隨編輯器一起顯示 / 隱藏。 *Where:* 影像編輯器的面板欄（Layers 所在處）。 *Since:* 2.609.0
- **所有 ✨ 模式都可使用參考圖** — 提示詞中的“picture N”會把 References 面板中的對應圖片帶入 Edit、Generate、Fill、Remove、Refine（通過編輯模型）；Compose 中則使用“ref N”。 *Where:* 影像編輯器的 ✨ AI 面板、提示詞面板。 *Since:* 2.556.0
- **AI 填充模型附加元件** — 用於 Krita 方式填充的節點包 + Fooocus / MAT / 區域性重繪 ControlNet 檔案，在 Settings ▸ Add-ons 中勾選並下載。 *Where:* Settings ▸ Add-ons ▸ AI fill models。 *Since:* 2.557.0
- **▣ 面板可容納任意麵板** — 與其他浮動面板位於同一浮動層（而非置於所有內容之上），拖曳面板時會顯示輪廓；Settings、References、Assets、Queue、Gallery 和 StoryBoard 可按住標題欄拖入。 *Where:* 狀態列的 ▣ Docker（Ctrl+Alt+D）。 *Since:* 2.558.0
- **資料夾篩選會記住所選資料夾；Basic Settings 儲存在 basic.cfg 中** — 每個資料夾篩選下拉框都會保留你選擇的資料夾（folder_filters.cfg）；Basic Settings 在更改時儲存到 basic.cfg，並在啟動時讀回。 *Where:* 任意模型下拉框的資料夾篩選、📁 瀏覽器、Model manager；Basic Settings。 *Since:* 2.559.0
- **▣ 面板可停靠，任何面板都能放入** — 按住標題欄拖曳浮動的 ▣ 面板，可將其停靠到某個面板的上方 / 下方 / 旁邊，或停靠到側邊面板中（藍色放置區域）；Basic Settings、LLM tokens 和提示詞面板可放入 ▣ 面板，也可再浮動出來。 *Where:* 狀態列的 ▣ Docker（Ctrl+Alt+D）。 *Since:* 2.560.0
- **將 ▣ 面板作為獨立的一欄** — 放到兩欄之間的接縫處（或視窗邊緣）時，它會變成一個全高的欄，並帶有自己的分隔條；重新啟動後保留。 *Where:* 按住標題欄拖曳 ▣ 面板。 *Since:* 2.561.0
- **恢復的任務回到所屬場景；不再自動播放** — 因重新啟動而中斷的 StoryBoard 場景，在 Queue 面板的 Pending 分頁中按下 ▶ Resume 後會取回其任務（執行狀態及其進度列）；影片和歌曲載入後處於暫停狀態，按 ▶ / Space 才開始播放。 *Where:* Queue 面板的 Pending 分頁；StoryBoard；播放器。 *Since:* 2.562.0
- **使用其他場景的圖片；以 🅰 Picture A 生成首幀** — 場景選擇器的 🎬 Scenes 分頁（每個場景自身的圖片）和 🎞 Clips（任意鏡次的幀）；✎ First frame 以選定的 Picture A 為起點（保留風格、構圖和姿勢），置於新的地點或全域提示詞設定的地點，指令由 LLM 編寫（🤖 Write）。 *Where:* StoryBoard 場景卡片。 *Since:* 2.563.0
- **🎙 語音對話** — 像即時聊天一樣免手動與應用交談：它能聽懂你說的話（faster-whisper，本地執行，常駐載入），本地 LLM 會出聲回答並執行你的要求——提示詞、風格、Basic Settings、Generate、StoryBoard 場景、面板。 *Where:* 狀態列的 🎙 Voice（Ctrl+Alt+V）。 *Since:* 2.564.0
- **StoryBoard 網格；🎞 編寫故事板** — 場景以類似 Model manager 的卡片排列在網格中，用 ➜ 指向下一個場景，點選可開啟完整的場景卡片；LLM 編寫各個場景，每個場景都會以其故事板圖片作為起始（First）幀。 *Where:* StoryBoard（▦ / ☰、🎞 Write storyboard、☑ Start on it）。 *Since:* 2.565.0
- **MOSS-Image** — OpenMOSS 的 5B 影像模型，提供兩種影像風格（SFT、Base）；Settings ▸ Add-ons ▸ MOSS-Image 會將你勾選的模型、文字編碼器和 VAE 下載到 ComfyUI 中，並檢查 ComfyUI 版本是否足夠新。 *Where:* Settings ▸ Add-ons；Settings ▸ Image（各風格）。 *Since:* 2.566.0
- **NitroFusion2 圖像** — 把 Z-Image-Turbo 蒸餾到 1-2 步：一步就有清晰的文字和細節；三個風格（1 步、配合去蒸餾 LoRA 的 2 步、適合小顯示卡的 GGUF），cfg 1，無負面提示詞。 *Where:* Image 停駐欄的風格，檔案在 Settings > Add-ons > NitroFusion2。 *Since:* 2.729.0
- **主題編輯器：對齊、內邊距、外邊距、圓角** — Style 面板可對齊文字（左 / 置中 / 右 / 兩端對齊，上 / 中 / 下——適用於按鈕、彈性行 / 列、網格和文字塊），為元素及其文字設定內邊距和外邊距（每一邊單獨設定，= 同時設定四邊），並可單獨設定每個角的圓角。 *Where:* 🖌 Edit theme 模式 ▸ 點選某個元素 ▸ Text / Box。 *Since:* 2.567.0
- **由 LLM 編寫的 StoryBoard 圖片** — 🖼 將場景發回給 LLM，為其開場幀編寫圖片提示詞，並以角色設定表和上一個場景的最後一個影格（若該場景已有鏡次）作為參考圖；📁 更換圖片（其他場景的圖片、某個鏡次的幀、專案圖片或檔案）；圖片在網格中鋪滿整張卡片。 *Where:* StoryBoard ▸ ▦ 網格 ▸ 卡片的 🖼 / 📁；工具列上的 ☑ LLM writes it / ☑ Previous last frame。 *Since:* 2.568.0
- **🔲 區域（影像編輯器）** — 畫布上的若干框，每個框寫明其中要放的內容；可逐框填充（每個框執行一次 ✨ Generate）、由 Edit 模型一次完成（在副本上勾出各框輪廓），或作為區域提示詞一次完成（生成新圖片，每個框的文字只作用於框內）。 *Where:* Image editor ▸ ✨ AI panel ▸ 🔲 Zones；與選框工具放在一起的 Zones 工具。 *Since:* 2.569.0
- **🎭 區域角色 LoRA** — 區域的 🎭 可選擇一個只在該框內生效的角色 LoRA（最多兩個不同的 LoRA），讓兩個角色在同一張圖片中各自保持自己的面孔；場景描述作用於整張圖片。 *Where:* Image editor ▸ ✨ AI ▸ 🔲 Zones ▸ ▦ Regional（Settings ▸ Add-ons ▸ Nougan Nodes）。 *Since:* 2.592.0
- **🖊 數位板（影像編輯器）** — 帶曲線的筆壓（預設或自訂）、最輕觸壓 / 滿壓力區間、你的筆所傳送的壓感級數、傾斜、橡皮擦端和側鍵；所有畫筆均支援壓力 → 大小 / 不透明度；7 種筆刷（G-pen、Mapping pen、Brush pen、Real pencil、Fineliner、Technical pen、Calligraphy）。 *Where:* Image editor ▸ 🖊 Pen 分頁（位於 🖌 Brush 旁）、Window ▸ Pen Tablet；畫筆預設 ▾。 *Since:* 2.570.0
- **多選並拖曳多個片段；⛓ 順序排列** — 在 Gallery、Assets 或 References 中按住 Ctrl / Shift 點選多個片段，一起拖到時間軸上（最早的放在最上層，依次首尾相接）；⛓ Sequential 讓時間軸上的片段沿各圖層依次連續播放，刪除、新建圖層和修剪後都不會留下空隙。 *Where:* Gallery / Assets / References（Ctrl / Shift+點選、拖曳）；時間軸工具列 ▸ ⛓ Sequential。 *Since:* 2.571.0
- **✨ 自動轉場；🔇 影片聲音** — 在不同圖層的影片片段之間的每個剪下點新增 N 幀轉場，不移動任何片段（與歌曲的口型同步保持精確——前一個片段會延續到下一個片段之下）；一個按鈕即可將所有影片圖層靜音 / 取消靜音，只播放完整的歌曲。 *Where:* 時間軸工具列 ▸ ✨ Auto transition [frames] [type]、🔊 Video sound。 *Since:* 2.572.0
- **✂ 歌曲剪下時長** — StoryBoard 歌曲條可按任意間隔自動剪下（2-60 s；29.9 = 每個場景一次 Long video 執行）；已鎖定的段落保持不變；設定會被記住。 *Where:* 歌曲條的選單列 ▸ ✂ [s]。 *Since:* 2.573.0
- **⤓ 更新 ComfyUI；啟動時檢查更新** — 就地更新 ComfyUI（使用便攜版自帶的更新程式，或 git + pip），可選 Newest 或 Stable 通道，由本應用啟動的 ComfyUI 會隨之重新啟動；啟動後在 GitHub 上檢查 bitGen Studio 和 ComfyUI，任一有新版本時狀態列顯示 ⬆。 *Where:* Settings ▸ ComfyUI ▸ ⟳ ComfyUI updates；Settings ▸ General ▸ ⟳ Updates ▸ Check for updates on startup。 *Since:* 2.573.0
- **FastH3 Omni** — 以 8 步完成 MiniMax H3 的參考圖生影片（FastVideo）：一種影片風格、一個 StoryBoard Workflow、一個負責下載的附加元件，以及在任何載入它的 H3 工作流圖上應用的配方（shift 12/3、VSA、8 步）。 *Where:* Settings ▸ Add-ons ▸ FastH3 Omni；StoryBoard ▸ Workflow ▸ FastH3 Omni。 *Since:* 2.573.0
- **在主題編輯模式中重新命名面板標題和任意文字** — 面板的標題欄，以及按鈕 / 框旁帶文字的任意元素，都可改用新文字（保留下拉箭頭和按鈕，摺疊後依然保留新文字）。 *Where:* 🖌 主題編輯模式 ▸ 選取 ▸ Layout ▸ Text。 *Since:* 2.574.0
- **隨處顯示目前步數 / 總步數** — 圖片（ComfyUI 和 sd-cli）、音樂和影片會即時報告取樣器步數，所有顯示正在執行的生成任務的面板、對話方塊和卡片都會顯示“第 n 步 / 共 total 步”。 *Since:* 2.574.0
- **主題編輯 ▸ Apply to: This element only（預設）** — 每次選取都只作用於該元素本身；新文字絕不會擴散到其他面板或元素。 *Where:* 🖌 主題編輯模式 ▸ Apply to。 *Since:* 2.574.1
- **模型管理器：你的檔案、縮圖、後設資料** — 模型的圖片 / 影片 / 聲音及其提示詞 + 種子 / cfg / 步數（從檔案或渲染記錄中讀取），點選開啟檢視器，✎→ 傳送到提示詞，🖼 設為縮圖。 *Where:* 🧩 Model manager ▸ ⓘ ▸ Your pictures, videos and sounds；✎ Edit ▸ Thumbnail。 *Since:* 2.575.0
- **模型管理器：半星評分、模型類型、NSFW** — 以半星為單位的五星評分編輯器、模型類型（檢查點（checkpoint）、LoRA …）以及 NSFW 標記；篩選欄可按這兩項篩選。 *Where:* 🧩 Model manager ▸ ✎ Edit；篩選欄。 *Since:* 2.575.0
- **✎→ 從任意檔案傳送到提示詞** — 將檔案的提示詞及其種子、cfg 和步數傳送到提示詞框 + Basic Settings。 *Where:* 相簿、Assets、References 的縮圖塊；檢視器的 ⓘ 詳情。 *Since:* 2.575.0
- **狀態列中的 Civitai 同步** — 同步時顯示 🔄 Civitai n/total，完成時顯示 ✓ synced 及各項計數。 *Since:* 2.575.0
- **面板按離開時的佈局恢復** — ▣ 面板的成員、標籤順序、目前顯示的分頁、隱藏 / 摺疊狀態、最小化的浮動面板、擴充功能面板——重新啟動後都會保留。 *Since:* 2.575.0
- **按 SHA-256 進行 Civitai 同步** — 按名稱找不到的模型會按檔案內容查詢；狀態列顯示讀取進度 n%。 *Where:* 🧩 Model manager ▸ 🔄 Sync。 *Since:* 2.576.0
- **🧩 傳送到模型… / Ctrl+↓ 設為縮圖** — 檢視器可將圖片 / 影片 / 歌曲連同其後設資料傳送到某個模型的檔案中；Ctrl+↓ 將圖片設為該模型的縮圖。 *Where:* 檢視器；🧩 Model manager ▸ ⓘ。 *Since:* 2.576.0
- **自訂姿勢表** — Character creator 的 🧍 Pose sheet 對話方塊會顯示 pose_sheets 資料夾中圖片的縮圖；選取的那張決定角色設定表的分格、姿勢和機位角度。 *Where:* StoryBoard ▸ 🖼 NEW（Character creator）▸ Sheet ▸ Pose sheet；pose_sheets 資料夾。 *Since:* 2.577.0
- **📐 SolidCraft 面板** — 開源參數化 3D CAD（SolidCraft，MIT OR Apache-2.0）位於獨立面板中，包含 SolidCraft 的全部功能；設計和零件儲存在專案中，SolidCraft 的 Save 會使其保持最新；可將模型的圖片（或 SolidCraft 的渲染圖）送入影像編輯器，將模型作為時間軸 3D 圖層，將影像編輯器的草圖圖層送入 SolidCraft，並將 STEP / STL / OBJ / 3MF 匯入專案。 *Where:* 狀態列中的 📐 SolidCraft；Settings ▸ Add-ons ▸ SolidCraft。 *Since:* 2.578.0
- **從 SolidCraft 傳送** — 將零件傳送到影像編輯器、時間軸、📏 Sketcher（2.630.0：作為一個組——此前是 House builder）、Blender（隨之開啟並儲存為 .blend——找到 Blender 時顯示）和 Unreal（作為 Static Mesh 放入關卡——設定了 Unreal 專案時顯示；外掛 1.4.0）；僅在安裝了 SolidCraft 時顯示該面板。 *Where:* 📐 SolidCraft 的工具列。 *Since:* 2.579.0
- **無需設定即可使用已安裝 ComfyUI 的模型** — Settings 中未指定 ComfyUI 資料夾時，會自動查詢本機上的 ComfyUI（環境變數、應用旁邊、主目錄、Pinokio、Stability Matrix、各驅動器根目錄、ComfyUI Desktop），並在 Model manager 和 Basic Settings 中列出其檢查點和擴散模型；點選 Use this folder 即可將其設定下來。 *Where:* 🧩 Model manager；Basic Settings ▸ Model / checkpoint；Settings ▸ ComfyUI ▸ Folder。 *Since:* 2.622.0
- **從磁碟刪除模型** — 刪除該檔案、其旁邊的相關檔案以及它的 model_info 頁面，刪除前會彈出確認，列出這些檔案及使用該模型的風格。 *Where:* 🧩 Model manager ▸ 卡片上的 🗑 / ⓘ ▸ 🗑 Delete。 *Since:* 2.579.0
- **設定 ▸ 面板** — 列出每個面板和浮動視窗（包括擴充功能的），顯示其所在位置，↺ Reset 可將其恢復到預設位置和大小；↺ Reset all 全部重設。 *Where:* Settings ▸ Dockers。 *Since:* 2.579.0
- **模型路徑（extra_model_paths.yaml）** — 管理 ComfyUI 額外模型路徑的每個組：➕ 新建組（other_ui1、other_ui2 …，根據其 base 下的資料夾自動填充），更改 / 新增 / 刪除路徑（用 📁 選擇），重新命名，is_default，🗑 刪除組；檔案的其餘內容保持不變，並保留上一版的 .bak 備份；⟳ Restart ComfyUI。 *Where:* 🧩 Model manager ▸ 📁 Model paths。 *Since:* 2.580.0
- **Civitai 影片和動態圖片** — 🔄 Sync / ⤓ Civitai info 也會儲存模型的影片和 GIF 範例；影片縮圖在卡片及其 ⓘ 頁面上播放，檢視器也可播放；影片可用作卡片的縮圖。 *Where:* 🧩 Model manager。 *Since:* 2.581.0
- **LLM 提示詞中的 LoRA 關鍵詞** — ✨ Enhance 和提示詞聊天會將所選 LoRA 的關鍵詞（觸發詞）寫入提示詞；LLM 遺漏的關鍵詞由 Enhance 補上。 *Where:* Prompt 面板 ▸ ✨ Enhance / 提示詞聊天。 *Since:* 2.581.0
- **✨ 在 SolidCraft 中生成零件** — 文字描述或圖片 -> CadQuery 程式碼（cadrille，或帶錯誤修復的本地 LLM）-> SolidCraft 自身可編輯的草圖、拉伸、切除、孔、圓角和倒角（按體積校驗；否則將 STEP 作為單個實體匯入）；程式碼可編輯並重新執行。 *Where:* 📐 SolidCraft ▸ ✨ Generate；Settings ▸ Add-ons ▸ CAD generate。 *Since:* 2.581.0
- **Fibo 2.0（編輯，低顯示記憶體）** — Bria 的 8B 模型，提供兩種影像風格：Edit Turbo（4 步指令編輯）和 Dev（文生圖 + 編輯）；最多 4 張圖片 <image_1>..；w4a8 或 GGUF Q4_0 檔案適用於約 8 GB 顯示記憶體的顯示卡；從 Settings ▸ Add-ons ▸ Fibo 2.0 下載（CC BY-NC 4.0）。 *Where:* image editor ▸ ✨ AI ▸ Edit；Settings ▸ Image。 *Since:* 2.582.0
- **團隊 ▸ 渲染農場** — 基於 NAS 資料夾的團隊：負責人審批成員，其 bitGen 每天為每位成員簽發一個簽名金鑰；所有人開啟相同的專案；PC 的所有者可允許成員在該 PC 上渲染（不限時段或指定起止時間），且僅在該 PC 執行 bitGen 並開啟共享時有效；🖥 Render on: This PC / 某位成員的 PC / ⚡ Spread，並顯示團隊的渲染任務和進度。需處於同一網路或使用 Tailscale。2.589.0：改為可選的附加元件（單獨的 zip——可能會觸發防毒軟體）。 *Where:* Settings ▸ Add-ons ▸ Team render farm，然後 Settings ▸ Team；狀態列的 🖥 狀態標籤。 *Since:* 2.583.0
- **🔁 比較 LLM** — 同一個提示詞依次由每個勾選的 LLM 回答，每條回覆顯示在聊天中各自的名稱下；✓ Use this one 將其設為答案，每一輪（請求、每條回覆、所做的選擇、耗時）都會被記錄，🏆 顯示每類工作（劇本、音樂影片、歌曲、圖片 / 影片提示詞、聊天）的最佳 LLM，附帶勝率、平均耗時及 CSV 匯出。 *Where:* 提示詞面板的選單列（🔁 ▾ 🏆）。 *Since:* 2.584.0
- **用你的選擇訓練 LLM** — 🔁 Compare LLMs 的每一輪都會儲存完整的提示詞；🏆 ▸ 🎓 將選取的回覆（範例）以及“選取 vs 未選取”配對傳送到訓練器的 LLM 任務；訓練器從 Examples（SFT）或 Preferences（DPO / ORPO，Beta）中學習，並寫出新的 .gguf。 *Where:* 🏆 ▸ 🎓 Train an LLM on your picks；🎓 LoRA trainer ▸ Job ▸ Learn from、Dataset ▸ 🔁 Preference pairs。 *Since:* 2.585.0
- **附加元件 ▸ LLM** — 聊天 / 寫作用的 LLM 集中在一個下拉框中（★ Qwen3.8 27B——用作你自己檢查點的基礎模型、Gemma 4 31B / 12B、Qwen3.5 9B、Qwen3 4B / 8B / 14B），下載到 LLM 資料夾；訓練器的 Qwen3.8 27B 基礎模型可在 32 GB 顯示記憶體的顯示卡上以 4-bit QLoRA 方式訓練。 *Where:* Settings ▸ Add-ons ▸ LLM；🎓 LoRA trainer ▸ Base model。 *Since:* 2.586.0
- **⤒ 匯入並檢查 ComfyUI 工作流** — 任意儲存版 / API 版工作流：統計其圖片 / 影片 / 聲音輸入，將預覽節點改為儲存節點，報告缺失的節點和模型檔案，連線 Prompt / Negative / Seed / Steps / CFG / 尺寸 / 時長控制項，並繪製工作流圖；▶ Test run 使用測試輸入試執行——成功時儲存到 comfy_workflows/ 並附帶工作流圖，失敗時顯示 ComfyUI 的錯誤。 *Where:* Settings ▸ ComfyUI ▸ Graphs。 *Since:* 2.587.0
- **面板開關 + 佈局** — 👁 關閉某個面板及其狀態列按鈕；🗂 Layouts 可儲存 / 應用 / 匯出 / 匯入整個面板佈局及主題（layouts/<name>.json）；★ Save as the default = layouts/default.json + themes/default.json，用於全新安裝。 *Where:* Settings ▸ Dockers。 *Since:* 2.587.0
- **⚡ 即時生成（影像編輯器）** — Krita 的即時模式：每次更改後稍等片刻即重新渲染（以即時強度對整張圖片執行 Refine，並使用獨立的風格 / 步數 / 尺寸 / 🔒 種子），一次只渲染一張，以最新的更改為準，模型常駐載入，排在佇列最前，從不出現在佇列面板 / 相簿中；▣ 以混合比例顯示在畫布上；✔ Apply as layer 作為圖層應用。 *Where:* Image editor ▸ ⚡（選單列）/ View ▸ ⚡ Live Generation。 *Since:* 2.588.0
- **🎨 藝術家模式（影像編輯器）** — 只顯示畫布，全螢幕且無邊框；Alt+P 在指標處開啟調色盤（方形色域 + 色相條、色塊、最近使用），Alt+G 開啟 Layers 面板 + ⏳ Pending，Ctrl+P 開啟提示詞面板（從目前所在圖層生成），Ctrl+B 開啟畫筆（預設、大小、不透明度、流量），Ctrl+Esc（或 Ctrl+Shift+F）返回。 *Where:* Image editor ▸ 🎨 Artist mode（緊接在選單之後）/ View ▸ Artist Mode。 *Since:* 2.588.0 (2.590.0 起命名為 Artist mode)
- **🧬 RefMods 庫** — 適用於所有專案的 MiniMax H3 參考 mod，存放在 refmod/<name>/ 中：7 種類型（角色、地點、載具、物體、道具、植物、動物），上傳的媒體自動分類到 images / videos / audio，✨ 使用視覺模型自動生成描述，🧬 Extract（圖片 + 影片幀）-> 生成的 .safetensors 儲存在該資料夾中，在提示詞中寫 @name 即可使用。 *Where:* 🎓 LoRA & fine-tune trainer ▸ 🧬 RefMods。 *Since:* 2.588.0
- **SolarRenderer** — 結構影片（+ 首幀、六段式提示詞）-> 在 MiniMax H3 上以 4 步生成片段：節點包 + LoRA 作為附加元件提供，其工作流通過 ⤒ Import & check 匯入。 *Where:* Settings ▸ Add-ons ▸ SolarRenderer；Settings ▸ ComfyUI ▸ Graphs ▸ ☀ SolarRenderer。 *Since:* 2.588.0
- **帶伺服器元件的可選擴充功能** — 擴充功能（ext/<id>/）可自帶伺服器程式碼（ext.json 中的 "server"），在啟動時掛載，且僅在其執行時顯示；Settings ▸ Add-ons 可從擴充功能的 zip 安裝（📦）和移除擴充功能。Team render farm 就是這樣一個擴充功能——因可能觸發防毒軟體而未包含在安裝 zip 中。 *Where:* Settings ▸ Add-ons ▸ Team render farm。 *Since:* 2.589.0
- **影像編輯器的每個分頁都是面板** — 將分頁拖出 = 浮動；拖到另一個面板上 = 成為其分頁；拖到面板欄邊緣 = 在該處成為獨立面板；⠿ 可拖曳整個面板；佈局會被保留；Window ▸ Show All Dockers / Reset Docker Tabs。 *Where:* 影像編輯器的各面板。 *Since:* 2.590.0
- **📺 Unreal 檢視** — 所選 Unreal / MetaHuman 圖層（影像編輯器）或 Unreal 片段（時間軸，位於播放頭處）的攝影機畫面，即時來自 Unreal；S / M / L、⏸、⚡ 讓 Unreal 在 bitGen 後臺保持流暢。Unreal 必須保持執行，但無需位於前臺。 *Where:* 影像編輯器（有 Unreal 圖層時開啟）；時間軸 UNREAL ▸ View ▸ 📺 Unreal View。 *Since:* 2.590.0 (bitGen Bridge 1.5.0)
- **使用中 LoRA 的關鍵詞** — ✨ Enhance 和提示詞聊天只寫入 Basic Settings 臨時 LoRA 的關鍵詞（Override style 開啟時），或所選風格的 LoRA 的關鍵詞（關閉時）。 *Where:* Basic Settings ▸ Override style；該風格的 LoRA。 *Since:* 2.585.0

### 選取範圍

- **選框、套索與魔術棒** — Shift 新增，Alt 減去，Shift+Alt 取交集；羽化會柔化下一個選取範圍。*Where:* M、L、W
- **Select 選單** — All、Deselect、Reselect、Inverse、Color Range、Modify（Border、Smooth、Expand、Contract、Feather），以及載入圖層的透明度或遮罩。*Where:* Select 選單
- **快速遮罩** — 選取範圍以紅色顯示；繪畫即可新增，擦除即可移除。*Where:* Q
- **Segment Anything** — 點選某個物體即可選取它，按住 Shift 點選可選取更多，也可拖出一個框；一次性安裝後在本機執行。*Where:* Object Selection 工具（W）。*Since:* 2.390.0
- **選擇主體** — 一步選取畫面的主要主體：使用內建方式（無需下載）或 AI 去背（在本機執行的 BiRefNet）。*Where:* Select > Subject，Subject Settings。*Since:* 2.488.0
- **移除背景** — 將主體放入圖層遮罩，隱藏背景。*Where:* Layer > Remove Background。*Since:* 2.488.0
- **按文字查詢** — 輸入要選擇的內容（"the person's head"、"dog, car"），然後將其選取或做成遮罩。*Where:* Object Selection 選項欄，Select > Subject。*Since:* 2.390.0
- **分割圖層** — 將圖層拆分為各個組成部分，每個部分各佔一個圖層，並放在一個組中。*Where:* Layer > Segment Layer。*Since:* 2.390.0
- **選擇並遮住** — 一個專用工作區，提供 Quick Selection、Refine Edge 和 Brush 工具，多種檢視，邊緣半徑、平滑、羽化、對比度、移動邊緣、淨化顏色，並可輸出為選取範圍、遮罩或新圖層。*Where:* Select > Select and Mask（Alt+Ctrl+R）。*Since:* 2.423.0
- **磁性套索** — 沿邊緣移動時，線條會自動吸附到邊緣上。*Where:* L。*Since:* 2.423.0
- **快速選擇** — 塗抹時選取範圍會自動擴充功能到邊緣，支援 Auto-Enhance。*Where:* W。*Since:* 2.423.0
- **選擇天空** — 選取延伸到畫面頂邊的天空，沿天際線柔和過渡。*Where:* Select > Sky。*Since:* 2.423.0
- **儲存的選取範圍** — 將選取範圍存入 Alpha 通道，之後可再次載入。*Where:* Select > Save Selection，Load Selection。*Since:* 2.423.0
- **遮罩疊加** — 繪製遮罩時，被遮罩隱藏的部分顯示為紅色，也可設為始終顯示。*Where:* View > Mask Overlay。*Since:* 2.391.0

### 繪畫與修飾

- **畫筆與鉛筆** — 20 種畫筆預設（另有你自己的預設和匯入的 .abr 畫筆），數字鍵調整不透明度，筆壓控制大小和流量；另有硬邊鉛筆。*Where:* B
- **畫筆設定** — 筆尖角度、圓度和翻轉；形狀動態、散佈、紋理、雙重畫筆、顏色動態、傳遞和平滑，按預設分別儲存。*Where:* Brush 分頁。*Since:* 2.484.0
- **畫筆預設與 .abr 畫筆** — 將目前畫筆另存新檔你自己的預設（brushes/<name>.json），並匯入 .abr 畫筆檔案中的取樣畫筆。*Where:* Brush 分頁。*Since:* 2.484.0
- **仿製圖章與歷史記錄畫筆** — 從源點仿製；將圖層繪製回剛開啟時的狀態。*Where:* S 和 Y
- **橡皮擦、減淡、加深、海綿、模糊、銳化、塗抹** — 經典的修飾畫筆。*Where:* E、O 和 R
- **汙點修復** — 內容識別或近似匹配，從汙點周圍取樣填充。*Where:* J。*Since:* 2.423.0
- **修復畫筆** — 複製的內容會自動採用落點處的顏色和光照。*Where:* J。*Since:* 2.423.0
- **修補** — 將選取範圍拖到乾淨的紋理上；Normal 模式提供 Transparent 和 Diffusion，Content-Aware 模式提供 Structure 和 Color。*Where:* J。*Since:* 2.423.0
- **內容識別移動** — 移動或複製某個物體，其原位置會被自動填充，可設定 Structure 和 Color。*Where:* J。*Since:* 2.423.0
- **紅眼** — 點選紅色瞳孔即可。*Where:* J。*Since:* 2.423.0
- **內容識別填充** — 用畫面其餘部分填充選取範圍，不使用 AI。*Where:* Edit > Content-Aware Fill，Edit > Fill。*Since:* 2.423.0
- **內容識別填充工作區** — 選擇取樣區域（自動、矩形或手繪），檢視即時預覽，設定顏色適應和輸出圖層。*Where:* Edit > Content-Aware Fill。*Since:* 2.448.0
- **混合器畫筆** — 塗抹時顏料會沾取畫布上的顏色。*Where:* B。*Since:* 2.423.0
- **背景橡皮擦與魔術橡皮擦** — 擦除與畫筆下顏色相近的部分，或擦除整片同色區域。*Where:* E。*Since:* 2.423.0
- **漸層工具** — 線性、徑向、角度、對稱或菱形漸層。*Where:* G
- **油漆桶** — 用前景色、背景色或漸層填充，可設定容差、連續和所有圖層。*Where:* G，Shift+G。*Since:* 2.396.0
- **裁切** — 拖出一個框，選擇比例，按 Enter 裁切。*Where:* C

### 變換與變形

- **自由變換** — 移動、縮放、旋轉，或直接輸入 X、Y、W、H 和角度。*Where:* Ctrl+T
- **斜切、扭曲、透視與變形** — 角點沿邊移動、任意移動、鏡像移動，或使用帶預設和彎曲度的變形網格。*Where:* Edit > Transform。*Since:* 2.422.0
- **變形網格與拆分線** — 從 3 x 3 到自訂網格；可交叉、垂直或水平拆分變形，以獲得更多控制點。*Where:* Edit > Transform > Warp。*Since:* 2.450.0
- **操控變形** — 放置圖釘並拖曳，自然地彎曲圖層。*Where:* Edit > Puppet Warp。*Since:* 2.422.0
- **圖釘深度與旋轉** — 決定摺疊處哪一部分位於上層；圖釘的旋轉可固定，也可保持自由。*Where:* Puppet Warp 選項欄。*Since:* 2.465.0
- **內容識別縮放** — 變窄或變寬時，人臉、物體和邊緣保持原有形狀；可保護選取範圍。*Where:* Edit > Content-Aware Scale（Alt+Shift+Ctrl+C）。*Since:* 2.422.0
- **液化** — 向前變形、重建、旋轉扭曲、褶皺、膨脹，以及凍結遮罩和解凍遮罩。*Where:* Filter > Liquify（Shift+Ctrl+X）。*Since:* 2.422.0
- **液化附加功能** — Smooth、Push Left，以及針對眼睛、鼻子、嘴巴和臉型的人臉識別滑塊。*Where:* Filter > Liquify。*Since:* 2.450.0
- **移動工具控制柄** — 點選顯示縮放控制柄，雙擊顯示旋轉和斜切控制柄；文字保持可編輯，形狀保持為向量。*Where:* V。*Since:* 2.452.0
- **變換選項** — 角度、旋轉 90 度、翻轉，以及以中心為基準的 W x H 百分比。*Where:* Move 工具的選項欄。*Since:* 2.452.0

### 智慧物件與智慧濾鏡

- **智慧物件** — 將圖層或組放入其中並保持可編輯；縮放、旋轉和變形都不會損失畫質。*Where:* Layer > Smart Objects。*Since:* 2.422.0
- **編輯內容** — 開啟內部內容，任意修改，所有副本都會隨之更新。*Where:* 雙擊縮圖。*Since:* 2.422.0
- **替換、匯出、轉換、柵格化** — 從檔案替換內容、匯出內容、將其轉換回圖層或普通像素；New Smart Object via Copy 可建立一個獨立的智慧物件。*Where:* Layer > Smart Objects。*Since:* 2.422.0
- **智慧濾鏡** — 對智慧物件應用的任何濾鏡或調整都會作為可重新編輯的濾鏡新增：開 / 關、設定、不透明度、順序。*Where:* 圖層下方的各行。*Since:* 2.422.0
- **濾鏡遮罩** — 通過繪製決定智慧濾鏡在哪些區域生效。*Where:* Smart Filters 行。*Since:* 2.422.0
- **智慧濾鏡混合模式** — 每個智慧濾鏡都有 24 種混合模式和單獨的不透明度。*Where:* 右鍵點選智慧濾鏡。*Since:* 2.434.0
- **連結的智慧物件** — 內容存放在專案連結資料夾中的一個檔案裡；修改該檔案，圖層隨之更新。*Where:* File > Place Linked。*Since:* 2.469.0
- **轉換、嵌入與重新連結** — 將嵌入的智慧物件轉換為連結物件，嵌入連結的智慧物件，或將其重新連結到另一個檔案；缺失的檔案會被標記出來。*Where:* Layer > Smart Objects。*Since:* 2.469.0

### 調整、濾鏡與圖層樣式

- **影像調整** — 全部 24 種調整直接應用於像素，另有 Auto Tone、Auto Contrast 和 Auto Color。*Where:* Image > Adjustments
- **陰影 / 高光與 HDR 色調** — 區域性色調：按數量、色調和半徑提亮陰影、保留高光；HDR 效果，可調邊緣光、灰度係數、曝光和細節。*Where:* Image > Adjustments。*Since:* 2.480.0
- **可選顏色** — 在九個顏色範圍內增減青色、洋紅、黃色和黑色，可選相對或絕對方式；也可作為調整圖層使用。*Where:* Image > Adjustments，Layer > New Adjustment Layer。*Since:* 2.480.0
- **替換顏色與匹配顏色** — 在畫面上拾取一種顏色並調整其色相、飽和度和明度；讓一個圖層採用另一個圖層、合併畫面或某個檔案的顏色。*Where:* Image > Adjustments。*Since:* 2.480.0
- **顏色查詢** — 3D LUT：來自共享 LUT 庫的時間軸調色效果和 .cube 檔案，按數量混合；也可作為調整圖層使用。*Where:* Image > Adjustments。*Since:* 2.480.0
- **應用影像** — 將另一個圖層、合併畫面或其中某個通道以 11 種模式混合到圖層上，可設定不透明度和反相。*Where:* Image > Apply Image。*Since:* 2.480.0
- **影像大小與畫布** — Image Size、帶錨點的 Canvas Size、旋轉、裁切到選取範圍以及裁切。*Where:* Image 選單
- **濾鏡** — 模糊、扭曲、雜色、像素化、渲染、銳化和風格化濾鏡，均可即時預覽；Ctrl+F 重複上一個濾鏡。*Where:* Filter 選單
- **鏡頭光暈、旋渦、投影、3D 擠出** — 點選畫面即可放置光暈或旋渦的中心。*Where:* Filter 選單。*Since:* 2.397.0
- **模糊組與模糊畫廊** — Surface、Smart 和 Lens Blur（深度、光圈葉片、散景高光）、Average；Field、Iris、Path 和 Spin Blur，點選即可放置中心。*Where:* Filter > Blur，Filter > Blur Gallery。*Since:* 2.481.0
- **雜色與智慧銳化** — Reduce Noise、Dust & Scratches、Despeckle；Smart Sharpen 可去除高斯模糊、鏡頭模糊或動感模糊，並可在陰影和高光中漸隱。*Where:* Filter > Noise，Filter > Sharpen。*Since:* 2.481.0
- **其他濾鏡** — High Pass、Minimum、Maximum、Offset、5 x 5 的 Custom 卷積核以及 HSB / HSL。*Where:* Filter > Other。*Since:* 2.481.0
- **扭曲組與像素化組** — Displace（以圖層作為置換圖）、Polar Coordinates、Pinch、ZigZag、Shear、Glass；Color Halftone、Crystallize、Pointillize、Facet、Fragment、Mezzotint。*Where:* Filter > Distort，Filter > Pixelate。*Since:* 2.481.0
- **光照效果與渲染組** — 聚光燈、點光源和無限光，可使用高度紋理；Fibers 和 Difference Clouds；Diffuse、Tiles 和 Trace Contour。*Where:* Filter > Render，Filter > Stylize。*Since:* 2.481.0
- **藝術效果、素描與紋理** — Cutout、Poster Edges、Watercolor、Dry Brush、Graphic Pen、Charcoal、Grain 和 Craquelure。*Where:* Filter > Artistic，Sketch，Texture。*Since:* 2.481.0
- **沖印濾鏡** — 照片沖印工具：白平衡、曝光、色調、紋理、清晰度、去朦朧、自然飽和度、色調曲線、八色混合器、黑白、顏色分級、銳化與降噪、光學、幾何、顆粒和暗角，提供預設並可儲存你自己的預設。*Where:* Filter > Develop Filter（Alt+Shift+Ctrl+A）。*Since:* 2.482.0
- **鏡頭校正** — 去除桶形或枕形畸變、色邊和暗角；藉助網格校正透視、角度和縮放；填充邊緣。*Where:* Filter > Lens Correction（Alt+Shift+Ctrl+R）。*Since:* 2.482.0
- **導航器、直方圖、資訊與註釋面板** — 小畫面上的檢視框；帶統計資料的通道直方圖；指標下的 RGB、HSB 和 CMYK 值及顏色取樣器；列出所有註釋。*Where:* Color 面板組，Window 選單。*Since:* 2.483.0
- **顏色取樣器、標尺、註釋與計數工具** — 最多十個取樣器，可拉直圖層或畫面的標尺，固定在畫面上的註釋，以及編號的計陣列。*Where:* Eyedropper 的工具組（I）。*Since:* 2.483.0
- **透視裁切** — 將四個角對準本應方正的物體；按 Enter 裁切並將整個畫面校正方正。*Where:* Crop 工具組（C）。*Since:* 2.483.0
- **擴大選取、選取相似、焦點區域、變換選取範圍、修邊** — 按顏色擴大或擴充功能選取範圍，選擇清晰的部分，移動 / 縮放 / 旋轉選取範圍；去邊並移除黑色或白色雜邊。*Where:* Select 和 Layer 選單。*Since:* 2.483.0
- **快速調整與濾鏡選單** — 作用於目前圖層；有選取範圍時僅作用於選取範圍內部。*Where:* 影像編輯器
- **圖層樣式** — 投影、內陰影、外發光和內發光、描邊、顏色疊加、漸層疊加和圖案疊加、斜面和浮雕、光澤；可複製和貼上樣式。*Where:* fx，或雙擊縮圖
- **樣式預設** — 一鍵應用 Gold、Chrome、Neon、Embossed、Glass、3D Pop、Retro、Fire、Ice 和 Letterpress。*Where:* Layer Style 對話方塊。*Since:* 2.397.0

### 文字

- **橫排文字、直排文字與路徑文字** — 字母沿繪製的線條排列；可移動起點或翻轉到另一側。*Where:* T，Shift+T。*Since:* 2.397.0
- **全部大寫、下劃線、刪除線、豎排** — Type 選項欄中的按鈕。*Where:* Type 選項欄。*Since:* 2.397.0
- **文字形狀與 3D** — 十一種變形、環繞圓形、沿路徑排列或擠出的 3D 字母，均保持可編輯。*Where:* Layer > Text Shape。*Since:* 2.397.0
- **字元面板** — 字型、字形、大小、行距、字距微調、字距調整、縮放、基線偏移、仿粗體和仿斜體、小型大寫字母、上標和下標。*Where:* Window > Character。*Since:* 2.426.0
- **段落面板** — 對齊、兩端對齊、縮排、段前和段後間距、連字。*Where:* Window > Paragraph。*Since:* 2.426.0
- **段落文字** — 用 Type 工具拖出一個框，文字會在框內自動換行；可在點文字和段落文字之間轉換。*Where:* T。*Since:* 2.426.0
- **字元樣式與段落樣式** — 新建、應用、清除覆蓋以及重新定義樣式。*Where:* Character 和 Paragraph 面板。*Since:* 2.426.0
- **按字元設定** — 輸入時選取部分字母，僅更改它們的字型、大小、顏色或任意 Character 設定。*Where:* Type 工具。*Since:* 2.449.0
- **OpenType 功能** — 連字、替代字、花飾字、序數、分數、數字樣式、小型大寫字母和樣式集，均來自字型本身的檔案。*Where:* Character 面板。*Since:* 2.466.0
- **視覺字距** — 根據字母的形狀確定間距。*Where:* Character 面板。*Since:* 2.466.0
- **文字轉輪廓** — 將文字轉換為由其輪廓構成的形狀圖層，或由其建立工作路徑。*Where:* Layer > Type。*Since:* 2.466.0
- **形狀內文字** — 用 Type 工具在形狀內部點選，文字會在其輪廓內排列。*Where:* Type 工具。*Since:* 2.466.0
- **文字效果預設** — 與時間軸相同的分層 3D 文字預設，即時繪製。*Where:* Type 選項欄，文字圖層的 Properties。*Since:* 2.411.0
- **預設適用於所有形狀** — 變形、環繞圓形、沿路徑、豎排和 3D 都會保留文字的預設（3D 側面使用其顏色並加深）。*Where:* ⌒ Shape / 3D… *Since:* 2.607.0
- **用文字填充形狀** — 讓文字在形狀內排列（Fit 自動調整大小），拉伸文字以填滿輪廓，或作為形狀的填充按行重複。*Where:* 右鍵點選形狀，Shape 工具列，Layer ▸ 🅰 Fill Shape with Text…。*Since:* 2.608.0
- **16 種變形預設** — 在 Arc … Squeeze 之外新增 Shell Lower、Shell Upper、Fisheye、Twist 和 Wedge。*Where:* ⌒ Shape / 3D…，Edit ▸ Transform ▸ Warp。*Since:* 2.608.0
- **文字和形狀上的變形網格** — 拖曳網格上的點（預設、3 x 3 … 5 x 5、拆分線）；文字仍可輸入，形狀仍可編輯，變形隨之更新。*Where:* Type / Shape 工具列中的 ⌗ Warp Grid，右鍵點選。*Since:* 2.608.0

### 鋼筆、路徑與向量遮罩

- **鋼筆** — 角點和平滑錨點、閉合、尖角、45 度步進、自動新增和刪除。*Where:* P。*Since:* 2.421.0
- **自由鋼筆與錨點工具** — 手繪並擬合曲線；新增、刪除和轉換錨點。*Where:* Shift+P。*Since:* 2.421.0
- **彎度鋼筆與橡皮帶** — 曲線平滑地穿過你點選的各點；預覽下一段。*Where:* P。*Since:* 2.425.0
- **路徑選擇** — 移動、複製、組合和變換整個元件；對齊和分佈元件。*Where:* A。*Since:* 2.421.0
- **直接選擇** — 錨點和控制柄，微移，角點或平滑。*Where:* A。*Since:* 2.421.0
- **形狀或路徑模式** — 繪製形狀圖層或工作路徑；合併、減去、交叉或排除。*Where:* 選項欄。*Since:* 2.421.0
- **自定形狀工具** — 心形、星形、爆炸形、箭頭、對話氣泡、雲朵等，另有你自己的形狀。*Where:* U，Edit > Define Custom Shape。*Since:* 2.421.0
- **路徑面板** — 工作路徑、儲存的路徑、形狀路徑和向量遮罩；填充、描邊、建立選取範圍或遮罩。*Where:* Paths 分頁。*Since:* 2.421.0
- **向量遮罩** — 顯示全部、隱藏全部、目前路徑；濃度、羽化、反相、連結和柵格化。*Where:* Layer > Vector Mask。*Since:* 2.421.0
- **路徑跟隨畫面** — 裁切、畫布大小、影像大小和旋轉也會同時移動路徑。*Where:* 影像編輯器。*Since:* 2.421.0
- **任意路徑圓角** — 將路徑、合併形狀或向量遮罩中選取的角變為圓角。*Where:* Direct Selection，Radius 框。*Since:* 2.466.0

### 向量線條與繪圖工具

- **貝塞爾工具** — 尖角和平滑節點、15 度步進、閉合，或繼續延長開放線條。*Where:* F5。*Since:* 2.425.0
- **手繪、2 點線、折線、3 點曲線、B 樣條、節點鋼筆** — 其他曲線工具。*Where:* 再按一次 F5。*Since:* 2.425.0
- **箭頭與線條樣式** — 實線、虛線、點線、點劃線和自訂線條，帶起點和終點箭頭（箭頭、三角形、圓形、方形、菱形、橫條等）。*Where:* 曲線工具的屬性欄。*Since:* 2.425.0
- **形狀工具（節點）** — 選取並拖曳節點、控制柄和線段；新增、刪除、連線、斷開、反轉、閉合和精簡節點。*Where:* F10。*Since:* 2.425.0
- **輪廓筆** — 顏色、寬度、虛線、角、線端、位置、箭頭、置於填充之後、隨物件縮放。*Where:* F12。*Since:* 2.425.0
- **轉換為曲線** — 矩形、橢圓、多邊形或線條變為可編輯的向量線條。*Where:* Ctrl+Q。*Since:* 2.425.0
- **向量線條與路徑** — 線條可轉換為記住其輪廓的路徑，也可再轉換回來。*Where:* Layer > Vector Line。*Since:* 2.425.0
- **形狀工具** — 可將每個角分別設為圓角、扇形角或倒角的矩形、3 點矩形、帶餅形和弧形的橢圓、3 點橢圓、多邊形、星形、複雜星形、螺旋、網格紙和常見形狀，均為即時可調形狀。*Where:* F6。*Since:* 2.428.0
- **以繪製模式併入形狀** — 將新形狀以新建、新增、減去、交叉或排除的方式併入所選形狀。*Where:* 形狀工具列。*Since:* 2.439.0
- **藝術筆** — 預設、書法、壓力和噴塗筆觸，繪製後成為填充形狀。*Where:* F5。*Since:* 2.428.0
- **聯結器** — 直線、直角或圓角線條，會跟隨其連線的物件移動。*Where:* F8。*Since:* 2.428.0
- **標註** — 帶文字的 3 點標註。*Where:* F8。*Since:* 2.428.0
- **自動填充** — 閉合曲線或新形狀會以最後選取的顏色填充。*Where:* 曲線工具列。*Since:* 2.430.0
- **懸停與選取高亮** — 使用 Move 工具時，指標下的物件以藍色勾勒，選取的物件以橙色勾勒；在空白畫布上點選則不選取任何物件。*Where:* Move 工具。*Since:* 2.470.0
- **繪製後切換到移動工具** — 繪製形狀後會自動選用 Move 工具並選取新形狀（可關閉）。*Where:* CAD 工具列的設定。*Since:* 2.470.0

### 向量工作面板

- **變換面板** — 圍繞九個錨點進行位置、旋轉、縮放和鏡像、大小和斜切操作，可生成副本。*Where:* Window > Dockers（Alt+F7）。*Since:* 2.429.0
- **造形面板** — 焊接、修剪、相交、簡化、前減後、後減前、邊界。*Where:* Window > Dockers。*Since:* 2.429.0
- **對齊與分佈** — 對齊到活動物件、選取範圍、頁面邊緣或頁面中心。*Where:* Shift+Ctrl+A。*Since:* 2.429.0
- **物件屬性** — 向量形狀的填充（均勻或漸層）、輪廓和透明度。*Where:* Alt+Enter。*Since:* 2.429.0

### 框架與畫板

- **框架** — 將圖層放入閉合形狀內；圖層只在形狀內顯示，並隨形狀移動、旋轉和縮放。*Where:* Layer > Frame > Place Inside Frame。*Since:* 2.442.0
- **編輯與提取框架內容** — 單獨編輯內容、完成編輯或將內容取出。*Where:* 雙擊或右鍵點選框架。*Since:* 2.442.0
- **鎖定框架內容** — Move 工具會選取框架，其控制柄會連同內容一起變換。*Where:* Lock Contents to Frame。*Since:* 2.453.0
- **畫板** — 在一個畫面中包含多個各有尺寸的頁面，尺寸可來自預設或自行設定。*Where:* Layer > New > Artboard。*Since:* 2.447.0
- **畫板工具與從組建立** — 拖出新畫板，或將組轉換為畫板。*Where:* 再按一次 V，Layer > New > Artboard from Group。*Since:* 2.447.0
- **匯出畫板** — 將每個畫板匯出為單獨的 PNG。*Where:* File > Export > Artboards to Files。*Since:* 2.447.0

### 尺寸標註

- **尺寸標註工具** — 平行、水平 / 垂直和角度標註，按指定 dpi 換算單位。*Where:* F8。*Since:* 2.428.0
- **精確點** — 標註會吸附到節點、邊的中點、角點、輪廓和輔助線交點，懸停時顯示點的名稱。*Where:* 尺寸標註工具。*Since:* 2.441.0
- **即時端點** — 拖曳標註的端點，其數值隨之更新。*Where:* 對標註使用 Move 工具。*Since:* 2.441.0
- **每個畫面一個比例** — 輸入某個標註的實際尺寸和單位，所有標註都按該比例測量。*Where:* 屬性欄。*Since:* 2.441.0
- **標註組** — 每個標註都是由尺寸界線和尺寸線組成的組，根據其測量值重新繪製。*Where:* Layers 面板。*Since:* 2.457.0
- **自動標註** — 標註所選物件的整體寬度和高度。*Where:* Layer > Auto Dimension。*Since:* 2.458.0
- **平面圖標註** — 在閉合形狀外側標註每一面牆，另加整體尺寸。*Where:* Layer > Floorplan Dimensions。*Since:* 2.458.0
- **連續標註工具** — 沿一條線標註每兩個相鄰點之間的距離，另加總長。*Where:* F8。*Since:* 2.458.0

### 標尺、輔助線與吸附

- **帶單位的標尺** — 像素、毫米、釐米、英寸或點。*Where:* View > Rulers（Ctrl+R）。*Since:* 2.440.0
- **輔助線** — 從標尺中拖出、移動、鎖定、輸入位置、列出和清除。*Where:* View > Guidelines。*Since:* 2.440.0
- **吸附** — 吸附到網格、輔助線、物件、節點、中點、交點和頁面；Move 工具會吸附圖層的邊界框。*Where:* View > Snap To。*Since:* 2.440.0
- **網格按鈕與設定** — 間距、主網格線、線條或點、顏色和吸附距離。*Where:* 頂部欄，以及 Grids and Guides 設定。*Since:* 2.445.0

### 通道

- **通道面板** — 單獨檢視 RGB、Red、Green 或 Blue，或將通道的亮度載入為選取範圍。*Where:* Channels 分頁。*Since:* 2.423.0
- **Alpha 通道** — 可檢視、載入、重新命名和繪製的儲存選取範圍。*Where:* Channels 分頁。*Since:* 2.423.0
- **編輯單個顏色通道** — 繪畫、填充、濾鏡和調整隻改變所選的通道。*Where:* Channels 面板（Ctrl+3 到 Ctrl+5）。*Since:* 2.467.0
- **專色通道** — 疊加在畫面上顯示的油墨顏色和密度，需要時可合併到圖層中。*Where:* Channels 面板，Select > New Spot Channel。*Since:* 2.467.0

### 顏色、漸層與圖案

- **顏色色塊** — 預設顏色、互換（會重新繪製純色背景）、帶輪廓的大色塊。*Where:* D 和 X。*Since:* 2.396.0
- **調色盤** — 一條顏色條：點選設定填充色，右鍵點選設定形狀或文字的輪廓色；在像素圖層上則分別設定前景色和背景色。*Where:* 編輯器右邊緣。*Since:* 2.430.0
- **透明色塊** — 設為前景色時，畫筆會繪製出透明。*Where:* 調色盤和 Swatches 面板。*Since:* 2.430.0
- **漸層編輯器** — 預設及你自己的漸層，色標可設定顏色、不透明度和位置；供漸層工具、油漆桶、填充圖層和形狀使用。*Where:* Edit > Gradient Editor。*Since:* 2.434.0
- **圖案庫** — 從畫面定義圖案、圖案填充圖層、用圖案填充，並可在 Pattern Overlay 中使用你的圖案。*Where:* Edit > Define Pattern，Pattern Library。*Since:* 2.437.0

### 動作與自動化

- **動作** — 錄製選單命令、對話方塊、濾鏡和 Layers 面板中的更改，然後播放；動作可分組，並帶有一個預設組。*Where:* Actions 分頁（Alt+F9）。*Since:* 2.427.0
- **編輯動作** — 步驟開 / 關、在對話方塊處停止、插入停止和選單專案、功能鍵、按鈕模式、載入和儲存。*Where:* Actions 分頁。*Since:* 2.427.0
- **批處理** — 對多張圖片或一個資料夾播放動作，結果儲存到專案、相簿或下載資料夾。*Where:* File > Automate > Batch。*Since:* 2.427.0
- **錄製畫筆筆觸和手繪選取範圍** — 在相同位置回放，並按畫面大小縮放。*Where:* Actions 分頁。*Since:* 2.468.0
- **條件步驟** — 如果文件為橫向、縱向或方形，有選取範圍，或含某類圖層，則播放一個動作，否則播放另一個。*Where:* Actions > Insert Conditional。*Since:* 2.468.0
- **影像處理器** — 將圖片儲存為 JPEG 和 / 或 PNG，可調整大小，也可先執行一個動作。*Where:* File > Scripts > Image Processor。*Since:* 2.468.0
- **快捷批處理** — 一個圖塊，將圖片拖放到上面即可對每張圖片執行動作。*Where:* File > Automate > Create Droplet。*Since:* 2.468.0
- **.atn 動作檔案** — 從 .atn 檔案載入動作組；能匹配的步驟會照常播放，其餘步驟載入後處於關閉狀態。*Where:* Actions > Load Actions。*Since:* 2.469.0

### 檔案

- **新建、開啟與儲存到 Images** — 以背景色新建畫面；將可見畫面儲存到專案的 Images 中。*Where:* File（Ctrl+N、Ctrl+O、Ctrl+S）
- **匯出為** — PNG、JPEG、WebP、JPEG XL、AVIF、GIF、TIFF、BMP 或 TGA，可設定品質和縮放，帶預覽並顯示檔案大小。*Where:* File > Export As
- **檔案資訊** — 標題、作者、描述、關鍵詞、版權和 URL，隨文件儲存，並寫入匯出的 PNG 和 JPEG 檔案。*Where:* File > File Info（Alt+Shift+Ctrl+I）。*Since:* 2.485.0
- **列印** — 適合頁面、指定尺寸或百分比，縱向或橫向，然後開啟系統的列印對話方塊。*Where:* File > Print（自 2.645.0 起為 Ctrl+Shift+P - Ctrl+P 會將提示詞面板置於最前）。*Since:* 2.485.0
- **聯絡表** — 將來自檔案或已開啟文件的圖片以網格排列在一個新文件中，每張圖片一個圖層，並帶標題。*Where:* File > Automate > Contact Sheet。*Since:* 2.485.0
- **裁切並拉直照片** — 找出掃描件上的每張照片，將其拉直，並作為單獨的文件開啟。*Where:* File > Automate > Crop and Straighten Photos。*Since:* 2.485.0
- **自動對齊圖層** — 以其中一個圖層為基準對齊所選圖層：透視、移動 / 旋轉 / 縮放，或僅移動。*Where:* Edit > Auto-Align Layers。*Since:* 2.486.0
- **自動混合圖層** — 用遮罩將圖層混合成全景圖（柔和接縫、匹配色調）或景深堆疊（每處取最清晰的圖層）。*Where:* Edit > Auto-Blend Layers。*Since:* 2.486.0
- **照片合併** — 將相互重疊的圖片（檔案或已開啟的文件）拼接成一個全景文件，每張圖片一個帶遮罩的圖層。*Where:* File > Automate > Photomerge。*Since:* 2.486.0
- **合併到 HDR** — 先對齊包圍曝光的照片，再將其融合為一張曝光良好的圖片。*Where:* File > Automate > Merge to HDR。*Since:* 2.486.0
- **影像模式** — Bitmap、Grayscale、Duotone（1-4 種油墨）、Indexed Color（調色盤、仿色、可使用 .act 檔案的 Color Table）、RGB 和 CMYK（印刷模型：紙張、黑版生成、總油墨量）。*Where:* Image > Mode。*Since:* 2.487.0
- **校樣顏色與色域警告** — 檢視畫面印刷後的效果，以及哪些顏色無法印刷；僅在螢幕上顯示。*Where:* View > Proof Setup，Proof Colors（Alt+Ctrl+Y），Gamut Warning（Shift+Ctrl+Y）。*Since:* 2.487.0
- **CMYK TIFF** — 匯出四色印刷油墨，交給印刷廠。*Where:* File > Export As > TIFF (CMYK, for print)。*Since:* 2.487.0
- **JPEG XL 檔案** — 開啟、置入和拖放 .jxl 圖片；以指定品質或無損方式匯出 JPEG XL；.jxl 圖片在應用中處處都能顯示，傳送給 ComfyUI 和合成時會轉為 PNG。*Where:* File > Open，Export As > JPEG XL，Assets 面板。*Since:* 2.479.0
- **複製與貼上** — 複製、剪下、貼上、原位貼上、合併複製，以及系統剪貼簿中的圖片。*Where:* Edit 選單
- **PSD 檔案** — 圖層、組、遮罩、不透明度、混合模式、可見性、圖層樣式、向量遮罩和形狀在匯入和匯出時均可保留。*Where:* File > Open PSD，Save as PSD。*Since:* 2.390.0
- **保留 PSD 智慧物件** — 嵌入的智慧物件會作為智慧物件開啟，並以置入圖層的形式存回。*Where:* PSD 檔案。*Since:* 2.469.0
- **SVG 路徑與形狀** — 將路徑匯出為 SVG，將 SVG 置入為形狀圖層。*Where:* File > Export Path as SVG，Place SVG as Shape Layer。*Since:* 2.421.0
- **PDF 檔案** — 頁面開啟後為不含文字的頁面影像，外加每行文字一個文字圖層；可使用所有工具編輯。*Where:* File > Open PDF。*Since:* 2.424.0
- **PDF 頁面** — 新增空白頁或另一個 PDF 的頁面，移動頁面（用按鈕或拖曳）以及刪除頁面；按新順序儲存，未改動的頁面保持原樣。*Where:* PDF Pages 頁面條，File > Add / Remove PDF Pages。*Since:* 2.488.0
- **儲存 PDF** — 修改過的頁面以真實、可搜尋的文字存回；未修改的頁面保持為向量。*Where:* File > Save PDF，Save as New。*Since:* 2.424.0
- **在 PDF 中嵌入字型** — 每行文字都以其本身的字型寫入（字型來自本機或字型資料夾），因此任何文字體系都保持為真實文字。*Where:* Save PDF 對話方塊。*Since:* 2.435.0
- **.bgi 專案檔案** — 圖層、遮罩、即時文字、形狀、填充、調整、樣式、帶濾鏡的智慧物件、路徑、通道、選取範圍和圖層複合均以完全可編輯的形式儲存在一個 zip 中，任何解壓工具都能開啟。*Where:* File > Save Project（Alt+Ctrl+S）。*Since:* 2.436.0

### 影像編輯器中的 AI

- **AI 面板** — 模型會看到選取範圍及一圈上下文邊距，並在羽化的選取範圍內以新圖層的形式給出結果。*Where:* AI 面板
- **生成** — 根據提示詞面板中的提示詞渲染到所選圖層的選取範圍中；Apply 將結果融合進畫面。*Where:* AI 面板的 Generate 分頁。*Since:* 2.444.0
- **編輯** — 使用 Qwen Image 2.1 edit 執行在提示詞面板中輸入的指令。*Where:* AI 面板的 Edit 分頁。*Since:* 2.444.0
- **重繪、移除與背景** — 按指定強度重新處理，移除所選內容，或重新生成其餘所有內容。*Where:* AI 面板
- **擴充功能** — 擴大畫布，並將畫面延續到新區域中。*Where:* AI 面板
- **結果** — 生成 1 到 4 個版本，進行比較，然後應用或放棄。*Where:* AI 面板
- **控制圖層** — 塗鴉、線稿、軟邊緣、Canny、深度、法線、姿勢或分割圖層通過 ControlNet 引導 AI。*Where:* Control 面板
- **合成** — 將圖層作為參考圖：把一個圖層中的物體放進另一個圖層的場景中。*Where:* AI 面板。*Since:* 2.390.0
- **傳送到參考圖** — 所選圖層會進入參考圖面板，可用於任何渲染。*Where:* Layer > Send to References。*Since:* 2.390.0
- **保留參考圖** — 參考圖面板一有變化就寫入專案（關閉應用後仍會保留），其中所有圖片都會儲存，F/L、Swap 或 Text 模式也不再丟失圖片。*Where:* 參考圖面板。*Since:* 2.548.0
- **輸入時即儲存共享提示詞** — StoryBoard 的共享提示詞會在輸入後片刻、離開輸入框時以及關閉時儲存。*Where:* StoryBoard > Scenes。*Since:* 2.548.0
- **在形狀或遮罩中生成填充** — 在形狀的輪廓或圖層的遮罩內生成，並裁切到其範圍內。*Where:* Layer 選單。*Since:* 2.437.0
- **生成到形狀中** — 當閉合形狀處於活動狀態時，結果會作為框架放入其中。*Where:* AI 面板。*Since:* 2.442.0
- **提示詞面板跟隨分頁** — Edit 分頁會將提示詞面板切換為影像編輯，Generate 分頁則切換為生成到選取範圍中。*Where:* AI 面板。*Since:* 2.451.0
- **從 3D 圖層生成** — 根據你目前看到的 3D 檢視生成一張新影像。*Where:* 3D 分頁。*Since:* 2.460.0

## CAD 與 3D

帶約束的精確繪圖、測量、CAD 檔案，以及由草圖生成的參數化 3D 實體。

### 草圖圖層

- **草圖圖層** — 由直線、矩形、圓和圓弧組成的 CAD 草圖，靠約束和尺寸保持形狀，帶有固定原點和兩條構造軸。 *Where:* Layer > New Sketch，或任意草圖工具。 *Since:* 2.462.0
- **草圖工具** — Sketch Select、Line、2-Point 與 Center Rectangle、Circle、3-Point Arc、Point 和 Sketch Dimension，各有自己的字母鍵。 *Where:* 工具列中的 N。 *Since:* 2.462.0
- **連續線段** — 逐點點選；接近水平或豎直的線會自動吸附並獲得 Horizontal 或 Vertical 約束；端點相遇處自動連線。 *Where:* Line 工具。 *Since:* 2.462.0
- **構造幾何** — 將所選物件轉為虛線構造線，它們永遠不會繪製到圖片中。 *Where:* X。 *Since:* 2.462.0
- **草圖選擇** — 在約束保持不變的同時選取並拖曳點、線和圓的邊。 *Where:* 使用草圖工具時按 S。 *Since:* 2.462.0
- **繪製草圖時的顏色** — 藍色表示仍可自由移動，黑色表示已完全約束，橙色虛線為構造線，灰色數字為從動尺寸。 *Where:* 草圖中。 *Since:* 2.462.0
- **輪廓轉形狀** — 每個封閉區域都會成為草圖上方的一個形狀圖層。 *Where:* Profiles > Shapes。 *Since:* 2.462.0
- **填充輪廓** — 以你選擇的線條顏色和線寬填充封閉區域。 *Where:* Sketch 分頁。 *Since:* 2.462.0
- **完成草圖** — 返回 Move 工具。 *Where:* Sketch 分頁。 *Since:* 2.462.0
- **儲存在 .bgi 中** — .bgi 檔案會保留所有約束；移動或縮放圖層時，其草圖隨之移動。 *Where:* .bgi 檔案。 *Since:* 2.462.0

### 約束與尺寸

- **約束** — Coincident、Collinear、Concentric、Midpoint、Fix、Parallel、Perpendicular、Horizontal、Vertical、Tangent、Equal 和 Symmetric。 *Where:* Sketch 分頁。 *Since:* 2.462.0
- **自由度** — 顯示還剩多少自由度，完全約束時顯示對勾。 *Where:* Sketch 分頁。 *Since:* 2.462.0
- **拒絕過約束** — 已由其他約束確定的約束會被拒絕，尺寸則改為從動尺寸。 *Where:* 草圖中。 *Since:* 2.462.0
- **草圖尺寸** — 直線的長度、兩點間的距離、兩條線的夾角、圓的直徑或圓弧的半徑；直接輸入數值，支援算式。 *Where:* D。 *Since:* 2.462.0
- **繪製時輸入尺寸** — 繪製過程中輸入長度和角度、寬度和高度、直徑或半徑；這些數值會作為尺寸保留下來。 *Where:* 任意草圖工具。 *Since:* 2.464.0

### 更多草圖工具

- **多邊形** — 指定中心、一個角點和邊數，多邊形保持在一個構造圓上。 *Where:* N 工具組。 *Since:* 2.463.0
- **槽** — 兩個半圓由相切的直線連線。 *Where:* N 工具組。 *Since:* 2.463.0
- **兩點圓與三點圓** — 由直徑或三個點確定一個圓。 *Where:* N 工具組。 *Since:* 2.463.0
- **樣條曲線** — 一條平滑穿過你點選的每個點的曲線。 *Where:* N 工具組。 *Since:* 2.463.0
- **修剪** — 剪掉直線、圓或圓弧在最近兩個交點之間的部分。 *Where:* T。 *Since:* 2.463.0
- **延伸** — 將直線延長到下一條直線或圓。 *Where:* E。 *Since:* 2.463.0
- **圓角與倒角** — 在拐角處生成相切圓弧或直線切角，其數值作為尺寸保留。 *Where:* F。 *Since:* 2.463.0
- **偏移** — 按一定距離生成保持平行或同心的副本。 *Where:* Sketch 分頁 > Modify。 *Since:* 2.463.0
- **偏移工具** — 點選一條鏈，再由指標決定偏移的方向和距離（也可直接輸入）；無論按什麼方向繪製的線都會一起向外或向內偏移，圓角拐角保持相連。 *Where:* Sketch 分頁 > Modify > Offset (O)。 *Since:* 2.494.0
- **鏡像** — 關於一條直線保持對稱的鏡像副本。 *Where:* Sketch 分頁 > Modify。 *Since:* 2.463.0
- **矩形陣列與圓形陣列** — 按行列或繞一點排列的副本，帶有相同的約束。 *Where:* Sketch 分頁 > Modify。 *Since:* 2.463.0

### 測量、單位與 CAD 檔案

- **測量** — 測量單個物件、兩個物件之間或封閉區域內的長度、角度、半徑、面積和周長；數值可複製。 *Where:* 使用草圖工具時按 M。 *Since:* 2.464.0
- **單位** — 像素，或帶比例的毫米和英寸。 *Where:* Sketch 分頁 > Measure and CAD files。 *Since:* 2.464.0
- **匯出 DXF** — 匯出 CAD、雷射和 CNC 程式都能開啟的 R12 DXF，構造線和尺寸位於各自的圖層。 *Where:* File > Export Sketch as DXF。 *Since:* 2.464.0
- **匯出 SVG** — 按實際尺寸匯出草圖及其線條和輪廓。 *Where:* File > Export Sketch as SVG。 *Since:* 2.464.0
- **匯入 DXF** — 將直線、圓、圓弧、多段線、樣條曲線和橢圓匯入草圖，可適配畫面或按實際尺寸，端點連線成輪廓。 *Where:* File > Import DXF。 *Since:* 2.464.0

### CAD 工具列

- **功能區工具列** — 分頁下是成組的大按鈕；點選組名可展開該組的全部專案；可摺疊為只顯示分頁。 *Where:* 影像編輯器和時間軸的頂部。 *Since:* 2.470.0
- **Sketch 分頁** — Create（新建草圖、直線、矩形、圓、圓弧、多邊形、槽、樣條曲線、點）、Modify（圓角、倒角、修剪、延伸、偏移、鏡像、陣列、構造）、12 種約束、Inspect（尺寸、測量）、Insert（DXF 匯入與匯出、SVG 匯出）以及 Finish Sketch。 *Where:* CAD 工具列。 *Since:* 2.470.0
- **Shapes 分頁** — Select（Move 工具、取消選取）、Draw（形狀工具）以及繪製後切換開關。 *Where:* CAD 工具列。 *Since:* 2.470.0
- **分頁跟隨目前工作** — 選取草圖工具或草圖圖層會開啟 Sketch 分頁；在時間軸上選取 3D 圖層會開啟 3D 分頁。 *Where:* CAD 工具列。 *Since:* 2.470.0
- **時間軸分頁** — Create（文字、3D 文字、3D 模型、攝影機、路徑、畫布工具）、3D（控制項、檢視、關鍵影格、烘焙）以及 Sketch。 *Where:* 時間軸的 CAD 工具列。 *Since:* 2.470.0
- **在幀上繪製草圖** — 播放頭所在的幀，或與時間軸尺寸相同的空白圖片，會在影像編輯器中開啟，並新建一個草圖圖層。 *Where:* 時間軸的 Sketch 分頁。 *Since:* 2.470.0
- **顯示或隱藏** — 工具列可以常駐顯示，也可以只在需要時顯示。 *Where:* Window > CAD Toolbar，或 ⌬ CAD 按鈕。 *Since:* 2.470.0
- **CAD 按鈕** — 選取草圖、草圖工具或 3D 實體時，CAD 工具列會自動顯示；工具列中的 ⌬ CAD 按鈕可讓它保持顯示（時間軸有自己的按鈕）。 *Where:* 影像編輯器和時間軸的工具列。 *Since:* 2.494.0
- **草圖流程** — Select 位於 Sketch 分頁最前；編輯草圖時 Create Sketch 隱藏；Finish Sketch 之後轉到 Solid 分頁。 *Where:* CAD 工具列。 *Since:* 2.494.0
- **從線段繼續繪製** — 所選直線兩端之外各有一個 ＋，點選即從該端開始使用 Line 工具。 *Where:* Sketch Select。 *Since:* 2.494.0

### 參數化 3D 實體

- **實體圖層** — 根據其特徵繪製的 3D 實體，作為智慧物件存在，因此移動、縮放、濾鏡和遮罩都能使用。 *Where:* CAD 工具列的 Solid 分頁，Layer > 3D Body。 *Since:* 2.471.0
- **拉伸** — 將草圖的封閉輪廓按距離拉伸，可單側、對稱或雙側，生成新實體，或與某個實體合併、剪下或求交。 *Where:* Solid 分頁。 *Since:* 2.471.0
- **選取輪廓** — Extrude 和 Revolve 允許你點選要使用的封閉區域，指標下的區域會高亮顯示。 *Where:* Solid 分頁。 *Since:* 2.494.0
- **旋轉** — 將輪廓繞草圖的 X 軸、Y 軸或其中一條線按角度旋轉。 *Where:* Solid 分頁。 *Since:* 2.471.0
- **圓角與倒角** — 對全部、頂部、底部、豎直或水平的邊進行倒圓或倒斜角。 *Where:* Solid 分頁。 *Since:* 2.471.0
- **抽殼** — 將實體掏空，頂部或底部開口。 *Where:* Solid 分頁。 *Since:* 2.471.0
- **分割實體** — 用平面切開；一側保留，另一側成為新的實體圖層。 *Where:* Solid 分頁。 *Since:* 2.471.0
- **參數** — 帶單位（mm、cm、m、in、deg）的命名數值和表示式，供所有特徵使用；修改其中一個，實體隨即重建。 *Where:* Solid 分頁的 Change Parameters。 *Since:* 2.471.0
- **特徵清單** — 按順序列出所有特徵：可抑制、編輯、刪除或重新排序，出錯的特徵以紅色顯示。 *Where:* Body 分頁。 *Since:* 2.471.0
- **隨草圖重建** — 之後再編輯草圖時，由它生成的實體會隨之重建。 *Where:* 實體圖層。 *Since:* 2.471.0
- **檢視與環繞** — 主檢視、前視、俯視、右視、左視、後視，或拖曳實體環繞檢視。 *Where:* Solid 分頁。 *Since:* 2.471.0
- **檢視立方體與 3D 導航** — 點選立方體的面或角切換到對應檢視，拖曳它可環繞；Shift + 中鍵拖曳環繞實體，中鍵拖曳平移，滾輪縮放。 *Where:* 選取實體時的畫布。 *Since:* 2.494.0
- **外觀** — 顏色、金屬度、粗糙度和邊線，以及檢視的轉動、傾斜和滾轉。 *Where:* Body 分頁。 *Since:* 2.471.0
- **匯出 STL、glTF 和 STEP** — 將實體匯出為用於列印、3D 應用或 CAD 的檔案。 *Where:* Solid 分頁 > Export。 *Since:* 2.471.0
- **時間軸上的實體** — 將實體作為 3D 圖層傳送到時間軸；實體更改時它會自動更新。 *Where:* 時間軸的 Solid 分頁。 *Since:* 2.471.0
- **在影像編輯器中編輯** — 開啟影像編輯器並選取該實體。 *Where:* 時間軸的 Solid 分頁。 *Since:* 2.471.0
- **兩種引擎** — 在頁面中執行的 OpenCascade（精確的圓角、布林運算和抽殼，無需安裝）或本機上的 Blender。 *Where:* Settings > 3D。 *Since:* 2.471.0

### 影像編輯器中的 3D 圖層

- **3D 圖層** — 放在圖片中的 Daz 或 Blender 場景，每當檢視改變時由 Blender 重新渲染；遮罩、濾鏡和混合模式都能使用。 *Where:* Layer > New 3D Layer。 *Since:* 2.460.0
- **作為 3D 圖層的 3D 模型** — 專案 3D 模型中的 .glb / .gltf / .obj / .fbx / .stl 會作為 3D 圖層開啟：Blender 將它放進有燈光的場景，並讓攝影機對準它取景。 *Where:* Layer > New 3D Layer，或 🧊 Convert to 3D。 *Since:* 2.594.0
- **攝影機** — 場景攝影機，前、後、左、右或頂視，或調整轉動、傾斜、距離和鏡頭；在畫布上拖曳可環繞、平移和縮放。 *Where:* 3D 分頁。 *Since:* 2.460.0
- **姿勢** — 選取人物和骨骼，在其現有姿勢的基礎上轉動。 *Where:* 3D 分頁。 *Since:* 2.460.0
- **幀與渲染** — 選取動畫場景中的一幀；用 Quick、EEVEE 或 Cycles 渲染，可使用透明背景。 *Where:* 3D 分頁。 *Since:* 2.460.0
- **模型** — 通過數值或在畫布上拖曳來移動、轉動、縮放或隱藏場景中的物件；.blend 檔案本身不會改變。 *Where:* 3D 分頁 > Model。 *Since:* 2.541.0
- **Blender 模式** — 選取 3D 圖層後，提示詞面板的 Edit 和 Refine 會先用 Blender 渲染場景，再基於這張圖片工作；結果進入 AI 面板，✔ 可將其中一個保留為圖層。 *Where:* 提示詞面板的下拉選單。 *Since:* 2.541.0
- **Blender 圖層** — 在影像編輯器的畫布上使用時間軸的 Blender 場景工具（開啟 .blend、場景攝影機或自由檢視、移動 / 旋轉 / 縮放物件、儲存）；該檢視成為一個圖層，提示詞面板中的 Edit 會根據場景生成一個新圖層。 *Where:* 編輯器的 🟧 按鈕，或 Layer > New Blender Layer。 *Since:* 2.542.0
- **配合 Blender 場景使用參考圖** — 在提示詞中提到 References 面板中的某張圖片（"the face of the woman in picture 1"），它就會與場景一起傳送給編輯模型；編號和該詞會被改成模型自己的寫法（image 2、<image2>、Picture 2）。 *Where:* 🟧 Blender 分頁 > References。 *Since:* 2.546.0
- **恢復內建風格** — ↺ Built-in 列出缺失的內建影像或影片風格並將其恢復；Krea 2 風格會自動恢復一次。 *Where:* Settings > Image styles / Video styles。 *Since:* 2.547.0
- **在 Blender 檢視中縮放** — 🔍＋ / 🔍－、Alt+拖曳（向前 = 放大，向後 = 縮小）以及 ⌖ Zoom to object (Z)；在影像編輯器中不顯示播放條和 Auto-key。 *Where:* Blender 場景工具的按鈕。 *Since:* 2.546.0
- **按骨架選取繫結好的人物** — 點選帶蒙皮的身體會選取它的骨架，因此移動時整個人物隨之移動（而不只是控制項）。 *Where:* Blender 場景工具（時間軸和影像編輯器）。 *Since:* 2.550.0

### 從圖片生成 3D 場景和模型

- **圖片轉 3D** — Hunyuan3D 2.1（形狀）或 TRELLIS.2（形狀和紋理）可從任意圖片生成 .glb。 *Where:* Gallery 和 Assets 圖片上的 3D 按鈕。 *Since:* 2.404.0
- **用 AI 搭建場景** — 本地 LLM 用 58 類物件規劃 3D 場景和攝影機路徑，其餘部分使用 3D 模型；由 Blender 完成搭建。 *Where:* Blender 預覽的 Build 按鈕。 *Since:* 2.404.0

### Sketcher 建模

- **📏 Sketcher 面板** — 在 bitGen 中快速進行 3D 建模：在地面或面上繪製形狀，再推 / 拉成實體；模型儲存在專案中，邊做邊自動儲存，支援復原 / 重做。 *Where:* 狀態列的 Sketcher 按鈕（預設隱藏）。 *Since:* 2.619.0
- **推 / 拉** — 面變成實體；拉動盒子的頂面使其變高；在面上繪製的形狀可向內推（凹槽）或向外拉（凸臺）；推到另一側即成通孔；橫穿面的線會將面分割。 *Where:* Sketcher ▸ P。 *Since:* 2.619.0
- **精確尺寸與吸附** — 隨時輸入長度（m、cm、mm、英尺、英寸）、兩個尺寸、邊數或角度；指標會吸附到角點、中點、邊、面、原點以及紅 / 綠 / 藍座標軸（方向鍵或 Shift 鎖定其中一條軸）。 *Where:* Sketcher ▸ Measurements 框。 *Since:* 2.619.0
- **直線、矩形、圓、多邊形、偏移** — 繪圖工具；Offset 在面內生成一圈閉合環（房間四周的牆、框架）。 *Where:* Sketcher ▸ L / R / C / N / F。 *Since:* 2.619.0
- **移動、複製、旋轉、縮放、組、上色、擦除、捲尺** — 編輯工具；Ctrl+Move 複製；組作為整體被選取，雙擊進入組內編輯。 *Where:* Sketcher ▸ M / Q / S / G / B / E / T。 *Since:* 2.619.0
- **檢視與顯示樣式** — Iso / Top / Front / Right / Back / Left，透視或平行投影，顯示全部，著色 / 單色 / X 光 / 線框，陰影。 *Where:* Sketcher 的工具條。 *Since:* 2.619.0
- **Sketcher 接入 bitGen** — 將檢視圖片送入影像編輯器、作為 3D 圖層送到時間軸、作為場景送到 Blender、作為網格送到 Unreal；匯出 .glb / .obj / .stl；專案 3D 模型作為組匯入。 *Where:* Sketcher ▸ Send / Export / Import。 *Since:* 2.619.0
- **共用牆體的房間** — 兩次點選即可繪製一個房間（牆、地板、天花板）；拖到另一個房間附近時，它的牆會吸附到對方的牆上，兩個房間共用一面牆；每個牆面採用其所朝向房間的顏色。 *Where:* Sketcher ▸ Build ▸ U Room，然後 Select + 拖曳。 *Since:* 2.620.0
- **牆、地板、天花板、樓梯** — 獨立的牆（回到起點時閉合成房間）、沒有牆的地板、房間天花板的開 / 關、直跑樓梯。 *Where:* Sketcher ▸ Build ▸ W / J / K / V。 *Since:* 2.620.0
- **門和窗** — 單開門、雙開門、推拉門和玻璃門，或無門扇的門洞；單扇窗、雙扇窗和推拉窗，帶窗臺；點選任意牆即可放置（共用牆也會貫通），可沿牆拖曳，在面板中設定尺寸。 *Where:* Sketcher ▸ Build ▸ D / I。 *Since:* 2.620.0
- **屋頂** — 覆蓋一個或多個房間的人字、四坡、單坡或平屋頂，可設坡度、出簷和厚度；山牆端會用牆封閉。 *Where:* Sketcher ▸ Build ▸ Y Room roof（Shift+點選可新增房間）。 *Since:* 2.620.0
- **燈光** — 筒燈、吸頂燈、吊燈、枝形吊燈、射燈、壁燈、落地燈和檯燈，每一盞都是帶燈具的真實光源，可設顏色（暖到冷）和亮度；🌙 Night 顯示它們的照明效果；匯出為 glTF 光源。 *Where:* Sketcher ▸ Build ▸ X Light，工具條上的 🌙 Night。 *Since:* 2.620.0
- **建築面板** — 顯示所選物件（或工具將要建立的下一個物件）的設定：尺寸、高度、樣式、顏色、複製、轉向、屋頂、刪除。 *Where:* Sketcher ▸ 右側面板。 *Since:* 2.620.0
- **Sketcher 的大綱面板** — 列出每個房間及其牆、地板、天花板、踢腳線、頂角線、門和窗（Room 1 ▸ Wall 1、Ceiling 1 …），以及屋頂、地板、樓梯、燈光、家具、攝影機；👁 隱藏 / 顯示；房間分組；新房間自帶踢腳線 + 頂角線；牆可沿垂直於牆線的方向拖曳（Alt：自由拖曳），Shift+點選 = 整個房間。 *Where:* Sketcher ▸ 🗂 Outline。 *Since:* 2.639.0
- **Sketcher 攝影機和家具的旋轉環與鏡頭** — 選取的攝影機或家具會顯示可拖曳的偏航 / 俯仰 / 滾轉旋轉環（步長 5°，按住 Shift 自由旋轉）；其面板中有 Turn / Tilt (Pitch) / Roll；攝影機的 Lens 預設（Fisheye 8 mm、Ultra wide 14、Wide angle 24、35、50、85、135、200 mm telephoto），Focal length 與 Field of view 相互聯動。 *Where:* Sketcher ▸ Select，攝影機 / 家具的面板。 *Since:* 2.633.0
- **從 Sketcher 攝影機看出去的檢視** — View ▾ 列出所有攝影機；選取一個即切換到它的視角（使用其鏡頭），並跟隨其面板中的設定；環繞操作會離開該視角。 *Where:* Sketcher ▸ View ▾。 *Since:* 2.631.0
- **開啟門窗** — Open (%) 及開啟方向：門向內 / 向外擺開，窗扇向外 / 向內開啟，推拉式則滑開一扇。 *Where:* Sketcher ▸ 門 / 窗的面板。 *Since:* 2.631.0
- **自動屋頂、自動地板** — 每個新房間都自帶屋頂，並在牆下鋪一塊地板樓板；可按房間開 / 關。 *Where:* Sketcher ▸ U Room 的面板，房間的面板。 *Since:* 2.631.0
- **Sketcher 中的人物** — 站立 / 坐著 / 行走 / 揮手的人體模型，放在地板上，可命名、調整大小。 *Where:* Sketcher ▸ 🛋 ▸ People。 *Since:* 2.630.0
- **舊版本的房屋** — 舊版 House builder 儲存的房屋會轉換為 Sketcher 模型（房間、門窗洞口、家具、人物、攝影機、燈光、樓梯）。 *Where:* Sketcher ▸ ☰ File ▸ 🏠。 *Since:* 2.630.0
- **Sketcher 中的材質** — 帶紋理的材質（磚、石材、木地板、瓷磚、大理石、地毯 …），可塗到面、牆和地板上。 *Where:* Sketcher ▸ ▦ Materials ▾。 *Since:* 2.629.0
- **Sketcher 攝影機 + 360° 地點** — 兩次點選放置一臺攝影機；可通過它觀看；其畫面 + 深度圖 + 法線圖存入 Image 素材；還可從它生成 360° 全景圖作為 Location。 *Where:* Sketcher ▸ Z 📷 Camera。 *Since:* 2.629.0
- **🪄 佈置房間** — LLM（或該類房間的常用家具組合）為 Sketcher 房間擺滿家具。 *Where:* Sketcher ▸ 房間的面板。 *Since:* 2.629.0
- **Sketcher 中的家具** — 家具庫（39 件：客廳、餐廳、廚房、臥室、浴室、燈具、戶外；含材質和紋理）放在房間地板上，按 R 轉向，可拖曳、調整大小、著色、複製；專案的 3D 模型作為組匯入。 *Where:* Sketcher ▸ A 🛋 Furniture。 *Since:* 2.628.0
- **Sketcher 單獨最大化** — ⛶ 關閉其他所有面板（標題欄和狀態列保留）；⇲ Dock 將它們重新開啟。 *Where:* Sketcher 的標題欄。 *Since:* 2.628.0
- **模型的真實照片** — （2.627.0：一張乾淨的渲染圖 + 其深度圖，提示詞以 "Turn this 3D render into a photorealistic photograph of a building ..." 開頭）開啟提示詞面板使用 Sketcher 時：提示詞面板切換到 Image，使用編輯模型和 "create a real photo of the model in view"；Generate 將 Sketcher 的檢視變成照片，作為普通圖片存入 Image 素材；關閉 Sketcher 時，原來的模式、風格和文字會恢復。 *Where:* Sketcher + 提示詞面板。 *Since:* 2.626.0
- **Sketcher 圖層** — → Image editor 將檢視作為 📏 Sketcher 圖層傳送（再次傳送時更新該圖層）；→ Timeline 將模型作為 📏 Sketcher 圖層（3D）傳送。 *Where:* Sketcher 的工具條。 *Since:* 2.626.0
- **面的拉伸與扭轉** — 點選一個面：面板中有 Extrude（+ 向外，− 切除）和 Twist；拖曳該面可隨指標拉伸（Blender 風格）；Ctrl+拖曳可轉動它並使拉伸扭轉；輸入距離可修改上一次拉伸。 *Where:* Sketcher ▸ Select。 *Since:* 2.625.0
- **邊和角點** — 拖曳邊或角點即可移動（Shift：只沿一條軸）；Shift+點選新增更多邊，Ctrl+點選選取一個面周圍的整圈邊；邊有 Length、Extrude edge（生成新面）和 Fillet（半徑、分段數）；角點有 X / Y / Z。 *Where:* Sketcher ▸ Select，面板。 *Since:* 2.625.0
- **手動調整門窗** — 選取的門 / 窗兩側、頂部和底部有控制柄，可調整大小；窗可上下拖曳；面板中有 Elevation（離地高度）。 *Where:* Sketcher ▸ Select。 *Since:* 2.625.0
- **地板上的牆** — Room / Wall 工具的 Offset from floor edge（外牆面從地板邊緣向內縮排的距離）；拖曳房間的一面牆（房間隨之拉伸）——地板的吸附區域會顯示出來，牆會吸附到邊緣上；房間也會吸附到地板邊緣。 *Where:* Sketcher ▸ U / W，Select。 *Since:* 2.624.0
- **地形** — 建築周圍的地面：用軟畫筆抬高 / 降低 / 平滑 / 壓平；按高度繪製等高線，地面會在等高線之間平滑成形；使用高度圖圖片（黑 = 最低，白 = 最高）；將房間下方的地面整平；可設定尺寸、細節、材質、等高距和土體側面；等高線顯示在地面和平面圖上。 *Where:* Sketcher ▸ ⛰ Terrain (Alt+G)。 *Since:* 2.653.0
- **挖 / 填平臺** — 在地面上挖出 / 填築的水平平臺：點選其角點，設定標高（地面的平均高度，或直接輸入），以 1 : n 的邊坡回接自然地面，可選挖填 / 僅挖 / 僅填，以 m³ 顯示挖方和填方量；選取後可重新整平、重設坡度或再次應用；顯示在平面圖上。 *Where:* Sketcher ▸ ⛰ Terrain ▸ ✂ Cut / fill。 *Since:* 2.656.0
- **泳池** — 矩形（兩個角點或輸入尺寸）或自由形狀的泳池：淺水端 / 深水端及傾斜的池底，池邊磚（壓頂）、木平臺或兩者兼有，及其材質、內襯和水；池下的地面被挖除，四周地面整平；顯示池水體積；顯示在平面圖上。 *Where:* Sketcher ▸ 🏊 Pool，➤ Select 選取泳池。 *Since:* 2.657.0
- **貝塞爾曲線車道** — 沿路線逐點點選，車道會彎曲穿過這些點；拖曳其點和貝塞爾控制柄調整形狀（Alt：只調一側），Delete 刪除一個點；可設寬度、路面材質、路緣石，貼合地面或位於某一標高，平滑曲線；顯示在平面圖上。 *Where:* Sketcher ▸ 🛣 Driveway，➤ Select 選取車道。 *Since:* 2.659.0
- **從房間中拆掉一面牆，內牆 / 外牆** — Eraser / Delete / 🗑 Take this wall out 只拆掉一面牆（地板和天花板保留，共用牆會從兩個房間同時移除，使兩者相通；↺ Put back 可恢復）；每面牆可設為 Auto / Interior / Exterior，內牆的外側面使用其內側顏色，內牆在平面圖上顏色較淺。 *Where:* Sketcher ▸ 在牆上使用 ⌫ Eraser，➤ Select 選取牆。 *Since:* 2.660.0
- **牆體類型（分層構造）** — 一個牆體類型面板，每種類型由外到內的各層組成（磚、空氣層、防潮膜、填充保溫棉的木 / 輕鋼龍骨、保溫板、石膏板、抹灰、外掛板、砌塊、瓷磚 ...），顯示每層的厚度、牆體總厚度以及按比例繪製的剖面；可用於一面牆、一個房間、所有外牆或內牆——牆體按該厚度建造，以最外層著色，牆頂和平面圖上顯示各層接縫。 *Where:* Sketcher ▸ 🧱 Wall types；牆的面板 ▸ Wall type。 *Since:* 2.661.0
- **方正的牆端，從角部拖出牆** — 每面牆在角部以方正端頭收口（角部和自由端是獨立的構件）；用 Select 從角部的某一側或牆的端頭構件拖出，就會朝該方向生成一面新牆（從頂部拖出：任意方向），沿用原牆的高度、厚度和類型。 *Where:* Sketcher ▸ 在角部 / 牆端上使用 ➤ Select。 *Since:* 2.662.0
- **拆分牆、草圖平面、Look at** — 雙擊牆即可拆分（3D 或平面圖中）；選取一段可刪除或拖出，新牆會將其與房間連線；Wall 工具可在房間牆上任意位置開始 / 結束；角部 / 牆端可設寬度（牆垛）；點選的面即為繪圖工具所用的草圖平面（2.687.0：不再在其上疊加繪製任何內容），⊥ Look at 正對該面；2.688.0：點選牆的端頭構件會選取整面牆，雙擊則從該端推 / 拉牆，Ctrl+拖曳使移動保持水平 / 豎直，工具條始終留在螢幕上，✨ Photo 的提示詞只提及模型中實際存在的東西。 *Where:* Sketcher ▸ ➤ Select、✏ Wall、⊥ Look at。 *Since:* 2.663.0
- **⇄ 上一次設定** — 位於提示詞面板的影像 / 影片風格下拉選單旁：在目前風格和上一個風格之間切換；開啟 Override style 時，其 Basic Settings 數值和臨時 LoRA 也會一併恢復；儲存在 model_settings.tmp 中（2.683.0：應用自身更換風格時同樣有效；— none — / — template — 也計入）。 *Where:* 提示詞面板 ▸ ⇄。 *Since:* 2.680.0
- **P-H3 Image** — PrunaAI 基於 MiniMax H3 的影像模型：*P-H3 Image* 風格（文生圖，4-8 MP）和 *P-H3 Image Edit*（最多借助 7 張參考圖編輯圖片，被編輯的是 `<image1>`）；它自帶的提示詞擴寫器會把簡短的請求擴寫成完整的提示詞。Settings ▸ Add-ons ▸ P-H3 Image 會下載其 LoRA、文字編碼器、VAE 和擴寫器（約 17 GB），配合影片已在使用的 MiniMax H3 FL2VA transformer。需要帶 P-H3 節點的 ComfyUI（master / nightly，0.44）；MiniMax H3 Community License。 *Where:* Settings ▸ Image ▸ P-H3 Image / P-H3 Image Edit。 *Since:* 2.678.0
- **🎨 為圖片更換風格** — 影像預覽的外觀下拉選單 + 🎨 Change style（2.681.0：所選外觀會保持選取）會使用提示詞的影像風格，把目前顯示的圖片重新生成為 📷 Photoreal、🧸 Pixar、🧊 2.5D、🌸 Anime 或 🖍 Cartoon（編輯模型按指令修改並保留原圖；SDXL / FLUX 風格則對整張圖片進行精修）；開啟 Override style 時，Basic Settings 中的步數、CFG、種子、檢查點（checkpoint）和 LoRA 會一併使用；結果在預覽中開啟；圖片下方的進度列顯示各步驟（2.677.0）；⇆ Before / after 將原圖與結果並排顯示（2.679.0）。（2.685.0：SDXL / Pony / Illustrious 風格用其自己的工作流重新生成，因此 Override 對其生效；進度列會說明 Override 應用了哪些設定）（2.686.0：非編輯模型的風格會先繪製 ✏ 線稿，再通過其模型系列的線稿 ControlNet 從線稿渲染出該外觀） *Where:* 任意影像預覽 ▸ 外觀下拉選單 ▸ 🎨 Change style。 *Since:* 2.676.0
- **🛤 道路工具** — 像 SimCity 一樣繪製道路：Dirt road、Street、Road、One-way、Avenue 和 Highway（車道、人行道、中央隔離帶、護欄、標線），貼合地面；坡度超過該類型的允許值時，⛏ 將地面開挖成均勻坡度，或 🚇 以隧道穿過（深谷上則架橋）；自動識別路口，並設定紅綠燈、停車 / 讓行標誌、停車線、人行橫道、路名牌和限速標誌；可選擇靠左或靠右行駛。 *Where:* Sketcher ▸ Ground ▸ 🛤 Road。 *Since:* 2.673.0
- **簷溝截面** — 屋頂的簷溝是一個截面：內建 Quad、Half round、OG（ogee 正面）和 Square line，也可像踢腳線或頂角線一樣在截面編輯器中自己繪製（直線和貝塞爾曲線），沿每條簷口掃掠生成並配有落水管。 *Where:* Sketcher ▸ 屋頂 ▸ Gutters / Gutter profile / ✎ Gutter profiles…。 *Since:* 2.671.0
- **貝塞爾截面編輯器** — 用節點和貝塞爾曲線繪製踢腳線、頂角線、框線和窗臺截面（內建圓弧各為一條曲線）；雙擊線段可新增節點，右鍵點選可將線段轉換為曲線 / 直線或刪除節點。 *Where:* Sketcher ▸ 踢腳線 / 頂角線 ▸ ✎ New / edit profiles…。 *Since:* 2.670.0
- **更新和退出時清理 ComfyUI** — ⤓ Update ComfyUI 會先執行 misc\clear-comfy.bat（結束所有 ComfyUI 程序、釋放 8188 埠、清除其快取）；退出時同樣執行，並結束所有 bitGen Studio 程序、關閉終端視窗。 *Where:* Settings ▸ ComfyUI（Clear ComfyUI completely when bitGen Studio exits）。 *Since:* 2.669.0
- **屋簷、封簷板和簷溝** — 每個屋頂的簷口可設為 Simple、Open（外露椽尾）、Boxed（平底簷口板）或 Closed（沿坡面襯板），配封簷板 + 山牆封簷板，帶落水管的方形或半圓形簷溝，各有自己的顏色。 *Where:* Sketcher ▸ △ Roof / 選取的屋頂。 *Since:* 2.668.0
- **物件面板：形狀、構造、重新命名** — Sketcher 的物件面板列出每個形狀（實體、形狀、線、組；點選即可選取，拖曳面可推 / 拉——組的面也可以），Construction 標題下列出平面（沿用草圖平面，或地面 / 正面 / 側面）和構造線（Tape measure + Ctrl，可被吸附），雙擊任意一行即可重新命名。 *Where:* Sketcher ▸ 🗂 Outline。 *Since:* 2.667.0
- **屋頂類型** — 人字、四坡、單坡、荷蘭式人字、截角人字（jerkinhead）、復折式、孟莎式、鹽盒式、四角攢尖、蝶形、平屋頂以及隨牆屋頂，通過圖片選擇，每種都有各自的坡度 / 比例 / 翻轉設定。 *Where:* Sketcher ▸ △ Roof (Y) 或選取屋頂的面板。 *Since:* 2.666.0
- **建築圖紙匯出為 PDF** — 每層的平面圖、四個立面圖以及屋頂 / 總平面圖，按比例繪製在 A4 - A1 圖紙上（橫向或縱向），可全部放在一張圖紙上，也可每頁一個檢視，帶以 mm 為單位的尺寸標註、標高、房間名稱和麵積，以及圖籤（指北針、比例尺、第 n 張 / 共 m 張）。 *Where:* Sketcher ▸ 📄 Plans。 *Since:* 2.665.0
- **照片風格（Sketcher）** — Sketcher 專為 ✨ Photo 使用的影像編輯風格，位於該按鈕旁；會被記住。 *Where:* Sketcher 的工具條。 *Since:* 2.696.0
- **屋面材料** — 預塗彩鋼板（波紋 / 肋形 / 直立鎖邊）、混凝土瓦或陶土瓦、石板瓦、瀝青瓦、陽光板：顏色、樣式、典型最小坡度警告，其重量計入框架校核，並在 ✨ Photo 中寫明。 *Where:* Sketcher ▸ 屋頂 / Roof 工具 ▸ Covering。 *Since:* 2.695.0
- **屋頂框架** — 椽子、屋脊、斜脊 / 斜溝、折坡檁條、頂棚擱柵、下檁條 + 支撐（校核椽子和頂棚擱柵，✔ Size them），或桁架佈置，適用於所有坡屋頂類型。 *Where:* Sketcher ▸ 選取的屋頂 ▸ 🪵 Roof framing（🪵 Show framing）。 *Since:* 2.694.0
- **牆體框架** — 每面牆中的木框架或輕鋼框架：頂板 / 底板、間距 300 / 450 / 600 的立柱、門窗邊柱 + 托柱、窗臺橫撐、橫檔、名義鋼帶斜撐、角柱；按房間統計總量。立柱尺寸不做校核（AS 1684 的立柱表）。 *Where:* Sketcher ▸ 選取的房間 ▸ 🪵 Wall framing（🪵 Show framing）。 *Since:* 2.693.0
- **樓面系統 + 過梁** — 房間下方的地面板、華夫格空心板、加勁筏板、墩柱支承的懸空樓板或架空木地板（短樁、托梁、擱柵）；擱柵、托梁和門 / 窗過梁按材料等級的力學效能做梁計算校核（✔ Size them）；🪵 Show framing。僅供參考——請對照 AS 1684 / 跨度表核實，樓板以 AS 2870 為準。 *Where:* Sketcher ▸ 選取的房間 / 門 / 窗。 *Since:* 2.692.0
- **牆體相互對接** — 新牆的端頭會抵在它所碰到的牆上停住（自身不加端蓋）；首尾相接時，原牆的端頭會繞轉角成形；落在某面牆的牆線上時，會被截到該牆的牆面。牆厚會記住上一次的設定（大於 2 = mm）。 *Where:* Sketcher ▸ ▮ Wall。 *Since:* 2.691.0
- **相連的牆** — 靠近另一面牆的端頭或角部時，Wall 工具會把點拉過去（⊕ 已連線；Shift = 自由）；相連的牆保持連線——拖曳其中一面，另一面的端頭隨之移動，從而變長或變短。 *Where:* Sketcher ▸ ▮ Wall / ➤ Select。 *Since:* 2.690.0
- **櫥櫃與置物架** — 嵌入式衣櫃、步入式衣帽間（L / U 形）、布草櫃、食品儲藏櫃和雜物櫃、書架、置物架：在對話方塊中設定佈局、尺寸、分格（掛衣、雙層掛衣、擱板、抽屜、鞋架）、櫃門、拉手和顏色，並即時顯示正檢視和平面圖；💾 自訂範本可用於所有專案；靠牆放置、面朝室內，↔ Fit the wall 適配牆長；繪製在平面圖和圖紙上。 *Where:* Sketcher ▸ 🛋 Furniture ▸ Cupboards & shelving。 *Since:* 2.689.0
- **人體模型** — 一個精細建模的女性人體模型（作者 dimasalcalde 和 zahers，CGTrader），用於 Sketcher 中的人物，按人物身高縮放。 *Where:* Sketcher ▸ 🛋 Furniture ▸ People ▸ mannequin (model)。 *Since:* 2.664.0
- **使用你的材質生成真實照片** — ✨ Photo 將渲染圖、其深度圖以及一張標註了模型材質和背景圖片的拼板傳送給編輯模型，使照片採用這些材質。 *Where:* Sketcher ▸ ✨ Photo，提示詞面板的 ✏ Edit (Sketcher)。 *Since:* 2.652.0
- **材質工具** — 每面牆的內側和外側、窗框和玻璃、地板、天花板、裝飾線、屋頂、樓梯：可使用顏色、內建材質或圖片（來自 Refs 面板、專案或檔案）作為重複紋理（大小、旋轉）；油漆桶為一面牆的一側上色（Shift：該側的所有牆）。 *Where:* Sketcher ▸ 部件的面板，Materials（paint）。 *Since:* 2.651.0
- **背景圖與 360° 天空** — 在模型後方放置一張參考圖片（鋪滿檢視），或將其作為全景天空包裹整個場景。 *Where:* Sketcher ▸ 🖼 Background。 *Since:* 2.651.0
- **選取與懸停高亮** — 被選取的物件以主題強調色著色，指標下的物件顯示為藍色（已選取時除外）——在 3D 和平面圖中均如此。 *Where:* Sketcher。 *Since:* 2.650.0
- **Shift + 右鍵拖曳縮放** — 向前（向上）放大，向後（向下）縮小，以按下的點為中心；單純右鍵點選仍會開啟選單。 *Where:* Sketcher、時間軸的畫布、影像編輯器（🎨 Artist mode 中也可以）。 *Since:* 2.648.0
- **縮放至所選** — ⊡ 讓所選內容充滿檢視：Sketcher 中的面或建築構件、時間軸上選取的圖層、影像編輯器的選取範圍（或選取的圖層）。 *Where:* Sketcher ⊡，時間軸 ⊡，影像編輯器 ⊡ / View ▸ Zoom to Selection (Ctrl+Alt+0)。 *Since:* 2.648.0
- **指標工具** — Sketcher 的 Select 以及時間軸和影像編輯器的 Move 都以指標箭頭顯示。 *Since:* 2.648.0
- **在 Sketcher 中多選** — 點選選取一個物件，Ctrl+點選新增更多（房間、牆、門、家具、燈光、攝影機、面）；拖曳其中一個即可全部移動，Delete 全部刪除。在 Orbit 中按 Esc = Select；Esc 永遠不會讓最大化的 Sketcher 停靠回去。 *Where:* Sketcher ▸ ➤ Select。 *Since:* 2.648.0
- **平面圖檢視** — 以應用的主題顏色從正上方檢視 Sketcher，一次顯示一層：牆體以實心剖切顯示，門帶開啟弧線，窗帶玻璃和窗臺，樓梯帶踏步和 UP 標記，家具和燈光以平面符號顯示，每個房間標有名稱、寬 × 長和麵積；所有工具都可在其上繪製，點選可選取符號；Orbit 會讓它恢復平放。 *Where:* Sketcher ▸ 📐 Plan，View ▾ 📐 Floorplan。 *Since:* 2.647.0
- **Esc = Orbit** — 按一次 Esc 即放下目前工具並取消選取，在所有 Sketcher 檢視（3D、平面圖、攝影機檢視）中切換到 🔄 Orbit。 *Where:* Sketcher。 *Since:* 2.647.0
- **房間寬度和長度** — 每個房間的面板都有 Width 和 Length（矩形保持其角點不動，其他形狀則被拉伸）；Room 工具的 Width × Length 一次點選即可放置該尺寸的房間。 *Where:* Sketcher ▸ 房間，Room 工具。 *Since:* 2.647.0
- **從 Artist mode 生成** — 在 🎨 Artist mode 中，Alt+G 在畫布上方顯示 Layers 面板和 ⏳ Pending，Ctrl+P 顯示提示詞面板：選取圖層，▾ Edit 或 Generate，從 ⏳ Pending 中保留結果——全程不離開全螢幕畫布；調色盤為 Alt+P。 *Where:* 影像編輯器 ▸ 🎨 Artist mode。 *Since:* 2.646.0
- **關於與致謝** — Settings ▸ About：版本號、Produced and Developed by Tim Paul、Programmer - Claude Opus 5.5，以及對所有使用了其程式碼、模型、工具和創意的專案的致謝（連結在瀏覽器中開啟）；Guide 的結尾也有同樣的致謝。 *Where:* Settings ▸ About。 *Since:* 2.642.0
- **在攝影機自身視角中移動和轉動攝影機** — 通過選取的攝影機觀看時，✥ Move / ⟳ Rotate 會在檢視前方顯示其箭頭或旋轉環；攝影機與檢視一起移動 / 轉動；Esc 取消選取。 *Where:* Sketcher ▸ 攝影機的面板，👁 Look through。 *Since:* 2.643.0
- **Ctrl+P：將提示詞面板置於最前** — 在應用中任何地方，包括正在輸入框中打字時：提示詞面板會開啟、展開，從關閉的 ▣ 面板中移出，並顯示在浮動視窗或最大化面板之上，焦點置於提示詞框。 *Where:* 任何地方，🎨 Artist mode 中也可以（2.646.0）。 *Since:* 2.645.0
- **攝影機移動和旋轉控制項** — 選取的攝影機會高亮顯示（無邊框），並顯示 X / Y / Z 移動箭頭：拖曳攝影機可在其目前高度上移動，拖曳箭頭可沿單軸移動（步長 1 cm）；雙擊可切換到旋轉環，再雙擊切回；點選其他物件則選取該物件。 *Where:* Sketcher ▸ Select，攝影機。 *Since:* 2.641.0
- **每個部件的專屬屬性** — 在檢視或大綱中點選牆、地板、天花板、踢腳線、頂角線或地板樓板，會顯示其專屬面板：牆的長度、高度和內側顏色，地板的標高，天花板的類型；Delete 關閉該部件。 *Where:* Sketcher ▸ Select，🗂 Outline。 *Since:* 2.640.0
- **踢腳線、頂角線、框線和窗臺的截面** — 圖片下拉選單中有 30 種內建截面；踢腳線沿牆掃掠，轉角斜接（在門框處止住），頂角線位於天花板下方，門窗套線環繞門（兩面）和窗，另有窗臺；✎ Profiles… 可繪製自訂截面（1 mm 網格上的點，按寬 / 高縮放）並儲存在專案中。 *Where:* Sketcher ▸ 踢腳線 / 頂角線 / 門 / 窗的面板。 *Since:* 2.640.0
- **斜牆** — 雙擊牆頂新增一個切點，向上 / 向下拖曳（山牆端）；選取頂邊後拖曳或輸入其高度（單坡牆）；Delete 刪除切點 / 邊。 *Where:* Sketcher ▸ Select。 *Since:* 2.624.0
- **隨牆而定的天花板和屋頂** — 房間的天花板可設為 None / Flat / Follows the walls' slope；隨牆的屋頂帶有簷口寬度。 *Where:* Sketcher ▸ 房間的面板，Y Roof。 *Since:* 2.624.0
- **Sketcher 採用 bitGen 的配色；雙擊空白處 = Orbit** — 面板及其 3D 檢視使用主題顏色；雙擊空白處會取消所有選取並進入環繞。 *Where:* Sketcher。 *Since:* 2.624.0
- **Sketcher 的獨立視窗和 File 選單** — ⛶ 讓它充滿標題欄與狀態列之間的整個 bitGen 視窗（之後 ⇲ Dock 將其放回，2.624.0），✕ 將其關閉；☰ File：新建、開啟、儲存、另存新檔、重新命名、匯入、匯出、傳送、刪除、關閉；🖼 → Image editor 和 🎞 → Timeline 按鈕；⌂ Cut-away。 *Where:* Sketcher 的標題欄和工具條。 *Since:* 2.620.0

## 橋接

與 Blender、Daz Studio 和 Unreal Engine 5.8 的即時連線，全部在同一臺電腦上執行。

### Blender

- **Blender 附加元件** — Blender 側邊欄中的 bitGen 分頁：將場景或所選內容以 glTF 傳送（或作為 3D 圖層傳送），即時連線會在每次儲存時重新發送，還可將專案的 3D 模型匯入 Blender。 *Where:* Blender 的側邊欄 (N)。 *Since:* 2.385.0
- **將場景渲染為真實畫面** — 通過攝影機渲染 Blender 佈局，再由帶 3DREAL 的 LTX 2.3 將其轉為照片級真實畫面。 *Where:* 附加元件的 Render scene 按鈕。 *Since:* 2.402.0
- **預覽畫布中的 .blend** — 在時間軸畫布上開啟 .blend：通過其攝影機或自由檢視觀看，選擇、移動、設定關鍵影格、複製、隱藏和刪除物件。 *Where:* 畫布工具中的 Blender 按鈕。 *Since:* 2.403.0
- **區段與儲存** — 設定 In 和 Out 點，可僅在 bitGen 中儲存、儲存回原檔案，或儲存為新檔案。 *Where:* .blend 預覽的 Properties。 *Since:* 2.403.0
- **從預覽渲染為真實畫面** — 渲染該區段，並將一個 LTX 2.3 3DREAL 任務加入佇列。 *Where:* .blend 預覽。 *Since:* 2.403.0
- **新增模型** — 將專案中的 3D 模型新增到開啟的場景。 *Where:* .blend 預覽的 Properties。 *Since:* 2.404.0
- **預覽中的姿勢** — 轉動人物的骨骼；儲存和渲染時，Blender 會為該姿勢設定關鍵影格。 *Where:* .blend 預覽的 Pose 部分。 *Since:* 2.461.0
- **送到影像編輯器** — 以目前姿勢和檢視將場景作為 3D 圖層傳送。 *Where:* .blend 預覽。 *Since:* 2.461.0

### Daz Studio

- **bitGen Bridge 腳本** — 將動畫渲染為真實畫面、將一幀渲染為圖片、將場景作為 3D 傳送以開啟或合併，或將人物作為 3D 模型傳送。 *Where:* Daz Studio 的 Scripts > bitGen。 *Since:* 2.405.0
- **Merge 對話方塊** — 選擇要合併到目前場景中的人物、燈光和攝影機，以及場景攝影機和幀範圍。 *Where:* bitGen 中，Daz 場景傳入時。 *Since:* 2.405.0
- **作為 3D 圖層的 Daz 場景** — 傳送場景，並在影像編輯器中將其作為 3D 圖層開啟。 *Where:* bitGen Bridge > Scene。 *Since:* 2.460.0
- **即時連線（實驗性）** — bitGen 直接在 Daz Studio 中移動攝影機和調整姿勢。 *Where:* Daz Studio 的 bitGen Live Link、3D 分頁、時間軸的 Pose 部分。 *Since:* 2.461.0

### Unreal Engine 5.8

- **bitGen Bridge 外掛** — 一個純 Python 的 Unreal Editor 外掛，列出專案的關卡、Level Sequence、攝影機、MetaHuman 和動畫，只響應本機的請求。 *Where:* 專案的 Plugins 資料夾。 *Since:* 2.472.0
- **Unreal 設定** — 埠、"alpha is inverted" 開關、Test connection 以及外掛的安裝說明。 *Where:* Settings > 3D > Unreal Engine。 *Since:* 2.472.0
- **影像編輯器中的 Unreal 圖層** — 通過關卡中某臺攝影機看到的關卡畫面，或目前的關卡視口畫面，作為圖片圖層。 *Where:* CAD 工具列的 Unreal 分頁，Layer > New Unreal Layer。 *Since:* 2.472.0
- **影像編輯器中的 MetaHuman 圖層** — 處於某個動畫某一時刻姿勢的 MetaHuman，可按面部、半身或全身取景，可轉向，背景透明。 *Where:* Unreal 分頁，Layer > New MetaHuman Layer。 *Since:* 2.472.0
- **Unreal 分頁** — 微調攝影機的轉動、傾斜、推拉和視野（或人物的轉向、姿勢時間和取景），使用目前視口，重新渲染。 *Where:* Properties 中該圖層的 Unreal 分頁。 *Since:* 2.472.0
- **時間軸上的 Unreal 圖層** — 一個 Level Sequence，或通過攝影機拍攝、時長由你指定的關卡畫面，由 Movie Render Queue 按時間軸的尺寸和幀率渲染。 *Where:* 時間軸的 Unreal 分頁。 *Since:* 2.472.0
- **時間軸上的 MetaHuman 圖層** — 在透明背景上播放動畫的 MetaHuman，疊加在其他圖層之上。 *Where:* 時間軸的 Unreal 分頁。 *Since:* 2.472.0
- **Unreal 攝影機** — 你自己的攝影機，其時間、位置、轉向和視野關鍵影格取自 Unreal 的視口或攝影機，通過關卡渲染。 *Where:* 時間軸的 Unreal 分頁。 *Since:* 2.472.0
- **重新渲染** — 每個片段都會記住自己的生成方式，在 Unreal 專案或關鍵影格更改後重新渲染。 *Where:* Unreal 分頁。 *Since:* 2.472.0
- **Unreal 攝影機工具** — 在場景中移動 Unreal 或 MetaHuman 圖層的攝影機：拖曳環繞，按 Ctrl 環顧，按 Shift 平移，按 Alt 滾轉，滾輪推拉，Ctrl+滾輪縮放；拖曳時顯示小尺寸預覽。 *Where:* 影像編輯器的 UNREAL 分頁，Camera。 *Since:* 2.475.0
- **Camera 分頁** — 鏡頭預設（18-200 mm、微距、變形寬銀幕、自訂），焦距與視野聯動，膠片背尺寸、光圈值和對焦距離（景深，點選對焦），曝光（EV），位置及滾轉 / 俯仰 / 偏航，可從 Unreal 視口讀取或寫回。 *Where:* Properties，Window > Unreal Camera。 *Since:* 2.475.0
- **時間軸攝影機的鏡頭** — Unreal 攝影機渲染所用的焦距、光圈值、對焦和曝光。 *Where:* 時間軸的 UNREAL 分頁，Keys。 *Since:* 2.475.0
- **Unreal 燈光** — 點光源、聚光燈、矩形光（柔光箱）、太陽光和天空光，可設顏色或色溫、強度、照射範圍、光錐、尺寸、體積散射和陰影；預設（三點布光、黃金時刻、夜晚街道、霓虹、柔光箱）。 *Where:* 影像編輯器的 Lights 分頁，UNREAL > Lights & Fog。 *Since:* 2.476.0
- **霧與體積霧** — 指數高度霧（密度、衰減、顏色、起始距離）與體積霧（反照率、消光、距離），以及霧預設。 *Where:* Lights 分頁，時間軸的 Lights & Fog。 *Since:* 2.476.0
- **燈光工具** — 每盞燈在圖片上顯示為一個標記：拖曳可在畫面上移動，Shift-拖曳拉近或推遠，Alt-拖曳調整其朝向。 *Where:* 影像編輯器的 UNREAL 分頁，Lights。 *Since:* 2.476.0
- **時間軸上的燈光** — 為 Unreal、MetaHuman 或 Unreal 攝影機片段設定同樣的燈光和霧，或將影像編輯器中的燈光和霧帶過來。 *Where:* 時間軸的 UNREAL 分頁，Lights & Fog。 *Since:* 2.476.0

## 交付與格式

把作品輸出：各種格式的影片、供其他編輯軟體使用的檔案，以及 bitGen 自己的專案檔案。

### 合成與匯出

- **合成** — 將時間軸合成為一部影片，儲存在專案資料夾中。 *Where:* 時間軸
- **匯出格式** — MP4 H.264、H.265、H.265 10-bit、H.264 10-bit 和 AV1；MOV ProRes 422 HQ、帶 alpha 的 ProRes 4444 和 DNxHR HQ；WebM VP9；GIF；WAV 和 MP3。 *Where:* Export 對話方塊。 *Since:* 2.407.0
- **一次合成，輸出所有格式** — 每種格式可單獨設定尺寸、重新構圖（裁切、加邊或模糊填充）、幀率和品質；預設包可一次新增多種格式。 *Where:* Export 對話方塊。 *Since:* 2.407.0
- **智慧重新構圖** — 生成直向或方形版本，裁切框跟隨主體移動。 *Where:* Export 對話方塊的適配選項。 *Since:* 2.413.0
- **HDR 輸出** — 10-bit 預設可輸出 HDR10、HLG 或 Rec.2020。 *Where:* Export 對話方塊。 *Since:* 2.417.0
- **顯示卡編碼器** — 在本機可用時使用 NVENC、Quick Sync、AMF 或 VAAPI。 *Where:* Export 對話方塊。 *Since:* 2.411.0
- **In / Out 匯出與單幀** — 僅匯出標尺上的選定範圍，或將標記處的幀匯出為 PNG。 *Where:* Export 對話方塊，Ctrl+Shift+E。 *Since:* 2.410.0
- **響度目標** — -14、-16、-23 或 -24 LUFS。 *Where:* Mix 對話方塊。 *Since:* 2.406.0
- **字幕輸出** — 燒錄進畫面，或在每部影片旁生成 .srt 檔案。 *Where:* Captions 對話方塊。 *Since:* 2.406.0

### 與其他編輯軟體交換

- **Final Cut Pro 7 XML** — 片段、修剪、圖層、速度、運動、關鍵影格、不透明度、音量、字幕、標記，以及以 .cube LUT 形式儲存的調色；支援匯出和匯入。 *Where:* Exchange 對話方塊。 *Since:* 2.407.0
- **FCPXML 1.10** — 用於 Final Cut Pro X，雙向支援。 *Where:* Exchange 對話方塊。 *Since:* 2.414.0
- **EDL 與 OpenTimelineIO** — CMX3600 EDL（V1）和 OTIO，含標記。 *Where:* Exchange 對話方塊。 *Since:* 2.407.0
- **AAF** — 供 Avid Media Composer 和 Pro Tools 使用的剪輯版本。 *Where:* Exchange 對話方塊。 *Since:* 2.417.0
- **匯入時間軸** — XML 或 EDL 會作為新的命名時間軸開啟，片段按名稱匹配。 *Where:* Exchange 對話方塊。 *Since:* 2.407.0

### bitGen 自己的檔案

- **.bgi** — 影像編輯器的專案檔案，一個包含 XML 和 PNG 的 zip。 *Where:* 影像編輯器的 File 選單。 *Since:* 2.436.0
- **.bgv** — 一條時間軸，包含其每個圖層、片段、關鍵影格、效果、字幕、標記及巢狀時間軸，以 XML 格式儲存。 *Where:* 時間軸工具列。 *Since:* 2.436.0
- **.bgp** — 整個專案，可完全自包含，也可作為清單檔案。 *Where:* 選單列。 *Since:* 2.436.0
- **CAD 與 3D 檔案** — DXF 和 SVG 草圖；STL、glTF 和 STEP 實體。 *Where:* CAD 工具列。 *Since:* 2.464.0
- **VR 檔案** — VR 影片帶有球面後設資料以及播放器識別所需的檔名字尾。 *Where:* VR World 和 swap

### 指南

- **PDF 指南** — 分步說明，外加一頁彙總全部快捷鍵的速查表，採用 Studio 的深色主題。 *Where:* docs/bitGen-Studio-Guide.pdf。 *Since:* 2.391.1
- **宣傳冊** — 一份 3 頁的宣傳冊。 *Where:* docs/bitGen-Studio-Brochure.pdf。 *Since:* 2.392.0
- **功能參考** — 即本目錄：按領域列出每項功能（作用、位置、自哪個版本起），每次釋出都會重新生成。 *Where:* docs/bitGen-Studio-Features.pdf。 *Since:* 2.473.0
- **應用內幫助** — 時間軸和影像編輯器的幫助頁面。 *Where:* Help 按鈕。 *Since:* 2.380.0
- **中文和日文介面** — 主視窗自身的文字（按鈕、選單、面板標題、分頁、Settings、工具提示、提示資訊）可顯示為簡體中文、繁體中文或日文，通過選單列上的下拉選單即時切換；它與指南的語言是同一個設定，指南會按應用中顯示的樣子稱呼按鈕。Settings 已完整翻譯，包括其執行時輸出的狀態行（2.706.0），所有面板——影像編輯器、時間軸、Sketcher、SolidCraft、StoryBoard 等——連同其工具、面板和選單也已翻譯（2.707.0）；指南會按應用中顯示的樣子稱呼各編輯器的按鈕。 *Where:* 選單列上 ⊞ 左側的下拉選單。 *Since:* 2.705.0
- **中文和日文版指南與幫助** — 📖 Help 視窗、Ctrl+K 中的指南條目、❔ 幫助頁面、快捷鍵清單和 Guide PDF，提供簡體中文（中國大陸）、繁體中文（臺灣 / 香港，2.704.0）或日文版本；應用自身的按鈕保持英文，因此譯文用英文稱呼它們。若某一節的英文版較新，會註明這一點，並可一鍵切換到英文版。 *Where:* 📖 Help 或 ❔ 幫助頁面中的語言選擇器；docs/bitGen-Studio-Guide-zh-CN.pdf、-zh-TW.pdf、-ja.pdf。 *Since:* 2.703.0
- **語言包** — 除英文外，每種語言都是一個語言包：⤒ 從 .zip 安裝（先進行檢查；已有的語言會先詢問是否替換），✕ 移除，檢視每個語言包的翻譯進度（應用、指南、幫助、快捷鍵、功能）；⤓ 主語言包 - 全部英文內容並附 TRANSLATING.txt - 用於將 bitGen Studio 翻譯成新語言；⤓ 匯出以供翻譯 會返回語言包，補入較新的英文並保留其譯文。 *Where:* 設定 ▸ 語言。 *Since:* 2.715.0
- **社群語言包** — 社群分享的語言包列出其他人翻譯的語言包（來自 tigerart.com.au 上的 bitGen 社群，每個都經過管理員檢查）：⤓ 一鍵安裝；⇪ 分享以你的身份將已安裝的語言包傳送到社群，並可附上給管理員的留言；你分享的語言包顯示每個語言包是等待中、已分享還是未被接受（及原因），✕ 可將其撤下。網站的語言包頁面也列出這些語言包，並提供主語言包和上傳表單。 *Where:* 設定 ▸ 語言 ▸ 社群分享的語言包；tigerart.com.au/languages.php。 *Since:* 2.716.0
- **更快的首幀（Auto）+ Qwen Image 2.1 Turbo8** — 場景卡片的 ✎ 首幀預設為 Auto：已安裝時用 Qwen Image Edit 2511 以 4 步生成（Apache 2.0——可以商用），超過三張圖片時用 Qwen Image 2.1 edit；新的 Qwen Image 2.1 edit Turbo8 樣式讓 Qwen 2.1 只需 8 步而非 25 步（Qwen Research License——非商業）。 *Where:* 場景卡片 ▸ ✎ 首幀 ▸ 樣式；設定 ▸ 模型 ▸ 模型目錄。 *Since:* 2.717.0
- **渲染前檢查缺失的模型** — 渲染要載入的每個模型檔案（工作流的、樣式的，以及 Basic Settings 的）都會與 ComfyUI 模型路徑中已找到的模型檔案清單比對（misc/models_found.json，缺少某個名稱時重新生成）；對話方塊列出缺少的檔案及各自應放入的資料夾，⬇ Download 下載模型目錄中有的檔案後渲染自動開始，Cancel 則停止渲染；仍因缺少模型而停止的渲染會詢問是否下載（2.720.0）。 *Where:* 生成（圖片、影片、音樂）；🧩 Models ▸ ⟳ 重新生成清單。 *Since:* 2.719.0
- **僅在模型改變時釋放顯示記憶體** — 連續使用同一模型的渲染會把它留在顯示卡上（不解除安裝、不重新載入）；換用其他模型或發生顯示記憶體不足的錯誤時，會先釋放顯示卡；也可以像以前一樣每次生成前釋放。 *Where:* 設定 ▸ ComfyUI ▸ Free VRAM before a generation ▸ Free it。 *Since:* 2.722.0
- **最後使用的浮動面板在最上面** — 💬 Community、Basic Settings、LLM tokens、▣ 面板、你自己命名的面板、浮動的主面板、舞台面板和語音聊天，在應用程式其餘部分之上共用一個順序：點擊或打開其中一個，它就會到最上面（命名面板不會再遮住 Community）。 *Where:* 每個浮動面板。 *Since:* 2.724.0
- **預覽中的歌曲：視覺化效果，Next 播放下一首** — 在預覽中對歌曲或聲音按 ▶，會開始一個隨機選擇的視覺化效果（條形、鏡像、波形、圓環、星空、漣漪；🎲 換一個）；Next / Prev 跳到所點擊面板中的下一首 / 上一首並播放。 *Where:* 預覽（在 Gallery、Assets 或 References 中點擊歌曲）。 *Since:* 2.725.0
- **Neural blue 主題和 bitGen 大腦圖片** — 午夜海軍藍配電光藍強調色的主題；啟動畫面是大腦影片，左上角顯示標誌（自 2.752.0 起；此前隨機顯示片頭影片或大腦）；新安裝的第一個專案會在 Assets ▸ Images 中自帶這張圖片。 *Where:* Settings ▸ Themes、啟動畫面、Assets ▸ Images。 *Since:* 2.726.0

## 鍵盤快捷鍵

完整的按鍵清單見 PDF 指南（docs/bitGen-Studio-Guide.pdf）以及影像編輯器的 Help > Keyboard Shortcuts。

### 最常用的按鍵

- **P, S, L, 2, 1** — 提示詞面板、Basic Settings、LLM tokens、負面提示詞面板以及 Tools and Properties。 *Where:* 任何地方（輸入文字時除外）
- **Space, J, K, L** — 暫停和播放；向後穿梭、停止和向前穿梭。 *Where:* 時間軸
- **V, B, N, Y, U** — 時間軸的 Select、Ripple、Roll、Slip 和 Slide 工具。 *Where:* 時間軸的圖層上方
- **Ctrl+K, M, I, O** — 分割、標記、In 點和 Out 點。 *Where:* 時間軸
- **F5, F6, F8, F10, F12, Ctrl+Q** — 曲線工具、形狀工具、尺寸、節點 Shape 工具、Outline Pen、Convert to Curves。 *Where:* 影像編輯器
- **N，然後 S, L, R, C, A, P, D, X, T, E, F, M** — 草圖工具及其字母鍵。 *Where:* 影像編輯器
- **Alt+Shift+S, Alt+Shift+R** — 截圖和螢幕錄製。 *Where:* 任何地方
