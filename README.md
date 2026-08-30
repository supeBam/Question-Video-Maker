# 中国文学常识选择题 · 视频号竖屏模板（Remotion）

一套「换 JSON 就能出下一期」的答题类短视频模板。
1080×1920 / 30fps / H.264 MP4，时间轴由题库自动推导。

---

## 一、目录结构

```
remotion-quiz-video/
├── public/assets/                 ← 静态视觉资源（可直接替换）
│   ├── bg-ink.svg                 水墨夜空背景（1080×1920）
│   ├── bg-yacheng.svg             万物雅称背景（云霭·望舒月，浅色护眼）
│   ├── cloud-pattern.svg          顶部祥云纹样
│   ├── ring-brush.svg             倒计时外圈毛笔飞白环
│   ├── seal-mark.svg              朱砂印章
│   └── paper-texture.svg          宣纸纹理（备用）
├── src/
│   ├── data/questions.json        ★ 题库 + 期号 + 节奏配置（改这一个文件就能出新一期）
│   ├── theme.ts                   ★ 配色 / 字体 / 版式尺寸
│   ├── types.ts                   类型定义 + buildTimeline() 时间轴推导
│   ├── animations.ts              复用动效函数（fadeSlideUp / stagger / popIn ...）
│   ├── components/                可配置组件
│   │   ├── Background.tsx         全片连续背景（缓推 + 祥云横移）
│   │   ├── Header.tsx             顶部信息条（栏目名 / 期号 / 题号计数）
│   │   ├── CountdownRing.tsx      倒计时环（秒数/尺寸/配色/警戒色/文案全可配）
│   │   ├── QuestionCard.tsx       题干卡片（字号按字数自动缩放）
│   │   ├── OptionItem.tsx         选项行（idle / correct / wrong 三态）
│   │   └── AnswerReveal.tsx       答案揭晓条（盖章 + 解析）
│   ├── scenes/                    分镜场景
│   │   ├── IntroScene.tsx
│   │   ├── QuestionScene.tsx      选择题三段式：呈现 → 倒计时 → 揭晓
│   │   ├── FillScene.tsx          填空题三段式（万物雅称）：提问 → 思考 → 揭晓雅称
│   │   └── OutroScene.tsx
│   ├── LiteratureQuiz.tsx         主合成
│   ├── Root.tsx                   注册合成（总帧数自动计算）
│   └── index.ts
├── out/                           渲染输出
├── STORYBOARD.md                  分镜脚本
└── remotion.config.ts
```

---

## 二、命令

```bash
# 安装依赖（首次）
npm install

# 打开可视化预览工作台（改文案实时看效果）
npm run dev            # http://localhost:3000

# 渲染成片
npm run render         # → out/literature-quiz.mp4

# 自定义输出文件名（推荐按期号命名）
npx remotion render LiteratureQuiz out/literature-quiz-ep02.mp4

# 高画质版本
npx remotion render LiteratureQuiz out/ep02-hq.mp4 --crf=16 --jpeg-quality=95

# 导出某一帧当封面
npx remotion still LiteratureQuiz out/cover.png --frame=40
```

---

## 三、⭐ 如何做下一期：只改一个文件

打开 **`src/data/questions.json`**，改三处即可，**代码一行都不用动**：

### 1) 改期号

```jsonc
"meta": {
  "series": "中国文学常识",
  "episode": 2,
  "episodeLabel": "第 02 期",   // ← 顶部信息条 + 片头落款会自动更新
  "hostTag": "@每日文学小测"
}
```

### 2) 换题目（数组，几道都行）

```jsonc
"questions": [
  {
    "id": "q1",                                  // 唯一即可，用作 React key
    "stem": "「小荷才露尖尖角」\n的下一句是？",     // \n 手动换行；字号会按字数自动缩放
    "options": ["早有蜻蜓立上头", "映日荷花别样红", "接天莲叶无穷碧", "菡萏香销翠叶残"],
    "answerIndex": 0,                            // ★ 从 0 开始：0=A 1=B 2=C 3=D
    "explanation": "杨万里《小池》。「映日荷花别样红」出自《晓出净慈寺送林子方》。"
  }
  // ... 想加第 5、第 6 题，直接往后追加对象
]
```

**总时长会自动重算**：
`总时长 = 片头 + Σ每题(呈现+倒计时+揭晓) + 片尾`
4 题 = 60s；5 题 = 72.5s；6 题 = 85s。不用去改 `durationInFrames`。

### 3) 改片头片尾文案

```jsonc
"intro":  { "kicker": "...", "title": "第一行\n第二行", "subtitle": "...", "hint": "每题 5 秒作答" },
"outro":  { "headline": "你答对了几题？", "scoreHints": ["...", "...", "..."],
            "cta": "点赞 + 关注", "ctaSub": "..." }
```

然后：

```bash
npx remotion render LiteratureQuiz out/literature-quiz-ep02.mp4
```

---

## 四、调节奏（可选）

全局节奏在 `timing.perQuestion`：

```jsonc
"timing": {
  "fps": 30,
  "introSeconds": 5,
  "outroSeconds": 5,
  "perQuestion": {
    "presentSeconds": 2,     // 读题时间：选项多/字多就调到 2.5~3
    "countdownSeconds": 5,   // 倒计时秒数：难题给 7~8 秒
    "revealSeconds": 5.5     // 揭晓+解析：解析长就调到 6~7
  }
}
```

**单题单独加时**（比如第 3 题特别难），在该题对象里加 `timingOverride`：

```jsonc
{
  "id": "q3",
  "stem": "...",
  "options": ["...", "...", "...", "..."],
  "answerIndex": 2,
  "explanation": "...",
  "timingOverride": { "countdownSeconds": 8, "revealSeconds": 7 }
}
```

---

## 五、换皮肤 / 换素材

| 想改什么 | 改哪里 |
|---|---|
| 配色（金色换成青色等） | `src/theme.ts` → `THEME.colors` |
| 字体 | `src/theme.ts` → `THEME.fonts`（当前使用系统中文字体栈，无需联网） |
| 字号 / 安全区 | `src/theme.ts` → `THEME.fontSize` / `THEME.layout` |
| 背景图 | 直接覆盖 `public/assets/bg-ink.svg`（也可换成 jpg/png，改 `Background` 的 `src`） |
| 倒计时外环样式 | 覆盖 `public/assets/ring-brush.svg`，或给 `CountdownRing` 传 `brushSrc={null}` 关掉 |
| 印章 Logo | 覆盖 `public/assets/seal-mark.svg` |

---

## 六、背景音乐（默认关闭）

1. 把版权合规的音频放到 `public/assets/bgm.mp3`
   （推荐来源：Pixabay Music、YouTube Audio Library、freepd.com，均可免费商用；**不要直接扒平台热歌**）
2. 在 `questions.json` 里打开：

```jsonc
"bgm": { "enabled": true, "file": "assets/bgm.mp3", "volume": 0.22 }
```

音量建议 0.15–0.25，答题类视频 BGM 太响会盖过观众的思考节奏。

---

## 七、渲染耗时参考

60 秒 / 1800 帧 / 1080×1920，普通笔记本约 **2–5 分钟**（多核 CPU 会更快）。
如果内存吃紧：`npx remotion render LiteratureQuiz out/x.mp4 --concurrency=2`

---

## 九、填空题（万物雅称）题型

除了选择题，题库还支持「填空题」——专为《万物雅称》这类专题设计：**问「X 的雅称是什么」→ 揭晓雅称大字 → 底部给出解释**。三段式节奏（呈现 → 思考 → 揭晓），无选项，观众心里默答。

### 题型数据

```jsonc
{
  "type": "fill",                    // ★ 必须，区分于选择题
  "id": "f1",
  "tag": "星月",                     // 题干上方的小标签（可选）
  "stem": "古人给「月亮」的雅称\n叫什么？",  // 问句，支持 \n 换行
  "hint": "两个字的雅称",             // 思考阶段的提示（可选）
  "answer": "望舒",                  // ★ 雅称（揭晓时大字亮出）
  "explanation": "《楚辞》有「前望舒使先驱兮」……"  // 底部解释
}
```

### 节奏

```jsonc
"timing": {
  "perQuestion": { "presentSeconds": 2, "countdownSeconds": 5, "revealSeconds": 5.5 },
  "fill": { "presentSeconds": 3.5, "countdownSeconds": 6, "revealSeconds": 7 }
}
```

- `presentSeconds`：题干入场时间；`countdownSeconds`：思考倒计时；`revealSeconds`：雅称大字 + 解释时长。
- 单题单独改时长：在该题对象里加 `"timingOverride": { "countdownSeconds": 8 }`。

### 换背景板（换专题皮肤）

在题库顶层加 `background`：

```jsonc
"background": { "src": "assets/bg-yacheng.svg", "cloudSrc": null, "drift": 0.04 }
```

- `src`：背景图（缺省 `assets/bg-paper.svg`）；`cloudSrc`：顶部祥云纹样（传 `null` 关闭）；`drift`：缓慢推镜幅度。

### 合成与渲染

- `WanwuYacheng`：万物雅称填空题专题，数据源 `src/data/questions-wanwu-yacheng.json`。

```bash
npx remotion render WanwuYacheng out/wanwu-yacheng-ep01.mp4
```

用脚本一次出片（含封面 / 字幕 / 发布文案）：

```bash
node scripts/render-with-cover.mjs out/wanwu-yacheng-ep01.mp4 \
  --data=src/data/questions-wanwu-yacheng.json
```

> 两种题型可在同一期混排：`questions` 数组里同时放 `type:"choice"` / `"fill"` 即可。

---

## 十一、常见问题

- **中文显示成方块**：`THEME.fonts` 里的字体在本机不存在，改成本机有的字体名即可（Windows 一定有 `Microsoft YaHei` / `SimSun` / `KaiTi`）。
- **选项文字换行溢出**：单个选项建议不超过 12 个汉字；超长时组件会自动降字号，仍不够就缩短文案。
- **题干显示不全**：题干建议控制在 40 字以内，用 `\n` 手动断句更好看。
- **`Composition not found`**：确认 `npx remotion render` 用的 id 是 `LiteratureQuiz`。
