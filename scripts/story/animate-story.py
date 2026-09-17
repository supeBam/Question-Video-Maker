#!/usr/bin/env python3
"""试验田「成语故事」图生视频：把每段插画用 MiniMax 海螺（I2V）转成动画片段。

流程：读故事 JSON → 每段插画 POST /v1/video_generation（first_frame_image=dataURI）
     → 轮询 query/video_generation 到 Success → files/retrieve 拿下载地址 → 落盘 out/storyXX/clips/<角色>.mp4
     → 按旁白时长把片段拉伸/冻结补齐（<=8s 用 6s 片段轻微减速；>8s 用 10s 片段 + 尾部静帧 zoompan 由合成器处理）

用法：
    .venv-asr/bin/python scripts/story/animate-story.py --data=src/data/dialogue/story-02.json

断点续跑：已存在且时长达标的片段自动跳过。额度不足（2056）立即停，不白烧请求。
"""
import base64
import io
import json
import os
import subprocess
import sys
import time

import requests
from PIL import Image

API = "https://api.minimax.cn"
MODEL = "MiniMax-Hailuo-02"
RES = "768P"

# 每段插画对应的运动提示（按故事语义写，不追求炫技，只要画面活起来）
MOTION = {
    "开场": "卷轴上的山水云雾缓缓流动，动物剪影微微活动，镜头缓慢推进",
    "画蛇添足": "人物执笔的手在作画，添脚的动作，旁边人伸手取酒壶，衣袂轻动，镜头缓推",
    "狐假虎威": "狐狸昂头前行，老虎缓步跟在后面，远处小动物惊慌逃散，镜头缓慢推进",
    "惊弓之鸟": "弓箭手拉满弓弦，天空中大雁受惊坠落的瞬间，芦苇随风摇动",
    "鹤立鸡群": "白鹤优雅地转动脖颈，周围的鸡低头啄食走动，镜头缓慢推进",
    "狼狈为奸": "狼驮着狈在夜色小道上缓步前行，树影摇曳，月光微动",
    "打草惊蛇": "草丛中蛇被惊动窜出，县官惊慌起身，百姓手中状纸挥动",
    "结尾": "油灯火苗轻轻摇曳，长者的手比划着讲故事，孩子仰头听得入神，窗外月光宁静",
}


def run(cmd):
    subprocess.run(cmd, check=True)


def get_key():
    with open(".minimax.key", encoding="utf-8") as f:
        return f.read().strip()


def to_data_uri(path):
    img = Image.open(path).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def submit(key, img_uri, motion, duration):
    r = requests.post(f"{API}/v1/video_generation",
                      headers={"Authorization": f"Bearer {key}"},
                      json={"model": MODEL, "prompt": motion,
                            "first_frame_image": img_uri,
                            "duration": duration, "resolution": RES},
                      timeout=120)
    d = r.json()
    if d.get("task_id"):
        return d["task_id"]
    code = d.get("base_resp", {}).get("status_code")
    msg = d.get("base_resp", {}).get("status_msg", "")
    if code == 2056:
        print("⛔ Token Plan 视频额度不足，请先充值再跑。已生成的片段会保留，重跑自动续。")
        sys.exit(2)
    raise RuntimeError(f"提交失败: {code} {msg}")


def poll(key, task_id, timeout=900):
    t0 = time.time()
    while time.time() - t0 < timeout:
        r = requests.get(f"{API}/v1/query/video_generation",
                         headers={"Authorization": f"Bearer {key}"},
                         params={"task_id": task_id}, timeout=30)
        d = r.json()
        status = d.get("status")
        if status == "Success":
            return d["file_id"]
        if status in ("Fail", "Failed"):
            raise RuntimeError(f"生成失败: {json.dumps(d, ensure_ascii=False)[:200]}")
        time.sleep(10)
    raise RuntimeError("轮询超时")


def download(key, file_id, out_path):
    r = requests.get(f"{API}/v1/files/retrieve",
                     headers={"Authorization": f"Bearer {key}"},
                     params={"file_id": file_id}, timeout=30)
    url = r.json()["file"]["download_url"]
    with requests.get(url, stream=True, timeout=300) as resp:
        resp.raise_for_status()
        with open(out_path, "wb") as f:
            for chunk in resp.iter_content(1 << 20):
                f.write(chunk)


def main():
    data_path = None
    for a in sys.argv[1:]:
        if a.startswith("--data="):
            data_path = a[len("--data="):]
    if not data_path:
        print("用法: animate-story.py --data=src/data/dialogue/story-XX.json")
        sys.exit(1)
    data = json.load(open(data_path, encoding="utf-8"))
    label = data["label"]
    img_dir = os.path.dirname(data["portraits"]["开场"])  # out/storyXX
    clips_dir = os.path.join(img_dir, "clips")
    os.makedirs(clips_dir, exist_ok=True)
    key = get_key()

    for line in data["lines"]:
        role = line["role"]
        out_path = os.path.join(clips_dir, f"{role}.mp4")
        if os.path.exists(out_path):
            d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                "-of", "csv=p=0", out_path], capture_output=True, text=True).stdout.strip()
            if d and float(d) >= 5.5:
                print(f"跳过（已存在 {d}s）: {role}")
                continue
        # 旁白 >9s 的段用 10s 档，其余 6s 档
        dur = 10 if len(line["text"]) / 4.7 > 9 else 6
        motion = MOTION.get(role, "画面中的人物景物轻微活动，镜头缓慢推进，保持水墨画风格")
        print(f"提交: {role}（{dur}s 档）", flush=True)
        task_id = submit(key, to_data_uri(data["portraits"][role]), motion, dur)
        print(f"  task_id={task_id}，生成中…", flush=True)
        file_id = poll(key, task_id)
        download(key, file_id, out_path)
        print(f"  ✅ {out_path}", flush=True)
    print("全部片段生成完毕 →", clips_dir)


if __name__ == "__main__":
    main()
