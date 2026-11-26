import {test} from 'node:test';
import assert from 'node:assert/strict';
import {todoListMd} from './reactions.ts';

test('today reminder uses dated tables even for one task and includes every remaining task',ctx=>{
 ctx.mock.timers.enable({apis:['Date'],now:new Date('2026-11-18T03:00:00Z')});
 const title='긴 제목이 있는 오늘 할 일을 생략하지 않고 확인하기 위한 예시입니다';
 const items=Array.from({length:9},(_,i)=>({id:String(i),title:title+i,source:'user',scheduledDate:'2026-11-18'}));
 const one=todoListMd(items.slice(0,1),'user',1,true);
 assert.ok(one.includes('|---|---|---|'));assert.ok(one.includes(':date[2026-11-18:purple]'));assert.ok(one.includes(title));
 const all=todoListMd(items,'user',items.length,true);
 for(let i=0;i<9;i++)assert.ok(all.includes(title+i));
 assert.equal(todoListMd([],'user',0,true),'');
});
