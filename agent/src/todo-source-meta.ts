import type { Store, Todo } from './store.ts';
import type { Config } from './config.ts';
import { readMailItems } from './mail-sync.ts';
import { mailRef } from './mail-pick.ts';
// Never infer an account from a title, sender domain, or the number of connected accounts.
export function sourceMetadata(store: Store, cfg: Config) {
 const mail=cfg.connectors.mail;
 const accounts=mail.mode==='imap' ? mail.accounts : [];
 const byRef=new Map<string,Set<string>>();
 for(const m of readMailItems(store)) if(m.account) {const ref=mailRef(m); const set=byRef.get(ref)||new Set<string>();set.add(m.account.toLowerCase());byRef.set(ref,set);}
 return (t: Pick<Todo,'id'|'source'|'sourceRef'|'origin'>) => {
  const refs=[t.sourceRef,t.origin?.ref,t.id].filter((r):r is string=>!!r);
  if(t.source==='session') {const tool=refs.map(r=>store.node(r)?.props.tool).find(x=>x==='claude'||x==='codex') || t.origin?.tool;return tool==='claude'||tool==='codex' ? {sourceTool:tool} : {};}
  if(t.source==='mail') {const found=new Set<string>();for(const r of refs) for(const a of byRef.get(r)||[]) found.add(a); if(t.origin?.account) found.add(t.origin.account.toLowerCase());if(found.size!==1)return found.size===0 && (t.origin?.purpose==="work" || t.origin?.purpose==="personal") ? {mailPurpose:t.origin.purpose} : {};const account=accounts.find(a=>a.user.toLowerCase()===[...found][0]);return account?.purpose ? {mailPurpose:account.purpose} : {};}
  return {};
 };
}
