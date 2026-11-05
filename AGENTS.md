# 项目协作约定

## 任务入口与完成标准

- 首次运行、安装、创建视频、渲染或交付产物：先读 [`docs/Agent操作流程.md`](docs/Agent操作流程.md)，按任务分支检查依赖、数据、预览与产物。
- 环境配置、手工 / 自动配音、画卷展示或排错：读 [`docs/使用流程.md`](docs/使用流程.md)；无 API 基线数据为 `examples/questions-261105-1.json`。
- 代码修改后执行 `npm test` 和 `npx tsc --noEmit`；影响画面时再验证对应画面。视频任务以实际文件和视听验收完成，不以执行命令代替交付。
- 同一工作区顺序执行渲染；每期使用独立输出名。凭据、浏览器登录态、模型缓存和生成产物保留在本地忽略目录。
- 第三方素材的授权边界见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。外部 API 调用和平台操作以用户当前授权为准。

## 语言

- 面向用户的说明、进度更新和最终答复统一使用中文。
- 项目内新增或修改的设计文档、实施计划和使用说明统一使用中文。
- 代码标识符、命令、文件路径、第三方 API 名称及必须保持原文的技术术语可以使用英文。

## 文件命名规范

### 数据文件
- **题库**：`questions-YYMMDD-序号.json`
  - 例如：`questions-261009-1.json`；日期使用创作当天的年月日，年份用两位数。
- **对话**：`dialogue-主题-序号.json`
  - 例如：`dialogue-zhangye-01.json`

### 脚本文件
- **位置**：按功能放入子目录（`quiz/`、`dialogue/`、`utils/`）
- **命名**：动词开头（`gen-`、`transcribe-`、`compose-`、`analyze-`）

### 输出文件
- **成片**：`{系列}-第{期数}期.mp4`
- **封面**：`{系列}-第{期数}期-封面.png`

## 工具脚本说明

### Agent Skill 入口
- 当前项目自动发现的 Skill 只保留 `.agents/skills/` 下的目录；不要引用或推断已移除的历史 Skill。
- 抖音对标视频分析、抓取和转写：`.agents/skills/douyin-competitor-video/SKILL.md`
- 口播文案拆解与改写：`.agents/skills/script-rewriter/SKILL.md`
- Hypit 视频创作与生产：`.agents/skills/hypit/SKILL.md`；优先用于 `work/hypit-yifu/` 旁白主导的成语、神兽、盘点类产线。
- 其他视频类型继续按各自现有产线执行；题目问答视频使用 Remotion 项目配置和脚本，不要因 Hypit Skill 已安装就自动迁移。
- 视频具体生产入口以 `package.json`、`src/Root.tsx` 和对应脚本的实际参数为准；README 只作导航。

### 通用工具（scripts/utils/）
- `transcribe-ref.py` - 提取视频文案（FunASR）
- `gen-minimax-image.py` - MiniMax 生图
- `gen-image-openlux.py` - OpenLux 生图
- `burn-subtitles.py` - 字幕渲染工具
- `assemble-nine-sons.py` - 龙生九子视频合成
- `gen-h3-video.py` - H3 视频生成

### 分类工具
- **scripts/quiz/** - 题目类脚本
- **scripts/dialogue/** - 对话类脚本
- **scripts/analytics/** - 数据分析脚本
- **scripts/story/** - 故事类脚本
- **scripts/publish/** - 发布脚本

## 题目查重与分级复用（2026-09-10 修订）

- 创作任何题目（选择题 / 填空题 / 诗词填字）之前，先查看 [`docs/题库记录.md`](docs/题库记录.md) 逐词查重——查重的目的不是「出过的永不再出」，而是**知道已用过什么角度，才能做出有增量的新角度**。重复分三级：
  - **A 级（禁止）**：与已登记题目一模一样（同题干同答案同钩子）——无增量且易被判重。
  - **B 级（允许，须改稿）**：同一知识点的**新角度复用**，必须同时满足四条：①有依据（自己历史数据好，或对标账号验证过该母题/结构，依据写进 [`docs/题库记录.md`](docs/题库记录.md) 的本期记录）；②实质改稿（至少一条：换角度如来历→人物→易错点、换题型、换深度、换钩子）；③与上一条同知识点发布间隔 ≥2~4 周；④照常过读音审校与合规审核。
  - **C 级（自由）**：全新知识点，照常流程。
- 借鉴对标账号内容时：选题、知识点、结构可以完全复用；**逐句文案必须重写**（版权 + 原创 + 平台风控），不得照搬原文。
- 每次新创作的题目，在生成题库 JSON 后，把题目（题型、题干、答案/雅称、主题及「勿重复出」的相关别称）追加到 [`docs/题库记录.md`](docs/题库记录.md) 对应主题段落，保持记录与题库同步；B 级复用题目在本期记录中标注「改稿自第 X 期 + 依据」。
- 不确定是否与已有题目重复时，先查 `src/data/` 下所有题库文件的题干与答案，再对照 `docs/题库记录.md` 判断；仍不确定就向用户确认。


