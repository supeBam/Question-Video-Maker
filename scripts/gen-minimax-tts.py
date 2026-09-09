#!/usr/bin/env python3
"""用 MiniMax 官方 TTS（t2a_v2）合成「国学对谈」分角色配音 + 对齐 SRT。

流程：读对白 JSON → MiniMax 逐句合成 → ffprobe 测实际时长 → 按「实际时长+句间隔」重算时间轴
     → 静音对齐拼接出每个角色一条完整音轨 → 用新时间轴重写 SRT。

用法：
    MINIMAX_API_KEY=sk-xxx .venv-asr/bin/python scripts/gen-minimax-tts.py [--data=src/data/dialogue-01.json]

对白数据（期号 / 音色 / 台词）全部在 JSON 里，换一期只改 --data 指向的新 JSON，不碰本脚本。
"""
import json
import os
import subprocess
import sys
import time
from collections import defaultdict

import requests

API = "https://api.minimax.cn/v1/t2a_v2"
MODEL = "speech-2.8-hd"
OUT = "out"
TMP = os.path.join(OUT, "_mm_tts_tmp")
GAP_MS = 600  # 句间停顿
DEFAULT_DATA = "src/data/dialogue/dialogue-01.json"


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


def load_data(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def run(cmd):
    subprocess.run(cmd, check=True)


def duration_ms(path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True, check=True,
    )
    return float(r.stdout.strip()) * 1000


def gen_silence(ms, path):
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi",
         "-i", "anullsrc=r=44100:cl=mono", "-t", f"{ms/1000:.3f}", path])


def ms_to_srt(ms):
    h = int(ms // 3600000)
    m = int((ms % 3600000) // 60000)
    s = int((ms % 60000) // 1000)
    milli = int(ms % 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{milli:03d}"


def synth(api_key, voices, role, text, idx):
    mp3 = os.path.join(TMP, f"l{idx:02d}.mp3")
    payload = {
        "model": MODEL,
        "text": text,
        "stream": False,
        "voice_setting": {"voice_id": voices[role], "speed": 1.0, "vol": 1.0, "pitch": 0},
        "audio_setting": {"sample_rate": 32000, "bitrate": 128000, "format": "mp3", "channel": 1},
        "output_format": "hex",
    }
    for attempt in range(8):  # 限流自动退避重试
        r = requests.post(
            API,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload, timeout=60,
        )
        r.raise_for_status()
        data = r.json()
        code = data.get("base_resp", {}).get("status_code")
        if code == 0:
            with open(mp3, "wb") as f:
                f.write(bytes.fromhex(data["data"]["audio"]))
            return mp3
        if code == 1002:  # rate limit exceeded(RPM)：等待后重试
            wait = 12 * (attempt + 1)
            print(f"  限流（RPM），{wait}s 后重试...", flush=True)
            time.sleep(wait)
            continue
        raise RuntimeError(f"MiniMax 错误: {data.get('base_resp')}")
    raise RuntimeError("限流重试次数用尽")


def main():
    api_key = get_api_key()
    data_path = DEFAULT_DATA
    for a in sys.argv[1:]:
        if a.startswith("--data="):
            data_path = a[len("--data="):]

    data = load_data(data_path)
    label = data["label"]
    voices = data["voices"]
    lines = [(ln["role"], ln["text"]) for ln in data["lines"]]

    os.makedirs(TMP, exist_ok=True)
    durations = []
    for i, (role, text) in enumerate(lines):
        mp3 = synth(api_key, voices, role, text, i)
        wav = os.path.join(TMP, f"l{i:02d}.wav")
        run(["ffmpeg", "-y", "-v", "error", "-i", mp3, "-ac", "1", "-ar", "44100", wav])
        d = duration_ms(wav)
        durations.append(d)
        print(f"[{i+1}/{len(lines)}] {role} {d/1000:.1f}s", flush=True)

    timeline = []
    cur = 0
    for d in durations:
        timeline.append((cur, cur + int(d)))
        cur += int(d) + GAP_MS

    by_role = defaultdict(list)
    for i, (role, _) in enumerate(lines):
        by_role[role].append(i)
    for role, idxs in by_role.items():
        segs = []
        prev_end = 0
        for i in idxs:
            s, e = timeline[i]
            gap = s - prev_end
            if gap > 0:
                sil = os.path.join(TMP, f"sil_{i}.wav")
                gen_silence(gap, sil)
                segs.append(sil)
            segs.append(os.path.join(TMP, f"l{i:02d}.wav"))
            prev_end = e
        listfile = os.path.join(TMP, f"list_{role}.txt")
        with open(listfile, "w", encoding="utf-8") as f:
            for sg in segs:
                f.write(f"file '{os.path.abspath(sg)}'\n")
        out_wav = os.path.join(TMP, f"{role}.wav")
        run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
             "-i", listfile, "-c", "copy", out_wav])
        out_mp3 = os.path.join(OUT, f"{label}-{role}-minimax.mp3")
        run(["ffmpeg", "-y", "-v", "error", "-i", out_wav, "-b:a", "128k", out_mp3])
        print(f"生成: {out_mp3}", flush=True)

    for role, idxs in by_role.items():
        srt_path = os.path.join(OUT, f"{label}-{role}-minimax.srt")
        blocks = []
        n = 1
        for i in idxs:
            s, e = timeline[i]
            blocks.append(f"{n}\n{ms_to_srt(s)} --> {ms_to_srt(e)}\n{lines[i][1]}\n")
            n += 1
        with open(srt_path, "w", encoding="utf-8") as f:
            f.write("\n".join(blocks) + "\n")
        print(f"字幕: {srt_path}", flush=True)

    print(f"总时长约 {timeline[-1][1]/1000:.1f}s", flush=True)


if __name__ == "__main__":
    main()
