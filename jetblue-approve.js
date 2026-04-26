// jetblue-approve.js
// One-time setup: JetBlue approves BidoAuction to spend its USDC

require('dotenv').config();
const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');

const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

const USDC_ADDRESS = process.env.USDC_ADDRESS;
const BIDO_AUCTION_ADDRESS = process.env.BIDO_AUCTION_ADDRESS;
const JETBLUE_WALLET_ID = process.env.JETBLUE_WALLET_ID;

async function waitForTx(transactionId, maxAttempts = 30) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await circleClient.getTransaction({ id: transactionId });
    const tx = res.data?.transaction;
    if (!tx) continue;
    if (tx.state === "CONFIRMED" || tx.state === "COMPLETE") return tx;
    if (tx.state === "FAILED" || tx.state === "DENIED") {
      throw new Error(`Circle tx ${tx.state}: ${tx.errorReason || 'unknown'}`);
    }
    console.log(`  ... state: ${tx.state}`);
  }
  throw new Error("Timeout");
}

(async () => {
  console.log("→ JetBlue approving BidoAuction to spend 100 USDC...");
  console.log(`  Wallet: ${JETBLUE_WALLET_ID}`);
  console.log(`  Spender: ${BIDO_AUCTION_ADDRESS}`);

  const res = await circleClient.createContractExecutionTransaction({
    walletId: JETBLUE_WALLET_ID,
    contractAddress: USDC_ADDRESS,
    abiFunctionSignature: "approve(address,uint256)",
    abiParameters: [BIDO_AUCTION_ADDRESS, "100000000"],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } }
  });

  console.log(`  → Transaction submitted: ${res.data.id}`);
  console.log(`  → Waiting for confirmation...`);

  const tx = await waitForTx(res.data.id);
  console.log(`✓ Approved! tx hash: ${tx.txHash}`);
  console.log(`  View: https://testnet.arcscan.app/tx/${tx.txHash}`);
})();