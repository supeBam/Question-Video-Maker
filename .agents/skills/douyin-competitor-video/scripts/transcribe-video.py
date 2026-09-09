#!/usr/bin/env python3
"""把视频/音频转写成带时间戳的中文文案（faster-whisper 本地 ASR）。

用法:
    .venv-asr/bin/python .agents/skills/douyin-competitor-video/scripts/transcribe-video.py <音频或视频路径> [模型名]

模型名可选: tiny / base / small / medium / large（默认 small，中文够用；
            文言文/生僻字多的视频建议 medium，更准但慢 3-5 倍）。
输出: 与源文件同目录的 <同名>.md（带时间戳）和 <同名>.txt（纯文本）。

依赖: faster-whisper（见 SKILL.md「前置依赖」）。
模型缓存: 默认写到 <当前目录>/.hf-cache（避开 ~/.cache 的沙箱限制），
          可用环境变量 HF_HOME 覆盖。
"""
import os
import sys

# 模型缓存默认 ~/.cache/huggingface 可能被沙箱拒绝；未显式设置时落到 cwd/.hf-cache
if not os.environ.get("HF_HOME"):
    os.environ["HF_HOME"] = os.path.join(os.getcwd(), ".hf-cache")

from faster_whisper import WhisperModel


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else "small"
    base = os.path.splitext(src)[0]

    print(f"HF_HOME={os.environ['HF_HOME']}", flush=True)
    print(f"加载模型 {model_name} ...", flush=True)
    model = WhisperModel(model_name, device="cpu", compute_type="int8")

    print(f"转写中: {src}", flush=True)
    segments, info = model.transcribe(src, language="zh", vad_filter=True, beam_size=5)

    def ts(s):
        m, sec = int(s // 60), int(s % 60)
        return f"{m:02d}:{sec:02d}"

    md = [
        f"# 转写结果 · {os.path.basename(src)}",
        "",
        f"> 模型 {model_name} · 语言 zh · 时长 {info.duration:.1f}s",
        "",
    ]
    txt = []
    for seg in segments:
        t = seg.text.strip()
        md.append(f"[{ts(seg.start)}-{ts(seg.end)}] {t}")
        txt.append(t)

    with open(base + ".md", "w", encoding="utf-8") as f:
        f.write("\n".join(md) + "\n")
    with open(base + ".txt", "w", encoding="utf-8") as f:
        f.write("\n".join(txt) + "\n")

    print(f"完成: {base}.md / {base}.txt", flush=True)


if __name__ == "__main__":
    main()
