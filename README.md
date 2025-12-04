# 🌐 IntuRank

> **The Semantic Trust-Graph Intelligence Layer**
> *Stake on Identity. Short the Noise. Profit from Truth.*

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.4--alpha-green)
![Network](https://img.shields.io/badge/network-Intuition%20Mainnet-purple)

## 📖 Overview

**IntuRank** is a high-fidelity prediction market interface built natively on the [Intuition Network](https://intuition.systems). It visualizes reputation as a tradable asset, allowing users to signal trust (or distrust) on any identity, claim, or concept ("Atoms") within the graph.

By combining financial incentives with semantic data, IntuRank creates a **"Credit Score for Everything"**—a decentralized mechanism to curate truth and reputation in an age of information overload.

## ✨ Key Features

### 📉 Semantic Markets
- **Trade Reputation:** Buy and sell shares in specific Agents/Atoms using the `MultiVault` protocol.
- **Bonding Curves:** Pricing is determined automatically by on-chain bonding curves; early signalers are rewarded as conviction grows.
- **Hot/Cold Filtering:** Advanced search algorithms to pinpoint identities amidst the noise.

### 🧠 Intelligence Dashboard
- **Portfolio Tracking:** Real-time tracking of held positions, estimated value, and PnL.
- **Activity Logs:** A local and on-chain transaction history reconciler.
- **Share Cards:** Generate shareable, cyberpunk-styled PnL cards to flex your conviction on social media.

### 📡 Signal Transmission
- **On-Chain Opinions:** Transmit semantic triples (Subject -> Predicate -> Object) directly to the blockchain.
- **Sentiment Analysis:** Visual breakdown of Trust vs. Distrust probability based on market movements.

### 🎮 Immersive UX
- **Arcade Aesthetics:** CRT scanlines, neon glows, and retro-futuristic typography.
- **Procedural Audio:** A custom audio engine (`services/audio.ts`) generates UI sounds (chirps, locks, success chords) using the Web Audio API—no external assets required.
- **Gamification:** "High Scores" leaderboards tracking the top reputation traders in the metaverse.

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TypeScript |
| **Styling** | Tailwind CSS (Custom Config) |
| **Blockchain** | Viem (Type-safe Ethereum Interface) |
| **Data** | GraphQL (Intuition Subgraph) |
| **Visualization** | Recharts |
| **Icons** | Lucide React |

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- A Web3 Wallet (MetaMask, Rabby) connected to **Intuition Mainnet**.
- *Note: The app handles chain switching automatically.*

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

4. **Build for Production**
   ```bash
   npm run build
   ```

## 📂 Project Structure

```
INTURANK/
├── src/
│   ├── components/      # Reusable UI elements (Layout, ShareCard, TransactionModal)
│   ├── pages/           # Main route views (Markets, Dashboard, Profile)
│   ├── services/
│   │   ├── web3.ts      # Viem client, contract ABIs, & transaction logic
│   │   ├── graphql.ts   # Subgraph queries & data normalization
│   │   └── audio.ts     # Procedural Web Audio API engine
│   ├── constants.ts     # Contract addresses, Chain IDs, RPC configurations
│   ├── types.ts         # TypeScript interfaces
│   └── App.tsx          # Router configuration
├── index.html           # Tailwind config & global styles
└── vite.config.ts       # Build configuration
```

## 🔗 Smart Contract Integration

IntuRank interacts primarily with the **Intuition MultiVault**.

- **Deposit:** `depositBatch` - Acquires shares in a specific Atom (Agent) vault.
- **Redeem:** `redeemBatch` - Burns shares to claim underlying assets (TRUST tokens).
- **Atoms/Triples:** Uses `createAtoms` and `createTriples` to register new identities and opinions on-chain if they don't already exist.

> **Note:** The `web3.ts` service implements a robust "Check-or-Create" pattern to ensure idempotency when publishing new signals.

## 🎨 Design System

The UI is built on a "Cyberpunk Arcade" philosophy:
- **Colors:** Neon Cyan (`#00f3ff`), Electric Blue, Matrix Green (`#00ff9d`), and Danger Red (`#ff0055`) against a Deep Space Black (`#02040a`) background.
- **Typography:**
  - *Headings:* `Orbitron` (Futuristic/Sci-Fi)
  - *Body:* `Inter` (Readability)
  - *Data:* `Fira Code` (Monospaced/Terminal)
- **Effects:** CSS-based scanlines, noise textures, and `clip-path` polygon shapes for button geometry.

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License.

---

*Powered by [Intuition Systems](https://intuition.systems).*