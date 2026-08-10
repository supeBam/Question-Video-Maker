import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "scripts" / "validate_quiz_json.py"


def sample():
    return {
        "meta": {"series": "测试", "episode": 1, "episodeLabel": "第 01 期", "hostTag": "@测试"},
        "timing": {"fps": 30, "introSeconds": 5, "outroSeconds": 5,
                   "perQuestion": {"presentSeconds": 2, "countdownSeconds": 5, "revealSeconds": 5.5}},
        "intro": {"kicker": "测试", "title": "五道题", "subtitle": "开始", "hint": "每题 5 秒作答"},
        "outro": {"headline": "得分", "scoreHints": ["加油"], "cta": "关注", "ctaSub": "明天见"},
        "bgm": {"enabled": False, "file": "assets/bgm.mp3", "volume": 0.22},
        "questions": [{"id": "q1", "stem": "题目？", "options": ["甲", "乙"], "answerIndex": 0, "explanation": "因为甲。"}],
    }


class ValidatorTests(unittest.TestCase):
    def run_validator(self, data):
        with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8", delete=False) as f:
            json.dump(data, f, ensure_ascii=False)
            path = f.name
        return subprocess.run([sys.executable, str(SCRIPT), path], capture_output=True, text=True)

    def test_accepts_valid_quiz_data(self):
        result = self.run_validator(sample())
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_rejects_duplicate_ids_and_answer_out_of_range(self):
        data = sample()
        data["questions"].append({**data["questions"][0], "answerIndex": 2})
        result = self.run_validator(data)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("唯一", result.stderr)
        self.assertIn("answerIndex", result.stderr)

    def test_rejects_missing_top_level_field(self):
        data = sample()
        del data["intro"]
        result = self.run_validator(data)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("intro", result.stderr)


if __name__ == "__main__":
    unittest.main()
