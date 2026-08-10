# 视频同名封面截图实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `npm run render` 每次输出 MP4 后自动生成同路径、同名的第 3 秒 PNG 封面。

**Architecture:** 使用一个可直接执行也可被测试导入的 Node.js 脚本统一编排两次 Remotion CLI 调用。路径推导保持为无副作用函数，渲染失败通过子进程退出码立即向上传播。

**Tech Stack:** Node.js ESM、Remotion CLI、Node.js test runner

---

### Task 1: 定义封面路径规则

**Files:**
- Create: `scripts/render-with-cover.mjs`
- Create: `tests/render-with-cover.test.mjs`

- [ ] **Step 1: 编写失败测试**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { getCoverPath } from "../scripts/render-with-cover.mjs";

test("封面与 MP4 同路径同名", () => {
  assert.equal(
    getCoverPath("out/中国朝代历史-第02期.mp4"),
    "out/中国朝代历史-第02期.png"
  );
});

test("拒绝非 MP4 输出路径", () => {
  assert.throws(() => getCoverPath("out/video.mov"), /\.mp4/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`

Expected: FAIL，提示无法导入 `scripts/render-with-cover.mjs`。

- [ ] **Step 3: 实现最小路径函数**

```js
import path from "node:path";

export const getCoverPath = (videoPath) => {
  if (path.extname(videoPath).toLowerCase() !== ".mp4") {
    throw new Error("视频输出路径必须使用 .mp4 扩展名");
  }
  return videoPath.slice(0, -4) + ".png";
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`

Expected: 7 项测试全部通过。

### Task 2: 编排视频和封面渲染

**Files:**
- Modify: `scripts/render-with-cover.mjs`
- Modify: `package.json`

- [ ] **Step 1: 在脚本中依次运行 Remotion**

脚本使用 `spawnSync` 运行以下等价命令，并在任一步失败时以非零状态退出：

```text
npx remotion render LiteratureQuiz <videoPath>
npx remotion still LiteratureQuiz <coverPath> --frame=90
```

默认 `videoPath` 为 `out/literature-quiz.mp4`；Windows 使用 `npx.cmd`，其他平台使用 `npx`。

- [ ] **Step 2: 更新正式渲染入口**

将 `package.json` 更新为：

```json
"render": "node scripts/render-with-cover.mjs"
```

- [ ] **Step 3: 运行完整测试**

Run: `npm test`

Expected: 7 项测试全部通过。

### Task 3: 真实渲染验收

**Files:**
- Generate: `out/封面自动输出验收.mp4`
- Generate: `out/封面自动输出验收.png`

- [ ] **Step 1: 执行统一渲染命令**

Run: `npm run render -- "out/封面自动输出验收.mp4"`

Expected: 视频和静帧两次 Remotion 命令均退出为 0。

- [ ] **Step 2: 检查两个交付物**

Run: `Get-Item "out/封面自动输出验收.mp4", "out/封面自动输出验收.png"`

Expected: 两个文件均存在且大小大于 0。

- [ ] **Step 3: 检查封面尺寸和画面**

使用本地图片检查工具打开 PNG，确认尺寸为合成竖屏尺寸，且片头标题、副标题、玩法提示和期号完整可见。

- [ ] **Step 4: 最终回归测试**

Run: `npm test`

Expected: 7 项测试全部通过。
