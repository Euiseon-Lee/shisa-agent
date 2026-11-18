import { language } from './lang.js';

const pad = n => String(n).padStart(2, '0');
export function dateParts(value) {
  const d = value instanceof Date ? value : /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}
export function numericDate(value, { year, now = new Date(), weekday = false, compact = false } = {}) {
  const d = dateParts(value);
  if (!d) return '';
  const includeYear = year ?? d.getFullYear() !== now.getFullYear();
  const date = `${includeYear ? d.getFullYear() + '/' : ''}${pad(d.getMonth()+1)}/${pad(d.getDate())}`;
  if (!weekday) return date;
  const day = new Intl.DateTimeFormat(language() === 'ja' ? 'ja-JP' : 'ko-KR', {weekday:compact?'short':'long'}).format(d);
  return `${date} ${compact ? '('+day+')' : day}`;
}
export function longDate(value, { year = true, weekday = false } = {}) {
  const d = dateParts(value);
  if (!d) return '';
  const ja = language() === 'ja';
  const text = ja ? `${year?d.getFullYear()+'年':''}${d.getMonth()+1}月${d.getDate()}日` : `${year?d.getFullYear()+'년 ':''}${d.getMonth()+1}월 ${d.getDate()}일`;
  return text + (weekday ? ' '+new Intl.DateTimeFormat(ja?'ja-JP':'ko-KR',{weekday:'long'}).format(d) : '');
}
export function dateRange(from, to, { long = false, now = new Date() } = {}) {
  const a=dateParts(from), b=dateParts(to);
  if (!a || !b) return '';
  const differentYear=a.getFullYear()!==b.getFullYear();
  if (long) return `${longDate(a)} ~ ${longDate(b,{year:differentYear})}`;
  const year=differentYear || a.getFullYear()!==now.getFullYear();
  return `${numericDate(a,{year})} ~ ${numericDate(b,{year})}`;
}
export function fullDateTime(value) {
  const d=dateParts(value);
  return d ? `${longDate(d,{weekday:true})} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
}
