# 5. Token Architecture

## 5.1 The Dual Token System

BRICKX uses two distinct token types, each serving a specific purpose:

BRX — Governance and Utility Token

BRX is the primary utility and governance token of BRICKX Protocol. Fixed supply of 1,000,000,000 tokens (no additional minting possible). BRX provides:

* Governance voting rights — 1 BRX = 1 vote on protocol decisions
* Staking rewards — earn platform fee distributions by staking BRX
* Platform access — required to participate in BRICK token sales
* Deflationary mechanics — 30% of platform fees burned quarterly
* DAO treasury participation — vote on new property approvals and fund allocation

BRICK — Property-Specific Ownership Token

BRICK tokens (ERC-1155 standard) represent fractional ownership of a specific hotel property. Key mechanics:

* Price: USD 10.00 fixed permanently — this never changes
* Dividend: 70% of property NOI distributed to holders annually each June
* Liquidity: Can be listed and sold on BRICKX marketplace at USD 10.00 anytime
* Snapshot: Dividend eligibility determined by wallet holdings at December 31 each year
* Unique per property: Each hotel has its own BRICK token with separate financials and dividend history

## 5.2 Smart Contract Architecture

BRICKX is built on Polygon (Ethereum Layer 2) for the following reasons:

* Gas fees under USD 0.01 per transaction (vs USD 5-50 on Ethereum mainnet)
* 7,000+ transactions per second throughput
* Full EVM compatibility — integrates with all Ethereum tooling and wallets
* Carbon-neutral Proof of Stake consensus mechanism
* Established DeFi ecosystem — QuickSwap, Aave, Curve available for liquidity

Five smart contracts power the BRICKX ecosystem:

| BRXToken.sol | ERC-20 governance token. Fixed 1B supply. Burnable. Pause capability. |
|---|---|
| BRXVesting.sol | Cliff + linear vesting for ICO investors. Non-transferable vesting schedules. |
| BRXICOVault.sol | Accepts USDT/USDC. KYC whitelist enforcement. Batch BRX distribution. |
| BRICKToken.sol | ERC-1155 property tokens. Fixed price enforced on marketplace. Annual dividend tracking. |
| YieldDistributor.sol | Annual dividend distribution. 70/30 split. Admin deposits NOI. Holders receive USDC. |

All smart contracts will be audited by CertiK or Hacken prior to Polygon mainnet deployment. Full audit reports will be published publicly on the BRICKX website.
