"""离线识别已生成片段，按定稿映射字幕时间，并输出差异供审片。"""
import os,json,time,re,subprocess,difflib,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];P=ROOT/'work/hypit-culture-1000/productions/pilot'
os.environ['MODELSCOPE_CACHE']=str(ROOT/'work/modelscope/cache')
os.environ['MODELSCOPE_CREDENTIALS_PATH']=str(ROOT/'work/modelscope/credentials')
os.environ['HF_HUB_OFFLINE']='1';os.environ['MODELSCOPE_OFFLINE']='1'
import torch
torch.set_num_threads(4)
from funasr import AutoModel
cache=ROOT/'work/modelscope/cache/models/iic'
model=AutoModel(model=str(cache/'speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch'),vad_model=str(cache/'speech_fsmn_vad_zh-cn-16k-common-pytorch'),punc_model=str(cache/'punc_ct-transformer_cn-en-common-vocab471067-large'),disable_update=True,device='cpu')
def plain(s):return ''.join(re.findall('[\u4e00-\u9fffA-Za-z0-9]',s))
jobs=json.loads((P/'jobs/shots.json').read_text());todo=[j for j in jobs if len(sys.argv)<2 or j['id']==sys.argv[1]]
while todo:
 progressed=False
 for j in todo[:]:
  sid=j['id'];src=P/'assets'/f'{sid}.mp4';dst=P/'jobs'/f'{sid}-asr.json'
  if dst.exists():todo.remove(j);continue
  if not src.exists():continue
  wav=P/'assets'/f'{sid}.wav';subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-vn','-ar','16000','-ac','1',str(wav)],check=True)
  r=model.generate(input=str(wav),batch_size_s=60)[0]
  heard=plain(r.get('text',''));ts=r.get('timestamp',[]);target=plain(''.join(x['text'] for x in j['lines']))
  matcher=difflib.SequenceMatcher(None,target,heard,autojunk=False);mapping={}
  for a,b,n in matcher.get_matching_blocks():
   for k in range(n):
    if b+k<len(ts):mapping[a+k]=ts[b+k]
  dur=float(subprocess.check_output(['ffprobe','-v','quiet','-show_entries','format=duration','-of','csv=p=0',str(src)]))
  chars=[]
  for i,c in enumerate(target):
   if i in mapping:t=mapping[i]
   else:
    prev=max((k for k in mapping if k<i),default=None);nxt=min((k for k in mapping if k>i),default=None)
    start=mapping[prev][1] if prev is not None else 100;end=mapping[nxt][0] if nxt is not None else dur*1000-150
    left=prev if prev is not None else -1;right=nxt if nxt is not None else len(target)
    t=[start+(end-start)*(i-left-1)/max(1,right-left-1),start+(end-start)*(i-left)/max(1,right-left-1)]
   chars.append({'char':c,'start':round(t[0]/1000,3),'end':round(t[1]/1000,3)})
  cues=[];pos=0
  for line in j['lines']:
   for chunk in re.split('[，。？！、…；：]',line['text']):
    chunk=plain(chunk)
    for off in range(0,len(chunk),13):
     part=chunk[off:off+13];n=len(part)
     if n:
      cues.append({'text':part,'role':line['role'],'start':chars[pos]['start'],'end':max(chars[pos]['start']+.25,chars[pos+n-1]['end'])});pos+=n
  out={'id':sid,'duration':dur,'recognized':r.get('text'),'target':target,'similarity':round(matcher.ratio(),3),'chars':chars,'cues':cues,'raw_timestamps':ts}
  dst.write_text(json.dumps(out,ensure_ascii=False,indent=2));print(sid,'相似度',out['similarity'],'识别',out['recognized'],flush=True)
  todo.remove(j);progressed=True
 if todo and not progressed:time.sleep(5)
