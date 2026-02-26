/**
 * HTML email templates for IntuRank — dark, tech-style, inline CSS for client compatibility.
 */

const BRAND = 'IntuRank';
const PRIMARY = '#00f3ff';   // IntuRank cyan (neon)
const BG_DARK = '#020308';
const BORDER_CYAN = 'rgba(0, 243, 255, 0.5)';
const TEXT = '#e2e8f0';
const TEXT_MUTED = '#94a3b8';

/** Hosted IntuRank logo for emails (receipts, welcome, etc.). */
const LOGO_URL = 'https://cdn.emailacademy.com/user/0c169d4940dec83184e5e6dc6e7097fb6984c5baa311d5e3342bd4929308f702/IntuRanklogo-1.jpg2026_02_21_01_38_06.jpeg';

export function getWelcomeEmailHtml(options: { nickname?: string; email?: string }): string {
  const greeting = options.nickname?.trim()
    ? `Hey ${escapeHtml(options.nickname.trim())},`
    : options.email
      ? `Hey ${escapeHtml(options.email)},`
      : 'Hey there,';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${BRAND}</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background-color:#0f172a; font-family: Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a; min-height:100vh;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color:${BG_DARK}; border: 2px solid ${BORDER_CYAN};">
          <tr>
            <td style="padding: 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-bottom: 2px solid ${BORDER_CYAN}; padding: 0 0 20px 0;">
                    <img src="${LOGO_URL}" alt="${BRAND}" width="56" height="56" style="display: block; width: 56px; height: 56px; margin: 0 auto 12px auto; object-fit: contain;" />
                    <p style="margin: 0; font-size: 9px; font-weight: 700; letter-spacing: 0.25em; color: ${PRIMARY}; text-transform: uppercase; text-align: center;">${BRAND} · Email Alerts</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 24px;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: ${TEXT_MUTED}; font-weight: 600;">${greeting}</p>
                    <h1 style="margin: 0 0 16px 0; font-family: Orbitron, Arial Black, sans-serif; font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: 0.05em; text-transform: uppercase;">Welcome to IntuRank.</h1>
                    <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: ${TEXT};">
                      Your layer for semantic markets and gTrust. We'll email you when there's activity on your holdings, plus app updates and campaigns to earn TRUST (₸) tokens — straight to your inbox.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 28px;">
                      <tr>
                        <td style="background-color: ${PRIMARY}; padding: 16px 32px;">
                          <a href="${APP_ROOT_URL}" style="font-family: Orbitron, Arial Black, sans-serif; font-size: 12px; font-weight: 900; letter-spacing: 0.15em; color: #000000; text-decoration: none; text-transform: uppercase;">Open IntuRank</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 32px; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 24px;">
                    <p style="margin: 0; font-size: 11px; color: ${TEXT_MUTED}; letter-spacing: 0.1em;">Semantic markets · Quantify identity · Trust layer</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.replace(/\n\s+/g, '\n').trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getAppUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://inturank.intuition.box';
}

/** App root — used for welcome email CTA. */
const APP_ROOT_URL = 'https://inturank.intuition.box/';
/** View on IntuRank / Open IntuRank CTA — links to portfolio (activity emails, receipts). */
const APP_PORTFOLIO_URL = 'https://inturank.intuition.box/#/portfolio';

const EXPLORER_URL = 'https://explorer.intuition.systems';
const CURRENCY = '₸';
const BG_CARD = '#0a0a0f';
const BORDER = '#1e293b';
const NEON_CYAN = '#00f3ff';
const NEON_GLOW_BORDER = 'rgba(0, 243, 255, 0.6)';
const NEON_GREEN = '#00ff88';
const NEON_RED = '#ff3366';

/** Data for transaction receipt email (user's own buy/sell). */
export interface TransactionReceiptData {
  txHash: string;
  type: 'acquired' | 'liquidated';
  side: 'trust' | 'distrust';
  marketLabel: string;
  sharesFormatted: string;
  assetsFormatted: string;
}

/** Receipt email after user acquires or liquidates shares. Always includes IntuRank logo; neon theme. */
export function getTransactionReceiptHtml(receipt: TransactionReceiptData): string {
  const isAcquired = receipt.type === 'acquired';
  const isTrust = receipt.side === 'trust';
  const actionLabel = isAcquired ? 'ACQUIRED' : 'LIQUIDATED';
  const sideLabel = isTrust ? 'TRUST' : 'DISTRUST';
  const txUrl = `${EXPLORER_URL}/tx/${receipt.txHash}`;
  const accent = isAcquired ? NEON_GREEN : NEON_RED;
  const cardBorder = isAcquired ? NEON_GLOW_BORDER : 'rgba(255, 51, 102, 0.5)';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transaction receipt — ${BRAND}</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background-color:#050508; font-family: Orbitron, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#050508;">
    <tr>
      <td align="center" style="padding: 32px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width: 520px; width: 100%; background-color:${BG_CARD}; border: 2px solid ${cardBorder};">
          <tr>
            <td style="padding: 0 24px 20px 24px; border-bottom: 2px solid ${NEON_GLOW_BORDER};">
              <img src="${LOGO_URL}" alt="${BRAND}" width="56" height="56" style="display: block; width: 56px; height: 56px; margin: 24px auto 16px auto; object-fit: contain;" />
              <p style="margin: 0 0 4px 0; font-size: 9px; font-weight: 700; letter-spacing: 0.25em; color: ${NEON_CYAN}; text-transform: uppercase; text-align: center;">${BRAND} · Receipt</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 24px 28px 24px;">
              <p style="margin: 0 0 6px 0; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; color: ${NEON_CYAN}; text-transform: uppercase;">Transaction receipt</p>
              <h1 style="margin: 0 0 20px 0; font-family: Orbitron, Arial, sans-serif; font-size: 20px; font-weight: 900; color: ${accent}; letter-spacing: 0.06em; text-transform: uppercase;">${actionLabel} · ${sideLabel}</h1>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px; color: ${TEXT}; border: 1px solid ${NEON_GLOW_BORDER};">
                <tr><td style="padding: 10px 12px; border-bottom: 1px solid ${BORDER}; color: ${TEXT_MUTED};">Market</td><td style="padding: 10px 12px; border-bottom: 1px solid ${BORDER}; text-align: right; color: ${TEXT};">${escapeHtml(receipt.marketLabel)}</td></tr>
                <tr><td style="padding: 10px 12px; border-bottom: 1px solid ${BORDER}; color: ${TEXT_MUTED};">Side</td><td style="padding: 10px 12px; border-bottom: 1px solid ${BORDER}; text-align: right; color: ${accent};">${sideLabel}</td></tr>
                <tr><td style="padding: 10px 12px; border-bottom: 1px solid ${BORDER}; color: ${TEXT_MUTED};">Units (shares)</td><td style="padding: 10px 12px; border-bottom: 1px solid ${BORDER}; text-align: right;">${escapeHtml(receipt.sharesFormatted)}</td></tr>
                <tr><td style="padding: 10px 12px; border-bottom: 1px solid ${BORDER}; color: ${TEXT_MUTED};">${isAcquired ? 'Price paid' : 'Proceeds'}</td><td style="padding: 10px 12px; border-bottom: 1px solid ${BORDER}; text-align: right; color: ${accent};">${escapeHtml(receipt.assetsFormatted)}</td></tr>
                <tr><td style="padding: 10px 12px; color: ${TEXT_MUTED};">Transaction</td><td style="padding: 10px 12px; text-align: right;"><a href="${txUrl}" style="font-size: 11px; color: ${NEON_CYAN}; word-break: break-all; text-decoration: underline;">${receipt.txHash.slice(0, 10)}…${receipt.txHash.slice(-8)}</a></td></tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
                <tr>
                  <td style="background-color: ${NEON_CYAN}; padding: 14px 28px; border: 1px solid ${NEON_CYAN};">
                    <a href="${APP_PORTFOLIO_URL}" style="font-family: Orbitron, Arial, sans-serif; font-size: 11px; font-weight: 900; letter-spacing: 0.1em; color: #000000; text-decoration: none; text-transform: uppercase;">View on IntuRank</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 24px; border-top: 1px solid ${NEON_GLOW_BORDER};">
              <p style="margin: 0; font-size: 10px; color: ${TEXT_MUTED}; letter-spacing: 0.08em;">Semantic markets · Quantify identity · Trust layer</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.replace(/\n\s+/g, '\n').trim();
}

/** Formatted activity data for rich notification email. */
export interface ActivityNotificationFormatted {
  marketLabel: string;
  senderLabel: string;
  type: 'acquired' | 'liquidated';
  sharesFormatted: string;
  assetsFormatted: string;
  txHash?: string;
}

/** Activity on a claim you hold — rich notification email. Logo + neon theme. */
export function getActivityNotificationHtml(notification: ActivityNotificationFormatted): string {
  const isLiquidated = notification.type === 'liquidated';
  const action = isLiquidated ? 'liquidated' : 'acquired';
  const txUrl = notification.txHash ? `${EXPLORER_URL}/tx/${notification.txHash}` : APP_PORTFOLIO_URL;
  const accent = isLiquidated ? NEON_RED : NEON_GREEN;
  const cardBorder = isLiquidated ? 'rgba(255, 51, 102, 0.5)' : NEON_GLOW_BORDER;
  const hasShares = notification.sharesFormatted && notification.sharesFormatted !== '—';
  const hasAssets = notification.assetsFormatted && notification.assetsFormatted !== '—';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activity in your holdings — ${BRAND}</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background-color:#050508; font-family: Orbitron, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#050508;">
    <tr>
      <td align="center" style="padding: 32px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width: 520px; width: 100%; background-color:${BG_CARD}; border: 2px solid ${cardBorder};">
          <tr>
            <td style="padding: 0 24px 20px 24px; border-bottom: 2px solid ${NEON_GLOW_BORDER};">
              <img src="${LOGO_URL}" alt="${BRAND}" width="56" height="56" style="display: block; width: 56px; height: 56px; margin: 24px auto 16px auto; object-fit: contain;" />
              <p style="margin: 0 0 4px 0; font-size: 9px; font-weight: 700; letter-spacing: 0.25em; color: ${NEON_CYAN}; text-transform: uppercase; text-align: center;">${BRAND} · Activity</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 24px 28px 24px;">
              <p style="margin: 0 0 6px 0; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; color: ${NEON_CYAN}; text-transform: uppercase;">Activity in your holdings</p>
              <h1 style="margin: 0 0 8px 0; font-family: Orbitron, Arial, sans-serif; font-size: 18px; font-weight: 900; color: #ffffff; letter-spacing: 0.04em;">${escapeHtml(notification.marketLabel)}</h1>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: ${TEXT};">
                <span style="color: ${accent}; font-weight: 700;">${escapeHtml(notification.senderLabel)}</span> ${action}${hasShares ? ` <strong>${escapeHtml(notification.sharesFormatted)} shares</strong>` : ''}${hasAssets ? ` (${escapeHtml(notification.assetsFormatted)})` : ''}.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 12px; color: ${TEXT}; border: 1px solid ${NEON_GLOW_BORDER};">
                <tr><td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; color: ${TEXT_MUTED};">Market</td><td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; text-align: right;">${escapeHtml(notification.marketLabel)}</td></tr>
                <tr><td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; color: ${TEXT_MUTED};">Action</td><td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; text-align: right; color: ${accent};">${action.toUpperCase()}</td></tr>
                <tr><td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; color: ${TEXT_MUTED};">Shares</td><td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; text-align: right;">${escapeHtml(notification.sharesFormatted)}</td></tr>
                <tr><td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; color: ${TEXT_MUTED};">Value</td><td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; text-align: right; color: ${NEON_CYAN};">${escapeHtml(notification.assetsFormatted)}</td></tr>
              </table>
              ${notification.txHash ? `<p style="margin: 14px 0 0 0;"><a href="${txUrl}" style="font-size: 11px; color: ${NEON_CYAN};">View transaction</a></p>` : ''}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
                <tr>
                  <td style="background-color: ${NEON_CYAN}; padding: 12px 24px; border: 1px solid ${NEON_CYAN};">
                    <a href="${APP_PORTFOLIO_URL}" style="font-family: Orbitron, Arial, sans-serif; font-size: 11px; font-weight: 900; letter-spacing: 0.1em; color: #000000; text-decoration: none; text-transform: uppercase;">Open IntuRank</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 24px; border-top: 1px solid ${NEON_GLOW_BORDER};">
              <p style="margin: 0; font-size: 10px; color: ${TEXT_MUTED}; letter-spacing: 0.08em;">Semantic markets · Quantify identity · Trust layer</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.replace(/\n\s+/g, '\n').trim();
}

/** Daily digest: your receipts + activity on holdings in one email. */
export function getDailyDigestHtml(options: {
  receipts: TransactionReceiptData[];
  activities: ActivityNotificationFormatted[];
  dateLabel: string;
}): string {
  const { receipts, activities, dateLabel } = options;
  const receiptRows = receipts.map((r) => {
    const action = r.type === 'acquired' ? 'Acquired' : 'Liquidated';
    const side = r.side === 'trust' ? 'Trust' : 'Distrust';
    return `<tr><td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; color: ${TEXT};">${escapeHtml(r.marketLabel)}</td><td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; text-align: right; color: ${r.type === 'acquired' ? NEON_GREEN : NEON_RED};">${action} · ${side}</td><td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; text-align: right;">${escapeHtml(r.sharesFormatted)}</td><td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; text-align: right;">${escapeHtml(r.assetsFormatted)}</td></tr>`;
  }).join('');
  const activityRows = activities.map((a) => {
    const action = a.type === 'liquidated' ? 'Liquidated' : 'Acquired';
    return `<tr><td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; color: ${TEXT};">${escapeHtml(a.marketLabel)}</td><td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; color: ${NEON_CYAN};">${escapeHtml(a.senderLabel)}</td><td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; text-align: right; color: ${a.type === 'liquidated' ? NEON_RED : NEON_GREEN};">${action}</td><td style="padding: 8px 12px; border-bottom: 1px solid ${BORDER}; text-align: right;">${escapeHtml(a.sharesFormatted)}</td></tr>`;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily digest — ${BRAND}</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background-color:#050508; font-family: Orbitron, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#050508;">
    <tr>
      <td align="center" style="padding: 32px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%; background-color:${BG_CARD}; border: 2px solid ${NEON_GLOW_BORDER};">
          <tr>
            <td style="padding: 0 24px 20px 24px; border-bottom: 2px solid ${NEON_GLOW_BORDER};">
              <img src="${LOGO_URL}" alt="${BRAND}" width="56" height="56" style="display: block; width: 56px; height: 56px; margin: 24px auto 16px auto; object-fit: contain;" />
              <p style="margin: 0 0 4px 0; font-size: 9px; font-weight: 700; letter-spacing: 0.25em; color: ${NEON_CYAN}; text-transform: uppercase; text-align: center;">${BRAND} · Daily digest</p>
              <p style="margin: 0; font-size: 11px; color: ${TEXT_MUTED}; text-align: center;">${escapeHtml(dateLabel)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 24px 28px 24px;">
              ${receipts.length > 0 ? `
              <p style="margin: 0 0 10px 0; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; color: ${NEON_CYAN}; text-transform: uppercase;">Your transactions</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 12px; color: ${TEXT}; border: 1px solid ${NEON_GLOW_BORDER}; margin-bottom: 24px;">
                <tr><td style="padding: 8px 12px; background: rgba(0,0,0,0.3); color: ${TEXT_MUTED}; font-weight: 700;">Market</td><td style="padding: 8px 12px; background: rgba(0,0,0,0.3); color: ${TEXT_MUTED}; text-align: right; font-weight: 700;">Action</td><td style="padding: 8px 12px; background: rgba(0,0,0,0.3); color: ${TEXT_MUTED}; text-align: right; font-weight: 700;">Shares</td><td style="padding: 8px 12px; background: rgba(0,0,0,0.3); color: ${TEXT_MUTED}; text-align: right; font-weight: 700;">Amount</td></tr>
                ${receiptRows}
              </table>
              ` : ''}
              ${activities.length > 0 ? `
              <p style="margin: 0 0 10px 0; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; color: ${NEON_CYAN}; text-transform: uppercase;">Activity on your holdings</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 12px; color: ${TEXT}; border: 1px solid ${NEON_GLOW_BORDER};">
                <tr><td style="padding: 8px 12px; background: rgba(0,0,0,0.3); color: ${TEXT_MUTED}; font-weight: 700;">Market</td><td style="padding: 8px 12px; background: rgba(0,0,0,0.3); color: ${TEXT_MUTED}; font-weight: 700;">Sender</td><td style="padding: 8px 12px; background: rgba(0,0,0,0.3); color: ${TEXT_MUTED}; text-align: right; font-weight: 700;">Action</td><td style="padding: 8px 12px; background: rgba(0,0,0,0.3); color: ${TEXT_MUTED}; text-align: right; font-weight: 700;">Shares</td></tr>
                ${activityRows}
              </table>
              ` : ''}
              ${receipts.length === 0 && activities.length === 0 ? `<p style="margin: 0; color: ${TEXT_MUTED};">No new activity in this period.</p>` : ''}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
                <tr>
                  <td style="background-color: ${NEON_CYAN}; padding: 14px 28px; border: 1px solid ${NEON_CYAN};">
                    <a href="${APP_PORTFOLIO_URL}" style="font-family: Orbitron, Arial, sans-serif; font-size: 11px; font-weight: 900; letter-spacing: 0.1em; color: #000000; text-decoration: none; text-transform: uppercase;">Open IntuRank</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 24px; border-top: 1px solid ${NEON_GLOW_BORDER};">
              <p style="margin: 0; font-size: 10px; color: ${TEXT_MUTED}; letter-spacing: 0.08em;">Semantic markets · Quantify identity · Trust layer</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.replace(/\n\s+/g, '\n').trim();
}
