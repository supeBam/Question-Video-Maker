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
    """优先环境变量 MINIMAX_API_KEY，其次项目根目录 .minimax.key 文件（gitignored）"""
    key = os.environ.get("MINIMAX_API_KEY")
    if key:
        return key.strip()
    key_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".minimax.key")
    if os.path.exists(key_file):
        with open(key_file, encoding="utf-8") as f:
            return f.read().strip()
    raise RuntimeError(
        "未找到 MiniMax API key：请设置环境变量 MINIMAX_API_KEY，"
        "或在项目根目录创建 .minimax.key 文件（内容为 key）"
    )

VOICES = [
    ("庄子", 
     "一位通透超脱的古代道家智者老者，声音温润从容、语速平缓、语气淡然洒脱，"
     "带着看破世事的智慧和超然，像一位仙风道骨的老者在娓娓道来人生哲理。标准普通话，年长男声。",
     "顺其自然，从来不是纵欲。庖丁解牛，一把刀用了十九年，还像刚磨的。"),
    ("曾国藩",
     "一位沉稳厚重、威严庄重的清代儒臣，声音低沉浑厚、字正腔圆、语速沉稳有力，"
     "带着克己修身的严肃和历经世事的厚重感，像一位德高望重的长辈在谆谆教诲。标准普通话，中年男声。",
     "人这一生，不逼自己，成不了事。我给自己立过十二条日课，一条条逼过来。"),
    ("旁白",
     "一位浑厚大气的国学纪录片旁白解说员，声音沉稳有力、字正腔圆、富有感染力，"
     "适合古典文化纪录片的旁白叙述。标准普通话，中年男声。",
     "自律，到底是逼自己，还是放过自己？让两个最懂的人，吵一架。"),
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
