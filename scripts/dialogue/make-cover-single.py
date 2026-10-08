#!/usr/bin/env python3
"""生成单叙述者带货视频封面（3:4 1080×1440）。
底图用本期的开场图铺满，顶部半透明黑衬 + 金色大字标题。
中老年适配：大字、高对比金色、黑底衬。标题置顶，不遮画面主体。
"""
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1440
GOLD = (229, 185, 107)
WHITE = (255, 255, 255)
GRAY = (235, 225, 200)
FONT = "assets/fonts/仓耳竹言体.ttf"


def fullscreen(img, size):
    w, h = size
    ratio = max(w / img.width, h / img.height)
    nw, nh = int(img.width * ratio), int(img.height * ratio)
    img = img.resize((nw, nh), Image.LANCZOS)
    left = (nw - w) // 2
    top = (nh - h) // 2
    return img.crop((left, top, left + w, top + h))


def center(draw, text, font, y, fill):
    bb = draw.textbbox((0, 0), text, font=font)
    w = bb[2] - bb[0]
    draw.text(((W - w) // 2, y), text, font=font, fill=fill)


def main():
    base = None
    title = None
    label = None
    for a in sys.argv[1:]:
        if a.startswith("--base="):
            base = a[len("--base="):]
        elif a.startswith("--title="):
            title = a[len("--title="):]
        elif a.startswith("--label="):
            label = a[len("--label="):]
    if not base or not title:
        print(__doc__)
        sys.exit(1)
    label = label or "封面"

    canvas = Image.new("RGB", (W, H))
    base_img = Image.open(base).convert("RGB")
    canvas.paste(fullscreen(base_img, (W, H)), (0, 0))

    # 顶部半透明黑衬
    overlay = Image.new("RGBA", (W, 420), (0, 0, 0, 185))
    canvas.paste(overlay, (0, 0), overlay)

    draw = ImageDraw.Draw(canvas)
    lines = title.split("|")
    if len(lines) == 1:
        f = ImageFont.truetype(FONT, 150)
        center(draw, lines[0], f, 90, GOLD)
    else:
        f1 = ImageFont.truetype(FONT, 150)
        f2 = ImageFont.truetype(FONT, 105)
        center(draw, lines[0], f1, 60, GOLD)
        center(draw, lines[1], f2, 210, WHITE)

    out = f"out/封面-{label}.png"
    canvas.save(out)
    print(f"封面已生成: {out}（{W}×{H}）")


if __name__ == "__main__":
    main()