# Bido — Real-Time Intent Auctions for the Agent Economy

> **Monetize decisions, not clicks.**
> Built on Circle. Live on Arc Testnet.

---

## What is Bido?

When an AI agent hits a paid API (HTTP 402), Bido opens a real-time auction. Sponsors compete to pay for that API call — in exchange, they capture the user's intent. The agent gets free data. The user gets a free service. The sponsor gets a deterministic, high-intent decision instead of a probabilistic click.

**Example flow:**
User: "Find me the cheapest flight LAX → NYC"
↓ Agent (Claude) calls flight API
↓ API returns 402 Payment Required
↓ Bido opens auction on Arc
↓ Sponsors bid in USDC (in real time)
↓ Highest bidder pays the API
↓ Agent gets data, user gets answer
[Settled in 25 seconds. Cost: $0.001 in gas.]

---

## Architecture
┌─────────────────────┐
│   AI AGENT (Claude) │  Simulates an LLM wrapper (e.g., InnerAI)
└──────────┬──────────┘
│ HTTP GET /flights
▼
┌─────────────────────┐
│  x402 API SERVER    │  Express.js + ethers.js + Circle SDK
│  (returns 402)      │
└──────────┬──────────┘
│ POST /pay-via-bido
▼
┌─────────────────────┐
│  BIDO PROTOCOL      │  Smart contract on Arc Testnet
│  Solidity contract  │  Auction + settlement in USDC
└──────────┬──────────┘
│ Sponsors compete
▼
┌─────────────────────┐
│  3 SPONSORS         │  Mixed-mode onboarding:
│  Delta (MetaMask)   │   • 2 use ethers.js wallets
│  United (MetaMask)  │   • 1 uses Circle Wallets API
│  JetBlue (Circle)   │
└─────────────────────┘

---

## Built on Circle

Five Circle products. One protocol.

| Product | Role in Bido |
|---|---|
| **Arc Testnet** | L1 blockchain. Sub-second finality. |
| **USDC** | Settlement currency for all bids, payments, fees. |
| **USDC as Gas** | Predictable dollar-based fees. |
| **Circle Wallets API** | JetBlue onboarded via email + KYC, no MetaMask. |
| **Nanopayments** | Sub-cent gas makes microtransactions economically viable. |

### Two onboarding modes — one protocol

- **Web3-native sponsors** (Delta, United): use existing MetaMask wallets via ethers.js
- **Traditional sponsors** (JetBlue): onboard via Circle Wallets API — server-side signing, no private keys

Both compete in the same auctions. Both settle on Arc in USDC.

---

## Why Arc? The math.

| Layer | Gas/auction | Take rate (5%) on $3 | Net result |
|---|---|---|---|
| Ethereum mainnet | $5–20 | $0.15 | ❌ Negative margin |
| Arc Testnet | $0.001 | $0.15 | ✅ Pure profit |

**This business model only exists because of Arc's USDC-native gas economics.**

---

## Smart Contract

Deployed on Arc Testnet:
**`0xe33dEE9cF95698EF686F23aEa9EDcadEABcfA00C`**

[View on Arc Explorer](https://testnet.arcscan.app/address/0xe33dEE9cF95698EF686F23aEa9EDcadEABcfA00C)

Functions:
- `openAuction(string query)` — anyone can open an auction
- `placeBid(uint256 auctionId, uint256 amount)` — sponsors bid in USDC
- `closeAuction(uint256 auctionId)` — platform settles, winner pays

---

## Tech Stack

- **Smart contract:** Solidity 0.8.20
- **Backend:** Node.js, Express, ethers v6
- **AI agent:** Claude Sonnet 4.6 (Anthropic SDK, tool use)
- **Frontend:** Vanilla JS dashboard (real-time on-chain reads)
- **Wallets:** ethers.js (MetaMask) + Circle Developer-Controlled Wallets API
- **Network:** Arc Testnet (Chain ID 5042002)

---

## How to Run

### Prerequisites
- Node.js 22+
- 4 MetaMask wallets with USDC on Arc Testnet
- Circle Developer API key (https://console.circle.com)
- Anthropic API key

### Setup

```bash
git clone https://github.com/Nago13/bido-arc.git
cd bido-arc
npm install
```

Create `.env` (see `.env.example`):

```env
ARC_RPC_URL=https://rpc.testnet.arc.network
USDC_ADDRESS=0x3600000000000000000000000000000000000000
BIDO_AUCTION_ADDRESS=0xe33dEE9cF95698EF686F23aEa9EDcadEABcfA00C

PLATFORM_PRIVATE_KEY=0x...
SPONSOR_A_PRIVATE_KEY=0x...
SPONSOR_B_PRIVATE_KEY=0x...
API_PROVIDER_PRIVATE_KEY=0x...

ANTHROPIC_API_KEY=sk-ant-...
CIRCLE_API_KEY=TEST_API_KEY:...
CIRCLE_ENTITY_SECRET=...
JETBLUE_WALLET_ID=...
JETBLUE_ADDRESS=0x...
```

### Run

```bash
# Terminal 1: x402 server
node x402-server.js

# Terminal 2: dashboard
npm run start:dashboard

# Terminal 3: trigger an agent query
node agent.js "Find me the cheapest flight from LAX to NYC"
```

Dashboard at http://localhost:8080
Server at http://localhost:3000

---

## Demo

[Watch the demo video](#) (link em breve)

Each click of "Trigger Live Auction" generates 4–5 real on-chain transactions:
1. `openAuction` (platform)
2. `placeBid` × 3 (Delta, United, JetBlue)
3. `closeAuction` (platform — winner pays)

---

## Built at

🟢 Circle Arc Hackathon — Agentic Economy on Arc
San Francisco, April 2026

**Team:**
- Pedro Nagamine — Engineer (ITA)
- João Belluzzo — Developer / Business (UniSt)

---

## License

MIT