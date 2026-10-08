#!/usr/bin/env python3
"""走代理直连 openlux 生图（绕开 DSH 生图工具不走系统代理导致的 fetch failed）。

key 来源优先级：--key 参数 > 环境变量 OPENLUX_API_KEY > --key-file 文件 > 项目根 .openlux.key

单张：
    .venv-asr/bin/python scripts/gen-image-openlux.py --prompt "..." --out out/x.png
批量：
    .venv-asr/bin/python scripts/gen-image-openlux.py --json out/zhangsanfeng01/images.json
"""
import argparse
import base64
import json
import os
import time

import requests

DEFAULT_PROXY = "http://127.0.0.1:7890"
BASE_URL = "https://api.openlux.ai/v1/images/generations"


def load_key(args):
    if args.key:
        return args.key
    if os.environ.get("OPENLUX_API_KEY"):
        return os.environ["OPENLUX_API_KEY"]
    for f in [args.key_file, ".openlux.key"]:
        if f and os.path.exists(f):
            k = open(f, encoding="utf-8").read().strip()
            if k:
                return k
    raise SystemExit("未找到 key：用 --key / 环境变量 OPENLUX_API_KEY / 或写入 .openlux.key")


def gen(prompt, out, key, args):
    proxies = {"http": args.proxy, "https": args.proxy} if args.proxy else None
    r = requests.post(
        BASE_URL,
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        json={"model": args.model, "prompt": prompt, "size": args.size, "n": 1},
        proxies=proxies,
        timeout=300,
    )
    if r.status_code != 200:
        raise RuntimeError(f"status={r.status_code}: {r.text[:300]}")
    data = r.json()
    item = (data.get("data") or [{}])[0]
    if "b64_json" in item:
        os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
        with open(out, "wb") as f:
            f.write(base64.b64decode(item["b64_json"]))
        return "b64"
    if "url" in item:
        img = requests.get(item["url"], proxies=proxies, timeout=120)
        os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
        with open(out, "wb") as f:
            f.write(img.content)
        return "url"
    raise RuntimeError(f"响应无图片: {json.dumps(data, ensure_ascii=False)[:300]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt")
    ap.add_argument("--out")
    ap.add_argument("--json", help="批量 JSON：[{prompt, out}, ...]")
    ap.add_argument("--size", default="1024x1536")
    ap.add_argument("--model", default="gpt-image-2")
    ap.add_argument("--key")
    ap.add_argument("--key-file")
    ap.add_argument("--proxy", default=DEFAULT_PROXY, help="代理地址；传空字符串表示直连")
    args = ap.parse_args()
    if args.proxy == "":
        args.proxy = None

    key = load_key(args)
    print(f"key 已加载（长度 {len(key)}），代理={args.proxy or '直连'}", flush=True)

    jobs = []
    if args.json:
        jobs = json.load(open(args.json, encoding="utf-8"))
    else:
        if not (args.prompt and args.out):
            ap.error("单张模式需要 --prompt 和 --out")
        jobs = [{"prompt": args.prompt, "out": args.out}]

    for i, j in enumerate(jobs):
        t0 = time.time()
        try:
            mode = gen(j["prompt"], j["out"], key, args)
            print(f"[{i+1}/{len(jobs)}] {mode} -> {j['out']} ({time.time()-t0:.1f}s)", flush=True)
        except Exception as e:
            print(f"[{i+1}/{len(jobs)}] 失败 {j['out']}: {e}", flush=True)
            time.sleep(3)
            try:
                mode = gen(j["prompt"], j["out"], key, args)
                print(f"[{i+1}/{len(jobs)}] 重试成功 -> {j['out']}", flush=True)
            except Exception as e2:
                print(f"[{i+1}/{len(jobs)}] 重试仍失败: {e2}", flush=True)


if __name__ == "__main__":
    main()
