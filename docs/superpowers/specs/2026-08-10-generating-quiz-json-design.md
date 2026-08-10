# 生成题库 JSON Skill 设计

## 目标

创建项目专属 `generating-quiz-json` skill，根据用户给出的主题、题量、受众、难度和栏目要求，生成符合项目 `QuizData` 结构、可直接用于 Remotion 渲染的 UTF-8 JSON 文件。

## 输出策略

- 默认在 `src/data/` 新建 `questions-YYMMDD-N.json`，其中 `N` 使用当天尚未占用的最小正整数。
- 只有用户明确要求“替换当前题库”或指定 `src/data/questions.json` 时才覆盖当前题库。
- 输出完整 `QuizData`，包括 `meta`、`timing`、`intro`、`outro`、`bgm` 和 `questions`。
- 用户未指定题量时默认生成 5 题；用户明确指定题量时以用户要求为准。
- 用户未指定的片头、片尾、节奏和 BGM 字段沿用 `src/data/questions.json` 的当前值，并根据题量更新标题、期数标签与计分提示。

## Skill 结构

- `.agent/skills/generating-quiz-json/SKILL.md`：定义触发场景、需求澄清、出题、写入和验证流程。
- `.agent/skills/generating-quiz-json/references/quiz-data-schema.md`：记录字段含义、约束和默认继承规则。
- `.agent/skills/generating-quiz-json/scripts/validate_quiz_json.py`：确定性检查 JSON 语法、字段类型、题号唯一性、选项数量、答案索引、文本非空、时间参数和 BGM 音量。
- `.agent/skills/generating-quiz-json/agents/openai.yaml`：提供 skill 列表展示信息和默认调用提示。

## 内容规则

- 每题只允许一个无争议正确答案；题干和选项不得依赖未提供的图片或上下文。
- 选项保持 2 至 4 个、互斥且风格一致，`answerIndex` 从 0 开始。
- 解析必须说明正确答案成立的原因；必要时指出干扰项为何不成立。
- 不确定事实不得猜测；应先核实或向用户说明无法可靠生成该题。
- 避免题目重复、答案位置明显成规律、歧视性内容及超出用户要求的敏感主题。

## 验证

1. 使用 skill 创建一个新的示例题库文件。
2. 运行 `validate_quiz_json.py`，要求退出码为 0。
3. 构造非法文件验证校验脚本能发现缺失字段、重复题号和越界答案。
4. 运行项目现有 `npm test`。
5. 运行 skill-creator 提供的 `quick_validate.py` 检查 skill 元数据与目录命名。
