/**
 * Email API server that forwards send requests to Ensend (api.ensend.co).
 * Keeps project secret and sender credentials server-side.
 *
 * Env (in project root .env or .env.local):
 *   ENSEND_PROJECT_SECRET  - from Ensend project credentials
 *   ENSEND_SENDER_EMAIL   - sender address (e.g. yourproject@ensend.co or your domain)
 *   ENSEND_SENDER_NAME    - e.g. "IntuRank"
 *   PORT                  - default 3001
 *   EMAIL_DATA_DIR        - optional; directory for email-subs.json / follows.json (e.g. /app/email-data with a Docker volume)
 *
 * Run: npm run email-server
 * In dev, Vite proxies /api to this server.
 */

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env and .env.local from project root (when run as node server/index.js)
dotenv.config();
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;

const ENSEND_SEND_URL = 'https://api.ensend.co/send';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.EMAIL_DATA_DIR || __dirname;
try {
  mkdirSync(DATA_DIR, { recursive: true });
} catch {
  // ignore
}
const SUBS_PATH = path.join(DATA_DIR, 'email-subs.json');
const FOLLOWS_PATH = path.join(DATA_DIR, 'follows.json');

async function loadFollowsStore() {
  try {
    const raw = await fs.readFile(FOLLOWS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveFollowsStore(store) {
  try {
    await fs.writeFile(FOLLOWS_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('[email-api] Failed to persist follows', e);
  }
}

async function loadSubscriptions() {
  try {
    const raw = await fs.readFile(SUBS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveSubscriptions(subs) {
  try {
    await fs.writeFile(SUBS_PATH, JSON.stringify(subs, null, 2), 'utf8');
  } catch (e) {
    console.error('[email-api] Failed to persist subscriptions', e);
  }
}

app.use(cors({ origin: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'email-api' });
});

// So root URL doesn't show "Cannot GET /" and you can confirm env is set (no secrets exposed)
app.get('/', (_req, res) => {
  const secret = process.env.ENSEND_PROJECT_SECRET;
  const sender = process.env.ENSEND_SENDER_EMAIL;
  res.status(200).json({
    service: 'inturank-email-api',
    ok: true,
    emailConfigured: !!(secret && sender),
  });
});

// Store email subscriptions server-side so worker can send alerts for everyone
app.post('/api/email-subscribe', async (req, res) => {
  const { wallet, email, nickname, alertFrequency } = req.body || {};
  if (!wallet || !email) {
    return res.status(400).json({ error: 'Missing wallet or email' });
  }
  const normalizedWallet = String(wallet).toLowerCase();
  const normalizedEmail = String(email).trim().toLowerCase();
  try {
    const subs = await loadSubscriptions();
    const idx = subs.findIndex((s) => s.wallet.toLowerCase() === normalizedWallet);
    const next = {
      wallet: normalizedWallet,
      email: normalizedEmail,
      nickname: nickname?.trim() || undefined,
      alertFrequency: alertFrequency === 'daily' ? 'daily' : 'per_tx',
      subscribedAt: Date.now(),
      follows: req.body?.follows && Array.isArray(req.body.follows) ? req.body.follows : (subs[idx]?.follows || []),
    };
    if (idx >= 0) subs[idx] = { ...subs[idx], ...next };
    else subs.push({ ...next, follows: next.follows || [] });
    await saveSubscriptions(subs);
    const store = await loadFollowsStore();
    store[normalizedWallet] = next.follows || [];
    await saveFollowsStore(store);
    res.json({ ok: true });
  } catch (e) {
    console.error('[email-api] subscribe error', e);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

app.post('/api/email-unsubscribe', async (req, res) => {
  const { wallet } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'Missing wallet' });
  const normalizedWallet = String(wallet).toLowerCase();
  try {
    const subs = await loadSubscriptions();
    const filtered = subs.filter((s) => s.wallet.toLowerCase() !== normalizedWallet);
    await saveSubscriptions(filtered);
    res.json({ ok: true });
  } catch (e) {
    console.error('[email-api] unsubscribe error', e);
    res.status(500).json({ error: 'Failed to update subscriptions' });
  }
});

// Get follows for a wallet (so frontend can restore after refresh/new device)
app.get('/api/follows', async (req, res) => {
  const wallet = (req.query.wallet || req.query.w || '').toString().trim();
  if (!wallet) return res.status(400).json({ error: 'Missing wallet' });
  const normalizedWallet = String(wallet).toLowerCase();
  try {
    const store = await loadFollowsStore();
    let list = Array.isArray(store[normalizedWallet]) ? store[normalizedWallet] : [];
    if (list.length === 0) {
      const subs = await loadSubscriptions();
      const sub = subs.find((s) => s.wallet.toLowerCase() === normalizedWallet);
      if (sub && Array.isArray(sub.follows)) list = sub.follows;
    }
    return res.json({ follows: list });
  } catch (e) {
    console.error('[email-api] get follows error', e);
    return res.status(500).json({ error: 'Failed to load follows' });
  }
});

// Sync follows so the email worker can send alerts when people you follow trade.
// Persists for all wallets so we can restore on frontend after refresh/new device.
app.post('/api/sync-follows', async (req, res) => {
  const { wallet, follows } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'Missing wallet' });
  const normalizedWallet = String(wallet).toLowerCase();
  const list = Array.isArray(follows) ? follows : [];
  try {
    const subs = await loadSubscriptions();
    const idx = subs.findIndex((s) => s.wallet.toLowerCase() === normalizedWallet);
    if (idx >= 0) {
      subs[idx] = { ...subs[idx], follows: list };
      await saveSubscriptions(subs);
    }
    const store = await loadFollowsStore();
    store[normalizedWallet] = list;
    await saveFollowsStore(store);
    res.json({ ok: true });
  } catch (e) {
    console.error('[email-api] sync-follows error', e);
    res.status(500).json({ error: 'Failed to sync follows' });
  }
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

// Optionally start the background email worker in the same process.
// Useful in production (Coolify, Railway, etc.) so one always-on service
// serves the API and sends alerts without relying on the user's browser.
if (process.env.ENABLE_EMAIL_WORKER === 'true') {
  import('./email-worker.js')
    .then(() => {
      console.log('[email-api] Email worker attached (ENABLE_EMAIL_WORKER=true).');
    })
    .catch((err) => {
      console.error('[email-api] Failed to start email worker', err);
    });
}
