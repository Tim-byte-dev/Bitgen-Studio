# bitGen Studio — 功能参考

bitGen Studio 是一款本地离线的 AI 视频与图像工作室：无需账户，不依赖云端，任何数据都不会离开你的电脑。它驱动 ComfyUI 和本地模型（MiniMax H3、LTX 2.5 / 2.3、Wan 2.1 / 2.2、FLUX、SDXL、Qwen Image 等），并由本地 LLM 撰写提示词和剧本，同时把围绕它们的一切集中在一个窗口中：用于电影和音乐视频的场景板、完整的时间线编辑器、带矢量 / CAD / AI 工具的分层图像编辑器、参数化 3D 人体，以及连接 Blender、Daz Studio 和 Unreal Engine 5.8 的桥接。本参考按领域分组，列出了迄今为止的全部功能。

## 工作区

窗口、各个面板、应用外观、项目及其包含的文件。

### 窗口与菜单栏

- **一个窗口容纳所有面板** — 左侧面板（系统状态与设置）、References、Assets、中央面板（Preview、Timeline、StoryBoard、Music、Stems、SFX、Image editor、ComfyUI、Prompt、Prompt chat、Console）、Queue 和 Gallery。 *Where:* 主窗口
- **菜单栏** — 新建项目、打开、保存、截图、录制、回收站、重置项目、设置以及弹出所有已加载的模型，全部排在同一行中；无论显示哪些面板，位置都保持不变。 *Where:* 标题栏下方的一行。 *Since:* 2.382.1
- **在下拉列表中搜索** — 每个包含 8 项或以上的列表打开时都带有搜索框：输入文字即可筛选（先匹配词首，再按顺序匹配字母），用方向键和 Enter 选择；直接按一个字母会打开列表并开始搜索。 *Where:* 所有下拉列表；Settings > General > Dropdown lists。 *Since:* 2.478.0
- **状态栏面板按钮** — 每个面板都有一个按钮，面板在屏幕上（展开或折叠）时按钮亮起；点击一次隐藏面板，再点击一次重新显示。 *Where:* 状态栏。 *Since:* 2.386.0
- **系统状态** — 电脑的实时读数，每块显卡都有单独的边框和图表（温度、显存）。 *Where:* 左侧面板
- **功耗与时钟频率** — 每块显卡的功率（以瓦计，相对其上限）和时钟频率、CPU 的时钟频率（以及电脑提供时的功耗）、启动以来消耗的电能。 *Where:* System stats。 *Since:* 2.517.0
- **任务消耗的电能** — 以 Wh / kWh 计（显卡 + 可读取时的 CPU），以及平均和峰值功率，显示在任务日志、任务卡片和项目的任务列表中。 *Where:* Queue 的 Done 标签页。 *Since:* 2.517.0
- **弹出模型** — 卸载所有已加载的模型以释放显卡。 *Where:* 菜单栏
- **无边框应用窗口** — 工作室以带自定义标题栏的独立窗口打开，而不是浏览器标签页；浏览器方式仍然可用。 *Where:* 桌面应用。 *Since:* 2.45.0
- **控制台** — ComfyUI、各工作进程和每个任务的实时日志。 *Where:* Console 面板
- **ComfyUI 面板** — ComfyUI 自身的界面嵌入在工作室中，并带有重新加载和在浏览器中打开的按钮。 *Where:* ComfyUI 面板。 *Since:* 2.120.0
- **处处有工具提示，专家模式** — 每个按钮都有工具提示；熟悉操作后，Expert mode 会隐藏帮助段落。 *Where:* Settings > General
- **空格键随处暂停** — 只要不是在输入文字，Space 即可暂停画布、实时预览或 Preview 面板中的视频。 *Where:* 任意位置。 *Since:* 2.410.0
- **媒体查看器** — 点击任意缩略图即可全窗口打开：在列表中滑动切换、以指针为中心缩放、平移、播放视频和声音、打开原文件。 *Where:* Gallery、Assets 和 References。 *Since:* 2.80.0
- **查看器中的渲染详情** — 预览对话框显示图片或片段的种子、CFG、步数、采样器、模型、LoRA、尺寸、渲染时间和提示词。 *Where:* 预览对话框

### 面板与布局

- **停靠或浮动时最大化** — 适用于 Sketcher、Timeline 和 Image editor：停靠时，⛶ 填满所在列的高度，并把下方的面板向下推；浮动时，⛶ 占满整个窗口并关闭其他面板（还原时恢复）。Sketcher 在列中有自己可调整的高度。 *Where:* 面板的 ⛶。 *Since:* 2.658.0
- **折叠与最大化** — 每个面板都可以折叠到只剩标题栏，或者最大化；其他面板保持打开并保留各自的高度，按 Esc 还原。 *Where:* 每个面板的标题栏
- **固定** — 固定按钮会锁定面板当前的高度（侧边面板则为宽度）；之后可以缩小，但不能变高。 *Where:* 每个面板标题栏中的第一个按钮。 *Since:* 2.381.0
- **记住的布局** — 每个面板的状态、高度、宽度、固定和最大化都保存在 docker_status.json 中，并在任何内容绘制之前加载。 *Where:* 安装文件夹。 *Since:* 2.381.0
- **面板配置** — 为每组经常一起打开的面板保存一个布局（尺寸、哪些面板在屏幕上、侧边面板和浮动面板），每组最多六种屏幕尺寸，自动加载。 *Where:* 菜单栏右侧的 Docker layout 按钮。 *Since:* 2.392.0
- **浮动提示词面板** — 提示词面板可以作为独立窗口浮动；可拖动、调整大小、折叠，或停靠到其他面板的上方、下方或旁边。 *Where:* 按键 P。 *Since:* 2.389.0
- **浮动的 Basic Settings 与 LLM tokens** — 两者都是独立面板：可以浮动，可以作为标签页停靠到其他面板中，可以放在某一列的旁边或里面，也可以放入左侧面板的列表。 *Where:* 按键 S 和 L。 *Since:* 2.393.0
- **命名面板** — 创建一个使用自定义名称的空浮动面板，再把浮动面板作为标签页停靠进去；它可以浮动在整个应用之上，也可以限定在某个面板之内。 *Where:* Docker layout > New docker。 *Since:* 2.438.0
- **▣ Docker：供其他面板放入的空面板** — 用状态栏的 ▣ Docker 或 Ctrl+Alt+D 显示它，用 ⇱ 让主面板浮动后拖进去；橙色线条显示每个面板的落点（并排或堆叠），并有分隔条用于调整大小。 *Where:* 状态栏 > ▣ Docker。 *Since:* 2.545.0
- **拖入面板、设为常驻、删除** — 拖动主面板自身的标题栏即可将其拖入；📌 把 ▣ 面板变成主列中的常规面板，🗑 删除它及其按钮；状态栏按钮显示它的名称。 *Where:* ▣ 面板的标题栏。 *Since:* 2.549.0
- **面板标题右键菜单** — 右键点击你创建的面板（浮动或常驻），可选择 Rename、其布局、Make permanent / Float it again 以及 Delete docker。 *Where:* ▣ 面板的标题栏。 *Since:* 2.550.0
- **命名面板的布局与标题** — 命名面板把其中的面板显示为标签页、并排或堆叠（标题中的 ⇆ / ⇅，或 ⚙ > Layout）；双击标题即可就地重命名。 *Where:* 命名面板的标题栏。 *Since:* 2.545.0
- **对话框居中显示** — 对话框和消息框在屏幕中央打开，或在你上次移动到的位置打开。 *Where:* dialog_layout.cfg。 *Since:* 2.438.0
- **面板布局文件** — 每个浮动面板的位置、尺寸、名称和标签页都保存在 panel_layout.cfg 中。 *Where:* 安装文件夹。 *Since:* 2.438.0
- **StoryBoard 可以浮动** — StoryBoard 面板可以成为独立窗口，作为标签页停靠到命名面板中，或回到时间线下方。 *Where:* StoryBoard 标题栏。 *Since:* 2.456.0

### 主题与外观

- **主题** — Dark、Darker（OLED 纯黑）、Slate、Light 和 High contrast 会改变整个应用的外观，图像编辑器也包括在内。 *Where:* Settings > Themes。 *Since:* 2.432.0
- **强调色** — 为按钮、亮起的标签页和滑块设置任意颜色。 *Where:* Settings > Themes。 *Since:* 2.432.0
- **界面大小** — 一个滑块同时缩放所有字体和面板，范围为 60 到 175 %。 *Where:* Settings > Themes。 *Since:* 2.432.0
- **自定义颜色** — 为主题的每个部分单独设置颜色（背景、面板、线条、文字、正常、错误、悬停、画布、选中）。 *Where:* Settings > Themes > Customize。 *Since:* 2.435.0
- **已保存的主题** — 把主题保存为 themes 文件夹中的 .json 文件，从其卡片加载，导出和导入；导入时会把你原来的主题保留为 <name>_old.json，立即保存导入的主题，↶ Revert 可以恢复原样（2.709.0）。 *Where:* Settings > Themes。 *Since:* 2.435.0
- **主题编辑模式** — 点击屏幕上的任意元素即可选中它，并更改其字体、大小、颜色、阴影、圆角半径或图标，可作用于此元素、所有同类元素或其整个类别。 *Where:* 顶栏中的画笔按钮。 *Since:* 2.443.0
- **主题编辑模式下对话框照常可用** — 该模式开启时，对话框和弹出菜单照常响应点击和按键。 *Where:* 主题编辑模式。 *Since:* 2.455.0
- **编辑器主题** — 图像编辑器跟随应用主题，或使用自己的 Pro、Studio 或 Classic 外观。 *Where:* 图像编辑器的 Window > Theme。 *Since:* 2.393.0

### 项目与保存

- **项目** — 所有内容都存放在各自的项目文件夹中：输出、视频、图像、声音、角色和场景。 *Where:* 菜单栏的 New、Open 和 Save
- **保存一切内容** — 歌曲和场景、提示词、对话、角色、环境、参考图、素材、图库、时间线以及每个面板的字段。 *Where:* 菜单栏的 Save。 *Since:* 2.372.0
- **另存为** — 以新名称复制整个项目并打开副本；已存在的名称会被拒绝。 *Where:* 菜单栏。 *Since:* 2.372.0
- **新建项目从零开始** — 先保存你离开的项目，然后每个面板都清空重新开始。 *Where:* 菜单栏的 New。 *Since:* 2.371.0
- **回收站** — 删除的文件会进入项目的回收站；可以还原、永久删除或清空回收站。 *Where:* 菜单栏。 *Since:* 2.374.0
- **重置项目** — 清空项目并以相同名称重新创建，同时停止其渲染并清除其已完成的任务。 *Where:* 菜单栏。 *Since:* 2.374.0
- **整个项目文件（.bgp）** — 整个项目保存为一个 XML 文件，可以自包含全部媒体，也可以是一个小清单；采用流式读写，因此数 GB 也没问题；打开它会创建一个新项目。 *Where:* 菜单栏中的打包按钮。 *Since:* 2.436.0
- **电影包** — 在 StoryBoard 上新建、保存和加载整部电影（演员阵容、章节、场景和渲染）。 *Where:* StoryBoard 的菜单栏。 *Since:* 2.151.0

### 素材、参考图、图库与队列

- **素材面板** — 项目中的图像、视频和声音；把文件拖放到上面即可导入。 *Where:* Assets 面板
- **素材分组** — （2.635.0：一个分组就是 Assets 文件夹中的一个文件夹）把文件归入分组；Send 把文件移入该文件夹，Add 则同时在那里创建链接。 *Where:* Assets 面板
- **SolidCraft 全窗口** — SolidCraft 面板上的 ⛶ 会填满整个窗口（标题栏和状态栏保留）并关闭其他面板；🗗 / Esc 将布局恢复原样。 *Where:* 📐 SolidCraft 面板。 *Since:* 2.638.0
- **Shift+右键点击退出 Artist 模式** — 在图像编辑器仅显示画布的 Artist 模式中，在任意位置 Shift+右键点击即可退出（不弹出右键菜单）；Ctrl+Esc / Ctrl+Shift+F 仍然有效。 *Where:* 图像编辑器 ▸ 🎨 Artist mode。 *Since:* 2.637.0
- **bitGen Default 主题 + Ctrl+Alt+S** — Ctrl+Alt+S 可在任意位置打开 Settings；Ctrl+Alt+Shift+T、⟲ bitGen Default 或 ?theme=default 会恢复内置默认主题（Dark，无元素样式，界面大小 100 %），↶ The theme before 可撤销此操作；内置主题不能被覆盖或删除。 *Where:* 任意位置；Settings ▸ Themes。 *Since:* 2.636.0
- **全局素材与项目素材** — Assets 面板中的 📁 Project | 🌐 Global | All；项目素材位于 projects/<name>/Assets，全局素材（所有项目可用）位于 projects/Assets；上传的文件进入 Assets；右键点击可选择 🌐 Move to Global / 📁 Move to Project。 *Where:* Assets 面板。 *Since:* 2.635.0
- **选择并删除素材** — 勾选、Ctrl+点击或 Shift+点击图块；删除会把它们移入回收站，绝不会直接永久删除。 *Where:* Assets 面板
- **添加图块** — 虚线框的添加图块会打开文件对话框，用于添加图片、视频或声音，一次可添加多个。 *Where:* References 和 Assets。 *Since:* 2.394.0
- **参考图面板** — 随下一次生成一起发送的图片、视频和声音；可从 Assets 或 Gallery 拖入。 *Where:* References 面板
- **图库** — 所有渲染结果，分为图像、视频和音频标签页；可以从这里拖到参考图、时间线或场景上。 *Where:* Gallery
- **队列** — 显卡上一次只运行一个任务；可以暂停、重新排序、中止和重试，每个任务都有自己的日志。 *Where:* Queue。 *Since:* 2.122.0
- **Pending 与 Done 标签页** — 排队中、运行中和被中断的任务与已完成的任务分开显示，并随项目保存；被中断的任务可以继续。 *Where:* Queue。 *Since:* 2.113.0
- **单张运行卡片** — 正在运行的渲染显示为一张卡片，包含其提示词、模式、尺寸、进度条以及分块 / 步数 / 时间。 *Where:* Queue。 *Since:* 2.400.0
- **清除已完成的任务** — 从列表中移除所有已完成、失败和已取消的任务，但不删除文件。 *Where:* Queue 标题栏
- **中止对话框** — 停止当前渲染、将其放到队列最前面重试，或停止全部任务。 *Where:* Abort 按钮
- **可重用的种子** — 每个已完成任务的详细信息，带有一个按钮，可把它的种子填回 Basic Settings。 *Where:* Queue 的信息按钮。 *Since:* 2.384.0
- **实时 ComfyUI 进度** — 每个视频任务都会显示正在运行哪个节点以及 "step n of total"。 *Where:* Queue、场景卡片和 Generate 按钮

### 文件对话框与另存为

- **bitGen 自己的文件对话框** — 快速访问、应用和项目文件夹、每个驱动器及其可用空间、地址栏、支持通配符的搜索、详细信息或大图标视图、新建文件夹和重命名；在 Windows、macOS 和 Linux 上完全一致。 *Where:* 每个文件夹按钮和 Choose file
- **从图库另存为** — 每个图库图块都有一个另存为图标，会以 Save As 模式打开文件对话框。 *Where:* Gallery 图块
- **快速保存** — 预览对话框中的 Save 会把文件复制到上次另存为的文件夹，不弹出对话框，也绝不覆盖现有文件。 *Where:* 预览对话框

### 截图录屏与远程使用

- **截图** — 把应用窗口或整个屏幕保存到图库。 *Where:* 菜单栏（Alt+Shift+S）
- **屏幕录制** — 把应用或屏幕录制为 H.264 mp4，可录入电脑声音和麦克风，并带倒计时。 *Where:* 菜单栏（Alt+Shift+R）
- **在手机上使用** — 二维码远程链接：手机可以拍照和录像、发送音频并与模型对话；所有内容都会进入项目。 *Where:* Settings > General。 *Since:* 2.132.0
- **音频可视化** — 任何正在播放的声音都会在预览中显示实时可视化效果（频谱、波形、圆环、粒子、语谱图）。 *Where:* Preview。 *Since:* 2.106.0
- **360 度播放器** — 以环视视图观看任意等距柱状投影视频：拖动环顾，滚轮缩放。 *Where:* 播放器的 360 按钮。 *Since:* 2.119.0

### 设置、模型与安装

- **安装程序** — 每个系统一个安装程序，可安装 Node.js、Python、ComfyUI、节点包和模型，并针对你的显卡进行调优。 *Where:* 安装文件。 *Since:* 2.331.0
- **公开测试版仓库** — 带有 README 的源代码、每个版本的更新日志、贡献指南和安全指南、问题模板，以及每次推送时运行的自动测试（scripts/ci-units.sh）；docs/BETA.md 说明哪些功能是实验性的，以及如何报告问题。 *Where:* GitHub 仓库、docs/BETA.md、CHANGELOG.md。 *Since:* 2.477.0
- **模型目录** — 下载各功能所需的模型（视频、图像编辑、放大、3D 模型、Viggle 等），大文件可使用 Hugging Face token 和 Hugging Face CLI 下载。 *Where:* Settings > Models > Model catalog
- **节点包** — 安装 ComfyUI 自定义节点包；任务开始时，缺少的节点会连同其所属节点包一起列出。 *Where:* Setup > Node packs
- **本地 LLM** — 选择模型、启动和停止其服务器、重新扫描文件夹；启动时会自动选中正在运行的模型。 *Where:* Settings > LLM。 *Since:* 2.43.0
- **LLM token** — 实时估算提示词的 token 数，并提供回复预算滑块。 *Where:* LLM tokens 面板（L）。 *Since:* 2.148.0
- **每次生成前释放显存** — 在混合生成图像、音乐和视频时，可避免大多数显存不足的错误。 *Where:* Settings > ComfyUI
- **视频加速器** — 按视频风格启用 Sage attention、Spectrum 和 Comfy Kitchen 加速，一键安装。 *Where:* Settings > ComfyUI 以及视频风格。 *Since:* 2.116.0
- **为任意 ComfyUI 节点图连线** — 加载工作流，将其转换为 API 提示，添加你自己的开关、下拉列表、滑块和文本框，并把它们连接到节点图中的数值。 *Where:* Settings > ComfyUI > Graphs。 *Since:* 2.120.0
- **节点图模式** — 用你创建的控件从 Generate 运行已连线的节点图；其中的加载节点会自动从参考图面板获取内容。 *Where:* Basic Settings > Graph。 *Since:* 2.120.0
- **工作流转换** — 把 UI 工作流转换为 API 提示（展开子图以及 Set / Get 节点），现在使用 ComfyUI 自己的前端完成。 *Where:* Settings > ComfyUI > Graphs。 *Since:* 2.402.1
- **模型文件匹配** — 工作流中指定的模型文件会与你的 ComfyUI 中已有的文件进行匹配，任务日志会注明匹配结果。 *Where:* 每个任务。 *Since:* 2.345.0
- **3D 设置** — 参数化 3D 人体的引擎以及 Unreal Engine 桥接设置。 *Where:* Settings > 3D。 *Since:* 2.471.0

## 生成视频

从单个提示词到整部电影：提示词面板、视频模型、参考图、角色和 StoryBoard。

### 提示词面板与生成

- **一个生成按钮** — 按钮下方的下拉列表决定它生成什么：视频、图像、音乐、语音、已连线的节点图或对话回复。 *Where:* 提示词面板
- **生成、编辑、精修、填充、替换背景、移除** — 在 Image 模式下，菜单栏上的下拉列表决定 Generate 对图像编辑器中的图片做什么，类似 Krita AI 插件；Refine 带有强度滑块，按钮上的文字会随所选项变化。 *Where:* 提示词面板的菜单栏。 *Since:* 2.541.0
- **参考图或图层** — 图像编辑器关闭时，Edit、Refine、Replace background 和 Compose 使用 References 面板中的图片（Fill 和 Remove 不出现在列表中）；图像编辑器打开时，它们使用选中的图层或多个选取的图层；一个标签会显示当前使用的是哪一种。 *Where:* 提示词面板的菜单栏。 *Since:* 2.543.0
- **合成** — 用最多三张图片合成一张图片：可以是在图像编辑器中选取的图层，也可以是 References 面板中的图片。 *Where:* 提示词面板的下拉列表。 *Since:* 2.543.0
- **生成模式** — Ref（参考图片）、F/L（首帧 / 尾帧）、Text 和 Swap。 *Where:* Basic Settings
- **一个提示词生成多个任务** — 单独占一行的 /br/ 会把提示词拆分成多个依次运行的任务。 *Where:* 提示词框
- **按 Enter 优化提示词** — 按 Enter 会把提示词发送给本地 LLM，由它进行改写。 *Where:* 提示词框
- **所有工具共用一个提示词面板** — 图像编辑器的 AI、时间线的 Fill、路径图层、AI 场景、3D 外观、角色、环境和 VR 世界，都从提示词面板获取文字。 *Where:* 按键 P。 *Since:* 2.419.0
- **负面提示词面板** — 画面中不能出现的内容，随每次生成一起发送；其状态会显示所选模型是否使用它，LLM 输出的 "Negative:" 行也会放到这里。 *Where:* 按键 2，或状态栏中的 Negative。 *Since:* 2.419.0
- **快捷提示词** — 以第一行为名称保存提示词，之后可从列表中再次选用。 *Where:* 提示词面板的菜单栏。 *Since:* 2.451.0
- **生成进度** — 按钮上方显示运行中任务的步数，下方显示进度条。 *Where:* Generate 按钮
- **清空提示词** — 只清空提示词框。 *Where:* 提示词面板的标题栏。 *Since:* 2.117.0
- **语音输入** — Speak 通过麦克风录音，并把识别出的文字添加到提示词中。 *Where:* 提示词面板。 *Since:* 2.87.0

### 提示词对话与本地 LLM

- **提示词对话** — 与本地 LLM 一起推敲创意；回复中的提示词会变成可以直接渲染的区块。 *Where:* Prompt chat 面板。 *Since:* 2.85.0
- **保存、加载和清除对话** — 对话以“主题 - 日期”的形式保存，并按从新到旧排列；清除会清空窗口和模型的记忆。 *Where:* Prompt chat。 *Since:* 2.370.0
- **LLM 能看到你的参考图** — 按托盘顺序排列的图片（附带本地视觉模型生成的一行描述）、视频和声音，让它写出带有正确标签的提示词。 *Where:* Prompt chat。 *Since:* 2.354.0
- **针对模型编写提示词** — 选择 LTX 或 Wan 风格后，LLM 会专门为该模型编写提示词。 *Where:* Prompt chat。 *Since:* 2.419.0
- **为 MiniMax H3 调整的语音提示词** — 台词会被转换为 H3 的对白语法，并带上语言和音色；多余的指令会被清理掉。 *Where:* 每次提示词渲染
- **朗读回复** — 用所选声音朗读每条回答。 *Where:* Prompt chat。 *Since:* 2.87.0
- **长篇镜头列表** — 当要求的内容比一个片段更长时，LLM 会编写一份可依次衔接的编号镜头列表。 *Where:* Prompt chat。 *Since:* 2.126.0
- **360 度与立体 VR 提示词** — 当你提出要求时，LLM 会学习等距柱状投影和左右并排立体的提示词规则。 *Where:* Prompt chat。 *Since:* 2.118.0

### 基本设置与视频风格

- **基本设置** — 模式、分辨率、宽高比、秒数、步数、CFG、种子、格式、LoRA、ControlNet 和面部修复。 *Where:* 按键 S
- **种子** — -1 表示随机种子，填入数字则使用该种子，骰子按钮重新随机，另一个按钮可使用上一次的种子。 *Where:* Basic Settings。 *Since:* 2.384.0
- **临时 LoRA** — 在风格自带的 LoRA 之上，为接下来的渲染额外添加的 LoRA。 *Where:* Basic Settings。 *Since:* 2.111.0
- **视频风格卡片** — 所选的视频风格，显示其每个阶段的模型、步数、CFG、编码器、VAE、LoRA 和负面提示词；在卡片上更换模型会保存到该风格中。 *Where:* Basic Settings 顶部。 *Since:* 2.401.0
- **覆盖风格** — 由 Basic Settings 决定所有视频模型（MiniMax H3、Wan、LTX）的步数、CFG、种子、模型和额外 LoRA。 *Where:* Basic Settings。 *Since:* 2.409.0
- **视频风格** — 每种模式保存的一套模型和工作流，对分阶段采样的模型还包含各个阶段；复制一个风格即可保留变体。 *Where:* Settings > Video。 *Since:* 2.110.0

### MiniMax H3

- **三种渲染方式** — 参考图片（最多九张）、首帧 / 尾帧，或仅用文本，均带原生声音。 *Where:* Basic Settings 的模式
- **长片段无缝拼接** — 超过单次运行长度的片段会被拆分后再拼接起来。 *Where:* Seconds
- **长视频：单次运行最长 30 秒** — 低显存注意力和分块前馈让最长 30 秒的 MiniMax H3 片段可以在一次生成中渲染完成，而不必拼接多个 15 秒的片段。 *Where:* StoryBoard 的 ⚙（Long video），或 MiniMax H3 Long (30 s) 视频风格。 *Since:* 2.503.0
- **一键获取更多 ComfyUI 节点包** — 安装或更新 KJNodes、Yusu H3 Unified 和 RH DLSS 5。 *Where:* Settings > ComfyUI > Video accelerators。 *Since:* 2.503.0
- **Veda 稀疏注意力** — 视频风格中可选的 MiniMax H3 加速器（On / Quality）：在其训练尺寸下比标准注意力快约 2-3 倍，可一键安装，其预测器在模型目录中。 *Where:* Settings > Video styles；Settings > ComfyUI > Video accelerators。 *Since:* 2.536.0
- **根据盲测调整的 Veda 与 Spectrum** — Veda 会跳过提示词描述打斗、变形、爆炸或追逐的镜头（这类镜头省时不多，画面还会变软；☑ 动作镜头也使用 Veda 可保留），并取代 Long video 的低显存注意力，而不再被跳过；Spectrum 在 12 步以上的运行中让前 2 步和最后 3 步真实计算，使脸部保持清晰。 *Where:* 设置 ▸ 视频样式 ▸ Veda 稀疏注意力 / Spectrum。 *Since:* 2.717.0
- **可管理数百个模型的模型管理器** — 适应面板大小的分页、文件夹标签页（SDXL、Pony …）、📌 This project 标签页、可调整大小的卡片、每个模型的信息页（含示例图片和提示词），每个模型的 Civitai 详情 + 缩略图 + 示例都保存在一个共享的 model_info 文件夹中。 *Where:* 🧩 Models。 *Since:* 2.537.0
- **Civitai 下载到各类型的文件夹** — 任意 Civitai 卡片上的 ⤓ 会下载到你为该类型选定过一次的文件夹（SDXL LoRA、Pony 模型、Wan LoRA …）；Shift+点击可更改；📁 列出这些文件夹（model_folders.json）；🔄 Sync 为电脑上的每个模型获取 Civitai 详情。 *Where:* 🧩 Models。 *Since:* 2.538.0
- **参考图描述** — 每张参考图片、每个参考视频和声音下方都有一段简短描述，随项目和分组保存，用于映射行、提示词对话和 ✨ Enhance；另有墙 / 地板 / 家具 / 灯光等图片类型。 *Where:* References 面板。 *Since:* 2.539.0
- **图像编辑器中的参考图** — 拖入的参考图会变成一个图层；✨ Edit 可以把参考图用作 Picture 2。 *Where:* 🖼 Image editor。 *Since:* 2.539.0
- **借助参考图让渲染变为写实** — 每个 Blender / Unreal 对象都会与一张参考图片匹配，可按名称匹配或手动指定。首帧由编辑模型借助这些图片变为写实画面，然后由 LTX 2.3 3DREAL 沿着渲染让它动起来。 *Where:* 🟧 Timeline 的 Blender scene / UNREAL ▸ Render to Real，🖼 图像编辑器的 3D 和 Unreal 图层。 *Since:* 2.540.0
- **附加组件** — Settings ▸ Add-ons 列出可选引擎（YuE2 音乐、Viggle native）：每个引擎的用途、需求和大小，以及是否已安装；可执行 ⤓ Install / ⟳ Reinstall / 🗑 Remove，日志显示在该标签页中。 *Where:* Settings ▸ Add-ons。 *Since:* 2.540.4
- **⟳ 重新安装与安装状态** — 任何已安装的内容都会显示 ⟳ Reinstall（已下载的模型显示 ⟳ Download again），点击会重新获取全部内容；安装或下载进行时，其按钮被禁用，旁边的状态显示当前步骤、百分比和秒数，结束后显示 ✓ 或 ✗ 及原因。 *Where:* Settings（Add-ons、Audio、ComfyUI、Models、Extensions）、模型目录、Civitai、LoRA 训练器以及各面板的安装按钮。 *Since:* 2.601.0
- **从 GitHub 更新** — Settings ▸ General ▸ ⟳ Updates：检查 GitHub 上是否有更新的版本（列出新的提交），⤓ Update now（git 克隆的安装会切换到 GitHub 的分支，并备份你修改过的文件；zip 安装则获取有变化的文件），依赖列表有变化时运行 npm / pip，⟳ Restart now；启动后会静默检查一次。 *Where:* Settings ▸ General。 *Since:* 2.540.5
- **整洁的应用文件夹** — 应用文件夹中只有 start.bat（+ package.json、README、LICENSE）；服务器、工作进程、默认设置、安装脚本和说明都位于 misc\ 中；从 zip 更新的安装会在首次启动时清理掉旧的副本（快捷提示词会保留）。 *Where:* 应用文件夹。 *Since:* 2.591.0
- **在侧边面板旁最大化** — ⛶ 填满已打开的 Gallery / Queue / References / Assets / 左侧面板之间的空间。 *Since:* 2.538.0
- **图片类型** — 把参考图片标记为人物、面部、服装、首帧或尾帧；标记首帧会把渲染切换为首帧 / 尾帧模式。 *Where:* References 面板。 *Since:* 2.340.0
- **True CFG** — CFG 大于 1 时会增加一次负向计算，只强化你的提示词所添加的内容。 *Where:* Basic Settings。 *Since:* 2.366.0
- **H3 尺寸** — 选择如何处理介于 H3 的 32 像素步长之间的尺寸：向下取整，或以更大尺寸渲染后再精确裁切回来。 *Where:* StoryBoard 设置。 *Since:* 2.380.0
- **以角色的声音说出带情绪的台词** — 每句台词都带有自己的情绪，并用角色的克隆声音说出；较长的声音片段会被裁剪为 8 秒的样本。 *Where:* StoryBoard 和提示词
- **其他语言** — 在引号内加上语言标签，这句台词就会用该语言说出。 *Where:* 提示词
- **H3_Viggle 风格** — 由一段动作视频驱动动作，由一张图片指定表演者。 *Where:* 视频风格列表。 *Since:* 2.352.0

### LTX 2.5 与 LTX 2.3

- **LTX 2.5 模式** — 文本、图像、首帧 / 尾帧、首帧 / 中间帧 / 尾帧、口型同步、首帧 / 尾帧口型同步、音频转视频以及视频转视频（风格迁移）；Auto 会根据参考图面板中的内容自动选择。 *Where:* LTX 模式下拉列表
- **⏱ 定时提示行（Prompt Relay）** — LTX 提示词中的 `[0-2s] …` 行让片段的每一段时间在同一次渲染中拥有各自的描述，不带时间的行则覆盖整个片段；⏱ 添加下一行。 *Where:* 使用 LTX 风格时的提示词面板、StoryBoard 场景、时间线的 AI 片段（Settings ▸ Add-ons ▸ Nougan Nodes）。 *Since:* 2.592.0
- **过渡 LoRA** — 在画面之间过渡的模式会自动启用它。 *Where:* Transition 下拉列表
- **官方模板** — 文本、图像和首帧 / 尾帧使用 ComfyUI 自己的模板运行，只用内置节点。 *Where:* LTX 2.5 风格。 *Since:* 2.401.5
- **StoryBoard 上的 LTX** — 每张场景卡片决定其模式，可以使用也可以不使用故事板的歌曲。 *Where:* StoryBoard Workflow
- **LTX 2.3 模式** — 文本、图像、首帧 / 尾帧以及 3D 渲染转写实。 *Where:* LTX 2.3 风格。 *Since:* 2.402.0
- **3D 渲染转写实（3DREAL）** — 来自 Blender、游戏或任何 CG 片段的渲染会变成照片级写实画面，同时保持相同的布局和镜头运动；有 strong v2、strong 和 light 三种变体。 *Where:* 带参考视频的 LTX 2.3。 *Since:* 2.402.0

### Wan 2.1 与 Wan 2.2

- **Wan 模式** — 文本、图像转视频、首帧和尾帧，以及角色参考（VACE）。 *Where:* Wan 风格
- **自动构建节点图** — bitGen 用 ComfyUI 自己的节点构建 Wan 节点图，并按名称选取正确的模型文件。 *Where:* Wan 风格
- **24 fps 输出** — Wan 的 16 fps 通过运动插帧提升到 24 fps，以便与你的其他片段衔接；参考图面板中的第一个声音会铺在画面下方。 *Where:* Wan 渲染

### 参考图

- **参考视频与声音** — 参考渲染可各附带最多三个视频和声音；需要时会自动在工作流中添加缺少的插槽。 *Where:* References > Video 和 Sound。 *Since:* 2.353.0
- **选择参考视频的帧** — 循环播放的预览、可缩放的胶片条和选择框；Apply 会精确裁出这些帧。 *Where:* References > Video
- **向后追加 / 向前追加** — 渲染一段新的部分，从视频的最后一帧开始（或在其第一帧结束），再与原视频拼接，始终以首帧 / 尾帧方式进行。 *Where:* 视频的 Use 下拉列表。 *Since:* 2.388.0
- **时间线捕获** — 任意图层上播放头所在的帧都可以成为首帧、尾帧或参考图。 *Where:* 时间线的捕获按钮。 *Since:* 2.117.0
- **Qwen Image 2.1 读取参考图面板** — 图片按顺序发送，并根据其类型在提示词中命名。 *Where:* 图像生成。 *Since:* 2.340.0

### 角色、地点与环境

- **角色** — 名称、详细信息、角色设定图（正面 / 侧面 / 背面）和一段声音片段；它的 @标签 会把设定图和声音带入提示词。 *Where:* StoryBoard > Characters
- **从一张图片创建角色** — 上传一张照片或渲染图，即可生成参考设定图。 *Where:* 从图片新建按钮
- **演员** — 选择当前场景中有哪些角色出场。 *Where:* Actors 按钮
- **服装与身份模型** — 服装条目跟随角色；每个角色都保留一个数据集文件夹，用于身份模型。 *Where:* 角色
- **360 度环境** — 以全景图形式呈现的地点，带有摄像机和场景范围，并投影为平面视图以保持画面连贯。 *Where:* StoryBoard > Environments。 *Since:* 2.142.0

### StoryBoard（场景板）与电影

- **创建剧本** — 描述一个故事，LLM 就会写出各个场景，并让角色说出各自的台词。 *Where:* 提示词面板
- **场景数量** — 输入场景数量，或交由项目、你的要求或 LLM 来决定。 *Where:* StoryBoard
- **每个场景如何衔接** — Ref（新镜头）、First（精确地从上一镜次的某一帧开始）、Cont（该帧加上角色设定图）、Trans（从该帧过渡到新地点）。 *Where:* 每张场景卡片
- **渲染单个场景或所选场景** — 渲染在后台继续进行，你可以同时编辑。 *Where:* 场景的播放按钮、Render selected
- **胶片条** — 点击某个镜次中的一帧，即可将其设为下一个场景的首帧。 *Where:* 每个镜次下方
- **镜次栏** — 观看、保留、重做、更换角色或放大某个镜次。 *Where:* 故事板下方
- **制作首帧** — Qwen Image 2.1 根据角色、地点和道具制作场景的开场画面。 *Where:* 场景的 First / Last 插槽。 *Since:* 2.337.0
- **合成影片** — 按场景顺序把已渲染的镜次拼接成一部影片。 *Where:* StoryBoard 的菜单栏
- **场景下拉列表** — 以下拉列表形式呈现的故事板，带有可显示每个场景状态的场景选择器。 *Where:* StoryBoard。 *Since:* 2.391.1
- **场景进度** — 每张卡片上显示 "rendering step n of total"，并带有进度条和时间。 *Where:* 场景卡片。 *Since:* 2.391.1
- **渲染设置** — 尺寸、步数、LoRA、加速器、放大器和尾帧。 *Where:* StoryBoard 的设置按钮
- **场景种子** — 每个场景随机，或所有场景使用同一个种子；每张卡片都有自己的种子框。 *Where:* StoryBoard 设置。 *Since:* 2.384.0
- **渲染尺寸** — 优先使用 StoryBoard 的设置，否则使用 Basic Settings，再否则使用应用默认值；任务备注会注明使用的是哪一个。 *Where:* StoryBoard
- **StoryBoard 图片** — 用任意图像模型根据每个场景的提示词生成一张图片，并使用角色设定图、地点和参考图；可将其用作首帧或尾帧。 *Where:* StoryBoard 工具栏。 *Since:* 2.456.0
- **生成所有缺失的图片** — 渲染每一张尚未生成的场景图片。 *Where:* StoryBoard 工具栏。 *Since:* 2.456.0
- **信息行** — StoryBoard 的最新消息，鼠标悬停时显示全文。 *Where:* StoryBoard 底部。 *Since:* 2.391.0
- **动作插槽** — 使用 H3_Viggle 时，每个场景可接收一段动作视频。 *Where:* 场景卡片。 *Since:* 2.352.0

### 音乐视频与口型同步

- **加载歌曲** — 歌曲打开后，其波形会自动分段；每段对应一个场景。 *Where:* StoryBoard 的 Audio
- **创建音乐视频** — 编剧把歌曲的各个分段用作场景，并让角色演唱。 *Where:* 提示词面板
- **逐场景口型同步** — 每个场景对自己所对应的那段歌曲进行口型同步。 *Where:* 音乐视频故事板
- **由转录文本决定** — 歌曲带时间戳的转录文本决定哪些场景需要演唱，并把歌词放入提示词。 *Where:* 音乐视频故事板。 *Since:* 2.356.0
- **场景对齐歌曲时间** — 每个镜次都会放到时间线上其对应歌曲部分开始的时间点。 *Where:* Timeline 设置
- **桥接场景** — 歌曲分段之间的短过渡，可由模型渲染，也可绘制为标准转场。 *Where:* 歌曲条的 Transition 选项

### 角色替换

- **替换视频中的角色** — 在现有视频中换上一个新人物；表演、镜头、背景和声音都保持不变。 *Where:* Basic Settings > Swap
- **替换镜次** — 把已渲染场景中的角色替换到它的下一个镜次中。 *Where:* 镜次栏
- **替换对话框** — 适用于整部电影：加载任意长度的视频，自动分段，逐段替换，保留并合成。 *Where:* StoryBoard 的 Swap 按钮
- **替换质量** — Full、Best 或 Fast。 *Where:* Swap 对话框。 *Since:* 2.336.0
- **编写提示词** — 视觉模型和 LLM 根据图片和视频编写替换提示词。 *Where:* Swap 对话框。 *Since:* 2.335.0
- **LTX Ripple 引擎** — 生成一张带有新角色的首帧，并将其贯穿整个片段。 *Where:* Swap 对话框的 Engine。 *Since:* 2.339.0
- **Viggle 引擎** — 通过 ComfyUI 运行的 Viggle-Animate，或 bitGen 自己的原生引擎，后者在各分段之间始终保持模型已加载。 *Where:* Swap 对话框的 Engine。 *Since:* 2.344.0
- **多个首帧** — 每个分段最多生成四个首帧，再从中选择一个。 *Where:* Swap 对话框。 *Since:* 2.348.0
- **安全模式** — 出现黑屏的镜次会在关闭所有可能导致黑屏的选项后重新渲染。 *Where:* Swap 对话框的设置。 *Since:* 2.350.0
- **VR 替换** — 通过虚拟摄像机替换 360 度或 180 度视频中的人物；立体双眼画面根据深度重建。 *Where:* Swap 对话框的 VR 一行

### VR

- **VR 世界** — 把表演者置于 360 度或 180 度图片之中：调整摄像机朝向，添加表演者的图片、声音和提示词，并带 VR 元数据进行渲染。 *Where:* StoryBoard 的 VR World 按钮
- **锁定背景** — 表演者以外的区域，双眼都直接显示图片本身。 *Where:* VR World

### 放大与增强

- **SeedVR2 放大** — 把视频放大到 720p-4K 或按倍数放大，支持颜色匹配、时间分段和降噪。 *Where:* 预览栏。 *Since:* 2.400.0
- **⏫ 图片的 Enhance** — 点击一张图片（图库的 Images、Image 素材、参考面板），⏫ Enhance 就会放大它：×2–×4 或短边 1080–2160 px，可用 SeedVR2（恢复细节）、ComfyUI 的 models/upscale_models 中的放大模型，或不需要 ComfyUI 的 Lanczos；结果是图库中的 PNG。 *Where:* 提示词面板的 ⏫ Enhance。 *Since:* 2.733.0
- **DLSS 5 增强、放大与帧生成** — 对视频进行 NVIDIA DLSS 5 神经渲染（default / natural / cinematic），放大到 1x DLAA、1.5x-3x 或 1K-8K，并可选用帧生成，最高可达原帧率的 6 倍；仅限 RTX 显卡。 *Where:* 预览栏的 ⚡ DLSS 5，以及故事板上 StoryBoard 的 ⚙ Upscaler。 *Since:* 2.504.0
- **RTX VFX 视频精修** — 对视频进行 NVIDIA RTX Video Super Resolution 处理，可选先进行一遍 Deblur，再进行一遍 High Bitrate（预设 A：VSR；预设 B：先 Deblur，再 High Bitrate；或自行选择处理步骤），缩放 1x-4x，每次处理一批帧；适用于 Windows 上的 RTX 显卡，通过 DENO ComfyUI 节点实现。 *Where:* 预览栏的 ✨ RTX VFX、StoryBoard 的 ⚙ Upscaler，以及用于安装的 Settings > ComfyUI > Video accelerators。 *Since:* 2.708.0
- **RelayVSR 放大** — 在 ComfyUI 自带节点中运行的一步视频放大器：x2（用 MiniMax H3 片段训练）或 x4，auto 会选择能达到所选尺寸的那一对；正好 1920 × 1080（先覆盖再裁切）或任意尺寸，保留原来的声音。 *Where:* 预览栏的 🔁 RelayVSR、StoryBoard 的 ⚙ Upscaler，文件在 Settings > Add-ons > RelayVSR。 *Since:* 2.728.0
- **🕺 从视频获取动作（FlowHMR）** — 把视频中的人物捕捉为 3D 动作：带动画的骨架（.fbx）和 SMPL-H（.npz）存入项目的 models3d，可用于时间线的 3D 图层、Blender、Daz 和 Unreal；支持移动或固定镜头。仅限非商业用途（SMPL-H 人体模型以及 Meta 的 SAM 3D Body / VGGT-Omega 许可证）。 *Where:* 预览栏的 🕺 动作，以及 Settings > Add-ons > FlowHMR 动作捕捉。 *Since:* 2.730.0
- **MiniMax H3 的 16 GB 模式** — 在你的 H3 渲染中使用 DENO 的 R2V Turbo 8+2 方案：采样前卸载文本编码器，第一遍以你设定的尺寸运行 8 步，然后进行潜空间放大（×1.0-2.0），再用稀疏注意力进行 2 步精修，并保留声音；Auto 会为显存 16 GB 或以下的显卡自动开启，ComfyUI 缺少的部分会被省略并附上说明。 *Where:* Settings > ComfyUI > 16 GB mode；所需文件位于 Settings > Add-ons > 16 GB mode。 *Since:* 2.708.0
- **💬 bitGen 社区** — 类似 Facebook 的小型聊天面板：用用户 ID 加入，在共享的 Help 聊天室中提问，添加好友（需对方先接受），私聊，举报 / 屏蔽，管理员可以删除消息和封禁用户；服务器为 PHP + MariaDB（仓库中的 community/）。它是一个独立的浮动面板（可浮动 / 停靠 / 作为标签页放入其他面板，位置会被记住 - 2.711.0）。 *Where:* 状态栏的 💬 Community。 *Since:* 2.710.0
- **社区：姓名 + 已验证的邮箱** — 加入时需要填写名字、姓氏和电子邮件地址（只有管理员能看到）；系统会向该地址发送一个 6 位验证码，确认之后才会开放 Help 聊天室（可以 Send a new code，或更改地址）；封禁也会同时封禁该邮箱地址，因此被封禁的成员无法以新的用户 ID 重新加入；老成员会在下次登录时被要求补充这些信息。 *Where:* 💬 Community ▸ Join，⋯ ▸ Your details。 *Since:* 2.713.0
- **讨论区** — tigerart.com.au 上的论坛，与 💬 Community 使用同一个账户：Help / Show your work / Ideas / General；成员发帖立即显示，访客可以阅读和发帖（访客的帖子需先经管理员批准）；管理员可以批准、拒绝、删除和封禁，并能看到真实姓名。 *Where:* 💬 Community ▸ ⋯ ▸ Discussions，或 tigerart.com.au/discussions.php。 *Since:* 2.713.0
- **增强所选视频** — 为你最后点击的视频打开放大器。 *Where:* 提示词面板。 *Since:* 2.401.0
- **在故事板上放大** — 把你满意的镜次送入 StoryBoard 的放大器，或以放大分辨率使用 SeedVR2 处理；也可以选择放大每一次渲染。 *Where:* StoryBoard 设置

### 音效（SFX 面板）

- **添加声音和视频** — 音频文件以及视频文件中的声音，以 48 kHz WAV 格式保存。 *Where:* SFX 面板
- **剪辑声音** — 在波形上选择，设置固定时长框，保留或删除所选部分（带无爆音的淡入淡出），可撤销。 *Where:* SFX 面板
- **单个图层上的范围** — 把位置标记放在起点，在图层上 Shift+点击终点：即得到该图层上的范围；✂ Cut 只从该图层中删除整个范围，↶ / Ctrl+Z 可撤销。 *Where:* 时间线的图层。 *Since:* 2.603.0
- **时间线撤销 / 重做** — 对时间线的每次编辑都是一个步骤：使用其菜单栏中的 ↶ / ↷，或在图层上按 Ctrl+Z / Ctrl+Shift+Z。 *Where:* 时间线。 *Since:* 2.603.0
- **发送到图库和素材** — 每次剪辑的结果都会复制到图库；也可以将其发送到 Sound 素材。 *Where:* SFX 面板
- **语音与对白** — 由 OmniVoice 或 Ming-3.0 TTS 朗读输入、粘贴或由 LLM 编写的文字，可以只用一个声音，也可以是一组角色（按 "Name (emotion): line" 为每位说话者指定声音和情绪），支持声音标签和停顿；保存为 WAV 或 MP3，放入 Audio 素材。 *Where:* SFX 面板 ▸ 🗣 Speech & dialog。 *Since:* 2.621.0
- **带情绪的语音** — 中性、开心、悲伤、愤怒、恐惧、厌恶、惊讶：使用 Ming-3.0 TTS 的情绪任务（克隆声音同样适用）；使用 OmniVoice 时，则通过语速、以该情绪录制的声音（"Name.happy"）和声音标签来表现。 *Where:* SFX 面板 ▸ 🗣 Speech & dialog。 *Since:* 2.621.0
- **语音文件中的元数据** — 标题、日期和时间、描述、文本以及所用的声音会写入 WAV（INFO）或 MP3（ID3）。 *Where:* SFX 面板 ▸ 🗣 Read & save。 *Since:* 2.621.0

## 图像

根据文字和参考图生成静态图片，支持 ControlNet 引导、面部修复和 AI 编辑。

### 图像生成

- **图像风格** — FLUX.2 Klein、SDXL、Pony、Illustrious、Z-Image、Qwen Image 等，每种风格都是一套已保存的工作流、模型组合和 LoRA 堆叠。 *Where:* Settings > Image. *Since:* 2.66.0
- **自动启动 ComfyUI** — ComfyUI 未运行时，Generate Image 会自动启动它。 *Where:* Generate. *Since:* 2.73.0
- **来自 ComfyUI 的模型下拉列表** — 模型、VAE、编码器和 LoRA 字段只列出 ComfyUI 实际能加载的文件。 *Where:* Settings > Image. *Since:* 2.71.0
- **一次生成多张** — 每按一次最多生成八张图片。 *Where:* Generate
- **🩹 修复 / 还原照片** — 一个按钮即可把提示词面板切换为 🖼 Image + ✏ Edit，并在提示词中填入修复指令（修复划痕、灰尘、污渍、褪色、噪点和模糊，保留人物、面部和构图）；提示会说明 Edit 使用的是哪张图片（References 面板中的图片，或图像编辑器的图层）；Ctrl+点击直接开始修复，Shift+点击则在修复的同时为黑白照片上色（2.655.0）。 *Where:* 提示词面板的左栏. *Since:* 2.654.0
- **图像编辑风格** — 根据最多三张参考图编辑图片（FLUX.2 Klein edit），使用 Qwen Image 2.1 edit 时可用更多参考图。 *Where:* 图像模式下的 Generate. *Since:* 2.69.0
- **FLUX 3 Image Klein** — Black Forest Labs 的 5.6B 开放模型，提供三种风格：distilled（快速）、base（cfg 3.5）和 edit（最多 4 张参考图）；参考图面板中有图片时，文生图风格会自动切换到编辑图。 *Where:* 图像风格下拉列表；模型在 Settings > Setup 中获取. *Since:* 2.502.0
- **Krea 2** — Krea 的 12B 开放图像模型，提供四种风格：Turbo（8 步）和 Raw（52 步，带负面提示词），各有 safetensors 和 GGUF 两种格式。 *Where:* 图像风格. *Since:* 2.516.0
- **Anima** — CircleStone Labs 的 2B 动漫 / 插画模型，提供两种风格（Aesthetic v1.1、Base v1.0；30 步，cfg 4）。 *Where:* 图像风格. *Since:* 2.517.0
- **队列预设** — Normal / Quiet（夜间）/ Eco / Cool-down / Max performance / Custom：设置 GPU 功耗上限、任务之间的休息时间、显卡过热时等待，以及降频警告。 *Where:* 菜单栏的 ⏱. *Since:* 2.518.0
- **模型管理器** — 以卡片形式展示你的模型和 LoRA（缩略图、评分、发布日期、类型、类别、关键词；悬停时显示说明卡片），选择一个模型和若干 LoRA，用它们覆盖风格，✚ 以某个模型新建风格，✎ 编辑卡片，🔍 在 Civitai 上查找。 *Where:* 状态栏中的 🧩 Models. *Since:* 2.518.0
- **Civitai 下载** — 搜索 civitai.red / civitai.com，并连同卡片直接下载到对应的 ComfyUI 文件夹。 *Where:* Model manager 的 Civitai 选项卡；密钥在 Settings ▸ General 中设置. *Since:* 2.518.0
- **电费** — 每 kWh 的电价：每个任务的 ⚡ 卡片、其 [power] 行以及启动以来的耗电量都会显示费用。 *Where:* Settings ▸ General. *Since:* 2.518.0
- **测试面板** — 某个版本需要做的测试，完成后逐项勾选（很多会自动勾选），可写备注，💾 保存日志以便上传。 *Where:* Settings ▸ General ▸ 🧪 Testing. *Since:* 2.518.0
- **安装程序询问你的硬件** — 安装程序检测不到时，会询问显卡（从列表中选择）、内存和 CPU；“Not right?” 可修改。 *Where:* 安装程序的第一页. *Since:* 2.519.0
- **安装包** — Editor（无 AI）/ + small AI / + mid-size AI / Everything，按你的显卡推荐；安装前即可看到你能使用哪些功能（✓ ~ ✗，可以以后再添加）以及下载量。 *Where:* 安装程序的 Your package 页面；setup-cli --packages. *Since:* 2.519.0
- **每日供电费** — 电费账单上的固定日费用：任务费用按其运行时长计入相应份额。 *Where:* Settings ▸ General ▸ Energy cost. *Since:* 2.519.0
- **LoRA 训练器** — 使用 ai-toolkit（Ostris）以你的图片训练 LoRA：九种基础模型（Z-Image Turbo、FLUX、Qwen-Image、SDXL、SD 1.5、Chroma、Wan 2.1…）、触发词、rank、步数、带描述文字的数据集（或由助手生成描述）、可编辑的 YAML、实时显示步数 / loss / 样图；训练好的 LoRA 连同卡片存入 ComfyUI 的 loras/trained；可将任务导出为 zip。 *Where:* 状态栏的 🎓 LoRA. *Since:* 2.520.0
- **峰谷电价** — 设置峰时电价和峰时时段（星期几 + 时间，也可跨越午夜）；其余时间均为谷时；任务分别统计峰时和谷时耗电量。 *Where:* Settings ▸ General ▸ Energy cost. *Since:* 2.520.0
- **用量日志** — 按天记录每个任务的耗电量、峰时占比、费用和所用远程 GPU；可选时间范围、显示合计、导出 CSV。 *Where:* Settings ▸ General ▸ 📊 Usage…，或点击状态栏中的 ⚡ 数值. *Since:* 2.520.0
- **远程 GPU** — 使用另一台机器上的 ComfyUI、RunPod pod（列出 / 启动 / 停止，以及其代理）或 SSH 隧道；✓ Test；Use it / Use this computer。 *Where:* Settings ▸ Remote generation. *Since:* 2.520.0
- **本机与安装包** — 你的硬件、已安装的安装包、每种安装包可使用的功能；✎ Not right?；⬆ 无需重新安装即可升级到更大的安装包。 *Where:* Settings ▸ Models. *Since:* 2.520.0
- **分组下载** — 每个模型组一个复选框，并显示其文件数量和大小。 *Where:* 安装程序的模型页面；Settings ▸ Models ▸ Model downloads. *Since:* 2.520.0
- **检查点微调** — 使用 ai-toolkit 训练图像模型（Lumina 2、Flex.1、FLUX.2 klein、SDXL）的全部权重，通过参数交换降低显存占用；结果合并为 diffusion_models/trained 中的一个 .safetensors 文件。 *Where:* 🎓 LoRA ▸ Type. *Since:* 2.521.0
- **LLM 微调** — 使用 Unsloth 以你自己的对话训练助手（Qwen3.5 0.8B-9B、Gemma 4、Qwen3.8 27B；LoRA / QLoRA / 全量）；示例可手动输入或导入（JSONL / JSON / CSV）；输出为 LLM 文件夹中的 .gguf。 *Where:* 🎓 LoRA ▸ Type. *Since:* 2.521.0
- **视觉模型微调** — 以图片 + 回答训练视觉模型（Qwen3.5 / Gemma 4 vision）；输出 .gguf 和 mmproj 到视觉模型文件夹。 *Where:* 🎓 LoRA ▸ Type. *Since:* 2.521.0
- **融合 LoRA** — 将训练好的 LoRA 合并到其基础模型中，生成新的检查点（ComfyUI），任何显卡均可。 *Where:* 🎓 LoRA ▸ Run & samples. *Since:* 2.521.0
- **FLUX.2 klein LoRA** — 可将 FLUX.2 klein base 4B 用作 LoRA 的基础模型。 *Where:* 🎓 LoRA ▸ Base model. *Since:* 2.521.0
- **错误报告** — Ctrl+Alt+Shift+B：窗口截图（可用 ✏ / ▭ 标注）、标题、严重程度、出现位置、发生了什么 / 预期结果、操作步骤（⤵ 录制的点击和按键——绝不记录输入的文字），并附带日志、系统 + 设置（隐藏密钥）、页面错误和失败的请求；💾 保存为一个 .zip 以便发送；以前的报告可 ⤓ / 🗑。 *Where:* 任意位置（Ctrl+Alt+Shift+B）；Settings ▸ General ▸ 🐞 Report a bug…. *Since:* 2.522.0
- **向社区发送错误报告** — 📤 Save and send 将报告发布到网站的 Discussions ▸ Bug reports 下：已登录 💬 Community 时以你的身份发布（立即显示），未登录或勾选 ☑ Send anonymously 时匿名发布（需管理员先审核）；公众可见标题和你写的内容，日志、设置、系统信息和截图仅管理员可见；管理员可设置其状态，并将所有错误下载为一份列表。 *Where:* 🐞 Bug report ▸ 📤 Save and send；Earlier reports ▸ 📤. *Since:* 2.714.0
- **加载器跟随模型文件** — 风格的 .safetensors 或 .gguf 模型会自动使用匹配的 ComfyUI 加载器（Load Diffusion Model / GGUF 加载器）——GGUF 风格也能渲染 .safetensors 微调模型，反之亦然。 *Where:* 每个图像风格. *Since:* 2.523.0
- **无论模型在哪个 ComfyUI 文件夹中都能找到** — 风格的扩散模型如果放在 models/checkpoints（或其他子文件夹）中，会通过 Load Checkpoint / ComfyUI 列出的名称加载，而不会报错 "Value not in list"；不在任何文件夹中的模型会给出提示，说明应放在哪里。 *Where:* 每个图像、视频和音乐任务. *Since:* 2.525.0
- **工作区** — 菜单栏中的 Workspace 下拉列表：Basic、Image editing、Video editing、Music video、Expert。每个工作区显示该类工作所需的面板，隐藏用不到的按钮（不会禁用任何功能），并记住你自己的改动；↺ 可重置某个工作区。 *Where:* 菜单栏. *Since:* 2.526.0
- **🩺 风格诊断** — 一键用每种图像风格生成一张小测试图（Quick：512 × 512，4 步；或 Real），并显示通过 / 失败表格：失败的日志行及处理方法（ComfyUI 未列出的模型及其应放入的文件夹、缺少的节点包、ComfyUI 未运行、显存不足、文件损坏、文本编码器不匹配）。■ 停止，↻ 重测单项，⤓ 将报告导出为 .md。 *Where:* 菜单栏中的 🩺. *Since:* 2.527.0
- **🔍 查找任何内容（Ctrl+K）** — 命令面板，覆盖所有面板、浮动窗口、菜单 / 状态栏按钮、Settings 字段、工作区、Generate 模式、风格、指南章节和快捷键；按 Enter 即显示 / 打开 / 执行，指南会在 📖 Help 窗口中打开。 *Where:* Ctrl+K 或菜单栏中的 🔍. *Since:* 2.530.0
- **每个模型文件都能在 ComfyUI 列出的位置找到** — 位于其他子文件夹中的文本编码器、VAE、LoRA 和 ControlNet 会以 ComfyUI 中的名称使用；完全不在任何文件夹中的文件，会给出可下载它的模型目录条目名称。 *Where:* 每个任务；🩺 Style doctor. *Since:* 2.531.0
- **自动勾选的测试** — 🧪 测试列表中凡是应用检测到已正常工作的项目都会被勾选并保留（auto ✓），重启后依然有效。 *Where:* Settings -> General -> 🧪 Testing. *Since:* 2.532.0
- **▁ ⛶ ✕ 面板标题栏** — 将浮动面板最小化为标题栏、最大化到整个窗口并可还原，或将其关闭。 *Where:* 每个浮动面板. *Since:* 2.532.0
- **📷 让相机在房屋中漫游** — 在平面图上拖动相机，3D 视图会透过它观察；方向键使其转向和俯仰，Shift / Alt 使其升高和降低。 *Where:* 🏠 House. *Since:* 2.532.0
- **🧪 测试模式** — 根据你当前所在位置推荐下一项测试（图像编辑器：模糊、画笔、橡皮擦……），应用检测到某项测试正常工作时询问 'Did it work?' 并提供建议框，将你的回答和建议记录在日志中；关闭后不会自动勾选也不会弹出任何内容。 *Where:* Settings -> General；🧪 Testing 面板. *Since:* 2.534.0
- **新渲染加入已打开的预览** — 预览打开期间完成的图片会加入其缩略图条；✨ N new 可跳转到新图片。 *Where:* 图片 / 视频预览. *Since:* 2.534.0
- **编辑图像模式只显示编辑风格** — 图像编辑器打开时，图像风格下拉列表只列出能够编辑图片的风格，关闭编辑器后恢复你原来的选择。 *Where:* 提示词面板. *Since:* 2.502.0

### ControlNet 与面部修复

- **ControlNet** — 先渲染第一张图片，将其转换为控制图（线稿、深度、姿态），再用第二个模型渲染最终图片。 *Where:* Basic Settings
- **ControlNet 链式风格** — 按名称保存的两阶段风格。 *Where:* Settings > ControlNet. *Since:* 2.97.0
- **面部修复** — 重新绘制最终图片中的每一张脸；自 2.593.0 起为附加组件（在 Settings ▸ General 中开启，其模型会自动下载）。 *Where:* Basic Settings
- **工作室中的附加组件** — 在 Settings ▸ General 中开启或关闭 Face fix 和 ControlNet：关闭 = 隐藏且从不使用；开启 = 显示，且缺少的内容（节点包、模型）会自动下载到对应的 ComfyUI 文件夹——每次启动时也会检查；它们的 Add-ons 卡片列出了所有下载链接。 *Where:* Settings ▸ General / Settings ▸ Add-ons. *Since:* 2.593.0

### 将图片送入图像编辑器

- **生成的图片直接放到画布上** — 图像编辑器打开时，Generate 生成的每张图片都会作为新图层放到最前面的文档中。 *Where:* 提示词面板. *Since:* 2.431.0
- **由图片生成 3D 模型** — Gallery 和 Assets 中的每张图片都可以变成 3D 模型（Hunyuan3D 2.1 或 TRELLIS.2）。 *Where:* 每张图片上的 3D 按钮. *Since:* 2.404.0
- **🧊 转换为 3D（右键）** — 右键点击 Gallery、Assets 或 References 中的图片，或图像编辑器的画布（整张图片或所选图层，也可用 Layer ▸ Convert Layer to 3D），选择 Hunyuan3D 2.1 或 TRELLIS.2 以及模型的去向：图像编辑器（一个可环绕查看、渲染并据此生成内容的 3D 图层）、SolidCraft 面板，或仅放入项目的 3D 模型中。 *Where:* 右键点击图片. *Since:* 2.594.0

## 音乐、人声与声音

歌曲、分轨、人声及其中的歌词。

### 音乐

- **根据歌词和风格生成歌曲** — 使用 MiniMax Music3 或 YuE2，每按一次最多生成四首歌曲。 *Where:* Music 面板. *Since:* 2.90.0
- **音乐风格** — 可重复使用的描述（曲风、BPM、调性、情绪、嗓音），附带其工作流和设置。 *Where:* Settings > Music
- **翻唱和乐谱** — 在 Music 面板中制作。 *Where:* Music 面板
- **🎼 五线谱上的乐谱，可存为 PDF** — 把乐谱画成真正的五线谱（谱号、调号和拍号、音符、符杠、休止符、变音记号、延音线、和弦名称、歌曲段落），可全尺寸阅读项目中或这台电脑上的任何 .abc，并保存为 A4 的 PDF 放进项目的 pdf 文件夹；由 bitGen Studio 自己绘制，不用外部库。 *Where:* Music 面板的 🎼 Sheet Music 标签页。 *Since:* 2.731.0
- **🎨 乐谱的纸张** — 任意纸张颜色、铺满整页的材质（羊皮纸、亚麻、条纹纸、再生纸、水彩纸、画布、牛皮纸）或项目中/这台电脑上的图片，平铺大小和强度，以及墨色（自动：浅色纸用深色，深色纸用浅色）；屏幕上和保存的 PDF 里都一样，也可保存为白底 PDF 便于打印。 *Where:* Music 面板的 🎼 Sheet Music 标签页 ▸ 🎨 Paper。 *Since:* 2.732.0
- **▶ 播放乐谱** — 播放／暂停、后退一小节、回到开头、前进一小节、到结尾；正在发声的音符会亮起，小节会被标出，乐谱自动跟随，点击音符即跳到那里；播放乐谱旁边的歌曲（带用于前奏的 Sync），或由浏览器演奏写出的音符。 *Where:* Music 面板的 🎼 Sheet Music 标签页及其 ⛶ Read。 *Since:* 2.733.0
- **🗣 乐谱下方的歌词** — 勾选后，Song 标签页的歌词会放在人声谱表下方，每个音符一个音节并带连字符，按段落对应（[verse] / [chorus]），重复的副歌再唱一次；编辑时自动重画；⛶ Read 和 PDF 中也有。 *Where:* Music 面板的 🎼 Sheet Music 标签页 ▸ words。 *Since:* 2.734.0
- **✨ 唱到的歌词会亮起** — 乐谱播放时，正在唱的音节会和它的音符一起在人声谱表下方亮起，延音线和连线期间保持亮着，休止符时熄灭；点击歌词即从那里播放；⛶ Read 中也会亮。 *Where:* Music 面板的 🎼 Sheet Music 标签页 ▸ words + ▶。 *Since:* 2.735.0
- **🎼 声部与混音** — 总谱一个标签，每个谱表各一个标签：每种乐器和人声都有单独的乐谱（带声部名，人声声部带歌词），可阅读并存为 PDF；播放时，用音符播放可逐个谱表开关（Shift+点击 = 只听这一个），用歌曲播放则在分离后可开关 Vocals / Instruments（✂ Separate vocals）。 *Where:* Music 面板的 🎼 Sheet Music 标签页。 *Since:* 2.737.0
- **🎚 按图层播放歌曲** — 乐谱播放真正的歌曲（项目中的任何歌曲，自动找到或按乐谱选择并记住），分成 Vocals、Drums、Bass 和 Other（✂ Split into layers，在这台电脑上用 demucs），每个图层一条轨道，带波形、播放位置、开关（Shift+点击 = 只听这一个）和点击播放；没有歌曲的乐谱用柔和的钢琴声播放音符。 *Where:* Music 面板的 🎼 Sheet Music 标签页。 *Since:* 2.738.0
- **✨ Create** — 一键把歌曲（项目中的或这台电脑上的）变成四个图层及其波形、歌词（Song 标签页的，或从人声中听出）以及音符下方带歌词的乐谱，并按图层播放这首歌。 *Where:* Music 面板的 🎼 Sheet Music 标签页 ▸ Song + ✨ Create。 *Since:* 2.739.0
- **⬇ 缺少的组件就地下载** — 尚未安装的组件（歌曲分离、语音转文字）会在带大小说明的 ⬇ Download / Cancel 框中询问；Download 会带进度条安装，任务随后自动继续。 *Where:* ✨ Create、✂ Split into layers、Stems 面板的 Separate。 *Since:* 2.740.0
- **🎶 ACE-Step 1.5 歌曲** — 快速的音乐模型（8 步，MIT 许可证）：从文字和歌词生成带人声的歌曲，10 秒到 10 分钟，50 多种语言；风格可设置 BPM、调、每小节拍数和语言，并可使用 LoRA。 *Where:* Music 面板（风格 ACE-Step 1.5）；设置 ▸ 音频 ▸ 音乐风格。 *Since:* 2.741.0
- **🗂 基本设置的每个选项卡保留自己的设置** — Ref、F/L、Text 和 Swap 各自记住格式、尺寸、秒数、步数、CFG、种子和模型；离开选项卡时保存，回来时恢复（重启后仍保留）；Character chain 保留未保存的输入。 *Where:* 基本设置。 *Since:* 2.742.0
- **☁ RunPod Serverless 渲染** — 所有渲染都发送到 RunPod Serverless 端点（RunPod 的 ComfyUI 工作器，模型在网络卷上），只在工作器运行时计费；图片、视频和歌曲都会传回；✓ 测试显示工作器和任务。 *Where:* 设置 ▸ 远程 GPU ▸ RunPod Serverless。 *Since:* 2.743.0
- **☁ RunPod Serverless 只显示能渲染的风格** — 用 RunPod Serverless 端点渲染时，图片、视频和音乐的风格列表会隐藏它无法渲染的风格（逐个节点对照端点镜像里的 ComfyUI）；可以设置更新的 ComfyUI 或额外的节点包。 *Where:* 风格列表；设置 ▸ 远程 GPU ▸ RunPod Serverless。 *Since:* 2.744.0
- **🖥 基本设置 ▸ GPU：远程、本地或两者** — 所有任务在远程 GPU 上、全部在这里，或“两者”：勾选的 LLM、视觉 LLM、图片和视频 + 歌曲发送到远程 GPU；LLM 在 RunPod vLLM 端点上运行（设置 ▸ 远程 GPU ▸ LLM on RunPod）。 *Where:* 基本设置 ▸ GPU。 *Since:* 2.745.0
- **🏷 远程风格** — 每个图片、视频和音乐风格在这台电脑或远程 GPU 上运行（运行于，可选为风格指定自己的 RunPod 端点；远程风格的名称以 R_ 开头）；基本设置 ▸ GPU 为本地时列出这台电脑的风格，远程时列出 R_ 风格，两者时列出全部 - 选两者时由风格决定在哪里渲染。 *Where:* 设置 ▸ 图片 / 视频 / 音频 ▸ 音乐风格 ▸ 运行于；基本设置 ▸ GPU。 *Since:* 2.746.0
- **🖥 GPU 默认为本地；更新检查很快** — 基本设置 ▸ GPU 从本地开始，位于基本设置第一项并收起（标题显示选择）；更新检查只向 GitHub 询问最新提交，任何网络都能几秒完成，立即更新 在后台下载。 *Where:* 基本设置 ▸ GPU；设置 ▸ 常规 ▸ 更新。 *Since:* 2.747.0
- **🔑 API 密钥加密保存，更新后仍在** — Hugging Face、Civitai 和 RunPod 密钥、远程访问密钥以及社区登录保存在 settings/keys.json 中，每个单独加密（AES-256-GCM，由 settings/keys.master 打开）；更新和恢复默认值都不会动它们；custom.settings 不保存任何密钥。 *Where:* bitGen 文件夹中的 settings/（设置 ▸ 常规 中显示）。 *Since:* 2.748.0
- **☁ 为 RunPod 准备的现成远程风格** — R_SDXL（+ img2img）、R_FLUX.1 schnell / dev / dev fp8、R_SD3 Medium 和 R_Z-Image Turbo，各自对应 RunPod 的一个标准 worker-comfyui 镜像（无需上传）；工作室向 RunPod 询问端点的镜像并只列出适合的风格；日志说明任务在哪里渲染以及在那里的大致费用。 *Where:* 基本设置 ▸ GPU 远程 / 两者；设置 ▸ 远程 GPU ▸ RunPod Serverless ▸ 端点的镜像。 *Since:* 2.749.0
- **🧠 OpenRouter 上的 LLM（免费模型）+“远程生成”** — 剧本写作、提示词辅助和图片描述可以在 OpenRouter 上运行：一个 API 密钥（加密保存）、免费模型（或显示每百万 token 价格的付费模型）、用于图片的视觉模型、✓ Test；不需要远程 GPU - 图片、视频和歌曲仍在这里渲染。设置中的 Remote GPU 标签页现在叫 Remote generation（远程生成）。 *Where:* Settings ▸ Remote generation ▸ 🧠 LLM ▸ OpenRouter；Basic Settings ▸ GPU 选 Both 并勾选 LLM / Vision LLM。 *Since:* 2.753.0
- **☁ 使用远程生成 + 远程生成停靠窗 + Pod 快捷方式** — 一个复选框开启或关闭远程生成（关闭：一切在这里运行，基本设置 ▸ GPU 隐藏）；从 基本设置 ▸ GPU（而不是状态栏）打开的浮动停靠窗显示任务在哪里运行、你的 RunPod Pod（开始 / 停止 / 使用）以及 Pod 快捷方式：用链接添加的 RunPod 模板，部署 ↗ 会打开已选好该模板的 RunPod。 *Where:* Settings ▸ Remote generation ▸ Use remote generation；Basic Settings ▸ GPU ▸ ☁ Remote generation docker。 *Since:* 2.754.0
- **🖥 PODS 停靠窗 + RunPod 的 Serverless 或 Pod** — 基本设置 ▸ GPU 选择远程服务器（RunPod 或 OpenRouter），RunPod 再选 Serverless 或 Pod；选择 Pod 时，PODS 停靠窗列出 RunPod 的公开模板（官方 / 已验证 / Community、仅 ComfyUI、搜索），创建 Pod（带 RunPod 实时价格的 GPU、Secure / Community 云、磁盘大小、每小时估算），并可开始、停止、使用或终止你的 Pod（🅱 = bitGen 的）。 *Where:* Basic Settings ▸ GPU ▸ Remote servers；Basic Settings ▸ GPU ▸ 🖥 PODS。 *Since:* 2.756.0
- **🃏 每个 RunPod 模板都是一张卡片** — PODS 停靠窗一次列出 RunPod 的全部公开模板（全部 / 官方 / 已验证 / 社区，各带数量），每个模板一张卡片（带首字母的色块、NVIDIA / AMD / CPU 和 ComfyUI 标记；名称、镜像、分组、磁盘、/workspace 和 Web 端口；创建 Pod… 和 ↗ 其页面），边输入边搜索（每个词：名称、镜像、端口、种类、分组）和种类筛选；“仅 ComfyUI”一开始是关闭的。*Where:* Basic Settings ▸ GPU ▸ 🖥 PODS。 *Since:* 2.756.1
- **🔑 设置 ▸ API：在线服务作为 API_ 风格 + LLM** — 添加 OpenRouter、fal.ai、Replicate、OpenAI、Google Gemini、Claude 或 RunningHub 的 API 密钥（根据密钥识别服务），起个名字并勾选“使用”：它的 API_ 风格（服务能生成的图片、视频、歌曲）会出现在风格列表中，并在服务端生成，这台电脑不需要显卡或 ComfyUI；每个风格的模型都可以修改（RunningHub 为工作流 ID），✓ Test 检查密钥，“用作 LLM”把提示词 LLM、字幕和分镜列表发送到该服务（Claude 只用作 LLM）；密钥加密保存。 *Where:* Settings ▸ API；风格的 Runs on ▸ API。 *Since:* 2.757.0
- **🧩 P_ Pod 风格 + Pod 加载进度条** — 基本设置 ▸ GPU 为 RunPod ▸ Pods 时只显示 P_ 风格；在已加载的 Pod 上按 🎨 Styles 会读取它的 ComfyUI，从模型文件（bitGen 为 Qwen Image、Z-Image、Krea 2、FLUX、SDXL 准备的工作流，填入 Pod 的文件）和模板保存的工作流创建 P_ 风格；Override style 为 P_ 风格提供步数、种子、CFG、尺寸和宽高比（从不提供检查点或 LoRA）；启动中的 Pod 用进度条显示阶段，以及相对上次加载时间的已用时间；你的 Pod 和 Pod 快捷方式（模板卡片上的 ☆、★ Shortcuts - 链接自动填入）在 PODS 停靠窗中。 *Where:* Basic Settings ▸ GPU ▸ 🖥 PODS ▸ My pods ▸ 🎨 Styles；风格的 Runs on ▸ RunPod pod。 *Since:* 2.758.0
- **⬇ 把模型下载到 Pod + 为风格选 Pod** — PODS 停靠窗的 For … 把适合某个 bitGen 风格的模板排在前面（✓ fits），这样创建的 Pod 加载后会自动得到该风格的 P_ 风格；⬇ Models 把风格的文件（或 bitGen 下载列表中的单个文件）下载到 Pod 的 ComfyUI，每个文件一条进度条，通过 Pod 的 Jupyter（bitGen 创建的 Pod 使用 bitGen 自己的密码，或粘贴密码）或 ComfyUI-Manager（只限其列表）；也可以从链接（Civitai、Hugging Face、任何网址）或这台电脑的磁盘放入单个文件。 *Where:* Basic Settings ▸ GPU ▸ 🖥 PODS ▸ For …；My pods ▸ ⬇ Models。 *Since:* 2.759.0
- **🎵 Audio 停靠栏 + 以你的货币显示价格 + 🖥 My pods** — Music、Stems 和 SFX 是同一个 Audio 停靠栏的标签页（状态栏上一个按钮；屏幕上一次只有一个标签页，上次选的会回来）；设置 ▸ General ▸ Currency 把美元价格（RunPod 的 GPU 和 Pod、OpenRouter 的模型、远程 GPU）以 AUD、EUR、GBP、CNY、JPY 等显示，按当天的参考汇率（保存以便离线使用）或你输入的汇率，悬停可见美元；PODS 停靠栏的 🖥 My pods 只显示 Pod，Create pod… 只显示表单，新建的 Pod 出现在 My pods 中。 *Where:* 状态栏 ▸ Audio；设置 ▸ General ▸ Currency；Basic Settings ▸ GPU ▸ 🖥 PODS ▸ 🖥 My pods。 *Since:* 2.760.0
- **🖥 作为条目的 Pod + 它们的费用 + 重新创建 Pod** — My pods 中的每个 Pod 都是一个条目（点名字展开）：Video、LLM、vLLM、Image、Image edit 勾选项，💾 Save（有更改才可用）为勾选的类型创建 Pod 的 P_ 风格，并让 LLM / 描述图片的 LLM 使用 Pod 自己的 OpenAI 兼容服务器；在其 checkpoints / loras 中 📁 New folder，从这台电脑 ➕ Checkpoint 和 ➕ LoRA；Basic Settings ▸ GPU 每分钟显示 Pod 的费用（当前运行、RunPod 今天和本月的账单），📊 Usage 按天记录；P_ 风格保存其 Pod 的配方（模板、GPU、大小、文件）——用它渲染时会启动已停止的 Pod 或创建新 Pod 并把文件放回（从这台电脑，否则从链接）。 *Where:* Basic Settings ▸ GPU ▸ 🖥 PODS ▸ 🖥 My pods；Basic Settings ▸ GPU（💲）。 *Since:* 2.761.0
- **🧩 每个 Pod 一个检查点——Pod 就成为这个风格** — Pod 的 Checkpoint 和 LoRAs 使用 Basic Settings 的 Override 下拉框（这台电脑的 ComfyUI 模型）；💾 Save 用 bitGen 为该模型系列准备的工作流（Krea 用 Krea 工作流）创建 P_<Pod>，Pod 上已有就直接选用，否则在后台发送一次到相同的子文件夹；Override style 开启且选中 P_ 风格时，Basic Settings 的检查点会在渲染前发送到 Pod 并在那里使用。 *Where:* Basic Settings ▸ GPU ▸ 🖥 PODS ▸ 🖥 My pods ▸ 某个 Pod；Basic Settings ▸ Override style ▸ Checkpoint。 *Since:* 2.762.0
- **🧩 你的风格在你的 Pod 上** — 不再生成 P_ 副本：在 RunPod Pods 上显示你自己的风格，每个都在一个 Pod 上渲染 - 先是风格自己的 Pod（Pod 的 Styles：Generate 模式风格的下拉列表，或 All），再是为该类型勾选的 Pod（Image、Image edit、Video - 每种类型一个 Pod，或全部放在一个 Pod 上），再是正在使用的 Pod；💾 Save 在 Pod 上把它们准备好（目录中的文件由 Pod 自己下载，其余从这台电脑发送，缺少的节点包通过它的 Jupyter 安装并重启 ComfyUI）；没有 Pod 的风格在渲染前询问：用 RunPod 的 ComfyUI CUDA 13 模板创建 Pod（Secure / Community、⭐ 显存足够的最便宜 GPU、每小时价格、磁盘），或使用你的某个 Pod - 然后建立关联；已停止的 Pod 会被启动，已不存在的会重新创建。 *Where:* Basic Settings ▸ GPU ▸ 🖥 PODS ▸ 🖥 My pods ▸ Pod ▸ Styles；按 Generate 时的询问框。 *Since:* 2.763.0
- **🖥 你的自定义节点上 Pod + Pod 在做什么** — bitGen 为风格创建的 Pod 会装上这台电脑 ComfyUI 的所有自定义节点包（git 包在 Pod 上按相同版本 clone，其余的以及私有的打成 zip 上传；.disabled 的和 Pod 上已有的保持不动），然后重启它的 ComfyUI（ComfyUI-Manager，否则重启 Pod）；⬆ My custom nodes 可对任何 Pod 这样做；风格缺少的节点来自这台电脑 ComfyUI 指出的节点包；状态栏上方的一行显示等待中的渲染的 Pod 在做什么，无法使用的 Pod 会带着原因停止渲染；在 Both 下有 Pod（自己的或其类型的）的风格会送到那个 Pod。 *Where:* 🖥 PODS ▸ 🖥 My pods ▸ Pod ▸ ⬆ My custom nodes；渲染等待时的状态栏上方。 *Since:* 2.763.1
- **🖥 Pod 渲染不用这台电脑的 ComfyUI** — 送到 RunPod Pod 的渲染会立即发送：不启动这台电脑的 ComfyUI，也不拿风格去对照它的模型列表或下拉列表（文件会放到 Pod 上）；失败的渲染的原因（[pod] / [gpu] / 错误行）会在日志的“that one failed”之后显示。 *Where:* Pod 模式下的 Generate；日志。 *Since:* 2.763.2
- **🖥 没有 Pod 的风格打开 PODS 停靠窗** — 用没有 Pod 的风格按 Generate 会打开 PODS 停靠窗：横幅说明等待中的渲染，创建表单已在 RunPod 的 ComfyUI CUDA 13 模板上打开，风格、其类型、bitGen 推荐的 GPU、GPU 数量和磁盘都已填好（都可以改）；你的 Pod 上有 ▶ Use for <风格>；Cancel the render；Start / Stop / Terminate 照旧。Pod 渲染现在能到达 Pod（worker 向 RunPod 代理报出自己的名字 - 不再 403；https 上也有实时步数）；风格在 Pod 上的下载会等到完成，仍缺少的文件会带着名字停止渲染。 *Where:* 🖥 PODS（按 Generate 时自动打开）。 *Since:* 2.763.3
- **🖥 PODS 停靠窗：Pod 的数据 + 创建前的全部细节** — 每个运行中的 Pod 在名字旁显示 GPU 负载和 GPU 显存的条，打开后显示 GPU、显存、RAM、CPU 和两个磁盘（每几秒更新，来自 Pod 的 Jupyter 或 ComfyUI）；创建表单列出 Pod 的全部内容（模板和镜像、GPU、价格、云、磁盘、CUDA 13 主机、端口、风格、会放上去的东西），并跟随表单变化；停靠窗的风格下拉列表从提示词停靠窗的风格开始；RunPod 上已不存在的 Pod 不会自己重建 - 停靠窗会打开，按旧 Pod 的方式填好；从这台电脑发送的文件不再因 HTTP 400 失败（不再用隐藏的分段文件名）。 *Where:* 🖥 PODS ▸ 🖥 My pods；Create pod…。 *Since:* 2.763.4
- **💲 RunPod 停靠窗 + 你自己的停靠窗里的停靠窗** — 一个独立的停靠窗，显示 RunPod 余额、当前支出和余额还能用多久、支出上限、Pod 的费用（正在运行、今天、本月、每个 Pod）以及 RunPod 的 GPU 价格（Secure / Community、显存、每小时价格、空闲数量；可搜索、排序）；Basic Settings 的 💲 费用行移到了这里；用 ▣ New docker… 创建的停靠窗（浮动的或限定在某个停靠窗内的）可以放入 PODS、💲 RunPod、Basic Settings 等停靠窗口和主停靠窗 - 可以放多个；浮动对话框始终在所有停靠窗前面（限定的停靠窗不再盖住它们）；自定义节点一次打包一个文件，并在日志里显示进度（不含 venv，权重原样存放，上限 2 GB）。 *Where:* Basic Settings ▸ GPU 和 🖥 PODS 里的 💲 RunPod；⊞ Docker configs ▸ ▣ New docker…。 *Since:* 2.763.5
- **📦 Pod 预设 + 一个 Pod 上的多个风格** — Pod 的模板、GPU、GPU 数量、云、磁盘、类型和风格保存为 runpod/pods/presets/<名称>.pod；每个预设是一个条目，带 ▶（已终止的 Pod 会连同所有风格的文件和你的自定义节点重新创建；GPU 没有空闲时可选显存相同或更多的 GPU）、⏹、🗑（终止 Pod，预设保留）和 ✕（删除预设）；所有细节都可编辑，可添加 / 移除风格；加载步骤、每小时费用、已用时数和总费用；用没有 Pod 的风格点 Generate 会打开一个框，列出你的 Pod 和预设，带 ＋ <风格>、Create pod… 和 Cancel render；为风格创建的 Pod 会自动保存为预设，任何 Pod 都可 💾 Save as preset。 *Where:* 🖥 PODS ▸ 📦 Presets；Pod 模式下的 Generate。 *Since:* 2.764.0
- **Basic Settings ▸ GPU 选 Local 时不显示远程内容** — 选 Local 时只显示 Local · Remote · Both 和「Every job runs on this computer.」：Remote servers / RunPod 选项、☁ Remote generation docker、🖥 PODS、💲 RunPod 和 ⚙ Settings ▸ Remote generation 都会隐藏，这些停靠窗也会关闭；尚未设置任何远程时选 Remote 或 Both 会等待并显示这些选项，直到有可渲染的地方；等待 Pod 的渲染会在 Queue 里显示 Pod 正在做什么（而不是「waiting for the GPU」），发送到 Pod 的模型会显示已发送的 GB、百分比、速度和剩余时间。 *Where:* Basic Settings ▸ GPU；Queue。 *Since:* 2.764.1
- **Pod 上只放工作流用到的自定义节点** — Pod 只会得到其风格的工作流用到、而 Pod 上没有的自定义节点包（从这台电脑的 ComfyUI 查找，按相同版本 clone 或上传）- 为风格创建的 Pod、预设的 ▶ 以及加到 Pod 上的风格都是如此；任何 Pod 都可用 ⬆ Nodes its styles need；日志会说明每一步（小包显示 KB、解包、安装第 n / m 个），Pod 3 分钟无法汇报时会带着原因结束这一步。 *Where:* 🖥 PODS ▸ My pods；Presets；Pod 模式下的 Generate。 *Since:* 2.764.2
- **风格的自定义节点来自它们的 git 地址** — 风格需要的节点包会在 Pod 上 clone（用 git 安装的按相同提交；其他的从 bitGen 的节点列表、pyproject.toml、ComfyUI-Manager 的列表或 Comfy Registry 查找，并按其版本标签 clone；位于更大仓库里的包会链接进来）；只有没有地址或 Pod 无法 clone 的包（私有）才会从你的电脑上传，日志会说明原因。 *Where:* Pod 模式 - Generate、预设、⬆ Nodes its styles need。 *Since:* 2.764.3
- **加入社区时说明为什么要邮箱验证码** — 加入表单（💬 Community 和网站）说明使用或下载 bitGen Studio 不需要成为会员 - 只有在社区里交流才需要 - 并说明新会员用 6 位验证码确认邮箱，是为了防止垃圾注册并确认加入的是真实的人。 *Where:* 💬 Community ▸ Join；tigerart.com.au ▸ Account。 *Since:* 2.764.4
- **把停靠窗停靠到另一个停靠窗的上方或下方** — 把浮动停靠窗拖到你的停靠窗（浮动的，或停靠在主列中的 ▣ 停靠窗）里某个停靠窗的上边缘或下边缘附近，两者就会在那里上下堆叠；拖到堆叠上时会放到其中停靠窗之间；拖到侧边或中间则像以前一样并排或作为标签添加；浮动停靠窗总是显示在停靠于停靠窗内的停靠窗前面。 *Where:* 你的任何停靠窗（⊞ Docker configs ▸ ▣ New docker…、▣ 停靠窗）。 *Since:* 2.764.5
- **Pod 下载能完成，受限模型会提示** — Pod 上的下载和节点安装作为独立任务运行，不再停在 0%；下载 Hugging Face 文件前，bitGen 会检查它是否受限或已不存在，并说明是哪个文件以及该怎么做（接受其许可并添加你的 Hugging Face 令牌）；3 分钟没有数据的下载或被 Pod 停止的任务也会提示。 *Where:* PODS ▸ ⬇ Models；渲染的 Pod 备注；日志。 *Since:* 2.764.6
- **把你的检查点和 LoRA 从 Civitai 下载到 Pod** — Pod 需要的本机模型会先在 Civitai 上查找（按其卡片中的版本，否则按只读取一次的 SHA-256），然后由 Pod 用你的 API 密钥从 civitai.com 或 civitai.red 下载完全相同的文件，代替缓慢的上传；只有在 Civitai 上没有或被拒绝时才从本机发送，并说明原因。 *Where:* PODS（风格的模型、Override 风格的检查点、预设）；渲染的 Pod 备注；设置 ▸ General ▸ Civitai。 *Since:* 2.765.0
- **远程模型、勾选的 Pod 和每次传输的进度条** — runpod/pods/remote_models.json 记录你的 Pod 使用的模型及各自的下载链接；在远程模式下，Model manager 和基本设置的 Override 下拉框列出这些模型，而不是本机的模型；勾选 Pod（每个名称左侧的复选框，可多选），⇪ 会把模型发送到所有勾选的 Pod；没有链接的模型只上传一次到你的私有 Hugging Face 仓库（Civitai 上有则用其链接，否则直接发送到 Pod）；每次传输都有自己的进度条。 *Where:* PODS ▸ My pods；Model manager（远程模式）；基本设置 ▸ Override。 *Since:* 2.766.0
- **Model manager 中的 Civitai 筛选** — 全部 / 检查点 / LoRA（以及 VAE、Embedding、ControlNet、Upscaler）、模型系列（来自 Civitai 自己的列表，Krea、Flux、Qwen 等系列的全部基础模型，或只选一个）、排序方式和时间段；更改后立即重新搜索，筛选条件会被保留。 *Where:* Model manager ▸ Civitai。 *Since:* 2.766.1
- **本地 / 远程切换整个应用** — 在基本设置中选择本地：列表和文件夹筛选显示本机的模型文件夹，ComfyUI 未运行时会启动；选择远程（Pod）：停止 bitGen 在本机启动的 ComfyUI，列出远程模型，文件夹筛选改为显示它们的模型系列（Krea、Flux、Pony 等）以供筛选。 *Where:* 基本设置 ▸ GPU；模型下拉框；Model manager。 *Since:* 2.766.2
- **Pod：文件放在 ComfyUI 能看到的位置，旧版 ComfyUI 会被更新** — 文件会放到 Pod 的 ComfyUI 读取的文件夹（包括模板自己的模型文件夹，放错位置的副本会被移动），缺少新版 ComfyUI 内置节点的 Pod 会在渲染前更新 ComfyUI（git pull、requirements、重启）。 *Where:* 渲染的 Pod 备注；PODS。 *Since:* 2.766.3
- **远程模式下的 LLM、Vision LLM 和视频风格** — LLM 和 Vision LLM 各自可在本地、OpenRouter（在基本设置中即可搜索并选择模型；推理开启，每轮都会传回 reasoning_details）或 RunPod（你的 Pod 用 llama.cpp 运行同一个 GGUF，首次发送提示时完成设置）上运行；选择远程后，所选视频风格的模型会立即送到其 Pod。 *Where:* 基本设置 ▸ GPU；设置 ▸ Remote generation ▸ OpenRouter。 *Since:* 2.767.0
- **从聊天中创作歌曲** — 聊天会写出符合所选音乐风格的歌词，并发送到 Music 面板。 *Where:* 提示词聊天. *Since:* 2.92.0
- **歌词文件** — 每首歌曲的歌词都以文本文件形式保存在项目中。 *Where:* 项目的 lyrics 文件夹

### 分轨

- **拆分歌曲** — 人声、鼓、贝斯和其他。 *Where:* Stems 面板

### 人声与语音

- **声音克隆** — 从一段短片段或波形选区克隆声音。 *Where:* Voice / Stems 面板
- **▶ 在声音克隆的波形中播放** — 播放选区，未选择时播放整个片段；■ 停止，波形上显示播放头，点击一下即可清除选区。 *Where:* Settings > Audio > voice clone. *Since:* 2.601.0
- **文字转语音** — 用克隆的声音朗读一句话；可选 OpenAudio 或 OmniVoice（600 多种语言，支持声音设计）。 *Where:* Settings > Audio. *Since:* 2.102.0
- **Ming-3.0 TTS** — 第二个语音引擎（inclusionAI，0.5B，44.1 kHz）：根据片段及其文字稿克隆声音，也可设计声音。从 Settings ▸ Add-ons 安装。 *Where:* Settings > Audio > Speech engine. *Since:* 2.594.0
- **从提示词生成语音** — 在语音模式下使用 Generate。 *Where:* Generate 下拉列表

### 转录与歌词

- **语音转文字** — 从任意声音或视频中转录语音或提取带时间轴的歌词，保存为 .txt、.srt 和 .lrc。 *Where:* 素材托盘. *Since:* 2.38.0
- **本地转录** — faster-whisper 在本机运行，每个文件只转录一次。 *Where:* Settings > Audio
- **Bark 3.0 语音转文字** — Underdog 的 Bark 3.0（163 MB，仅支持英语），用于普通文字稿、声音克隆文字稿、手机遥控和 🎙 语音聊天；歌词、字幕及其他需要时间轴的工作仍使用 faster-whisper。从 Settings ▸ Add-ons 安装。 *Where:* Settings > Audio > Speech-to-text engine. *Since:* 2.594.0
- **WeVisOne-VL 视觉模型** — 腾讯的 WeVisOne-VL（基于 Qwen3-VL）作为提示词面板的视觉模型：它能读取图片中的文字、计数和查找物体，并为 LLM 描述图片内容。可在下拉列表中选择 4B 或 2B；模型会下载到你的视觉模型文件夹。 *Where:* Settings > Add-ons > WeVisOne-VL. *Since:* 2.595.0
- **⟳ 更新 llama.cpp** — 查看已安装的 llama.cpp 版本以及是否有更新版本，并就地更新（LLM 和视觉服务器会先停止；模型和设置保持不变）；进度直接显示在原处。 *Where:* Settings > LLM. *Since:* 2.596.0
- **MP4 · 社交媒体导出** — 生成 Facebook、Instagram 和 TikTok 可直接接受的文件：H.264 High 8-bit、AAC 48 kHz 立体声、恒定帧率、faststart、短边最大 1080、无时间码轨道；编码后进行检查（逐项显示是否合格，9:16 视频超过 90 s 时另有提示）。社交媒体套装可一次生成 9:16 Reels、4:5 信息流、1:1 和 16:9。 *Where:* 时间线的 📤 Export. *Since:* 2.597.0
- **Basic Settings 的 Format 中的 📱 社交媒体选项** — Reels / Stories 9:16、Facebook 信息流 4:5、Square 1:1、Landscape 16:9 或渲染本身的比例：Aspect 随之改变，完成的 MP4 在进入图库之前会处理成适合 Facebook / Instagram / TikTok 的格式（使用 Export 预设的设置并经过检查）。 *Where:* Basic Settings > Format（以及音乐视频的 Format）. *Since:* 2.600.0
- **种子：🎲 随机 / 📌 固定** — 种子旁的一个开关：Random = 每次渲染使用新种子，Fixed = 每次都使用旁边的数字（输入数字或用 ♻ 调用上次使用的种子会切换为 Fixed）。Basic Settings（视频和图像）以及每个风格（图像、视频、音乐）中都有——风格总能以自己的种子渲染。 *Where:* Basic Settings，Settings > Image / Video / Music styles. *Since:* 2.598.0
- **项目重置锁定屏幕** — 项目重置期间，整个窗口会被遮罩覆盖，显示 "Resetting Project..."，带有旋转圆环、跳动的圆点、当前正在进行的操作和已用秒数；遮罩后面的任何内容都无法点击，并且会一直保持到重新加载完成、空项目打开为止（"✓ Project reset"）。 *Where:* ↺ Reset project. *Since:* 2.599.0
- **模型管理器能找到 ComfyUI 已有的内容** — 它会询问正在运行的 ComfyUI 其模型文件夹在哪里、下拉列表里有哪些内容，因此即使模型和 LoRA 不在 Settings 中设置的 ComfyUI 文件夹下（例如桌面版自己的文件夹，或 ComfyUI 命令行指定的 yaml），也能显示出来。 *Where:* 🧩 Models. *Since:* 2.598.0
- **按钮显示正在进行的操作** — Install、Update、Start（随后是 Loading the model）、Stop、Rescan、Scan folder 和 Save 会变成旋转的 "…ing" 并显示秒数，然后显示 ✓ 或 ✗ 及原因。 *Where:* Settings > LLM 和 Save. *Since:* 2.596.0

### 卡拉 OK

- **卡拉 OK 叠加层** — 透明的歌词视频，带有跳动的小球，以及随演唱而变色的歌词行。 *Where:* StoryBoard 的 Karaoke 按钮. *Since:* 2.373.0
- **任意歌曲的卡拉 OK** — 选择一个声音片段或素材，可以是整首歌，也可以是标尺选区。 *Where:* 时间线的 Karaoke 按钮. *Since:* 2.380.0
- **卡拉 OK 样式** — 字体、颜色、描边、阴影、背景条和小球。 *Where:* StoryBoard 和 Timeline settings
- **编辑歌词** — 修正语音转文字听到的歌词，或粘贴真正的歌词。 *Where:* Karaoke 面板. *Since:* 2.408.0
- **歌词与时间** — 每个词都有开始和结束时间，可播放、可修正；修正内容会为该歌曲保留。 *Where:* Karaoke 面板. *Since:* 2.408.0
- **微调词语时间** — 将一个词，或该词及其后所有词，以小幅或较大幅度提前或延后。 *Where:* Words and timing. *Since:* 2.433.0
- **标记处的歌词行** — 正在演唱的行会高亮显示，正在演唱的词更亮。 *Where:* Words and timing. *Since:* 2.433.0
- **Karaoke 面板** — 停靠在预览画布旁边，这样可以一边播放歌曲一边修正；可在画布上显示修正后的歌词。 *Where:* 时间线. *Since:* 2.410.0

## 时间线

完整的视频编辑器：带图层的预览画布、编辑工具、调色、声音、字幕、AI 和 3D。

### 预览画布

- **预览画布** — 左侧为工具栏、右侧为 Layers 面板的画布。 *Where:* 时间线面板. *Since:* 2.377.0
- **拖放添加** — 将视频、图片或声音拖放到画布上；每个都会在位置标记处放到一个新图层上。 *Where:* 预览画布
- **移动工具** — 选择、移动、拖动角点缩放、拖动顶部手柄旋转；按住 Shift 以 15 度为步进或锁定单轴。 *Where:* 按键 V
- **文字工具** — 点击添加文字图层，可设置字体、字号、颜色、粗体、斜体、描边、阴影和对齐方式。 *Where:* 按键 T
- **本机的所有字体** — 每个字体列表在 Common 下列出常用字体，在 This computer (N) 下列出所有已安装字体；仅存在于应用 fonts 文件夹中的字体会从其文件加载。 *Where:* 图像编辑器和时间线的字体列表、字幕、卡拉 OK 样式. *Since:* 2.607.0
- **字体列表中的字体预览** — 每个字体名称都用该字体本身显示（搜索列表也一样）；列表收起时，以所选字体显示其名称。 *Where:* 每个字体列表. *Since:* 2.608.0
- **右键菜单中的 Rasterize Text** — 文字图层（图像编辑器）或时间线中的文字会变成图片；撤销即可恢复文字。 *Where:* 右键点击文字. *Since:* 2.604.0
- **保持对边不动的斜切** — 侧边手柄以对边为基准倾斜（Alt：以中心为基准）；文字斜切后仍是文字。 *Where:* 图像编辑器的移动工具，双击可显示旋转 / 斜切手柄. *Since:* 2.604.0
- **💾 以任意格式保存到 Images** — 可见图层保留为临时副本，合并后（JPEG / BMP 以白色为底）按 💾 旁所选的格式保存到 Images 和 Gallery。 *Where:* 图像编辑器的菜单栏（Ctrl+S）. *Since:* 2.604.0
- **输入时自动贴合，点击处即可编辑** — 正在输入的文字的边框紧贴字母，并随每次按键扩展；指针位于文字上方时显示文字 I 形光标（其他位置显示新建文字光标）；点击即可从所点位置的字母之间开始编辑，自动换行的段落文字也一样。 *Where:* 图像编辑器的 Type 工具（T）. *Since:* 2.602.0
- **抓手与缩放** — 平移、缩放图片以及使图片适合窗口。 *Where:* 按键 H、Z
- **填充选区** — 画一个框或绘制蒙版，然后生成与之融合的图片或视频。 *Where:* 按键 M 和 B，以及 Layers 面板中的 Fill. *Since:* 2.380.0
- **带声音播放** — 所有图层连同声音一起播放；可循环播放标尺选区。 *Where:* 画布下方
- **合成与画布一致** — 移动、缩放和旋转后的图层与文字，会完全按照画布上显示的位置合成。 *Where:* Compile
- **悬停高亮** — 使用移动工具时，指针下方的片段以蓝色轮廓显示，选中的片段以橙色显示。 *Where:* 预览画布. *Since:* 2.470.0

### 图层、片段与位置标记

- **图层** — V1 作为基础画面，另有视频、图片、声音、文字、3D 和 Karaoke 图层。 *Where:* 时间线
- **图层颜色** — 每个图层都有自己的颜色；选中的图层会显示轮廓。 *Where:* 时间线. *Since:* 2.383.0
- **重命名图层** — 双击名称、按 F2 或使用 Name 框。 *Where:* Layers 列表和轨道. *Since:* 2.382.1
- **拖动标记** — 随意移动；双击某个时间即可跳转到该处并播放。 *Where:* 标尺. *Since:* 2.383.0
- **标尺选区** — 选择一段，保留或剪掉它，修剪片段的开头或结尾。 *Where:* 标尺
- **微移片段** — 方向键按帧移动片段，按住 Shift 按秒移动。 *Where:* Timeline settings. *Since:* 2.376.0
- **命名的时间线** — 一个项目可包含多条时间线；可切换、保存和另存为。 *Where:* 时间线工具栏. *Since:* 2.107.0
- **转场** — 59 种转场，在入点和出点处以其形状绘制。 *Where:* 每个图层. *Since:* 2.415.0

### 关键帧

- **关键帧** — 位置、缩放、旋转、不透明度和文字颜色，在画布上和合成中补间过渡。 *Where:* Layers 面板中的 Key 按钮. *Since:* 2.379.0
- **缓动** — 线性、缓入、缓出、缓入缓出或定格。 *Where:* 关键帧菜单
- **图表编辑器** — 数值图表和速度图表，关键帧和贝塞尔手柄均可拖动；一键应用 Easy Ease、线性和定格。 *Where:* Properties 中的 📈 Graph 按钮. *Since:* 2.489.0
- **运动模糊、Posterize Time、Echo** — 模糊图层的运动（快门角度、采样数）、以较低帧率定格显示，或在其后拖出一串副本。 *Where:* 图层 Properties 中的 ⏱ Time. *Since:* 2.500.0
- **曲线式时间重映射** — 选择视频片段每个时刻显示源素材的哪一秒：正放、倒放、冻结、加快或放慢，用曲线上的关键帧控制，并可在播放头处 ◇ Key 和 ❄ Freeze。 *Where:* 视频片段 🎬 Speed 中的 ⏱ Time remap. *Since:* 2.501.0
- **生成器图层：Fractal Noise 与 Gradient Ramp** — 用 🌫 工具点击一下，即可在画面上生成动态分形噪波；拖动一下则生成线性或径向渐变；所有设置均可设关键帧。 *Where:* 时间线画布上的 🌫 工具，图层 Properties 中的 🌫 Generator. *Since:* 2.505.0
- **湍流置换与置换贴图** — 用运动的噪波或另一个图层的画面推动任意图层的像素；合成结果一致，视频图层也包括在内。 *Where:* 图层 Properties 中的 〰 Distort. *Since:* 2.505.0
- **粒子** — 用 🌫 工具 Shift+点击即可创建粒子发射器（点、线或盒形），可设置速度、方向、扩散、重力、风和五种粒子形状；所有设置均可设关键帧，且每次绘制的画面都完全相同。 *Where:* 时间线画布上的 🌫 工具，图层 Properties 中的 🌫 Generator (Particles). *Since:* 2.506.0
- **光线** — 任意图层的明亮部分从某一点向外射出光束，延伸到图层边缘之外；合成时，视频图层会由页面整体烘焙。 *Where:* 图层 Properties 中的 ☀ Light rays. *Since:* 2.506.0
- **操控点** — 在图层上钉上图钉，拖动图钉即可像木偶一样弯曲图层；其他图钉保持不动，图钉还可设关键帧，使图层随时间运动。 *Where:* 时间线画布上的 📌 Puppet 工具（Shift+W），图层 Properties 中的 📌 Warp. *Since:* 2.507.0
- **网格变形** — 在图层上放置最多 8 × 8 个点的网格，拖动这些点即可沿平滑曲线弯曲画面；可设关键帧，合成结果一致，视频图层也包括在内。 *Where:* 图层 Properties 的 📌 Warp 中的 ⌗ Mesh warp. *Since:* 2.507.0
- **音频 → 关键帧** — 将任意属性（不透明度、缩放、位置、旋转、生成器数值）按声音的响度、低音、中音或高音设关键帧，从安静时的数值到响亮时的数值，并精简为真正需要的关键帧。 *Where:* 图层 Properties 中的 ♪ Audio → keys. *Since:* 2.508.0
- **音频波形与频谱图层** — 把声音画出来的图层：播放头附近的波形（波形、线条、柱状）或其频率（柱状、线条、圆形）；所有设置均可设关键帧；可针对一个片段或全部声音。 *Where:* 在时间线画布上用 🌫 工具 Alt+点击 / Alt+Shift+点击. *Since:* 2.508.0
- **表达式中的 audio()** — 任意时刻混音的响度、低音、中音或高音（0..1），可用于任意属性的表达式。 *Where:* 属性上的 ƒx 及其预设. *Since:* 2.508.0
- **运动草图** — 时间线播放时在画布上按住并移动：图层跟随指针移动，其路径变为位置关键帧，并精简为真正需要的关键帧。 *Where:* 时间线画布上的 ✍ 工具（Shift+K），图层 Properties 中的 〰 Motion. *Since:* 2.509.0
- **摇摆器** — 以关键帧形式为任意属性添加随机运动（频率、幅度、平滑或尖锐、位置 x / y 分开、种子），叠加在已有运动之上。 *Where:* 图层 Properties 的 〰 Motion 中的 ≈ Wiggler. *Since:* 2.509.0
- **平滑器** — 在容差范围内对属性的关键帧求平均并精简：关键帧更少，形状不变。 *Where:* 图层 Properties 的 〰 Motion 中的 ⌇ Smoother. *Since:* 2.509.0
- **3D 空间中的 2D 图层** — 任意图层都可以变成具有深度和 x / y 旋转的卡片，由可设关键帧的 3D 相机（位置、朝向、变焦）以透视方式观察，并配有环绕 / 推拉 / 平移工具。 *Where:* 图层 Properties 中的 🧊 3D，🧊 工具（Shift+O）. *Since:* 2.510.0
- **3D 卡片的景深与光照阴影** — 卡片根据与焦点的距离产生模糊，光源会把卡片的形状作为阴影投射到后方的卡片上。 *Where:* 3D 图层 Properties 中的 🎥 3D camera. *Since:* 2.510.0
- **可变蒙版羽化** — 每个蒙版点都可以有自己的羽化值（用 Mask Pen 按住 Shift 拖动该点）；边缘在各点之间平滑过渡，动画路径也一样。 *Where:* 时间线画布上的 ✒ Mask Pen，Properties 中的 ✒ Masks. *Since:* 2.511.0
- **数据驱动动画** — 将 CSV 或 JSON 导入为带当前行的数据集；文字中使用 {{set.column}}，表达式中使用 data()，还可将某一列逐行设为任意属性的关键帧。 *Where:* 图层 Properties 中的 📋 Data & fields. *Since:* 2.511.0
- **公开的模板字段** — 将图层的颜色、不透明度、位置、缩放或旋转标记为字段；在一个列表中编辑所有字段，模板拖入时会提供这些字段。 *Where:* 图层 Properties 中的 📋 Template fields，🧩 Templates. *Since:* 2.511.0
- **Lottie (JSON) 导出** — 将图片和文字图层导出为适用于网页和应用的 Lottie 动画：移动、缩放、旋转和淡入淡出导出为带缓动的真正动画图层，效果图层导出为帧；已用 lottie-web 验证。 *Where:* 📤 Export → ⤓ Lottie (JSON). *Since:* 2.512.0
- **加载 UE 项目** — 选择一个 Unreal 项目文件夹，bitGen 会放入（或更新）bitGen Bridge 插件，启用所需插件，并以该项目重新启动 Unreal。 *Where:* 菜单栏中的 🎮. *Since:* 2.513.0
- **时间线的画面尺寸** — 宽 × 高、尺寸预设（从 4K 到竖屏和方形），以及画布和合成共用的锁定宽高比；V1 会适配到画面内并居中。 *Where:* Timeline 面板顶部的栏. *Since:* 2.513.0
- **在整个镜头中抠出主体** — 点击主体（或框选），它就会在整个片段中被跟踪（SAM 2、AI 遮罩或内置方法），可优化边缘，结果为一个透明视频图层。 *Where:* 视频片段 Properties 中的 🧍 Cut out. *Since:* 2.515.0
- **视频内容识别填充** — 从每一帧中移除抠出的主体或蒙版区域，并用周围帧（+ 一张参考帧）填充。 *Where:* 视频片段 Properties 中的 🩹 Remove. *Since:* 2.515.0
- **3D 摄像机跟踪器** — 解算相机和场景中的点，选择点并将图层平放、竖立或朝向相机放置；3D 相机跟随解算结果（包括滚转）。 *Where:* 视频片段 Properties 中的 📷 3D camera track. *Since:* 2.515.0
- **任意设置均可设关键帧** — 每个颜色、效果、蒙版、文字和时间设置旁的 ◇ 可在播放头处为其设关键帧（之后修改即会自动设关键帧）；Graph Editor 会显示这些关键帧，合成结果一致。 *Where:* 片段 Properties 和 🎨 Colour 对话框中的 ◇. *Since:* 2.516.0
- **主题编辑模式：调整大小、移动、隐藏、重命名** — 拖动手柄调整元素大小，拖动元素移动位置，隐藏元素或修改其文字；每次修改都会保存在 themes/<name>.tmp 中，退出编辑模式时可选择 Save theme、Save theme as…、Reset theme、Not now 或 Cancel。 *Where:* 顶部栏中的 🖌. *Since:* 2.514.0
- **主题编辑模式：每个按钮及其文字** — 双击任意文字（按钮、面板标题、选项卡、标签、标题、提示）即可就地修改；可重命名下拉列表的选项；可修改占位文字和工具提示；浮动工具面板的编辑方式与面板相同；Shift+点击（2.682.0）或 Alt+点击可执行按钮的操作，并在不退出该模式的情况下打开分区 / 选项卡 / 菜单。 *Where:* 顶部栏中的 🖌. *Since:* 2.623.0
- **仅在 Expert 模式下隐藏** — 主题可以只在开启 Expert 模式时隐藏某个元素；Basic 模式下仍会显示。 *Where:* 主题编辑模式 > Style 面板 > Hide. *Since:* 2.544.0
- **对话框的主题编辑模式** — Ctrl+Shift+Alt+E 也可为打开的对话框（Settings 等）设置样式；Ctrl+S 保存主题并退出。 *Where:* 任意位置. *Since:* 2.515.0
- **折叠面板** — 侧边面板可折叠为细长的标题条；图像编辑器的面板组可折叠为其选项卡，并可用 ✕ 关闭；View ▸ Dockers 可显示或隐藏每个面板。 *Where:* 面板标题栏中的 ▾；图像编辑器的 View 菜单. *Since:* 2.514.0
- **运动跟踪** — 在片段中以亚像素精度跟踪一个点、两个点（缩放和旋转）、四个角点或一个平面（平面跟踪），然后将其应用到图层的位置，或将图层钉入其中。 *Where:* 视频片段 Properties 中的 🎯 Track. *Since:* 2.499.0
- **边角定位** — 将图层绘制到四个角点中，角点可来自跟踪或手动拖动；合成结果与画布一致。 *Where:* 图层 Properties 中的 ▢ Corner pin. *Since:* 2.499.0
- **贝塞尔蒙版** — 每个图层可用钢笔绘制多个蒙版（角点和曲线），支持相加、相减、交集和差集，以及羽化、扩展、不透明度、反转和动画路径；适用于图片、文字、形状和视频。 *Where:* ✒ Mask Pen（Shift+M）以及图层 Properties 中的 ✒ Masks. *Since:* 2.498.0
- **表达式** — 图层属性（位置、缩放、旋转、不透明度、锚点、形状和文字动画器数值）上的简短公式：wiggle、循环、延迟、范围、随机、链接到其他图层；输入时即时检查；合成会遵循表达式。 *Where:* 图层 Properties 中的 ƒx Expressions. *Since:* 2.497.0
- **漂浮关键帧** — 位置关键帧的时间沿运动路径自动调整，使其与相邻关键帧之间保持匀速。 *Where:* Graph Editor 中的 Rove. *Since:* 2.496.0
- **Easy Ease** — 让关键帧缓入缓出，或只缓动一侧。 *Where:* Properties，F9（Shift+F9 缓入，Ctrl+Shift+F9 缓出）. *Since:* 2.489.0
- **锚点** — 位置以它为基准放置，缩放和旋转以它为中心；可设关键帧；移动锚点时图层保持不动。 *Where:* Properties 中的 ⊕ Anchor. *Since:* 2.489.0
- **曲线运动路径** — 位置路径绘制在画布上，可用贝塞尔手柄弯曲；一键 Smooth path。 *Where:* 画布，↝ Smooth path. *Since:* 2.489.0
- **父子关系** — 图片、文字、空对象或（自 2.495.0 起）视频图层跟随另一个图层的位置、旋转和缩放；选择或清除父级时图层保持不动，合成也会遵循父子关系。 *Where:* Properties 中的 ⛓ Parent. *Since:* 2.490.0
- **空对象** — 用于设关键帧和作为其他图层父级的空控制图层；永远不会被合成。 *Where:* Properties 中的 ＋ Null. *Since:* 2.490.0
- **混合模式** — 每个图层可设 Multiply、Screen、Overlay、Darken、Lighten、Color Dodge 和 Burn、Hard 和 Soft Light、Difference、Exclusion、Add 以及（自 2.495.0 起）Hue、Saturation、Color 和 Luminosity，在画布上和合成中均生效。 *Where:* Properties 中的 ◐ Blend. *Since:* 2.491.0
- **轨道遮罩** — 只在上方图层存在的地方显示该图层（alpha 或亮度，或反转）；可实现文字中的视频等效果。 *Where:* Properties 中的 ▣ Matte. *Since:* 2.491.0
- **形状图层** — 用 Shape 工具绘制的矩形、椭圆、星形和多边形，可使用纯色或渐变填充以及描边。 *Where:* 画布工具栏中的 ◆（Q）. *Since:* 2.492.0
- **形状操作器** — Trim Paths、Repeater、Offset Paths、Pucker & Bloat、Twist、Zig Zag、Wiggle Paths 和 Round Corners，所有数值均可设关键帧。 *Where:* 形状图层的 Properties. *Since:* 2.492.0
- **手绘形状** — 手绘闭合形状或开放线条，自动平滑；按住 Alt 可将其作为另一条路径添加到所选形状图层。 *Where:* ✎ Freehand 工具（Shift+Q）. *Since:* 2.496.0
- **合并路径** — 将一个形状图层中的多条路径以相加、相减、交集或排除方式组合，包括镂空；其后的操作器作用于合并后的轮廓。 *Where:* 形状图层 Properties 中的 ⧉ Paths 和 ⊕ Merge Paths. *Since:* 2.496.0
- **文字动画器** — 对范围所选的字母、单词或行进行移动、旋转、缩放、淡化、拉开间距、模糊或改色；提供 Typewriter、Fade up、Pop in、Slide in、Wave 和 Blur in 预设；所有数值均可设关键帧。 *Where:* 文字图层 Properties 中的 ✨ Text Animators. *Since:* 2.493.0
- **路径文字** — 字母沿弧线、圆形、波浪或形状图层的轮廓排列，并随之转向；起点可设关键帧。 *Where:* 文字图层 Properties 中的 〰 On a path. *Since:* 2.496.0
- **编辑关键帧** — 点击片段上的菱形，可设置其不透明度、音量、位置、缩放、旋转、颜色和缓动。 *Where:* 时间线
- **拖动和删除关键帧** — 沿片段拖动；右键点击、Alt+点击或按 Delete 可删除一个关键帧。 *Where:* 时间线. *Since:* 2.385.0
- **音量关键帧** — 声音片段同样适用。 *Where:* 声音片段
- **效果关键帧** — 模糊、锐化、发光、暗角、颗粒和裁剪在关键帧之间变化。 *Where:* 片段的 Effects. *Since:* 2.412.0

### 编辑工具与按键

- **波纹、滚动、滑移和滑动** — 修剪并移动其后的所有内容、移动剪切点、显示其他帧，或在相邻片段之间滑动。 *Where:* 按键 V、B、N、Y、U. *Since:* 2.407.0
- **分割** — 在位置标记处分割。 *Where:* Ctrl+K. *Since:* 2.410.0
- **轨道目标** — 一次分割所有设为目标的图层。 *Where:* 每个图层头部的目标按钮. *Since:* 2.412.0
- **J / K / L 穿梭播放** — 以 2x、4x、8x 倒放或正放；逐帧步进。 *Where:* 时间线面板. *Since:* 2.411.0
- **编辑点与首尾** — 跳到上一个或下一个编辑点、开头或结尾。 *Where:* 方向键、Home、End. *Since:* 2.410.0
- **在倒放和变速片段上编辑** — 编辑工具和分割在变速片段上同样精确到帧。 *Where:* 时间线. *Since:* 2.413.0

### 标记与时间码

- **标记** — 带名称、颜色和注释的旗标；跳到下一个和上一个标记。 *Where:* 按键 M. *Since:* 2.410.0
- **标记范围与片段标记** — 带长度的标记，以及固定在片段某一帧上的标记。 *Where:* 标记编辑器，Ctrl+Shift+M. *Since:* 2.412.0
- **时间码** — HH:MM:SS:FF，可设起始时间和帧率；29.97 和 59.94 时使用丢帧时间码。 *Where:* 位置旁边. *Since:* 2.407.0

### 速度

- **速度** — 10 到 1000 %，片段长度随之变化。 *Where:* 片段的 Speed 折叠区. *Since:* 2.406.0
- **倒放与变速** — 倒放，或沿片段逐渐改变速度。 *Where:* 片段的 Speed 折叠区. *Since:* 2.406.0
- **慢放帧** — 重复帧、帧混合或光流。 *Where:* 片段的 Speed 折叠区. *Since:* 2.406.0
- **画布上的倒放声音** — 倒放或变速片段的声音只渲染一次，播放时与画面同步。 *Where:* 画布. *Since:* 2.417.0

### 调色

- **风格预设与滑块** — 青橙色调、暖调胶片、冷调夜景等；曝光、对比度、饱和度、色温、色调和色相。 *Where:* 片段的 Colour 折叠区. *Since:* 2.406.0
- **LUT** — 导入任意 3D .cube LUT 并调节混合程度。 *Where:* 片段的 Colour 折叠区. *Since:* 2.406.0
- **色轮与曲线** — 暗部（lift）、中间调（gamma）和亮部（gain）色轮；主曲线和 RGB 曲线。 *Where:* Colour 对话框. *Since:* 2.407.0
- **HSL 二级调色** — 最多六个色相范围，可分别偏移色相、调整饱和度或提亮。 *Where:* Colour 对话框. *Since:* 2.407.0
- **色相曲线** — 色相对色相、色相对饱和度。 *Where:* Colour 对话框. *Since:* 2.412.0
- **示波器** — 波形图、RGB 分量图、矢量示波器和直方图。 *Where:* Colour 对话框. *Since:* 2.407.0
- **色彩匹配** — 将片段的曲线设置为与另一个片段匹配。 *Where:* Colour 对话框. *Since:* 2.415.0
- **所见即所得** — 调色结果烘焙为一张由画布和合成共用的查找表。 *Where:* 画布
- **HDR 片段色调映射** — 手机拍摄的 HDR 视频会经过色调映射后放入影片。 *Where:* 合成. *Since:* 2.417.0

### 效果与调整图层

- **效果** — 模糊、锐化、发光、暗角、颗粒、裁剪、绿幕 / 蓝幕抠像和防抖。 *Where:* 片段的 Effects. *Since:* 2.409.0
- **扭曲效果** — 镜头、镜像和变形（波浪、旋涡）。 *Where:* 片段的 Effects. *Since:* 2.415.0
- **防抖模式** — 平滑或锁定，预览画面稳定。 *Where:* 片段的 Effects. *Since:* 2.413.0
- **调整图层** — 作用于其下方所有内容的调色和效果。 *Where:* 时间线工具栏. *Since:* 2.409.0

### 蒙版与跟踪

- **蒙版（电动窗口）** — 带羽化和反转的椭圆或方框，用于限定调色和效果的范围。 *Where:* Colour 面板. *Since:* 2.416.0
- **跟踪** — 蒙版跟随目标直到片段结束。 *Where:* Colour 面板. *Since:* 2.416.0

### 声音与混音

- **清理** — 人声清晰度、降噪和增益，支持前后对比预览。 *Where:* 片段的 Sound 折叠区. *Since:* 2.406.0
- **均衡器、多段处理与混响** — 可用于任意片段的声音。 *Where:* 片段的 Sound 折叠区. *Since:* 2.412.0
- **J / L 剪辑** — 片段的声音提前开始或延后结束。 *Where:* 片段的 Sound 折叠区. *Since:* 2.407.0
- **链接的声音** — 视频的声音作为单独的链接片段；可取消链接或重新链接。 *Where:* 片段的 Properties. *Since:* 2.412.0
- **Mix 对话框** — 人声、音乐和音效角色，闪避（ducking）以及按目标值调整响度。 *Where:* 时间线的 Mix 按钮. *Since:* 2.406.0
- **轨道混音器** — 每条轨道和主输出各有推子、声像、静音、独奏和实时电平表。 *Where:* 时间线菜单栏. *Since:* 2.415.0
- **波形** — 每个声音片段都显示其波形。 *Where:* 声音图层. *Since:* 2.64.0

### 字幕与文字稿

- **由语音生成字幕** — 所有有人声的内容都在本地转录，并放在各片段所在的位置。 *Where:* 时间线的 Captions 按钮. *Since:* 2.406.0
- **编辑字幕及其样式** — 时间、文字、字体、字号、颜色、描边或底框、位置。 *Where:* Captions 对话框. *Since:* 2.406.0
- **烧录或 .srt** — 烧录进影片，和 / 或在旁边生成 .srt。 *Where:* Captions 对话框. *Since:* 2.406.0
- **基于文字稿编辑** — 选择词语，将其剪掉或只保留它们；删除停顿和填充词。 *Where:* 时间线的 Transcript 按钮. *Since:* 2.408.0
- **文字稿范围** — 当前片段、其所在图层或整个序列。 *Where:* Transcript 对话框. *Since:* 2.414.0
- **场景切换点** — 在镜头切换处分割片段，或在那里放置标记。 *Where:* Transcript 对话框. *Since:* 2.408.0

### 多机位、嵌套与代理

- **多机位** — 按声音同步各机位，用按键 1 到 9 实时切换；可展平为普通片段。 *Where:* 时间线. *Since:* 2.416.0
- **嵌套序列** — 将另一条时间线合成为一个片段，它变化时会重新渲染。 *Where:* 时间线菜单栏. *Since:* 2.414.0
- **代理** — 为大体量素材生成小副本用于播放；影片使用原始素材。 *Where:* 时间线. *Since:* 2.416.0

### 播放

- **渲染条** — 显示哪些区段可实时播放、可能丢帧、负载过重或已渲染。 *Where:* 标尺下方. *Since:* 2.418.0
- **渲染预览** — 合成一次，即可在已渲染的区段以全速播放与成片完全一致的画面。 *Where:* Render 按钮. *Since:* 2.418.0
- **迟到帧计数与播放分辨率** — 播放时使用全尺寸、二分之一或四分之一尺寸。 *Where:* 播放按钮旁边. *Since:* 2.418.0
- **GPU 合成器** — 播放时在显卡上合成图层。 *Where:* GPU 开关. *Since:* 2.420.0

### 时间线中的 AI

- **新镜次** — 在片段自己的槽位中重新渲染，并可在各镜次之间切换。 *Where:* AI 菜单. *Since:* 2.420.0
- **延长** — 从片段的最后一帧接续生成更多秒数。 *Where:* AI 菜单. *Since:* 2.420.0
- **B-roll 补充镜头** — 填充 V1 上的空白区段，或在某个范围上插入切出镜头。 *Where:* AI 菜单. *Since:* 2.420.0
- **踩点剪辑** — 找出歌曲的节拍，然后在节拍处放置标记或剪切片段。 *Where:* AI 菜单. *Since:* 2.420.0

### 路径图层

- **路径图层** — 绘制一条路径，让主体（动物、人物、车辆）沿路径移动，可设置大小和速度。 *Where:* 时间线栏的 Path layer 按钮. *Since:* 2.387.0
- **原地或沿路径** — 用关键帧移动的绿幕片段，或由 Wan ATI 让主体自己行进。 *Where:* 路径图层的面板. *Since:* 2.387.0
- **抠像** — AI 遮罩或色度抠像；每个路径图层都是透明的。 *Where:* 路径图层的面板. *Since:* 2.387.0

### 相机路径

- **相机面板** — 预设，以及摇摄、俯仰、滚转、高度、推拉和镜头关键帧，提供相机视图、顶视图和侧视图。 *Where:* 时间线栏的 Camera. *Since:* 2.399.0
- **相机工具** — 在画布上拖动即可摇摄、俯仰、滚转、改变高度和推拉。 *Where:* Shift+C. *Since:* 2.399.0
- **用于生成** — 告诉每个视频模型它能遵循的运镜。 *Where:* Camera 面板. *Since:* 2.399.0
- **精确路径引导** — 一张带深度的图片沿路径飞行，生成引导视频。 *Where:* Camera 面板. *Since:* 2.399.0

### 时间线上的 3D 图层

- **3D 文字与模型** — 挤出的 3D 文字，或 FBX、OBJ、GLB 和 glTF 模型，可像任何图层一样移动和设关键帧。 *Where:* T 下方的 3D 按钮. *Since:* 2.382.0
- **3D 控件** — 用 G、R 和 S 在 3D 空间中移动、旋转和缩放。 *Where:* 移动工具. *Since:* 2.385.0
- **材质与灯光** — 材质预设或自定义材质，摄影棚灯光以及自定义的点光源、聚光灯、太阳光、环境光和天空光。 *Where:* 3D 图层的 Properties. *Since:* 2.385.0
- **3D 工具栏** — 控件、吸附、视图、旋转、重置、材质、灯光、关键帧和烘焙。 *Where:* 画布顶部. *Since:* 2.386.0
- **为合成而烘焙** — 3D 图层会自动烘焙为透明视频。 *Where:* Compile
- **用 Blender 渲染** — 合成时由 Blender 渲染 3D 图层。 *Where:* 3D 图层的 Properties. *Since:* 2.385.0

### 标尺、参考线与网格

- **标尺与参考线** — 以画面像素为单位的标尺；可拖出参考线、移动参考线或输入其位置。 *Where:* 时间线菜单栏. *Since:* 2.446.0
- **吸附** — 移动的图层会吸附到参考线、画面的边缘和中心以及网格。 *Where:* 预览画布. *Since:* 2.446.0
- **网格** — 覆盖在预览画布上的网格，有自己的设置。 *Where:* 时间线菜单栏. *Since:* 2.445.0
- **网格与参考线设置** — 间距、主网格线、线或点、颜色和吸附距离。 *Where:* Timeline settings. *Since:* 2.445.0

### 文字与模板

- **文字效果预设** — 输入时实时绘制的多层 3D 文字效果；可从 PSD 导入你自己的效果。 *Where:* 文字图层的 Properties. *Since:* 2.411.0
- **动画文字、路径文字和 3D 文字上的预设** — 带预设的文字在使用 ✨ Text Animators 和 〰 On a path 时保留预设；3D 文字将预设用作正面（侧面使用其颜色）。 *Where:* 文字的 Properties，3D 文字的 Properties. *Since:* 2.607.0
- **使用你的预设新建文字** — T 工具新建的文字默认使用上次选择的预设；未选中任何内容时 = Properties ▸ New text ▸ Preset。 *Where:* 时间线. *Since:* 2.607.0
- **🧬 变形** — 在两个图层之间让一个角色变成另一个角色：写出两个角色，选择这两个图层；提示词会自动写好，首帧 / 尾帧会自动截取，由视频模型渲染，结果放在两者之间的 🧬 Morph 图层上，图层 2 会后移到它之后开始。 *Where:* 时间线的图层面板 ▸ 🧬 Morph 选项卡. *Since:* 2.610.0
- **▯ 帧：点击一帧，按 Del 删除** — 一种时间线工具，用于选择某个图层上的单帧（点击，拖动选多帧，Shift+点击，← / →）；按 Del / ⌫ 将其从该图层中剪掉并合拢空隙，↶ 可恢复。 *Where:* 时间线的菜单栏 ▸ ▯（或在图层上按 F）. *Since:* 2.611.0
- **剪切后的片段仍是一个片段** — 对跨越片段的帧执行 ✂ Cut / Del，会把前后两部分连接成一个连续片段（视频 / 声音会生成一个帧精确的 "-join" 文件；图片则只是变短）；一次 ↶ 即可撤销。预览会提前一秒加载下一个片段，因此剪切处绝不会闪黑。 *Where:* 时间线 ▸ ✂ Cut（开启波纹）. *Since:* 2.612.0
- **播放时标记 ▼ 范围** — 预览播放时按一下 Ctrl 标记范围的开始，再按一下标记结束，可在高亮的图层上标记任意多个，每个范围颜色不同；拖动 ▼ 可移动它（预览会显示该帧）。 *Where:* 时间线（Ctrl），时间标尺中的 ▼. *Since:* 2.613.0
- **选择范围，用 ✂ Cut 剪掉** — 点击 ▼ 选择其范围，Ctrl / Shift + 点击可选择更多；✂ Cut（以及 ⏩ / ✕）作用于所选范围，未选择时作用于全部范围。 *Where:* 时间线标尺的 ▼ + 菜单栏的 ▼ 组. *Since:* 2.614.0
- **每个风格独立的 Basic Settings** — 每个风格都会保留你上次与它一起使用的 Basic Settings（misc/basic_settings.tmp）：切换风格时，先保存所离开风格的设置，再恢复新风格的设置；应用启动时会打开上次使用的风格及其设置。视频风格保存除图像设置组以外的所有设置；图像风格保存图像设置组。 *Where:* 任意风格列表（提示词面板、Basic Settings 的风格卡片）. *Since:* 2.615.0
- **彩色安装过程，绝不看起来卡住** — 在安装窗口的步骤、日志和下载中，以及安装脚本中，已完成显示为绿色，正在安装显示为浅绿色（带用时），警告为橙色，错误为红色；长时间无输出的步骤会说明它仍在运行、为何可能耗时较长，以及它并没有卡住。 *Where:* 安装窗口，install_all，start.bat. *Since:* 2.634.0
- **一个文件完成安装** — install_all.bat / install_all.sh / install_all.command：缺少 Git 和 Node.js 时自动安装（Windows：还有 Python），将仓库克隆到该文件旁边，然后启动工作室（首次启动时安装其余部分）。 *Where:* 仓库根目录——只需下载该文件. *Since:* 2.616.0
- **从 zip 导入文字效果** — 一个包含 PSD 文字效果的 zip（效果包）可一次性将其中每个效果安装为预设，并附带其中的字体；也可以一次选择多个 PSD。 *Where:* 文字图层的 Properties / 图像编辑器的 Type 工具 ▸ Presets ▾ ＋ Import PSD text effects or a zip…. *Since:* 2.617.0
- **隐藏 / 删除桥接图层时关闭其桥接** — 隐藏或删除 Blender、3D（Daz / Blender）或 Unreal 图层时，会关闭其在图像编辑器和时间线中的场景 / 实时视图（Blender 进程结束，Unreal View 停止，Daz 中等待执行的命令被丢弃）。 *Where:* 图像编辑器的 Layers（👁 / 删除），时间线的图层. *Since:* 2.618.0
- **✂ 剪掉所有范围 / ⏩ 加速范围** — 一次剪掉所有已标记的范围（被剪多次的片段仍是一个片段），或将每个范围以 2× - 10× 的速度播放，快进渲染画面。 *Where:* 时间线的菜单栏 ▸ ▼ 组. *Since:* 2.613.0
- **悬停时间 + 播放速度** — 指针所在位置的时间显示在时间线上方的小框中；预览可以 0.125× - 8× 的速度播放。 *Where:* 时间线；预览下方的速度列表. *Since:* 2.613.0
- **✂ 到新图层** — 一个复选框，勾选后剪切或 Ctrl+K 分割之后的部分会放到正上方的新图层上。 *Where:* 时间线的菜单栏. *Since:* 2.612.0
- **形状图层中的文字** — 文字拉伸以填满形状图层的轮廓，或在其中排布（Fit），放置在形状上；跟随动画形状变化。 *Where:* 文字的 Properties ▸ 🔤 In a shape. *Since:* 2.608.0
- **🅰 形状图层的文字填充** — 用一行行文字填充形状（字体、字号、颜色、角度）。 *Where:* 形状图层的 Properties ▸ ◆ Shape. *Since:* 2.608.0
- **任意图层上的变形预设** — 16 种预设（Arc … Twist、Wedge），以可编辑的 ⌗ 网格形式提供，可用 📌 拖动。 *Where:* Properties ▸ 📌 Warp ▸ ⌇ Preset. *Since:* 2.608.0
- **动态图形模板** — 下方三分之一字幕条、标题卡、片尾卡和角标，也可保存自己的模板。 *Where:* 时间线菜单栏. *Since:* 2.417.0

### 时间线上的工具与 CAD 工具栏

- **工具与属性面板** — 画布工具和所选图层的设置位于单独的面板中，可停靠在画布旁边或浮动。 *Where:* 按键 1. *Since:* 2.385.0
- **时间线的 CAD 工具栏** — 预览行上方的功能区，带有 Create、3D、Sketch、Solid 和 Unreal 选项卡（参见“CAD 与 3D”）。 *Where:* 时间线. *Since:* 2.470.0
- **时间线设置** — 微移、歌曲时间、卡拉 OK 样式和网格。 *Where:* 时间线菜单栏右侧的设置按钮. *Since:* 2.376.0

## 图像编辑器

一款分层图像编辑器，具备选区、修饰、智能对象、文字、矢量绘图、尺寸标注、CAD 草图和 AI 功能，全部在本机运行。

### 布局、文档与面板

- **菜单栏、选项栏和工具栏** — File、Edit、Image、Layer、Select、Filter、View、Window 和 Help，每一项都有其常用快捷键；选项栏显示当前工具的设置。 *Where:* Image editor 面板。 *Since:* 2.389.0
- **工具组** — 组内还有其他工具时，可按 Shift 加该工具的快捷键循环切换，或通过右键点击、长按打开。 *Where:* 工具栏
- **命令面板** — 输入命令的一部分，然后按 Enter。 *Where:* Ctrl+K
- **快捷键列表** — 所有按键集中在一个列表中。 *Where:* Help > Keyboard Shortcuts
- **全屏** — 编辑器填满 bitGen 自身各栏之间的空间；其状态行移入 bitGen 的状态栏。 *Where:* F 键或全屏按钮。 *Since:* 2.393.0
- **显示或隐藏面板** — Tab 隐藏所有面板，Shift+Tab 只隐藏面板组。 *Where:* 图像编辑器
- **文档** — 每次 New 或 Open 都会生成一个独立文档，拥有各自的图层、撤销记录、选区、路径、通道和缩放。 *Where:* 图像编辑器。 *Since:* 2.430.0
- **标签页与浮动窗口** — 第一个文档以标签页形式停靠，之后的文档在各自的窗口中浮动；可在两者之间拖动。 *Where:* 文档标签页。 *Since:* 2.430.0
- **关闭与排列文档** — Close 和 Close All 会询问如何处理未保存的更改；平铺、层叠、合并为标签页、下一个和上一个文档。 *Where:* File 和 Window > Arrange。 *Since:* 2.430.0
- **面板组** — Color 和 Swatches；Properties、Adjustments、AI 和 Control；Layers、Paths、Channels、History、Actions 和 Comps；另有 Character、Paragraph、Sketch、3D、Body 和 Unreal 标签页。 *Where:* 右侧栏
- **浮动面板组** — 每个标签组都可通过其浮动按钮浮动，并可停靠回侧栏。 *Where:* 各组的标签页。 *Since:* 2.438.0
- **侧栏本身就是面板** — 将浮动组放到另一个组的上方或下方（橙色线条指示放置位置）；侧栏宽度可在 200 到 640 px 之间拖动调整。 *Where:* 右侧栏。 *Since:* 2.454.0
- **编辑器中的命名面板** — 将浮动组作为标签页停靠到你命名的面板中。 *Where:* Window > New Docker。 *Since:* 2.438.0
- **属性栏** — 所选图层的 X、Y、W 和 H，带比例锁定；矩形的圆角半径；矢量形状的轮廓宽度和线型。 *Where:* 选项栏下方。 *Since:* 2.439.0
- **历史记录** — 最近 80 步；点击其中一步即可后退或前进到该步。 *Where:* History 面板
- **编辑器设置** — AI 结果、上下文、羽化、百万像素、Apply 的作用、外观、标尺、面板和选项栏。 *Where:* 设置按钮，或 Edit > Preferences（Ctrl+,）。 *Since:* 2.444.0

### 图层

- **像素、填充、文字和形状图层** — 纯色或渐变填充、可编辑的文字和形状。 *Where:* Layers 面板
- **调整图层** — 16 种（Brightness/Contrast、Levels、Curves、Exposure、Vibrance、Hue/Saturation、Color Balance、Black & White、Photo Filter、Channel Mixer、Color Lookup、Gradient Map、Selective Color、Invert、Posterize、Threshold），在 Properties 中实时调整。 *Where:* Adjustments 面板
- **组** — Ctrl+G 编组，Shift+Ctrl+G 取消编组；Pass Through 让组内的调整作用于其下方的图层。 *Where:* Layers 面板
- **图层蒙版** — 在蒙版上绘画，Alt+点击查看蒙版，Shift+点击停用蒙版，Ctrl+点击将其载入为选区；密度、羽化、反相、应用。 *Where:* Layers 面板
- **剪贴蒙版** — 图层只在下方图层有像素的地方显示。 *Where:* Alt+Ctrl+G
- **填充不透明度、锁定和标签** — 填充不透明度只减淡像素，不影响图层样式；可锁定透明度、像素、位置或全部；可从右键菜单设置颜色标签。 *Where:* Layers 面板
- **排列与合并** — 上下移动图层、Merge Down、Merge Visible、Flatten Image、Rasterize。 *Where:* Layer 菜单
- **图层复合** — 保存图层的可见性、位置和外观，可在各复合之间切换、更新某个复合，或回到上一次的文档状态。 *Where:* Window > Layer Comps。 *Since:* 2.434.0
- **删除图层** — Del 删除当前图层（有选区时则清除选区内容）；Shift+Del 始终删除图层。 *Where:* 图像编辑器。 *Since:* 2.451.0
- **无工具** — Esc 放下工具（不选任何工具）；点击选中一个对象，按住 Shift 或 Ctrl 点击可追加选择。 *Where:* 图像编辑器，Esc。 *Since:* 2.474.0
- **选择框** — 在无工具状态下拖出虚线框：从左向右拖动选中完全位于框内的图层，从右向左拖动选中与框接触的图层；按住 Shift 可追加。 *Where:* 无工具状态下的画布。 *Since:* 2.474.0
- **同时操作多个图层** — Shift+点击选中两个图层之间的所有图层，Ctrl+点击添加或移除单个图层；Move 工具可一起移动它们，Del 将它们全部删除。 *Where:* Layers 面板。 *Since:* 2.474.0
- **将选中的图层编组和删除** — 选中多个图层时，Ctrl+G 将它们放入一个组（对单个组按 Ctrl+G 则取消编组），🗑 按钮将它们全部删除。 *Where:* Layers 面板。 *Since:* 2.547.0
- **拖入为图层或新文档** — 将图片拖放到已打开的画布上时会询问：作为图层添加，还是作为新文档打开。 *Where:* 图像编辑器的画布。 *Since:* 2.549.0
- **生成 = 新图层** — 在图像编辑模式下，生成的图片总是作为新图层导入，并使用提示词面板中选定的风格（Generate 会列出 Krea 2 及其他所有风格）。 *Where:* 图像编辑模式下的提示词面板。 *Since:* 2.549.0
- **无缝填充** — 选区通过提示词面板所选风格的专用工作流图（编码后的图片 + 噪声蒙版 + 差分扩散）进行填充，融合效果与 Krita AI 插件相同；Krea 2、Klein 等风格现在都能用于填充。 *Where:* 有选区时的图像编辑器，Generate / Refine。 *Since:* 2.550.0
- **带斜切的变换；粘贴后移动** — Ctrl+T（或 Move 工具选项栏上的 ⤡ Transform）可缩放、旋转和斜切（Ctrl + 拖动边缘）；Paste 会取消选区，以便 Move 工具移动粘贴进来的图层。 *Where:* 图像编辑器。 *Since:* 2.550.0
- **用中间控点斜切** — Free Transform 的中间控点可斜切图层（显示斜切光标），按住 Shift / Alt 拖动中间控点则为拉伸。 *Where:* 图像编辑器，Ctrl+T。 *Since:* 2.551.0
- **像 Krita AI 插件一样填充** — 选区周围提供更多上下文，选区先由其边缘内容预填充，使用柔和蒙版，对未针对局部重绘训练的模型以 0.9 为起始值。 *Where:* 有选区时的图像编辑器。 *Since:* 2.551.0
- **采用 Krita 插件自身代码的填充与编辑** — Generate 以全强度运行，小区域放大后渲染，蒙版大小随选区而定，越过边缘进行融合并匹配颜色，在选区内 Edit 只改动选区。 *Where:* 有选区时的图像编辑器。 *Since:* 2.552.0
- **用编辑模型填充** — 在选区中通过编辑模型执行 Generate / Remove / New background（选区涂成绿色 + Krita 的指令），使新内容与场景融为一体；▾ Edit 可限定在选区内，或限定在图层自身的像素内。 *Where:* 图像编辑器的 ✨ AI 面板（👁）、提示词面板。 *Since:* 2.553.0
- **Generate 适应选区** — 无法看到选区周围内容的风格会按选区自身边界框的尺寸生成图片，因此画出的内容与选区大小一致。 *Where:* 图像编辑器的 ✨ AI 面板（👁 关闭）、提示词面板。 *Since:* 2.554.0
- **按模型系列采用 Krita AI 插件的填充方式** — SDXL / Pony 使用 Fooocus inpaint 补丁，Illustrious / SD 1.5 / FLUX.1 使用局部重绘 ControlNet，Remove 先用 MAT / LaMa 处理，并采用 Krita 的上下文边界及其 Add content / Fill 模式。 *Where:* 图像编辑器的 ✨ AI 面板（填充行）、提示词面板；安装界面会列出所需节点包和模型。 *Since:* 2.555.0
- **⏳ 待处理** — 每次 ✨ 运行都直接进入队列，无需等待；结果在编辑器内的一个面板中等待，✔ Apply 将其放到所属图层上方、该图层的“✨ changes”组中，🗑 Delete 将其丢弃。 *Where:* 图像编辑器（✨ AI 面板中的 ⏳ Pending）。 *Since:* 2.556.0
- **面板栏可放入任意浮动面板** — 按住标题将浮动面板（用 ⇱ 浮动出来的主面板、▣ 面板、Basic Settings、LLM tokens、提示词面板、⏳ Pending）拖到图像编辑器的面板栏上，即可停靠在此——可从其标题栏折叠、移动、调整大小或再次浮动；下次启动时保留，并随编辑器一起显示 / 隐藏。 *Where:* 图像编辑器的面板栏（Layers 所在处）。 *Since:* 2.609.0
- **所有 ✨ 模式都可使用参考图** — 提示词中的“picture N”会把 References 面板中的对应图片带入 Edit、Generate、Fill、Remove、Refine（通过编辑模型）；Compose 中则使用“ref N”。 *Where:* 图像编辑器的 ✨ AI 面板、提示词面板。 *Since:* 2.556.0
- **AI 填充模型附加组件** — 用于 Krita 方式填充的节点包 + Fooocus / MAT / 局部重绘 ControlNet 文件，在 Settings ▸ Add-ons 中勾选并下载。 *Where:* Settings ▸ Add-ons ▸ AI fill models。 *Since:* 2.557.0
- **▣ 面板可容纳任意面板** — 与其他浮动面板位于同一浮动层（而非置于所有内容之上），拖动面板时会显示轮廓；Settings、References、Assets、Queue、Gallery 和 StoryBoard 可按住标题栏拖入。 *Where:* 状态栏的 ▣ Docker（Ctrl+Alt+D）。 *Since:* 2.558.0
- **文件夹筛选会记住所选文件夹；Basic Settings 保存在 basic.cfg 中** — 每个文件夹筛选下拉框都会保留你选择的文件夹（folder_filters.cfg）；Basic Settings 在更改时保存到 basic.cfg，并在启动时读回。 *Where:* 任意模型下拉框的文件夹筛选、📁 浏览器、Model manager；Basic Settings。 *Since:* 2.559.0
- **▣ 面板可停靠，任何面板都能放入** — 按住标题栏拖动浮动的 ▣ 面板，可将其停靠到某个面板的上方 / 下方 / 旁边，或停靠到侧边面板中（蓝色放置区域）；Basic Settings、LLM tokens 和提示词面板可放入 ▣ 面板，也可再浮动出来。 *Where:* 状态栏的 ▣ Docker（Ctrl+Alt+D）。 *Since:* 2.560.0
- **将 ▣ 面板作为独立的一栏** — 放到两栏之间的接缝处（或窗口边缘）时，它会变成一个全高的栏，并带有自己的分隔条；重启后保留。 *Where:* 按住标题栏拖动 ▣ 面板。 *Since:* 2.561.0
- **恢复的任务回到所属场景；不再自动播放** — 因重启而中断的 StoryBoard 场景，在 Queue 面板的 Pending 标签页中按下 ▶ Resume 后会取回其任务（运行状态及其进度条）；视频和歌曲加载后处于暂停状态，按 ▶ / Space 才开始播放。 *Where:* Queue 面板的 Pending 标签页；StoryBoard；播放器。 *Since:* 2.562.0
- **使用其他场景的图片；以 🅰 Picture A 生成首帧** — 场景选择器的 🎬 Scenes 标签页（每个场景自身的图片）和 🎞 Clips（任意镜次的帧）；✎ First frame 以选定的 Picture A 为起点（保留风格、构图和姿势），置于新的地点或全局提示词设定的地点，指令由 LLM 编写（🤖 Write）。 *Where:* StoryBoard 场景卡片。 *Since:* 2.563.0
- **🎙 语音对话** — 像实时聊天一样免手动与应用交谈：它能听懂你说的话（faster-whisper，本地运行，常驻加载），本地 LLM 会出声回答并执行你的要求——提示词、风格、Basic Settings、Generate、StoryBoard 场景、面板。 *Where:* 状态栏的 🎙 Voice（Ctrl+Alt+V）。 *Since:* 2.564.0
- **StoryBoard 网格；🎞 编写故事板** — 场景以类似 Model manager 的卡片排列在网格中，用 ➜ 指向下一个场景，点击可打开完整的场景卡片；LLM 编写各个场景，每个场景都会以其故事板图片作为起始（First）帧。 *Where:* StoryBoard（▦ / ☰、🎞 Write storyboard、☑ Start on it）。 *Since:* 2.565.0
- **MOSS-Image** — OpenMOSS 的 5B 图像模型，提供两种图像风格（SFT、Base）；Settings ▸ Add-ons ▸ MOSS-Image 会将你勾选的模型、文本编码器和 VAE 下载到 ComfyUI 中，并检查 ComfyUI 版本是否足够新。 *Where:* Settings ▸ Add-ons；Settings ▸ Image（各风格）。 *Since:* 2.566.0
- **NitroFusion2 图像** — 把 Z-Image-Turbo 蒸馏到 1-2 步：一步就有清晰的文字和细节；三个风格（1 步、配合去蒸馏 LoRA 的 2 步、适合小显卡的 GGUF），cfg 1，无负面提示词。 *Where:* Image 停靠栏的风格，文件在 Settings > Add-ons > NitroFusion2。 *Since:* 2.729.0
- **主题编辑器：对齐、内边距、外边距、圆角** — Style 面板可对齐文字（左 / 居中 / 右 / 两端对齐，上 / 中 / 下——适用于按钮、弹性行 / 列、网格和文字块），为元素及其文字设置内边距和外边距（每一边单独设置，= 同时设置四边），并可单独设置每个角的圆角。 *Where:* 🖌 Edit theme 模式 ▸ 点击某个元素 ▸ Text / Box。 *Since:* 2.567.0
- **由 LLM 编写的 StoryBoard 图片** — 🖼 将场景发回给 LLM，为其开场帧编写图片提示词，并以角色设定表和上一个场景的最后一帧（若该场景已有镜次）作为参考图；📁 更换图片（其他场景的图片、某个镜次的帧、项目图片或文件）；图片在网格中铺满整张卡片。 *Where:* StoryBoard ▸ ▦ 网格 ▸ 卡片的 🖼 / 📁；工具栏上的 ☑ LLM writes it / ☑ Previous last frame。 *Since:* 2.568.0
- **🔲 区域（图像编辑器）** — 画布上的若干框，每个框写明其中要放的内容；可逐框填充（每个框执行一次 ✨ Generate）、由 Edit 模型一次完成（在副本上勾出各框轮廓），或作为区域提示词一次完成（生成新图片，每个框的文字只作用于框内）。 *Where:* Image editor ▸ ✨ AI panel ▸ 🔲 Zones；与选框工具放在一起的 Zones 工具。 *Since:* 2.569.0
- **🎭 区域角色 LoRA** — 区域的 🎭 可选择一个只在该框内生效的角色 LoRA（最多两个不同的 LoRA），让两个角色在同一张图片中各自保持自己的面孔；场景描述作用于整张图片。 *Where:* Image editor ▸ ✨ AI ▸ 🔲 Zones ▸ ▦ Regional（Settings ▸ Add-ons ▸ Nougan Nodes）。 *Since:* 2.592.0
- **🖊 数位板（图像编辑器）** — 带曲线的笔压（预设或自定义）、最轻触压 / 满压力区间、你的笔所发送的压感级数、倾斜、橡皮擦端和侧键；所有画笔均支持压力 → 大小 / 不透明度；7 种笔刷（G-pen、Mapping pen、Brush pen、Real pencil、Fineliner、Technical pen、Calligraphy）。 *Where:* Image editor ▸ 🖊 Pen 标签页（位于 🖌 Brush 旁）、Window ▸ Pen Tablet；画笔预设 ▾。 *Since:* 2.570.0
- **多选并拖动多个片段；⛓ 顺序排列** — 在 Gallery、Assets 或 References 中按住 Ctrl / Shift 点击多个片段，一起拖到时间线上（最早的放在最上层，依次首尾相接）；⛓ Sequential 让时间线上的片段沿各图层依次连续播放，删除、新建图层和修剪后都不会留下空隙。 *Where:* Gallery / Assets / References（Ctrl / Shift+点击、拖动）；时间线工具栏 ▸ ⛓ Sequential。 *Since:* 2.571.0
- **✨ 自动转场；🔇 视频声音** — 在不同图层的视频片段之间的每个剪切点添加 N 帧转场，不移动任何片段（与歌曲的口型同步保持精确——前一个片段会延续到下一个片段之下）；一个按钮即可将所有视频图层静音 / 取消静音，只播放完整的歌曲。 *Where:* 时间线工具栏 ▸ ✨ Auto transition [frames] [type]、🔊 Video sound。 *Since:* 2.572.0
- **✂ 歌曲剪切时长** — StoryBoard 歌曲条可按任意间隔自动剪切（2-60 s；29.9 = 每个场景一次 Long video 运行）；已锁定的段落保持不变；设置会被记住。 *Where:* 歌曲条的菜单栏 ▸ ✂ [s]。 *Since:* 2.573.0
- **⤓ 更新 ComfyUI；启动时检查更新** — 就地更新 ComfyUI（使用便携版自带的更新程序，或 git + pip），可选 Newest 或 Stable 通道，由本应用启动的 ComfyUI 会随之重启；启动后在 GitHub 上检查 bitGen Studio 和 ComfyUI，任一有新版本时状态栏显示 ⬆。 *Where:* Settings ▸ ComfyUI ▸ ⟳ ComfyUI updates；Settings ▸ General ▸ ⟳ Updates ▸ Check for updates on startup。 *Since:* 2.573.0
- **FastH3 Omni** — 以 8 步完成 MiniMax H3 的参考图生视频（FastVideo）：一种视频风格、一个 StoryBoard Workflow、一个负责下载的附加组件，以及在任何加载它的 H3 工作流图上应用的配方（shift 12/3、VSA、8 步）。 *Where:* Settings ▸ Add-ons ▸ FastH3 Omni；StoryBoard ▸ Workflow ▸ FastH3 Omni。 *Since:* 2.573.0
- **在主题编辑模式中重命名面板标题和任意文字** — 面板的标题栏，以及按钮 / 框旁带文字的任意元素，都可改用新文字（保留下拉箭头和按钮，折叠后依然保留新文字）。 *Where:* 🖌 主题编辑模式 ▸ 选取 ▸ Layout ▸ Text。 *Since:* 2.574.0
- **随处显示当前步数 / 总步数** — 图片（ComfyUI 和 sd-cli）、音乐和视频会实时报告采样器步数，所有显示正在运行的生成任务的面板、对话框和卡片都会显示“第 n 步 / 共 total 步”。 *Since:* 2.574.0
- **主题编辑 ▸ Apply to: This element only（默认）** — 每次选取都只作用于该元素本身；新文字绝不会扩散到其他面板或元素。 *Where:* 🖌 主题编辑模式 ▸ Apply to。 *Since:* 2.574.1
- **模型管理器：你的文件、缩略图、元数据** — 模型的图片 / 视频 / 声音及其提示词 + 种子 / cfg / 步数（从文件或渲染记录中读取），点击打开查看器，✎→ 发送到提示词，🖼 设为缩略图。 *Where:* 🧩 Model manager ▸ ⓘ ▸ Your pictures, videos and sounds；✎ Edit ▸ Thumbnail。 *Since:* 2.575.0
- **模型管理器：半星评分、模型类型、NSFW** — 以半星为单位的五星评分编辑器、模型类型（检查点（checkpoint）、LoRA …）以及 NSFW 标记；筛选栏可按这两项筛选。 *Where:* 🧩 Model manager ▸ ✎ Edit；筛选栏。 *Since:* 2.575.0
- **✎→ 从任意文件发送到提示词** — 将文件的提示词及其种子、cfg 和步数发送到提示词框 + Basic Settings。 *Where:* 图库、Assets、References 的缩略图块；查看器的 ⓘ 详情。 *Since:* 2.575.0
- **状态栏中的 Civitai 同步** — 同步时显示 🔄 Civitai n/total，完成时显示 ✓ synced 及各项计数。 *Since:* 2.575.0
- **面板按离开时的布局恢复** — ▣ 面板的成员、标签顺序、当前显示的标签页、隐藏 / 折叠状态、最小化的浮动面板、扩展面板——重启后都会保留。 *Since:* 2.575.0
- **按 SHA-256 进行 Civitai 同步** — 按名称找不到的模型会按文件内容查找；状态栏显示读取进度 n%。 *Where:* 🧩 Model manager ▸ 🔄 Sync。 *Since:* 2.576.0
- **🧩 发送到模型… / Ctrl+↓ 设为缩略图** — 查看器可将图片 / 视频 / 歌曲连同其元数据发送到某个模型的文件中；Ctrl+↓ 将图片设为该模型的缩略图。 *Where:* 查看器；🧩 Model manager ▸ ⓘ。 *Since:* 2.576.0
- **自定义姿势表** — Character creator 的 🧍 Pose sheet 对话框会显示 pose_sheets 文件夹中图片的缩略图；选中的那张决定角色设定表的分格、姿势和机位角度。 *Where:* StoryBoard ▸ 🖼 NEW（Character creator）▸ Sheet ▸ Pose sheet；pose_sheets 文件夹。 *Since:* 2.577.0
- **📐 SolidCraft 面板** — 开源参数化 3D CAD（SolidCraft，MIT OR Apache-2.0）位于独立面板中，包含 SolidCraft 的全部功能；设计和零件保存在项目中，SolidCraft 的 Save 会使其保持最新；可将模型的图片（或 SolidCraft 的渲染图）送入图像编辑器，将模型作为时间线 3D 图层，将图像编辑器的草图图层送入 SolidCraft，并将 STEP / STL / OBJ / 3MF 导入项目。 *Where:* 状态栏中的 📐 SolidCraft；Settings ▸ Add-ons ▸ SolidCraft。 *Since:* 2.578.0
- **从 SolidCraft 发送** — 将零件发送到图像编辑器、时间线、📏 Sketcher（2.630.0：作为一个组——此前是 House builder）、Blender（随之打开并保存为 .blend——找到 Blender 时显示）和 Unreal（作为 Static Mesh 放入关卡——设置了 Unreal 项目时显示；插件 1.4.0）；仅在安装了 SolidCraft 时显示该面板。 *Where:* 📐 SolidCraft 的工具栏。 *Since:* 2.579.0
- **无需设置即可使用已安装 ComfyUI 的模型** — Settings 中未指定 ComfyUI 文件夹时，会自动查找本机上的 ComfyUI（环境变量、应用旁边、主目录、Pinokio、Stability Matrix、各驱动器根目录、ComfyUI Desktop），并在 Model manager 和 Basic Settings 中列出其检查点和扩散模型；点击 Use this folder 即可将其设定下来。 *Where:* 🧩 Model manager；Basic Settings ▸ Model / checkpoint；Settings ▸ ComfyUI ▸ Folder。 *Since:* 2.622.0
- **从磁盘删除模型** — 删除该文件、其旁边的相关文件以及它的 model_info 页面，删除前会弹出确认，列出这些文件及使用该模型的风格。 *Where:* 🧩 Model manager ▸ 卡片上的 🗑 / ⓘ ▸ 🗑 Delete。 *Since:* 2.579.0
- **设置 ▸ 面板** — 列出每个面板和浮动窗口（包括扩展的），显示其所在位置，↺ Reset 可将其恢复到默认位置和大小；↺ Reset all 全部重置。 *Where:* Settings ▸ Dockers。 *Since:* 2.579.0
- **模型路径（extra_model_paths.yaml）** — 管理 ComfyUI 额外模型路径的每个组：➕ 新建组（other_ui1、other_ui2 …，根据其 base 下的文件夹自动填充），更改 / 添加 / 删除路径（用 📁 选择），重命名，is_default，🗑 删除组；文件的其余内容保持不变，并保留上一版的 .bak 备份；⟳ Restart ComfyUI。 *Where:* 🧩 Model manager ▸ 📁 Model paths。 *Since:* 2.580.0
- **Civitai 视频和动态图片** — 🔄 Sync / ⤓ Civitai info 也会保存模型的视频和 GIF 示例；视频缩略图在卡片及其 ⓘ 页面上播放，查看器也可播放；视频可用作卡片的缩略图。 *Where:* 🧩 Model manager。 *Since:* 2.581.0
- **LLM 提示词中的 LoRA 关键词** — ✨ Enhance 和提示词聊天会将所选 LoRA 的关键词（触发词）写入提示词；LLM 遗漏的关键词由 Enhance 补上。 *Where:* Prompt 面板 ▸ ✨ Enhance / 提示词聊天。 *Since:* 2.581.0
- **✨ 在 SolidCraft 中生成零件** — 文字描述或图片 -> CadQuery 代码（cadrille，或带错误修复的本地 LLM）-> SolidCraft 自身可编辑的草图、拉伸、切除、孔、圆角和倒角（按体积校验；否则将 STEP 作为单个实体导入）；代码可编辑并重新运行。 *Where:* 📐 SolidCraft ▸ ✨ Generate；Settings ▸ Add-ons ▸ CAD generate。 *Since:* 2.581.0
- **Fibo 2.0（编辑，低显存）** — Bria 的 8B 模型，提供两种图像风格：Edit Turbo（4 步指令编辑）和 Dev（文生图 + 编辑）；最多 4 张图片 <image_1>..；w4a8 或 GGUF Q4_0 文件适用于约 8 GB 显存的显卡；从 Settings ▸ Add-ons ▸ Fibo 2.0 下载（CC BY-NC 4.0）。 *Where:* image editor ▸ ✨ AI ▸ Edit；Settings ▸ Image。 *Since:* 2.582.0
- **团队 ▸ 渲染农场** — 基于 NAS 文件夹的团队：负责人审批成员，其 bitGen 每天为每位成员签发一个签名密钥；所有人打开相同的项目；PC 的所有者可允许成员在该 PC 上渲染（不限时段或指定起止时间），且仅在该 PC 运行 bitGen 并开启共享时有效；🖥 Render on: This PC / 某位成员的 PC / ⚡ Spread，并显示团队的渲染任务和进度。需处于同一网络或使用 Tailscale。2.589.0：改为可选的附加组件（单独的 zip——可能会触发杀毒软件）。 *Where:* Settings ▸ Add-ons ▸ Team render farm，然后 Settings ▸ Team；状态栏的 🖥 状态标签。 *Since:* 2.583.0
- **🔁 比较 LLM** — 同一个提示词依次由每个勾选的 LLM 回答，每条回复显示在聊天中各自的名称下；✓ Use this one 将其设为答案，每一轮（请求、每条回复、所做的选择、耗时）都会被记录，🏆 显示每类工作（剧本、音乐视频、歌曲、图片 / 视频提示词、聊天）的最佳 LLM，附带胜率、平均耗时及 CSV 导出。 *Where:* 提示词面板的菜单栏（🔁 ▾ 🏆）。 *Since:* 2.584.0
- **用你的选择训练 LLM** — 🔁 Compare LLMs 的每一轮都会保存完整的提示词；🏆 ▸ 🎓 将选中的回复（示例）以及“选中 vs 未选中”配对发送到训练器的 LLM 任务；训练器从 Examples（SFT）或 Preferences（DPO / ORPO，Beta）中学习，并写出新的 .gguf。 *Where:* 🏆 ▸ 🎓 Train an LLM on your picks；🎓 LoRA trainer ▸ Job ▸ Learn from、Dataset ▸ 🔁 Preference pairs。 *Since:* 2.585.0
- **附加组件 ▸ LLM** — 聊天 / 写作用的 LLM 集中在一个下拉框中（★ Qwen3.8 27B——用作你自己检查点的基础模型、Gemma 4 31B / 12B、Qwen3.5 9B、Qwen3 4B / 8B / 14B），下载到 LLM 文件夹；训练器的 Qwen3.8 27B 基础模型可在 32 GB 显存的显卡上以 4-bit QLoRA 方式训练。 *Where:* Settings ▸ Add-ons ▸ LLM；🎓 LoRA trainer ▸ Base model。 *Since:* 2.586.0
- **⤒ 导入并检查 ComfyUI 工作流** — 任意保存版 / API 版工作流：统计其图片 / 视频 / 声音输入，将预览节点改为保存节点，报告缺失的节点和模型文件，连接 Prompt / Negative / Seed / Steps / CFG / 尺寸 / 时长控件，并绘制工作流图；▶ Test run 使用测试输入试运行——成功时保存到 comfy_workflows/ 并附带工作流图，失败时显示 ComfyUI 的错误。 *Where:* Settings ▸ ComfyUI ▸ Graphs。 *Since:* 2.587.0
- **面板开关 + 布局** — 👁 关闭某个面板及其状态栏按钮；🗂 Layouts 可保存 / 应用 / 导出 / 导入整个面板布局及主题（layouts/<name>.json）；★ Save as the default = layouts/default.json + themes/default.json，用于全新安装。 *Where:* Settings ▸ Dockers。 *Since:* 2.587.0
- **⚡ 实时生成（图像编辑器）** — Krita 的实时模式：每次更改后稍等片刻即重新渲染（以实时强度对整张图片执行 Refine，并使用独立的风格 / 步数 / 尺寸 / 🔒 种子），一次只渲染一张，以最新的更改为准，模型常驻加载，排在队列最前，从不出现在队列面板 / 图库中；▣ 以混合比例显示在画布上；✔ Apply as layer 作为图层应用。 *Where:* Image editor ▸ ⚡（菜单栏）/ View ▸ ⚡ Live Generation。 *Since:* 2.588.0
- **🎨 艺术家模式（图像编辑器）** — 只显示画布，全屏且无边框；Alt+P 在指针处打开调色板（方形色域 + 色相条、色块、最近使用），Alt+G 打开 Layers 面板 + ⏳ Pending，Ctrl+P 打开提示词面板（从当前所在图层生成），Ctrl+B 打开画笔（预设、大小、不透明度、流量），Ctrl+Esc（或 Ctrl+Shift+F）返回。 *Where:* Image editor ▸ 🎨 Artist mode（紧接在菜单之后）/ View ▸ Artist Mode。 *Since:* 2.588.0 (2.590.0 起命名为 Artist mode)
- **🧬 RefMods 库** — 适用于所有项目的 MiniMax H3 参考 mod，存放在 refmod/<name>/ 中：7 种类型（角色、地点、载具、物体、道具、植物、动物），上传的媒体自动分类到 images / videos / audio，✨ 使用视觉模型自动生成描述，🧬 Extract（图片 + 视频帧）-> 生成的 .safetensors 保存在该文件夹中，在提示词中写 @name 即可使用。 *Where:* 🎓 LoRA & fine-tune trainer ▸ 🧬 RefMods。 *Since:* 2.588.0
- **SolarRenderer** — 结构视频（+ 首帧、六段式提示词）-> 在 MiniMax H3 上以 4 步生成片段：节点包 + LoRA 作为附加组件提供，其工作流通过 ⤒ Import & check 导入。 *Where:* Settings ▸ Add-ons ▸ SolarRenderer；Settings ▸ ComfyUI ▸ Graphs ▸ ☀ SolarRenderer。 *Since:* 2.588.0
- **带服务器组件的可选扩展** — 扩展（ext/<id>/）可自带服务器代码（ext.json 中的 "server"），在启动时挂载，且仅在其运行时显示；Settings ▸ Add-ons 可从扩展的 zip 安装（📦）和移除扩展。Team render farm 就是这样一个扩展——因可能触发杀毒软件而未包含在安装 zip 中。 *Where:* Settings ▸ Add-ons ▸ Team render farm。 *Since:* 2.589.0
- **图像编辑器的每个标签页都是面板** — 将标签页拖出 = 浮动；拖到另一个面板上 = 成为其标签页；拖到面板栏边缘 = 在该处成为独立面板；⠿ 可拖动整个面板；布局会被保留；Window ▸ Show All Dockers / Reset Docker Tabs。 *Where:* 图像编辑器的各面板。 *Since:* 2.590.0
- **📺 Unreal 视图** — 所选 Unreal / MetaHuman 图层（图像编辑器）或 Unreal 片段（时间线，位于播放头处）的摄像机画面，实时来自 Unreal；S / M / L、⏸、⚡ 让 Unreal 在 bitGen 后台保持流畅。Unreal 必须保持运行，但无需位于前台。 *Where:* 图像编辑器（有 Unreal 图层时打开）；时间线 UNREAL ▸ View ▸ 📺 Unreal View。 *Since:* 2.590.0 (bitGen Bridge 1.5.0)
- **使用中 LoRA 的关键词** — ✨ Enhance 和提示词聊天只写入 Basic Settings 临时 LoRA 的关键词（Override style 开启时），或所选风格的 LoRA 的关键词（关闭时）。 *Where:* Basic Settings ▸ Override style；该风格的 LoRA。 *Since:* 2.585.0

### 选区

- **选框、套索与魔棒** — Shift 添加，Alt 减去，Shift+Alt 取交集；羽化会柔化下一个选区。*Where:* M、L、W
- **Select 菜单** — All、Deselect、Reselect、Inverse、Color Range、Modify（Border、Smooth、Expand、Contract、Feather），以及载入图层的透明度或蒙版。*Where:* Select 菜单
- **快速蒙版** — 选区以红色显示；绘画即可添加，擦除即可移除。*Where:* Q
- **Segment Anything** — 点击某个物体即可选中它，按住 Shift 点击可选中更多，也可拖出一个框；一次性安装后在本机运行。*Where:* Object Selection 工具（W）。*Since:* 2.390.0
- **选择主体** — 一步选中画面的主要主体：使用内置方式（无需下载）或 AI 抠图（在本机运行的 BiRefNet）。*Where:* Select > Subject，Subject Settings。*Since:* 2.488.0
- **移除背景** — 将主体放入图层蒙版，隐藏背景。*Where:* Layer > Remove Background。*Since:* 2.488.0
- **按文字查找** — 输入要选择的内容（"the person's head"、"dog, car"），然后将其选中或做成蒙版。*Where:* Object Selection 选项栏，Select > Subject。*Since:* 2.390.0
- **分割图层** — 将图层拆分为各个组成部分，每个部分各占一个图层，并放在一个组中。*Where:* Layer > Segment Layer。*Since:* 2.390.0
- **选择并遮住** — 一个专用工作区，提供 Quick Selection、Refine Edge 和 Brush 工具，多种视图，边缘半径、平滑、羽化、对比度、移动边缘、净化颜色，并可输出为选区、蒙版或新图层。*Where:* Select > Select and Mask（Alt+Ctrl+R）。*Since:* 2.423.0
- **磁性套索** — 沿边缘移动时，线条会自动吸附到边缘上。*Where:* L。*Since:* 2.423.0
- **快速选择** — 涂抹时选区会自动扩展到边缘，支持 Auto-Enhance。*Where:* W。*Since:* 2.423.0
- **选择天空** — 选中延伸到画面顶边的天空，沿天际线柔和过渡。*Where:* Select > Sky。*Since:* 2.423.0
- **存储的选区** — 将选区存入 Alpha 通道，之后可再次载入。*Where:* Select > Save Selection，Load Selection。*Since:* 2.423.0
- **蒙版叠加** — 绘制蒙版时，被蒙版隐藏的部分显示为红色，也可设为始终显示。*Where:* View > Mask Overlay。*Since:* 2.391.0

### 绘画与修饰

- **画笔与铅笔** — 20 种画笔预设（另有你自己的预设和导入的 .abr 画笔），数字键调整不透明度，笔压控制大小和流量；另有硬边铅笔。*Where:* B
- **画笔设置** — 笔尖角度、圆度和翻转；形状动态、散布、纹理、双重画笔、颜色动态、传递和平滑，按预设分别保存。*Where:* Brush 选项卡。*Since:* 2.484.0
- **画笔预设与 .abr 画笔** — 将当前画笔另存为你自己的预设（brushes/<name>.json），并导入 .abr 画笔文件中的采样画笔。*Where:* Brush 选项卡。*Since:* 2.484.0
- **仿制图章与历史记录画笔** — 从源点仿制；将图层绘制回刚打开时的状态。*Where:* S 和 Y
- **橡皮擦、减淡、加深、海绵、模糊、锐化、涂抹** — 经典的修饰画笔。*Where:* E、O 和 R
- **污点修复** — 内容识别或近似匹配，从污点周围取样填充。*Where:* J。*Since:* 2.423.0
- **修复画笔** — 复制的内容会自动采用落点处的颜色和光照。*Where:* J。*Since:* 2.423.0
- **修补** — 将选区拖到干净的纹理上；Normal 模式提供 Transparent 和 Diffusion，Content-Aware 模式提供 Structure 和 Color。*Where:* J。*Since:* 2.423.0
- **内容识别移动** — 移动或复制某个物体，其原位置会被自动填充，可设置 Structure 和 Color。*Where:* J。*Since:* 2.423.0
- **红眼** — 点击红色瞳孔即可。*Where:* J。*Since:* 2.423.0
- **内容识别填充** — 用画面其余部分填充选区，不使用 AI。*Where:* Edit > Content-Aware Fill，Edit > Fill。*Since:* 2.423.0
- **内容识别填充工作区** — 选择取样区域（自动、矩形或手绘），查看实时预览，设置颜色适应和输出图层。*Where:* Edit > Content-Aware Fill。*Since:* 2.448.0
- **混合器画笔** — 涂抹时颜料会沾取画布上的颜色。*Where:* B。*Since:* 2.423.0
- **背景橡皮擦与魔术橡皮擦** — 擦除与画笔下颜色相近的部分，或擦除整片同色区域。*Where:* E。*Since:* 2.423.0
- **渐变工具** — 线性、径向、角度、对称或菱形渐变。*Where:* G
- **油漆桶** — 用前景色、背景色或渐变填充，可设置容差、连续和所有图层。*Where:* G，Shift+G。*Since:* 2.396.0
- **裁剪** — 拖出一个框，选择比例，按 Enter 裁剪。*Where:* C

### 变换与变形

- **自由变换** — 移动、缩放、旋转，或直接输入 X、Y、W、H 和角度。*Where:* Ctrl+T
- **斜切、扭曲、透视与变形** — 角点沿边移动、任意移动、镜像移动，或使用带预设和弯曲度的变形网格。*Where:* Edit > Transform。*Since:* 2.422.0
- **变形网格与拆分线** — 从 3 x 3 到自定义网格；可交叉、垂直或水平拆分变形，以获得更多控制点。*Where:* Edit > Transform > Warp。*Since:* 2.450.0
- **操控变形** — 放置图钉并拖动，自然地弯曲图层。*Where:* Edit > Puppet Warp。*Since:* 2.422.0
- **图钉深度与旋转** — 决定折叠处哪一部分位于上层；图钉的旋转可固定，也可保持自由。*Where:* Puppet Warp 选项栏。*Since:* 2.465.0
- **内容识别缩放** — 变窄或变宽时，人脸、物体和边缘保持原有形状；可保护选区。*Where:* Edit > Content-Aware Scale（Alt+Shift+Ctrl+C）。*Since:* 2.422.0
- **液化** — 向前变形、重建、旋转扭曲、褶皱、膨胀，以及冻结蒙版和解冻蒙版。*Where:* Filter > Liquify（Shift+Ctrl+X）。*Since:* 2.422.0
- **液化附加功能** — Smooth、Push Left，以及针对眼睛、鼻子、嘴巴和脸型的人脸识别滑块。*Where:* Filter > Liquify。*Since:* 2.450.0
- **移动工具控制柄** — 单击显示缩放控制柄，双击显示旋转和斜切控制柄；文字保持可编辑，形状保持为矢量。*Where:* V。*Since:* 2.452.0
- **变换选项** — 角度、旋转 90 度、翻转，以及以中心为基准的 W x H 百分比。*Where:* Move 工具的选项栏。*Since:* 2.452.0

### 智能对象与智能滤镜

- **智能对象** — 将图层或组放入其中并保持可编辑；缩放、旋转和变形都不会损失画质。*Where:* Layer > Smart Objects。*Since:* 2.422.0
- **编辑内容** — 打开内部内容，任意修改，所有副本都会随之更新。*Where:* 双击缩略图。*Since:* 2.422.0
- **替换、导出、转换、栅格化** — 从文件替换内容、导出内容、将其转换回图层或普通像素；New Smart Object via Copy 可创建一个独立的智能对象。*Where:* Layer > Smart Objects。*Since:* 2.422.0
- **智能滤镜** — 对智能对象应用的任何滤镜或调整都会作为可重新编辑的滤镜添加：开 / 关、设置、不透明度、顺序。*Where:* 图层下方的各行。*Since:* 2.422.0
- **滤镜蒙版** — 通过绘制决定智能滤镜在哪些区域生效。*Where:* Smart Filters 行。*Since:* 2.422.0
- **智能滤镜混合模式** — 每个智能滤镜都有 24 种混合模式和单独的不透明度。*Where:* 右键点击智能滤镜。*Since:* 2.434.0
- **链接的智能对象** — 内容存放在项目链接文件夹中的一个文件里；修改该文件，图层随之更新。*Where:* File > Place Linked。*Since:* 2.469.0
- **转换、嵌入与重新链接** — 将嵌入的智能对象转换为链接对象，嵌入链接的智能对象，或将其重新链接到另一个文件；缺失的文件会被标记出来。*Where:* Layer > Smart Objects。*Since:* 2.469.0

### 调整、滤镜与图层样式

- **图像调整** — 全部 24 种调整直接应用于像素，另有 Auto Tone、Auto Contrast 和 Auto Color。*Where:* Image > Adjustments
- **阴影 / 高光与 HDR 色调** — 局部色调：按数量、色调和半径提亮阴影、保留高光；HDR 效果，可调边缘光、灰度系数、曝光和细节。*Where:* Image > Adjustments。*Since:* 2.480.0
- **可选颜色** — 在九个颜色范围内增减青色、洋红、黄色和黑色，可选相对或绝对方式；也可作为调整图层使用。*Where:* Image > Adjustments，Layer > New Adjustment Layer。*Since:* 2.480.0
- **替换颜色与匹配颜色** — 在画面上拾取一种颜色并调整其色相、饱和度和明度；让一个图层采用另一个图层、合并画面或某个文件的颜色。*Where:* Image > Adjustments。*Since:* 2.480.0
- **颜色查找** — 3D LUT：来自共享 LUT 库的时间线调色效果和 .cube 文件，按数量混合；也可作为调整图层使用。*Where:* Image > Adjustments。*Since:* 2.480.0
- **应用图像** — 将另一个图层、合并画面或其中某个通道以 11 种模式混合到图层上，可设置不透明度和反相。*Where:* Image > Apply Image。*Since:* 2.480.0
- **图像大小与画布** — Image Size、带锚点的 Canvas Size、旋转、裁剪到选区以及裁切。*Where:* Image 菜单
- **滤镜** — 模糊、扭曲、杂色、像素化、渲染、锐化和风格化滤镜，均可实时预览；Ctrl+F 重复上一个滤镜。*Where:* Filter 菜单
- **镜头光晕、旋涡、投影、3D 挤出** — 点击画面即可放置光晕或旋涡的中心。*Where:* Filter 菜单。*Since:* 2.397.0
- **模糊组与模糊画廊** — Surface、Smart 和 Lens Blur（深度、光圈叶片、散景高光）、Average；Field、Iris、Path 和 Spin Blur，点击即可放置中心。*Where:* Filter > Blur，Filter > Blur Gallery。*Since:* 2.481.0
- **杂色与智能锐化** — Reduce Noise、Dust & Scratches、Despeckle；Smart Sharpen 可去除高斯模糊、镜头模糊或动感模糊，并可在阴影和高光中渐隐。*Where:* Filter > Noise，Filter > Sharpen。*Since:* 2.481.0
- **其他滤镜** — High Pass、Minimum、Maximum、Offset、5 x 5 的 Custom 卷积核以及 HSB / HSL。*Where:* Filter > Other。*Since:* 2.481.0
- **扭曲组与像素化组** — Displace（以图层作为置换图）、Polar Coordinates、Pinch、ZigZag、Shear、Glass；Color Halftone、Crystallize、Pointillize、Facet、Fragment、Mezzotint。*Where:* Filter > Distort，Filter > Pixelate。*Since:* 2.481.0
- **光照效果与渲染组** — 聚光灯、点光源和无限光，可使用高度纹理；Fibers 和 Difference Clouds；Diffuse、Tiles 和 Trace Contour。*Where:* Filter > Render，Filter > Stylize。*Since:* 2.481.0
- **艺术效果、素描与纹理** — Cutout、Poster Edges、Watercolor、Dry Brush、Graphic Pen、Charcoal、Grain 和 Craquelure。*Where:* Filter > Artistic，Sketch，Texture。*Since:* 2.481.0
- **冲印滤镜** — 照片冲印工具：白平衡、曝光、色调、纹理、清晰度、去朦胧、自然饱和度、色调曲线、八色混合器、黑白、颜色分级、锐化与降噪、光学、几何、颗粒和暗角，提供预设并可保存你自己的预设。*Where:* Filter > Develop Filter（Alt+Shift+Ctrl+A）。*Since:* 2.482.0
- **镜头校正** — 去除桶形或枕形畸变、色边和暗角；借助网格校正透视、角度和缩放；填充边缘。*Where:* Filter > Lens Correction（Alt+Shift+Ctrl+R）。*Since:* 2.482.0
- **导航器、直方图、信息与注释面板** — 小画面上的视图框；带统计数据的通道直方图；指针下的 RGB、HSB 和 CMYK 值及颜色取样器；列出所有注释。*Where:* Color 面板组，Window 菜单。*Since:* 2.483.0
- **颜色取样器、标尺、注释与计数工具** — 最多十个取样器，可拉直图层或画面的标尺，固定在画面上的注释，以及编号的计数组。*Where:* Eyedropper 的工具组（I）。*Since:* 2.483.0
- **透视裁剪** — 将四个角对准本应方正的物体；按 Enter 裁剪并将整个画面校正方正。*Where:* Crop 工具组（C）。*Since:* 2.483.0
- **扩大选取、选取相似、焦点区域、变换选区、修边** — 按颜色扩大或扩展选区，选择清晰的部分，移动 / 缩放 / 旋转选区；去边并移除黑色或白色杂边。*Where:* Select 和 Layer 菜单。*Since:* 2.483.0
- **快速调整与滤镜菜单** — 作用于当前图层；有选区时仅作用于选区内部。*Where:* 图像编辑器
- **图层样式** — 投影、内阴影、外发光和内发光、描边、颜色叠加、渐变叠加和图案叠加、斜面和浮雕、光泽；可复制和粘贴样式。*Where:* fx，或双击缩略图
- **样式预设** — 一键应用 Gold、Chrome、Neon、Embossed、Glass、3D Pop、Retro、Fire、Ice 和 Letterpress。*Where:* Layer Style 对话框。*Since:* 2.397.0

### 文字

- **横排文字、直排文字与路径文字** — 字母沿绘制的线条排列；可移动起点或翻转到另一侧。*Where:* T，Shift+T。*Since:* 2.397.0
- **全部大写、下划线、删除线、竖排** — Type 选项栏中的按钮。*Where:* Type 选项栏。*Since:* 2.397.0
- **文字形状与 3D** — 十一种变形、环绕圆形、沿路径排列或挤出的 3D 字母，均保持可编辑。*Where:* Layer > Text Shape。*Since:* 2.397.0
- **字符面板** — 字体、字形、大小、行距、字距微调、字距调整、缩放、基线偏移、仿粗体和仿斜体、小型大写字母、上标和下标。*Where:* Window > Character。*Since:* 2.426.0
- **段落面板** — 对齐、两端对齐、缩进、段前和段后间距、连字。*Where:* Window > Paragraph。*Since:* 2.426.0
- **段落文字** — 用 Type 工具拖出一个框，文字会在框内自动换行；可在点文字和段落文字之间转换。*Where:* T。*Since:* 2.426.0
- **字符样式与段落样式** — 新建、应用、清除覆盖以及重新定义样式。*Where:* Character 和 Paragraph 面板。*Since:* 2.426.0
- **按字符设置** — 输入时选中部分字母，仅更改它们的字体、大小、颜色或任意 Character 设置。*Where:* Type 工具。*Since:* 2.449.0
- **OpenType 功能** — 连字、替代字、花饰字、序数、分数、数字样式、小型大写字母和样式集，均来自字体本身的文件。*Where:* Character 面板。*Since:* 2.466.0
- **视觉字距** — 根据字母的形状确定间距。*Where:* Character 面板。*Since:* 2.466.0
- **文字转轮廓** — 将文字转换为由其轮廓构成的形状图层，或由其创建工作路径。*Where:* Layer > Type。*Since:* 2.466.0
- **形状内文字** — 用 Type 工具在形状内部点击，文字会在其轮廓内排列。*Where:* Type 工具。*Since:* 2.466.0
- **文字效果预设** — 与时间线相同的分层 3D 文字预设，实时绘制。*Where:* Type 选项栏，文字图层的 Properties。*Since:* 2.411.0
- **预设适用于所有形状** — 变形、环绕圆形、沿路径、竖排和 3D 都会保留文字的预设（3D 侧面使用其颜色并加深）。*Where:* ⌒ Shape / 3D… *Since:* 2.607.0
- **用文字填充形状** — 让文字在形状内排列（Fit 自动调整大小），拉伸文字以填满轮廓，或作为形状的填充按行重复。*Where:* 右键点击形状，Shape 工具栏，Layer ▸ 🅰 Fill Shape with Text…。*Since:* 2.608.0
- **16 种变形预设** — 在 Arc … Squeeze 之外新增 Shell Lower、Shell Upper、Fisheye、Twist 和 Wedge。*Where:* ⌒ Shape / 3D…，Edit ▸ Transform ▸ Warp。*Since:* 2.608.0
- **文字和形状上的变形网格** — 拖动网格上的点（预设、3 x 3 … 5 x 5、拆分线）；文字仍可输入，形状仍可编辑，变形随之更新。*Where:* Type / Shape 工具栏中的 ⌗ Warp Grid，右键点击。*Since:* 2.608.0

### 钢笔、路径与矢量蒙版

- **钢笔** — 角点和平滑锚点、闭合、尖角、45 度步进、自动添加和删除。*Where:* P。*Since:* 2.421.0
- **自由钢笔与锚点工具** — 手绘并拟合曲线；添加、删除和转换锚点。*Where:* Shift+P。*Since:* 2.421.0
- **弯度钢笔与橡皮带** — 曲线平滑地穿过你点击的各点；预览下一段。*Where:* P。*Since:* 2.425.0
- **路径选择** — 移动、复制、组合和变换整个组件；对齐和分布组件。*Where:* A。*Since:* 2.421.0
- **直接选择** — 锚点和控制柄，微移，角点或平滑。*Where:* A。*Since:* 2.421.0
- **形状或路径模式** — 绘制形状图层或工作路径；合并、减去、交叉或排除。*Where:* 选项栏。*Since:* 2.421.0
- **自定形状工具** — 心形、星形、爆炸形、箭头、对话气泡、云朵等，另有你自己的形状。*Where:* U，Edit > Define Custom Shape。*Since:* 2.421.0
- **路径面板** — 工作路径、存储的路径、形状路径和矢量蒙版；填充、描边、建立选区或蒙版。*Where:* Paths 选项卡。*Since:* 2.421.0
- **矢量蒙版** — 显示全部、隐藏全部、当前路径；浓度、羽化、反相、链接和栅格化。*Where:* Layer > Vector Mask。*Since:* 2.421.0
- **路径跟随画面** — 裁剪、画布大小、图像大小和旋转也会同时移动路径。*Where:* 图像编辑器。*Since:* 2.421.0
- **任意路径圆角** — 将路径、合并形状或矢量蒙版中选中的角变为圆角。*Where:* Direct Selection，Radius 框。*Since:* 2.466.0

### 矢量线条与绘图工具

- **贝塞尔工具** — 尖角和平滑节点、15 度步进、闭合，或继续延长开放线条。*Where:* F5。*Since:* 2.425.0
- **手绘、2 点线、折线、3 点曲线、B 样条、节点钢笔** — 其他曲线工具。*Where:* 再按一次 F5。*Since:* 2.425.0
- **箭头与线条样式** — 实线、虚线、点线、点划线和自定义线条，带起点和终点箭头（箭头、三角形、圆形、方形、菱形、横条等）。*Where:* 曲线工具的属性栏。*Since:* 2.425.0
- **形状工具（节点）** — 选取并拖动节点、控制柄和线段；添加、删除、连接、断开、反转、闭合和精简节点。*Where:* F10。*Since:* 2.425.0
- **轮廓笔** — 颜色、宽度、虚线、角、线端、位置、箭头、置于填充之后、随对象缩放。*Where:* F12。*Since:* 2.425.0
- **转换为曲线** — 矩形、椭圆、多边形或线条变为可编辑的矢量线条。*Where:* Ctrl+Q。*Since:* 2.425.0
- **矢量线条与路径** — 线条可转换为记住其轮廓的路径，也可再转换回来。*Where:* Layer > Vector Line。*Since:* 2.425.0
- **形状工具** — 可将每个角分别设为圆角、扇形角或倒角的矩形、3 点矩形、带饼形和弧形的椭圆、3 点椭圆、多边形、星形、复杂星形、螺旋、网格纸和常见形状，均为实时可调形状。*Where:* F6。*Since:* 2.428.0
- **以绘制模式并入形状** — 将新形状以新建、添加、减去、交叉或排除的方式并入所选形状。*Where:* 形状工具栏。*Since:* 2.439.0
- **艺术笔** — 预设、书法、压力和喷涂笔触，绘制后成为填充形状。*Where:* F5。*Since:* 2.428.0
- **连接器** — 直线、直角或圆角线条，会跟随其连接的对象移动。*Where:* F8。*Since:* 2.428.0
- **标注** — 带文字的 3 点标注。*Where:* F8。*Since:* 2.428.0
- **自动填充** — 闭合曲线或新形状会以最后选取的颜色填充。*Where:* 曲线工具栏。*Since:* 2.430.0
- **悬停与选取高亮** — 使用 Move 工具时，指针下的对象以蓝色勾勒，选中的对象以橙色勾勒；在空白画布上点击则不选取任何对象。*Where:* Move 工具。*Since:* 2.470.0
- **绘制后切换到移动工具** — 绘制形状后会自动选用 Move 工具并选中新形状（可关闭）。*Where:* CAD 工具栏的设置。*Since:* 2.470.0

### 矢量工作面板

- **变换面板** — 围绕九个锚点进行位置、旋转、缩放和镜像、大小和斜切操作，可生成副本。*Where:* Window > Dockers（Alt+F7）。*Since:* 2.429.0
- **造形面板** — 焊接、修剪、相交、简化、前减后、后减前、边界。*Where:* Window > Dockers。*Since:* 2.429.0
- **对齐与分布** — 对齐到活动对象、选区、页面边缘或页面中心。*Where:* Shift+Ctrl+A。*Since:* 2.429.0
- **对象属性** — 矢量形状的填充（均匀或渐变）、轮廓和透明度。*Where:* Alt+Enter。*Since:* 2.429.0

### 框架与画板

- **框架** — 将图层放入闭合形状内；图层只在形状内显示，并随形状移动、旋转和缩放。*Where:* Layer > Frame > Place Inside Frame。*Since:* 2.442.0
- **编辑与提取框架内容** — 单独编辑内容、完成编辑或将内容取出。*Where:* 双击或右键点击框架。*Since:* 2.442.0
- **锁定框架内容** — Move 工具会选中框架，其控制柄会连同内容一起变换。*Where:* Lock Contents to Frame。*Since:* 2.453.0
- **画板** — 在一个画面中包含多个各有尺寸的页面，尺寸可来自预设或自行设置。*Where:* Layer > New > Artboard。*Since:* 2.447.0
- **画板工具与从组创建** — 拖出新画板，或将组转换为画板。*Where:* 再按一次 V，Layer > New > Artboard from Group。*Since:* 2.447.0
- **导出画板** — 将每个画板导出为单独的 PNG。*Where:* File > Export > Artboards to Files。*Since:* 2.447.0

### 尺寸标注

- **尺寸标注工具** — 平行、水平 / 垂直和角度标注，按指定 dpi 换算单位。*Where:* F8。*Since:* 2.428.0
- **精确点** — 标注会吸附到节点、边的中点、角点、轮廓和辅助线交点，悬停时显示点的名称。*Where:* 尺寸标注工具。*Since:* 2.441.0
- **实时端点** — 拖动标注的端点，其数值随之更新。*Where:* 对标注使用 Move 工具。*Since:* 2.441.0
- **每个画面一个比例** — 输入某个标注的实际尺寸和单位，所有标注都按该比例测量。*Where:* 属性栏。*Since:* 2.441.0
- **标注组** — 每个标注都是由尺寸界线和尺寸线组成的组，根据其测量值重新绘制。*Where:* Layers 面板。*Since:* 2.457.0
- **自动标注** — 标注所选对象的整体宽度和高度。*Where:* Layer > Auto Dimension。*Since:* 2.458.0
- **平面图标注** — 在闭合形状外侧标注每一面墙，另加整体尺寸。*Where:* Layer > Floorplan Dimensions。*Since:* 2.458.0
- **连续标注工具** — 沿一条线标注每两个相邻点之间的距离，另加总长。*Where:* F8。*Since:* 2.458.0

### 标尺、辅助线与吸附

- **带单位的标尺** — 像素、毫米、厘米、英寸或点。*Where:* View > Rulers（Ctrl+R）。*Since:* 2.440.0
- **辅助线** — 从标尺中拖出、移动、锁定、输入位置、列出和清除。*Where:* View > Guidelines。*Since:* 2.440.0
- **吸附** — 吸附到网格、辅助线、对象、节点、中点、交点和页面；Move 工具会吸附图层的边界框。*Where:* View > Snap To。*Since:* 2.440.0
- **网格按钮与设置** — 间距、主网格线、线条或点、颜色和吸附距离。*Where:* 顶部栏，以及 Grids and Guides 设置。*Since:* 2.445.0

### 通道

- **通道面板** — 单独查看 RGB、Red、Green 或 Blue，或将通道的亮度载入为选区。*Where:* Channels 选项卡。*Since:* 2.423.0
- **Alpha 通道** — 可查看、载入、重命名和绘制的存储选区。*Where:* Channels 选项卡。*Since:* 2.423.0
- **编辑单个颜色通道** — 绘画、填充、滤镜和调整只改变所选的通道。*Where:* Channels 面板（Ctrl+3 到 Ctrl+5）。*Since:* 2.467.0
- **专色通道** — 叠加在画面上显示的油墨颜色和密度，需要时可合并到图层中。*Where:* Channels 面板，Select > New Spot Channel。*Since:* 2.467.0

### 颜色、渐变与图案

- **颜色色块** — 默认颜色、互换（会重新绘制纯色背景）、带轮廓的大色块。*Where:* D 和 X。*Since:* 2.396.0
- **调色板** — 一条颜色条：点击设置填充色，右键点击设置形状或文字的轮廓色；在像素图层上则分别设置前景色和背景色。*Where:* 编辑器右边缘。*Since:* 2.430.0
- **透明色块** — 设为前景色时，画笔会绘制出透明。*Where:* 调色板和 Swatches 面板。*Since:* 2.430.0
- **渐变编辑器** — 预设及你自己的渐变，色标可设置颜色、不透明度和位置；供渐变工具、油漆桶、填充图层和形状使用。*Where:* Edit > Gradient Editor。*Since:* 2.434.0
- **图案库** — 从画面定义图案、图案填充图层、用图案填充，并可在 Pattern Overlay 中使用你的图案。*Where:* Edit > Define Pattern，Pattern Library。*Since:* 2.437.0

### 动作与自动化

- **动作** — 录制菜单命令、对话框、滤镜和 Layers 面板中的更改，然后播放；动作可分组，并带有一个默认组。*Where:* Actions 选项卡（Alt+F9）。*Since:* 2.427.0
- **编辑动作** — 步骤开 / 关、在对话框处停止、插入停止和菜单项目、功能键、按钮模式、载入和存储。*Where:* Actions 选项卡。*Since:* 2.427.0
- **批处理** — 对多张图片或一个文件夹播放动作，结果保存到项目、图库或下载文件夹。*Where:* File > Automate > Batch。*Since:* 2.427.0
- **录制画笔笔触和手绘选区** — 在相同位置回放，并按画面大小缩放。*Where:* Actions 选项卡。*Since:* 2.468.0
- **条件步骤** — 如果文档为横向、纵向或方形，有选区，或含某类图层，则播放一个动作，否则播放另一个。*Where:* Actions > Insert Conditional。*Since:* 2.468.0
- **图像处理器** — 将图片存储为 JPEG 和 / 或 PNG，可调整大小，也可先执行一个动作。*Where:* File > Scripts > Image Processor。*Since:* 2.468.0
- **快捷批处理** — 一个图块，将图片拖放到上面即可对每张图片运行动作。*Where:* File > Automate > Create Droplet。*Since:* 2.468.0
- **.atn 动作文件** — 从 .atn 文件载入动作组；能匹配的步骤会照常播放，其余步骤载入后处于关闭状态。*Where:* Actions > Load Actions。*Since:* 2.469.0

### 文件

- **新建、打开与保存到 Images** — 以背景色新建画面；将可见画面保存到项目的 Images 中。*Where:* File（Ctrl+N、Ctrl+O、Ctrl+S）
- **导出为** — PNG、JPEG、WebP、JPEG XL、AVIF、GIF、TIFF、BMP 或 TGA，可设置质量和缩放，带预览并显示文件大小。*Where:* File > Export As
- **文件信息** — 标题、作者、描述、关键词、版权和 URL，随文档保存，并写入导出的 PNG 和 JPEG 文件。*Where:* File > File Info（Alt+Shift+Ctrl+I）。*Since:* 2.485.0
- **打印** — 适合页面、指定尺寸或百分比，纵向或横向，然后打开系统的打印对话框。*Where:* File > Print（自 2.645.0 起为 Ctrl+Shift+P - Ctrl+P 会将提示词面板置于最前）。*Since:* 2.485.0
- **联系表** — 将来自文件或已打开文档的图片以网格排列在一个新文档中，每张图片一个图层，并带标题。*Where:* File > Automate > Contact Sheet。*Since:* 2.485.0
- **裁剪并拉直照片** — 找出扫描件上的每张照片，将其拉直，并作为单独的文档打开。*Where:* File > Automate > Crop and Straighten Photos。*Since:* 2.485.0
- **自动对齐图层** — 以其中一个图层为基准对齐所选图层：透视、移动 / 旋转 / 缩放，或仅移动。*Where:* Edit > Auto-Align Layers。*Since:* 2.486.0
- **自动混合图层** — 用蒙版将图层混合成全景图（柔和接缝、匹配色调）或景深堆栈（每处取最清晰的图层）。*Where:* Edit > Auto-Blend Layers。*Since:* 2.486.0
- **照片合并** — 将相互重叠的图片（文件或已打开的文档）拼接成一个全景文档，每张图片一个带蒙版的图层。*Where:* File > Automate > Photomerge。*Since:* 2.486.0
- **合并到 HDR** — 先对齐包围曝光的照片，再将其融合为一张曝光良好的图片。*Where:* File > Automate > Merge to HDR。*Since:* 2.486.0
- **图像模式** — Bitmap、Grayscale、Duotone（1-4 种油墨）、Indexed Color（调色板、仿色、可使用 .act 文件的 Color Table）、RGB 和 CMYK（印刷模型：纸张、黑版生成、总油墨量）。*Where:* Image > Mode。*Since:* 2.487.0
- **校样颜色与色域警告** — 查看画面印刷后的效果，以及哪些颜色无法印刷；仅在屏幕上显示。*Where:* View > Proof Setup，Proof Colors（Alt+Ctrl+Y），Gamut Warning（Shift+Ctrl+Y）。*Since:* 2.487.0
- **CMYK TIFF** — 导出四色印刷油墨，交给印刷厂。*Where:* File > Export As > TIFF (CMYK, for print)。*Since:* 2.487.0
- **JPEG XL 文件** — 打开、置入和拖放 .jxl 图片；以指定质量或无损方式导出 JPEG XL；.jxl 图片在应用中处处都能显示，发送给 ComfyUI 和合成时会转为 PNG。*Where:* File > Open，Export As > JPEG XL，Assets 面板。*Since:* 2.479.0
- **复制与粘贴** — 复制、剪切、粘贴、原位粘贴、合并复制，以及系统剪贴板中的图片。*Where:* Edit 菜单
- **PSD 文件** — 图层、组、蒙版、不透明度、混合模式、可见性、图层样式、矢量蒙版和形状在导入和导出时均可保留。*Where:* File > Open PSD，Save as PSD。*Since:* 2.390.0
- **保留 PSD 智能对象** — 嵌入的智能对象会作为智能对象打开，并以置入图层的形式存回。*Where:* PSD 文件。*Since:* 2.469.0
- **SVG 路径与形状** — 将路径导出为 SVG，将 SVG 置入为形状图层。*Where:* File > Export Path as SVG，Place SVG as Shape Layer。*Since:* 2.421.0
- **PDF 文件** — 页面打开后为不含文字的页面图像，外加每行文字一个文字图层；可使用所有工具编辑。*Where:* File > Open PDF。*Since:* 2.424.0
- **PDF 页面** — 添加空白页或另一个 PDF 的页面，移动页面（用按钮或拖动）以及删除页面；按新顺序保存，未改动的页面保持原样。*Where:* PDF Pages 页面条，File > Add / Remove PDF Pages。*Since:* 2.488.0
- **保存 PDF** — 修改过的页面以真实、可搜索的文字存回；未修改的页面保持为矢量。*Where:* File > Save PDF，Save as New。*Since:* 2.424.0
- **在 PDF 中嵌入字体** — 每行文字都以其本身的字体写入（字体来自本机或字体文件夹），因此任何文字体系都保持为真实文字。*Where:* Save PDF 对话框。*Since:* 2.435.0
- **.bgi 项目文件** — 图层、蒙版、实时文字、形状、填充、调整、样式、带滤镜的智能对象、路径、通道、选区和图层复合均以完全可编辑的形式保存在一个 zip 中，任何解压工具都能打开。*Where:* File > Save Project（Alt+Ctrl+S）。*Since:* 2.436.0

### 图像编辑器中的 AI

- **AI 面板** — 模型会看到选区及一圈上下文边距，并在羽化的选区内以新图层的形式给出结果。*Where:* AI 面板
- **生成** — 根据提示词面板中的提示词渲染到所选图层的选区中；Apply 将结果融合进画面。*Where:* AI 面板的 Generate 选项卡。*Since:* 2.444.0
- **编辑** — 使用 Qwen Image 2.1 edit 执行在提示词面板中输入的指令。*Where:* AI 面板的 Edit 选项卡。*Since:* 2.444.0
- **重绘、移除与背景** — 按指定强度重新处理，移除所选内容，或重新生成其余所有内容。*Where:* AI 面板
- **扩展** — 扩大画布，并将画面延续到新区域中。*Where:* AI 面板
- **结果** — 生成 1 到 4 个版本，进行比较，然后应用或放弃。*Where:* AI 面板
- **控制图层** — 涂鸦、线稿、软边缘、Canny、深度、法线、姿势或分割图层通过 ControlNet 引导 AI。*Where:* Control 面板
- **合成** — 将图层作为参考图：把一个图层中的物体放进另一个图层的场景中。*Where:* AI 面板。*Since:* 2.390.0
- **发送到参考图** — 所选图层会进入参考图面板，可用于任何渲染。*Where:* Layer > Send to References。*Since:* 2.390.0
- **保留参考图** — 参考图面板一有变化就写入项目（关闭应用后仍会保留），其中所有图片都会保存，F/L、Swap 或 Text 模式也不再丢失图片。*Where:* 参考图面板。*Since:* 2.548.0
- **输入时即保存共享提示词** — StoryBoard 的共享提示词会在输入后片刻、离开输入框时以及关闭时保存。*Where:* StoryBoard > Scenes。*Since:* 2.548.0
- **在形状或蒙版中生成填充** — 在形状的轮廓或图层的蒙版内生成，并裁切到其范围内。*Where:* Layer 菜单。*Since:* 2.437.0
- **生成到形状中** — 当闭合形状处于活动状态时，结果会作为框架放入其中。*Where:* AI 面板。*Since:* 2.442.0
- **提示词面板跟随选项卡** — Edit 选项卡会将提示词面板切换为图像编辑，Generate 选项卡则切换为生成到选区中。*Where:* AI 面板。*Since:* 2.451.0
- **从 3D 图层生成** — 根据你当前看到的 3D 视图生成一张新图像。*Where:* 3D 选项卡。*Since:* 2.460.0

## CAD 与 3D

带约束的精确绘图、测量、CAD 文件，以及由草图生成的参数化 3D 实体。

### 草图图层

- **草图图层** — 由直线、矩形、圆和圆弧组成的 CAD 草图，靠约束和尺寸保持形状，带有固定原点和两条构造轴。 *Where:* Layer > New Sketch，或任意草图工具。 *Since:* 2.462.0
- **草图工具** — Sketch Select、Line、2-Point 与 Center Rectangle、Circle、3-Point Arc、Point 和 Sketch Dimension，各有自己的字母键。 *Where:* 工具列中的 N。 *Since:* 2.462.0
- **连续线段** — 逐点点击；接近水平或竖直的线会自动吸附并获得 Horizontal 或 Vertical 约束；端点相遇处自动连接。 *Where:* Line 工具。 *Since:* 2.462.0
- **构造几何** — 将所选对象转为虚线构造线，它们永远不会绘制到图片中。 *Where:* X。 *Since:* 2.462.0
- **草图选择** — 在约束保持不变的同时选取并拖动点、线和圆的边。 *Where:* 使用草图工具时按 S。 *Since:* 2.462.0
- **绘制草图时的颜色** — 蓝色表示仍可自由移动，黑色表示已完全约束，橙色虚线为构造线，灰色数字为从动尺寸。 *Where:* 草图中。 *Since:* 2.462.0
- **轮廓转形状** — 每个封闭区域都会成为草图上方的一个形状图层。 *Where:* Profiles > Shapes。 *Since:* 2.462.0
- **填充轮廓** — 以你选择的线条颜色和线宽填充封闭区域。 *Where:* Sketch 选项卡。 *Since:* 2.462.0
- **完成草图** — 返回 Move 工具。 *Where:* Sketch 选项卡。 *Since:* 2.462.0
- **保存在 .bgi 中** — .bgi 文件会保留所有约束；移动或缩放图层时，其草图随之移动。 *Where:* .bgi 文件。 *Since:* 2.462.0

### 约束与尺寸

- **约束** — Coincident、Collinear、Concentric、Midpoint、Fix、Parallel、Perpendicular、Horizontal、Vertical、Tangent、Equal 和 Symmetric。 *Where:* Sketch 选项卡。 *Since:* 2.462.0
- **自由度** — 显示还剩多少自由度，完全约束时显示对勾。 *Where:* Sketch 选项卡。 *Since:* 2.462.0
- **拒绝过约束** — 已由其他约束确定的约束会被拒绝，尺寸则改为从动尺寸。 *Where:* 草图中。 *Since:* 2.462.0
- **草图尺寸** — 直线的长度、两点间的距离、两条线的夹角、圆的直径或圆弧的半径；直接输入数值，支持算式。 *Where:* D。 *Since:* 2.462.0
- **绘制时输入尺寸** — 绘制过程中输入长度和角度、宽度和高度、直径或半径；这些数值会作为尺寸保留下来。 *Where:* 任意草图工具。 *Since:* 2.464.0

### 更多草图工具

- **多边形** — 指定中心、一个角点和边数，多边形保持在一个构造圆上。 *Where:* N 工具组。 *Since:* 2.463.0
- **槽** — 两个半圆由相切的直线连接。 *Where:* N 工具组。 *Since:* 2.463.0
- **两点圆与三点圆** — 由直径或三个点确定一个圆。 *Where:* N 工具组。 *Since:* 2.463.0
- **样条曲线** — 一条平滑穿过你点击的每个点的曲线。 *Where:* N 工具组。 *Since:* 2.463.0
- **修剪** — 剪掉直线、圆或圆弧在最近两个交点之间的部分。 *Where:* T。 *Since:* 2.463.0
- **延伸** — 将直线延长到下一条直线或圆。 *Where:* E。 *Since:* 2.463.0
- **圆角与倒角** — 在拐角处生成相切圆弧或直线切角，其数值作为尺寸保留。 *Where:* F。 *Since:* 2.463.0
- **偏移** — 按一定距离生成保持平行或同心的副本。 *Where:* Sketch 选项卡 > Modify。 *Since:* 2.463.0
- **偏移工具** — 点击一条链，再由指针决定偏移的方向和距离（也可直接输入）；无论按什么方向绘制的线都会一起向外或向内偏移，圆角拐角保持相连。 *Where:* Sketch 选项卡 > Modify > Offset (O)。 *Since:* 2.494.0
- **镜像** — 关于一条直线保持对称的镜像副本。 *Where:* Sketch 选项卡 > Modify。 *Since:* 2.463.0
- **矩形阵列与圆形阵列** — 按行列或绕一点排列的副本，带有相同的约束。 *Where:* Sketch 选项卡 > Modify。 *Since:* 2.463.0

### 测量、单位与 CAD 文件

- **测量** — 测量单个对象、两个对象之间或封闭区域内的长度、角度、半径、面积和周长；数值可复制。 *Where:* 使用草图工具时按 M。 *Since:* 2.464.0
- **单位** — 像素，或带比例的毫米和英寸。 *Where:* Sketch 选项卡 > Measure and CAD files。 *Since:* 2.464.0
- **导出 DXF** — 导出 CAD、激光和 CNC 程序都能打开的 R12 DXF，构造线和尺寸位于各自的图层。 *Where:* File > Export Sketch as DXF。 *Since:* 2.464.0
- **导出 SVG** — 按实际尺寸导出草图及其线条和轮廓。 *Where:* File > Export Sketch as SVG。 *Since:* 2.464.0
- **导入 DXF** — 将直线、圆、圆弧、多段线、样条曲线和椭圆导入草图，可适配画面或按实际尺寸，端点连接成轮廓。 *Where:* File > Import DXF。 *Since:* 2.464.0

### CAD 工具栏

- **功能区工具栏** — 选项卡下是成组的大按钮；点击组名可展开该组的全部项目；可折叠为只显示选项卡。 *Where:* 图像编辑器和时间线的顶部。 *Since:* 2.470.0
- **Sketch 选项卡** — Create（新建草图、直线、矩形、圆、圆弧、多边形、槽、样条曲线、点）、Modify（圆角、倒角、修剪、延伸、偏移、镜像、阵列、构造）、12 种约束、Inspect（尺寸、测量）、Insert（DXF 导入与导出、SVG 导出）以及 Finish Sketch。 *Where:* CAD 工具栏。 *Since:* 2.470.0
- **Shapes 选项卡** — Select（Move 工具、取消选取）、Draw（形状工具）以及绘制后切换开关。 *Where:* CAD 工具栏。 *Since:* 2.470.0
- **选项卡跟随当前工作** — 选取草图工具或草图图层会打开 Sketch 选项卡；在时间线上选取 3D 图层会打开 3D 选项卡。 *Where:* CAD 工具栏。 *Since:* 2.470.0
- **时间线选项卡** — Create（文本、3D 文本、3D 模型、摄像机、路径、画布工具）、3D（控件、视图、关键帧、烘焙）以及 Sketch。 *Where:* 时间线的 CAD 工具栏。 *Since:* 2.470.0
- **在帧上绘制草图** — 播放头所在的帧，或与时间线尺寸相同的空白图片，会在图像编辑器中打开，并新建一个草图图层。 *Where:* 时间线的 Sketch 选项卡。 *Since:* 2.470.0
- **显示或隐藏** — 工具栏可以常驻显示，也可以只在需要时显示。 *Where:* Window > CAD Toolbar，或 ⌬ CAD 按钮。 *Since:* 2.470.0
- **CAD 按钮** — 选取草图、草图工具或 3D 实体时，CAD 工具栏会自动显示；工具列中的 ⌬ CAD 按钮可让它保持显示（时间线有自己的按钮）。 *Where:* 图像编辑器和时间线的工具列。 *Since:* 2.494.0
- **草图流程** — Select 位于 Sketch 选项卡最前；编辑草图时 Create Sketch 隐藏；Finish Sketch 之后转到 Solid 选项卡。 *Where:* CAD 工具栏。 *Since:* 2.494.0
- **从线段继续绘制** — 所选直线两端之外各有一个 ＋，点击即从该端开始使用 Line 工具。 *Where:* Sketch Select。 *Since:* 2.494.0

### 参数化 3D 实体

- **实体图层** — 根据其特征绘制的 3D 实体，作为智能对象存在，因此移动、缩放、滤镜和蒙版都能使用。 *Where:* CAD 工具栏的 Solid 选项卡，Layer > 3D Body。 *Since:* 2.471.0
- **拉伸** — 将草图的封闭轮廓按距离拉伸，可单侧、对称或双侧，生成新实体，或与某个实体合并、剪切或求交。 *Where:* Solid 选项卡。 *Since:* 2.471.0
- **选取轮廓** — Extrude 和 Revolve 允许你点击要使用的封闭区域，指针下的区域会高亮显示。 *Where:* Solid 选项卡。 *Since:* 2.494.0
- **旋转** — 将轮廓绕草图的 X 轴、Y 轴或其中一条线按角度旋转。 *Where:* Solid 选项卡。 *Since:* 2.471.0
- **圆角与倒角** — 对全部、顶部、底部、竖直或水平的边进行倒圆或倒斜角。 *Where:* Solid 选项卡。 *Since:* 2.471.0
- **抽壳** — 将实体掏空，顶部或底部开口。 *Where:* Solid 选项卡。 *Since:* 2.471.0
- **分割实体** — 用平面切开；一侧保留，另一侧成为新的实体图层。 *Where:* Solid 选项卡。 *Since:* 2.471.0
- **参数** — 带单位（mm、cm、m、in、deg）的命名数值和表达式，供所有特征使用；修改其中一个，实体随即重建。 *Where:* Solid 选项卡的 Change Parameters。 *Since:* 2.471.0
- **特征列表** — 按顺序列出所有特征：可抑制、编辑、删除或重新排序，出错的特征以红色显示。 *Where:* Body 选项卡。 *Since:* 2.471.0
- **随草图重建** — 之后再编辑草图时，由它生成的实体会随之重建。 *Where:* 实体图层。 *Since:* 2.471.0
- **视图与环绕** — 主视图、前视、俯视、右视、左视、后视，或拖动实体环绕查看。 *Where:* Solid 选项卡。 *Since:* 2.471.0
- **视图立方体与 3D 导航** — 点击立方体的面或角切换到对应视图，拖动它可环绕；Shift + 中键拖动环绕实体，中键拖动平移，滚轮缩放。 *Where:* 选取实体时的画布。 *Since:* 2.494.0
- **外观** — 颜色、金属度、粗糙度和边线，以及视图的转动、倾斜和滚转。 *Where:* Body 选项卡。 *Since:* 2.471.0
- **导出 STL、glTF 和 STEP** — 将实体导出为用于打印、3D 应用或 CAD 的文件。 *Where:* Solid 选项卡 > Export。 *Since:* 2.471.0
- **时间线上的实体** — 将实体作为 3D 图层发送到时间线；实体更改时它会自动更新。 *Where:* 时间线的 Solid 选项卡。 *Since:* 2.471.0
- **在图像编辑器中编辑** — 打开图像编辑器并选中该实体。 *Where:* 时间线的 Solid 选项卡。 *Since:* 2.471.0
- **两种引擎** — 在页面中运行的 OpenCascade（精确的圆角、布尔运算和抽壳，无需安装）或本机上的 Blender。 *Where:* Settings > 3D。 *Since:* 2.471.0

### 图像编辑器中的 3D 图层

- **3D 图层** — 放在图片中的 Daz 或 Blender 场景，每当视图改变时由 Blender 重新渲染；蒙版、滤镜和混合模式都能使用。 *Where:* Layer > New 3D Layer。 *Since:* 2.460.0
- **作为 3D 图层的 3D 模型** — 项目 3D 模型中的 .glb / .gltf / .obj / .fbx / .stl 会作为 3D 图层打开：Blender 将它放进有灯光的场景，并让摄像机对准它取景。 *Where:* Layer > New 3D Layer，或 🧊 Convert to 3D。 *Since:* 2.594.0
- **摄像机** — 场景摄像机，前、后、左、右或顶视，或调整转动、倾斜、距离和镜头；在画布上拖动可环绕、平移和缩放。 *Where:* 3D 选项卡。 *Since:* 2.460.0
- **姿势** — 选取人物和骨骼，在其现有姿势的基础上转动。 *Where:* 3D 选项卡。 *Since:* 2.460.0
- **帧与渲染** — 选取动画场景中的一帧；用 Quick、EEVEE 或 Cycles 渲染，可使用透明背景。 *Where:* 3D 选项卡。 *Since:* 2.460.0
- **模型** — 通过数值或在画布上拖动来移动、转动、缩放或隐藏场景中的对象；.blend 文件本身不会改变。 *Where:* 3D 选项卡 > Model。 *Since:* 2.541.0
- **Blender 模式** — 选取 3D 图层后，提示词面板的 Edit 和 Refine 会先用 Blender 渲染场景，再基于这张图片工作；结果进入 AI 面板，✔ 可将其中一个保留为图层。 *Where:* 提示词面板的下拉菜单。 *Since:* 2.541.0
- **Blender 图层** — 在图像编辑器的画布上使用时间线的 Blender 场景工具（打开 .blend、场景摄像机或自由视图、移动 / 旋转 / 缩放对象、保存）；该视图成为一个图层，提示词面板中的 Edit 会根据场景生成一个新图层。 *Where:* 编辑器的 🟧 按钮，或 Layer > New Blender Layer。 *Since:* 2.542.0
- **配合 Blender 场景使用参考图** — 在提示词中提到 References 面板中的某张图片（"the face of the woman in picture 1"），它就会与场景一起发送给编辑模型；编号和该词会被改成模型自己的写法（image 2、<image2>、Picture 2）。 *Where:* 🟧 Blender 选项卡 > References。 *Since:* 2.546.0
- **恢复内置风格** — ↺ Built-in 列出缺失的内置图像或视频风格并将其恢复；Krea 2 风格会自动恢复一次。 *Where:* Settings > Image styles / Video styles。 *Since:* 2.547.0
- **在 Blender 视图中缩放** — 🔍＋ / 🔍－、Alt+拖动（向前 = 放大，向后 = 缩小）以及 ⌖ Zoom to object (Z)；在图像编辑器中不显示播放条和 Auto-key。 *Where:* Blender 场景工具的按钮。 *Since:* 2.546.0
- **按骨架选取绑定好的人物** — 点击带蒙皮的身体会选中它的骨架，因此移动时整个人物随之移动（而不只是控件）。 *Where:* Blender 场景工具（时间线和图像编辑器）。 *Since:* 2.550.0

### 从图片生成 3D 场景和模型

- **图片转 3D** — Hunyuan3D 2.1（形状）或 TRELLIS.2（形状和纹理）可从任意图片生成 .glb。 *Where:* Gallery 和 Assets 图片上的 3D 按钮。 *Since:* 2.404.0
- **用 AI 搭建场景** — 本地 LLM 用 58 类对象规划 3D 场景和摄像机路径，其余部分使用 3D 模型；由 Blender 完成搭建。 *Where:* Blender 预览的 Build 按钮。 *Since:* 2.404.0

### Sketcher 建模

- **📏 Sketcher 面板** — 在 bitGen 中快速进行 3D 建模：在地面或面上绘制形状，再推 / 拉成实体；模型保存在项目中，边做边自动保存，支持撤销 / 重做。 *Where:* 状态栏的 Sketcher 按钮（默认隐藏）。 *Since:* 2.619.0
- **推 / 拉** — 面变成实体；拉动盒子的顶面使其变高；在面上绘制的形状可向内推（凹槽）或向外拉（凸台）；推到另一侧即成通孔；横穿面的线会将面分割。 *Where:* Sketcher ▸ P。 *Since:* 2.619.0
- **精确尺寸与吸附** — 随时输入长度（m、cm、mm、英尺、英寸）、两个尺寸、边数或角度；指针会吸附到角点、中点、边、面、原点以及红 / 绿 / 蓝坐标轴（方向键或 Shift 锁定其中一条轴）。 *Where:* Sketcher ▸ Measurements 框。 *Since:* 2.619.0
- **直线、矩形、圆、多边形、偏移** — 绘图工具；Offset 在面内生成一圈闭合环（房间四周的墙、框架）。 *Where:* Sketcher ▸ L / R / C / N / F。 *Since:* 2.619.0
- **移动、复制、旋转、缩放、组、上色、擦除、卷尺** — 编辑工具；Ctrl+Move 复制；组作为整体被选取，双击进入组内编辑。 *Where:* Sketcher ▸ M / Q / S / G / B / E / T。 *Since:* 2.619.0
- **视图与显示样式** — Iso / Top / Front / Right / Back / Left，透视或平行投影，显示全部，着色 / 单色 / X 光 / 线框，阴影。 *Where:* Sketcher 的工具条。 *Since:* 2.619.0
- **Sketcher 接入 bitGen** — 将视图图片送入图像编辑器、作为 3D 图层送到时间线、作为场景送到 Blender、作为网格送到 Unreal；导出 .glb / .obj / .stl；项目 3D 模型作为组导入。 *Where:* Sketcher ▸ Send / Export / Import。 *Since:* 2.619.0
- **共用墙体的房间** — 两次点击即可绘制一个房间（墙、地板、天花板）；拖到另一个房间附近时，它的墙会吸附到对方的墙上，两个房间共用一面墙；每个墙面采用其所朝向房间的颜色。 *Where:* Sketcher ▸ Build ▸ U Room，然后 Select + 拖动。 *Since:* 2.620.0
- **墙、地板、天花板、楼梯** — 独立的墙（回到起点时闭合成房间）、没有墙的地板、房间天花板的开 / 关、直跑楼梯。 *Where:* Sketcher ▸ Build ▸ W / J / K / V。 *Since:* 2.620.0
- **门和窗** — 单开门、双开门、推拉门和玻璃门，或无门扇的门洞；单扇窗、双扇窗和推拉窗，带窗台；点击任意墙即可放置（共用墙也会贯通），可沿墙拖动，在面板中设置尺寸。 *Where:* Sketcher ▸ Build ▸ D / I。 *Since:* 2.620.0
- **屋顶** — 覆盖一个或多个房间的人字、四坡、单坡或平屋顶，可设坡度、出檐和厚度；山墙端会用墙封闭。 *Where:* Sketcher ▸ Build ▸ Y Room roof（Shift+点击可添加房间）。 *Since:* 2.620.0
- **灯光** — 筒灯、吸顶灯、吊灯、枝形吊灯、射灯、壁灯、落地灯和台灯，每一盏都是带灯具的真实光源，可设颜色（暖到冷）和亮度；🌙 Night 显示它们的照明效果；导出为 glTF 光源。 *Where:* Sketcher ▸ Build ▸ X Light，工具条上的 🌙 Night。 *Since:* 2.620.0
- **建筑面板** — 显示所选对象（或工具将要创建的下一个对象）的设置：尺寸、高度、样式、颜色、复制、转向、屋顶、删除。 *Where:* Sketcher ▸ 右侧面板。 *Since:* 2.620.0
- **Sketcher 的大纲面板** — 列出每个房间及其墙、地板、天花板、踢脚线、顶角线、门和窗（Room 1 ▸ Wall 1、Ceiling 1 …），以及屋顶、地板、楼梯、灯光、家具、摄像机；👁 隐藏 / 显示；房间分组；新房间自带踢脚线 + 顶角线；墙可沿垂直于墙线的方向拖动（Alt：自由拖动），Shift+点击 = 整个房间。 *Where:* Sketcher ▸ 🗂 Outline。 *Since:* 2.639.0
- **Sketcher 摄像机和家具的旋转环与镜头** — 选中的摄像机或家具会显示可拖动的偏航 / 俯仰 / 滚转旋转环（步长 5°，按住 Shift 自由旋转）；其面板中有 Turn / Tilt (Pitch) / Roll；摄像机的 Lens 预设（Fisheye 8 mm、Ultra wide 14、Wide angle 24、35、50、85、135、200 mm telephoto），Focal length 与 Field of view 相互联动。 *Where:* Sketcher ▸ Select，摄像机 / 家具的面板。 *Since:* 2.633.0
- **从 Sketcher 摄像机看出去的视图** — View ▾ 列出所有摄像机；选中一个即切换到它的视角（使用其镜头），并跟随其面板中的设置；环绕操作会离开该视角。 *Where:* Sketcher ▸ View ▾。 *Since:* 2.631.0
- **打开门窗** — Open (%) 及开启方向：门向内 / 向外摆开，窗扇向外 / 向内打开，推拉式则滑开一扇。 *Where:* Sketcher ▸ 门 / 窗的面板。 *Since:* 2.631.0
- **自动屋顶、自动地板** — 每个新房间都自带屋顶，并在墙下铺一块地板楼板；可按房间开 / 关。 *Where:* Sketcher ▸ U Room 的面板，房间的面板。 *Since:* 2.631.0
- **Sketcher 中的人物** — 站立 / 坐着 / 行走 / 挥手的人体模型，放在地板上，可命名、调整大小。 *Where:* Sketcher ▸ 🛋 ▸ People。 *Since:* 2.630.0
- **旧版本的房屋** — 旧版 House builder 保存的房屋会转换为 Sketcher 模型（房间、门窗洞口、家具、人物、摄像机、灯光、楼梯）。 *Where:* Sketcher ▸ ☰ File ▸ 🏠。 *Since:* 2.630.0
- **Sketcher 中的材质** — 带纹理的材质（砖、石材、木地板、瓷砖、大理石、地毯 …），可涂到面、墙和地板上。 *Where:* Sketcher ▸ ▦ Materials ▾。 *Since:* 2.629.0
- **Sketcher 摄像机 + 360° 地点** — 两次点击放置一台摄像机；可通过它观看；其画面 + 深度图 + 法线图存入 Image 素材；还可从它生成 360° 全景图作为 Location。 *Where:* Sketcher ▸ Z 📷 Camera。 *Since:* 2.629.0
- **🪄 布置房间** — LLM（或该类房间的常用家具组合）为 Sketcher 房间摆满家具。 *Where:* Sketcher ▸ 房间的面板。 *Since:* 2.629.0
- **Sketcher 中的家具** — 家具库（39 件：客厅、餐厅、厨房、卧室、浴室、灯具、户外；含材质和纹理）放在房间地板上，按 R 转向，可拖动、调整大小、着色、复制；项目的 3D 模型作为组导入。 *Where:* Sketcher ▸ A 🛋 Furniture。 *Since:* 2.628.0
- **Sketcher 单独最大化** — ⛶ 关闭其他所有面板（标题栏和状态栏保留）；⇲ Dock 将它们重新打开。 *Where:* Sketcher 的标题栏。 *Since:* 2.628.0
- **模型的真实照片** — （2.627.0：一张干净的渲染图 + 其深度图，提示词以 "Turn this 3D render into a photorealistic photograph of a building ..." 开头）打开提示词面板使用 Sketcher 时：提示词面板切换到 Image，使用编辑模型和 "create a real photo of the model in view"；Generate 将 Sketcher 的视图变成照片，作为普通图片存入 Image 素材；关闭 Sketcher 时，原来的模式、风格和文字会恢复。 *Where:* Sketcher + 提示词面板。 *Since:* 2.626.0
- **Sketcher 图层** — → Image editor 将视图作为 📏 Sketcher 图层发送（再次发送时更新该图层）；→ Timeline 将模型作为 📏 Sketcher 图层（3D）发送。 *Where:* Sketcher 的工具条。 *Since:* 2.626.0
- **面的拉伸与扭转** — 点击一个面：面板中有 Extrude（+ 向外，− 切除）和 Twist；拖动该面可随指针拉伸（Blender 风格）；Ctrl+拖动可转动它并使拉伸扭转；输入距离可修改上一次拉伸。 *Where:* Sketcher ▸ Select。 *Since:* 2.625.0
- **边和角点** — 拖动边或角点即可移动（Shift：只沿一条轴）；Shift+点击添加更多边，Ctrl+点击选取一个面周围的整圈边；边有 Length、Extrude edge（生成新面）和 Fillet（半径、分段数）；角点有 X / Y / Z。 *Where:* Sketcher ▸ Select，面板。 *Since:* 2.625.0
- **手动调整门窗** — 选中的门 / 窗两侧、顶部和底部有控制柄，可调整大小；窗可上下拖动；面板中有 Elevation（离地高度）。 *Where:* Sketcher ▸ Select。 *Since:* 2.625.0
- **地板上的墙** — Room / Wall 工具的 Offset from floor edge（外墙面从地板边缘向内缩进的距离）；拖动房间的一面墙（房间随之拉伸）——地板的吸附区域会显示出来，墙会吸附到边缘上；房间也会吸附到地板边缘。 *Where:* Sketcher ▸ U / W，Select。 *Since:* 2.624.0
- **地形** — 建筑周围的地面：用软画笔抬高 / 降低 / 平滑 / 压平；按高度绘制等高线，地面会在等高线之间平滑成形；使用高度图图片（黑 = 最低，白 = 最高）；将房间下方的地面整平；可设置尺寸、细节、材质、等高距和土体侧面；等高线显示在地面和平面图上。 *Where:* Sketcher ▸ ⛰ Terrain (Alt+G)。 *Since:* 2.653.0
- **挖 / 填平台** — 在地面上挖出 / 填筑的水平平台：点击其角点，设置标高（地面的平均高度，或直接输入），以 1 : n 的边坡回接自然地面，可选挖填 / 仅挖 / 仅填，以 m³ 显示挖方和填方量；选中后可重新整平、重设坡度或再次应用；显示在平面图上。 *Where:* Sketcher ▸ ⛰ Terrain ▸ ✂ Cut / fill。 *Since:* 2.656.0
- **泳池** — 矩形（两个角点或输入尺寸）或自由形状的泳池：浅水端 / 深水端及倾斜的池底，池边砖（压顶）、木平台或两者兼有，及其材质、内衬和水；池下的地面被挖除，四周地面整平；显示池水体积；显示在平面图上。 *Where:* Sketcher ▸ 🏊 Pool，➤ Select 选取泳池。 *Since:* 2.657.0
- **贝塞尔曲线车道** — 沿路线逐点点击，车道会弯曲穿过这些点；拖动其点和贝塞尔控制柄调整形状（Alt：只调一侧），Delete 删除一个点；可设宽度、路面材质、路缘石，贴合地面或位于某一标高，平滑曲线；显示在平面图上。 *Where:* Sketcher ▸ 🛣 Driveway，➤ Select 选取车道。 *Since:* 2.659.0
- **从房间中拆掉一面墙，内墙 / 外墙** — Eraser / Delete / 🗑 Take this wall out 只拆掉一面墙（地板和天花板保留，共用墙会从两个房间同时移除，使两者相通；↺ Put back 可恢复）；每面墙可设为 Auto / Interior / Exterior，内墙的外侧面使用其内侧颜色，内墙在平面图上颜色较浅。 *Where:* Sketcher ▸ 在墙上使用 ⌫ Eraser，➤ Select 选取墙。 *Since:* 2.660.0
- **墙体类型（分层构造）** — 一个墙体类型面板，每种类型由外到内的各层组成（砖、空气层、防潮膜、填充保温棉的木 / 轻钢龙骨、保温板、石膏板、抹灰、外挂板、砌块、瓷砖 ...），显示每层的厚度、墙体总厚度以及按比例绘制的剖面；可用于一面墙、一个房间、所有外墙或内墙——墙体按该厚度建造，以最外层着色，墙顶和平面图上显示各层接缝。 *Where:* Sketcher ▸ 🧱 Wall types；墙的面板 ▸ Wall type。 *Since:* 2.661.0
- **方正的墙端，从角部拖出墙** — 每面墙在角部以方正端头收口（角部和自由端是独立的构件）；用 Select 从角部的某一侧或墙的端头构件拖出，就会朝该方向生成一面新墙（从顶部拖出：任意方向），沿用原墙的高度、厚度和类型。 *Where:* Sketcher ▸ 在角部 / 墙端上使用 ➤ Select。 *Since:* 2.662.0
- **拆分墙、草图平面、Look at** — 双击墙即可拆分（3D 或平面图中）；选取一段可删除或拖出，新墙会将其与房间连接；Wall 工具可在房间墙上任意位置开始 / 结束；角部 / 墙端可设宽度（墙垛）；点击的面即为绘图工具所用的草图平面（2.687.0：不再在其上叠加绘制任何内容），⊥ Look at 正对该面；2.688.0：点击墙的端头构件会选中整面墙，双击则从该端推 / 拉墙，Ctrl+拖动使移动保持水平 / 竖直，工具条始终留在屏幕上，✨ Photo 的提示词只提及模型中实际存在的东西。 *Where:* Sketcher ▸ ➤ Select、✏ Wall、⊥ Look at。 *Since:* 2.663.0
- **⇄ 上一次设置** — 位于提示词面板的图像 / 视频风格下拉菜单旁：在当前风格和上一个风格之间切换；开启 Override style 时，其 Basic Settings 数值和临时 LoRA 也会一并恢复；保存在 model_settings.tmp 中（2.683.0：应用自身更换风格时同样有效；— none — / — template — 也计入）。 *Where:* 提示词面板 ▸ ⇄。 *Since:* 2.680.0
- **P-H3 Image** — PrunaAI 基于 MiniMax H3 的图像模型：*P-H3 Image* 风格（文生图，4-8 MP）和 *P-H3 Image Edit*（最多借助 7 张参考图编辑图片，被编辑的是 `<image1>`）；它自带的提示词扩写器会把简短的请求扩写成完整的提示词。Settings ▸ Add-ons ▸ P-H3 Image 会下载其 LoRA、文本编码器、VAE 和扩写器（约 17 GB），配合视频已在使用的 MiniMax H3 FL2VA transformer。需要带 P-H3 节点的 ComfyUI（master / nightly，0.44）；MiniMax H3 Community License。 *Where:* Settings ▸ Image ▸ P-H3 Image / P-H3 Image Edit。 *Since:* 2.678.0
- **🎨 为图片更换风格** — 图像预览的外观下拉菜单 + 🎨 Change style（2.681.0：所选外观会保持选中）会使用提示词的图像风格，把当前显示的图片重新生成为 📷 Photoreal、🧸 Pixar、🧊 2.5D、🌸 Anime 或 🖍 Cartoon（编辑模型按指令修改并保留原图；SDXL / FLUX 风格则对整张图片进行精修）；开启 Override style 时，Basic Settings 中的步数、CFG、种子、检查点（checkpoint）和 LoRA 会一并使用；结果在预览中打开；图片下方的进度条显示各步骤（2.677.0）；⇆ Before / after 将原图与结果并排显示（2.679.0）。（2.685.0：SDXL / Pony / Illustrious 风格用其自己的工作流重新生成，因此 Override 对其生效；进度条会说明 Override 应用了哪些设置）（2.686.0：非编辑模型的风格会先绘制 ✏ 线稿，再通过其模型系列的线稿 ControlNet 从线稿渲染出该外观） *Where:* 任意图像预览 ▸ 外观下拉菜单 ▸ 🎨 Change style。 *Since:* 2.676.0
- **🛤 道路工具** — 像 SimCity 一样绘制道路：Dirt road、Street、Road、One-way、Avenue 和 Highway（车道、人行道、中央隔离带、护栏、标线），贴合地面；坡度超过该类型的允许值时，⛏ 将地面开挖成均匀坡度，或 🚇 以隧道穿过（深谷上则架桥）；自动识别路口，并设置红绿灯、停车 / 让行标志、停车线、人行横道、路名牌和限速标志；可选择靠左或靠右行驶。 *Where:* Sketcher ▸ Ground ▸ 🛤 Road。 *Since:* 2.673.0
- **檐沟截面** — 屋顶的檐沟是一个截面：内置 Quad、Half round、OG（ogee 正面）和 Square line，也可像踢脚线或顶角线一样在截面编辑器中自己绘制（直线和贝塞尔曲线），沿每条檐口扫掠生成并配有落水管。 *Where:* Sketcher ▸ 屋顶 ▸ Gutters / Gutter profile / ✎ Gutter profiles…。 *Since:* 2.671.0
- **贝塞尔截面编辑器** — 用节点和贝塞尔曲线绘制踢脚线、顶角线、框线和窗台截面（内置圆弧各为一条曲线）；双击线段可添加节点，右键点击可将线段转换为曲线 / 直线或删除节点。 *Where:* Sketcher ▸ 踢脚线 / 顶角线 ▸ ✎ New / edit profiles…。 *Since:* 2.670.0
- **更新和退出时清理 ComfyUI** — ⤓ Update ComfyUI 会先运行 misc\clear-comfy.bat（结束所有 ComfyUI 进程、释放 8188 端口、清除其缓存）；退出时同样执行，并结束所有 bitGen Studio 进程、关闭终端窗口。 *Where:* Settings ▸ ComfyUI（Clear ComfyUI completely when bitGen Studio exits）。 *Since:* 2.669.0
- **屋檐、封檐板和檐沟** — 每个屋顶的檐口可设为 Simple、Open（外露椽尾）、Boxed（平底檐口板）或 Closed（沿坡面衬板），配封檐板 + 山墙封檐板，带落水管的方形或半圆形檐沟，各有自己的颜色。 *Where:* Sketcher ▸ △ Roof / 选中的屋顶。 *Since:* 2.668.0
- **对象面板：形状、构造、重命名** — Sketcher 的对象面板列出每个形状（实体、形状、线、组；点击即可选取，拖动面可推 / 拉——组的面也可以），Construction 标题下列出平面（沿用草图平面，或地面 / 正面 / 侧面）和构造线（Tape measure + Ctrl，可被吸附），双击任意一行即可重命名。 *Where:* Sketcher ▸ 🗂 Outline。 *Since:* 2.667.0
- **屋顶类型** — 人字、四坡、单坡、荷兰式人字、截角人字（jerkinhead）、复折式、孟莎式、盐盒式、四角攒尖、蝶形、平屋顶以及随墙屋顶，通过图片选择，每种都有各自的坡度 / 比例 / 翻转设置。 *Where:* Sketcher ▸ △ Roof (Y) 或选中屋顶的面板。 *Since:* 2.666.0
- **建筑图纸导出为 PDF** — 每层的平面图、四个立面图以及屋顶 / 总平面图，按比例绘制在 A4 - A1 图纸上（横向或纵向），可全部放在一张图纸上，也可每页一个视图，带以 mm 为单位的尺寸标注、标高、房间名称和面积，以及图签（指北针、比例尺、第 n 张 / 共 m 张）。 *Where:* Sketcher ▸ 📄 Plans。 *Since:* 2.665.0
- **照片风格（Sketcher）** — Sketcher 专为 ✨ Photo 使用的图像编辑风格，位于该按钮旁；会被记住。 *Where:* Sketcher 的工具条。 *Since:* 2.696.0
- **屋面材料** — 预涂彩钢板（波纹 / 肋形 / 直立锁边）、混凝土瓦或陶土瓦、石板瓦、沥青瓦、阳光板：颜色、样式、典型最小坡度警告，其重量计入框架校核，并在 ✨ Photo 中写明。 *Where:* Sketcher ▸ 屋顶 / Roof 工具 ▸ Covering。 *Since:* 2.695.0
- **屋顶框架** — 椽子、屋脊、斜脊 / 斜沟、折坡檩条、顶棚搁栅、下檩条 + 支撑（校核椽子和顶棚搁栅，✔ Size them），或桁架布置，适用于所有坡屋顶类型。 *Where:* Sketcher ▸ 选中的屋顶 ▸ 🪵 Roof framing（🪵 Show framing）。 *Since:* 2.694.0
- **墙体框架** — 每面墙中的木框架或轻钢框架：顶板 / 底板、间距 300 / 450 / 600 的立柱、门窗边柱 + 托柱、窗台横撑、横档、名义钢带斜撑、角柱；按房间统计总量。立柱尺寸不做校核（AS 1684 的立柱表）。 *Where:* Sketcher ▸ 选中的房间 ▸ 🪵 Wall framing（🪵 Show framing）。 *Since:* 2.693.0
- **楼面系统 + 过梁** — 房间下方的地面板、华夫格空心板、加劲筏板、墩柱支承的悬空楼板或架空木地板（短桩、托梁、搁栅）；搁栅、托梁和门 / 窗过梁按材料等级的力学性能做梁计算校核（✔ Size them）；🪵 Show framing。仅供参考——请对照 AS 1684 / 跨度表核实，楼板以 AS 2870 为准。 *Where:* Sketcher ▸ 选中的房间 / 门 / 窗。 *Since:* 2.692.0
- **墙体相互对接** — 新墙的端头会抵在它所碰到的墙上停住（自身不加端盖）；首尾相接时，原墙的端头会绕转角成形；落在某面墙的墙线上时，会被截到该墙的墙面。墙厚会记住上一次的设置（大于 2 = mm）。 *Where:* Sketcher ▸ ▮ Wall。 *Since:* 2.691.0
- **相连的墙** — 靠近另一面墙的端头或角部时，Wall 工具会把点拉过去（⊕ 已连接；Shift = 自由）；相连的墙保持连接——拖动其中一面，另一面的端头随之移动，从而变长或变短。 *Where:* Sketcher ▸ ▮ Wall / ➤ Select。 *Since:* 2.690.0
- **橱柜与置物架** — 嵌入式衣柜、步入式衣帽间（L / U 形）、布草柜、食品储藏柜和杂物柜、书架、置物架：在对话框中设置布局、尺寸、分格（挂衣、双层挂衣、搁板、抽屉、鞋架）、柜门、拉手和颜色，并实时显示正视图和平面图；💾 自定义模板可用于所有项目；靠墙放置、面朝室内，↔ Fit the wall 适配墙长；绘制在平面图和图纸上。 *Where:* Sketcher ▸ 🛋 Furniture ▸ Cupboards & shelving。 *Since:* 2.689.0
- **人体模型** — 一个精细建模的女性人体模型（作者 dimasalcalde 和 zahers，CGTrader），用于 Sketcher 中的人物，按人物身高缩放。 *Where:* Sketcher ▸ 🛋 Furniture ▸ People ▸ mannequin (model)。 *Since:* 2.664.0
- **使用你的材质生成真实照片** — ✨ Photo 将渲染图、其深度图以及一张标注了模型材质和背景图片的拼板发送给编辑模型，使照片采用这些材质。 *Where:* Sketcher ▸ ✨ Photo，提示词面板的 ✏ Edit (Sketcher)。 *Since:* 2.652.0
- **材质工具** — 每面墙的内侧和外侧、窗框和玻璃、地板、天花板、装饰线、屋顶、楼梯：可使用颜色、内置材质或图片（来自 Refs 面板、项目或文件）作为重复纹理（大小、旋转）；油漆桶为一面墙的一侧上色（Shift：该侧的所有墙）。 *Where:* Sketcher ▸ 部件的面板，Materials（paint）。 *Since:* 2.651.0
- **背景图与 360° 天空** — 在模型后方放置一张参考图片（铺满视图），或将其作为全景天空包裹整个场景。 *Where:* Sketcher ▸ 🖼 Background。 *Since:* 2.651.0
- **选取与悬停高亮** — 被选中的对象以主题强调色着色，指针下的对象显示为蓝色（已选中时除外）——在 3D 和平面图中均如此。 *Where:* Sketcher。 *Since:* 2.650.0
- **Shift + 右键拖动缩放** — 向前（向上）放大，向后（向下）缩小，以按下的点为中心；单纯右键点击仍会打开菜单。 *Where:* Sketcher、时间线的画布、图像编辑器（🎨 Artist mode 中也可以）。 *Since:* 2.648.0
- **缩放至所选** — ⊡ 让所选内容充满视图：Sketcher 中的面或建筑构件、时间线上选中的图层、图像编辑器的选区（或选中的图层）。 *Where:* Sketcher ⊡，时间线 ⊡，图像编辑器 ⊡ / View ▸ Zoom to Selection (Ctrl+Alt+0)。 *Since:* 2.648.0
- **指针工具** — Sketcher 的 Select 以及时间线和图像编辑器的 Move 都以指针箭头显示。 *Since:* 2.648.0
- **在 Sketcher 中多选** — 单击选取一个对象，Ctrl+点击添加更多（房间、墙、门、家具、灯光、摄像机、面）；拖动其中一个即可全部移动，Delete 全部删除。在 Orbit 中按 Esc = Select；Esc 永远不会让最大化的 Sketcher 停靠回去。 *Where:* Sketcher ▸ ➤ Select。 *Since:* 2.648.0
- **平面图视图** — 以应用的主题颜色从正上方查看 Sketcher，一次显示一层：墙体以实心剖切显示，门带开启弧线，窗带玻璃和窗台，楼梯带踏步和 UP 标记，家具和灯光以平面符号显示，每个房间标有名称、宽 × 长和面积；所有工具都可在其上绘制，点击可选取符号；Orbit 会让它恢复平放。 *Where:* Sketcher ▸ 📐 Plan，View ▾ 📐 Floorplan。 *Since:* 2.647.0
- **Esc = Orbit** — 按一次 Esc 即放下当前工具并取消选取，在所有 Sketcher 视图（3D、平面图、摄像机视图）中切换到 🔄 Orbit。 *Where:* Sketcher。 *Since:* 2.647.0
- **房间宽度和长度** — 每个房间的面板都有 Width 和 Length（矩形保持其角点不动，其他形状则被拉伸）；Room 工具的 Width × Length 一次点击即可放置该尺寸的房间。 *Where:* Sketcher ▸ 房间，Room 工具。 *Since:* 2.647.0
- **从 Artist mode 生成** — 在 🎨 Artist mode 中，Alt+G 在画布上方显示 Layers 面板和 ⏳ Pending，Ctrl+P 显示提示词面板：选取图层，▾ Edit 或 Generate，从 ⏳ Pending 中保留结果——全程不离开全屏画布；调色板为 Alt+P。 *Where:* 图像编辑器 ▸ 🎨 Artist mode。 *Since:* 2.646.0
- **关于与致谢** — Settings ▸ About：版本号、Produced and Developed by Tim Paul、Programmer - Claude Opus 5.5，以及对所有使用了其代码、模型、工具和创意的项目的致谢（链接在浏览器中打开）；Guide 的结尾也有同样的致谢。 *Where:* Settings ▸ About。 *Since:* 2.642.0
- **在摄像机自身视角中移动和转动摄像机** — 通过选中的摄像机观看时，✥ Move / ⟳ Rotate 会在视图前方显示其箭头或旋转环；摄像机与视图一起移动 / 转动；Esc 取消选中。 *Where:* Sketcher ▸ 摄像机的面板，👁 Look through。 *Since:* 2.643.0
- **Ctrl+P：将提示词面板置于最前** — 在应用中任何地方，包括正在输入框中打字时：提示词面板会打开、展开，从关闭的 ▣ 面板中移出，并显示在浮动窗口或最大化面板之上，焦点置于提示词框。 *Where:* 任何地方，🎨 Artist mode 中也可以（2.646.0）。 *Since:* 2.645.0
- **摄像机移动和旋转控件** — 选中的摄像机会高亮显示（无边框），并显示 X / Y / Z 移动箭头：拖动摄像机可在其当前高度上移动，拖动箭头可沿单轴移动（步长 1 cm）；双击可切换到旋转环，再双击切回；点击其他对象则选中该对象。 *Where:* Sketcher ▸ Select，摄像机。 *Since:* 2.641.0
- **每个部件的专属属性** — 在视图或大纲中点击墙、地板、天花板、踢脚线、顶角线或地板楼板，会显示其专属面板：墙的长度、高度和内侧颜色，地板的标高，天花板的类型；Delete 关闭该部件。 *Where:* Sketcher ▸ Select，🗂 Outline。 *Since:* 2.640.0
- **踢脚线、顶角线、框线和窗台的截面** — 图片下拉菜单中有 30 种内置截面；踢脚线沿墙扫掠，转角斜接（在门框处止住），顶角线位于天花板下方，门窗套线环绕门（两面）和窗，另有窗台；✎ Profiles… 可绘制自定义截面（1 mm 网格上的点，按宽 / 高缩放）并保存在项目中。 *Where:* Sketcher ▸ 踢脚线 / 顶角线 / 门 / 窗的面板。 *Since:* 2.640.0
- **斜墙** — 双击墙顶添加一个切点，向上 / 向下拖动（山墙端）；选取顶边后拖动或输入其高度（单坡墙）；Delete 删除切点 / 边。 *Where:* Sketcher ▸ Select。 *Since:* 2.624.0
- **随墙而定的天花板和屋顶** — 房间的天花板可设为 None / Flat / Follows the walls' slope；随墙的屋顶带有檐口宽度。 *Where:* Sketcher ▸ 房间的面板，Y Roof。 *Since:* 2.624.0
- **Sketcher 采用 bitGen 的配色；双击空白处 = Orbit** — 面板及其 3D 视图使用主题颜色；双击空白处会取消所有选取并进入环绕。 *Where:* Sketcher。 *Since:* 2.624.0
- **Sketcher 的独立窗口和 File 菜单** — ⛶ 让它充满标题栏与状态栏之间的整个 bitGen 窗口（之后 ⇲ Dock 将其放回，2.624.0），✕ 将其关闭；☰ File：新建、打开、保存、另存为、重命名、导入、导出、发送、删除、关闭；🖼 → Image editor 和 🎞 → Timeline 按钮；⌂ Cut-away。 *Where:* Sketcher 的标题栏和工具条。 *Since:* 2.620.0

## 桥接

与 Blender、Daz Studio 和 Unreal Engine 5.8 的实时连接，全部在同一台计算机上运行。

### Blender

- **Blender 附加组件** — Blender 侧边栏中的 bitGen 选项卡：将场景或所选内容以 glTF 发送（或作为 3D 图层发送），实时连接会在每次保存时重新发送，还可将项目的 3D 模型导入 Blender。 *Where:* Blender 的侧边栏 (N)。 *Since:* 2.385.0
- **将场景渲染为真实画面** — 通过摄像机渲染 Blender 布局，再由带 3DREAL 的 LTX 2.3 将其转为照片级真实画面。 *Where:* 附加组件的 Render scene 按钮。 *Since:* 2.402.0
- **预览画布中的 .blend** — 在时间线画布上打开 .blend：通过其摄像机或自由视图观看，选择、移动、设置关键帧、复制、隐藏和删除对象。 *Where:* 画布工具中的 Blender 按钮。 *Since:* 2.403.0
- **区段与保存** — 设置 In 和 Out 点，可仅在 bitGen 中保存、保存回原文件，或保存为新文件。 *Where:* .blend 预览的 Properties。 *Since:* 2.403.0
- **从预览渲染为真实画面** — 渲染该区段，并将一个 LTX 2.3 3DREAL 任务加入队列。 *Where:* .blend 预览。 *Since:* 2.403.0
- **添加模型** — 将项目中的 3D 模型添加到打开的场景。 *Where:* .blend 预览的 Properties。 *Since:* 2.404.0
- **预览中的姿势** — 转动人物的骨骼；保存和渲染时，Blender 会为该姿势设置关键帧。 *Where:* .blend 预览的 Pose 部分。 *Since:* 2.461.0
- **送到图像编辑器** — 以当前姿势和视图将场景作为 3D 图层发送。 *Where:* .blend 预览。 *Since:* 2.461.0

### Daz Studio

- **bitGen Bridge 脚本** — 将动画渲染为真实画面、将一帧渲染为图片、将场景作为 3D 发送以打开或合并，或将人物作为 3D 模型发送。 *Where:* Daz Studio 的 Scripts > bitGen。 *Since:* 2.405.0
- **Merge 对话框** — 选择要合并到当前场景中的人物、灯光和摄像机，以及场景摄像机和帧范围。 *Where:* bitGen 中，Daz 场景传入时。 *Since:* 2.405.0
- **作为 3D 图层的 Daz 场景** — 发送场景，并在图像编辑器中将其作为 3D 图层打开。 *Where:* bitGen Bridge > Scene。 *Since:* 2.460.0
- **实时连接（实验性）** — bitGen 直接在 Daz Studio 中移动摄像机和调整姿势。 *Where:* Daz Studio 的 bitGen Live Link、3D 选项卡、时间线的 Pose 部分。 *Since:* 2.461.0

### Unreal Engine 5.8

- **bitGen Bridge 插件** — 一个纯 Python 的 Unreal Editor 插件，列出项目的关卡、Level Sequence、摄像机、MetaHuman 和动画，只响应本机的请求。 *Where:* 项目的 Plugins 文件夹。 *Since:* 2.472.0
- **Unreal 设置** — 端口、"alpha is inverted" 开关、Test connection 以及插件的安装说明。 *Where:* Settings > 3D > Unreal Engine。 *Since:* 2.472.0
- **图像编辑器中的 Unreal 图层** — 通过关卡中某台摄像机看到的关卡画面，或当前的关卡视口画面，作为图片图层。 *Where:* CAD 工具栏的 Unreal 选项卡，Layer > New Unreal Layer。 *Since:* 2.472.0
- **图像编辑器中的 MetaHuman 图层** — 处于某个动画某一时刻姿势的 MetaHuman，可按面部、半身或全身取景，可转向，背景透明。 *Where:* Unreal 选项卡，Layer > New MetaHuman Layer。 *Since:* 2.472.0
- **Unreal 选项卡** — 微调摄像机的转动、倾斜、推拉和视野（或人物的转向、姿势时间和取景），使用当前视口，重新渲染。 *Where:* Properties 中该图层的 Unreal 选项卡。 *Since:* 2.472.0
- **时间线上的 Unreal 图层** — 一个 Level Sequence，或通过摄像机拍摄、时长由你指定的关卡画面，由 Movie Render Queue 按时间线的尺寸和帧率渲染。 *Where:* 时间线的 Unreal 选项卡。 *Since:* 2.472.0
- **时间线上的 MetaHuman 图层** — 在透明背景上播放动画的 MetaHuman，叠加在其他图层之上。 *Where:* 时间线的 Unreal 选项卡。 *Since:* 2.472.0
- **Unreal 摄像机** — 你自己的摄像机，其时间、位置、转向和视野关键帧取自 Unreal 的视口或摄像机，通过关卡渲染。 *Where:* 时间线的 Unreal 选项卡。 *Since:* 2.472.0
- **重新渲染** — 每个片段都会记住自己的生成方式，在 Unreal 项目或关键帧更改后重新渲染。 *Where:* Unreal 选项卡。 *Since:* 2.472.0
- **Unreal 摄像机工具** — 在场景中移动 Unreal 或 MetaHuman 图层的摄像机：拖动环绕，按 Ctrl 环顾，按 Shift 平移，按 Alt 滚转，滚轮推拉，Ctrl+滚轮缩放；拖动时显示小尺寸预览。 *Where:* 图像编辑器的 UNREAL 选项卡，Camera。 *Since:* 2.475.0
- **Camera 选项卡** — 镜头预设（18-200 mm、微距、变形宽银幕、自定义），焦距与视野联动，胶片背尺寸、光圈值和对焦距离（景深，点击对焦），曝光（EV），位置及滚转 / 俯仰 / 偏航，可从 Unreal 视口读取或写回。 *Where:* Properties，Window > Unreal Camera。 *Since:* 2.475.0
- **时间线摄像机的镜头** — Unreal 摄像机渲染所用的焦距、光圈值、对焦和曝光。 *Where:* 时间线的 UNREAL 选项卡，Keys。 *Since:* 2.475.0
- **Unreal 灯光** — 点光源、聚光灯、矩形光（柔光箱）、太阳光和天空光，可设颜色或色温、强度、照射范围、光锥、尺寸、体积散射和阴影；预设（三点布光、黄金时刻、夜晚街道、霓虹、柔光箱）。 *Where:* 图像编辑器的 Lights 选项卡，UNREAL > Lights & Fog。 *Since:* 2.476.0
- **雾与体积雾** — 指数高度雾（密度、衰减、颜色、起始距离）与体积雾（反照率、消光、距离），以及雾预设。 *Where:* Lights 选项卡，时间线的 Lights & Fog。 *Since:* 2.476.0
- **灯光工具** — 每盏灯在图片上显示为一个标记：拖动可在画面上移动，Shift-拖动拉近或推远，Alt-拖动调整其朝向。 *Where:* 图像编辑器的 UNREAL 选项卡，Lights。 *Since:* 2.476.0
- **时间线上的灯光** — 为 Unreal、MetaHuman 或 Unreal 摄像机片段设置同样的灯光和雾，或将图像编辑器中的灯光和雾带过来。 *Where:* 时间线的 UNREAL 选项卡，Lights & Fog。 *Since:* 2.476.0

## 交付与格式

把作品输出：各种格式的影片、供其他编辑软件使用的文件，以及 bitGen 自己的项目文件。

### 合成与导出

- **合成** — 将时间线合成为一部影片，保存在项目文件夹中。 *Where:* 时间线
- **导出格式** — MP4 H.264、H.265、H.265 10-bit、H.264 10-bit 和 AV1；MOV ProRes 422 HQ、带 alpha 的 ProRes 4444 和 DNxHR HQ；WebM VP9；GIF；WAV 和 MP3。 *Where:* Export 对话框。 *Since:* 2.407.0
- **一次合成，输出所有格式** — 每种格式可单独设置尺寸、重新构图（裁剪、加边或模糊填充）、帧率和质量；预设包可一次添加多种格式。 *Where:* Export 对话框。 *Since:* 2.407.0
- **智能重新构图** — 生成竖屏或方形版本，裁剪框跟随主体移动。 *Where:* Export 对话框的适配选项。 *Since:* 2.413.0
- **HDR 输出** — 10-bit 预设可输出 HDR10、HLG 或 Rec.2020。 *Where:* Export 对话框。 *Since:* 2.417.0
- **显卡编码器** — 在本机可用时使用 NVENC、Quick Sync、AMF 或 VAAPI。 *Where:* Export 对话框。 *Since:* 2.411.0
- **In / Out 导出与单帧** — 仅导出标尺上的选定范围，或将标记处的帧导出为 PNG。 *Where:* Export 对话框，Ctrl+Shift+E。 *Since:* 2.410.0
- **响度目标** — -14、-16、-23 或 -24 LUFS。 *Where:* Mix 对话框。 *Since:* 2.406.0
- **字幕输出** — 烧录进画面，或在每部影片旁生成 .srt 文件。 *Where:* Captions 对话框。 *Since:* 2.406.0

### 与其他编辑软件交换

- **Final Cut Pro 7 XML** — 片段、修剪、图层、速度、运动、关键帧、不透明度、音量、字幕、标记，以及以 .cube LUT 形式保存的调色；支持导出和导入。 *Where:* Exchange 对话框。 *Since:* 2.407.0
- **FCPXML 1.10** — 用于 Final Cut Pro X，双向支持。 *Where:* Exchange 对话框。 *Since:* 2.414.0
- **EDL 与 OpenTimelineIO** — CMX3600 EDL（V1）和 OTIO，含标记。 *Where:* Exchange 对话框。 *Since:* 2.407.0
- **AAF** — 供 Avid Media Composer 和 Pro Tools 使用的剪辑版本。 *Where:* Exchange 对话框。 *Since:* 2.417.0
- **导入时间线** — XML 或 EDL 会作为新的命名时间线打开，片段按名称匹配。 *Where:* Exchange 对话框。 *Since:* 2.407.0

### bitGen 自己的文件

- **.bgi** — 图像编辑器的项目文件，一个包含 XML 和 PNG 的 zip。 *Where:* 图像编辑器的 File 菜单。 *Since:* 2.436.0
- **.bgv** — 一条时间线，包含其每个图层、片段、关键帧、效果、字幕、标记及嵌套时间线，以 XML 格式保存。 *Where:* 时间线工具栏。 *Since:* 2.436.0
- **.bgp** — 整个项目，可完全自包含，也可作为清单文件。 *Where:* 菜单栏。 *Since:* 2.436.0
- **CAD 与 3D 文件** — DXF 和 SVG 草图；STL、glTF 和 STEP 实体。 *Where:* CAD 工具栏。 *Since:* 2.464.0
- **VR 文件** — VR 视频带有球面元数据以及播放器识别所需的文件名后缀。 *Where:* VR World 和 swap

### 指南

- **PDF 指南** — 分步说明，外加一页汇总全部快捷键的速查表，采用 Studio 的深色主题。 *Where:* docs/bitGen-Studio-Guide.pdf。 *Since:* 2.391.1
- **宣传册** — 一份 3 页的宣传册。 *Where:* docs/bitGen-Studio-Brochure.pdf。 *Since:* 2.392.0
- **功能参考** — 即本目录：按领域列出每项功能（作用、位置、自哪个版本起），每次发布都会重新生成。 *Where:* docs/bitGen-Studio-Features.pdf。 *Since:* 2.473.0
- **应用内帮助** — 时间线和图像编辑器的帮助页面。 *Where:* Help 按钮。 *Since:* 2.380.0
- **中文和日文界面** — 主窗口自身的文字（按钮、菜单、面板标题、选项卡、Settings、工具提示、提示信息）可显示为简体中文、繁体中文或日文，通过菜单栏上的下拉菜单即时切换；它与指南的语言是同一个设置，指南会按应用中显示的样子称呼按钮。Settings 已完整翻译，包括其运行时输出的状态行（2.706.0），所有面板——图像编辑器、时间线、Sketcher、SolidCraft、StoryBoard 等——连同其工具、面板和菜单也已翻译（2.707.0）；指南会按应用中显示的样子称呼各编辑器的按钮。 *Where:* 菜单栏上 ⊞ 左侧的下拉菜单。 *Since:* 2.705.0
- **中文和日文版指南与帮助** — 📖 Help 窗口、Ctrl+K 中的指南条目、❔ 帮助页面、快捷键列表和 Guide PDF，提供简体中文（中国大陆）、繁体中文（台湾 / 香港，2.704.0）或日文版本；应用自身的按钮保持英文，因此译文用英文称呼它们。若某一节的英文版较新，会注明这一点，并可一键切换到英文版。 *Where:* 📖 Help 或 ❔ 帮助页面中的语言选择器；docs/bitGen-Studio-Guide-zh-CN.pdf、-zh-TW.pdf、-ja.pdf。 *Since:* 2.703.0
- **语言包** — 除英文外，每种语言都是一个语言包：⤒ 从 .zip 安装（先进行检查；已有的语言会先询问是否替换），✕ 移除，查看每个语言包的翻译进度（应用、指南、帮助、快捷键、功能）；⤓ 主语言包 - 全部英文内容并附 TRANSLATING.txt - 用于将 bitGen Studio 翻译成新语言；⤓ 导出以供翻译 会返回语言包，补入较新的英文并保留其译文。 *Where:* 设置 ▸ 语言。 *Since:* 2.715.0
- **社区语言包** — 社区分享的语言包列出其他人翻译的语言包（来自 tigerart.com.au 上的 bitGen 社区，每个都经过管理员检查）：⤓ 一键安装；⇪ 分享以你的身份将已安装的语言包发送到社区，并可附上给管理员的留言；你分享的语言包显示每个语言包是等待中、已分享还是未被接受（及原因），✕ 可将其撤下。网站的语言包页面也列出这些语言包，并提供主语言包和上传表单。 *Where:* 设置 ▸ 语言 ▸ 社区分享的语言包；tigerart.com.au/languages.php。 *Since:* 2.716.0
- **更快的首帧（Auto）+ Qwen Image 2.1 Turbo8** — 场景卡片的 ✎ 首帧默认为 Auto：已安装时用 Qwen Image Edit 2511 以 4 步生成（Apache 2.0——可以商用），超过三张图片时用 Qwen Image 2.1 edit；新的 Qwen Image 2.1 edit Turbo8 样式让 Qwen 2.1 只需 8 步而非 25 步（Qwen Research License——非商业）。 *Where:* 场景卡片 ▸ ✎ 首帧 ▸ 样式；设置 ▸ 模型 ▸ 模型目录。 *Since:* 2.717.0
- **渲染前检查缺失的模型** — 渲染要加载的每个模型文件（工作流的、样式的，以及 Basic Settings 的）都会与 ComfyUI 模型路径中已找到的模型文件列表比对（misc/models_found.json，缺少某个名称时重新生成）；对话框列出缺少的文件及各自应放入的文件夹，⬇ Download 下载模型目录中有的文件后渲染自动开始，Cancel 则停止渲染；仍因缺少模型而停止的渲染会询问是否下载（2.720.0）。 *Where:* 生成（图片、视频、音乐）；🧩 Models ▸ ⟳ 重新生成列表。 *Since:* 2.719.0
- **仅在模型改变时释放显存** — 连续使用同一模型的渲染会把它留在显卡上（不卸载、不重新加载）；换用其他模型或发生显存不足的错误时，会先释放显卡；也可以像以前一样每次生成前释放。 *Where:* 设置 ▸ ComfyUI ▸ Free VRAM before a generation ▸ Free it。 *Since:* 2.722.0
- **最后使用的浮动面板在最上面** — 💬 Community、Basic Settings、LLM tokens、▣ 面板、你自己命名的面板、浮动的主面板、舞台面板和语音聊天，在应用其余部分之上共用一个顺序：点击或打开其中一个，它就会到最上面（命名面板不会再遮住 Community）。 *Where:* 每个浮动面板。 *Since:* 2.724.0
- **预览中的歌曲：可视化效果，Next 播放下一首** — 在预览中对歌曲或声音按 ▶，会开始一个随机选择的可视化效果（条形、镜像、波形、圆环、星空、涟漪；🎲 换一个）；Next / Prev 跳到所点击面板中的下一首 / 上一首并播放。 *Where:* 预览（在 Gallery、Assets 或 References 中点击歌曲）。 *Since:* 2.725.0
- **Neural blue 主题和 bitGen 大脑图片** — 午夜海军蓝配电光蓝强调色的主题；启动画面是大脑影片，左上角显示标志（自 2.752.0 起；此前随机显示片头影片或大脑）；新安装的第一个项目会在 Assets ▸ Images 中自带这张图片。 *Where:* Settings ▸ Themes、启动画面、Assets ▸ Images。 *Since:* 2.726.0

## 键盘快捷键

完整的按键列表见 PDF 指南（docs/bitGen-Studio-Guide.pdf）以及图像编辑器的 Help > Keyboard Shortcuts。

### 最常用的按键

- **P, S, L, 2, 1** — 提示词面板、Basic Settings、LLM tokens、负面提示词面板以及 Tools and Properties。 *Where:* 任何地方（输入文字时除外）
- **Space, J, K, L** — 暂停和播放；向后穿梭、停止和向前穿梭。 *Where:* 时间线
- **V, B, N, Y, U** — 时间线的 Select、Ripple、Roll、Slip 和 Slide 工具。 *Where:* 时间线的图层上方
- **Ctrl+K, M, I, O** — 分割、标记、In 点和 Out 点。 *Where:* 时间线
- **F5, F6, F8, F10, F12, Ctrl+Q** — 曲线工具、形状工具、尺寸、节点 Shape 工具、Outline Pen、Convert to Curves。 *Where:* 图像编辑器
- **N，然后 S, L, R, C, A, P, D, X, T, E, F, M** — 草图工具及其字母键。 *Where:* 图像编辑器
- **Alt+Shift+S, Alt+Shift+R** — 截图和屏幕录制。 *Where:* 任何地方
