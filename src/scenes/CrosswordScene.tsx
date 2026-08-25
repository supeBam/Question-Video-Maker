import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { THEME } from "../theme";
import { Header } from "../components/Header";
import { CountdownRing } from "../components/CountdownRing";
import { CrosswordGrid } from "../components/CrosswordGrid";
import { QuestionSoundEffects } from "../components/QuestionSoundEffects";
import { fadeSlideUp } from "../animations";
import { buildGrid } from "../crossword";
import type { QuestionSlot, CrosswordQuestion, QuizData, CrosswordClue } from "../types";

export type CrosswordSceneProps = {
  slot: QuestionSlot;
  total: number;
  meta: QuizData["meta"];
  voiceOverEnabled: boolean;
};

/** 渲染一条线索：展示阶段只给少数字（其余 ＿），答案阶段补全并标翠绿 */
const ClueRow: React.FC<{
  clue: CrosswordClue;
  num: number;
  revealed: boolean;
}> = ({ clue, num, revealed }) => {
  const { colors, fonts } = THEME;
  const blankSet = new Set(clue.blanks ?? []);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        backgroundColor: colors.glass,
        border: `1px solid ${colors.glassBorder}`,
        borderRadius: 12,
        padding: "9px 12px",
      }}
    >
      <span
        style={{
          fontFamily: fonts.sans,
          fontSize: 24,
          fontWeight: 700,
          color: colors.ink,
          backgroundColor: colors.gold,
          borderRadius: 7,
          padding: "1px 8px",
          flexShrink: 0,
          lineHeight: 1.5,
        }}
      >
        {clue.dir === "across" ? "横" : "纵"}
        {num}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: fonts.serif,
            fontSize: 30,
            color: colors.light,
            letterSpacing: 2,
            lineHeight: 1.3,
          }}
        >
          {Array.from(clue.text).map((ch, i) =>
            blankSet.has(i) ? (
              <span
                key={i}
                style={{
                  color: revealed ? colors.jade : "rgba(46,36,24,0.28)",
                  fontWeight: revealed ? 700 : 400,
                }}
              >
                {revealed ? ch : "＿"}
              </span>
            ) : (
              <span key={i}>{ch}</span>
            )
          )}
        </div>
        {revealed && clue.source ? (
          <div
            style={{
              fontFamily: fonts.kai,
              fontSize: 22,
              color: colors.muted,
              marginTop: 1,
            }}
          >
            《{clue.source.title}》{clue.source.author ?? ""}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const CrosswordScene: React.FC<CrosswordSceneProps> = ({
  slot,
  total,
  meta,
  voiceOverEnabled,
}) => {
  const frame = useCurrentFrame();
  const { colors, fonts, fontSize, layout } = THEME;
  const question = slot.question as CrosswordQuestion;
  const { displayFrames, answerFrames, durationInFrames } = slot;

  const answerStart = displayFrames;
  const revealed = frame >= answerStart;

  const inFade = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outFade = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  void voiceOverEnabled;

  const grid = buildGrid(question.clues);
  const numById = new Map(grid.clueOrder.map((c) => [c.id, c.num]));
  const acrossClues = question.clues.filter((c) => c.dir === "across");
  const downClues = question.clues.filter((c) => c.dir === "down");

  return (
    <AbsoluteFill style={{ opacity: inFade * outFade }}>
      <QuestionSoundEffects presentFrames={0} countdownFrames={displayFrames} />

      <Header
        series={meta.series}
        episodeLabel={meta.episodeLabel}
        counter={`${slot.index + 1} / ${total}`}
      />

      <div
        style={{
          position: "absolute",
          top: layout.safeTop + 4,
          left: layout.sideMargin,
          right: layout.sideMargin,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        {question.title ? (
          <div
            style={{
              fontFamily: fonts.kai,
              fontSize: 36,
              color: colors.gold,
              letterSpacing: 6,
              ...fadeSlideUp(frame, 6, 16, 10),
            }}
          >
            {question.title}
          </div>
        ) : null}

        {!revealed ? (
          <CountdownRing
            seconds={displayFrames / 30}
            startFrame={0}
            size={132}
            caption="作答中"
          />
        ) : (
          <div
            style={{
              ...fadeSlideUp(frame, answerStart, 16, 16),
              fontFamily: fonts.kai,
              fontSize: 42,
              color: colors.jade,
              letterSpacing: 8,
            }}
          >
            — 已补全 —
          </div>
        )}

        {!revealed && question.hint ? (
          <div
            style={{
              textAlign: "center",
              fontFamily: fonts.sans,
              fontSize: 26,
              letterSpacing: 2,
              color: colors.muted,
              ...fadeSlideUp(frame, 12, 16, 10),
            }}
          >
            {question.hint}
          </div>
        ) : null}

        <CrosswordGrid
          clues={question.clues}
          revealed={revealed}
          startFrame={0}
          availableHeight={revealed ? 760 : 640}
        />

        {/* 展示阶段：线索区（只给少数字当提示，不剧透出处） */}
        {!revealed ? (
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              ...fadeSlideUp(frame, 20, 16, 14),
            }}
          >
            <div
              style={{
                fontFamily: fonts.sans,
                fontSize: 26,
                color: colors.muted,
                letterSpacing: 3,
              }}
            >
              根据提示把空缺的字补上：
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                justifyContent: "center",
              }}
            >
              {[...acrossClues, ...downClues].map((clue) => (
                <div key={clue.id} style={{ width: "calc(50% - 5px)" }}>
                  <ClueRow
                    clue={clue}
                    num={numById.get(clue.id) ?? 0}
                    revealed={false}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* 答案阶段：赏析 + 出处总览 */}
        {revealed ? (
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              ...fadeSlideUp(frame, answerStart + 4, 16, 16),
            }}
          >
            <div
              style={{
                borderRadius: 20,
                backgroundColor: colors.paper,
                border: `2px solid ${colors.glassBorder}`,
                padding: "18px 24px",
                display: "flex",
                gap: 14,
              }}
            >
              <Img
                src={staticFile("assets/seal-mark.svg")}
                style={{ width: 48, height: 48, opacity: 0.95, flexShrink: 0 }}
              />
              <p
                style={{
                  margin: 0,
                  fontFamily: fonts.serif,
                  fontSize: fontSize.explain,
                  lineHeight: 1.6,
                  color: colors.light,
                  opacity: 0.92,
                }}
              >
                {question.explanation}
              </p>
            </div>
            <div
              style={{
                fontFamily: fonts.kai,
                fontSize: 24,
                color: colors.muted,
                textAlign: "center",
                letterSpacing: 1,
              }}
            >
              出自：
              {question.clues
                .filter((c) => c.source)
                .map((c) => `${c.source?.title}·${c.source?.author ?? ""}`)
                .filter((v, i, a) => a.indexOf(v) === i)
                .join("　")}
            </div>
          </div>
        ) : null}
      </div>

      {!revealed ? (
        <div
          style={{
            position: "absolute",
            bottom: layout.safeBottom - 70,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: fonts.sans,
            fontSize: 28,
            letterSpacing: 4,
            color: colors.muted,
            ...fadeSlideUp(frame, 24, 16, 10),
          }}
        >
          看着编号，把缺的字补上 →
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
