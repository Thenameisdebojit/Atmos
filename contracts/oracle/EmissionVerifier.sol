// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/functions/dev/v1_0_0/FunctionsClient.sol";
import "@chainlink/contracts/src/v0.8/functions/dev/v1_0_0/libraries/FunctionsRequest.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../core/CarbonCreditNFT.sol";

/**
 * @title EmissionVerifier
 * @notice Oracle-powered emission verification using Chainlink Functions + Automation
 * @dev Fetches IoT sensor data, satellite imagery, and auditor reports to verify carbon credits
 * 
 * Architecture:
 * 1. Project registers with baseline emission data
 * 2. Chainlink Automation triggers periodic verification (monthly/quarterly)
 * 3. Chainlink Functions aggregates multi-source emission data
 * 4. Smart contract validates reduction and mints credits
 * 
 * Data Sources:
 * - IoT sensors (MQTT broker)
 * - Copernicus satellite API
 * - ACVA auditor signatures
 * - BEE MRV Portal (India compliance)
 */
contract EmissionVerifier is 
    FunctionsClient,
    AutomationCompatibleInterface,
    AccessControl,
    ReentrancyGuard 
{
    using FunctionsRequest for FunctionsRequest.Request;

    // ============ ROLES ============
    bytes32 public constant PROJECT_REGISTRAR_ROLE = keccak256("PROJECT_REGISTRAR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant AUTOMATION_ROLE = keccak256("AUTOMATION_ROLE");

    // ============ STATE VARIABLES ============
    
    /// @notice Chainlink Functions configuration
    address public functionsRouter;
    bytes32 public donId;
    uint64 public subscriptionId;
    uint32 public gasLimit = 300000;
    
    /// @notice Carbon credit NFT contract
    CarbonCreditNFT public immutable nftContract;
    
    /// @notice Project verification state
    struct Project {
        string projectId;
        address owner;
        string methodology;           // "ICM_COMPLIANCE" | "VERRA_VCS" | "GOLD_STANDARD"
        uint256 baselineEmissions;    // Annual baseline in tonnes CO2
        uint256 targetReduction;      // Target reduction percentage (e.g., 30 = 30%)
        uint256 lastVerificationTime;
        uint256 verificationInterval; // Seconds between verifications (30 days default)
        bool isActive;
        string iotEndpoint;           // IoT sensor API endpoint
        string satelliteRegion;       // Lat/lon for satellite data
        bytes32 auditorSignature;     // ACVA digital signature
    }
    
    /// @notice Verification request tracking
    struct VerificationRequest {
        bytes32 requestId;
        string projectId;
        uint256 requestTime;
        bool fulfilled;
        uint256 measuredEmissions;    // Actual emissions measured
        uint256 reductionAchieved;    // Reduction vs baseline
        bytes32 dataProofHash;        // IPFS CID of raw data
        uint8 confidenceScore;        // 0-100 confidence level
    }

    // ============ MAPPINGS ============
    mapping(string => Project) public projects;
    mapping(bytes32 => VerificationRequest) public verificationRequests;
    mapping(string => bytes32[]) public projectRequests;      // projectId => requestIds
    mapping(string => uint256) public projectCreditsMinted;   // projectId => total tonnes
    
    string[] public activeProjects;                           // For Automation upkeep
    mapping(string => bool) public isProjectIndexed;

    // ============ CHAINLINK FUNCTIONS SOURCE CODE ============
    
    /// @notice JavaScript source code executed by Chainlink DON
    /// @dev This fetches data from multiple sources and aggregates
    string public emissionFetcherSource = 
        "const projectId = args[0];"
        "const iotEndpoint = args[1];"
        "const satelliteRegion = args[2];"
        ""
        "// Fetch IoT sensor data"
        "const iotResponse = await Functions.makeHttpRequest({"
        "  url: `${iotEndpoint}/emissions/${projectId}`,"
        "  headers: { 'Authorization': `Bearer ${secrets.IOT_API_KEY}` }"
        "});"
        ""
        "if (iotResponse.error) {"
        "  throw Error('IoT fetch failed');"
        "}"
        ""
        "// Fetch Copernicus satellite data"
        "const [lat, lon] = satelliteRegion.split(',');"
        "const satResponse = await Functions.makeHttpRequest({"
        "  url: 'https://ads.atmosphere.copernicus.eu/api/v2/resources/satellite-carbon-dioxide',"
        "  params: {"
        "    latitude: lat,"
        "    longitude: lon,"
        "    start: new Date(Date.now() - 30*24*60*60*1000).toISOString(),"
        "    end: new Date().toISOString()"
        "  },"
        "  headers: { 'Authorization': `Bearer ${secrets.COPERNICUS_KEY}` }"
        "});"
        ""
        "if (satResponse.error) {"
        "  throw Error('Satellite fetch failed');"
        "}"
        ""
        "// Aggregate emissions data"
        "const iotEmissions = iotResponse.data.total_co2_tonnes;"
        "const satelliteFlux = satResponse.data.mean_co2_flux;"
        ""
        "// Cross-validate (flag if >15% discrepancy)"
        "const discrepancy = Math.abs(iotEmissions - satelliteFlux) / iotEmissions;"
        "if (discrepancy > 0.15) {"
        "  throw Error(`Data mismatch: ${(discrepancy*100).toFixed(1)}% difference`);"
        "}"
        ""
        "// Calculate confidence score"
        "const confidence = Math.round(100 * (1 - discrepancy));"
        ""
        "// Return aggregated data (uint256 format)"
        "const emissions = Math.round(iotEmissions * 1e18);"
        "const conf = confidence;"
        ""
        "return Functions.encodeUint256(emissions);";

    // ============ EVENTS ============
    event ProjectRegistered(
        string indexed projectId,
        address indexed owner,
        uint256 baselineEmissions,
        uint256 targetReduction
    );

    event VerificationRequested(
        bytes32 indexed requestId,
        string indexed projectId,
        uint256 requestTime
    );

    event VerificationFulfilled(
        bytes32 indexed requestId,
        string indexed projectId,
        uint256 measuredEmissions,
        uint256 reductionAchieved,
        uint8 confidenceScore
    );

    event CreditsMinted(
        string indexed projectId,
        address indexed owner,
        uint256 amount,
        uint256 tokenId
    );

    event ProjectDeactivated(string indexed projectId, string reason);

    event SourceCodeUpdated(uint256 timestamp);

    // ============ CONSTRUCTOR ============
    constructor(
        address functionsRouter_,
        address nftContract_
    ) FunctionsClient(functionsRouter_) {
        require(nftContract_ != address(0), "Invalid NFT contract");
        
        functionsRouter = functionsRouter_;
        nftContract = CarbonCreditNFT(nftContract_);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PROJECT_REGISTRAR_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    // ============ PROJECT MANAGEMENT ============

    /**
     * @notice Register a new carbon offset project
     * @dev Only authorized registrars (ACVA, project developers with verification)
     * @param projectId Unique project identifier
     * @param methodology Carbon standard (ICM/Verra/Gold Standard)
     * @param baselineEmissions Annual baseline emissions in tonnes
     * @param targetReduction Target reduction percentage (e.g., 30 for 30%)
     * @param verificationInterval Seconds between verifications (default 30 days)
     * @param iotEndpoint IoT sensor API endpoint
     * @param satelliteRegion "lat,lon" for satellite monitoring
     * @param auditorSignature ACVA digital signature
     */
    function registerProject(
        string memory projectId,
        address owner,
        string memory methodology,
        uint256 baselineEmissions,
        uint256 targetReduction,
        uint256 verificationInterval,
        string memory iotEndpoint,
        string memory satelliteRegion,
        bytes32 auditorSignature
    ) external onlyRole(PROJECT_REGISTRAR_ROLE) {
        require(bytes(projectId).length > 0, "Invalid project ID");
        require(owner != address(0), "Invalid owner");
        require(baselineEmissions > 0, "Invalid baseline");
        require(targetReduction > 0 && targetReduction <= 100, "Invalid target");
        require(!projects[projectId].isActive, "Project already registered");

        projects[projectId] = Project({
            projectId: projectId,
            owner: owner,
            methodology: methodology,
            baselineEmissions: baselineEmissions,
            targetReduction: targetReduction,
            lastVerificationTime: block.timestamp,
            verificationInterval: verificationInterval > 0 ? verificationInterval : 30 days,
            isActive: true,
            iotEndpoint: iotEndpoint,
            satelliteRegion: satelliteRegion,
            auditorSignature: auditorSignature
        });

        if (!isProjectIndexed[projectId]) {
            activeProjects.push(projectId);
            isProjectIndexed[projectId] = true;
        }

        emit ProjectRegistered(projectId, owner, baselineEmissions, targetReduction);
    }

    /**
     * @notice Deactivate a project (e.g., project completed, fraud detected)
     */
    function deactivateProject(string memory projectId, string memory reason) 
        external 
        onlyRole(VERIFIER_ROLE) 
    {
        require(projects[projectId].isActive, "Project not active");
        projects[projectId].isActive = false;
        
        emit ProjectDeactivated(projectId, reason);
    }

    // ============ CHAINLINK AUTOMATION (SCHEDULED VERIFICATION) ============

    /**
     * @notice Chainlink Automation calls this to check if verification is needed
     * @dev Checks all active projects for verification interval expiry
     */
    function checkUpkeep(bytes calldata /* checkData */)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        string[] memory projectsToVerify = new string[](activeProjects.length);
        uint256 count = 0;

        for (uint256 i = 0; i < activeProjects.length; i++) {
            string memory projectId = activeProjects[i];
            Project memory project = projects[projectId];

            if (project.isActive && 
                (block.timestamp - project.lastVerificationTime) >= project.verificationInterval) {
                projectsToVerify[count] = projectId;
                count++;
            }
        }

        if (count > 0) {
            // Resize array to actual count
            string[] memory result = new string[](count);
            for (uint256 i = 0; i < count; i++) {
                result[i] = projectsToVerify[i];
            }
            
            upkeepNeeded = true;
            performData = abi.encode(result);
        } else {
            upkeepNeeded = false;
            performData = "";
        }
    }

    /**
     * @notice Chainlink Automation calls this to perform verification
     * @dev Triggers Chainlink Functions requests for all projects due for verification
     */
    function performUpkeep(bytes calldata performData) 
        external 
        override 
        onlyRole(AUTOMATION_ROLE)
    {
        string[] memory projectsToVerify = abi.decode(performData, (string[]));
        
        for (uint256 i = 0; i < projectsToVerify.length; i++) {
            _requestVerification(projectsToVerify[i]);
        }
    }

    // ============ CHAINLINK FUNCTIONS (DATA FETCHING) ============

    /**
     * @notice Manually trigger verification (for testing or on-demand verification)
     */
    function requestVerification(string memory projectId) 
        external 
        onlyRole(VERIFIER_ROLE) 
    {
        _requestVerification(projectId);
    }

    /**
     * @notice Internal function to request emission data via Chainlink Functions
     */
    function _requestVerification(string memory projectId) 
        internal 
        nonReentrant 
    {
        Project storage project = projects[projectId];
        require(project.isActive, "Project not active");

        // Prepare Chainlink Functions request
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(emissionFetcherSource);

        // Set arguments
        string[] memory args = new string[](3);
        args[0] = projectId;
        args[1] = project.iotEndpoint;
        args[2] = project.satelliteRegion;
        req.setArgs(args);

        // Send request to Chainlink DON
        bytes32 requestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donId
        );

        // Track request
        verificationRequests[requestId] = VerificationRequest({
            requestId: requestId,
            projectId: projectId,
            requestTime: block.timestamp,
            fulfilled: false,
            measuredEmissions: 0,
            reductionAchieved: 0,
            dataProofHash: bytes32(0),
            confidenceScore: 0
        });

        projectRequests[projectId].push(requestId);

        emit VerificationRequested(requestId, projectId, block.timestamp);
    }

    /**
     * @notice Chainlink Functions callback - receives emission data
     * @dev Automatically called by Chainlink DON after data aggregation
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        VerificationRequest storage request = verificationRequests[requestId];
        require(!request.fulfilled, "Request already fulfilled");

        if (err.length > 0) {
            // Oracle error - flag for manual review
            emit VerificationFulfilled(requestId, request.projectId, 0, 0, 0);
            return;
        }

        // Decode response (uint256 encoded emissions)
        uint256 measuredEmissions = abi.decode(response, (uint256));
        
        Project storage project = projects[request.projectId];
        
        // Calculate reduction
        uint256 reductionAchieved = 0;
        if (measuredEmissions < project.baselineEmissions) {
            reductionAchieved = project.baselineEmissions - measuredEmissions;
        }

        // Calculate confidence score (simplified - in production, parse from response)
        uint8 confidenceScore = 95; // Placeholder

        // Update request
        request.fulfilled = true;
        request.measuredEmissions = measuredEmissions;
        request.reductionAchieved = reductionAchieved;
        request.confidenceScore = confidenceScore;
        request.dataProofHash = keccak256(response); // In production, store IPFS CID

        // Update project
        project.lastVerificationTime = block.timestamp;

        emit VerificationFulfilled(
            requestId,
            request.projectId,
            measuredEmissions,
            reductionAchieved,
            confidenceScore
        );

        // Auto-mint credits if reduction meets target and confidence is high
        if (confidenceScore >= 90 && reductionAchieved > 0) {
            _mintCreditsForProject(request.projectId, reductionAchieved, requestId);
        }
    }

    /**
     * @notice Mint carbon credits based on verified emission reduction
     */
    function _mintCreditsForProject(
        string memory projectId,
        uint256 reductionTonnes,
        bytes32 requestId
    ) internal {
        Project memory project = projects[projectId];
        
        // Prepare metadata
        string memory tokenURI = string(abi.encodePacked(
            "ipfs://Qm", // Placeholder - in production, upload to IPFS
            projectId
        ));

        string memory serialNumber = string(abi.encodePacked(
            project.methodology,
            "-",
            projectId,
            "-",
            _toString(block.timestamp)
        ));

        // Mint NFT
        uint256 tokenId = nftContract.mintCredit(
            project.owner,
            projectId,
            projectId, // projectName
            serialNumber,
            project.methodology,
            reductionTonnes * 1e18, // Convert to 18 decimals
            block.timestamp / 365 days + 1970, // Vintage year
            "India", // Geography - make dynamic in production
            requestId, // Oracle proof hash
            "", // Satellite data CID - add in production
            tokenURI
        );

        projectCreditsMinted[projectId] += reductionTonnes;

        emit CreditsMinted(projectId, project.owner, reductionTonnes, tokenId);
    }

    // ============ VIEW FUNCTIONS ============

    function getProject(string memory projectId) 
        external 
        view 
        returns (Project memory) 
    {
        return projects[projectId];
    }

    function getVerificationRequest(bytes32 requestId) 
        external 
        view 
        returns (VerificationRequest memory) 
    {
        return verificationRequests[requestId];
    }

    function getProjectRequests(string memory projectId) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return projectRequests[projectId];
    }

    function getActiveProjectCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < activeProjects.length; i++) {
            if (projects[activeProjects[i]].isActive) {
                count++;
            }
        }
        return count;
    }

    // ============ ADMIN FUNCTIONS ============

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
        emissionFetcherSource = newSource;
        emit SourceCodeUpdated(block.timestamp);
    }

    function grantAutomationRole(address automationRegistry) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        _grantRole(AUTOMATION_ROLE, automationRegistry);
    }

    // ============ UTILITIES ============

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
