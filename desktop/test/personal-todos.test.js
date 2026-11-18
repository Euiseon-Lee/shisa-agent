import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dateTag, isToday, mergeRecentDone, sanitizeTodoPatch} from '../src/todos.js';
import {shapeDashboard} from '../src/dashboard.js';
test('date tags and today list use dates instead of priorities',()=>{
 assert.equal(dateTag({scheduledDate:'2026-11-17'},'2026-11-18').tone,'overdue');
 assert.equal(dateTag({scheduledDate:'2026-11-20'},'2026-11-18').text,'11/20');
 assert.equal(dateTag({scheduledDate:'2026-11-20'},'2026-11-18').tone,'future');
 assert.equal(dateTag({scheduledDate:'2026-11-18'},'2026-11-18').text,'오늘');
 assert.equal(isToday({priority:1,scheduledDate:'2026-11-20'},'2026-11-18'),false);
 const vm=shapeDashboard({today:{date:'2026-11-18',items:[]},todos:[{id:'a',title:'today',priority:3,scheduledDate:'2026-11-18'},{id:'b',title:'future',priority:1,scheduledDate:'2026-11-20'}]});
 assert.deepEqual(vm.todayGroups.flatMap(g=>g.items.map(t=>t.id)),['a']);
 assert.deepEqual(sanitizeTodoPatch({irrelevant:true}),{irrelevant:true});
});
test('recent completion merge filters seven days and sorts by completion timestamp',()=>{
 const now=Date.parse('2026-11-18T12:00:00Z');const row=(id,days)=>({id,doneAt:new Date(now-days*864e5).toISOString()});
 assert.deepEqual(mergeRecentDone([row('old',8),row('six',6)],[row('one',1),row('six',6)],[],100,now).map(t=>t.id),['one','six']);
});
