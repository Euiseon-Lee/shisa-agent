import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numericDate, longDate, dateRange, fullDateTime } from '../src/date-format.js';
test('date display: padding, weekdays, year boundaries and 24-hour time',()=>{
 const now=new Date(2026,10,18);
 assert.equal(numericDate('2026-01-03',{now}),'01/03');
 assert.equal(numericDate('2027-01-03',{now}),'2027/01/03');
 assert.equal(numericDate('2026-11-18',{now,weekday:true}),'11/18 수요일');
 assert.equal(numericDate('2026-11-18',{now,weekday:true,compact:true}),'11/18 (수)');
 assert.equal(longDate('2026-11-18',{weekday:true}),'2026년 11월 18일 수요일');
 assert.equal(dateRange('2026-12-28','2027-01-03',{long:true}),'2026년 12월 28일 ~ 2027년 1월 3일');
 assert.equal(dateRange('2026-12-28','2027-01-03',{now}),'2026/12/28 ~ 2027/01/03');
 assert.equal(fullDateTime(new Date(2026,10,18,14,5)),'2026년 11월 18일 수요일 14:05');
});
