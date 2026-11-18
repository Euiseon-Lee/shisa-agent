// Run with Node 24+ from windows/. Never opens the official database for writing.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../agent/src/store.ts';

const home=os.homedir();
const source=path.join(home,'.cy-agent');
const target=path.join(home,'.shisa-personal');
const desktopSource=path.join(process.env.APPDATA,'cy-agent-desktop');
const desktopTarget=desktopSource+'-47834';
const legacyAssets=process.argv.find(a=>a.startsWith('--assets='))?.slice(9);
if (!legacyAssets || !fs.statSync(legacyAssets).isDirectory()) throw new Error('Provide --assets=<official app resources/assets directory>');
for (const p of [target,desktopTarget]) if(fs.existsSync(p)) throw new Error(`Existing personal data retained: ${p}`);
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=path.join(home,'.shisa-migration-backups',stamp);
const staging=target+'-migration-'+stamp;
fs.mkdirSync(backup,{recursive:true});
fs.mkdirSync(staging);
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const live=new DatabaseSync(path.join(source,'cy.db'),{readOnly:true});
live.prepare('VACUUM INTO ?').run(path.join(backup,'cy.db'));
live.close();
// Copy all user content, excluding transient logs and SQLite live/WAL files.
const copyTree=(src,dst)=>fs.cpSync(src,dst,{recursive:true,filter:p=>{
  if(fs.lstatSync(p).isSymbolicLink()) throw new Error('Review symbolic link before migration: '+p);
  return true;
}});
for(const e of fs.readdirSync(source,{withFileTypes:true})) {
  if(['cy.db','cy.db-wal','cy.db-shm','logs'].includes(e.name))continue;
  copyTree(path.join(source,e.name),path.join(backup,e.name));
  copyTree(path.join(backup,e.name),path.join(staging,e.name));
}
fs.copyFileSync(path.join(backup,'cy.db'),path.join(staging,'cy.db'));
// Bundled 0.3.3 images stay outside the installer. Preserve user overrides.
copyTree(legacyAssets,path.join(backup,'official-assets'));
if(fs.existsSync(path.join(staging,'assets'))) {
  fs.cpSync(legacyAssets,path.join(staging,'assets'),{recursive:true,force:false});
} else copyTree(legacyAssets,path.join(staging,'assets'));
const configPath=path.join(staging,'config.json');
const remap=v=>typeof v==='string'&&(v===source||v.startsWith(source+path.sep))?target+v.slice(source.length):
  Array.isArray(v)?v.map(remap):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,remap(x)])):v;
if(fs.existsSync(configPath))fs.writeFileSync(configPath,JSON.stringify(remap(JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/,''))),null,2));
const original=new DatabaseSync(path.join(backup,'cy.db'),{readOnly:true});
const migrated=new Store(path.join(staging,'cy.db'));
const tables=original.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name);
const counts={};
for(const table of tables){
  const n=original.prepare(`SELECT count(*) AS n FROM ${quote(table)}`).get().n;
  const m=migrated.db.prepare(`SELECT count(*) AS n FROM ${quote(table)}`).get().n;
  assert.ok(m>=n,table+': row loss');counts[table]={before:n,after:m};
}
const identity='SELECT id,title,status,priority,created FROM todos ORDER BY id';
assert.deepEqual(migrated.db.prepare(identity).all(),original.prepare(identity).all());
assert.equal(migrated.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
assert.deepEqual(migrated.db.prepare('PRAGMA foreign_key_check').all(),[]);
migrated.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');migrated.db.close();original.close();
const desktopStage=path.join(backup,'desktop');fs.mkdirSync(desktopStage);
for(const name of ['state.json','sisa-ai.json']){
  const file=path.join(desktopSource,name);if(!fs.existsSync(file))continue;
  JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
  fs.copyFileSync(file,path.join(desktopStage,name));
}
const receipt={at:new Date().toISOString(),source,target,desktopTarget,backup,counts,notes:[
  'Official source retained unchanged; developer examples excluded.',
  'Old undated tasks remain undated except legacy Today entries migrated by Store.',
  'Progress history starts at migration; missing past intervals cannot be reconstructed.',
  'Official 0.3.3 transient notifications have no durable unread inbox to import.'
]};
fs.writeFileSync(path.join(staging,'migration-receipt.json'),JSON.stringify(receipt,null,2));
fs.writeFileSync(path.join(backup,'migration-receipt.json'),JSON.stringify(receipt,null,2));
// Publish only validated data. Never overwrite an existing personal profile.
fs.renameSync(staging,target);
copyTree(desktopStage,desktopTarget);
console.log(JSON.stringify({target,desktopTarget,backup,todos:counts.todos,focus:counts.focus_sessions}));
