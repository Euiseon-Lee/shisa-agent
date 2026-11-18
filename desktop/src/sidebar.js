export const OPTIONAL_TABS = ['projects', 'calendar', 'todos', 'today', 'statistics', 'chat', 'models'];
export function panelStartSection(saved, shown, { firstRun = false } = {}) {
  if (firstRun) return 'overview';
  if (saved && shown.includes(saved)) return saved;
  return ['todos', 'today', 'overview'].find(key => shown.includes(key)) ?? 'overview';
}
export function sidebarPrefs(value) {
  return {...Object.fromEntries(OPTIONAL_TABS.map(k => [k, typeof value?.[k] === 'boolean' ? value[k] : k !== 'today'])),order:sidebarOrder(value?.order)};
}
export function validSidebarPatch(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0 && Object.entries(value).every(([k,v]) => k === 'order' ? Array.isArray(v) && v.length === OPTIONAL_TABS.length && new Set(v).size === v.length && v.every(x=>OPTIONAL_TABS.includes(x)) : OPTIONAL_TABS.includes(k) && typeof v === 'boolean');
}
export function shownSidebar(sections, value) { const prefs=sidebarPrefs(value); return [...sections.filter(k=>!OPTIONAL_TABS.includes(k)), ...prefs.order.filter(k=>sections.includes(k)&&prefs[k])]; }

export function sidebarOrder(value) { const known=Array.isArray(value)?[...new Set(value.filter(k=>OPTIONAL_TABS.includes(k)))]:[];return [...known,...OPTIONAL_TABS.filter(k=>!known.includes(k))]; }
export function moveSidebarTab(order,key,direction) {const next=sidebarOrder(order),at=next.indexOf(key),to=at+direction;if(at<0||to<0||to>=next.length||![-1,1].includes(direction))return next;[next[at],next[to]]=[next[to],next[at]];return next;}
