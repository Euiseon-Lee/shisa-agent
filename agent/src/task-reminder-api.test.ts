import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Bus} from './bus.ts';
test('preview endpoint validates sender and kind before emitting a notification',async()=>{
 const bus=new Bus(),calls:string[]=[];
 await bus.listen(0,{approve:async()=>'',hold:async()=>'',briefing:async()=>'',dashboard:async()=>({}),todoDone:()=>true,chat:()=>'',chatHistory:()=>[],previewTodoReminder:kind=>{calls.push(kind);return {ok:true};}});
 const url=`http://127.0.0.1:${(bus.server!.address() as any).port}/todo-reminders/preview`;
 try {
  const send=(kind:string,headers:Record<string,string>={'x-cy-agent':'1'})=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify({kind})});
  assert.equal((await send('end',{})).status,403);
  assert.equal((await send('end',{'x-cy-agent':'1',origin:'https://evil.example'})).status,403);
  assert.equal((await send('wrong')).status,400);assert.deepEqual(calls,[]);
  assert.equal((await send('end')).status,200);assert.deepEqual(calls,['end']);
 } finally {bus.close();}
});
