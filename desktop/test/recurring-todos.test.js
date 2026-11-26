import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recurrenceLabel,recurrenceSummary} from '../src/recurring-todos.js';
import {groupScheduledTodos} from '../src/schedule-groups.js';
test('weekday labels and daily date suppression',()=>{
 for(const [days,label] of [[[1,2,3,4,5],'평일'],[[0,6],'주말'],[[0,1,2,3,4,5,6],'매일'],[[5],'매주 금요일'],[[5,1,3],'매주 월·수·금요일']])assert.equal(recurrenceLabel({days}),label);
 const daily={schedule:{days:[0,1,2,3,4,5,6],start:'2026-11-01'},nextDate:'2026-11-20'};
 assert.equal(recurrenceSummary(daily,'2026-11-19'),'매일');
 assert.equal(recurrenceSummary({...daily,schedule:{...daily.schedule,start:'2026-11-23'}},'2026-11-19'),'매일 · 시작 11/23');
 assert.equal(recurrenceSummary({...daily,schedule:{days:[5]}},'2026-11-19'),'매주 금요일 · 다음 11/20');
});
test('one recurring template after undated; actionable occurrences retained',()=>{
 const rows=[{id:'past',seriesId:'s',scheduledDate:'2026-11-18'},{id:'today',seriesId:'s',scheduledDate:'2026-11-19'},{id:'future',seriesId:'s',scheduledDate:'2026-11-20'},{id:'doing',seriesId:'s',scheduledDate:'2026-11-20',doing:true},{id:'stopped',seriesId:'old',scheduledDate:'2026-11-25'},{id:'none'}];
 const result=groupScheduledTodos([{items:rows}],'2026-11-19',[{id:'template',seriesId:'s'}]);
 assert.deepEqual(result.map(g=>g.bucket),['overdue','today','tomorrow','later','undated','repeat']);
 assert.deepEqual(result.flatMap(g=>g.items).map(t=>t.id),['past','today','future','doing','stopped','none','template']);
 assert.equal(groupScheduledTodos([{items:rows}],'2026-11-19').flatMap(g=>g.items).length,6);
});

test('PMS November 27 moves from tomorrow to today without duplicate occurrences',()=>{
 const item={id:'pms-27',seriesId:'pms',scheduledDate:'2026-11-27'};
 const rows=[{items:[item,item,{id:'weekly-26',scheduledDate:'2026-11-26',status:'done'}]}];
 assert.deepEqual(groupScheduledTodos(rows,'2026-11-26').map(g=>[g.bucket,g.items.length]),[['tomorrow',1]]);
 assert.deepEqual(groupScheduledTodos(rows,'2026-11-27').map(g=>[g.bucket,g.items.length]),[['today',1]]);
});
