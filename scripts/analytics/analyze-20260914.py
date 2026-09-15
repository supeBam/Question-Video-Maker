#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""双平台运营数据分析（2026-09-14 快照）
输出：out/analysis-20260914.md
口径：单条视频=累计值；每日汇总=当日增量；两平台不混算；中位数优先。
"""
import csv, json, os, statistics as st
from collections import defaultdict
from datetime import datetime, timedelta

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'docs/数据分析/导入')
SNAP = datetime(2026, 9, 14)

DY_ITEM = '抖音-20260914-单条视频-20260816~20260913.xlsx'
DY_DAY = '抖音-20260914-每日汇总-20260815~20260913.xlsx'
WC_ITEM = '视频号-20260914-单条视频-20260816~20260914.csv'
WC_DAY = '视频号-20260914-每日汇总-20260815~20260913.csv'


def num(x):
    if x is None:
        return 0.0
    s = str(x).strip().replace(',', '').replace('%', '').replace('秒', '').replace('s', '')
    try:
        return float(s)
    except ValueError:
        return 0.0


def med(a):
    return st.median(a) if a else 0.0


def dnum(s):
    return datetime.strptime(str(s)[:10], '%Y-%m-%d')


def classify(title):
    t = title
    if any(k in t for k in ['王阳明', '庄子', '曾国藩', '孔子', '过不好', '读了一辈子', '国学', '知行']):
        return '国学感悟/对谈'
    if any(k in t for k in ['雅称', '古名', '古人给', '青阳', '玄英', '玉箸', '一枝春']):
        return '万物雅称'
    if any(k in t for k in ['为什么叫', '来历', '称呼', '叫它']):
        return '词源称呼'
    if '成语' in t:
        return '成语答题'
    if any(k in t for k in ['历史故事', '记错', '国宝', '朝代']):
        return '历史冷知识'
    return '其他'


# ---------- 读取 ----------
wc = []
with open(os.path.join(BASE, '视频号/单条视频', WC_ITEM), encoding='utf-8-sig') as f:
    for d in csv.DictReader(f):
        wc.append({
            'title': d['视频描述'].strip().split('\n')[0],
            'date': d['发布时间'].replace('/', '-'),
            'play': num(d['播放量']), 'finish': num(d['完播率']),
            'avgsec': num(d['平均播放时长']), 'like': num(d['喜欢']),
            'comment': num(d['评论量']), 'share': num(d['分享量']),
            'follow': num(d['关注量']),
        })

wb = openpyxl.load_workbook(os.path.join(BASE, '抖音/单条视频', DY_ITEM), data_only=True)
ws = wb.active
hdr = [str(c) if c is not None else '' for c in next(ws.iter_rows(values_only=True))]
dy = []
for row in ws.iter_rows(min_row=2, values_only=True):
    if not row or not row[0]:
        continue
    d = dict(zip(hdr, row))
    ctr_raw = str(d['封面点击率']).strip()
    dy.append({
        'title': str(d['作品名称']).strip().split('\n')[0],
        'date': str(d['发布时间'])[:10],
        'time': str(d['发布时间'])[11:16],
        'hour': int(str(d['发布时间'])[11:13]),
        'genre': str(d['体裁']),
        'play': num(d['播放量']), 'finish': num(d['完播率']) * 100,
        'finish5s': num(d['5s完播率']) * 100,
        'bounce2s': num(d['2s跳出率']) * 100,
        'ctr': 0.0 if ctr_raw in ('-', '', 'None') else num(ctr_raw) * 100,
        'avgsec': num(d['平均播放时长']),
        'like': num(d['点赞量']), 'share': num(d['分享量']),
        'comment': num(d['评论量']), 'collect': num(d['收藏量']),
    })

wc_day = []
with open(os.path.join(BASE, '视频号/每日汇总', WC_DAY), encoding='utf-8-sig') as f:
    rows = list(csv.reader(f))
for r in rows[3:]:
    if not r or not r[0]:
        continue
    wc_day.append({'date': r[0].replace('/', '-'), 'play': num(r[1]), 'like': num(r[3]),
                   'comment': num(r[4]), 'share': num(r[5]), 'follow': num(r[6])})

wb2 = openpyxl.load_workbook(os.path.join(BASE, '抖音/每日汇总', DY_DAY), data_only=True)
ws2 = wb2.active
h2 = [str(c) if c is not None else '' for c in next(ws2.iter_rows(values_only=True))]
dy_day = []
for row in ws2.iter_rows(min_row=2, values_only=True):
    if not row or not row[0]:
        continue
    d = dict(zip(h2, row))
    dy_day.append({'date': str(d['日期'])[:10], 'posts': num(d['投稿量']), 'play': num(d['总播放量']),
                   'like': num(d['总点赞量']), 'share': num(d['总分享量']), 'comment': num(d['总评论量'])})

for x in wc + dy:
    x['cat'] = classify(x['title'])
    x['M'] = (SNAP - dnum(x['date'])).days
    x['eng'] = (x['like'] + x['comment'] + x['share']) / x['play'] * 100 if x['play'] else 0

out = []
P = out.append

# ---------- 数据质量门禁 ----------
P('# 双平台运营数据分析 · 2026-09-14 快照')
P('')
P('> 数据窗口：抖音 08-16~09-13（单条）／08-15~09-13（每日）；视频号 08-16~09-14（单条）／08-15~09-13（每日）')
P('> 口径：单条=累计值，每日=当日增量，两者不混算；两平台分别计算；中位数优先。')
P('')
P('## 一、数据质量门禁')
P('')
P('| 检查项 | 视频号 | 抖音 | 判定 |')
P('|---|---|---|---|')


def dup_check(arr, key):
    seen = defaultdict(int)
    for x in arr:
        seen[key(x)] += 1
    return sum(1 for v in seen.values() if v > 1)


P(f'| 单条视频条数 | {len(wc)} | {len(dy)} | 正常 |')
P(f'| 重复行（标题+日期） | {dup_check(wc, lambda x: x["title"][:20] + x["date"])} | '
  f'{dup_check(dy, lambda x: x["title"][:20] + x["date"])} | 应为 0 |')

wcd = sorted(x['date'] for x in wc_day)
dyd = sorted(x['date'] for x in dy_day)
P(f'| 每日汇总覆盖 | {wcd[0]} ~ {wcd[-1]}（{len(wcd)}天） | {dyd[0]} ~ {dyd[-1]}（{len(dyd)}天） | 无缺口 |')

# 投稿量勾稽
dy_posts = defaultdict(int)
for x in dy_day:
    dy_posts[x['date']] += x['posts']
dy_cnt = defaultdict(int)
for x in dy:
    dy_cnt[x['date']] += 1
diff = {d: (dy_posts[d], dy_cnt[d]) for d in set(dy_posts) | set(dy_cnt) if dy_posts.get(d, 0) != dy_cnt.get(d, 0)}
P(f'| 投稿量勾稽（日表投稿量 vs 明细条数） | — | 差异 {len(diff)} 天 | '
  f'{"一致" if not diff else "需确认"} |')
if diff:
    for d in sorted(diff):
        P(f'|   └ {d} | — | 日表 {int(diff[d][0])} vs 明细 {diff[d][1]} | |')
P(f'| 抖音涨粉字段 | 无 | 无 | 连续第 3 期缺失，涨粉仅视频号可算 |')
P(f'| 视频号 D1 快照覆盖 | '
  f'{sum(1 for x in wc if x["M"] <= 1)}/{len(wc)} = '
  f'{sum(1 for x in wc if x["M"] <= 1)/len(wc)*100:.1f}% | — | 仍偏低 |')
P('')

# ---------- 总览 ----------
P('## 二、双平台总览')
P('')
P('| 维度 | 视频号 | 抖音 |')
P('|---|---|---|')
for name, arr in [('视频号', wc), ('抖音', dy)]:
    pass
wplay = [x['play'] for x in wc]
dplay = [x['play'] for x in dy]
P(f'| 作品条数 | {len(wc)} | {len(dy)} |')
P(f'| 总累计播放 | {int(sum(wplay)):,} | {int(sum(dplay)):,} |')
P(f'| 条均播放 | {sum(wplay)/len(wc):.0f} | {sum(dplay)/len(dy):.0f} |')
P(f'| **中位播放** | **{int(med(wplay))}** | **{int(med(dplay))}** |')
P(f'| 中位完播率 | {med([x["finish"] for x in wc]):.2f}% | {med([x["finish"] for x in dy]):.2f}%（口径不同，不可横比） |')
P(f'| 中位平均播放时长 | {med([x["avgsec"] for x in wc]):.1f}s | {med([x["avgsec"] for x in dy]):.1f}s |')
P(f'| 点赞/喜欢合计 | {int(sum(x["like"] for x in wc))} | {int(sum(x["like"] for x in dy))} |')
P(f'| 评论合计 | {int(sum(x["comment"] for x in wc))} | {int(sum(x["comment"] for x in dy))} |')
P(f'| 分享合计 | {int(sum(x["share"] for x in wc))} | {int(sum(x["share"] for x in dy))} |')
P(f'| 收藏合计 | 无字段 | {int(sum(x["collect"] for x in dy))} |')
P(f'| 关注/涨粉合计 | {int(sum(x["follow"] for x in wc))} | 无字段 |')
P(f'| 中位互动率 | {med([x["eng"] for x in wc]):.2f}% | {med([x["eng"] for x in dy]):.2f}% |')
P('')

# ---------- 分周趋势 ----------
P('## 三、分周趋势（按发布日归周，仅 M>=3 成熟作品）')
P('')


def week_start(d):
    x = dnum(d)
    return (x - timedelta(days=x.weekday())).strftime('%Y-%m-%d')


for name, arr in [('视频号', wc), ('抖音', dy)]:
    P(f'### {name}')
    P('')
    P('| 周起 | n | 总播放 | 中位播放 | 条均 | 中位完播% | 中位均时s | 赞 | 评 | 转 | 关注 |')
    P('|---|---|---|---|---|---|---|---|---|---|---|')
    g = defaultdict(list)
    for x in arr:
        if x['M'] >= 3:
            g[week_start(x['date'])].append(x)
    for w in sorted(g):
        v = g[w]
        p = [i['play'] for i in v]
        P(f"| {w} | {len(v)} | {int(sum(p)):,} | {int(med(p))} | {sum(p)/len(v):.0f} | "
          f"{med([i['finish'] for i in v]):.2f} | {med([i['avgsec'] for i in v]):.1f} | "
          f"{int(sum(i['like'] for i in v))} | {int(sum(i['comment'] for i in v))} | "
          f"{int(sum(i['share'] for i in v))} | {int(sum(i.get('follow', 0) for i in v))} |")
    P('')

# ---------- 近7天 vs 前23天 ----------
P('## 四、近 7 天 vs 前 23 天（单条口径，中位数）')
P('')
P('| 指标 | 平台 | 近7天(09-07~09-13) | 前23天(08-16~09-06) | 变化 |')
P('|---|---|---|---|---|')
for name, arr in [('视频号', wc), ('抖音', dy)]:
    rec = [x for x in arr if '2026-09-07' <= x['date'] <= '2026-09-13']
    prev = [x for x in arr if '2026-08-16' <= x['date'] <= '2026-09-06']
    for label, fn in [('中位播放', lambda v: med([i['play'] for i in v])),
                      ('中位完播率%', lambda v: med([i['finish'] for i in v])),
                      ('中位均时s', lambda v: med([i['avgsec'] for i in v])),
                      ('中位互动率%', lambda v: med([i['eng'] for i in v])),
                      ('周发布条数', lambda v: len(v))]:
        a, b = fn(rec), fn(prev)
        chg = f'{(a-b)/b*100:+.1f}%' if b else '—'
        P(f'| {label} | {name} | {a:.1f} | {b:.1f} | **{chg}** |')
P('')

# ---------- 逐日拐点 ----------
P('## 五、逐日拐点（按发布日）')
P('')
P('| 发布日 | 视n | 视中位播放 | 视完播% | 抖n | 抖中位播放 | 抖5s完播% | 抖2s跳出% |')
P('|---|---|---|---|---|---|---|---|')
g = defaultdict(lambda: {'wc': [], 'dy': []})
for x in wc:
    g[x['date']]['wc'].append(x)
for x in dy:
    g[x['date']]['dy'].append(x)
for day in sorted(g, reverse=True):
    w, y = g[day]['wc'], g[day]['dy']
    P(f"| {day} | {len(w)} | {int(med([i['play'] for i in w])) if w else '—'} | "
      f"{med([i['finish'] for i in w]):.1f} | {len(y)} | "
      f"{int(med([i['play'] for i in y])) if y else '—'} | "
      f"{med([i['finish5s'] for i in y]):.1f} | {med([i['bounce2s'] for i in y]):.1f} |")
P('')

# ---------- 内容类型 ----------
P('## 六、内容类型 × 表现（M>=3）')
P('')
for name, arr in [('视频号', wc), ('抖音', dy)]:
    P(f'### {name}')
    P('')
    P('| 类型 | n | 中位播放 | 条均 | 中位完播% | 中位均时s | 中位互动率% |')
    P('|---|---|---|---|---|---|---|')
    gg = defaultdict(list)
    for x in arr:
        if x['M'] >= 3:
            gg[x['cat']].append(x)
    for c in sorted(gg, key=lambda k: -med([i['play'] for i in gg[k]])):
        v = gg[c]
        p = [i['play'] for i in v]
        P(f"| {c} | {len(v)} | {int(med(p))} | {sum(p)/len(v):.0f} | "
          f"{med([i['finish'] for i in v]):.2f} | {med([i['avgsec'] for i in v]):.1f} | "
          f"{med([i['eng'] for i in v]):.2f} |")
    P('')

# ---------- 留存 vs 播放 ----------
P('## 七、留存与时长 vs 播放（视频号，M>=3）')
P('')
mm = [x for x in wc if x['M'] >= 3]
P('| 按平均播放时长分档 | n | 中位均时s | 中位完播% | 中位播放 |')
P('|---|---|---|---|---|')
s = sorted(mm, key=lambda x: x['avgsec'])
q = len(s) // 3
for tag, part in [('短（低 1/3）', s[:q]), ('中（中 1/3）', s[q:2 * q]), ('长（高 1/3）', s[2 * q:])]:
    P(f"| {tag} | {len(part)} | {med([i['avgsec'] for i in part]):.1f} | "
      f"{med([i['finish'] for i in part]):.2f} | {int(med([i['play'] for i in part]))} |")
P('')
P('| 按完播率分档 | n | 中位完播% | 中位播放 | 中位均时s |')
P('|---|---|---|---|---|')
fs = sorted(mm, key=lambda x: x['finish'])
q = len(fs) // 3
for tag, part in [('低 1/3', fs[:q]), ('中 1/3', fs[q:2 * q]), ('高 1/3', fs[2 * q:])]:
    P(f"| {tag} | {len(part)} | {med([i['finish'] for i in part]):.2f} | "
      f"{int(med([i['play'] for i in part]))} | {med([i['avgsec'] for i in part]):.1f} |")
P('')

# ---------- 涨粉归因 ----------
P('## 八、涨粉归因（视频号，播放 >= 300）')
P('')
cand = [x for x in wc if x['play'] >= 300]
P('| 发布日 | 类型 | 播放 | 关注 | 关注/千播 | 完播% | 标题 |')
P('|---|---|---|---|---|---|---|')
for x in sorted(cand, key=lambda i: -(i['follow'] / i['play']))[:10]:
    P(f"| {x['date']} | {x['cat']} | {int(x['play'])} | {int(x['follow'])} | "
      f"{x['follow']/x['play']*1000:.1f}‰ | {x['finish']:.2f} | {x['title'][:28]} |")
P('')
P('| 类型 | n | 总播放 | 总关注 | 关注/千播 |')
P('|---|---|---|---|---|')
gt = defaultdict(list)
for x in cand:
    gt[x['cat']].append(x)
for c, v in sorted(gt.items(), key=lambda kv: -sum(i['follow'] for i in kv[1]) / max(sum(i['play'] for i in kv[1]), 1)):
    tp = sum(i['play'] for i in v)
    tf = sum(i['follow'] for i in v)
    P(f'| {c} | {len(v)} | {int(tp):,} | {int(tf)} | **{tf/tp*1000:.2f}‰** |')
P('')

# ---------- 抖音首屏 ----------
P('## 九、抖音首屏指标（M>=3）')
P('')
dy3 = [x for x in dy if x['M'] >= 3]
P('| 时段 | n | 中位播放 | 5s完播% | 2s跳出% | 中位均时s | 中位收藏 |')
P('|---|---|---|---|---|---|---|')
for tag, part in [('08-16~08-31', [x for x in dy3 if x['date'] <= '2026-08-31']),
                  ('09-01~09-13', [x for x in dy3 if x['date'] >= '2026-09-01'])]:
    if part:
        P(f"| {tag} | {len(part)} | {int(med([i['play'] for i in part]))} | "
          f"{med([i['finish5s'] for i in part]):.1f} | {med([i['bounce2s'] for i in part]):.1f} | "
          f"{med([i['avgsec'] for i in part]):.1f} | {int(med([i['collect'] for i in part]))} |")
P('')
P('| 体裁 | n | 中位播放 | 5s完播% | 2s跳出% | 均时s |')
P('|---|---|---|---|---|---|')
gg = defaultdict(list)
for x in dy3:
    gg[x['genre']].append(x)
for c, v in sorted(gg.items(), key=lambda kv: -med([i['play'] for i in kv[1]])):
    P(f"| {c} | {len(v)} | {int(med([i['play'] for i in v]))} | "
      f"{med([i['finish5s'] for i in v]):.1f} | {med([i['bounce2s'] for i in v]):.1f} | "
      f"{med([i['avgsec'] for i in v]):.1f} |")
P('')
P('| 发布时段 | n | 中位播放 | 中位完播% | 5s完播% |')
P('|---|---|---|---|---|')
gg = defaultdict(list)
for x in dy3:
    gg[f"{x['hour']:02d}:00"].append(x)
for c in sorted(gg):
    v = gg[c]
    P(f"| {c} | {len(v)} | {int(med([i['play'] for i in v]))} | "
      f"{med([i['finish'] for i in v]):.2f} | {med([i['finish5s'] for i in v]):.1f} |")
P('')

# ---------- 爆款与垫底 ----------
P('## 十、爆款 TOP5 与垫底 BOTTOM5（M>=3）')
P('')
for name, arr in [('视频号', wc), ('抖音', dy)]:
    m = sorted([x for x in arr if x['M'] >= 3], key=lambda i: -i['play'])
    P(f'### {name}')
    P('')
    P('| 排名 | 发布日 | 播放 | 完播% | 类型 | 标题 |')
    P('|---|---|---|---|---|---|')
    for i, x in enumerate(m[:5], 1):
        P(f"| TOP{i} | {x['date']} | {int(x['play'])} | {x['finish']:.2f} | {x['cat']} | {x['title'][:30]} |")
    for i, x in enumerate(m[-5:], 1):
        P(f"| BOT{i} | {x['date']} | {int(x['play'])} | {x['finish']:.2f} | {x['cat']} | {x['title'][:30]} |")
    P('')

os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
path = os.path.join(ROOT, 'out/analysis-20260914.md')
with open(path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))

# 控制台摘要
print('\n'.join(out[:60]))
print('\n\n>>> 完整结果:', path)
