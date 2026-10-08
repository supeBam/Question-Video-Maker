#!/usr/bin/env python3
"""开一条新的 Hypit 短线产线（旁白主导型：成语 / 神兽 / 盘点这一类）。

为什么需要它：这四个脚本跨期是逐字节相同的，但**每期都要手工复制目录、改路径、
建 assets 子目录、链字体和垫乐**——这一步以前只能由人（或 agent）手做。
这个脚本把它变成一条命令。

用法（在仓库根目录）：
    # 看有哪些期可以当模板
    .venv-asr/bin/python scripts/utils/new-hypit-production.py --list

    # 从《神兽雌雄》开一期新的
    .venv-asr/bin/python scripts/utils/new-hypit-production.py \
        --from shenshou-01 --name longyan-01 --label "龙眼·六个成语"

之后只需填两个文件：productions/<name>/narration.json 与 shots.json。
完整说明见 work/hypit-yifu/README.md。
"""
import argparse
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
PROJECT = os.path.join(REPO, "work", "hypit-yifu")
PRODUCTIONS = os.path.join(PROJECT, "productions")

# 跨期逐字节相同、直接复制即可的脚本
COPY_SCRIPTS = ["gen-shots.py", "gen-tts.py", "gen-source.py", "make-cover.py"]
# 只复制这两样资产：字体与垫乐。图与音轨是每期自己生成的，绝不复制。
COPY_ASSETS = [("assets/fonts", None), ("assets/audio", ["bgm.mp3"])]
SKIP_DIRS = ["assets", "authors", "runs", "drafts", "__pycache__"]


def list_productions():
    if not os.path.isdir(PRODUCTIONS):
        raise SystemExit(f"找不到产线目录：{PRODUCTIONS}")
    out = []
    for d in sorted(os.listdir(PRODUCTIONS)):
        p = os.path.join(PRODUCTIONS, d)
        if os.path.isdir(p) and os.path.exists(os.path.join(p, "narration.json")):
            out.append((d, os.path.getmtime(p)))
    return [d for d, _ in sorted(out, key=lambda x: -x[1])]


def narration_skeleton(label):
    """给一份能直接跑通的骨架。占位文本很显眼，忘了改也一眼看得出来。"""
    return {
        "_README": "填这一份 + shots.json 就能出片。字段含义与硬规则见 work/hypit-yifu/README.md 第三节。"
                   "big 必须是 caption 的子串；cite 必须挂在有大字的那一行；每段 shots 数不得超过 lines 数。",
        "label": label,
        "voice": "xian-laokie-01",
        "model": "speech-2.8-hd",
        "speed": 1.0,
        "gapMs": {"line": 120, "beat": 300},
        "beats": [
            {
                "id": "opening",
                "label": "钩子",
                "shots": ["o1"],
                "lines": [
                    {
                        "text": "〔把这一行换成你的第一句口播，带标点。〕",
                        "caption": "〔把这一行换成你的第一句字幕，不带标点〕",
                        "shot": "o1",
                    }
                ],
            }
        ],
        "title": {
            "line1": "〔四个字〕",
            "before": "〔前段，可留空〕",
            "warm": "〔橙色的那几个字〕",
            "middle": "〔连接词〕",
            "red": "〔红色的那几个字〕",
            "after": "",
        },
    }


def shots_skeleton():
    return {
        "_README": "style 会拼在每一张图的 prompt 前面。务必写「无任何文字、印章、水印」——"
                   "图像模型会捏造中文乱码；并写「主体居中并上下大面积留白」，否则后期字幕和大字没地方放。",
        "style": "〔全局画风前缀：媒介 + 时代/题材 + 色调 + 光线 + 无任何文字印章水印 + 主体居中上下留白 + 画面干净〕",
        "shots": [
            {
                "id": "o1",
                "beat": "opening",
                "caption": "〔这一镜配哪句字幕，只给人看〕",
                "prompt": "〔本镜具体画面：主体、构图、光线、留白〕",
            }
        ],
    }


def write_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", help="新一期目录名，如 longyan-01")
    ap.add_argument("--from", dest="src", help="拿哪一期当模板；缺省＝最新一期")
    ap.add_argument("--label", help="期名（写进 narration.json 的 label）")
    ap.add_argument("--list", action="store_true", help="列出可用作模板的期")
    ap.add_argument("--force", action="store_true", help="目标已存在时覆盖")
    args = ap.parse_args()

    avail = list_productions()
    if args.list:
        print("可用作模板的期（新→旧）：")
        for d in avail:
            print("  ", d)
        return
    if not args.name:
        raise SystemExit("缺少 --name。用 --list 看有哪些期可以当模板。")

    src = args.src or (avail[0] if avail else None)
    if not src:
        raise SystemExit("没有可用作模板的期，先手工建一条。")
    src_dir = os.path.join(PRODUCTIONS, src)
    if not os.path.isdir(src_dir):
        raise SystemExit(f"模板期不存在：{src_dir}\n可选：{', '.join(avail)}")

    dst_dir = os.path.join(PRODUCTIONS, args.name)
    if os.path.exists(dst_dir):
        if not args.force:
            raise SystemExit(f"目标已存在：{dst_dir}（要覆盖加 --force）")
        shutil.rmtree(dst_dir)

    label = args.label or args.name
    os.makedirs(dst_dir)

    # 1) 复制脚本，并把 docstring 里写死的上一期目录名换成这一期
    copied = []
    for fn in COPY_SCRIPTS:
        s = os.path.join(src_dir, fn)
        if not os.path.exists(s):
            print(f"  ! 模板里没有 {fn}，跳过")
            continue
        with open(s, encoding="utf-8") as f:
            text = f.read()
        text = re.sub(r"productions/[\w\-]+/", f"productions/{args.name}/", text)
        with open(os.path.join(dst_dir, fn), "w", encoding="utf-8") as f:
            f.write(text)
        copied.append(fn)

    # 2) 只复制字体与垫乐；图、音轨、时间轴、svml 一律不复制
    for rel, only in COPY_ASSETS:
        sd = os.path.join(src_dir, rel)
        if not os.path.isdir(sd):
            print(f"  ! 模板里没有 {rel}，跳过")
            continue
        dd = os.path.join(dst_dir, rel)
        os.makedirs(dd, exist_ok=True)
        for fn in os.listdir(sd):
            if only and fn not in only:
                continue
            sp = os.path.join(sd, fn)
            if os.path.isfile(sp):
                shutil.copy2(sp, os.path.join(dd, fn))

    # 3) 建空的产出目录
    for d in ["assets/img", "assets/audio", "assets/out", "authors", "runs", "drafts"]:
        os.makedirs(os.path.join(dst_dir, d), exist_ok=True)

    # 4) 写两份骨架
    write_json(os.path.join(dst_dir, "narration.json"), narration_skeleton(label))
    write_json(os.path.join(dst_dir, "shots.json"), shots_skeleton())

    print(f"已从《{src}》开出新一期：productions/{args.name}")
    print(f"  复制脚本 {len(copied)} 个：{' '.join(copied)}")
    print( "  已建好 assets/{img,audio,out}、authors/、runs/，并链好字体与垫乐")
    print()
    print("接下来只做两件事：")
    print(f"  1. 填 productions/{args.name}/narration.json   ← 口播 / 字幕 / 大字 / 出处")
    print(f"  2. 填 productions/{args.name}/shots.json       ← 画风 / 每镜画面")
    print()
    print("然后依次跑（在 work/hypit-yifu 目录下，先 source env.sh）：")
    for step in [
        f"../../.venv-asr/bin/python productions/{args.name}/gen-shots.py",
        f"../../.venv-asr/bin/python productions/{args.name}/gen-tts.py",
        f"../../.venv-asr/bin/python productions/{args.name}/gen-source.py",
        f"../../.venv-asr/bin/python productions/{args.name}/make-cover.py",
        f"hypit build productions/{args.name}/runs/final.svrun --follow",
    ]:
        print("   ", step)
    print()
    print("字段含义、硬规则、时长估算、常见坑：work/hypit-yifu/README.md")


if __name__ == "__main__":
    main()
