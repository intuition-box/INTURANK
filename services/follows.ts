/**
 * Follow identities (by address) and optional email alerts for their buy/activity.
 * Stored per wallet in localStorage.
 */

const STORAGE_KEY_PREFIX = 'inturank_follows_';
const MAX_FOLLOWS = 200;

export interface FollowEntry {
  identityId: string;
  label?: string;
  emailAlerts: boolean;
  followedAt: number;
}

function normalizeWallet(addr: string): string {
  return (addr || '').toLowerCase();
}

function normalizeId(id: string): string {
  return (id || '').toLowerCase();
}

function loadFollows(walletAddress: string): FollowEntry[] {
  try {
    const key = STORAGE_KEY_PREFIX + normalizeWallet(walletAddress);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(-MAX_FOLLOWS);
  } catch {
    return [];
  }
}

function saveFollows(walletAddress: string, entries: FollowEntry[]): void {
  try {
    const key = STORAGE_KEY_PREFIX + normalizeWallet(walletAddress);
    localStorage.setItem(key, JSON.stringify(entries.slice(-MAX_FOLLOWS)));
  } catch (_) {}
}

/** Get all identities the wallet follows, with optional email-alerts flag. */
export function getFollowedIdentities(walletAddress: string): FollowEntry[] {
  if (!walletAddress) return [];
  return loadFollows(walletAddress);
}

/** Follow an identity. emailAlerts: send email when they buy/create. */
export function addFollow(
  walletAddress: string,
  identityId: string,
  opts?: { label?: string; emailAlerts?: boolean }
): void {
  if (!walletAddress || !identityId) return;
  const id = normalizeId(identityId);
  const wallet = normalizeWallet(walletAddress);
  if (id === wallet) return; // don't follow self
  const list = loadFollows(walletAddress).filter((e) => normalizeId(e.identityId) !== id);
  list.push({
    identityId: id,
    label: opts?.label,
    emailAlerts: opts?.emailAlerts ?? true,
    followedAt: Date.now(),
  });
  saveFollows(walletAddress, list);
}

/** Unfollow an identity. */
export function removeFollow(walletAddress: string, identityId: string): void {
  if (!walletAddress || !identityId) return;
  const id = normalizeId(identityId);
  const list = loadFollows(walletAddress).filter((e) => normalizeId(e.identityId) !== id);
  saveFollows(walletAddress, list);
}

/** Check if the wallet follows this identity. */
export function isFollowing(walletAddress: string, identityId: string): FollowEntry | null {
  if (!walletAddress || !identityId) return null;
  const id = normalizeId(identityId);
  const list = loadFollows(walletAddress);
  return list.find((e) => normalizeId(e.identityId) === id) ?? null;
}

/** Toggle email alerts for an existing follow. */
export function setFollowEmailAlerts(walletAddress: string, identityId: string, emailAlerts: boolean): void {
  if (!walletAddress || !identityId) return;
  const id = normalizeId(identityId);
  const list = loadFollows(walletAddress);
  const idx = list.findIndex((e) => normalizeId(e.identityId) === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], emailAlerts };
  saveFollows(walletAddress, list);
}
