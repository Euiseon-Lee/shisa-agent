import { language } from './i18n.js';
export function todoSourceLabel(todo, lang=language()) {
  const ja=lang==='ja', source=todo?.source || todo?.kind;
  if(source==='session') return todo.sourceTool==='claude' || todo.tool==='claude' ? 'Claude Code' : todo.sourceTool==='codex' || todo.tool==='codex' ? 'Codex' : 'AI';
  if(source==='mail') {const p=todo.mailPurpose || todo.purpose; return p==='work' ? (ja?'仕事メール':'업무 메일') : p==='personal' ? (ja?'個人メール':'개인 메일') : (ja?'メール':'메일');}
  return ({calendar:ja?'カレンダー':'캘린더',slack:'Slack',commit:ja?'コード変更':'코드 변경',jira:'Jira',user:ja?'手動入力':'직접 입력'})[source] || (ja?'その他':'기타');
}
export const mailPurposeOptions = (lang=language()) => lang==='ja' ? [['','用途未指定'],['work','仕事用'],['personal','個人用']] : [['','용도 미지정'],['work','업무용'],['personal','개인용']];
