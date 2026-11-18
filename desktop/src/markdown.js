import { notificationDate } from './notification-date.js';
import { userCopy } from './user-copy.js';
import { language } from './i18n.js';
// 마크다운 → HTML. marked 를 주입받는다(렌더러는 vendor/marked.js, 테스트는 같은 파일).
// 원시 HTML·이미지는 글자로만, 링크는 http/https/slack 만 살린다. 렌더러에서 DOMPurify 로 한 번 더 거른다.
import { isSafeLink } from './bubbles.js';
import { t as tr } from './i18n.js';

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// 콜아웃 종류 → 제목. GitHub 문법 `> [!NOTE]` 를 따른다.
export const CALLOUTS = {
  get NOTE() { return tr('panel.co_note'); }, get TIP() { return tr('panel.co_tip'); }, get IMPORTANT() { return tr('panel.co_important'); }, get WARNING() { return tr('panel.co_warning'); }, get CAUTION() { return tr('panel.co_caution'); },
};
// 글자색은 이 목록만 — `:red[글자]`
export const COLORS = ['red', 'green', 'blue', 'orange', 'purple', 'gray'];

export function createMarkdown(Marked) {
  const md = new Marked({ gfm: true, breaks: true, async: false });
  md.use({
    walkTokens(token) { if (token.type === 'text' && typeof token.text === 'string') token.text = userCopy(token.text); },
    // 한글 조사 앞 굵게: CommonMark는 `**이름(X)**야`처럼 닫는 ** 앞이 문장부호, 뒤가 글자면 닫지 않는다.
    // 같은 줄 안의 **…** 는 앞뒤 글자와 상관없이 굵게 처리한다.
    extensions: [{
      name: 'notificationDate',
      level: 'inline',
      start(src) { return src.indexOf(':date['); },
      tokenizer(src) {
        const match = /^:date\[(\d{4}-\d{2}-\d{2})\]/.exec(src);
        if (match && notificationDate(match[1])) return { type: 'notificationDate', raw: match[0], date: match[1] };
      },
      renderer(token) {
        const value = notificationDate(token.date, new Date(), language());
        return '<span class="notification-date">' + value.date + '<br><span class="notification-day">' + value.label + '</span></span>';
      },
    }, {
      // :red[글자] → 색 글자(허용 색만)
      name: 'colorText',
      level: 'inline',
      start(src) {
        const m = /:(red|green|blue|orange|purple|gray)\[/.exec(src);
        return m ? m.index : undefined;
      },
      tokenizer(src) {
        const m = /^:(red|green|blue|orange|purple|gray)\[([^\]\n]+)\]/.exec(src);
        if (!m) return undefined;
        return { type: 'colorText', raw: m[0], color: m[1], tokens: this.lexer.inlineTokens(m[2]) };
      },
      renderer(t) {
        return `<span class="c-${t.color}">${this.parser.parseInline(t.tokens)}</span>`;
      },
    }, {
      // ==형광펜==
      name: 'highlight',
      level: 'inline',
      start(src) {
        const i = src.indexOf('==');
        return i < 0 ? undefined : i;
      },
      tokenizer(src) {
        const m = /^==(?=\S)([^\n]*?\S)==/.exec(src);
        if (!m) return undefined;
        return { type: 'highlight', raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
      },
      renderer(t) {
        return `<mark>${this.parser.parseInline(t.tokens)}</mark>`;
      },
    }, {
      name: 'cjkStrong',
      level: 'inline',
      start(src) {
        const i = src.indexOf('**');
        return i < 0 ? undefined : i;
      },
      tokenizer(src) {
        const m = /^\*\*(?![\s*])([^\n]*?[^\s*])\*\*/.exec(src);
        if (!m) return undefined;
        return { type: 'strong', raw: m[0], text: m[1], tokens: this.lexer.inlineTokens(m[1]) };
      },
    }],
    renderer: {
      // > [!WARNING] … → 콜아웃 상자
      blockquote({ tokens }) {
        const body = this.parser.parse(tokens);
        const m = /^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br>\s*)?/i.exec(body);
        if (!m) return `<blockquote>${body}</blockquote>`;
        const kind = m[1].toUpperCase();
        const rest = body.slice(m[0].length).replace(/^<\/p>\s*/, '');
        const inner = m[0].endsWith('<p>') || rest.startsWith('<') ? rest : `<p>${rest}`;
        return `<div class="callout callout-${kind.toLowerCase()}"><div class="callout-title">${CALLOUTS[kind]}</div>${inner}</div>`;
      },
      html({ text }) {
        return escapeHtml(text);
      },
      image({ text }) {
        return escapeHtml(text);
      },
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        if (!isSafeLink(href)) return inner;
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        return `<a href="${escapeHtml(href)}"${t}>${inner}</a>`;
      },
    },
  });
  return (src) => (typeof src === 'string' && src ? md.parse(src) : '');
}
