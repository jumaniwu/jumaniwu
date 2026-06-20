// BRICKX Protocol — full deploy.
//
// Deploy order matters because BRXToken's constructor records the vesting and
// ICO-vault addresses, while those two need the token address (circular). We
// resolve it by pre-computing the deployer's next contract addresses from the
// account nonce, so BRXToken can be given the correct future addresses.
//
// Usage:
//   npx hardhat run scripts/deploy.js --network amoy
// On testnet/local, USDC/USDT default to freshly-deployed MockERC20 tokens.

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const treasury = process.env.TREASURY_ADDRESS || deployer.address;

  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Treasury: ${treasury}\n`);

  // ── Stablecoins: real addresses on mainnet, mocks on testnet/local ──
  let usdc = process.env.USDC_ADDRESS;
  let usdt = process.env.USDT_ADDRESS;
  if (!usdc || !usdt) {
    if (network.name === "polygon") {
      throw new Error("USDC_ADDRESS and USDT_ADDRESS are required on mainnet — refusing to deploy mock tokens.");
    }
    const Mock = await ethers.getContractFactory("MockERC20");
    if (!usdc) {
      const m = await Mock.deploy("Mock USDC", "USDC", 6);
      await m.waitForDeployment();
      usdc = await m.getAddress();
      console.log(`Mock USDC: ${usdc}`);
    }
    if (!usdt) {
      const m = await Mock.deploy("Mock USDT", "USDT", 6);
      await m.waitForDeployment();
      usdt = await m.getAddress();
      console.log(`Mock USDT: ${usdt}`);
    }
  }

  // ── Resolve the circular dependency via nonce prediction ──
  const n = await deployer.getNonce();
  const tokenAddr   = ethers.getCreateAddress({ from: deployer.address, nonce: n });
  const vestingAddr = ethers.getCreateAddress({ from: deployer.address, nonce: n + 1 });
  const vaultAddr   = ethers.getCreateAddress({ from: deployer.address, nonce: n + 2 });

  // 1) BRX token — mints 1,000,000,000 BRX to the deployer
  const Token = await ethers.getContractFactory("BRXToken");
  const token = await Token.deploy(vestingAddr, vaultAddr);
  await token.waitForDeployment();
  assertAddr(await token.getAddress(), tokenAddr, "BRXToken");

  // 2) Vesting
  const Vesting = await ethers.getContractFactory("BRXVesting");
  const vesting = await Vesting.deploy(tokenAddr);
  await vesting.waitForDeployment();
  assertAddr(await vesting.getAddress(), vestingAddr, "BRXVesting");

  // 3) ICO vault
  const Vault = await ethers.getContractFactory("BRXICOVault");
  const vault = await Vault.deploy(treasury, usdc, usdt, tokenAddr, vestingAddr);
  await vault.waitForDeployment();
  assertAddr(await vault.getAddress(), vaultAddr, "BRXICOVault");

  // 4) BRICK property token ($10 fixed)
  const Brick = await ethers.getContractFactory("BRICKToken");
  const brick = await Brick.deploy(usdc, treasury);
  await brick.waitForDeployment();
  const brickAddr = await brick.getAddress();

  // 5) Yield distributor (annual USDC dividend)
  const Yield = await ethers.getContractFactory("YieldDistributor");
  const yieldD = await Yield.deploy(usdc, brickAddr, treasury);
  await yieldD.waitForDeployment();
  const yieldAddr = await yieldD.getAddress();

  const out = {
    network: network.name,
    deployer: deployer.address,
    treasury,
    USDC: usdc,
    USDT: usdt,
    BRX_TOKEN_ADDRESS: tokenAddr,
    BRX_VESTING_ADDRESS: vestingAddr,
    ICO_VAULT_ADDRESS: vaultAddr,
    BRICK_TOKEN_ADDRESS: brickAddr,
    YIELD_DISTRIBUTOR_ADDRESS: yieldAddr,
    deployedAt: new Date().toISOString(),
  };

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${network.name}.json`), JSON.stringify(out, null, 2));

  console.log("\n=== DEPLOYED ===");
  console.log(out);
  console.log("\n--- Paste into Railway (backend) env ---");
  console.log(`BRX_TOKEN_ADDRESS=${tokenAddr}`);
  console.log(`BRICK_TOKEN_ADDRESS=${brickAddr}`);
  console.log(`ICO_VAULT_ADDRESS=${vaultAddr}`);
  console.log(`YIELD_DISTRIBUTOR_ADDRESS=${yieldAddr}`);
  console.log("\nNext steps:");
  console.log("  1. Deployer holds 1,000,000,000 BRX — distribute to vesting/vault/ecosystem per tokenomics.");
  console.log("  2. vault.createRound(...) to open the seed round; populate the KYC whitelist.");
  console.log("  3. Verify on Polygonscan: npx hardhat verify --network", network.name, tokenAddr, vestingAddr, vaultAddr);
}

function assertAddr(actual, expected, label) {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`${label} address mismatch — nonce prediction failed (got ${actual}, expected ${expected}). Re-run on a clean nonce.`);
  }
  console.log(`${label}: ${actual}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
