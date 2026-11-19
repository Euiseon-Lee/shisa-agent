// Keep related words together, allowing wrapping only between meaning groups.
const groups = new Map([
  ['집중 기록이 있는 날', ['집중 기록이', '있는 날']],
  ['하루 평균 집중 시간', ['하루 평균', '집중 시간']],
  ['예정된 할 일', ['예정된', '할 일']],
  ['진행 중 프로젝트', ['진행 중', '프로젝트']],
  ['승인 대기 코드', ['승인 대기', '코드']],
]);
export function metricLabel(h, title) {
  const parts = groups.get(title);
  if (!parts) return h('span.muted', { text: title });
  return h('span.muted.metric-label', null,
    ...parts.flatMap((text, i) => [i ? ' ' : '', h('span.metric-label-part', { text })]));
}
