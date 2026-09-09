---
name: guoxue-dialogue-video
description: 国学对谈短视频出片（庄子×曾国藩等历史人物的 AI 对谈）。当用户要「出第二期/新一期国学对谈」「写对谈文案」「复用已有音色画像出片」时使用。核心：换对白文本 → 复用定制音色+画像 → 两个脚本出片，全程约 10 分钟。
---

# 国学对谈短视频出片（SOP）

第一期（庄子×曾国藩谈自律）已跑通全链路，本 skill 沉淀可复用资产与出片流程，让后续期次「只换文案、其余复用」。

## 一、可复用资产（勿重复劳动）

| 资产 | 位置 | 说明 |
|---|---|---|
| 音色 voice_id | 硬编码在 `scripts/gen-minimax-tts.py` 的 `VOICES` | 庄子/曾国藩/旁白三个 MiniMax 定制音色，**直接复用，别重新设计** |
| 画像 | `public/assets/portraits/庄子.png`、`曾国藩.png` | 成片用的 AI 水墨画像 |
| 配音脚本 | `scripts/gen-minimax-tts.py` | 读对白 JSON（`--data=`），不碰代码 |
| 出片脚本 | `scripts/compose-video.py` | 读对白 JSON（`--data=`）+ SRT 出片（画像全屏切换 + 分色字幕 + 音量放大） |
| 音色设计脚本 | `scripts/design-voices.py` | 仅在需要新音色时用（一般不用） |
| 对标文案参考 | `docs/对标-庄子曾国藩谈自律-文案.md` | 第一期完整文案 + 角色结构 |

## 二、出片 SOP（第二期流程，只改 JSON 不碰代码）

1. **选题**：定对谈话题，用「二元对立」钩子（如「读书该博还是该精」「快乐是求来的还是放下的」）。
2. **写对白 JSON**：复制 `src/data/dialogue/dialogue-01.json` → `src/data/dialogue/dialogue-02.json`，改 `label`（如「国学对谈02」）+ `lines`（新对白，12 句左右，结构见第三节）；`voices` 直接复用，不动。
3. **合成配音**（需 MiniMax API key）：
   ```bash
   .venv-asr/bin/python scripts/gen-minimax-tts.py --data=src/data/dialogue/dialogue-02.json
   ```
4. **出片**：
   ```bash
   .venv-asr/bin/python scripts/compose-video.py --data=src/data/dialogue/dialogue-02.json
   ```
5. **交付**：`out/国学对谈02-成片.mp4`。

## 三、对白结构模板（第一期验证）

- **旁白钩子**（片头，1 句）：二元对立悬念，如「自律，到底是逼自己，还是放过自己？让两个最懂的人，吵一架。」
- **对话回合**（6-8 回合）：庄子（道家/顺其自然）vs 曾国藩（儒家/克己），每回合一个观点 + 一个**具体典故**（曾国藩日课、庖丁解牛、无用之木等），这是与「纯鸡汤」的差异化。
- **金句收束**（片尾，2 句对仗）：如「会逼的人，走得远；会放的人，走得长。」
- 总量 12 句左右：旁白 2 + 曾国藩 5 + 庄子 5。

## 四、注意事项

- **音色别重设计**：`VOICES` 里的 ttv-voice 是账号持久资源，复用即可；只有换人物（如换成孔子、王阳明）才需要 `design-voices.py` 重新设计。
- **成本**：配音 speech-2.8-hd ¥3.5/万字符，一期约 470 字 ≈ ¥0.16。
- **音量/字幕**：`compose-video.py` 里 `VOLUME=1.8`、`FONT_SIZE=58`（适配中老年），按需调。
- **画像是正方形裁竖屏**：单画像顶部对齐裁切（保住头部）、旁白上下合并，已在脚本内处理。
- **MiniMax key**：存项目根 `.minimax.key`（gitignored，脚本自动读）；合成报「insufficient balance」= 账户余额不足，充值后重跑。
- **本机 ffmpeg 无 libass**：字幕靠 Pillow 画帧，别用 ass/subtitles filter（会报 Unknown filter）。
