#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""系列（母题）级归因：找出爆款断档的真正原因（2026-09-14 快照）"""
import csv, os, statistics as st
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'docs/数据分析/导入')


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


def series(t):
    if any(k in t for k in ['主角都是谁', '主角，你', '成语的主角', '主角']):
        return 'S1 成语典故·主角是谁'
    if any(k in t for k in ['出处大挑战', '出自哪本书', '出自']):
        return 'S2 成语出处·出自哪里'
    if any(k in t for k in ['本义', '理解反了', '理解错了', '用错', '古今意思', '意思全反']):
        return 'S3 成语语义·本义反转'
    if any(k in t for k in ['为什么叫', '来历', '称呼']):
        return 'S4 词源称呼·为什么叫'
    if any(k in t for k in ['雅称', '古名', '古人给', '青阳', '玉箸']):
        return 'S5 万物雅称'
    if any(k in t for k in ['王阳明', '庄子', '曾国藩', '孔子', '过不好', '读了一辈子']):
        return 'S6 国学感悟·对谈'
    return 'S7 其他/零散'


wc = []
with open(os.path.join(BASE, '视频号/单条视频/视频号-20260914-单条视频-20260816~20260914.csv'),
          encoding='utf-8-sig') as f:
    for d in csv.DictReader(f):
        t = d['视频描述'].strip().split('\n')[0]
        wc.append({'d': d['发布时间'].replace('/', '-'), 't': t, 's': series(t),
                   'play': num(d['播放量']), 'fin': num(d['完播率']),
                   'foll': num(d['关注量']), 'share': num(d['分享量'])})

print('=' * 78)
print('【D】视频号 · 系列（母题）级表现  —— 全量，按中位播放排序')
g = defaultdict(list)
for x in wc:
    g[x['s']].append(x)
print(f"{'系列':<22}{'n':>3}{'中位播放':>9}{'条均':>8}{'最高':>7}{'中位完播%':>10}{'总关注':>7}{'关注/千播':>10}")
print('-' * 78)
for c in sorted(g, key=lambda k: -med([i['play'] for i in g[k]])):
    v = g[c]
    p = [i['play'] for i in v]
    tp = sum(p)
    tf = sum(i['foll'] for i in v)
    print(f"{c:<22}{len(v):>3}{int(med(p)):>9}{tp/len(v):>8.0f}{int(max(p)):>7}"
          f"{med([i['fin'] for i in v]):>10.2f}{int(tf):>7}{tf/tp*1000:>10.2f}‰")

print('\n' + '=' * 78)
print('【E】各系列最后发布日 —— 查「爆款母题是否被停更」')
for c in sorted(g, key=lambda k: -med([i['play'] for i in g[k]])):
    v = sorted(g[c], key=lambda i: i['d'])
    print(f"  {c:<22} n={len(v):<3} 首={v[0]['d']}  末={v[-1]['d']}  "
          f"末条播放={int(v[-1]['play'])}  近7天(09-08后)发布数="
          f"{len([i for i in v if i['d']>='2026-09-08'])}")

print('\n' + '=' * 78)
print('【F】S1「成语典故·主角是谁」逐条轨迹（账号最强母题）')
for x in sorted(g['S1 成语典故·主角是谁'], key=lambda i: i['d']):
    print(f"  {x['d']}  播{int(x['play']):>6}  完播{x['fin']:>6.2f}%  关注{int(x['foll']):>3}  {x['t'][:38]}")

print('\n' + '=' * 78)
print('【G】爆款断档检验：每周 TOP1 / TOP3 播放')
by_w = defaultdict(list)
for x in wc:
    by_w[x['d'][:10]].append(x)
weeks = [('W 09-07~09-13', '2026-09-07', '2026-09-13'),
         ('W 08-31~09-06', '2026-08-31', '2026-09-06'),
         ('W 08-24~08-30', '2026-08-24', '2026-08-30'),
         ('W 08-17~08-23', '2026-08-17', '2026-08-23')]
for tag, f, t in weeks:
    v = sorted([i for i in wc if f <= i['d'] <= t], key=lambda i: -i['play'])
    if not v:
        continue
    top3 = ', '.join(f"{int(i['play'])}" for i in v[:3])
    print(f"  {tag}: n={len(v):<3} TOP1={int(v[0]['play']):<6} TOP3=[{top3}]  "
          f"中位={int(med([i['play'] for i in v]))}")

print('\n' + '=' * 78)
print('【H】近 7 天（09-08~09-14）发布内容清单与去向')
for x in sorted([i for i in wc if i['d'] >= '2026-09-08'], key=lambda i: i['d']):
    print(f"  {x['d']} {x['s']:<22} 播{int(x['play']):>6} 完播{x['fin']:>6.2f}% 关{int(x['foll']):>3} | {x['t'][:30]}")
