#!/usr/bin/env python3
"""创建新项目目录和配置

用法：
    python scripts/utils/create-project.py --name 兰州 --series 地名中国 --episode 6
"""
import os
import json
import argparse
from datetime import datetime

def create_project(name, series, episode):
    """创建新项目目录和配置文件"""
    # 创建目录
    project_dir = f"projects/口播视频/{series}/{episode:02d}-{name}"
    os.makedirs(f"{project_dir}/video", exist_ok=True)
    os.makedirs(f"{project_dir}/images", exist_ok=True)

    # 生成 project.json
    project_config = {
        "project_id": f"{name}-{episode:02d}",
        "title": f"{name}",
        "series": series,
        "episode": episode,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "status": "draft",

        "platforms": {
            "douyin": {
                "url": "",
                "published_at": "",
                "views": 0,
                "likes": 0
            },
            "video_hao": {
                "url": "",
                "published_at": "",
                "views": 0,
                "likes": 0
            }
        },

        "files": {
            "video": "",
            "cover": "",
            "script": ""
        },

        "assets_used": {
            "from_library": [],
            "project_specific": []
        },

        "tags": []
    }

    with open(f"{project_dir}/project.json", "w", encoding="utf-8") as f:
        json.dump(project_config, f, ensure_ascii=False, indent=2)

    print(f"✓ 项目创建成功：{project_dir}")
    return project_dir

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="创建新项目")
    parser.add_argument("--name", required=True, help="项目名称（如：兰州）")
    parser.add_argument("--series", required=True, help="系列名（如：地名中国）")
    parser.add_argument("--episode", type=int, required=True, help="集数")
    args = parser.parse_args()

    create_project(args.name, args.series, args.episode)
