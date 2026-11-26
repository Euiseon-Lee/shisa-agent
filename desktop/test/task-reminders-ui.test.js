import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadPage,fakeCy} from './fake-dom.js';
import {localDay} from '../src/todos.js';
import {REMINDER_DEFAULT} from '../src/settings.js';
const timer=setInterval;globalThis.setInterval=(...args)=>{const handle=timer(...args);handle.unref();return handle;};
globalThis.CSS ??= {escape:value=>String(value)};

test('reminder settings default to work boundaries, midpoint is optional and previews dispatch',async()=>{
 let value={todayReminder:{...REMINDER_DEFAULT},models:{},phrases:[],briefing:{sources:[]}};
 const cy=fakeCy({getLang:'ko',getSettings:async()=>({ok:true,data:value}),saveSettings:async patch=>{value={...value,...patch};return {ok:true,data:{settings:value}};},previewTodoReminder:async()=>({ok:true})});
 const page=await loadPage('settings',{cy});await page.settle();
 assert.equal(page.$('#rem-start').checked,true);assert.equal(page.$('#rem-end').checked,true);
 assert.equal(page.$('#rem-midday').checked,false);assert.equal(page.$('#rem-extra').hidden,true);
 const check=page.$('#rem-midday');check.checked=true;check.dispatchEvent(new page.window.Event('change'));await page.settle();
 assert.equal(value.todayReminder.midday,true);assert.deepEqual(value.todayReminder.times,['13:00']);
 assert.equal(page.$('#rem-extra').hidden,false);
 page.click('#rem-preview-end');await page.settle();
 assert.ok(cy.__calls.some(([name,args])=>name==='previewTodoReminder'&&args[0]==='end'));
 assert.match(page.$('#rem-err').textContent,/미리보기 알림/);
});
test('per-item dialog saves chosen day/time and can turn off a reminder',async()=>{
 const task={id:'pms',title:'PMS',source:'user',priority:2,scheduledDate:localDay()};
 const edits=[];
 const cy=fakeCy({getLang:'ko',getDashboard:{ok:true,data:{todos:[task],projects:[]}},todoEdit:(id,patch)=>{edits.push({id,patch});return {ok:true};}});
 const page=await loadPage('panel',{cy});await page.settle();page.click('#nav button[data-section="todos"]');await page.settle();
 page.click('#sec-todos .row-more');
 const menu=[...page.document.querySelectorAll('[role="menuitem"]')].find(n=>n.textContent.includes('알림 설정'));assert.ok(menu);page.click(menu);
 const dialog=page.$('.todo-reminder-dialog');assert.ok(dialog);
 const check=dialog.querySelector('input[type="checkbox"]');check.checked=true;check.dispatchEvent(new page.window.Event('change'));
 dialog.querySelector('select').value='1';dialog.querySelector('input[type="time"]').value='10:15';
 page.click(dialog.querySelector('.primary'));await page.settle();
 assert.deepEqual(edits,[{id:'pms',patch:{reminder:{daysBefore:1,time:'10:15'}}}]);
 page.click('#sec-todos .row-more');page.click([...page.document.querySelectorAll('[role="menuitem"]')].find(n=>n.textContent.includes('알림 설정')));
 page.click(page.$('.todo-reminder-dialog .primary'));await page.settle();
 assert.deepEqual(edits.at(-1),{id:'pms',patch:{reminder:null}});
});
