import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanLink, cleanTitle, detailPatch, newTodoBody, overlayTodos, sanitizeTodoPatch, patchToday, isToday, todayPatch, localDay, dateTag } from '../src/todos.js';
import { groupTodos } from '../src/dashboard.js';

const server = [
  { id: 'a', title: 'A', source: 'mail', priority: 1 },
  { id: 'b', title: 'B', source: 'jira', priority: 2, link: 'https://b' },
];

test('repeat tooltip describes the occurrence, weekly rule and bounded or open-ended period',()=>{
 const task={scheduledDate:'2026-11-27',schedule:{mode:'repeat',days:[5],start:'2026-11-20',end:'9999-12-31'}};
 assert.equal(dateTag(task,'2026-11-26').title,'반복: 매주 금요일\n시작일 2026/11/20 (금)\n종료일 없음\n다음 예정일 2026/11/27 (금)');
 assert.match(dateTag({...task,schedule:{...task.schedule,days:[1,2,3,4,5],end:'2026-12-31'}},'2026-11-26').title,/반복: 평일\n시작일 .*\n종료일 2026\/12\/31 \(목\)/);
});

test('overdue tooltips count calendar days while date badges stay unchanged',()=>{
 const task={scheduledDate:'2026-11-25'};
 assert.equal(dateTag(task,'2026-11-26').text,'11/25');
 assert.equal(dateTag(task,'2026-11-26').title,'2026/11/25 (수)\nD+1');
 assert.equal(dateTag({...task,status:'done'},'2026-11-26').text,'11/25');
 assert.doesNotMatch(dateTag(task,'2026-11-25').title,/D\+/);
 assert.doesNotMatch(dateTag({},'2026-11-26').title,/D\+/);
 assert.match(dateTag({scheduledDate:'2026-12-31'},'2027-01-02').title,/D\+2$/);
 assert.match(dateTag({scheduledDate:'2026-03-07'},'2026-03-09').title,/D\+2$/);
 const range={schedule:{mode:'range',start:'2026-11-01',end:'2026-11-24'}};
 assert.match(dateTag(range,'2026-11-26').title,/D\+2$/);
 assert.doesNotMatch(dateTag(range,'2026-11-24').title,/D\+/);
 assert.equal(dateTag({...task,schedule:{mode:'repeat'}},'2026-11-26').repeat,true);
});

test('overlayTodos: 추가·수정·완료/삭제를 겹쳐 보고, 겹침을 빼면 원래대로', () => {
  const ops = [
    { kind: 'add', tempId: 'tmp:1', body: { title: '새 일', priority: 3 } },
    { kind: 'edit', id: 'b', patch: { priority: 1, link: null, note: '메모' } },
    { kind: 'remove', id: 'a' },
  ];
  const out = overlayTodos(server, ops);
  assert.deepEqual(out.map((t) => t.id), ['tmp:1', 'b']);
  assert.deepEqual(out[0], { id: 'tmp:1', source: 'user', priority: 3, title: '새 일', userEdited: false, pending: true });
  assert.deepEqual(out[1], { id: 'b', title: 'B', source: 'jira', priority: 1, note: '메모', userEdited: true, pending: true });
  // 롤백 = 실패한 op 를 빼고 다시 겹치기. 원본은 안 바뀐다
  assert.deepEqual(overlayTodos(server, []), server);
  assert.equal(server[1].link, 'https://b');
  // 되살리기: 같은 id 가 이미 있으면 두 번 넣지 않는다
  assert.equal(overlayTodos(server, [{ kind: 'add', tempId: 'a', body: { title: 'A' } }]).length, 2);
  assert.deepEqual(overlayTodos(null, null), []);
});

test('groupTodos: 편집용 필드(linkRaw·note·userEdited·pending)', () => {
  const g = groupTodos(overlayTodos([{ id: 'x', title: 'X', priority: 2, link: 'javascript:1', note: 'n', userEdited: true }], []));
  assert.deepEqual(g[0].items[0], { id: 'x', title: 'X', source: '', link: null, linkRaw: 'javascript:1', note: 'n', userEdited: true, pending: false, priority: 2 });
});

test('입력 검증: 제목·링크·새 할 일·상세 패치', () => {
  assert.equal(cleanTitle('  견적\n 회신 '), '견적 회신');
  assert.equal(cleanTitle('   '), null);
  assert.equal(cleanTitle('x'.repeat(5000)).length, 5000);
  assert.equal(cleanLink(''), null);
  assert.equal(cleanLink(' https://x.y/z '), 'https://x.y/z');
  assert.equal(cleanLink('slack://channel?id=1'), 'slack://channel?id=1');
  assert.equal(cleanLink('javascript:alert(1)'), undefined);
  assert.equal(cleanLink('example.com'), undefined);
  assert.deepEqual(newTodoBody(' 테스트 항목 ', '1'), { title: '테스트 항목', priority: 1 });
  assert.deepEqual(newTodoBody('x', 9), { title: 'x', priority: 4 }); // 4 = 백로그까지
  assert.equal(newTodoBody('  ', 1), null);

  const t = { linkRaw: 'https://a', note: '' };
  assert.deepEqual(detailPatch(t, { link: 'https://a', note: '' }), { patch: {} });
  assert.deepEqual(detailPatch(t, { link: '', note: ' 메모 ' }), { patch: { link: null, note: '메모' } });
  assert.match(detailPatch(t, { link: 'ftp://x', note: '' }).error, /링크/);
  assert.equal(detailPatch(t, { link: '', note: 'x'.repeat(5000) }).patch.note.length, 5000);
});

test('sanitizeTodoPatch: IPC 값은 아는 키·타입만', () => {
  assert.deepEqual(sanitizeTodoPatch({ title: 'x', priority: 1, link: null, note: 'n', status: 'done', evil: 1 }), { title: 'x', priority: 1, link: null, note: 'n', status: 'done' });
  assert.deepEqual(sanitizeTodoPatch({ title: 'x', status: 'done' }, { allowStatus: false }), { title: 'x' });
  assert.equal(sanitizeTodoPatch({ priority: '1', status: 'gone' }), null);
  assert.equal(sanitizeTodoPatch([]), null);
  assert.equal(sanitizeTodoPatch('x'), null);
});

test('mergeRecentDone: 방금 끝낸 것 먼저, 서버는 직접·자동 완료 모두(다시 켜도 남게), 중복·되돌리는 중 제외, 개수 제한', async () => {
  const { mergeRecentDone } = await import('../src/todos.js');
  const local = [{ id: 'a', title: 'A' }];
  const server = [
    { id: 'a', title: 'A', auto: true },
    { id: 'b', title: 'B', auto: true, reason: '보냈다고 함' },
    { id: 'c', title: 'C', auto: false },
    { id: 'd', title: 'D', auto: true },
  ];
  assert.deepEqual(mergeRecentDone(local, server).map((t) => t.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(mergeRecentDone(local, server, ['b']).map((t) => t.id), ['a', 'c', 'd']);
  assert.deepEqual(mergeRecentDone([], server).map((t) => t.id), ['a', 'b', 'c', 'd']); // 앱을 다시 켠 직후
  assert.deepEqual(mergeRecentDone(local, server, [], 2).map((t) => t.id), ['a', 'b']);
  assert.deepEqual(mergeRecentDone(null, undefined), []);
});

test('descriptionPatch·sanitizeTodoPatch description: 바뀐 것만, 빈 값은 지우기, 너무 길면 오류', async () => {
  const { descriptionPatch } = await import('../src/todos.js');
  assert.deepEqual(descriptionPatch('원래', ' 원래 '), { patch: null });
  assert.deepEqual(descriptionPatch('원래', '새 설명\r\n둘째 줄'), { patch: { description: '새 설명\n둘째 줄' } });
  assert.deepEqual(descriptionPatch('원래', '   '), { patch: { description: null } });
  assert.deepEqual(descriptionPatch('', ''), { patch: null });
  assert.equal(descriptionPatch('', 'x'.repeat(50000)).patch.description.length, 50000);
  assert.deepEqual(sanitizeTodoPatch({ description: null }), { description: null });
  assert.equal(sanitizeTodoPatch({ description: 'x'.repeat(50000) }).description.length, 50000);
});

test('(진행중): 사용자 토글이 먼저, 없으면 비서 진척', async () => {
  const { isDoing, sanitizeTodoPatch, overlayTodos } = await import('../src/todos.js');
  assert.equal(isDoing({}), false);
  assert.equal(isDoing({ progress: 'PR 올림' }), true);
  assert.equal(isDoing({ progress: 'PR 올림', doing: false }), false);
  assert.equal(isDoing({ doing: true }), true);
  assert.deepEqual(sanitizeTodoPatch({ doing: true }), { doing: true });
  assert.deepEqual(sanitizeTodoPatch({ doing: null }), { doing: null });
  assert.equal(sanitizeTodoPatch({ doing: 'y' }), null);
  const [t] = overlayTodos([{ id: 'a', title: 'x', userEdited: false }], [{ kind: 'edit', id: 'a', patch: { doing: true }, rule: true }]);
  assert.equal(t.doing, true);
  assert.equal(t.userEdited, false); // 토글은 '직접 수정' 표시를 달지 않는다
});

test('오늘 할 일 = 예정일: 넣기·빼기 패치, 겹쳐 보기, 응답 전 맞추기', () => {
  assert.deepEqual(sanitizeTodoPatch({ today: true }), { today: true }, '예전 today 패치도 IPC 는 통과(데몬이 P1·P2 로 바꾼다)');
  assert.deepEqual(sanitizeTodoPatch({ today: null }), { today: null });
  assert.equal(sanitizeTodoPatch({ today: 'x' }), null);
  assert.deepEqual(todayPatch(true), { scheduledDate: localDay() });
  assert.deepEqual(todayPatch(false), { scheduledDate: null }, '날짜만 해제');
  const base = [{ id: 'a', title: '가', priority: 2 }, { id: 'b', title: '나', priority: 1 }];
  const on = overlayTodos(base, [{ kind: 'edit', id: 'a', patch: todayPatch(true) }]);
  assert.equal(isToday(on[0]), true);
  const off = overlayTodos(base, [{ kind: 'edit', id: 'b', patch: todayPatch(false) }]);
  assert.equal(isToday(off[1]), false);
  assert.equal(off[1].priority, 1);
  assert.equal(isToday({ priority: 1 }, ''), false, '우선순위만으로는 오늘이 아님');
  // 대시보드 today 맞추기
  const t = { date: 'd', items: [{ id: 'b', title: '나', done: false, priority: 1 }] };
  assert.deepEqual(patchToday(t, 'b', { done: true }).items, [{ id: 'b', title: '나', done: true, priority: 1 }]);
  assert.deepEqual(patchToday(t, 'b', null).items, []);
  assert.deepEqual(patchToday(t, 'n', { title: '새' }).items.at(-1), { id: 'n', done: false, priority: 1, title: '새' });
  assert.equal(patchToday(t, 'n', { done: true }), t, '모르는 줄에 상태만 오면 그대로');
  assert.equal(patchToday(null, 'b', null), null);
});
