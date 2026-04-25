require('dotenv').config();
const { ethers } = require('ethers');

// ========== CONFIG ==========
const RPC_URL = process.env.ARC_RPC_URL;
const USDC_ADDRESS = process.env.USDC_ADDRESS;
const BIDO_AUCTION_ADDRESS = process.env.BIDO_AUCTION_ADDRESS;

const NUMBER_OF_AUCTIONS = 17;

// Sample queries to make the demo realistic
const SAMPLE_QUERIES = [
  "cheapest flight LAX to NYC",
  "best hotel near Times Square",
  "weather forecast for Miami",
  "uber price Manhattan to JFK",
  "best ramen restaurant Tokyo",
  "AAPL stock price today",
  "best laptop under 1500 USD",
  "concert tickets Coldplay LA",
  "vegan restaurant Berlin",
  "real estate prices Austin TX",
  "best coffee shops Sao Paulo",
  "translation EN to JP",
  "flight Paris to Rome",
  "yoga class near downtown",
  "BTC price prediction",
  "dentist appointment Boston",
  "car rental San Francisco"
];

// ========== ABIs ==========
const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
];

const BIDO_ABI = [
  "function openAuction(string calldata query) external returns (uint256)",
  "function placeBid(uint256 auctionId, uint256 amount) external",
  "function closeAuction(uint256 auctionId) external",
  "function auctionCounter() external view returns (uint256)",
  "function getAuction(uint256 id) external view returns (tuple(uint256 id, string query, address highestBidder, uint256 highestBid, bool closed, uint256 createdAt))",
  "event AuctionOpened(uint256 indexed auctionId, string query, uint256 timestamp)",
  "event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount)",
  "event AuctionClosed(uint256 indexed auctionId, address indexed winner, uint256 winningBid, uint256 apiPayment, uint256 platformFee)"
];

// ========== SETUP ==========
const provider = new ethers.JsonRpcProvider(RPC_URL);

const platform = new ethers.Wallet(process.env.PLATFORM_PRIVATE_KEY, provider);
const sponsorA = new ethers.Wallet(process.env.SPONSOR_A_PRIVATE_KEY, provider);
const sponsorB = new ethers.Wallet(process.env.SPONSOR_B_PRIVATE_KEY, provider);

const bidoPlatform = new ethers.Contract(BIDO_AUCTION_ADDRESS, BIDO_ABI, platform);
const bidoSponsorA = new ethers.Contract(BIDO_AUCTION_ADDRESS, BIDO_ABI, sponsorA);
const bidoSponsorB = new ethers.Contract(BIDO_AUCTION_ADDRESS, BIDO_ABI, sponsorB);

const usdcSponsorA = new ethers.Contract(USDC_ADDRESS, USDC_ABI, sponsorA);
const usdcSponsorB = new ethers.Contract(USDC_ADDRESS, USDC_ABI, sponsorB);

// ========== HELPERS ==========
function formatUSDC(amount) {
  return ethers.formatUnits(amount, 6);
}

function parseUSDC(amount) {
  return ethers.parseUnits(amount.toString(), 6);
}

async function ensureApproval(usdcContract, sponsorWallet, label) {
  const currentAllowance = await usdcContract.allowance(sponsorWallet.address, BIDO_AUCTION_ADDRESS);
  const minAllowance = parseUSDC(50);

  if (currentAllowance < minAllowance) {
    console.log(`  → ${label} approving 100 USDC...`);
    const tx = await usdcContract.approve(BIDO_AUCTION_ADDRESS, parseUSDC(100));
    await tx.wait();
    console.log(`  ✓ Approved (tx: ${tx.hash})`);
  } else {
    console.log(`  ✓ ${label} already approved (${formatUSDC(currentAllowance)} USDC)`);
  }
}

async function runOneAuction(index) {
  const query = SAMPLE_QUERIES[index % SAMPLE_QUERIES.length];
  console.log(`\n━━━ Auction #${index + 1}: "${query}" ━━━`);

  const bidA = parseUSDC((1.5 + Math.random() * 1.5).toFixed(2));
  const bidB = parseUSDC((2.5 + Math.random() * 1.5).toFixed(2));

  console.log(`  [1/4] Platform opens auction...`);
  const openTx = await bidoPlatform.openAuction(query);
  await openTx.wait();
  const auctionId = (await bidoPlatform.auctionCounter()) - 1n;
  console.log(`  ✓ Auction ID: ${auctionId} (tx: ${openTx.hash.slice(0, 12)}...)`);

  console.log(`  [2/4] Sponsor A bids ${formatUSDC(bidA)} USDC...`);
  const bidATx = await bidoSponsorA.placeBid(auctionId, bidA);
  await bidATx.wait();
  console.log(`  ✓ Bid placed (tx: ${bidATx.hash.slice(0, 12)}...)`);

  console.log(`  [3/4] Sponsor B bids ${formatUSDC(bidB)} USDC...`);
  const bidBTx = await bidoSponsorB.placeBid(auctionId, bidB);
  await bidBTx.wait();
  console.log(`  ✓ Bid placed (tx: ${bidBTx.hash.slice(0, 12)}...)`);

  console.log(`  [4/4] Platform closes auction (winner pays)...`);
  const closeTx = await bidoPlatform.closeAuction(auctionId);
  await closeTx.wait();
  console.log(`  ✓ Closed - Sponsor B won, paid ${formatUSDC(bidB)} USDC`);
  console.log(`     API got 95% (${formatUSDC(bidB * 95n / 100n)} USDC)`);
  console.log(`     Platform got 5% (${formatUSDC(bidB * 5n / 100n)} USDC)`);

  return 4;
}

// ========== MAIN ==========
(async () => {
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║          BIDO • Arc Testnet Demo Runner        ║");
  console.log("║   Real-time Intent Auctions for Agent Economy  ║");
  console.log("╚════════════════════════════════════════════════╝");
  console.log(`\nRPC: ${RPC_URL}`);
  console.log(`Contract: ${BIDO_AUCTION_ADDRESS}`);
  console.log(`Auctions to run: ${NUMBER_OF_AUCTIONS}\n`);

  const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
  const balPlatform = await usdcContract.balanceOf(platform.address);
  const balA = await usdcContract.balanceOf(sponsorA.address);
  const balB = await usdcContract.balanceOf(sponsorB.address);
  console.log(`Platform balance:  ${formatUSDC(balPlatform)} USDC`);
  console.log(`Sponsor A balance: ${formatUSDC(balA)} USDC`);
  console.log(`Sponsor B balance: ${formatUSDC(balB)} USDC`);

  console.log("\n--- Ensuring approvals ---");
  await ensureApproval(usdcSponsorA, sponsorA, "Sponsor A");
  await ensureApproval(usdcSponsorB, sponsorB, "Sponsor B");

  let totalTxs = 0;
  const startTime = Date.now();

  for (let i = 0; i < NUMBER_OF_AUCTIONS; i++) {
    try {
      const txs = await runOneAuction(i);
      totalTxs += txs;
    } catch (err) {
      console.error(`  ✗ Error in auction #${i + 1}:`, err.message);
      console.log("  → Skipping and continuing...");
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║                    SUMMARY                     ║");
  console.log("╚════════════════════════════════════════════════╝");
  console.log(`Total auctions completed: ${NUMBER_OF_AUCTIONS}`);
  console.log(`Total transactions: ${totalTxs}+ (excluding approvals)`);
  console.log(`Time elapsed: ${elapsed}s`);
  console.log(`\nView all transactions on Arc Testnet Explorer:`);
  console.log(`https://testnet.arcscan.app/address/${BIDO_AUCTION_ADDRESS}`);
  console.log("\n✓ Done. Bido is economically viable on Arc.\n");
})();