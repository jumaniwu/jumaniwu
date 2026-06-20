# BRICKX Protocol — Smart Contracts (Hardhat)

Five contracts in `src/BRICKXContracts.sol`:

| Contract | Purpose |
|----------|---------|
| `BRXToken` | ERC-20 governance token. Fixed 1,000,000,000 supply, minted to deployer at genesis (minting then permanently closed). |
| `BRXVesting` | Cliff + linear vesting for seed/ICO/team/partner allocations. |
| `BRXICOVault` | USDC/USDT ICO sale with rounds + KYC whitelist; locks purchased BRX into vesting. |
| `BRICKToken` | Property token, **$10.00 fixed price**. Marketplace + 0.5% fee. |
| `YieldDistributor` | Annual USDC dividend push to BRICK holders (off-chain Dec-31 snapshot). |

`src/mocks/MockERC20.sol` is a test-only stand-in for USDC/USDT (testnet/local).

## Setup

```bash
cd brickx/contracts
npm install
cp .env.example .env   # fill in PRIVATE_KEY (testnet wallet), RPCs, etc.
npm run compile
npm test
```

## Deploy

```bash
# Local hardhat node
npx hardhat node            # in one terminal
npm run deploy:local        # in another

# Polygon Amoy testnet (mocks auto-deployed for USDC/USDT)
npm run deploy:amoy

# Polygon mainnet (USDC_ADDRESS + USDT_ADDRESS REQUIRED in .env)
npm run deploy:polygon
```

The deploy script:
- Resolves the `BRXToken` ⇄ vesting/vault circular dependency by pre-computing
  the deployer's next contract addresses from the account nonce.
- Auto-deploys `MockERC20` USDC/USDT on testnet/local (refuses on mainnet).
- Writes addresses to `deployments/<network>.json` and prints a ready-to-paste
  Railway env block (`BRX_TOKEN_ADDRESS`, `BRICK_TOKEN_ADDRESS`,
  `ICO_VAULT_ADDRESS`, `YIELD_DISTRIBUTOR_ADDRESS`).

## After deploy

1. Distribute the deployer's 1B BRX to vesting / vault / ecosystem per tokenomics.
2. `vault.createRound(...)` to open the seed round; populate the KYC whitelist.
3. Set the four addresses in Railway env + Admin Panel → Settings.
4. Verify: `npx hardhat verify --network amoy <address> <constructor args...>`.

## ⚠️ Before mainnet

A professional audit (CertiK / Hacken) is **required** — see the SECURITY
CHECKLIST at the bottom of `src/BRICKXContracts.sol`. Owner of every contract
must be a Gnosis Safe multisig, not an EOA.
