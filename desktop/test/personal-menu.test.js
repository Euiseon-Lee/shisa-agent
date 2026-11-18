import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {characterMenuTemplate} from '../src/menus.js';
import {setLanguage} from '../src/i18n.js';
afterEach(()=>setLanguage('ko'));
test('focus start precedes panel, invokes action once, and is absent while active including paused sessions',()=>{
 let starts=0;const actions={startFocus:()=>starts++,showPanel:()=>{}};
 setLanguage('ko');
 const menu=characterMenuTemplate(actions,{focusActive:false,connected:true});
 assert.deepEqual(menu.slice(0,2).map(x=>x.label),['집중 시작','패널 열기']);
 menu[0].click();assert.equal(starts,1);
 assert.equal(characterMenuTemplate(actions,{focusActive:true})[0].label,'패널 열기');
 assert.equal(characterMenuTemplate(actions,{focusActive:false,connected:false})[0].enabled,false);
 setLanguage('ja');assert.equal(characterMenuTemplate(actions,{focusActive:false})[0].label,'集中を開始');
});
