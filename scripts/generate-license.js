#!/usr/bin/env node
// Expense Tracker — offline license key generator
// Usage:
//   node scripts/generate-license.js generate <serial>
//   node scripts/generate-license.js generate <from> <to>   (batch)
//   node scripts/generate-license.js validate <key>

const S1 = 0x5a3f;
const S2 = 0x1d7b;

function h4(n) {
  return (n & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function generateKey(serial) {
  const s = serial & 0xffff;
  const a = (s ^ S1) & 0xffff;
  const b = ((s * S2) ^ (a >>> 3)) & 0xffff;
  const c = (a ^ b ^ (s << 5)) & 0xffff;
  const d = ((a * 3 + b * 7 + c * 13 + S1 * S2) ^ (a ^ b ^ c)) & 0xffff;
  return [a, b, c, d].map(h4).join('-');
}

function validateKey(key) {
  const parts = key.trim().toUpperCase().replace(/\s/g, '').split('-');
  if (parts.length !== 4 || parts.some((p) => !/^[0-9A-F]{4}$/.test(p))) return false;
  const [a, b, c, d] = parts.map((p) => parseInt(p, 16));
  const s = a ^ S1;
  if (s < 1 || s > 9999) return false;
  const eb = ((s * S2) ^ (a >>> 3)) & 0xffff;
  const ec = (a ^ b ^ (s << 5)) & 0xffff;
  const ed = ((a * 3 + b * 7 + c * 13 + S1 * S2) ^ (a ^ b ^ c)) & 0xffff;
  return b === eb && c === ec && d === ed;
}

const [, , command, ...args] = process.argv;

if (command === 'generate') {
  const from = parseInt(args[0]);
  const to = args[1] ? parseInt(args[1]) : from;
  if (!from || from < 1 || from > 9999 || to < from || to > 9999) {
    console.error('Usage: generate <serial 1-9999> [end-serial]');
    process.exit(1);
  }
  for (let i = from; i <= to; i++) {
    console.log(`${String(i).padStart(4, '0')}  ${generateKey(i)}`);
  }
} else if (command === 'validate') {
  const key = args[0];
  if (!key) {
    console.error('Usage: validate <XXXX-XXXX-XXXX-XXXX>');
    process.exit(1);
  }
  const valid = validateKey(key);
  console.log(valid ? `VALID   ${key.trim().toUpperCase()}` : `INVALID ${key.trim().toUpperCase()}`);
  process.exit(valid ? 0 : 1);
} else {
  console.log('Expense Tracker — License Key Tool');
  console.log('  node scripts/generate-license.js generate 1');
  console.log('  node scripts/generate-license.js generate 1 50   # batch serials 1–50');
  console.log('  node scripts/generate-license.js validate XXXX-XXXX-XXXX-XXXX');
}
