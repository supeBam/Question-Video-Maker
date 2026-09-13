#!/usr/bin/env python3
"""雅称诗意展示流旁白 TTS（MiniMax t2a_v2，增量缓存版）。

读 scroll-show JSON 的 items[].story，逐条合成旁白 mp3 到 public/assets/tts/{label}/，
ffprobe 实测时长，输出 measurements JSON（{itemId: ms}）给 ScrollShow 组件算时间轴。

用法：
    python3 scripts/quiz/gen-scroll-tts.py --data=src/data/scroll-show-260911-1.json

复用 gen-burst-tts.py 的合成核心（模型/缓存/限流重试一致），只改解析与输出：
    - 缓存目录独立（src/data/scroll-show/.tts-cache）
    - 每条 item 一个 mp3（item-{id}.mp3），放 data.tts.audioDir
    - measurements 格式 {itemId: ms}
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import time
from pathlib import Path

import requests

API = "https://api.minimax.cn/v1/t2a_v2"
MODEL = "speech-2.8-hd"
SAMPLE_RATE = 32000
BITRATE = 128000
DEFAULT_VOICE = "male-qn-qingse"  # 磁性男声（与 burst 题干一致，稳重有讲师感）
DEFAULT_SPEED = 0.92              # 中老年受众放缓
CACHE = Path("src/data/scroll-show/.tts-cache")


def project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def get_api_key() -> str:
    key_file = project_root() / ".minimax.key"
    if not key_file.exists():
        raise RuntimeError("未找到 .minimax.key")
    key = key_file.read_text(encoding="utf-8").strip()
    if not key:
        raise RuntimeError(".minimax.key 为空")
    return key


def ffprobe_duration_ms(path: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(r.stdout.strip()) * 1000


def cache_key(voice_id: str, speed: float, text: str) -> str:
    raw = f"{MODEL}|{voice_id}|{speed}|{text}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def synth_one(api_key: str, text: str, voice_id: str, speed: float,
              out_path: Path) -> tuple[Path, bool]:
    """合成一条旁白。命中缓存零调用；未命中调 MiniMax，限流自动退避重试。"""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    ck = cache_key(voice_id, speed, text)
    cache_file = CACHE / f"{ck}.mp3"
    CACHE.mkdir(parents=True, exist_ok=True)

    if cache_file.exists() and cache_file.stat().st_size > 0:
        shutil.copyfile(cache_file, out_path)
        return out_path, True

    payload = {
        "model": MODEL,
        "text": text,
        "stream": False,
        "voice_setting": {"voice_id": voice_id, "speed": speed, "vol": 1.0, "pitch": 0},
        "audio_setting": {"sample_rate": SAMPLE_RATE, "bitrate": BITRATE,
                          "format": "mp3", "channel": 1},
        "output_format": "hex",
    }
    last_err = None
    for attempt in range(8):
        try:
            r = requests.post(
                API,
                headers={"Authorization": f"Bearer {api_key}",
                         "Content-Type": "application/json"},
                json=payload, timeout=60,
            )
            r.raise_for_status()
            data = r.json()
            code = data.get("base_resp", {}).get("status_code")
            if code == 0:
                audio = bytes.fromhex(data["data"]["audio"])
                cache_file.write_bytes(audio)
                shutil.copyfile(cache_file, out_path)
                return out_path, False
            if code == 1002:
                wait = 12 * (attempt + 1)
                print(f"    [限流] RPM 超限，{wait}s 后重试...", flush=True)
                time.sleep(wait)
                continue
            raise RuntimeError(f"MiniMax 错误: {data.get('base_resp')}")
        except requests.RequestException as e:
            last_err = e
            time.sleep(5 * (attempt + 1))
            continue
    raise RuntimeError(f"MiniMax 合成失败（重试 8 次）: {last_err}")


def main() -> int:
    parser = argparse.ArgumentParser(description="雅称诗意展示流旁白 TTS")
    parser.add_argument("--data", required=True, help="scroll-show JSON 路径")
    parser.add_argument("--measurements-out", help="measurements 输出路径（缺省 out/{label}-audio-measurements.json）")
    args = parser.parse_args()

    data = json.loads(Path(args.data).read_text(encoding="utf-8"))
    label = data["meta"]["episodeLabel"]
    tts_cfg = data.get("tts", {})
    voice = tts_cfg.get("voice", DEFAULT_VOICE)
    speed = tts_cfg.get("speed", DEFAULT_SPEED)
    audio_dir = project_root() / "public" / tts_cfg.get("audioDir", f"assets/tts/{label}")

    api_key = get_api_key()
    measurements: dict[str, float] = {}
    # 片头 / 片尾口播（intro.voice / outro.voice，可选）
    for key, fname in (("intro", "item-intro.mp3"), ("outro", "item-outro.mp3")):
        voice_text = data.get(key, {}).get("voice")
        if not voice_text:
            continue
        out_path = audio_dir / fname
        _, cached = synth_one(api_key, voice_text, voice, speed, out_path)
        measurements[key] = ffprobe_duration_ms(out_path)
        print(f"  {key}  {measurements[key]/1000:.1f}s  {'(缓存)' if cached else '(新合成)'}")
    for item in data["items"]:
        out_path = audio_dir / f"item-{item['id']}.mp3"
        _, cached = synth_one(api_key, item["story"], voice, speed, out_path)
        ms = ffprobe_duration_ms(out_path)
        measurements[item["id"]] = ms
        print(f"  {item['id']} {item['aka']}  {ms/1000:.1f}s  {'(缓存)' if cached else '(新合成)'}")

    out_path = Path(args.measurements_out) if args.measurements_out else \
        project_root() / "out" / f"{label}-audio-measurements.json"
    out_path.write_text(json.dumps(measurements, ensure_ascii=False, indent=2),
                        encoding="utf-8")
    print(f"measurements → {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
