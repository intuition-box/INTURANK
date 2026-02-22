/**
 * Email notification subscriptions and delivery.
 * Subscriptions are stored locally and tied to wallet address.
 * Actual email sending is stubbed until SMTP is configured.
 */

import type { PositionActivityNotification } from './graphql';
import { formatEther } from 'viem';
import { formatMarketValue, formatDisplayedShares } from './analytics';
import type { TransactionReceiptData } from './emailTemplates';

const STORAGE_KEY = 'inturank_email_subscriptions';

export interface EmailSubscription {
  email: string;
  nickname?: string;
  subscribedAt: number;
}

function normalizeWallet(addr: string): string {
  return (addr || '').toLowerCase();
}

function loadSubscriptions(): Record<string, EmailSubscription> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveSubscriptions(subs: Record<string, EmailSubscription>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
  } catch (_) {}
}

/** Get email subscription for a wallet, if any. */
export function getEmailSubscription(walletAddress: string): EmailSubscription | null {
  const key = normalizeWallet(walletAddress);
  const subs = loadSubscriptions();
  const sub = subs[key];
  return sub?.email ? sub : null;
}

/** Register or update email subscription for a wallet. */
export function setEmailSubscription(
  walletAddress: string,
  email: string,
  nickname?: string
): void {
  const key = normalizeWallet(walletAddress);
  const subs = loadSubscriptions();
  subs[key] = {
    email: email.trim().toLowerCase(),
    nickname: nickname?.trim() || undefined,
    subscribedAt: Date.now(),
  };
  saveSubscriptions(subs);
}

/** Remove email subscription for a wallet. */
export function removeEmailSubscription(walletAddress: string): void {
  const key = normalizeWallet(walletAddress);
  const subs = loadSubscriptions();
  delete subs[key];
  saveSubscriptions(subs);
}

/**
 * Called when there's activity on a claim the user holds (someone else bought/sold).
 * Sends a rich HTML email to the subscribed address for that wallet.
 */
export async function requestEmailNotification(
  walletAddress: string,
  notification: PositionActivityNotification
): Promise<void> {
  const sub = getEmailSubscription(walletAddress);
  if (!sub?.email) return;

  const sharesFormatted = notification.shares ? formatDisplayedShares(notification.shares) : '—';
  const assetsNum = notification.assets ? parseFloat(formatEther(BigInt(notification.assets))) : 0;
  const assetsFormatted = assetsNum > 0 ? `₸${formatMarketValue(assetsNum)}` : '—';

  const subject = `IntuRank: ${notification.type === 'liquidated' ? 'Liquidation' : 'New activity'} in ${notification.marketLabel}`;
  const plainBody = [
    `${notification.senderLabel} ${notification.type === 'liquidated' ? 'liquidated' : 'acquired'}${notification.shares ? ` ${sharesFormatted} shares` : ''}${assetsNum > 0 ? ` (₸${formatMarketValue(assetsNum)})` : ''} in ${notification.marketLabel}.`,
    notification.txHash ? `Tx: ${notification.txHash}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const { getActivityNotificationHtml } = await import('./emailTemplates');
  const html = getActivityNotificationHtml({
    marketLabel: notification.marketLabel,
    senderLabel: notification.senderLabel,
    type: notification.type,
    sharesFormatted,
    assetsFormatted,
    txHash: notification.txHash,
  });

  await sendEmailWithHtml({
    to: sub.email,
    subject,
    message: plainBody,
    html,
  });
}

/**
 * Send transaction receipt email when the user buys or sells shares.
 * Looks up email by wallet and sends a rich receipt (trust/distrust, acquired/liquidated, units, price, tx hash).
 */
export async function sendTransactionReceiptEmail(
  walletAddress: string,
  receipt: TransactionReceiptData
): Promise<void> {
  const sub = getEmailSubscription(walletAddress);
  if (!sub?.email) return;

  const subject = `IntuRank: ${receipt.type === 'acquired' ? 'Acquired' : 'Liquidated'} — ${receipt.marketLabel}`;
  const plainMessage = [
    `You ${receipt.type === 'acquired' ? 'acquired' : 'liquidated'} ${receipt.sharesFormatted} shares (${receipt.side}) in ${receipt.marketLabel}.`,
    receipt.assetsFormatted ? `Amount: ${receipt.assetsFormatted}` : '',
    receipt.txHash ? `Tx: ${receipt.txHash}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const { getTransactionReceiptHtml } = await import('./emailTemplates');
  const html = getTransactionReceiptHtml(receipt);

  await sendEmailWithHtml({ to: sub.email, subject, message: plainMessage, html });
}

const EMAIL_API_BASE = import.meta.env.VITE_EMAIL_API_URL || '';

function getEmailApiUrl(): string {
  return EMAIL_API_BASE ? `${EMAIL_API_BASE.replace(/\/$/, '')}/api/send-email` : '/api/send-email';
}

/**
 * Send the welcome email as full HTML (logo, card, CTA) so it displays correctly in clients.
 * No-op on failure so the UI still shows success.
 */
export async function sendWelcomeEmail(to: string, _nickname?: string): Promise<void> {
  const { getWelcomeEmailHtml } = await import('./emailTemplates');
  const subject = "You're in — IntuRank Email Alerts";
  const plainMessage = "You're subscribed to IntuRank email alerts. We'll notify you when there's activity on your holdings.";
  const html = getWelcomeEmailHtml({ email: to, nickname: _nickname });
  try {
    const url = getEmailApiUrl();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, message: plainMessage, html }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[Welcome email send failed]', res.status, url, err);
    }
  } catch (e) {
    console.warn('[Welcome email error]', getEmailApiUrl(), e);
  }
}

/** Send email with optional HTML via our backend (Ensend). No-op on failure. */
async function sendEmailWithHtml(payload: {
  to: string;
  subject: string;
  message: string;
  html?: string;
}): Promise<void> {
  try {
    const body: Record<string, string> = {
      to: payload.to,
      subject: payload.subject,
      message: payload.message,
    };
    if (payload.html) body.html = payload.html;
    const url = getEmailApiUrl();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[Email send failed]', res.status, url, err);
    }
  } catch (e) {
    console.warn('[Email send error]', getEmailApiUrl(), e);
  }
}
