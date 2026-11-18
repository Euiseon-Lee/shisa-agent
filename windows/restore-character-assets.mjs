// Restore locally owned legacy media without migrating or overwriting user data.
// node windows/restore-character-assets.mjs --assets=<old resources/assets>
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { ALLOWED } from '../desktop/src/assets.js';

export function restoreCharacterAssets(source, target) {
  const src = fs.realpathSync(source);
  const dst = path.resolve(target);
  let copied = 0, retained = 0;
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  for (const rel of ALLOWED.keys()) {
    const from = path.join(src, rel);
    if (!fs.existsSync(from)) continue;
    if (!fs.statSync(from).isFile() || fs.realpathSync(from) !== from) throw Error(`Unsafe source: ${from}`);
    const to = path.join(dst, rel);
    if (fs.existsSync(to)) { retained++; continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (fs.realpathSync(path.dirname(to)) !== path.dirname(to)) throw Error(`Unsafe destination: ${to}`);
    fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
    if (hash(from) !== hash(to)) throw Error(`Copy verification failed: ${rel}`);
    copied++;
  }
  if (!copied && !retained) throw Error('No supported character media found in source');
  return { source: src, target: dst, copied, retained };
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const source = process.argv.find(a => a.startsWith('--assets='))?.slice(9);
  if (!source) throw Error('Provide --assets=<old app resources/assets directory>');
  console.log(JSON.stringify(restoreCharacterAssets(source, path.join(os.homedir(), '.shisa-personal', 'assets')), null, 2));
}
