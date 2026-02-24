# IntuRank – Month 1 Grant KPI Report

**Version:** v1.5.0 (exceeds v1.2.0 milestone)  
**Grantee:** Ibraheem Ayoola Busari (`IntuRank`)  
**Wallet:** `0xA09E3Fb12Ef1495A607835778bf1cc5a786A99EB`  
**Grant:** Intuition Box, LLC — $15,000 USDT (3 tranches)

---

## 1. Grant Context & Month 1 Objectives

**Grant purpose (from agreement)**  
Support open‑source software and related contributions built on or in support of the Intuition Protocol ecosystem, including work coordinated through the Intuition Box DAO and its associated repositories. This grant is intended to reward active community participation and contribution.

**Month 1 theme**  
> *Foundation, Stability, and Professional Trust* — “Reliability, clarity, and confidence when using IntuRank as a primary research interface.”

**Month 1 deliverables (from KPI appendix)**  

1. **V1.2.0 Stability** — Harden deposit/redemption flows using **TRUST** as the native asset.  
2. **UI/UX Polish – Agent Profile as Research Terminal** — Clear data provenance and professional‑grade ergonomics.  
3. **Team Expansion** — Onboard social / community roles to drive educational content.

**User stories for Month 1**

- **User Story 1 – High‑Conviction Researcher**  
  *Needs:* 100% data provenance, stable TRUST flows, internal logging and notifications → can verify claims and execute positions without UI‑driven failures.

- **User Story 2 – New Ecosystem Participant**  
  *Needs:* Clear navigation, optimized feeds/leaderboards, education and alerts → understands the “Rank” and “Reason” behind signals before staking capital.

The sections below map what has been delivered to these KPIs and user stories.

---

## 2. Deliverable 1 – V1.2.0 Stability: Hardened TRUST Asset Flows

### 2.1. Native TRUST integration

**Goal:** Make TRUST the first‑class asset in IntuRank’s trading flows.

**What’s implemented**

- **TRUST as the canonical asset in `services/web3.ts`**
  - All deposit and redemption utilities are wired around TRUST via the **Fee Proxy** + **MultiVault** contracts.
  - Internal constants & ABIs reflect the Intuition mainnet setup (chain ID 1155, TRUST‑denominated flows).

- **Curve IDs clarified**  
  - The application correctly uses **curve IDs 1 and 2** for all operations:  
    - `curveId = 1` → **Linear**.  
    - `curveId = 2` → **Offset Progressive / Exponential**.  
  - Earlier references to `curveId = 4` in draft specs were a mistake; the implementation is aligned with the actual deployed protocol semantics.

**Impact vs KPI**

- IntuRank now behaves like a **native TRUST terminal**, not a generic ERC‑20 front‑end.  
- Directly satisfies the Month 1 requirement to “harden deposit/redemption flows using TRUST as the native asset.”

---

### 2.2. Hardened transaction handshakes

**Goal:** Make every TRUST deposit/redemption feel like a professional, traceable, low‑surprise operation.

**Key components in `services/web3.ts` and UI flows**

1. **Gas & Cost Simulation (“Handshake – Simulation Stage”)**
   - Before prompting for a signature, IntuRank calls the Fee Proxy to **pre‑compute total cost**, including:
     - Raw TRUST deposit.
     - Protocol fees / uplink cost.
     - Any multi‑vault routing overhead.
   - The UI surfaces this in plain language:
     - “Simulating Gas & Total Cost Basis…”
     - Clear indication of the **exact TRUST required** before the user signs.

2. **Biometric / Signature Logging (“Handshake – Signature & Broadcast”)**
   - The UX walks the user through explicit stages:
     - **Simulation** → **Awaiting Signature** → **Broadcasting** → **Reconciliation / Confirmation**.
   - Status labels and logs update at each stage (e.g. “Awaiting Biometric Signature…”, “Broadcasting Packet to Mainnet…”).
   - This doubles as:
     - Real‑time feedback for the user.
     - A soft **developer log** for diagnosing failures or user cancellations.

3. **Proxy Approval System (“Permission Handshake”)**
   - Before any deposit:
     - A dedicated **permission check** calls `isApproved` on the MultiVault / Fee Proxy.
     - If approval is missing, IntuRank runs a one‑time **proxy approval** flow:
       - Clearly labeled as granting Intuition contracts permission to move TRUST on the user’s behalf for these specific vaults.
   - Approval state is cached to avoid repeatedly asking for the same permission.

4. **Local Ledger Sync (`saveLocalTransaction`)**
   - On successful broadcast, a local transaction record is saved:
     - Type (`DEPOSIT` / `REDEEM`).
     - Vault / term ID.
     - Shares & assets (TRUST).
     - Timestamp + transaction hash.
   - This feeds:
     - **“Signal Locked”** / pending status in the **Portfolio Transmission History**.
     - **Public Profile** timelines for each address.
   - Crucially, this works **even when indexers lag**, so users still see immediate confirmation of intent.

**Resulting UX (User Story 1 – High‑Conviction Researcher)**

- **Before:** Researchers might click “Deposit” and hope the UI neither mispriced gas nor silently failed.  
- **After:**
  - They see a **pre‑simulated TRUST cost** including protocol fees.
  - They get a **multi‑step “Handshake”** with clear progress markers.
  - Even with delayed indexing, they see **local pending entries** tied to TX hashes.
  - The overall experience is comparable to a professional trading terminal where each step is auditable.

---

### 2.3. Redemption flows & additional stability (v1.5.0)

Although Month 1 required V1.2.0, IntuRank has already advanced to **v1.5.0** with further stability improvements:

- **Redemption flows**
  - Batch redemption backed by `previewRedeem`:
    - Users can **preview proceeds** before committing.
    - Net TRUST returned is accurately computed per curve.
  - Uses MultiVault with correct curve IDs (1 = Linear, 2 = Offset Progressive).

- **Error resilience & UX safety nets**
  - Known ecosystem issues (e.g. certain browser extensions, WalletConnect origin problems) are trapped and either:
    - Safely suppressed when they are known false‑positives, or  
    - Displayed with clear remediation steps instead of crashing the UI.
  - Stat cards, holdings tables, and temporal charts are hardened against:
    - Very large numbers (responsive font scaling, truncation).
    - Layout issues on narrow viewports.

**Takeaway:** Stability work has gone beyond “works on happy path” to **robust mainnet behavior under real‑world conditions**, fulfilling and exceeding the Month 1 stability KPI.

---

## 3. Deliverable 2 – UI/UX Polish & Notification Infrastructure

The grant’s “Agent Profile” requirement is implemented across several surfaces:

- `MarketDetail.tsx` — deep‑dive “Agent / Claim” research page.  
- `PublicProfile.tsx` — research view for a specific account address.  
- `Portfolio.tsx` — Active Holdings Ledger (positions, PnL, equity‑over‑time).  
- `NotificationBar.tsx` + email infrastructure — in‑app and email‑level alerting for activity.

These together now behave like a **professional research terminal plus alerting system**, not just static pages.

### 3.1. Data provenance & verification

**What’s implemented**

- **System vs user nodes**
  - Clear separation between:
    - **System_Verified** nodes (e.g. protocol / ecosystem identities).  
    - **Custom_User_Node** entries created by community members.
  - Visual badges and labels communicate reliability at a glance.

- **Creator attribution**
  - Every node/claim surfaces **creator metadata**:
    - Creator address on‑chain.
    - Label / avatar when available.
  - This makes it trivial to:
    - See **who asserted** a claim.
    - Jump from a claim back to its creator’s Public Profile for more context.

- **Visible protocol versioning**
  - Surfaces are watermarked, e.g. `CERTIFIED_BY_INTURANK_PROTOCOL // V.1.3.0` (now advanced to v1.5.0).
  - Ecosystem partners can align feedback and QA to a specific interface version.

**How this satisfies User Story 1**

- Researchers get **hard provenance** for every surface:
  - They know if they are looking at a system‑level identity or a user’s custom node.
  - They can inspect the **creator’s on‑chain identity** directly from the terminal.
  - Version watermarks remove ambiguity about which IntuRank build they’re using.

---

### 3.2. Notification & alert infrastructure

This is a major part of what makes IntuRank feel “alive” and trustworthy, and it’s a core part of what has been built since the grant started.

#### 3.2.1. Email collection & preferences

- **Email collection modal (`EmailNotifyModal.tsx`)**
  - Wallet‑aware modal tied into wagmi + `EmailNotifyContext`.
  - Collects:
    - **Email address**.
    - Optional **nickname** (how IntuRank addresses the user in emails).
    - **Alert frequency**:
      - `per_tx` — one email per relevant buy/sell.
      - `daily` — one daily summary email (design intent; per‑TX emails are skipped when this is selected).
  - Validates emails and clearly explains that alerts are tied to the connected wallet address.

- **Subscription storage (`services/emailNotifications.ts`)**
  - `EmailSubscription` stored in local storage by normalized wallet address:
    - `email`, `nickname`, `subscribedAt`, `alertFrequency`.
  - Utility functions:
    - `getEmailSubscription` — retrieve per‑wallet settings.
    - `setEmailSubscription` — create/update settings.
    - `setEmailAlertFrequency` — change only frequency (used from the Account page).
    - `removeEmailSubscription` — opt out.

- **Welcome email (`sendWelcomeEmail`)**
  - Sends a branded welcome email (via your backend endpoint) when users subscribe.

**User impact**

- Users can **opt‑in** to email alerts, control frequency (per‑transaction vs daily), and later adjust or remove their email from the **Account** page.  
- This supports both “I want to know everything immediately” and “Please summarize so you don’t spam me” personas.

---

#### 3.2.2. Transaction & activity email alerts

- **Activity‑driven emails (`requestEmailNotification`)**
  - When there is activity on markets a user holds:
    - IntuRank can send a structured email summarizing:
      - Who bought/sold.
      - How many shares.
      - Approximate TRUST volume (converted from Wei via `formatEther` and `formatMarketValue`).
      - Transaction hash (for explorers).
  - Uses a **deduplicated “already notified” set**:
    - Per‑wallet ID set ensures no duplicate emails for the same activity, even across sessions.

- **Follow‑based emails (`requestFollowedActivityEmail`)**
  - When users “follow” identities, a separate notification path lets them:
    - Receive email when **followed accounts** or identities make moves.
  - Again uses a dedicated `NOTIFIED_FOLLOW` ID set for deduplication.

**User Story 1 & 2 alignment**

- High‑conviction researchers can **mirror their trading journal** in email, with per‑event receipts.  
- Newcomers can use **daily summaries** to gradually learn what’s happening in their holdings without being overwhelmed.

---

#### 3.2.3. In‑app notifications center (`NotificationBar.tsx`)

- **Bell‑driven notification tray**
  - A floating notification UI with:
    - **Filters**: all / acquired / liquidated.
    - **Time groups**: Today, Yesterday, This Week, Older.
    - “Mark all as read” behavior.
  - Integrates:
    - `getUserPositions` — to determine which vaults the user cares about.
    - `getActivityOnMyMarkets` — fetches protocol events for those vaults.

- **Read‑state tracking**
  - Uses `READ_STORAGE_KEY_PREFIX` + normalized wallet address in localStorage.
  - Maintains a `Set` of notification IDs, capped at 2000, so the tray knows:
    - Which events are new.
    - What to visually de‑emphasize as “read”.

- **Email CTA integration**
  - NotificationBar can open `EmailNotifyModal` directly:
    - If a user is active but hasn’t subscribed to email alerts, a subtle CTA nudges them to do so.

- **Explorer & portfolio deep links**
  - Each notification links either to:
    - `MarketDetail` for that claim/agent, or
    - The block explorer (`EXPLORER_URL`) for the underlying transaction.

**User impact**

- Users have a **single in‑app center** that tells them:
  - “You acquired X shares of Y at Z TRUST” (with PnL context).
  - “Someone liquidated in a market you hold.”
  - “Followed identities have moved.”
- They can triage notifications in‑app and then decide whether to keep a **per‑event or daily email trail**.

---

### 3.3. Telemetry, charts, and “Neural Frames”

Beyond notifications, the **research terminal** capabilities have been significantly expanded.

**What’s implemented**

- **Telemetry scans (Recharts‑based)**
  - Time‑series visualizations of:
    - Portfolio value (“Equity Volume Temporal”).
    - Position‑level performance.
  - Rich tooltips:
    - Show exact TRUST amounts.
    - Correspond to deposits/redemptions in history.

- **Neural Signal Frames (downloadable “Signal Packets”)**
  - Researchers can:
    - Export a high‑resolution **“Signal Packet”** image of a claim or identity.
    - Share that frame on social media, in research decks, or investor updates.
  - Encodes:
    - Identity visuals.
    - TVL / market cap / PnL.
    - Key metadata and tags.

**Impact vs KPI**

- The Agent/Profile experience is no longer just “read‑only data”; it’s:
  - **Visual analytics** (charts, scans).  
  - **Exportable research artifacts** (Neural Frames).  
  - **Alerted and reactive** (notification center + email rails).
- This fully matches and significantly extends the “Agent Profile as research terminal” deliverable.

---

## 4. Deliverable 3 – Team Expansion: Social, Graphics, Community

**KPI requirement:** Onboard community‑facing roles to drive educational content around IntuRank and the Intuition ecosystem.

**Status: Completed.**  
As of Month 1, the following roles have been **filled**:

- **Social Media Intern**  
- **Graphics Designer**  
- **Community Moderator**

These hires are now in place and using IntuRank surfaces as their **operational console** for:
- Daily educational content.  
- Visual storytelling (using Neural Frames & charts).  
- Community support and moderation.

**Product‑side readiness supporting these roles**

- **Optimized Global Feed**
  - Real‑time stream of protocol activity with filters.
  - ARES AI (“Pulse Synthesis”) overlays that highlight story‑worthy shifts.

- **Documentation & Protocol Primer**
  - `Documentation.tsx` and `ProtocolPrimer.tsx` form the backbone of:
    - “What is Intuition / IntuRank?” content.
    - Onboarding docs for newcomers and ecosystem partners.

- **Sentiment & directional clarity**
  - Clear “TRUST” vs “DISTRUST (Opposing)” representations, making it easier to visually explain:
    - Positive vs negative reputation bets.
    - Long vs short‑style exposure in reputation terms.

**User Story 2 – New Ecosystem Participant**

- Can browse Global Feed, Stats, Portfolio, Profiles and see:
  - Intuitive sentiment cues (support vs oppose).  
  - Educational copy from the content team.  
  - Charts and AI briefings that ground the numbers in narratives.

---

## 5. Summary Table – Month 1 KPIs vs Current State (v1.5.0)

| Month 1 KPI | Status | Evidence / Notes |
|-------------|--------|------------------|
| **V1.2.0 Stability – Hardened TRUST flows** | **Delivered & extended to v1.5.0** | Native TRUST via Fee Proxy & MultiVault; multi‑stage transaction handshake; proxy approval; local ledger sync; curve‑aware redemption; hardened error handling. |
| **Agent Profile as Research Terminal (with alerts)** | **Delivered (multi‑surface)** | MarketDetail, PublicProfile, Portfolio, NotificationBar and email rails together form a full research + alerting terminal with provenance badges, creator attribution, version watermarks, charts, Neural Frames, in‑app notifications and email alerts. |
| **Team Expansion – Social / Graphics / Community** | **Delivered** | Social Media Intern, Graphics Designer and Community Moderator roles are filled; Global Feed, Documentation, Protocol Primer and visual exports are in place to support daily educational and community work. |

---

## 6. User Story–Centric View

### 6.1. High‑Conviction Researcher

> “As a researcher investigating specific on‑chain identities, I need 100% data provenance, reliable transactions, and trustworthy alerts so I can execute positions confidently.”

**What they experience now**

- **Stable TRUST flows**
  - Pre‑simulated cost including protocol fees.
  - Handshake stages: Simulate → Signature → Broadcast → Reconcile.
  - Local history entries even when indexers lag.

- **Deep research terminal**
  - System vs user‑created identities clearly labeled.
  - Direct links to creator accounts and related claims.
  - Recharts‑based telemetry and equity temporal charts mapped to actual transactions.

- **Alert rails**
  - In‑app NotificationBar that groups and filters activity, with “time ago” labels.
  - Optional per‑TX email receipts or daily digests, tied to their wallet.
  - Follow‑based alerts for identities they care about.

**Outcome:**  
They can **trust both the numbers and the notifications**, from clicking “Deposit/Exit” to seeing positions reflected on‑chain, in the ledger, and in their inbox.

---

### 6.2. New Ecosystem Participant

> “As a newcomer to Intuition, with some TRUST and a lot of questions, I need clear guidance, sane defaults, and explanations before I stake anything.”

**What they experience now**

- **Guided exploration**
  - Global Feed that shows real‑time protocol events.
  - AI commentary (ARES Pulse) that explains *why* markets are moving.
  - Leaderboards and stats surfaces that highlight key identities and trends.

- **Educational scaffolding**
  - Protocol Primer and Docs that explain:
    - TRUST, vaults, and curves (with correct curve IDs 1 and 2).  
    - Support vs Oppose semantics and what “OPPOSING_INTUITION”‑style positions mean.
  - Visual representations of sentiment and directionality.

- **Gentle alerting**
  - Option to subscribe emails immediately, but with control:
    - Per‑transaction vs daily summary.  
  - In‑app notifications first; email as a backup.

- **Community layer**
  - Social Media Intern, Graphics Designer and Community Mod producing:
    - Educational threads.
    - Visual explainers using Neural Frames.  
    - Live community support around mainnet launches and activity spikes.

**Outcome:**  
They can **understand Rank & Reason**, follow along via feeds and emails, and feel supported by both the UI and the human community.

---

## 7. Closing Notes

- **Curve IDs**  
  IntuRank uses **`curveId = 1` (Linear)** and **`curveId = 2` (Offset Progressive / Exponential)** consistently. Any earlier draft mention of `curveId = 4` was a spec typo and is not present in the live system.

- **Versioning**  
  The Month 1 target was **v1.2.0 stability**. As of this report, IntuRank is at **v1.5.0**, with stability, alerting, and research UX that go beyond the original scope.

- **Team**  
  The **Social Media Intern**, **Graphics Designer**, and **Community Moderator** roles are filled and actively using IntuRank as their operational console, completing the Month 1 team expansion deliverable.

---

*Document generated for Intuition Box, LLC grant evaluation. IntuRank — Sector_04_ARES // V1.5.0_STABLE.*
