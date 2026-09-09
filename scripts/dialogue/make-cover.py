#!/usr/bin/env python3
"""生成「国学对谈」封面（3:4 信息流安全尺寸 1080×1440）。

构图：左右分屏人物画像 + 墨线分隔 + 顶部(人物名×期号) + 底部(大标题大字)。
中老年适配：大字、半透明黑底衬、高对比金色。

用法：
    .venv-asr/bin/python scripts/dialogue/make-cover.py \
        --data=src/data/dialogue/dialogue-02.json \
        --title="读书|到底该怎么读"

--title 用 | 分隔两行：第一行金色大字、第二行白色大字；单行则金色居中。
缺省 --title 时取对白 JSON 的 topic。
输出：out/封面-{label}.png
"""
import json
import re
import sys

from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1440  # 3:4 封面（视频号/抖音信息流显示比例，零裁剪）
GOLD = (229, 185, 107)
WHITE = (255, 255, 255)
GRAY = (240, 240, 240)
FONT = "/System/Library/Fonts/STHeiti Medium.ttc"

# 缺省画像（对白 JSON 未带 portraits 字段时回退，兼容第一、二期）
DEFAULT_PORTRAITS = {
    "庄子": "public/assets/portraits/庄子.png",
    "曾国藩": "public/assets/portraits/曾国藩.png",
}


def fullscreen(img, size):
    """画像缩放到覆盖 size，水平居中、垂直顶部对齐裁切（保住头部）"""
    w, h = size
    ratio = max(w / img.width, h / img.height)
    nw, nh = int(img.width * ratio), int(img.height * ratio)
    img = img.resize((nw, nh), Image.LANCZOS)
    left = (nw - w) // 2
    return img.crop((left, 0, left + w, h))


def center(draw, text, font, y, fill):
    w = draw.textbbox((0, 0), text, font=font)[2]
    draw.text(((W - w) // 2, y), text, font=font, fill=fill)


def main():
    data_path = None
    title = None
    for a in sys.argv[1:]:
        if a.startswith("--data="):
            data_path = a[len("--data="):]
        elif a.startswith("--title="):
            title = a[len("--title="):]
    if not data_path:
        print(__doc__)
        sys.exit(1)

    data = json.load(open(data_path, encoding="utf-8"))
    label = data["label"]
    portraits = data.get("portraits", DEFAULT_PORTRAITS)
    roles = list(portraits.keys())
    if len(roles) < 2:
        raise RuntimeError("封面需要至少两个人物画像（portraits 字段）")

    title = title or data.get("topic", label)
    lines = title.split("|")  # 第一行金、第二行白

    canvas = Image.new("RGB", (W, H))
    for i, role in enumerate(roles):
        img = Image.open(portraits[role]).convert("RGB")
        canvas.paste(fullscreen(img, (W // 2, H)), (i * (W // 2), 0))
    draw = ImageDraw.Draw(canvas)
    draw.line([(W // 2, 0), (W // 2, H)], fill=(20, 15, 10), width=6)

    # 顶部黑底条：人物名 + 期号
    canvas.paste(Image.new("RGBA", (W, 240), (0, 0, 0, 200)), (0, 0))
    draw = ImageDraw.Draw(canvas)
    f_person = ImageFont.truetype(FONT, 88)
    f_col = ImageFont.truetype(FONT, 50)
    episode = re.findall(r"\d+", label)
    ep_text = f"国学对谈 · 第 {episode[-1]} 期" if episode else "国学对谈"
    center(draw, " × ".join(roles), f_person, 40, GOLD)
    center(draw, ep_text, f_col, 150, GRAY)

    # 底部黑底条：大标题
    canvas.paste(Image.new("RGBA", (W, 480), (0, 0, 0, 200)), (0, H - 480))
    draw = ImageDraw.Draw(canvas)
    f_big = ImageFont.truetype(FONT, 150)
    f_sub = ImageFont.truetype(FONT, 110)
    if len(lines) == 1:
        center(draw, lines[0], f_big, H - 360, GOLD)
    else:
        center(draw, lines[0], f_big, H - 400, GOLD)
        center(draw, lines[1], f_sub, H - 220, WHITE)

    out = f"out/封面-{label}.png"
    canvas.save(out)
    print(f"封面已生成: {out}（{W}×{H}）")


if __name__ == "__main__":
    main()
