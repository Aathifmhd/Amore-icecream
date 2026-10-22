/*
 * Create an admin login, or change its password:
 *
 *   npm --prefix backend run set-admin -- Admin
 *
 * Asks for the password (typing is hidden). Changing a password signs that admin out
 * everywhere and forgets the user codes set on their devices.
 */
import readline from 'node:readline';
import { setup, close, DB_LABEL } from '../db.js';
import { upsertAdmin } from '../auth.js';

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
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off('data', onData);
        process.stdout.write('\n');
        resolve(value);
      } else if (ch === '\u0003') {
        process.stdin.setRawMode(false);
        reject(new Error('Cancelled'));
      } else if (ch === '\u007f' || ch === '\b') {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    process.stdin.on('data', onData);
  });
}

const username = process.argv[2];
if (!username) {
  console.log('Usage: npm --prefix backend run set-admin -- <name>');
  process.exit(1);
}

try {
  await setup();
  const password = await askHidden(`New password for "${username}": `);
  if (process.stdin.isTTY) {
    const again = await askHidden('Type it again: ');
    if (again !== password) throw new Error('The two passwords are different. Nothing was changed.');
  }
  await upsertAdmin(username, password);
  console.log(`Saved admin "${username}" in ${DB_LABEL}.`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await close();
}
