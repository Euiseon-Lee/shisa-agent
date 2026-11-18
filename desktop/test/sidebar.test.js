import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sidebarPrefs,shownSidebar,OPTIONAL_TABS,moveSidebarTab} from '../src/sidebar.js';
import {sanitizeAppPrefs} from '../src/settings.js';
test('today is hidden by default; required tabs survive all optional tabs off',()=>{
 assert.equal(sidebarPrefs().today,false);
 assert.equal(sidebarPrefs({today:true}).today,true);
 const off=Object.fromEntries(OPTIONAL_TABS.map(k=>[k,false]));
 assert.deepEqual(shownSidebar(['setup','overview',...OPTIONAL_TABS],off),['setup','overview']);
 assert.equal(sidebarPrefs({today:'false'}).today,false);
});
test('sidebar patches accept only optional tab booleans, preserving other preferences',()=>{
 assert.deepEqual(sanitizeAppPrefs({sidebarTabs:{today:true},updateCheck:false}),{sidebarTabs:{today:true},updateCheck:false});
 for(const sidebarTabs of [{setup:false},{overview:false},{today:1},[],null,{}]) assert.equal(sanitizeAppPrefs({sidebarTabs}),null);
});

test('order persists separately from visibility, stays below overview and rejects invalid keys',()=>{
 let order=[...OPTIONAL_TABS];for(let i=0;i<4;i++)order=moveSidebarTab(order,'statistics',-1);
 const prefs=sidebarPrefs({order,today:false});
 assert.equal(order[0],'statistics');assert.deepEqual(shownSidebar(['setup','overview',...OPTIONAL_TABS],prefs).slice(0,3),['setup','overview','statistics']);
 assert.ok(!shownSidebar(['setup','overview',...OPTIONAL_TABS],prefs).includes('today'));
 assert.deepEqual(moveSidebarTab(order,'statistics',-1),order);
 assert.deepEqual(sanitizeAppPrefs({sidebarTabs:{order}}),{sidebarTabs:{order}});
 for(const invalid of [[],['overview',...OPTIONAL_TABS],OPTIONAL_TABS.map(()=>'todos')])assert.equal(sanitizeAppPrefs({sidebarTabs:{order:invalid}}),null);
});
