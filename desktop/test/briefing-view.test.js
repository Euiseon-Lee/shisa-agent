import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatBriefing} from '../src/briefing-view.js';
test('legacy briefing uses actual dates, states and date ordering, removing separate undated footer',()=>{
 const text='**오늘 반드시**\n- [회의](#today)\n\n**이번 주**\n\n| 할 일 | 시점 |\n| --- | --- |\n| [늦은 일](#past) | 기한 지남 |\n| [공부](#range) | 진행 중 |\n\n참고 · 다음 주 준비\n\n백로그 · [날짜 미정 항목](#undated)';
 const tasks=[{id:'today',title:'회의',priority:4,scheduledDate:'2026-11-18'},{id:'past',title:'늦은 일',scheduledDate:'2026-11-16'},{id:'range',title:'공부',doing:true,schedule:{mode:'range',start:'2026-11-18',end:'2026-12-02'}},{id:'undated',title:'기타'}];
 const out=formatBriefing(text,tasks,'2026-11-18');
 assert.ok(out.includes('| 예정일 | 상태 | 할 일 |'));
 assert.ok(out.includes('| 11/16 | 미완료 |'));assert.ok(out.includes('| 11/18 | 대기 |'));
 assert.ok(out.includes('| 11/18 ~ 12/02 | 진행 중 |'));
 assert.ok(out.indexOf('늦은 일')<out.indexOf('회의'));assert.ok(out.includes('참고: 다음 주 준비'));
 assert.ok(!out.includes('백로그'));assert.ok(!out.includes('날짜 미정'));assert.ok(!out.includes('#undated'));assert.ok(!out.includes('**이번 주**'));
});
test('undated rows stay undated and missing links do not invent dates or remain clickable',()=>{
 const src='| 예정일 | 상태 | 할 일 |\n|---|---|---|\n| 날짜 미정 | 대기 | [날짜 없는 일](#u) |\n| 진행 중 | 진행 중 | [사라진 일](#missing) |';
 const out=formatBriefing(src,[{id:'u',title:'날짜 없는 일',priority:1}],'2026-11-18');
 assert.ok(out.includes('| 날짜 없음 | 대기 |'));assert.ok(out.includes('| 확인 필요 | 진행 중 | 사라진 일 |'));assert.ok(!out.includes('#missing'));
});
test('unrelated tables retain their original columns and content',()=>{
 const src='| 프로젝트 | 변경 |\n|---|---|\n| A | 3개 |';assert.equal(formatBriefing(src,[],'2026-11-18'),src);
});

test('prose after a task link still renders a table and preserves surrounding explanation',()=>{
 const src='**오늘 반드시**\n\n- [회의 자료 준비 (예시)](#demo)가 남아 있어요.\n\n캘린더가 연결되어 있지 않아요.';
 const out=formatBriefing(src,[{id:'demo',title:'회의 자료 준비',scheduledDate:'2026-11-18'}],'2026-11-18');
 assert.ok(out.includes('| 11/18 | 대기 | [회의 자료 준비](#demo) |'));
 assert.ok(out.includes('캘린더가 연결되어 있지 않아요.'));
 assert.ok(!out.includes('가 남아 있어요.'));
});
test('numbered task lists retain extra information after the task',()=>{
 const out=formatBriefing('준비해요.\n1. [자료](#a) — 회의 전에 검토해 주세요.',[{id:'a',title:'자료'}],'2026-11-18');
 assert.ok(out.includes('회의 전에 검토해 주세요.'));
 assert.ok(out.includes('준비해요.\n\n| 예정일'));
});

test('briefing wording names connected mail services and uses requested empty-state copy',()=>{
 const source='오늘·내일 잡힌 일정 없음\n최근 24시간 동안 받은 메일 없음 (두 계정 모두)\n열린 할 일 없음\n참고: 오늘 안에 꼭 해야 할 일은 없어서 오늘 할 일은 비워 뒀어요.\n오늘 예정된 할 일이 없습니다.\n오늘 반드시 처리할 일 0건';
 const out=formatBriefing(source,[],'2026-11-18',[{preset:'gmail'},{preset:'naver'}]);
 assert.equal(out,'오늘/내일 잡힌 일정 없음\n최근 24시간 동안 받은 메일 없음 (지메일, 네이버)\n예정된 할 일 없음\n참고: 오늘 안에 꼭 해야 할 일은 없어서 오늘 할 일은 비워져 있어요.\n오늘 예정된 할 일이 없어요.\n오늘 할 일 0건');
 assert.ok(formatBriefing(source,[],'2026-11-18',[{preset:'daum'}]).includes('메일 없음 (다음)'));
 assert.ok(!formatBriefing(source,[],'2026-11-18').includes('지메일'));
});
