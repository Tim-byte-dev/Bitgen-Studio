# 使用 bitGen Studio
<!-- en: _top f2ff26c89c08 -->

带你游览整个工作室：从一个提示词到一部完整的影片。如果尚未安装，请先阅读
[INSTALL.md](INSTALL.md)。

- [窗口](#the-window)
- [用提示词生成一个片段](#one-clip-from-a-prompt)
- [角色](#characters)
- [在场景板上制作影片](#a-film-on-the-scene-board)
- [音乐视频](#a-music-video)
- [角色替换](#character-swap)
- [选择参考视频的帧](#choosing-the-frames-of-a-reference-video)
- [图像、ControlNet 与面部修复](#images-controlnet-and-face-fix)
- [音乐、分轨与人声](#music-stems-and-voices)
- [时间线与导出](#timeline-and-export)
- [📏 Sketcher - 3D 建模、房间与摄像机](#-sketcher---3d-modelling-rooms-and-cameras-2619---2653)
- [项目、队列与图库](#projects-queue-and-gallery)
- [文件对话框](#the-file-dialog)
- [技巧](#tips)
- [致谢](#credits)

---

## 窗口
<!-- en: the-window b01c2509e256 -->

![The main window](images/overview.png)

| 区域 | 说明 |
|---|---|
| **Left**（左侧） | 系统状态，以及两个按钮，分别用于显示浮动的 **LLM tokens**（L）窗口和 **Basic Settings**（S）窗口。Basic Settings（基本设置）包含生成模式（Ref · F/L · Text · Swap）、分辨率、宽高比、秒数、步数、CFG、种子、格式、LoRA、ControlNet 和面部修复 |
| **References**（参考） | 随下一次生成一同使用的图片、视频和声音（从 Assets 或 Gallery 拖入） |
| **Assets**（素材） | 项目的图像、视频和声音——把文件拖放到这里即可导入 |
| 中央面板 | Preview、Timeline、**Video**（场景板）、Music、Stems、Image editor、ComfyUI、**Prompt**、Prompt chat、Console |
| **Queue**（队列） | 待处理和已完成的任务，以及它们的日志 |
| **Gallery**（图库） | 你渲染过的所有内容 |

底部的一排按钮用于显示和隐藏各个面板；每个面板都可以折叠（▾）或最大化（⛶——按 Esc
恢复）。布局会被记住。

## 用提示词生成一个片段
<!-- en: one-clip-from-a-prompt 10352f50a58d -->

1. 在 **Basic Settings**（基本设置）中（按 **S** 显示）选择一种模式：
   - **Ref**（ref2va）——最多 9 张参考图；托盘中的每个槽位都是一个可以在提示词中引用的
     `<Picture n>`（点击槽位的徽标即可插入其标签）。References 面板中的视频和声音也会一同使用。
   - **F/L**（fl2va）——一张图片 = 首帧；两张图片 = 从首帧动画过渡到尾帧。
   - **Text**（t2va）——不使用参考图。
   - **Swap**——参见[角色替换](#character-swap)。
   - 每张 Ref 图片下方的 **Type**（类型）（person、face、clothing……；2.340.0 起新增
     **first frame**、**last frame**）：把某张图片的 Type 设为 **first frame**，
     Generate 就会以它为起点渲染 **First/Last**（fl2va）——如果有 Type 为
     **last frame** 的图片，则一直渲染到该图片。其他图片不会被使用（控制台会提示这一点）。没有首帧时，渲染仍为 **Ref**（ref2va，最多 9 张图片），单独的尾帧会被当作普通参考图。
     LTX 2.5 风格使用相同的 Type：首帧放在最前，尾帧放在最后。
2. 选择分辨率、宽高比和 **Seconds**（秒数）。MiniMax H3 以 24 fps 渲染；如果片段长度超出显卡单次运行所能处理的范围，会被拆分后再无缝拼接。
3. 编写提示词并按下 **GENERATE**（其下方的下拉菜单显示 Generate 要生成的内容：
   🎬 Video、🖼 Image、🎶 Music、🗣 Speech、⚙ Graph、💬 Chat）。

`/br/` 单独占一行时，会把提示词拆分为多个依次运行的任务。在提示词中按 **Enter** 可让本地 LLM
改进提示词。**⏫ Enhance** 会放大所选视频（参见 *使用 SeedVR2 放大视频*）。

## 角色
<!-- en: characters 80f5593fe0ff -->

在 **Video** 面板的 **Characters**（角色）部分中：

- **NEW**——创建一个角色，包含名称、详细信息、一张 **character sheet**（角色设定图，即正面 /
  侧面 / 背面图片），还可选配一段 **voice clip**（语音片段）。它的 `@tag`（例如
  `@anna`）是提示词和剧本引用该角色的方式。
- **🖼 NEW**——*用一张图片*创建角色：上传一张照片或渲染图，即可生成一张参考设定图（可使用
  pose_sheets 文件夹中你自己的姿势设定图，照片风格或插画风格均可），然后点击 **Keep** 保留它。
- **🎭 Actors**——选择当前场景中出场的角色；只有他们会参与参考图和剧本。
- 每个角色都有一个用于 **RefMod**（身份模型）的数据集文件夹、在各场景间跟随角色的服装条目，以及用于原生音频对白的专属声音。

## 在场景板上制作影片
<!-- en: a-film-on-the-scene-board c5d9bcd362a8 -->

![The scene board](images/video-docker.png)

1. **Workflow**（工作流，位于 StoryBoard 顶部）：*Native audio · ref2va / fl2va*——
   每个场景都是一个独立的片段，同时包含视频**和**声音。
2. **Scenes**（场景）：输入你想要的场景数量，或者留空——此时由
   `projects\<name>\scenes.txt`、你请求中的数字或 LLM 来决定。
3. 在提示词中按 **🎬**（*create screenplay*，创建剧本）并描述故事，例如 *create screenplay: Anna and Rex reach the rooftop at night…* LLM
   会把各个场景写到场景板上，角色会说出各自的台词（`@anna says: "We made it."`）。没有歌曲 = 一部影片：模型会用每个角色的克隆声音，自行生成对白、音效和环境声。
4. 为每个场景选择它如何衔接上一个场景：

   | | |
   |---|---|
   | **Ref** | 根据参考图（角色设定图、地点图片）生成一个新镜头；在 Native audio 下，上一个镜次的结尾会作为过渡视频一同使用 |
   | **First** | **精确地**从上一个镜次的某一帧开始（fl2va——不使用角色设定图） |
   | **Cont** | 从该帧开始，**同时**使用演员的设定图，使角色保持一致 |
   | **Trans** | 从该帧过渡到新地点的图片 |

   **All:** 一次性设置所有场景。
5. 按场景的圆形 **▶** 按钮即可渲染该场景，或勾选多个场景后按 **▶ Selected**。渲染在后台进行；你可以继续编辑。
6. 每个镜次下方是它的 **filmstrip**（胶片条）——点击某一帧，即可将其设为下一个场景的首帧。
   **✎ First frame (Qwen 2.1)**（2.337.0）——展开场景 First / Last 帧槽位下方的折叠面板，即可用 Qwen Image 2.1 *制作*该场景的首帧：勾选 **characters**（角色，使用其设定图），选择一张 **📍 location**（地点）图片和最多三个 **🧸 props**（道具），输入一行指导说明（或留空，以使用场景自身的提示词），然后按 **✎ Make first frame**。**Start from** 用于选择 Qwen
   要编辑的图片：地点图片（角色会被放入其中）、**the frame the scene continues from**
   （场景所衔接的那一帧：姿势和位置不变，只更换地点——适用于 Cont / First / Trans 场景），或场景自身的 First 图片；*Auto* 会在存在衔接帧时选用衔接帧。生成结果会放入场景的
   **First** 槽位（Ref 场景会变为 First）。此功能需要 Qwen Image 2.1 模型（Setup → Models → Image editing）。
7. 场景板下方的镜次栏：**▶** 观看 · **✔** 保留 · **↻** 重做 ·
   **⇄** 替换角色。**⏫** 会使用 ⚙ 中的放大器放大你满意的镜次（无需重新渲染）。
8. **🎬 Compile**（位于 StoryBoard 顶部）按场景顺序把已渲染的镜次合并成一部影片。从 2.391.0 起，场景板不再有单独的 🎬 Produce 和 ⇥ Timeline 按钮。

StoryBoard 底部的 **info line**（信息行）与状态栏高度相同。它显示该面板的最新消息；将鼠标悬停在上面即可阅读完整文本。

**Scenes 下拉菜单（2.391.1）。** 场景板（共享提示词、场景菜单栏和场景卡片）与 Characters
和 Locations 一样，位于一个 **Scenes** 下拉菜单中。点击其标题即可展开或收起；标题会显示场景总数以及正在渲染的数量。

在下拉菜单中，卡片上方的 **scene picker**（场景选择器）可以显示 **All scenes**（全部场景），也可以只显示某一个场景的卡片。每个场景都会列出其状态（⏳ 正在渲染、● 已渲染、✔ 已保留、
✕ 失败）以及提示词的开头几个词。**◀** 和 **▶** 用于跳到上一个或下一个场景。选择器会记住你的选择。

场景渲染期间，其卡片会显示 **rendering step n of total**（正在渲染第 n 步，共 total 步），并附带进度条和已用时间。在第一步开始之前，它显示 **rendering - loading the models**。

包含所有快捷键的完整 **PDF guide**（PDF 指南）位于 `docs\bitGen-Studio-Guide.pdf`。

**⚙**（渲染设置）用于设置场景的尺寸、步数、LoRA、Sage / Spectrum / Comfy Kitchen
加速器、放大器，以及用于保持连贯性的尾帧。StoryBoard 顶部的 **🆕 New / 💾 Save / 📂 Load**
用于新建、保存和重新加载整部影片（演员、章节、场景和渲染结果）。

## 音乐视频
<!-- en: a-music-video 18fb81084a22 -->

1. 用 **📂 Load** 加载一首歌曲（或在 **Audio** 下拉菜单中选择）。它的波形打开时已自动分段；调整剪切点后按 **💾**——每个分段对应一个场景，各自带有起始时间和时长。
2. 在 Prompt 面板中按 **🎤**（*create music video*，创建音乐视频）并描述你想要的内容；编剧会把歌曲的分段用作场景，并让角色演唱各自的歌词。
3. 每个场景都会对歌曲中属于自己的那一段进行口型同步。

## LTX 2.5（首帧 / 尾帧、口型同步、音频转视频）
<!-- en: ltx-2-5-first-last-frame-lipsync-audio-to-video d24fa406ffb1 -->

LTX 2.5 通过 Tim 的 **LTX 2.5 All-In-One** 画布（`comfy_workflows/LTX25_All_In_One.json`）进行渲染，每个片段使用一种模式。选择
**LTX 2.5** 视频风格（Settings → Video styles 中已将它作为入门风格提供）。

**从 Prompt 面板使用。** 选中 LTX 2.5 风格后，模板列表旁边会出现两个下拉菜单：

- **LTX mode**（LTX 模式）——*Auto* 会根据参考面板中的内容自动选择：

  | 参考面板 | 模式 |
  |---|---|
  | 一个视频（+ 图片 1） | 视频转视频（风格迁移，姿势取自视频） |
  | 音频 + 3 张图片 | 首帧 / 中间帧 / 尾帧（图片 1、2、3） |
  | 音频 + 2 张图片 | 首帧 / 尾帧口型同步 |
  | 音频 + 1 张图片 | 口型同步（由图片 1 演唱该音频） |
  | 仅音频 | 音频转视频 |
  | 2 张图片 | 首帧 / 尾帧 |
  | 1 张图片 | 图像转视频（图片 1 为首帧） |
  | 无 | 文本转视频 |

  你也可以自己选择模式；如果某个模式缺少所需的图片 / 音频，会提示需要加载什么。面板中只会使用第一个音频和第一个视频。
- **Transition**（过渡）——即 *ltx2.3-transition* LoRA。*Auto* 只会在需要在图片之间过渡的模式（首帧 / 尾帧、首帧 / 尾帧口型同步、首帧 / 中间帧 / 尾帧）中启用它。

**Seconds**、**Width / Height**（取整为 32 的倍数）和 **Seed** 字段均会生效；片段为 24 fps，时长 1–30 s。

**在场景板上使用。** 将 StoryBoard 的 **Workflow** 设为 **LTX 2.5**。每个场景的卡片决定其模式：

| 场景 | 无歌曲 | 使用场景板的歌曲 |
|---|---|---|
| **Ref**（未设置任何内容） | 文本转视频 | 音频转视频 |
| **First / Cont**（或有 First 图片） | 从该帧开始的图像转视频 | 对该场景所对应的那段歌曲进行口型同步 |
| **Trans**（或有 Last 图片） | 首帧 / 尾帧：从衔接帧到 Last 图片（没有则到地点图片） | 首帧 / 尾帧口型同步 |

**运行哪个工作流（2.401.5）。** *文本转视频*、*图像转视频*和*首帧 / 尾帧*在
**Comfy-Org 官方的 LTX 2.5 模板**
（`comfy_workflows/ltx25_official_t2v.json`、`_i2v`、`_flf2v`）上运行。它们只使用
ComfyUI 内置的节点，因此无需从 Manager 安装任何东西。应用会为你填好以下内容：你的提示词、秒数、尺寸、种子、图片、风格中的 LoRA 和负面提示词。如果你的模型是 GGUF，则通过
ComfyUI-GGUF 加载。这些模板需要 ComfyUI 的 LTX 2.5 文件：transformer（int8 或 GGUF）、
Gemma 4 12B 文本编码器、视频和音频 VAE，以及 x2 放大器（首帧 / 尾帧不需要放大器）。如果缺少其中某个文件，任务日志会指出缺的是哪一个，并改用画布渲染该片段。画布保留了只有它才有的模式（音频转视频、口型同步、首帧 / 尾帧口型同步、首帧 / 中间帧 / 尾帧、风格迁移）、LTX Ripple、时间线摄像机的精确路径，以及设为 *On* 时的 *Transition* LoRA。任务日志会显示运行的是哪个工作流："on Comfy-Org's own template …" 或
"converted LTX25_All_In_One.json …"。请保持 ComfyUI 为最新版本：这些模板使用了较新的核心节点（TextGenerateLTX2Prompt、ComfySwitchNode、
ResizeImageMaskNode）。

✎ First frame (Qwen 2.1) 在这里同样可用——先制作开场图片，再进行渲染。提示词中的 @tag
会变成角色的名字（LTX 没有参考设定图；外观来自首帧）。LTX 镜次目前还不能使用 **⏫** 放大。

**模型和节点。** *Settings → Models → ⤓ Model catalog*（或设置向导的 Models 页面）
→ *Video - LTX 2.5*：
- Q4_K_M GGUF（15 GB，画布加载的就是它）或 int8 模型；
- Gemma 4 12B 文本编码器和 Gemma 4 E2B 文本编码器；
- 视频 / 音频 VAE、TAE 预览 VAE 以及空间放大器；
- （2.341.0）画布使用的 LoRA：OmniNFT RL、Transition、IC-LoRA Union Control
  （风格迁移）、IC-LoRA Detailer 和 LTX Ripple。

Lightricks 的仓库需要授权访问：请在 Hugging Face 上接受其许可协议，并把你的访问令牌（token）填入模型目录。下载大文件时，请在 **Download with** 中选择 Hugging Face CLI（**Install hf CLI** 可安装它）。画布需要以下节点包：ComfyUI-GGUF、KJNodes、VideoHelperSuite、rgthree、mxToolkit、
Easy-Use 和 controlnet_aux（Setup → Node packs）；任务开始时，缺失的节点会连同其所属的节点包一起列出。从 2.401.2 起，画布不再需要 ComfyMath（它已从 GitHub 上消失）或 pysssss 数学节点：其数值转换和公式改由 ComfyUI 自带的 **Math Expression** 节点运行。如果你从自己的 ComfyUI
重新导出的画布中仍包含这些节点，应用会在任务开始时自动转换。从 2.401.3 起，它也不再需要
ComfyUI-MediaMixer：其 "last frame" 选取改由画布本来就在使用的 KJNodes
（Get Image Range From Batch）完成。

现在，每个视频任务（MiniMax H3、Wan、LTX、替换、Viggle、SeedVR2）都会显示 ComfyUI 的实时进度：正在运行哪个节点，以及采样时的 "step n of total"。如果长时间没有动静，并显示
"running UNETLoader" 或某个加载器节点，说明 ComfyUI 仍在加载模型；Wan 2.2 的两个 14B
模型首次加载可能需要几分钟。

## LTX 2.3 与 3D 渲染 → 真实（Blender → 照片级真实感）
<!-- en: ltx-2-3-and-3d-render-real-blender-photoreal 464c95398bb6 -->

选择 **LTX 2.3** 视频风格（Settings → Video styles 中已将它作为入门风格提供）。它运行
**Comfy-Org 官方的 LTX 2.3 模板**，只使用 ComfyUI 内置的节点（`comfy_workflows/ltx23_official_*.json`）。它有四种模式。LTX mode 下拉菜单只显示这四种，*Auto* 会根据参考面板中的内容自动选择：

| 参考面板 | 模式 |
|---|---|
| 一个视频 | **3D render → real**（3D 渲染 → 真实）。该视频是一段渲染画面（来自 Blender、游戏视口或任意 CG 片段）；fal 的 **3DREAL** IC-LoRA 会在保持相同布局和摄像机运动的前提下，将其转为照片级真实感画面。再加一张图片 = 一张真实的首帧（可选）。 |
| 2 张图片 | 首帧 / 尾帧 |
| 1 张图片 | 图像转视频（首帧） |
| 无 | 文本转视频 |

口型同步、音频转视频、首帧 / 中间帧 / 尾帧和风格迁移属于 LTX 2.5 画布的模式。如需使用这些模式，请选择 LTX 2.5 风格。

**3DREAL**（huggingface.co/fal/LTX-2.3-3DREAL-LoRA）：模式旁边的选择框用于选择变体：

- *strong v2*：最新版本（支持多场景、音频，面部效果更好）；
- *strong*：更强力地推向照片级真实感；
- *light*：忠于原画面，效果温和；
- *Auto*：ComfyUI 中已有的最新版本。

bitGen 会把 LoRA 的触发词放在你的提示词最前面（"3DREAL. Make it photorealistic. …"）。请描述镜头应有的样子：材质、光线、天气、一天中的时间。

**从 Blender 使用**（bitgen-blender-addon 1.1）：在 Blender 中布置好场景，然后使用
**sidebar (N) → bitGen → Render scene (LTX 2.3 · 3DREAL)**。几个灰色方块加上一段摄像机运动就足够了。设置项：

- **Looks like**：提示词。
- **Engine**：*Solid*（最快；粗模布局用它就够了）、*EEVEE*，或场景自身的引擎。
- **3DREAL**：变体。
- **Strength**：渲染画面对 LTX 的引导强度（1 = LoRA 自身的强度）。
- **Max seconds**：时长上限。
- **Render in bitGen**：勾选后，任务会立即加入队列。

**🎬 Render scene → bitGen** 通过 **scene camera**（场景摄像机）渲染帧范围。长边最多 1280，两边均为 32 的倍数，输出为 H.264 .mp4。渲染结果会作为 **Video assets →
blender_<name>.mp4** 发送到当前打开的项目；勾选 *Render in bitGen* 时，LTX 2.3 任务会立即开始。
Blender 中的所有渲染设置在之后都会恢复原状。取消勾选 *Render in bitGen* 则只发送渲染结果，之后再由你自己把它放入参考面板（如有需要，可以添加一张真实的首帧图片）。

**模型**（*Settings → Models → ⤓ Model catalog → Video - LTX 2.3*），放在 ComfyUI 的以下文件夹中：

- **checkpoints**：`ltx-2.3-22b-distilled-fp8` 可运行所有模式。添加 `ltx-2.3-22b-dev-fp8` +
  `ltx_2.3_22b_distilled_1.1_lora…`（loras），即可按 Comfy-Org 模板的方式运行文本 / 图像模式。
- **text_encoders**：`gemma_3_12B_it_fp4_mixed`。
- **latent_upscale_models**：`ltx-2.3-spatial-upscaler-x2-1.1`（文本 / 图像）。
- **loras**：`3DREAL-strong-v2` / `3DREAL-strong` / `3DREAL-light`，以及可选的 Gemma "abliterated" LoRA
  （缺失时会被略过）。

任务日志会列出所用的检查点（checkpoint）、编码器和 3DREAL 文件，并说明略过了哪些。请保持 ComfyUI
为最新版本：这些模板使用了它最新的 LTX 节点（GetICLoRAParameters、LTXVAddGuide、LTXAVTextEncoderLoader）。


### 在预览画布中打开 .blend：环视、编辑，并将一个分段渲染为真实画面

点击时间线画布工具中的 **🟧**，然后选择一个 `.blend`。Blender（无界面模式）会读取它，场景随即出现在预览画布上，并按场景的渲染尺寸取景。bitGen 在副本上工作：`<project>/blender/<name>.tmp`。在你保存到原文件之前，原文件不会被改动。

- **🎥 Scene camera** 透过场景的活动摄像机观看，并播放其动画。**🧭 Free view**：拖动可环绕旋转，右键拖动或 Shift 拖动可平移，滚轮可缩放，按 **F** 可框选全部内容。
- **Zoom**（缩放，2.546.0）：**🔍＋ / 🔍－**，或 **Alt+drag**——向前（向上）拖动拉近，向后（向下）拖动拉远。
  **⌖ Zoom to object**（或 **Z**）会从你当前观看的方向把视图拉近到所选对象；未选择任何对象时则框选整个场景。在 🎥 Scene camera 下缩放时，会先在摄像机所在位置切换到自由视图。
- **Select**（选择）对象：点击该对象，或在 **Tools & Properties**（按键 1）的对象列表中选择。**G / R / S**
  （或 ✥ ⟲ ⤡）可在移动、旋转和缩放之间切换操作手柄。Properties 中也可以输入 X / Y / Z（Blender 的坐标轴）和尺寸。
- **Edits**（编辑）：
  - 移动一个由 Blender 驱动动画的对象时，会在当前帧插入一个 **key**（关键帧）。移动其他任何对象则会为它设定新的位置。勾选 *Auto-key every move* 可为所有移动插入关键帧。
  - **◆ Key** 在此处为对象插入关键帧，**✕ Key** 删除当前帧的关键帧，点击关键帧行（◇ 为 Blender 的，◆ 为你的）中的关键帧即可跳转到该帧。
  - **⧉** 复制，**◌ Hide** / 👁 在渲染中隐藏该对象，**🗑** 删除，**↺** 撤销对它的所有编辑。
  - **Ctrl+Z** 撤销。预览在关键帧之间按直线插值播放；Blender 则会进行缓入缓出。
- **Segment**（分段）：拖动帧条定位，然后按 **[ In** 和 **Out ]**。帧条会显示分段长度；LTX 最长支持 30 s。
- **Save to**（保存位置，位于 Properties 中）：
  - *Only in bitGen*：`<project>/blender/<name>.blend`。
  - *Write back to the original .blend*：Blender 会将旧文件保留为 `.blend1`。
  - *Copy to a new file*：在原文件旁边生成 `<name>_bitgen.blend`。

  **💾 Save** 总会同时写入项目中的 `<name>.blend`，并把你的编辑烘焙到工作副本中。
- **Render to real**：选择摄像机（*the scene camera*，或 *this view*——在你当前观看的位置放置一台静止摄像机）、引擎（粗模布局用 *Solid* 就够了）、外观描述、3DREAL 变体和强度，然后按 **🎬 Render to real**。
  Blender 会把该分段渲染为 **Video assets → blender_<name>_<in>-<out>.mp4**；勾选 *Render in bitGen* 时，
  LTX 2.3 3DREAL 任务会加入队列，与附加组件的 Render scene 相同。
- ✕ 返回时间线画布。场景会保持打开；🟧 可以把它重新调出来。**⟲ Reload** 会丢弃你的编辑并重新读取该 .blend。

必须安装 Blender（其路径在 🟧 Blender settings 中设置）。

### ✨ 用 AI 构建场景，以及从图片生成 3D 模型

本地 LLM 可以为你布置一个 3D 场景。打开 **🟧**（未打开场景时，会显示 **📂 Open a .blend** 和 **✨ Build
a scene with AI**；已打开场景时，**✨ New scene with AI ▸** 位于 Properties 顶部）。描述镜头（画面里有什么、什么在动、摄像机如何移动），设置时长，然后按 **✨ Build**：

1. LLM 会写出一份**计划**：每个对象都归为一种已知类型（汽车、卡车、树、房屋、建筑、道路、人、狗、路灯柱、长椅、桌子……共 58 种），并带有以米为单位的尺寸、位置、朝向和颜色，以及什么东西在何时移动、摄像机的路径。它从不编写代码。如果回复不是一份计划，会重新请求一次。
2. 没有合适类型的物体（动物、雕像、特殊车辆、角色）会变成 **3D models**（3D 模型）。每个物体先用 Basic Settings
   中选定的图像风格画成一张图片（单独一个物体，白色背景），然后在 ComfyUI 中转换为 .glb。
   *Max 3D* 限制其数量；取消勾选 *3D models* 则全部用简单形状来构建。这些都是队列中的普通任务。
3. Blender 会构建 `<project>/blender/ai/<title>.blend`（计划保存在它旁边，名为 `<title>.plan.json`），并在预览中打开它：你可以环视、移动物体、插入关键帧，然后 **Render to real**。用相同标题再次构建会生成
   `<title>_2.blend`；不会覆盖任何文件。

如果某张图片或某个 3D 模型无法生成，该对象会变成其类型的简单替代体，日志会说明原因；场景仍然会被构建出来。
**■ Stop** 可停止构建。

**Image to 3D**（图像转 3D，使用 ComfyUI 自带节点和 Comfy-Org 的模板）：

| 选项 | 得到的结果 | 文件（Settings → Models → ⤓ Model catalog → **3D models**） |
|---|---|---|
| **Hunyuan3D 2.1**（默认） | 只有形状，没有颜色；反正 3DREAL 会画出真实的外观 | `hunyuan_3d_v2.1.safetensors`（checkpoints）、`birefnet.safetensors`（background_removal——先把对象抠出来，可选） |
| **TRELLIS.2** | 形状 + 烘焙纹理，速度较慢 | `trellis_2_int8_convrot`（diffusion_models）、`trellis_2_shape_vae_bf16` + `trellis_2_texture_vae_bf16`（vae）、`dino_v3_L_naf_fp32`（clip_vision）、`birefnet` |

*Auto* 在有 Hunyuan3D 2.1 时使用它，否则使用 TRELLIS.2。缺失的文件会在任务日志中列出。

**任意图片上的 🧊**：Gallery（Images）和 Assets 面板（Images）中的每张图片都有一个 🧊。选择 Hunyuan3D 或
TRELLIS.2，生成的 .glb 会放入项目的 `models3d/`。之后，在 .blend 预览的 Properties 中点击 **＋ Model**，即可将其添加到打开的场景中（高 1 m，立在视线所指的位置；可用 S 键或 Size 框缩放），💾 Save 会把它存入该 .blend。时间线的 🧊 3D 图层也可以使用这些文件。

许可协议：Hunyuan3D 2.1 采用腾讯的 Hunyuan 3D 社区许可协议（不适用于欧盟、英国和韩国）；
TRELLIS.2 的代码采用 MIT 许可（其中部分组件有各自的许可协议）。商业使用前，请检查每个模型的许可协议。

### Daz Studio → bitGen（bitGen Bridge 脚本）

**安装** `bitgen-daz-bridge-v1.0.0.zip`：把其中的 `Scripts` 文件夹复制到你的某个 Daz 内容库中（例如
*Documents/DAZ 3D/Studio/My Library*）。在 Daz Studio 中，打开 **Content Library → (your library) → Scripts → bitGen**，然后双击 **bitGen Bridge**。为方便随时使用，可通过 *Window → Workspace → Customize* 把它拖到工具栏上。它适用于
Daz Studio 4.2x 以及 Daz Studio 2025 / 6。bitGen Studio 必须在同一台计算机上运行；**Test connection**
可检查连接。

桥接窗口（有自己的标题栏）提供五种发送方式：

| 发送方式 | bitGen 的处理 |
|---|---|
| **Render the animation → real** | Daz 使用*你自己的*渲染设置（Iray、Filament 或 3Delight；Filament 较快）渲染时间线的播放范围。这些帧会在 Video assets 中生成 `daz_<scene>.mp4`（长边 1280，最长 30 s）。勾选 *Render in bitGen right away* 时，LTX 2.3 · 3DREAL 会使用你的 *Looks like* 文本、3DREAL 变体和强度，将其渲染为真实画面。 |
| **Render this frame → a picture** | 放入 Gallery 和 Images 素材中，可直接用作参考图、首帧或 🧊 3D。 |
| **The scene as 3D → open in bitGen's preview** | Daz 导出 FBX：带骨骼和动画的人物、道具，以及按勾选导出的灯光 / 摄像机。Blender 会把它转换为 `blender/daz/<scene>.blend`，并在 🟧 预览中打开，你可以在那里编辑它并渲染为真实画面。 |
| **The scene as 3D → merge into the scene open in bitGen** | bitGen 会打开 **Merge** 对话框（见下文）。 |
| **The selected figure / prop → a 3D model** | 保存到 `models3d/<figure>.glb`，可在预览中通过 ＋ Model 使用。勾选 *also add it as a 3D layer* 可同时把它放到时间线上。 |

**Merge 对话框**：当预览中已打开一个 .blend，又有 Daz 场景传来需要合并时，bitGen 会弹出此对话框。你可以拖动其标题栏移动它；✕ 或 Esc 会关闭它，场景则保持等待状态。它把 Daz 场景分为三组列出：
**Figures & objects**、**Lights** 和 **Cameras**。每个项目都有勾选框，每组都有 *all* / *none*。然后选择：

- **Scene camera**：保留场景自身的摄像机，或使用某台已勾选的 Daz 摄像机。
- **Stretch the frame range**：延长场景的帧范围，以覆盖整个 Daz 动画。

**Merge** 会把勾选的项目连同其下的所有内容（人物的身体和服装会随其骨骼一起带过来）追加到所打开 .blend 中一个名为 "Daz" 的集合里。Daz 动画会按场景的帧率重新分布，例如把 30 fps 的动画放入 24 fps 的场景，随后预览会重新加载。**Open on its own** 则改为单独打开该 Daz 场景。**Cancel** 会丢弃它。

3D 发送方式需要 Blender（bitGen 会自动找到它；其路径在 *🟧 Blender settings* 中设置）。桥接只发送 Daz 所写出文件的路径，因此 Daz 和 bitGen 必须在同一台计算机上运行。它使用 curl，Windows 10+ 和 macOS 均已自带。

## 📏 Sketcher - 3D 建模、房间与摄像机（2.619 - 2.653）
<!-- en: sketcher-3d-modelling-rooms-and-cameras-2-619-2-653 a19392027f87 -->

**Sketcher**（草图建模）面板（其按钮在状态栏中，默认隐藏）用于以快捷的方式进行 3D 建模：在地面或某个面上画出形状，然后将其推拉成实体；也可用来搭建房间乃至整栋房屋，作为影片的拍摄场景。它取代了旧版本中的 House builder。完整列表见其 ❔。

**功能概览：**

- **建模**：直线、矩形、圆、多边形、推/拉、偏移、移动/旋转/缩放（也可复制）、群组、面的挤出或扭转、边的移动/挤出/倒圆角，随时可键入精确尺寸。
- **搭建**（Build 工具）：带共用墙的房间、独立墙、门窗（开启或关闭）、地板、天花板（平顶或随斜墙倾斜）、屋顶、楼梯和灯光（白天/🌙 夜晚）；墙可沿垂直于自身轴线的方向拖动，也可自由拖动；墙顶可倾斜。
- **📐 Floorplan**（平面图，2.647.0）：采用应用主题配色（2.649.0）的正俯视图，每次显示一层——墙体以实心剖切显示，门带开启弧线，窗、楼梯、家具和灯光以平面符号表示，并标出每个房间的名称、Width × Length（宽 × 长）和面积。每个工具在此的绘制方式都与 3D 中相同；点击可选中符号。在任意位置按 **Esc**：取消工具、取消选择，回到 🔄 Orbit。
- **🗂 Outline**（大纲）：列出每个房间及其组成部分（墙、地板、天花板、踢脚线、顶角线、门、窗），可隐藏或显示，房间可编组。在视图或大纲中点击某个部分，会显示**该部分自身的属性**（墙的长度、高度和颜色；天花板的类型；踢脚线的轮廓）。
- **轮廓**：踢脚线、顶角线、门框、窗框和窗台的轮廓可从带图示的下拉列表中选取，也可在 **✎ Profiles**（轮廓）对话框中绘制并保存在项目中。
- **⛰ Terrain**（地形，2.653.0）：建筑周围的地面——可用画笔抬高、降低、平滑和压平；可按你在各自高度上绘制的 〰 等高线塑形；可由高度图图片生成；可在房间下方找平；其等高线会显示在地面和平面图上。
- **布置家具**：🛋 家具库和人物、带纹理的材质、🪄 Furnish（由 LLM 布置房间）、项目中的 3D 模型。
- **📷 Cameras**（摄像机）：可选中、移动（箭头）和转动（圆环，双击），可设置镜头/焦距/视场角，👁 Look through（并可在其自身视角中移动或转动它），可拍摄带深度图和法线图的画面，可为视频渲染设置 📍 360° 地点。
- **输出**：通过提示词面板生成模型的 ✨ 真实照片，将图片或 3D 图层发送到图像编辑器和时间线，发送到 Blender、Unreal，或导出为 .glb / .obj / .stl。

1. 按 **R**（Rectangle），在地面上点击一个角点，移动鼠标，键入 `4,3` + Enter——得到一个 4 × 3 m 的面。
2. 按 **P**（Push/Pull），点击该面，向上移动，键入 `2.7` + Enter——得到一个 2.7 m 高的盒子。
3. 在盒子的侧面**上**画一个矩形并将其推入——得到一个窗洞；一直推穿——得到一个孔洞。
4. 或者：在地板面上使用 **F**（Offset），输入 0.2 + Enter，然后将环形面向上推——得到围合房间的四面墙。

尺寸可随时键入（无需点击输入框）：长度（`1.5`、`150cm`、`1500mm`、`5'`）、两个值（`3,2`）、边数（`36s`）、角度。标记会显示该点吸附到的对象（Endpoint、Midpoint、On Edge、On Face、On Ground），当你位于红/绿/蓝轴上时会显示一条虚线——按住 **Shift** 或按 **→ ← ↑** 可锁定该轴。按住中键拖动可环绕视图，按住右键拖动可平移，滚轮缩放，**Shift+Z** 显示全部。

其他工具：**L** Line（穿过面的线会将其分割）、**C** Circle、**N** Polygon、**M** Move（**Ctrl** = 复制，可键入 `x,y,z`）、**Q** Rotate、**S** Scale、**T** Tape、**B** Paint、**E** Eraser、**Space** Select（双击群组可进入其内部编辑，**G** 创建群组）。模型保存在项目中（projects/<project>/pushpull），并会自动保存；**↶ ↷** 撤销/重做。**➜ Send** 可将模型发送到图像编辑器（视图的图片）、时间线（3D 图层）、Blender 或 Unreal；**⤓ Export** 导出 .glb / .obj / .stl；**⤒ Import** 将项目中的 3D 模型作为群组导入。

### 搭建：房间、共用墙、门、窗、屋顶、灯光（2.620.0）

建模工具下方的 **Build**（搭建）工具可创建始终保持可编辑的建筑：

1. 按 **U**（Room），点击一个角点，键入 `4,3` + Enter——得到一个带墙、地板和天花板的 4 × 3 m 房间。
2. 在稍远处再画一个房间，然后用 **Space**（Select）按住它并向第一个房间拖动。当它的墙靠近第一个房间的墙时会吸附上去——两个房间现在拥有**一面共用墙**（并且角点对齐）。
3. 按 **D**（Door），在共用墙上点击——门会贯穿该墙。按 **I**（Window），在外墙上点击。用 Select 可沿墙拖动门或窗；其尺寸、样式和窗台在右侧面板中设置。
4. 按 **X**（Light），在面板中选择类型——筒灯、吸顶灯、吊灯、枝形吊灯、射灯、壁灯、落地灯或台灯——然后在房间内点击：灯会安装在该房间的天花板上（房间中心处有吸附）。**🌙 Night**（夜晚）会调暗太阳，让灯光照亮房间。
5. 按 **Y**（Roof），点击一个房间——在其上方生成双坡屋顶；**Shift+click** 另一个房间可将其纳入同一屋顶之下。在面板中可选择双坡（Gable）、四坡（hip）、单坡（shed）或平顶（flat），并设置坡度和挑檐。**⌂ Cut-away** 可隐藏屋顶和天花板。

另有：**W** Wall（独立墙；再次点击起点可围成房间）、**J** Floor（不带墙的地板）、**K** Ceiling（开/关房间的天花板）、**V** Stairs。点击任何已搭建的对象可查看其设置——房间的尺寸、墙高和墙厚、室内颜色、⟳ 90°、⧉ Duplicate。**B** 可为墙/地板/天花板/门/屋顶上色，**E** 或 **Delete** 用于删除。所有内容都会随模型一起保存、撤销、导出和发送（灯光会以 glTF 灯光的形式进入 Blender 和 Unreal）。

**⛶**（位于面板标题栏上）可让面板铺满 bitGen 窗口中标题栏与状态栏之间的整个区域（2.625.0）；此时它变为 **⇲ Dock**——点击它或按 **Esc** 即可还原。旁边的 **✕** 用于关闭面板（2.624.0）。
**☰ File** 中有 New、Open、Save、Save as、Rename、Import（项目中的 3D 模型或本机上的文件）、Export、Send、Delete 和 Close；**🖼 → Image editor** 和 **🎞 → Timeline** 是工具栏上的按钮。

### 地板上的墙、斜墙、随墙倾斜的天花板和屋顶（2.624.0）

- **bitGen 的主题配色**：面板及其 3D 视图的背景、网格和选区都采用主题配色（并随主题变化）。
- **Offset from floor edge**（距地板边缘偏移，位于 Room 和 Wall 工具的面板中）：沿地板（J）边缘绘制的房间或墙，其墙体外表面会从边缘向内缩进该距离（0 = 位于边缘上）。
- **拖动单面墙**（使用 Select，在房间的某面墙上按住）：墙会沿垂直于自身的方向移动，房间随之拉伸。拖动时地板边缘会显示其**吸附区域**；在其中松开，墙的外表面就会落在边缘上（含偏移量）。拖动整个房间时也会吸附到地板边缘。Shift = 不吸附。
- **双击墙顶** = 在该处添加一个切点；上下拖动该切点，墙顶会从两端角点向它倾斜（形成山墙）。点击**顶边**并拖动（或在面板中键入其两端的高度）可使墙倾斜——拖动角点时会带动相邻的墙。选中切点或边后按 **Delete** 可将其删除。
- 房间的 **Ceiling**（天花板）：None、**Flat** 或 **Follows the walls' slope**。**Roof** 工具的类型 **Follows the walls' slope** 会落在倾斜的墙顶上，并带有 **Eaves width**（檐口宽度）。
- **双击空白处**：取消所有选择，工具切换为 **🔄 Orbit**（按 Space 再次切换为 Select）。

### 编辑面、边和角点；手动调整门窗（2.625.0）

使用 **Select** 时：
- **面**：面板显示 **Extrude**（挤出；+ 向外，- 向内 = 切入物体）和 **Twist**（扭转）。**拖动面**可随指针挤出（类似 Blender）；**Ctrl+drag** 使其绕法线旋转——刚挤出的面会使其挤出部分随之扭转。在 Measurements 框中键入距离可修改上一次挤出。
- **边**：拖动可移动它（Shift：单轴）。**Shift+click** 可选择更多边，**Ctrl+click** 选择其所在面周围整圈的边。面板中有：**Length**、**Extrude edge**（生成一个新面——向上、从其所在面向外、沿红/绿轴）、**Fillet**（半径 + 段数；将两个面之间的边倒圆）。
- **角点**：点击并拖动（Shift：单轴；会吸附到其他角点上），或键入 X / Y / Z。被弯折而不再平整的面会被分割成三角形。
- **门或窗**：其两侧、顶部和底部（门除外）有控制柄——拖动它们可调整宽度、高度和离地高度；窗本身可沿墙拖动，也可上下拖动。窗的面板中有 **Elevation (height from floor)**（离地高度）。

### 大纲面板、踢脚线 + 顶角线、拖动墙、房间组（2.639.0）

- **🗂 Outline**（位于 Sketcher 的工具栏上）——视图左侧的一个面板，列出所有对象：Room groups、Rooms ▸ Room 1 ▸ Wall 1 … n、Floor 1、Ceiling 1、Skirting 1、Cornice 1、Floor slab 1、Door 1、Window 1 …；独立的 Walls、Roofs、Floors、Stairs、Lights、Furniture、Cameras。点击即选中；**👁** 隐藏/显示（可撤销，随模型保存）。
- **Room groups**（房间组）——＋ 新建一个组，房间上的 ⊞ 将其放入（或移出）组；组的 👁 可隐藏/显示其中所有房间。
- **踢脚线和顶角线**——新房间默认两者都有；在房间面板中可开关它们，并设置其尺寸和颜色。
- **墙**——被拖动的墙沿垂直于自身轴线的方向移动（相邻的墙随之伸长或缩短；地板、天花板、踢脚线和顶角线随之调整）；**Alt+drag** 可自由移动；**Shift+click** 选中整个房间。

### 选中、移动和转动摄像机（2.641.0）

- 点击摄像机即可选中：它会高亮显示（周围没有框），并显示**移动箭头**——红色 X、绿色 Y、蓝色 Z。
- **拖动摄像机**可在其当前高度上移动；**拖动箭头**则只沿该轴移动（蓝色箭头用于升降）；步长 1 cm，Shift = 自由移动。指针下方的箭头会变成黄色。
- **双击摄像机**显示**旋转圆环**（蓝色为转向，红色为俯仰，绿色为滚转——与 2.633.0 相同）；再次双击切换回箭头。其面板中也有 ✥ Move / ⟳ Rotate。
- 点击其他任何对象会选中该对象并释放摄像机；在摄像机线条旁边点击会选中那里的对象（以前一米以内的点击都会被摄像机捕获）。
- **透过摄像机观看**（2.643.0）——当选中的摄像机开启 👁 Look through 时，其面板中的 ✥ Move / ⟳ Rotate 会在你眼前（右下方）显示控件：拖动箭头或圆环，摄像机——以及视图——会随之移动或转动。**Esc** 取消选择摄像机（视图保持不变）。


### 各部分的独立属性；踢脚线、顶角线、门窗框和窗台的轮廓（2.640.0）

- **选中某部分 = 显示其独立面板**——在视图中（或在 🗂 Outline 中其所在行）点击墙、地板、天花板、踢脚线或顶角线，面板将只显示该部分：
  - **Wall n**——Length（矩形房间会保持其形状）、Height（仅此墙）、Thickness（房间的所有墙）、其自身的 **Inside colour**（室内颜色；↺ 恢复为房间的颜色）、👁 Shown、墙上的门/窗。
  - **Floor n**——On、Colour、Level、Floor slab；**Ceiling n**——None / Flat / Follows the walls、Colour、Height。
  - **Skirting n / Cornice n**——On、**Profile**、Height / Size、Colour、✎ Profiles…；**Floor slab n**——On。
  - ⌂ *Room*'s settings 返回整个房间的设置。对某部分按 **Delete** 会将其关闭（墙则为隐藏）——房间保留。
- **轮廓**——一个带图示的下拉列表（每个轮廓都绘制为其截面）：7 种踢脚线（Square、Pencil round、Bullnose、Chamfered、Ogee、Torus、Lamb's tongue），6 种顶角线（Square、Cove、Quadrant、Ogee、Stepped、Cove + band），6 种门框和 6 种窗框（Flat、Bullnose、Chamfered、Splayed、Colonial、Lamb's tongue），5 种窗台（Square、Bullnose、Round nosing、Chamfered、With an apron），然后是 **This project**（本项目）自己的轮廓。
  - 踢脚线沿房间一周扫掠生成，转角处斜接，并在门框处终止；顶角线沿天花板下方延伸。
  - 门或窗的面板：**Door frame** / **Window frame**（洞口周围的门窗套——门为两面，窗为房间一侧）和 **Window sill**（位于窗下，向后延伸至窗框），初始为 None，另有 Frame / sill colour。
- **✎ Profiles…**（下拉列表的最后一行，或该部分的按钮）——侧边列出同类的所有轮廓；在画布上绘制：点击可在最近的边上添加一个点，拖动可移动它，按 Delete / 右键点击可删除它（1 mm 网格，Shift = 自由）；键入 Width / Height 可缩放；**＋ New** 复制当前显示的轮廓。**💾 Save** 将其保存在项目中（projects/<project>/pushpull/profiles.json）并应用；模型会保留其所用每个轮廓的副本。

### 旋转圆环、滚转、镜头（2.633.0）

- 选中的摄像机或家具会显示三个圆环：**蓝色**使其转向（偏航），**红色**使其俯仰，**绿色**使其滚转。沿圆环拖动：步长 5°，按住 **Shift** 可自由旋转，**Ctrl+Z** 可撤回。
- 也可在其面板中以数值设置：摄像机的 **Turn (yaw)**、**Tilt (pitch)**、**Roll**；家具的 **Turn (yaw)**、**Pitch**、**Roll**。
- 摄像机的 **Lens**（镜头）：Fisheye (8 mm)、Ultra wide (14 mm)、Wide angle (24 mm)、35 mm、50 mm (normal)、85 mm (portrait)、135 mm、200 mm (telephoto) 或 Custom；**Focal length**（焦距，mm，全画幅）与 **Field of view**（视场角，°）相互联动。鱼眼镜头提供最宽的视野（但不绘制其畸变曲线本身）。Camera 工具的面板中也有相同的 Lens / Focal length / Field of view。
- **Zoom extents** 现在也会将摄像机纳入范围。

### 选中、移动、转动摄像机；取消选择（2.632.0）

- 摄像机绘制在所有对象之上——位于房间内（在其天花板和屋顶下方）的摄像机点击即可选中，而不会选中房间。拖动可移动它；**R** 使其转动 15°，**Shift+R** 反向转回（家具：R 为 90°，Shift+R 反向）。
- **Esc** 或**双击空白处**会取消所有选择（2.647.0：按一次 Esc 也会放下当前工具，切换为 🔄 Orbit；2.648.0：在 Orbit 中按 Esc = ➤ Select，Ctrl+click 可选中多个对象）。
- **🔄 Orbit** 的指针是环绕光标（围绕一个点的两个箭头），而不是手形（✋ Pan 仍为手形）。

### 摄像机视图、开启的门窗、自动屋顶 + 地板（2.631.0）

- **View ▾** 会随着摄像机的添加、重命名或删除列出模型中的摄像机（📷 Camera 1、…）；从中选择一个作为视图——采用它的位置、朝向和镜头（其自身的图标会移到不挡视线的地方）。在其面板中更改转向/俯仰/镜头会使视图随之变化；环绕、平移或缩放（或切换到标准视图）则会脱离该摄像机视图。
- 门或窗：**Open (%)** 和一个方向复选框——门向房间内开启（**Opens outward**：向外开），窗扇向外开启（**Opens inward**：向内开），推拉门/窗则滑动其中一扇（**The other pane slides**：改为滑动另一扇）。
- Room 工具：为每个新房间提供 **Auto roof**（采用 Roof 工具的类型）和 **Auto floor**（墙下 20 cm 厚的楼板）；房间面板中：**Floor slab under the walls** 和 **Roof** 开/关。

### 人物；旧版本的房屋（2.630.0）

- **🛋 ▸ People**：站立、坐着、行走或挥手的人体模型——在地板上点击放置；选中后可设置：Name、Pose、Height、Turn。
- **☰ File ▸ 🏠 A house from the House builder…**：由旧版本 House builder 保存的房屋会转换为 Sketcher 模型——房间（每层位于各自的高度）、门、窗、家具、人物、摄像机、灯光、楼梯；未能转换的部分（3D 模型部件、屋顶）会在状态行中列出。
- **Sketcher 取代了旧版本的 House builder**。SolidCraft 的 **📏 Send to Sketcher** 可将零件作为群组导入。

### 材质、摄像机 + 360° 地点、Furnish（2.629.0）

- **▦ Materials ▾**（位于颜色旁）：各种材质——砖、石材、混凝土、橡木/胡桃木地板、瓷砖、大理石、地毯、草地……均带纹理；选择一种后即可为面、墙和地板上色（B）。
- **Z 📷 Camera**：先点击摄像机的站立位置，再点击其注视位置（视线高度 + 镜头在面板中设置）。选中后：**👁 Look through**、**📷 Shot + depth + normal**（三张图片存入 Image assets）以及 **📍 360° location**（由此生成的全景图成为一个 Location——带有它的 @tag，即提示词中的地点）。用 Select 可拖动它；在面板中可转动/俯仰/命名。
- **🪄 Furnish**（位于房间面板中）：为房间布置家具——若有 LLM 在运行则由其挑选，否则使用该房间常规的家具组合；可选填描述（"a reading corner"）。Ctrl+Z 可撤除。
- 家具现在也会包含在 .glb / .obj 导出中。

### 家具和项目的 3D 模型；最大化 = 独占（2.628.0）

- **A 🛋 Furniture**（Build 工具）：家具库——选择一个 **Category**（Living、Dining、Kitchen、Bedroom、Bathroom、Lights、Outside）和一件家具，在地板上点击即可放置（它会立在房间的地板上，带有其材质和纹理）。**R** 使下一件家具转动 90°（或键入角度）。使用 **Select** 时：拖动家具，R 使其转动；其面板中有 Width / Depth / Height、Turn、Up from the floor、其自身颜色、⧉ Duplicate、🗑 Delete。家具随模型一起保存。
- **3D models** 类别列出项目中的 3D 模型（.glb / .obj——SolidCraft 生成的或导入的）；点击即可将其作为群组导入（可移动、缩放、上色）。
- **⛶ Maximize** 现在会关闭其他所有面板（标题栏和状态栏保留）；**⇲ Dock** / Esc 会重新打开那些面板。

### 模型的真实照片；Sketcher 图层（2.626.0）

该面板现在名为 **Sketcher**（原名 PushPull；**Push/Pull** 工具保留原名）。
- **当提示词面板打开时**（且图像编辑器不在屏幕上——它有自己的 Edit 链接——除非 Sketcher 已最大化）：提示词面板切换到 **🖼 Image**，并使用一个**编辑模型**（Qwen Image Edit、FLUX Kontext、FLUX.2 Klein edit ...——若该处所选模型支持编辑则使用它，否则使用默认模型），空的提示词会填入 **create a real photo of the model in view**，按钮显示为 **✏ Edit (Sketcher)**。Generate 会将 Sketcher 的视图发送给该编辑模型，照片以**真实图像**的形式返回——即项目 **Image assets** 中的一张普通图片（若图像编辑器已打开，还会成为其中的一个普通图层）。修改描述可得到其他效果（"a rainy evening street, cinematic"）。
  2.627.0：发送给编辑模型的是视图的**干净渲染图**（无轮廓线、网格或坐标轴；带阴影；日光天空）作为图片 1，以及其**深度图**（近处为白，远处为黑）作为图片 2，且提示词以
  "Convert image 1: Turn this 3D render into a photorealistic photograph of a building: real brick, timber, glass and concrete, natural daylight, soft shadows, no outlines, DSLR photo." 开头，并附加一行说明图片 2 是其深度图（对图片的称呼采用编辑模型自己的写法——Qwen 2.1 为 <image1>）。你的描述会添加在其后。关闭 Sketcher 时，提示词面板的模式、风格和文字会恢复原样。
- **🖼 → Image editor** 将视图作为一个 **📏 Sketcher layer**（以模型命名）发送；再次发送时会更新该图层，而不是新建一个。**🎞 → Timeline** 将模型作为 **📏 Sketcher layer**（3D）放入时间线。

## 在时间线上编辑：速度、调色、声音、混音和字幕（2.406.0）
<!-- en: editing-on-the-timeline-speed-colour-sound-mix-and-captions-2-406-0 88fa8720a65f -->

在时间线画布上选择一个片段；其 **Properties**（属性）中会出现三个折叠栏。所有设置都随时间线保存，画布会实时预览，**⚙ Compile** 会将其渲染出来。

### 🎬 Speed（速度）

| 控件 | 作用 |
|---|---|
| **Speed %** | 50 = 半速（在时间线上时长加倍），200 = 两倍速（时长减半）；10 – 1000 % |
| **⇄ reverse** | 片段倒放 |
| **Ramp** | 速度沿片段变化：*slow → fast*、*fast → slow*、*slow middle*、*fast middle*（会取代 Speed %） |
| **Frames** | 慢放帧的生成方式：*repeat*（清晰，但有顿挫感）、*blend*（混合相邻帧）、*optical flow*（流畅；编译较慢） |

片段在时间线上的长度随其速度变化。修剪边缘修剪的仍是*源素材*，对变速片段执行 keep / cut 也会保留正确的帧。在画布中，倒放或变速曲线片段会静音播放（浏览器无法倒放声音）；编译时会按该速度渲染其声音（保持音调不变）。

### 🎨 Colour（调色）

- **Look**：teal & orange、warm film、cool night、bleach bypass、vivid、faded、mono——作为滑块调整的起点。
- **滑块**：exposure（曝光，单位为档）、contrast（对比度）、saturation（饱和度）、temperature（色温，蓝 ↔ 琥珀）、tint（色调，绿 ↔ 品红）、hue（色相）。
- **LUT**：任意 3D `.cube` LUT（来自相机厂商、调色师或 LUT 包）。**＋ LUT** 将其导入项目的 `luts/` 文件夹；应用自身 `luts/` 文件夹中的 LUT 在所有项目中均可使用。**LUT mix** 控制其混合比例。

先应用 LUT，再应用滑块。画布显示的调色效果使用的正是编译时所用的同一张颜色表（整个调色效果会烘焙进一个 33 点 LUT），因此所见即所得。

### 🎧 Sound（声音）

在视频片段或声音片段上：**voice clarity**（去除低频隆隆声，略微增加临场感并均衡音量）、**denoise**（去除稳定的背景噪声：嗡嗡声、嘶嘶声、风扇声）和 **gain**（增益，dB）。**🎧 before / after** 从位置标记处开始播放几秒钟，先播放原声，再播放处理后的声音。

### 🎚 Mix（混音）

时间线上的 **🎚** 打开 Mix 对话框：

- **Roles**：每个图层为 🗣 *voice*、🎵 *music* 或 💥 *sfx*（V1 和视频图层初始为 voice，声音图层初始为 music）。
- **Ducking**：只要有人声出现，音乐就会按所选幅度（3 – 30 dB）降低，之后再恢复。
- **Loudness**：测量成片的响度，并将其统一到目标值：-14 LUFS（YouTube、Spotify）、-16（播客、Apple）、-23（广播电视，EBU R128）或 -24（美国广播电视）。真峰值保持在 -1.5 dB 以下。

### 💬 Captions（字幕）

时间线上的 **💬** 打开 Captions 对话框。

1. **✨ From speech** 在本机上使用 faster-whisper（在 *Settings → Audio* 中安装）转录所有含语音的内容（V1、视频图层，以及设为 🗣 voice 的任何声音图层），并生成字幕——每个片段的文字放在该片段所在的位置，并计入其修剪和速度。每个文件只转录一次，结果会被记住。*max chars* 设置单条字幕的最大长度；*language* 可保持为 auto。
2. 编辑字幕：开始和结束时间、文字，**＋** 在位置标记处添加一条字幕，**✕** 删除一条，**▶** 跳转到该处。
3. **Style**：字体、字号（占画面高度的 %）、颜色、粗体、描边或文字后面的 **box**（底框，可设颜色和不透明度）、底部/中间/顶部位置及边距。
4. **Output**：*burn into the movie* 和/或 *.srt beside it*（以影片名加 `.srt` 命名——播放器和 YouTube 会将其作为字幕轨读取）。**⬇ .srt** 立即下载字幕。取消勾选 *on* 可保留字幕但不使用。

画布绘制字幕的位置与编译时烧录的位置完全一致。

## 编辑工具、调色面板、导出队列和交换（2.407.0）
<!-- en: edit-tools-colour-panel-export-queue-and-exchange-2-407-0 4dd0750a653b -->


### 编辑工具

时间线的工具按钮：**▸ Select**（移动、修剪——与以前相同）、**⇤ Ripple**（拖动边缘：修剪它，并移动该图层上其后的所有内容）、**⇹ Roll**（拖动两个相接片段之间的边缘：剪切点移动，总长度不变）、**⇆ Slip**（拖动片段：显示其源素材的其他帧，位置和长度不变）以及 **↔ Slide**（拖动片段：它移动，两侧片段相应伸缩）。指针旁的提示会显示拖动的效果。放大视图可让每个边缘都有各自的控制柄。倒放的片段无法用这些工具编辑（其边缘方向是反的）。

**▯ Frame**（图层上方的 F）用于选择单帧：点击某图层的轨道（在片段上或片段之间），指针下方**该**图层上的帧即被选中——位置标记跳到该帧，并在该行上框出该帧。横向拖动可选择多帧，Shift+click 可从已选帧一直选到所点击的帧，← / → 将选区移动一帧（Shift：移动其末端）——在任何缩放级别下都精确。**Del**（或 ⌫）从该图层删除所选帧并闭合间隙（无论 ripple 复选框如何设置，总是如此）；↶ / Ctrl+Z 恢复；Esc 取消选区。
▯ Frame 开启时片段不会移动——按 V 切换到 ▸ Select。

**被剪切的片段仍是一个片段。** 在 ripple 开启时，若 ✂ Cut（或对帧按 Del）穿过片段中间，剪切点之前和之后的部分会重新合并为一个连续的片段：视频（或声音）会生成一个新文件——项目 Video assets 中的 "<name>-join1.mp4"（声音则为 Sound 中的 "-join1.flac"）——其中被剪掉的部分已去除，精确到帧；图片则只是变短。剪切会立即显示，合并稍后完成（较长的视频需要几秒钟）；一次 ↶ 即可同时撤销两者。以下情况保留为两个片段（状态行会说明原因）：变速片段（speed / reverse / ramp）、cut-out 片段、文字/形状/3D/生成的片段，以及 ripple 关闭时的剪切（间隙保留）。预览也会在下一个片段开始前一秒预先加载它，因此两个片段之间的剪切点不再闪黑。

**播放时用 Ctrl 标记 ▼ 范围。** 高亮一个图层，播放预览，在范围应开始的位置轻按 Ctrl（按下后松开）——时间标尺上位置标记处会出现一个 ▼——在范围结束处再轻按一次 Ctrl（出现第二个 ▼）。播放会继续进行，因此一遍即可标记任意多个范围；每个范围有各自的颜色，并在其图层行上显示一条色带。暂停时，指针位于时间线上时轻按 Ctrl 效果相同。Esc 会放弃已开始的范围。无论焦点在哪里（▶、速度列表、已勾选的复选框、缩放滑块），轻按 Ctrl 都会生效——只有可输入文字的框会拦截它——预览面板的播放器在播放时间线上的某个片段时也同样生效（范围会落在该片段在时间线上对应的时刻）。拖动 ▼ 可移动该端点（以整帧为单位）——预览显示其下方的帧。点击 ▼ 会**选中**其范围（Ctrl+click 或 Shift+click 可选中更多；Esc 取消选中）；右键点击 ▼ 会删除其范围，Del 删除所选范围的标记。时间线菜单栏中的 ▼ 组包括：计数、**✂ Cut**（剪掉所选范围——"✂ Cut 2 picked"——若未选中任何范围，则剪掉所有范围：从其图层中移除，是否波纹移动取决于其复选框；被多次剪切的片段会重新成为一个片段；选择栏中的 ✂ Cut 也会剪掉所选范围）、**⏩ Speed up**，可选 2× / 4× / 8× / 10×（视频图层上的所选范围或全部范围以相应倍速播放——就像快进跳过一段你不想等待的渲染；在 ripple 下其后的内容会前移），以及 ✕（删除所选标记，或全部标记）。Ctrl+Z 可撤销以上任何操作。

**悬停时间和播放速度。** 在时间线上悬停时，会在一个小框中显示指针下方的时间（时间码 · 秒 · 帧）。预览下方 🔁 旁的速度列表可按 0.125×、0.25×、0.5×、1×、2×、4× 或 8× 播放（▶ 和 Space 使用该速度；播放中更改会立即生效；设置会被保留）。J / K / L 仍可用于穿梭播放。

**✂ to new layer**（时间线菜单栏中的复选框，设置会保留）：✂ Cut、对帧按 Del 以及 Ctrl+K 分割会将剪切点**之后**的部分放到紧邻上方的新图层（"<layer> ✂"；V1 的部分放到第一个视频图层）。剪切点之前的部分保持原位。一次 ↶ 即可撤销。

**J / L 剪辑**（V1）：在 V1 片段的 🎧 Sound 中，*J … s early* 让其声音先于画面开始，*L … s late* 让声音在画面结束后继续；相邻片段自身的声音在这段时间内会被静音。

**时间码**：位置旁显示 HH:MM:SS:FF。起始时间码（例如 01:00:00:00）和帧率在 📤 Export 或 ⇄ Exchange 中设置。

### 🎨 调色面板

时间线上的 🎨（或片段 Colour 折叠栏中的 *🎨 more…*）会为所选片段打开 Colour 对话框：

- **Wheels**（色轮）：Lift（暗部）、Gamma（中间调）、Gain（高光）。将圆点拖向某种颜色；每个色轮下方的滑块使该亮度范围变暗或变亮；双击色轮可使其归中。
- **Curves**（曲线）：Master、R、G、B。点击添加点，拖动移动点，双击删除点。
- **HSL secondaries**：最多六个色相范围，每个都可单独偏移、增减饱和度或提亮（更蓝的天空、更暖的肤色、更柔和的绿色）——画面其余部分不受影响。
- **Scopes**（示波器）：位置标记处画面的波形图、RGB 分量图、矢量示波器和直方图，显示的是影片最终得到的画面。

所有这些都会烘焙进与 Look 预设和 LUT 相同的颜色表中，因此画布与编译结果一致。

### 📤 Export（导出）

添加影片需要输出的所有格式——一次编译即可全部生成，存放在 `<project>.mp4` 旁边：

| 格式 | 用途 |
|---|---|
| MP4 · H.264 | 通用 |
| MP4 · H.265 / HEVC | 体积约减半；需要较新的播放器 |
| MOV · ProRes 422 HQ | 剪辑和后期精修（体积大） |
| MOV · DNxHR HQ | Avid、Resolve（体积大） |
| WebM · VP9 | 网页 |
| GIF | 预览（无声音，15 fps，宽度最大 640） |
| WAV, MP3 | 仅声音 |

每种格式都有 **size**（短边尺寸）、**reframe**（9:16、1:1、4:5、21:9——*crop* 裁切中间部分，*pad* 用黑边填充，或用 *blur* 填充：在后方垫一份模糊的副本）、**frame rate**（帧率）和 **quality**（质量）。预设包可一次添加多个格式（*social*、*for editing*、*web*）。
*make them on every ⚙ Compile* 使该列表始终生效；**⚙ Compile + export** 立即执行。**Delivered** 列出可下载的文件。起始时间码会写入 MP4 和 MOV 文件；字幕的 `.srt` 放在每部影片旁边。

### ⇄ Exchange（交换）

- **Send to another editor**：*Final Cut Pro 7 XML*（可在 DaVinci Resolve、Avid 及大多数其他视频剪辑软件中打开）、*CMX3600 EDL*（仅 V1——该格式只能容纳一条画面轨）或 *OpenTimelineIO*。片段指向本项目中的文件。保留：片段、修剪、图层、静态图片、速度和倒放、不透明度、音量、时间码。不保留：运动和关键帧、调色、字幕、3D 图层。
- **Bring in from another editor**：选择一个 XML（大多数剪辑软件：*File → Export → Final Cut Pro XML*；Resolve：*Export Timeline → FCP 7 XML*）或 EDL。它会作为一条新的命名时间线打开；片段按文件名与本项目的素材匹配，缺失的片段会列出来（添加它们后再导入一次）。

## 按文字稿剪辑、场景剪切、卡拉 OK 错词修正（2.408.0）
<!-- en: edit-by-transcript-scene-cuts-karaoke-word-fixes-2-408-0 77ba86c0d7d0 -->

### 📝 Transcript（文字稿）

在时间线上选择一个视频或声音片段，然后按时间线上的 **📝**。片段中的文字会显示出来：其文件在本机上只转录一次（faster-whisper，*Settings → Audio*），结果会被记住，与 💬 Captions 相同。

- **选择文字**：点击文字，shift-click 选择一段连续文字，或横向拖动选择。双击某个词可跳转到该处。
- **✂ Cut them**：删除所选文字并闭合间隙；该图层上其后的片段前移。
- **⇥ Keep only them**：删除所选文字以外的所有内容。
- **Remove pauses over … s**：每段长于该时长的静音（包括片段末尾）都会缩短为 0.3 s。
- **Remove filler words**：删除 um、uh、erm、hmm 之类的填充词（以斜体显示）。
- **↺ Undo** 恢复上一次剪切。片段会变为同一文件的多个片段，文字稿会继续跟随它们，因此可以继续剪切。
- **✂ Scene cuts** 在镜头切换处分割片段。调低 *sensitivity* 数值可检测到更柔和的切换。

速度已更改（🎬）的片段必须先恢复为 100 % 才能按文字剪切。

### 🎤 Karaoke：错词修正

- **✎ Edit lyrics**：若某首歌曲没有已保存的歌词，此框现在会显示语音转文字识别出的文字——即卡拉 OK 所显示的文字——以便你更正错词（或粘贴真实歌词）。**Generate** 会保存歌词，并重新将其与歌曲对时。
- **⏱ Words & timing**：叠加层将显示的每个词，及其开始和结束时间。▶ 播放某个词。可在此更正单个词或微调其时间；**Generate** 会为该歌曲保留你的更正（*↺ undo my corrections* 会将其删除）。之后若更改歌词，将从新歌词重新开始。
- **💾 Save words** 为该歌曲保存更正，但不立即生成叠加层。
- **从 StoryBoard 中**：🎤 Karaoke 旁的 **✎** 会针对故事板的歌曲打开此对话框。执行 **💾 Save words** 后，每个已有歌词叠加层的场景都会用更正后的文字重新生成叠加层（新叠加层会替换时间线 Karaoke 图层上的旧叠加层）。

## 为所有视频模型启用 Override style（2.409.0）
<!-- en: override-style-for-every-video-model-2-409-0 ad09dc44a701 -->

在 Basic Settings 顶部勾选 **Override style**（覆盖风格）后，无论风格如何设置，都由 Basic Settings 为**所有**视频模型做决定——MiniMax H3、Wan 2.1 / 2.2 以及 LTX 2.3 / 2.5：

| 设置 | 开启 Override style 时的作用 |
|---|---|
| **Steps** | 使用该步数（0 = 模型自身的步数）。LTX 的 8 步调度会沿同一曲线按该步数重新划分；其简短的精炼步骤保持不变 |
| **CFG** | 引导强度（LTX：其 CFG 引导器，LTX 2.5 的视频 CFG——音频 CFG 保持不变） |
| **Seed** | -1 = 随机，任意数字 = 使用该种子 |
| **Model** | 新增的 *Model (override)* 框：ComfyUI 列出的任何模型；留空 = 使用风格自身的模型。Wan 2.2：替换高噪声模型（低噪声模型保持不变）。`.gguf` 文件通过 ComfyUI-GGUF 的加载器加载 |
| **LoRAs** | *Temporary LoRAs (video)* 会叠加在风格自带的 LoRA 之上 |

开关下方的一行文字会说明它当前正在决定哪些设置。若取消勾选，则与以前一样，以各风格自身的设置为准。
Generate 使用提示词面板中的文字；聊天中的 ⬇ To prompt / ▶ 按钮以及 Enhance 的 **Generate** 也以同样方式发送各自的文字（Enhance 的 Generate 以前在使用 LTX 风格时会失败）。场景板上的 ▶ 也会使用该模型、步数和 CFG（其场景保留 StoryBoard 的 ⚙ 中各自的种子规则）。LTX 模型是针对 8 步和 CFG 1 蒸馏的——增加步数或提高 CFG 会改变画面效果，且耗时更长。

## ✨ Effects 和 ◐ 调整图层（2.409.0）
<!-- en: effects-and-adjustment-layers-2-409-0 7fe06e2b0737 -->

**✨ Effects**（特效，位于视频片段的 Properties 中）：blur（模糊）、sharpen（锐化）、glow（辉光）、vignette（暗角）、grain（颗粒）；**crop**（裁切，每条边以 % 设置，裁掉的部分变为透明——画面保持原位）；**key**（抠像，用于绿幕或蓝幕：选取颜色，*match* = 多接近的颜色仍会被抠除，*edge* = 柔化边缘，*spill* = 去除边缘上幕布颜色的溢色——下方图层会透出来）；**stabilise**（稳定，在编译时稳定抖动的镜头）。画布对 key 和 crop 的显示完全准确，其他效果则为近似显示。

**◐ Adjustment layer**（调整图层，位于时间线工具栏中）：在位置标记处、新的顶层图层上添加一个片段。其 🎨 Colour（Look、滑块、LUT、色轮、曲线、HSL）和 ✨ Effects（模糊、锐化、辉光、暗角、颗粒）作用于其下方的所有内容，且仅在它覆盖的时段内生效。可像图片一样修剪、移动和淡入淡出；其不透明度控制调整效果的混合程度。

## 🎤 Karaoke：逐词微调、标记下方的歌词行（2.433.0）
<!-- en: karaoke-word-nudges-the-line-under-the-marker-2-433-0 4ff941804b91 -->

在 🎤 Karaoke ▸ **⏱ Words & timing** 中，每个词都有 **◀ ▶**（提前/推后）——词的开始和结束时间一起移动：

| | 移动对象 | 移动量 |
|---|---|---|
| 点击 | 该词 | **微调量**（0.05 s） |
| **Shift**+click | 该词 | **较大微调量**（0.25 s） |
| **Ctrl**+click（Mac 上为 ⌘） | 该词**及其后的所有词** | 微调量 |
| **Shift+Ctrl**+click | 该词及其后的所有词 | 较大微调量 |

这两个数值即列表上方的两个框（**Nudge** / **Shift**）——会保留到下次使用。任何词都不会移到 0 s 之前：若某次移动会导致这种情况，该次移动涉及的每个词的移动量都会被同等缩短，从而保持它们的间距不变（提示会说明实际移动了多少）。
Generate（或 💾 Save words）会为该歌曲保留新的时间。

**标记下方的歌词行**会高亮显示——即预览标记所在处正在演唱的那一行的所有词（若下一行在 1.5 s 内开始，则为下一行）；正在演唱的词更亮，👁 on canvas 会在画布上绘制同一行。

## 🎤 Karaoke 和 🧰 Tools 作为画布旁的面板（2.410.0）
<!-- en: karaoke-and-tools-as-dockers-beside-the-canvas-2-410-0 a1a5eda6a2fd -->

两者现在都是**面板**，不再是对话框。按住标题栏将其拖到预览画布的**左侧或右侧边缘**（该侧会高亮）后松开——或点击其标题栏中的 **◧** / **◨**。停靠后，它与画布等高，画布会为其让出空间；拖动该栏的内侧边缘可将其加宽。将标题栏拖开（或点击已高亮的 ◧ / ◨），它会再次浮动。🎤 Karaoke 首次打开时会停靠在右侧（画布足够宽时），这样就可以一边播放歌曲一边更正歌词：

- 在 **⏱ Words & timing** 中，正在演唱的词会高亮，列表跟随预览滚动；
- 词的**时间**是一个按钮，点击即可将预览定位到该处；
- 开始/结束时间旁的 **⤓** 会将其设为预览当前所在的位置；
- **👁 on canvas** 会在预览上绘制更正后的文字（仅显示在画布上，绝不会进入影片）。

**Space** 可在应用中的任何位置暂停预览——画布、实时预览或 Preview 面板中的视频——除非你正在框中输入文字。暂停时按下则继续播放。

## ⌨ 时间线快捷键、标记、In / Out 导出、帧（2.410.0）
<!-- en: timeline-keys-markers-in-out-export-frames-2-410-0 b730de5e8c21 -->

当指针位于时间线的**图层**上方时（画布保留其自身的快捷键）：

| 按键 | 作用 |
|---|---|
| V / B / N / Y / U / F | ▸ Select / ⇤ Ripple / ⇹ Roll / ⇆ Slip / ↔ Slide / ▯ Frame |
| Del / ⌫ | （▯ Frame）从所在图层删除所选帧——间隙闭合 |
| Ctrl（轻按） | 播放时：在高亮图层上，从位置标记处开始一个 ▼ 范围——在结束处再轻按一次 |
| I / O | 在位置标记处设置标尺选区的入点 / 出点（In / Out） |
| Ctrl+K | 在位置标记处分割（所选片段，否则为高亮图层上的片段） |
| ↑ / ↓ | 上一个/下一个编辑点 |
| Home / End | 开头/结尾 |
| M | 添加标记（位于标记上时：编辑其名称、颜色、备注） |
| Shift+M / Alt+M | 下一个/上一个标记 |
| Ctrl+Shift+E | 将位置标记处的帧导出为 PNG（指针在画布上方时也可用） |

**标记**是标尺上的旗标：点击 = 跳转到该处，拖动 = 移动，双击 = 名称/颜色/备注/🗑。📝 ✂ Scene cuts **as markers** 会在每次镜头切换处放置一个标记，而不是进行剪切。标记会在 ⇄ Exchange 中双向传递（XML `<marker>`、EDL `* LOC:`、OTIO 标记）。

📤 Export 的 **Range**：*the whole movie* 或 *In / Out only*——选择后者时，每种格式都只包含标尺选区（`<project>_<format>_io.<ext>`），其时间码从该部分的起点开始，其 .srt 也会裁切到该部分。**🖼 Export frame** 将位置标记处的画面保存为 `<project>_frame_HHhMMmSSsFF.png`，放在影片旁边。

## 🅰 文字特效预设（2.411.0）
<!-- en: text-effect-presets-2-411-0 3f55fbeb835d -->

文字图层的 Properties（时间线）以及图像编辑器的 Type 工具/文字 Properties 中有 **Preset**（预设）：由分层 PSD 文字特效制作的文字特效——应用自带 **Arena Gold 3D** 和 **Trend Candy 3D**——以及经典样式。文字会**在你输入时实时**以该预设绘制（文字变化时显示快速预览图，停止输入后显示清晰版本）；⚙ Compile 始终使用清晰版本。**＋ Import PSD text effects or a zip…** 可将你自己的 PSD（文字为带图层效果的智能对象）转换为预设；背景和装饰元素会被排除。可一次选择多个 PSD，或选择包含它们的 **zip**（文字特效包）：其中的每个 .psd / .psb（位于任意文件夹中）都会成为一个预设，其中的 bitGen 预设 .json 会原样添加，其附带的字体（.ttf / .otf）会放入应用自身的字体文件夹（安装文件夹中的 `fonts\`——之后所有字体列表都会显示这些字体）。预览图、说明文件以及 macOS 的 `__MACOSX` 副本会被排除；不是文字特效的 PSD 会在说明导入内容的那一行中列出，其余文件仍会照常导入。字体并不包含在 PSD 文件本身中：Preset 下方的提示会列出它所使用的字体。也可通过命令行操作：`node scripts/textfx_build.js <file.psd> "<Name>"` 会将内置预设写入 `textfx/`。

## ⏯ J / K / L、AV1、10 位色深、显卡（2.411.0）
<!-- en: j-k-l-av1-10-bit-the-graphics-card-2-411-0 ea987911a828 -->

| 按键（在时间线面板内任意位置） | 作用 |
|---|---|
| L | 正向播放；再按一次依次为 2×、4×、8× |
| J | 反向播放；再按一次依次为 2×、4×、8×（到开头即停止） |
| K | 停止 |
| K + L / K + J | 前进 / 后退一帧（按住 K） |

📤 Export 新增 **MP4 · AV1** 和 **MP4 · H.265 10-bit**（以及 *smallest* 交付包）。**use the graphics card's encoder when it has one**（显卡有编码器时使用显卡编码器）：只要在本机上可用，就用 NVENC、Quick Sync 或 AMF 生成 H.264 / H.265 / AV1，否则使用软件编码器——日志会注明用的是哪一个。

## ⏱ 一些较小的剪辑改进（2.412.0）
<!-- en: smaller-editing-jobs-2-412-0 04346b1e0bfd -->

- **丢帧时间码**（29.97 / 59.94）：📤 Export / ⇄ Exchange → *drop-frame*；文件中使用 HH:MM:SS;FF，XML（DF）、EDL（FCM: DROP FRAME）和时间线读数中也是如此。
- **标记范围**：标记编辑器中的 *length*（或 ⟦ ⟧ = 标尺的 In / Out，即入点 / 出点）；拖动色带的末端即可调整。**片段标记**：对选中的片段按 Ctrl+Shift+M——经过修剪、滑移、变速和倒放后，标记仍停留在原来的那一帧上。
- **◎ Track targets**（轨道目标）：未选中任何片段时按 Ctrl+K，会切分所有设为目标的图层。
- **🔗 Linked sound**（链接声音）：Properties → 🔗 Sound → ⤓ 将声音拆为独立片段；菜单栏中的 🔗 linked selection 让这一对片段一起移动；⛓ Unlink（取消链接）/ ↩ Sound back（声音归位）。
- 在 V2 及以上图层和变速片段上也可以进行 **J / L 剪辑**。
- 片段 Sound 部分中的 **🎧 EQ / multiband / reverb**（均衡器 / 多频段 / 混响）。
- 调色面板中的 **🎨 H/H and H/S curves**（H/H 与 H/S 曲线）。
- **✨ Effect keyframes**（效果关键帧）：先按 ◆ key here，然后在片段的其他位置移动滑块。
- **📤 ProRes 4444 (alpha)**（*overlay* 交付包）、**H.264 10-bit**，以及显卡编码器中新增的 **VAAPI**。

## ✅ 部分完成的剪辑功能现已完成（2.413.0）
<!-- en: partly-done-editing-items-finished-2-413-0 9a1df335297a -->

- 在**倒放**和**变速渐变**片段上，波纹 / 滚动 / 滑移 / 滑动编辑、边缘手柄和 Ctrl+K 均精确到帧。
- 变速片段上也可以使用 **Edit by transcript**（按文字稿剪辑）和 **scene cuts**（场景切点）。
- 📤 适配方式 **follow** = 智能重构图（裁切框跟随人脸、人物和画面中的显著内容）。
- ✨ **Stabilise**（稳定）：*smooth* 和 *locked*；编译时会测量抖动（vidstab）；画布显示稳定后的预览。
- ⇄ XML 中的速度采用常见剪辑软件的约定（按速度调整后的入点 / 出点），已用 OpenTimelineIO 验证。
- 🅰 文字预设：保留斜面和浮雕的轮廓等高线（2.413 之前制作的 PSD 需重新导入才能获得）。

## ✅ 嵌套序列、更完整的 XML、FCPXML、整序列文字稿（2.414.0）
<!-- en: nested-sequences-the-fuller-xml-fcpxml-whole-sequence-transcripts-2-414-0 91a7c064a10f -->

- **⧉ Nest**（嵌套，位于时间线的菜单栏）：选择另一个已命名的时间线——它会被编译成**一个**片段，放在位置标记处新建的图层“⧉ name”上。可以像任何片段一样修剪、移动和调色。当那个时间线再次保存时，该片段的徽标会显示 **↻ out of date**（已过期）：Properties → **↻ Re-render**（重新渲染；片段保持原有位置和修剪）或 **⧉ Open**（切换过去进行编辑）。一个时间线不能包含它自己，也不能包含已经用到它的时间线。
- ⇄ **XML 携带更多信息**：位置 / 缩放 / 旋转（Basic Motion）以及不透明度 / 音量，各自带有 ◆ 关键帧；💬 字幕作为文字标题；**调色**——每个调过色的片段的完整效果都会烘焙成导出文件旁边的一个 .cube（`exports/<name>_luts/`），文件名写在片段的注释中；将其作为片段的输入 LUT 应用即可（Resolve：节点的 LUT；Final Cut：Custom LUT）。bitGen 能精确读回自己的调色。
- ⇄ **FCPXML 1.10**，用于 Final Cut Pro X，支持导出和导入：V1 为主要故事情节，其他图层为连接的通道，声音图层在下方；包括速度、移动、关键帧、标记、字幕和起始时间码。
- 📝 **Transcript scope**（文字稿范围）：*this clip*、*its whole layer* 或 *the whole sequence*（V1、各视频图层和 🗣 人声声音图层按播放顺序合成一段文字）。剪掉文字时，会从说出这些话的那个片段中删去；作用于整个序列时，其后的所有图层也会一起前移，因此音乐和画面保持同步。↺ 可撤销。

## ✅ 轨道混音器、扭曲效果、转场库、颜色匹配（2.415.0）
<!-- en: track-mixer-distort-effects-the-transitions-library-colour-match-2-415-0 371d6a26a3ac -->

- **🎚 Mixer**（混音器，位于时间线的菜单栏）：每条轨道一个通道条——V1、每个视频图层、每个声音图层——外加 **master**（主控）：推子（−∞ .. +6 dB）、**pan**（声像，L 100 .. C .. R 100）、**M**ute（静音）、**S**olo（独奏），以及画布播放时的实时 **level meter**（电平表，左 / 右，保持峰值）。双击推子恢复 0 dB，双击声像恢复居中。成片也以同样的方式进行声像和混音（平衡定律：声像向右时，左侧音量降低）。
- 片段 Effects 中的 ✨ **Distort**（扭曲）：**lens**（镜头；向右 = 桶形 / 鱼眼，向左 = 枕形）、**mirror**（镜像；左 → 右、上 → 下、四向）、**warp**（变形；*wave*——横向波纹，可调大小和速度；*twirl*——中心处的旋涡）。画布显示的与成片完全一致。
- **转场**：现在共 59 种（擦向角落、柔和擦除、覆盖 / 揭示、挤压、光圈、谷仓门、切片、风吹、缩放……）。视频或图片图层的**入场 / 出场**会按其形状绘制（擦除、滑动、光圈）——画布和成片中都是如此——而不再总是叠化。
- 🎨 **🎯 Match**（匹配）：选择时间线上的另一个片段——本片段的 R / G / B 曲线会被设置成使其色调与那个片段的画面相匹配（各片段取位置标记所在的那一帧，位置标记不在其上时取中间帧）。强度 10 .. 100 %。这些曲线就是普通曲线：可以继续微调，或重置以撤销。

## ✅ 蒙版 + 跟踪、多机位、代理（2.416.0）
<!-- en: masks-tracking-multi-camera-proxies-2-416-0 57f3a43d726f -->

- 调色面板中的 🎨 **◯ Mask (power window)**（蒙版 / 窗口）：*ellipse*（椭圆）或 *box*（矩形）——中心、大小、旋转、**feather**（羽化，即柔和边缘）、**invert**（反转）。片段的调色及其后的效果（模糊、辉光、暗角、扭曲……）随后只作用于其内部（或只作用于外部）。面板打开时，其轮廓会显示在画布上。也适用于调整图层。
- **🎯 Track**（跟踪）：把位置标记放在蒙版正好覆盖目标的位置，按 🎯——蒙版会跟随目标直到片段结尾（画布和成片中都是）。如果跟丢了（目标离开画面），蒙版会停在那里并给出提示；**✕ track** 删除跟踪。移动已跟踪蒙版的中心会平移整条跟踪轨迹。
- **🎥 Multi-camera**（多机位）：把同一时刻的所有角度都放到时间线上，打开 🎥，勾选它们（第一个为参考），选择播放哪一个的声音 → **⇆ Sync by sound**（按声音同步）。V1 成为节目轨；播放它并按 **1 - 9**（或点击网格中的某个角度）即可在该处切换到那个角度。**⇲ Flatten**（拼合）会把这些切换保留为普通片段。
- **🪶 Proxies**（代理）：会列出高负载素材（宽度超过 1920、HEVC / ProRes / DNx、码率超过 40 Mbit/s）；点击 **Make for the heavy ones**（为高负载素材生成），然后勾选 **play proxies on the canvas**（在画布上播放代理）。成片、交付文件和交换文件仍使用原始素材。

## ✅ HDR、AAF、倒放片段的声音、动态图形模板（2.417.0）
<!-- en: hdr-aaf-the-sound-of-reversed-clips-motion-graphics-templates-2-417-0 d72759394706 -->

- 📤 **HDR**：10 位预设（H.265 10-bit、AV1、ProRes 422 HQ、ProRes 4444）带有 **colour**（色彩）选项：*SDR*（与母版相同）、**HDR10**（PQ、BT.2020，带 HDR10 元数据）、**HLG**（广播 HDR）或 **Rec.2020 SDR**（广色域）。母版的白色落在 203 尼特（HDR 参考白），因此在 HDR 屏幕上看起来与调色时一致。**HDR pack** 一次性添加一个 HDR10 文件和一个 HLG 文件。时间线上的 **HDR 片段**（手机拍摄的 HDR 视频）会经过色调映射再进入成片——不再发灰泛白。
- ⇄ **AAF**（Exchange → *AAF - Avid Media Composer, Pro Tools*）：将剪辑导出为 .aaf——每个视频图层为一条画面轨，声音为若干单声道轨，包括空隙和起始时间码；媒体按原位置链接。Avid / Pro Tools 得到的是剪辑结构，不包括不透明度、音量、移动或调色（Resolve 和其他剪辑软件请使用 FCP 7 XML）。WebM / MP3 媒体按原样链接——Avid 可能需要 .mov / .mxf 格式。需要 `pip install pyaaf2`（requirements.txt）。
- 🔊 **倒放 / 变速渐变片段在画布上也能听到声音**：只要位置标记落在它们上面，其声音就会渲染一次（使用成片自身的变速处理），然后与画面同步播放。
- 🧩 **Motion graphics templates**（动态图形模板，位于菜单栏）：选择一个模板，填写其中的文字，点击 **⤓ Insert at the playhead**（插入到播放头）——其图层会按你的画面尺寸落到时间线上，并带有各自的移动和关键帧。内置模板：*Lower third*、*Title card*、*End card*、*Corner tag*。**💾 Save as a template**（另存为模板）：勾选画面 / 文字图层（位置标记下方的图层已默认勾选），为文字命名并保存——所有项目都能看到它（列表中带 ★；🗑 删除已保存的模板）。

## ✅ 实时播放：渲染条、⚡ Render、⏱、播放分辨率（2.418.0）
<!-- en: real-time-playback-the-render-bar-render-playback-resolution-2-418-0 610c3c55b007 -->

- **渲染条**（标尺下方的一条细线）：没有线 = 画布可以实时绘制该段；**黄色** = 可能掉帧；**红色** = 负载太重，无法实时绘制（图层多、调色、模糊 / 辉光、蒙版、倒放或变速渐变片段、3D、调整图层——将鼠标悬停其上可查看原因），或者播放时**确实**掉过帧；**绿色** = 已渲染。
- **⚡ Render**（渲染，位于菜单栏）：时间线会被编译一次（真正的成片，存入项目缓存），每一段都变为绿色；画布在绿色段上**播放**时会显示这份渲染结果——即以全速播放的精确成片。一次编辑只会让它所涉及的那一段重新变红 / 变黄；再按一次 ⚡ 即可刷新。**Shift+click ⚡** 可关闭 / 开启这些预览。
- ▶ 旁边的 **⏱**：自按下 ▶ 以来有多少帧绘制延迟（绿色 0 = 流畅）。
- 其旁边的 **Full / ½ / ¼**：播放分辨率——播放时，片段的调色、效果和蒙版在一半 / 四分之一尺寸的画面上处理（暂停时的画面保持全尺寸）。

## ✅ 统一的提示词面板、⊖ 负面提示词面板（2.419.0）
<!-- en: one-prompt-docker-the-negative-prompt-docker-2-419-0 c669710f70b8 -->

- **所有工具共用一个提示词面板**：图像编辑器的 ✨ AI、时间线的 ✨ Fill、路径图层的主体、✨ AI scene、3DREAL 外观、角色创建器、环境和 VR 世界不再各自拥有提示词输入框——它们使用 **prompt docker**（提示词面板，P）中的内容。原来输入框的位置会显示一行文字，即该工具将使用的内容；点击它即可在提示词面板中编辑。提示词面板为空时，工具保留其自身的默认值。（场景自己的提示词、场景编辑器、歌词、语音和字幕保持原位——它们是该场景 / 歌曲自己的文字。）
- **⊖ Negative prompt docker**（负面提示词面板）——按 **2**（输入文字时无效；🎥 多机位对话框打开时，1 - 9 用于切换机位）或点击状态栏中的 **Negative**。写下画面中**不得**出现的内容。它会随每一次图像和视频生成以及 AI 编辑一起发送；为空 = 使用风格自带的负面提示词。其状态行会说明所选模型是否使用负面提示词：SDXL / Pony / Illustrious（以及 cfg > 1 时的 ComfyUI 图像风格）、LTX、Wan 2.1 / 2.2 和 cfg > 1 时的 MiniMax H3 会使用；FLUX / Qwen / Z-Image（蒸馏模型）、音乐和语音不使用。**↺ style** 会把风格自带的负面提示词放进来供你编辑。
- **LLM 给出的负面提示词会放到这里**：回复中的“Negative: …”行不再进入提示词——⬇ To prompt、```image / ```video 回复以及 Generate 本身都会把它移到 ⊖ 面板（取消勾选 *put the LLM's "Negative:" lines here* 可保留你自己的内容）。选中 LTX 或 Wan 视频风格时，LLM 现在会专门针对**该**模型来写（并附带一行 Negative）。

## ✅ 🤖 时间线内的 AI（2.420.0）
<!-- en: ai-inside-the-timeline-2-420-0 06819015cfcd -->

🤖 位于时间线的菜单栏中。每次渲染都从 **prompt docker**（提示词面板）获取文字，从 **⊖ negative docker**（负面提示词面板）获取负面提示词，并使用所选的视频风格（MiniMax H3、Wan 或 LTX）。对话框会在你按下之前显示这两项内容。
- **🔁 New take**（新镜次）：选中一个视频片段并按下——它会在自己的位置重新渲染（相同的起点、长度、位置和关键帧）；“start from its first frame”会保留该镜头的开场画面。旧文件保留为一个镜次：按 **⇆** 切换。
- **⇥ Extend**（延长）：从片段的最后一帧继续生成 N 秒，紧接在它后面；其后的片段会顺延。
- **🎞 B-roll**（空镜）：把位置标记放在 V1 的空白段 → 生成一个片段填满它（可选择从前一个片段继续）；或者在标尺上选择一个范围并选择 *a cutaway* → 在其上方新建一个“B-roll”图层，其声音关闭，让 V1 的声音继续播放。
- **✂ Cut to the beat**（按节拍剪辑）：选择歌曲（某个声音图层的片段或 V1），点击 **♪ Find the beats**（查找节拍；会显示其速度），然后选择 **⚑ Beat markers**（每 N 拍一个节拍标记）或 **✂ Cut the selected clip on the beats**（在节拍处切分选中的片段；切成同一文件的若干段）。

## ✅ GPU 合成器（2.420.0）
<!-- en: the-gpu-compositor-2-420-0 b9443ca6abb4 -->

画布**播放**时，各图层在显卡上合成：每个片段的画面作为一张纹理，在一次绘制中完成（移动、缩放、旋转及其不透明度）；只带有 🎨 调色的片段也在同一次绘制中完成调色。暂停的画面、图层的擦除转场和调整图层仍像以前一样走 2D 路径。⏱ 旁边的 **GPU** 可关闭 / 开启该功能。

## Wan 2.1 和 Wan 2.2
<!-- en: wan-2-1-and-wan-2-2 c2e6a202f010 -->

在 Basic Settings 的视频风格列表中选择 **Wan 2.1** 或 **Wan 2.2**，然后照常从提示词面板进行渲染。

| 模式 | Wan 的作用 |
|---|---|
| **Text** | 文本生成视频 |
| **F/L**，一张图片 | 该图片作为首帧（图像生成视频） |
| **F/L**，两张图片 | 首帧和尾帧 |
| **Ref** | 第一张图片作为角色（Wan VACE）。没有 VACE 模型时，该图片改为用作首帧，日志会注明 |

- **模型：** bitGen 使用 ComfyUI 自带的 Wan 节点自行构建 Wan 图，因此不需要工作流文件。它会按文件名为每种模式选用 ComfyUI 中已有的模型文件（t2v、i2v 480p / 720p、flf2v、vace）。对于 Wan 2.2，它会选用 high-noise + low-noise 这一对模型。如果缺少文件，任务会告诉你文件名。请从 Comfy-Org 的 *Wan_2.1_ComfyUI_repackaged* / *Wan_2.2_ComfyUI_Repackaged* 下载到 `ComfyUI/models/diffusion_models`，并下载 `umt5_xxl_fp8_e4m3fn_scaled.safetensors`（text_encoders）、`wan_2.1_vae.safetensors`（vae），Wan 2.1 的图片模式还需要 `clip_vision_h.safetensors`（clip_vision）。
- **强制使用某个文件：** 在风格的阶段中设置一个模型（Settings → Video styles），只要该文件适用于当前模式就会使用它。
- **步数和 CFG：** 留空则使用 Wan 自己的默认值（2.1：30 步，cfg 6；2.2：20 步，cfg 3.5）。使用 Lightning、lightx2v 或 CausVid LoRA 时，改用 4 步、cfg 1。
- **声音：** Wan 不生成声音。参考面板中的第一个声音会铺在片段下方。
- **帧率：** Wan 以 16 fps 渲染。片段会通过运动插帧转为 24 fps，以便与你的其他片段平滑衔接。每个片段最长 10 s；Wan 是用 5 s 的素材训练的，更长的片段可能出现漂移。

## 🥽 VR World（置身 360° / 180° 画面中的表演者）
<!-- en: vr-world-a-performer-inside-a-360-180-picture 5157f74b1d2f -->

StoryBoard 的 **🥽 VR World** 按钮会打开该对话框。

1. **🌐 World**（世界）：选择一张 360° 或 180° 图片，或拖入一张图片或一个 Image 素材。类型会根据文件名（`_360`、`_360_TB`、`_360_LR`、`_180_LR`、`SBS`、`TB`...）或画面比例判断。如果对话框有提示，请检查 **Type**。
2. **瞄准：** 在全景图上点击表演者站立的位置。**View °** 设置摄像机的视野宽度；数值越小，表演者显得越大、越清晰。**Shape** 和 **Size** 设置渲染参数（Size 0 = 与图片的清晰度相匹配）。*What the camera sees* 显示该视图。
3. **表演者：** 最多添加三张图片、一个声音（歌曲或人声）及其起始位置，以及一段提示词。
4. **Engine**（引擎）：
   - **MiniMax H3** 自己生成声音和语音。
   - **H3 + the sound lip-synced** 使用 MMH3_NativeAudio_MV，让表演者唱出或说出你提供的声音。
   - 任何 **Wan** 风格都会把你的声音铺在片段下方。
5. **✎ First frame**（首帧，可选，推荐）：图像编辑风格（Qwen Image 2.1 edit）会把表演者放进视图中。渲染随后从这一帧开始，因此场所保持不变。不使用它时，渲染从空视图开始，由提示词把表演者带入画面。
6. **▶ Render VR**。

完成的 `…_vrworld_360` / `_360_TB` / `_360_LR` / `_180_LR` mp4 会带着 VR 元数据进入图库。把它复制到你的头显上，用头显的播放器打开（DeoVR、Skybox、Meta Quest TV...）。

须知：

- **只有表演者会动。** 表演者周围的区域会动起来；世界的其余部分是你的静态图片。
- **Lock the background**（锁定背景）：在表演者以外的区域，两只眼睛看到的都是图片本身。这样可以消除闪烁或接缝，但也会失去地面上的阴影。
- **立体深度：** 场所保持其自身的深度（根据图片的左右眼画面测得）。表演者没有另一只眼睛的画面，因此会像一张平面卡片一样，站在其脚下地面所在的深度。从几米外看起来是正确的。
- **最佳效果：** 固定机位（会自动加入提示词）、表演者四周留有一定边距、View ° 设为 50–80，并使用 ✎ 首帧。

## 角色替换
<!-- en: character-swap 718cba8d6d7b -->

把一个新人物放进现有素材中——表演、摄像机运动、背景和**原始声音**都保留不变；只有角色发生变化。

**从提示词面板操作**

![Swap mode](images/swap-mode.png)

1. Basic Settings → **SWAP**。
2. References → **Image**：一张新角色的图片（`<Picture 1>`——H3 对它的称呼；清晰的全身照效果最好）。
3. References → **Video**：素材（使用第一个视频——[修剪它](#choosing-the-frames-of-a-reference-video)，只保留你需要的部分）。
4. 可选：**Swap from** / **Swap length**（秒），以及在提示词框中写入额外的指示（替换指令总会随同发送；输入框可以留空）。
5. **GENERATE**。

**让新角色稳定保持**（2.334.0）

- 每次替换 **4–5 秒的分段**。替换对话框的 ✂ Auto segment 默认切成 5 s 的分段；一次性运行 15 s 往往在几秒后就滑回原来的表演者。
- 安装 **H3 Character Swap LoRA**（Setup → Models → Video extras，或者把 `h3_character_swap_pro4500_1000.safetensors` 放到 ComfyUI 的 `models/loras` 文件夹下任意位置，然后重启 ComfyUI）。只要 ComfyUI 中有它，替换就会自动将其加入工作流，任务日志也会注明（“swap LoRA: … stacked”）。没有它，仅靠 H3 很少能保持住新角色。
- **Quality**（质量，位于替换对话框的菜单栏，2.336.0）：**Full**（默认——不使用 turbo LoRA，20 步，ComfyUI 自带的 H3 参考设置）、**Best**（28 步——替换 LoRA 测试时使用的设置）或 **Fast**（turbo LoRA，4 步——最快，但替换效果最弱）。Full 和 Best 的耗时大约是 Fast 的 5–7 倍。任务日志会写明所用的质量。
- 图片以完整细节发送给 H3（`ref_image_size` 取最大值），提示词将其命名为 `<Picture 1>`，这是 H3 自己的标签。

**在已渲染的场景上**

![Swap on a scene](images/scene-swap.png)

选中场景，按镜次栏上的 **⇄**，选择一张角色设定表（或选择一个图片文件），可选地设置一个时间窗口和一些指示，然后点击 **⇄ Swap**。结果会成为该场景的下一个镜次——旧镜次保留在你的素材中。

一次运行最多覆盖约 15 秒；更长的时间窗口会在此处截断，日志会注明（其余部分可以用更晚的起点再次替换）。

**整部影片——Swap 对话框**

StoryBoard 的 **⇄ Swap** 按钮会打开角色替换对话框，用于长于一次运行（约 15 s）的素材：

- **左侧**——点击方框选择新角色的图片（或把图片 / Image 素材拖到上面）；下方是提示词框，其下有 **✎ Write prompt**（见下文）。
- **中间**——预览只播放选框范围内的内容。其下方的菜单栏：**📂 Load video**（或把 Video 素材拖到预览上）、**Start**、**Duration**（选框）、**Max**（最长分段）、**✂ Auto segment**（把*整个*视频切成首尾相接、长度为 Max 的分段）、**⇄ Swap**（选框）和 **⇄ Swap all**（所有尚未完成的分段）。再往下是带选框的胶片条，每个分段对应一条彩色带；其下的标签用于选择分段，**▶** 只替换该分段，**✕** 删除该分段。
- **右侧**——结果预览，带有 **💾 Save**（保存一份副本到 Video 素材）、**↻ Retry**（相同时间窗口，新种子）、**⏫ Upscale**（相同时间窗口和种子，使用 StoryBoard ⚙ 中的放大器）和 **🎬 Compile**。完成的分段存放在 `projects/<name>/vidTemp`；**✓ Keep** 会把一个分段移到 `projects/<name>/vidSwap`；Compile 会按时间顺序把勾选的已保留分段合成为 Video 素材中的一个视频（`<video>_swapped.mp4`）。

**Engine: LTX Ripple**（2.339.0）——对话框的 **Engine** 下拉菜单可在 **MiniMax H3**（即上面的替换方式）和 **LTX Ripple** 之间切换。Ripple 对每个分段分两步处理：

1. **✎ First frame**（首帧）。Qwen Image 2.1 会把新角色放进分段起点处的画面中：相同的姿势、构图、光线和背景。每个分段会在分段标签下方出现一张卡片。第一次按 **⇄ Swap**（或菜单栏中的 **✎ First frames**）会生成这些卡片。每张卡片上：
   - **✎** 重新生成。
   - **🖌** 在 Image editor 中打开它。对话框会关闭；修饰完成后点击 **💾 Save**，然后重新打开 **⇄** 并按 **⤓**（使用你最近保存到 Image 素材中的图片）。
   - **⤒** 使用任意图片文件。
   - **✕** 删除它。
2. **渲染。** 默认情况下，分段的首帧一生成就开始渲染，因此一次 **⇄ Swap** 就能完成两步（2.343.0）。如果想先检查或修饰首帧，请取消勾选 **⚙ → ▶ render as soon as the ✎ first frame is made**，满意后再按一次 **⇄ Swap**。分段通过 Tim 自己的工作流 **LTX_Ripple_FFAF_Edit_v11** 渲染（2.342.0；它随完整 zip 包的 `comfy_workflows` 文件夹一起提供，并附有其 API 版本）。它会把你编辑过的首帧贯穿整个片段，同时保留原片的动作、节奏和摄像机运动。

镜次会被精确修剪到分段长度并带上原始声音，因此 ✓ Keep 和 🎬 Compile 的用法与 H3 相同。（Tim 的工作流把编辑后的静帧放在第 0 帧；应用会多渲染一帧并将其丢弃，使镜次与声音对齐。）

**多个首帧**（2.348.0）：菜单栏中的 **✎×N** 设置每次 ✎ 生成多少个首帧（1-4，每个使用新的种子）。每一个都会以小条带的形式保留在分段卡片上：**点击**某一个即可使用它，**双击**可放大查看。✕ 删除当前使用的那一个。设置为 ✎×2 或以上时，⇄ Swap 会先生成这些首帧，等你挑选后再渲染。

**✎ First frames**（2.349.0）总会为选框所在的分段再生成 ✎×N 个首帧——如果选框还不在某个分段上，会先把它变成一个分段。⇄ Swap 只为还没有首帧的分段生成首帧，否则直接从你选中的那一帧开始渲染。分段只有在拥有首帧时才有卡片：在最后一个首帧上按 ✕ 会删除该卡片，其他卡片随之上移。

如果渲染结果**全黑**，该分段会以此为原因判定失败，而不会保存一段黑色视频（用新种子重试；如果仍然是黑的，请重启 ComfyUI）。

**查看生成的内容**（2.347.0）：双击某张 ✎ 首帧图片，或 Finished / Kept 列表中某个已完成的分段，它会在中间的大预览中打开（单击某个分段会使其成为 Result，这样 💾 Save 和 ↻ Retry 就作用于它）。点击 **✕ back to the video**（预览左上角）、按 Esc 或触碰选框，即可回到你正在替换的视频。

**⚙ Settings**（📂 Load video 旁边的图标，2.342.0）：
- **Video size**（视频尺寸）：“from the video”（按视频的宽高比，短边 768，取 32 的倍数），或你自己设定的宽 × 高（⟲ from video 会自动填入）。
- **Duration**（时长）：分段长度（与 **Max** 相同；✂ Auto segment 按此长度切分视频）。
- **Steps**（步数，用于 LTX Ripple；Tim 的工作流为 8）以及 **Ripple strength**（Ripple 强度，1.35）。
- **LoRAs**：＋ Add LoRA，与 Basic Settings 中的 LoRA 行相同。它们会在 Ripple LoRA 之后加入 Ripple 渲染。
- **Seed**（种子）：Random，或 Fixed 并填写数值（🎲 随机选一个）。固定种子对 ↻ Retry 同样有效。
- **LTX Ripple: ▶ render as soon as the ✎ first frame is made**（首帧一生成即渲染；默认开启，2.343.0）。

应用会把 Ripple 或 Viggle 工作流中指定的模型文件与你的 ComfyUI 列出的文件进行匹配（子文件夹中的同一文件，或同类中最接近的文件），并在任务日志中注明（2.345.0）。加载一个看起来不像 VR 的视频时，会关闭 VR。

如果某个分段渲染失败，其所在行会说明原因（工作进程的原话，例如缺少某个节点包或 LoRA），菜单栏下方的消息行也会发出通知。

尺寸和种子同样适用于 MiniMax H3；H3 的步数由其 **Quality** 决定。

Ripple 需要 LTX 2.5 模型、ComfyUI `models/loras` 中的 `LTX25_Ripple_v11.safetensors`、conv 视频 VAE，以及除 KJNodes 和 VideoHelperSuite 之外的节点包 **ComfyUI-LTXVideo** 和 **RES4LYF**（*Settings → Models → ⤓ Model catalog*；节点包在 Setup 中安装）。渲染开始时，缺少的节点会连同其所属节点包一起列出名称。

**Engine: Viggle (H3)**（2.344.0）——Viggle-Animate，一个专为角色替换而做的 MiniMax H3 微调模型。它的用法与 LTX Ripple 完全相同：每个分段都会得到其 ✎ 首帧（由 Qwen Image 2.1 把角色重绘到分段的第一帧中），Viggle 会把这一帧贯穿整个片段，同时保留动作、节奏和摄像机运动。工作流是 Tim 上传的 `viggle_animate_h3_api.json`（位于完整 zip 包的 `comfy_workflows` 文件夹中）。

- **尺寸：** “from the video”即按视频的宽高比、短边 **480**（Viggle 自己的画布是 480 × 832）；可在 ⚙ 中自行设置。
- **Viggle steps**（⚙）：**3** 是工作流所用的快速 DMD 调度（“a 3 step Viggle Animate”）；5 和 7 是它较慢但更精细的预设。
- **Viggle DMD**（⚙）：DMD LoRA 的强度（1）。
- **Speed patches**（加速补丁，⚙，默认关闭）：工作流的 Sol-Attn 注意力补丁及其 fp16 累加。两者生效时都更快，但 Sol-Attn 在一次实际测试中导致 ComfyUI 崩溃，fp16 累加也可能使镜次变黑，因此除非你勾选该框，否则应用会将它们关闭。
- **Safe mode**（安全模式，⚙，2.350.0）：关闭所有可能导致黑色镜次的选项进行渲染。即：不使用加速补丁，不使用 fp16 累加，使用 ComfyUI 自带的注意力机制而不是工作流的注意力后端，并且在两者都有时使用 fp16 H3 VAE 而不是 int8 版本。速度会更慢。
- **黑色镜次：** 当 Viggle 镜次全黑时，应用会用相同的种子在安全模式下再渲染一次。如果成功，该镜次记为完成，该行会显示 🛟，并且 ⚙ 安全模式在接下来的渲染中保持开启（取消勾选即可再次尝试快速设置）。如果在安全模式下仍然是黑的，该行会注明：那就是模型文件或 ComfyUI 本身的问题。请重启 ComfyUI，更新它及其自定义节点，并检查模型是否已下载完整。
- ⚙ LoRAs 会加在 DMD LoRA 之后。不使用 Direction 框（Viggle 使用固定的文本条件）。
- 镜次包含分段的每一帧，并带有原始声音。
- **帧数**（2.351.0）：MiniMax H3 只渲染 17 × n + 5 帧，至少 124 帧（约 5.2 s），最多 362 帧（15.08 s）。较短或帧数不符合要求的分段会按下一个有效帧数渲染，之后再修剪回去。在 2.351.0 之前，发送的是分段自身的帧数（例如 120 或 48），而 H3 视频 VAE 无法编码这样的帧数。这很可能就是出现黑色镜次的原因。

**Engine: Viggle (native)**（2.351.0；自 2.352.0 起拥有自己的常驻引擎）是由 bitGen 自己的引擎运行的同一个 Viggle-Animate 模型，不需要 ComfyUI 图。它是可选的：其他所有任务仍以 ComfyUI 为引擎，上面普通的 **Viggle (H3)** 引擎没有它也能工作。它使用 Viggle 冻结的提示词嵌入，因此不需要文本编码器，并以 4 步（3 遍）、flow shift 3 进行渲染，这是 Viggle 自己的设置。

- **安装：** ⚙ → *Viggle native* → **⤓ Install**。它会构建自己的 Python 环境（`venvs/native`），并且只下载仍然缺少的内容。
- **🔍 Use my ComfyUI files**（使用我的 ComfyUI 文件）：引擎只读取每个文件的文件头，并尽可能使用你 ComfyUI 中的 Viggle 模型、其 DMD LoRA 和 H3 VAE（bf16、int8、int8-ConvRot 或 fp8；无法读取 nvfp4）。⚙ 区块会列出每个部分的来源：按文件名列出你的文件、“ComfyUI file found - 🔍 to use it”，或显示缺失。只会下载仍然缺少的内容。
- **内存**（2.352.0）：2.351 版引擎以全精度加载 66 GB 的模型，*同时*还保留一份锁页副本，所需内存超过了 128 GB 机器的容量，因此渲染一直停在“no steps started”。现在模型以 int8 打包形式保存在内存中（约为原来的一半大小）。每个块在运行前才在 GPU 上解包，同时下一个块已经在复制中（Wan2GP 的技术，从零重写）。一个小型本地服务器会在分段之间保持模型加载，因此只有每次会话的第一次渲染需要承担加载开销；当 ComfyUI 任务开始时，它会归还内存和 GPU。日志会分步显示加载过程（“packing the weights N%”）。
- **启动时安装**（2.353.0）：每次启动都会检查 Viggle (native) 是否已安装，并把结果记录在安装文件夹的 `components.txt` 中。值为 0 时会立即开始安装（可在队列中查看进度）。安装程序会读取你的 ComfyUI 工作流中指定的模型文件（先是 `viggle_animate_h3_api.json`，然后是 H3_Viggle 及其他工作流）：Viggle 模型、其 DMD LoRA，以及 H3 视频和音频 VAE。如果这些文件在 ComfyUI 的模型文件夹中，就直接使用，不再下载。Python 环境构建完成后会逐一检查这些文件；只会下载引擎无法读取的文件（这会多一次安装步骤，且 DMD LoRA 现在是单独的 2.5 GB 下载）。其余部分很小：配置文件和 Viggle 的提示词嵌入。
- **`components.txt`**（2.355.0）：`viggle native=0` 表示在下次启动时安装，`1` 表示已安装（不做任何操作），`2` 表示不安装。设置向导在你勾选 **Viggle (native)** 时写入 0，不勾选时写入 2；该选框会显示下载大小。值为 2 时仍可通过 ⚙ → Viggle native → ⤓ Install 安装，安装完成后变为 1。
- **Native steps / shift**（⚙）：4 和 3。对这个蒸馏模型来说，步数越多并不意味着越好。
- ✎ 首帧仍由 ComfyUI 中的 Qwen Image 生成。原生渲染本身不需要运行 ComfyUI。
- ⚙ LoRAs 以及 ComfyUI 的加速 / 安全模式开关不适用于原生引擎。
- 一个镜次为 5 到 14.4 s（124 到 345 帧）：较短的分段会按 124 帧渲染，再修剪回去。

Viggle 需要节点包 **ComfyUI-Viggle-Animate-H3**（在 Setup 中）、Viggle 模型（`minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors`，21 GB，位于 `models/diffusion_models`）、DMD LoRA（`viggle_animate_dmd_lora_r64.safetensors`，`models/loras`）、文本条件（`fixed_embed_fwd_anyframe.safetensors`，`models/text_cond`）以及 MiniMax H3 视频 VAE（int8 或 fp16 版本均可）。它们都可以在 *Settings → Models → ⤓ Model catalog* 的 **Video - Viggle-Animate** 下找到。工作流的加速补丁（Sol-Attn、Chunk FeedForward）在你的 ComfyUI 中有时会使用，没有时则跳过。

一些限制：

- **Quality** 和 **⏫ Upscale** 仅适用于 H3（不适用于 Ripple 或 Viggle 镜次）。如需更大的 Ripple 镜次，请在 ⚙ 中调大尺寸，然后点击 **↻ Retry**。
- Ripple 和 Viggle 不支持 VR。
- Direction 框中的普通文字会随同发送（例如“rain on her coat”）；带有 `<Video 1>` 标签的 H3 提示词会被忽略。

**✎ Write prompt**（2.335.0）——视觉模型会查看新角色的图片以及选框中间位置的视频画面，然后 LLM（在提示词面板的提示词下方所选的那个）会把一段替换提示词写入输入框：替换谁（“the man in the purple shirt”）、角色的脸、发型、服装和画风、保留动作、保留其他一切。输入框中已有的内容会作为你的要求一起附带（“keep his red cap”、“photoreal”），所以可以先输入要求再按下按钮。大约需要一分钟（两个模型依次加载）。结果可以随意编辑。同时包含 `<Video 1>` 和 `<Picture 1>` 的提示词会作为**完整**提示词发送；普通文字则会添加在内置替换指令之下。没有视觉模型时，LLM 仍会写出提示词（对话框会说明图片未被描述）。LLM 遵循的规则是 `lib/promptGuides.json` 中的 `minimax_h3_swap` 指南——把它复制到 `styles/prompt-guides.json` 中即可修改。

分段按 H3 的帧网格切分，因此衔接时没有间隙；最后不足一个网格步长的零点几秒不会被替换（对话框会说明有多长）。每个分段都是队列中的一个独立任务，因此在它们渲染期间你可以关闭对话框。

**VR 视频（360° 和 180° 立体）**

在视频菜单栏下方的那一行设置 **VR**：*360° mono*、*360° stereo (top-bottom)* 或 *180° stereo (side by side)*。文件名中注明了类型的文件（`_360_TB`、`_180_LR`、`_360` …）会自动开启它。

- 替换从不渲染整个球面。它渲染的是一个对准人物的**虚拟摄像机**：在预览中点击人物（或输入 **Yaw** / **Pitch**），设置 **View**（视野宽度，单位为度）和 **Shape**（站立的人物用 3:4 或 9:16）。**👁 View** 会精确显示替换将看到的画面——构图时给人物四周留一点空间。视野越窄越清晰。
- 对于立体视频，只替换左眼；右眼根据你原始素材的深度由左眼生成，因此两只眼睛看到的是同一个角色，并且处于正确的距离。
- 替换后的视图会以柔和的边缘放回未经改动的全分辨率画面中。结果保持 VR 布局和尺寸，超过 4K 时使用 H.265，文件名带有播放器识别的后缀，并携带 VR（球面）元数据。输出为 24 fps——即模型的帧率。
- 立体功能需要应用的 Python 中装有 `numpy` 和 `opencv-python-headless`（`start.bat` 会安装它们）。

**加载长影片：** 没有长度限制。📂 Load video 会打开应用的文件对话框，并*按路径*引入文件（硬链接或副本——不会通过页面上传任何内容）。如果播放器无法显示某部影片（H.265 / 8K），对话框会生成一个小的预览副本；替换始终使用原始文件。

**替换风格——`mmh3_chr_swap`**

替换通过视频风格 **mmh3_chr_swap** 进行渲染（Settings → Video styles；*Used for: Character swap*，替换工作流位于其 ref2va 槽位）。在提示词栏的风格下拉菜单中选择它会切换到 Swap 模式。可以像编辑任何视频风格一样编辑它——更换 H3 模型、加载精度、文本编码器、VAE、LoRA 或 Sage attention——也可以点击 **Duplicate** 保留多个变体（副本仍然是替换风格）。如果下拉菜单中选中的是替换风格，Swap 模式就使用它，否则使用 mmh3_chr_swap。替换风格不能用于普通渲染（应用会给出提示）。

## H3_Viggle 风格
<!-- en: the-h3-viggle-style af1e7b3397b9 -->

**H3_Viggle**（2.352.0）通过 ComfyUI，以 Viggle-Animate 的方式渲染场景。场景的**动作视频**驱动动作，一张图片决定由谁来表演：

- **ref2va：** 由角色设定表或图片来表演（`comfy_workflows/H3_Viggle_ref2va.json`）；
- **fl2va：** 由场景的首帧来表演（`comfy_workflows/H3_Viggle_fl2va.json`）。

两者都是 Tim 的 Viggle-Animate 图，只是去掉了并排对比部分。它们需要的 ComfyUI 文件与替换对话框的 Viggle (H3) 引擎相同（见上文 *角色替换*）。

**从提示词面板操作：** 选择视频风格 **H3_Viggle**，并把动作片段放进参考面板的 **Video** 标签页（其中第一个视频即为动作来源）。然后：

- **Ref**（ref2va）：由第一张参考图来表演。Viggle 只接受一张图片；其他图片会被舍弃，日志会注明。
- **F/L**（fl2va）：由首帧来表演。
- **t2va** 会被拒绝，因为没有可以驱动的对象。

**在场景板上：** 把 StoryBoard 的 *Workflow* 设置为 **H3_Viggle**。此后每个场景都会显示一个 **🎬 Motion** 槽位。Choose… 可从项目、其他场景的镜次或文件中选择视频；✕ 将其移除。场景的类型决定使用哪种变体：

- **Ref：** 由第一张角色设定表（或场景的第一张图片）来表演，使用 ref2va。
- **First / Cont / Trans：** 由场景开始的那一帧来表演，使用 fl2va。即该场景的 First 图片，若没有则为它所接续的那一帧。

没有动作视频的场景会被拒绝，并以文字说明原因。

长度和渲染的工作方式：

- **长度：** 场景板歌曲中分配给该场景的时间窗口；若没有，则为场景自身的长度；再没有，则为动作片段的长度。如果片段更短，会定格其最后一帧。
- **帧数：** H3 渲染 17 × n + 5 帧，Viggle 至少 124 帧。较短的场景按 124 帧渲染后再修剪。超过 15 s 会分块：从第 2 块起，每块都从交接帧继续（fl2va），并从上一块停止的位置开始截取动作。
- **动作片段**会按每个分块以渲染尺寸切分（缩放填满、居中裁切、32 的倍数），帧率为 24 fps，其自身的声音保留在镜次上。
- 使用 Viggle 的 3 步 DMD 调度，而不是 ⚙ 中的步数。风格的 LoRA 串接在 DMD LoRA 之后。fp16 累加处于关闭状态，因为它可能使 Viggle 镜次变黑。全黑的镜次会被拒绝，并以文字说明原因。
- H3 加速器、RefMods 和 ⏫ 放大阶段不适用。

## SFX 面板
<!-- en: the-sfx-dock 32bca537ef49 -->

用于管理项目音效的面板。音效以 48 kHz 立体声 WAV 文件保存在 projects/<project>/sfx 中，因此每次剪切都精确到采样点，反复剪切也不会损失音质。

- **📂 Add**（添加）可导入音频文件（wav、mp3、flac、ogg、m4a、aac、opus、wma、aiff）和视频文件（.mov、
  .mp4、.m4v、.mkv、.webm、.avi、.wmv、.flv、.mpg、.3gp、.mts/.m2ts、.ts、.mxf）。导入视频时会提取其音轨。没有音轨的视频会被拒绝，并显示相应提示。
- **波形：** 在波形上拖动可选取一段，点击可移动播放位置。🔍+ 放大显示选区，⤢ 重新显示整个声音。Start 和 End 可输入精确的秒数。▶ 播放选区；没有选区时播放整个声音。
- **Duration**（时长）为选区设定固定长度。在波形上按下，会以指针为中心放下一个该秒数长度的框，然后拖动即可滑动它。更改 Duration 时，框会从其起点开始调整大小；输入 Start 或 End 则会移动整个框。将 Duration 留空即可拖选任意长度。任何选区都可以抓住后滑动。
- **图库：** 每次保存的剪切（Keep 或 Delete）也会以 sfx_<name> 的名称复制到图库的 **Audio** 标签页，并自动打开该标签页显示它。再次剪切同一声音或使用 ↶ Undo，会更新这份副本。
- **✂ Keep selected**（保留所选）只保留选中的部分。**🗑 Delete selected**（删除所选）剪掉选中部分，并把两侧拼接起来。每个剪切边缘都会加上 5 ms 的淡变，避免产生爆音。
- **剪切的去向：** 剪切会直接修改文件本身，**↶ Undo**（撤销）可恢复到上次剪切之前的版本。勾选 **as a new file**（另存为新文件）则会写入 name_keep.wav 或 name_cut.wav，原文件保持不变。
- **→ 🔊** 将音效复制到 Sound 素材中，供时间线和参考面板使用。**🗑** 删除该文件。

### 🗣 Speech & dialog（语音与对话）(2.621.0)

在音效下方，SFX 面板还能带情感地朗读文本——可以是单一声音，也可以是为每位说话人分配一个声音的对话——使用 OmniVoice 或 Ming-3.0 TTS，并保存到 **Audio assets**（音频素材，projects/<project>/sound）中。

1. **File name**（文件名，文本上方的框）——文件以该名称保存为 .wav 或 .mp3；已存在的名称永远不会被覆盖（会加上 _2）。
2. **文本**——直接输入，用 **📋 Paste**（粘贴）粘贴（或按 Ctrl+V），或者写一段简要说明后按 **✨ Write**，让 LLM 写出台词（在框中按 Ctrl+Z 可恢复旧文本）。**＋ tag** 会在光标处插入 `[laughter]` 或 `[sigh]` 之类的声音标签。
3. **Description**（描述，文本下方的框）——说明它的用途。
4. 对话每行一句：`Anna (happy): We made it!`、`Ben: Already?`、`(sad) It is over.`。没有名字的行沿用上一行的说话人；空行表示较长的停顿。**Cast**（演员表）列出找到的说话人——为每人指定一个声音（来自 Settings ▸ Audio ▸ Voices），并为未标注情感的台词指定一种情感。**One voice reads it all**（一个声音读全部）会用所选的 **Voice** 朗读全部文本。
5. 选择 **Engine**（引擎）、**Emotion**（情感）、**WAV / MP3** 以及行与行之间的 **Pause**（停顿），然后点击 **🗣 Read & save to Audio**。下方的播放器会播放结果。

情感：neutral（中性）、happy（高兴）、sad（悲伤）、angry（愤怒）、fearful（恐惧）、disgusted（厌恶）、surprised（惊讶）。**Ming-3.0 TTS** 用其 EMOTION 任务朗读每一行（克隆的声音也可以）。**OmniVoice** 没有情感开关：情感会略微改变语速；保存为 `Anna.happy`（Anna 用高兴的语气录制）的声音会用于 Anna 的高兴台词；声音标签会被读成相应的声音。

文件自带 **metadata**（元数据）：标题、生成的日期和时间、描述、完整文本以及所用的声音（WAV：INFO 列表；MP3：ID3——文本作为其歌词）。

## Save 与 Save as（预览对话框和图库）
<!-- en: save-and-save-as-preview-dialog-and-gallery 6ede84779993 -->

- **Save as**（另存为）是每个图库缩略图左上角的小 💾 图标（歌曲的则位于名称行中）；鼠标悬停在缩略图上时它会变亮。它会以 Save As 模式打开文件对话框：选择文件夹，可按需修改名称，然后按 Save。如果该名称的文件已存在，对话框会询问一次，再次按 Save 即会替换。该文件夹会成为你的 **last save-as location**（上次另存位置）。
- 预览对话框中的 **💾 Save**（保存，位于 ↗ Open externally 旁边）会以文件自身的名称将副本直接保存到上次另存位置，不弹出对话框。如果同名文件已存在，副本会命名为“name (2)”，依此类推：Save 永远不会覆盖文件。第一次使用或该文件夹已不存在时，会以 Save as 的方式询问。按住 Shift 点击 Save 仍可选择文件夹。按钮的提示信息会显示将要使用的文件夹。
- 该位置对整个安装生效并被记住（workspace/save_as.json），在各项目之间通用。
- 从手机或另一台电脑（远程页面）操作时，这两个按钮都会通过浏览器下载，因为保存操作是写入运行 bitGen Studio 的那台电脑。

## 歌曲分段之间的过渡（桥接场景）
<!-- en: transitions-between-song-segments-bridge-scenes def16a1fcd25 -->

在 StoryBoard 的歌曲条上，勾选 **Transition**（过渡，位于 💾 之前），设置其长度（0.1 - 4 秒）和类型，然后按 💾。除最后一个分段外，每个分段都会把结尾的这几秒让给一个 **bridge**（桥接）场景，因此每个分段仍从你放置的剪切点开始。以三个分段为例，故事板会变为：场景 1、桥接、场景 2、桥接、场景 3。歌曲的 .seg 文件会原样保留你的剪切点。

桥接从前一个场景的**最后一帧**过渡到后一个场景的**第一帧**，因此要先渲染两侧相邻的场景（Render selected 会把桥接排在其前后场景之后）。每张桥接卡片上都有一个类型选择器，取代 Ref / First / Cont / Trans：

- **AI (fl2va)**——原生音频故事板（MMH3_NativeAudio_MV）用模型渲染这段运动，从最后一帧开始、到第一帧结束。H3 渲染 17n+5 帧，因此 0.5 s 的桥接会渲染 22 帧，然后精确适配为 0.5 s，并配上下方的歌曲。
- **标准过渡**——交叉溶解、溶解、黑场/白场过渡、擦除、滑动、圆形、时钟、像素化、模糊（即时间线的过渡列表）。由 ffmpeg 在两帧之间绘制：不需要模型，在任何工作流上都只需几秒即可渲染完成。

音乐视频编写器只编写分段；桥接保持原位。以相同类型再次保存会保留每张卡片各自的选择；在歌曲条上选择新类型会应用到所有桥接；取消勾选 Transition 并保存则会移除桥接。

## 场景板上的渲染尺寸
<!-- en: render-size-on-the-scene-board cc791480d451 -->

故事板渲染（卡片上的 ▶、↻ 重做、Render selected——包括原生音频音乐视频）按以下顺序确定渲染尺寸：

1. StoryBoard 的 ⚙ **Resolution**（分辨率），当它设为 480p/540p/720p/1080p 时；
2. 否则使用左侧 **Basic Settings** 的宽 x 高（其 Resolution/Aspect 选择器，或自定义字段）——每次按下时都会发送，并为该项目保存，因此排队的和自动启动的场景也会使用它；
3. 否则使用应用的默认尺寸（Settings）。

任务备注会说明使用了哪一种（"render size 1280x720 (Basic Settings, the left dock)"）。尺寸越大画面越清晰，但速度越慢，需要的显存也越多；720p 加上 ⚙ 放大器（对满意的镜次点 ⏫）是不错的平衡。

## 时间线的预览画布
<!-- en: the-timeline-s-preview-canvas 16831c3c0ea9 -->

时间线面板顶部现在有一块预览画布，左侧是工具栏，右侧是 **Layers**（图层）面板。时间线菜单栏中的 **⧉** 可显示或隐藏它们，画布下方的拖动条可调高或调矮画布。如果画布显得局促，可把时间线面板拖高。

- **拖放：** 可以从 Assets、图库或你的电脑把视频、图片或声音拖放到画布上。每一项都会放在位置标记处的一个**新图层**上，位于你放下的位置。拖放到空时间线上的视频会放在 V1 上。
- **工具栏：**
  - **✥ Move (V)**（移动）——点击图层将其选中，然后拖动来移动它。拖动角点可缩放，拖动顶部的圆形手柄可旋转。按住 Shift 可按 15° 步进旋转，或沿单一轴移动。V1 是底层画面：它始终铺满画面，不能移动。
  - **T Text (T)**（文字）——点击即可添加文字图层，然后在 Layers 面板中输入文字。字体、字号、颜色、粗体、斜体、描边、阴影和对齐方式都在那里设置。用 T 点击文字图层或双击它即可编辑。
  - **✋ Hand (H, or hold Space)**（抓手）用于平移视图。**🔍 Zoom (Z)**（缩放）用于放大；Alt 点击（或 Ctrl + 滚轮）缩小。**⤢** 使画面适合视图。
- **播放：** 使用画布下方的 ▶ / ⏸，或在鼠标位于画布上时按 Space。所有图层会带声音一起播放，时间线的位置标记也会随之移动。🔁 循环播放标尺选区，或整条时间线。
- **Layers 面板：** 👁 显示或隐藏图层，▲ ▼ 调整其顺序，🗑 删除图层，双击可重命名。下方显示所选片段的 X、Y、Scale、Rotation、Opacity 和长度。
- **Compile**（合成）会完全按照画布上显示的位置，绘制经过移动、缩放和旋转的图层以及文字。

### 在选区内生成（✨ Fill）

1. 选择 **⬚ Select** (M) 并在区域上拖出一个框，或选择 **🖌 Mask** (B) 涂抹该区域（Alt 擦除）。
2. 在 Layers 面板的 **✨ Fill** 中写下那里应出现的内容，选择 **Image** 或 **Video**（以及秒数），然后点击
   **✨ Generate**。
3. 结果会放在一个新图层上，正好覆盖该区域，并带有柔和的边缘（羽化），以便与场景融为一体。图片的持续时间为标尺选区的长度，或 3 s；视频从位置标记处开始。

### 用关键帧为图层制作动画

关键帧可以让图层随时间移动、变大、旋转、淡入淡出或改变颜色。在两个关键帧之间，画布会为你计算出每一帧（补间），Compile 也会绘制相同的动画。

1. 选中图层，把位置标记移到动画开始的位置。
2. 点击 Layers 面板中 X / Y / Scale / Rot 下方的 **◇ Key**。这会保存该图层在此刻的位置、大小、旋转、不透明度（文字图层还包括颜色）。时间线中的该片段上会出现一个 **◆**。
3. 把位置标记往后移，然后修改图层：拖动、缩放、旋转它，或输入新的 X、Y、Scale、Rot、Opacity 或颜色值。系统会自动在那里创建第二个关键帧。
4. 按 ▶。图层会从第一个关键帧动画过渡到第二个关键帧。

关键帧的数量不限。某个属性一旦有了关键帧，修改它时总是会编辑位置标记处的关键帧，或在那里新建一个。没有关键帧的属性保持不变。

- ◇ Key 旁边的 **◀ ▶** 跳到上一个或下一个关键帧。位于关键帧上时，它们旁边的菜单用于设置如何过渡到下一个关键帧：**linear**（线性）、**ease in**（缓入，开始时慢）、**ease out**（缓出，结束时慢）、**ease in+out**（缓入缓出），或 **hold**（保持不动，到下一个关键帧时直接跳变）。**✕◆** 删除该关键帧。
- 点击时间线中片段上的 **◆** 可直接编辑该关键帧：不透明度、音量、X、Y、缩放、旋转、颜色和缓动。带缓动的菱形为蓝色；保持型的为白色。
- 声音片段也可以有音量关键帧，现在 Compile 也会应用这些关键帧。

## H3 的渲染尺寸
<!-- en: render-size-with-h3 0ec15bb50627 -->

H3 以 32 像素为步长渲染。在 StoryBoard 的 ⚙ 中，**H3 size** 决定介于两个步长之间的尺寸如何处理：
**704** 向下取整（1280×720 渲染为 1280×704），**736** 渲染 1280×736，再把镜次裁回正好
1280×720（约慢 4%）。2.379.2 之前渲染的镜次底部有一条暗带；请重新渲染它们。

## 场景与歌曲
<!-- en: scenes-and-the-song 018ad1bb5722 -->

场景会对照歌曲中属于自己的那一段来渲染：从 15.5 s 开始的场景使用歌曲 15.5 s 起的部分。故事板上有歌曲时，每个渲染好的镜次都会放在时间线上相同的时间点，使画面与歌曲保持同步。如果想让每个镜次紧接在上一个之后放置，请在 ⚙ Timeline settings 中取消勾选 "Place each rendered scene at its song time"。

## 微移时间线片段
<!-- en: nudging-timeline-clips 708970a7a978 -->

- 时间线菜单栏右端的 **⚙** 会打开 **Timeline settings**（时间线设置）。在 **Nudge**（微移）下，设置 ← / → 每次移动片段的帧数（默认 1），以及 Shift + ← / → 每次移动的帧数（默认 24 = 1 秒）。对话框也会以秒为单位显示每个值。
- 点击片段将其选中，然后按 ← 或 → 在其图层上把它往前或往后微移。片段永远不会移到 0 之前。V1 会依次播放其片段，因此 V1 上的片段会停在紧邻它的前一个片段处。要让片段重叠，请使用视频图层。
- 在字段中输入内容或有对话框打开时，方向键不会触发微移。

## Override style 与 StoryBoard
<!-- en: override-style-and-the-storyboard 4e7a03445a62 -->

在 Basic Settings 中勾选 **Override style**（覆盖风格）后，StoryBoard 的渲染会使用 Basic Settings 的 **Steps** 和
**CFG**。它们优先于 StoryBoard 的 ⚙ 以及工作流自身的步数。取消勾选时，由 ⚙ 决定（留空 = 使用工作流自身的设置）。渲染的备注会说明使用了哪一个。Steps 为 0（"auto"）时，步数交由 ⚙ 或工作流决定。

## 回收站与重置项目
<!-- en: recycle-bin-and-resetting-a-project 48bdd209109a -->

- **🗑 Recycle bin**（回收站，位于左侧面板菜单栏）：打开项目的回收站。从图库或素材中删除的文件会进入这里。每个文件都会显示其来源位置和删除时间。
  - **↩ Restore**（恢复）把所选文件放回原来的文件夹（双击文件效果相同）。
  - **✕ Delete**（删除）永久删除所选文件。会先询问确认。
  - **🧹 Empty**（清空）永久删除回收站中的所有内容。会先询问确认。
- **↺ Reset project**（重置项目，位于左侧面板菜单栏）：删除整个项目文件夹（包括其回收站），然后以相同的名称和描述重新创建一个空项目。操作前会先要求你确认。之后每个面板都从空白开始，就像新项目一样：队列中该项目已完成的任务及其缓存文件也会被清除，该项目仍在排队或正在运行的渲染都会被停止（确认框会显示数量）。
- 如果项目中的某个文件仍在其他程序中打开（媒体播放器、资源管理器的预览窗格、ComfyUI），Windows 不允许删除它。重置仍会把项目变为新项目，然后告诉你哪些文件正在使用中。这些文件会在下次启动 bitGen Studio 时删除。
- 重置后可以立即添加角色（带图片）；上传的内容总是进入当前打开的项目。

## 卡拉 OK：带跳动小球的歌词
<!-- en: karaoke-lyrics-with-a-bouncing-ball 5ba9b3c8ea95 -->

- **歌词文件：** bitGen 生成的每首歌曲都会把歌词保存为项目文件夹中的 `lyrics/<song name>.txt`。对于你自己导入的歌曲，请把歌词放进该文件夹中同名的 txt 文件。
- **🎤 Karaoke**（卡拉 OK，位于 StoryBoard 菜单栏）：场景渲染完成后，bitGen 会为它再生成一个视频。该视频背景透明，显示该场景对应部分的歌词：当前行在演唱时由白变黄，下一行在下方等候，一个小球会跳到每个字词上。场景本身的视频不含歌词。
- 歌词视频放在时间线的 **Karaoke** 图层上，与其场景对齐。该图层始终位于最上层，Compile 会透过透明部分显示场景。
- **计时：** 如果安装了语音转文字（faster-whisper，Settings → Audio），它会根据演唱为歌词计时。没有安装时，歌词会平均分布在整首歌曲上，作为粗略参考。
- 打开 🎤 也会为已经渲染好的场景生成歌词视频。
- **场景底部出现横条或字幕？** 歌曲完成计时后，每个场景的提示词都会包含该部分演唱的歌词（用于口型同步）。提示词会告诉视频模型不要把这些歌词显示为文字。如果场景仍有横条，请隐藏 Karaoke 图层（👁），然后在图库中单独查看该场景：如果横条依然存在，说明是模型把它画进了视频，请重新渲染该场景。
- **时间线菜单栏中的 🎤** 可为任意歌曲制作卡拉 OK 叠加层：在时间线上选择一个声音片段（或一个声音素材），选择整首歌曲或标尺选区，检查歌词，然后点击 **Generate**。叠加层放在 Karaoke 图层上，与歌曲对齐。
- **🎤 Karaoke style**（卡拉 OK 样式，位于 StoryBoard 的 ⚙ 和时间线的 ⚙ 中）：字体、字号、颜色、不透明度、描边、文字阴影、背景条（颜色、不透明度、边框、框阴影、高度、距顶部的位置）以及小球的大小和颜色。新的叠加层会使用这些设置。

## 保存与打开项目
<!-- en: saving-and-opening-a-project ed4ab6ddb5f3 -->

- **💾 Save**（保存）会保存项目中的一切：StoryBoard 的歌曲和场景、提示词、提示词聊天、角色、环境、参考图、素材、图库、时间线以及每个面板的字段（例如音乐标题和增强后的提示词）。保持名称不变即可原地保存。
- **参考面板会随你的修改即时保存**（2.548.0）：添加、移除或描述过的图片、视频或声音会在几秒内写入项目，因此即使没有执行 💾 Save，关闭应用也会保留它们。所有内容都会保留——以前保存时只保留 9 张图片，第 10 张会导致整个保存被拒绝。同名图片（粘贴的图片都叫“image.png”）会获得各自的名称（image_2.png …）。
- **F/L、Swap 和 Text 不再丢弃图片**（2.548.0）：面板会保留全部图片；F/L 发送前两张（其余显示为淡化），Swap 发送第一张，Text 不发送。切回 Ref 时它们都还在。
- **StoryBoard 的共享提示词会在输入时随时保存**（2.548.0）——在你停止输入片刻后、离开输入框时以及应用关闭时都会保存；旁边的 💾 仍会立即保存。其中的 @tag 标签、章节参考图以及每个场景各自的图片，都会通过 Save、Save as 和关闭操作随项目一起保留。
- **Save as**（另存为）：在同一个框中输入新名称。整个项目会以该名称复制一份，应用随即打开该副本。原项目保持不变。已存在的项目名称会被拒绝，因此不会覆盖任何内容。
- **Open**（打开）：会先保存你正要离开的项目。然后应用重新打开你选择的项目，每个面板都与保存时完全一致。

## 新建项目
<!-- en: starting-a-new-project 092f51bd16f6 -->

**New project**（新建项目）让你从零开始。你正要离开的项目会先按原样保存。然后应用会在新项目上重新加载，因此每个面板都从空白开始：参考图、角色和演员、环境、场景、提示词聊天、素材、图库、时间线和音乐面板。队列只显示本项目已完成的任务。其他项目仍在渲染的内容会继续列出，直到完成为止。**Open** 某个项目即可返回该项目；一切都在你离开时的位置。

## 保存和清除提示词聊天
<!-- en: saving-and-clearing-the-prompt-chat e72c6c657159 -->

- **💾 Save** 会把对话保存为 **`<subject> - <date>`**，例如 `A woman walking in rain - 2026-10-05`。如果已有 LLM 在运行，由它来命名主题；否则名称取自你提问的前几个词。已被占用的名称会加上 ` (2)`。聊天会在一份新副本中继续。
- 旁边的**列表**显示所有已保存的聊天，最新的在最前。**📂 Load**（载入）打开其中一个。
- **🧹**（紧挨在列表右侧）清除当前对话：包括窗口中的内容和模型记住的内容。已保存的聊天会保留。如果聊天中有消息，会先询问确认。

## 截图与录屏（宣传片、教程）
<!-- en: screenshots-and-screen-recordings-promos-tutorials c4361e472f0f -->

菜单栏（窗口顶部的一排按钮）在 ⚙ 之前有两个图标按钮：

- **📷 Screenshot**（截图，Alt+Shift+S）：保存到图库的 Images 中，文件名为 `screenshot_<date-time>.png`。
- **⏺ Record**（录制，Alt+Shift+R）：点击开始。按钮会变成闪烁的红色 ■，鼠标悬停其上可显示时长。再次点击即停止。录像保存为 H.264 mp4（`screenrec_<date-time>.mp4`），位于图库的 Videos 中，可直接用于任何剪辑软件或手机。录制期间每秒都会把视频发送到服务器，因此录制长教程也没有问题。

右键点击任一按钮可打开选项。这些选项会保存在本机上。

| 选项 | 作用 |
|---|---|
| **App window**（应用窗口）/ **Whole screen**（整个屏幕） | 只捕获 bitGen Studio（教程最干净的画面），或捕获其所在的整个屏幕 |
| **Computer sound**（电脑声音） | 录制电脑播放的声音，例如你预览的渲染结果和歌曲。在应用中此功能适用于 Windows；在浏览器标签页中，浏览器会要求你勾选 "share audio" |
| **Microphone**（麦克风） | 录制你的解说，并与电脑声音混合 |
| **Countdown**（倒计时） | 关闭，或在开始前倒数 3 s 或 5 s，方便你把鼠标放到位 |

在应用中，窗口或屏幕会自动为你选定。在浏览器标签页中，浏览器会询问要共享什么。

## MiniMax H3 上的 CFG
<!-- en: cfg-on-minimax-h3 564ef27cb0e1 -->

MiniMax H3 经过蒸馏，以 **CFG 1** 渲染：每步只进行一次模型推理，不使用负面提示词。H3 的工作流图使用不带 CFG 输入的引导器（guider），因此在 2.366.0 之前，Basic Settings 中的 CFG 从未作用到它们。

将 CFG 设为**大于 1** 时，渲染会切换为真正的 CFG：额外运行第二次负向推理，使用相同的图片、声音和视频参考，并加上一段负面文本（含糊嘟囔、胡言乱语、多余的词、重复参考音频）。这样，引导只会强化你的**提示词文本**所添加的内容，例如 `<d>...</d>` 中的台词和表演。每一步都要运行两次，因此渲染时间约为原来的两倍。

- 从 **2 到 3** 开始。更高的值会导致过度锐化和过度饱和。
- 关闭 **Settings → ComfyUI → 4-step LoRA**，并使用 **20 步以上**。turbo LoRA 是为 CFG 1 设计的，它开启时任务日志会发出警告。
- 任务日志中的 `true cfg 3: 1 BasicGuider -> CFGGuider ...` 一行可确认 CFG 已生效。

## 用角色的声音说出带情感的台词（无歌曲）
<!-- en: speech-with-emotion-in-a-character-s-voice-no-song 54e16347816d -->

在没有歌曲的故事板上，角色会说出各自的台词，每人都用自己的声音。角色的声音片段**只用于音色**：音高、口音、质感和情感色彩。模型会被告知绝不能说出片段中听到的词语。

- **编写器如何写台词：** 每句台词都带有其情感和说话方式，例如
  `@anna whispers, voice trembling with fear: "Is someone there?"`。相应的面部和身体表现写在台词之前的那一拍中。它绝不会引用或复用声音片段中说的内容。
- **应用发送的内容：** 渲染时，每句台词都会转换为 MiniMax H3 自己的对白语法。表达方式放在标记之外，台词放在标记之内，例如
  `whispers, voice trembling with fear, in the timbre of <Audio 1>: <d>[English] Is someone there?</d>`。提示词结尾会说明只有这些台词会被说出来。正是以普通叙述写出的台词导致了模型胡言乱语。
- **声音片段：** 长于 8 s 的片段会去掉开头的静音，以 8 s 样本的形式发送给模型。这样模型能获得声音，而可以照搬的话语却少得多。你的文件不会被改动，场景备注会说明片段何时被裁剪过。
- **其他语言：** 在引号中写 `"[Spanish] ..."`，就会使用该语言代替英语。
- **提示词面板：** 提示词聊天（Enter）也学习了同样的语法。本地 LLM 并不总是遵循它，因此应用也会自行修正它们的输出。增强后的提示词返回时，其中的台词已被标记，控制台也会给出提示。每次提示词渲染都会标记仍在普通引号中的台词，例如
  `says with a bright smile: "Thank you!"` 会变为 `says with a bright smile: <d>[English] Thank you!</d>`。带引号的名称和招牌（"a hotel called "The Palace""）保持不变。所用的声音是提示词中称为她的声音的那个 `<Audio n>`，或者是唯一一个文件名中注明 voice 的参考声音。

## bitGen 如何编写带台词的 MiniMax H3 提示词
<!-- en: how-bitgen-writes-a-minimax-h3-prompt-with-speech 35022e7b0109 -->

所有编写视频提示词的 LLM（提示词聊天、✨ Enhance、参考面板）都学习了这种结构，并附有一个完整示例：

```
<Subject 1> is the woman in <Picture 1>, the charismatic host of a luxury travel ad.
<Subject 2> is the reception area and desk in <Picture 2>.
<Audio 1> is the voice timbre for <Subject 1> - pitch, accent and tone only.

Medium shot. ... She looks into the camera and says with a bright, welcoming smile, in the timbre of
<Audio 1>, <d>[English] Thank you!</d> She then holds her warm smile in silence as the camera slowly
pushes in. ... Sound: only her line in <d>, then a soft sea breeze and gentle room tone.
```

- 定义放在最前面，每行一个：先是主体，然后是声音。
- 每句台词都内嵌在文中，情感写在标签外，台词写在标签内，并标明语言。
- 一句短台词之后，说话者做一个无声的动作。
- 提示词以一行 Sound 结尾，绝不堆叠多条“不要说话”之类的否定指令。

本地 LLM 会偏离这种结构，因此 LLM 生成的提示词以及每次提示词渲染都会由应用自行整理成这种结构。控制台或任务日志会列出所做的修改：

- `<subject n>` 变为 `<Subject n>`。
- 带引号的台词变为 `<d>`，没有标明语言的 `<d>` 会加上 `[English]`。
- 每个 `<d>` 行都会加上 "in the timbre of"（以……的音色）该声音。
- 声音只在主体行之后定义一次。
- 多余的 "the voice is only the timbre of…" 句子以及重复的 "do not speak / no murmurs / DO NOT SPEAK
  AUDIO 1" 指令会被删除。取而代之的是一句结尾说明：只有 `<d>` 行会被说出来。
- 诸如 "she does not speak until the door opens" 这样的剧情节拍会被保留。

## 音乐视频故事板上的口型同步
<!-- en: lip-sync-on-a-music-video-board 9bf7211ac7cb -->

在 **MMH3_NativeAudio_MV** 故事板上，歌曲就是人声：只有当场景的提示词中包含演唱句（`… sings the exact supplied vocal
audio with natural, precise lip synchronization …`）时，该场景才会进行口型同步。写有
`lips remain fully closed` 的场景会渲染为**无**口型同步。从 2.356.0 起：

- **由歌曲带时间轴的文字稿决定。** 对故事板歌曲的歌词转录一次（Voice / Stems → Transcribe，lyrics 模式）。文字稿会以 `<song>.srt` / `.lrc` 的形式保存在项目的 `transcripts` 文件夹中，你也可以把自己的 `.srt` / `.lrc` 放在歌曲旁边。之后每个场景在渲染时都会检查其时间窗口：
  - **窗口内有歌词：** 闭唇句会变为演唱句，并把歌词写入提示词（`The words sung in this clip: "…"`），以帮助口型匹配；
  - **没有歌词**（前奏、独奏、间奏）：演唱句会变为闭唇句。
- **编写器**看到的是同样的列表（哪些场景有演唱，以及对应的歌词）。它必须让每个场景都演唱，只有在文字稿（或你的简要说明）表明是纯器乐的段落上才可以闭唇。吉他或安静的氛围不再是闭唇的理由。
- **没有文字稿：** 闭唇场景保持原样，渲染备注会说明它将没有口型同步。

## 提示词 LLM 与你的参考素材
<!-- en: the-prompt-llm-and-your-references d2f33a82023b -->

当你围绕**视频**聊天时，LLM 会按照视频模型接收的方式获得参考面板的内容（2.354.0）：

- 图片按托盘顺序为 `<Picture 1>`、`<Picture 2>` …，每张都附有其主体编号、作用，以及本地视觉模型生成的一行描述（只描述一次，之后记住；关闭 🖼 Describe 则跳过）；
- 视频为 `<Video 1..3>`，声音为 `<Audio 1..3>`。

它会写出这样的提示词：*`<subject 1> is the woman in <Picture 1>.` Keep the
head, face and hair of the woman in `<Picture 1>`, keep the body of the
woman in `<Picture 2>`. She does the action in `<Video 1>`, her voice is
`<Audio 1>`.*（意为：subject 1 是 Picture 1 中的女子。保留 Picture 1 中女子的头部、面部和头发，保留 Picture 2 中女子的身体。她做出 Video 1 中的动作，她的声音是 Audio 1。）如果模型仍把文件名写成标签（`<photo.png>`），或写成 `<sound 1>`，回复会在你看到之前被纠正为正确的标签。MiniMax H3 把声音称为 `<Audio n>`。

## 提示词渲染中的参考视频和声音
<!-- en: reference-videos-and-sounds-in-a-prompt-render 8a3bb8227765 -->

参考面板的 **Video** 和 **Sound** 标签页会以 `<Video n>` 和 `<Audio n>` 的形式提供给 MiniMax H3 的参考渲染（ref2va）：每种最多 3 个。从 2.353.0 起：

- **按需添加槽位。** 如果风格的 ref2va 工作流（例如 **H3_Video_Ref**）保存时只有图片槽位，渲染时会自行添加视频和声音槽位。视频自带的声音会随视频一起送入。日志会显示 `the graph had no video reference slot - added 1`。
- **无需图片。** 参考模式只用一个视频或一个声音也能渲染。文本模式下如果加载了视频或声音，会按 ref2va 渲染，以便用上它们，队列也会提示这一点。
- 参考工作流（H3_Video_Ref）上的 First / Last 也会一并发送视频和声音。

## 参考视频的 Append / Prepend (2.388.0)
<!-- en: append-prepend-a-reference-video-2-388-0 fd5c8eebcbc7 -->

在 **References → Video** 中，每个视频下方都有一个 **Use**（用途）下拉菜单：

- **Reference**（参考，默认）：模型跟随该视频，与之前相同。
- **Append**（追加）：**Generate**（提示词面板）取该视频的**最后一帧**，将其放大到视频的尺寸（使用 ⚙ PNG 放大器，没有则使用 lanczos），并渲染一段从它**开始**的新部分。结果是**视频 + 新部分**合成的一个片段；单独的新部分保存为 `<name>_part.mp4`。
- **Prepend**（前置）：同理，但使用**第一帧**：新部分在这一帧**结束**，并放在视频**之前**。

**始终使用首帧 / 尾帧（2.395.0）。** Append 和 Prepend 始终以 **fl2va**（MiniMax H3 的首帧 / 尾帧模型）渲染，绝不使用 References 或普通的图生视频：

- **Picture 1** 是视频的帧：Append 时为其最后一帧（新部分的开头），Prepend 时为其第一帧（新部分的结尾）。
- **Picture 2** 是 **References → Image** 中的第一张图片：Append 时为新部分的结尾，Prepend 时为新部分的开头。如果有 Type 为 **Last frame**（Append）或 **First frame**（Prepend）的图片，则改用该图片。
- Image 标签页会把这张图片标记为 **Picture 2 · last frame**（或 **· first frame**）。fl2va 只接受两帧，因此其他图片会变暗并标记为 **not used**。视频自己的卡片会说明它提供的是哪一帧。
- 没有图片时，新部分从视频的最后一帧开始（Append）。对于 Prepend，则从第一帧向后生成，再无声倒放，使其正好衔接到视频上。
- 不会向提示词添加 `<subject n>` 行，因为这些图片是帧，而不是主体。

**LLM 会得到说明。** 提示词聊天会获得以下细节：

- 这是对该视频进行的 fl2va Append 或 Prepend；
- **Picture 1** 是它的最后一帧（或第一帧）。该帧会被提取出来，并像任何参考图一样由本地视觉模型进行描述；
- **Picture 2** 是你的图片，以及新部分在哪里开始或结束。

LLM 会写出一个延续该视频或引出该视频的连续镜头，不含映射行，也没有剪切。

同一时间只能有一个视频设为 Append / Prepend。它适用于 MiniMax H3 风格和 Wan 风格。**Refmods**（从角色中提取的身份 mod）也可用于 fl2va 渲染——属于实验性功能，由故事板的续接分块使用。

## 浮动提示词面板 (2.389.0)
<!-- en: the-floating-prompt-docker-2-389-0 37c14c73c3d7 -->

提示词面板作为一个独立窗口浮动在应用之上。

- **移动：** 拖动其标题栏。它的边缘会吸附到其他面板和窗口的边缘。
- **调整大小（2.398.0）：** 拖动任意边缘或角。停靠在侧边面板中时，拖动其底边同样可以调整大小。停靠在列中时，用它下方的手柄调整大小。如果它下方没有打开的面板，上方的面板会为它让出空间。
- **折叠：** 点击其标题栏。
- **停靠：** 把它拖到另一个面板上方，靠近的那条边会高亮。在那里放下：
  - 上边或下边：将它放进该面板上方或下方的列中；
  - 左边或右边：将它放在该面板旁边。两者之间的分隔条用于设置其宽度。
  - 侧边面板（Settings、References、Assets、Queue、Gallery）会在其顶部或底部接纳它。
- **重新浮动：** 把它的标题栏拖出停靠位置。
- **P** 可在应用中的任意位置显示或隐藏它。在输入框中输入、有对话框打开或按住 Shift 时（Shift+P 是时间线的 Path 工具），P 不起作用。
- 它的位置和大小保存在 docker_status.json 中。

## Basic Settings 和 LLM tokens 改为浮动 (2.393.0)
<!-- en: basic-settings-and-llm-tokens-float-2-393-0 73f7a8bca880 -->

**Basic Settings** 和 **LLM tokens** 不再位于左侧面板中。它们各自成为一个独立的浮动面板。

- **S** 显示或隐藏 Basic Settings。**L** 显示或隐藏 LLM tokens。
- 在输入框中输入、有对话框打开或按住 Ctrl、Alt 或 Shift 时，这些键不起作用。
- 在图像编辑器和时间线画布上，S 和 L 仍是这些工具的快捷键（编辑器中的 Clone Stamp 和 Lasso，画布上的 3D Scale 控件）。请先把指针移开。
- 左侧面板在原来这两个区域的位置有两个按钮：**LLM tokens L** 和
  **Basic Settings S**。点击按钮可显示或隐藏对应的窗口。窗口显示时，按钮会高亮。
- **移动窗口：** 拖动其标题栏。它的边缘会吸附到各面板的边缘、彼此的边缘以及窗口的边缘。
- **调整窗口大小：** 拖动任意边缘或角。
- **✕** 隐藏窗口。
- 每个窗口是否显示、其位置和大小都保存在
  docker_status.json（`floats`）中。

**它们是面板（2.398.0）。** 通过标题栏拖动 Basic Settings 或 LLM tokens 时，将要放置的位置会高亮：

- **作为标签页放进某个面板：** 放到该面板的标题栏上。该面板会出现一排标签页：先是它自己的名称，然后是其中的每个面板。点击标签页即可切换。这适用于任何面板，包括左侧的 Settings。
- **放在底部面板的上方或下方**（Preview、Video、Music…）：放到该面板的顶边或底边附近。它会在列中占据自己的位置，其底边用于设置高度。
- **放在底部面板旁边：** 放到左边或右边附近。其内侧边缘用于设置宽度。
- **堆叠在侧边面板中**（Settings、References、Assets、Queue、Gallery）：放到顶边或底边附近。其底边用于设置高度。
- **放进左侧面板的列表**（2.401.4）：把它拖到 Settings 列表（System、面板按钮……）上方。两个区域之间会亮起一条线，标签会说明放置位置，例如 "Dock Basic Settings in Settings - above the
  panel buttons"。放下后，它会以完整高度位于列表中，并随列表滚动，就像以前那些区域一样。LLM tokens 和 Basic Settings 可以按任意顺序放置。仍可通过其标题栏把它拖出来。
- 在其他任何地方松开，它就会浮动在那里。
- **重新浮动：** 把它的标题栏或标签页拖出来。
- 无论停靠在哪里，**S**、**L** 和 ✕ 仍可隐藏和显示它。

每个面板的停靠位置、大小以及当前显示的标签页都保存在
docker_status.json 中，因此重启后会恢复原样。

## 选择参考视频的帧
<!-- en: choosing-the-frames-of-a-reference-video bf7352c5da70 -->

![Reference video selection](images/reference-select.png)

点击 **References → Video** 标签页中的任意视频：

- **预览**只循环播放所选的帧；
- **胶片条**可用 **− / + / 滑块 / Ctrl+滚轮** 缩放（从整个视频一直放大到每帧一张缩略图）；**Fit** 显示全部；
- **选择框**的长度等于 **Duration**——可以拖动它、点击胶片条使其居中，或用 **← →** 微移（一帧；Shift = 一秒）。起始帧和结束帧显示在预览下方。

**Apply**（应用）会把这些帧精确剪切到原文件旁边的 `<name>_sel_f<first>-f<last>.mp4` 中，并将其放入参考槽位——此后 Ref、F/L 和 Swap 只使用这一部分。再次点击剪切后的视频会重新打开原视频，选择框仍在你离开时的位置。**Cancel**（取消）不做任何更改。

## 图像、ControlNet 与面部修复
<!-- en: images-controlnet-and-face-fix ff9d26565cb7 -->

将 Generate 下拉菜单设为 **🖼 Image**，并选择一种图像风格（FLUX.2
Klein、SDXL、Z-Image、Qwen-Image…；可在 **Settings → Image** 中管理）。在 Basic Settings 中：

- **ControlNet**（2.593.0：附加组件——在 Settings ▸ General 中开启）——先渲染第一张图片，将其转换为控制图（线稿、深度、姿势…），再用**第二个模型**（例如写实风格的 SDXL 或 Klein）渲染最终图片，并使用其独立的提示词、强度和结束点。*Final image only*（仅最终图片）会隐藏中间图片。
- **Face fix**（面部修复，2.593.0：附加组件——在 Settings ▸ General 中开启）——FaceDetailer 会重新绘制最终图片中的每张脸。
- **Image editor**（图像编辑器）面板用 AI 编辑图片；参见下一节。
- **Qwen Image 2.1 读取参考面板**（2.340.0）。使用 **qwen2_1**
  （最多 10 张图片）或 **Qwen Image 2.1 edit**（8 张）时，Generate Image 会按顺序把面板中的图片以 `<image1>`、`<image2>`、… 发送。
  - 在提示词中写 `<image2>` 等即可指代它们。面板自己的
    `<Picture n>` 标签会自动为你转换。
  - 如果提示词中一个都没有提到，会根据每张图片的 Type 添加一行，说明各图片是什么（例如 "<image1> is the person, <image2> is the clothing"）。
  - 参考面板为空时，**qwen2_1** 仅根据文本进行渲染。

## 图像编辑器（含 ✨ AI）
<!-- en: the-image-editor-with-ai acf50a2072aa -->

从 2.389.0 起，编辑器拥有菜单栏、选项栏、工具栏和面板（布局与 PhotoCraft 相同）。点击底部栏中的 **Editor** 即可打开。将图片拖放到编辑器上（来自图库、素材、参考图或文件）——2.549.0：如果已经打开了一张图片，会询问 **▦ Add as a layer**（添加为图层）还是 **🗋 Open as a new document**（作为新文档打开）（Enter = 图层，Esc = 都不选，拖放时按住 Shift = 直接添加为图层）——也可以使用 **File ▸ Open**（Ctrl+O）或 **File ▸ New**（Ctrl+N）。**⛶** 或 **F** 让编辑器占满整个屏幕。**Tab** 显示或隐藏面板；**Shift+Tab** 只隐藏面板组。

**路径文字、变形文字和 3D 文字（2.397.0）**

**T** 按钮现在包含三个工具；**Shift+T** 在它们之间切换：

- **Horizontal Type**（横排文字），与以前相同。
- **Vertical Type**（直排文字）：字母一个接一个向下排列。每一新行是右侧的新一列。
- **Type on a Path**（路径文字）：在图片上拖出一条线，或点击若干点后双击（或按 **Enter**）完成，然后输入文字。字母会沿着这条线排列。使用此工具时，拖动路径上的点可以改变路径形状。**Start** 让文字沿路径移动，**⇅ Flip** 把文字放到路径的另一侧。**Esc** 取消正在绘制的路径。

Type 选项栏新增四个按钮：**TT**（全部大写）、**U**（下划线）、**S**（删除线）和 **↕T**（竖排）。

**⌒ Shape / 3D…**（位于选项栏、文字图层的 Properties 中，或 **Layer ▸ Text Shape**）可实时改变文字图层：

- **Warp**（变形）：Arc、Arc Lower、Arc Upper、Arch、Bulge、Flag、Wave、Fish、Rise、Squeeze 或 Inflate，Bend 范围为 −100 到 100。
- **Round a circle**（环绕圆形）：文字排列在圆上。可设置半径、文字的居中位置，以及文字是绕过顶部，还是沿底部从左向右阅读。
- **Along a drawn path**（沿绘制的路径）：用于以 Type on a Path 制作的文字。
- **3D**：字母向后挤出。可设置深度、方向、向后的明暗过渡以及侧面颜色（默认为文字本身颜色的较暗版本，除非你另选一种）。添加 **Bevel & Emboss**（见下文）可使正面变得圆润。

文字始终保持可编辑：用 Type 工具点击它即可修改文字内容。**Cancel** 将其恢复原状。

**图层样式：Bevel & Emboss、Satin、Pattern Overlay、混合模式、Styles（2.397.0）**

Layer Style 对话框（**fx**，或 **Layer ▸ Layer Style**）现在列出十种图层样式：

- **Bevel & Emboss**（斜面和浮雕）：Inner Bevel、Outer Bevel、Emboss 或 Pillow Emboss。可设置深度、方向（上或下）、大小、软化、光源的角度和高度，以及高光和阴影的颜色与不透明度。
- **Satin**（光泽）：形状内部的丝缎般光泽。
- **Pattern Overlay**（图案叠加）：十种图案（棋盘格、条纹、斜条纹、波点、网格、砖块、波浪、碳纤维、噪点、半调网点），使用你选择的两种颜色，并可设置缩放。
- **Color、Gradient 和 Pattern Overlay** 各自都有 **blend mode**（混合模式）（Multiply、Screen、Overlay、Soft Light 以及另外十二种）。
- **Gradient Overlay** 有五种样式（线性、径向、角度、对称、菱形），另有反向和缩放。它与图层自身的内容对齐，而不是与整张图片对齐。
- 对话框顶部的 **Styles** 提供一键外观：Gold、Chrome、Neon、Embossed、Glass、3D Pop、Retro、Fire、Ice 和 Letterpress。每一种都会替换该图层原有的样式。之后你可以修改任何设置。

Bevel & Emboss 和 Satin 可以保存到 PSD 文件并从中读取。PSD 中的图案叠加目前仍会被忽略。

**新滤镜（2.397.0）**

- **Filter ▸ Render ▸ Lens Flare**：四种镜头类型（50-300mm Zoom、35mm Prime、105mm Prime、Movie Prime）、亮度和色调。**对话框打开时点击图片即可放置光晕。** 在空图层上，它会自行生成光源。
- **Filter ▸ Distort ▸ Swirl**：围绕中心的旋涡。可设置强度、半径和衰减，点击图片放置中心点。
- **Filter ▸ Stylize ▸ Drop Shadow**：由图层像素投射的阴影，可设置角度、距离、模糊、扩展、不透明度和颜色。像素周围需要有透明区域，例如文字或抠出的图像。
- **Filter ▸ Stylize ▸ 3D Extrude**：按深度、方向和明暗挤出任意图层的像素。侧面为较暗的副本或纯色。
- 点击图片也可以为 **Radial Blur** 放置中心点。

**颜色、New、Paint Bucket 和渐变填充（2.396.0）**

- **File ▸ New** 会用**背景色**（工具栏中靠后的那个色块）填充新图片，除非你选择 White、Black 或 Transparent。选项旁边会显示该颜色。
- **⇄ swap (X)** 交换前景色和背景色。如果图片的 **Background** 图层仍是单一纯色，它会被重新涂成新的背景色。这算作一步，所以 **Ctrl+Z** 可以恢复原来的颜色。已在上面绘画过的 Background 图层不受影响。Color 面板也有一个 **⇄** 按钮，**◩ (D)** 设为黑 / 白。
- 色块变得更大并带有描边，因此深色在深色主题下也清晰可见。
- **Paint Bucket** 在 Gradient 工具下方有自己的按钮。**G** 选择你上次使用的那个，**Shift+G** 在两者之间切换。其选项栏：
  - **Fill**：Foreground、Background 或 **Gradient**。
  - 选择 Gradient 时，点击一下会从上到下填充该区域。拖动可自定义方向。它使用 Gradient 工具的颜色和形状（线性、径向……），并且只填充所点击的区域。
  - **Tolerance**、**Contiguous**（关闭 = 填充图片中所有匹配的像素）、**All layers**（在所有可见内容中查找区域）和 **Opacity**。
  - 在选区内点击会填充选区。Alt+点击用于取色。

**看起来就像 bitGen（2.393.0）**

- 编辑器使用 **bitGen** 主题：应用的深色配色和橙色强调色。其菜单栏的高度和颜色与 bitGen 的菜单栏相同。其状态行的高度和颜色与 bitGen 的状态栏相同。
- **Full screen**（全屏，⛶ 或 F）会保留编辑器周围的 bitGen 界面。bitGen 的标题栏、菜单栏和状态栏保持原位；编辑器填满它们之间的空间。编辑器的状态行移入 bitGen 的状态栏（"Editor · …"）。再次按 **Esc**、**F** 或 **⛶** 可将编辑器放回所在面板。
- **Window ▸ Theme** 仍然提供 Pro（深色）、Studio（浅色）和 Classic。

**布局**

- **菜单栏**包含 File、Edit、Image、Layer、Select、Filter、View、Window 和 Help。每一项都有其常用快捷键。
- **Ctrl+K** 打开命令面板：输入命令的一部分并按 Enter。
- **Help ▸ Keyboard Shortcuts** 列出所有按键。
- 菜单下方的**选项栏**显示当前工具的设置。
- **工具栏**包含常见的工具组和按键：
  - 选择与移动：Move (V)、Marquee (M)、Lasso (L)、Magic Wand 和快速选择画笔 (W)、Crop (C)、Eyedropper (I)；
  - 修饰与绘画：Spot Healing 和 Healing Brush (J)、Brush 和 Pencil (B)、Clone Stamp (S)、History Brush (Y)、Eraser (E)、Gradient 和 Paint Bucket (G)、Blur、Sharpen 和 Smudge (R)、Dodge、Burn 和 Sponge (O)；
  - 文字与形状：Type (T)、Shape (U)；
  - 视图：Hand (H)、Zoom (Z)。
- 工具上的小三角表示该工具组中还有更多工具。按住 Shift 再按该工具的按键可循环切换，或右键点击、长按按钮来选择其中一个。
- 工具栏底部：D 设为默认颜色，X 交换颜色，Q (◘) 开启或关闭 Quick Mask。
- **P 在这里不是工具。** P 在任何地方都用于显示和隐藏提示词面板。
- 右侧的**面板**分为三组：
  - **Color** 和 **Swatches**；
  - **Properties**、**Adjustments**、**✨ AI** 和 **◈ Control**；
  - **Layers** 和 **History**。
- **Window ▸ Theme** 用于选择 Pro（深色）、Studio（浅色）或 Classic。
- **View** 中可开启 Rulers（标尺，Ctrl+R）和 Grid（网格，Ctrl+'）。

**图层**

- **图层类型**：
  - 像素图层；
  - **调整图层**（Adjustments 面板，或 Layer ▸ New Adjustment Layer）。它们会改变下方的所有内容，而不触碰任何像素。共有 14 种：Brightness/Contrast、Levels、Curves、Exposure、Vibrance、Hue/Saturation、Color Balance、Black & White、Photo Filter、Channel Mixer、Gradient Map、Invert、Posterize 和 Threshold。其设置在 Properties 中实时生效。
  - **填充图层**（纯色或渐变）；
  - **文字图层**（T：点击并输入；Esc 或 Ctrl+Enter 确认；再次点击文字即可编辑）；
  - **形状图层**（U：矩形、圆角矩形、椭圆、三角形、多边形、直线），始终保持可编辑；
  - **组**（Ctrl+G 将活动图层编组；Shift+Ctrl+G 取消编组；2.549.0：在 Layers 面板中点击后也可以立即使用这些按键）。混合模式设为 *Pass Through* 的组，其中的调整图层会作用到组下方的图层。其他任何混合模式都会让该组单独合成。2.547.0：在 Layers 面板中**选取多个图层**（Ctrl+点击 / Shift+点击）时，**Ctrl+G** 会将它们按原有顺序全部放入一个新组；选中**一个组**时，**Ctrl+G** 会取消该编组。选取多个图层时，**🗑** 按钮、Layer ▸ Delete Layer 和 Shift+Del 会将它们全部删除（一次 Ctrl+Z 即可全部恢复）。
- **图层蒙版**（◫，或 Layer ▸ Layer Mask）在白色处显示、在黑色处隐藏：
  - 点击蒙版缩略图即可在其上绘画；
  - Alt+点击可查看蒙版本身；
  - Shift+点击可停用蒙版；
  - Ctrl+点击可将其载入为选区。
  - Properties 可设置其密度和羽化，并可反相、应用或删除蒙版。
- **剪贴**（Alt+Ctrl+G）让图层只在其下方图层有像素的地方显示。
- **图层样式**（fx，或双击缩略图）：Drop Shadow、Inner Shadow、Outer Glow、Inner Glow、Stroke（外部、内部或居中）、Colour Overlay 和 Gradient Overlay。它们可以复制和粘贴。
- **填充不透明度**使像素变淡，但不影响其样式。
- **锁定**：透明像素、图像像素、位置、全部。
- **右键点击图层**可设置颜色标签等。
- 在面板中**拖动图层**可重新排序，或将图层拖放到组上以放入组内。
- **排列**：Ctrl+[ 和 Ctrl+] 将图层下移和上移；加上 Shift 则移到最底层和最顶层。
- **合并**：Merge Down (Ctrl+E)、Merge Visible、Flatten Image、Rasterize。
- **历史记录**：History 面板列出每一步（最近 80 步）。点击某一步即可后退或前进到该步。

**先建立选区。其他一切操作都遵循选区。**

- **组合**：Shift 添加，Alt 减去，Shift+Alt 交叉（或使用选项栏中的按钮）。选项栏的 **Feather** 会柔化下一次建立的选区。
- **Select 菜单**：
  - All (Ctrl+A)、Deselect (Ctrl+D)、Reselect、Inverse (Shift+Ctrl+I)；
  - **Color Range**；
  - **Modify**：Border、Smooth、Expand、Contract、Feather (Shift+F6)；
  - 将图层的透明度或其蒙版载入为选区。
- **Quick Mask (Q)**：选区之外的区域显示为红色。画笔添加到选区，橡皮擦从选区中移除。再次按 Q 即可将其转回选区。


**绘画与修饰**

- **Brush (B)** 使用 20 种预设之一（▾）。按键 1…0 设置不透明度。Alt+点击或 Ctrl+点击可取色。数位板的压感控制大小和/或流量。
- **Pencil**：硬边。
- **Clone Stamp (S)**：Alt+点击设置源，然后绘画。可选择是否对齐，以及仅当前图层或所有图层。
- **Healing Brush**：同上，但颜色会与所绘制的位置相匹配。
- **Spot Healing (J)**：在斑点上涂抹，它会用周围的内容填充。
- **History Brush (Y)**：将图层绘制回打开时的状态。使用 ⟲ Set source 更改该参照点。
- **Dodge、Burn、Sponge (O)**：色调范围和曝光度。
- **Blur、Sharpen、Smudge (R)**：强度。
- **Gradient (G)**：线性、径向、角度、对称或菱形。颜色可以是前景色到背景色、前景色到透明、黑白，或光谱。
- **Paint Bucket (Shift+G)**：填充颜色相近的区域。
- **Crop (C)**：拖出一个框，选择比例，Enter 裁剪（Esc 取消）。
- **Free Transform**（Ctrl+T，或 Move 工具选项栏上的 **⤡ Transform**）：在框内拖动以移动。拖动角点会等比缩放；Shift+拖动角点可自由缩放。在框外拖动可旋转（按住 Shift 以 15° 为步进）。2.551.0：**拖动中间控制点可斜切**（光标变为倾斜箭头；上 / 下 = 横向，左 / 右 = 纵向）；**Shift 或 Alt + 中间控制点**拉伸该边。你也可以在选项栏中输入 X、Y、W、H、角度和两个斜切值（⇋ ⇵）。按 Enter 应用。如果选区中不包含该图层的任何像素，则变换整个图层。
- **Move (V)** 与 **Paste**（2.550.0）：Ctrl+V 将图片作为新图层放在中央，并取消选区（选区原本位于复制的区域上，导致 Move 工具移动的是新图层的空白部分）。Move 工具移动选中的像素；没有选区时——或者选区中不包含该图层的任何像素时——则移动整个图层。
- **Edit ▸ Transform** 用于旋转或翻转图层。
- **Image**：
  - Adjustments（全部 18 种，直接作用于像素）；
  - Auto Tone、Auto Contrast 和 Auto Color；
  - Image Size 和 Canvas Size（带锚点）；
  - Image Rotation；
  - 裁剪到选区；
  - Trim。
- **Filter**：Blur、Distort、Noise、Pixelate、Render、Sharpen 和 Stylize 子菜单，共 23 种滤镜。每种都可实时预览。Ctrl+F 重复上一次的滤镜。
- 选中蒙版缩略图时，绘画、滤镜和填充会作用于蒙版；在 Quick Mask 中则作用于选区。

**保存**

- **File ▸ Save to Images**（Ctrl+S）将可见图片保存到项目的 Images 中。
- **File ▸ Export As** 可选择 PNG、JPEG 或 WebP、质量和缩放比例。它会显示预览和文件大小，并可保存到 Images 或下载。
- 复制和粘贴使用 Ctrl+C、Ctrl+X 和 Ctrl+V。Paste in Place（原位粘贴）为 Shift+Ctrl+V，Copy Merged（合并复制）为 Shift+Ctrl+C。也可以粘贴来自系统剪贴板的图片。

**✨ AI** 的工作方式与 Krita AI Diffusion 相同。模型看到的是选区加上其周围的 **context**（上下文）边距，并缩放到不超过 **MP** 预算。结果以**新图层**的形式返回，新像素只位于**羽化后**的选区内。

- **Generate** 根据提示词重新生成选区，使用修复（inpaint）风格（FLUX Fill inpaint、SDXL……）。
- **Refine** 以低于 100 % 的**强度**（strength）重新处理：形状保留，细节改变。
- **Remove** 移除所选内容并延续周围的画面。提示词可选。
- **Edit** 使用编辑模型执行指令：**Qwen Image Edit 2511**、**FLUX.1 Kontext** 或 FLUX.2 Klein edit（"make her jacket red"、"remove the glasses"）。没有选区时，它编辑整张图片。
- **Background** 保留选区，重新生成其余所有内容。
- **Results** 生成 1–4 个版本。点击其中一个进行比较，然后用 **✔ Apply**（Enter）将其保留为图层，或用 **✕ Discard**（Esc）放弃。
- **⤢ Expand** 在一侧或所有侧扩展画布，并选中新增的条带区域。随后 Generate 会将图片延续到其中。

如果面板中的提示词框为空，则使用主提示词。这些模型在安装设置（setup）的 *Image editing* 下下载。

**◈ Control layers** 的工作方式与 Krita AI Diffusion 的相同。控制图层通过 ControlNet 引导 Generate、Refine、Remove 和 Background。它永远不属于图片本身：保存和 AI 都会跳过它。

- 选择一种类型并按 **＋ layer**。类型包括 scribble、line art、soft edge、canny、depth、normal map、pose 和 segmentation。
- 对于线条类型，用画笔在图层上画深色线条。
- 或者按 **⟲ From image**，让该类型的预处理器根据图片生成图层。之后你可以用画笔或橡皮擦进行修饰。
- **◈ active** 将你当前所在的图层变为控制图层。
- 每个控制图层都有**强度**（strength）、**start / end** 范围（它在采样过程中起引导作用的阶段），以及来自 ComfyUI 的 `models/controlnet` 的 **ControlNet model**。*auto* 会选择名称中包含该类型的模型，否则选择 union / ProMax 模型。
- 最多可同时使用四个。取消勾选某个，即可在下一次运行中排除它。
- 编辑模型直接使用图片本身，因此执行 Edit 时不会发送控制图层。
- From image 需要 *comfyui_controlnet_aux* 节点包。Canny 使用 ComfyUI 自带的节点。

**🎚 Adjust 和 ✦ Filter** 是作用于活动图层的菜单；有选区时只作用于选区内部（按其柔和边缘混合）。

- **Adjust**：Brightness/Contrast、Hue/Saturation、Levels、Color Balance、Exposure、Vibrance、Black & White、Sepia、Invert、Posterize、Threshold 和 Auto Contrast。
- **Filter**：Gaussian Blur、Motion Blur、Unsharp Mask、Add Noise、Median、Pixelate、Emboss、Find Edges、Vignette、Glow、Chromatic Aberration 和 Oil Paint。
- 对话框实时预览。**OK** 使更改成为一个撤销步骤，**Ctrl+F** 重复上一次的滤镜。

### Segment Anything、Compose、参考图和 PSD（2.390.0）

**Segment Anything** 帮你找出物体的轮廓。它在本机上运行。首次使用时，打开 **Select ▸ Segment Anything Settings…** 并按 **⬇ Install**。它只下载一次模型，之后即可离线工作。SAM ViT-B 模型为 375 MB；ViT-H 较慢，但边缘效果更好。如果 ComfyUI 的 `models/sams` 中已有 SAM 模型，则直接使用该模型。

- **Object Selection Tool (W)**：点击某个物体即可选中它。**Shift**+点击添加另一个物体；**Alt**+点击移除一个。在某物周围拖出一个框，即可选中框内的内容。
- **Find**：在该工具的选项栏中输入文字，例如 *the person's head* 或 *dog, car*。**🎯 Select** 选中它们；**◐ Mask** 将它们设为活动图层的蒙版。
- **Select ▸ Subject…** 通过对话框完成同样的操作。它还可以把每个匹配项放到单独的图层上。
- **Layer ▸ Segment Layer…** 将图层拆分为各个部分，每个部分位于组内的单独图层上。勾选 **cut out of the layer** 可将它们从原图层中移除。填写 **Only** 则只保留你指定名称的物体。
- 在 **✨ AI** 面板中，**🎯 Select from prompt** 和 **◐ Mask from prompt** 使用提示词框中的文字。

**✨ Compose（将图层作为参考图）**

1. 在 Layers 面板中 **Ctrl**+点击你需要的图层。顺序很重要：**1** 是场景，**2** 和 **3** 是要放入的物体。每个选取的图层都会显示其编号。
2. 在 **✨ AI** 中选择 **Compose** 和一个 Edit 模型（默认为 Qwen Image Edit 2511）。
3. 写下要生成的内容，例如 *put the dog from Layer 2 on the sofa in Layer 1*。文字中的图层名称会以 Picture 1、2、3 的形式传给模型。
4. 按 **✨ Compose**。**✔ Apply** 将结果保留为新图层。

**→ References**：**Layer ▸ Send to References**（或 **→ References** 按钮）将选取的图层放入参考图面板。随后提示词面板中的 **Generate** 会使用它们，生成视频时也同样适用。

**绘制蒙版时查看蒙版（2.391.0）**

当画笔在图层蒙版上绘画时，蒙版隐藏的区域会在你绘制时变红。笔触结束后红色消失。**View ▸ Mask Overlay**（**\**）在蒙版被选中期间始终显示红色。

**PSD 文件**

- **File ▸ Open PSD…** 打开 PSD，也可以直接将 PSD 拖放到编辑器上。
- **File ▸ Save as PSD…**（Shift+Ctrl+S）保存 PSD。它保存在项目的 `psd` 文件夹中，也可以下载。**File ▸ Open PSD from Project…** 可再次打开它。
- 以下内容会被保留：图层、组、蒙版、不透明度、混合模式、可见性和图层样式。
- 文字图层和智能对象以像素形式打开。
- 调整图层会被忽略（编辑器会说明数量）。保存的 PSD 仍会显示最终画面。
- 矢量蒙版和路径形状图层在读写两个方向上都以路径形式保留（2.421.0）——见下文。


### 钢笔、路径、矢量蒙版和自定义形状（2.421.0）

专业编辑功能的第一部分。

**工具。** **P**（Shift+P 循环切换）——**Pen**：点击 = 角点锚点，拖动 = 平滑锚点（其控制柄对称），点击第一个锚点 = 闭合，Alt = 尖角点（一个控制柄），Shift = 以 45° 为步进，Ctrl = 临时切换为 Direct Selection，Enter / Esc 保持路径开放。在选取的路径上，Pen 在线段上点击会添加锚点，在锚点上点击会删除锚点（**Auto Add/Delete**）。**Freeform Pen** 手绘并拟合为贝塞尔曲线（**Curve Fit** px）。**Add / Delete Anchor Point** 和 **Convert Point**（点击：曲线 ⇄ 角点；拖动锚点：生成新控制柄；拖动控制柄：变为尖角点）。**A**——**Path Selection**（整个组件：拖动移动，Alt+拖动复制，Delete 删除，组件的运算方式，⧉ **Merge Components**，⟳ **Transform…**）和 **Direct Selection**（锚点和控制柄，Shift 添加，框选可选取多个，方向键微移，Delete 删除，Corner / Smooth）。**U**——Shape 工具和新增的 **Custom Shape** 工具（心形、星形、爆炸形、箭头、V 形、加号、叉号、对勾、闪电、对话气泡、水滴、月亮、房子、云、圆环、边框——以及你自己的形状：**Edit ▸ Define Custom Shape…** 保存所选取的路径）。

**Shape 还是 Path。** 选项栏的 **Mode**：*Shape* 绘制形状图层（前景色填充，背景色 + W 描边），*Path* 绘制 **Work Path**。运算按钮：▣ New Layer、⊕ Combine、⊖ Subtract Front Shape、⊗ Intersect、⊘ Exclude——除 New Layer 外，其他按钮都会把新部分添加到活动形状图层中。普通 Shape 工具（矩形、椭圆……）也有相同的按钮。只要移动形状图层的任一锚点，它就会变为可编辑路径。

**Paths 面板**（位于 Layers 和 History 旁边）：Work Path、你保存的路径，以及活动图层的 Shape Path / Vector Mask。点击其中之一即可选取（使用路径工具时会显示其锚点）；**Ctrl+点击** = 将其载入为选区（Shift 添加，Alt 减去）。双击 Work Path 可保存它，双击已保存的路径可重命名。按钮：● 用前景色填充，○ 用画笔描边，⬚ 作为选区载入，⟲ 从选区生成工作路径，◇ 由其生成矢量蒙版，＋ 新建，⧉ 复制，☰ 更多，🗑 删除（Alt+点击 ●、○、⬚、⟲ 可打开其选项：不透明度 / 羽化，画笔 / 铅笔 / 橡皮擦 + 模拟压感，羽化 + 添加 / 减去，容差）。

**矢量蒙版。** **Layer ▸ Vector Mask: Reveal All / Hide All / Current Path / Disable / Rasterize / Delete**。矢量蒙版在路径内部显示其图层（Reveal All：除你在其中绘制的形状外，其他地方都显示）。其缩略图位于图层蒙版缩略图旁边：点击它可编辑路径，Shift+点击将其关闭。Properties 中有其 Density、Feather、Invert、Link 和 Rasterize（栅格化为像素蒙版）。链接的矢量蒙版会随图层一起移动。

**一切都跟随图片**：裁剪、画布大小、图像大小、旋转和扩展都会移动 / 缩放路径。每次编辑都是一个撤销步骤。

**SVG 和 PSD。** **File ▸ Export Path as SVG…**、**File ▸ Place SVG as Shape Layer…**（以及 ☰ ▸ Import SVG as Path…）。PSD 在读写两个方向上都保留矢量蒙版和路径形状图层（PSD 矢量形状图层：路径、填充、描边）。

### 智能对象、智能滤镜和变换（2.422.0）

**智能对象。** **Layer ▸ Smart Objects: Convert to Smart Object**（或 **Filter ▸ Convert for Smart Filters**）将活动图层——像素、文字、形状或填充图层，或整个组——转换为智能对象（其缩略图上显示 ▣）。原来的图层进入其内部，仍可编辑；智能对象显示它们的外观。它始终根据其内容重新绘制，因此你可以将其缩小再放大、旋转、变形，而不会有任何损失。

- **Edit Contents**（双击缩略图）：内部内容在编辑器中打开，并显示一条横幅——可修改任何内容（文字仍是文字），**✔ Done** 将其放回智能对象及其所有副本，**✕ Cancel** 放弃修改。智能对象中的智能对象也以同样方式打开。
- **Duplicate Layer** 共享内容（编辑一个，所有副本都会改变）；**New Smart Object via Copy** 创建一个独立的智能对象。
- **Replace Contents…**（一个图片文件；保持位置和大小）、**Export Contents…**（PNG）、**Convert to Layers**（将内部内容恢复为一个组——保持其自身大小，不旋转）、**Rasterize**（普通像素）。
- Properties 显示其大小、是否已变形、有多少副本共享它，以及上述所有操作的按钮。

**智能滤镜。** 对智能对象使用任何 **Filter** 或 **Image ▸ Adjustments** 项（以及 Ctrl+F、Auto Tone……）时，它会作为智能滤镜被**添加**，而不会改变像素。滤镜列在图层下方：👁 关闭某个滤镜，双击重新打开其设置，右键点击设置其不透明度，▲ 将其在顺序中后移，✕ 删除它。一个**滤镜蒙版**（其缩略图位于 Smart Filters 行上）限制所有滤镜：点击它并绘画——黑色在该处隐藏滤镜效果，白色则显示；Shift+点击将其关闭。

**变换。** **Edit ▸ Transform: Skew / Distort / Perspective / Warp**（以及在智能对象上按 **Ctrl+T**）。选项栏可在以下模式间切换：Free（移动、缩放——Shift 保持比例——在框外旋转——Shift = 以 15° 为步进）、Skew（角点沿其所在边移动，边可滑动）、Distort（角点可任意移动）、Perspective（一个角点与其对应角点镜像移动）和 Warp（4 × 4 网格：拖动其点，或在内部任意位置拖动使其在该处弯曲；预设 Arc、Arc Lower / Upper、Arch、Bulge、Flag、Wave、Fish、Rise、Inflate、Squeeze，带 Bend %）。Enter 应用，Esc 取消。像素图层（或其上的选区）会重新绘制一次；智能对象则保留变换。

**Puppet Warp**（Edit ▸ Puppet Warp）：点击在图层内容上放置图钉（三个或更多可保持其形状），拖动图钉进行弯曲——图钉之间的所有内容都会自然跟随；Alt+点击或 Delete 移除图钉；选项栏中有 Density 和 Show Mesh。在智能对象上，它是一个智能滤镜。

**Content-Aware Scale**（Edit ▸ Content-Aware Scale…，Alt+Shift+Ctrl+C）：通过去除（或加倍）最不重要的像素行，使图层内容变窄 / 变宽 / 变矮 / 变高——人脸、物体和边缘保持原有形状。**Protect: the selection** 让你选中的内容完全保持原样。对话框会显示一个小型实时预览。

**Liquify**（Filter ▸ Liquify…，Shift+Ctrl+X）打开它自己的窗口：**W** Forward Warp（拖动推移），**R** Reconstruct（涂抹以恢复更改），**C** Twirl（Alt = 反方向），**S** Pucker，**B** Bloat，**F** Freeze Mask（红色 = 该处不会移动），**D** Thaw Mask；Size（[ 和 ]）、Pressure、Restore All。OK 应用（Enter），Cancel 取消（Esc）。在智能对象上，它是一个智能滤镜——双击即可继续编辑。

### 选区：Select and Mask、Magnetic Lasso、Quick Selection、Sky、Channels（2.423.0）

**Select and Mask**（Select ▸ Select and Mask…，Alt+Ctrl+R）打开一个独立的工作区。用 **Quick Selection**（W——会扩展到边缘；Alt 减去）、**Refine Edge**（R——在头发或毛发上涂抹：会在该处搜索边缘）和 **Brush**（B——手动）进行绘制；顶部有 ☁ Sky 和 ⇄ Invert。右侧：**View**（Overlay red、On Black、On White、Black & White、On Layers）及其不透明度；**Edge Detection**：Radius（寻找真实边缘的带状范围——粗略的选区会吸附到图片的边缘上）和 Smart Radius；**Global Refinements**：Smooth、Feather、Contrast、Shift Edge；**Output**：Decontaminate Colors（从边缘去除旧背景留下的彩色杂边）以及 Output To：Selection、Layer Mask、New Layer、New Layer with Layer Mask。Enter = OK，Esc = Cancel。

- **Magnetic Lasso**（L，Shift+L 循环切换）：点击，然后沿边缘移动——线条会吸附到边缘上，每隔 Frequency px 落下一个点（点击可手动设置一个点，Backspace 撤回上一个点）；双击、按 Enter 或点击第一个点即可闭合。选项栏中有 Width、Contrast、Frequency。
- **Quick Selection**（W）：涂抹——选区会扩展到画笔下方的边缘；第一笔创建新选区，之后的笔触为添加，Alt 减去。Tolerance；Auto-Enhance 在每一笔之后平滑边缘。
- **Select ▸ Sky**：选中延伸到顶部边缘的天空（蓝天、阴天或日落），沿天际线边缘柔和。
- **Channels**（位于 Layers / Paths 旁边的标签页）：RGB、Red、Green、Blue——点击某一个可单独查看（Ctrl+2 … Ctrl+5），Ctrl+点击将其亮度载入为选区。**Alpha 通道**是保存的选区：**Select ▸ Save Selection…**（新建，或存入某个通道：替换 / 添加 / 减去 / 交叉）、**Select ▸ Load Selection…**（反相、运算方式）；点击某个通道可查看，Ctrl+点击载入，双击重命名。它们可以撤销，并跟随裁剪 / 图像大小 / 旋转。


### 修饰：Patch、Content-Aware Move 和 Fill、Red Eye、Mixer Brush、橡皮擦、修复（2.423.0）

以下工具都不使用 AI——图片由自身内容填充（PatchMatch）并融合（Poisson），全部在页面内完成。

- **Spot Healing Brush**（J）：Type 选择 **Content-Aware**（用周围内容填充）或 Proximity Match（旧方式）。
- **Healing Brush**（J）：Alt+点击设置源，然后涂抹——复制的内容现在会采用落点处的颜色和光照（只有纹理来自源）。
- **Patch**（J）：圈出要修复的区域（或选中它），然后将其拖到干净的纹理上：它会采用该纹理并融合（Patch: Source）。Destination 则反向操作。
- **Content-Aware Move**（J）：选中一个物体并拖动——它会移动，原位置由周围内容填充（Mode: Move），或者被复制（Extend）。
- **Red Eye**（J）：点击红色瞳孔；Pupil Size、Darken Amount。
- **Edit ▸ Content-Aware Fill…** 以及 **Edit ▸ Fill…** 中的 Content-Aware：用图片其余部分填充选区，结果放在当前图层或新图层上。
- **Mixer Brush**（B）：颜料在绘制过程中会沾取画布的颜色——Wet、Load、Mix，每笔之后 Clean。
- **Background Eraser**（E）：擦除与画笔中心下方颜色相近的内容（Continuous / Once、Tolerance、Protect Foreground Color）。
- **Magic Eraser**（E）：点击一下即可擦除该颜色的区域（Tolerance、Contiguous）。

### Gradient Editor、Layer Comps、智能滤镜混合模式（2.434.0）

- **Gradient Editor**（Edit ▸ Gradient Editor…、Gradient 工具的渐变按钮、Gradient 填充图层的 Properties、矢量形状的 Object Properties）：12 种预设（Foreground to Background、Foreground to Transparent、Black / White、Spectrum、Transparent Rainbow、Chrome、Copper、Gold、Sunset、Violet / Orange、Blue / Red / Yellow、Transparent Stripes）+ 你自己的预设（**New** 保存一个；右键点击将其删除）。渐变条：**在其下方点击 = 新色标**（取该处颜色），**拖动色标** = 移动，**将其向下拖离渐变条 = 删除**（至少保留两个）。选取的色标：**Colour**（或 "foreground" / "background"——跟随色块变化）、**Opacity**、**Location**；Delete、⇄ Reverse、Distribute evenly。之后 Gradient 工具 / Paint Bucket 使用 Colours：**Custom**；填充图层或形状会保留色标（形状的 SVG 也会保留）。
- **Layer Comps**（Window ▸ Layer Comps，History / Actions 旁边的 Comps 标签页）：**＋** 保存图层的状态——名称、应用的内容（Visibility、Position、Appearance = Layer Style / 不透明度 / 混合模式）和注释；在某个图层复合上点击 **▶** 即可应用（一个撤销步骤），**◀ ▶** 切换上一个 / 下一个，**↻** 用当前图层状态更新选取的图层复合，🗑 删除；双击 = 打开其选项。**Last Document State** 恢复之前的图层状态。每个文档保留各自的图层复合。
- **智能滤镜混合模式**：右键点击智能滤镜（位于 Layers 中智能对象下方）= **Blending Options**：Mode（24 种：Normal、Dissolve、Darken、Multiply、Color Burn、Linear Burn、Lighten、Screen、Color Dodge、Linear Dodge、Overlay、Soft / Hard / Vivid / Linear / Pin Light、Difference、Exclusion、Subtract、Divide、Hue、Saturation、Color、Luminosity）+ Opacity；该行会显示所用的模式。

### 图像编辑器与提示词面板：Image 模式，生成的图片放到画布上（2.431.0）

2.549.0：**在图像编辑模式下，Generate 始终生成一个新图层**。没有选区时，提示词面板自身的 Generate 会使用在那里选择的风格（Krea 2……）运行，图片作为新图层进入；有选区时，编辑器会填充选区，结果同样是新图层。它不再直接绘制到所选图层中。

2.550.0：**选区会被无缝填充**，与 Krita AI 插件的做法相同：提示词面板的风格（Krea 2、FLUX.2 / FLUX 3 Klein 风格、Qwen……）运行它自己的节点图，对选区周围的图片进行编码，并在选区上加噪声蒙版（再加上差分扩散以获得柔和边缘），因此新部分会延续原有内容，而不是一张新图片。检查点（checkpoint）风格（SDXL……）仍使用 SDXL inpaint 导出；风格自带的修复工作流仍然优先。Refine（一个强度值）的工作方式相同。

2.551.0，更接近 Krita AI 插件：选区周围发送的区域更大（每边至少为选区尺寸的 3/4，宽约 512 px），选区在编码前会**预先填充周围的颜色**，蒙版会被扩展并**模糊**（柔和边缘），而未经修复训练的风格（Krea 2、Klein、Qwen……）会从略低于完全噪声处（0.9）开始，使新部分保持周围的光照和颜色。若要获得最佳填充效果，请使用真正的修复模型——FLUX Fill inpaint，或 SDXL inpaint 导出（Krita 插件同样使用修复模型：SDXL 用 Fooocus inpaint，SD 1.5 用 ControlNet inpaint，以及 Flux Fill）。

2.552.0，源自 Krita AI 插件自身的代码：
- 选区中的 **Generate** 再次以**完全强度**运行（与 Krita 对未经修复训练的模型的做法相同——模型绘制时保留选区周围的图片，因此新部分是画进其中的）。**Remove** 从选区周围的颜色开始，以 0.9 运行。
- 小选区的区域会**以更大尺寸渲染**（至少约 0.75 百万像素，最多 4 倍）再缩放回来——以 1 百万像素训练的模型处理 512 px 的区域时，结果会很模糊。
- 蒙版的柔和边缘**随选区一起增大**：羽化值为选区对角线的 10 %（至少 32 px），并扩展 4 px + 该值的一半，与 Krita 相同。Refine 使用的值较小（乘以其强度）。
- 当模型保留了选区周围的图片时，结果会**稍微越过选区边缘进行融合**（不会有可见的分界线），并与周围图片**进行颜色匹配**（Krita 的 Color Match）。
- 选区内的 **Edit**（Qwen Image Edit、FLUX Kontext、FLUX.2 / FLUX 3 Klein edit）现在**只改变选区**：图片既是模型的参考图，也是它在同一柔和蒙版下的起点，因此选区周围的一切都保持原样。

2.553.0——✨ AI 面板中的 **👁 fill with the edit model (sees the picture)**（用编辑模型填充，能看到图片），默认开启，除非你将其关闭：选区中的 Generate、Remove 和 New background 通过**编辑模型**运行（如果提示词面板的风格能够编辑——FLUX.2 / FLUX 3 Klein、Qwen Image Edit——则使用该风格，否则使用面板的 Edit 模型）。未经填充训练的模型（Krea 2……）看不到选区周围的图片，会在其中画出一张自己的图片；编辑模型会查看整个区域，因此新部分能融入场景。与 Krita AI 插件相同，选区会被涂成**绿色**，并告诉模型 "Fill the green spaces according to the image."，后面跟上你的提示词（Remove："Remove the object."，New background："Replace the background while keeping the main subject."），并且只有选区会改变。真正的修复风格（FLUX Fill inpaint、SDXL inpaint 导出）始终按原样使用。
- 有选区时，**▾ Edit** **只改变选区**（在其上方新建图层）。没有选区时，它编辑所选图层——带有透明部分的图层会保持其轮廓：只有它自己的像素会改变，周围不会添加任何内容。
- 2.554.0：无法看到选区周围的风格（Krea 2……，在 👁 关闭或没有编辑模型时）会把**选区自身的边框范围**作为整张图片（外加少量供柔和边缘使用的空间），以模型的尺寸渲染后再缩放回来——因此它画出的内容与选区的大小和位置一致，而不是将一张更大的图片裁小。


**2.555.0——Krita AI 插件的填充方式，按模型系列区分。** 只要 ComfyUI 中有相应组件，每个系列都会使用 Krita 插件所用的辅助组件——一个*经过训练*专门用于填充的部件：
- **SDXL / Pony**：Fooocus inpaint 补丁（由风格**自己的**检查点进行填充——Pony 仍然是 Pony）。
- **Illustrious / NoobAI**：NoobAI inpainting ControlNet（否则使用 Fooocus 补丁）。
- **SD 1.5**：SD 1.5 inpaint ControlNet。**FLUX.1**：Alimama FLUX inpainting ControlNet。
- **Remove**（任何风格）：先由 MAT / LaMa 移除物体。
- **FLUX.2 / FLUX 3 Klein、Qwen、Krea 2**：没有辅助组件——👁 开启时通过编辑模型填充（与以前相同）。同样与 Krita 一致的还有：模型看到的区域（选区先按其羽化值外扩，再按 max(图片长边 / 16, 选区尺寸的一半) 外扩，至少 512 px），以及 Generate 的 **fill** 行——**Add content**（默认：在该处放入新内容；选区以灰色开始，使用编辑模型时提示为 "Add the object to the scene."）或 **Fill**（图片在该处延续；选区以原有内容的模糊版本开始）。横跨图片一整条边的选区会扩展图片。
**需要安装的内容**（安装向导会列出两者）：节点包 **comfyui-inpaint-nodes**（在安装设置的节点列表中），以及安装设置模型列表中 **Selection fill - the Krita AI way** 组里的：Fooocus inpaint head + patch（models/inpaint）、MAT（models/inpaint），以及你需要的 inpainting ControlNet（models/controlnet）。如果 Krita 插件已经下载了它们，请在 Settings → ComfyUI → Folders 中添加 Krita 的 ComfyUI 模型文件夹，而无需重新下载。

**2.556.0——⏳ Pending：想排多少就排多少。** ✨ Generate、Edit、Refine、Fill、Remove、New background 和 Compose 不再等待上一个完成——再按一次（换一个选区、一个提示词、一个图层），新的渲染就会排在其他渲染后面。每个结果都会进入 **⏳ Pending**，这是一个浮动在图像编辑器*内部*的小面板（拖动其标题即可移动；✕ 隐藏它，✨ AI 面板的 **⏳ Pending** 按钮可再次显示它，每次新的渲染也会让它重新出现）。每张卡片显示叠加在其生成区域上的结果（点击图片可在画布上预览）、它是什么操作，以及它属于哪个图层：
- **✔ Apply** 将其放到新图层上，**位于你发出请求时所选图层的上方**——放在每个图层各自对应的一个组内，组名为 **"✨ changes: <layer>"**，首次使用时创建，之后重复使用（每次 Apply 是一个撤销步骤）。
- **🗑 Delete** 将其丢弃。标题栏中的 **✔ all** / **🗑 all** 作用于所有卡片。

**每种 ✨ 模式中的 References 面板（2.556.0）。** 在提示词中用参考图在面板中的编号来指称它——"picture 1"、"image 2"、"ref 3"——它就会随请求一起发送：
- **Edit**：最多两张图片（↳ 参考图下拉菜单仍与以前一样工作：那张图片是 "Picture 2"）。
- **Generate / Fill / Remove / New background / Refine**：运行会通过**编辑模型**进行（只有编辑模型能接收图片），选区会利用这些图片来填充，编号也会为模型重写（面板中的 "picture 3" 变为模型的 "Picture 2"）。没有编辑模型时，会改为把图片的描述添加到提示词中。
- **Compose**：写 "ref 1" / "reference 2"（在 Compose 中，"picture N" 指第 N 个选取的图层）；该图片会添加在选取的图层之后（总共三张图片）。同时修复：2.552.0-2.555.0 中编辑器的设置（蒙版尺寸、👁 fill with the edit model、Add content / Fill）在发送到服务器的途中被丢弃——现在可以正确送达。

2.557.0：Krita 方式填充所需的文件可从 **Settings ▸ Add-ons ▸ AI fill models** 下载（勾选后点击 ⤓ Download ticked）。

- 当图像编辑器处于**打开**状态（显示在屏幕上，而非折叠）时，提示词面板的 Generate 模式为 **🖼 Image**，旁边有一个 **→ ▦ canvas** 标签，说明图片的去向。编辑器关闭时，会恢复之前的模式（编辑器打开期间选择的模式会被保留）。切换模式的是编辑器的打开 / 关闭；项目保存的是你所选的模式，而不是编辑器的 Image 模式。
- **编辑器打开期间，Generate 生成的每张图片都会落到画布上**：作为最前面文档中的一个新图层，以提示词命名（✨ a red fox …），居中放置——比画布大时会缩小。一次生成多张图片的渲染会为每张图片各建一个图层。没有打开文档 = 第一张图片会作为新文档打开。每个图层是一个撤销步骤；图库照常保留这些图片。编辑器关闭时不会添加任何内容。

### 文档（浮动窗口 / 标签页）、调色板、⊠ 透明、自动填充（2.430.0）

- **每次 New / Open 都会生成一个独立的文档**（File ▸ New、Open、Open PDF、PSD、拖入的图片、在空编辑器中粘贴）。第一个文档停靠——它填满画布区域，上方有一个**标签页**；之后的文档在各自的**浮动窗口**中打开（层叠排列）——即画布区域上方的“模块化面板”。Window ▸ Arrange ▸ Open Documents as Tabs 会让每个新文档改为以标签页打开。
- 每个文档都保留自己的图层、撤销 / 重做（History）、选区、路径、通道、缩放和 PDF 的页面；最前面的文档就是工具、面板和 ✨ AI 所作用的文档。
- **标签页**：点击 = 移到最前；✕ 或鼠标中键点击 = 关闭；● = 有未保存的更改；将标签页拖离标签栏 = 在该处浮动。
- **窗口**：拖动标题栏（拖放到标签栏上 = 作为标签页停靠；双击标题栏也会停靠），⇲ = 停靠，✕ = 关闭，拖动右下角可调整大小。位于后面的窗口显示其离开时的画面——点击即可将其移到最前（画布会移入其中）。
- File ▸ **Close**（Ctrl+W）/ **Close All**（Alt+Ctrl+W）：有未保存的更改时会询问——💾 Save and close / Close without saving / Cancel。Window ▸ Arrange：Consolidate All to Tabs、Float in Window、Float All in Windows、Tile、Cascade、**Next / Previous Document**（Ctrl+Tab / Shift+Ctrl+Tab）。File ▸ Automate ▸ Batch 会在每张图片处理完后将其关闭（你原本打开的文档保持打开）。
- **调色板**：编辑器右边缘的竖条——先是 ⊠，然后是各种颜色；▲ ▼ / 鼠标滚轮可滚动；▾ 选择调色板（Default、Greys、Your Swatches、Document Colours）；Window ▸ Color Palette 显示 / 隐藏它。在曲线、形状或文字上（所有选取的对象——在 Layers 中 Ctrl+点击——或活动对象）：**点击 = 设置其填充，右键点击 = 设置其轮廓**，⊠ = 无——一个撤销步骤。在其他任何对象上：点击 = 前景色，右键点击 = 背景色。
- **⊠ transparent**（透明，位于调色板和 Swatches 面板中）：作为前景色时，画笔绘制透明，Paint Bucket 和 Edit ▸ Fill 会清除像素；该色块以一条红线表示。
- **自动填充**：用 Bézier、Pen（F5）、Freehand、Polyline、3-point curve、B-spline 或 Curvature 工具闭合的曲线、新的 F6 形状、Pen / Shape 工具形状——会立即用**最后选取的颜色**填充（来自调色板、色块、拾色器、吸管）。最后选取的是 ⊠ = 不填充。曲线工具的属性栏：▨ = 自动填充开 / 关（默认开启）。

### 面板：Transform、Shaping、Align and Distribute、Object Properties（2.429.0）

Window ▸ Dockers 会打开它们自己的一个面板组（✕ 关闭）。它们作用于**选取的**图层（在 Layers 中 Ctrl+点击可选取多个）或活动图层。

- **Transform**（Alt+F7）：Position（x / y，Relative position）、Rotate（角度，+ = 逆时针）、Scale & Mirror（%，等比，⇆ ⇅）、Size（w / h，等比）、Skew（x° / y°）——以边框 9 个点中的一个为基准（Relative center），**Copies**（每个副本多走一步——30 px 移动的 2 个副本 = 一排三个）。矢量形状 / 线条 / 路径精确变换（仅移动 / 缩放时，实时（live）形状仍保持实时可编辑），像素图层重新绘制，文字会移动并调整大小。每次 Apply 是一个撤销步骤。
- **Shaping**：Weld、Trim、Intersect、Simplify、Front Minus Back、Back Minus Front、Boundary——作用于选取的矢量形状；活动形状为目标，结果采用其外观；Leave original source / target。
- **Align and Distribute**（Shift+Ctrl+A）：将左 / 中心 / 右 / 顶 / 中间 / 底对齐到活动对象、第一个选取的对象、选区边框、页面边缘或页面中心；按左 / 中心 / 右 / 间距、顶 / 中心 / 底 / 间距分布——在选区或页面范围内。
- **Object Properties**（Alt+Enter）：活动矢量形状的填充（无、均匀、带两种颜色和一个角度的线性 / 径向渐变——在 SVG 中也会保留）、轮廓（宽度、颜色、样式，F12）、透明度（不透明度、混合模式）。


### 绘图工具：形状（F6）、Artistic Media、尺寸标注和连接线（F8）（2.428.0）

它们绘制的所有内容都是矢量线条图层——轮廓笔（F12）、填充、Shape 工具（F10）和 Convert to Curves（Ctrl+Q）对它们都适用。

- **F6**（再按 = 下一个）：**Rectangle**（每个角单独设置圆角半径——🔒 同时更改四个角——以及 Round / Scallop / Chamfer 角）、**3-Point Rectangle**（以任意角度拖出一条边，松开，再点击确定高度）、**Ellipse**（Ellipse / Pie / Arc，带起始和结束角度）、**3-Point Ellipse**、**Polygon**（边数）、**Star**（角数、锐度）、**Complex Star**（角数、锐度——中间镂空）、**Spiral**（圈数、对称 / 对数、扩展）、**Graph Paper**（列 x 行）、**Common Shapes**（基本形状、箭头、流程图、横幅、标注）。Ctrl = 正方形 / 圆形，Shift = 从中心绘制。它们保持**实时可编辑**：选取一个，属性栏即可修改它，直到用 F10 编辑节点或用 Ctrl+Q 转换为曲线为止。
- **Artistic Media**（在 F5 中）：绘制一笔，它就会变成填充形状——**Preset**（Taper、Teardrop、Flare、Uniform）及其宽度，**Calligraphic**（笔尖宽度和角度），**Pressure**（数位笔的压感；使用鼠标时，越慢越宽），**Sprayer**（沿笔触分布星星、圆点、叶子、心形、气泡或彩纸屑——大小、间距）。它同样保持实时可编辑。
- **F8**（再按 = 下一个）：**Parallel Dimension**、**Horizontal / Vertical Dimension**（点击两个点，然后点击尺寸线的位置——上 / 下 = 水平，旁边 = 垂直）、**Angular Dimension**（顶点、两条边上各一个点、圆弧的位置）、**3-Point Callout**（指向点、拐点、终点——文字来自属性栏）。单位 px / mm / cm / in（按指定 dpi）、小数位、文字大小。**Connector**（Straight / Right-angle / Rounded right-angle）：从一个对象拖到另一个对象——它会吸附到它们各边的中点（或它们的中心），并且**在对象移动时跟随**。

### Actions 和 Batch（2.427.0）

**Actions** 标签页位于 History 旁边（Window ▸ Actions，Alt+F9）。组（📁）包含动作（▶），动作包含步骤。

- **录制**：选取一个动作（或 ＋ New Action——立即开始录制），然后开始操作：每个菜单命令、快捷键或命令面板命令都是一个步骤，并带有你按下 OK 时其所打开对话框的设置（Cancel = 不记录步骤）；滤镜和调整带有它们的设置；Layers 面板的按钮、混合模式、不透明度和填充也会记录。■ 停止。手动绘画和手动选择不会被录制——Select 菜单命令则会被录制。
- **播放**：▶ 播放选取的动作，或从选取的步骤开始播放。☑ 关闭某个步骤；▢（对话框开关）让步骤停在其对话框中以便你修改（OK 继续，Cancel 停止动作）。无法执行的步骤（没有图层、没有选区）会停止动作，并说明是哪一步以及原因。
- **编辑**：▲ ▼ 移动，🗑 删除；双击步骤可重新录制其对话框的设置，双击动作可设置其名称和功能键（F2 … Shift+F12——编辑器未使用的按键），双击组可重命名。☰：Insert Stop（一条消息，可带或不带 Continue）、Insert Menu Item、Duplicate、Button Mode（每个动作一个按钮）、Load / Save Actions（.json——无法读取 .atn 文件）、Reset Actions、Batch。自带一个 **Default Actions** 组（Vignette、Sepia Toning、Black & White Punch、Soft Glow、Sharpen + Flatten）。动作随应用一起保存。
- **File ▸ Automate: Batch…** 对多张图片播放一个动作：选取文件或文件夹，设置出错时的处理方式（停止，或记录后继续）、结果的去向（项目的 batch 文件夹、图像图库、逐个下载，或不保存）、文件夹名称、文件名后缀，以及 PNG 或 JPEG。运行时会显示进度框（■ Stop），结束时给出报告。

### Character 和 Paragraph 面板、段落文字、文字样式（2.426.0）

Color / Swatches 旁边的两个标签页（Window ▸ Character，Window ▸ Paragraph）。它们编辑活动文字图层——每次更改是一个撤销步骤——或者在未选取文字图层时，编辑下一段文字的初始设置。

- **Character**：字体和样式（Regular / Bold / Italic / Bold Italic）、大小、行距、字距调整（Metrics / 0）、字符间距、垂直和水平缩放、基线偏移、颜色；Faux Bold、Faux Italic、All Caps、Small Caps、Superscript、Subscript、Underline、Strikethrough。
- **Paragraph**：左对齐 / 居中 / 右对齐，Justify last left / centred / right，Justify all；左缩进、右缩进和首行缩进；段前和段后间距；Hyphenate。
- **段落文字**：用 Type 工具（T）拖动绘制一个文本框——文字在框内自动换行（点击一下仍然创建点文字）。两端对齐的行需要文本框。放不下的文字会被隐藏，文本框的角上显示 ⊞（Paragraph 面板也会提示——用 W / H 将文本框调大）。Layer ▸ Type：Convert to Paragraph Text / Convert to Point Text（放不下的行会被舍弃）。Image Size 也会缩放文本框和缩进。
- **Character Styles / Paragraph Styles**（两个面板中的列表）：＋ 根据文字创建样式，点击即可应用（文字会记住该样式），名称后的 + = 此后文字被修改过（⌫ Clear Override 恢复样式），⟲ Redefine 根据文字更新该样式以及所有使用它的文字，🗑 删除，双击重命名。样式随应用一起保存。

### 矢量线条：Bézier、曲线工具和 Shape 工具（2.425.0）

按键：**F5** 选取曲线工具（再按 F5 = 下一个），**F10** 为 Shape 工具，**F12** 为 Outline Pen，**Ctrl+Q** 为 Convert to Curves。每个曲线工具都绘制**矢量线条**——一种在任何尺寸下都保持清晰、带有轮廓笔的图层——或者当你从活动线条的某个开放端点开始时，接着延续该线条。

- **Bézier**（F5）：点击 = 尖角节点（直线段），拖动 = 平滑节点（曲线；拖动时按 **C** 使其变为尖角节点，以便下一段可以转向，按 **S** 恢复平滑）。Ctrl = 以 15° 为步进。点击第一个节点即可闭合；双击、按 Enter 或 Space = 完成；Esc 放弃正在绘制的线条。
- **Freehand**：拖动 = 手绘线条（属性栏中有 Smoothing）；点击、再点击 = 直线。
- **2-Point Line**：从起点拖到终点。**Polyline**：点击 = 直线段，拖动 = 一段手绘，双击结束。**3-Point Curve**：拖出弦，松开，再点击曲线弯曲经过的位置。**B-Spline**：点击控制点——曲线会平滑地跟随它们，并且在 Shape 工具中仍保持为 B 样条。**Node Pen**：会显示下一段的 Bézier，并可在活动线条上点击添加 / 删除节点。
- **属性栏**（所有曲线工具和 Shape 工具）：轮廓宽度、颜色、样式（实线、虚线、点线、点划线、长虚线、自定义）、起点和终点箭头（箭头、三角形、开放、半箭头、圆形、方形、菱形、短横）、闭合曲线的填充、✒ F12 和 ⇢（转为路径）。
- **Shape 工具**（F10）：点击 / Shift+点击 / 框选节点；拖动节点、控制柄（尖角、平滑和对称节点——分别为方形、圆形和菱形标记）或线段（使其弯曲）。双击线条 = 添加节点，双击节点 = 删除节点；+ / - / Delete；C / S / Y = 尖角 / 平滑 / 对称；方向键微移。属性栏：添加、删除、连接两个节点、断开曲线、转为直线、转为曲线、节点类型、反转方向、延长曲线以闭合、提取子路径、自动闭合、减少节点（带平滑度滑块）、全选。它适用于任何形状图层和路径；B 样条会显示其控制点。
- **Outline Pen**（F12，Layer 菜单）：颜色、宽度、样式 + 自定义虚线（以线宽为单位）、转角和斜接限制、线端、位置（外部 / 居中 / 内部）、箭头 + 大小 + 交换、填充、置于填充之后、随对象缩放。没有活动形状图层时，它设置之后绘制的线条的轮廓。
- **Convert to Curves**（Ctrl+Q）：矩形、椭圆、多边形、直线或自定义形状图层会变成可编辑的矢量线条（保留其外观）。
- **矢量线条 ⇄ 路径**：Layer ▸ **Vector Line: Convert to Path…** 将线条作为保存的路径放入 Paths 面板，该路径会记住其轮廓笔（可选择是否保留图层）；**Vector Line: Make from Path…**（或 Paths 面板的 〰）将路径转换为矢量线条——由线条转来的路径会精确还原（名称、宽度、虚线、箭头），其他路径则采用曲线工具的轮廓设置。每一步都可撤销。
- **文件**：Export Path as SVG… 会写出带有虚线和箭头的矢量线条（以及其轮廓笔，因此 Place SVG as Shape Layer… 能将其恢复为线条）。在 PSD 中，它是带有 PSD 描边（宽度、颜色、虚线、线端、转角、位置）的矢量形状图层；PSD 不支持箭头，因此 bitGen 将轮廓笔保存在文件的 XMP 中，并在打开该 PSD 时恢复它。

路径方面：**Curvature Pen**（P，Shift+P 循环切换）——点击若干点，曲线会平滑地穿过它们；双击某点 = 在角点 / 平滑点之间切换；拖动某点可移动它；Enter / Esc 结束。Pen 的 **Rubber Band** 选项会在你点击之前显示下一段。**Path Selection**（A）可以将选取的组件**对齐**（左、中心、右、顶、中间、底——彼此对齐或对齐画布），并将它们均匀**分布**。

### PDF 文件：打开、编辑、保存（2.424.0）

**File ▸ Open PDF…**（或将 .pdf 拖放到编辑器上）在编辑器中打开 PDF；**File ▸ Open PDF from Project…** 打开之前保存过的 PDF。左侧会出现 **Pages** 栏（✎ = 你修改过的页面）；点击某页即可打开。页面打开后包含：

- 一个 **Background**——页面的图像，*不含其文字*（文字是从页面本身中去除的，而不是被涂盖），以及
- **每行文字一个文字图层**，位于原来的位置，并匹配其字体（衬线 / 无衬线 / 等宽、粗体、斜体）、大小、颜色和宽度。

可以用任何工具进行编辑——重新输入一行文字、移动它、绘画、添加图层。在页面之间切换时，每个页面都会保留自己的图层和撤销记录——即使你在中间打开了另一张图片也是如此（File ▸ PDF Pages 可重新显示页面栏）。页面栏中的 dpi 设置尚未打开的页面在打开时的清晰度（72 - 300，150）。

**💾 Save PDF**（File ▸ Save PDF）将修改过的页面保存回原文件——即项目 pdf 文件夹中的副本——并下载它；**Save as New…** 创建一个新文件。你未修改的页面保持原样（仍为矢量）。修改过的页面会变为图像，其上的文字作为**真正的 PDF 文本**（以匹配的粗细和样式、颜色、大小和间距使用 Helvetica / Times / Courier）——可选择、可搜索。这些字体无法写出的文字（其他文字系统、变形 / 3D / 路径文字、图层样式、蒙版、混合模式）会改为绘制到图像中——保存时会说明数量。pdf.js 和 pdf-lib 在页面内完成读取和写入；不会向互联网发送任何内容。

## 音乐、分轨与人声
<!-- en: music-stems-and-voices a43f7c3e6d68 -->

- **Music**（音乐）面板——根据歌词和风格生成歌曲（通过 ComfyUI 使用 MiniMax Music3，或使用 YuE2），还可制作翻唱和乐谱。
- **Stems**（分轨）——将歌曲拆分为人声 / 鼓 / 贝斯 / 其他（demucs）。
- **Voices**（声音）——用一段短片段或一段波形区域克隆声音，然后用它朗读文本（OmniVoice）；用 faster-whisper 转写语音；**🎤 Speak** 可通过语音向提示词中输入文字。

## 时间线与导出
<!-- en: timeline-and-export 2c6131409b6c -->

将片段、歌曲和图片拖到 **Timeline**（时间线）的图层上，修剪并移动它们，添加转场，然后将时间线合成为一个视频，保存在项目文件夹中。

## 菜单栏
<!-- en: the-menu-bar 13629d89a039 -->

标题栏下方的那一排按钮：**✚ New**（新建）、**📂** 加载、**💾** 保存、**📷** 截图、**⏺** 录制、**🗑** 回收站、**↺** 重置项目、**⚙** 设置、**⏏** 卸载所有已加载的模型。无论显示或隐藏哪些面板，它都固定在原位。

## 路径图层（2.387.0）
<!-- en: path-layers-2-387-0 9d2969895366 -->

- **＋ Path layer** → 用 **⤳ (Shift+P)** 绘制路径（点击添加点，拖动以移动点，Alt-click 删除点）→ 在其面板中写明沿路径移动的是什么（动物 / 人物 / 车辆），以及 Start / Length（开始 / 时长）、起点 → 终点的大小、节奏和朝向 → **✨ Generate**。
- **In place + follow path**（原地生成 + 沿路径移动）：绿幕上的图片 → 原地生成视频（使用你的视频风格）→ 抠除绿色 → 通过关键帧让片段沿路径移动（折返时镜像翻转），并按需循环。编辑后请点击 **⟲ Place again**。
- **Along the path (Wan ATI)**（沿路径生成）：需要一个 Wan 2.1 风格和 `Wan2_1-I2V-ATI-14B_fp8_e4m3fn.safetensors`；由模型让对象沿路径行进；生成一个全画幅的透明片段。
- **Cut out**（抠像）：AI 抠像（⬇ Install AI matte：venvs/matte，rembg + BiRefNet）或色度键。每个图层都是透明的。

## 摄像机路径：平摇、俯仰、横滚、推拉、高度与 3D 路径（2.399.0）
<!-- en: the-camera-path-pan-tilt-roll-dolly-height-a-3d-path-2-399-0 c382a19e2d40 -->

时间线栏上的 **🎥 Camera** 会打开 Camera 面板。与 Basic Settings 一样，它是一个独立的面板：可以让它浮动，也可以把它停靠在另一个面板的旁边或内部。画布工具栏中的 **🎥** 工具（**Shift+C**）会在位置标记处的画面上绘制摄像机的取景框。

**制作运镜**

- **Preset** ▸ **Apply**：推进、拉出、左 / 右横移、升 / 降、平摇、俯仰、横滚、环绕、摇臂升 / 降、变焦推近 / 拉远、飞入。
- **Camera / Top / Side** 显示摄像机看到的画面，以及从上方和侧面看到的路径。在 Top 和 Side 视图中，拖动一个点可移动它，点击空白处可添加一个点。**＋ Point** 和 **✕ Point** 用于添加和删除点。
- **▶** 和滑块用于播放和拖动浏览运镜。时间线上的标记会随之移动。
- **Pan, Tilt, Roll, Height, Dolly, Lens**：该时刻的数值。修改其中任意一项都会在该处写入一个 **◆ key**（关键帧），摄像机会在关键帧之间平滑移动。**◆ Key**、**✕ Key** 和 **◀ ▶** 用于添加、删除关键帧以及在关键帧之间跳转。
- **Aim**（朝向）：正前方、对准画面中心（环绕时始终朝向内侧），或沿路径方向。此外还有 **Ease**（缓动）、**Length**（**= Seconds** 与 Basic Settings 保持一致）和 **From**（在时间线上的起始位置）。
- **在画布上使用 🎥 工具时**：拖动可平摇和俯仰，Alt+drag 可横滚，Shift+drag 可改变高度，滚轮可推拉，Shift+wheel 可变焦。每项操作都会在标记处写入一个关键帧。

**告知视频模型**

勾选 **Use in Generate** 后，提示词面板的 Generate 会把摄像机信息一并传递。这三个模型都不支持任意的 3D 摄像机路径，因此每个模型只会得到它能遵循的信息：

- **MiniMax H3** 会得到专门的摄像机描述句，例如 "The camera pushes in with large amplitude at slow speed."。它**每个镜头只能执行一种运镜**，因此只会被告知主要的运镜。
- **Wan** 会以文字形式得到运镜描述。如果 ComfyUI 中有 **Fun Camera** 模型（`wan2.2_fun_camera_high/low_noise_14B`，或 Wan 2.1 Fun Camera 模型），且参考图面板中有图片，它还会得到该模型的运镜：Zoom In/Out、Pan Left/Right/Up/Down，或顺时针 / 逆时针横滚。
- **LTX** 会以文字形式得到运镜描述。如果 ComfyUI 的 loras 中有对应的 **LTX-2 camera-control LoRA**，它还会得到该 LoRA：推进、拉出、左移或右移（dolly in / out / left / right），摇臂上升或下降（jib up / down），或静止（static）。例如，`ltx-2-19b-lora-camera-control-dolly-in.safetensors` 来自 `Lightricks/LTX-2-19b-LoRA-Camera-Control-Dolly-In`。

面板中的 **What the models are told** 会显示以上所有内容，以及 ComfyUI 已安装了哪些内容。

**精确路径（引导视频）**

1. **⟳ Use picture** 会取第一张参考图，或位置标记处的时间线画布。它会保存在 Assets（素材）中。
2. **◐ Depth** 通过 ComfyUI 使用 Depth Anything V2 生成其深度图。这需要 comfyui_controlnet_aux。**Relief** 用于设置近处部分的突出程度。
3. **🎬 Make guide** 让图片沿路径飞行，并将两个视频保存到 Assets：`camguide_<id>_rgb.mp4`（摄像机看到的画面）和 `_depth.mp4`（其深度）。
4. 勾选 **Exact path**。之后 Generate 也会发送引导视频：
   - **MiniMax H3**：RGB 引导视频会成为参考视频，提示词会要求遵循其摄像机运动。这仅在 References 渲染中有效（First / Last 渲染不接受视频），并且属于**实验性**功能。
   - **Wan**：深度引导视频会成为 **VACE** 的控制视频，并以第一张图片作为其参考图。这需要一个 VACE 模型。
   - **LTX**：深度引导视频会通过 **style-transfer** 模式作为深度引导使用，并以第一张图片作为首帧。

如果你更改了路径或图片，引导视频会被标记为 **⚠**，在你重新生成它之前，Generate 不会使用它。

## 用 SeedVR2 放大视频；队列中的运行卡片（2.400.0，⏫ Enhance 2.401.0）
<!-- en: upscaling-a-video-with-seedvr2-the-queue-s-running-card-2-400-0-enhance-2-401-0 bcd5b6c4e576 -->

预览栏上的 **⏫ SeedVR2** 会使用 ComfyUI 自带的 SeedVR2 节点，放大你正在观看的视频（图库中的视频、Video 素材或导出的视频）：

- **Size**（尺寸）：短边（720p、1080p、1440p、4K，保持宽高比）或倍数（×2、×3、×4）。开始之前，面板会显示结果的尺寸。
- **Colour match**（颜色匹配）：lab（最忠实）、wavelet、adain 或 none。
- **Temporal split**（时间分段）：auto 会把长片段切成适合显卡空闲显存的若干段，处理后再融合回去；也可以使用固定的分段长度；或者关闭。
- **Model**（模型）：*best available* 会在 ComfyUI 中有 `seedvr2_7b_sharp_fp16.safetensors` 时使用它，否则使用其他 SeedVR2 7B 模型，再否则使用 3B 模型。**Setup → Models → Upscaling** 可下载它（16.5 GB）、较小的 3B int8 模型以及 SeedVR2 VAE。
- **Denoise**（去噪）：1 表示完全修复；数值越低，保留的原始纹理越多。

**⏫ Upscale** 会将其作为独立任务加入队列。结果会保留原视频的声音，并以 `<name>_seedvr2_<size>p.mp4` 的名称出现在图库中。你的选择会随项目保存。

**用于场景板**：在 StoryBoard 的 ⚙ 中，将 **Upscaler** 设为 **SeedVR2 (video)**。之后，场景的 ⏫ 会把它的镜次（如有无损母版则使用母版）按 ⚙ 中的 **Upscale resolution** 送入 SeedVR2 处理，并存为该场景的放大镜次。这适用于任何视频风格。勾选 **Upscale every render** 后，每个镜次一生成就会被加入 SeedVR2 队列。

提示词面板中的 **⏫ Enhance** 会为**所选视频**打开同一个面板：即你最后在图库、Video 素材或参考图面板中点击的那个视频。该缩略图会出现虚线圈，按钮的工具提示会显示视频名称及其位置。如果未选择任何视频，面板会提示你点击一个。面板打开时点击另一个视频，面板就会切换到该视频。（LLM 提示词改写已移至提示词框中的 **Enter**。）

**队列面板**会将正在运行的渲染显示为**一张卡片**：包括其状态和 ⏸ ▲ ▼ ✕ 按钮、提示词、任务 id、模式和尺寸、进度条，以及 "chunk 1/2 · step 3 of 8 · 1:11 · 19%"。点击卡片可在控制台和预览中跟踪它。下方的任务列表不再重复显示它。

## Basic Settings 中的视频风格（2.401.0）
<!-- en: the-video-style-in-basic-settings-2-401-0 c2759a4256d1 -->

Basic Settings 的顶部会显示提示词面板的 Video 下拉菜单所选的视频风格。在这里选择另一个风格，两处会同时更改。卡片显示：

- 风格的类型（MiniMax H3、Wan 2.1 / 2.2、LTX 2.5）及其工作流；
- **Model**，每个阶段一行（Wan 2.2：high noise 和 low noise），以及实际用于渲染的模型。模型为空表示使用工作流自带的模型，卡片会显示该文件名。Wan 会从 ComfyUI 列出的文件中自行选择所用文件；
- 每个阶段的步数、cfg 和加载精度，以及文本编码器、VAE、LoRA 和负面提示词。

在某一行中选择另一个模型，它会**保存到风格中**，下一次渲染就会使用它。📁 可浏览 ComfyUI 的模型文件夹。**⚙** 会打开 Settings → Video 中的完整风格编辑器。

## 状态栏的面板按钮、3D 工具栏（2.386.0）
<!-- en: the-statusbar-s-docker-buttons-the-3d-toolbar-2-386-0 0e088bed13e3 -->

- 每个面板都有一个状态栏按钮（现在 Stems、SFX 和 Chat 也有了）。**面板显示在屏幕上时，按钮会亮起**（无论展开还是折叠）；点击一次隐藏面板，再点击一次重新显示。
- 选择一个 3D 图层后，预览画布顶部会出现一个 **3D 工具栏**——控件（✥ ⟲ ⤡ ○）、🧲 15° 吸附、视图（前 / 左 / 右 / 顶 / 底 / 后，⟲0）、⟳ 旋转、⤢ 重置深度 + 缩放、🎨 材质预设、☀ 影棚灯光 + 亮度、＋💡 添加灯光、◇ Key、🟧 Blender、⚙、🧊 Bake。

## Tools & Properties、关键帧、3D 控件、灯光、材质、Blender（2.385.0）
<!-- en: tools-properties-keyframes-3d-widgets-lights-materials-blender-2-385-0 fbae13ff3b96 -->

- **🧰 Tools & Properties** 浮动在独立的窗口中：按 **1** 可显示 / 隐藏它（也可点击时间线栏中的 🧰，或其标题栏上的 ✕）；拖动标题栏可移动它，拖动角落可调整大小。
- **◆ 关键帧**可沿其所在片段拖动（不能越过相邻的关键帧：第一个 ◆ 的范围为 0 .. 下一个 − 1 帧，最后一个 ◆ 的范围为上一个 + 1 帧 .. 片段末尾）。右键点击 / Alt-click / Delete 可删除一个关键帧。
- **3D 控件**（使用 Move 工具，且已选择 3D 图层）：**G** 移动（X / Y 横向，蓝色 Z 朝向摄像机），**R** 旋转（球体 = 自由翻转，圆环 = 仅 X / Y，外圈 = 横滚），**S** 缩放（各自的 X / Y / Z，中心 = 等比缩放）。再次按同一个键可隐藏控件。
- **🎨 Material**（材质）：预设（金、铬、玻璃、霓虹 …），或颜色 / 金属度 / 粗糙度 / 发光 / 不透明度 / 清漆层 / 玻璃 / 线框 / 平面着色 / 纹理；模型的每个部件都可以保留自己的材质、使用图层的材质或使用某个预设。
- **💡 Lights**（灯光）：影棚灯光开 / 关 + 亮度，以及 ＋ Point / Spot / Sun / Ambient / Sky，可设置颜色、亮度滑块和位置。
- **🟧 Blender**：在 Blender 中安装 **bitgen-blender-addon** zip 包（Preferences → Add-ons → Install from Disk）→ 侧边栏（N）→ bitGen：Send to bitGen（glTF，"Add as 3D layer"）、Live link（保存时重新发送）、Get from bitGen。3D 图层的 **Render with: Blender** 会在 Blender 中（Eevee / Cycles）渲染该图层以供合成；⚙ 用于设置 Blender 的路径。（2.402.0）**Render scene → bitGen** 会通过 Blender 布局中的摄像机渲染整个场景，并由 LTX 2.3 + 3DREAL 将其变为照片级真实效果——参见 *LTX 2.3 and 3D render → real*。

## 种子与渲染详情
<!-- en: seeds-and-render-details 26e3ee174b3b -->

- **Basic Settings → Seed**：-1 = 每次渲染使用一个随机种子；输入一个数字即使用该种子；**🎲** = 重新随机；**♻** = 上次使用的种子（显示在输入框下方）。
- **Queue**（队列）：正在运行的任务会显示 *step n of total · time*。已完成的任务带有 **ⓘ**——显示其种子、CFG、步数、采样器、模型、LoRA、尺寸、渲染时间和提示词；**♻ Use** 会把它的种子填入 Basic Settings。
- **预览对话框**（点击图库中的图片或片段）：在右侧窗格中显示相同的详情（**ⓘ** 可隐藏该窗格）。
- **StoryBoard ⚙ → Seed**：*Random for each scene* 或 *Same seed for every scene*（使用种子框；留空 = 上次使用的种子）；**♻** 会将上次使用的种子设为种子。
- **每张场景卡片**都有自己的种子框（优先于 ⚙ 中的设置）；旁边的 **♻** 会复用其上一个镜次所用的种子。场景渲染时会显示 *running step n of total*、进度条和时间；渲染完成的场景会显示其渲染时间和种子。
- 📌 图钉在面板被固定之前是亮的，固定后会变暗。**在已固定的面板上点击 📌** 会把它的最大高度重置为 0：将它拖到任意高度，然后再次点击 **📌** 固定该高度。已固定的面板仍可通过其边缘缩小，但永远不会高于固定的高度。已固定的视频面板会保持其高度（在取消固定之前，它不再占用剩余空间）。

## 位置标记、图层颜色
<!-- en: the-position-marker-layer-colours fe85b9bfd22a -->

- **拖动红色标记**（其头部或竖线）可在时间线上随意移动：正在播放的预览会从你放下的位置继续播放；停止状态下，预览会显示该帧。在标尺或轨道上**双击某个时间点**可跳转到那里并从那里开始播放。播放 / 暂停 / 停止按钮位于预览画布下方。
- 每个图层都有自己的颜色；所选图层带有轮廓。F/L 和 REF 标记行会随缩放而变高。

## 图层名称
<!-- en: layer-names 0c6556f73d05 -->

在时间线画布的 Layers 列表中双击图层名称并输入（Enter 确认，Esc 取消），或对所选图层按 F2，或使用其属性中的 **Name** 框。点击时间线轨道上的名称也可以。

## 面板尺寸、📌 图钉与最大化
<!-- en: dock-sizes-pins-and-maximize ff24cc607a0b -->

- 每个面板都会记住它是打开、关闭还是隐藏，以及它的高度和宽度、📌 图钉状态和是否最大化——这些信息保存在应用旁边的 `docker_status.json` 中，所有项目使用相同的布局，并在其他任何内容出现之前加载。
- **📌**（每个面板标题栏中的第一个按钮）会固定面板当前的高度：它可以被拖小，但不能拖高。再次点击即可取消固定。在侧边面板上，图钉固定的是宽度。
- 打开一个面板时，其他已固定的面板会恢复到各自的固定高度；所需的空间从未固定的面板中获取。
- **⛶ Maximize** 会让一个面板占据其他已打开面板留下的全部空间——这些面板保持打开，并保持各自的高度（或其固定高度）。所有分隔条仍然可用。按 **Esc** 或 🗗 可还原。

## Docker configs：为每组面板保存的布局（2.392.0）
<!-- en: docker-configs-a-saved-layout-for-each-set-of-dockers-2-392-0 b3f8789eb267 -->

**⊞**（Docker configs）是菜单栏右端的图标按钮。它让你的面板布局保持整齐，使你一起打开的面板不会被挤压或被截断。

1. 打开你一起使用的那些面板，例如 Music、Prompt chat 和 Prompt。按你喜欢的方式调整它们的大小。
2. 点击 **⊞ Docker layout ▸ 💾 Save layout**。每个面板的尺寸都会保存在 **docker.cfg**（安装文件夹中的一个文件）中——并且（2.432.0）还会保存**哪些面板显示在屏幕上**（打开、折叠为标题栏或隐藏）、显示了哪些**侧边面板**（左侧面板、References、Assets、队列、图库），以及**浮动面板的位置和尺寸**（Basic Settings、LLM tokens、⊖ 负面提示词、🎥 摄像机、浮动提示词），还有时间线画布旁边的 🎤 Karaoke / 🧰 Tools 的状态（停靠在左侧 / 右侧或浮动、是否显示、各列的宽度）。
3. 此后，只要恰好是这几个面板同时打开，它们就会恢复为这些尺寸。

打开第四个面板时，会查找为这四个面板保存的布局。如果没有，面板会保持原样，你可以调整它们的大小后再次保存。关闭第四个面板会恢复那三个面板的布局。

**不同的屏幕。** 每组面板可以为每种窗口尺寸各保存一个布局（最多六个）。在你未保存过布局的屏幕上，会使用最接近的已保存布局并使其适应窗口，确保每个面板都保持可见。

弹出窗口中列出了所有已保存的布局：

- **Load** 会以保存的尺寸打开那组面板；保存时处于折叠状态的面板会恢复为折叠状态，侧边面板和浮动面板会恢复到保存时的样子。
- **✕** 会删除一个已保存的布局。
- **Load saved layouts automatically** 用于关闭或开启自动加载。

当已为当前打开的面板保存了布局时，该按钮会高亮显示。

## ▾ 提示词面板使用哪张图片：参考图还是图层，以及 🧩 Compose（2.543.0）
<!-- en: which-picture-the-prompt-docker-works-from-references-or-layers-and-compose-2-54 7ff6926c1f3c -->

提示词面板的下拉菜单（🖼 Image 模式）现在会根据你的工作位置来选择图片。图像编辑器中的 ✨ AI 面板不再有自己的 Generate / Refine / Edit / Background / Compose 标签页，改由该下拉菜单进行选择。下拉菜单旁边的标签会说明按钮将使用什么。

**图像编辑器最小化或关闭时**，下拉菜单中有 Generate、Edit、Refine、Replace background 和 🧩 Compose，它们使用 **References 面板中的图片**（最多 3 张）。Fill 和 Remove 不会出现在列表中，因为它们需要在编辑器中有选区。编辑器再次打开时，你之前的选择会恢复。

- **✏ Edit**：只有一张参考图时，编辑模型会修改它。有两张或三张时，会将它们合成在一起。
- **🖼 Replace background**：编辑模型会被要求替换背景，并保持主体不变。
- **🔁 Refine**：按滑块的强度重绘参考图 1。
- **🧩 Compose**：用这些参考图合成一张图片（"put the dog from picture 2 on the sofa in picture 1"）。
- 结果会像其他图片一样出现在图库中。

**图像编辑器打开时**，Fill 和 Remove 会重新出现，图片来自**所选图层**：

- **✏ Edit**、**🔁 Refine** 和 **🖼 Replace background** 使用所选图层，即使它被其他图层遮挡也是如此。空图层会使用你所看到的画面。每个结果都会作为新图层加入。
- **选择了多个图层**（在 Layers 面板中 Ctrl-click）时，它们都会被使用：Edit 和 Replace background 会将它们合成，**🧩 Compose** 会用它们生成一张图片。
- 有**选区**时，Refine 和 Replace background 会像以前一样作用于选区，而 Fill 和 Remove 必须有选区才能使用。

## 🟧 Blender 图层：在图像编辑器中使用时间线的场景工具（2.542.0）
<!-- en: a-blender-layer-the-timeline-s-scene-tools-in-the-image-editor-2-542-0 67b4554ba356 -->

图像编辑器菜单栏上的 **🟧**（位于 ⛶ 旁边），或 **Layer ▸ New Blender Layer (Scene Tools)…**，会把时间线的 Blender 场景工具显示在画布上方。它们与时间线中的工具完全相同，使用同一个场景，编辑也相同：

- **📂 Open a .blend**，或继续使用已经打开的场景。**✨ Build a scene with AI** 在这里同样可用。
- **🎥 Scene camera** 通过 .blend 文件中的摄像机观察。**🧭 Free view**：拖动可环绕，右键拖动可平移，滚轮可缩放，按 F 可框选全部内容。**🔍＋ / 🔍－** 或 **Alt+drag**（向前 = 放大，向后 = 缩小）可缩放，**⌖ Zoom to object**（Z）会跳转到所选对象（2.546.0）。
- 图像编辑器中没有播放栏，也没有 Auto-key：在这里场景是一张静态图片。它们在时间线中仍然可用（2.546.0）。
- **点击对象**即可选中它，然后用 **✥ ⟲ ⤡**（G、R、S）移动、旋转或缩放它。你也可以为它设置关键帧、隐藏、复制或删除它，或用 ＋ Model 添加模型。
- 2.550.0：**绑定了骨骼的人物**（Daz 角色，或任何带有骨架的对象）会通过其**骨骼绑定**来选中——点击其身体（或在对象列表中点击其网格）会选中骨架，因为蒙皮的身体是由骨骼驱动绘制的：单独移动网格只会移动控件。点击射线未命中的人物（其包围盒是静止姿势下的）会通过摆好姿势后的包围盒找到。
- **💾 Save** 会把编辑写入 .blend 文件，方式与时间线中相同。

这些工具的设置位于 **🟧 Blender** 标签页中。场景会成为一个 **Blender 图层**，保存你所看到的视图。**✕**（或再次点击 🟧，或按 Esc）会关闭这些工具，图层会保留该视图。它是一个普通图层：可以隐藏、移动或删除它。选中它并按 **🟧 Scene tools** 即可再次打开这些工具。

**从场景生成图片。** 选中 Blender 图层，在提示词面板的下拉菜单中选择 **✏ Edit**（或 🔁 Refine）。按钮会显示 "✏ Edit · 🟧 Blender"。输入图片应呈现的内容，然后按下按钮。场景会被发送给编辑模型，**每个结果都会作为新图层**加入到 Blender 图层上方。画布上方不会留下任何东西，Blender 图层保持选中状态。🟧 Blender 标签页中的 **Edit from** 用于设置使用场景的哪张图片：

- **The view as shown**（即时）：工具打开时使用实时视图，否则使用该图层最后保存的视图。
- **Blender render - Solid** 或 **EEVEE**：Blender 先以图片的完整尺寸渲染该视图。

通过 Layer ▸ New 3D Layer 创建的 3D 图层现在也以同样方式工作：从场景进行的 Edit 会生成一个新图层。

**References 面板中的图片与场景一起使用**（2.546.0）。在提示词中提到某张参考图，它就会与场景一起发送给编辑模型——例如 *"photo real blonde woman on a beach with the face of the woman in picture 1"*。Picture 1 是 References 面板中的第一张图片，picture 2 是第二张，依此类推（"image 2"、"pic 2"、"ref 2" 也可以）。最多有两张图片能与场景一起发送，因为编辑模型只接受三张图片。
- 场景始终是模型收到的第一张图片，因此 bitGen 会为模型重新编号你的参考图，并使用模型自己的用词：FLUX.2 / FLUX 3 Klein 收到的是 "image 2"，Qwen Image 2.1 收到的是 "<image2>"，Qwen Image Edit 2511 收到的是 "Picture 2"。无论哪种情况，你都照常写 "picture 1"。
- 🟧 Blender 标签页中的 **References** 设置：**When the prompt names them**（默认）、**Always**（使用提到的图片，若未提到则使用前几张）或 **Never**。它适用于 Blender 图层和 3D 图层。
- 未提到任何图片的提示词只会发送场景，与以前一样。

## ▾ Generate、Edit、Refine、Fill、Replace background、Remove 与 Blender 模式（2.541.0）
<!-- en: generate-edit-refine-fill-replace-background-remove-and-blender-mode-2-541-0 e6a92d253c0c -->

在 🖼 Image 模式下，提示词面板的菜单栏中有一个下拉菜单，用于说明其按钮的功能。它的工作方式类似 Krita AI 插件，作用于图像编辑器中打开的图片：

- **✨ Generate**：根据提示词生成一张新图片，与以前相同。编辑器打开时，结果会作为图层放到画布上。
- **✏ Edit**：编辑模型按照指令（"make her jacket red"）修改选区，没有选区时修改整张图片。
- **🔁 Refine**：重绘选区，没有选区时重绘整张图片。菜单栏上会出现一个滑块，用于设置变化的程度（5 – 95 %）。它与 ✨ AI 面板的强度是同一个设置。
- **🪣 Fill**：根据提示词填充选区。请先选择区域。
- **🖼 Replace background**：保留所选内容，其余部分全部重新生成。
- **🧽 Remove**：去除所选内容，并延续周围的画面。提示词可选。

按钮上的文字会随所选项变化（"🔁 Refine 40%"），✨ AI 面板的标签页也会随之切换。如果编辑器已关闭，按下按钮会打开它。结果会出现在 ✨ AI 面板中：点击其中一个进行比较，点击其 **✔** 可将其保留为新图层。

**Blender 模式。** 选中一个 3D 图层（通过 Layer ▸ New 3D Layer 创建的图层、Daz 或 Blender 场景），下拉菜单旁边会显示 🟧 Blender 标签。此时 Edit 和 Refine 会基于场景工作：Blender 使用该图层的渲染引擎，以图片的完整尺寸渲染场景，然后将渲染出的图片与提示词一起发送给编辑模型。3D 图层本身保持不变。

**模型。** 🧊 3D 标签页的摄像机下方有一个 **Model** 部分：

- **Object**：选择场景中的一个对象（不列出摄像机）。
- **Move m**、**Turn °** 和 **Scale %** 在文件中原有位置的基础上移动、旋转和缩放它。**hidden** 会将其排除在外。
- **🖐 Drag the object**：在画布上点击一个对象以选中它，然后按摄像机的视角沿地面拖动它。Shift + drag 可上下移动，Ctrl + drag 可旋转。
- **Reset object** 和 **Reset all** 用于还原。每次更改都是一个撤销步骤。

原始的 .blend 文件永远不会被修改。

## ⟳ 从 GitHub 更新 bitGen Studio（2.540.5）
<!-- en: update-bitgen-studio-from-github-2-540-5 30e21a3568a8 -->

**Settings ▸ General ▸ ⟳ Updates** 会显示你的版本、bitGen Studio 的安装方式（git clone 或完整 zip 包）以及用于更新的 GitHub 仓库。

- **🔍 Check for updates** 会向 GitHub 查询最新版本，并列出新的更改。
- **⤓ Update now** 会安装最新版本。它会先征求你的确认，日志会显示在该区域中。
  - **通过 git clone 安装的**会切换到 GitHub 上的版本。如果你修改过应用自身的任何文件，它们会先被复制到 `backups\update-<time>\`。
  - **通过 zip 包安装的**会下载 GitHub 上的副本，并写入有变化的文件。
  - **无论哪种方式**，你的项目、设置、风格、模型、ComfyUI 和已保存的快速提示词都不会受到影响。当 Node 或 Python 包列表发生变化时，也会一并安装。
  - 带有自己提交的文件夹（开发者的副本）不会被更新。请在那里改用 git。
- **⟳ Restart now** 会在桌面应用中完成更新。如果在浏览器中使用，请关闭运行 `start.bat` 的窗口，然后重新启动它。
- **启动时的提示：** 启动后不久，bitGen Studio 会在后台静默检查。如果 GitHub 上有更新的版本，它会提示一次。

## 🧩 Settings ▸ Add-ons：在应用中安装的可选引擎（2.540.4）
<!-- en: settings-add-ons-optional-engines-installed-in-the-app-2-540-4 aa6e5f3cd8c1 -->

**Settings ▸ Add-ons** 列出不属于主安装的引擎。对于每个引擎，它会显示其用途、所需条件、大小以及是否已安装。可在此使用 **⤓ Install**、**⟳ Reinstall** 和 **🗑 Remove**，安装日志会显示在该标签页中。一次只能运行一个安装。

- **YuE2 music**：Music 面板中的 "YuE2" 风格（根据歌词加风格描述生成歌曲）。
  - ⤓ Install 会在应用的 `yue2` 文件夹中创建独立的 Python 环境。
  - 然后为你的显卡安装带 CUDA 的 PyTorch 2.10 以及固定版本的 YuE2 管线（yue2-infer 0.1.6），约 5 GB。
  - 模型 m-a-p/YuE2-3B 会在生成第一首歌曲时下载。
  - 它需要支持 BF16 的 NVIDIA GPU、约 24 GB 显存，以及应用的 Python 3.10 - 3.13。
  - 在 Windows 上，PyTorch 不带 FlashAttention。bitGen Studio 会为 YuE2 提供另一种注意力内核（依次尝试 cuDNN、PyTorch 自带的内核，以及较慢的无图模式），在日志中说明使用的是哪一种，并记住可用的那一种（2.540.7）。
  - 🗑 Remove 会删除 `yue2` 文件夹。
- **AI fill models (the Krita AI way)**（2.557.0）：图像编辑器在选区中执行 Generate / Fill / Remove 时，按模型系列所使用的模型（参见 2.555.0 的填充功能）。勾选你需要的项——每项都标有大小，已下载的会显示 ✓ downloaded：
  - Fooocus inpaint（SDXL / Pony）、MAT（Remove）和 NoobAI inpainting ControlNet（Illustrious / NoobAI）默认已勾选；FLUX.1 和 SD 1.5 inpainting ControlNet 以及 FLUX.2 Klein 4B outpaint LoRA 可按需勾选。
  - **⤓ Download ticked** 会将节点包 comfyui-inpaint-nodes 安装到你的 ComfyUI 中（勾选了 ControlNet 时还会安装 comfyui_controlnet_aux），然后将文件下载到 ComfyUI 的 models/inpaint、models/controlnet 和 models/loras 中（支持断点续传；会使用你在 Settings 中填写的 Hugging Face 令牌）。首次安装后需重启 ComfyUI 一次。
  - **🗑 Remove models** 会删除已下载的文件（节点包会保留）。
  - 它需要在 Settings ▸ ComfyUI 中设置好 ComfyUI 的文件夹。
- **Viggle (native)**：启动其自带的安装程序。进度显示在 Queue 中。

## 🎬 用参考图面板中的图片让 Blender 和 Unreal 渲染变得真实（2.540.0）
<!-- en: blender-and-unreal-renders-made-real-with-the-reference-docker-s-pictures-2-540- dd1af62c4470 -->

Blender 或 Unreal 场景中的每个对象都可以与 References 面板中的一张图片匹配。这样，名为 "Car" 的灰色方块就会变成你参考图中的红色跑车，再由 3DREAL 让它动起来。

- **对象如何找到对应的图片**
  - **按名称**：名为 Car、SM_Car_01 或 Vehicle.002 的对象会找到描述或名称中包含 car / sedan / truck… 的图片，Sofa 会找到 "a green velvet chesterfield"。墙和地板会找到墙和地板的图片。
  - **手动指定**：每个对象都有一个下拉菜单，*auto* 使用名称匹配，*none* 保持原样，你也可以直接选择一张图片。
- **🟧 Timeline ▸ Blender scene ▸ Render to real ▸ 🖼 References**
  - 勾选 **Use them** 并选择编辑模型（能接受最多图片的模型排在最前）。
  - 🎬 会像以前一样渲染该片段，并额外渲染其第一帧。该帧会作为 Picture 1 发送给编辑模型，参考图排在其后（"the grey shape on the left (the object "Car") becomes a red sports car in Picture 2"）。
  - 然后，LTX 2.3 **3DREAL** 会从这一真实化的第一帧开始为渲染添加动画。
- **🖼 Image editor**（图像编辑器）
  - 在 **Blender 3D 图层**上，🖼 References 部分会列出该图层的网格。之后 ✨ Generate 会使用匹配的参考图，把该图层的画面变得真实，并作为新图层加入。
  - 在 **Unreal 图层**上，🎮 Unreal 标签页中有 **🔍 Find the objects**（由 Unreal 列出该摄像机能看到的网格 Actor）和 **✨ Make it real**。
- **🟧 Timeline ▸ UNREAL ▸ Render to Real** 对 Unreal 片段的工作方式相同：先点击 🔍 Find the objects，然后点击 OK。第一帧会被变得真实，3DREAL 随后会跟随该片段的运动。
- Unreal 需要 **bitGen Bridge 1.3.0**（🎮 Load UE project 会更新它）。

## 🖼 参考图描述、墙 / 地板 / 家具 / 灯具类型、图像编辑器中的参考图（2.539.0）
<!-- en: reference-descriptions-the-wall-floor-furniture-light-types-references-in-the-im 470a684e6b95 -->


- **每张参考图都可以有描述**——References 面板 Image 标签页中的每张图片、每个视频和每个声音下方都有一个小输入框（"a green velvet chesterfield"、"a slow waltz"、"her voice, calm and low"）。描述会随项目和参考图组一起保存，会写入映射行（"<subject 2> furniture is in <Picture 2> (a green velvet chesterfield)"），提示词聊天和 ✨ Enhance 也会使用它（它优先于视觉模型的猜测）。
- **新的图片类型**：Type 下拉菜单中新增了 wall、floor、furniture 和 light（✨ Make it real 会使用它们）。
- **🖼 Image editor**（图像编辑器）
  - 将参考图拖放到已打开的图片上：它会作为**新图层**加入，并以其描述命名。
  - ✨ AI → **Edit** 中有一个 **reference** 下拉菜单：编辑模型会把那张图片作为 Picture 2 接收（"put the lamp from Picture 2 on the table"）。

## 🧩 Civitai 下载到各类型的文件夹、📁 文件夹、🔄 Sync（2.538.0）
<!-- en: civitai-downloads-into-each-type-s-folder-the-folders-sync-2-538-0 1d02fd4ad133 -->

- **Civitai 卡片上的 ⤓** 会下载最新版本的主文件。某个*类型*（例如 SDXL LoRA、Pony 模型、Wan LoRA）第一次下载时，**Select Folder** 对话框会询问该类型存放在哪里；之后该类型的所有模型都会直接下载到那里——不再弹出对话框。**Shift+click ⤓** 可再次打开对话框以更改文件夹。模型版本列表中的 ⤓ 按钮工作方式相同。
- **类型**：主类别（image、image-edit、video、music）、模型类型（sd1、sdxl、pony、illustrious、noobai、flux、flux2、flux2klein、flux3klein、krea、qwen、z-image、chroma、hidream、sd3、anima、wan、ltx、h3、hunyuan、music …）和种类（models、LoRAs、VAEs …）。它们保存在应用文件夹中的 **model_folders.json** 里，因此所有项目都会使用它们。
- Models 面板中的 **📁** 会列出每种类型的文件夹：*Change…*、✕ 忘记（下一次 ⤓ 会再次询问），也可以在下载之前为任意类型选择文件夹。
- 位于 ComfyUI 模型文件夹之外的文件夹仍然可以下载，但只有将其加入 extra_model_paths.yaml 后，ComfyUI 才会列出它——下载列表中会对此进行提示。
- **🔄 Sync** 会为这台电脑上**所有**尚无 Civitai 信息或信息已过期的模型和 LoRA（所有标签页）获取 Civitai 的详情、缩略图和示例图片。Civitai 已识别过的模型（有 .civitai.info、.metadata.json 或我们的卡片）会先按其版本 id 精确查询，然后按 SHA-256，最后按文件名查询。Shift+click 会重新同步所有模型。

## ⛶ 在侧边面板之间最大化（2.538.0）
<!-- en: maximize-beside-the-side-dockers-2-538-0 a9292ab3eefd -->

现在，最大化浮动面板时，它会填满已打开的侧边面板之间的空间——左侧面板、References、Assets、Queue 和 Gallery 保持可见。关闭其中一个后，下一次最大化也会用上它腾出的空间。

## 🧩 Models：分页、文件夹标签页、卡片尺寸、模型信息页以及所有模型的 Civitai 信息（2.537.0）
<!-- en: models-pages-folder-tabs-card-size-the-model-info-page-and-civitai-info-for-ever 97b73036b139 -->

🧩 Model manager 现在可以轻松管理数百个模型：

- **分页**——每页显示的卡片数量与面板能容纳的数量相同（*auto*；调整面板大小后会重新排布），或每页 24 / 48 / 96 / 200 张；卡片下方有 ‹ 1 2 … › 翻页。
- **文件夹标签页**——位于 Models / LoRAs 下方：你存放模型的每个文件夹对应一个标签页（checkpoints/SDXL -> **SDXL**，loras/Pony -> **Pony**），使不同类型分开显示。**📌 This project** 列出本项目的渲染所用过的模型和 LoRA。
- **⇲ Edit**——拖动卡片的角（或滑块）可调整卡片大小；各列会重新填满面板。该设置会被记住。
- **点击卡片**会选中它（作为要使用的模型，或要添加的 LoRA）。**悬停**会显示其描述卡片——将鼠标移到描述卡片上并**点击它**即可打开**信息页**：其中包含图片、所有详情、触发词、描述以及**示例图片及其提示词**（*Use this prompt*），还有 ✓ Use this model、✎ Edit card、Civitai ↗。按 ‹ Back 或 Esc 返回。
- **⤓ Civitai info**——为该标签页上所有尚无信息的卡片获取详情、缩略图和示例图片，按文件名查找（Shift+click：重新获取全部；信息页上的 🔍 By SHA-256 可精确查找）。这些信息保存在应用的 **model_info** 文件夹中，因此所有项目都能看到，并且不会向你的模型文件夹写入任何内容。它在后台运行，一次处理一个模型（每个需要几秒钟）；■ Stop 可结束它。

## Veda 稀疏注意力——更快的 MiniMax H3（2.536.0）
<!-- en: veda-sparse-attention-a-faster-minimax-h3-2-536-0 14925a1969d3 -->

**Veda**（veda-sparse/Veda-on-ComfyUI）是一种为 MiniMax H3 训练的学习型稀疏注意力：由一个小型预测器判断哪约 10 % 的注意力是重要的，再由 Triton 内核跳过其余部分——在其训练过的尺寸下（1344x768、768x1344、768x768、1024x768；5 / 10 / 14 s）**端到端速度约提升 2-3 倍**，比 Sage 更快。它目前还是预览版：人脸可能会稍显柔和，其他尺寸会使用最接近的训练尺寸的方案——对于关键镜头，请与关闭 Veda 时的效果进行比较。

1. Settings -> ComfyUI -> **Video accelerators -> ⬇ Install Veda**（它会克隆该节点包并用 pip 安装其依赖；在 Windows 上会安装 triton-windows）。它需要 **ComfyUI 0.38 或更新版本**。
2. Settings -> Models -> **Model catalog -> Veda predictor (MiniMax H3)**（275 MB，下载到 ComfyUI/models/veda）。然后重启 ComfyUI。
3. Settings -> Video styles -> 某个 MiniMax H3 风格 -> **Veda sparse attention**：**On**（最快，即作者设定的 90 %），或 **Quality**（更密集——75 % / 50 %，并在第一步使用完整注意力）。预测器字段可以留空：应用会选择 ComfyUI 列出的那个（如果你有 R2VA 版本，参考图渲染会使用它）。

Veda 会替换注意力机制，因此 Veda 开启时会跳过风格的 Sage 设置；而开启 Long video 时，Veda 本身会被跳过。如果 Veda 在渲染中出错，应用会停用它并在不使用它的情况下重新渲染（日志中会注明）。

## FLUX 3 Klein 需要 ComfyUI 0.41 或更新版本（2.535.0）
<!-- en: flux-3-klein-needs-comfyui-0-41-or-newer-2-535-0 c2d53d139539 -->

FLUX 3 Klein 的文本编码器通过 CLIPLoader 的一个 *type*（`flux3`）加载，只有 ComfyUI **0.41.0 或更新版本**才提供这个类型（最好使用 0.41.1 或更新版本）。在旧版 ComfyUI 上，任务现在会明确提示这一点——*'flux3' is a CHOICE of CLIPLoader.type, not a file: this ComfyUI does not offer it*，并说明你当前的版本以及如何更新（便携版：`update\update_comfyui.bat`；git 安装：`git pull` + `pip install -r requirements.txt`；或通过 ComfyUI-Manager -> Update ComfyUI）——然后重启 ComfyUI。🩺 Style doctor 也会给出相同的提示。模型目录现在会以真实的文件名下载 FLUX 3 Klein（`flux3-image-klein-int8-convrot`、`flux3-image-klein-base-int8-convrot`）。

## 🧪 Test mode，以及新渲染加入已打开的预览（2.534.0）
<!-- en: test-mode-and-new-renders-joining-the-open-preview-2-534-0 033f70d81802 -->

**🧪 Test mode**（测试模式）位于 Settings -> General 的 Testing 下方——也可以使用 🧪 Testing 面板顶部的复选框。开启时：

- 一个小的 **🧪 Try next** 框（右下角）会针对*你当前所在的位置*推荐下一项测试——在图像编辑器中从 Gaussian Blur 开始，然后是画笔、橡皮擦、选区、图层 …；在 Settings 中则推荐 Settings 相关的测试。**✓ Tried it** 会询问是否有效，**– Skip** 将其标记为未测试，**Later** 显示下一项，**✕** 在本次会话中停止该区域的提醒；
- 当应用检测到某项测试自行生效时（你应用了模糊、该风格的任务已完成、你选择了某个工作区 …），会弹出 **Did it work?** 框询问你：**✓ It worked** / **✗ It didn't** / Later，并可填写*发生了什么*以及 **💡 Suggestions to change this feature**。你的回答和建议会记入测试列表，并出现在你保存的日志（💾 Save log）顶部的 SUGGESTIONS 下；
- 面板中某一行上的 ↺ 可重新测试该项。

**关闭**时，不会自动勾选任何项，不会保存任何内容，也不会弹出任何提示；你自己做的勾选会保留。

**预览会跟随新的渲染。** 如果渲染完成时图片预览处于打开状态，新图片会立即加入其缩略图条（你正在查看的图片保持不变），其顶部栏中的 **✨ 1 new** 按钮可带你跳转到新图片。

## 对话框内的下拉列表会显示在对话框前方（2.533.0）
<!-- en: dropdown-lists-inside-a-dialog-open-in-front-of-it-2-533-0 8a19b306c74e -->

较长的下拉菜单会打开一个带搜索框的独立列表（Settings -> General -> Dropdown lists）。在对话框内——例如 📁 *Select a LoRA* / *Select a ComfyUI model* 浏览器、Settings 或其他任何对话框——该列表现在会显示在对话框前方，并接管鼠标和键盘；以前它会显示在对话框后面。打开的列表也不会再在视频预览播放或日志滚动时自行关闭。

## 测试自动勾选、面板标题栏（2.532.0）
<!-- en: tests-tick-themselves-docker-title-bars-2-532-0 03fa6cc8137f -->

**🧪 测试列表会自动勾选。** 当应用检测到列表中的某项生效时——某个风格的任务完成、选择了工作区、使用了命令面板、为房间布置了家具、最小化了面板——该行会被勾选，并且勾选会被**保留**（显示为 *auto ✓*），因此重启后仍然存在。你自己的 ✓ / ✗ / – 始终优先；在自动勾选上添加备注会将其保留。

**每个浮动面板上都有 ▁ ⛶ ✕。** ▁ 将面板缩小为标题栏（点击 ▭ 或双击标题可再次展开），⛶ 会填满菜单栏和状态栏之间的窗口区域（🗗 将其放回原处，无论原来是停靠还是浮动），✕ 关闭面板。

在 📏 Sketcher 中，摄像机通过其专属控件进行选择、移动和旋转——参见 *Picking, moving and turning a camera (2.641.0)*。

## 缺失的模型文件会提示从哪里获取（2.531.0）
<!-- en: a-missing-model-file-says-where-to-get-it-2-531-0 08f278aa2b11 -->

在发送任务之前，风格要加载的每个文件——模型、文本编码器、VAE、LoRA、ControlNet——都会在 ComfyUI 自己的列表中查找。位于其他子文件夹中的文件（例如 `Anima\qwen_3_06b_base.safetensors`）会以 ComfyUI 给出的名称使用。完全不在任何列表中的文件会导致 ComfyUI 拒绝该任务；现在，当应用的**模型目录**中有该文件时，提示信息还会说明：*Settings -> Models -> ⤓ Model catalog -> "Anima text encoder (Qwen3 0.6B base)" (1.2 GB) downloads it to ComfyUI/models/text_encoders*——然后重启 ComfyUI。🩺 Style doctor 也会给出相同的提示。

## 🔍 查找任何内容——Ctrl+K 命令面板与 📖 Help（2.530.0）
<!-- en: find-anything-the-ctrl-k-command-palette-and-help-2-530-0 36ee1ae36cf0 -->

按 **Ctrl+K**（或点击菜单栏中的 **🔍**），然后输入要查找的内容，词语顺序不限：

- 每个**面板**（隐藏的面板会重新显示在屏幕上）以及每个**浮动窗口**（🎓 LoRA、🩺 Style doctor …）；
- 菜单栏和状态栏中的每个**按钮**，包括当前工作区隐藏的按钮；
- 每个**设置项**——设置对话框会在该项所在的选项卡打开，并高亮显示该项；
- **工作区**、**Generate 模式**以及你的**图片 / 视频风格**；
- 本指南的每个**章节**——它会在 **📖 Help** 窗口中打开，在那里还可以选择其他任何章节；
- 每个**快捷键**——📖 Help 中会打开该快捷键所在分组的按键表。

用 ↑ ↓ 选择，按 **Enter** 执行，按 **Esc** 关闭。经常执行的项目下次会排在前面。指针位于时间线的图层上方时，Ctrl+K 仍用于分割片段；在图像编辑器中，它打开的是编辑器自己的命令面板。

## 🩺 Style doctor——哪些风格可用，其他风格为何不可用（2.527.0）
<!-- en: the-style-doctor-which-styles-work-and-why-the-others-don-t-2-527-0 45f9ebf568c7 -->

菜单栏中的 **🩺** 用于打开 Style doctor（风格诊断）。它会列出所有图片风格。**▶ Check** 会用每个已勾选的风格依次生成一张小测试图，所走的流程与 Generate 相同：

- **Quick check**（快速检查）——512 × 512，4 步。风格能否加载并运行？每个风格只需几秒。
- **Real render**（真实渲染）——使用风格自身的步数和尺寸，速度较慢。

每一行最后显示 **✓ works**（附带耗时和测试图），或 **✗ failed**，并附上日志中的关键行以及处理办法，例如：

- ComfyUI 未列出的模型 -> 应放入哪个模型文件夹；
- 缺少节点包 -> 给出节点包名称，并提示使用 Install Missing Custom Nodes；
- ComfyUI 未运行、显存不足、文件未下载完整、文本编码器与模型不匹配。

缺少字段的风格会立即失败，不进行渲染。编辑风格（需要输入图片的风格）会得到一张小测试图。**■ Stop** 取消当前正在运行的渲染。**↻** 重新检查单个风格。除非勾选 **Keep the test pictures**，否则测试图不会保留在图库或 Image 素材中。最近一次运行的结果会被保留；**⤓ Report** 将其下载为 .md 文件，**🗑** 将其清除。

## 工作区——Basic、Image editing、Video editing、Music video、Expert（2.526.0）
<!-- en: workspaces-basic-image-editing-video-editing-music-video-expert-2-526-0 7413ab2009e2 -->

菜单栏中的 **Workspace**（工作区）下拉菜单可让应用针对某一类工作进行布局。每个工作区会显示该工作所需的面板，并隐藏用不到的状态栏和菜单栏按钮。没有任何功能被禁用——Expert 会显示全部内容。

| 工作区 | 显示内容 | Generate 设为 |
|---|---|---|
| ◯ Basic | Preview、Prompt、References、队列和图库——高级按钮被隐藏 | （不变） |
| 🖼 Image editing | 图像编辑器（最大化）、Prompt、References、Assets | 🖼 Image |
| 🎬 Video editing | Preview、Timeline、StoryBoard、SFX、Prompt | 🎬 Video |
| 🎵 Music video | Preview、Timeline、StoryBoard、Music、Stems、Prompt | （不变） |
| ◆ Expert | 所有面板和所有按钮 | （不变） |

**你所做的更改按工作区分别保存。** 隐藏某个面板、调整面板大小、打开 Sketcher 或 Basic Settings——切换到其他工作区再切回来时，一切都保持你离开时的样子。第一次离开 Expert 时，你当时的布局会成为 Expert 的布局，因此之前设置的内容都不会丢失。下拉菜单旁边的 **↺** 会将当前工作区恢复为默认布局。应用启动时会进入你上次所在的工作区。

## 位于其他 ComfyUI 文件夹中的模型仍能被找到（2.525.0）
<!-- en: a-model-in-another-comfyui-folder-is-still-found-2-525-0 c27ba5332d60 -->

ComfyUI 的每个加载器都只列出各自的文件夹：**Load Diffusion Model**（UNETLoader）列出 `models/diffusion_models` 和 `models/unet`；**Load Checkpoint** 列出 `models/checkpoints`。在 Civitai 上以“Checkpoint”类型下载的模型常常落在 `checkpoints` 中，而扩散模型类风格（Krea 2、Anima、Qwen Image…）看不到它。

现在，在发送任务之前，应用会先询问 ComfyUI：该风格的模型实际位于哪个列表中：

- 同一文件位于另一个子文件夹 -> 改用 ComfyUI 列出的名称；
- 只有 Load Checkpoint 列出的 `.safetensors` -> 该节点改为 **Load Checkpoint**（它也能加载只含模型的文件）；工作流保留自己的文本编码器和 VAE 加载器。

任务日志会注明这一点：`node 70.unet_name: Krea2/… -> as ComfyUI lists it: … loaded by Load Checkpoint`。如果该文件不在任何列表中，错误信息会说明这一点，并告诉你应放在哪里（`ComfyUI/models/diffusion_models`，放在其子文件夹中也可以；或放在 extra_model_paths.yaml 中添加的文件夹里——然后重启 ComfyUI）。

## 风格的模型可以是 .gguf 或 .safetensors（2.523.0）
<!-- en: a-style-s-model-can-be-a-gguf-or-a-safetensors-2-523-0 74295368d92a -->

图片风格的 **Model**（模型）可以是这两种文件中的任意一种。应用会为其选择匹配的 ComfyUI 加载器：

- `.safetensors` 模型使用 Load Diffusion Model（UNETLoader）；
- `.gguf` 模型使用 GGUF 加载器（ComfyUI-GGUF 节点包）。

因此，“Krea 2 Raw GGUF”可以渲染 `.safetensors` 微调模型，而“Krea 2 Raw”、“Krea 2 Turbo”和“Anima”也可以渲染 `.gguf`。任务日志会注明何时进行了切换，例如 `model: node 70 UnetLoaderGGUF -> UNETLoader`。

两种加载器读取相同的文件夹：ComfyUI 的 `models/diffusion_models` 和 `models/unet`，以及其中的任何子文件夹。不需要单独准备 `unet` 文件夹。

## 🐞 报告错误（2.522.0）
<!-- en: reporting-a-bug-2-522-0 6c21ef6b7309 -->

在应用中的任何位置按 **Ctrl+Alt+Shift+B**（正在输入文字时也有效）。应用会先按原样截取其窗口的屏幕截图，然后打开 **🐞 Bug report** 面板。再按一次可隐藏该面板。也可以从 Settings ▸ General ▸ **🐞 Report a bug…** 打开。

1. 填写以下内容：
   - **Title**（标题）：用几个词说明什么出了问题。
   - **Severity**（严重程度）：💥 crash / freeze（崩溃 / 卡死）、⛔ something does not work（某功能无法使用）、⚠ wrong result（结果错误）、🎨 looks wrong（显示不对），或 💡 idea（建议）。
   - **Where**（位置）：默认选中你最后使用的面板；如有需要可更改。
   - **What happened**（发生了什么）和 **what you expected**（你期望的结果）。
2. **Steps to reproduce**（重现步骤）：**⤵ Use the recorded steps** 会填入你最近的点击、选择和快捷键操作，并注明每项操作所在的面板。你可以随意编辑。
3. **截图**：
   - **✏ Pen** 和 **▭ Box** 用红色标出问题；**↶ Undo** 撤销最后一个标记。
   - **📷 Again** 重新截图（截图时面板会隐藏）。
   - **📎 A picture…** 改用你自己的图片。
   - 在网页浏览器中，📷 会询问要捕获哪个窗口。
4. **Attached**（附件，可逐项勾选或取消勾选）：
   - 截图；
   - **日志**：应用控制台、ComfyUI、视觉模型，以及最近的任务（失败的任务排在前面）；
   - **系统 + 设置**：版本、操作系统、显卡、内存、ComfyUI 版本；
   - **记录的步骤**。
5. **👁 What is included** 会在保存前显示所有这些内容。
6. **💾 Save report** 会将报告写入应用文件夹中的 `bug-reports` 文件夹，并下载 **bitgen-bug-<date>-<title>.zip**。你只需发送这一个文件。其中包含：
   - `report.md`，供阅读；
   - `report.json`，包含全部内容；
   - `screenshot.png`；
   - `logs`。

**Earlier reports**（以前的报告）列出你保存过的报告：**⤓** 重新下载某份报告，**🗑** 删除它。已开始填写但尚未保存的报告会保留在此浏览器中，直到你保存为止。

**隐私**：
- 记录器只记录按了什么以及在哪里按的。文本框只记为“edited”，从不记录输入的内容。
- 所有看起来像密钥、令牌或密码的设置都会显示为 •••，日志中形似令牌的文本（`hf_…`、`ghp_…`、`sk-…`、`token=…`）也同样会被隐藏。
- 记录器还会记录页面错误和失败的请求（仅记录地址和状态，从不记录发送的内容）。

## 训练器中的微调：检查点（checkpoint）、助手（LLM）和视觉模型（2.521.0）
<!-- en: fine-tunes-in-the-trainer-checkpoints-the-assistant-llm-and-the-vision-model-2-5 9344880273eb -->

状态栏中的 **🎓 LoRA** 按钮用于打开 **LoRA & fine-tune trainer**（LoRA 与微调训练器）。现在每个任务都有一个 **Type**（类型），位于 Job 选项卡的第一行：

| 类型 | 训练内容 | 引擎 | 结果 |
|---|---|---|---|
| 🎨 LoRA | 为图片 / 视频模型添加的小型附加组件 | ai-toolkit | ComfyUI 的 `loras/trained` |
| 🧱 Checkpoint fine-tune | 图片模型的全部权重——得到一个新模型 | ai-toolkit | ComfyUI 的 `diffusion_models/trained` |
| 💬 LLM fine-tune | 应用的助手，基于你自己的对话训练 | Unsloth | LLM 文件夹中的一个 `.gguf` |
| 👁 Vision fine-tune | 应用的视觉模型（图片描述、图片问答） | Unsloth | 视觉文件夹中的一个 `.gguf` 及其 `mmproj` |

基础模型列表用 ★ 标出推荐的模型，并对照你的显卡说明每个模型需要多少显存。即使你的显卡太小，也仍可以在更大的机器上训练该模型：使用 **⤓ Export job**，或 Settings ▸ Remote generation ▸ RunPod。

### 推荐的基础模型

**助手（LLM）**：

- **★ Qwen3.5 4B**：最佳起点（12 GB 显卡，16 位 LoRA 约需 10 GB）。
- **★ Qwen3.5 9B**：24 GB 显卡能容纳的最强模型。
- **Gemma 4 E4B / E2B**：Google 出品，写作能力出色；E2B 适合 8-10 GB 显卡。
- **Gemma 4 31B**：在 24 GB 显卡上以 4 位 QLoRA 方式训练。
- **Qwen3.5 0.8B / 2B**：小巧快速；0.8B 可以进行完整微调。
- **Qwen3.8 27B**：最新模型，适合 64-80 GB 的 pod。

以上模型均采用 Apache 2.0 许可。Qwen3.5 以 16 位训练：Unsloth 不建议对其使用 4 位。

**视觉模型**：**★ Qwen3.5 4B vision**（12-16 GB）或 **★ Qwen3.5 9B vision**（24 GB）；Gemma 4 E4B / E2B。

**图片**：

- **LoRA** 仍是让模型学会某个人物、风格或物体的最佳方式，适用于任何显卡。新增：**FLUX.2 klein base 4B**（Apache 2.0）。它适合 24 GB 显卡，学习速度快，其 LoRA 可用于快速的蒸馏版 klein 4B。
- **检查点微调**（训练全部权重）需要大显存显卡：
  - Lumina-Image 2.0：24 GB，是 ai-toolkit 自带的示例之一。
  - Flex.1-alpha：48 GB，使用 **parameter swapping**（参数交换）可以更少。
  - FLUX.2 klein 4B 和 SDXL：实验性支持。
- **⧉ Bake** 让你在任何显卡上都能得到新的检查点：先训练 LoRA，再将其烘焙进基础模型。

### 💬 LLM 微调（助手）

1. **⚙ Install Unsloth**（只需一次）。一个队列任务会为 Unsloth 创建独立的 Python 环境，安装适合你显卡的 PyTorch，以及 llama.cpp 的 GGUF 转换器（约 8 GB）。
2. **Job** 选项卡：
   - **Base model** 和 **Method**：LoRA（16 位，合并进模型）、QLoRA（4 位，占用显存更少）或 Full fine-tune（训练全部权重，显存约为 4 倍）。
   - **LoRA rank / alpha**、**epochs** 或 **max steps**、**learning rate**、**batch**、**gradient accumulation**、**max length**（token 数）和 **warm-up**。
   - **System prompt**（助手的身份设定）和 **Model file size**（通常选 Q4_K_M）。
   - **📄 Config** 以 JSON 形式显示 Unsloth 的运行配置；编辑后按 **✎ Use mine**。
3. **Dataset** 选项卡：每个示例都是一段简短的对话。
   - **＋ Example**：输入别人会问的问题以及你想要的回答。**＋ a follow-up turn** 可添加更多轮对话。
   - **⤒ Import…** 可读取：
     - JSONL / JSON：`{"messages": [...]}`、ShareGPT `conversations`、`instruction` / `input` / `output`、`prompt` / `completion`、`question` / `answer`；
     - 带标题行的 CSV。
   - **⤓ chat.jsonl** 保存全部示例。
   - 约 100 个优质示例即可教会一种风格或一项任务；要教会知识则需要几千个示例。
4. **Run & samples**：按 **▶ Start the fine-tune**。队列会显示步数和损失（loss）。训练完成的模型会被合并、转换为 `.gguf`，并放入 LLM 文件夹（`<name>-Q4_K_M.gguf`）；在 Settings ▸ LLM 中选择它即可。

### 👁 视觉微调（图片描述模型）

在 Dataset 选项卡中添加图片，并在每张图片下方写出视觉模型应给出的**回答**。在 Job 选项卡的 **Instruction** 中写下问题，例如 "Caption this for a storyboard."

**✨ Answer the empty ones** 会让你当前的视觉模型先写出初步回答，供你修改。没有回答的图片会被排除在外。

`.gguf` 及其 `mmproj` 投影器会放入视觉文件夹（`llm-models/vision/<name>/`，或在 Settings 中选择的视觉文件夹），Settings ▸ LLM ▸ Vision model 中会列出它们。

### 🧱 检查点微调（图片）

使用与 LoRA 相同的图片和描述，但训练的是模型的全部权重。

- **设置**：使用 adafactor 和较小的学习率，以 diffusers 格式保存。
- **Parameter swapping**（参数交换）每一步只训练部分权重；所需显存少得多，但速度较慢。
- **结果**：保存的文件会合并为一个 `.safetensors`，放入 ComfyUI 的 `diffusion_models/trained`，并附带一张 Model manager 卡片。用 Load Diffusion Model 加载它。

### ⧉ 将 LoRA 烘焙为新的检查点

图片 LoRA 训练完成后，Run 选项卡会提供 **⧉ Bake into a new checkpoint**：

1. 选择该 LoRA 训练时所针对的基础模型（ComfyUI 的检查点和扩散模型；★ = 同一系列）。
2. 设置强度和名称。
3. 按 **⧉ Bake**。

ComfyUI 会完成合并并保存；新文件会连同卡片一起移入 `checkpoints/trained`（或 `diffusion_models/trained`）。烘焙需要使用本机的 ComfyUI，不能使用远程的 ComfyUI。

## LoRA 训练器、峰谷电价、用量日志、Remote GPU、设置中的软件包（2.520.0）
<!-- en: the-lora-trainer-peak-off-peak-prices-the-usage-log-remote-gpu-packages-in-setti 8c3a0bf1b840 -->

### 🎓 LoRA 训练器

状态栏中的 **🎓 LoRA** 按钮用于打开 LoRA 训练器面板。它使用 **ai-toolkit**（由 Ostris 开发）根据你的图片训练 LoRA，许多 LoRA 都是用这个训练器制作的。

1. **⚙ Install ai-toolkit**（只需一次）。一个队列任务会将 ai-toolkit 下载到应用文件夹，创建独立的 Python 环境，并安装适合你显卡的 PyTorch。大小约 10 GB，需要一段时间；可在 Queue 中查看进度。
2. **＋ New job**：为 LoRA 命名。
3. **Job** 选项卡：
   - **Base model**：Z-Image Turbo（最容易上手）、Z-Image、FLUX.1 dev / schnell、Qwen-Image、SDXL、SD 1.5、Chroma 或 Wan 2.1（视频）。每个模型都会注明所需显存，以及你的显卡是否满足要求。
   - **Your own model file**（可选）：填写一个路径，代替从 Hugging Face 下载。
   - **Trigger word**（触发词）：一个自造的词，例如 `t1m_style`。它会被加在每条描述的前面。
   - **Rank / alpha, steps, learning rate, batch, optimizer, sizes**（512 / 768 / 1024…）。
   - **Caption dropout, flip, Low VRAM, quantize**。
   - **Save every / keep**、**samples every** 和 **sample prompts**（`[trigger]` 代表你的触发词）。
   - **📄 YAML** 显示表单生成的 ai-toolkit 配置。编辑后按 **✎ Use my YAML** 即可用你自己的配置训练；**↺ Back to the generated one** 恢复为表单生成的配置。
   - **💾 Save** 保存该任务。
4. **Dataset** 选项卡：通过 **＋ Pictures…**、直接拖入或 **🖼 From the gallery** 添加 10-30 张图片。在每张图片下方写一条描述，或让助手来写：**✨ Caption the empty ones** / **✨ all**（重新编写所有描述）。
5. **Run & samples** 选项卡：按 **▶ Start training**。队列会显示第 N / M 步和损失，样图会在 ai-toolkit 生成时陆续出现。**⏹ Stop** 取消本次运行。

运行完成后，LoRA 会被复制到 ComfyUI 的 `loras/trained` 文件夹，并附带一张 Model manager 卡片（以触发词作为关键词），以最后一张样图作为卡片图片。之后即可在 🧩 Model manager 中选择它。

**⤓ Export job** 会将 config.yaml 连同数据集一起下载为 .zip，以便在更大的机器上训练（例如 RunPod pod 上的 ai-toolkit）。

### 峰时与谷时电价

Settings ▸ General ▸ Energy cost：

- **Peak price per kWh**（峰时每 kWh 电价）和 **＋ Peak times**（峰时时段）：星期（Mon-Sun）加上起止时间。你的电价方案有多少个时段就添加多少个；像 22:00-02:00 这样的时段会跨越午夜。
- **峰时时段以外的每一分钟都属于谷时**，按普通的每 kWh 电价计费。

功率计会将每次读数归为峰时或谷时，因此跨越两者运行的任务会被拆分计算：

- 其 ⚡ 卡片和 `[power]` 日志行会显示：峰时 Wh 按峰时电价计 + 谷时 Wh 按谷时电价计 + 其分摊的每日供电费；
- “⚡ since start”会注明当前是否处于峰时。

### 📊 用量日志

**📊 Usage…**（Settings ▸ General ▸ Energy cost），或点击状态栏中的 ⚡ 数值，会打开用量面板：

- **Ranges**（范围）：今天、7 天、本月、上月、全部，或自定义日期。
- **Totals**（合计）：该范围内的账单（电费 + 供电费 + 远程 GPU）、应用运行期间的耗电（峰时 / 谷时）、任务及其耗电和费用。
- **Days**（按天）：kWh、峰时 / 谷时、任务、小时、电费、供电费、远程、合计。
- **Jobs**（任务）：每个已完成的任务，包括其模式、内容、状态、分钟数、kWh、峰时 kWh、平均功率（瓦）、费用以及运行所用的远程 GPU。
- **⤓ CSV** 下载你当前查看的表格。

日志保存在应用文件夹的 `usage` 文件夹中：每月一个文件。

### Settings ▸ Remote generation

使用另一台机器的显卡进行生成：

- **This computer**（本机，即常规方式）。
- **Another machine's ComfyUI**（另一台机器的 ComfyUI）：其地址（例如 `http://192.168.1.20:8188`，需以 `--listen` 启动）以及每小时的费用（可选）。
- **RunPod**：填入你的 API 密钥（runpod.io ▸ Settings ▸ API Keys）后，会列出你的 pod 及其显卡和价格。启动 / 停止 pod 并选择它；应用会通过 RunPod 的代理使用其 ComfyUI（该端口，默认为 8188，必须以 HTTP 方式公开）。
- **SSH tunnel**：user@host、端口和密钥文件。**▶ Open the tunnel** 会将该机器的 ComfyUI 转发到本机。

**✓ Test** 会向该 ComfyUI 查询其显卡和版本。**Use it** 让应用改用它（此时应用不会启动自己的 ComfyUI）；**Use this computer** 恢复所有设置。

任务所用的模型必须位于那台机器上。功率计只能检测本机，因此用量日志中远程任务的费用为其运行时长 × 每小时价格（RunPod pod 则按其自身价格计算）。

### Settings ▸ Models：🖥 This computer 与软件包

Models 选项卡顶部显示：

- 你的显卡、内存和处理器；
- 已安装的软件包，以及适合本机的软件包；
- 四个软件包，以及每个软件包可使用的功能（✓ ~ ✗，包含在内 / 以后添加）。

**✎ Not right?** 可更正硬件信息，方式与安装程序询问时相同。

**⬆ Upgrade to …** 无需重新运行安装程序即可升级到更大的软件包。它会在后台安装该软件包新增的内容（尚未安装 ComfyUI 时安装 ComfyUI 及其节点包，以及助手、语音、语音转文字），并下载其模型；受限（gated）模型需要使用 Settings ▸ General 中的 Hugging Face 令牌。日志和进度会显示在按钮下方。

### 分组下载

在模型页面（安装程序的最后一步，以及 Settings ▸ Models ▸ Model downloads）中，每个分组都有自己的复选框。它可勾选或取消勾选整个分组，并显示该分组需要获取的文件数量及其大小。部分勾选的分组会显示一条短横线。

## 安装程序询问你的硬件并选择软件包；每日供电费（2.519.0）
<!-- en: setup-asks-for-your-hardware-and-picks-a-package-the-daily-supply-charge-2-519-0 57950bcae746 -->

**安装程序的第一页**显示你的显卡、内存和处理器。如果找不到其中某一项（非 NVIDIA 显卡、Windows 未报告显存的显卡、没有名称的处理器），它会询问你：

- **Graphics card**（显卡）：从列表中选择（NVIDIA RTX 50 / 40 / 30 / 20 系列及工作站显卡、AMD Radeon、Intel Arc、Apple Silicon、“No graphics card”，或选择“Another card”并填写其名称和显存）。
- **System memory (RAM)** 和 **Processor (CPU)**。

Windows 的任务管理器 ▸ 性能（Task Manager ▸ Performance）会显示这三项信息。如果安装程序检测到了硬件但检测有误，**Not right? Tell setup your hardware** 会打开同一个表单。

**Your package**（安装程序的第二页）提供四个软件包，并已选中适合你电脑的那一个：

| 软件包 | 适用于 | 安装内容 |
|---|---|---|
| Editor | 任何电脑 | 完整的视频和图像编辑器、CAD 与 3D 草图、声音与交付——不含 ComfyUI，不含模型 |
| Editor + small AI | 6-12 GB 显卡 | + ComfyUI、Anima 和 SDXL 图片、背景移除、语音转文字、语音、一个小型助手 |
| Editor + mid-size AI | 12-20 GB | + Krea 2 / FLUX 3 Klein 图片、Kontext 和 Qwen Image 2.1 编辑、较小尺寸的 MiniMax H3、歌曲、放大 |
| Everything | 20 GB+ | 全尺寸的完整工作室 |

在软件包下方，**What you'll be able to use** 会列出所选软件包的每项功能：

- ✓ 运行良好；~ 可以运行，但速度较慢或尺寸较小；✗ 本机无法使用，并说明原因（例如 "needs about 14 GB of VRAM (this card has 12)"）。
- **in this package**（包含在此软件包中）/ **add later**（以后添加；可随时在 Settings ▸ Models 中添加）。
- 编辑功能在所有电脑上都可使用。AI 功能的显存需求为估计值。

Install 按钮上会显示软件包名称和下载大小。如果软件包超出了你的电脑能流畅运行的范围，按钮会显示 **Install anyway**。Editor 软件包不安装 ComfyUI 和任何模型，安装完成后直接打开工作室。

在终端中：`node scripts/setup-cli.js --packages` 会打印相同的列表，而 `--package editor|light|standard|full` 加上 `--gpu ID --vram GB --ram GB --cpu "NAME"` 会安装对应的软件包。

**Daily supply charge**（每日供电费，位于 Settings ▸ General ▸ Energy cost）：电费账单上每天固定收取的金额。任务的费用会按其运行时长加上相应的分摊额（30 分钟的任务分摊一天费用的 1/48）：

- 任务的 ⚡ 卡片显示总额（例如“⚡ 125 Wh · $0.06”）；
- 其工具提示和 `[power]` 行会将总额拆分为电费和供电费；
- “⚡ since start”会加上自应用启动以来的分摊额。

## 队列预设、Model manager、Civitai 下载、电费、Testing 面板（2.518.0）
<!-- en: queue-presets-the-model-manager-civitai-downloads-energy-cost-the-testing-docker c7a28a024b1e -->

**⏱ Queue presets**（队列预设，位于菜单栏中项目按钮旁边）用于设置任务队列的运行方式：

| 预设 | 功率限制 | 任务间休息 | 显卡过热时等待 |
|---|---|---|---|
| Normal | 显卡自身的设置 | 无 | 从不 |
| Quiet (overnight) | 70 % | 20 s | 从 80 °C 起，直到降至 70 °C |
| Eco | 60 % | 10 s | 从 78 °C 起，直到降至 68 °C |
| Cool-down between jobs | 显卡自身的设置 | 60 s | 从 75 °C 起，直到降至 65 °C |
| Max performance | 100 %（恢复默认值） | 无 | 从 90 °C 起，直到降至 80 °C |
| Custom | 你设定的四个数值（在 ⓘ 中设置） | | |

- **ⓘ** 会说明该预设的作用、功率限制是否已设置成功、正在暂缓的任务（"rest between jobs: 12 s left"）以及警告（"GPU 0 is 86 °C"、"probably throttling"）。
- 下拉菜单旁的徽标在有任务被暂缓时显示 ⏸，有警告时显示 ⚠。
- 设置功率限制需要以管理员身份（Windows）或使用 sudo（Linux）运行应用，且在电脑重启前一直有效。没有相应权限时会给出提示，预设的其余部分仍然有效。选择 Normal 会恢复显卡的默认功率限制。
- 暂缓结束后启动的任务会在日志中注明：`[queue] waited 20 s - …`。因过热而暂缓的等待在 20 分钟后会放弃，因此即使传感器卡住，队列也不会永远停止。
- 编译（仅使用 ffmpeg）从不等待。

**🧩 Model manager**（状态栏中的 🧩 Models）是一个浮动面板：可以让它浮动，也可以停靠在其他面板旁边或内部。

- **选项卡**：Models（ComfyUI 的 checkpoints 和 diffusion_models 文件夹，包括 extra_model_paths.yaml 中的文件夹）、LoRAs、Civitai、📁 Model paths（2.580.0，见下文）。
- **筛选**：搜索（名称、类型、关键词）、类别、类型、排序（A-Z、最新、评分、大小）。⟳ 会重新读取文件夹。
- **卡片**显示缩略图、名称、★ 评分、发布日期、模型类型（SDXL、Pony、Illustrious、Flux、Qwen、Krea、Anima、Wan、LTX …）和类别（图片、图片编辑、视频、音乐）。LoRA 卡片还会显示其关键词；点击某个关键词即可将其加入提示词。
- **将指针悬停在卡片上**，旁边会显示其说明卡片：说明、基础模型、cfg、步数、采样器、VAE、文本编码器、关键词、大小和文件。指针离开时说明卡片关闭。
- **卡片详情的来源**（后面的来源优先）：
  1. 文件本身：其名称、所在文件夹、safetensors 文件头或 GGUF 文件头；
  2. 其他工具留在模型旁边的文件（`<name>.civitai.info`、`<name>.metadata.json`）；
  3. `<name>.bitgen.json`：Civitai 返回的信息以及你自己的编辑。

  缩略图是模型旁边的 `<name>.preview.png` / `.jpg` / `.webp`。
- **卡片上的 ✎** 用于编辑卡片：名称、你的评分、类型、类别、cfg、步数、VAE、文本编码器、关键词、发布日期和说明。这些内容会保存在模型旁边。
- **卡片上的 🔍** 会按 SHA-256 在 Civitai 上查找该文件。文件只读取一次，哈希值会被保存下来。
- **选择**：点击模型卡片选择该模型，点击 LoRA 卡片添加或移除 LoRA（每个 LoRA 都有权重）。
- **☐ Override the style's model + LoRAs**：勾选后，Basic Settings 会使用所选内容进行渲染。这会打开 Override style，将检查点覆盖设为该模型，把这些 LoRA 添加为临时 LoRA，并使用卡片中的步数和 cfg。取消勾选后，一切恢复原状。
- **✚ New style from it**：用所选模型和 LoRA 创建新风格。会复制用于渲染该类型的风格（包括其工作流、文本编码器、VAE、采样器和负面提示词），或复制你选择的其他风格；然后用该模型、这些 LoRA 以及卡片中的 cfg、步数、VAE 和文本编码器替换相应内容。视频模型会生成视频风格，模型位于其第一个采样器阶段。
- **已安装但未在 Settings 中设置的 ComfyUI**（2.622.0）：当 Settings ▸ ComfyUI ▸ Folder 为空时，bitGen 会在本机上查找 ComfyUI——$COMFYUI_PATH、bitGen Studio 旁边、你的主文件夹（ComfyUI、便携版、Documents、Desktop、Downloads）、Pinokio、Stability Matrix、每个驱动器的根目录、ComfyUI Desktop——找到后，其 **checkpoints** 和 **diffusion models**（以及 unet）会填入 Model manager、Basic Settings 的检查点列表以及视频的 Model 列表。状态行会显示找到的位置；Settings ▸ ComfyUI ▸ Folder 中会显示该位置，并提供 **Use this folder** 按钮以永久设置。

**Civitai**（Settings ▸ General ▸ Civitai，然后使用 Model manager 的 Civitai 选项卡）：

- 粘贴你的 API 密钥（civitai.com ▸ Account settings ▸ API Keys），然后点击 **Test key**。
- 选择 **civitai.red**（你账户的内容级别所允许的全部内容）或 **civitai.com**（仅限适合工作场合的内容）。**Mature results** 会在账户允许的范围内加入成人向的结果和图片。
- 按关键词、类型、排序方式和基础模型进行**搜索**，然后点击某个结果查看其各个版本。文件上的 **⤓** 会将其直接下载到正确的 ComfyUI 文件夹：

  | Civitai 类型 | 文件夹 |
  |---|---|
  | Checkpoint | checkpoints（GGUF，或内部不含 VAE / 文本编码器的文件 → diffusion_models） |
  | LoRA / LoCon / DoRA | loras |
  | VAE | vae |
  | Embedding | embeddings |
  | ControlNet | controlnet |
  | Upscaler | upscale_models |

  你输入的子文件夹会被保留。无需手动移动文件，也不会弹出 Save As（另存为）对话框。其卡片（图片、基础模型、关键词、示例图片的 cfg 和步数）会写在文件旁边。已经存在的相同文件不会重复下载。
- 密钥保存在 `custom.settings` 中，只会发送给 Civitai。

**Energy cost**（电费，位于 Settings ▸ General）：你的每 kWh 电价和货币。设置后，每个已完成任务的 ⚡ 卡片、其 `[power]` 行以及 System stats 中的“⚡ since start”都会显示相应费用（例如“⚡ 125 Wh · $0.04”）。

**🧪 Testing**（Settings ▸ General ▸ 🧪 Testing…）会打开一个浮动面板，按发布版本逐一列出此版本需要进行的测试。

- **auto** 项目会在应用检测到其正常工作时自动勾选：例如该风格的任务已完成、nvidia-smi 有响应、Civitai 下载的文件已进入 loras 等。
- 其他项目带有 ✓（可用）、✗（不可用）和 –（未测试）按钮，每个项目都可以添加备注。
- **💾 Save log** 会下载 `bitgen-test-log-<version>-<date>.txt`。其中包含电脑信息、每个项目及其判定方式、你的备注、失败任务的最后几行日志，以及相同内容的 JSON 版本。请将该文件上传给 Claude。
- 勾选状态和备注保存在 `custom.settings` 中，**↺ Clear** 可从头开始。

## 功耗与时钟频率、任务所用的电能；Anima 图片风格（2.517.0）
<!-- en: power-draw-and-clock-speeds-the-energy-a-job-used-anima-image-styles-2-517-0 d199bb5f26a6 -->

**System stats**（系统状态，位于左侧面板区）：

- **每块显卡的区块**中新增了两个图表：
  - **Power**：显卡的功耗（瓦），刻度从 0 到其功率限制。
  - **Clock**：显卡的核心频率，刻度从 0 到其最高频率，旁边显示显存频率。
  - 区块标题中会加上瓦数和 GHz。
- **CPU clock**：处理器当前的频率。
  - 在 Windows 上，该数据来自性能计数器，因此会随加速和空闲状态变化。
  - 在 Linux 上，该数据直接来自各个核心。
- **CPU power**：仅在电脑报告该数据时显示。Linux 通常会报告（RAPL，应用可读取）；Windows 不借助驱动程序则无法读取。
- **⚡ since start**：自应用启动以来消耗的电能。

显卡读数来自 nvidia-smi，它会持续运行并每秒报告一次。

**任务所用的电能。** 任务结束时，应用会计算从任务开始到结束所消耗的电能。它会记录：

- 以 Wh 或 kWh 计的总量：显卡耗电，加上可读取时的 CPU 耗电；
- 平均功率和峰值功率（瓦）；
- 任务的运行时长。

这些信息会显示在三个位置：

- 任务日志末尾的 **[power]** 行；
- 队列 Done 选项卡中任务卡片上的 **⚡ … Wh**（其工具提示中有详细信息）；
- 项目的任务列表，因此重启后仍然保留。

该数值涵盖任务运行期间整块显卡和 CPU 的耗电，因此在此期间使用它们的其他程序也会被计算在内。没有 nvidia-smi 的电脑只计算 CPU 的耗电（前提是 CPU 数据可以读取）。

**Anima 图片风格**（位于图片风格列表中）：CircleStone Labs 推出的 2B 动漫与插画模型，通过 ComfyUI 运行。

- **Anima** 使用 Aesthetic v1.1，建议从它开始。
- **Anima base** 使用 Base v1.0。
- 两者都使用 er_sde 运行 30 步、cfg 4，并附带模型卡片中给出的负面提示词。

文件存放位置：

| 文件 | 文件夹 |
|---|---|
| `anima-aesthetic-v1.1.safetensors` / `anima-base-v1.0.safetensors` | `models/diffusion_models` |
| `qwen_3_06b_base.safetensors`（文本编码器） | `models/text_encoders` |
| `qwen_image_vae.safetensors` | `models/vae` |

这些文件都来自 circlestone-labs/Anima，模型安装程序中会列出它们。

提示词写法：

- 提示词以 `masterpiece, best quality, score_7, safe, ` 开头。
- 使用 Danbooru 标签、普通词语或两者混用均可。
- 约 1 MP 的尺寸效果最好：1024 × 1024、832 × 1216 等。
- 模型和 LoRA 的许可证仅限非商业用途，但用它生成的图片可以用于商业用途。

## 任何设置都可添加关键帧；Krea 2 图片风格（2.516.0）
<!-- en: keyframes-on-any-setting-krea-2-image-styles-2-516-0 fb6699a8323d -->

**◇ 任何设置都可添加关键帧。** 时间线 Properties 中片段的各项设置，以及 🎨 Colour 对话框中的设置，旁边现在都有一个小小的 **◇**。

1. 将播放头移到变化开始的位置，设置数值，然后点击 **◇**。它会变成 **◆**：表示该时刻的一个关键帧。
2. 移动播放头并更改该设置。这会自动生成第二个关键帧，因为一旦某个设置有了关键帧，对它的任何更改都会在播放头所在位置记录为关键帧。
3. 已添加关键帧的设置带有橙色边框，并显示其在播放头处的数值。点击 **◆** 删除播放头处的关键帧，或按 **Alt+click** 删除该设置的所有关键帧。

可以用这种方式添加关键帧的设置：

- **Colour**：曝光、对比度、饱和度、色温、色调、色相、LUT 混合，以及 🎨 Colour 对话框中色轮的亮度和 HSL 范围。
- **Effects**：镜头、扭曲的强度、大小和速度，以及抠像器的匹配、边缘和溢色。
- **✒ Masks**：羽化、扩展和不透明度。蒙版的形状和以前一样，使用其自身的 ◇ 添加关键帧。
- **Text**：大小和描边。
- **⏱ Time**：快门、采样数、色调分离，以及回声的副本数、间隔、起始和淡出。

位置、缩放、旋转、不透明度、模糊、锐化、发光、暗角、颗粒、裁剪、生成器、光线、扭曲、形状、文本动画器和 3D 之前就已经可以添加关键帧。每个已添加关键帧的设置都会列在 **📈 Graph Editor** 中，并附带其数值曲线和速度曲线、缓动以及贝塞尔手柄。

⚙ Compile 对各类关键帧的处理方式：

- **颜色**关键帧：在关键帧之间每四分之一秒重新生成一次调色效果，并在各效果之间交叉淡化。
- **镜头、扭曲和抠像器**关键帧由编译过程本身生成动画，适用于 V1 和视频图层。
- **蒙版**关键帧会写入蒙版的视频中。
- 带有关键帧设置的**图片或文本图层**，以及**带有时间效果关键帧的视频图层**，由应用逐帧渲染。
- 尚未支持：调整图层，以及色轮的颜色（色点），因为它不是数值框。

**Krea 2 图片风格**（位于图片风格列表中）。这些风格需要支持 Krea 2 的 ComfyUI（0.26 或更高版本）：

- **Krea 2 Turbo**：8 步，cfg 1。
- **Krea 2 Raw**：完整模型，52 步，cfg 3.5，带负面提示词。
- **Krea 2 Turbo GGUF** 和 **Krea 2 Raw GGUF**：与上面相同，但使用 GGUF 文件。

如果它们从列表中消失了（2.547.0）：下次启动 bitGen 时，它们会自动恢复一次。对于其他丢失的内置风格：Settings ▸ Image styles（或 Video styles）▸ **↺ Built-in** 会列出缺失的内置风格，经你确认后将其恢复。你自己的风格和你编辑过的风格永远不会被改动。

文件存放位置：

| 文件 | 文件夹 |
|---|---|
| `krea2_turbo_fp8_scaled.safetensors` / `krea2_raw_fp8_scaled.safetensors`（Comfy-Org/Krea-2） | `models/diffusion_models` |
| `krea2_turbo-Q5_K_M.gguf` / `krea2_raw-Q5_K_M.gguf`（vantagewithai 的 Krea-2-Turbo-GGUF / Krea-2-Raw-GGUF） | `models/unet` |
| `qwen3vl_4b_fp8_scaled.safetensors`（文本编码器） | `models/text_encoders` |
| `qwen_image_vae.safetensors`（VAE） | `models/vae` |

注意事项：

- 模型安装程序会列出每个文件及其下载地址。
- 任何 GGUF 量化版本均可使用；将风格的 **Model** 设为你拥有的文件即可。Q8_0 为 13.7 GB，Q6_K 为 10.6 GB，Q5_K_M 为 8.9 GB（适合 12 GB 显卡），Q4_K_M 为 7.5 GB。
- GGUF 风格需要支持 Krea 2 的 ComfyUI-GGUF 自定义节点版本。如果 ComfyUI 提示 *Unexpected architecture type*，请更新 ComfyUI-GGUF；如果仍无法解决，请使用支持 Krea 2 的分支（molbal/ComfyUI-GGUF）。
- Krea 的风格 LoRA（`krea2_*.safetensors`）可以放在风格的 LoRA 槽中，Turbo 和 Raw 均可使用。

## 抠出主体、解算摄像机、移除物体；对话框的主题编辑模式（2.515.0）
<!-- en: cut-out-a-subject-solve-the-camera-remove-an-object-theme-edit-mode-for-dialogs- 3ec1091d835f -->

时间线上视频片段的 Properties 中新增了三个部分，适用于 V1 或视频图层：**🧍 Cut out**、**📷 3D camera track** 和 **🩹 Remove**。每个部分都会在后台处理片段的整个时长，并显示进度行和 **■ Stop** 按钮。

**🧍 Cut out：在整个镜头中跟踪主体**

1. 选择片段，转到主体清晰可见的那一帧。
2. 按 **✚ Subject**，然后在画面上点击主体。按 **✖ Not it**，然后点击主体旁边不属于主体的任何东西。或者按 **▭ Box**，围绕主体拖出一个框。点击某个标记可将其删除。
3. 如果在其他帧抠图出错，将播放头移到那一帧并添加标记。每一帧都会参照离它最近的带标记的帧。
4. 选择跟踪主体的方式：
   - **Auto** 使用已安装的方式中最好的一种。
   - **SAM 2**（Segment Anything 2）效果最好。**⬇ SAM 2** 会将其安装到 AI matte 的 venv 中：包括 torch、sam2 包及其检查点，约 1–3 GB。
   - **AI matte**（BiRefNet）使用与 Select ▸ Subject 相同的安装。
   - **Built in** 使用 OpenCV，无需安装任何东西。
5. **Refine edge**（优化边缘）：
   - **snap** 让边缘贴合画面本身的边缘（头发、毛发）。
   - **feather** 柔化边缘。
   - **choke** 收缩边缘（使用负数则扩展边缘）。
   - **smooth** 防止边缘逐帧闪烁。
6. 按 **▶ Cut out**。结果会以 `cut_<clip>_….webm` 保存在项目的视频中，带有主体的透明边缘和片段原有的声音。

在视频图层上，勾选 **use it** 会让图层在主体周围变为透明，在画布上和 ⚙ Compile 中均如此。在 V1 上，该复选框只显示预览，因为 V1 下方没有任何内容。抠出的主体也正是 **🩹 Remove** 要移除的内容，以及 **📷 3D camera track** 要排除的内容。

**🩹 Remove：视频的内容识别填充**

1. 选择要移除的内容：**🧍 the cut-out**（抠出的主体），或在视频图层上选择 **✒ the masks**（蒙版，用 Mask Pen 绘制；蒙版可以移动）。
2. 设置选项：
   - **grow**：扩大空洞，把边缘或阴影也一并去除。
   - **feather**：衔接处的柔和程度。
   - **look**：向前和向后搜索多少秒。
   - **Auto** 用周围的帧来填充空洞，并与当前帧对齐。它只为镜头中从未出现过的部分进行绘制，并让该部分保持静止。**Paint in only** 速度更快，但可能会闪烁。
3. **Reference**（参考图，可选）：一帧你自己填充好的画面。**✎ Paint one** 会在图像编辑器中打开播放头处的帧，空洞部分为透明。用 Generative Fill 或 Clone Stamp 填充它，按 **Ctrl+S** 将其保存到项目的 Images 中，然后在这里选择它。
4. 按 **▶ Remove**。片段现在会播放 `<clip>_fill….mp4`（webm 片段则为 `.webm`）。它与原片段的时长和时间点完全相同，并带有声音。**↺ Original** 让片段恢复使用其原始文件。

**📷 3D camera track：将图层放入拍摄的场景**

1. 选择摄像机的运动方式：**Auto**、**Moving camera** 或 **Tripod**（只转动）。将镜头保留为 **0** 可自动计算，或输入其水平视角（度）。勾选 **leave out the cut-out**，这样自行运动的人或汽车就不会被用于解算。
2. 按 **▶ Solve**。进度行会显示已解算的帧数、镜头、以像素计的误差以及找到的点数。这些点会绘制在画面上；解算效果良好时，播放过程中它们会牢牢贴在场景上。
3. **📷 Pick**：点击点（按住 Shift 可添加更多点），或围绕它们拖出一个框。
4. 选择一个图层（或 **＋ New text**），然后选择 **flat on them**（平铺在点上）、**standing on them**（立在点上）或 **facing the camera**（面向摄像机），并设置大小（占该位置处画面宽度的比例）。按 **📌 Place**。该图层会变成场景中的一张 🧊 3D 卡片。
5. **🎥 Drive the 3D camera** 会根据解算结果在每一帧为 3D 摄像机设置关键帧：位置、朝向、缩放以及新增的 **roll**（滚转）。📌 Place 会自动执行此操作，因此每张 3D 卡片都能与镜头吻合。被跟踪的片段应横向填满画面并居中，就像 V1 那样。

**对话框的主题编辑模式**

- **Ctrl+Shift+Alt+E** 会开启包含对话框在内的主题编辑模式。已打开的对话框（例如 Settings）会保持打开，其按钮、标签和输入框可以像应用的其他部分一样被选中并设置样式。Style 面板、轮廓和手柄会显示在对话框内部。按 Esc 只会关闭 Style 面板，从不关闭对话框。
- 在主题编辑模式下（无论以哪种方式进入）按 **Ctrl+S**，会将主题保存到 `themes/<name>.json` 并退出编辑模式。尚未命名的主题会要求你输入名称。
- 再次按 Ctrl+Shift+Alt+E 即可退出；如有更改，会像往常一样弹出确认框。

## 编辑主题模式：每个按钮及其文字（2.623.0）
<!-- en: edit-theme-mode-every-button-and-its-words-2-623-0 4629507da8bb -->

在编辑主题模式（🖌）下，每个面板、窗格和按钮都可以选中并修改其文字：
- **双击任意文字**——按钮、面板标题、标签页、标签、标题、提示——其上方会打开一个输入框：输入新文字后按 Enter（框留空 = 恢复其原有文字），或按 Esc 保持不变。按钮会保留其图标，面板标题会保留其 ▾ 和按钮。
- **下拉框**：点击其中一个，Style 面板会列出它的 **Options**（选项）——可以重命名其中任意一项（其功能保持不变）。
- **Placeholder and Tooltip**（占位文字和工具提示）：在 Style 面板中可修改空输入框中显示的文字，以及指针停留在任意元素上时显示的帮助。
- **浮动工具窗格**（时间线的舞台窗格、DLSS 5、SeedVR2、语音聊天）可以像面板一样被选中并设置样式。
- **Shift+click**（或 **Alt+click**）会把这次点击交给应用本身——按钮执行其功能，折叠的分区、标签页、面板或菜单会打开——且不会退出编辑主题模式，因此其内部的部件也能触及并编辑。所有这些都会随主题一起保存（💾 Save theme），↺ Clear element styles 会恢复所有文字。

## 编辑主题模式：调整大小、移动、隐藏、重命名；退出即保存；折叠面板（2.514.0）
<!-- en: edit-theme-mode-resize-move-hide-rename-leaving-saves-folding-dockers-2-514-0 9bace33e05f0 -->

**编辑主题模式（🖌）现在可以修改布局。** 像以前一样选中一个元素，然后：

- 用其轮廓周围的八个控点**调整大小**。拖动左侧和顶部控点时，对边保持不动。
- 在元素内部拖动即可**移动**它。Style 面板的 **Layout**（布局）分区会以 **Δx / Δy** 显示移动量。
- 在 Layout 分区中输入精确的 **Width / Height**（宽度 / 高度，4 到 4000 px）。
- **隐藏**它。在编辑模式下，隐藏的元素会以淡色加虚线轮廓显示，以便再次选中；退出编辑模式后它就不再显示。
- **Hidden in Expert mode**（在专家模式下隐藏，2.544.0）：当 Settings ▸ General ▸ Expert mode 开启时该元素不显示，在 Basic 模式下显示。在开启 Expert mode 的编辑模式下，它会以淡色加蓝色虚线轮廓显示，以便再次选中。
- **Text**（文字）：修改标签或纯文本按钮的文字。
- **↺ Layout** 会恢复大小、移动、隐藏和文字。

**修改会随时保留。** 每次修改都会写入 `themes/<theme name>.tmp`。如果应用在保存前关闭，下次进入编辑模式时会弹出一个对话框，提供 **Bring them back**（恢复修改）或 **Throw them away**（丢弃修改）。

有修改时**退出编辑模式**（🖌 或 Esc）会打开一个对话框：

- **💾 Save theme "<name>"**：保存到 `themes/<name>.json`。尚未命名的主题会要求输入名称。
- **Save theme as…**：以新名称保存，该名称成为当前主题。
- **↺ Reset theme**：恢复到进入编辑模式时的主题状态。
- **Not now**：退出编辑模式，修改保持显示但不保存。`.tmp` 会保留这些修改。
- **Cancel**：留在编辑模式。

**折叠侧边面板。** 每个侧边面板的标题栏左侧都有一个 **▾**。点击它可将面板折叠成一条保留标题的窄条，为窗口其余部分腾出更多空间。点击 **▸** 可重新展开。应用会记住哪些面板已折叠。

**图像编辑器的面板。**

- 每组标签页（Layers、Properties、History …）都以 **▾** 开头。点击它可将该组折叠为只显示标签页，点击某个标签页即可重新展开。
- 每组的 **✕** 用于关闭该组。
- 图像编辑器菜单中的 **View ▸ Dockers** 会列出所有图像编辑器面板，并带勾选标记。点击其中一项可显示或隐藏它，或使用 **All Dockers** 恢复全部面板。
- 浮动面板窗口上的 ✕ 现在可以正常使用了。此前它被用于调整窗口大小的角落遮住了。

## Load UE project，时间线的画幅尺寸栏（2.513.0）
<!-- en: load-ue-project-the-timeline-s-frame-size-bar-2-513-0 b3689d0759d6 -->

**在哪里打开 Unreal 项目。** 一如既往，在 **Unreal** 中打开。bitGen 通过 bitGen Bridge 插件连接到 Unreal Editor，而 Unreal 必须已打开该项目，连接才能工作。

**🎮 Load UE project**（加载 UE 项目，位于菜单栏中 📦 之后）：

1. 文件夹对话框打开。选择你的 Unreal 项目文件夹（包含 `YourProject.uproject` 的那个），然后按 **Select**。
2. 之后 bitGen 会自动完成其余工作：
   - 将 bitGen Bridge 插件放入 `<project>\Plugins\bitGenBridge`，或更新旧版本。
   - 在 `.uproject` 中启用桥接所需的插件：Python Editor Script Plugin、Editor Scripting Utilities、Sequencer Scripting、Movie Render Queue 和 bitGen Bridge。原文件会保留为 `.uproject.bitgen-bak`。
   - 如果 Unreal 已打开该项目，则将其关闭。Unreal 会先询问是否保存，请作答。
   - 用该项目重新启动 Unreal。随后 Unreal 的 Output Log 会显示 `[bitGen Bridge] listening`。
3. **Unreal project** 对话框会列出每个步骤。它还会显示项目的状态：插件版本、已启用的插件、Unreal 是否已打开，以及编辑器所在的位置。

该对话框还包含：

- **⟳ Restart Unreal**：仅用该项目重启 Unreal，不改动插件或 `.uproject`。
- **Test connection**：检查 bitGen 是否已与 Unreal 连接。
- **Also close other Unreal windows**：如果另一个项目占用了桥接端口，请勾选此项。
- 你以前使用过的项目。
- 如果在你的 Epic Games 安装中找不到编辑器，会出现一个字段，可输入 `UnrealEditor.exe` 的路径。

**时间线的菜单栏**（位于 Timeline 面板顶部）用于设置**画幅**：即时间线的制作尺寸。它作用于画布、烘焙和 ⚙ Compile。

- **width × height**：输入尺寸。
- **Preset**（预设）：
  - **Auto** 即 V1 视频自身的尺寸，与以前相同。
  - 或选择一个尺寸：4K、QHD、Full HD、HD、SD、竖屏尺寸（Reels、Shorts、TikTok）、方形、4:5、21:9、电影 2.39:1、DCI 2K 或 4:3。
- **Aspect**（宽高比）：Free、16:9、9:16、1:1、4:5、4:3、3:2、2:3、21:9、2.39:1 或 1.85:1。输入时会保持宽高比：输入新宽度会自动算出高度，输入新高度会自动算出宽度。
- **CAD toolbar**：显示或隐藏预览上方的 Create / 3D / Sketch / Solid 工具栏。

当画幅不是 V1 视频的尺寸时，V1 会按自身宽高比适配到画幅内，在黑底上居中。画布会这样显示，编译也会以同样的方式生成。

**CAD 按钮已隐藏。** 在时间线中，请改用菜单栏的 **CAD toolbar** 复选框。在图像编辑器中，请使用 **Window ▸ CAD Toolbar**。选中草图或 3D 实体时，它仍会自动显示。

## Lottie（JSON）导出（2.512.0）
<!-- en: lottie-json-export-2-512-0 28d880634999 -->

**📤 Export → ⤓ Lottie (JSON)** 会将时间线的图片图层和文字图层转换为 Lottie 动画：一种适用于网页、应用和任何 Lottie 播放器的 JSON 文件。它会以 `<project>_lottie.json` 保存在影片旁边，📤 Export 会将其列出供下载。

- **真正的动画图层。** 只做移动、缩放、旋转或淡入淡出的图层会保持为动画图层，其中包含它的图片。它的 ◆ 关键帧会保留缓动：线性、缓入、缓出、缓入缓出、自定义曲线或定格。它的混合模式和图层的不透明度也会保留。文字以其图片形式导出。
- **逐帧。** 由应用自行绘制的图层会以逐帧形式导出：每帧一张图片，重复的帧共用。这包括蒙版、效果和外观、生成器和粒子、变形、3D、父级、表达式、设置了关键帧的文字颜色、入场或出场转场，以及弯曲的运动路径。
- **省略的内容。** 视频图层、基础视频和轨道遮罩会被省略，因为 Lottie 不支持视频。提示消息会列出省略了哪些内容。

导出结果已在标准 Lottie 播放器 lottie-web 中播放检验。在所有测试的时刻，它绘制的画面都与时间线一致。

## 可变蒙版羽化、数据驱动动画和模板字段（2.511.0）
<!-- en: variable-mask-feather-data-driven-animation-and-template-fields-2-511-0 ef0c7604484c -->

**✒ Variable mask feather（可变蒙版羽化）。** 在闭合蒙版上使用 ✒ Mask Pen 时，**Shift+drag 一个点**。该点会获得自己的羽化值，大小等于你拖动的距离，并以虚线圆环显示。边缘按其上最近位置的羽化值柔化：沿边缘的每一段，羽化值从一个点的值平滑过渡到下一个点的值。没有单独羽化值的点沿用蒙版的羽化值。动画蒙版路径的各点羽化值也会在关键帧之间平滑过渡。蒙版行中的 **variable feather ✕** 会将所有点恢复为蒙版的羽化值。编译结果与画布一致，包括视频图层的蒙版视频。

**📋 Data（数据）。** 在任意图层 Properties 的 **📋 Data & fields** 下，使用 **⤓ Import CSV / JSON**：

- **CSV**（逗号、分号或制表符分隔；支持带引号的值）将第一行用作列名。
- **JSON** 文件可以是记录列表、包含一条记录的对象，或按列排列的值。

该文件会成为一个命名的**数据集**，随时间线一起保存。每个数据集都有一个当前**行**；切换行后，所有读取它的内容都会随之改变。

- **在文字中**：`{{sales.region}}` 显示当前行的 region，`{{sales.region.3}}` 显示第 3 行的。数据中没有的名称会按原样保留。编译时，文字图片会带上这些值。
- **在 ƒx 中**：`data("sales", "amount")` 以数字形式给出当前行的 amount，`data("sales", "amount", 3)` 给出第 3 行的。例如，`data("sales", "amount", floor(t) + 1)` 会逐行步进，每秒一行。
- **📋 Data → keys**：选择数据集、一列和一个属性（opacity、scale、x、y、turn），然后设置 **s per row**（每行秒数）、行范围 **from … to**，以及 **x**（系数）**+**（偏移）。**📋 Make keys** 会每隔若干秒为一行设置一个关键帧，适用于条形图、计数器等。

**📋 Template fields（模板字段）。** 用标签公开图层的属性：文字颜色、不透明度、缩放、x、y 或旋转。时间线上所有公开的字段都会列在 **exposed on this timeline** 下，因此可以在一处统一修改。由这些图层保存的 🧩 模板在被拖入时，会以颜色和数字的形式提供这些字段。已设置关键帧的属性，其关键帧会按修改量整体偏移。

## 3D 中的 2D 图层：卡片、移动摄像机、景深、阴影（2.510.0）
<!-- en: 2d-layers-in-3d-cards-a-moving-camera-depth-of-field-shadows-2-510-0 6adfb8dd5e58 -->

**🧊 3D layer（3D 图层）。** 在图层的 Properties 中（图片、文字、形状、生成器或视频图层），勾选 **🧊 3D layer**。该图层会变成 3D 空间中的一张卡片：

- **x / y**：图层通常的移动。
- **depth z**（深度 z）：单位为像素。数值越大越远。
- **x turn °** 和 **y turn °**：向后倾斜或左右转动。它通常的旋转即绕 z 轴的旋转。
- **casts shadows**（投射阴影）和 **accepts shadows**（接受阴影）。

深度和两个旋转都可以设置关键帧（◇）。

**🎥 3D camera（3D 摄像机）。** 所有 3D 图层都通过同一台摄像机观看，可在任意 3D 图层的 Properties 中设置：

- **position x / y / z**（位置）。
- **aim at x / y / z**（瞄准点）。
- **zoom**：摄像机的镜头。当摄像机位于 z = −zoom 时，位于 z 0 的卡片恰好是其 2D 尺寸，因此勾选 3D 后，在你移动任何东西之前画面都不会变化。

每个数值都可以在播放头处设置关键帧（◇）。一旦某个数值有了关键帧，修改它就会生成关键帧，摄像机会在关键帧之间平滑移动。**reset** 会将摄像机恢复为正视前方。

**🧊 Orbit（环绕）**（Shift+O）在画布上移动摄像机：

- **拖动**：绕瞄准点环绕。
- **Shift+drag**：推近或拉远。
- **Alt+drag**：平移（摄像机及其瞄准点一起移动）。

**景深。** 勾选 **depth of field**（景深），然后设置 **focus**（对焦）距离和 **aperture**（光圈）。位于对焦距离处的卡片是清晰的。与对焦距离相差一个对焦距离的卡片，会按光圈值（像素）模糊。

**阴影。** 勾选 **light (shadows)**（灯光/阴影），并放置灯光（**x / y / z**）。投射阴影的卡片会把其图片的形状投到身后接受阴影的卡片上。视频图层投射的是其边框的形状。设置 **darkness %**（暗度）和 **softness px**（柔和度）。

**叠放与编译。** 卡片按图层顺序叠放，与时间线的 2D 图层相同，因此请把较远的卡片放在较低的位置。3D 图片图层由页面逐帧渲染。3D 视频图层会整体烘焙，并保留声音。当摄像机、灯光或其他卡片发生变化时，它们会重新渲染，因此结果与画布一致。

## 运动草图、摆动器和平滑器（2.509.0）
<!-- en: motion-sketch-the-wiggler-and-the-smoother-2-509-0 45fa4c2e3a2b -->

这三项都位于图片、文字、形状、生成器或视频图层 Properties 的 **〰 Motion** 下。每一项都会生成普通关键帧，之后可以在图表编辑器中编辑。

**✍ Motion sketch（运动草图）。** 选中一个图层，并将播放头放在动作开始的位置。

1. 按 **✍ Sketch**，或选择 ✍ 工具（**Shift+K**）。
2. 在画布上按下并移动指针。时间线从播放头开始播放，图层跟随指针移动。它从原来的位置出发，因此不会跳到指针处。
3. 松开即停止。到达图层末尾时草图也会停止。

路径会变成位置关键帧。它经过的已有关键帧会被替换。

- **speed %**（速度）：绘制草图时时间线的播放速度。100 为实时。数值越低，你就有越多时间做出细致的动作；回放时会更快。
- **smooth px**（平滑）：只保留使路径变化超过该值的关键帧。数值越高，关键帧越少，路径越平滑。

**≈ Wiggler（摆动器）。** 为属性添加随机运动。

- **property**（属性）：position (x, y)、x、y、scale、turn、opacity，或设置了关键帧的生成器或光线数值。
- **per s**：变化的频率。
- **amount**：向两个方向变化的幅度。
- **noise**：smooth（流畅的曲线）或 jagged（每次一个新值）。
- **x, y apart**：用于位置时，x 和 y 各自独立摆动。关闭时它们一起摆动。
- **seed**：每个数值产生不同的摆动。

摆动作用于属性的第一个和最后一个关键帧之间，叠加在已有的运动之上。如果属性的关键帧少于两个，则作用于整个图层。

**⌇ Smoother（平滑器）。** 平滑属性在第一个和最后一个关键帧之间的关键帧。至少需要三个关键帧。

- **frames**：在前后各这么多帧的范围内对运动取平均。
- **tolerance**：只保留使数值变化超过该值的关键帧。

结果是关键帧更少，但整体形状不变。两端保持原位。

## Audio → keys、波形和频谱图层（2.508.0）
<!-- en: audio-keys-waveform-and-spectrum-layers-2-508-0 d06721950bb9 -->

应用会读取时间线的声音：它的响度、波形以及随时间变化的 64 个频段。声音可以是单个片段，也可以是 **All sound (the mix)**（全部声音/混音）：所有声音片段，以及每个正在播放的视频片段的声音，按各自音量混合。每个文件只读取一次，之后会被记住。

**♪ Audio → keys** 位于每个图片、文字、形状、生成器或视频图层的 Properties 中。

1. 选择 **sound**（声音）。
2. 选择要跟随的内容：**loudness**（响度）、**bass**（30–250 Hz）、**mids**（250 Hz–2 kHz）或 **treble**（2–12 kHz）。
3. 选择 **property**（属性）：opacity (0..1)、scale (1 = 100 %)、x、y、turn，或图层自身的生成器或光线数值。
4. 设置 **quiet**（安静）和 **loud**（响亮）时的数值，以及 **smooth**（前后各取多少帧求平均）。
5. 按 **♪ Make keys**。

该属性会在图层的整个长度上设置关键帧。这一段中最安静的时刻得到 quiet 值，最响的时刻得到 loud 值。只保留起作用的关键帧，最多 400 个。该属性上已有的关键帧会被替换，之后这些关键帧可以像其他关键帧一样编辑。

**🌫 Waveform（波形）。** 使用 🌫 Generator 工具，在画布上 **Alt+click**。在该图层的 🌫 Generator 中：

- **sound**。
- **style**：wave（填充）、line 或 bars。
- **x / y**（相对画幅中心）、**width**、**height**。
- **span s**：在播放头周围显示多少秒的声音。数值小时即波形的特写。
- **gain %**、**thickness**，以及从左 → 右的 **colours**。

**🌫 Spectrum（频谱）。** 用 🌫 工具 **Alt+Shift+click**。其频率从低（左）到高（右）排列。在该图层的 🌫 Generator 中：

- **sound**。
- **style**：bars、line 或 circle（围成一圈的条形）。
- **bands**（4–64）、**gain %**、条形之间的 **gap %**。
- **floor %**：比它更安静的部分不显示。
- **thickness**，以及从低 → 高的 **colours**。

每个数值都可以设置关键帧（◇）或使用表达式（ƒx）。

**ƒx audio()。** 在任何表达式中，`audio()` 是该时刻混音的响度（0..1）。`audio("bass")`、`audio("mid")` 和 `audio("treble")` 跟随各频段。例如，`value * (1 + audio() * 0.5)` 会随音乐跳动。两者都在 ƒx 预设中。

**编译。** 波形和频谱图层由页面逐帧渲染，使用的是同一份声音读取结果，因此结果与画布一致。页面会等声音读取完成后再渲染。

## 木偶图钉和网格变形（2.507.0）
<!-- en: puppet-pins-and-mesh-warp-2-507-0 1dce6dfe442d -->

**📌 Puppet pins（木偶图钉）。** 选中一个图层（图片、文字、形状、生成器或视频图层）。然后选择 **📌 Puppet** 工具（**Shift+W**）。

- 在图层上**点击**即可放下一个图钉。放下几个：手臂两端、头部、双脚。
- **拖动**一个图钉，图层会弯曲跟随。其他图钉会把画面固定在原处。在图钉附近，画面会随它旋转和移动，而不会被拉伸。
- **Alt+click** 一个图钉可将其连同它的关键帧一起删除。
- 弯曲后的画面可以超出图层自身的边缘。

**为图钉制作动画。** 在 **📌 Warp**（位于图层的 Properties 中）中按 **◇ key here**。它会在播放头处为所有图钉设置关键帧。此后每次拖动都会在播放头处生成关键帧，图钉在关键帧之间平滑移动（这些关键帧在图表编辑器中具有常规的缓动）。

**⌗ Mesh warp（网格变形）。** 在 📌 Warp 中勾选 **⌗ Mesh warp**。图层上会出现一个点阵网格（**columns** × **rows**，最多 8 × 8）。用 📌 工具拖动其中的点。画面会沿穿过这些点的平滑曲线变形，而不是沿直线。**reset** 会将所有点复位。网格点与图钉一样，通过 ◇ key here 设置关键帧。图钉和网格可以同时使用。

**📌 Warp 设置：**

- **on**：开关变形。
- **falloff**：图钉拉力的影响范围。低值范围宽且柔和，高值只作用于图钉附近。
- **detail**：绘制所用三角网格的精细程度。数值越高，在大幅弯曲时越平滑。
- **✕**：删除图钉、网格及其关键帧。

图钉和点以在图层自身图片中的比例位置保存。图层被移动、缩放或旋转时，变形会随之一起变化。

**编译。** 变形后的图片图层由页面逐帧渲染。变形后的视频图层由页面整体烘焙，并保留声音，与光线效果（2.506.0）相同。结果与画布一致。

## 粒子和光线（2.506.0）
<!-- en: particles-and-light-rays-2-506-0 4df1e683491b -->

**✨ Particles（粒子）。** 使用 **🌫 Generator tool**，在画布上 **Shift+click**。点击处会出现一个粒子发射器：一股上升后回落的柔和火花喷泉。选中该图层。在 **🌫 Generator**（类型为 **Particles**）中可以设置：

- **emitter**（发射器）：**point**、**line** 或 **box**。设置其 **x / y**（相对画幅中心的像素）及其 **width / height**。
- **per s**（每秒生成的数量）、**life s**（寿命）和 **pre-roll**（预滚动：开始时空中已充满粒子）。
- **speed px/s** 及其随机 **± %**；**direction °**（0 = 向右，−90 = 向上）及其 **spread °**；**gravity** 和 **wind**。
- **particle**：dot（柔和）、circle、square、star 或 spark（沿运动方向的拖尾）。
- **size start → end** 及其随机 **± %**；**colours** start → end；**opacity start → end %**；**seed**。

每个数值都可以设置关键帧（◇）或使用表达式（ƒx）。粒子是计算出来的，而不是模拟出来的：任何一帧无论何时绘制都一样，因此拖动播放头、播放和编译的结果完全一致。为图层设置 Add 或 Screen 之类的混合模式，可以让它在下方画面上发光。

**☀ Light rays（光线）** 位于任意图片、文字、形状、生成器或视频图层的 Properties 中。图层的明亮部分会从一个光源点向外拖出光线。光线可以超出图层自身的边缘。

- **source x / y**：相对图层中心的像素。
- **length %**：光线延伸的距离。
- **intensity %**：光线的强度。
- **threshold**（0–255）：只有比该值更亮的光才会产生光线。
- **tint**：光线的颜色。
- **rays only**：隐藏图层，只保留其光线。

每个数值都可以设置关键帧（◇）或使用表达式（ƒx）。

**视频图层。** 带光线效果的视频图层会在你按 ⚙ Compile 时由页面整体烘焙。每一帧都按其自身时间从片段中取出，并完全按画布的方式绘制。编译会叠加这些帧，并保留片段的声音。较长的片段需要一点时间来烘焙。只有当它的某项内容发生变化时才会重新烘焙。

## 生成器图层和扭曲：分形噪波、渐变、湍流置换、置换贴图（2.505.0）
<!-- en: generator-layers-and-distortions-fractal-noise-gradient-ramp-turbulent-displace- 19054559d27a -->

**🌫 Generator** 工具（位于画布工具箱中）会创建一个自行绘制内容的图层：

- 在画布任意位置**点击**，创建覆盖整个画幅的 **Fractal Noise** 图层。
- **拖动**，创建一个从按下处延伸到松开处的 **Gradient Ramp** 图层。

选中该图层，即可在其 Properties 中看到 **🌫 Generator**。每个数值都可以设置关键帧（◇）或使用表达式（ƒx）。

- **Fractal noise**（分形噪波）设置：
  - **type**：basic、turbulent smooth 或 turbulent sharp（带折痕）。
  - **contrast**、**brightness**、**invert**。
  - 以像素为单位的 **scale**，以及 **complexity**（细节层数）。
  - **sub influence** 和 **sub scaling**：每个更精细的细节层的强度和精细程度。
  - **evolution**（°）和 **evolution speed**（°/s）：噪波会自行变化。
  - **offset** 和 **drift**（px/s）：平移噪波。
  - **seed**，以及两种 **colours**（暗 → 亮）。
  - **detail**：¼（快速）或 ½。噪波本身很平滑，因此以小尺寸计算，再放大绘制。
- **Gradient ramp**（渐变）设置：**linear** 或 **radial**，**start** 和 **end** 点（相对画幅中心的像素），以及两种颜色。

降低图层的不透明度或为其设置混合模式，即可将其叠加在其他图层上。

**〰 Distort**（扭曲）位于任意图片、文字、形状或视频图层的 Properties 中：

- **Turbulent displace**（湍流置换）用分形噪波推动图层的像素。设置 **amount**（像素）、旋涡的 **size**、**complexity**、**evolution speed**（会自行变化）和 **seed**。
- **Displacement map**（置换贴图）用另一个图层的画面推动像素：可以是 Fractal Noise 或 Gradient Ramp 图层，也可以是任意图片图层。中灰色使像素保持原位。**use brightness** 在两个方向上移动相同的量；**red ↔ / green ↕** 按红色横向移动、按绿色上下移动。以像素为单位设置 **max across** 和 **max up-down**。
- 像素按整像素移动，每个方向最多 127，边缘会被拉伸填充。编译的处理方式完全相同。

**编译。** 生成器图层和扭曲后的图片图层由页面逐帧渲染。扭曲后的视频图层会得到两个贴图视频（横向和上下，无损存储）。编译用它们移动每一帧的像素，因此结果与画布一致。

## DLSS 5：视频增强、放大和帧生成（2.504.0）
<!-- en: dlss-5-enhance-upscale-and-frame-generation-for-videos-2-504-0 09d0d01e3b4d -->

**⚡ DLSS 5** 通过 NVIDIA DLSS 5 处理视频，使用的是 RunningHub 的 ComfyUI 节点（与 Tim 的 “secret sauce” 工作流最后一步相同）。它能做三件事：

- **神经渲染。** 清理并锐化画面。Style 用于选择观感：default、natural（更接近原片）、cinematic（对比度更高）或 off（仅放大）。Detail 设置保留多少改动：0 保持原片，1 为完整结果，2 为更强。Structure 设置局部细节重建。
- **放大。** 可选尺寸有 1x（DLAA：尺寸不变，画质增强）、NVIDIA 的固定倍率 1.5x、1.724x、2x 和 3x，或 1K / 2K / 4K / 8K。选择 1K–8K 时，DLSS 会选取能让短边达到 1080 / 1440 / 2160 / 4320 的最小倍率；已经达到该尺寸的视频保持 1x。与原尺寸相差超过 3x 的尺寸会被拒绝，并给出文字说明；请选择更小的尺寸。
- **帧生成**（可选）。真正生成的中间帧，而不是混合帧：2x / 3x / 4x 帧率，或 60 fps 之类的目标帧率，最高可达原片的 6 倍。

**使用位置。**

- 预览栏的 **⚡ DLSS 5** 按钮作用于你正在预览的视频。窗格会说明它将生成什么；**⚡ Enhance** 将其加入队列，结果会带着原片的声音出现在图库中。
- 在 StoryBoard 的 ⚙ 中，设置 **Upscaler → DLSS 5**。之后场景的 ⏫ 会将其镜次送入 DLSS 5，使用 ⚙ 中的 Upscale 分辨率（720 = DLAA，1080 = 1K，1440 = 2K，2160 = 4K）。勾选 “Upscale every render” 后，每个镜次一生成就会被送去处理。

**安装。** 仅支持 NVIDIA RTX 显卡。在 Settings → ComfyUI → Video accelerators 中，按 **Install RH DLSS 5**。然后自行将 NVIDIA 的 DLL 复制到 ComfyUI/models/dlss5/；节点包的 README 列出了这些文件名，节点包从不下载这些文件。重启 ComfyUI。帧生成还需要在 models/dlss5/dlssg/ 中放置其专用的 worker 文件（README 中也有说明）。

## 长视频：MiniMax H3 单次运行最长 30 秒（2.503.0）
<!-- en: long-video-one-minimax-h3-run-up-to-30-seconds-2-503-0 7f140d0ebd20 -->

以前，一个 MiniMax H3 片段是一次最长 15 秒的生成；更长的内容会以 15 秒为一段渲染后再拼接。**Long video**（长视频）可以**一次生成最长 30 秒**。单次运行能让角色、动作和声音保持连贯，没有拼接点。其设置与 Tim 的 “secret sauce” 工作流相同：在采样器前加入三个模型补丁。

- **MiniMax low-VRAM attention**：注意力头分组运行（4 个一组），缓冲区用完立即释放。
- **Chunked feed-forward**：前馈步骤沿帧方向分块运行（序列超过 4096 个 token 后分为 2 块）。结果相同，内存峰值更低。
- **Comfy kitchen attention**（可选）：在前面加入 ComfyUI 的 comfy-kitchen 注意力后端。

**启用方法。**

- **场景板：** 在 StoryBoard 的 ⚙ 中勾选 **Long video**。之后场景一次即可渲染最长 30 秒。如果同时勾选了 **Comfy Kitchen**，还会加入 kitchen 注意力。
- **提示词面板的 Generate：** 选择 **MiniMax H3 Long (30 s)** 视频风格，或在任意 MiniMax H3 风格中开启 Long video（Settings → Video styles → Long video: On，或 On + comfy kitchen attention）。之后 Seconds 下方的计划行会将 25 秒的片段显示为一次 600 帧的运行。
- 超过 30 秒的片段仍会被拆分后拼接，每段 30 秒。
- 开启 Long video 时会跳过 Sage attention，因为 Long video 自带注意力补丁。Spectrum 仍可与之配合使用。
- 它仅适用于 MiniMax H3；LTX 和 Wan 风格会忽略它。

**安装。** Long video 需要较新的 ComfyUI-KJNodes。Settings → ComfyUI → Video accelerators 中有一个 **Install / update KJNodes** 按钮。kitchen 注意力需要 ComfyUI 0.32 或更高版本，并安装 comfy-kitchen（见其上方的 Comfy Kitchen 部分）。如果这台机器已经因某次显存不足的运行而记下了较低的显存上限，该上限仍然有效。

同一窗格还可以安装 **Yusu H3 Unified**（MiniMax H3 的单节点前端，供使用它的导入工作流使用）和 **RH DLSS 5**（NVIDIA RTX 增强 / 放大 / 帧生成）。对于 DLSS 5，需要你自行将 NVIDIA 的 DLL 放入 ComfyUI/models/dlss5/；节点包从不下载它们。

该导出的工作流还以 8 步运行其 turbo LoRA。添加一个 turbo LoRA 并在 Basic Settings 中设置 Steps，即可获得相同的速度。

## FLUX 3 Image Klein，以及编辑图像模式只列出编辑风格（2.502.0）
<!-- en: flux-3-image-klein-and-edit-image-mode-lists-only-edit-styles-2-502-0 950e6d848f28 -->

**FLUX 3 Image Klein** 是 Black Forest Labs 的 5.6B 开放图像模型（2026 年 10 月）。有三个新的图像风格使用它：

- **FLUX 3 Klein**：蒸馏模型，16 步，cfg 1（4 到 16 步均可）。速度快。
- **FLUX 3 Klein base**：基础模型，约 50 步，cfg 3.5，支持真正的负面提示词。速度较慢，LoRA 就是基于它训练的。
- **FLUX 3 Klein edit**：根据最多 4 张参考图编辑图片。第 1 张图决定输出尺寸。在提示词中，可以按顺序用 `<ref_image_0>`、`<ref_image_1>` 等指代这些图片。

文生图风格也接受参考图面板：其中有图片时，它们会自动切换到各自的编辑工作流图（基础风格切换到基础编辑工作流图）。它们从不会切换到 FLUX.2 的工作流图。

**模型。** Settings → Setup 列出了三个文件：蒸馏版和基础版 int8 权重，以及 Qwen3-VL 4B 文本编码器。VAE 使用 FLUX.2 的 `flux2-vae.safetensors`。该 Hugging Face 仓库需申请访问：请先在那里接受 FLUX Kommunity 许可，并添加你的令牌。bf16 和 nvfp4 版本位于同一仓库；设置风格的 Model 即可使用其中之一。FLUX 3 需要 ComfyUI 0.41.0 或更高版本。使用较长、具体的提示词时效果最好。

**编辑图像模式。** 当图像编辑器已打开，且提示词面板的 ▾ 设为 **Edit**、**Replace background** 或 **Compose** 时，图像风格下拉框只列出能编辑图片的风格：FLUX 3 和 FLUX.2 Klein 风格、Qwen Image Edit、FLUX.1 Kontext 等。2.549.0：在 **✨ Generate**、Refine、Fill 或 Remove 下会列出所有风格（Krea 2、SDXL …），而在 ▾ 设为 Edit 时选择一个不能编辑的风格，会把 ▾ 切换到 Generate。关闭编辑器后，之前选择的风格会恢复。下次编辑时，会再次选中你上次使用的编辑风格。

## 曲线时间重映射（2.501.0）
<!-- en: time-remapping-on-a-curve-2-501-0 05c7f12e32a7 -->

视频片段的 **🎬 Speed** 部分现在新增了 **⏱ Time remap**（时间重映射）。它设置在片段的每个时刻显示源素材的哪一秒。

- **开启后**，片段会获得一条曲线，播放效果与当前完全相同（其速度、变速或倒放会变成关键帧）。开启重映射时，速度、倒放和变速会被关闭，关闭重映射后会恢复。
- **曲线。** 横轴是片段在时间线上的自身时间；纵轴是显示的源素材秒数。
  - 上升为正向播放，下降为倒放，水平为定格。越陡越快。
  - 拖动关键帧可移动它。双击曲线可添加关键帧；双击关键帧可删除它。
  - 最后一个关键帧的时间即片段在时间线上的长度。
- **◇ Key** 在播放头处、曲线当前所在位置添加一个关键帧。
- **❄ Freeze** 将播放头处的帧定格为旁边所设的秒数；片段的其余部分随之后移。
- **关键帧行**显示所选关键帧的时间和源素材秒数。可输入新值，或按 ✕ 删除它。
- **修剪。** 缩短重映射后的片段会保留曲线中位于片段内的部分。延长片段则会定格边缘帧。
- **声音。** 片段的声音跟随曲线：画面倒放时声音也倒放，定格期间静音。预览也以同样方式播放。

## 运动模糊、帧率分离（Posterize Time）、残影（Echo）（2.500.0）
<!-- en: motion-blur-posterize-time-echo-2-500-0 9f159d49f8dd -->

图层的 Properties 中现在有一个 **⏱ Time** 部分。

- **Motion blur**（运动模糊）会模糊图层的运动（其位置、缩放和旋转，无论来自关键帧、父级还是表达式）。
  - **shutter**：模糊覆盖每帧的比例：180° 为半帧，360° 为整帧。
  - **samples**：每帧绘制运动的次数。采样越多，模糊越平滑，但编译越慢。
- **Posterize time** 将图层保持在较低的帧率（例如 8 fps），呈现顿挫的定格动画效果。其画面和运动都会被保持。
- **Echo** 在图层后方、它片刻之前所在的位置绘制副本，形成运动拖尾。
  - **copies**（副本数）和 **apart**（副本之间的秒数）。
  - **first**：最近副本的强度。**fade**：每个更远的副本保留多少。
  - 在视频图层上，编译还会在副本中显示较早的帧；画布在那里绘制的是当前帧。

**编译。** 图片和文字图层由页面烘焙。在视频图层上，编译执行相同的计算：

- 运动模糊：每帧对运动多次采样并取平均。
- Posterize：保持的帧。
- Echo：放在图层后方的延迟副本。

## 跟踪和边角定位（2.499.0）
<!-- en: tracking-and-corner-pin-2-499-0 8adaaeec2a31 -->

**🎯 Track（跟踪，位于视频片段的 Properties 中：V1 或视频图层）。** 选择要跟随的内容：

- **◎ a point**（一个点）：位置。
- **◎◎ two points**（两个点）：位置、缩放和旋转。
- **▢ corner pin**（边角定位）：分别跟随 4 个点。
- **▣ planar**（平面）：屏幕、招牌或书页之类的平面。它的 4 个角由其内部的所有内容共同带动，因此即使某个角被遮挡也能保持跟踪。

**跟踪**

1. 将播放头移到要开始跟踪的位置。
2. 按 **◎ Place**，然后将点拖到清晰的细节上。每个点周围的方框是跟踪器要寻找的图块；**size** 可改变其大小。
3. 按 **▶ Track**。它会以亚像素精度、按片段自身的帧率一直跟随到片段末尾。路径会绘制在画布上，并列出所有未能很好识别某个点的帧。

在 **Apply to** 中选择一个图层，然后按 **Apply**：

- 使用一个点（或两个点）时，图层的位置关键帧（以及缩放和旋转）会跟随跟踪结果。将其应用到一个 **null**（空对象）上，再把其他图层设为该空对象的子级，即可让它们跟随。
- 使用边角定位或平面跟踪时，图层会在每一帧都被**钉入**跟踪到的四个角中。把图片或视频贴到移动的屏幕上就是这样做的。

**▢ Corner pin（边角定位，任意图层的 Properties）。** 将图层绘制到 4 个角中。

- 勾选后会以图层自身的四个角为起点，然后使用 **✥ Edit corners** 在画布上拖动它们。
- 带关键帧的定位（来自跟踪）在你拖动某个角时，会在播放头处生成关键帧。

**编译。** 定位后的图片和文字图层由页面烘焙。定位后的视频图层由编译本身进行变形，其四个角作为关键帧。两者都与画布一致。

## 贝塞尔蒙版（2.498.0）
<!-- en: b-zier-masks-2-498-0 accb2b8c4c64 -->

时间线上的任意图片、文字、形状或视频图层都可以有**蒙版**：用于决定图层哪一部分显示的形状。

**用 ✒ Mask Pen 绘制蒙版（Shift+M，位于画布的工具栏中）**

- 先选中图层（Move 工具）。
- **点击**添加一个角点。**拖动**添加一个平滑点；拖动会拉出其控制柄。
- 再次点击**第一个点**，或按 **Enter**，即可闭合蒙版。**Esc** 停止绘制。
- 要修改闭合的蒙版，用 Mask Pen 拖动其点或控制柄。按住 **Alt** 可单独移动一个控制柄。
- 这些点以在图层自身图片上的位置保存，因此图层移动、缩放或旋转时，蒙版会随之移动。

**✒ Masks（图层的 Properties）**

每个蒙版包含：

- **on / off** 和 **invert**。
- **mode**：它与列表中上方蒙版的组合方式。
  - **add** 显示更多图层内容。
  - **subtract** 减去部分区域。
  - **intersect** 只保留重叠部分。
  - **difference** 保留恰好只被其中一个覆盖的部分。
- **feather**（px）：柔和边缘。
- **expansion**（px）：+ 扩大蒙版，− 收缩蒙版。
- **opacity**（%）。
- **◇**：在播放头处为蒙版路径设置关键帧。有两个或更多关键帧时，点会从一个形状平滑过渡到下一个；在其他时间拖动点会在那里添加关键帧。
- **✕** 删除蒙版。

**编译**

- 带蒙版的图片、文字和形状图层由页面烘焙。
- 视频图层的蒙版会变成一个灰度蒙版视频，编译将其用作片段的透明度。当蒙版中没有任何运动时，它只有一帧。
- 两种情况下，影片都与画布一致。

## 表达式（2.497.0）
<!-- en: expressions-2-497-0 77d6c529c047 -->

画布图层的 Properties 中现在有一个 **ƒx Expressions** 部分。表达式是一个小公式，会在每一帧计算出某个属性的值。

**添加表达式**

1. 选择一个属性：position x / y、scale（1 = 图层的尺寸）、rotation（°）、opacity（0–1）或 anchor point。形状图层还会列出其形状数值，文字图层会列出其动画器和路径文字数值。
2. 选择一个预设或保留第一个，然后按 **＋ ƒx**。
3. 在框中编辑表达式。错误会立即显示；在修正之前，该属性保持上一个有效的表达式（或其关键帧给出的值）。
4. **✕** 移除表达式。

**语言**（不是 JavaScript；不能运行其他任何代码）

- **运算：** 数字、+ − × ÷（`* /`）、`%`、`**`、括号、比较、`&&` `||` `!`，以及 `a ? b : c`。
- **多行：** 用换行或 `;` 分隔，并用 `var name = …` 定义命名值。最后一行即结果。
- **可用的值：**
  - `value`：关键帧或设置当前给出的值。
  - `time`：时间线上的秒数。`t`：进入片段后的秒数。`frame` 和 `fps`。
  - `inPoint` / `outPoint`、图片的 `width` / `height`、`index` 和 `PI`。
- **函数：**
  - `wiggle(freq, amount)`：平滑的随机运动，每次播放都相同。
  - `loopOut()` / `loopIn()` 配合 `"cycle"`、`"pingpong"`、`"offset"` 或 `"continue"`：在最后一个关键帧之后或第一个关键帧之前重复关键帧。
  - `valueAtTime(time - 0.5)`：另一时刻的值（延迟）。
  - `linear` / `ease` / `easeIn` / `easeOut(t, tMin, tMax, from, to)`：将一个范围映射到另一个范围。
  - `clamp`、`random(min, max)`（每帧变化）、`noise(x)`、`posterize(value, step)`。
  - `layer("Null 1", "x")`：另一个图层的 x、y、scale、rot 或 op。用于将图层链接在一起。
  - 常用数学函数：`sin cos tan abs min max round floor ceil sqrt pow …`。`Math.sin` 也可以使用。
- **示例：**
  - `time * 90` 每秒旋转 90°。
  - `wiggle(2, 20)` 抖动 20 px。
  - `loopOut("pingpong")` 让关键帧来回往复播放，永不停止。
  - `layer("Null 1", "x") + 100` 跟随空对象，位于其右侧 100 px。

**编译：** 由表达式驱动移动或淡入淡出的图层会以关键帧的形式进入 ⚙ Compile。这些关键帧逐帧计算，并精简到运动发生弯折的位置。形状图层和动画文字仍像以前一样由页面烘焙，因此影片与画布一致。

## 自由形状、Merge Paths、路径文字、漫游关键帧（2.496.0）
<!-- en: freehand-shapes-merge-paths-text-on-a-path-roving-keyframes-2-496-0 731be9bb07ed -->

**✎ Freehand（自由绘制；Shift+Q，位于画布的工具列中）。**

- 拖动即可绘制一条路径。它会成为一个**自由形状图层**，并经过精简和平滑处理。
- 在起点处结束绘制（或按住 Shift）会生成一个闭合的填充形状；否则就是一条描边宽度为 4 px 的开放线条。
- **W / H** 可以拉伸它，所有形状操作器都能作用于它。对于开放线条，Trim Paths 从一端运行到另一端。
- 绘制时按住 **Alt**，会把这次绘制的内容作为另一条路径添加到当前选中的形状图层中。

**⧉ Paths 和 ⊕ Merge Paths（位于形状图层的 Properties（属性）中）。**

- **＋ Path** 在同一个形状图层中再添加一个矩形、椭圆、星形或多边形，它有自己的尺寸、位置和旋转角度。
- 不开启 Merge Paths 时，每条路径单独填充。
- 开启 **⊕ Merge Paths**（合并路径）后，这些路径会合成一个轮廓。每条新增的路径按其模式与之前的路径组合：**add**、**subtract**、**intersect** 或 **exclude**。在另一条路径内部减去的路径会形成一个孔洞。
- 其后的操作器（Offset、Zig Zag、Trim 等）作用于合并后的轮廓。Offset 会让轮廓向外扩展，同时让孔洞缩小。

**〰 Text on a path（路径文字；位于文字图层的 ✨ Text Animators 部分）。**

- 勾选 **On a path**，然后选择 **an arc**（圆弧）、**a circle**（圆）、**a wave**（波浪）或 **a shape layer**（形状图层，使用其轮廓，位于文字所在的位置）。
- 设置半径、跨度、高度或波长。**Start %** 指定文字在路径上的起始位置；用 ◇ 为它设置关键帧，可让文字沿路径滑动。
- **Other way** 让文字朝相反方向排列（排在圆的内侧）。
- 动画器仍然有效：其 x 值让字母沿路径移动，y 值让字母沿垂直于路径的方向移动。
- 编译时会将文字烘焙下来，使其与画布上的效果一致。

**漫游关键帧（📈 Graph Editor ▸ Rove）。**

- 在 Graph Editor 中选中一个位置关键帧，然后按 **Rove**。之后它的时间会跟随运动路径，使图层在其前后不漫游的关键帧之间匀速移动。
- 移动某个关键帧会重新计算漫游关键帧的时间。第一个和最后一个位置关键帧永远不会漫游。
- 漫游关键帧所设置的其他属性（缩放、不透明度）仍保持在原来的时间。

## 颜色混合模式，以及跟随父级的视频图层（2.495.0）
<!-- en: colour-blend-modes-and-video-layers-that-follow-a-parent-2-495-0 3a49938eceb8 -->

**Hue、Saturation、Color 和 Luminosity。** 时间线图层的 **◐ Blend**（混合）列表在原有的 13 种模式之外，现在又新增了这四种颜色模式。每种模式都会把画面拆分为亮度和颜色两部分，然后一部分取自该图层，另一部分取自其下方的内容：

- **Luminosity：** 把图层的亮度应用到下方的颜色上（例如，用一张黑白纹理为场景添加明暗，而不改变场景的颜色）。
- **Color：** 把图层的颜色应用到下方的亮度上（用于着色或重新上色）。
- **Hue：** 采用图层的色相，保留下方内容的饱和度和亮度。
- **Saturation：** 下方颜色的浓淡程度变为图层的浓淡程度（灰色图层会去掉颜色）。

画布和 ⚙ Compile 使用相同的算法计算这些模式，因此成片与预览完全一致。

**视频图层可以跟随父级。** 视频图层 Properties 中的 **⛓ Parent**（父级）现在的用法与图片、文字和空对象图层相同：

- 视频会随父级一起移动、旋转和缩放。选择父级时，视频在播放头所在时刻保持原位不动。
- 编译时，视频在屏幕上的位置、缩放和旋转会作为关键帧写入成片。系统会逐帧检查这些值，只在运动发生转折的地方保留关键帧，因此成片会与画布保持一致。

## CAD 功能改进：CAD 按钮、Offset、视图立方体、选取轮廓（2.494.0）
<!-- en: the-cad-workings-refined-the-cad-button-offset-the-view-cube-picking-profiles-2- 838e05700bb9 -->

**⌬ CAD 按钮。** 图像编辑器的工具列底部有一个 ⌬ CAD 按钮，时间线的工具列中也有一个。

- **图像编辑器：** 选中草图图层、草图工具或 3D 实体时，CAD 工具栏（Sketch · Shapes · Solid · Unreal）会自动显示，其余时间则不会碍事。按 ⌬ CAD（或 Window ▸ CAD Toolbar）可让它一直显示。
- **时间线：** ⌬ CAD 用于显示或隐藏预览上方的工具栏。

**绘制草图**

- **Select** 位于 Sketch 选项卡的首位（S）。
- 编辑草图时，**Create Sketch** 会隐藏，完成后会重新出现。
- **Finish Sketch** 会选中 Move 工具，并把工具栏切换到 **Solid** 选项卡，便于接着拉伸。
- **从线条继续绘制：** 用 Select 选中一条线（或圆弧），它的两端外侧会各出现一个 ＋。点击其中一个，Line 工具就会从该端继续绘制；之后照常点击后续各点即可。

**Offset（O）现在是一个工具**

1. 点击一条线、圆弧或圆。与它首尾相连的所有线条也会一并选中；Shift+点击可添加更多。
2. 把指针移到你想要的那一侧。虚线预览会跟随指针，Distance 框会显示偏移的距离。
3. 点击即可生成，或者输入距离后按 Enter。

- **F**（或 ⇄ Flip）改用另一侧。
- **Esc** 取消选取。
- 现在，无论线条按哪个方向绘制，都会偏移到同一侧，圆角也会保持连接（其圆弧随其余部分一起扩大或缩小）。
- 📐 Sketch 选项卡中的 Offset… 对话框仍可作用于选中的对象，现在它会显示 **Out** 或 **In**。
- 如果草图无法接受某次偏移（或任何草图编辑），则不会产生任何更改。

**Extrude 和 Revolve：选取轮廓**

- 当草图包含多个闭合区域时，Extrude / Revolve 会先让你点击要使用的区域：
  - 指针下方的区域会高亮显示。点击可添加该区域，再次点击可将其移除，也可以使用 **All**。
  - 然后按 **Enter** 或 **✓ OK**，打开已勾选这些区域的设置。按 **Esc** 则停止。
- 只有一个区域的草图会直接进入设置。
- 如果你已经用 Select 选中了某个区域的线条，则会直接使用该区域。

**3D 视口（选中实体时）**

- 无论使用哪种工具，**Shift + 中键拖动**都可以环绕查看实体。**中键拖动**用于平移，**滚轮**用于缩放，与之前相同。
- **视图立方体**位于画布右上角：
  - 点击某个面可切换到该面的视图，点击某个角可切换到从该角看过去的视图。
  - 拖动立方体可环绕查看。
  - 它的下方有：**⌂ Home**、**⟳ Orbit**（直接拖动实体本身）、**✋ Pan** 和 **⤢ Fit**。
- 3D 视图图层同样可以用 Shift + 中键拖动来环绕查看。开启 🖐 时，中键拖动会平移其摄像机。

## 文字动画器（2.493.0）
<!-- en: text-animators-2-493-0 18a917f6bd01 -->

文字图层的 Properties 面板中有一个 **✨ Text Animators**（文字动画器）部分。动画器可以逐个对字母进行移动、旋转、缩放、淡化、拉开间距、模糊或重新着色，让一行文字呈现逐字打出、升起到位或波纹起伏的效果。

- **＋ Animator** 用于添加一个动画器。可以先选择一个预设；每个预设都已设好关键帧：
  - **Typewriter**：字母逐个出现。
  - **Fade up**：字母上升并淡入。
  - **Pop in**：字母从无到有地放大出现。
  - **Slide in (words)**：单词从左侧滑入。
  - **Wave**：一道波纹贯穿整行文字。
  - **Blur in**：字母由模糊变清晰。
  - **Custom**：一个空的动画器，由你自行设置。
- **可改变的属性：** x 和 y（px）、缩放（%）、旋转（°）、不透明度（%）、字距（额外间距，px）、模糊（px），还可以选择改变颜色。
- **作用于哪些字母（范围）：**
  - **start**、**end** 和 **offset**（%）设置动画器影响的文字部分。**amount**（%）设置影响的强度。
  - 可以按 **letters**（字母）、**words**（单词）或 **lines**（行）起作用。
  - 形状决定效果在范围内如何分布：
    - **square**：要么生效要么不生效，边缘处的字母部分生效，因此打字机效果运行流畅。
    - **ramp up / ramp down**：在范围内逐渐增强或逐渐减弱。
    - **triangle / round / smooth**：在范围的中间最强。
- **制作动画：** 每个数值旁都有一个 ◇，可在播放头处为该数值设置关键帧。将 offset 从 −（范围）到 100 % 设置关键帧，效果就会扫过整段文字。📈 Graph Editor 中也会列出这些关键帧。
- 一段文字可以同时应用多个动画器：它们的位移会相加，缩放和不透明度会相乘。
- **✕** 删除一个动画器及其关键帧。
- **编译：** 在 ⚙ Compile 之前，带有动画器的文字图层会由页面进行烘焙，因此成片与画布上显示的完全一致。
- 动画器适用于普通文字图层。使用了文字效果预设的文字会保留其预设。

## 形状图层及其操作器（2.492.0）
<!-- en: shape-layers-and-their-operators-2-492-0 c10cd32d3c0d -->

- **◆ Shape tool**（形状工具；Q，位于画布工具栏中）：在画布上拖出一个框，即可在该位置生成同样大小的形状图层。按住 Shift 可使各边等长。完成后工具会切回 Move。
- 形状图层的 Properties 面板包含以下设置：
  - **类型：** Rectangle（可设圆角半径）、Ellipse、Star（角数、内半径）或 Polygon（顶点数）。每种都有宽度和高度。
  - **Fill：** 纯色或双色渐变，可设置不透明度。
  - **Stroke：** 颜色、宽度，以及圆头、平头或方头端点。
  - **操作器。** 勾选某个操作器即可启用它并显示其设置：
    - **✂ Trim Paths**：start、end 和 offset（%）。只绘制轮廓的这一部分。将 end 从 0 到 100 % 设置关键帧，即可让形状逐步画出来。
    - **⧉ Repeater**：副本数和偏移；每个副本都会在前一个的基础上再移动（x、y）、缩放（%）和旋转（°）一步。不透明度从起始值渐变到结束值。
    - **⇲ Offset Paths** 向外扩展轮廓，取负值则向内收缩。
    - **✳ Pucker & Bloat** 将边缘向内收拢或向外膨胀。
    - **🌀 Twist** 让外侧比中心旋转得更多。
    - **〰 Zig Zag** 添加锐利或平滑的锯齿。
    - **≈ Wiggle Paths** 让轮廓随时间抖动。
    - **◜ Round Corners** 将所有拐角变为圆角。
- **制作动画：** 每个数值旁都有一个 **◇**，用于在播放头处为该数值设置关键帧。数值设置关键帧后，再修改它就会在播放头处再次设置关键帧，与位置的用法相同。📈 Graph Editor 会列出已设置关键帧的形状数值，方便你调整其缓动。
- **编译：** 在 ⚙ Compile 之前，页面会逐帧烘焙每个形状图层，与画布上绘制的完全一致。未更改的形状不会重新烘焙。

## 混合模式和轨道遮罩（2.491.0）
<!-- en: blend-modes-and-track-mattes-2-491-0 7f19a0157d79 -->

在视频或图片图层上选中一个片段。Properties 面板中有两个新设置，它们作用于该片段所在的整个**图层**：

- **◐ Blend** 设置图层与其下方内容的混合方式：Normal、Multiply、Screen、Overlay、Darken、Lighten、Color Dodge、Color Burn、Hard Light、Soft Light、Difference、Exclusion 或 Add。
  - 例如，以 Screen 模式把一段漏光视频叠加到镜头上，或以 Multiply 模式叠加一张纸张纹理。
- **▣ Matte**（遮罩）让该图层只在**紧邻其上方**的图层所在之处显示（遮罩图层的名称显示在菜单旁边）：
  - **Alpha**：遮罩图层有画面的地方（依据其透明度）。
  - **Alpha Inverted**：遮罩图层没有画面的地方。
  - **Luma**：遮罩图层明亮的地方。
  - **Luma Inverted**：遮罩图层暗的地方。
- 遮罩图层本身不再被绘制。即使将其隐藏，它仍然作为遮罩起作用。
  - 例如，在视频图层上方放一个文字图层，并给视频图层设置 Alpha 遮罩：视频就会在字母内部播放。
- 编辑时，画布会同时显示两者。播放时，这些图层采用绘制方式呈现。
- 编译时会绘制出相同的画面。

## 父子关系和空对象（2.490.0）
<!-- en: parenting-and-null-objects-2-490-0 2b2f87d37a9d -->

- **⛓ Parent**（父级；位于图片、文字或空对象图层的 Properties 中）让该图层跟随另一个图层。
  - 子图层会随父级一起移动、旋转和缩放，但不会继承父级的不透明度。
  - 选择父级时，图层在屏幕上的位置保持不变：其位置、旋转和缩放（以及相应的关键帧）会转换到父级的坐标空间中。
  - 选择 **none** 时，会以相反方向进行同样的转换。
  - 支持链式关系：父级本身也可以有父级。图层永远不能跟随自身或它自己的子图层。
  - 视频图层可以作为父级，但不能跟随父级。
- **＋ Null** 添加一个空的控制图层，长度与时间线相同。
  - 它没有画面，也永远不会被编译。画布上它显示为一个带十字的红色虚线方框。
  - 为空对象设置关键帧（位置、旋转、缩放），然后将其他图层的父级设为它，即可让这些图层一起移动。
- 在画布上拖动有父级的图层时，无论其父级如何运动，图层都会按你拖动的方向移动。
- **编译：** 在 ⚙ Compile 之前，每个有父级的图层都会被烘焙。页面会按画布上显示的样子逐帧绘制，并将其作为透明视频保存在项目中（video/tlb_….webm），编译时再将其叠加。自上次烘焙以来没有更改的图层不会重新烘焙。

## Graph Editor、Easy Ease、锚点和曲线运动路径（2.489.0）
<!-- en: the-graph-editor-easy-ease-the-anchor-point-and-curved-motion-paths-2-489-0 af4477b378d5 -->

在时间线的画布上选中一个图片、文字或视频图层。其 Properties 面板现在新增了以下功能：

- **⊕ Anchor X / Y**（锚点）：图层的位置值所定位的点，也是缩放和旋转的轴心。它以距图层中心的像素数来计量。更改锚点时图层保持原位，因为其位置会相应移动。如果位置已设置关键帧，则图层会随之移动。锚点也可以设置关键帧（在 Graph Editor 中双击 Anchor X 或 Anchor Y 曲线图）。
- **Easy Ease**（F9）对播放头处的关键帧进行缓入和缓出，使图层在进入和离开该关键帧时减速。**Ease In** 和 **Ease Out**（Shift+F9 / Ctrl+Shift+F9）只作用于其中一侧。
- **📈 Graph** 打开 **Graph Editor**（曲线编辑器），这是一个可以拖动到任意位置的面板：
  - 选择一个属性：Position X / Y、Scale、Rotation、Opacity 或 Anchor X / Y。已设置关键帧的属性标有 ◆。
  - **value** 显示该属性在片段时间内的数值变化；**speed** 显示其变化的快慢。
  - 拖动 ■ 关键帧可以更改其时间和数值。点击关键帧可将其选中。
  - 选中关键帧的补间会显示两个 ● 手柄。拖动手柄可调整曲线形状：慢起、快收，甚至过冲。**Easy Ease**、**Linear** 和 **Hold** 可一键设置选中的补间。
  - 双击曲线图可在该处添加关键帧。Delete 删除选中的关键帧，F9 对其应用 Easy Ease。
- **↝ Smooth path** 为每个位置关键帧添加平滑手柄，使图层沿一条穿过这些关键帧的曲线运动。
  - **运动路径**在画布上显示为一条虚线，每个关键帧处有一个 ■。
  - 拖动 ■ 可移动该关键帧。Alt+拖动 ■ 可拉出其手柄。
  - 拖动 ● 手柄可弯曲路径。Alt+拖动手柄则只弯曲一侧。
- 关键帧缓动菜单中新增了 **Bézier (📈 graph)** 项。
- 编译时绘制的曲线、锚点和路径与画布上显示的一致。

## PDF 页面的添加、删除和移动；无需下载的 Select Subject——第 H 轮（2.488.0）
<!-- en: pdf-pages-added-taken-out-and-moved-select-subject-without-a-download-round-h-2- 4abc5a306270 -->

**PDF 页面。** 打开 PDF 时，Pages 栏中的页面下方有一排按钮。它们作用于当前打开的页面。

- **＋ Page** 在当前页面之后添加一个与其大小相同的空白页。
- **⤓ PDF…** 将另一个 PDF 的所有页面添加到当前页面之后。
- **▲ / ▼** 将当前页面上移或下移。也可以在页面栏中把某个页面拖到新的位置。
- **🗑** 删除当前页面，并转而打开它的前一页或后一页。如果该页有改动，会先征求你的确认。
- 同样的命令也位于 File ▸ Add / Remove PDF Pages 下。
- **💾 Save PDF** 按新的顺序写入页面。未改动的页面会按原样复制（包括文字、矢量图形等全部内容）。改动过的页面和新页面则保存为图片加真实文字。

**Select ▸ Subject** 一步选中图片的主体，无需输入任何内容。

- **Built in** 无需下载即可直接使用。它从图片边缘学习背景，从与背景不同的部分识别主体，然后让选区贴合真实的边缘。它最适合主体清晰、背景较简单的图片，对于立于图片底边的主体（如人像）同样有效。
- **AI matte** 使用本机上的 BiRefNet，与路径图层的 AI matte 共用同一套安装（约 1 GB，只需安装一次）。它能更好地处理头发、毛发和杂乱的背景。
- **Select ▸ Subject Settings…** 用于选择方法：**Auto**（已安装 AI matte 时使用它，否则使用内置方法）、**Built in** 或 **AI matte**。它还可以选择 AI 模型，并提供 **⬇ Install**。
- **Layer ▸ Remove Background** 执行相同的操作，但会把主体放入当前图层的蒙版中，因此背景是被隐藏而不是被删除。在蒙版上绘制即可修正边缘。
- Select Subject 和 Remove Background 各算一个撤销步骤。
- 按文字描述选择（Segment Anything）现在位于 **Select ▸ Subject by Words…**。

## Image ▸ Mode、Proof Colors、Gamut Warning、CMYK TIFF——第 G 轮（2.487.0）
<!-- en: image-mode-proof-colors-gamut-warning-cmyk-tiff-round-g-2-487-0 91dd0f6e5070 -->

**Image ▸ Mode** 设置文档的图片类型。每次更改模式都算一个撤销步骤，模式会保存在文档的 .bgi 文件中。

- **Grayscale**：所有像素图层都变为灰度。之后绘制的任何内容也会显示为灰色，无论是在屏幕上还是导出时。
- **Duotone…**：用一到四种油墨印刷的灰度图片（单色调、双色调、三色调、四色调）。
  - 为每种油墨选择颜色。其曲线滑块可让该油墨在中间调中多一些（向右）或少一些（向左）。
  - 预设：Sepia、Blue duotone、Cyanotype、Gold tritone、Warm quadtone 和 Black。
  - 图层中保存的是灰度图片，因此之后仍可更改油墨。
- **Indexed Color…**：最多 256 种颜色。所有图层会合并为一个 **Index** 图层。
  - 调色板：Local（由图片生成）、Web（216）、Uniform、Grey 或 Black and white。
  - 仿色（扩散或图案）及其数量；保留透明度，或将图片置于白色背景上。
  - **Color Table…** 显示所有颜色。点击某种颜色可在所有用到它的地方统一更改，也可以保存和载入 .act 颜色表。
- **Bitmap…**：仅有黑白两色。图片会合并到白色背景上，可选择 50 % 阈值、图案仿色、扩散仿色或半调网屏（网格大小和角度）。
- **CMYK Color…**：颜色限制在印刷机能够再现的范围内。
  - 选择铜版纸、胶版纸或新闻纸，黑版生成（从无到最大）以及总墨量限制。
  - 印刷机无法印出的颜色（如屏幕上鲜艳的绿色和蓝色）会移到它能印出的最接近的颜色。
  - **File ▸ Export As ▸ TIFF (CMYK, for print)** 写出四色油墨数据，供印刷厂使用。Info 面板中的 C M Y K 读数使用同一模型。
- **RGB Color** 恢复为全彩。所离开模式的效果会保留在像素中。
- **8 Bits/Channel** 是这里唯一的位深度，因为浏览器的画布每通道只能保存 8 位。没有 16 位或 32 位文档。

**View ▸ Proof Setup…** 用于选择要模拟的印刷机（纸张、黑版生成、总墨量）、是否模拟纸张颜色，以及色域警告的限值和颜色。这些设置只改变屏幕上的显示效果：

- **View ▸ Proof Colors**（Alt+Ctrl+Y）按该印刷机印出的效果显示图片。
- **View ▸ Gamut Warning**（Shift+Ctrl+Y）用警告色（默认为灰色）标出印刷机无法印出的颜色。在 Info 面板中，C M Y K 数值后面的“!”也表示同样的意思。
- 这里的印刷机只是对纸张上印刷油墨的简单模拟，并不是 ICC 色彩配置文件。可以用它来发现问题，准确的颜色请以印刷厂的打样为准。

## Auto-Align Layers、Auto-Blend Layers、Photomerge、Merge to HDR——第 F 轮第 2 部分（2.486.0）
<!-- en: auto-align-layers-auto-blend-layers-photomerge-merge-to-hdr-round-f-part-2-2-486 1ca593a90e33 -->

这四项功能会自动计算图片之间如何拼合。它们会在每张图片中找出细小的细节（角点），在图片之间进行匹配，然后计算出能让图片对齐的平移、旋转、缩放或透视变换。图片之间需要有一些共同的细节。纯色的天空或空白的墙面没有可供匹配的内容。

- **Edit ▸ Auto-Align Layers…** 对齐你选中的图层（在 Layers 中 Ctrl+点击）；如果没有选中任何图层，则对齐所有可见的像素图层。
  - **Layout**：Auto 或 Perspective（平移、旋转、缩放和透视）、Move, turn and scale，或 Reposition（仅平移）。
  - **Line up on**：中间图层、当前图层或底部图层。该图层保持不动。
  - 无法匹配的图层保持原位，状态栏会显示这类图层的数量。整个操作算一个撤销步骤。
- **Edit ▸ Auto-Blend Layers…** 为每个图层添加一个蒙版，显示该图层被采用的区域。之后可以在蒙版上绘制。
  - **Panorama**：每一处都取自它位于其中最深处的那个图层，接缝柔和。**Seamless tones and colours** 会使各图片之间的亮度和颜色保持一致。
  - **Stack Images**：每一处都取自该处最清晰的图层。用于焦点堆栈（同一画面拍摄多次，每次对焦在不同的距离）。请先对齐图层。
- **File ▸ Automate ▸ Photomerge…** 拼接全景图。可以选择文件，也可以使用已打开的文档。
  - 图片之间应重叠约三分之一。
  - 结果是一个新的 **Panorama** 文档，每张图片一个图层，已摆放到位，并且（开启 **Blend the pictures together** 时）已添加蒙版。
  - 与其他图片都不重叠的图片会被排除，状态栏会给出提示。
  - 过宽的结果会缩放到 8000 像素以内。
- **File ▸ Automate ▸ Merge to HDR…** 接收包围曝光的照片（同一场景分别以偏暗、正常和偏亮的曝光拍摄），并将其融合为一张曝光良好的图片。
  - 每一处主要取自该处最清晰的那张曝光：对比度好、颜色好、既不过暗也不过亮。
  - 开启 **Line the pictures up first** 时，会校正各次拍摄之间轻微的摄像机移动。
  - 结果是一张普通的 8 位图片，而不是 32 位 HDR 文件。

## 更多文件类型、File Info、Print、Contact Sheet、Crop and Straighten Photos——第 F 轮（2.485.0）
<!-- en: more-file-types-file-info-print-contact-sheet-crop-and-straighten-photos-round-f a25d899d3dee -->

- **File ▸ Export As** 现在除 PNG、JPEG、WebP 和 JPEG XL 外，还可以写出 **AVIF**、**GIF**、**TIFF**、**BMP** 和 **TGA**。
  - GIF 最多保留 256 种颜色（经过仿色处理，因此渐变保持平滑），并为透明区域保留一种透明色。
  - TIFF、BMP 和 TGA 保留每个像素以及透明度。对于 TIFF 和 TGA，预览中会显示图片，因为浏览器本身无法显示这些文件。
  - AVIF 由本机上的 ffmpeg 生成（需要 AV1 编码器：libaom-av1、libsvtav1 或 librav1e），并带有质量滑块。AVIF 文件保存时不含透明度。
- **File ▸ File Info…**（Alt+Shift+Ctrl+I）：标题、作者、描述、关键词、版权和来源 URL。这些信息随文档一起保存（也保存在其 .bgi 文件中），并写入导出的 PNG 文件（作为文本块）和 JPEG 文件（作为 XMP），因此其他程序也能显示这些信息。
- **File ▸ Print…**（Ctrl+Shift+P；Ctrl+P 用于把提示词面板调到最前面）：缩放以适合页面、以 cm 或英寸指定尺寸，或按百分比缩放；纵向、横向或与图片方向一致。点击 OK 会打开系统的打印对话框，你可以在其中选择打印机、纸张和份数，或另存为 PDF。
- **File ▸ Automate ▸ Contact Sheet…**：把多张图片以网格形式排列到一个新文档上。可以选择文件或使用已打开的文档；选择页面（A4、Letter 或 1920 x 1080）、列数和行数、边距，以及显示文件名的图注。每张图片单独占一个图层；图片多到一页放不下时会另起一页。
- **File ▸ Automate ▸ Crop and Straighten Photos**：适用于一次扫描了多张照片的扫描件。程序会以纯色的页面为背景找出每张照片，将其摆正，并分别作为独立的文档打开（命名为“<scan> photo 1”“photo 2”……）。

## Brush Settings、画笔预设和 .abr 画笔——第 E 轮（2.484.0）
<!-- en: brush-settings-brush-presets-and-abr-brushes-round-e-2-484-0 55f043131c33 -->

**🖌 Brush** 选项卡（位于 Properties 组中；也可通过 Window ▸ Brush Settings 打开）用于设置 Brush、Pencil 和 Eraser 工具所使用的画笔。

- 顶部的**预设**：bitGen 自带的 20 个、你自己创建的，以及你导入的。点击即可使用。
  - **⤒ Import .abr…** 从画笔文件（.abr 版本 1、2、6、7 和 10）中导入采样画笔。每个采样画笔都会成为一个绘制其图案的预设。
  - **💾 New Brush Preset…** 以一个名称保存当前画笔及其全部设置。你的预设位于安装文件夹中的 **brushes/<name>.json**；复制这些文件即可分享。
  - **🗑 Delete** 删除你自己的某个预设；**↺ Reset** 将内置预设恢复为初始状态。
- **Brush Tip Shape**：Angle、Roundness（扁平的书法笔尖）、Hardness、Spacing、Flip X / Y。
- **Shape Dynamics**（勾选该部分即可启用）：Size jitter + 最小直径；Size control（关闭、笔压，或在 N 步内渐隐）；Angle jitter + Angle control（关闭、笔画方向、笔压）；Roundness jitter + 最小值；Flip X / Y jitter。
- **Scattering**：Scatter（占画笔尺寸的百分比，沿笔画的横向或两个轴向）、Count、Count jitter。
- **Texture**：Noise、Canvas、Paper，或图案库中的任意图案。Scale、Depth、Multiply / Subtract、Invert。纹理固定在图片上。
- **Dual Brush**：第二个笔尖（任意预设）切入第一个笔尖，可设置其尺寸、散布和数量。
- **Color Dynamics**：前景 / 背景抖动；色相、饱和度和亮度抖动；Purity；按每个笔尖应用，或每个笔画只应用一次。
- **Transfer**：Opacity jitter、Flow jitter、由笔压控制。
- **Smoothing**（0-95 %）：画笔像被一根绳子牵着一样跟随指针，使线条更稳定。
- 每个预设都保存自己的设置：内置预设保存在本机的编辑器设置中，你自己的预设保存在其文件中。

## Navigator、Histogram、Info、测量工具、Grow / Similar / Focus Area、Matting——第 D 轮（2.483.0）
<!-- en: navigator-histogram-info-measuring-tools-grow-similar-focus-area-matting-round-d d4bf1da10324 -->

- **面板**（Color 组中的选项卡，以及 Window 菜单）：
  - **Navigator**：整张图片的缩略图，当前视图以红框表示。在其上点击或拖动可移动视图；滑块用于缩放。
  - **Histogram**：整张图片或选中图层（有选区时仅统计选区内）的 RGB、Luminosity、Red、Green、Blue 或 Colors 直方图。它显示 Mean、Std dev、Median 和 Pixels，以及指针所在处的色阶、数量和百分位。
  - **Info**：指针所在处的 RGB、HSB 和 CMYK 值以及 X、Y 位置。它还显示文档尺寸、选区的尺寸和位置、标尺的长度和角度，以及每个颜色取样器的颜色。
  - **Notes**：图片上的所有注释；⌖ 跳转到注释，✕ 删除注释，双击可编辑注释。
- 吸管工具组中的**工具**（**I**，Shift+I 循环切换）：
  - **Color Sampler**：点击可放置最多 10 个取样器，拖动可移动取样器；Alt+点击可将其删除。Info 面板会读取这些取样器，Sample size 可以是单点、3 x 3 或 5 x 5。
  - **Ruler**：拖动进行测量（按住 Shift 以 45° 为步进）。**↻ Straighten Layer** 旋转当前图层，使测量线变为水平（或垂直）；**↻ Straighten Picture** 旋转所有图层。
  - **Note**：点击可钉上一条注释（附带作者）；点击注释可编辑，Alt+点击可删除。
  - **Count**：点击可在带颜色的计数组中放置编号标记（＋ Group、颜色、大小）。选项栏会显示计数；Alt+点击会删除最近的标记。
- **Perspective Crop**（位于 Crop 工具组中，**C**）：拖出一个框，把它的四个角移到最终应成为方正形状的物体边缘（如招牌、文件、建筑的正立面），然后按 **Enter**。整张图片会连同所有图层一起被裁剪并校正为方正。整个操作算一个撤销步骤。
- **Select ▸ Grow**（扩展到 Magic Wand 容差范围内的相邻像素）、**Similar**（所有与已选像素相似的像素）、**Focus Area…**（清晰的部分：In-focus range + Softness，实时预览）、**Transform Selection…**（移动、缩放和旋转选区本身）。
- **Layer ▸ Matting**：**Defringe…**（边缘像素采用相邻实色像素的颜色）、**Remove Black Matte**、**Remove White Matte**。
- 取样器、注释和计数标记属于各自的文档，并保存在该文档的 .bgi 中。

## Develop Filter 和 Lens Correction——图像编辑器功能补齐，第 C 轮（2.482.0）
<!-- en: the-develop-filter-and-lens-correction-the-image-editor-s-gap-round-c-2-482-0 e1ab499734e9 -->

- **Filter ▸ Develop Filter…**（**Alt+Shift+Ctrl+A**）是集成在一个对话框中的照片冲印工具。它可以实时预览，在选区内生效，算一个撤销步骤，并在智能对象上成为智能滤镜。它的选项卡如下：
  - **Basic**：Temperature、Tint、Exposure、Contrast、Highlights、Shadows、Whites、Blacks、Texture、Clarity、Dehaze、Vibrance、Saturation；**Black & White**；**✨ Auto** 根据图片自动设置曝光、对比度、白色和黑色。
  - **Curve**：Highlights / Lights / Darks / Shadows 滑块，以及点曲线（RGB、Red、Green、Blue）。
  - **Color**：颜色混合器：选择 Red、Orange、Yellow、Green、Aqua、Blue、Purple 或 Magenta，然后更改其 Hue（±30°）、Saturation 和 Luminance。在 Black & White 模式下，Luminance 决定每种颜色转换后的明暗。
  - **Grading**：为 Shadows、Midtones 和 Highlights 着色（色相、饱和度、明亮度）；Blending 和 Balance。
  - **Detail**：Sharpening（数量、半径、细节、蒙版：0 = 所有区域，数值越大 = 越只作用于边缘）、Noise reduction、Color noise reduction。
  - **Optics**：Distortion、Vignetting（+ 中点）、Defringe 紫边 / 绿边。
  - **Geometry**：Vertical / Horizontal perspective、Rotate、Scale、X / Y offset。
  - **Effects**：Grain（数量、大小、粗糙度）和裁剪后暗角（数量、中点、圆度、羽化）。
  - **Presets**：Vivid、Matte、Warm film、Cool night、Portrait soft、Landscape punch、Black & White、Teal & orange。**💾 Save as preset** 保存你自己的预设（保存在编辑器设置中），**↺ Reset all** 清除所有设置。
- **Filter ▸ Lens Correction…**（**Alt+Shift+Ctrl+R**）：消除畸变（桶形 / 枕形）、修复红 / 青和蓝 / 黄色边、暗角（数量、中点）、垂直 / 水平透视、角度、缩放，以及 **Edge** 的填充方式（边缘扩展、透明、某种颜色）。对话框打开时，图片上方会显示**网格**，便于校正水平。

## 新增 44 个滤镜——图像编辑器功能补齐，第 B 轮（2.481.0）
<!-- en: 44-more-filters-the-image-editor-s-gap-round-b-2-481-0 7aabbf06ed3d -->

**Filter** 菜单现在有十二个子菜单：Artistic、Blur、Blur Gallery、Distort、Noise、Other、Pixelate、Render、Sharpen、Sketch、Stylize 和 Texture。每个滤镜都可以实时预览、在选区内生效、算一个撤销步骤，可以用 **Ctrl+F** 重复、录制到动作中，并在智能对象上成为**智能滤镜**。

- **Blur**：**Surface Blur**（在保留边缘的同时进行平滑：Radius + Threshold）、**Smart Blur**（Normal / Edge Only / Overlay Edge）、**Average**、**Lens Blur**（依据透明度或亮度确定深度、焦距、光圈形状（圆形、3-8 片光圈叶片）、叶片旋转、用于散景的镜面高光、杂色）。
- **Blur Gallery**：**Field Blur**（两到三个图钉，每个都有自己的模糊程度）、**Iris Blur**（一个保持清晰并向外渐隐的椭圆；**点击图片可放置其中心**）、**Path Blur**（沿曲线的运动模糊：起点、弯曲、终点、速度、渐细）、**Spin Blur**（绕一个椭圆旋转一定角度；点击可放置）。
- **Noise**：**Reduce Noise**（强度、保留细节、颜色杂色、锐化细节）、**Dust & Scratches**（半径 + 阈值）、**Despeckle**。
- **Sharpen**：**Smart Sharpen**（数量、半径、减少杂色；按角度移除高斯模糊、镜头模糊或动感模糊；在阴影 / 高光中减弱锐化）。
- **Other**：**High Pass**、**Minimum**、**Maximum**（方形或圆形）、**Offset**（折回 / 重复边缘像素 / 透明）、**Custom**（自定义 5 x 5 卷积核，带有预设、缩放和偏移）、**HSB / HSL**。
- **Distort**：**Displace**（使用来自某个图层或合并图片的置换图：红色通道横向移动像素，绿色通道上下移动像素）、**Polar Coordinates**（双向转换）、**Pinch**、**ZigZag**、**Shear**（通过顶部 / 中部 / 底部进行弯曲）、**Glass**（磨砂、块状、画布、小镜头）。
- **Pixelate**：**Color Halftone**（C / M / Y / K 网点按各自的角度排列）、**Crystallize**、**Pointillize**、**Facet**、**Fragment**、**Mezzotint**（点、线、描边）。
- **Render**：**Lighting Effects**（聚光灯、点光源或无限光；颜色、强度、光源位置和照射方向、光锥 + 热点、环境光、光泽；根据亮度或透明度生成高度纹理）、**Fibers**、**Difference Clouds**。
- **Stylize**：**Diffuse**（正常、仅变暗、仅变亮、各向异性）、**Tiles**、**Trace Contour**。
- **Artistic**：**Cutout**、**Poster Edges**、**Watercolor**、**Dry Brush**。**Sketch**：**Graphic Pen**、**Charcoal**。**Texture**：**Grain**（7 种）、**Craquelure**。

## 更多调整和 Apply Image——图像编辑器功能补齐，第 A 轮（2.480.0）
<!-- en: more-adjustments-and-apply-image-the-image-editor-s-gap-round-a-2-480-0 e925d9f90010 -->

**Image ▸ Adjustments** 中的新功能。每一项都可以实时预览、在选区内生效、算一个撤销步骤，并可以用 Ctrl+F 重复、用作智能滤镜或录制到动作中：

- **Shadows / Highlights**：*局部*提亮阴影并压暗高光。**Amount** 设置调整的程度，**Tone** 设置作用延伸到中间调的范围，**Radius** 设置所参考的邻域大小。**Color correction** 恢复被更改区域的颜色，**Midtone contrast** 作用于两者之间的区域。
- **HDR Toning**：在单张图片上实现“HDR 效果”。**Edge glow**（半径 + 强度）使整张图片的光线均匀，然后用 **Gamma**、**Exposure**、**Detail**、**Vibrance** 和 **Saturation** 完成处理。
- **Selective Color**：选择一个范围（**Reds, Yellows, Greens, Cyans, Blues, Magentas, Whites, Neutrals, Blacks**），然后在其中增加或减少 **Cyan, Magenta, Yellow and Black**。**Relative** 按现有油墨量的比例进行调整；**Absolute** 直接加上设定的数值。
- **Replace Color**：**点击图片**拾取颜色（或手动设置），设置 **Fuzziness** 以决定颜色需要多接近，然后调整其 **Hue / Saturation / Lightness**。
- **Match Color**：让图层采用另一来源的颜色：**Source** = 另一个图层、合并图片或某个图片文件（🖼…）。然后设置 **Luminance**、**Color intensity**、**Fade**，并用 **Neutralize** 去除色偏。
- **Color Lookup**：3D LUT。选择时间线的某个 **looks**（调色效果），或 LUT 库中的某个 **.cube**（与时间线的 Colour 面板共用）；**＋ .cube…** 可添加你自己的文件。**Amount** 控制混合的程度。
- **Image ▸ Apply Image…**：将另一个图层（或合并图片），或其某个通道（RGB、Red、Green、Blue、alpha、luminosity），以反相或不反相的方式混合到当前图层上。共有 11 种混合模式，另有 Opacity 和 Preserve transparency。
- **调整图层**：新增 **Selective Color** 和 **Color Lookup**（Layer ▸ New Adjustment Layer，以及 Adjustments 面板）；在 Properties 中编辑它们。

## JPEG XL（.jxl）图片（2.479.0）
<!-- en: jpeg-xl-jxl-pictures-2-479-0 2d2afe86f852 -->

- 像打开其他图片一样，在图像编辑器中 **Open**（打开）.jxl 文件：File ▸ Open、拖放到画布上、Place，或从项目中打开。其像素会原样导入（每通道 8 位，sRGB；动画文件取第一帧）。
- **Export As ▸ Format: JPEG XL**：**Quality**（1-100），或 **Lossless**（精确保留每个像素，并且通常比 PNG 小得多）。可以 ⤓ Download，或使用 **Save to Images**，将其作为 .jxl 保存到项目的图片中。
- **应用的其他部分**：.jxl 图片可以显示在 Assets 面板、图库、媒体查看器、文件对话框的预览以及时间线上。浏览器本身无法显示 JPEG XL，因此工作室会向显示它的地方提供该图片的 PNG 版本。直接读取文件本身的功能则会得到 .jxl。
- **生成和编译**：用作参考图的 .jxl 会以 PNG 形式发送给 ComfyUI（ComfyUI 无法读取 JPEG XL）。仍在时间线上的 .jxl 会使用其 PNG 版本进行编译。上传到项目图片以外任何位置的 .jxl 都会以 PNG 形式存放。
- 一切都在本机上运行：编解码器（读取用 jxl-oxide，写入用 libjxl）位于 static/vendor/jxl/。

## 在所有下拉列表中搜索（2.478.0）
<!-- en: search-in-every-dropdown-list-2-478-0 e687afbd4caf -->

- 所有**包含 8 个或更多项目的下拉列表**——无论位于面板、图像编辑器、时间线、Settings 还是任何对话框中——打开时顶部都有一个 **🔍 搜索框**，与节点搜索类似：
  - **输入**文字，列表会随输入逐步缩小，最佳匹配排在最前：先是词首匹配，然后是任意位置匹配，最后是按顺序出现的字母（“flx2”可以找到“FLUX.2 [dev]”）。匹配的字母会高亮显示，输入分组的名称可以找到该组中的项目。“12 of 340”显示剩余的项目数。
  - **↑ ↓**、**PgUp / PgDn**（Ctrl+Home / Ctrl+End 跳到第一行 / 最后一行）移动高亮行；按 **Enter** 或**点击**即可选中该行；**Tab** 选中高亮行并移到下一项；按 **Esc** 或点击列表外部会关闭列表，且不做任何更改。
  - 当某个列表获得焦点时，按**任意字母**即可将其打开并直接搜索该字母；**Alt+↓**、**F4**、**Space** 或 **Enter** 可打开列表；↑ ↓ 仍可在不打开列表的情况下逐项切换。
- **Settings ▸ General ▸ Dropdown lists**：“Search in lists with N or more items”（默认为 8；**0** = 始终使用普通列表）。该设置保存在当前浏览器中。

## 公开测试版：代码仓库、哪些功能是实验性的、报告问题（2.477.0）
<!-- en: the-public-beta-the-repository-what-is-experimental-reporting-a-problem-2-477-0 98895596651d -->

- bitGen Studio 现已进入**公开测试版**阶段，并拥有自己的代码仓库：其中包括源代码、各类指南、Feature Reference PDF、更新日志（**CHANGELOG.md**，涵盖每个版本），以及 **Releases** 页面上的安装程序。
- **docs/BETA.md** 说明了哪些功能已经稳定、哪些仍是**实验性**的：Unreal Engine 桥接（针对 Unreal 5.8 编写，已在替代环境中测试，尚未在真正的 Unreal Editor 中测试）、Daz Studio 实时链接、Unreal 透明渲染，以及 macOS（MiniMax H3 视频需要 NVIDIA CUDA）。
- **报告问题**：使用 **Bug report** 模板创建一个 issue。请提供版本号（package.json，或你下载的发行版）、操作系统 / 显卡、你做了什么以及发生了什么（附截图或简短的录屏），以及 Console 面板的最后几行内容。如果涉及 Unreal 桥接，请附上 Unreal Output Log 中的 `[bitGen Bridge]` 行。**切勿**公开你的 custom.settings（其中包含你的文件夹路径和令牌）。
- **更新**：下载更新的发行版，或执行 `git pull`，然后重新运行 start.bat / misc/bitgen-studio.sh。你的项目、设置、模型和风格都不在代码仓库中，因此更新不会影响它们。
- **参与贡献**：CONTRIBUTING.md 介绍了环境搭建、代码的存放位置（routes/ + lib/，每个面板都是 ext/ 中的一个扩展）、测试（`bash scripts/ci-units.sh`——GitHub 在每次推送时都会运行它），以及需要同步更新的文档。

## Unreal 灯光、体积光与雾——在图像编辑器和时间线中（2.476.0）
<!-- en: unreal-lights-volumetric-lights-and-fog-in-the-image-editor-and-the-timeline-2-4 722949754ccd -->

- **更新插件**为 **bitgen-ue-bridge-1.2.0.zip**（灯光和雾由它放置）。
- 对 Unreal 或 MetaHuman 图层使用 **Image editor ▸ UNREAL ▸ Lights & Fog**（或 Properties 中的 **💡 Lights** 选项卡，Window ▸ Unreal Lights）：
  - **＋ Lights from a preset**（从预设添加灯光）：Three-point（三点布光：主光、补光、轮廓光）、Golden hour（黄金时刻：低角度的暖色太阳 + 天空光）、Night street（夜晚街道：一盏暖色聚光灯 + 冷色补光）、Neon（霓虹：品红 + 青色矩形灯，配合体积雾）、Studio softbox（影棚柔光箱）。
  - **＋ Point / Spot / Rect / Sun / Sky**：为摄像机放置一盏新灯——位于前方、偏上并偏向一侧，对准拍摄主体。
  - 每盏灯可设置：**颜色**或以开尔文表示的**色温**、**强度**（坎德拉；太阳光为勒克斯）、**照射范围**、**柔和尺寸**、聚光灯的**锥角**、矩形灯的**尺寸**、**Volumetric**（体积光，即它照亮体积雾的强度——形成光束）、**阴影**、**位置**（X Y Z）和**朝向**（roll 翻滚、pitch 俯仰、yaw 偏航）；☐ 关闭该灯，✕ 删除该灯。
  - **Fog**（雾）：高度雾（密度、衰减、颜色、起始位置）和**体积雾**（反照率、消光、作用距离），以及雾预设（light haze 薄霾、morning mist 晨雾、thick volumetric 浓重体积雾、cinema smoke 电影烟雾）。
  - **Keep them in the Unreal level**（保留在 Unreal 关卡中）：不勾选时，bitGen 的灯光和雾（命名为 bitGen_*）只在生成这张图片时存在。
  - 每次更改都会重新渲染该图层——**一个撤销步骤**。
- **UNREAL ▸ Lights** 是**灯光工具**：每盏灯都会在图片中其所在位置显示一个标记（聚光灯或矩形灯还会显示其照射方向）。在图片上**拖动**标记（与摄像机的距离保持不变），**Shift + 拖动** = 拉近 / 推远，**Alt + 拖动** = 转动其朝向；Del 删除选中的灯。
- **Timeline ▸ UNREAL ▸ Lights & Fog…**（选中 Unreal、MetaHuman 或 Unreal 摄像机片段时）：同样的面板，另有 **⇦ The image editor's lights**，可引入图像编辑器中该图层的灯光和雾；**Render** 用这些设置重新生成该片段。

## 图像编辑器中的 Unreal 摄像机：移动、镜头、光圈值、曝光、预设（2.475.0）
<!-- en: the-unreal-camera-in-the-image-editor-move-it-lens-f-stop-exposure-presets-2-475 088c8621518d -->

- **更新插件**：将 **bitgen-ue-bridge-1.1.0.zip**（或更新版本）解压到项目的 Plugins 文件夹中，覆盖旧版本（摄像机镜头、"To Unreal's viewport" 和 "Click to focus" 都需要它）。
- **UNREAL ▸ Camera**（选中 Unreal 或 MetaHuman 图层时）是 **Unreal 摄像机工具**——在图片上拖动即可在场景中移动摄像机：
  - **拖动** = **Orbit**（围绕注视点环绕：以对焦距离为准，未设置时为 5 m），**Ctrl + 拖动** = **Look**（原地转动：yaw / pitch），**Shift + 拖动** = **Pan**（平移），**Alt + 拖动** = **Roll**（倾斜地平线），**滚轮** = **Dolly**（前后推拉），**Ctrl + 滚轮** = **缩放**（焦距）。
  - 这些模式也是选项栏上的按钮（Orbit、Look、Pan、Dolly、Roll、**Focus**：点击需要清晰的位置，Unreal 会测量距离）。
  - 拖动时 Unreal 会绘制小尺寸预览；松开后以完整尺寸渲染——**一个撤销步骤**。三分线和对焦点会叠加显示在图层上。
- **🎥 Camera 选项卡**（Properties；**Window ▸ Unreal Camera**；UNREAL ▸ Lens & Exposure）：
  - **Presets**（预设）：18 mm 到 200 mm 的各种镜头、微距、变形宽银幕风格——还可以用 **＋ Save** 保存你自己的预设。
  - **Lens**（镜头）：焦距（滑块 + 数值）与**视野**联动，**底片规格**（全画幅、Super 35、APS-C、Micro 4/3、IMAX、手机）。
  - **Depth of field**（景深）：**f-stop**（光圈值，f/1.2 - f/22）和**对焦**距离（0 = 全部清晰），**🎯 Click to focus**。
  - **Exposure**（曝光），单位为 EV（-5 … +5）。
  - 以数值设置**位置**（X Y Z，cm）和**转向**（roll、pitch、yaw，°）；**⇩ From Unreal's viewport**、**⇧ To Unreal's viewport**（Unreal 通过此摄像机观察），**⟳ Render**。
- **时间线**：Unreal 摄像机的 UNREAL ▸ Keys… 现在新增 **Lens** 行（焦距、光圈值、对焦、曝光），供其渲染使用。

## 无工具状态、选择框与同时选中多个图层（2.474.0）
<!-- en: no-tool-the-selection-box-and-several-layers-at-once-2-474-0 c602f4827f16 -->

- **Esc** 放下工具：不选任何工具，也不选中任何对象。（工具自身的 Esc——结束钢笔路径、取消裁剪或多边形套索——仍然优先；在没有工具且未选中任何对象时，Esc 的作用与以前相同，例如退出全屏。）按工具的字母键（V、M、B…）可再次选择工具。
- **没有工具时**，鼠标悬停在对象上会显示蓝色轮廓；**点击**即可选中（按住 **Shift** 或 **Ctrl** 可将其加入选中项或从中移除）。在图片上**拖动**，会有一个**虚线框**跟随指针：
  - **从左向右**（蓝色）选中**完全位于**框内的所有图层，
  - **从右向左**（绿色）选中框**触及**的所有图层，
  - 按住 **Shift** 保留已选中的对象并继续添加。点击空白处则取消所有选中。
- **Layers 面板**：点击选中一个图层；**Shift-点击**选中上次点击的图层与当前图层之间的所有图层；**Ctrl-点击**添加或移除一个图层。选中的行会高亮显示（其编号 1、2、3 仍是 ✨ Compose 和 → References 所用的顺序）。
- 选中多个图层时，**Move tool**（移动工具）会将它们一起移动（一个撤销步骤），**Del** 会将它们全部删除（一个撤销步骤）。存在像素选区时，Del 仍然是清除选中的像素。

## 功能参考 PDF（2.473.0）
<!-- en: the-feature-reference-pdf-2-473-0 930b69ae4c5e -->

- **docs/bitGen-Studio-Features.pdf** 列出了 bitGen Studio 迄今为止的全部功能——约 575 项，分为十个领域（工作区、生成视频、图像、音乐与声音、时间线、图像编辑器、CAD 与 3D、桥接、交付、快捷键）：每项功能的作用、所在位置以及自哪个版本起提供。文档开头是各领域一览（每项都是链接），并按领域和子领域设有书签。
- 它在每次发布时由 **docs/FEATURES.md** 生成（`python3 scripts/make_features_pdf.py`），与 Guide（分步说明 + 快捷键）和宣传手册配套。

## Unreal Engine 5.8 桥接：Unreal 图层、MetaHuman 图层、Unreal 摄像机（2.472.0）
<!-- en: the-unreal-engine-5-8-bridge-unreal-layers-metahuman-layers-the-unreal-camera-2- b76a75ae9a27 -->

- **一次性安装**（2.513.0 起：也可以交给 bitGen 完成——菜单栏中的 🎮 Load UE project）：将 **bitgen-ue-bridge-1.1.0.zip**（或更新版本）解压到 Unreal 项目的 **Plugins** 文件夹（`<Project>\Plugins\bitGenBridge`），打开项目并启用它要求的插件（Python Editor Script Plugin、Editor Scripting Utilities、Sequencer Scripting、Movie Render Queue）。Output Log 中会显示 "[bitGen Bridge] listening"。在 bitGen 中：**Settings ▸ 3D ▸ Unreal Engine ▸ Test connection**。它只在本机（127.0.0.1）上工作；端口为 30020，除非你在两端同时修改。
- 如需**透明背景**（MetaHuman 图层），请在 Unreal 中开启 Project Settings ▸ Rendering ▸ Post Processing ▸ "Enable alpha channel support in post processing"（zip 中的 README 有操作说明；如果 alpha 是反的，可用 Settings 中的 "alpha is inverted" 修正）。
- **Image editor ▸ UNREAL** 选项卡（位于 CAD 工具栏上，或 Layer ▸ New Unreal Layer… / New MetaHuman Layer…）：
  - **Unreal Layer**：通过所打开项目的某台摄像机（或保持当前状态的关卡视口）观察到的一个关卡，按你选择的尺寸生成——一个可以移动、缩放、加滤镜和蒙版的图片图层。
  - **MetaHuman Layer**：项目中的一个 MetaHuman，摆出某段动画在某一时刻的姿势，以 **Face / Bust / Full body** 构图并可转向，背景透明。
  - **🎮 Unreal** 选项卡（Properties）可微调摄像机（Turn、Tilt、Dolly、Field of view）或人物（构图、转向、姿势时间），然后 **⟳ Renders again**——一个撤销步骤。**Use Viewport** 立即采用 Unreal 当前的视口摄像机。
- **Timeline ▸ UNREAL** 选项卡：
  - **Unreal Layer**：项目中的一个 **Level Sequence**（或通过摄像机 / 视口观察的关卡，静止画面），由 Unreal 的 **Movie Render Queue** 以时间线的尺寸和 fps 渲染 -> 在播放头处生成视频图层 **UE1**。
  - **MetaHuman Layer**：一个播放动画的 MetaHuman，带构图和转向，背景透明 -> **MH1**。
  - **Unreal Camera**：你自己的摄像机——第一个关键帧取自 Unreal 的视口（或关卡中的某台摄像机）；在 Unreal 中移动视口，把播放头移到后面的位置，然后按 **＋ Key**；**Keys…** 用于编辑关键帧（时间、位置、转向、视野——摄像机在关键帧之间直线移动）；**Render Again** 通过它渲染关卡 -> **UE Cam1**。
  - 每个片段都会记住自己的生成方式：修改 Unreal 项目后，用 **Render Again** 即可重新生成。

## 参数化 3D 实体：Extrude、Revolve、Fillet、Chamfer、Shell、Split Body（2.471.0）
<!-- en: parametric-3d-bodies-extrude-revolve-fillet-chamfer-shell-split-body-2-471-0 63bdeef9db33 -->

- CAD 工具栏上的 **SOLID** 选项卡（以及 Layer ▸ Extrude… / Revolve… / Fillet… / Chamfer… / Shell… / Split Body… / Change Parameters…）。先绘制一个闭合草图（SKETCH 选项卡），然后：
  - **Extrude**（拉伸）：草图的闭合轮廓（全部轮廓——孔洞会被挖空——或你勾选的轮廓）、距离、One side / Symmetric / Two sides、起始偏移。**New Body** 新建一个**实体图层**；**Join / Cut / Intersect** 作用于你选中的实体。
  - **Revolve**（旋转）：绕草图的 X 轴、Y 轴或其中一条线旋转，角度最大 360°。
  - 对锐边进行 **Fillet**（圆角）/ **Chamfer**（倒角）——全部边、顶部或底部的边、竖直边，或环绕各面的边。**Shell**（抽壳）将实体挖空，在顶部或底部开口。
  - **Split Body**（分割实体）：一个平面（XY / XZ / YZ，位于指定距离）；本图层保留一侧，另一侧成为一个**新的实体图层**。两者都保持参数化。
- **参数化**：每个数值都是可以输入的算式——`25`、`depth`、`depth / 10 + 2`、`1 in`、`30 deg`（输入时即显示计算结果）。**ƒx Change Parameters** 为你的数值命名（每个参数都可以引用其他参数）；修改其中一个，所有使用它的特征都会随之更新。之后编辑**草图**，其实体会自动重建。
- **🧊 Body** 选项卡（Properties）按顺序列出各个**特征**：☑ 关闭某个特征（抑制），✎ 或双击进行编辑，↑ ↓ 调整顺序，✕ 删除。失败的特征以红色显示并给出原因；实体的其余部分保持不变。下方依次是：**View**（Home / Front / Back / Top / Bottom / Right / Left，Turn / Tilt / Roll，**🖐 Orbit**
  - 在画布上拖动实体）、**Look**（颜色、金属度、粗糙度、边线、细节）和 **Export**（STL、glTF .glb、STEP、→ Timeline）。每次更改都是一个撤销步骤。
- 实体图层是一个**智能对象**：移动、缩放、旋转、变形、滤镜和蒙版都对它有效。
- **Settings ▸ 3D** 用于选择引擎：**In the browser (OpenCascade)**——精确实体，无需安装任何东西——或 **Blender (on this computer)**。两者构建出的实体相同。
- **时间线**：SOLID ▸ **Body → 3D Layer** 将实体作为 3D 图层放到时间线上（可旋转、打光、设置关键帧）。在图像编辑器中修改实体后，其 3D 图层会自动更新（也可用 **Update Bodies** 手动更新）；**Edit in Image Editor** 会在图像编辑器中选中它。

## 像绘图软件一样选取 + CAD 工具栏（2.470.0）
<!-- en: picking-like-a-drawing-program-the-cad-toolbar-2-470-0 58f8eaf21084 -->

- **悬停 / 选中轮廓**：使用 **Move** 工具时，指针下方的形状、智能对象、文字、草图、3D 图层或图片内容会显示**蓝色**轮廓——表示可以选取。选中的对象显示**橙色**轮廓（以及移动工具的控制柄）。背景属于画布，不是对象。
- **点击**对象 = 选中它（按住并拖动 = 选中并同时移动）。**点击空白画布** = 取消选中（控制柄消失；从空白处开始的拖动不会移动任何东西）。**Esc** = 取消选中。在 Layers 面板中点击可重新选中该图层。存在活动选区（或开启了 Auto-select）时，移动工具的行为与以前相同。
- **绘制形状后**（Shape、Custom Shape、Rectangle、Ellipse、Polygon、Star、Spiral、Graph Paper、常用形状、2-Point Line），会自动切换到 **Move tool** 并选中新形状。可以用 CAD 工具栏上的 **⚙** 关闭此行为（或 SHAPES ▸ AFTER DRAWING ▸ Then Move）。
- **CAD 工具栏**位于图像编辑器顶部，工具选项的上方：
  - **SKETCH**：CREATE（Create Sketch、Line、2-Point / Center Rectangle、Center / 2-Point / 3-Point Circle、3-Point Arc、Polygon、Slot、Spline、Point），MODIFY（Fillet、Trim、Offset、Chamfer、Extend、Mirror、Rectangular / Circular Pattern、Construction），CONSTRAINTS（12 个针对所选对象的小按钮），INSPECT（Sketch Dimension、Measure），INSERT（导入 DXF，导出 DXF / SVG），FINISH SKETCH（+ Profiles → Shapes）。
  - **SHAPES**：SELECT（Move、Pick Nothing），DRAW（各形状工具），AFTER DRAWING。
  - 大按钮显示最常用的工具；**GROUP ▾** 列出该组的全部工具。选项卡会随你的工作自动切换（使用草图工具或选中草图图层 -> SKETCH）。**⌃** 将其折叠为只显示选项卡；**Window ▸ CAD Toolbar** 隐藏 / 显示它。
- **时间线**的预览行上方也有同样的工具栏：**CREATE**（Text、3D Text、3D Model…、Camera、Path、Move / Hand / Zoom / Fit / Select / Mask），**3D**（选中 3D 图层时：控件、视图、◇ Key、Bake）和 **SKETCH**（**Sketch on This Frame**——播放头所在的帧会在图像编辑器中打开，并带一个新的草图图层；**Sketch on a Blank Picture**——一张与时间线尺寸相同的空白图片）。使用移动工具时，指针下方的片段会在预览上显示蓝色轮廓；选中的片段保持橙色。

## 链接的智能对象、保留 PSD 智能对象、.atn 动作（2.469.0）
<!-- en: linked-smart-objects-psd-smart-objects-kept-atn-actions-2-469-0 d6f17c8e3119 -->

- **File ▸ Place Linked…**：将你电脑上的一张图片放入项目的 **linked** 文件夹，并作为**链接的智能对象**导入（在 Layers 面板中显示 🔗）。其内容保存在该文件中：修改该文件（用任何程序修改，或另存一个新文件覆盖它），图层就会随之更新——在编辑器重新获得焦点时、每隔 20 秒，或通过 Layer ▸ Smart Objects ▸ **Update Modified Content**。其位置、尺寸、变形和智能滤镜保持不变。
- **Layer ▸ Smart Objects**：**Convert to Linked…**（将嵌入式智能对象的内容保存到 linked 文件夹，该图层及其副本改为链接），**Embed Linked**（去掉链接，保留内容），**Relink to File…**（改为链接 linked 文件夹中的另一张图片）。对链接对象使用 **Edit Contents** 时：✔ Done 还会把新内容写入其文件。文件丢失时显示 ⚠🔗。
- **PSD**：内容嵌入在 PSD 中的智能对象（PNG、JPEG、GIF 或 PSD）现在会**作为智能对象**打开——保留其内容和变换，因此缩放时不会损失画质；保存 PSD 时，智能对象会写回为嵌入内容的置入图层（经过变形的则以像素形式写入）。
- **Actions ▸ Load Actions…** 也支持 **.atn** 动作文件：动作组及其中的动作都会导入；录制的步骤会转换为此处对应的步骤——Gaussian Blur、Unsharp Mask、Median、Invert、Desaturate、Equalize、Posterize、Threshold、Mosaic、Add Noise、Emboss、Brightness / Contrast、Hue / Saturation（连同其设置）、Duplicate / New / Delete Layer、Merge Down、Flatten、Select All、Deselect、Inverse、不透明度、填充、混合模式、Rotate、Flip、Stop。没有对应项的步骤会以**关闭状态**导入，并以原步骤命名，以便其余步骤照常播放。

## 动作：录制画笔笔触与手动选区、条件、Image Processor、快捷批处理（2.468.0）
<!-- en: actions-brush-strokes-hand-made-selections-recorded-conditionals-image-processor 86a080ecfddf -->

- **录制**（Actions 选项卡，●）现在还会记录：
  - Brush、Eraser、Pencil、Smudge 及其他画笔工具的每一道**画笔笔触**——位置、大小、画笔、不透明度、流量和颜色。播放时会在图片的相同位置重新绘制（随图片尺寸缩放）；之后会恢复你自己的工具和颜色。
  - 每个**手动创建的选区**（选框、套索、魔棒、快速选择、快速蒙版、Deselect ...）——记录其轮廓，因此在更大或更小的图片上播放时也会得到相同的选区。
- **☰ ▸ Actions: Insert Conditional…**：如果文档为横向 / 纵向 / 方形、有选区 / 无选区、图层为像素 / 文字 / 形状 / 调整图层、有多个图层——**则**播放一个动作，**否则**播放另一个。条件可以调用自身也含有条件的动作。
- **File ▸ Scripts: Image Processor…**：选择图片（文件或文件夹）；将每张图片保存为 **JPEG**（品质 1-12，缩放以适合 W x H）和 / 或 **PNG**（缩放以适合），可选择先播放一个动作——保存到项目的 batch/<name>-JPEG 和 -PNG 文件夹，或直接下载。
- **File ▸ Automate: Create Droplet…**：将一个动作 + 结果的去向（项目 / 图库 / 下载，PNG 或 JPEG）做成 Actions 选项卡底部的一个 **💧 droplet tile**（快捷批处理磁贴）：把图片拖放到上面（或点击它选择图片），每张图片都会被打开、播放该动作并保存结果（即 Batch）。磁贴上的 ✕ 可将其删除。

## 编辑单个颜色通道；专色通道（2.467.0）
<!-- en: editing-single-colour-channels-spot-channels-2-467-0 0bf99df5156b -->

- **编辑单个颜色通道**（Channels 面板，位于 Layers / Paths 旁）：点击 **Red**、**Green** 或 **Blue**——此后绘画、擦除、填充、滤镜和调整**只改变该通道**（面板将其标记为 ✎ 并以灰度显示）。**Shift-点击**另一个通道可同时编辑两个（以彩色显示，但不含第三个通道）。**RGB**（或 Ctrl+2）= 恢复全部通道；Ctrl+3 / Ctrl+4 / Ctrl+5 以同样方式选择 Red / Green / Blue。只编辑部分通道时，图层的透明度永远不会被改变。
- **专色通道**：Channels 面板中的 **◍**（或 Select ▸ New Spot Channel…）——设置名称、**油墨颜色**及其**密度**（0 = 透明光油，100 = 完全遮盖）；当前选区成为其油墨。其油墨叠加显示在图片上（合并之前不在图层中）；双击其色块可打开选项。
- **绘制 Alpha 通道或专色通道**：选中其所在行，点击 **✎**——画笔增加内容，橡皮擦减去内容（显示方式与快速蒙版相同）；**✔**（或 Q）将其保留为一个撤销步骤。选区不受影响。
- **⇣ Merge Spot Channel**（或 Select ▸ Merge Spot Channel）：其油墨成为最上方的一个图层，该通道随之移除。.bgi 文件会保留专色通道及其颜色和密度。

## OpenType 特性、视觉字距、文字转轮廓、形状内文字、任意路径圆角（2.466.0）
<!-- en: opentype-features-optical-kerning-type-to-outlines-text-in-a-shape-round-corners e5f54b6872e9 -->

- **OpenType**（Character 面板）：用于启用字体自身特性的按钮——Standard / Discretionary Ligatures、Contextual Alternates、Swash、Stylistic / Titling Alternates、Ordinals、Fractions、Oldstyle / Lining / Tabular Figures、Slashed Zero、字体自带的 Small Caps、Superiors / Inferiors——以及 **Stylistic set**（ss01-ss20）。文字随后会使用你电脑上该字体的字体文件进行排版，并以其字形绘制（面板会显示文件名）。电脑上没有对应字体文件的字体会照旧绘制，不带这些特性（面板会给出提示）。字符样式会保留这些设置。
- **Kerning ▸ Optical**（Character 面板）：根据字母的形状确定间距（使每对字母之间的空白与该字体自身的 "nn" / "oo" 一致），而不是根据字体的字距对——同样需要字体文件。
- **Layer ▸ Type: Convert to Shape**：文字图层变为由字母轮廓构成的形状图层（名称、颜色、位置、不透明度、样式均不变；可用 Direct Selection 工具编辑轮廓）。**Type: Create Work Path**：将轮廓生成为工作路径（文字保留）。两者都会保留你所做的全部设置——多行、段落文字、缩放、仿斜体、基线偏移、下划线 / 删除线、OpenType、旋转的文字。
- **形状内文字**：选中形状图层后，用 Type 工具在其轮廓**内部**点击（或 Layer ▸ Type: Text in the Picked Shape）——文字会在该轮廓内逐行排布（对齐、两端对齐、缩进、间距在其中同样有效；放不下的部分会被隐藏）。Convert to Point Text 可将文字移出形状。
- **任意路径圆角**（Direct Selection，A）：选项栏上的 **⌜ Radius** + **Round Corners** 对选中的角锚点进行圆角处理——未选中任何锚点 = 路径的所有角。适用于与其他形状组合（combined、merged）过的形状、路径和矢量蒙版；半径大于边长时会自动缩小以适应。

## 操控变形图钉的深度和旋转；修补工具的内容识别模式（2.465.0）
<!-- en: puppet-pin-depth-rotation-the-patch-tool-s-content-aware-mode-2-465-0 40f657cd577a -->

- **Puppet Warp**（Edit ▸ Puppet Warp）：选中的图钉（最后添加或点击的那个）现在有
  - 选项栏上的 **Pin Depth ⬆ / ⬇**：当变形使图层自身折叠重叠时，向前设置的图钉会将其所在部分绘制在上层，向后设置的则位于下层（图钉旁的数字即其深度）；
  - **Rotate Auto / Fixed** + 角度：Auto 让图钉周围的内容按网格的需要旋转（与以前相同）；Fixed 使其保持在设定的角度。**在选中的图钉附近 Alt-拖动**（在其虚线圆环上）可旋转它——它会变为 Fixed。这两项设置都会保存在智能对象的 Puppet Warp 中（在智能滤镜中双击它即可修改）。
- **Patch**（J 组）的选项栏上有 **Normal** 和 **Content-Aware**：
  - **Normal**（与以前相同——Source / Destination）+ **Transparent**（纹理只以一半强度覆盖原有内容）+ **Diffusion** 1-7（边缘的光线和颜色向内扩散的程度：颗粒或精细细节用低值，平滑区域用高值）。
  - **Content-Aware**：根据你拖动到的位置重建选区内容（不使用 AI）——**Structure** 1-7（7 = 只取自该位置，并保留其图案；1 = 也取自其周围）和 **Color** 0-10（0 = 保持其原有颜色；10 = 与周围融合）。
- **Content-Aware Move**：**Structure** 1-7（被移动部分周围融合边缘的宽窄：7 = 1 px）和 **Color** 0-10（被移动部分的颜色在多大程度上适应新位置）。

## 草图图层：输入尺寸、Measure 工具、单位、DXF / SVG 文件（2.464.0）
<!-- en: sketch-layers-typed-sizes-the-measure-tool-units-dxf-svg-files-2-464-0 1e45eb26917a -->

**草图图层**其余的 CAD 功能：绘制时的精确尺寸、测量，以及其他 CAD 程序能够读取的文件。
- **绘制时输入尺寸**：形状有了第一个点之后，直接**输入数字**——指针旁会弹出一个小输入框。**Line**：Length，**Tab** = Angle（与水平方向的夹角，逆时针，单位为度）；**Rectangle / Center Rectangle**：Width，Tab = Height；**Circle / 2-Point Circle**：Diameter；**Polygon**：Radius。按 **Enter** 即可绘制——未输入的值跟随指针（指针接近水平 / 竖直方向时，线保持水平 / 竖直）——输入的值会保留为**尺寸**（之后可以像其他尺寸一样修改）。连续线会继续绘制：可以直接输入下一段的长度。支持算式（100/3）。**Esc** 关闭输入框。
- **Measure**（选中草图工具时按 **M**，或 📐 Sketch 选项卡中的 📏）：点击点、线、圆、圆弧或样条曲线 = 显示其尺寸（长度、角度、半径、直径、周长、面积、扫掠角……）；再点击一个 = 测量两者之间（两点的距离及 ΔX / ΔY、点到线或圆的距离、两条线的夹角（平行线则为间距）、两个圆的圆心距和间隙）；在**闭合区域内部**点击 = 其**面积**和**周长**（扣除孔洞；圆弧精确计算）。数值显示在图片右上角的一个框中（📋 可复制）；Esc 清除。
- **单位**（📐 Sketch 选项卡 ▸ Measure + CAD files）：px，或 **mm / in** 并设置 "1 px = ..."——Measure 框和导出的文件都使用这些单位。
- **File ▸ Export Sketch as DXF…**：生成任何 CAD、激光或 CNC 程序都能打开的 R12 DXF——草图原点为 0,0，y 轴向上，使用所选单位；可按需包含构造线（图层 CONSTRUCTION）和尺寸（图层 DIMENSIONS）；样条曲线以多段线导出。**File ▸ Export Sketch as SVG…**：图片的尺寸（以 mm / in 表示的实际尺寸）、线条，以及（草图启用填充时的）轮廓区域。两者都保存在项目的 **cad** 文件夹中（同时会下载）。
- **File ▸ Import DXF…** / **Import DXF from Project…**：线、圆、圆弧、点、多段线（其弧形凸度 = 圆弧）、样条曲线和椭圆会导入到选中的草图图层（或新建一个）；文字、填充图案和块会被忽略（并提示忽略了多少）。可选择 **Fit to the picture** 或 **real size round the origin**（1 个图纸单位 = 若干 px）。相接的端点会被连接，因此闭合轮廓会立即成为一个轮廓区域（可用于 Fill profiles、Profiles → Shapes、测量其面积）。

## 草图修改工具：修剪、延伸、圆角、偏移、镜像、阵列、多边形、槽、样条曲线（2.463.0）
<!-- en: sketch-modify-tools-trim-extend-fillet-offset-mirror-patterns-polygon-slot-splin daa3f4be4396 -->

为**草图图层**提供更多 CAD 工具（**N** 工具组和 📐 Sketch 选项卡）。它们生成的所有内容都带有约束，因此草图会持续求解。
- **更多绘图工具**：**Polygon**（先点中心，再点一个角；在选项栏上设置 **Sides** 边数——一个虚线构造圆使各角都落在圆上，且各边相等），**Slot**（先点两个圆心，再确定宽度——两个半圆由切线相连，围绕一条构造轴），**2-Point Circle**（直径的两个端点），**3-Point Circle**（圆上的三个点），**Spline**（逐点点击；按 Enter 或双击结束——生成一条通过每个点的平滑曲线；之后可用 Sketch Select 拖动这些点）。
- **Trim**（**T**）：指向线、圆或圆弧的某一段——位于最近的交点 / 点之间的那一段会变红——点击即可将其剪掉（圆会变成圆弧；剪切后的端点仍停留在与之相交的对象上）。
- **Extend**（**E**）：在线的自由端附近点击，使其沿该方向延伸到下一条线或圆。
- **Fillet**（**F**）/ **Chamfer**：点击一个角（两条线的交汇处）或这两条线——生成带**半径**尺寸的相切圆弧，或带距离尺寸的直线切角；数值取自选项栏，之后可输入新值修改。
- 📐 Sketch 选项卡中的 **Modify (what is picked)**：
  - **⇉ Offset…**：在一侧按指定距离（px）生成副本；相连的链保持相连，线保持平行，圆 / 圆弧保持同心——该距离是一个可以修改的尺寸。
  - **⇋ Mirror**：先选中各对象，最后选择镜像线——生成的镜像副本相对于该线保持 **Symmetric**（对称）。
  - **▦ Rectangular Pattern…**（列数 / 行数及其间距）和 **✺ Circular Pattern…**（数量及分布的总角度；围绕选中的点或原点）——副本与原对象具有相同的约束。
- 每项操作都是一个撤销步骤；轮廓功能（⬚ Profiles → Shapes、Fill profiles）会立即识别新区域。

## 草图图层：带约束和尺寸的 CAD 草图（2.462.0）
<!-- en: sketch-layers-a-cad-sketch-with-constraints-and-dimensions-2-462-0 d640fb9dcdd7 -->

**草图图层**是一种 CAD 风格的 2D 草图：由**约束**和**尺寸**保持形状的线、矩形、圆和圆弧。修改尺寸，草图随之变化；拖动一个点，一切仍保持约束关系。
- **Layer ▸ New Sketch**（或直接用草图工具绘制）：生成一个草图图层（在 Layers 中显示 📐），带有一个固定的**原点**（红点）和两条穿过图片中心的构造轴。
- **草图工具**（工具栏中的 **N**，再按 N = 切换到下一个）。选中草图工具后，可用字母键选择其他工具：**S** Sketch Select、**L** Line、**R** 2-Point Rectangle（还有 Center Rectangle）、**C** Circle、**A** 3-Point Arc、**P** Point、**D** Sketch Dimension；**X** 将选中的对象转为构造线（虚线，永远不会绘制到图片中）；**Delete** 删除选中的对象；**Esc** 停止 / 取消选中。
  - **Line**：逐点点击（形成一条链）；按 **Esc**、双击或点击链的第一个点即可结束。接近水平 / 竖直的线会自动吸附并获得 **Horizontal / Vertical** 约束；终点落在一个点上会将两者连接（重合），落在线 / 圆上会使该点保持在其上（一条横跨矩形、两端落在其边上的线会把矩形分成两个区域）。
  - **Rectangle**：两个角点（或中心和一个角点）——点击两次或拖动。**Circle**：先点圆心，再点边缘。**3-Point Arc**：起点、终点，然后是弧上的一点。
  - **Sketch Dimension**：点击一条线（标注其长度——对于斜线，放在其上方 / 下方 = 水平尺寸，放在旁边 = 竖直尺寸）、两个点（其距离）、一个点和一条线、两条线（其夹角；平行线 = 其间距）、一个圆（其直径）或一段圆弧（其半径）；然后点击放置数字的位置并输入数值（支持算式：100-20）。之后双击数字即可修改。
  - **Sketch Select**：点击选中（按住 Shift 追加）；拖动点、线和圆的边缘——约束保持不变；拖动数字可移动其位置。
- **📐 Sketch** 选项卡（与 Properties / Adjustments / ✨ AI / ◈ Control 并列）：显示剩余的**自由度**数量（为零时显示 ✓ **fully constrained**（完全约束））、针对所选对象的**约束**——Coincident（两点重合，或点在线 / 圆上）、Collinear、Concentric、Midpoint、Fix、Parallel、Perpendicular、Horizontal、Vertical、Tangent、Equal、Symmetric（两点关于一条线对称）——以及 Construction、Delete、各绘图工具，和图层在图片中的显示方式（线条颜色 + 宽度、**Fill profiles** = 填充闭合区域、显示 **Dimensions**）。
- **绘制草图时的颜色**：蓝色 = 仍可自由移动，黑色 = 完全约束，橙色虚线 = 构造线，括号中的灰色数字 = 从动（参考）尺寸。会使草图**过约束**的约束，或已被其他约束确定的约束，会被拒绝（尺寸则改为从动尺寸）。
- **⬚ Profiles → Shapes**：将每个闭合区域生成为草图上方的一个**形状图层**（可设置填充、描边，用 ✨ 在其中生成内容…）。**✓ Finish Sketch** 返回 Move 工具。
- 每次更改都是一个撤销步骤；移动 / 缩放图层会一并移动其草图；.bgi 文件会保留每一个约束。

## 时间线上的姿势，以及 Daz 实时链接（2.461.0）
<!-- en: poses-on-the-timeline-and-the-daz-live-link-2-461-0 d0315f061871 -->

**在时间线上**：从 Daz Studio 发送来的场景（bitGen Bridge ▸ Scene）会在预览画布上方的 🟧 .blend 预览中打开，摄像机已经可以在其中移动（🎥 scene camera 场景摄像机 / 🧭 free view 自由视角）。其 Properties 现在新增 **Pose**：
- 选择**人物**和一根**骨骼**（输入其名称的一部分即可查找），用 **X / Y / Z** 旋转它（单位为度，叠加在其自身姿势之上——或叠加在其动画之上：旋转会随动作一起运动）。预览会立即显示旋转效果；**Reset bone / Reset pose**；Ctrl+Z 可撤销。💾 **Save** 和 **🎬 Render to real** 会将姿势交给 Blender（人物带动画时，会在各帧上设置关键帧）。
- **🧊 To the image editor**：将同一场景作为图像编辑器中的一个 **3D 图层**，带有此姿势和此视角（自由视角的位置）——在那里用 **✨ Generate from it** 生成一张新图像。

**Daz 实时链接（实验性）**——bitGen 直接在 Daz Studio 中移动摄像机、调整姿势：
- 在 Daz Studio 中运行 **Scripts ▸ bitGen ▸ bitGen Live Link**（来自 bitgen-daz-bridge zip，1.1.0）。链接期间会一直打开一个小窗口；它大约每秒向 bitGen 询问一次要做什么。
- 在图像编辑器的 **🧊 3D** 选项卡中：**📡 Camera → Daz**（Daz 的视口通过一台 "bitGen Camera" 观察，其位置与 3D 图层的视角相同），**📡 Pose → Daz**（所选人物中同名的骨骼按你设置的旋转进行旋转），**↺** 撤回这些旋转，☐ **as I change** 在每次更改时同时发送两者。上方的一行文字会显示 Daz 是否已链接，以及 Daz 中当前选中的是哪个人物。
- 在时间线上：Pose 部分中的 **📡 View + pose → Daz**（自由视角 + 旋转）。
- 照常在 Daz 中渲染，然后用 bitGen Bridge ▸ Render this frame 发送回来 -> 得到一张图片。
- 此功能是根据 Daz Studio 的脚本文档编写的，开发时未能在真实的 Daz Studio 中测试；Daz 的骨骼按 Daz 自身的轴向旋转，可能与 Blender 的不一致。实时链接窗口的日志会显示失败的原因。

## 3D 图层：图像编辑器中的 Daz / Blender 场景（2.460.0）
<!-- en: 3d-layers-a-daz-blender-scene-in-the-image-editor-2-460-0 7d1cd9dabca1 -->

将 3D 场景带入图片，移动其摄像机，为其中的人物摆姿势，并利用该视角生成新图像。
- **从 Daz Studio 发送**：Scripts ▸ bitGen ▸ bitGen Bridge ▸ **Scene**——场景（带骨骼绑定的人物、道具、灯光、摄像机）会作为 Blender 场景进入项目（必须安装 Blender——🟧 Blender settings）。任何 **.blend** 文件也同样可用。
- **Layer ▸ New 3D Layer (Daz / Blender)…**：选择场景（从 Daz 发送的场景标有 "Daz ·"）或输入 .blend 文件的路径。随即出现一个 **3D 图层**：它是一个普通的图片图层（蒙版、滤镜、移动和混合模式都有效），每当你改变其视角时，Blender 都会重新绘制它。原始文件永远不会被修改。如果没有打开的图片，会按场景尺寸新建一张。
- **🧊 3D** 选项卡（在 ✨ AI / ◈ Control 旁）：
  - **Camera**：🎥 **Scene camera**（Daz / Blender 中设置的视角）、**Front / Back / Left / Right / Top**，或输入 **Turn**、**Tilt**、**Distance** 和 **Lens**（视野，单位为度）。**🖐 Drag the view**：在画布上拖动 = 围绕场景环绕，**Shift**+拖动 = 平移，**Ctrl**+拖动或**滚轮** = 缩放；拖动时以线框盒显示视角，松开后由 Blender 绘制（约需一秒）。
  - **Pose**：选择**人物**和一根**骨骼**（输入其名称的一部分即可查找），然后用 **X / Y / Z** 滑块旋转它（单位为度，叠加在原有姿势之上）。**Reset bone** / **Reset pose**。
  - **Frame**：动画场景的第几帧。
  - **Render**：**Quick**（快速、平面着色——即视角预览所用的方式）、**EEVEE** 或 **Cycles**，☐ **transparent**（透明）背景，**▶ Render** 以完整尺寸绘制该图层（Layer ▸ Render 3D Layer 作用相同）。
  - **✨ Generate from it**：在提示词面板中输入你想要的内容（例如 "a photo of a woman waving in a sunny park"），然后按下此按钮——编辑器会切换到 **Edit**，提示词面板会根据你所看到的这张图片生成新图像。
- 每次更改都是**一个撤销步骤**（图片及其摄像机 / 姿势一起）。**.bgi** 文件会保留 3D 图层的场景、摄像机和姿势。

## 按功能命名的工具（2.459.0）
<!-- en: tools-named-by-what-they-do-2-459-0 2b7f05e598ac -->

帮助页面、工具提示、菜单、消息、本指南和宣传手册现在都按功能为每个工具、面板和特性命名——不再使用其他产品的名称。屏幕上有几个名称发生了变化：**Node Pen Tool**（F5 组）、**Shape Tool (nodes)**（F10）、**Dockers** 面板组（Window ▸ Float Dockers）和 **Layer ▸ Frame**。其他程序的文件仍按原有方式读取和写入（PSD、Final Cut Pro 7 XML、EDL、OpenTimelineIO、AAF）。

## 自动尺寸、平面图尺寸和连续尺寸（2.458.0）
<!-- en: auto-floorplan-and-chain-dimensions-2-458-0 e7dd15a69d36 -->

- **Auto Dimension**（Layer ▸ Auto Dimension，或尺寸工具栏上的 **⊞ Auto**）：标注选中对象的总体**宽度**（在其上方）和**高度**（在其旁边），作为两个尺寸组，放在名为 "Size of <name>" 的组中。
- **Floorplan Dimensions**（Layer ▸ Floorplan Dimensions…，或工具栏上的 **⌂ Floorplan**）：选择一个闭合形状——一个房间，或用形状 / 线条工具绘制的平面图轮廓——每面**墙**都会在其**外侧**标注尺寸，并在更外侧标注**总宽度和总高度**；全部放在一个名为 "Floorplan <name>" 的组中，为一个撤销步骤。对话框中可设置尺寸与墙的距离，以及标注墙、总尺寸还是两者都标注。（不是形状的图层按其边界框测量。）
- **Chain Dimension 工具**（F8，与其他尺寸工具在一起）：沿墙依次点击各点——它们会像其他尺寸工具一样吸附到节点和角点——然后按 **Enter** 或**双击**，再点击放置尺寸线的位置：在同一条线上为每两个相邻点之间标注尺寸，并在更外侧标注**总长**。它根据各点的走向水平或竖直排布；**Shift** = 水平，**Ctrl** = 竖直。**Backspace** 撤回最后一个点，**Esc** 取消。
- 工具栏上的 **↔** = 自动 / 平面图尺寸与对象之间的距离。它们生成的每个尺寸都是普通的尺寸组：可以拖动其各部分、修改比例。

## 尺寸组（2.457.0）
<!-- en: dimension-groups-2-457-0 1d12917c5eaf -->

尺寸现在是 Layers 面板中的一个**部件组**：**Extension Line 1**、**Extension Line 2** 和 **Dimension Line**（其上带有两个箭头和数值）。每个部件都是独立的矢量线；整个组作为一个整体移动、缩放和旋转，而各部件总是根据尺寸的测量值重新绘制，因此箭头始终位于尺寸线上，尺寸界线也始终保持其间隙。

**绘制尺寸**（Parallel 和 Horizontal / Vertical Dimension 工具）：
- **在对象的边上按下并向外拖动**——测量该边，尺寸线跟随指针。
- 或者**先点击一个节点或一条边，再点击另一个节点或边**（点击边时取边上与第一次选取点垂直相对的点），然后**点击放置尺寸线的位置**。
- **Shift** = 尺寸线水平，**Ctrl** = 竖直（绘制和拖动时均适用）。Esc 取消。

**编辑尺寸**（选中该组后，使用 Move 工具、Shape 工具、路径工具或尺寸工具）：
- **拖动尺寸界线**：其测量点沿尺寸方向滑动——长度和数值实时变化（在吸附点上会与之对齐；按住 Alt = 自由移动）。
- **拖动尺寸界线的节点**（两端的小方块）：只有该尺寸界线变长或变短——即它与对象之间的间隙，或它超出尺寸线的长度。
- **拖动尺寸线**（使用 Move 工具时：拖动其中间的圆点）——拉近或推远；Shift / Ctrl 使其水平 / 竖直。使用 Move 工具时，拖动线的其余部分或数值会移动整个组。
- 每项操作都是一个撤销步骤。在画布上点击某个部件会选中其所在的组。属性栏上的 📏 尺寸 + 单位以及 Layer ▸ Dimension Scale… 都作用于组；设置新比例后会重新测量每个组。旧版的单图层尺寸仍可打开，也可拖动其端点（现在那里同样是 Shift = 水平，Ctrl = 竖直）。

## StoryBoard 故事板（2.456.0）
<!-- en: the-storyboard-2-456-0 9ee62e63633e -->

**视频面板现已改为 StoryBoard**（其标题栏和状态栏按钮都已更名），并且可以**浮动**：其标题栏中的 **⇱** 使其成为应用之上的独立窗口——拖动标题可移动它，拖动任意边缘可调整大小，它可以作为选项卡停靠在某个已命名的面板中，**⇲** 将其放回时间线下方。
- **StoryBoard 栏**（位于场景上方）：用于生成图片的**图像模型**（在你另选之前，使用提示词面板的图像风格），以及随每张图片一起作为**参考图**发送的内容：☑ **Character sheets**（场景提示词中提到的角色的角色设定表），☑ **Locations**（提示词中提到的地点），☑ **Reference images**（场景自身的图片和项目的 References）。**🖼 All missing** 为所有缺少图片的场景生成图片。
- **每个场景**都有一个**缩略图**：**🖼 make**（之后可用 ↻ 重新生成）用该模型根据场景的提示词渲染缩略图——这是一个普通的图像任务（在 Queue 中可以看到）；**→ First** / **→ Last** 将其用作场景的**首帧 / 尾帧**（场景渲染以这张图片开始 / 结束）；**✕** 将其删除。这些图片保存在项目的 storyboard 文件夹中。

## Edit theme mode 下对话框照常可用（2.455.0）
<!-- en: edit-theme-mode-leaves-dialogs-working-2-455-0 ac5240b72ba7 -->

在 **🖌 Edit theme mode**（主题编辑模式）开启期间，**对话框和弹出菜单照常工作**：Style 面板中的“a picture as the icon”（用图片作图标）会打开文件对话框，你可以在其中浏览并选择文件；图像编辑器的各个对话框、Settings、菜单、Liquify……都像平常一样响应你的点击和按键。它们不会被描边，也永远不会被选中来设置样式。在对话框内按 Esc 由对话框自己处理；在其他地方，Esc 先关闭 Style 面板，再退出该模式（焦点在 🖌 按钮上时也是如此）。

## 面板栏本身就是面板；每个标签组都可浮动（2.454.0）
<!-- en: the-panel-column-is-a-docker-every-tab-group-floats-2-454-0 34a11926e679 -->

- 编辑器右侧栏中的**每个标签组**都可以通过其 **⇱** 浮动：Colour（Color / Swatches / Character / Paragraph）、Properties（Properties / Adjustments / ✨ AI / ◈ Control）、Layers（Layers / Paths / Channels / History / Actions / Comps）以及 Dockers（Transform / Shaping / Align / Object）。Window ▸ Float … 的作用相同。
- **该栏是带停靠区的面板**：按住浮动组的标题将其拖到栏上——一条**橙色线**会显示它将放置的位置（某个组的上方或下方，或末尾）——松开鼠标即停靠到该处。浮动组仍可作为标签停靠到命名面板中（Window ▸ New Docker…）。
- **可调整宽度**：拖动该栏的左边缘可使其变宽或变窄（200 - 640 px）。
- 顺序和宽度会保留到下次使用。

## 框架锁定其内容（2.453.0）
<!-- en: frames-lock-their-contents-2-453-0 029c1ebc4fea -->

- **锁定内容**：在普通模式下，框架内的内容（Lock Contents to Frame——默认开启）不能单独移动或变换。用 Move tool（移动工具）点击或拖动它时，选中的是**框架**，框架的缩放 / 旋转手柄会带着内容一起移动、缩放、旋转和斜切（拖动时内容显示为被框架裁切；整个操作为一个撤销步骤）。
- 在画布上**右键点击**：**Edit Frame Contents**（编辑框架内容）、Extract Contents、Lock Contents to Frame（以及 Duplicate / Delete Layer）。编辑期间，内容可以单独移动 / 变换 / 绘制，右键菜单会把 **Finish Editing Frame** 放在第一项（画布上的 ✓ 栏也仍然可用）。在普通的闭合形状上，菜单提供 Place Inside Frame…。
- 现在双击框架会显示 Move tool 的旋转手柄（与任何图层一样）。

## Move tool：缩放 / 旋转手柄、变换选项（2.452.0）
<!-- en: move-tool-scale-rotate-handles-transform-options-2-452-0 cfef5fe4b767 -->

使用 **Move tool (V)**（移动工具）时，活动图层上会显示手柄：
- **单击一次** = **缩放手柄**（8 个小方块）：拖动角手柄会以对角为基准双向缩放——按住 **Shift** 保持比例，按住 **Alt** 从中心缩放；边手柄只沿一个方向拉伸。
- **双击** = **旋转手柄**：拖动角手柄（弯箭头）绕中心旋转——**Shift** = 以 15° 为步进；拖动边手柄（↔ / ↕）进行斜切。再单击一次即回到缩放手柄。
- 拖动时可以预览变换后的位置；松开即应用——一个撤销步骤。在其他任意位置拖动仍然是移动图层。像素只重绘一次，形状保持矢量，**文字保持可编辑**（现在也可以旋转），智能对象保留其内容，组会变换其中的所有图层。
- **Transform options**（变换选项，位于选项栏）：∠ 角度 + ↻、⟲90 / ⟳90、⇋ / ⇵ 翻转、W % x H %（🔗 联动）+ ⤡——均以图层中心为基准。

## 编辑器的 Edit / Generate 标签驱动提示词面板、Del 键、快捷提示词（2.451.0）
<!-- en: the-editor-s-edit-generate-tabs-drive-the-prompt-docker-del-quick-prompts-2-451- 90edff815cc4 -->

- **✨ AI ▸ Edit 标签**：提示词面板会自动切换到 **🖼 Image**（即使当前处于 🎬 Video），其风格切换为 **Qwen Image 2.1 edit**，大按钮显示为 **✏ Edit**——在那里输入指令并按下该按钮即可。该标签自带的 ✨ Edit 按钮和模型行已移除。尚未打开任何图片时，会提示先打开一张图片。
- **✨ AI ▸ Generate 标签**：提示词面板的按钮显示为 **✨ Generate**，会渲染到所选图层的选区中；✔ Apply 将结果融合进去（与 Krita AI 类似）。没有打开图片时，则按常规方式生成一张新图片。
- 切换到其他标签（Refine、Remove……）时：提示词面板恢复原来的模式和风格。
- **Del** 删除当前图层（有选区时则清除选区内容；Shift+Del 始终删除图层）。
- **快捷提示词**——位于提示词面板的菜单栏：**💾 Save** 保存当前提示词（以第一行作为名称；第一行相同时会覆盖原有项），**⚡ Quick prompts ▾** 列出已保存的提示词——选择其中一个即可填入提示词框，**🗑** 删除最后选择的那一个。它们保存在安装文件夹中的 quick_prompts.json 里（所有项目共用）。

## Warp 网格 + 拆分线、Liquify 新增功能（2.450.0）
<!-- en: warp-grid-split-lines-liquify-extras-2-450-0 3b6528e03e1c -->

**Edit ▸ Transform ▸ Warp**——选项栏现在提供：
- **Grid**（网格）：Default / 3 x 3 / 4 x 4 / 5 x 5 / Custom（列 x 行，各 1 - 10）——单元格越多，控制越精细。已经做好的变形会保留。
- **Split Warp** ✚ Crosswise / ┃ Vertically / ━ Horizontally：在变形区域上点击要放置拆分线的位置——图片不会移动，只是在那里多出一些控制点。按住 **Alt 点击**拆分线可将其删除。
- 拖动网格点（线条交叉处——其手柄随之移动）、手柄或单元格内的任意位置，即可弯曲该单元格。按 Enter 应用；智能对象会保留网格。

**Filter ▸ Liquify…** 新增：
- **Smooth (E)**：使画笔下的扭曲变得均匀（按住不动或在其上涂抹）。
- **Push Left (O)**：向上拖动 = 像素向左移动，向下拖动 = 向右移动（按住 Alt = 方向相反）。
- **Face-Aware Liquify**：☺ **Face tool (A)**——围绕一张脸拖出一个椭圆；椭圆内会放置眼睛、鼻子和嘴巴的标记，可将它们拖到实际所在的位置。然后使用滑块：Eye Size / Height / Width / Distance、Nose Height / Width、Smile、Mouth Width / Height、Forehead、Chin Height、Jawline、Face Width（-100 .. 100）。Reset Face 将它们复原；OK 会同时应用画笔和滑块的效果。尚未放置脸部时，则按画面中央的估计位置处理。

## 逐字符文字样式（2.449.0）
<!-- en: per-character-type-2-449-0 f09de64d68b4 -->

同一个文字图层中的不同字母可以拥有各自的设置：
- 输入文字时（Type tool 的文本框处于打开状态），**选中若干字母**，然后在选项栏中更改**字体、B、I、字号、字距或颜色**——或者更改 **Character** 面板中的任意项（垂直 / 水平缩放、基线偏移、仿粗体 / 仿斜体、All Caps、Small Caps、上标 / 下标、下划线、删除线）。只有这些字母会改变；文本框保持打开，这些字母仍处于选中状态。每次更改为一个撤销步骤。
- **未选中任何内容**（只有插入点）= 作用于整个图层，与以前相同。
- 在带样式的文字段内输入时，新文字沿用该样式（插入点前一个字母的样式）。
- 不同字号的字母共用一条基线；每行的行高取决于该行最大的字母。字号 / 字体不同时，文本框会浮在文字上方（与变形文字相同），以便可靠地选取字母。
- **Layer ▸ Type: Clear Character Overrides** 会将所有字母恢复为图层本身的设置。图层保留段落设置（对齐方式、行距、段落文本框）。路径文字、竖排文字、变形文字、3D 文字以及应用了文字效果预设的文字仍只使用一种样式。

## Content-Aware Fill 工作区（2.448.0）
<!-- en: the-content-aware-fill-workspace-2-448-0 365035787eeb -->

选中要去除的内容，然后选择 **Edit ▸ Content-Aware Fill…**——这会打开一个独立的工作区：
- **图片**：要填充的区域以红色描边，**取样区域**（填充可以从中获取像素的区域）以绿色显示。
- **Sampling**（取样）：**Auto**（选区周围的一圈）、**Rectangular**（包围选区的矩形框）或 **Custom**——用 🖌 **Sampling Brush** 绘制：**+** 添加，**−**（或 Alt）减去，另可设置画笔大小。**↺ Reset** = 恢复为 Auto；**show it** 可关闭绿色显示。
- **Preview**（预览）：结果显示在旁边，每次更改后（短暂停顿后）会重新生成。
- **Colour Adaptation**：None / Default / High / Very High——将填充内容的颜色和光照与周围环境融合。
- **Output To**：Current Layer / New Layer / Duplicate Layer。**OK** = 一个撤销步骤。所做的选择会被保留。
PatchMatch（不使用 AI）：只使用取样区域中的图块。

## 画板（2.447.0）
<!-- en: artboards-2-447-0 6b19f97606bb -->

一张图片中可以包含多个**画板**——每个画板都是一个拥有自己尺寸的页面（帖子、Story、横幅……）。
- **Layer ▸ New ▸ Artboard…**：设置名称、尺寸（图片的尺寸、预设——Instagram post、Story / Reel、Full HD、4K、A4、YouTube thumbnail、X post——或自定义尺寸）、背景颜色（或无背景），以及是否将选中的 / 活动的图层放入其中。第一个画板位于图片左上角；之后的画板依次放在上一个的右侧，画布会随之扩大以容纳它们。
- **Artboard tool**（画板工具，位于 Move tool 工具组中——再按一次 V）：拖出一个矩形 = 在该处新建画板。
- **Layer ▸ New ▸ Artboard from Group**：将活动组转换为包围其内容的画板。
- 画板就是一个组：其中的图层**只在画板矩形内显示**，位于画板背景之上；画板的名称和轮廓绘制在其上方。移动画板（Move tool、方向键）时，其图层会一起移动。**Properties**：X / Y / W / H、背景、**⇱ Fit**（使矩形包围其内容）。Canvas Size 和 Image Size 也会移动 / 缩放画板。
- **File ▸ Export ▸ Artboards to Files…**：将每个画板导出为单独的 PNG（只包含它自己的图层）——以 <picture>-<artboard>.png 的名称保存到项目的 Images 中，和 / 或直接下载。.psd 会将它们保存为 PSD 画板；.bgi 也会保留它们。

## 时间线预览画布上的标尺、参考线和吸附（2.446.0）
<!-- en: rulers-guidelines-and-snapping-on-the-timeline-s-preview-canvas-2-446-0 b455d3b862ab -->

时间线菜单栏中的 **📏**（位于 ⊞ 旁边）会在预览画布的顶部和左侧显示**标尺**——以图片像素为单位，从图片左上角起算，并随缩放和平移变化。
- **参考线**：从顶部标尺（水平参考线）或左侧标尺（垂直参考线）拖到画布上。
- 用 Move tool **移动参考线**（指针悬停在参考线上时变为 ↕ / ↔）；**将其拖回所属标尺**即可删除；**双击参考线**可输入其位置。参考线属于时间线（随时间线一起保存），并以参考线颜色绘制（⚙ Timeline settings ▸ Grids & Guides）。
- **吸附**：用 Move tool 移动图层时，图层的边缘和中心会在吸附距离内吸附到参考线、图片的边缘和中心，以及——在显示网格时（⊞）——网格线。按住 **Alt** 可自由移动。

## 网格按钮、Grids & Guides 设置（2.445.0）
<!-- en: grid-buttons-the-grids-guides-settings-2-445-0 c375fe22bea0 -->

**⊞** 用于开关网格——位于图像编辑器的顶栏（⛶ 之前）和时间线的菜单栏（🧰 旁边，网格显示在预览画布上）。

相关设置位于 **Grids & Guides** 标签中——在图像编辑器的 **⚙** 设置和时间线的 **⚙ Timeline
settings** 中均有：
- **Grid spacing**（网格间距，单位为图片像素；0 = 随缩放变化）和 **Major grid every** n 条线（主网格线，绘制得更明显；0 = 无主网格线）
- **Draw the grid as** 线条或点（每个交叉处一个点，主网格线上的点更大）
- **Grid colour** 及其浓度、**Guideline colour**、**Guideline snap distance**（屏幕像素）编辑器将这些设置与其他设置一起保存（View ▸ Grid and Snapping… 可打开该标签）；时间线将它们保存在设置文件中（所有浏览器都相同），⊞ 的开关状态也一并保存。

## 图像编辑器的 ✨ Edit / Generate 改由提示词面板运行、⚙ 编辑器设置（2.444.0）
<!-- en: the-image-editor-s-edit-generate-run-from-the-prompt-docker-editor-settings-2-44 5df2535d1e0a -->

在图像编辑器已打开且显示其 **✨ AI** 面板时：

- **Edit** 标签：提示词面板的图像风格切换为 **Qwen Image 2.1 edit**，按钮显示为 **✏ Edit**。在提示词面板中输入指令（“make her jacket red”（把她的夹克改成红色）、“turn it into a watercolor”（改成水彩画））并按 ✏ Edit——选区会被编辑（无选区 = 整张图片）。面板自带的 Edit 按钮、模型列表和提示词框已移除——现在在提示词面板中输入。离开 Edit 标签时，提示词面板的风格会恢复原样。
- **Generate** 标签：提示词面板的按钮显示为 **✨ Generate**，会渲染到所选图层的选区中（无选区 = 整张图片）。结果照常出现（点击其中一个进行比较）；**✔ Apply** 将当前显示的结果融合到该图层中——只在（羽化的）选区内，一个撤销步骤——与 Krita 的 AI 功能类似。在文字 / 形状 / 组图层上，结果会成为一个新图层。（在 ⚙ ▸ ✨ AI 中可设置让 Apply 始终添加新图层。）
- 显示的是面板的其他标签（或编辑器已关闭）时：提示词面板照常工作（将图片作为新图层放到画布上）。

编辑器菜单栏右端的 **⚙**（或 Edit ▸ Preferences…，Ctrl+,）会打开编辑器的设置：✨ AI（结果、上下文、羽化、百万像素、✔ Apply 的行为）和 Interface（外观、标尺、面板、选项栏）。

## Edit theme mode：为屏幕上的任何元素设置样式（2.443.0）
<!-- en: edit-theme-mode-style-anything-on-screen-2-443-0 5ae46c473112 -->

顶栏中的 **🖌**（位于 ⚙ 旁边——或 Settings ▸ Themes ▸ **🖌 Edit theme mode**）会开启主题编辑模式：指针下方的元素会被描边，点击会“选中”该元素而不是使用它（⚙ 不会打开 Settings，按钮也不会执行操作）。**Style** 面板会在其旁边打开：

- **Apply to**（应用到）——仅此元素、此面板中所有同类元素、所有同类元素（种类相同且 class 相同的元素——例如所有 ghost 按钮），或该种类的所有元素；面板会显示当前匹配的元素数量。
- **Text**——字体、字号、字重、颜色、文字阴影（x、y、模糊、颜色）。
- **Box**——填充、边框颜色、圆角半径、按钮阴影（x、y、模糊、扩展、颜色、内阴影）。
- **Icon**——新图标（emoji / 符号，或 🖼 一张小图片——png、svg、jpeg、webp、gif）、图标位置（左、右、上、下、仅图标、隐藏）、大小及填充色（emoji 也会被着色）。文字保持不变。
- **⬆** 选中其外层元素，**↺ Clear** 删除该规则；按住面板标题可拖动面板。

每项更改都会立即显示。**再按一次 🖌**（或按两次 Esc）= LIVE 模式：点击恢复正常作用，样式保持不变。这些样式保存在当前浏览器中，并随主题一起保存：**💾 Save theme** 将其写入 themes\<name>.json，加载 / 导入主题时会带入该主题自己的样式。Settings ▸ Themes 会列出这些规则（每条可用 ✕ 删除，或用 **↺ Clear element styles** 全部清除）。如果有对话框在最上层打开，Style 面板会在该对话框内打开。

## 框架：形状内的图层、Edit Frame、生成到形状中（2.442.0）
<!-- en: frames-layers-inside-a-shape-edit-frame-generate-into-a-shape-2-442-0 dc5574b547a0 -->

**框架**是任何闭合形状——矩形、椭圆、多边形、闭合路径——其内部包含图层：这些图层只在形状的轮廓内显示（形状的填充在它们后面，轮廓在最上层），在 Layers 中它们以树形结构显示在该形状下方（▾ 展开 / 折叠）。

- **放入图层**：在 Layers 中按住 Ctrl 点击图层（选中它们），将形状设为活动图层，然后选择 **Layer ▸ Frame ▸ Place Inside Frame…**——对话框会显示框架（可以选择任何闭合形状），并可将内容在框架中居中。也可以将图层拖到 Layers 中某个闭合形状所在行的正中间。
- **框架整体移动**：移动、旋转、缩放或斜切框架（Move tool、property bar、Transform 面板、路径工具）——框架内的所有内容都会随之移动、旋转和缩放（拖动时实时显示；一个撤销步骤）。关闭 **Lock Contents to Frame** = 只移动框架本身。
- **Edit Frame Contents**（用 Move tool 双击框架，或通过菜单）：内容完整显示（框架外的部分呈淡化显示），每项内容都可以像任何图层一样移动、变换和绘制；画布上的栏——**✓ Finish Editing Frame**——用于返回普通模式。在普通模式下，点击内容会选中框架。
- **Extract Contents**：图层会从框架中移出，放在框架上方，位置保持不变。
- **✨ 生成到形状中**：当闭合形状处于活动状态时，✨ AI ▸ Generate 会在形状的边界框内生成图片，✔ Apply 会将其放入形状内部（成为框架）。Layer ▸ Frame ▸ ✨ Generate Into the Picked Shape 可关闭此功能。
- 框架保存到 .psd 时成为一个组（形状 + 被其裁切的内容），在 .bgi 中仍保持为框架。

## CAD 尺寸标注：精确点、实时端点、比例（2.441.0）
<!-- en: cad-dimensions-exact-points-live-ends-a-scale-2-441-0 c2d57fc73ba4 -->

**精确点**：使用尺寸标注工具（Parallel、Horizontal / Vertical、Angular）时，指针会像 CAD 程序一样吸附——吸附到形状的节点及其各边的中点、每个图层（包括图片图层）的角点和边中点、形状轮廓上的最近点、参考线交点——悬停时会标出所取的点并显示其名称（Alt = 不吸附）。

**拖动端点**：用 Move tool（或 Shape tool / 路径选择工具）选中一个尺寸标注——其两个端点和标注线上会显示手柄。拖动端点时，尺寸标注及其数值会实时跟随。**Shift** 使该端点与另一端点保持水平，**Ctrl** 使其位于另一端点的正上方 / 正下方（垂直）——自 2.457.0 起提供。中间的手柄用于移动尺寸线。每次操作为一个撤销步骤。（使用尺寸标注工具时，点击端点会在该处开始绘制一个新的尺寸标注。）

**比例**：选中的尺寸标注的 property bar 会显示 📏 其尺寸和单位。输入实际尺寸并选择单位（mm、cm、m、km、in、ft、yd、mi）：这就是该图片的**比例**——图片中的每个尺寸标注都会按此比例重新测量，之后绘制的标注也会使用该比例。⚖（或 Layer ▸ Dimension Scale…）用于设置小数位数或清除比例。图片会保留其比例（在其 .bgi 中也是如此）；每张图片都有自己的比例。

## 标尺、参考线和吸附（2.440.0）
<!-- en: rulers-guidelines-and-snapping-2-440-0 99596f9e5488 -->

**标尺**（View ▸ Rulers，Ctrl+R）使用 **View ▸ Ruler Units** 中设置的单位：像素、毫米、厘米、英寸或点（按 View ▸ Grid and Snapping… 中设置的文档 dpi 换算）。

**参考线**：从标尺中拖出——从顶部标尺拖出水平参考线，从左侧标尺拖出垂直参考线。用 **Move tool** 移动参考线（或在使用任何工具时按住 Ctrl）；将其拖回标尺（或拖出图片）即可删除。View ▸ Guidelines（Ctrl+;）用于显示 / 隐藏参考线，**Lock Guidelines**（Alt+Ctrl+;）将参考线固定在原位，**New Guideline…** 通过输入位置来放置一条参考线，**Guidelines…** 列出所有参考线（修改位置、删除、添加、全部清除），**Clear Guidelines** 清除所有参考线。文档会保留其参考线（在其 .bgi 中也是如此）。双击标尺可打开参考线列表。

**吸附**——View ▸ Snap To：**Snap**（Shift+Ctrl+;）用于开启 / 关闭吸附，并可选择吸附目标：**Grid**、**Guidelines**、**Objects**（其他图层的边缘和中心）、**Nodes**（形状的节点）、**Midpoints**（形状各边的中点）、**Intersections**（参考线之间以及参考线与页面边缘的交点）、**Page**（页面的边缘和中心）。默认吸附：参考线、参考线交点和节点。绘图、选区和路径工具（选框工具、Crop、钢笔工具、Shape 工具、矢量线条和形状、尺寸标注、连接线）会吸附指针；**Move tool** 会将图层边界框的左 / 中 / 右和上 / 中 / 下吸附到附近的目标上。吸附到的目标会在该点处标明（参考线、节点、中点、中心、边缘、交点、网格）。**Grid and Snapping…**：吸附距离（屏幕像素）、固定网格间距（0 = 按当前缩放级别绘制的网格）、文档 dpi、参考线颜色。

## 属性栏、圆角半径、在形状中 Add / Subtract、线宽和线型（2.439.0）
<!-- en: the-property-bar-corner-radii-add-subtract-into-a-shape-line-width-and-style-2-4 59c4e5200ba7 -->

图像编辑器在工具选项下方还有第二个栏——选中图层的 **property bar**（属性栏）：
**X、Y、W、H**，以像素为单位（图层的边界框）——输入数值并按 Enter；**🔒** 保持比例（更改宽度时高度随之变化，反之亦然），🔓 只更改一边。每次更改为一个撤销步骤；矢量形状保持矢量（其角和轮廓保持清晰锐利），文字会调整大小，像素会重新采样。

**矩形**（Rectangle 工具绘制的矩形，F6，或 Shape 工具绘制的矩形，U）会显示其四个**圆角半径** ⌜ ⌝ ⌟ ⌞——**🔗** 同时更改四个角，取消链接后每个角可单独设置。**矢量形状或线条**会显示其**轮廓宽度**（直接输入，或从列表中选择：none、hairline、1 … 24 px）及其**线型**，可从每种线型的示意图中选择（实线、虚线、点线、点划线……；Custom… 会打开 Outline Pen，F12）。

F6 形状工具（Rectangle、Ellipse、Polygon、Star……）的栏开头有一个**绘制模式**：
◻ **New**（每个形状单独一个图层）、⊕ **Add**、⊖ **Subtract**、⊗ **Intersect**、⊘ **Exclude**。在 New 以外的模式下，选中某个矢量形状时绘制的形状会成为该形状的一部分——添加到其中、从中挖去……——而原有形状保持原样（两部分仍可作为节点编辑；撤销即可再次去掉新增的部分）。

## 浮动面板、命名面板、居中对话框（2.438.0）
<!-- en: floating-dockers-named-dockers-dialogs-in-the-middle-2-438-0 47a7d07f1182 -->

**图像编辑器的面板组可以浮动**：点击 Layers 组标签页（Layers / Paths / Channels / History / Actions / Comps）或 Colour 组标签页（Color / Swatches / Character / Paragraph）末尾的 ⇱，也可以使用 Window ▸ Float Layers Panels / Float Colour Panels。该组会在编辑器内变成一个独立窗口：按住标题拖动即可移动，拖动任意边或角即可调整大小；⇲ 或 ✕ 将其放回右侧栏（Window ▸ Panels Back in the Column 会把两组都放回）。

**命名面板**：在图像编辑器中选择 Window ▸ New Docker…，或在菜单栏中选择 ⊞ Docker layout ▸ ▣ New docker…，即可创建一个以你所起名字命名的空浮动面板（双击名称可重命名）。按住任意浮动面板的标题将其拖到它上方（它会高亮），然后松开：该面板便作为标签页停靠在那里（点击标签页即可显示它；点击它的 ⇱，或将标签页拖出，即可再次浮动）。命名面板也可以停靠到其他命名面板中。命名面板上的 ⚙ 提供：Rename…、**Main docker**（主面板，浮动在整个应用之上）或 **Confined to**（限定于）某个面板（图像编辑器、时间线、另一个命名面板……它会留在该面板内并随之隐藏）、Delete（其中的内容回到原来的位置）。所有内容的位置（浮动、停靠、尺寸、名称、标签页）都保存在安装文件夹的 **panel_layout.cfg** 中。

**▣ Docker：供其他面板放入的空面板**（2.545.0）：状态栏中的 **▣ Docker**（位于 Queue 之后）或 **Ctrl+Alt+D** 可显示 / 隐藏它。用主面板标题栏中的 **⇱** 将其浮动（Preview、Timeline、Image editor、ComfyUI、Music、Stems、SFX、Chat、Console；StoryBoard 有自己的 ⇱），然后按住标题将其拖到 ▣ Docker 上方（一条橙色线会显示它将放置的位置），再松开即可。
- **并排或堆叠**：标题栏中的 ⇆ = 并排（水平），点击后变为 ⇅ = 堆叠（垂直）；⚙ ▸ Layout 中还有 **Tabs**（标签页，一次显示一个，与命名面板一贯的方式相同）。每个命名面板都可以这样设置。
- 在并排 / 堆叠模式下，其中的每个面板都保留一个小标题栏：将其拖出（或点击 ⇱）即可浮动，⇲ 将其放回主窗口。拖动两个面板之间的分隔条可调整它们的大小。
- **双击标题**可就地重命名：按 Enter 确认，按 Esc 保持原样。
- 其中的内容、顺序、尺寸、布局和名称都保存在 panel_layout.cfg 中。
- 2.549.0：**按住主面板自己的标题栏即可将其拖入**：在 Music（或 Preview、Timeline……）的标题上按下并拖到 ▣ 面板上方；会有一个标签跟随指针，橙色线显示其落点。普通点击仍然是折叠该面板。（自 2.545.0 起标题栏上的 ⇱ 变成了空按钮，现在它又显示 ⇱ 了。）
- 2.549.0：状态栏按钮会显示面板的**名称**（▣ Audio）。其标题栏中有 **📌 Make permanent**（设为永久）：它会变成主栏中的常规面板，带有常规标题栏（▾ 折叠、⇱ 再次浮动、🗑、⛶ 最大化），其状态栏按钮可显示 / 隐藏它，下方的拖动条可设置其高度，浮动面板仍可放入其中；还有 **🗑 Delete**（删除，会先询问；其中的面板回到原来的位置，该面板及其按钮被移除）。之后再按 Ctrl+Alt+D 会新建一个。
- 2.550.0：**右键点击 ▣ 面板的标题栏**（浮动的或已设为永久的）可使用 Rename…、Side by side / Stacked / Tabs、📌 Make permanent 或 ⇱ Float it again，以及 🗑 Delete docker。只有你自己创建的面板才有此菜单。永久面板会放在原窗口所在的位置（位于其中心下方那个主面板之前），并在栏中占据空间（它会与其他面板一起缩小，最小到 180 px；以前它被添加在底部，可能落到栏的可用空间之外）。
- 2.558.0：浮动的 ▣ 面板不再**压在所有其他面板之上**：它现在是应用的浮动面板之一（与浮动提示词面板、Basic Settings 和 LLM tokens 一样），最后点击的那个会显示在最前面。按住标题栏拖动面板时，每个 ▣ 面板都会显示**橙色虚线轮廓**，方便你看清可以放在哪里。
- 2.558.0：更多面板可以放入：**Settings、References、Assets、Queue 和 Gallery**（侧栏，需在它们的标题上按下，而不是 ▾ / 📌）以及 **StoryBoard**，都可以像其他面板一样按住标题栏拖入。侧栏面板放在 ▣ 面板中时，它所在的栏会关闭；**⇲** 会将它放回原位，并重新打开其所在的栏。（提示词面板、Basic Settings 和 LLM tokens 通过各自的放置区停靠，暂时还不能放入 ▣ 面板。）
- 2.559.0：每个**文件夹筛选器**都会记住你选择的文件夹，直到你选择另一个为止：包括 ComfyUI 模型下拉列表的文件夹筛选器（Settings、Basic Settings、LoRA 行，每个下拉列表各自记住）、📁 模型浏览器、角色对话框的 LoRA 文件夹以及 Model manager 的文件夹标签页（每个标签页各自记住）。这些都保存在安装文件夹的 **folder_filters.cfg** 中，因此关闭并重启应用后依然保留。
- 2.559.0：**Basic Settings 保存在安装文件夹的 basic.cfg 中**：每次更改（无论是手动修改，还是由风格或项目修改）都会在片刻后写入该文件，应用启动时会将其读回（在读取已打开项目自身的设置之后），因此你会以上次的 Basic Settings 开始工作。风格卡片的模型下拉列表不在其中（它们保存在风格里）。若要让 Basic Settings 从头开始，请关闭应用并删除 basic.cfg。
- 2.560.0：▣ 面板**可以像其他面板一样停靠**：按住浮动 ▣ 面板的标题栏，拖到某个面板的边缘附近
  - 会出现与 Basic Settings 相同的蓝色放置区（"Dock Docker above Preview"），松开后它会停靠在该面板的上方 / 下方、左侧 / 右侧（并排），或侧栏面板（Settings、References、Assets、Queue、Gallery）的顶部 / 底部。拖动其边缘可调整大小；将其标题栏拖开即可再次浮动（并可立即放到另一个边缘上）。停靠位置会在下次启动时恢复。
- 2.560.0：**Basic Settings、LLM tokens 和提示词面板可以放入 ▣ 面板**：按住它们的标题栏拖到 ▣ 面板（浮动或已停靠的均可）上方，该面板会显示轮廓，橙色线显示它们的放置位置，然后松开即可。将它们的小标题栏（或标签页）拖出 ▣ 面板，或按 ⇲，它们便会再次独立浮动。下次启动时它们会回到所在的 ▣ 面板中。（靠近已停靠 ▣ 面板的边缘时，它们会像以前一样停靠在其旁边。）
- 2.561.0：▣ 面板可以成为**独立的一栏**：按住它的标题栏，拖到**两栏之间**的接缝上（Settings | References | Assets | 主栏 | Queue | Gallery，或窗口的左 / 右边缘）。会出现一条高高的蓝色条（"New column: Docker between References and Assets"）；松开后，它就会成为那里的一个全高栏，并带有自己的分隔条用于调整宽度。▾ 将它折叠成一条窄条，其状态栏按钮可隐藏它，将其标题栏拖开即可再次浮动。该栏、其位置和宽度都会在下次启动时恢复。
- 2.562.0：StoryBoard 中渲染（或 ⏫ 放大、✎ First frame）任务**因重启而中断**的场景，现在会显示 "interrupted by a restart - ↻ Resume it in the Queue docker (Pending tab) and it carries on here"，并记住该任务。在 Queue 面板的 Pending 标签页中对该任务按 **▶ Resume**，场景就会将其接回：它会再次显示为运行中并带有进度条，任务完成后镜次会出现在该场景中。（如果改为丢弃该任务，场景也会注明。）
- 2.562.0：**不再自动播放任何内容**：已完成的任务、从 Done 标签页或时间线打开的镜次、正在运行任务的合并预览、灯箱、StoryBoard 的 Watch 以及替换对话框的预览，加载视频或歌曲时都处于暂停状态；按 ▶（或 Space）开始播放。
- 2.563.0：**场景的图片可以来自其他场景**：图片选择器（场景上的 ＋📁、✎ First frame 的 🅰 / 📍 / 🧸，以及 First / Last frame 槽位）会在 **🎬 Scenes** 上打开，按编号列出其他每个场景自己的图片（其 First / Last 帧、参考图、✎ 图片）；**🎞 Clips** 则可从任意已渲染的镜次中截取一帧，也可用作场景的参考图。选中的图片会注明来源（"scene 1 · First frame"）。
- 2.563.0：**✎ First frame ▸ 🅰 Picture A**：选择场景开始时所用的图片，并将 *Start from* 设为 🅰 Picture A。它的风格、构图、镜头取景以及人物姿势都会被原样保留；地点方面，如果你选了 📍 地点图片则使用它，否则使用场景（或故事板的全局提示词）所指定的地点及其视图图片，再否则使用 Picture A 自身的地点。**🤖 Write** 让 LLM 编写指令（它会将图片称为 <image1>, <image2> …），你可以按需修改；在方向说明为空时用 Picture A 执行 ✎ Make first frame，会先自动编写指令。该帧由折叠面板中选定的编辑风格生成。


- 2.564.0：**🎙 Voice chat：用语音和应用对话。**按状态栏中的 **🎙 Voice**（或 **Ctrl+Alt+V**），然后直接说话，无需按住任何按键：它能听出你何时开始、何时停止说话，把你说的话转写成文字（在本机运行 faster-whisper，对话期间保持加载），本地 LLM 会大声回答（使用你电脑自带的语音），并且真的会执行你要求的操作：编写或修改提示词（"write me a prompt of a fox in the snow"）、负面提示词，选择风格，修改 Basic Settings（"make it eight seconds"、"720p"、"16:9"），设置 Generate 生成的内容、视频模式，按下 Generate，生成静帧，停止正在运行的任务，添加或渲染 StoryBoard 场景，显示某个面板。它执行过的操作会列在回答下方。它说话时不会聆听。⏸ 暂停聆听，🔈 / 🔇 开关它的语音（并可选择使用哪种语音），底部的输入框可让你改为打字，✕（或说再见）结束对话。它需要 faster-whisper（Settings ▸ Audio）和一个 LLM（Settings ▸ LLM）。2.564.0 还修复了 ✎ 🤖 Write（2.563.0）的问题，以及手机端聊天显示 "[object Object]" 而不是 LLM 回复内容的问题。
- 2.565.0：**StoryBoard 成了真正的故事板**：▦（新的默认视图）将每个场景显示为一张类似 Model manager 中的卡片，包括其故事板图片（没有则显示其 First frame）、"Scene n"、状态和文字，排列在网格中，每个场景到下一个场景之间有一个 ➜。卡片上：🖼 生成其图片（↻ 换一张），▶ 渲染该场景，→ First 让场景以这张图片开始。点击卡片，其完整的场景卡片会在网格下方打开，包含它原有的一切（提示词、Ref / First / Cont / Trans、各帧、图片、✎ First frame、胶片条……）；✕（或选择器中的 "All scenes"）将其关闭。☰ 则像以前一样以列表显示。
- 2.565.0：**🎞 Write storyboard**（StoryBoard 工具栏）：给它一段简介，LLM 会编写各个场景（使用你的角色和勾选的参考），每个场景都会得到自己的故事板图片，由工具栏中选定的图像模型和参考（☑ Character sheets / Locations / Reference images）生成。勾选 **☑ Start on it** 后，每张图片都会成为其场景的首帧（First frame）（Ref 场景会变为 First），可用 ↻ 或场景的 First frame 选择器更改。编写器至少需要一个角色。
- 2.566.0：**MOSS-Image**（OpenMOSS 的开源 5B 图像模型，Apache-2.0，擅长图片中的文字和版式）现已作为一种模型类型提供：图像风格 **MOSS-Image**（SFT，推荐使用）和 **MOSS-Image Base**（用于 LoRA）。**Settings ▸ Add-ons ▸ MOSS-Image** 会从 Comfy-Org/MOSS-Image 下载其文件到 ComfyUI 的文件夹中：勾选 SFT / Base（int8，5.4 GB；bf16 精度更高），文本编码器（Qwen3.5 9B）和 VAE 始终包含在内；如果你删除了这些风格，它也会将其恢复。它需要 2026 年 10 月 16 日或更新的 ComfyUI（附加组件会检查正在运行的 ComfyUI，若版本较旧会提示你更新）；使用 int8 文件时约需 14 GB 显存。25 步，cfg 2.5（ComfyUI 自带的模板）。
- 2.567.0：**主题编辑器**（🖌 Edit theme mode ▸ Style 面板）可以对齐文字并调整间距：**Text ▸ Align** ⇤ ↔ ⇥ ☰（左对齐 / 居中 / 右对齐 / 两端对齐）和 ⤒ ↕ ⤓（顶部 / 中部 / 底部），对按钮、成行或成列的项目以及文字块同样有效；**Text ▸ Padding / Margin** = 文字本身周围的空间（纯文本元素）；**Box ▸ Corners** 可单独设置每个角的圆角（↖ ↗ ↘ ↙，优先于 Radius）；**Box ▸ Padding / Margin** = 元素边缘内侧 / 外侧的空间。每项各有四个框（上、右、下、左）；**=** 将第一个值复制到全部四个框；–（或空框）= 各自独立的值。与其他设置一样随主题一起保存。
- 2.568.0：**StoryBoard 的图片由 LLM 编写**：🖼 会把场景发回给 LLM，由它编写图片的提示词，即场景的开场画面（谁、做什么、在哪里、取景、光线），并点名所用的参考图。参考图包括**角色设定图**和**前一个场景的最后一帧**（当前一个场景有已渲染的镜次时，图片会从那一刻接着往下）；如果前面没有镜次，则使用角色和场景的文字。对应 StoryBoard 工具栏上的 ☑ LLM writes it / ☑ Previous last frame（两者默认开启）。**📁 更换图片**：可换成另一个场景的图片、某个镜次的一帧、任意项目图片或一个文件（勾选 ☑ Start on it 时，它也会成为场景的 First frame）。在网格中，**图片占满整张卡片**：场景名称和两行文字叠加在底部，按钮在悬停时显示；工具提示中包含完整文字和图片的提示词；点击会打开场景的完整卡片。
- 2.569.0：**图像编辑器中的 🔲 Zones（区域）**：画布上的方框，用来告诉 AI 在哪里放什么（这里放 "a kite"，那里放 "a dog"，那边放 "a bench"）。✨ AI panel ▸ 🔲 Zones ▸ **🔲 Draw boxes**（Zones 工具，与选框工具放在一起）：在画布上拖动即可画出一个方框（每个方框都有自己的颜色和编号），拖动方框可移动它，拖动其边 / 角可调整大小，Delete 删除选中的方框；在列表中输入每个方框里要放的内容。可选：场景描述（作用于整张图片）。然后选择生成方式，并点击 **✨ Generate zones**：
  **▣ One box at a time**：每个方框用填充风格执行一次 ✨ Generate（Add content），全部一次性加入 ⏳ Pending；勾选 ☑ Apply as they come 会将每个方框的第一个结果作为独立图层放入。**✎ Edit model, one pass**：把以各自颜色描出方框轮廓的图片一次性发送给 Edit 模型（"Put a kite inside the red box …, remove the outlines"）：光线最协调，位置则较宽松。**▦ Regional prompt, one pass**：用 ComfyUI 图像风格根据方框生成一张新图片：场景的文字作用于整张图片，每个方框的文字只作用于方框内部（ComfyUI 的区域条件控制，最适合 SDXL 类风格；FLUX / Qwen 的遵循程度较宽松）。已有图片时默认使用 ▣，空白画布默认使用 ▦。方框随文档（及其 .bgi）一起保存，永远不会被画进图片中。
- 2.570.0：图像编辑器支持 **🖊 Pen tablet**（数位板：XP-Pen、Wacom、Huion……通过 Windows Ink），即 🖌 Brush 旁边的 **🖊 Pen** 标签页（Window ▸ Pen Tablet）：一个**测试板**，显示压力、倾斜、正在使用笔的哪一端，以及你的笔发送的**压感级别**（XP-Pen 约为 8192）；与驱动程序类似的**压力曲线**（Extra soft、Soft、Linear、Firm、Extra firm、S-curve，也可拖动其控制点）、**Lightest touch** 和 **Full pressure at**；对每种画笔都可设置 ☐ **Pressure → size** / ☐ **Pressure → opacity**（以及最小尺寸）；勾选 ☑ 后，**橡皮擦端**用于擦除（把笔转回来时画笔会恢复）；**侧键** = Eyedropper（吸管）；勾选 ☑ **倾斜**后会转动笔尖（🖌 Brush ▸ Shape Dynamics ▸ Angle / Roundness control: Pen tilt）；☐ 使用鼠标时：根据速度模拟压力。画笔预设 ▾ 中有七种**数位笔刷**：G-pen、Mapping pen、Brush pen、Real pencil、Fineliner、Technical pen、Calligraphy（45° 笔尖，随倾斜转动）。没有压感？在 XP-Pen 的 Pen Tablet 设置中勾选 **Windows Ink**，然后重启应用。
- 2.571.0：**选中多个片段，一次性全部拖到时间线上**：在 Gallery、Assets 面板和 References 托盘中，**Ctrl+点击**添加 / 取消一个，**Shift+点击**选中从上次点击的项到当前项的范围（Ctrl + Shift 添加一个范围）；普通点击与以前一样（选中一个图块；Gallery 会在查看器中打开它）。拖动任意一个选中项，所有选中项都会一起移动：放到时间线（或预览）上时，它们按**从旧到新**的顺序排列，最旧的在最上方的图层，最新的在最下方，每个各占一个图层，从放下的位置开始首尾相接。时间线工具栏上的 **⛓ Sequential**（在 ripple 旁边）会将所有片段首尾相接、无间隙地排列，按图层从上往下（V1、图片图层、视频图层），并在开启期间一直保持：删除一个片段，后面的会自动补上；插入一个带片段的图层，后面的会让出位置；修剪一个片段，后面的会随之移动。音频图层、文字、形状和卡拉 OK 图层保持不动。
- 2.572.0：时间线工具栏上的 **✨ Auto transition [N] frames [type]**：在位于不同图层的两个视频片段之间的每个剪切点，下一个片段会在 N 帧内过渡进入（溶解、淡入淡出、擦除、滑动、圆形、缩放……），**而不移动任何东西**：每个片段都保持原有起点，因此与歌曲的口型同步仍精确到帧。剪切点之前的片段会在这些帧内垫在下方（如果文件在其结尾之后还有帧，就使用这些帧，否则定格其最后一帧）。开启 = 每次更改后都会保持（在 ⛓ Sequential 之后执行）；关闭 = 恢复为普通硬切；你自己设置的过渡不受影响。全部位于 V1 上的片段使用 V1 自身的衔接方式（Out），会让它们彼此重叠。**🔊 / 🔇 Video sound** 一次性将 V1 和所有视频图层静音或取消静音，使音频图层上的完整歌曲能够不被打断地播放。
- 2.573.0：StoryBoard 歌曲条上的 **✂ cut duration**（位于音频片段的菜单栏中，Transition 之前）：歌曲自动切分的秒数（2-60，预设 10 / 15 / 20 / 29.9）。更改后会立即重新切分已打开的歌曲（你通过输入时长锁定的分段保持不变），并且该值会被记住，用于下一首歌曲；💾 像以前一样保存 .seg 和场景。29.9 可确保每个场景都在一次 Long video 运行之内（⚙ Long video，MiniMax H3：719 帧）；30.0 为 720 帧，会被渲染为两次运行再拼接。
- 2.573.0：**⟳ ComfyUI updates**（Settings ▸ ComfyUI ▸ Engine，位于 ▶ Start / ■ Stop 下方）：显示此 ComfyUI 的版本和安装类型、更新通道（Newest = master，与便携版的 update_comfyui.bat 相同，FastH3 Omni 等新模型最先出现在这里；Stable = 最新正式版），以及 🔍 Check 和 ⤓ Update ComfyUI。便携版会运行 ComfyUI 自带的 update\update.py（它会自行安装新的依赖）；git 克隆会执行快进（或切换到最新的发布标签），并用 pip 安装 requirements.txt。由 bitGen Studio 启动的 ComfyUI 会先停止再重新启动；以其他方式启动的则必须先手动关闭。节点包不受影响。
- 2.573.0：**启动时检查更新**：应用启动 20 s 后，会向 GitHub 查询 bitGen Studio 和 ComfyUI 的新版本；如有更新，状态栏中会出现 ⬆（点击会打开相应的 Settings 标签页），并且每个新版本会弹出一次小卡片（Open / Later / Don't check on startup）。Settings ▸ General ▸ ⟳ Updates ▸ "Check for updates on startup" 可关闭或开启此功能。离线时不会有任何动作。
- 2.573.0：**FastH3 Omni**：FastVideo 对 MiniMax H3 参考生成视频（reference-to-video）模型所做的 8 步蒸馏版本（输入图片、视频和语音，输出带声音的视频，速度快数倍）。Settings ▸ Add-ons ▸ FastH3 Omni 可下载它（22 GB int8；H3 的文本编码器和 VAE 仅在缺失时下载）；需要 ComfyUI 0.43 或更高版本（⤓ Update ComfyUI，选择 Newest）。可将其用作视频风格 **FastH3 Omni**，或 StoryBoard 的 Workflow ▸ **FastH3 Omni · ref2va 8-step**（渲染方式与 H3_Video_Ref 相同：每个场景都用 ref2va，场景 n 承接场景 n-1 的镜次）。任何模型为 FastH3 文件的 H3 图（Basic Settings ▸ Override style ▸ Model）都会自动套用其配方：sigma shift 12/3、VSA 稀疏注意力、8 步、cfg 1，并移除基础模型的 turbo LoRA；Sage / Spectrum / Veda 会被跳过（它们会取代 VSA）。Omni 是参考生成视频模型，First / Cont / Trans（fl2va）场景应继续使用 H3 自己的 fl2va 模型。


- 2.574.0：**theme edit mode ▸ Text 可作用于任意文字**：面板的标题栏（选中它后，Text 会显示其标题，且只针对该面板），以及除按钮或输入框之外还带有自身文字的任何元素（例如带复选框的标签），都可以设置新文字；▾ / ▸ 箭头、📌 和按钮保持不变，折叠后仍保留新标题，↺ Clear 恢复原来的标题。没有自身文字的元素会提示这一点，此时请直接选中文字本身。
- 2.574.1：在 theme edit mode 中选中的每个元素，**Apply to ▸ This element only** 都是第一个选项，也是默认值：每次选中都从它开始（面板不再沿用上一个元素的 Apply to）。新文字始终只属于选中的那个元素：使用范围更大的 Apply to（All like it、Every <div>）时，其余样式会大范围生效，但文字只留在那一个元素上。匹配到多个标题的文字规则，或者单纯的标签名（div、button），永远不会重命名它们；之前所有面板都变成同一个名字的主题会自行修复，请重新命名你原本想改的那个面板。
- 2.575.0：**Model manager：模型的个人文件**：在卡片的 ⓘ 页面上，用 **＋ Add…** 添加图片、视频或声音（或从图库 / Assets 拖放到那里）。每个文件都保留生成时所用的提示词、负面提示词、种子、cfg 和步数（读取自本应用自己的渲染记录、PNG 中的 ComfyUI 图或 A1111 文本，或者视频 / 歌曲的标签），可用 ✎ 编辑。点击任意图片（你的图片、Civitai 的示例、主缩略图）会在查看器中完整打开它；**✎→** 会将其提示词连同种子、cfg 和步数发送到提示词框和 Basic Settings；**🖼** 将其设为卡片的缩略图（也可用 ✎ Edit ▸ Thumbnail ▸ 🖼 Change… 从磁盘选择图片；↺ Its own 恢复原缩略图）。这些内容与模型页面一起保存在 model_info 中，模型文件夹永远不会被改动。
- 2.575.0：**✎ Edit card**：**Your rating** 为五星评分，以半星为单位：悬停可预览，点击即可评分（点星星的左半边 = ½），← → 按半星调整，✕ 清除；**Model type**（Checkpoint、Diffusion model、LoRA、LyCORIS、VAE、Text encoder、ControlNet、Upscaler、Embedding……）；**NSFW** 🔞。筛选栏包含**所有模型类型**和 **🔞 NSFW**（取消勾选 = 隐藏 NSFW 卡片，此设置会被记住）。
- 2.575.0：图库中的图片 / 视频 / 歌曲、Assets、References（图片、视频、声音）以及查看器的 ⓘ 详情中新增 **✎→ To prompt**：填入文件的提示词及其种子、cfg 和步数（图片：填入 Basic Settings ▸ Image 的步数 / cfg；视频：填入 Basic Settings 的步数 / cfg；歌曲：填入 Music 面板的歌词和种子）。底部会有一条提示，说明设置了哪些内容。
- 2.575.0：**状态栏中的 Civitai 同步状态**：⤓ Civitai info / 🔄 Sync 运行期间显示 "🔄 Civitai 12/80"（点击会打开模型管理器），完成后显示 "✓ Civitai synced: … found · … no match"，持续 30 s。
- 2.575.0：**面板会恢复到关闭时的样子**：放入 ▣ 面板的面板在重启后会保留其位置、标签页顺序、当前显示的标签页以及状态（打开 / 折叠 / 隐藏）；最小化的浮动面板保持最小化；扩展面板按关闭时的状态重新打开或保持关闭；关闭前刚做的布局更改也会被保存；已保存的 ⊞ 面板配置不再在应用启动时覆盖恢复的布局。
- 2.576.0：**🔄 Sync 能找到已重命名的 Civitai 模型**：按文件名找不到的模型会通过其 SHA-256 查找（基于文件内容，精确匹配，与文件名无关）。读取大文件需要一些时间，状态栏会显示 "🔄 Civitai 3/9 · reading 45%"。之前结果为 "no match" 的模型会在下一次 🔄 Sync 时重新查询一次。
- 2.576.0：**查看器中的 🧩 To model…**：将你正在查看的图片、视频或歌曲发送到某个模型的文件中（model_info，连同其提示词、种子、cfg 和步数）。生成它时所用的模型会被预先选中；勾选 **Make it the model's thumbnail** 可将其设为模型缩略图（模型还没有缩略图时会自动勾选）。
- 2.576.0：**Ctrl+↓ = 设为模型缩略图**：在查看器中浏览某个模型自己的图片（或 Civitai 示例）时，按下它会立即将其设为缩略图；在其他任何图片上则会打开 🧩 选择器，并已勾选缩略图选项。在模型管理器的 ⓘ 页面中，先点击一张图片 / 示例，然后按 Ctrl+↓。
- 2.577.0：**使用你自己的姿势表**：六个内置姿势模板已被移除。请将你的姿势表（PNG、JPG 或 WebP；可以使用子文件夹）保存到安装文件夹的 **pose_sheets** 文件夹中。在 Character creator 中，**🧍 Pose sheet**（原来 Pose 下拉列表的位置）会打开它们的缩略图：点击一张后点 **✔ Use**（或直接双击）；**No pose sheet** = 自然站姿；**📂 Open folder** 打开该文件夹，**↻ Refresh** 在你保存新的姿势表后重新读取。生成的设定图会保留你姿势表的分格布局，以及每一格中的姿势和镜头角度，并把你的角色放进去。所做的选择会被记住。该文件夹完全归你所有，永远不会出现在发布的 zip 或代码仓库中。
- 2.578.0：**📐 SolidCraft 面板**：SolidCraft（开源参数化 3D CAD，MIT OR Apache-2.0，solidcraft.io）在应用内以独立面板完整运行（状态栏中的 📐 SolidCraft 按钮）：带约束的草图、拉伸、旋转、扫掠、放样、圆角、倒角、抽壳、孔、螺纹、阵列、钣金、塑料件、带关节和运动分析的装配、参数，以及 STEP / IGES / STL / OBJ / 3MF / glTF。只需 **Install** 一次：在面板中（⤓ Install，约 20 MB，来自 SolidCraft 的 GitHub releases）或在 Settings ▸ Add-ons ▸ SolidCraft 中安装；离线时：从其发布页面下载 solidcraft-web-<version>.zip，然后使用 **📦 Install from a zip…**。安装后即可离线使用；有更新版本的 SolidCraft 时，工具栏中会显示 **⤓ Update**。工具栏把它与应用连接起来：
  **📁 Designs** 打开项目中的设计和零件（projects/<project>/solidcraft）或电脑上的设计；**💾 Save to project** 将设计保存到项目中，之后 SolidCraft 自己的保存（Ctrl+S）会让项目中的副本保持最新；**🖼 → Image editor** 会立即把模型的图片（透明背景，使用你选择的 **Size**，**Edges** 开或关）放入图像编辑器，**Shift**+点击则使用 SolidCraft 自己的带光照渲染（较慢，工具栏会显示进度）；**View** 选择角度（Iso、Front……Bottom，或你在 SolidCraft 中保存的 Named View，这是获取自定义角度图片的方法）；**🎞 → Timeline** 在播放头位置将模型添加为 3D 图层（再次发送会更新它）；**✏ Sketch → SolidCraft** 将图像编辑器中选中的草图图层转换为 SolidCraft 草图，以便拉伸或旋转；**⤓ Export** 将 STEP、STL、OBJ 或 3MF 保存到项目中。
- 2.579.0：**📐 SolidCraft 面板仅在安装了 SolidCraft 后才显示**（其状态栏按钮也一样）：在 Settings ▸ Add-ons ▸ SolidCraft 中安装（**⤓ Install**，离线时用 **📦 Install from a zip…**），面板就会出现。工具栏中的 **Send** 按钮：**🖼 Send to Image editor**、**🎞 Send to Timeline**、**📏 Send to Sketcher**（自 2.630.0 起，零件会作为一个组进入 Sketcher）、**🟠 Send to Blender**（仅在找到 Blender 时显示：Blender 会在独立窗口中打开该零件，单位为米，Z 轴朝上，保存为 projects/<project>/blender/solidcraft/<name>.blend）以及 **🎮 Send to Unreal**（仅在设置了 Unreal 项目或编辑器时显示：零件会作为 Static Mesh 导入到 /Game/bitGen/SolidCraft，并放置在当前打开的关卡中；再次发送会在原位置替换它；需要 bitGen Bridge 插件 **1.4.0**，可用 🎮 Load UE project 更新它，或将 **bitgen-ue-bridge-1.4.0.zip** 解压到项目的 Plugins 文件夹中）。
- 2.579.0：在 🧩 Model manager 中 **🗑 删除模型**：点击卡片上的 🗑 或其 ⓘ 页面上的 **🗑 Delete**。确认框会列出将被删除的内容：模型文件（从磁盘上永久删除，不进回收站）、旁边与其同名的文件（预览图、.civitai.info、.bitgen.json、它的 .yaml……）以及它的 model_info 页面，并会提醒哪些风格正在使用它。
- 2.579.0：**Settings ▸ Dockers**：列出每个面板（主栏中的面板、侧栏面板、浮动窗口（Basic Settings、Model manager……）以及每个扩展面板，包括你以后添加的）及其当前位置，并提供 **↺ Reset**：恢复到默认位置和大小（移出浮动窗口或 ▣ 面板，取消最大化，显示并展开，恢复最初的高度 / 宽度；窗口则恢复到最初的位置和大小）。**↺ Reset all** 会重置所有面板。


- 2.580.0：**🧩 Model manager ▸ 📁 Model paths**：列出 ComfyUI 的 **extra_model_paths.yaml**（ComfyUI 读取的那个文件，路径显示在顶部）中的每组路径，每组都显示其 base_path、is_default，以及每个路径一行（文件夹类型 + 路径，✓ 表示文件夹存在 / ✗ 表示不存在）。
  - **➕ New group (other_ui1)**：选择基础文件夹（其他 UI 的安装目录、存放模型的硬盘……）；该组会被命名为 other_ui1、other_ui2……（取第一个未被占用的编号），并自动填入在其下找到的模型文件夹（models/checkpoints、models/loras、models/vae……也包括 A1111 / Forge 安装中的 models/Stable-diffusion 和 models/Lora）。
  - **修改路径**：直接在其中输入，或点击 **📁** 选择文件夹（位于基础文件夹内时会写成相对于它的路径）；**+ path** 添加一行，**🗑** 删除一行；可以重命名组或勾选 is_default；**💾 Save** 写入该组（**↶** 放弃更改）。同一文件夹类型的多个路径会写成列表。
  - **🗑 Delete group** 从文件中删除该组（文件夹和模型仍保留在磁盘上）。
  - 只有你保存的那个组会被更改，文件中的其他所有组、注释和空行都保持原样；之前的文件会保留为 extra_model_paths.yaml.bak。如果在该标签页读取之后，文件在别处被修改过，保存会被拒绝，标签页会重新读取文件。
  - **⟳ Restart ComfyUI**：ComfyUI 只在启动时读取该文件，此按钮会停止由 bitGen Studio 启动的 ComfyUI 并重新启动它（未运行：直接启动；由其他程序启动：不作处理，并会给出提示）。
- 2.581.0：**🔄 Sync 和 ⤓ Civitai info 现在也会保留模型的视频和动图**（视频模型的示例通常是短片）：示例按 Civitai 的顺序获取，包括视频（512 px，每个最多 60 MB）、GIF 和静态图；卡片的缩略图直接使用第一个示例的原样，因此视频缩略图会在卡片及其 ⓘ 页面上播放（静音、循环）；示例中的视频会直接播放，GIF 会标注 GIF，查看器会以视频形式打开视频。之前同步过的模型会在下一次 🔄 Sync 时按其 Civitai 版本 id 重新获取。视频也可以作为卡片的缩略图（通过 ✎ Edit card、在选中的示例或你自己的文件上按 Ctrl+↓，或 🧩 To model…）。
- 2.581.0：**选中 LoRA 的关键词会进入 LLM 编写的内容**：✨ Enhance 和提示词聊天会把选中 LoRA 的关键词（触发词）告诉 LLM，选中的 LoRA 包括 Generate 模式下 Basic Settings 的 LoRA 行（🧩 Model manager 中 ✓ 选择的 LoRA 会放到这里）以及 Model manager 自己选中的 LoRA；而且 ✨ Enhance 会把 LLM 遗漏的关键词强制加上（放在末尾，控制台会显示是哪些）。关键词取自卡片（你在 ✎ Edit 中填写的；没有则用 Civitai 的训练词；再没有则用 LoRA 文件中最常用的标签），每个 LoRA 最多 5 个。
- 2.581.0：**📐 SolidCraft 面板中的 ✨ Generate**：描述一个零件（和/或提供一张图片），它就会作为一个个可编辑的特征进入 SolidCraft：草图（直线、圆弧、圆）、拉伸、切除、孔、圆角和倒角都会出现在其时间线中，每一个都可以修改。
  - 只需安装一次：Settings ▸ Add-ons ▸ **CAD generate**，包括 CadQuery（必需：用于运行零件的代码）和 **cadrille**（默认勾选：一个开源 2B 模型，可根据文字或图片编写零件；最好配合 NVIDIA GPU 使用；其权重采用 CC BY-NC 4.0 许可，仅限非商业用途，安装时从 Hugging Face 下载）。
  - **Engine**：Auto（已安装 cadrille 时使用它，否则使用应用的本地 LLM）、cadrille 或本地 LLM（图片会先由视觉模型描述）。运行失败的代码会连同错误信息返回给 LLM，最多重试 2 次。cadrille 接受描述或图片（两者都提供时以图片为准）；它是用零件的干净渲染图训练的，因此零件的渲染图或图纸比照片效果好得多。
  - **into the open design** 关闭（默认）：新建一个设计；开启：添加到当前打开的设计中。
  - 重建结果会经过检查：SolidCraft 中的体积必须与 CadQuery 的一致。遇到暂时无法重建的步骤（旋转、放样、扫掠、抽壳、镜像……），或重建结果不一致时，零件会改为作为单个实体（STEP）导入，并说明原因。
  - 零件的 STEP + OBJ 位于项目的 solidcraft 文件夹中，其代码位于 solidcraft/ai/。**✎ The code**：编辑代码，然后点击 **▶ Run again**。在描述框中按 Ctrl+Enter 即可生成。
- 2.582.0：**编辑工具中的 Fibo 2.0**（Bria AI 的 8B 模型；其权重采用 CC BY-NC 4.0 许可，仅限非商业用途）。提供两种图像风格：**Fibo 2.0 Edit Turbo** 根据指令用 4 步编辑图片，**Fibo 2.0 Dev** 用 30 步根据文字生成图片并编辑图片。两者都位于图像编辑器的 ✨ AI ▸ Edit 中（选区中的图片为 `<image_1>`），并且都可接受最多 4 张参考图（`<image_1>`..`<image_4>`）；参考面板的 `<Picture n>` 标签以及提示词中的 "picture 2" 会自动改写成这种形式。
  - **Low VRAM**：这些风格加载 w4a8 ConvRot 文件（6.6 GB）以及 int8 Qwen3-VL 4B 文本编码器，大约一张 8 GB 显卡即可运行，ComfyUI 会把其余部分移到内存中。GGUF Q4_0 / Q5_0 / Q8_0 也可以使用：在 Settings ▸ Image 中选择 .gguf 作为该风格的 Model（加载器会根据文件类型自动切换；需要 ComfyUI-GGUF 节点包）。
  - **Install**：Settings ▸ Add-ons ▸ **Fibo 2.0**，勾选所需文件（Edit Turbo w4a8、文本编码器和 VAE 默认勾选；选择 GGUF 时也会安装 ComfyUI-GGUF）。Fibo 2.0 需要 2026 年 10 月 21 日或更新的 ComfyUI。
- 2.583.0：**Team ▸ 渲染农场**（2.589.0：改为可选附加组件，见 Settings ▸ Add-ons ▸ Team render farm）：团队成员打开同一个项目，并在彼此的电脑上渲染，前提是得到电脑主人的许可。Settings ▸ **Team**（位于 Remote GPU 之后）：
  - **团队文件夹**是 NAS 上每台电脑都能打开的文件夹（`\\nas\bitgen-team` 或映射的驱动器）。负责人选择该文件夹，输入团队名称和自己的名字，然后按 **➕ Create the team**；其他人输入自己的名字并按 **⇥ Join**。负责人看到请求后按 **✓ Approve**；**🗑 Remove** 将某人移出团队（其密钥立即失效）。在任意一台电脑上都可以用 **⇤ Leave the team** 退出团队。
  - **每日密钥**：负责人的 bitGen 每天会在团队文件夹中为每位已批准的成员写入一个新密钥（运行时会自动执行；**↻ Issue today's keys** 可立即执行）。密钥有效期到当天午夜，且只能与保存在成员自己电脑上的私钥配合使用，复制密钥文件并不能让任何人获得访问权限。如果某天负责人的 bitGen 没有运行，那天就没有人能拿到密钥（渲染农场会等待密钥）。
  - **同一个项目**：**Use the team's projects folder** 让这台电脑打开团队文件夹中的项目（需重启 bitGen）；每位成员都需要设置一次。
  - **🔌 Share this PC for team renders** 会打开渲染端口（默认 8312）：仅在 bitGen 运行且开关打开时生效，并且该端口上只开放渲染农场的调用（应用本身仍只在本机使用）。在同一网络中无需其他设置；通过 **Tailscale** 连接时，在 *This PC's address for the team* 中输入这台电脑的 Tailscale 名称或 100.x 地址。
  - **访问权限**由电脑主人决定：成员发出的 **🔒 Ask for access** 会显示在 *Asks for access* 下，主人可选择 **Unrestricted**（只要 bitGen 在这台电脑上运行，随时都可以）、**from - to**（两个日期和时间；超出这个范围时，电脑会拒绝任务）或 **Deny**。*Access given* 列出可以在这里渲染的人；**↺ Revoke** 收回权限。
  - **🖥 Render on**（状态栏）：**This PC**、某个团队成员的电脑（✓ 表示你有访问权限，并显示其时段；🔒 表示可申请；离线或未共享时显示为灰色），或 **⚡ Spread**（每个新渲染任务分配给本机和你可使用的电脑中最空闲的那台）。菜单中还会显示团队所有电脑正在进行的渲染及其进度。会被分发出去的是生成类任务（图片、视频、歌曲、图、替换、放大……）；安装、下载、训练、影片导出和快速 ffmpeg 任务始终在本机运行。在其他电脑上运行的任务照常显示在你的队列中（其日志会传回），完成的文件位于共享项目中，会像其他渲染结果一样出现在你的素材中。被其他电脑拒绝的任务（无访问权限、超出时段、未共享、文件不在团队的项目文件夹中）会失败，并在日志中注明原因。


- 2.584.0：**🔁 Compare LLMs**（比较 LLM，位于提示词面板的菜单栏）——输入提示词后按 🔁：每个已勾选的 LLM 依次作答（先是 LLM 下拉框中的那个——它已经加载好；其余的轮到时才加载，因此一轮所需的时间与加载它们的时间相当）。每条回复显示在提示词对话中，标有对应 LLM 的名称和用时；在你满意的回复上按 **✓ Use this one**（就用这个）——它即成为这次对话的回答（保存在对话中、朗读出来，歌曲会送往 Music 面板，图像 / 视频代码块会设置模式），其余回复则折叠起来（可显示 / 隐藏）。**✗ None of them**（都不行）记录为没有一个令人满意；**⏹ Stop** 跳过尚未提问的 LLM。这些回复使用的内容与普通对话轮次完全相同（风格、LoRA 关键词、参考图面板、目前为止的对话）。
  - **▾** 选择哪些 LLM 参与（视觉投影器从不出现在列表中）。若设置了外部 LLM 端点（Settings ▸ LLM），则只有一个 LLM，因此 🔁 不可用。
  - **🏆** 显示每项任务表现最好的 LLM——剧本、音乐视频、歌曲、图像提示词、视频提示词、对话（任务由提示词中的用词判断，即 🎬 🖼 📹 🎵 🎤 按钮添加的那些词），或所有任务：每个 LLM 被选中的次数、参与的次数、胜率 %、平均用时、失败次数。**Use** 将该 LLM 设为对话 LLM。下方列出：每一轮的请求和每条回复（🗑 删除单条，🗑 Clear all 全部清除），以及 **⤓ Export CSV** 导出为电子表格。
  - 记录保存在安装文件夹的 **llm_arena/** 中（每轮一个文件）——仅属于这台电脑，绝不会打包进 zip。
  - 如果 LLM 端口上仍在运行旧的 llama-server，它会替每个模型作答；这样的回复会被拒绝并给出提示（"the LLM port answered as …"），而不会以错误的名称记录下来。
- 2.585.0：**用你在 🔁 Compare LLMs 中的选择训练 LLM**——这些选择会成为 🎓 LoRA trainer（LoRA 训练器）中 LLM 微调的训练集，训练结果是写入 LLM 文件夹的一个新 .gguf。
  - 现在每一轮都会保存发送给各 LLM 的**完整提示词**（bitGen 的指令——风格、指南、LoRA 关键词、参考图——目前为止的对话以及请求），这样用它训练出的模型能学会按 bitGen 的提问方式作答。在 🏆 ▸ 某一轮的详情中可以查看。2.585.0 之前的轮次只有请求。
  - **🏆 ▸ 🎓 Train an LLM on your picks** 会说明你已做出决定的轮次能提供什么——你选中的回复作为**示例**，每条未被选中的回复各构成一个**偏好对**（选中 vs 未选中）——针对顶部所选的任务或所有任务。选择训练器的 LLM 任务（或输入名称新建一个），选择示例 + 偏好对 / 只用其中一种，带或不带 bitGen 的指令，然后按 **⤒ Send to the trainer**。再次发送只会添加新的内容。最长的示例以 token 数显示：任务的 **Max length** 必须容得下它（更长的示例会被排除在本次训练之外，并在日志中说明——绝不截断，截断会丢失答案）。
  - 在 🎓 训练器中（LLM 任务）：**Job ▸ Learn from**——**Examples (SFT)**，即你想要的答案；**Preferences (DPO)**，相对于基础模型的"要这个，不要那个"；**Preferences (ORPO)**，同上但无需参考模型（显存占用更少）。偏好训练使用小得多的学习率（已为你设好）和 **Beta**（0.1——越高越贴近基础模型）。**Dataset ▸ 🔁 Preference pairs**：数量、⤒ From 🔁 Compare LLMs、⤓ prefs.jsonl、🗑 Clear the pairs。▶ Start 会为 DPO / ORPO 统计偏好对的数量；日志会显示选中的答案已经胜出的频率。
  - 有效的训练需要几百次选择，最好集中在一种任务上（比如剧本）。训练从基础模型的原始（Hugging Face）文件开始——.gguf 无法训练——结果是一个新的 .gguf。请检查你用来训练的每个模型回复所属模型的许可证：有些模型不允许用其输出训练其他模型。
- 2.585.0：**LLM 将哪些 LoRA 的关键词写入提示词**（✨ Enhance 和提示词对话）：Basic Settings 中 **Override style**（覆盖风格）开启时，只用那里的**临时 LoRA**（属于 Generate 模式——图像或视频）；关闭时，只用**所选风格的 LoRA**（Image 用图像风格，Video 和 Chat 用视频风格）。在 🧩 Model manager 中选的 LoRA 本身不再计入。
- 2.586.0：**Settings ▸ Add-ons ▸ LLM**——对话 / 写作 LLM 集中在一个下拉框中：选一个并按 **⤓ Download**——.gguf 会放入 LLM 文件夹（Settings ▸ LLM），并出现在提示词面板的 LLM 下拉框和 🔁 Compare LLMs 中。✓ 标记你已有的模型；**🗑 Delete it** 删除所选的那个（不能删除正在运行的）。
  - **★ Qwen3.8 27B**（阿里巴巴，2026 年 8 月，Apache 2.0）是我们推荐用来制作**你自己的检查点（checkpoint）**的基础模型：UD-Q4_K_XL（17.6 GB）可在 24 GB 显卡上运行，Q5_K_XL / Q8_0 质量更高。在 🎓 训练器中，其基础模型可在 32 GB 显卡上以 4-bit QLoRA 方式训练（使用 Unsloth 的 4-bit 检查点；16-bit LoRA 需要超过 36 GB）。
  - **Gemma 4 31B**（Google，Apache 2.0）——另一款同级别的出色写作模型；**Gemma 4 12B**（QAT，6.7 GB）——速度快，训练起来也快；**Qwen3.5 9B**；以及设置向导中的 Qwen3 4B / 8B / 14B。
  - 用 🔁 Compare LLMs 在你自己的任务上比较你下载的模型，然后用你的选择训练胜出者。
  - Qwen3.8 和 Gemma 4 需要较新的 llama.cpp——如果模型无法加载，请用 misc\get-llama.ps1 更新。
- 2.702.1：**Credits**（致谢）——Dandyson EEbu (Baridakara) 因文字特效和字体获得致谢（见 Settings ▸ About 以及 Credits 部分的 Text effects and fonts 下）。
- 2.702.0：**SVG 图片**——.svg 可以放入 Assets（拖入，或 + add pictures）以及 References（拖入、+ add reference，或从 Assets 拖过来）。上传之后的环节都不读取 SVG（ComfyUI、时间线和模型都需要像素），因此工作室在导入时将其绘制为 PNG——画质清晰，因为矢量图按实际使用的尺寸绘制（长边至少 2048、最多 4096 像素），并保留透明背景。之后 Assets 中保存的是 <name>.png。Open 对话框会将 .svg 与其他图片一起列出，因此 Image Edit 的 Open 和 Place as Layer 也能使用 SVG。需要旁边其他文件（链接的图片或字体）的 SVG 在绘制时不含这些文件。**1920 x 1080 的徽标**位于 docs/images/bitgen-logo-1920x1080.png。
- 2.701.0：**启动画面**——桌面应用打开时会播放一段 15 秒的徽标短片（线条绘出、翅膀扇动、"bitGen Studio"、"together · grow · transform"）以及致谢 **Produced and developed by Timothy Nolan Paul** 和 **Programmed by Claude Opus 5.5**，同时工作室在后台启动。点击画面或按任意键可跳过；短片结束时（无论如何最迟 16.5 秒后）工作室就会出现。BITGEN_NO_SPLASH=1 可将其关闭。该短片也位于 docs/images/bitgen-studio-splash.mp4。**安装程序**也会显示徽标（在其标题栏和每一页的页眉中）。
- 2.700.1：徽标不再被裁切——标题栏显示完整的蝴蝶（static/logo-mark.svg，即按轮廓裁剪的徽标），应用图标也在边框内为翅尖留出了空间。
- 2.700.0：**bitGen Studio 徽标**——由 Tim 亲自设计（为 Tiger Art 而作）：两只老虎象征不畏万难的合作，一棵树象征成长，它们共同组成的蝴蝶则象征蜕变为美好的事物。它是应用图标（窗口、任务栏、Windows 安装程序）、浏览器标签页的图标，以及标题栏左侧的标志（采用主题的强调色）。一段 10 秒的徽标介绍短片位于 docs/images/bitgen-studio-intro.mp4（由 misc/intro/ 制作——运行 node misc/intro/render.js 可重新生成）。
- 2.699.0：**编辑尺寸跟随 Override style**——勾选 Basic Settings 的 **Override style** 时，对 References 图片的编辑按 Basic Settings 的 Size 输出（同 2.698.0）；未勾选（或 Size = Style's own）时，按**第一张参考图自身的尺寸**输出（以 16 px 为步长，长边最多 4096 px）——工作流保持该尺寸，而不是缩放到它自己设定的百万像素数。
- 2.698.0：**编辑按 Basic Settings 的 Size 输出**——对 References 面板图片的编辑（提示词面板的 ✏ Edit，或在图像编辑器关闭时的 Refine）现在使用 Basic Settings 的图像 **Size** + **Aspect**：图片 1 被裁成该形状（保留中间部分），工作流保持该尺寸（其自身的"scale to N megapixels"步骤随之调整）。**Style's own** 与以前一样保持图片自身的形状和尺寸。在图像编辑器内进行的编辑保持选区的尺寸（结果会贴回到选区上）。


- 2.697.0：**P-H3 Image Edit 可以正常使用了**——此前每个 P-H3 Image Edit 任务都会失败并报 "Return type mismatch between linked nodes [guider]"：移除未使用的图片槽位时，把工作流图中的 guider 也一并移除了。现在只移除槽位自己的参考节点（角色创建器的 guider 也曾受到同样的影响）。
- 2.696.0：**Sketcher 专用的 Photo 风格**——Sketcher 工具栏上 ✨ Photo 左侧的下拉框列出了各种图像编辑风格；✨ Photo 使用在此选中的风格（提示词面板保留自己的风格），上次使用的风格会保持选中（重启后也是如此）。所选风格已不存在时，会回退到提示词的编辑风格或默认编辑模型。
- 2.695.0：Sketcher 中的**屋面材料**。屋顶（或 Roof 工具）的 **Covering**（屋面材料）：预涂彩钢板——波纹板、肋板（梯形）或直立锁边——混凝土瓦、陶土瓦、石板瓦、沥青瓦或透明聚碳酸酯板。屋顶会采用该屋面材料的颜色（直到你自己选色）及其纹理——金属板为沿坡向下的肋条，瓦片、石板瓦和沥青瓦为成排的瓦层和错缝。面板会给出该屋面材料典型的最小坡度，屋顶比它更平缓时发出警告（⚠）——请核对制造商自己给出的最小值。在椽子、天花搁栅和过梁校核中，瓦片和石板瓦按重型屋面计，金属板和沥青瓦按轻型屋面计；✨ Photo 的提示词会写明屋面材料（"a hip roof of terracotta roof tiles"）。
- 2.694.0：Sketcher 中的**屋顶构架**。选中屋顶的 **🪵 Roof framing**（屋顶构架）：**Rafters**（椽子）——在每个坡面按间距（450 / 600 / 900）布置普通椽子，设一根脊板，在两个坡面共用的斜边上设斜脊 / 斜沟椽子，在复折式 / 孟莎式屋顶改变坡度处设折线檩条，在顶梁板上设天花搁栅，并在长度超过你设定值的坡面中部设一道下檩条（0 = 从不），用撑杆向下支撑到天花搁栅——或按间距布置 **Trusses**（桁架）（上弦、下弦、腹杆；由桁架厂家设计）。椽子和天花搁栅同样有 ✔ / ✗ 参考校核和 **✔ Size them**（椽子按沿坡到下檩条的跨度计算，天花搁栅按其支撑点的间距计算）。除平屋顶和随墙坡度的屋顶外，所有屋顶类型都会生成构架。用 **🪵 Show framing** 显示，它现在也会让屋顶变为透明；合计数量显示在面板和构件清单中。斜脊、屋脊、下檩条和撑杆只做布置，不确定截面尺寸。
- 2.693.0：Sketcher 中的**墙体构架**。选中房间的 **🪵 Wall framing**（墙体构架）为每面墙设置构架：**Timber**（木结构：立柱尺寸和等级，一道或两道顶梁板）或 **Light-gauge steel**（轻钢：C 型钢立柱，一道顶部导轨），立柱间距（300 / 450 / 600），横撑的排距以及名义斜拉带支撑；**Frame this room's walls** 可将某个房间排除在外。每面墙都有底梁板（在门处断开）、顶梁板、按间距布置的立柱、洞口两侧各一根边立柱、门窗头 / 过梁上方和窗台托梁下方的短立柱、成排的横撑（在洞口处断开）、每个长 1.8 m 及以上的无洞口墙段中的一道斜拉带支撑，以及每个转角处的一根角柱；两个房间共用的墙只生成一次构架。房间的合计（立柱数，立柱 / 梁板 / 横撑的米数，支撑数）显示在面板和构件清单中。用 **🪵 Show framing** 绘制显示。按常规做法布置——不校核立柱尺寸（AS 1684 的立柱表：墙高、间距、风荷载），支撑也只是名义性的（以 AS 1684 / 你的工程师为准）。
- 2.692.0：Sketcher 中的**楼板体系和过梁**。选中一个房间并设置其 **🏗 Floor system**（楼板体系）：地面板（带边梁）、华夫格空心板（模壳 + 肋）、加劲筏板（内梁）、墩柱上的架空楼板，或架在混凝土 / 钢 / 砖 / 木短柱上的**架空木地板**，其托梁和搁栅尺寸由你确定（标准尺寸，MGP10 / MGP12 / MGP15 松木或 F17 硬木，间距 300 / 450 / 600）。结构会在 3D 中建在房间下方并列出（数量和长度）；架空地板在托梁下净空不足时会给出提示。每根搁栅和托梁都会用基于该等级公开强度和刚度的简单梁计算进行**校核 ✔ / ✗**（住宅楼面 1.5 kPa、1.8 kN 集中荷载、振动限值）；**✔ Size them** 会选出能通过校核的最小标准尺寸。外墙上的门窗会有 **🪵 Lintel**（过梁）——Auto（按其宽度、屋顶荷载宽度以及金属板或瓦屋面选出能通过的最小尺寸）或由你自选。**🪵 Show framing** 会让墙体变为透明，以便看到过梁。这只是参考，不是认证：未抄录任何供应商或标准的跨度表——请对照 AS 1684 或供应商的跨度表确认尺寸，楼板 / 基础须由你的工程师设计（AS 2870；场地类别会与楼板一起记录）。
- 2.691.0：Sketcher 中**新墙与旧墙对接**：墙的自由端碰到另一面墙时，新墙会止于这面墙，而不再生成自己的方形端头。首尾相接（已连接，或恰好画在那里）时，旧墙的端部会顺着转角塑形，使两者的外侧面相交——形成一个干净的转角，如同一面墙。端点落在另一面墙轴线上的墙（从一面墙横穿房间到另一面墙，或接入房间侧面）会被裁到那面墙的墙面处，即使有角度或比它更厚也是如此。**Wall thickness**（墙厚）现在会记住你上次设置的值——无论是在 Wall 或 Room 工具中，还是在选中的墙或房间上——之后画的墙和房间都使用这个厚度；大于 2 的数字按毫米解读（200 = 0.2 m）。之前保存的、卡在 2 m 上限的厚度会恢复为 150 mm。
- 2.690.0：Sketcher 中**墙体首尾相连**：用 ▮ Wall 绘制时，靠近另一面墙端点或转角的点（约 15 cm 以内，缩小视图时为 14 px）会被吸附上去——提示显示 **⊕ joined**（按住 Shift 可自由放置）。在那里结束的墙会与那面墙**连接**：拖动新墙时，旧墙的端点随之移动，旧墙因而变长或变短；拖动旧墙时，新墙也同样跟随。从端头引出绘制的墙也会连接，连接关系随模型一起保存。同时拖动两者则会作为一个整体移动。
- 2.689.0：**Sketcher 中的 🗄 柜子与搁架**（🛋 Furniture ▸ Category **Cupboards & shelving**）：嵌入式衣柜、步入式衣帽间、布草柜、食品储藏柜和扫帚柜、书架和置物架。
  - 选一个模板，或按 **🗄 Design / change…** 打开对话框：名称、布局（**straight** 一字形、**L-shape** L 形或 **U-shape walk-in** U 形步入式）、宽 / 深 / 高（L / U 形还有衣柜的进深）、板材厚度、踢脚、柜门（无、平开、推拉、折叠、玻璃——以及是否在 3D 中显示）、拉手（条形、圆钮、边缘抠手）、柜体 / 柜门 / 拉手的颜色（任意颜色或 Sketcher 的某种材质）。
  - 每一排（Back、Left、Right）都有自己的**格位**：宽度（0 表示均分剩余宽度）、里面放什么（挂衣杆、双层挂衣、搁板、抽屉 + 搁板、鞋架、开放）、搁板 / 抽屉的数量；↑ ↓ 调整顺序，✕ 移除一格，＋ Add bay 添加格位，⇔ Share evenly 均分。每次修改后，正视图和平面图都会随之更新。
  - **💾 Save as template** 保存你的设计（按名称保存——同名则替换），可用于所有项目；你的模板在 Furniture 面板中以 ★ 标出，并列在对话框的 **Yours** 下；🗑 Delete template 可删除模板。
  - 在房间内点击，它会背靠最近的墙放置、朝向室内，靠近转角时紧贴转角；在房间外点击则独立摆放。选中后，其面板有 Width / Depth / Height、Doors in 3D、**✎ Design…**（Apply = 一个 ↶ 撤销步骤）和 **↔ Fit the wall**（与墙等宽；步入式衣帽间还会与房间等深）。
  - 在平面图和 📄 Plans 中：显示每一排及其格位，挂衣杆以虚线表示，并显示推拉轨道或门的开启弧线。
- 2.688.0：**Sketcher：工具栏始终可见、墙端头、Ctrl+拖动、更真实的 Photo 提示词。**
  - Sketcher 的顶部工具栏（☰ File … ✨ Photo、📄 Plans、Send）始终显示在屏幕上：停靠时，面板不再能被滚动到工具栏下面，视图占据剩余的空间。
  - **点击墙的端头**（开口墙末端的方形端盖），即可选中整面墙。**双击它**进行推 / 拉：沿墙拖动端头使墙变长或变短（1 cm 步长，Shift：自由；Esc 结束）。端头自身的宽度（墙垛）在墙的面板中设置：**▪ This end's width…**。转角保留各自的构件。
  - **Ctrl+拖动**移动普通拖动会移动的对象，并按你拖动的方向锁定为**水平或垂直**（与 Shift 类似）。不拖动的 Ctrl+点击仍是将对象添加到选择中（或从中移除）。
  - **✨ Photo** 现在根据模型生成提示词：写明其中有什么（房间、门、窗、屋顶类型、楼梯、按名称列出的家具、人物、泳池、道路、地面）以及你使用的材质，不要求任何别的东西。模型中没有窗户，提示词中就不会出现窗户或玻璃。


- 2.687.0：Sketcher 中**更低调的草图平面**：点击一个面仍会将其设为草图平面（工具栏的 ✎ 标签显示其名称，绘图工具在其中绘制，⊥ Look at 转向正对它），但不再在其上绘制橙色方框和网格。用 📌 保留的平面仍会显示淡淡的虚线轮廓。
- 2.686.0：**🎨 Change style 先绘制线稿**：当提示词的图像风格不是编辑模型时（SDXL、Pony、Illustrious、SD 1.5、FLUX.1 …），Change style 会先把图片转成 ✏ 线稿，然后由风格通过线稿 ControlNet 在其基础上生成新外观。新图片保留线稿的轮廓，而外观、颜色和渲染效果都是新的。线稿会在原图之后出现在预览中，结果则在线稿之后。
  - ControlNet 必须与风格的模型系列相匹配：SDXL、Pony 和 Illustrious 使用 SDXL 的 ControlNet（**Settings ▸ Add-ons ▸ ControlNet** 中的 SDXL ControlNet Union ProMax 可以使用，并会被告知输入是线稿）；SD 1.5 和 FLUX.1 需要在 ComfyUI 的 models/controlnet 中放入各自的线稿 ControlNet。
  - 若该系列没有 ControlNet（Krea 2、FLUX.2、Qwen、Z-Image、Anima …），或无法生成线稿（缺少 ControlNet 附加组件的节点），则改为以图生图的方式重新生成图片——提示栏会说明原因。
  - 编辑模型（FLUX.2 Klein edit、Qwen Image Edit …）仍自行遵循外观指令，不使用线稿。
  - Basic Settings 的 Override（步数、CFG、检查点、临时 LoRA）同样作用于线稿渲染。
- 2.685.0：**🎨 Change style 使用 Override style**：提示词中为 SDXL、Pony 或 Illustrious 风格时，Change style 现在会用该风格自己的工作流（图生图）重新生成整张图片。因此会使用该风格自己的检查点和 LoRA；开启 Basic Settings ▸ Override style 时，还会使用其中的步数、CFG、检查点和临时 LoRA。以前这些风格运行的是固定的 SDXL 局部重绘工作流，会忽略以上所有设置。渲染期间，按钮旁的提示栏会显示 Override 对这张图片应用了什么（例如 "Override: steps 30, CFG 6, checkpoint …"），或某个值为何被略去（SDXL 检查点无法在 FLUX.2 Klein 这类编辑模型中运行）。
- 2.684.0：**整齐的外观下拉框**：在图像预览中，🎨 Change style 旁的外观下拉框现在只与其文字等宽，并与按钮同高，因此预览的工具栏能保持在一行内。
- 2.683.0：**⇄ 恢复正常**：现在选择另一个图像或视频风格时，之前的那个总会成为上一个设置，因此 ⇄ 可以带你回去（以前，Basic Settings 为新风格填入数值时会把旧设置覆盖掉，⇄ 一直呈灰色）。**— none —** 和 **— template —** 也算作设置。还没有可返回的设置时，⇄ 显示为暗色，按下时旁边会提示这一点。
- 2.682.0：**在编辑主题模式下 Shift+点击可执行按钮**：开启 🖌 时，按住 Shift 点击按钮即可执行其功能（Alt+点击仍然同样有效）。普通点击仍是选中按钮以设置其样式。
- 2.681.0：**外观保持选中**：在图像预览中，外观现在是一个下拉框（📷 Photoreal、🧸 Pixar、🧊 2.5D、🌸 Anime、🖍 Cartoon），旁边是 **🎨 Change style**。你选的外观会保持选中（重启后也是如此），每按一次 🎨 Change style 都会以该外观重新生成当前显示的图片。其工具提示会说明使用的是哪个图像风格。
- 2.680.0：**⇄ 上一个设置**：位于提示词面板的图像风格和视频风格下拉框旁。更换风格后，你之前的风格成为*上一个*设置；**⇄** 将其恢复——而被替换的那个又成为上一个，因此再按 ⇄ 会来回切换。开启 **Override style** 时，一个设置还包含该类型的 Basic Settings 数值及其临时 LoRA，⇄ 也会将它们一并恢复。工具提示会说明 ⇄ 将恢复什么。设置保存在应用文件夹的 model_settings.tmp 中，因此重启后仍然保留。
- 2.679.0：**🎨 Restyle——结果与 ⇆ Before / after**：🎨 Style 渲染完成后，成品图片会在预览中紧接原图显示——如果你在此期间关闭了预览，它会重新打开并显示结果。**⇆ Before / after**（位于 🎨 Style 旁）将原图和结果并排显示并加上标注；再次点击即可返回。每张重新风格化的图片都有此功能，之后从图库打开结果时也是如此（此浏览器会记住最近 200 张）。
- 2.678.0：**P-H3 Image**（PrunaAI/P-H3-Image-Comfy——PrunaAI 基于 MiniMax H3 的图像模型）：**Settings ▸ Add-ons ▸ P-H3 Image** 会下载其 LoRA（2 GB）、文本编码器（int8）、VAE（int8）和提示词扩写器（w4a8）——共约 17 GB——并使用视频已有的 MiniMax H3 FL2VA transformer（仅在缺失时才下载）。它附带两种风格：**P-H3 Image**（文生图，默认 2048 x 2048——最高约 8 MP；你的提示词会以 "Aspect ratio: … Request: …" 的形式发送给其扩写器）和 **P-H3 Image Edit**（将要编辑的图片放在参考图面板的第一位，另可再放最多 7 张作为参考；结果保持其形状，约 4 MP）。8 步，无 CFG，无负面提示词。P-H3 Image Edit 也可作为图像编辑器 ✨ Edit 和预览中 🎨 Style 的编辑模型。它需要带有 P-H3 节点的 ComfyUI——在下一个正式版（0.44）发布之前，这些节点位于 ComfyUI 的 master 分支 / nightly 版本中；较旧的 ComfyUI 会被拒绝，并提示如何更新。许可证：MiniMax H3 Community License（未获 MiniMax 授权时，欧盟、英国、韩国和美国被排除在外；须显示 "Powered by MiniMax H3"）。8 MP 时约需 21-31 GB 显存；int8 / w4a8 文件需要 NVIDIA Ampere 或更新架构的显卡。
- 2.677.0：**图片下方的重新风格化进度**：🎨 Style ▾ 渲染运行时，图片下方（预览按钮上方）的一条细进度条会显示进度——排队和加载模型时是一条移动的条纹，之后随采样器的步数逐渐填充（"🧸 Pixar · step 12 of 25 · 48 %"）；完成时变为绿色（结果打开时渐隐），失败时变为红色。
- 2.676.0：**图像预览中的 🎨 Style ▾**：打开任意图片（图库、素材 …），按 💾 Save 旁的 **🎨 Style ▾**——选择 **📷 Photoreal**、**🧸 Pixar**、**🧊 2.5D**、**🌸 Anime** 或 **🖍 Cartoon**。图片会用提示词中选择的图像风格重新生成：编辑模型（FLUX.2 Klein、Qwen Image Edit、FLUX Kontext …）会被要求只改变外观，保留构图、面部、姿势和服装；SDXL / Illustrious / FLUX.1 风格则用该外观的描述词和图片自身的提示词对整张图片进行细化（强度 55-72 %）。Basic Settings 中开启 **Override style** 时，会像 Generate 一样使用其中的步数、CFG、种子、检查点和 LoRA。这是一个普通任务（队列、图库、日志）；完成后会在预览中紧挨原图打开。两种方式都不支持的风格会给出提示。
- 2.675.0：**📌 图钉固定不变**：面板的 📌 图钉（其固定高度，侧边面板则为固定宽度）在布局变化时不再被清除——包括 ⊞ Docker configs 为你打开的面板加载尺寸、切换 🗂 工作区、应用 🗂 Layout，或在 Settings ▸ Dockers 中执行 ↺ Reset。像以前一样点击图钉可固定 / 取消固定；**右键点击它**会弹出一个小菜单：*📌 Pinned at … px* 和 **↺ Reset pin**（恢复为任意尺寸），未固定时则为 *📌 Pin at this size*。
- 2.674.0：**所有功能共用一个 ComfyUI 文件夹**：Settings ▸ ComfyUI ▸ Folder 为空时，bitGen Studio 现在会在应用旁的 comfy\、ComfyUI\ 和 ComfyUI_windows_portable\ 中查找 ComfyUI（有多个时取最近更新的那个），然后再到模型列表找到它的位置查找——启动器、每个附加组件的下载（MOSS-Image、FIBO、AI Fill …）、模型目录和 ComfyUI 清理都使用这同一个文件夹。以前，文件夹为空时下载会进入 comfy\ComfyUI\models，而实际在用的却是 ComfyUI\ 中的 ComfyUI。设置文件夹（或 🔎 *Use this folder*）后仍以你的设置为准。
- 2.673.0：Sketcher 中的 **🛤 Road tool**（道路工具，Ground ▸ 🛤 Road）：选择类型——**Dirt road**（土路）、**Street**（街道）、**Road**（公路）、**One-way road**（单行道）、**Avenue**（大道，4 车道，带绿化中央分隔带）或 **Highway**（高速公路，6 车道，带中央隔离墩和护栏）——然后沿路线点击；双击或按 Enter 结束道路。道路贴合地面（横向找平）。在道路端点附近点击会从那里接着画，在道路上点击会形成 T 形路口（Shift：不吸附）。每种类型都有最大坡度（土路 20 %、街道 15 %、公路 / 单行道 12 %、大道 8 %、高速公路 6 %）；更陡的地面会标记 ⚠，面板提供 **⛏ Cut the ground**（统一坡度，按 1 : 2 边坡对地面挖填——显示土方 m³）或 **🚇 Tunnel / bridge**（穿过高地时用带洞门的隧道，跨越深谷时用带桥墩的桥梁）；*When too steep* 可直接执行其中一种。路口会自动识别：主干道相交处设**红绿灯**（含人行横道和停止线），次要道路接入主干道处设**停车标志**，两条街道相交处设全向停车，街道尽头接另一条街道处设**让行**标志；另外还有限速、单行和路名标志。*Traffic keeps to the* 可设为靠左（澳大利亚、英国——白色中心线）或靠右（美国——黄色）。Alt+点击道路可拖动其节点；➤ Select 可选中道路（名称、类型、经过的陡坡、⛏ Grade again、🗑）。平面图和 📄 Plans 会绘出道路及其名称。


- 2.672.0：**MOSS-Image 替代文件**：当 ComfyUI 中没有该风格所需的小型 FLUX.2 VAE（flux2-vae_small）但有完整版（flux2-vae），或有另一个版本的 Qwen3.5 9B 文本编码器（w4a8 / int8 / bf16）而非所要求的那个时，渲染会使用你已有的文件，并在日志中说明。未勾选任何模型时，Settings ▸ Add-ons ▸ MOSS-Image 只安装文本编码器 + VAE——供你自己的 MOSS 模型使用（Civitai 上的微调模型：将其设为风格的 Model）。
- 2.671.0：Sketcher 中的**檐沟截面**：选中一个屋顶——**Gutters** 列出内置截面（Quad (box)、Half round、OG (ogee front)、Square line (deep)），**Gutter profile** 以图片形式显示它们（以及你自己的截面），**✎ Gutter profiles…** 以 *Gutter* 类型打开截面编辑器：封檐板是其左侧的那条线，x 从封檐板向外，y 从檐沟底部向上，檐沟后壁的顶端挂在屋顶边缘正下方。绘制方法与踢脚线或檐口线相同（点击 / 拖动节点，双击线段添加节点，右键点击 ▸ Convert to curve / line，Delete node），然后按 💾 Save——屋顶的檐沟随即采用你的截面（项目会保存它，包括曲线），沿每条檐口扫掠生成；落水管位于其中部下方。Roof 工具自身的选项也可以选择檐沟截面，用于它之后生成的屋顶。
- 2.670.0：Sketcher 截面编辑器中**带贝塞尔曲线的截面**（踢脚线、檐口线、门 / 窗框、窗台——✎ New / edit profiles…）：每段内置的圆弧和 S 形曲线现在都是只有两个节点（起点和终点）的一条曲线，因此 Cove 檐口线只有三个节点。**点击**节点或线段可将其选中；**拖动**节点（其控制柄随之移动）或曲线的两个**控制柄**（在选中的线段上，或在选中节点的两侧显示）；**双击**线段可在该处添加节点（曲线会被拆分而形状不变）；**右键点击**线段可选择 *Convert to curve* / *Convert to line* 和 *Add a node here*，右键点击节点可选择 *Delete node*（Delete 键也可以）。保存的截面会保留其曲线；较旧的截面打开时为直边。
- 2.669.0：**彻底清理 ComfyUI——在更新前以及 bitGen Studio 退出时。**
  - **⤓ Update ComfyUI**（Settings ▸ ComfyUI）会先运行 `misc\clear-comfy.bat`：停止所有 ComfyUI 进程（包括你自己启动的——其 Python 占用着更新要替换的包），释放 8188 端口，并清空 ComfyUI 的 `temp\`、`__pycache__` 文件夹和 ComfyUI-Manager 的缓存——绝不会动你的模型、输出、输入、工作流或设置。其输出会显示在更新日志中。由 bitGen Studio 启动的 ComfyUI 会在之后重新启动。
  - **bitGen Studio 退出时**（关闭应用窗口、关闭其控制台窗口 / Ctrl+C，或应用崩溃）：会运行 `misc\clear-comfy.bat`，结束仍在从其文件夹运行的所有 bitGen Studio 进程（渲染 / 音乐 / LLM 工作进程、llama-server、ffmpeg …），并且 `start.bat` 打开的终端窗口会自动关闭。
  - Settings ▸ ComfyUI ▸ **Clear ComfyUI completely when bitGen Studio exits**（bitGen Studio 退出时彻底清理 ComfyUI，默认开启）——它优先于 *Leave ComfyUI running*；将其关闭即可像以前一样让 ComfyUI 在各次会话之间保持运行。
  - 为此 `misc\clear-comfy.bat` 新增了 `/nopause`（结束时不显示 "press any key"）；手动运行时与以前相同。
- 2.668.0：Sketcher 中的**屋檐、封檐板和檐沟**：Roof 面板（工具的和选中屋顶的）以四张图片显示屋檐形式——**Simple**（仅挑檐）、**Open**（挑檐下露出椽尾，间距 600 mm）、**Boxed**（从封檐板到墙面的平吊顶）和 **Closed**（椽子下方顺屋面坡度的衬板）。**Fascia + barge boards** 在檐口设封檐板，在山墙的山墙边上设博风板（*Fascia height*）；**Gutters** 可选 None / Quad (box) / Half round，挂在封檐板上，并在每段檐沟末端附近设 **Downpipes**（落水管）沿墙而下。选中的屋顶还有 *Fascia / soffit colour* 和 *Gutter colour*。Roof 工具新建的屋顶默认为 Boxed，带封檐板和 Quad 檐沟；之前创建的屋顶保持不变。它们也会显示在建筑图纸的立面图上。
  **MOSS-Image：** 它需要 ComfyUI **0.42.2 或更新版本**——ComfyUI 0.41.x 和 0.42.1 能识别该模型，但渲染出来全是噪点。现在，在版本过旧的 ComfyUI 上，MOSS-Image 图片会在排队前就被拒绝，并说明如何更新（Settings ▸ ComfyUI ▸ ⤓ Update ComfyUI）；该附加组件的安装过程也会提示这一点。MOSS-Image (SFT) 风格不再添加跳层引导（skip-layer guidance）（ComfyUI 自带的模板中该项为关闭；MOSS-Image Base 保留该项）。
- 2.667.0：**Sketcher 的对象面板**（其工具栏上的 🗂 Outline）新增：
  - **Shapes**（形状）——绘图工具生成的每个形状：*Solid n*（封闭）、*Shape n*（平面或开放）、*Lines n*（散线），以及以各自名称列出的每个组。点击一行即可选中该形状，然后在视图中拖动它的某个面进行推 / 拉。拖动组的面也会对其推 / 拉；点击仍是选中整个组。
  - **Construction**（辅助）——其中包含 **Planes** 和 **Construction lines**。
    - *Planes*：用 ➤ Select 点击一个面将其设为草图平面，然后用 📌（在工具栏中它的标签上，或在它的行上）将其保留。标题上的 ＋ 可创建一个经过原点的地面 / 正面 / 侧面平面。点击平面所在的行可再次在其中绘制；⊥ 可正对它查看。
    - *Construction lines*：使用 📏 Tape measure，在第二次点击时按住 **Ctrl**——生成一条穿过两点的虚线，绘图工具会吸附到它上面（*On Guide*，以及两条线的交点）。
    - 👁 隐藏平面或辅助线，🗑 将其删除。
  - **重命名任何对象**——双击某行的名称（或在选中的行上按 F2），输入后按 Enter（按 Esc 则保持原名）：房间、房间组、墙、地板、天花板、踢脚线、檐口线、门、窗、屋顶、楼梯、灯、家具、摄像机、形状、组、平面和辅助线。重命名为一个撤销步骤；属性面板的标题会使用新名称。
- 2.666.0：Sketcher 中的 **△ Roof types**（屋顶类型）：Roof 工具的面板（以及选中屋顶的面板）以图片显示每种类型——**Gable**（双坡）、**Hip**（四坡）、**Skillion**（单坡 / 披屋）、**Dutch gable**（荷兰式山墙：四坡顶，每端顶部有一个小山墙——gablet）、**Clipped gable**（截角山墙 / jerkinhead：顶部向后做成坡面的山墙）、**Gambrel**（复折式 / 谷仓式：下陡上缓）、**Mansard**（孟莎式：四面陡坡，顶部为平缓的四坡或平顶）、**Saltbox**（盐盒式：屋脊偏离中心）、**Pyramid**（攒尖）、**Butterfly**（蝶形：两坡向下汇成天沟）、**Flat**（平屋顶）和 **Follows the walls' slope**（随墙坡度）。点击图片即可更改屋顶类型。每种类型有各自的设置：Pitch（gambrel / mansard：Upper 和 Lower pitch）、荷兰式山墙的 *hip part of the rise*（四坡部分占屋顶升高的比例）、截角山墙的 *clipped part*（截角部分）、gambrel / mansard 的 *break*（折点）、盐盒式的 *ridge from the front*（屋脊距正面的位置），以及 *Flip*（skillion / saltbox：将高侧换到另一侧）。Ridge（顺向 / 横向）、Overhang、Thickness 和 Colour 适用于所有类型。每种类型都会显示在建筑图纸的立面图和屋顶平面图上。
- 2.665.0：Sketcher 中的 **📄 Building plans**（建筑图纸）：其工具栏上的 **📄 Plans**（位于 ✨ Photo 之后）会打开 *Building plans* 对话框——拖动其标题栏即可移动。可选择：
  - **Sheet**（图纸）A4 / A3 / A2 / A1，横向或纵向，以及**比例**——*Auto (fits)*（能容纳各视图的最大标准比例）或 1:20 - 1:500。
  - **Pages**（页面）——*All views on one sheet*（所有视图共用一个比例，例如全部放在一张 A1 上）或 *One view per page*（在 Auto 下每页各用自己的比例）。
  - **Views**（视图）——每层的平面图、四个立面图（北、东、南、西——平面图上北向朝上）以及屋顶 / 总平面图（屋顶、泳池、车道、地面等高线）。
  - **Show**（显示）——尺寸 + 标高（每个外墙面、沿墙的门 / 窗、总尺寸，单位 mm；立面图上的 FFL 标记和高度）、房间名称 / 尺寸 / 面积、家具、着色（使用材质的颜色）。
  - **Title block**（图框标题栏）——项目、图名、绘图人、日期、修订版本和备注；还带有指北针、比例尺和 *Sheet n of m*。预览会显示每一页（◀ ▶）。**💾 Save PDF**（Ctrl+Enter）将其写入项目的 pdf 文件夹（图像编辑器的 File ▸ Open PDF from Project 会列出它），勾选 *Download too* 时还会保存到你的下载文件夹。对话框会记住你的选择。
- 2.664.0：Sketcher 中的 **🧍 Mannequin model**（人体模型）：Furniture (🛋) ▸ Category *People* ▸ **mannequin (model)**，然后点击它站立的位置——一个建模的女性人体模型，身高与人物的 Height 相同。其面板中的 Pose 可在它和摆好姿势的 House-builder 人物之间切换。该模型由 CGTrader 上的 dimasalcalde 和 zahers 制作（Settings ▸ About ▸ 3D models）。其文件（ext/pushpulldock/assets/mannequin-female.json）单独打包在一个 zip 中，不在公开仓库里；没有该文件时会改为绘制站立人物。


- 2.663.0：Sketcher 中的**拆分墙体、草图平面和 ⊥ Look at**。
  - **双击一面墙**（使用 ➤ Select——从上方看、在 📐 floorplan（平面图）上，或在 3D 中墙顶以下的墙面上）即可在该处将其拆分；再次双击可继续拆分。拆分后每一段都是一面独立的墙：点击它，按 **Delete** 只删除这一段；沿垂直于墙线的方向**拖动它**即可移动——当两侧相邻的墙呈直线延续时，每侧会各生成一面新墙，把移动后的墙段与房间连接起来（形成凸出或凹进）。在 3D 中双击墙顶仍然是切割墙顶（形成斜坡）。
  - **Wall tool**（墙体工具）可在房间墙体的任意位置吸附（*On Wall*）：新墙的起点和终点都可以落在墙上，或落在拆分点上。
  - 点击房间的**墙角**或墙的**端头**（Select）：其面板可设置 **Width**（宽度；比墙宽 = 壁柱），端头还可设置 **Length past the end**（超出端部的长度）；Delete 会把它恢复为普通墙体。从它上面拖动仍会绘制一面新墙。
  - **Sketch plane**（草图平面）：用 Select 点击的面（墙面、地板、模型的某个面）会成为草图平面——工具栏上的标签会显示它的名称（2.687.0：不再在该面上叠加绘制任何内容）。之后 Line、Rectangle、Circle 和 Polygon 都会在该平面内绘制。点击标签上的 ✕、按 Esc 或点击空白处即可结束。工具栏上的 **⊥ Look at** 会让视图正对该平面。
- 2.662.0：Sketcher 中的**方形墙端**，以及**从墙角和墙端拖出新墙**。
  - 现在每面墙都是从墙角到墙角的矩形——单独选中、隐藏或升高时，墙端是方形的，而不是尖角。墙角是用于填补空隙的独立构件，独立墙的两端各有一个方形端头。
  - 使用 ➤ Select 时，将指针指向房间的外墙角或墙的端头——它会高亮显示。**从它的某个侧面拖出**，就会沿该方向生成一面新墙（从端面拖出：沿原墙方向延伸；从侧面拖出：与原墙垂直）。从它的**顶面**拖出（从上方看），新墙可以朝任意方向。新墙沿用原墙的高度、厚度和墙体类型，它自己的两端也可以用同样的方法继续拖出更多墙。Ctrl+Z 可撤销。
- 2.661.0：Sketcher 中的 **🧱 Wall types**（墙体类型）面板（按钮位于工具栏中）。
  - 它列出模型中的墙体类型——初始包括 Brick veneer（砖贴面）、Double brick（双层砖）、Timber frame (weatherboard / fibre cement)（木框架，护墙板 / 纤维水泥板）、Rendered block（抹灰砌块）、Interior stud（内墙龙骨）、Interior steel stud（内墙轻钢龙骨）和 Wet-area stud（湿区龙骨）——并显示每种类型的厚度以及使用它的墙的数量。
  - 选中一种类型，即可看到按比例绘制的剖面，以及**从外到内的各层**：砖、空气层 / 空腔、防水透气膜 / 防潮层、木框架或钢框架（勾选 *batts* 可在龙骨之间填充保温棉）、保温板、石膏板（gyprock）、抹灰、护墙板、纤维水泥板、砌块、混凝土、石材、瓷砖……可以修改每一层的种类或厚度（mm），用 ↑ ↓ 调整顺序，用 ✕ 删除，用 *＋ Add a layer* 添加一层。**Wall thickness**（墙厚）为各层厚度之和。
  - **Use it for**（应用于）：选中的墙、选中房间的所有墙、所有外墙、所有内墙（✕ None = 恢复为房间自身的墙厚）。顶部的 ＋ / ⧉ / ✕ 用于新建、复制和删除类型。
  - 墙体按其类型的厚度、以中心线为基准向两侧构建，修改类型时会随之更新；最外层（砖、抹灰、外挂板……）决定墙外侧面的颜色，各层之间的接缝会显示在墙顶和 📐 floorplan 上。墙自身的面板中也有 **Wall type**。
- 2.660.0：Sketcher 中的**从房间中删除单面墙**以及**内墙 / 外墙**。
  - 在墙上使用 **⌫ Eraser**（或选中墙后按 **Delete**，或在其面板中点击 **🗑 Take this wall out**）只会删除这一面墙——地板和天花板保留，该侧变为敞开。墙上的门 / 窗会一并删除。两个房间共用的墙会从两个房间中同时删除，于是两个房间相互连通（地板相接）。**Shift+Eraser** 仍会擦除整个房间。
  - 房间的面板：**↺ Put back** 可恢复其墙体（↶ 也可以）。
  - 墙的面板：**Interior / exterior**——*Auto*（两侧都有房间 = 内墙，否则为外墙）、*Interior* 或 *Exterior*；面板标题会显示当前属于哪一种。内墙的外侧面采用其内侧颜色（若单独设置了 *Outside* 颜色，则仍以该颜色为准）；📐 floorplan 中内墙的填充色比外墙浅。
- 2.659.0：Sketcher 中的 **🛣 Driveway**（车道；位于 *Ground* 下，无快捷键）。
  - 沿路线依次点击各点——车道会平滑地穿过这些点——双击（或按 Enter）结束。
  - 曲线会显示其节点（□）和控制柄（○）：拖动**控制柄**可弯曲曲线（另一侧的控制柄随之转动；按住 **Alt** = 只调整这一侧），拖动**节点**可移动它，**Delete** 删除所点击的节点。点击另一条车道可编辑其曲线；可在输入框中输入宽度。
  - 车道贴合在 ⛰ 地面上（高出地面 4 cm）或位于某一标高，默认宽 3 m，可选配**路缘石**。
  - 用 ➤ Select 选中车道可打开其面板：宽度、路面材质（混凝土、石材……或图片）、路缘石、贴合地面 / 位于其标高、〰 Smooth the curve（平滑曲线）、Delete。📐 floorplan 会绘制车道及其中心线。
- 2.658.0：**Sketcher、Timeline 和 Image editor 的 ⛶ 最大化**效果取决于面板所在的位置。
  - **停靠**（位于主列中）：⛶ 使其高度与主列相同；下方的面板保持各自的高度并被向下推（滚动主列即可看到），主列会滚动到该面板的顶部。🗗 / Esc 可恢复原状。
  - **浮动**（位于主列之外）：⛶ 填满标题栏和状态栏之间的整个窗口，并关闭其他面板；🗗 / Esc（Sketcher 中为 ⇲ Dock）将布局恢复原样。
  - **停靠状态的 Sketcher** 现在有自己的高度和底部拖动柄（拖动可调高 / 调矮），并像其他面板一样有 📌 图钉；高度会被记住。
- 2.657.0：Sketcher 中的 **🏊 Pool**（泳池）——位于 *Ground* 下、⛰ Terrain 旁边（无快捷键——所有字母都已被占用）。
  - 点击一个角，再点击对角（或输入 `8,4` 并按 Enter）——生成矩形泳池；**Shape: Free shape** = 依次点击各个角，最后回到第一个点（或双击 / Enter）。其面板包括：**Shallow end** / **Deep end**（浅水端 / 深水端；池底沿长度方向在两者之间倾斜）、**Edge**（池边）：池边砖（压顶）、木平台、池边砖 + 木平台或无，以及它们的宽度、水面边缘的标高（取泳池中心处的地面高度，或手动输入），以及 **Level the ground round it**（平整周围地面）。
  - 在 ⛰ 地面上时，泳池下方的地面会被挖除，周围的地面会被整平（生成一个名为 "Pool 1 surround" 的挖 / 填方平台）。
  - 用 ➤ Select 选中泳池可打开其面板：Length / Width、标高、深度、⇄ 互换深水端、池边及其材质（瓷砖、木材……或图片）、池壁内衬、池水及其颜色、水量（m³）；可拖动，也可 Delete。
  - 📐 floorplan 会绘制水面、池边，以及泳池的名称、尺寸和深度。
- 2.656.0：Sketcher 的 ⛰ Terrain 中的 **✂ Cut / fill**（挖方 / 填方）——在地面上挖出 / 填筑一个水平平台。
  - ⛰ Terrain ▸ **✂ Cut / fill**：在地面上依次点击平台的各个角，最后回到第一个点（或双击 / Enter）。平台内部的地面被整平到平台的 **level**（标高）——默认取平台范围内地面的平均高度（挖填平衡），也可以取消勾选 *Level = the ground's mean inside* 并手动输入。平台外部以 **batters**（边坡）按 **1 : n** 的坡度回接到原始地面（每升高 / 降低 1 米对应的水平距离米数）。**Earthworks**（土方方式）：挖方和填方、仅挖方或仅填方。
  - 状态栏和面板会显示**挖方**和**填方**量（m³），以及需要运出 / 运入的净土方量。
  - 点击平台可选中它：修改其标高、边坡或土方方式（会重新挖填）；雕刻地形之后可用 **⟳ Apply again** 重新应用；**🗑 Forget** / Delete 删除其轮廓（地面保持现有形状）。可在输入框中输入标高。
  - 📐 floorplan 会显示每个平台的虚线轮廓、名称、标高和挖 / 填方量。
- 2.655.0：**🩹 自动开始**——**Ctrl+click** 🩹 按钮：修复会被设置好并且直接开始（稍后会自动为你按下 ✏ Edit）；**Shift+click**（或 Ctrl+Shift+click）：同时为黑白照片**上色**的修复，以同样的方式开始。普通点击仍然只进行设置。如果没有可用的照片（References 面板为空且图像编辑器已关闭），则不会开始，并会提示你该怎么做。
- 2.654.0：**🩹 Restore / fix a photo**（修复照片）——提示词面板左栏中的一个按钮（位于 🎤 下方）。
  - 点击一次：Generate 模式切换为 **🖼 Image**，▾ 操作切换为 **✏ Edit**，并将修复指令放在提示词开头——去除划痕、灰尘、斑点、污渍、折痕和撕裂，减少噪点和颗粒，修正褪色的颜色和对比度，锐化模糊的细节，同时保持人物、面部、服装、姿势和构图不变。你在其后输入的文字会被追加进去（"her dress was dark green"）。再次点击不会重复添加。
  - **Shift+click**：效果相同，并为照片上色（适用于黑白照片）——自 2.655.0 起也会自动开始。
  - 照片来源：图像编辑器关闭时，将照片放入 **🖼 References** 面板（一张图片——多张图片会被一起使用）；编辑器打开时，使用**选中的图层**（或该图层上的选区）。按钮旁的提示会说明将使用哪一张。然后按 **✏ Edit**——结果会出现在图库中（在编辑器中：⏳ Pending）。
  - 编辑模型为提示词面板的图像风格——当编辑器显示在屏幕上时，会自动为你选择一个支持编辑的风格（Qwen Image Edit、FLUX.2 / FLUX 3 Klein）。


- 2.653.0：**Sketcher 中的 ⛰ Terrain**（地形）——建筑所在的地面，可带有山丘、斜坡和等高线。
  - **⛰ Terrain** 位于 Sketcher 工具中的 *Ground* 下（**Alt+G**——G 已用于 Group）。在没有地面的模型上第一次点击时会生成地面：40 m 见方或超出建筑 10 m，每 0.5 m 一个高度点，略低于最低楼层，材质为草地。
  - 面板用于选择按下鼠标时的操作：**⬆ Raise** / **⬇ Lower**（按住并拖动；按住 **Shift** 则反向）、**≈ Smooth**、**▬ Flatten**（向 Flatten 高度压平——**Alt+click** 地面可取该处的高度）。**Brush size** 和 **Strength**；**[ / ]** 缩小 / 放大笔刷，也可直接输入尺寸。每一笔为一个 ↶ 撤销步骤。
  - **〰 Contour**：设置 **Elevation**（高程），然后逐次点击……绘制一条等高线（按其高程绘制）；点击回到起点可闭合，或双击 / Enter 结束一条开放的线。开启 **Shape the ground after each line**（默认开启）时，地面会随每条绘制的线而变化：每条线上的点保持在其高程，点与点之间为平滑的斜坡；下一条线的高程会增加 **Next line +** 的值。点击已绘制的线可选中它——修改其高程、将其开放 / 闭合，**Delete** 删除它。**⛰ Shape to the contours** 可随时按等高线塑造地面；**Clear the lines** 清除线条但保留地形。提示：在 📐 floorplan 中，这些线会垂直向下投到平面上绘制。
  - **🖼 Heightmap picture…**：一张灰度图——黑色 = **Lowest**，白色 = **Highest**，图片顶部为北（+Y）边。
  - **⌂ Level under the rooms**：将每个房间下方的地面整平到略低于其地板，并在 **Level margin** 范围内平滑过渡回原地形。另有 **⊙ Centre on the building**、**Width / Length / Detail**（保持地形形状）、**Material**（颜色、材质或图片）、**Contour interval** 以及每隔 n 条加深一条的线、**Contour lines on the ground**、**Earth sides**、**▬ Flatten all**、**🗑 Remove the ground**。
  - 地面随模型一起保存，并随模型一起发送到 .glb / Blender / Unreal / 图像编辑器，也会出现在真实照片中；📐 floorplan 会在最低楼层上绘制其等高线（加深的线带有标注）。
- 2.652.0：**真实照片使用你的材质**——Sketcher 工具栏中的 **✨ Photo**（或在已关联 Sketcher 时使用提示词面板的 ✏ Edit）会向编辑模型发送干净的渲染图（其中包含你的背景图 / 天空）、其深度图以及一张**材质板**：模型使用的每张图片各占一个带标签的小块（"Kitchen floor, Bed wall 1 outside"、"outside walls"、"Background (backdrop)"）——这些文字告诉模型在对应位置准确使用这些材质，并保留背景。提示词框中的文字会被追加。只接受两张图片的编辑模型会收到不含材质板的版本（消息中会说明——Qwen Image Edit 2511 / FLUX.2 Klein 可接受三张）。照片会保存到项目的图片中（如果图像编辑器已打开，也会送到编辑器）。
- 2.651.0：**Sketcher 的材质工具**——建筑的每个部分都可以有自己的材质，图片可用作纹理，也可把一张图片用作背景。
  - **墙的内侧和外侧**：墙的面板有 **Inside** 和 **Outside**；窗有 **Frame** 和 **Glass**；地板、天花板、踢脚线、顶角线、屋顶、楼梯和无墙地板也各有自己的设置。每一项都会打开**材质选择器**：颜色、内置材质（砖、石材、木地板、瓷砖、大理石、地毯……）或**图片**。
  - **图片作为纹理**：可来自 🖼 Refs 面板中的图片、项目图片或文件。图片会保存在项目中，每隔 **Size** 米重复一次（用 **Turn °** 旋转）。同样的图片也可以用来给你绘制的面上色。
  - **油漆桶**（B；Materials 按钮会打开同一个选择器）现在只给**一面墙的一侧**上色——即你点击的内侧或外侧；**Shift+click** 给该侧的所有墙上色（一个房间的所有内侧 / 所有外侧）。玻璃单独上色。
  - **🖼 Background**（工具栏）：**Backdrop**——模型后方的一张图片，填满视图且不拉伸——或 **360° sky**——环绕场景的全景图片（可旋转）；None = 使用主题的背景。
- 2.650.0：**Sketcher 会高亮显示选中的对象和指针下的对象**——选中的对象（墙、房间、门、家具……，或用 Ctrl+click 选中的多个对象）以主题的强调色着色，指针下的对象以蓝色着色——已被选中的除外。📐 floorplan 上也一样：选中的符号以强调色填充，悬停的符号为蓝色。
- 2.649.0：**Sketcher 的 📐 floorplan 沿用应用的主题颜色**——背景使用主题的背景色（不再是白纸），墙、门、楼梯和标签以主题的文字颜色绘制，地板使用其面板颜色（并带一点各房间地板颜色的色调），玻璃和灯具使用强调色，网格使用其线条颜色。更换主题会重新绘制平面图。
- 2.648.0：**用 Shift + 右键拖动缩放、⊡ Zoom to selection 以及指针**——适用于 Sketcher、时间线画布和图像编辑器。**Sketcher 的 Esc 和 Ctrl+click。**
  - **Shift + 右键拖动**：向前（向上）放大，向后（向下）缩小，以按下的位置为中心。在 Sketcher 中，普通的右键拖动仍为平移；不拖动的右键点击仍会打开菜单。在 🎨 Artist mode 中，该拖动用于缩放，而 Shift+右键**点击**（不拖动）仍会退出该模式。
  - **⊡ Zoom to selection**（缩放到所选内容）：Sketcher（在 ⤢ 旁边——缩放到选中的内容：面、房间、墙、门、构件、摄像机……或多个对象）、时间线（在 ⤢ 旁边——选中的图层）和图像编辑器（工具栏中 🔍 下方、View ▸ Zoom to Selection、Ctrl+Alt+0——缩放到选区，若无选区则缩放到选中图层的像素）。
  - **指针**：Sketcher 的 Select 工具以及时间线和图像编辑器的 Move 工具都显示为指针箭头。
  - **Sketcher 中的 Esc**：在 🔄 Orbit 中，Esc 切换到 ➤ Select；其他情况下，它会放下当前工具并取消选择，然后切换到 Orbit。它不再将最大化的 Sketcher 停靠回去（请使用 ⇲ Dock / ⛶）。
  - **Sketcher 中的选择**：点击选中一个对象；**Ctrl+click** 添加更多——面和线，以及建筑构件（房间、墙、门、家具、灯具、摄像机……；Ctrl+click 已选中的构件可将其移出选择）。拖动其中一个，所有选中的对象会一起移动（一次撤销），Delete 将它们全部删除，⊡ 缩放到它们；点击其中一个则只保留该对象。
- 2.647.0：**Sketcher 的 📐 Floorplan 视图、Esc = Orbit、房间的 Width 和 Length。**
  - **📐 Plan**（工具栏，或 View ▾ 📐 Floorplan）：视图垂直向下俯视，如同图纸，每次显示一个楼层（楼层多于一层时可在列表中选择）。墙体被剖切并以实心绘制；门显示门扇和开启方式（单开、双开、推拉；洞口为虚线），窗显示玻璃和窗台，楼梯显示每一级踏步以及行走线和 UP，家具显示轮廓和名称，灯具显示为圆圈加十字，每个房间显示名称、Width × Length 和面积。建筑工具的用法与 3D 中相同——在平面图上绘制的房间、墙、门……都以这些符号表示——点击可选中门、灯具、构件、楼梯、墙或房间。Orbit 可旋转平面图（保持平面）。再次点击 📐、切换到其他视图或摄像机视图：3D 视图恢复原样。
  - **Esc**：按一次即放下当前工具和选中的内容，并切换到 **🔄 Orbit**——在 3D 视图、平面图和摄像机视图中均如此（正在绘制的墙会保留）。当没有可放下的内容时，它会将最大化的面板恢复原位。
  - 每个房间的 **Width 和 Length**：房间面板中有这两项（沿第一面墙的方向及与其垂直的方向）；矩形房间保持其角点不动，其他形状则被拉伸（门窗沿墙保持原位）。Room 工具也有 Width 和 Length：两者都设置后，点击一次即可放置该尺寸的房间；0 = 像以前一样通过两个角点绘制。
- 2.646.0：**🎨 Artist mode：Alt+P 调色板、Ctrl+P 提示词面板、Alt+G 图层 + Pending**——无需离开 Artist mode 即可基于正在绘制的图层进行生成。
  - **Alt+P**——在指针处打开调色板（以前是 Ctrl+P）。再按 Alt+P 关闭。
  - **Ctrl+P**——在全屏画布上方打开提示词面板，其提示词框可直接输入（与应用中其他地方的按键相同）。
  - **Alt+G**——在画布上方，右侧显示 Layers 面板，旁边显示 ⏳ Pending（画布保持原尺寸，其他面板仍然隐藏）。选中图层，按 Ctrl+P，写下提示词，点击 ▾ Edit（或 Generate）：图片会返回到 ⏳ Pending——可从那里将其保留为图层。再按 Alt+G 隐藏它们。
  - 离开 Artist mode 时，编辑器的面板栏会恢复原样（以前较窄的编辑器会丢失面板栏）。
- 2.645.0：**Ctrl+P 将提示词面板调到最前**——在任何地方（包括正在输入框中输入时）：它会打开、展开，从关闭的 ▣ 面板中出来，并显示在浮动窗口或最大化的面板（Sketcher、时间线……）之上，提示词框可直接输入。（2.646.0：在 🎨 Artist mode 中也适用——其调色板改为 Alt+P。）图像编辑器的 **File ▸ Print** 改为 **Ctrl+Shift+P**。


- 2.644.0：**各指南改称 Sketcher**——README、本指南、Feature Reference、测试版页面、帮助和快捷键列表不再介绍 House builder（Sketcher 已在 2.630.0 中取代它）；Sketcher 一节从它现在的功能讲起；新增一张 Sketcher 截图。
- 2.643.0：**Sketcher：透过摄像机观察时移动 / 旋转摄像机**——摄像机面板中的 ✥ Move / ⟳ Rotate 会在视图前方显示其操控器；Esc 取消选择。
- 2.642.0：**Credits**（致谢）——Settings ▸ **About** 显示版本号、"Produced and Developed by Tim Paul"、"Programmer - Claude Opus 5.5"，以及对 bitGen Studio 所用代码、模型、工具和创意的所有贡献者的致谢；同样的致谢也是本指南的最后一节（并出现在封面上）。
- 2.641.0：**Sketcher：摄像机像物体一样被选中、移动和旋转**——选中的摄像机周围不再有方框；它会显示 X / Y / Z 移动箭头（拖动摄像机或箭头），双击会切换为旋转环，点击其他对象则改为选中该对象。
- 2.640.0：**Sketcher：每个部分各自的属性，以及截面轮廓**——点击墙 / 地板 / 天花板 / 踢脚线 / 顶角线（在视图或大纲中）会显示其自己的面板（墙的长度、高度和内侧颜色）；踢脚线、顶角线、门框、窗框和窗台可从图片下拉列表中选择截面轮廓，✎ Profiles… 可绘制自定义轮廓。
- 2.639.2：**Sketcher：3D 视图不会再无提示地变黑**——模型中的错误数值（某个角点、灯具、构件）不再导致整个视图变黑：该构件会被略过，摄像机会被复位，视图底部会出现红色提示说明问题所在（渲染错误或图形上下文丢失时也会提示）。
- 2.639.1：**Sketcher 修复**——停靠在较窄的列中时，新的大纲会占用 3D 视图的宽度（导致视图显示为黑色）；现在在这种情况下大纲默认关闭，🗂 使其浮动在视图上方，并且视图宽度不会小于 160 px。
- 2.639.0：**Sketcher：🗂 Outline 面板**（大纲；房间 ▸ 墙、地板、天花板、踢脚线、顶角线、门、窗；👁 隐藏 / 显示；房间组）、踢脚线 + 顶角线、Alt+drag 自由拖动墙、Shift+click = 整个房间。
- 2.638.0：**📐 SolidCraft 最大化 = 整个窗口**——⛶ 填满 bitGen 窗口中标题栏和状态栏之间的区域，并关闭所有其他面板；🗗（或 Esc）将布局完全恢复原样（哪些面板是打开的、哪些是折叠的，以及它们的尺寸）。
- 2.637.0：**Shift+right-click 退出 🎨 Artist mode**——在屏幕任意位置均可，且不弹出右键菜单（在 Windows 上 Ctrl+Esc 会打开开始菜单；Ctrl+Esc 和 Ctrl+Shift+F 仍然有效）。
- 2.636.0：**Ctrl+Alt+S 打开设置；bitGen Default 主题**——Ctrl+Alt+Shift+T（或 Settings ▸ Themes 中的 ⟲ bitGen Default，或在地址中加上 `?theme=default`）恢复 bitGen 自己的外观——Dark、其强调色、无元素样式、UI 尺寸 100 %；↶ The theme before 可撤销此操作。内置的 bitGen Default 不能被覆盖或删除。
- 2.635.0：**Assets：Project | Global | All**——项目素材位于 `projects/<name>/Assets`，全局素材位于 `projects/Assets`，一个文件夹 = 一个分组；上传的文件进入 Assets；右键点击可选择 🌐 Move to Global / 📁 Move to Project。
- 2.634.0：**彩色的安装过程**——完成为绿色，正在安装为浅绿色，警告为橙色，错误为红色；长时间无输出的步骤会提示仍在运行（以及为何耗时较长），因此安装过程不会看起来像卡住了——适用于安装窗口和安装脚本。
- 2.633.0：**Sketcher：摄像机和家具的旋转环（偏航 / 俯仰 / 翻滚）、翻滚、镜头预设、焦距 / 视野**。
- 2.632.0：**Sketcher：可在房间内选中摄像机，并移动、旋转（R）；Esc / 双击取消全部选择；Orbit 光标**。
- 2.631.0：**Sketcher：摄像机视图、打开的门 / 窗、自动屋顶 + 地板**——View ▾ 列出所有摄像机（从摄像机看到的视图）；门 / 窗的 Open % + 开启方向；Room 工具的 Auto roof / Auto floor。
- 2.630.0：**House builder 已移除**——其剩余部分已并入 Sketcher（🧍 人物、☰ File ▸ 🏠 将其保存的房屋作为 Sketcher 模型）；SolidCraft 改为发送到 Sketcher。
- 2.629.0：**Sketcher：材质、摄像机、360° 场景位置、Furnish**——House builder 的带纹理材质、📷 摄像机（透过摄像机观察，镜头画面 + 深度图 + 法线贴图，360° Location）、🪄 Furnish（为房间布置家具）；家具可导出。
- 2.628.0：**Sketcher：🛋 Furniture**——在 Sketcher 中放置 House builder 的家具库和项目中的 3D 模型；⛶ 最大化时关闭所有其他面板（⇲ Dock 会重新打开它们）。
- 2.627.0：**Sketcher 的真实照片**——干净的渲染图 + 其深度图会发送给编辑模型，提示词以 "Turn this 3D render into a photorealistic photograph of a building ..." 开头（以前返回的是着色草图）。
- 2.626.0：**PushPull 改为 Sketcher**——配合提示词面板：🖼 Image + 一个编辑模型，"create a real photo of the model in view"，Generate = 在 Image 素材中生成一张真实照片；→ Image editor / → Timeline 发送一个 📏 Sketcher 图层。
- 2.625.0：**Sketcher：编辑面、边和角点**——面的 Extrude（+ / - 为切除）和 Twist，像 Blender 一样拖动，Ctrl+drag 扭转；移动边、Length、Extrude edge、Fillet、Shift+click 多选、Ctrl+click 选择面的边环；移动角点；通过控制点调整门窗的大小 / 位置，窗的 Elevation；⛶ 保留状态栏。
- 2.624.0：**Sketcher：地板上的墙、倾斜的墙**——bitGen 的主题颜色；Offset from floor edge；拖动单面墙，地板的吸附区域，吸附到其边缘；双击墙顶 = 一个可上下拖动的切口、顶边的坡度、Delete；Ceiling Flat / Follows the walls' slope；随墙倾斜的屋顶，带 Eaves width；双击空白处 = Orbit；标题栏中的 ⛶ / ⇲ Dock 和 ✕。
- 2.623.0：**Edit theme 模式：每个按钮及其文字**——双击任意文字即可修改，包括下拉选项、占位符和工具提示、浮动工具面板；Alt+click 可在不离开该模式的情况下使用应用。
- 2.622.0：**自动找到 ComfyUI**——设置中尚未指定的已安装 ComfyUI 会被自动找到，其检查点（checkpoint）和扩散模型会出现在 Model manager 和 Basic Settings 的模型列表中（视频 Model 列表之前一直为空——读取列表的方式有误；已修复）。Settings ▸ ComfyUI ▸ Folder 提供 Use this folder。
- 2.621.0：**SFX 面板中的 🗣 Speech & dialog**——输入、粘贴或由 LLM 撰写的文本，由 OmniVoice 或 Ming-3.0 TTS 带情感朗读，可使用同一个声音，也可每位说话人各用一个声音，保存为 .wav / .mp3 存入 Audio 素材，文件元数据中包含日期、时间、描述和文本。
- 2.620.0：**📏 Sketcher 的建造功能**——带墙、地板和天花板的房间，可相互吸附，拖动时可共用一面墙；门窗可穿过任意墙；屋顶（双坡、四坡、单坡、平屋顶）、楼梯、楼板，以及灯具（筒灯、吸顶灯、吊灯、枝形吊灯、射灯、壁灯、落地灯和台灯），带 🌙 夜景视图；面板可最大化到整个窗口，有自己的 ☰ File 菜单和 🖼 / 🎞 按钮。
- 2.619.0：**📏 Sketcher**——用于快速 3D 建模的新面板：绘制形状，推 / 拉成实体（凹槽、通孔、由偏移生成墙），输入精确尺寸，吸附到角点 / 边 / 面 / 坐标轴，编组，上色，撤销；模型保存在项目中；可发送到图像编辑器、时间线、Blender 和 Unreal，或导出为 .glb / .obj / .stl。
- 2.618.0：**删除或隐藏桥接图层会关闭其桥接**——在图像编辑器中：隐藏或删除 🟧 Blender 图层会关闭场景工具（不会生成新图层）以及场景本身（包括时间线上它的 🟧 预览）；🧊 3D (Daz / Blender) 图层会结束其场景的 Blender，并丢弃正在等待 Daz 实时链接的内容；Unreal / MetaHuman 图层会停止 📺 Unreal View，清除其画面并将其隐藏。在时间线中：图层被隐藏（👁）或被删除的 Unreal 片段会关闭其 📺 窗口。重新显示（或撤销）后，图层仍保留其画面——选中它即可再次打开其场景 / 视图。
- 2.617.0：**从 zip 导入文字效果**——Presets ▾ ＋ Import PSD text effects or a zip… 可导入文字效果的 zip（其中每个 PSD 都会成为一个预设，其中的字体会添加到工作室中），或一次导入多个 PSD。
- 2.616.0：**一个文件完成安装**——单独运行 `install_all.bat`（Windows）、`install_all.sh`（Linux）或 `install_all.command`（macOS），即可在缺少时安装 Git 和 Node.js（Windows 还会安装 Python），将仓库克隆到它旁边并启动工作室（首次启动时会安装其余部分）。之后随时再次运行它即可打开工作室。
- 2.615.0：**Basic Settings 跟随风格**——每个风格都会在 misc/basic_settings.tmp 中记住自己的 Basic Settings。在任何地方（提示词面板、Basic Settings 的风格卡片、某个板……）更换风格时，会先为你正在离开的风格保存所有 Basic Settings 字段和风格名称，然后恢复你上次为新风格所做的设置。应用启动时使用上次会话的风格及其设置。
- 2.614.0：**选择 ▼ 范围，✂ Cut 剪切它们；播放时按 Ctrl 始终有效**——点击一个 ▼ 选中其范围（Ctrl / Shift + click：多选），✂ Cut 剪切选中的范围（未选中时：全部剪切）。现在，在预览播放期间，即使焦点位于 ▶、速度列表或已勾选的复选框上，或者预览面板的播放器正在播放时间线片段，按 Ctrl 也同样有效。
- 2.613.0：**播放时用 Ctrl 标记 ▼ 范围、✂ Cut all / ⏩ Speed up、悬停时间、播放速度**——预览播放时按一下 Ctrl 标记范围的起点，再按一下标记终点（数量不限，每个范围有自己的颜色，位于高亮的图层上）；拖动 ▼ 可移动它（预览会显示该帧），右键点击可删除它。✂ Cut all 剪切所有范围；⏩ Speed up 以 2× - 10× 的速度播放这些范围（快进一段渲染）。指针下的时间显示在一个小框中；预览可以 0.125× - 8× 的速度播放。


- 2.612.0：**剪切后的片段仍为一个片段 / ✂ to new layer**——对帧执行 ✂ Cut 和 Del 后，剪切点前后的部分会重新合并为一个连续的片段（视频或声音：生成一个新的 "-join" 文件；图片：只是变短），一次 ↶ 即可撤销。新的 "✂ to new layer" 复选框会将剪切点（或 Ctrl+K 分割点）之后的部分放到正上方的新图层上。预览会提前一秒加载下一个片段——剪切点处不再出现黑帧。
- 2.611.0：**▯ Frame——点击一帧，按 Del 删除它**——时间线上 ▸ ⇤ ⇹ ⇆ ↔ 旁边的 ▯ 工具（或在图层上按 F）：在图层上点击会选中该图层上指针下的那一帧，拖动可选中多帧，Shift+click 选中到此处为止，← / → 前进 / 后退一帧。Del / ⌫ 将它们从该图层中剪掉并合拢空隙；↶ 可恢复。
- 2.610.0：**时间线上的 🧬 Morph**——Properties 旁边的 🧬 Morph 选项卡（时间线的图层面板）：填写 Character 1（起始形象，例如 "a monkey"）和 Character 2（最终变成的形象，例如 "a man"），选择 Layer 1（起始片段——取其最后一帧）和 Layer 2（结束片段——取其第一帧），以及时长（1 - 10 s）。提示词会自动为你写好（可以修改——↺ 会重新生成）。🧬 Make the morph 使用工具栏中选择的视频风格，从这两帧（按画布上显示的样子）进行渲染，将结果放到两个图层之间的新 🧬 Morph 图层上，从图层 1 的片段结束处开始，并将图层 2 的片段移到变形结束处开始。除非勾选 "keep its sound"，否则变形片段的声音为关闭状态。↶ 可全部撤销。两个角色的构图相近时效果最好。
- 2.609.0：**将任意浮动面板停靠到图像编辑器的面板栏中**——按住浮动面板的标题，将其拖到 Layers 所在的栏上：橙色线条会显示其放置位置（该栏中每个面板的上方 / 下方，或末尾）；松开 = 停靠到该处。适用于用 ⇱ 浮动的主面板（Assets、Gallery、References、Queue、Preview……）、▣ 面板、Basic Settings、LLM tokens、Camera 面板、提示词面板和 ⏳ Pending。停靠后，每个面板都有一个细栏：⠿ 可将其拖到栏中的其他位置或拖出栏（重新浮动），▾ 折叠，⇱ 浮动，⚙（▣ 面板）打开其菜单；拖动底边可调整大小。每个面板的停靠位置、顺序、高度和折叠状态都会被保留，并在下次启动时恢复；停靠在编辑器中的面板会随编辑器一起隐藏和显示。
- 2.608.0：**字体列表以字体本身显示每种字体**——每个字体下拉列表都以该字体显示其名称（仍可像以前一样输入搜索），收起的列表也以所选字体本身的字形显示其名称。
- 2.608.0：**用文字填充形状**——图像编辑器：右键点击形状图层（或 Shape 工具的选项栏，或 Layer ▸ 🅰 Fill Shape with Text…），然后选择方式：**Flow inside**（文字图层的行在轮廓内换行；Fit = 能放下的最大字号）、**Stretch to fill**（字母弯曲并拉伸以填满轮廓——心形、圆形、星形）或 **Repeat as fill**（形状的填充变为成排、带角度的文字——仍为形状）。Flow / Stretch 可使用文字预设，并保持为可输入的文字。时间线：形状图层的 ◆ Shape ▸ 🅰 Text fill（成排），以及文字图层的 🔤 In a shape（Stretch to fill / 在形状图层内 Flow inside；⌖ Place on it）。
- 2.608.0：**新增 5 个变形预设**——Shell Lower、Shell Upper、Fisheye、Twist 和 Wedge，位于 Arc … Squeeze 旁边：见 ⌒ Shape / 3D…、Edit ▸ Transform ▸ Warp 以及时间线的 📌 Warp ▸ ⌇ Preset。
- 2.608.0：**文字和形状上的变形网格**——⌗ Warp Grid（Type 和 Shape 工具的选项栏、右键菜单、Edit ▸ Transform ▸ Warp）：拖动网格点或网格内的任意位置，选择预设，Grid 3 x 3 / 4 x 4 / 5 x 5，拆分线——按 Enter 应用。图层仍为文字（可继续输入——变形随之更新）或形状（可更改颜色——仍保持变形）；Layer ▸ Remove Warp Grid 可将其移除。时间线：📌 Warp ▸ ⌇ Preset 会转换为可用 📌（Shift+W）拖动的网格。
- 2.607.0：**文字预设在形状和 3D 中保持有效**——带预设的文字（Gold、Chrome、PSD 文字效果……）在你对其进行变形、绕圆或沿路径排列、改为竖排或 3D（图像编辑器 ▸ ⌒ Shape / 3D…）时都会保留预设；3D 侧面采用预设的颜色并加深（或使用你设置的侧面颜色）。在时间线上，预设文字现在也可使用 ✨ Text Animators 和 〰 On a path，3D 文字（🧊 ▸ 3D text）也有自己的 Preset ▾——预设的外观用于正面，侧面使用其颜色。
- 2.607.0：**新文字以你的预设开始**——在时间线上，未选中任何内容时，Properties 会显示 New text ▸ Preset；T 工具创建的下一段文字将使用该预设（在任意文字上选择预设也会设置它）。
- 2.607.0：**电脑上的所有字体**——每个字体列表（图像编辑器的 Type 工具、Properties、Character 面板；时间线文字、3D 文字、字幕；卡拉 OK 样式）都将常用字体放在顶部的 "Common" 下，并在 "This computer (N)" 下列出这台电脑上安装的所有字体。
- 2.606.0：**点击文字即选中它并切换到 Move 工具**——手持 Type 工具时也是如此（以前会打开文字进行输入）。**双击**文字可进行编辑——光标会位于你双击的位置。手持绘图工具或 Type 工具时在 Layers 面板中选中图层，也会切换到 Move 工具。旋转 / 斜切控制柄：使用 Move 工具选项栏中新增的 ⤡ Scale / ↻ Rotate / skew 按钮，或双击某个控制柄（现在双击文字内部会编辑文字）。
- 2.605.0：**悬停时显示 Move 工具的细框**——在图像编辑器和时间线的预览画布中，指针下的对象（文字、形状、图片图层……）会显示与 Move 工具相同的细虚线框，而不是粗轮廓——使用 Move 工具时如此，使用绘图工具时也如此（以及在文字上方使用 Type 工具时）。使用绘图工具**点击**对象会选中它并切换到 Move 工具；**拖动**仍会绘制新对象。在文字框内的任意位置（包括字母之间）点击都能选中文字。
- 2.605.0：**修复：第二个形状丢失**——在已选中另一个形状时绘制形状没有任何反应（出错）；现在会绘制一个新形状（选中一个形状时，Ops 按钮仍可用于合并形状）。
- 2.604.0：**Image editor ▸ 💾 Save to Images**——在 💾 旁边选择格式（PNG、JPEG、WebP、JPEG XL、AVIF、GIF、TIFF、BMP、TGA）。保存时会先为所有可见内容保留一份临时副本，然后将其合并（JPEG / BMP 以白色为底——而非黑色），并以该格式保存到项目的 Images（Assets）以及 Gallery 中（Gallery 不支持的格式——WebP、JPEG XL……——会在其中显示为同一图片的 PNG）。你的图层保持不变。
- 2.604.0：**修复斜切**——使用 Move 工具时，双击显示旋转控制柄，然后拖动侧边控制柄：该侧倾斜，而对侧保持不动（以前会朝反方向摆动）。按住 Alt 则以中心为基准倾斜。文字也可以斜切，并保持为可编辑的文字。
- 2.604.0：**右键点击 ▸ Rasterize Text**——适用于图像编辑器中的文字图层以及时间线预览画布上的文字：文字会变成图片（撤销可恢复）。


- 2.604.0：**选中的对象周围不再有粗框**——图像编辑器只显示细的控制柄边框；时间线画布显示细虚线边框和小控制柄。
- 2.603.0：**时间线：在单个图层上选取范围**——把红色位置标记拖到范围起点，然后在某个图层上范围结束的位置
  Shift+点击（点在片段上或片段之间均可；Shift+拖动时终点跟随指针）。范围会画在该图层所在的行上，该图层也会高亮显示。此时
  **✂ Cut**（剪切）只会从这一个图层上删除整段范围——其他图层不受影响（开启波纹编辑时，该图层上的空隙会自动合拢）。在标尺上拖动仍然是普通的选取。
- 2.603.0：**时间线撤销**——使用时间线菜单栏中的 ↶ / ↷，或在指针位于图层上方时按 Ctrl+Z / Ctrl+Shift+Z（或 Ctrl+Y）。每次编辑都是一步（一次拖动算一步）；选取操作不算。
- 2.603.0：**重启遗留运行的 ComfyUI**——如果应用启动时本机上已有一个 ComfyUI 在运行（之前遗留的，或手动启动的），应用会先结束它，再由自己重新启动，这样它的控制台、⟳ Restart 和内存都归应用管理。对应设置为 Settings ▸ ComfyUI ▸
  "Restart a ComfyUI left running when the app starts"（默认开启）。
- 2.602.0：**图像编辑器 ▸ Type 工具**——正在输入的文字周围的虚线框现在会紧贴文字，并随每次按键而变大（居中文字向两侧扩展）。使用 Type 工具时，指针在文字上方显示为文本 I 形光标，在其他位置显示为新建文字光标（虚线框中的 I 形光标）。点击一段文字时，会直接在点击处——离点击位置最近的两个字母之间——开始编辑，而不是全选；在正在输入的文字内点击会把插入符移到该处。供 Move 工具的控制柄、
  Align（对齐）和点击使用的文字框，现在与字母一样宽（之前测量得偏小）。
- 2.601.1：**已修复：Ming-3.0 TTS 报错 "\"mul_cuda\" not implemented for 'BComplex32'"**——Ming 的整个模型以
  bfloat16 运行，而把输出转换为声音的最后一步要进行复数运算，PyTorch 无法在 bfloat16 下完成。bitGen 现在以全精度（float32）执行这一步，其余部分仍保持原来的速度。无需重新安装任何东西。
- 2.601.0：**⟳ Reinstall，且每个安装按钮都会显示正在做什么**——已安装的附加组件、软件包或模型会显示
  **⟳ Reinstall**（重新安装；已下载的模型显示 **⟳ Download again**），按下后会真正重新获取全部内容，而不是跳过"已存在"的部分。安装或下载一开始，按钮即被禁用，旁边的状态文字会说明当前进展——所处步骤、百分比、已用秒数——最后显示
  **✓ installed** 或 **✗ 原因**。运行期间 Settings 窗口保持打开。适用范围包括：Settings ▸ Add-ons、faster-whisper、
  OmniVoice、sd-cli、Comfy Kitchen、Sage / Spectrum / 各节点包、模型目录、Civitai 下载、LoRA
  训练器、Viggle（原生）、软件包升级、从文件夹安装扩展，以及各面板中的 demucs（Stems）、AI
  抠像、SAM 2、Select ▸ Subject 和 Segment Anything。
- 2.601.0：**Settings ▸ Audio ▸ 声音克隆：▶ Play**（原为 "Play selection"）——有选区时播放选区，没有选区时播放整个片段；播放期间按钮变为 ■ Stop，波形上有一条白线跟随播放位置。在波形上单击（不拖动）会清除选区。
- 2.601.0：**已修复：Ming-3.0 TTS 报错 "TorchCodec is required for load_with_torchcodec"**——新版 torchaudio 把音频读取交给了一个单独的软件包（TorchCodec），而它还需要 FFmpeg 的库。bitGen 现在自己读写 Ming-3.0 TTS（以及 OmniVoice）所用的语音片段，因此无需重新安装任何东西。
- 2.600.1：**已修复："transcription failed: open() got an unexpected keyword argument 'metadata_errors'"**——该错误出现在生成声音克隆的转写文本（或任何 faster-whisper 转写）时。新版 PyAV（faster-whisper 使用的视频 / 音频读取库）删除了
  faster-whisper 仍在传递的一个选项。bitGen 现在自己读取音频，并直接把声音数据交给 faster-whisper，因此无论安装的是哪个版本的
  PyAV 都能正常工作——无需重新安装。新安装 faster-whisper 时，也会保留一个仍带有该选项的 PyAV 版本。
- 2.600.0：**Basic Settings ▸ Format 中的 📱 Social media**（社交媒体）——无需使用时间线的 Export 即可快速使用。
  Format 下拉列表中有一个 **📱 Social media** 分组：**Reels / Stories 9:16**、**Facebook feed 4:5**、**Square 1:1**、
  **Landscape 16:9** 和 **the render's own shape**（渲染本身的形状）。
  - 选择其中一项会把 **Aspect** 设为对应比例，让模型按该形状渲染（信息流的 4:5 会先以 3:4 渲染，再裁成
    4:5）。Format 下方的那行文字会说明将会发生什么。
  - 渲染完成后、进入图库和素材之前，MP4 会按照与 **📤 Export ▸ MP4 · Social media** 相同的设置转换为适合各平台的格式：
    H.264、48 kHz 立体声 AAC 音频（没有音轨时添加静音轨）、恒定帧率、faststart、短边最大 1080。任务日志会显示
    "ready for Facebook / Instagram / TikTok"，或指出哪里有问题。如果无法转换，则保留普通 MP4，并在日志中说明原因。
  - 适用于 MiniMax H3、Wan 和 LTX 渲染以及音乐视频。
- 2.599.0：**↺ Reset project 会显示锁定屏幕。** 确认之后，整个窗口会被一层遮罩覆盖，显示
  **"Resetting Project..."**——一个旋转的圆环、跳动的圆点、当前步骤（停止任务、删除并重新创建文件夹、重新打开）以及已用秒数。遮罩后面的任何内容都无法点击或输入。遮罩在页面重新加载期间一直保留，直到空项目打开（**✓ Project reset**）后才消失。如果重置被拒绝，遮罩会消失并显示原因。
- 2.598.0：**种子有了 🎲 Random / 📌 Fixed 切换**——位于 Basic Settings（视频和图像）以及每个风格编辑器（图像、视频、音乐）中。
  - **🎲 Random**（随机）：每次渲染都使用新的种子（数字框变灰）。**📌 Fixed**（固定）：每次渲染都使用旁边的数字——
    相同设置下得到相同的画面。输入一个数字，或点击 ♻（上次使用的种子），即切换为 Fixed；切回 Random 时会保留该数字供下次使用。
  - **在风格中**：Fixed 表示该风格始终使用自己的种子渲染。渲染使用哪个种子：优先使用 Basic Settings 的 Fixed 种子；开启 **Override style**（覆盖风格）时，Basic Settings 的 Random 保持随机；否则使用风格的 Fixed 种子；再否则使用随机种子。之前保存的风格为 Random（与以前一样，不使用其旧种子）。
  - 开启 Override style 时，会发送图像设置中的种子。
- 2.598.0：**🧩 Model manager 能找到正在运行的 ComfyUI 所拥有的模型和 LoRA**，即使它们不在
  Settings ▸ ComfyUI 中设置的 ComfyUI 文件夹里（ComfyUI Desktop 应用会把它们放在自己的文件夹中，或在 ComfyUI 的命令行中指定了 yaml）。它会向 ComfyUI 查询其模型文件夹及下拉列表中的名称；对于 ComfyUI 列出但本机无法打开其文件的模型，仍会显示一张卡片（其大小一栏会注明）。启动 ComfyUI 后，在管理器中按 ↻。
- 2.597.0：时间线 **📤 Export** 中的 **MP4 · Social media**——用于 Facebook、Instagram 和 TikTok。可以将其作为一种格式选择，或选择 **＋ a pack… ▸ social media** 一次导出四种：**9:16**（Reels / Stories，模糊填充）、**4:5**（Facebook
  信息流）、**1:1** 和 **16:9**，短边均为 1080。
  - 它完全按照各平台的要求生成：H.264（High，8 位）、48 kHz 立体声 AAC 音频、恒定帧率（高于 60 fps 的影片输出为
    30 fps）、索引位于文件开头（faststart）、无时间码轨、短边最大 1080，并设有码率上限，使文件大小保持合理。没有声音的影片会加上一条静音轨（有些上传程序会拒绝没有音轨的视频）。
  - 生成后会检查文件，日志显示 "ready for Facebook / Instagram / TikTok"——或指出哪一项有问题。时长超过 90 秒的 9:16
    视频会附带提示：它可能会作为普通视频而不是 Reel 发布。
  - 为什么其他文件会被拒绝：AVI（旧式视频编码，音频未压缩）不适合社交媒体；10 位、H.265 和 AV1 的 MP4
    用于剪辑和较新的播放器；而当时间线设有起始时间码时，普通的 MP4 · H.264 导出会添加时间码轨。凡是要上传的内容，请使用
    MP4 · Social media。


- 2.596.0：**Settings ▸ LLM** 中的 **⟳ Update llama.cpp**。按钮下方的那行文字会显示你当前的 llama.cpp 版本，以及是否有更新的版本（"llama.cpp b10456 · the newest is b10601 - ⟳ Update available"）。
  - **⟳ Update llama.cpp** 会停止 LLM 服务器和视觉模型，然后把最新版本覆盖安装到上方设置的引擎文件夹中（Windows：安装你的驱动所支持的 CUDA 版本）。你的模型和设置保持不变。进度显示在旁边的小日志中，Settings 窗口保持打开。尚未安装引擎时，此处显示的是 **⬇ Install engine**。
  - LLM 标签页中的每个按钮在执行操作时都会显示正在做什么：**▶ Start server** 先显示 "Starting the
    server…"，然后显示 "Loading <the model>…" 直到模型就绪，最后显示 "✓ Model loaded"；**■ Stop**、**↻ Rescan**、
    **🔎 Scan folder** 以及 Settings 的 **Save** 会显示 "Stopping / Scanning / Saving…"，然后显示 ✓——或 ✗ 及原因。
- 2.595.0：**WeVisOne-VL**（腾讯出品，基于 Qwen3-VL）可用作视觉模型。**Settings ▸ Add-ons ▸ WeVisOne-VL** 中有一个下拉列表：**★ 4B Q4_K_M**（推荐）、4B Q6_K、4B Q8_0、2B Q8_0 和 2B Q4_K_M——每一项都带有对应的投影器（projector）。
  - 它会下载到**你的视觉模型文件夹**（在 Settings ▸ LLM 中设置的那个；未设置时为 LLM 文件夹下的
    vision 子文件夹），放在其单独的 WeVisOne-VL-4B 或 WeVisOne-VL-2B 文件夹中，以便与正确的投影器配对。
  - 然后在提示词面板的视觉下拉列表中选择它：提示词中 📎 附加的图片会被读取并描述给 LLM。它擅长识别图片中的文字、计数以及描述物体的位置。
  - 它需要较新的 llama.cpp（misc\get-llama.ps1）。它的分割和抠像功能不包含在 GGUF 文件中——
    在 bitGen 中它用于读取和描述图片。
- 2.594.0：**通过右键菜单 🧊 转换为 3D。** 在 **Gallery**、**Assets** 或
  **References** 中的图片上右键点击，或在**图像编辑器的画布**上右键点击（它会在菜单中添加 🧊 Convert Picture to 3D… / 🧊 Convert Layer to 3D…；
  Layers 面板和 Layer 菜单中也有 Convert Layer to 3D…）。
  - 选择引擎：**Hunyuan3D 2.1**（只生成形状，速度快）或 **TRELLIS.2**（形状 + 纹理，较慢）。两者都在
    ComfyUI 中运行，与 🧊 按钮相同。
  - 选择模型的去向：**Image editor**（作为 3D 图层——Blender 会把模型放进一个有灯光、摄像机已对准它的场景；可在 🧊 3D
    标签页中环绕查看、渲染并以它为基础生成——需要 Blender）、**SolidCraft docker**（作为新设计打开）或 **Just save it**（保存到项目的 models3d/ 文件夹）。
  - 任务在队列中运行；完成后，模型会在你指定的位置打开。来自 References 或编辑器的图片会先保存到项目的 images 中。
- 2.594.0：**Ming-3.0 TTS**——第二个语音引擎。在 **Settings ▸ Add-ons ▸ Ming-3.0 TTS** 中安装（包括其代码、独立的 Python 和 0.5B 模型，位于 ming-tts 文件夹中），然后在 **Settings ▸ Audio ▸ Speech engine** 中选择它。
  - 克隆声音需要其语音片段**以及**准确的转写文本；设计声音（一段描述）使用 Ming 的声音设计功能。聊天中的 🗣、Speech 面板和 Test voice 都使用所选的引擎。
  - 其作者在 Linux + CUDA 12.4 上进行测试。在 Windows 上它尚属新尝试：RTX 50 系列显卡会安装 CUDA 12.8 版本的
    PyTorch。没有文本规范化组件（pynini，Windows 上通常缺失）时，请把数字写成文字。
- 2.594.0：**Bark 3.0 语音转文字**（Underdog）。在 **Settings ▸ Add-ons ▸ Bark 3.0 speech-to-text** 中安装，然后在 **Settings ▸ Audio ▸ Speech-to-text engine** 中选择它。
  - 它**仅支持英语**，且**不提供逐词时间**，因此用于普通转写：🎤 Transcribe 按钮、声音克隆转写、手机遥控和 🎙 语音聊天。歌词、字幕、逐词时间和其他语言始终使用 faster-whisper（请保留安装以供这些功能使用）。
  - 长文件会在安静处切分成不超过 30 秒的片段，因此转写结果仍带有大致的时间。
  - 许可证为 CC-BY-4.0（其 NOTICE 文件保留在模型旁边）。
- 2.593.0：**Face fix 和 ControlNet 现在是附加组件。** 在 **Settings ▸ General ▸ Add-ons in the
  studio** 中开启它们（两者默认关闭）。
  - **关闭**：Basic Settings 会隐藏 Face fix / ControlNet 部分（ControlNet 还会隐藏其 Settings 标签页），Settings ▸
    Add-ons 会隐藏其卡片，任何渲染都不会使用它。
  - **开启**：它们重新显示，bitGen 会检查附加组件所需的一切，并自动把缺失的内容下载到正确的 ComfyUI 文件夹——立即执行，并且在附加组件开启期间每次启动时都会再次检查。Settings ▸
    Add-ons 中会显示进度。
  - **Face fix** 需要 ComfyUI-Impact-Pack 和 ComfyUI-Impact-Subpack 节点包，以及人脸检测器
    face_yolov8m.pt（models/ultralytics/bbox）。
  - **ControlNet** 需要 comfyui_controlnet_aux、其四个预处理器的模型（DWPose、PiDiNet、Lineart、Depth
    Anything V2——位于 custom_nodes/comfyui_controlnet_aux/ckpts），以及 SDXL ControlNet（适用于所有类型的 xinsir Union ProMax，外加 OpenPose、Scribble 和 Depth——位于 models/controlnet，约 10 GB）。它们用于 SDXL / Pony /
    Illustrious 第二模型。
  - **Settings ▸ Add-ons** 中的每张卡片都列出了所有下载链接（GitHub 节点包和 Hugging Face 文件，并注明每个文件应放入的文件夹），因此你也可以自己下载。
  - 添加节点包后，请重启一次 ComfyUI。
- 2.592.0：**🎭 一张图片中的两个角色，各用各自的 LoRA**（来自 Winnougan 的 Nougan Nodes——Settings ▸
  Add-ons ▸ **Nougan Nodes** 会将其安装到 ComfyUI；之后请重启 ComfyUI）。在图像编辑器的 ✨ AI 面板 ▸ 🔲 Zones
  ▸ **▦ Regional prompt**（区域提示词）中，每一行框都有一个 **🎭** 按钮：从 ComfyUI 的 loras 中选择该角色的 LoRA 及其强度。每个 LoRA 只在自己的框内起作用，因此两个人各自保持自己的面孔，而不会融合成一张脸；场景的描述词仍作用于整张图片，没有 🎭 的框与以前一样工作。
  - 每张图片最多使用两个不同的角色 LoRA（第三个会在开始渲染前被拒绝）。两个框可以使用同一个 LoRA。
  - 在 FLUX.2 / Krea 2 / Qwen Image 风格上效果最好，并使用为该模型训练的 LoRA。在 Qwen Image **Edit** 上，图片仍作为模型本身的输入：LoRA 限定在各自的框内，框中的描述词变为区域提示词。
- 2.592.0：**⏱ LTX 提示词中的定时行（Prompt Relay）**——在一次渲染中为 LTX 2.3 / 2.5 片段的每一段分别指定描述词。不带时间的行描述整个片段；以时间开头的行描述对应的那一段：

      a red fox in the snow, cinematic
      [0-2s] the fox sniffs the ground
      [2-4s] the fox looks up at the camera
      [4s] it runs off to the left

  - 每一行持续到下一行开始为止（第一行从 0 秒开始，最后一行持续到片段结束）。时间单位为秒：
    `[2s]`、`[2-4s]`、`[2.5 - 4 s]`、`[2 to 4]`。
  - 提示词面板中 LTX 模式旁边的 **⏱** 会添加下一行（每行 2 秒）。它在
    StoryBoard 的场景中以及时间线的 AI 片段中用法相同。
  - 需要 Settings ▸ Add-ons ▸ **Nougan Nodes**（Kijai 的 ComfyUI-PromptRelay 也可以）。没有它时，片段会把所有行作为一个提示词渲染，任务日志会注明这一点。定时在第一遍中设置；模板的第二遍（细节）保留整个片段的描述词。


- 2.591.3：**GitHub 上的测试重新通过。** Windows 上的 Git 可能会以 Linux 换行符存储 .bat 文件，而一项新测试按检出后的原样读取它们，因而失败。现在由一个 .gitattributes 文件让所有 .bat / .cmd
  在检出时都使用 Windows 换行符；在 git 检出目录中，测试改为检查这条规则，而不是检查文件字节。
- 2.591.2：**push-to-github.bat 回到了应用文件夹中**（位于 start.bat 旁边），并且**永远不会进入仓库**：GitHub 上不会有它的副本（它被忽略，也不包含在仓库 zip 中）。它随扁平 zip 一起提供。把仓库 zip 拖放到它上面时，不再会把它从文件夹中删除。2.591.0 / 2.591.1 留在 misc\ 中的副本，会在下次启动 bitGen 时自动移回上一级。
- 2.591.1：**misc\ 迁移后的 GitHub 测试。** 通过解压覆盖方式更新的仓库（或通过只添加文件的上传方式更新的仓库）仍保留着根目录下的旧副本，导致 GitHub 的测试在这些文件上中止。现在这些副本不再被视为错误，并且 **push-to-github.bat** 会在提交前删除它们，使 GitHub 获得新的目录结构。
- 2.591.0：**整洁的应用文件夹。** bitGen Studio 文件夹现在只显示 **start.bat**（外加 npm 需要放在 node_modules 旁边的
  package.json / package-lock.json，以及用于 GitHub 页面的 README.md / LICENSE）。原来放在它们旁边的其他所有内容——
  server.js、Python 工作进程、default.settings、quick_prompts.json、requirements.txt、安装脚本（get-comfy.ps1、get-llama.ps1、get-sd-cli.ps1、get-yue2.ps1、get-qwen3vl.ps1、get-electron.ps1、
  download-models.ps1）、clear-comfy.bat、reset-layout.bat 以及各种说明文件——现在都位于 **misc\** 中。
  - 启动方式不变：双击 **start.bat**。
  - 用 zip 覆盖旧文件夹进行更新时：文件夹中残留的旧副本会在 bitGen 第一次启动时自动清理（你自己的快速提示词会保留——它们会移入 misc\）。
  - push-to-github.bat：（2.591.2：回到应用文件夹中，位于 start.bat 旁边，且永远不进入仓库。）
  - bitGen 运行时创建的文件夹和文件（projects、styles、models、custom.settings、布局文件……）保持在原来的位置。
- 2.590.0：**🎨 Artist mode**（艺术家模式）是全屏画布（2.588.0 的 ⬚ 专注模式）的新名称：在图像编辑器菜单（File … Help）之后有一个带文字的 **🎨 Artist mode** 按钮，也可使用 View ▸ Artist Mode 或 Ctrl+Shift+F。此时只显示画布；Ctrl+P 打开颜色（2.646.0：Alt+P），Ctrl+B 打开画笔，Ctrl+Esc 返回。编辑器较窄时，其菜单栏现在会换到第二行，因此不会再有按钮被截断。
- 2.590.0：**图像编辑器的每个标签页都是一个面板。** 按住名称拖动一个标签页（Layers、Color、✨ AI、🎮 Unreal、🖌 Brush……）：
  - **拖到另一个面板上**（拖到其标签栏或内容区，无论它在面板列中还是浮动）——它会成为该面板的一个**标签页**（该面板会以橙色高亮）；
  - **拖到面板列中某个面板的上边缘或下边缘**（或最后一个面板的下方）——它会在该处成为一个独立的面板（一条橙色线标示位置）；
  - **拖到编辑器中的其他任意位置**——它会**浮动**：按住其标签栏的空白处拖动它，拖动其角落调整大小，
    ⇲ 把它放回面板列，✕ 隐藏它。
  - 面板标签栏开头的 **⠿** 可用同样的方式拖动**整个**面板（拖到另一个面板上 = 其所有标签页都并入该面板）。
  - 单击标签页仍然只是打开它。每个标签页的位置都会被记住。**Window ▸ Show All Dockers** 显示所有隐藏的面板，**Window ▸ Reset Docker Tabs** 把每个标签页放回初始位置。
- 2.590.0：**📺 Unreal View**——实时显示所选 Unreal / MetaHuman 图层的摄像机在 Unreal 中看到的画面（每秒几帧）：
  - **图像编辑器**：选中一个 Unreal / MetaHuman 图层时会打开一个浮动面板（☑ show it when an Unreal
    layer is selected），并在 🎥 摄像机工具、🎮 Unreal 标签页、镜头和灯光改变摄像机时跟随该图层的摄像机。选中其他图层时它会停止。它和其他标签页一样——把它拖到某个面板上即可固定在那里。
  - **时间线**：选中一个 Unreal 片段时，预览行上方会打开一个窗口（UNREAL ▸ View ▸ 📺 Unreal View
    显示 / 隐藏它）：显示**播放头**处的片段——处于关键帧之间的 Unreal 摄像机、处于其姿势中的 MetaHuman、处于该帧的 Level
    Sequence（Sequencer 会在该处打开它）。
  - 它的工具栏：● live · 每秒帧数、尺寸（S / M / L——越小越快）、⏸，以及 **⚡ Keep Unreal fast**。
  - **必须让 Unreal 保持打开吗？** Unreal Editor 必须在**运行**中并打开你的项目（bitGen Bridge
    位于其中）——但它不必位于前台或显示在屏幕上：可以最小化它，或让它待在 bitGen 后面。默认情况下，
    Unreal 不是最前面的窗口时会降到每秒几帧；**⚡ Keep Unreal fast** 会关闭这一行为（Editor Preferences ▸ General ▸ Performance ▸ Use Less CPU when in Background），使静帧、渲染和实时视图都保持快速。
  - 需要 **bitGen Bridge plugin 1.5.0**——🎮 Load UE project 会更新它（1.4.0 插件显示视图较慢，且不支持序列片段）。
- 2.589.0：**Team 渲染农场现在是一个可选附加组件**（不再属于 bitGen 本体）。它以单独的 zip 提供，即 **bitgen-ext-teamdock-v<version>.zip**——安装包、仓库和扁平 zip 中都不包含它。**⚠ 它可能会触发病毒检查程序**：它会生成签名密钥、在网络端口上监听团队中的其他电脑，并每 15 秒写入一次团队文件夹，
  Malwarebytes 曾将其标记为勒索软件。请只在互相为对方渲染的电脑上安装它：
  - **Settings ▸ Add-ons ▸ Team render farm ▸ 📦 Install from a zip…**（选择该 zip），或把 zip 放到应用文件夹或 Downloads（下载）文件夹中，然后按 **Install**。**重启 bitGen**——Settings ▸ Team 和状态栏中的 🖥 Render on 就会出现。
  - **Remove** 会再次将其移除（需重启）。本机的团队身份和密钥保留在应用的 team/ 文件夹中——删除该文件夹即可忘记该团队。如果你的杀毒软件阻止了它，请允许 bitGen 的文件夹，或移除该附加组件。
  - 没有它时，所有任务都在本机渲染；已经指向团队 NAS 文件夹的项目文件夹仍可继续使用。
- 2.588.0：**图像编辑器中的 ⚡ 实时生成**（Krita 的实时模式）——编辑器菜单栏中的 ⚡（位于 ⛶ 旁边）或
  View ▸ ⚡ Live Generation 会打开 **⚡ Live** 面板。开始绘画：每一次更改（一笔、一次撤销、显示 / 隐藏或添加图层、修改提示词、修改设置）都会在片刻之后重新渲染——以实时强度对整张图片进行 Refine。
  - **一次只渲染一个**；渲染期间做出的更改会在下一次渲染（最新的更改优先——有更新的更改到来时，正在等待的实时渲染会被丢弃）。模型在两次实时渲染之间保持加载（不清理显存），实时渲染会排到队列最前面；它们永远不会显示在队列面板、图库或素材中。
  - 面板内容：结果（按住 = 在画布上以全尺寸显示）、**风格**（速度快的风格才有实时感：turbo / lightning /
    LCM / FLUX schnell / Z-Image Turbo，4-8 步）、**强度**（30-50 % 能保留你的绘画）、**步数**（0 = 使用风格自身的步数）、**尺寸**（MP——越小越快）、**🔒 种子**（相同的种子 = 结果只在你绘画的地方变化；
    🎲 换一个新种子）、**▣ on canvas**（把结果按混合比例叠加在图片上）、⏸ 暂停、↻ 立即渲染、
    **✔ Apply as layer**（作为图层应用，一个撤销步骤）、✕ 关闭实时模式。
  - 提示词取自 ✨ AI 面板的输入框；该框为空时取自主提示词框。
- 2.588.0：**图像编辑器中的 ⬚ 专注模式**（2.590.0：改名为 🎨 Artist mode）——菜单栏中的 ⬚（或 View ▸ Focus Mode、Ctrl+Shift+F）：只显示画布，全屏且无边框——bitGen 的各种栏以及编辑器的菜单、工具、面板、标尺和停靠面板全部隐藏。绘画、[ ]、缩放、按住 Space 平移和撤销都照常可用。
  - **Alt+P**（2.646.0 之前为 Ctrl+P）——在指针处打开调色板：饱和度 / 亮度方块和色相条（拖动调整）、前景色 / 背景色（⇄ 交换）、十六进制值、调色板的色块以及你最近用过的颜色——左键点击 =
    前景色，右键点击 = 背景色。再按一次 Alt+P、按 Esc 或在外部点击即可关闭。
  - **Alt+G**（2.646.0）——在画布上方显示 Layers 面板 + ⏳ Pending；**Ctrl+P**（2.646.0）——提示词面板。
  - **Ctrl+B**——在指针处打开画笔：所有画笔预设（点击 = 用它绘画）+ 大小、不透明度和流量。
  - **Ctrl+Esc**——返回正常模式（Ctrl+Shift+F 也可以——有些 Windows 键盘把 Ctrl+Esc 留给"开始"菜单）。浏览器自身的 Esc 只会退出浏览器的全屏；画布会保持无边框，直到按 Ctrl+Esc。
  - **Shift+右键点击**（2.637.0）——同样返回正常模式，在屏幕任意位置均可（Windows 把 Ctrl+Esc 用于"开始"菜单）；不会打开右键菜单。


- 2.588.0：**🎓 面板 ▸ 🧬 RefMods**——LoRA 与微调训练器面板的顶部可以在 🎓 Training 和
  🧬 RefMods 之间切换：MiniMax H3 参考模组（无需训练），保存在应用的 **refmod/<name>/** 文件夹中，因此**所有项目**
  都能使用它们。
  - **＋ New RefMod**，然后选择其**类型**：🧑 Character reference · 🏞 Location · 🚗 Vehicle · 📦 Object · 🪄 Prop · 🌿 Flora ·
    🐾 Animal，并填写一段简短描述。
  - **＋ Media…**（或直接拖入文件）：图片放入 images/，视频放入 videos/，声音放入 audio/——每一项都有自己的说明文字框（与图片一同上传的 picture.txt 即为该图片的说明文字）和 ✕。
  - **✨ Autocaption**——由视觉模型填写空白的说明文字（✨ all = 全部重新生成）；视频的说明文字取自其中一帧；声音保留你输入的说明文字。
  - **🧬 Extract RefMod**——通过 ComfyUI 运行的一个队列任务（使用 ComfyUI-MiniMaxH3Mod 节点包）：先处理图片，再处理均匀分布在各视频中的帧（共 16 帧）-> <mod>.safetensors，保存在该 RefMod 的文件夹中（每当渲染需要时会复制回 ComfyUI 的
    models/refmods）。声音保留在数据集中——RefMod 节点只接受图片。
  - **＠ Use in the prompt** 会在提示词框中插入 **@name**：MiniMax H3 渲染（References / First-last frame）会在采样器之前加载该模组；@ 会从模型读取的描述词中去掉。
- 2.588.0：**Settings ▸ Add-ons ▸ SolarRenderer**——把一段**结构**视频（灰色方块、语义图、骨架、深度、法线、人体网格、草图），加上可选的首帧和一段六部分的提示词，在 4
  步内渲染成成片（Enderfga 在 MiniMax H3 上的控制 LoRA + 四步 LoRA；长片段使用一对因果 LoRA）。该附加组件会把
  SolarRenderer 节点包放入 ComfyUI 的 custom_nodes，并下载你勾选的 LoRA；它在 MiniMax H3 的 ref2va
  模型、文本编码器和 VAE 上渲染（Settings ▸ Setup）。然后 **Settings ▸ ComfyUI ▸ Graphs ▸ ☀ SolarRenderer** 会通过
  ⤒ Import & check 导入该节点包的工作流（统计输入数量、指出缺失文件、进行测试运行，成功后保存）。这些权重采用 MiniMax H3 Community License——欧盟、英国、韩国和美国属于排除地区。
- 2.587.0：**Settings ▸ ComfyUI ▸ Graphs ▸ ⤒ Import & check**——导入任意 ComfyUI 工作流（保存的工作流或
  API 导出文件），bitGen 会检查它、绘制它、测试运行它，并在它能正常工作时保存下来：
  - **它接受的输入**——🖼 图片 · 🎞 视频 · 🔊 声音（即它的 Load Image / Load Video / Load Audio 节点）；参考图面板会按顺序填充这些输入，面板中没有对应内容的加载器在该次渲染中会被绕过。
  - **输出**——Preview 节点会被改为 Save 节点（预览不会写入文件），不保存的视频合成节点会被开启；什么都不保存的工作流会被拒绝。
  - **缺失的节点**（ComfyUI 中没有——请安装该节点包、重启 ComfyUI 后重新导入）和**缺失的模型文件**（加载器指定的文件不在 ComfyUI 的列表中）都会被报告。读取保存的（UI）工作流需要 ComfyUI 正在运行。
  - **它获得的控件**，已经连接好：Prompt（为空 = 使用提示词框）、Negative（为空 = 使用负面提示词）、
    Seed（bitGen 的种子）、Steps、CFG、Width / Height、Length——选中该图时显示在 Basic Settings 中。
  - **图会绘制**在下方：每个节点和连线、输入、输出，缺失的节点和模型文件以颜色标出；鼠标滚轮缩放，拖动平移，⤢ Fit 显示全部。在该标签页中加载的工作流（↻ Load、📁 File、选中的图）也会以同样方式显示其输入和图。
  - **▶ Test run** 会通过 ComfyUI 将其排队运行一次，并在每个输入中放入测试图片 / 声音 / 视频。**运行成功** = 它会被保存到 comfy_workflows/ 并保存为一个图（在该标签页中选中——Generate ▸ ⚙ Graph 即可运行它；测试图片在图库中）。**运行失败** = 列出 ComfyUI 的错误，不保存任何内容。需要真实人脸或特定图片的工作流可能会在测试图案上失败——这时请用 📁 File 手动添加。
- 2.587.0：每个面板名称旁边的 **Settings ▸ Dockers ▸ 👁** 可将其**关闭**：该面板及其状态栏按钮都会被隐藏（因此不会被误打开）——🚫 表示它已关闭，点击一下即可同时恢复两者。浮动窗口同样适用。
- 2.587.0：**Settings ▸ Dockers ▸ 🗂 Layouts**——布局是整个面板排布（每个面板的位置、大小、显示 / 隐藏 / 关闭状态、面板配置、浮动窗口、工作区）+ 主题：**💾 Save layout**
  （保存为安装文件夹中的 layouts/<name>.json）、**↺ Apply**（页面重新加载并应用该布局）、**⤓ Export**、**⤒ Import**、✕。
  **★ Save as the default** 会写入 layouts/default.json 和 themes/default.json——把这两个文件都复制到仓库中：全新安装会以该布局启动，从未选择过主题的浏览器会使用该主题。（主题在 Settings ▸ Themes 中保留各自的
  💾 Save / ⤓ Export / ⤒ Import——themes/<name>.json。）
- 2.581.0 修复：📐 SolidCraft 面板中的 **📁 Designs ▸ open 和 📂 Open from the computer** 之前什么都打不开（SolidCraft
  只在启动时读取其文件存储）——现在设计或零件会像直接拖放到它上面一样载入。
- 2.574.0：**所有生成都显示"第 n 步 / 共 total 步"**——通过 ComfyUI 生成的图片现在会实时报告其采样步数（之前只显示 "rendering… Ns"），sd-cli 生成的图片和视频也一样；并且所有显示正在运行的生成的地方都会显示步数：状态栏（step n/total）、队列、Console 中 Cancel 旁边、Song 标签页和 Music 面板（之前显示 "[object Object]"）、图像编辑器的结果图块和 ⏳ Pending 卡片、From the picture、3D /
  Unreal 真实图片、时间线的 ✨ 填充、🤖 AI take、摄像机深度和卡拉 OK 叠加层、StoryBoard（网格卡片、场景选择器、⏫ 放大、✎ First frame、故事板图片、环境 / 角色创建器、角色设定图镜次、
  RefMod 提取）、替换对话框（镜次和首帧）、VR world、风格诊断（style doctor）和 Sketcher。

StoryBoard（时间线下方包含各场景的面板）在所有地方都称为 StoryBoard——它的标题、状态栏按钮、Docker configs、各种消息——折叠后名称也保持不变（2.545.0）。

**对话框和消息框会在屏幕中央打开**。按住标题移动某个对话框后，下次它会在你上次放置的位置打开（按对话框名称保存在安装文件夹中的 **dialog_layout.cfg** 里）；如果窗口变小了，它会被拉回到屏幕内。删除该文件即可让所有对话框重新在中央打开。

**🧰 Tools & Properties 始终位于时间线面板内部**：在其预览画布行上方（因此轨道和菜单栏不会被遮挡；预览行隐藏时位于菜单栏下方）——无论是拖动、调整大小，还是面板本身改变大小，它都保持在面板范围内——绝不会超出（面板较小时它会随之变小，内容可滚动）——时间线面板折叠时它会隐藏。

在图像编辑器中，**Shift+Del** 删除所选图层。

## 在形状或蒙版中生成填充、图案库（2.437.0）
<!-- en: generate-fill-in-a-shape-or-a-mask-the-pattern-library-2-437-0 db816fafc86d -->

**✨ Generate Fill in Shape…**（在形状中生成填充；位于 Layer 菜单、图层的右键菜单，或 Properties 中的 ✨ fill in shape）：在所选图层的轮廓内生成内容——轮廓可以来自形状、文字、像素图层的内容、智能对象（或其矢量蒙版的路径）。输入要填充的内容（留空 = 使用提示词面板中的提示词）以及结果数量；✨ AI 面板开始生成，点击某个结果进行比较，**✔ Apply**（应用，Enter）会把它放到形状正上方的一个新图层上，并**剪贴**到该形状（↳）——形状仍是可编辑的实时形状，填充可以移动、添加蒙版或重新生成（第二次填充位于第一次之上）。**✨ Generate Fill in Mask…**（在蒙版中生成填充）在图层蒙版内执行同样的操作（白色 = 生成区域）：结果会获得该蒙版的一份副本。每种操作各占一个撤销步骤。

**图案库**——安装文件夹中的 patterns/<name>.png，所有项目共享（把 .png 文件复制进去即可共享）。**Edit ▸ Define Pattern…**（定义图案）按画面当前的样子，取选区的外框范围（或整个画面）创建一个图案。**Edit ▸ Pattern Library…**（图案库）显示所有图案：▦ = 新建 Pattern 填充图层，✕ = 删除，⤒ Import PNG…，＋ Define Pattern…。**Layer ▸ New Fill Layer ▸ Pattern…** 是一个实时填充图层（Properties 中可设置：图案、Scale %、偏移）；**Edit ▸ Fill… ▸ Contents: Pattern** 用图案填充选区；**Layer Style ▸ Pattern Overlay** 将它们以 user:<name> 的形式列在内置图案旁边。.bgi 文件会把其使用的图案保存在文件内部，并在打开它的电脑上把这些图案添加到图案库。

## 项目文件：.bgi、.bgv、.bgp（2.436.0）
<!-- en: project-files-bgi-bgv-bgp-2-436-0 49a9a31f5402 -->

bitGen 现在有了自己的文件格式——分别用于图片、视频剪辑和整个项目，每种都按原样完整保存，再次打开后即可继续工作。

**.bgi——图像编辑器的项目**（File ▸ **Save Project (.bgi)** Alt+Ctrl+S、**Save Project As (.bgi)…**、**Open Project (.bgi)…**、**Open Project from Project…**；使用 Open… / Ctrl+O 或把 .bgi 拖放到编辑器上也能打开）。所有内容都保持可编辑：图层和图层组、蒙版、文字 / 形状 / 填充 / 调整图层、图层样式、混合模式、锁定和标签、智能对象及其内容、智能滤镜和滤镜蒙版（包括液化）、路径、Alpha 通道、选区以及图层复合。撤销历史会从头开始。它是一个 zip 压缩包：doc.xml（以 XML 表示的文档）、preview.png（画面）以及每个图层 / 蒙版各一个 PNG——任何解压工具都能打开。文件保存在项目的 **bgi** 文件夹中（勾选 "also download it" 可另外下载一份副本）；Save Project 会直接再次保存到同一文件，不再询问，第一次保存时会要求输入名称。

**.bgv——视频项目**（时间线工具栏上的 🎞）。**💾 Save** 将当前打开的时间线——每个图层、片段、关键帧、效果、字幕、标记和设置——写为 XML，同时包含其嵌套片段所用的嵌套时间线，以及它所播放媒体的列表（并注明每个媒体当时是否存在）。保存在项目的 **bgv** 文件夹中（需要时另外下载一份）。**📂 Open a .bgv**（从电脑或项目的列表中选择）会先显示其中的内容——片段、图层、嵌套时间线、本项目没有的媒体——然后 **Open it** 将其作为本项目的一个命名时间线并切换过去。只有当项目中没有同名的嵌套时间线时才会添加（你自己的时间线永远不会被覆盖）。如果某个片段的文件在项目中缺失，该片段仍保留在时间线上，一旦把文件添加到素材中即可播放。

**.bgp——整个项目**（菜单栏中 💾 旁边的 📦）。XML 格式：项目的状态、时间线、聊天和设置均可直接阅读；媒体以 base64 存储。**Self-contained**（自包含）把所有内容（包括媒体）都放进文件里——一个文件即可把项目搬到另一台电脑。**Manifest only**（仅清单）保留项目文件，并列出媒体在本机上的位置——体积小，适合备份工作成果。对话框会显示每种方式的文件大小；bitGen 可以重新生成的缓存和预览默认不包含，除非勾选（回收站始终不包含）。**💾 Save…** 会询问保存位置（Save As 对话框）。**📂 Open a .bgp…** 将其作为一个新项目打开（绝不会覆盖现有项目；名称可以自行修改）——**📂 Open it now** 切换到该项目。清单中列出但本机上不存在的媒体会逐一列出名称。两种方式都采用流式处理，因此几 GB 的项目也没有问题。

## 保存的主题和 PDF 字体（2.435.0）
<!-- en: saved-themes-and-pdf-fonts-2-435-0 7a8e73547c0d -->

**Settings ▸ Themes ▸ Customize**：为主题的每个部分设置颜色（背景、面板、凸起面板、线条、文字、暗淡文字、OK 绿色、错误红色、悬停、画布、选中）——应用（以及图像编辑器）会立即改变；修改过的颜色会有标记；**↺ The theme's colours** 可撤销这些修改。

**保存的主题**：输入名称，点击 **💾 Save theme**——主题会写入安装文件夹中的 **themes\<name>.json**（包括颜色、强调色、UI 大小以及其基于的主题），并以卡片形式显示在下方。点击卡片即可加载，✕ 删除该文件。**⤓ Export** 将主题下载为 .json，**⤒ Import** 使用一个 .json 主题（之后用 💾 Save theme 保存它）。把 .json 文件复制到 themes 文件夹即可在多台电脑之间共享。

**PDF ▸ Save PDF… / Save as New PDF…**（图像编辑器的 Pages 栏，或 File 菜单）：保存对话框中有 **Embed fonts**（嵌入字体；默认开启，设置会被记住）：每一行文字都以其自身字体写为真正的文本，并嵌入 PDF，只包含用到的字符。字体文件来自本机字体（Windows、macOS、Linux 字体文件夹）或安装目录下的 **fonts** 文件夹（把 .ttf / .otf 放进去即可）。任何文字系统都保持为真正的文本。如果某个字体不在本机上，或缺少某个字符，则会像以前一样回退到 PDF 的标准字体（拉丁字母）或并入页面图像。关闭 = 仅使用标准字体。

## 主题和 UI 大小（2.432.0）
<!-- en: themes-and-the-ui-size-2-432-0 efcae0e6b7b2 -->

**Settings ▸ Themes**：

- **Theme**（主题）：Dark（bitGen 自有主题）、Darker（OLED 纯黑）、Slate（冷蓝灰）、
  Light、High contrast。整个应用都会随之改变——面板、对话框、图像编辑器（其 bitGen 主题由相同的颜色构建；编辑器中的 Window ▸ Theme
  仍可单独为编辑器选择 Pro / Studio / Classic）。
- **Accent colour**（强调色）：为按钮、点亮的标签页和滑块选择任意颜色，替代主题自带的颜色；Reset = 恢复主题的颜色。
- **UI size**（UI 大小）：一个滑块同时调整所有字体和所有面板，范围 60 % 到
  175 %（它从 General 移到了这里；左侧面板角落的滑块也是同一个）。

主题、强调色和大小保存在此浏览器中，并在页面绘制之前就已生效，因此浅色主题绝不会先闪现深色。

## PDF：指南和宣传册（2.392.0）
<!-- en: pdfs-the-guide-and-the-brochure-2-392-0 3de91c4d4405 -->

`docs/bitGen-Studio-Guide.pdf` 是本指南外加一页所有快捷键的总览。
`docs/bitGen-Studio-Brochure.pdf` 是 bitGen Studio 的 3 页宣传册。两者都使用工作室的深色主题。

## 时间线画布上的 3D 文字和 3D 模型
<!-- en: 3d-text-and-3d-models-on-the-timeline-canvas fa22b48a2287 -->

- **🧊**（位于画布工具栏中 **T** 的下方）可添加 **3D text**（3D 文字）或 **3D model**（3D 模型；
  .fbx 或 .obj——选择 OBJ 时请同时选中其 .mtl 和纹理），或项目中的某个模型。也可以把 .fbx / .obj 文件直接拖放到画布上。
- 可以像任何图层一样移动、缩放、旋转和淡入淡出；◆ 关键帧同样有效。它自己的设置：文字、字体、深度、倒角、颜色、金属度、粗糙度、光照、Rot X / Y /
  Z（可设关键帧）和 Spin（每秒旋转的度数），以及其画面尺寸和时长。
- 画布会实时显示它；执行 **⚙ Compile** 时，它会被自动烘焙为透明背景视频（如果仍有待完成的烘焙，Compile 会等待）。

## 生成进度
<!-- en: generate-progress d6c829345630 -->

**Generate** 按钮上方：当前任务的步数（将鼠标悬停其上可查看详情）。下方：进度条，仅在任务运行时显示。

## 项目、队列和图库
<!-- en: projects-queue-and-gallery c9e2c1e30e5d -->

- **主题出错时**（2.636.0）——**Ctrl+Alt+S** 可在任何地方打开 Settings（即使正在输入，即使
  ⚙ 已经不见了）；**Ctrl+Alt+Shift+T** 启用内置的 **bitGen Default** 主题（Dark、其自带的强调色和颜色、无元素样式、UI 大小 100 %），点击 Settings ▸ Themes 中的 ⟲ bitGen Default，或在工作室地址后加上
  `?theme=default` 打开，效果相同。原来的主题会被保留：Settings ▸ Themes ▸ ↶ The theme before。
- **Assets: 📁 Project | 🌐 Global | All**（2.635.0，Assets 面板标题栏中的下拉框）——项目素材位于
  `projects\<name>\Assets\`，全局素材（每个项目都能用）位于 `projects\Assets\`（与你的各个项目并列；它本身不是项目）。新上传的文件进入项目的 Assets 文件夹（当面板显示 Global 时则进入全局文件夹）。
  **Assets 文件夹中的子文件夹就是一个组**——可在文件资源管理器中或用 📁＋ 创建；➜ Send to 将文件移入该文件夹，＋ Add to 则同时在那里放置一个链接，⊖ 将其放回原处，删除组会把其中的文件移回（不会删除任何文件）。**右键点击图块**（或所选内容）：🌐 **Move to Global** / 📁 **Move to Project**、🗂 New group、🗑
  Delete。每个素材还会链接到项目的 `images\` / `video\` / `sound\` 文件夹（硬链接——不占用额外磁盘空间），因此所有按名称使用素材的地方都能照常工作；只存在于这些文件夹中的文件（旧项目、渲染结果）会显示为未分组的项目素材，旧的面板分组也已变成文件夹。
- **＋ New / 📂 / 💾**（窗口顶部的菜单栏）——项目。所有内容都位于
  `projects\<name>\`（`output\`、`video\`、`images\`、`sound\`、角色、场景）。
- **Queue**（队列）——GPU 上一次只运行一个任务；可暂停、中止（Abort 对话框）和重试；每个任务都保留日志。**🧹 Clear**（位于 Queue 的标题栏中，两个标签页都有）从列表中移除所有已结束的任务——包括已完成、失败和已取消的；按钮上的数字表示数量。排队中或正在运行的任务不受影响，也不会删除任何文件。
- **Gallery**（图库）——所有渲染结果；点击可预览，可拖到参考图、时间线或场景上。

## 素材分组和删除
<!-- en: grouping-and-deleting-assets dd2ea1d1564d -->

Assets 面板可以把项目的文件整理成**组**——只存在于面板中的文件夹。文件本身从不移动，因此使用它们的每个场景、时间线片段和参考图都能照常工作。

![Assets dock with a group](images/asset-groups.png)

- **选择**——勾选图块角落的复选框，Ctrl+点击（Mac 上为 ⌘），或 Shift+点击选择一个范围。选中内容后，普通点击即可添加或移除图块；Ctrl+A 选择整个标签页，Esc 清除选择。未选中任何内容时，点击仍会打开灯箱视图。
- **📁＋** 创建一个空组。**🗂 Group** 新建一个包含所选内容的组。
- **＋ Add to ▾** 把所选内容*同时*放入某个组——一个素材可以位于多个组中。
- **➜ Send to ▾** 则是*移动*：从选取时所在的组移出，移入新组。也可以把图块拖到某个组的标题上（放下时按住 Ctrl 则改为添加）。
- **⊖** 将所选内容从选取时所在的组中移出。
- 组标题上的 **⋯**：Rename、Select all、Delete group（其中的素材会保留）。点击标题可将其折叠。
- 一个组可以同时包含图片、视频和声音——每个标签页显示该组中对应类型的项目。
- **🗑**（或 Delete 键）把所选内容移到 `projects/<name>/recycle_bin`——绝不会彻底删除。当 *Settings → General → Confirm delete* 开启时，或项目仍在使用其中某个文件时，会先询问。

组按项目分别保存在 `projects/<name>/asset_groups.json` 中。

## 用 + 图块添加文件（2.394.0）
<!-- en: adding-files-with-the-tiles-2-394-0 135ae13f2352 -->

虚线框的 **+ add** 图块会打开下文介绍的文件对话框，无需拖放即可添加文件：

- **References → Video**：**+ add videos**，位于参考视频下方。
- **References → Sound**：**+ add sounds**，位于参考声音下方。
- **Assets → Image / Video / Sound**：**+ add pictures / videos / sounds**，位于列表顶部。

可以像在 Windows 11 中一样一次选择多个：**Ctrl+点击**添加或移除一个文件，**Shift+点击**选择一个范围，**Ctrl+A** 全选。点击
**Open** 即可添加。

所选的所有文件都会进入项目的 Assets。从 References 图块添加时，这些文件还会成为参考，最多达到模型的上限：三个视频和三个声音。放不下的文件仍留在 Assets 中，标签页上方的提示行会告诉你。图块会显示剩余的位置数，例如
**+ add videos (2 free)**，列表满时图块会消失。

也可以让图块获得焦点后按 **Enter**，或把文件拖放到图块上。

## 文件对话框
<!-- en: the-file-dialog 150f11e04ae6 -->

![The file dialog](images/file-dialog.png)

路径旁的每个 **📁** 和每个 *Choose file* 按钮都会打开 bitGen Studio
自己的 Open / Select Folder 对话框——在 Windows、macOS 和 Linux 上完全相同：

- **Navigation pane**（导航窗格）——Quick access（你真实的 Desktop、Downloads、
  Documents、Pictures、Videos、Music）、bitGen Studio（应用文件夹、当前项目、ComfyUI）以及显示每个驱动器可用空间的 This PC。
- **Address bar**（地址栏）——点击文件夹名称即可跳转到那里，或点击空白处输入路径。**← → ↑ ↻** 分别为后退、前进、向上和刷新。
- **Search**（搜索，右上角）——在当前文件夹及其所有子文件夹中查找名称；
  `*` 和 `?` 可用作通配符。
- **☰ Details / ▦ Large icons**——可排序的 Name / Date modified / Type / Size
  列，或图片和视频的缩略图。
- **＋ New folder** 和 **✎ Rename**（F2）；右键点击可使用 Open、Rename、Copy
  path、New folder 和 Refresh。
- **File name**（文件名）——输入名称、完整路径、文件夹名称（进入该文件夹）或
  `*.png` 这样的模式（进行筛选）；文件类型列表就在它旁边。
- **多个文件**（在支持多选的按钮处）：Ctrl+点击和 Shift+点击。
- 按键：Enter 打开，Backspace / Alt+↑ 向上一级，Alt+← / Alt+→ 后退 / 前进，
  F5 刷新，直接输入可跳转到对应名称，Esc 取消。

该对话框读取的是**本**机上的文件，因此它只替换应用窗口或同一台机器上浏览器中的文件选择器——手机遥控端仍使用手机自带的选择器。
**Settings → General → Use bitGen Studio's file
dialogs** 可将 *Choose file* 按钮切换回浏览器的选择器。

## 中文和日文版指南与帮助（2.703.0）
<!-- en: the-guide-and-help-in-chinese-and-japanese-2-703-0 71defce43e4e -->

指南（📖 **Help**（帮助）窗口，以及 **Ctrl+K** 能找到的指南条目）、❔ 帮助页面和快捷键列表现在也提供**简体中文**（面向中国大陆）、**繁體中文**（面向台湾和香港，2.704.0）和**日语**（日本語）版本。应用本身的按钮、菜单和面板仍为英文，因此译文中的界面名称保留英文——你读到的就是屏幕上显示的。

- **选择语言**：在 📖 Help 窗口顶部的下拉列表中，或在 ❔ 帮助页面的标题栏中选择（**English** / **简体中文** / **繁體中文** / **日本語**）。两处共用同一个设置，并会被记住。在你选择之前，它会跟随电脑的系统语言。
- **Ctrl+K** 会用所选语言搜索指南，同时仍能按英文名称找到对应部分。
- 英文为原文。如果某个部分在翻译之后英文版又有更新，译文顶部会提示这一点，并提供一个查看英文版的按钮。尚未翻译的部分会以英文显示，并附有说明。
- **各语言的指南 PDF**：docs/bitGen-Studio-Guide-zh-CN.pdf、docs/bitGen-Studio-Guide-zh-TW.pdf 和 docs/bitGen-Studio-Guide-ja.pdf。
- 译文文件与英文文件并列存放：docs/i18n/zh-CN/、docs/i18n/zh-TW/ 和 docs/i18n/ja/（USAGE.md、shortcuts.json），以及 static/help/zh-CN/、static/help/zh-TW/、static/help/ja/。繁体中文版由简体中文版转换而来（`python3 scripts/i18n-zhtw.py`，采用台湾用语），之后再经人工校读。运行 `node scripts/i18n-help.js status zh-CN` 可列出已过时的内容。

## 应用本身的中文和日文版（2.705.0）
<!-- en: the-app-itself-in-chinese-and-japanese-2-705-0 d6320f6eb1c4 -->

菜单栏上 ⊞（面板布局）左边的下拉列表可以切换应用本身的语言：**English** / **简体中文** / **繁體中文** / **日本語**。按钮、菜单、面板标题、标签页、设置、提示信息以及空输入框中的提示文字会立即切换——无需重启，切回英文后所有文字都会恢复原样。

- 它与 📖 帮助指南和 ❔ 帮助页面的语言是同一个设置：更改其中一个，另一个也会跟着改变。
- 本版本翻译了主窗口。图像编辑器、时间线、📏 草图建模和 CAD 面板仍为英文（将在后续版本中翻译）；应用运行时临时生成的文字（例如包含数字或文件名的状态信息）也仍为英文。
- 译文指南中提到的按钮名称与翻译后的应用界面一致；介绍各编辑器的章节仍使用这些编辑器目前显示的英文名称。
- 界面文字来自 static/i18n/ui/<语言>.json。运行 `node scripts/i18n-ui.js status zh-CN` 可查看已翻译的数量。

## 语言包（2.715.0）
<!-- en: language-packs-2-715-0 ec7b69eda5ac -->

除英文外，每种语言都是一个**语言包**：包含应用自身的文字、指南、❔ 帮助页面、快捷键列表和功能列表。简体中文、繁體中文和日本語为内置语言；无需新版本的应用即可添加更多语言。**Settings ▸ Languages** 列出所有语言包及各自的翻译进度。

- **⤒ Install a pack** 从语言包的 .zip 添加语言。会先进行检查；已有的语言在替换前会先询问（内置语言的语言包会替代内置版本，直到你移除该语言包）。
- 新语言会立即出现在 ⊞ 旁的下拉菜单中。语言包中未翻译的内容以英文显示。
- **✕ Remove** 移除已安装的语言包（内置语言会恢复）。
- **⤓ Master pack** 包含全部英文内容，并附 TRANSLATING.txt 说明如何填写每个文件 - 用于将 bitGen Studio 翻译成新语言。在 pack.json 中填入语言代码和名称，尽量翻译（ui.json 中应用的文字效果最明显），然后压缩为 .zip 并安装。
- **⤓ Export for translating** 会返回语言包，补入此后应用新增的部分并保留其译文 - 用于继续翻译，或改进内置语言。
- 已安装的语言包保存在安装目录的 langpacks 文件夹中。语言包中的帮助页面只保留简单的格式。
- **Shared by the community**（2.716.0）列出其他人翻译的语言包，来自 tigerart.com.au 上的 bitGen 社区——每个语言包在显示之前都经过管理员检查。点击 **⤓ Install** 即可一键安装。
- 在已安装的语言包上点击 **⇪ Share**，会以你的身份发送到社区（需先登录 💬 Community），并可附上给管理员的留言。管理员检查后即对所有人显示；**Your shared packs** 显示每个语言包的状态，✕ 可将其撤下。网站的语言包页面（tigerart.com.au/languages.php）列出相同的语言包，提供主语言包下载，也可以上传。

## 更快的首帧与加速修正（2.717.0）
<!-- en: faster-first-frames-and-the-speed-up-fixes-2-717-0 d7efaedbbd01 -->

一位测试者在一张 RTX 3090 上测量了 bitGen 的加速选项（同一张图、同一个 seed、两位盲评评审）。改动如下：

- **场景卡片上的 ✎ First frame**：样式列表以 **Auto** 开头。安装了 Qwen Image Edit 2511（完整包——20 GB 的模型）时，Auto 用它的 Lightning LoRA 以 4 步生成首帧，而不是 Qwen Image 2.1 的 25 步。需要三张以上图片（底图、角色、道具）的首帧仍交给 Qwen Image 2.1 edit，提示中会说明。在列表中选一个样式，就会一直使用它。
- **Qwen Image 2.1 edit Turbo8**：新的图像样式——借助社区的 Turbo8 LoRA，Qwen Image 2.1 只需 8 步（Settings ▸ Models ▸ Model catalog ▸ Qwen Image 2.1 Turbo8 LoRA）。细小密集的文字比 25 步时差；标题和标签没问题。
- **许可证**：Qwen Image 2.1 和 Turbo8 LoRA 采用 Qwen Research License——仅限非商业用途。Qwen Image Edit 2511 及其 Lightning LoRA 为 Apache 2.0——可以商用。这就是 Auto 优先使用 2511 的原因。
- **Veda** 会跳过提示词描述打斗、变形、爆炸或追逐的镜头：测试发现这类镜头只快 22%，画面还会变软。视频样式中的 **Veda on action shots too** 让每个镜头都使用 Veda。
- **Veda 与 Long video**：Veda 现在取代 Long video 的低显存注意力（一个 12 秒的长镜头快了 65%）。如果很长的镜头显存不足，请为它关闭 Veda。
- **Spectrum** 在 12 步以上的运行中，前 2 步和最后 3 步都真实计算——最后几步负责绘制脸部和细节，预测这些步骤会让它们变糊。
- Long video 仍不使用 Sage 注意力：在它之上加 Sage 只快了 17%。

## 找不到模型——渲染前先检查（2.719.0）
<!-- en: models-not-found-checked-before-a-render-2-719-0 44e1694bba66 -->

图片、视频或歌曲开始渲染之前，bitGen 会检查它要加载的每个模型文件是否在 ComfyUI 的某个模型路径中：工作流自带的模型、文本编码器、VAE 和放大模型，以及样式的模型、VAE、文本编码器和 LoRA（打开 Override style 时，还包括 Basic Settings 的模型和 LoRA）。

- 检查很快：它读取 bitGen 已找到的所有模型文件的列表，保存在 **misc/models_found.json**（ComfyUI 的 `models` 文件夹，以及它的 extra_model_paths.yaml 中的每个路径）。当某个名称不在列表中（你可能刚刚加入了这个文件）、ComfyUI 的文件夹改变，或你在 🧩 Models 中按下 ⟳ 时，列表会重新生成。同名文件在其他子文件夹中也算找到。
- 缺少文件时，会弹出 **Models not found** 对话框，逐个列出：文件名、它应放入的文件夹，以及它来自哪里（工作流、样式或 Basic Settings）。bitGen 模型目录中有的文件会显示大小和下载来源；**⬇ Download** 会下载这些文件（使用 Settings ▸ Models 中保存的 Hugging Face token），每个文件一个进度条，然后再检查一次——全部到位后渲染会自动开始。不在目录中的文件会注明这一点：请自行下载（Civitai、Hugging Face）到显示的文件夹中。
- **Cancel**（或 Esc、Enter）不会开始渲染。已经开始的下载会继续进行——在 Settings ▸ Models 中可以看到。队列中等待、缺少相同文件的渲染会直接停止，不再重复询问。
- 不论从哪里开始的渲染都会检查：提示词面板的 Generate、图像编辑器的 ✨ AI（Edit、Compose、Regenerate——包括从 References 面板的图片开始的）、StoryBoard、角色、时间线和音乐面板。取消后，开始渲染的地方会显示没有渲染。🩺 Style doctor 不会被拦下：它会在自己的表格中报告缺少的模型。
- 仍然中途停止的渲染（2.720.0）——它的 worker 以错误退出——也会被检查：ComfyUI 拒绝的模型名称，以及它的样式加载的文件。如果有文件不在模型路径中，会弹出对话框询问 **The render stopped: … Download it?**，同样提供 ⬇ Download / Cancel。下载完成后，在 Queue 面板中对该任务按 ↻ Retry（或再按一次 Generate）。这能发现渲染前的检查看不到的情况：自定义节点的模型、StoryBoard 自行渲染的场景、Swap、LTX 以及 Wan 自己挑选的文件。
- 不检查的情况：另一台电脑上的 ComfyUI（Remote GPU）、没有设置 ComfyUI 文件夹、sd-cli 样式，以及 Wan 或 LTX 样式自行挑选的文件。

## 仅在模型改变时释放显存（2.722.0）
<!-- en: free-vram-only-when-the-model-changes-2-722-0 d847cda123ca -->

**Settings ▸ ComfyUI ▸ Free VRAM before a generation** 现在多了 **Free it**：**when the model changes**（默认）或 **before every generation**（与以前相同）。

- 模型改变时：使用同一模型的一串渲染会把它留在显卡上——中间不卸载、不重新加载，连续的图片和片段开始得更快。下一次渲染加载其他模型文件时，会先释放显卡；控制台会说明是哪一种情况（“VRAM kept: the same model(s) …”或“the model changed”）。
- 显存不会越积越多：ComfyUI 对已加载的模型只保留一份并重复使用，渲染的工作内存在结束时释放，下一个流程需要空间时 ComfyUI 会自行释放。
- 发生显存不足的错误（或 ComfyUI 停止）之后，下一次渲染无论使用什么模型都会先释放显卡。
- Before every generation 是以前的做法：每次渲染都从空的显卡开始（在混合使用之后渲染长片段时最稳妥）。取消勾选开关则完全交给 ComfyUI 管理。

## 浮动面板：最后使用的在最上面（2.724.0）
<!-- en: floating-dockers-the-one-you-used-last-is-on-top-2-724-0 435239010efb -->

现在所有浮动面板在应用其余部分之上共用一个顺序：💬 Community、Basic Settings、LLM tokens、▣ 面板、用 **⊞ Docker configs ▸ ▣ New docker…** 创建的面板、用 ⇱ 浮动的主面板、时间线的舞台面板和语音聊天。

- **点击一个浮动面板**的任何地方（标题栏、按钮、里面的输入框），它就会到最上面。用键盘进入它也一样。
- **打开一个面板**时（状态栏上的 💬 Community、Basic Settings 的 S、▣ 面板的按钮）它也会到最上面。以前，用 ▣ New docker… 创建的面板总是遮住 💬 Community。
- 浮动面板位于已停靠的面板和状态栏之上，位于菜单、弹出菜单和消息框之下。
- 再次停靠的面板（旁边、里面或列中）会离开这个顺序，再次浮动时回到最上面。
- 提示词面板保留自己的规则：Ctrl+P 会把它提到遮住它的东西之上。

## 预览中的歌曲：可视化效果，Next 播放下一首（2.725.0）
<!-- en: a-song-in-the-preview-a-visualization-and-next-plays-the-next-song-2-725-0 6b82839293f0 -->

在 Gallery、Assets ▸ Sound 或 References 中点击一首歌或一个声音，它会在预览中打开，就是点击图片时显示图片的那个窗口。在 **Gallery 的 Audio 标签中按歌曲自带播放器的 ▶**，也会在那里打开并已经开始播放（2.725.1）。

- **▶ 会开始一个可视化效果**，随机选择：频谱条、镜像条、波形、圆环、穿越星空或涟漪。它随音乐变化，每首歌的效果都和上一首不同。
- 播放器旁边的 **🎲** 可以在播放时换一个效果。暂停时，画面静止并变暗。
- **Next ›、‹ Prev、画面上的箭头和 ← →** 会跳到**你点击它的那个面板里**的下一首或上一首**歌**并播放。中间的图片和视频会被跳过，最后一首之后从第一首重新开始。
- 在图片或视频上，它们和以前一样在列表中翻页，不会自动开始播放。底部的缩略条仍然可以打开任何项目。
- 关闭预览会停止歌曲。Preview 面板（状态栏上的按钮）不受影响。

## Neural blue 主题和 bitGen 大脑图片（2.726.0）
<!-- en: the-neural-blue-theme-and-the-bitgen-brain-picture-2-726-0 120e0f818af3 -->

- **Settings ▸ Themes ▸ Neural blue** 会把工作室变成午夜海军蓝配电光蓝强调色，也就是 bitGen 大脑图片的颜色。Dark（虎橙）仍是默认主题，你自己选的强调色也照样可以用在它上面。
- **启动时**，应用会随机显示两个启动画面之一：片头影片，或带制作人员名单的大脑图片（8 秒）。点击或按任意键都可以跳过。
- **新安装**会在第一个项目的 Assets ▸ Images 中放入这张大脑图片，这样图像编辑器、✨ AI 编辑和图生视频马上就有图片可以试。之后创建的项目是空的，你也可以像删除其他图片一样删除它。
- 网站（tigerart.com.au）每个页面底部的 **Colours** 中也有同样的 Neural blue 外观。

## 大脑活了起来；放大后却还是原视频的问题（2.727.0）
<!-- en: the-brain-comes-alive-upscales-that-came-back-as-the-source-2-727-0 5d0437f7fc70 -->

- **启动画面中的大脑图片现在是一段影片**：闪电击中 bitGen 大脑，一道闪光后出现巨大的 bitGen Studio 标题，共 15 秒，制作人员名单叠加在画面上。如果影片无法播放，仍会显示原来的图片。和以前一样，单击或按任意键即可跳过。网站首页也播放同一段影片。
- **已修复：放大可能会把你给它的视频原样交回。** 自 ComfyUI 2026 年 8 月的更新起，Load Video 节点会把它载入的文件显示在 ComfyUI 的结果中，并且排在真正的结果前面。bitGen 曾把它当作完成的视频，因此放大到 1080p 的 ⏫ SeedVR2 可能会以原视频的尺寸返回，文件名里却带着 *_seedvr2_1080p*。现在 bitGen 会跳过 ComfyUI 只是回显的文件。同样的修复也适用于 RTX Video、DLSS 5、LTX、Viggle 和工作流渲染。
- **SeedVR2 会检查拿到的尺寸。** 文件按它的真实尺寸命名。如果 ComfyUI 交回的是原视频的尺寸，任务会停止并说明原因，而不是写出一份副本。对于此修复之前做出的视频，请再运行一次放大，以得到真正的 1080p 版本。

## 正好 1920 × 1080，以及 RelayVSR（2.728.0）
<!-- en: 1920-1080-exactly-and-relayvsr-2-728-0 79626240c53c -->

- **1920 × 1080（正好 16:9）** 是 ⏫ SeedVR2、🔁 RelayVSR 和视频停靠栏 ⚙ **放大分辨率** 中的新尺寸。不完全是 16:9 的片段（例如 960x544 的 LTX 渲染）会被放大到完全覆盖 1920 × 1080 的画面，再把上下多出的几行裁掉。1080p 仍然保留整个画面（960x544 放大为 1906x1080）。DLSS 5、RTX VFX 和渲染中的放大器会把 1920 × 1080 当作 1080p。
- 预览栏中的 **🔁 RelayVSR** 用 RelayVSR 放大正在预览的视频，这是一种一步完成的快速视频放大器。它在 ComfyUI 自带的节点中运行，所以不需要另外安装任何东西。选好尺寸后按 **🔁 Upscale**；结果会带着原来的声音放进图库。
  - **Model**：RelayVSR 有两对文件。**x2**（LightX2V 出品，用 MiniMax H3 片段训练）适合 H3 或 LTX 渲染。**x4** 能把小片段放大到 4K。**auto** 会选择能达到所选尺寸的较小那一对。
  - **Detail**：1 保留模型加上的全部细节；数值越低越接近普通放大。
  - 视频停靠栏的 ⚙ **放大器** 中也有 **RelayVSR**：场景的 ⏫（以及 **每次渲染都放大**）会按 ⚙ **放大分辨率** 使用它。
- **准备**：RelayVSR 需要比 v0.44.0 版本更新的 ComfyUI（设置 ▸ ComfyUI ▸ ⤓ 更新 ComfyUI，选 "latest" 通道，然后重启 ComfyUI）。设置 ▸ 附加组件 ▸ **RelayVSR** 会下载这些文件（默认勾选 x2；每对约 5.3 GB）。缺少其中任何一项时，面板会提示。

## NitroFusion2：一步出图（2.729.0）
<!-- en: nitrofusion2-pictures-in-one-step-2-729-0 df99414524e6 -->

- **NitroFusion2** 是经过训练、能在一到两步内完成图片的 Z-Image-Turbo，文字清晰、细节精细。它在 ComfyUI 自带的节点中运行。有三个图像风格使用它：
  - **NitroFusion2**：一步。最快，建议先用这个。
  - **NitroFusion2 2-step**：两步，第一步加上作者的去蒸馏 LoRA，可以去掉一些伪影。请把步数保持为 2：这两步是把同一个调度一分为二。
  - **NitroFusion2 GGUF**：用 GGUF 文件一步出图，适合小显卡（默认 Q4_K_M；其他文件可选为该风格的模型）。
- cfg 保持为 1，没有负面提示词。它训练时的尺寸约为 1 百万像素（1024 x 1024）。
- 该风格的自定义 LoRA 和其他图像风格一样放进四个 LoRA 插槽；去蒸馏 LoRA 保持不变。
- **准备**：设置 ▸ 附加组件 ▸ **NitroFusion2** 会下载你勾选的文件：模型（12.3 GB）和去蒸馏 LoRA 默认勾选，GGUF 文件可选，Qwen3 4B 文本编码器和 FLUX.1 VAE 会随任何一项一起下载。勾选 GGUF 文件时也会安装 ComfyUI-GGUF。

## 🕺 从参考视频获取动作：FlowHMR（2.730.0）
<!-- en: motion-from-a-reference-video-flowhmr-2-730-0 fae293348a4b -->

> **仅限非商业用途。** FlowHMR 的代码是免费的（Apache-2.0），但没有 SMPL-H 人体模型以及 Meta 的 SAM 3D Body 和 VGGT-Omega 就无法运行，而这些的许可证不允许商业使用。用它捕捉的动作只供个人或研究使用。

- 预览栏中的 **🕺 动作** 会读取正在预览的视频，以 3D 方式捕捉其中人物的动作。结果是带动画的骨架（**.fbx**）和同一动作的 SMPL-H（**.npz**），以 *<视频名>_motion* 保存在项目的 **models3d** 文件夹中。时间线的 3D 图层、Blender、Daz 和 Unreal 都能使用 .fbx。
- **镜头**：**moving** 会推算镜头的移动，让人物在场景中的路径正确；**still** 用于固定在三脚架上的镜头，最省资源。**镜头估计间隔** 每 1 帧最准确，但约需 30 GB 显存；每 10 帧则轻得多。
- **准备**：设置 ▸ 附加组件 ▸ **FlowHMR 动作捕捉**。安装会把 FlowHMR 放进它自己的 Python 环境并下载模型，但有三样东西需要你先准备：
  - **SMPL-H 人体模型**：在 mano.is.tue.mpg.de 注册，下载 Extended SMPL+H model，把其中 neutral 的 *model.npz* 放到附加组件指明的位置；
  - **VGGT-Omega** 和 **SAM 3D Body**：在它们的 Hugging Face 页面申请访问，并在设置中填入你的 Hugging Face 令牌。链接都在附加组件的卡片上。准备好后再安装一次：它会告诉你还缺什么。
- 需要 NVIDIA 显卡和应用的 Python 3.10 - 3.12。没有 FBX SDK（只能在 Python 3.10 上安装）时只会得到 .npz。

## 🎼 五线谱上的乐谱，并保存为 PDF（2.731.0）
<!-- en: sheet-music-on-the-staff-saved-as-a-pdf-2-731-0 c1f81888c457 -->

- Music 面板的 **🎼 Sheet Music** 标签页把乐谱画成真正的五线谱：带谱号的五线、调号和拍号、带符干、符尾和符杠的音符、休止符、变音记号、延音线和连音线、旋律上方的和弦名称，以及歌曲的段落（Verse、Chorus …）用方框标出。YuE2 的乐谱有两行谱表——人声旋律和乐器声部，用括号连在一起。
- 乐谱从哪里来：**🎼 Write sheet from lyrics**、**📜 Transcribe audio**、**Score** 列表（项目中的每个 .abc，最新的在前；每首歌都会把乐谱保存在音频旁边，打开标签页时会画出最新的一份），或用 **📂 Open .abc** 打开这台电脑上的文件。**↻** 查找新的乐谱。
- **⛶ Read** 以全尺寸打开各页。**‹/› ABC text** 显示画出乐谱所依据的记谱，**⧉ Copy** 复制它。
- **💾 Save PDF** 把各页保存为 A4 的 PDF，以歌名命名，放在项目的 **pdf** 文件夹里（图像编辑器的 File ▸ Open PDF from Project 也会列出它）。勾选 **download too** 时还会同时下载。PDF 只使用每个 PDF 阅读器自带的字体，因此不嵌入任何内容；标题里这些字体没有的文字（中文、日文）会显示为 ?。
- 制谱引擎是 bitGen Studio 自己的一部分，不是外部库。除了 YuE2 自己的乐谱，它也能读普通的 ABC 曲谱：和弦、三连音、附点节奏、反复和反复结尾、调号和拍号的变化、低音谱号、中音谱号和次中音谱号。装饰音和歌词行不会画出。

## 🎨 乐谱下面的纸张（2.732.0）
<!-- en: the-paper-under-the-sheet-music-2-732-0 479328ee4cd2 -->

- Sheet Music 标签页里的 **🎨 Paper** 会打开一行选项，用来选择画乐谱的纸张。屏幕上的各页、**⛶ Read** 和保存的 PDF 都会使用它。
- **Paper colour**：任意颜色，或圆形色样之一（White、Cream、Antique、Stone、Pale blue、Kraft、Night）。
- **Material**：Plain，或像瓷砖一样铺满整页的质感：Parchment、Linen、Laid paper、Recycled、Watercolour、Canvas 或 Kraft。在 **Pictures** 下可以用项目中的任何图片，或 **📂 From this computer…**，同样平铺（保持其形状）。
- **Tile size**：一次重复在页面上的大小，40 到 600 pt（72 pt = 1 英寸）。**Texture**：材质在颜色上显现的强弱。
- **Ink**：音符、线条和文字的颜色。**Auto** 在浅色纸上用近黑色，在深色纸（Night）上用暖白色；Black、Sepia、Navy 和 White 是固定的。
- **in the PDF too**：取消勾选后，PDF 以白纸黑墨保存（更适合打印），屏幕上仍保留你的纸张。带质感的 PDF 只含一张小小的平铺图片，由 PDF 阅读器重复绘制，因此文件仍然很小。
- **↺ Plain white** 回到初始状态。你的选择会记在这台电脑上。

## ⏫ 图片的 Enhance：放大一张图片（2.733.0）
<!-- en: enhance-on-a-picture-upscale-an-image-2-733-0 3ec9caf4a12e -->

- 在图库的 **Images**、**Image** 素材或参考面板中点击一张图片，然后按提示词面板中的 **⏫ Enhance**。它的提示会说出要放大的图片。如果你最后点击的是视频，Enhance 仍然用 SeedVR2 放大视频。
- 面板会显示这张图片以及将生成的结果，例如 320×180 → 640×360：
  - **Size**：×2、×3、×4，或短边 1080、1440、2160 px（保持形状，每边最多 8192 px）。
  - **Way**：**SeedVR2** 会恢复细节（需要 ComfyUI、SeedVR2 模型和 VAE——与视频放大器相同的文件）；**Upscale model** 使用 ComfyUI 的 models/upscale_models 中的文件（4x-UltraSharp、RealESRGAN …），快速且锐利；**Lanczos** 完全不需要 ComfyUI，但不会增加新的细节。
  - **Model**、**Colour match** 和 **Denoise** 用于 SeedVR2（Model 也用来选择放大模型）。
- **⏫ Upscale** 把任务加入队列。结果是图库 Images 中名为 *<图片名>_upscaled_<宽>x<高>.png* 的 PNG。面板会按项目记住你的选择。

## ▶ 播放乐谱，发声的音符会亮起（2.733.0）
<!-- en: playing-the-sheet-music-the-notes-lit-as-they-sound-2-733-0 fe90ac659bab -->

- 在 **🎼 Sheet Music** 标签页的乐谱下方：**⏮** 回到开头，**⏪** 后退一小节（快速按两次到上一小节），**▶ / ⏸** 播放和暂停，**⏩** 前进一小节，**⏭** 到结尾。旁边显示时间和小节号，**⛶ Read** 中也有同样的按钮。
- 播放时，正在发声的音符会以橙色亮起，所在小节有一条淡淡的色带。勾选 **follow** 时，乐谱会滚动让该小节保持可见。点击任意音符即可跳到那里。
- **Sound**：**🎵 the song** 播放这份乐谱所属的歌曲（.abc 旁边同名的音频文件——在 Music 面板中制作的歌曲都有，Score 列表会给这些乐谱标上 🎵）。**🎹 the notes** 在浏览器中演奏写出的音符，用于没有歌曲的乐谱（🎼 Write、📂 Open .abc）或检查写了什么。
- **Sync (s)**：小节 1 之前歌曲的秒数，例如前奏。调整到亮起的音符与歌声对齐为止。每份乐谱都会记住。
- 速度来自乐谱的速度标记（Q:）；没有速度的乐谱按每分钟 120 拍播放。

## 🗣 乐谱下方的歌词（2.734.0）
<!-- en: the-words-under-the-sheet-music-2-734-0 cf22ed45b252 -->

- 在 Sheet Music 标签页勾选 **words**，Song 标签页歌词框里的歌词（正在制作的歌曲）就会放在人声谱表的音符下方，每个音符一个音节，一个单词的音节之间带连字符。
- 歌词按段落对应：歌词的 **[verse]**、**[chorus]** … 标签依次对应乐谱的 Verse、Chorus …，再次出现的副歌会再唱一遍同样的歌词。没有段落的歌词或乐谱从第一个音符开始依次放置。
- 与前一个音符用延音线相连的音符，或连音线内的音符，会延续前一个音节。自动分割不对的地方可以自己输入连字符（se-ven、Hal-le-lu-jah）。中文和日文歌词每个音符一个字。
- 状态行会显示有多少个演唱音符配上了歌词，以及剩余多少音节。编辑歌词后片刻会重新绘制；取消勾选即可去掉。歌词也会出现在 ⛶ Read 和保存的 PDF 中（PDF 的字体没有中文、日文字符，这些会显示为 ?）。

## 🗣 唱到的歌词会亮起（2.735.0）
<!-- en: the-words-lit-as-they-are-sung-2-735-0 b45c42a5881f -->

- 勾选 **words** 后，在 Sheet Music 标签页按 ▶：正在唱的音节会在人声谱表下方亮成橙色，它的音符也一起亮起。
- 一个音节在整个演唱期间都保持亮着——经过与它相连的延音线、它的连线中的音符，以及跨过小节线——到休止符时熄灭。
- 点击歌词即从那里播放，和点击音符一样。⛶ Read 中歌词也会亮起。
- 它和音符使用同一个时钟：如果乐谱旁边有歌曲，请调整 **Sync**，让音符和歌词对上歌声。

## 🎼 Sheet Music 标签页的布局（2.736.0）
<!-- en: the-sheet-music-tab-s-layout-2-736-0 fe58fda26898 -->

- 两条工具栏：**制作乐谱**（🎼 Write from lyrics、用来选择录音的 🎵 Audio file… - 选中的文件名会显示在按钮上 - 以及 📜 Transcribe），和**这份乐谱**（Score 列表、↻、📂 Open .abc、⛶ Read、带 download too 的 💾 Save PDF、words、🎨 Paper、‹/› ABC text、⧉ Copy）。Write 和 Save PDF 带橙色边框，是主要操作。
- 播放器位于乐谱查看区的顶部：⏮ ⏪ ▶ ⏩ ⏭、时间、小节、Sound、Sync 和 follow。播放时 ▶ 会变成橙色的 ⏸。⛶ Read 中有同样的按钮。

## 🎼 声部与混音：每种乐器和人声（2.737.0）
<!-- en: parts-and-the-mix-each-instrument-and-the-vocals-2-737-0 76d7483f0fe0 -->

- 有多个谱表的乐谱，在乐谱上方会有**标签**：**Full score**，然后每个谱表一个（人声的会有标记）。点一个标签，就只显示那个谱表的单独乐谱，顶部写着声部名：钢琴手的声部、歌手的声部（勾选 **words** 时带歌词）。⛶ Read 和 💾 Save PDF 使用当前的声部，PDF 也以它命名（Night Drive - Piano.pdf）。切换标签时，歌曲的位置保持不变。
- 播放器里的 **Play** 可以边听边开关：
  - 用 **🎹 the notes** 时，每个谱表一个按钮：点击即静音或取消静音，**Shift+点击**只听这一个（再 Shift+点击一次恢复全部）；
  - 用 **🎵 the song** 时，歌曲分离成音轨后可使用 **Vocals** 和 **Instruments**。还没分离的歌曲会显示 **✂ Separate vocals**：它运行 Stems 面板的分离（demucs，在这台电脑上），完成后出现这两个按钮。
- 歌曲只能分成歌声和其余部分（分离产生的就是这两个），所以单独开关各个乐器只能在用音符播放时进行，录音中做不到。

## 🎚 按图层播放歌曲，显示波形（2.738.0）
<!-- en: the-song-in-its-layers-as-waveforms-2-738-0 ca094b81dc7a -->

- 乐谱播放**真正的歌曲**。播放器中的 **Sound** 列出项目里的所有歌曲：乐谱会自己找到它的歌曲（生成它时的歌曲，或标题相同的歌曲），你选择的歌曲会按乐谱记住。**🎹 the notes (no recording)** 在浏览器中用柔和的钢琴声播放写出的音符 - 用于没有歌曲的乐谱。
- 歌曲按**图层**播放，每个图层在播放器下方占一条轨道：它的**波形**、在上面移动的播放位置，以及开关按钮（**Shift+点击** = 只听这一个图层；再 Shift+点击一次恢复全部）。点击波形的任何位置，即从那里播放。
- 还没分开的歌曲会显示一条 **Song** 轨道和 **✂ Split into layers**：它在这台电脑上（demucs）把歌曲分成 **Vocals、Drums、Bass** 和 **Other**（其余所有），需要一两分钟。已在 Stems 面板中分离过的歌曲，在分成四个之前显示 **Vocals** 和 **Instruments**。
- 歌曲在第 1 小节前有前奏时，仍用 **Sync (s)** 把歌曲和音符对齐。

## ✨ Create：一键得到歌曲的图层和乐谱（2.739.0）
<!-- en: create-a-song-s-layers-and-its-sheet-music-in-one-press-2-739-0 9541017c13fa -->

- 在 Sheet Music 标签页选择 **Song** - 项目中的任何歌曲（与 Song 标签页标题相同的歌曲会自动选中），或 **📂 A song from this computer…**（把它复制到项目中）- 然后按 **✨ Create**。会运行三个步骤，在按钮旁逐一打勾：
  1. **Split** - 把歌曲分成 Vocals、Drums、Bass 和 Other（在这台电脑上）；它们的波形立即显示在播放器下方。已经分开的歌曲会跳过这一步。
  2. **Lyrics** - Song 标签页的歌词；该框为空时，会从人声图层中听出歌词并填进去。
  3. **Sheet music** - 根据歌曲本身写出。打开时音符下方带有歌词，并按图层播放这首歌。
- 如果某一步无法运行（未安装分离工具、ComfyUI 没有运行…），Create 会停在那里并说明原因。
- 没有录音的乐谱仍可使用 **🎼 Write from lyrics**：它根据歌词和风格作曲。

## ⬇ 缺少的组件在需要时下载（2.740.0）
<!-- en: missing-parts-download-when-they-are-needed-2-740-0 20afe21c1c0a -->

- 当某个功能需要尚未安装的组件时 - **✨ Create**、**✂ Split into layers** 或 Stems 面板的 **Separate** 所用的歌曲分离（demucs），或用来听出歌词的语音转文字（Whisper）- 会弹出一个框，说明缺少什么、它的作用和大小，并带有 **⬇ Download** 和 **Cancel**。你不必去找 Install 按钮。
- **⬇ Download** 会就地安装，显示进度条和正在做的事；完成后框会关闭，任务自动继续（✨ Create 会依次进行分离、歌词和乐谱）。
- **Cancel**（Enter 和 Esc 也是 - 焦点在 Cancel 上，所以大的下载不会因误按而开始）会停止该任务并说明。对于歌词，Cancel 只是做出不带歌词的乐谱。下载时按 **Close** 会让安装在队列中继续。
- ComfyUI 渲染用的模型已经以同样方式询问（找不到模型的提示框，2.719.0）。

## 🎶 ACE-Step 1.5，以及音频选项卡上的音乐风格（2.741.0）
<!-- en: ace-step-1-5-and-the-music-styles-on-the-audio-tab-2-741-0 444c366b67a5 -->

- **ACE-Step 1.5 Turbo** 是一个新的音乐模型：从文字和歌词生成带人声的完整歌曲，10 秒到 10 分钟，歌词支持 50 多种语言，而且很快（8 步）。它的许可证（MIT）允许商用这些歌曲。在 Music 面板中选择 **ACE-Step 1.5** 风格；如果 ComfyUI 还没有它的模型，第一首歌会询问是否下载它的四个模型文件（约 9.3 GB）。
- **设置 ▸ 音频** 现在包含所有声音设置：**🎶 音乐风格**（原来的 Music 选项卡），然后是 **🗣 语音**，然后是
  **📝 语音转文字**。顶部的按钮可跳到各部分。
- ACE-Step 风格有两个额外部分：
  - **BPM、调、每小节拍数和语言** 引导歌曲。留空（自动）则使用工作流自己的值。
  - **LoRA**：＋ LoRA 从 ComfyUI 的 loras 文件夹中选择一个，滑块设置其强度。为 ACE-Step 1.5 训练的 LoRA 会改变声音或嗓音。
    LoRA 只对 ACE-Step 提供：尚不清楚 MiniMax Music3 和 YuE2 是否支持。
- 描述仍然是风格（流派、乐器、情绪、歌手），歌词仍然是提示词。

## 🗂 基本设置的每个选项卡保留自己的设置（2.742.0）
<!-- en: every-basic-settings-tab-keeps-its-own-settings-2-742-0 2d36c83f3268 -->

- 在 **基本设置** 中，**Ref**、**F/L**、**Text** 和 **Swap** 各自记住自己的设置：格式、分辨率、宽高比、宽和高、秒数、每段最大秒数、步数、CFG、种子和模型。切换选项卡时会保存离开的那个；回去时它的设置会恢复。从未打开过的选项卡从当前显示的设置开始。设置保存在此浏览器中，因此重启后仍然保留。
- 只有您自己点击才会切换它们。打开项目时，或应用替您选择选项卡时（添加图片、剧本），当前显示的设置保持不变。
- **Character chain** 在您切换到 **Standard** 再回来时，即使还没按 **💾 Save chain settings**，也会保留您输入的内容。

## ☁ 在 RunPod Serverless 端点上渲染（2.743.0）
<!-- en: rendering-on-a-runpod-serverless-endpoint-2-743-0 acb1583d96d0 -->

**设置 ▸ 远程生成 ▸ RunPod Serverless** 把所有渲染发送到 RunPod Serverless 端点。无需启动或停止机器：每次渲染是一个任务，只在工作器运行时计费。

**准备端点（在 runpod.io 上一次即可）**

1. 创建一个 **网络卷**，把模型放在 `models/` 下（与 ComfyUI 相同的文件夹：`models/checkpoints`、
   `models/diffusion_models`、`models/loras`、`models/text_encoders`、`models/vae` …）。工作器从
   `/runpod-volume/models/…` 读取。
2. 用 RunPod 的 ComfyUI 工作器镜像 `runpod/worker-comfyui:<version>-base`（5.x 版本）创建一个 **Serverless 端点**。如果你的风格用到自定义节点（MiniMax H3 节点、VHS、KJNodes …），请以它为基础构建自己的镜像并装好这些节点（在 Dockerfile 中 `RUN comfy-node-install <节点包>` - 参见工作器的自定义指南）。挂载网络卷。
3. 复制端点的 **ID** 和一个 **API 密钥**（Settings → API Keys）。

**在 bitGen Studio 中**

- 选择 **RunPod Serverless**，粘贴 API 密钥和端点 ID，并填写工作器每小时的费用（RunPod 按秒列出 - 乘以 3600），
  📊 使用情况会计入。**✓ 测试** 显示就绪或运行中的工作器以及等待中的任务。**使用** 把所有渲染切换到端点；
  **这台电脑** 切换回来。
- 闲置一段时间后的第一个任务需要等待工作器启动（冷启动可能需要几分钟）。任务运行时没有步骤显示，进度显示的是时间。
- 图片、视频和歌曲都会传回。工作器只返回图片和 Save Video 文件，所以在途中，用 Video Combine 保存的视频改用
  ComfyUI 自带的 Save Video 保存，歌曲则装在一个很小的无声视频里传送，再在这台电脑上取出。
- 任务及其输入文件必须小于 **10 MB**（RunPod 的限制）。较长的参考视频或歌曲更适合用 Pod 或这台电脑；这种情况下任务会在发送前说明。
- 渲染前的模型检查会跳过：模型在端点的卷上，而不在这台电脑上。如果缺少某个模型，任务会以端点自己的消息失败。

## ☁ 在 RunPod Serverless 上只显示能渲染的风格（2.744.0）
<!-- en: on-runpod-serverless-only-the-styles-it-can-render-2-744-0 95e77634c111 -->

- 使用 **设置 ▸ 远程生成 ▸ RunPod Serverless** 时，风格列表（提示词面板的图片风格、视频风格、Music 面板的风格）只显示端点能渲染的风格。列表最后一行会说明隐藏了多少个；在设置里指向隐藏的风格可以看到原因。
- 无法询问端点有哪些节点，所以软件根据它的镜像内容来判断。RunPod 的工作器镜像 5.10.0 带的是 **ComfyUI 0.34.0**，没有节点包。工作流的每个节点都在这个 ComfyUI 里，风格就能用。工作器需要 ComfyUI 节点列表的风格也会隐藏：
  LTX 2.3 / 2.5 和 Wan 2.1 / 2.2。
- 在远程 GPU 的 RunPod Serverless 部分：
  - **端点镜像里的 ComfyUI：** 如果你的镜像是用更新的 ComfyUI 构建的，选 **更新的 ComfyUI**（Fibo 2、YuE2、
    Qwen Image 2.1 等就会显示）。
  - **我的镜像有额外的节点包 - 显示所有风格：** 软件看不到镜像里有哪些节点包，所以显示所有风格。
  - 会有一行说明端点能渲染多少个风格，其余的风格列出原因。
- 切换回 **这台电脑** 会重新显示所有风格。
- 修复：使用远程 GPU 时在设置里按 **保存**，会把 ComfyUI 的地址改回这台电脑的，下一次渲染就在这里进行。现在由远程 GPU 标签页决定用哪个 ComfyUI 渲染。在 ComfyUI 标签页输入的地址是这台电脑的，**这台电脑** 会使用它。

## 🖥 基本设置 ▸ GPU：哪些在远程 GPU 上运行（2.745.0）
<!-- en: basic-settings-gpu-what-runs-on-the-remote-gpu-2-745-0 bbf5b58a5a1e -->

- **基本设置 ▸ GPU** 有三个选项：
  - **远程：** 所有任务都在 设置 ▸ 远程生成 中设置的远程 GPU 上运行（与那里的“使用”相同）。
  - **本地：** 全部在这台电脑上运行（与“这台电脑”相同）。远程设置会保留，以后再用。
  - **两者：** 选择发送到远程 GPU 的内容，其余的在这台电脑上运行。
    - **LLM：** 聊天 / 提示词模型。
    - **视觉 LLM：** 描述图片的模型。
    - **图片：** 图片、放大、图形、3D。
    - **视频 + 歌曲：** 视频任务和歌曲。不使用 ComfyUI 的任务（导出、卡拉 OK、训练）始终在这里运行。
- 下面一行会说明每种内容现在在哪里运行。设置好远程 GPU 后才能选择“远程”和“两者”；有一个按钮可打开 设置 ▸ 远程生成。
- 选“两者”时，ComfyUI 的地址仍是这台电脑的，所以你自己的 ComfyUI 照常启动。勾选种类的任务会在开始时发送到远程 GPU；日志会说明在哪里渲染，📊 使用情况也会记录那里的时间。
- **RunPod 上的 LLM：** 在 设置 ▸ 远程生成 ▸ **🧠 LLM on RunPod (vLLM)** 中填写 RunPod vLLM 工作器的端点 ID
  （runpod.io：Serverless ▸ New Endpoint ▸ Deploy LLM API，并填写要运行的 Hugging Face 模型）。
  - 视觉 LLM 需要视觉语言模型，例如 Qwen2.5-VL。一个这样的端点可以同时用于两者 - 视觉端点留空。
  - 模型名称留空时，软件会询问端点它运行的是哪个模型。✓ 测试可以逐个检查。
  - 没有端点时，LLM 和视觉 LLM 无法勾选，会在这里运行。
- 选“两者”时，RunPod Serverless 的风格筛选（2.744.0）只作用于发送到端点的种类。
- 修复：基本设置会记住的设置（basic.cfg 和每个风格）不再包含 GPU 选项。

## 🏷 远程风格：每个风格决定在哪里运行（2.746.0）
<!-- en: remote-styles-each-style-says-where-it-runs-2-746-0 7b1be4d493b7 -->

- 每个风格编辑器在风格名称下方都有 **运行于**：设置 ▸ 图片、设置 ▸ 视频 和 设置 ▸ 音频 ▸ 音乐风格。
  - **这台电脑：** 用这台电脑上的模型渲染。
  - **远程 GPU：** 在远程 GPU 上渲染，所以它的模型（以及需要的节点包）必须在那里。会出现一个 **RunPod 端点 ID** 输入框。留空就使用 设置 ▸ 远程生成 中的端点；也可以给风格指定自己的端点 - 例如一个放 SDXL 模型的端点，另一个放 FLUX 的端点。
- 💾 保存时，远程风格的名称会以 **R_** 开头（R_SDXL），已经有的不会重复添加。改回“这台电脑”后 R_ 会被去掉。
- **基本设置 ▸ GPU** 现在决定列表中显示哪些风格：
  - **本地：** 只显示这台电脑的风格。列表最后一行显示隐藏了多少个远程风格。
  - **远程：** 只显示远程（R_）风格。在 RunPod Serverless 端点上，它无法渲染的远程风格也会隐藏（2.744.0）。
  - **两者：** 显示所有风格。由风格决定在哪里渲染：R_ 风格在远程 GPU 上，其他的在这里。没有风格的任务（放大、图表等）按“图片”和“视频 + 歌曲”的勾选来决定。
- 任务日志会说明在哪里渲染以及原因，例如“this image job (R_SDXL - a remote style) renders on RunPod Serverless
  ohkr3evlck2bxn”。
- 设置 ▸ 远程生成 ▸ RunPod Serverless 只统计你的远程风格：“此端点可以渲染你 N 个远程风格中的 K 个”。
- 现有风格都从“这台电脑”开始，所以更新后请为要在远程 GPU 上使用的风格设置“运行于”。

## 🖥 GPU 默认为本地，更新检查能顺利完成（2.747.0）
<!-- en: gpu-on-local-by-default-and-an-update-check-that-finishes-2-747-0 a73226edff49 -->

- **基本设置 ▸ GPU** 现在是基本设置的第一项，位于“覆盖风格”上方。它默认收起，标题显示当前选择（GPU · 本地）。展开后会像其他部分一样保持展开。
- **默认是本地**，也是第一个选项。更新到此版本时会切换到本地一次：远程 GPU 的“使用”把它设成了远程，而远程只列出 R_
  风格 - 还没有 R_ 风格时，图片和视频列表是空的。远程 GPU 的设置会保留；随时可以重新选择远程或两者。
- 选了远程但还没有 R_ 风格时，风格列表最后一行会说明：把 基本设置 ▸ GPU 改为本地，或把风格的“运行于”设为远程 GPU。
- **设置 ▸ 常规 ▸ 更新：** 在 git 安装中，🔍 检查更新 会在一次请求中下载整个更新（每个版本约 13 MB 的指南 PDF）。工作室等待请求的时间最多 5 分钟，所以网络较慢或落后几个版本时，检查会以“Failed to fetch”失败。现在它只向 GitHub 询问最新的提交，几秒就能完成，⤓ 立即更新 会在后台下载其余部分（最多允许 1 小时）。如果工作室不再响应，消息会说明这一点，而不是
  “Failed to fetch”。

## 🔑 你的 API 密钥加密保存在 settings 文件夹中（2.748.0）
<!-- en: your-api-keys-are-kept-encrypted-in-the-settings-folder-2-748-0 0181ccd6ed4a -->

- 你添加的 API 密钥和令牌保存在 bitGen 文件夹中的 **settings/keys.json**，每一个都单独加密（AES-256-GCM）。包括：
  - Hugging Face 令牌
  - Civitai 令牌
  - RunPod API 密钥（设置 ▸ 远程生成）
  - 远程访问密钥
  - bitGen 社区的登录
- **settings/keys.master** 存放用来打开它们的密钥，在第一次保存密钥时生成。
- **更新不会动它们。** settings 文件夹不属于应用的文件，所以 `git pull`、⤓ 立即更新 和新的 zip 都不会碰它。密钥只需添加一次。
- **custom.settings 不再保存任何密钥。** 已经在里面的密钥会在第一次启动 2.748.0 时移到 settings/。custom.settings.bak
  和 community.json 中的社区登录令牌也一样。
- **设置 ▸ 常规** 显示密钥文件的位置和已保存密钥的名称（从不显示密钥本身）。将设置恢复为默认值 会保留你的密钥。
- **移到新文件夹或新电脑：** 把整个 settings 文件夹复制过去（keys.json 和 keys.master 一起）。单独的 keys.json 无法打开。
- **加密的作用：** 密钥不再以明文出现在设置文件、它的备份或你发给别人的文件中。应用必须在不询问你的情况下打开它们，所以能读取你在这台电脑上的文件的人也能打开 - 任何会记住密钥的应用都是如此。
- 修复：misc/default.settings 现在列出了应用使用的所有默认值（文件中缺少 5 个较新的值；这些值早已在使用）。

## ☁ 为 RunPod 工作器镜像准备的现成远程风格（2.749.0）
<!-- en: ready-made-remote-styles-for-runpod-s-worker-images-2-749-0 2f702f11ea3c -->

- 工作室自带 7 个远程风格，RunPod 的每个标准 worker-comfyui 镜像有一到两个。每个镜像只有一套模型：

  | 风格 | RunPod 镜像（runpod/worker-comfyui:5.10.0-…） |
  |---|---|
  | R_SDXL, R_SDXL img2img | sdxl |
  | R_FLUX.1 schnell | flux1-schnell |
  | R_FLUX.1 dev | flux1-dev |
  | R_FLUX.1 dev fp8 | flux1-dev-fp8 |
  | R_SD3 Medium | sd3 |
  | R_Z-Image Turbo | z-image-turbo |

  它们只使用 ComfyUI 自己的节点和 RunPod 放进该镜像的模型文件，所以无需上传任何东西就能渲染。
- **设置 ▸ 远程生成 ▸ RunPod Serverless ▸ 端点的镜像：** 工作室向 RunPod 询问你的端点运行的镜像（🔍 询问 RunPod，第一次会自动询问），并只列出适合该镜像的现成风格。使用 sdxl 镜像时会看到 R_SDXL 和 R_SDXL img2img；其他的会隐藏，工具提示会说明原因。如果 RunPod 无法回答，请自己选择。“base”（模型在网络存储卷上）、“你自己的镜像”和“尚不清楚”会显示所有远程风格。
- 和其他远程风格一样，它们在 基本设置 ▸ GPU 为远程或两者时显示；为本地时隐藏。
- **日志现在会说明任务在哪里渲染。**
  - 在 RunPod Serverless 上，VRAM 步骤会说明由端点的工作器加载模型，而不是“VRAM kept”（那是指这台电脑）。
  - [power] 行以“rendered on RunPod Serverless …”和该任务在那里的大致费用（根据 设置 ▸ 远程生成 中的每小时价格）开头，然后是这台电脑在等待期间的用电。
- 你自己的风格不能使用现成风格的名称：因为 R_SDXL 已经存在，把 SDXL 保存为远程风格会被拒绝。请使用 R_SDXL，或给你的风格另起名字。

## 🧠 启动画面改为 bitGen 大脑和标志 (2.752.0)
<!-- en: the-splash-is-the-bitgen-brain-with-the-logo-2-752-0 99f60c62b48a -->

- **桌面应用的启动画面现在总是 bitGen 大脑影片**：闪电击中大脑，然后出现大大的 bitGen Studio 标题，下方是制作人员名单。橙色的标志影片不再随机出现。
- **官方标志位于左上角**——尺寸小，不会遮住大脑。影片无法播放、改为显示大脑图片时，标志也会留在原处。
- **大脑影片更清晰了**：从 960 × 544 提升到 1920 × 1080，使用 AI 放大工具放大，bitGen Studio 标题和各个标签都很清晰。
- 点击或按任意键仍可跳过启动画面。
- 网站首页播放同一段大脑影片，标志也在同一位置。

## 🧠 OpenRouter 上的 LLM；“远程 GPU”现在叫“远程生成” (2.753.0)
<!-- en: the-llm-on-openrouter-remote-gpu-is-now-remote-generation-2-753-0 5dfe0eaeb867 -->

- **设置 ▸ 远程 GPU 现在叫 设置 ▸ 远程生成。** 里面的一切照常可用。
- **LLM 可以在 OpenRouter**（openrouter.ai）上运行：一个 API 密钥就能使用数百个模型，其中一些免费。无需安装。显卡较小时最有帮助 - LLM 不必再和图片模型共用显卡。
  1. 在 openrouter.ai 注册免费账户并创建密钥（Keys）。
  2. 在 设置 ▸ 远程生成 ▸ 🧠 LLM 中选择 **OpenRouter**，粘贴密钥。密钥会和你的其他密钥一起加密保存在 settings 文件夹中。
  3. 选择 **LLM**。一开始 **仅免费模型** 是勾选的；取消勾选即可看到付费模型及其每百万 token 的价格。
  4. 选择用于描述图片的 **视觉 LLM** - 只列出能处理图片的模型（👁）。留空则在 LLM 能处理图片时使用该 LLM。
  5. **✓ Test** 会检查密钥和模型。
  6. 在 基本设置 ▸ GPU 中选择 **两者**，并勾选 **LLM** 和 **视觉 LLM**。没有远程 GPU 也能用 - 图片、视频和歌曲仍在这台电脑上渲染。
- 免费模型每分钟约 20 次请求，每天 50 次；账户购买 $10 额度后每天 1000 次。OpenRouter 可能会调整这些限制。
- 你的提示词和图片会发送给 OpenRouter 及模型提供方。私密素材请留在这台电脑上。

## ☁ 使用远程生成、远程生成停靠窗和 Pod 快捷方式 (2.754.0)
<!-- en: use-remote-generation-the-remote-generation-docker-and-pod-shortcuts-2-754-0 94cd5331d611 -->

- **设置 ▸ 远程生成 ▸ 使用远程生成** 是这个标签页的第一项。取消勾选时，标签页的其余部分、基本设置 ▸ GPU 和远程生成停靠窗都会隐藏，一切都在这台电脑上运行。新安装时默认不勾选；更新时如果已经设置过远程，则默认勾选。
- **远程生成停靠窗：** 在 基本设置 ▸ GPU 中按 **☁ 远程生成停靠窗**。它和其他停靠窗一样可以浮动和停靠，状态栏里没有它的按钮。它显示：
  - 任务在哪里运行、正在使用的远程 GPU，以及 LLM 在哪里运行；
  - **我的 Pod**：你的 RunPod Pod（你的 API 密钥 - All 权限的密钥），带 **▶ 开始**、**⏹ 停止** 和 **使用**（在那个 Pod 上渲染）。停止的 Pod 在 RunPod 上终止（Terminate）之前仍要支付存储费用；
  - **Pod 快捷方式**：你作为自己的 Pod 部署的 RunPod 模板（“公开 Pod”）。
- **添加 Pod 快捷方式：**
  1. 在 RunPod 上打开 **Explore**（停靠窗里的 **浏览 RunPod 模板 ↗**），找到一个模板 - 请选运行 ComfyUI 的。
  2. 复制它页面的链接（runpod.io/console/explore/…），连同名称粘贴到停靠窗里，按 **＋ 添加**。
  3. **部署 ↗** 会打开已选好该模板的 RunPod 部署页面（bitGen 的推荐链接）。选择 GPU 并部署。
  4. 回到停靠窗，**🔄 我的 Pod** 会列出新的 Pod - 按 **使用**。

## ☁ 11 月 15 日之后 Pod 照常可用；正在加载 Pod、Pod 已就绪、正在停止 Pod (2.755.0)
<!-- en: pods-keep-working-after-15-november-loading-pod-pod-loaded-stopping-pod-2-755-0 78732d83c2a8 -->

- RunPod 将在 2026 年 11 月 15 日停用 bitGen 用于 Pod 的 API（REST v1）。现在 bitGen 的 🔄 我的 Pod、▶ 开始 / ⏹ 停止以及 Serverless 端点的镜像都使用 RunPod 的新 API（REST v2）。你不需要做任何更改。你的 API 密钥需要有 Pod 的访问权限 -
  All 权限的密钥。
- **远程生成停靠窗会显示 Pod 正在做什么：**
  - **▶ 开始** - RunPod 启动 Pod、然后启动它的 ComfyUI 时显示“正在加载 Pod…”，ComfyUI 有响应后显示“Pod 已就绪”。之后显示
    Pod 已运行多久以及大约花了多少钱。
  - **⏹ 停止** - 显示“正在停止 Pod…”，然后是“已停止”。停止的 Pod 在 RunPod 上终止（Terminate）之前仍要支付存储费用。

## 🖥 远程服务器、RunPod 的 Serverless 或 Pod，以及 PODS 停靠窗 (2.756.0)
<!-- en: remote-servers-runpod-serverless-or-pods-and-the-pods-docker-2-756-0 ec394393fd67 -->

- **基本设置 ▸ GPU ▸ 远程服务器：** 选择 **RunPod** 或 **OpenRouter**。OpenRouter 会在那里运行 LLM，图片、视频和歌曲在这台电脑上渲染。RunPod 则选择 **Serverless**（端点，只在任务运行时计费）或 **Pod**（你自己的 GPU 机器，运行时按小时计费）。还没有任何设置时，这些选项显示在本地下方，所以你可以先选 Pod - 这样远程就能选了。
- **PODS 停靠窗**（基本设置 ▸ GPU 中的 **🖥 PODS** 按钮）只在选择 RunPod ▸ Pod 时显示：
  - RunPod 的公开模板 - **官方**、**已验证** 和 **Community** - 带搜索和 **仅 ComfyUI**（开启：bitGen 能用来渲染的模板）。点击名称会打开它在 RunPod 上的页面。
  - **创建 Pod…：** 选择 GPU（RunPod 当前每小时的价格、显存以及空闲情况；“none free”的不能选）、云（**Secure** - RunPod
    自己的数据中心 - 或 **Community** - 通常更便宜）、GPU 数量、容器磁盘（Pod 停止时清空）和 /workspace 的大小（停止时保留，收取存储费用）。下方会显示每小时的估算。**创建 Pod** 会在 RunPod 上创建它，然后显示“正在加载 Pod…”和“Pod 已就绪”。
  - **我的 Pod：** 你账户里的所有 Pod。🅱 表示由 bitGen 创建或启动的。**▶ 开始** / **⏹ 停止**、**使用**（通过它的 ComfyUI
    端口渲染）和 **终止** - 它会先询问，因为 Pod 及其上的所有文件都会被删除；只有网络卷会保留。

## 🃏 每个 RunPod 模板都是一张卡片 (2.756.1)
<!-- en: every-runpod-template-as-a-card-2-756-1 8f421956bb01 -->

- PODS 停靠窗现在一次列出 RunPod 的**全部**公开模板。**全部** 把官方、已验证和社区放在一起显示，也可以只选一个分组；每个按钮都显示该分组有多少个模板。RunPod 每个分组最多给出 100 个模板。
- 每个模板都是一张**卡片**，就像 ComfyUI 的模板浏览器：一个带首字母的彩色色块，标出它适用的机器种类（NVIDIA、AMD 或 CPU），运行 ComfyUI 的还有 **ComfyUI** 标记；下面是名称、镜像、所属分组、磁盘和 /workspace 的大小以及 Web 端口。**创建 Pod…** 会在卡片上方打开表单，**↗** 打开该模板在 RunPod 上的页面。RunPod 的列表里没有模板的图片和说明，所以色块是 bitGen 画的。
- 边输入边**搜索**：每个词都必须出现在名称、镜像、端口、种类或分组中——例如 `comfy 3000` 或 `pytorch rocm`。**所有种类** 可以只显示 NVIDIA、AMD 或 CPU 模板。
- **仅 ComfyUI** 现在一开始是关闭的：开启时它会隐藏全部 100 个官方模板，因为其中没有一个运行 ComfyUI。勾选它就只看 bitGen 能用来渲染的模板。
- 如果 RunPod 对某个分组没有回应，其他分组仍会显示，按钮下方那一行会写出缺少的是哪个分组。

## 🤖 加入社区是给真人的 (2.756.3)
<!-- en: joining-the-community-is-for-people-2-756-3 22a9362ada32 -->

- 有机器人用随机名字和别人的电子邮件地址加入社区，于是社区给陌生人发送了验证码邮件。现在加入时会在发送任何邮件之前把它们挡掉。
- bitGen Studio 里的 **💬 社区 ▸ 加入** 会先做一个简短的自动检查。大约一秒钟，你不会看到它。旧版本的 bitGen Studio 不能再加入（会提示）：请更新，或在网站上加入。登录和以前一样。
- 网站上的 **加入** 有一个滑块：按加入之前先把它滑到最后。
- 看起来像机器生成的名字或姓氏（一个单词里夹着随机的大写字母）会被拒绝。请按实际写法输入你的名字。

## 🔑 设置 ▸ API - 在在线服务上生成 (2.757.0)
<!-- en: settings-api-render-on-an-online-service-2-757-0 6515d9088a9a -->

- **设置 ▸ API**（紧跟在远程生成之后）让 bitGen 不需要好显卡也能生成：由在线服务完成工作，并按每次生成向你的账户收费。内置七个服务 - **OpenRouter**（图片、视频、LLM）、**fal.ai**（图片、视频、歌曲）、**Replicate**（图片、视频、歌曲）、**OpenAI**（图片、LLM）、**Google Gemini**（图片、LLM）、Anthropic 的 **Claude**（LLM）和 **RunningHub**（云端的 ComfyUI 工作流：图片、视频、歌曲）。
- 添加方法：粘贴它的 **API 密钥** - **服务** 设为 **根据密钥自动识别** 时会按密钥的格式识别（也可以手动选择）- 输入 **名称**，保持勾选 **使用**，然后按 **+ Add**。输入框下方的 **获取密钥** 会打开该服务的密钥页面。
- **使用** 会创建这个 API 的风格：`API_<name> pictures`、`API_<name> video` 和 `API_<name> songs`（只有服务能生成的类型）。它们像其他风格一样出现在图片、视频和歌曲的风格列表中，并在服务端生成 - 不使用这台电脑的显卡，也不需要 ComfyUI。取消勾选 **使用**，它创建的风格会被移除；你自己创建的风格会保留。
- **模型和密钥** 显示每种类型初始使用的模型（例如 OpenRouter 的 `google/gemini-2.5-flash-image`、fal.ai 的 `fal-ai/flux/schnell`）- 输入该服务的其他模型或新密钥，然后按 **保存模型和密钥**。对 **RunningHub** 来说，模型就是 **工作流 ID** - runninghub.ai 上工作流地址中的数字。bitGen 会读取工作流并填入你的提示词、尺寸、种子和参考图片。
- 任何风格都可以在 API 上运行：在设置 ▸ 图片、视频或音频 ▸ 音乐中，把风格的 **Runs on** 设为 **API**，选择 API、它的 **模型**，如果模型有自己的选项，再用 JSON 填写 **额外设置**（例如 `{"num_inference_steps": 4}`；RunningHub 则是 `{"nodeId", "fieldName", "fieldValue"}` 的列表）。名称随后以 **API_** 开头。
- **Claude** 只用作 LLM，不生成图片、视频或歌曲。添加它的密钥（在 Claude Console 中创建，以 `sk-ant-` 开头）后，**使用** 会自动同时勾选 **用作 LLM**：剧本写作、提示词帮助、图片描述和分镜列表都会在 `claude-sonnet-5-5` 上运行（可在 **模型和密钥** 中更改，例如 `claude-opus-5-5` 或 `claude-haiku-5-5`）。bitGen 会去掉 Claude 不接受的设置，并给它回答前思考的空间。
- **✓ Test** 询问服务是否接受该密钥。**用作 LLM**（OpenRouter、OpenAI、Gemini、Claude）会把所有 LLM 调用 - 提示词 LLM、图片描述、分镜列表 - 发送到该服务；一次只能一个 API。**✕** 会先确认，然后删除该 API 及其风格。
- 密钥 **加密** 保存在这台电脑上（settings/keys.json），只发送给对应的服务；页面只显示最后四个字符。生成任务的文件只包含它需要的密钥。
- 视频：OpenAI 已在 2026 年 9 月停止其视频 API（Sora），Gemini 的视频模型也不通过 bitGen 使用的 API 密钥提供 - 视频请使用 OpenRouter、fal.ai、Replicate 或 RunningHub。

## 🧩 P_ Pod 风格和 Pod 加载进度条 (2.758.0)
<!-- en: p-pod-styles-and-a-pod-s-loading-bar-2-758-0 4dd5ce6454aa -->

- **Pods 下只显示 P_ 风格。** 基本设置 ▸ GPU 为 **RunPod ▸ Pods**（远程或两者）时，风格列表只显示 **P_** 风格 - 用 Pod 上已有的模型生成的风格。在本地或 Serverless 下 P_ 风格会隐藏，因为它们需要 Pod。
- **选择模型：🎨 Styles。** Pod 显示 *pod loaded* 后，在 PODS 停靠窗中按它的 **🎨 Styles**。bitGen 会读取 Pod 的 ComfyUI 并列出：
  - **Pod 的模型**，以及每个模型适合的 bitGen 风格 - 例如 `qwen_image…` → qwen2_1、`z_image_turbo…` → Z-Image Turbo、`krea2…` → Krea 2、`flux1-krea…` → FLUX.1 dev。bitGen 没有工作流的模型（例如 Boogu 这样的自定义模型）不能勾选 - 请使用 Pod 自己的工作流。
  - **Pod 中保存的工作流** - 模板放在 ComfyUI 里的工作流。它们已经使用模板的模型和自定义节点。勾选需要的内容，然后按 **🎨 Make P_ styles**。模型会变成 `P_<model file>`：该模型类型的 bitGen 工作流，填入 Pod 的模型、文本编码器和 VAE。工作流会变成 `P_<workflow name>`，与模板做的完全一样。目前只有图片风格 - 视频或歌曲工作流会列出并说明原因。再次创建会更新同一个风格。
- 任何风格都可以在 Pod 上运行：设置 ▸ 图片 ▸ 风格的 **Runs on** ▸ **RunPod pod**，填入 Pod 的 ID（留空 = 你按了 **Use it** 的 Pod）。名称随后以 **P_** 开头。
- **P_ 风格下的基本设置。** 选择 RunPod ▸ Pods 会勾选 **Override style**，基本设置的 **步数、种子、CFG、尺寸和宽高比** 会用于每次 Pod 生成。选中 P_ 风格时，**检查点** 框和 **LoRA** 行会关闭 - 使用 Pod 自己的模型和 LoRA。Override style 关闭时，Pod 的工作流使用自己的数值。
- **加载进度条。** Pod 启动时，PODS 停靠窗和远程生成停靠窗会显示当前阶段：1/4 *waiting for a GPU machine*（等待 GPU 机器）→ 2/4 *starting the container*（下载模板的镜像）→ 3/4 *ComfyUI starting*（这类模板会在此时下载模型 - 通常是最长的部分）→ *pod loaded in …*。RunPod 不报告下载百分比，所以进度条是把已用时间与这个 Pod - 或同一模板的另一个 Pod - 上次的加载时间相比（“3 min of about 7 min”）；第一次按阶段前进。
- **Pod 和 Pod 快捷方式现在在 PODS 停靠窗中。** 远程生成停靠窗保留工作运行位置和 **🖥 PODS docker** 按钮。Pod 快捷方式就是模板卡片上的 **☆**：按下后 bitGen 会记住这个模板 - 链接会自动填入。**★ Shortcuts** 列出它们，每个都有 **Deploy ↗**（已选好模板的 RunPod 部署页面）和 **Create pod…**；再按一次 **★** 即可移除。RunPod 不列出的模板（私有模板）仍可在该标签页粘贴链接添加。

## ⬇ 把模型下载到 Pod，以及为风格选 Pod (2.759.0)
<!-- en: models-onto-a-pod-and-pods-for-a-style-2-759-0 1ba6ab5d3dc6 -->

- **为风格选 Pod。** 在 PODS 停靠窗的 **For …**（ComfyUI only 旁边）选择一个 bitGen 风格：名称或镜像中包含该风格模型系列（Krea、Qwen、Z-Image、FLUX、Wan、SDXL 等）的模板会排在前面，并标记 **✓ fits**。这样创建的 Pod 如果有该模型，加载后会自动得到该风格的 P_ 风格。
- 运行中 Pod 的 **⬇ Models** 会把模型下载到它的 ComfyUI。选择 **一个风格** - 它在 bitGen 下载列表中的文件会被勾选，并显示总大小 - 或搜索列表勾选单个文件，然后按 **⬇ Download ticked**。每个文件都有一条进度条；之后可按 **🎨 Make P_ styles from the pod**。文件会放到 ComfyUI 读取模型的文件夹；如果它不在 `/workspace` 下，bitGen 会提示，因为 Pod 停止后这些文件会消失。
- ComfyUI 本身没有“下载文件”的接口，所以 bitGen 使用 Pod 上已有的方式：
  - **Pod 的 Jupyter** - 任何文件都可以。bitGen 创建的 Pod 会带有 bitGen 自己的 Jupyter 密码（加密保存），只要模板运行 Jupyter 就能直接使用。在 RunPod 网站上创建的 Pod，请把它的 Jupyter 密码（RunPod ▸ Pod ▸ Connect）粘贴到输入框。
  - **ComfyUI-Manager** - 没有 Jupyter 时使用。它只下载自己列表中的模型（Qwen Image、FLUX.1、Wan 2.2、SDXL 等 - 不包括 Z-Image 或 Krea 2）；bitGen 会列出无法通过这种方式获取的文件。
- Hugging Face 上需要授权的模型会使用你在设置中的 Hugging Face 令牌，它只随下载发送到你自己的 Pod。
- **来自链接或这台电脑的文件**（在 ⬇ Models 中）：选择要放入的模型文件夹（loras、checkpoints 等），然后粘贴链接 - Civitai、Hugging Face 或任何网址 - 并按 **⬇ From the link**，或按 **⬆ From this computer…** 从磁盘选择文件。两者都通过 Pod 的 Jupyter。来自电脑的文件会分段发送，所需时间取决于你的上传速度，所以 Hugging Face 或 Civitai 上已有的模型用链接会更快。Civitai 链接使用设置中的 Civitai 令牌。

## 🎵 Audio 停靠栏、以你的货币显示价格、My pods (2.760.0)
<!-- en: the-audio-docker-prices-in-your-currency-and-my-pods-2-760-0 aeeea0948303 -->

- **Audio 停靠栏。** Music、Stems 和 SFX 现在是同一个停靠栏 **Audio** 的标签页，状态栏上的三个按钮也合并为一个
  **Audio** 按钮。该按钮以你上次使用的标签页显示或隐藏 Audio 停靠栏。它的标题栏显示 **Audio** 和标签页
  **🎵 Music · 🎚 Stems · 💥 SFX**：点一个标签页就显示它，其余的收起。每个标签页保留各自的高度、▾ 折叠、⛶ 最大化和
  ⇱ 浮动。任何打开其中之一的操作——工作区、保存的停靠栏布局、语音聊天——都会把它作为 Audio 停靠栏的标签页打开。扩展已关闭的标签页不会显示。
- **货币**（设置 ▸ General）：RunPod、OpenRouter 等服务以美元列出价格。选择你的货币（AUD、USD、EUR、GBP、CNY、JPY
  等），bitGen 就以该货币显示：PODS 停靠栏的 GPU、每小时价格和你的 Pod，Remote generation 的 Pod，以及 OpenRouter
  的模型。把鼠标悬停在价格上可看到美元金额和汇率。汇率是当天的参考汇率（来自公布各国央行汇率的 Frankfurter——无需账户，无需密钥），每 12 小时检查一次，并保存以便离线使用。在 **1 USD = …** 中输入汇率即可使用你自己的汇率（例如银行的）；清空后恢复为当天的汇率。远程 GPU 的费用以 Energy cost 的货币计入 📊 Usage 账单。
- **🖥 My pods**（PODS 停靠栏）：模板标签页旁的一个按钮，显示你有多少个 Pod。它只显示你的 Pod——没有模板卡片，没有搜索。模板标签页（All、Official 等）只显示模板。**Create pod…** 只显示表单（✕ Close 或点一个标签页即可返回），
  Pod 创建后停靠栏会切换到 My pods，加载进度条在那里运行。

## 🖥 作为条目的 Pod：Pod 的用途、把文件放到上面、费用，以及重新创建 Pod (2.761.0)
<!-- en: pods-as-items-what-a-pod-is-for-files-onto-it-its-cost-and-pods-made-again-2-761 c5fed3df1878 -->

- **🖥 My pods 中的每个 Pod 现在都是一个条目。** 点它的名字即可展开（▸ / ▾）。名字这一行显示 GPU、每小时价格、状态，以及
  RunPod 今天和本月为它收取的费用。
- **Pod 的用途**：在名字下方勾选 **Video**、**LLM**、**vLLM**（描述图片的模型）、**Image** 和 **Image edit**。**💾 Save**
  在你做出更改之前（勾选、字段、发送的文件或新建的文件夹）是关闭的，保存后再次关闭。Save 会创建该 Pod 的 P_ 风格：对 Pod 上
  bitGen 有工作流的每个模型文件，为每种勾选的类型各创建一个 P_ 风格（P_<file>、P_<file> edit、P_<file> video）。取消勾选的类型会删除 Save 为它创建的 P_ 风格（🎨 Styles 创建的保留）。
- **Pod 上的 LLM / vLLM**：勾选并保存后，bitGen 的提示词 LLM（或描述图片的模型）会通过 RunPod 的代理与 Pod 上运行的
  OpenAI 兼容服务器（vLLM、Ollama 等）通信。填写端口（默认 8000）和模型；模型留空时 bitGen 会询问服务器提供的是哪个模型。每项同一时间只由一个 Pod 承担。
- **📁 New folder** 在 Pod 的 checkpoints 或 loras 中新建文件夹。**➕ Checkpoint** 和 **➕ LoRA** 把这台电脑上的文件发送到
  Pod 的 models/checkpoints 或 models/loras，或发送到 **into** 中选择的文件夹。它们通过 Pod 的 Jupyter 传输（bitGen 创建的
  Pod 已就绪；其他 Pod 请在 ⬇ Models 中粘贴密码）。
- **费用**（Basic Settings ▸ GPU，选择 RunPod ▸ Pods 时）：💲 正在运行的 Pod 数量和当前每小时费用，以及 RunPod 自己今天和本月的账单（GPU、CPU 和磁盘）——每分钟重新查询。📊 Usage 按天记录 Pod 费用，与电费并列，使用 Energy cost 的货币，并计入每天的账单。
- **P_ 风格会记住它的 Pod**：模板、GPU、Secure 或 Community、磁盘大小，以及 bitGen 放到上面的文件（和每个文件的来源）。用 Pod 已停止的 P_ 风格渲染时，bitGen 会启动它；RunPod 上已没有该 Pod 时，bitGen 会用同一模板、同一 GPU 创建新 Pod，等待它的 ComfyUI，并把文件放上去——文件仍在这台电脑上就从这里上传，否则用它的链接，再否则从 bitGen 的下载列表获取。这期间任务在队列中等待（日志中的 [pod] 行），然后在新 Pod 上渲染；风格会转到新 Pod。
- 在 Basic Settings 中选择 Pods 时，只显示 P_ 风格。
- **Audio 停靠栏**“屏幕上只显示一个标签页”的规则只适用于主列：浮动（⇱）或放进 ▣ Docker 的 Music、Stems、SFX 会与其他并排显示。

## 🧩 每个 Pod 一个检查点——Pod 就成为这个风格 (2.762.0)
<!-- en: one-checkpoint-per-pod-the-pod-becomes-the-style-2-762-0 74c6dc4c0638 -->

- **Checkpoint**（在 🖥 My pods 中某个 Pod 的条目里）现在与 Basic Settings 的 Override style 使用相同的下拉框——文件夹筛选、文件和 📁，列出这台电脑上的 ComfyUI 模型。为 Pod 只选一个检查点：Pod 就成为这个风格。**💾 Save** 会用 bitGen 为该模型系列准备的工作流创建 **P_<Pod 的名字>**（勾选了的话还有 P_<Pod> edit / P_<Pod> video）——Krea 检查点用 bitGen 的 Krea 工作流，
  SDXL 用 SDXL 工作流——并使用 Pod 上与工作流最接近的文本编码器和 VAE。
- 如果 Pod 上已经有这个模型（模板自带的），就直接选用，不发送任何东西。否则会从这台电脑在后台发送一次，放进与这里相同的子文件夹（checkpoints/Krea/…）；💾 Save 旁边的一行显示进度。
- **LoRAs**：＋ 会增加一行同样的下拉框。它们与检查点一起发送到 Pod，并加入它的 P_ 风格。
- **Override style + Pods**：选中 P_ 风格时，Basic Settings 的检查点框重新可用。在那里选的检查点会在 Pod 上使用：如果 Pod 上没有，bitGen 会在渲染前发送它（任务等待，日志中有 [pod] 行），然后用它在 Pod 上的名字。P_ 风格的临时 LoRA 行仍然关闭。
- Pod 条目中的 📁 New folder 和文件对话框已移除——由下拉框取代。

## 🧩 你的风格在你的 Pod 上 (2.763.0)
<!-- en: your-styles-on-your-pods-2-763-0 760435606283 -->

- **不再生成 P_ 副本。** 在 RunPod Pods 上（Basic Settings ▸ GPU ▸ Remote 或 Both ▸ RunPod ▸ Pods），风格列表重新显示你自己的风格，每个风格都在一个 Pod 上渲染。你以前做的 P_ 风格照样能用。RunPod Serverless（R_）风格在 Pods 上隐藏。
- **风格用哪个 Pod：** 先是风格自己的 Pod（🖥 My pods 中 Pod 的 **Styles**），再是为它的类型（Image、Image edit、Video）勾选的
  Pod，再是正在使用的 Pod。想每种类型一个 Pod，就在不同的 Pod 上勾选 **Image**、**Image edit** 和 **Video**；想用一个 Pod
  做所有事，就在一个 Pod 上全部勾选。每种类型同一时间只属于一个 Pod - 在一个 Pod 上勾选它，就会从另一个 Pod 上去掉。
- **Pod 的 Styles**（在 🖥 My pods 中 Pod 的项目里）取代了 2.762.0 的 Checkpoint 和 LoRA 下拉列表：下拉列表列出 Generate 模式（🖼 Image、🎬 Video、🎶 Music）的风格；**All** 列出所有风格。选一个后按 **＋**；风格上的 **✕** 可以去掉它。**💾 Save** 把它们关联到 Pod，并在 Pod 运行时在上面把它们准备好。
- **在 Pod 上准备好** 的意思是：把风格的工作流、模型、文本编码器、VAE 和 LoRA 放到 Pod 上 - bitGen 下载列表里的文件由 Pod
  自己下载（很快），其他文件从这台电脑发送 - 并通过 Pod 的 Jupyter 安装工作流需要的节点包，然后通过 ComfyUI-Manager 重启
  ComfyUI。💾 Save 旁边的一行显示进度；做不到的事（bitGen 所知的任何节点包都不提供的节点、哪里都找不到的文件）也会在那里写明。
- **还没有 Pod 的风格：** 按 Generate 后渲染会等待，一个对话框询问：用 RunPod 的“ComfyUI CUDA 13”模板 **Create pod**（在 CUDA
  13 或更新的主机上）- 选择 Secure 或 Community、GPU（⭐ 是 bitGen 的推荐：显存足够放下风格模型的最便宜的一个，以你的货币显示每小时价格）和磁盘 - 或者对你的某个 Pod 选 **Use this pod**（已停止的 Pod 会被启动）。无论哪种，风格都会关联到那个
  Pod，下次会自动去那里。**Cancel** 取消这次渲染。
- **每次在 Pod 上渲染之前**，bitGen 会启动已停止的 Pod；如果 RunPod 上已经没有这个 Pod，就按当初的方式重新创建；等它的
  ComfyUI 就绪，并在应用每次运行时把风格在 Pod 上准备一次。任务日志的 [pod] 行会说明正在发生什么。
- **Override style** 在 Pods 上依然可用：如果 Pod 没有 Basic Settings 的 checkpoint，会在渲染前发送到 Pod。
- **Pod 上的 LLM：** ComfyUI 不是聊天服务器，所以 LLM 在 Pod 上作为单独的服务器运行（vLLM、llama.cpp 或 Ollama）；和以前一样，在那个 Pod 上勾选 LLM / vLLM 并填写它的端口。

## 🖥 你的自定义节点上 Pod，以及 Pod 在做什么 (2.763.1)
<!-- en: your-custom-nodes-on-a-pod-and-what-the-pod-is-doing-2-763-1 5d518be0fbb3 -->

- **渲染在等待它的 Pod 时**，状态栏上方的一行会说明正在发生什么：启动 Pod、重新创建它、等待它的 ComfyUI、把风格的文件和节点包放上去，或者在等你回答 Pod 的询问。任务日志的 [pod] 行记录每一步。
- **无法使用的 Pod 会停止渲染**，原因写在日志里 - 不会再改到别处去渲染。在 Pod 的询问中按 Cancel 会取消这次渲染。
- **Basic Settings ▸ GPU ▸ Both：** 有自己 Pod 的风格，或其类型在某个 Pod 上被勾选的风格，会送到那个 Pod。其他风格在没有勾选
  Image（或 Video）时在这台电脑上渲染 - 任务日志会说明这一点以及怎样改变。
- **你的自定义节点会上 Pod：** bitGen 为风格创建的 Pod 会装上这台电脑 ComfyUI 的所有自定义节点包，然后重启它的 ComfyUI。来自 GitHub（或其他 git 地址）的包会在 Pod 上按你现有的同一版本 clone；其他包 - 以及 Pod 无法 clone 的包，比如私有的 -
  会在这里打成 zip（不含 __pycache__ 和超过 50 MB 的文件）并上传。Pod 上已有的包保持不动，你停用的包（.disabled）不会发送。
  🖥 My pods 中 Pod 项目里的 **⬆ My custom nodes** 可以对任何 Pod 做同样的事。
- 当风格需要 Pod 上没有的节点时，bitGen 会问这台电脑的 ComfyUI 这个节点来自哪个包，并发送那个包。重启时如果 Pod 有
  ComfyUI-Manager 就用它，否则由 RunPod 重启 Pod。
- **2.763.2：** 送到 Pod 的渲染不再先启动这台电脑的 ComfyUI，也不再拿风格对照它的模型列表 - 渲染会立即发送（以前可能还没到
  Pod 就在这台电脑上失败）。渲染失败时，说明原因的行（[pod]、[gpu]、错误）会显示在日志的“that one failed”之后。

## 🖥 没有 Pod 的风格会打开 PODS 停靠窗 (2.763.3)
<!-- en: the-pods-docker-opens-for-a-style-with-no-pod-2-763-3 b989403c9906 -->

- **用没有 Pod 的风格按 Generate**，现在会打开 🖥 PODS 停靠窗（取代小询问框）。横幅说明正在等待的渲染，创建表单已经在 RunPod 的
  “ComfyUI CUDA 13”模板上打开，**Style** 和它的类型（**For**：Image、Image edit 或 Video）、bitGen 推荐的 GPU（显存足够放下风格模型的最便宜的一个）、**GPUs** 1 和磁盘都已填好。改好 GPU、GPU 数量、云或磁盘后按 **Create pod**：风格会关联到新 Pod，这个 Pod
  成为该类型的 Pod，Pod 加载完并有了风格的文件后渲染就会送过去。
- **或者使用你的某个 Pod：** 渲染等待时，🖥 My pods 中每个 Pod 都会显示 **▶ Use for <风格>**。▶ Start、⏹ Stop 和 Terminate 照旧。横幅里的 **Cancel the render** 会取消这次渲染。
- **渲染现在能到达 Pod：** RunPod 的代理因为渲染 worker 的自我介绍方式，用“HTTP Error 403: Forbidden”拒绝了渲染；现在它会报出自己的名字。实时步数也能通过 Pod 的 https 地址显示。
- **会等待风格的文件：** Pod 上的下载会一直跟进到完成。如果风格需要的文件仍不在 Pod 上，渲染会停止，日志写出那个文件 - 不会送到无法渲染它的 Pod。

## 🖥 PODS 停靠窗：Pod 在做什么，以及创建前的全部细节 (2.763.4)
<!-- en: the-pods-docker-what-a-pod-is-doing-and-every-detail-before-it-is-made-2-763-4 da94d08fd734 -->

- **Pod 有多忙：** 在 🖥 My pods 中，每个运行中的 Pod 名字旁会显示 GPU 负载和 GPU 显存占用的条。打开 Pod 可以看到全部：GPU、显存、
  RAM、CPU 和两个磁盘（容器磁盘和 /workspace）。停靠窗在屏幕上时每几秒更新一次。
- **Create pod 前的全部细节：** 表单列出 Pod 将会是什么 - 模板和它的镜像、GPU 和数量（总显存）、每小时价格、云、两个磁盘、CUDA 13
  主机、端口、它渲染的风格和负责的类型，以及加载后会放上去的东西（这台电脑的自定义节点、风格的文件）。表单的每次改动都会更新它。
- **会选上提示词停靠窗的风格：** 停靠窗的风格下拉列表（For、Style 和 Pod 的 Styles）从提示词停靠窗为 Generate 模式选中的风格开始。
- **已不存在的 Pod 不会自己重建：** 风格的 Pod 在 RunPod 上不存在时，渲染会打开 PODS 停靠窗，说明 Pod 已不存在，并按旧 Pod 的方式（RunPod 还列出时用它的模板、GPU、数量、云、磁盘）填好新 Pod - 检查后按 Create pod，或使用你的某个 Pod。
- **从这台电脑发送文件现在可以了：** bitGen 在发送时给文件用了隐藏的名字，所以 RunPod 的 Jupyter 拒绝了上传（“refused part 1 (HTTP
  400)”）；现在用普通的名字。这包括 Override style 的 checkpoint、LoRA 以及从这台电脑发送的自定义节点。大的 checkpoint 需要的时间取决于你的上传速度。

## 💲 RunPod 停靠窗，以及你自己的停靠窗里的停靠窗 (2.763.5)
<!-- en: the-runpod-docker-and-dockers-inside-your-own-dockers-2-763-5 2c4460344be1 -->

- **💲 RunPod 停靠窗：** 一个独立的停靠窗，显示你的 RunPod 余额、当前支出以及按此支出余额还能用多久、你的支出上限、你的 Pod 的费用（正在运行、今天、本月、每个 Pod - 已终止的 Pod 只要还在账单上也会显示），以及 RunPod 的 GPU 价格（Secure 或 Community 云、显存、每小时价格、空闲数量、一个 Pod 最多可用的数量；可以搜索，并按价格、显存或名称排序）。用 Basic Settings ▸ GPU 或 PODS 停靠窗里的 💲 RunPod 打开。它在屏幕上时每分钟查询一次，🔄 立即查询。
- **费用行离开了 Basic Settings：** GPU 下面的 💲 行（2.761.0）现在在 💲 RunPod 停靠窗里。
- **你自己的停靠窗可以放入其他停靠窗：** 用 ⊞ Docker configs ▸ ▣ New docker… 创建的停靠窗（浮动的，或限定在某个停靠窗内的）现在可以放入 PODS、💲 RunPod、Basic Settings、LLM tokens 和其他停靠窗口 - 按住标题栏拖到它上面，在橙色线处松开 - 想放几个都行，作为标签页或并排。拖动主停靠窗的标题栏也能放进去。重启后它们仍在里面。
- **浮动对话框始终在停靠窗前面：** PODS、💲 RunPod、Basic Settings、💬 Community 等浮动对话框始终在 ▣ 停靠窗和你自己的停靠窗前面，即使你点了某个停靠窗也是如此。限定在另一个停靠窗内的停靠窗不再盖住它们（以前它被放在所有东西上面）。要操作下面的东西，请把对话框移开或停靠它。
- **从这台电脑发送的自定义节点：** 节点文件夹一次打包一个文件，所以打包大文件夹时 bitGen 仍可继续工作；权重、声音和压缩包原样存放，包里的 Python 环境会被排除（Pod 会自己安装）。日志显示进度：已打包的文件数，然后是发送的每一部分及其大小。超过 2 GB 的包不会上传，日志会说明原因 - 请用 git 放到 Pod 上，或把它变小。

## 📦 Pod 预设，以及一个 Pod 上的多个风格 (2.764.0)
<!-- en: pod-presets-and-several-styles-on-one-pod-2-764-0 9bea0fb613b7 -->

- **多个风格共用一个 Pod：** 一个 Pod 能放下磁盘装得下的任意多个风格 - 每次只加载一个风格的模型，所以切换风格后的第一次渲染会稍慢一些。
- **用没有 Pod 的风格点 Generate：** 会打开一个框，列出你的 Pod - 每个的 GPU、是否在运行、每小时价格、已有的风格，以及它的 GPU 显存是否够这个风格用 - 每个都有 ＋ <风格>：风格放到那个 Pod 上（先发送它的文件；已停止的 Pod 会被启动），渲染就发到那里。RunPod 上当前没有 Pod 的预设也会列出：＋ <风格> & ▶ 会加入风格并创建 Pod。Create pod… 打开 PODS 停靠窗的表单，已为该风格填好；Cancel render 取消这次渲染。这个框只在你点 Generate 时打开。
- **📦 Presets 标签（🖥 PODS）：** 每个预设是你的 bitGen 文件夹里的一个文件 runpod/pods/presets/<名称>.pod，包含模板、GPU、GPU 数量、云、两个磁盘、CUDA 13 主机、类型和风格。每个都是可展开的条目：可编辑任何细节，✕ 移除风格，＋ Add a style 添加风格，然后 💾 Save changes。风格会立即应用到运行中的 Pod；GPU、模板和磁盘在下次创建 Pod 时生效。
- **标题栏：** ▶ 启动 Pod（已终止的会按全部细节重新创建，并放上所有风格的文件 - 工作流、模型、文本编码器、VAE 和 LoRA - 以及你的自定义节点）；⏹ 停止它（GPU 费用停止，/workspace 保留）；🗑 终止 Pod - 上面的一切都会被删除，预设保留，所以 ▶ 能重新创建；✕ 删除预设（Pod 保持原样）。🗑 和 ✕ 会先确认。
- **细节下方：** 启动时的加载步骤（创建、Pod 加载、ComfyUI 启动、你的自定义节点、每个风格的文件、就绪 - 未完成的步骤会说明原因）、Pod、每小时费用、已用时数，以及该预设所有 Pod 的总费用（附本月 RunPod 账单）。
- **GPU 没有空闲时：** ▶ 会列出当前空闲、显存相同或更多的 GPU - 选一个，预设会记住它。
- **创建预设：** 为风格创建的 Pod 会自动保存为预设；🖥 My pods 里任何 Pod 都可 💾 Save as preset；＋ New preset 从头开始。在任何地方把风格放到预设的 Pod 上，它也会加入该预设。

## Basic Settings ▸ GPU 选 Local 时不显示远程内容；发送到 Pod 的模型会显示进度 (2.764.1)
<!-- en: basic-settings-gpu-on-local-shows-nothing-remote-a-model-sent-to-a-pod-shows-how 3bd1ca6e3b99 -->

- **Local 很简洁：** 选 Local 时，Basic Settings ▸ GPU 只显示 Local · Remote · Both 和「Every job runs on this computer.」- Remote servers 和 RunPod 选项、☁ Remote generation docker、🖥 PODS、💲 RunPod 和 ⚙ Settings ▸ Remote generation 都会隐藏，选 Local 时 Remote generation、PODS 和 💲 RunPod 停靠窗会关闭。
- **Remote 和 Both 会重新显示它们。** 尚未设置任何东西时选 Remote（或 Both）会等待：选项会显示出来，让你选 RunPod ▸ Pods（或在 Settings ▸ Remote generation 里设置一个），一旦有可渲染的地方就会保存。
- **等待 Pod 的渲染会说明原因：** 这时 Queue 卡片不再显示「waiting for the GPU」，而是显示 Pod 正在做什么：启动、加载、放入你的自定义节点、在 Pod 上下载文件，或者从这台电脑发送模型以及进度：「sending model.safetensors to the pod - 1.2 GB of 6.5 GB (18%) · 3.4 MB/s · about 26 min left」。状态栏上方的那一行和任务日志也会显示同样的内容。

## Pod 上只放你的工作流用到的自定义节点 (2.764.2)
<!-- en: only-the-custom-nodes-your-workflows-use-go-on-a-pod-2-764-2 77997c358c1e -->

- **不再是所有自定义节点：** Pod 只会得到其风格的工作流用到、而 Pod 上没有的自定义节点包 - 从这台电脑的 ComfyUI 查找（每个节点来自哪个文件夹），按相同版本 clone 或上传。为风格创建的 Pod、预设的 ▶ 以及加到 Pod 上的风格都这样做；没有任何工作流用到的包会留在这里。
- **⬆ Nodes its styles need**（🖥 My pods ▸ 某个 Pod）会放入该 Pod 的风格的工作流用到的包 - 请先把风格放到 Pod 上。
- **日志会说明每一步：** 小包以 KB 显示大小，接着是「<包> is on the pod」、「asking the pod to unpack and install …」和「installing <包> on the pod (1 of 2 done, 40 s)」。如果 Pod 3 分钟内无法汇报安装结果，这一步会带着原因结束，而不是一直等待。
- **预设的加载步骤**每个风格一步 - 它的节点和文件。

## 风格的自定义节点来自它们的 git 地址 (2.764.3)
<!-- en: a-style-s-custom-nodes-come-from-their-git-address-2-764-3 aa3fc9b6498d -->

- **在 Pod 上 clone，不从你的电脑发送：** 风格的工作流需要的节点包会从它的 git 地址在 Pod 上 clone（从 GitHub 到 RunPod 很快）。用 git 安装的包会按相同的提交 clone。这里没有 git 检出的包会先查找 - bitGen 自己的节点列表、它的 pyproject.toml、你电脑上 ComfyUI-Manager 的节点列表、Comfy Registry - 有版本标签时按该标签 clone（否则用最新的，日志会说明）。位于更大仓库里的包（例如 ComfyUI-H3-NativeAudioLock）会 clone 到旁边再链接进来。
- **只有在别无他法时才上传：** 哪里都找不到地址的包（你自己做的）、单个 .py，或 Pod 无法 clone 的包（私有仓库）会从你的电脑上传 - 日志会写出它的名字和原因。

## 加入社区：为什么要邮箱验证码 (2.764.4)
<!-- en: joining-the-community-why-the-email-code-2-764-4 79acd925f991 -->

- **使用或下载 bitGen Studio 不需要成为会员** - 只有在社区里交流（Help 房间、聊天和好友，以及无需等待管理员审核就在 Discussions 发帖；游客仍可在那里发帖，需管理员批准）才需要成为会员。
- **新会员需确认邮箱地址** - 用发送到邮箱的 6 位验证码。这是为了防止垃圾注册，并确认加入的是真实的人。在输入验证码之前，新账户可以登录，但不能发帖、聊天或加好友；从未确认的账户会在一周后删除。💬 Community 和网站的加入表单都会这样说明。

## 把停靠窗停靠到另一个停靠窗的上方或下方；浮动停靠窗保持在前 (2.764.5)
<!-- en: dock-a-docker-above-or-below-another-one-floating-dockers-stay-in-front-2-764-5 44568c4752df -->

- **上方或下方：** 把浮动停靠窗拖到你的停靠窗里的某个停靠窗上（并排的，或正在显示的标签）- 靠近它的上边缘时，会沿上边缘出现一条橙色条，靠近下边缘时沿下边缘出现。松开后两者会在那里上下堆叠（一个以两者命名的新纵向停靠窗 - 可用 ⚙ 改名）；其他停靠窗仍在旁边。这在浮动停靠窗和停靠在主列中的 ▣ 停靠窗里都有效，适用于主停靠窗、Basic Settings、PODS 和其他停靠窗口。
- **放进堆叠：** 在纵向停靠窗上，橙色条会出现在其中的停靠窗之间 - 在那里松开即可放到它们之间。靠近左右两侧时则改为放在堆叠旁边。停靠窗的中间仍像以前一样并排或作为标签添加。
- **浮动停靠窗在前：** 浮动停靠窗总是显示在停靠于停靠窗内的停靠窗前面，即使你点了那个停靠的也一样；浮动对话框（Basic Settings、PODS、💬 Community …）则显示在两者前面。

## Pod 下载停在 0% 的问题与受限模型 (2.764.6)
<!-- en: pod-downloads-that-stop-at-0-and-gated-models-2-764-6 4e8cd9219de2 -->

- **下载会继续：** 自 2.763.4 起，Pod 的下载和节点安装可能在开始后立即停在 0% / “installing”。现在它们在 Pod 上作为独立任务运行，即使 bitGen 关闭了与 Pod 的 Jupyter 的连接，也会完成。
- **受限模型会提示：** 在 Pod 下载 Hugging Face 文件之前，bitGen 会先询问 Hugging Face 是否允许下载。受限的文件（未接受其许可，或没有 Hugging Face 令牌）或已不存在的文件不会开始下载——渲染的 Pod 备注、日志和 ⬇ Models 会说明是哪个文件以及该怎么做：在 huggingface.co 打开它的页面并接受许可，然后在 设置 ▸ Models 中添加你的 Hugging Face 令牌。Krea-2 不是受限模型。
- **任务停止或没有数据：** 3 分钟没有数据的下载会在进度条旁边提示；被 Pod 停止的任务（90 秒没有响应——Pod 重启或内存不足）会带着原因标记为失败，而不是一直等待。

## 把检查点和 LoRA 从 Civitai 直接下载到 Pod (2.765.0)
<!-- en: checkpoints-and-loras-from-civitai-straight-onto-the-pod-2-765-0 9977a8886567 -->

- **在 Civitai 上找到就由 Pod 下载：** 当 Pod 需要本机的检查点或 LoRA 时（风格的模型、Override 风格的检查点、重新启动的预设），
  bitGen 会先在 Civitai 上查找完全相同的文件。找到后由 Pod 从 civitai.com 或 civitai.red 下载——比从你的电脑发送快得多。只有在 Civitai 上没有，或 Pod 无法获取时，才从本机发送这个文件。
- **查找方式：** 如果它在 Model manager 中的卡片（🔎 Civitai 查询）记有 Civitai 版本，就用这个版本；否则 bitGen 会读取文件一次得到它的 SHA-256（保存在卡片中，所以只有第一次需要一点时间），再向 Civitai 查询。只使用 SHA-256 相同的文件——绝不使用不同的版本或大小。
- **civitai.red：** 先查询在 设置 ▸ General ▸ Civitai 中选择的站点，再查询另一个；成人模型在 civitai.red 上，需要你的
  Civitai API 密钥。密钥只随 Pod 的下载发送给 Civitai，不会保存在 Pod 的文件列表中。
- 渲染的 Pod 备注会显示 “the pod is downloading <文件> from civitai.red - 1.2 of 6.5 GB (18%) · 45 MB/s”；如果 Civitai 拒绝（没有密钥、civitai.com 上的成人模型等），会说明原因并改为从本机发送。

## 远程模型：你的 Pod 使用的模型列表、勾选的 Pod 和每次传输的进度条 (2.766.0)
<!-- en: remote-models-the-list-your-pods-use-ticked-pods-and-a-bar-for-each-transfer-2-7 53f683009124 -->

- **列表：** runpod/pods/remote_models.json 记录你的 Pod 使用的模型——每个模型的标签和分组（“Krea raw”、“Krea”）、ComfyUI
  文件夹和文件，以及 Pod 下载它的链接（Hugging Face、Civitai、你自己的 Hugging Face 仓库或任何链接）。列表会自动填充：你的
  Pod 使用的风格、在 Civitai 上找到的模型、上传到你的 Hugging Face 仓库的模型、远程模式下的 Civitai ⤓。其中从不写入密钥或令牌。
- **远程模式：** 在基本设置中打开远程生成并选择 RunPod Pod 时，Model manager 和基本设置的 Override 下拉框（检查点和 LoRA 行）列出的是这些模型，而不是本机的模型。选择某个 Pod 还没有的模型时，Pod 会在渲染前从其链接下载。本地模式与以前相同。
- **勾选 Pod：** PODS ▸ My pods 中每个 Pod 名称左侧都有一个复选框——可以勾选任意多个。在 Model manager 中按模型卡片上的 ⇪，会把它发送到所有勾选的 Pod；卡片上的 ✓ 数量表示有多少个 Pod 已有它。
- **硬盘上没有链接的模型：** Model manager ▸ ＋ From this computer…——搜索它并按 ⇪ Add。bitGen 会先在 Civitai 上查找完全相同的文件；如果没有，就把它上传一次到你自己 Hugging Face 账户的私有仓库（<你>/bitgen-models——需要在 设置 ▸ Models 中填入可写的
  Hugging Face 令牌），之后每个勾选的 Pod 都会在几分钟内从那里下载。没有这样的令牌时，会从本机发送到每个勾选的 Pod（较慢）。渲染需要你的某个模型到 Pod 上时，也会自动这样做。
- **＋ Link…** 添加一个下载链接及其文件夹；**↻ My styles' models** 添加你的 Pod 使用的风格的文件。
- **每次传输的进度条：** PODS 停靠窗和 Model manager 会显示每次传输——Pod 下载、本机发送到 Pod、文件上传到你的 Hugging Face
  仓库、为在 Civitai 上查找而读取一次的文件——都带有百分比、大小、速度和剩余时间；失败的显示为红色并说明原因。✕ Clear 移除已完成的。
- 渲染的 LoRA（包括 Override 的临时 LoRA）现在也以同样方式送到 Pod；无法获取的 LoRA 会提示，渲染继续进行。

## 发送到忙碌的 Pod、远程模式下的 Override、Civitai 筛选 (2.766.1)
<!-- en: sending-to-a-pod-that-is-busy-override-in-remote-mode-civitai-filters-2-766-1 563341eafc87 -->

- **“the pod's ComfyUI is not answering yet”：** bitGen 现在会找到 Pod 的 ComfyUI 实际响应的端口（已知的端口、8188，然后是从
  RunPod 获取的 Pod 自己的端口）并记住它。暂时忙碌的 Pod（正在加载模型）最多等待 3 分钟——进度条下显示“waiting for the pod to
  answer”；已停止的 Pod 会立即提示（请先 ▶ 启动它）。ComfyUI 忙碌但 Pod 的 Jupyter 有响应时，下载照常进行。
- **远程模式下的 Override：** Override 风格的检查点和 LoRA 之前是在设置的端口而不是 Pod 自己的端口上检查的——现在会送到渲染使用的 Pod。
- **Civitai 筛选（Model manager ▸ Civitai）：** 全部 / 检查点 / LoRA（以及其他类型：VAE、Embedding、ControlNet、Upscaler）、模型系列——某个系列的全部基础模型（All Krea = Krea 2 + Flux.1 Krea、All Flux 等）或只选一个，来自 Civitai 自己的列表——排序方式（评分最高、下载最多、点赞最多、最新）和时间段（全部时间 … 今天）。更改后立即重新搜索，筛选条件会被保留。

## 基本设置中的本地 / 远程会切换整个应用 (2.766.2)
<!-- en: local-or-remote-in-basic-settings-switches-everything-over-2-766-2 ba005cdf9124 -->

- **本地**（基本设置 ▸ GPU）：本地模式——模型列表和文件夹筛选再次显示本机的模型文件夹，并检查本机的 ComfyUI：未运行就启动。其他一切照旧。
- **远程**（RunPod Pod）：远程模式——停止 bitGen 在本机启动的 ComfyUI（你自己启动的会保持打开，bitGen 会提示），模型列表显示
  runpod/pods/remote_models.json 中的模型，文件夹筛选改为显示它们的模型系列（Krea、Flux、Pony 等）而不是文件夹——选一个就只看该系列。Model manager 的标签页也显示系列。
- 发生了什么会显示在选项下方（“Local mode - starting ComfyUI on this computer”、“Remote mode - ComfyUI on this computer was
  stopped”），页面上的列表会立即切换。

## Pod 的 ComfyUI 能看到的文件，以及更新 Pod 上的旧版 ComfyUI (2.766.3)
<!-- en: files-the-pod-s-comfyui-can-see-and-an-old-comfyui-on-the-pod-updated-2-766-3 982742c31a2e -->

- **已下载却显示 “not on it”：** 有些 RunPod 模板把模型放在 ComfyUI 文件夹之外（extra_model_paths.yaml、--base-directory）。
  bitGen 现在会询问 Pod 的 ComfyUI 从哪里读取每种模型，并把文件放在那里；已经下载到旧位置的文件会被移动，而不是再下载一次。
- **Pod 上的旧版 ComfyUI：** 当风格的工作流使用了新版 ComfyUI 内置的节点（例如 Qwen Image 2.1 的 TextEncodeQwenImage21）时，会在渲染前更新 Pod 的 ComfyUI——git pull、requirements，然后重启 ComfyUI。渲染的 Pod 备注会显示每一步。如果 Pod 的
  ComfyUI 是其主进程，更新会完成，但需要重启 Pod（PODS ▸ My pods）——会提示。不是 git 检出的 ComfyUI 不会被改动——请用
  ComfyUI-Manager 更新。

## 仍缺少节点的 Pod 会先停止渲染 (2.766.4)
<!-- en: a-pod-that-still-lacks-a-node-stops-the-render-first-2-766-4 73e18970a946 -->

- 当 Pod 的 ComfyUI 仍缺少风格的工作流所用的节点时（ComfyUI 无法更新，或是 bitGen 不知道的节点包），渲染会在发送之前停止并说明原因，而不是在 Pod 上失败。下一次渲染会再次尝试准备 Pod。
- 刚放到 Pod 上的文件，在判定缺失之前会再查找一次（最多 30 秒）。

## 远程模式下的 LLM、Vision LLM 和视频风格 (2.767.0)
<!-- en: the-llm-vision-llm-and-video-style-in-remote-mode-2-767-0 d7a56c38ddd6 -->

- **LLM 在哪里运行：** 基本设置 ▸ GPU（远程或两者）新增两行——**LLM** 和 **Vision LLM**——各自可选本地、OpenRouter 或 RunPod：
  - **本地**——本机的 llama-server，与以前相同。
  - **OpenRouter**——OpenRouter 的模型；直接在那里从可搜索的列表中选择（设置 ▸ Remote generation ▸ 🧠 LLM ▸ OpenRouter 中也有搜索框）。**推理**是开启的：模型在回答前先思考，它的思考（reasoning_details）会在聊天的下一轮原样传回给它。要关闭，在那里取消勾选“推理”。
  - **RunPod**——Pods 模式下：你的 Pod 运行与 LLM / Vision 下拉框相同的 GGUF。第一次按 Enter 发送提示时，bitGen 会在 Pod 上完成设置，提示会等待：为 Pod 的 GPU 编译 llama.cpp（只一次——保存在 /workspace），下载 GGUF（以及视觉模型的 mmproj），给 Pod 的
    ComfyUI 加一个小路由（ComfyUI 重启一次），然后启动服务器。这两行会显示进度。bitGen 没有链接的 GGUF 会上传一次到你的私有
    Hugging Face 仓库。Serverless 模式下：RunPod 的 vLLM 端点（设置 ▸ Remote generation）。
- **视频风格：** 选择远程时（以及更改视频风格时），所选视频风格的模型、LoRA 和节点包会在后台放到其 Pod 上——每个都有进度条——
  这样第一个视频不必等待它们。
- 远程模式下 LLM 在 RunPod 或 OpenRouter 上时，更改 LLM 下拉框不再在本机加载它。
- **⬆ Update ComfyUI**（PODS ▸ My pods，每个 Pod 上）：立即把 Pod 的 ComfyUI 更新到最新版本——git pull（固定或修改过的检出会切换到 ComfyUI 自己的 master）、requirements、重启 ComfyUI——并显示进度。失败的自动更新会在下一次渲染时重试并说明原因（附 Pod
  日志的末尾）；更新成功但仍缺少节点时，bitGen 会提示重启 Pod。

## 远程选项移到专用停靠窗，以及远程模式下提示停靠窗的模型列表 (2.768.0)
<!-- en: remote-options-in-their-docker-and-the-prompt-docker-s-model-lists-in-remote-mod 4482a95f5b9d -->

- **基本设置 ▸ GPU** 现在只保留本地 / 远程 / 两者、说明每类任务在哪里运行的一行，以及
  **☁ Remote generation docker**。远程工作的其他选项都在该停靠窗中：远程服务器（RunPod / OpenRouter）、
  RunPod Serverless / Pods、“两者”的复选框、**LLM** 和 **Vision LLM** 两行（本地 / OpenRouter / RunPod）以及 💲 RunPod。在尚未设置任何内容时选择远程或两者，会打开该停靠窗，你可以在那里选择 RunPod ▸ Pods。
- **远程模式下提示停靠窗的 LLM 和 Vision 列表**显示远程主机的模型，而不是本机上的 GGUF：
  - **OpenRouter**（未选择时的默认）- OpenRouter 的**免费**模型；Vision 列表显示能接收图片的免费模型。列表无需密钥即可加载，但发送提示需要你的 OpenRouter API 密钥（可免费创建）- ☁ Remote generation ▸ ⚙ 设置 ▸ Remote generation ▸
    🧠 LLM ▸ OpenRouter。
  - **RunPod（Pods）** - bitGen 能放到你的 Pod 上的 GGUF；你选择的模型会在下次发送提示时在 Pod 上完成设置。
  - **RunPod Serverless** - vLLM 端点的模型。选择模型后即保存，不会在本机加载任何内容。切换回本地后，列表会再次显示本机的模型（设置 ▸ LLM 始终列出它们）。
- Pod 上的 **⬆ Update ComfyUI** 现在用与 Pod 上 ComfyUI 相同的 Python 安装 ComfyUI 所需的软件包，某一步失败时会显示真正的错误。

## 新 Pod 的 ComfyUI 自动更新，查找缺失的文件 (2.769.0)
<!-- en: a-new-pod-s-comfyui-is-updated-automatically-missing-files-are-looked-for-2-769- 3372ac8da65e -->

- **bitGen 创建的 Pod**（PODS ▸ Create pod，或某个风格需要的 Pod）在首次加载时会**自动更新一次 ComfyUI** - 与
  ⬆ Update ComfyUI 相同。发送到新 Pod 的渲染会等待它（任务行显示“updating ComfyUI on the new pod first”），
  PODS ▸ My pods 中的该 Pod 上也会显示。已是最新的 ComfyUI 保持运行 - 不重新安装，也不重启。要关闭此功能，在配置的 `rgpu` 下设置 `"pod_comfy_auto": false`。
- **⬆ Update ComfyUI** 每个版本只安装一次 ComfyUI 所需的软件包，只有在代码比正在运行的更新时才重启 ComfyUI。
- **下载后没有出现的文件：** 当 Pod 上的 ComfyUI 仍未列出某个文件时，bitGen 会在 Pod 上查找它。在 ComfyUI 读取的文件夹之外找到的文件会被链接到正确的文件夹。否则任务行会说明原因：只下载了一部分（下载已停止）、Pod 上任何地方都没有、在正确的文件夹中但未被列出，或 Pod 上的 ComfyUI 没有返回其模型或节点列表。

## bitGen 创建的 Pod 自行完成设置 (2.769.1)
<!-- en: pods-bitgen-makes-set-themselves-up-2-769-1 492f1ce22c85 -->

- **bitGen 创建的 Pod 会被记录为 bitGen 的** - 记录在本机和 Pod 本身上（RunPod 会保留该标记），因此即使重新安装后也能识别。PODS ▸ My pods 中会标上 🅱。
- **加载后自行完成设置** - 无需渲染或按按钮：更新其 ComfyUI，为关联的风格放好文件和节点包，如果还没有正在使用的 Pod，它就成为正在使用的 Pod。My pods 中它的一行会显示进度。如果 Pod 加载时 bitGen 被关闭，下次启动 bitGen 时会继续。
- **⬆ Update ComfyUI** 现在更新实际正在运行的 ComfyUI（通过它应答的端口找到），而不是 Pod 上的另一个副本，并重启它。自动更新失败时会再试一次（最多 3 次）。
- Pod 任务的错误行现在显示完整的原因，关于缺失文件的信息排在最前面。

## “还没有 Pod”对话框只列出现有的 Pod (2.769.2)
<!-- en: only-your-live-pods-in-the-no-pod-yet-box-2-769-2 a4bd9629c6e8 -->

- 用没有 Pod 的风格渲染时，询问使用哪个 Pod 的对话框现在**只列出 My pods 中的 Pod** - 运行中或已停止的。已终止（或正在终止）的 Pod，以及其 Pod 已不存在的预设，不再在此列出；🖥 PODS ▸ 📦 Presets 仍可重新创建预设的 Pod。如果 RunPod 没有返回你的 Pod 列表，对话框会说明原因。

## LLM 本地 / 远程、OpenRouter 列表和 ☰ All (2.770.0)
<!-- en: llm-local-remote-openrouter-lists-and-all-2-770-0 4ceef016ab55 -->

- **☁ Remote generation 停靠窗：** LLM 和 Vision LLM 现在只有 **本地** 或 **远程**。远程使用 设置 ▸ Remote generation ▸
  🧠 LLM 中选择的平台 - 默认 OpenRouter，或 RunPod。在 RunPod 上渲染不再把 LLM 也移过去。
- **设置 ▸ Remote generation ▸ 🧠 LLM ▸ OpenRouter：** **Show free** 和 **Show paid** 决定列表提供哪些 OpenRouter 模型（付费模型显示每百万 token 的价格）。
- **提示停靠窗（远程模式）：** LLM 和 Vision 列表 **每次显示 10 个模型** - 在每个列表前的 🔍 框中输入即可搜索（名称、作者、free、paid、vision）。**☰ All** 在对话框中打开所有 OpenRouter 模型：搜索，Free / Paid / 👁 Vision 筛选，按名称、价格、上下文或最新排序，以及每个模型的详情。选择一个，选择 LLM 或 Vision LLM，然后按 **Use** - 列表切换到该模型并使用它。
- **不列出任何节点的 Pod ComfyUI**（通常是缺少所需软件包的新代码）会在渲染前被修复：安装其所需软件包并重启。Pod 的原因每行写一项，不会被截断。

## 提示
<!-- en: tips 29dfdc949d42 -->

- **标签胜过描述**——在提示词中写 `@anna`，会自动带上 Anna 的角色设定图和声音。
- 当起始帧中没有出现人脸时，**Cont** 在切换镜头后保持角色一致的效果比 **First** 好得多。
- **Free VRAM before every generation**（每次生成前释放显存；位于 Settings → ComfyUI）可在混合生成图像、音乐和视频时避免大多数显存不足的错误。
- 将鼠标悬停在任何元素上——每个按钮都有工具提示。熟悉操作之后，可在
  Settings → General 中开启 *Expert mode*（专家模式），隐藏帮助段落。
- 渲染失败时，其场景卡片和 Queue 日志中总会说明原因。


<!-- credits:start -->

## 致谢
<!-- en: credits 3eaf20d85f70 -->

**出品与开发：Tim Paul**

**程序员：Claude Opus 5.5**

bitGen Studio——本地 AI 视频、图像、音乐和剪辑工作室。一切都在你自己的电脑上运行：无需注册，无需云端。

bitGen Studio 建立在许多人的成果之上。感谢以下所有人——我们使用或借鉴了这些项目的代码、模型、创意和工具。

### 生成引擎

- **[ComfyUI](https://github.com/Comfy-Org/ComfyUI)**（Comfy Org 和 comfyanonymous）——生成引擎——每种图像、视频和音乐风格都以 ComfyUI 节点图运行；工作流的节点图转换沿用了其自身前端的做法
- **[comfy-kitchen](https://github.com/Comfy-Org)**（Comfy Org）——int8 ConvRot 权重布局，已在原生引擎中重新实现（Apache-2.0）
- **[llama.cpp](https://github.com/ggml-org/llama.cpp)**（ggml-org）——本地 LLM（llama-server），为 ✨ Enhance、提示词聊天、剧本和视觉描述生成器提供支持
- **[stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp)**（leejet）——最早的图像和视频后端（sd-cli）
- **[Hugging Face diffusers](https://github.com/huggingface/diffusers)**（Hugging Face）——原生引擎所遵循的 MiniMax H3 权重转换和模块化管线（Apache-2.0）
- **[Hugging Face Hub](https://huggingface.co)**（Hugging Face）——模型文件的来源
- **[FFmpeg](https://ffmpeg.org)**——编译、导出、代理文件以及所有音频 / 视频转换

### 视频模型

- **[MiniMax H3](https://huggingface.co/Comfy-Org/MiniMax-H3)**（MiniMax）——主要视频模型——文本、参考图、首帧 / 尾帧、原生音频
- **[Viggle-Animate](https://huggingface.co/Viggle/Viggle-Animate)**（Viggle AI）——角色动画；其推理代码（Apache-2.0）为原生引擎提供了指引
- **[LTX-Video](https://github.com/Lightricks/LTX-Video)**（Lightricks）——LTX 视频风格和官方模板
- **[Wan](https://github.com/Wan-Video)**（Wan 团队）——Wan 视频风格、摄像机路径（ATI）和 VR 世界
- **SeedVR2**（ByteDance Seed）——放大镜次
- **FastH3 Omni**——用于 MiniMax H3 节点图的 FastH3 配方
- **Veda**——MiniMax H3 的可选稀疏注意力加速器
- **[MiniMax-H3-NativeAudio-MusicVideo-Workflow](https://github.com/Shrek3OnVH5/MiniMax-H3-NativeAudio-MusicVideo-Workflow)**（Shrek3OnVH5）——MMH3_NativeAudio_MV 风格所基于的音乐视频口型同步工作流（MIT）

### 图像模型

- **Qwen Image 和 Qwen Image Edit**（Qwen 团队，Alibaba）——图片风格、✏ Edit、填充以及 Sketcher 的真实照片
- **FLUX.2 和 FLUX 3 Klein**（Black Forest Labs）——图片风格、编辑以及 LoRA 训练底模
- **Krea 2**（Krea）——图片风格（Turbo 和 Raw）
- **FIBO 2.0**（Bria）——Fibo 2.0 Edit 风格
- **Anima、MOSS-Image、SDXL 和 Pony 模型**——更多图片风格
- **SAM 2 (Segment Anything)**（Meta）——Select Subject、贯穿整个镜头的抠像
- **Hunyuan3D 2.1**（Tencent）——🧊 图片转 3D（遵循其自身的社区许可证）
- **TRELLIS.2**（Microsoft）——🧊 图片转 3D
- **[cadrille](https://github.com/col14m/cadrille)**（col14m）——SolidCraft 中的 ✨ Generate 根据描述或图片编写零件代码（权重为 CC BY-NC 4.0）
- **[CadQuery](https://github.com/CadQuery/cadquery)**——运行这些零件代码

### 语言、语音和音乐

- **Qwen3、Qwen3.5、Qwen3.8 和 Qwen3-VL**（Qwen 团队，Alibaba）——推荐的本地 LLM、视觉描述生成器以及微调底模
- **Gemma 4**（Google）——本地 LLM 和微调底模
- **WeVisOne-VL**——视觉附加组件
- **[faster-whisper](https://github.com/SYSTRAN/faster-whisper)**（SYSTRAN）——转录、卡拉 OK 逐字歌词、按转录稿剪辑、语音聊天
- **Whisper**（OpenAI）——faster-whisper 所运行的语音识别模型
- **OmniVoice**——文本转语音和声音克隆
- **[OpenAudio / fish-speech](https://github.com/fishaudio/fish-speech)**（Fish Audio）——最早的文本转语音引擎
- **Ming-3.0 和 Bark**——语音附加组件
- **YuE**——歌曲生成（YuE2），既可作为独立引擎运行，也可在 ComfyUI 中运行
- **[Demucs](https://github.com/facebookresearch/demucs)**（Meta）——分轨分离（人声 / 伴奏）

### 训练

- **[ai-toolkit](https://github.com/ostris/ai-toolkit)**（Ostris）——🎓 LoRA 和检查点（checkpoint）训练器
- **[Unsloth](https://github.com/unslothai/unsloth)**——LLM 和视觉模型微调

### ComfyUI 节点包

- **[ComfyUI-KJNodes](https://github.com/kijai/ComfyUI-KJNodes)**（Kijai）——MiniMax H3 长视频节点以及许多辅助节点
- **[ComfyUI-GGUF](https://github.com/city96/ComfyUI-GGUF)**（city96）——GGUF 模型加载
- **[ComfyUI-VideoHelperSuite](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite)**（Kosinkadink）——在节点图中加载和保存视频与音频
- **[comfyui-inpaint-nodes](https://github.com/Acly/comfyui-inpaint-nodes)**（Acly）——图像编辑器的选区填充
- **[comfyui_controlnet_aux](https://github.com/Fannovel16/comfyui_controlnet_aux)**（Fannovel16）——ControlNet 预处理器
- **ComfyUI-MiniMaxH3Mod、Spectrum-MiniMax-H3、ComfyUI-H3-NativeAudioLock**——角色 RefMod、MiniMax H3 加速、音乐视频的歌曲锁定
- **Nougan Nodes、RH DLSS 5、SolarRenderer**——区域角色 LoRA 和 Prompt Relay、⚡ DLSS 5、☀ 太阳光渲染

### 内置于应用

- **[three.js](https://threejs.org)**——所有 3D 视图（MIT）
- **[opentype.js](https://github.com/opentypejs/opentype.js)**——3D 文字（MIT）
- **[pdf.js](https://mozilla.github.io/pdf.js/)**（Mozilla）——在图像编辑器中打开 PDF（Apache-2.0）
- **[pdf-lib 和 fontkit](https://pdf-lib.js.org)**——保存嵌入字体的 PDF（MIT）
- **[ag-psd](https://github.com/Agamnentzar/ag-psd)**（Agamnentzar）——PSD 文件及其文字效果（MIT）
- **[polygon-clipping](https://github.com/mfogel/polygon-clipping)**——Sketcher 的墙（MIT；另含 splaytree 和 robust-predicates）
- **[replicad 和 OpenCascade](https://replicad.xyz)**——参数化 3D 实体（MIT；OpenCascade 为 LGPL-2.1）
- **jxl-oxide、libjxl 和 @jsquash/jxl**——JPEG XL 的打开和保存（MIT / Apache-2.0 / BSD-3-Clause）
- **[Node.js、Express 和 Multer](https://nodejs.org)**——应用的服务器
- **[Electron](https://github.com/electron/electron)**——桌面应用
- **Python、NumPy、OpenCV、soundfile 和 pyaaf2**——工作进程、跟踪、节拍、声音和 AAF 导出
- **[OpenTimelineIO](https://opentimeline.io)**——时间线交换（OTIO、FCP XML、EDL）
- **[uv](https://github.com/astral-sh/uv)**（Astral）——安装程序所用的 Python
- **ReportLab、pypdf、jsdom 和 Playwright**——指南 PDF 和测试套件

### 3D 模型

- **[女性人体模型](https://www.cgtrader.com/designers/dimasalcalde?utm_source=credit&utm_source=credit_item_page)**（dimasalcalde (CGTrader)）——Sketcher 的 🧍 人体模型（模型）——Furniture 工具中的 People
- **[女性人体模型](https://www.cgtrader.com/designers/zahers?utm_source=credit&utm_source=credit_item_page)**（zahers (CGTrader)）——Sketcher 的 🧍 人体模型（模型）——Furniture 工具中的 People

### 文字效果和字体

- **[Dandyson EEbu (Baridakara)](https://www.facebook.com/dandyson.godspower)**——文字效果和字体

### 与 bitGen Studio 配合使用的程序

- **[Blender](https://www.blender.org)**（the Blender Foundation）——Blender 附加组件：场景和渲染双向互通、3D 图层、姿势
- **[Unreal Engine 和 MetaHuman](https://www.unrealengine.com)**（Epic Games）——bitGen Bridge 插件：Unreal 图层、摄像机、灯光、实时视图
- **[Daz Studio](https://www.daz3d.com)**（Daz 3D）——Daz 桥接和实时链接
- **[SolidCraft](https://solidcraft.io)**（Tangency Labs）——开源参数化 CAD，位于其独立的面板中
- **[Civitai](https://civitai.com)**——模型详情、示例、搜索和下载
- **[RunPod](https://www.runpod.io)**——在远程 GPU 上渲染
- **DaVinci Resolve 和 Final Cut Pro**——时间线的导出和导回

### 创意与灵感

- **[Krita AI Diffusion](https://github.com/Acly/krita-ai-diffusion)**（Acly）——图像编辑器的选区 Generate / Fill / Remove 按模型系列沿用了它的技术
- **Wan2GP 和 mmgp**（deepbeepmeep）——将模型块流式传输到 GPU 的思路（未使用其代码）
- **Sketcher 的家具库**——家具、人物和材质——最初为早期版本的 House builder 制作
- **专业创意工具**——照片编辑器、矢量和绘图程序、视频编辑器、动态图形工具、3D 建模软件和参数化 CAD 程序；图像编辑器、时间线、CAD 工具和 Sketcher 都沿用了它们的工作方式
- **每一位测试 bitGen Studio 的人**——以及告诉我们哪里需要修复的人

bitGen Studio 采用 MIT 许可证。上述每个项目都保留其各自的许可证——misc/NOTICE.md 列出了随软件附带的内容、需要下载的内容以及模型许可证。模型权重由你自行下载，并遵循其制作者的条款。
<!-- credits:end -->
