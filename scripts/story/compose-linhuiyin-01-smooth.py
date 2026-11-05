#!/usr/bin/env python3
"""林徽因视频合成脚本 - 平滑Ken Burns运镜（参考compose-video-motion.py）"""
import json
import subprocess
import os

# 配置
AUDIO = "out/林徽因01-旁白-minimax.mp3"
SRT = "out/林徽因01-旁白-minimax.srt"
IMG_DIR = "out/linhuiyin-01"
OUTPUT = "out/林徽因01-成片-v2.mp4"
TOTAL_DURATION = 343.8  # 秒
FPS = 30

# 6种平滑运镜（参考岳飞视频的成功参数）
# z1=1.2 表示轻微放大，z=0.2 表示运动幅度
MOTIONS = {
    "zoom_in": "z='1+0.2*on/{D}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
    "zoom_out": "z='1.2-0.2*on/{D}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
    "pan_left": "z='1.2':x='(iw-iw/zoom)*on/{D}':y='ih/2-(ih/zoom/2)'",
    "pan_right": "z='1.2':x='(iw-iw/zoom)*(1-on/{D})':y='ih/2-(ih/zoom/2)'",
    "tilt_up": "z='1.2':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*(1-on/{D})'",
    "tilt_down": "z='1.2':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*on/{D}'",
}

# 图片与时间轴对应关系
IMAGE_TIMELINE = [
    {"img": "img-01-upenn.png", "duration": 11.4, "motion": "zoom_in"},
    {"img": "img-02-diploma.png", "duration": 9.6, "motion": "pan_right"},
    {"img": "img-03-student.png", "duration": 11.9, "motion": "zoom_in"},
    {"img": "img-04-classroom.png", "duration": 17.4, "motion": "pan_left"},
    {"img": "img-05-blueprint.png", "duration": 11.2, "motion": "zoom_in"},
    {"img": "img-06-mountains.png", "duration": 10.5, "motion": "pan_right"},
    {"img": "img-07-temple-exterior.png", "duration": 9.2, "motion": "zoom_in"},
    {"img": "img-08-temple-interior.png", "duration": 18.4, "motion": "tilt_down"},
    {"img": "img-09-surveying.png", "duration": 9.8, "motion": "zoom_in"},
    {"img": "img-10-inscription.png", "duration": 6.1, "motion": "pan_left"},
    {"img": "img-11-refugee.png", "duration": 9.3, "motion": "pan_right"},
    {"img": "img-12-lizhuang-street.png", "duration": 10.1, "motion": "zoom_in"},
    {"img": "img-13-lizhuang-interior.png", "duration": 14.1, "motion": "pan_left"},
    {"img": "img-14-books.png", "duration": 8.1, "motion": "zoom_in"},
    {"img": "img-15-hands.png", "duration": 8.8, "motion": "pan_right"},
    {"img": "img-16-yangtze.png", "duration": 6.6, "motion": "pan_left"},
    {"img": "img-17-emblem.png", "duration": 11.3, "motion": "zoom_in"},
    {"img": "img-18-monument-full.png", "duration": 10.1, "motion": "tilt_down"},
    {"img": "img-19-monument-detail.png", "duration": 9.8, "motion": "zoom_in"},
    {"img": "img-20-cemetery-gate.png", "duration": 5.3, "motion": "pan_right"},
    {"img": "img-21-cemetery-trees.png", "duration": 14.0, "motion": "zoom_in"},
    {"img": "img-22-tombstone.png", "duration": 18.0, "motion": "pan_left"},
    {"img": "img-23-old-photos.png", "duration": 10.6, "motion": "zoom_in"},
    {"img": "img-24-portrait.png", "duration": 15.3, "motion": "zoom_in"},
    {"img": "img-25-sketches.png", "duration": 13.1, "motion": "pan_right"},
    {"img": "img-26-architecture.png", "duration": 16.9, "motion": "zoom_out"},
    {"img": "img-27-silhouette.png", "duration": 21.2, "motion": "zoom_in"},
    {"img": "img-28-heritage.png", "duration": 14.0, "motion": "pan_right"}
]

def create_smooth_motion(img_path, duration, motion_type, output_path):
    """创建平滑的Ken Burns运镜效果"""
    D = int(duration * FPS)
    motion_params = MOTIONS[motion_type].replace("{D}", str(D))

    zoompan = f"zoompan={motion_params}:d={D}:s=1080x1920:fps={FPS}"

    cmd = [
        "ffmpeg", "-y", "-loop", "1", "-i", img_path,
        "-vf", f"{zoompan},format=yuv420p",
        "-t", str(duration),
        "-r", str(FPS),
        "-c:v", "libx264", "-preset", "medium", "-crf", "23",
        output_path
    ]
    subprocess.run(cmd, check=True, capture_output=True)

def main():
    print("开始生成林徽因视频（平滑版本）...")

    # 检查图片
    missing = []
    for item in IMAGE_TIMELINE:
        img_path = os.path.join(IMG_DIR, item["img"])
        if not os.path.exists(img_path):
            missing.append(item["img"])

    if missing:
        print(f"缺少图片：{missing}")
        return

    # 清理旧的clip文件
    import glob
    for f in glob.glob(os.path.join(IMG_DIR, "clip_v2_*.mp4")):
        os.remove(f)

    # 生成运镜片段
    print("生成平滑运镜片段...")
    video_clips = []
    for i, item in enumerate(IMAGE_TIMELINE):
        img_path = os.path.join(IMG_DIR, item["img"])
        clip_path = os.path.join(IMG_DIR, f"clip_v2_{i:02d}.mp4")
        print(f"[{i+1}/{len(IMAGE_TIMELINE)}] {item['img']} ({item['duration']}s, {item['motion']})")
        create_smooth_motion(img_path, item["duration"], item["motion"], clip_path)
        video_clips.append(clip_path)

    # 合并视频片段
    print("合并视频片段...")
    concat_file = os.path.join(IMG_DIR, "concat_v2.txt")
    with open(concat_file, "w") as f:
        for clip in video_clips:
            f.write(f"file '{os.path.basename(clip)}'\n")

    temp_video = os.path.join(IMG_DIR, "temp_video_v2.mp4")
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", concat_file, "-c", "copy", temp_video
    ], check=True, cwd=IMG_DIR)

    # 添加音频
    print("添加音频...")
    subprocess.run([
        "ffmpeg", "-y",
        "-i", temp_video,
        "-i", AUDIO,
        "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        OUTPUT
    ], check=True)

    print(f"✓ 平滑版本生成完成：{OUTPUT}")

    # 清理临时文件
    print("清理临时文件...")
    for clip in video_clips:
        os.remove(clip)
    os.remove(temp_video)
    os.remove(concat_file)

if __name__ == "__main__":
    main()
