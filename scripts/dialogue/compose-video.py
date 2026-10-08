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
FONT_PATH = "assets/fonts/仓耳竹言体.ttf"
FONT_SIZE = 78          # 字幕字号（规则 78px）
FONT_SIZE_MIN = 48      # 长句自动缩小下限
SUBTITLE_CY = 1190      # 字幕垂直中心（62% 高度，1080×1920）
SUBTITLE_COLOR = (255, 220, 0)   # 黄
STROKE_COLOR = (0, 0, 0)         # 黑描边
MAX_SHORT = 14          # 单短句超 14 字硬切
W, H = 1080, 1920
MARGIN_X = 60
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


def fullscreen_center(path, size):
    """画像缩放到覆盖 size，水平+垂直都居中裁切（用于书/器物等居中主体，不裁头部）"""
    img = Image.open(path).convert("RGB")
    w, h = size
    ratio = max(w / img.width, h / img.height)
    nw, nh = int(img.width * ratio), int(img.height * ratio)
    img = img.resize((nw, nh), Image.LANCZOS)
    left = (nw - w) // 2
    top = (nh - h) // 2
    return img.crop((left, top, left + w, top + h))


_PUNCT_CHARS = "，。？！、；：""''（）《》【】…·—"


def split_short(text):
    """去标点 + 按标点切自然短句，单句超 14 字硬切。返回短句列表。"""
    for ch in _PUNCT_CHARS:
        text = text.replace(ch, "|")
    parts = [p.strip() for p in text.split("|") if p.strip()]
    shorts = []
    for p in parts:
        while len(p) > MAX_SHORT:
            shorts.append(p[:MAX_SHORT])
            p = p[MAX_SHORT:]
        if p:
            shorts.append(p)
    return shorts if shorts else [text]


def draw_subtitle(img, text):
    """单行滚动字幕：黄字黑描边、垂直中心 62%、78px 长句缩到 48px、水平居中。"""
    font_size = FONT_SIZE
    font = ImageFont.truetype(FONT_PATH, font_size)
    max_w = W - 2 * MARGIN_X
    while font_size > FONT_SIZE_MIN and font.getbbox(text)[2] > max_w:
        font_size -= 4
        font = ImageFont.truetype(FONT_PATH, font_size)
    draw = ImageDraw.Draw(img)
    w = font.getbbox(text)[2]
    x = (W - w) // 2
    y = SUBTITLE_CY - font_size // 2
    draw.text((x, y), text, font=font, fill=SUBTITLE_COLOR,
              stroke_width=4, stroke_fill=STROKE_COLOR)


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

    # 每句可选的独立画面（line.img），按「角色 → 该角色第几句」建立映射
    line_img_map = {}
    role_counters = {}
    for ln in data.get("lines", []):
        r = ln["role"]
        idx = role_counters.get(r, 0)
        role_counters[r] = idx + 1
        if ln.get("img"):
            line_img_map[(r, idx)] = ln["img"]

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
    sent_counters = {}
    for i, (role, start, end, text) in enumerate(sentences):
        if i + 1 < len(sentences):
            total_ms = sentences[i + 1][1] - start
        else:
            total_ms = end - start
        # 该角色第几句（用于查 line.img 独立画面）
        sidx = sent_counters.get(role, 0)
        sent_counters[role] = sidx + 1
        base = None
        if (role, sidx) in line_img_map:
            fimg = line_img_map[(role, sidx)]
            if os.path.exists(fimg):
                base = fullscreen_center(fimg, (W, H))
        if base is None:
            base = base_map[role]
        shorts = split_short(text)
        total_chars = sum(len(s) for s in shorts) or 1
        for s in shorts:
            seg_ms = total_ms * len(s) / total_chars
            img = base.copy()
            draw_subtitle(img, s)
            fp = os.path.join(TMP, f"f{len(frames):02d}.png")
            img.save(fp)
            frames.append((fp, seg_ms / 1000.0))
    print(f"滚动字幕：{len(sentences)} 句 → {len(frames)} 个短句", flush=True)

    out_mp4 = os.path.join(OUT, f"{label}-成片.mp4")
    # 2026-09-17 修复（第二次）：单条 filter_complex（concat 视频 + 多输入 amix 音频 + -t）存在
    # 非确定性截断 bug —— 同一命令在 bash 直跑正常、subprocess 里音频随机被截到第一段（5s）。
    # 改为两段式：① 图片序列 → 纯视频 mp4；② mp3 + BGM → 混音 wav（实测稳定）；
    # ③ -c:v copy 合流。三步各自原子，彻底绕开图内调度竞争。
    total_s = sum(d for _, d in frames)
    v_only = os.path.join(TMP, f"{label}-video-only.mp4")
    a_mix = os.path.join(TMP, f"{label}-audio-mix.wav")

    # ① 纯视频（concat demuxer 单输入读帧列表，避免 N 个 -loop 输入触发线程/进程上限）
    listfile = os.path.join(TMP, f"{label}-frames.txt")
    with open(listfile, "w", encoding="utf-8") as f:
        for fp, dur in frames:
            f.write(f"file '{os.path.abspath(fp)}'\n")
            f.write(f"duration {dur:.3f}\n")
        if frames:  # concat demuxer 需重复末帧以撑满其时长
            f.write(f"file '{os.path.abspath(frames[-1][0])}'\n")
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
         "-i", listfile, "-vf", "fps=30,format=yuv420p",
         "-c:v", "libx264", "-preset", "medium", "-crf", "20",
         "-r", "30", "-t", f"{total_s:.3f}", v_only])

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
