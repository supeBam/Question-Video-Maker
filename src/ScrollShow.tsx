import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Background } from "./components/Background";
import { HookIntroScene } from "./scenes/HookIntroScene";
import { ScrollItemScene } from "./scenes/ScrollItemScene";
import { THEME } from "./theme";

/**
 * 雅称诗意展示流（12 点槽 · 新形式实验位，对标「书香满屋」雅称结构）：
 *   1. 无考题 —— 不考你，只给你看：感性旁白 + 画卷动效，慢节奏
 *   2. 每条 item = 雅称大字（竖排）+ 诗句出处 + 旁白讲故事
 *   3. 水墨底（bg-ink.svg），与答题线宣纸底形成视觉区分
 * 数据 schema: scroll-show@1（见 src/data/scroll-show-*.json）
 */

export type ScrollItem = {
  id: string;
  noun: string;
  aka: string;
  poem: string;
  poemAuthor: string;
  story: string;
};

export type ScrollShowData = {
  schema: "scroll-show@1";
  meta: { series: string; episode: number; episodeLabel: string; hostTag?: string };
  timing: {
    fps: number;
    introSeconds: number;
    outroSeconds: number;
    minItemSeconds: number;
    itemBufferSeconds: number;
  };
  intro: { kicker: string; title: string; subtitle: string };
  items: ScrollItem[];
  outro: { cta: string; follow: string; disclaimer: string };
  bgm: { enabled: boolean; file: string; volume: number };
  background: { src: string; cloudSrc: string | null; drift: number };
  tts: { audioDir: string; voice: string; speed: number };
  publish: { title: string; douyin?: { title: string }; hashtags: string[] };
};

export type ScrollMeasurements = Record<string, number>;

/** 展示流时间轴：intro + Σ max(minItem, story_ms + buffer) + outro；片头片尾时长按口播实测自适应 */
export const scrollTimeline = (
  data: ScrollShowData,
  audioMeasurements?: ScrollMeasurements
) => {
  const fps = data.timing.fps;
  const introMs = audioMeasurements?.intro;
  const introSec = introMs
    ? Math.max(data.timing.introSeconds, introMs / 1000 + 1.0)
    : data.timing.introSeconds;
  const introFrames = Math.round(introSec * fps);
  const itemFrames = data.items.map((it) => {
    const ms = audioMeasurements?.[it.id];
    const sec =
      ms && ms > 0
        ? ms / 1000 + data.timing.itemBufferSeconds
        : data.timing.minItemSeconds;
    return Math.round(Math.max(data.timing.minItemSeconds, sec) * fps);
  });
  const outroMs = audioMeasurements?.outro;
  const outroSec = outroMs
    ? Math.max(data.timing.outroSeconds, outroMs / 1000 + 1.5)
    : data.timing.outroSeconds;
  const outroFrames = Math.round(outroSec * fps);
  const froms: number[] = [];
  let cursor = introFrames;
  for (const f of itemFrames) {
    froms.push(cursor);
    cursor += f;
  }
  return {
    fps,
    introFrames,
    itemFrames,
    itemFroms: froms,
    outroFrames,
    totalFrames: cursor + outroFrames,
  };
};

export type ScrollShowProps = {
  data: ScrollShowData;
  audioMeasurements?: ScrollMeasurements;
};

export const ScrollShow: React.FC<ScrollShowProps> = ({ data, audioMeasurements }) => {
  const timeline = scrollTimeline(data, audioMeasurements);
  const { introFrames, itemFrames, itemFroms, outroFrames } = timeline;
  const total = data.items.length;

  return (
    <AbsoluteFill>
      <Background
        src={data.background.src ?? "assets/bg-ink.svg"}
        cloudSrc={data.background.cloudSrc}
        drift={data.background.drift ?? 0.04}
      />

      {data.bgm.enabled ? (
        <Audio src={staticFile(data.bgm.file)} volume={data.bgm.volume} loop />
      ) : null}

      {/* 片头（封面帧取这里）：标题 + 口播 */}
      {introFrames > 0 ? (
        <Sequence from={0} durationInFrames={introFrames} name="片头">
          <HookIntroScene
            kicker={data.intro.kicker}
            title={data.intro.title}
            challenge={data.intro.subtitle}
            durationInFrames={introFrames}
          />
          {audioMeasurements?.intro ? (
            <Audio
              src={staticFile(`${data.tts.audioDir}/item-intro.mp3`)}
              volume={1}
            />
          ) : null}
        </Sequence>
      ) : null}

      {/* 雅称条目流：每条 = 大字 + 诗句 + 旁白 */}
      {data.items.map((item, i) => (
        <Sequence
          key={item.id}
          from={itemFroms[i]}
          durationInFrames={itemFrames[i]}
          name={`${item.noun} · ${item.aka}`}
        >
          <ScrollItemScene
            item={item}
            index={i}
            total={total}
            episodeLabel={data.meta.episodeLabel}
            disclaimer={data.outro.disclaimer}
            durationInFrames={itemFrames[i]}
          />
          <Audio
            src={staticFile(`${data.tts.audioDir}/item-${item.id}.mp3`)}
            volume={1}
          />
        </Sequence>
      ))}

      {/* 片尾：CTA + 关注引导 + 口播 */}
      <Sequence
        from={introFrames + itemFrames.reduce((a, b) => a + b, 0)}
        durationInFrames={outroFrames}
        name="片尾"
      >
        {audioMeasurements?.outro ? (
          <Audio
            src={staticFile(`${data.tts.audioDir}/item-outro.mp3`)}
            volume={1}
          />
        ) : null}
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            paddingBottom: THEME.layout.safeBottom,
          }}
        >
          <div
            style={{
              fontFamily: THEME.fonts.kai,
              fontSize: THEME.fontSize.cta,
              color: THEME.colors.ink,
              textAlign: "center",
              lineHeight: 1.6,
              opacity: 0.92,
            }}
          >
            {data.outro.cta}
          </div>
          <div
            style={{
              marginTop: 48,
              fontFamily: THEME.fonts.serif,
              fontSize: 40,
              color: THEME.colors.goldDim,
              letterSpacing: 6,
            }}
          >
            {data.outro.follow}
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
