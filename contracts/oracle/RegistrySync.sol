// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/functions/dev/v1_0_0/FunctionsClient.sol";
import "@chainlink/contracts/src/v0.8/functions/dev/v1_0_0/libraries/FunctionsRequest.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../core/CarbonCreditNFT.sol";

/**
 * @title RegistrySync
 * @notice Prevents double-counting by verifying credits against external registries
 * @dev Uses Chainlink Functions to query Verra, Gold Standard, and ICM registries
 * 
 * Problem: Same carbon reduction could be tokenized on multiple platforms
 * Solution: Before minting, verify serial number doesn't exist in external registry
 * 
 * Registries Supported:
 * - Verra Registry (VCS)
 * - Gold Standard Registry
 * - India Carbon Market (ICM/GCI)
 * - ACX (AirCarbon Exchange)
 */
contract RegistrySync is 
    FunctionsClient,
    AccessControl,
    ReentrancyGuard 
{
    using FunctionsRequest for FunctionsRequest.Request;

    // ============ ROLES ============
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    // ============ STATE VARIABLES ============
    
    address public functionsRouter;
    bytes32 public donId;
    uint64 public subscriptionId;
    uint32 public gasLimit = 200000;

    CarbonCreditNFT public immutable nftContract;

    /// @notice Registry verification request
    struct RegistryCheck {
        bytes32 requestId;
        string registry;              // "VERRA" | "GOLD_STANDARD" | "ICM"
        string serialNumber;
        address requester;
        uint256 requestTime;
        bool fulfilled;
        bool existsInRegistry;        // true = already tokenized elsewhere
        string registryStatus;        // "ACTIVE" | "RETIRED" | "NOT_FOUND"
        bytes32 registryProofHash;
    }

    /// @notice Whitelist of verified registries
    struct Registry {
        string name;
        string apiEndpoint;
        bool isActive;
        uint256 checksPerformed;
        uint256 duplicatesFound;
    }

    // ============ MAPPINGS ============
    mapping(bytes32 => RegistryCheck) public registryChecks;
    mapping(string => Registry) public registries;
    mapping(string => mapping(string => bool)) public registrySerials; // registry => serial => exists
    mapping(bytes32 => bool) public verifiedCredits;  // keccak256(registry, serial) => verified

    string[] public registryList;

    // ============ CHAINLINK FUNCTIONS SOURCE CODE ============
    
    string public registryCheckSource = 
        "const registry = args[0];"
        "const serialNumber = args[1];"
        ""
        "let apiUrl, headers;"
        ""
        "// Route to appropriate registry API"
        "if (registry === 'VERRA') {"
        "  apiUrl = `https://registry.verra.org/api/v1/credits/${serialNumber}`;"
        "  headers = { 'Authorization': `Bearer ${secrets.VERRA_API_KEY}` };"
        "} else if (registry === 'GOLD_STANDARD') {"
        "  apiUrl = `https://api.goldstandard.org/registry/credits/${serialNumber}`;"
        "  headers = { 'Authorization': `Bearer ${secrets.GS_API_KEY}` };"
        "} else if (registry === 'ICM') {"
        "  apiUrl = `https://gci.bee.gov.in/api/credits/${serialNumber}`;"
        "  headers = { 'Authorization': `Bearer ${secrets.ICM_API_KEY}` };"
        "} else {"
        "  throw Error('Unsupported registry');"
        "}"
        ""
        "// Query registry"
        "const response = await Functions.makeHttpRequest({"
        "  url: apiUrl,"
        "  headers: headers"
        "});"
        ""
        "if (response.error && response.status !== 404) {"
        "  throw Error(`Registry query failed: ${response.error}`);"
        "}"
        ""
        "// Parse response"
        "let exists = false;"
        "let status = 'NOT_FOUND';"
        ""
        "if (response.status === 200 && response.data) {"
        "  exists = true;"
        "  status = response.data.status || 'ACTIVE';"
        "}"
        ""
        "// Encode result: [exists (bool), status (uint8)]"
        "// Status: 0=NOT_FOUND, 1=ACTIVE, 2=RETIRED"
        "const statusCode = status === 'RETIRED' ? 2 : (status === 'ACTIVE' ? 1 : 0);"
        "const result = (exists ? 1 : 0) * 256 + statusCode;"
        ""
        "return Functions.encodeUint256(result);";

    // ============ EVENTS ============
    event RegistryCheckRequested(
        bytes32 indexed requestId,
        string indexed registry,
        string serialNumber
    );

    event RegistryCheckFulfilled(
        bytes32 indexed requestId,
        string indexed registry,
        string serialNumber,
        bool existsInRegistry,
        string status
    );

    event DuplicateCreditDetected(
        string indexed registry,
        string serialNumber,
        address requester
    );

    event RegistryAdded(string indexed registry, string apiEndpoint);

    event CreditVerified(
        bytes32 indexed creditHash,
        string registry,
        string serialNumber
    );

    // ============ CONSTRUCTOR ============
    constructor(
        address functionsRouter_,
        address nftContract_
    ) FunctionsClient(functionsRouter_) {
        require(nftContract_ != address(0), "Invalid NFT contract");
        
        functionsRouter = functionsRouter_;
        nftContract = CarbonCreditNFT(nftContract_);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);

        // Initialize default registries
        _addRegistry("VERRA", "https://registry.verra.org/api/v1");
        _addRegistry("GOLD_STANDARD", "https://api.goldstandard.org/registry");
        _addRegistry("ICM", "https://gci.bee.gov.in/api");
    }

    // ============ CORE FUNCTIONS ============

    /**
     * @notice Check if a serial number exists in external registry
     * @dev Called before minting to prevent double-counting
     * @param registry Registry name ("VERRA", "GOLD_STANDARD", "ICM")
     * @param serialNumber Credit serial number to check
     * @return requestId Chainlink Functions request ID
     */
    function checkRegistry(
        string memory registry,
        string memory serialNumber
    ) external onlyRole(VERIFIER_ROLE) nonReentrant returns (bytes32 requestId) {
        require(registries[registry].isActive, "Registry not supported");
        require(bytes(serialNumber).length > 0, "Invalid serial number");

        // Prepare Chainlink Functions request
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(registryCheckSource);

        string[] memory args = new string[](2);
        args[0] = registry;
        args[1] = serialNumber;
        req.setArgs(args);

        // Send request
        requestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donId
        );

        // Track request
        registryChecks[requestId] = RegistryCheck({
            requestId: requestId,
            registry: registry,
            serialNumber: serialNumber,
            requester: msg.sender,
            requestTime: block.timestamp,
            fulfilled: false,
            existsInRegistry: false,
            registryStatus: "",
            registryProofHash: bytes32(0)
        });

        registries[registry].checksPerformed++;

        emit RegistryCheckRequested(requestId, registry, serialNumber);

        return requestId;
    }

    /**
     * @notice Chainlink Functions callback - receives registry check result
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        RegistryCheck storage check = registryChecks[requestId];
        require(!check.fulfilled, "Request already fulfilled");

        if (err.length > 0) {
            // Oracle error - assume credit doesn't exist (fail-safe)
            check.fulfilled = true;
            check.existsInRegistry = false;
            check.registryStatus = "ERROR";
            emit RegistryCheckFulfilled(requestId, check.registry, check.serialNumber, false, "ERROR");
            return;
        }

        // Decode response: [exists (1 byte) | status (1 byte)]
        uint256 result = abi.decode(response, (uint256));
        bool exists = (result / 256) == 1;
        uint8 statusCode = uint8(result % 256);
        
        string memory status = statusCode == 2 ? "RETIRED" : (statusCode == 1 ? "ACTIVE" : "NOT_FOUND");

        // Update check
        check.fulfilled = true;
        check.existsInRegistry = exists;
        check.registryStatus = status;
        check.registryProofHash = keccak256(response);

        // Update registry tracking
        if (exists) {
            registrySerials[check.registry][check.serialNumber] = true;
            registries[check.registry].duplicatesFound++;
            
            emit DuplicateCreditDetected(check.registry, check.serialNumber, check.requester);
        } else {
            // Mark as verified for minting
            bytes32 creditHash = keccak256(abi.encodePacked(check.registry, check.serialNumber));
            verifiedCredits[creditHash] = true;
            
            emit CreditVerified(creditHash, check.registry, check.serialNumber);
        }

        emit RegistryCheckFulfilled(requestId, check.registry, check.serialNumber, exists, status);
    }

    /**
     * @notice Verify a credit is cleared for minting
     * @dev Called by CarbonCreditNFT before minting
     */
    function isCreditVerified(string memory registry, string memory serialNumber) 
        external 
        view 
        returns (bool) 
    {
        bytes32 creditHash = keccak256(abi.encodePacked(registry, serialNumber));
        return verifiedCredits[creditHash];
    }

    /**
     * @notice Check if serial exists in local cache (fast check before oracle)
     */
    function isSerialUsed(string memory registry, string memory serialNumber) 
        external 
        view 
        returns (bool) 
    {
        // Check local NFT contract
        bool usedLocally = nftContract.isSerialTokenized(registry, serialNumber);
        
        // Check external registry cache
        bool usedExternally = registrySerials[registry][serialNumber];
        
        return usedLocally || usedExternally;
    }

    /**
     * @notice Batch check multiple serials (gas-optimized)
     */
    function batchCheckRegistry(
        string memory registry,
        string[] memory serialNumbers
    ) external onlyRole(VERIFIER_ROLE) returns (bytes32[] memory requestIds) {
        require(serialNumbers.length > 0 && serialNumbers.length <= 20, "Invalid batch size");
        
        requestIds = new bytes32[](serialNumbers.length);
        
        for (uint256 i = 0; i < serialNumbers.length; i++) {
            requestIds[i] = this.checkRegistry(registry, serialNumbers[i]);
        }
        
        return requestIds;
    }

    // ============ ADMIN FUNCTIONS ============

    function addRegistry(string memory name, string memory apiEndpoint) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        _addRegistry(name, apiEndpoint);
    }

    function _addRegistry(string memory name, string memory apiEndpoint) internal {
        require(bytes(name).length > 0, "Invalid registry name");
        
        registries[name] = Registry({
            name: name,
            apiEndpoint: apiEndpoint,
            isActive: true,
            checksPerformed: 0,
            duplicatesFound: 0
        });
        
        registryList.push(name);
        
        emit RegistryAdded(name, apiEndpoint);
    }

    function setRegistryStatus(string memory name, bool isActive) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        registries[name].isActive = isActive;
    }

    function setFunctionsConfig(
        bytes32 donId_,
        uint64 subscriptionId_,
        uint32 gasLimit_
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        donId = donId_;
        subscriptionId = subscriptionId_;
        gasLimit = gasLimit_;
    }

    function updateSourceCode(string memory newSource) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        registryCheckSource = newSource;
    }

    // ============ VIEW FUNCTIONS ============

    function getRegistryCheck(bytes32 requestId) 
        external 
        view 
        returns (RegistryCheck memory) 
    {
        return registryChecks[requestId];
    }

    function getRegistry(string memory name) 
        external 
        view 
        returns (Registry memory) 
    {
        return registries[name];
    }

    function getSupportedRegistries() external view returns (string[] memory) {
        return registryList;
    }

    function getRegistryStats(string memory name) 
        external 
        view 
        returns (
            uint256 checksPerformed,
            uint256 duplicatesFound,
            bool isActive
        ) 
    {
        Registry memory reg = registries[name];
        return (reg.checksPerformed, reg.duplicatesFound, reg.isActive);
    }
}
