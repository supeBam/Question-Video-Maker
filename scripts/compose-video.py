#!/usr/bin/env python3
"""合成「国学对谈」完整视频：画像全屏 + 说话人切换 + 分色字幕 + 配音。

画面逻辑：
  - 庄子说话 → 庄子画像全屏铺满
  - 曾国藩说话 → 曾国藩画像全屏铺满
  - 旁白（片头/片尾）→ 两张画像上下合并全屏

用法：
    .venv-asr/bin/python scripts/compose-video.py [--data=src/data/dialogue-01.json]

期号从 JSON 的 label 读；画像 / 颜色等视觉配置留在本脚本（庄子×曾国藩固定 IP）。
"""
import json
import os
import re
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

OUT = "out"
PORTRAIT_ZHUANGZI = "public/assets/portraits/庄子.png"   # 庄子画像
PORTRAIT_ZENGGUOFAN = "public/assets/portraits/曾国藩.png" # 曾国藩画像
TMP = os.path.join(OUT, "_compose_tmp")
DEFAULT_DATA = "src/data/dialogue-01.json"

COLORS = {
    "旁白": (255, 255, 255),
    "庄子": (232, 201, 122),   # 淡金
    "曾国藩": (127, 181, 184), # 淡青
}
FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT_SIZE = 58
W, H = 1080, 1920
MARGIN_X = 60
SUBTITLE_TOP = 1460
VOLUME = 1.8


def run(cmd):
    subprocess.run(cmd, check=True)


def parse_srt(path):
    with open(path, encoding="utf-8") as f:
        content = f.read()
    out = []
    for b in re.split(r"\n\s*\n", content.strip()):
        lines = b.strip().split("\n")
        if len(lines) < 2:
            continue
        m = re.match(r"(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)", lines[1])
        if not m:
            continue
        h1, m1, s1, ms1, h2, m2, s2, ms2 = map(int, m.groups())
        start = ((h1 * 60 + m1) * 60 + s1) * 1000 + ms1
        end = ((h2 * 60 + m2) * 60 + s2) * 1000 + ms2
        out.append((start, end, " ".join(lines[2:])))
    return out


def fullscreen(path, size):
    """画像缩放到覆盖 size，水平居中、垂直顶部对齐裁切（保住头部，身体向下延伸）"""
    img = Image.open(path).convert("RGB")
    w, h = size
    ratio = max(w / img.width, h / img.height)
    nw, nh = int(img.width * ratio), int(img.height * ratio)
    img = img.resize((nw, nh), Image.LANCZOS)
    left = (nw - w) // 2
    top = 0  # 顶部对齐，保住头部
    return img.crop((left, top, left + w, top + h))


def wrap_text(text, font, max_width):
    lines, cur = [], ""
    for ch in text:
        if font.getbbox(cur + ch)[2] <= max_width:
            cur += ch
        else:
            lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    return lines


def draw_subtitle(img, role, text):
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT_PATH, FONT_SIZE)
    lines = wrap_text(text, font, W - 2 * MARGIN_X)
    line_h = FONT_SIZE + 16
    total_h = line_h * len(lines)
    y = SUBTITLE_TOP
    pad = 26
    overlay = Image.new("RGBA", (W, total_h + pad * 2), (0, 0, 0, 160))
    img.paste(overlay, (0, y - pad), overlay)
    draw = ImageDraw.Draw(img)
    for ln in lines:
        w = font.getbbox(ln)[2]
        draw.text(((W - w) // 2, y), ln, font=font, fill=COLORS[role])
        y += line_h


def main():
    data_path = DEFAULT_DATA
    for a in sys.argv[1:]:
        if a.startswith("--data="):
            data_path = a[len("--data="):]
    with open(data_path, encoding="utf-8") as f:
        data = json.load(f)
    label = data["label"]
    roles = list(data["voices"].keys())

    os.makedirs(TMP, exist_ok=True)

    # 三张底图：庄子全屏 / 曾国藩全屏 / 合并全屏
    zhuangzi_full = fullscreen(PORTRAIT_ZHUANGZI, (W, H))
    zengguofan_full = fullscreen(PORTRAIT_ZENGGUOFAN, (W, H))
    merged = Image.new("RGB", (W, H))
    merged.paste(fullscreen(PORTRAIT_ZHUANGZI, (W, H // 2)), (0, 0))
    merged.paste(fullscreen(PORTRAIT_ZENGGUOFAN, (W, H // 2)), (0, H // 2))
    base_map = {"庄子": zhuangzi_full, "曾国藩": zengguofan_full, "旁白": merged}

    sentences = []
    for role in roles:
        srt = os.path.join(OUT, f"{label}-{role}-minimax.srt")
        for start, end, text in parse_srt(srt):
            sentences.append((role, start, end, text))
    sentences.sort(key=lambda x: x[1])

    frames = []
    for i, (role, start, end, text) in enumerate(sentences):
        img = base_map[role].copy()
        draw_subtitle(img, role, text)
        fp = os.path.join(TMP, f"f{i:02d}.png")
        img.save(fp)
        if i + 1 < len(sentences):
            dur = (sentences[i + 1][1] - start) / 1000.0
        else:
            dur = (end - start) / 1000.0
        frames.append((fp, dur))
        print(f"帧 {i+1}/{len(sentences)} [{role}] {dur:.1f}s", flush=True)

    inputs = []
    for fp, dur in frames:
        inputs += ["-loop", "1", "-t", f"{dur:.3f}", "-i", fp]
    for role in roles:
        inputs += ["-i", os.path.join(OUT, f"{label}-{role}-minimax.mp3")]

    n = len(frames)
    concat_in = "".join(f"[{i}:v]" for i in range(n))
    amix_in = "".join(f"[{n + j}:a]" for j in range(len(roles)))
    fc = (
        f"{concat_in}concat=n={n}:v=1:a=0[v];"
        f"{amix_in}amix=inputs={len(roles)}:duration=longest:normalize=0,volume={VOLUME}[a]"
    )
    out_mp4 = os.path.join(OUT, f"{label}-成片.mp4")
    cmd = ["ffmpeg", "-y", "-v", "error", *inputs,
           "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
           "-c:v", "libx264", "-preset", "medium", "-crf", "20",
           "-pix_fmt", "yuv420p", "-r", "30",
           "-c:a", "aac", "-b:a", "192k", "-shortest", out_mp4]
    run(cmd)
    print(f"成片: {out_mp4}", flush=True)


if __name__ == "__main__":
    main()
