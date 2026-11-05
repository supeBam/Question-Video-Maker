# Question Video Maker

面向 Agent 工作流的中文短视频生产项目：用 JSON 描述题目或内容，用 Remotion 生成竖屏视频、封面和发布文案。支持选择题、填空题、画卷展示，以及可选的 MiniMax 配音和独立故事/对话脚本。

第一次使用从下面的**无 API 示例**开始。它使用仓库自带的简单 SVG 背景，关闭配音、BGM 和音效，无需历史素材或任何模型账号。

## 快速开始

准备 Node.js **22.18+**（建议 24+）、npm 和可运行 Chromium 的桌面或 Linux 环境。首次渲染可能需要下载 Remotion 的浏览器；Linux 还需相应系统依赖和中文字体。

```bash
git clone https://github.com/supeBam/Question-Video-Maker.git
cd Question-Video-Maker
npm ci
npm run dev:data -- --data=examples/questions-261105-1.json
```

Studio 中选择 `BurstQuiz`。先确认中文显示和两道题的答案，再停止预览服务，运行：

```bash
npm run demo:render
```

默认输出 1080×1920、30 fps 的 H.264 MP4，以及同名 PNG 封面、SRT 字幕和 TXT 发布文案：

```text
out/入门示例-第01期.mp4
out/入门示例-第01期.png
out/入门示例-第01期.srt
out/入门示例-第01期.txt
```

这是**无口播示例**，音频关闭是有意配置。完整步骤与产物验收见 [使用流程](docs/使用流程.md)。

## 交给 Agent 使用

让 Agent 在仓库根目录读取 [AGENTS.md](AGENTS.md)，再按 [Agent 操作流程](docs/Agent操作流程.md) 执行。可直接复制：

> 请先读 AGENTS.md 和 docs/Agent操作流程.md。用 examples/questions-261105-1.json 跑通无需 API 的答题视频，先验证数据和测试，再预览、渲染视频与封面。检查两种题型、答案揭晓和字幕，汇报实际产物路径。保持外部 API 关闭，不操作发布平台。

创作新一期：

> 制作一期三道题的中文文学常识选择题视频。先查 docs/题库记录.md 与 src/data/ 中的历史题目，给每题保留事实来源；沿用 examples/questions-261105-1.json 的结构，按当天日期生成新题库并登记记录。使用 BurstQuiz，先走无 API 的手工配音模式。完成后检查画面、字幕和答案，不自动发布。

配音、画卷展示、参考文案改写等例子见 [Agent 操作流程](docs/Agent操作流程.md#可复制的任务示例)。

## 选择流程

| 目标 | 入口 | 额外依赖 |
|---|---|---|
| 选择题 / 填空题 | `BurstQuiz`，`render:manual` | 无模型 API；可后期手工配音 |
| 题库自动配音成片 | `BurstQuiz`，`render:auto` | Python、requests、ffmpeg/ffprobe、MiniMax 密钥及额度 |
| 画卷展示 | `ScrollShow`，`items[]` 数据 | 每条内容必须有对应音频；推荐自动 TTS |
| 故事 / 对话 | `scripts/story/`、`scripts/dialogue/` | 按具体脚本准备素材和依赖，部分依赖本地工程 |
| 文案分析与改写 | `.agents/skills/script-rewriter/` | 视频输入另需 ASR |
| Hypit 工作流 | `.agents/skills/hypit/` | 另装 Hypit 环境；`work/` 工程不随仓库提供 |

`ScrollShow` 与题库的 JSON 结构不同，不能仅切换 composition 就混用。独立故事/对话脚本包含项目实验，不承诺在全新机器上直接一键执行。

## 项目结构

```text
AGENTS.md                 Agent 常驻约定与入口
examples/                 无 API 入门数据
src/Root.tsx              实际可用的 Remotion 合成
src/types.ts              题库类型与时间轴
src/data/                 历史题库 / 对话 / 展示数据
docs/                     操作流程、题库记录与方法论
scripts/quiz/             渲染、字幕与 TTS
scripts/publish/           产物检查和发布清单
scripts/dialogue/         对话生产脚本
scripts/story/            故事生产脚本
.agents/skills/           按需读取的 Agent 工作流
public/assets/            静态资源（许可范围见下文）
out/                      本地输出，Git 忽略
```

## 开发验证

```bash
npm test
npx tsc --noEmit
```

贡献前先运行验证；凭据、浏览器登录态、模型缓存及本地输出留在 Git 忽略目录中。排错步骤见 [使用流程](docs/使用流程.md#常见问题)。

## 许可与素材

本项目原创代码及原创文档采用 [MIT](LICENSE)。第三方工作流文档、音乐、音效、肖像、商品图片、截图和参考内容具有独立权利，不因仓库公开而获得 MIT 授权，详见 [第三方内容说明](THIRD_PARTY_NOTICES.md)。新增入门示例不依赖这些音视频素材。

Remotion 本身适用其[官方许可条款](https://www.remotion.dev/docs/license)，模型服务与生成内容按各自条款使用。`package.json` 的 `private: true` 只用于防止误发布 npm 包，与 GitHub 仓库是否公开无关。
