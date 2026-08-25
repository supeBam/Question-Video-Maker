import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { THEME } from "../theme";
import { lerp } from "../animations";

export type BackgroundProps = {
  /** 背景静态资源（public/assets 下） */
  src?: string;
  /** 顶部祥云纹样静态资源，传 null 关闭 */
  cloudSrc?: string | null;
  /** 缓慢推进的幅度（Ken Burns），0 表示静止 */
  drift?: number;
};

/**
 * 全片统一背景：宣纸米黄底 + 缓慢推镜 + 顶部祥云横移。
 * 放在合成最外层（不放进 Sequence），保证整支片子背景连续不重置。
 */
export const Background: React.FC<BackgroundProps> = ({
  src = "assets/bg-paper.svg",
  cloudSrc = "assets/cloud-pattern.svg",
  drift = 0.05,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const scale = 1 + lerp(frame, [0, durationInFrames], [0, drift]);
  const cloudX = lerp(frame, [0, durationInFrames], [0, -160]);

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.colors.bgDeep, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <Img
          src={staticFile(src)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          from={2} />
      </AbsoluteFill>
      {cloudSrc ? (
        <Img
          src={staticFile(cloudSrc)}
          style={{
            position: "absolute",
            top: 40,
            left: cloudX,
            width: 1400,
            opacity: 0.28,
          }}
          from={2} />
      ) : null}
    </AbsoluteFill>
  );
};
