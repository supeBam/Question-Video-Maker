# 中国文学常识选择题 · 视频号竖屏模板（Remotion）

一套「换 JSON 就能出下一期」的答题类短视频模板。
1080×1920 / 30fps / H.264 MP4，时间轴由题库自动推导。

---

## 一、目录结构

```
remotion-quiz-video/
├── public/assets/                 ← 静态视觉资源（可直接替换）
│   ├── bg-ink.svg                 水墨夜空背景（1080×1920）
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
│   │   ├── CrosswordGrid.tsx      诗词填字纵横网格（纵横交叉 + 编号 + 补字高亮）
│   │   └── AnswerReveal.tsx       答案揭晓条（盖章 + 解析）
│   ├── scenes/                    分镜场景
│   │   ├── IntroScene.tsx
│   │   ├── QuestionScene.tsx      选择题三段式：呈现 → 倒计时 → 揭晓
│   │   ├── CrosswordScene.tsx     诗词填字纵横两阶段：展示 → 揭晓
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

## 九、诗词填字纵横（crossword）题型

除了选择题，题库还支持「诗词填字纵横」：从多首诗里各抽一句，摆成**横（从左往右）/ 纵（从上往下）交叉的填字网格**，交叉点共用同一个字（比如「床前明月光」的「月」正好接上「月落乌啼霜满天」的开头）。整张网格是**一题**，观众看着编号把缺的字补上，约 45 秒后翻到答案页：留白补全高亮 + 每条线索的出处（横/纵、《诗名》作者）+ 赏析。选择题与诗词填字纵横可在同一期题库里混排。

### 题型数据

```jsonc
{
  "type": "crossword",              // ★ 必须，区分于选择题
  "id": "p1",
  "title": "月字相连",               // 谜面标题（可选，答案页上方显示）
  "hint": "五句诗纵横交织，把缺的字补上",  // 展示阶段提示（可选）
  "clues": [                        // ★ 线索集合：每条 = 从某首诗抽的一句
    {
      "id": "A1", "dir": "across", "row": 2, "col": 1,  // 横，起始格(行,列)
      "text": "床前明月光",
      "source": { "title": "静夜思", "author": "李白", "dynasty": "唐" },
      "blanks": [0]                 // 下标 0（即「床」）留白待填
    },
    {
      "id": "D1", "dir": "down", "row": 2, "col": 4,   // 纵，与 A1 在第 2 行第 4 列交叉
      "text": "月落乌啼霜满天",
      "source": { "title": "枫桥夜泊", "author": "张继", "dynasty": "唐" },
      "blanks": [1]                 // 「落」留白
    }
    // …… 更多线索，整体为一题
  ],
  "explanation": "这张填字以「月」为眼……"  // 答案页赏析（可选）
}
```

- **坐标即摆位**：`row/col` 是这条线索起始格（0-based）；`dir: "across"` 向右、`"down"` 向下。`buildGrid` 会自动算出网格尺寸、交叉点，并按阅读顺序给留白编号 ①②③。
- **交叉点必须共用同一字**：两条线索交叉的那格，两边的字符必须一致（组件会校验，不一致会控制台告警）。这正是「纵横」的玩法——交叉点就是连起两句诗的那一个字。
- **留白 = 待填空格**：`blanks` 给字符在该线索里的下标（0-based）。某格若被多条线索共用且其中一条标了留白，则该格按留白处理。其余字默认给出（作为线索提示）。
- 想要更难，就把更多字标进 `blanks`；想保留交叉点作为「已给的连字」，就别标它。

### 节奏

诗词填字纵横的节奏独立于选择题，全局在 `timing.crossword`：

```jsonc
"timing": {
  "perQuestion": { "presentSeconds": 2, "countdownSeconds": 5, "revealSeconds": 5.5 },
  "crossword": { "displaySeconds": 45, "answerSeconds": 7 }   // 题目展示 45s + 答案页 7s
}
```

- `displaySeconds`：纵横网格 + 倒计时展示时长（即「题目展示时间」，默认 45s）。
- `answerSeconds`：答案页（补字高亮 + 线索出处图例 + 赏析）时长，默认 7s。
- 单题单独改时长：在该题对象里加 `"timingOverride": { "displaySeconds": 30 }`。

### 两个合成

- `LiteratureQuiz`：沿用 `src/data/questions.json`（当前为选择题）。
- `CrosswordQuiz`：诗词填字纵横混排示例，数据源 `src/data/questions-crossword-demo.json`。

渲染示例（诗词填字纵横这一期）：

```bash
npx remotion render CrosswordQuiz out/crossword-ep01.mp4
```

### 示例文件

`src/data/questions-crossword-demo.json` 是**单题**示例：一期只出**一道**诗词填字纵横（5 条线索：以纵向主干「月落乌啼霜满天」串起横 A1 床前明月光 / A2 霜叶红于二月花 / A3 碧海青天夜夜心，并在 A2 末端的「月」处垂下纵 D2 月涌大江流），交叉点共用「月 / 霜 / 天」，共 5 首唐诗交织，五条线**正交相连成一张连通的网**（不会拆成两半）。只在 4 个交叉点给出字符当线索，其余 23 格全部留白——观众看着线索区（只显示少数字、不剧透出处）把缺的字补上。可直接 `npm run dev`，在预览台右上角切换合成 `CrosswordQuiz` 查看效果。

> - 想要「只给几个字」的硬核玩法：把每条 `clues` 的 `blanks` 写成「除交叉点外全标」，如上例。
> - 想要更简单：少标几个 `blanks`（多给些字当提示）即可。
> - 校验摆位：改完 `clues` 后跑 `node scripts/validate-crossword.mjs src/data/questions-crossword-demo.json`，会报告网格尺寸、留白数、交叉点是否一致（不一致标 ✗），并额外检查整张网格是否**连通成一张网**——若被拆成多个互不相连的部分（看起来像多道题），会告警 ⚠，提醒你调整摆位让线索全部连起来。

选择题与诗词填字纵横仍可在同一期题库里混排（`questions` 数组里同时放 `type:"choice"` 与 `type:"crossword"` 即可）；上面只是把演示默认成「单题」形态。

---

## 十、常见问题

- **中文显示成方块**：`THEME.fonts` 里的字体在本机不存在，改成本机有的字体名即可（Windows 一定有 `Microsoft YaHei` / `SimSun` / `KaiTi`）。
- **选项文字换行溢出**：单个选项建议不超过 12 个汉字；超长时组件会自动降字号，仍不够就缩短文案。
- **题干显示不全**：题干建议控制在 40 字以内，用 `\n` 手动断句更好看。
- **`Composition not found`**：确认 `npx remotion render` 用的 id 是 `LiteratureQuiz`。
