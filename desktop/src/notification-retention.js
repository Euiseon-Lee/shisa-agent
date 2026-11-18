import { CHARACTER_LINES } from './character-lines.js';

// Exact legacy progress phrases only; do not discard info results or chat replies.
const progressPhrases=new Set(Object.values(CHARACTER_LINES).flatMap(c=>Object.entries(c.phrases||{}).filter(([k])=>k.endsWith('_prog')).flatMap(([,v])=>Array.isArray(v)?v:[])));
const greetingPhrases=new Set([
  ...Object.values(CHARACTER_LINES).flatMap(c=>c.phrases?.hello||[]),
  '안녕하세요! 곧 브리핑할게요',
]);
// Old startup greetings used generated UUIDs and an eight-second lifetime.
// Limit migration to exact greetings with that envelope, never chat replies.
const isLegacyGreeting=b=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.id||'')&&b.ttlMs===8000&&!b.link&&!b.open&&greetingPhrases.has(b.text);
export function isTransientNotification(b) {
  if(!b||b.kind!=='info'||b.actions||b.proposalId||b.actionId||b.carry||b.detail||b.image)return false;
  return b.transient===true || isLegacyGreeting(b) || (b.id?.startsWith('progress:')&&b.ttlMs===120000) || ((b.id==='refresh'||b.id?.startsWith('progress:'))&&progressPhrases.has(b.text));
}
