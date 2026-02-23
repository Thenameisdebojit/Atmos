// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title EmergencyPausable
 * @notice Extended pausable with emergency shutdown and recovery modes
 * @dev Adds granular pause controls for different contract functions
 */
contract EmergencyPausable is Pausable, AccessControl {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    // Granular pause flags
    bool public tradingPaused;
    bool public mintingPaused;
    bool public oraclePaused;
    
    string public pauseReason;
    uint256 public pauseTimestamp;
    uint256 public emergencyExitDeadline;

    event EmergencyPause(address indexed by, string reason);
    event EmergencyUnpause(address indexed by);
    event TradingPaused(bool status);
    event MintingPaused(bool status);
    event OraclePaused(bool status);
    event EmergencyExitInitiated(uint256 deadline);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
    }

    function emergencyPause(string memory reason) external onlyRole(EMERGENCY_ROLE) {
        _pause();
        pauseReason = reason;
        pauseTimestamp = block.timestamp;
        
        emit EmergencyPause(msg.sender, reason);
    }

    function emergencyUnpause() external onlyRole(EMERGENCY_ROLE) {
        _unpause();
        pauseReason = "";
        
        emit EmergencyUnpause(msg.sender);
    }

    function setTradingPause(bool status) external onlyRole(PAUSER_ROLE) {
        tradingPaused = status;
        emit TradingPaused(status);
    }

    function setMintingPause(bool status) external onlyRole(PAUSER_ROLE) {
        mintingPaused = status;
        emit MintingPaused(status);
    }

    function setOraclePause(bool status) external onlyRole(PAUSER_ROLE) {
        oraclePaused = status;
        emit OraclePaused(status);
    }

    function initiateEmergencyExit(uint256 durationSeconds) 
        external 
        onlyRole(EMERGENCY_ROLE) 
    {
        emergencyExitDeadline = block.timestamp + durationSeconds;
        emit EmergencyExitInitiated(emergencyExitDeadline);
    }

    modifier whenTradingNotPaused() {
        require(!tradingPaused, "Trading is paused");
        _;
    }

    modifier whenMintingNotPaused() {
        require(!mintingPaused, "Minting is paused");
        _;
    }

    modifier whenOracleNotPaused() {
        require(!oraclePaused, "Oracle is paused");
        _;
    }
}
