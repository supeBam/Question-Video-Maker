# 中国朝代历史题库实施计划

> **供执行人员使用：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行。步骤使用复选框跟踪。

**目标：** 新增一期包含 5 道混合难度题目的“中国朝代历史”完整题库 JSON，并通过项目校验。

**实现方式：** 仅新增 `src/data/questions-260810-2.json`，沿用现有 `QuizData` 结构和时间配置。题目按照朝代顺序、开国人物、选官制度、政权关系、跨朝代制度辨析递进，不修改当前题库或 Remotion 源码。

**技术栈：** JSON、Python 3 题库校验器、Node.js 测试

---

### 任务 1：新增中国朝代历史题库

**文件：**
- 新建：`src/data/questions-260810-2.json`
- 参考：`src/data/questions.json`
- 参考：`.agent/skills/generating-quiz-json/references/quiz-data-schema.md`

- [x] **步骤 1：创建完整题库文件**

写入以下内容：

```json
{
  "meta": {
    "series": "中国朝代历史",
    "episode": 2,
    "episodeLabel": "第 02 期",
    "hostTag": "@每日历史小测"
  },
  "timing": {
    "fps": 30,
    "introSeconds": 5,
    "outroSeconds": 5,
    "perQuestion": {
      "presentSeconds": 2,
      "countdownSeconds": 5,
      "revealSeconds": 5.5
    }
  },
  "intro": {
    "kicker": "中国朝代历史",
    "title": "五道题\n测测你的朝代史功底",
    "subtitle": "从秦汉到明清，你能答对几道？",
    "hint": "每题 5 秒作答"
  },
  "outro": {
    "headline": "你答对了几题？",
    "scoreHints": [
      "1-2 题 · 历史刚入门",
      "3-4 题 · 朝代脉络清晰",
      "5 题 · 历史达人"
    ],
    "cta": "点赞 + 关注",
    "ctaSub": "每天一道历史常识题，明天见"
  },
  "bgm": {
    "enabled": true,
    "file": "assets/bg-audio/bg-古箫吟风曲.mp3",
    "volume": 0.22
  },
  "questions": [
    {
      "id": "q1",
      "stem": "下列朝代或历史时期，按先后顺序排列正确的是？",
      "options": [
        "东汉→西汉→秦→三国",
        "秦→西汉→东汉→三国",
        "西汉→秦→三国→东汉",
        "秦→东汉→西汉→三国"
      ],
      "answerIndex": 1,
      "explanation": "秦统一六国后，依次经历西汉、东汉，再进入三国时期，因此正确顺序是秦→西汉→东汉→三国。"
    },
    {
      "id": "q2",
      "stem": "建立明朝并定都应天府的开国皇帝是？",
      "options": ["刘邦", "李渊", "赵匡胤", "朱元璋"],
      "answerIndex": 3,
      "explanation": "1368 年，朱元璋在应天府称帝，建立明朝，年号洪武。刘邦、李渊、赵匡胤分别是西汉、唐朝和北宋的开国皇帝。"
    },
    {
      "id": "q3",
      "stem": "隋朝创立、唐朝进一步完善的选官制度是？",
      "options": ["三省六部制", "科举制", "行省制", "九品中正制"],
      "answerIndex": 1,
      "explanation": "隋朝以考试选拔官员，科举制由此创立；唐朝增加考试科目并完善相关制度，使科举制得到进一步发展。"
    },
    {
      "id": "q4",
      "stem": "由女真族建立，并先后与北宋、南宋对峙的政权是？",
      "options": ["辽", "西夏", "金", "大理"],
      "answerIndex": 2,
      "explanation": "女真族首领完颜阿骨打于 1115 年建立金朝。辽由契丹族建立，西夏由党项族建立，大理国主要位于今云南一带。"
    },
    {
      "id": "q5",
      "stem": "下列改革或制度中，出现时间最晚的是？",
      "options": ["两税法", "王安石变法", "一条鞭法", "摊丁入亩"],
      "answerIndex": 3,
      "explanation": "两税法推行于唐朝，王安石变法发生在北宋，一条鞭法推广于明朝，摊丁入亩实行于清朝雍正年间，因此摊丁入亩最晚。"
    }
  ]
}
```

- [x] **步骤 2：检查题目内容**

逐题确认：答案位置依次为 B、D、B、C、D；每题只有一个正确答案；题干不依赖外部材料；题目覆盖秦汉、隋唐、宋元、明清；解析与通行教材口径一致。

### 任务 2：验证题库

**文件：**
- 检查：`src/data/questions-260810-2.json`

- [x] **步骤 1：运行题库结构校验**

运行：

```powershell
python .agent/skills/generating-quiz-json/scripts/validate_quiz_json.py src/data/questions-260810-2.json
```

预期：退出码为 `0`，输出说明题库校验通过且包含 5 道题。

- [x] **步骤 2：运行项目测试**

运行：

```powershell
npm test
```

预期：退出码为 `0`，所有现有测试通过。

- [x] **步骤 3：检查变更范围**

运行：

```powershell
git status --short
git diff --check -- src/data/questions-260810-2.json
```

预期：本任务只新增 `src/data/questions-260810-2.json`；`git diff --check` 无输出。工作区中任务开始前已有的其他变更保持不动。

- [x] **步骤 4：提交题库**

```powershell
git add -- src/data/questions-260810-2.json
git commit -m "content: 新增中国朝代历史题库" -- src/data/questions-260810-2.json
```
