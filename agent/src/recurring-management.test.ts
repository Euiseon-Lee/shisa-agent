import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Store,kstDay} from './store.ts';
import {addScheduleDays} from './todo-schedule.ts';
test('series survives today completion, exclusions and deleted occurrences; stop and expiry hide it',()=>{
 const s=new Store(':memory:');const today=kstDay(new Date().toISOString());
 const first=s.addTodo({title:'Routine',schedule:{mode:'repeat',start:today,end:addScheduleDays(today,30),days:[0,1,2,3,4,5,6]}});
 assert.equal(s.recurringTodos(today).length,1);
 s.editTodo(first.id,{status:'done'});
 let template=s.recurringTodos(today)[0];assert.equal(template.title,'Routine');assert.notEqual(template.id,first.id);assert.equal(template.canEdit,true);
 for(const t of s.openTodos())s.editTodo(t.id,{status:'done'});
 template=s.recurringTodos(today)[0];assert.ok(template);assert.equal(template.canEdit,false);assert.equal(template.canStop,true);
 assert.equal(s.recurringTodos(addScheduleDays(today,31)).length,0);
 s.stopRepeating(template.id);assert.equal(s.recurringTodos(today).length,0);assert.ok(s.doneTodos(100).length>0);s.db.close();
});
test('far future series remains visible without depending on today tasks',()=>{
 const s=new Store(':memory:');const today=kstDay(new Date().toISOString()),start=addScheduleDays(today,40);
 s.addTodo({title:'Future',schedule:{mode:'repeat',start,end:addScheduleDays(start,10),days:[0,1,2,3,4,5,6]}});
 assert.equal(s.recurringTodos(today)[0].nextDate,start);s.db.close();
});
