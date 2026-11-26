import { metricLabel } from './metric-label.js';
import { numericDate, dateRange } from '../src/date-format.js';
import { calendarToolbar } from './calendar-toolbar.js';
import { localDay, rangeOf, shiftAnchor, monthGrid, addDays, parseDay, fmtDuration } from '../src/focus.js';

// Both charts and the detail card share one range and one selected date.
export function createStatisticsView({h,cy,root}) {
  let period='week', anchor=localDay(Date.now()), picked=anchor, data=null, error='', seq=0, pending=false;
  const today=()=>localDay(Date.now());
  const label=d=>numericDate(d,{weekday:true,compact:true});
  const button=(text,fn,props={})=>h('button',{type:'button',text,onclick:fn,...props});
  const sized=(selector,property,value,...children)=>{const el=h(selector,null,...children);el.style[property]=value;return el;};
  const metric=(title,value,cls='')=>{
    const number=h('strong',{text:String(value)});
    return h('div.card.stat-metric'+cls,null,metricLabel(h,title),number);
  };
  async function refresh() {
    const ticket=++seq, r=rangeOf(period,anchor);pending=true;error='';draw();
    try {
      const res=await cy.focusStats?.(r.from,r.to);
      if(ticket!==seq)return;
      if(!res?.ok||!res.data?.activity)throw Error('unavailable');
      data=res.data;
    } catch {if(ticket!==seq)return;data=null;error='기록을 불러오지 못했어요. 다시 시도해 주세요.';}
    pending=false;draw();
  }
  function change(nextPeriod,nextAnchor) {
    period=nextPeriod;anchor=nextAnchor;
    const r=rangeOf(period,anchor);
    if(picked<r.from||picked>r.to)picked=r.to<today()?r.to:today();
    data=null;refresh();
  }
  function draw() {
    const r=rangeOf(period,anchor), now=today(), days=data?.activity.days||[];
    const byDay=new Map(days.map(d=>[d.date,d]));
    const cells=period==='month'?monthGrid(r.from,r.to).flat():Array.from({length:7},(_,i)=>addDays(r.from,i));
    const focusMax=8*3600; // Fixed daily reference across all weeks.
    function donut(d,hidden) {
      const am=d?.amSeconds||0,pm=d?.pmSeconds||0,total=am+pm;
      const denominator=Math.max(focusMax,total),amEnd=am/denominator*100,end=total/denominator*100;
      const ring=h('span.activity-donut'+(hidden?'.empty':''),{'aria-hidden':'true'},h('span.activity-percent',{text:hidden?'':(Math.round(total/focusMax*1000)/10)+'%'}));
      ring.style.backgroundImage='conic-gradient(var(--focus-am) 0% '+amEnd+'%, var(--focus-pm) '+amEnd+'% '+end+'%, var(--focus-ring-track) '+end+'% 100%)';
      return ring;
    }
    function completionChart() {
      let total=0;
      const points=cells.map((date,index)=>{
        const count=byDay.get(date)?.completed.length||0;
        if(date<=now)total+=count;
        return {date,index,count,total,visible:date<=now&&!!data};
      });
      const scale=Math.max(1,...points.filter(p=>p.visible).map(p=>p.count));
      const y=p=>116-p.count/scale*82;
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 700 150');svg.setAttribute('preserveAspectRatio','none');
      svg.setAttribute('class','completion-line');svg.setAttribute('aria-hidden','true');
      const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');
      line.setAttribute('points',points.filter(p=>p.visible).map(p=>(50+p.index*100)+','+y(p)).join(' '));
      line.setAttribute('vector-effect','non-scaling-stroke');svg.append(line);
      return h('section.card.activity-chart',{'aria-label':'할 일 완료 기록'},
        h('div.activity-chart-heading',null,h('h3',{text:'할 일 완료 기록'}),h('span.muted.small',{text:data?'총 완료 '+total+'개':''})),
        h('div.activity-scroll',{role:'region','aria-label':'할 일 완료 날짜별 기록',tabindex:'0'},h('div.completion-plot',null,svg,h('div.activity-grid.week.completion-grid',null,points.map(p=>{
          const marker=h('span.completion-marker',null,h('span.completion-node-value',{text:p.count+'개'}),h('span.completion-dot'));
          marker.style.top=(y(p)/150*100)+'%';
          return h('button.activity-day.completion-day'+(p.date===picked?'.selected':'')+(p.date>now?'.future':''),{
            type:'button',disabled:!p.visible,'data-stat-date':p.date,'data-chart':'done','data-daily-count':p.visible?String(p.count):'',
            'aria-pressed':String(p.date===picked),'aria-label':label(p.date)+(p.visible?' 완료 '+p.count+'개':''),
            title:p.visible?'완료 '+p.count+'개':label(p.date),onclick:()=>{picked=p.date;draw();}
          },h('span.completion-node-area',null,p.visible?marker:null),h('span.activity-date',{text:label(p.date)}));
        })))));
    }
    function chart(kind,title) {
      return h('section.card.activity-chart',{'aria-label':title},h('div.activity-chart-heading',null,h('h3',{text:title}),h('span.muted.small',{text:'하루 8시간 기준 / 오전: 연보라 / 오후: 보라'})),
        h('div.activity-scroll',{role:'region','aria-label':title+' 날짜별 기록',tabindex:'0'},h('div.activity-grid.focus-grid.'+period,null,cells.map(date=>{
          if(!date)return h('div.activity-placeholder',{'aria-hidden':'true'});
          const d=byDay.get(date), future=date>now, value=(d?.amSeconds||0)+(d?.pmSeconds||0);
          const valueText=future||!data?'':fmtDuration(value);
          return h('button.activity-day'+(date===picked?'.selected':'')+(future?'.future':''),{type:'button',disabled:future||!data,'data-stat-date':date,'data-chart':kind,'aria-pressed':String(date===picked),'aria-label':label(date)+(future?'':` ${valueText}`)+(!future&&data?` 8시간 기준 ${Math.round(value/focusMax*1000)/10}%`:'')+(period==='month'&&!future&&data?` 완료 ${d?.completed.length||0}개`:''),onclick:()=>{picked=date;draw();}},
            donut(d,future||!data),h('span.activity-value',{text:valueText}),
            period==='month'?h('span.activity-month-focus',{text:future||!data?'':`완료 ${d?.completed.length||0}개`}):null,h('span.activity-date',{text:label(date)}));
        }))));
    }
    const d=byDay.get(picked), completed=days.reduce((n,d)=>n+d.completed.length,0), focus=days.reduce((n,d)=>n+d.amSeconds+d.pmSeconds,0);
    const list=(title,items,empty)=>h('section.activity-task-list',null,h('h4',{text:`${title} ${items.length}개`}),items.length?h('ul',null,items.map(t=>h('li',null,h('span',{text:t.title}),t.doneAt?h('time.muted.small',{text:new Date(t.doneAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}):null))):h('p.muted.small',{text:empty}));
    root.replaceChildren(
      calendarToolbar({h,stat:true,title:period==='month'?`${Number(r.from.slice(0,4))}년 ${Number(r.from.slice(5,7))}월`:dateRange(r.from,r.to,{long:true}),
        today:'오늘',previous:'이전 기간',next:'다음 기간',viewLabel:'통계 기간',views:[{id:'week',label:'주'},{id:'month',label:'월'}],view:period,
        onToday:()=>{picked=now;change(period,now);},onPrevious:()=>change(period,shiftAnchor(period,anchor,-1)),onNext:()=>change(period,shiftAnchor(period,anchor,1)),
        onView:p=>change(p,picked),nextDisabled:rangeOf(period,shiftAnchor(period,anchor,1)).from>now}),
      pending?h('p.muted.small',{role:'status',text:'기록을 불러오고 있어요.'}):error?h('div',{role:'alert'},h('span',{text:error}),button('다시 시도',refresh)):h('div.stats-metrics',null,metric('총 완료 개수',`${completed}개`),metric('총 집중 시간',fmtDuration(focus)),metric('집중 기록이 있는 날',`${days.filter(d=>d.amSeconds+d.pmSeconds>0).length}일`),metric('하루 평균 집중 시간',fmtDuration(Math.floor(focus/Math.max(1,days.filter(d=>d.date<=now).length))))),
      period==='month'?chart('focus','월간 활동 기록'):completionChart(),...(period==='month'?[]:[chart('focus','집중 기록')]),
      h('section.card.activity-detail',{'aria-label':'일별 기록'},h('h3',{text:`${numericDate(picked,{weekday:true})} 하루 기록`}),h('p.muted.small',{text:'위 기록에서 날짜를 선택하면 해당 날짜의 기록을 볼 수 있어요.'}),
        !d?h('p.muted',{text:pending?'기록을 불러오고 있어요.':'기록을 불러온 뒤 확인할 수 있어요.'}):h('div',null,
          h('div.activity-halves',null,metric('오전 집중 시간',fmtDuration(d.amSeconds),'.focus-am-card'),metric('오후 집중 시간',fmtDuration(d.pmSeconds),'.focus-pm-card')),
          h('div.activity-tasks',null,list('완료',d.completed,'이날 완료한 할 일이 없어요.'),list('진행 중',d.doing,'이날 진행 중으로 기록된 할 일이 없어요.')),
          h('p.muted.small',{text:'완료한 할 일은 완료 처리한 날짜에 표시해요. 진행 중은 이날 진행 중 상태였던 할 일이며, 이날 완료한 항목은 완료에만 표시해요.'}),
          null)));
  }
  // Focus events are frequent. Batch them, and only refresh the visible statistics.
  let timer=null;
  cy.onFocus?.(()=>{if(timer)return;timer=setTimeout(()=>{timer=null;if(!root.hidden&&root.offsetParent!==null)refresh();},1000);});
  return {refresh, show() { anchor=today(); picked=anchor; data=null; return refresh(); }};
}
