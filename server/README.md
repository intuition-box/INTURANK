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

## Production

- Deploy this server (e.g. Node on Railway, Render, or a serverless function).
- Set the same env vars there (`ENSEND_PROJECT_SECRET`, `ENSEND_SENDER_EMAIL`, `ENSEND_SENDER_NAME`).
- In the frontend build, set `VITE_EMAIL_API_URL` to your deployed email API base URL (e.g. `https://email-api.yourapp.com`) so the app calls your server instead of relative `/api`.

## Endpoint

- **POST /api/send-email**  
  Body: `{ "to": "user@example.com", "subject": "...", "message": "..." }`  
  Responds with `{ "ok": true }` on success or an error object on failure.
