import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { appUserModelId } from './squirrel.js';

// PNG-compressed ICO entries are supported by Windows Vista and later.
export function pngIcon(entries) {
  const header = Buffer.alloc(6 + entries.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  entries.forEach(({ size, png }, i) => {
    const at = 6 + i * 16;
    header[at] = header[at + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...entries.map(e => e.png)]);
}

export function shortcutBelongsTo(target, execPath) {
  if (typeof target !== 'string') return false;
  const w = path.win32, exe = w.resolve(execPath).toLowerCase(), candidate = w.resolve(target).toLowerCase();
  if (candidate === exe) return true;
  const dir = w.dirname(exe);
  if (!/^app-\d/.test(w.basename(dir))) return false;
  const root = w.dirname(dir);
  return w.basename(candidate) === w.basename(exe) &&
    (w.dirname(candidate) === root || (w.dirname(w.dirname(candidate)) === root && /^app-\d/.test(w.basename(w.dirname(candidate)))));
}

export function syncWindowsIcon({ image, userData, appData, desktop, execPath, shell, title }) {
  const ico = pngIcon([16, 24, 32, 48, 64, 128, 256].map(size => ({ size, png: image.resize({ width: size, height: size, quality: 'best' }).toPNG() })));
  const dir = path.join(userData, 'icons');
  fs.mkdirSync(dir, { recursive: true });
  const icon = path.join(dir, `character-${crypto.createHash('sha256').update(ico).digest('hex').slice(0, 16)}.ico`);
  if (!fs.existsSync(icon)) fs.writeFileSync(icon, ico);
  const installRoot = path.dirname(path.dirname(execPath));
  const launcher = path.join(installRoot, path.basename(execPath));
  const target = fs.existsSync(path.join(installRoot, 'Update.exe')) && fs.existsSync(launcher) ? launcher : execPath;
  const appId = appUserModelId(execPath);
  const scan = (folder, depth = 0) => {
    if (!folder || !fs.existsSync(folder) || depth > 4) return;
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
      if (item.isSymbolicLink()) continue;
      const file = path.join(folder, item.name);
      if (item.isDirectory()) { scan(file, depth + 1); continue; }
      if (!item.name.toLowerCase().endsWith('.lnk')) continue;
      try {
        const old = shell.readShortcutLink(file);
        if (!shortcutBelongsTo(old.target, execPath)) continue;
        if (old.icon === icon && old.target === target && old.appUserModelId === appId) continue;
        if (!shell.writeShortcutLink(file, 'update', { target, icon, iconIndex: 0, appUserModelId: appId })) throw Error('shortcut update failed');
      } catch (e) { console.warn('[app-icon] shortcut:', e?.message ?? e); }
    }
  };
  scan(path.join(appData, 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar'));
  scan(path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'));
  scan(desktop);
  return { appId, appIconPath: icon, appIconIndex: 0, relaunchCommand: `"${target}"`, relaunchDisplayName: title };
}
