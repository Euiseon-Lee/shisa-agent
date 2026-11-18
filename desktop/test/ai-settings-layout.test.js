import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadPage,fakeCy} from './fake-dom.js';
test('AI settings render task-specific model selectors and keep save handlers',async()=>{
 const data={brain:{provider:'claude'},modelSlots:{provider:'claude',claude:true,roles:[{role:'quick',label:'빠른 대화',value:'sonnet',enabled:true},{role:'general',label:'대화',value:'sonnet',enabled:true},{role:'code',label:'코드 작업',value:'sonnet',enabled:true,coder:{provider:'claude',choices:[{id:'claude',label:'Claude Code'}]}}]},modelOptions:[{id:'sonnet',label:'Sonnet'},{id:'opus',label:'Opus'}],briefing:{sources:[],exclude:[]}};
 const cy=fakeCy({getLang:'ko',getSettings:{ok:true,data},caps:{claude:true},setSettings:{ok:true,data}});
 const page=await loadPage('settings',{cy});await page.settle();
 assert.equal(page.$('#models-title').textContent,'작업별 모델');
 assert.equal(page.$('#config-path').hidden,true);
 assert.equal(page.$('#models .model-row label').textContent,'대화 및 브리핑');
 assert.equal(page.$('#model-general').parentNode.className,'model-row');
 assert.equal(page.$('#model-code-ai').parentNode.querySelector('label').textContent,'AI');
 assert.equal(page.$('#model-code').parentNode.querySelector('label').textContent,'모델');
 assert.ok(page.$('.model-info .desc').textContent);
 assert.equal(page.errors.length,0);
});
