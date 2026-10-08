#!/usr/bin/env python3
"""龙生九子合集长片合成。

结构（对标参考片，但把它的三处破绽改掉）：
    0.0s  起   1.5s 钩子定格卡（参考片只有 0.17s，抖音里等于没有）
    1.5s  正片 9 子 × 约 2.9s，硬切，无叠化
    末    片尾 引导卡 + AI 生成标识

每条先用 burn-subtitles.py 烧好字幕，这里只负责钩子、统一规格、硬切拼接和片尾。

用法：
    .venv-asr/bin/python scripts/assemble-nine-sons.py --spec work/gujian-huohua/productions/longshengjiuzi/nine-sons.json
"""
import argparse
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
FONT = "/System/Library/Fonts/STHeiti Medium.ttc"
# 古筝·离秋：66.6s，能量足（30s 内 -18.8dB），撑得住九个硬切。
# 另两首备选：bg-古箫吟风曲.mp3（184s，偏慢）、bgm_guzheng_liqiu-soft.mp3（-33.6dB，太轻）
BGM = "public/assets/bg-audio/bgm_guzheng_liqiu.mp3"
OUT = "out/gujian-longsheng"


def run(cmd):
    subprocess.run(cmd, check=True)


def make_hook(hook_img, out_png):
    """起手钩子卡：静态定格 + 大标题。参考片用的是 0.17 秒，这里给足 1.5 秒。

    文案按"上集"口吻：现在只有四条素材，写"九个岗位"和内容对不上，
    改成"先看这四位"，既诚实，又给剩下五只留了钩子。
    """
    base = Image.open(hook_img).convert("RGB").resize((W, H), Image.LANCZOS)
    d = ImageDraw.Draw(base)
    # 压一层从上到下的暗角，保证字压得住
    for y in range(0, 760, 4):
        a = int(150 * (1 - y / 760))
        d.rectangle([0, y, W, y + 4], fill=(0, 0, 0, a))
    f1 = ImageFont.truetype(FONT, 150)
    f2 = ImageFont.truetype(FONT, 56)
    f3 = ImageFont.truetype(FONT, 40)
    d.text((W // 2, 290), "龙生九子", font=f1, fill=(255, 255, 255),
           stroke_width=10, stroke_fill=(0, 0, 0), anchor="mm")
    d.text((W // 2, 450), "屋脊上，藏着九个岗位", font=f2, fill=(226, 240, 255),
           stroke_width=5, stroke_fill=(0, 0, 0), anchor="mm")
    d.text((W // 2, 545), "上集 · 先看这四位", font=f3, fill=(255, 214, 140),
           stroke_width=4, stroke_fill=(0, 0, 0), anchor="mm")
    base.save(out_png)


def make_endcard(out_png, bg_img=None):
    """片尾：留关注钩子，同时保留 AI 生成标识。

    纯黑底会和前面的金色实景产生视觉跳跃，这里用压暗+虚化的建筑图做底。
    """
    if bg_img and os.path.exists(bg_img):
        base = Image.open(bg_img).convert("RGB").resize((W, H), Image.LANCZOS)
        base = base.filter(ImageFilter.GaussianBlur(radius=26))
        # 压到约 22% 亮度，只留肌理不留细节
        base = Image.blend(Image.new("RGB", (W, H), (10, 8, 7)), base, 0.22)
        img = base
    else:
        img = Image.new("RGB", (W, H), (12, 10, 9))
    d = ImageDraw.Draw(img)
    f1 = ImageFont.truetype(FONT, 92)
    f2 = ImageFont.truetype(FONT, 46)
    f3 = ImageFont.truetype(FONT, 34)
    d.text((W // 2, 820), "九子九职", font=f1, fill=(255, 255, 255),
           stroke_width=7, stroke_fill=(60, 40, 10), anchor="mm")
    d.text((W // 2, 950), "各司其职，一个都不能少", font=f2, fill=(230, 210, 170),
           stroke_width=4, stroke_fill=(40, 28, 8), anchor="mm")
    d.text((W // 2, 1290), "本片画面由 AI 生成", font=f3, fill=(160, 160, 160), anchor="mm")
    img.save(out_png)


def clip_from_raw(raw, out, start=0, dur=3.5, speed=1.0):
    """统一规格：截取前 dur 秒，**原速不慢放**，缩放到 1080×1920/30fps。

    注意：曾经用过 0.85 倍慢放来迁就嘲风那条镜头推太远，结果套到全部子身上
    把动势抹平了——用户反馈"合集没动态"。慢放是过度加工，去掉。
    """
    v_factor = 1 / speed
    run(["ffmpeg", "-v", "error", "-y", "-i", raw,
         "-filter_complex",
         f"[0:v]trim={start}:{start+dur},setpts={v_factor:.4f}*PTS,"
         f"scale={W}:{H}:flags=lanczos,setsar=1,fps=30[v];"
         # aresample=44100 统一采样率：H3 原生音频是 32000Hz，钩子卡/片尾是 44100Hz，
         # 采样率不一致时 concat 解码会报 "Invalid data found"。这里全部拉到 44100。
         f"[0:a]atrim={start}:{start+dur},atempo={speed},aresample=44100[a]",
         "-map", "[v]", "-map", "[a]",
         "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
         "-crf", "17", "-preset", "medium", "-movflags", "+faststart",
         "-c:a", "aac", "-ar", "44100", "-b:a", "192k", out])


def clip_from_still(still, out, dur=1.5, zoom_step=0.0009):
    """静帧推近，用来做钩子卡。所有输入必须在 -map 之前给完。"""
    run(["ffmpeg", "-v", "error", "-y",
         "-loop", "1", "-framerate", "30", "-t", str(dur), "-i", still,
         "-f", "lavfi", "-t", str(dur), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
         "-filter_complex",
         f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
         # zoompan 必须显式给 s=，否则会退回默认的 1280x720
         f"zoompan=z='min(zoom+{zoom_step},1.10)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
         f"fps=30:s={W}x{H},format=yuv420p,setsar=1[v]",
         "-map", "[v]", "-map", "1:a", "-shortest",
         "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
         "-crf", "17", "-preset", "medium", "-movflags", "+faststart",
         "-c:a", "aac", "-b:a", "192k", out])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True)
    ap.add_argument("--stage", default="all", choices=["all", "grade", "subs", "assemble"])
    ap.add_argument("--allow-partial", action="store_true", help="缺片时跳过而不是报错")
    args = ap.parse_args()

    spec = json.load(open(args.spec, encoding="utf-8"))
    sons = spec["sons"]
    os.makedirs(f"{OUT}/parts", exist_ok=True)

    subs_jobs = []

    if args.stage in ("all", "grade"):
        for s in sons:
            raw = s.get("raw") or f"out/gujian-longsheng/raw/{s['key']}.mp4"
            if not os.path.exists(raw):
                continue
            graded = f"{OUT}/parts/{s['key']}.mp4"
            clip_from_raw(raw, graded, start=0, dur=6.5, speed=1.0)
            print(f"  调色 {s['key']}", flush=True)

    if args.stage in ("all", "subs"):
        for s in sons:
            key, final = s["key"], f"{OUT}/parts/{s['key']}_sub.mp4"
            subs_jobs.append({
                "video": f"{OUT}/parts/{s['key']}.mp4",
                "out": final,
                "desc_start": 0.45, "desc_dur": 1.35,
                "text": {"pinyin": s["pinyin"], "title": s["title"], "desc": s["desc"]},
            })
        json.dump(subs_jobs, open("/tmp/nine-subs.json", "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
        print("字幕任务已写 /tmp/nine-subs.json，先跑 burn-subtitles.py", flush=True)

    if args.stage in ("all", "assemble"):
        hook_png, end_png = f"{OUT}/parts/_hook.png", f"{OUT}/parts/_end.png"
        make_hook(f"{OUT}/img/chiwen.png", hook_png)
        make_endcard(end_png, bg_img=f"{OUT}/img/chiwen.png")
        # 钩子卡 / 片尾：用户已要求删掉首尾的文字帧（都是文字，无画面），
        # 只保留四只兽。这里仍生成但不进 parts 列表；若要恢复再 append 回来。
        clip_from_still(hook_png, f"{OUT}/parts/_hook.mp4", dur=1.5)
        clip_from_still(end_png, f"{OUT}/parts/_end.mp4", dur=2.6)

        parts = []
        have, missing_all = [], []
        for s in sons:
            p = f"{OUT}/parts/{s['key']}_sub.mp4"
            if os.path.exists(p):
                parts.append(p)
                have.append(s["title"])
            else:
                missing_all.append(s["title"])
        if missing_all and not args.allow_partial:
            print("缺少分片：", " ".join(missing_all))
            sys.exit(1)
        if missing_all:
            print(f"⚠ 缺 {len(missing_all)} 条，按 --allow-partial 跳过：", " ".join(missing_all))
        print("本片包含：", " → ".join(have), flush=True)

        lst = f"{OUT}/parts/concat.txt"
        with open(lst, "w") as f:
            for p in parts:
                f.write(f"file '{os.path.abspath(p)}'\n")
        # 拼接：视频流拷贝、音频流重新编码为干净 AAC。
        # 关键：不能 -c copy 音频——concat 拷贝拼出来的 AAC 帧头不匹配，第二步解码
        # 报 "Invalid data found" 并杀死进程。这里 -c:a aac 把各段音轨解码后重编码，
        # 既保住神兽原生特效声（风声/水声），又得到一条连续干净的 AAC。
        silent = f"{OUT}/parts/_joined.mp4"
        run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
             "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", silent])

        # 混音：神兽原生特效声为主，古筝压成很低的氛围垫底。
        # 显式按视频轨时长截断。不能用 -shortest：loudnorm 有分析缓冲，会提前截断。
        vdur = float(subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
             "format=duration", "-of", "csv=p=0", silent],
            capture_output=True, text=True, check=True).stdout.strip())
        out = f"{OUT}/龙生九子上集-四兽-v4.mp4"
        run(["ffmpeg", "-v", "error", "-y", "-i", silent, "-stream_loop", "-1", "-i", BGM,
             "-filter_complex",
             "[0:a]loudnorm=I=-18:TP=-1.5:LRA=7,aresample=44100[sfx];"
             "[1:a]atrim=0:45,asetpts=N/SR/TB,"
             "loudnorm=I=-26:TP=-3:LRA=9,aresample=44100[bg];"
             "[bg][sfx]amix=inputs=2:duration=first:normalize=0,"
             "afade=t=in:st=0:d=0.6,areverse,afade=t=in:st=0:d=1.2,areverse[a]",
             "-map", "0:v", "-map", "[a]", "-t", f"{vdur:.3f}",
             # 全量重编码 + 锁 yuv420p + faststart，彻底排除流拷贝拼接的兼容问题
             "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
             "-crf", "18", "-preset", "medium", "-movflags", "+faststart",
             "-c:a", "aac", "-b:a", "192k", out])
        print("成片 ->", out, flush=True)


if __name__ == "__main__":
    main()
