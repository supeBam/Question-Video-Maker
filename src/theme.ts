/**
 * ============ 全局视觉主题（改这里就能换配色/字体） ============
 * 所有组件的颜色、字体、版式尺寸都从这里取，不要在组件里写死颜色。
 */
export const THEME = {
  colors: {
    /** 宣纸米黄底（浅色，护眼，适合长辈观看） */
    bgDeep: "#F3E6CF",
    /** 近白暖纸（卡片底） */
    paper: "#FFFBF2",
    /** 深墨褐（纸上文字，暖色高对比） */
    ink: "#2E2418",
    /** 主视觉金（浅底上加深，保证醒目） */
    gold: "#B98436",
    goldDim: "#9C6E2C",
    /** 朱砂红（印章、强调） */
    vermilion: "#B63A28",
    /** 正确答案绿（浅底上加深） */
    jade: "#1F7A54",
    /** 主文字色（浅底上用深墨） */
    light: "#2E2418",
    /** 次级文字 */
    muted: "rgba(46, 36, 24, 0.66)",
    /** 玻璃卡片底（暖白） */
    glass: "rgba(255, 252, 244, 0.82)",
    glassBorder: "rgba(185, 132, 54, 0.32)",
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
