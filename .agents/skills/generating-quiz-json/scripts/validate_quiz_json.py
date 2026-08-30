#!/usr/bin/env python3
"""Validate a Question-Video-Maker QuizData JSON file.

支持两种题型：
  - choice     选择题（type 缺省或 "choice"）
  - fill       填空题（万物雅称）
"""

import json
import sys
from pathlib import Path


TOP_LEVEL = {"meta", "timing", "intro", "outro", "bgm", "questions"}
VALID_TYPES = {"choice", "fill"}


def validate(data):
    errors = []

    if not isinstance(data, dict):
        return ["根节点必须是 JSON 对象"]
    missing = TOP_LEVEL - data.keys()
    errors.extend(f"缺少顶层字段: {name}" for name in sorted(missing))

    for name in ("meta", "timing", "intro", "outro", "bgm"):
        if name in data and not isinstance(data[name], dict):
            errors.append(f"{name} 必须是对象")

    questions = data.get("questions")
    if not isinstance(questions, list) or not questions:
        errors.append("questions 必须是非空数组")
        questions = []

    ids = set()
    for index, question in enumerate(questions, 1):
        prefix = f"questions[{index}]"
        if not isinstance(question, dict):
            errors.append(f"{prefix} 必须是对象")
            continue

        qid = question.get("id")
        if not isinstance(qid, str) or not qid.strip():
            errors.append(f"{prefix}.id 必须是非空字符串")
        elif qid in ids:
            errors.append(f"{prefix}.id 必须唯一: {qid}")
        else:
            ids.add(qid)

        qtype = question.get("type") or "choice"
        if qtype not in VALID_TYPES:
            errors.append(f"{prefix}.type 必须是 choice / fill 之一，得到: {qtype!r}")
            continue

        # choice / fill 共用：stem + explanation
        if not isinstance(question.get("stem"), str) or not question["stem"].strip():
            errors.append(f"{prefix}.stem 必须是非空字符串")
        if not isinstance(question.get("explanation"), str) or not question["explanation"].strip():
            errors.append(f"{prefix}.explanation 必须是非空字符串")

        if qtype == "fill":
            if not isinstance(question.get("answer"), str) or not question["answer"].strip():
                errors.append(f"{prefix}.answer 必须是非空字符串")
            continue

        # choice：options + answerIndex
        options = question.get("options")
        if not isinstance(options, list) or not 2 <= len(options) <= 4:
            errors.append(f"{prefix}.options 必须包含 2 至 4 个选项")
        elif any(not isinstance(option, str) or not option.strip() for option in options):
            errors.append(f"{prefix}.options 不能包含空选项")
        answer = question.get("answerIndex")
        if not isinstance(answer, int) or isinstance(answer, bool):
            errors.append(f"{prefix}.answerIndex 必须是整数")
        elif isinstance(options, list) and not 0 <= answer < len(options):
            errors.append(f"{prefix}.answerIndex 越界: {answer}")

    timing = data.get("timing")
    if isinstance(timing, dict):
        pacing = timing.get("pacing")
        burst = pacing == "burst"
        if pacing not in (None, "classic", "burst"):
            errors.append(f"timing.pacing 必须是 classic 或 burst，得到: {pacing!r}")
        if not isinstance(timing.get("fps"), int) or timing.get("fps", 0) <= 0:
            errors.append("timing.fps 必须是正整数")
        if not isinstance(timing.get("outroSeconds"), (int, float)) or isinstance(timing.get("outroSeconds"), bool) or timing.get("outroSeconds", 0) <= 0:
            errors.append("timing.outroSeconds 必须是正数")
        if burst:
            # 爆款快闪模式：零片头、无倒计时、perQuestion 可省略
            if not isinstance(timing.get("introSeconds"), (int, float)) or isinstance(timing.get("introSeconds"), bool) or timing.get("introSeconds", -1) < 0:
                errors.append("timing.introSeconds 必须是非负数（burst 模式）")
            for field in ("hookSeconds", "summarySeconds"):
                if field in timing:
                    value = timing.get(field)
                    if not isinstance(value, (int, float)) or isinstance(value, bool) or value < 0:
                        errors.append(f"timing.{field} 必须是非负数（burst 模式）")
            per_question = timing.get("perQuestion")
            if per_question is not None:
                if not isinstance(per_question, dict):
                    errors.append("timing.perQuestion 必须是对象")
                else:
                    for field in ("presentSeconds", "countdownSeconds", "revealSeconds"):
                        value = per_question.get(field)
                        if not isinstance(value, (int, float)) or isinstance(value, bool) or value < 0:
                            errors.append(f"timing.perQuestion.{field} 必须是非负数（burst 模式）")
        else:
            for field in ("fps", "introSeconds", "outroSeconds", "perQuestion"):
                if field not in timing:
                    errors.append(f"timing 缺少字段: {field}")
            if not isinstance(timing.get("introSeconds"), (int, float)) or timing.get("introSeconds", 0) <= 0:
                errors.append("timing.introSeconds 必须是正数")
            per_question = timing.get("perQuestion")
            if isinstance(per_question, dict):
                for field in ("presentSeconds", "countdownSeconds", "revealSeconds"):
                    value = per_question.get(field)
                    if not isinstance(value, (int, float)) or isinstance(value, bool) or value <= 0:
                        errors.append(f"timing.perQuestion.{field} 必须是正数")

    bgm = data.get("bgm")
    if isinstance(bgm, dict):
        volume = bgm.get("volume")
        if not isinstance(volume, (int, float)) or isinstance(volume, bool) or not 0 <= volume <= 1:
            errors.append("bgm.volume 必须在 0 到 1 之间")

    return errors


def main():
    if len(sys.argv) != 2:
        print(f"用法: {Path(sys.argv[0]).name} <quiz.json>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"无法读取 JSON: {exc}", file=sys.stderr)
        return 1
    errors = validate(data)
    if errors:
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print(f"有效 QuizData: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
