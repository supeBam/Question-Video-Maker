"""沿用现有逐字时间，按语义重分字幕，保持完整词语与书名短语。"""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];P=ROOT/'work/hypit-culture-1000/productions/pilot'
plain=lambda x:''.join(re.findall('[\u4e00-\u9fffA-Za-z0-9]',x))
splits={
 '在不少地方也被奉为财神':['在不少地方','也被奉为财神'],
 '不是拿青龙偃月刀的那位吗':['不是拿青龙偃月刀','的那位吗'],
 '可以翻翻这本一看就上瘾的中国文化1000问':['可以翻翻这本','一看就上瘾的','中国文化1000问'],
}
for j in json.loads((P/'jobs/shots.json').read_text()):
 path=P/'jobs'/f"{j['id']}-asr.json";d=json.loads(path.read_text());chars=d['chars'];pos=0;cues=[]
 for line in j['lines']:
  parts=[]
  for c in re.split('[，。？！、…；：]',line['text']):
   c=plain(c)
   if c:parts+=splits.get(c,[c])
  grouped=[];k=0
  while k<len(parts):
   c=parts[k]
   if len(c)<=2 and k+1<len(parts) and len(c+parts[k+1])<=11:c+=parts[k+1];k+=1
   grouped.append(c);k+=1
  for c in grouped:
   assert len(c)<=11,c
   n=len(c);cues.append({'text':c,'role':line['role'],'start':chars[pos]['start'],'end':max(chars[pos]['start']+.25,chars[pos+n-1]['end'])});pos+=n
 assert pos==len(chars),(j['id'],pos,len(chars))
 d['cues']=cues;d['cue_policy']='语义短句，96px，极短引语合并，书名按完整短语分两组';path.write_text(json.dumps(d,ensure_ascii=False,indent=2))
print('已复用逐字对齐，重排10段字幕；没有重新转写或生成')
