import type {Store,Todo} from './store.ts';
import {todayReminderOf, type TodayReminder} from './daily-plan.ts';
import {workHoursOf,minutesOf,LEAVE_BEFORE_MIN} from './work-hours.ts';
import {localDate,KR_HOLIDAYS} from './calendar.ts';
import {addScheduleDays,scheduledViewDate} from './todo-schedule.ts';
import {todoListMd, type TodoLike, type TodoDateTone} from './reactions.ts';
import {language} from './lang.ts';
import {randomUUID} from 'node:crypto';

export type TaskReminderKind='start'|'end'|'midday';
type ReminderConfig={todayReminder?:TodayReminder;workStart?:string;workEnd?:string;workDays?:number[]};
export type TaskNotice={id:string;text:string;detail:string;kind:'todo';ttlMs:number;open:{section:'todos';id?:string}};

// Claims live in the same database as occurrences. Restarting or reconnecting the
// overlay cannot replay an already delivered slot. Preview never claims a slot.
export class TaskReminders {
 private store:Store;
 private now:()=>Date;
 constructor(store:Store,now:()=>Date=()=>new Date()) {
  this.store=store;this.now=now;
  store.db.exec('CREATE TABLE IF NOT EXISTS task_reminder_claims (key TEXT PRIMARY KEY, day TEXT NOT NULL)');
 }
 private claim(key:string,day:string) {
  return this.store.db.prepare('INSERT OR IGNORE INTO task_reminder_claims(key,day) VALUES (?,?)').run(key,day).changes>0;
 }
 private tasks(day:string):Todo[] {
  return this.store.openTodos().filter(t=>!!t.scheduledDate).map(t=>({...t,scheduledDate:scheduledViewDate(t.schedule,t.scheduledDate,day)}))
   .sort((a,b)=>a.scheduledDate!.localeCompare(b.scheduledDate!));
 }
 preview(kind:TaskReminderKind):TaskNotice {
  const notice=this.summary(kind,localDate(this.now()),this.tasks(localDate(this.now())),true)!;
  return {...notice,id:notice.id+':'+randomUUID()};
 }
 private summary(kind:TaskReminderKind,day:string,tasks:Todo[],preview=false):TaskNotice|null {
  const ja=language()==='ja';
  const labels=ja?{start:'業務開始',end:'退勤前',midday:'業務中'}:{start:'업무 시작',end:'퇴근 전',midday:'업무 중간'};
  const tomorrow=addScheduleDays(day,1);
  const items=tasks.filter(t=>t.scheduledDate! <= (kind==='end'?tomorrow:day));
  const count=items.length;
  if(!count&&!preview)return null;
  return {id:`task-summary:${kind}:${day}${preview?':preview':''}`,kind:'todo',ttlMs:60e3,open:{section:'todos'},
   text:(preview?(ja?'[プレビュー] ':'[미리보기] '):'')+labels[kind]+' · '+(count?(ja?`タスク ${count}件`:`할 일 ${count}개`):(ja?'予定はありません。':'예정된 할 일이 없어요.')),
   detail:this.details(items,t=>t.scheduledDate!<day?'red':t.scheduledDate===day?'purple':'blue') || (ja?'予定のあるタスクを表示します。':'예정일이 있는 할 일을 표시합니다.')};
 }
 private details(tasks:Todo[],tone?:TodoDateTone | ((item:TodoLike)=>TodoDateTone)) {
  return todoListMd(tasks.map(t=>({...t,title:(t.dateKind==='recommended'?(language()==='ja'?'[推奨対応日] ':'[권장 처리일] '):'')+t.title})),'user',tasks.length,true,tone);
 }
 tick(config:ReminderConfig):TaskNotice[] {
  const cfg=todayReminderOf(config.todayReminder);
  if(cfg.mode==='off')return [];
  const now=this.now(),day=localDate(now),minute=now.getHours()*60+now.getMinutes();
  const wh=workHoursOf(config as Record<string,unknown>),start=minutesOf(wh.workStart),end=minutesOf(wh.workEnd);
  const tasks=this.tasks(day),out:TaskNotice[]=[];
  const fire=(kind:TaskReminderKind,key:string)=>{
   if(this.claim(`${day}:${key}`,day)) {const notice=this.summary(kind,day,tasks);if(notice)out.push(notice);}
  };
  if(wh.workDays.includes(now.getDay()) && !(day in KR_HOLIDAYS) && minute>=start && minute<end) {
   const leaving=minute>=Math.max(start,end-LEAVE_BEFORE_MIN);
   if(leaving && cfg.workEnd) fire('end','end');
   else if(!leaving && cfg.workStart) fire('start','start');
   if(cfg.midday && !leaving) {
    const slots=cfg.times.filter(time=>{const at=minutesOf(time);return at>=start && at<end-LEAVE_BEFORE_MIN && minute>=at && minute-at<5;});
    const interval=cfg.everyHours*60;
    if(interval>0 && minute>=start+interval) {
     const slot=Math.floor((minute-start)/interval),at=start+slot*interval;
     if(minute-at<5)slots.push(`every:${slot}`);
    }
    // A start summary already covers these tasks at the same tick.
    let claimed=false;
    for(const slot of slots) claimed=this.claim(`${day}:midday:${slot}`,day)||claimed;
    if(claimed&&!out.length) {const notice=this.summary('midday',day,tasks);if(notice)out.push({...notice,id:notice.id+':'+slots.join(',')});}
   }
  }
  for(const t of tasks) {
   if(!t.reminder)continue;
   const base=t.schedule?.mode==='range'?t.schedule.start:t.scheduledDate!;
   if(addScheduleDays(base,-t.reminder.daysBefore)!==day)continue;
   const at=minutesOf(t.reminder.time);
   if(minute<at || minute-at>=5)continue;
   if(!this.claim(`item:${t.id}:${base}:${t.reminder.daysBefore}:${t.reminder.time}`,day))continue;
   const ja=language()==='ja';
   out.push({id:`task-item:${t.id}:${base}:${t.reminder.daysBefore}:${t.reminder.time}`,kind:'todo',ttlMs:60e3,open:{section:'todos',id:t.id},
    text:(t.dateKind==='recommended'?(ja?'推奨対応日':'권장 처리일'):(t.reminder.daysBefore?(ja?'明日の予定':'내일 예정'):(ja?'今日の予定':'오늘 예정')))+' · '+t.title,detail:this.details([t])});
  }
  this.store.db.prepare('DELETE FROM task_reminder_claims WHERE day < ?').run(addScheduleDays(day,-90));
  return out;
 }
}
