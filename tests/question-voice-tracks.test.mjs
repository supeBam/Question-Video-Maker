import assert from "node:assert/strict";
import test from "node:test";
import { getQuestionVoiceTracks } from "../src/questionVoiceTracks.ts";

test("题目音轨路径根据栏目和期数生成", () => {
  assert.deepEqual(
    getQuestionVoiceTracks(
      { series: "中国历史冷知识", episodeLabel: "第 01 期" },
      "q3"
    ),
    {
      question: "assets/tts/中国历史冷知识-第01期/q3-question.mp3",
      answer: "assets/tts/中国历史冷知识-第01期/q3-answer.mp3",
      punchline: "assets/tts/中国历史冷知识-第01期/q3-punchline.mp3",
      volume: 4,
    }
  );

  assert.equal(
    getQuestionVoiceTracks(
      { series: "中国文学名句", episodeLabel: "第 01 期" },
      "q5"
    ).answer,
    "assets/tts/中国文学名句-第01期/q5-answer.mp3"
  );
});

test("题目音轨路径拒绝空元数据和空题目 ID", () => {
  assert.throws(
    () => getQuestionVoiceTracks({ series: "", episodeLabel: "第 01 期" }, "q1"),
    /栏目名/
  );
  assert.throws(
    () => getQuestionVoiceTracks({ series: "中国历史冷知识", episodeLabel: "" }, "q1"),
    /期数/
  );
  assert.throws(
    () =>
      getQuestionVoiceTracks(
        { series: "中国历史冷知识", episodeLabel: "第 01 期" },
        ""
      ),
    /题目 ID/
  );
});
