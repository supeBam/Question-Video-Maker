/* ============================================================
 * 题库类型 + 时间轴推导
 * 支持三种题型共存于同一题库（判别联合）：
 *   - choice     选择题（原有）
 *   - crossword  诗词填字纵横（多句诗纵横交叉，交叉点共用同一字）
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
};

/** 诗词填字纵横节奏 */
export type CrosswordTiming = {
  /** 题目（纵横填字网格）展示 + 倒计时时长 */
  displaySeconds: number;
  /** 答案页（点亮补全 + 图例 + 赏析）时长 */
  answerSeconds: number;
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

/* ---------------- 诗词填字纵横 ---------------- */

/** 单条线索的出处（哪首诗 / 哪位诗人） */
export type CrosswordSource = {
  /** 诗名，如「静夜思」 */
  title: string;
  /** 作者，如「李白」 */
  author?: string;
  /** 朝代，如「唐」 */
  dynasty?: string;
};

/**
 * 一条线索 = 从某首诗里抽出的「一句」，沿 横/纵 方向摆放。
 * 多条线索纵横交叉，交叉点必须是同一个字（由作者摆位保证，
 * 构建网格时会校验；不一致会在控制台告警）。
 */
export type CrosswordClue = {
  /** 线索标识，如 "A1" / "D1" 或 "横1" / "纵1" */
  id: string;
  /** 方向：across 横（从左向右）/ down 纵（从上向下） */
  dir: "across" | "down";
  /** 起始格行号（从 0 开始） */
  row: number;
  /** 起始格列号（从 0 开始） */
  col: number;
  /** 该线索的完整诗句（答案），如「床前明月光」 */
  text: string;
  /** 出处（答案页图例显示） */
  source?: CrosswordSource;
  /**
   * 留空待填的字下标（0-based）。缺省表示这条线索整句给出、无可填。
   * 交叉点若被某条线索标为留白，则该格按留白处理（两向共用同一字）。
   */
  blanks?: number[];
};

export type CrosswordQuestion = {
  type: "crossword";
  id: string;
  /** 可选谜面标题，如「月字相连」 */
  title?: string;
  /** 展示阶段提示，如「六句诗纵横交织，把缺的字补上」 */
  hint?: string;
  /** 线索集合（多条诗句，纵横交叉，整体为一题） */
  clues: CrosswordClue[];
  /** 答案页赏析文案 */
  explanation?: string;
  /** 可选：单题覆盖全局诗词填字节奏 */
  timingOverride?: Partial<CrosswordTiming>;
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
  /** 可选：题干上方的小标签，如「云」「月」「风」 */
  tag?: string;
  /** 可选：单题覆盖全局填空节奏 */
  timingOverride?: Partial<FillTiming>;
};

/** 题库中的任一题型 */
export type AnyQuestion = ChoiceQuestion | CrosswordQuestion | FillQuestion;

/** 题型判别 */
export const isCrossword = (q: AnyQuestion): q is CrosswordQuestion =>
  q.type === "crossword";

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
    perQuestion: PerQuestionTiming;
    /** 诗词填字纵横全局节奏（缺省时由 buildTimeline 兜底为 45s / 7s） */
    crossword?: CrosswordTiming;
    /** 填空题全局节奏（缺省时由 buildTimeline 兜底） */
    fill?: FillTiming;
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
  };
  /** 可选：背景板配置（换专题皮肤）。缺省用宣纸米黄底。 */
  background?: QuizBackground;
  questions: AnyQuestion[];
};

/** ---------- 由题库推导出的时间轴 ---------- */

export type QuestionSlot = {
  /** 题型，用于场景路由 */
  kind: "choice" | "crossword" | "fill";
  index: number;
  from: number;
  durationInFrames: number;
  /** —— 选择题 / 填空题三段式 —— */
  presentFrames: number;
  countdownFrames: number;
  revealFrames: number;
  /** —— 诗词填字纵横两阶段 —— */
  displayFrames: number;
  answerFrames: number;
  question: AnyQuestion;
};

export type Timeline = {
  fps: number;
  introFrames: number;
  outroFrames: number;
  slots: QuestionSlot[];
  totalFrames: number;
};

/** 诗词填字纵横节奏兜底值 */
export const DEFAULT_CROSSWORD_TIMING: CrosswordTiming = {
  displaySeconds: 45,
  answerSeconds: 7,
};

/** 填空题节奏兜底值（呈现 → 思考 → 揭晓） */
export const DEFAULT_FILL_TIMING: FillTiming = {
  presentSeconds: 3.5,
  countdownSeconds: 6,
  revealSeconds: 7,
};

export const buildTimeline = (data: QuizData): Timeline => {
  const { fps, introSeconds, outroSeconds, perQuestion } = data.timing;
  const crosswordTiming = {
    ...DEFAULT_CROSSWORD_TIMING,
    ...(data.timing.crossword ?? {}),
  };
  const fillTiming = {
    ...DEFAULT_FILL_TIMING,
    ...(data.timing.fill ?? {}),
  };
  const sec = (s: number) => Math.round(s * fps);

  const introFrames = sec(introSeconds);
  const outroFrames = sec(outroSeconds);

  let cursor = introFrames;
  const slots: QuestionSlot[] = data.questions.map((question, index) => {
    if (isCrossword(question)) {
      const t = { ...crosswordTiming, ...(question.timingOverride ?? {}) };
      const displayFrames = sec(t.displaySeconds);
      const answerFrames = sec(t.answerSeconds);
      const durationInFrames = displayFrames + answerFrames;
      const slot: QuestionSlot = {
        kind: "crossword",
        index,
        from: cursor,
        durationInFrames,
        presentFrames: 0,
        countdownFrames: 0,
        revealFrames: 0,
        displayFrames,
        answerFrames,
        question,
      };
      cursor += durationInFrames;
      return slot;
    }

    if (isFill(question)) {
      const t = { ...fillTiming, ...(question.timingOverride ?? {}) };
      const presentFrames = sec(t.presentSeconds);
      const countdownFrames = sec(t.countdownSeconds);
      const revealFrames = sec(t.revealSeconds);
      const durationInFrames = presentFrames + countdownFrames + revealFrames;
      const slot: QuestionSlot = {
        kind: "fill",
        index,
        from: cursor,
        durationInFrames,
        presentFrames,
        countdownFrames,
        revealFrames,
        displayFrames: 0,
        answerFrames: 0,
        question,
      };
      cursor += durationInFrames;
      return slot;
    }

    // 选择题
    const t = { ...perQuestion, ...(question.timingOverride ?? {}) };
    const presentFrames = sec(t.presentSeconds);
    const countdownFrames = sec(t.countdownSeconds);
    const revealFrames = sec(t.revealSeconds);
    const durationInFrames = presentFrames + countdownFrames + revealFrames;
    const slot: QuestionSlot = {
      kind: "choice",
      index,
      from: cursor,
      durationInFrames,
      presentFrames,
      countdownFrames,
      revealFrames,
      displayFrames: 0,
      answerFrames: 0,
      question,
    };
    cursor += durationInFrames;
    return slot;
  });

  return {
    fps,
    introFrames,
    outroFrames,
    slots,
    totalFrames: cursor + outroFrames,
  };
};
