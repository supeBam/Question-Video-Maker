# 生成题库 JSON Skill 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 创建项目专属 skill，根据用户要求生成完整、可验证且默认不覆盖当前题库的 `QuizData` JSON。

**架构：** `SKILL.md` 负责编排需求澄清、内容生成、命名和验证；schema 参考文件提供项目约束；独立 Python 脚本执行确定性结构校验；测试通过命令行调用验证合法与非法输入。

**技术栈：** Markdown、YAML、Python 3、JSON、Node.js 测试。

---

### 任务 1：初始化 skill

**文件：**
- 创建：`.agent/skills/generating-quiz-json/SKILL.md`
- 创建：`.agent/skills/generating-quiz-json/agents/openai.yaml`
- 创建：`.agent/skills/generating-quiz-json/references/`
- 创建：`.agent/skills/generating-quiz-json/scripts/`

- [ ] 使用 `init_skill.py` 创建标准目录和界面元数据。
- [ ] 删除生成模板中的占位内容，仅保留实际需要的目录。

### 任务 2：测试并实现 JSON 校验器

**文件：**
- 创建：`.agent/skills/generating-quiz-json/tests/test_validate_quiz_json.py`
- 创建：`.agent/skills/generating-quiz-json/scripts/validate_quiz_json.py`

- [ ] 先编写测试，覆盖合法文件、缺失字段、重复题号、答案越界和非法参数。
- [ ] 运行 `python -m unittest discover -s .agent/skills/generating-quiz-json/tests -v`，确认因模块尚不存在而失败。
- [ ] 实现最小校验器并再次运行测试，要求全部通过。

### 任务 3：编写 skill 和 schema 参考

**文件：**
- 修改：`.agent/skills/generating-quiz-json/SKILL.md`
- 创建：`.agent/skills/generating-quiz-json/references/quiz-data-schema.md`

- [ ] 写明默认 5 题、完整文件输出、默认新建日期编号文件、显式覆盖规则、事实准确性和验证流程。
- [ ] 记录所有字段、类型、范围、默认继承策略和命名算法。
- [ ] 确保 skill 正文简洁，详细 schema 只保留在参考文件。

### 任务 4：验证 skill

- [ ] 运行 `quick_validate.py .agent/skills/generating-quiz-json`。
- [ ] 使用 skill 生成一份 5 题示例，运行校验器后删除测试产物。
- [ ] 运行 `npm test`。
- [ ] 检查 Git diff，确认没有缓存、临时 JSON 或构建产物。
