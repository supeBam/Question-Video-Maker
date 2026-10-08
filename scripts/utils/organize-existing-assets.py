#!/usr/bin/env python3
"""整理历史素材到新的扁平化结构

扫描 out/ 目录，识别项目并整理素材

用法：
    python scripts/utils/organize-existing-assets.py --dry-run  # 预览
    python scripts/utils/organize-existing-assets.py            # 执行
"""
import os
import re
import shutil
import json
import argparse
from pathlib import Path
from datetime import datetime

# 项目识别规则
PROJECT_PATTERNS = [
    # 地名唠嗑-张掖01-成片.mp4
    (r"地名唠嗑-(\w+)(\d+)", "地名中国", "口播视频"),
    # 成语-第17期.mp4
    (r"成语-第(\d+)期", "成语系列", "题目视频"),
    # 雅称-第05期
    (r"雅称-第(\d+)期", "雅称系列", "题目视频"),
]

def parse_filename(filename):
    """从文件名解析项目信息"""
    for pattern, series, category in PROJECT_PATTERNS:
        match = re.search(pattern, filename)
        if match:
            groups = match.groups()
            if len(groups) == 2:
                name, episode = groups
                return name, episode, series, category
            elif len(groups) == 1:
                episode = groups[0]
                return series, episode, series, category
    return None, None, None, None

def find_related_files(base_name, out_dir):
    """找到相关的文件"""
    video_file = None
    cover_file = None
    image_files = []

    # 找成片
    for f in out_dir.glob(f"*{base_name}*.mp4"):
        video_file = f
        break

    # 找封面和配图
    for f in out_dir.glob(f"*{base_name}*.png"):
        if "封面" in f.name or "cover" in f.name.lower():
            cover_file = f
        else:
            image_files.append(f)

    # 找配图目录
    project_dir = out_dir / base_name
    if project_dir.exists() and project_dir.is_dir():
        for f in project_dir.glob("*.png"):
            image_files.append(f)

    return video_file, cover_file, image_files

def suggest_tags_for_image(filename, prompt=None):
    """根据文件名和prompt建议标签"""
    tags = []

    # 地标
    landmarks = {
        "嘉峪关": ["嘉峪关", "甘肃", "关隘", "地标", "明长城"],
        "西安": ["西安", "陕西", "古城", "地标"],
        "洛阳": ["洛阳", "河南", "古都", "地标"],
    }
    for key, tag_list in landmarks.items():
        if key in filename:
            tags.extend(tag_list)

    # 人物
    persons = {
        "张三丰": ["张三丰", "人物", "道士", "武当", "明朝"],
        "韩信": ["韩信", "人物", "将军", "汉朝"],
    }
    for key, tag_list in persons.items():
        if key in filename:
            tags.extend(tag_list)

    # 自然
    nature_keywords = {
        "山": ["山水", "自然"],
        "河": ["河流", "山水", "自然"],
        "日落": ["日落", "自然", "傍晚"],
    }
    for key, tag_list in nature_keywords.items():
        if key in filename:
            tags.extend(tag_list)

    return list(set(tags)) if tags else ["待分类"]

def organize_project(name, episode, series, category, video_file, cover_file, image_files, dry_run=False):
    """整理一个项目"""
    print(f"\n处理：{name} 第{episode}期 ({series})")

    # 创建项目目录
    project_dir = Path(f"projects/{category}/{series}/{episode.zfill(2)}-{name}")

    if not dry_run:
        project_dir.mkdir(parents=True, exist_ok=True)
        (project_dir / "video").mkdir(exist_ok=True)
        (project_dir / "images").mkdir(exist_ok=True)

    # project.json
    project_config = {
        "project_id": f"{name}-{episode.zfill(2)}",
        "title": name,
        "series": series,
        "episode": int(episode),
        "created_at": datetime.now().isoformat(),
        "status": "published",
        "files": {},
        "assets_used": {
            "from_library": [],
            "project_specific": []
        }
    }

    # 移动成片
    if video_file:
        dest = project_dir / "video" / video_file.name
        print(f"  成片：{video_file.name}")
        if not dry_run:
            shutil.move(str(video_file), str(dest))
        project_config["files"]["video"] = f"video/{video_file.name}"

    # 移动封面（项目专属）
    if cover_file:
        dest = project_dir / "images" / "cover.png"
        print(f"  封面：{cover_file.name}")
        if not dry_run:
            shutil.move(str(cover_file), str(dest))
        project_config["files"]["cover"] = "images/cover.png"

    # 处理配图：一律添加到素材库（扁平化）
    for img_file in image_files:
        # 生成素材名称
        base_name = img_file.stem
        if name in base_name:
            asset_name = base_name
        else:
            asset_name = f"{name}-{base_name}"

        # 建议标签
        suggested_tags = suggest_tags_for_image(img_file.name)

        print(f"  配图：{img_file.name} -> assets/images/")
        print(f"       建议标签：{', '.join(suggested_tags)}")

        if not dry_run:
            # 这里不直接移动，而是记录下来
            # 实际添加需要用 add-asset.py 手动处理
            pass

        # 记录到project.json（待关联）
        project_config["assets_used"]["from_library"].append({
            "path": f"assets/images/{asset_name}.png",
            "tags": suggested_tags,
            "status": "pending"  # 待添加到素材库
        })

    # 保存project.json
    if not dry_run:
        with open(project_dir / "project.json", "w", encoding="utf-8") as f:
            json.dump(project_config, f, ensure_ascii=False, indent=2)

    print(f"  ✓ 项目目录：{project_dir}")

def organize_existing(dry_run=False):
    """整理所有历史素材"""
    out_dir = Path("out")

    if not out_dir.exists():
        print("out/ 目录不存在")
        return

    processed = set()

    # 扫描所有mp4
    for video_file in out_dir.glob("*.mp4"):
        if video_file.name.startswith("_"):
            continue

        name, episode, series, category = parse_filename(video_file.name)

        if not name:
            print(f"⚠️  无法识别：{video_file.name}")
            continue

        key = f"{series}-{name}-{episode}"
        if key in processed:
            continue
        processed.add(key)

        base_name = name if name != series else f"{series}{episode}"
        video, cover, images = find_related_files(base_name, out_dir)

        organize_project(name, episode, series, category, video, cover, images, dry_run)

    if not dry_run:
        print("\n✓ 整理完成")
        print("\n下一步：")
        print("  1. 检查 projects/ 目录的项目结构")
        print("  2. 使用 add-asset.py 将配图添加到素材库并打标签")
        print("  3. 运行 rebuild-index.py 重建索引")
    else:
        print("\n[预览模式] 未实际移动文件")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="整理历史素材")
    parser.add_argument("--dry-run", action="store_true", help="预览模式")
    args = parser.parse_args()

    organize_existing(args.dry_run)
