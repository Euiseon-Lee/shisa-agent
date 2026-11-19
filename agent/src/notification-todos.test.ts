import {test} from 'node:test';
import assert from 'node:assert/strict';
import {notificationTodos,Reactions,type TodoLike} from './reactions.ts';
import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
test('alerts include overdue, today and Sunday, excluding next week, undated and finished work',()=>{
 const dates=['2026-11-18','2026-11-19','2026-11-22','2026-11-23','2026-11-26',undefined];
 const items:TodoLike[]=dates.map((scheduledDate,i)=>({id:String(i),title:String(i),scheduledDate,priority:4}));
 items.push({...items[0],id:'done',status:'done'});
 assert.deepEqual(notificationTodos(items,new Date('2026-11-19T02:00:00Z')).map(t=>t.id),['0','1','2']);
 assert.deepEqual(notificationTodos(items,new Date('2026-11-22T02:00:00Z')).map(t=>t.id),['0','1','2']);
 assert.equal(notificationTodos(items,new Date('2026-11-23T02:00:00Z')).some(t=>t.id==='4'),true);
});
test('range dates and year boundary use current local calendar week',()=>{
 const items=[{id:'active',title:'active',schedule:{mode:'range',start:'2026-12-20',end:'2027-01-10'}},{id:'future',title:'future',schedule:{mode:'range',start:'2027-01-04',end:'2027-01-10'}},{id:'sunday',title:'sunday',scheduledDate:'2027-01-03'}];
 assert.deepEqual(notificationTodos(items,new Date('2026-12-31T02:00:00Z')).map(t=>t.id),['active','sunday']);
});
test('future-only lists emit no new-task or lots alert; counts exclude future occurrences',()=>{
 const bubbles:any[]=[];const r=new Reactions({bubble:b=>{bubbles.push(b);return 'b'},clear:()=>{}},{logPath:join(mkdtempSync(join(tmpdir(),'notify-scope-')),'log.json'),now:()=>new Date('2026-11-19T02:00:00Z'),lotsThreshold:1});
 const future={id:'future',title:'future',scheduledDate:'2026-11-26'};
 assert.equal(r.newTodos([future],'user'),undefined);assert.equal(r.lots([future]),false);assert.equal(bubbles.length,0);
 r.lots([future,{id:'today',title:'eligible',scheduledDate:'2026-11-19',priority:4}]);
 assert.ok(bubbles[0].detail.includes('eligible'));assert.ok(!bubbles[0].detail.includes('future'));
});
