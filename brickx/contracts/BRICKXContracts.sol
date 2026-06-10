// SPDX-License-Identifier: MIT
// ════════════════════════════════════════════════════════════════
// BRICKX PROTOCOL — SMART CONTRACTS v1.1
// Network: Polygon Mainnet (Chain ID: 137)
// Compiler: Solidity ^0.8.20
// Self-contained single file — no external imports.
// (A production deployment should migrate to audited
//  OpenZeppelin Contracts v5.x equivalents.)
//
// Contracts:
//   1. BRXToken.sol      — ERC-20 governance & utility token
//   2. BRXVesting.sol    — Token vesting for ICO investors
//   3. BRXICOVault.sol   — Seed sale & ICO payment vault
//   4. BRICKToken.sol    — Property fractional ownership ledger
//   5. YieldDistributor  — Annual USDC dividend distribution
// ════════════════════════════════════════════════════════════════

pragma solidity ^0.8.20;

// ════════════════════════════════════════════════════════════════
// SHARED: Minimal IERC20 interface (self-contained, no imports)
// ════════════════════════════════════════════════════════════════
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

// ════════════════════════════════════════════════════════════════
// SHARED: Safe ERC-20 transfer helpers
// USDT-on-Polygon compatible: tolerates tokens that return no data,
// and reverts on tokens that return `false` instead of reverting.
// ════════════════════════════════════════════════════════════════
abstract contract SafeTokenTransfer {
    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Token transfer failed");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Token transferFrom failed");
    }
}

// ════════════════════════════════════════════════════════════════
// SHARED: Simple reentrancy guard (uint256 status flag)
// ════════════════════════════════════════════════════════════════
abstract contract ReentrancyGuard {
    uint256 private _status = 1; // 1 = not entered, 2 = entered

    modifier nonReentrant() {
        require(_status == 1, "Reentrant call");
        _status = 2;
        _;
        _status = 1;
    }
}


// ════════════════════════════════════════════════════════════════
// CONTRACT 1: BRXToken.sol
// ERC-20 governance + utility token for BRICKX Protocol
// Total Supply: 1,000,000,000 BRX (fixed, no additional minting)
// ════════════════════════════════════════════════════════════════
contract BRXToken {
    // ── State ──
    string public constant name     = "BRICKX Protocol Token";
    string public constant symbol   = "BRX";
    uint8  public constant decimals = 18;
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18; // 1 Billion BRX

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;
    uint256 public totalBurned;

    address public owner;
    address public vestingContract;
    address public icoVault;
    bool public mintingClosed; // once true, no more minting ever

    // ── Events ──
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Burn(address indexed burner, uint256 amount);
    event MintingClosed();

    // ── Modifiers ──
    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
    modifier mintingOpen() { require(!mintingClosed, "Minting permanently closed"); _; }

    constructor(address _vestingContract, address _icoVault) {
        owner = msg.sender;
        vestingContract = _vestingContract;
        icoVault = _icoVault;

        // Mint all tokens to deployer for distribution
        // Deployer will distribute to:
        // - Vesting contract (team, seed, ICO allocations)
        // - ICO vault (for sale)
        // - Ecosystem/staking pool
        // - DEX liquidity (time-locked)
        // - DAO treasury
        _mint(msg.sender, TOTAL_SUPPLY);
        mintingClosed = true; // Lock permanently after genesis mint
        emit MintingClosed();
    }

    // ── ERC-20 Core ──
    function totalSupply() public view returns (uint256) { return _totalSupply; }
    function balanceOf(address account) public view returns (uint256) { return _balances[account]; }

    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }
    function allowance(address _owner, address spender) public view returns (uint256) {
        return _allowances[_owner][spender];
    }
    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(_allowances[from][msg.sender] >= amount, "Insufficient allowance");
        _allowances[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }

    // ── Burn (deflationary) ──
    // 30% of ICO listing fees collected in BRX are burned
    function burn(uint256 amount) public {
        require(_balances[msg.sender] >= amount, "Insufficient balance");
        _balances[msg.sender] -= amount;
        _totalSupply -= amount;
        totalBurned += amount;
        emit Burn(msg.sender, amount);
        emit Transfer(msg.sender, address(0), amount);
    }

    // ── Internal ──
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0) && to != address(0), "Zero address");
        require(_balances[from] >= amount, "Insufficient balance");
        _balances[from] -= amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }
    function _approve(address _owner, address spender, uint256 amount) internal {
        _allowances[_owner][spender] = amount;
        emit Approval(_owner, spender, amount);
    }
    function _mint(address to, uint256 amount) internal mintingOpen {
        _totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}


// ════════════════════════════════════════════════════════════════
// CONTRACT 2: BRXVesting.sol
// Linear vesting with cliff for all token allocations
// Vesting math: nothing before cliff; after the cliff, tokens vest
// linearly over `vestingDuration`; fully vested at
// startTime + cliffDuration + vestingDuration.
// ════════════════════════════════════════════════════════════════
contract BRXVesting is SafeTokenTransfer, ReentrancyGuard {
    struct VestingSchedule {
        address beneficiary;     // who receives tokens
        uint256 totalAmount;     // total BRX allocated
        uint256 released;        // already claimed
        uint256 startTime;       // when cliff starts
        uint256 cliffDuration;   // seconds before any unlock
        uint256 vestingDuration; // linear vesting period AFTER the cliff, in seconds
        bool revocable;          // can admin revoke?
        bool revoked;
        string category;         // "seed" | "ico_r1" | "team" | "partner"
    }

    address public token;
    address public owner;
    mapping(bytes32 => VestingSchedule) public schedules;
    mapping(address => bytes32[]) public holderSchedules;
    bytes32[] public allScheduleIds;

    event ScheduleCreated(bytes32 indexed scheduleId, address indexed beneficiary, uint256 amount, string category);
    event TokensReleased(bytes32 indexed scheduleId, address indexed beneficiary, uint256 amount);
    event ScheduleRevoked(bytes32 indexed scheduleId, uint256 unvestedReturned);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor(address _token) {
        token = _token;
        owner = msg.sender;
    }

    // Create vesting schedule for an investor
    // Pulls `amount` BRX from owner into this contract (requires prior approval)
    function createSchedule(
        address beneficiary,
        uint256 amount,
        uint256 cliffMonths,    // e.g. 12 for seed investors
        uint256 vestingMonths,  // e.g. 24 for seed investors
        bool revocable,
        string calldata category
    ) external onlyOwner returns (bytes32) {
        require(beneficiary != address(0), "Zero address");
        require(amount > 0, "Zero amount");
        require(vestingMonths > 0, "Zero vesting duration");

        bytes32 scheduleId = keccak256(abi.encodePacked(beneficiary, amount, block.timestamp, category));
        require(schedules[scheduleId].totalAmount == 0, "Schedule exists");

        schedules[scheduleId] = VestingSchedule({
            beneficiary: beneficiary,
            totalAmount: amount,
            released: 0,
            startTime: block.timestamp,
            cliffDuration: cliffMonths * 30 days,
            vestingDuration: vestingMonths * 30 days,
            revocable: revocable,
            revoked: false,
            category: category
        });

        holderSchedules[beneficiary].push(scheduleId);
        allScheduleIds.push(scheduleId);

        // Pull tokens from owner into this contract (requires prior approval)
        _safeTransferFrom(token, msg.sender, address(this), amount);

        emit ScheduleCreated(scheduleId, beneficiary, amount, category);
        return scheduleId;
    }

    // Calculate releasable amount for a schedule
    function releasable(bytes32 scheduleId) public view returns (uint256) {
        VestingSchedule storage s = schedules[scheduleId];
        if (s.revoked || s.totalAmount == 0) return 0;

        uint256 elapsed = block.timestamp - s.startTime;

        // Before cliff: nothing
        if (elapsed < s.cliffDuration) return 0;

        // After cliff + full vesting period: everything remaining
        if (elapsed >= s.cliffDuration + s.vestingDuration) {
            return s.totalAmount - s.released;
        }

        // Linear vesting starts AFTER the cliff
        uint256 vested = (s.totalAmount * (elapsed - s.cliffDuration)) / s.vestingDuration;
        return vested - s.released;
    }

    // Investor claims vested tokens
    function release(bytes32 scheduleId) external nonReentrant {
        VestingSchedule storage s = schedules[scheduleId];
        require(msg.sender == s.beneficiary, "Not beneficiary");
        uint256 amount = releasable(scheduleId);
        require(amount > 0, "Nothing to release");

        // Effects before interactions
        s.released += amount;
        emit TokensReleased(scheduleId, s.beneficiary, amount);

        _safeTransfer(token, s.beneficiary, amount);
    }

    // Admin can revoke unvested tokens (only if revocable).
    // Vested-but-unreleased tokens are paid to the beneficiary;
    // unvested tokens are returned to the owner (treasury).
    function revoke(bytes32 scheduleId) external onlyOwner nonReentrant {
        VestingSchedule storage s = schedules[scheduleId];
        require(s.revocable, "Not revocable");
        require(!s.revoked, "Already revoked");

        uint256 vestedUnreleased = releasable(scheduleId);
        uint256 unvested = s.totalAmount - s.released - vestedUnreleased;

        // Effects before interactions
        s.revoked = true;
        s.released += vestedUnreleased;
        emit ScheduleRevoked(scheduleId, unvested);

        if (vestedUnreleased > 0) {
            _safeTransfer(token, s.beneficiary, vestedUnreleased);
            emit TokensReleased(scheduleId, s.beneficiary, vestedUnreleased);
        }
        if (unvested > 0) {
            _safeTransfer(token, owner, unvested); // return to treasury
        }
    }

    // View all schedules for a holder
    function getSchedules(address holder) external view returns (bytes32[] memory) {
        return holderSchedules[holder];
    }
}


// ════════════════════════════════════════════════════════════════
// CONTRACT 3: BRXICOVault.sol
// Seed Sale & ICO payment collection vault
// Accepts USDT/USDC on Polygon, records allocations
// NOTE: owner MUST be a multisig (e.g. Gnosis Safe 3-of-5) behind a
// timelock — it controls KYC, rounds, and emergencyWithdraw.
// ════════════════════════════════════════════════════════════════
contract BRXICOVault is SafeTokenTransfer, ReentrancyGuard {

    // ── Structs ──
    struct Round {
        uint256 pricePerBRX;    // in USDC (6 decimals), e.g. 8000 = $0.008
        uint256 totalTokens;    // BRX allocated for this round
        uint256 tokensSold;
        uint256 raiseTarget;    // in USDC
        uint256 raiseCollected;
        uint256 minInvestment;  // in USDC
        uint256 maxInvestment;  // per wallet
        uint256 startTime;
        uint256 endTime;
        bool    active;
        bool    finalized;
    }

    struct Purchase {
        address buyer;
        uint256 usdcPaid;       // USD stable paid — USDC or USDT (6 decimals)
        uint256 brxAllocated;   // BRX tokens allocated (18 decimals)
        uint256 timestamp;
        uint8   roundId;
        bool    distributed;    // has BRX been sent to wallet?
    }

    // ── State ──
    address public owner;
    address public pendingOwner;    // two-step ownership transfer
    address public treasury;        // receives USDC/USDT payments
    address public usdc;            // USDC contract on Polygon
    address public usdt;            // USDT contract on Polygon
    address public brxToken;        // BRX token contract
    address public vestingContract; // where BRX is locked after purchase

    bool public paused;
    bool public kycRequired;

    mapping(uint8 => Round) public rounds;
    uint8 public currentRound;
    uint8 public roundCount;

    mapping(bytes32 => Purchase) public purchases;
    bytes32[] public allPurchaseIds;
    mapping(address => bytes32[]) public buyerPurchases;
    mapping(address => uint256) public totalInvested;    // USDC per wallet
    mapping(address => bool)    public kycApproved;      // whitelist
    mapping(address => bool)    public blacklisted;

    // ── Events ──
    event RoundCreated(uint8 indexed roundId, uint256 price, uint256 totalTokens);
    event RoundActivated(uint8 indexed roundId);
    event RoundFinalized(uint8 indexed roundId, uint256 raised);
    event PurchaseMade(bytes32 indexed purchaseId, address indexed buyer, address payToken, uint256 stableAmount, uint256 brx, uint8 roundId);
    event KYCApproved(address indexed wallet);
    event KYCRevoked(address indexed wallet);
    event BlacklistUpdated(address indexed wallet, bool status);
    event BRXDistributed(address indexed recipient, uint256 amount);
    event EmergencyPause(bool paused);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event KYCRequirementUpdated(bool required);
    event OwnershipProposed(address indexed currentOwner, address indexed proposedOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event EmergencyWithdrawal(address indexed token, address indexed to, uint256 amount);

    // ── Modifiers ──
    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
    modifier notPaused() { require(!paused, "Contract paused"); _; }
    modifier notBlacklisted() { require(!blacklisted[msg.sender], "Blacklisted"); _; }
    modifier kycPass() {
        if (kycRequired) require(kycApproved[msg.sender], "KYC required. Visit brickxprotocol.io to verify");
        _;
    }

    constructor(
        address _treasury,
        address _usdc,
        address _usdt,
        address _brxToken,
        address _vesting
    ) {
        owner          = msg.sender;
        treasury       = _treasury;
        usdc           = _usdc;
        usdt           = _usdt;
        brxToken       = _brxToken;
        vestingContract = _vesting;
        kycRequired    = true;
    }

    // ── Admin: Create ICO Round ──
    function createRound(
        uint256 pricePerBRX,    // e.g. 8000 for $0.008 (USDC has 6 decimals)
        uint256 totalTokens,    // e.g. 80_000_000e18 for 80M BRX
        uint256 raiseTarget,    // e.g. 640_000e6 for $640,000 USDC
        uint256 minInvestment,  // e.g. 100e6 for $100 USDC
        uint256 maxInvestment,  // e.g. 50_000e6 for $50,000 USDC
        uint256 startTime,
        uint256 endTime
    ) external onlyOwner {
        roundCount++;
        rounds[roundCount] = Round({
            pricePerBRX: pricePerBRX,
            totalTokens: totalTokens,
            tokensSold: 0,
            raiseTarget: raiseTarget,
            raiseCollected: 0,
            minInvestment: minInvestment,
            maxInvestment: maxInvestment,
            startTime: startTime,
            endTime: endTime,
            active: false,
            finalized: false
        });
        emit RoundCreated(roundCount, pricePerBRX, totalTokens);
    }

    // Activate a round (deactivates all others)
    function activateRound(uint8 roundId) external onlyOwner {
        for (uint8 i = 1; i <= roundCount; i++) rounds[i].active = false;
        rounds[roundId].active = true;
        currentRound = roundId;
        emit RoundActivated(roundId);
    }

    // ── Admin: KYC Management ──
    function approveKYC(address[] calldata wallets) external onlyOwner {
        for (uint i = 0; i < wallets.length; i++) {
            kycApproved[wallets[i]] = true;
            emit KYCApproved(wallets[i]);
        }
    }
    function revokeKYC(address wallet) external onlyOwner {
        kycApproved[wallet] = false;
        emit KYCRevoked(wallet);
    }
    function setBlacklist(address wallet, bool status) external onlyOwner {
        blacklisted[wallet] = status;
        emit BlacklistUpdated(wallet, status);
    }

    // ── BUY with USDC ──
    function buyWithUSDC(uint256 usdcAmount) external notPaused notBlacklisted kycPass nonReentrant {
        _buy(usdc, usdcAmount);
    }

    // ── BUY with USDT ──
    function buyWithUSDT(uint256 usdtAmount) external notPaused notBlacklisted kycPass nonReentrant {
        _buy(usdt, usdtAmount);
    }

    // Shared purchase logic (USDC/USDT, both 6 decimals on Polygon)
    function _buy(address payToken, uint256 stableAmount) internal {
        Round storage r = rounds[currentRound];
        require(r.active, "No active round");
        require(block.timestamp >= r.startTime && block.timestamp <= r.endTime, "Round not in time window");
        require(stableAmount >= r.minInvestment, "Below minimum investment");
        require(totalInvested[msg.sender] + stableAmount <= r.maxInvestment, "Exceeds max investment per wallet");
        require(r.raiseCollected + stableAmount <= r.raiseTarget, "Round hard cap reached");

        // Calculate BRX allocation
        // brxAmount = (stableAmount * 1e18) / pricePerBRX
        // Example: $1000 USDC (1000e6) at $0.008 (8000) = 125,000 BRX
        uint256 brxAmount = (stableAmount * 1e18) / r.pricePerBRX;
        require(r.tokensSold + brxAmount <= r.totalTokens, "Insufficient BRX remaining in round");

        // ── Effects (state updates BEFORE external transfer) ──
        bytes32 purchaseId = keccak256(abi.encodePacked(msg.sender, stableAmount, block.timestamp));
        purchases[purchaseId] = Purchase({
            buyer: msg.sender,
            usdcPaid: stableAmount,
            brxAllocated: brxAmount,
            timestamp: block.timestamp,
            roundId: currentRound,
            distributed: false
        });
        allPurchaseIds.push(purchaseId);
        buyerPurchases[msg.sender].push(purchaseId);

        r.tokensSold      += brxAmount;
        r.raiseCollected  += stableAmount;
        totalInvested[msg.sender] += stableAmount;

        emit PurchaseMade(purchaseId, msg.sender, payToken, stableAmount, brxAmount, currentRound);

        // ── Interaction: pull stablecoin from buyer to treasury ──
        _safeTransferFrom(payToken, msg.sender, treasury, stableAmount);

        // Vesting schedules are created by admin via BRXVesting.createSchedule
        // after TGE, per the round's cliff/vesting terms.
    }

    // ── Admin: Distribute BRX (airdrop after TGE) ──
    // Vault must be funded with BRX before calling.
    function distributeBatch(bytes32[] calldata purchaseIds) external onlyOwner nonReentrant {
        for (uint i = 0; i < purchaseIds.length; i++) {
            Purchase storage p = purchases[purchaseIds[i]];
            if (!p.distributed && p.buyer != address(0)) {
                p.distributed = true; // effect before interaction
                _safeTransfer(brxToken, p.buyer, p.brxAllocated);
                emit BRXDistributed(p.buyer, p.brxAllocated);
            }
        }
    }

    // ── Views ──
    function getRoundInfo(uint8 roundId) external view returns (Round memory) {
        return rounds[roundId];
    }
    function getBuyerPurchases(address buyer) external view returns (bytes32[] memory) {
        return buyerPurchases[buyer];
    }
    function getPurchase(bytes32 purchaseId) external view returns (Purchase memory) {
        return purchases[purchaseId];
    }
    function getTotalBRXAllocated(address buyer) external view returns (uint256 total) {
        bytes32[] memory ids = buyerPurchases[buyer];
        for (uint i = 0; i < ids.length; i++) {
            total += purchases[ids[i]].brxAllocated;
        }
    }

    // ── Admin Controls ──
    function pause() external onlyOwner { paused = true; emit EmergencyPause(true); }
    function unpause() external onlyOwner { paused = false; emit EmergencyPause(false); }
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }
    function setKYCRequired(bool required) external onlyOwner {
        kycRequired = required;
        emit KYCRequirementUpdated(required);
    }

    // ── Two-step ownership transfer ──
    function proposeOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        pendingOwner = newOwner;
        emit OwnershipProposed(owner, newOwner);
    }
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    // Emergency withdrawal (owner only).
    // SECURITY: owner must be a multisig (e.g. Gnosis Safe 3-of-5) behind a
    // 48h timelock — this function can move any token held by the vault.
    function emergencyWithdraw(address token_, address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Zero address");
        _safeTransfer(token_, to, amount);
        emit EmergencyWithdrawal(token_, to, amount);
    }
}


// ════════════════════════════════════════════════════════════════
// CONTRACT 4: BRICKToken.sol
// SIMPLIFIED fractional-ownership LEDGER for property tokens.
// NOT a full ERC-1155 implementation (no safeTransferFrom,
// operator approvals, batch ops, or ERC-165). A production
// deployment MUST use OpenZeppelin ERC1155 instead.
// Each property = unique token ID = 1,000,000 tokens
// Price is FIXED permanently per property: $10.00 USDC — NEVER changes
// ════════════════════════════════════════════════════════════════
contract BRICKToken is SafeTokenTransfer, ReentrancyGuard {
    // ── Property ──
    struct Property {
        string  name;
        string  location;
        uint256 stablePrice;     // Fixed USD price in USDC (6 decimals) — always $10.00
        uint256 totalSupply;     // 1,000,000 tokens per property
        uint256 minted;
        uint256 annualYieldBPS;  // ESTIMATED annual dividend yield in basis points (e.g. 510 = ~5.1%)
        bool    active;
        bool    yieldPaused;
        string  spvEntity;       // legal entity holding property
    }

    // Protocol rule: BRICK price is $10.00, fixed forever (USDC 6 decimals)
    uint256 public constant FIXED_BRICK_PRICE = 10_000000;

    // ── State ──
    string public name = "BRICKX Property Token";
    string public symbol = "BRICK";

    address public owner;
    address public factory;      // ICO contract that can mint
    address public usdc;
    address public treasury;     // receives mint proceeds and marketplace fees

    uint256 public propertyCount;
    mapping(uint256 => Property) public properties;
    mapping(uint256 => mapping(address => uint256)) private _balances;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    // ── Marketplace (stable price only) ──
    struct Listing {
        address seller;
        uint256 propertyId;
        uint256 tokens;
        uint256 pricePerToken;   // MUST equal property.stablePrice
        bool    active;
    }
    mapping(uint256 => Listing) public listings;
    uint256 public listingCount;
    uint256 public platformFeeBPS; // 50 = 0.5%

    // ── Events ──
    event PropertyAdded(uint256 indexed propertyId, string name, uint256 stablePrice);
    event TransferSingle(address indexed op, address indexed from, address indexed to, uint256 id, uint256 amount);
    event Listed(uint256 indexed listingId, address seller, uint256 propertyId, uint256 tokens, uint256 price);
    event Sale(uint256 indexed listingId, address indexed buyer, uint256 tokens, uint256 usdc);
    event ListingCancelled(uint256 indexed listingId);
    event YieldDistributed(uint256 indexed propertyId, uint256 amount, uint256 perToken);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor(address _usdc, address _treasury) {
        require(_usdc != address(0) && _treasury != address(0), "Zero address");
        owner    = msg.sender;
        usdc     = _usdc;
        treasury = _treasury;
        platformFeeBPS = 50; // 0.5%
    }

    // ── Admin: Add Property ──
    function addProperty(
        string calldata _name,
        string calldata _location,
        uint256 _stablePrice,    // MUST be 10_000000 ($10.00 USDC, 6 decimals)
        uint256 _annualYieldBPS, // ESTIMATED annual dividend yield, e.g. 510 for ~5.1%
        string calldata _spvEntity
    ) external onlyOwner returns (uint256) {
        require(_stablePrice == FIXED_BRICK_PRICE, "BRICK price fixed at $10.00");
        propertyCount++;
        properties[propertyCount] = Property({
            name: _name,
            location: _location,
            stablePrice: _stablePrice,
            totalSupply: 1_000_000,  // 1M BRICK per property
            minted: 0,
            annualYieldBPS: _annualYieldBPS,
            active: true,
            yieldPaused: false,
            spvEntity: _spvEntity
        });
        emit PropertyAdded(propertyCount, _name, _stablePrice);
        return propertyCount;
    }

    // ── Mint BRICK tokens (purchase property) ──
    // Collects USDC at the fixed stable price from `buyer` (requires prior
    // approval) and forwards proceeds to the treasury.
    function mint(address buyer, uint256 propertyId, uint256 tokens) external onlyOwner nonReentrant {
        Property storage p = properties[propertyId];
        require(p.active, "Property not active");
        require(tokens > 0, "Zero tokens");
        require(p.minted + tokens <= p.totalSupply, "Exceeds supply");

        uint256 cost = tokens * p.stablePrice; // stablePrice has 6 decimals

        // ── Effects before interaction ──
        p.minted += tokens;
        _balances[propertyId][buyer] += tokens;
        emit TransferSingle(msg.sender, address(0), buyer, propertyId, tokens);

        // ── Interaction: collect USDC from buyer to treasury ──
        _safeTransferFrom(usdc, buyer, treasury, cost);
    }

    // ── Marketplace: List tokens for sale ──
    // Price MUST match property stable price (no speculation)
    function list(uint256 propertyId, uint256 tokens) external returns (uint256 listingId) {
        Property storage p = properties[propertyId];
        require(_balances[propertyId][msg.sender] >= tokens, "Insufficient tokens");
        require(tokens > 0, "Zero tokens");

        // Lock tokens in contract during listing
        _balances[propertyId][msg.sender] -= tokens;
        _balances[propertyId][address(this)] += tokens;

        listingCount++;
        listings[listingCount] = Listing({
            seller: msg.sender,
            propertyId: propertyId,
            tokens: tokens,
            pricePerToken: p.stablePrice, // ENFORCED stable price
            active: true
        });
        emit Listed(listingCount, msg.sender, propertyId, tokens, p.stablePrice);
        return listingCount;
    }

    // ── Marketplace: Buy listed tokens ──
    // Buyer pays seller (minus platform fee); fee goes to treasury.
    function buyListing(uint256 listingId) external nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active, "Listing not active");
        require(msg.sender != l.seller, "Cannot buy own listing");

        uint256 totalCost = l.tokens * l.pricePerToken;
        uint256 fee = (totalCost * platformFeeBPS) / 10000;
        uint256 sellerReceives = totalCost - fee;

        // ── Effects before interactions ──
        l.active = false;
        _balances[l.propertyId][address(this)] -= l.tokens;
        _balances[l.propertyId][msg.sender] += l.tokens;
        emit Sale(listingId, msg.sender, l.tokens, totalCost);
        emit TransferSingle(address(this), l.seller, msg.sender, l.propertyId, l.tokens);

        // ── Interactions: collect USDC from buyer ──
        _safeTransferFrom(usdc, msg.sender, l.seller, sellerReceives);
        if (fee > 0) {
            _safeTransferFrom(usdc, msg.sender, treasury, fee);
        }
    }

    // ── Cancel listing ──
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage l = listings[listingId];
        require(msg.sender == l.seller, "Not seller");
        require(l.active, "Not active");
        l.active = false;
        _balances[l.propertyId][address(this)] -= l.tokens;
        _balances[l.propertyId][msg.sender]    += l.tokens;
        emit ListingCancelled(listingId);
    }

    // ── Views ──
    function balanceOf(address account, uint256 id) public view returns (uint256) {
        return _balances[id][account];
    }
    function getProperty(uint256 id) external view returns (Property memory) {
        return properties[id];
    }
}


// ════════════════════════════════════════════════════════════════
// CONTRACT 5: YieldDistributor.sol
// Annual dividend distribution (70% NOI, paid June, Dec-31 snapshot)
// to BRICK token holders. 70% of NOI → holders, 30% → protocol.
// ADMIN-PUSH model: the off-chain system snapshots holders on Dec 31,
// audits Jan-Mar, announces in April, and the admin pushes USDC
// payouts in June via distributeAnnual().
// ════════════════════════════════════════════════════════════════
contract YieldDistributor is SafeTokenTransfer, ReentrancyGuard {

    struct Distribution {
        uint16  fiscalYear;        // e.g. 2026 (snapshot taken Dec 31 of this year)
        uint256 totalAmount;       // total USDC paid to holders
        uint256 holderCount;       // number of holders paid
        uint256 timestamp;
    }

    address public owner;
    address public usdc;
    address public brickToken;
    address public treasury;

    // Protocol rule: 70/30 split is IMMUTABLE — never changes
    uint256 public constant HOLDERS_SHARE_BPS  = 7000; // 70% of NOI to holders
    uint256 public constant PROTOCOL_SHARE_BPS = 3000; // 30% of NOI to protocol

    mapping(uint256 => Distribution[]) public propertyDistributions;
    mapping(uint256 => mapping(uint16 => bool)) public yearDistributed; // propertyId => fiscalYear => done

    uint256 public totalDistributed;

    event AnnualDistribution(uint256 indexed propertyId, uint16 indexed fiscalYear, uint256 totalAmount, uint256 holderCount);
    event DividendPaid(uint256 indexed propertyId, uint16 indexed fiscalYear, address indexed holder, uint256 amount);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor(address _usdc, address _brick, address _treasury) {
        owner      = msg.sender;
        usdc       = _usdc;
        brickToken = _brick;
        treasury   = _treasury;
    }

    // ── Annual admin-push distribution ──
    // Holder list + amounts come from the off-chain Dec-31 snapshot
    // (audited Jan-Mar). Amounts already reflect the 70% holders share.
    // Pulls total USDC from owner (requires prior approval), then pays
    // each holder directly.
    function distributeAnnual(
        uint256 propertyId,
        uint16 fiscalYear,
        address[] calldata holders,
        uint256[] calldata amounts
    ) external onlyOwner nonReentrant {
        require(holders.length == amounts.length, "Array length mismatch");
        require(holders.length > 0, "Empty distribution");
        require(!yearDistributed[propertyId][fiscalYear], "Year already distributed");

        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(holders[i] != address(0), "Zero address holder");
            total += amounts[i];
        }
        require(total > 0, "Zero total");

        // ── Effects before interactions ──
        yearDistributed[propertyId][fiscalYear] = true;
        propertyDistributions[propertyId].push(Distribution({
            fiscalYear: fiscalYear,
            totalAmount: total,
            holderCount: holders.length,
            timestamp: block.timestamp
        }));
        totalDistributed += total;
        emit AnnualDistribution(propertyId, fiscalYear, total, holders.length);

        // ── Interactions: pull USDC from owner, pay each holder ──
        _safeTransferFrom(usdc, msg.sender, address(this), total);
        for (uint256 i = 0; i < holders.length; i++) {
            _safeTransfer(usdc, holders[i], amounts[i]);
            emit DividendPaid(propertyId, fiscalYear, holders[i], amounts[i]);
        }
    }

    function getDistributionHistory(uint256 propertyId) external view returns (Distribution[] memory) {
        return propertyDistributions[propertyId];
    }
}


// ════════════════════════════════════════════════════════════════
// DEPLOYMENT GUIDE
// ════════════════════════════════════════════════════════════════
/*

PREREQUISITES:
  npm install -g hardhat
  npm install @nomiclabs/hardhat-ethers ethers
  npm install @nomicfoundation/hardhat-toolbox

SETUP:
  mkdir brickx-contracts && cd brickx-contracts
  npx hardhat init
  # Copy contracts to contracts/ folder

HARDHAT CONFIG (hardhat.config.js):
  require("@nomicfoundation/hardhat-toolbox");
  require("dotenv").config();

  module.exports = {
    solidity: { version: "0.8.20", settings: { optimizer: { enabled: true, runs: 200 } } },
    networks: {
      // Amoy Testnet (test first!)
      amoy: {
        url: process.env.POLYGON_AMOY_RPC,
        accounts: [process.env.DEPLOYER_PRIVATE_KEY],
        chainId: 80002,
      },
      // Polygon Mainnet (deploy after testing — network default gas pricing)
      polygon: {
        url: process.env.POLYGON_MAINNET_RPC,
        accounts: [process.env.DEPLOYER_PRIVATE_KEY],
        chainId: 137,
      },
    },
    etherscan: { apiKey: { polygon: process.env.POLYGONSCAN_API_KEY } },
  };

.env FILE:
  POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
  POLYGON_MAINNET_RPC=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
  DEPLOYER_PRIVATE_KEY=0x... (use Gnosis Safe for mainnet)
  POLYGONSCAN_API_KEY=your_key
  TREASURY_WALLET=0x...
  USDC_POLYGON=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
  USDT_POLYGON=0xc2132D05D31c914a87C6611C10748AEb04B58e8F

DEPLOY SCRIPT (scripts/deploy.js):
  async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with:", deployer.address);

    const TREASURY = process.env.TREASURY_WALLET;
    const USDC     = process.env.USDC_POLYGON;
    const USDT     = process.env.USDT_POLYGON;

    // 1. Deploy Vesting (needs BRX address — deploy placeholder first)
    const Vesting = await ethers.deployContract("BRXVesting", [ethers.ZeroAddress]);
    await Vesting.waitForDeployment();
    console.log("BRXVesting:", await Vesting.getAddress());

    // 2. Deploy ICOVault placeholder
    const ICOVault = await ethers.deployContract("BRXICOVault",
      [TREASURY, USDC, USDT, ethers.ZeroAddress, await Vesting.getAddress()]);
    await ICOVault.waitForDeployment();
    console.log("BRXICOVault:", await ICOVault.getAddress());

    // 3. Deploy BRX Token
    const BRX = await ethers.deployContract("BRXToken",
      [await Vesting.getAddress(), await ICOVault.getAddress()]);
    await BRX.waitForDeployment();
    console.log("BRXToken:", await BRX.getAddress());

    // 4. Deploy BRICK Token (USDC + treasury)
    const BRICK = await ethers.deployContract("BRICKToken", [USDC, TREASURY]);
    await BRICK.waitForDeployment();
    console.log("BRICKToken:", await BRICK.getAddress());

    // 5. Deploy Yield Distributor (annual dividend, 70/30 split immutable)
    const YieldDist = await ethers.deployContract("YieldDistributor",
      [USDC, await BRICK.getAddress(), TREASURY]);
    await YieldDist.waitForDeployment();
    console.log("YieldDistributor:", await YieldDist.getAddress());

    // 6. Create Seed Round
    const now = Math.floor(Date.now()/1000);
    await ICOVault.createRound(
      8000,                    // $0.008 per BRX (USDC 6 dec: 8000 = 0.008 * 1e6 / 1e6 * price)
      ethers.parseEther("80000000"), // 80M BRX
      640_000_000000n,         // $640,000 USDC
      100_000000n,             // $100 min
      50_000_000000n,          // $50,000 max
      now,                     // start now
      now + 30*24*3600         // end in 30 days
    );
    await ICOVault.activateRound(1);
    console.log("Seed round created and activated!");

    // 7. Add first property (hotel details CONFIDENTIAL until acquisition)
    await BRICK.addProperty(
      "Project Hotel Batam (Confidential)",
      "Batam, Indonesia (exact location confidential)",
      10_000000n,   // $10.00 USDC (6 decimals) — fixed forever, contract enforces this
      510,          // ~5.1% ESTIMATED annual dividend yield (BPS)
      "Confidential SPV"
    );
    console.log("Confidential hotel property added!");

    console.log("\n✅ DEPLOYMENT COMPLETE");
    console.log("BRX Token:       ", await BRX.getAddress());
    console.log("ICO Vault:       ", await ICOVault.getAddress());
    console.log("Vesting:         ", await Vesting.getAddress());
    console.log("BRICK Token:     ", await BRICK.getAddress());
    console.log("Yield Dist:      ", await YieldDist.getAddress());
    console.log("\nUpdate these addresses in Admin Panel → Settings!");
  }

  main().catch(console.error);

COMMANDS:
  npx hardhat compile
  npx hardhat test
  npx hardhat run scripts/deploy.js --network amoy     # testnet first
  npx hardhat verify --network polygon CONTRACT_ADDRESS # verify on Polygonscan
  npx hardhat run scripts/deploy.js --network polygon  # mainnet

ESTIMATED GAS COST (Polygon):
  BRXToken deploy:         ~2,000,000 gas (~$0.50)
  BRXICOVault deploy:      ~3,000,000 gas (~$0.75)
  BRXVesting deploy:       ~2,500,000 gas (~$0.60)
  BRICKToken deploy:       ~2,000,000 gas (~$0.50)
  YieldDistributor deploy: ~1,500,000 gas (~$0.35)
  Total:                   ~$3-5 on Polygon mainnet

SECURITY CHECKLIST:
  [ ] All contracts tested on Amoy testnet
  [ ] Professional audit (e.g. CertiK / Hacken) — REQUIRED before mainnet
  [ ] Multi-sig Gnosis Safe as owner (3-of-5)
  [ ] Emergency pause tested
  [ ] KYC whitelist populated before activating round
  [ ] Treasury wallet is multi-sig, not EOA
  [ ] Timelock on owner functions (48h delay)
  [ ] Bug bounty program live
  [ ] Migrate BRICKToken to OpenZeppelin ERC1155 before production

POST-DEPLOYMENT:
  1. Add all contract addresses to Admin Panel Settings
  2. Populate KYC whitelist with approved users
  3. Transfer BRX allocation to Vesting contract
  4. Announce on Telegram + Twitter
  5. Round 1 ICO live!
*/
