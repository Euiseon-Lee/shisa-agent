import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Store} from './store.ts';
import {TaskReminders} from './task-reminders.ts';
import {DEFAULT_TODAY_REMINDER,todayReminderOf} from './daily-plan.ts';
import {parsePatch} from './todos.ts';
const config={workStart:'08:00',workEnd:'16:40',workDays:[1,2,3,4,5],todayReminder:DEFAULT_TODAY_REMINDER};
function setup(ctx:any) {
 ctx.mock.timers.enable({apis:['Date'],now:new Date('2026-11-26T08:00:00+09:00')});
 const store=new Store(':memory:');ctx.after(()=>store.db.close());
 return {store,clock:(s:string)=>ctx.mock.timers.setTime(new Date(s).getTime()),service:new TaskReminders(store)};
}
test('start/end use configured work hours and include only relevant open occurrences',ctx=>{
 const {store,service,clock}=setup(ctx);
 store.addTodo({title:'미완료',scheduledDate:'2026-11-25'});
 const today=store.addTodo({title:'오늘 업무',scheduledDate:'2026-11-26'});
 store.addTodo({title:'내일 업무',scheduledDate:'2026-11-27'});
 store.addTodo({title:'다음 주',scheduledDate:'2026-12-01'});
 store.addTodo({title:'일정 미정'});
 const first=service.tick(config);assert.equal(first.length,1);assert.match(first[0].text,/업무 시작 · 할 일 2개/);assert.doesNotMatch(first[0].detail,/내일 업무|다음 주|일정 미정/);
 assert.equal(new TaskReminders(store).tick(config).length,0,'restart does not replay morning');
 store.editTodo(today.id,{status:'done'});
 clock('2026-11-26T16:29:00+09:00');assert.equal(service.tick(config).length,0);
 clock('2026-11-26T16:30:00+09:00');const end=service.tick(config);assert.equal(end.length,1);assert.match(end[0].text,/퇴근 전 · 할 일 2개/);assert.doesNotMatch(end[0].detail,/오늘 업무/);
 assert.equal(service.tick(config).length,0);
});
test('outside work hours and nonworking days do not emit summaries; preview is non-consuming',ctx=>{
 const {store,service,clock}=setup(ctx);store.addTodo({title:'task',scheduledDate:'2026-11-26'});
 clock('2026-11-26T07:59:00+09:00');assert.equal(service.tick(config).length,0);
 assert.match(service.preview('start').text,/미리보기/);
 clock('2026-11-26T08:00:00+09:00');assert.equal(service.tick(config).length,1);
 clock('2026-11-26T16:40:00+09:00');assert.equal(service.tick(config).length,0);
 clock('2026-11-28T08:00:00+09:00');assert.equal(service.tick(config).length,0);
});

test('summary is one table with colored date values and no group headings',ctx=>{
 const {store,service}=setup(ctx);
 for(const [title,scheduledDate] of [['A','2026-11-25'],['B','2026-11-26'],['C','2026-11-27']])store.addTodo({title,scheduledDate});
 const notice=service.preview('end');
 assert.doesNotMatch(notice.text+notice.detail,/미완료|오늘|내일|###/);
 assert.equal(notice.detail.split('\n').filter(line=>line==='|---|---|---|').length,1);
 assert.equal(notice.detail.split('\n').length,5);
 for(const token of [':date[2026-11-25:red]',':date[2026-11-26:purple]',':date[2026-11-27:blue]'])assert.ok(notice.detail.includes(token));
});
test('midday is opt-in; duplicate interval and exact-time slots coalesce; stale times skipped',ctx=>{
 const {store,service,clock}=setup(ctx);store.addTodo({title:'task',scheduledDate:'2026-11-26'});
 service.tick(config);clock('2026-11-26T13:00:00+09:00');assert.equal(service.tick(config).length,0);
 const enabled={...config,todayReminder:{...DEFAULT_TODAY_REMINDER,midday:true,everyHours:1,times:['13:00']}};
 assert.equal(service.tick(enabled).length,1);assert.equal(service.tick(enabled).length,0);
 clock('2026-11-26T15:20:00+09:00');assert.equal(service.tick(enabled).length,0);
 assert.equal(todayReminderOf({everyHours:2,times:[]}).midday,true,'preserve existing custom alerts');
});
test('per-item alerts skip completed, trashed and excluded tasks, persist claims and label recommended dates',ctx=>{
 const {store,service,clock}=setup(ctx);
 const item=store.addTodo({title:'내일',scheduledDate:'2026-11-27',reminder:{daysBefore:1,time:'09:00'}});
 const done=store.addTodo({title:'끝남',scheduledDate:'2026-11-26',reminder:{daysBefore:0,time:'09:00'}});store.editTodo(done.id,{status:'done'});
 const trash=store.addTodo({title:'휴지통',scheduledDate:'2026-11-26',reminder:{daysBefore:0,time:'09:00'}});store.trashTodo(trash.id);
 const excluded=store.addTodo({title:'제외',scheduledDate:'2026-11-26',reminder:{daysBefore:0,time:'09:00'}});store.setIrrelevant(excluded.id,true);
 const onlyItems={...config,todayReminder:{...DEFAULT_TODAY_REMINDER,workStart:false,workEnd:false}};
 clock('2026-11-26T09:00:00+09:00');const notices=service.tick(onlyItems);assert.equal(notices.length,1);assert.equal(notices[0].open.id,item.id);
 assert.equal(new TaskReminders(store).tick(onlyItems).length,0);
 const invite=store.addTodo({title:'회식(11/28 18:00) 초대 응답'});store.editTodo(invite.id,{reminder:{daysBefore:0,time:'09:01'}});
 clock('2026-11-26T09:01:00+09:00');assert.match(service.tick(onlyItems)[0].text,/권장 처리일/);
 assert.equal(service.tick({...config,todayReminder:{...DEFAULT_TODAY_REMINDER,mode:'off'}}).length,0);
});
test('recurrence reminder updates future open occurrences and template but keeps completion history',ctx=>{
 const {store}=setup(ctx);
 const series=store.addTodo({title:'PMS',schedule:{mode:'repeat',start:'2026-11-19',end:'2027-01-31',days:[4]}});
 store.editTodo(series.id,{status:'done'});const before=store.getTodo(series.id);
 const next=store.openTodos().find(t=>t.seriesId===series.seriesId)!;
 store.editTodo(next.id,{reminder:{daysBefore:1,time:'10:00'}});
 store.materializeRepeats('2026-12-20');
 assert.ok(store.openTodos().filter(t=>t.seriesId===series.seriesId).every(t=>t.reminder?.time==='10:00'));
 assert.deepEqual(store.getTodo(series.id),before);
 store.editTodo(next.id,{reminder:null});assert.ok(store.openTodos().every(t=>!t.reminder));
 assert.equal(parsePatch({reminder:{daysBefore:2,time:'25:00'}}).ok,false);
 assert.equal(parsePatch({reminder:{daysBefore:1,time:'10:00'}}).ok,true);
});
test('late startup in leave window produces only end summary and no old per-item alerts',ctx=>{
 const {store,service,clock}=setup(ctx);store.addTodo({title:'task',scheduledDate:'2026-11-26',reminder:{daysBefore:0,time:'09:00'}});
 clock('2026-11-26T16:35:00+09:00');const out=service.tick(config);assert.equal(out.length,1);assert.match(out[0].text,/퇴근 전/);
});

test('changing an item reminder time creates a distinct notification after acknowledgement',ctx=>{
 const {store,service,clock}=setup(ctx);
 const task=store.addTodo({title:'task',scheduledDate:'2026-11-26',reminder:{daysBefore:0,time:'09:00'}});
 const onlyItems={...config,todayReminder:{...DEFAULT_TODAY_REMINDER,workStart:false,workEnd:false}};
 clock('2026-11-26T09:00:00+09:00');const first=service.tick(onlyItems)[0];assert.ok(first);
 store.editTodo(task.id,{reminder:{daysBefore:0,time:'10:00'}});
 clock('2026-11-26T10:00:00+09:00');const second=service.tick(onlyItems)[0];assert.ok(second);
 assert.notEqual(first.id,second.id);
 assert.equal(service.tick(onlyItems).length,0);
});

test('summaries preserve holiday exclusion while explicit item alarms and configured weekends work',ctx=>{
 const {store,service,clock}=setup(ctx);
 clock('2026-12-25T08:00:00+09:00');
 const task=store.addTodo({title:'holiday task',scheduledDate:'2026-12-25',reminder:{daysBefore:0,time:'08:00'}});
 const notices=service.tick(config);
 assert.equal(notices.length,1);assert.equal(notices[0].open.id,task.id);
 clock('2026-12-26T08:00:00+09:00');
 assert.equal(service.tick({...config,workDays:[6]}).length,1);
});
