import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { THEME } from "../theme";
import { BurstChrome } from "../components/BurstChrome";
import { CountdownRing } from "../components/CountdownRing";
import { QuestionSoundEffects } from "../components/QuestionSoundEffects";
import { QuestionVoiceTracks } from "../components/QuestionVoiceTracks";
import { popIn, stagger } from "../animations";
import type {
  ChoiceQuestion,
  FillQuestion,
  QuestionSlot,
  QuizData,
} from "../types";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export type BurstSceneProps = {
  slot: QuestionSlot;
  total: number;
  meta: QuizData["meta"];
  voiceOverEnabled: boolean;
  badge: string;
  saveText?: string;
  disclaimer?: string;
  /** 音效开关（缺省 true）：答案音效 + 有倒计时时的倒计时音效 */
  soundEffects?: boolean;
};

/** 快闪模板雅称大字：空间更紧，比经典填空场景小一号 */
const burstAnswerFontSize = (answer: string) => {
  const len = answer.length;
  if (len <= 2) return 152;
  if (len === 3) return 128;
  return 108;
};

/** 一句话解释：优先 punchline，没有就用 explanation（最多两行省略） */
const oneLiner = (q: { punchline?: string; explanation?: string }) =>
  q.punchline ?? q.explanation ?? "";

/**
 * 爆款快闪单题场景（对标「学霸都考哭了」系列，两段式，无倒计时）：
 *  ① 呈现 presentFrames —— 题干大字 + 选项/提示快速入场（约 2.2s）
 *  ② 揭晓 revealFrames   —— 答案高亮/雅称盖章 + 一句真相（约 2.8s）
 * 顶部常驻「全对 = 学霸」激励角标，底部常驻收藏指令 + 免责声明。
 */
export const BurstScene: React.FC<BurstSceneProps> = ({
  slot,
  total,
  meta,
  voiceOverEnabled,
  badge,
  saveText,
  disclaimer,
  soundEffects = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, fonts, fontSize, layout } = THEME;
  const { index, presentFrames, countdownFrames, durationInFrames } = slot;

  const revealStart = presentFrames + countdownFrames;
  const revealed = frame >= revealStart;
  // 有倒计时时的「作答中」阶段：呈现结束后、揭晓前
  const countingDown = !revealed && frame >= presentFrames && countdownFrames > 0;

  const inFade = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outFade = interpolate(
    frame,
    [durationInFrames - 8, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const answerPop = popIn(frame, fps, revealStart, 9, 160);
  const answerGlow = interpolate(
    frame,
    [revealStart, revealStart + 12],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const isFill = slot.kind === "fill";
  const isChoice = slot.kind === "choice";
  const fillQ = isFill ? (slot.question as FillQuestion) : null;
  const choiceQ = isChoice ? (slot.question as ChoiceQuestion) : null;
  const stem = slot.question.stem;

  return (
    <AbsoluteFill style={{ opacity: inFade * outFade }}>
      {soundEffects ? (
        <QuestionSoundEffects
          presentFrames={presentFrames}
          countdownFrames={countdownFrames}
        />
      ) : null}
      {voiceOverEnabled ? (
        <QuestionVoiceTracks
          meta={meta}
          questionId={slot.question.id}
          answerStartFrame={revealStart}
          hasPunchline={Boolean(
            (fillQ?.punchline ?? choiceQ?.punchline) !== undefined
          )}
          punchlineDelaySeconds={0.8}
        />
      ) : null}

      <BurstChrome
        series={meta.series}
        badge={badge}
        counter={`${index + 1} / ${total}`}
        saveText={saveText}
        disclaimer={disclaimer}
      />

      {/* 题干大字（首帧即在场，对标 0 秒进题） */}
      <div
        style={{
          position: "absolute",
          top: 300,
          left: layout.sideMargin,
          right: layout.sideMargin,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: 920,
            textAlign: "center",
            fontFamily: fonts.serif,
            fontSize: isFill ? 70 : 66,
            fontWeight: 700,
            lineHeight: 1.4,
            letterSpacing: 3,
            color: colors.light,
            whiteSpace: "pre-line",
          }}
        >
          {stem}
        </div>
      </div>

      {/* 作答倒计时环（题库给了 countdownSeconds > 0 时才出现） */}
      {countingDown ? (
        <div
          style={{
            position: "absolute",
            top: 452,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <CountdownRing
            seconds={countdownFrames / fps}
            startFrame={presentFrames}
            size={150}
            strokeWidth={9}
            caption="作答中"
            warnAt={1}
            digitRatio={0.44}
          />
        </div>
      ) : null}

      {/* ── 填空题：提示 → 雅称盖章 ── */}
      {isFill && fillQ ? (
        <>
          {!revealed && countdownFrames === 0 ? (
            <div
              style={{
                position: "absolute",
                top: 660,
                left: layout.sideMargin,
                right: layout.sideMargin,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 24,
              }}
            >
              <div
                style={{
                  padding: "22px 58px",
                  borderRadius: 999,
                  border: `3px dashed ${colors.glassBorder}`,
                  backgroundColor: colors.glass,
                  fontFamily: fonts.serif,
                  fontSize: 58,
                  letterSpacing: 8,
                  color: colors.muted,
                }}
              >
                它的雅称是……？
              </div>
              {fillQ.hint ? (
                <span
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 42,
                    letterSpacing: 4,
                    color: colors.gold,
                  }}
                >
                  {fillQ.hint}
                </span>
              ) : null}
            </div>
          ) : revealed ? (
            <div
              style={{
                position: "absolute",
                top: 620,
                left: layout.sideMargin,
                right: layout.sideMargin,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 26,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  opacity: interpolate(
                    frame,
                    [revealStart, revealStart + 8],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                  ),
                }}
              >
                <Img
                  src={staticFile("assets/seal-mark.svg")}
                  style={{ width: 52, height: 52, flexShrink: 0 }}
                />
                <span
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 48,
                    letterSpacing: 8,
                    color: colors.muted,
                  }}
                >
                  雅称
                </span>
              </div>
              <div
                style={{
                  fontFamily: fonts.serif,
                  fontSize: burstAnswerFontSize(fillQ.answer),
                  fontWeight: 800,
                  lineHeight: 1.2,
                  letterSpacing: 12,
                  color: colors.jade,
                  textShadow: `0 0 ${40 * answerGlow}px rgba(67,176,124,${0.5 * answerGlow})`,
                  opacity: answerPop,
                  transform: `translateY(${interpolate(
                    frame,
                    [revealStart, revealStart + 22],
                    [26, 0],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                  )}px) scale(${0.6 + 0.4 * answerPop})`,
                }}
              >
                {fillQ.answer}
              </div>
              <div
                style={{
                  maxWidth: 900,
                  textAlign: "center",
                  fontFamily: fonts.serif,
                  fontSize: 42,
                  lineHeight: 1.5,
                  color: colors.muted,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  opacity: interpolate(
                    frame,
                    [revealStart + 8, revealStart + 16],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                  ),
                }}
              >
                {oneLiner(fillQ)}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {/* ── 选择题：选项列表 → 高亮 ── */}
      {isChoice && choiceQ ? (
        <>
          <div
            style={{
              position: "absolute",
              top: 640,
              left: layout.sideMargin,
              right: layout.sideMargin,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {choiceQ.options.map((text, i) => {
              const isCorrect = i === choiceQ.answerIndex;
              const state = !revealed ? "idle" : isCorrect ? "correct" : "dim";
              const enter = interpolate(
                frame,
                [stagger(i, 4, 7), stagger(i, 4, 7) + 8],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );
              return (
                <div
                  key={`${choiceQ.id}-${i}`}
                  style={{
                    height: 146,
                    borderRadius: 24,
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    padding: "0 30px",
                    border:
                      state === "correct"
                        ? `3px solid ${colors.jade}`
                        : `2px solid ${colors.glassBorder}`,
                    backgroundColor:
                      state === "correct"
                        ? "rgba(31,122,84,0.14)"
                        : state === "dim"
                          ? "rgba(46,36,24,0.05)"
                          : colors.glass,
                    opacity:
                      state === "dim" ? 0.45 : enter,
                    transform:
                      state === "correct"
                        ? `scale(${1 + 0.03 * answerPop})`
                        : `scale(${0.96 + 0.04 * enter})`,
                    transition: "border-color 0.15s ease-out",
                  }}
                >
                  <span
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: fonts.number,
                      fontSize: 46,
                      fontWeight: 700,
                      color:
                        state === "correct" ? "#FFFFFF" : colors.gold,
                      backgroundColor:
                        state === "correct"
                          ? colors.jade
                          : "rgba(185,132,54,0.16)",
                    }}
                  >
                    {LETTERS[i]}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontFamily: fonts.serif,
                      fontSize: 52,
                      letterSpacing: 2,
                      color:
                        state === "correct" ? colors.jade : colors.light,
                      fontWeight: state === "correct" ? 700 : 500,
                    }}
                  >
                    {text}
                  </span>
                  {revealed && isCorrect ? (
                    <span style={{ fontSize: 48, color: colors.jade }}>✓</span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* 揭晓：一句真相 */}
          {revealed ? (
            <div
              style={{
                position: "absolute",
                top: 1304,
                left: layout.sideMargin,
                right: layout.sideMargin,
                textAlign: "center",
                fontFamily: fonts.serif,
                fontSize: 42,
                lineHeight: 1.5,
                color: colors.gold,
                letterSpacing: 2,
                opacity: interpolate(
                  frame,
                  [revealStart + 8, revealStart + 16],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                ),
              }}
            >
              {oneLiner(choiceQ)}
            </div>
          ) : null}
        </>
      ) : null}
    </AbsoluteFill>
  );
};
