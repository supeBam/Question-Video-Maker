#!/usr/bin/env python3
"""搜索素材库（增强版，支持多标签）

用法：
    # 单标签搜索
    python scripts/utils/search-assets.py --tag 嘉峪关

    # 多标签搜索（AND，同时满足）
    python scripts/utils/search-assets.py --tags "嘉峪关,日落"

    # 多标签搜索（OR，满足任一）
    python scripts/utils/search-assets.py --tags-any "嘉峪关,山海关"

    # 按颜色搜索
    python scripts/utils/search-assets.py --color 金色

    # 按使用次数排序
    python scripts/utils/search-assets.py --tag 地标 --sort-by usage

    # 组合搜索
    python scripts/utils/search-assets.py --tags "地标,日落" --color 金色

    # 列出所有标签
    python scripts/utils/search-assets.py --list-tags
"""
import json
import argparse
from pathlib import Path
from collections import Counter

def load_tags_db():
    """加载标签数据库"""
    tags_file = Path("assets/tags.json")
    if not tags_file.exists():
        print("标签数据库不存在，请先添加素材")
        return None

    with open(tags_file, encoding="utf-8") as f:
        return json.load(f)

def search_by_tags_and(tags_data, tags):
    """按标签搜索（AND - 同时满足所有标签）"""
    if not tags:
        return []

    # 找到所有包含第一个标签的素材
    result_sets = []
    for tag in tags:
        if tag in tags_data["tag_index"]:
            result_sets.append(set(tags_data["tag_index"][tag]))
        else:
            # 如果某个标签不存在，返回空
            return []

    # 取交集
    results = set.intersection(*result_sets) if result_sets else set()
    return list(results)

def search_by_tags_or(tags_data, tags):
    """按标签搜索（OR - 满足任一标签）"""
    results = set()
    for tag in tags:
        if tag in tags_data["tag_index"]:
            results.update(tags_data["tag_index"][tag])
    return list(results)

def filter_by_color(tags_data, results, color):
    """按颜色过滤"""
    filtered = []
    for asset_path in results:
        asset_info = tags_data["assets"].get(asset_path, {})
        colors = asset_info.get("metadata", {}).get("colors", [])
        if color in colors:
            filtered.append(asset_path)
    return filtered

def sort_results(tags_data, results, sort_by):
    """排序结果"""
    if sort_by == "usage":
        # 按使用次数排序
        results.sort(key=lambda x: tags_data["assets"][x]["usage"]["count"], reverse=True)
    elif sort_by == "date":
        # 按创建时间排序
        results.sort(key=lambda x: tags_data["assets"][x]["metadata"]["created_at"], reverse=True)
    return results

def list_all_tags(tags_data):
    """列出所有标签及使用次数"""
    tag_counts = Counter()
    for asset_info in tags_data["assets"].values():
        for tag in asset_info.get("tags", []):
            tag_counts[tag] += 1

    print(f"共有 {len(tag_counts)} 个标签：\n")
    for tag, count in tag_counts.most_common():
        print(f"  {tag}: {count} 个素材")

def display_results(tags_data, results):
    """显示搜索结果"""
    if not results:
        print("未找到匹配的素材")
        return

    print(f"找到 {len(results)} 个素材：\n")
    for asset_path in results:
        asset_info = tags_data["assets"][asset_path]
        print(f"📷 {asset_info['filename']}")
        print(f"   路径：{asset_path}")
        print(f"   标签：{', '.join(asset_info['tags'][:10])}{'...' if len(asset_info['tags']) > 10 else ''}")
        print(f"   使用：{asset_info['usage']['count']} 次")
        if asset_info['metadata'].get('colors'):
            print(f"   色调：{', '.join(asset_info['metadata']['colors'])}")
        print()

def main():
    parser = argparse.ArgumentParser(description="搜索素材库")
    parser.add_argument("--tag", help="单个标签搜索")
    parser.add_argument("--tags", help="多标签搜索（AND），逗号分隔")
    parser.add_argument("--tags-any", help="多标签搜索（OR），逗号分隔")
    parser.add_argument("--color", help="按颜色过滤")
    parser.add_argument("--sort-by", choices=["usage", "date"], help="排序方式")
    parser.add_argument("--list-tags", action="store_true", help="列出所有标签")
    parser.add_argument("--limit", type=int, help="限制结果数量")
    args = parser.parse_args()

    # 加载数据库
    tags_data = load_tags_db()
    if not tags_data:
        return

    # 列出所有标签
    if args.list_tags:
        list_all_tags(tags_data)
        return

    # 执行搜索
    results = []

    if args.tag:
        # 单标签搜索
        tags = [args.tag]
        results = search_by_tags_and(tags_data, tags)
    elif args.tags:
        # 多标签 AND 搜索
        tags = [t.strip() for t in args.tags.split(",")]
        results = search_by_tags_and(tags_data, tags)
    elif args.tags_any:
        # 多标签 OR 搜索
        tags = [t.strip() for t in args.tags_any.split(",")]
        results = search_by_tags_or(tags_data, tags)
    else:
        parser.error("请至少指定一个搜索条件")

    # 按颜色过滤
    if args.color and results:
        results = filter_by_color(tags_data, results, args.color)

    # 排序
    if args.sort_by:
        results = sort_results(tags_data, results, args.sort_by)

    # 限制结果数量
    if args.limit:
        results = results[:args.limit]

    # 显示结果
    display_results(tags_data, results)

if __name__ == "__main__":
    main()
