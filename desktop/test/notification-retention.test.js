import test from 'node:test';
import assert from 'node:assert/strict';
import {isTransientNotification} from '../src/notification-retention.js';
import {NotificationStore} from '../src/notification-store.js';
import {BubbleQueue,normalizeBubble} from '../src/bubbles.js';
import {BubbleExpiry} from '../src/bubble-expiry.js';
const progress={id:'progress:briefing',kind:'info',text:'으음~ (오늘 챙길 일 모으는 중이야…)',ttlMs:120000};
test('legacy progress is removed on restore while results and approvals remain',()=>{
 const store={value:JSON.stringify({version:1,items:[progress,{id:'progress:slack',kind:'done',text:'결과를 정리했어요'},{id:'approval',kind:'proposal',text:'승인 필요',actionId:'a',actions:'action'},{id:'chat-1',kind:'info',text:progress.text}],acknowledged:[]}),getItem(){return this.value},setItem(k,v){this.value=v}};
 const q=new BubbleQueue({paged:true}),persist=new NotificationStore(store);persist.restore(q);persist.save(q);
 assert.deepEqual(q.items.map(b=>b.id),['progress:slack','approval','chat-1']);assert.ok(!JSON.parse(store.value).items.some(b=>b.id===progress.id));
});
test('explicit progress expires, is not persisted, and its replacement result is durable',()=>{
 const p=normalizeBubble({...progress,transient:true}),q=new BubbleQueue({paged:true});
 assert.ok(isTransientNotification(p));const expiry=new BubbleExpiry(()=>0);expiry.set(p.id,isTransientNotification(p)?8000:null);assert.equal(expiry.expiresAt(p.id),8000);
 const storage={value:null,getItem(){return this.value},setItem(k,v){this.value=v}},persist=new NotificationStore(storage);
 q.add(p);persist.save(q);assert.equal(JSON.parse(storage.value).items.length,0);
 q.add(normalizeBubble({id:p.id,kind:'done',text:'할 일 요약',detail:'중요한 결과'}));persist.save(q);
 assert.equal(JSON.parse(storage.value).items.length,1);assert.equal(isTransientNotification(q.items[0]),false);
 for(const kind of ['todo','proposal','done','error'])assert.equal(isTransientNotification({...p,kind}),false);
 assert.equal(isTransientNotification({...p,detail:'중요한 결과'}),false);
});

test('startup greetings expire and legacy saved greetings are removed without matching chat replies',()=>{
 const hello={id:'01234567-1234-4567-89ab-0123456789ab',kind:'info',text:'허허 (쿠리만쥬 왔어. 오늘도 느긋하게 해 보자.)',ttlMs:8000};
 assert.equal(isTransientNotification(hello),true);
 assert.equal(isTransientNotification({...hello,id:'chat-123'}),false);
 assert.equal(isTransientNotification({...hello,text:'검토할 일정이 있어요'}),false);
 assert.equal(isTransientNotification({...hello,kind:'error'}),false);
 assert.equal(isTransientNotification({...hello,detail:'실제 결과'}),false);
 assert.equal(isTransientNotification({...hello,id:'startup:greeting',transient:true,text:'사용자가 수정한 시작 인사'}),true);
 const storage={getItem:()=>JSON.stringify({version:1,items:[hello,{...hello,id:'chat-123'}]})};
 const q=new BubbleQueue({paged:true});new NotificationStore(storage).restore(q);
 assert.deepEqual(q.items.map(b=>b.id),['chat-123']);
});
