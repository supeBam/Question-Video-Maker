"""从原始表演重混声音，复制成片画面，避免满幅峰值。"""
from pathlib import Path
import json,subprocess
ROOT=Path(__file__).resolve().parents[2];P=ROOT/'work/hypit-culture-1000/productions/pilot'
rows=json.loads((P/'jobs/edit-timing.json').read_text());total=sum(r['frames'] for r in rows)/30
out=ROOT/'out/中国文化1000问-第1期.mp4';bid=json.loads((P/'jobs/export.json').read_text())['build_id'];original=P/'assets'/f'hypit-export-{bid}.mp4'
if not original.exists():original.write_bytes(out.read_bytes())
cmd=['ffmpeg','-v','error','-y','-i',str(original)]
for row in rows:cmd+=['-i',str(P/'assets'/f"edited-{row['job']['id']}.mp4")]
cmd+=['-stream_loop','-1','-i',str(P/'assets/bgm.mp3')]
f=[]
for i,r in enumerate(rows,1):
 dur=r['frames']/30;f.append(f'[{i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur={dur},atrim=duration={dur},asetpts=PTS-STARTPTS[a{i}]')
f.append(''.join(f'[a{i}]' for i in range(1,11))+'concat=n=10:v=0:a=1,volume=0.82[voice]')
f.append(f'[11:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=duration={total},asetpts=PTS-STARTPTS,volume=0.075,afade=t=in:d=1,afade=t=out:st={total-1.5}:d=1.5[music]')
f.append('[voice][music]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.65:level=false:latency=true[mix]')
temp=out.with_name(out.stem+'-混音中.mp4')
cmd+=['-filter_complex',';'.join(f),'-map','0:v:0','-map','[mix]','-c:v','copy','-c:a','aac','-b:a','192k','-t',str(total),'-movflags','+faststart',str(temp)]
subprocess.run(cmd,check=True);temp.replace(out)
# 保持可编辑工程的声音参数与交付一致。
source=P/'authors/main.svml';source.write_text(source.read_text().replace('gain="1"','gain="0.82"'))
s=ROOT/'scripts/dialogue/compose-culture-1000.py';s.write_text(s.read_text().replace('gain="1"','gain="0.82"'))
print('本地混音完成',total,'秒')
