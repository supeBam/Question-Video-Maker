---
name: generating-quiz-json
description: Use when the user asks to create, replace, or update this project's Chinese quiz question bank as a complete JSON file for Remotion, including topic, question count, audience, difficulty, metadata, or output filename requirements.
---

# 生成题库 JSON

根据用户要求生成项目可直接渲染的完整 `QuizData` JSON。题目内容用中文，文件使用 UTF-8 编码。

## 工作流程

1. 读取 `src/data/questions.json` 和 [references/quiz-data-schema.md](references/quiz-data-schema.md)，以当前题库作为默认配置来源。
2. 提取主题、受众、难度、题量、栏目文案和特殊限制。未指定题量时使用 10 题；仍会在用户要求含糊且会显著影响结果时只询问一个必要问题。**用户未指定主题时，不得自行推断主题，不得默认延续最近系列，也不得把题库记录中「留待下一期」的预留词当作默认选题；必须先向用户确认主题（可列出候选主题供其选择），或按用户明确点名的系列出题。**
3. 生成题目：每题只有一个无争议正确答案；选项为 2 至 4 个互斥、同类、非空文本；`answerIndex` 从 0 开始；解析说明答案依据。对不确定事实先核实，不要猜测。
4. 生成完整顶层字段：`meta`、`timing`、`intro`、`outro`、`bgm`、`questions`。用户未指定的配置继承 `src/data/questions.json`，并按实际题量更新期数、标题和计分提示。背景音乐统一从 `public/assets/bg-audio/` 选择；**答题/快闪题库默认用 `assets/bg-audio/bgm_guzheng_liqiu.mp3`、音量 `0.2`**（用户明确指定其他音频或音量时以用户指定为准）。
5. 默认输出新文件 `src/data/questions-YYMMDD-N.json`：`YYMMDD` 使用当前日期，`N` 从 1 开始取当天尚未存在的最小编号。只有用户明确要求覆盖或指定 `src/data/questions.json` 时才写入该文件。
6. 写入后运行：

   ```powershell
   python .agents/skills/generating-quiz-json/scripts/validate_quiz_json.py <生成的文件>
   ```

   校验失败时逐项修复后重新运行，不能把失败文件交付给用户。

7. 报告生成路径、题量和校验结果；不要擅自修改 Remotion 源码、音频或其他题库文件。

## 约束

- 保持 `id` 在文件内唯一，通常使用 `q1`、`q2` 递增。
- `answerIndex` 必须落在选项数组范围内；不要把 A/B/C/D 字母写入该字段。
- **answerIndex 必须分散（硬性规则，生成后自查）**：正确答案不得集中在同一选项位置。≥6 题的题库：A/B/C/D 每个位置出现 2~3 次，且不得连续 3 题同位置；<6 题的题库：至少出现 3 种不同位置。生成后统计 answerIndex 分布，不满足则调整选项顺序重排后再交付。
- 题干不得依赖图片、外部上下文或只有多个答案才成立的措辞。
- **题干与选项/答案禁止符号（硬性规则）**：题干、选项、答案文本中不得出现破折号（——/—）、方括号（【】[]）、花括号（{}）等符号；需要补充说明时用完整句子或逗号自然表达。解析 `explanation` 不受此限。
- 选项顺序应自然变化，干扰项与正确项混排，避免「正确答案总是第一个」的固定套路。
- 不把 Markdown 代码围栏写进 JSON；使用 `json.dump(..., ensure_ascii=False, indent=2)` 或等价格式保存。
- 需要覆盖已有文件时，先读取并保留用户未要求改变的字段，再运行校验器。
- 背景音乐目录是 `public/assets/bg-audio/`；新增背景音乐文件应放在此目录，避免散落到其他资源目录。
- 背景皮肤规则（`background.src`）：**选择题一律用黄色宣纸底 `assets/bg-paper.svg`；填空题（万物雅称）用青灰白底 `assets/bg-yacheng.svg`**。不指定 `background` 时组件默认即黄色宣纸底（选择题可省略该字段）。快闪模板沿用 `cloudSrc: null`、`drift: 0.04`。
- **发布话题（硬性规则）**：抖音一条视频话题最多 5 个。`publish.hashtags` 只写 2~3 个栏目垂直词（如成语栏目 `["成语","成语故事","冷知识"]`），不要塞泛流量词；抖音发布时可手动补 `#涨知识 #知识分享`，总数卡在 5 以内。脚本导出时也会自动截断到 5 个兜底（`scripts/render-with-cover.mjs`）。
- **发布标题去同质化（硬性规则）**：`publish.title`（视频号）与 `publish.douyin.title`（抖音）分别给、不共用；抖音标题用「第一题悬念句 + 轮换后缀」，挑战词后缀不得连续两期重复（如连续「答对 8 个算你牛」）。后缀从挑战式/结果承诺·段位/身份式/收藏指令/悬念式五类轮着取，段位后缀对准 `outro.scoreHints` 的段位名。详见 `docs/标题流量方法论.md`。
- 主题确认：主题必须来自用户明确指定或用户确认的选择。用户只说「出新题/新一期」而未给主题时，先向用户确认主题再动手，禁止自作主张延续最近系列、禁止把预留词当作默认选题。

## 参考资料

- 详细字段和默认值见 [references/quiz-data-schema.md](references/quiz-data-schema.md)。
- 结构校验由 `scripts/validate_quiz_json.py` 执行，不替代事实核查。
