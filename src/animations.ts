import { interpolate, spring } from "remotion";

const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

/** 淡入 + 上浮（最常用的入场） */
export const fadeSlideUp = (
  frame: number,
  start = 0,
  duration = 18,
  distance = 36
) => ({
  opacity: interpolate(frame, [start, start + duration], [0, 1], CLAMP),
  transform: `translateY(${interpolate(
    frame,
    [start, start + duration + 6],
    [distance, 0],
    CLAMP
  )}px)`,
});

/** 淡入 + 左滑（列表项常用） */
export const fadeSlideIn = (
  frame: number,
  start = 0,
  duration = 16,
  distance = 46
) => ({
  opacity: interpolate(frame, [start, start + duration], [0, 1], CLAMP),
  transform: `translateX(${interpolate(
    frame,
    [start, start + duration + 8],
    [-distance, 0],
    CLAMP
  )}px)`,
});

/** 交错出场：第 index 项的延迟 */
export const stagger = (index: number, gap = 9, base = 0) => base + index * gap;

/** 弹性缩放（盖章、强调） */
export const popIn = (
  frame: number,
  fps: number,
  start = 0,
  damping = 12,
  stiffness = 160
) =>
  spring({
    frame: frame - start,
    fps,
    config: { damping, stiffness, mass: 0.7 },
  });

/** 区间淡入淡出（场景整体的进出场） */
export const sceneFade = (
  frame: number,
  durationInFrames: number,
  fadeIn = 12,
  fadeOut = 12
) =>
  interpolate(
    frame,
    [0, fadeIn, Math.max(fadeIn + 1, durationInFrames - fadeOut), durationInFrames],
    [0, 1, 1, 0],
    CLAMP
  );

/** 线性映射（带 clamp 的 interpolate 简写） */
export const lerp = (
  frame: number,
  range: [number, number],
  out: [number, number]
) => interpolate(frame, range, out, CLAMP);
