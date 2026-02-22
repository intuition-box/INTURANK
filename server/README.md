# Email API (Ensend)

This server forwards send-email requests from the app to [Ensend](https://ensend.co) (api.ensend.co) so that your project secret stays server-side.

## Setup

1. **Ensend**
   - Sign up at [Ensend](https://ensend.co) and create a project.
   - In your project, open **Credentials** (or **Settings → Credentials**) and copy:
     - **Project Secret**
     - **Sender Address** (e.g. default like `yourproject@ensend.co` or your custom domain)

2. **Authorized origins**
   - In Ensend, add your app’s origin(s) to the project secret’s **Authorized Origins** (e.g. `http://localhost:5173`, `https://yourapp.com`).  
   - For local dev, add `http://localhost:5173` (or whatever port Vite uses).

3. **Env**
   - In the **project root**, create or edit `.env` or `.env.local` and add:

```env
ENSEND_PROJECT_SECRET=your_project_secret_here
ENSEND_SENDER_EMAIL=yourproject@ensend.co
ENSEND_SENDER_NAME=IntuRank
PORT=3001
```

4. **Run**
   - From project root:
     - **Terminal 1:** `npm run email-server` (starts this server on port 3001).
     - **Terminal 2:** `npm run dev` (Vite proxies `/api` to the email server).
   - With both running, the app sends notification emails through Ensend when users are subscribed and activity happens on their holdings.

## Production: Deploy on Railway

Railway runs the email server 24/7 with no cold starts. Use the same repo; no separate “email-only” repo needed.

### 1. Create the project on Railway

1. Go to [railway.app](https://railway.app) and sign in (GitHub is fine).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select this repo (`IntuRank-Vanguard` or whatever it’s named). Authorize if asked.
4. Railway will create a new **service** from the repo.

### 2. Configure the service

1. Open the new service → **Settings** (or **Variables**).
2. **Build:** Leave defaults. Railway will run `npm install` and use `npm start` (which runs `node server/index.js`).
3. **Root Directory:** Leave blank (repo root is correct).
4. **Start Command:** Leave blank so it uses `npm start`.

### 3. Add environment variables

In the service, go to **Variables** and add:

| Variable | Value |
|----------|--------|
| `ENSEND_PROJECT_SECRET` | Your Ensend project secret |
| `ENSEND_SENDER_EMAIL` | Your sender email (e.g. from Ensend) |
| `ENSEND_SENDER_NAME` | `IntuRank` (or whatever you want) |

Do **not** set `PORT`; Railway sets it automatically.

### 4. Get the public URL

1. In the service, open **Settings** → **Networking** (or **Deployments**).
2. Click **Generate Domain**. Railway will assign a URL like `your-service-name-production.up.railway.app`.
3. Copy that URL (no trailing slash). This is your **email API base URL**.

### 5. Tell the frontend to use it

1. In **Ensend**, add your **production site URL** (e.g. `https://yourdomain.com`) to **Authorized Origins**.
2. In **GitHub**: repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   - Name: `VITE_EMAIL_API_URL`
   - Value: the Railway URL you copied (e.g. `https://your-service-name-production.up.railway.app`).
3. Push to `main` (or re-run the deploy workflow) so the next build uses this URL. After that, the live site will send emails through your Railway server.

---

**Other hosts (Render, Fly.io, etc.):** Deploy the repo, set the same env vars, and run `npm start` (or `node server/index.js`). Then set `VITE_EMAIL_API_URL` in GitHub Actions to that host’s URL.

## Endpoint

- **POST /api/send-email**  
  Body: `{ "to": "user@example.com", "subject": "...", "message": "..." }`  
  Responds with `{ "ok": true }` on success or an error object on failure.
