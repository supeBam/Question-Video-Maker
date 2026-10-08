# 素材管理系统 v2.0 - 扁平化 + 全局标签库

本目录实现基于全局标签库的素材管理系统。

## 核心特性

- ✅ **多标签支持**：每张图片可以有任意多个标签
- ✅ **灵活搜索**：按标签、颜色、使用次数等多维度搜索
- ✅ **防重复**：自动检测重复图片（基于MD5）
- ✅ **使用追踪**：记录每张图在哪些项目中使用

## 目录结构

```
assets/
├── images/              # 扁平化存储所有图片
│   ├── 嘉峪关-日落全景-001.png
│   ├── 嘉峪关-雪景-002.png
│   ├── 张三丰-肖像-001.png
│   └── ...
├── tags.json           # 全局标签数据库
├── index.json          # 搜索索引（自动生成）
└── README.md

projects/               # 项目管理
└── 口播视频/
    └── 地名中国/
        └── 01-张掖/
            ├── project.json
            ├── video/
            │   └── 成片.mp4
            └── images/
                └── cover.png
```

## 命名规范

```
格式：{主题}-{描述}-{序号}.{ext}

示例：
嘉峪关-日落全景-001.png
嘉峪关-雪景-002.png
张三丰-肖像-001.png
```

## 工具脚本

### 1. 添加素材
```bash
python scripts/utils/add-asset.py \\
    --file /tmp/new.png \\
    --name "嘉峪关-雪景" \\
    --tags "嘉峪关,甘肃,雪景,冬天,地标,关隘" \\
    --prompt "嘉峪关雪景，白雪覆盖城墙" \\
    --colors "白色,灰色"
```

### 2. 搜索素材
```bash
# 单标签
python scripts/utils/search-assets.py --tag 嘉峪关

# 多标签（AND）
python scripts/utils/search-assets.py --tags "嘉峪关,日落"

# 多标签（OR）
python scripts/utils/search-assets.py --tags-any "嘉峪关,山海关"

# 按颜色
python scripts/utils/search-assets.py --tag 地标 --color 金色

# 按使用次数排序
python scripts/utils/search-assets.py --tag 地标 --sort-by usage

# 列出所有标签
python scripts/utils/search-assets.py --list-tags
```

### 3. 整理历史素材
```bash
# 预览
python scripts/utils/organize-existing-assets.py --dry-run

# 执行
python scripts/utils/organize-existing-assets.py
```

### 4. 重建索引
```bash
python scripts/utils/rebuild-index.py
```

## tags.json 格式

```json
{
  "version": "1.0",
  "last_updated": "2024-10-08T16:00:00Z",
  "assets": {
    "assets/images/嘉峪关-日落全景-001.png": {
      "id": "img_0001",
      "filename": "嘉峪关-日落全景-001.png",
      "tags": ["嘉峪关", "甘肃", "日落", "地标", "关隘"],
      "metadata": {
        "prompt": "嘉峪关雄关日落全景",
        "colors": ["金色", "橙色"],
        "hash": "abc123...",
        "created_at": "2024-09-01",
        "generator": "openLux"
      },
      "usage": {
        "count": 2,
        "projects": [
          {"project_id": "zhangye-01", "timestamp": "00:45"}
        ]
      }
    }
  },
  "tag_index": {
    "嘉峪关": ["assets/images/嘉峪关-日落全景-001.png"],
    "日落": ["assets/images/嘉峪关-日落全景-001.png"]
  }
}
```

## 标签建议

常用标签分类：

**地点**：嘉峪关、西安、洛阳、甘肃、陕西、河南

**分类**：地标、人物、山水、建筑、关隘

**时间**：日落、黄昏、冬天、雪景

**朝代**：汉朝、唐朝、明朝

**主题**：历史、军事、文化、自然

**风格**：写实、水墨、抽象

**色调**：金色、白色、灰色、蓝色
