import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Store} from './store.ts';
import {Bus} from './bus.ts';
test('clearing excluded records preserves open, completed and trash records; lifts exact-source suppression',()=>{
 const s=new Store(':memory:');
 const item={id:'mail:excluded',title:'Excluded',source:'mail',sourceRef:'mail:ref',priority:2};
 s.upsertTodo(item);s.setIrrelevant(item.id,true);
 const open=s.addTodo({title:'Open'}),done=s.addTodo({title:'Done'}),trash=s.addTodo({title:'Trash'});
 s.editTodo(done.id,{status:'done'});s.trashTodo(trash.id);
 assert.equal(s.clearIrrelevant(open.id),0);assert.equal(s.clearIrrelevant(trash.id),0);
 assert.equal(s.isIrrelevant({...item,id:'different'}),true);
 assert.equal(s.clearIrrelevant(item.id),1);assert.equal(s.clearIrrelevant(item.id),0);
 assert.equal(s.isIrrelevant({...item,id:'different'}),false);
 s.upsertTodo(item);assert.ok(s.getTodo(item.id));s.setIrrelevant(item.id,true);
 const other=s.addTodo({title:'Other'});s.setIrrelevant(other.id,true);
 assert.equal(s.clearIrrelevant(),2);assert.equal(s.clearIrrelevant(),0);
 assert.ok(s.getTodo(open.id));assert.equal(s.getTodo(done.id)?.status,'done');assert.ok(s.trashedTodo(trash.id));s.db.close();
});
test('excluded clear API checks authorization and payload before mutating',async()=>{
 const bus=new Bus();const calls:(string|undefined)[]=[];
 await bus.listen(0,{approve:async()=>'',hold:async()=>'',briefing:async()=>'',dashboard:async()=>({}),todoDone:()=>true,chat:()=>'',chatHistory:()=>[],todoIrrelevantClear:id=>{calls.push(id);return 1;}});
 const url='http://127.0.0.1:'+(bus.server!.address() as any).port+'/todos/irrelevant/clear';
 const post=(body:unknown,headers:Record<string,string>={'x-cy-agent':'1'})=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
 try {
  assert.equal((await post({},{})).status,403);
  assert.equal((await post({},{'x-cy-agent':'1',origin:'https://evil.example'})).status,403);
  for(const body of [{id:''},{id:1},{id:null},{all:true},[],null])assert.equal((await post(body)).status,400);
  assert.deepEqual(calls,[]);
  assert.deepEqual(await (await post({id:'mail:1'})).json(),{ok:true,purged:1});
  assert.equal((await post({})).status,200);assert.deepEqual(calls,['mail:1',undefined]);
 }finally{bus.close();}
});
