/* ============================================================
 * 题库类型 + 时间轴推导
 * 支持两种题型共存于同一题库（判别联合）：
 *   - choice     选择题
 *   - fill       填空题（万物雅称：问「X 的雅称是什么」→ 揭晓雅称 + 解释）
 * ============================================================ */

/** 选择题三段式节奏 */
export type PerQuestionTiming = {
  /** 题干+选项出场并留给观众阅读的时间 */
  presentSeconds: number;
  /** 倒计时时长（几秒作答） */
  countdownSeconds: number;
  /** 揭晓答案+解析的时间 */
  revealSeconds: number;
  /** 揭晓后、下一题前的停顿秒数（仅 burst 模式生效，缺省 1s；classic 忽略） */
  pauseSeconds?: number;
};

/** 填空题节奏（三段式：呈现 → 思考 → 揭晓） */
export type FillTiming = PerQuestionTiming;

/* ---------------- 选择题 ---------------- */

export type ChoiceQuestion = {
  /** 不填或填 "choice" 都视为选择题（兼容旧题库） */
  type?: "choice";
  id: string;
  /** 题干，支持 \n 换行 */
  stem: string;
  /** 选项文案，2~4 个（默认 4 个，对应 A/B/C/D） */
  options: string[];
  /** 正确答案下标，从 0 开始 */
  answerIndex: number;
  /** 答案揭晓后的解析文案 */
  explanation: string;
  /** 可选：揭晓时口播的「一句真相」（比 explanation 短，用于配音），如「坐是因为的意思」 */
  punchline?: string;
  /** 可选：单题覆盖全局节奏 */
  timingOverride?: Partial<PerQuestionTiming>;
};

/* ---------------- 填空题（万物雅称） ---------------- */

export type FillQuestion = {
  type: "fill";
  id: string;
  /** 题干（问句），如「你知道『天上的云』古人怎么雅称吗？」，支持 \n 换行 */
  stem: string;
  /** 揭晓前的提示，如「两个字的雅称」 */
  hint?: string;
  /** 答案（雅称），如「纤凝」「望舒」 */
  answer: string;
  /** 答案页底部解释（出处 / 含义 / 相关别称） */
  explanation: string;
  /** 可选：揭晓时的一行短真相（快闪模板优先显示它；比 explanation 短，适合口播） */
  punchline?: string;
  /** 可选：题干上方的小标签，如「云」「月」「风」 */
  tag?: string;
  /** 可选：单题覆盖全局填空节奏 */
  timingOverride?: Partial<FillTiming>;
};

/** 题库中的任一题型 */
export type AnyQuestion = ChoiceQuestion | FillQuestion;

/** 题型判别 */
export const isFill = (q: AnyQuestion): q is FillQuestion => q.type === "fill";

/* ---------------- 背景板 ---------------- */

export type QuizBackground = {
  /** 背景静态资源（public/assets 下），缺省 "assets/bg-paper.svg" */
  src?: string;
  /** 顶部祥云纹样，传 null 关闭，缺省 "assets/cloud-pattern.svg" */
  cloudSrc?: string | null;
  /** 缓慢推进幅度（Ken Burns），0 表示静止，缺省 0.05 */
  drift?: number;
};

/* ---------------- 整份题库 ---------------- */

export type QuizData = {
  meta: {
    series: string;
    episode: number;
    episodeLabel: string;
    hostTag: string;
  };
  timing: {
    fps: number;
    introSeconds: number;
    outroSeconds: number;
    /** 选择题三段式节奏（classic 模式缺省时由 buildTimeline 兜底；burst 模式可省略） */
    perQuestion?: PerQuestionTiming;
    /** 填空题全局节奏（缺省时由 buildTimeline 兜底） */
    fill?: FillTiming;
    /**
     * 节奏模式：
     *   - "classic"（缺省）三段式：呈现 → 倒计时作答 → 揭晓解析
     *   - "burst"   爆款快闪（对标「学霸都考哭了」系列）：零片头、
     *     每题约 5 秒两段式（题干快速呈现 → 答案立即揭晓），无倒计时。
     *     题库里显式给出的 perQuestion / fill 值仍然优先于 burst 默认值。
     */
    pacing?: "classic" | "burst";
    /**
     * 快闪模板音效开关（classic 模式忽略此字段）：
     *   - 缺省或 true：揭晓时播「正确答案音效」；若 perQuestion 显式给了
     *     countdownSeconds > 0，则作答阶段还会播倒计时音效并显示倒计时环
     *   - false：纯快闪无音效（完全对标「学霸都考哭了」系列）
     */
    soundEffects?: boolean;
    /**
     * 剪映「字幕转音频」朗读语速（字/秒），仅 burst 模式生效：
     * 每题字幕区间按此自动兜底——题干段（present+countdown）至少覆盖
     * 题干朗读时长 + 0.5s，答案段（reveal+pause）至少覆盖答案朗读时长 + 0.6s，
     * 防止上一段音频没读完就叠进下一段（听感重复/重叠）。
     * 缺省 4.5 字/秒；设 0 关闭自动兜底。
     */
    ttsWordsPerSecond?: number;
    /**
     * 极简片尾（burst 模式专属）：缺省 false —— 保留 3 秒「全对=学霸 + CTA」文字版片尾；
     * 设 true 时视频在最后一题结束后直接结束（不含片尾帧），钩子图/答案图由用户发布时自行导入。
     */
    minimalOutro?: boolean;
    /**
     * 快闪模板片尾「本期答案」回顾时长（秒）：在片尾 CTA 之前逐题展示
     * 题干→答案→解释（仅画面，不进字幕）。缺省 12 秒；设 0 关闭。
     * classic 模式忽略此字段。
     */
    summarySeconds?: number;
    /**
     * 快闪模板钩子开场时长（秒）：题目开始前先播放挑战标题画面
     * （栏目 + 大标题 + 挑战词，如「10 题 · 答对 8 个算你牛」）。
     * 缺省 2 秒；设 0 则零片头直接进第一题（完全对标）。
     * classic 模式忽略此字段（用 introSeconds 片头）。
     */
    hookSeconds?: number;
  };
  intro: {
    kicker: string;
    title: string;
    subtitle: string;
    hint: string;
  };
  outro: {
    headline: string;
    scoreHints: string[];
    cta: string;
    ctaSub: string;
    /** 可选：片尾口播钩子（用于配音/SRT），如「你答对了几题？评论区告诉我」 */
    hook?: string;
    /** 可选：片尾「看答案」引导文案（burst 片尾画面显示，如「答案在后面，别划走」） */
    answerHint?: string;
  };
  voiceOver: {
    enabled: boolean;
  };
  bgm: {
    enabled: boolean;
    file: string;
    volume: number;
  };
  /** 可选：发布文案（标题、话题）。缺省时由脚本从 intro/series 自动推导。 */
  publish?: {
    /** 全局兜底标题 / 话题（两个平台共用） */
    title?: string;
    hashtags?: string[];
    /** 抖音专属覆盖 */
    douyin?: { title?: string; hashtags?: string[] };
    /** 视频号专属覆盖 */
    wechat?: { title?: string; hashtags?: string[] };
    /** 爆款快闪模板：顶部激励角标文案（缺省「全对 = 学霸」） */
    badge?: string;
    /** 爆款快闪模板：底部收藏指令文案（缺省「❤ 收藏 · 考考孩子」） */
    saveText?: string;
    /** 爆款快闪模板：底部免责声明（缺省「内容来源于公开资料」） */
    disclaimer?: string;
    /** 爆款快闪模板：钩子开场的挑战词（缺省自动生成「共 N 题 · 全对算你厉害」） */
    challenge?: string;
  };
  /** 可选：背景板配置（换专题皮肤）。缺省用宣纸米黄底。 */
  background?: QuizBackground;
  questions: AnyQuestion[];
};

/** ---------- 由题库推导出的时间轴 ---------- */

export type QuestionSlot = {
  /** 题型，用于场景路由 */
  kind: "choice" | "fill";
  index: number;
  from: number;
  durationInFrames: number;
  /** —— 选择题 / 填空题三段式 —— */
  presentFrames: number;
  countdownFrames: number;
  revealFrames: number;
  /** 揭晓后、下一题前的停顿帧数（burst 模式 ≥0；classic 恒为 0） */
  pauseFrames: number;
  question: AnyQuestion;
};

export type Timeline = {
  fps: number;
  introFrames: number;
  /** 快闪模板钩子开场时长（classic 模式恒为 0） */
  hookFrames: number;
  outroFrames: number;
  /** 快闪模板片尾答案回顾时长（classic 模式恒为 0） */
  summaryFrames: number;
  slots: QuestionSlot[];
  totalFrames: number;
};

/** 填空题节奏兜底值（呈现 → 思考 → 揭晓） */
export const DEFAULT_FILL_TIMING: FillTiming = {
  presentSeconds: 3.5,
  countdownSeconds: 6,
  revealSeconds: 7,
};

/** 经典模式选择题节奏兜底值（老题库缺省 perQuestion 时的安全值） */
export const DEFAULT_CLASSIC_TIMING: PerQuestionTiming = {
  presentSeconds: 3.5,
  countdownSeconds: 5,
  revealSeconds: 7,
};

/**
 * 爆款快闪节奏兜底（对标「学霸都考哭了」系列实测：平均每题 4.6~6.5 秒）。
 * 呈现 2.2s（题干+选项入场）→ 揭晓 2.8s（答案高亮 + 一句真相），无倒计时；
 * 揭晓后再留 1s 题间停顿，给 TTS 朗读缓冲，避免「答案一出立刻读下一题」。
 */
export const DEFAULT_BURST_TIMING: PerQuestionTiming = {
  presentSeconds: 2.2,
  countdownSeconds: 0,
  revealSeconds: 2.8,
  pauseSeconds: 1,
};

/** 剪映「字幕转音频」缺省朗读语速（字/秒），用于 burst 模式每题时长兜底 */
export const DEFAULT_TTS_WORDS_PER_SECOND = 4.5;
/** 题干段（present+countdown）在朗读时长外额外留的缓冲秒数 */
const SPEAK_BUFFER_LEAD = 0.5;
/** 答案段（reveal+pause）在朗读时长外额外留的缓冲秒数 */
const SPEAK_BUFFER_ANSWER = 0.6;

/** 估算剪映 TTS 朗读某段文本所需秒数（wps ≤ 0 时返回 0，关闭兜底） */
const speakSeconds = (text: string, wps: number) =>
  wps > 0 && text ? text.length / wps : 0;

/** 揭晓段朗读文本（与 SRT 答案字幕一致） */
const answerText = (q: AnyQuestion): string => {
  if (isFill(q)) return q.answer;
  return `正确答案：${String.fromCharCode(65 + q.answerIndex)}. ${q.options[q.answerIndex]}`;
};

/** 计算单题三段式 + 停顿帧数（burst 模式启用 pause 与 TTS 语速兜底） */
const resolveSlotTiming = (
  question: AnyQuestion,
  baseTiming: PerQuestionTiming,
  burst: boolean,
  ttsWps: number,
  fps: number
) => {
  const t = { ...baseTiming, ...(question.timingOverride ?? {}) };
  let presentSeconds = t.presentSeconds;
  let countdownSeconds = t.countdownSeconds;
  let revealSeconds = t.revealSeconds;
  const pauseSeconds = burst ? (t.pauseSeconds ?? DEFAULT_BURST_TIMING.pauseSeconds ?? 1) : 0;

  if (burst && ttsWps > 0) {
    // 题干段（present+countdown）至少覆盖题干朗读 + 缓冲
    const leadNeed = speakSeconds(question.stem.replace(/\n/g, ""), ttsWps) + SPEAK_BUFFER_LEAD;
    if (presentSeconds + countdownSeconds < leadNeed) {
      presentSeconds += leadNeed - (presentSeconds + countdownSeconds);
    }
    // 答案段（reveal+pause）至少覆盖答案朗读 + 缓冲
    const answerNeed = speakSeconds(answerText(question), ttsWps) + SPEAK_BUFFER_ANSWER;
    if (revealSeconds + pauseSeconds < answerNeed) {
      revealSeconds = answerNeed - pauseSeconds;
    }
  }

  const sec = (s: number) => Math.round(s * fps);
  const presentFrames = sec(presentSeconds);
  const countdownFrames = sec(countdownSeconds);
  const revealFrames = sec(revealSeconds);
  const pauseFrames = sec(pauseSeconds);
  return {
    presentFrames,
    countdownFrames,
    revealFrames,
    pauseFrames,
    durationInFrames: presentFrames + countdownFrames + revealFrames + pauseFrames,
  };
};

export const buildTimeline = (data: QuizData): Timeline => {
  const { fps, introSeconds, outroSeconds } = data.timing;
  const burst = data.timing.pacing === "burst";
  // 剪映「字幕转音频」语速兜底（仅 burst；设 0 关闭）
  const ttsWps = burst ? (data.timing.ttsWordsPerSecond ?? DEFAULT_TTS_WORDS_PER_SECOND) : 0;
  const perQuestion = burst
    ? { ...DEFAULT_BURST_TIMING, ...(data.timing.perQuestion ?? {}) }
    : { ...DEFAULT_CLASSIC_TIMING, ...(data.timing.perQuestion ?? {}) };
  const fillTiming = burst
    ? { ...DEFAULT_BURST_TIMING, ...(data.timing.fill ?? {}) }
    : {
        ...DEFAULT_FILL_TIMING,
        ...(data.timing.fill ?? {}),
      };
  const sec = (s: number) => Math.round(s * fps);

  // burst 模式强制零片头：对标爆款视频第一帧即第一题
  const introFrames = burst ? 0 : sec(introSeconds);
  // 快闪模板钩子开场（缺省 2 秒；hookSeconds: 0 零片头直接进题）
  const hookFrames = burst ? sec(data.timing.hookSeconds ?? 2) : 0;
  // 极简片尾（burst 专属，缺省 false）：保留文字版片尾；显式 minimalOutro: true 时
  // 连片尾帧都不要，视频在最后一题结束，钩子图/答案图由用户发布时自行导入
  const minimalOutro = burst && data.timing.minimalOutro === true;
  const outroFrames = minimalOutro ? 0 : sec(outroSeconds);
  // 快闪模板片尾答案回顾（缺省 12 秒；summarySeconds: 0 关闭；classic 恒为 0）
  const summaryFrames = burst ? sec(data.timing.summarySeconds ?? 12) : 0;

  let cursor = burst ? hookFrames : introFrames;
  const slots: QuestionSlot[] = data.questions.map((question, index) => {
    const baseTiming = isFill(question) ? fillTiming : perQuestion;
    const timing = resolveSlotTiming(question, baseTiming, burst, ttsWps, fps);
    const slot: QuestionSlot = {
      kind: isFill(question) ? "fill" : "choice",
      index,
      from: cursor,
      durationInFrames: timing.durationInFrames,
      presentFrames: timing.presentFrames,
      countdownFrames: timing.countdownFrames,
      revealFrames: timing.revealFrames,
      pauseFrames: timing.pauseFrames,
      question,
    };
    cursor += timing.durationInFrames;
    return slot;
  });

  return {
    fps,
    introFrames,
    hookFrames,
    outroFrames,
    summaryFrames,
    slots,
    totalFrames: cursor + summaryFrames + outroFrames,
  };
};
