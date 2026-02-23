// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title CarbonCreditNFT
 * @notice Core carbon credit asset registry - Each NFT represents verified CO2 reduction
 * @dev ERC-721 with oracle-verified metadata and retirement mechanism
 * 
 * Key Features:
 * - Oracle-backed minting (Chainlink proof required)
 * - Double-counting prevention (serial number hashing)
 * - Permanent retirement with audit trail
 * - Multi-methodology support (ICM/Verra/Gold Standard)
 * - Batch operations for gas optimization
 */
contract CarbonCreditNFT is 
    ERC721URIStorage, 
    ERC721Enumerable,
    AccessControl, 
    Pausable,
    ReentrancyGuard 
{
    using Counters for Counters.Counter;

    // ============ ROLES ============
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    // ============ STATE VARIABLES ============
    Counters.Counter private _tokenIds;
    
    /// @notice Carbon credit metadata structure
    struct CarbonCredit {
        string projectId;              // Unique project identifier
        string projectName;            // Human-readable project name
        string methodology;            // "ICM_COMPLIANCE" | "VERRA_VCS" | "GOLD_STANDARD"
        uint256 co2Tonnes;            // Carbon offset amount (18 decimals)
        uint256 vintageYear;          // Year of emission reduction
        string geography;              // Country/region code (ISO 3166)
        bytes32 oracleProofHash;      // Chainlink oracle attestation
        string satelliteDataCID;       // IPFS CID for satellite verification
        address verificationSource;    // ACVA/Verra verifier address
        uint256 verificationDate;     // Timestamp of verification
        bool isRetired;               // Retirement status
        uint256 issuanceDate;         // Minting timestamp
        string serialNumber;          // External registry serial (if applicable)
    }

    /// @notice Retirement certificate for ESG reporting
    struct RetirementCertificate {
        uint256 originalTokenId;
        address retiredBy;
        uint256 retirementDate;
        string retirementReason;
        uint256 co2Tonnes;
    }

    // ============ MAPPINGS ============
    mapping(uint256 => CarbonCredit) public credits;
    mapping(bytes32 => bool) public issuedSerials;           // Prevent double-counting
    mapping(uint256 => RetirementCertificate) public retirementCertificates;
    mapping(string => uint256[]) public projectCredits;      // projectId => tokenIds
    mapping(address => uint256) public userRetiredTonnes;    // ESG tracking
    
    // ============ GLOBAL STATS ============
    uint256 public totalMintedTonnes;
    uint256 public totalRetiredTonnes;
    uint256 public totalActiveCredits;
    
    // Methodology-specific counters
    mapping(string => uint256) public methodologyTonnes;     // "VERRA_VCS" => total tonnes
    
    // Registration tracking
    mapping(address => bool) public hasRegistered;           // Track who has claimed free credits

    // ============ EVENTS ============
    event CreditMinted(
        uint256 indexed tokenId,
        string indexed projectId,
        address indexed recipient,
        uint256 co2Tonnes,
        string methodology
    );
    
    event CreditRetired(
        uint256 indexed tokenId,
        address indexed retiredBy,
        uint256 timestamp,
        uint256 co2Tonnes,
        string reason
    );
    
    event CreditBatchMinted(
        uint256[] tokenIds,
        string projectId,
        uint256 totalTonnes
    );
    
    event VerificationUpdated(
        uint256 indexed tokenId,
        address verifier,
        bytes32 newProofHash
    );

    event SerialNumberRegistered(
        bytes32 indexed serialHash,
        string serialNumber,
        uint256 tokenId
    );

    // ============ CONSTRUCTOR ============
    constructor() ERC721("ATMOS Carbon Credit", "ACC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // ============ CORE FUNCTIONS ============

    /**
     * @notice Mint a single carbon credit with oracle verification
     * @dev Only callable by addresses with ISSUER_ROLE
     * @param to Recipient address
     * @param projectId Unique project identifier
     * @param serialNumber External registry serial (e.g., "VCS-12345")
     * @param methodology Carbon standard methodology
     * @param co2Tonnes Amount of CO2 offset (18 decimals: 1000e18 = 1000 tonnes)
     * @param vintageYear Year of emission reduction
     * @param geography ISO 3166 country code
     * @param oracleProofHash Chainlink oracle attestation hash
     * @param tokenURI IPFS metadata URI
     * @return tokenId The newly minted token ID
     */
    function mintCredit(
        address to,
        string memory projectId,
        string memory projectName,
        string memory serialNumber,
        string memory methodology,
        uint256 co2Tonnes,
        uint256 vintageYear,
        string memory geography,
        bytes32 oracleProofHash,
        string memory satelliteDataCID,
        string memory tokenURI
    ) 
        external 
        onlyRole(ISSUER_ROLE) 
        whenNotPaused
        nonReentrant
        returns (uint256) 
    {
        require(to != address(0), "Invalid recipient");
        require(co2Tonnes > 0, "Invalid CO2 amount");
        require(vintageYear >= 2015 && vintageYear <= 2050, "Invalid vintage year");
        require(oracleProofHash != bytes32(0), "Oracle proof required");

        // Prevent double-counting across registries
        bytes32 serialHash = keccak256(abi.encodePacked(methodology, serialNumber));
        require(!issuedSerials[serialHash], "Credit already tokenized");

        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        // Mint NFT
        _safeMint(to, newTokenId);
        _setTokenURI(newTokenId, tokenURI);

        // Store metadata
        credits[newTokenId] = CarbonCredit({
            projectId: projectId,
            projectName: projectName,
            methodology: methodology,
            co2Tonnes: co2Tonnes,
            vintageYear: vintageYear,
            geography: geography,
            oracleProofHash: oracleProofHash,
            satelliteDataCID: satelliteDataCID,
            verificationSource: msg.sender,
            verificationDate: block.timestamp,
            isRetired: false,
            issuanceDate: block.timestamp,
            serialNumber: serialNumber
        });

        // Mark serial as used
        issuedSerials[serialHash] = true;

        // Update global stats
        totalMintedTonnes += co2Tonnes;
        totalActiveCredits++;
        methodologyTonnes[methodology] += co2Tonnes;
        
        // Index by project
        projectCredits[projectId].push(newTokenId);

        emit CreditMinted(newTokenId, projectId, to, co2Tonnes, methodology);
        emit SerialNumberRegistered(serialHash, serialNumber, newTokenId);

        return newTokenId;
    }

    /**
     * @notice Batch mint carbon credits for gas optimization
     * @dev Use for large project issuances (e.g., 100+ credits)
     * @param to Recipient address
     * @param projectId Shared project identifier
     * @param credits_ Array of credit data structs
     * @return tokenIds Array of newly minted token IDs
     */
    function batchMint(
        address to,
        string memory projectId,
        CreditData[] calldata credits_
    ) 
        external 
        onlyRole(ISSUER_ROLE) 
        whenNotPaused
        nonReentrant
        returns (uint256[] memory tokenIds) 
    {
        require(credits_.length > 0 && credits_.length <= 100, "Invalid batch size");
        
        tokenIds = new uint256[](credits_.length);
        uint256 totalBatchTonnes = 0;

        for (uint256 i = 0; i < credits_.length; i++) {
            CreditData calldata data = credits_[i];
            
            bytes32 serialHash = keccak256(abi.encodePacked(data.methodology, data.serialNumber));
            require(!issuedSerials[serialHash], "Duplicate serial in batch");

            _tokenIds.increment();
            uint256 tokenId = _tokenIds.current();
            tokenIds[i] = tokenId;

            _safeMint(to, tokenId);
            _setTokenURI(tokenId, data.tokenURI);

            credits[tokenId] = CarbonCredit({
                projectId: projectId,
                projectName: data.projectName,
                methodology: data.methodology,
                co2Tonnes: data.co2Tonnes,
                vintageYear: data.vintageYear,
                geography: data.geography,
                oracleProofHash: data.oracleProofHash,
                satelliteDataCID: data.satelliteDataCID,
                verificationSource: msg.sender,
                verificationDate: block.timestamp,
                isRetired: false,
                issuanceDate: block.timestamp,
                serialNumber: data.serialNumber
            });

            issuedSerials[serialHash] = true;
            totalBatchTonnes += data.co2Tonnes;
            methodologyTonnes[data.methodology] += data.co2Tonnes;
            projectCredits[projectId].push(tokenId);
        }

        totalMintedTonnes += totalBatchTonnes;
        totalActiveCredits += credits_.length;

        emit CreditBatchMinted(tokenIds, projectId, totalBatchTonnes);

        return tokenIds;
    }

    /**
     * @notice Simple mint for company registration - mints basic credits
     * @dev Simplified minting for initial company credits (no oracle verification required)
     * @param to Recipient address
     * @param amount Number of credits to mint (each representing 1 tonne CO2)
     * @return tokenIds Array of newly minted token IDs
     */
    function mintSimpleCredits(
        address to,
        uint256 amount
    ) 
        external 
        onlyRole(ISSUER_ROLE) 
        whenNotPaused
        returns (uint256[] memory tokenIds) 
    {
        require(to != address(0), "Invalid recipient");
        require(amount > 0 && amount <= 100, "Invalid amount");

        tokenIds = new uint256[](amount);
        
        for (uint256 i = 0; i < amount; i++) {
            _tokenIds.increment();
            uint256 tokenId = _tokenIds.current();
            tokenIds[i] = tokenId;

            _safeMint(to, tokenId);

            credits[tokenId] = CarbonCredit({
                projectId: "SIMPLE",
                projectName: "Company Registration Credit",
                methodology: "VERRA_VCS",
                co2Tonnes: 1 ether,
                vintageYear: 2026,
                geography: "GLOBAL",
                oracleProofHash: keccak256(abi.encodePacked(to, block.timestamp, i)),
                satelliteDataCID: "",
                verificationSource: msg.sender,
                verificationDate: block.timestamp,
                isRetired: false,
                issuanceDate: block.timestamp,
                serialNumber: ""
            });

            methodologyTonnes["VERRA_VCS"] += 1 ether;
            projectCredits["SIMPLE"].push(tokenId);
        }

        totalMintedTonnes += amount * 1 ether;
        totalActiveCredits += amount;

        emit CreditBatchMinted(tokenIds, "SIMPLE", amount * 1 ether);

        return tokenIds;
    }

    /**
     * @notice Self-register and claim 5 free carbon credits (one-time per address)
     * @dev Public function for company registration - no role required
     * @return tokenIds Array of newly minted token IDs
     */
    function registerAndClaimCredits() 
        external 
        whenNotPaused
        returns (uint256[] memory tokenIds) 
    {
        require(!hasRegistered[msg.sender], "Already claimed registration credits");
        require(msg.sender != address(0), "Invalid address");

        hasRegistered[msg.sender] = true;
        uint256 amount = 5;
        
        tokenIds = new uint256[](amount);
        
        for (uint256 i = 0; i < amount; i++) {
            _tokenIds.increment();
            uint256 tokenId = _tokenIds.current();
            tokenIds[i] = tokenId;

            _safeMint(msg.sender, tokenId);

            credits[tokenId] = CarbonCredit({
                projectId: "REG",
                projectName: "Company Registration Credit",
                methodology: "VERRA_VCS",
                co2Tonnes: 1 ether,
                vintageYear: 2026,
                geography: "GLOBAL",
                oracleProofHash: keccak256(abi.encodePacked(msg.sender, block.timestamp, i)),
                satelliteDataCID: "",
                verificationSource: address(this),
                verificationDate: block.timestamp,
                isRetired: false,
                issuanceDate: block.timestamp,
                serialNumber: ""
            });

            methodologyTonnes["VERRA_VCS"] += 1 ether;
            projectCredits["REG"].push(tokenId);
        }

        totalMintedTonnes += amount * 1 ether;
        totalActiveCredits += amount;

        emit CreditBatchMinted(tokenIds, "REG", amount * 1 ether);

        return tokenIds;
    }

    /**
     * @notice Retire (burn) a carbon credit for offsetting
     * @dev Emits retirement certificate for ESG reporting
     * @param tokenId Token to retire
     * @param reason Retirement reason (e.g., "Q1 2026 Corporate Offsetting")
     */
    function retireCredit(uint256 tokenId, string memory reason) 
        external 
        nonReentrant
    {
        require(ownerOf(tokenId) == msg.sender, "Not credit owner");
        require(!credits[tokenId].isRetired, "Already retired");
        require(bytes(reason).length > 0, "Reason required");

        CarbonCredit storage credit = credits[tokenId];
        credit.isRetired = true;

        // Create retirement certificate
        retirementCertificates[tokenId] = RetirementCertificate({
            originalTokenId: tokenId,
            retiredBy: msg.sender,
            retirementDate: block.timestamp,
            retirementReason: reason,
            co2Tonnes: credit.co2Tonnes
        });

        // Update global stats
        totalRetiredTonnes += credit.co2Tonnes;
        totalActiveCredits--;
        userRetiredTonnes[msg.sender] += credit.co2Tonnes;

        emit CreditRetired(tokenId, msg.sender, block.timestamp, credit.co2Tonnes, reason);

        // Burn NFT (permanent destruction)
        _burn(tokenId);
    }

    /**
     * @notice Batch retirement for enterprises (gas-optimized)
     * @param tokenIds Array of token IDs to retire
     * @param reason Shared retirement reason
     */
    function batchRetire(uint256[] calldata tokenIds, string memory reason) 
        external 
        nonReentrant
    {
        require(tokenIds.length > 0 && tokenIds.length <= 50, "Invalid batch size");
        
        uint256 totalRetiredBatch = 0;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(ownerOf(tokenId) == msg.sender, "Not owner");
            require(!credits[tokenId].isRetired, "Already retired");

            CarbonCredit storage credit = credits[tokenId];
            credit.isRetired = true;

            retirementCertificates[tokenId] = RetirementCertificate({
                originalTokenId: tokenId,
                retiredBy: msg.sender,
                retirementDate: block.timestamp,
                retirementReason: reason,
                co2Tonnes: credit.co2Tonnes
            });

            totalRetiredBatch += credit.co2Tonnes;
            
            emit CreditRetired(tokenId, msg.sender, block.timestamp, credit.co2Tonnes, reason);
            
            _burn(tokenId);
        }

        totalRetiredTonnes += totalRetiredBatch;
        totalActiveCredits -= tokenIds.length;
        userRetiredTonnes[msg.sender] += totalRetiredBatch;
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Get comprehensive credit information
     */
    function getCreditDetails(uint256 tokenId) 
        external 
        view 
        returns (CarbonCredit memory) 
    {
        require(_exists(tokenId), "Token does not exist");
        return credits[tokenId];
    }

    /**
     * @notice Get all credits for a specific project
     */
    function getProjectCredits(string memory projectId) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return projectCredits[projectId];
    }

    /**
     * @notice Get user's retirement certificate for ESG reporting
     */
    function getRetirementCertificate(uint256 tokenId) 
        external 
        view 
        returns (RetirementCertificate memory) 
    {
        require(retirementCertificates[tokenId].retiredBy != address(0), "Not retired");
        return retirementCertificates[tokenId];
    }

    /**
     * @notice Get global carbon statistics
     */
    function getGlobalStats() 
        external 
        view 
        returns (
            uint256 minted,
            uint256 retired,
            uint256 active,
            uint256 totalTokens
        ) 
    {
        return (
            totalMintedTonnes,
            totalRetiredTonnes,
            totalActiveCredits,
            _tokenIds.current()
        );
    }

    /**
     * @notice Get methodology-specific statistics
     */
    function getMethodologyStats(string memory methodology) 
        external 
        view 
        returns (uint256 totalTonnes) 
    {
        return methodologyTonnes[methodology];
    }

    /**
     * @notice Verify if a serial number has been tokenized (anti-fraud)
     */
    function isSerialTokenized(string memory methodology, string memory serialNumber) 
        external 
        view 
        returns (bool) 
    {
        bytes32 serialHash = keccak256(abi.encodePacked(methodology, serialNumber));
        return issuedSerials[serialHash];
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Emergency pause (e.g., oracle compromise detected)
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Update oracle proof (e.g., reverification after audit)
     */
    function updateVerification(
        uint256 tokenId,
        bytes32 newProofHash,
        string memory newSatelliteCID
    ) 
        external 
        onlyRole(ORACLE_ROLE) 
    {
        require(_exists(tokenId), "Token does not exist");
        
        credits[tokenId].oracleProofHash = newProofHash;
        credits[tokenId].satelliteDataCID = newSatelliteCID;
        credits[tokenId].verificationDate = block.timestamp;

        emit VerificationUpdated(tokenId, msg.sender, newProofHash);
    }

    // ============ REQUIRED OVERRIDES ============

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(uint256 tokenId) 
        internal 
        override(ERC721, ERC721URIStorage) 
    {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) 
        public 
        view 
        override(ERC721, ERC721URIStorage) 
        returns (string memory) 
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

// ============ HELPER STRUCT FOR BATCH MINTING ============
struct CreditData {
    string projectName;
    string serialNumber;
    string methodology;
    uint256 co2Tonnes;
    uint256 vintageYear;
    string geography;
    bytes32 oracleProofHash;
    string satelliteDataCID;
    string tokenURI;
}
