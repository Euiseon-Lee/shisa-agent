export function recurrenceLabel(schedule) {
 const days=[1,2,3,4,5,6,0].filter(d=>schedule?.days?.includes(d));
 if(days.length===7)return '매일';
 if(days.join(',')==='1,2,3,4,5')return '평일';
 if(days.join(',')==='6,0')return '주말';
 return days.length ? '매주 '+days.map(d=>['일','월','화','수','목','금','토'][d]).join('·')+'요일' : '반복';
}
export function recurrenceSummary(t,today) {
 const label=recurrenceLabel(t.schedule);
 const short=date=>Number(date.slice(5,7))+'/'+Number(date.slice(8,10));
 if(label==='매일')return label+(t.schedule.start>today?' · 시작 '+short(t.schedule.start):'');
 return label+(t.nextDate?' · 다음 '+short(t.nextDate):'');
}
