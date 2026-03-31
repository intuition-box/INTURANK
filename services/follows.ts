/**
 * Follow identities (by address) and optional email alerts for their buy/activity.
 * Stored per wallet in localStorage and synced to backend so we can restore after refresh/new device.
 */

import { toAddress } from './web3';
import { syncFollowsToServer } from './emailNotifications';

const STORAGE_KEY_PREFIX = 'inturank_follows_';
const MAX_FOLLOWS = 200;

const EMAIL_API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_EMAIL_API_URL) || '';
function getFollowsApiBase(): string {
  return EMAIL_API_BASE ? String(EMAIL_API_BASE).replace(/\/$/, '') : '';
}

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

/** Canonical id for comparison: 42-char lowercase address if address-like, else lowercase. */
function canonicalId(id: string): string {
  const addr = toAddress(id);
  return addr ? addr.toLowerCase() : normalizeId(id);
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

/** Fetch follows from backend (for restore after refresh/new device). */
export async function fetchFollowsFromServer(walletAddress: string): Promise<FollowEntry[]> {
  const base = getFollowsApiBase();
  if (!base) return [];
  try {
    const url = `${base}/api/follows?wallet=${encodeURIComponent(walletAddress)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data?.follows) ? data.follows : [];
    return list.map((f: any) => ({
      identityId: f.identityId || f.identity_id || '',
      label: f.label,
      emailAlerts: f.emailAlerts !== false,
      followedAt: typeof f.followedAt === 'number' ? f.followedAt : 0,
    })).filter((e: FollowEntry) => e.identityId);
  } catch {
    return [];
  }
}

/** If local follows are empty, restore from server. Call when wallet connects (e.g. after hard refresh). */
export async function restoreFollowsFromServerIfEmpty(walletAddress: string): Promise<boolean> {
  if (!walletAddress) return false;
  const local = loadFollows(walletAddress);
  if (local.length > 0) return false;
  const fromServer = await fetchFollowsFromServer(walletAddress);
  if (fromServer.length === 0) return false;
  saveFollows(walletAddress, fromServer);
  return true;
}

/** Follow an identity. emailAlerts: send email when they buy/create. */
export function addFollow(
  walletAddress: string,
  identityId: string,
  opts?: { label?: string; emailAlerts?: boolean }
): void {
  if (!walletAddress || !identityId) return;
  const id = canonicalId(identityId);
  const wallet = normalizeWallet(walletAddress);
  if (id === wallet) return; // don't follow self
  const list = loadFollows(walletAddress).filter((e) => canonicalId(e.identityId) !== id);
  list.push({
    identityId: id,
    label: opts?.label,
    emailAlerts: opts?.emailAlerts ?? true,
    followedAt: Date.now(),
  });
  saveFollows(walletAddress, list);
  // Always sync to backend so we can restore after refresh/new device; also used by email worker when subscribed
  syncFollowsToServer(walletAddress, list.map((f) => ({ identityId: f.identityId, label: f.label, emailAlerts: f.emailAlerts ?? true })));
}

/** Unfollow an identity. */
export function removeFollow(walletAddress: string, identityId: string): void {
  if (!walletAddress || !identityId) return;
  const id = canonicalId(identityId);
  const list = loadFollows(walletAddress).filter((e) => canonicalId(e.identityId) !== id);
  saveFollows(walletAddress, list);
  syncFollowsToServer(walletAddress, list.map((f) => ({ identityId: f.identityId, label: f.label, emailAlerts: f.emailAlerts ?? true })));
}

/** Check if the wallet follows this identity. */
export function isFollowing(walletAddress: string, identityId: string): FollowEntry | null {
  if (!walletAddress || !identityId) return null;
  const id = canonicalId(identityId);
  const list = loadFollows(walletAddress);
  return list.find((e) => canonicalId(e.identityId) === id) ?? null;
}

/** Toggle email alerts for an existing follow. */
export function setFollowEmailAlerts(walletAddress: string, identityId: string, emailAlerts: boolean): void {
  if (!walletAddress || !identityId) return;
  const id = canonicalId(identityId);
  const list = loadFollows(walletAddress);
  const idx = list.findIndex((e) => canonicalId(e.identityId) === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], emailAlerts };
  saveFollows(walletAddress, list);
  syncFollowsToServer(walletAddress, list.map((f) => ({ identityId: f.identityId, label: f.label, emailAlerts: f.emailAlerts ?? true })));
}
