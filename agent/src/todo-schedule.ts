export type TodoSchedule = { mode: 'range' | 'repeat'; start: string; end: string; days?: number[] };
export function validDay(v: unknown): v is string { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v; }
export function addScheduleDays(day: string, n: number): string { const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.getUTCFullYear()>9999?'9999-12-32':d.toISOString().slice(0,10); }
export function parseSchedule(v: unknown): TodoSchedule | null {
 if(v===null)return null;
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('invalid schedule');
 const s=v as TodoSchedule;
 if(!['range','repeat'].includes(s.mode)||!validDay(s.start)||!validDay(s.end)||s.end<=s.start)throw Error('종료일은 시작일 다음 날부터 선택해 주세요.');
 if(s.mode==='repeat'&&(!Array.isArray(s.days)||!s.days.length||s.days.some(d=>!Number.isInteger(d)||d<0||d>6)))throw Error('반복할 요일을 하나 이상 선택해 주세요.');
 return {mode:s.mode,start:s.start,end:s.end,...(s.mode==='repeat'?{days:[...new Set(s.days)].sort()}: {})};
}
export function scheduledViewDate(schedule: TodoSchedule | undefined, date: string | undefined, today: string): string | undefined { return schedule?.mode==='range' ? today<schedule.start?schedule.start:today>schedule.end?schedule.end:today : date; }
