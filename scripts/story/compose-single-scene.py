#!/usr/bin/env python3
"""单场景讲述型视频合成：一张会动的 AI 视频片段（循环） + 大字幕 + MiniMax 配音 + BGM。

用途：地名唠嗑这类「全程同一场景」的试验田视频。
  - 视觉：即梦生成的动态场景片段（下雪/灯笼摇曳）循环铺满全片
  - 字幕：按 SRT 逐句 baked 成大字 PNG，按时间段 overlay（字幕在雪之上，保证可读）
  - 音频：gen-minimax-tts.py 产出的对齐旁白轨 + BGM（响度标准化）

用法：
    .venv-asr/bin/python scripts/story/compose-single-scene.py \
        --srt=out/地名唠嗑-洛阳01-旁白-minimax.srt \
        --voice=out/地名唠嗑-洛阳01-旁白-minimax.mp3 \
        --clip=out/luoyang01/洛阳城-下雪.mp4 \
        --out=out/地名唠嗑-洛阳01-成片.mp4
"""
import argparse
import os
import re
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

FONT = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT_SIZE = 64          # 大字幕（中老年友好）
SUB_Y = 1420            # 字幕条顶边（1080×1920 画布）
W, H = 1080, 1920
BGM = "public/assets/bg-audio/bg-古箫吟风曲.mp3"
VOICE_LUFS, BGM_LUFS = -14, -34


def run(cmd):
    subprocess.run(cmd, check=True)


def parse_srt(path):
    content = open(path, encoding="utf-8").read()
    out = []
    for b in re.split(r"\n\s*\n", content.strip()):
        lines = b.strip().split("\n")
        if len(lines) < 2:
            continue
        m = re.match(r"(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)", lines[1])
        if not m:
            continue
        h1, m1, s1, ms1, h2, m2, s2, ms2 = map(int, m.groups())
        out.append((((h1*60+m1)*60+s1)*1000+ms1, ((h2*60+m2)*60+s2)*1000+ms2, " ".join(lines[2:])))
    return out


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


def make_sub_png(text, path):
    font = ImageFont.truetype(FONT, FONT_SIZE)
    lines = wrap_text(text, font, W - 120)
    line_h = FONT_SIZE + 18
    total_h = line_h * len(lines) + 40
    img = Image.new("RGBA", (W, total_h), (0, 0, 0, 0))
    overlay = Image.new("RGBA", (W, total_h), (0, 0, 0, 150))
    img.paste(overlay, (0, 0), overlay)
    d = ImageDraw.Draw(img)
    y = 20
    for ln in lines:
        w = font.getbbox(ln)[2]
        d.text(((W - w) // 2, y), ln, font=font, fill=(255, 255, 255, 255))
        y += line_h
    img.save(path)
    return total_h


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--srt", required=True)
    ap.add_argument("--voice", required=True)
    ap.add_argument("--clip", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--bgm", default=BGM)
    args = ap.parse_args()

    segs = parse_srt(args.srt)
    total_s = segs[-1][1] / 1000.0 + 0.5
    tmp = tempfile.mkdtemp(prefix="single-scene-")

    # ① 字幕 PNG
    sub_pngs = []
    for i, (st, en, text) in enumerate(segs):
        p = os.path.join(tmp, f"sub{i:02d}.png")
        make_sub_png(text, p)
        sub_pngs.append((p, st / 1000.0, en / 1000.0))

    # ② 动态片段循环到全片时长
    clip_loop = os.path.join(tmp, "clip-loop.mp4")
    run(["ffmpeg", "-y", "-v", "error", "-stream_loop", "-1", "-i", args.clip,
         "-t", f"{total_s:.3f}", "-c:v", "libx264", "-preset", "fast", "-crf", "20",
         "-pix_fmt", "yuv420p", "-an", clip_loop])

    # ③ 音频混音（旁白 + BGM）
    a_mix = os.path.join(tmp, "audio.wav")
    run(["ffmpeg", "-y", "-v", "error", "-i", args.voice,
         "-stream_loop", "-1", "-i", args.bgm,
         "-filter_complex",
         f"[0:a]loudnorm=I={VOICE_LUFS}:TP=-1.0:LRA=9,aresample=44100[voice];"
         f"[1:a]loudnorm=I={BGM_LUFS}:TP=-9:LRA=7,aresample=44100[bgm];"
         f"[voice][bgm]amix=inputs=2:duration=first:normalize=0,"
         f"aformat=sample_fmts=fltp:channel_layouts=stereo[a]",
         "-map", "[a]", "-t", f"{total_s:.3f}", a_mix])

    # ④ 字幕 overlay + 合流
    inputs = ["-i", clip_loop]
    for p, _, _ in sub_pngs:
        inputs += ["-i", p]
    fc = ""
    cur = "0:v"
    for i, (_, st, en) in enumerate(sub_pngs):
        nxt = f"v{i}"
        fc += f"[{cur}][{i + 1}:v]overlay=0:{SUB_Y}:enable='between(t,{st:.2f},{en:.2f})'[{nxt}];"
        cur = nxt
    fc = fc.rstrip(";")
    run(["ffmpeg", "-y", "-v", "error", *inputs, "-i", a_mix,
         "-filter_complex", fc,
         "-map", f"[{cur}]", "-map", f"{len(sub_pngs) + 1}:a",
         "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30",
         "-c:a", "aac", "-b:a", "192k", "-t", f"{total_s:.3f}", args.out])
    print(f"成片: {args.out}（{total_s:.1f}s）")


if __name__ == "__main__":
    main()
