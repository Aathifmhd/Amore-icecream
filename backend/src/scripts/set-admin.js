/*
 * Create an admin login, or change its password:
 *
 *   npm --prefix backend run set-admin -- Admin
 *
 * Give an existing login a new name and password (it keeps its role):
 *
 *   npm --prefix backend run set-admin -- Superadmin --rename Admin
 *
 * Asks for the password (typing is hidden). Changing a password signs that admin out
 * everywhere and forgets the user codes set on their devices.
 */
import readline from 'node:readline';
import { setup, close, DB_LABEL } from '../db.js';
import { renameAdmin, upsertAdmin } from '../auth.js';

function askHidden(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      // Piped input (e.g. from a script): read one line
      const rl = readline.createInterface({ input: process.stdin });
      rl.once('line', (line) => {
        rl.close();
        resolve(line);
      });
      rl.once('close', () => resolve(''));
      return;
    }
    process.stdout.write(question);
    let value = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const finish = (fn) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off('data', onData);
      process.stdout.write('\n');
      fn();
    };
    // Typed keys usually arrive one by one, but a pasted password arrives in one piece
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return finish(() => resolve(value));
        if (ch === '\u0003') return finish(() => reject(new Error('Cancelled')));
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    };
    process.stdin.on('data', onData);
  });
}

const username = process.argv[2];
const renameAt = process.argv.indexOf('--rename');
const renameFrom = renameAt > 0 ? process.argv[renameAt + 1] : null;
if (!username || username.startsWith('--') || (renameAt > 0 && !renameFrom)) {
  console.log('Usage: npm --prefix backend run set-admin -- <name> [--rename <old name>]');
  process.exit(1);
}

try {
  await setup();
  const password = await askHidden(`New password for "${username}": `);
  if (process.stdin.isTTY) {
    const again = await askHidden('Type it again: ');
    if (again !== password) throw new Error('The two passwords are different. Nothing was changed.');
  }
  // Nothing changes until a good password has been typed (twice)
  if (password.length < 8) throw new Error('The password must be at least 8 characters. Nothing was changed.');
  if (renameFrom) {
    await renameAdmin(renameFrom, username);
    console.log(`Renamed admin "${renameFrom}" to "${username}".`);
  }
  await upsertAdmin(username, password);
  console.log(`Saved admin "${username}" in ${DB_LABEL}.`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await close();
}
