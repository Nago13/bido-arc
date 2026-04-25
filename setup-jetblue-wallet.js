// setup-jetblue-wallet.js
// Creates JetBlue Airways sponsor wallet via Circle Developer-Controlled Wallets
// Run ONCE — saves credentials to .env

require('dotenv').config();
const { initiateDeveloperControlledWalletsClient, registerEntitySecretCiphertext } = require('@circle-fin/developer-controlled-wallets');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.CIRCLE_API_KEY;
const ENV_PATH = path.join(__dirname, '.env');
const OUTPUT_DIR = path.join(__dirname, 'circle-output');

if (!API_KEY) {
  console.error("❌ CIRCLE_API_KEY not found in .env");
  process.exit(1);
}

(async () => {
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║   JetBlue Wallet Setup via Circle Wallets API  ║");
  console.log("╚════════════════════════════════════════════════╝\n");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 1. Generate Entity Secret (only first time)
  let entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  
  if (!entitySecret) {
    console.log("→ Registering Entity Secret (first-time setup)...");
    entitySecret = crypto.randomBytes(32).toString("hex");
    
    await registerEntitySecretCiphertext({
      apiKey: API_KEY,
      entitySecret,
      recoveryFileDownloadPath: OUTPUT_DIR,
    });
    
    fs.appendFileSync(ENV_PATH, `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`, 'utf-8');
    console.log("✓ Entity Secret registered and saved to .env");
    console.log(`✓ Recovery file saved to ${OUTPUT_DIR}/`);
  } else {
    console.log("✓ Entity Secret found in .env, reusing it");
  }

  // 2. Initialize SDK client
  const client = initiateDeveloperControlledWalletsClient({
    apiKey: API_KEY,
    entitySecret,
  });

  // 3. Create Wallet Set
  console.log("\n→ Creating Wallet Set 'Bido Sponsors'...");
  const walletSetRes = await client.createWalletSet({ name: "Bido Sponsors" });
  const walletSet = walletSetRes.data?.walletSet;
  console.log(`✓ Wallet Set created: ${walletSet.id}`);

  // 4. Create JetBlue wallet on Arc Testnet
  console.log("\n→ Creating JetBlue Airways wallet on ARC-TESTNET...");
  const walletRes = await client.createWallets({
    accountType: "EOA",
    blockchains: ["ARC-TESTNET"],
    count: 1,
    walletSetId: walletSet.id,
  });
  
  const wallet = walletRes.data?.wallets[0];
  console.log(`✓ JetBlue wallet created!`);
  console.log(`  Wallet ID: ${wallet.id}`);
  console.log(`  Address:   ${wallet.address}`);
  console.log(`  Blockchain: ${wallet.blockchain}`);

  // 5. Append JetBlue credentials to .env
  fs.appendFileSync(ENV_PATH, 
    `\n# JetBlue Sponsor — Circle Developer-Controlled Wallet\n` +
    `JETBLUE_WALLET_ID=${wallet.id}\n` +
    `JETBLUE_ADDRESS=${wallet.address}\n` +
    `JETBLUE_WALLET_SET_ID=${walletSet.id}\n`,
    'utf-8'
  );

  // 6. Save full info to JSON
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'jetblue-wallet.json'),
    JSON.stringify({ walletSet, wallet }, null, 2)
  );

  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║                   NEXT STEPS                   ║");
  console.log("╚════════════════════════════════════════════════╝");
  console.log(`\n1. Fund this wallet with testnet USDC:`);
  console.log(`   https://faucet.circle.com`);
  console.log(`   Address: ${wallet.address}\n`);
  console.log(`2. After funding, run the leilão demo to test JetBlue.\n`);
})();