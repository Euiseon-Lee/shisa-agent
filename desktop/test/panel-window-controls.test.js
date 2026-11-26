import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadPage,fakeCy} from './fake-dom.js';
import {localDay} from '../src/todos.js';
const timer=setInterval;globalThis.setInterval=(...args)=>{const handle=timer(...args);handle.unref();return handle;};

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
