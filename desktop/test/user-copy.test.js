import {test} from 'node:test';
import assert from 'node:assert/strict';
import {userCopy} from '../src/user-copy.js';
import {normalizeBubble} from '../src/bubbles.js';
import {createMarkdown} from '../src/markdown.js';
import {Marked} from '../renderer/vendor/marked.js';
test('shared labels apply to saved notices, Markdown text and count labels',()=>{
 const old='남은 할 일 / 대기 중 제안 / 오늘 예정된 할 일 0건';
 const expected='예정된 할 일 / 승인 대기 중 코드 / 오늘 할 일 0건';
 assert.equal(userCopy(old),expected);
 assert.equal(normalizeBubble({id:'saved',text:old,detail:old}).detail,expected);
 assert.ok(createMarkdown(Marked)(old).includes(expected));
 assert.ok(createMarkdown(Marked)('`남은 할 일`').includes('<code>남은 할 일</code>'));
});
