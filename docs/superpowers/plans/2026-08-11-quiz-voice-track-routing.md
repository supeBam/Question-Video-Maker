# 题库音轨自动路由实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 根据题库栏目与期数自动选择题干和答案音轨，并渲染两支音频位置正确的 MP4。

**架构：** 音轨路径函数接收题库 `meta` 与题目 ID，按照 `assets/tts/{series}-{无空白 episodeLabel}` 生成资源路径。`QuestionScene` 把已有 `meta` 继续传给音轨组件；播放帧保持题干从 0 开始、答案从揭晓帧开始。渲染两套题库时通过 Remotion 输入参数传入数据，不覆盖当前默认题库。

**技术栈：** TypeScript、React 19、Remotion 4、Node.js 内置测试运行器、PowerShell。

---

### 任务 1：用失败测试定义动态音轨目录

**文件：**

- 修改：`tests/question-voice-tracks.test.mjs`
- 测试：`tests/question-voice-tracks.test.mjs`

- [ ] **步骤 1：写入两套题库路径和空元数据测试**

```js
test("题目音轨路径根据栏目和期数生成", () => {
  assert.deepEqual(
    getQuestionVoiceTracks(
      { series: "中国历史冷知识", episodeLabel: "第 01 期" },
      "q3"
    ),
    {
      question: "assets/tts/中国历史冷知识-第01期/q3-question.mp3",
      answer: "assets/tts/中国历史冷知识-第01期/q3-answer.mp3",
      volume: 4,
    }
  );

  assert.equal(
    getQuestionVoiceTracks(
      { series: "中国文学名句", episodeLabel: "第 01 期" },
      "q5"
    ).answer,
    "assets/tts/中国文学名句-第01期/q5-answer.mp3"
  );
});

test("题目音轨路径拒绝空元数据和空题目 ID", () => {
  assert.throws(
    () => getQuestionVoiceTracks({ series: "", episodeLabel: "第 01 期" }, "q1"),
    /栏目名/
  );
  assert.throws(
    () => getQuestionVoiceTracks({ series: "中国历史冷知识", episodeLabel: "" }, "q1"),
    /期数/
  );
  assert.throws(
    () =>
      getQuestionVoiceTracks(
        { series: "中国历史冷知识", episodeLabel: "第 01 期" },
        ""
      ),
    /题目 ID/
  );
});
```

- [ ] **步骤 2：运行测试并确认因旧接口失败**

运行：

```powershell
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/question-voice-tracks.test.mjs
```

预期：失败，旧实现把第一个对象当作 `questionId` 调用 `.trim()`，证明测试覆盖了尚未实现的动态路由。

### 任务 2：实现动态音轨路由并传递题库元数据

**文件：**

- 修改：`src/questionVoiceTracks.ts`
- 修改：`src/components/QuestionVoiceTracks.tsx`
- 修改：`src/scenes/QuestionScene.tsx`
- 测试：`tests/question-voice-tracks.test.mjs`

- [ ] **步骤 1：实现路径生成函数**

将 `getQuestionVoiceTracks` 改为接收精简元数据：

```ts
import type { QuizData } from "./types";

type VoiceTrackMeta = Pick<QuizData["meta"], "series" | "episodeLabel">;

export const getQuestionVoiceTracks = (
  meta: VoiceTrackMeta,
  questionId: string
): QuestionVoiceTracks => {
  const series = meta.series.trim();
  const episodeLabel = meta.episodeLabel.replace(/\s+/g, "");
  const normalizedQuestionId = questionId.trim();

  if (!series) throw new Error("栏目名不能为空");
  if (!episodeLabel) throw new Error("期数不能为空");
  if (!normalizedQuestionId) throw new Error("题目 ID 不能为空");

  const seriesDirectory = `assets/tts/${series}-${episodeLabel}`;
  return {
    question: `${seriesDirectory}/${normalizedQuestionId}-question.mp3`,
    answer: `${seriesDirectory}/${normalizedQuestionId}-answer.mp3`,
    volume: VOICE_VOLUME,
  };
};
```

- [ ] **步骤 2：让音轨组件接收并使用 `meta`**

在 `QuestionVoiceTracksProps` 中增加：

```ts
meta: Pick<QuizData["meta"], "series" | "episodeLabel">;
```

组件调用改为：

```ts
const tracks = getQuestionVoiceTracks(meta, questionId);
```

- [ ] **步骤 3：从单题场景传入元数据**

```tsx
<QuestionVoiceTracks
  meta={meta}
  questionId={question.id}
  answerStartFrame={revealStart}
/>
```

- [ ] **步骤 4：运行音轨测试并确认通过**

运行：

```powershell
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/question-voice-tracks.test.mjs
```

预期：所有音轨路径测试通过。

### 任务 3：验证代码与音频资产完整性

**文件：**

- 验证：`src/questionVoiceTracks.ts`
- 验证：`src/components/QuestionVoiceTracks.tsx`
- 验证：`src/scenes/QuestionScene.tsx`
- 验证：`public/assets/tts/中国历史冷知识-第01期/`
- 验证：`public/assets/tts/中国文学名句-第01期/`

- [ ] **步骤 1：运行完整测试套件**

```powershell
npm test
```

预期：全部测试通过且无失败。

- [ ] **步骤 2：运行 TypeScript 检查**

```powershell
npx tsc --noEmit
```

预期：退出码为 0。

- [ ] **步骤 3：检查两套音频文件与题目一一对应**

读取两份 JSON，对每个 `q1` 至 `q5` 检查对应目录下同时存在 `question` 和 `answer` MP3；预期共 20 个非空文件。

### 任务 4：渲染两支视频并核验音轨位置

**文件：**

- 读取：`src/data/questions-260811-1.json`
- 读取：`src/data/questions-260811-2.json`
- 生成：`out/中国历史冷知识-第01期.mp4`
- 生成：`out/中国历史冷知识-第01期.png`
- 生成：`out/中国文学名句-第01期.mp4`
- 生成：`out/中国文学名句-第01期.png`

- [ ] **步骤 1：为第一套题库创建临时 Remotion 输入参数并渲染**

在系统临时目录生成 `{ "data": 题库 JSON }` 参数文件并渲染视频和封面：

```powershell
$propsPath = Join-Path ([System.IO.Path]::GetTempPath()) "question-video-maker-history-props.json"
$quiz = Get-Content -Raw -Encoding utf8 src/data/questions-260811-1.json | ConvertFrom-Json
@{ data = $quiz } | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 $propsPath
try {
  npx remotion render LiteratureQuiz out/中国历史冷知识-第01期.mp4 "--props=$propsPath" --log=error
  npx remotion still LiteratureQuiz out/中国历史冷知识-第01期.png --frame=90 "--props=$propsPath"
} finally {
  Remove-Item -LiteralPath $propsPath -Force -ErrorAction SilentlyContinue
}
```

预期：视频和封面均成功生成，临时参数文件在成功或失败时都会被删除。

- [ ] **步骤 2：为第二套题库创建临时 Remotion 输入参数并渲染**

同样传入 `questions-260811-2.json`，渲染视频和封面：

```powershell
$propsPath = Join-Path ([System.IO.Path]::GetTempPath()) "question-video-maker-literature-props.json"
$quiz = Get-Content -Raw -Encoding utf8 src/data/questions-260811-2.json | ConvertFrom-Json
@{ data = $quiz } | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 $propsPath
try {
  npx remotion render LiteratureQuiz out/中国文学名句-第01期.mp4 "--props=$propsPath" --log=error
  npx remotion still LiteratureQuiz out/中国文学名句-第01期.png --frame=90 "--props=$propsPath"
} finally {
  Remove-Item -LiteralPath $propsPath -Force -ErrorAction SilentlyContinue
}
```

预期：视频和封面均成功生成，临时参数文件在成功或失败时都会被删除。

渲染结束后删除临时参数文件。

- [ ] **步骤 3：核验成片**

检查两个 MP4 均存在、非空且时长约 95 秒。运行：

```powershell
npx remotion ffprobe -v error -show_entries format=duration -show_entries stream=codec_type -of json out/中国历史冷知识-第01期.mp4
npx remotion ffprobe -v error -show_entries format=duration -show_entries stream=codec_type -of json out/中国文学名句-第01期.mp4
```

预期：每个文件都包含一个 `video` 流和一个 `audio` 流，时长约为 95 秒。音轨路径测试负责证明题库与文件一一对应；组件现有 `Sequence from={0}` 与 `Sequence from={answerStartFrame}`，以及 `answerStartFrame = presentFrames + countdownFrames`，共同证明题干位于单题开头、答案位于 11.5 秒后的揭晓位置。

- [ ] **步骤 4：检查工作区差异**

```powershell
git diff --check
git status --short
```

确认只包含本次代码、测试、音频和成片，以及用户原有的题库修改；不回退或覆盖用户文件。
