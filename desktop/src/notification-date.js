export function notificationDate(date, now = new Date(), lang = 'ko') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y,m,d] = date.split('-').map(Number);
  const day = new Date(y,m-1,d,12);
  if (day.getFullYear() !== y || day.getMonth() !== m-1 || day.getDate() !== d) return null;
  const today = y === now.getFullYear() && m === now.getMonth()+1 && d === now.getDate();
  const weekdays = lang === 'ja' ? ['日','月','火','水','木','金','土'] : ['일','월','화','수','목','금','토'];
  return { date: (y!==now.getFullYear()?y+'/':'')+date.slice(5).replace('-', '/'), label: today ? (lang === 'ja' ? '今日' : '오늘') : weekdays[day.getDay()]+(lang==='ja'?'曜日':'요일') };
}
