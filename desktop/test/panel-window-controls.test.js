import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadPage,fakeCy} from './fake-dom.js';
import {localDay} from '../src/todos.js';
const timer=setInterval;globalThis.setInterval=(...args)=>{const handle=timer(...args);handle.unref();return handle;};

test('window controls preserve order and dispatch minimize, maximize, restore and close',async()=>{
 const calls=[];let update;
 const cy=fakeCy({getLang:'ko',getDashboard:{ok:true,data:{todos:[],projects:[]}},minimize:()=>calls.push('minimize'),toggleMaximize:()=>calls.push('maximize'),close:()=>calls.push('close'),onWindowState:fn=>{update=fn;}});
 const page=await loadPage('panel',{cy});await page.settle();
 assert.deepEqual([...page.$('#window-controls').children].map(el=>el.id),['minimize','maximize','close']);
 page.click('#minimize');page.click('#maximize');
 update({maximized:true});assert.equal(page.$('#maximize').getAttribute('aria-label'),'복원');
 page.click('#maximize');update({maximized:false});assert.equal(page.$('#maximize').getAttribute('aria-label'),'최대화');
 page.click('#close');assert.deepEqual(calls,['minimize','maximize','maximize','close']);
 assert.deepEqual(page.errors,[]);
});

test('statistics reentry resets selected day and reloads the current period',async()=>{
 const queries=[];
 const page=await loadPage('panel',{cy:fakeCy({getLang:'ko',getDashboard:{ok:true,data:{todos:[],projects:[]}},focusStats:(from,to)=>{queries.push([from,to]);return {ok:true,data:{activity:{days:[]}}};}})});
 await page.settle();page.click('#nav button[data-section="statistics"]');await page.settle();
 const current=queries.at(-1);
 page.click('#sec-statistics .cal-prev');await page.settle();
 assert.notDeepEqual(queries.at(-1),current);
 page.click('#nav button[data-section="todos"]');page.click('#nav button[data-section="statistics"]');await page.settle();
 assert.deepEqual(queries.at(-1),current);
});
