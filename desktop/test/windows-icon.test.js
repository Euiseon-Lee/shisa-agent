import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pngIcon, shortcutBelongsTo } from '../src/windows-icon.js';
import { appUserModelId } from '../src/squirrel.js';

test('personal app identity and shortcuts stay separate from official installation', () => {
  const exe = 'C:\\Apps\\ShisaPersonal\\app-0.5.1\\ShisaPersonal.exe';
  assert.equal(appUserModelId(exe), 'com.squirrel.ShisaPersonal.ShisaPersonal');
  assert.ok(shortcutBelongsTo(exe, exe));
  assert.ok(shortcutBelongsTo('C:\\Apps\\ShisaPersonal\\ShisaPersonal.exe', exe));
  assert.ok(shortcutBelongsTo('C:\\Apps\\ShisaPersonal\\app-0.5.0\\ShisaPersonal.exe', exe));
  assert.ok(!shortcutBelongsTo('C:\\Apps\\Shisa\\app-0.3.3\\Shisa.exe', exe));
  assert.ok(!shortcutBelongsTo('C:\\Other\\ShisaPersonal.exe', exe));
  assert.ok(!shortcutBelongsTo('C:\\Apps\\ShisaPersonal\\other\\ShisaPersonal.exe', exe));
});

test('ICO directory points to each PNG size and handles 256-pixel entries', () => {
  const entries = [{size:16,png:Buffer.from('first')},{size:256,png:Buffer.from('second')}];
  const ico=pngIcon(entries);
  assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),2);
  for(let i=0;i<entries.length;i++){
    const at=6+i*16,offset=ico.readUInt32LE(at+12),len=ico.readUInt32LE(at+8);
    assert.equal(ico[at],entries[i].size===256?0:entries[i].size);
    assert.deepEqual(ico.subarray(offset,offset+len),entries[i].png);
  }
});
