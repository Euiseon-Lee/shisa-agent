import test from 'node:test';
import assert from 'node:assert/strict';
import { BubbleQueue, normalizeBubble, keepClasses } from '../src/bubbles.js';
import { NotificationStore } from '../src/notification-store.js';
import { notificationDate } from '../src/notification-date.js';
import { Marked } from '../renderer/vendor/marked.js';
import { createMarkdown } from '../src/markdown.js';
const memory = () => { const m=new Map(); return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}; };
const bubble = (id, extra={}) => normalizeBubble({id,text:id,kind:'info',...extra});
test('unread notifications and selected page survive application restart',()=>{
 const storage=memory(), a=new NotificationStore(storage), q=new BubbleQueue({paged:true});
 q.add(bubble('a'));q.add(bubble('b',{detail:'long content'}));q.move(1);a.save(q);
 const restarted=new BubbleQueue({paged:true});new NotificationStore(storage).restore(restarted);
 assert.deepEqual(restarted.items.map(b=>b.id),['a','b']);
 assert.equal(restarted.visible()[0].detail,'long content');
});
test('acknowledged messages stay deleted after restart and replay, but new content is delivered',()=>{
 const storage=memory(), a=new NotificationStore(storage), q=new BubbleQueue({paged:true});
 const b=bubble('a');q.add(b);q.add(bubble('b'));
 a.acknowledge(b);q.remove('a');a.save(q);
 const next=new NotificationStore(storage), restored=new BubbleQueue({paged:true});next.restore(restored);
 assert.deepEqual(restored.items.map(b=>b.id),['b']);
 assert.equal(next.accepts(b),false);
 assert.equal(next.accepts(bubble('a',{text:'new result'})),true);
});
test('restored action status is preserved but in-flight locks are cleared',()=>{
 const storage=memory(), a=new NotificationStore(storage), q=new BubbleQueue({paged:true});
 q.add(bubble('request',{kind:'proposal',actions:'action',actionId:'a'}));q.update('request',{pending:true});
 q.add(bubble('result',{kind:'proposal',actions:'action',actionId:'b'}));q.update('result',{decided:true,note:'resolved'});
 a.save(q); const next=new BubbleQueue({paged:true});new NotificationStore(storage).restore(next);
 assert.equal(next.items[0].pending,false);assert.equal(next.items[0].actionId,'a');
 assert.equal(next.items[1].decided,true);assert.equal(next.items[1].note,'resolved');
});
test('storage failure is reported instead of claiming notifications were saved',()=>{
 const a=new NotificationStore({setItem(){throw Error('full');}});
 assert.equal(a.save(new BubbleQueue({paged:true})),false);assert.equal(a.error,true);
});
test('single dates show today or weekdays, with year and day boundaries respected',()=>{
 const now=new Date(2026,10,18,12);
 assert.deepEqual(notificationDate('2026-11-18',now),{date:'11/18',label:'오늘'});
 assert.deepEqual(notificationDate('2026-11-19',now),{date:'11/19',label:'목요일'});
 assert.deepEqual(notificationDate('2026-11-18',new Date(2026,10,19,12)),{date:'11/18',label:'수요일'});
 assert.notEqual(notificationDate('2025-11-18',now).label,'오늘');
 assert.equal(notificationDate('2026-02-30',now),null);
 const md=createMarkdown(Marked);
 const html=md('| 날짜 | 할 일 |\n|---|---|\n| :date[2026-11-19] | 내용 |\n| 11/18 - 12/02 | 기간 |');
 assert.match(html,/11\/19<br><span class="notification-day">/);
 assert.match(html,/<td>11\/18 - 12\/02<\/td>/);
 assert.equal(keepClasses('notification-date notification-day'),'notification-date notification-day');
});
