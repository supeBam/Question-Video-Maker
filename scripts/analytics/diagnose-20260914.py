#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""限流验证 + 账号级流量趋势 + 成熟度校正（2026-09-14 快照）"""
import csv, os, statistics as st
from datetime import datetime

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, 'docs/数据分析/导入')
SNAP = datetime(2026, 9, 14)


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


wc = []
with open(os.path.join(BASE, '视频号/单条视频/视频号-20260914-单条视频-20260816~20260914.csv'),
          encoding='utf-8-sig') as f:
    for d in csv.DictReader(f):
        wc.append({'d': d['发布时间'].replace('/', '-'), 't': d['视频描述'].strip().split('\n')[0][:24],
                   'rec': num(d['推荐']), 'play': num(d['播放量']), 'fin': num(d['完播率']),
                   'share': num(d['分享量']), 'foll': num(d['关注量']),
                   'fwd': num(d['转发聊天和朋友圈'])})

print('=' * 76)
print('【A】视频号「推荐」字段 —— 是否账号级限流')
print(f"{'发布日':<12}{'推荐':>7}{'播放':>7}{'完播%':>7}{'分享':>6}{'转聊':>6}  标题")
for x in wc[:20]:
    print(f"{x['d']:<12}{int(x['rec']):>7}{int(x['play']):>7}{x['fin']:>7.2f}{int(x['share']):>6}{int(x['fwd']):>6}  {x['t']}")
a = [x for x in wc if x['d'] <= '2026-09-09']
b = [x for x in wc if x['d'] >= '2026-09-10']
print(f"\n  09-09及以前: n={len(a):<3} 中位推荐={med([x['rec'] for x in a]):>8.0f} 中位播放={med([x['play'] for x in a]):>6.0f}")
print(f"  09-10及以后: n={len(b):<3} 中位推荐={med([x['rec'] for x in b]):>8.0f} 中位播放={med([x['play'] for x in b]):>6.0f}")

print('\n' + '=' * 76)
print('【B】账号级日流量（每日汇总 = 当日新增播放，不受单条成熟度影响）')
wcd = []
with open(os.path.join(BASE, '视频号/每日汇总/视频号-20260914-每日汇总-20260815~20260913.csv'),
          encoding='utf-8-sig') as f:
    for r in list(csv.reader(f))[3:]:
        if r and r[0]:
            wcd.append({'d': r[0].replace('/', '-'), 'play': num(r[1]), 'share': num(r[5]),
                        'foll': num(r[6])})
wb = openpyxl.load_workbook(os.path.join(BASE, '抖音/每日汇总/抖音-20260914-每日汇总-20260815~20260913.xlsx'),
                            data_only=True)
ws = wb.active
h = [str(c) if c is not None else '' for c in next(ws.iter_rows(values_only=True))]
dyd = []
for row in ws.iter_rows(min_row=2, values_only=True):
    if not row or not row[0]:
        continue
    d = dict(zip(h, row))
    dyd.append({'d': str(d['日期'])[:10], 'posts': num(d['投稿量']), 'play': num(d['总播放量']),
                'like': num(d['总点赞量'])})

print(f"{'日期':<12}{'视日播':>8}{'视分享':>7}{'视关注':>7} | {'抖投稿':>6}{'抖日播':>8}{'抖赞':>6}")
m = {x['d']: x for x in dyd}
for x in sorted(wcd, key=lambda i: i['d'], reverse=True):
    y = m.get(x['d'], {})
    print(f"{x['d']:<12}{int(x['play']):>8}{int(x['share']):>7}{int(x['foll']):>7} | "
          f"{int(y.get('posts', 0)):>6}{int(y.get('play', 0)):>8}{int(y.get('like', 0)):>6}")


def seg(arr, f, t):
    return [x['play'] for x in arr if f <= x['d'] <= t]


for nm, arr in [('视频号', wcd), ('抖音', dyd)]:
    r7 = seg(arr, '2026-09-07', '2026-09-13')
    p23 = seg(arr, '2026-08-15', '2026-09-06')
    print(f"\n  {nm}: 近7天日均={sum(r7)/len(r7):.0f}  前23天日均={sum(p23)/len(p23):.0f}  "
          f"变化={(sum(r7)/len(r7))/(sum(p23)/len(p23))*100-100:+.1f}%")
    for tag, f, t in [('W1 08-15~08-21', '2026-08-15', '2026-08-21'),
                      ('W2 08-22~08-28', '2026-08-22', '2026-08-28'),
                      ('W3 08-29~09-04', '2026-08-29', '2026-09-04'),
                      ('W4 09-05~09-11', '2026-09-05', '2026-09-11'),
                      ('近3天 09-11~09-13', '2026-09-11', '2026-09-13')]:
        v = seg(arr, f, t)
        print(f"    {tag}: 日均={sum(v)/len(v):.0f}（n={len(v)}天）")

print('\n' + '=' * 76)
print('【C】成熟度校正：最近作品是"真差"还是"没跑完"')
for x in wc:
    x['M'] = (SNAP - datetime.strptime(x['d'], '%Y-%m-%d')).days
for tag, lo, hi in [('M=0~1', 0, 1), ('M=2~3', 2, 3), ('M=4~6', 4, 6), ('M>=7', 7, 99)]:
    v = [x for x in wc if lo <= x['M'] <= hi]
    if v:
        print(f"  {tag}: n={len(v):<3} 中位播放={med([i['play'] for i in v]):>6.0f} "
              f"中位完播={med([i['fin'] for i in v]):>5.2f}% 中位推荐={med([i['rec'] for i in v]):>6.0f}")

print('\n  -- D1/D2 作品 vs 历史同期（M>=7 作品的终值中位）——')
base = med([x['play'] for x in wc if x['M'] >= 7])
print(f"  M>=7 中位播放（终值参照）= {base:.0f}")
for x in sorted([i for i in wc if i['M'] <= 3], key=lambda i: -i['play']):
    print(f"    {x['d']} M={x['M']} 播={int(x['play']):>5} 占终值参照 {x['play']/base*100:>5.1f}% "
          f"完播={x['fin']:>5.2f}% | {x['t']}")
