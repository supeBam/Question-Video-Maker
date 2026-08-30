# QuizData 结构参考

## 顶层结构

`QuizData` 必须包含以下字段：

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `meta` | object | `series`、`episode`、`episodeLabel`、`hostTag` 均为必填 |
| `timing` | object | `fps` 为正整数；片头片尾秒数为正数；`perQuestion` 含三个正数 |
| `intro` | object | `kicker`、`title`、`subtitle`、`hint` 为文本 |
| `outro` | object | `headline`、`scoreHints`、`cta`、`ctaSub` 为必填 |
| `bgm` | object | `enabled` 为布尔值，`file` 为文本，`volume` 范围为 0 至 1；默认音频来自 `public/assets/bg-audio/` |
| `questions` | array | 至少 1 题 |

每题必须包含：

```json
{
  "id": "q1",
  "stem": "题干？",
  "options": ["选项 A", "选项 B", "选项 C", "选项 D"],
  "answerIndex": 0,
  "explanation": "说明正确答案及其依据。"
}
```

`options` 数量为 2 至 4，所有选项必须是非空字符串；`answerIndex` 是从 0 开始的整数，必须小于选项数量；同一文件中的 `id` 不得重复。

## 默认继承

读取 `src/data/questions.json`，复制用户未指定的 `meta`、`timing`、`intro`、`outro`、`bgm` 字段。题量变化时更新 `meta.episode`、`meta.episodeLabel`、`intro.title` 和 `outro.scoreHints`，不要改变用户明确指定的文案。

默认题量为 5。默认文件名为 `src/data/questions-YYMMDD-N.json`，`N` 是当天可用的最小正整数；显式要求覆盖时才使用 `src/data/questions.json`。

## 背景音乐

项目背景音乐目录为 `public/assets/bg-audio/`。**答题/快闪题库默认用 `assets/bg-audio/bgm_guzheng_liqiu.mp3`、音量 `0.2`**（音量调小，避免盖过音效与 TTS）。JSON 中的 `bgm.file` 使用相对 `public/` 的路径，例如：

```json
{
  "enabled": true,
  "file": "assets/bg-audio/bgm_guzheng_liqiu.mp3",
  "volume": 0.2
}
```

生成或更新题库时，先列出该目录现有音频并选择合适文件；用户明确指定音频或音量时以用户指定为准。

## 背景皮肤（background）

- 选择题：黄色宣纸底 `assets/bg-paper.svg`（组件默认，可省略 `background` 字段）。
- 填空题（万物雅称）：青灰白底 `assets/bg-yacheng.svg`。
- 快闪模板：`{ "src": <按题型选>, "cloudSrc": null, "drift": 0.04 }`。
