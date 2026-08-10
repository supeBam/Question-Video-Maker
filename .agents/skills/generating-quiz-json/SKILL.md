---
name: generating-quiz-json
description: Use when the user asks to create, replace, or update this project's Chinese quiz question bank as a complete JSON file for Remotion, including topic, question count, audience, difficulty, metadata, or output filename requirements.
---

# 生成题库 JSON

根据用户要求生成项目可直接渲染的完整 `QuizData` JSON。题目内容用中文，文件使用 UTF-8 编码。

## 工作流程

1. 读取 `src/data/questions.json` 和 [references/quiz-data-schema.md](references/quiz-data-schema.md)，以当前题库作为默认配置来源。
2. 提取主题、受众、难度、题量、栏目文案和特殊限制。未指定题量时使用 5 题；仍会在用户要求含糊且会显著影响结果时只询问一个必要问题。
3. 生成题目：每题只有一个无争议正确答案；选项为 2 至 4 个互斥、同类、非空文本；`answerIndex` 从 0 开始；解析说明答案依据。对不确定事实先核实，不要猜测。
4. 生成完整顶层字段：`meta`、`timing`、`intro`、`outro`、`bgm`、`questions`。用户未指定的配置继承 `src/data/questions.json`，并按实际题量更新期数、标题和计分提示。背景音乐统一从 `public/assets/bg-audio/` 选择；写入 `bgm.file` 时使用相对 `public/` 的路径，例如 `assets/bg-audio/bg-古箫吟风曲.mp3`。用户明确指定其他音频路径时，以用户指定为准。
5. 默认输出新文件 `src/data/questions-YYMMDD-N.json`：`YYMMDD` 使用当前日期，`N` 从 1 开始取当天尚未存在的最小编号。只有用户明确要求覆盖或指定 `src/data/questions.json` 时才写入该文件。
6. 写入后运行：

   ```powershell
   python .agent/skills/generating-quiz-json/scripts/validate_quiz_json.py <生成的文件>
   ```

   校验失败时逐项修复后重新运行，不能把失败文件交付给用户。

7. 报告生成路径、题量和校验结果；不要擅自修改 Remotion 源码、音频或其他题库文件。

## 约束

- 保持 `id` 在文件内唯一，通常使用 `q1`、`q2` 递增。
- `answerIndex` 必须落在选项数组范围内；不要把 A/B/C/D 字母写入该字段。
- 题干不得依赖图片、外部上下文或只有多个答案才成立的措辞。
- 选项顺序应自然变化，避免正确答案总在同一位置。
- 不把 Markdown 代码围栏写进 JSON；使用 `json.dump(..., ensure_ascii=False, indent=2)` 或等价格式保存。
- 需要覆盖已有文件时，先读取并保留用户未要求改变的字段，再运行校验器。
- 背景音乐目录是 `public/assets/bg-audio/`；新增背景音乐文件应放在此目录，避免散落到其他资源目录。

## 参考资料

- 详细字段和默认值见 [references/quiz-data-schema.md](references/quiz-data-schema.md)。
- 结构校验由 `scripts/validate_quiz_json.py` 执行，不替代事实核查。
