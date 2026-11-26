import { t as pt } from './i18n.js';
// Local calendar dates; weeks run Monday through Sunday.
import { parseDay, addDays, weekRange } from './focus.js';
export function scheduleGroup(date, today) {
 if (!parseDay(date)) return 'undated';
 if (date < today) return 'overdue';
 if (date === today) return 'today';
 if (date === addDays(today,1)) return 'tomorrow';
 return date <= weekRange(today).to ? 'week' : 'later';
}
export function dateDistance(date, today) {
 if (!parseDay(date) || !parseDay(today)) return 6;
 for (let i=1;i<=6;i++) if (date <= addDays(today,i)) return i;
 return 6;
}
export function effectiveDate(t,today) { return t.schedule?.mode==='range' ? today<t.schedule.start?t.schedule.start:today>t.schedule.end?t.schedule.end:today : t.scheduledDate || null; }
export const scheduleOrder = (a,b) => (a.scheduleSort ?? Number.MAX_SAFE_INTEGER) - (b.scheduleSort ?? Number.MAX_SAFE_INTEGER);
export function reorderScheduleLocal(todos,id,beforeId,today) {
 const current=todos.find(t=>t.id===id); if(!current)return todos;
 const group=todos.filter(t=>effectiveDate(t,today)===effectiveDate(current,today)).sort(scheduleOrder);
 const rest=group.filter(t=>t.id!==id),at=beforeId==null?rest.length:rest.findIndex(t=>t.id===beforeId);
 if(at<0)return todos;
 const ranks=new Map([...rest.slice(0,at),current,...rest.slice(at)].map((t,i)=>[t.id,i]));
 return todos.map(t=>ranks.has(t.id)?{...t,scheduleSort:ranks.get(t.id)}:t);
}
export function scheduleKeyMove(todos,id,key,today) {
 if(!['ArrowUp','ArrowDown'].includes(key))return null;
 const cur=todos.find(t=>t.id===id); if(!cur)return null;
 const group=todos.filter(t=>effectiveDate(t,today)===effectiveDate(cur,today)).sort(scheduleOrder),i=group.findIndex(t=>t.id===id);
 if(key==='ArrowUp')return i>0?{beforeId:group[i-1].id}:null;
 return i<group.length-1?{beforeId:group[i+2]?.id??null}:null;
}
export function groupScheduledTodos(groups,today,recurring=[]) {
 const seen=new Set();
 const labels={overdue:pt("personal.미완료"),today:pt("personal.오늘"),tomorrow:pt('date.tomorrow'),week:pt("personal.이번주"),later:pt("personal.다음 주부터"),undated:pt("personal.일정 미정"),repeat:pt("personal.반복")};
 const buckets=Object.fromEntries(Object.keys(labels).map(k=>[k,[]]));
 for (const group of groups || []) for (const item of group.items || []) {
   if(item.status==='done' || item.done || seen.has(item.id))continue;
   seen.add(item.id);
   const date=effectiveDate(item,today);
   buckets[scheduleGroup(date,today)].push({...item,scheduledDate:date});
 }
 buckets.repeat=recurring;
 return Object.entries(labels).filter(([k])=>buckets[k].length).map(([bucket,label])=>({bucket,label,
   items:buckets[bucket].sort((a,b)=>(a.scheduledDate||'').localeCompare(b.scheduledDate||'') || scheduleOrder(a,b))}));
}
