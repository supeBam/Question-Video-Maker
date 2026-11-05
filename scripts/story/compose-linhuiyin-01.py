#!/usr/bin/env python3
"""林徽因视频合成脚本 - Ken Burns 运镜效果
基于配音时长和图片素材，生成带运镜效果的最终视频
"""
import json
import subprocess
import os

# 配置
AUDIO = "out/林徽因01-旁白-minimax.mp3"
SRT = "out/林徽因01-旁白-minimax.srt"
IMG_DIR = "out/linhuiyin-01"
OUTPUT = "out/林徽因01-成片.mp4"
TOTAL_DURATION = 343.8  # 秒

# 图片与时间轴对应关系（28张图片）
IMAGE_TIMELINE = [
    # 每张图片的持续时间（秒）
    {"img": "img-01-upenn.png", "duration": 11.4, "motion": "zoom_in"},
    {"img": "img-02-diploma.png", "duration": 9.6, "motion": "pan_right"},
    {"img": "img-03-student.png", "duration": 11.9, "motion": "zoom_in"},
    {"img": "img-04-classroom.png", "duration": 17.4, "motion": "pan_left"},
    {"img": "img-05-blueprint.png", "duration": 11.2, "motion": "zoom_in"},
    {"img": "img-06-mountains.png", "duration": 10.5, "motion": "pan_right"},
    {"img": "img-07-temple-exterior.png", "duration": 9.2, "motion": "zoom_in"},
    {"img": "img-08-temple-interior.png", "duration": 18.4, "motion": "tilt_up"},
    {"img": "img-09-surveying.png", "duration": 9.8, "motion": "zoom_in"},
    {"img": "img-10-inscription.png", "duration": 6.1, "motion": "pan_left"},
    {"img": "img-11-refugee.png", "duration": 9.3, "motion": "pan_right"},
    {"img": "img-12-lizhuang-street.png", "duration": 10.1, "motion": "zoom_in"},
    {"img": "img-13-lizhuang-interior.png", "duration": 14.1, "motion": "pan_left"},
    {"img": "img-14-books.png", "duration": 8.1, "motion": "zoom_in"},
    {"img": "img-15-hands.png", "duration": 8.8, "motion": "pan_right"},
    {"img": "img-16-yangtze.png", "duration": 6.6, "motion": "pan_left"},
    {"img": "img-17-emblem.png", "duration": 11.3, "motion": "zoom_in"},
    {"img": "img-18-monument-full.png", "duration": 10.1, "motion": "tilt_up"},
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

def create_ken_burns_video(img_path, duration, motion_type, output_path):
    """
    为单张图片创建 Ken Burns 运镜效果
    motion_type: zoom_in, zoom_out, pan_left, pan_right, tilt_up, tilt_down
    """
    # ffmpeg Ken Burns 效果参数
    if motion_type == "zoom_in":
        zoompan = f"zoompan=z='min(zoom+0.0015,1.5)':d={int(duration*30)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920"
    elif motion_type == "zoom_out":
        zoompan = f"zoompan=z='if(lte(zoom,1.0),1.5,max(1.001,zoom-0.0015))':d={int(duration*30)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920"
    elif motion_type == "pan_right":
        zoompan = f"zoompan=z='1.3':d={int(duration*30)}:x='if(gte(x,iw/2),x,x+1)':y='ih/2-(ih/zoom/2)':s=1080x1920"
    elif motion_type == "pan_left":
        zoompan = f"zoompan=z='1.3':d={int(duration*30)}:x='if(lte(x,iw/2-100),x,x-1)':y='ih/2-(ih/zoom/2)':s=1080x1920"
    elif motion_type == "tilt_up":
        zoompan = f"zoompan=z='1.3':d={int(duration*30)}:x='iw/2-(iw/zoom/2)':y='if(gte(y,ih/2),y,y+1)':s=1080x1920"
    else:  # tilt_down
        zoompan = f"zoompan=z='1.3':d={int(duration*30)}:x='iw/2-(iw/zoom/2)':y='if(lte(y,ih/2-100),y,y-1)':s=1080x1920"

    cmd = [
        "ffmpeg", "-y", "-loop", "1", "-i", img_path,
        "-vf", f"{zoompan},format=yuv420p",
        "-t", str(duration),
        "-r", "30",
        output_path
    ]
    subprocess.run(cmd, check=True, capture_output=True)

def main():
    print("开始生成林徽因视频...")

    # 检查图片是否都已生成
    missing = []
    for item in IMAGE_TIMELINE:
        img_path = os.path.join(IMG_DIR, item["img"])
        if not os.path.exists(img_path):
            missing.append(item["img"])

    if missing:
        print(f"缺少图片：{missing}")
        print("请等待图片生成完成后再运行此脚本")
        return

    # 为每张图片生成运镜视频片段
    print("生成运镜片段...")
    video_clips = []
    for i, item in enumerate(IMAGE_TIMELINE):
        img_path = os.path.join(IMG_DIR, item["img"])
        clip_path = os.path.join(IMG_DIR, f"clip_{i:02d}.mp4")
        print(f"[{i+1}/{len(IMAGE_TIMELINE)}] {item['img']} ({item['duration']}s, {item['motion']})")
        create_ken_burns_video(img_path, item["duration"], item["motion"], clip_path)
        video_clips.append(clip_path)

    # 合并所有视频片段
    print("合并视频片段...")
    concat_file = os.path.join(IMG_DIR, "concat.txt")
    with open(concat_file, "w") as f:
        for clip in video_clips:
            f.write(f"file '{os.path.basename(clip)}'\n")

    temp_video = os.path.join(IMG_DIR, "temp_video.mp4")
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", concat_file, "-c", "copy", temp_video
    ], check=True, cwd=IMG_DIR)

    # 添加音频和字幕
    print("添加音频和字幕...")
    subprocess.run([
        "ffmpeg", "-y",
        "-i", temp_video,
        "-i", AUDIO,
        "-vf", f"subtitles={SRT}:force_style='FontName=PingFang SC,FontSize=24,PrimaryColour=&H00FFFF,OutlineColour=&H000000,Outline=2,Alignment=2,MarginV=50'",
        "-c:v", "libx264", "-preset", "medium", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        OUTPUT
    ], check=True)

    print(f"视频生成完成：{OUTPUT}")

    # 清理临时文件
    print("清理临时文件...")
    for clip in video_clips:
        os.remove(clip)
    os.remove(temp_video)
    os.remove(concat_file)

if __name__ == "__main__":
    main()
