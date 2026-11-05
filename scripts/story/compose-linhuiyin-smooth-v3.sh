#!/bin/bash
# 林徽因视频合成 - 平滑运镜版本

cd "$(dirname "$0")/../.."
OUT_DIR="out/linhuiyin-01"
mkdir -p "$OUT_DIR/clips_smooth"

# 清理旧文件
rm -f "$OUT_DIR/clips_smooth/"*.mp4

echo "生成平滑运镜片段..."

# 运镜参数：先放大到1.5倍画布（1620x2880），再zoompan
CANVAS_W=1620
CANVAS_H=2880
OUT_W=1080
OUT_H=1920

# 定义每张图片及其运镜参数
declare -a CLIPS=(
  "img-01-upenn.png:11.4:推近"
  "img-02-diploma.png:9.6:右摇"
  "img-03-student.png:11.9:推近"
  "img-04-classroom.png:17.4:左摇"
  "img-05-blueprint.png:11.2:推近"
  "img-06-mountains.png:10.5:右摇"
  "img-07-temple-exterior.png:9.2:推近"
  "img-08-temple-interior.png:18.4:下移"
  "img-09-surveying.png:9.8:推近"
  "img-10-inscription.png:6.1:左摇"
  "img-11-refugee.png:9.3:右摇"
  "img-12-lizhuang-street.png:10.1:推近"
  "img-13-lizhuang-interior.png:14.1:左摇"
  "img-14-books.png:8.1:推近"
  "img-15-hands.png:8.8:右摇"
  "img-16-yangtze.png:6.6:左摇"
  "img-17-emblem.png:11.3:推近"
  "img-18-monument-full.png:10.1:下移"
  "img-19-monument-detail.png:9.8:推近"
  "img-20-cemetery-gate.png:5.3:右摇"
  "img-21-cemetery-trees.png:14.0:推近"
  "img-22-tombstone.png:18.0:左摇"
  "img-23-old-photos.png:10.6:推近"
  "img-24-portrait.png:15.3:推近"
  "img-25-sketches.png:13.1:右摇"
  "img-26-architecture.png:16.9:拉远"
  "img-27-silhouette.png:21.2:推近"
  "img-28-heritage.png:14.0:右摇"
)

i=0
for clip in "${CLIPS[@]}"; do
  IFS=':' read -r img dur motion <<< "$clip"

  # 计算帧数
  fps=30
  frames=$(echo "$dur * $fps" | bc | cut -d. -f1)

  # 选择运镜表达式
  case "$motion" in
    "推近")
      zp="z='1+0.2*on/$frames':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
      ;;
    "拉远")
      zp="z='1.2-0.2*on/$frames':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
      ;;
    "左摇")
      zp="z='1.2':x='(iw-iw/zoom)*on/$frames':y='ih/2-(ih/zoom/2)'"
      ;;
    "右摇")
      zp="z='1.2':x='(iw-iw/zoom)*(1-on/$frames)':y='ih/2-(ih/zoom/2)'"
      ;;
    "下移")
      zp="z='1.2':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*on/$frames'"
      ;;
  esac

  printf "[%2d/28] %s (%.1fs, %s)\n" $((i+1)) "$img" "$dur" "$motion"

  ffmpeg -y -v error -loop 1 -i "$OUT_DIR/$img" \
    -vf "scale=$CANVAS_W:$CANVAS_H:force_original_aspect_ratio=increase,crop=$CANVAS_W:$CANVAS_H,setsar=1,zoompan=$zp:d=$frames:s=${OUT_W}x${OUT_H}:fps=$fps,format=yuv420p" \
    -t "$dur" -r $fps -c:v libx264 -preset medium -crf 23 \
    "$OUT_DIR/clips_smooth/clip_$(printf "%02d" $i).mp4"

  ((i++))
done

echo "合并视频片段..."
cd "$OUT_DIR/clips_smooth" && ls clip_*.mp4 | sort -V | sed 's/^/file /' > concat.txt
ffmpeg -y -v error -f concat -safe 0 -i concat.txt -c copy ../temp_smooth.mp4

echo "添加音频..."
cd ../..
ffmpeg -y -v error -i "$OUT_DIR/temp_smooth.mp4" -i "out/林徽因01-旁白-minimax.mp3" \
  -c:v copy -c:a aac -b:a 128k -shortest \
  "out/林徽因01-成片-平滑版.mp4"

echo "✓ 完成: out/林徽因01-成片-平滑版.mp4"
rm -rf "$OUT_DIR/clips_smooth" "$OUT_DIR/temp_smooth.mp4"
