import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadPage,fakeCy} from './fake-dom.js';
import {localDay,addDays} from '../src/focus.js';
const timer=setInterval;globalThis.setInterval=(...args)=>{const h=timer(...args);h.unref();return h;};
test('shared period and selected date, fixed scale, monthly combined calendar',async()=>{
 const today=localDay(Date.now());
 const cy=fakeCy({getLang:'ko',getDashboard:{ok:true,data:{todos:[],projects:[]}},focusStats:(from,to)=>{
  const days=[];for(let date=from;date<=to;date=addDays(date,1))days.push({date,amSeconds:date===today?3600:0,pmSeconds:date===today?7200:0,completed:date===today?Array.from({length:12},(_,i)=>({id:String(i),title:'완료 '+i})):[],doing:date===today?[{id:'a',title:'CAD 시험 공부'}]:[]});
  return {ok:true,data:{activity:{days,doingHistorySince:new Date().toISOString()}}};
 }});
 const page=await loadPage('panel',{cy});await page.settle();page.click('#nav button[data-section="statistics"]');await page.settle();
 assert.equal(page.document.querySelectorAll('.activity-chart').length,2);
 assert.equal(page.document.querySelectorAll('.activity-day.selected').length,2);
 assert.ok(page.$('.activity-detail').textContent.includes('CAD 시험 공부'));
 assert.equal(page.$(`[data-chart="done"][data-stat-date="${today}"]`).getAttribute('data-daily-count'),'12');
 assert.equal(page.$(`[data-chart="done"][data-stat-date="${today}"] .completion-node-value`).textContent,'12개');
 assert.ok(!page.$('#sec-statistics').textContent.includes('하루 10개'));
 for(const future of page.document.querySelectorAll('.completion-day.future'))assert.equal(future.querySelector('.completion-marker'),null);
 page.click('[data-stat-period="month"]');await page.settle();
 assert.equal(page.document.querySelectorAll('.activity-chart').length,1);
 assert.ok(page.$('.activity-chart').textContent.includes('월간 활동 기록'));
 const monthCell=page.$('[data-chart="focus"][data-stat-date="'+today+'"]');
 assert.equal(monthCell.querySelector('.activity-percent').textContent,'37.5%');
 assert.equal(monthCell.querySelector('.activity-track'),null);
 assert.ok(monthCell.querySelector('.activity-donut').style.backgroundImage.includes('12.5%'));
 assert.ok(monthCell.querySelector('.activity-donut').style.backgroundImage.includes('37.5%'));
 assert.equal(monthCell.querySelector('.activity-value').textContent,'3시간');
 assert.equal(monthCell.querySelector('.activity-month-focus').textContent,'완료 12개');

 const future=page.document.querySelectorAll('.activity-day.future');
 for(const el of future){assert.equal(el.querySelector('.activity-value').textContent,'');assert.ok(el.querySelector('.activity-donut.empty'));assert.equal(el.querySelector('.activity-percent').textContent,'');assert.equal(el.querySelector('.activity-month-focus').textContent,'');assert.ok(el.querySelector('.activity-date').textContent);}
 if(Number(today.slice(-2))>1){page.click(`[data-stat-date="${addDays(today,-1)}"]`);assert.ok(!page.$('.activity-detail').textContent.includes('CAD 시험 공부'));}
 assert.equal(page.errors.length,0);
});

test('focus scale stays at eight hours and overtime retains its exact duration',async()=>{
 const today=localDay(Date.now());
 for(const hours of [0,4,8,10]){
  const cy=fakeCy({getLang:'ko',getDashboard:{ok:true,data:{todos:[],projects:[]}},focusStats:()=>({ok:true,data:{activity:{days:[{date:today,amSeconds:hours?3600:0,pmSeconds:Math.max(0,hours-1)*3600,completed:[],doing:[]}]}}})});
  const page=await loadPage('panel',{cy});await page.settle();page.click('#nav button[data-section="statistics"]');await page.settle();
  const cell=page.$('[data-chart="focus"][data-stat-date="'+today+'"]');
  assert.equal(cell.querySelector('.activity-percent').textContent,(hours/8*100)+'%');
  assert.equal(cell.querySelector('.activity-track'),null);
  assert.equal(cell.querySelector('.activity-month-focus'),null);
  assert.equal(cell.querySelector('.activity-value').textContent,(hours?hours+'시간':'0분'));
  assert.ok(page.$('#sec-statistics').textContent.includes('하루 8시간 기준'));
  page.click('[data-stat-period="month"]');await page.settle();
  const monthCell=page.$('[data-chart="focus"][data-stat-date="'+today+'"]');
  assert.equal(monthCell.querySelector('.activity-percent').textContent,(hours/8*100)+'%');
  assert.equal(monthCell.querySelector('.activity-value').textContent,(hours?hours+'시간':'0분'));
  assert.equal(monthCell.querySelector('.activity-month-focus').textContent,'완료 0개');
  assert.equal(page.errors.length,0);
 }
});

test('weekly line uses daily counts, falls to zero, and gives equal counts equal heights',async()=>{
 const counts=[2,3,0,1,0,2,1];
 const cy=fakeCy({getLang:'ko',getDashboard:{ok:true,data:{todos:[],projects:[]}},focusStats:(from)=>({ok:true,data:{activity:{days:counts.map((n,i)=>({date:addDays(from,i),amSeconds:0,pmSeconds:0,completed:Array.from({length:n},(_,j)=>({id:i+'-'+j,title:'예시'})),doing:[]}))}}})});
 const page=await loadPage('panel',{cy});await page.settle();page.click('#nav button[data-section="statistics"]');await page.settle();
 page.click('.activity-range button');await page.settle();
 const cells=page.document.querySelectorAll('.completion-day');
 assert.deepEqual([...cells].map(c=>Number(c.getAttribute('data-daily-count'))),counts);
 assert.deepEqual([...cells].map(c=>c.querySelector('.completion-node-value').textContent),counts.map(n=>n+'개'));
 const points=page.$('.completion-line polyline').getAttribute('points').split(' ').map(p=>p.split(',').map(Number));
 assert.equal(points.length,7);assert.equal(points[2][1],points[4][1]);assert.equal(points[0][1],points[5][1]);assert.ok(points[0][1]>points[1][1]);assert.ok(points[2][1]>points[1][1]);
 assert.ok(!page.$('.activity-chart').textContent.includes('선:'));
 assert.equal(page.errors.length,0);
});
