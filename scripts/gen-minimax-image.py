#!/usr/bin/env python3
"""MiniMax image-01 文生图（绕开 openai-compat 过载时使用）。

用法：
    单张： .venv-asr/bin/python scripts/gen-minimax-image.py --prompt "..." --out out/x.png
    批量： .venv-asr/bin/python scripts/gen-minimax-image.py --json out/zhangye01/images.json
key 来源：项目根 .minimax.key（与 TTS 同 key）。
"""
import argparse
import base64
import json
import os
import time

import requests

API = "https://api.minimax.cn/v1/image_generation"
MODEL = "image-01"


def get_key():
    key_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".minimax.key")
    with open(key_file, encoding="utf-8") as f:
        k = f.read().strip()
    if not k:
        raise SystemExit("未找到 key：请确认 .minimax.key 非空")
    return k


def gen(prompt, out, key, aspect_ratio):
    r = requests.post(
        API,
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        json={
            "model": MODEL,
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "response_format": "url",
            "n": 1,
            "prompt_optimizer": True,
        },
        timeout=300,
    )
    if r.status_code != 200:
        raise RuntimeError(f"status={r.status_code}: {r.text[:300]}")
    data = r.json()
    if data.get("base_resp", {}).get("status_code") != 0:
        raise RuntimeError(f"base_resp: {json.dumps(data.get('base_resp'), ensure_ascii=False)[:300]}")
    urls = (data.get("data") or {}).get("image_urls") or []
    if not urls:
        raise RuntimeError(f"无图片: {json.dumps(data, ensure_ascii=False)[:300]}")
    img = requests.get(urls[0], timeout=300)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "wb") as f:
        f.write(img.content)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt")
    ap.add_argument("--out")
    ap.add_argument("--json", help="批量 JSON：[{prompt, out}, ...]")
    ap.add_argument("--aspect-ratio", default="9:16")
    args = ap.parse_args()

    key = get_key()
    jobs = json.load(open(args.json, encoding="utf-8")) if args.json else [{"prompt": args.prompt, "out": args.out}]
    for i, j in enumerate(jobs):
        t0 = time.time()
        try:
            gen(j["prompt"], j["out"], key, args.aspect_ratio)
            print(f"[{i+1}/{len(jobs)}] ok -> {j['out']} ({time.time()-t0:.1f}s)", flush=True)
        except Exception as e:
            print(f"[{i+1}/{len(jobs)}] 失败 {j['out']}: {e}", flush=True)
            time.sleep(3)
            try:
                gen(j["prompt"], j["out"], key, args.aspect_ratio)
                print(f"[{i+1}/{len(jobs)}] 重试成功 -> {j['out']}", flush=True)
            except Exception as e2:
                print(f"[{i+1}/{len(jobs)}] 重试仍失败: {e2}", flush=True)


if __name__ == "__main__":
    main()
