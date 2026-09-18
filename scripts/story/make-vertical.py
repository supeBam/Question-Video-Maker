#!/usr/bin/env python3
"""方图 → 9:16 立轴延展（零变形）。

上方取顶部天空拉伸延展 + 渐变融合；下方取底部镜像做水面倒影（模糊压暗）。
用法：
    .venv-asr/bin/python scripts/story/make-vertical.py in.png out.png [pad_top=250]
"""
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


def make_vertical(src_path, out_path, pad_top=250, target_w=1080, target_h=1920):
    src = Image.open(src_path).convert("RGB")
    w, h = src.size
    base_h = int(w * target_h / target_w)  # 等比 9:16 高度
    pad_bottom = base_h - h - pad_top

    canvas = Image.new("RGB", (w, base_h))

    # 上方：顶部天空拉伸延展
    sky = src.crop((0, 0, w, 100)).resize((w, pad_top))
    canvas.paste(sky, (0, 0))
    # 中间：原图
    canvas.paste(src, (0, pad_top))
    # 顶部接缝：原图顶部 160px 渐变融合
    blend = src.crop((0, 0, w, 160)).convert("RGBA")
    mask = Image.new("L", (w, 160), 0)
    md = ImageDraw.Draw(mask)
    for y in range(160):
        md.line([(0, y), (w, y)], fill=int(255 * (1 - y / 160)))
    canvas.paste(blend, (0, pad_top), mask)

    if pad_bottom > 0:
        # 下方：底部镜像倒影（模糊压暗）
        take = min(pad_bottom, h)
        refl = src.crop((0, h - take, w, h)).transpose(Image.FLIP_TOP_BOTTOM)
        refl = refl.resize((w, pad_bottom))
        refl = refl.filter(ImageFilter.GaussianBlur(6))
        refl = ImageEnhance.Brightness(refl).enhance(0.6)
        canvas.paste(refl, (0, pad_top + h))
        seam = Image.new("RGBA", (w, 80), (0, 0, 0, 0))
        sd = ImageDraw.Draw(seam)
        for y in range(80):
            sd.line([(0, y), (w, y)], fill=(10, 30, 40, int(60 * (1 - y / 80))))
        canvas.paste(seam, (0, pad_top + h - 40), seam)

    out = canvas.resize((target_w, target_h), Image.LANCZOS)
    out.save(out_path)
    print(f"{out_path} ({out.size[0]}x{out.size[1]})")


if __name__ == "__main__":
    make_vertical(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 250)
