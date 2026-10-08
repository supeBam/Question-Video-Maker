#!/usr/bin/env python3
"""龙生九子活化：把已定稿的构件图用 MiniMax H3 转成动态片段。

H3 是多模态视频模型，content[] 里放 text + image_url(role=first_frame) 即为图生视频，
ratio 由首帧图决定（传别的值也按 adaptive 处理）。

用法：
    .venv-asr/bin/python scripts/gen-h3-video.py --json out/gujian-longsheng/h3-jobs.json
    单条： .venv-asr/bin/python scripts/gen-h3-video.py --image a.png --prompt "..." --out a.mp4
"""
import argparse
import base64
import json
import os
import sys
import time

import requests

API = "https://api.minimax.cn/v2"
MODEL = "MiniMax-H3"


def get_key():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".minimax.key")
    key = open(path, encoding="utf-8").read().strip()
    if not key:
        raise SystemExit("未找到 key：确认 .minimax.key 非空")
    return key


def to_data_uri(path):
    with open(path, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()


def submit(key, prompt, image, duration, resolution):
    r = requests.post(
        f"{API}/video_generation",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": MODEL,
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": to_data_uri(image)}, "role": "first_frame"},
            ],
            "resolution": resolution,
            "duration": duration,
            "ratio": "adaptive",
        },
        timeout=180,
    )
    if r.status_code != 200:
        raise RuntimeError(f"提交失败 status={r.status_code}: {r.text[:300]}")
    task_id = r.json().get("task_id")
    if not task_id:
        raise RuntimeError(f"无 task_id: {r.text[:300]}")
    return task_id


def poll(key, task_id, timeout=1200):
    """轮询直到**指定**的任务出结果。

    ⚠️ 中国区端点 https://api.minimax.cn/v2/query/video_generation 不认 ?task_id=：
    实测连续请求四个不同 task_id，它四次都返回同一个（最新的）任务，而且有一个
    缓存窗口——刚提交完立刻查询会拿到**上一个任务**的结果。不校验返回的 id
    就会把别人的成片当成自己的下载下来（2026-10-04 实测：8 条里只有 2 条是真的）。
    所以必须比对 items[0].id，不匹配就当没查到，继续等。
    """
    t0 = time.time()
    stale_hits = 0
    while time.time() - t0 < timeout:
        r = requests.get(
            f"{API}/query/video_generation",
            headers={"Authorization": f"Bearer {key}"},
            params={"task_id": task_id},
            timeout=60,
        )
        if r.status_code != 200:
            raise RuntimeError(f"查询失败 status={r.status_code}: {r.text[:200]}")
        body = r.json()
        # v2 返回 {"items":[{...}],"total":1}；官方文档示例写的是 {"task":{...}}。两种都收。
        if isinstance(body.get("items"), list) and body["items"]:
            task = body["items"][0]
        else:
            task = body.get("task") or body

        if str(task.get("id")) != str(task_id):
            # 端点返回了别的任务——多半是缓存窗口。等一下再问，绝不能拿它的结果。
            stale_hits += 1
            if stale_hits % 3 == 0:
                print(f"    [{task_id}] 端点返回了别的任务 {task.get('id')}，忽略重试……", flush=True)
            time.sleep(8)
            continue

        status = task.get("status")
        if status == "succeeded":
            return (task.get("content") or {}).get("url")
        if status in ("failed", "cancelled"):
            raise RuntimeError(f"生成失败: {json.dumps(task, ensure_ascii=False)[:300]}")
        print(f"    [{task_id}] {status} ...", flush=True)
        time.sleep(10)
    raise RuntimeError("轮询超时")


def download(url, out):
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with requests.get(url, stream=True, timeout=600) as resp:
        resp.raise_for_status()
        with open(out, "wb") as f:
            for chunk in resp.iter_content(1 << 20):
                f.write(chunk)


def run_job(key, job):
    t0 = time.time()
    task_id = submit(key, job["prompt"], job["image"], job.get("duration", 6),
                     job.get("resolution", "768P"))
    print(f"  task_id={task_id}  ({time.time()-t0:.1f}s 提交完成)", flush=True)
    url = poll(key, task_id)
    download(url, job["out"])
    print(f"  -> {job['out']}  共 {time.time()-t0:.1f}s", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", help='批量 JSON：[{"image","prompt","out","duration","resolution"}]')
    ap.add_argument("--image")
    ap.add_argument("--prompt")
    ap.add_argument("--out")
    ap.add_argument("--duration", type=int, default=6)
    ap.add_argument("--resolution", default="768P")
    ap.add_argument("--force", action="store_true", help="已存在的成片也重跑")
    args = ap.parse_args()

    if args.json:
        jobs = json.load(open(args.json, encoding="utf-8"))
    elif args.image and args.prompt and args.out:
        jobs = [{"image": args.image, "prompt": args.prompt, "out": args.out,
                 "duration": args.duration, "resolution": args.resolution}]
    else:
        ap.error("需要 --json，或同时给 --image --prompt --out")

    key = get_key()
    for i, job in enumerate(jobs):
        # 断点续跑：额度用尽后充了值重跑同一条命令，已完成的直接跳过，不重复扣费
        if os.path.exists(job["out"]) and not args.force:
            print(f"[{i+1}/{len(jobs)}] {job['out']} 已存在，跳过", flush=True)
            continue
        print(f"[{i+1}/{len(jobs)}] {job['out']}", flush=True)
        try:
            run_job(key, job)
        except Exception as e:
            print(f"  失败: {e}", flush=True)


if __name__ == "__main__":
    main()
