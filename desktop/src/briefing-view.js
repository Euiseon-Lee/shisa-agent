import {scheduleGroup} from './schedule-groups.js';
const cell=s=>String(s??'').replace(/\|/g,'/').replace(/\r?\n/g,' ').trim();
const split=line=>line.trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/).map(s=>s.trim());
const clean=s=>s.replace(/\*|_/g,'').trim();
export function formatBriefing(source,todos,today) {
 const byId=new Map((todos||[]).map(t=>[t.id,t]));
 const selected=new Map(),lines=String(source||'').split(/\r?\n/),output=[];
 const token='<!-- briefing-todo-table -->';let inserted=false;
 const add=(text,fallback={})=>{
  const match=text.match(/\[([^\]]+)\]\(#([^\s)]+)\)/);
  if(!match)return false;
  let id=match[2];try{id=decodeURIComponent(id)}catch{}
  const task=byId.get(id);
  selected.set(id,{id,task,label:match[1],...fallback});
  if(!inserted){output.push(token);inserted=true;}return true;
 };
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  // Remove the obsolete standalone footer rather than pretending P4 means undated.
  if(/^\s*(?:[-*]\s+)?(?:백로그|날짜 미정)(?:\s*[·:]|\s*\[)/.test(line))continue;
  if(line.trim().startsWith('|')&&lines[i+1]?.match(/^\s*\|?[\s:|-]+\|\s*$/)){
   const heads=split(line).map(clean),taskIndex=heads.indexOf('할 일');
   if(taskIndex>=0){
    const rows=[];let j=i+2;while(j<lines.length&&lines[j].trim().startsWith('|'))rows.push(split(lines[j++]));
    if(rows.every(row=>/\]\(#[^\s)]+\)/.test(row[taskIndex]||''))){for(const row of rows)add(row[taskIndex],{date:row[heads.indexOf('예정일')]||'',status:row[heads.indexOf('상태')]||''});i=j-1;continue;}
   }
  }
  if(/^\s*(?:[-*+]\s+|\d+[.)]\s+)\[[^\]]+\]\(#[^\s)]+\)/.test(line)){
   const link=line.match(/\[[^\]]+\]\(#[^\s)]+\)/);
   if(link&&add(link[0])){
    const note=line.slice(line.indexOf(link[0])+link[0].length).trim();
    // Keep meaningful context without putting it into the task title.
    if(note&&!/^(?:(?:이|가|은|는)\s*)?(?:남아 있어요|있어요|예정이에요|진행 중이에요)[.!]?$/.test(note))output.push(note);
    continue;
   }
  }
  // Old task grouping headings are replaced with date-derived rows below.
  const heading=clean(line.replace(/^#+\s*/,''));
  if(['오늘 반드시','오늘','이번 주','이번주','미완료','나중에','날짜 없음','백로그','날짜 미정'].includes(heading)){
   const next=lines.slice(i+1).find(l=>l.trim());
   if(next&&(/^\s*\|/.test(next)||/^\s*[-*]\s+\[/.test(next)))continue;
  }
  output.push(line.replaceAll('오늘 꼭','오늘 반드시').replace(/참고\s*·\s*/g,'참고: ').replace(/날짜 미정/g,'날짜 없음'));
 }
 const order={overdue:0,today:1,week:2,later:3,undated:4};
 const values=[...selected.values()].map(v=>{
  const t=v.task,s=t?.schedule;
  const effective=s?.mode==='range'?(today<s.start?s.start:today>s.end?s.end:today):t?.scheduledDate;
  const date=t?(s?.mode==='range'?`${s.start} - ${s.end}`:t.scheduledDate||'날짜 없음'):(/^\d{4}-\d{2}-\d{2}/.test(v.date)?v.date:'확인 필요');
  const state=t?(t.status==='done'?'완료':t.doing?'진행 중':effective&&effective<today?'미완료':effective&&effective>today?'예정':'대기'):v.status||'확인 필요';
  const title=t?`[${cell(t.title).replace(/\[/g,'(').replace(/\]/g,')')}](#${encodeURIComponent(t.id)})`:cell(v.label);
  return {date,state,title,rank:order[scheduleGroup(effective,today)],sort:effective||''};
 }).sort((a,b)=>a.rank-b.rank||a.sort.localeCompare(b.sort));
 const table=['| 예정일 | 상태 | 할 일 |','| --- | --- | --- |',...values.map(v=>`| ${cell(v.date)} | ${cell(v.state)} | ${v.title} |`)].join('\n');
 return output.join('\n').replace(token,values.length?'\n\n'+table+'\n\n':'').replace(/\n{3,}/g,'\n\n').trim();
}
