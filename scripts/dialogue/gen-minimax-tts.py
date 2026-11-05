#!/usr/bin/env python3
"""用 MiniMax 官方 TTS（t2a_v2）合成「国学对谈」分角色配音 + 对齐 SRT（增量缓存版）。

流程：读对白 JSON → 逐句查增量缓存（指纹 = 模型+音色+语速+文本）→ 命中直接复用，
     未命中的才调 MiniMax 合成并写入缓存 → ffprobe 测实际时长 → 重算时间轴
     → 静音对齐拼接每个角色完整音轨 → 重写 SRT。

用法：
    .venv-asr/bin/python scripts/dialogue/gen-minimax-tts.py [--data=src/data/dialogue/dialogue-03.json]

对白数据（期号 / 音色 / 台词 / 语速）全部在 JSON 里，换一期只改 --data 指向的新 JSON。
合成自带增量缓存：改一句只重合成一句，换音色只重跑该角色，重复跑不重复扣费。
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from collections import defaultdict

import requests

API = "https://api.minimax.cn/v1/t2a_v2"
MODEL = "speech-2.8-hd"
OUT = "out"
TMP = os.path.join(OUT, "_mm_tts_tmp")
CACHE = "src/data/dialogue/.tts-cache"  # 增量缓存（gitignored，勿提交）
GAP_MS = 600  # 句间停顿
DEFAULT_DATA = "src/data/dialogue/dialogue-03.json"


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


def cache_key(voice_id, speed, text):
    """增量缓存指纹：模型 + 音色 + 语速 + 文本，任一变化即视为新句子"""
    raw = f"{MODEL}|{voice_id}|{speed}|{text}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def synth(api_key, voices, speeds, role, text, idx):
    """合成一句。返回 (mp3路径, 是否命中缓存)。命中缓存则零 API 消耗。"""
    mp3 = os.path.join(TMP, f"l{idx:02d}.mp3")
    ck = cache_key(voices[role], speeds.get(role, 1.0), text)
    cache_file = os.path.join(CACHE, f"{ck}.mp3")
    if os.path.exists(cache_file) and os.path.getsize(cache_file) > 0:
        shutil.copyfile(cache_file, mp3)
        return mp3, True

    payload = {
        "model": MODEL,
        "text": text,
        "stream": False,
        "voice_setting": {"voice_id": voices[role], "speed": speeds.get(role, 1.0), "vol": 1.0, "pitch": 0},
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
            audio = bytes.fromhex(data["data"]["audio"])
            os.makedirs(CACHE, exist_ok=True)
            with open(cache_file, "wb") as f:
                f.write(audio)
            shutil.copyfile(cache_file, mp3)
            return mp3, False
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
    gap_ms = GAP_MS
    for a in sys.argv[1:]:
        if a.startswith("--data="):
            data_path = a[len("--data="):]
        elif a.startswith("--gap-ms="):
            gap_ms = int(a[len("--gap-ms="):])

    data = load_data(data_path)
    label = data["label"]
    voices = data["voices"]
    speeds = data.get("speeds", {})  # 可选：按角色调语速，如 {"旁白": 1.15}
    # 每句 structure：角色 / 字幕文本 / 配音文本（可选 tts 字段，缺省用 text）
    lines = [(ln["role"], ln["text"], ln.get("tts", ln["text"])) for ln in data["lines"]]

    os.makedirs(TMP, exist_ok=True)
    durations = []
    hit_count = 0
    for i, (role, sub_text, tts_text) in enumerate(lines):
        mp3, hit = synth(api_key, voices, speeds, role, tts_text, i)
        hit_count += 1 if hit else 0
        wav = os.path.join(TMP, f"l{i:02d}.wav")
        run(["ffmpeg", "-y", "-v", "error", "-i", mp3, "-ac", "1", "-ar", "44100", wav])
        d = duration_ms(wav)
        durations.append(d)
        tag = "缓存复用" if hit else "新合成"
        print(f"[{i+1}/{len(lines)}] {role} {d/1000:.1f}s（{tag}）", flush=True)

    timeline = []
    cur = 0
    for d in durations:
        timeline.append((cur, cur + int(d)))
        cur += int(d) + gap_ms

    by_role = defaultdict(list)
    for i, (role, _sub, _tts) in enumerate(lines):
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
    print(f"增量合成：{len(lines)} 句 = 缓存复用 {hit_count} + 新合成 {len(lines) - hit_count}", flush=True)


if __name__ == "__main__":
    main()
