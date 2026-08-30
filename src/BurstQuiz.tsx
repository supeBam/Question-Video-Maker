import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Background } from "./components/Background";
import { HookIntroScene } from "./scenes/HookIntroScene";
import { BurstScene } from "./scenes/BurstScene";
import { SummaryScene } from "./scenes/SummaryScene";
import { BurstOutroScene } from "./scenes/BurstOutroScene";
import { buildTimeline, type QuizData } from "./types";

export type BurstQuizProps = {
  data: QuizData;
};

/**
 * 爆款快闪模板（对标「学霸都考哭了」系列提取的优势）：
 *   1. 零片头 —— 第一帧就是第一题题干 + 选项，无开场动画
 *   2. 快节奏 —— 每题约 5 秒两段式（呈现 2.2s → 揭晓 2.8s），无倒计时
 *   3. 激励角标 —— 顶部常驻「全对 = 学霸」+ 题号计数
 *   4. 收藏指令 + 免责声明 —— 底部常驻
 *   5. 短片尾 —— 3 秒结果承诺 + CTA
 * 题库 JSON 设置 timing.pacing = "burst" 即可启用本模板节奏。
 */
export const BurstQuiz: React.FC<BurstQuizProps> = ({ data }) => {
  // 强制零片头：旧题库切到本模板也不允许出现开头空白
  const burstData: QuizData = {
    ...data,
    timing: { ...data.timing, introSeconds: 0 },
  };
  const timeline = buildTimeline(burstData);
  const { hookFrames, outroFrames, summaryFrames, slots, totalFrames } = timeline;

  // 激励角标与常驻话术：题库可选覆盖（缺省用对标同款话术）
  const badge = data.publish?.badge ?? "全对 = 学霸";
  const saveText = data.publish?.saveText ?? "❤ 收藏 · 考考孩子";
  const disclaimer = data.publish?.disclaimer ?? "内容来源于公开资料";
  // 钩子挑战词：题库可选覆盖（缺省按题量自动生成）
  const challenge =
    data.publish?.challenge ?? `共 ${slots.length} 题 · 全对算你厉害`;
  // 音效开关：缺省开启（答案音效 + 有倒计时时的倒计时音效），
  // 设 timing.soundEffects = false 可切纯快闪（完全对标无音效）
  const soundEffects = data.timing.soundEffects !== false;
  // 极简片尾：缺省 false（保留「全对=学霸 + CTA」文字版片尾）；
  // 显式设 timing.minimalOutro = true 时无片尾帧（用户自行导入钩子图/答案图）
  const minimalOutro = data.timing.minimalOutro === true;

  return (
    <AbsoluteFill>
      {/* 背景放在 Sequence 之外，保证整片连续 */}
      <Background
        src={data.background?.src ?? "assets/bg-paper.svg"}
        cloudSrc={data.background?.cloudSrc}
        drift={data.background?.drift ?? 0.05}
      />

      {data.bgm.enabled ? (
        <Audio src={staticFile(data.bgm.file)} volume={data.bgm.volume} loop />
      ) : null}

      {/* 钩子开场（hookSeconds > 0 时；封面即取此画面） */}
      {hookFrames > 0 ? (
        <Sequence from={0} durationInFrames={hookFrames} name="钩子开场">
          <HookIntroScene
            kicker={data.intro.kicker}
            title={data.intro.title}
            challenge={challenge}
            durationInFrames={hookFrames}
          />
        </Sequence>
      ) : null}

      {/* 题目流（零片头时从第 0 帧开始） */}
      {slots.map((slot) => (
        <Sequence
          key={slot.question.id}
          from={slot.from}
          durationInFrames={slot.durationInFrames}
          name={`第${slot.index + 1}题`}
        >
          <BurstScene
            slot={slot}
            total={slots.length}
            meta={data.meta}
            voiceOverEnabled={data.voiceOver.enabled}
            badge={badge}
            saveText={saveText}
            disclaimer={disclaimer}
            soundEffects={soundEffects}
          />
        </Sequence>
      ))}

      {/* 片尾答案回顾（summarySeconds > 0 时；仅画面，不进字幕） */}
      {summaryFrames > 0 ? (
        <Sequence
          from={totalFrames - outroFrames - summaryFrames}
          durationInFrames={summaryFrames}
          name="本期答案"
        >
          <SummaryScene
            slots={slots}
            meta={data.meta}
            badge={badge}
            saveText={saveText}
            disclaimer={disclaimer}
            durationInFrames={summaryFrames}
          />
        </Sequence>
      ) : null}

      {/* 片尾（无片尾帧模式 outroFrames=0 时整段跳过；有帧时渲染，minimal 模式画面为纯背景） */}
      {outroFrames > 0 ? (
        <Sequence
          from={totalFrames - outroFrames}
          durationInFrames={outroFrames}
          name="片尾"
        >
          <BurstOutroScene
            outro={data.outro}
            meta={data.meta}
            badge={badge}
            durationInFrames={outroFrames}
            minimal={minimalOutro}
          />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
