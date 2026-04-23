// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PropertyToken.sol";

/**
 * @title Marketplace
 * @notice Enables peer-to-peer secondary market trading of property tokens.
 *         Users can list their tokens for sale, and other users can buy them at the listed price.
 *         GRIYAKU takes a 0.5% platform fee on each trade.
 */
contract Marketplace is Ownable, ReentrancyGuard {
    uint256 public constant FEE_BPS = 50; // 0.5% in basis points (50/10000)

    struct Listing {
        address seller;
        address tokenContract;
        uint256 tokenAmount;
        uint256 pricePerTokenWei;
        bool active;
    }

    uint256 public nextListingId = 1;
    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed listingId, address indexed seller, address tokenContract, uint256 amount, uint256 pricePerToken);
    event Purchased(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 totalPaid);
    event ListingCancelled(uint256 indexed listingId);

    constructor(address admin) Ownable(admin) {}

    /**
     * @notice List tokens for sale on the secondary market.
     */
    function listTokens(
        address tokenContract,
        uint256 tokenAmount,
        uint256 pricePerTokenWei
    ) external returns (uint256 listingId) {
        require(tokenAmount > 0, "Amount must be > 0");
        require(pricePerTokenWei > 0, "Price must be > 0");

        PropertyToken token = PropertyToken(payable(tokenContract));
        require(token.balanceOf(msg.sender) >= tokenAmount, "Insufficient token balance");

        // Transfer tokens into escrow (this contract holds them)
        token.transferFrom(msg.sender, address(this), tokenAmount);

        listingId = nextListingId++;
        listings[listingId] = Listing({
            seller: msg.sender,
            tokenContract: tokenContract,
            tokenAmount: tokenAmount,
            pricePerTokenWei: pricePerTokenWei,
            active: true
        });

        emit Listed(listingId, msg.sender, tokenContract, tokenAmount, pricePerTokenWei);
    }

    /**
     * @notice Buy tokens from a secondary market listing.
     */
    function buyListing(uint256 listingId, uint256 tokenAmount) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(tokenAmount > 0 && tokenAmount <= listing.tokenAmount, "Invalid amount");

        uint256 totalPrice = listing.pricePerTokenWei * tokenAmount;
        require(msg.value >= totalPrice, "Insufficient MATIC");

        uint256 fee = (totalPrice * FEE_BPS) / 10000;
        uint256 sellerProceeds = totalPrice - fee;

        listing.tokenAmount -= tokenAmount;
        if (listing.tokenAmount == 0) listing.active = false;

        // Transfer tokens to buyer
        PropertyToken(payable(listing.tokenContract)).transfer(msg.sender, tokenAmount);

        // Pay seller
        payable(listing.seller).transfer(sellerProceeds);

        // Platform fee stays in contract (owner can withdraw)
        emit Purchased(listingId, msg.sender, tokenAmount, totalPrice);

        // Refund excess
        if (msg.value > totalPrice) payable(msg.sender).transfer(msg.value - totalPrice);
    }

    /**
     * @notice Cancel a listing and return tokens to seller.
     */
    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender || owner() == msg.sender, "Not authorized");

        listing.active = false;
        PropertyToken(payable(listing.tokenContract)).transfer(listing.seller, listing.tokenAmount);

        emit ListingCancelled(listingId);
    }

    function withdrawFees() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
}
