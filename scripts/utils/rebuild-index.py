#!/usr/bin/env python3
"""重建素材索引

扫描 assets/ 目录和 tags.json，生成搜索索引

用法：
    python scripts/utils/rebuild-index.py
"""
import json
from pathlib import Path
from datetime import datetime
from collections import Counter

def rebuild_index():
    """重建索引"""
    # 加载tags.json
    tags_file = Path("assets/tags.json")
    if not tags_file.exists():
        print("tags.json 不存在，无需重建索引")
        return

    with open(tags_file, encoding="utf-8") as f:
        tags_data = json.load(f)

    # 统计信息
    total_assets = len(tags_data.get("assets", {}))
    tag_counts = Counter()

    for asset_info in tags_data["assets"].values():
        for tag in asset_info.get("tags", []):
            tag_counts[tag] += 1

    # 生成index.json
    index = {
        "version": "1.0",
        "generated_at": datetime.now().isoformat(),
        "total_assets": total_assets,
        "total_tags": len(tag_counts),
        "top_tags": dict(tag_counts.most_common(20)),
        "stats": {
            "by_generator": {},
            "by_usage": {
                "unused": 0,
                "used_1_3": 0,
                "used_4_plus": 0
            }
        }
    }

    # 统计生成器
    for asset_info in tags_data["assets"].values():
        generator = asset_info.get("metadata", {}).get("generator", "unknown")
        index["stats"]["by_generator"][generator] = index["stats"]["by_generator"].get(generator, 0) + 1

        # 统计使用情况
        usage_count = asset_info.get("usage", {}).get("count", 0)
        if usage_count == 0:
            index["stats"]["by_usage"]["unused"] += 1
        elif usage_count <= 3:
            index["stats"]["by_usage"]["used_1_3"] += 1
        else:
            index["stats"]["by_usage"]["used_4_plus"] += 1

    # 保存索引
    with open("assets/index.json", "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    # 显示统计
    print("✓ 索引已重建：assets/index.json\n")
    print(f"素材总数：{total_assets}")
    print(f"标签总数：{len(tag_counts)}")
    print(f"\n最常用标签（Top 10）：")
    for tag, count in tag_counts.most_common(10):
        print(f"  {tag}: {count}")
    print(f"\n按生成器统计：")
    for gen, count in index["stats"]["by_generator"].items():
        print(f"  {gen}: {count}")
    print(f"\n使用情况：")
    print(f"  未使用：{index['stats']['by_usage']['unused']}")
    print(f"  使用1-3次：{index['stats']['by_usage']['used_1_3']}")
    print(f"  使用4次以上：{index['stats']['by_usage']['used_4_plus']}")

if __name__ == "__main__":
    rebuild_index()
