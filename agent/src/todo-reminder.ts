export type TodoReminder = { time:string; daysBefore:0|1 };
export function parseTodoReminder(value:unknown):TodoReminder|null {
 if(value===null)return null;
 if(!value || typeof value!=='object' || Array.isArray(value))throw Error('invalid reminder');
 const r=value as Record<string,unknown>;
 if(Object.keys(r).some(k=>!['time','daysBefore'].includes(k)) || typeof r.time!=='string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) || (r.daysBefore!==0 && r.daysBefore!==1))throw Error('reminder requires time HH:MM and daysBefore 0 or 1');
 return {time:r.time,daysBefore:r.daysBefore};
}
