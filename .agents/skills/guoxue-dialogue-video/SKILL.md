---
name: guoxue-dialogue-video
description: 国学对谈短视频出片（庄子×曾国藩等历史人物的 AI 对谈）。当用户要「出第二期/新一期国学对谈」「写对谈文案」「复用已有音色画像出片」时使用。核心：换对白文本 → 复用定制音色+画像 → 两个脚本出片，全程约 10 分钟。
---

# 国学对谈短视频出片（SOP）

第一期（庄子×曾国藩谈自律）已跑通全链路，本 skill 沉淀可复用资产与出片流程，让后续期次「只换文案、其余复用」。

## 一、可复用资产（勿重复劳动）

| 资产 | 位置 | 说明 |
|---|---|---|
| 音色库 | `src/data/dialogue/voice-library.json`（数据）+ [`docs/方法论/音色库.md`](../../../docs/方法论/音色库.md)（管理手册） | 11 个音色按气质登记；每期对白 JSON 的 `voices` 从库里选型，**在用音色直接复用，别重新设计** |
| 画像 | `public/assets/portraits/庄子.png`、`曾国藩.png` | 成片用的 AI 水墨画像 |
| 配音脚本 | `scripts/dialogue/gen-minimax-tts.py` | 读对白 JSON（`--data=`），不碰代码 |
| 出片脚本 | `scripts/dialogue/compose-video.py` | 读对白 JSON（`--data=`）+ SRT 出片（画像全屏切换 + 分色字幕 + 音量放大） |
| 音色设计脚本 | `scripts/dialogue/design-voices.py` | 仅在音色库无匹配时用（成本约 0.01 元/个） |
| 对标文案参考 | `docs/选题/对标-庄子曾国藩谈自律-文案.md` | 第一期完整文案 + 角色结构 |

## 二、出片 SOP（第二期流程，只改 JSON 不碰代码）

1. **选题**：定对谈话题，用「二元对立」钩子（如「读书该博还是该精」「快乐是求来的还是放下的」）。
2. **写对白 JSON**：复制 `src/data/dialogue/dialogue-01.json` → `src/data/dialogue/dialogue-02.json`，改 `label`（如「国学对谈02」）+ `lines`（新对白，12 句左右，结构见第三节）；`voices` 直接复用，不动。
3. **合成配音**（需 MiniMax API key）：
   ```bash
   .venv-asr/bin/python scripts/dialogue/gen-minimax-tts.py --data=src/data/dialogue/dialogue-02.json
   ```
4. **出片**：
   ```bash
   .venv-asr/bin/python scripts/dialogue/compose-video.py --data=src/data/dialogue/dialogue-02.json
   ```
5. **封面**（3:4 信息流安全尺寸，中老年大字）：
   ```bash
   .venv-asr/bin/python scripts/dialogue/make-cover.py --data=src/data/dialogue/dialogue-02.json --title="读书|到底该怎么读"
   ```
6. **发布内容 txt**：按模板填大标题/短标题/标题/描述/话题，落 `out/发布内容-{label}.txt`，交用户审核。
7. **交付**：`out/国学对谈02-成片.mp4` + `封面-国学对谈02.png` + `发布内容-国学对谈02.txt`。

## 二·五、发布内容规范（平台规则 + 中老年文案）

**平台硬规则**（务必遵守）：
- 视频号：只有「描述 + 话题」，无独立标题字段；短标题 ≤16 字且**无标点**。
- 抖音：标题 ≤30 字；描述 + 话题 ≤1000 字。
- 封面：3:4（1080×1440）信息流显示比例，9:16 会被上下裁剪；文字离边缘留血线。

**中老年文案原则**（账号受众 40-60+）：
- 大白话：不用网络梗（「摆烂」）、不用生僻古文（「得意忘言」→「别较真，读懂意思就好」）；可用人物原话的日常表达（曾国藩「下笨功夫」）。
- 用「您」表尊重。
- 描述 = 钩子延伸，不是摘要：戳痛点（「读了很多书，人却没变强」）> 陈述内容；二元对立（庄子劝放下 vs 曾国藩劝死磕）> 平铺。
- 温和开解，不挑衅不说教。

## 三、对白结构模板（第一期验证）

- **旁白钩子**（片头，1 句）：二元对立悬念，如「自律，到底是逼自己，还是放过自己？让两个最懂的人，吵一架。」
- **对话回合**（6-8 回合）：庄子（道家/顺其自然）vs 曾国藩（儒家/克己），每回合一个观点 + 一个**具体典故**（曾国藩日课、庖丁解牛、无用之木等），这是与「纯鸡汤」的差异化。
- **金句收束**（片尾，2 句对仗）：如「会逼的人，走得远；会放的人，走得长。」
- 总量 12 句左右：旁白 2 + 曾国藩 5 + 庄子 5。

## 四、注意事项

- **音色别重设计**：定制音色（ttv-voice）是账号持久资源，先查音色库（`voice-library.json` 的 `reusable_for`），气质匹配直接复用；只有库里无匹配才用 `design-voices.py` 定制（约 0.01 元/个）。
- **成本与增量缓存**：配音 speech-2.8-hd ¥3.5/万字符（turbo ¥2，草稿可先用 turbo）。合成脚本自带**增量缓存**（指纹 = 模型+音色+语速+文本，存 `src/data/dialogue/.tts-cache/`，gitignored）——重跑时文本/音色没变的句子零消耗，改一句只花一句的钱。
- **响度/字幕/语速**：`compose-video.py` 用 EBU R128 响度标准化（人声锁 `VOICE_LUFS=-14`、BGM 锁 `BGM_LUFS=-34`，恒差 20dB；本机 ffmpeg 的 loudnorm TP 范围 [-9,0]，BGM 的 TP 写 -20 会报错）；`FONT_SIZE=58`（适配中老年）；对白 JSON 的 `speeds` 按角色调语速（旁白 1.1 防拖沓），按需调。
- **画像是正方形裁竖屏**：单画像顶部对齐裁切（保住头部）、旁白上下合并，已在脚本内处理。
- **MiniMax key**：存项目根 `.minimax.key`（gitignored，脚本自动读）；报「insufficient balance」= 按量余额不足，报「2056 用量上限」= Token Plan 额度耗尽（买积分可自动补充），充值后重跑。
- **本机 ffmpeg 无 libass**：字幕靠 Pillow 画帧，别用 ass/subtitles filter（会报 Unknown filter）。
- **换人物（如换王阳明、孔子）完整路径**：① 全局 skill `huashu-nuwa` 蒸馏新人物视角（说「蒸馏王阳明」）；② 音色：先查音色库 `reusable_for`，无匹配再 `design-voices.py` 定制；③ `public/assets/portraits/` 放新画像；④ 对白 JSON 改 label/lines/voices/portraits/colors/speeds；⑤ 出片脚本零改动（画像/颜色已 JSON 化）。
- **钩子公式轮换**：开头钩子不得连续两期同款（01「吵一架」对抗式 → 02 同款已犯规 → 03 改「痛点共鸣+权威反转」）。候选公式：对抗式 / 痛点共鸣 / 悬念式 / 身份式 / 收藏指令，见 `wechat-video-hooks` skill。
