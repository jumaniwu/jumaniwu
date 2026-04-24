// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./PropertyToken.sol";

/**
 * @title PropertyFactory
 * @notice Deploys a new PropertyToken ERC-20 for each property listed on GRIYAKU.
 *         Maintains a registry of propertyId -> contract address.
 */
contract PropertyFactory is Ownable {
    mapping(string => address) public propertyContracts;
    address[] public allContracts;

    event PropertyTokenDeployed(
        string indexed propertyId,
        address contractAddress,
        string name,
        string symbol,
        uint256 totalSupply,
        uint256 tokenPriceWei
    );

    constructor(address admin) Ownable(admin) {}

    /**
     * @notice Deploy a new ERC-20 token for a property.
     * @param name          Token name, e.g. "Villa Griyaku Canggu Token"
     * @param symbol        Token symbol, e.g. "VGCT"
     * @param propertyId    Off-chain DB property ID
     * @param totalSupply   Number of tokens (= total investment / token price)
     * @param tokenPriceWei Price per token in wei (MATIC)
     */
    function deployPropertyToken(
        string calldata name,
        string calldata symbol,
        string calldata propertyId,
        uint256 totalSupply,
        uint256 tokenPriceWei
    ) external onlyOwner returns (address) {
        require(propertyContracts[propertyId] == address(0), "Property already deployed");
        require(totalSupply > 0, "Supply must be > 0");
        require(tokenPriceWei > 0, "Price must be > 0");

        PropertyToken token = new PropertyToken(
            name,
            symbol,
            propertyId,
            totalSupply,
            tokenPriceWei,
            owner()
        );

        propertyContracts[propertyId] = address(token);
        allContracts.push(address(token));

        emit PropertyTokenDeployed(propertyId, address(token), name, symbol, totalSupply, tokenPriceWei);
        return address(token);
    }

    function getPropertyContract(string calldata propertyId) external view returns (address) {
        return propertyContracts[propertyId];
    }

    function getAllContracts() external view returns (address[] memory) {
        return allContracts;
    }

    function totalProperties() external view returns (uint256) {
        return allContracts.length;
    }
}
