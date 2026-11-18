import test from 'node:test';
import assert from 'node:assert/strict';
import { BubbleQueue, normalizeBubble, approvalButtons } from '../src/bubbles.js';
const bubble = (id, extra = {}) => normalizeBubble({ id, text: id, kind: 'info', ...extra });
test('paged notifications retain all unread items and do not interrupt the current page', () => {
 const q=new BubbleQueue({paged:true});
 for(let i=0;i<25;i++)q.add(bubble(String(i)));
 assert.equal(q.items.length,25);
 assert.equal(q.visible()[0].id,'0');
 assert.deepEqual(q.page(),{index:0,total:25});
 q.move(1); q.add(bubble('new'));
 assert.equal(q.visible()[0].id,'1');
 q.add(bubble('1',{text:'updated'}));
 assert.equal(q.visible()[0].text,'updated');
 assert.equal(q.items.length,26);
});
test('acknowledging advances to the next notification and handles the final page', () => {
 const q=new BubbleQueue({paged:true});
 for(const id of ['a','b','c'])q.add(bubble(id));
 q.move(1);q.remove('b');
 assert.equal(q.visible()[0].id,'c');
 assert.deepEqual(q.page(),{index:1,total:2});
 q.remove('c');assert.equal(q.visible()[0].id,'a');
 q.remove('a');assert.deepEqual(q.visible(),[]);
 q.add(bubble('d'));assert.equal(q.visible()[0].id,'d');
});
test('navigation is bounded and approvals retain their explicit decision buttons', () => {
 const q=new BubbleQueue({paged:true});
 q.add(bubble('normal'));
 q.add(bubble('approval',{kind:'proposal',actions:'action',actionId:'request1'}));
 q.move(-10); assert.equal(q.visible()[0].id,'normal');
 q.move(10); const b=q.visible()[0];
 assert.equal(b.id,'approval');
 assert.deepEqual(approvalButtons(b).map(x=>x.decision),['confirm','cancel']);
 q.update('approval',{kind:'done',decided:true});
 assert.equal(q.visible()[0].id,'approval');
});
