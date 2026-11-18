import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Store,kstDay} from './store.ts';
import {addScheduleDays,parseSchedule,type TodoSchedule} from './todo-schedule.ts';
import {parseNew,parsePatch} from './todos.ts';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const today=kstDay(new Date().toISOString());
const repeat=(end=addScheduleDays(today,14)):TodoSchedule=>({mode:'repeat',start:today,end,days:[0,1,2,3,4,5,6]});
test('API validates schedule dates, weekdays and accepts unbounded repeat sentinel',()=>{
 assert.ok(parseNew({title:'study',schedule:repeat()}).ok);
 assert.ok(parseNew({title:'study',schedule:repeat('9999-12-31')}).ok);
 for(const schedule of [{...repeat(),end:today},{...repeat(),days:[]},{...repeat(),days:[7]},{...repeat(),start:'2026-02-30'}])assert.equal(parsePatch({schedule}).ok,false);
 assert.equal(parseSchedule(null),null);
});
test('range is one task on every included date, completes once, reopens with schedule intact',()=>{
 const s=new Store(':memory:');
 const task=s.addTodo({title:'CAD',schedule:{mode:'range',start:today,end:addScheduleDays(today,14)}});
 assert.equal(s.openTodos().length,1);
 for(let i=0;i<=14;i++)assert.equal(s.todayTodos(addScheduleDays(today,i)).filter(t=>t.status==='open')[0]?.id,task.id);
 s.editTodo(task.id,{status:'done'});
 assert.equal(s.openTodos().length,0);
 assert.equal(s.todayTodos(addScheduleDays(today,1)).length,0);
 assert.equal(s.recentlyDone('2000-01-01').length,1);
 s.editTodo(task.id,{status:'open'});assert.equal(s.openTodos()[0].schedule?.mode,'range');
 s.editTodo(task.id,{schedule:null,scheduledDate:null});assert.equal(s.getTodo(task.id)?.schedule,undefined);assert.equal(s.getTodo(task.id)?.scheduledDate,undefined);s.db.close();
});
test('repeat instances complete, reopen, trash and purge independently without regeneration',()=>{
 const s=new Store(':memory:');const first=s.addTodo({title:'practice',schedule:repeat()});
 const tasks=s.openTodos();assert.equal(tasks.length,15);assert.equal(new Set(tasks.map(t=>t.id)).size,15);
 s.editTodo(first.id,{status:'done'});assert.equal(s.openTodos().length,14);
 s.editTodo(first.id,{status:'open'});assert.equal(s.openTodos().length,15);
 s.trashTodo(first.id);s.deleteTodo(first.id);s.materializeRepeats();assert.equal(s.openTodos().length,14);
 s.editTodo(tasks[1].id,{doing:true});assert.equal(s.getTodo(tasks[2].id)?.doing,undefined);s.db.close();
});
test('weekday selection, rolling generation, restart and stopping preserve history',()=>{
 const p=join(mkdtempSync(join(tmpdir(),'shisa-repeat-')),'test.db');
 let s=new Store(p);const task=s.addTodo({title:'work',schedule:{...repeat('9999-12-31'),days:[1,2,3,4,5]}});
 assert.ok(s.openTodos().length<=11);assert.ok(s.openTodos().every(t=>[1,2,3,4,5].includes(new Date(t.scheduledDate!+'T12:00:00Z').getUTCDay())));
 const ids=s.openTodos().map(t=>t.id);s.db.close();s=new Store(p);assert.deepEqual(s.openTodos().map(t=>t.id),ids);
 s.materializeRepeats(addScheduleDays(today,30));const count=s.openTodos().length;assert.ok(count>ids.length);
 s.editTodo(task.id,{stopRepeat:true});s.materializeRepeats(addScheduleDays(today,60));assert.equal(s.openTodos().length,count);s.db.close();
});
test('editing a repeated schedule preserves completed and in-progress occurrences without duplicates',()=>{
 const s=new Store(':memory:');const first=s.addTodo({title:'repeat',schedule:repeat()});const tasks=s.openTodos();
 s.editTodo(first.id,{status:'done'});s.editTodo(tasks[3].id,{doing:true});
 const current=tasks[1];s.editTodo(current.id,{schedule:repeat(addScheduleDays(today,20))});
 assert.equal(s.getTodo(first.id)?.status,'done');assert.equal(s.getTodo(tasks[3].id)?.doing,true);
 const all=[...s.openTodos(),...s.doneTodos(100)];
 assert.equal(all.filter(t=>t.scheduledDate===today).length,1);
 assert.equal(all.filter(t=>t.scheduledDate===tasks[3].scheduledDate).length,1);
 assert.equal(s.getTodo(current.id)?.scheduledDate,current.scheduledDate);s.db.close();
});
test('invalid recurrence edit rolls back existing series and occurrences',()=>{
 const s=new Store(':memory:');const t=s.addTodo({title:'repeat',schedule:repeat()});const ids=s.openTodos().map(x=>x.id);
 const weekday=new Date(today+'T12:00:00Z').getUTCDay();
 assert.throws(()=>s.editTodo(t.id,{schedule:{mode:'repeat',start:today,end:addScheduleDays(today,1),days:[(weekday+3)%7]}}));
 assert.deepEqual(s.openTodos().map(x=>x.id),ids);s.db.close();
});
