# 视频生产项目

本仓库通过项目 Skill、Remotion 组件和生产脚本，支持多种视频内容。视频类型可以各自使用不同的数据格式和制作流程；Agent 应先识别内容类型，再读取对应入口，不要假设所有视频都走同一条流水线。

## Agent 工作入口

- 项目协作规则与题目查重：[`AGENTS.md`](AGENTS.md)
- 当前可自动发现的项目 Skill：
  - 抖音对标视频分析与转写：`.agents/skills/douyin-competitor-video/SKILL.md`
  - 文案拆解与改写：`.agents/skills/script-rewriter/SKILL.md`
- 题目快闪模板：[`docs/方法论/爆款快闪模板.md`](docs/方法论/爆款快闪模板.md)
- 音色、口播和字幕规范：`docs/方法论/`
- Remotion 合成注册表：[`src/Root.tsx`](src/Root.tsx)，当前合成 ID 为 `BurstQuiz` 和 `ScrollShow`

项目 Skill 只保留当前使用的工作流。历史 Skill 不放在 `.agents/skills/` 中，避免被 Agent 当作可执行指令。

## 开发与出片

```bash
npm install
npm run dev
```

选择题/填空题快闪视频，手工配音模式会生成视频、封面、SRT 和发布文案：

```bash
npm run render:manual -- out/成语-第17期.mp4 \
  --data=src/data/questions-260910-1.json
```

自动 TTS 模式会先生成配音，再渲染带配音视频和封面：

```bash
npm run render:auto -- out/成语-第17期.mp4 \
  --data=src/data/questions-260910-1.json \
  --video-label=成语-第17期
```

自动 TTS 依赖本机 `.venv-asr/` 和 MiniMax 凭证。数据文件需使用项目现有 schema；答题题库见 `src/data/questions-*.json`。

画卷展示流使用 `ScrollShow` 合成：

```bash
npm run render:manual -- out/万物雅称-第01期.mp4 \
  --composition=ScrollShow \
  --data=src/data/scroll-show-260911-1.json
```

项目脚本、题库与素材位置：

- 答题渲染与 TTS：`scripts/quiz/`
- 对话视频：`scripts/dialogue/`
- 故事视频：`scripts/story/`
- 发布清单准备：`scripts/publish/prepare.mjs`
- 分析工具：`scripts/analytics/`
- 通用媒体工具：`scripts/utils/`
- 视频与封面输出：`out/`（本地生成目录，不纳入版本控制）

## 常用命令

```bash
npm run dev:data -- --data=src/data/questions-260910-1.json
npm run publish:prepare -- out/成语-第17期.mp4
npm test
```

`publish:prepare` 只生成发布清单并做字段检查，不会操作发布平台。平台网页填写需按用户当前授权和可用的发布工作流执行。

## 维护原则

- 运行入口以 `package.json`、`src/Root.tsx` 和对应脚本的 CLI 参数为准；文档只解释选择流程和容易踩的约定。
- 不因题库或素材日期较早就删除；历史数据用于查重、复用和复现。
- 新增或修改题目时，遵循 `AGENTS.md` 中的查重、审校和题库记录要求。
