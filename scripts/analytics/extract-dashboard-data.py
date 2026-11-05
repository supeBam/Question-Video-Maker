#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
看板数据提取脚本：从 docs/数据分析/导入/ 的 4 个平台导出文件 + docs/发布台账.md
提取结构化数据，输出 docs/数据分析/看板-data.json 供看板（看板.html）导入。

用法：
    python3 scripts/analytics/extract-dashboard-data.py --organize    # 自动识别+改名+归位（用户只把文件放进 导入/ 即可）
    python3 scripts/analytics/extract-dashboard-data.py               # 生成 看板-data.json
    python3 scripts/analytics/extract-dashboard-data.py --sync-seed   # 生成 JSON 并同步 看板.html 内嵌基线
    python3 scripts/analytics/extract-dashboard-data.py --to-csv      # 抖音单条视频 xlsx → out/ 下 UTF-8 CSV
                                                            # （macOS 无 Excel COM，供 build-ledger.mjs 使用）
规则（期号匹配方式与发布台账对齐）：
- 同一颗粒度目录下取「导出日」最新的文件（文件名第 2 段）。
- 同一条视频出现多份快照时，取导出日最新的那份（由看板导入合并时处理）。
- 期号/主题：按「平台 + 发布日期 + 发布时间」匹配发布台账；匹配不到再尝试
  「平台 + 发布日期 + 标题前缀」；仍匹配不到则期号记 ""（未识别，不猜测）。
"""
import csv
import datetime
import glob
import json
import os
import re
import shutil
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IMPORT_DIR = os.path.join(ROOT, "docs", "数据分析", "导入")
LEDGER_PATH = os.path.join(ROOT, "docs", "发布台账.md")
OUT_PATH = os.path.join(ROOT, "docs", "数据分析", "看板-data.json")

_XLSX_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


def _q(tag):
    return "{%s}%s" % (_XLSX_NS, tag)


def _col_index(letters):
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def read_xlsx_rows(path):
    """用标准库读取 xlsx 第一个工作表，返回按列对齐的行列表（首行为表头）。

    替代 openpyxl（xlsx 本质是 zip + XML），脚本因此零第三方依赖。
    日期列需以文本存储（本项目导出格式即如此）；缺失单元格返回 None。
    """
    def cell_value(c, shared):
        t = c.get("t")
        v = c.find(_q("v"))
        raw = v.text if v is not None else None
        if t == "s":
            return shared[int(raw)] if raw is not None else ""
        if t == "str":
            return raw or ""
        if t == "b":
            return "TRUE" if raw == "1" else "FALSE"
        return raw  # 数字按原样返回字符串

    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            sroot = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in sroot.findall(_q("si")):
                shared.append("".join(t.text or "" for t in si.iter(_q("t"))))
        # 解析第一个工作表（workbook.xml 中 sheets 的顺序即工作表顺序）
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        first_sheet = wb.find(_q("sheets")).find(_q("sheet"))
        rid = first_sheet.get("{%s}id" % "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        target = None
        for rel in rels:
            if rel.get("Id") == rid:
                target = rel.get("Target")
                break
        if not target:
            raise ValueError("无法在工作簿关系中找到第一个工作表")
        if not target.startswith("xl/"):
            target = "xl/" + target.lstrip("/")
        root = ET.fromstring(z.read(target))
        rows = []
        for row_el in root.findall(".//" + _q("row")):
            cells = {}
            width = 0
            for c in row_el.findall(_q("c")):
                m = re.match(r"([A-Z]+)\d+", c.get("r") or "")
                if not m:
                    continue
                idx = _col_index(m.group(1))
                cells[idx] = cell_value(c, shared)
                width = max(width, idx + 1)
            if not cells:
                continue
            rows.append([cells.get(i) for i in range(width)])
        return rows


def newest_file(pattern):
    """按文件名第 2 段（导出日 YYYYMMDD）取最新文件。"""
    files = sorted(glob.glob(pattern))
    if not files:
        return None
    def export_date(p):
        m = re.search(r"-(\d{8})-", os.path.basename(p))
        return m.group(1) if m else "00000000"
    return max(files, key=export_date)


def to_num(v):
    if v is None:
        return 0
    s = str(v).strip().replace(",", "").replace("%", "")
    # 视频号「平均播放时长」为「32.35秒」格式，清洗中文单位后缀
    s = s.replace("秒", "")
    if s in ("", "-", "—"):
        return 0
    try:
        return float(s)
    except ValueError:
        return 0


def norm_date(s):
    """统一日期为 YYYY-MM-DD（视频号导出常为 YYYY/MM/DD）。"""
    return (s or "").strip().replace("/", "-")[:10]


def norm_pub(s):
    """发布时间字符串 → (日期, 时间HH:MM)。"""
    s = (s or "").strip().replace("/", "-")
    parts = s.split(" ")
    return parts[0][:10], (parts[1][:5] if len(parts) > 1 else "")


# ---------- 发布台账 ----------
def load_ledger():
    """返回 [(date, time, platform, issue, json_file, title)]。"""
    rows = []
    with open(LEDGER_PATH, encoding="utf-8") as f:
        for line in f:
            if not line.strip().startswith("|"):
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) < 6 or cells[0] in ("发布日期", "--------------") or set(cells[0]) <= {"-"}:
                continue
            d, t, p, issue, jf, title = cells[0], cells[1], cells[2], cells[3], cells[4], cells[5]
            if not re.match(r"\d{4}-\d{2}-\d{2}", d):
                continue
            t = "" if t in ("—", "") else t
            rows.append({"date": d, "time": t, "platform": p, "issue": issue,
                         "jsonFile": jf, "title": title})
    return rows


def match_ledger(ledger, platform, date, time_str, title):
    """优先 平台+日期+时间；退而求其次 平台+日期+标题前缀（前 6 字）。"""
    for r in ledger:
        if r["platform"] == platform and r["date"] == date and r["time"] and time_str \
                and r["time"][:5] == time_str[:5]:
            return r
    prefix = (title or "")[:6]
    if prefix:
        for r in ledger:
            if r["platform"] == platform and r["date"] == date and r["title"].startswith(prefix):
                return r
    return None


def theme_of(issue):
    return issue.split(" · ")[0] if " · " in issue else issue


# ---------- 抖音 ----------
def parse_douyin_works():
    path = newest_file(os.path.join(IMPORT_DIR, "抖音", "单条视频", "*.xlsx"))
    if not path:
        return [], None
    export_day = re.search(r"-(\d{8})-", os.path.basename(path)).group(1)
    ledger = load_ledger()
    rows = read_xlsx_rows(path)
    header = [str(h or "").strip() for h in rows[0]]
    out = []
    for r in rows[1:]:
        if r[0] is None:
            continue
        item = dict(zip(["title", "pubtime", "genre", "status", "play", "completion",
                         "c5s", "ctr", "bounce2s", "avgDur", "likes", "shares",
                         "comments", "favorites", "profileVisits", "fans"], r))
        pub = str(item["pubtime"] or "")
        date, time_str = (pub.split(" ") + [""])[:2]
        m = match_ledger(ledger, "抖音", date, time_str, str(item["title"] or ""))
        issue = m["issue"] if m else ""
        play = int(to_num(item["play"]))
        # 清洗：播放为 0 的作品不存在留存样本，留存类字段统一归零
        # （抖音导出曾出现 play=0 但 c5s=100 的脏值，会污染留存统计）
        if play == 0:
            completion = c5s = bounce2s = avg_dur = 0.0
        else:
            completion = to_num(item["completion"]) * 100
            c5s = to_num(item["c5s"]) * 100
            bounce2s = to_num(item["bounce2s"]) * 100
            avg_dur = to_num(item["avgDur"])
        out.append({
            "platform": "douyin",
            "title": str(item["title"] or "").strip(),
            "date": date, "time": time_str[:5],
            "issue": issue, "theme": theme_of(issue),
            "play": play,
            "likes": int(to_num(item["likes"])),
            "comments": int(to_num(item["comments"])),
            "shares": int(to_num(item["shares"])),
            "favorites": int(to_num(item["favorites"])),
            "fans": int(to_num(item["fans"])),
            "completion": completion,
            "c5s": c5s,
            "bounce2s": bounce2s,
            "avgDur": avg_dur,
        })
    return out, export_day


def parse_douyin_daily():
    path = newest_file(os.path.join(IMPORT_DIR, "抖音", "每日汇总", "*.xlsx"))
    if not path:
        return []
    rows = read_xlsx_rows(path)
    out = []
    for r in rows[1:]:
        if r[0] is None:
            continue
        date = str(r[0])[:10]
        # 清洗：互动类字段出现负值（如取消点赞）时归零，避免负互动进账
        def nonneg(v):
            return max(0, int(to_num(v)))
        out.append({
            "date": date,
            "posts": int(to_num(r[1])),
            "play": int(to_num(r[2])),
            "likes": nonneg(r[3]),
            "shares": nonneg(r[4]),
            "comments": nonneg(r[5]),
        })
    return out


# ---------- 视频号 ----------
def parse_wechat_works():
    path = newest_file(os.path.join(IMPORT_DIR, "视频号", "单条视频", "*.csv"))
    if not path:
        return [], None
    export_day = re.search(r"-(\d{8})-", os.path.basename(path)).group(1)
    ledger = load_ledger()
    out = []
    with open(path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            desc = (row.get("视频描述") or "").replace("\n", " ").strip()
            date, time_str = norm_pub(row.get("发布时间") or "")
            m = match_ledger(ledger, "视频号", date, time_str, desc)
            issue = m["issue"] if m else ""
            out.append({
                "platform": "wechat",
                "title": desc,
                "date": date, "time": time_str[:5],
                "issue": issue, "theme": theme_of(issue),
                "play": int(to_num(row.get("播放量"))),
                "likes": int(to_num(row.get("喜欢"))),
                "comments": int(to_num(row.get("评论量"))),
                "shares": int(to_num(row.get("分享量"))),
                "favorites": 0,
                "fans": int(to_num(row.get("关注量"))),
                "recommend": int(to_num(row.get("推荐"))),
                "completion": to_num(row.get("完播率")),
                "avgDur": to_num(row.get("平均播放时长")),
            })
    return out, export_day


def parse_wechat_daily():
    path = newest_file(os.path.join(IMPORT_DIR, "视频号", "每日汇总", "*.csv"))
    if not path:
        return []
    out = []
    with open(path, encoding="utf-8-sig") as f:
        lines = [ln for ln in f if ln.strip()]
    # 前两行是标题与免责声明，第三行是表头
    header_idx = next(i for i, ln in enumerate(lines) if ln.lstrip("﻿").startswith('"时间"'))
    reader = csv.DictReader(lines[header_idx:])
    for row in reader:
        date = norm_date(row.get("时间") or "")
        if not re.match(r"\d{4}-\d{2}-\d{2}$", date):
            continue
        def nonneg(v):
            return max(0, int(to_num(v)))
        out.append({
            "date": date,
            "posts": 0,
            "play": nonneg(row.get("播放")),
            "likes": nonneg(row.get("喜欢")),
            "shares": nonneg(row.get("分享")),
            "comments": nonneg(row.get("评论")),
        })
    return out


def dump_douyin_csv():
    """抖音单条视频 xlsx → out/ 下 UTF-8 CSV（macOS 无 Excel COM，供 build-ledger.mjs 使用）。"""
    path = newest_file(os.path.join(IMPORT_DIR, "抖音", "单条视频", "*.xlsx"))
    if not path:
        print("未找到抖音单条视频 xlsx（导入/抖音/单条视频/）", file=sys.stderr)
        return 1
    export_day = re.search(r"-(\d{8})-", os.path.basename(path)).group(1)
    rows = read_xlsx_rows(path)
    out_dir = os.path.join(ROOT, "out")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"抖音-{export_day}-单条视频.csv")
    with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        for r in rows:
            w.writerow(["" if v is None else v for v in r])
    print(f"已转换 {out_path}（{len(rows) - 1} 行数据，表头 {len(rows[0]) if rows else 0} 列）")
    return 0


def sync_seed():
    """把 看板-data.json 同步进 看板.html 的 SEED_DATA 内嵌基线（打开即最新，免手动导入）。"""
    html_path = os.path.join(os.path.dirname(OUT_PATH), "看板.html")
    if not os.path.exists(html_path):
        print("未找到 看板.html，跳过 SEED 同步", file=sys.stderr)
        return 1
    with open(OUT_PATH, encoding="utf-8") as f:
        data = json.load(f)
    seed = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with open(html_path, encoding="utf-8") as f:
        html = f.read()
    # 函数式替换：re.sub 的替换串会解释 \n 等转义，必须用 lambda 原样写入
    pattern = re.compile(r"var SEED_DATA = \{.*?\};\s*// 内置基线快照", re.S)
    new_html, n = pattern.subn(lambda m: "var SEED_DATA = " + seed + ";   // 内置基线快照", html)
    if n != 1:
        print(f"SEED_DATA 匹配次数异常（{n}），跳过 HTML 更新", file=sys.stderr)
        return 1
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(new_html)
    print(f"已同步 SEED_DATA 到 {html_path}（{len(seed)} 字符）")
    return 0


def organize_imports():
    """扫描 导入/（根目录 + 四个子目录），自动识别平台/颗粒度并改名归位。

    用户只负责把平台后台原始导出的文件放进 docs/数据分析/导入/（根目录或任意子目录、
    名字随意），其余自动完成：
    - 识别：先看文件名关键词（平台原始导出文件名），判不了再看表头内容；
    - 改名：平台-导出日-颗粒度-数据窗口.ext；
    - 归位：移到 导入/{平台}/{颗粒度}/ 对应子目录；
    - 导出日：取文件导入时间（mtime）；若早于数据截止日则按数据截止日取；
    - 冲突/无法识别的不动、列出来请用户确认（不覆盖、不猜测）。
    """
    CONFORM_RE = re.compile(r"^(抖音|视频号)-\d{8}-(单条视频|每日汇总)-[\d~-]+\.(xlsx|csv)$")
    # 平台原始导出文件名 → (平台, 颗粒度)
    NAME_HINTS = [
        (["动态数据", "动态明细"], "视频号", "单条视频"),
        (["视频详情", "详情数据"], "视频号", "每日汇总"),
        (["作品列表", "列表导出"], "抖音", "单条视频"),
        (["全量指标", "数据表现", "短视频全量"], "抖音", "每日汇总"),
    ]

    def mtime_day(p):
        return datetime.datetime.fromtimestamp(os.path.getmtime(p)).strftime("%Y%m%d")

    def sniff_csv(path):
        """返回 (表头行, 表头行索引)。视频号每日汇总前两行是标题/免责声明。"""
        with open(path, encoding="utf-8-sig", errors="replace") as f:
            lines = [ln.strip() for ln in f if ln.strip()]
        for i, ln in enumerate(lines[:6]):
            s = ln.lstrip("﻿")
            if "视频描述" in s or "视频ID" in s or s.startswith('"时间"') \
                    or re.match(r'^"?时间"?[,，\t]', s):
                return s, i
        return (lines[0], 0) if lines else ("", 0)

    def sniff_xlsx(path):
        rows = read_xlsx_rows(path)
        return ",".join(str(h or "") for h in (rows[0] if rows else []))

    def detect(name, header, ext):
        for keys, plat, gran in NAME_HINTS:
            if any(k in name for k in keys):
                ext_plat = "抖音" if ext == ".xlsx" else "视频号"
                if plat != ext_plat:
                    return "", f"文件名提示「{plat}」与扩展名「{ext}」不符"
                return plat, gran
        platform = "抖音" if ext == ".xlsx" else "视频号"
        if platform == "视频号":
            if "视频描述" in header or "视频ID" in header:
                return platform, "单条视频"
            if "时间" in header:
                return platform, "每日汇总"
            return platform, ""
        if "作品名称" in header and "发布时间" in header:
            return platform, "单条视频"
        if "日期" in header and "投稿量" in header:
            return platform, "每日汇总"
        return platform, ""

    def dates_of(path, gran, ext):
        """返回日期列的全部原始值。"""
        vals = []
        if ext == ".xlsx":
            rows = read_xlsx_rows(path)
            if not rows:
                return vals
            header = [str(h or "").strip() for h in rows[0]]
            want = "发布时间" if gran == "单条视频" else "日期"
            col = next((i for i, h in enumerate(header) if h == want), 1 if gran == "单条视频" else 0)
            for r in rows[1:]:
                if r and col < len(r) and r[col]:
                    vals.append(str(r[col]))
        else:
            _, idx = sniff_csv(path)
            with open(path, encoding="utf-8-sig", errors="replace") as f:
                lines = [ln for ln in f if ln.strip()]
            if idx >= len(lines):
                return vals
            rows = list(csv.reader(lines[idx:]))
            if not rows:
                return vals
            header = [h.strip() for h in rows[0]]
            col = next((i for i, h in enumerate(header) if h in ("发布时间", "时间")), 0)
            for r in rows[1:]:
                if r and col < len(r) and r[col]:
                    vals.append(r[col])
        return vals

    roots = [IMPORT_DIR] + [
        os.path.join(IMPORT_DIR, p, g)
        for p in ("抖音", "视频号") for g in ("单条视频", "每日汇总")
    ]
    files = []
    seen = set()
    for root in roots:
        if not os.path.isdir(root):
            continue
        for name in sorted(os.listdir(root)):
            p = os.path.join(root, name)
            if not os.path.isfile(p):
                continue
            if name.startswith("~$"):  # Excel 临时锁文件
                continue
            ext = os.path.splitext(name)[1].lower()
            if ext not in (".xlsx", ".csv"):
                continue
            if p in seen:
                continue
            seen.add(p)
            files.append(p)

    renamed, skipped, conflicts, manual = [], [], [], []
    for p in files:
        name = os.path.basename(p)
        ext = os.path.splitext(name)[1].lower()
        if CONFORM_RE.match(name):
            parts = name.split("-")
            expect_dir = os.path.join(IMPORT_DIR, parts[0], parts[2])
            if os.path.dirname(p) != expect_dir:
                os.makedirs(expect_dir, exist_ok=True)
                tgt = os.path.join(expect_dir, name)
                if os.path.exists(tgt):
                    conflicts.append((name, "目标目录已存在同名文件"))
                else:
                    shutil.move(p, tgt)
                    renamed.append((name, os.path.relpath(tgt, IMPORT_DIR) + "（归位）"))
            else:
                skipped.append(name)
            continue
        header = sniff_xlsx(p) if ext == ".xlsx" else sniff_csv(p)[0]
        platform, gran = detect(name, header, ext)
        if gran.startswith("文件名提示"):
            manual.append((name, gran))
            continue
        if not gran:
            manual.append((name, "无法识别颗粒度（表头：" + header[:60] + "）"))
            continue
        valid = [norm_date(s) for s in dates_of(p, gran, ext)]
        valid = [d for d in valid if re.match(r"\d{4}-\d{2}-\d{2}$", d)]
        if not valid:
            manual.append((name, "未找到有效日期列，无法确定数据窗口"))
            continue
        lo, hi = min(valid), max(valid)
        export_day = mtime_day(p)
        note = ""
        if export_day < hi.replace("-", ""):
            export_day = hi.replace("-", "")
            note = f"（文件修改日早于数据截止日，导出日按 {hi} 取）"
        window = lo.replace("-", "") + "~" + hi.replace("-", "")
        new_name = f"{platform}-{export_day}-{gran}-{window}{ext}"
        target_dir = os.path.join(IMPORT_DIR, platform, gran)
        os.makedirs(target_dir, exist_ok=True)
        target = os.path.join(target_dir, new_name)
        if os.path.exists(target):
            conflicts.append((name, f"目标已存在：{new_name}"))
            continue
        shutil.move(p, target)
        renamed.append((name, os.path.relpath(target, IMPORT_DIR) + note))

    print("— 导入文件整理报告 —")
    for old, new in renamed:
        print(f"[改名] {old} → {new}")
    for n_ in skipped:
        print(f"[跳过-已合规] {n_}")
    for name, why in conflicts:
        print(f"[冲突-未动] {name}（{why}）")
    for name, why in manual:
        print(f"[需人工确认] {name}：{why}")
    print(f"改名/归位 {len(renamed)} · 已合规 {len(skipped)} · 冲突 {len(conflicts)} · 需人工 {len(manual)}")
    return 0


def main():
    if "--organize" in sys.argv:
        sys.exit(organize_imports())
    if "--to-csv" in sys.argv:
        sys.exit(dump_douyin_csv())
    dw, de = parse_douyin_works()
    dd = parse_douyin_daily()
    ww, we = parse_wechat_works()
    wd = parse_wechat_daily()
    data = {
        "version": 1,
        "exportDay": max(x for x in [de, we] if x),
        "douyinWorks": dw, "douyinDaily": dd,
        "wechatWorks": ww, "wechatDaily": wd,
    }
    unmatched = [w for w in dw + ww if not w["issue"]]
    zero_play_cleaned = sum(1 for w in dw if w["play"] == 0)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"已输出 {OUT_PATH}")
    print(f"抖音作品 {len(dw)} 条 / 每日 {len(dd)} 天；视频号作品 {len(ww)} 条 / 每日 {len(wd)} 天")
    print(f"未匹配期号 {len(unmatched)} 条（保留空期号，可在看板中标记为纯内容视频）")
    print(f"数据清洗：抖音 0 播放作品 {zero_play_cleaned} 条（留存字段归零）；"
          f"视频号平均播放时长解析 {sum(1 for w in ww if w['avgDur'] > 0)}/{len(ww)} 条非零")
    if "--sync-seed" in sys.argv:
        sync_seed()


if __name__ == "__main__":
    main()
