#!/usr/bin/env python3
"""合成「国学对谈」完整视频：画像全屏 + 说话人切换 + 分色字幕 + 配音。

画面逻辑：
  - 庄子说话 → 庄子画像全屏铺满
  - 曾国藩说话 → 曾国藩画像全屏铺满
  - 旁白（片头/片尾）→ 全部人物画像上下合并全屏

用法：
    .venv-asr/bin/python scripts/dialogue/compose-video.py [--data=src/data/dialogue/dialogue-03.json]

期号、画像、颜色、语速全部从 JSON 读；换人物只改 JSON，不碰本脚本。
"""
import json
import os
import re
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

OUT = "out"
TMP = os.path.join(OUT, "_compose_tmp")
DEFAULT_DATA = "src/data/dialogue/dialogue-03.json"

# 缺省画像/颜色（对白 JSON 未带 portraits/colors 字段时回退，兼容第一、二期）
DEFAULT_PORTRAITS = {
    "庄子": "public/assets/portraits/庄子.png",
    "曾国藩": "public/assets/portraits/曾国藩.png",
}
DEFAULT_COLORS = {
    "旁白": (255, 255, 255),
    "庄子": (232, 201, 122),   # 淡金
    "曾国藩": (127, 181, 184), # 淡青
    "王阳明": (232, 201, 122), # 淡金
    "孔子": (127, 181, 184),   # 淡青
}
FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT_SIZE = 58
W, H = 1080, 1920
MARGIN_X = 60
SUBTITLE_TOP = 1460
# 响度标准化（EBU R128）：不用拍脑袋的音量系数，直接锁 LUFS 目标，每期自动正确
VOICE_LUFS = -14   # 人声目标响度（流媒体标准偏上限，中老年友好）
BGM_LUFS = -34     # BGM 目标响度（恒比人声低 20dB，只垫氛围）
BGM = "public/assets/bg-audio/bg-古箫吟风曲.mp3"  # 背景音乐（古箫，文人雅谈）


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


def draw_subtitle(img, color, text):
    max_height = H - SUBTITLE_TOP - 40  # 字幕可用高度（底部留 40px 边距）
    font_size = FONT_SIZE
    font = ImageFont.truetype(FONT_PATH, font_size)
    lines = wrap_text(text, font, W - 2 * MARGIN_X)
    # 超长文本自动缩字号，保证完整显示在字幕区内
    while font_size > 32 and (font_size + 16) * len(lines) > max_height:
        font_size -= 4
        font = ImageFont.truetype(FONT_PATH, font_size)
        lines = wrap_text(text, font, W - 2 * MARGIN_X)
    line_h = font_size + 16
    total_h = line_h * len(lines)
    y = SUBTITLE_TOP
    pad = 26
    overlay = Image.new("RGBA", (W, total_h + pad * 2), (0, 0, 0, 160))
    img.paste(overlay, (0, y - pad), overlay)
    draw = ImageDraw.Draw(img)
    for ln in lines:
        w = font.getbbox(ln)[2]
        draw.text(((W - w) // 2, y), ln, font=font, fill=color)
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
    portraits = data.get("portraits", DEFAULT_PORTRAITS)
    colors = {r: tuple(data.get("colors", {}).get(r) or DEFAULT_COLORS.get(r, (255, 255, 255))) for r in roles}

    os.makedirs(TMP, exist_ok=True)

    # 底图：每个人物一张全屏；旁白 → 全部人物上下合并
    portrait_roles = [r for r in roles if r in portraits]
    base_map = {r: fullscreen(portraits[r], (W, H)) for r in portrait_roles}
    if portrait_roles:
        h_each = H // len(portrait_roles)
        merged = Image.new("RGB", (W, H))
        for k, r in enumerate(portrait_roles):
            merged.paste(fullscreen(portraits[r], (W, h_each)), (0, k * h_each))
        if "旁白" in roles:
            base_map["旁白"] = merged

    sentences = []
    for role in roles:
        srt = os.path.join(OUT, f"{label}-{role}-minimax.srt")
        for start, end, text in parse_srt(srt):
            sentences.append((role, start, end, text))
    sentences.sort(key=lambda x: x[1])

    frames = []
    for i, (role, start, end, text) in enumerate(sentences):
        img = base_map[role].copy()
        draw_subtitle(img, colors[role], text)
        fp = os.path.join(TMP, f"f{i:02d}.png")
        img.save(fp)
        if i + 1 < len(sentences):
            dur = (sentences[i + 1][1] - start) / 1000.0
        else:
            dur = (end - start) / 1000.0
        frames.append((fp, dur))
        print(f"帧 {i+1}/{len(sentences)} [{role}] {dur:.1f}s", flush=True)

    out_mp4 = os.path.join(OUT, f"{label}-成片.mp4")
    # 2026-09-17 修复（第二次）：单条 filter_complex（concat 视频 + 多输入 amix 音频 + -t）存在
    # 非确定性截断 bug —— 同一命令在 bash 直跑正常、subprocess 里音频随机被截到第一段（5s）。
    # 改为两段式：① 图片序列 → 纯视频 mp4；② mp3 + BGM → 混音 wav（实测稳定）；
    # ③ -c:v copy 合流。三步各自原子，彻底绕开图内调度竞争。
    total_s = sum(d for _, d in frames)
    v_only = os.path.join(TMP, f"{label}-video-only.mp4")
    a_mix = os.path.join(TMP, f"{label}-audio-mix.wav")

    # ① 纯视频
    v_inputs = []
    for fp, dur in frames:
        v_inputs += ["-loop", "1", "-t", f"{dur:.3f}", "-i", fp]
    vconcat = "".join(f"[{i}:v]" for i in range(len(frames)))
    run(["ffmpeg", "-y", "-v", "error", *v_inputs,
         "-filter_complex", f"{vconcat}concat=n={len(frames)}:v=1:a=0[v]",
         "-map", "[v]", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
         "-pix_fmt", "yuv420p", "-r", "30", v_only])

    # ② 音频混音（voice 全轨 + BGM，响度标准化）
    a_inputs = []
    for role in roles:
        a_inputs += ["-i", os.path.join(OUT, f"{label}-{role}-minimax.mp3")]
    a_inputs += ["-stream_loop", "-1", "-i", BGM]
    amix_in = "".join(f"[{j}:a]" for j in range(len(roles)))
    afc = (
        f"{amix_in}amix=inputs={len(roles)}:duration=longest:normalize=0,"
        f"loudnorm=I={VOICE_LUFS}:TP=-1.0:LRA=9,aresample=44100[voice];"
        f"[{len(roles)}:a]loudnorm=I={BGM_LUFS}:TP=-9:LRA=7,aresample=44100[bgm];"
        f"[voice][bgm]amix=inputs=2:duration=first:normalize=0,"
        f"aformat=sample_fmts=fltp:channel_layouts=stereo[a]"
    )
    run(["ffmpeg", "-y", "-v", "error", *a_inputs,
         "-filter_complex", afc, "-map", "[a]", "-t", f"{total_s:.3f}", a_mix])

    # ③ 合流（视频流直接 copy，不重编码）
    run(["ffmpeg", "-y", "-v", "error", "-i", v_only, "-i", a_mix,
         "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
         "-t", f"{total_s:.3f}", out_mp4])
    print(f"成片: {out_mp4}", flush=True)


if __name__ == "__main__":
    main()
