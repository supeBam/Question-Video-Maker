#!/usr/bin/env python3
"""龙生九子字幕层：复刻参考片的版式与打字机节奏。

参考片字幕系统（全片统一，跨镜头持久）：
    左上角  拼音        小号白字 + 黑描边
            构件名大字   白色粗体 + 粗黑描边
            说明小字     白字黑描边，3 行左对齐，**打字机逐字出现**（非淡入）
    右下角  AI 生成      固定水印，白字半透明底

为什么不用 ffmpeg drawtext/subtitles：
    本机 ffmpeg 9.0.1（homebrew）未编译 --enable-libfreetype，drawtext/subtitles 滤镜不可用。
    改为 PIL 渲染字幕 PNG + ffmpeg overlay 合成，样式控制力反而更强。

用法：
    .venv-asr/bin/python scripts/burn-subtitles.py --data out/gujian-longsheng/chiwen.json
"""
import argparse
import json
import os
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"

STYLE = {
    "pinyin": {"size": 44, "y": 150, "fill": (255, 255, 255), "stroke": 4, "stroke_fill": (0, 0, 0)},
    "title":  {"size": 116, "y": 210, "fill": (255, 255, 255), "stroke": 9, "stroke_fill": (0, 0, 0)},
    "desc":   {"size": 46, "y": 380, "fill": (255, 255, 255), "stroke": 4, "stroke_fill": (0, 0, 0)},
    "desc_gap": 74,
    "left_x": 72,
    "watermark": {"size": 32, "box": (34, 18), "pad": 22},
}


def font(size):
    return ImageFont.truetype(FONT_PATH, size)


def draw_stroked(draw, xy, text, st, anchor_top=True):
    draw.text(xy, text, font=font(st["size"]), fill=st["fill"],
              stroke_width=st["stroke"], stroke_fill=st["stroke_fill"])


def render_state(spec, revealed_chars):
    """revealed_chars: 说明文字已打出的字符数（打字机进度）。"""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = STYLE["left_x"]

    if spec.get("pinyin"):
        draw_stroked(d, (x, STYLE["pinyin"]["y"]), spec["pinyin"], STYLE["pinyin"])
    if spec.get("title"):
        draw_stroked(d, (x, STYLE["title"]["y"]), spec["title"], STYLE["title"])

    desc = spec.get("desc", [])
    if desc:
        # 按作者给定的换行逐行切分：把已打出的字符按行长度分配回原行，
        # 不要先拼成一长串再平均断行——那会把"厌火"的"火"甩到下一行。
        shown = "".join(desc)[:revealed_chars]
        lines, idx = [], 0
        for line in desc:
            chunk = shown[idx:idx + len(line)]
            idx += len(line)
            if chunk:
                lines.append(chunk)
        for i, line in enumerate(lines):
            draw_stroked(d, (x, STYLE["desc"]["y"] + i * STYLE["desc_gap"]),
                         line, STYLE["desc"])

    wm = STYLE["watermark"]
    f = font(wm["size"])
    tw = d.textlength("AI 生成", font=f)
    bx, by = W - wm["pad"] - int(tw) - wm["box"][0], H - wm["pad"] - wm["box"][1]
    d.rounded_rectangle([bx, by, bx + int(tw) + wm["box"][0] * 2, by + wm["size"] + wm["box"][1] * 2],
                        radius=10, fill=(0, 0, 0, 90))
    d.text((bx + wm["box"][0], by + wm["box"][1]), "AI 生成", font=f, fill=(255, 255, 255, 220))
    return img


def build_overlay(job, outdir):
    """按打字机节奏生成若干字幕状态 PNG，并返回 (文件, 起, 止) 列表。"""
    os.makedirs(outdir, exist_ok=True)
    spec = job["text"]
    desc_total = sum(len(l) for l in spec.get("desc", []))
    start, dur = job["desc_start"], job.get("desc_dur", 1.2)
    states = []
    for step in range(desc_total + 1):
        t = start + dur * step / max(desc_total, 1)
        p = os.path.join(outdir, f"sub_{step:02d}.png")
        render_state(spec, step).save(p)
        states.append((p, t, t + dur / max(desc_total, 1)))
    # 最后一个状态必须一直保留到片尾，否则打字机打完后字幕会整段消失
    if states:
        last_png, last_t, _ = states[-1]
        states[-1] = (last_png, last_t, 9999.0)
    return states


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", help='JSON：{"video","out","text":{"pinyin","title","desc":[...]},'
                                   '"desc_start","desc_dur"} 或这些对象的数组')
    ap.add_argument("--dir", default="out/gujian-longsheng/_subs")
    args = ap.parse_args()

    jobs = json.load(open(args.data, encoding="utf-8"))
    if isinstance(jobs, dict):
        jobs = [jobs]

    for job in jobs:
        video, out = job["video"], job["out"]
        if not os.path.exists(video):
            print(f"跳过（片源不存在）: {video}", flush=True)
            continue
        states = build_overlay(job, args.dir)
        inputs, filters, last = ["-i", video], [], "0:v"
        # 先把底片统一到 1080×1920 竖屏（参考片是 720×1280，比例同为 9:16 满幅）
        filters.append(f"[0:v]scale={W}:{H},setsar=1[base]")
        last = "base"
        for i, (png, t0, t1) in enumerate(states):
            inputs += ["-i", png]
            label = f"{i+1}:v"
            filters.append(f"[{last}][{label}]overlay=0:0:enable='between(t,{t0:.3f},{t1:.3f})'[o{i}]")
            last = f"o{i}"
        cmd = ["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(filters),
               "-map", f"[{last}]", "-map", "0:a?",
               "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
               "-crf", "18", "-preset", "medium", "-movflags", "+faststart",
               "-c:a", "aac", out]
        print("$", " ".join(cmd[:6]), "...", out, flush=True)
        subprocess.run(cmd, check=True)
        print(f"  -> {out}", flush=True)


if __name__ == "__main__":
    main()
