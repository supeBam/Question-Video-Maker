# 答题音效实施计划

> **供自动化开发执行者使用：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项执行并跟踪下列复选框。

**目标：** 每道题在倒计时剩余 3 秒和答案揭晓时自动播放对应的固定音效，同时保留每期视频独立选择背景音乐的能力。

**架构：** 把触发帧计算放入无界面的纯函数，题目音效组件只负责把计算结果转换为 Remotion `Sequence` 和 `Audio`。`QuestionScene` 提供当前题目的呈现帧与倒计时帧，确保全局时间和单题覆盖配置都不会导致音效错位。

**技术栈：** TypeScript、React 19、Remotion 4、Node.js 内置测试运行器。

---

## 文件结构

- 新增 `src/questionSoundTiming.ts`：计算两个音效相对于单题场景的触发帧。
- 新增 `tests/question-sound-effects.test.mjs`：覆盖标准倒计时和短倒计时边界。
- 新增 `src/components/QuestionSoundEffects.tsx`：渲染两个固定音频序列。
- 修改 `src/scenes/QuestionScene.tsx`：把题目时间参数交给音效组件。
- 修改 `package.json`：增加不引入第三方依赖的测试命令。

### 任务 1：用测试定义音效触发时间

**文件：**

- 新增：`tests/question-sound-effects.test.mjs`
- 新增：`src/questionSoundTiming.ts`
- 修改：`package.json`

- [x] **步骤 1：添加测试命令和失败测试**

在 `package.json` 的 `scripts` 中增加：

```json
"test": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/*.test.mjs"
```

创建测试文件：

```js
import assert from "node:assert/strict";
import test from "node:test";
import { getQuestionSoundTiming } from "../src/questionSoundTiming.ts";

test("倒计时音效在答案揭晓前 3 秒开始", () => {
  assert.deepEqual(
    getQuestionSoundTiming({ fps: 30, presentFrames: 60, countdownFrames: 150 }),
    {
      countdownStartFrame: 120,
      countdownDurationInFrames: 90,
      answerStartFrame: 210,
    }
  );
});

test("不足 3 秒的倒计时从倒计时起点播放音效", () => {
  assert.deepEqual(
    getQuestionSoundTiming({ fps: 30, presentFrames: 60, countdownFrames: 60 }),
    {
      countdownStartFrame: 60,
      countdownDurationInFrames: 60,
      answerStartFrame: 120,
    }
  );
});
```

- [x] **步骤 2：运行测试并确认按预期失败**

运行：

```powershell
npm test
```

预期：测试失败，错误指出无法找到 `src/questionSoundTiming.ts`。

- [x] **步骤 3：实现最小时间计算函数**

创建 `src/questionSoundTiming.ts`：

```ts
export type QuestionSoundTimingInput = {
  fps: number;
  presentFrames: number;
  countdownFrames: number;
};

export type QuestionSoundTiming = {
  countdownStartFrame: number;
  countdownDurationInFrames: number;
  answerStartFrame: number;
};

export const getQuestionSoundTiming = ({
  fps,
  presentFrames,
  countdownFrames,
}: QuestionSoundTimingInput): QuestionSoundTiming => {
  const answerStartFrame = presentFrames + countdownFrames;
  const countdownStartFrame = Math.max(
    presentFrames,
    answerStartFrame - Math.round(3 * fps)
  );

  return {
    countdownStartFrame,
    countdownDurationInFrames: answerStartFrame - countdownStartFrame,
    answerStartFrame,
  };
};
```

- [x] **步骤 4：运行测试并确认通过**

运行：

```powershell
npm test
```

预期：2 项测试全部通过，失败数为 0。

### 任务 2：把固定音效接入每道题

**文件：**

- 新增：`src/components/QuestionSoundEffects.tsx`
- 修改：`src/scenes/QuestionScene.tsx`

- [x] **步骤 1：新增题目音效组件**

创建 `src/components/QuestionSoundEffects.tsx`：

```tsx
import React from "react";
import { Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import { getQuestionSoundTiming } from "../questionSoundTiming";

export type QuestionSoundEffectsProps = {
  presentFrames: number;
  countdownFrames: number;
};

export const QuestionSoundEffects: React.FC<QuestionSoundEffectsProps> = ({
  presentFrames,
  countdownFrames,
}) => {
  const { fps } = useVideoConfig();
  const timing = getQuestionSoundTiming({ fps, presentFrames, countdownFrames });

  return (
    <>
      <Sequence
        from={timing.countdownStartFrame}
        durationInFrames={timing.countdownDurationInFrames}
        name="三秒倒计时音效"
      >
        <Audio src={staticFile("assets/audio/开始三秒倒计时.mp3")} />
      </Sequence>
      <Sequence from={timing.answerStartFrame} name="正确答案音效">
        <Audio src={staticFile("assets/audio/出正确答案的音频.mp3")} />
      </Sequence>
    </>
  );
};
```

- [x] **步骤 2：在单题场景中挂载组件**

在 `src/scenes/QuestionScene.tsx` 中导入组件：

```tsx
import { QuestionSoundEffects } from "../components/QuestionSoundEffects";
```

在最外层 `AbsoluteFill` 内加入：

```tsx
<QuestionSoundEffects
  presentFrames={presentFrames}
  countdownFrames={countdownFrames}
/>
```

- [x] **步骤 3：运行自动测试**

运行：

```powershell
npm test
```

预期：2 项测试全部通过，失败数为 0。

### 任务 3：验证 Remotion 合成和输出音轨

**文件：**

- 验证：`src/index.ts`
- 生成：`out/sound-effects-check.mp4`

- [x] **步骤 1：验证合成可以打包和加载**

运行：

```powershell
npx remotion compositions src/index.ts
```

预期：退出码为 0，并列出 `LiteratureQuiz`。

- [x] **步骤 2：渲染覆盖第一题两个音效触发点的片段**

运行：

```powershell
npx remotion render LiteratureQuiz out/sound-effects-check.mp4 --frames=260-390
```

预期：退出码为 0，并生成包含倒计时和答案揭晓的短视频。

- [x] **步骤 3：确认输出包含音频流**

运行：

```powershell
& "node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe" -v error -select_streams a -show_entries stream=codec_name -of default=noprint_wrappers=1 out/sound-effects-check.mp4
```

预期：输出 `codec_name=aac`。

- [x] **步骤 4：复查最终改动**

检查新增组件只使用固定题目音效路径，且 `LiteratureQuiz.tsx` 中现有的 `data.bgm.enabled`、`data.bgm.file` 和 `data.bgm.volume` 逻辑保持不变。
