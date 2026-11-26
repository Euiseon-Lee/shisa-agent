import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Store} from './store.ts';

test('November 26 completion survives generation; next date is an actionable occurrence, not cursor', ctx=>{
 ctx.mock.timers.enable({apis:['Date'],now:new Date('2026-11-26T03:00:00Z')});
 const s=new Store(':memory:');
 try {
  const weekly=s.addTodo({title:'주간보고',schedule:{mode:'repeat',start:'2026-11-19',end:'9999-12-31',days:[4]}});
  const completed=s.openTodos().find(t=>t.seriesId===weekly.seriesId&&t.scheduledDate==='2026-11-26')!;
  s.editTodo(completed.id,{status:'done'});
  const before=s.getTodo(completed.id);
  const pms=s.addTodo({title:'PMS 타임카드',schedule:{mode:'repeat',start:'2026-11-27',end:'9999-12-31',days:[5]}});
  s.materializeRepeats('2026-11-26');s.materializeRepeats('2026-11-27');
  assert.deepEqual(s.getTodo(completed.id),before);
  assert.equal(s.todayTodos('2026-11-26').find(t=>t.id===completed.id)?.status,'done');
  assert.equal(s.todayTodos('2026-11-26').some(t=>t.id===pms.id),false);
  assert.equal(s.todayTodos('2026-11-27').filter(t=>t.id===pms.id).length,1);
  assert.equal(s.recurringTodos('2026-11-27').find(t=>t.seriesId===pms.seriesId)?.nextDate,'2026-11-27');
  s.editTodo(pms.id,{status:'done'});
  assert.equal(s.recurringTodos('2026-11-27').find(t=>t.seriesId===pms.seriesId)?.nextDate,'2026-12-04');
  assert.equal(s.openTodos().some(t=>t.id===completed.id),false);
 } finally {s.db.close();}
});
