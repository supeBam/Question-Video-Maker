export type QuizQuestion = {
  id: string;
  /** 题干，支持 \n 换行 */
  stem: string;
  /** 选项文案，2~4 个（默认 4 个，对应 A/B/C/D） */
  options: string[];
  /** 正确答案下标，从 0 开始 */
  answerIndex: number;
  /** 答案揭晓后的解析文案 */
  explanation: string;
  /** 可选：单题覆盖全局节奏 */
  timingOverride?: Partial<PerQuestionTiming>;
};

export type PerQuestionTiming = {
  /** 题干+选项出场并留给观众阅读的时间 */
  presentSeconds: number;
  /** 倒计时时长（几秒作答） */
  countdownSeconds: number;
  /** 揭晓答案+解析的时间 */
  revealSeconds: number;
};

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
  };
  bgm: {
    enabled: boolean;
    file: string;
    volume: number;
  };
  questions: QuizQuestion[];
};

/** ---------- 由题库推导出的时间轴 ---------- */

export type QuestionSlot = {
  question: QuizQuestion;
  index: number;
  from: number;
  durationInFrames: number;
  presentFrames: number;
  countdownFrames: number;
  revealFrames: number;
};

export type Timeline = {
  fps: number;
  introFrames: number;
  outroFrames: number;
  slots: QuestionSlot[];
  totalFrames: number;
};

export const buildTimeline = (data: QuizData): Timeline => {
  const { fps, introSeconds, outroSeconds, perQuestion } = data.timing;
  const sec = (s: number) => Math.round(s * fps);

  const introFrames = sec(introSeconds);
  const outroFrames = sec(outroSeconds);

  let cursor = introFrames;
  const slots: QuestionSlot[] = data.questions.map((question, index) => {
    const t = { ...perQuestion, ...(question.timingOverride ?? {}) };
    const presentFrames = sec(t.presentSeconds);
    const countdownFrames = sec(t.countdownSeconds);
    const revealFrames = sec(t.revealSeconds);
    const durationInFrames = presentFrames + countdownFrames + revealFrames;
    const slot: QuestionSlot = {
      question,
      index,
      from: cursor,
      durationInFrames,
      presentFrames,
      countdownFrames,
      revealFrames,
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
