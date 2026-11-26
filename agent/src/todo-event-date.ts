import { addScheduleDays, validDay } from './todo-schedule.ts';

export type EventDates = { eventDate?: string; responseDueDate?: string; recommendedDate?: string; dateKind?: 'deadline' | 'recommended'; scheduledDate?: string };

// Conservative fallback for dated invitations. Anchor omitted years to creation,
// not to the viewing date, so a historical invitation never moves into a new year.
export function invitationDates(t: { title: string; description?: string; note?: string; created: string; scheduledDate?: string; schedule?: unknown; dateManual?: boolean }): EventDates {
  if (t.schedule || !/(초대|참석).*(응답|회신|여부)|RSVP/i.test(t.title)) return {};
  const token = '(?:(\\d{4})[년./-]\\s*)?(\\d{1,2})[월./-]\\s*(\\d{1,2})(?:일)?';
  const match = new RegExp(token).exec(t.title);
  if (!match) return {};
  const anchor = t.created.slice(0,10);
  if (!validDay(anchor)) return {};
  const dateOf = (m: RegExpExecArray, base: string) => {
    let year = Number(m[1] || base.slice(0,4));
    if (!m[1] && Number(base.slice(5,7)) === 12 && Number(m[2]) === 1) year++;
    const day = `${year}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    return validDay(day) ? day : undefined;
  };
  const eventDate = dateOf(match, anchor);
  if (!eventDate) return {};
  const text = [t.title,t.description,t.note].filter(Boolean).join('\n');
  const deadline = new RegExp('(?:응답|회신|RSVP)\\s*(?:마감|기한)\\s*[:：]?\\s*' + token, 'i').exec(text);
  const responseDueDate = deadline ? dateOf(deadline, anchor) : undefined;
  // Ambiguous deadline wording requires review instead of inventing a deadline.
  const ambiguous = /(?:응답|회신|RSVP)\s*(?:마감|기한)/i.test(text) && !responseDueDate;
  const recommendedDate = !responseDueDate && !ambiguous ? addScheduleDays(eventDate,-2) : undefined;
  return {eventDate, ...(responseDueDate ? {responseDueDate} : {}), ...(recommendedDate ? {recommendedDate} : {}),
    ...(!t.scheduledDate && !t.dateManual && (responseDueDate || recommendedDate) ? {scheduledDate:responseDueDate || recommendedDate, dateKind:responseDueDate ? 'deadline' as const : 'recommended' as const} : {})};
}
