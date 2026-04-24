// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PropertyToken
 * @notice ERC-20 token representing fractional ownership of a real property.
 *         Each token = IDR 10,000 of property value.
 *         Rental yield is distributed proportionally to all holders.
 */
contract PropertyToken is ERC20, Ownable, ReentrancyGuard {
    string public propertyId;
    uint256 public tokenPriceWei;           // price per token in MATIC/POL
    uint256 public totalYieldDistributed;   // cumulative MATIC distributed as yield

    // Track yield already claimed per address (prevents double-claiming)
    mapping(address => uint256) public yieldClaimed;
    // Snapshots of total yield at each distribution
    uint256[] public yieldSnapshots;

    event TokensPurchased(address indexed buyer, uint256 amount, uint256 paid);
    event TokensSold(address indexed seller, uint256 amount, uint256 received);
    event YieldDistributed(uint256 amountMatic, uint256 perToken, uint256 timestamp);
    event YieldClaimed(address indexed holder, uint256 amount);

    constructor(
        string memory name,
        string memory symbol,
        string memory _propertyId,
        uint256 _totalSupply,
        uint256 _tokenPriceWei,
        address admin
    ) ERC20(name, symbol) Ownable(admin) {
        propertyId = _propertyId;
        tokenPriceWei = _tokenPriceWei;
        // Mint all tokens to the contract itself — sold on demand
        _mint(address(this), _totalSupply);
    }

    // ─── Token Purchase ───────────────────────────────────────────────────────

    function buyTokens(uint256 amount) external payable nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(balanceOf(address(this)) >= amount, "Not enough tokens available");
        require(msg.value >= tokenPriceWei * amount, "Insufficient MATIC sent");

        _transfer(address(this), msg.sender, amount);

        // Refund excess
        uint256 excess = msg.value - tokenPriceWei * amount;
        if (excess > 0) payable(msg.sender).transfer(excess);

        emit TokensPurchased(msg.sender, amount, msg.value - excess);
    }

    function sellTokens(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient token balance");

        uint256 proceeds = tokenPriceWei * amount;
        require(address(this).balance >= proceeds, "Contract has insufficient liquidity");

        _transfer(msg.sender, address(this), amount);
        payable(msg.sender).transfer(proceeds);

        emit TokensSold(msg.sender, amount, proceeds);
    }

    // ─── Yield Distribution ───────────────────────────────────────────────────

    /**
     * @notice Admin sends MATIC to this function to distribute rental income.
     *         Proportional to each holder's balance at the time of distribution.
     */
    function distributeYield() external payable onlyOwner {
        require(msg.value > 0, "No yield to distribute");
        uint256 circulatingSupply = totalSupply() - balanceOf(address(this));
        require(circulatingSupply > 0, "No token holders");

        totalYieldDistributed += msg.value;
        yieldSnapshots.push(totalYieldDistributed);

        uint256 perToken = msg.value / circulatingSupply;
        emit YieldDistributed(msg.value, perToken, block.timestamp);
    }

    /**
     * @notice Token holders call this to claim their accumulated yield.
     */
    function claimYield() external nonReentrant {
        uint256 pending = pendingYield(msg.sender);
        require(pending > 0, "No yield to claim");

        yieldClaimed[msg.sender] = totalYieldDistributed;
        payable(msg.sender).transfer(pending);

        emit YieldClaimed(msg.sender, pending);
    }

    function pendingYield(address holder) public view returns (uint256) {
        uint256 holderBalance = balanceOf(holder);
        if (holderBalance == 0) return 0;

        uint256 circulatingSupply = totalSupply() - balanceOf(address(this));
        if (circulatingSupply == 0) return 0;

        uint256 unclaimedYield = totalYieldDistributed - yieldClaimed[holder];
        return (unclaimedYield * holderBalance) / circulatingSupply;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function updateTokenPrice(uint256 newPriceWei) external onlyOwner {
        tokenPriceWei = newPriceWei;
    }

    function withdrawOperationalFunds(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        payable(owner()).transfer(amount);
    }

    function tokensAvailable() external view returns (uint256) {
        return balanceOf(address(this));
    }

    receive() external payable {}
}
