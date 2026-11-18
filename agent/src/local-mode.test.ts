import { test } from "node:test";
import assert from "node:assert/strict";
import { TONE, voice } from "./voice.ts";
import { LINES, LOCAL_TONE, bubbleLine, dayPart, localThought, planReply, spoken } from "./local-mode.ts";

const morning = new Date("2026-10-09T20:00:00Z"); // 05:00 KST
const lunch = new Date("2026-10-10T03:00:00Z"); // 12:00 KST
const evening = new Date("2026-10-10T10:00:00Z"); // 19:00 KST

function sentences(s: string): number {
  const core = s.replace(/\s*\([^)]*\)\s*$/u, "");
  return core.split(/[.!?。]/).map((x) => x.trim()).filter(Boolean).length;
}

test("말투는 TONE이고 양념은 voice()가 맡는다", () => {
  assert.equal(LOCAL_TONE, TONE);
  assert.match(LOCAL_TONE, /존댓말/);
  const seed = "tone-seed";
  assert.equal(spoken(LINES.morning, seed, "calm"), voice(LINES.morning, seed, { mood: "calm" }));
});

test("시간대는 Asia/Seoul 아침·점심·저녁", () => {
  assert.equal(dayPart(new Date("2026-10-09T19:59:00Z")), "evening"); // 04:59 KST. UTC로는 저녁이 아니다
  assert.equal(dayPart(new Date("2026-10-09T20:00:00Z")), "morning"); // 05:00
  assert.equal(dayPart(new Date("2026-10-10T02:59:00Z")), "morning"); // 11:59
  assert.equal(dayPart(new Date("2026-10-10T03:00:00Z")), "lunch"); // 12:00
  assert.equal(dayPart(new Date("2026-10-10T03:59:00Z")), "lunch"); // 12:59
  assert.equal(dayPart(new Date("2026-10-10T04:00:00Z")), "afternoon"); // 13:00
  assert.equal(dayPart(new Date("2026-10-10T07:18:00Z")), "afternoon"); // 16:18
  assert.equal(dayPart(new Date("2026-10-10T08:59:00Z")), "afternoon"); // 17:59
  assert.equal(dayPart(new Date("2026-10-10T09:00:00Z")), "evening"); // 18:00
  assert.equal(dayPart(morning), "morning");
  assert.equal(dayPart(lunch), "lunch");
  assert.equal(dayPart(evening), "evening");
});

test('플래너: 모든 우선순위의 예정일과 기간, 반복 항목, 링크, 완료 제외',()=>{
 const now=new Date('2026-11-18T12:00:00+09:00');
 assert.equal(planReply([],now),LINES.empty);
 const text=planReply([
 {id:'later',title:'나중',priority:2,scheduledDate:'2026-11-20'},
 {id:'undated',title:'기타',priority:4},
 {id:'past',title:'기한 지남',priority:4,scheduledDate:'2026-11-17'},
 {id:'range',title:'기간',priority:3,doing:true,schedule:{mode:'range',start:'2026-11-16',end:'2026-11-20'}},
 {id:'repeat',title:'반복 항목',priority:1,scheduledDate:'2026-11-19'},
 {id:'done',title:'완료됨',status:'done'}],now);
 assert.ok(text.includes('| 11/17 | 미완료 | [기한 지남](#past) |'));
 assert.ok(text.includes('| 11/16 ~ 11/20 | 진행 중 | [기간](#range) |'));
 assert.ok(text.includes('| 11/19 | 예정 | [반복 항목](#repeat) |'));
 assert.ok(text.includes('| 날짜 없음 | 대기 | [기타](#undated) |'));
 assert.ok(text.indexOf('#past')<text.indexOf('#range')&&text.indexOf('#repeat')<text.indexOf('#later')&&text.indexOf('#later')<text.indexOf('#undated'));
 assert.doesNotMatch(text,/완료됨|우선순위/);
});

test("로컬 Thought: 리마인드·칭찬·인사, 할 일은 짓지 않는다", () => {
  const open = [
    { title: "견적 회신", priority: 1, scheduledDate:"2026-10-10" },
    { title: "문서", priority: 3 },
    { title: "나중 일", priority: 2 },
    { title: "백로그", priority: 4 },
  ];
  const done = [{ title: "끝난 보고서", priority: 2 }];
  const seed = "brief-1";
  const t = localThought(morning, open, done, seed);
  assert.equal(t.bubble, bubbleLine(LINES.remind, `${seed}:bubble`, "busy"));
  assert.ok(t.bubble.length <= 40, t.bubble);
  assert.equal(t.bubble.includes("\n"), false);
  assert.equal(sentences(t.bubble), 1);
  assert.match(t.reply_md, /아침/);
  assert.match(t.reply_md, /견적 회신/);
  assert.match(t.reply_md, /문서/);
  assert.match(t.reply_md, /끝난 보고서/);
  assert.match(t.reply_md, /잘하셨어요/);
  assert.match(t.reply_md, /나중 일/);
  assert.match(t.reply_md, /백로그/);
  assert.deepEqual(t.todos, []);
  assert.deepEqual(t.done_todo_ids, []);
  assert.deepEqual(t.proposals, []);
  assert.deepEqual(t, localThought(morning, open, done, seed));
});

test("우선순위 1이 없으면 끝낸 일을 칭찬하고, 둘 다 없으면 인사만", () => {
  const praised = localThought(evening, [], [{ title: "회고" }], "praise");
  assert.equal(praised.bubble, bubbleLine(LINES.praise, "praise:bubble", "happy"));
  assert.match(praised.reply_md, /저녁/);
  assert.match(praised.reply_md, /회고/);
  assert.equal(sentences(praised.bubble), 1);
  const quiet = localThought(lunch, [{ title: "이번 주", priority: 2 }], [], "quiet");
  assert.equal(quiet.bubble, bubbleLine(LINES.lunch, "quiet:bubble", "calm"));
  assert.match(quiet.reply_md, /점심/);
  assert.match(quiet.reply_md, /날짜 없음/);
  assert.match(quiet.reply_md, /이번 주/);
  assert.deepEqual(quiet.todos, []);
});

test("말풍선은 어떤 seed든 40자 안의 한 문장", () => {
  const open = [{ title: "견적 회신", priority: 1, scheduledDate:"2026-10-10" }];
  const done = [{ title: "끝난 보고서" }];
  let flavored = false;
  for (let i = 0; i < 40; i++) {
    const seed = `flair-${i}`;
    const t = localThought(morning, open, done, seed);
    assert.ok(t.bubble.length <= 40, t.bubble);
    assert.equal(sentences(t.bubble), 1, t.bubble);
    assert.deepEqual(t.todos, []);
    const raw = voice(LINES.remind, `${seed}:bubble`, { mood: "busy" });
    if (raw !== LINES.remind) {
      flavored = true;
      assert.equal(t.bubble, raw.length <= 40 ? raw : LINES.remind);
    }
  }
  assert.equal(flavored, true);
});
