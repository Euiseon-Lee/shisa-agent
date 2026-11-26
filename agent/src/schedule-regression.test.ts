import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Store} from './store.ts';
import {invitationDates} from './todo-event-date.ts';
import {parseNew} from './todos.ts';

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

const invitation={title:'서비스나우 전체 회식(12/15 18:30) 초대 응답',created:'2026-11-23T03:47:50.476Z'};
test('event date, response deadline and recommended handling date remain distinct',()=>{
 assert.deepEqual(invitationDates(invitation),{eventDate:'2026-12-15',recommendedDate:'2026-12-13',scheduledDate:'2026-12-13',dateKind:'recommended'});
 assert.deepEqual(invitationDates({...invitation,note:'응답 마감: 12/10'}),{eventDate:'2026-12-15',responseDueDate:'2026-12-10',scheduledDate:'2026-12-10',dateKind:'deadline'});
 assert.equal(invitationDates({...invitation,note:'응답 마감: 추후 안내'}).scheduledDate,undefined);
 assert.equal(invitationDates({...invitation,title:'회식(2/30) 초대 응답'}).scheduledDate,undefined);
 assert.equal(invitationDates({...invitation,scheduledDate:'2026-12-01'}).scheduledDate,undefined);
 assert.equal(invitationDates({...invitation,title:'행사(1/1) 초대 응답',created:'2026-12-20T03:00:00Z'}).recommendedDate,'2026-12-30');
});
test('derived invitation dates reach today queries without rewriting stored dates, and explicit clearing wins',()=>{
 const s=new Store(':memory:');
 try {
  const task=s.addTodo({title:invitation.title});
  assert.equal(task.dateKind,'recommended');
  assert.equal(s.todayTodos(task.scheduledDate!).some(t=>t.id===task.id),true);
  assert.equal((s.db.prepare('SELECT scheduled_date FROM todos WHERE id=?').get(task.id) as any).scheduled_date,null);
  s.editTodo(task.id,{scheduledDate:null,schedule:null});
  assert.equal(s.getTodo(task.id)?.scheduledDate,undefined);
 } finally {s.db.close();}
});
test('calendar creation accepts description and date, rejects malformed description',()=>{
 const parsed=parseNew({title:'회의',description:'일정 설명',scheduledDate:'2026-11-27',priority:2});
 assert.ok(parsed.ok);
 assert.equal(parsed.value.description,'일정 설명');
 assert.equal(parseNew({title:'회의',description:{bad:true}}).ok,false);
});
