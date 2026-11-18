// 저장된 안내도 현재 화면 용어로 보여 준다.
export function userCopy(value) {
  return String(value ?? '').replaceAll('남은 할 일','예정된 할 일')
    .replaceAll('대기 중 제안','승인 대기 중 코드')
    .replace(/오늘 (?:예정된 할 일|반드시 처리할 일) (\d+)건/g,'오늘 할 일 $1건');
}
