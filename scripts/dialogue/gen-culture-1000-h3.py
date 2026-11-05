"""财神篇 H3 生成。逐条保存任务，禁止自动重提已提交或状态不明任务。"""
import argparse,base64,json,time,concurrent.futures,threading,fcntl,os
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parents[2]
P=ROOT/'work/hypit-culture-1000/productions/pilot'
# 参考帧可由环境变量指向本机素材目录。
REF=Path(os.environ.get('CULTURE_REFERENCE_DIR', str(ROOT/'assets/reference/culture-1000/frames')))
STATE=P/'jobs/tasks.json'; LOCK=threading.Lock()
def uri(p,mime):return 'data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()
def save(d):
 with (P/'jobs/tasks.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  old=json.loads(STATE.read_text()) if STATE.exists() else {}
  for k,v in d.items():
   if old.get(k,{}).get('status')=='succeeded' and v.get('status')!='succeeded':continue
   old[k]=v
  t=STATE.with_suffix('.tmp');t.write_text(json.dumps(old,ensure_ascii=False,indent=2));t.replace(STATE)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--submit-only',action='store_true');ap.add_argument('--state');ap.add_argument('--only');ap.add_argument('--exclude');ap.add_argument('--workers',type=int,default=2);a=ap.parse_args()
 global STATE
 if a.state:STATE=P/'jobs'/a.state
 key=(ROOT/'.minimax.key').read_text().strip()
 if not key.startswith('sk-cp-'):raise RuntimeError('本片仅允许订阅Key，拒绝按量凭证')
 h={'Authorization':'Bearer '+key,'Content-Type':'application/json'}
 state=json.loads(STATE.read_text()) if STATE.exists() else {}
 jobs=json.loads((P/'jobs/shots.json').read_text());jobs=[j for j in jobs if (not a.only or j['id']==a.only) and j['id']!=a.exclude]
 def run(j):
  sid=j['id'];out=P/'assets'/f'{sid}.mp4'
  if out.exists():print(sid,'已有输出',flush=True);return
  with LOCK:old=state.get(sid)
  if old and not old.get('task_id'):raise RuntimeError(sid+' 存在未确认提交，禁止重复请求')
  if not old:
   roles={x['role'].split('／')[0] for x in j['lines']}
   multi=len(roles)>1
   pics=['s25','s11','s19'] if multi else (['s11','s25'] if '阿妹' in roles else ['s19','s25'])
   script='\n'.join(x['role'].replace('／画外音','')+'：'+x['text'] for x in j['lines'])
   prompt=('竖屏写实茶馆双人短剧，延续参考图同一人物、服装与暖色木质茶馆。阿妹是米白连帽衫高马尾年轻女孩，掌柜是深蓝盘扣上衣黑发低盘的成熟女性。'
    '两人始终坐着，掌柜在左，阿妹在右，相向交谈，不看镜头。右侧窗光，肤色自然，保留脸部纹理，背景灯笼柔和虚化。桌面仅一把棕色茶壶与两只浅色茶杯。'
    '按说话人切换自然近景和听者反应，保持视线方向。轻微表情与手势，不站起、不倒茶、不拿书、不翻页、不增加道具。'
    '参考音频一仅用于阿妹声音身份，音频二仅用于掌柜声音身份，不照读参考音频旧台词。阿妹声音清亮直率，掌柜声音温暖沉稳有轻松笑意。'
    '普通话自然对话，语速利落但字字清楚，按顺序准确说完下列台词，不改词、不重复、不加旁白。范蠡读范里，比干读笔干，字幕仍由后期制作。'
    '仅保留干净对白和极轻茶馆环境声，无音乐、无字幕、无文字、无转场特效。\n'+script)
   content=[{'type':'text','text':prompt}]+[{'type':'image_url','image_url':{'url':uri(REF/(x+'.jpg'),'image/jpeg')},'role':'reference_image'} for x in pics]
   for name in ['amei-voice.wav','zhanggui-voice.wav']:content.append({'type':'audio_url','audio_url':{'url':uri(P/'assets'/name,'audio/wav')},'role':'reference_audio'})
   payload={'model':'MiniMax-H3','content':content,'resolution':'768P','duration':j['duration'],'ratio':'9:16'}
   with LOCK:state[sid]={'status':'submitting','duration':j['duration']};save(state)
   r=requests.post('https://api.minimax.cn/v2/video_generation',headers=h,json=payload,timeout=90);d=r.json()
   if not d.get('task_id'):
    with LOCK:state[sid].update(status='rejected',response=d);save(state)
    raise RuntimeError(sid+' 提交未接受 '+json.dumps(d,ensure_ascii=False)[:400])
   with LOCK:state[sid].update(task_id=str(d['task_id']),status='submitted');save(state)
   print(sid,'提交',d['task_id'],flush=True)
  if a.submit_only:return
  tid=state[sid]['task_id']
  for _ in range(180):
   try:
    r=requests.get('https://api.minimax.cn/v2/query/video_generation/'+tid,headers=h,timeout=35);d=r.json()
    task=d.get('task',d)
    if isinstance(d.get('items'),list):task=next((x for x in d['items'] if str(x.get('id'))==tid),{})
    rid=task.get('id') or task.get('task_id')
    if rid and str(rid)!=tid:print(sid,'忽略非本任务响应',flush=True);time.sleep(10);continue
    status=task.get('status');print(sid,status,flush=True)
    if status=='succeeded':
     url=(task.get('content') or {}).get('url')
     if not url:raise RuntimeError('缺少视频地址')
     rr=requests.get(url,timeout=180);rr.raise_for_status();temp=out.with_suffix('.part');temp.write_bytes(rr.content);temp.replace(out)
     with LOCK:state[sid].update(status='succeeded',output=str(out));save(state)
     print(sid,'下载完成',out.stat().st_size,flush=True);return
    if status in ('failed','cancelled'):
     with LOCK:state[sid].update(status=status,error=task.get('error'));save(state)
     raise RuntimeError(sid+' '+str(task.get('error')))
   except requests.RequestException as e:print(sid,'查询网络异常',type(e).__name__,flush=True)
   time.sleep(10)
  raise RuntimeError(sid+' 等待超时，已保留任务，不自动重提')
 with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as pool:
  fs=[pool.submit(run,j) for j in jobs]
  for f in fs:f.result()
if __name__=='__main__':main()
