// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./CarbonCreditToken.sol";
import "./CarbonCreditNFT.sol";

/**
 * @title CarbonMarketplace
 * @notice Hybrid order book + AMM for carbon credit trading
 * @dev Supports both OTC enterprise trades and retail liquidity pools
 * 
 * Features:
 * - Order book for large OTC trades (enterprises)
 * - AMM pool for retail liquidity
 * - KYC gating for compliance trades
 * - Scheduled bulk purchases (Chainlink Automation)
 * - Compliance retirement tracking
 */
contract CarbonMarketplace is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ ROLES ============
    bytes32 public constant MATCHER_ROLE = keccak256("MATCHER_ROLE");
    bytes32 public constant KYC_ROLE = keccak256("KYC_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ============ STATE VARIABLES ============
    
    /// @notice Supported payment token (USDC/USDT)
    IERC20 public immutable paymentToken;
    
    /// @notice Carbon credit token being traded
    CarbonCreditToken public immutable carbonToken;
    
    /// @notice NFT contract for direct NFT trades
    CarbonCreditNFT public immutable nftContract;

    /// @notice Order structure
    struct Order {
        uint256 orderId;
        address trader;
        bool isBuyOrder;          // true = buy, false = sell
        uint256 amount;           // CCT tokens or NFT count
        uint256 pricePerTonne;    // in payment token (6 decimals for USDC)
        uint256 filled;           // amount filled
        bool isActive;
        uint256 createdAt;
        uint256 expiresAt;
        bool requiresKYC;         // for compliance trades
    }

    /// @notice Auction structure
    struct Auction {
        uint256 auctionId;
        address seller;
        uint256 amount;           // CCT tokens
        uint256 startPrice;       // total bid amount in payment token (1e18)
        uint256 highestBid;       // total bid amount in payment token (1e18)
        address highestBidder;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
    }

    /// @notice AMM pool state
    struct Pool {
        uint256 carbonReserve;    // CCT balance
        uint256 stableReserve;    // USDC balance
        uint256 totalLPTokens;    // Liquidity provider tokens
        uint256 lastPrice;        // Last trade price
        uint256 lastUpdate;
    }

    // ============ MAPPINGS ============
    mapping(uint256 => Order) public orders;
    mapping(uint256 => Auction) public auctions;
    mapping(address => bool) public kycVerified;
    mapping(address => uint256) public lpTokens;       // LP token balances
    mapping(address => uint256[]) public userOrders;   // user => orderIds
    mapping(address => uint256[]) public userAuctions; // user => auctionIds

    Pool public ammPool;
    uint256 public nextOrderId = 1;
    uint256 public nextAuctionId = 1;
    uint256 public tradingFeePercent = 25;  // 0.25% (in basis points)
    uint256 public constant FEE_DENOMINATOR = 10000;

    // ============ EVENTS ============
    event OrderCreated(
        uint256 indexed orderId,
        address indexed trader,
        bool isBuyOrder,
        uint256 amount,
        uint256 pricePerTonne
    );

    event OrderFilled(
        uint256 indexed orderId,
        address indexed taker,
        uint256 amountFilled,
        uint256 totalCost
    );

    event OrderCancelled(uint256 indexed orderId);

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        uint256 amount,
        uint256 startPrice,
        uint256 endTime
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 bidAmount
    );

    event AuctionFinalized(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 winningBid
    );

    event AuctionCancelled(uint256 indexed auctionId);

    event LiquidityAdded(
        address indexed provider,
        uint256 carbonAmount,
        uint256 stableAmount,
        uint256 lpTokens
    );

    event LiquidityRemoved(
        address indexed provider,
        uint256 carbonAmount,
        uint256 stableAmount,
        uint256 lpTokens
    );

    event Swap(
        address indexed trader,
        bool carbonToStable,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );

    event KYCStatusUpdated(address indexed user, bool status);

    // ============ CONSTRUCTOR ============
    constructor(
        address paymentToken_,
        address carbonToken_,
        address nftContract_
    ) {
        require(paymentToken_ != address(0), "Invalid payment token");
        require(carbonToken_ != address(0), "Invalid carbon token");
        require(nftContract_ != address(0), "Invalid NFT contract");

        paymentToken = IERC20(paymentToken_);
        carbonToken = CarbonCreditToken(carbonToken_);
        nftContract = CarbonCreditNFT(nftContract_);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MATCHER_ROLE, msg.sender);
        _grantRole(KYC_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // ============ ORDER BOOK FUNCTIONS ============

    /**
     * @notice Create a buy order (bid)
     * @param amount CCT tokens to buy
     * @param pricePerTonne Price per tonne in payment token
     * @param expiresIn Seconds until order expires (0 = never)
     * @param requiresKYC_ If true, only KYC users can fill
     */
    function createBuyOrder(
        uint256 amount,
        uint256 pricePerTonne,
        uint256 expiresIn,
        bool requiresKYC_
    ) external whenNotPaused nonReentrant returns (uint256 orderId) {
        require(amount > 0, "Invalid amount");
        require(pricePerTonne > 0, "Invalid price");

        if (requiresKYC_) {
            require(kycVerified[msg.sender], "KYC required");
        }

        uint256 totalCost = (amount * pricePerTonne) / 1e18;
        paymentToken.safeTransferFrom(msg.sender, address(this), totalCost);

        orderId = nextOrderId++;
        uint256 expiresAt = expiresIn > 0 ? block.timestamp + expiresIn : type(uint256).max;

        orders[orderId] = Order({
            orderId: orderId,
            trader: msg.sender,
            isBuyOrder: true,
            amount: amount,
            pricePerTonne: pricePerTonne,
            filled: 0,
            isActive: true,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            requiresKYC: requiresKYC_
        });

        userOrders[msg.sender].push(orderId);

        emit OrderCreated(orderId, msg.sender, true, amount, pricePerTonne);

        return orderId;
    }

    /**
     * @notice Create a sell order (ask)
     */
    function createSellOrder(
        uint256 amount,
        uint256 pricePerTonne,
        uint256 expiresIn,
        bool requiresKYC_
    ) external whenNotPaused nonReentrant returns (uint256 orderId) {
        require(amount > 0, "Invalid amount");
        require(pricePerTonne > 0, "Invalid price");

        if (requiresKYC_) {
            require(kycVerified[msg.sender], "KYC required");
        }

        // Lock seller's CCT tokens
        carbonToken.transferFrom(msg.sender, address(this), amount);

        orderId = nextOrderId++;
        uint256 expiresAt = expiresIn > 0 ? block.timestamp + expiresIn : type(uint256).max;

        orders[orderId] = Order({
            orderId: orderId,
            trader: msg.sender,
            isBuyOrder: false,
            amount: amount,
            pricePerTonne: pricePerTonne,
            filled: 0,
            isActive: true,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            requiresKYC: requiresKYC_
        });

        userOrders[msg.sender].push(orderId);

        emit OrderCreated(orderId, msg.sender, false, amount, pricePerTonne);

        return orderId;
    }

    /**
     * @notice Fill an existing order (taker)
     * @param orderId Order to fill
     * @param amount Amount to fill (can be partial)
     */
    function fillOrder(uint256 orderId, uint256 amount) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        Order storage order = orders[orderId];
        
        require(order.isActive, "Order not active");
        require(block.timestamp < order.expiresAt, "Order expired");
        require(amount > 0 && amount <= (order.amount - order.filled), "Invalid fill amount");

        if (order.requiresKYC) {
            require(kycVerified[msg.sender], "KYC required");
        }

        uint256 totalCost = (amount * order.pricePerTonne) / 1e18;
        uint256 fee = (totalCost * tradingFeePercent) / FEE_DENOMINATOR;

        if (order.isBuyOrder) {
            // Taker is selling CCT to buyer
            carbonToken.transferFrom(msg.sender, order.trader, amount);
            paymentToken.safeTransfer(msg.sender, totalCost - fee);
        } else {
            // Taker is buying CCT from seller
            paymentToken.safeTransferFrom(msg.sender, address(this), totalCost);
            carbonToken.transfer(msg.sender, amount);
            paymentToken.safeTransfer(order.trader, totalCost - fee);
        }

        order.filled += amount;

        if (order.filled == order.amount) {
            order.isActive = false;
        }

        emit OrderFilled(orderId, msg.sender, amount, totalCost);
    }

    /**
     * @notice Cancel an active order
     */
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        
        require(order.trader == msg.sender, "Not order creator");
        require(order.isActive, "Order not active");

        uint256 unfilled = order.amount - order.filled;

        if (order.isBuyOrder) {
            // Refund locked payment tokens
            uint256 refund = (unfilled * order.pricePerTonne) / 1e18;
            paymentToken.safeTransfer(msg.sender, refund);
        } else {
            // Return locked CCT
            carbonToken.transfer(msg.sender, unfilled);
        }

        order.isActive = false;

        emit OrderCancelled(orderId);
    }

    // ============ AUCTION FUNCTIONS ============

    /**
     * @notice Create an auction for CCT tokens
     * @param amount Amount of CCT tokens to auction
     * @param startPrice Minimum total bid (1e18)
     * @param endTime Auction end timestamp (unix)
     */
    function createAuction(
        uint256 amount,
        uint256 startPrice,
        uint256 endTime
    ) external whenNotPaused nonReentrant returns (uint256 auctionId) {
        require(amount > 0, "Invalid amount");
        require(startPrice > 0, "Invalid start price");
        require(endTime > block.timestamp, "Invalid end time");

        carbonToken.transferFrom(msg.sender, address(this), amount);

        auctionId = nextAuctionId++;

        auctions[auctionId] = Auction({
            auctionId: auctionId,
            seller: msg.sender,
            amount: amount,
            startPrice: startPrice,
            highestBid: 0,
            highestBidder: address(0),
            startTime: block.timestamp,
            endTime: endTime,
            isActive: true
        });

        userAuctions[msg.sender].push(auctionId);

        emit AuctionCreated(auctionId, msg.sender, amount, startPrice, endTime);

        return auctionId;
    }

    /**
     * @notice Place a bid on an active auction
     * @param auctionId Auction to bid on
     * @param bidAmount Total bid amount in payment token (1e18)
     */
    function placeBid(uint256 auctionId, uint256 bidAmount) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        Auction storage auction = auctions[auctionId];

        require(auction.isActive, "Auction not active");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(bidAmount >= auction.startPrice, "Bid below start price");
        require(bidAmount > auction.highestBid, "Bid too low");

        paymentToken.safeTransferFrom(msg.sender, address(this), bidAmount);

        if (auction.highestBid > 0) {
            paymentToken.safeTransfer(auction.highestBidder, auction.highestBid);
        }

        auction.highestBid = bidAmount;
        auction.highestBidder = msg.sender;

        emit BidPlaced(auctionId, msg.sender, bidAmount);
    }

    /**
     * @notice Finalize an auction and transfer assets
     */
    function finalizeAuction(uint256 auctionId) 
        external 
        nonReentrant 
    {
        Auction storage auction = auctions[auctionId];

        require(auction.isActive, "Auction not active");
        require(block.timestamp >= auction.endTime, "Auction not ended");

        auction.isActive = false;

        if (auction.highestBid == 0) {
            carbonToken.transfer(auction.seller, auction.amount);
            emit AuctionFinalized(auctionId, address(0), 0);
            return;
        }

        uint256 fee = (auction.highestBid * tradingFeePercent) / FEE_DENOMINATOR;
        uint256 payout = auction.highestBid - fee;

        paymentToken.safeTransfer(auction.seller, payout);
        carbonToken.transfer(auction.highestBidder, auction.amount);

        emit AuctionFinalized(auctionId, auction.highestBidder, auction.highestBid);
    }

    /**
     * @notice Cancel an auction before any bids
     */
    function cancelAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];

        require(auction.seller == msg.sender, "Not auction creator");
        require(auction.isActive, "Auction not active");
        require(auction.highestBid == 0, "Auction has bids");

        auction.isActive = false;
        carbonToken.transfer(auction.seller, auction.amount);

        emit AuctionCancelled(auctionId);
    }

    // ============ AMM FUNCTIONS ============

    /**
     * @notice Add liquidity to AMM pool
     * @param carbonAmount CCT tokens to add
     * @param stableAmount Payment tokens to add
     */
    function addLiquidity(uint256 carbonAmount, uint256 stableAmount) 
        external 
        whenNotPaused 
        nonReentrant 
        returns (uint256 lpMinted) 
    {
        require(carbonAmount > 0 && stableAmount > 0, "Invalid amounts");

        if (ammPool.totalLPTokens == 0) {
            // Initial liquidity
            lpMinted = sqrt(carbonAmount * stableAmount);
            require(lpMinted > 0, "Insufficient liquidity");
        } else {
            // Proportional liquidity
            uint256 lpFromCarbon = (carbonAmount * ammPool.totalLPTokens) / ammPool.carbonReserve;
            uint256 lpFromStable = (stableAmount * ammPool.totalLPTokens) / ammPool.stableReserve;
            lpMinted = lpFromCarbon < lpFromStable ? lpFromCarbon : lpFromStable;
        }

        // Transfer tokens
        carbonToken.transferFrom(msg.sender, address(this), carbonAmount);
        paymentToken.safeTransferFrom(msg.sender, address(this), stableAmount);

        // Update pool
        ammPool.carbonReserve += carbonAmount;
        ammPool.stableReserve += stableAmount;
        ammPool.totalLPTokens += lpMinted;
        ammPool.lastUpdate = block.timestamp;

        // Mint LP tokens
        lpTokens[msg.sender] += lpMinted;

        emit LiquidityAdded(msg.sender, carbonAmount, stableAmount, lpMinted);

        return lpMinted;
    }

    /**
     * @notice Remove liquidity from AMM pool
     * @param lpAmount LP tokens to burn
     */
    function removeLiquidity(uint256 lpAmount) 
        external 
        nonReentrant 
        returns (uint256 carbonAmount, uint256 stableAmount) 
    {
        require(lpAmount > 0 && lpAmount <= lpTokens[msg.sender], "Invalid LP amount");

        carbonAmount = (lpAmount * ammPool.carbonReserve) / ammPool.totalLPTokens;
        stableAmount = (lpAmount * ammPool.stableReserve) / ammPool.totalLPTokens;

        // Update pool
        ammPool.carbonReserve -= carbonAmount;
        ammPool.stableReserve -= stableAmount;
        ammPool.totalLPTokens -= lpAmount;
        ammPool.lastUpdate = block.timestamp;

        // Burn LP tokens
        lpTokens[msg.sender] -= lpAmount;

        // Transfer tokens
        carbonToken.transfer(msg.sender, carbonAmount);
        paymentToken.safeTransfer(msg.sender, stableAmount);

        emit LiquidityRemoved(msg.sender, carbonAmount, stableAmount, lpAmount);

        return (carbonAmount, stableAmount);
    }

    /**
     * @notice Swap tokens via AMM (constant product formula)
     * @param carbonToStable true = sell CCT for USDC, false = buy CCT with USDC
     * @param amountIn Input token amount
     * @param minAmountOut Minimum output (slippage protection)
     */
    function swap(
        bool carbonToStable,
        uint256 amountIn,
        uint256 minAmountOut
    ) external whenNotPaused nonReentrant returns (uint256 amountOut) {
        require(amountIn > 0, "Invalid input");
        require(ammPool.totalLPTokens > 0, "No liquidity");

        uint256 fee = (amountIn * tradingFeePercent) / FEE_DENOMINATOR;
        uint256 amountInAfterFee = amountIn - fee;

        if (carbonToStable) {
            // Sell CCT for USDC
            amountOut = (amountInAfterFee * ammPool.stableReserve) / 
                        (ammPool.carbonReserve + amountInAfterFee);
            
            require(amountOut >= minAmountOut, "Slippage exceeded");
            require(amountOut < ammPool.stableReserve, "Insufficient liquidity");

            carbonToken.transferFrom(msg.sender, address(this), amountIn);
            paymentToken.safeTransfer(msg.sender, amountOut);

            ammPool.carbonReserve += amountIn;
            ammPool.stableReserve -= amountOut;
        } else {
            // Buy CCT with USDC
            amountOut = (amountInAfterFee * ammPool.carbonReserve) / 
                        (ammPool.stableReserve + amountInAfterFee);
            
            require(amountOut >= minAmountOut, "Slippage exceeded");
            require(amountOut < ammPool.carbonReserve, "Insufficient liquidity");

            paymentToken.safeTransferFrom(msg.sender, address(this), amountIn);
            carbonToken.transfer(msg.sender, amountOut);

            ammPool.stableReserve += amountIn;
            ammPool.carbonReserve -= amountOut;
        }

        ammPool.lastPrice = (ammPool.stableReserve * 1e18) / ammPool.carbonReserve;
        ammPool.lastUpdate = block.timestamp;

        emit Swap(msg.sender, carbonToStable, amountIn, amountOut, fee);

        return amountOut;
    }

    // ============ VIEW FUNCTIONS ============

    function getPrice() external view returns (uint256) {
        if (ammPool.carbonReserve == 0) return 0;
        return (ammPool.stableReserve * 1e18) / ammPool.carbonReserve;
    }

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    function getUserOrders(address user) external view returns (uint256[] memory) {
        return userOrders[user];
    }

    function getUserAuctions(address user) external view returns (uint256[] memory) {
        return userAuctions[user];
    }

    // ============ ADMIN FUNCTIONS ============

    function setKYCStatus(address user, bool status) external onlyRole(KYC_ROLE) {
        kycVerified[user] = status;
        emit KYCStatusUpdated(user, status);
    }

    function setTradingFee(uint256 newFeePercent) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFeePercent <= 100, "Fee too high"); // Max 1%
        tradingFeePercent = newFeePercent;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ============ UTILITIES ============

    function sqrt(uint256 x) private pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
}
