
# 🌐 IntuRank

> **The Semantic Trust-Graph Intelligence Layer**
> *Stake on Identity. Short the Noise. Profit from Truth.*

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.4.0--stable-green)
![Network](https://img.shields.io/badge/network-Intuition%20Mainnet-purple)

## 📖 Overview

**IntuRank** is a high-fidelity prediction market interface built natively on the [Intuition Network](https://intuition.systems). It visualizes reputation as a tradable asset, allowing users to signal trust (or distrust) on any identity, claim, or concept ("Atoms") within the graph.

By combining financial incentives with semantic data, IntuRank creates a **"Credit Score for Everything"**—a decentralized mechanism to curate truth and reputation in an age of information overload.

## ✨ Key Features

### 📉 Semantic Markets
- **Trade Reputation:** Buy and sell shares in specific Agents/Atoms using the `MultiVault` protocol.
- **Offset Progressive Bonding Curve:** System-wide utilization of the `OffsetProgressiveCurve` (`0x23af...`) for advanced non-linear price discovery and high-conviction rewards.
- **Hot/Cold Filtering:** Advanced search algorithms to pinpoint identities amidst the noise.

### 🧠 Intelligence Dashboard
- **Portfolio Tracking:** Real-time tracking of held positions, estimated value, and PnL.
- **AI Synthesis:** Integrated Gemini-3-Flash/Pro analysis for market collision reports and agent briefings.
- **Activity Logs:** A local and on-chain transaction history reconciler.

### 📡 Signal Transmission
- **On-Chain Opinions:** Transmit semantic triples (Subject -> Predicate -> Object) directly to the blockchain.
- **Sentiment Analysis:** Visual breakdown of Trust vs. Distrust probability based on market movements.

### 🎮 Immersive UX
- **Arcade Aesthetics:** CRT scanlines, neon glows, and retro-futuristic typography.
- **Procedural Audio:** A custom audio engine (`services/audio.ts`) generates UI sounds using the Web Audio API.
- **Gamification:** "High Scores" leaderboards tracking the top reputation traders in the metaverse.

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite, TypeScript |
| **Styling** | Tailwind CSS (Custom Config) |
| **Blockchain** | Viem (Type-safe Ethereum Interface) |
| **Data** | GraphQL (Intuition Subgraph) |
| **Intelligence** | Gemini 3 API (Google GenAI) |

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+)
- A Web3 Wallet (MetaMask, Rabby) connected to **Intuition Mainnet**.

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/intuition-box/INTURANK.git
   cd INTURANK
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

## 🔗 Smart Contract Integration

IntuRank interacts primarily with the **Intuition MultiVault** and **Fee Proxy**.

- **Curve Protocol:** All vaults are initialized on the `OffsetProgressiveCurve`.
- **Deposit:** `deposit` via Fee Proxy - Acquires shares with automatic fee calculation.
- **Redeem:** `redeemBatch` via MultiVault - Burns shares to claim underlying TRUST assets.
- **Atoms/Triples:** Uses `createAtoms` and `createTriples` to register new identities and opinions.

## 🧩 Intuition SDK Integration (`@0xintuition/sdk`)

This app also exposes a thin wrapper around the official Intuition TypeScript SDK to make higher-level graph operations easy to use from React and from AI agents inside Cursor.

- **Dependency**: `@0xintuition/sdk` (peer: `viem ^2.x`)
- **Service entrypoint**: `services/intuitionSdk.ts`

Key helpers:

- **`createStringAtom(text, deposit?)`**: Creates an atom from a plain string on Intuition Mainnet, optionally with a TRUST deposit (decimal string, e.g. `"0.01"`).
- **`createThingAtom(thing, deposit)`**: Creates a rich JSON‑LD style "Thing" atom using the SDK’s IPFS/Pinata flow.
- **`createSingleTriple(subjectId, predicateId, objectId, deposit)`**: Creates one `(subject, predicate, object)` triple with a TRUST deposit.
- **`fetchAtomDetails(atomId)`**: Fetches full atom metadata from the Intuition API.
- **`searchIntuition(query, options?)`**: Text search across atoms/accounts/triples/collections.
- **`semanticSearchIntuition(query, options?)`**: Embedding-based semantic search over the graph.

All write helpers automatically:

- Resolve the canonical `MultiVault` address via `getMultiVaultAddressFromChainId(intuitionMainnet.id)`.
- Reuse the existing `publicClient` and `intuitionChain` from `services/web3.ts`.
- Bind to the currently connected browser wallet (MetaMask/Rabby) via EIP‑1193.

For full protocol and SDK docs, see the upstream monorepo: `https://github.com/0xIntuition/intuition-ts`.

---

*Powered by [Intuition Systems](https://intuition.systems).*
