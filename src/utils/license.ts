export const TRIAL_DAYS = 14;

const S1 = 0x5a3f;
const S2 = 0x1d7b;

function h4(n: number): string {
  return (n & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function deviceHash(deviceId: string): number {
  let h = 0x4857;
  const id = deviceId.trim().toLowerCase();
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) & 0xffff;
  }
  return h;
}

export function generateKey(serial: number, deviceId: string): string {
  const s = serial & 0xffff;
  const dh = deviceHash(deviceId);
  const a = (s ^ S1 ^ dh) & 0xffff;
  const b = ((s * S2) ^ (a >>> 3) ^ dh) & 0xffff;
  const c = (a ^ b ^ (s << 5) ^ dh) & 0xffff;
  const d = ((a * 3 + b * 7 + c * 13 + S1 * S2) ^ (a ^ b ^ c)) & 0xffff;
  return [a, b, c, d].map(h4).join('-');
}

export function validateKey(key: string, deviceId: string): boolean {
  const parts = key
    .trim()
    .toUpperCase()
    .replace(/\s/g, '')
    .split('-');
  if (parts.length !== 4 || parts.some((p) => !/^[0-9A-F]{4}$/.test(p))) return false;
  const [a, b, c, d] = parts.map((p) => parseInt(p, 16));
  const dh = deviceHash(deviceId);
  const s = (a ^ S1 ^ dh) & 0xffff;
  if (s < 1 || s > 9999) return false;
  const eb = ((s * S2) ^ (a >>> 3) ^ dh) & 0xffff;
  const ec = (a ^ b ^ (s << 5) ^ dh) & 0xffff;
  const ed = ((a * 3 + b * 7 + c * 13 + S1 * S2) ^ (a ^ b ^ c)) & 0xffff;
  return b === eb && c === ec && d === ed;
}

export function trialDaysLeft(firstLaunchAt: string): number {
  const first = new Date(firstLaunchAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, TRIAL_DAYS - diffDays);
}
