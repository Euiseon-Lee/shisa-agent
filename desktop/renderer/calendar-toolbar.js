// 캘린더와 통계가 공유하는 기간 이동·보기 선택 도구 모음.
export function calendarToolbar({h,title,today,previous,next,viewLabel,views,view,onToday,onPrevious,onNext,onView,nextDisabled=false,loading=false,stat=false}) {
  const button=(cls,text,onclick,attrs={})=>h(`button${cls}`,{type:'button',text,onclick,...attrs});
  return h('div.cal-bar'+(stat?'.activity-toolbar':''),null,
    h('div.cal-nav'+(stat?'.activity-range':''),null,
      button('.ghost.cal-prev','‹',onPrevious,{'aria-label':previous,title:previous}),
      h('h2.cal-period',{text:title,'aria-live':'polite'}),
      button('.ghost.cal-next','›',onNext,{'aria-label':next,title:next,disabled:nextDisabled})),
    loading?h('span.cal-spin',{'aria-hidden':'true'}):null,
    h('span.spacer'),
    button('.cal-today',today,onToday),
    h('div.cal-seg', {role:'group','aria-label':viewLabel},views.map(({id,label})=>
      button(`.cal-seg-btn${view===id?'.on':''}`,label,()=>onView(id),{'aria-pressed':String(view===id),dataset:stat?{statPeriod:id}:{view:id}}))));
}
