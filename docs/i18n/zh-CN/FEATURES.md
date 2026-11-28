# bitGen Studio — 功能参考

bitGen Studio 是一款本地离线的 AI 视频与图像工作室：无需账户，不依赖云端，任何数据都不会离开你的电脑。它驱动 ComfyUI 和本地模型（MiniMax H3、LTX 2.5 / 2.3、Wan 2.1 / 2.2、FLUX、SDXL、Qwen Image 等），并由本地 LLM 撰写提示词和剧本，同时把围绕它们的一切集中在一个窗口中：用于电影和音乐视频的场景板、完整的时间线编辑器、带矢量 / CAD / AI 工具的分层图像编辑器、参数化 3D 人体，以及连接 Blender、Daz Studio 和 Unreal Engine 5.8 的桥接。本参考按领域分组，列出了迄今为止的全部功能。

## 工作区

窗口、各个面板、应用外观、项目及其包含的文件。

### 窗口与菜单栏

- **一个窗口容纳所有面板** — 左侧面板（系统状态与设置）、References、Assets、中央面板（Preview、Timeline、StoryBoard、Music、SFX、Image editor、ComfyUI、Prompt、Prompt chat、Console）、Queue 和 Gallery。 *Where:* 主窗口
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
- **🔍 查找任何内容（Ctrl+K）** — 命令面板，覆盖所有面板、浮动窗口、菜单 / 状态栏按钮、Settings 字段、工作区、Generate 模式、风格、指南章节和快捷键；按 Enter 即显示 / 打开 / 执行，指南会在 📖 Help 窗口中打开。 *Where:* Ctrl+K 或菜单栏中的 🔍. *Since:* 2.530.0
- **顶部栏的应用条** — 🖼 图像编辑器（✉ 邮件、▦ 电子表格、🎞 幻灯片推出后加入）| 📐 SolidCraft 📏 Sketcher 作为图标放在工作区和 🔍 之后，移出状态栏；打开时点亮，点击打开 / 关闭。*Where:* 顶部栏。*Since:* 2.817.0
- **🚓 Police Chase - 休息时玩的游戏** — 独立停靠窗中的 3D 迷宫追逐：在夜色城市里驾驶逃逸车，收集每一袋现金，同时躲开四辆警车（每辆追法不同）；📡 干扰器能让局势反转几秒——撞上警车它就回警局。每一关都是新城市。镜头：整座城市或车后视角；方向键 / WASD、游戏手柄或滑动操作；音效即时合成（默认关闭）；最好的十个分数保存在这台电脑上。不打扰工作：隐藏、转到后台或失去焦点时暂停，暂停时不绘制任何内容，渲染进行时以轻量模式运行（或暂停——由你选择）。打开前保持隐藏。*Where:* 顶部栏的 🚓 按钮。*Since:* 2.935.0
- **🚓 Police Chase 美术包** — 游戏可以换上逼真的城市：美术包（由 scripts/chase_assets.py 从你自己的 Blender 城市和道路套件制作）带来有车道线的沥青路、人行道、铺砖的警局广场，以及从你的模型渲染的建筑——每个街区一栋包中的建筑，朝向随机。没有美术包时游戏保持原样。美术包不放进公开仓库，以单独的 zip 提供。*Where:* Police Chase（ext/chasedock/assets）。*Since:* 2.936.0
- **🚓 Police Chase：3D 汽车、汉堡和蛋糕** — 有美术包时，逃逸车和警车是真正的 3D 模型（警车四种颜色，车顶有闪烁的警灯），由 scripts/chase_car.py 精简到适合游戏的大小；要收集的是汉堡，奖励是蛋糕（有没有美术包都一样）。*Where:* Police Chase。*Since:* 2.937.0
- **🚓 Police Chase：火箭筒和警车绝招** — 角落的道具变成 🚀 火箭筒：生效期间警车逃跑，按 Space 发射火箭，可把两个汉堡距离内的警车送回警局。每辆警车各有绝招：Sarge 放置 🚧 路障（火箭可炸开），Cutter 在直路上开 ⚡ 氮气加速，Flanker 铺设钉刺带（压上会减速），Rookie 带 🛡 护盾可挡一发火箭。每辆车都有车头灯，爆炸照亮街道；有美术包时建物带砖墙、玻璃和亮着的窗户。*Where:* Police Chase。*Since:* 2.938.0
- **🚓 Police Chase：场景、现代光照、三种视角** — 迷宫可以是城市、郊区（亮灯的房子、草坪、树篱、路灯）、森林（松树、岩石、萤火虫、土路）或乡村（农田、干草卷、谷仓、筒仓、栅栏、碎石路）——🗺 Auto 每关换一个。电影感光照，月光或夕阳的柔和阴影，发光的车头灯、警灯和路灯。按 V 切换视角：全景、跟随车辆的无人机、驾驶视角。*Where:* Police Chase。*Since:* 2.939.0
- **🚓 Police Chase：爆炸、自动发射、闪避、⚡ 加速道具** — ⛶ 像图像编辑器的 🎨 全屏一样全屏游戏。🚀 发射器会自动向两个车身距离内的警车开火，命中后警车爆炸（火焰、烟雾、飞溅的碎片）；警车会在下一个路口尝试闪避；被抓住时你的车会爆炸。⚡ 加速道具随机出现在道路上，先到者加速。
- **🚓 Police Chase：音乐和音效** — bitGen 在游戏中即时生成的原创街机追逐音乐（没有音频文件）：警车越近节奏越快、越饱满；🚀 发射器期间切换为加强版；暂停时音乐变小并发闷。引擎声随车速变化，急转弯时轮胎尖叫，爆炸声分层（低沉轰鸣、爆裂、噼啪的火焰、碎片），并从屏幕上发生的位置传来。⚙ 可设置音乐和音效音量，以及是否开启声音开始游戏。*位置：* Police Chase。*版本：* 2.943.0
- **🎓 Life Choices：一生的棋盘游戏** — 你和 1-5 个机器人在环形 2D 棋盘上从高中走到退休。高中格子是高三及以上难度的测验、数学题和文字谜题（答对得钱和 IQ，答错三次退学）；之后是大学（大学难度考试、学生贷款）、学徒（每回合一格）或工厂（直接进入投资环）；按 IQ 和资历提供工作、升职、裁员、夜校；收入稳定后可买房产（租客和落在此格的玩家付租金）、股票，银行最多贷款五倍年薪。30、45 或 65 岁退休，净资产 + IQ + 资历决定胜负。边玩边自动保存。*位置：* 顶部栏的 🎓。*版本：* 2.944.0
- **🎓 Life Choices：土地与房屋环** — 投资环外的新环（经土地办公室进入）：可盖房的地块、状况良好的房屋（全额租金）和需要翻新的房屋（便宜、租金少；花价值四分之一翻新后价值提高一半）。建筑商、市政费和 85% 的拍卖；机器人也会购买、建房和翻新。旧存档也会带上这个环继续。*位置：* 🎓 Life Choices。*版本：* 2.945.0
- **🎓 Life Choices：🎲 两颗骰子的运气** — 每回合掷两颗骰子，点数之和就是你这段时间的运气：从双 1（最差）到普通的 6-8，再到双 6（最好，再掷一次）。运气随人生阶段而变：上学时丢了公交卡或收到生日礼物，工作时罚款或退税，在投资环上房产遭风暴、继承遗产或中彩票。在投资环和土地与房屋环上按两颗骰子的总和前进。显示骰子、2-12 运气表和你上一次的点数；机器人也掷骰子。*位置：* 🎓 Life Choices。*版本：* 2.946.0
- **🎓 Life Choices：账单、保险和澳大利亚税** — 开始工作后，每季度的账单逐项列出：拥有住房前的房租、水电燃气、电话、交通、饮食（从自己做饭到常在外面吃）和娱乐（野餐比看电影便宜，度假最贵——娱乐让你的 ❤ 幸福感保持，最后计入得分）。健康、汽车和房屋保险：付保费后，所保范围内的厄运只需付免赔额。工资按 2026-27 年度澳大利亚居民税率计税，含低收入税收抵扣、2% 的 Medicare 税以及无住院保险时的附加税；每年生日报税，可扣除项（1,000 澳元标准扣除，或出租房产的贷款利息、市政费和维修费）带来退税或补税。*位置：* 🎓 Life Choices ▸ 💸 预算、🛡 保险和税。*版本：* 2.947.0
- **🎓 Life Choices：合租和室友运气** — 租房时可以独自住，或合租，房租和账单约减半。合租时同一对骰子还决定室友运气：室友欠租搬走、客厅被派对弄坏、争吵——或一起做饭、电影之夜、成为挚友的室友——影响你的现金和 ❤ 幸福感。*位置：* 🎓 Life Choices ▸ 💸 预算 ▸ 住房。*版本：* 2.948.0
- **🚓 Police Chase / 🎓 Life Choices：按 Esc 回到停靠窗，屋顶点亮** — 按 Esc、🗗 退出或窗口退出全屏（F11）时，两个游戏都会回到各自的停靠窗（追逐暂停）；追逐中每栋楼的屋顶都有淡淡发亮的边缘，比道路稍暗一点（2.950.1），从上方能看清街区，又不抢车辆的视线。*位置：* 🚓 Police Chase、🎓 Life Choices。*版本：* 2.950.0
- **🎓 Life Choices：题目对话框、计算器、中央的骰子** — 题目在棋盘下方的框中打开，旁边有 🧮 计算器（➜ 把结果填入答案框；可拖动该框 - 2.952.0）；两颗骰子落在棋盘中央的圆圈里，显示点数和运气；轮到你时按 Enter 掷骰子（2.952.0）。*位置：* 🎓 Life Choices。*版本：* 2.951.0
- **🎓 Life Choices：轮流游玩与 🧠 LLM 玩家** — 2 到 6 名玩家：在同一台电脑上轮流游玩的真人、按规则行动的机器人和 🧠 LLM 玩家，可任意组合。每位真人的回合开始前会出现“把电脑交给……”画面（按 ▶ 或 Enter 开始——谁也不能替别人掷骰子）。🧠 LLM 玩家的选择（大学、技工或工厂、工作、买房、建房、银行、交易所）由 bitGen 中加载的 LLM 决定——它会得知玩家的处境和可选项，理由记在日志里；在限定时间内（10 / 20 / 45 秒）没有回答，就按机器人的规则行动。每位真人的分数都会进入 🏆。*位置：* 🎓 Life Choices ▸ ▶ 新游戏。*版本：* 2.964.0
- **🔒 本地安全与你的名字** — 设置 ▸ 安全可以在 bitGen Studio 启动时要求输入用户名和密码。仅限本地：以加盐哈希保存在这台电脑上，从不上传，也无需账户。聊天的 LLM（以及 📱 应用的语音）会用你的偏好名字友好地称呼你，Police Chase 的高分榜也使用它。设置 ▸ 安全还可以保存一个可选的电子邮箱，💬 加入社区 会打开社区面板，并用这里的信息填好加入表单（按下加入之前不会发送任何内容）。设置 ▸ 常规可以隐藏启动画面，🚓 Police Chase 的 ⛶ 现在会铺满整个屏幕。
- **Ctrl+P：将提示词面板置于最前** — 在应用中任何地方，包括正在输入框中打字时：提示词面板会打开、展开，从关闭的 ▣ 面板中移出，并显示在浮动窗口或最大化面板之上，焦点置于提示词框。 *Where:* 任何地方，🎨 Full Screen 中也可以（2.646.0）。 *Since:* 2.645.0
- **最后使用的浮动面板在最上面** — 💬 Community、Basic Settings、LLM tokens、▣ 面板、你自己命名的面板、浮动的主面板、舞台面板和语音聊天，在应用其余部分之上共用一个顺序：点击或打开其中一个，它就会到最上面（命名面板不会再遮住 Community）。 *Where:* 每个浮动面板。 *Since:* 2.724.0

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
- **在侧边面板旁最大化** — ⛶ 填满已打开的 Gallery / Queue / References / Assets / 左侧面板之间的空间。 *Since:* 2.538.0
- **工作区** — 菜单栏中的 Workspace 下拉列表：Basic、Image editing、Video editing、Music video、Expert。每个工作区显示该类工作所需的面板，隐藏用不到的按钮（不会禁用任何功能），并记住你自己的改动；↺ 可重置某个工作区。 *Where:* 菜单栏. *Since:* 2.526.0
- **▁ ⛶ ✕ 面板标题栏** — 将浮动面板最小化为标题栏、最大化到整个窗口并可还原，或将其关闭。 *Where:* 每个浮动面板. *Since:* 2.532.0
- **把停靠窗停靠到另一个停靠窗的上方或下方** — 把浮动停靠窗拖到你的停靠窗（浮动的，或停靠在主列中的 ▣ 停靠窗）里某个停靠窗的上边缘或下边缘附近，两者就会在那里上下堆叠；拖到堆叠上时会放到其中停靠窗之间；拖到侧边或中间则像以前一样并排或作为标签添加；浮动停靠窗总是显示在停靠于停靠窗内的停靠窗前面。 *Where:* 你的任何停靠窗（⊞ Docker configs ▸ ▣ New docker…、▣ 停靠窗）。 *Since:* 2.764.5
- **折叠面板** — 侧边面板可折叠为细长的标题条；图像编辑器的面板组可折叠为其选项卡，并可用 ✕ 关闭；View ▸ Dockers 可显示或隐藏每个面板。 *Where:* 面板标题栏中的 ▾；图像编辑器的 View 菜单. *Since:* 2.514.0
- **面板栏可放入任意浮动面板** — 按住标题将浮动面板（用 ⇱ 浮动出来的主面板、▣ 面板、Basic Settings、LLM tokens、提示词面板、⏳ Pending）拖到图像编辑器的面板栏上，即可停靠在此——可从其标题栏折叠、移动、调整大小或再次浮动；下次启动时保留，并随编辑器一起显示 / 隐藏。 *Where:* 图像编辑器的面板栏（Layers 所在处）。 *Since:* 2.609.0
- **▣ 面板可容纳任意面板** — 与其他浮动面板位于同一浮动层（而非置于所有内容之上），拖动面板时会显示轮廓；Settings、References、Assets、Queue、Gallery 和 StoryBoard 可按住标题栏拖入。 *Where:* 状态栏的 ▣ Docker（Ctrl+Alt+D）。 *Since:* 2.558.0
- **▣ 面板可停靠，任何面板都能放入** — 按住标题栏拖动浮动的 ▣ 面板，可将其停靠到某个面板的上方 / 下方 / 旁边，或停靠到侧边面板中（蓝色放置区域）；Basic Settings、LLM tokens 和提示词面板可放入 ▣ 面板，也可再浮动出来。 *Where:* 状态栏的 ▣ Docker（Ctrl+Alt+D）。 *Since:* 2.560.0
- **将 ▣ 面板作为独立的一栏** — 放到两栏之间的接缝处（或窗口边缘）时，它会变成一个全高的栏，并带有自己的分隔条；重启后保留。 *Where:* 按住标题栏拖动 ▣ 面板。 *Since:* 2.561.0
- **面板按离开时的布局恢复** — ▣ 面板的成员、标签顺序、当前显示的标签页、隐藏 / 折叠状态、最小化的浮动面板、扩展面板——重启后都会保留。 *Since:* 2.575.0
- **设置 ▸ 面板** — 列出每个面板和浮动窗口（包括扩展的），显示其所在位置，↺ Reset 可将其恢复到默认位置和大小；↺ Reset all 全部重置。 *Where:* Settings ▸ Dockers。 *Since:* 2.579.0
- **面板开关 + 布局** — 👁 关闭某个面板及其状态栏按钮；🗂 Layouts 可保存 / 应用 / 导出 / 导入整个面板布局及主题（layouts/<name>.json）；★ Save as the default = layouts/default.json + themes/default.json，用于全新安装。 *Where:* Settings ▸ Dockers。 *Since:* 2.587.0
- **💾 面板布局保存每个面板** — ⊞ 面板布局 ▸ 💾 保存布局 会显示已保存（✓ 已保存），并保存每个面板 - 主列中的、扩展的、浮动窗口和命名 ▣ 面板 - 的位置、大小和状态（正常、最小化、最大化、隐藏）；加载会全部恢复。 *Where:* 菜单栏的 ⊞ 面板布局。 *Since:* 2.891.0
- **🧯 窗口会自行恢复** — 桌面窗口崩溃或卡住时，会询问 重新加载 / 重置面板和缓存后重启 / 退出；新版本或没能启动起来的一次启动会清除缓存，连续两次还会重置面板 - 保存在 backups\layout-auto-… 中，记录在 logs\electron-crash.log；手动：设置 ▸ 面板 ▸ 🧯 重置面板和缓存…；在浏览器中用 ?safe-layout=1。 *Where:* 桌面应用；设置 ▸ 面板。 *Since:* 2.891.0

### 主题与外观

- **主题** — Dark、Darker（OLED 纯黑）、Slate、Light 和 High contrast 会改变整个应用的外观，图像编辑器也包括在内。 *Where:* Settings > Themes。 *Since:* 2.432.0
- **强调色** — 为按钮、亮起的标签页和滑块设置任意颜色。 *Where:* Settings > Themes。 *Since:* 2.432.0
- **界面大小** — 一个滑块同时缩放所有字体和面板，范围为 60 到 175 %。 *Where:* Settings > Themes。 *Since:* 2.432.0
- **自定义颜色** — 为主题的每个部分单独设置颜色（背景、面板、线条、文字、正常、错误、悬停、画布、选中）。 *Where:* Settings > Themes > Customize。 *Since:* 2.435.0
- **已保存的主题** — 把主题保存为 themes 文件夹中的 .json 文件，从其卡片加载，导出和导入；导入时会把你原来的主题保留为 <name>_old.json，立即保存导入的主题，↶ Revert 可以恢复原样（2.709.0）。 *Where:* Settings > Themes。 *Since:* 2.435.0
- **主题编辑模式** — 点击屏幕上的任意元素即可选中它，并更改其字体、大小、颜色、阴影、圆角半径或图标，可作用于此元素、所有同类元素或其整个类别。 *Where:* 顶栏中的画笔按钮。 *Since:* 2.443.0
- **主题编辑模式下对话框照常可用** — 该模式开启时，对话框和弹出菜单照常响应点击和按键。 *Where:* 主题编辑模式。 *Since:* 2.455.0
- **编辑器主题** — 图像编辑器跟随应用主题，或使用自己的 Pro、Studio 或 Classic 外观。 *Where:* 图像编辑器的 Window > Theme。 *Since:* 2.393.0
- **bitGen Default 主题 + Ctrl+Alt+S** — Ctrl+Alt+S 可在任意位置打开 Settings；Ctrl+Alt+Shift+T、⟲ bitGen Default 或 ?theme=default 会恢复内置默认主题（Dark，无元素样式，界面大小 100 %），↶ The theme before 可撤销此操作；内置主题不能被覆盖或删除。 *Where:* 任意位置；Settings ▸ Themes。 *Since:* 2.636.0
- **主题编辑模式：调整大小、移动、隐藏、重命名** — 拖动手柄调整元素大小，拖动元素移动位置，隐藏元素或修改其文字；每次修改都会保存在 themes/<name>.tmp 中，退出编辑模式时可选择 Save theme、Save theme as…、Reset theme、Not now 或 Cancel。 *Where:* 顶部栏中的 🖌. *Since:* 2.514.0
- **主题编辑模式：每个按钮及其文字** — 双击任意文字（按钮、面板标题、选项卡、标签、标题、提示）即可就地修改；可重命名下拉列表的选项；可修改占位文字和工具提示；浮动工具面板的编辑方式与面板相同；Shift+点击（2.682.0）或 Alt+点击可执行按钮的操作，并在不退出该模式的情况下打开分区 / 选项卡 / 菜单。 *Where:* 顶部栏中的 🖌. *Since:* 2.623.0
- **仅在 Expert 模式下隐藏** — 主题可以只在开启 Expert 模式时隐藏某个元素；Basic 模式下仍会显示。 *Where:* 主题编辑模式 > Style 面板 > Hide. *Since:* 2.544.0
- **对话框的主题编辑模式** — Ctrl+Shift+Alt+E 也可为打开的对话框（Settings 等）设置样式；Ctrl+S 保存主题并退出。 *Where:* 任意位置. *Since:* 2.515.0
- **主题编辑器：对齐、内边距、外边距、圆角** — Style 面板可对齐文字（左 / 居中 / 右 / 两端对齐，上 / 中 / 下——适用于按钮、弹性行 / 列、网格和文字块），为元素及其文字设置内边距和外边距（每一边单独设置，= 同时设置四边），并可单独设置每个角的圆角。 *Where:* 🖌 Edit theme 模式 ▸ 点击某个元素 ▸ Text / Box。 *Since:* 2.567.0
- **在主题编辑模式中重命名面板标题和任意文字** — 面板的标题栏，以及按钮 / 框旁带文字的任意元素，都可改用新文字（保留下拉箭头和按钮，折叠后依然保留新文字）。 *Where:* 🖌 主题编辑模式 ▸ 选取 ▸ Layout ▸ Text。 *Since:* 2.574.0
- **主题编辑 ▸ Apply to: This element only（默认）** — 每次选取都只作用于该元素本身；新文字绝不会扩散到其他面板或元素。 *Where:* 🖌 主题编辑模式 ▸ Apply to。 *Since:* 2.574.1
- **Neural blue 主题和 bitGen 大脑图片** — 午夜海军蓝配电光蓝强调色的主题；启动画面是大脑影片，左上角显示标志（自 2.752.0 起；此前随机显示片头影片或大脑）；新安装的第一个项目会在 Assets ▸ Images 中自带这张图片。 *Where:* Settings ▸ Themes、启动画面、Assets ▸ Images。 *Since:* 2.726.0

### 项目与保存

- **项目** — 所有内容都存放在各自的项目文件夹中：输出、视频、图像、声音、角色和场景。 *Where:* 菜单栏的 New、Open 和 Save
- **保存一切内容** — 歌曲和场景、提示词、对话、角色、环境、参考图、素材、图库、时间线以及每个面板的字段。 *Where:* 菜单栏的 Save。 *Since:* 2.372.0
- **另存为** — 以新名称复制整个项目并打开副本；已存在的名称会被拒绝。 *Where:* 菜单栏。 *Since:* 2.372.0
- **新建项目从零开始** — 先保存你离开的项目，然后每个面板都清空重新开始。 *Where:* 菜单栏的 New。 *Since:* 2.371.0
- **回收站** — 删除的文件会进入项目的回收站；可以还原、永久删除或清空回收站。 *Where:* 菜单栏。 *Since:* 2.374.0
- **重置项目** — 清空项目并以相同名称重新创建，同时停止其渲染并清除其已完成的任务。 *Where:* 菜单栏。 *Since:* 2.374.0
- **整个项目文件（.bgp）** — 整个项目保存为一个 XML 文件，可以自包含全部媒体，也可以是一个小清单；采用流式读写，因此数 GB 也没问题；打开它会创建一个新项目。 *Where:* 菜单栏中的打包按钮。 *Since:* 2.436.0
- **电影包** — 在 StoryBoard 上新建、保存和加载整部电影（演员阵容、章节、场景和渲染）。 *Where:* StoryBoard 的菜单栏。 *Since:* 2.151.0
- **项目重置锁定屏幕** — 项目重置期间，整个窗口会被遮罩覆盖，显示 "Resetting Project..."，带有旋转圆环、跳动的圆点、当前正在进行的操作和已用秒数；遮罩后面的任何内容都无法点击，并且会一直保持到重新加载完成、空项目打开为止（"✓ Project reset"）。 *Where:* ↺ Reset project. *Since:* 2.599.0

### 素材、参考图、图库与队列

- **素材面板** — 项目中的图像、视频和声音；把文件拖放到上面即可导入。 *Where:* Assets 面板
- **素材分组** — （2.635.0：一个分组就是 Assets 文件夹中的一个文件夹）把文件归入分组；Send 把文件移入该文件夹，Add 则同时在那里创建链接。 *Where:* Assets 面板
- **全局素材与项目素材** — Assets 面板中的 📁 Project | 🌐 Global | All；项目素材位于 projects/<name>/Assets，全局素材（所有项目可用）位于 projects/Assets；上传的文件进入 Assets；右键点击可选择 🌐 Move to Global / 📁 Move to Project。 *Where:* Assets 面板。 *Since:* 2.635.0
- **选择并删除素材** — 勾选、Ctrl+点击或 Shift+点击图块；删除会把它们移入回收站，绝不会直接永久删除。 *Where:* Assets 面板
- **添加图块** — 虚线框的添加图块会打开文件对话框，用于添加图片、视频或声音，一次可添加多个。 *Where:* References 和 Assets。 *Since:* 2.394.0
- **参考图面板** — 随下一次生成一起发送的图片、视频和声音；可从 Assets 或 Gallery 拖入。 *Where:* References 面板
- **图库** — 所有渲染结果，分为图像、视频和音频标签页；可以从这里拖到参考图、时间线或场景上。 *Where:* Gallery
- **队列** — 显卡上一次只运行一个任务；可以暂停、重新排序、中止和重试，每个任务都有自己的日志。 *Where:* Queue。 *Since:* 2.122.0
- **Pending 与 Done 标签页** — 排队中、运行中和被中断的任务与已完成的任务分开显示，并随项目保存；被中断的任务可以继续。 *Where:* Queue。 *Since:* 2.113.0
- **单张运行卡片** — 正在运行的渲染显示为一张卡片，包含其提示词、模式、尺寸、进度条以及分块 / 步数 / 时间。 *Where:* Queue。 *Since:* 2.400.0
- **队列中的每个任务保留自己的设置** — 任务按加入队列时的设置渲染；队列运行中更改的设置只用于之后加入的任务（API 密钥始终为最新；任务日志列出更改了什么）。*Where:* Queue。 *Since:* 3.15.0
- **清除已完成的任务** — 从列表中移除所有已完成、失败和已取消的任务，但不删除文件。 *Where:* Queue 标题栏
- **中止对话框** — 停止当前渲染、将其放到队列最前面重试，或停止全部任务。 *Where:* Abort 按钮
- **可重用的种子** — 每个已完成任务的详细信息，带有一个按钮，可把它的种子填回 Basic Settings。 *Where:* Queue 的信息按钮。 *Since:* 2.384.0
- **实时 ComfyUI 进度** — 每个视频任务都会显示正在运行哪个节点以及 "step n of total"。 *Where:* Queue、场景卡片和 Generate 按钮
- **队列预设** — Normal / Quiet（夜间）/ Eco / Cool-down / Max performance / Custom：设置 GPU 功耗上限、任务之间的休息时间、显卡过热时等待，以及降频警告。 *Where:* 菜单栏的 ⏱. *Since:* 2.518.0
- **新渲染加入已打开的预览** — 预览打开期间完成的图片会加入其缩略图条；✨ N new 可跳转到新图片。 *Where:* 图片 / 视频预览. *Since:* 2.534.0
- **Queue 的 Pending 标签只显示尚未完成的** — 排队中和运行中的生成在 Pending;已完成、失败和取消的在 Done(可用 ↻ 重新生成);Pending 的数量包括排队中的。 *Where:* Queue。 *Since:* 2.784.1
- **文件夹筛选会记住所选文件夹；Basic Settings 保存在 basic.cfg 中** — 每个文件夹筛选下拉框都会保留你选择的文件夹（folder_filters.cfg）；Basic Settings 在更改时保存到 basic.cfg，并在启动时读回。 *Where:* 任意模型下拉框的文件夹筛选、📁 浏览器、Model manager；Basic Settings。 *Since:* 2.559.0
- **恢复的任务回到所属场景；不再自动播放** — 因重启而中断的 StoryBoard 场景，在 Queue 面板的 Pending 标签页中按下 ▶ Resume 后会取回其任务（运行状态及其进度条）；视频和歌曲加载后处于暂停状态，按 ▶ / Space 才开始播放。 *Where:* Queue 面板的 Pending 标签页；StoryBoard；播放器。 *Since:* 2.562.0
- **多选并拖动多个片段；⛓ 顺序排列** — 在 Gallery、Assets 或 References 中按住 Ctrl / Shift 点击多个片段，一起拖到时间线上（最早的放在最上层，依次首尾相接）；⛓ Sequential 让时间线上的片段沿各图层依次连续播放，删除、新建图层和修剪后都不会留下空隙。 *Where:* Gallery / Assets / References（Ctrl / Shift+点击、拖动）；时间线工具栏 ▸ ⛓ Sequential。 *Since:* 2.571.0
- **随处显示当前步数 / 总步数** — 图片（ComfyUI 和 sd-cli）、音乐和视频会实时报告采样器步数，所有显示正在运行的生成任务的面板、对话框和卡片都会显示“第 n 步 / 共 total 步”。 *Since:* 2.574.0
- **✎→ 从任意文件发送到提示词** — 将文件的提示词及其种子、cfg 和步数发送到提示词框 + Basic Settings。 *Where:* 图库、Assets、References 的缩略图块；查看器的 ⓘ 详情。 *Since:* 2.575.0
- **🧩 发送到模型… / Ctrl+↓ 设为缩略图** — 查看器可将图片 / 视频 / 歌曲连同其元数据发送到某个模型的文件中；Ctrl+↓ 将图片设为该模型的缩略图。 *Where:* 查看器；🧩 Model manager ▸ ⓘ。 *Since:* 2.576.0
- **🖼 参考排序 + 企业数据库中的卡纸** — 在参考停靠栏中把图片、视频或声音拖到同类的另一项上即可调整顺序（图片 6 拖到图片 1 上 = 图片 1，其余依次移动；提示词中的 <Picture n> / <Video n> / <Audio n> 标签随之更新；随项目保存）；企业信息保存在数据库中时，📇 卡纸也保存到那里（在电脑之间共享，每个名称一种，数据库无响应时等待）。*Where:* 参考停靠栏；📇 名片拼版。*Since:* 2.898.0
- **预览中的歌曲：可视化效果，Next 播放下一首** — 在预览中对歌曲或声音按 ▶，会开始一个随机选择的可视化效果（条形、镜像、波形、圆环、星空、涟漪；🎲 换一个）；Next / Prev 跳到所点击面板中的下一首 / 上一首并播放。 *Where:* 预览（在 Gallery、Assets 或 References 中点击歌曲）。 *Since:* 2.725.0
- **在预览中逐帧查看视频 + 📷 截取当前帧** — ⏴ 后退一帧，⏵ 前进一帧（按键 , 和 .），中间显示帧号，按视频真实帧率准确停在每一帧；📷 Capture frame 把屏幕上的这一帧从文件本身截取为视频原始尺寸的 PNG 保存（素材 + 图库，<视频>_frame<n>.png），Shift+点击同时放入参考。（2.908.0：图库切换到图片标签并高亮该帧的缩略图） *Where:* 显示视频时预览对话框的工具栏。 *Since:* 2.903.0

### 文件对话框与另存为

- **bitGen 自己的文件对话框** — 快速访问、应用和项目文件夹、每个驱动器及其可用空间、地址栏、支持通配符的搜索、详细信息或大图标视图、新建文件夹和重命名；在 Windows、macOS 和 Linux 上完全一致。 *Where:* 每个文件夹按钮和 Choose file
- **从图库另存为** — 每个图库图块都有一个另存为图标，会以 Save As 模式打开文件对话框。 *Where:* Gallery 图块
- **快速保存** — 预览对话框中的 Save 会把文件复制到上次另存为的文件夹，不弹出对话框，也绝不覆盖现有文件。 *Where:* 预览对话框

### 截图录屏与远程使用

- **截图** — 把应用窗口或整个屏幕保存到图库。 *Where:* 菜单栏（Alt+Shift+S）
- **屏幕录制** — 把应用或屏幕录制为 H.264 mp4，可录入电脑声音和麦克风，并带倒计时。 *Where:* 菜单栏（Alt+Shift+R）
- **在手机上使用** — 二维码远程链接：手机可以拍照和录像、发送音频并与模型对话；所有内容都会进入项目。 *Where:* Settings > General。 *Since:* 2.132.0
- **📱 bitGen 应用（Android）：用手机使用你的电脑** — 用远程访问的二维码（拍一张照片）或链接配对一次；之后选择视频或图片风格、写提示词、从相机或手机添加图片、设置尺寸、秒数和 Override style、查看 ⏱ 耗时估计并按 Generate——由你的电脑渲染（所有视频模型：MiniMax H3、Wan、LTX 2.3 / 2.5、H3 Long Video、PAN 2，以及图片风格），队列跟踪进度，图库播放结果，并可在手机上 ⬇ 保存 / ⤴ 分享。远程访问现在对来自网络的每个请求都要求已配对设备的密钥（以前只保护手机页面自己的接口），配对在重启后仍然保留，二维码任何扫码器都能读取（其格式信息曾被转置放置）。*Where:* 应用（mobile/ - 用 Android Studio 构建）；电脑上 Settings ▸ General ▸ Remote access。*Since:* 2.909.0
- **📱 bitGen 应用：🎵 音乐 + Galaxy Z Fold 布局** — Create 中的 🎵 Music：选择电脑上的歌曲风格，填写歌词、声音描述和时长（从风格自动填入）、标题以及 mp3 / flac / wav，由电脑制作歌曲；⏱ 显示耗时，图库的 Music 标签播放，⬇ / ⤴ 保存和分享。应用会根据屏幕布局：紧凑（外屏、分屏、弹出窗口——单栏，底部标签）或宽屏（展开的屏幕、平板——左侧 Create，右侧队列 / 图库 / 设置，各在折痕的一侧），折叠、展开或调整大小时即时切换并保留已输入的内容；Flex 模式下播放的视频在上半屏、按钮在下半屏；⛶ 隐藏手机的状态栏和导航栏。*Where:* 应用；工作室的提示词停靠窗在 🎶 Music 下也显示 ⏱。*Since:* 2.910.0
- **📱 bitGen 应用：✨ LLM 写歌 + 在 bitGen 中构建和安装** — ✨ Write the song：在应用中输入一个想法（“一首关于曼谷霓虹雨的歌”），电脑上的 LLM 会写出标题、声音和歌词——与工作室提示词聊天（“做一首关于……的歌”）相同的写歌器，并按照音乐风格本身的声音来写。Settings ▸ General ▸ Remote ▸ 📱 The bitGen app 在本电脑上构建应用（已安装 Android Studio 时使用其 Java 21 和 Android SDK，否则 ⬇ Get the build tools 下载约 1.5–2 GB），并通过无线调试经 Wi-Fi 安装到手机上——用手机的 6 位配对码配对一次，之后 🔨 Build + install 会把每个新版本装到手机上并启动，无需点按（通过 mDNS 再次找到手机）；⬇ APK file 可手动复制。*Where:* 应用的 🎵 Music；Settings ▸ General ▸ Remote。*Since:* 2.911.0
- **📱 无需无线调试安装 bitGen 应用：📲 扫码安装、⬆ 更新、📂 Phone Link** — 📲 Install with a QR：用手机相机扫描电脑上的二维码，手机浏览器通过 Wi-Fi 从电脑下载应用，点击安装即可（链接 15 分钟内有效，只能打开这一个文件）。⬆ 更新：应用装到手机后，会自动发现电脑上有更新的构建并提供 ⬆ Update - 下载后由 Android 安装程序打开（每次构建都有自己的 ID 和递增的版本号，因此 Android 会覆盖安装旧版本）。📂 Show the APK 打开文件夹并选中 APK，可拖入 Windows Phone Link 或通过 共享 ▸ Phone Link 发送。从 Galaxy Store 以外安装时，必须关闭三星的 Auto Blocker。*Where:* Settings ▸ General ▸ Remote ▸ 📱 The bitGen app；应用的 ⚙ Settings。*Since:* 2.912.0
- **📱 bitGen 应用：📶 无需二维码在 Wi-Fi 上连接 + ☁ 通过中继离家 6 小时** — 📶 Find my PC on Wi-Fi：应用会自己在手机的 Wi-Fi 上寻找 bitGen Studio（未配对打开时，或点按钮时）并请求连接 - 工作室中会出现一条提示，说明哪部手机想要连接，✔ Allow / ✕ Deny；或者先按 📱 Connect the phone（5 分钟），下一个应用无需询问即可连接。每次启动时应用都会重新找到电脑，即使地址变了。离家时（移动数据、其他 Wi-Fi），在最后一次连接家中 Wi-Fi 后的 6 小时内，应用通过 tigerart.com.au 上的 bitGen 中继继续工作：每个请求和应答都用只有应用和电脑才有的密钥封存（AES-256-GCM）- 中继无法读取；图片和视频分段传送。☁ Away from the Wi-Fi 可以关闭。*Where:* Settings ▸ General ▸ Remote ▸ 📶 The bitGen app on this Wi-Fi；应用的连接界面。*Since:* 2.913.0
- **📱 bitGen 应用：🎙 Talk + Remote access ▾（Wi-Fi、中继或 Cloudflare）** — 🎙 Talk：点一下说话，电脑用自己的语音识别听写，由说的话决定做什么：“find …”“find out about …”“search for …”搜索网络并附上来源回答；“make a video of …”“make a picture of …”“make a song about …”填好创作界面并按 Generate（歌曲先写词）；“fix this photo”“colourise this photo”用编辑风格修复你添加的照片；还可以用自己的短语（“show me = picture”）；其他内容则与电脑的 LLM 聊天，可以朗读回答。🎙 Speak the prompt 把你说的话写进提示词。Settings ▸ General ▸ Remote access 改为下拉菜单：Off、仅此 Wi-Fi、Wi-Fi + 离家时通过中继（tigerart.com.au 上的 bitGen 中继只允许其管理员；任何人都可以把 relay.php 和密钥放在自己的主机上），或 Wi-Fi + 离家时通过 bitGen 自行下载并运行的 Cloudflare 快速隧道 - 无需账号、无需输入、无需 DDNS。*Where:* 应用的 🎙 Talk 标签和 Create；Settings ▸ General ▸ Remote access。*Since:* 2.914.0
- **📱 bitGen 应用：会说话的助手 + 滑动图库** — 🎙 Talk 现在是对话：它能听出你什么时候说完，电脑回答，手机用自己的语音说出答案，然后继续聆听；生成内容、说 bye / that's all 或按 ✕ End 即结束。按 Generate 后，生成的图片、视频或歌曲会自动打开。查看器是滑动图库：左右滑动看下一个 / 上一个，上下滑动返回 Create；歌曲播放时有随机的动态可视化。在 bitGen Studio 中，“想要连接”提示条会显示在打开的设置窗口之上，按 ✔ Allow 或 ✕ Deny 后立即消失。*Where:* 应用的 🎙 Talk、图库和查看器；bitGen Studio。*Since:* 2.915.0
- **📱 bitGen 应用：参考素材 - 来自手机或电脑的图片、视频和声音** — 在 Create 中，＋ 🖼 Picture、＋ 🎬 Video 和 ＋ 🎵 Audio 都可以来自相机（或 🎙 录音）、手机图库 / 文件，或 💻 你的电脑（项目素材和图库）。视频渲染最多可用 9 张图片、3 段视频和 3 段声音作为参考（MiniMax H3 的参考视频和声音，LTX 也可以）；图片风格使用图片。*Where:* 应用的 Create 界面。*Since:* 2.916.0
- **图像编辑器关闭时用参考图编辑 / 合成** — 图像编辑器以任何方式关闭（✕、最小化、布局中 👁 关闭、所在的停靠组或窗口被隐藏、在另一个标签页后面），或已打开但没有图片时，提示词停靠窗的 ✏ Edit 和 🧩 Compose 使用 References 停靠窗的图片：一张即编辑，两到三张即合成；标签显示 🖼 N reference(s)。*Where:* 提示词停靠窗的 ▾ 下拉菜单（🖼 Image）。*Since:* 2.917.0
- **🗣 LongCat Avatar 1.6 - 跟着声音说话或唱歌的人物** — 基于美团 LongCat 的 LongCat-Video-Avatar 1.6 的视频风格：References 停靠窗的第一个声音是说话声（清晰的人声，或用 Stems 停靠窗分离出的歌曲人声），第一张图片是人物（没有图片 = 只根据提示词生成人物）；视频与声音一样长 - 25 fps，480p（Basic Settings 的尺寸为 720 或以上时为 720p，采用与图片比例最接近的官方尺寸），每段 3.7 秒用 8 步蒸留采样，每段接着上一段生成，超过 10 分钟也能保持稳定；嘴型跟随说话声，说话声在视频中。通过 PedroMarinhoDev 的 ComfyUI-LongCat-Avatar 节点包在 ComfyUI 中运行；Settings ▸ Add-ons ▸ LongCat Avatar 1.6 会安装节点包、int8 模型（12-16 GB 显卡可用 W4A8，或 bf16）、DMD + OPSD LoRA、Whisper large-v3 以及 Wan 2.1 的文本编码器和 VAE（已有则跳过）；📱 应用也能渲染。*Where:* 提示词停靠窗中的 LongCat Avatar 1.6 视频风格；Settings ▸ Add-ons ▸ LongCat Avatar 1.6。*Since:* 2.918.0
- **🎙 与 bitGen 真正的对话（SAVA + Voice Isolator）** — 📱 应用的 🎙 Talk 和工作室的 🎙 语音聊天会在你说话时把声音实时传到电脑：Inworld 的 SAVA 能听出你何时说完一句话（停下来思考不会被打断，简短的“是”会立即得到回答），Voice Isolator 会在 Whisper 识别之前去除房间里的噪音（电视、风扇、汽车）；应用的每一轮由电脑一次听完并回答。Settings ▸ Add-ons ▸ Voice conversation 会安装这两者（Apache-2.0，独立 venv，SAVA 用 CPU 就够）；没有安装时——或经由中继时——照旧按音量判断。*Where:* 应用的 Talk 标签页；工作室的 🎙 语音聊天（Ctrl+Alt+V）；Settings ▸ Add-ons ▸ Voice conversation。*Since:* 2.919.0
- **✂ 图像编辑器中的 SAM 3** — Meta 的 Segment Anything 3 现在是默认的选择模型：点击选中其下的物体，拖动选中框内的物体，并且新增用文字（"dog"、"女人的头发"、"red ball, yellow sun"）直接选中所有匹配项，无需第二个模型猜测；选择 ▸ 主体… 可把每个匹配放到单独图层。⤓ 安装只需下载一次（约 3.4 GB，独立 venv，Hugging Face 令牌或无门槛镜像）；"全部"（图层 ▸ 分割图层）仍使用小型 SAM ViT-B，安装时一并添加。*Where:* 对象选择工具（W）及其查找框；选择 ▸ 主体…；选择 ▸ Segment Anything 设置。*Since:* 2.920.0
- **🎙 在 📱 应用中用语音提问、聊天和搜索** — 应用的 🎙 Talk 能听懂你的意思："what is / what's / who / when / how much … / tell me about …" 是向电脑上 LLM 的提问，"find / search / look up …" 搜索网络，"let's have a chat" 让它成为 🤝 陪你聊天的朋友，"be my assistant" 变回 🧑‍💼 个人助理（也可用两个按钮）；🌐 Web 打开后，问题和聊天在需要时会搜索互联网（关闭 = 仅用 LLM 自身知识）；每个回答都会朗读出来并继续聆听。*Where:* bitGen 应用 ▸ 🎙 Talk（应用 1.9.0）。*Since:* 2.921.0
- **🎵 把歌曲文件的标题、歌词和详情载入 Song 标签页** — bitGen 生成的每首歌现在都在自身标签中带有标题、歌词和详情（音乐播放器会显示标题和歌词；flac、mp3 和 wav），在音频停靠窗的 🎶 Song 标签页按 🎵 From file，或把歌曲从本机、图库或声音素材拖到该页，即可从中填回标题、歌词、描述、风格、时长、种子和保存格式；以前的 bitGen 歌曲从其中的 ComfyUI 图和文件名读取，其他歌曲从播放器标签读取。*Where:* 音频停靠窗 ▸ 🎶 Song ▸ 🎵 From file，或拖放到 Song 标签页。*Since:* 2.922.0
- **🎤 把歌曲的歌词转写到 Song 标签页** — 载入音频停靠窗 🎶 Song 标签页的歌曲（🎵 From file 或拖放）若标签中没有歌词，会自动转写：歌曲分离（已安装时）先把人声从音乐中取出，语音转文字听出歌词，放入歌词框（每段一行，歌手停顿处空一行）；标题下的进度条显示正在做什么（取出人声、载入语音模型、听取歌词）以及进度；🎤 Transcribe 可再次转写；歌词框中已有的文字不会被自动覆盖（⤵ Use the heard words 可放入）；未安装语音转文字时先弹出 ⬇ 下载 / 取消 对话框。*Where:* 音频停靠窗 ▸ 🎶 Song ▸ 🎤 Transcribe。*Since:* 2.923.0
- **🎨 📱 应用使用你的主题颜色** — 从 bitGen Studio 构建的 bitGen 应用（设置 ▸ 常规 ▸ 📱 The bitGen App ▸ 🔨 Build / Build + install）采用当前使用的工作室主题（Dark、Darker、Slate、Neural blue、Light、High contrast 或已保存的主题，包括你的强调色和自定义颜色）：背景、面板、文字和强调色，GENERATE 的文字取在强调色上更易读的黑或白，浅色主题下手机状态栏和导航栏图标为深色；构建日志会写出主题名。在 bitGen 之外构建则保持应用原本的外观。*Where:* 设置 ▸ 主题，然后 设置 ▸ 常规 ▸ 📱 The bitGen App ▸ 🔨 Build（应用 1.10.0）。*Since:* 2.924.0
- **⟳ 自动从 GitHub 更新 - 并重新构建 📱 应用** — 勾选「Update bitGen Studio from GitHub by itself」（每 1 / 3 / 6 / 12 小时 / 每天），bitGen Studio 会查看 GitHub，并像 ⤓ Update now 一样更新自己（你的项目、设置、风格和模型不受影响）；当更新改变了 bitGen 应用时，会以你上一次 🔨 Build 的颜色自动重新构建应用，手机的 ⬆ Update 横幅随后会找到它（应用打开时每 30 分钟检查一次，回到应用时也会检查）。在渲染、歌曲、图片、更新或应用构建运行时不会进行。需要重启时，桌面应用会在 60 秒倒计时后自动重启（⟳ Restart now / Later = 一小时）；在浏览器中会提示你重新启动 start.bat。⟳ Look now 立即检查。需要先手动 🔨 Build 一次，且电脑保持开机；Android 仍需点击安装。*Where:* 设置 ▸ 常规 ▸ ⟳ Updates（应用 1.11.0）。*Since:* 2.925.0
- **🛡 安全：只有 bitGen Studio 自己的页面才算“这台电脑”** — 整个工作室的威胁模型（docs/bitgen-studio-threat-model.md，采用 OpenAI 的 security-threat-model 方法）及其修复：电脑浏览器中打开的其他网页无法再访问 bitGen 的设置（拒绝 DNS 重绑定、跨站提交和链接——页面的地址和来源必须是这台电脑）；你编辑的网站在 👁 Preview 中以自己的来源运行脚本，绝不以工作室身份运行（商店购物车在其中仍可使用）；已配对的手机不能再更改会运行程序的设置（ComfyUI / Python 路径、LLM 的文件夹及其命令批准、技能、扩展、安装、更新、应用构建）；桌面应用只把网页和邮件链接交给 Windows（绝不交出 file:、search-ms: 或其他程序的协议），也不会在其窗口中显示其他网站。*Where:* 全局（无需设置）。*Since:* 2.926.0
- **👂「Hi Gemma」- 📱 应用听到名字就唤醒** — 在 设置 ▸ 常规 ▸ 🗣 The assistant 给助手起个名字（默认 Gemma），bitGen 应用打开时只需说「Hi Gemma」（hey / hello / okay … 或只说名字）：应用打开 Talk，回答（「Yes?」），对话像 🎙 Talk 一样继续——说「Hi Gemma, what's the time in Sydney?」问题会立即得到回答。手机听到的每段短语音都发送到电脑上常驻的 Whisper（已告知名字，按你的拼写识别；通过 Wi-Fi 或 Cloudflare 隧道，从不经过中继；不保存任何内容）；房间里较长的说话（电视）会被忽略。LLM 也以这个名字回应。应用顶部栏的 👂 表示正在聆听——点按停止 / 开始；在后台或说话时不会聆听。*Where:* 设置 ▸ 常规 ▸ 🗣 The assistant；应用的 👂（应用 1.12.0）。*Since:* 2.927.0
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
- **附加组件** — Settings ▸ Add-ons 列出可选引擎（YuE2 音乐、Viggle native）：每个引擎的用途、需求和大小，以及是否已安装；可执行 ⤓ Install / ⟳ Reinstall / 🗑 Remove，日志显示在该标签页中。 *Where:* Settings ▸ Add-ons。 *Since:* 2.540.4
- **⟳ 重新安装与安装状态** — 任何已安装的内容都会显示 ⟳ Reinstall（已下载的模型显示 ⟳ Download again），点击会重新获取全部内容；安装或下载进行时，其按钮被禁用，旁边的状态显示当前步骤、百分比和秒数，结束后显示 ✓ 或 ✗ 及原因。 *Where:* Settings（Add-ons、Audio、ComfyUI、Models、Extensions）、模型目录、Civitai、LoRA 训练器以及各面板的安装按钮。 *Since:* 2.601.0
- **从 GitHub 更新** — Settings ▸ General ▸ ⟳ Updates：检查 GitHub 上是否有更新的版本（列出新的提交），⤓ Update now（git 克隆的安装会切换到 GitHub 的分支，并备份你修改过的文件；zip 安装则获取有变化的文件），依赖列表有变化时运行 npm / pip，⟳ Restart now；启动后会静默检查一次。 *Where:* Settings ▸ General。 *Since:* 2.540.5
- **整洁的应用文件夹** — 应用文件夹中只有 start.bat（+ package.json、README、LICENSE）；服务器、工作进程、默认设置、安装脚本和说明都位于 misc\ 中；从 zip 更新的安装会在首次启动时清理掉旧的副本（快捷提示词会保留）。 *Where:* 应用文件夹。 *Since:* 2.591.0
- **安装程序询问你的硬件** — 安装程序检测不到时，会询问显卡（从列表中选择）、内存和 CPU；“Not right?” 可修改。 *Where:* 安装程序的第一页. *Since:* 2.519.0
- **安装包** — Editor（无 AI）/ + small AI / + mid-size AI / Everything，按你的显卡推荐；安装前即可看到你能使用哪些功能（✓ ~ ✗，可以以后再添加）以及下载量。 *Where:* 安装程序的 Your package 页面；setup-cli --packages. *Since:* 2.519.0
- **本机与安装包** — 你的硬件、已安装的安装包、每种安装包可使用的功能；✎ Not right?；⬆ 无需重新安装即可升级到更大的安装包。 *Where:* Settings ▸ Models. *Since:* 2.520.0
- **分组下载** — 每个模型组一个复选框，并显示其文件数量和大小。 *Where:* 安装程序的模型页面；Settings ▸ Models ▸ Model downloads. *Since:* 2.520.0
- **加载器跟随模型文件** — 风格的 .safetensors 或 .gguf 模型会自动使用匹配的 ComfyUI 加载器（Load Diffusion Model / GGUF 加载器）——GGUF 风格也能渲染 .safetensors 微调模型，反之亦然。 *Where:* 每个图像风格. *Since:* 2.523.0
- **无论模型在哪个 ComfyUI 文件夹中都能找到** — 风格的扩散模型如果放在 models/checkpoints（或其他子文件夹）中，会通过 Load Checkpoint / ComfyUI 列出的名称加载，而不会报错 "Value not in list"；不在任何文件夹中的模型会给出提示，说明应放在哪里。 *Where:* 每个图像、视频和音乐任务. *Since:* 2.525.0
- **每个模型文件都能在 ComfyUI 列出的位置找到** — 位于其他子文件夹中的文本编码器、VAE、LoRA 和 ControlNet 会以 ComfyUI 中的名称使用；完全不在任何文件夹中的文件，会给出可下载它的模型目录条目名称。 *Where:* 每个任务；🩺 Style doctor. *Since:* 2.531.0
- **工作室中的附加组件** — 在 Settings ▸ General 中开启或关闭 Face fix 和 ControlNet：关闭 = 隐藏且从不使用；开启 = 显示，且缺少的内容（节点包、模型）会自动下载到对应的 ComfyUI 文件夹——每次启动时也会检查；它们的 Add-ons 卡片列出了所有下载链接。 *Where:* Settings ▸ General / Settings ▸ Add-ons. *Since:* 2.593.0
- **🔑 API 密钥加密保存，更新后仍在** — Hugging Face、Civitai 和 RunPod 密钥、远程访问密钥以及社区登录保存在 settings/keys.json 中，每个单独加密（AES-256-GCM，由 settings/keys.master 打开）；更新和恢复默认值都不会动它们；custom.settings 不保存任何密钥。 *Where:* bitGen 文件夹中的 settings/（设置 ▸ 常规 中显示）。 *Since:* 2.748.0
- **模型管理器能找到 ComfyUI 已有的内容** — 它会询问正在运行的 ComfyUI 其模型文件夹在哪里、下拉列表里有哪些内容，因此即使模型和 LoRA 不在 Settings 中设置的 ComfyUI 文件夹下（例如桌面版自己的文件夹，或 ComfyUI 命令行指定的 yaml），也能显示出来。 *Where:* 🧩 Models. *Since:* 2.598.0
- **按钮显示正在进行的操作** — Install、Update、Start（随后是 Loading the model）、Stop、Rescan、Scan folder 和 Save 会变成旋转的 "…ing" 并显示秒数，然后显示 ✓ 或 ✗ 及原因。 *Where:* Settings > LLM 和 Save. *Since:* 2.596.0
- **彩色安装过程，绝不看起来卡住** — 在安装窗口的步骤、日志和下载中，以及安装脚本中，已完成显示为绿色，正在安装显示为浅绿色（带用时），警告为橙色，错误为红色；长时间无输出的步骤会说明它仍在运行、为何可能耗时较长，以及它并没有卡住。 *Where:* 安装窗口，install_all，start.bat. *Since:* 2.634.0
- **一个文件完成安装** — install_all.bat / install_all.sh / install_all.command：缺少 Git 和 Node.js 时自动安装（Windows：还有 Python），将仓库克隆到该文件旁边，然后启动工作室（首次启动时安装其余部分）。 *Where:* 仓库根目录——只需下载该文件. *Since:* 2.616.0
- **⤓ 更新 ComfyUI；启动时检查更新** — 就地更新 ComfyUI（使用便携版自带的更新程序，或 git + pip），可选 Newest 或 Stable 通道，由本应用启动的 ComfyUI 会随之重启；启动后在 GitHub 上检查 bitGen Studio 和 ComfyUI，任一有新版本时状态栏显示 ⬆。 *Where:* Settings ▸ ComfyUI ▸ ⟳ ComfyUI updates；Settings ▸ General ▸ ⟳ Updates ▸ Check for updates on startup。 *Since:* 2.573.0
- **无需设置即可使用已安装 ComfyUI 的模型** — Settings 中未指定 ComfyUI 文件夹时，会自动查找本机上的 ComfyUI（环境变量、应用旁边、主目录、Pinokio、Stability Matrix、各驱动器根目录、ComfyUI Desktop），并在 Model manager 和 Basic Settings 中列出其检查点和扩散模型；点击 Use this folder 即可将其设定下来。 *Where:* 🧩 Model manager；Basic Settings ▸ Model / checkpoint；Settings ▸ ComfyUI ▸ Folder。 *Since:* 2.622.0
- **模型路径（extra_model_paths.yaml）** — 管理 ComfyUI 额外模型路径的每个组：➕ 新建组（other_ui1、other_ui2 …，根据其 base 下的文件夹自动填充），更改 / 添加 / 删除路径（用 📁 选择），重命名，is_default，🗑 删除组；文件的其余内容保持不变，并保留上一版的 .bak 备份；⟳ Restart ComfyUI。 *Where:* 🧩 Model manager ▸ 📁 Model paths。 *Since:* 2.580.0
- **⤒ 导入并检查 ComfyUI 工作流** — 任意保存版 / API 版工作流：统计其图片 / 视频 / 声音输入，将预览节点改为保存节点，报告缺失的节点和模型文件，连接 Prompt / Negative / Seed / Steps / CFG / 尺寸 / 时长控件，并绘制工作流图；▶ Test run 使用测试输入试运行——成功时保存到 comfy_workflows/ 并附带工作流图，失败时显示 ComfyUI 的错误。 *Where:* Settings ▸ ComfyUI ▸ Graphs。 *Since:* 2.587.0
- **带服务器组件的可选扩展** — 扩展（ext/<id>/）可自带服务器代码（ext.json 中的 "server"），在启动时挂载，且仅在其运行时显示；Settings ▸ Add-ons 可从扩展的 zip 安装（📦）和移除扩展。Team render farm 就是这样一个扩展——因可能触发杀毒软件而未包含在安装 zip 中。 *Where:* Settings ▸ Add-ons ▸ Team render farm。 *Since:* 2.589.0
- **更新和退出时清理 ComfyUI** — ⤓ Update ComfyUI 会先运行 misc\clear-comfy.bat（结束所有 ComfyUI 进程、释放 8188 端口、清除其缓存）；退出时同样执行，并结束所有 bitGen Studio 进程、关闭终端窗口。 *Where:* Settings ▸ ComfyUI（Clear ComfyUI completely when bitGen Studio exits）。 *Since:* 2.669.0
- **关于与致谢** — Settings ▸ About：版本号、Produced and Developed by Tim Paul、Programmer - Claude Opus 5.5，以及对所有使用了其代码、模型、工具和创意的项目的致谢（链接在浏览器中打开）；Guide 的结尾也有同样的致谢。 *Where:* Settings ▸ About。 *Since:* 2.642.0
- **渲染前检查缺失的模型** — 渲染要加载的每个模型文件（工作流的、样式的，以及 Basic Settings 的）都会与 ComfyUI 模型路径中已找到的模型文件列表比对（misc/models_found.json，缺少某个名称时重新生成）；对话框列出缺少的文件及各自应放入的文件夹，⬇ Download 下载模型目录中有的文件后渲染自动开始，Cancel 则停止渲染；仍因缺少模型而停止的渲染会询问是否下载（2.720.0）。 *Where:* 生成（图片、视频、音乐）；🧩 Models ▸ ⟳ 重新生成列表。 *Since:* 2.719.0
- **仅在模型改变时释放显存** — 连续使用同一模型的渲染会把它留在显卡上（不卸载、不重新加载）；换用其他模型或发生显存不足的错误时，会先释放显卡；也可以像以前一样每次生成前释放。 *Where:* 设置 ▸ ComfyUI ▸ Free VRAM before a generation ▸ Free it。 *Since:* 2.722.0

### 社区、帮助和错误报告

- **💬 bitGen 社区** — 类似 Facebook 的小型聊天面板：用用户 ID 加入，在共享的 Help 聊天室中提问，添加好友（需对方先接受），私聊，举报 / 屏蔽，管理员可以删除消息和封禁用户；服务器为 PHP + MariaDB（仓库中的 community/）。它是一个独立的浮动面板（可浮动 / 停靠 / 作为标签页放入其他面板，位置会被记住 - 2.711.0）。 *Where:* 状态栏的 💬 Community。 *Since:* 2.710.0
- **社区：姓名 + 已验证的邮箱** — 加入时需要填写名字、姓氏和电子邮件地址（只有管理员能看到）；系统会向该地址发送一个 6 位验证码，确认之后才会开放 Help 聊天室（可以 Send a new code，或更改地址）；封禁也会同时封禁该邮箱地址，因此被封禁的成员无法以新的用户 ID 重新加入；老成员会在下次登录时被要求补充这些信息。 *Where:* 💬 Community ▸ Join，⋯ ▸ Your details。 *Since:* 2.713.0
- **讨论区** — tigerart.com.au 上的论坛，与 💬 Community 使用同一个账户：Help / Show your work / Ideas / General；成员发帖立即显示，访客可以阅读和发帖（访客的帖子需先经管理员批准）；管理员可以批准、拒绝、删除和封禁，并能看到真实姓名。 *Where:* 💬 Community ▸ ⋯ ▸ Discussions，或 tigerart.com.au/discussions.php。 *Since:* 2.713.0
- **测试面板** — 某个版本需要做的测试，完成后逐项勾选（很多会自动勾选），可写备注，💾 保存日志以便上传。 *Where:* Settings ▸ General ▸ 🧪 Testing. *Since:* 2.518.0
- **错误报告** — Ctrl+Alt+Shift+B：窗口截图（可用 ✏ / ▭ 标注）、标题、严重程度、出现位置、发生了什么 / 预期结果、操作步骤（⤵ 录制的点击和按键——绝不记录输入的文字），并附带日志、系统 + 设置（隐藏密钥）、页面错误和失败的请求；💾 保存为一个 .zip 以便发送；以前的报告可 ⤓ / 🗑。 *Where:* 任意位置（Ctrl+Alt+Shift+B）；Settings ▸ General ▸ 🐞 Report a bug…. *Since:* 2.522.0
- **向社区发送错误报告** — 📤 Save and send 将报告发布到网站的 Discussions ▸ Bug reports 下：已登录 💬 Community 时以你的身份发布（立即显示），未登录或勾选 ☑ Send anonymously 时匿名发布（需管理员先审核）；公众可见标题和你写的内容，日志、设置、系统信息和截图仅管理员可见；管理员可设置其状态，并将所有错误下载为一份列表。 *Where:* 🐞 Bug report ▸ 📤 Save and send；Earlier reports ▸ 📤. *Since:* 2.714.0
- **自动勾选的测试** — 🧪 测试列表中凡是应用检测到已正常工作的项目都会被勾选并保留（auto ✓），重启后依然有效。 *Where:* Settings -> General -> 🧪 Testing. *Since:* 2.532.0
- **🧪 测试模式** — 根据你当前所在位置推荐下一项测试（图像编辑器：模糊、画笔、橡皮擦……），应用检测到某项测试正常工作时询问 'Did it work?' 并提供建议框，将你的回答和建议记录在日志中；关闭后不会自动勾选也不会弹出任何内容。 *Where:* Settings -> General；🧪 Testing 面板. *Since:* 2.534.0
- **加入社区时说明为什么要邮箱验证码** — 加入表单（💬 Community 和网站）说明使用或下载 bitGen Studio 不需要成为会员 - 只有在社区里交流才需要 - 并说明新会员用 6 位验证码确认邮箱，是为了防止垃圾注册并确认加入的是真实的人。 *Where:* 💬 Community ▸ Join；tigerart.com.au ▸ Account。 *Since:* 2.764.4

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
- **⇄ 上一次设置** — 位于提示词面板的图像 / 视频风格下拉菜单旁：在当前风格和上一个风格之间切换；开启 Override style 时，其 Basic Settings 数值和临时 LoRA 也会一并恢复；保存在 model_settings.tmp 中（2.683.0：应用自身更换风格时同样有效；— none — / — template — 也计入）。 *Where:* 提示词面板 ▸ ⇄。 *Since:* 2.680.0

### 提示词对话与本地 LLM

- **提示词对话** — 与本地 LLM 一起推敲创意；回复中的提示词会变成可以直接渲染的区块。 *Where:* Prompt chat 面板。 *Since:* 2.85.0
- **保存、加载和清除对话** — 对话以“主题 - 日期”的形式保存，并按从新到旧排列；清除会清空窗口和模型的记忆。 *Where:* Prompt chat。 *Since:* 2.370.0
- **LLM 能看到你的参考图** — 按托盘顺序排列的图片（附带本地视觉模型生成的一行描述）、视频和声音，让它写出带有正确标签的提示词。 *Where:* Prompt chat。 *Since:* 2.354.0
- **针对模型编写提示词** — 选择 LTX 或 Wan 风格后，LLM 会专门为该模型编写提示词。 *Where:* Prompt chat。 *Since:* 2.419.0
- **按模型的方式称呼图片** — 提示词聊天和 ✨ Enhance 用所选模型读取的方式称呼参考图片：MiniMax H3 用 <Picture 1>，LTX / Wan / PAN 2 用 picture 1，FLUX Klein 用 image 1，Qwen Image 2.1 用 <image1>，Fibo 用 <image_1>，Qwen Image Edit 用 Picture 1；回复中的文件名会换成图片编号；Image 模式也会发送图片。 *Where:* 提示词聊天；Prompt docker ▸ ✨ Enhance。 *Since:* 2.899.0
- **为 MiniMax H3 调整的语音提示词** — 台词会被转换为 H3 的对白语法，并带上语言和音色；多余的指令会被清理掉。 *Where:* 每次提示词渲染
- **朗读回复** — 用所选声音朗读每条回答。 *Where:* Prompt chat。 *Since:* 2.87.0
- **长篇镜头列表** — 当要求的内容比一个片段更长时，LLM 会编写一份可依次衔接的编号镜头列表。 *Where:* Prompt chat。 *Since:* 2.126.0
- **360 度与立体 VR 提示词** — 当你提出要求时，LLM 会学习等距柱状投影和左右并排立体的提示词规则。 *Where:* Prompt chat。 *Since:* 2.118.0
- **WeVisOne-VL 视觉模型** — 腾讯的 WeVisOne-VL（基于 Qwen3-VL）作为提示词面板的视觉模型：它能读取图片中的文字、计数和查找物体，并为 LLM 描述图片内容。可在下拉列表中选择 4B 或 2B；模型会下载到你的视觉模型文件夹。 *Where:* Settings > Add-ons > WeVisOne-VL. *Since:* 2.595.0
- **⟳ 更新 llama.cpp** — 查看已安装的 llama.cpp 版本以及是否有更新版本，并就地更新（LLM 和视觉服务器会先停止；模型和设置保持不变）；进度直接显示在原处。 *Where:* Settings > LLM. *Since:* 2.596.0
- **🎙 语音对话** — 像实时聊天一样免手动与应用交谈：它能听懂你说的话（faster-whisper，本地运行，常驻加载），本地 LLM 会出声回答并执行你的要求——提示词、风格、Basic Settings、Generate、StoryBoard 场景、面板。 *Where:* 状态栏的 🎙 Voice（Ctrl+Alt+V）。 *Since:* 2.564.0
- **LLM 提示词中的 LoRA 关键词** — ✨ Enhance 和提示词聊天会将所选 LoRA 的关键词（触发词）写入提示词；LLM 遗漏的关键词由 Enhance 补上。 *Where:* Prompt 面板 ▸ ✨ Enhance / 提示词聊天。 *Since:* 2.581.0
- **🔁 比较 LLM** — 同一个提示词依次由每个勾选的 LLM 回答，每条回复显示在聊天中各自的名称下；✓ Use this one 将其设为答案，每一轮（请求、每条回复、所做的选择、耗时）都会被记录，🏆 显示每类工作（剧本、音乐视频、歌曲、图片 / 视频提示词、聊天）的最佳 LLM，附带胜率、平均耗时及 CSV 导出。 *Where:* 提示词面板的菜单栏（🔁 ▾ 🏆）。 *Since:* 2.584.0
- **附加组件 ▸ LLM** — 聊天 / 写作用的 LLM 集中在一个下拉框中（★ Qwen3.8 27B——用作你自己检查点的基础模型、Gemma 4 31B / 12B、Qwen3.5 9B、Qwen3 4B / 8B / 14B），下载到 LLM 文件夹；训练器的 Qwen3.8 27B 基础模型可在 32 GB 显存的显卡上以 4-bit QLoRA 方式训练。 *Where:* Settings ▸ Add-ons ▸ LLM；🎓 LoRA trainer ▸ Base model。 *Since:* 2.586.0
- **使用中 LoRA 的关键词** — ✨ Enhance 和提示词聊天只写入 Basic Settings 临时 LoRA 的关键词（Override style 开启时），或所选风格的 LoRA 的关键词（关闭时）。 *Where:* Basic Settings ▸ Override style；该风格的 LoRA。 *Since:* 2.585.0
- **🌐 LLM 的网络搜索** — 提示词停靠窗的 🌐 让聊天的 LLM 搜索网络并阅读页面后再回答，并列出来源；设置 ▸ 常规中可选 Brave Search（默认关闭，密钥加密）、你的 SearXNG 或 Wikipedia；只搜索和阅读——不下载、不安装、不运行，不访问本机或局域网地址，拒绝程序和压缩包，去除脚本，网页内容视为不可信数据。 *Where:* 提示词停靠窗 ▸ 🌐；设置 ▸ 常规。 *Since:* 2.885.0
- **🔎 SearXNG 与 ⬇ 下载** — 设置 ▸ 常规中一键在本机安装 SearXNG（免费，无需密钥，Windows 也可以），聊天搜索覆盖整个网络；让聊天下载图片、视频或声音时保存到 <项目>/web/downloads/ 并显示在图库中——只在你要求时、只下载媒体（按类型和开头字节检查），绝不运行。 *Where:* 设置 ▸ 常规 ▸ 🌐；提示词停靠窗 ▸ 🌐；图库。 *Since:* 2.886.0
- **🧰 LLM 的文件和命令** — 按下提示词停靠窗的 🧰，聊天的 LLM 就在你选择的一个文件夹中工作：自己列出、读取和搜索文件，只有在你看过（更改显示为红 / 绿行，命令显示其文件夹和时间限制）并点“是”之后才会更改文件或运行命令；每个被更改的文件都有备份，每次更改和命令都记录在带 ↶ 的日志中；一次回答只能用网络或文件夹之一，所以网页永远无法更改你的文件。 *Where:* 提示词停靠窗 ▸ 🧰；设置 ▸ 常规 ▸ 🧰。 *Since:* 2.887.0
- **🎛 LLM 的应用操作和技能** — 按下提示词停靠窗的 🎛，聊天的 LLM 就会替你操作应用：写提示词，选择风格或基本设置的值，按下生成，添加或渲染故事板场景，显示停靠窗（语音聊天的操作，在屏幕上完成）；技能 - 某类工作的指示（内置四个：视频提示词、从故事到故事板、图片、音乐视频）以及你在 设置 ▸ 常规 ▸ 🎛 技能 中自己创建的 - 在符合要求时加载；读过网页后从不使用。 *Where:* 提示词停靠窗 ▸ 🎛；设置 ▸ 常规 ▸ 🎛 技能。 *Since:* 2.888.0

### 基本设置与视频风格

- **基本设置** — 模式、分辨率、宽高比、秒数、步数、CFG、种子、格式、LoRA、ControlNet 和面部修复。 *Where:* 按键 S
- **种子** — -1 表示随机种子，填入数字则使用该种子，骰子按钮重新随机，另一个按钮可使用上一次的种子。 *Where:* Basic Settings。 *Since:* 2.384.0
- **临时 LoRA** — 在风格自带的 LoRA 之上，为接下来的渲染额外添加的 LoRA。 *Where:* Basic Settings。 *Since:* 2.111.0
- **视频风格卡片** — 所选的视频风格，显示其每个阶段的模型、步数、CFG、编码器、VAE、LoRA 和负面提示词；在卡片上更换模型会保存到该风格中。 *Where:* Basic Settings 顶部。 *Since:* 2.401.0
- **覆盖风格** — 由 Basic Settings 决定所有视频模型（MiniMax H3、Wan、LTX）的步数、CFG、种子、模型和额外 LoRA。 *Where:* Basic Settings。 *Since:* 2.409.0
- **视频风格** — 每种模式保存的一套模型和工作流，对分阶段采样的模型还包含各个阶段；复制一个风格即可保留变体。 *Where:* Settings > Video。 *Since:* 2.110.0
- **🗂 基本设置的每个选项卡保留自己的设置** — Ref、F/L、Text 和 Swap 各自记住格式、尺寸、秒数、步数、CFG、种子和模型；离开选项卡时保存，回来时恢复（重启后仍保留）；Character chain 保留未保存的输入。 *Where:* 基本设置。 *Since:* 2.742.0
- **使用模型 / 使用临时 LoRA** — 开启“覆盖风格”时，检查点／视频模型上方和每个临时 LoRA 列表上方各有一个勾选框：用风格自带的模型发送覆盖设置，或在任一模型上加上或去掉你的 LoRA。 *Where:* 基本设置。 *Since:* 2.777.0
- **Basic Settings 的列表跟随所选风格** — 图片的 Checkpoint 和 LoRA 列表显示图片风格的模型系列和类型（image / image edit），视频的 Model 和 LoRA 列表显示视频风格的（MiniMax H3、LTX、Wan）；无法判断系列的文件留在末尾并加标记；有一行说明显示的内容，并带 Show all；已选但不符合的文件保持选中并加以说明。*Where:* Basic Settings. *Since:* 2.788.0
- **Basic Settings 的列表按位置筛选** — 图片 Checkpoint、视频 Model 和每行临时 LoRA 前面都有 All places / This computer / RunPod / OpenRouter（带数量），在风格家族筛选之后；☐ Remote 和 Pod 行已移除（Pod 的文件以 <pod>/<file> 选择）；Model manager 的 Civitai info 和 Sync 在它的 Civitai 标签页中。*Where:* Basic Settings, 🧩 Model manager. *Since:* 2.797.0
- **风格家族列表不再区分图片 / 编辑** — Basic Settings 的列表显示风格家族的所有模型，图片模型和编辑模型都包括（Klein 既能生成也能编辑图片）。*Where:* Basic Settings. *Since:* 2.798.0
- **种子：🎲 随机 / 📌 固定** — 种子旁的一个开关：Random = 每次渲染使用新种子，Fixed = 每次都使用旁边的数字（输入数字或用 ♻ 调用上次使用的种子会切换为 Fixed）。Basic Settings（视频和图像）以及每个风格（图像、视频、音乐）中都有——风格总能以自己的种子渲染。 *Where:* Basic Settings，Settings > Image / Video / Music styles. *Since:* 2.598.0
- **每个风格独立的 Basic Settings** — 每个风格都会保留你上次与它一起使用的 Basic Settings（misc/basic_settings.tmp）：切换风格时，先保存所离开风格的设置，再恢复新风格的设置；应用启动时会打开上次使用的风格及其设置。视频风格保存除图像设置组以外的所有设置；图像风格保存图像设置组。 *Where:* 任意风格列表（提示词面板、Basic Settings 的风格卡片）. *Since:* 2.615.0
- **🔀 临时 LoRA 的开关** — 在 Basic Settings 中添加的每个 LoRA（图片、视频、ControlNet，以及视频停靠窗的 ⚙ 列表）都有开关：关闭后它仍留在列表中——包括权重，随项目保存——但不参与任何渲染（Generate、StoryBoard、角色、Pod）；随时可以重新打开；✕ 仍会删除它。*Where:* Basic Settings ▸ Temporary LoRAs。*Since:* 2.931.0

### MiniMax H3

- **三种渲染方式** — 参考图片（最多九张）、首帧 / 尾帧，或仅用文本，均带原生声音。 *Where:* Basic Settings 的模式
- **长片段无缝拼接** — 超过单次运行长度的片段会被拆分后再拼接起来。 *Where:* Seconds
- **长视频：串联镜头（H3 Long Video）** — 30 秒的单次运行已停用（15 秒后会改变面孔）；超过 15 秒、没有歌曲的场景会渲染为一组镜头，每个镜头都从上一个镜头的最后一帧开始。 *Where:* StoryBoard 的 ⚙（Long video），或 H3 Long Video (40 s) 视频风格。 *Since:* 2.503.0 (2.872.0)
- **一键获取更多 ComfyUI 节点包** — 安装或更新 KJNodes、Yusu H3 Unified 和 RH DLSS 5。 *Where:* Settings > ComfyUI > Video accelerators。 *Since:* 2.503.0
- **Veda 稀疏注意力** — 视频风格中可选的 MiniMax H3 加速器（On / Quality）：在其训练尺寸下比标准注意力快约 2-3 倍，可一键安装，其预测器在模型目录中。 *Where:* Settings > Video styles；Settings > ComfyUI > Video accelerators。 *Since:* 2.536.0
- **根据盲测调整的 Veda 与 Spectrum** — Veda 会跳过提示词描述打斗、变形、爆炸或追逐的镜头（这类镜头省时不多，画面还会变软；☑ 动作镜头也使用 Veda 可保留），并取代 Long video 的低显存注意力，而不再被跳过；Spectrum 在 12 步以上的运行中让前 2 步和最后 3 步真实计算，使脸部保持清晰。 *Where:* 设置 ▸ 视频样式 ▸ Veda 稀疏注意力 / Spectrum。 *Since:* 2.717.0
- **借助参考图让渲染变为写实** — 每个 Blender / Unreal 对象都会与一张参考图片匹配，可按名称匹配或手动指定。首帧由编辑模型借助这些图片变为写实画面，然后由 LTX 2.3 3DREAL 沿着渲染让它动起来。 *Where:* 🟧 Timeline 的 Blender scene / UNREAL ▸ Render to Real，🖼 图像编辑器的 3D 和 Unreal 图层。 *Since:* 2.540.0
- **图片类型** — 把参考图片标记为人物、面部、服装、首帧或尾帧；标记首帧会把渲染切换为首帧 / 尾帧模式。 *Where:* References 面板。 *Since:* 2.340.0
- **True CFG** — CFG 大于 1 时会增加一次负向计算，只强化你的提示词所添加的内容。 *Where:* Basic Settings。 *Since:* 2.366.0
- **H3 尺寸** — 选择如何处理介于 H3 的 32 像素步长之间的尺寸：向下取整，或以更大尺寸渲染后再精确裁切回来。 *Where:* StoryBoard 设置。 *Since:* 2.380.0
- **以角色的声音说出带情绪的台词** — 每句台词都带有自己的情绪，并用角色的克隆声音说出；较长的声音片段会被裁剪为 8 秒的样本。 *Where:* StoryBoard 和提示词
- **其他语言** — 在引号内加上语言标签，这句台词就会用该语言说出。 *Where:* 提示词
- **H3_Viggle 风格** — 由一段动作视频驱动动作，由一张图片指定表演者。 *Where:* 视频风格列表。 *Since:* 2.352.0
- **MiniMax H3 的 16 GB 模式** — 在你的 H3 渲染中使用 DENO 的 R2V Turbo 8+2 方案：采样前卸载文本编码器，第一遍以你设定的尺寸运行 8 步，然后进行潜空间放大（×1.0-2.0），再用稀疏注意力进行 2 步精修，并保留声音；Auto 会为显存 16 GB 或以下的显卡自动开启，ComfyUI 缺少的部分会被省略并附上说明。 *Where:* Settings > ComfyUI > 16 GB mode；所需文件位于 Settings > Add-ons > 16 GB mode。 *Since:* 2.708.0
- **FastH3 Omni** — 以 8 步完成 MiniMax H3 的参考图生视频（FastVideo）：一种视频风格、一个 StoryBoard Workflow、一个负责下载的附加组件，以及在任何加载它的 H3 工作流图上应用的配方（shift 12/3、VSA、8 步）。 *Where:* Settings ▸ Add-ons ▸ FastH3 Omni；StoryBoard ▸ Workflow ▸ FastH3 Omni。 *Since:* 2.573.0
- **π pi-H3 — 2 / 4 步的 MiniMax H3** — pi-H3 (2 steps) / (4 steps) 视频风格：Hansheng Chen 对 H3 FL2VA 模型的蒸留版，无需 VAE 解码即可生成帧（DWD）—— 文本、首帧和 / 或尾帧生成带声音的视频；使用 ComfyUI 中最好的稀疏注意力（Spark-Attn、Kijai 的 Sol-Attn，否则内置）；缺少适配器时下载框让你勾选要下载的内容（2 / 4 步、int8 / bf16、Kijai 的 Sol-Attn）。*位置：* 提示词停靠栏 ▸ 视频风格、Settings ▸ Add-ons ▸ π pi-H3。*版本：* 3.5.0
- **SolarRenderer** — 结构视频（+ 首帧、六段式提示词）-> 在 MiniMax H3 上以 4 步生成片段：节点包 + LoRA 作为附加组件提供，其工作流通过 ⤒ Import & check 导入。 *Where:* Settings ▸ Add-ons ▸ SolarRenderer；Settings ▸ ComfyUI ▸ Graphs ▸ ☀ SolarRenderer。 *Since:* 2.588.0
- **🎞 H3 Long Video（40 秒及更长）** — 一个提示词生成一段长的 MiniMax H3 视频：第一段是场景 + 风格，之后每段一个镜头，每个镜头从上一个镜头的最后一帧开始，因此面孔和画面流程保持一致；Characters: 段落保持每张面孔；可选 2K 处理。 *Where:* H3 Long Video (40 s) 视频风格、StoryBoard 的 ⚙ Long video、Settings ▸ Add-ons ▸ H3 Long Video。 *Since:* 2.872.0

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

### PAN 2

- **🎬 PAN 2（MBZUAI 的世界模型）** — 一种视频风格：用平常的话写下发生的事情（或在参考停靠窗中放一张首帧图片），PAN 2 就会生成视频 - 24 fps，默认 10 秒，最长 20 秒，按 1248 × 704 训练；LLM 用 PAN 2 自己的改写方针把你的话写成 PAN 2 专用的结构化描述（一行提示词会变成噪点），经过检查，LLM 没有回应时则简单包装；PAN 2 的固定负面提示词，加上 ⊖ 中的词；参考停靠窗的第一个声音铺在下面。在 ComfyUI 自带的节点中运行（0.46.0 或更新）；设置 ▸ 附加组件 ▸ PAN 2 会下载 int8 模型（32 GB 显卡）或 bf16（80 GB 以上）、Qwen3.5 9B 文本编码器和 Wan 2.2 VAE。 *Where:* 提示词停靠窗中的 PAN 2 视频风格；设置 ▸ 附加组件 ▸ PAN 2。 *Since:* 2.890.0
- **🧩 PAN 2 的提示词用 JSON** — PAN 2 视频风格旁的 { } JSON 让 LLM 根据你的话（和首帧图片）把 PAN 2 的 JSON 描述写进提示词框，带缩进，可阅读或编辑；提示词还不是 JSON 时，生成会自动这样做，然后发送 JSON。 *Where:* 选中 PAN 2 视频风格的提示词面板。 *Since:* 2.891.0

### 参考图

- **参考视频与声音** — 参考渲染可各附带最多三个视频和声音；需要时会自动在工作流中添加缺少的插槽。 *Where:* References > Video 和 Sound。 *Since:* 2.353.0
- **选择参考视频的帧** — 循环播放的预览、可缩放的胶片条和选择框；Apply 会精确裁出这些帧。 *Where:* References > Video
- **向后追加 / 向前追加** — 渲染一段新的部分，从视频的最后一帧开始（或在其第一帧结束），再与原视频拼接，始终以首帧 / 尾帧方式进行。 *Where:* 视频的 Use 下拉列表。 *Since:* 2.388.0
- **时间线捕获** — 任意图层上播放头所在的帧都可以成为首帧、尾帧或参考图。 *Where:* 时间线的捕获按钮。 *Since:* 2.117.0
- **Qwen Image 2.1 读取参考图面板** — 图片按顺序发送，并根据其类型在提示词中命名。 *Where:* 图像生成。 *Since:* 2.340.0
- **参考图描述** — 每张参考图片、每个参考视频和声音下方都有一段简短描述，随项目和分组保存，用于映射行、提示词对话和 ✨ Enhance；另有墙 / 地板 / 家具 / 灯光等图片类型。 *Where:* References 面板。 *Since:* 2.539.0

### 角色、地点与环境

- **角色** — 名称、详细信息、角色设定图（正面 / 侧面 / 背面）和一段声音片段；它的 @标签 会把设定图和声音带入提示词。 *Where:* StoryBoard > Characters
- **从一张图片创建角色** — 上传一张照片或渲染图，即可生成参考设定图。 *Where:* 从图片新建按钮
- **演员** — 选择当前场景中有哪些角色出场。 *Where:* Actors 按钮
- **服装与身份模型** — 服装条目跟随角色；每个角色都保留一个数据集文件夹，用于身份模型。 *Where:* 角色
- **360 度环境** — 以全景图形式呈现的地点，带有摄像机和场景范围，并投影为平面视图以保持画面连贯。 *Where:* StoryBoard > Environments。 *Since:* 2.142.0
- **🪪 用 H3 Character Sheet Designer 制作角色设定表** — 一张图片变成最多 13 个视图（脸部、全身、服装、手、脚）的参考设定表，可加部位图片、部位备注和视图指令，生成前先显示布局，由 ComfyUI 中的 MiniMax H3 Image 绘制；取代姿势表。*Where:* StoryBoard ▸ 🖼 NEW（Character creator）▸ 🪪 Character sheet；设置 ▸ 附加组件 ▸ H3 Character Sheet Designer。*Since:* 2.870.0
- **✨ 在设定表标签里生成角色图片** — 描述角色、选一个图像风格并点 ✨ Generate：图片会在设定表的画布中打开，可直接拖框并生成设定表；勾选 Override style 时用这个风格自己的 Basic Settings 渲染。*Where:* StoryBoard ▸ 🖼 NEW（Character creator）▸ 🪪 Character sheet，在 📂 Load picture 下面。*Since:* 2.871.0
- **🧍 用于角色设定表的 3D 人体模型** — bitGen Studio 自己的解剖学比例人体模型（男性 8 头身 / 178 cm，女性 7.5 头身 / 165 cm，自然的 A 字姿势）作为设定表的姿势和镜头角度参照（2.934.0——角色来自你载入或生成的图片）。 *Where:* Character creator ▸ 🪪 Character sheet ▸ 🧍 Mannequin…。 *Since:* 2.873.0
- **🪪 你自己的人体模型和设定表模板** — 添加你自己的人体模型图片（🧍 Mannequin… ▸ Your mannequins），并上传一张完成的角色设定表作为 Template：新的设定表遵循它的布局——面板、视图、姿势、构图——而角色来自你的图片；所有项目都能用。 *Where:* Character creator ▸ 🪪 Character sheet。 *Since:* 2.874.0
- **🧍 角色设定表用的展示人体模特** — 🧍 Mannequin… 的男性和女性现在是黑色背景上的白色亮光展示模特：真实的人体（MakeHuman 开放的 CC0 基础网格——肌肉型男性 182 厘米，苗条女性 171 厘米），双臂垂于身侧，面部柔化，在影棚柔光箱下渲染；每个都有完整的参考表——正面、侧面、背面、两侧、头部正面 / ¾ / 背面、躯干、躯干侧面、臀部、手掌、手背、手侧面、脚底、脚背和脚侧面。3D 身体（static/mannequins/mesh，也有 OBJ）就是即将推出的服装设计器为其穿衣的身体。*Where:* Character Creator ▸ Sheet ▸ 🧍 Mannequin…。*Since:* 2.928.0
- **✨ 逼真的展示模特** — 在 🧍 Mannequin…（选择男性或女性）旁边，✨ Lifelike 让电脑上的编辑风格（所选图片风格能编辑时用它，否则用第一个——Qwen Image Edit、FLUX Kontext、P-H3 Edit …）把 3D 模特的正面、侧面和背面重新画成白色亮光玻璃钢商店模特的照片——光滑无脸的蛋形头部、雕塑般的身体、黑色背景——保持姿势、比例和镜头；三个视图并排合成一张参照表放入「Your mannequins」（「Lifelike male mannequin - front, side, back」），成为设定表的参照（2.934.0），每个视图也在图库中。*Where:* Character Creator ▸ Sheet ▸ 🧍 Mannequin… ▸ ✨ Lifelike。*Since:* 2.929.0
- **🪪 图像编辑器图标栏中的角色设定表** — ✨ Create 之后的纯图标 🪪 无需前往 StoryBoard 即可打开 Character Creator 的设定表对话框（🧍 Mannequin…、✨ Lifelike、▶ Generate sheet）；也可从 File ▸ 🪪 Character Sheet… 打开。*Where:* 图像编辑器 ▸ 图标栏。*Since:* 2.930.0
- **👗 服装设计器 - 按尺寸制作缝纫纸样** — 选择一种服装（T 恤、长袖上衣、背心、连帽衫、修身连衣裙、太阳裙、A 字裙 / 铅笔裙 / 层叠裙、长裤、短裤、连体裤）或用文字描述（由 LLM 选择设置；没有 LLM 时 bitGen 自己读懂文字），用 GarmentCode 自己的设置（滑块、勾选框和列表）修改（每次修改后稍等片刻即重新生成），并查看按女性或男性展示模特的尺寸——或你自己的身高、胸围、腰围和臀围——制作的缝纫纸样；⤓ 按实际尺寸输出 PDF：A4 / Letter / A3 页面，裁边后拼贴（10 厘米测试方块、页面拼图、带字母的对位记号——A 缝 A、布纹线、含或不含缝份），或在复印店打印的一张 A0；你的服装保存在项目中。Settings ▸ Add-ons ▸ Garment designer 安装 GarmentCode（MIT，无需显卡）。*Where:* Character Creator ▸ Sheet ▸ 👗 Garment…；图像编辑器 ▸ 图标栏的 👗 / File ▸ 👗 Garment Designer…。*Since:* 2.932.0
- **🧍 把服装披挂到模特身上** — 在服装设计器中，🧍 Drape on the mannequin 用 Blender 自己的布料模拟把纸样的各片缝合起来，披挂到展示模特身上（手臂抬起，与袖子的裁剪方式一致）：选择面料（棉、针织、丝绸、牛仔布）和颜色，得到正面、侧面和背面视图，→ References（用于 Edit、视频），🧊 把穿好衣服的模特作为图像编辑器中的 3D 图层，⤓ 把披挂好的服装导出为 OBJ。每次披挂都会说明合身程度——缝线是否闭合、是否下滑、是否进入身体。上衣和裙子效果很好；长裤和无袖修身上身可能会下滑（发生时会说明）。需要 Blender。*Where:* 服装设计器 ▸ 🧍 Drape on the mannequin。*Since:* 2.933.0
- **🧍 模特设定表是参照** — 在角色设定表编辑器中选择 🧍 Mannequin…（男性、女性或你自己的）不再把模特当作角色：它的参照表是新设定表遵循的对象——面板、姿势和镜头角度，画在 Layout 框中（Template ▾ 也会显示；选择模板会把它放到一边）——角色来自你 📂 载入或 ✨ 生成的图片；▶ Generate sheet 需要这张图片。bitGen 自己的模特会勾选其参照表中的视图。Dress it 已移除。✨ Lifelike 把正面、侧面和背面并排合成一张参照表。*Where:* Character Creator ▸ Sheet ▸ 🧍 Mannequin…。*Since:* 2.934.0

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
- **使用其他场景的图片；以 🅰 Picture A 生成首帧** — 场景选择器的 🎬 Scenes 标签页（每个场景自身的图片）和 🎞 Clips（任意镜次的帧）；✎ First frame 以选定的 Picture A 为起点（保留风格、构图和姿势），置于新的地点或全局提示词设定的地点，指令由 LLM 编写（🤖 Write）。 *Where:* StoryBoard 场景卡片。 *Since:* 2.563.0
- **StoryBoard 网格；🎞 编写故事板** — 场景以类似 Model manager 的卡片排列在网格中，用 ➜ 指向下一个场景，点击可打开完整的场景卡片；LLM 编写各个场景，每个场景都会以其故事板图片作为起始（First）帧。 *Where:* StoryBoard（▦ / ☰、🎞 Write storyboard、☑ Start on it）。 *Since:* 2.565.0
- **由 LLM 编写的 StoryBoard 图片** — 🖼 将场景发回给 LLM，为其开场帧编写图片提示词，并以角色设定表和上一个场景的最后一帧（若该场景已有镜次）作为参考图；📁 更换图片（其他场景的图片、某个镜次的帧、项目图片或文件）；图片在网格中铺满整张卡片。 *Where:* StoryBoard ▸ ▦ 网格 ▸ 卡片的 🖼 / 📁；工具栏上的 ☑ LLM writes it / ☑ Previous last frame。 *Since:* 2.568.0
- **更快的首帧（Auto）+ Qwen Image 2.1 Turbo8** — 场景卡片的 ✎ 首帧默认为 Auto：已安装时用 Qwen Image Edit 2511 以 4 步生成（Apache 2.0——可以商用），超过三张图片时用 Qwen Image 2.1 edit；新的 Qwen Image 2.1 edit Turbo8 样式让 Qwen 2.1 只需 8 步而非 25 步（Qwen Research License——非商业）。 *Where:* 场景卡片 ▸ ✎ 首帧 ▸ 样式；设置 ▸ 模型 ▸ 模型目录。 *Since:* 2.717.0

### 音乐视频与口型同步

- **加载歌曲** — 歌曲打开后，其波形会自动分段；每段对应一个场景。 *Where:* StoryBoard 的 Audio
- **创建音乐视频** — 编剧把歌曲的各个分段用作场景，并让角色演唱。 *Where:* 提示词面板
- **逐场景口型同步** — 每个场景对自己所对应的那段歌曲进行口型同步。 *Where:* 音乐视频故事板
- **由转录文本决定** — 歌曲带时间戳的转录文本决定哪些场景需要演唱，并把歌词放入提示词。 *Where:* 音乐视频故事板。 *Since:* 2.356.0
- **场景对齐歌曲时间** — 每个镜次都会放到时间线上其对应歌曲部分开始的时间点。 *Where:* Timeline 设置
- **桥接场景** — 歌曲分段之间的短过渡，可由模型渲染，也可绘制为标准转场。 *Where:* 歌曲条的 Transition 选项
- **✂ 歌曲剪切时长** — StoryBoard 歌曲条可按任意间隔自动剪切（2-60 s；29.9 = 每个场景一次 Long video 运行）；已锁定的段落保持不变；设置会被记住。 *Where:* 歌曲条的菜单栏 ▸ ✂ [s]。 *Since:* 2.573.0

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
- **OpenJutsu 引擎** — D3voz 的 OpenJutsu 工作流：SAM 3.1 跟踪人物（1-4 个带角色的人，或要更换、移除、作为背景的物体），灰色人体模型传递动作，MiniMax H3 只重绘这些部分；每段最长一分钟；👁 检查遮罩、🎨 修正颜色和可选的 🙂 修正面部（非商业 / AGPL-3.0 模型）。*位置：* Swap 对话框的 Engine ▸ OpenJutsu；Settings ▸ Add-ons ▸ OpenJutsu swap。*版本：* 2.949.0
- **VR 替换** — 通过虚拟摄像机替换 360 度或 180 度视频中的人物；立体双眼画面根据深度重建。 *Where:* Swap 对话框的 VR 一行

### VR

- **VR 世界** — 把表演者置于 360 度或 180 度图片之中：调整摄像机朝向，添加表演者的图片、声音和提示词，并带 VR 元数据进行渲染。 *Where:* StoryBoard 的 VR World 按钮
- **锁定背景** — 表演者以外的区域，双眼都直接显示图片本身。 *Where:* VR World
- **🌐 用图片生成 360 度全景** — 把一张或多张图片放到球面上（拖动来转动位置，鼠标滚轮决定它占视野的多少）；其余部分由 Qwen Image 2.1 加社区的 360 度外扩 LoRA（研究许可：非商业）填充成一张无缝的 360 度图片。结果作为新图片打开；↔ 修复接缝 重新填充左右接缝，🌐 环顾 从内部观看，🥽 用于 VR 世界 把它设为 VR 世界的场景。*位置：* 图像编辑器 - 图像 ▸ 🌐 360 Panorama…。*版本：* 2.971.0

### 放大与增强

- **SeedVR2 放大** — 把视频放大到 720p-4K 或按倍数放大，支持颜色匹配、时间分段和降噪。 *Where:* 预览栏。 *Since:* 2.400.0
- **⏫ 图片的 Enhance** — 点击一张图片（图库的 Images、Image 素材、参考面板），⏫ Enhance 就会放大它：×2–×4 或短边 1080–2160 px，可用 SeedVR2（恢复细节）、ComfyUI 的 models/upscale_models 中的放大模型，或不需要 ComfyUI 的 Lanczos；结果是图库中的 PNG。 *Where:* 提示词面板的 ⏫ Enhance。 *Since:* 2.733.0
- **DLSS 5 增强、放大与帧生成** — 对视频进行 NVIDIA DLSS 5 神经渲染（default / natural / cinematic），放大到 1x DLAA、1.5x-3x 或 1K-8K，并可选用帧生成，最高可达原帧率的 6 倍；仅限 RTX 显卡。 *Where:* 预览栏的 ⚡ DLSS 5，以及故事板上 StoryBoard 的 ⚙ Upscaler。 *Since:* 2.504.0
- **RTX VFX 视频精修** — 对视频进行 NVIDIA RTX Video Super Resolution 处理，可选先进行一遍 Deblur，再进行一遍 High Bitrate（预设 A：VSR；预设 B：先 Deblur，再 High Bitrate；或自行选择处理步骤），缩放 1x-4x，每次处理一批帧；适用于 Windows 上的 RTX 显卡，通过 DENO ComfyUI 节点实现。 *Where:* 预览栏的 ✨ RTX VFX、StoryBoard 的 ⚙ Upscaler，以及用于安装的 Settings > ComfyUI > Video accelerators。 *Since:* 2.708.0
- **RelayVSR 放大** — 在 ComfyUI 自带节点中运行的一步视频放大器：x2（用 MiniMax H3 片段训练）或 x4，auto 会选择能达到所选尺寸的那一对；正好 1920 × 1080（先覆盖再裁切）或任意尺寸，保留原来的声音。 *Where:* 预览栏的 🔁 RelayVSR、StoryBoard 的 ⚙ Upscaler，文件在 Settings > Add-ons > RelayVSR。 *Since:* 2.728.0
- **增强所选视频** — 为你最后点击的视频打开放大器。 *Where:* 提示词面板。 *Since:* 2.401.0
- **在故事板上放大** — 把你满意的镜次送入 StoryBoard 的放大器，或以放大分辨率使用 SeedVR2 处理；也可以选择放大每一次渲染。 *Where:* StoryBoard 设置

### 音效（SFX 面板）

- **添加声音和视频** — 音频文件以及视频文件中的声音，以 48 kHz WAV 格式保存。 *Where:* SFX 面板
- **剪辑声音** — 在波形上选择，设置固定时长框，保留或删除所选部分（带无爆音的淡入淡出），可撤销。 *Where:* SFX 面板
- **发送到图库和素材** — 每次剪辑的结果都会复制到图库；也可以将其发送到 Sound 素材。 *Where:* SFX 面板

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
- **🩺 风格诊断** — 一键用每种图像风格生成一张小测试图（Quick：512 × 512，4 步；或 Real），并显示通过 / 失败表格：失败的日志行及处理方法（ComfyUI 未列出的模型及其应放入的文件夹、缺少的节点包、ComfyUI 未运行、显存不足、文件损坏、文本编码器不匹配）。■ 停止，↻ 重测单项，⤓ 将报告导出为 .md。 *Where:* 菜单栏中的 🩺. *Since:* 2.527.0
- **编辑图像模式只显示编辑风格** — 图像编辑器打开时，图像风格下拉列表只列出能够编辑图片的风格，关闭编辑器后恢复你原来的选择。 *Where:* 提示词面板. *Since:* 2.502.0
- **用任意风格 + 它的基本设置 Change style** — 图像预览中 🎨 Change style 旁边：风格下拉列表（提示词的风格或任意图像风格）和 ☐ Basic Settings（该风格上次的步数、CFG、种子和检查点）；只在显示图片时出现。*Where:* 图像预览。*Since:* 2.805.0
- **MOSS-Image** — OpenMOSS 的 5B 图像模型，提供两种图像风格（SFT、Base）；Settings ▸ Add-ons ▸ MOSS-Image 会将你勾选的模型、文本编码器和 VAE 下载到 ComfyUI 中，并检查 ComfyUI 版本是否足够新。 *Where:* Settings ▸ Add-ons；Settings ▸ Image（各风格）。 *Since:* 2.566.0
- **NitroFusion2 图像** — 把 Z-Image-Turbo 蒸馏到 1-2 步：一步就有清晰的文字和细节；三个风格（1 步、配合去蒸馏 LoRA 的 2 步、适合小显卡的 GGUF），cfg 1，无负面提示词。 *Where:* Image 停靠栏的风格，文件在 Settings > Add-ons > NitroFusion2。 *Since:* 2.729.0
- **Fibo 2.0（编辑，低显存）** — Bria 的 8B 模型，提供两种图像风格：Edit Turbo（4 步指令编辑）和 Dev（文生图 + 编辑）；最多 4 张图片 <image_1>..；w4a8 或 GGUF Q4_0 文件适用于约 8 GB 显存的显卡；从 Settings ▸ Add-ons ▸ Fibo 2.0 下载（CC BY-NC 4.0）。 *Where:* image editor ▸ ✨ AI ▸ Edit；Settings ▸ Image。 *Since:* 2.582.0
- **恢复内置风格** — ↺ Built-in 列出缺失的内置图像或视频风格并将其恢复；Krea 2 风格会自动恢复一次。 *Where:* Settings > Image styles / Video styles。 *Since:* 2.547.0
- **P-H3 Image** — PrunaAI 基于 MiniMax H3 的图像模型：*P-H3 Image* 风格（文生图，4-8 MP）和 *P-H3 Image Edit*（最多借助 7 张参考图编辑图片，被编辑的是 `<image1>`）；它自带的提示词扩写器会把简短的请求扩写成完整的提示词。Settings ▸ Add-ons ▸ P-H3 Image 会下载其 LoRA、文本编码器、VAE 和扩写器（约 17 GB），配合视频已在使用的 MiniMax H3 FL2VA transformer。需要带 P-H3 节点的 ComfyUI（master / nightly，0.44）；MiniMax H3 Community License。 *Where:* Settings ▸ Image ▸ P-H3 Image / P-H3 Image Edit。 *Since:* 2.678.0
- **🎨 为图片更换风格** — 图像预览的外观下拉菜单 + 🎨 Change style（2.681.0：所选外观会保持选中）会使用提示词的图像风格，把当前显示的图片重新生成为 📷 Photoreal、🧸 Pixar、🧊 2.5D、🌸 Anime 或 🖍 Cartoon（编辑模型按指令修改并保留原图；SDXL / FLUX 风格则对整张图片进行精修）；开启 Override style 时，Basic Settings 中的步数、CFG、种子、检查点（checkpoint）和 LoRA 会一并使用；结果在预览中打开；图片下方的进度条显示各步骤（2.677.0）；⇆ Before / after 将原图与结果并排显示（2.679.0）。（2.685.0：SDXL / Pony / Illustrious 风格用其自己的工作流重新生成，因此 Override 对其生效；进度条会说明 Override 应用了哪些设置）（2.686.0：非编辑模型的风格会先绘制 ✏ 线稿，再通过其模型系列的线稿 ControlNet 从线稿渲染出该外观） *Where:* 任意图像预览 ▸ 外观下拉菜单 ▸ 🎨 Change style。 *Since:* 2.676.0

### ControlNet 与面部修复

- **ControlNet** — 先渲染第一张图片，将其转换为控制图（线稿、深度、姿态），再用第二个模型渲染最终图片。 *Where:* Basic Settings
- **ControlNet 链式风格** — 按名称保存的两阶段风格。 *Where:* Settings > ControlNet. *Since:* 2.97.0
- **面部修复** — 重新绘制最终图片中的每一张脸；自 2.593.0 起为附加组件（在 Settings ▸ General 中开启，其模型会自动下载）。 *Where:* Basic Settings

### 将图片送入图像编辑器

- **生成的图片直接放到画布上** — 图像编辑器打开时，Generate 生成的每张图片都会作为新图层放到最前面的文档中。 *Where:* 提示词面板. *Since:* 2.431.0
- **由图片生成 3D 模型** — Gallery 和 Assets 中的每张图片都可以变成 3D 模型（Hunyuan3D 2.1 或 TRELLIS.2）。 *Where:* 每张图片上的 3D 按钮. *Since:* 2.404.0
- **🧊 转换为 3D（右键）** — 右键点击 Gallery、Assets 或 References 中的图片，或图像编辑器的画布（整张图片或所选图层，也可用 Layer ▸ Convert Layer to 3D），选择 Hunyuan3D 2.1 或 TRELLIS.2 以及模型的去向：图像编辑器（一个可环绕查看、渲染并据此生成内容的 3D 图层）、SolidCraft 面板，或仅放入项目的 3D 模型中。 *Where:* 右键点击图片. *Since:* 2.594.0

## 模型、远程生成和 Pod

所有模型集中在一处；在 RunPod Pod、OpenRouter 和其他在线服务上生成；每项任务使用指定的显卡；全部费用一目了然；还能训练你自己的模型。

### 模型和模型管理器

- **可管理数百个模型的模型管理器** — 适应面板大小的分页、文件夹标签页（SDXL、Pony …）、📌 This project 标签页、可调整大小的卡片、每个模型的信息页（含示例图片和提示词），每个模型的 Civitai 详情 + 缩略图 + 示例都保存在一个共享的 model_info 文件夹中。 *注意：* Civitai 自 2026 年 3 月 16 日起屏蔽澳大利亚用户，因此在澳大利亚无法使用其中的 Civitai 部分。 *Where:* 🧩 Models。 *Since:* 2.537.0
- **Civitai 下载到各类型的文件夹** — 任意 Civitai 卡片上的 ⤓ 会下载到你为该类型选定过一次的文件夹（SDXL LoRA、Pony 模型、Wan LoRA …）；Shift+点击可更改；📁 列出这些文件夹（model_folders.json）；🔄 Sync 为电脑上的每个模型获取 Civitai 详情。 *注意：* Civitai 自 2026 年 3 月 16 日起屏蔽澳大利亚用户，因此在澳大利亚无法使用其中的 Civitai 部分。 *Where:* 🧩 Models。 *Since:* 2.538.0
- **模型管理器** — 以卡片形式展示你的模型和 LoRA（缩略图、评分、发布日期、类型、类别、关键词；悬停时显示说明卡片），选择一个模型和若干 LoRA，用它们覆盖风格，✚ 以某个模型新建风格，✎ 编辑卡片，🔍 在 Civitai 上查找。 *注意：* Civitai 自 2026 年 3 月 16 日起屏蔽澳大利亚用户，因此在澳大利亚无法使用其中的 Civitai 部分。 *Where:* 状态栏中的 🧩 Models. *Since:* 2.518.0
- **Civitai 下载** — 搜索 civitai.red / civitai.com，并连同卡片直接下载到对应的 ComfyUI 文件夹。 *注意：* Civitai 自 2026 年 3 月 16 日起屏蔽澳大利亚用户，因此在澳大利亚无法使用其中的 Civitai 部分。 *Where:* Model manager 的 Civitai 选项卡；密钥在 Settings ▸ General 中设置. *Since:* 2.518.0
- **Model manager 中的 Civitai 筛选** — 全部 / 检查点 / LoRA（以及 VAE、Embedding、ControlNet、Upscaler）、模型系列（来自 Civitai 自己的列表，Krea、Flux、Qwen 等系列的全部基础模型，或只选一个）、排序方式和时间段；更改后立即重新搜索，筛选条件会被保留。 *注意：* Civitai 自 2026 年 3 月 16 日起屏蔽澳大利亚用户，因此在澳大利亚无法使用其中的 Civitai 部分。 *Where:* Model manager ▸ Civitai。 *Since:* 2.766.1
- **Model manager：Local、RunPod、OpenRouter + ☁ OpenRouter 标签页** — Models / LoRAs 标签页把本机文件、pod 上的文件和你的 OpenRouter 模型一起列出并加标签；用 ☐ Local ☐ RunPod ☐ OpenRouter ☐ All 筛选；🗑 删除本机文件，或把 pod 文件 / OpenRouter 模型从列表中移除；☁ OpenRouter 标签页按类型和系列列出 OpenRouter 的模型，带 Free / Paid 和排序，＋ 把模型连同端点加入你的模型。*Where:* 🧩 Model manager. *Since:* 2.790.0
- **你的 OpenRouter 模型显示为绿、橙、红** — OpenRouter 对话框已移除：🧩 Model manager ▸ ☁ OpenRouter 管理你的列表（🖥 GPU 的按钮会打开它）；你的模型在该标签页和 Models 标签页中以深绿（免费）、深橙（付费）或深红（OpenRouter 已不再列出——保留到你 🗑 为止，不出现在下拉列表中，渲染被拒绝）的边框显示。*Where:* 🧩 Model manager. *Since:* 2.792.0
- **模型管理器的来源；GPU 停靠栏** — 🧩 Model manager ▸ ＋ Add source 可为任何模型 API 建一个标签页：⚙ Settings 中设置 URL、API 密钥（加密保存）和格式（OpenAI 兼容、Ollama、Anthropic 风格或你自己的模板），✓ Test 列出它的模型并显示 bitGen 填好的端点；＋ 把模型加入你的模型，你的 LLM / 视觉模型会以 <source>/<model> 出现在提示词停靠栏的列表中，通过该来源聊天。☁ Remote generation 停靠栏现在叫 🖥 GPU。*Where:* 🧩 Model manager, the prompt docker, 🖥 GPU. *Since:* 2.795.0
- **模型管理器的筛选改为下拉列表** — 位置（All places / This computer / RunPod / OpenRouter，带数量 - 之前什么都筛不掉，已修复）、文件夹、Civitai 的类型、OpenRouter 的类型和价格都改成了下拉列表；标签栏的工具改为图标。*Where:* 🧩 Model manager. *Since:* 2.796.0
- **模型管理器：你的文件、缩略图、元数据** — 模型的图片 / 视频 / 声音及其提示词 + 种子 / cfg / 步数（从文件或渲染记录中读取），点击打开查看器，✎→ 发送到提示词，🖼 设为缩略图。 *Where:* 🧩 Model manager ▸ ⓘ ▸ Your pictures, videos and sounds；✎ Edit ▸ Thumbnail。 *Since:* 2.575.0
- **模型管理器：半星评分、模型类型、NSFW** — 以半星为单位的五星评分编辑器、模型类型（检查点（checkpoint）、LoRA …）以及 NSFW 标记；筛选栏可按这两项筛选。 *Where:* 🧩 Model manager ▸ ✎ Edit；筛选栏。 *Since:* 2.575.0
- **状态栏中的 Civitai 同步** — 同步时显示 🔄 Civitai n/total，完成时显示 ✓ synced 及各项计数。 *注意：* Civitai 自 2026 年 3 月 16 日起屏蔽澳大利亚用户，因此在澳大利亚无法使用其中的 Civitai 部分。 *Since:* 2.575.0
- **按 SHA-256 进行 Civitai 同步** — 按名称找不到的模型会按文件内容查找；状态栏显示读取进度 n%。 *注意：* Civitai 自 2026 年 3 月 16 日起屏蔽澳大利亚用户，因此在澳大利亚无法使用其中的 Civitai 部分。 *Where:* 🧩 Model manager ▸ 🔄 Sync。 *Since:* 2.576.0
- **从磁盘删除模型** — 删除该文件、其旁边的相关文件以及它的 model_info 页面，删除前会弹出确认，列出这些文件及使用该模型的风格。 *Where:* 🧩 Model manager ▸ 卡片上的 🗑 / ⓘ ▸ 🗑 Delete。 *Since:* 2.579.0
- **Civitai 视频和动态图片** — 🔄 Sync / ⤓ Civitai info 也会保存模型的视频和 GIF 示例；视频缩略图在卡片及其 ⓘ 页面上播放，查看器也可播放；视频可用作卡片的缩略图。 *注意：* Civitai 自 2026 年 3 月 16 日起屏蔽澳大利亚用户，因此在澳大利亚无法使用其中的 Civitai 部分。 *Where:* 🧩 Model manager。 *Since:* 2.581.0

### 远程生成和 OpenRouter

- **远程 GPU** — 使用另一台机器上的 ComfyUI、RunPod pod（列出 / 启动 / 停止，以及其代理）或 SSH 隧道；✓ Test；Use it / Use this computer。 *Where:* Settings ▸ Remote generation. *Since:* 2.520.0
- **☁ RunPod Serverless 渲染** — 所有渲染都发送到 RunPod Serverless 端点（RunPod 的 ComfyUI 工作器，模型在网络卷上），只在工作器运行时计费；图片、视频和歌曲都会传回；✓ 测试显示工作器和任务。 *Where:* 设置 ▸ 远程 GPU ▸ RunPod Serverless。 *Since:* 2.743.0
- **☁ RunPod Serverless 只显示能渲染的风格** — 用 RunPod Serverless 端点渲染时，图片、视频和音乐的风格列表会隐藏它无法渲染的风格（逐个节点对照端点镜像里的 ComfyUI）；可以设置更新的 ComfyUI 或额外的节点包。 *Where:* 风格列表；设置 ▸ 远程 GPU ▸ RunPod Serverless。 *Since:* 2.744.0
- **🖥 基本设置 ▸ GPU：远程、本地或两者** — 所有任务在远程 GPU 上、全部在这里，或“两者”：勾选的 LLM、视觉 LLM、图片和视频 + 歌曲发送到远程 GPU；LLM 在 RunPod vLLM 端点上运行（设置 ▸ 远程 GPU ▸ LLM on RunPod）。 *Where:* 基本设置 ▸ GPU。 *Since:* 2.745.0
- **🏷 远程风格** — 每个图片、视频和音乐风格在这台电脑或远程 GPU 上运行（运行于，可选为风格指定自己的 RunPod 端点；远程风格的名称以 R_ 开头）；基本设置 ▸ GPU 为本地时列出这台电脑的风格，远程时列出 R_ 风格，两者时列出全部 - 选两者时由风格决定在哪里渲染。 *Where:* 设置 ▸ 图片 / 视频 / 音频 ▸ 音乐风格 ▸ 运行于；基本设置 ▸ GPU。 *Since:* 2.746.0
- **🖥 GPU 默认为本地；更新检查很快** — 基本设置 ▸ GPU 从本地开始，位于基本设置第一项并收起（标题显示选择）；更新检查只向 GitHub 询问最新提交，任何网络都能几秒完成，立即更新 在后台下载。 *Where:* 基本设置 ▸ GPU；设置 ▸ 常规 ▸ 更新。 *Since:* 2.747.0
- **☁ 为 RunPod 准备的现成远程风格** — R_SDXL（+ img2img）、R_FLUX.1 schnell / dev / dev fp8、R_SD3 Medium 和 R_Z-Image Turbo，各自对应 RunPod 的一个标准 worker-comfyui 镜像（无需上传）；工作室向 RunPod 询问端点的镜像并只列出适合的风格；日志说明任务在哪里渲染以及在那里的大致费用。 *Where:* 基本设置 ▸ GPU 远程 / 两者；设置 ▸ 远程 GPU ▸ RunPod Serverless ▸ 端点的镜像。 *Since:* 2.749.0
- **🧠 OpenRouter 上的 LLM（免费模型）+“远程生成”** — 剧本写作、提示词辅助和图片描述可以在 OpenRouter 上运行：一个 API 密钥（加密保存）、免费模型（或显示每百万 token 价格的付费模型）、用于图片的视觉模型、✓ Test；不需要远程 GPU - 图片、视频和歌曲仍在这里渲染。设置中的 Remote GPU 标签页现在叫 Remote generation（远程生成）。 *Where:* Settings ▸ Remote generation ▸ 🧠 LLM ▸ OpenRouter；Basic Settings ▸ GPU 选 Both 并勾选 LLM / Vision LLM。 *Since:* 2.753.0
- **☁ 使用远程生成 + 远程生成停靠窗 + Pod 快捷方式** — 一个复选框开启或关闭远程生成（关闭：一切在这里运行，基本设置 ▸ GPU 隐藏）；从 基本设置 ▸ GPU（而不是状态栏）打开的浮动停靠窗显示任务在哪里运行、你的 RunPod Pod（开始 / 停止 / 使用）以及 Pod 快捷方式：用链接添加的 RunPod 模板，部署 ↗ 会打开已选好该模板的 RunPod。 *注意：* 自 2.780.0 起不再有模板浏览器——Pod 都是 bitGen Pod，用 bitGen 选定的模板创建。 *Where:* Settings ▸ Remote generation ▸ Use remote generation；Basic Settings ▸ GPU ▸ 🖥 GPU docker。 *Since:* 2.754.0
- **🔑 设置 ▸ API：在线服务作为 API_ 风格 + LLM** — 添加 OpenRouter、fal.ai、Replicate、OpenAI、Google Gemini、Claude 或 RunningHub 的 API 密钥（根据密钥识别服务），起个名字并勾选“使用”：它的 API_ 风格（服务能生成的图片、视频、歌曲）会出现在风格列表中，并在服务端生成，这台电脑不需要显卡或 ComfyUI；每个风格的模型都可以修改（RunningHub 为工作流 ID），✓ Test 检查密钥，“用作 LLM”把提示词 LLM、字幕和分镜列表发送到该服务（Claude 只用作 LLM）；密钥加密保存。 *Where:* Settings ▸ API；风格的 Runs on ▸ API。 *Since:* 2.757.0
- **本地 / 远程切换整个应用** — 在基本设置中选择本地：列表和文件夹筛选显示本机的模型文件夹，ComfyUI 未运行时会启动；选择远程（Pod）：停止 bitGen 在本机启动的 ComfyUI，列出远程模型，文件夹筛选改为显示它们的模型系列（Krea、Flux、Pony 等）以供筛选。 *Where:* 基本设置 ▸ GPU；模型下拉框；Model manager。 *Since:* 2.766.2
- **远程模式下的 LLM、Vision LLM 和视频风格** — LLM 和 Vision LLM 各自可在本地、OpenRouter（在基本设置中即可搜索并选择模型；推理开启，每轮都会传回 reasoning_details）或 RunPod（你的 Pod 用 llama.cpp 运行同一个 GGUF，首次发送提示时完成设置）上运行；选择远程后，所选视频风格的模型会立即送到其 Pod。 *Where:* 基本设置 ▸ GPU；设置 ▸ Remote generation ▸ OpenRouter。 *Since:* 2.767.0
- **远程选项移到专用停靠窗，提示停靠窗显示远程模型列表** — 基本设置 ▸ GPU 只保留本地 / 远程 / 两者；远程选项（服务器、Pods、LLM / Vision LLM 的选择、💲 RunPod）移到 🖥 GPU 停靠窗。远程模式下，提示停靠窗的 LLM 和 Vision 列表显示 OpenRouter 的免费模型（默认）、你的 Pod 的 GGUF 或 vLLM 端点的模型；选择后即保存，不会在本机加载任何模型。 *Where:* 🖥 GPU 停靠窗；提示停靠窗 ▸ LLM / Vision。 *Since:* 2.768.0
- **LLM 本地 / 远程，带搜索和 ☰ All 的 OpenRouter 列表** — Remote generation 停靠窗的 LLM 和 Vision LLM 只有本地或远程（远程为设置中选择的平台，默认 OpenRouter）；设置 ▸ OpenRouter 中“显示免费”“显示付费”；提示停靠窗的列表每次显示 10 个并可搜索，☰ All 打开所有 OpenRouter 模型，可筛选、排序并查看详情，按 Use 即设定。 *Where:* 🖥 GPU 停靠窗；设置 ▸ Remote generation ▸ 🧠 LLM；提示停靠窗。 *Since:* 2.770.0
- **每种类型都可选本地或远程，并分区显示** — 远程生成停靠窗按主题样式分区：远程服务器；生成（图像、视频、音乐）；语言模型（LLM、视觉 LLM）；音频（语音合成、语音识别、歌曲分离）——每项在同一列中选择本地或远程，并显示去向。 *Where:* ☁ 远程生成停靠窗。 *Since:* 2.776.0
- **浮动停靠窗置前；每种类型 Local 或 Remote；RunPod 的选择移到设置** — 变为浮动的停靠窗会立即置于其他停靠窗之前（包括 ▣ 停靠窗）；🖥 GPU 停靠窗中 Image / Video / Music 的 Local / Remote 决定该类型的模式（全部 Local = 本地模式；混合 = 保留本机的 ComfyUI 并列出两种模型列表）；RunPod ▸ Pods / Serverless 移到 Settings ▸ Remote generation；Pod 的 ComfyUI 也把文本编码器和 VAE 留在显卡上（--highvram）。 *Where:* 停靠窗、🖥 GPU、Settings ▸ Remote generation。 *Since:* 2.782.1
- **System 停靠窗;状态栏上的 Remote 和 Pods;全部本地 / 全部远程 / Both** — 左侧停靠窗改名为 System;全部在 Pod 上运行时图表显示 Pod 的数据,一部分在本机、一部分在 Pod 上时本机的图表保持不变,Pod 的数据在下方的 ☁ 框中;Basic Settings ▸ GPU 已移除 - 全部本地 / 全部远程 / Both 位于 🖥 GPU 停靠窗最上方(某一行改回 Local 时全部远程会切换为 Both);状态栏上的 Remote 打开该停靠窗,Pods 打开 PODS,且只在有工作远程运行时显示。 *Where:* System 停靠窗、状态栏、🖥 GPU。 *Since:* 2.783.0
- **Runs on:每种类型一个下拉框** — 🖥 GPU 停靠窗最上方有 Image、Video、Music、Text to speech、Speech to text、Song separation、LLM 和 Vision LLM 的下拉框:Local、RunPod(你的 Pod)、OpenRouter(目前仅 LLM)、LAN 和 Team(可用前显示为灰色);全部设置可一次更改所有行;单选按钮已移除;只有某行为 RunPod 时状态栏才显示 Pods。 *Where:* 🖥 GPU、状态栏。 *Since:* 2.785.0
- **OpenRouter models;在 OpenRouter 上生成图片和视频** — 🖥 GPU ▸ OpenRouter models… 按系列列出 OpenRouter 的图片、视频、LLM 和 Vision LLM 模型及价格(免费或付费);双击即可加入你的列表(🗑 移除);你的模型以 openrouter/<model> 出现在 Basic Settings 的 Model 列表和提示词停靠窗的 LLM / Vision 列表中(其他条目保留);Use model + openrouter/ 模型,或 Runs on ▸ Image / Video = OpenRouter,会在显示价格的对话框之后在 OpenRouter 上生成图片或视频;💲 Costs 会统计它们;OpenRouter 不再列出的模型会离开你的列表。 *Where:* 🖥 GPU、Basic Settings、提示词停靠窗。 *Since:* 2.786.0
- **团队 ▸ 渲染农场** — 基于 NAS 文件夹的团队：负责人审批成员，其 bitGen 每天为每位成员签发一个签名密钥；所有人打开相同的项目；PC 的所有者可允许成员在该 PC 上渲染（不限时段或指定起止时间），且仅在该 PC 运行 bitGen 并开启共享时有效；🖥 Render on: This PC / 某位成员的 PC / ⚡ Spread，并显示团队的渲染任务和进度。需处于同一网络或使用 Tailscale。2.589.0：改为可选的附加组件（单独的 zip——可能会触发杀毒软件）。 *Where:* Settings ▸ Add-ons ▸ Team render farm，然后 Settings ▸ Team；状态栏的 🖥 状态标签。 *Since:* 2.583.0

### RunPod 的 Pod

- **🖥 PODS 停靠窗 + RunPod 的 Serverless 或 Pod** — 基本设置 ▸ GPU 选择远程服务器（RunPod 或 OpenRouter），RunPod 再选 Serverless 或 Pod；选择 Pod 时，PODS 停靠窗列出 RunPod 的公开模板（官方 / 已验证 / Community、仅 ComfyUI、搜索），创建 Pod（带 RunPod 实时价格的 GPU、Secure / Community 云、磁盘大小、每小时估算），并可开始、停止、使用或终止你的 Pod（🅱 = bitGen 的）。 *注意：* 自 2.780.0 起不再有模板浏览器——Pod 都是 bitGen Pod，用 bitGen 选定的模板创建。 *Where:* Basic Settings ▸ GPU ▸ Remote servers；Basic Settings ▸ GPU ▸ 🖥 PODS。 *Since:* 2.756.0
- **🃏 每个 RunPod 模板都是一张卡片** — PODS 停靠窗一次列出 RunPod 的全部公开模板（全部 / 官方 / 已验证 / 社区，各带数量），每个模板一张卡片（带首字母的色块、NVIDIA / AMD / CPU 和 ComfyUI 标记；名称、镜像、分组、磁盘、/workspace 和 Web 端口；创建 Pod… 和 ↗ 其页面），边输入边搜索（每个词：名称、镜像、端口、种类、分组）和种类筛选；“仅 ComfyUI”一开始是关闭的。*Where:* Basic Settings ▸ GPU ▸ 🖥 PODS。 *注意：* 自 2.780.0 起不再有模板浏览器——Pod 都是 bitGen Pod，用 bitGen 选定的模板创建。 *Since:* 2.756.1
- **🧩 P_ Pod 风格 + Pod 加载进度条** — 基本设置 ▸ GPU 为 RunPod ▸ Pods 时只显示 P_ 风格；在已加载的 Pod 上按 🎨 Styles 会读取它的 ComfyUI，从模型文件（bitGen 为 Qwen Image、Z-Image、Krea 2、FLUX、SDXL 准备的工作流，填入 Pod 的文件）和模板保存的工作流创建 P_ 风格；Override style 为 P_ 风格提供步数、种子、CFG、尺寸和宽高比（从不提供检查点或 LoRA）；启动中的 Pod 用进度条显示阶段，以及相对上次加载时间的已用时间；你的 Pod 和 Pod 快捷方式（模板卡片上的 ☆、★ Shortcuts - 链接自动填入）在 PODS 停靠窗中。 *注意：* 自 2.780.0 起不再有模板浏览器——Pod 都是 bitGen Pod，用 bitGen 选定的模板创建。 *Where:* Basic Settings ▸ GPU ▸ 🖥 PODS ▸ My pods ▸ 🎨 Styles；风格的 Runs on ▸ RunPod pod。 *Since:* 2.758.0
- **⬇ 把模型下载到 Pod + 为风格选 Pod** — PODS 停靠窗的 For … 把适合某个 bitGen 风格的模板排在前面（✓ fits），这样创建的 Pod 加载后会自动得到该风格的 P_ 风格；⬇ Models 把风格的文件（或 bitGen 下载列表中的单个文件）下载到 Pod 的 ComfyUI，每个文件一条进度条，通过 Pod 的 Jupyter（bitGen 创建的 Pod 使用 bitGen 自己的密码，或粘贴密码）或 ComfyUI-Manager（只限其列表）；也可以从链接（Civitai、Hugging Face、任何网址）或这台电脑的磁盘放入单个文件。 *注意：* 自 2.780.0 起不再有模板浏览器——Pod 都是 bitGen Pod，用 bitGen 选定的模板创建。 *Where:* Basic Settings ▸ GPU ▸ 🖥 PODS ▸ For …；My pods ▸ ⬇ Models。 *Since:* 2.759.0
- **🎵 Audio 停靠栏 + 以你的货币显示价格 + 🖥 My pods** — Music、SFX 和 Edit Booth 是同一个 Audio 停靠栏的标签页（Stems 到 2.966.0 为止）（状态栏上一个按钮；屏幕上一次只有一个标签页，上次选的会回来）；设置 ▸ General ▸ Currency 把美元价格（RunPod 的 GPU 和 Pod、OpenRouter 的模型、远程 GPU）以 AUD、EUR、GBP、CNY、JPY 等显示，按当天的参考汇率（保存以便离线使用）或你输入的汇率，悬停可见美元；PODS 停靠栏的 🖥 My pods 只显示 Pod，Create pod… 只显示表单，新建的 Pod 出现在 My pods 中。 *Where:* 状态栏 ▸ Audio；设置 ▸ General ▸ Currency；Basic Settings ▸ GPU ▸ 🖥 PODS ▸ 🖥 My pods。 *Since:* 2.760.0
- **🖥 作为条目的 Pod + 它们的费用 + 重新创建 Pod** — My pods 中的每个 Pod 都是一个条目（点名字展开）：Video、LLM、vLLM、Image、Image edit 勾选项，💾 Save（有更改才可用）为勾选的类型创建 Pod 的 P_ 风格，并让 LLM / 描述图片的 LLM 使用 Pod 自己的 OpenAI 兼容服务器；在其 checkpoints / loras 中 📁 New folder，从这台电脑 ➕ Checkpoint 和 ➕ LoRA；Basic Settings ▸ GPU 每分钟显示 Pod 的费用（当前运行、RunPod 今天和本月的账单），📊 Usage 按天记录；P_ 风格保存其 Pod 的配方（模板、GPU、大小、文件）——用它渲染时会启动已停止的 Pod 或创建新 Pod 并把文件放回（从这台电脑，否则从链接）。 *Where:* Basic Settings ▸ GPU ▸ 🖥 PODS ▸ 🖥 My pods；Basic Settings ▸ GPU（💲）。 *Since:* 2.761.0
- **🧩 每个 Pod 一个检查点——Pod 就成为这个风格** — Pod 的 Checkpoint 和 LoRAs 使用 Basic Settings 的 Override 下拉框（这台电脑的 ComfyUI 模型）；💾 Save 用 bitGen 为该模型系列准备的工作流（Krea 用 Krea 工作流）创建 P_<Pod>，Pod 上已有就直接选用，否则在后台发送一次到相同的子文件夹；Override style 开启且选中 P_ 风格时，Basic Settings 的检查点会在渲染前发送到 Pod 并在那里使用。 *Where:* Basic Settings ▸ GPU ▸ 🖥 PODS ▸ 🖥 My pods ▸ 某个 Pod；Basic Settings ▸ Override style ▸ Checkpoint。 *Since:* 2.762.0
- **🧩 你的风格在你的 Pod 上** — 不再生成 P_ 副本：在 RunPod Pods 上显示你自己的风格，每个都在一个 Pod 上渲染 - 先是风格自己的 Pod（Pod 的 Styles：Generate 模式风格的下拉列表，或 All），再是为该类型勾选的 Pod（Image、Image edit、Video - 每种类型一个 Pod，或全部放在一个 Pod 上），再是正在使用的 Pod；💾 Save 在 Pod 上把它们准备好（目录中的文件由 Pod 自己下载，其余从这台电脑发送，缺少的节点包通过它的 Jupyter 安装并重启 ComfyUI）；没有 Pod 的风格在渲染前询问：用 RunPod 的 ComfyUI CUDA 13 模板创建 Pod（Secure / Community、⭐ 显存足够的最便宜 GPU、每小时价格、磁盘），或使用你的某个 Pod - 然后建立关联；已停止的 Pod 会被启动，已不存在的会重新创建。 *Where:* Basic Settings ▸ GPU ▸ 🖥 PODS ▸ 🖥 My pods ▸ Pod ▸ Styles；按 Generate 时的询问框。 *Since:* 2.763.0
- **🖥 你的自定义节点上 Pod + Pod 在做什么** — bitGen 为风格创建的 Pod 会装上这台电脑 ComfyUI 的所有自定义节点包（git 包在 Pod 上按相同版本 clone，其余的以及私有的打成 zip 上传；.disabled 的和 Pod 上已有的保持不动），然后重启它的 ComfyUI（ComfyUI-Manager，否则重启 Pod）；⬆ My custom nodes 可对任何 Pod 这样做；风格缺少的节点来自这台电脑 ComfyUI 指出的节点包；状态栏上方的一行显示等待中的渲染的 Pod 在做什么，无法使用的 Pod 会带着原因停止渲染；在 Both 下有 Pod（自己的或其类型的）的风格会送到那个 Pod。 *Where:* 🖥 PODS ▸ 🖥 My pods ▸ Pod ▸ ⬆ My custom nodes；渲染等待时的状态栏上方。 *Since:* 2.763.1
- **🖥 Pod 渲染不用这台电脑的 ComfyUI** — 送到 RunPod Pod 的渲染会立即发送：不启动这台电脑的 ComfyUI，也不拿风格去对照它的模型列表或下拉列表（文件会放到 Pod 上）；失败的渲染的原因（[pod] / [gpu] / 错误行）会在日志的“that one failed”之后显示。 *Where:* Pod 模式下的 Generate；日志。 *Since:* 2.763.2
- **🖥 没有 Pod 的风格打开 PODS 停靠窗** — 用没有 Pod 的风格按 Generate 会打开 PODS 停靠窗：横幅说明等待中的渲染，创建表单已在 RunPod 的 ComfyUI CUDA 13 模板上打开，风格、其类型、bitGen 推荐的 GPU、GPU 数量和磁盘都已填好（都可以改）；你的 Pod 上有 ▶ Use for <风格>；Cancel the render；Start / Stop / Terminate 照旧。Pod 渲染现在能到达 Pod（worker 向 RunPod 代理报出自己的名字 - 不再 403；https 上也有实时步数）；风格在 Pod 上的下载会等到完成，仍缺少的文件会带着名字停止渲染。 *Where:* 🖥 PODS（按 Generate 时自动打开）。 *Since:* 2.763.3
- **🖥 PODS 停靠窗：Pod 的数据 + 创建前的全部细节** — 每个运行中的 Pod 在名字旁显示 GPU 负载和 GPU 显存的条，打开后显示 GPU、显存、RAM、CPU 和两个磁盘（每几秒更新，来自 Pod 的 Jupyter 或 ComfyUI）；创建表单列出 Pod 的全部内容（模板和镜像、GPU、价格、云、磁盘、CUDA 13 主机、端口、风格、会放上去的东西），并跟随表单变化；停靠窗的风格下拉列表从提示词停靠窗的风格开始；RunPod 上已不存在的 Pod 不会自己重建 - 停靠窗会打开，按旧 Pod 的方式填好；从这台电脑发送的文件不再因 HTTP 400 失败（不再用隐藏的分段文件名）。 *Where:* 🖥 PODS ▸ 🖥 My pods；Create pod…。 *Since:* 2.763.4
- **📦 Pod 预设 + 一个 Pod 上的多个风格** — Pod 的模板、GPU、GPU 数量、云、磁盘、类型和风格保存为 runpod/pods/presets/<名称>.pod；每个预设是一个条目，带 ▶（已终止的 Pod 会连同所有风格的文件和你的自定义节点重新创建；GPU 没有空闲时可选显存相同或更多的 GPU）、⏹、🗑（终止 Pod，预设保留）和 ✕（删除预设）；所有细节都可编辑，可添加 / 移除风格；加载步骤、每小时费用、已用时数和总费用；用没有 Pod 的风格点 Generate 会打开一个框，列出你的 Pod 和预设，带 ＋ <风格>、Create pod… 和 Cancel render；为风格创建的 Pod 会自动保存为预设，任何 Pod 都可 💾 Save as preset。 *Where:* 🖥 PODS ▸ 📦 Presets；Pod 模式下的 Generate。 *Since:* 2.764.0
- **Basic Settings ▸ GPU 选 Local 时不显示远程内容** — 选 Local 时只显示 Local · Remote · Both 和「Every job runs on this computer.」：Remote servers / RunPod 选项、🖥 GPU docker、🖥 PODS、💲 RunPod 和 ⚙ Settings ▸ Remote generation 都会隐藏，这些停靠窗也会关闭；尚未设置任何远程时选 Remote 或 Both 会等待并显示这些选项，直到有可渲染的地方；等待 Pod 的渲染会在 Queue 里显示 Pod 正在做什么（而不是「waiting for the GPU」），发送到 Pod 的模型会显示已发送的 GB、百分比、速度和剩余时间。 *Where:* Basic Settings ▸ GPU；Queue。 *Since:* 2.764.1
- **Pod 上只放工作流用到的自定义节点** — Pod 只会得到其风格的工作流用到、而 Pod 上没有的自定义节点包（从这台电脑的 ComfyUI 查找，按相同版本 clone 或上传）- 为风格创建的 Pod、预设的 ▶ 以及加到 Pod 上的风格都是如此；任何 Pod 都可用 ⬆ Nodes its styles need；日志会说明每一步（小包显示 KB、解包、安装第 n / m 个），Pod 3 分钟无法汇报时会带着原因结束这一步。 *Where:* 🖥 PODS ▸ My pods；Presets；Pod 模式下的 Generate。 *Since:* 2.764.2
- **风格的自定义节点来自它们的 git 地址** — 风格需要的节点包会在 Pod 上 clone（用 git 安装的按相同提交；其他的从 bitGen 的节点列表、pyproject.toml、ComfyUI-Manager 的列表或 Comfy Registry 查找，并按其版本标签 clone；位于更大仓库里的包会链接进来）；只有没有地址或 Pod 无法 clone 的包（私有）才会从你的电脑上传，日志会说明原因。 *Where:* Pod 模式 - Generate、预设、⬆ Nodes its styles need。 *Since:* 2.764.3
- **Pod 下载能完成，受限模型会提示** — Pod 上的下载和节点安装作为独立任务运行，不再停在 0%；下载 Hugging Face 文件前，bitGen 会检查它是否受限或已不存在，并说明是哪个文件以及该怎么做（接受其许可并添加你的 Hugging Face 令牌）；3 分钟没有数据的下载或被 Pod 停止的任务也会提示。 *Where:* PODS ▸ ⬇ Models；渲染的 Pod 备注；日志。 *Since:* 2.764.6
- **把你的检查点和 LoRA 从 Civitai 下载到 Pod** — Pod 需要的本机模型会先在 Civitai 上查找（按其卡片中的版本，否则按只读取一次的 SHA-256），然后由 Pod 用你的 API 密钥从 civitai.com 或 civitai.red 下载完全相同的文件，代替缓慢的上传；只有在 Civitai 上没有或被拒绝时才从本机发送，并说明原因。 *注意：* Civitai 自 2026 年 3 月 16 日起屏蔽澳大利亚用户，因此在澳大利亚无法使用其中的 Civitai 部分。 *Where:* PODS（风格的模型、Override 风格的检查点、预设）；渲染的 Pod 备注；设置 ▸ General ▸ Civitai。 *Since:* 2.765.0
- **远程模型、勾选的 Pod 和每次传输的进度条** — runpod/pods/remote_models.json 记录你的 Pod 使用的模型及各自的下载链接；在远程模式下，Model manager 和基本设置的 Override 下拉框列出这些模型，而不是本机的模型；勾选 Pod（每个名称左侧的复选框，可多选），⇪ 会把模型发送到所有勾选的 Pod；没有链接的模型只上传一次到你的私有 Hugging Face 仓库（Civitai 上有则用其链接，否则直接发送到 Pod）；每次传输都有自己的进度条。 *Where:* PODS ▸ My pods；Model manager（远程模式）；基本设置 ▸ Override。 *Since:* 2.766.0
- **Pod：文件放在 ComfyUI 能看到的位置，旧版 ComfyUI 会被更新** — 文件会放到 Pod 的 ComfyUI 读取的文件夹（包括模板自己的模型文件夹，放错位置的副本会被移动），缺少新版 ComfyUI 内置节点的 Pod 会在渲染前更新 ComfyUI（git pull、requirements、重启）。 *Where:* 渲染的 Pod 备注；PODS。 *Since:* 2.766.3
- **新 Pod 的 ComfyUI 自动更新，查找缺失的文件** — bitGen 创建的 Pod 在首次加载时会自动更新一次 ComfyUI（渲染会等待它；已是最新的 ComfyUI 保持运行）；下载后 ComfyUI 仍未列出的文件会在 Pod 上查找，并链接到它读取的文件夹，或说明原因。 *Where:* PODS ▸ My pods；在 Pod 上渲染。 *Since:* 2.769.0
- **bitGen 创建的 Pod 自行完成设置** — bitGen 创建的 Pod 会被记录为 bitGen 的（Pod 本身也有标记），加载后会更新其 ComfyUI、准备好关联的风格，如果还没有正在使用的 Pod，它就成为正在使用的 Pod - 无需按按钮；⬆ Update ComfyUI 会更新实际正在运行的 ComfyUI。 *Where:* PODS ▸ My pods。 *Since:* 2.769.1
- **“还没有 Pod”对话框只列出现有的 Pod** — 用没有 Pod 的风格渲染时，只列出 My pods 中的 Pod（运行中或已停止）；已终止的 Pod 和其 Pod 已不存在的预设不再列出。 *Where:* 询问由哪个 Pod 渲染风格的对话框。 *Since:* 2.769.2
- **在空白 pod 上安装 ComfyUI** — bitGen 为风格创建的 pod 从 RunPod 的 PyTorch 模板开始，由 bitGen 自己安装 ComfyUI：查找 pod 上有什么，下载最新的 ComfyUI，为它创建沿用 pod 的 PyTorch 的 Python 环境，安装其 requirements 和 ComfyUI-Manager，启动并加载 - 每一步都会显示；重启后只启动 ComfyUI。任何不含 ComfyUI 的模板都同样适用。 *Where:* PODS ▸ Create pod…；询问由哪个 pod 渲染风格的对话框。 *Since:* 2.772.0
- **pod 正在做什么，显示在 pod 上** — 每个 pod 名称下方显示现在正在做什么，带有动词（Downloading、Installing、Loading、Finding、Sending、Starting、Updating …）和到目前为止的时间；已完成的任务放在下拉列表中（✓ 完成、– 已存在、✗ 失败），pod 保持紧凑；没有任务运行时显示 ✓ Done 或带原因的 ✗ Stopped。 *Where:* PODS ▸ My pods。 *Since:* 2.772.0
- **左侧停靠窗显示 pod 的统计** — 远程模式下 System 统计显示正在使用的 pod：CPU 负载、内存、每个 GPU 的负载、温度和显存，以及磁盘；⚡ since start 仍是本机的。 *Where:* 左侧停靠窗的 System。 *Since:* 2.773.0
- **pod 上只放当前模式的风格** — 图像模式下只上传和检查图像风格，Video 模式下只处理视频风格；其他风格等到切换到它们的模式。 *Where:* 提示词停靠窗的 Generate 模式；PODS ▸ My pods。 *Since:* 2.773.0
- **在 Pod 上失败的渲染会重新运行** — 因 Pod 无法使用而停下的渲染（配置中断、文件还没到、缺少节点）会在该 Pod 就绪时自动重新运行：配置完成、ComfyUI 安装或更新完毕，或你发送的文件到达。最多 3 次，从队列中清除后就不再运行。 *Where:* 队列（“Pod 就绪后会重新运行”）。 *Since:* 2.774.0
- **在 Pod 上进行语音合成、语音识别和歌曲分离** — 创建 Pod 时（或在 My pods 的 Pod 上）勾选 Audio，远程模式下语音、克隆的声音、转录和分轨都会在 Pod 上运行；引擎只在 Pod 上安装一次，声音片段只在使用时发送并保留在那里；结果回到项目中。 *Where:* PODS ▸ Create pod… ▸ Audio；My pods ▸ 🔊 Audio。 *Since:* 2.775.0
- **Pod 文件重试** — 没能放到 RunPod Pod 上的文件（上传、Pod 的下载失败或哪里都找不到）会弹出一个框，说明失败方式和原因：↻ 重试 或 暂不；Pod 需要的文件也会按名称在 Civitai 上查找，并由 Pod 下载。 *注意：* Civitai 自 2026 年 3 月 16 日起屏蔽澳大利亚用户，因此在澳大利亚无法使用其中的 Civitai 部分。 *Where:* 远程生成（Pod）。 *Since:* 2.778.0
- **Pod 无法创建的原因** — RunPod 不创建 Pod 时，用对话框说明原因：GPU 被占用就直说、该怎么做、RunPod 自己的原话和 HTTP 状态，以及请求的内容（模板、GPU、云、主机、磁盘）；可 📋 复制。RunPod 自己的模板（如 PyTorch）不再被“先选择模板”拒绝。 *Where:* PODS ▸ Create pod、📦 Presets ▸ ▶、询问 Pod 的框。 *Since:* 2.779.0
- **Pod 都是 bitGen Pod** — PODS 停靠窗不再有模板浏览器：🖥 My pods（bitGen 的 Pod；RunPod 账户里的其他 Pod 合成一行并显示费用，可 ⏹ 停止）、📦 Presets 和 ＋ Create pod——选 GPU、云、磁盘、风格和音频，用 bitGen 选定的模板（RunPod 的 PyTorch 模板；bitGen 在上面安装 ComfyUI、自定义节点和文件）创建。 *Where:* PODS。 *Since:* 2.780.0
- **采样器列表；始终起不来的新 Pod 会重建** — 基本设置的模型下拉框上方有采样器 / 调度器列表（你的 ComfyUI 提供的；在 Pod 上则是 Pod 的），开启“覆盖风格”时用于风格工作流中的每个采样器节点（风格自带 = 保持工作流原样）；新 Pod 首次启动时若 5 分钟毫无动静，会被终止并按同样设置重建（最多两次）；Jupyter 仍在启动的 Pod 会被等待。 *Where:* 基本设置、PODS。 *Since:* 2.781.0
- **Pod 的模型文件、GPU 显存、日志中的 ComfyUI 用时** — 运行中 Pod 的 📁 Files 按文件夹列出模型文件及大小和剩余磁盘，并删除勾选的文件（先确认；bitGen 会为该 Pod 忘记它们）；GPU 显存：把模型留在显卡上（默认——24 GB 以上的显卡上不用 Dynamic VRAM 启动 ComfyUI）或 ComfyUI 的 Dynamic VRAM，⟳ 应用到此 Pod；每次渲染的日志会显示 ComfyUI 用时和模型的加载方式。 *Where:* PODS。 *Since:* 2.781.2
- **在 Pod 上 ⟳ 重启 ComfyUI** — PODS ▸ My pods 中运行的 Pod 可以重启其 ComfyUI（按两次），保留原有命令和 GPU 显存方式，并在它再次响应时告知。 *Where:* PODS。 *Since:* 2.781.3
- **在 Pod 上运行来自 Hugging Face 的 LLM；一个 Pod 运行全部** — 使用 RunPod Pod 时，提示词停靠窗的 LLM / Vision 列表只显示你的列表；＋ From Hugging Face… 列出仓库的 GGUF（分卷的算作一个，含视觉投影器），把选中的发送到 Pod（llama.cpp 在 Pod 上只编译一次），并询问是否以其名称保存到你的列表；可在你的某个 Pod 上运行，或为它新建一个 Pod；在共享的 Pod 上，渲染会停止 LLM 并释放显存，下一次聊天会卸载 ComfyUI 的模型并重新加载 LLM；可扩大 Pod 的卷。 *Where:* 提示词停靠窗、PODS。 *Since:* 2.782.0
- **传输到 Pod 时的 ⏹ / ↻** — 每个模型传输的进度条（PODS ▸ Transfers）末尾有停止和重新开始图标：上传在当前分块后停止（Pod 上的分块被删除），Pod 的下载在当前片段后停止；↻ 从头重新开始。 *Where:* PODS。 *Since:* 2.782.2
- **Create pod 的 GPU 列表排序:最快 / 最便宜** — PODS ▸ Create pod 的 GPU 列表上方有 GPU 排序(默认最便宜,会记住);每张卡显示与 RTX 5090 相比的大致速度(bitGen 针对扩散和视频渲染的粗略参考,不是基准测试);换一种排序会选中该顺序中第一张有 20 GB 以上的空闲卡。 *Where:* PODS。 *Since:* 2.784.0
- **列表中的 pod 模型;☐ Remote** — 每个 pod 都保存一份清单（模型、VAE、文本编码器、LoRA、它的风格），显示在 PODS ▸ 🗂 Inventory 中；pod 的模型和 LoRA 以 <pod name>/<file> 的形式出现在 Basic Settings 的列表中，选择其一即在该 pod 上渲染；在 Use model / Use temporary LoRAs 下勾选 ☐ Remote 并选择 pod，会把本机的模型或 LoRA 发送到该 pod（在 Civitai / Hugging Face 上找到则由 pod 下载，否则上传）并在那里渲染。*Where:* Basic Settings, PODS. *Since:* 2.787.0
- **已终止 pod 的文件保留为 NO_Pod** — 终止 pod 时会询问：把它的模型和 LoRA 连同 pod 的创建方式以 NO_Pod (<old name>)/<file> 的形式保留在 Basic Settings 的列表中，还是移除；选择 NO_Pod 文件会显示该创建方式并询问——Make the pod again 会在下一次渲染时按原样重新创建并放回其文件（先在线查找，否则从本机发送）；绝不会未经询问就重新创建。*Where:* 🖥 PODS, Basic Settings. *Since:* 2.789.0
- **把 NO_Pod 文件放到你已有的 Pod 上** — 选择已终止 Pod 的文件时，会指出你的哪个 Pod 上已经有它（Start that pod / Use that pod），并列出其他所有 Pod（正在运行的在前），说明每个 Pod 上已有什么、要发送什么（空间不足或模型可能放不进显卡时会警告）；只发送 Pod 上没有的文件——模型会连同 VAE 和文本编码器一起转移——所选项在所有保存的地方都变成 <pod name>/<file>。*Where:* Basic Settings, 🖥 PODS. *Since:* 2.793.0
- **缺少的模型：下载到本机或发送到 Pod** — 渲染缺少的模型 / LoRA 按名称在网上查找并下载到本机，或（在 RunPod Pod 上）询问后 ⬆ Send to <pod>。*Where:* Models not found 对话框。*Since:* 2.806.0
- **重新启动 Pod 上已崩溃的 ComfyUI** — ComfyUI 端口上的网页不再被当作 ComfyUI；未运行的 ComfyUI 由 bitGen 启动（不能启动时说明原因），Pod 上已有的文件不再显示传输进度条。 *Where:* 在 Pod 上渲染；PODS ▸ Transfers。 *Since:* 2.770.1
- **bitGen Pod 模板: ComfyUI 已经装在 Pod 上** — 一个 RunPod 模板, 其镜像 (ghcr.io/tim-byte-dev/bitgen-pod, 由 GitHub 每周构建) 已包含 ComfyUI、它的 Python 环境、ComfyUI-Manager 以及 bitGen 风格最常用的节点包: 新 Pod 在第一次启动时把它复制到自己的磁盘, 几分钟即可使用, 而不是 10–15 分钟; bitGen 会先选它, 再考虑 RunPod 的 PyTorch 模板 (你的 RunPod 账户中用此镜像创建的模板、公开模板或你设置的 ID), 安装的每一步都显示已存在。不用 bitGen 也能使用该模板: ComfyUI 在端口 8188 启动。 *Where:* PODS ▸ Create pod…; 询问用哪个 Pod 渲染风格的对话框; runpod.io ▸ My Templates (misc/pod-image/README.md)。 *Since:* 2.900.0
- **每个新 Pod 都是 bitGen Pod (约 3 分钟)** — bitGen 创建的 Pod 直接由 bitGen Pod 镜像创建 (已包含 ComfyUI、ComfyUI-Manager 和常用节点包) - 无需设置模板; 如果你的 RunPod 账户里有 bitGen Pod 模板就用它代替; 没有模板的预设和重新创建的 Pod 也一样。 *Where:* PODS ▸ Create pod…; 询问用哪个 Pod 渲染风格的对话框。 *Since:* 2.901.0

### 显卡、能耗和费用

- **电费** — 每 kWh 的电价：每个任务的 ⚡ 卡片、其 [power] 行以及启动以来的耗电量都会显示费用。 *Where:* Settings ▸ General. *Since:* 2.518.0
- **每日供电费** — 电费账单上的固定日费用：任务费用按其运行时长计入相应份额。 *Where:* Settings ▸ General ▸ Energy cost. *Since:* 2.519.0
- **峰谷电价** — 设置峰时电价和峰时时段（星期几 + 时间，也可跨越午夜）；其余时间均为谷时；任务分别统计峰时和谷时耗电量。 *Where:* Settings ▸ General ▸ Energy cost. *Since:* 2.520.0
- **用量日志** — 按天记录每个任务的耗电量、峰时占比、费用和所用远程 GPU；可选时间范围、显示合计、导出 CSV。 *Where:* Settings ▸ General ▸ 📊 Usage…，或点击状态栏中的 ⚡ 数值. *Since:* 2.520.0
- **💲 RunPod 停靠窗 + 你自己的停靠窗里的停靠窗** — 一个独立的停靠窗，显示 RunPod 余额、当前支出和余额还能用多久、支出上限、Pod 的费用（正在运行、今天、本月、每个 Pod）以及 RunPod 的 GPU 价格（Secure / Community、显存、每小时价格、空闲数量；可搜索、排序）；Basic Settings 的 💲 费用行移到了这里；用 ▣ New docker… 创建的停靠窗（浮动的或限定在某个停靠窗内的）可以放入 PODS、💲 RunPod、Basic Settings 等停靠窗口和主停靠窗 - 可以放多个；浮动对话框始终在所有停靠窗前面（限定的停靠窗不再盖住它们）；自定义节点一次打包一个文件，并在日志里显示进度（不含 venv，权重原样存放，上限 2 GB）。 *Where:* Basic Settings ▸ GPU 和 🖥 PODS 里的 💲 RunPod；⊞ Docker configs ▸ ▣ New docker…。 *Since:* 2.763.5
- **💲 Costs 停靠窗** — RunPod 停靠窗变成了 💲 Costs：所有费用在一个列表中 - 这台电脑的电费和供电费、RunPod（Pod + Serverless）、OpenRouter、Settings ▸ API 的每个服务和远程 GPU，各占一行并有合计 - 可选今天、7 天、本月、上月或全部；点击一行打开其详细列表（按天、任务、Pod、模型、调用）。 *Where:* 🖥 GPU 停靠窗；PODS；设置 ▸ 常规 ▸ 电费；System stats 的 💲。 *Since:* 2.771.0
- **📊 Statistics** — 一个对话框，显示每次生成的启动时间（启动或准备 Pod、文件、节点包、更新或重启 ComfyUI）、生成时间和合计，每次 Pod 准备及其阶段，按位置和按模式的平均值，以及 CSV。 *Where:* 💲 Costs ▸ 📊 Statistics；设置 ▸ 常规 ▸ 电费。 *Since:* 2.771.0
- **⏱ 耗时估计** — 在提示词停靠窗的 Generate 按钮底部的一行小字：根据本机同一风格已完成的渲染（📊 Statistics）估计这次渲染需要多久，按所选的尺寸、时长、步数和 CFG 换算（CFG 大于 1 = 两遍），再加上启动时间（模型仍在加载中时更短）；有三次渲染后显示范围，提示框说明依据；某风格首次渲染前参考同类的其他风格，否则显示“还没有时间”。*Where:* 提示词停靠窗的 Generate 按钮（🎬 视频和 🖼 图片）。*Since:* 2.908.0
- **多块显卡：Local - <card>** — 有两块或更多 NVIDIA 显卡时，☁ Runs on ▸ Image / Video / Music 可以选择每块显卡；选中的显卡有专属的 ComfyUI（--cuda-device、独立端口和日志），在该类工作第一次渲染时启动并保持运行——图片在一块显卡上，视频在另一块上。*Where:* 🖥 GPU. *Since:* 2.791.0
- **LLM 和语音使用专属显卡；卸载到 CPU / 内存** — 有两块或更多 NVIDIA 显卡时，☁ Runs on ▸ LLM / Vision LLM / Text to speech / Speech to text / Song separation 也提供 Local - <card>；LLM 会把显卡空闲显存放得下的层都放到显卡上（其余放在内存），语音只在那块显卡上运行。Settings ▸ General ☐ Offload to CPU / RAM when a model does not fit（默认开启）——关闭后全部留在显卡上，放不下的 LLM 会被拒绝并说明原因。*Where:* 🖥 GPU, Settings ▸ General. *Since:* 2.794.0

### 训练和微调

- **LoRA 训练器** — 使用 ai-toolkit（Ostris）以你的图片训练 LoRA：九种基础模型（Z-Image Turbo、FLUX、Qwen-Image、SDXL、SD 1.5、Chroma、Wan 2.1…）、触发词、rank、步数、带描述文字的数据集（或由助手生成描述）、可编辑的 YAML、实时显示步数 / loss / 样图；训练好的 LoRA 连同卡片存入 ComfyUI 的 loras/trained；可将任务导出为 zip。 *Where:* 状态栏的 🎓 LoRA. *Since:* 2.520.0
- **检查点微调** — 使用 ai-toolkit 训练图像模型（Lumina 2、Flex.1、FLUX.2 klein、SDXL）的全部权重，通过参数交换降低显存占用；结果合并为 diffusion_models/trained 中的一个 .safetensors 文件。 *Where:* 🎓 LoRA ▸ Type. *Since:* 2.521.0
- **LLM 微调** — 使用 Unsloth 以你自己的对话训练助手（Qwen3.5 0.8B-9B、Gemma 4、Qwen3.8 27B；LoRA / QLoRA / 全量）；示例可手动输入或导入（JSONL / JSON / CSV）；输出为 LLM 文件夹中的 .gguf。 *Where:* 🎓 LoRA ▸ Type. *Since:* 2.521.0
- **视觉模型微调** — 以图片 + 回答训练视觉模型（Qwen3.5 / Gemma 4 vision）；输出 .gguf 和 mmproj 到视觉模型文件夹。 *Where:* 🎓 LoRA ▸ Type. *Since:* 2.521.0
- **融合 LoRA** — 将训练好的 LoRA 合并到其基础模型中，生成新的检查点（ComfyUI），任何显卡均可。 *Where:* 🎓 LoRA ▸ Run & samples. *Since:* 2.521.0
- **FLUX.2 klein LoRA** — 可将 FLUX.2 klein base 4B 用作 LoRA 的基础模型。 *Where:* 🎓 LoRA ▸ Base model. *Since:* 2.521.0
- **用你的选择训练 LLM** — 🔁 Compare LLMs 的每一轮都会保存完整的提示词；🏆 ▸ 🎓 将选中的回复（示例）以及“选中 vs 未选中”配对发送到训练器的 LLM 任务；训练器从 Examples（SFT）或 Preferences（DPO / ORPO，Beta）中学习，并写出新的 .gguf。 *Where:* 🏆 ▸ 🎓 Train an LLM on your picks；🎓 LoRA trainer ▸ Job ▸ Learn from、Dataset ▸ 🔁 Preference pairs。 *Since:* 2.585.0
- **🧬 RefMods 库** — 适用于所有项目的 MiniMax H3 参考 mod，存放在 refmod/<name>/ 中：7 种类型（角色、地点、载具、物体、道具、植物、动物），上传的媒体自动分类到 images / videos / audio，✨ 使用视觉模型自动生成描述，🧬 Extract（图片 + 视频帧）-> 生成的 .safetensors 保存在该文件夹中，在提示词中写 @name 即可使用。 *Where:* 🎓 LoRA & fine-tune trainer ▸ 🧬 RefMods。 *Since:* 2.588.0

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
- **从聊天中创作歌曲** — 聊天会写出符合所选音乐风格的歌词，并发送到 Music 面板。 *Where:* 提示词聊天. *Since:* 2.92.0
- **歌词文件** — 每首歌曲的歌词都以文本文件形式保存在项目中。 *Where:* 项目的 lyrics 文件夹

### 分离歌曲

- **拆分歌曲** — 人声、鼓、贝斯和其他。 *Where:* 🎹 Edit Booth 标签的 ✂ 分离人声（两层——它取代的 Stems 标签已在 2.966.0 移除）；乐谱的 ✂ 拆分为层（四层）

### 人声与语音

- **声音克隆** — 从一段短片段或波形选区克隆声音。 *Where:* 设置 > 音频
- **▶ 在声音克隆的波形中播放** — 播放选区，未选择时播放整个片段；■ 停止，波形上显示播放头，点击一下即可清除选区。 *Where:* Settings > Audio > voice clone. *Since:* 2.601.0
- **文字转语音** — 用克隆的声音朗读一句话；可选 OpenAudio 或 OmniVoice（600 多种语言，支持声音设计）。 *Where:* Settings > Audio. *Since:* 2.102.0
- **Ming-3.0 TTS** — 第二个语音引擎（inclusionAI，0.5B，44.1 kHz）：根据片段及其文字稿克隆声音，也可设计声音。从 Settings ▸ Add-ons 安装。 *Where:* Settings > Audio > Speech engine. *Since:* 2.594.0
- **从提示词生成语音** — 在语音模式下使用 Generate。 *Where:* Generate 下拉列表
- **语音与对白** — 由 OmniVoice 或 Ming-3.0 TTS 朗读输入、粘贴或由 LLM 编写的文字，可以只用一个声音，也可以是一组角色（按 "Name (emotion): line" 为每位说话者指定声音和情绪），支持声音标签和停顿；保存为 WAV 或 MP3，放入 Audio 素材。 *Where:* SFX 面板 ▸ 🗣 Speech & dialog。 *Since:* 2.621.0
- **带情绪的语音** — 中性、开心、悲伤、愤怒、恐惧、厌恶、惊讶：使用 Ming-3.0 TTS 的情绪任务（克隆声音同样适用）；使用 OmniVoice 时，则通过语速、以该情绪录制的声音（"Name.happy"）和声音标签来表现。 *Where:* SFX 面板 ▸ 🗣 Speech & dialog。 *Since:* 2.621.0
- **语音文件中的元数据** — 标题、日期和时间、描述、文本以及所用的声音会写入 WAV（INFO）或 MP3（ID3）。 *Where:* SFX 面板 ▸ 🗣 Read & save。 *Since:* 2.621.0

### 转录与歌词

- **语音转文字** — 从任意声音或视频中转录语音或提取带时间轴的歌词，保存为 .txt、.srt 和 .lrc。 *Where:* 素材托盘. *Since:* 2.38.0
- **本地转录** — faster-whisper 在本机运行，每个文件只转录一次。 *Where:* Settings > Audio
- **Bark 3.0 语音转文字** — Underdog 的 Bark 3.0（163 MB，仅支持英语），用于普通文字稿、声音克隆文字稿、手机遥控和 🎙 语音聊天；歌词、字幕及其他需要时间轴的工作仍使用 faster-whisper。从 Settings ▸ Add-ons 安装。 *Where:* Settings > Audio > Speech-to-text engine. *Since:* 2.594.0

### 卡拉 OK

- **卡拉 OK 叠加层** — 透明的歌词视频，带有跳动的小球，以及随演唱而变色的歌词行。 *Where:* StoryBoard 的 Karaoke 按钮. *Since:* 2.373.0
- **任意歌曲的卡拉 OK** — 选择一个声音片段或素材，可以是整首歌，也可以是标尺选区。 *Where:* 时间线的 Karaoke 按钮. *Since:* 2.380.0
- **卡拉 OK 样式** — 字体、颜色、描边、阴影、背景条和小球。 *Where:* StoryBoard 和 Timeline settings
- **编辑歌词** — 修正语音转文字听到的歌词，或粘贴真正的歌词。 *Where:* Karaoke 面板. *Since:* 2.408.0
- **歌词与时间** — 每个词都有开始和结束时间，可播放、可修正；修正内容会为该歌曲保留。 *Where:* Karaoke 面板. *Since:* 2.408.0
- **微调词语时间** — 将一个词，或该词及其后所有词，以小幅或较大幅度提前或延后。 *Where:* Words and timing. *Since:* 2.433.0
- **标记处的歌词行** — 正在演唱的行会高亮显示，正在演唱的词更亮。 *Where:* Words and timing. *Since:* 2.433.0
- **Karaoke 面板** — 停靠在预览画布旁边，这样可以一边播放歌曲一边修正；可在画布上显示修正后的歌词。 *Where:* 时间线. *Since:* 2.410.0
- **🎹 Edit Booth 标签：合成器、MIDI 键盘和步进循环器** — Audio 面板的第 4 个标签 🎹 Edit Booth：我们自己的合成器，带发光旋钮面板（两个带齐奏的振荡器、副振荡器和噪声；带独立包络的滤波器；音量包络；LFO；合唱、延迟和空间；14 个我们自己的音色，💾 保存你自己的）以及声音的实时波形。可用屏幕键盘、电脑按键（Z 行和 Q 行）或任意 MIDI 键盘（力度、弯音、调制轮、延音）演奏。下方的循环器：8 行声音 × 16 步 × 8 个样式（A-H，⛓ 串联），重音、摇摆、静音 / 独奏，每行的音量、音高和声像；每行的声音来自内置鼓组（由 bitGen 生成，不是任何人的录音）、📂 你自己的采样（添加文件，或拖放到某一行）或本项目的 SFX；🎙 Sample it 把音色的一个音变成新采样。循环可 ⬇ WAV、→ 💥 SFX 或 → 🔊 Sound 素材；⏺ Rec 把演奏存入 SFX。⛶ 铺满窗口，Esc 返回。 *Where:* Audio ▸ 🎹 Edit Booth。 *Since:* 2.953.0
- **🎹 Edit Booth 标签的操作台：鼓垫、乐谱屏幕和时间线** — 键盘变成了像硬件控制器一样的操作台（上面没有任何厂商名称）：49 个形状自然的琴键、滑轮、16 个鼓垫（鼓垫 1-8 是循环器的各行，9-16 是你自己的声音；点击、按键或 MIDI 鼓通道演奏；⏺ 把敲击写入循环）、边弹边写乐谱的乐谱屏幕（● 录制、📂 打开 .abc 乐谱、▶ 试听、🎓 学习 - 下一个音在五线谱和琴键上亮起并等你弹奏）、音色 / 八度按钮和音量旋钮。循环器下方是时间线：来自所有来源（循环、鼓组、你的采样、项目的 SFX、Sound 素材和分轨、歌曲和图库音频、文件）的声音按层排列并显示波形；移动和修剪片段；每层有音量和声像旋钮，以及带开始音量和结束音量的关键帧；▶ 播放，⬇ WAV / → SFX / → 🔊 混音导出。 *Where:* Audio ▸ 🎹 Edit Booth。 *Since:* 2.954.0
- **🎹 Edit Booth 标签：把录音送到时间线、拖放、可折叠的部分** — 键盘上的 ● 会同时录下你弹奏的声音（与乐谱一起），→ 🎞 把它放到新的时间线层；循环器的 ⏺ Rec 录制循环和鼓垫，→ 🎞 Timeline 发送这段录音；把图库、素材或参考中的声音（或文件）拖到时间线上 - 会询问放在这一层还是新的一层；📂 打开 → 新层；Synth、Keyboard、Looper 和 Timeline 各部分可以像面板一样折叠。 *Where:* Audio ▸ 🎹 Edit Booth。 *Since:* 2.955.0
- **🎹 Edit Booth 标签：.sfx 文件 - 停止时保存录音、时间线保存 / 另存为、任意加载** — 键盘和循环器的录音在停止的瞬间保存（项目中的 _key_ / _loop_ + 随机名 .sfx，声音以 WAV 存入 My samples）；时间线的 💾 保存第一次询问名称（<名称>.sfx - 整个标签），之后覆盖该文件；另存为每次都询问；🗂 加载可在键盘、循环器或时间线打开任何合成器文件。 *Where:* Audio ▸ 🎹 Edit Booth。 *Since:* 2.956.0
- **🎹 Edit Booth 标签：钢琴卷帘、片段编辑、撤销** — 键盘的 ● 录音可变成时间线上的音符片段（→ 🎞 ♪）由合成器播放，或用 ＋ ♪ Notes 新建；钢琴卷帘可绘制、移动、拉长和删除音符，设置力度并量化到网格；每个片段有增益、淡入 / 淡出手柄，可分割（S）或复制（Ctrl+D），重叠的片段会自动交叉淡化；↶ / ↷（Ctrl+Z / Ctrl+Y）撤销和重做时间线、循环、旋钮和鼓垫。 *Where:* Audio ▸ 🎹 Edit Booth。 *Since:* 2.957.0
- **🎹 Edit Booth 标签：混音台、节拍器、标记、分轨** — 🎚 混音台：每层一条通道，含电平表、音量、声像、三段 EQ、压缩器和混响发送，另有主输出；🕒 节拍器在时间线播放和录音时打拍，● / ⏺ 前可预备 1 或 2 小节；时间线上的 ⚑ 标记（M）可跳转、重命名或删除；⬇ 分轨把每层单独渲染到 Sound 素材。 *Where:* Audio ▸ 🎹 Edit Booth。 *Since:* 2.958.0
- **🎹 Edit Booth 标签：自动化轨道、滤波器、并轨** — 时间线每层可显示声像、滤波器或混响自动化轨道来代替音量关键帧：双击添加点，拖动修改，右键或 Delete 删除，混音随线变化；混音台每条通道新增低通滤波器旋钮；⤓ 把一层（含效果和自动化）并轨成新层上的一个声音并静音原层。 *Where:* Audio ▸ 🎹 Edit Booth。 *Since:* 2.959.0
- **🎹 Edit Booth 标签：多次录音与拼接（comping）** — ● 录音在时间线播放时把键盘、循环器和打击垫或麦克风录到已预备的层，按采样精确定位；⟳ 循环（在标尺上 Shift+拖动设定范围）反复播放该范围，每一遍生成一个录音条；穿插录音只保留范围内的部分；录音条叠放在层内：拖过某条即采用该段，单击采用整条，右键删除，▤ 合并为普通片段。 *Where:* Audio ▸ 🎹 Edit Booth。 *Since:* 2.960.0
- **🎹 Edit Booth 标签：速度轨** — ♩ 速度可在歌曲中添加速度变化（跳变，或渐变到下一个）：节拍网格、吸附、节拍器、循环的小节、钢琴卷帘网格和“小节.拍”显示都随之变化；双击速度条添加变化，拖动调整 BPM 或位置。 *Where:* Audio ▸ 🎹 Edit Booth。 *Since:* 2.961.0
- **🎹 Edit Booth 标签：步进音序器** — ＋ ▦ 步进在任意层上添加步进片段：由行（鼓组音色、你的采样、音效）和步组成的网格，支持重音、摇摆、8-32 步（8 分到 32 分音符及三连音）；图案按速度轨的拍子在整个片段中重复。 *Where:* Audio ▸ 🎹 Edit Booth。 *Since:* 2.962.0
- **🎹 Edit Booth 标签：层上方的面板** — 左上角始终显示：所选片段（文件名、增益、淡入淡出），否则为所选层（可重命名、音量、声像、滤波器）；层名可在面板或层头修改。 *Where:* Audio ▸ 🎹 Edit Booth。 *Since:* 2.963.0
- **🎤 Edit Booth 标签：用我的声音唱、分离人声** — 时间线上方的一排工具把所选层的人声用你自己的声音重新唱出来——音高、节奏和情感都不变。可选 Seed-VC 或 SoulX-Singer SVC（用你 15–30 秒的声音片段：🎙 录音 或 📂），或通过 Applio 的 RVC（🎓 用你的片段训练的模型）；可升降调、选质量；整首歌会先被分离。✂ 分离人声把所选层再分成两层：人声和伴奏（原层保留并静音）。每个引擎都可就地安装（下载 / 取消对话框），或在 设置 ▸ 附加组件 ▸ 🎤 用我的声音唱 中安装。*位置：* 音频 ▸ 🎹 Edit Booth ▸ 🎤 MY VOICE。*版本：* 2.965.0
- **🎤 Edit Booth 标签：停止、自动调、混音、监听自己** — ■ 停止可立即结束正在进行的演唱、分离或 🎓 训练（引擎的程序及其启动的一切；停止的训练在用同一名字再次训练时，从 Applio 最后一次保存处继续）。调 ▸ Auto 让 Seed-VC 或 SoulX-Singer 把歌曲移到你声音片段所在的音高。⧉ 混音把你的声音按你听到的样子（音量、效果、自动化线）放回歌曲的伴奏上——合成一个文件：一个新层、我的采样，以及项目的声音素材。🎧 让你在 🎙 录制片段时听到自己（请戴耳机）。*位置：* 音频 ▸ 🎹 Edit Booth ▸ 🎤 MY VOICE。*版本：* 2.967.0
- **🎹 键盘的乐器：像家用电子琴一样的 70 多种音色** — 琴键上方一排 VOICE 按钮，每个按钮一个音色库（钢琴、马林巴类、风琴、吉他、贝斯、弦乐、合唱、铜管、簧管、管乐、主奏、铺底、世界、合成器；再按一次换下一个音色）：三角钢琴和电钢琴、羽管键琴、颤音琴、马林巴、钟声、拉杆风琴和教堂管风琴、手风琴、吉他、贝斯、弦乐、竖琴、合唱、铜管、萨克斯、长笛等。全部由工作站自己生成（击弦与拨弦模型、FM、拉杆），不用录音；钢琴轻弹音色更暗；MIDI 程序变更也能选音色。标签现名为 🎹 Edit Booth。*位置：* 音频 ▸ 🎹 Edit Booth - 键盘上的 VOICE 一排。*版本：* 2.972.0
- **🎞 Edit Booth 时间线：▶ 全部或单个层、跳过丢失的声音、循环器音量** — ▶ Play 前面有一个下拉框：All（全部），或 Layer = 只播放你点过的层（即使静音也能听到；没有点任何层 = 全部）；声音文件已丢失的片段不再让 ▶ 停止——它会被跳过、显示名字并画上删除线；键盘和循环器在时间线下方继续播放，循环器有自己的 Vol 旋钮；时间线获得焦点时按 Space 播放时间线。*位置：* 音频 ▸ 🎹 Edit Booth ▸ 🎞 Timeline。*版本：* 2.973.0
- **🧬 在 SFX 标签克隆声音** — 打开文件、录音或选项目里的声音；在波形上拖动 START 和 END 标记（或拖动两者之间的部分、用 ← →、输入秒数）选出要克隆的部分，▶ 播放，✍ 写出其中的话；🧬 Save voice 保存后会在 🗣 Speech & dialog 里被选为声音来朗读你的文字——朗读的文件现在也会放进图库的 Audio 标签。*位置：* 音频 ▸ 💥 SFX ▸ 🧬 Clone a voice。*版本：* 2.974.0
- **🎛 Edit Booth：每个部分的高度** — Synth、Keyboard、Looper、Timeline 每个部分下方有一个拖动条：拖动（或 ↑ ↓）让该部分变高或变矮，双击恢复原来的高度；保存在这个浏览器里。*位置：* 音频 ▸ 🎹 Edit Booth。*版本：* 2.974.0
- **🥁 Edit Booth：Drumify - 把节奏变成带着你手感的鼓组** — 在步进音序器里，听一小节节拍器后敲出节奏（敲击板、任意键、MIDI 键盘或鼓垫），或用音符片段、声音（按低 / 中 / 高分出每一击）-> 底鼓、军鼓和镲，并补上镲、反拍、第 1 拍底鼓和幽灵音；每一击都保留力度与提前 / 拖后，Feel 决定听到多少这种时值（0 = 对齐网格）。🎲 换一种、↶ 恢复原样。这是我们自己写的规则，不是 AI 模型，任何内容都不会离开你的电脑。*位置：* 音频 ▸ 🎹 Edit Booth ▸ ▦ Steps ▸ 🥁 Drumify。*版本：* 2.992.0
- **✍ Edit Booth：Continue - 续写你的音符** — 在音符片段的 🎹 钢琴卷帘中，✍ Continue 用 Anticipatory Music Transformer（Stanford CRFM，Apache-2.0，在本机运行）以相同风格续写接下来的 1～8 小节 —— 可选音符的乐器、创造力、单一乐器或更多；🎲 Again 再写一版，↶ Take back 撤回。Small／Medium／Large 模型（附加组件；Small 也可在 CPU 上运行）。*位置：* 音频 ▸ 🎹 Edit Booth ▸ 音符片段的 🎹 钢琴卷帘 ▸ ✍ Continue；Settings ▸ Add-ons ▸ ✍ Continue。*版本：* 3.11.0

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
- **保持对边不动的斜切** — 侧边手柄以对边为基准倾斜（Alt：以中心为基准）；文字斜切后仍是文字。 *Where:* 图像编辑器的移动工具，再次点击已选取的图层可显示旋转 / 斜切手柄（2.819.0）. *Since:* 2.604.0
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
- **单个图层上的范围** — 把位置标记放在起点，在图层上 Shift+点击终点：即得到该图层上的范围；✂ Cut 只从该图层中删除整个范围，↶ / Ctrl+Z 可撤销。 *Where:* 时间线的图层。 *Since:* 2.603.0

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
- **时间线的画面尺寸** — 宽 × 高、尺寸预设（从 4K 到竖屏和方形），以及画布和合成共用的锁定宽高比；V1 会适配到画面内并居中。 *Where:* Timeline 面板顶部的栏. *Since:* 2.513.0
- **在整个镜头中抠出主体** — 点击主体（或框选），它就会在整个片段中被跟踪（SAM 2、AI 遮罩或内置方法），可优化边缘，结果为一个透明视频图层。 *Where:* 视频片段 Properties 中的 🧍 Cut out. *Since:* 2.515.0
- **视频内容识别填充** — 从每一帧中移除抠出的主体或蒙版区域，并用周围帧（+ 一张参考帧）填充。 *Where:* 视频片段 Properties 中的 🩹 Remove. *Since:* 2.515.0
- **3D 摄像机跟踪器** — 解算相机和场景中的点，选择点并将图层平放、竖立或朝向相机放置；3D 相机跟随解算结果（包括滚转）。 *Where:* 视频片段 Properties 中的 📷 3D camera track. *Since:* 2.515.0
- **任意设置均可设关键帧** — 每个颜色、效果、蒙版、文字和时间设置旁的 ◇ 可在播放头处为其设关键帧（之后修改即会自动设关键帧）；Graph Editor 会显示这些关键帧，合成结果一致。 *Where:* 片段 Properties 和 🎨 Colour 对话框中的 ◇. *Since:* 2.516.0
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
- **时间线撤销 / 重做** — 对时间线的每次编辑都是一个步骤：使用其菜单栏中的 ↶ / ↷，或在图层上按 Ctrl+Z / Ctrl+Shift+Z。 *Where:* 时间线。 *Since:* 2.603.0
- **▯ 帧：点击一帧，按 Del 删除** — 一种时间线工具，用于选择某个图层上的单帧（点击，拖动选多帧，Shift+点击，← / →）；按 Del / ⌫ 将其从该图层中剪掉并合拢空隙，↶ 可恢复。 *Where:* 时间线的菜单栏 ▸ ▯（或在图层上按 F）. *Since:* 2.611.0
- **剪切后的片段仍是一个片段** — 对跨越片段的帧执行 ✂ Cut / Del，会把前后两部分连接成一个连续片段（视频 / 声音会生成一个帧精确的 "-join" 文件；图片则只是变短）；一次 ↶ 即可撤销。预览会提前一秒加载下一个片段，因此剪切处绝不会闪黑。 *Where:* 时间线 ▸ ✂ Cut（开启波纹）. *Since:* 2.612.0
- **播放时标记 ▼ 范围** — 预览播放时按一下 Ctrl 标记范围的开始，再按一下标记结束，可在高亮的图层上标记任意多个，每个范围颜色不同；拖动 ▼ 可移动它（预览会显示该帧）。 *Where:* 时间线（Ctrl），时间标尺中的 ▼. *Since:* 2.613.0
- **选择范围，用 ✂ Cut 剪掉** — 点击 ▼ 选择其范围，Ctrl / Shift + 点击可选择更多；✂ Cut（以及 ⏩ / ✕）作用于所选范围，未选择时作用于全部范围。 *Where:* 时间线标尺的 ▼ + 菜单栏的 ▼ 组. *Since:* 2.614.0
- **✂ 剪掉所有范围 / ⏩ 加速范围** — 一次剪掉所有已标记的范围（被剪多次的片段仍是一个片段），或将每个范围以 2× - 10× 的速度播放，快进渲染画面。 *Where:* 时间线的菜单栏 ▸ ▼ 组. *Since:* 2.613.0
- **✂ 到新图层** — 一个复选框，勾选后剪切或 Ctrl+K 分割之后的部分会放到正上方的新图层上。 *Where:* 时间线的菜单栏. *Since:* 2.612.0
- **✨ 自动转场；🔇 视频声音** — 在不同图层的视频片段之间的每个剪切点添加 N 帧转场，不移动任何片段（与歌曲的口型同步保持精确——前一个片段会延续到下一个片段之下）；一个按钮即可将所有视频图层静音 / 取消静音，只播放完整的歌曲。 *Where:* 时间线工具栏 ▸ ✨ Auto transition [frames] [type]、🔊 Video sound。 *Since:* 2.572.0

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
- **悬停时间 + 播放速度** — 指针所在位置的时间显示在时间线上方的小框中；预览可以 0.125× - 8× 的速度播放。 *Where:* 时间线；预览下方的速度列表. *Since:* 2.613.0

### 时间线中的 AI

- **新镜次** — 在片段自己的槽位中重新渲染，并可在各镜次之间切换。 *Where:* AI 菜单. *Since:* 2.420.0
- **延长** — 从片段的最后一帧接续生成更多秒数。 *Where:* AI 菜单. *Since:* 2.420.0
- **B-roll 补充镜头** — 填充 V1 上的空白区段，或在某个范围上插入切出镜头。 *Where:* AI 菜单. *Since:* 2.420.0
- **踩点剪辑** — 找出歌曲的节拍，然后在节拍处放置标记或剪切片段。 *Where:* AI 菜单. *Since:* 2.420.0
- **🧬 变形** — 在两个图层之间让一个角色变成另一个角色：写出两个角色，选择这两个图层；提示词会自动写好，首帧 / 尾帧会自动截取，由视频模型渲染，结果放在两者之间的 🧬 Morph 图层上，图层 2 会后移到它之后开始。 *Where:* 时间线的图层面板 ▸ 🧬 Morph 选项卡. *Since:* 2.610.0
- **✨ 时间线上的自动剪辑** — 把图片和视频按音乐剪辑：找出歌曲的节拍，每个剪切点都在节拍上；LLM 用 video-shotcraft 的剪辑技法规划镜头（停留的开场、主角镜头、热闹与平静镜头交替并穿插标题卡的攀升段、高潮结尾、停留的收尾；每个镜头一种运动——推近、拉远、平移、上升、Ken Burns、漂移、急推变焦、分步变焦、脉动；转场——切换、叠化、推移、甩镜、变焦——按两侧的能量选择），没有 LLM 时用 bitGen 自己的规划；可修改的故事板，然后用时间线自己的关键帧、标题、末尾淡出的歌曲放到新时间线上，检查后即可 ⚙ Compile。 *Where:* Timeline ▸ ✨。 *Since:* 2.894.0
- **✨ 自动剪辑第 2 部分：声音、闪白、变速、先看一遍** — 🔊 bitGen 自己的音效（在项目中由 ffmpeg 生成）与画面对齐：在推移 / 变焦转场上达到峰值的呼啸声、甩镜的嗖声、急推变焦的冲击声、闪白切 / 分步变焦 / 定格的打击声、标题卡的滴答声、上升音 → 冲击声 → 闪光声的收尾；绝不像机关枪；闪白切转场（硬切上的白色画面）；视频的定格后追上和慢动作（时间重映射）；👁 视觉模型查看每张图片 / 每段视频，LLM 按内容挑选镜头；提示词面板中的 "auto edit …"。 *Where:* Timeline ▸ ✨、提示词面板。 *Since:* 2.895.0

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
- **🕺 从视频获取动作（FlowHMR）** — 把视频中的人物捕捉为 3D 动作：带动画的骨架（.fbx）和 SMPL-H（.npz）存入项目的 models3d，可用于时间线的 3D 图层、Blender、Daz 和 Unreal；支持移动或固定镜头。仅限非商业用途（SMPL-H 人体模型以及 Meta 的 SAM 3D Body / VGGT-Omega 许可证）。 *Where:* 预览栏的 🕺 动作，以及 Settings > Add-ons > FlowHMR 动作捕捉。 *Since:* 2.730.0
- **🕺 时间线动作捕捉（RGB MoCap）** — 设置 ▸ 附加组件 安装 RGB MoCap（Windows）；时间线的 🕺 动捕 为它准备片段、打开它，并把它的 FBX / BVH 作为播放动画的 🕺 3D 图层带回来 *Since:* 2.869.0

### 标尺、参考线与网格

- **标尺与参考线** — 以画面像素为单位的标尺；可拖出参考线、移动参考线或输入其位置。 *Where:* 时间线菜单栏. *Since:* 2.446.0
- **吸附** — 移动的图层会吸附到参考线、画面的边缘和中心以及网格。 *Where:* 预览画布. *Since:* 2.446.0
- **网格** — 覆盖在预览画布上的网格，有自己的设置。 *Where:* 时间线菜单栏. *Since:* 2.445.0
- **网格与参考线设置** — 间距、主网格线、线或点、颜色和吸附距离。 *Where:* Timeline settings. *Since:* 2.445.0

### 文字与模板

- **文字效果预设** — 输入时实时绘制的多层 3D 文字效果；可从 PSD 导入你自己的效果。 *Where:* 文字图层的 Properties. *Since:* 2.411.0
- **动画文字、路径文字和 3D 文字上的预设** — 带预设的文字在使用 ✨ Text Animators 和 〰 On a path 时保留预设；3D 文字将预设用作正面（侧面使用其颜色）。 *Where:* 文字的 Properties，3D 文字的 Properties. *Since:* 2.607.0
- **使用你的预设新建文字** — T 工具新建的文字默认使用上次选择的预设；未选中任何内容时 = Properties ▸ New text ▸ Preset。 *Where:* 时间线. *Since:* 2.607.0
- **从 zip 导入文字效果** — 一个包含 PSD 文字效果的 zip（效果包）可一次性将其中每个效果安装为预设，并附带其中的字体；也可以一次选择多个 PSD。 *Where:* 文字图层的 Properties / 图像编辑器的 Type 工具 ▸ Presets ▾ ＋ Import PSD text effects or a zip…. *Since:* 2.617.0
- **形状图层中的文字** — 文字拉伸以填满形状图层的轮廓，或在其中排布（Fit），放置在形状上；跟随动画形状变化。 *Where:* 文字的 Properties ▸ 🔤 In a shape. *Since:* 2.608.0
- **🅰 形状图层的文字填充** — 用一行行文字填充形状（字体、字号、颜色、角度）。 *Where:* 形状图层的 Properties ▸ ◆ Shape. *Since:* 2.608.0
- **任意图层上的变形预设** — 16 种预设（Arc … Twist、Wedge），以可编辑的 ⌗ 网格形式提供，可用 📌 拖动。 *Where:* Properties ▸ 📌 Warp ▸ ⌇ Preset. *Since:* 2.608.0
- **动态图形模板** — 下方三分之一字幕条、标题卡、片尾卡和角标，也可保存自己的模板。 *Where:* 时间线菜单栏. *Since:* 2.417.0

### 时间线上的工具与 CAD 工具栏

- **工具与属性面板** — 画布工具和所选图层的设置位于单独的面板中，可停靠在画布旁边或浮动。 *Where:* 按键 1. *Since:* 2.385.0
- **时间线的 CAD 工具栏** — 预览行上方的功能区，带有 Create、3D、Sketch、Solid 和 Unreal 选项卡（参见“CAD 与 3D”）。 *Where:* 时间线. *Since:* 2.470.0
- **时间线设置** — 微移、歌曲时间、卡拉 OK 样式和网格。 *Where:* 时间线菜单栏右侧的设置按钮. *Since:* 2.376.0
- **时间线的科技感外观** — 把 Edit Booth 标签的风格用在时间线面板上：深色面板、发光的 EDIT / LAYERS 标签、液晶风格的时间读数、带有图层颜色名称条和光晕的深色玻璃片段，以及随缩放变化的时间网格；🧰 工具与属性也一样。没有任何东西移动——只改变颜色、光和字体。一键即可回到经典外观。*位置：* ⚙ 时间线设置 ▸ Look。*版本：* 2.968.0
- **🎛 时间线的控制台** — 图层旁边的硬件风格控制器，每个部件都能用：液晶时间码、走带按键、JOG 飞梭轮（一格一帧）和 SHUTTLE 外圈（按住时以 1x～8x 前后播放，松开即停止）、ZOOM 与 SPEED 滚轮，以及所选图层的 OPACITY / FADE IN / FADE OUT 旋钮和 VOLUME 推子。面板较矮时分成几列，没有空间时自动让开。*位置：* 时间线面板 - 图层左边缘的 DECK 标签。*版本：* 2.969.0
- **屏幕：主屏与附加屏幕** — 时间线的预览重新始终可见（不会再被挤没），旁边可以添加附加屏幕，每个屏幕与主屏（最终画面）同步播放你选择的一个图层。右键屏幕 ▸ ⇄ 与主屏互换：该图层占满大预览，主屏在这个屏幕上播放；用标记或菜单即可换回。最多 8 个，把列拉宽后并排显示。导出始终使用完整画面。*位置：* 时间线面板 - 预览旁的 SCREENS。*版本：* 2.970.0

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
- **Shift+右键点击退出 全屏模式** — 在图像编辑器仅显示画布的 全屏模式中，在任意位置 Shift+右键点击即可退出（不弹出右键菜单）；Ctrl+Esc / Ctrl+Shift+F 仍然有效。 *Where:* 图像编辑器 ▸ 🎨 Full Screen。 *Since:* 2.637.0
- **🎨 全屏模式（图像编辑器）** — 只显示画布，全屏且无边框；Alt+P 在指针处打开调色板（方形色域 + 色相条、色块、最近使用），Alt+G 打开 Layers 面板 + ⏳ Pending，Ctrl+P 打开提示词面板（从当前所在图层生成），Ctrl+B 打开画笔（预设、大小、不透明度、流量），Ctrl+Esc（或 Ctrl+Shift+F）返回。 *Where:* Image editor ▸ 🎨 Full Screen（紧接在菜单之后）/ View ▸ Full Screen。 *Since:* 2.588.0 (2.590.0 起命名为 Full Screen)
- **图像编辑器的每个标签页都是面板** — 将标签页拖出 = 浮动；拖到另一个面板上 = 成为其标签页；拖到面板栏边缘 = 在该处成为独立面板；⠿ 可拖动整个面板；布局会被保留；Window ▸ Show All Dockers / Reset Docker Tabs。 *Where:* 图像编辑器的各面板。 *Since:* 2.590.0
- **右键：Copy、Paste 和 Full Screen** — 图像编辑器的画布菜单有 Copy 和 Paste（新图层）以及 🎨 Full Screen；在 Full Screen 中有 Show Layers + ⏳ Pending、🟧 Blender Scene（打开 / 关闭场景工具）、✨ Prompt（把提示词停靠窗带到前面）和 Exit Full Screen。*Where:* 图像编辑器 ▸ 右键点击画布。*Since:* 2.809.0
- **📝 ✒ 🖼 🌐 图像编辑器顶部条上的四种视图** — WP 视图（页面上下排列，写作功能区：开始、插入、布局、邮件、审阅、导出）、矢量视图（调色板、泊坞窗、标尺）、图像视图（工具、颜色、属性、图层）和网页视图（每页即一个网页：新网站、＋ 网页、建网站、快速预览、在编辑器内按桌面 / 平板 / 手机宽度预览）；也在窗口 ▸ 工作区中。*Where:* 图像编辑器。*Since:* 2.844.0
- **⟷ 缩放到页面宽度** — 页面宽度填满图像编辑器的画布（为标尺留出空间），视图顶部的那一行保持不动；在缩放工具的设置、顶部条、视图 ▸ 页面宽度、Shift+Ctrl+0 和 WP 视图的布局功能区中。*Where:* 图像编辑器。*Since:* 2.845.0
- **📄 页面属性** — 页面的模板（内置的文档、小册子、传单、海报、名片、折页、桌面 / 平板 / 手机网页、社交帖子、幻灯片，或在所有项目中可用的你自己的模板）、以 mm 或 px 计的尺寸、方向、dpi，以及以 mm 计的页边距（显示为不打印的虚线，可让 WP 图层适应页边距），可用于此页或所有页面。*Where:* 图像编辑器（文件、右键、WP / 网页功能区）。*Since:* 2.846.0
- **🧲 吸附按钮和吸附到 WP 框** — 🧲 吸附、┼ 参考线、◰ 对象、▤ WP 框和页边距作为顶部工具条上的开关按钮；移动、变换和绘制都会吸附（Ctrl = 自由）。*Where:* 图像编辑器的顶部工具条、视图 ▸ 吸附到。*Since:* 2.847.0
- **⟷ 不含页边距的页宽** — ⟷ 页宽旁边的 ▯ 开关：关 = 页边距之间的区域填满视图。*Where:* 图像编辑器（顶部工具条、缩放工具选项、视图菜单）。*Since:* 2.847.0
- **图像编辑器的图标工具栏和 🔍 打印预览** — 新建、打开、保存、另存为、打印、打印预览、撤销、重做、剪切、复制、粘贴和 ✨ 创建以图标放在菜单下方；打印预览按实际尺寸显示每一页，并作为一个任务打印全部页面。*Where:* 图像编辑器，文件 ▸ 🔍 打印预览（Ctrl+F2）。*Since:* 2.849.0

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
- **带斜切的变换；粘贴后移动** — Ctrl+T（或 Move 工具选项栏上的 ⤡ Transform）可缩放、旋转和斜切（Ctrl + 拖动边缘）；Paste 会取消选区，以便 Move 工具移动粘贴进来的图层。 *Where:* 图像编辑器。 *Since:* 2.550.0
- **用中间控点斜切** — Free Transform 的中间控点可斜切图层（显示斜切光标），按住 Shift / Alt 拖动中间控点则为拉伸。 *Where:* 图像编辑器，Ctrl+T。 *Since:* 2.551.0

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
- **🖊 数位板（图像编辑器）** — 带曲线的笔压（预设或自定义）、最轻触压 / 满压力区间、你的笔所发送的压感级数、倾斜、橡皮擦端和侧键；所有画笔均支持压力 → 大小 / 不透明度；7 种笔刷（G-pen、Mapping pen、Brush pen、Real pencil、Fineliner、Technical pen、Calligraphy）。 *Where:* Image editor ▸ 🖊 Pen 标签页（位于 🖌 Brush 旁）、Window ▸ Pen Tablet；画笔预设 ▾。 *Since:* 2.570.0

### 变换与变形

- **自由变换** — 移动、缩放、旋转，或直接输入 X、Y、W、H 和角度。*Where:* Ctrl+T
- **斜切、扭曲、透视与变形** — 角点沿边移动、任意移动、镜像移动，或使用带预设和弯曲度的变形网格。*Where:* Edit > Transform。*Since:* 2.422.0
- **变形网格与拆分线** — 从 3 x 3 到自定义网格；可交叉、垂直或水平拆分变形，以获得更多控制点。*Where:* Edit > Transform > Warp。*Since:* 2.450.0
- **操控变形** — 放置图钉并拖动，自然地弯曲图层。*Where:* Edit > Puppet Warp。*Since:* 2.422.0
- **图钉深度与旋转** — 决定折叠处哪一部分位于上层；图钉的旋转可固定，也可保持自由。*Where:* Puppet Warp 选项栏。*Since:* 2.465.0
- **内容识别缩放** — 变窄或变宽时，人脸、物体和边缘保持原有形状；可保护选区。*Where:* Edit > Content-Aware Scale（Alt+Shift+Ctrl+C）。*Since:* 2.422.0
- **液化** — 向前变形、重建、旋转扭曲、褶皱、膨胀，以及冻结蒙版和解冻蒙版。*Where:* Filter > Liquify（Shift+Ctrl+X）。*Since:* 2.422.0
- **液化附加功能** — Smooth、Push Left，以及针对眼睛、鼻子、嘴巴和脸型的人脸识别滑块。*Where:* Filter > Liquify。*Since:* 2.450.0
- **移动工具控制柄** — 双击显示缩放控制柄（无边框，只有控制柄），再次点击显示旋转和斜切控制柄（2.819.0）；文字保持可编辑，形状保持为矢量。*Where:* V。*Since:* 2.452.0
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
- **形状模式、修剪、镜像、偏移** — 形状工具的形状按钮选择模式：点击 = 新建，Shift+点击 = 选中的形状变成它（下一个形状替换它），Ctrl+点击 = 添加到它，Alt+点击 = 从它中减去，Ctrl+Alt+点击 = 相交；✂ 修剪剪掉轮廓上位于其他轮廓交点之间的一段（其余首尾相连）；⇋ 翻转 / 镜像复制；⧈ 偏移扩大或缩小轮廓（圆角）；拿着形状工具时也在右键菜单中。*Where:* 图像编辑器 ▸ 形状工具 (U)。*Since:* 2.810.0
- **全部取消选择、双击变换、统一的形状模式** — Ctrl+Shift+A 清除所有选择（选区、选取的对象、选取、节点）；双击形状或其在 Layers 中的行 = Move 工具的控制柄（无边框），再次点击 = 旋转 / 斜切；Lasso 的线条在任何图片上都可见，Polygonal Lasso 和 Bézier 会显示通往指针的下一条边；属性栏上的 ◻ ⊕ ⊖ ⊗ ⊘ 让所有形状工具进入该模式，模式符号显示在指针旁边。 *Where:* 图像编辑器。 *Since:* 2.819.0
- **插入框架、排列、形状和文字的渐变、真正的剪切** — Insert Into Frame：粗黑箭头，点击闭合形状后选取的图层放入其中（填充作为背景，排列顺序保持，随框架移动和缩放）；右键点击对象可 Bring to Front / Forward、Send Backward / to Back（框架内的图层留在框架内）；Gradient 工具的拖动可填充矢量形状（仍是形状）或文字（渐变叠加）；Shape 工具的相加 / 相减 / 相交生成一个真正的轮廓。 *Where:* 图像编辑器。 *Since:* 2.821.0

### 矢量工作面板

- **变换面板** — 围绕九个锚点进行位置、旋转、缩放和镜像、大小和斜切操作，可生成副本。*Where:* Window > Dockers（Alt+F7）。*Since:* 2.429.0
- **造形面板** — 焊接、修剪、相交、简化、前减后、后减前、边界。*Where:* Window > Dockers。*Since:* 2.429.0
- **对齐与分布** — 对齐到活动对象、选区、页面边缘或页面中心。*Where:* Window ▸ Dockers。*Since:* 2.429.0
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
- **🖌 投影工具和 WP 图层** — 在图层中按下并拖到影子落下的位置（控点可再次移动；模糊 / 不透明度 / 颜色 / ✕ 移除）；文字处理图层改为 WP 图层（Layer ▸ New、WP 标记、✎ 在此 WP 图层中输入）。电子表格的 Excel 导出加入 Constants 工作表，打开时恢复。*Where:* 🖌 图像编辑器（Shift+G）、▦ 电子表格 ▸ 导出。*Since:* 2.829.0
- **🖌 透明度渐变和渐隐滑块** — 在图层（图片、形状、文字、WP 图层、组）中按下并拖动：沿线从开始 % 渐隐到结束 %，线性或径向；拖动两端或菱形（渐隐到一半的位置）；渐变填充和投影也有同样的菱形（渐隐 / 影子不透明度）。套索、钢笔和曲线工具只有在距起点 5 px 以内结束时才闭合——否则线保持开放。*Where:* 🖌 图像编辑器（Shift+G）。*Since:* 2.830.0

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
- **图像编辑器中的参考图** — 拖入的参考图会变成一个图层；✨ Edit 可以把参考图用作 Picture 2。 *Where:* 🖼 Image editor。 *Since:* 2.539.0
- **生成 = 新图层** — 在图像编辑模式下，生成的图片总是作为新图层导入，并使用提示词面板中选定的风格（Generate 会列出 Krea 2 及其他所有风格）。 *Where:* 图像编辑模式下的提示词面板。 *Since:* 2.549.0
- **无缝填充** — 选区通过提示词面板所选风格的专用工作流图（编码后的图片 + 噪声蒙版 + 差分扩散）进行填充，融合效果与 Krita AI 插件相同；Krea 2、Klein 等风格现在都能用于填充。 *Where:* 有选区时的图像编辑器，Generate / Refine。 *Since:* 2.550.0
- **像 Krita AI 插件一样填充** — 选区周围提供更多上下文，选区先由其边缘内容预填充，使用柔和蒙版，对未针对局部重绘训练的模型以 0.9 为起始值。 *Where:* 有选区时的图像编辑器。 *Since:* 2.551.0
- **采用 Krita 插件自身代码的填充与编辑** — Generate 以全强度运行，小区域放大后渲染，蒙版大小随选区而定，越过边缘进行融合并匹配颜色，在选区内 Edit 只改动选区。 *Where:* 有选区时的图像编辑器。 *Since:* 2.552.0
- **用编辑模型填充** — 在选区中通过编辑模型执行 Generate / Remove / New background（选区涂成绿色 + Krita 的指令），使新内容与场景融为一体；▾ Edit 可限定在选区内，或限定在图层自身的像素内。 *Where:* 图像编辑器的 ✨ AI 面板（👁）、提示词面板。 *Since:* 2.553.0
- **Generate 适应选区** — 无法看到选区周围内容的风格会按选区自身边界框的尺寸生成图片，因此画出的内容与选区大小一致。 *Where:* 图像编辑器的 ✨ AI 面板（👁 关闭）、提示词面板。 *Since:* 2.554.0
- **按模型系列采用 Krita AI 插件的填充方式** — SDXL / Pony 使用 Fooocus inpaint 补丁，Illustrious / SD 1.5 / FLUX.1 使用局部重绘 ControlNet，Remove 先用 MAT / LaMa 处理，并采用 Krita 的上下文边界及其 Add content / Fill 模式。 *Where:* 图像编辑器的 ✨ AI 面板（填充行）、提示词面板；安装界面会列出所需节点包和模型。 *Since:* 2.555.0
- **⏳ 待处理** — 每次 ✨ 运行都直接进入队列，无需等待；结果在编辑器内的一个面板中等待，✔ Apply 将其放到所属图层上方、该图层的“✨ changes”组中，🗑 Delete 将其丢弃。 *Where:* 图像编辑器（✨ AI 面板中的 ⏳ Pending）。 *Since:* 2.556.0
- **所有 ✨ 模式都可使用参考图** — 提示词中的“picture N”会把 References 面板中的对应图片带入 Edit、Generate、Fill、Remove、Refine（通过编辑模型）；Compose 中则使用“ref N”。 *Where:* 图像编辑器的 ✨ AI 面板、提示词面板。 *Since:* 2.556.0
- **AI 填充模型附加组件** — 用于 Krita 方式填充的节点包 + Fooocus / MAT / 局部重绘 ControlNet 文件，在 Settings ▸ Add-ons 中勾选并下载。 *Where:* Settings ▸ Add-ons ▸ AI fill models。 *Since:* 2.557.0
- **🔲 区域（图像编辑器）** — 画布上的若干框，每个框写明其中要放的内容；可逐框填充（每个框执行一次 ✨ Generate）、由 Edit 模型一次完成（在副本上勾出各框轮廓），或作为区域提示词一次完成（生成新图片，每个框的文字只作用于框内）。 *Where:* Image editor ▸ ✨ AI panel ▸ 🔲 Zones；与选框工具放在一起的 Zones 工具。 *Since:* 2.569.0
- **🎭 区域角色 LoRA** — 区域的 🎭 可选择一个只在该框内生效的角色 LoRA（最多两个不同的 LoRA），让两个角色在同一张图片中各自保持自己的面孔；场景描述作用于整张图片。 *Where:* Image editor ▸ ✨ AI ▸ 🔲 Zones ▸ ▦ Regional（Settings ▸ Add-ons ▸ Nougan Nodes）。 *Since:* 2.592.0
- **⚡ 实时生成（图像编辑器）** — Krita 的实时模式：每次更改后稍等片刻即重新渲染（以实时强度对整张图片执行 Refine，并使用独立的风格 / 步数 / 尺寸 / 🔒 种子），一次只渲染一张，以最新的更改为准，模型常驻加载，排在队列最前，从不出现在队列面板 / 图库中；▣ 以混合比例显示在画布上；✔ Apply as layer 作为图层应用。 *Where:* Image editor ▸ ⚡（菜单栏）/ View ▸ ⚡ Live Generation。 *Since:* 2.588.0
- **从 Full Screen 生成** — 在 🎨 Full Screen 中，Alt+G 在画布上方显示 Layers 面板和 ⏳ Pending，Ctrl+P 显示提示词面板：选取图层，▾ Edit 或 Generate，从 ⏳ Pending 中保留结果——全程不离开全屏画布；调色板为 Alt+P。 *Where:* 图像编辑器 ▸ 🎨 Full Screen。 *Since:* 2.646.0
- **🖼 生成到选区 / 整个画布；编辑：局部重绘 / 填充 / 扩图** — 打开图像编辑器时，✨ 生成会画进选区（没有选区则按画布形状铺满整个画布），作为新图层；✏ 编辑像 Krita AI 插件一样选择 自动 / 局部重绘 / 填充 / 扩图，使用提示词停靠栏的编辑模型。*Where:* 提示词停靠栏的 ▾ + 图像编辑器。*Since:* 2.834.0
- **🖼 在空图层上生成、非矩形选区、WP 图层、控点指针** — 空图层 + ✨ 生成会用任何图像风格（勾选“覆盖风格”时使用基本设置）填满选区形状（或整个画布），非矩形选区外不留任何内容；非矩形选区的填充为硬边；点击 WP 图层 = 文字处理；每个控点显示自己的指针，拖动时为强调色。*Where:* 图像编辑器 + 提示词停靠栏。*Since:* 2.836.0
- **🖼 在形状中生成、转换为形状、✨ 用 AI 撰写** — 选中的形状（包括钢笔 / 贝塞尔 / 线条路径）+ ✨ 生成会填满形状（闭合形状变成装着图片的框架，开放线条按其区域裁切）；矢量线条或路径可转换为带填充和边框的形状；选中 WP 图层时，提示词停靠栏的 LLM 会把文章 / 报告 / 故事写进去（也可依据 .txt、.md、.docx、.pdf 文档）——表格在正文中，图表和图片作为 WP 组中的图层。*Where:* 图像编辑器 + 提示词停靠栏。*Since:* 2.837.0

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
- **在 Blender 视图中缩放** — 🔍＋ / 🔍－、Alt+拖动（向前 = 放大，向后 = 缩小）以及 ⌖ Zoom to object (Z)；在图像编辑器中不显示播放条和 Auto-key。 *Where:* Blender 场景工具的按钮。 *Since:* 2.546.0
- **按骨架选取绑定好的人物** — 点击带蒙皮的身体会选中它的骨架，因此移动时整个人物随之移动（而不只是控件）。 *Where:* Blender 场景工具（时间线和图像编辑器）。 *Since:* 2.550.0

### 从图片生成 3D 场景和模型

- **图片转 3D** — Hunyuan3D 2.1（形状）或 TRELLIS.2（形状和纹理）可从任意图片生成 .glb。 *Where:* Gallery 和 Assets 图片上的 3D 按钮。 *Since:* 2.404.0
- **用 AI 搭建场景** — 本地 LLM 用 58 类对象规划 3D 场景和摄像机路径，其余部分使用 3D 模型；由 Blender 完成搭建。 *Where:* Blender 预览的 Build 按钮。 *Since:* 2.404.0

### SolidCraft 参数化 CAD

- **SolidCraft 全窗口** — SolidCraft 面板上的 ⛶ 会填满整个窗口（标题栏和状态栏保留）并关闭其他面板；🗗 / Esc 将布局恢复原样。 *Where:* 📐 SolidCraft 面板。 *Since:* 2.638.0
- **📐 SolidCraft 面板** — 开源参数化 3D CAD（SolidCraft，MIT OR Apache-2.0）位于独立面板中，包含 SolidCraft 的全部功能；设计和零件保存在项目中，SolidCraft 的 Save 会使其保持最新；可将模型的图片（或 SolidCraft 的渲染图）送入图像编辑器，将模型作为时间线 3D 图层，将图像编辑器的草图图层送入 SolidCraft，并将 STEP / STL / OBJ / 3MF 导入项目。 *Where:* 状态栏中的 📐 SolidCraft；Settings ▸ Add-ons ▸ SolidCraft。 *Since:* 2.578.0
- **从 SolidCraft 发送** — 将零件发送到图像编辑器、时间线、📏 Sketcher（2.630.0：作为一个组——此前是 House builder）、Blender（随之打开并保存为 .blend——找到 Blender 时显示）和 Unreal（作为 Static Mesh 放入关卡——设置了 Unreal 项目时显示；插件 1.4.0）；仅在安装了 SolidCraft 时显示该面板。 *Where:* 📐 SolidCraft 的工具栏。 *Since:* 2.579.0
- **✨ 在 SolidCraft 中生成零件** — 文字描述或图片 -> CadQuery 代码（cadrille，或带错误修复的本地 LLM）-> SolidCraft 自身可编辑的草图、拉伸、切除、孔、圆角和倒角（按体积校验；否则将 STEP 作为单个实体导入）；代码可编辑并重新运行。 *Where:* 📐 SolidCraft ▸ ✨ Generate；Settings ▸ Add-ons ▸ CAD generate。 *Since:* 2.581.0

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
- **🛤 道路工具** — 像 SimCity 一样绘制道路：Dirt road、Street、Road、One-way、Avenue 和 Highway（车道、人行道、中央隔离带、护栏、标线），贴合地面；坡度超过该类型的允许值时，⛏ 将地面开挖成均匀坡度，或 🚇 以隧道穿过（深谷上则架桥）；自动识别路口，并设置红绿灯、停车 / 让行标志、停车线、人行横道、路名牌和限速标志；可选择靠左或靠右行驶。 *Where:* Sketcher ▸ Ground ▸ 🛤 Road。 *Since:* 2.673.0
- **檐沟截面** — 屋顶的檐沟是一个截面：内置 Quad、Half round、OG（ogee 正面）和 Square line，也可像踢脚线或顶角线一样在截面编辑器中自己绘制（直线和贝塞尔曲线），沿每条檐口扫掠生成并配有落水管。 *Where:* Sketcher ▸ 屋顶 ▸ Gutters / Gutter profile / ✎ Gutter profiles…。 *Since:* 2.671.0
- **贝塞尔截面编辑器** — 用节点和贝塞尔曲线绘制踢脚线、顶角线、框线和窗台截面（内置圆弧各为一条曲线）；双击线段可添加节点，右键点击可将线段转换为曲线 / 直线或删除节点。 *Where:* Sketcher ▸ 踢脚线 / 顶角线 ▸ ✎ New / edit profiles…。 *Since:* 2.670.0
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
- **Shift + 右键拖动缩放** — 向前（向上）放大，向后（向下）缩小，以按下的点为中心；单纯右键点击仍会打开菜单。 *Where:* Sketcher、时间线的画布、图像编辑器（🎨 Full Screen 中也可以）。 *Since:* 2.648.0
- **缩放至所选** — ⊡ 让所选内容充满视图：Sketcher 中的面或建筑构件、时间线上选中的图层、图像编辑器的选区（或选中的图层）。 *Where:* Sketcher ⊡，时间线 ⊡，图像编辑器 ⊡ / View ▸ Zoom to Selection (Ctrl+Alt+0)。 *Since:* 2.648.0
- **指针工具** — Sketcher 的 Select 以及时间线和图像编辑器的 Move 都以指针箭头显示。 *Since:* 2.648.0
- **在 Sketcher 中多选** — 单击选取一个对象，Ctrl+点击添加更多（房间、墙、门、家具、灯光、摄像机、面）；拖动其中一个即可全部移动，Delete 全部删除。在 Orbit 中按 Esc = Select；Esc 永远不会让最大化的 Sketcher 停靠回去。 *Where:* Sketcher ▸ ➤ Select。 *Since:* 2.648.0
- **平面图视图** — 以应用的主题颜色从正上方查看 Sketcher，一次显示一层：墙体以实心剖切显示，门带开启弧线，窗带玻璃和窗台，楼梯带踏步和 UP 标记，家具和灯光以平面符号显示，每个房间标有名称、宽 × 长和面积；所有工具都可在其上绘制，点击可选取符号；Orbit 会让它恢复平放。 *Where:* Sketcher ▸ 📐 Plan，View ▾ 📐 Floorplan。 *Since:* 2.647.0
- **Esc = Orbit** — 按一次 Esc 即放下当前工具并取消选取，在所有 Sketcher 视图（3D、平面图、摄像机视图）中切换到 🔄 Orbit。 *Where:* Sketcher。 *Since:* 2.647.0
- **房间宽度和长度** — 每个房间的面板都有 Width 和 Length（矩形保持其角点不动，其他形状则被拉伸）；Room 工具的 Width × Length 一次点击即可放置该尺寸的房间。 *Where:* Sketcher ▸ 房间，Room 工具。 *Since:* 2.647.0
- **在摄像机自身视角中移动和转动摄像机** — 通过选中的摄像机观看时，✥ Move / ⟳ Rotate 会在视图前方显示其箭头或旋转环；摄像机与视图一起移动 / 转动；Esc 取消选中。 *Where:* Sketcher ▸ 摄像机的面板，👁 Look through。 *Since:* 2.643.0
- **摄像机移动和旋转控件** — 选中的摄像机会高亮显示（无边框），并显示 X / Y / Z 移动箭头：拖动摄像机可在其当前高度上移动，拖动箭头可沿单轴移动（步长 1 cm）；双击可切换到旋转环，再双击切回；点击其他对象则选中该对象。 *Where:* Sketcher ▸ Select，摄像机。 *Since:* 2.641.0
- **每个部件的专属属性** — 在视图或大纲中点击墙、地板、天花板、踢脚线、顶角线或地板楼板，会显示其专属面板：墙的长度、高度和内侧颜色，地板的标高，天花板的类型；Delete 关闭该部件。 *Where:* Sketcher ▸ Select，🗂 Outline。 *Since:* 2.640.0
- **踢脚线、顶角线、框线和窗台的截面** — 图片下拉菜单中有 30 种内置截面；踢脚线沿墙扫掠，转角斜接（在门框处止住），顶角线位于天花板下方，门窗套线环绕门（两面）和窗，另有窗台；✎ Profiles… 可绘制自定义截面（1 mm 网格上的点，按宽 / 高缩放）并保存在项目中。 *Where:* Sketcher ▸ 踢脚线 / 顶角线 / 门 / 窗的面板。 *Since:* 2.640.0
- **斜墙** — 双击墙顶添加一个切点，向上 / 向下拖动（山墙端）；选取顶边后拖动或输入其高度（单坡墙）；Delete 删除切点 / 边。 *Where:* Sketcher ▸ Select。 *Since:* 2.624.0
- **随墙而定的天花板和屋顶** — 房间的天花板可设为 None / Flat / Follows the walls' slope；随墙的屋顶带有檐口宽度。 *Where:* Sketcher ▸ 房间的面板，Y Roof。 *Since:* 2.624.0
- **Sketcher 采用 bitGen 的配色；双击空白处 = Orbit** — 面板及其 3D 视图使用主题颜色；双击空白处会取消所有选取并进入环绕。 *Where:* Sketcher。 *Since:* 2.624.0
- **Sketcher 的独立窗口和 File 菜单** — ⛶ 让它充满标题栏与状态栏之间的整个 bitGen 窗口（之后 ⇲ Dock 将其放回，2.624.0），✕ 将其关闭；☰ File：新建、打开、保存、另存为、重命名、导入、导出、发送、删除、关闭；🖼 → Image editor 和 🎞 → Timeline 按钮；⌂ Cut-away。 *Where:* Sketcher 的标题栏和工具条。 *Since:* 2.620.0
- **📷 让相机在房屋中漫游** — 在平面图上拖动相机，3D 视图会透过它观察；方向键使其转向和俯仰，Shift / Alt 使其升高和降低。 *Where:* 🏠 House. *Since:* 2.532.0
- **📽 投射图片** — 当前视图就是投影仪：把图库、素材、参考图或本机的一张图片投射到视图看到的东西上（每面墙单独计算、地板、天花板、屋顶、门窗、楼梯、绘制的形状、地面），或只投射到选中的部分——图片完整放进视图、在边框处精确裁切、只落在朝向投影仪的面上，两次投射重叠时后者优先；列表中可 ☐ 隐藏、👁 回到投射时的视图、🗑 删除，每次操作可撤销一步，并随模型保存；✨ Photo 能看到它，导出的 .glb（项目的 3D 模型、Blender、Unreal）以真正的纹理带上它。*位置：* Sketcher ▸ 📽。*版本：* 3.6.0
- **💎 精细细节（Direct3D-V3）** — 一张图片加上它的粗略 3D 模型（可由 🧊 转为 3D 的 Hunyuan3D 2.1 从图片自动生成，或用项目中的模型）变成细节丰富的模型：Direct3D-V3（DreamTech，SIGGRAPH Asia 2026）在有符号距离体素上雕刻细节——512、1024 或 1536 分辨率、可设面数、小显存可用省内存模式；<name>_detail.glb 以粗模的大小和位置进入 3D 模型并导入 Sketcher。附加组件（代码 MIT；DINOv3 需授权：在 Hugging Face 接受 Meta 的许可）；flash-attn 和需要编译的部分由 bitGen 自己的替代实现运行，无需 CUDA 工具包。*位置：* Sketcher ▸ 💎 Fine detail；Settings ▸ Add-ons ▸ 💎 Fine detail。*版本：* 3.7.0
- **🧍 在视图中移动、旋转、摆姿 DAZ 角色；每个对象都有 👁** — 拖动选中的 DAZ 角色在地面上移动，脚下的黄色圆环用于旋转；在 🕺 Pose 中，选中的骨骼周围有三个圆环（红／绿／蓝＝它的 X／Y／Z 滑块，限制在其范围内，🪞 Mirror 同样生效）；✥ 在角色身上平移或旋转资源（道具、头发、服装）并随角色保存，⟲ 复原。🗂 Outline 中每个形状和形状组、每个标题、每个 DAZ 角色及其部件都有 👁（隐藏的形状不绘制、不可选、不导出；标题的 👁 一次隐藏或显示其下全部）。*位置：* Sketcher ▸ 📚 DAZ（3D 视图、🧭 DAZ Explorer ▸ In the model ▸ ✥）；Sketcher ▸ 🗂 Outline。*版本：* 3.8.0
- **🧩 Ming 分层设计** — 为每个图层命名并说明内容（＋ Add layer、↑ ↓、位置）；Ming-Image Design（ComfyUI 中在 0.2 文本编码器公开前使用 0.1） 根据列表生成设计，Ming-Image-0.1-Design-Layer 再把它拆成这些图层 —— 每层都是独立的透明图层，放在 🧩 组里，名称与你所起的一致，扁平设计隐藏保留在下方。也可以拆分当前打开的图片。在 ComfyUI 自带的 Ming-Image 节点（0.46.0 或更新版本）上用 Comfy-Org 的文件运行（附加组件：int8，已下载时使用 bf16），或在 OpenRouter 上运行。*位置：* Image editor ▸ Layer ▸ 🧩 Ming Layered Design…；Settings ▸ Add-ons ▸ 🧩 Ming layered design。*版本：* 3.9.0（ComfyUI 版 3.12.0）
- **✂ 把图层拆成多个图层 / 🧩 分层图片模板** — 图层面板底部只有图标的 ✂，用 Ming-Image 把选中的图层（图片、文字、形状或组）拆成多个图层：只给图层数（让 Ming 决定）或给列表；结果放在其上方的 🧩 组中，按原图层的形状裁切，原图层隐藏保留。✨ 用 AI 创建 ▸ 🧩 分层图片：LLM 规划图层，Ming 对话框打开并已填好。*位置：* 图层面板的 ✂、Layer ▸ ✂ Split Layer Into Layers…、File ▸ ✨ Create With the AI… *版本：* 3.13.0
- **🏞 分层场景 + 🛤 地面与透视** — 把一张图做成分开的图层：背景、每个物体各自一层且完整不缺、文字为文字图层。📷 照片合成（一张场景由编辑模型拆开 - 光线一致）或 🎨 海报 / 美术作品（每层单独生成）；🤖 LLM 规划各行。🛤 沿地面拖动物体，越靠近地平线越小，🌑 阴影跟着移动。*位置：* Layer ▸ 🏞 Scene in Layers…、Layer ▸ 🛤 Ground & Perspective Tool、✨ Create With the AI ▸ 🏞 Scene in layers。*版本：* 3.14.0
- **🧱 图片 → 3D 场景** — 放入一张图片：Vision 模型找出其中的主要物体，Qwen Image 2.1 edit 把每个物体抠出来并做出干净背景（物体去掉后的画面），360 outpaint LoRA 把背景扩展成 360° 环境，Hunyuan3D 2.1 / TRELLIS.2 为每个物体生成 3D 模型，Stable Audio Open 1.0 为场景和每个物体生成声音——最后在项目的 3D 模型里得到一个场景 .glb：物体放在图片中的位置（方向、地面上的距离、高度），全景包围相机。⤒ 在 Sketcher 中打开、👁 3D 环视、▶ 声音、⤓ 下载。全部在这台电脑上运行（各模型的许可：Qwen Research 仅限非商业；Stability AI Community 年收入低于 100 万美元免费）。🌍 Walk-in world（附加组件：HunyuanWorld 1.0——不可在欧盟、英国、韩国使用，FLUX.1 Fill 仅限非商业，需 24 GB 显存）把全景变成可以走进去的分层 3D 世界。*位置：* Sketcher ▸ 🧱 Picture → 3D scene。*版本：* 2.975.0
- **🦴 绑定骨骼** — 用 UniRig（MIT，附加组件）为项目中的 3D 模型（人、动物、生物，例如 🧊 Convert to 3D 或 🧱 Picture → 3D scene 做出的模型）生成骨骼和蒙皮权重：3D 模型里得到 `<model>_rigged.glb`，可在 Blender 或时间线上摆姿势、做动画。*位置：* Sketcher ▸ 🦴 Rig ▾、🧱 对话框里的 🦴 Rig。*版本：* 2.976.0
- **📚 Daz 素材库** — 不是 Daz Studio 的替代品（只用于轻量任务；Daz Studio 是非常强大的角色制作软件）：bitGen 直接读取你自己的 Daz 内容文件夹（无需启动 Daz）——带缩略图的人物和角色、形体调节、套在人物骨骼上的服装／头发／解剖部件、我们自己的布料和头发物理（轻量悬垂）、照片生成的脸——输出带骨骼的 `<name>_daz.glb`。加密的 Daz Connect 内容会被跳过。*位置：* Sketcher ▸ 📚 Daz library。*版本：* 2.977.0
- **🧍 为 Daz 角色摆姿势 + 💪 它自己的肌肉反应** — 不是 Daz Studio 的替代品（只用于轻量任务；Daz Studio 是非常强大的角色制作工具）：用 `<name>_daz.glb` 自己的骨骼在 3D 中摆姿势（在列表中选骨骼或点击身体，在角色自身的限制内旋转，另一侧镜像）；角色的 JCM（关节控制变形）按它自己的 DSON 公式实时跟随，关节弯曲时肌肉隆起、褶皱出现；没有 JCM 的角色使用我们自己的弯曲隆起。构建角色时也会应用其调节公式（ERC）。姿势按角色保存，可存为 .json。*位置：* Sketcher ▸ 📚 Daz library ▸ 🧍 Pose…。*版本：* 2.979.0
- **🧬 DAZ Tools** — 不是 Daz Studio 的替代品（只用于轻量任务）：Sketcher 自己工具栏中的 📚 DAZ（3.2.0：不在顶部菜单栏），在主栏左侧打开 📚 DAZ 素材库停靠栏，右侧打开 🧭 DAZ 浏览器（你的角色及其组成：人物、服装、头发、解剖部件）和 🎚 形状控制（所选角色的调节滑块，按组、可搜索、只看已改）；在浏览器中构建、摆姿势、打开和保存。关闭即隐藏两侧。*位置：* 菜单栏 ▸ 🧬 DAZ Tools。*版本：* 2.980.0
- **📷 从照片生成 Daz 身体（两种方式）** — 不是 Daz Studio 的替代品（只用于轻量任务）：把你自己的 Daz 人物变形成照片中的人，因此它的 UV、骨骼、肌肉形状和服装贴合都保持不变，照片被画进这些 UV。**A - 调整滑块**：视觉模型标出身体关键点，按比例拟合人物自己的身体滑块（填入真实身高则尺寸也准确）。**B - 扫描 + 包裹**：照片先生成 3D 形状（Hunyuan3D 2.1 / TRELLIS.2），人物被包裹到它上面成为自己的变形，颜色烘焙进人物的 UV。每次尝试都在浏览器里生成一个新角色：两种都试，留下更好的。*位置：* 🧬 DAZ Tools ▸ 🧭 Explorer ▸ 📷 Body from a photo。*版本：* 2.981.0
- **📏 用身高和体重生成 Daz 身体** — 不是 Daz Studio 的替代品（只用于轻量任务）：输入身高（cm）、体重（kg），如有还可输入三围（胸、腰、臀）；人物自己的身体滑块会被拟合（体重由身体体积算出），体型（偏瘦、普通、健壮、丰满）决定使用哪些滑块。📏 Measure it 显示角色当前的数值。每次生成一个新角色。*位置：* 🧬 DAZ Tools ▸ 🧭 Explorer ▸ 📏 Height & weight。*版本：* 2.982.0
- **🎬 给 Daz 角色加上 Mixamo 动作** — 不是 Daz Studio 的替代品（只用于轻量任务）：打开从 Mixamo 下载的动画（FBX、Without Skin），它会在你的角色上播放——匹配 Genesis 3 / 8 / 9 的骨骼，修正 T 姿势与 A 姿势的差别，步幅按腿长缩放（或原地），角色自己的肌肉形状逐帧跟随；⤓ Bake 把带动作的角色副本存为 glTF 动画，供时间线 3D 图层或 Blender 播放。*位置：* 🕺 Pose ▸ 🎬 Motion (Mixamo)。*版本：* 2.982.0
- **Sketcher 里的 DAZ 停靠栏** — 不是 Daz Studio 的替代品（只用于轻量任务）：在 Sketcher 中采用类似 Daz Studio 的布局——📚 DAZ 素材库浮在 3D 视图上，🧭 DAZ 浏览器和 🎚 参数（形状 / 姿势 / 动作）停靠在旁边，一个按钮显示或隐藏。把人物拖进 3D 视图，它就作为带骨骼的角色站在那里；选中后，点击或拖放服装、鞋子、头发、解剖部件、姿势预设和形状预设到它身上；点击身体选骨骼摆姿势；也可在它身上播放 Mixamo 动作。*位置：* Sketcher ▸ 📚 Daz library。*版本：* 2.983.0
- **Sketcher 的 ⚙ 停靠栏和方向键** — ⚙ 属性面板（所选工具的设置、所选对象）和 🗂 大纲放进左侧工具箱旁一个可折叠的停靠栏（« 折叠成细条）；Sketcher 的其他面板——🧱 墙体类型、📚 DAZ 素材库、🧭 DAZ 浏览器、🎚 DAZ 参数——可以作为标签页或作为下方独立的停靠栏停靠进来（拖动标签、把素材库的标题拖到上面，或用 ▾），也可以回到原来的位置；布局会被保存。没有工具进行到一半时，**↑ / ↓** 放大 / 缩小，**← / →** 绕竖直轴旋转视图（Shift：步幅更大）。*(2.984.0)*
- **Sketcher 的 🔍 缩放、🏛 建筑和 DAZ 修正** — 工具箱里的 🔍 缩放（拖动 / 点击）；顶部工具栏的 🏛 建筑按钮可隐藏或显示所有建筑工具；Delete 删除在视图中选中的 DAZ 角色（↶ 撤销可恢复）；浏览器列出角色实际构建的每个部件（身体、眼睛、嘴、移植件、头发、衣服），可用 👁 显示 / 隐藏；🎨 材质预设（眼睛颜色、妆容、皮肤）会被绘制上去；会转动或移动整个人物的姿势（躺、跪）会被应用并在重新加载后保留；✨ 照片保留角色（作为人物写入提示、出现在深度图中），渲染失败时会说明原因。*(2.985.0)*
- **Sketcher 的 ✂ 拆分与方向键** — 工具箱里的 ✂ 拆分为部件：一个组变成每个部件一个组（导入的模型按其网格名称，其他按互不相连的部分），一步即可撤销。方向键平移视图；Ctrl+↑ / ↓ 缩放，Ctrl+← 显示全部，Ctrl+→ 缩放到所选。*(2.986.0)*
- **图片预览中的 🌐 全景 3D + 带参考图的 ✨ 照片** — 在预览中把图片作为环绕你的 360° 全景查看：拖动、缩放、方向键 / WASD、自动旋转、全屏，👓 VR 左右或上下格式，立体全景按眼分别显示。Sketcher 的 ✨ 照片会使用提示面板中的参考图和提示词（两者都没有时只渲染场景）。*(2.987.0)*
- **🙂 像本人的头部 + 界面大小缩放全部** — 📷 由照片生成身体时也会塑造头部（宽度、眼睛以上的高度、下巴——来自照片中的脸或一张脸部特写），并把脸部绘制在已绘制的身体上；界面大小滑块（60 - 250 %）会缩放整个应用——按钮、图标、停靠栏、文字——适合远处的屏幕。*(2.988.0)*
- **✨ 照片完整遵循提示词；以透明背景发送到图像编辑器** — 有提示词时，✨ 照片和 ✏ 编辑（Sketcher）会在模型周围加入提示词中的地点、场景、天气以及其他人物或物体（模型的形状和镜头不变）；→ 图像编辑器以透明背景发送 Sketcher 视图。*(2.989.0)*
- **✨ 照片把提示词中的地点放到模型周围** — 有提示词时，空白背景会被提示词描述的地点替换（“站在公园里的女人”就会得到公园），而不是纯白背景；你自己设置的背景 / 天空保持不变。*(2.990.0)*
- **✨ 照片保留你的参考图** — 单张参考图会完整发送给编辑模型（不再裁剪成小图块），把它的地点和风格放到模型周围。*(2.991.0)*
- **✨ 照片：不再是灰色背景** — 类型为 environment 的参考图：把模型直接画进那张图，再做成一张真实照片；有提示词或其他类型的参考图时，模型周围的灰色被涂成绿色，由同一个编辑模型在遮罩下重新填充（第二步），地点来自提示词、氛围来自参考图——模型本身的像素保持不变。*位置：* Sketcher ▸ ✨ 照片。*版本：* 2.993.0
- **⤓ 把 Daz 内容导入资料库文件夹** — 在 DAZ Library 停靠面板中：新建带 Daz 目录结构的资料库文件夹（或给现有文件夹加上结构），添加放产品 zip 的文件夹，找出所有 zip（含子文件夹）并查看内容，再解压到 Daz Studio 期望的位置（去掉 Content/ 和外层文件夹，打开 zip 里的 zip，已有文件除非选择替换否则保留）。不能替代 Daz Studio 的 Install Manager——用于轻量任务。*位置：* Sketcher ▸ 📚 DAZ Library ▸ ⤓。*版本：* 2.993.0
- **⛰ 全景深度（PaGeR）——仅限非商业用途** — 在 🌐 全景 3D 中按 ⛰ Depth，读取 360° 全景的形状（以米为单位的深度、天空、表面法线），全景按这个形状包围你：可以在其中走动，👓 VR 视图变成真正的立体；还会生成供 VR World 和 VR 播放器使用的上下立体 360，以及可走入的网格（.glb）。首次使用时下载（插件）。PaGeR 的权重为 CC BY-NC 4.0：仅限非商业用途。*位置：* 图片预览 ▸ 🌐 全景 3D ▸ ⛰ Depth；设置 ▸ 插件。*版本：* 2.994.0
- **✨ Photo / ✏ Edit (Sketcher)：同一规则、结果检查、可同时多张** — 两个按钮用同一种方式生成照片（模型自带的背景保留；environment 参考图 = 把模型放进那张图；其他情况，无论有无文字，都把模型周围的灰色填成真实场景）。如果照片返回时仍像灰色 3D 人体模型，会再生成一次；场景仍有灰色或绿色时会再填一次。生成中再按一次即加入队列（按钮显示数量）。模型轮廓现在来自剪影渲染，因此在真实显卡上填充也能运行。*位置：* Sketcher ▸ ✨ Photo；提示词面板 ▸ ✏ Edit (Sketcher)。*版本：* 2.995.0
- **✨ Photo / ✏ Edit (Sketcher)：每步只做一件事，每步都检查** — 第 1 步只把模型变成真实照片（灰色背景保持不变；类型为 person / clothing / object 等的参考图用于模型外观）；第 2 步只做场景（用文字或 *style* 参考图填充灰色，或把模型抠出放到 *environment* 参考图上，只融合边缘）。如果某步照搬了参考图或仍是灰色人体模型，会不带参考图再做一次；填充太平淡会再填一次；仍失败的部分以 ⚠ 显示。*位置：* Sketcher ▸ ✨ Photo；提示词面板 ▸ ✏ Edit (Sketcher)。*版本：* 2.996.0
- **附加组件自己准备所需的 Python** — 🦴 Rig it（UniRig：仅限 Python 3.11）、⛰ Panorama depth 和 👗 Garment designer（3.10 - 3.12）在应用自带的 Python 合适时直接使用；否则查找本机上其他合适的 Python（py 启动器、常见安装文件夹）；再没有就把 uv 装进应用的 runtime 文件夹，由它把该版本 Python 下载到那里。只有全部失败时才停止安装，并说明如何解决。*位置：* Settings ▸ Add-ons ▸ Install。*版本：* 2.997.0
- **✨ Photo：图库只显示最终照片** — 各步骤自己的图片（第 1 步、第 2 步、重试）在照片完成后移出图库；最终照片放入图库和 Image assets。*位置：* Sketcher ▸ ✨ Photo；提示词面板 ▸ ✏ Edit (Sketcher)。*版本：* 2.998.0
- **👤 Make this person 与 ✨ Photo 的角度修正** — References 面板中的 👤 把类型为 person（身体）的参考图和面部特写做成 Sketcher 中的 Genesis 9 角色（拟合参数，或 Shift = 扫描＋包裹），之后 ✨ Photo 不再发送这些图片（头部已带有那张脸）；当相机看到角色面部偏离正面超过 40° 时，也会不发送面部参考图。*位置：* References 面板 ▸ 👤；Sketcher ▸ ✨ Photo。*版本：* 2.999.0
- **🙂 用面部特写做出真正的 3D 头部** — 🙂 Head ▸「用特写做 3D 头部」：3D 引擎把特写变成 3D 形状，放到角色头上，只让头部贴合它（颈部过渡，眼睛/牙齿/舌头不动）——保存为自定义形变，脸部再绘制上去。按 Shift 使用 👤 Make this person 时会用这个。*位置：* 🧭 DAZ Explorer ▸ 📷 Body from a photo ▸ 🙂 Head；References ▸ 👤（Shift）。*版本：* 3.0.0
- **💾 Save song（Edit Booth）与 SoulX / Seed-VC 修复** — 时间线的 💾 Save song 把所有图层（效果、自动化、关键帧、限幅器）混成一首 MP3（320 kb/s）或 WAV（16 位），存入 Sound assets 和图库，并复制一份到下载文件夹；🎤 Sing in my voice 的安装为 Numba 把 NumPy 保持在 2.4 以下，并检查 Seed-VC 自己的 inference.py。*位置：* 🎛 Edit Booth ▸ 时间线 ▸ 💾 Save song；Settings ▸ Add-ons ▸ 🎤 Sing in my voice。*版本：* 3.1.0
- **🆕 New／🧹 Clear（Edit Booth 时间线）** — 🆕 New 开始一首新歌：带四个新图层的空时间线，尚无名称（💾 Save 时命名；旧歌保持已保存的样子）。🧹 Clear 删除所有片段、关键帧、自动化点和标记，但保留图层、速度和名称。两者都会先确认，↶ Undo 一步即可恢复。*位置：* Audio docker 的 🎹 Edit Booth 标签 ▸ 时间线工具栏。*版本：* 3.10.0
- **🤗 Hugging Face downloads（hf_xet）** — 位于 Settings ▸ Add-ons 的第一项：把 hf_xet 装进应用的 Python 和每个附加组件的 Python 环境，让以 Xet 存储的 Hugging Face 模型下载更快、可续传，而不是退回普通 HTTP；之后安装的附加组件会自动带上它。*位置：* Settings ▸ Add-ons ▸ 🤗 Hugging Face downloads。*版本：* 3.3.0
- **🔑 PlatoKeys — 为风格换用更轻的文本编码器** — Basic Settings ▸ Text encoder（图片和视频各一个，首项为 Style's own）列出 ComfyUI 中有 PlatoKeys 密钥可映射到某风格的文本编码器；选中后 MiniMax H3、MOSS-Image、Krea 2、Z-Image 的渲染会加载它（如 Qwen3.5-2B）代替原编码器，由 Patch CLIP (Plato Key) 节点映射 — 更快、更省显存；没有密钥的风格保持原样。Settings ▸ Add-ons ▸ 🔑 PlatoKeys 安装节点、Qwen3.5-2B、公开密钥及 bitGen 更新版 Viggle Remake 节点。*位置：* Basic Settings、Settings ▸ Add-ons。*版本：* 3.4.0

### 激光切割和雕刻

- **激光刀路和 G-code** — Laser 面板：GRBL 或 Marlin 机器设置，每个图层一个操作（Line 切割 / 划线、Fill 填充线、Offset fill、Image 光栅雕刻 - 抖动、阈值或灰度），图片图层按中心线或轮廓描摹，用 ControlNet 预处理器从图片生成线稿，带时间和距离的刀路预览，G-code 保存到项目中。*Where:* Image editor ▸ Window ▸ Laser. *Since:* 2.803.0
- **通过 USB 或 Wi-Fi 发送到激光机** — Laser 面板连接机器（USB 串口或 Wi-Fi / TCP，由 bitGen 的服务器保持，桌面应用中也可）：回原点、解锁、走边框、开始（先确认）、暂停 / 继续、始终可用的 STOP、控制台；为自带激光软件的机器导出 SVG + PNG。*Where:* Image editor ▸ Window ▸ Laser. *Since:* 2.804.0

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
- **从 Blender 图层的场景 Generate + 实时 Blender 图层** — 选中 Blender 图层后 ✨ Generate 会用它的场景、提示词和 References 面板的图片生成图片（编辑模型，或按场景强度使用图片风格）；选中该图层会再次打开场景，选中其他图层则关闭。*Where:* 图像编辑器 ▸ 🟧 Blender 选项卡 + 提示词面板。*Since:* 2.806.0
- **隐藏 / 删除桥接图层时关闭其桥接** — 隐藏或删除 Blender、3D（Daz / Blender）或 Unreal 图层时，会关闭其在图像编辑器和时间线中的场景 / 实时视图（Blender 进程结束，Unreal View 停止，Daz 中等待执行的命令被丢弃）。 *Where:* 图像编辑器的 Layers（👁 / 删除），时间线的图层. *Since:* 2.618.0
- **🟧 图像编辑器的 Blender 菜单** — 新建场景（Blender 创建空场景）、打开、保存、把 .glb / .gltf 模型导入打开的场景，以及最近 5 个场景；每项都在画布上打开场景工具，成为新的 Blender 图层；Blender 图层的设置在属性底部。*Where:* 图像编辑器顶部的 🟧 ▾，文件 ▸ 🟧 新建 / 打开 Blender 场景…。*Since:* 2.851.0
- **🟧 Blender 技能** — ✨ 用 AI 建模：LLM 借助 Blender 技能表编写 Blender 脚本，运行前显示并检查（不读写文件、不联网、不运行程序），在场景副本上无窗口运行，错误由 LLM 修复，预览 + QA，作为 Blender 图层打开；🧰 Blender 工具：LOD、UV 打包、烘焙贴图、游戏引擎导出、卡通风格、时间段、天气、转台、QA（Blender 5.2+，blender-skills MIT） *Since:* 2.855.0

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
- **加载 UE 项目** — 选择一个 Unreal 项目文件夹，bitGen 会放入（或更新）bitGen Bridge 插件，启用所需插件，并以该项目重新启动 Unreal。 *Where:* 菜单栏中的 🎮. *Since:* 2.513.0
- **📺 Unreal 视图** — 所选 Unreal / MetaHuman 图层（图像编辑器）或 Unreal 片段（时间线，位于播放头处）的摄像机画面，实时来自 Unreal；S / M / L、⏸、⚡ 让 Unreal 在 bitGen 后台保持流畅。Unreal 必须保持运行，但无需位于前台。 *Where:* 图像编辑器（有 Unreal 图层时打开）；时间线 UNREAL ▸ View ▸ 📺 Unreal View。 *Since:* 2.590.0 (bitGen Bridge 1.5.0)

## 办公：文档、电子表格、幻灯片和邮件

在同一个工作室里写作、排版、计算、演示和处理邮件，由你自己的 AI 协助。

### 文档和桌面排版

- **页面与文档导出** — 图像编辑器可制作多页文档（A3 - A6、Letter、Legal、Tabloid、卡片、DL、自定义尺寸；纵向 / 横向；72 - 300 dpi），每页都有自己的图层和撤销历史；Pages 列表可添加、复制、移动、重命名和删除页面；Page setup；所有页面及其图层可导出为 PDF（形状为路径，文字为真实文本，每个图层是一个 PDF 图层）、.ai、SVG 页面或用于 .cdr 的包；.bgi 会保存所有页面。*Where:* Image editor ▸ File ▸ New Document with Pages…, Window ▸ Pages, File ▸ Export ▸ Document. *Since:* 2.799.0
- **主页、页码和对页** — 主页的图层（页眉、页脚、标志、背景）显示在每个使用它的页面下方，可分配给所有 / 奇数 / 偶数页；文字中的 {page} / {pages} / {name} 自动生成页码（1、i、I、a、A，可从任意数字开始），# 添加页码；对页以跨页显示并可按跨页导出；主页作为自己的图层导出；.bgi 会保存它们。*Where:* Image editor ▸ Window ▸ Pages. *Since:* 2.800.0
- **链接文本框和文本绕排** — 段落文字从一个框流向另一个框、从一页流向另一页（＋ Frame、＋ Next page、Edit Story、Unlink），在任何框中输入都会进入文章；文字带间距绕排形状（沿轮廓）和图片；作为真实文本逐行导出；.bgi 会保存它们。*Where:* Image editor ▸ Properties ▸ ⛓ Text flow / ☐ Text wrap, Layer ▸ Text Flow. *Since:* 2.801.0
- **印刷就绪 PDF** — 导出时带出血（边缘内容延伸到裁切线之外）、裁切和套准标记、页面信息、TrimBox / BleedBox / MediaBox、CMYK 颜色和图片（铜版纸 / 非涂布纸 / 新闻纸）以及嵌入字体。*Where:* Image editor ▸ File ▸ Export ▸ Document ▸ Print-ready. *Since:* 2.802.0
- **文字处理文本** — 像文字处理软件一样输入的文档框：段落样式（正文、标题、副标题、标题 1-3、引用、代码）、字体、字号、加粗 / 倾斜 / 下划线 / 删除线、下标 / 上标、颜色、突出显示、含两端对齐的对齐方式、行距、段前 / 段后间距、项目符号、编号、缩进；文章以整行在框之间流动；文件 ▸ 新建文本文档… 随文字增加自动添加页面。*Where:* 图像编辑器 ▸ 文档文字工具 (T) / 文件 ▸ 新建文本文档…。*Since:* 2.811.0
- **文档文字中的表格** — 插入表格（行、列、标题行），Tab 在单元格间移动（在最后一格新增一行），插入 / 删除行和列，合并 / 拆分单元格，标题行在每页重复，边框（所有 / 外侧 / 无），单元格底纹，单元格对齐，拖动列宽；长表格以整行延续。*Where:* 图像编辑器 ▸ 文档文字工具 ▸ ▦ Table ▾ / 右键点击单元格。*Since:* 2.812.0
- **每页页码 + 多页视图** — Page Numbers…：格式（Page {page} of {pages} 等）、编号样式与起始页码、位置、字体、字号、颜色 - 放在主页上，因此每一页（包括之后添加的页面）都显示自己的页码；视图 ▸ Pages: One / Two / Many - 页面并排或以网格显示，点击即在原位置来到前面。*Where:* 图像编辑器 ▸ Pages 面板的 # / 视图 ▸ Pages。*Since:* 2.813.0
- **Word 文件 (.docx) 导出与导入** — 文件 ▸ 导出 ▸ Word 文档 (.docx)…：文档文字连同段落样式、字体、粗体 / 斜体 / 下划线、颜色、链接、对齐、间距、列表和表格（列宽、标题行、合并单元格、底纹、边框），页面大小、取自第一个文本框的页边距、主页文字作为页眉 / 页脚（使用 Word 自己的页码域）；文件 ▸ 📂 打开 Word 文档 (.docx)… 把它作为新的文本文档打开。*Where:* 图像编辑器 ▸ 文件。*Since:* 2.814.0
- **文档文字中的批注和脚注** — 为选中词语 💬 新建批注 (Ctrl+Alt+M)，批注列表（作者、时间、词语；编辑、解决、删除），视图 ▸ 显示批注；¹ 脚注 (Ctrl+Alt+F) 按文章顺序编号，画在显示其编号的文本框底部，双击编辑；两者都作为真正的 Word 批注 / 脚注导出，并能导入回来。*Where:* 图像编辑器 ▸ Document Text 工具栏。*Since:* 2.815.0
- **文档文字中的邮件合并** — «» 合并 ▾：📇 数据源…（.csv / .tsv / 粘贴的行），«» 插入合并域…（«Field»，输入时为一个整体），用 ◀ / ▶ 切换记录的预览结果，🖨 完成并合并… - 包含所有记录的一个 Word 文档、每条记录一个 Word 文档（.zip，按模式命名），或 Word 邮件合并文档 + 其 .csv；全部记录或某个范围。*Where:* 图像编辑器 ▸ Document Text 工具栏。*Since:* 2.816.0
- **🖼 AI 的图放在正文中、电子表格作为数据** — ✨ 用 AI 撰写 会把每个图表 / 图片放在讨论它的段落之后，其图层跟随正文进入下一个框架或下一页，并在新宽度下清晰重绘；选中 WP 图层时给出的 .xlsx / .csv 就是数据（工作表以单元格行的形式）；Word 导出会把图作为图片带上。*Where:* 图像编辑器 + 提示词停靠栏。*Since:* 2.838.0
- **🖼 在正文中移动图、图放在正文旁边** — 用移动工具拖动文档中的图会移动它在正文中的位置（一步撤销）；◧ / ◨ 把它放在正文旁边并让正文围绕，＋ / － 调整宽度，▭ 恢复整栏宽；说明文字始终在图下方。*Where:* 图像编辑器。*Since:* 2.839.0
- **🖼 打开 Word 文件时带上图片；WP 框架的边缘就是页边距** — 打开的 .docx 中的图片作为正文中对应位置的图带入（替代文字 = 说明）；拖动 WP 框架的边缘会改变整篇文章该侧的页边距（显示毫米，一步撤销）；图层 ▸ 📏 WP 页边距… 以毫米输入。*Where:* 图像编辑器。*Since:* 2.840.0
- **▦ 可选择、删除、调整大小和设置样式的表格** — ⊞ 选择整个表格；Del 删除（Ctrl+Z 恢复），◢ 调整大小，🎨 表格样式设置宽度、对齐、边框、内边距、颜色和条纹行；每行每列都可拖动边缘调整大小。*Where:* 图像编辑器中的 WP 图层。*Since:* 2.847.0
- **✨ 用 AI 创建** — LLM 按你的描述撰写文档、故事、传单、三折宣传册、名片、网站或发票，bitGen 在真实页面（A4、A4 横向、90 × 55 mm、网页）上排版成可编辑的图层，需要时还用你的图像风格生成图片；绝不编造你的名称、价格和联系方式。*Where:* 文件 ▸ ✨ 用 AI 创建…、工具栏的 ✨、提示词停靠窗。*Since:* 2.849.0
- **对齐选中的表格** — 用 ⊞ 选中的表格可在框内左 / 居中 / 右对齐：框上的 ⯇ ↔ ⯈、Ctrl+L / E / R 或对齐按钮。*Where:* 图像编辑器的 WP 图层。*Since:* 2.851.0

### 电子表格

- **▦ 电子表格** — 由多张工作表组成的工作簿，公式在输入时重新计算（SUM、IF、VLOOKUP、XLOOKUP、SUMIFS、日期、文本——约 50 个函数），单击单元格即可把地址放进公式，填充柄复制公式并延续序列，复制 / 粘贴（也可粘贴其他程序的表格），插入 / 删除行和列时公式随之调整，数字格式，粗体 / 颜色 / 边框 / 合并，排序、筛选、冻结、自动求和、工作表之间的引用、撤销；以 .bgs 文件保存在项目中。*Where:* 顶部栏的 ▦。*Since:* 2.822.0
- **▤ 设置单元格格式（电子表格）** — Ctrl+1 / ▤ 格式… / 右键：数字（常规、数值、货币、会计专用、日期、时间、百分比、分数、科学记数、文本、特殊、自定义——带分节、颜色、条件、累计时间的真正数字格式代码）、对齐（缩进、跨列居中、分散对齐、自动换行、缩小字体填充、合并、文字方向、方向刻度盘 / 竖排）、字体、边框（13 种线条、预置、对角线、可点击的预览）、填充（调色板、双色渐变、17 种图案）、保护（锁定 / 隐藏 + 保护工作表）；只应用更改的项目。*Where:* ▦ 电子表格。*Since:* 2.823.0
- **✨ 电子表格仪表板、Excel 文件、图表** — ⤒ 导入 / ⤓ 导出 .xlsx（值、公式、数字格式、外观、合并、列宽、冻结窗格）和 CSV；📊 图表（柱形、条形、折线、面积、饼图、圆环、散点）可拖动、调整大小并随工作簿保存；✨ 仪表板：LLM 读取列（不是行）并规划关键数字、带图表的细分和趋势——bitGen 用实时公式搭建，并把数据格式化为表格（没有 LLM 时根据数据本身的形态）。*Where:* ▦ 电子表格。*Since:* 2.824.0
- **✨ 电子表格单元格中的 AI** — ✍ 根据文字编写公式（填入前先计算，可向下填充）、💡 解释公式（当前读取的内容 + 通俗说明）、🪄 按示例填充（Ctrl+E：由 bitGen 自己找规则——词、符号之间的部分、大小写、首字母缩写——否则用 LLM 的公式，且必须能得出每个示例，再不行则由 LLM 填值并注明是推测）；新增 33 个函数（PROPER、TEXTJOIN、MAXIFS、SUMPRODUCT、EOMONTH、SWITCH …）。LLM 看到的是列，不是行。*Where:* ▦ 电子表格 ▸ ✨ AI ▾。*Since:* 2.825.0
- **📌 电子表格常量——重复出现的金额** — 房租、工资、贷款：名称、金额、每天 / 周 / 两周 / 月 / 季度 / 年、开始日期、收入或支出、结束；从某天起的新金额不影响之前日期的原金额；⟳ 更新到最新 先显示再按日期顺序把每笔应记录写入账本（余额、防止重复记录的 Ref、往前追加的金额勾选后更正），一步撤销；公式中可用 =Rent / CONST("Rent", 日期)。*Where:* ▦ 电子表格 ▸ 📌 常量。*Since:* 2.826.0
- **📌 Paid to——常量的付款够付到哪一天** — 房租付到哪一天：账本中的付款从开始日期起逐日抵扣（一天 = 每周 ÷ 7）；常量列表显示已付到的日期、落后 / 提前的天数和欠款；账本的 Paid to 列显示每笔付款后的日期（实时 =PAIDTO()）；常量也可以由你自己记入付款（租客每次不同的付款）。*Where:* ▦ 电子表格 ▸ 📌 常量。*Since:* 2.827.0
- **▦ 从提示词停靠窗操作电子表格** — 用 ＋ 附加 Excel / CSV 文件即在电子表格中打开；说“create a dashboard”“format it”“received a payment of 540 for rent”“paid 80 for power yesterday”（received = 收入，paid = 支出——先显示该行，再 ✔ 添加 按日期顺序记入账本）、“rent went up to 580 from 12/01/2027”“bring the ledger up to date”“explain this formula”…；普通聊天照常是聊天。*Where:* 提示词停靠窗 + ▦ 电子表格。*Since:* 2.828.0

### 幻灯片

- **🎞 幻灯片** — 自己的演示文稿：幻灯片列表（拖动重新排序）、7 种版式、6 种主题、带项目符号的文本框、形状、图片（拖放 / 粘贴）、吸附参考线、演讲者备注、切换效果；▶ 全屏放映（F5）；保存在项目中（.bgk），也可存为 PowerPoint（.pptx）。*Where:* 顶部栏的 🎞。*Since:* 2.831.0
- **🎞 幻灯片：演讲者视图、打开 PowerPoint、导出 PDF** — 🎤 观众窗口显示幻灯片时，你的屏幕上有幻灯片、下一张、备注和计时器；⤒ 打开 .pptx 文件（文字、形状、图片、组合、备注、切换效果、版式位置）；⤓ PDF（幻灯片，或幻灯片 + 备注）；旋转控点；来自图库 / 素材的图片。*Where:* 🎞 幻灯片。*Since:* 2.832.0
- **🎞 AI 制作幻灯片** — ✨ 根据主题或文字 / 大纲 / 文件制作幻灯片（提示词停靠栏的 LLM 规划，带演讲者备注），图片框用提示词停靠栏的图像风格生成图片，重写 / 缩短 / 修正幻灯片，根据幻灯片写演讲者备注；在提示词停靠栏中说“make slides about …”。*Where:* 🎞 幻灯片 ▸ ✨ AI ▾、提示词停靠栏。*Since:* 2.833.0
- **🎞 幻灯片：表格、图表、品牌主题** — ▦ 表格和 📊 图表（柱形、条形、折线、面积、饼图、圆环图），编辑器可粘贴电子表格单元格，与 PowerPoint 互通真正的表格 / 图表并绘入 PDF；🎨 用你的颜色和字体或标志生成品牌主题，为所有项目保存。*Where:* 🎞 幻灯片。*Since:* 2.835.0

### 邮件

- **用你自己的 AI 处理邮件** — 通过 IMAP / SMTP 连接你自己的邮箱（无需注册；密码加密保存在本机）：文件夹、列表、阅读窗格（不运行脚本，互联网图片按需显示）、附件；LLM 给每封邮件标记紧急 / 重要 / 普通 / 低并说明理由（新邮件 ✨ 自动标记，“对我重要的事”），总结邮件，起草回复；写信窗口的 ✨ 帮我写 和 ✨ 改写；发送、草稿、带附件转发。*Where:* 顶栏上的 ✉。*Since:* 2.818.0
- **✉ 邮件：保存的账户、多封邮件、搜索、文件夹** — 登录成功的 ✓ 测试会保存账户（关闭对话框也会保存更改）；Ctrl / Shift+点击选取多封邮件，一次执行 🗑 ★ ● 和 📁 移动 ▾；把邮件拖到文件夹上；在 🔍 中按 Enter 在服务器上搜索整个文件夹（from: / to: / subject: / body:）；⤓ 更早的邮件；＋ 新建文件夹；收件人 / 抄送 / 密送提示你邮件里的联系人。 *Where:* 顶栏的 ✉。 *Since:* 2.820.0

## 网站

在图像编辑器中设计页面，或让 AI 建立整个网站，然后编辑它、加上商店和预约，再发布上线。

### 建立网站

- **🌐 用你的页面建网站** — 图像编辑器文档的每一页都成为一个网页；文件 ▸ 🌐 建网站… 生成静态网站或 PHP + MySQL 网站，由 AI 用你原样的文字和图片编写每页自适应的 HTML / CSS（经过检查；否则用 bitGen 自己的排版）；PHP + MySQL 带公共页眉 / 页脚、保存到 MySQL 的联系表单、schema.sql；预览和 .zip。*Where:* 图像编辑器。*Since:* 2.843.0
- **🌐 帮我建网站** — 一句话（“帮我的面包店建个网站……”），LLM 规划页面、文字、颜色、商店商品和预约服务；bitGen 把每个页面排版成可编辑的图层（首屏、带照片的部分、联系方式、预约日历），用你的图像风格生成图片并建网站——带商店、预约、联系表单和管理区的 PHP + MySQL，或普通 HTML；商品进入商店数据库。*Where:* 图像编辑器，文件 ▸ 🌐 帮我建网站…、网页视图的 ✨、提示词停靠窗。*Since:* 2.852.0
- **🎬 主视觉视频和 🛒 商品图片** — 帮我建网站可加入 5 秒首屏视频（你的视频风格，从首屏照片生成；在网站上静音循环播放），🛒 商品图片 用编辑模型（优先 Qwen Image Edit）、图像编辑器或文件修改商店每个商品的图片，然后重新生成网站 *Since:* 2.853.0
- **⤴ 将网站发布到 GitHub** — 把最近一次生成的网站发送到 GitHub 仓库（不存在时创建为私有；只发送有变化的文件，每次发布一个提交），令牌加密保存，inc/config.php 和 README.txt 永不发送；主机用 Plesk ▸ Git 或可选的 FTP 工作流部署 *Since:* 2.854.0
- **🌐 生成到 www + ⤴ 发布 www** — 建网站可把生成的网站放入项目的 www 文件夹（你的文件和 inc/config.php 会保留），网页编辑器把 www 发布到 GitHub（只发送有变化的文件，绝不发送 inc/config.php） *Since:* 2.858.0
- **📤 把网站发送到你的主机** — 通过 FTP / FTPS 把 www 文件夹直接发送到 cPanel（GoDaddy 等）或 Plesk：✓ 测试、只发送改动的文件、删除的文件会被移除、inc/config.php 只在主机上没有时发送（± 数据库密码，只写入主机）、密码加密保存；cPanel 上网站的数据库以 localhost 连接 *Since:* 2.860.0

### 网页编辑器

- **🌐 网页编辑器** — 项目 www 文件夹的停靠窗（项目 ▸ 新建 ▸ ☑ 网站 会连同网站各文件夹和初始页面一起创建）：🗂 CRM（页面、文章、商品 + 客户、预约、订单、留言）、✎ 所见即所得、</> 代码和 👁 预览标签页，右侧可折叠的文件面板 *Since:* 2.856.0
- **🧩 网页技能** — 图片 / 视频 / 音频 / 3D 画廊、主题、布局、AJAX、带分类的商品目录、商品页、购物车 + 结账（在服务器上计价，保存到 CRM 的数据库）和会员登录（密码哈希、CSRF、输错后等待）——＋ 连同文件添加到打开的页面，或 ✨ 由 AI 用它们编写一部分 *Since:* 2.859.0
- **📅 📰 📍 更多网页技能** — 基于 CRM 预约日历的预约组件（空闲时间在服务器上再次检查，进入 📅 预约）、来自 CRM 📰 文章的博客 / 新闻页、带 OpenStreetMap 地图的联系方式和进入 ✉ 留言的联系表单 *Since:* 2.861.0
- **🌏 网页技能卡片也用你的语言** — 🧩 技能 卡片的名称、说明、分组和提示跟随语言下拉菜单（日本語 / 简体中文 / 繁體中文） *Since:* 2.862.0
- **</> 网页构建器的代码编辑器** — 行号、着色的标签 / CSS / JS / PHP、标出并列出未闭合的标签（点击即跳到那里）、快速标签和快速注释的左侧工具栏、Ctrl+/ 注释行 *Since:* 2.864.0
- **✨ 用 AI 编辑网站** — 网页编辑器里的提示面板：输入或 🎙 说出要改什么，LLM 把打开的页面（或仅所选部分）作为一次修改来改，可 ↶ 撤销 *Since:* 2.865.0
- **◧ WYSIWYG 区块 + 📱 手机 / 平板** — WYSIWYG 标签页的图标工具栏（画廊 ▸ 图片 / 视频 / 音频 / 3D、日历、预约表、商品图片、分类 ▸、首屏、页眉、页脚）、📱 让页面适合手机和平板、🖥 ▭ 📱 宽度、顶部栏的 ⇡ 自动隐藏 *Since:* 2.866.0
- **🎛 元素属性** — 在 WYSIWYG 页面上选中任何东西并设置样式：尺寸、间距、每个角的半径（或四个一起）、边框、背景颜色 / 图片 / 线性或径向渐变、阴影 + 文字阴影、不透明度、文字 *Since:* 2.867.0

### 商店、预约和网站数据库

- **🗄 由 AI 设计的数据库（MySQL / MariaDB）** — 用于此项目、所有项目（bitGen 自己的 MariaDB，通过下载 / 取消框只下载一次，仅 127.0.0.1）或你自己服务器上的数据库；✨ 设计：LLM 以 SQL 编写表、字段、键、关联、索引和视图，先阅读再 ▶ 运行（绝不删除数据）；表 / 视图、其行、SQL 框；在提示词停靠栏说“为……创建一个数据库”。*Where:* 顶部栏的 🗄 停靠栏。*Since:* 2.842.0
- **📅 网站预约日历** — 把 📅 日历拖到网页上，它的数据表会立即在项目的 MariaDB 中创建。设置包括每次预约的时长、每个时段人数、可提前天数、提前通知、带休息的营业时间和时区，每种对象都可单独设置样式（月份名称、星期、日期、今天、可预约 / 约满 / 过去的日期、时段、预约按钮）。PHP + MySQL 网站让访客查看空闲时段并预约（有防伪造提交的检查，绝不重复预约）；📅 预约列表显示访客的预约。*Where:* 图像编辑器的网页视图 + 🌐 建网站。*Since:* 2.846.0
- **📅 任何页面都能放日历，预约功能完整** — 任何页面上的打印月历，或带服务项目、缓冲时间、每天上限、确认、休息日、电子邮件，以及每次预约可查看、加入日历（.ics）或取消的链接的网站预约日历。*Where:* 图像编辑器（WP 插入、网页视图、工具栏）+ 🌐 建网站。*Since:* 2.847.0
- **🔐 网站管理后台和 myadmin 数据库** — 有预约日历（或勾选了）的 PHP 网站都会有 /admin/：用设置密钥创建所有者，登录（所有者 / 管理员 / 员工）密码错 5 次锁定，登录记录和审计日志；确认 / 取消 / 电话添加预约，工作室再次上传时保留休息日和营业时间；为兽医 / 牙科 / 诊所准备的客户、宠物和病历，员工，以及完整的商店（商品、规格、库存、分类、订单、付款、发票、优惠券、配送、评价、电子报）——没有数据库 myadmin 时自动创建（给主机用的 admin-schema.sql）。*Where:* 🌐 建网站、📅 日历设置 ▸ 数据库。*Since:* 2.848.0
- **🛒 网站商店** — PHP + MySQL 网站会有商品目录（分类、搜索）、商品页（选项、库存）、购物车（优惠码、满额免运费、含税或另加税）、结账（银行转账 / 取货时付款）和每个订单的专用页面；下单时一次完成扣减库存、添加客户并给买家和商店发邮件。*Where:* 图像编辑器，文件 ▸ 🌐 建网站… ▸ 🛒 商店；商品和订单在 /admin/。*Since:* 2.850.0
- **🗄 网站的实时数据库** — 网页编辑器的 CRM 创建网站的数据库（在这台电脑或你的主机上），包含管理、商店、预约和联系表单的表，导入项目的记录并链接到它：客户、预约、订单和留言实时读写；inc/config.php 让网站指向它（绝不写入密码） *Since:* 2.857.0
- **💳 商店结账可刷卡支付** — Stripe Checkout：买家在 Stripe 自己的页面上付款，只有当 Stripe 就该订单和金额确认已付款时（返回时和经签名的 Webhook），订单才标为已付款，CRM 中记一笔付款；密钥在应用中加密保存，只写入主机的 inc/config.php *Since:* 2.863.0
- **🗄 网页构建器的数据库管理** — 在标签页中管理网站的数据库：表 + 视图、每次 50 行、双击修改单元格、＋ 行、🗑、⌨ SQL（危险语句先询问）、⤓ CSV / SQL / 整个数据库、⤒ .sql *Since:* 2.868.0

## 商务和会计

用你的企业信息制作名片、信笺和印刷拼版，以及按传统会计风格记账。会计功能是新加入的，尚未经过测试：在依赖任何数字或进行申报之前，请先与你的会计师核对每一个数字。

### 企业信息、名片和印刷

- **🧾 模板：发票、报价单、收据** — 文件 ▸ 🧾 从模板新建…（内置的发票 / 报价单 / 收据或你自己的）和 🧾 填写框：字段、明细、✨ 让 AI 填写；金额、税额和总计由 bitGen 计算，并按模板编号；也可在提示词停靠栏说出来；含 {{fields}} 和 {{item.*}} 行的任意文档用 文件 ▸ 💾 另存为模板… 保存。*Where:* 图像编辑器 + 提示词停靠栏。*Since:* 2.841.0
- **💳 用于名片、信笺、传单和海报的业务信息** — 图像编辑器的 ✨ Create 会询问公司、名字、职位、电话、邮箱、网站、地址、服务、标志、品牌颜色以及正面 / 背面的要求，并保存（business/profiles.json）、原样使用；新增 ✉ Letterhead（A4，带写信用的 WP 框）和 🪧 Poster（A3）；标志会放入。每个对话框右上角都有 ✕；选中图形或文字会显示 Properties。 *Where:* 图像编辑器 ▸ ✨ Create With the AI。 *Since:* 2.875.0
- **💳 名片尺寸——卡纸或 PVC** — 名片的业务信息对话框有 Card size ▾：按国家分的卡纸 / 纸（澳大利亚 90 × 55 mm、美国 3.5 × 2 英寸、英国 / 欧洲 85 × 55、日本 91 × 55、中国 90 × 54、东欧 90 × 50、方形、迷你），或带圆角的 PVC CR80 / CR79 / CR90 / CR100；名片按该尺寸（300 dpi）制作，尺寸与信息一起保存。 *Where:* 图像编辑器 ▸ ✨ Create With the AI ▸ 💳 Business card。 *Since:* 2.876.0
- **📇 名片排版页** — 打开的名片在 A4 或 US Letter 上排满（A4 上 10 张 90 × 55 mm），居中，页边有裁切标记，背面在第 2 页并镜像以便双面打印，可选间隙和出血；生成 PDF 保存到项目并下载，按实际尺寸打印。 *Where:* 图像编辑器 ▸ File ▸ 📇 Business Card Sheet…。 *Since:* 2.884.0
- **🖼 由你的文字生成名片背景** — 名片正面和背面的描述成为两个背景的提示词（提示词面板的图像风格，只有背景图案——文字和标志作为图层放在其上；PVC 卡保留圆角；☐ Backgrounds = 纯色）；企业信息框更宽，所有输入框都在框内。 *Where:* 图像编辑器 ▸ ✨ Create ▸ 💳 Business card。 *Since:* 2.893.0
- **📇 更多名片打印方式** — 文件 ▸ 📇 名片拼版… 可选版式：🖨 家用打印机拼版（A4 / Letter；出血取自卡片自身边缘）、🏷 你的标签 / 带齿孔的卡纸（输入尺寸并按名称保存 - 不使用厂商模板；尺寸不同的卡片会缩放放入）、🏭 印刷厂拼版（SRA3、SRA4、A3、12 × 18、13 × 19 英寸、小报或自定义；每张卡片都有出血、套准色裁切线、套准标记、作业信息行）或 ✂ 每页一张（设置成品框和出血框）；📋 列表每行一张（团队成员的名字 - 每一列替换卡片上的文字，根据企业信息或该行的样子推测；可设份数）；多页文档的每一页可作为不同的卡片。*Where:* 图像编辑器 ▸ 文件 ▸ 📇 名片拼版…。*Since:* 2.896.0
- **💳 企业信息保存在 MariaDB 中** — 企业信息对话框的 🗄 保存位置…：这台电脑（一个文件）、bitGen 自己的 MariaDB，或你的数据库服务器（在你的电脑之间共享）；✔ 保存到那里 会创建数据库及其表（含标志本身的企业信息，服务和颜色每项一行）并发送这台电脑上的信息；保存和删除会立即发送，⟳ 同步 获取其他电脑的更改（较新的副本优先）；数据库没有响应时更改在这台电脑上等待，稍后发送；会计、发票和名片读取这台电脑上的副本。*Where:* 图像编辑器 ▸ ✨ 创建 ▸ 💳 / ✉ / 📰 / 🪧 ▸ 🗄 保存位置…。*Since:* 2.897.0

### 📒 会计（未测试）

- **📒 Accounts——账簿** — 新的停靠窗，采用老式会计账页风格：收据、待付账单和已开发票（附图片 / PDF，GST 自动计算，部分付款），普通日记账分录，五种日记账，分类账，试算表，损益表，资产负债表，BAS GST 工作表（收付实现制或权责发生制），项目，待收 / 待付和逾期，澳大利亚会计科目表；每个企业一套账簿。 *Where:* 顶栏的 📒。 *Since:* 2.877.0
- **✍ Accounts 中的发票和报价单** — 编写报价单和发票（客户、地址、邮箱、ABN；每行数量 × 单价），报价单状态和有效期、转为发票，🖨 打印或另存为 PDF 的符合 ATO 要求的税务发票（你的 ABN、每行 GST、免 GST 的行、$1,000 或以上的买方），付款方式；业务信息中的 ABN 校验。 *Where:* 📒 Accounts ▸ ＋ 📝 Quote / ＋ 📤 Invoice we sent。 *Since:* 2.878.0
- **🧾 用图像编辑器制作的发票和报价单版式** — 图像编辑器的 File ▸ 🧾 Insert Field… 把字段（你的企业、客户、单据、合计——包括应付总额——和明细表）作为文字图层放到页面上，拖到该放的位置；保存为发票或报价单模板，在 Accounts 的 Invoice / Quote layout ▾ 中选择，🖨 用该单据的数字填好它。📒 Accounts 默认关闭——在 Settings ▸ Dockers 中打开。 *Where:* 图像编辑器 ▸ File ▸ 🧾 Insert Field…；📒 Accounts ▸ Accounts。 *Since:* 2.879.0
- **✨ AI 读取收据、CSV、打印 BAS** — 📒 Accounts 中的 ＋ ✨ Read a receipt…（照片、扫描件或 PDF）：你的视觉模型读取供应商、ABN、日期、明细、合计和 GST，bitGen 核对（日期、合计、GST 约 1/11、ABN、科目），填好对话框供你核对并保存；每个列表和报表的 ⤓ CSV；BAS 工作表 🖨 打印 / PDF。 *Where:* 📒 Accounts。 *Since:* 2.880.0
- **✉ 邮寄发票和 ⤺ 贷项通知单** — 发票 / 报价单 / 贷项通知单的 ⤓ PDF 文件（bitGen 生成），✉ 在 ✉ Mail 中打开附有 PDF、客户邮箱、主题和正文的邮件，发送后标记 ✉✓；⤺ 为发票开具贷项通知单（GST 登记时为 Adjustment Note），应用到发票或单独退款，账簿和 BAS 中作为减少调整。 *Where:* 📒 Accounts ▸ Documents。 *Since:* 2.881.0
- **🏦 银行对账单与对账** — 导入网上银行的对账单（澳大利亚银行的 CSV、OFX / QFX、QIF，或粘贴），与账簿匹配（自动匹配唯一的相同金额，建议未结发票 / 账单和以前用过的账户），✚ 从一行创建付款、支出、销售或转账，⚖ 用期末余额检查并 ✔ 对账。 *Where:* 📒 Accounts ▸ 🏦 Bank。 *Since:* 2.882.0
- **🧾 税务设置与 👷 工资发放** — 组织形式、BAS 频率、GST、PAYG 预扣（工资账户、12 % 养老金）和 PAYG 分期预缴（T7 金额或 T2 比率）；工资发放生成日记账（税前、预扣税、实发、养老金）；BAS 显示 W1 / W2 / 4、T1 / T11 / T7 / 5A 和 8A / 8B / 9。不保存税号。 *Where:* 📒 Accounts ▸ 🧾 Taxes / ＋ 👷 Pay run。 *Since:* 2.883.0
- **💵 向 ATO 付款和支付养老金** — 💵 向 ATO 付款…用一条分录把一个 BAS 期间记入账簿（1A 从 GST Collected 扣除，1B 从 GST Paid 扣除，代扣的 PAYG、分期缴纳、舍去的分，标签 9 记入 ATO 账户），并记录你付了多少 - 现在、以后或分次 - 或退税；从不记两次，也从不算作 GST 调整；💵 支付养老金…按人支付工资发放所欠的养老金；🏦 银行标签会把两者与对账单匹配。 *Where:* 会计 ▸ 💵 向 ATO 付款… / 💵 支付养老金…；BAS 标签。 *Since:* 2.889.0
- **🏦 银行附加功能：拆分、转账、规则** — ✚ Make… ▸ Split over several accounts 把对账单上的一行记为每部分一行的收据或销售（每行各自的 GST，显示还需拆分的金额），勾选后则为无 GST 的日记账，并按比例记住供下一行使用；你自己两个账户之间的转账会根据另一份对账单给出建议（↔），只创建一次并在两份对账单上都匹配——另一份对账单稍后导入时也会匹配；⚙ Rules… 列出记住的文字 → 账户 / 税码 / 拆分及待处理的行，✎ 更改（缩短为“officeworks”即可识别所有门店），🗑 删除。 *Where:* 📒 Accounts ▸ 🏦 Bank。 *Since:* 2.892.0
- **👷 每人的年度付款汇总** — 按人汇总一个财政年度（7 月 1 日至 6 月 30 日）的发薪记录：发薪次数、首次和最后一次、税前工资、预扣税、实发、养老金、合计；任何有发薪记录的年度；🖨 每人一页（或全部，先给年度合计）可打印或存为 PDF，⤓ CSV——账簿记录，不是申报（Single Touch Payroll）。 *Where:* 📒 Accounts ▸ 👷 Pay summary…。 *Since:* 2.893.0

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
- **MP4 · 社交媒体导出** — 生成 Facebook、Instagram 和 TikTok 可直接接受的文件：H.264 High 8-bit、AAC 48 kHz 立体声、恒定帧率、faststart、短边最大 1080、无时间码轨道；编码后进行检查（逐项显示是否合格，9:16 视频超过 90 s 时另有提示）。社交媒体套装可一次生成 9:16 Reels、4:5 信息流、1:1 和 16:9。 *Where:* 时间线的 📤 Export. *Since:* 2.597.0
- **Basic Settings 的 Format 中的 📱 社交媒体选项** — Reels / Stories 9:16、Facebook 信息流 4:5、Square 1:1、Landscape 16:9 或渲染本身的比例：Aspect 随之改变，完成的 MP4 在进入图库之前会处理成适合 Facebook / Instagram / TikTok 的格式（使用 Export 预设的设置并经过检查）。 *Where:* Basic Settings > Format（以及音乐视频的 Format）. *Since:* 2.600.0

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
