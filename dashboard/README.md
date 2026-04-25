# Bido Dashboard

Real-time dashboard for the Bido intent auction protocol on Arc Testnet.

## Quick Start

```bash
# Terminal 1 — Start the x402 server (needed for live demo)
npm run start:server

# Terminal 2 — Start the dashboard
npm run start:dashboard
```

Open **http://localhost:8080** in your browser.

## Features

- **Live Stats** — Total auctions, volume, revenue, pulled from on-chain data
- **Auction Feed** — Last 10 auctions, auto-refreshes every 5 seconds
- **Sponsor Leaderboard** — Ranking by wins and total USDC spent
- **Live Demo** — Triggers a real on-chain auction via x402-server
- **Why Arc** — Gas cost comparison (Ethereum vs Arc)

## Architecture

- Single-page HTML + Tailwind CSS (via CDN) + vanilla JS
- Reads on-chain data directly via ethers v6 + Arc RPC (no wallet needed)
- Dashboard runs on port 8080, x402-server on port 3000
- CORS enabled on x402-server for cross-origin requests

## Pre-requisites

- `x402-server.js` running on port 3000 (for live demo button)
- Auctions already executed via `bido-runner.js` (for stats/feed data)
