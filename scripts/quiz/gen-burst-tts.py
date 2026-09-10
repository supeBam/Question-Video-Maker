#!/usr/bin/env python3
"""用 MiniMax TTS 合成「爆款快闪」题型题库的口播配音。

适用场景：题库 timing.pacing = "burst"，追求"一键出片"——不再依赖用户去剪映里手工配音，
由本脚本直接读题库 JSON → 拼接每道题的三段朗读文本（题干 / 答案 / 一句真相）→
按"题号 × 段"增量调用 MiniMax → ffprobe 实测时长 → 写到项目约定的路径

    public/assets/tts/{series}-{episodeLabel}/{questionId}-question.mp3
    public/assets/tts/{series}-{episodeLabel}/{questionId}-answer.mp3
    public/assets/tts/{series}-{episodeLabel}/{questionId}-punchline.mp3   （仅选择题有）

路径与 src/questionVoiceTracks.ts → getQuestionVoiceTracks() 完全对齐，Remotion 渲染时
QuestionVoiceTracks 组件会按这套约定读 mp3，无需改 React 代码。

增量缓存（同 scripts/dialogue/gen-minimax-tts.py）：
    指纹 = model + voice_id + speed + text，任一变化即视为新句子。
    缓存目录：src/data/.tts-cache/（gitignored，重复跑不重复扣费）

实测时长兜底（视频时间轴）：
    每段音频合成后用 ffprobe 实测毫秒时长，写到
        out/{videoLabel}-audio-measurements.json
    buildTimeline 看到这个文件即按实测时长推算每题 present/reveal/pause 段；
    没有这个文件时回落到字/秒估算（timing.ttsWordsPerSecond），保持现有行为兼容。

用法：
    .venv-asr/bin/python scripts/quiz/gen-burst-tts.py \\
        --data=src/data/questions-260903-1.json \\
        --video-label=成语-第06期

可选参数：
    --voice-stem=磁性男声       题干音色（缺省）
    --voice-answer=情感女声     答案音色（缺省；让"题干→答案"听感有切换）
    --voice-punchline=磁性男声  一句真相音色（缺省同题干；也可单独指定）
    --speed-stem=1.0            题干语速
    --speed-answer=1.0          答案语速
    --speed-punchline=1.05      一句真相比正常略快（更利落）
    --out-dir=public/assets/tts  音频输出根目录（默认；与 src/questionVoiceTracks.ts 对齐）
    --cache-dir=src/data/.tts-cache  增量缓存目录

依赖：项目根目录 .minimax.key（MiniMax API key，一行）；ffmpeg/ffprobe 在 PATH。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import requests

API = "https://api.minimax.cn/v1/t2a_v2"
MODEL = "speech-2.8-hd"
SAMPLE_RATE = 32000
BITRATE = 128000

# ── 缺省音色：合规 MiniMax 公共音色，不克隆任何真实名人 ─────────────────
# 选题理由：
#   - 磁性男声：稳重、有"老讲师"感，适合题干这种"陈述事实"的内容
#   - 情感女声：清亮、节奏感强，适合揭晓答案的"播报"场景
#   - 题干→真相用同一音色（男声），让"题干段"与"答案段"形成更明显的音色切换（男→女→男）
DEFAULT_VOICE_STEM = "male-qn-qingse"      # 磁性男声（稳重）
DEFAULT_VOICE_ANSWER = "female-shaonv"       # 情感女声（清亮）
DEFAULT_VOICE_PUNCHLINE = "male-qn-qingse" # 磁性男声（与题干一致）

DEFAULT_SPEED_STEM = 1.0
DEFAULT_SPEED_ANSWER = 1.0
DEFAULT_SPEED_PUNCHLINE = 1.05

# 一句真相后到片尾的停顿秒数（写入 measurements 时给 buildTimeline 用）
PAUSE_AFTER_PUNCHLINE_SECONDS = 0.6

# 题干朗读前缀（让口播更自然，避免机械感）
STEM_PREFIX = ""
# 答案朗读前缀
ANSWER_PREFIX_CHOICE = "正确答案是，"
ANSWER_PREFIX_FILL = ""

# ── 路径工具 ─────────────────────────────────────────────

def project_root() -> Path:
    """脚本位于 scripts/quiz/gen-burst-tts.py → 项目根 = 上两级"""
    return Path(__file__).resolve().parent.parent.parent


def get_api_key() -> str:
    key_file = project_root() / ".minimax.key"
    if not key_file.exists():
        raise RuntimeError(
            "未找到 MiniMax API key：请在项目根目录创建 .minimax.key 文件（内容为 key，一行）"
        )
    key = key_file.read_text(encoding="utf-8").strip()
    if not key:
        raise RuntimeError(".minimax.key 为空")
    return key


def run(cmd: list[str]) -> None:
    """运行外部命令，失败抛出"""
    subprocess.run(cmd, check=True)


def ffprobe_duration_ms(path: Path) -> float:
    """ffprobe 实测 mp3 时长（毫秒）"""
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(r.stdout.strip()) * 1000


# ── 缓存与合成 ─────────────────────────────────────────────

def cache_key(voice_id: str, speed: float, text: str) -> str:
    raw = f"{MODEL}|{voice_id}|{speed}|{text}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def synth_one(
    api_key: str,
    text: str,
    voice_id: str,
    speed: float,
    out_path: Path,
    cache_dir: Path,
) -> tuple[Path, bool]:
    """合成一句文本。

    返回 (最终 mp3 路径, 是否命中缓存)。
    - 命中缓存：零 API 调用，秒级复用
    - 未命中：调 MiniMax t2a_v2 → 写缓存 → 落 out_path
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    ck = cache_key(voice_id, speed, text)
    cache_file = cache_dir / f"{ck}.mp3"
    cache_dir.mkdir(parents=True, exist_ok=True)

    if cache_file.exists() and cache_file.stat().st_size > 0:
        shutil.copyfile(cache_file, out_path)
        return out_path, True

    payload = {
        "model": MODEL,
        "text": text,
        "stream": False,
        "voice_setting": {"voice_id": voice_id, "speed": speed, "vol": 1.0, "pitch": 0},
        "audio_setting": {
            "sample_rate": SAMPLE_RATE,
            "bitrate": BITRATE,
            "format": "mp3",
            "channel": 1,
        },
        "output_format": "hex",
    }
    last_err = None
    for attempt in range(8):  # 限流（RPM=1002）自动退避重试
        try:
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
                cache_file.write_bytes(audio)
                shutil.copyfile(cache_file, out_path)
                return out_path, False
            if code == 1002:  # rate limit exceeded
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


# ── 题库解析 ─────────────────────────────────────────────

def build_segments(data: dict) -> list[dict]:
    """把题库展平成 (questionId, segment, text, voice_id, speed) 列表。

    segment 取值：'question' / 'answer' / 'punchline'
    """
    pacing = data.get("timing", {}).get("pacing", "classic")
    if pacing != "burst":
        print(f"[警告] pacing={pacing}（非 burst），仍会合成但视频时间轴兜底可能不生效", flush=True)

    voices = data.get("tts", {}).get("voices", {})
    voice_stem = voices.get("stem", DEFAULT_VOICE_STEM)
    voice_answer = voices.get("answer", DEFAULT_VOICE_ANSWER)
    voice_punchline = voices.get("punchline", voice_stem)  # 缺省同题干

    speeds = data.get("tts", {}).get("speeds", {})
    speed_stem = speeds.get("stem", DEFAULT_SPEED_STEM)
    speed_answer = speeds.get("answer", DEFAULT_SPEED_ANSWER)
    speed_punchline = speeds.get("punchline", DEFAULT_SPEED_PUNCHLINE)

    segs = []
    for q in data["questions"]:
        qid = q["id"]
        # 1) 题干（清除 \n，避免读出"换行"）
        stem_text = q["stem"].replace("\n", "，")
        segs.append({
            "qid": qid,
            "segment": "question",
            "text": STEM_PREFIX + stem_text,
            "voice": voice_stem,
            "speed": speed_stem,
        })
        # 2) 答案（选择题 vs 填空题朗读模板不同）
        if q.get("type") == "fill":
            ans_text = ANSWER_PREFIX_FILL + q["answer"]
        else:
            # 选择题：念出"正确答案：A. xxx"——与 SRT 字幕答案行一致
            letters = "ABCDEFG"
            ai = q["answerIndex"]
            letter = letters[ai] if ai < len(letters) else str(ai)
            ans_text = f"{ANSWER_PREFIX_CHOICE}{letter}，{q['options'][ai]}"
        segs.append({
            "qid": qid,
            "segment": "answer",
            "text": ans_text,
            "voice": voice_answer,
            "speed": speed_answer,
        })
        # 3) 一句真相（仅选择题且有 punchline 字段）
        #    注：BurstScene 现在 hasPunchline=false 不再播这段，
        #    mp3 仍生成，留给未来"题后一句真相口播"场景。
        if q.get("type") != "fill" and q.get("punchline"):
            segs.append({
                "qid": qid,
                "segment": "punchline",
                "text": q["punchline"],
                "voice": voice_punchline,
                "speed": speed_punchline,
            })

    # 4) 片尾口播钩子（如「你全对了吗？评论区告诉我。点赞收藏，考考孩子。」）
    #    缺省音色同题干（磁性男声）；用 tts.voices.outro 可覆盖。
    outro_text = (data.get("outro", {}) or {}).get("hook", "").strip()
    if outro_text:
        voice_outro = voices.get("outro", voice_stem)
        speed_outro = speeds.get("outro", speeds.get("stem", DEFAULT_SPEED_STEM))
        segs.append({
            "qid": "__outro__",
            "segment": "outro",
            "text": outro_text,
            "voice": voice_outro,
            "speed": speed_outro,
        })
    return segs


# ── 主流程 ─────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="MiniMax TTS 合成爆款快闪题库配音")
    parser.add_argument("--data", required=True, help="题库 JSON 路径")
    parser.add_argument("--video-label", help="视频期号标签（写 measurements 文件名用），缺省取 episodeLabel")
    parser.add_argument("--out-dir", default="public/assets/tts", help="音频输出根目录")
    parser.add_argument("--cache-dir", default="src/data/.tts-cache", help="增量缓存目录")
    parser.add_argument("--measurements-out", help="自定义 measurements 输出路径")
    parser.add_argument(
        "--voice-stem", default=os.environ.get("MM_VOICE_STEM", DEFAULT_VOICE_STEM),
        help=f"题干音色（缺省 {DEFAULT_VOICE_STEM}）",
    )
    parser.add_argument(
        "--voice-answer", default=os.environ.get("MM_VOICE_ANSWER", DEFAULT_VOICE_ANSWER),
        help=f"答案音色（缺省 {DEFAULT_VOICE_ANSWER}）",
    )
    parser.add_argument(
        "--voice-punchline", default=os.environ.get("MM_VOICE_PUNCHLINE"),
        help=f"一句真相音色（缺省同题干）",
    )
    parser.add_argument("--speed-stem", type=float, default=DEFAULT_SPEED_STEM)
    parser.add_argument("--speed-answer", type=float, default=DEFAULT_SPEED_ANSWER)
    parser.add_argument("--speed-punchline", type=float, default=DEFAULT_SPEED_PUNCHLINE)
    args = parser.parse_args()

    # 真实缺省值：--voice-punchline 缺省回落到 --voice-stem
    if not args.voice_punchline:
        args.voice_punchline = args.voice_stem

    api_key = get_api_key()
    project_root_path = project_root()
    if Path.cwd() != project_root_path:
        os.chdir(project_root_path)

    data_path = Path(args.data)
    if not data_path.is_absolute():
        data_path = project_root_path / data_path
    data = json.loads(data_path.read_text(encoding="utf-8"))

    series = data["meta"]["series"].strip()
    episode_label = data["meta"]["episodeLabel"].replace(" ", "")
    video_label = args.video_label or episode_label
    series_dir_name = f"{series}-{episode_label}"  # 与 src/questionVoiceTracks.ts 对齐

    out_root = Path(args.out_dir)
    if not out_root.is_absolute():
        out_root = project_root_path / out_root
    cache_dir = Path(args.cache_dir)
    if not cache_dir.is_absolute():
        cache_dir = project_root_path / cache_dir

    series_out_dir = out_root / series_dir_name
    print(f"题库：{data_path.relative_to(project_root_path)}")
    print(f"系列目录：{series_out_dir.relative_to(project_root_path)}")
    print(f"音色：题干={args.voice_stem} / 答案={args.voice_answer} / 真相={args.voice_punchline}")
    print(f"语速：题干={args.speed_stem} / 答案={args.speed_answer} / 真相={args.speed_punchline}\n")

    # 把 CLI 参数包装成 build_segments 期望的题库 tts 结构（不写回原题库）
    data_for_segments = {
        **data,
        "tts": {
            "voices": {
                "stem": args.voice_stem,
                "answer": args.voice_answer,
                "punchline": args.voice_punchline,
            },
            "speeds": {
                "stem": args.speed_stem,
                "answer": args.speed_answer,
                "punchline": args.speed_punchline,
            },
        },
    }
    segments = build_segments(data_for_segments)
    print(f"待合成：{len(segments)} 段（{len(data['questions'])} 道题）\n")

    measurements: dict[str, dict[str, float]] = {}  # {qid: {segment: ms}}
    hit = miss = 0

    for i, seg in enumerate(segments, 1):
        mp3_path = series_out_dir / f"{seg['qid']}-{seg['segment']}.mp3"
        try:
            out, cached = synth_one(
                api_key, seg["text"], seg["voice"], seg["speed"],
                mp3_path, cache_dir,
            )
        except Exception as e:
            print(f"[{i}/{len(segments)}] {seg['qid']}-{seg['segment']} 失败：{e}", file=sys.stderr)
            return 1

        ms = ffprobe_duration_ms(out)
        measurements.setdefault(seg["qid"], {})[seg["segment"]] = ms
        if cached:
            hit += 1
        else:
            miss += 1
        tag = "缓存" if cached else "新合"
        print(f"[{i}/{len(segments)}] {seg['qid']}-{seg['segment']:<10} "
              f"{ms/1000:.2f}s  {tag}  {seg['text'][:24]}{'…' if len(seg['text']) > 24 else ''}",
              flush=True)

    # 写 measurements：给 buildTimeline 当兜底用
    measurements_path = (
        Path(args.measurements_out) if args.measurements_out
        else project_root_path / "out" / f"{video_label}-audio-measurements.json"
    )
    measurements_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 2,
        "model": MODEL,
        "series": series,
        "episodeLabel": episode_label,
        "videoLabel": video_label,
        "seriesDir": series_dir_name,
        "fps": data["timing"]["fps"],
        "measurements": measurements,  # {qid: {question|answer|punchline|outro: ms}}
        # 片尾口播钩子实测时长（毫秒）—— 若没有则不写入字段，
        # render-with-cover.mjs 收到 undefined 时不传给 buildTimeline 的 outroHookMs，
        # 视频片尾时长继续用 timing.outroSeconds。
        "outroHookMs": measurements.get("__outro__", {}).get("outro"),
    }
    measurements_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"\n──── 完成 ────")
    print(f"音频：{series_out_dir.relative_to(project_root_path)} ({len(segments)} 段)")
    print(f"实测：{measurements_path.relative_to(project_root_path)}")
    print(f"合成：缓存 {hit} + 新合 {miss} = {hit + miss}")
    return 0


if __name__ == "__main__":
    sys.exit(main())