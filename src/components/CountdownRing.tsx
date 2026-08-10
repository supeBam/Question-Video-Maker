import React from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { THEME } from "../theme";

export type CountdownRingProps = {
  /** 倒计时总秒数 */
  seconds: number;
  /** 从组件本地第几帧开始走秒（之前显示满环） */
  startFrame?: number;
  /** 圆环直径 */
  size?: number;
  /** 进度条粗细 */
  strokeWidth?: number;
  /** 正常颜色 */
  color?: string;
  /** 最后 warnAt 秒变色 */
  warnColor?: string;
  warnAt?: number;
  /** 轨道颜色 */
  trackColor?: string;
  /** 外圈毛笔装饰静态资源，传 null 关闭 */
  brushSrc?: string | null;
  /** 数字下方的小字，如「作答中」 */
  caption?: string;
  /** 走完后是否继续显示 0 状态（false 则整体淡出） */
  keepAfterEnd?: boolean;
};

/**
 * 可复用倒计时组件：毛笔飞白外环 + 进度环 + 跳动数字。
 * 秒数、尺寸、配色、文案全部可配置。
 */
export const CountdownRing: React.FC<CountdownRingProps> = ({
  seconds,
  startFrame = 0,
  size = 236,
  strokeWidth = 10,
  color = THEME.colors.gold,
  warnColor = THEME.colors.vermilion,
  warnAt = 2,
  trackColor = "rgba(243, 234, 216, 0.16)",
  brushSrc = "assets/ring-brush.svg",
  caption = "作答中",
  keepAfterEnd = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const local = frame - startFrame;
  const totalFrames = Math.round(seconds * fps);
  const clamped = Math.min(Math.max(local, 0), totalFrames);

  /** 剩余秒数：5,4,3,2,1 */
  const remaining = Math.max(0, Math.ceil((totalFrames - clamped) / fps));
  const displayed = remaining === 0 ? 0 : remaining;

  /** 进度：1 → 0 */
  const progress = 1 - clamped / totalFrames;

  const isWarning = remaining <= warnAt && remaining > 0;
  const activeColor = isWarning ? warnColor : color;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  /** 每秒数字弹一下 */
  const secTick = clamped % fps;
  const pop = spring({
    frame: secTick,
    fps,
    config: { damping: 11, stiffness: 220, mass: 0.6 },
  });
  const digitScale = local < 0 ? 1 : interpolate(pop, [0, 1], [1.22, 1]);

  /** 结束后整体淡出 */
  const endFade =
    keepAfterEnd || local <= totalFrames
      ? 1
      : interpolate(local, [totalFrames, totalFrames + 10], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  /** 入场 */
  const enter = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        opacity: endFade * enter,
        transform: `scale(${interpolate(enter, [0, 1], [0.86, 1])})`,
      }}
    >
      {brushSrc ? (
        <Img
          src={staticFile(brushSrc)}
          style={{
            position: "absolute",
            inset: 0,
            width: size,
            height: size,
            opacity: 0.85,
          }}
        />
      ) : null}

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius * 0.82}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius * 0.82}
          fill="none"
          stroke={activeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference * 0.82}
          strokeDashoffset={circumference * 0.82 * (1 - progress)}
        />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: THEME.fonts.number,
            fontSize: THEME.fontSize.countdown,
            lineHeight: 1,
            fontWeight: 700,
            color: activeColor,
            transform: `scale(${digitScale})`,
            textShadow: `0 0 30px ${activeColor}55`,
          }}
        >
          {displayed}
        </span>
        {caption ? (
          <span
            style={{
              marginTop: 6,
              fontFamily: THEME.fonts.sans,
              fontSize: 24,
              letterSpacing: 6,
              color: THEME.colors.muted,
            }}
          >
            {caption}
          </span>
        ) : null}
      </div>
    </div>
  );
};
