import {test} from 'node:test';
import assert from 'node:assert/strict';
import {todoSourceLabel} from '../src/todo-source-label.js';
import {groupTodos,shapeRecentDone,shapeConnectors} from '../src/dashboard.js';
import {cleanMailBody,mailConnected} from '../src/mail-connect.js';
test('source names use verified tool/account purpose with safe fallbacks',()=>{
 for(const [todo,label] of [[{source:'mail',mailPurpose:'work'},'업무 메일'],[{source:'mail',mailPurpose:'personal'},'개인 메일'],[{source:'mail'},'메일'],[{source:'session',sourceTool:'claude'},'Claude Code'],[{source:'session',sourceTool:'codex'},'Codex'],[{source:'session'},'AI'],[{source:'commit'},'코드 변경']]) assert.equal(todoSourceLabel(todo,'ko'),label);
});
test('provenance survives list and completed-item shaping',()=>{const item={id:'1',title:'x',source:'mail',mailPurpose:'work',priority:2};assert.equal(groupTodos([item])[0].items[0].mailPurpose,'work');assert.equal(shapeRecentDone([item])[0].mailPurpose,'work');});
test('purpose-only IPC validates account id and enum without a password',()=>{assert.deepEqual(cleanMailBody({id:'m-1',purpose:'work'}),{id:'m-1',purpose:'work'});assert.equal(cleanMailBody({id:'../x',purpose:'work'}),null);assert.equal(cleanMailBody({id:'m-1',purpose:'other'}),null);assert.equal(mailConnected(shapeConnectors([{cap:'mail',mode:'imap',accounts:[{id:'m-1',user:'x@y.z',preset:'gmail',purpose:'personal'}]}])).accounts[0].purpose,'personal');});
