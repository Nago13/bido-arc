// x402-server.js
// HTTP API server with x402 payment flow + Bido auction integration

require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const { getFlights, getAvailableRoutes } = require('./flights-api');

// ========== CONFIG ==========
const PORT = 3000;
const RPC_URL = process.env.ARC_RPC_URL;
const BIDO_AUCTION_ADDRESS = process.env.BIDO_AUCTION_ADDRESS;
const USDC_ADDRESS = process.env.USDC_ADDRESS;

const BIDO_ABI = [
  "function openAuction(string calldata query) external returns (uint256)",
  "function placeBid(uint256 auctionId, uint256 amount) external",
  "function closeAuction(uint256 auctionId) external",
  "function auctionCounter() external view returns (uint256)",
  "function getAuction(uint256 id) external view returns (tuple(uint256 id, string query, address highestBidder, uint256 highestBid, bool closed, uint256 createdAt))"
];

const USDC_ABI = [
  "function balanceOf(address account) external view returns (uint256)"
];

// ========== SETUP ==========
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Platform wallet (controls auctions)
const platformWallet = new ethers.Wallet(process.env.PLATFORM_PRIVATE_KEY, provider);
const bidoPlatform = new ethers.Contract(BIDO_AUCTION_ADDRESS, BIDO_ABI, platformWallet);

// Sponsor bots (Delta and United, simulated)
const sponsorAWallet = new ethers.Wallet(process.env.SPONSOR_A_PRIVATE_KEY, provider);
const sponsorBWallet = new ethers.Wallet(process.env.SPONSOR_B_PRIVATE_KEY, provider);
const bidoSponsorA = new ethers.Contract(BIDO_AUCTION_ADDRESS, BIDO_ABI, sponsorAWallet);
const bidoSponsorB = new ethers.Contract(BIDO_AUCTION_ADDRESS, BIDO_ABI, sponsorBWallet);

const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

// ========== HELPERS ==========
function formatUSDC(amount) {
  return ethers.formatUnits(amount, 6);
}

function parseUSDC(amount) {
  return ethers.parseUnits(amount.toString(), 6);
}

// Sponsor profiles — what each one represents
const SPONSORS = {
  A: { name: "Delta Airlines",  wallet: sponsorAWallet, contract: bidoSponsorA, minBid: 2.0, maxBid: 4.0 },
  B: { name: "United Airlines", wallet: sponsorBWallet, contract: bidoSponsorB, minBid: 2.5, maxBid: 4.5 }
};

// Simulates an autonomous sponsor bot deciding their bid
function decideBid(sponsorKey, query) {
  const s = SPONSORS[sponsorKey];
  // Bots get more aggressive on flight queries (their domain)
  const domainMatch = /flight|airline|fly/i.test(query);
  const aggressiveness = domainMatch ? 1.0 : 0.6;
  const bidValue = s.minBid + Math.random() * (s.maxBid - s.minBid) * aggressiveness;
  return parseFloat(bidValue.toFixed(2));
}

// ========== BIDO ORCHESTRATION ==========
async function runBidoAuctionForQuery(query) {
  console.log(`\n[BIDO] 🎯 New auction request: "${query}"`);

  // 1. Open auction
  console.log(`[BIDO]   → Opening auction on Arc...`);
  const openTx = await bidoPlatform.openAuction(query);
  await openTx.wait();
  const auctionId = (await bidoPlatform.auctionCounter()) - 1n;
  console.log(`[BIDO]   ✓ Auction #${auctionId} opened (tx: ${openTx.hash.slice(0,12)}...)`);

  // 2. Sponsors compete (bots decide their bids)
  const bidA = decideBid("A", query);
  const bidB = decideBid("B", query);
  console.log(`[BIDO]   → ${SPONSORS.A.name} bot bidding $${bidA}...`);
  console.log(`[BIDO]   → ${SPONSORS.B.name} bot bidding $${bidB}...`);

  // Place bids in order so the higher one wins
  const sortedBids = [
    { sponsor: "A", amount: bidA },
    { sponsor: "B", amount: bidB }
  ].sort((x, y) => x.amount - y.amount); // ascending order

  for (const bid of sortedBids) {
    try {
      const tx = await SPONSORS[bid.sponsor].contract.placeBid(auctionId, parseUSDC(bid.amount));
      await tx.wait();
      console.log(`[BIDO]   ✓ ${SPONSORS[bid.sponsor].name} bid $${bid.amount} placed (tx: ${tx.hash.slice(0,12)}...)`);
    } catch (err) {
      console.log(`[BIDO]   ✗ ${SPONSORS[bid.sponsor].name} bid failed: ${err.shortMessage || err.message}`);
    }
  }

  // 3. Close auction (winner pays)
  console.log(`[BIDO]   → Closing auction (winner pays)...`);
  const closeTx = await bidoPlatform.closeAuction(auctionId);
  await closeTx.wait();

  // 4. Get final state
  const auction = await bidoPlatform.getAuction(auctionId);
  const winnerAddress = auction.highestBidder;
  const winnerAmount = formatUSDC(auction.highestBid);
  
  // Identify winner
  let winnerName = "Unknown";
  if (winnerAddress.toLowerCase() === sponsorAWallet.address.toLowerCase()) winnerName = SPONSORS.A.name;
  if (winnerAddress.toLowerCase() === sponsorBWallet.address.toLowerCase()) winnerName = SPONSORS.B.name;

  console.log(`[BIDO]   🏆 ${winnerName} won with $${winnerAmount} (tx: ${closeTx.hash.slice(0,12)}...)`);

  return {
    auctionId: auctionId.toString(),
    winner: winnerName,
    winningBid: winnerAmount,
    apiPayment: (parseFloat(winnerAmount) * 0.95).toFixed(4),
    platformFee: (parseFloat(winnerAmount) * 0.05).toFixed(4),
    txHashes: {
      open: openTx.hash,
      close: closeTx.hash
    }
  };
}

// ========== EXPRESS SERVER ==========
const app = express();
app.use(express.json());

// CORS — allow dashboard requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Logger middleware
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

// Endpoint 1: GET /flights — returns 402 Payment Required (x402 spec)
app.get('/flights', (req, res) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: "Missing 'from' or 'to' query params" });
  }

  console.log(`[x402] 💸 Returning 402 Payment Required for /flights?from=${from}&to=${to}`);

  // x402: Payment Required
  res.status(402).json({
    status: 402,
    error: "Payment Required",
    message: "This endpoint requires payment via Bido auction.",
    payment: {
      protocol: "bido-x402",
      network: "arc-testnet",
      payment_endpoint: "/pay-via-bido",
      query_intent: `flight from ${from} to ${to}`,
      price_range_usdc: "1.50-4.50"
    }
  });
});

// Endpoint 2: POST /pay-via-bido — orchestrates auction and returns the data
app.post('/pay-via-bido', async (req, res) => {
  const { query, from, to } = req.body;

  if (!from || !to) {
    return res.status(400).json({ error: "Missing 'from' or 'to' in body" });
  }

  const intentQuery = query || `flight from ${from} to ${to}`;

  try {
    // 1. Run Bido auction (4 on-chain txs)
    const auctionResult = await runBidoAuctionForQuery(intentQuery);

    // 2. Verify payment was successful (highestBid > 0 and auction closed)
    if (parseFloat(auctionResult.winningBid) <= 0) {
      return res.status(500).json({ error: "Auction failed — no valid bids" });
    }

    // 3. Fetch flight data (now that payment is settled)
    const flights = getFlights(from, to);

    if (flights.length === 0) {
      return res.status(404).json({
        error: `No flights available for ${from}→${to}`,
        available_routes: getAvailableRoutes()
      });
    }

    // 4. Return data + receipt
    res.status(200).json({
      status: 200,
      message: "Payment confirmed via Bido. Data delivered.",
      bido_receipt: auctionResult,
      data: {
        route: `${from}→${to}`,
        flights: flights
      }
    });

  } catch (err) {
    console.error(`[ERROR] Auction failed:`, err.message);
    res.status(500).json({ error: "Auction failed", details: err.message });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({
    service: "Bido x402 API",
    status: "running",
    endpoints: ["/flights?from=X&to=Y (returns 402)", "POST /pay-via-bido"],
    contract: BIDO_AUCTION_ADDRESS,
    network: "Arc Testnet"
  });
});

// ========== START ==========
app.listen(PORT, async () => {
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║       BIDO x402 SERVER — Arc Testnet           ║");
  console.log("╚════════════════════════════════════════════════╝");
  console.log(`Listening on http://localhost:${PORT}`);
  console.log(`Contract: ${BIDO_AUCTION_ADDRESS}`);
  console.log(`Platform: ${platformWallet.address}`);
  console.log(`Sponsor A (${SPONSORS.A.name}): ${sponsorAWallet.address}`);
  console.log(`Sponsor B (${SPONSORS.B.name}): ${sponsorBWallet.address}`);

  // Show balances
  const balPlatform = await usdcContract.balanceOf(platformWallet.address);
  const balA = await usdcContract.balanceOf(sponsorAWallet.address);
  const balB = await usdcContract.balanceOf(sponsorBWallet.address);
  console.log(`\nBalances:`);
  console.log(`  Platform:  ${formatUSDC(balPlatform)} USDC`);
  console.log(`  ${SPONSORS.A.name}:    ${formatUSDC(balA)} USDC`);
  console.log(`  ${SPONSORS.B.name}: ${formatUSDC(balB)} USDC`);
  console.log(`\n✓ Server ready. Run agent.js to test.\n`);
});