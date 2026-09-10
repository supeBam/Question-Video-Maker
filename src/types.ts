/* ============================================================
 * 题库类型 + 时间轴推导
 * 支持两种题型共存于同一题库（判别联合）：
 *   - choice     选择题
 *   - fill       填空题（万物雅称：问「X 的雅称是什么」→ 揭晓雅称 + 解释）
 * ============================================================ */

/** 选择题两段式节奏（呈现 → 揭晓）+ 题间停顿 */
export type PerQuestionTiming = {
  /** 题干+选项出场并留给观众阅读的时间 */
  presentSeconds: number;
  /** 倒计时时长（几秒作答）；快闪模板通常为 0（无倒计时） */
  countdownSeconds: number;
  /** 揭晓答案+解析的时间 */
  revealSeconds: number;
  /** 揭晓后、下一题前的停顿秒数（缺省 1s） */
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
    /** 选择题节奏（缺省时由 buildTimeline 用快闪兜底值补齐） */
    perQuestion?: PerQuestionTiming;
    /** 填空题节奏（缺省时用快闪兜底值补齐） */
    fill?: FillTiming;
    /** 节奏模式：固定 "burst"（爆款快闪）。保留此字段兼容旧题库，忽略其它值。 */
    pacing?: "burst";
    /**
     * 音效开关：
     *   - 缺省或 true：揭晓时播「正确答案音效」；若 perQuestion 显式给了
     *     countdownSeconds > 0，则作答阶段还会播倒计时音效并显示倒计时环
     *   - false：纯快闪无音效
     */
    soundEffects?: boolean;
    /**
     * 剪映「字幕转音频」朗读语速（字/秒）：
     * 每题字幕区间按此自动兜底——题干段（present+countdown）至少覆盖
     * 题干朗读时长 + 0.5s，答案段（reveal+pause）至少覆盖答案朗读时长 + 0.6s，
     * 防止上一段音频没读完就叠进下一段（听感重复/重叠）。
     * 缺省 4.5 字/秒；设 0 关闭自动兜底。
     */
    ttsWordsPerSecond?: number;
    /**
     * 极简片尾：缺省 false —— 保留「全对=学霸 + CTA」文字版片尾；
     * 设 true 时视频在最后一题结束后直接结束（不含片尾帧）。
     */
    minimalOutro?: boolean;
    /**
     * 片尾「本期答案」回顾时长（秒）：在片尾 CTA 之前逐题展示
     * 题干→答案→解释（仅画面，不进字幕）。缺省 12 秒；设 0 关闭。
     */
    summarySeconds?: number;
    /**
     * 钩子开场时长（秒）：题目开始前先播放挑战标题画面
     * （栏目 + 大标题 + 挑战词，如「10 题 · 答对 8 个算你牛」）。
     * 缺省 2 秒；设 0 则零片头直接进第一题。
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
  /** —— 两段式：呈现 → 揭晓 —— */
  presentFrames: number;
  countdownFrames: number;
  revealFrames: number;
  /** 揭晓后、下一题前的停顿帧数（≥0） */
  pauseFrames: number;
  question: AnyQuestion;
};

export type Timeline = {
  fps: number;
  /** 钩子开场时长（零片头时可能为 0） */
  hookFrames: number;
  outroFrames: number;
  /** 片尾答案回顾时长 */
  summaryFrames: number;
  slots: QuestionSlot[];
  totalFrames: number;
};

/**
 * 快闪节奏兜底（对标「学霸都考哭了」系列实测：平均每题 4.6~6.5 秒）。
 * 呈现 2.2s（题干+选项入场）→ 揭晓 2.8s（答案高亮 + 一句真相），无倒计时；
 * 揭晓后再留 1s 题间停顿，给 TTS 朗读缓冲，避免「答案一出立刻读下一题」。
 */
export const DEFAULT_BURST_TIMING: PerQuestionTiming = {
  presentSeconds: 2.2,
  countdownSeconds: 0,
  revealSeconds: 2.8,
  pauseSeconds: 1,
};

/** 剪映「字幕转音频」缺省朗读语速（字/秒），用于每题时长兜底 */
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

/**
 * 单段音频实测时长（毫秒）。由 `gen-burst-tts.py` 写出的 measurements.json 解码后传入。
 * segment 取值：
 *   - "question"  题干段（含 punchline 时还覆盖题干的 present+countdown）
 *   - "answer"    答案段（揭晓答案那一行）
 *   - "punchline" 一句真相段（选择题且题库带 punchline 才有）
 */
export type AudioSegmentMeasurements = {
  question?: number;
  answer?: number;
  punchline?: number;
};

/** 实测音频时长 → buildTimeline 兜底（gen-burst-tts.py 输出）。 */
export type AudioMeasurements = Record<string, AudioSegmentMeasurements>;

/** 计算单题两段式 + 停顿帧数（启用 pause 与 TTS 语速兜底） */
const resolveSlotTiming = (
  question: AnyQuestion,
  baseTiming: PerQuestionTiming,
  ttsWps: number,
  fps: number,
  audioMeas?: AudioSegmentMeasurements,
  includePunchlineAudio = false
) => {
  const t = { ...baseTiming, ...(question.timingOverride ?? {}) };
  let presentSeconds = t.presentSeconds;
  let countdownSeconds = t.countdownSeconds;
  let revealSeconds = t.revealSeconds;
  const pauseSeconds = t.pauseSeconds ?? DEFAULT_BURST_TIMING.pauseSeconds ?? 1;

  // 决定兜底源：实测音频时长优先 > 字/秒估算 > 关闭兜底
  //  - 有 audioMeas：用实测时长 + 缓冲（音频驱动视频，TTS 念完才切下一题）
  //  - 仅 ttsWps > 0：用字/秒估算（兼容老剪映手工配音场景）
  //  - 都没有：保持 timing 字段原值
  const useMeasured = !!(audioMeas && (audioMeas.question !== undefined || audioMeas.answer !== undefined));

  if (useMeasured && audioMeas) {
    // 题干段（present+countdown）至少覆盖题干 + 缓冲
    if (audioMeas.question !== undefined) {
      const leadNeed = audioMeas.question / 1000 + SPEAK_BUFFER_LEAD;
      if (presentSeconds + countdownSeconds < leadNeed) {
        presentSeconds += leadNeed - (presentSeconds + countdownSeconds);
      }
    }
    // 答案段（reveal+pause）至少覆盖答案音频 + 缓冲；
    // 是否算 punchline 由调用方（BuildTimelineOptions.includePunchlineAudio）决定：
    // 缺省 false —— BurstScene 已不播 punchline 音频，避免与画面底部解释文字听感拥挤。
    const answerMs = audioMeas.answer ?? 0;
    const punchlineMs =
      includePunchlineAudio && audioMeas.punchline !== undefined
        ? audioMeas.punchline
        : 0;
    const answerNeed = (answerMs + punchlineMs) / 1000 + SPEAK_BUFFER_ANSWER;
    if (revealSeconds + pauseSeconds < answerNeed) {
      revealSeconds = answerNeed - pauseSeconds;
    }
  } else if (ttsWps > 0) {
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

/** buildTimeline 的可选入参。
 *  - audioMeasurements：每道题实测音频时长（毫秒）。有值时优先于字/秒估算。
 *    与 gen-burst-tts.py 写出的 out/{video-label}-audio-measurements.json 配套。
 *  - hookAudioMs：钩子开场 intro.title 的实测音频时长（毫秒）。有值时优先于字数估算。
 *    若未提供，按 ttsWordsPerSecond 兜底；都没有时保持 timing.hookSeconds。
 *  - outroHookMs：片尾 outro.hook 口播的实测音频时长（毫秒）。
 *    若测得超出 outroSeconds，视频时长按实测 + 缓冲延长，确保口播完整。
 *  - includePunchlineAudio：是否把 measurements.punchline 的时长算进答案段视频时长。
 *    缺省 false（BurstScene 已不播 punchline 音频——避免与画面底部解释文字"打架"）。
 *    设 true 时视频时长按"答案 + 一句真相"音频总和兜底（兼容未来老场景）。
 */
export type BuildTimelineOptions = {
  audioMeasurements?: AudioMeasurements;
  hookAudioMs?: number;
  outroHookMs?: number;
  includePunchlineAudio?: boolean;
};

export const buildTimeline = (
  data: QuizData,
  options: BuildTimelineOptions = {}
): Timeline => {
  const { fps, outroSeconds } = data.timing;
  const includePunchlineAudio = options.includePunchlineAudio === true;
  const audioMeas = options.audioMeasurements;
  const hookMeasMs = options.hookAudioMs;
  // 实测钩子音频时长存在 → 关闭字数估算，按实测走（音频驱动视频）
  // 实测钩子音频时长不存在 → 退回字/秒估算（兼容老剪映手工配音）
  // 都没有 → 保持 timing 字段原值
  const hasAnyMeas = !!(audioMeas || hookMeasMs !== undefined);
  const ttsWps = hasAnyMeas
    ? 0
    : data.timing.ttsWordsPerSecond ?? DEFAULT_TTS_WORDS_PER_SECOND;
  const perQuestion = { ...DEFAULT_BURST_TIMING, ...(data.timing.perQuestion ?? {}) };
  const fillTiming = { ...DEFAULT_BURST_TIMING, ...(data.timing.fill ?? {}) };
  const sec = (s: number) => Math.round(s * fps);

  // 快闪钩子开场（缺省 2 秒；hookSeconds: 0 零片头直接进题）
  let hookFrames = sec(data.timing.hookSeconds ?? 2);
  // 实测钩子音频时长优先（音频驱动视频）：
  if (hookMeasMs !== undefined) {
    hookFrames = Math.max(hookFrames, sec(hookMeasMs / 1000 + 0.5));
  } else if (ttsWps > 0) {
    // 字数兜底：钩子开场字幕（intro.title）至少覆盖朗读时长 + 缓冲，
    // 避免钩子口播没读完就叠进第一题题干（剪映字幕转音频会重叠）
    const hookText = (data.intro?.title ?? "").replace(/\n/g, "");
    const hookNeed = speakSeconds(hookText, ttsWps) + 0.5;
    hookFrames = Math.max(hookFrames, sec(hookNeed));
  }
  // 极简片尾（缺省 false）：保留文字版片尾；显式 minimalOutro: true 时
  // 连片尾帧都不要，视频在最后一题结束
  const minimalOutro = data.timing.minimalOutro === true;
  let outroFrames = minimalOutro ? 0 : sec(outroSeconds);
  // 实测片尾口播钩子时长兜底：从片尾第 60 帧（≈2s）开始播，
  // 总时长至少覆盖「钩子实测 + 2s 缓冲」——确保「你全对了吗…」念完再结束。
  if (!minimalOutro && options.outroHookMs !== undefined) {
    const outroNeed = options.outroHookMs / 1000 + 2;
    outroFrames = Math.max(outroFrames, sec(outroNeed));
  }
  // 片尾答案回顾（缺省 12 秒；summarySeconds: 0 关闭）
  const summaryFrames = sec(data.timing.summarySeconds ?? 12);

  let cursor = hookFrames;
  const slots: QuestionSlot[] = data.questions.map((question, index) => {
    const baseTiming = isFill(question) ? fillTiming : perQuestion;
    const timing = resolveSlotTiming(
      question,
      baseTiming,
      ttsWps,
      fps,
      audioMeas?.[question.id],
      includePunchlineAudio
    );
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
    hookFrames,
    outroFrames,
    summaryFrames,
    slots,
    totalFrames: cursor + summaryFrames + outroFrames,
  };
};
