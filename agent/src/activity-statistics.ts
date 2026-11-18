import type { DatabaseSync } from 'node:sqlite';

// The explicit "in progress" flag is historical state, not a scheduled-date inference.
export function installActivityTracking(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS todo_work_intervals (id INTEGER PRIMARY KEY, todo_id TEXT NOT NULL, started INTEGER NOT NULL, ended INTEGER);
    CREATE UNIQUE INDEX IF NOT EXISTS todo_work_active ON todo_work_intervals(todo_id) WHERE ended IS NULL;
    CREATE INDEX IF NOT EXISTS todo_work_dates ON todo_work_intervals(started, ended);
    CREATE TABLE IF NOT EXISTS statistics_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT OR IGNORE INTO statistics_meta VALUES ('doing_history_since', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    INSERT OR IGNORE INTO todo_work_intervals(todo_id, started)
      SELECT id, CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) FROM todos WHERE status='open' AND doing=1;
    CREATE TRIGGER IF NOT EXISTS todo_work_insert AFTER INSERT ON todos WHEN NEW.status='open' AND NEW.doing=1
    BEGIN INSERT OR IGNORE INTO todo_work_intervals(todo_id,started) VALUES(NEW.id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)); END;
    CREATE TRIGGER IF NOT EXISTS todo_work_start AFTER UPDATE OF doing,status ON todos
      WHEN NEW.status='open' AND NEW.doing=1 AND NOT(OLD.status='open' AND coalesce(OLD.doing,0)=1)
    BEGIN INSERT OR IGNORE INTO todo_work_intervals(todo_id,started) VALUES(NEW.id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)); END;
    CREATE TRIGGER IF NOT EXISTS todo_work_end AFTER UPDATE OF doing,status ON todos
      WHEN NEW.status<>'open' OR coalesce(NEW.doing,0)<>1
    BEGIN UPDATE todo_work_intervals SET ended=MAX(started,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) WHERE todo_id=NEW.id AND ended IS NULL; END;
    CREATE TRIGGER IF NOT EXISTS todo_work_delete AFTER DELETE ON todos
    BEGIN DELETE FROM todo_work_intervals WHERE todo_id=OLD.id; END;
  `);
}
const dateKey=(ms:number)=>{const d=new Date(ms);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const startOf=(day:string)=>{const [y,m,d]=day.split('-').map(Number);return new Date(y,m-1,d).getTime();};
const nextDay=(ms:number)=>{const d=new Date(ms);return new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).getTime();};
export function activityStatistics(db: DatabaseSync, from:string, to:string, now:number) {
  const first=startOf(from), end=nextDay(startOf(to));
  const rows=db.prepare('SELECT start,end,open FROM focus_spans WHERE start < ? AND (end > ? OR open=1)').all(end,first) as any[];
  const done=db.prepare("SELECT id,title,done_at FROM todos WHERE status='done' AND julianday(done_at)>=julianday(?) AND julianday(done_at)<julianday(?) ORDER BY done_at").all(new Date(first).toISOString(),new Date(Math.min(end,now+1)).toISOString()) as any[];
  const work=db.prepare("SELECT w.todo_id AS id,t.title,w.started,w.ended FROM todo_work_intervals w JOIN todos t ON t.id=w.todo_id WHERE t.status IN ('open','done') AND w.started < ? AND (w.ended > ? OR w.ended IS NULL) ORDER BY w.started,t.id").all(end,first) as any[];
  const days=[];
  for(let a=first;a<end;a=nextDay(a)) {
    const date=dateKey(a), d=new Date(a), noon=new Date(d.getFullYear(),d.getMonth(),d.getDate(),12).getTime(), z=nextDay(a);
    let am=0,pm=0;
    for(const row of rows){const b=Math.min(row.open?Math.max(row.end,now):row.end,now);am+=Math.max(0,Math.min(b,noon)-Math.max(row.start,a));pm+=Math.max(0,Math.min(b,z)-Math.max(row.start,noon));}
    const completed=done.filter(t=>dateKey(Date.parse(t.done_at))===date).map(t=>({id:t.id,title:t.title,doneAt:t.done_at}));
    const completedIds=new Set(completed.map(t=>t.id));
    const doing=[...new Map(work.filter(w=>w.started<Math.min(z,now+1)&&(w.ended??now+1)>a&&!completedIds.has(w.id)).map(w=>[w.id,{id:w.id,title:w.title}])).values()];
    days.push({date,amSeconds:Math.floor(am/1000),pmSeconds:Math.floor(pm/1000),completed,doing});
  }
  const meta=db.prepare("SELECT value FROM statistics_meta WHERE key='doing_history_since'").get() as any;
  return {days,doingHistorySince:meta?.value??null};
}
