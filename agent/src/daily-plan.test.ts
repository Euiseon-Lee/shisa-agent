import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "./store.ts";
import { DailyPlanService, DEFAULT_TODAY_REMINDER, reminderText, todayReminderOf, validateTodayReminder } from "./daily-plan.ts";
import { Agent } from "./core.ts";
import { Bus } from "./bus.ts";
import { Reactions } from "./reactions.ts";
import { loadConfig } from "./config.ts";

const WED = () => new Date("2026-10-07T01:00:00Z"); // KST 수요일 10:00
const at = (iso: string) => () => new Date(iso);
// 끝낸 때(updated)를 가짜 시계의 그날로(끝내기는 실제 시계로 적히니까)
const doneOnWed = (store: Store, title: string) => store.db.prepare("UPDATE todos SET updated = ? WHERE title = ?").run("2026-10-07T01:30:00Z", title);

test("오늘 목록은 예정일 기준이며 중요도를 바꿔도 예정일은 유지", () => {
 const s=new Store(':memory:'); const p=new DailyPlanService(s,{now:WED});
 const old=s.addTodo({title:'기존',priority:3}); p.applyOps([{op:'add',id:old.id},{op:'add',title:'새 일'}]);
 assert.equal(s.getTodo(old.id)?.priority,3);assert.equal(s.getTodo(old.id)?.scheduledDate,'2026-10-07');
 assert.equal(p.state().items.length,2);s.editTodo(old.id,{priority:4});assert.equal(p.state().items.length,2);
 p.applyOps([{op:'remove',id:old.id}]);assert.equal(p.state().items.length,1);assert.equal(s.getTodo(old.id)?.status,'open');
 assert.match(p.applyOps([{op:'toggle',id:'missing'}]).errors[0],/못 찾았어요/);
});
test("지난 미완료와 미래 일정은 오늘로 자동 이동하지 않음", () => {
 const s=new Store(':memory:');const p=new DailyPlanService(s,{now:WED});
 for(const d of ['2026-10-06','2026-10-07','2026-10-08'])s.addTodo({title:d,priority:2,scheduledDate:d});
 assert.deepEqual(p.state().items.map(x=>x.title),['2026-10-07']);
 assert.deepEqual(p.state('2026-10-08').items.map(x=>x.title),['2026-10-08']);
 assert.equal(s.openTodos().length,3);
});
test("오늘 완료는 완료 시각 기준이며 메모 수정으로 날짜가 바뀌지 않음", () => {
 const s=new Store(':memory:');const p=new DailyPlanService(s,{now:WED});
 const a=s.addTodo({title:'완료',scheduledDate:'2026-10-07'});s.editTodo(a.id,{status:'done'});
 s.db.prepare('UPDATE todos SET done_at=? WHERE id=?').run('2026-10-07T01:30:00Z',a.id);
 s.editTodo(a.id,{note:'나중에 수정'});assert.equal(p.state().items[0].done,true);
 assert.equal(p.state('2026-10-08').items.length,0);
});
test("예전 daily_plan의 미래 날짜를 오늘로 당기지 않고 보존", () => {
 const s=new Store(':memory:');s.db.exec('CREATE TABLE daily_plan (date TEXT,id TEXT,title TEXT,done INTEGER,sort REAL,PRIMARY KEY(date,id))');
 s.db.prepare('INSERT INTO daily_plan VALUES (?,?,?,?,?)').run('2026-10-08','old','내일 회의',0,0);
 const p=new DailyPlanService(s,{now:WED});assert.equal(p.state().items.length,0);
 assert.equal(p.state('2026-10-08').items[0].title,'내일 회의');
 new DailyPlanService(s,{now:WED});assert.equal(s.openTodos().length,1);
});

test("아침 질문은 영업일 한 번", () => {
  const store = new Store(":memory:");
  const p = new DailyPlanService(store, { now: WED });
  assert.ok(p.askMorning());
  assert.equal(p.askMorning(), null, "같은 날 두 번 안 묻는다");
  const sat = new DailyPlanService(store, { now: at("2026-10-10T01:00:00Z") });
  assert.equal(sat.askMorning(), null, "주말엔 안 묻는다");
});

test("알림 설정: 기본은 업무 시작·퇴근 전, 잘못된 값 거절", () => {
  assert.deepEqual(todayReminderOf(undefined), DEFAULT_TODAY_REMINDER);
  assert.deepEqual(todayReminderOf({ mode: "off", everyHours: -1, times: ["09:30", "x", "09:30", "08:00"] }), { mode: "off", everyHours: 0, times: ["08:00", "09:30"], workStart:true,workEnd:true,midday:true });
  assert.deepEqual(validateTodayReminder({ everyHours: 2 }), { mode: "auto", everyHours: 2, times: [], workStart:true,workEnd:true,midday:true });
  assert.throws(() => validateTodayReminder({ mode: "loud" }));
  assert.throws(() => validateTodayReminder({ times: ["25:00"] }));
  assert.throws(() => validateTodayReminder({ extra: 1 }));
  assert.throws(() => validateTodayReminder([]));
});

test("알림: 아침(첫 실행·9시 지나 처음) 한 번 → N시간마다 → 지정 시각, 끄면 없음", () => {
  const store = new Store(":memory:");
  let now = new Date("2026-10-07T23:30:00Z"); // KST 목 08:30
  const p = new DailyPlanService(store, { now: () => now });
  const auto = { mode: "auto" as const, everyHours: 2, times: ["15:00"] };
  assert.equal(p.remind({ ...auto, mode: "off" }, { opened: true }), null, "끄면 안 알림");
  assert.equal(p.remind(auto), null, "9시 전, 앱을 연 게 아니면 아직");
  const first = p.remind(auto, { opened: true });
  assert.equal(first?.kind, "ask");
  assert.equal(first?.text, "오늘 할 일을 적어 주세요~ 오늘 할 일 탭에 적으면 돼요 (스이시~사)");
  assert.equal(p.remind(auto, { opened: true }), null, "아침 안내는 한 번");
  p.add("리뷰", 1);
  const longTitle = "긴 제목 ".repeat(500).trim(); // 글자 수 제한 없음(예전엔 300자 넘으면 「제목이 너무 길어요」)
  const added = p.add(longTitle);
  assert.equal(added.ok && added.item.title, longTitle);
  store.editTodo(added.ok ? added.item.id : "", { status: "done" });
  now = new Date("2026-10-08T01:00:00Z"); // 10:00, 1시간 30분 지남
  assert.equal(p.remind(auto), null);
  now = new Date("2026-10-08T01:31:00Z"); // 10:31, 2시간 지남
  const again = p.remind(auto);
  assert.equal(again?.kind, "remind");
  assert.equal(again?.text, "오늘 할 일 1개 남았어요. 하나씩 해 봐요 (스이시~사)");
  now = new Date("2026-10-08T06:00:00Z"); // 15:00 지정 시각
  assert.equal(p.remind({ ...auto, everyHours: 0 })?.kind, "remind");
  assert.equal(p.remind({ ...auto, everyHours: 0 }), null, "지정 시각은 한 번");
  // 다 끝냈으면 알리지 않는다
  assert.equal(reminderText({ date: "d", asked: true, items: [{ id: "a", title: "x", done: true, priority: 2, source: "user" }] }), null);
});

test("알림: 9시 지나 처음 확인하면(앱을 계속 켜 둔 채) 아침 안내, 주말엔 없음", () => {
  const store = new Store(":memory:");
  let now = new Date("2026-10-08T00:10:00Z"); // KST 목 09:10
  const p = new DailyPlanService(store, { now: () => now });
  assert.equal(p.remind(DEFAULT_TODAY_REMINDER)?.kind, "ask");
  now = new Date("2026-10-10T01:00:00Z"); // 토
  assert.equal(p.remind(DEFAULT_TODAY_REMINDER, { opened: true }), null);
});

test("오늘 할 일 진행률: 패널에서 끝내면(할 일 API) 절반·다 완료 말풍선이 하루 한 번씩", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cy-today-"));
  const cfg = { ...loadConfig(), repoRoots: [dir], claudeProjectsDir: join(dir, "none"), codexSessionsDir: join(dir, "none") };
  const store = new Store(":memory:");
  const bubbles: any[] = [];
  const bus = new Bus();
  const fakeBus = { bubble: (b: any) => { bubbles.push(b); return b.id; }, clear: () => {} };
  const agent = new Agent(cfg, store, bus);
  agent.setReactions(new Reactions(fakeBus, { logPath: join(dir, "r.json"), random: () => 0 }));
  const plan = agent.dailyPlan();
  plan.applyOps([{ op: "add", title: "가" }, { op: "add", title: "나" }]);
  const [a, b] = plan.state().items;
  agent.todoDone(a.id);
  assert.equal(bubbles.at(-1)?.image, "daily_half_complete");
  assert.equal(bubbles.at(-1)?.text, "벌써 절반 했어요! (1/2) 이 페이스 좋아요 💪 (기쁜 시사)");
  const n = bubbles.length;
  agent.editTodo(a.id, { status: "open" });
  agent.todoDone(a.id);
  assert.equal(bubbles.length, n, "절반은 하루 한 번(오늘 할 일이 있으면 할 일 탭 쪽 응원은 따로 안 나온다)");
  agent.todoDone(b.id);
  assert.equal(bubbles.at(-1)?.image, "daily_all_complete");
  assert.equal(bubbles.at(-1)?.text, "오늘 할 일 2개 다 끝냈어요! 최고예요 🎉 (스이시~사)");
  const m = bubbles.length;
  agent.editTodo(b.id, { status: "open" });
  agent.todoDone(b.id);
  assert.equal(bubbles.filter((x) => x.image === "daily_all_complete").length, 1, "다 완료도 하루 한 번");
  assert.ok(bubbles.length >= m);
});

test("하루 진행률은 P1(오늘 할 일) 기준: 어제 끝낸 P1 은 세지 않고, 오늘 올린 P1 은 센다", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cy-today-"));
  const cfg = { ...loadConfig(), repoRoots: [dir], claudeProjectsDir: join(dir, "none"), codexSessionsDir: join(dir, "none") };
  const store = new Store(":memory:");
  const bubbles: any[] = [];
  const bus = new Bus();
  const agent = new Agent(cfg, store, bus);
  agent.setReactions(new Reactions({ bubble: (b: any) => { bubbles.push(b); return b.id; }, clear: () => {} }, { logPath: join(dir, "r.json"), random: () => 0 }));
  const y = store.addTodo({ title: "어제 끝냄", priority: 1 });
  store.editTodo(y.id, { status: "done" });
  store.db.prepare("UPDATE todos SET done_at = ? WHERE id = ?").run(new Date(Date.now() - 2 * 864e5).toISOString(), y.id);
  const [a] = ["가", "나"].map((t) => agent.addTodo({ title: t, priority: 1 }));
  const later = agent.addTodo({ title: "이번 주였던 일", priority: 2 });
  agent.editTodo(later.id, { today: true }); // 오늘 P1 으로 올림 → 오늘 할 일 3개
  agent.todoDone(a.id);
  assert.ok(!bubbles.some((b) => b.image === "daily_half_complete"), "1/3. 어제 끝낸 걸 세면 2/4 로 절반이 된다");
  agent.todoDone(later.id);
  assert.equal(bubbles.at(-1)?.image, "daily_half_complete");
  assert.match(bubbles.at(-1)?.text, /2\/3/);
});
