import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scheduleGroup,dateDistance,groupScheduledTodos} from '../src/schedule-groups.js';
import {normalizeSection,SECTIONS} from '../src/dashboard.js';
test('Monday-to-Sunday boundary and overdue/undated groups',()=>{
 assert.equal(scheduleGroup('2026-11-17','2026-11-18'),'overdue');
 assert.equal(scheduleGroup('2026-11-18','2026-11-18'),'today');
 assert.equal(scheduleGroup('2026-11-22','2026-11-18'),'week');
 assert.equal(scheduleGroup('2026-11-23','2026-11-18'),'later');
 assert.equal(scheduleGroup(null,'2026-11-18'),'undated');
 assert.equal(scheduleGroup('invalid','2026-11-18'),'undated');
 assert.equal(scheduleGroup('2027-01-03','2026-12-31'),'week');
 assert.equal(scheduleGroup('2027-01-04','2026-12-31'),'later');
 assert.equal(scheduleGroup('2026-11-23','2026-11-22'),'later');
});
test('priority does not split undated or overdue items; dates remain on each item',()=>{
 const groups=[{priority:1,items:[{id:'a'},{id:'b',scheduledDate:'2026-11-17'}]},
 {priority:4,items:[{id:'c'},{id:'d',scheduledDate:'2026-11-01'},{id:'e',scheduledDate:'2026-11-20'},{id:'f',scheduledDate:'2026-12-01'}]}];
 const out=groupScheduledTodos(groups,'2026-11-18');
 assert.deepEqual(out.map(g=>[g.label,g.items.map(t=>t.id)]),[['미완료',['d','b']],['이번주',['e']],['나중에',['f']],['날짜 없음',['a','c']]]);
 assert.equal(out[1].items[0].scheduledDate,'2026-11-20');
});
test('six date distances are stable across month boundaries',()=>{
 assert.deepEqual(['2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03'].map(d=>dateDistance(d,'2026-12-28')),[1,2,3,4,5,6]);
 assert.equal(dateDistance('2027-02-01','2026-12-28'),6);
});
test('statistics is a distinct navigable tab',()=>{assert.ok(SECTIONS.includes('statistics'));assert.equal(normalizeSection('statistics'),'statistics');});
