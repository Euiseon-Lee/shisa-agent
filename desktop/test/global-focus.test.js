import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadPage,fakeCy} from './fake-dom.js';
import {sidebarPrefs} from '../src/sidebar.js';
const timer=setInterval;globalThis.setInterval=(...args)=>{const h=timer(...args);h.unref();return h;};
test('one header focus control works across menus with start, pause, resume and stop',async()=>{
 const now=Date.now();let active=null, failStart=true;
 const state=()=>({active,day:'2026-11-18',today:0,now});
 const cy=fakeCy({getLang:'ko',getCharacter:'shisa',getSidebarPrefs:sidebarPrefs({today:true}),getDashboard:{ok:true,data:{generatedAt:new Date().toISOString(),todos:[],projects:[],today:{date:'2026-11-18',items:[]}}},focusGet:()=>({ok:true,data:state()}),focusCmd:(cmd)=>{
  if(cmd==='start' && failStart) return {ok:false,status:503};
  if(cmd==='start')active={id:'test-focus',startedAt:now,paused:false,baseMs:0,since:now,seconds:0};
  if(cmd==='pause')active={...active,paused:true,since:null};
  if(cmd==='resume')active={...active,paused:false,since:now};
  if(cmd==='stop')active=null;
  return {ok:true,data:state()};
 }});
 const page=await loadPage('panel',{cy});await page.settle();
 for(const section of ['todos','today','overview','statistics']){
  page.click(`#nav button[data-section="${section}"]`);await page.settle();
  assert.equal(page.document.querySelectorAll('.focus-bar').length,1);
  assert.ok(page.$('#global-focus .focus-start'));
 }
 page.click('#global-focus .focus-start');await page.settle();
 assert.equal(active,null);
 assert.ok(page.$('#focus-global-error'));
 assert.equal(page.$('#top').contains(page.$('#focus-global-error')),false);
 failStart=false;
 page.click('#global-focus .focus-start');await page.settle();
 assert.equal(page.$('#focus-global-error').hidden,true);
 assert.ok(page.$('#global-focus [data-focus-clock]'));
 page.click('#global-focus button');await page.settle();assert.equal(active.paused,true);
 page.click('#nav button[data-section="todos"]');await page.settle();
 page.click('#global-focus button');await page.settle();assert.equal(active.paused,false);
 page.click(page.$('#global-focus button[aria-label="그만하기"]'));await page.settle();assert.equal(active,null);
 assert.deepEqual(cy.__calls.filter(([name])=>name==='focusCmd').map(([,args])=>args[0]),['start','start','pause','resume','stop']);
 assert.equal(page.errors.length,0);
});
