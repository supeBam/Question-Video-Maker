# 交付概览 · 中国文学常识选择题视频

## 完成内容

### 1. 完整 Remotion 项目
**路径**: `remotion-quiz-video/`

| 项 | 说明 |
|---|---|
| 分辨率 | **1080 × 1920（9:16 竖屏）**，适配视频号 |
| 帧率 | 30 fps |
| 时长 | **60.0 秒（1800 帧）**，由题库 JSON 自动推导 |
| 编码 | H.264 / MP4 |
| 视觉风格 | 水墨夜空 + 宣纸卡片 + 金/朱砂点缀 |

### 2. 题库数据文件
**`src/data/questions.json`** — 包含：
- 元数据（栏目名、期号、账号标签）
- 节奏配置（片头/片尾时长、每题三段式时间分配）
- 片头/片尾文案
- **4 道中国文学常识选择题**（含选项、正解、解析）
- BGM 开关（默认关闭）

### 3. 可复用组件（8 个）
| 组件 | 文件 | 可配置参数 |
|---|---|---|
| Background | `components/Background.tsx` | 背景图、祥云、推镜幅度 |
| Header | `components/Header.tsx` | 栏目名、期号、计数器 |
| CountdownRing | `components/CountdownRing.tsx` | 秒数、尺寸、颜色、警戒色、文案 |
| QuestionCard | `components/QuestionCard.tsx` | 题干、题号、字号、高度 |
| OptionItem | `components/OptionItem.tsx` | 标签、文案、状态、字号 |
| PoemGrid | `components/PoemGrid.tsx` | 诗阵、留白编号、补字高亮 |
| AnswerReveal | `components/AnswerReveal.tsx` | 答案字母、解析、印章 |

### 4. 静态视觉资源（5 个 SVG）
位于 `public/assets/`：水墨背景、祥云纹样、毛笔圆环、朱砂印章、宣纸纹理

### 5. 分镜脚本
**`STORYBOARD.md`** — 含每个镜头的帧范围、画面元素、文案、设计意图

### 6. 最终 MP4
渲染中 → `out/literature-quiz.mp4`

---

## 关键技术决策

1. **时间轴由 JSON 推导**：增删题目不需要改任何代码。4 题=60s，5 题=72.5s，6 题=85s。
2. **背景层在 Sequence 外部**：保证 Ken Burns 推镜 + 祥云横移在全片连续不重置。
3. **每题三段式结构**：呈现(2s) → 倒计时(5s) → 揭晓(5.5s)，节奏紧凑适合竖屏。
4. **倒计时环放在题干上方**：视线路径「环→题干→选项」自上而下一条线。
5. **错误项降透明度而非变红**：视觉焦点唯一，正确答案发光。
6. **所有字号 ≥ 24px**：手机小屏可读。
7. **配色集中管理**：改 `src/theme.ts` 一处即可换皮肤。

---

## 如何做下一期

1. 打开 `src/data/questions.json`
2. 改 `episode` 和 `episodeLabel`
3. 替换 `questions[]` 数组中的题目对象
4. （可选）改 `intro` / `outro` 文案
5. 运行：`npx remotion render LiteratureQuiz out/literature-quiz-ep02.mp4`

详见 `README.md`「三、⭐ 如何做下一期」章节。

---

## 注意事项

- `remotion.config.ts` 中**不要设置** `setChromiumOpenGlRenderer("angle")`，会导致 headless Chrome 的 requestAnimationFrame 不触发，渲染卡死。保持默认（swangle）即可。
- 本机 npm 并发请求较慢（~15s/req），安装依赖时建议加 `--maxsockets=3`。
