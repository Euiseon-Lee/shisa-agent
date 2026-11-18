import { isTransientNotification } from './notification-retention.js';
import { normalizeBubble } from './bubbles.js';

const KEY = 'unread-notifications-v1';
const durable = (b) => b && !b.quick && !b.tour && !isTransientNotification(b);
const signature = (b) => JSON.stringify([b.id, b.kind, b.text, b.detail ?? '', b.image ?? '', b.actionId ?? '', b.proposalId ?? '']);

export class NotificationStore {
  constructor(storage) { this.storage = storage; this.acknowledged = new Map(); this.error = false; }
  restore(queue) {
    try {
      const saved = JSON.parse(this.storage.getItem(KEY) ?? 'null');
      if (!saved || saved.version !== 1) return;
      this.acknowledged = new Map((saved.acknowledged ?? []).filter((x) => Array.isArray(x) && x.length === 2 && x.every((v) => typeof v === 'string')));
      for (const raw of saved.items ?? []) {
        const b = normalizeBubble(raw);
        if (!durable(b)) continue;
        if (raw.decided === true) b.decided = true;
        if (typeof raw.note === 'string') b.note = raw.note;
        if (typeof raw.panelSection === 'string' && ['overview','projects','todos','today','chat','setup','models'].includes(raw.panelSection)) b.panelSection = raw.panelSection;
        b.pending = false;
        b.thinking = false;
        if (this.accepts(b)) queue.add(b);
      }
      if (queue.items.some((b) => b.id === saved.selectedId)) queue.selectedId = saved.selectedId;
    } catch { this.error = true; }
  }
  accepts(b) { return !durable(b) || this.acknowledged.get(b.id) !== signature(b); }
  acknowledge(b) { if (durable(b)) this.acknowledged.set(b.id, signature(b)); }
  save(queue) {
    try {
      const items = queue.items.filter(durable).map(({ pending, thinking, ...b }) => b);
      this.storage.setItem(KEY, JSON.stringify({ version: 1, items, selectedId: queue.selectedId, acknowledged: [...this.acknowledged] }));
      this.error = false;
      return true;
    } catch { this.error = true; return false; }
  }
}
