#!/usr/bin/env node
/**
 * Pakkauslista Database Manager - Menu-driven CLI
 * Navigate with numbers, no arguments needed.
 */

import { db, ref, get, set, remove, update } from './db.js';
import { createInterface } from 'readline';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function randomPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function normPath(p) {
  if (!p || p === '.' || p === '/') return '';
  return p.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
}

async function getAt(path) {
  const p = normPath(path);
  const r = ref(db, p || '/');
  const snap = await get(r);
  return snap.exists() ? snap.val() : null;
}

async function setAt(path, value) {
  const p = normPath(path) || '/';
  await set(ref(db, p), value);
}

async function removeAt(path) {
  const p = normPath(path);
  if (!p) throw new Error('Cannot remove root');
  await remove(ref(db, p));
}

function treeify(obj, prefix = '', depth = 0, maxDepth = 8) {
  if (depth > maxDepth) return prefix + '...\n';
  if (obj === null || obj === undefined) return prefix + 'null\n';
  if (typeof obj !== 'object') return prefix + JSON.stringify(obj) + '\n';
  const entries = Object.entries(obj);
  if (entries.length === 0) return prefix + '{}\n';
  let out = '';
  entries.forEach(([key, val], i) => {
    const isLast = i === entries.length - 1;
    const branch = isLast ? '└── ' : '├── ';
    const nextPrefix = prefix + (isLast ? '    ' : '│   ');
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length > 0) {
      out += prefix + branch + C.cyan(key) + '/\n';
      out += treeify(val, nextPrefix, depth + 1, maxDepth);
    } else {
      const str = typeof val === 'string' ? `"${val}"` : JSON.stringify(val);
      out += prefix + branch + C.cyan(key) + ' ' + C.dim(str) + '\n';
    }
  });
  return out;
}

// --- Menu helpers ---
function clear() {
  console.clear?.() || console.log('\n'.repeat(2));
}

function ask(rl, question, defaultValue = '') {
  const prompt = defaultValue ? `${question} [${defaultValue}]: ` : question + ': ';
  return new Promise((res) => rl.question(prompt, (a) => res((a || defaultValue).trim())));
}

function showMenu(title, items, backLabel = '0. Back') {
  console.log('\n' + C.bold(title) + '\n');
  items.forEach(([key, label]) => console.log(`  ${key}. ${label}`));
  console.log('\n  ' + C.dim(backLabel));
  console.log('');
}

// --- Users ---
async function usersList(rl) {
  clear();
  console.log(C.bold('Users\n'));
  const data = await getAt('users');
  if (!data) {
    console.log(C.dim('No users.'));
    return;
  }
  const list = Object.entries(data).map(([uuid, v]) => ({ uuid, ...v }));
  list.forEach((u, i) => {
    console.log(`  ${i + 1}. ${C.cyan(u.name)} (${u.uuid})`);
    console.log(`     PIN: ${u.pin}`);
  });
  console.log('');
}

async function usersAdd(rl) {
  clear();
  console.log(C.bold('Add User\n'));
  const name = await ask(rl, 'Name');
  if (!name) {
    console.log(C.red('Name required'));
    return;
  }
  const pinInput = await ask(rl, 'PIN (Enter for random 4-digit)', '');
  let pin;
  if (!pinInput) {
    pin = randomPin();
    console.log(C.green('Generated PIN:'), pin);
  } else {
    pin = String(pinInput).replace(/\D/g, '').slice(0, 4);
    if (pin.length !== 4) {
      console.log(C.red('PIN must be 4 digits'));
      return;
    }
  }
  const uuid = crypto.randomUUID();
  await set(ref(db, `users/${uuid}`), { name: name.trim(), pin });
  console.log(C.green('\nUser added:'), uuid);
  console.log(C.dim('  Name:'), name);
  console.log(C.dim('  PIN:'), pin);
}

async function usersEdit(rl) {
  const data = await getAt('users');
  if (!data) {
    console.log(C.dim('No users.'));
    return;
  }
  const list = Object.entries(data).map(([uuid, v]) => ({ uuid, ...v }));
  clear();
  console.log(C.bold('Edit User\n'));
  list.forEach((u, i) => console.log(`  ${i + 1}. ${u.name} (${u.uuid})`));
  console.log('  0. Back\n');
  const choice = await ask(rl, 'Select user');
  if (choice === '0' || !choice) return;
  const idx = parseInt(choice, 10) - 1;
  if (idx < 0 || idx >= list.length) {
    console.log(C.red('Invalid choice'));
    return;
  }
  const user = list[idx];
  const newName = await ask(rl, 'Name', user.name);
  const pinInput = await ask(rl, 'PIN (Enter to keep current)', '');
  const updates = { name: newName.trim() };
  if (pinInput) {
    const pin = String(pinInput).replace(/\D/g, '').slice(0, 4);
    if (pin.length !== 4) {
      console.log(C.red('PIN must be 4 digits'));
      return;
    }
    updates.pin = pin;
  }
  await update(ref(db, `users/${user.uuid}`), updates);
  console.log(C.green('\nUser updated'));
}

async function usersRemove(rl) {
  const data = await getAt('users');
  if (!data) {
    console.log(C.dim('No users.'));
    return;
  }
  const list = Object.entries(data).map(([uuid, v]) => ({ uuid, ...v }));
  clear();
  console.log(C.bold('Remove User\n'));
  list.forEach((u, i) => console.log(`  ${i + 1}. ${u.name} (${u.uuid})`));
  console.log('  0. Back\n');
  const choice = await ask(rl, 'Select user to remove');
  if (choice === '0' || !choice) return;
  const idx = parseInt(choice, 10) - 1;
  if (idx < 0 || idx >= list.length) {
    console.log(C.red('Invalid choice'));
    return;
  }
  const user = list[idx];
  const confirm = await ask(rl, `Remove "${user.name}"? (y/N)`, 'n');
  if (confirm.toLowerCase() !== 'y') return;
  await remove(ref(db, `users/${user.uuid}`));
  console.log(C.green('User removed'));
}

// --- Data browse ---
async function dataBrowse(rl, currentPath = '') {
  while (true) {
    clear();
    const data = await getAt(currentPath || '');
    const rootLabel = currentPath || '/';
    console.log(C.bold('Data: ' + rootLabel + '\n'));

    if (data === null || typeof data !== 'object') {
      console.log(C.dim('(empty or leaf)'));
      if (currentPath) {
        console.log('\n' + JSON.stringify(data, null, 2));
      }
    } else {
      const keys = Object.keys(data);
      keys.forEach((k, i) => {
        const v = data[k];
        const isObj = v !== null && typeof v === 'object' && !Array.isArray(v);
        const suffix = isObj ? '/' : ` = ${JSON.stringify(v)}`;
        console.log(`  ${i + 1}. ${C.cyan(k)}${suffix}`);
      });
      console.log(`  ${keys.length + 1}. ${C.dim('(view as JSON)')}`);
    }

    console.log('\n  0. Back');
    console.log('  r. Read JSON');
    console.log('  e. Export this path');
    console.log('  d. Delete this path\n');

    const input = await ask(rl, 'Choice');
    if (!input) continue;

    if (input === '0') return;

    if (input === 'r') {
      console.log('\n' + JSON.stringify(data, null, 2) + '\n');
      await ask(rl, 'Press Enter to continue', '');
      continue;
    }

    if (input === 'e') {
      const file = await ask(rl, 'Filename', `export-${Date.now()}.json`);
      if (file) {
        const fp = resolve(process.cwd(), file);
        writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
        console.log(C.green('Exported to'), fp);
        await ask(rl, 'Press Enter', '');
      }
      continue;
    }

    if (input === 'd' && currentPath) {
      const confirm = await ask(rl, 'Delete this path? (y/N)', 'n');
      if (confirm.toLowerCase() === 'y') {
        await removeAt(currentPath);
        console.log(C.green('Deleted'));
        await ask(rl, 'Press Enter', '');
      }
      return;
    }

    const num = parseInt(input, 10);
    if (!isNaN(num) && data && typeof data === 'object') {
      const keys = Object.keys(data);
      if (num >= 1 && num <= keys.length) {
        const key = keys[num - 1];
        const nextPath = currentPath ? `${currentPath}/${key}` : key;
        await dataBrowse(rl, nextPath);
      } else if (num === keys.length + 1) {
        console.log('\n' + JSON.stringify(data, null, 2) + '\n');
        await ask(rl, 'Press Enter', '');
      }
    }
  }
}

// --- Export ---
async function doExport(rl) {
  clear();
  console.log(C.bold('Export Data\n'));
  const path = await ask(rl, 'Path (empty = full DB)', '');
  const file = await ask(rl, 'Filename', `export-${Date.now()}.json`);
  if (!file) return;
  const data = await getAt(path || '');
  const fp = resolve(process.cwd(), file);
  writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
  console.log(C.green('\nExported to'), fp);
}

// --- Import ---
async function doImport(rl) {
  clear();
  console.log(C.bold('Import Data\n'));
  const file = await ask(rl, 'JSON file path');
  if (!file) return;
  const fp = resolve(process.cwd(), file);
  if (!existsSync(fp)) {
    console.log(C.red('File not found:'), fp);
    return;
  }
  let data;
  try {
    data = JSON.parse(readFileSync(fp, 'utf8'));
  } catch {
    console.log(C.red('Invalid JSON'));
    return;
  }
  const path = await ask(rl, 'Target path (e.g. users, containers)', '');
  if (!path) {
    console.log(C.red('Path required'));
    return;
  }
  const confirm = await ask(rl, 'Overwrite? (y/N)', 'n');
  if (confirm.toLowerCase() !== 'y') return;
  await setAt(path, data);
  console.log(C.green('\nImported to'), path);
}

// --- Remove ---
async function doRemove(rl) {
  clear();
  console.log(C.bold('Remove Data\n'));
  console.log(C.dim('Examples: events, containers/abc-123, users/xyz\n'));
  const path = await ask(rl, 'Path to remove');
  if (!path) return;
  if (path === '/' || path === '') {
    console.log(C.red('Cannot remove root'));
    return;
  }
  const confirm = await ask(rl, `Remove "${path}"? (y/N)`, 'n');
  if (confirm.toLowerCase() !== 'y') return;
  await removeAt(path);
  console.log(C.green('Removed'));
}

// --- Main menu ---
async function usersMenu(rl) {
  while (true) {
    clear();
    showMenu('Users', [
      ['1', 'List users'],
      ['2', 'Add user'],
      ['3', 'Edit user'],
      ['4', 'Remove user'],
    ], '0. Back to main');
    const choice = await ask(rl, 'Choice');
    if (choice === '0') return;
    if (choice === '1') await usersList(rl);
    else if (choice === '2') await usersAdd(rl);
    else if (choice === '3') await usersEdit(rl);
    else if (choice === '4') await usersRemove(rl);
    if (choice !== '0') await ask(rl, 'Press Enter to continue', '');
  }
}

async function mainMenu(rl) {
  while (true) {
    clear();
    console.log(C.bold('Pakkauslista Database Manager\n'));
    showMenu('Main Menu', [
      ['1', 'Users'],
      ['2', 'Browse data (tree)'],
      ['3', 'Export to file'],
      ['4', 'Import from file'],
      ['5', 'Remove path'],
    ], '0. Exit');
    const choice = await ask(rl, 'Choice');
    if (choice === '0') {
      console.log('\n');
      break;
    }
    if (choice === '1') await usersMenu(rl);
    else if (choice === '2') await dataBrowse(rl);
    else if (choice === '3') await doExport(rl);
    else if (choice === '4') await doImport(rl);
    else if (choice === '5') await doRemove(rl);
    if (choice !== '0' && !['1', '2'].includes(choice)) {
      await ask(rl, 'Press Enter to continue', '');
    }
  }
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    await mainMenu(rl);
  } finally {
    rl.close();
  }
}

main().catch((e) => {
  console.error(C.red('Error:'), e.message);
  process.exit(1);
});
