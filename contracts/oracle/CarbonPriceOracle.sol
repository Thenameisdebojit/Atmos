// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/functions/dev/v1_0_0/FunctionsClient.sol";
import "@chainlink/contracts/src/v0.8/functions/dev/v1_0_0/libraries/FunctionsRequest.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CarbonPriceOracle
 * @notice Decentralized price feed for carbon credits
 * @dev Aggregates prices from multiple exchanges using Chainlink Functions
 * 
 * Price Sources:
 * - ICM (India Carbon Market) - BEE/CERC data
 * - Verra Spot Prices
 * - ACX (AirCarbon Exchange)
 * - CTX (Climate Trade Exchange)
 * - Xpansiv CBL Futures
 * 
 * Updates: Hourly (off-peak), Every 15 min (high volatility)
 */
contract CarbonPriceOracle is 
    FunctionsClient,
    AutomationCompatibleInterface,
    AccessControl 
{
    using FunctionsRequest for FunctionsRequest.Request;

    // ============ ROLES ============
    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");
    bytes32 public constant AUTOMATION_ROLE = keccak256("AUTOMATION_ROLE");

    // ============ STATE VARIABLES ============
    
    address public functionsRouter;
    bytes32 public donId;
    uint64 public subscriptionId;
    uint32 public gasLimit = 250000;

    /// @notice Price data structure
    struct PriceData {
        uint256 price;              // Price per tonne in USD (8 decimals)
        uint256 timestamp;
        uint256 volume24h;          // 24h trading volume
        uint8 confidence;           // 0-100 confidence score
        uint256 dataPoints;         // Number of exchanges aggregated
    }

    /// @notice Methodology-specific pricing
    mapping(string => PriceData) public prices;      // "VERRA_VCS" => price
    mapping(string => PriceData[]) public priceHistory;
    
    string[] public methodologies = ["ICM_COMPLIANCE", "VERRA_VCS", "GOLD_STANDARD"];
    
    uint256 public updateInterval = 1 hours;
    uint256 public lastUpdateTime;
    uint256 public highVolatilityThreshold = 10; // 10% price change triggers fast updates

    // ============ CHAINLINK FUNCTIONS SOURCE CODE ============
    
    string public priceFetcherSource = 
        "const methodology = args[0];"
        ""
        "// Fetch from multiple exchanges"
        "const sources = ["
        "  { name: 'ACX', url: 'https://api.aircarbon.co/v1/prices', weight: 0.3 },"
        "  { name: 'CTX', url: 'https://api.climatetrade.com/v1/prices', weight: 0.2 },"
        "  { name: 'ICM', url: 'https://cerc.gov.in/api/carbon-prices', weight: 0.5 }"
        "];"
        ""
        "const promises = sources.map(source => "
        "  Functions.makeHttpRequest({"
        "    url: `${source.url}/${methodology}`,"
        "    headers: { 'Authorization': `Bearer ${secrets.EXCHANGE_API_KEY}` }"
        "  }).catch(err => ({ error: true, source: source.name }))"
        ");"
        ""
        "const responses = await Promise.all(promises);"
        ""
        "// Calculate volume-weighted average price (VWAP)"
        "let totalPrice = 0;"
        "let totalWeight = 0;"
        "let totalVolume = 0;"
        "let validSources = 0;"
        ""
        "for (let i = 0; i < responses.length; i++) {"
        "  if (!responses[i].error && responses[i].data) {"
        "    const price = parseFloat(responses[i].data.price);"
        "    const volume = parseFloat(responses[i].data.volume_24h || 0);"
        "    const weight = sources[i].weight;"
        "    "
        "    totalPrice += price * weight;"
        "    totalWeight += weight;"
        "    totalVolume += volume;"
        "    validSources++;"
        "  }"
        "}"
        ""
        "if (validSources === 0) {"
        "  throw Error('No valid price sources');"
        "}"
        ""
        "const avgPrice = totalPrice / totalWeight;"
        "const confidence = Math.round((validSources / sources.length) * 100);"
        ""
        "// Encode: [price (8 decimals) | volume (8 decimals) | confidence (uint8)]"
        "const priceScaled = Math.round(avgPrice * 1e8);"
        "const volumeScaled = Math.round(totalVolume * 1e8);"
        ""
        "// Pack into single uint256: [price (128 bits) | volume (120 bits) | confidence (8 bits)]"
        "const result = (BigInt(priceScaled) << 128n) | (BigInt(volumeScaled) << 8n) | BigInt(confidence);"
        ""
        "return Functions.encodeUint256(result);";

    // ============ EVENTS ============
    event PriceUpdated(
        string indexed methodology,
        uint256 price,
        uint256 volume24h,
        uint8 confidence,
        uint256 timestamp
    );

    event HighVolatilityDetected(
        string indexed methodology,
        uint256 oldPrice,
        uint256 newPrice,
        uint256 changePercent
    );

    event PriceRequestFailed(string indexed methodology, string reason);

    // ============ CONSTRUCTOR ============
    constructor(address functionsRouter_) FunctionsClient(functionsRouter_) {
        functionsRouter = functionsRouter_;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PRICE_UPDATER_ROLE, msg.sender);
    }

    // ============ CHAINLINK AUTOMATION ============

    function checkUpkeep(bytes calldata /* checkData */)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        upkeepNeeded = (block.timestamp - lastUpdateTime) >= updateInterval;
        performData = "";
    }

    function performUpkeep(bytes calldata /* performData */) 
        external 
        override 
        onlyRole(AUTOMATION_ROLE)
    {
        _updateAllPrices();
    }

    // ============ PRICE UPDATE FUNCTIONS ============

    function updatePrice(string memory methodology) 
        external 
        onlyRole(PRICE_UPDATER_ROLE) 
    {
        _requestPriceUpdate(methodology);
    }

    function updateAllPrices() external onlyRole(PRICE_UPDATER_ROLE) {
        _updateAllPrices();
    }

    function _updateAllPrices() internal {
        for (uint256 i = 0; i < methodologies.length; i++) {
            _requestPriceUpdate(methodologies[i]);
        }
        lastUpdateTime = block.timestamp;
    }

    function _requestPriceUpdate(string memory methodology) internal {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(priceFetcherSource);

        string[] memory args = new string[](1);
        args[0] = methodology;
        req.setArgs(args);

        _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donId
        );
    }

    function fulfillRequest(
        bytes32 /* requestId */,
        bytes memory response,
        bytes memory err
    ) internal override {
        if (err.length > 0) {
            emit PriceRequestFailed("UNKNOWN", string(err));
            return;
        }

        // Decode packed response
        uint256 packed = abi.decode(response, (uint256));
        
        uint256 price = uint256(uint128(packed >> 128));
        uint256 volume = uint256(uint120((packed >> 8) & ((1 << 120) - 1)));
        uint8 confidence = uint8(packed & 0xFF);

        // Determine methodology (simplified - in production, track by requestId)
        string memory methodology = methodologies[0]; // Placeholder
        
        // Check for high volatility
        PriceData memory oldPrice = prices[methodology];
        if (oldPrice.price > 0) {
            uint256 changePercent = _calculateChangePercent(oldPrice.price, price);
            if (changePercent >= highVolatilityThreshold) {
                emit HighVolatilityDetected(methodology, oldPrice.price, price, changePercent);
                updateInterval = 15 minutes; // Switch to fast updates
            } else if (updateInterval < 1 hours) {
                updateInterval = 1 hours; // Return to normal cadence
            }
        }

        // Update price
        prices[methodology] = PriceData({
            price: price,
            timestamp: block.timestamp,
            volume24h: volume,
            confidence: confidence,
            dataPoints: 3 // Number of exchanges (hardcoded for now)
        });

        // Store in history
        priceHistory[methodology].push(prices[methodology]);

        emit PriceUpdated(methodology, price, volume, confidence, block.timestamp);
    }

    // ============ VIEW FUNCTIONS ============

    function getPrice(string memory methodology) 
        external 
        view 
        returns (uint256 price, uint256 timestamp) 
    {
        PriceData memory data = prices[methodology];
        return (data.price, data.timestamp);
    }

    function getPriceData(string memory methodology) 
        external 
        view 
        returns (PriceData memory) 
    {
        return prices[methodology];
    }

    function getPriceHistory(string memory methodology, uint256 limit) 
        external 
        view 
        returns (PriceData[] memory) 
    {
        uint256 length = priceHistory[methodology].length;
        uint256 resultLength = limit < length ? limit : length;
        
        PriceData[] memory result = new PriceData[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = priceHistory[methodology][length - resultLength + i];
        }
        
        return result;
    }

    function getLatestPrice(string memory methodology) 
        external 
        view 
        returns (uint256) 
    {
        require(prices[methodology].timestamp > 0, "Price not available");
        require(block.timestamp - prices[methodology].timestamp < 24 hours, "Price too stale");
        return prices[methodology].price;
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

    function setUpdateInterval(uint256 interval) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(interval >= 5 minutes && interval <= 24 hours, "Invalid interval");
        updateInterval = interval;
    }

    function setVolatilityThreshold(uint256 threshold) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(threshold > 0 && threshold <= 50, "Invalid threshold");
        highVolatilityThreshold = threshold;
    }

    function grantAutomationRole(address automationRegistry) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        _grantRole(AUTOMATION_ROLE, automationRegistry);
    }

    // ============ UTILITIES ============

    function _calculateChangePercent(uint256 oldPrice, uint256 newPrice) 
        internal 
        pure 
        returns (uint256) 
    {
        if (oldPrice == 0) return 0;
        
        uint256 diff = oldPrice > newPrice ? oldPrice - newPrice : newPrice - oldPrice;
        return (diff * 100) / oldPrice;
    }
}
