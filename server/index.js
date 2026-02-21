/**
 * Email API server that forwards send requests to Ensend (api.ensend.co).
 * Keeps project secret and sender credentials server-side.
 *
 * Env (in project root .env or .env.local):
 *   ENSEND_PROJECT_SECRET  - from Ensend project credentials
 *   ENSEND_SENDER_EMAIL   - sender address (e.g. yourproject@ensend.co or your domain)
 *   ENSEND_SENDER_NAME    - e.g. "IntuRank"
 *   PORT                  - default 3001
 *
 * Run: npm run email-server
 * In dev, Vite proxies /api to this server.
 */

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

// Load .env and .env.local from project root (when run as node server/index.js)
dotenv.config();
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;

const ENSEND_SEND_URL = 'https://api.ensend.co/send';

app.use(cors({ origin: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'email-api' });
});

app.post('/api/send-email', async (req, res) => {
  const secret = process.env.ENSEND_PROJECT_SECRET;
  const senderEmail = process.env.ENSEND_SENDER_EMAIL;
  const senderName = process.env.ENSEND_SENDER_NAME || 'IntuRank';

  if (!secret || !senderEmail) {
    return res.status(503).json({
      error: 'Email not configured',
      message: 'Set ENSEND_PROJECT_SECRET and ENSEND_SENDER_EMAIL in .env or .env.local.',
    });
  }

  const { to, subject, message, html, templateId, variables } = req.body || {};
  if (!to) {
    return res.status(400).json({ error: 'Missing to' });
  }

  // Template send: use Ensend template ID + variables (Ensend requires message + subject)
  if (templateId) {
    const fallbackMessage = "You're subscribed to IntuRank email alerts. We'll notify you when there's activity on your holdings.";
    const payload = {
      subject: subject || "You're in — IntuRank Email Alerts",
      message: (typeof message === 'string' && message.trim()) ? message : fallbackMessage,
      sender: { name: senderName, email: senderEmail },
      recipients: to,
      templateId,
      ...(variables && Object.keys(variables).length ? { variables } : {}),
    };

    console.log('[send-email] Sending via template', templateId, 'to', to, 'payload keys:', Object.keys(payload));

    try {
      const response = await fetch(ENSEND_SEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('[send-email] Ensend template error', response.status, data);
        return res.status(response.status).json({
          error: 'Send failed',
          details: data?.message || data?.error || response.statusText,
        });
      }
      console.log('[send-email] OK (template) for', to);
      return res.json({ ok: true });
    } catch (err) {
      console.error('[send-email]', err);
      return res.status(500).json({ error: 'Send failed', details: err.message });
    }
  }

  if (!subject) {
    return res.status(400).json({ error: 'Missing subject (required when not using templateId)' });
  }

  const payload = {
    subject,
    message: html || message || subject,
    sender: { name: senderName, email: senderEmail },
    recipients: to,
  };
  if (html) {
    payload.html = html;
    payload.body = html;
  }

  console.log('[send-email] Sending to', to, 'subject:', subject);

  try {
    const response = await fetch(ENSEND_SEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[send-email] Ensend error', response.status, data);
      return res.status(response.status).json({
        error: 'Send failed',
        details: data?.message || data?.error || response.statusText,
      });
    }
    console.log('[send-email] OK for', to);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[send-email]', err);
    return res.status(500).json({ error: 'Send failed', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Email API running at http://localhost:${PORT}`);
});
