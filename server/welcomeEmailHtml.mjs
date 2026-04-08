/**
 * Welcome email HTML — keep in sync with services/emailTemplates.ts getWelcomeEmailHtml.
 */
const BRAND = 'IntuRank';
const PRIMARY = '#00f3ff';
const BG_DARK = '#020308';
const BORDER_CYAN = 'rgba(0, 243, 255, 0.5)';
const TEXT = '#e2e8f0';
const TEXT_MUTED = '#94a3b8';
const LOGO_URL =
  'https://cdn.emailacademy.com/user/0c169d4940dec83184e5e6dc6e7097fb6984c5baa311d5e3342bd4929308f702/IntuRanklogo-1.jpg2026_02_21_01_38_06.jpeg';
const APP_ROOT_URL = 'https://inturank.intuition.box/';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getWelcomeEmailHtml(options = {}) {
  const nickname = options.nickname?.trim();
  const email = options.email?.trim();
  const greeting = nickname
    ? `Hey ${escapeHtml(nickname)},`
    : email
      ? `Hey ${escapeHtml(email)},`
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
`
    .replace(/\n\s+/g, '\n')
    .trim();
}
