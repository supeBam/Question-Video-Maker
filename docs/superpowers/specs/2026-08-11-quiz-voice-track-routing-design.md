# 题库音轨自动路由设计

## 目标

让 Remotion 根据当前题库的栏目名和期数自动选择对应的题干、答案音频，避免不同题库复用 `q1` 至 `q5` 时串音。完成后分别渲染“中国历史冷知识”和“中国文学名句”两支带配音的视频。

## 目录约定

题库音轨继续存放在 `public/assets/tts/`。单套题库目录由以下规则生成：

```text
assets/tts/{meta.series}-{去除空白后的 meta.episodeLabel}
```

例如：

- `中国历史冷知识` + `第 01 期` 对应 `assets/tts/中国历史冷知识-第01期`
- `中国文学名句` + `第 01 期` 对应 `assets/tts/中国文学名句-第01期`

每道题继续使用既有文件名：

- `{questionId}-question.mp3`
- `{questionId}-answer.mp3`

## 数据流

`LiteratureQuiz` 已把 `data.meta` 传给 `QuestionScene`。本次继续把 `meta` 传给 `QuestionVoiceTracks`，再由 `getQuestionVoiceTracks(meta, questionId)` 生成静态资源路径。

路径生成逻辑只负责栏目目录和文件名，不读取文件系统，也不改变题库 JSON schema。新增题库只要遵循同一目录约定即可复用。

## 播放时间

- 题干音频保持在单题 `Sequence` 的第 0 帧开始播放。
- 答案音频保持在 `presentFrames + countdownFrames` 开始播放。
- 答案语音与正确选项高亮、答案解析、正确答案提示音使用同一个揭晓帧。
- 不调整现有题目时长、倒计时、背景音乐或音量配置。

## 错误处理

路径生成函数拒绝空的 `meta.series`、`meta.episodeLabel` 和 `questionId`，避免生成无法定位的资源路径。目录不存在时由 Remotion 在渲染阶段报告缺失资源，不为此增加运行时文件系统依赖。

## 测试

按测试驱动方式修改：

1. 先更新音轨路径测试，覆盖两套题库的目录计算，并确认测试因旧硬编码接口而失败。
2. 修改路径函数与组件参数，使测试通过。
3. 运行完整测试套件和 TypeScript 检查。
4. 分别用 `questions-260811-1.json`、`questions-260811-2.json` 渲染成片。
5. 检查两个 MP4 均包含音频流，且时长与题库时间轴一致。

## 输出

两支视频使用互不覆盖的文件名输出到 `out/`，并保留项目现有封面生成行为。渲染过程中不覆盖两份日期题库，也不回退用户当前对 `src/data/questions.json` 的修改。
