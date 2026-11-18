const names = {
  ko: { user:'직접 입력', calendar:'캘린더', mail:'메일', slack:'슬랙', session:'작업 세션', commit:'커밋', github:'깃허브', issues:'이슈', jira:'지라', linear:'리니어', notion:'노션', teams:'팀즈', chat:'대화', briefing:'브리핑', local:'로컬 기록', ai:'인공지능 추천', other:'기타' },
  ja: { user:'手動入力', calendar:'カレンダー', mail:'メール', slack:'スラック', session:'作業セッション', commit:'コミット', github:'ギットハブ', issues:'課題', jira:'ジラ', linear:'リニア', notion:'ノーション', teams:'チームズ', chat:'会話', briefing:'ブリーフィング', local:'ローカル記録', ai:'AI提案', other:'その他' },
};
const aliases = { manual:'user', email:'mail', gmail:'mail', outlook:'mail', sessions:'session', commits:'commit', issue:'issues', gcal:'calendar' };
export function notificationSource(source, lang='ko') {
  const text=String(source??'').trim();
  const key=text.toLowerCase();
  const labels=names[lang]??names.ko;
  return labels[aliases[key]??key] ?? (/[가-힣ぁ-んァ-ヶ一-龯]/.test(text) ? text : labels.other);
}
