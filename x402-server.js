// x402-server.js
require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
const { getFlights, getAvailableRoutes } = require('./flights-api');

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
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);

const platformWallet = new ethers.Wallet(process.env.PLATFORM_PRIVATE_KEY, provider);
const bidoPlatform = new ethers.Contract(BIDO_AUCTION_ADDRESS, BIDO_ABI, platformWallet);

const sponsorAWallet = new ethers.Wallet(process.env.SPONSOR_A_PRIVATE_KEY, provider);
const sponsorBWallet = new ethers.Wallet(process.env.SPONSOR_B_PRIVATE_KEY, provider);
const bidoSponsorA = new ethers.Contract(BIDO_AUCTION_ADDRESS, BIDO_ABI, sponsorAWallet);
const bidoSponsorB = new ethers.Contract(BIDO_AUCTION_ADDRESS, BIDO_ABI, sponsorBWallet);

const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});
const JETBLUE_WALLET_ID = process.env.JETBLUE_WALLET_ID;
const JETBLUE_ADDRESS = process.env.JETBLUE_ADDRESS;

const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

function formatUSDC(amount) {
  return ethers.formatUnits(amount, 6);
}

function parseUSDC(amount) {
  return ethers.parseUnits(amount.toString(), 6);
}

const SPONSORS = {
  A: { 
    name: "Delta Airlines",  
    type: "metamask",
    address: sponsorAWallet.address,
    wallet: sponsorAWallet, 
    contract: bidoSponsorA, 
    minBid: 2.0, 
    maxBid: 4.0 
  },
  B: { 
    name: "United Airlines", 
    type: "metamask",
    address: sponsorBWallet.address,
    wallet: sponsorBWallet, 
    contract: bidoSponsorB, 
    minBid: 2.5, 
    maxBid: 4.5 
  },
  C: { 
    name: "JetBlue Airways",
    type: "circle-wallet",
    address: JETBLUE_ADDRESS,
    walletId: JETBLUE_WALLET_ID,
    minBid: 2.8, 
    maxBid: 4.8 
  }
};

function decideBid(sponsorKey, query) {
  const s = SPONSORS[sponsorKey];
  const domainMatch = /flight|airline|fly/i.test(query);
  const aggressiveness = domainMatch ? 1.0 : 0.6;
  const bidValue = s.minBid + Math.random() * (s.maxBid - s.minBid) * aggressiveness;
  return parseFloat(bidValue.toFixed(2));
}

async function waitForCircleTransaction(transactionId, maxAttempts = 30) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await circleClient.getTransaction({ id: transactionId });
    const tx = res.data?.transaction;
    if (!tx) continue;
    if (tx.state === "CONFIRMED" || tx.state === "COMPLETE") {
      return tx;
    }
    if (tx.state === "FAILED" || tx.state === "DENIED") {
      throw new Error(`Circle tx ${tx.state}: ${tx.errorReason || 'unknown'}`);
    }
  }
  throw new Error("Circle transaction timeout");
}

async function jetbluePlaceBid(auctionId, amount) {
  const res = await circleClient.createContractExecutionTransaction({
    walletId: JETBLUE_WALLET_ID,
    contractAddress: BIDO_AUCTION_ADDRESS,
    abiFunctionSignature: "placeBid(uint256,uint256)",
    abiParameters: [auctionId.toString(), amount.toString()],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } }
  });
  const tx = await waitForCircleTransaction(res.data.id);
  return tx;
}

async function placeBidForSponsor(sponsorKey, auctionId, bidAmount) {
  const s = SPONSORS[sponsorKey];
  const amountWei = parseUSDC(bidAmount);
  if (s.type === "metamask") {
    const tx = await s.contract.placeBid(auctionId, amountWei);
    await tx.wait();
    return { hash: tx.hash, type: "metamask" };
  } else if (s.type === "circle-wallet") {
    const tx = await jetbluePlaceBid(auctionId, amountWei);
    return { hash: tx.txHash, type: "circle-wallet" };
  }
}

async function runBidoAuctionForQuery(query) {
  console.log(`\n[BIDO] New auction: "${query}"`);

  console.log(`[BIDO]   -> Opening auction on Arc...`);
  const openTx = await bidoPlatform.openAuction(query);
  await openTx.wait();
  const auctionId = (await bidoPlatform.auctionCounter()) - 1n;
  console.log(`[BIDO]   OK Auction #${auctionId} opened (tx: ${openTx.hash.slice(0,12)}...)`);

  const bidA = decideBid("A", query);
  const bidB = decideBid("B", query);
  const bidC = decideBid("C", query);

  console.log(`[BIDO]   -> ${SPONSORS.A.name} bidding $${bidA} (MetaMask)`);
  console.log(`[BIDO]   -> ${SPONSORS.B.name} bidding $${bidB} (MetaMask)`);
  console.log(`[BIDO]   -> ${SPONSORS.C.name} bidding $${bidC} (Circle Wallet)`);

  const sortedBids = [
    { sponsor: "A", amount: bidA },
    { sponsor: "B", amount: bidB },
    { sponsor: "C", amount: bidC }
  ].sort((x, y) => x.amount - y.amount);

  for (const bid of sortedBids) {
    try {
      const result = await placeBidForSponsor(bid.sponsor, auctionId, bid.amount);
      const sponsorName = SPONSORS[bid.sponsor].name;
      const hashShort = (result.hash || 'pending').slice(0, 12);
      console.log(`[BIDO]   OK ${sponsorName} bid $${bid.amount} (${result.type}, tx: ${hashShort}...)`);
    } catch (err) {
      const sponsorName = SPONSORS[bid.sponsor].name;
      console.log(`[BIDO]   X  ${sponsorName} bid failed: ${err.shortMessage || err.message}`);
    }
  }

  console.log(`[BIDO]   -> Closing auction (winner pays)...`);
  const closeTx = await bidoPlatform.closeAuction(auctionId);
  await closeTx.wait();

  const auction = await bidoPlatform.getAuction(auctionId);
  const winnerAddress = auction.highestBidder;
  const winnerAmount = formatUSDC(auction.highestBid);
  
  let winnerName = "Unknown";
  let winnerType = "unknown";
  for (const key of Object.keys(SPONSORS)) {
    if (SPONSORS[key].address.toLowerCase() === winnerAddress.toLowerCase()) {
      winnerName = SPONSORS[key].name;
      winnerType = SPONSORS[key].type;
    }
  }

  console.log(`[BIDO]   WINNER: ${winnerName} won with $${winnerAmount} (${winnerType}, tx: ${closeTx.hash.slice(0,12)}...)`);

  return {
    auctionId: auctionId.toString(),
    winner: winnerName,
    winnerType: winnerType,
    winningBid: winnerAmount,
    apiPayment: (parseFloat(winnerAmount) * 0.95).toFixed(4),
    platformFee: (parseFloat(winnerAmount) * 0.05).toFixed(4),
    txHashes: {
      open: openTx.hash,
      close: closeTx.hash
    }
  };
}

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

app.get('/flights', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: "Missing 'from' or 'to' query params" });
  }
  console.log(`[x402] Returning 402 Payment Required for /flights?from=${from}&to=${to}`);
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

app.post('/pay-via-bido', async (req, res) => {
  const { query, from, to } = req.body;
  if (!from || !to) {
    return res.status(400).json({ error: "Missing 'from' or 'to' in body" });
  }
  const intentQuery = query || `flight from ${from} to ${to}`;
  try {
    const auctionResult = await runBidoAuctionForQuery(intentQuery);
    if (parseFloat(auctionResult.winningBid) <= 0) {
      return res.status(500).json({ error: "Auction failed - no valid bids" });
    }
    const flights = getFlights(from, to);
    if (flights.length === 0) {
      return res.status(404).json({
        error: `No flights available for ${from} to ${to}`,
        available_routes: getAvailableRoutes()
      });
    }
    res.status(200).json({
      status: 200,
      message: "Payment confirmed via Bido. Data delivered.",
      bido_receipt: auctionResult,
      data: { route: `${from}-${to}`, flights: flights }
    });
  } catch (err) {
    console.error(`[ERROR] Auction failed:`, err.message);
    res.status(500).json({ error: "Auction failed", details: err.message });
  }
});

app.get('/', (req, res) => {
  res.json({
    service: "Bido x402 API",
    status: "running",
    contract: BIDO_AUCTION_ADDRESS,
    network: "Arc Testnet",
    sponsors: 3
  });
});

app.get('/sponsors', (req, res) => {
  res.json({
    sponsors: Object.keys(SPONSORS).map(key => ({
      key,
      name: SPONSORS[key].name,
      type: SPONSORS[key].type,
      address: SPONSORS[key].address,
      onboarding: SPONSORS[key].type === "metamask" 
        ? "MetaMask wallet (BYOW)" 
        : "Circle Wallets API (email-based onboarding)"
    }))
  });
});

app.listen(PORT, async () => {
  console.log("====================================================");
  console.log("       BIDO x402 SERVER - Arc Testnet");
  console.log("   3 Sponsors: 2 MetaMask + 1 Circle Wallet");
  console.log("====================================================");
  console.log(`Listening on http://localhost:${PORT}`);
  console.log(`Contract: ${BIDO_AUCTION_ADDRESS}`);
  console.log(`Platform: ${platformWallet.address}`);
  console.log(`\nSPONSORS:`);
  console.log(`  ${SPONSORS.A.name.padEnd(20)} ${SPONSORS.A.address}  (${SPONSORS.A.type})`);
  console.log(`  ${SPONSORS.B.name.padEnd(20)} ${SPONSORS.B.address}  (${SPONSORS.B.type})`);
  console.log(`  ${SPONSORS.C.name.padEnd(20)} ${SPONSORS.C.address}  (${SPONSORS.C.type})`);

  const balPlatform = await usdcContract.balanceOf(platformWallet.address);
  const balA = await usdcContract.balanceOf(sponsorAWallet.address);
  const balB = await usdcContract.balanceOf(sponsorBWallet.address);
  const balC = await usdcContract.balanceOf(JETBLUE_ADDRESS);
  console.log(`\nBalances:`);
  console.log(`  Platform:        ${formatUSDC(balPlatform)} USDC`);
  console.log(`  ${SPONSORS.A.name}:  ${formatUSDC(balA)} USDC`);
  console.log(`  ${SPONSORS.B.name}: ${formatUSDC(balB)} USDC`);
  console.log(`  ${SPONSORS.C.name}: ${formatUSDC(balC)} USDC  <- Circle Wallet`);

  console.log(`\nServer ready. Run agent.js to test.\n`);
});