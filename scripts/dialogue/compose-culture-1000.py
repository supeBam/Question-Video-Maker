"""根据实际表演和本地对齐时间，生成可编辑的 Hypit 成片工程。"""
from pathlib import Path
import json,math,html,subprocess,os
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[2];P=ROOT/'work/hypit-culture-1000/productions/pilot'
for d in ['authors','runs','assets/fonts']:(P/d).mkdir(parents=True,exist_ok=True)
# 可通过环境变量指定本地字体，避免绑定某位开发者的目录。
FONT=Path(os.environ.get('CULTURE_FONT_PATH', str(ROOT/'assets/fonts/仓耳竹言体.ttf')))
(P/'assets/fonts/caption.ttf').write_bytes(FONT.read_bytes())
# 复用用户指定的茶馆商品场景图，保留其原有封面与空间氛围。
f=lambda sz:ImageFont.truetype(str(FONT),sz)
for original,dest in [('01_站立主视觉.png','book-card.png'),('02_斜放另角度.png','book-angle.png')]:
 Image.open(ROOT/'assets/book_1000wen'/original).convert('RGB').resize((1080,1920),Image.Resampling.LANCZOS).save(P/'assets'/dest)
board=Image.new('RGB',(1080,1920),'#281C16');bd=ImageDraw.Draw(board)
def btxt(text,y,size,color):
 box=bd.textbbox((0,0),text,font=f(size));bd.text(((1080-box[2])/2,y),text,font=f(size),fill=color)
btxt('民间财神 · 有文有武',170,66,'#F4D79B')
for top,label,names in [(350,'武财神','赵公明 · 关羽'),(740,'文财神','比干 · 范蠡')]:
 bd.rounded_rectangle((100,top,980,top+340),radius=22,fill='#3C2920',outline='#866346',width=2)
 btxt(label,top+45,64,'#D6B27D');btxt(names,top+160,82,'#FFF0D0')
btxt('各地习俗有所不同',1510,43,'#C7B398')
board.save(P/'assets/classification.png')

jobs=json.loads((P/'jobs/shots.json').read_text());rows=[];offset=0
for j in jobs:
 r=json.loads((P/'jobs'/f"{j['id']}-asr.json").read_text())
 # 按识别边界裁掉长空白，保留呼吸与反应。
 ts=r['raw_timestamps'];start=max(0,ts[0][0]/1000-.16) if ts else 0
 end=min(r['duration'],ts[-1][1]/1000+.32) if ts else r['duration']
 frames=math.ceil((end-start)*30)
 edited=P/'assets'/f'edited-{j["id"]}.mp4'
 if not edited.exists():subprocess.run(['ffmpeg','-v','error','-y','-ss',str(start),'-i',str(P/'assets'/f'{j["id"]}.mp4'),'-t',str(frames/30),'-vf','fps=30','-af','apad','-c:v','libx264','-preset','fast','-crf','18','-c:a','aac','-ar','48000',str(edited)],check=True)
 if j['id']=='C07' and not edited.with_suffix('.reframed').exists():
  cut=max(.1,3.25-start);temp=edited.with_name('reframed-C07.mp4')
  vf=f'[0:v]split[a][b];[a]trim=end={cut},setpts=PTS-STARTPTS[v1];[b]trim=start={cut},setpts=PTS-STARTPTS,crop=448:784:160:50,scale=768:1344[v2];[v1][v2]concat=n=2:v=1:a=0[v]'
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(edited),'-filter_complex',vf,'-map','[v]','-map','0:a','-c:v','libx264','-preset','fast','-crf','18','-c:a','copy',str(temp)],check=True)
  temp.replace(edited);edited.with_suffix('.reframed').write_text('听者反应重构图，移除多余茶杯；原始表演与声音保留。')
 rows.append(dict(job=j,asr=r,start=start,end=start+frames/30,frames=frames,offset=offset));offset+=frames
imports={'space':'spatial','program':'program-space','time':'timeline-author','media':'media','pipeline':'media-pipeline','picture':'media-track','text':'typography-track','audio':'audio-track','film':'film','render':'render-hyperframes'}
x=['<?svml using="@hypit/markup@1"?>','<svml>']
x += [f'<import as="{a}" from="@hypit/{b}@1"/>' for a,b in imports.items()]
x+=['<import as="recipes" source="../recipes.svs"/>','<space:Canvas id="vertical" width="1080" height="1920"/>','<program:Clock id="clock" frame-rate="30"/>',f'<time:Timeline id="program" clock={{clock}} end="{offset}f"/>','<space:Frame id="full" within={vertical} left="0px" top="0px" right="1080px" bottom="1920px"/>','<space:Extent id="card-extent" width="1080" height="1920"/>','<space:Frame id="caption-frame" within={vertical} left="3%" top="1100px" right="97%" bottom="1280px"/>','<space:Frame id="caption-book" within={vertical} left="3%" top="1100px" right="97%" bottom="1280px"/>','<space:Frame id="title-frame" within={vertical} left="5%" top="80px" right="95%" bottom="250px"/>','<media:Font id="font" src="../assets/fonts/caption.ttf" weight="400" style="normal"/>','<media:Image id="book" src="../assets/book-card.png"/>','<media:Image id="book-angle" src="../assets/book-angle.png"/>','<media:Image id="classification" src="../assets/classification.png"/>']
for row in rows:
 sid=row['job']['id'];x += [f'<media:Video id="src-{sid}" src="../assets/edited-{sid}.mp4"/>',f'<pipeline:Normalize id="m-{sid}" source={{src-{sid}}} video="primary-moving" audio="default" span-authority="video" clock={{clock}}/>']
x+=['<media:Audio id="bgm" src="../assets/bgm.mp3"/>','<pipeline:Normalize id="bgm-media" source={bgm} video="none" audio="default" span-authority="audio" clock={clock}/>','<text:Style id="caption" recipe={recipes.text.caption} font={font}><text:Stroke color="#16100B" width="6" placement="outside"/><text:Fill color="#FFDC00"/></text:Style>','<text:Style id="title" recipe={recipes.text.title} font={font}><text:Stroke color="#16100B" width="5" placement="outside"/><text:Fill color="#FFF0CC"/></text:Style>','<picture:Track id="shots" timeline={program.timeline} canvas={vertical}>']
for row in rows:
 sid=row['job']['id'];at=row['offset'];length=row['frames']
 if sid in ['C08','C10']:
  bookref='book' if sid=='C08' else 'book-angle'
  x += [f'<picture:Item id="shot-{sid}" image={{{bookref}}} extent={{card-extent}} frame={{full}} appearance={{recipes.media.shot}} at="{at}f" for="{length}f"><picture:Sampling at="start" zoom="1.0"/><picture:Sampling at="end" zoom="1.025"/></picture:Item>']
 else:
  x += [f'<picture:Item id="shot-{sid}" media={{m-{sid}.media}} frame={{full}} appearance={{recipes.media.shot}} at="{at}f" for="{length}f"/>']
for row in rows:
 if row['job']['id']=='C04':
  at=row['offset']+max(0,round((2.7-row['start'])*30));length=min(195,row['offset']+row['frames']-at)
  x.append(f'<picture:Item id="classification-card" image={{classification}} extent={{card-extent}} frame={{full}} appearance={{recipes.media.overlay}} at="{at}f" for="{length}f"><picture:Sampling at="start" zoom="1.0"/><picture:Sampling at="end" zoom="1.025"/></picture:Item>')
x+=['</picture:Track>' ,'<text:Track id="captions" timeline={program.timeline}>',f'<text:Area id="hook" placement={{title-frame}} style={{title}} at="0f" for="{min(offset,360)}f">财神到底姓什么？</text:Area>']
for row in rows:
 for k,c in enumerate(row['asr']['cues']):
  st=max(0,round((c['start']-row['start'])*30));ed=min(row['frames'],max(st+7,round((c['end']-row['start'])*30)))
  if k+1<len(row['asr']['cues']):ed=min(ed,max(st+1,round((row['asr']['cues'][k+1]['start']-row['start'])*30)))
  frame='caption-book' if row['job']['id'] in ['C04','C08','C10'] else 'caption-frame'
  if ed>st:x.append(f'<text:Area id="cap-{row["job"]["id"]}-{k}" placement={{{frame}}} style={{caption}} at="{row["offset"]+st}f" for="{ed-st}f">{html.escape(c["text"])}</text:Area>')
x+=['</text:Track>','<audio:Track id="mix" timeline={program.timeline}>']
for row in rows:
 sid=row['job']['id'];x += [f'<audio:Item id="voice-{sid}" source={{m-{sid}.media}} at="{row["offset"]}f" for="{row["frames"]}f" gain="0.82"/>']
x += ['<audio:Item id="music" source={bgm-media.media} during="program" playback="loop-start" gain="0.075" fade-in="30f" fade-out="45f"/>','</audio:Track>','<film:Film id="main" canvas={vertical} timeline={program.timeline} appearance={recipes.film.vertical}><film:Track source={shots.visual}/><film:Track source={captions.track}/><film:Track source={mix.audio}/></film:Film>','<render:Video id="final" composition={main.composition} timeline={program.timeline}/>','</svml>']
(P/'authors/main.svml').write_text('\n'.join(x))
(P/'recipes.svs').write_text('''<?svml using="@hypit/svs@1"?>
<sheet version="1">
 film.vertical { background: #211811; }
 media.shot { stack-order: 10; fit: cover; }
 media.overlay { stack-order: 20; fit: cover; }
 text.caption { stack-order: 90; size: 96; weight: 400; line-height: 1.2; align: center; block-align: center; inline-size: fixed; block-size: fixed; wrap: none; overflow: shrink; minimum-scale: 0.95; }
 text.title { stack-order: 100; size: 68; weight: 400; line-height: 1.25; align: center; block-align: center; inline-size: fixed; block-size: fixed; wrap: none; overflow: shrink; minimum-scale: 0.7; }
</sheet>''')
(P/'runs/final.svrun').write_text('''<?svml using="@hypit/run-markup@1"?>
<svrun version="1"><author source="../authors/main.svml"/><target output="final.video"/></svrun>''')
(P/'jobs/edit-timing.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print('Hypit 源已生成',offset,'帧',offset/30,'秒')
