## IntuRank Changelog — V1.4.0 → V1.5.0

### V1.5.0 (current)

- **Portfolio & PnL**
  - Made portfolio PnL **curve‑aware** so positions on Linear and Offset Progressive (exponential) curves are valued correctly per vault/curve pair.
  - Enriched `getUserHistory` and `getUserPositions` with **curve IDs** and vault totals so downstream views (portfolio, public profile) can display accurate performance per curve.
  - Updated portfolio and public profile UIs to **pass curve IDs through to PnL calculations** and show a clear **curve label badge** on each position.

- **Notifications & email alerts**
  - Implemented **wallet‑linked email subscriptions** (local, per‑wallet) with support for:
    - `per_tx` mode — one email per buy/sell event.
    - `daily` mode — daily digest (per‑tx emails suppressed when this is selected).
  - Added **Email Alerts modal** (`EmailNotifyModal`) wired into `EmailNotifyContext` and the `Account` page, so users can:
    - Add/change their email and optional nickname.
    - Choose alert frequency (per‑transaction vs daily summary).
    - Delete their email, which stops future emails for that wallet in that browser/profile.
  - Built a richer **Notification Bar**:
    - Polls `getActivityOnMyMarkets` every 60s to show **“Activity on your claims”** (others buying/selling in claims you hold).
    - Groups activity by **Today / Yesterday / This week / Older**, with filters for `All`, `Acquired`, and `Liquidated`.
    - Uses a **per‑wallet, persisted “read” set** so clearing notifications is sticky across sessions.
  - **Activity emails for your holdings**
    - Introduced `requestEmailNotification`, which sends HTML emails for activity on markets where you hold shares, deduped by a persisted **“already notified IDs”** set.
    - Fixed a bug where emails were only sent for **newly polled** events after the first fetch:
      - Now, on first load, recent activity (last ~2 hours) can also trigger emails, so you get alerts for events that happened while the app was closed.
      - Subsequent polls still only send for **new** events per wallet, avoiding duplicates.
  - **Followed identity activity emails**
    - Added `getActivityBySenderIds` and `requestFollowedActivityEmail` so you can opt into alerts when **identities you follow** buy or sell.
    - Uses a separate “notified follow” ID set per wallet so follower activity emails are also deduped.
  - **Transaction receipt emails**
    - Added `sendTransactionReceiptEmail` and wired it into `MarketDetail` and `AgentProfile` so users get a **receipt email** when they **acquire or liquidate** shares (type, side, amount, and tx hash).

- **Email infrastructure**
  - Integrated the app with the **Ensend‑backed email server** (`server/`):
    - Frontend now talks to a single `/api/send-email` endpoint (local or Railway/production), which securely forwards to Ensend with the project secret kept server‑side.
    - Added support for **HTML email templates**: welcome email, activity notifications, followed‑identity activity, and transaction receipts.
  - Added robust error handling and logging around all email sends so failures are non‑blocking in the UI but visible in console/server logs.

- **UX & polish**
  - Refined copy and micro‑interactions in the Notification Bar and Email Alerts flows:
    - Clearer language around “activity on your claims” vs. transaction receipts.
    - Stronger visual hierarchy for unread vs read activity.
    - Consistent cyber‑aesthetic buttons, hover states, and keyboard focus handling.
  - Improved resilience of activity feeds:
    - Safe fallbacks when indexer is lagging or returns partial data.
    - Defensive guards against duplicate events from the subgraph.

---

### V1.4.x (previous series, high level)

- **Core trading experience**
  - Stable **acquire / redeem** flows for TRUST (₸) positions against a single‑curve configuration.
  - `MarketDetail` stake/redeem flows with on‑chain transaction modals and local activity log.
  - Baseline portfolio view with PnL that did not yet differentiate between multiple curve types.

- **Early notifications**
  - Initial Notification Bar showing a **flat list** of recent activity without curve context or email integration.
  - First version of wallet‑scoped read state (marking items as “seen” locally).

- **Foundations**
  - Initial integration with the Intuition graph (agents/claims, triples, and vaults).
  - Early Agent Profile screen surfacing basic metadata and stake entry point.

> This changelog is written to brief collaborators (e.g. social media, community) on what changed between **V1.4.0 and V1.5.0**. For more granular, developer‑level notes we can extend this file release‑by‑release.

