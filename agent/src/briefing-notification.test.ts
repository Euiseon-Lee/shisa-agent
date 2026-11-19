import {test} from 'node:test';
import assert from 'node:assert/strict';
import {briefingTodoBubble} from './reactions.ts';
test('character briefing summary and details use only current eligible todos',()=>{
 const now=new Date('2026-11-19T02:00:00Z');
 const b=briefingTodoBubble([{id:'late',title:'Overdue',scheduledDate:'2026-11-18'},{id:'today',title:'Today',scheduledDate:'2026-11-19'},{id:'sun',title:'Sunday',scheduledDate:'2026-11-22'},{id:'future',title:'Next week',scheduledDate:'2026-11-26'},{id:'none',title:'Undated'},{id:'done',title:'Finished',scheduledDate:'2026-11-19',status:'done'}],1,now);
 assert.equal(b.id,'briefing-summary');assert.match(b.text,/3개/);assert.match(b.text,/미완료는 1개/);assert.match(b.text,/새 할 일 1개/);
 assert.match(b.detail!,/Overdue/);assert.match(b.detail!,/Sunday/);assert.doesNotMatch(b.detail!,/Next week|Undated|Finished/);
 const empty=briefingTodoBubble([],0,now);assert.equal(empty.kind,'info');assert.equal(empty.detail,'');assert.equal(empty.id,b.id);
});
