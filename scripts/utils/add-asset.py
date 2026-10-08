#!/usr/bin/env python3
"""添加素材到资产库

用法：
    python scripts/utils/add-asset.py \\
        --file /tmp/new-image.png \\
        --name "嘉峪关-雪景" \\
        --tags "嘉峪关,甘肃,河西走廊,雪景,冬天,地标,关隘" \\
        --prompt "嘉峪关雪景，白雪覆盖城墙"
"""
import json
import shutil
import argparse
from pathlib import Path
from datetime import datetime
import hashlib

def get_image_hash(file_path):
    """计算图片的 MD5 哈希值（用于检测重复）"""
    with open(file_path, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()

def load_tags_db():
    """加载标签数据库"""
    tags_file = Path("assets/tags.json")
    if tags_file.exists():
        with open(tags_file, encoding="utf-8") as f:
            return json.load(f)
    else:
        return {
            "version": "1.0",
            "last_updated": None,
            "assets": {},
            "tag_index": {}
        }

def save_tags_db(tags_data):
    """保存标签数据库"""
    tags_data["last_updated"] = datetime.now().isoformat()
    with open("assets/tags.json", "w", encoding="utf-8") as f:
        json.dump(tags_data, f, ensure_ascii=False, indent=2)

def add_asset(file_path, name, tags, prompt, generator="manual", colors=None):
    """添加素材到资产库"""
    file_path = Path(file_path)

    if not file_path.exists():
        print(f"错误：文件不存在 {file_path}")
        return False

    # 检查重复
    file_hash = get_image_hash(file_path)
    tags_data = load_tags_db()

    for asset_path, asset_info in tags_data["assets"].items():
        if asset_info.get("metadata", {}).get("hash") == file_hash:
            print(f"⚠️  素材已存在：{asset_path}")
            return False

    # 生成新文件名
    ext = file_path.suffix
    existing = list(Path("assets/images").glob(f"{name}-*{ext}"))
    seq = len(existing) + 1
    new_filename = f"{name}-{seq:03d}{ext}"
    dest_path = Path(f"assets/images/{new_filename}")

    # 确保目录存在
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    # 复制文件
    shutil.copy(file_path, dest_path)

    # 获取文件信息
    file_stat = dest_path.stat()

    # 解析标签
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    # 添加资产信息
    asset_key = str(dest_path)
    tags_data["assets"][asset_key] = {
        "id": f"img_{len(tags_data['assets']) + 1:04d}",
        "filename": new_filename,
        "tags": tag_list,
        "metadata": {
            "prompt": prompt,
            "colors": colors.split(",") if colors else [],
            "hash": file_hash,
            "file_size": file_stat.st_size,
            "created_at": datetime.now().isoformat(),
            "generator": generator
        },
        "usage": {
            "count": 0,
            "projects": []
        }
    }

    # 更新标签索引
    for tag in tag_list:
        if tag not in tags_data["tag_index"]:
            tags_data["tag_index"][tag] = []
        if asset_key not in tags_data["tag_index"][tag]:
            tags_data["tag_index"][tag].append(asset_key)

    # 保存
    save_tags_db(tags_data)

    print(f"✓ 素材已添加：{dest_path}")
    print(f"  标签（{len(tag_list)}）：{', '.join(tag_list)}")
    print(f"  ID：{tags_data['assets'][asset_key]['id']}")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="添加素材到资产库")
    parser.add_argument("--file", required=True, help="图片文件路径")
    parser.add_argument("--name", required=True, help="素材名称（如：嘉峪关-雪景）")
    parser.add_argument("--tags", required=True, help="标签，逗号分隔（如：嘉峪关,甘肃,雪景）")
    parser.add_argument("--prompt", required=True, help="生成提示词")
    parser.add_argument("--generator", default="manual", help="生成器（openLux/minimax/manual）")
    parser.add_argument("--colors", help="主色调，逗号分隔（如：白色,灰色）")
    args = parser.parse_args()

    add_asset(args.file, args.name, args.tags, args.prompt, args.generator, args.colors)
