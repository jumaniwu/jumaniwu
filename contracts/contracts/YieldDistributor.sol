// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PropertyToken.sol";

/**
 * @title YieldDistributor
 * @notice Admin contract for batch-distributing rental income across multiple properties.
 *         The GRIYAKU platform calls this contract monthly with rental proceeds converted to MATIC.
 */
contract YieldDistributor is Ownable, ReentrancyGuard {
    event BatchYieldDistributed(address[] contracts, uint256[] amounts, uint256 timestamp);
    event SingleYieldDistributed(address contractAddress, uint256 amount, uint256 timestamp);

    constructor(address admin) Ownable(admin) {}

    /**
     * @notice Distribute yield to a single property token contract.
     * @param tokenContract  Address of the PropertyToken contract
     */
    function distributeToProperty(address tokenContract) external payable onlyOwner nonReentrant {
        require(msg.value > 0, "No yield to distribute");
        PropertyToken(payable(tokenContract)).distributeYield{value: msg.value}();
        emit SingleYieldDistributed(tokenContract, msg.value, block.timestamp);
    }

    /**
     * @notice Distribute yield to multiple property contracts in one transaction.
     * @param tokenContracts  Array of PropertyToken contract addresses
     * @param amounts         MATIC amounts for each property (must sum <= msg.value)
     */
    function batchDistribute(
        address[] calldata tokenContracts,
        uint256[] calldata amounts
    ) external payable onlyOwner nonReentrant {
        require(tokenContracts.length == amounts.length, "Length mismatch");
        require(tokenContracts.length > 0, "Empty arrays");

        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }
        require(msg.value >= total, "Insufficient MATIC sent");

        for (uint256 i = 0; i < tokenContracts.length; i++) {
            if (amounts[i] > 0) {
                PropertyToken(payable(tokenContracts[i])).distributeYield{value: amounts[i]}();
            }
        }

        // Refund any excess
        uint256 excess = msg.value - total;
        if (excess > 0) payable(owner()).transfer(excess);

        emit BatchYieldDistributed(tokenContracts, amounts, block.timestamp);
    }

    receive() external payable {}
}
