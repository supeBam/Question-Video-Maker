#!/usr/bin/env python3
"""合成「静图 Ken Burns 运动」版单口播视频：缓慢推拉摇移 + 透明字幕轨道 + 配音混音。

与 compose-video.py 的区别：
  - 底图不再是每句一张静止帧，而是每一「段」一张图做持续的镜头运动（ffmpeg zoompan），
    13 段轮换 6 种运镜（推近 / 拉远 / 左右摇 / 上下移 / 斜推），全程无静止画面；
  - 字幕单独渲染成带 alpha 的透明轨道（qtrle）再叠加，规格与静止版逐像素一致：
    黄字 (255,220,0) + 黑描边、垂直中心 62%（1080×1920 → y≈1190）、单句超 14 字硬切、无标点。

用法：
    .venv-asr/bin/python scripts/dialogue/compose-video-motion.py --data=src/data/dialogue/yuefei-01.json

可选参数：
    --fps=30      帧率
    --crf=20      成片质量
    --zoom=0.16   推拉幅度（0.16 = 由 1.00 推到 1.16，约每分钟 10% 的呼吸感）
    --still       关闭运动，退回静止底图（用于对比排错）
"""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

OUT = "out"
TMP = os.path.join(OUT, "_motion_tmp")
DEFAULT_DATA = "src/data/dialogue/yuefei-01.json"

FONT_PATH = "assets/fonts/仓耳竹言体.ttf"
FONT_SIZE = 78
FONT_SIZE_MIN = 48
SUBTITLE_CY = 1190
SUBTITLE_COLOR = (255, 220, 0, 255)
STROKE_COLOR = (0, 0, 0, 255)
MAX_SHORT = 14
W, H = 1080, 1920
MARGIN_X = 60

# 运镜画布：先放大到 1.5 倍再由 zoompan 取景，避免 zoompan 在小图上产生抖动
CANVAS = (1620, 2880)

VOICE_LUFS = -14
BGM_LUFS = -34
BGM = "public/assets/bg-audio/bg-古箫吟风曲.mp3"

# 6 种运镜，按段轮换（相邻两段必不同）
# on = 当前输出帧号，D = 该段总帧数
MOTIONS = [
    ("推近", "z='1+{z}*on/{D}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"),
    ("左摇", "z='{z1}':x='(iw-iw/zoom)*on/{D}':y='ih/2-(ih/zoom/2)'"),
    ("拉远", "z='{z1}-{z}*on/{D}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"),
    ("右摇", "z='{z1}':x='(iw-iw/zoom)*(1-on/{D})':y='ih/2-(ih/zoom/2)'"),
    ("下移", "z='{z1}':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*on/{D}'"),
    ("斜推", "z='1+{z}*on/{D}':x='(iw-iw/zoom)*0.25*on/{D}':y='(ih-ih/zoom)*0.75*on/{D}'"),
]

_PUNCT_CHARS = "，。？！、；：""''（）《》【】…·—"


def run(cmd):
    subprocess.run(cmd, check=True)


def parse_srt(path):
    with open(path, encoding="utf-8") as f:
        content = f.read()
    out = []
    for b in content.strip().split("\n\n"):
        block = b.strip().split("\n")
        if len(block) < 2:
            continue
        import re
        m = re.match(r"(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)", block[1])
        if not m:
            continue
        h1, m1, s1, ms1, h2, m2, s2, ms2 = map(int, m.groups())
        start = ((h1 * 60 + m1) * 60 + s1) * 1000 + ms1
        end = ((h2 * 60 + m2) * 60 + s2) * 1000 + ms2
        out.append((start, end, " ".join(block[2:])))
    return out


def split_short(text):
    """去标点 + 按标点切自然短句，单句超 14 字硬切。"""
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


def subtitle_layer(text, out_path):
    """把一行短句画到全屏透明 RGBA 画布上（黄字黑描边，垂直中心 62%）。"""
    font_size = FONT_SIZE
    font = ImageFont.truetype(FONT_PATH, font_size)
    max_w = W - 2 * MARGIN_X
    while font_size > FONT_SIZE_MIN and font.getbbox(text)[2] > max_w:
        font_size -= 4
        font = ImageFont.truetype(FONT_PATH, font_size)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    tw = font.getbbox(text)[2]
    draw.text(((W - tw) // 2, SUBTITLE_CY - font_size // 2), text, font=font,
              fill=SUBTITLE_COLOR, stroke_width=4, stroke_fill=STROKE_COLOR)
    img.save(out_path)


def main():
    data_path = DEFAULT_DATA
    fps, crf, zoom, still = 30, 20, 0.16, False
    for a in sys.argv[1:]:
        if a.startswith("--data="):
            data_path = a[len("--data="):]
        elif a.startswith("--fps="):
            fps = int(a[len("--fps="):])
        elif a.startswith("--crf="):
            crf = int(a[len("--crf="):])
        elif a.startswith("--zoom="):
            zoom = float(a[len("--zoom="):])
        elif a == "--still":
            still = True

    with open(data_path, encoding="utf-8") as f:
        data = json.load(f)
    label = data["label"]
    roles = list(data["voices"].keys())
    portraits = data["portraits"]

    for r in roles:
        if not os.path.exists(portraits[r]):
            raise SystemExit(f"缺配图：{r} → {portraits[r]}")
        if not os.path.exists(os.path.join(OUT, f"{label}-{r}-minimax.mp3")):
            raise SystemExit(f"缺配音：out/{label}-{r}-minimax.mp3（先跑 gen-minimax-tts.py）")

    os.makedirs(TMP, exist_ok=True)

    # ① 汇总句子（SRT 已是全局时间轴，直接按开始时间排序）
    sentences = []
    for role in roles:
        srt = os.path.join(OUT, f"{label}-{role}-minimax.srt")
        for start, end, text in parse_srt(srt):
            sentences.append((role, start, end, text))
    sentences.sort(key=lambda x: x[1])

    # ② 每个短句的时间片（与静止版算法一致：句子槽位 = 到下一句开始，按字数分配）
    slots = []
    for i, (role, start, end, text) in enumerate(sentences):
        total_ms = (sentences[i + 1][1] - start) if i + 1 < len(sentences) else (end - start)
        shorts = split_short(text)
        total_chars = sum(len(s) for s in shorts) or 1
        t = start
        for s in shorts:
            seg = total_ms * len(s) / total_chars
            slots.append((role, int(round(t)), int(round(t + seg)), s))
            t += seg
    total_ms = slots[-1][2]
    total_s = total_ms / 1000.0

    # ③ 字幕透明轨道
    subs_dir = os.path.join(TMP, "subs")
    os.makedirs(subs_dir, exist_ok=True)
    for old in os.listdir(subs_dir):
        os.remove(os.path.join(subs_dir, old))
    listfile = os.path.join(TMP, "subs.txt")
    with open(listfile, "w", encoding="utf-8") as f:
        prev_end = 0
        for i, (_role, a, b, s) in enumerate(slots):
            p = os.path.abspath(os.path.join(subs_dir, f"s{i:04d}.png"))
            subtitle_layer(s, p)
            dur = max((b - a) / 1000.0, 1.0 / fps)
            # 句间空档补一张全透明帧，保证轨道与画面时间轴严丝合缝
            if a > prev_end + 1:
                blank = os.path.abspath(os.path.join(subs_dir, f"gap{i:04d}.png"))
                if not os.path.exists(blank):
                    Image.new("RGBA", (W, H), (0, 0, 0, 0)).save(blank)
                f.write(f"file '{blank}'\nduration {(a - prev_end) / 1000.0:.3f}\n")
            f.write(f"file '{p}'\nduration {dur:.3f}\n")
            prev_end = b
        f.write(f"file '{os.path.abspath(os.path.join(subs_dir, f's{len(slots)-1:04d}.png'))}'\n")
    subs_mov = os.path.join(TMP, f"{label}-subs.mov")
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listfile,
         "-vf", f"fps={fps}", "-c:v", "qtrle", "-pix_fmt", "argb", subs_mov])
    print(f"字幕轨道：{len(slots)} 个短句 → {os.path.basename(subs_mov)}", flush=True)

    # ④ 每段一个运镜片段，一次 filter_complex 出纯视频
    blocks = []          # [(role, start_ms, end_ms)]
    for role in roles:
        idxs = [i for i, s in enumerate(sentences) if s[0] == role]
        if not idxs:
            continue
        start = sentences[idxs[0]][1]
        end = sentences[idxs[-1] + 1][1] if idxs[-1] + 1 < len(sentences) else sentences[idxs[-1]][2]
        blocks.append((role, start, end))

    inputs, filters, labels = [], [], []
    for i, (role, start, end) in enumerate(blocks):
        inputs += ["-i", portraits[role]]
        d = max(int(round((end - start) / 1000.0 * fps)), 2)
        if still:
            expr = "z='1':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
            name = "静止"
        else:
            name, tmpl = MOTIONS[i % len(MOTIONS)]
            expr = tmpl.format(z=zoom, z1=1 + zoom, D=d)
        filters.append(
            f"[{i}:v]scale={CANVAS[0]}:{CANVAS[1]}:force_original_aspect_ratio=increase,"
            f"crop={CANVAS[0]}:{CANVAS[1]},setsar=1,"
            f"zoompan={expr}:d={d}:s={W}x{H}:fps={fps}[v{i}]"
        )
        labels.append(f"[v{i}]")
        print(f"  段{i+1:02d} {role:5s} {name} {(end-start)/1000.0:6.1f}s  {d:5d}帧", flush=True)

    n = len(blocks)
    filters.append(f"{''.join(labels)}concat=n={n}:v=1:a=0[bg]")
    filters.append(f"[bg][{n}:v]overlay=0:0:format=auto,format=yuv420p[vout]")

    v_only = os.path.join(TMP, f"{label}-video-only.mp4")
    run(["ffmpeg", "-y", "-v", "error", *inputs, "-i", subs_mov,
         "-filter_complex", ";".join(filters), "-map", "[vout]",
         "-t", f"{total_s:.3f}", "-r", str(fps),
         "-c:v", "libx264", "-preset", "medium", "-crf", str(crf),
         "-pix_fmt", "yuv420p", v_only])
    print(f"画面：{n} 段运镜 → {os.path.basename(v_only)}（{total_s:.1f}s）", flush=True)

    # ⑤ 混音（人声全轨 + BGM，响度标准化）
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
    a_mix = os.path.join(TMP, f"{label}-audio-mix.wav")
    run(["ffmpeg", "-y", "-v", "error", *a_inputs,
         "-filter_complex", afc, "-map", "[a]", "-t", f"{total_s:.3f}", a_mix])

    # ⑥ 合流（视频流 copy）
    out_mp4 = os.path.join(OUT, f"{label}-成片.mp4")
    run(["ffmpeg", "-y", "-v", "error", "-i", v_only, "-i", a_mix,
         "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
         "-t", f"{total_s:.3f}", out_mp4])
    print(f"成片: {out_mp4}（{total_s:.1f}s = {total_s/60:.2f}分）", flush=True)


if __name__ == "__main__":
    main()
