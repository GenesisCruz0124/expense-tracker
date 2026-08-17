/** Generates an RFC 4122 v4 UUID, used to give every syncable row a stable cross-device identity. */
export function generateUuid(): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  // Hermes/RN doesn't polyfill `crypto` by default and no uuid-generating dependency is
  // installed, so randomUUID isn't guaranteed to exist. Uniqueness (not unguessability) is
  // all this id needs, so a Math.random()-based v4 generator is an acceptable fallback.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
