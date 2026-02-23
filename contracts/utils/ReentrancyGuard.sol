// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ReentrancyGuard
 * @notice Prevents reentrancy attacks on critical functions
 * @dev All contracts use OpenZeppelin's battle-tested implementation
 * 
 * Usage:
 * - Import: import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
 * - Inherit: contract MyContract is ReentrancyGuard
 * - Protect: function criticalFunction() external nonReentrant { ... }
 * 
 * Protected Functions in ATMOS:
 * - All minting operations
 * - All trading operations (order creation, filling, cancellation)
 * - All wrapping/unwrapping operations
 * - Oracle callback functions
 * - Emergency exit functions
 */
