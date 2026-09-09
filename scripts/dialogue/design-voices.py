#!/usr/bin/env python3
"""用 MiniMax「音色设计」API 定制庄子 / 曾国藩 / 旁白三个专属音色。

输入音色描述（prompt）+ 试听文本，生成定制 voice_id，并保存试听音频供确认。

用法：
    MINIMAX_API_KEY=sk-xxx .venv-asr/bin/python scripts/design-voices.py
"""
import os
import requests

API = "https://api.minimax.cn/v1/voice_design"
OUT = "out"


def get_api_key():
    """从项目根目录 .minimax.key 文件读取 MiniMax API key（gitignored，不进 git）"""
    key_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".minimax.key")
    if os.path.exists(key_file):
        with open(key_file, encoding="utf-8") as f:
            key = f.read().strip()
        if key:
            return key
    raise RuntimeError(
        "未找到 MiniMax API key：请在项目根目录创建 .minimax.key 文件（内容为 key，一行）"
    )

VOICES = [
    ("王阳明",
     "一位明代心学宗师的中年男声，声音沉稳笃定、通透平和，有龙场悟道后的豁达与直指人心的力量，"
     "说话不疾不徐、字字有分量，像一位打过仗、开过讲席的大儒。标准普通话，中年男声。",
     "知而不行，只是未知。破山中贼易，破心中贼难。"),
    ("孔子",
     "一位温而厉的万世师表长者，声音温厚平和、循循善诱，威而不猛，"
     "如春风化雨又自带庄重，诲人不倦。标准普通话，年长男声。",
     "学而时习之，不亦说乎？君子欲讷于言而敏于行。"),
]


def main():
    api_key = get_api_key()
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    for name, prompt, preview in VOICES:
        r = requests.post(API, headers=headers,
                          json={"prompt": prompt, "preview_text": preview}, timeout=120)
        data = r.json()
        if data.get("base_resp", {}).get("status_code") != 0:
            print(f"❌ {name} 设计失败: {data.get('base_resp')}", flush=True)
            continue
        voice_id = data["voice_id"]
        print(f"✅ {name}: {voice_id}", flush=True)
        # 保存试听音频
        trial = data.get("trial_audio")
        if trial:
            path = os.path.join(OUT, f"试听-{name}.mp3")
            with open(path, "wb") as f:
                f.write(bytes.fromhex(trial))
            print(f"   试听: {path}", flush=True)


if __name__ == "__main__":
    main()
