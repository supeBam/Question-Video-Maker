/**
 * ============ 全局视觉主题（改这里就能换配色/字体） ============
 * 所有组件的颜色、字体、版式尺寸都从这里取，不要在组件里写死颜色。
 */
export const THEME = {
  colors: {
    /** 深色底（水墨夜空） */
    bgDeep: "#0A1620",
    /** 宣纸色（卡片底） */
    paper: "#F3EAD8",
    /** 墨色（纸上文字） */
    ink: "#17222C",
    /** 主视觉金 */
    gold: "#E5B96B",
    goldDim: "#C9A25A",
    /** 朱砂红（印章、强调） */
    vermilion: "#C4402E",
    /** 正确答案绿 */
    jade: "#43B07C",
    /** 浅色文字 */
    light: "#F3EAD8",
    /** 次级文字 */
    muted: "rgba(243, 234, 216, 0.62)",
    /** 玻璃卡片底 */
    glass: "rgba(243, 234, 216, 0.07)",
    glassBorder: "rgba(229, 185, 107, 0.28)",
  },

  fonts: {
    /** 标题/题干：宋体系（有书卷气） */
    serif:
      '"Source Han Serif SC","Noto Serif SC","STSong","SimSun","Songti SC",serif',
    /** 楷体：印章/落款 */
    kai: '"STKaiti","KaiTi","楷体","Kaiti SC",serif',
    /** 正文/UI：黑体系 */
    sans:
      '"Source Han Sans SC","Microsoft YaHei","PingFang SC","Hiragino Sans GB","Heiti SC",sans-serif',
    /** 数字（倒计时） */
    number: '"DIN Alternate","Bebas Neue","Impact","Arial Black",sans-serif',
  },

  /** 竖屏 1080x1920 版式（视频号安全区已预留） */
  layout: {
    width: 1080,
    height: 1920,
    /** 顶部安全区：避开视频号顶部 UI */
    safeTop: 128,
    /** 底部安全区：避开点赞/评论按钮 */
    safeBottom: 150,
    sideMargin: 68,
  },

  /** 字号（全部 ≥ 24px，手机小屏可读） */
  fontSize: {
    kicker: 32,
    heroTitle: 92,
    heroSub: 38,
    stem: 56,
    stemSmall: 48,
    option: 44,
    optionLabel: 40,
    explain: 32,
    header: 30,
    countdown: 104,
    outroTitle: 76,
    outroItem: 34,
    cta: 58,
  },
} as const;

export type Theme = typeof THEME;
