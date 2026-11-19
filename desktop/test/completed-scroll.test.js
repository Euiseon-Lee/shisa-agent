import {test} from 'node:test';
import assert from 'node:assert/strict';
import {completedListHeight} from '../src/completed-scroll.js';
test('ten or fewer rows do not get an internal height limit',()=>{assert.equal(completedListHeight([]),null);assert.equal(completedListHeight(Array.from({length:10},(_,i)=>({top:i*32,bottom:(i+1)*32}))),null);});
test('eleven rows cap at ten measured rows including wrapped titles and padding',()=>{const rows=Array.from({length:11},(_,i)=>({top:100+i*32+(i>0?20:0),bottom:100+(i+1)*32+20}));assert.equal(completedListHeight(rows,6),346);assert.equal(completedListHeight(rows.map(r=>({top:r.top-125,bottom:r.bottom-125})),6),346);});
test('hidden sections wait until visible before measuring',()=>{assert.equal(completedListHeight(Array.from({length:11},()=>({top:0,bottom:0}))),null);});

test('recurring list caps at five actual rows only when a sixth exists',()=>{const rows=Array.from({length:6},(_,i)=>({top:i*64,bottom:(i+1)*64}));assert.equal(completedListHeight(rows.slice(0,5),6,5),null);assert.equal(completedListHeight(rows,6,5),326);});
