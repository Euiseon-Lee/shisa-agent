import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store, kstDay } from './store.ts';
import { parsePatch, parseNew } from './todos.ts';
import { DailyPlanService } from './daily-plan.ts';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('completion time survives edits, trash/restore; reopening clears it and completing again replaces it', () => {
 const s=new Store(':memory:'); const t=s.addTodo({title:'completion'});
 s.editTodo(t.id,{status:'done'}); const first=s.getTodo(t.id)!.doneAt;
 assert.ok(first); s.editTodo(t.id,{title:'edited',note:'note'}); assert.equal(s.getTodo(t.id)!.doneAt,first);
 s.trashTodo(t.id); s.restoreTodo(t.id); assert.equal(s.getTodo(t.id)!.doneAt,first);
 s.editTodo(t.id,{status:'open'}); assert.equal(s.getTodo(t.id)!.doneAt,undefined);
 s.db.prepare('UPDATE todos SET updated = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z',t.id);
 s.editTodo(t.id,{status:'done'}); assert.ok(s.getTodo(t.id)!.doneAt! > '2000'); s.db.close();
});
test('seven-day query uses completion time, not later modifications; newest first',()=>{
 const s=new Store(':memory:'); const now=Date.now(); const make=(name: string,days: number)=>{
 const t=s.addTodo({title:name});s.editTodo(t.id,{status:'done'});
 s.db.prepare('UPDATE todos SET done_at = ?, updated = ? WHERE id = ?').run(new Date(now-days*864e5).toISOString(),new Date(now).toISOString(),t.id);return t.id;};
 const six=make('six',6), eight=make('eight',8), one=make('one',1);
 assert.deepEqual(s.recentlyDone(new Date(now-7*864e5).toISOString()).map(t=>t.id),[one,six]);s.db.close();
});
test('manual, automatic and briefing completion paths record completion time',()=>{
 const s=new Store(':memory:'); const a=s.addTodo({title:'auto'}), b=s.addTodo({title:'briefing'});
 assert.ok(s.autoCompleteTodo(a.id,{reason:'test',evidence:{ids:[]}})!.doneAt);
 s.setTodoStatus(b.id,'done',{by:'briefing'});assert.ok(s.getTodo(b.id)!.doneAt);
 s.revertAutoTodo(a.id);assert.equal(s.getTodo(a.id)!.doneAt,undefined);s.db.close();
});
test('date scheduling is independent of importance and stays on the chosen date',()=>{
 const s=new Store(':memory:');const t=s.addTodo({title:'dated',priority:3,scheduledDate:'2026-11-20'});
 assert.equal(s.todayTodos('2026-11-20')[0].id,t.id);assert.equal(s.todayTodos('2026-11-21').length,0);
 s.editTodo(t.id,{priority:1});assert.equal(s.getTodo(t.id)!.scheduledDate,'2026-11-20');
 const p=new DailyPlanService(s,{now:()=>new Date(2026,10,22,12)});
 p.applyOps([{op:'add',id:t.id}]);assert.equal(s.getTodo(t.id)!.scheduledDate,'2026-11-22');
 p.applyOps([{op:'remove',id:t.id}]);assert.equal(s.getTodo(t.id)!.scheduledDate,undefined);s.db.close();
});
test('irrelevant items are excluded indefinitely, narrowly matched, and can be restored',()=>{
 const s=new Store(':memory:');const t={id:'mail:a',title:'Review quarterly budget',source:'mail',sourceRef:'mail:origin',priority:2};
 s.upsertTodo(t);s.setIrrelevant(t.id,true);assert.equal(s.openTodos().length,0);assert.equal(s.getTodo(t.id),undefined);
 assert.equal(s.trashCount(),0);assert.equal(s.upsertTodo({...t,id:'mail:changed'}),'blocked');
 assert.equal(s.isIrrelevant({...t,id:'mail:other',title:'Book meeting room'}),false);
 assert.equal(s.isIrrelevant({...t,id:'mail:other',sourceRef:'mail:different'}),false);
 s.emptyTrash();assert.equal(s.irrelevantTodos().length,1);
 s.setIrrelevant(t.id,false);assert.equal(s.openTodos().length,1);assert.equal(s.isIrrelevant(t),false);s.db.close();
});
test('invalid dates and mixed irrelevant patches are rejected',()=>{
 for(const d of ['2026-02-30','11/20','2026-13-01'])assert.equal(parsePatch({scheduledDate:d}).ok,false);
 assert.equal(parsePatch({scheduledDate:'2028-02-29'}).ok,true);assert.equal(parsePatch({scheduledDate:null}).ok,true);
 assert.equal(parsePatch({irrelevant:true,title:'other'}).ok,false);
 const p=parseNew({title:'new',scheduledDate:'2026-11-20'});assert.ok(p.ok);assert.equal(p.value.scheduledDate,'2026-11-20');
});
test('legacy migration uses completion ledger instead of later edit time, and is repeatable',()=>{
 const path=join(mkdtempSync(join(tmpdir(),'shisa-migration-')),'test.db');const old=new DatabaseSync(path);
 old.exec(`CREATE TABLE todos (id TEXT PRIMARY KEY,title TEXT NOT NULL,source TEXT NOT NULL,priority INTEGER,status TEXT,created TEXT,updated TEXT);
 INSERT INTO todos VALUES ('legacy','old','user',2,'done','2026-11-01','2026-11-18');
 CREATE TABLE todo_ledger (n INTEGER PRIMARY KEY AUTOINCREMENT,day TEXT,at TEXT,todo_id TEXT,title TEXT,action TEXT,by TEXT,detail TEXT);
 INSERT INTO todo_ledger(day,at,todo_id,title,action,by) VALUES ('2026-11-10','2026-11-10T10:00:00.000Z','legacy','old','done','user');`);old.close();
 const s=new Store(path);assert.equal(s.getTodo('legacy')!.doneAt,'2026-11-10T10:00:00.000Z');s.db.close();
 const again=new Store(path);assert.equal(again.getTodo('legacy')!.doneAt,'2026-11-10T10:00:00.000Z');again.db.close();
});

test('completion statistics include seven calendar days without recent-list cap',()=>{
 const s=new Store(':memory:');const now=new Date(2026,10,18,12);const date=(offset:number)=>{const d=new Date(now);d.setDate(d.getDate()+offset);return d.toISOString();};
 for(let i=0;i<105;i++){const t=s.addTodo({title:'completed '+i});s.editTodo(t.id,{status:'done'});s.db.prepare('UPDATE todos SET done_at=? WHERE id=?').run(date(0),t.id);}
 const old=s.addTodo({title:'too old'});s.editTodo(old.id,{status:'done'});s.db.prepare('UPDATE todos SET done_at=? WHERE id=?').run(date(-7),old.id);
 const six=s.addTodo({title:'six days'});s.editTodo(six.id,{status:'done'});s.db.prepare('UPDATE todos SET done_at=? WHERE id=?').run(date(-6),six.id);
 const stats=s.completionStats(now);assert.equal(stats.days.length,7);assert.equal(stats.total,106);assert.equal(stats.days[6].count,105);assert.equal(stats.days[0].count,1);
 s.trashTodo(six.id);assert.equal(s.completionStats(now).total,105);s.restoreTodo(six.id);assert.equal(s.completionStats(now).total,106);
 s.editTodo(six.id,{status:'open'});assert.equal(s.completionStats(now).total,105);s.db.close();
});
